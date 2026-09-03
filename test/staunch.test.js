/* ============================================================
   AN OPTIONAL ADDITIONAL COST (v3.34) — Staunch Response

     As an additional cost to play this, you may pay {r}{r}{r}{r}.
     If the additional cost is paid, this gets +3{d}.

   IT IS A COST, NOT A TRIGGER, and that decides everything about where
   it lives. A cost is settled at play time, beside the printed resource
   cost — so it cannot be a queued prompt, because `openPrompt` drains
   after the card has already resolved. That is the timing wall Charge
   and Fusion still sit behind.

   BOOST IS THE PRECEDENT on both boards: pause, ask, and let the answer
   ride to `execute` on the state.

   AND THE RIDER'S ANSWER BELONGS TO THE PLAY. By the time the wall asks
   what the card is worth, the payment is long settled and nothing on the
   card records it — so `defSelf.when === "addCostPaid"` is answered from
   `opts.addPaid`, the same split `fromArsenal` keeps.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");
const fs = require("fs");
const path = require("path");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

test("both clauses are read, and neither is guessed", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Staunch Response", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.addPay, {cost: 4});
  assert.deepEqual(fx.defSelf, {amt: 3, when: "addCostPaid"});
});

test("the cost and the buff are the CARD'S numbers, not literals", () => {
  /* Staunch Response is the pool's only printing, so nothing in it can
     tell a read number from a hardcoded one. Synthetics can. */
  P.fxReset();
  const fx = P.fxParse({name: "Staunch Drill", pitch: 1, tt: "Guardian Defense Reaction",
    def: 5, cost: 1, kw: [],
    tx: "As an additional cost to play this, you may pay {r}{r}.\n"
      + "If the additional cost is paid, this gets +1{d}."});
  assert.deepEqual(fx.addPay, {cost: 2});
  assert.deepEqual(fx.defSelf, {amt: 1, when: "addCostPaid"});
  /* a numeric spelling too */
  P.fxReset();
  const num = P.fxParse({name: "Staunch Drill Numeric", pitch: 1, tt: "Guardian Defense Reaction",
    def: 5, cost: 1, kw: [],
    tx: "As an additional cost to play this, you may pay 3.\n"
      + "If the additional cost is paid, this gets +2{d}."});
  assert.deepEqual(num.addPay, {cost: 3});
  /* "YOU MAY" IS THE WHOLE DIFFERENCE. A MANDATORY additional cost is a
     price, not a choice — it belongs in `effCost`, and reading it here
     would put a question in front of a player who has no decision to
     make, then let them decline something the card does not let them
     decline. No pool card prints the mandatory form, so only a synthetic
     can tell the two apart. */
  P.fxReset();
  const must = P.fxParse({name: "Staunch Drill Mandatory", pitch: 1, tt: "Guardian Defense Reaction",
    def: 5, cost: 1, kw: [],
    tx: "As an additional cost to play this, pay {r}{r}.\nIf the additional cost is paid, this gets +1{d}."});
  assert.equal(must.addPay, undefined, "no 'you may' — no question");
});

test("an answer the seat cannot afford is NOT paid, and collects nothing", {skip}, () => {
  H.db();
  P.fxReset();
  /* `judge.addPayable` gates this before the question is ever asked, so
     nothing in a driven game reaches it. `execute` is a PUBLIC SURFACE
     fed by JSON off a wire (test/fuzz.test.js's whole premise), and a
     crafted `_addPaid` must not buy a rider the seat cannot pay for —
     v2.04's rule, at the one door that is still open. */
  const sr = {...H.card("Staunch Response", 1), uid: "sr1"};
  let g = H.state({hand: [sr], res: 3, ap: 1}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = H.execute({...g, _addPaid: true}, sr, "hand", 0, {});
  assert.equal(out.sides[0].res, 1, "3 - 2 printed, and the addition is NOT taken");
  assert.equal(out._addPaid, false, "…and the answer is re-derived to unpaid, so no rider fires");
});

test("an UNPAID additional cost grants nothing — v2.04's rule", () => {
  P.fxReset();
  const self = {amt: 3, when: "addCostPaid"};
  assert.equal(E.defSelfMet(self, {}, {addPaid: true}), true);
  assert.equal(E.defSelfMet(self, {}, {addPaid: false}), false);
  /* AND A CALLER THAT DOES NOT SAY ANSWERS NO. Weaker than printed and
     visible; the other direction is a wall that quietly stops more than
     the cards grant. */
  assert.equal(E.defSelfMet(self, {}, {}), false);
});

/* ---- DRIVEN, AT THE TABLE ------------------------------------------- */

const standing = res => {
  P.fxReset();
  const sr = {...H.card("Staunch Response", 1), uid: "sr1"};
  let g = H.state({res: 9}, {hand: [sr], res, ap: 1}, {turn: 3, actor: 0});
  return {...g, phase: "action", step: "reaction", priority: 1, passed: [],
          firstPlayer: 0, round: 1, over: null, turnPlayer: 0, attacker: 0,
          pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"},
                 by: 0, total: 7, ga: false, ops: [], onHit: []}, stack: []};
};

