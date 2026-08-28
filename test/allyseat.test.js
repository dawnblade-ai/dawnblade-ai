/* ============================================================
   THE SEAT LEARNS TO USE ITS ALLIES (v3.50)

   Allies have attacked since v3.44 and `sparring.js` had never heard of
   them. Measured by `npm run play` over 210 self-play games:

       states with an untapped ally on the acting board   1077
       ally attacks PROPOSED by the policy                   0
       v3.46's death / Gold triggers fired                    0

   A feature with no caller looks exactly like a feature that works,
   until you count. The same count found ZERO hero-ability activations.

   AND GIVING IT A DRIVER IMMEDIATELY FOUND AN ENGINE BUG. With the
   policy attacking, the 210-game sweep reported **3761
   CARD-IN-TWO-ZONES** violations: an attacking ally was on the board AND
   in `chainCards`. `declareAttack` already excluded a WEAPON from that
   list — "a weapon stays equipped, so it never leaves the gear zone" —
   and v3.44 added a second activation route without giving it the
   sibling guard. **v3.43's lesson exactly: a guard belongs to the SHAPE,
   not to the version that wrote it.**

   Nothing could have caught it before, because nothing ever attacked
   with an ally.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const SP = require("../engine/sparring.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;
const P = require("../engine/parser.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* A board with one real ally, on its controller's action phase.

   THE UID IS ASSIGNED EXPLICITLY. `resolveEntry` does not give one — the
   deal does — so a fixture that leaves it `undefined` has every card
   matching every other by uid, and the first draft of these drills
   "passed" its activation by comparing undefined to undefined. */
