/* test/vcharge.test.js — "ANY NUMBER OF TIMES" IS TAKEN BY THE AI (v5.67, H24)
 *
 * > "As an additional cost to play this, you may charge your soul any number
 * >  of times. Your attacks this combat chain get +1{p} for each Light card
 * >  charged this way."  — V OF THE VANGUARD
 *
 * v5.66 measured Boltyn's AI charging ONCE with it. The finding, and what this
 * file holds:
 *
 *   THE ENGINE WAS NEVER THE LIMIT. `judge.maybeCharge` re-opens the offer
 *   after every real pick and the trainer's `confirmCharge` does the same
 *   (v4.56, `test/vanguard.test.js` drives the sheet on both counts). A person
 *   at the table can charge twice, three times, or stop. The limit was the
 *   POLICY: `sparring.act` answered "enough" the moment one card was picked,
 *   which left the printed pip per Light card weaker than printed for that
 *   seat alone.
 *
 *   `judge.chargeMore` is the reader the policy asks (sparring reads no card
 *   text): the pip per Light card, the Light cards the seat could part with and
 *   still keep its next play, and whether a next play exists at all.
 */
const test = require("node:test");
const assert = require("node:assert");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const gate = t => H.hasDb() ? t : { skip: true };
const ent = (maps, nm, p, uid) =>
  ({...C.resolveEntry(maps, {name: nm, p, code: null, q: 1}), uid});

/* V (uid 1), two Light cards (2, 3), one Generic (4). `ap` and `res` are what is
   LEFT when the charge sheet opens: the resource cost is settled before it. */
const fixture = (maps, o) => {
  o = o || {};
  P.fxReset();
  const hand = (o.hand || [[ "V of the Vanguard", 2], ["Bolt of Courage", 1], ["Take Flight", 1], ["Brutal Assault", 1]])
    .map(([n, p], i) => ent(maps, n, p, i + 1));
  const g = H.state({name: "Boltyn", res: o.res == null ? 9 : o.res, ap: o.ap == null ? 3 : o.ap, hand},
                    {name: "Them", res: 9}, {turn: 3, actor: 0, turnPlayer: 0, seed: "vcharge"});
  return {...g, phase: "action", step: "layer", priority: 0, passed: []};
};

/* open V's charge sheet */
const open = g => {
  const out = J.reduce(g, {t: "play", uid: 1, from: "hand"}, 0);
  assert.ok(!out.error, "the play was refused: " + out.error);
  assert.equal(out.state.pending && out.state.pending.kind, "charge", "the charge sheet is open");
  return out.state;
};
const answer = (s, uid) => {
  const out = J.reduce(s, uid == null ? {t: "charge"} : {t: "charge", uid}, 0);
  assert.ok(!out.error, "the charge answer was refused: " + out.error);
  return out.state;
};
/* pass until the chain link has resolved (the grant is live until the chain closes) */
const toResolution = s0 => {
  let s = s0, guard = 0;
  while(s.pend && s.step !== "resolution" && guard++ < 60){
    const who = s.priority;
    if(who == null) break;
    const r = J.reduce(s, {t: "pass"}, who);
    if(r.error) break;
    s = r.state;
  }
  assert.equal(s.step, "resolution", "the drive never reached the resolution step");
  return s;
};
/* the AI answers the open sheet until it closes; returns the final state and every call it made */
const aiCharges = (s0) => {
  let s = s0, guard = 0;
  const calls = [];
  while(s.pending && s.pending.kind === "charge"){
    assert.ok(guard++ < 12, "the charge sheet never closed");
    const ex = SP.explain(s, 0);
    const a = ex && ex.action;
    assert.ok(a && a.t === "charge", "the AI answered the sheet");
    calls.push({key: ex.key, uid: a.uid, why: ex.why});
    const out = J.reduce(s, a, 0);
    assert.ok(!out.error, "the AI's answer was refused: " + out.error);
    s = out.state;
  }
  return {s, calls};
};
const hp = s => s.sides[1].hp;

/* ---- 1. THE TABLE, WITH A PERSON'S ANSWERS: nothing in the engine stops it ---- */

test(gate("HUMAN: two Light cards charged deal 5, and the next link gets +2"), () => {
  const maps = H.db();
  /* control: no charge at all, then the same follow-up attack */
  const run = picks => {
    let s = open(fixture(maps));
    const offers = [];
    while(s.pending && s.pending.kind === "charge"){
      offers.push([...s.pending.uids]);
      s = answer(s, picks.shift());
    }
    const hp0 = hp(s);
    s = toResolution(s);
    const afterV = hp(s);
    const nx = J.reduce(s, {t: "play", uid: 4, from: "hand"}, 0);
    assert.ok(!nx.error, "the next attack was refused: " + nx.error);
    const s2 = toResolution(nx.state);
    return {offers, vDmg: hp0 - afterV, nextDmg: afterV - hp(s2), soul: s.sides[0].soul.length};
  };
  const none = run([null]);
  const two = run([2, 3, null]);
  assert.equal(none.vDmg, 3, "V alone prints 3");
  assert.equal(two.vDmg, 5, "two Light cards charged: 3 + 2");
  assert.equal(two.soul, 2, "both cards went to the soul");
  assert.equal(two.nextDmg - none.nextDmg, 2, "and the NEXT link on the chain is +2 as well");
  assert.deepEqual(two.offers.map(u => u.length), [3, 2, 1], "the offer re-opened after each pick and shrank");
});

