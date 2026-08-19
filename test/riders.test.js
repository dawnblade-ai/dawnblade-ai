/* ============================================================
   A GRANTED ABILITY RIDES ALONGSIDE — READ IT (v3.10)

   FaB prints a granted ability in QUOTES, which is what makes it readable
   rather than guessable: the quoted text is a clause in its own right, so
   it goes back through `classifyClause`. The next-attack pump rule has
   done this since v2.30. Three other printed shapes did not, and each
   dropped the rider in its own way:

     "this GETS \"...\""            the anchor spelled only `gains`, so the
                                    quote fell into the loose payload
                                    matchers — which found the payload and
                                    LOST THE TRIGGER
     "this gets go again and \"…\"" unanchored: the head was lost too
     "…create N Runechant tokens"   tested as the bare string "create a
                                    runechant", so only the blue copy
                                    matched, into a BOOLEAN

   28 pool cards grant a quoted ability. 7 carried their rider before this
   version. **Every card fixed here reported tier `full` throughout** —
   coverage counts the clause as consumed either way.

   AND A TRIGGER STRIPPED OF ITS TRIGGER IS STRONGER THAN PRINTED. Bolt of
   Courage drew a card on PLAY rather than on hit; Hot on Their Heels
   marked on play. That is the direction that steals games, and the
   fairness sweep's five checks do not include "a trigger lost its
   trigger".
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const fx = (n, p) => { P.fxReset && P.fxReset(); return P.fxParse(H.card(n, p)); };
const cc = c => P.classifyClause(c);

/* ---- ALL THREE PRINTED VERBS ---------------------------------------- */

test("gains, gets and has all read a quoted granted ability", () => {
  /* CLAUDE.md has said since v2.12 that FaB prints all three and every
     anchor must accept all three. This one spelled only `gains`. */
  for(const verb of ["gains", "gets", "has"]){
    const r = cc(`this ${verb} "when this hits, draw a card"`);
    assert.deepEqual(r.ops, [["draw", 1]], verb);
    assert.equal(r.onHit, true,
      `${verb}: the TRIGGER must survive — without it the draw fires on play`);
  }
});

/* ---- THE PAYLOAD MUST NOT FIRE ON PLAY ------------------------------ */

test("Bolt of Courage's draw is a GATED on-hit rider, not an on-play op", {skip}, () => {
  H.db();
  const f = fx("Bolt of Courage", 1);
  assert.deepEqual(f.condOnHit, [{cond: "charged", op: ["draw", 1]}],
    "gated on the charge AND deferred to the hit — two separate mistakes if either is lost");
  assert.ok(!f.ops.some(o => o[0] === "draw"), "nothing draws on play");
});

test("driven: playing Bolt of Courage uncharged draws no card", {skip}, () => {
  H.db();
  const c = H.card("Bolt of Courage", 1);
  const g = H.state({hand: [c], deck: [H.card("Raging Onslaught", 1), H.card("Raging Onslaught", 2)], res: 9},
                    {}, {turn: 3, actor: 0});
  const n = H.execute(g, c, "hand", 0, {});
  assert.equal(n.sides[0].hand.length, 0, "the card left to attack and nothing replaced it");
  assert.deepEqual(n.pend.condOnHit, [{cond: "charged", op: ["draw", 1]}],
    "the rider rides on the pend, for the hit to re-check");
});

/* ---- THE HEAD SURVIVES TOO ------------------------------------------ */

test("Hot on Their Heels keeps its go again AND gates its mark on the hit", {skip}, () => {
  H.db();
  const f = fx("Hot on Their Heels", 1);
  /* Unanchored, this fell to the loose `mark them` matcher — so GO AGAIN
     was thrown away (weaker than printed) and the mark fired on play
     (stronger than printed). One clause, wrong in both directions. */
  assert.deepEqual(f.conds.map(x => [x.cond, x.op]), [["drac2", ["ga"]]], "the head");
  assert.deepEqual(f.condOnHit, [{cond: "drac2", op: ["mark", 1]}], "the rider");
});

