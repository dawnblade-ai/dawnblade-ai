/* ============================================================
   COUNTERS DO NOT OUTLIVE THEIR CARD (S-item, 2026-11-07)

   CR 3.0.9 (rules.fabtcg.com/en/cr/03-zones/, read 2026-11-07, verbatim):
     "If an object enters a zone that is not in the arena and is not the
      stack zone, or a public object becomes private while it is not in the
      arena, it resets - its previous existence ceases to exist and it
      becomes a new object with no relation to its previous existence."
   CR 1.15.3 (01-game-concepts/):
     "When an object ceases to exist, the counters on that object cease to
      exist."

   The counters bag is keyed by uid and a uid survives every zone move, so a
   Malefic Incantation bounced to hand kept its verse counters and re-entered
   ON TOP of them (its "enters with" put adds to the bag). `game.js
   resetLeavers` is the one body; `judge.stalemateCheck` runs it on every
   state both boards commit; `invariants.js` names a bag that slipped past.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const GM = require("../engine/game.js");
const I = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
const bag = (n, seat, uid) => (n.sides[seat].counters || {})[uid];

/* ---- the sweep, unit ------------------------------------------------ */

test("resetLeavers drops a bag for a card in every zone that resets it, and only those", () => {
  const c = uid => ({uid, name: "C" + uid});
  const side = o => Object.assign({deck: [], hand: [], pitch: [], grave: [], banish: [], soul: [],
                                   board: [], gear: [], arsenal: null, counters: {}}, o);
  const g = {sides: [
    side({hand: [c("h")], deck: [c("d")], pitch: [c("p")], grave: [c("g")], banish: [c("b")], soul: [c("s")],
          board: [{uid: "on", card: c("on"), kind: "aura"}], gear: [c("w")], arsenal: c("ar"),
          counters: {h: {verse: 2}, d: {x: 1}, p: {x: 1}, g: {x: 1}, b: {x: 1}, s: {x: 1},
                     on: {verse: 1}, w: {pow: 1}, ar: {aim: 1}, hero: {energy: 3}, chainCard: {aim: 1}}}),
    /* a stolen ally that died into its OWNER's graveyard: the thief's bag goes too */
    side({counters: {g2: {pow: 1}}})]};
  g.sides[0].grave.push(c("g2"));
  const out = GM.resetLeavers(g);
  assert.deepEqual(Object.keys(out.sides[0].counters).sort(), ["ar", "chainCard", "hero", "on", "w"],
    "hand, deck, pitch, graveyard, banished and soul reset (3.0.9); the arena, the arsenal, the hero and the chain keep theirs");
  assert.deepEqual(out.sides[1].counters, {}, "a bag keyed on the other seat's card is swept too");
  assert.equal(g.sides[0].counters.h.verse, 2, "the input state is not mutated");
  const clean = {sides: [side({board: [{uid: "on", card: c("on")}], counters: {on: {verse: 1}}}), side({})]};
  assert.equal(GM.resetLeavers(clean), clean, "nothing stale: the same object comes back (no needless copy)");
});

/* ---- the invariant -------------------------------------------------- */

