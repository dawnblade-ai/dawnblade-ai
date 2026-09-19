/* ============================================================
   "ANOTHER" MUST NOT COUNT THE CARD ASKING (v4.58)

   > "If you've played **another** red card this turn, this gets go again."
   >                                                   — BLAZE HEADLONG
   > "If you've played **another** blue card this turn, transcend."
   >                                       — five Mystic instants, Enigma's

   `execute` incremented `hist.red`/`hist.blue` from the card's own pitch
   **460 lines above the condition loop that reads them**, so every card that
   asked satisfied its own gate: `(hist.red||0) > 0` was true because the
   asking card had just made it 1.

   MEASURED: SEVEN POOL RECORDS ASK A COLOUR CONDITION, ALL SEVEN PRINT
   "ANOTHER", AND EVERY ONE IS THE COLOUR IT ASKS ABOUT. So the printed word
   was dropped on all of them. Blaze Headlong is the sharpest — go again is
   an ACTION POINT (CR 5.3.5), this file's own "most valuable keyword in the
   game to get wrong" — gained on every play with no other red card.

   NO TOOL HERE COULD SEE IT. All seven read `tier: full`, because the clause
   IS consumed; and `COND-BYPASSED` needs an unconditional TWIN to compare a
   gate against, so a gate that is PRESENT and always TRUE leaves the
   one-sided fairness sweep nothing to compare — v3.57's lesson and v4.19's,
   about a gate that is decoration rather than one that vanished.

   AND THE ENGINE ALREADY KNEW THE RULE AND APPLIED IT TO ONE COUNTER.
   `hist.non` and `hist.playTy` are both recorded AFTER the card resolves and
   both carry a comment saying exactly this; the condition evaluator's own
   comment three lines above the colour rows says these "count a pitch VALUE
   and say 'another'". A recorded reason sitting beside the defect it
   describes (v3.69).

   IT WAS FOUND BY A FIXTURE FOR A DIFFERENT CARD. v4.58's deck-search drill
   asserted Flamecall Awakening's gate refuses with no red card played, and
   it did not — building the route is what made the gate observable (v3.72,
   and v4.49's Gun for the fifth time).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");
const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  return j.cards || j;
})();

/* ---- 1. THE PREMISE, MEASURED OFF THE PINNED POOL -------------------- */

test("every colour condition the pool emits prints ANOTHER, and asks its own colour", () => {
  /* THE SECOND HALF IS WHAT MAKES THE DEFECT UNIVERSAL. A blue card asking
     about RED would never have counted itself, so the fix would have been
     invisible on it; measured, no record does that. Both halves are pinned,
     because one arriving that asks about the OTHER colour is a record this
     fix does not move and somebody should notice. */
  const rows = [];
  for(const c of pool){
    const m = C.mapDbCard(c);
    P.fxReset();
    const fx = P.fxParse({name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
      tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx});
    const conds = [...(fx.conds || []), ...(fx.condOnHit || [])].map(x => x.cond);
    for(const col of ["red", "blue"])
      if(conds.includes(col)) rows.push({name: m.n, pitch: m.p, col, tx: m.tx});
  }
  P.fxReset();
  assert.equal(rows.length, 7, "seven records ask a colour condition");
  const byName = [...new Set(rows.map(r => r.name))].sort();
  assert.deepEqual(byName, ["A Drop in the Ocean", "Blaze Headlong",
    "Flamecall Awakening", "Homage to Ancestors", "Pass Over",
    "Preserve Tradition", "Rising Sun, Setting Moon"]);
  for(const r of rows){
    assert.match(r.tx, new RegExp("another " + r.col + " card", "i"),
      r.name + " must print ANOTHER, or this fix makes it weaker than printed");
    /* colour IS pitch: red 1, blue 3 — so "asks its own colour" is
       measurable without reading a colour field the database does not have. */
    assert.equal(r.pitch, r.col === "red" ? 1 : 3,
      r.name + " asks about the colour it IS, which is why it counted itself");
  }
});

test("`CONDONHIT_CONDS` does NOT list a colour, so no hit-time reader can ask", {skip}, () => {
  /* The ordering question is only ever about the DECLARATION loop. If a
     colour ever joined the hit-time vocabulary, the counter would be
     incremented before the hit and "another" would count the card again —
     one evaluator over (v3.96). Asked of the parser's own emitters against
     the list, rather than of the list alone. */
  const src = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const i = src.indexOf("const CONDONHIT_CONDS = [");
  assert.ok(i > 0, "the census moved — re-anchor this drill");
  const body = src.slice(i, src.indexOf("]", i));
  assert.ok(!/red|blue/.test(body),
    "a colour in the hit-time vocabulary needs this ordering decided again");
});

/* ---- 2. DRIVEN, THE PAIR EITHER SIDE OF THE THRESHOLD ---------------- */

const mk = (nm, pitch, uid) => {
  const r = pool.find(x => x.name === nm && (pitch == null || +x.pitch === pitch));
  assert.ok(r, "fixture card missing: " + nm);
  const m = C.mapDbCard(r);
  return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, life: m.hp,
          tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx, uid};
};
const feed = s => (s.feed || []).map(f => (typeof f === "string" ? f : (f && f.t) || ""))
                                .filter(Boolean).join(" | ");
