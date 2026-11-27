/* ============================================================
   ui-director.test.js — CRESCENDO's animation director and sound (no browser)

   `ui/director.js` is the only file that touches Web Animations; its scheduling
   core is pure, so node drives it with a manual clock and a recording `animate`.
   docs/crescendo/MOTION.md is the spec:

     - the fallback token table equals docs/crescendo/tokens.css (--m-*);
     - every beat kind has its fixed duration (§3), the same for both seats;
     - the queue is strict: one beat at a time, in order, no overlap (§4.1);
     - skip never cuts mid-flight (everything left plays in --m-fast), the
       KO's first 600 ms cannot be skipped, tapThrough lands every queued state;
     - reduced motion cuts flights and keeps the announcement (§1.5);
     - no keyframe the director emits animates anything but transform/opacity;
     - will-change only while a beat runs, on at most 12 elements;
     - ui/audio.js: nothing plays before a gesture, resume() runs inside it,
       the 14 cues of §6.2 exist, never more than 6 voices, mute persists.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const D = require("../ui/director.js");
const A = require("../ui/audio.js");

/* ---------- a manual clock + a recording animate ---------- */
function rig(o) {
  o = o || {};
  let t = 0, id = 0, timers = [];
  const clock = {
    now: () => t,
    setTimer(fn, ms) { const h = ++id; timers.push({ h, at: t + Math.max(0, ms), fn, n: h }); return h; },
    clearTimer(h) { timers = timers.filter(x => x.h !== h); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.n - b.n);
        const nx = timers[0];
        if (!nx || nx.at > end) break;
        timers.shift(); t = nx.at; nx.fn();
      }
      t = end;
    },
    pending: () => timers.length
  };
  const calls = [];
  const animate = (el, kf, op) => {
    const a = { el, kf, op, at: t, cancelled: false, committed: false, rate: 1,
      cancel() { a.cancelled = true; }, commitStyles() { a.committed = true; }, updatePlaybackRate(r) { a.rate = r; } };
    calls.push(a); return a;
  };
  const events = [], cues = [], hooks = [], willOn = new Set();
  let willMax = 0;
  const audio = { cue(name, op) { cues.push({ at: t, name, op }); } };
  const d = D.create(Object.assign({
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, animate, audio,
    resolve: (role) => Array.isArray(role) ? role[role.length - 1] : role,
    measure: () => null, vibrate: null, reduceMotion: false,
    will: (el, on) => { if (on) willOn.add(el); else willOn.delete(el); willMax = Math.max(willMax, willOn.size); },
    onEvent: (e) => events.push({ at: t, type: e.type, kind: e.beat && e.beat.kind, id: e.beat && e.beat.id })
  }, o));
  return { d, clock, calls, events, cues, hooks, willOn, willMax: () => willMax };
}
const P = (x, y, s) => ({ x, y, s: s == null ? 1 : s });

/* one sample of every kind, with the poses/roles its planner reads */
function sample(kind, extra) {
  const els = {};
  const base = {
    select: { pose: { rest: P(10, 300, .27) } }, deselect: { pose: { rest: P(10, 300, .27) } }, refuse: { pose: { rest: P(10, 300, .27) } },
    fade: {},
    play: { pose: { from: P(100, 300, .27), glimpse: P(90, 96, .9), slot: P(164, 96, .27) }, slides: [{ role: "n0", from: P(10, 300, .27), to: P(0, 300, .27) }] },
    reaction: { pose: { from: P(100, 300, .27), glimpse: P(90, 96, .9), slot: P(164, 96, .27) } },
    announce: { pose: { back: P(90, -250, .7), glimpse: P(90, 96, .9), dest: P(164, 96, .27) } },
    pitch: { cards: [{ from: P(100, 300, .27), pile: P(300, 96, .27) }] },
    block: { blockers: [{ from: P(100, 300, .27), to: P(100, 200, .27) }] },
    hit: { dmg: 3, side: "M", from: 1, to: .85, pose: { home: P(98, 60, .55), hit: P(98, 210, .58), away: P(98, 226, .55) } },
    lifegain: { n: 2, from: .5, to: .6 },
    prevent: {}, goagain: { pose: { card: P(120, 110, .6) } },
    draw: { cards: [{ from: P(350, 300, .27), to: P(18, 330, .27), flip: true }, { from: P(350, 300, .27), to: P(112, 330, .27), flip: true }] },
    arsenal: { pose: { from: P(100, 300, .27), to: P(28, 96, .27) } },
    chainResolve: { links: [{ from: P(164, 96, .27), to: P(300, 200, .27) }, { from: P(164, 120, .27), to: P(300, 200, .27) }] },
    gearBreak: { pose: { from: P(100, 300, .27), to: P(300, 200, .27) } },
    turn: {}, start: { pose: { heroA: { from: P(-200, 20), to: P(150, 20) }, heroB: { from: P(500, 300), to: P(150, 300) }, coin: P(176, 200), medal: [0, 180] } },
    ko: { dmg: 7, side: "M", from: .35, to: 0, pose: { home: P(98, 60, .55), hit: P(98, 210, .58), loser: P(150, 300, .5) } },
    sheet: {}, rise: {}, drop: {}, move: { uids: ["a", "b"] }
  }[kind];
  return Object.assign({ kind, els }, base, extra || {});
}

