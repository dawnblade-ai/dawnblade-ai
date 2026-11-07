/* Advisor drills: the pitch solver's exactness and damage estimation.
   Unique fixture names throughout (fxParse memo gotcha). */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const A = require("../engine/advisor");

/* v2.18: the advisor reads counters off sides[0], so a bare {rune:2}-style
   fixture has to be seated. sided() wraps one into a minimal two-sided game. */
const sided = o => ({sides:[
  {hp:20, hand:[], arsenal:null, gear:[], board:[], deck:[], pitch:[], grave:[],
   banish:[], soul:[], counters:{}, weaponUsed:{}, buffNext:0, rune:0, amp:0,
   res:0, ap:1, hist:{atk:0,non:0}, ...o},
  {hp:42, hand:[], arsenal:null, gear:[], board:[], deck:[]}]});

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
  /* two runechants, as the auras they now are (see engine/parser.js runeCount) */
  const g = sided({buffNext:1, board:[
    {card:{uid:"r1", name:"Runechant", tt:"Runeblade Token - Aura"}, kind:"aura", uid:"r1"},
    {card:{uid:"r2", name:"Runechant", tt:"Runeblade Token - Aura"}, kind:"aura", uid:"r2"}]});
  assert.equal(A.advCardOut(card, g, {runeDmg:1}), 4+1+1+2);
});

test("advCardOut — conditional pump only counts once the condition is live", () => {
  P.fxReset();
  const card = {name:"adv-drill-cond", pitch:1, tt:"Attack Action", power:3, kw:[],
    tx:"If you have played another attack action card this turn, this gets +2 {p}."};
  const cold = A.advCardOut(card, sided({hist:{atk:0,non:0}}), {runeDmg:1});
  const hot  = A.advCardOut(card, sided({hist:{atk:1,non:0}}), {runeDmg:1});
  assert.equal(cold, 3);
  assert.equal(hot, 5);
});

test("advCardOut — arcane ops add amp", () => {
  P.fxReset();
  const card = {name:"adv-drill-arc", pitch:3, tt:"Action", power:null, kw:[],
    tx:"Deal 2 arcane damage to any target."};
  assert.equal(A.advCardOut(card, sided({amp:1}), {runeDmg:1}), 3);
});

/* The advisor reads zones off sides[] as of v2.16 — sides[0] is you,
   sides[1] the opponent. Fixtures build the two-sided shape. */
const gameWith = (side0, rest) => ({
  mode:"act", ap:1, res:0, rune:0, buffNext:0, amp:0, hist:{atk:0,non:0},
  weaponUsed:{}, incoming:0, ...rest,
  sides:[
    {hp:20, hand:[], arsenal:null, gear:[], board:[], deck:[], pitch:[], grave:[], banish:[], soul:[], ...side0},
    {hp:42, hand:[], arsenal:null, gear:[], board:[], deck:[], pitch:[], grave:[], banish:[], soul:[]}
  ]
});

/* THE WINDOW IS A PARAMETER AS OF v2.83 — see advisor.js's advView header.
   These fixtures pass it explicitly, exactly as both boards do; a fixture
   that still relied on `mode` would be testing a field `advise` no longer
   reads and would pass for the wrong reason. */
test("advise — act mode with an empty board says end turn", () => {
  P.fxReset();
  const r = A.advise(gameWith({}), {runeDmg:1, window:"act"});
  assert.match(r.line, /End turn/);
});

test("advise — recommends the profitable attack in act mode", () => {
  P.fxReset();
  const g = gameWith({hand:[{name:"adv-drill-swing", pitch:1, tt:"Attack Action", power:7, def:3, cost:0, kw:[], tx:""}]});
  const r = A.advise(g, {runeDmg:1, window:"act"});
  assert.match(r.line, /adv-drill-swing/);
});