test("driven: paying is worth exactly the printed +3, declining is not", {skip}, () => {
  H.db();
  const g = standing(6);                       /* 2 printed + 4 additional */
  const asked = J.reduce(g, {t: "play", uid: "sr1", from: "hand"}, 1).state;
  assert.ok(asked.pending, "it must ASK — this is a choice, not a price");
  assert.equal(asked.pending.kind, "addPay");
  assert.equal(asked.pending.cost, 4);

  const paid = J.reduce(asked, {t: "addPay", yes: true}, 1).state;
  assert.equal(paid.sides[1].res, 0, "6 - 2 - 4");
  assert.deepEqual((paid.sides[1].blockRx || []).map(x => x.def), [10],
    "7 printed + 3 — the wall sees the number the player paid for");

  const declined = J.reduce(asked, {t: "addPay", yes: false}, 1).state;
  assert.equal(declined.sides[1].res, 4, "6 - 2, and the addition is not taken");
  assert.deepEqual((declined.sides[1].blockRx || []).map(x => x.def), [7],
    "the printed defence, and NOT the rider — paying nothing must collect nothing");
});

test("it is not asked when the seat cannot afford BOTH", {skip}, () => {
  H.db();
  /* The same rule `buildPrompt` follows for a spec with nothing to ask:
     a question with one possible answer is not a question. */
  const g = standing(5);                       /* one short */
  const out = J.reduce(g, {t: "play", uid: "sr1", from: "hand"}, 1).state;
  assert.ok(!out.pending, "no sheet");
  assert.equal(out.sides[1].res, 3, "only the printed 2 is charged");
  assert.deepEqual((out.sides[1].blockRx || []).map(x => x.def), [7]);
});

test("the pending blocks every other action until it is answered", {skip}, () => {
  H.db();
  const asked = J.reduce(standing(6), {t: "play", uid: "sr1", from: "hand"}, 1).state;
  assert.match(String(J.legal(asked, {t: "pass"}, 1)), /additional cost/,
    "refused BY NAME — a half-finished interaction belongs to one seat");
  assert.equal(J.legal(asked, {t: "addPay", yes: true}, 1), null, "and answering is legal");
  /* AND THE OTHER SEAT IS REFUSED BY THE GENERAL PENDING GATE, not by a
     second test inside the addPay branch — a `pending` belongs to ONE
     seat and that rule is stated once. */
  assert.match(String(J.legal(asked, {t: "addPay", yes: true}, 0)), /mid-decision/,
    "…for that seat only");
});

test("the answer does not stick to the next card", {skip}, () => {
  H.db();
  /* `_addPaid` is stripped on the way out of `commitPlayBoosted`, the same
     way `_doBoost` is. A reducer whose state carries a spent answer is one
     refactor away from paying for a card it never asked about. */
  const asked = J.reduce(standing(9), {t: "play", uid: "sr1", from: "hand"}, 1).state;
  const paid = J.reduce(asked, {t: "addPay", yes: true}, 1).state;
  assert.equal(paid._addPaid, undefined, "the flag must not survive the play");
});

/* ---- BOTH BOARDS ASK, AND NEITHER RESTATES THE RULE ------------------ */

