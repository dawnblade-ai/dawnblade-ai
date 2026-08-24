/* ============================================================
   THE RESTRICTION AFTER THE SUBJECT (v3.31)

   Every reader of the target-attack family captured the words BEFORE the
   word "attack" and let `[^.]*` swallow everything after it:

     target attack action card WITH COST 1 OR LESS gets +3{p}
     target attack WITH 3 OR LESS BASE {p} gets +1{p}
     target attack WITH STEALTH gets go again
     your next attack action card YOU PLAY FROM ARSENAL this turn ...
     your next attack YOU BOOST this turn ...
     the next NON-ATTACK action card you play this turn gets go again

   Thirteen pool cards printed a restriction there and applied to any
   attack at all. Lightning Press pumped a cost-3 attack; Mage Master
   Boots handed go again to the next ATTACK because "non-attack" contains
   the substring "attack" — the CR-1.4.5-adjacent trap this project has
   named since v2.44, on the most valuable keyword in the game to get
   wrong.

   ALL OF THEM READ `tier: full`. The clause WAS consumed; coverage counts
   consumption, never faithfulness. The fairness sweep could not see it
   either: its captures stopped at the same word.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const cc = t => P.classifyClause(t);

/* ---- 1. THE TAIL READER --------------------------------------------- */

test("attackTail reads each printed atom, and only what it can name", () => {
  assert.deepEqual(P.attackTail(""), {});
  assert.deepEqual(P.attackTail(" this turn"), {}, "a WINDOW is not a restriction");
  assert.deepEqual(P.attackTail(" this combat chain"), {});
  assert.deepEqual(P.attackTail(" action card"), {aac: true});
  assert.deepEqual(P.attackTail(" with stealth"), {kw: "stealth"});
  assert.deepEqual(P.attackTail(" action card with cost 1 or less"), {aac: true, costLe: 1});
  assert.deepEqual(P.attackTail(" action card with cost 2 or more"), {aac: true, costGe: 2});
  assert.deepEqual(P.attackTail(" with 3 or less base {p}"), {powLe: 3});
  assert.deepEqual(P.attackTail(" action card you play from arsenal this turn"), {aac: true, from: "arsenal"});
  assert.deepEqual(P.attackTail(" you boost this turn"), {boosted: true});
  /* punctuation moves upstream — v3.00's drift, one layer down */
  assert.deepEqual(P.attackTail(" action card you play this turn,"), {aac: true});
});

test("an UNREADABLE tail is null, and null is not the same answer as {}", () => {
  /* {} means "nothing restricts this"; null means "something does and we
     cannot say what". Collapsing the two is how the bug shipped. */
  assert.equal(P.attackTail(" with a nonsense qualifier"), null);
  assert.equal(P.attackTail(" that is defended by two cards"), null);
  assert.notEqual(P.attackTail(""), null, "an empty tail restricts nothing — it is not unreadable");
});

test("attackQual returns FALSE on an unreadable tail, and the clause refuses", () => {
  assert.equal(P.attackQual("", " with a nonsense qualifier"), false);
  assert.equal(P.attackQual(""), null, "no qualifier at all is null");
  assert.equal(cc("Target attack action card with a nonsense qualifier gets +3{p}."), null,
    "an unreadable restriction must refuse the whole clause — pumping an illegal "
    + "target is the direction that steals games");
  assert.equal(cc("Target attack with a nonsense qualifier gets go again."), null);
});

/* ---- 2. THE FIVE SHAPES, OFF REAL PRINTED WORDINGS ------------------- */

test("every printed tail shape reaches the op", () => {
  const q = t => cc(t).ops[0][2];
  assert.deepEqual(q("Target attack action card with cost 1 or less gets +3{p}."),
    {aac: true, costLe: 1}, "Lightning Press");
  assert.deepEqual(q("Target attack action card with cost 2 or more gets +4{p}."),
    {aac: true, costGe: 2}, "Pummel's second mode");
  assert.deepEqual(q("Target attack with 3 or less base {p} gets +1{p}."),
    {powLe: 3}, "Nip at the Heels");
  assert.deepEqual(q("Target attack action card with stealth gets +3{p}."),
    {aac: true, kw: "stealth"}, "Spike with Bloodrot");
  assert.deepEqual(q("Your next attack action card you play from arsenal this turn gets +2{p}."),
    {aac: true, from: "arsenal"}, "Scout the Periphery");
  assert.deepEqual(q("Your next attack you boost this turn gets +4{p}."),
    {boosted: true}, "Re-Charge!");
  /* THE NUMBER IS THE CARD'S, never a literal */
  assert.equal(cc("Target attack action card with cost 5 or less gets +3{p}.").ops[0][2].costLe, 5);
  assert.equal(cc("Target attack with 7 or less base {p} gets +1{p}.").ops[0][2].powLe, 7);
});

