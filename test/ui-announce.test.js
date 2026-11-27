/* ============================================================
   ui-announce.test.js — CRESCENDO's announcement view (ui/announce-view.js)

   `beatsFor(step, viewer, view)` turns the lines `engine/announce.js` says into the table's story of one action:
   an ordered list of descriptors the announcer plays as director beats. Driven here over WHOLE self-played games
   (the same five as test/announce.test.js), from BOTH seats, because the property that matters is the privilege
   line (TRP 5.1, HIDDEN-HANDS.md):

     - a descriptor never carries, and a slab never speaks, a card the viewer may not know — not a drawn card, not
       the other seat's arsenal, not a card pitched face down; announce.js guarantees the words, this guarantees
       nothing was ADDED;
     - the story is the engine's: damage is the life that really moved, a play is the card that really landed;
     - both seats get the same story from the same action (own/opponent differ only in how it is told);
     - the controller plays a whole game through the REAL director on a manual clock: one announcement on screen
       at a time, every beat valid, the queue ends idle.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const AV = require("../ui/announce-view.js");
const D = require("../ui/director.js");
const A = require("../engine/announce.js");
const L = require("../engine/local.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const V = require("../engine/view.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached card database";
const DATA = skip ? null : require("./helpers/extract.js").loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard)));

function match(k0, k1, seed, first){
  const h0 = DATA.HEROES.find(h => h.k === k0), h1 = DATA.HEROES.find(h => h.k === k1);
  const ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
}
function play(k0, k1, seed, first){
  const steps = [], g0 = match(k0, k1, seed, first);
  const s = L.createLocal({seat: 0, state: g0, reduce: J.reduce, legal: J.legal, policy: (st, i) => SP.act(st, i), onStep: e => steps.push(e)});
  s.start();
  for(let i = 0; i < 4000 && !s.state().over; i++){ const a = SP.act(s.state(), 0); if(!a) break; if(s.submit(a)) break; }
  return {g0, end: s.state(), steps, names: [g0.sides[0].name, g0.sides[1].name]};
}
const GAMES = [["kayo", "dorinthea", "ann1", 0], ["viserai", "iyslander", "ann2", 1], ["enigma", "briar", "ann3", 0], ["arakni", "azalea", "ann4", 1], ["fai", "dash", "ann5", 0]];
let _games = null;
const games = () => _games || (_games = GAMES.map(x => ({key: x.slice(0, 2).join("/"), ...play(...x)})));

const KINDS = new Set(["play", "pitch", "block", "arsenal", "note", "hit", "ko", "lifegain", "prevent", "goagain", "turn", "draw", "again"]);
/* every card a descriptor names */
const cardsOf = d => [d.card, ...(d.cards || []), ...(d.extras || []).map(e => e.card), d.attacker].filter(Boolean);
const strings = d => [d.slab && d.slab.label, d.slab && d.slab.line, d.source].filter(Boolean);

