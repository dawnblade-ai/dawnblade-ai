/* ============================================================
   THE TRAINER'S COACH SAYS "ACTIVATE THE CLOAK FIRST" (SPXCLOAK, Coach side)

   The table's AI already spends Spellfire Cloak before an off-turn play it would pay for with
   a pitched card (test/cloakpay.test.js, `sparring.cloakFirst`). The trainer's Coach never
   advised it. advisor.js cannot require judge, so the trainer hands it ONE judge reader,
   `ctx.cloakFor` (= `judge.cloakFor`, also what `cloakFirst` asks); nothing is mirrored.
   The observable is the advice as DATA: `advise().cloak` is the piece's uid and `.then` the
   card, with the reader and without it (the old advice: no `cloak`). Prose is not asserted.
   The fixture is a real self-play state with Iyslander at seat 0 (the trainer's `you()`), on
   the opponent's turn, where the table policy itself picks `cloakPay`.
   Sabotage checked: advisor.js ignoring `ctx.cloakFor` fails the first test; a Cloak with a
   point of defence, or a pool that already pays, is not offered (second test).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;
const A = require("../engine/advisor.js");
const E = require("../engine/effects.js");

const clone = x => JSON.parse(JSON.stringify(x));
const cloakOf = sd => (sd.gear || []).find(c => c && c.name === "Spellfire Cloak");
const ctxOf = (n, readers) => { const b = J.bOf(n, 0);
  return Object.assign({}, A.advView(n, 0), {runeDmg: b.runeDmg || 1, hpow: b.HPOW, wateryGrave: b.wateryGrave, noOpWhy: E.arsNoOpWhy}, readers ? {cloakFor: J.cloakFor} : {}); };
function find(){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "iyslander");
  for(let gi = 0; gi < 48; gi++){
    let n = SPL.match("iyslander", foes[gi % foes.length], "cc-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      if(n.turnPlayer !== 0 && cloakOf(n.sides[0]) && !n.pending && !n.prompt){
        const r = A.advise(n, ctxOf(n, true));
        if(r.cloak) return n;
      }
      let moved = false;
      for(const s of [0, 1]){ const x = SP.act(n, s); if(!x) continue; const o = J.reduce(n, x, s); if(o.error) continue; n = o.state; moved = true; break; }
      if(!moved) break;
    }
  }
  return null;
}
const F = find();

test("the Coach says to activate the Cloak first, off-turn, when it covers the cost", () => {
  assert.ok(F, "found in self-play");
  const cloak = cloakOf(F.sides[0]);
  const r = A.advise(F, ctxOf(F, true));
  assert.equal(r.cloak, cloak.uid, "names the Cloak");
  assert.ok(r.then != null && r.then !== cloak.uid, "then a card");
  assert.equal(A.advise(F, ctxOf(F, false)).cloak, undefined, "without the reader: the old advice");
});

test("the Coach does not offer the Cloak when the pool pays or the piece blocks", () => {
  assert.ok(F, "found in self-play");
  const rich = clone(F); rich.sides[0].res = 9;
  assert.equal(A.advise(rich, ctxOf(rich, true)).cloak, undefined, "the pool covers it");
  const wall = clone(F); cloakOf(wall.sides[0]).def = 1;
  assert.equal(A.advise(wall, ctxOf(wall, true)).cloak, undefined, "a piece that blocks is kept");
  const own = clone(F); own.turnPlayer = 0;
  assert.equal(A.advise(own, ctxOf(own, true)).cloak, undefined, "never on your own turn");
});

/* THE TRAINER'S OWN SHAPE. Battle speaks mode/bphase and `setG` merges the CR fields
   `DawnPriority.fromTrainer` derives (index.html's withPriority) — that is what `judge.legal`
   reads for "only during an opponent's turn". Proven on the real page (tools/page.js, Iyslander
   trainer, a real Battle state with the Cloak worn and an arsenal reaction, the react step and
   `foeturn` both): the advice fires there. This drill rebuilds that shape without the page. */
test("the Coach says it on a trainer-shaped state too (react step and foe's turn)", () => {
  assert.ok(F, "found in self-play");
  const PRI = require("../engine/priority.js");
  const mk = (mode, bphase) => { const n = clone(F); delete n.turnPlayer; n.mode = mode; n.bphase = bphase; n.step = null;
    const p = PRI.fromTrainer(n, false); for(const k of PRI.PRI_FIELDS) n[k] = p[k]; return n; };
  for(const [mode, bphase] of [["block", "react"], ["foeturn", null]]){
    const n = mk(mode, bphase), cloak = cloakOf(n.sides[0]);
    assert.equal(n.turnPlayer, 1, mode + ": derived as their turn");
    assert.equal(A.advise(n, Object.assign(ctxOf(n, true), {window: "act"})).cloak, cloak.uid, mode);
  }
});

test("the trainer hands the Coach the cloakFor reader", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const ctxLine = src.split("\n").find(l => l.includes("<Advisor g={g} ctx={{window:g.mode"));
  assert.ok(ctxLine && ctxLine.includes("cloakFor:DawnJudge.cloakFor"), "ctx passes cloakFor");
});