test("the HEAD still works, and head and tail combine", () => {
  assert.deepEqual(cc("Target sword or dagger attack gains +3{p}.").ops[0][2],
    {g: [["sword"], ["dagger"]]});
  assert.deepEqual(cc("The next Ranger attack action card you play this turn gets +3{p}.").ops[0][2],
    {aac: true, g: [["ranger"]]}, "a type word AND a type restriction");
});

/* ---- 3. MATCHING ----------------------------------------------------- */

const mk = (o) => Object.assign({name: "X", tt: "", ty: [], tx: "", kw: []}, o);
const aac = (pw, cost) => mk({tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
                              power: pw, cost: cost});

test("a cost bound reads the PRINTED cost, and a card with none satisfies nothing", () => {
  const q = {costLe: 1};
  assert.equal(P.qualMatches(q, aac(4, 0)), true);
  assert.equal(P.qualMatches(q, aac(4, 3)), false);
  /* EQUIPMENT, WEAPONS AND BLOCKS PRINT `cost: null`. Reading that as 0
     hands every "cost 1 or less" buff to a weapon swing — which is what a
     `+(c.cost||0)` would do, and the bound would then restrict nothing at
     the one place it most needs to. */
  assert.equal(P.qualMatches(q, mk({tt: "Warrior Weapon - Sword", ty: ["Warrior", "Weapon"],
                                    power: 4, cost: null})), false,
    "a weapon prints no cost — it cannot satisfy a printed cost comparison");
  assert.equal(P.qualMatches({costGe: 2}, aac(4, 2)), true);
  assert.equal(P.qualMatches({costGe: 2}, aac(4, 1)), false);
});

test("a base-power bound reads the printed number, never the pumped total", () => {
  assert.equal(P.qualMatches({powLe: 3}, aac(3, 0)), true);
  assert.equal(P.qualMatches({powLe: 3}, aac(4, 0)), false);
  assert.equal(P.qualMatches({powLe: 3}, mk({tt: "Generic Action", ty: ["Generic", "Action"]})), false,
    "a card with no printed power satisfies no power comparison");
});

test("`attack action card` excludes a weapon, a reaction and a non-attack", () => {
  const q = {aac: true};
  assert.equal(P.qualMatches(q, aac(4, 1)), true);
  assert.equal(P.qualMatches(q, mk({tt: "Warrior Weapon - Sword", ty: ["Warrior", "Weapon"], power: 4})), false);
  /* "REACTION" CONTAINS "ACTION" — a `tt` substring test hands the buff to
     a card the words never name (v2.44). */
  assert.equal(P.qualMatches(q, mk({tt: "Warrior Attack Reaction", ty: ["Warrior", "Attack Reaction"], power: 3})), false);
  assert.equal(P.qualMatches(q, mk({tt: "Runeblade Action", ty: ["Runeblade", "Action"]})), false);
});

test("`non-attack action card` is the other half, and they share no card", () => {
  const na = {nonAtk: true};
  assert.equal(P.qualMatches(na, mk({tt: "Runeblade Action", ty: ["Runeblade", "Action"]})), true);
  assert.equal(P.qualMatches(na, aac(4, 1)), false);
  /* A DEFENSE REACTION IS NEITHER, so the two are not complements. */
  const dr = mk({tt: "Guardian Defense Reaction", ty: ["Guardian", "Defense Reaction"]});
  assert.equal(P.qualMatches(na, dr), false);
  assert.equal(P.qualMatches({aac: true}, dr), false);
});

test("stealth asks printedKw — CARRIES it, not merely mentions it", {skip}, () => {
  H.db();
  /* RULING 2026-07-25: stealth "does nothing on its own — other cards
     check to see if an attack HAS stealth as a qualifier". Seven pool
     cards carry it on its own line; seven only name it inside a sentence.
     `hasKw` is deliberately loose and answers TRUE for both, so asking it
     here would let Spike with Bloodrot target ITSELF's own wording. */
  const carries = H.card("Mark the Prey", 1);
  const mentions = H.card("Spike with Bloodrot", 1);
  assert.equal(P.printedKw(carries, "stealth"), true, "fixture check");
  assert.equal(P.hasKw(mentions, "stealth"), true, "…and the loose predicate says yes to both");
  assert.equal(P.printedKw(mentions, "stealth"), false, "…which is exactly why it is the wrong one");

  assert.equal(P.qualMatches({kw: "stealth"}, carries), true);
  assert.equal(P.qualMatches({kw: "stealth"}, mentions), false,
    "a card that only REFERENCES the keyword does not have it");
});

