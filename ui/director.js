/* ============================================================
   CRESCENDO — ui/director.js  ·  the animation director
   docs/crescendo/MOTION.md is the spec; FRAMEWORK.md §4.4 is the approach.

   The ONLY file that touches Web Animations (`el.animate`). Everything the
   table moves goes through here as a NAMED BEAT; components never animate.

     const d = DawnUIDirector.create({root, reduceMotion, now, animate, ...});
     d.enqueue({kind:"play", els:{card}, pose:{from, glimpse, slot}, commit(){…}});
     d.skip();  d.tapThrough();  d.hold(true|false);  d.idle().then(…);

   WHAT A BEAT IS. {kind, els:{role: element|selector|"uid:<data-uid>"}, pose:{…},
   begin(), contact(), commit(), ready:Promise}. A beat is a list of PHASES
   (enter · hold · leave …); a phase is a set of ITEMS (role, at, dur, keyframes,
   easing) plus sound CUES. The planner (`plan`) is PURE: beat + context → phases,
   no DOM, no clock. The scheduler runs phases with injected `now`, timers and
   `animate`, so node drills it (test/ui-director.test.js).

   THE RULES IT KEEPS (MOTION.md):
   - transform and opacity ONLY (§1.2); `will-change` only while a beat runs and
     on at most 12 elements (§1.3); no layout read inside a beat except the one
     FLIP measurement at a beat's start, outside any of the director's own flights (§1.4).
   - STATE IS FIRST (§0, §4.4): the director never gates or delays truth. The
     shell changes state at t=0; hooks (`contact`, `commit`) are where a number
     or a zone changes, and they run at the frame the choreography says.
   - SAME EVENT, SAME TIME (§2.3): every duration is a function of the beat kind,
     the speed setting and (for hits) the damage tier, never of a clock or a seat.
   - ONE QUEUE (§4.1): beats of lane "q" run strictly one at a time; a queue
     deeper than 3 plays at 0.6x durations / 0.5x holds until it is <= 1 deep.
     Beats of lane "now" (select, deselect, refuse, fade) never wait.
   - SKIP is never a hard cut mid-flight (§4.3): it compresses what is left of
     the current beat into --m-fast (every duration capped, every hold 0).
   - REDUCED MOTION (§1.5): flights, slams, shakes, pops and sweeps become cuts;
     hit-stop is dropped; the announcement stays (opacity fade, same hold);
     a hit is a 120 ms opacity flash.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DawnUIDirector = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

/* ---------- tokens: CSS custom properties first, this table when the page has none ----------
   FALLBACK must equal docs/crescendo/tokens.css (test/ui-director.test.js proves it). */
var TOKEN_CSS = {
  press: "--m-press", fast: "--m-fast", std: "--m-std", emph: "--m-emph", slam: "--m-slam",
  glimpseOwn: "--m-glimpse-own", holdAnnounce: "--m-hold-announce",
  ghostDelay: "--m-ghost-delay", ghostDrain: "--m-ghost-drain",
  hitstopLight: "--m-hitstop-light", hitstopMid: "--m-hitstop-mid",
  hitstopHeavy: "--m-hitstop-heavy", hitstopKo: "--m-hitstop-ko"
};
var EASE_CSS = { out: "--m-ease-out", "in": "--m-ease-in", inout: "--m-ease-inout", slam: "--m-ease-slam" };
var FALLBACK = {
  press: 70, fast: 120, std: 220, emph: 380, slam: 260, glimpseOwn: 560, holdAnnounce: 1500,
  ghostDelay: 420, ghostDrain: 380, hitstopLight: 50, hitstopMid: 90, hitstopHeavy: 150, hitstopKo: 260
};
var FALLBACK_EASE = {
  out: "cubic-bezier(.16,.84,.24,1)", "in": "cubic-bezier(.55,0,.85,.35)",
  inout: "cubic-bezier(.45,0,.2,1)", slam: "cubic-bezier(.3,1.45,.5,1)"
};

function parseMs(s) {
  s = String(s == null ? "" : s).trim();
  var v = parseFloat(s);
  if (!isFinite(v)) return NaN;
  return /ms$/.test(s) ? v : /s$/.test(s) ? v * 1000 : v;
}
function readTokens(el) {
  var T = {}, E = {}, k;
  for (k in FALLBACK) T[k] = FALLBACK[k];
  for (k in FALLBACK_EASE) E[k] = FALLBACK_EASE[k];
  try {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    var node = el || (g.document && g.document.documentElement);
    if (node && g.getComputedStyle) {
      var cs = g.getComputedStyle(node);
      for (k in TOKEN_CSS) { var v = parseMs(cs.getPropertyValue(TOKEN_CSS[k])); if (isFinite(v)) T[k] = v; }
      for (k in EASE_CSS) { var e = String(cs.getPropertyValue(EASE_CSS[k]) || "").trim(); if (e) E[k] = e; }
    }
  } catch (err) { /* the fallback table stands */ }
  return { T: T, E: E };
}

/* ---------- speed (MOTION.md §4.4) ---------- */
var SPEEDS = {
  standard: { d: 1,  hold: function (T, k) { return k === "own" ? T.glimpseOwn : T.holdAnnounce; } },
  quick:    { d: .6, hold: function (T, k) { return k === "own" ? 250 : 700; } },
  instant:  { d: 0,  hold: function (T, k) { return k === "own" ? 0 : 400; } }   /* the slab still shows 400 ms so a play is READ */
};
function speedOf(x) {
  if (typeof x === "string" && SPEEDS[x]) return SPEEDS[x];
  if (typeof x === "number" && x >= 0 && isFinite(x))
    return { d: x, hold: function (T, k) { return (k === "own" ? T.glimpseOwn : T.holdAnnounce) * x; } };
  return SPEEDS.standard;
}

var RESULT_HOLD = 1180, RESULT_LOCK = 600;   /* §3.18: 1020 -> 2200, not skippable for the first 600 ms */
var STAGGER = 40, GAP_AFTER_SKIP = 40, WILL_CAP = 12, ACCEL_AT = 3;

function rnd(x) { return Math.round(x * 1000) / 1000; }
function r2(x) { return +(+x).toFixed(2); }

