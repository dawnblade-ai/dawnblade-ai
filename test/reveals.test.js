/* test/reveals.test.js — A REVEAL IS PUBLIC: hand-reveal variants beyond
   foeReveal and fusion (HIDDEN HANDS, after H3).

   v6.07 made a card both seats saw in a hand KNOWN (`_kh`, game.js
   KNOWN_MARKS) for Brain Freeze's "reveals their hand" and a fusion reveal.
   Three more printed reveals left the card in a hand, named in the shared
   feed, yet face down in the other seat's view — the safe side, but not what
   the card prints:
     Strongest Survive    "…unless they reveal a card from their hand with
                          {p} greater than the damage dealt" (the defender's
                          card stays in hand)
     Crash and Bash       "you may reveal a card with crush from your hand"
                          (an optional reveal cost: shown, kept)
     Flamecall Awakening  "search your deck for …, reveal it, put it into
                          your hand"
   CLASH is a deck-top reveal: both tops were already KNOWN TOPS (`_kt`) and
   a drawn known top becomes `_kh` — drilled in test/known.test.js.
   Each drill drives the real engine path, asks the OTHER seat's view, and
   names the grant with test/helpers/blind.js; each has a sabotage. */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const V = require("../engine/view.js");
const R = require("../engine/referee.js");
const H = require("./helpers/judged.js");
const {blind} = require("./helpers/blind.js");
const J = H.J;
const skip = !H.hasDb() && "no cached card database";
const shown = (g, seer, owner, uid) => { const c = R.seatView(g, seer).sides[owner].hand.find(x => x && String(x.uid) === String(uid)); return !!c && !V.isPh(c); };
const faceDown = (g, seer, owner) => R.seatView(g, seer).sides[owner].hand.filter(x => V.isPh(x)).length;

