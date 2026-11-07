/* QA-C probe: does the trainer's Coach's call ever recommend a weapon swing? */
const P = require("/home/user/dawnblade-ai/engine/parser");
const A = require("/home/user/dawnblade-ai/engine/advisor");
const sided = o => ({sides:[
  {name:"You",hp:20, hand:[], arsenal:null, gear:[], board:[], deck:[], pitch:[], grave:[],
   banish:[], soul:[], counters:{}, weaponUsed:{}, buffNext:0, rune:0, amp:0,
   res:0, ap:1, hist:{atk:0,non:0}, ...o},
  {name:"The Dummy",hp:42, hand:[], arsenal:null, gear:[], board:[], deck:[]}]});
const blade = {uid:"w1", name:"qa-c Dawnblade", tt:"Weapon - Sword (2H)", ty:["Weapon","Sword","2H"], power:3, cost:1, kw:[],
  tx:"Once per Turn Action - {r}: Attack\nThe second time this hits each turn, put a +1{p} counter on it."};
const blue = {uid:"h1", name:"qa-c blue", tt:"Action", ty:["Action"], pitch:3, cost:0, kw:[], tx:"Gain 1{h}."};
for (const [label, o] of [["empty hand, 1 floating", {res:1, gear:[blade]}],
                          ["a blue to pitch", {res:0, hand:[], gear:[blade]}],
                          ["buffNext +5 pending, 3 floating", {res:3, buffNext:5, gear:[blade]}]]) {
  const g = sided(o);
  console.log(label.padEnd(36), "isAttack(weapon)=", P.isAttack(blade), " advCardOut=", A.advCardOut(blade, g, {runeDmg:0}),
    "\n   call:", JSON.stringify(A.advise(g, {runeDmg:0, window:"act"})));
}
/* QA-C probe 2: Azalea's hero power coached with an EMPTY arsenal */
{
  P.fxReset && P.fxReset();
  const hpow = {name:"qa-c Azalea — hero power", pitch:0, cost:0, power:null, def:null, tt:"Hero Ability", kw:["Go again"], uid:"hpow",
    tx:"Put a card from your arsenal on the bottom of your deck. If you do, put the top card of your deck face-up into your arsenal. If it's an arrow, it gets dominate until end of turn. Go again"};
  const g = sided({arsenal:null, res:0});
  console.log("Azalea, arsenal EMPTY ->", JSON.stringify(A.advise(g, {runeDmg:0, window:"act", hpow})));
}
/* QA-C probe 3: a DEFENSE REACTION in the arsenal is coached as an action-phase play */
{
  P.fxReset && P.fxReset();
  const sig = {uid:"a1", name:"qa-c Sigil of Suffering", tt:"Runeblade Defense Reaction", ty:["Runeblade","Defense Reaction"], pitch:1, cost:0, def:3, power:null, kw:[],
    tx:"Deal 1 arcane damage to the attacking hero.\nIf you've dealt arcane damage this turn, this gets +1{d}."};
  const g = sided({arsenal:sig, res:0});
  console.log("defense reaction in ARSENAL, act window ->", JSON.stringify(A.advise(g, {runeDmg:1, window:"act"})));
  const g2 = sided({hand:[Object.assign({}, sig, {uid:"h9", name:"qa-c Sigil in hand"})], res:0});
  console.log("same card in HAND, act window          ->", JSON.stringify(A.advise(g2, {runeDmg:1, window:"act"})));
}