test("advise — block mode reads both sides' life off sides[]", () => {
  P.fxReset();
  const g = gameWith(
    {hp:6, hand:[{name:"adv-drill-shield", pitch:2, tt:"Attack Action", power:2, def:3, cost:0, kw:[], tx:""}]});
  const r = A.advise(g, {runeDmg:1, window:"block", incoming:4});
  assert.match(r.line, /adv-drill-shield/, "on 6 life it should block, not take it");
});

/* ===================================================================
   THE WINDOW (v2.83) — the advisor is TOLD, it never sniffs.

   `judge.js` seeds `mode` into its opening state and never writes it
   again, so a table game carries `mode:"act"` for its whole length.
   The failure that creates is not a crash — it is confident
   action-phase coaching in every step of every turn, which is the
   category the player TRUSTS. These pin both halves: that a missing
   window is REFUSED rather than guessed, and that advView reads the
   CR machine rather than the dead field.
   =================================================================== */
test("advise REFUSES without a window rather than guessing the action phase", () => {
  P.fxReset();
  /* The fixture still carries `mode:"act"`, so a fallback to `g.mode`
     would make this return real coaching — which is exactly the silent
     path being closed. Sabotage-proven: restoring the fallback turns
     this red. */
  const r = A.advise(gameWith({}), {runeDmg:1});
  assert.match(r.line, /not told which step/,
    "a missing window must be visible, not resolved to action-phase advice");
  assert.ok(!/End turn/.test(r.line), "and must not read g.mode behind the caller's back");
});

test("advView derives the window from the CR machine, not from mode", () => {
  /* A judge-SHAPED state: `mode` says one thing throughout and the CR
     fields say another, which is precisely the table's situation. */
  const base = {mode:"act", turnPlayer:0, priority:0, phase:"action", step:"layer",
                sides:[{}, {}]};
  assert.equal(A.advView(base, 0).window, "act");

  /* CR 7.3.2 — the defender declares in the defend step. The ATTACKER is
     seat 1, so seat 0 is the one blocking. */
  const defending = {...base, phase:"action", step:"defend", attacker:1,
                     pend:{total:7}};
  const v = A.advView(defending, 0);
  assert.equal(v.window, "block", "seat 0 is declaring defenders");
  assert.equal(v.incoming, 7,
    "and the incoming damage comes off pend.total — judge never writes g.incoming");

  /* The same state, asked of the ATTACKING seat, is not a block. */
  assert.notEqual(A.advView(defending, 1).window, "block",
    "the attacker is not the one declaring defenders");

  /* CR 8.1.2a — an attack reaction belongs to whoever controls the attack. */
  assert.equal(A.advView({...base, step:"reaction", attacker:0}, 0).window, "stack");
  assert.equal(A.advView({...base, step:"reaction", attacker:1}, 0).window, "act",
    "their attack is not your reaction window");

  /* A payment belongs to ONE seat. */
  assert.equal(A.advView({...base, pending:{seat:0, kind:"pay"}}, 0).window, "pay");
  assert.equal(A.advView({...base, pending:{seat:1, kind:"pay"}}, 0).window, "act",
    "their payment is not yours to advise on");

  /* CR 4.4.3b — the arsenal set names the seat it is asking. */
  assert.equal(A.advView({...base, phase:"end", arsenalFor:0}, 0).window, "arsenal");
  assert.equal(A.advView({...base, phase:"end", arsenalFor:1}, 0).window, "act");
});

/* 1.0 POLISH AUDIT: "Play Bravo — hero power — hero power (pitch …)". The
   hero power's card is built named "<Hero> — hero power" (build.js), and the
   source tag said it again. The call names the source once. */
