/* ============================================================
   THE LOOKAHEAD READS NO HIDDEN CARD (research/lookahead, phase 1).

   `sparring.act` can overrule its own rule policy by playing candidate
   actions out through `judge.reduce` (gated per hero key in `LA.seats`,
   empty on main). The search must decide from what the seat may KNOW: so a
   state where the opponent's hand, face-down arsenal and deck order, the
   seat's own deck order and the game's rng are all changed must get the
   SAME action and the same reason.

   The states are real self-play positions, and only ones where the search
   actually OVERRULED the rule policy count — a position where it agrees
   with the rules would pass this drill without proving anything.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const {match} = require("../tools/selfplay.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const RNG = require("../engine/rng.js");

const gate = keys => { SP.LA.seats.length = 0; keys.forEach(k => SP.LA.seats.push(k)); };

/* The hidden half of a state, changed: one opponent hand card swapped with a
   deck card of another name, the hidden arsenal (if any) swapped with a deck
   card, both decks reversed, a fresh game rng. Uids travel with their cards. */
function scramble(g, seat){
  const op = 1 - seat, sides = g.sides.slice(), o = {...sides[op]};
  const hand = o.hand.slice(), deck = o.deck.slice();
  const i = 0, j = deck.findIndex(c => c.name !== (hand[i] && hand[i].name));
  if(hand.length && j >= 0){ const t = hand[i]; hand[i] = deck[j]; deck[j] = t; }
  if(o.arsenal && !o.arsenal._faceUp && deck.length){
    const k = deck.findIndex(c => c.name !== o.arsenal.name);
    if(k >= 0){ const t = o.arsenal; o.arsenal = deck[k]; deck[k] = t; }
  }
  o.hand = hand; o.deck = deck.reverse();
  sides[op] = o;
  sides[seat] = {...sides[seat], deck: sides[seat].deck.slice().reverse()};
  return {...g, sides, rng: RNG.make("scrambled")};
}
/* the hidden half really moved: otherwise the comparison below is vacuous */
const hiddenKey = (g, seat) => JSON.stringify([g.sides[1 - seat].hand.map(c => c.uid), g.sides[1 - seat].deck.map(c => c.uid),
  g.sides[seat].deck.map(c => c.uid), g.rng]);

/* Self-play with the gate on for seat 0's hero, collecting positions where
   seat 0's search overruled the rules. */
function overrules(k0, k1, seed, want){
  gate([k0]);
  const found = [];
  let g = match(k0, k1, seed, 0);
  for(let i = 0; i < 3000 && !g.over && found.length < want; i++){
    let moved = false;
    for(const s of [0, 1]){
      const x = s === 0 ? SP.explain(g, s) : {action: SP.act(g, s)};
      if(!x.action) continue;
      if(s === 0 && /^la[A-Z]/.test(x.key || "")) found.push({g, x, k0});
      const out = J.reduce(g, x.action, s);
      if(out.error) continue;
      g = out.state; moved = true; break;
    }
    if(!moved) break;
  }
  return found;
}

test("the search's choice is the same when the opponent's hidden cards and both deck orders are swapped", () => {
  const pts = [].concat(overrules("briar", "kayo", "la-hid-1", 4), overrules("dash", "azalea", "la-hid-2", 4),
                        overrules("bravo", "fai", "la-hid-3", 4));
  try {
    assert.ok(pts.length >= 6, "the search overruled the rules in " + pts.length + " positions");
    for(const {g, x, k0} of pts){
      gate([k0]);
      const h = scramble(g, 0);
      assert.notEqual(hiddenKey(h, 0), hiddenKey(g, 0), "the scramble moved the hidden cards");
      const y = SP.explain(h, 0);
      assert.deepEqual(y.action, x.action, "same action at turn " + g.turn);
      assert.equal(y.key, x.key, "same reason");
    }
  } finally { gate([]); }
});

test("the search never runs the real state: a scrambled root masks to the same position", () => {
  const g = match("kayo", "boltyn", "la-mask", 0);
  const a = SP.laMask(g, 0, 0), b = SP.laMask(scramble(g, 0), 0, 0);
  const view = m => JSON.stringify([m.sides[1].hand.map(c => c.uid), m.sides[1].deck.map(c => c.uid),
                                    m.sides[0].deck.map(c => c.uid), m.rng]);
  assert.equal(view(a), view(b));
  /* and the masked deal is not the real one (the mask is not the identity) */
  assert.notEqual(JSON.stringify(a.sides[1].hand.map(c => c.uid)) + JSON.stringify(a.sides[1].deck.map(c => c.uid)),
                  JSON.stringify(g.sides[1].hand.map(c => c.uid)) + JSON.stringify(g.sides[1].deck.map(c => c.uid)));
});

test("gate off (main): act is the rule policy, move for move", () => {
  gate([]);
  let g = match("gravy", "lyath", "la-off", 1);
  for(let i = 0; i < 400 && !g.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(g, s);
      assert.deepEqual(a, SP.actBase(g, s));
      if(!a) continue;
      const out = J.reduce(g, a, s);
      if(out.error) continue;
      g = out.state; moved = true; break;
    }
    if(!moved) break;
  }
});