let _uid = 900;
function withAlly(name, pitch){
  const a = H.card(name || "Swabbie", pitch == null ? 2 : pitch);
  a.uid = ++_uid;
  let g = H.state({res: 9, ap: 1,
                   board: [{card: a, kind: "ally", uid: a.uid, spent: false, life: 3}]},
                  {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return {g, ally: a};
}

/* ---- 1. THE ENGINE — an activation route leaves its card in place ---- */

test("an attacking ally stays in the arena and is NOT on the chain", {skip}, () => {
  const {g, ally} = withAlly();
  const out = J.reduce(g, {t: "activate", uid: ally.uid, target: "hero"}, 0);
  assert.ok(!out.error, "the attack must be legal: " + out.error);
  const n = out.state;

  assert.ok((n.sides[0].board || []).some(b => b && b.uid === ally.uid),
    "an ally stays in the arena exactly as a weapon stays equipped (v3.44)");
  assert.ok(!(n.chainCards || []).some(x => x.card && x.card.uid === ally.uid),
    "…so it is not IN the combat chain as an object — that is CARD-IN-TWO-ZONES");
});

test("the census agrees — driven, not asserted about", {skip}, () => {
  /* The point of the guard rails is that they answer this question
     without anyone having to know which zones exist. */
  const {g, ally} = withAlly();
  const n = J.reduce(g, {t: "activate", uid: ally.uid, target: "hero"}, 0).state;
  assert.deepEqual(INV.errors(n), [],
    "invariants must be clean with an ally mid-attack — this reported 3761 " +
    "violations across 210 games the moment the policy started attacking");
});

test("an attack from HAND is still filed to the chain", {skip}, () => {
  /* The guard must exclude the two activation routes and nothing else.
     Widening it to every attack loses the chain zone entirely, and a card
     in NO zone falls silently out of the census — worse than the bug. */
  const atk = H.card("Wounded Bull", 1); atk.uid = ++_uid;
  let g = H.state({res: 9, ap: 1, hand: [atk]}, {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  const out = J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, 0);
  assert.ok(!out.error, out.error);
  assert.ok((out.state.chainCards || []).some(x => x.card && x.card.uid === atk.uid),
    "a card played from hand HAS left its zone and must be censused on the chain");
  assert.deepEqual(INV.errors(out.state), []);
});

/* ---- 2. THE POLICY — it proposes the swing ---------------------------- */

test("the policy attacks with an ally when one is available", {skip}, () => {
  const {g, ally} = withAlly();
  const a = SP.act(g, 0);
  assert.ok(a, "the seat must have something to do with a 7-power ally in the arena");
  assert.equal(a.t, "activate");
  assert.equal(a.uid, ally.uid, "it proposed " + JSON.stringify(a));
  assert.equal(a.target, "hero",
    "CR 1.4.5 makes the target mandatory, and the hero is the one always available");
});

test("a spent ally is not proposed again", {skip}, () => {
  /* The policy proposes and `legal` disposes — the limit is the judge's,
     and the policy must simply stop offering it rather than restating the
     rule. A refusal is ALWAYS a bug in the policy. */
  const {g, ally} = withAlly();
  const n = J.reduce(g, {t: "activate", uid: ally.uid, target: "hero"}, 0).state;
  const a = SP.act(n, 0);
  assert.ok(!a || a.uid !== ally.uid, "it proposed the tapped ally again: " + JSON.stringify(a));
});

test("a bigger card in hand outranks a smaller ally, and vice versa", {skip}, () => {
  /* ALLIES ARE RANKED IN THE SAME ORDER AS EVERYTHING ELSE, not appended
     after it: both cost the turn's one action point, so they compete for
     the same thing. Printed power decides, exactly as it does for a card. */
  const {g, ally} = withAlly("Limpit, Hop-a-long", 2);   /* 2 power */
  const big = H.card("Wounded Bull", 1); big.uid = ++_uid; /* more */
  assert.ok(big.power > ally.power, "fixture: the hand card must be bigger");
  const withBig = {...g, sides: g.sides.map((s, i) => i ? s : {...s, hand: [big]})};
  assert.equal(SP.act(withBig, 0).uid, big.uid, "the bigger printed power goes first");

  /* THE SECOND HALF MUST BE AN ATTACK, and smaller. A non-attack is
     removed by the `power > 0` filter before ranking ever happens, so it
     proves nothing about ORDER — a fixture like that passes just as well
     against a policy that ranks every ally dead last, which is the
     sabotage that found it. */
  const {g: g2, ally: swab} = withAlly("Swabbie", 2);            /* 7 power */
  const smaller = H.card("Wounding Blow", 3); smaller.uid = ++_uid;  /* 2 power, an ATTACK */
  assert.ok(smaller.power > 0 && smaller.power < swab.power, "fixture: smaller, and still an attack");
  const withSmall = {...g2, sides: g2.sides.map((s, i) => i ? s : {...s, hand: [smaller]})};
  assert.equal(SP.act(withSmall, 0).uid, swab.uid,
    "the 7-power ally outranks the 2-power attack — allies are ranked WITH the hand, not after it");
});

test("the ranking stays a TOTAL order — the entry's uid breaks the tie", {skip}, () => {
  /* A ranking that leaves ties unbroken is a desync waiting for two equal
     allies. And the uid is the ENTRY's, not the card's: reading the wrong
     one is the same class of mistake as reading power off the entry. */
  const a1 = H.card("Swabbie", 2), a2 = H.card("Swabbie", 2);
  /* THE ENTRY'S UID AND THE CARD'S ARE DELIBERATELY DIFFERENT, and in the
     OPPOSITE order. A fixture where they coincide cannot tell `byUid(a,b)`
     from `byUid(a.c,b.c)` — it passes against both, which is a drill that
     has tested neither. The entry's is what judge is addressed with. */
  a1.uid = 100; a2.uid = 200;                 /* card uids */
  const e1 = 2000, e2 = 1000;                 /* entry uids, reversed */
  let g = H.state({res: 9, ap: 1, board: [
      {card: a2, kind: "ally", uid: e2, spent: false, life: 3},
      {card: a1, kind: "ally", uid: e1, spent: false, life: 3}]},
    {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  const first = SP.act(g, 0);
  assert.equal(first.uid, e2,
    "the tie must break on the ENTRY's uid — that is what judge is addressed with");
  /* Same state, board order reversed — the choice must not move. */
  const flipped = {...g, sides: g.sides.map((s, i) => i ? s : {...s, board: s.board.slice().reverse()})};
  assert.equal(SP.act(flipped, 0).uid, first.uid,
    "board order must not decide which ally swings — two peers would diverge");
});

/* ---- 3. THE CONTRACT STILL HOLDS ------------------------------------- */

test("the arena branch reads no card text", () => {
  /* sparring.js's founding rule: it ranks on printed NUMBERS and asks
     `legal` for everything else, so a seat playing badly and a card being
     read wrong are never confusable. `GM.isAlly` reads the board ENTRY's
     kind, not a printed type line, which is why it is allowed here. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "sparring.js"), "utf8");
  for(const bad of [/require\(["']\.\/parser/, /fxParse/, /weaponCost/, /allyAttack/,
                    /\.tx\b/, /\.kw\b/, /\.tt\b/, /\.ty\b/])
    assert.ok(!bad.test(src), "sparring.js must not read card text: " + bad);
  assert.match(src, /GM\.isAlly/, "the ally test is the board entry's kind, not a type line");
});

test("the hero's own ability is proposed too — it never was", {skip}, () => {
  /* 0 hero-ability activations across 210 games, for the same reason:
     nothing offered one. It goes LAST, behind the attacks, because every
     printed hero ability in this pool digs or buffs rather than dealing
     damage — and deciding otherwise would mean reading the card. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "sparring.js"), "utf8");
  const ally = src.indexOf('x.ally ? {t: "activate"');
  const hero = src.indexOf('from: "hero", uid: "hpow"');
  assert.ok(ally > 0 && hero > 0, "both branches must exist");
  assert.ok(hero > ally, "the hero ability is proposed after the attacks, not before");
});