test("advise — the hero power is named once, not twice", () => {
  P.fxReset();
  /* the shape build.js gives a hero power: a Hero Ability card whose text is
     the power's effect (here Bravo-like: go again, two cards drawn) */
  const hpow = {name:"Adv-drill Hero — hero power", pitch:0, cost:0, power:null, def:null,
    tt:"Hero Ability", kw:["Go again"], tx:"Draw 2 cards. Go again", uid:"hpow"};
  const r = A.advise(gameWith({weaponUsed:{}, hist:{atk:0,non:0}, ap:1, res:0}), {runeDmg:1, window:"act", hpow});
  assert.match(r.line, /Adv-drill Hero — hero power/, "the hero power is the call: " + r.line);
  assert.ok(!/hero power — hero power/.test(r.line), r.line);
  /* a source whose name does not say it still gets the tag */
  const bare = Object.assign({}, hpow, {name:"Adv-drill Bare Power"});
  const r2 = A.advise(gameWith({weaponUsed:{}, hist:{atk:0,non:0}, ap:1, res:0}), {runeDmg:1, window:"act", hpow:bare});
  assert.match(r2.line, /Adv-drill Bare Power — hero power/, r2.line);
});

/* 1.0 POLISH AUDIT: "Pitch Whisper of the Oracle — exactly 3 (2 floats:
   spend it before end of turn)." The count and the pronoun agree now. */
test("advise — the pay line counts what floats in English", () => {
  P.fxReset();
  const play = {name:"adv-drill-cost1", pitch:1, tt:"Attack Action", power:3, def:2, cost:1, kw:[], tx:"", uid:"p1"};
  const blue = n => ({name:"adv-drill-blue"+n, pitch:3, tt:"Attack Action", power:1, def:2, cost:0, kw:[], tx:"", uid:"b"+n});
  const red  = {name:"adv-drill-red", pitch:1, tt:"Attack Action", power:1, def:2, cost:0, kw:[], tx:"", uid:"r1"};
  const two = A.advise(gameWith({hand:[play, blue(1)], res:0}, {pending:{card:play, from:"hand", idx:0}}), {runeDmg:1, window:"pay"});
  assert.match(two.line, /exactly 3 \(2 left floating — spend them before end of turn\)\./, two.line);
  const none = A.advise(gameWith({hand:[play, red], res:0}, {pending:{card:play, from:"hand", idx:0}}), {runeDmg:1, window:"pay"});
  assert.ok(!/floating/.test(none.line), none.line);
});

/* ---- QA-C (v5.96 trainer read): the Coach's act-window call ---------------
   Each fixture has a unique name (fxParse memo) and asks `advise` for the call. */
const call = (g, ctx) => A.advise(g, Object.assign({runeDmg:0, window:"act"}, ctx||{}));
const dawn = {uid:"w1", name:"coach-qa Dawnblade", tt:"Weapon - Sword (2H)", ty:["Weapon","Sword","2H"], power:3, cost:1, kw:[],
  tx:"Once per Turn Action - {r}: Attack\nThe second time this hits each turn, put a +1{p} counter on it."};

test("COACH-1 — a weapon swing is valued and coached, with its pending +power", () => {
  assert.equal(P.isAttack(dawn), false, "the premise: the type line says Weapon, not attack action");
  const g = sided({res:3, buffNext:5, gear:[dawn]});
  assert.equal(A.advCardOut(dawn, g, {runeDmg:0}), 8, "printed 3 + the +5 already paid for");
  const r = call(g);
  assert.match(r.line, /^Play coach-qa Dawnblade — weapon swing → 8 dmg/, "never 'End turn' over a pumped weapon: " + r.line);
  /* sabotage: the same state with the swing already spent coaches the end of turn */
  assert.match(call(sided({res:3, buffNext:5, gear:[dawn], weaponUsed:{w1:true}})).line, /^End turn/);
});

test("COACH-1 — a powerless weapon (nothing to swing) is not a candidate worth coaching", () => {
  const dud = {...dawn, uid:"w2", name:"coach-qa Dawnblade dud", power:0};
  assert.match(call(sided({res:3, gear:[dud]})).line, /^End turn/);
});
