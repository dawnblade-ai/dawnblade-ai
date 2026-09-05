/* ============================================================
   A KEYWORD PREFIX MUST NOT EAT ITS OWN GATE — THE CENSUS (v4.21)

   v3.59 guarded the ACTIVATION prefixes ("Action - <cost>:", "Instant -",
   "Attack Reaction -") so the loose matchers below could not claim a line
   INCLUDING its cost. v3.99 found the same hazard in a SECOND family —
   the keyword prefixes — and gave `quickstrike` and `rupture` the guard
   `reprise`, `surge` and `high tide` already had.

   IT STOPPED THERE, AND TWO MORE WERE STILL BEING EATEN:

     Static Shock          "LIGHTNING FLOW - When this hits a hero, if
                            you've played a Lightning card this turn,
                            deal 1 arcane damage to them."
     Banneret of Salvation "SOLFLARE - When this is charged to your
                            hero's soul, the next time you hit this turn,
                            gain 1{h}."

   Both read `tier: full`. Both parsed to a BARE unconditional op —
   `[["arcane",1]]` and `[["life",1]]` — fired on PLAY, with the trigger
   AND the gate gone. Stronger than printed twice over on one card.

   NO TOOL HERE COULD SEE IT, for v3.99's own reason: coverage counts the
   clause consumed, and `COND-BYPASSED` needs an unconditional TWIN to
   compare a gate against — when the gate DISAPPEARS there is nothing to
   compare. `npm run fairness` reported clean on both, every run.

   SO THIS FILE IS THE CENSUS RATHER THAN TWO MORE BESPOKE DRILLS. v3.99
   fixed the two members it had found; a census fails the day the pool
   prints an eleventh, which is how these two should have surfaced.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const pool = () => JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "data", "pool.json"), "utf8"));
const mk = c => ({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
  ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
  cost: c.cost, power: c.power, def: c.defense});

/* Every "<Keyword> - <rule>" line the pool prints, excluding the
   ACTIVATION prefixes, which are v3.59's and guarded elsewhere. */
