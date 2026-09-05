/* ============================================================
   THREE "THIS TURN" GRANTS THAT NEVER EXPIRED (v4.07)

   v4.06 fixed `dracNext` — a grant nothing spent and, at the table,
   nothing cleared — and the obvious next question is whether it was the
   only one. It was not. **Every field an op writes, against the sweep
   that is supposed to take it back** turned up three more, all printed
   "this turn" and none of them in `beginEndPhase`'s step (8):

     amp          "The next card you play THIS TURN with an arcane damage
                   effect…"                    — ABSORB IN AETHER,
                                                  CINDERING FORESIGHT
     runeHitNext  "The next Runeblade attack action card you play THIS
                   TURN gets go again and …"   — MAUVRION SKIES
     ward         "The next time you would be dealt damage THIS TURN,
                   prevent N of that damage."  — CLOUD COVER, OASIS
                   RESPITE, TOE THE LINE, THROW CAUTION, and three
                   equipment abilities

   All three are single-shot grants SPENT by the card they name — so the
   bug only shows when the grant is NOT spent, which is the ordinary case
   for a prevention nobody attacks into. It then follows its controller
   into every later turn of the game. **Stronger than printed**, and the
   one-sided fairness sweep is built not to look in that direction.

   ---- THE PREVENTION POOL HAS TWO SOURCES, AND ONE WINDOW ------------

   `ward` is fed by the "prevent … this turn" family AND by an aura's
   printed `Ward N` keyword — Spectral Shield, Waxing Specter, Uphold
   Tradition. Measured over the pool: **11 of 11 printed preventions say
   "this turn"; not one aura keyword does.**

   Sweeping the pool whole would take the aura's ward with it, and
   whether a board aura's ward feeds the prevention pool at all is an
   OPEN RULING (v3.84, `tools/approx.js`). So the window is read off the
   printed clause and only the windowed portion is taken back —
   `wardTurn` — which decides nothing about auras.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const card = (n, p) => C.resolveEntry(H.db(), {name: n, p, code: null, q: 1});

/* ============================================================
   A. THE WINDOW IS READ, NOT ASSUMED
   ============================================================ */

test("the printed clause decides whether a prevention expires", {skip}, () => {
  H.db();
  /* THE TWO SOURCES, SIDE BY SIDE. This is the whole discriminator, and
     it is a fact about the CLAUSE rather than about which cards happen
     to be in the pool today. */
  const cloud = card("Cloud Cover", 1);
  const shield = card("Spectral Shield", 0);
  assert.match(String(cloud.tx), /this turn/i, "fixture: Cloud Cover stopped printing its window");
  assert.ok(!/this turn/i.test(String(shield.tx)), "fixture: the aura token now prints a window");

  const cw = P.fxParse(cloud).ops.find(o => o[0] === "ward");
  const sw = P.fxParse(shield).ops.find(o => o[0] === "ward");
  assert.equal(cw && cw[2] && cw[2].until, "turn",
    "a printed 'this turn' prevention carries no window — the pool never expires");
  assert.equal(sw && sw[2] && sw[2].until, undefined,
    "an aura's printed `Ward N` carries a turn window — sweeping it would decide the " +
    "open aura-ward ruling by accident");

  /* AND THE NEAR-MISS IS SYNTHETIC, because no pool card prints one
     (v3.73). Every prevention here says "this turn", so making the
     window unconditional is SILENT against every real fixture — the
     same clause without the phrase is the only thing that separates
     "the window is READ" from "the window is assumed". */
  const bare = P.classifyClause("prevent the next 2 damage that would be dealt to you");
  assert.deepEqual(bare, {status: "run", ops: [["ward", 2]]},
    "a prevention printing NO window was given one — the reader is assuming rather " +
    "than reading, and an aura's ward would expire with it");

  const arc = P.classifyClause("prevent the next 1 arcane damage that would be dealt to you this turn");
  assert.deepEqual(arc, {status: "run", ops: [["awd", 1, {until: "turn"}]]},
    "the arcane pool does not carry the same printed window as the physical one");
});

