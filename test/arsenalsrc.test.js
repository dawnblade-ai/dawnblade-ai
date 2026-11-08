/* ============================================================
   NO CARD MOVES A PERMANENT FROM THE ARENA INTO AN ARSENAL (S-item close-out)

   CR 3.0.9 (rules.fabtcg.com/en/cr/03-zones/, verbatim): "If an object enters a zone that
   is not in the arena and is not the stack zone, or a public object becomes private while
   it is not in the arena, it resets - its previous existence ceases to exist and it becomes
   a new object with no relation to its previous existence." CR 3.1.1a: "The arsenal,
   banished, deck, graveyard, hand, pitch, and stack zones are not part of the arena."

   `game.js resetLeavers` clears counters on every reset zone but the arsenal (Crow's Nest
   puts an aim counter on a card already there, and a sweep cannot tell that from a counter
   carried in). That is sound only while no card moves an arena card into an arsenal. This
   drill reads every clause of the pinned pool with `parser.arsenalPutSource` and fails the
   day one does, and `invariants.js` names a non-aim bag on an arsenal card.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const I = require("../engine/invariants.js");
const pool = require("../data/pool.js");

const clauses = r => String(r.functional_text || "").split(/(?<=\.)\s+|\n+/);

test("every pinned-pool clause that puts a card into an arsenal takes it from the hand or the deck", () => {
  const seen = {}, bad = [];
  for(const r of pool) for(const cl of clauses(r)){
    const v = P.arsenalPutSource(cl);
    if(!v) continue;
    (seen[v] = seen[v] || new Set()).add(r.name);
    if(v !== "hand" && v !== "deck") bad.push(r.name + " :: " + cl.trim());
  }
  assert.deepEqual(bad, [], "a card now moves something into an arsenal from the arena (or from somewhere unread): build the route, and sweep its counters (CR 3.0.9)");
  assert.ok((seen.hand || new Set()).size >= 3 && (seen.deck || new Set()).size >= 2,
    "the reader still finds the known puts (Bull's Eye Bracers, Death Dealer, Call in the Big Guns; Azalea, Concoct Disorder)");
});

test("the reader: arena, hand, deck, a trigger on a put, and a clause that puts nothing", () => {
  assert.equal(P.arsenalPutSource("Return target aura you control to your arsenal."), "arena");
  assert.equal(P.arsenalPutSource("Put an item you control face-down into your arsenal."), "arena");
  assert.equal(P.arsenalPutSource("You may put an arrow from your hand face-up into your arsenal."), "hand");
  assert.equal(P.arsenalPutSource("Put the top card of your deck face-up into your arsenal."), "deck");
  assert.equal(P.arsenalPutSource("When this is put face-up into your arsenal, it gets go again this turn."), null);
  assert.equal(P.arsenalPutSource("Put a card from somewhere into your arsenal."), "unknown");
  assert.equal(P.arsenalPutSource("Draw a card."), null);
});

test("invariants: an arsenal card carrying a non-aim counter bag is an error; an aim counter is not", () => {
  const side = o => Object.assign({deck: [], hand: [], pitch: [], grave: [], banish: [], soul: [], board: [], gear: [],
                                   arsenal: null, counters: {}}, o);
  const arrow = {uid: "ar1", name: "Arrow"};
  const codes = g => I.check(g).map(v => v.code);
  const g = c => ({sides: [side({arsenal: arrow, counters: {ar1: c}}), side({})]});
  assert.ok(codes(g({verse: 2})).includes("COUNTERS-INTO-ARSENAL"));
  assert.ok(!codes(g({aim: 1})).includes("COUNTERS-INTO-ARSENAL"), "Crow's Nest's aim counter belongs there");
});
