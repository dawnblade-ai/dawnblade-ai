/* ============================================================
   test/herald.test.js — PRISM'S HERALDS GO TO THE SOUL AND DO THE REST (v6.47)

   Prism, Advent of Thrones' Heralds print "When this hits, put it into your
   soul and <rider>". The rider's own unanchored reader ("gain 1{h}", "create
   a Spectral Shield token", "deal 1 arcane damage to target hero") matched the
   whole line first, so the soul half was dropped while the row read `full`;
   Herald of Judgment read the soul half and dropped its rider, also `full`.
   `classifyClause` now splits "put it into your soul and" before any reader
   sees the line, and a rider it cannot read refuses the whole clause.
   Staged records (the hero is not open yet), driven at the table.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const act = (g, a, seat) => {
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " was refused: " + out.error);
  return out.state;
};
const names = z => (z || []).map(c => c.name);
/* play the attack from hand and let it resolve unblocked */
function swing(card, o){
  H.db();
  let g = table(H.state(Object.assign({res: 9, ap: 1, hp: 15, hand: [card]}, o || {}),
    {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  g = act(g, {t: "play", uid: card.uid, from: "hand"}, 0);
  for(let i = 0; i < 60 && !g.over; i++){
    if(g.prompt){ g = act(g, {t: "promptConfirm"}, g.prompt.side); continue; }
    if(g.pending){ break; }
    if(!g.pend && !(g.stack || []).length && !(g.chain || []).length) break;
    const out = J.reduce(g, {t: "pass"}, g.priority);
    if(out.error) break;
    g = out.state;
  }
  return g;
}

test("the line is two ops, the soul first; an unread rider refuses the line", () => {
  const cl = t => P.classifyClause(t);
  assert.deepEqual(cl("put it into your soul and gain 1{h}").ops, [["soulSelf"], ["life", 1]]);
  assert.deepEqual(cl("put it into your soul and create a Spectral Shield token").ops,
    [["soulSelf"], ["token", "spectral shield", 1, "self"]]);
  assert.deepEqual(cl("put it into your soul and deal 1 arcane damage to target hero").ops, [["soulSelf"], ["arcane", 1]]);
  assert.deepEqual(cl("put it into your soul").ops, [["soulSelf"]], "the bare line moved");
  assert.equal(cl("put it into your soul and the defending hero can't play cards from their banished zone until the end of their next turn"),
    null, "an unread rider was dropped instead of refusing");
});

test("Herald of Judgment is no longer filed full with its rider missing", {skip}, () => {
  P.fxReset();
  const f = P.fxParse(staged("Herald of Judgment"));
  assert.notEqual(f.tier, "full", "the banished-zone lock is unread and the row says full");
});

test("at the table: Herald of Hope hits, goes to the soul, and its player gains 1", {skip}, () => {
  P.fxReset();
  const g = swing(staged("Herald of Hope", "h1", 1));
  const me = g.sides[0];
  assert.ok(g.sides[1].hp < 20, "fixture: the attack did not hit");
  assert.deepEqual(names(me.soul), ["Herald of Hope"], "the Herald did not go to the soul");
  assert.ok(!names(me.grave).includes("Herald of Hope"), "the Herald went to the graveyard as well");
  assert.equal(me.hp, 16, "the rider's 1{h} was not gained");
});

test("at the table: Herald of Protection makes its Spectral Shield and goes to the soul", {skip}, () => {
  P.fxReset();
  const g = swing(staged("Herald of Protection", "h2", 1));
  const me = g.sides[0];
  assert.ok(g.sides[1].hp < 20, "fixture: the attack did not hit");
  assert.deepEqual(names(me.soul), ["Herald of Protection"]);
  assert.ok((me.board || []).some(b => b && b.card && /Spectral Shield/.test(b.card.name)), "no Spectral Shield token");
});

test("at the table: Herald of Ravages deals its arcane and goes to the soul", {skip}, () => {
  P.fxReset();
  const g = swing(staged("Herald of Ravages", "h3", 1));
  const me = g.sides[0], power = staged("Herald of Ravages", null, 1).power;
  assert.deepEqual(names(me.soul), ["Herald of Ravages"]);
  assert.equal(g.sides[1].hp, 20 - power - 1, "the hit plus 1 arcane was not dealt");
});
