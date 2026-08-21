/* ============================================================
   "WHEN YOU PLAY AN ATTACK ACTION CARD, DESTROY THIS AND X"

   Four pool tokens print this trigger and exactly one of them was
   built. Runechant worked — matched BY NAME through
   `isRunechantEntry`, popped by a hardcoded block — while Courage,
   Quicken and Briar's Embodiment of Lightning read `tier: none` and
   did nothing at all.

     Runechant                attack card OR weapon   1 arcane damage
     Courage                  attack card OR weapon   the attack gets +1{p}
     Quicken                  attack card OR weapon   the attack gets go again
     Embodiment of Lightning  attack card ONLY        the attack gets go again

   THE WEAPON HALF IS PART OF THE PRINTED TRIGGER. Three of them fire
   on a weapon swing and the Embodiment does not; dropping that makes
   Briar's token strictly stronger than printed, which is the
   direction that steals games.

   Asserted on the BOARD, on life, and on the declared attack — never
   on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = H.hasDb() ? false : "no card database";

const POOL = () => JSON.parse(fs.readFileSync(
  require("./helpers/extract").cardDbPath(), "utf8"));
const rec = nm => POOL().find(c => c.name === nm);
const cardOf = nm => { const r = rec(nm); return {name: r.name, pitch: +(r.pitch || 0),
  tt: r.type_text, ty: r.types, kw: r.card_keywords || [],
  tx: (r.functional_text || "").replace(/\*\*/g, "")}; };
const onBoard = (nm, uid) => ({card: Object.assign(cardOf(nm), {uid}), kind: "aura", uid});
const swing = o => Object.assign({name: "Probe Swing", tt: "Generic Attack Action",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: 4, pitch: 1, cost: 0,
  uid: 900}, o || {});

/* ---- 1. the trigger is READ, and the weapon half with it ---------- */

test("all four tokens read the same trigger, and the weapon half is kept", {skip}, () => {
  const want = {
    "Runechant":               {weaponToo: true,  ops: [["arcane", 1]]},
    "Courage":                 {weaponToo: true,  ops: [["pump", 1]]},
    "Quicken":                 {weaponToo: true,  ops: [["ga"]]},
    "Embodiment of Lightning": {weaponToo: false, ops: [["ga"]]}
  };
  for(const [nm, exp] of Object.entries(want)){
    P.fxReset();
    assert.deepEqual(P.fxParse(cardOf(nm)).atkTrigger, exp, nm);
  }
});

test("a card printing the trigger with an unreadable payload is NOT claimed", {skip}, () => {
  /* Malefic Incantation prints "Once per turn, when you play an attack
     action card, remove a verse counter from this. If you do, create a
     Runechant token." Same trigger, a payload with no reader here, and no
     "destroy this" — so it must stay unclaimed rather than fire a guess. */
  P.fxReset();
  assert.equal(P.fxParse(cardOf("Malefic Incantation")).atkTrigger, undefined);
});

/* ---- 2. driven: each pays exactly what it prints ------------------ */

function drive(tokenName, from, extra){
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard(tokenName, "t1")], res: 9, ap: 1},
                    {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const c = from === "weapon"
    ? swing({tt: "Warrior Weapon", ty: ["Warrior", "Weapon"]})
    : swing();
  const n = H.execute(g, c, from || "hand", 0, extra || {});
  return {board: n.sides[0].board.map(b => b.card.name),
          foeHp: n.sides[1].hp,
          total: n.pend && n.pend.total,
          ga: !!(n.pend && n.pend.ga)};
}

test("Runechant pops for its printed arcane", {skip}, () => {
  const a = drive("Runechant", "hand");
  assert.deepEqual(a.board, [], "the token destroys itself — no 'you may'");
  assert.equal(a.foeHp, 19);
});

test("Courage pops for its printed +1{p}, INTO the declared attack", {skip}, () => {
  /* the payload has to land before `pend` is built, or the attack resolves
     for its base while the log says otherwise */
  const a = drive("Courage", "hand");
  assert.deepEqual(a.board, []);
  assert.equal(a.total, 5, "4 printed + 1 from the token");
  assert.equal(a.foeHp, 20, "Courage deals no damage of its own");
});