/* ---------- the context a planner reads: every number goes through it ---------- */
function makeCtx(o) {
  var T = o.T, sc = o.sp.d * (o.accel ? .6 : 1), cap = o.cap || T.fast;
  var c = {
    T: T, E: o.E, rm: !!o.rm, skipping: !!o.skipping, accel: !!o.accel,
    el: o.el || function () { return null; }, measure: o.measure || function () { return null; },
    /* d: an ordinary duration — scaled by speed and queue pressure; a cut in reduced motion;
       capped to --m-fast while skipping */
    d: function (ms) { if (c.rm) return 0; var v = ms * sc; return rnd(c.skipping ? Math.min(v, cap) : v); },
    /* f: FEEL — shake, pop, flash: kept at every speed (§4.4), cut in reduced motion */
    f: function (ms) { if (c.rm) return 0; return rnd(c.skipping ? Math.min(ms, cap) : ms); },
    /* hs: a hit-stop hold (kept at every speed, dropped in reduced motion and while skipping) */
    hs: function (ms) { return (c.rm || c.skipping) ? 0 : ms; },
    /* fade: the opacity-only duration that replaces a movement in reduced motion */
    fade: function () { return rnd(c.skipping ? Math.min(T.fast, cap) : T.fast); },
    hold: function (kind) {
      if (kind === "result") return RESULT_HOLD;
      if (c.skipping) return 0;
      var k = o.accel ? .5 : 1;
      if (kind === "own") return rnd(o.sp.hold(T, "own") * k);
      if (kind === "announce") return rnd(o.sp.hold(T, "announce") * k);
      if (kind === "reaction") return rnd(o.sp.hold(T, "announce") * .6 * k);
      if (kind === "reactionOwn") return rnd(T.glimpseOwn ? 300 * o.sp.hold(T, "own") / T.glimpseOwn * k : 0);
      return 0;
    },
    holdMs: function (ms) {   /* a fixed hold that follows the own-glimpse speed factor */
      if (c.skipping) return 0;
      return rnd(T.glimpseOwn ? ms * o.sp.hold(T, "own") / T.glimpseOwn * (o.accel ? .5 : 1) : 0);
    }
  };
  return c;
}

/* ---------- building blocks ---------- */
function tf(p) {
  if (!p) return "none";
  return "translate3d(" + r2(p.x || 0) + "px," + r2(p.y || 0) + "px,0) scale(" + r2(p.s == null ? 1 : p.s) + ")" +
    (p.r ? " rotate(" + r2(p.r) + "deg)" : "");
}
function scaled(p, k) { return p && { x: p.x, y: p.y, s: (p.s == null ? 1 : p.s) * k, r: p.r }; }
function moved(p, dx, dy) { return p && { x: p.x + dx, y: p.y + dy, s: p.s, r: p.r }; }
function lifted(p) { return p && { x: p.x, y: p.y - 22, s: (p.s == null ? 1 : p.s) * 1.06, r: p.r }; }
function it(role, at, dur, kf, ease, o) {
  var x = { role: role, at: rnd(at), dur: rnd(dur), kf: kf, ease: ease || "linear" };
  if (o) for (var k in o) x[k] = o[k];
  return x;
}
function cue(at, name, o) { var x = { at: rnd(at), name: name }; if (o) for (var k in o) x[k] = o[k]; return x; }
function ph(name, items, cues, o) {
  items = items.filter(Boolean); cues = cues || [];
  var len = 0, i;
  for (i = 0; i < items.length; i++) len = Math.max(len, items[i].at + items[i].dur);
  for (i = 0; i < cues.length; i++) len = Math.max(len, cues[i].at);
  var p = { name: name, items: items, cues: cues, len: rnd(len) };
  if (o) for (var k in o) p[k] = o[k];
  return p;
}
function holdPhase(name, ms, lock) { return { name: name, items: [], cues: [], len: rnd(ms), hold: true, lock: lock || 0 }; }
function popKf(big, rise, color) {   /* a number pop laid over a number that already changed */
  return [{ transform: "translate3d(0,8px,0) scale(.4)", opacity: 0, offset: 0 },
    { transform: "translate3d(0,-6px,0) scale(" + r2(big) + ")", opacity: 1, offset: .28 },
    { transform: "translate3d(0,-14px,0) scale(1)", opacity: 1, offset: .7 },
    { transform: "translate3d(0," + (-rise) + "px,0) scale(1)", opacity: 0, offset: 1 }];
}
function pulseKf(peak) { return [{ transform: "scale(1)" }, { transform: "scale(" + peak + ")", offset: .4 }, { transform: "scale(1)" }]; }
function fadeKf(a, b) { return [{ opacity: a }, { opacity: b }]; }

/* the shake: a decaying sine, squared falloff — MOTION.md §2.1 (pure; the same dmg is the same shake) */
function shakeSpec(dmg) {
  return { amp: Math.min(2.5 + 1.5 * dmg, 13), dur: Math.min(160 + 28 * dmg, 420), rot: dmg >= 6 ? 1.1 : 0 };
}
function shakeKeyframes(spec) {
  var n = Math.max(2, Math.round(spec.dur / 16.7)), kf = [], i;
  for (i = 0; i <= n; i++) {
    var p = i / n, fall = Math.pow(1 - p, 2), ph_ = i * 2.1;
    kf.push({
      transform: "translate3d(" + r2(Math.sin(ph_) * spec.amp * fall) + "px," + r2(Math.cos(ph_ * 1.3) * spec.amp * .6 * fall) + "px,0) rotate(" +
        (+(Math.sin(ph_ * .8) * spec.rot * fall).toFixed(3)) + "deg)",
      offset: p
    });
  }
  return kf;
}
var KO_SHAKE = { amp: 12, dur: 420, rot: 1.1 };

function hitstopFor(T, dmg) { return dmg >= 7 ? T.hitstopHeavy : dmg >= 3 ? T.hitstopMid : T.hitstopLight; }
function hitCue(dmg) { return dmg >= 7 ? "hit7" : dmg >= 3 ? "hit3" : "hit1"; }

/* FLIP: the delta that makes the LAST layout look like the FIRST (center-based, so the default
   transform-origin works for a size change too). Rects are {x,y,w,h}. */
function flipDelta(f, l) {
  if (!f || !l || !l.w || !l.h) return null;
  var dx = (f.x + f.w / 2) - (l.x + l.w / 2), dy = (f.y + f.h / 2) - (l.y + l.h / 2), sx = f.w / l.w, sy = f.h / l.h;
  if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .001 && Math.abs(sy - 1) < .001) return null;
  return { dx: dx, dy: dy, sx: sx, sy: sy };
}

/* a card's trip in: lift, fly to the glimpse, settle (the 3.3 opening) */
function flyIn(items, role, from, glim, at, c) {
  var T = c.T, E = c.E, lf = lifted(from), a = c.d(T.press), fl = c.d(T.std + 40), st = c.d(80);
  items.push(it(role, at, a, [{ transform: tf(from) }, { transform: tf(lf) }], E.out));
  items.push(it(role, at + a, fl, [{ transform: tf(lf) }, { transform: tf(scaled(glim, 1.04)) }], E.out));
  items.push(it(role, at + a + fl, st, [{ transform: tf(scaled(glim, 1.04)) }, { transform: tf(glim) }], E.out));
  return at + a + fl;
}

/* the lunge: wind-up 8 px back (--m-fast), then 90 ms ease-in into the hit (§3.9) */
function strikePhase(b, c) {
  var P = b.pose || {}, items = [];
  if (!c.rm && P.home && P.hit && b.lunge !== false) {
    var vx = P.hit.x - P.home.x, vy = P.hit.y - P.home.y, m = Math.sqrt(vx * vx + vy * vy) || 1;
    var back = { x: P.home.x - vx / m * 8, y: P.home.y - vy / m * 8, s: P.home.s, r: P.home.r };
    var w = c.d(c.T.fast), l = c.d(90);
    items.push(it("attacker", 0, w, [{ transform: tf(P.home) }, { transform: tf(back) }], c.E.out));
    items.push(it("attacker", w, l, [{ transform: tf(back) }, { transform: tf(P.hit) }], c.E["in"]));
  }
  return ph("strike", items, []);
}