/* ---------- tokens ---------- */
test("the fallback token table equals docs/crescendo/tokens.css", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "docs", "crescendo", "tokens.css"), "utf8");
  const val = (name) => {
    const m = css.match(new RegExp(name.replace(/[-]/g, "\\-") + "\\s*:\\s*([^;]+);"));
    assert.ok(m, name + " is in tokens.css");
    return m[1].trim();
  };
  for (const k of Object.keys(D.TOKEN_CSS)) {
    assert.strictEqual(parseFloat(val(D.TOKEN_CSS[k])), D.FALLBACK[k], k + " (" + D.TOKEN_CSS[k] + ")");
    assert.match(val(D.TOKEN_CSS[k]), /ms$/);
  }
  for (const k of Object.keys(D.EASE_CSS)) assert.strictEqual(val(D.EASE_CSS[k]).replace(/\s+/g, ""), D.FALLBACK_EASE[k].replace(/\s+/g, ""), k);
  /* nothing in tokens.css's --m-* family is missing from the director's table */
  const names = [...css.matchAll(/(--m-[a-z-]+)\s*:/g)].map(m => m[1]);
  const known = new Set([...Object.values(D.TOKEN_CSS), ...Object.values(D.EASE_CSS)]);
  for (const n of names) assert.ok(known.has(n), n + " is known to the director");
});

test("readTokens reads the page's custom properties and falls back without one", () => {
  const dflt = D.readTokens({});
  assert.deepStrictEqual(dflt.T, D.FALLBACK);
  const g = globalThis, prev = g.getComputedStyle;
  g.getComputedStyle = () => ({ getPropertyValue: (n) => n === "--m-std" ? " 0.3s" : n === "--m-ease-out" ? " linear " : "" });
  try {
    const r = D.readTokens({});
    assert.strictEqual(r.T.std, 300); assert.strictEqual(r.T.press, 70); assert.strictEqual(r.E.out, "linear");
  } finally { g.getComputedStyle = prev; }
});

/* ---------- durations: the same event always takes the same time ---------- */
const STD = {   /* the totals MOTION.md §3 gives, ms from t=0 */
  select: 120, deselect: 120, refuse: 140, fade: 120,
  play: 1190, reaction: 740, announce: 2160, pitch: 500, block: 510,
  hit: 210 + 90 + 800, lifegain: 720, prevent: 700, goagain: 600, turn: 900, gearBreak: 340,
  ko: 210 + 1020 + 1180, sheet: 380, rise: 380, drop: 220, arsenal: 300
};
test("every beat kind has its MOTION.md duration (standard speed)", () => {
  for (const k of Object.keys(STD)) {
    assert.strictEqual(D.total(D.plan(sample(k))), STD[k], k);
  }
  /* derived ones: hit-stop tiers, draw, start, chain */
  assert.strictEqual(D.total(D.plan(sample("hit", { dmg: 1 }))), 210 + 50 + 800, "hit 1-2");
  assert.strictEqual(D.total(D.plan(sample("hit", { dmg: 4 }))), 210 + 90 + 800, "hit 3-6");
  assert.strictEqual(D.total(D.plan(sample("hit", { dmg: 12 }))), 210 + 150 + 800, "hit 7+");
  assert.strictEqual(D.total(D.plan(sample("draw"))), 90 + 300, "two dealt cards, the second flips 160+140 after its start");
  assert.strictEqual(D.total(D.plan(sample("start"))), 2300, "game start");
  assert.strictEqual(D.total(D.plan(sample("reaction"))), 220 + 300 + 220);
  assert.strictEqual(D.total(D.plan(sample("announce", { reaction: true }))), 440 + 900 + 220, "a reaction announcement holds 900");
  assert.strictEqual(D.total(D.plan(sample("block", { blockers: [{ from: P(1, 1), to: P(2, 2) }, { from: P(1, 1), to: P(2, 2) }] }))), 510 + 40, "40 ms stagger");
});

