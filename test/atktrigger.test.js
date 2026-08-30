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

test("all SEVEN tokens read the same trigger, each on the route it prints", {skip}, () => {
  /* v3.22 built this for the one printed SUBJECT it found. Three more pool
     tokens print the identical shape with a different subject and read
     `tier: none` until v3.65 — they did nothing at all. The route list is
     what tells them apart, and it is read off the printed words rather
     than defaulted: Blade Dance has no "play an attack action card" half
     at all, and Eloquence's subject is a NON-attack. */
  const want = {
    "Runechant":               {on: ["atk", "weapon"], ops: [["arcane", 1]]},
    "Courage":                 {on: ["atk", "weapon"], ops: [["pump", 1]]},
    "Quicken":                 {on: ["atk", "weapon"], ops: [["ga"]]},
    "Embodiment of Lightning": {on: ["atk"],           ops: [["ga"]]},
    "Blade Dance":             {on: ["weapon"],        ops: [["ga"]]},
    "Flurry":                  {on: ["weapon"],        ops: [["wpnAgain"]]},
    "Eloquence":               {on: ["nonAtk"],        ops: [["ga"]]}
  };
  for(const [nm, exp] of Object.entries(want)){
    P.fxReset();
    assert.deepEqual(P.fxParse(cardOf(nm)).atkTrigger, exp, nm);
  }
});

test("the SUBJECT of the payload must match the subject of the trigger", {skip}, () => {
  /* "The attack" and "the card" name the same object on their own route,
     but a token whose trigger is a non-attack cannot say "the attack" and
     one whose trigger is an attack cannot say "the card". Reading either
     onto the other is the wrong-subject shape v2.33 and v3.47 both name;
     an unreadable payload refuses instead. */
  const mk = (tx, nm) => ({name: nm, pitch: 0, tt: "Generic Token - Aura",
                           ty: ["Generic", "Token", "Aura"], kw: [], tx});
  P.fxReset();
  assert.equal(P.fxParse(mk(
    "When you play a non-attack action card, destroy this and the attack gets go again.",
    "subj probe A")).atkTrigger, undefined,
    "a non-attack trigger cannot pay out to \"the attack\"");
  assert.equal(P.fxParse(mk(
    "When you play an attack action card, destroy this and the card gets go again.",
    "subj probe B")).atkTrigger, undefined,
    "an attack trigger cannot pay out to \"the card\"");
  P.fxReset();
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

/* ============================================================
   THE THREE SUBJECTS v3.22 DID NOT ASK ABOUT (v3.65)

   The reader was built for one printed wording and never asked which
   others the pool prints of the same shape. Blade Dance, Flurry and
   Eloquence all read `tier: none` and did nothing at all — v3.60's rule
   ("a fixed wording is not a fixed shape") at the level of a family.

   Only Flurry has a MINTER in this pool (Edict of Steel, Toe the Line);
   Blade Dance and Eloquence are unreachable here, and that is a fact
   about the pool rather than about the engine — the route exists on both
   boards, so reading them is honest.
   ============================================================ */

const wpn = o => Object.assign({name: "Probe Weapon", tt: "Warrior Weapon - Sword (2H)",
  ty: ["Warrior", "Weapon"], tx: "", kw: [], power: 4, pitch: 0, cost: 0, uid: 901}, o || {});

test("DRIVEN: Blade Dance fires on a WEAPON swing and not on an attack card", {skip}, () => {
  P.fxReset();
  const mk = from => {
    const g = H.state({hand: [], board: [onBoard("Blade Dance", "t1")], res: 9, ap: 1},
                      {hp: 20}, {turn: 3});
    g.builds = [{}, {}];
    const c = from === "weapon" ? wpn() : swing();
    return H.execute(g, c, from, 0, {});
  };
  const w = mk("weapon");
  assert.deepEqual(w.sides[0].board.map(b => b.card.name), [], "it must pop on the swing");
  assert.equal(!!(w.pend && w.pend.ga), true, "…and the swing goes again");

  /* THE HALF IT DOES NOT PRINT. Blade Dance has no "play an attack action
     card" clause at all, so an attack card must leave it on the board —
     dropping that distinction makes the token strictly stronger than
     printed, which is the reason v3.22 kept `weaponToo` in the first place. */
  const a = mk("hand");
  assert.deepEqual(a.sides[0].board.map(b => b.card.name), ["Blade Dance"],
    "an attack action card is not a weapon attack — the token must survive it");
  assert.equal(!!(a.pend && a.pend.ga), false);
});

test("DRIVEN: Flurry frees the weapon for one more swing — assert `weaponUsed`", {skip}, () => {
  /* Its payload is the mechanic Dorinthea's hero ability already is:
     `weaponRefresh` lifts the Once-per-Turn allowance and nothing else, so
     the extra swing pays its printed cost and an action point like any
     other activation. Assert the ALLOWANCE, not the feed. */
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard("Flurry", "t1")], res: 9, ap: 1,
                     weaponUsed: {901: true}}, {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const n = H.execute(g, wpn(), "weapon", 0, {});
  assert.deepEqual(n.sides[0].board.map(b => b.card.name), [], "the token pops");
  assert.equal(n.sides[0].weaponUsed[901], undefined,
    "the weapon's once-per-turn allowance must be lifted — that IS the payload");
});

test("…and Flurry frees THAT weapon only", {skip}, () => {
  /* "That weapon" is literal, the same way Dorinthea's is. Lifting the
     whole map would hand a hero holding two weapons a free swing with the
     other one. */
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard("Flurry", "t1")], res: 9, ap: 1,
                     weaponUsed: {901: true, 902: true}}, {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const n = H.execute(g, wpn(), "weapon", 0, {});
  assert.equal(n.sides[0].weaponUsed[902], true, "the OTHER weapon stays spent");
});