/* ============================================================
   THE BEATS. lane "q" = the strict queue; "now" = never waits.
   `hooks` are the beat callbacks a flush (tapThrough) must still run.
   ============================================================ */
var KINDS = {};

/* §3.2 select / deselect, §3.1 the refused-tap nudge — lane now */
KINDS.select = { lane: "now", hooks: [], phases: [function (b, c) {
  var P = b.pose || {}, lf = P.lift || lifted(P.rest), items = [];
  items.push(it("card", 0, c.d(c.T.press), [{ transform: tf(P.rest) }, { transform: tf(lf) }], c.E.out, { keep: true }));
  if (!c.rm) items.push(it("chips", 0, c.d(c.T.fast), fadeKf(0, 1), c.E.out, { keep: true }));
  else items.push(it("chips", 0, 0, fadeKf(0, 1), "linear", { keep: true }));
  return ph("lift", items, [cue(0, "select")]);
}] };
KINDS.deselect = { lane: "now", hooks: [], phases: [function (b, c) {
  var P = b.pose || {}, lf = P.lift || lifted(P.rest);
  return ph("settle", [
    it("card", 0, c.d(c.T.fast), [{ transform: tf(lf) }, { transform: tf(P.rest) }], c.E.out, { keep: true }),
    it("chips", 0, c.d(c.T.fast), fadeKf(1, 0), c.E.out, { keep: true })], []);
}] };
KINDS.refuse = { lane: "now", hooks: [], phases: [function (b, c) {
  var P = b.pose || {}, rest = P.rest || { x: 0, y: 0, s: 1 }, xs = [0, 4, -4, 4, 0], kf = [];
  xs.forEach(function (x, i) { kf.push({ transform: tf(moved(rest, x, 0)), offset: i / (xs.length - 1) }); });
  return ph("nudge", [it("card", 0, c.rm ? 0 : 140, kf, "linear")], [cue(0, "tap")]);
}] };
KINDS.fade = { lane: "now", hooks: [], phases: [function (b, c) {
  var from = b["in"] ? 0 : 1, to = b["in"] ? 1 : 0;
  return ph("fade", [it("target", 0, c.rm ? 0 : c.f(c.T.fast), fadeKf(from, to), "linear", { keep: true })], []);
}] };

/* §3.3 / §3.6: your own play — hand -> glimpse -> zone. 1190 ms. An attack adds the badge pop and the tilt. */
KINDS.play = { lane: "q", hooks: ["commit"], phases: [
  function (b, c) {
    var P = b.pose || {}, items = [], cues = [], end = flyIn(items, "card", P.from, P.glimpse, 0, c);
    (b.extras || []).forEach(function (x, i) { flyIn(items, "x" + i, x.from, x.glimpse, c.d(STAGGER) * (i + 1), c); });
    if (b.reveal) items.push(it("back", 0, 0, fadeKf(1, 0), "linear", { keep: true }));   /* from the arsenal: the face shows on lift */
    cues.push(cue(end, "slap"));
    return ph("fly", items, cues);
  },
  function (b, c) { return holdPhase("hold", c.hold(b.hold || "own")); },
  function (b, c) {
    var P = b.pose || {}, T = c.T, E = c.E, sd = c.d(T.std), items = [], slot = P.slot;
    if (b.attack && slot) slot = { x: slot.x, y: slot.y, s: slot.s, r: b.tilt == null ? 1.5 : b.tilt };
    items.push(it("card", 0, sd, [{ transform: tf(P.glimpse) }, { transform: tf(slot) }], E.inout));
    (b.extras || []).forEach(function (x, i) { items.push(it("x" + i, 0, sd, [{ transform: tf(x.glimpse) }, { transform: tf(x.to) }], E.inout)); });
    (b.slides || []).forEach(function (s) { items.push(it(s.role, 0, sd, [{ transform: tf(s.from) }, { transform: tf(s.to) }], E.inout)); });
    if (b.attack && !c.rm) items.push(it("badge", 0, sd, [{ transform: "scale(1)" }, { transform: "scale(1.25)", offset: .5 }, { transform: "scale(1)" }], E.out));
    return ph("land", items, []);
  }] };

/* §3.11 a reaction: short glimpse, never the full hold. 740 ms. */
KINDS.reaction = { lane: "q", hooks: ["commit"], phases: [
  function (b, c) {
    var P = b.pose || {}, g = scaled(P.glimpse, .7), fl = c.d(c.T.std);
    return ph("fly", [it("card", 0, fl, [{ transform: tf(P.from) }, { transform: tf(g) }], c.E.out)], [cue(fl, "slap", { gain: .7 })]);
  },
  function (b, c) { return holdPhase("hold", c.hold("reactionOwn")); },
  function (b, c) {
    var P = b.pose || {}, sd = c.d(c.T.std), items = [it("card", 0, sd, [{ transform: tf(scaled(P.glimpse, .7)) }, { transform: tf(P.slot) }], c.E.inout)];
    if (!c.rm) items.push(it("number", 0, sd, pulseKf(1.25), c.E.out));
    return ph("land", items, []);
  }] };

/* §3.5 the opponent's play announced: slab + glimpse, one at a time. 2160 ms (1500 hold). */
function slabSide(b) { return b.side === "right" ? 1 : -1; }
KINDS.announce = { lane: "q", hooks: ["commit"], phases: [
  function (b, c) {
    var P = b.pose || {}, T = c.T, E = c.E, s = slabSide(b), items = [], cues = [], g = P.glimpse;
    var gl = scaled(g, 1.04);
    if (c.rm) {
      var fd = c.fade();
      items.push(it("slab", 0, fd, fadeKf(0, 1), "linear"));
      items.push(it("card", 0, fd, [{ transform: tf(g), opacity: 0 }, { transform: tf(g), opacity: 1 }], "linear"));
      if (b.reveal !== false) items.push(it("back", 0, 0, fadeKf(1, 0), "linear", { keep: true }));
      (b.extras || []).forEach(function (x, i) { items.push(it("x" + i, 0, fd, [{ transform: tf(x.glimpse), opacity: 0 }, { transform: tf(x.glimpse), opacity: 1 }], "linear")); });
      cues.push(cue(0, "thud"), cue(fd, "slap", b.reaction ? { gain: .7 } : null));
      return ph("enter", items, cues);
    }
    var sl = c.d(T.slam), at = c.d(60), fl = c.d(T.emph);
    items.push(it("slab", 0, sl, [
      { transform: "translate3d(" + (100 * s) + "%,0,0)", opacity: 1 }, { transform: "translate3d(" + (-10 * s) + "px,0,0)", opacity: 1, offset: .7 },
      { transform: "translate3d(0,0,0)", opacity: 1 }], E.out));
    items.push(it("card", at, fl, [{ transform: tf(P.back || g), opacity: 0 }, { transform: tf(gl), opacity: 1, offset: .8 }, { transform: tf(g), opacity: 1 }], E.out));
    if (b.reveal !== false) items.push(it("back", at, 0, fadeKf(1, 0), "linear", { keep: true }));   /* the face is revealed 60 ms in (pre-decoded) */
    (b.extras || []).forEach(function (x, i) {
      items.push(it("x" + i, at + c.d(STAGGER) * (i + 1), fl, [{ transform: tf(x.from || P.back || x.glimpse), opacity: 0 }, { transform: tf(x.glimpse), opacity: 1 }], E.out));
    });
    cues.push(cue(0, "thud"), cue(at + fl, "slap", b.reaction ? { gain: .7 } : null));
    return ph("enter", items, cues);
  },
  function (b, c) { return holdPhase("hold", c.hold(b.reaction ? "reaction" : "announce")); },
  function (b, c) {
    var P = b.pose || {}, T = c.T, E = c.E, s = slabSide(b), items = [];
    if (c.rm) {
      var fd = c.fade();
      items.push(it("slab", 0, fd, fadeKf(1, 0), "linear"));
      items.push(it("card", 0, fd, fadeKf(1, 0), "linear"));
      (b.extras || []).forEach(function (x, i) { items.push(it("x" + i, 0, fd, fadeKf(1, 0), "linear")); });
      return ph("leave", items, []);
    }
    items.push(it("slab", 0, c.d(T.fast + 40), [{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: "translate3d(" + (-s * 100) + "%,0,0)", opacity: 0 }], E["in"]));
    items.push(it("card", 0, c.d(T.std), [{ transform: tf(P.glimpse), opacity: 1 }, { transform: tf(P.dest), opacity: 1 }], E.inout));
    (b.extras || []).forEach(function (x, i) { items.push(it("x" + i, 0, c.d(T.std), [{ transform: tf(x.glimpse), opacity: 1 }, { transform: tf(x.to), opacity: 1 }], E.inout)); });
    return ph("leave", items, []);
  }] };

