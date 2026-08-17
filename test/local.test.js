/* ============================================================
   local.test.js — A SESSION WITH NO NETWORK (v2.79)

   `local.js` is what lets a player alone reach the merged engine. Until
   it existed the only way into `judge.reduce` was `net.js`, which needs a
   second phone, so solo play still went to `Battle` — a different engine
   with the opponent written into the rules as a branch.

   What is drilled here is the CONTRACT, not the heuristics:

     - it exposes the SAME surface as a net session, so the board does not
       learn a second way to play a game;
     - the other seat actually acts, and acts through the same `reduce`;
     - a refusal from the policy is RECORDED, never swallowed — that is
       sparring.js's own contract and it is unenforceable from outside if
       a session quietly eats them;
     - it never answers a sheet addressed to the PLAYER;
     - it terminates, and a bound that is hit is reported as a stall.

   Driven against the real judge with real precons wherever the card
   database is available, because a session drilled only against a stub
   reducer proves the plumbing and nothing about the game.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const L = require("../engine/local.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const W = require("../engine/wire.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached card database";
const DATA = skip ? null : require("./helpers/extract.js").loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const heroBy = re => DATA.HEROES.find(h => re.test(h.n));
function match(o){
  o = o || {};
  const h0 = o.h0 || heroBy(/kayo/i), h1 = o.h1 || heroBy(/dorinthea/i);
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "local");
  const b0 = B.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k],
                     rng, first: o.first != null ? o.first : 0, tokSeq: ctr.n});
}
/* The board's own wiring, in one place so a drill cannot quietly build a
   session that differs from the one a player gets. */
const session = (g, o) => L.createLocal(Object.assign({
  seat: 0, state: g, reduce: J.reduce, legal: J.legal,
  policy: (s, i) => SP.act(s, i),
  hash: s => (s ? W.hash(s) : null)
}, o || {}));

/* ---- THE SURFACE ------------------------------------------------------ */

test("it exposes the same surface a net session does", () => {
  /* A board that has to ask which kind of session it holds is a board
     with two ways to play a game, which is what this whole merge is
     removing. The no-op members are as load-bearing as the real ones. */
  const s = session(null);
  for(const k of ["submit", "state", "seq", "seat", "isHost", "status", "stats",
                  "hash", "receive", "tick", "resync", "join"])
    assert.equal(typeof s[k], "function", "a net session has `" + k + "` and this must too");
});

test("submit returns the judge's reason, and changes nothing", {skip}, () => {
  const g = match({seed: "refuse"});
  const s = session(g);
  const before = JSON.stringify(s.state());
  /* seat 0 asking for a card it does not hold */
  const why = s.submit({t: "play", uid: -999, from: "hand"});
  assert.ok(why, "an illegal action must be refused, not applied");
  assert.equal(JSON.stringify(s.state()), before, "and refusing must cost the caller nothing");
  assert.equal(s.stats().refused, 1);
  assert.equal(s.seq(), 0, "a refused action is not a sequence step");
});

/* ---- THE OTHER SEAT ACTUALLY PLAYS ------------------------------------ */

test("the other seat takes its turn, through the same reduce", {skip}, () => {
  const g = match({seed: "turns", first: 0});
  let pushed = 0;
  const s = session(g, {onState: () => pushed++});
  s.start();

  /* Seat 0 is on the play, so nothing should have happened yet beyond the
     push — the drill would prove nothing if the policy had already moved. */
  assert.equal(s.state().turnPlayer, 0, "the fixture is not on the play");
  const seq0 = s.seq();

  /* Hand the turn over and the OTHER seat must take one. */
  let why = s.submit({t: "endTurn"});
  assert.equal(why, null, "ending the turn was refused: " + why);
  assert.ok(s.seq() > seq0 + 1,
    "the other seat did nothing — a local session with a silent opponent is solitaire");
  assert.equal(s.stats().policy > 0, true, "no policy action was recorded");
  assert.ok(pushed >= 2, "the board was not told the state moved");
});

