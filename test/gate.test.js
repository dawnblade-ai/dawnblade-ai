/* ============================================================
   gate.test.js — THE GATE TO I'ARATHAEL AND ITS GRANT (v6.41)

   The fifth reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).

     Gate to i'Arathael (Shadow Token - Aura)
       "Instant - {r}, destroy this: You may play target action card with
        blood debt from your banished zone this turn."

   WHAT WAS MISSING, MEASURED: the token itself was already minted (the
   record is in the pinned pool, and Pull from Beyond's rider resolves it);
   its ABILITY read nothing, so the table refused the activation and the
   Gate sat in the arena as a blank.

   WHAT THE READER IS: no new machinery. The printed target is declared at
   activation (`abTargetSpec`, v5.72, Beckoning Haunt's route); the pick is
   over the banished zone and moves nothing; the answer stamps the chosen
   card playable for this turn (`_playTurn`, the window `playZoneWhy` has
   read on both boards since v3.92). The card is then played by the
   ordinary route, at its own speed, for its own cost, and goes to the
   graveyard like any card played from banish (RULING 2026-10-31).

   Driven at the table (judge.reduce), asserting on zones, resources,
   action points and legality — never on feed prose.

   THE FIXTURE CARD IS A TWIN, AND IT HAS TO BE. Every blood debt card in
   the staged list also prints "You may play this from your banished
   zone", so with a staged card the play is legal with or without the Gate
   and the drill would test neither (asserted below). The twin keeps the
   staged record's printed fields and drops that one line.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const BD = require("../engine/build.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const pool = (nm, p, uid) => ({...H.card(nm, p), uid});
const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const act = (g, a, seat) => {
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " was refused: " + out.error);
  return out.state;
};
const names = z => (z || []).map(c => c.name);
const GATE = "Gate to i'Arathael";
const gateEntry = uid => ({uid, kind: "token", spent: false, card: {...staged(GATE), uid}});
/* a blood debt attack action that does NOT print its own banished-zone line */
const debt = (uid, nm) => ({...staged("Vexing Gloomblade", uid, 1), name: nm || "Drill Debt Blade", tx: "Blood Debt"});
const ACTIVATE = {t: "activate", uid: "gt1"};
const world = (banish, o) => table(H.state(Object.assign({res: 9, ap: 1, hand: [], board: [gateEntry("gt1")], banish}, o || {}),
  {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));

/* ---------------------------------------------------------------- */

test("the fixture bites: the twin carries blood debt and has no route of its own", () => {
  const d = debt("d1");
  assert.ok(P.printedKw(d, "blood debt"), "the twin does not carry blood debt");
  assert.ok(!P.fxParse(d).fromBan, "the twin still prints its own banished-zone line");
  assert.ok(P.fxParse(staged("Vexing Gloomblade", null, 1)).fromBan,
    "the staged card no longer prints the line — a staged card can be the fixture now");
});

test("the reader: the Gate's line is a cost, a declared target and a stamp", () => {
  const gate = staged(GATE);
  const pw = P.parseHeroPower(gate.tx, true);
  assert.ok(pw, "the Gate's activation line is unread");
  assert.equal(pw.cost, 1);
  assert.equal(pw.kind, "instant");
  assert.equal(pw.sd, true, "the printed destroy is not part of the cost");
  const ab = BD.boardPow(gateEntry("gt1"));
  assert.ok(ab && ab._instant, "the arena builder makes no ability of it");
  const spec = P.abTargetSpec(ab);
  assert.ok(spec, "the printed target is not declared at activation");
  assert.equal(spec.zone, "banish");
  assert.equal(spec.to, undefined, "the grant moves the card");
  assert.equal(spec.min, 1, "the target became optional");
  assert.deepEqual(spec.filter, {kw: "blood debt", ty: "action"});
  assert.deepEqual(spec.banStamp, {playThisTurn: true});
  assert.equal(P.fxParse(gate).tier, "full");
  assert.ok(!P.fxParse(gate).fromBan, "the Gate grants ITSELF the route");
});

test("the reader refuses what it cannot pin", () => {
  const cl = t => P.classifyClause(t);
  const read = r => !!(r && r.status === "run" && (r.ops || []).some(o => o[0] === "pickPrompt" && o[1].zone === "banish"));
  assert.ok(read(cl("You may play target action card with blood debt from your banished zone this turn")), "the control is unread");
  assert.ok(!read(cl("You may play target action card with blood debt from your banished zone")), "a grant with no printed window was given one");
  assert.ok(!read(cl("You may play target action card with blood debt from your graveyard this turn")), "the graveyard was read as the banished zone");
  assert.ok(!read(cl("You may play target card with a sea shanty from your banished zone this turn")), "an unreadable subject was read as any card");
  assert.ok(!read(cl("You may play target action card with blood debt from your banished zone this turn as though it were an instant")),
    "a speed grant was swallowed");
  /* the subject is the printed one: an attack action is an action card */
  assert.deepEqual(P.pickSubject("action card with blood debt"), {kw: "blood debt", ty: "action"});
});

test("Pull from Beyond mints a real Gate when the banished card is its colour, and none when it is not", {skip}, () => {
  H.db();
  const pull = top => {
    let g = table(H.state({res: 9, ap: 1, hand: [staged("Pull from Beyond", "pf", 1)], deck: [top, pool("Wounding Blow", 2, "d9")]},
      {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
    g = act(g, {t: "play", uid: "pf", from: "hand"}, 0);
    for(let i = 0; i < 6 && !g.prompt && (g.stack || []).length; i++) g = act(g, {t: "pass"}, g.priority);
    return act(g, {t: "promptConfirm"}, 0);
  };
  const red = pull(pool("Critical Strike", 1, "d1"));
  assert.deepEqual(names(red.sides[0].banish), ["Critical Strike"]);
  assert.deepEqual(red.sides[0].board.map(b => b.card.name), [GATE], "a red card banished and no Gate arrived");
  assert.equal(red.sides[0].board[0].kind, "token");
  assert.ok(BD.boardPow(red.sides[0].board[0]), "the minted Gate has no ability");
  const blue = pull(pool("Brutal Assault", 3, "d1"));
  assert.deepEqual(names(blue.sides[0].banish), ["Brutal Assault"]);
  assert.deepEqual(blue.sides[0].board, [], "a blue card paid the red rider");
});

test("at the table: the Gate is paid for and destroyed, and the target may be played this turn only", {skip}, () => {
  H.db();
  const PLAY = {t: "play", uid: "d1", from: "banish"};
  let g = world([debt("d1"), pool("Brutal Assault", 3, "b2")]);
  assert.ok(J.legal(g, PLAY, 0), "fixture: the twin is playable from banish before the Gate is used");
  assert.equal(J.legal(g, ACTIVATE, 0), null, "the table refuses the Gate's ability");
  g = act(g, ACTIVATE, 0);
  for(let i = 0; i < 6 && !g.prompt && (g.stack || []).length; i++) g = act(g, {t: "pass"}, g.priority);
  const me = g.sides[0];
  assert.equal(me.res, 8, "the printed {r} was not charged");
  assert.equal(me.ap, 1, "an instant cost an action point (CR 8.1.6)");
  assert.deepEqual(me.board, [], "the Gate was not destroyed");
  assert.deepEqual(names(me.grave), [], "a destroyed TOKEN was filed in the graveyard");
  assert.deepEqual(names(me.banish), ["Drill Debt Blade", "Brutal Assault"], "the grant moved a card");
  assert.ok(!g.prompt && !g.pending, "one legal target is not a question");
  assert.equal(J.legal(g, PLAY, 0), null, "the target is still not playable");
  assert.ok(J.legal(g, {t: "play", uid: "b2", from: "banish"}, 0), "the grant reached a card that was not the target");
  /* this turn only */
  assert.ok(J.legal({...g, turn: g.turn + 2}, PLAY, 0), "the permission outlived the turn");
  /* played by the ordinary route: its own cost, an action point, then the graveyard */
  const cost = me.banish[0].cost;
  assert.ok(cost > 0, "fixture: the twin costs something");
  g = act(g, PLAY, 0);
  for(let i = 0; i < 40 && !g.over; i++){
    if(g.prompt){ g = act(g, {t: "promptConfirm"}, g.prompt.side); continue; }
    if(!g.pend && !(g.stack || []).length) break;
    g = act(g, {t: "pass"}, g.priority);
  }
  assert.equal(g.sides[0].res, 8 - cost, "the card was not played for its own cost");
  assert.equal(g.sides[0].ap, 0, "an action card played under the Gate kept the action point");
  assert.deepEqual(names(g.sides[0].banish), ["Brutal Assault"]);
  const gone = g.sides[0].grave.find(c => c.uid === "d1");
  assert.ok(gone, "a card played from banish did not go to the graveyard");
  assert.equal(gone._playTurn, undefined, "the permission travelled with the card");
  assert.ok(g.sides[1].hp < 20, "the attack was not a real attack");
});

test("the target is required: with none the activation is refused and nothing is paid", {skip}, () => {
  H.db();
  /* an action with no blood debt, and a blood debt card that is not an action */
  const notAction = {...pool("Brutal Assault", 3, "b3"), name: "Drill Debt Instant", tx: "Blood Debt",
    tt: "Shadow Instant", ty: ["Shadow", "Instant"], power: null};
  assert.ok(P.printedKw(notAction, "blood debt"), "fixture: the instant carries blood debt");
  const g = world([pool("Brutal Assault", 3, "b2"), notAction]);
  assert.ok(J.legal(g, ACTIVATE, 0), "the Gate was activated at nothing");
  const out = J.reduce(g, ACTIVATE, 0);
  assert.ok(out.error, "reduce disagreed with legal");
  /* and with a target but no way to pay */
  const broke = world([debt("d1")], {res: 0});
  assert.ok(J.legal(broke, ACTIVATE, 0), "an unpayable cost was free");
  /* each kind of non-target, alone, is still refused once a real one is absent */
  assert.equal(J.legal(world([debt("d1"), notAction]), ACTIVATE, 0), null);
});

test("two legal targets are a question, asked before the cost; only the declared card is stamped", {skip}, () => {
  H.db();
  let g = world([debt("d1"), debt("d2", "Drill Debt Edge"), pool("Brutal Assault", 3, "b2")]);
  g = act(g, ACTIVATE, 0);
  assert.equal(g.pending && g.pending.kind, "abtarget", "no target question opened");
  assert.deepEqual([...g.pending.uids].sort(), ["d1", "d2"], "the question offers a card that is not a legal target");
  assert.equal(g.sides[0].res, 9, "the cost was paid before the target was declared");
  assert.equal(g.sides[0].board.length, 1, "the Gate was destroyed before the target was declared");
  assert.ok(J.legal(g, {t: "abtarget", uid: "b2"}, 0), "a card outside the question was accepted");
  /* the AI seat answers it through the judge's reader, with no refusal */
  const call = SP.act(g, 0);
  assert.equal(call.t, "abtarget");
  assert.equal(J.legal(g, call, 0), null, "the policy's declaration was refused");
  g = act(g, {t: "abtarget", uid: "d2"}, 0);
  for(let i = 0; i < 6 && !g.prompt && (g.stack || []).length; i++) g = act(g, {t: "pass"}, g.priority);
  assert.equal(g.sides[0].res, 8);
  assert.deepEqual(g.sides[0].board, []);
  assert.equal(J.legal(g, {t: "play", uid: "d2", from: "banish"}, 0), null, "the declared card is not playable");
  assert.ok(J.legal(g, {t: "play", uid: "d1", from: "banish"}, 0), "the card that was NOT declared is playable");
});
