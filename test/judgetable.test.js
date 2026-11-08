/* test/judgetable.test.js — HIDDEN HANDS H3: THE NEUTRAL REFEREE (HIDDEN-HANDS.md
   §3(c), §6's H3 row). A judged table: engine/hub.js on a THIRD device holds
   the deck and runs the same referee.js; both players' phones are plain
   referee guests, so BOTH are blind.

   Over test/helpers/judgetable.js (three parties, one JSON FIFO, no network):
     - the lobby's judge mode: the judge commits to the seed, both players
       answer, and nobody else may;
     - a TWO-PHONE LOOPBACK THROUGH A THIRD-PARTY REFEREE, for all 15 heroes
       (eight games), each phone proposing from its own view;
     - BOTH PHONES BLIND: after every commit each phone's view equals the
       referee's view of that seat (canary and full compare), and no frame
       either phone received names a uid hidden from it, carries the seed's
       secret half before the reveal, or exceeds the data-channel budget;
     - a phone acts and negotiates for its OWN seat only; a third phone is
       turned away; a live seat cannot be claimed;
     - a PLAYER drops and rejoins, the JUDGE drops and resumes from what it
       persisted: each game ends exactly as an uninterrupted one;
     - the post-game reveal verifies on BOTH phones, a lying one on neither.
   Every proving drill has a sabotage beside it that must fail. Asserts on
   zones, uids, fingerprints and logs; no feed prose. */
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./helpers/judgetable.js");
const {makeTable, judgedGame, L, R, V, Wr, SP, J, HEROES, json, tokens, hiddenUidSet} = T;
const SHA = require("../engine/sha256.js");

const WIRE_BUDGET = 16 * 1024;   /* test/table.test.js's: what a data channel carries reliably */

/* ---- the lobby's judge mode ------------------------------------------- */
test("JUDGE LOBBY — the judge (seat 2) commits to the seed, BOTH players answer once, and the seed needs all three halves", () => {
  const rand = T.seeded("lobby");
  let s = L.newLobby({code: "JDGE", judge: true});
  const ok = m => { const r = L.reduce(s, m); assert.equal(r.error, null, JSON.stringify(r.error)); s = r.state; };
  const no = (m, re) => { const r = L.reduce(s, m); assert.ok(r.error, "refused: " + JSON.stringify(m)); if(re) assert.match(r.error.why, re); assert.equal(r.state, s); };
  ok(L.hello(L.JUDGE, "b")); ok(L.hello(0, "b")); ok(L.hello(1, "b"));
  no(L.seedAnswer(rand, 0), /too early/);                                   /* an answer before the commitment */
  no(L.seedCommitMsg(rand, 0).msg, /only the judge/);                       /* a player cannot commit */
  no(L.hero(L.JUDGE, "kayo"), /no such seat/);                              /* the judge never picks a hero */
  const sc = L.seedCommitMsg(rand, L.JUDGE);
  ok(sc.msg);
  for(const m of [L.hero(0, "kayo"), L.hero(1, "azalea")]) ok(m);
  const t0 = L.throwSeal(0, 0, "paper", rand), t1 = L.throwSeal(1, 0, "rock", rand);
  ok(t0.seal); ok(t1.seal); ok(t0.open); ok(t1.open);
  ok(L.seating(0, "first")); ok(L.sideboard(0, [], {})); ok(L.sideboard(1, [], {}));
  const g0 = L.seedAnswer(rand, 0);
  ok(g0);
  assert.equal(L.stepOf(s), "seed", "one player's answer alone does not ready the table");
  assert.deepEqual(L.waitingOn(s), [1]);
  no(L.seedAnswer(rand, 0));                                                /* write-once */
  no({...L.seedAnswer(rand, 1), seat: L.JUDGE}, /no such seat/);            /* the judge cannot answer for a player */
  const g1 = L.seedAnswer(rand, 1);
  ok(g1);
  assert.equal(L.stepOf(s), "ready");
  const spec = L.matchSpec(s, sc.seedH);
  assert.equal(spec.seed, SHA.seedOf(sc.seedH, g0.g + g1.g), "the seed is H(judge's half | seat 0's | seat 1's)");
  assert.equal(L.matchSpec(s).seed, null, "a player's phone, without the judge's half, cannot derive the seed");
  assert.equal(L.matchSpec(s, "0".repeat(32)), null, "a half that does not open the commitment derives nothing");
  /* SABOTAGE: a plain (H2) lobby refuses the judge's seat outright */
  const plain = L.newLobby({code: "X"});
  assert.ok(L.reduce(plain, L.hello(L.JUDGE, "b")).error);
  assert.ok(L.reduce(plain, L.seedCommitMsg(rand, L.JUDGE).msg).error);
});

