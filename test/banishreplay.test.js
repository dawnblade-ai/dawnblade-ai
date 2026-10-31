/* ============================================================
   banishreplay.test.js — "YOU MAY PLAY IT THIS TURN" IS ONE PLAY (v5.42)

   QUEUE v4 S9. A card played from banish under a this-turn permission
   was filed back into banish with `_playTurn` (and `_asInstant`,
   `_banPow`, `_banCostOff`) intact, so `playZoneWhy` let it be played
   again, and again: on the trainer through `execute`, at the table
   through `fileAttack`. `parser.spendPlayGrant` is the one body both
   ask. WHERE the card goes is the user's ruling (2026-10-31): the
   GRAVEYARD like any card, turn-stamped, an ephemeral card ceasing to
   exist; the record `played-from-banish-files-to-banish` is closed.

   Every route is driven, and none goes through a policy: each card is
   played once, resolved, and then refused with a sentence.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P  = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const H  = require("./helpers/judged.js");
const J  = H.J;

const skip = !H.hasDb() && "no cached card database";
const REFUSED = /cannot be played from your banished zone/;
/* A LITERAL, never `P.PLAY_GRANT_STAMPS`: a drill that iterates the list
   under test cannot see a stamp dropped from it. */
const STAMPS = ["_playTurn", "_asInstant", "_banPow", "_banCostOff", "_drac"];

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
function settle(g){
  for(let i = 0; i < 40; i++){
    if(g.phase === "action" && g.step === "layer" && g.priority === 0 && !g.pend
       && !g.prompt && !(g.stack||[]).length) return g;
    g = H.move(g);
  }
  return g;
}
function playTwice(g, u, o){
  o = o || {};
  const PLAY = {t: "play", uid: u, from: "banish"};
  assert.equal(J.legal(g, PLAY, 0), null, "the first play is legal");
  const out = J.reduce(g, PLAY, 0);
  assert.equal(out.error, null);
  g = settle(out.state);
  assert.ok(!(g.sides[0].banish||[]).some(c => c.uid === u), "it is NOT filed back into banish");
  const gone = (g.sides[0].grave||[]).find(c => c.uid === u);
  if(o.ceases) assert.ok(!gone, "an ephemeral card ceases to exist");
  else {
    assert.ok(gone, "the card is in the graveyard");
    assert.equal(gone._gy, g.turn, "turn-stamped");
    STAMPS.forEach(k => assert.ok(!(k in gone), k + " was spent with the play"));
  }
  assert.ok(J.legal(g, PLAY, 0), "a second play is refused");
  return g;
}

test("Pouncing Paws: Crouching Tiger is played once, then refused", {skip}, () => {
  H.db();
  let g = H.state({res: 9, ap: 1, hand: []}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  g.builds = [{}, {}];
  g = H.runOps(g, [["mkBanish", "crouching tiger"]], "Pouncing Paws");
  const ct = g.sides[0].banish[0];
  assert.equal(ct.name, "Crouching Tiger", "the minted card wears the DATABASE's name");
  assert.equal(ct._playTurn, 3);
  g = playTwice(table(g), ct.uid, {ceases: true});
});

test("Blaze: a banished Snapback is played once at instant speed, then refused", {skip}, () => {
  H.db();
  const sb = {...H.card("Snapback", 1), uid: "sb1"};
  let g = H.state({res: 9, ap: 1, counters: {hero: {energy: 3}}, hand: [sb]}, {hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [{energyOnOpt: true}, {}]});
  g = H.runOps(g, [["pickPrompt", {zone: "hand", to: "banish",
    filter: {ty: ["wizard", "action"], type: "nonAttack", arcGe: 1},
    min: 0, max: 1, ctrSpend: "energy", playThisTurn: true, title: "Banish"}]], "Blaze — hero power");
  g.prompt = PM.promptToggleSel(PM.buildPrompt(g, g.promptQ[0]), 0);
  g.promptQ = [];
  g = H.fx(g, (f, n) => f.applyAnswer(n, n.prompt));
  g = {...g, prompt: null, promptQ: []};
  const ban = g.sides[0].banish.find(c => c.uid === "sb1");
  assert.ok(ban && ban._asInstant, "the speed grant landed");
  playTwice(table(g), "sb1");
});

for(const [nm, st] of [["Mounting Anger", {pow: 1, playThisTurn: true}],
                       ["Rising Resentment", {costOff: 1, playThisTurn: true}]]){
  test(nm + ": the banished attack is played once, then refused", {skip}, () => {
    H.db();
    const atk = {...H.card("Brutal Assault", 3), uid: "ba1"};
    let g = H.state({res: 9, ap: 1, hand: [atk]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
    g.builds = [{}, {}];
    g = H.runOps(g, [["pickPrompt", {zone: "hand", to: "banish", filter: {type: "attack"},
      min: 0, max: 1, banStamp: st, title: "Banish"}]], nm);
    g.prompt = PM.promptToggleSel(PM.buildPrompt(g, g.promptQ[0]), 0);
    g.promptQ = [];
    g = H.fx(g, (f, n) => f.applyAnswer(n, n.prompt));
    g = {...g, prompt: null, promptQ: []};
    const ban = g.sides[0].banish.find(c => c.uid === "ba1");
    assert.ok(ban && ban._playTurn === 3, "stamped playable this turn");
    assert.ok(st.pow ? ban._banPow === 1 : ban._banCostOff === 1, "the rider landed");
    playTwice(table(g), "ba1");
  });
}

test("the TRAINER path (execute) spends the grant too", {skip}, () => {
  H.db();
  const tx = {...H.card("Ice Bolt", 3), uid: "ib1", _playTurn: 3, _asInstant: true};
  let g = H.state({res: 9, ap: 1, banish: [tx]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  g.builds = [{}, {}];
  g = {...g, sides: [{...g.sides[0], banish: []}, g.sides[1]]};
  g = H.execute(g, tx, "banish");
  assert.ok(!g.sides[0].banish.some(c => c.uid === "ib1"), "not filed back to banish");
  const back = g.sides[0].grave.find(c => c.uid === "ib1");
  assert.ok(back && back._gy === 3, "filed to the graveyard, turn-stamped");
  STAMPS.forEach(k => assert.ok(!(k in back), k + " spent"));
  assert.equal(P.playableFromZone(back, "banish", {turn: 3}), false);
});

test("spendPlayGrant is a no-op copy-free on an unstamped card, and strips all five", () => {
  const plain = {name: "x"};
  assert.equal(P.spendPlayGrant(plain), plain);
  /* `_drac` joined at v5.53 — Fealty's "the next card you play is Draconic". */
  const s = P.spendPlayGrant({name: "x", _playTurn: 3, _asInstant: true, _banPow: 1, _banCostOff: 1, _drac: true, _gy: 2});
  assert.deepEqual(s, {name: "x", _gy: 2});
  assert.deepEqual([...P.PLAY_GRANT_STAMPS].sort(), [...STAMPS].sort());
});
