/* ============================================================
   BLOODROT POX'S "UNLESS YOU PAY" IS ASKED, NOT ASSUMED (v5.71)

   "At the beginning of your end phase, destroy this, then it deals 2 damage
   to you unless you pay {r}{r}{r}." The payment used to come out of FLOATING
   resources only: a hand that could pitch the three was never asked, and the
   damage the card lets a player avoid landed. The end phase had nowhere to
   put a sheet — `openPrompt` drains at the tail of `execute`, which the end
   phase does not call — so the first build of this was silent (v3.09).

   Now a trigger that ASKS holds the end phase on both boards:
     table    `judge.doEndTurn` opens the queue after the beginning-of-end-phase
              triggers and holds on `endHold`; `reduce` resumes at (a) when the
              last sheet drains.
     trainer  `endTurn` / `foeEnd` raise `_endPending` and `openPrompt` resumes
              them, the way `_wallPending` holds a wall.

   WHAT THE DRILLS HOLD
     floating covers it         paid without a question, the hand untouched
     pitching can cover it      ASKED; pay pitches ON DEMAND and never more
                                than the cost needs; decline takes the damage
     nothing can cover it       no question, the damage lands, the line says why
     the hold                   priority stays null, only the asked seat may
                                answer, the end phase has not run until it does
     the AI                     answers through `judge.autoAnswer` (payPolicy)
   Every drill that says "sabotage" below was broken on purpose and went red
   (see the v5.71 notes in LESSONS.md); the source pins at the bottom exist
   because the trainer's closure cannot be driven from here.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const S = require("../engine/sparring.js");

const J = H.J;
const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const tok = (c, sd, uid) => ({card: c, kind: "token", spent: false, uid: uid || c.uid, sd: sd || "end"});
/* a card that exists only to be pitched: cost 0, pitch `p`, unique name per uid (fxParse memoizes on name|pitch) */
const mk = (u, p) => ({uid: u, name: "Pitchable " + u + " (" + p + ")", pitch: p, tt: "Generic Action",
  ty: ["Generic", "Action"], cost: 0, power: 3, defense: 2});

/* The seat that owns the Pox ends its turn; the other seat passes in
   succession, and the table walks into the end phase by itself. */
function toEnd(res, hand, seat){
  seat = seat || 0;
  const pox = H.card("Bloodrot Pox", 0);
  const own = {board: [tok(pox, "end")], hp: 20, res, hand};
  let g = {...H.state(seat === 0 ? own : {hp: 20}, seat === 1 ? own : {hp: 20}, {turn: 2, actor: seat, turnPlayer: seat}),
           phase: "action", step: "layer", priority: seat, passed: [], firstPlayer: seat, round: 1, over: null};
  g = J.reduce(g, {t: "endTurn"}, seat).state || g;
  if(g.phase === "action" && g.priority != null) g = J.reduce(g, {t: "pass"}, g.priority).state || g;
  return g;
}
const answer = (g, choice, seat) => {
  let r = J.reduce(g, {t: "promptChoose", choice}, seat || 0);
  assert.equal(r.error, null, "choosing " + choice + " was refused: " + r.error);
  r = J.reduce(r.state, {t: "promptConfirm"}, seat || 0);
  assert.equal(r.error, null, "confirming was refused: " + r.error);
  return r.state;
};
/* A CARD IS PITCHED ONLY WHILE THE COST IS UNPAID: taking any one pitched card
   back must leave the cost short. This is the "never banks extra" rule
   (`parser.pitchExcessWhy`'s own sentence) asked of the result. */
function neverNeedless(floatBefore, pitched, cost){
  const total = floatBefore + pitched.reduce((t, c) => t + c.pitch, 0);
  assert.ok(total >= cost, "the cost was not reached: " + total + " of " + cost);
  for(const c of pitched)
    assert.ok(total - c.pitch < cost, c.name + " was pitched needlessly — the cost was already paid without it");
}
const lines = g => (g.feed || []).concat(g.log || []).map(String);

/* ---- THE QUESTION, AND THE HOLD --------------------------------------- */