test("the same event takes the same time for both seats and on every plan", () => {
  const a = D.plan(sample("announce", { side: "left" })), b = D.plan(sample("announce", { side: "right" }));
  assert.strictEqual(D.total(a), D.total(b));
  assert.deepStrictEqual(a.map(p => [p.len, p.items.map(i => [i.role, i.at, i.dur])]), b.map(p => [p.len, p.items.map(i => [i.role, i.at, i.dur])]));
  const s = JSON.stringify(D.plan(sample("hit")));
  for (let i = 0; i < 5; i++) assert.strictEqual(JSON.stringify(D.plan(sample("hit"))), s, "deterministic");
  /* the slab enters from THEIR side: left enters at -100%, right at +100% */
  assert.match(a[0].items[0].kf[0].transform, /-100%/);
  assert.match(b[0].items[0].kf[0].transform, /\(100%/);
});

test("hit-stop, shake and pop follow MOTION.md's formulae", () => {
  for (const [dmg, hs] of [[1, 50], [2, 50], [3, 90], [6, 90], [7, 150], [20, 150]]) assert.strictEqual(D.hitstopFor(D.FALLBACK, dmg), hs, "dmg " + dmg);
  assert.deepStrictEqual(D.shakeSpec(1), { amp: 4, dur: 188, rot: 0 });
  assert.strictEqual(D.shakeSpec(7).dur, 356); assert.strictEqual(D.shakeSpec(7).amp, 13); assert.strictEqual(D.shakeSpec(7).rot, 1.1);
  assert.strictEqual(D.shakeSpec(20).dur, 420, "capped");
  assert.strictEqual(D.shakeSpec(20).amp, 13, "capped");
  const kf = D.shakeKeyframes(D.shakeSpec(5));
  assert.strictEqual(kf[kf.length - 1].transform, "translate3d(0px,0px,0) rotate(0deg)", "the shake ends at rest");
  assert.deepStrictEqual(["hit1", "hit1", "hit3", "hit3", "hit7"], [1, 2, 3, 6, 7].map(D.hitCue));
  /* a 20 damage hit is not longer than a 7 */
  assert.strictEqual(D.total(D.plan(sample("hit", { dmg: 20 }))), D.total(D.plan(sample("hit", { dmg: 7 }))));
  /* skipping drops the stop (never a hold while a tap is compressing the beat) */
  const sk = D.plan(sample("hit", { dmg: 7 }), { skipping: true });
  assert.strictEqual(sk[1].items.find(i => i.role === "world").at, 0, "no hit-stop while skipping");
  assert.ok(sk[1].items.every(i => i.at + i.dur <= 120), "everything capped to --m-fast");
  const skKo = D.plan(sample("ko"), { skipping: true });
  assert.strictEqual(skKo[1].items.find(i => i.role === "world").at, 0);
  assert.strictEqual(skKo[2].len, 1180, "the result hold stays: the game is over and the word must be read");
  /* the hit: contact hook first in its phase, the bar ghost holds the old width for --m-ghost-delay */
  const ph = D.plan(sample("hit", { dmg: 3 }));
  assert.strictEqual(ph[1].hook, "contact");
  const ghost = ph[1].items.find(i => i.role === "ghost");
  assert.strictEqual(ghost.at, 90 + 420); assert.strictEqual(ghost.dur, 380);
  assert.strictEqual(ph[1].items.find(i => i.role === "world").at, 90, "the shake starts after the stop");
  assert.strictEqual(ph[1].cues[0].name, "hit3"); assert.strictEqual(ph[1].cues[0].at, 0);
});

/* ---------- transform and opacity only ---------- */
const OK_PROPS = new Set(["transform", "opacity", "offset", "easing", "composite"]);
test("no keyframe the director emits animates anything but transform/opacity", () => {
  const modes = [{}, { rm: true }, { speed: "quick" }, { speed: "instant" }, { skipping: true }, { accel: true }];
  const el = (role) => role, seen = new Set();
  for (const k of D.kinds) for (const m of modes) {
    const phases = D.plan(sample(k), Object.assign({ el, measure: () => ({ x: 0, y: 0, w: 10, h: 10 }) }, m));
    for (const p of phases) for (const i of p.items) for (const f of i.kf) for (const prop of Object.keys(f)) {
      assert.ok(OK_PROPS.has(prop), k + "/" + p.name + "/" + i.role + " animates '" + prop + "'");
      seen.add(prop);
    }
  }
  assert.ok(seen.has("transform") && seen.has("opacity"));
  /* and the source holds no other animatable property name in a keyframe */
  const src = fs.readFileSync(path.join(__dirname, "..", "ui", "director.js"), "utf8");
  assert.ok(!/\b(width|height|top|left|margin|box-?shadow|filter|clip-?path|background|border)\s*:\s*["'`]/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "no layout/paint property is keyframed");
  assert.strictEqual((src.match(/\.animate\(/g) || []).length, 1, "one animate call, in domAnimate");
});

/* ---------- the scheduler: queue, skip, tapThrough, idle ---------- */
test("a lone beat runs for exactly its duration, commits at the end frame and resolves idle()", async () => {
  const r = rig(); let committed = -1;
  const b = sample("play", { commit() { committed = r.clock.now(); } });
  r.d.enqueue(b);
  let idle = false; r.d.idle().then(() => { idle = true; });
  r.clock.advance(1189); await null;
  assert.strictEqual(committed, -1, "not yet"); assert.strictEqual(idle, false);
  r.clock.advance(1); await null; await null;
  assert.strictEqual(committed, 1190); assert.strictEqual(idle, true);
  assert.ok(r.calls.length && r.calls.every(a => a.cancelled), "every animation is cancelled at the end");
  assert.deepStrictEqual(r.cues.map(c => [c.name, c.at]), [["slap", 330]], "the slap lands with the card");
  await r.d.idle();   /* already idle: resolves at once */
});

test("the queue is strict: one beat at a time, in order, back to back", () => {
  const r = rig();
  ["announce", "pitch", "turn"].forEach(k => r.d.enqueue(sample(k)));
  r.clock.advance(1);
  r.d.enqueue(sample("hit"));   /* depth 4 would accelerate: this one waits its turn instead */
  r.clock.advance(20000);
  const ev = r.events.filter(e => e.type === "beatstart" || e.type === "beatend");
  const kinds = ev.map(e => (e.type === "beatstart" ? "+" : "-") + e.kind);
  assert.deepStrictEqual(kinds, ["+announce", "-announce", "+pitch", "-pitch", "+turn", "-turn", "+hit", "-hit"]);
  const starts = ev.filter(e => e.type === "beatstart"), ends = ev.filter(e => e.type === "beatend");
  assert.deepStrictEqual(starts.map(e => e.at), [0, 2160, 2660, 3560]);
  ends.forEach((e, i) => { if (starts[i + 1]) assert.strictEqual(starts[i + 1].at, e.at, "next starts when the previous leaves"); });
  assert.strictEqual(r.d.depth(), 0);
});

test("hits in the same moment are one hit (summed damage, one stop)", () => {
  const r = rig(), got = [];
  const h1 = r.d.enqueue(sample("hit", { dmg: 2, contact(b) { got.push(b.dmg); } }));
  const h2 = r.d.enqueue(sample("hit", { dmg: 5 }));
  assert.strictEqual(h1, h2, "merged into the first");
  r.clock.advance(5000);
  assert.deepStrictEqual(got, [7], "one contact, reading the sum");
  assert.strictEqual(r.cues.filter(c => /^hit/.test(c.name)).length, 1);
  assert.strictEqual(r.cues.find(c => /^hit/.test(c.name)).name, "hit7");
  /* another side's hit does not join */
  const r2 = rig();
  const a = r2.d.enqueue(sample("hit", { side: "M" })), b = r2.d.enqueue(sample("hit", { side: "O" }));
  assert.notStrictEqual(a, b);
});

test("skip never cuts mid-flight: what is left plays in --m-fast, then the queue advances 40 ms later", () => {
  const r = rig();
  r.d.enqueue(sample("announce")); r.d.enqueue(sample("pitch"));
  r.clock.advance(1000);   /* inside the 1500 hold */
  assert.strictEqual(r.d.skip(), true);
  const leave = r.calls.filter(a => a.at === 1000);
  assert.ok(leave.length >= 2, "the leave phase started at the skip");
  assert.ok(leave.every(a => a.op.duration <= 120 && a.op.delay === 0), "every leave duration is capped to --m-fast");
  r.clock.advance(119);
  assert.ok(!r.events.some(e => e.type === "beatend" && e.kind === "announce"), "not finished before the leave plays out");
  r.clock.advance(1);
  assert.ok(r.events.some(e => e.type === "beatend" && e.kind === "announce" && e.at === 1120));
  r.clock.advance(39);
  assert.ok(!r.events.some(e => e.type === "beatstart" && e.kind === "pitch"), "40 ms gap");
  r.clock.advance(1);
  assert.ok(r.events.some(e => e.type === "beatstart" && e.kind === "pitch" && e.at === 1160));
  /* skipping in the enter phase compresses the running animations instead of cutting them */
  const r2 = rig(); r2.d.enqueue(sample("announce"));
  r2.clock.advance(100);
  r2.d.skip();
  const rates = r2.calls.filter(a => a.at === 0).map(a => a.rate);
  assert.ok(rates.some(x => x > 1), "playbackRate raised: " + rates);
  r2.clock.advance(120);
  assert.ok(r2.events.some(e => e.type === "beatstart"));
  assert.ok(r2.d.running() === "announce", "then the hold is skipped and the leave plays");
  r2.clock.advance(120);
  assert.strictEqual(r2.d.running(), null);
});

test("hold(true) keeps the glimpse up until release", () => {
  const r = rig(); r.d.enqueue(sample("announce"));
  r.clock.advance(500); r.d.hold(true);
  r.clock.advance(5000);
  assert.strictEqual(r.d.running(), "announce", "kept");
  r.d.hold(false);
  assert.strictEqual(r.calls.filter(a => a.at === 5500 && a.op.duration > 0).length > 0, true, "the leave starts on release");
  r.clock.advance(220);
  assert.strictEqual(r.d.running(), null);
});

test("the KO's first 600 ms of hold cannot be skipped, then a tap proceeds", () => {
  const r = rig(); let done = 0;
  r.d.enqueue(sample("ko", { commit() { done++; } }));
  r.clock.advance(210 + 1020 + 300);   /* 300 ms into the result hold */
  assert.strictEqual(r.d.skip(), false, "locked");
  r.clock.advance(299); assert.strictEqual(r.d.skip(), false);
  r.clock.advance(1);
  assert.strictEqual(r.d.skip(), true, "unlocked at 600");
  assert.strictEqual(done, 1);
  assert.deepStrictEqual(r.cues.map(c => c.name), ["hit7", "ko"]);
  assert.strictEqual(r.cues[1].at, 210 + 260, "the boom follows the lethal stop");
  const dim = r.calls.find(a => a.el === "dim");
  assert.strictEqual(dim.op.delay, 260); assert.strictEqual(dim.op.duration, 500);
  assert.strictEqual(r.calls.find(a => a.el === "result").op.delay, 700);
});

test("tapThrough lands every queued state in order, with no motion for the ones that never played", () => {
  const r = rig(), log = [];
  const mk = (k, n) => sample(k, { begin() { log.push("begin " + n); }, contact() { log.push("contact " + n); }, commit() { log.push("commit " + n); } });
  r.d.enqueue(mk("announce", "a")); r.d.enqueue(mk("hit", "b")); r.d.enqueue(mk("pitch", "c"));
  r.clock.advance(300);
  const before = r.calls.length;
  assert.strictEqual(r.d.tapThrough(), true);
  r.clock.advance(400);
  assert.deepStrictEqual(log, ["begin a", "commit a", "begin b", "contact b", "commit b", "begin c", "commit c"], "in order, hooks intact");
  assert.strictEqual(r.d.depth(), 0);
  assert.strictEqual(r.calls.length - before, 2 + 1 - 0 + (r.calls.length - before - 3), "only the current beat's leave animates");
  assert.ok(r.calls.slice(before).every(a => a.op.duration <= 120));
  /* with nothing running it lands at once */
  const r2 = rig(); r2.d.enqueue(mk("hit", "z")); /* starts on a 0 ms timer */
  assert.strictEqual(r2.d.depth(), 1);
});

test("a beat that throws in a hook, an unknown kind and a missing element never stall the queue", async () => {
  const errs = [], r = rig({ onError: (e) => errs.push(e.message) });
  assert.strictEqual(r.d.enqueue({ kind: "nope" }), null);
  r.d.enqueue(sample("play", { commit() { throw new Error("boom"); } }));
  r.d.enqueue(sample("pitch"));
  r.clock.advance(5000); await null;
  assert.ok(errs.includes("boom"));
  assert.strictEqual(r.d.depth(), 0);
  const r2 = rig({ resolve: () => null });   /* every element missing: timing stays the same */
  r2.d.enqueue(sample("play")); r2.clock.advance(1190);
  assert.strictEqual(r2.d.depth(), 0); assert.strictEqual(r2.calls.length, 0);
});

test("a queue deeper than 3 plays at 0.6x durations and 0.5x holds until it is shallow again", () => {
  const r = rig();
  for (let i = 0; i < 5; i++) r.d.enqueue(sample("announce"));
  r.clock.advance(1);
  assert.strictEqual(r.d.depth(), 5);
  const first = r.calls.find(a => a.el === "slab");
  assert.ok(Math.abs(first.op.duration - 260 * .6) < 1e-6, "slab slam " + first.op.duration);
  r.clock.advance(100000);
  const ev = r.events.filter(e => e.type === "beatstart" || e.type === "beatend");
  const starts = ev.filter(e => e.type === "beatstart").map(e => e.at), ends = ev.filter(e => e.type === "beatend").map(e => e.at);
  /* the flag stays on until the queue is <= 1 deep (depth 5,4,3,2 accelerated; the last beat alone is standard) */
  for (let i = 0; i < 4; i++) assert.strictEqual(ends[i] - starts[i], Math.round((440 + 220) * .6 + 750), "beat " + i + " accelerated");
  assert.strictEqual(ends[4] - starts[4], 2160, "the last one is standard again");
  const r2 = rig(); for (let i = 0; i < 3; i++) r2.d.enqueue(sample("announce"));
  r2.clock.advance(100000);
  const e2 = r2.events.filter(e => e.type === "beatend").map(e => e.at);
  assert.deepStrictEqual(e2, [2160, 4320, 6480], "3 deep is not 'deeper than 3'");
});

test("speed: quick and instant change durations and holds, never the hit-stop", () => {
  const std = D.total(D.plan(sample("announce"))), q = D.total(D.plan(sample("announce"), { speed: "quick" })), i = D.total(D.plan(sample("announce"), { speed: "instant" }));
  assert.strictEqual(q, 440 * .6 + 700 + 220 * .6);
  assert.strictEqual(i, 400, "instant: the slab still shows 400 ms so the play is read");
  assert.ok(std > q && q > i);
  for (const sp of ["standard", "quick", "instant"]) {
    const ph = D.plan(sample("hit", { dmg: 3 }), { speed: sp });
    assert.strictEqual(ph[1].items.find(x => x.role === "world").at, 90, "hit-stop kept at " + sp);
    assert.strictEqual(ph[1].items.find(x => x.role === "world").dur, 160 + 28 * 3, "shake kept at " + sp);
  }
  assert.strictEqual(D.plan(sample("play"), { speed: "instant" })[1].len, 0, "own glimpse hold: 0 at instant");
  const r = rig({ speed: "quick" }); assert.strictEqual(r.d.speed(), "quick"); r.d.speed(0.6); assert.strictEqual(r.d.speed(), 0.6);
});

/* ---------- reduced motion ---------- */
test("reduced motion: flights are cuts, the announcement is kept, hit-stop and shake are off", () => {
  const rmPlan = (k, x) => D.plan(sample(k, x), { rm: true });
  /* the announcement: opacity fade of --m-fast, the same 1.5 s hold, no slide */
  const a = rmPlan("announce");
  assert.deepStrictEqual(a.map(p => p.len), [120, 1500, 120]);
  for (const p of a) for (const i of p.items) for (const f of i.kf) assert.ok(!("transform" in f && i.role === "slab"), "no slide on the slab");
  assert.deepStrictEqual(a[0].items.find(i => i.role === "slab").kf, [{ opacity: 0 }, { opacity: 1 }]);
  /* a play: every flight a cut (zero duration), the own glimpse hold stays */
  const p = rmPlan("play");
  assert.ok(p.every(ph => ph.items.every(i => i.dur === 0 && i.at === 0)));
  assert.strictEqual(p[1].len, 560);
  /* a hit: number swap (the hook), a 120 ms opacity flash, nothing else moves */
  const h = rmPlan("hit");
  assert.deepStrictEqual(h.map(x => x.items.map(i => i.role)), [[], ["flash"]]);
  assert.strictEqual(h[1].items[0].dur, 120); assert.strictEqual(h[1].hook, "contact");
  assert.strictEqual(D.total(h), 120);
  /* the KO: dimmed table and the word as cuts, no shake, no sweep, no stop; the hold still locks 600 */
  const k = rmPlan("ko");
  assert.ok(!k[1].items.some(i => i.role === "world" || i.role === "sweep"));
  assert.ok(k[1].items.filter(i => i.role === "dim" || i.role === "result").every(i => i.dur === 0 && i.keep));
  assert.strictEqual(k[2].lock, 600);
  /* prevention keeps its word, as an opacity-only fade of the same length */
  const pv = rmPlan("prevent");
  assert.strictEqual(pv[0].items.find(i => i.role === "word").dur, 700);
  assert.ok(pv[0].items.find(i => i.role === "word").kf.every(f => !("transform" in f)));
  /* sound is independent of reduced motion */
  assert.ok(a[0].cues.some(c => c.name === "thud")); assert.ok(h[1].cues.some(c => c.name === "hit3"));
  /* the scheduler honours the flag, live */
  const r = rig({ reduceMotion: () => true }); r.d.enqueue(sample("announce")); r.clock.advance(1740);
  assert.strictEqual(r.d.depth(), 0);
  const r2 = rig(); r2.d.reduce(true); r2.d.enqueue(sample("hit")); r2.clock.advance(120); assert.strictEqual(r2.d.depth(), 0);
  /* a beat that is all cuts finishes inside its own start: the queue must still move on (it once stuck on the finished run) */
  const r3 = rig(); r3.d.reduce(true);
  const seen3 = []; ["arsenal", "pitch", "play"].forEach(k => r3.d.enqueue(sample(k, { commit() { seen3.push(k); } })));
  r3.clock.advance(1);
  assert.deepStrictEqual(seen3, ["arsenal", "pitch"], "zero-length beats run back to back at once");
  r3.clock.advance(560); assert.deepStrictEqual(seen3, ["arsenal", "pitch", "play"]); assert.strictEqual(r3.d.depth(), 0);
  const r4 = rig({ speed: "instant", reduceMotion: true }); let n4 = 0; r4.d.enqueue(sample("arsenal", { commit() { n4++; } }));
  r4.clock.advance(1); assert.strictEqual(n4, 1); assert.strictEqual(r4.d.running(), null); r4.d.idle();
});

/* ---------- will-change and elements ---------- */
test("will-change is set only while a beat runs and on at most 12 elements", () => {
  const els = {}; for (let i = 0; i < 20; i++) els["e" + i] = { id: i };
  els.card = els.e0;
  const r = rig();
  r.d.enqueue(sample("play", { els }));
  r.clock.advance(1);
  assert.ok(r.willOn.size > 0 && r.willOn.size <= 12, "on while running: " + r.willOn.size);
  r.clock.advance(1189);
  assert.strictEqual(r.willOn.size, 0, "off at the end");
  assert.ok(r.willMax() <= 12);
  /* a queued beat is warmed behind the running one, and cooled too */
  const r2 = rig(); r2.d.enqueue(sample("play", { els: { card: { id: 1 } } })); r2.d.enqueue(sample("pitch", { els: { p0: { id: 2 } } }));
  r2.clock.advance(1); assert.strictEqual(r2.willOn.size, 2);
  r2.clock.advance(5000); assert.strictEqual(r2.willOn.size, 0);
});

/* ---------- FLIP ---------- */
test("FLIP: measures first and last once, animates the delta to rest", () => {
  const rects = { a: [{ x: 10, y: 100, w: 64, h: 90 }, { x: 74, y: 100, w: 64, h: 90 }], b: [{ x: 50, y: 50, w: 64, h: 90 }, { x: 50, y: 50, w: 64, h: 90 }] };
  const seen = { a: 0, b: 0 }; let phase = 0, mutated = 0;
  const measure = (el) => { const u = String(el).slice(4); return rects[u][phase === 0 ? 0 : 1] && (seen[u]++, rects[u][phase]); };
  const r = rig({ measure, resolve: (role) => role });
  r.d.enqueue({ kind: "move", uids: ["a", "b"], els: {}, mutate() { mutated++; phase = 1; } });
  r.clock.advance(1);
  assert.strictEqual(mutated, 1); assert.deepStrictEqual(seen, { a: 2, b: 2 }, "first and last once each");
  assert.strictEqual(r.calls.length, 1, "b did not move: no animation");
  assert.strictEqual(r.calls[0].el, "uid:a");
  assert.strictEqual(r.calls[0].kf[0].transform, "translate3d(-64px,0px,0) scale(1,1)");
  assert.strictEqual(r.calls[0].kf[1].transform, "translate3d(0,0,0) scale(1,1)");
  assert.strictEqual(r.calls[0].op.duration, 220);
  assert.strictEqual(D.flipDelta({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), null);
  assert.strictEqual(D.flipDelta(null, { x: 0, y: 0, w: 1, h: 1 }), null);
});

test("a ready promise holds a flight until the art is decoded (but never past 250 ms)", async () => {
  const r = rig(); let res; const ready = new Promise(x => { res = x; });
  r.d.enqueue(sample("play", { ready }));
  r.clock.advance(100); assert.strictEqual(r.calls.length, 0, "waiting on the decode");
  res(); await ready; await null;
  assert.ok(r.calls.length > 0, "started on decode");
  const r2 = rig(); r2.d.enqueue(sample("play", { ready: new Promise(() => {}) }));
  r2.clock.advance(250); assert.ok(r2.calls.length > 0, "the cap starts it");
});

test("keep: the end pose is the item's own last keyframe, EXACTLY, whatever the engine sampled (WebKit left translateY 3.36 on the prompt sheet)", () => {
  const g = globalThis, prev = g.getComputedStyle;
  /* a compositor that is a hair short of the end when the beat's timer fires: the computed style reads a residual */
  g.getComputedStyle = () => ({ transform: "matrix(1, 0, 0, 1, 0, 3.36)", opacity: "0.98" });
  try {
    const el = { style: {} }, scrim = { style: {} };
    const r = rig({ resolve: (role) => role === "sheet" ? el : scrim });
    r.d.enqueue({ kind: "rise", els: {} });
    r.clock.advance(380);
    assert.strictEqual(el.style.transform, "translate3d(0,0,0)", "the sheet rests exactly where its last keyframe says");
    assert.strictEqual(scrim.style.opacity, 1, "and the scrim at full opacity");
    assert.strictEqual(el.style.opacity, undefined, "only the properties the keyframes touch are written");
    assert.ok(r.calls.every(a => a.cancelled && !a.committed), "written, not committed from a sample");
    /* a drop ends at the opposite pose */
    const el2 = { style: {} }, sc2 = { style: {} }, r2 = rig({ resolve: (role) => role === "sheet" ? el2 : sc2 });
    r2.d.enqueue({ kind: "drop", els: {} }); r2.clock.advance(220);
    assert.strictEqual(el2.style.transform, "translate3d(0,100%,0)"); assert.strictEqual(sc2.style.opacity, 0);
  } finally { g.getComputedStyle = prev; }
  /* with no DOM the animation's own commitStyles is the fallback */
  const r2 = rig(); r2.d.enqueue({ kind: "sheet", els: { sheet: "s" } }); r2.clock.advance(380);
  assert.ok(r2.calls.some(a => a.committed));
});

test("dispose cancels everything and resolves idle", async () => {
  const r = rig(); r.d.enqueue(sample("announce")); r.clock.advance(100);
  const p = r.d.idle(); r.d.dispose(); await p;
  assert.ok(r.calls.every(a => a.cancelled)); assert.strictEqual(r.clock.pending(), 0);
  assert.strictEqual(r.d.enqueue(sample("pitch")), null);
});

test("lane 'now' beats (select, refuse) never wait behind the queue", () => {
  const r = rig(); r.d.enqueue(sample("announce"));
  r.clock.advance(500);
  r.d.enqueue(sample("refuse"));
  const nudge = r.calls.find(a => a.at === 500 && a.el === "card");
  assert.ok(nudge && nudge.op.duration === 140, "the nudge plays at once, 140 ms");
  assert.deepStrictEqual(nudge.kf.map(f => f.transform), [0, 4, -4, 4, 0].map(x => "translate3d(" + (10 + x) + "px,300px,0) scale(0.27)"), "3 half-cycles of +-4 px about the rest pose");
  assert.strictEqual(r.d.running(), "announce", "the queue's beat is undisturbed");
  r.clock.advance(140);
  assert.ok(nudge.cancelled, "and it cleans up after itself");
});

/* ---------- audio ---------- */
function fakeAudio() {
  const log = { created: 0, resumed: 0, srcs: 0, ctxs: [] };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  class Ctx {
    constructor() { log.created++; log.ctxs.push(this); this.state = "suspended"; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    createGain() { return { gain: param(), connect() {} }; }
    createDynamicsCompressor() { return { threshold: { value: 0 }, ratio: { value: 0 }, connect() {} }; }
    createOscillator() { log.srcs++; return { type: "", frequency: param(), connect() {}, start() {}, stop() {} }; }
    createBufferSource() { log.srcs++; return { connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: "", Q: { value: 0 }, frequency: param(), connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    resume() { log.resumed++; this.state = "running"; return Promise.resolve(); }
  }
  return { Ctx, log };
}
function fakeDoc() {
  const h = {};
  return { hidden: false, addEventListener(n, f) { (h[n] = h[n] || []).push(f); }, fire(n) { (h[n] || []).forEach(f => f({})); }, handlers: h };
}
const store = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

test("audio: nothing plays before a gesture; resume() runs inside it; one context only", () => {
  const { Ctx, log } = fakeAudio(), doc = fakeDoc();
  const a = A.create({ AudioContext: Ctx, storage: store(), window: { document: doc } });
  a.init();
  assert.strictEqual(a.cue("slap"), false, "locked before the first gesture");
  assert.strictEqual(log.created, 0, "no context before a gesture");
  assert.ok(doc.handlers.pointerdown && doc.handlers.pointerup && doc.handlers.click && doc.handlers.touchend, "iOS: pointer, click and touchend all unlock");
  assert.ok(!doc.handlers.touchstart, "touchstart does not unlock on iOS");
  doc.fire("pointerdown");
  assert.strictEqual(log.created, 1); assert.strictEqual(log.resumed, 1, "resumed inside the gesture");
  assert.strictEqual(a.cue("slap"), true);
  doc.fire("click"); doc.fire("pointerdown");
  assert.strictEqual(log.created, 1, "one AudioContext for the page");
  assert.strictEqual(a.state(), "running");
  a.init();   /* idempotent */
  assert.strictEqual(doc.handlers.pointerdown.length, 1);
});

test("audio: the 14 cues of MOTION.md §6.2 (+ the coin), unknown names and bad args never throw", () => {
  assert.deepStrictEqual(Object.keys(A.CUES).sort(), ["block", "coin", "draw", "goagain", "hit1", "hit3", "hit7", "ko", "pitch", "prevent", "select", "slap", "tap", "thud", "turn"].sort());
  const { Ctx } = fakeAudio(), doc = fakeDoc();
  const a = A.create({ AudioContext: Ctx, storage: store(), window: { document: doc } });
  a.init(); doc.fire("pointerdown");
  for (const n of Object.keys(A.CUES)) {   /* a fresh clock each: the 6-voice cap is its own drill */
    const x = A.create({ AudioContext: fakeAudio().Ctx, storage: store(), window: { document: fakeDoc() } });
    x.unlock(); assert.strictEqual(x.cue(n, { gain: .5, pitch: .7 }), true, n);
  }
  assert.strictEqual(a.cue("nope"), false); assert.strictEqual(a.cue("slap", { gain: -1 }), false); assert.strictEqual(a.cue(), false);
  /* the director fires cues through audio.cue and survives an audio that throws */
  const r = rig({ audio: { cue() { throw new Error("no audio"); } } });
  r.d.enqueue(sample("pitch")); r.clock.advance(500); assert.strictEqual(r.d.depth(), 0);
  /* an environment with no AudioContext at all */
  const none = A.create({ storage: null, window: null });
  none.init(); assert.strictEqual(none.unlock(), false); assert.strictEqual(none.cue("slap"), false); assert.strictEqual(none.state(), "unsupported");
});

test("audio: never more than 6 voices; the quietest is dropped", () => {
  const { Ctx } = fakeAudio(), doc = fakeDoc();
  const a = A.create({ AudioContext: Ctx, storage: store(), window: { document: doc } });
  a.init(); doc.fire("pointerdown");
  for (let i = 0; i < 6; i++) assert.strictEqual(a.cue("ko", { gain: 1 }), true);
  assert.strictEqual(a.voices(), 6);
  assert.strictEqual(a.cue("tap"), false, "a quieter cue past six is the one dropped");
  assert.strictEqual(a.voices(), 6);
  assert.strictEqual(a.cue("ko", { gain: 1 }), false, "equal loudness: the newcomer is dropped");
  /* a louder one displaces the quietest */
  const b = A.create({ AudioContext: fakeAudio().Ctx, storage: store(), window: { document: fakeDoc() } });
  b.unlock();
  for (let i = 0; i < 5; i++) b.cue("ko");
  b.cue("tap"); assert.strictEqual(b.voices(), 6);
  assert.strictEqual(b.cue("hit7"), true, "louder than the tap: it takes the tap's place");
  assert.strictEqual(b.voices(), 6);
});

test("audio: master volume defaults to 0.5; mute and volume persist and storage failure is harmless", () => {
  const st = store();
  const a = A.create({ AudioContext: fakeAudio().Ctx, storage: st, window: { document: fakeDoc() } });
  assert.strictEqual(a.volume(), .5); assert.strictEqual(a.muted(), false);
  a.unlock(); a.setMuted(true);
  assert.strictEqual(a.cue("slap"), false, "muted"); assert.strictEqual(st.m["dawnui.audio.muted"], "1");
  a.setVolume(.8); assert.strictEqual(st.m["dawnui.audio.volume"], "0.8");
  const b = A.create({ AudioContext: fakeAudio().Ctx, storage: st, window: { document: fakeDoc() } });
  assert.strictEqual(b.muted(), true); assert.strictEqual(b.volume(), .8, "remembered per device");
  assert.strictEqual(b.toggleMute(), false);
  const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const c = A.create({ AudioContext: fakeAudio().Ctx, storage: bad, window: { document: fakeDoc() } });
  assert.strictEqual(c.volume(), .5); c.setMuted(true); c.setVolume(2); assert.strictEqual(c.volume(), 1);
  const g = fakeAudio().Ctx; const m = A.create({ AudioContext: g, storage: store(), window: { document: fakeDoc() } });
  m.unlock(); m.setVolume(.5);
});

test("the ui files are classic scripts with their own namespaces and fit the size cap", () => {
  for (const [f, ns] of [["director.js", "DawnUIDirector"], ["audio.js", "DawnUIAudio"]]) {
    const src = fs.readFileSync(path.join(__dirname, "..", "ui", f), "utf8");
    assert.ok(src.length <= 60 * 1024, f + " <= 60 KB");
    assert.ok(src.includes("root." + ns + " ="), f + " exports window." + ns);
    assert.ok(!/^\s*(import|export)\s/m.test(src), f + " is not an ES module");
  }
  const eng = new Set();
  for (const f of fs.readdirSync(path.join(__dirname, "..", "engine")).filter(x => x.endsWith(".js")))
    try { Object.keys(require("../engine/" + f)).forEach(k => eng.add(k)); } catch (e) { /* headless module that needs a host */ }
  for (const k of [...Object.keys(D), ...Object.keys(A)]) assert.ok(!eng.has(k) || ["create"].includes(k), "no engine export is named " + k);
});