test(gate("HUMAN: stopping after one is always allowed"), () => {
  const maps = H.db();
  let s = open(fixture(maps));
  s = answer(s, 2);
  assert.equal(s.pending && s.pending.kind, "charge", "asked again after the first card");
  s = answer(s, null);
  assert.ok(!(s.pending && s.pending.kind === "charge"), "a decline ends the charging");
  assert.equal(s.sides[0].soul.length, 1, "exactly one card charged");
  const s2 = toResolution(s);
  assert.equal(s2.sides[0].atkBuff.map(b => b.amt).join(), "1", "and one pip granted");
  assert.deepEqual(INV.errors(s2), [], "the board is legal");
});

/* ---- 2. THE AI TAKES IT --------------------------------------------------- */

test(gate("AI: charges twice when it has two Light cards it does not need"), () => {
  const maps = H.db();
  const {s, calls} = aiCharges(open(fixture(maps, {ap: 1})));
  assert.deepEqual(calls.map(c => c.key).slice(0, 2), ["charge", "chargeMore"],
    "the first card by the old rule, the second by its own reason");
  assert.equal(s.sides[0].soul.length, 2, "both Light cards are in the soul");
  assert.deepEqual(s.sides[0].soul.map(c => c.uid).sort(), [2, 3], "and they are the Light ones");
  assert.match(calls[1].why, /Light card/, "and the call says why");
  assert.equal(calls[calls.length - 1].key, "chargeDone", "then it stops: the Generic card is no pip");
  assert.equal(s.sides[0].hand.some(c => c.uid === 4), true, "the non-Light card stays in hand");
  const out = toResolution(s);
  assert.equal(hp(out), 15, "V deals 3 + 2");
});

test(gate("AI: keeps the next play it could still afford, and stops"), () => {
  const maps = H.db();
  /* two action points and a pool of 2 (V takes 1): after V, Valiant Thrust (cost 1,
     a Light attack) is still playable. Bolt of Courage is charged first by the person; the only
     Light card left IS the next play, so nothing is spare and the AI says "enough" */
  const hand = [["V of the Vanguard", 2], ["Bolt of Courage", 1], ["Valiant Thrust", 1]];
  const s0 = answer(open(fixture(maps, {ap: 2, res: 2, hand})), 2);
  const m = J.chargeMore(s0, 0);
  assert.equal(m.follow, true, "an action point survives V, so there is a next play");
  assert.deepEqual(m.lights, [], "the best play it can still afford is not spare");
  const out = aiCharges(s0);
  assert.deepEqual(out.calls.map(c => c.key), ["chargeDone"], "the AI stops at once");
  assert.deepEqual(out.s.sides[0].soul.map(c => c.uid), [2], "only the first card is charged");
  assert.equal(out.s.sides[0].hand.some(c => c.uid === 3), true, "and Valiant Thrust is still in hand");
});

test(gate("AI: charges the SPARE Light card and keeps the play"), () => {
  const maps = H.db();
  /* the same, with a second Light attack of the same print: one is held as the next play (the
     lower uid on a tie), the other is the spare */
  const hand = [["V of the Vanguard", 2], ["Bolt of Courage", 1], ["Valiant Thrust", 1], ["Take Flight", 1]];
  const out = aiCharges(answer(open(fixture(maps, {ap: 2, res: 2, hand})), 2));
  assert.deepEqual(out.calls.map(c => c.key), ["chargeMore", "chargeDone"]);
  assert.deepEqual(out.s.sides[0].soul.map(c => c.uid).sort(), [2, 4], "Take Flight is the one that goes");
  assert.equal(out.s.sides[0].hand.some(c => c.uid === 3), true, "Valiant Thrust, the next play, stays");
});

test(gate("AI: keeps the card that would PAY for the next play too"), () => {
  const maps = H.db();
  /* a pool of 0 (V took the 1): Take Flight (cost 1) is the next play and needs a pitch card, so
     Engulfing Light is kept as its payment and nothing is spare */
  const hand = [["V of the Vanguard", 2], ["Bolt of Courage", 1], ["Take Flight", 1], ["Engulfing Light", 1]];
  const s0 = answer(open(fixture(maps, {ap: 2, res: 1, hand})), 2);
  assert.equal(s0.sides[0].res, 1, "the pool V's own cost will take, and nothing over");
  const m = J.chargeMore(s0, 0);
  assert.deepEqual([m.spare, m.lights], [0, []], "the play and its payment are both held");
  assert.deepEqual(aiCharges(s0).calls.map(c => c.key), ["chargeDone"]);
});

test(gate("AI: without an action point left every spare Light card goes"), () => {
  const maps = H.db();
  const s0 = answer(open(fixture(maps, {ap: 1})), 2);
  const m = J.chargeMore(s0, 0);
  assert.equal(m.follow, false, "V spends the only action point and keeps none");
  assert.deepEqual(m.lights, [3], "the other Light card is spare");
  assert.equal(m.per, 1, "one pip per Light card, read off the card's own printed grant");
});

test(gate("the reader answers nothing for a single-shot charge or no sheet"), () => {
  const maps = H.db();
  assert.equal(J.chargeMore(fixture(maps), 0), null, "no sheet open");
  const g = fixture(maps, {hand: [["Beaming Bravado", 1], ["Bolt of Courage", 1]]});
  const s = open(g);
  assert.equal(s.pending.multi, false, "Beaming Bravado prints ONE charge");
  assert.equal(J.chargeMore(s, 0), null, "a card that prints one charge is not a repeating offer");
});