test("a bare array is the retired shape and matches NOTHING", () => {
  /* Every field test below an array passes vacuously, so a stale caller
     would silently get "matches everything". It refuses instead — and it
     does not THROW, because `reduce` is fed by JSON off a wire. */
  assert.equal(P.qualMatches([["weapon"]], mk({tt: "Warrior Weapon - Sword"})), false);
  assert.equal(P.qualMatches(null, aac(4, 1)), true, "…while no qualifier really does hit everything");
});

test("the play context is the CALLER's answer, and absent means no", () => {
  assert.equal(P.qualMatches({from: "arsenal"}, aac(4, 0), {from: "arsenal"}), true);
  assert.equal(P.qualMatches({from: "arsenal"}, aac(4, 0), {from: "hand"}), false);
  assert.equal(P.qualMatches({from: "arsenal"}, aac(4, 0)), false,
    "a caller that does not say answers no — the buff waits rather than landing wrongly");
  assert.equal(P.qualMatches({boosted: true}, aac(4, 0), {boosted: true}), true);
  assert.equal(P.qualMatches({boosted: true}, aac(4, 0), {boosted: false}), false);
});

test("`atk` is the CALLER's answer, and a weapon swing satisfies it", () => {
  /* THE ATOM CANNOT BE DERIVED HERE, and deriving it is the tempting bug:
     `isAttack` reads the type line, and a WEAPON's line carries no
     "Attack" at all — so `isAttack(Dawnblade)` is false and a derived
     atom would refuse every weapon swing, which is the whole of Hit and
     Run. `execute` decides it once to pick its branch and hands it down. */
  const wpn = mk({tt: "Warrior Weapon - Sword (2H)", power: 4});
  assert.equal(P.isAttack(wpn), false, "the premise: a weapon's type line says no");
  assert.equal(P.qualMatches({atk: true}, wpn, {from: "weapon", atk: true}), true,
    "and the caller saying yes is what lets the swing collect the grant");
  assert.equal(P.qualMatches({atk: true}, aac(4, 1), {atk: true}), true);
  assert.equal(P.qualMatches({atk: true}, aac(4, 1), {}), false,
    "a caller that does not say answers no — weaker than printed and visible");
  assert.equal(P.qualMatches({atk: true}, aac(4, 1)), false, "and absent opts is the same answer");
});

test("a bare qualifier is the shape v3.42 retired, and it matches NOTHING", () => {
  /* THE SAME MOVE, ONE SHAPE LATER. v3.31 retired the bare ARRAY and wrote
     the guard; v3.42 retired the bare QUALIFIER (entries became
     `{q, rider}`) and did not. On a stale entry `x.q` is undefined, and
     `qualMatches` answers TRUE for an absent qualifier BY DESIGN — so a
     pre-v3.42 entry off a wire or a replay granted go again to any card at
     all and spent itself doing it.

     The guard lives in `takeGaNext` rather than here, because "an absent
     qualifier hits everything" is correct for `qualMatches` and wrong only
     for an ENTRY that should always carry one. This drill pins the premise
     the guard depends on, so the two cannot drift apart. */
  assert.equal(P.qualMatches(undefined, aac(4, 1)), true,
    "the premise: an absent qualifier really does hit everything, which is "
    + "why a stale entry must be refused before it ever reaches this matcher");
});

test("qualLabel names a qualifier once, so five sites cannot disagree", () => {
  assert.equal(P.qualLabel(null), "an attack");
  assert.equal(P.qualLabel({g: [["sword"], ["dagger"]]}), "a sword or dagger attack");
  assert.equal(P.qualLabel({aac: true, costLe: 1}), "an attack action card with cost 1 or less");
  assert.equal(P.qualLabel({kw: "stealth"}), "an attack with stealth");
  assert.equal(P.qualLabel({nonAtk: true}), "a non-attack action card");
});

/* ---- 4. DRIVEN — the qualified go-again ------------------------------ */

const nonAtk = u => ({name: "Ritual" + u, tt: "Runeblade Action", ty: ["Runeblade", "Action"],
                      tx: "", kw: [], cost: 0, pitch: 1, uid: u});
const atkCard = (u, pw) => ({name: "Swing" + u, tt: "Generic Action - Attack",
                             ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
                             power: pw, cost: 0, pitch: 1, uid: u});
const armed = q => {
  P.fxReset();
  let g = H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  return H.runOps(g, [["gaNext", q]], "drill");
};

test("a qualified go-again lands on the card it names", () => {
  const g = armed({powLe: 3});
  assert.equal(g.sides[0].gaNextQ.length, 1, "it waits on the side, not on the boolean");
  assert.equal(g.sides[0].gaNext, false, "and never on the unqualified one");
  const out = H.execute(g, atkCard("a", 3), "hand", 0, {});
  /* AN ATTACK SETTLES ON THE CHAIN, not at the action point, so `ga` rides
     on the pend — reading `ap` here would answer 1 either way and the
     drill would pass on an engine that granted nothing. */
  assert.equal(out.pend.ga, true, "the declared link carries go again");
  assert.equal((out.sides[0].gaNextQ || []).length, 0, "and it is spent");
});