/* A PAIR EITHER SIDE OF THE PRINTED THRESHOLD IS THE ONLY THING THAT TESTS
   ANYTHING (v3.92, v3.99). At one prior card BOTH readings grant, so a drill
   at that count alone passes against the broken engine; the ZERO row is the
   one that bites. */
function playRed(prior){
  P.fxReset();
  const card = mk("Blaze Headlong", 1, 700);
  const g = H.state({hand: [card], deck: [mk("Brothers in Arms", 1, 701)], res: 9, ap: 1,
    hist: {red: prior, blue: 0, non: 0, atkNames: [], playTy: []}},
    {}, {turn: 3, actor: 0, seed: "cg"});
  const n = H.execute(g, card, "hand", 0, {attacking: true, isAtk: true, target: "hero"});
  P.fxReset();
  return n;
}

test("DRIVEN: Blaze Headlong does NOT go again on its own play", {skip}, () => {
  const n = playRed(0);
  assert.equal(n.pend.ga, false,
    "go again is an ACTION POINT (CR 5.3.5) and the card printed a gate for it");
  assert.match(feed(n), /no other red card played this turn/,
    "and the feed says why — in a training sim the refusal IS the lesson (v3.60)");
});

test("DRIVEN: …and DOES with another red card already played", {skip}, () => {
  /* THE POSITIVE CONTROL. A fix that refused every colour gate passes the
     row above perfectly (v3.98). */
  const n = playRed(1);
  assert.equal(n.pend.ga, true, "one other red card is what the card asks for");
  assert.match(feed(n), /goes again/);
});

test("DRIVEN: the counter is still incremented for the NEXT card", {skip}, () => {
  /* THE HALF THAT MUST NOT REGRESS. Moving the increment fixes "another" and
     would break every LATER reader if it stopped happening — so both counts
     are asserted, which is what makes this a move rather than a deletion. */
  assert.equal(playRed(0).sides[0].hist.red, 1, "0 -> 1");
  assert.equal(playRed(1).sides[0].hist.red, 2, "1 -> 2");
});

test("DRIVEN: the blue half is the same gate on a different mechanic", {skip}, () => {
  /* Five of the seven records are blue and their payload is TRANSCEND, not a
     pump — so the two halves fail differently and a drill on one says
     nothing about the other. */
  /* AND IT NEEDS THE DATABASE REGISTERED, which the red half does not: a
     transcend FLIPS the card to Inner Chi, and `effects.js` resolves that
     record through `getDb()`. Without it the flip silently minted nothing and
     `hist.trans` stayed 0 on BOTH rows — a drill driving a reduced engine
     reports on the reduced one (v3.71), and it reads exactly like the gate
     refusing correctly. Check your own fixture (v4.09). */
  H.db();
  for(const nm of ["Pass Over", "A Drop in the Ocean"]){
    const run = prior => {
      P.fxReset();
      const card = mk(nm, 3, 700);
      const g = H.state({hand: [card], deck: [mk("Brothers in Arms", 1, 701)], grave: [],
        res: 9, ap: 1, hist: {red: 0, blue: prior, non: 0, trans: 0, atkNames: [], playTy: []}},
        {grave: [mk("Brothers in Arms", 2, 702)]}, {turn: 3, actor: 0, seed: "cg"});
      const n = H.execute(g, card, "hand", 0, {});
      P.fxReset();
      return n;
    };
    const a = run(0), b = run(1);
    assert.equal(a.sides[0].hist.trans || 0, 0, nm + " must not transcend off its own play");
    assert.match(feed(a), /no other blue card played this turn/);
    assert.equal(b.sides[0].hist.trans || 0, 1, nm + " transcends with another blue card down");
    assert.match(feed(b), /transcends/);
    /* AND THE COUNTER STILL MOVES. */
    assert.equal(a.sides[0].hist.blue, 1);
    assert.equal(b.sides[0].hist.blue, 2);
  }
});

/* ---- 3. THE ORDERING IS THE RULE, AND IT IS STATED ------------------- */

test("the increment happens AFTER the condition loop, not before it", () => {
  /* THE DRIVEN ROWS ABOVE ARE THE PROPERTY; this is the shape, so that a
     later edit which moves the increment back reads as the deliberate act it
     would be. Anchored on the two lines rather than on a line number, and
     the slice is bounded (v4.05). */
  const src = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const bump = src.indexOf('if(card.pitch===1) actMut(n).hist = {...act(n).hist, red:');
  const read = src.indexOf('cond==="red" ? (act(n).hist.red||0)>0');
  assert.ok(bump > 0 && read > 0, "both sites must exist — re-anchor this drill");
  assert.ok(read < bump,
    "the colour condition must be READ before the card's own colour is counted, "
    + "or every card that asks satisfies its own gate — which is exactly what it did");
  /* AND THERE IS ONLY ONE INCREMENT SITE PER COLOUR. Two would put the
     ordering back in one of them, silently (v3.61: two records of one fact). */
  for(const [col, pitch] of [["red", 1], ["blue", 3]]){
    const rx = new RegExp("if\\(card\\.pitch===" + pitch + "\\) actMut\\(n\\)\\.hist = \\{\\.\\.\\.act\\(n\\)\\.hist, " + col + ":", "g");
    assert.equal((src.match(rx) || []).length, 1, "exactly one " + col + " increment");
  }
});