test("JUDGE LOBBY — the judge's device must run the same build as both phones", () => {
  let s = L.newLobby({judge: true});
  s = L.reduce(s, L.hello(L.JUDGE, "v2")).state;
  s = L.reduce(s, L.hello(0, "v1")).state;
  assert.equal(L.stepOf(s), "fault", "the players agree with each other, not with the judge");
  assert.match(s.fault, /judge/);
  let p = L.newLobby({judge: true});
  for(const m of [L.hello(L.JUDGE, "v1"), L.hello(0, "v1"), L.hello(1, "v1")]) p = L.reduce(p, m).state;
  assert.equal(L.stepOf(p), "hero", "three matching builds sit down");
});

/* ---- the loopback through a third-party referee ------------------------ */
/* all 15 heroes in eight games: pairs along the list, the last against the first */
const PAIRS = [];
for(let i = 0; i < HEROES.length; i += 2) PAIRS.push([HEROES[i], HEROES[(i + 1) % HEROES.length]]);
const RUNS = PAIRS.slice(0, +process.env.JUDGE_GAMES || PAIRS.length).map(([a, b], i) => ({a, b, ...judgedGame(a, b, "h3-" + i)}));
if(process.env.JUDGE_DEBUG) module.exports = {judgedGame, RUNS};

test("THE LOOPBACK THROUGH A THIRD-PARTY REFEREE — two guest phones and the judge's hub play all 15 heroes to a result", () => {
  assert.equal(new Set(PAIRS.flat()).size, HEROES.length, "every hero sat at a judged table");
  for(const r of RUNS){
    assert.ok(r.over, r.a + " v " + r.b + " finished");
    assert.ok(r.steps > 50, r.a + " v " + r.b + ": " + r.steps + " actions");
    assert.deepEqual(r.t.hub.session().violations(), [], "the invariant judge ran on the FULL state at the judge's device");
    for(const p of r.t.phones){ assert.equal(p.sess.status(), "ready"); assert.deepEqual(p.refused, [], "no lobby refusal"); }
  }
});

test("BOTH PHONES BLIND — after every commit each phone's view equals the referee's view of THAT seat", () => {
  for(const r of RUNS){
    assert.deepEqual(r.mism, [0, 0], r.a + " v " + r.b + ": fingerprint disagreements per seat");
    assert.deepEqual(r.deep, [0, 0], r.a + " v " + r.b + ": whole-view disagreements per seat");
  }
});

test("BOTH PHONES BLIND — no frame either phone received names a uid hidden from it, or the seed, or exceeds the budget", () => {
  for(const r of RUNS){
    assert.deepEqual(r.leaks[0].slice(0, 3), [], r.a + " v " + r.b + ": seat 0 received " + r.leaks[0].length + " hidden uids");
    assert.deepEqual(r.leaks[1].slice(0, 3), [], r.a + " v " + r.b + ": seat 1 received " + r.leaks[1].length + " hidden uids");
    assert.equal(r.seedLeak, 0, "a frame before the reveal carried the seed");
    assert.equal(r.earlyReveal, 0, "the reveal came only once the game was over");
    assert.ok(r.big <= WIRE_BUDGET, "a frame of " + r.big + " bytes");
    assert.equal(r.judgeLeak, 0, "the judge's own screen showed a card hidden from both seats");
  }
  /* and the phones' memory: each holds a view of its own seat, the other
     seat's hand and deck face down (bar the public known marks) */
  for(const r of RUNS) for(const p of r.t.phones){
    const v = p.sess.state(), foe = v.sides[1 - p.seat];
    assert.equal(v.viewSeat, p.seat);
    assert.ok(foe.deck.filter(c => !c._kb && !c._kt).every(V.isPh), "the other seat's deck is placeholders");
    assert.ok(v.rng && v.rng.hidden, "no phone holds the rng");
    assert.ok(!p.sess.full(), "a phone holds no full state");
  }
});

test("SABOTAGE — a judge that sends each phone the full state is caught leaking to BOTH seats at once", () => {
  const r = judgedGame(HEROES[0], HEROES[1], "sab-full", {seatView: g => json(g), stopAtLeak: true});
  assert.ok(r.leaks[0].length > 0, "seat 0's leak was caught");
  assert.ok(r.leaks[1].length > 0, "seat 1's leak was caught");
});

test("SABOTAGE — a judge that sends each phone the OTHER seat's view fails the agreement drill and the leak scan", () => {
  const r = judgedGame(HEROES[2], HEROES[3], "sab-swap", {seatView: (g, s) => R.seatView(g, s < 0 ? s : 1 - s), stopAtLeak: true});
  assert.ok(r.mism[0] + r.mism[1] > 0 || r.leaks[0].length + r.leaks[1].length > 0);
  assert.ok(r.leaks[0].length + r.leaks[1].length > 0, "the swapped view named hidden uids");
});

