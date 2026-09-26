/* ============================================================
   JACK BE QUICK — THE POOL'S ONLY CONTROL CHANGE (v4.74)

   "When this hits a hero, {u} an ally they control, then steal it until
    the end of this action phase."

   Recorded rather than half-built at v4.68, for a reason the record named:
   moving the entry across without its OWNER is a card that works until it
   dies and then files into the wrong graveyard (v3.23). So the build is
   the ownership first and the move second:

     the pick      the STEALER chooses among THEIR living allies; one is
                   confirmed on the spot (v4.68)
     the move      untapped, stamped with its owner on the entry AND the
                   card, counters travelling with it
     the return    step (0) of the end phase — the action phase is over —
                   and it goes home TAPPED if it attacked
     a death       into the OWNER's graveyard, stamp stripped
     the judges    a stamp anywhere but a board is a site that filed it
                   wrongly, caught rather than censused
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const I = require("../engine/invariants.js");
const W = require("../engine/wire.js");
const R = require("../engine/report.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const CLAUSE = "when this hits a hero, {u} an ally they control, then steal it until the end of this action phase";

const ally = (uid, o) => Object.assign({card: {name: "Deckhand " + uid, uid, tt: "Pirate Action - Ally",
  ty: ["Pirate", "Action", "Ally"], tx: "Action - {r}: Attack", kw: [], power: 3, life: 2, cost: 1, pitch: 1},
  kind: "ally", uid, spent: true, life: 2}, o || {});
const stealFrom = (board, o) => J.openPrompt(H.runOps(
  H.state(Object.assign({res: 9, ap: 1}, (o || {}).me), Object.assign({hp: 20, board}, (o || {}).them), {turn: 3}),
  [["stealAlly", 1]], "Jack Be Quick"));

/* ---- 1. THE PARSE -------------------------------------------------------- */

test("the clause reads whole — untap, steal and the window together", () => {
  const r = P.classifyClause(CLAUSE);
  assert.ok(r && r.status === "run");
  assert.deepEqual(r.ops, [["stealAlly", 1]]);
  assert.equal(r.onHit, true);
  assert.equal(r.heroOnly, true, "the steal fired off a hit on an ALLY would be a trigger the card never prints");
});

test("near-misses refuse — each half alone is a different card (v2.29)", () => {
  for(const s of [
    CLAUSE.replace("{u} an ally they control, then steal it", "steal an ally they control"),  /* no untap */
    CLAUSE.replace("{u} ", ""),                                                               /* the untap unread */
    CLAUSE.replace(" until the end of this action phase", ""),                                /* forever */
    CLAUSE.replace("this action phase", "turn"),                                              /* a different window */
    CLAUSE.replace("they control", "you control")                                             /* your own */
  ]) assert.equal(P.classifyClause(s), null, "read a near-miss: " + s);
});