/* ---- Strongest Survive ---------------------------------------------------- */
const atk = (nm, pow) => ({name: nm, uid: nm, pitch: 1, power: pow, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
function survive(beats){
  H.db();
  const g = H.state({res: 9}, {hand: [atk("spare", beats ? 4 : 2), atk("other", 1)], res: 9}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.lastDmg = 3;
  return {before: g, after: H.runOps(g, [["foeDiscardUnlessReveal", 1]], "Strongest Survive")};
}
test("STRONGEST SURVIVE — the card revealed to escape stays in hand KNOWN to the attacker; the rest stay hidden", {skip}, () => {
  const {before, after} = survive(true);
  assert.equal(after.sides[1].hand.length, 2, "revealed, nothing discarded");
  assert.ok(!shown(before, 0, 1, "spare"), "before the reveal the attacker cannot see it (the drill can tell)");
  assert.ok(shown(after, 0, 1, "spare"), "after it, the attacker sees the revealed card");
  assert.ok(!shown(after, 0, 1, "other"), "and only that card");
  const b = blind(R.seatView(after, 0), 0, null, V.isPh);
  assert.ok(b.ok, b.bad.join("; "));
  assert.deepEqual(b.grants, ["hand[0] spare [_kh]"]);
});
test("SABOTAGE — no reveal (nothing beats the damage) marks nothing; a mark wiped from the state hides the card again", {skip}, () => {
  const {after} = survive(false);
  assert.equal(after.sides[1].hand.length, 1, "the discard landed");
  assert.equal(faceDown(after, 0, 1), 1, "the card left in hand was never revealed");
  const {after: rev} = survive(true);
  const wiped = {...rev, sides: rev.sides.map((sd, i) => i !== 1 ? sd : {...sd, hand: sd.hand.map(c => ({...c, _kh: undefined}))})};
  assert.ok(!shown(wiped, 0, 1, "spare"), "the view shows it BECAUSE of the mark");
});

/* ---- Crash and Bash -------------------------------------------------------- */
function crash(){
  H.db(); P.fxReset();
  const cb = {...H.card("Crash and Bash", 1), uid: "d1"};
  const crush = {...H.card("Boulder Drop", 1), uid: "h9"};
  const plain = {...H.card("Raging Onslaught", 1), uid: "h8"};
  let g = H.state({res: 9}, {hand: [crush, plain], res: 9}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g = {...g, pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"}, by: 0, total: 7, ga: false, ops: [], onHit: []}, stack: []};
  return J.withEffects(g, (fx, s) => fx.afterDefenders(s, [cb]));
}
const answer = (g, sel, o) => J.withEffects(g, (fx, s) => fx.applyAnswer(s, {...g.prompt, ...(o || {}), sel}));
test("CRASH AND BASH — the defender's revealed crush card stays in hand KNOWN to the attacker", {skip}, () => {
  const out = crash();
  assert.equal(out.prompt.side, 1, "the defender reveals");
  assert.equal(out.prompt.reveal, true, "the live sheet carries the reveal (buildPrompt kept the field)");
  assert.ok(!shown(out, 0, 1, "h9"), "before: hidden");
  const n = answer(out, [0]);
  assert.equal(n.sides[1].hand.length, 2, "shown, not spent");
  assert.ok(shown(n, 0, 1, "h9"), "after: the attacker sees the crush card");
  assert.ok(!shown(n, 0, 1, "h8"), "and not the other card");
  assert.ok(blind(R.seatView(n, 0), 0, null, V.isPh).ok);
});
test("SABOTAGE — declining reveals nothing; the same answer on a sheet without the reveal field marks nothing", {skip}, () => {
  const out = crash();
  assert.equal(faceDown(answer(out, []), 0, 1), 2, "declined: both stay hidden");
  assert.ok(!shown(answer(out, [0], {reveal: false}), 0, 1, "h9"), "the field is what marks it");
});

/* ---- Flamecall Awakening --------------------------------------------------- */
const mk = (nm, pitch, uid) => ({...H.card(nm, pitch), uid});
const RD = (g, a, s) => { const o = J.reduce(g, a, s); assert.ok(!o.error, "reduce refused: " + o.error); return o.state; };
function flamecall(){
  H.db(); P.fxReset();
  const flame = mk("Flamecall Awakening", 1, 900);
  const deck = [];
  for(let i = 0; i < 8; i++) deck.push(i % 3 === 1 ? mk("Phoenix Flame", null, 910 + i) : mk("Brothers in Arms", 1 + (i % 3), 910 + i));
  const g = H.state({hand: [flame], deck, res: 9, hist: {red: 1, blue: 0, non: 0, atkNames: [], playTy: []}}, {}, {turn: 3, actor: 0, seed: "searchseed"});
  return J.openPrompt(H.execute(g, flame, "hand", 0, {attacking: true, isAtk: true, target: "hero"}));
}
test("FLAMECALL AWAKENING — the card found, revealed and put into hand is KNOWN to the other seat", {skip}, () => {
  const g = flamecall();
  assert.equal(g.prompt.reveal, true);
  const n = RD(RD(g, {t: "promptSel", i: 0}, 0), {t: "promptConfirm"}, 0);
  const got = n.sides[0].hand.find(c => c.name === "Phoenix Flame");
  assert.ok(got, "it reached the hand");
  assert.ok(shown(n, 1, 0, got.uid), "the other seat sees the revealed Phoenix Flame");
  const b = blind(R.seatView(n, 1), 1, null, V.isPh);
  assert.ok(b.ok, b.bad.join("; "));
  assert.ok(b.grants.some(x => /Phoenix Flame \[_kh\]/.test(x)));
});
test("SABOTAGE — declining the search reveals nothing", {skip}, () => {
  const g = flamecall();
  const n = RD(g, {t: "promptConfirm"}, 0);
  assert.ok(!n.sides[0].hand.some(c => c._kh), "nothing marked");
  assert.equal(R.seatView(n, 1).sides[0].hand.filter(c => !V.isPh(c)).length, 0, "nothing face up to the other seat");
});
