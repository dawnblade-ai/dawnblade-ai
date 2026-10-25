/* ============================================================
   banishreplay.test.js — "YOU MAY PLAY IT THIS TURN" IS ONE PLAY (v5.42)

   QUEUE v4 S9. A card played from banish under a this-turn permission
   was filed back into banish with `_playTurn` (and `_asInstant`,
   `_banPow`, `_banCostOff`) intact, so `playZoneWhy` let it be played
   again, and again: on the trainer through `execute`, at the table
   through `fileAttack`. `parser.spendPlayGrant` is the one body both
   ask. WHERE the card goes is NOT decided here: it stays banish, and
   that is the stated record `played-from-banish-files-to-banish`.

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
const STAMPS = ["_playTurn", "_asInstant", "_banPow", "_banCostOff"];

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
function settle(g){
  for(let i = 0; i < 40; i++){
    if(g.phase === "action" && g.step === "layer" && g.priority === 0 && !g.pend
       && !g.prompt && !(g.stack||[]).length) return g;
    g = H.move(g);
  }
  return g;
}
function playTwice(g, u){
  const PLAY = {t: "play", uid: u, from: "banish"};
  assert.equal(J.legal(g, PLAY, 0), null, "the first play is legal");
  const out = J.reduce(g, PLAY, 0);
  assert.equal(out.error, null);
  g = settle(out.state);
  const back = (g.sides[0].banish||[]).find(c => c.uid === u);
  assert.ok(back, "the card is back in banish (the stated destination)");
  STAMPS.forEach(k => assert.ok(!(k in back), k + " was spent with the play"));
  const why = J.legal(g, PLAY, 0);
  assert.match(String(why), REFUSED, "a second play is refused with a sentence: " + why);
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
  g = playTwice(table(g), ct.uid);
  assert.ok(!(g.feed||[]).some(l => /Crouching Tiger: live — it ceases to exist instead of/.test(String(l))),
    "the feed must not say it ceased to exist while it sits in banish");
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
  const back = g.sides[0].banish.find(c => c.uid === "ib1");
  assert.ok(back, "filed back to banish");
  STAMPS.forEach(k => assert.ok(!(k in back), k + " spent"));
  assert.equal(P.playableFromZone(back, "banish", {turn: 3}), false);
});

test("spendPlayGrant is a no-op copy-free on an unstamped card, and strips all four", () => {
  const plain = {name: "x"};
  assert.equal(P.spendPlayGrant(plain), plain);
  const s = P.spendPlayGrant({name: "x", _playTurn: 3, _asInstant: true, _banPow: 1, _banCostOff: 1, _gy: 2});
  assert.deepEqual(s, {name: "x", _gy: 2});
  assert.deepEqual([...P.PLAY_GRANT_STAMPS].sort(), [...STAMPS].sort());
});