test("the whole card reads in full, and the steal rides on a HERO hit", {skip}, () => {
  H.db(); P.fxReset();
  const fx = P.fxParse(H.card("Jack Be Quick", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.onHitHero, [["stealAlly", 1]]);
  assert.deepEqual(fx.onHit, [], "filed as a bare on-hit it would steal off a hit on an ally (v3.45)");
});

/* ---- 2. THE PICK AND THE MOVE --------------------------------------------- */

test("no living ally, nothing to steal", () => {
  const n = stealFrom([ally("d", {life: 0})]);
  assert.ok(!n.prompt, "a dead ally was offered");
  assert.equal(n.sides[1].board.length, 1, "a dead ally was taken");
  assert.equal(n.sides[0].board.length, 0);
});

test("ONE ally is taken on the spot, untapped, and the stamps say whose it is", () => {
  const n = stealFrom([ally("a")], {them: {counters: {a: {pow: 2}}}});
  assert.equal(n.prompt, null, "a forced choice among one opened a sheet (v4.68)");
  assert.equal(n.sides[1].board.length, 0, "it is still on its owner's board");
  const e = n.sides[0].board[0];
  assert.ok(e && e.uid === "a", "it never reached the thief's board");
  assert.equal(e.spent, false, "\"{u} an ally they control\" — it crossed tapped");
  assert.equal(e.owner, 1, "the entry does not say who OWNS it");
  assert.equal(e.card._owner, 1, "the CARD does not say who owns it — a death could not find home");
  assert.deepEqual(n.sides[0].counters.a, {pow: 2}, "its counters stayed behind");
  assert.equal((n.sides[1].counters || {}).a, undefined, "its counters are on both sides");
  assert.deepEqual(I.errors(n), []);
});

test("TWO allies open a sheet — which one is the stealer's choice", () => {
  let n = stealFrom([ally("a"), ally("b")]);
  assert.ok(n.prompt && n.prompt.tag === "pick", "no choice was offered");
  assert.equal(n.prompt.side, 0, "the sheet went to the wrong seat — the STEALER chooses");
  n = J.reduce(n, {t: "promptSel", i: 1}, 0).state;
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.deepEqual(n.sides[0].board.map(b => b.uid), ["b"]);
  assert.deepEqual(n.sides[1].board.map(b => b.uid), ["a"]);
});

test("stealing your OWN ally back sends it home, owned by nobody else", () => {
  /* two Jacks on one ally: the second steal is a RETURN */
  const mine = ally("a", {owner: 0, card: Object.assign(ally("a").card, {_owner: 0})});
  const n = stealFrom([mine]);
  const e = n.sides[0].board[0];
  assert.ok(e && e.owner === undefined && e.card._owner === undefined, "a card came home still stamped as stolen");
  assert.deepEqual(I.errors(n), []);
});

/* ---- 3. THE RETURN --------------------------------------------------------- */

test("the end of the action phase hands it back — tapped if it attacked, counters and all", () => {
  let n = stealFrom([ally("a")], {them: {counters: {a: {pow: 1}}}});
  n = {...n, sides: n.sides.map((s, i) => i === 0 ? {...s, board: s.board.map(b => ({...b, spent: true}))} : s)};
  const r = E.beginEndPhase(n, 0);
  const home = r.game.sides[1].board.find(b => b.uid === "a");
  assert.ok(home, "it never went home");
  assert.equal(home.spent, true, "it came home UNTAPPED — only its own controller's untap step lifts a tap (CR 4.4.3d)");
  assert.equal(home.owner, undefined); assert.equal(home.card._owner, undefined);
  assert.deepEqual(r.game.sides[1].counters.a, {pow: 1});
  assert.equal(r.game.sides[0].board.length, 0);
  assert.ok(r.msgs.some(m => /returns to/.test(m)), "the feed did not say it went home");
  assert.deepEqual(I.errors(r.game), []);
});

test("it goes home at STEP (0), ahead of every other end-phase step", () => {
  /* the order is the printed window — "the end of this ACTION phase" is
     over before the end phase begins — so it is the FIRST line */
  const r = E.beginEndPhase(stealFrom([ally("a")]), 0);
  assert.match(r.msgs[0] || "", /returns to/);
});

/* ---- 4. A DEATH WHILE STOLEN ---------------------------------------------- */

test("an ally that dies while stolen goes into its OWNER's graveyard", () => {
  const n = stealFrom([ally("a")]);
  const d = G.damageAlly(n, 0, "a", 9).game;
  assert.deepEqual(d.sides[0].grave.map(c => c.uid), [], "it was filed into the THIEF's graveyard");
  const c = d.sides[1].grave.find(x => x.uid === "a");
  assert.ok(c, "it is in neither graveyard");
  assert.equal(c._owner, undefined, "it came home still stamped");
  assert.deepEqual(I.errors(d), []);
});

test("…and the same through the arena sweep, the other ally-death site", () => {
  let n = stealFrom([ally("a")]);
  n = {...n, sides: n.sides.map((s, i) => i === 0 ? {...s, board: s.board.map(b => ({...b, sd: "end"}))} : s)};
  const d = E.sweepArena(n, 0, "end").game;
  assert.equal(d.sides[0].grave.length, 0, "the sweep filed it into the THIEF's graveyard");
  assert.ok(d.sides[1].grave.some(x => x.uid === "a" && x._owner === undefined));
  assert.deepEqual(I.errors(d), []);
});

/* ---- 5. THE JUDGES ---------------------------------------------------------- */

test("a stamp off a board is an error — a site that filed it wrongly is caught, not censused", () => {
  const n = stealFrom([ally("a")]);
  const bad = {...n, sides: n.sides.map((s, i) => i === 0
    ? {...s, board: [], grave: [s.board[0].card]} : s)};
  assert.deepEqual(I.errors(bad).map(v => v.code), ["STOLEN-CARD-OFF-BOARD"]);
  /* BOTH stamps name the holding side, so only the "owned by itself" half
     of the check can see it — a fixture that also broke the entry/card
     agreement would pass with that half deleted. */
  const self = {...n, sides: n.sides.map((s, i) => i === 0
    ? {...s, board: s.board.map(b => ({...b, owner: 0, card: {...b.card, _owner: 0}}))} : s)};
  assert.ok(I.errors(self).some(v => v.code === "STOLEN-ENTRY-SHAPE"), "an entry owned by its own side passed");
});

/* ---- 6. DRIVEN AT THE TABLE ------------------------------------------------ */

function table(o){
  H.db();
  const jbq = {...H.card("Jack Be Quick", 1), uid: "jbq"};
  const sw = {...H.card("Swabbie", 2), uid: "sw"};
  return {...H.state({res: 9, ap: 2, hand: [jbq], board: []},
    {hp: 20, res: 0, hand: [], board: [{card: sw, kind: "ally", uid: "sw", spent: true, life: sw.life}]},
    {turn: 3, actor: 0, turnPlayer: 0}),
    phase: "action", step: "layer", priority: 0, passed: [false, false], stack: [], chain: [], chainCards: []};
}
const pass = n => { const o = J.reduce(n, {t: "pass"}, n.priority); if(o.error) throw new Error(o.error); return o.state; };
const settle = n => { for(let i = 0; i < 60 && n.priority != null && (n.pend || n.step !== "layer"); i++) n = pass(n); return n; };
const passTurn = g => {
  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  return n;
};

test("the whole cycle: hit, steal, swing it for the thief, and it goes home tapped", {skip}, () => {
  let n = settle(H.drain(J.reduce(table(), {t: "play", uid: "jbq", from: "hand"}, 0).state));
  assert.equal(n.sides[1].hp, 17, "fixture: Jack did not connect");
  assert.deepEqual(n.sides[0].board.map(b => [b.uid, b.owner, b.spent]), [["sw", 1, false]]);
  assert.equal(J.legal(n, {t: "activate", uid: "sw", target: "hero"}, 0), null,
    "the thief cannot attack with the ally it stole — the steal is decoration");
  n = settle(H.drain(J.reduce(n, {t: "activate", uid: "sw", target: "hero"}, 0).state));
  assert.equal(n.sides[1].hp, 10, "the stolen Swabbie did not swing at its OWNER for its printed 7");
  n = passTurn(n);
  assert.equal(n.turnPlayer, 1, "fixture: the turn never passed");
  const home = n.sides[1].board.find(b => b.uid === "sw");
  assert.ok(home && home.spent && home.owner == null, "it did not come home tapped and unstamped");
  assert.match(String(J.legal({...n, sides: n.sides.map((s, i) => i === 1 ? {...s, res: 9} : s)},
    {t: "activate", uid: "sw", target: "hero"}, 1)), /tapped/,
    "its owner could swing an ally the thief had already tapped");
  assert.deepEqual(I.errors(n), []);
});

test("a hit on an ALLY steals nothing — the printed trigger names a hero", {skip}, () => {
  let g = table();
  g = J.reduce(g, {t: "play", uid: "jbq", from: "hand", target: "sw"}, 0).state;
  const n = settle(H.drain(g));
  assert.equal(n.sides[0].board.length, 0, "a hit on an ally stole it");
});

/* ---- 7. IT SURVIVES THE WIRE AND THE REPORT -------------------------------- */

test("a stolen board round-trips the wire with its stamps, and the report says whose it is", () => {
  const n = stealFrom([ally("a")]);
  const back = W.decode(W.encode(n));
  assert.equal(W.hash(back), W.hash(n), "a stolen board desyncs two honest peers");
  assert.deepEqual(back.sides[0].board.map(b => [b.owner, b.card._owner]), [[1, 1]]);
  assert.match(R.seat(n.sides[0]).board.join(" "), /stolen from seat 1/);
});
