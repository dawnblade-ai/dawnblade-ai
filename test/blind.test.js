/* test/blind.test.js — BOTH PHONES BLIND: the check tools/twophone.js runs in
   real pages (test/helpers/blind.js), pinned here (HIDDEN HANDS H3).

   Found by the CEO's three-page judge drive (v6.09): a phone's view of the
   other seat's deck held a face-up card with no _kb/_kt mark while the views
   still agreed. It was v6.08's Scout the Periphery: a look at the OPPONENT's
   deck (`revealed = {..top, _to: looker, _from: owner}`, effects.js) shows
   that top card to the looker, and only the looker, while it stays on top
   (view.js `slots`, "looked"; judge.clearKnown forgets it when that deck
   changes). A LEGITIMATE grant — the old check simply did not know it.
   These drills drive the real look and ask the check for the grant, the
   refusal, and the other seat's blindness; each has its sabotage. */
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../engine/view.js");
const R = require("../engine/referee.js");
const H = require("./helpers/judged.js");
const {blind} = require("./helpers/blind.js");
const J = H.J;
const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
const check = (g, seat) => blind(R.seatView(g, seat), seat, null, V.isPh);

/* seat 0 plays Scout the Periphery and looks at seat 1's deck (scout.test.js's fixture) */
function looked(){
  H.db();
  let n = H.state({name: "Fai", res: 9, ap: 9, hand: [mk("Scout the Periphery", 1, "sp1")],
                   deck: [{uid: "mine1", name: "Mine One", pitch: 1}, {uid: "mine2", name: "Mine Two", pitch: 2}]},
                  {name: "Them", deck: [{uid: "theirs1", name: "Theirs One", pitch: 3}, {uid: "theirs2", name: "Theirs Two", pitch: 1}],
                   hand: [{uid: "th1", name: "Their Hand", pitch: 1}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "sp1", from: "hand"}, 0).state;
  n = J.reduce(n, {t: "promptChoose", choice: 0}, 0).state;     /* target the opposing hero */
  return J.reduce(n, {t: "promptConfirm"}, 0).state;
}

test("THE LOOK IS A GRANT — the looker sees the other seat's top card, unmarked, and the check names it a look", {skip}, () => {
  const n = looked();
  assert.equal(n.revealed && n.revealed._from, 1, "the look read seat 1's deck");
  const v = R.seatView(n, 0);
  assert.equal(v.sides[1].deck[0].name, "Theirs One", "face up to the looker");
  assert.ok(!v.sides[1].deck[0]._kt && !v.sides[1].deck[0]._kb, "with no known mark: the old check's blind spot");
  const b = check(n, 0);
  assert.ok(b.ok, b.bad.join("; "));
  assert.deepEqual(b.grants, ["deck[0] Theirs One [look]"]);
});

test("…and ONLY the looker: the looked-at seat sees nothing new, and is blind", {skip}, () => {
  const n = looked();
  const v = R.seatView(n, 1);
  assert.equal(v.revealed, null, "the other seat is not shown the look");
  assert.ok(check(n, 1).ok);
});

test("SABOTAGE — the same face-up card without the look's stamp is a LEAK; so is a look stamped for the other deck", {skip}, () => {
  const n = looked();
  const v = R.seatView(n, 0);
  const noFrom = {...v, revealed: {...v.revealed, _from: undefined}};
  assert.equal(blind(noFrom, 0, null, V.isPh).ok, false, "a face-up foe deck card with no grant fails");
  const ownDeck = {...v, revealed: {...v.revealed, _from: 0}};
  assert.equal(blind(ownDeck, 0, null, V.isPh).ok, false, "a look at one's own deck grants nothing in the other's");
  const second = {...v, sides: v.sides.map((sd, i) => i !== 1 ? sd : {...sd, deck: [sd.deck[1], sd.deck[0], ...sd.deck.slice(2)]})};
  assert.equal(blind(second, 0, null, V.isPh).ok, false, "the look grants deck[0] only");
  assert.equal(blind({...v, rng: {seed: 1}}, 0, null, V.isPh).ok, false, "a shown rng fails");
  assert.equal(blind(v, 0, {sides: []}, V.isPh).ok, false, "holding the full state fails");
});

test("THE LOOK ENDS WHEN THE DECK MOVES — once that top card is gone, the looker's view hides the new top", {skip}, () => {
  const n0 = looked();
  /* the looked-at card leaves the top (drawn): the stale look must not show the next card */
  const n = {...n0, sides: n0.sides.map((sd, i) => i !== 1 ? sd : {...sd, deck: sd.deck.slice(1), hand: [...sd.hand, sd.deck[0]]})};
  const v = R.seatView(n, 0);
  assert.ok(V.isPh(v.sides[1].deck[0]), "the new top card is face down to the looker");
  assert.ok(check(n, 0).ok);
});
