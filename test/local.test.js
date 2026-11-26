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
  require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard)));

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

/* ---- PACED, AND HEARD (Table Talk TT0, v7.18) --------------------------
   docs/TABLE-TALK.md §4.4: a person across a table plays one card at a
   time and says it. `pace` applies the other seat's actions ONE PER TICK
   and pushes the board after each; `onStep` hears every accepted action.
   The ticks are driven by hand here (`later` queues them) so the drills
   are exact and need no clock. */
const manual = () => {
  const q = [], log = [];
  return {q, log,
    later: (fn, ms) => { const h = {fn, ms, live: true}; q.push(h); log.push(ms); return h; },
    cancel: h => { h.live = false; },
    /* run waiting ticks until none is left (each tick may schedule the next) */
    drain(limit){ let n = 0; while(q.length && n < (limit || 100000)){ const h = q.shift(); if(h.live){ h.fn(); n++; } } return n; }};
};

test("paced, the other seat reaches EXACTLY the states it reaches unpaced, one action per tick", {skip}, () => {
  /* The pace changes WHEN the board hears each state, never WHICH states:
     the same game, driven by the same player actions, hashes the same
     after every answer. Several turns, both seats acting. */
  const A = session(match({seed: "paced", first: 0}));
  const T = manual();
  let pushes = 0;
  const B = session(match({seed: "paced", first: 0}), {pace: 300, later: T.later, cancel: T.cancel, onState: () => pushes++});
  A.start(); B.start(); T.drain();
  assert.equal(W.hash(B.state()), W.hash(A.state()), "the paced session left its start somewhere else");
  let turns = 0;
  for(let i = 0; i < 600 && !A.state().over && A.state().turn < 7; i++){
    const a = SP.act(A.state(), 0);
    if(!a) break;
    const p0 = pushes, pol0 = B.stats().policy;
    assert.equal(A.submit(a), null, "the unpaced session refused the player's " + a.t);
    assert.equal(B.submit(a), null, "the paced session refused the player's " + a.t);
    assert.equal(pushes - p0, 1, "paced, the player's own move must be pushed at once, alone");
    assert.equal(B.stats().policy, pol0, "paced, the other seat acted INSIDE submit — it must wait for its tick");
    /* every run ends in one tick that finds nothing to do (it is the policy's turn to say so) */
    const ticks = T.drain(), did = B.stats().policy - pol0;
    assert.equal(ticks, did + 1, "each tick applies exactly one action of the other seat's, and one last tick finds none");
    assert.equal(pushes - p0, 1 + did, "and the board is pushed once per action");
    assert.equal(W.hash(B.state()), W.hash(A.state()), "after the answer the two sessions disagree (" + a.t + ", turn " + A.state().turn + ")");
    turns = A.state().turn;
  }
  assert.ok(turns >= 5, "the drill never got past turn " + turns + " — it proves nothing about the other seat's turns");
  assert.ok(B.stats().policy > 10, "the other seat barely acted (" + B.stats().policy + ")");
});

test("onStep hears every accepted action of both seats, with the states either side of it", {skip}, () => {
  for(const pace of [0, 200]){
    const T = manual(), heard = [];
    const s = session(match({seed: "heard", first: 1}), {pace, later: T.later, cancel: T.cancel, onStep: e => heard.push(e)});
    s.start(); T.drain();
    for(let i = 0; i < 200 && !s.state().over && s.state().turn < 4; i++){
      const a = SP.act(s.state(), 0); if(!a) break;
      assert.equal(s.submit(a), null); T.drain();
    }
    const st = s.stats();
    assert.equal(heard.length, st.sent + st.policy, "pace " + pace + ": heard " + heard.length + " of " + (st.sent + st.policy) + " actions");
    assert.ok(heard.some(e => e.seat === 0) && heard.some(e => e.seat === 1), "pace " + pace + ": one seat was never heard");
    for(let i = 1; i < heard.length; i++)
      assert.strictEqual(heard[i].prev, heard[i - 1].next, "pace " + pace + ": step " + i + "'s `prev` is not the state the step before left");
    assert.strictEqual(heard[heard.length - 1].next, s.state(), "the last step heard is not where the game stands");
    assert.ok(heard.every(e => e.action && typeof e.action.t === "string"), "a step without its action");
  }
});