test("EVERY prevention the parser reads carries the window its clause prints", {skip}, () => {
  H.db();
  /* THE MEASUREMENT THIS BUILD RESTS ON, DRIVEN rather than grepped.
     The first draft scanned for "prevent the next N" and found SIX
     records — because Cloud Cover and Toe the Line print "The next time
     you would be dealt damage this turn, PREVENT N OF THAT DAMAGE",
     which that wording does not reach. A scan aimed at one spelling
     under-reports exactly like a missing feature (v3.81), so the
     question is asked of the PARSER: every op it emits, against the
     clause it emitted it from. */
  const fs = require("fs");
  const raw = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "data", "pool.json"), "utf8"));
  const seen = new Set();
  let pools = 0, windowed = 0, keywords = 0;
  const wrong = [];
  for(const r of raw){
    if(!r || !r.name) continue;
    const k = r.name + "|" + (r.pitch || 0); if(seen.has(k)) continue; seen.add(k);
    const tx = String(r.functional_text || "");
    if(!/\bward\b|\bprevent\b/i.test(tx)) continue;
    /* THE WINDOW BELONGS TO THE CLAUSE, NOT THE CARD — and the second
       draft of this drill got that wrong. Waning Vengeance prints
       `Ward 3` on its own line AND, in a DIFFERENT clause, "if you've
       pitched a blue card THIS TURN"; asked of the whole card it looked
       like a keyword ward that ought to expire. Ask each clause. */
    for(const cl of tx.split(/\n+/)){
      for(const part of String(cl).split(/(?<=\.)\s+/)){
        let out; try{ out = P.classifyClause(String(part).toLowerCase().trim()); }catch(e){ continue; }
        for(const o of ((out && out.ops) || [])){
          if(o[0] !== "ward" && o[0] !== "awd") continue;
          pools++;
          const says = /\bthis turn\b/i.test(part);
          const has  = !!(o[2] && o[2].until === "turn");
          if(says) windowed++; else keywords++;
          if(says !== has) wrong.push(r.name + " :: " + String(part).slice(0, 60));
        }
      }
    }
  }
  assert.ok(pools >= 8, "the scan found almost no prevention ops — it is aimed wrong");
  assert.deepEqual(wrong, [],
    "a prevention's op disagrees with its own printed clause about whether it expires");
  assert.ok(windowed > 0 && keywords > 0,
    "the pool no longer holds BOTH sources, so this drill can no longer tell them apart — " +
    "which is the whole reason `ward` needed a window rather than a blanket sweep");
});

/* ============================================================
   B. THE SWEEP
   ============================================================ */

test("amp, runeHitNext and the windowed ward all expire with the turn", {skip}, () => {
  H.db();
  /* `beginEndPhase` IS THE SHARED BODY BOTH BOARDS CALL (v3.17), so this
     is a statement about the table AND the trainer. */
  const g = H.state({amp: 3, runeHitNext: 2, ward: 4, wardTurn: 4, awd: 2, awdTurn: 2},
                    {}, {turn: 3, actor: 0});
  const out = E.beginEndPhase(g, 0, H.db());
  const s = out.game.sides[0];
  assert.equal(s.amp, 0, "`amp` survives the turn — Absorb in Aether's +2 amps a card next turn");
  assert.equal(s.runeHitNext, 0, "`runeHitNext` survives — Mauvrion Skies' rider waits forever");
  assert.equal(s.ward, 0, "the windowed prevention survives its printed turn");
  assert.equal(s.wardTurn, 0, "the record of what expires is not itself cleared");
  assert.equal(s.awd, 0, "the arcane prevention survives its printed turn");
});

test("…and an AURA's ward is left exactly where it is", {skip}, () => {
  H.db();
  /* THE HALF THAT DECIDES NOTHING. A pool with no windowed portion is an
     aura's, and the end phase must not touch it — that is the open
     `aura-ward-prevention-pool` ruling's territory, not this build's. */
  const g = H.state({ward: 3, wardTurn: 0}, {}, {turn: 3, actor: 0});
  const out = E.beginEndPhase(g, 0, H.db());
  assert.equal(out.game.sides[0].ward, 3,
    "the sweep took an aura's printed `Ward N` — that decides an open ruling by accident");
});

