/* ============================================================
   A CARD THE NEXT TURN CANNOT SPEND IS FREE TO BLOCK WITH (QUEUE v4 H21)
   `takeUpTo` takes a hit of 3 or less to the face and keeps the card. That is
   right while the card has a use; a turn spends the play and the cards
   pitched for it (`maxPitch` + 1), so a hand bigger than that holds a card
   the next turn will not touch, and blocking with it costs nothing. Measured
   on each hero's own seat over 12 seeds (Bravo 8.1 -> 11.8, Blaze 7.6 -> 9.7,
   Gravy 4.2 -> 5.6, Enigma 10.2 -> 11.3, none down on average).

   H21b: the spare card has to stop the WHOLE hit. A block that leaves a leak
   is still a hit (its on-hit text fires) and buys `def` life for a card.
   Only Lyath did that (hand of five, defence 1-2: 42% of his spare blocks fell
   short; every other hero measured under 3%), so the rule moves nobody else.

   Driven on a real defend step, asserted on the action chosen, the reason
   key, and that `explain` returns the very action `act` does.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const P = require("../engine/priority.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
/* a plain defender: printed defence, no power, no cost */
const wall = (uid, def) => ({uid, name: "Wall " + uid, pitch: 3, cost: 0, power: null, def,
  tt: "Generic Action", ty: ["Generic", "Action"], kw: [], tx: ""});
