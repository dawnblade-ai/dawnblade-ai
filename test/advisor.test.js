/* Advisor drills: the pitch solver's exactness and damage estimation.
   Unique fixture names throughout (fxParse memo gotcha). */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const A = require("../engine/advisor");

test("advBestPitch — exact cover beats waste", () => {
  const hand = [{pitch:1},{pitch:2},{pitch:3}];
  const set = A.advBestPitch(hand, 2, null, c=>c.pitch);
  assert.deepEqual(set.idxs, [1]);
  assert.equal(set.waste, 0);
});

test("advBestPitch — ties on waste break toward lower value loss, then fewer cards", () => {
  const hand = [{pitch:3, v:5},{pitch:3, v:1}];
  const set = A.advBestPitch(hand, 3, null, c=>c.v);
  assert.deepEqual(set.idxs, [1], "should pitch the low-value blue");
});

test("advBestPitch — excluded index (the card being played) is never pitched", () => {
  const hand = [{pitch:3},{pitch:1},{pitch:2}];
  const set = A.advBestPitch(hand, 3, 0, c=>c.pitch);
  assert.deepEqual(set.idxs.sort(), [1,2]);
});

test("advBestPitch — returns null when the hand cannot cover", () => {
  assert.equal(A.advBestPitch([{pitch:1}], 5, null, c=>1), null);
});

test("advBestPitch — zero need is free", () => {
  assert.deepEqual(A.advBestPitch([{pitch:3}], 0, null, c=>1), {idxs:[],gain:0,waste:0,loss:0});
});

test("advCardOut — attack damage stacks self pump, buffNext, and runechants", () => {
  P.fxReset();
  const card = {name:"adv-drill-atk", pitch:1, tt:"Attack Action", power:4, kw:[],
    tx:"This attack gains +1 {p}."};
  const g = {buffNext:1, rune:2, amp:0, hist:{atk:0,non:0}};
  assert.equal(A.advCardOut(card, g, {runeDmg:1}), 4+1+1+2);
});

test("advCardOut — conditional pump only counts once the condition is live", () => {
  P.fxReset();
  const card = {name:"adv-drill-cond", pitch:1, tt:"Attack Action", power:3, kw:[],
    tx:"If you have played another attack action card this turn, this gets +2 {p}."};
  const cold = A.advCardOut(card, {buffNext:0, rune:0, amp:0, hist:{atk:0,non:0}}, {runeDmg:1});
  const hot  = A.advCardOut(card, {buffNext:0, rune:0, amp:0, hist:{atk:1,non:0}}, {runeDmg:1});
  assert.equal(cold, 3);
  assert.equal(hot, 5);
});

test("advCardOut — arcane ops add amp", () => {
  P.fxReset();
  const card = {name:"adv-drill-arc", pitch:3, tt:"Action", power:null, kw:[],
    tx:"Deal 2 arcane damage to any target."};
  assert.equal(A.advCardOut(card, {buffNext:0, rune:0, amp:1, hist:{atk:0,non:0}}, {runeDmg:1}), 3);
});

test("advise — act mode with an empty board says end turn", () => {
  P.fxReset();
  const g = {mode:"act", ap:1, res:0, hand:[], arsenal:null, gear:[], board:[],
    weaponUsed:{}, rune:0, buffNext:0, amp:0, hist:{atk:0,non:0}};
  const r = A.advise(g, {runeDmg:1});
  assert.match(r.line, /End turn/);
});

test("advise — recommends the profitable attack in act mode", () => {
  P.fxReset();
  const g = {mode:"act", ap:1, res:0, rune:0, buffNext:0, amp:0, hist:{atk:0,non:0},
    hand:[{name:"adv-drill-swing", pitch:1, tt:"Attack Action", power:7, def:3, cost:0, kw:[], tx:""}],
    arsenal:null, gear:[], board:[], weaponUsed:{}};
  const r = A.advise(g, {runeDmg:1});
  assert.match(r.line, /adv-drill-swing/);
});