/* §3.4 pitching: lift, fly to the pile (shrinking), clink + pip pop, settle. 500 ms (+40 per extra card). */
KINDS.pitch = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], cues = [], cards = b.cards || [];
  cards.forEach(function (x, i) {
    var role = "p" + i, st = c.d(STAGGER) * i, lf = lifted(x.from), a = c.d(T.press), fl = c.d(T.std - 10), land = st + a + fl;
    items.push(it(role, st, a, [{ transform: tf(x.from) }, { transform: tf(lf) }], E.out));
    items.push(it(role, st + a, fl, [{ transform: tf(lf) }, { transform: tf(x.pile) }], E.out));
    items.push(it(role, land, c.d(T.std), [{ transform: tf(scaled(x.pile, 1.06)) }, { transform: tf(x.pile) }], E.out));
    cues.push(cue(land, "pitch"));
    if (!c.rm) items.push(it(["pip" + i, "pip"], land, c.d(T.std), pulseKf(1.7), E.slam));
  });
  return ph("pitch", items, cues);
}] };

/* §3.8 blockers move up. 510 ms for one (+40 per extra). The sound plays once. */
KINDS.block = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], cues = [], bl = b.blockers || [], first = 0;
  bl.forEach(function (x, i) {
    var role = "b" + i, st = c.d(STAGGER) * i, lf = lifted(x.from), a = c.d(T.press), fl = c.d(T.std), land = st + a + fl;
    if (i === 0) first = land;
    items.push(it(role, st, a, [{ transform: tf(x.from) }, { transform: tf(lf) }], E.out));
    items.push(it(role, st + a, fl, [{ transform: tf(lf) }, { transform: tf(x.to) }], E.out));
    if (!c.rm) items.push(it("n" + i, land, c.d(T.std), pulseKf(1.25), E.out));
  });
  if (bl.length) cues.push(cue(first, "block"));
  if (!c.rm) items.push(it("total", first, c.d(T.std), pulseKf(1.25), E.out));
  return ph("block", items, cues);
}] };

/* §3.9 the hit. 210 ms strike, then contact (t=0): hit-stop, shake, pop, ghost. */
function contactHit(b, c) {
  var T = c.T, E = c.E, dmg = Math.max(1, b.dmg || 1), items = [], cues = [cue(0, hitCue(dmg))];
  if (c.rm) {
    items.push(it("flash", 0, c.fade(), fadeKf(.9, 0), "linear"));
    return ph("contact", items, cues, { hook: "contact" });
  }
  var hs = c.hs(hitstopFor(T, dmg)), sh = shakeSpec(dmg), shd = c.f(sh.dur);
  items.push(it("flash", 0, c.f(140), fadeKf(.9, 0), E.out));
  items.push(it("world", hs, shd, shakeKeyframes(sh), "linear"));
  items.push(it("pop", hs, c.f(720), popKf(Math.min(1.1 + .06 * dmg, 1.7), 34), E.out));
  var P = b.pose || {};
  if (P.hit) items.push(it("attacker", hs, c.d(T.std), [{ transform: tf(P.hit), opacity: 1 }, { transform: tf(P.away || P.hit), opacity: 0 }], E.out));
  if (b.from != null && b.to != null)
    items.push(it("ghost", hs + (c.skipping ? 0 : c.d(T.ghostDelay)), c.d(T.ghostDrain), [{ transform: "scaleX(" + r2(b.from) + ")" }, { transform: "scaleX(" + r2(b.to) + ")" }], E.inout, { keep: true }));
  return ph("contact", items, cues, { hook: "contact" });
}
KINDS.hit = { lane: "q", hooks: ["contact", "commit"], phases: [strikePhase, contactHit],
  merge: function (a, b) {   /* hits in the same moment are one hit: one stop, one shake, one pop (§3.9) */
    if (a.side !== b.side) return false;
    a.dmg = (a.dmg || 0) + (b.dmg || 0);
    if (b.to != null) a.to = b.to;
    if (a.from == null && b.from != null) a.from = b.from;
    return true;
  } };

/* §3.9 life gain: no stop, no shake — the fill tweens 220 ms and a pop reads +N. */
KINDS.lifegain = { lane: "q", hooks: ["contact", "commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], n = Math.max(1, b.n || 1);
  var kf = function () { return [{ transform: "scaleX(" + r2(b.from == null ? 1 : b.from) + ")" }, { transform: "scaleX(" + r2(b.to == null ? 1 : b.to) + ")" }]; };
  items.push(it("fill", 0, c.d(T.std), kf(), E.inout, { keep: true }));
  items.push(it("ghost", 0, c.d(T.std), kf(), E.inout, { keep: true }));
  if (!c.rm) items.push(it("pop", 0, c.f(720), popKf(Math.min(1.05 + .04 * n, 1.4), 28), E.out));
  return ph("gain", items, [], { hook: "contact" });
}] };

/* §3.10 prevention: no stop, no shake, no number — a pale ring and a word. 700 ms. */
KINDS.prevent = { lane: "q", hooks: ["contact", "commit"], phases: [function (b, c) {
  var items = [], E = c.E;
  items.push(it("flash", 0, c.rm ? c.fade() : c.f(c.T.std), fadeKf(.5, 0), E.out));
  items.push(it("word", 0, 700, c.rm ? [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .75 }, { opacity: 0 }] :
    [{ transform: "translate3d(0,10px,0) scale(.7)", opacity: 0 }, { transform: "translate3d(0,0,0) scale(1.05)", opacity: 1, offset: .3 },
     { transform: "translate3d(0,-8px,0) scale(1)", opacity: 1, offset: .75 }, { transform: "translate3d(0,-20px,0) scale(1)", opacity: 0 }], E.out));
  return ph("prevent", items, [cue(0, "block"), cue(120, "prevent")], { hook: "contact" });
}] };