test("invariants names a counters bag on a card outside the arena — and not one in it", () => {
  H.db();
  const n0 = H.state({name: "Viserai", hand: [mk("Malefic Incantation", 3, "mi1")]}, {name: "Them"},
                     {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  const stale = {...n0, sides: [{...n0.sides[0], counters: {mi1: {verse: 1}}}, n0.sides[1]]};
  const codes = g => I.check(g).map(v => v.code);
  assert.ok(codes(stale).includes("COUNTERS-OUTLIVE-CARD"), "a bag for a card in hand is an error");
  assert.ok(!codes(n0).includes("COUNTERS-OUTLIVE-CARD"), "no bag, no finding");
  const onBoard = {...n0, sides: [{...n0.sides[0], hand: [],
                   board: [{card: n0.sides[0].hand[0], kind: "aura", spent: false, uid: "mi1"}],
                   counters: {mi1: {verse: 1}, hero: {energy: 2}}}, n0.sides[1]]};
  assert.ok(!codes(onBoard).includes("COUNTERS-OUTLIVE-CARD"), "a bag on a permanent is its counters, not a finding");
  assert.ok(!codes(J.stalemateCheck(stale)).includes("COUNTERS-OUTLIVE-CARD"),
    "and the commit point both boards pass through clears it");
});

/* ---- driven, the table board --------------------------------------- */

test("DRIVEN: a Malefic Incantation that went back to hand re-enters with its printed counter, not stale ones", {skip}, () => {
  H.db();
  let n = H.state({name: "Viserai", res: 9, ap: 9,
                   hand: [mk("Malefic Incantation", 3, "mi1")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "mi1", from: "hand"}, 0).state;
  assert.equal((bag(n, 0, "mi1") || {}).verse, 1, "it enters with the one counter its p3 printing names");

  /* Pile two more on it, then BOUNCE it: the card moves to hand and the
     state is committed where both boards commit (the table's `reduce`, the
     trainer's `setG` — both end in `judge.stalemateCheck`). */
  n = {...n, sides: [{...n.sides[0], counters: {...n.sides[0].counters, mi1: {verse: 3}}}, n.sides[1]]};
  const ent = n.sides[0].board.find(b => b.uid === "mi1");
  n = J.stalemateCheck({...n, sides: [{...n.sides[0], board: n.sides[0].board.filter(b => b !== ent),
                                       hand: [ent.card, ...n.sides[0].hand]}, n.sides[1]]});
  assert.equal(bag(n, 0, "mi1"), undefined, "in hand it is a new object (CR 3.0.9): its counters ceased (CR 1.15.3)");
  assert.deepEqual(I.check(n).filter(v => v.code === "COUNTERS-OUTLIVE-CARD"), []);

  n = {...n, phase: "action", step: "layer", priority: 0, passed: [], chain: [], chainCards: [], pend: null,
       sides: [{...n.sides[0], res: 9, ap: 9}, n.sides[1]]};
  const r = J.reduce(n, {t: "play", uid: "mi1", from: "hand"}, 0);
  assert.equal(r.error, null, "it can be played again");
  assert.equal((bag(r.state, 0, "mi1") || {}).verse, 1,
    "it re-enters with ONE verse counter, as printed — not 3 + 1 carried over from its previous existence");
});

test("DRIVEN: the clock runs out and the card reaches the graveyard without its bag", {skip}, () => {
  H.db();
  let n = H.state({name: "Viserai", res: 9, ap: 9,
                   hand: [mk("Malefic Incantation", 3, "mi2"), mk("Brutal Assault", 1, "a2")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "mi2", from: "hand"}, 0).state;
  assert.ok(bag(n, 0, "mi2"), "it has a bag while it is a permanent");
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [], chain: [], chainCards: [], pend: null};
  n = J.reduce(n, {t: "play", uid: "a2", from: "hand"}, 0).state;
  assert.ok(n.sides[0].grave.some(c => c.uid === "mi2"), "it was destroyed into the graveyard");
  assert.equal(bag(n, 0, "mi2"), undefined, "and its counters ceased to exist with its old existence");
});

/* ---- the trainer half: its one commit point runs the same body ------ */

test("the trainer commits every state through judge.stalemateCheck, which runs resetLeavers", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const setG = updater => setGRaw\(s => \{\s*const n = withPriority\(DawnJudge\.stalemateCheck\(/,
    "the trainer's setG is where the sweep reaches the trainer board");
  assert.equal((html.match(/setGRaw\(/g) || []).length, 1, "and nothing else writes the trainer's state around it");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(src, /function stalemateCheck\(g\)\{[\s\S]{0,400}?g = GM\.resetLeavers\(g\);/,
    "stalemateCheck runs the sweep first");
});
