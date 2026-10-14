/* "IT GETS -1{p} UNLESS YOU PAY {r}" IS THE PLAYER'S CALL (v5.24)

   QUEUE item 11. Look Tuff tested FLOATING resources only and decided for
   the player: with 0 floating and pitchable cards in hand it printed
   "can't pay 1" — a falsehood, under the pitch-on-demand ruling
   (2026-08-01) — and took the penalty. The reason it gave was a timing
   wall that v4.80 removed: a sheet queued at an attack's declaration opens
   there on both boards, so the answer lands on THIS swing. The shared pay
   sheet asks now; declining runs `elseOps` (`self -1` on the open link). */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

function board(hand, res){
  H.db();
  const lt = H.card("Look Tuff", 1);
  const g = H.state({res, ap: 1, name: "Iyslander", hand: [{...lt, uid: 11}, ...hand]}, {hp: 20},
                    {turn: 3, actor: 0, turnPlayer: 0});
  return {...g, phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const declare = g => {
  const out = J.reduce(g, {t: "play", uid: 11, from: "hand"}, 0);
  assert.ok(!out.error, String(out.error));
  return H.drain(out.state);
};
const answer = (s, choice) => {
  let m = J.reduce(s, {t: "promptChoose", choice}, 0);
  assert.ok(!m.error, String(m.error));
  m = J.reduce(m.state, {t: "promptConfirm"}, 0);
  assert.ok(!m.error, String(m.error));
  return m.state;
};
const blue = () => ({...H.card("Voltic Bolt", 3), uid: 21});

test("DRIVEN: 0 floating and a pitchable hand — the sheet ASKS, at the declaration", {skip}, () => {
  const s = declare(board([blue()], 3));
  assert.equal(s.sides[0].res, 0, "fixture: nothing floating once Look Tuff is paid for");
  assert.ok(s.prompt && s.prompt.tag === "pay" && s.prompt.side === 0, "the controller is asked");
  assert.equal(s.prompt.cost, 1);
  assert.equal(s.pend.total, 8, "nothing is taken before the answer");
  assert.ok(!(s.feed || []).some(l => /can't pay/.test(l)), "and no line says it cannot pay");
});

test("DRIVEN: paying pitches on demand and keeps the printed 8", {skip}, () => {
  const m = answer(declare(board([blue()], 3)), "pay");
  assert.equal(m.pend.total, 8);
  assert.equal(m.sides[0].hand.length, 0, "the blue was pitched");
  assert.equal(m.sides[0].res, 2, "3 from the pitch, 1 spent");
  assert.ok((m.feed || []).some(l => /avoids what declining costs/.test(l)),
    "an 'unless' paid says it AVOIDED the penalty — not that a rider resolved");
});

test("DRIVEN: declining lands -1 on THIS swing", {skip}, () => {
  const m = answer(declare(board([blue()], 3)), "decline");
  assert.equal(m.pend.total, 7);
  assert.equal(m.sides[0].hand.length, 1, "nothing pitched");
});

test("DRIVEN: a seat that cannot reach the cost even by pitching takes it without a sheet", {skip}, () => {
  const s = declare(board([], 3));
  assert.ok(!s.prompt, "nothing to ask");
  assert.equal(s.pend.total, 7);
  assert.ok((s.feed || []).some(l => /can't be raised, even by pitching/.test(l)), "and the line is true");
});

test("a negative `self` floors at zero and reads as a minus", () => {
  const g = {...H.state({}, {}), pend: {card: {name: "X"}, by: 0, total: 1, ops: []}};
  const n = H.runOps(g, [["self", -3]], "Probe");
  assert.equal(n.pend.total, 0, "an attack's power never goes below zero");
  assert.ok((n.feed || []).some(l => /: -3 power/.test(l)) && !(n.feed || []).some(l => /\+-/.test(l)));
});