/* §3.7 go again: the attack nudges up, a chip pops, a ring leaves the pip, the pip refills. 600 ms. */
KINDS.goagain = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, P = b.pose || {}, items = [], sd = c.d(T.std);
  if (P.card) items.push(it("card", 0, c.d(T.fast), [{ transform: tf(P.card) }, { transform: tf(moved(P.card, 0, -6)) }], E.out, { keep: true }));
  if (c.rm) items.push(it("chip", 0, c.fade(), fadeKf(0, 1), "linear", { keep: true }));
  else {
    items.push(it("chip", 0, sd, [{ transform: "translate3d(-14px,0,0) scale(.8)", opacity: 0 }, { transform: "translate3d(0,0,0) scale(1.08)", opacity: 1, offset: .5 },
      { transform: "translate3d(0,0,0) scale(1)", opacity: 1 }], E.slam, { keep: true }));
    items.push(it("ring", 0, c.d(T.emph), [{ transform: "scale(1)", opacity: .9 }, { transform: "scale(3.2)", opacity: 0 }], E.out));
    items.push(it("pip", c.d(T.emph), sd, pulseKf(1.8), E.slam));
  }
  return ph("goagain", items, [cue(0, "goagain")]);
}] };

/* §3.13 drawing up: one card at a time, 90 ms apart (130 at the opening), flip only for the owner. */
KINDS.draw = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], cues = [], step = c.d(b.step || 90);
  (b.cards || []).forEach(function (x, i) {
    var role = "c" + i, at = step * i;
    items.push(it(role, at, c.d(T.std), [{ transform: tf(x.from) }, { transform: tf(x.to) }], E.out));
    if (x.flip && !c.rm) items.push(it("f" + i, at + c.d(160), c.d(140), [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], E.out));
    else if (x.flip) items.push(it("f" + i, at, 0, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(0deg)" }], "linear"));
    cues.push(cue(at, "draw", { gain: Math.pow(10, -6 * i / 20) }));   /* -6 dB per card after the first */
  });
  return ph("deal", items, cues);
}] };

/* §3.14 the arsenal: a card flies in face down, slaps, bounces 4 px. 300 ms. */
KINDS.arsenal = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var P = b.pose || {}, T = c.T, fl = c.d(T.std);
  return ph("set", [
    it("card", 0, fl, [{ transform: tf(P.from) }, { transform: tf(P.to) }], c.E.out),
    it("card", fl, c.d(80), [{ transform: tf(P.to) }, { transform: tf(moved(P.to, 0, 4)), offset: .5 }, { transform: tf(P.to) }], c.E.out)],
    [cue(fl, "slap")]);
}] };

/* §3.12 the chain resolving and closing. */
KINDS.chainResolve = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], cues = [], links = b.links || [], t0 = c.d(T.fast), last = t0;
  if (!c.rm) items.push(it("overlay", 0, c.d(T.fast), [{ opacity: 0 }, { opacity: .5, offset: .5 }, { opacity: 0 }], "linear"));
  links.forEach(function (x, i) {
    var at = t0 + c.d(STAGGER) * i, sd = c.d(T.std);
    items.push(it("l" + i, at, sd, [{ transform: tf(x.from) }, { transform: tf(x.to) }], E.inout));
    if (!c.rm) items.push(it("gy", at + sd, c.d(T.fast), [{ transform: "scale(1.06)" }, { transform: "scale(1)" }], E.out));
    last = Math.max(last, at + sd);
  });
  (b.slides || []).forEach(function (s) { items.push(it(s.role, last, c.d(T.std), [{ transform: tf(s.from) }, { transform: tf(s.to) }], E.inout)); });
  if (!c.rm) items.push(it("dim", last, c.d(T.fast), [{ opacity: 1 }, { opacity: .6, offset: .5 }, { opacity: 1 }], "linear"));
  return ph("resolve", items, cues);
}] };

/* §3.15 gear destroyed: a white flash, a soft burst, a copy to the graveyard. Tokens fade without flash or sound. */
KINDS.gearBreak = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, P = b.pose || {}, items = [], cues = [], sd = c.d(T.std), tok = !!b.token;
  var burst = [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.08)", opacity: 0 }];
  if (c.rm) items.push(it("gear", 0, 0, fadeKf(1, 0), "linear", { keep: true }));
  else {
    if (!tok) items.push(it("flash", 0, c.f(100), fadeKf(.7, 0), "linear"));
    items.push(it("gear", tok ? 0 : c.d(100), sd, burst, E.out, { keep: true }));
    if (P.from && P.to) items.push(it("copy", c.d(120), sd, [{ transform: tf(P.from) }, { transform: tf(P.to) }], E.inout));
  }
  if (!tok) cues.push(cue(0, "block", { pitch: .7 }));
  return ph("break", items, cues);
}] };

/* §3.16 the turn passing: the medallion tosses and flips, a banner sweeps, the new side lights. 900 ms. */
KINDS.turn = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  var T = c.T, E = c.E, items = [], a = (b.flip || [0, 180]), mid = (a[0] + a[1]) / 2, hump = b.hump == null ? 1.9 : b.hump;
  items.push(it("medal", 0, c.d(T.emph + 120), c.rm ? [{ transform: "rotateY(" + a[1] + "deg) scale(1)" }, { transform: "rotateY(" + a[1] + "deg) scale(1)" }] :
    [{ transform: "rotateY(" + a[0] + "deg) scale(1)" }, { transform: "rotateY(" + mid + "deg) scale(" + hump + ")", offset: .5 }, { transform: "rotateY(" + a[1] + "deg) scale(1)" }], E.inout, { keep: true }));
  var s = slabSide(b);
  items.push(it("banner", 0, 900, c.rm ? [{ opacity: 0 }, { opacity: 1, offset: .38 }, { opacity: 1, offset: .7 }, { opacity: 0 }] :
    [{ transform: "translate3d(" + (100 * s) + "%,0,0)", opacity: 1, offset: 0 }, { transform: "translate3d(0,0,0)", opacity: 1, offset: .38 },
     { transform: "translate3d(0,0,0)", opacity: 1, offset: .7 }, { transform: "translate3d(" + (-100 * s) + "%,0,0)", opacity: 0, offset: 1 }], E.inout));
  items.push(it("glow", c.d(700), c.d(T.fast), fadeKf(0, .6), "linear", { keep: true }));
  return ph("turn", items, [cue(0, "turn")]);
}] };

