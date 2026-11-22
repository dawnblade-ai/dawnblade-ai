/* ============================================================
   THE CARD A DISCARD COST NAMED IS NOT PITCHED (v6.64)

   `legal` refuses pitching the card declared for a discard cost (v4.87,
   "that card is already spent on the discard"). The policy's payment never
   offered it until an Ice Eternal for 5 put five Frostbites on Gravy: Carrion
   Crown's free draw ("Discard an ally, destroy this: Draw a card") then cost 5,
   Gravy named Cutty Shark, Quick Clip for the discard, and `pitchPick` reached
   for Cutty Shark (pitch 2) before Barnacle (pitch 2, more power) — a policy
   refusal on the ladder (iyslander-gravy-19). The payment passes over it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H  = require("./helpers/judged.js");
const J  = require("../engine/judge.js");
const SP = require("../engine/sparring.js");

const skip = !H.hasDb() && "no cached DB";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});

test("the payment pitches around the card the discard cost named", {skip}, () => {
  H.db();
  const hand = [c("Murderous Rabble", 3, 91), c("Cutty Shark, Quick Clip", 2, 67), c("Barnacle", 2, 65)];
  const crown = {name: "Carrion Crown — ability", pitch: 0, cost: 0, tt: "Equipment Ability", uid: "gp103"};
  const base = {...H.state({hand, res: 0, paySel: [91]}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
    phase: "action", step: "layer", priority: 0, passed: [false, false], stack: [], chain: [], chainCards: [],
    pending: {kind: "pay", seat: 0, card: crown, from: "hero", need: 5, target: null}};
  const g = {...base, _discCostUid: 67};
  const x = SP.act(g, 0);
  assert.equal(J.legal(g, x, 0), null, "the policy's proposal is refused: " + JSON.stringify(x) + " — " + J.legal(g, x, 0));
  assert.deepEqual(x, {t: "paySel", uid: 65}, "Barnacle pays the rest");
  /* the fixture bites: with no discard named, the same payment takes Cutty Shark */
  assert.deepEqual(SP.act(base, 0), {t: "paySel", uid: 67}, "fixture: Cutty Shark is the pitch the discard has to forbid");
});