const hand = (n, def) => Array.from({length: n}, (_, i) => wall("h" + (i + 1), def == null ? 3 : def));
/* seat 1 defends a swing of `total` with `cards` in hand */
function defend(cards, total, extra){
  const g = H.state({name: "Atk", res: 0, ap: 0, hand: [], deck: [wall("a1", 1)]},
    Object.assign({name: "Def", hp: 20, hand: cards, deck: [wall("d1", 1)]}, extra || {}),
    {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign({}, g, {phase: "action", step: "defend", attacker: 0, priority: 0, chainOpen: true, passed: [],
    pend: {name: "Pinprick", by: 0, total, target: {kind: "hero", side: 1, uid: null}}});
}
const said = g => SP.explain(g, 1);

test("H21: a hand of four blocks a small hit with the card it can spare", {skip}, () => {
  const g = defend(hand(4), 2);
  assert.ok(P.canDeclareDefenders(g, 1), "control: seat 1 may declare defenders");
  const x = said(g);
  assert.equal(x.action && x.action.t, "defend", "blocked: " + JSON.stringify(x.action));
  assert.equal(x.key, "blockSpare", "under its own reason");
  assert.ok(SP.CALL_WHY.blockSpare && x.why === SP.CALL_WHY.blockSpare, "and the call says why");
  assert.deepEqual(x.action, SP.act(g, 1), "explain returns the action act proposes");
  assert.equal(J.legal(g, x.action, 1), null, "the judge accepts it");
});

test("H21: a hand of three keeps its cards and takes the same hit", {skip}, () => {
  const g = defend(hand(3), 2);
  assert.equal(SP.act(g, 1), null, "a card with a use next turn is not spent on 2 damage");
  assert.equal(said(g).action, null);
  assert.equal(SP.nextBlocker(g, 1, SP.DEFAULTS), null);
});

test("H21: the line follows maxPitch, not a number written twice", {skip}, () => {
  const g = defend(hand(3), 2);
  assert.equal(SP.nextBlocker(g, 1, {...SP.DEFAULTS, maxPitch: 1}) && "blocked", "blocked",
    "with a shorter pitch limit a turn spends fewer cards, so a hand of three has one to spare");
  assert.equal(SP.nextBlocker(defend(hand(4), 2), 1, {...SP.DEFAULTS, maxPitch: 3}), null,
    "with a longer one a hand of four has none");
});

test("H21: a card already declared is not spare twice", {skip}, () => {
  /* hand of four, one defender of 1 already declared: 3 free cards remain,
     which is the line, and 3 damage against a wall of 1 still leaks 2 */
  const cards = [wall("h1", 1), ...hand(3).map((c, i) => ({...c, uid: "x" + i}))];
  const g = defend(cards, 3, {blockH: ["h1"]});
  assert.equal(SP.nextBlocker(g, 1, SP.DEFAULTS), null, "the declared card does not count as a card to spare");
  /* control: undeclared, the same hand does block */
  const c = defend(cards, 3);
  assert.ok(SP.nextBlocker(c, 1, SP.DEFAULTS), "control: with nothing declared the fourth card is spare");
});

test("H21: the hand-blocker cap still holds", {skip}, () => {
  /* two defence-1 cards declared stop 2 of 3, so 1 still leaks and the four
     free defence-2 cards each stop it whole. Only the cap stands between
     them and a third block. */
  const cards = [wall("h1", 1), wall("h2", 1), ...hand(4, 2).map((c, i) => ({...c, uid: "x" + i}))];
  const g = defend(cards, 3, {blockH: ["h1", "h2"]});
  assert.equal(SP.nextBlocker(g, 1, SP.DEFAULTS), null, "two declared is the cap, whatever is spare");
  const one = defend(cards, 3, {blockH: ["h1"]});
  assert.ok(SP.nextBlocker(one, 1, SP.DEFAULTS), "control: with one declared a third card is still allowed");
});

test("H21b: a spare card that would leave a leak is not spent", {skip}, () => {
  /* five cards of defence 1 against 3: the best card stops 1 and the hit
     still lands for 2, with its on-hit text. A card for 1 life is no bargain. */
  const g = defend(hand(5, 1), 3);
  assert.equal(SP.nextBlocker(g, 1, SP.DEFAULTS), null);
  assert.equal(SP.act(g, 1), null);
  assert.equal(said(g).action, null);
  /* control: the same hand against a hit its card stops whole is spent */
  const whole = defend(hand(5, 1), 1);
  assert.equal(said(whole).key, "blockSpare", "defence 1 stops a 1-damage hit");
  /* and a mixed hand spends the card that does stop it, not the one that does not */
  const mixed = defend([wall("lo", 1), wall("hi", 3), wall("m1", 1), wall("m2", 1)], 3);
  const x = said(mixed);
  assert.equal(x.key, "blockSpare");
  assert.equal(x.action.uid, "hi");
});

test("H21b: a big hit still takes the best cards it can, whole stop or not", {skip}, () => {
  /* leak over `takeUpTo` is blockHand's: partial blocks there are the old, tuned behaviour */
  const g = defend(hand(5, 1), 6);
  assert.equal(said(g).key, "blockHand");
});

test("H21: nothing that can block means no block, and no refusal", {skip}, () => {
  const g = defend(hand(4, 0), 2);
  assert.equal(SP.nextBlocker(g, 1, SP.DEFAULTS), null);
  assert.equal(SP.act(g, 1), null);
});

test("H21: a big hit keeps its own reason, spare or not", {skip}, () => {
  for(const n of [3, 4]){
    const g = defend(hand(n), 7);
    assert.equal(said(g).key, "blockHand", "a 7-power swing is 'too big to take', not 'spare', with " + n + " cards");
  }
});

test("H21: lethal is still blocked with everything, under its own reason", {skip}, () => {
  const g = defend(hand(3), 2, {hp: 2});
  const x = said(g);
  assert.equal(x.key, "blockLethal");
  assert.deepEqual(x.action, SP.act(g, 1));
});

test("H21: self-play fires it, and the judge never refuses it", {skip}, () => {
  /* a real policy-vs-policy game: the key census must show the rule, and
     no action the policy proposes may be refused */
  const {match} = require("../tools/selfplay.js");
  let fired = 0, refused = 0;
  for(const [a, b, seed] of [["bravo", "dorinthea", "bravo-dorinthea-0"], ["gravy", "briar", "gravy-briar-1"]]){
    let g = match(a, b, seed, 0);
    for(let i = 0; i < 1500 && !g.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const x = SP.explain(g, s);
        if(!x.action) continue;
        if(x.key === "blockSpare") fired++;
        const r = J.reduce(g, x.action, s);
        if(r.error){ refused++; continue; }
        g = r.state; moved = true;
      }
      if(!moved) break;
    }
  }
  assert.equal(refused, 0, "the judge refused a proposal");
  assert.ok(fired > 0, "no spare-card block in two whole games");
});