test("a MIXED pool loses only the windowed part", {skip}, () => {
  H.db();
  /* THE FIXTURE THAT TELLS THE TWO APART. A pool that is all one source
     passes under either reading — sweep-whole and sweep-windowed agree —
     so only a mixed one tests anything (v3.26). */
  const g = H.state({ward: 5, wardTurn: 2}, {}, {turn: 3, actor: 0});
  const out = E.beginEndPhase(g, 0, H.db());
  assert.equal(out.game.sides[0].ward, 3,
    "the mixed pool was not split — either the aura's ward went with the one-shot, or " +
    "the one-shot stayed");
});

test("the ward op records its window when it lands, and only then", {skip}, () => {
  H.db();
  const g = H.state({}, {}, {turn: 3, actor: 0});
  let a = H.runOps(g, [["ward", 3, {until: "turn"}]], "Cloud Cover"); a = a.game || a;
  assert.equal(a.sides[0].ward, 3);
  assert.equal(a.sides[0].wardTurn, 3, "a windowed prevention did not record that it expires");

  let b = H.runOps(g, [["ward", 1]], "Spectral Shield"); b = b.game || b;
  assert.equal(b.sides[0].ward, 1);
  assert.equal(b.sides[0].wardTurn, 0,
    "an aura's ward was recorded as expiring — it will be swept at the end of the turn");
});

/* ============================================================
   C. THE GATE, AND THE LEDGER
   ============================================================ */

test("the sweep's own gate counts the three, or it works by coincidence", {skip}, () => {
  H.db();
  /* `beginEndPhase` STEP (8) SKIPS A SEAT WITH NOTHING HELD. A field
     swept inside that branch but not COUNTED by `held` expires only on a
     turn where something ELSE happened to expire — a sweep that is right
     by accident, which is indistinguishable from one that is right. */
  for(const [field, extra] of [["amp", {amp: 2}], ["runeHitNext", {runeHitNext: 1}],
                               ["wardTurn", {ward: 2, wardTurn: 2}], ["awdTurn", {awd: 2, awdTurn: 2}]]){
    const g = H.state(extra, {}, {turn: 3, actor: 0});
    const out = E.beginEndPhase(g, 0, H.db());
    const s = out.game.sides[0];
    assert.ok(!s.amp && !s.runeHitNext && !s.wardTurn && !s.awdTurn,
      `holding only \`${field}\`, the end phase swept nothing — it is not in the \`held\` gate`);
  }
});

test("both fields are registered in all three ledgers", {skip}, () => {
  /* v3.29's rule: a side field is not real until `SIDE_FIELDS`, `wire.js`
     and `report.js`'s `seat()` all carry it. Missing from the first,
     invariants reports SIDES-ASYMMETRIC; from the second, it is a desync;
     from the third, a bug report silently omits it. */
  const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, "..");
  for(const f of ["wardTurn", "awdTurn"]){
    assert.ok(S.SIDE_FIELDS.indexOf(f) >= 0, `${f} is not in SIDE_FIELDS`);
    assert.ok(S.makeSide({})[f] === 0, `${f} is not seeded by makeSide`);
    assert.match(fs.readFileSync(path.join(ROOT, "engine", "wire.js"), "utf8"),
      new RegExp('"' + f + '"'), `${f} does not travel on the wire — a dropped field is a desync`);
    assert.match(fs.readFileSync(path.join(ROOT, "engine", "report.js"), "utf8"),
      new RegExp("\\b" + f + "\\b"), `${f} is missing from a JUDGE!! report`);
  }
});

test("the rider merge keeps the window — Toe the Line carries both", {skip}, () => {
  H.db();
  P.fxReset();
  /* THE ONE CARD THAT PRINTS A RIDER *AND* A WINDOW, so it is the one
     that proves the merge preserves what the matcher attached. Written
     as a fresh literal the merge DROPPED the window (v2.34's rule at the
     consumer end, v3.53). */
  const toe = card("Toe the Line", 1);
  const op = P.fxParse(toe).ops.find(o => o[0] === "ward");
  assert.ok(op && op[2], "fixture: Toe the Line's ward carries no options at all");
  assert.equal(op[2].until, "turn", "the rider merge dropped the printed window");
  assert.ok((op[2].ops || []).length, "…and the merge dropped the rider instead");
  P.fxReset();
});