test("a qualified go-again that does NOT match is not spent — it waits", () => {
  /* v2.30's rule for `buffQ`, and the reason a qualified grant is a list
     rather than a flag: spending it on the wrong card both grants what
     the text forbids and destroys what it promised. */
  const g = armed({powLe: 3});
  const out = H.execute(g, atkCard("a", 6), "hand", 0, {});
  assert.equal(out.pend.ga, false, "a 6-power attack is not what it named");
  assert.equal((out.sides[0].gaNextQ || []).length, 1, "and the grant is still waiting");
});

test("the NON-ATTACK go-again reaches a non-attack, and never an attack", () => {
  /* Mage Master Boots: "the next NON-ATTACK action card you play this turn
     gets go again". The old reader matched the substring "attack" inside
     "non-attack" and handed it to the next ATTACK — strictly stronger
     than printed, on the keyword that keeps your action point. */
  const hit = H.execute(armed({nonAtk: true}), nonAtk("r"), "hand", 0, {});
  assert.equal(hit.sides[0].ap, 1, "the non-attack keeps the point");
  assert.equal((hit.sides[0].gaNextQ || []).length, 0, "spent by what it named");

  const miss = H.execute(armed({nonAtk: true}), atkCard("a", 4), "hand", 0, {});
  assert.equal((miss.sides[0].gaNextQ || []).length, 1,
    "an ATTACK must not take it — that was the bug, and it was invisible");
});

test("the unqualified wording still spends the plain boolean", () => {
  P.fxReset();
  let g = H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g = H.runOps(g, [["gaNext"]], "drill");
  assert.equal(g.sides[0].gaNext, true, "no qualifier, no list");
  assert.equal((g.sides[0].gaNextQ || []).length, 0);
});

/* ---- 5. DRIVEN — the play context on a qualified PUMP ---------------- */

const armedBuff = q => {
  P.fxReset();
  let g = H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  return H.runOps(g, [["buffNext", 3, q]], "drill");
};

test("a `from arsenal` buff lands only on a card played from the arsenal", () => {
  const c = atkCard("a", 4);
  const fromHand = H.execute(armedBuff({aac: true, from: "arsenal"}), c, "hand", 0, {});
  assert.equal(fromHand.pend.total, 4, "played from hand: the printed power, nothing added");
  const fromArs = H.execute(armedBuff({aac: true, from: "arsenal"}), c, "arsenal", 0, {});
  assert.equal(fromArs.pend.total, 7, "played from arsenal: +3, exactly as printed");
});

/* ---- 6. THE POOL, END TO END ---------------------------------------- */

test("every pool card printing a tail restriction now carries it", {skip}, () => {
  H.db();
  const want = {
    "Lightning Press":       {aac: true, costLe: 1},
    "Nip at the Heels":      {powLe: 3},
    "Spike with Bloodrot":   {aac: true, kw: "stealth"},
    "Stains of the Redback": {kw: "stealth"},
    "Nimblism":              {aac: true, costLe: 1},
    "Orb-Weaver Spinneret":  {kw: "stealth"},
    "Prime the Crowd":       {aac: true},
    "Take Aim":              {aac: true, g: [["ranger"]]},
    "Scout the Periphery":   {aac: true, from: "arsenal"},
    "Teklo Trebuchet 2000":  {boosted: true},
    "Re-Charge!":            {boosted: true},
    /* +`atk` at v3.43: this is the census's one `gaNext` entry, and
       `gaNext` is the one grant whose qualifier had to learn the atom. The
       other eleven read `buffNext`/`selfQ`/modes and are unmoved — which
       is the measured blast radius, not an assumption. */
    "Trot Along":            {powLe: 3, atk: true}
  };
  for(const [nm, q] of Object.entries(want)){
    let got = null;
    for(const p of [0, 1, 2, 3]){
      const c = H.card(nm, p);
      if(!c || !c.tx) continue;
      P.fxReset();
      const fx = P.fxParse(c);
      got = fx.selfQ || fx.gaQ
         || (fx.ops.find(o => o[0] === "buffNext") || [])[2]
         || (fx.ops.find(o => o[0] === "gaNext") || [])[1]
         || (fx.modes || []).map(m => m.q).filter(Boolean)[0];
      break;
    }
    assert.deepEqual(got, q, nm + " must carry its printed restriction");
  }
  /* AND THE COUNT IS ASSERTED, because a census that quietly stopped
     finding cards would pass by finding nothing. */
  assert.equal(Object.keys(want).length, 12);
});