/* §3.17 game start: mat, heroes sit down, the coin, the winner's name. 2300 ms (the deal is its own `draw`). */
KINDS.start = { lane: "q", hooks: ["commit"], skipCap: 300, phases: [
  function (b, c) {
    var T = c.T, E = c.E, P = b.pose || {}, items = [], cues = [], rm = c.rm;
    items.push(it("mat", 0, c.d(T.std), fadeKf(0, 1), E.out, { keep: true }));
    [["heroA", "barA", 120], ["heroB", "barB", 200]].forEach(function (h) {
      var x = P[h[0]] || {};
      items.push(it(h[0], c.d(h[2]), c.d(T.emph), [{ transform: tf(x.from) }, { transform: tf(x.to) }], E.out, { keep: true }));
      items.push(it(h[1], c.d(h[2] + 40), c.d(T.std), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], E.out, { keep: true }));
      cues.push(cue(c.d(h[2]), "slap"));
    });
    var cp = P.coin || { x: 0, y: 0, s: 1 }, up = moved(cp, 0, -120), t0 = c.d(800), spin = c.d(600);
    items.push(it("coin", t0, spin, [
      { transform: tf(cp) + " rotateX(0deg)", opacity: 0, easing: E.out },
      { transform: tf(moved(cp, 0, -60)) + " rotateX(270deg)", opacity: 1, offset: .01, easing: E.out },
      { transform: tf(up) + " rotateX(540deg)", opacity: 1, offset: .5, easing: E["in"] },
      { transform: tf(cp) + " rotateX(1080deg)", opacity: 1 }], "linear", { keep: true }));
    items.push(it("coin", t0 + spin, c.d(100), [{ transform: tf(scaled(cp, 1.15)) + " rotateX(1080deg)" }, { transform: tf(cp) + " rotateX(1080deg)" }], E.out, { keep: true }));
    cues.push(cue(t0 + spin, "coin"), cue(t0 + spin, "slap"));
    var w0 = c.d(1500);
    items.push(it("win", w0, rm ? c.fade() : c.d(T.slam), rm ? fadeKf(0, 1) : [
      { transform: "translate3d(-100%,0,0)", opacity: 1 }, { transform: "translate3d(10px,0,0)", opacity: 1, offset: .7 }, { transform: "translate3d(0,0,0)", opacity: 1 }], E.out));
    if (P.medal) items.push(it("medal", w0, c.d(T.emph), [{ transform: "rotateY(" + P.medal[0] + "deg) scale(1)" }, { transform: "rotateY(" + P.medal[1] + "deg) scale(1.14)", offset: .5 },
      { transform: "rotateY(" + P.medal[1] + "deg) scale(1)" }], E.inout, { keep: true }));
    /* the medallion's settle runs on into the hold; the phase ends when the winner's slab has landed */
    return ph("open", items, cues, { len: rnd(w0 + (rm ? c.fade() : c.d(T.slam))) });
  },
  function (b, c) { return holdPhase("hold", c.holdMs(380)); },
  function (b, c) {
    return ph("leave", [it("win", 0, c.rm ? c.fade() : c.d(c.T.fast + 40), c.rm ? fadeKf(1, 0) : [{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: "translate3d(100%,0,0)", opacity: 0 }], c.E["in"])], []);
  }] };