test("beatsFor never names a card the viewer may not know, on any step, from either seat", {skip}, () => {
  const seen = {arsenalOpp: 0, drawOpp: 0, drawOwn: 0, pitchOpp: 0, plays: 0};
  for(const G0 of games()) for(const st of G0.steps) for(const viewer of [0, 1]){
    const hid = V.hiddenUids(st.next, viewer);
    const hiddenNames = new Set();
    for(const sd of st.next.sides) for(const z of ["hand", "deck", "arsenal", "soul", "banish", "intimidated"]){
      const zs = z === "arsenal" ? (sd.arsenal ? [sd.arsenal] : []) : (sd[z] || []);
      for(const c of zs) if(c && hid.has(String(c.uid))) hiddenNames.add(String(c.name).toUpperCase());
    }
    const ds = AV.beatsFor(st, viewer, {names: G0.names});
    const known = new Set();                                  /* names the descriptors legitimately show this step */
    ds.forEach(d => cardsOf(d).forEach(c => { assert.ok(!hid.has(String(c.uid)), `${G0.key} T${st.next.turn}: seat ${viewer} is shown "${c.name}" (${d.kind}), hidden from it`); known.add(String(c.name).toUpperCase()); }));
    for(const d of ds){
      for(const s of strings(d)){
        for(const n of hiddenNames) if(!known.has(n) && s.includes(n) && n.length > 4) assert.fail(`${G0.key}: a slab says "${s}", naming hidden "${n}" to seat ${viewer}`);
      }
      if(d.kind === "arsenal" && d.seat !== viewer){ seen.arsenalOpp++; assert.equal(d.card, null, "the other seat's arsenal card was shown"); assert.equal(d.own, false); }
      if(d.kind === "note" && d.back){ assert.equal(d.card, null); assert.equal(d.slab.line, "A CARD, FACE DOWN"); }
      if(d.kind === "draw"){
        if(d.own){ seen.drawOwn++; d.cards.forEach(c => assert.ok(!hid.has(String(c.uid)))); }
        else { seen.drawOpp++; assert.deepEqual(d.cards, [], "the other seat's draw is backs and a number"); }
        assert.ok(d.n > 0);
      }
      if(d.kind === "pitch" && !d.own) seen.pitchOpp++;
      if(d.kind === "play") seen.plays++;
    }
  }
  assert.ok(seen.arsenalOpp > 0, "no game set a card in the arsenal: the face-down rule was never met");
  assert.ok(seen.drawOpp > 0 && seen.drawOwn > 0, "no draws met: " + JSON.stringify(seen));
  assert.ok(seen.plays > 100, "too few plays: " + seen.plays);
});

test("the story is the engine's: damage is the life that moved, in both seats' tellings", {skip}, () => {
  let hits = 0, ko = 0, gains = 0;
  for(const G0 of games()) for(const st of G0.steps){
    const a = AV.beatsFor(st, 0, {names: G0.names}), b = AV.beatsFor(st, 1, {names: G0.names});
    for(const i of [0, 1]){
      const real = st.next.sides[i].hp - st.prev.sides[i].hp;
      const told = x => x.reduce((n, d) => n + ((d.kind === "hit" || d.kind === "ko") && d.side === i ? -d.dmg : d.kind === "lifegain" && d.side === i ? d.n : 0), 0);
      assert.equal(told(a), real, `${G0.key} T${st.next.turn}: seat ${i}'s life moved ${real}, the story told ${told(a)}`);
      assert.equal(told(b), real);
    }
    /* the same facts from either seat; only who is "own" differs */
    /* (a pitch/note is how the same fact is TOLD to each seat: your cards fly, theirs are announced) */
    const facts = x => x.filter(d => d.kind !== "pitch" && d.kind !== "note").map(d => d.kind + (d.side != null ? d.side : d.seat != null && d.kind !== "play" && d.kind !== "arsenal" ? d.seat : ""));
    assert.deepEqual(facts(a), facts(b), G0.key + ": the two seats were told different stories");
    for(const d of a){
      assert.ok(KINDS.has(d.kind), "unknown kind " + d.kind);
      if(d.kind === "hit" || d.kind === "ko"){
        const max = st.next.sides[d.side].maxHp;
        assert.ok(d.dmg > 0 || d.kind === "ko"); assert.ok(d.from >= 0 && d.from <= 1 && d.to >= 0 && d.to <= 1, "fractions");
        if(d.kind === "ko" || d.from >= 1) assert.ok((d.from - d.to) * max <= d.dmg + 1e-6, "the bar cannot fall further than the blow (overkill is not life; a bar capped at full only shows the rest)");
        else assert.ok(Math.abs((d.from - d.to) * max - d.dmg) < 1e-6, `${G0.key}: the bar moves ${(d.from - d.to) * max}, the hit is ${d.dmg}`);
        d.kind === "ko" ? ko++ : hits++;
      }
      if(d.kind === "lifegain"){ gains++; assert.ok(d.to >= d.from, "a gain never lowers the bar (it may stop at a full one)"); }
    }
  }
  assert.ok(hits > 30, "too few hits to prove anything: " + hits);
  assert.ok(ko >= 3, "the games should end in a KO: " + ko);
});

