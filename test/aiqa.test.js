/* ======================================================================
   THE v5.85 QA SWEEP'S AI MISPLAYS, EACH IN ITS POSITION

   The QA readers (findings/qa-a, findings/qa-b, section H) found these in
   self-play. Each section below is one cause and one fix:

   1. A CARD PLAYABLE FROM BANISHMENT WAS NEVER OFFERED (QA-B H-1). Pouncing
      Paws makes a Crouching Tiger "you may play this turn" in the banished
      zone. No candidate list in sparring.js looked there, so Fai destroyed
      two pieces of equipment for a go-again attack and then ended the turn
      with it legal and the action point unspent - and the call said
      "Nothing worth doing is left".

   2. A RESOURCE PIECE WAS NEVER SPENT FOR A WEAPON SWING (QA-A H-2).
      v5.56's unlock spends Blossom of Spring when its {r} makes a held
      ATTACK CARD playable, and asked only the hand, the arsenal and the
      allies. Dorinthea passed at an action point with Blossom and an
      unswung Dawnblade at a 4-life Arakni, and died the next turn.

   DRIVEN through `sparring.act`, `judge.legal` and `judge.reduce`, with the
   sabotage (the old behaviour) asked beside every new answer.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, H.card(n, p), {uid});
const piece = (n, uid) => { const g = ent(n, 0, uid); P.fxReset(); B.equipPiece(g); P.fxReset(); return g; };
const atLayer = g => Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
const settle = g => { for(let i = 0; i < 40 && (g.pend || g.prompt || (g.stack || []).length || g.step !== "layer" || g.priority !== 0); i++) g = H.move(g); return g; };

/* ---- 1. the banished Tiger ------------------------------------------ */
function tigerTurn(){
  H.db();
  let g = H.state({name: "Fai", res: 0, ap: 1, hand: [], gear: []}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3});
  g.builds = [{}, {}];
  g = H.runOps(g, [["mkBanish", "crouching tiger"]], "Pouncing Paws");
  return atLayer(g);
}

test("a Crouching Tiger playable from banishment is played, not passed on", {skip}, () => {
  const g = tigerTurn(), tiger = g.sides[0].banish[0];
  const play = {t: "play", uid: tiger.uid, from: "banish"};
  assert.equal(J.legal(g, play, 0), null, "control: the judge lets the Tiger be played this turn");
  for(const search of [false, true]){
    const x = SP.explain(g, 0, {search});
    assert.equal(x.action && x.action.t, "play", (search ? "Sharp" : "Steady") + ": " + JSON.stringify(x.action));
    assert.equal(x.action.uid, tiger.uid);
    assert.equal(x.action.from, "banish");
    assert.notEqual(x.key, "endTurn", "the call no longer says nothing is left");
  }
  const n = settle(J.reduce(g, SP.act(g, 0), 0).state);
  assert.ok(!(n.sides[0].banish || []).some(c => c.uid === tiger.uid), "the Tiger left the banished zone");
  assert.equal(n.sides[0].ap, 1, "and it went again");
  /* sabotage: a Tiger the judge refuses (no longer playable this turn) is not offered */
  const stale = {...g, sides: [{...g.sides[0], banish: [{...tiger, _playTurn: g.turn - 2}]}, g.sides[1]]};
  assert.notEqual(J.legal(stale, play, 0), null, "control: a Tiger from an earlier turn is refused");
  for(const search of [false, true]) assert.notEqual((SP.act(stale, 0, {search}) || {}).from, "banish", "a refused banished card is not proposed");
});

/* ---- 2. Blossom pays for the Dawnblade swing -------------------------- */
function bladeTurn(gear){
  const g = H.state({name: "Dorinthea", gear, hand: [], arsenal: null, res: 0, ap: 1},
    {hp: 4, hand: []}, {actor: 0, turnPlayer: 0, turn: 5});
  return atLayer(g);
}
const SWING = {t: "activate", uid: 42}, BLOSSOM = {t: "activate", uid: 41};

test("Blossom of Spring is spent when its resource pays for a weapon swing, under its own reason", {skip}, () => {
  let g = bladeTurn([piece("Blossom of Spring", 41), piece("Dawnblade", 42)]);
  assert.notEqual(J.legal(g, SWING, 0), null, "control: the Dawnblade costs {r} the seat cannot raise yet");
  assert.equal(J.legal(g, BLOSSOM, 0), null, "control: Blossom is legal");
  const x = SP.explain(g, 0, {search: false});
  assert.deepEqual(x.action, BLOSSOM, "spends the piece: " + JSON.stringify(x.action));
  assert.equal(x.key, "resUnlockWeapon");
  assert.match(x.why, /weapon/);
  g = settle(J.reduce(g, x.action, 0).state);
  assert.equal(g.sides[0].res, 1, "Blossom paid its resource");
  assert.equal(g.sides[0].ap, 1, "and kept the action point");
  assert.deepEqual(SP.act(g, 0, {search: false}), SWING, "then the Dawnblade swings");
});

test("H11 stays: with no weapon to pay for, Blossom is held", {skip}, () => {
  const g = bladeTurn([piece("Blossom of Spring", 41)]);
  assert.equal(J.legal(g, BLOSSOM, 0), null, "control: Blossom is legal");
  assert.notDeepEqual(SP.act(g, 0, {search: false}), BLOSSOM, "nothing waits on the resource");
});