/* §3.18 the KO: lethal hit-stop (total stillness), then dawn. 1020 ms after contact + the result hold. */
KINDS.ko = { lane: "q", hooks: ["contact", "commit"], phases: [strikePhase,
  function (b, c) {
    var T = c.T, E = c.E, P = b.pose || {}, items = [], cues = [cue(0, "hit7", { gain: 1 })];
    if (c.rm) {
      items.push(it("flash", 0, c.fade(), fadeKf(.9, 0), "linear"));
      items.push(it("dim", 0, 0, fadeKf(0, .72), "linear", { keep: true }));
      items.push(it("result", 0, 0, fadeKf(0, 1), "linear", { keep: true }));
      if (P.loser) items.push(it("loser", 0, 0, [{ transform: tf(moved(P.loser, 0, 90)), opacity: 0 }, { transform: tf(moved(P.loser, 0, 90)), opacity: 0 }], "linear", { keep: true }));
      cues.push(cue(120, "ko"));
      return ph("contact", items, cues, { hook: "contact" });
    }
    var hs = c.hs(T.hitstopKo);
    items.push(it("flash", 0, c.f(140), fadeKf(.9, 0), E.out));
    items.push(it("world", hs, c.f(KO_SHAKE.dur), shakeKeyframes(KO_SHAKE), "linear"));
    if (b.from != null && b.to != null)
      items.push(it("ghost", hs, c.d(T.ghostDrain), [{ transform: "scaleX(" + r2(b.from) + ")" }, { transform: "scaleX(" + r2(b.to) + ")" }], E.inout, { keep: true }));
    if (P.loser) items.push(it("loser", hs, c.d(520), [{ transform: tf(P.loser), opacity: 1 }, { transform: tf({ x: P.loser.x, y: P.loser.y + 90, s: P.loser.s, r: 6 }), opacity: 0 }], E["in"], { keep: true }));
    items.push(it("dim", hs, c.d(T.emph + 120), fadeKf(0, .72), E.out, { keep: true }));
    cues.push(cue(hs, "ko"));
    items.push(it("sweep", hs + c.d(220), c.d(520), [{ transform: "scaleX(0)", opacity: 1 }, { transform: "scaleX(1)", opacity: 1, offset: .6 }, { transform: "scaleX(1)", opacity: 0 }], E.out));
    items.push(it("result", hs + c.d(440), c.d(T.slam + 60), [{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(.96)", opacity: 1, offset: .6 }, { transform: "scale(1)", opacity: 1 }], E.slam, { keep: true }));
    return ph("contact", items, cues, { hook: "contact" });
  },
  function (b, c) { return holdPhase("result", c.hold("result"), RESULT_LOCK); }] };

/* the result sheet rises from the bottom after the KO (§3.18) */
KINDS.sheet = { lane: "q", hooks: ["commit"], phases: [function (b, c) {
  return ph("rise", [it("sheet", 0, c.d(c.T.emph), [{ transform: "translate3d(0,100%,0)" }, { transform: "translate3d(0,0,0)" }], c.E.out, { keep: true })], []);
}] };

/* FLIP: cards that moved because the DOM changed. `uids` -> `data-uid`; `mutate` makes the DOM change.
   Measures first and last ONCE here, outside any flight of this beat. */
KINDS.move = { lane: "q", hooks: ["mutate", "commit"], phases: [function (b, c) {
  var uids = b.uids || [], first = uids.map(function (u) { return c.measure(c.el("uid:" + u)); }), items = [];
  if (b.mutate) b.mutate(b);
  uids.forEach(function (u, i) {
    var dl = flipDelta(first[i], c.measure(c.el("uid:" + u)));
    if (!dl) return;
    items.push(it("uid:" + u, c.d(STAGGER) * i, c.d(b.dur || c.T.std), [
      { transform: "translate3d(" + r2(dl.dx) + "px," + r2(dl.dy) + "px,0) scale(" + r2(dl.sx) + "," + r2(dl.sy) + ")" },
      { transform: "translate3d(0,0,0) scale(1,1)" }], c.E.inout));
  });
  return ph("flip", items, []);
}] };

var KIND_NAMES = Object.keys(KINDS);

/* THE PURE PLANNER: beat -> phases, no DOM and no clock. Drills call this. */
function plan(beat, o) {
  o = o || {};
  var def = KINDS[beat.kind];
  if (!def) throw new Error("unknown beat kind: " + beat.kind);
  var tk = o.tokens || { T: FALLBACK, E: FALLBACK_EASE };
  var c = makeCtx({ T: tk.T, E: tk.E, rm: o.rm, sp: speedOf(o.speed), accel: o.accel, skipping: o.skipping, cap: o.cap, el: o.el, measure: o.measure });
  return def.phases.map(function (f) { return f(beat, c); });
}
function total(phases) { return rnd(phases.reduce(function (n, p) { return n + p.len; }, 0)); }

/* ============================================================
   THE SCHEDULER
   ============================================================ */
function domAnimate(el, kf, o) {
  try {
    return el.animate(kf, { duration: Math.max(o.duration, .01), delay: o.delay || 0, easing: o.easing || "linear", fill: "both" });
  } catch (e) { return null; }
}
function defaultWill(el, on) { try { el.style.willChange = on ? "transform, opacity" : ""; } catch (e) { /* element gone */ } }
function defaultMeasure(el) {
  if (!el || !el.getBoundingClientRect) return null;
  var r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function makeResolver(rootEl) {
  function one(role, beat) {
    var e = beat.els && beat.els[role];
    if (e && typeof e === "object") return e;
    var sel = typeof e === "string" ? e : role;
    if (!rootEl || typeof sel !== "string") return null;
    try {
      if (sel.indexOf("uid:") === 0) return rootEl.querySelector('[data-uid="' + sel.slice(4).replace(/"/g, '\\"') + '"]');
      if (typeof e === "string") return rootEl.querySelector(e);
    } catch (err) { /* a bad selector is a missing role */ }
    return null;
  }
  return function (role, beat) {
    if (Array.isArray(role)) { for (var i = 0; i < role.length; i++) { var f = one(role[i], beat); if (f) return f; } return null; }
    return one(role, beat);
  };
}

function create(opts) {
  opts = opts || {};
  var G = typeof globalThis !== "undefined" ? globalThis : {};
  var tk = opts.tokens || readTokens(opts.root), T = tk.T, E = tk.E;
  var now = opts.now || function () { return (G.performance && G.performance.now) ? G.performance.now() : Date.now(); };
  var setT = opts.setTimer || function (f, ms) { return setTimeout(f, ms); };
  var clrT = opts.clearTimer || function (h) { clearTimeout(h); };
  var animate = opts.animate || domAnimate;
  var resolveRole = opts.resolve || makeResolver(opts.root);
  var measure = opts.measure || defaultMeasure;
  var will = opts.will || defaultWill;
  var vibrate = opts.vibrate === undefined ? (G.navigator && G.navigator.vibrate ? function (p) { try { G.navigator.vibrate(p); } catch (e) { /* unsupported */ } } : null) : opts.vibrate;
  var rmOpt = opts.reduceMotion, rmSet = null;
  if (rmOpt === undefined) { try { rmOpt = G.matchMedia ? function () { return G.matchMedia("(prefers-reduced-motion: reduce)").matches; } : false; } catch (e) { rmOpt = false; } }
  var sp = speedOf(opts.speed), spArg = opts.speed;

  var queue = [], cur = null, runs = [], kickTimer = null, accel = false, flushing = false, disposed = false, idleWaiters = [], seq = 0, willLive = 0;

  function rm() { return rmSet != null ? rmSet : !!(typeof rmOpt === "function" ? rmOpt() : rmOpt); }
  function audio() { return opts.audio || G.DawnUIAudio || null; }
  function safe(fn, self, arg) { if (typeof fn === "function") { try { return fn.call(self, arg); } catch (e) { if (opts.onError) { try { opts.onError(e); } catch (e2) { /* ignore */ } } } } }
  function emit(type, beat) { safe(opts.onEvent, null, { type: type, beat: beat }); }

  /* will-change: only while a beat runs, never on more than WILL_CAP elements */
  function warm(beat) {
    if (beat._warm || !beat.els) return;
    beat._warm = [];
    for (var k in beat.els) {
      var e = beat.els[k];
      if (e && typeof e === "object" && willLive < WILL_CAP && beat._warm.indexOf(e) < 0) { will(e, true); beat._warm.push(e); willLive++; }
    }
  }
  function cool(beat) {
    if (!beat._warm) return;
    beat._warm.forEach(function (e) { will(e, false); willLive--; });
    beat._warm = null;
  }

  function checkIdle() {
    if (cur || queue.length || kickTimer != null || runs.length) return;
    var w = idleWaiters; idleWaiters = [];
    w.forEach(function (f) { f(); });
    emit("idle", null);
  }
  function kick(ms) {
    if (disposed || cur || kickTimer != null) return;
    if (!queue.length && !flushing) { checkIdle(); return; }
    kickTimer = setT(function () { kickTimer = null; startNext(); }, ms || 0);
  }

  function instant(beat) {   /* a beat that never gets to play: its state still lands, in order */
    var def = KINDS[beat.kind];
    emit("beatstart", beat);
    safe(beat.begin, beat, beat);
    (def.hooks || []).forEach(function (h) { safe(beat[h], beat, beat); });
    emit("beatend", beat);
  }

  function startNext() {
    if (cur || disposed) return;
    if (flushing) {
      while (queue.length) instant(queue.shift());
      flushing = false; accel = false;
      checkIdle(); return;
    }
    var b = queue.shift();
    if (!b) { checkIdle(); return; }
    var depth = queue.length + 1;
    if (depth > ACCEL_AT) accel = true; else if (depth <= 1) accel = false;
    startRun(b, "q", accel);
    if (queue[0]) warm(queue[0]);
  }

  function startRun(beat, lane, acc) {
    var run = { beat: beat, def: KINDS[beat.kind], lane: lane, idx: 0, anims: [], cueTimers: [], skipping: false, held: false, waitRelease: false, ended: false,
      phase: null, phaseStart: 0, phaseEnd: 0, phaseTimer: null, accel: !!acc, wasSkipped: false, readyTimer: null };
    runs.push(run);
    if (lane === "q") cur = run;   /* before anything can finish synchronously (a beat that is all cuts) */
    emit("beatstart", beat);
    warm(beat);
    safe(beat.begin, beat, beat);
    var go = function () { if (run.go) { run.go = null; clrT(run.readyTimer); next(run); } };
    if (beat.ready && typeof beat.ready.then === "function") {   /* art decode: a flight never starts on an undecoded image */
      run.go = go;
      run.readyTimer = setT(go, 250);
      beat.ready.then(go, go);
    } else next(run);
    return run;
  }

  function ctxFor(run) {
    return makeCtx({ T: T, E: E, rm: rm(), sp: sp, accel: run.accel, skipping: run.skipping, cap: run.def.skipCap || T.fast,
      el: function (role) { return resolveRole(role, run.beat); }, measure: measure });
  }

  function next(run) {
    if (run.ended || disposed) return;
    if (run.idx >= run.def.phases.length) { finish(run); return; }
    var c = ctxFor(run), ph_ = run.def.phases[run.idx++](run.beat, c);
    run.phase = ph_; run.phaseStart = now(); run.cueTimers = [];
    if (ph_.hook) {
      safe(run.beat[ph_.hook], run.beat, run.beat);
      if (ph_.hook === "contact" && vibrate && !c.rm) {
        var dmg = run.beat.dmg || (run.beat.kind === "ko" ? 7 : 1);
        if (run.beat.kind !== "prevent" && run.beat.kind !== "lifegain") vibrate(dmg >= 7 ? [40] : dmg >= 3 ? [20] : [10]);
      }
    }
    ph_.items.forEach(function (item) {
      var el = resolveRole(item.role, run.beat);
      if (!el) return;
      var a = animate(el, item.kf, { duration: item.dur, delay: item.at, easing: item.ease, fill: "both" });
      if (a) run.anims.push({ a: a, el: el, keep: !!item.keep });
    });
    ph_.cues.forEach(function (q) {
      if (q.at <= 0) playCue(q);
      else run.cueTimers.push(setT(function () { playCue(q); }, q.at));
    });
    if (ph_.len <= 0) { next(run); return; }
    run.phaseEnd = run.phaseStart + ph_.len;
    run.phaseTimer = setT(function () { phaseDone(run); }, ph_.len);
  }
  function phaseDone(run) {
    if (run.ended) return;
    run.phaseTimer = null;
    if (run.phase.hold && run.held) { run.waitRelease = true; return; }
    next(run);
  }
  function playCue(q) {
    var a = audio();
    if (!a || !a.cue) return;
    try { a.cue(q.name, { gain: q.gain, pitch: q.pitch }); } catch (e) { /* sound is best-effort, never blocks a beat */ }
  }

  function dropAnims(run) {
    run.anims.forEach(function (x) {
      try { if (x.keep && x.a.commitStyles) x.a.commitStyles(); } catch (e) { /* element removed */ }
      try { x.a.cancel(); } catch (e) { /* already gone */ }
    });
    run.anims = [];
  }
  function finish(run) {
    if (run.ended) return;
    run.ended = true;
    clrT(run.phaseTimer); clrT(run.readyTimer);
    run.cueTimers.forEach(clrT);
    dropAnims(run);   /* the animations end first: the shell's commit then writes the final DOM in the same task */
    cool(run.beat);
    safe(run.beat.commit, run.beat, run.beat);
    var i = runs.indexOf(run); if (i >= 0) runs.splice(i, 1);
    emit("beatend", run.beat);
    if (run.lane === "q") { cur = null; kick(run.wasSkipped ? GAP_AFTER_SKIP : 0); }
    else checkIdle();
  }

  function skipRun(run) {
    if (!run || run.ended) return false;
    var ph_ = run.phase;
    if (run.go) { run.go(); }
    if (ph_ && ph_.hold) {
      if (ph_.lock && now() - run.phaseStart < ph_.lock) return false;   /* the KO's first 600 ms */
      run.skipping = run.wasSkipped = true; run.held = false; run.waitRelease = false;
      clrT(run.phaseTimer); run.phaseTimer = null;
      next(run);
      return true;
    }
    run.skipping = run.wasSkipped = true; run.held = false;
    run.cueTimers.forEach(clrT); run.cueTimers = [];
    var cap = run.def.skipCap || T.fast, rem = run.phaseEnd - now();
    if (rem > cap) {   /* never a hard cut: what is left plays out in --m-fast */
      clrT(run.phaseTimer);
      run.phaseEnd = now() + cap;
      run.phaseTimer = setT(function () { phaseDone(run); }, cap);
      var rate = rem / cap;
      run.anims.forEach(function (x) { try { x.a.updatePlaybackRate(rate); } catch (e) { /* unsupported: the timer still ends the beat */ } });
    }
    return true;
  }

  var api = {
    /* enqueue: returns the normalised beat (with .id), or null when the kind is unknown */
    enqueue: function (beat) {
      if (disposed || !beat || !KINDS[beat.kind]) { if (opts.onError) safe(opts.onError, null, new Error("unknown beat kind: " + (beat && beat.kind))); return null; }
      var def = KINDS[beat.kind];
      beat.id = beat.id || ++seq;
      if (def.lane === "now") { startRun(beat, "now", false); return beat; }
      if (def.merge) {
        var tail = queue[queue.length - 1];
        if (tail && tail.kind === beat.kind && def.merge(tail, beat)) return tail;
        if (cur && cur.beat.kind === beat.kind && cur.idx <= 1 && def.merge(cur.beat, beat)) return cur.beat;   /* still in the strike: the contact has not happened */
      }
      queue.push(beat);
      if (queue.length === 1 && cur) warm(beat);
      kick(0);
      return beat;
    },
    /* skip: what is left of the current beat plays out in --m-fast and the queue advances 40 ms later */
    skip: function () { return skipRun(cur); },
    /* tapThrough: the current beat is skipped; everything queued lands its state (begin/contact/commit) in order with no motion */
    tapThrough: function () {
      var did = false;
      runs.slice().forEach(function (r) { if (r.lane === "now") { dropAnims(r); finish(r); did = true; } });
      if (cur) { skipRun(cur); did = true; }
      if (queue.length) { flushing = true; did = true; if (!cur) { if (kickTimer != null) { clrT(kickTimer); kickTimer = null; } startNext(); } }
      return did;
    },
    /* hold(true): keep the glimpse/slab up until hold(false) (press-and-hold, §4.3) */
    hold: function (on) {
      if (!cur) return false;
      cur.held = !!on;
      emit("hold", cur.beat);
      if (!on && cur.waitRelease) { cur.waitRelease = false; next(cur); }
      return true;
    },
    idle: function () {
      if (!cur && !queue.length && kickTimer == null && !runs.length) return Promise.resolve();
      return new Promise(function (res) { idleWaiters.push(res); });
    },
    speed: function (x) { if (x !== undefined) { sp = speedOf(x); spArg = x; } return spArg === undefined ? "standard" : spArg; },
    reduce: function (v) { rmSet = v == null ? null : !!v; return rm(); },
    /* warm: set will-change ahead of a beat (cap 12 elements) */
    warm: function (beat) { warm(beat); },
    depth: function () { return queue.length + (cur ? 1 : 0); },
    running: function () { return cur ? cur.beat.kind : null; },
    tokens: function () { return { T: T, E: E }; },
    dispose: function () {
      disposed = true;
      runs.slice().forEach(function (r) { r.ended = true; clrT(r.phaseTimer); clrT(r.readyTimer); r.cueTimers.forEach(clrT); dropAnims(r); cool(r.beat); });
      runs = []; queue = []; cur = null;
      if (kickTimer != null) { clrT(kickTimer); kickTimer = null; }
      var w = idleWaiters; idleWaiters = []; w.forEach(function (f) { f(); });
    }
  };
  return api;
}

return {
  create: create, plan: plan, total: total, makeCtx: makeCtx, readTokens: readTokens, flipDelta: flipDelta,
  shakeSpec: shakeSpec, shakeKeyframes: shakeKeyframes, hitstopFor: hitstopFor, hitCue: hitCue,
  kinds: KIND_NAMES, lanes: function (k) { return KINDS[k] && KINDS[k].lane; },
  FALLBACK: FALLBACK, FALLBACK_EASE: FALLBACK_EASE, TOKEN_CSS: TOKEN_CSS, EASE_CSS: EASE_CSS, SPEEDS: SPEEDS,
  RESULT_HOLD: RESULT_HOLD, RESULT_LOCK: RESULT_LOCK, STAGGER: STAGGER
};
});