function prefixes(){
  const out = new Map();
  for(const rec of pool()){
    for(const line of (rec.functional_text || "").split(/\n+/)){
      const m = line.match(/^\*?\*?([A-Z][A-Za-z' ]{2,24}?)\*?\*?\s*[-—]\s+(?=[A-Z(])/);
      if(!m) continue;
      const kw = m[1].trim().toLowerCase();
      if(/^(action|instant|attack reaction|defense reaction|once per turn)/.test(kw)) continue;
      if(!out.has(kw)) out.set(kw, new Set());
      out.get(kw).add(rec.name);
    }
  }
  return out;
}

test("the prefix scan is ALIVE before anything is concluded from it", () => {
  /* v4.00's rule — a scan aimed at the wrong shape passes by finding
     nothing, and this whole file reasons from its gaps. */
  const p = prefixes();
  assert.ok(p.size >= 8, `only ${p.size} prefixes found — the scan shape moved`);
  for(const kw of ["crush", "reprise", "surge", "quickstrike", "rupture"])
    assert.ok(p.has(kw), kw + " must be in the scan");
});

test("the pool's keyword prefixes are PINNED — an eleventh is a deliberate edit", () => {
  assert.deepEqual([...prefixes().keys()].sort(), [
    "crush", "high tide", "lightning flow", "material", "quickstrike",
    "reprise", "rupture", "solflare", "surge", "unity",
  ], "a new keyword prefix must be given a reader or a refusal — this is the " +
     "census that would have caught lightning flow and solflare four versions " +
     "earlier than v4.21 did");
});

/* ---- THE PROPERTY ITSELF -------------------------------------------- */

test("no keyword-prefixed clause reaches the card as a BARE payload", {skip}, () => {
  /* THE DEFECT SHAPE, STATED ONCE. A prefixed line whose text carries a
     trigger or a gate ("when"/"if"/"while") must not arrive on the CARD
     as plain `fx.ops` — that is the loose matcher having eaten the prefix
     and everything attached to it. It may be gated (`conds`/`condOnHit`),
     lifted to a dedicated field (`fx.crush`, `fx.defSelf`), or it may
     refuse. What it may not be is unconditional.

     AND IT ASKS `fxParse`, NOT `classifyClause` (v3.56). The first draft
     ran the line through `classifyClause` in isolation and reported
     Gauntlets and Helm of Unity — whose clause a RAW scan inside
     `fxParse` claims first, into `fx.defSelf` (v3.27). Asking the clause
     reader about a whole-card reader's card is asserting a different
     function's answer; the honest question is what the CARD ends up
     with. */
  const bad = new Set();
  for(const rec of pool()){
    const lines = (rec.functional_text || "").split(/\n+/);
    const gated = lines.filter(l =>
      /^\*?\*?([A-Z][A-Za-z' ]{2,24}?)\*?\*?\s*[-—]\s+(?=[A-Z(])/.test(l) &&
      !/^\*?\*?(Action|Instant|Attack Reaction|Defense Reaction|Once per Turn)/i.test(l) &&
      /\b(if|when|whenever|while)\b/i.test(l));
    if(!gated.length) continue;
    P.fxReset();
    const fx = P.fxParse(mk(rec));
    const plain = (fx.ops || []).filter(o => o[0] !== "noop");
    for(const line of gated){
      const iso = P.classifyClause(line.replace(/\*\*/g, "").toLowerCase().replace(/\.$/, ""));
      if(!iso || iso.status !== "run" || iso.cond || iso.onHit) continue;
      /* the ops the LOOSE path would produce, found unconditional on the
         card — the prefix was eaten and nothing caught the clause after */
      for(const o of (iso.ops || [])){
        if(o[0] === "noop" || o[0] === "crushRider") continue;
        if(plain.some(q => JSON.stringify(q) === JSON.stringify(o)))
          bad.add(rec.name + " -> " + JSON.stringify(o));
      }
    }
  }
  assert.deepEqual([...bad].sort(), [],
    "a keyword prefix was eaten along with the gate its own line prints");
});

/* ---- THE TWO CARDS, DRIVEN ------------------------------------------ */

test("Static Shock's gate survives, and it is an ON-HIT-HERO arcane", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Static Shock", 1));
  assert.deepEqual(fx.ops, [], "nothing fires on PLAY any more");
  assert.deepEqual(fx.condOnHit, [
    {cond: "playedCls:lightning", op: ["arcane", 1], heroOnly: true},
  ], "the trigger, the gate and the payload all survive the prefix");
});

test("DRIVEN: Static Shock's arcane needs the Lightning card AND the hit",
     {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A gate that refuses
     everything passes the "does not fire" half perfectly. */
  const hit = played => {
    H.db();
    const pc = {...H.card("Static Shock", 1), uid: 55};
    let g = H.state({res: 9, hist: Object.assign(H.freshHist ? H.freshHist() : {},
      {playTy: played ? [["lightning", "runeblade", "action", "attack"]] : []})},
      {hp: 20}, {turn: 3, actor: 0});
    g = {...g, chain: [], pend: {card: pc, total: 4, ops: [], onHit: [], onHitHero: [],
      condOnHit: P.fxParse(pc).condOnHit || [], ga: false, by: 0, lateConds: [], lateOps: []}};
    const out = J.withEffects(g, (fx, s) =>
      fx.linkPayload(s, {total: 4, pumps: 0, heroHit: true}));
    const st = out.game || out;
    return st.sides[1].hp;
  };
  assert.equal(hit(true), 20 - 1, "a Lightning card was played — the arcane lands");
  assert.equal(hit(false), 20, "none was — and nothing happens");
});

test("Banneret of Salvation REFUSES rather than granting 1{h} on play", {skip}, () => {
  /* AN UNREADABLE REMAINDER REFUSES (v2.29), and refusing is the whole
     point: the old reading gave the life unconditionally the moment the
     card was played, with the charge trigger and the "next time you hit
     this turn" delay both gone. A RECORDED REFUSAL IS A DEBT (v3.38) —
     the tail already reads on its own, so what this waits on is the
     trigger and the schedule, not the payload. */
  P.fxReset();
  const fx = P.fxParse(H.card("Banneret of Salvation", 2));
  assert.deepEqual(fx.ops, [], "no life is granted on play");
  assert.deepEqual(fx.clauses.map(c => c.st), ["skip"],
    "and the clause reports UNREAD, which is what makes the gap visible");

  /* THE PREMISE THE REFUSAL RESTS ON, DRIVEN (v4.11's rule): the tail
     reads perfectly on its own, so this is a missing TRIGGER and a
     missing SCHEDULE rather than a missing payload. */
  assert.deepEqual(P.classifyClause("the next time you hit this turn, gain 1{h}"),
    {status: "run", ops: [["life", 1]]});
});

test("the twelve CRUSH cards are untouched — the boundary is measured", {skip}, () => {
  /* THE FIRST DRAFT LISTED ALL TEN PREFIXES and moved 28 parses across
     twelve cards, because `crush`'s reader lives BELOW the catch-all —
     so stripping the prefix took the clause away from `fx.crush`.
     Measuring the blast radius BOTH WAYS is what caught it (v3.33); the
     count alone would have looked like a big win. */
  let n = 0;
  for(const rec of pool()){
    if(!/^\*\*crush\*\*/i.test((rec.functional_text || "").trim())) continue;
    P.fxReset();
    const fx = P.fxParse(mk(rec));
    assert.ok(fx.crush, rec.name + " must still be lifted into fx.crush");
    n++;
  }
  assert.ok(n >= 12, `only ${n} crush records checked — the scan shape moved`);
});