test("Quicken pops for go again", {skip}, () => {
  const a = drive("Quicken", "hand");
  assert.deepEqual(a.board, []);
  assert.equal(a.ga, true);
  assert.equal(a.total, 4, "go again is not power");
});

test("the Embodiment pops for go again on an attack action card", {skip}, () => {
  const a = drive("Embodiment of Lightning", "hand");
  assert.deepEqual(a.board, []);
  assert.equal(a.ga, true);
});

/* ---- 3. THE WEAPON DISTINCTION ------------------------------------ */

test("three fire on a WEAPON swing; the Embodiment does not", {skip}, () => {
  for(const nm of ["Runechant", "Courage", "Quicken"])
    assert.deepEqual(drive(nm, "weapon").board, [], nm + " prints 'or activate a weapon attack'");

  const e = drive("Embodiment of Lightning", "weapon");
  assert.deepEqual(e.board, ["Embodiment of Lightning"],
    "its printed trigger names an attack action card ONLY — popping it here is above rate");
  assert.equal(e.ga, false, "and the swing must not gain go again from it");
});

/* ---- 4. each token is its OWN source ------------------------------ */

test("two Runechants are two sources, not one pooled hit", {skip}, () => {
  /* Pyroglyphic Protection prevents per SOURCE and Arcane Barrier triggers
     per threat, so pooling them pushes more damage through than the cards
     print. `hist.arc` counts instances, not points. */
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard("Runechant", "r1"), onBoard("Runechant", "r2")],
                     res: 9, ap: 1}, {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const n = H.execute(g, swing(), "hand", 0, {});
  assert.equal(n.sides[1].hp, 18, "two tokens, one point each");
  assert.equal(n.sides[0].hist.arc, 2, "TWO instances credited, not one and not two points");
});

/* ---- 5. a token the attack itself creates does not fire ----------- */

test("only the auras in the arena when the attack was PLAYED fire", {skip}, () => {
  /* v2.23's rule: the trigger fires on PLAY, so a token this very attack
     conjures was not there when it was played and survives to the next
     swing. Reading the board again at the pop is what made a runechant
     pop on its own attack.

     THIS IS LOAD-BEARING RATHER THAN THEORETICAL. Viserai's rite mints
     INSIDE `execute`, before the pop site — so the new token really is
     sitting on the board when the pop runs, and it survives only because
     the firing set was captured by uid before the card did anything. */
  P.fxReset();
  /* THE RITE NEEDS THE DATABASE REGISTERED. Every other drill in this file
     builds its cards out of the pool JSON directly and never touches it,
     so `judge.setDb` was never called and the mint quietly resolved
     nothing — the token op refuses a name it cannot find, which is the
     golden rule working and reads exactly like the rule under test
     failing. */
  H.db();
  const g = H.state({hand: [], board: [onBoard("Runechant", "r1")], res: 9, ap: 1,
    hist: {atk:0, non:1, arc:0, aura:0, made:0, booed:0, blue:0, red:0,
           trans:0, blueGY:0, atkNames:[]}}, {hp: 20}, {turn: 3});
  /* the rite needs the real token record to copy — never an invented one */
  g.builds = [{viseraiPassive: true, runeCard: cardOf("Runechant")}, {}];
  const c = swing({name: "Rite Swing", tt: "Runeblade Attack Action",
                   ty: ["Runeblade", "Action", "Attack"]});
  const n = H.execute(g, c, "hand", 0, {});

  assert.equal(n.sides[1].hp, 19, "the token that WAS there popped, for its printed 1");
  const left = n.sides[0].board.map(b => b.card.name);
  assert.deepEqual(left, ["Runechant"], "and the one the rite just conjured is still standing");
  assert.ok(!n.sides[0].board.some(b => b.uid === "r1"),
    "specifically: the survivor is the NEW token, not the one that fired");
});