test("the pace is asked of each action, and its answer is the wait before the next", {skip}, () => {
  const T = manual(), asked = [];
  const s = session(match({seed: "paceask", first: 1}), {later: T.later, cancel: T.cancel,
    pace: (prev, a, next) => { asked.push(a ? a.t : null); return !a ? 7 : a.t === "pass" ? 40 : 900; }});
  s.start();
  assert.deepEqual(asked, [null], "the first tick is asked as pace(null, null, state)");
  T.drain();
  /* the other seat's turn interleaves with the player's priority: answer it until the turn has moved on */
  for(let i = 0; i < 200 && !s.state().over && s.state().turn < 3; i++){
    const a = SP.act(s.state(), 0); if(!a) break;
    assert.equal(s.submit(a), null); T.drain();
  }
  const acts = asked.filter(Boolean);
  assert.ok(acts.length > 3, "the other seat should have taken several actions (" + acts.length + ")");
  assert.equal(acts.length, s.stats().policy, "the pace is asked once per action of the other seat's");
  /* each tick's wait is the answer for the action before it: 40 after a pass, 900 after anything else (7: a run's first tick) */
  assert.equal(T.log.filter(ms => ms === 7).length, asked.filter(x => x === null).length, "each run's first tick waits pace(null, null, state)");
  const waits = T.log.filter(ms => ms !== 7);
  assert.equal(waits.length, acts.length, "a wait went missing: " + T.log.join(","));
  assert.deepEqual(waits, acts.map(t => t === "pass" ? 40 : 900), "the waits did not follow the pace's answers");
});

test("paced: dispose drops the waiting tick, and nothing moves after it", {skip}, () => {
  const T = manual();
  const s = session(match({seed: "dispose", first: 1}), {pace: 500, later: T.later, cancel: T.cancel});
  s.start();
  assert.equal(s.busy(), true, "the other seat is on the play, so a tick must be waiting");
  const seq = s.seq();
  s.dispose();
  assert.equal(s.busy(), false);
  T.drain();
  assert.equal(s.seq(), seq, "a disposed session acted");
});

test("paced: nudge runs the waiting tick at once — the same action, no sooner state skipped", {skip}, () => {
  const T = manual();
  const s = session(match({seed: "nudge", first: 1}), {pace: 5000, later: T.later, cancel: T.cancel});
  s.start();
  const seq = s.seq(), pol = s.stats().policy;
  assert.equal(s.busy(), true);
  s.nudge();
  assert.equal(s.stats().policy, pol + 1, "a nudge applies exactly the one waiting action");
  assert.equal(s.seq(), seq + 1);
  const live = T.q.filter(h => h.live).length;
  assert.equal(live, 1, "the nudged tick's own wait was cancelled and exactly one next tick is waiting (" + live + ")");
  const idle = session(match({seed: "nudge", first: 0}), {pace: 5000, later: T.later, cancel: T.cancel});
  idle.start(); T.drain();
  const q0 = idle.seq(); idle.nudge();
  assert.equal(idle.seq(), q0, "a nudge with nothing waiting moves nothing");
});

test("paced, a policy that never stops is still a stall at the bound", () => {
  const T = manual(), seen = [];
  const s = L.createLocal({
    seat: 0, state: {turn: 1}, legal: () => null, pace: 10, later: T.later, cancel: T.cancel,
    reduce: g => ({state: {turn: g.turn + 1}, error: null}),
    policy: () => ({t: "pass"}), onEvent: e => seen.push(e.t)
  });
  s.start(); T.drain(L.STEP_LIMIT * 2);
  assert.equal(s.stats().stalls, 1, "the bound was not reported");
  assert.equal(s.state().turn, 1 + L.STEP_LIMIT, "it stopped somewhere other than the bound");
  assert.equal(s.busy(), false, "a stalled session keeps ticking");
});