test("DRIVEN: Eloquence fires on a NON-ATTACK — the pop site that did not exist", {skip}, () => {
  /* The attack branch has had a pop site since v3.22 and this branch had
     none, so a `nonAtk` trigger could never fire. v3.53's shape: a site
     inside `if(attacking)` and a card that never attacks.

     GO AGAIN IS AN ACTION POINT, so that is what to assert on (v3.58) —
     a non-attack prints no `pend` to read a flag off. */
  P.fxReset();
  const non = {name: "Probe Non-Attack", tt: "Generic Action", ty: ["Generic", "Action"],
               tx: "", kw: [], pitch: 1, cost: 0, def: 2, uid: 903};
  const run = board => {
    const g = H.state({hand: [], board, res: 9, ap: 1}, {hp: 20}, {turn: 3});
    g.builds = [{}, {}];
    return H.execute(g, non, "hand", 0, {});
  };
  const with_ = run([onBoard("Eloquence", "t1")]);
  const without = run([]);
  assert.deepEqual(with_.sides[0].board.map(b => b.card.name), [], "the token pops");
  assert.equal(with_.sides[0].ap, without.sides[0].ap + 1,
    "go again is a GAIN (CR 5.3.5) — the point kept is the whole observable");
});

test("…and Eloquence does NOT fire on an attack action card", {skip}, () => {
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard("Eloquence", "t1")], res: 9, ap: 1},
                    {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const n = H.execute(g, swing(), "hand", 0, {});
  assert.deepEqual(n.sides[0].board.map(b => b.card.name), ["Eloquence"],
    "its printed subject is a non-attack action card");
  assert.equal(!!(n.pend && n.pend.ga), false);
});

test("AN ALLY ATTACK IS NEITHER a weapon attack nor an attack action card", {skip}, () => {
  /* v3.44 gave allies an attack route, and this reader's fire test was
     `weaponToo || from !== "weapon"` — which answers TRUE for
     `from === "ally"`, so an ally's activated attack popped every one of
     these tokens as though an attack action card had been played.

     LATENT, NOT LIVE, and that was measured across all fifteen decks
     before it was fixed: none holds both a minter and an attacking ally.
     The route has existed since v3.44 all the same. */
  P.fxReset();
  const g = H.state({hand: [], board: [onBoard("Runechant", "t1"), {card: {name: "Probe Ally",
      tt: "Pirate Action - Ally", ty: ["Pirate", "Action", "Ally"], kw: [], tx: "",
      power: 3, life: 3, uid: 904}, kind: "ally", uid: 904, life: 3}],
      res: 9, ap: 1}, {hp: 20}, {turn: 3});
  g.builds = [{}, {}];
  const ally = {name: "Probe Ally", tt: "Pirate Action - Ally", ty: ["Pirate", "Action", "Ally"],
                kw: [], tx: "", power: 3, pitch: 1, cost: 0, uid: 904};
  const n = H.execute(g, ally, "ally", 0, {});
  assert.ok(n.sides[0].board.some(b => b.card.name === "Runechant"),
    "the token must survive an ally's swing — its printed trigger names neither route");
  assert.equal(n.sides[1].hp, 20, "…and deal no arcane");
});

test("the payload vocabulary on the NON-ATTACK route is pinned to what the pool prints", {skip}, () => {
  /* The non-attack pop site dispatches `ga` and nothing else, which is
     complete BECAUSE the parser matches a payload's subject against its
     trigger's: only "the card gets go again" parses on this route. This
     drill pins that measurement, so a pool card printing something else
     fails HERE rather than quietly doing nothing at the pop site — the
     same call v3.53 made for its own measurement. */
  const pool = require("../data/pool.json");
  const mk = r => ({name: r.name + "|nonatk|" + r.pitch, tx: r.functional_text || "",
                    tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                    pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  const found = [];
  for(const r of pool){
    P.fxReset();
    const t = P.fxParse(mk(r)).atkTrigger;
    if(t && (t.on || []).indexOf("nonAtk") >= 0) found.push([r.name, JSON.stringify(t.ops)]);
  }
  P.fxReset();
  for(const [nm, ops] of found)
    assert.equal(ops, '[["ga"]]',
      nm + " prints a non-attack trigger with a payload the pop site does not dispatch");
  assert.ok(found.length >= 1, "the scan found nothing — a scan that stops matching passes by finding nothing");
});