test("pitching could cover it: the owner is ASKED, and the end phase waits", {skip}, () => {
  H.db();
  const hand = [mk(1, 3), mk(2, 1), mk(3, 1)];
  const g = toEnd(0, hand);
  assert.ok(g.prompt && g.prompt.tag === "pay", "no pay sheet was put to the owner");
  assert.equal(g.prompt.side, 0, "the sheet is addressed to the Pox's controller");
  assert.equal(g.prompt.cost, 3);
  assert.deepEqual(g.prompt.elseOps, [["dmgSelf", 2]], "declining is what deals the damage");
  assert.equal(g.endHold, 0, "the end phase is not held on the sheet");
  assert.equal(g.phase, "end");
  assert.equal(g.priority, null, "CR 4.4.1: nobody holds priority in the end phase — a sheet is not a window");
  assert.equal(g.sides[0].hp, 20, "the damage must wait for the answer");
  assert.equal(g.sides[0].hand.length, 3, "NOTHING is pitched before the owner says pay (RULING 2026-08-01)");
  assert.equal(g.sides[0].pitch.length, 0);
  assert.deepEqual(g.sides[0].board, [], "the Pox is destroyed first, then asks — printed order");
  assert.ok(!lines(g).some(l => /^\(a\)/.test(l)), "step (a) ran while the sheet was still open");
  assert.ok(!g.arsenalFor && g.arsenalFor !== 0, "the arsenal step came before the question was answered");
});

test("while the sheet is open only the asked seat may answer, and nothing else moves", {skip}, () => {
  H.db();
  const g = toEnd(0, [mk(1, 3), mk(2, 1)]);
  assert.match(J.legal(g, {t: "promptChoose", choice: "pay"}, 1) || "", /not addressed to you/);
  assert.ok(J.legal(g, {t: "pass"}, 1), "the other seat may not pass through the sheet");
  assert.ok(J.legal(g, {t: "pass"}, 0), "nor may the asked seat pass past its own sheet");
  assert.ok(J.legal(g, {t: "endTurn"}, 0), "nor end the turn again");
  assert.equal(J.legal(g, {t: "promptChoose", choice: "pay"}, 0), null);
  /* a refused move changes nothing — the hold survives a poke */
  const poke = J.reduce(g, {t: "pass"}, 1);
  assert.ok(poke.error);
  assert.equal(poke.state.endHold, 0);
});

test("pay: the cards are pitched, the damage is avoided, and the end phase carries on", {skip}, () => {
  H.db();
  const n = answer(toEnd(0, [mk(1, 3), mk(2, 1), mk(3, 1)]), "pay");
  assert.equal(n.sides[0].hp, 20, "paid — the 2 damage is avoided");
  assert.equal(n.sides[0].pitch.length, 1, "one blue is exactly three");
  assert.equal(n.sides[0].hand.length, 2);
  assert.equal(n.sides[0].res, 0, "and nothing was banked");
  assert.equal(n.endHold, null, "the hold lifts when the sheet drains");
  assert.equal(n.arsenalFor, 0, "the end phase resumed — (b) asks for the arsenal now");
  assert.ok(lines(n).some(l => /^\(a\)/.test(l)), "step (a) never ran after the answer");
  assert.ok(lines(n).some(l => /paid 3/.test(l) && /avoids/.test(l)), "the feed does not say the damage was avoided");
});

test("pitching is exactly enough: never a card past the cost", {skip}, () => {
  H.db();
  for(const [res, hand] of [
    [0, [mk(1, 1), mk(2, 1), mk(3, 1), mk(4, 1)]],      /* four reds: three of them */
    [0, [mk(1, 3), mk(2, 3), mk(3, 3)]],                /* blues: one */
    [2, [mk(1, 1), mk(2, 1), mk(3, 3)]],                /* two floating + the shortfall */
    [1, [mk(1, 2), mk(2, 2), mk(3, 1)]],                /* mixed values */
    [0, [mk(1, 1), mk(2, 1), mk(3, 3), mk(4, 3)]],      /* the cheapest-first greedy takes red, red, blue (5 for 3) */
    [0, [mk(1, 1), mk(2, 2), mk(3, 2)]],                /* a red and a yellow, not two yellows past the cost */
  ]){
    const g = toEnd(res, hand);
    assert.ok(g.prompt, "fixture: res " + res + " + hand must be reachable and asked");
    const n = answer(g, "pay");
    const pitched = n.sides[0].pitch;
    assert.ok(pitched.length >= 1, "fixture: a pitch must have been needed");
    neverNeedless(res, pitched, 3);
    assert.equal(n.sides[0].hand.length, hand.length - pitched.length, "a card left the hand without being pitched");
    assert.equal(n.sides[0].hp, 20);
  }
  /* AND WHERE THE COST CAN BE MET TO THE POINT, IT IS: nothing is wasted. The cheapest-first
     greedy took red, red, blue (five for three) from this hand; `advBestPitch`, the Coach's own
     chooser, takes the one blue. */
  const fourCards = answer(toEnd(0, [mk(1, 1), mk(2, 1), mk(3, 3), mk(4, 3)]), "pay");
  assert.equal(fourCards.sides[0].pitch.length, 1, "three cards were pitched where one blue is exactly the price");
  assert.equal(fourCards.sides[0].pitch[0].pitch, 3);
  for(const [res, hand] of [[0, [mk(1, 1), mk(2, 1), mk(3, 3), mk(4, 3)]], [0, [mk(1, 1), mk(2, 2), mk(3, 2)]],
                            [2, [mk(1, 1), mk(2, 1), mk(3, 3)]], [1, [mk(1, 2), mk(2, 2), mk(3, 1)]]]){
    const p = answer(toEnd(res, hand), "pay").sides[0].pitch;
    assert.equal(res + p.reduce((t, c) => t + c.pitch, 0), 3, "a cover that meets the cost exactly existed and was not taken");
  }
});

