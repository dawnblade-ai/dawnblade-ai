/* Pure game-helper drills: equipment block wear (Blade Break, Battleworn,
   Temper, Guardwell), gear slotting, deck-line parsing, shuffle sanity. */
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../engine/game");

test("gearDef — printed, worn, destroyed", () => {
  assert.equal(G.gearDef({def:2}), 2);
  assert.equal(G.gearDef({def:2, curDef:1}), 1);
  assert.equal(G.gearDef({def:2, curDef:0}), 0);
  assert.equal(G.gearDef({def:2, destroyed:true}), 0);
});

test("gearBlockApply — Blade Break destroys after one block", () => {
  const n = G.gearBlockApply({name:"bb", def:3, kw:["Blade Break"]});
  assert.equal(n.destroyed, true);
});

test("gearBlockApply — Battleworn loses 1 per block, survives at 0", () => {
  let n = G.gearBlockApply({name:"bw", def:2, kw:["Battleworn"]});
  assert.equal(n.curDef, 1);
  assert.ok(!n.destroyed);
  n = G.gearBlockApply(n);
  assert.equal(n.curDef, 0);
  assert.ok(!n.destroyed);
});

test("gearBlockApply — Temper loses 1 per block, shatters at 0", () => {
  let n = G.gearBlockApply({name:"tp", def:2, kw:["Temper"]});
  assert.equal(n.curDef, 1);
  assert.ok(!n.destroyed);
  n = G.gearBlockApply(n);
  assert.equal(n.curDef, 0);
  assert.equal(n.destroyed, true);
});

test("gearBlockApply — Guardwell drops to 0 (chain close), stays in play", () => {
  const n = G.gearBlockApply({name:"gw", def:3, kw:["Guardwell"]});
  assert.equal(n.curDef, 0);
  assert.ok(!n.destroyed);
});

test("gearBlockApply — plain equipment is untouched", () => {
  const n = G.gearBlockApply({name:"plain", def:1, kw:[]});
  assert.equal(G.gearDef(n), 1);
  assert.ok(!n.destroyed);
});

test("slotOf — hand vs armor zones from type text", () => {
  assert.equal(G.slotOf({tt:"Weapon - Sword 2H"}).z, "2h");
  assert.equal(G.slotOf({tt:"Weapon - Pistol 1H"}).z, "1h");
  assert.equal(G.slotOf({tt:"Weapon - Off-Hand"}).z, "off");
  assert.equal(G.slotOf({tt:"Equipment - Quiver"}).z, "qvr");
  assert.equal(G.slotOf({tt:"Equipment - Head"}).z, "head");
  assert.equal(G.slotOf({tt:"Equipment - Chest"}).z, "chest");
  assert.equal(G.slotOf({tt:"Equipment - Arms"}).z, "arms");
  assert.equal(G.slotOf({tt:"Equipment - Legs"}).z, "legs");
  assert.equal(G.slotOf({tt:""}).z, "misc");
});

test("parseDeck — hero, gear, and quantities from the pipe format", () => {
  const d = G.parseDeck("H|Kayo|0|SKA001\nG|Knucklehead|0|\n2|Bare Fangs|1|\n1|Test of Might|0|");
  assert.equal(d.hero.name, "Kayo");
  assert.equal(d.hero.code, "SKA001");
  assert.equal(d.gear.length, 1);
  assert.deepEqual(d.deck.map(e=>e.q), [2,1]);
  assert.equal(d.deck[0].p, 1);
  assert.equal(d.deck[0].code, null);
});

test("shuffle — preserves the multiset, does not mutate", () => {
  const a = [1,2,3,4,5,6,7,8];
  const s = G.shuffle(a);
  assert.deepEqual(a, [1,2,3,4,5,6,7,8]);
  assert.deepEqual(s.slice().sort((x,y)=>x-y), a);
});