/* ---- seats ------------------------------------------------------------- */
test("A PHONE SPEAKS FOR ITS OWN SEAT — an intent or a lobby message naming the other seat is refused and goes nowhere", () => {
  const t = makeTable({heroes: ["kayo", "azalea"], salt: "forge"}).open();
  const [p0, p1] = t.seatPhones();
  for(let i = 0; i < 10; i++) t.step();
  const seq = t.hub.session().seq(), h = Wr.hash(t.hub.session().full());
  /* a forged intent for seat 1, sent down seat 0's channel */
  p0.say({ch: "net", m: {t: "intent", id: 99, seat: 1, action: {t: "pass"}}});
  t.flush();
  assert.equal(t.hub.session().seq(), seq);
  assert.equal(Wr.hash(t.hub.session().full()), h, "the game did not move");
  assert.ok(p0.inbox.some(f => f.m && f.m.t === "nack" && f.m.id === 99), "seat 0 was told no");
  /* a forged lobby message: a valid one for seat 1, from seat 0's channel */
  const before = p1.inbox.length;
  const forged = L.hero(1, "kayo");
  p0.say({ch: "lobby", m: forged});
  t.flush();
  assert.ok(t.ev.some(e => e.t === "forged" && e.seat === 0 && e.claimed === 1));
  assert.equal(p1.inbox.slice(before).filter(f => f.ch === "lobby").length, 0, "never relayed");
  /* SABOTAGE: the same message from seat 1's own channel is valid lobby
     traffic (the refusal above is the channel check, not a malformed frame) */
  assert.equal(L.reduce(L.newLobby({judge: true}), forged).error, null);
});

test("THE KEY HOLDS THE CHAIR — a stranger with the table code is seated nowhere; a dropped phone reclaims its seat with its key, nobody else can", () => {
  const t = makeTable({heroes: ["kayo", "azalea"], salt: "third"}).open();
  const [p0, p1] = t.seatPhones();
  assert.ok(p0.key && p1.key && p0.key !== p1.key, "each phone was dealt a key");
  const c = t.phone("C", "kayo"); c.dial(); t.flush();
  assert.ok(c.inbox.some(f => f.ch === "judge" && f.full), "a full table says so");
  assert.equal(c.seat, null);
  /* p0 drops: the stranger still gets no seat, by arrival or by claim */
  p0.drop(); t.flush();
  const d = t.phone("D", "kayo"); d.dial(); t.flush();
  assert.equal(d.seat, null, "a keyed seat is never offered to a new arrival");
  d.say({ch: "judge", claim: 0, key: "0".repeat(32)}); t.flush();
  assert.ok(d.inbox.some(f => f.ch === "judge" && f.refused), "a wrong key is refused");
  assert.equal(d.seat, null);
  /* SABOTAGE: p1's real key cannot take p1's seat while p1 holds it live */
  d.say({ch: "judge", claim: 1, key: p1.key}); t.flush();
  assert.equal(d.seat, null);
  assert.equal(d.inbox.filter(f => f.ch === "judge" && f.refused).length, 2, "a live seat cannot be claimed, even with its key");
  /* p0 comes back with its key */
  p0.redial(); t.flush();
  assert.equal(p0.sess.status(), "ready");
  assert.ok(t.agrees(0));
  assert.ok(!d.inbox.some(f => f.ch === "net"), "the stranger never received a frame of the game");
});

/* ---- drops ------------------------------------------------------------- */
const play = (t, limit) => { let n = 0; while(n < (limit || 3000) && t.step()) n++; return n; };
const BASE = (() => { const t = makeTable({heroes: ["dash", "briar"], salt: "drop"}).open(); play(t); return {log: t.hub.session().log(), over: t.hub.session().full().over}; })();

test("PLAYER DROP — seat 1's phone loses its channel mid-game; the game waits on it; it reclaims its seat on a snapshot; the game ends as an uninterrupted one", () => {
  const t = makeTable({heroes: ["dash", "briar"], salt: "drop"}).open();
  play(t, 60);
  const [, p1] = t.seatPhones();
  p1.drop(); t.flush();
  assert.equal(p1.sess.status(), "paused");
  assert.match(p1.sess.submit({t: "pass"}), /paused/);
  const ran = play(t, 400);    /* seat 0 plays on until the game needs seat 1 */
  assert.ok(ran < 400, "the game waited on the dropped seat");
  p1.redial(); t.flush();
  assert.equal(p1.seat, 1);
  assert.equal(p1.sess.status(), "ready");
  assert.ok(t.agrees(1) && t.agrees(0));
  play(t);
  assert.deepEqual(t.hub.session().full().over, BASE.over);
  assert.deepEqual(t.hub.session().log(), BASE.log, "the same game, action for action");
});