test("decline: the damage lands, no card is touched, and the end phase carries on", {skip}, () => {
  H.db();
  const hand = [mk(1, 3), mk(2, 1), mk(3, 1)];
  const n = answer(toEnd(1, hand), "decline");
  assert.equal(n.sides[0].hp, 18, "declining is taking the 2");
  assert.equal(n.sides[0].hand.length, 3, "a declined payment pitches nothing");
  assert.equal(n.sides[0].pitch.length, 0);
  assert.equal(n.sides[0].res, 1, "and spends none of the floating pool");
  assert.equal(n.endHold, null);
  assert.equal(n.arsenalFor, 0, "the end phase resumed");
  assert.ok(lines(n).some(l => /declined/.test(l)), "declining is never silent");
  assert.ok(lines(n).some(l => /2 damage/.test(l) && /Bloodrot/.test(l)), "the damage line names the card");
});

/* ---- THE CASES THAT ASK NOTHING --------------------------------------- */

test("nothing can cover it, even by pitching: no question, the damage lands, the line says why", {skip}, () => {
  H.db();
  for(const [res, hand] of [[0, []], [0, [mk(1, 1), mk(2, 1)]], [1, [mk(1, 1)]]]){
    const g = toEnd(res, hand);
    assert.ok(!g.prompt && g.endHold == null, "asked a question that cannot be answered (res " + res + ")");
    assert.equal(g.sides[0].hp, 18, "2 damage lands");
    assert.equal(g.sides[0].hand.length, hand.length, "an unpayable cost pitches nothing");
    assert.equal(g.sides[0].pitch.length, 0, "nothing was pitched toward a cost that could not be met");
    assert.ok(lines(g).some(l => /Bloodrot/.test(l) && /floating/.test(l) && /pitching/.test(l)),
      "the line must say what was short");
  }
});

test("floating alone covers it: paid without a question, the hand untouched", {skip}, () => {
  H.db();
  const g = toEnd(3, [mk(1, 3), mk(2, 3)]);
  assert.ok(!g.prompt && g.endHold == null, "floating resources fizzle anyway — nothing to ask");
  assert.equal(g.sides[0].hp, 20);
  assert.equal(g.sides[0].hand.length, 2, "pitch only on demand: a covered cost never pitches");
  assert.equal(g.sides[0].pitch.length, 0);
});

/* ---- BOTH SEATS ------------------------------------------------------- */

test("the second seat's Pox asks the second seat, and the first cannot answer for it", {skip}, () => {
  H.db();
  const g = toEnd(0, [mk(11, 3), mk(12, 1)], 1);
  assert.ok(g.prompt && g.prompt.tag === "pay" && g.prompt.side === 1, "the sheet must be addressed to seat 1");
  assert.equal(g.endHold, 1);
  assert.match(J.legal(g, {t: "promptChoose", choice: "pay"}, 0) || "", /not addressed to you/);
  const n = answer(g, "pay", 1);
  assert.equal(n.sides[1].hp, 20);
  assert.equal(n.sides[1].pitch.length, 1);
  assert.equal(n.sides[0].hp, 20, "seat 0 neither paid nor was billed");
  const d = answer(toEnd(0, [mk(11, 3), mk(12, 1)], 1), "decline", 1);
  assert.equal(d.sides[1].hp, 18, "seat 1 took it");
  assert.equal(d.sides[0].hp, 20, "and only seat 1");
});

/* ---- THE SEAT POLICY -------------------------------------------------- */