test("both boards ask, and both read the ONE reader", () => {
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  for(const [nm, src] of [["judge.js", jud], ["index.html", htm]]){
    assert.match(src, /addPay/, nm + " must read the cost");
    /* AND MUST ACTUALLY PAUSE. Reading `fx.addPay` without asking is a
       card that silently never gets its option — the greps below are
       both satisfied by code no tap can reach. */
    assert.match(src, nm === "judge.js" ? /kind: "addPay"/ : /mode:"rxaddpay"/,
      nm + " must open a real pause");
    /* PIN THE GATE, NOT THE IDENTIFIER. `playRx` is a Battle closure and
       cannot be driven from Node, so this is a source guard — and a
       source guard that only greps for the mode string passes on
       `if(false) return L({...s, mode:"rxaddpay"…})`. Sabotaged exactly
       that way, it did. The CONDITION has to be in the slice too. */
    const gate = nm === "judge.js"
      ? src.slice(Math.max(0, src.indexOf('kind: "addPay"') - 700), src.indexOf('kind: "addPay"') + 200)
      : src.slice(Math.max(0, src.indexOf('mode:"rxaddpay"') - 400), src.indexOf('mode:"rxaddpay"') + 200);
    assert.match(gate, /addPay(?:able)?/, nm + ": the pause must be gated on the card printing one");
    assert.match(gate, />=/, nm + ": …and on the seat being able to afford BOTH costs");
    assert.match(src, /_addPaid/, nm + " must thread the answer to the play");
    assert.ok(!/addCostPaid/.test(src),
      nm + " must not re-derive the rider's condition — that is defSelfMet's");
    /* SCAN THE addPay SLICES, NOT THE WHOLE FILE. `index.html` carries the
       DECK LISTS as data, and one of them contains the line
       `2|Staunch Response|1|` — a whole-file scan reports the deck list as
       a violation. A guard aimed at the wrong SCOPE accuses the innocent
       as readily as one aimed at the wrong file passes by finding nothing
       (v3.33). */
    const slices = [];
    for(let i = src.indexOf("addPay"); i >= 0; i = src.indexOf("addPay", i + 1))
      slices.push(src.slice(Math.max(0, i - 500), i + 500));
    assert.ok(slices.length >= 2, nm + " must mention addPay more than once");
    for(const sl of slices)
      assert.ok(!/Staunch/.test(sl), nm + " must name no card near the question");
  }
});

/* ---- THE TRAINER'S OWN WALL, WHICH HAD NEVER ASKED defendValue ------- */

test("the trainer's DEFENDING wall goes through defendValue", () => {
  /* `defendValue` was called from `resolveStack` alone — the wall the
     DUMMY raises when you attack. When the PLAYER blocked, every
     defensive self-buff built since v3.23 did nothing, which in the
     trainer is most of the game: Sigil of Suffering blocked for 3 here
     and 4 at the table on the same board state. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  const i = htm.indexOf("const finishBlock = (s, defBonus) =>");
  assert.ok(i > 0, "finishBlock moved — re-anchor this drill");
  const body = htm.slice(i, i + 1400);
  assert.match(body, /defendValue\(act\(s\), c,/, "the hand wall must ask it");
  assert.match(body, /defendValue\(act\(s\), piece,/, "and the gear wall");
  /* THE WEAR STAYS `gearDef`'s and rides in as `base` — re-deriving
     Guardwell, Temper, battleworn and destruction inside `defendValue`
     would be a second copy of the wear rules (v3.24). */
  assert.match(body, /base:gearDef\(piece\)/, "the gear wall passes its wear as the base");
  /* AND THE PLAYED REACTION TOO. Three walls, one reader. */
  assert.equal((htm.match(/_EFX\.defendValue\(/g) || []).length, 4,
    "four sites: the hand wall, the gear wall, and the two played-reaction paths");
});

test("driven: the trainer's wall applies a card's own defensive buff", {skip}, () => {
  H.db();
  P.fxReset();
  /* Sigil of Suffering — "if you've dealt arcane damage this turn, this
     gets +1{d}". The user's own ruling (2026-08-22). Driven through
     `defendValue` with the trainer's opts, both ways round. */
  const sig = H.card("Sigil of Suffering", 1);
  const opts = {weaponAttack: false, atkCard: null, handDefenders: 1};
  const dealt = {hand: [], board: [], gear: [], hist: {arc: 2}};
  const none  = {hand: [], board: [], gear: [], hist: {arc: 0}};
  assert.equal(E.defendValue(dealt, sig, opts), (sig.def || 0) + 1);
  assert.equal(E.defendValue(none,  sig, opts), sig.def || 0);
});

test("what the trainer CANNOT answer stays honestly unmet", {skip}, () => {
  H.db();
  P.fxReset();
  /* The dummy's swing is the `[3,4,5]` escalation, not a card, so the two
     conditions that ask about the incoming CARD have no answer. They must
     read FALSE rather than be guessed — weaker than printed and visible,
     and they come alive the moment seat 1 swings a real card. */
  const wax = H.card("Wax On", 1);
  assert.equal(P.fxParse(wax).defSelf.when, "atkActionCostLe", "fixture");
  const side = {hand: [], board: [], gear: [], hist: {}};
  assert.equal(E.defendValue(side, wax, {weaponAttack: false, atkCard: null}), wax.def || 0,
    "no attack card to read — the printed number, and nothing invented");
});