test("JUDGE DROP — the judge's device restarts from what it persisted; both phones pause, rejoin, and the game ends as an uninterrupted one", () => {
  const t = makeTable({heroes: ["dash", "briar"], salt: "drop"}).open();
  play(t, 90);
  const seq = t.hub.session().seq();
  const saved = t.restartJudge();
  assert.ok(saved.saved && saved.seedH && saved.spec, "the judge kept the game, its half of the seed, and the spec");
  for(const p of t.phones){ assert.equal(p.sess.status(), "paused"); assert.match(p.sess.submit({t: "pass"}), /paused/); }
  assert.equal(t.step(), false, "nobody can move while the judge is gone");
  for(const p of t.phones) p.redial();
  t.flush();
  assert.equal(t.hub.session().seq(), seq, "resumed where it stopped");
  for(const p of t.phones) assert.equal(p.sess.status(), "ready");
  assert.ok(t.agrees(0) && t.agrees(1));
  play(t);
  assert.deepEqual(t.hub.session().full().over, BASE.over);
  assert.deepEqual(t.hub.session().log().slice(seq), BASE.log.slice(seq), "the same game after the restart");
  for(const p of t.phones){
    const rv = p.sess.revealed();
    assert.ok(rv && rv.seedH, "the resumed judge still revealed");
  }
});

test("JUDGE DROP FROM AN OLDER SAVE — the phones saw more than the judge kept: they snap back, forget the lost timeline's fingerprints, and both verify", () => {
  const t = makeTable({heroes: ["dash", "briar"], salt: "drop"}).open();
  play(t, 60);
  const old = json(t.hub.persist()), at = t.hub.session().seq();
  play(t, 25);
  const ps = t.seatPhones();
  /* the drill can fail: before the restart both phones hold fingerprints past the save */
  for(const p of ps) assert.ok(Object.keys(p.sess.hashes()).some(k => +k > at), "seat " + p.seat + " saw past the save");
  for(const p of t.phones){ p.up = false; p.sess.pause("the judge's device left the table"); }
  t.hub = T.Hub.createHub({code: "JDGE", build: T.BUILD, deal: T.dealSpec, reduce: J.reduce, legal: J.legal, check: T.INV.errors, resume: old});
  for(const p of t.phones) p.redial();
  t.flush();
  assert.equal(t.hub.session().seq(), at);
  for(const p of ps){
    assert.equal(p.sess.seq(), at, "seat " + p.seat + " snapped back to the judge's save");
    assert.deepEqual(Object.keys(p.sess.hashes()).filter(k => +k > at), [], "the lost timeline's fingerprints are gone");
  }
  play(t);
  assert.deepEqual(t.hub.session().full().over, BASE.over);
  for(const p of ps){
    const rv = p.sess.revealed();
    const v = R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
      start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: J.reduce, seat: p.seat,
      log: rv.log, hashes: p.sess.hashes(), over: rv.over});
    assert.ok(v.ok, "seat " + p.seat + ": " + v.why);
  }
});

test("SABOTAGE — a judge that resumes without its saved game cannot carry the game on (the drill can fail)", () => {
  const t = makeTable({heroes: ["dash", "briar"], salt: "drop"}).open();
  play(t, 90);
  const seq = t.hub.session().seq();
  const saved = json(t.hub.persist());
  delete saved.saved;
  for(const p of t.phones){ p.up = false; p.sess.pause("x"); }
  t.hub = T.Hub.createHub({code: "JDGE", build: T.BUILD, deal: T.dealSpec, reduce: J.reduce, legal: J.legal, resume: saved});
  for(const p of t.phones) p.redial();
  t.flush();
  assert.notEqual(t.hub.session().seq(), seq, "a judge with nothing saved is back at the opening");
});

/* ---- verify ------------------------------------------------------------ */
const verifyFor = (r, p, rv) => R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
  start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: J.reduce, seat: p.seat,
  log: rv.log, hashes: p.sess.hashes(), over: rv.over});

test("VERIFY THIS GAME, ON BOTH PHONES — the judge's reveal opens its commitment and replays to every view each phone saw", () => {
  for(const r of RUNS.slice(0, 3)) for(const p of r.t.phones){
    const rv = p.sess.revealed();
    assert.ok(rv, "the judge revealed to seat " + p.seat);
    const v = verifyFor(r, p, rv);
    assert.ok(v.ok, r.a + " v " + r.b + " seat " + p.seat + ": " + v.why);
    assert.deepEqual(v.over, r.over);
  }
});

test("SABOTAGE — a lying reveal fails on both phones: another seedH, a doctored log", () => {
  const r = RUNS[0];
  for(const p of r.t.phones){
    const rv = p.sess.revealed();
    assert.equal(verifyFor(r, p, {...rv, seedH: "0".repeat(32)}).ok, false);
    const log = rv.log.slice(); log.splice(5, 1);
    assert.equal(verifyFor(r, p, {...rv, log}).ok, false);
  }
});