test("a policy refusal is recorded, never swallowed", {skip}, () => {
  /* sparring.js's contract is that it offers every action to `legal`
     first, so a refusal is ALWAYS a bug in the policy. A session that ate
     them would make that unenforceable from outside — which is the only
     place it can be enforced. Driven with a policy that proposes
     something plainly illegal. */
  const g = match({seed: "badpolicy", first: 1});
  const seen = [];
  const s = session(g, {policy: () => ({t: "play", uid: -1, from: "hand"}),
                        onEvent: e => seen.push(e.t)});
  s.start();
  assert.equal(s.stats().policyRefused, 1, "the refusal was not counted");
  assert.ok(seen.indexOf("policy-refused") >= 0, "and it was not reported");
  assert.equal(s.stats().stalls, 0,
    "one refusal must STOP the loop — retrying a refused action is how a loop becomes a spin");
});

test("a policy that never stops is a stall, not a spin", () => {
  /* An unanswerable prompt or a policy with no exit is a real failure
     mode — it turned seven drills red in v2.78 — and it has to LOOK like
     one rather than hanging the phone.

     DRIVEN AGAINST A STUB REDUCER, deliberately, and it is the one drill
     here that is. The property belongs to this module's loop, not to the
     rules: against the real judge a policy that repeats itself is stopped
     by a REFUSAL long before the bound, so the drill would pass without
     the bound existing at all. That was the first version of it. */
  const seen = [];
  const s = L.createLocal({
    seat: 0, state: {turn: 1},
    legal: () => null,
    reduce: g => ({state: {turn: g.turn + 1}, error: null}),
    policy: () => ({t: "pass"}),
    onEvent: e => seen.push(e.t)
  });
  s.start();
  assert.equal(s.stats().stalls, 1, "the bound was not reported");
  assert.ok(seen.indexOf("stalled") >= 0);
  assert.equal(s.state().turn, 1 + L.STEP_LIMIT, "it stopped somewhere other than the bound");
});

/* ---- IT NEVER PLAYS FOR THE PLAYER ------------------------------------ */

test("a sheet addressed to the local seat is left alone", {skip}, () => {
  const g = match({seed: "sheet"});
  /* A pick addressed to seat 0 — the local player's own decision. */
  const asked = J.openPrompt({...g, promptQ: [{tag: "pick", side: 0, src: "Probe",
                                               zone: "hand", to: "grave", min: 1, max: 1}]});
  assert.ok(asked.prompt, "the fixture did not raise a sheet");
  const s = session(asked);
  s.start();
  assert.ok(s.state().prompt, "the session answered the PLAYER's sheet for them");
  assert.equal(s.state().prompt.side, 0);
});

test("a sheet addressed to the OTHER seat is answered by its policy", {skip}, () => {
  const g = match({seed: "sheet2"});
  const asked = J.openPrompt({...g, promptQ: [{tag: "pick", side: 1, src: "Probe",
                                               zone: "hand", to: "grave", min: 1, max: 1}]});
  assert.ok(asked.prompt, "the fixture did not raise a sheet");
  const s = session(asked);
  s.start();
  assert.equal(s.state().prompt, null,
    "seat 1's sheet was left live — a sheet stops BOTH seats, so the game is now stuck");
  assert.equal(s.state().sides[1].grave.length, 1, "and its answer actually moved a card");
});

/* ---- A WHOLE GAME ----------------------------------------------------- */

test("a local session plays a complete, legal game", {skip}, () => {
  /* The player is driven by the same policy here, which is not how it
     ships — but it is the only way to assert that a game reached a legal
     conclusion through this session rather than through `sparring.run`,
     which bypasses it entirely. */
  const g = match({seed: "whole", first: 0});
  const s = session(g);
  s.start();
  for(let i = 0; i < 4000 && !s.state().over; i++){
    const a = SP.act(s.state(), 0);
    if(!a) break;
    if(s.submit(a)) break;
  }
  const end = s.state();
  assert.ok(end.over, "the game never ended");
  assert.ok([0, 1].includes(end.over.winner), "no winner");
  assert.equal(end.over.how, "life", "the only endings are life, an effect, or a concession");
  assert.deepEqual(INV.errors(end), [], "a whole game left the state in a broken condition");
  assert.equal(s.stats().policyRefused, 0, "the policy was refused an action it had approved");
  assert.equal(s.stats().stalls, 0, "the session stalled");
  assert.ok(end.turn > 3, "the game ended suspiciously fast — turn " + end.turn);
});