test("a play is the card that landed; an attack says the engine's number; pitch rides with the play", {skip}, () => {
  let attacks = 0, ownPitch = 0, oppExtras = 0;
  for(const G0 of games()) for(const st of G0.steps) for(const viewer of [0, 1]){
    const ds = AV.beatsFor(st, viewer, {names: G0.names}), lines = A.say(st, viewer);
    ds.forEach((d, i) => {
      if(d.kind !== "play") return;
      assert.equal(d.own, d.seat === viewer);
      assert.ok(d.slab.line.startsWith("PLAYS ") || d.slab.line.startsWith("USES ") || d.slab.line.startsWith("ACTIVATES "), d.slab.line);
      assert.ok(d.slab.label.startsWith(d.own ? "YOU" : String(G0.names[d.seat]).toUpperCase()) , d.slab.label);
      if(d.card) assert.ok(d.slab.line.endsWith(String(d.card.name).toUpperCase().replace(/\s+[—-]\s+ABILITY$/, "")), "the slab names the card it glimpses");
      if(d.line.k === "attack" && d.line.n != null){ attacks++; assert.ok(d.slab.label.includes("FOR " + d.line.n), d.slab.label); }
      if(d.own && d.line.pitched.length){ ownPitch++; const p = ds[i - 1]; assert.ok(p && p.kind === "pitch" && p.own && p.cards.length === d.line.pitched.length, "your pitch flies first"); assert.deepEqual(d.extras, []); }
      if(!d.own && d.line.pitched.length){ oppExtras++; assert.equal(d.extras.length, d.line.pitched.length, "their pitch rides beside the card"); d.extras.forEach(e => assert.equal(e.pitch, e.card.pitch | 0)); }
    });
    /* nothing the story says was not said: every play descriptor comes from a line */
    assert.ok(ds.filter(d => d.kind === "play").length <= lines.filter(l => ["attack", "play", "ability", "hero"].includes(l.k)).length);
  }
  assert.ok(attacks > 20 && ownPitch > 5 && oppExtras > 5, `coverage ${attacks}/${ownPitch}/${oppExtras}`);
});

/* ---- the controller, through the REAL director, on a manual clock and a toy DOM ---- */
function fakeDom(){
  const mk = (cls) => { const e = {className: cls || "", style: {}, children: [], parentNode: null, textContent: "", classes: new Set((cls || "").split(" ").filter(Boolean)),
    classList: {toggle: (c, on) => { on ? e.classes.add(c) : e.classes.delete(c); }},
    appendChild(c){ c.parentNode = e; e.children.push(c); return c; }, removeChild(c){ e.children = e.children.filter(x => x !== c); c.parentNode = null; },
    querySelector(sel){ return e._q && e._q[sel] || null; }, set src(v){}, set alt(v){}, set decoding(v){} }; return e; };
  const layer = mk("an-layer"), slab = mk("an-slab"), scrim = mk("an-scrim"), dim = mk("an-dim"), sweep = mk("an-sweep"), result = mk("an-result"), banner = mk("an-banner");
  slab._q = {small: mk(), b: mk()}; banner._q = {b: mk()}; result._q = {span: mk()};
  layer._q = {".an-slab": slab, ".an-scrim": scrim, ".an-dim": dim, ".an-sweep": sweep, ".an-result": result, ".an-banner": banner};
  layer.appendChild = (c) => { c.parentNode = layer; layer.children.push(c); return c; };
  return {layer, doc: {createElement: (t) => mk(t === "img" ? "img" : "")}, slab, scrim};
}
function clockRig(){
  let t = 0, id = 0, timers = [];
  const clock = {now: () => t, setTimer(fn, ms){ const h = ++id; timers.push({h, at: t + Math.max(0, ms), fn, n: h}); return h; }, clearTimer(h){ timers = timers.filter(x => x.h !== h); },
    run(){ for(let n = 0; n < 200000; n++){ timers.sort((a, b) => a.at - b.at || a.n - b.n); const x = timers.shift(); if(!x) return true; t = x.at; x.fn(); } return false; }, pending: () => timers.length};
  return clock;
}

