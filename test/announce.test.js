/* ============================================================
   announce.test.js — TABLE TALK (TT0, v7.18): what is said across the table

   `engine/announce.js` turns one accepted action into what the table hears
   (`say`) and what goes on the pad (`marks`). docs/TABLE-TALK.md §4–§5.
   Drilled on WHOLE self-play games through `local.js`'s `onStep`, from BOTH
   seats, because the property that matters is the privilege line (TRP 5.1):
   it must never name a card the viewer may not know, on any step of any game.

     - a card is named only when `view.hiddenUids(next, viewer)` lacks it;
       the other seat's arsenal is "a card, face down";
     - an attack's number is the engine's (`pend.total`), never the printed one;
     - the pad is exact: each mark is a hero's life change, and the marks of a
       game, summed from the starting life, end where the game ended;
     - a pass never announces a play;
     - both seats hear the same table, differing only in what one may not see.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

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
const DB = () => _db || (_db = C.buildMaps(
  require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard)));

function match(k0, k1, seed, first){
  const h0 = DATA.HEROES.find(h => h.k === k0), h1 = DATA.HEROES.find(h => h.k === k1);
  const ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k],
                     rng, first: first || 0, tokSeq: ctr.n});
}
/* a whole game through local.js with the policy in both seats; every step heard */
function play(k0, k1, seed, first){
  const steps = [];
  const g0 = match(k0, k1, seed, first);
  const s = L.createLocal({seat: 0, state: g0, reduce: J.reduce, legal: J.legal,
    policy: (st, i) => SP.act(st, i), onStep: e => steps.push(e)});
  s.start();
  for(let i = 0; i < 4000 && !s.state().over; i++){
    const a = SP.act(s.state(), 0); if(!a) break;
    if(s.submit(a)) break;
  }
  return {g0, end: s.state(), steps};
}
const GAMES = [["kayo", "dorinthea", "ann1", 0], ["viserai", "iyslander", "ann2", 1], ["enigma", "briar", "ann3", 0],
               ["arakni", "azalea", "ann4", 1], ["fai", "dash", "ann5", 0]];
let _games = null;
const games = () => _games || (_games = GAMES.map(x => ({key: x.slice(0, 2).join("/"), ...play(...x)})));

const named = l => [l.card, ...(l.cards || []), ...(l.pitched || [])].filter(Boolean);

test("it never names a card the viewer may not know (TRP 5.1), on any step, from either seat", {skip}, () => {
  let lines = 0, arsenalsHidden = 0;
  for(const G0 of games()) for(const st of G0.steps) for(const viewer of [0, 1]){
    const hid = V.hiddenUids(st.next, viewer);
    for(const l of A.say(st, viewer)){
      lines++;
      for(const c of named(l)){
        assert.ok(c && c.uid != null, G0.key + ": a line names a card with no uid");
        assert.ok(!hid.has(String(c.uid)), `${G0.key} T${st.next.turn}: seat ${viewer} hears "${c.name}" (${l.k}), which is hidden from it`);
      }
      if(l.k === "arsenal" && l.seat !== viewer){
        arsenalsHidden++;
        assert.equal(l.card, null, G0.key + ": the other seat's arsenal card was shown");
        assert.equal(l.sub, "a card, face down", G0.key + ": the other seat's arsenal card was named");
      }
    }
  }
  assert.ok(lines > 300, "the games said too little to prove anything (" + lines + " lines)");
  assert.ok(arsenalsHidden > 0, "no game set a card in the arsenal: the face-down rule was never met");
});

test("an attack's number is the engine's, as it stands on the chain", {skip}, () => {
  let attacks = 0;
  for(const G0 of games()) for(const st of G0.steps) for(const l of A.say(st, 0)){
    if(l.k !== "attack" || l.n == null) continue;
    const p = st.next.pend;
    assert.ok(p && p.card && l.card && String(p.card.uid) === String(l.card.uid), G0.key + ": an attack line with a number for a card not on the chain");
    assert.equal(l.n, p.total | 0, `${G0.key}: "${l.head}" said ${l.n}, the chain holds ${p.total}`);
    assert.ok(/^(attacking|swinging) for \d+$/.test(l.sub), "the small words: " + l.sub);
    attacks++;
  }
  assert.ok(attacks > 20, "too few attacks to prove anything: " + attacks);
});

