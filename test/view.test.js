/* test/view.test.js — HIDDEN HANDS spike: `view(state, seat)` (engine/view.js).
   Asserts on zones and uids only. HIDDEN-HANDS.md is the design. */
const test = require("node:test");
const assert = require("node:assert/strict");
const {match} = require("../tools/selfplay.js");
const V = require("../engine/view.js");

const uids = arr => (arr || []).map(c => c && c.uid);
const hiddenCard = c => !!(c && c.hidden && /^\?/.test(String(c.uid)));

/* CR 3.0.4b "The arsenal, deck, and hand zones are private zones." */
test("CR 3.0.4b — the foe's hand, face-down arsenal and BOTH decks are placeholders; the seat's own hand is kept", () => {
  const g = match("kayo", "boltyn", "view-1", 0);
  const o = g.sides[1];
  const arsCard = o.hand[0];
  const g2 = {...g, sides: [g.sides[0], {...o, hand: o.hand.slice(1), arsenal: arsCard}]};
  const v = V.view(g2, 0);
  assert.equal(v.sides[1].hand.length, g2.sides[1].hand.length, "hand size is public");
  assert.ok(v.sides[1].hand.every(hiddenCard), "every foe hand card is hidden");
  assert.ok(hiddenCard(v.sides[1].arsenal), "a face-down arsenal card is hidden");
  assert.equal(v.sides[1].deck.length, o.deck.length, "deck size is public");
  assert.ok(v.sides[1].deck.every(hiddenCard) && v.sides[0].deck.every(hiddenCard), "no seat sees a deck order, its own included");
  assert.deepEqual(uids(v.sides[0].hand), uids(g2.sides[0].hand), "the seat's own hand is its own");
  assert.notDeepEqual(v.rng, g2.rng, "the seed is every future draw: withheld");
  /* no real hidden uid survives anywhere in the view (a real uid is a decklist index) */
  const blob = JSON.stringify(v.sides);
  for(const u of V.hiddenUids(g2, 0).keys()) assert.ok(blob.indexOf('"uid":' + u + ',') < 0, "uid " + u + " leaked");
  /* a face-UP arsenal card is public */
  const g3 = {...g2, sides: [g2.sides[0], {...g2.sides[1], arsenal: {...arsCard, _faceUp: true}}]};
  assert.equal(V.view(g3, 0).sides[1].arsenal.uid, arsCard.uid);
});

test("CR 3.0.4b — swapping hidden cards for other hidden cards leaves the view unchanged (the scramble)", () => {
  const g = match("dash", "azalea", "view-2", 1);
  const o = g.sides[1], me = g.sides[0];
  const pool = o.hand.concat(o.deck).reverse();
  const h = {...g, rng: {seed: 1, s: 2, n: 3},
    sides: [{...me, deck: me.deck.slice().reverse()}, {...o, hand: pool.slice(0, o.hand.length), deck: pool.slice(o.hand.length)}]};
  assert.notDeepEqual(uids(h.sides[1].hand), uids(o.hand), "the scramble moved the foe's hand");
  assert.equal(JSON.stringify(V.view(h, 0)), JSON.stringify(V.view(g, 0)));
});

/* CR 3.0.4a "The arms, banished, chest, combat chain, graveyard, head, hero, legs,
   permanent, pitch, stack, and weapon zones are public zones." judge.js keeps a
   declared defender in the hand (`blockH`) and a card picked to pitch (`paySel`). */
test("CR 3.0.4a — a declared defender and a card picked to pitch are public, though judge keeps them in the hand", () => {
  const g = match("bravo", "kayo", "view-3", 0);
  const o = g.sides[1], [d, p] = o.hand;
  const v = V.view({...g, sides: [g.sides[0], {...o, blockH: [d.uid], paySel: [p.uid]}]}, 0);
  assert.deepEqual(uids(v.sides[1].hand).slice(0, 2), [d.uid, p.uid]);
  assert.ok(v.sides[1].hand.slice(2).every(hiddenCard), "the rest of the hand stays hidden");
});

/* CR 3.0.4c "A public zone may contain a private object, if the object is made
   private while in that zone, or if the object is moved into that zone as a
   private object." Intimidate banishes face-down (CR 8.5.10). */
test("CR 3.0.4c — an intimidated (face-down banished) card is hidden from the other seat", () => {
  const g = match("lyath", "kayo", "view-4", 0);
  const o = g.sides[1], c = o.hand[0];
  const g2 = {...g, sides: [g.sides[0], {...o, hand: o.hand.slice(1), intimidated: [c]}]};
  assert.ok(hiddenCard(V.view(g2, 0).sides[1].intimidated[0]));
  assert.ok(V.hiddenUids(g2, 0).has(String(c.uid)));
  /* REVEAL puts the real card back at its slot: the unit a commit would carry */
  const r = V.hiddenUids(g2, 0).get(String(c.uid));
  assert.equal(V.reveal(V.view(g2, 0), r).sides[1].intimidated[0].uid, c.uid);
});