test("a whole game through the announcer and the real director: one announcement at a time, valid beats, ends idle", {skip}, () => {
  const G0 = games()[0], clock = clockRig(), errors = [], ev = [];
  const animate = (el, kf, op) => ({cancel(){}, commitStyles(){}, updatePlaybackRate(){}});
  const director = D.create({now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, animate, audio: {cue(){}}, vibrate: null, reduceMotion: false,
    resolve: (role, beat) => { const e = beat.els && beat.els[role]; return e && typeof e === "object" ? e : null; }, measure: () => null, will: () => {},
    onError: e => errors.push(e.message), onEvent: e => ev.push({type: e.type, kind: e.beat && e.beat.kind, at: clock.now()})});
  const dom = fakeDom(), hidden = new Set(), landed = [];
  const ctl = AV.createAnnouncer({director, viewer: 0, view: {names: G0.names}, layer: dom.layer, document: dom.doc, size: {w: 393, h: 402},
    onHide: (uid, on) => on ? hidden.add(uid) : hidden.delete(uid), onLand: d => landed.push(d.kind)});
  let told = 0;
  for(const st of G0.steps) told += ctl.hear(st).length;
  assert.ok(told > 100, "the game was told: " + told);
  assert.ok(clock.run(), "the queue drains");
  assert.deepEqual(errors, []);
  /* strict queue: at most one announce running at any time, and never two overlapping beats of the queue lane */
  let open = 0, maxOpen = 0, announces = 0; const kinds = new Set();
  for(const e of ev){ if(e.type === "beatstart" && D.lanes(e.kind) === "q"){ open++; kinds.add(e.kind); if(e.kind === "announce") announces++; } if(e.type === "beatend" && D.lanes(e.kind) === "q") open--; maxOpen = Math.max(maxOpen, open); }
  assert.equal(maxOpen, 1, "two queue beats overlapped");
  assert.equal(open, 0); assert.ok(announces > 20, "opponent plays were announced: " + announces);
  for(const k of ["announce", "play", "hit", "turn"]) assert.ok(kinds.has(k), "never saw a " + k);
  assert.equal(hidden.size, 0, "every hidden hand node was handed back to the board");
  assert.equal(dom.layer.children.filter(c => c.className.indexOf("an-card") === 0).length, 0, "every flying clone was removed");
  assert.equal(dom.scrim.classes.has("live"), false, "the scrim stops taking taps when the beats are over");
  assert.ok(landed.length > 100, "the board was told where things landed");
  assert.ok(director.depth() === 0);
  ctl.dispose();
});

test("the opponent's announcement is a left slab with the card's face revealed; your own play never shows a slab", {skip}, () => {
  let opp = null, own = null;
  for(const G0 of games()) for(const st of G0.steps){
    for(const d of AV.beatsFor(st, 0, {names: G0.names})){ if(d.kind === "play" && !d.own && d.card && !opp) opp = d; if(d.kind === "play" && d.own && !own) own = d; }
  }
  assert.ok(opp && own);
  const clock = clockRig(), calls = [];
  const dir = {enqueue: b => { calls.push(b); return b; }};
  const dom = fakeDom();
  const ctl = AV.createAnnouncer({director: dir, viewer: 0, view: {names: ["A", "B"]}, layer: dom.layer, document: dom.doc, size: {w: 393, h: 402}});
  ctl.play([opp]); ctl.play([own]);
  assert.equal(calls[0].kind, "announce"); assert.equal(calls[0].side, "left"); assert.equal(calls[0].reveal, true);
  assert.ok(calls[0].els.slab && calls[0].els.card && calls[0].els.back && calls[0].els.scrim);
  assert.ok(["play", "reaction"].includes(calls[1].kind)); assert.equal(calls[1].els.slab, undefined, "your own play has no slab (MOTION 3.3)");
  assert.equal(calls[1].reveal, false);
  /* an unseen card is a back: no face reveal is asked for */
  ctl.play([{kind: "note", seat: 1, card: null, back: true, slab: {label: "B · ARSENAL", line: "A CARD, FACE DOWN", seat: 1}}]);
  assert.equal(calls[2].reveal, false); assert.equal(calls[2].els.card, null);
});
