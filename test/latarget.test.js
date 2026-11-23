/* ============================================================
   SHARP WEIGHS EVERY ATTACK TARGET (SPXLATGT, v6.79)

   An attack's target is declared as it is played (CR 1.4.5). The rule
   policy's `targetFor` names one target, and the search used to propose
   only that one. Now every attack from hand or arsenal is also proposed
   at the hero and at each of the opponent's allies, so the search can
   weigh hitting the hero against hitting an ally it cannot kill.

   The drill asks for both sides of it: with an ally out, the same card is
   a candidate at the hero AND at the ally; with no ally, it is proposed
   once. With the gate off (SPXLATGT=none, read at load) only the rule's
   pick is proposed, so this file pins the gate's default as ON.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";
const SPP = () => require("../tools/selfplay.js");
const SP = require("../engine/sparring.js");

const side = (g, i, o) => ({...g, sides: g.sides.map((s, k) => k === i ? {...s, ...o} : s)});

test("an attack is proposed at the hero and at an ally it cannot kill — and once, with no ally out", {skip}, () => {
  const {match} = SPP();
  let g = match("kayo", "gravy", "latgt", 0);
  const atk = g.sides[0].hand.find(c => +c.power > 0);
  assert.ok(atk, "fixture: an attack in hand");
  g = side(g, 0, {hand: [atk], arsenal: null, res: 10});
  const plays = gg => SP.laCands(gg, 0, null).filter(a => a.t === "play" && a.uid === atk.uid).map(a => a.target).sort();

  assert.deepEqual(plays(g), ["hero"], "no ally: one declaration, at the hero");

  /* an ally the swing cannot kill (life above its power): the rule picks the hero */
  const ally = {card: {...H.card("Swabbie", 0), uid: "ALT1", life: 99}, kind: "ally", uid: "ALT1", life: 99};
  assert.ok(require("../engine/game").isAlly(ally), "fixture: a real ally entry");
  g = side(g, 1, {board: [ally]});
  assert.deepEqual(plays(g), ["ALT1", "hero"], "an ally out: the hero AND the ally are both weighed");
});
