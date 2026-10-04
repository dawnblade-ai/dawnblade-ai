/* ======================================================================
   "WHEN THIS ATTACKS OR DEFENDS" — THE DEFEND HALF (v4.97)

   > "When this attacks or defends, if you have less {h} than an opposing
   >  hero, gain 1{h}." — FYENDAL'S FIGHTING SPIRIT
   > "When this attacks or defends, if you control an aura of suspense,
   >  create a Confidence token." — FULL OF BRAVADO

   One printed clause naming two events. The parser read the ATTACK half and
   flagged the clause `approx` with the note "the defend half has no trigger
   point yet", so both cards did nothing when they blocked — six records,
   every one `tier: full`, and weaker than printed, which is the direction
   the one-sided sweep is built not to look in.

   Found by the condition census v4.97 ran over 210 driven games (every
   "condition not met" line, tallied by kind), which is how a reader that
   READS the clause and answers only half of it surfaces at all.

   The payload is DRIVEN through `defendsTriggers`, the one body both boards'
   walls call, at the defender's seat.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const card = (nm, p, uid) => ({...H.card(nm, p), uid});
/* seat 1 DEFENDS seat 0's swing */
const wallAt = (mine, theirs) => H.state(Object.assign({hp: 20}, theirs), Object.assign({hp: 20}, mine), {actor: 0, turnPlayer: 0});
const defend = (g, dc) => H.fx(g, (f, n) => f.defendsTriggers(n, 1, [dc], [])).game;

test("the parse carries the defend half as an opt-in flag on the gated entry", {skip}, () => {
  H.db(); P.fxReset();
  for(const nm of ["Fyendal's Fighting Spirit", "Full of Bravado"])
    for(const p of [1, 2, 3]){
      const fx = P.fxParse(H.card(nm, p));
      const ent = (fx.conds || []).filter(c => c.alsoDef);
      assert.equal(ent.length, 1, nm + " " + p + " lost its defend half");
      assert.ok(!fx.approx, nm + " is still flagged as an approximation");
    }
  /* and the flag is OPT-IN — an ordinary gate's shape does not move (v3.58) */
  const sec = P.fxParse(H.card("Second Strike", 1)).conds;
  assert.ok(sec.every(c => !("alsoDef" in c)), "every cond entry grew a key");
});

test("Fyendal's Fighting Spirit gains its life when it DEFENDS while behind", {skip}, () => {
  H.db();
  const fy = card("Fyendal's Fighting Spirit", 1, "FY");
  const behind = defend(wallAt({hp: 10}, {hp: 20}), fy);
  assert.equal(behind.sides[1].hp, 11, "the defender behind on life gained 1");
  assert.equal(behind.sides[0].hp, 20, "…and the attacker did not");
  const ahead = defend(wallAt({hp: 20}, {hp: 10}), fy);
  assert.equal(ahead.sides[1].hp, 20, "ahead on life, nothing — the gate is the printed one");
  assert.equal(behind.actor, 0, "the borrowed seat was handed back");
});

test("Full of Bravado creates its Confidence when it DEFENDS beside an aura of suspense", {skip}, () => {
  H.db();
  const fb = card("Full of Bravado", 1, "FB");
  const aog = card("Act of Glory", 1, "AG");
  const withAura = defend(wallAt({board: [{card: aog, kind: "aura", uid: "AG"}]}), fb);
  assert.ok(withAura.sides[1].board.some(b => /confidence/i.test(b.card && b.card.name || "")),
    "no Confidence token on the DEFENDER's board");
  assert.ok(!withAura.sides[0].board.some(b => /confidence/i.test(b.card && b.card.name || "")),
    "the token went to the attacker");
  const bare = defend(wallAt({}), fb);
  assert.ok(!bare.sides[1].board.some(b => /confidence/i.test(b.card && b.card.name || "")),
    "no aura of suspense, no token");
});

test("an unknown gate on the defend half answers FALSE", () => {
  const g = {sides: [{hp: 20, board: []}, {hp: 5, board: []}]};
  assert.equal(E.defendsCondMet(g, 1, "lifeLt"), true, "control: the known gate answers");
  assert.equal(E.defendsCondMet(g, 1, "somethingNew"), false);
});

test("CENSUS: every defend-half gate the pool prints is in the closed vocabulary, and every one is GATED", {skip}, () => {
  H.db(); P.fxReset();
  const seen = new Set(), gates = new Set(), ungated = [];
  for(const r of require("../data/pool.json")) for(const p of [1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name) continue;
    const k = c.name + "|" + c.pitch; if(seen.has(k)) continue; seen.add(k);
    for(const ce of (P.fxParse(c).conds || [])) if(ce.alsoDef) gates.add(ce.cond);
    /* the printed clause with no gate would land nowhere the defend half reads */
    if(/when this attacks or defends, (?!if )/i.test(c.tx || "")) ungated.push(k);
  }
  assert.ok(seen.size > 300, "the scan saw the pool");
  assert.deepEqual([...gates].sort(), [...E.DEFENDS_CONDS].sort(),
    "a gate arrived that `defendsCondMet` does not answer — or the vocabulary carries one nothing prints");
  assert.deepEqual(ungated, [], "an UNGATED attacks-or-defends payload has no defend half reader");
});

/* ---- THE LAST `approx` FLAG, READ EXACTLY (v4.97) ------------------- */

test("'when this enters the arena' fires as the permanent resolves — and only Concealed Object reaches it", {skip}, () => {
  /* It was flagged `approx` with the note "the trainer has no
     leaves/enters-the-arena schedule". Entering the arena IS resolving into
     it, so on-play is the exact moment; and leaving has had a schedule since
     v3.20. Measured over the pool, one record reaches the enters reader. */
  H.db(); P.fxReset();
  const seen = new Set(), reach = [];
  for(const r of require("../data/pool.json")) for(const p of [1, 2, 3, 0]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name) continue;
    const k = c.name + "|" + c.pitch; if(seen.has(k)) continue; seen.add(k);
    if(/when this enters the arena,/i.test(c.tx || "") && !/enters or leaves/i.test(c.tx || "")) reach.push(c);
  }
  assert.deepEqual(reach.map(c => c.name), ["Concealed Object"]);
  const fx = P.fxParse(reach[0]);
  assert.equal(fx.perm, "item", "it is a permanent — it enters the arena by resolving");
  assert.ok(fx.ops.some(o => o[0] === "boo"), "its payload rides to resolution");
});

test("PREMISE: the leave readers claim every leave wording, so none reaches the enters line", () => {
  for(const t of ["When this leaves the arena, gain 1{h}.",
                  "When this leaves the arena by a route nobody prints, gain 1{h}.",
                  "When this enters or leaves the arena, gain 1{h}."]){
    const r = P.classifyClause(t);
    assert.ok(r && r.onLeave, "a leave wording fell through: " + t
      + " — it would now fire on PLAY, v3.07's printed delay collected as a bonus");
  }
});