test("the pad is exact: each mark is a life change, and a game's marks end where the game ended", {skip}, () => {
  for(const G0 of games()){
    const life = [G0.g0.sides[0].hp, G0.g0.sides[1].hp];
    let n = 0, sourced = 0;
    for(const st of G0.steps){
      const ms = A.marks(st);
      for(const i of [0, 1]){
        const d = st.next.sides[i].hp - st.prev.sides[i].hp, m = ms.filter(x => x.seat === i);
        assert.equal(m.length, d ? 1 : 0, `${G0.key}: seat ${i}'s life moved ${d} and the pad wrote ${m.length} marks`);
        if(!d) continue;
        assert.equal(m[0].delta, d); assert.equal(m[0].total, st.next.sides[i].hp);
        assert.equal(life[i] + d, m[0].total, G0.key + ": a mark does not follow from the one before it");
        life[i] = m[0].total; n++;
        if(m[0].source){ sourced++; assert.equal(typeof m[0].source, "string"); assert.ok(!/ability$/i.test(m[0].source), "a source reads as a record, not a card: " + m[0].source); }
      }
    }
    assert.deepEqual(life, [G0.end.sides[0].hp, G0.end.sides[1].hp], G0.key + ": the pad's last totals are not the game's");
    assert.ok(n > 3, G0.key + ": the game's life barely moved (" + n + " marks)");
    assert.ok(sourced > 0, G0.key + ": no mark named its source");
  }
});

test("a pass never announces a play, and the defender's empty pass says NO BLOCK", {skip}, () => {
  let noblocks = 0;
  for(const G0 of games()) for(const st of G0.steps){
    const ls = A.say(st, 0);
    if(st.action.t === "pass")
      for(const l of ls) assert.ok(!["play", "ability", "hero", "block", "arsenal"].includes(l.k) && !(l.k === "attack" && !l.again),
        `${G0.key}: a pass announced "${l.head}" (${l.k})`);
    const nb = ls.filter(l => l.k === "noblock");
    if(nb.length){
      noblocks++;
      const sd = st.next.sides[st.seat];
      assert.equal(st.action.t, "pass");
      assert.ok(!(sd.blockH || []).length && !(sd.blockG || []).length, G0.key + ": NO BLOCK said with blockers declared");
    }
  }
  assert.ok(noblocks > 0, "no game had an unblocked attack: NO BLOCK was never met");
});

test("both seats hear the same table, differing only in what one of them may not see", {skip}, () => {
  for(const G0 of games()) for(const st of G0.steps){
    const a = A.say(st, 0), b = A.say(st, 1);
    assert.deepEqual(a.map(l => l.k), b.map(l => l.k), `${G0.key} T${st.next.turn}: the two seats heard different things`);
    a.forEach((l, i) => { if(l.k !== "arsenal") assert.equal(l.head, b[i].head, G0.key + ": the same line, different words"); });
  }
});

test("passes are quiet: most actions say nothing", {skip}, () => {
  let quiet = 0, all = 0;
  for(const G0 of games()) for(const st of G0.steps){ all++; if(!A.say(st, 0).length) quiet++; }
  assert.ok(quiet / all > 0.5, `only ${quiet} of ${all} actions were silent — the table would never stop talking`);
});

/* ---- THE TWO RULES THE ANNOUNCER IS BUILT ON (CR-INDEX guards them here) ------------------------
   CR 5.1.1–5.1.2: "To play a card is to move it to the stack as a card-layer … Playing a card involves the
   following steps in order: Announce, …" and "5.1.2 Announce: First, the player proposes the card to be
   played." A play IS an announcement, so every card put into play is said, by name, to both seats.
   CR 3.14.1: "A pitch zone is a public zone outside the arena, owned by a player." What a seat pitched is
   therefore said too, to both seats, in the action that pitched it. */
test("every card put into play is announced to both seats, by name (CR 5.1.1, CR 5.1.2)", {skip}, () => {
  let plays = 0;
  for(const G0 of games()) for(const st of G0.steps){
    const pl = A.playedBy(st.prev, st.action, st.seat, st.next);
    if(!pl || !pl.card || pl.how === "hero") continue;
    for(const viewer of [0, 1]){
      const ls = A.say(st, viewer);
      const said = ls.some(l => ["attack", "play", "ability"].includes(l.k) && l.card && String(l.card.uid) === String(pl.card.uid));
      assert.ok(said, `${G0.key} T${st.next.turn}: "${pl.card.name}" was put into play (${st.action.t}) and seat ${viewer} was not told`);
    }
    plays++;
  }
  assert.ok(plays > 40, "too few plays to prove anything: " + plays);
});

test("what a seat pitched is said to both seats, in the action that pitched it (CR 3.14.1)", {skip}, () => {
  let pitches = 0;
  for(const G0 of games()) for(const st of G0.steps) for(const i of [0, 1]){
    const had = new Set((st.prev.sides[i].pitch || []).map(c => String(c.uid)));
    const fresh = (st.next.sides[i].pitch || []).filter(c => !had.has(String(c.uid)));
    if(!fresh.length) continue;
    for(const viewer of [0, 1]){
      const told = new Set(A.say(st, viewer).flatMap(l => (l.pitched || []).map(c => String(c.uid))));
      for(const c of fresh) assert.ok(told.has(String(c.uid)), `${G0.key} T${st.next.turn}: seat ${i} pitched "${c.name}" and seat ${viewer} was not told`);
    }
    pitches += fresh.length;
  }
  assert.ok(pitches > 40, "too few pitches to prove anything: " + pitches);
});