test("driven: Hot on Their Heels marks nobody on play", {skip}, () => {
  H.db();
  const c = H.card("Hot on Their Heels", 1);
  const n = H.execute(H.state({hand: [c], res: 9}, {}, {turn: 3, actor: 0}), c, "hand", 0, {});
  assert.ok(!n.sides[1].marked, "an on-hit trigger must not fire at declaration");
  assert.ok(!n.sides[0].marked, "and certainly not on its own hero");
});

test("Goon Beatdown keeps its pump and gates its boo on the hit", {skip}, () => {
  H.db();
  const f = fx("Goon Beatdown", 3);
  assert.deepEqual(f.conds.map(x => [x.cond, x.op]), [["auras3", ["self", 3]]]);
  assert.deepEqual(f.condOnHit, [{cond: "auras3", op: ["boo", 1]}],
    "and for Lyath a boo is a Might token, so losing it is losing his engine");
});

/* ---- THE PRINTED COUNT ---------------------------------------------- */

test("Mauvrion Skies forges the number of Runechants it prints", {skip}, () => {
  H.db();
  /* 3 at red, 2 at yellow, 1 at blue. The old reader tested for the bare
     string "create a runechant", so only BLUE matched — and `runeHitNext`
     was a boolean, which could not have carried 3 even if it had. */
  for(const [p, want] of [[1, 3], [2, 2], [3, 1]])
    assert.deepEqual(fx("Mauvrion Skies", p).ops, [["gaNext"], ["runeHitNext", want]], `pitch ${p}`);
});

test("driven: the count reaches the side, not a flag", {skip}, () => {
  H.db();
  for(const [p, want] of [[1, 3], [2, 2], [3, 1]]){
    const c = H.card("Mauvrion Skies", p);
    const n = H.execute(H.state({hand: [c], res: 9}, {}, {turn: 3, actor: 0}), c, "hand", 0, {});
    assert.equal(n.sides[0].runeHitNext, want, `pitch ${p} must arm ${want}`);
  }
});

/* ---- AN UNREADABLE RIDER REFUSES; IT DOES NOT GUESS ------------------ */

test("a rider the reader cannot honestly read is dropped, and the head still lands", {skip}, () => {
  H.db();
  /* Display Loyalty's rider triggers on ATTACKS, not on hits — a different
     schedule. Goon Tactics' payload ("destroy the top card of their deck")
     has no reader. Both keep their printed head and claim nothing else,
     which is what leaves the gap visible in the audit instead of hiding
     it behind a guess. */
  const dl = fx("Display Loyalty", 1);
  assert.deepEqual(dl.conds.map(x => [x.cond, x.op]), [["drac2", ["ga"]]], "the go again still lands");
  assert.deepEqual(dl.condOnHit || [], [], "and the attacks-trigger rider is not mis-filed as on-hit");

  const gt = fx("Goon Tactics", 3);
  assert.deepEqual(gt.conds.map(x => [x.cond, x.op]), [["auras3", ["self", 3]]], "the pump still lands");
  assert.deepEqual(gt.condOnHit || [], [], "and an unreadable payload is not invented");
});

/* ---- THE CENSUS IS PINNED ------------------------------------------- */

test("the granted-rider census — pinned, so a regression is a number", {skip}, () => {
  H.db();
  const cards = require("../tools/audit.json").cards;
  let carried = 0, total = 0;
  for(const k of Object.keys(cards)){
    const c = cards[k];
    if(!/"/.test(c.tx || "")) continue;
    const full = H.card(c.name, c.pitch);
    if(!full) continue;
    total++;
    const f = fx(c.name, c.pitch);
    if((f.ops || []).some(o => o[3] && o[3].onHit) || (f.onHit || []).length
       || (f.condOnHit || []).length || (f.ops || []).some(o => o[0] === "runeHitNext")) carried++;
  }
  assert.equal(total, 28, "pool cards granting a quoted ability");
  assert.equal(carried, 15, "carrying their rider — was 7 before v3.10; " +
    "the 13 that do not are honest refusals plus the targeted/modal shapes, still to build");
});
