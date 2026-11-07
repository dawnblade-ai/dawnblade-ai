/* test/known.test.js — HIDDEN HANDS H2.4: the KNOWN SLOTS H1 left open
   (HIDDEN-HANDS.md §4.1). A card in a private zone that BOTH players saw
   stays face up in both views, and stops being face up the moment it goes
   stale (game.js KNOWN_MARKS; judge.clearKnown; engine/view.js):
     `_kt`  a known TOP   a public reveal of the top, a clash, Brain Freeze's hand-to-top
     `_kh`  known in HAND a hand reveal, a fusion reveal, a known top drawn
   Asserts on zones, marks and what each seat's view shows. Each drill's
   sabotage (the mark stripped, or the stale case) must show a placeholder. */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const V = require("../engine/view.js");
const G = require("../engine/game.js");

const C = (uid, name, pitch) => ({uid, name, pitch: pitch || 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [], tx: ""});
const deckOf = p => [C(p + "t", "Top Probe " + p), C(p + "2", "Second Probe " + p), C(p + "3", "Third Probe " + p), C(p + "4", "Fourth Probe " + p)];
const fresh = () => H.state(
  {name: "Gravy", deck: deckOf("a"), hand: [C("ah1", "Hand Probe A1"), C("ah2", "Hand Probe A2")]},
  {name: "Bob",   deck: deckOf("b"), hand: [C("bh1", "Hand Probe B1"), C("bh2", "Hand Probe B2"), C("bh3", "Hand Probe B3")]});
const shown = (g, seat, owner, zone, i) => { const c = V.view(g, seat).sides[owner][zone][i]; return V.isPh(c) ? null : c.uid; };
const put = (g, i, f) => ({...g, sides: g.sides.map((s, j) => j === i ? f(s) : s)});

test("KNOWN TOP — a public reveal of the top leaves it face up to BOTH seats; a look does not", () => {
  const g = fresh();
  const n = H.runOps(g, [["reveal", 1]], "Ravenous Rabble");
  assert.ok(n.sides[0].deck[0]._kt, "the revealed top is marked");
  assert.equal(shown(n, 1, 0, "deck", 0), "at", "the opponent sees the known top");
  assert.equal(shown(n, 1, 0, "deck", 1), null, "and nothing under it");
  assert.equal(V.view(n, 0).sides[0]._unordered[0], 1, "the owner's view: the top is known, the rest is composition");
  /* SABOTAGE: without the mark, the top is a placeholder again */
  const s = put(n, 0, sd => ({...sd, deck: sd.deck.map(G.unknown)}));
  assert.equal(shown(s, 1, 0, "deck", 0), null);
  /* a LOOK is private (H1): no mark, no face-up top */
  const l = H.runOps(g, [["reveal", 1, "look"]], "Compass of Sunken Depths");
  assert.ok(!l.sides[0].deck[0]._kt);
  assert.equal(shown(l, 1, 0, "deck", 0), null);
});

test("KNOWN TOP, DRAWN — a draw takes the top both seats saw, so it is KNOWN IN HAND; a search that takes it is not", () => {
  const n = H.runOps(fresh(), [["reveal", 1]], "Ravenous Rabble");
  const sd = n.sides[0];
  const drew = J.clearKnown(put(n, 0, s => ({...s, hand: [...s.hand, s.deck[0]], deck: s.deck.slice(1)})), n);
  const c = drew.sides[0].hand[2];
  assert.ok(c._kh && !c._kt, "the drawn known top is known in hand");
  assert.equal(shown(drew, 1, 0, "hand", 2), "at", "and the opponent sees it there");
  /* SABOTAGE / the private case: a search took it and the deck was reordered */
  const searched = J.clearKnown(put(n, 0, s => ({...s, hand: [...s.hand, s.deck[0]], deck: s.deck.slice(1).reverse()})), n);
  assert.ok(!searched.sides[0].hand[2]._kt && !searched.sides[0].hand[2]._kh, "no mark");
  assert.equal(shown(searched, 1, 0, "hand", 2), null, "a placeholder");
  void sd;
});