test("the AI answers through judge.autoAnswer: legal, deterministic, and it says why", {skip}, () => {
  H.db();
  const g = toEnd(0, [mk(1, 3), mk(2, 1), mk(3, 1)]);
  const a = S.act(g, 0);
  assert.ok(a && a.t === "promptChoose" && a.choice === "pay", "a full grip pays a card for 2 life");
  assert.equal(J.legal(g, a, 0), null, "a refusal is always a policy bug");
  assert.deepEqual(S.act(JSON.parse(JSON.stringify(g)), 0), a, "the same state must give the same answer");
  assert.equal(S.act(g, 1), null, "the other seat has nothing to answer");
  const why = S.explain(g, 0);
  assert.equal(why && why.key, "payYes", "the call must name the branch that decided");
  /* ...and it plays the whole thing out to the arsenal step on its own */
  let n = g, guard = 0;
  while(n.prompt && guard++ < 6){ const x = S.act(n, n.prompt.side); assert.equal(J.legal(n, x, n.prompt.side), null); n = J.reduce(n, x, n.prompt.side).state; }
  assert.equal(n.sides[0].hp, 20);
  assert.equal(n.endHold, null);
  neverNeedless(0, n.sides[0].pitch, 3);
});

test("the AI will not pitch its LAST card for 2 life (payPolicy, unchanged)", {skip}, () => {
  H.db();
  const g = toEnd(0, [mk(1, 3)]);
  assert.ok(g.prompt, "fixture: one blue reaches the cost, so the sheet is asked");
  const a = S.act(g, 0);
  assert.ok(a && a.t === "promptChoose" && a.choice === "decline");
  assert.equal(S.explain(g, 0).key, "payNo");
  let n = g, guard = 0;
  while(n.prompt && guard++ < 6){ const x = S.act(n, n.prompt.side); n = J.reduce(n, x, n.prompt.side).state; }
  assert.equal(n.sides[0].hp, 18);
  assert.equal(n.sides[0].hand.length, 1, "the card stayed");
});

/* ---- THE TRAINER'S HALF, PINNED --------------------------------------- *
   `Battle` is a closure inside index.html and cannot be called from here, so
   the trainer's half is pinned on the source (comments stripped, so prose
   cannot satisfy it) and DRIVEN on the real page by tools/page.js's own
   drives. Each pin names a way the question silently stops being asked. */
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const slice = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, "anchor moved: " + a); return html.slice(i, html.indexOf(b, i + a.length)); };

test("the trainer holds its own end phase on a sheet, for both seats", () => {
  const mine = slice("const endTurn = () => setG(", "function endTurnRest(");
  assert.match(mine, /beginEndPhase\(n, 0\)/);
  assert.match(mine, /promptQ[^;]*length\)\s*return openPrompt\(\{\.\.\.n, _endPending: \{si: 0\}\}\)/,
    "endTurn no longer holds on a queued sheet — the question is silently never asked");
  assert.match(mine, /return endTurnRest\(n\)/);
  const foe = slice("function foeEnd(s){", "function foeEndRest(");
  assert.match(foe, /beginEndPhase\(n, 1\)/);
  assert.match(foe, /promptQ[^;]*length\)\s*return winCheck\(openPrompt\(\{\.\.\.n, _endPending: \{si: 1\}\}\)\)/,
    "the dummy's end phase no longer holds on a sheet");
  const drain = slice("function openPrompt(s){", "function foeAnswerPay(");
  assert.match(drain, /_endPending/);
  assert.match(drain, /si === 0 \? endTurnRest\(o\) : foeEndRest\(o\)/, "the held end phase is never resumed");
  assert.match(drain, /delete o\._endPending/, "the marker must be deleted before the call or the resume re-enters itself");
});

test("the trainer's seat-1 answer to a pay sheet pitches the smallest set too", () => {
  const foe = slice("function foeAnswerPay(s, live){", "function foeAnswerSoak(");
  assert.match(foe, /autoPitch\(n, r\.pay, null, \{exact: !!live\.exactPitch\}\)/,
    "the dummy answers a Pox greedily — three cards where one blue pays");
});

test("the trainer runs a seat's end-phase ops AS that seat, so the dummy's Pox bills the dummy", () => {
  /* Driven on the page (seat 1 holding a real Pox): before this the ops ran at the ambient actor,
     seat 0, and the dummy's Bloodrot dealt its 2 to — and asked its payment of — the PLAYER. */
  const be = slice("function beginEndPhase(s, si){", "function endPhaseAllies(");
  assert.match(be, /_EFX\.runOps\(\{\.\.\.n, actor: si\}, r\.ops/, "the ops no longer run as the seat whose end phase it is");
  assert.match(be, /actor: was/, "and the borrowed actor is not handed back");
});

test("the table's reducer resumes the held end phase after every answer", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /if\(n\.endHold != null && !n\.prompt && !n\.over\) n = resumeEnd\(n\)/);
  assert.match(src, /if\(n\.prompt\) return \{\.\.\.n, endHold: seat\}/, "doEndTurn no longer holds on a live sheet");
});