test("KNOWN TOP ENDS on a private reorder (opt) and when a card is put above it in private", () => {
  const n = H.runOps(fresh(), [["reveal", 1]], "Ravenous Rabble");
  const o = H.answerAll(J.openPrompt(H.runOps(n, [["opt", 2]], "Whisper of the Oracle")));
  assert.ok(o.sides[0].deck.every(c => !c._kt), "opt drops the mark");
  assert.equal(shown(o, 1, 0, "deck", 0), null, "the opponent no longer knows the top");
  /* a card put on top in private: the old known top is no longer the top */
  const above = J.clearKnown(put(n, 0, s => ({...s, hand: s.hand.slice(1), deck: [s.hand[0], ...s.deck]})), n);
  assert.ok(above.sides[0].deck.every(c => !c._kt), "the broken block loses the mark");
  assert.equal(shown(above, 1, 0, "deck", 1), null);
});

test("KNOWN IN HAND — a hand reveal leaves every card face up to the opponent until the hand changes in private", () => {
  const n = H.runOps(fresh(), [["foeReveal", 1]], "Brain Freeze");
  assert.deepEqual([0, 1, 2].map(i => shown(n, 0, 1, "hand", i)), ["bh1", "bh2", "bh3"], "the revealed hand stays shown");
  assert.equal(V.hiddenUids(n, 0).size, V.hiddenUids(fresh(), 0).size - 3, "three fewer hidden cards");
  /* a PUBLIC change (a card played to the graveyard): the rest stay known */
  const pub = J.clearKnown(put(n, 1, s => ({...s, hand: s.hand.slice(1), grave: [G.unknown(s.hand[0])]})), n);
  assert.deepEqual([0, 1].map(i => shown(pub, 0, 1, "hand", i)), ["bh2", "bh3"]);
  /* a PRIVATE change (a card face down into the arsenal): nobody knows which, so none stay known */
  const priv = J.clearKnown(put(n, 1, s => ({...s, hand: s.hand.slice(1), arsenal: s.hand[0]})), n);
  assert.deepEqual([0, 1].map(i => shown(priv, 0, 1, "hand", i)), [null, null], "the hand is hidden again");
  assert.ok(V.isPh(V.view(priv, 0).sides[1].arsenal), "and so is the arsenal card");
  /* intimidate's face-down banish is private too */
  const intim = J.clearKnown(put(n, 1, s => ({...s, hand: s.hand.slice(1), intimidated: [s.hand[0]]})), n);
  assert.deepEqual([0, 1].map(i => shown(intim, 0, 1, "hand", i)), [null, null]);
  /* SABOTAGE: the same reveal with no mark shows nothing */
  const s = put(n, 1, sd => ({...sd, hand: sd.hand.map(G.unknown)}));
  assert.equal(shown(s, 0, 1, "hand", 0), null);
});

test("BRAIN FREEZE — the chosen card goes on top as a KNOWN TOP, and the rest of the revealed hand stays known", () => {
  const n = H.answerAll(J.openPrompt(H.runOps(fresh(), [["foeReveal", 1], ["foePick", {zone: "hand", to: "deckTop"}]], "Brain Freeze")));
  const top = n.sides[1].deck[0];
  assert.ok(top._kt && !top._kh, "the card put on top is a known top");
  assert.equal(shown(n, 0, 1, "deck", 0), top.uid, "the opponent of its owner sees it there");
  assert.equal(n.sides[1].hand.length, 2);
  assert.deepEqual([0, 1].map(i => shown(n, 0, 1, "hand", i)), n.sides[1].hand.map(c => c.uid), "the move was public: the rest stay known");
});

test("FUSION — the revealed card stays in the hand, known to both", () => {
  /* the mark the fusion site writes, through clearKnown's rules: a known card stays known in an unchanged hand */
  const g = fresh();
  const n = put(g, 0, s => ({...s, hand: [G.markKnown(s.hand[0], "_kh"), s.hand[1]]}));
  const k = J.clearKnown(n, g);
  assert.equal(shown(k, 1, 0, "hand", 0), "ah1");
  assert.equal(shown(k, 1, 0, "hand", 1), null);
});
