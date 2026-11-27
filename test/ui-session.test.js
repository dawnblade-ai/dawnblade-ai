/* DawnUISession's other tables (README step 8): the Dummy on the judge path, a server table and two phones, each behind the SAME
   surface as the local game. Drilled headless: the Dummy against the judge; the server table against server/referee.js in-process
   (test/helpers/servertransport.js — never the live network: this branch's engine differs from the deployed function); two phones
   over a fake PeerJS. Every seat's moves come from the rule policy on THAT SEAT'S VIEW. */
const test = require("node:test");
const assert = require("node:assert");
const S = require("../ui/session.js");
const {loadData} = require("./helpers/extract.js");
const T = require("./helpers/judgetable.js");
const {makeWorld} = require("./helpers/servertransport.js");
const {memKeep, FAST} = require("./helpers/serverphone.js");
const {dealLikeThePage} = require("./helpers/pagedeal.js");

const W = loadData();
const E = {};
for(const [k, f] of Object.entries({DawnCards: "cards", DawnGame: "game", DawnBuild: "build", DawnJudge: "judge", DawnSparring: "sparring", DawnLocal: "local",
  DawnView: "view", DawnLobby: "lobby", DawnNet: "net", DawnWire: "wire", DawnInvariants: "invariants", DawnServerTable: "servertable", DawnRoom: "room", DawnRNG: "rng", DawnRPS: "rps"})) E[k] = require("../engine/" + f + ".js");
const env = {...W, ...E, DAWN_POOL: require("../data/pool.js")};
const BUILD = "ui-session-drill";
const H = ["iyslander", "viserai"].filter(k => W.HEROES.some(h => h.k === k));
const SP = E.DawnSparring, J = E.DawnJudge;

/* ---- the Dummy ---- */
test("modes(): what this page can run", () => {
  const m = S.modes(env);
  assert.deepStrictEqual(Object.keys(m).sort(), ["dummy", "local", "room", "server"]);
  assert.ok(m.local && m.dummy && m.room && m.server);
  assert.deepStrictEqual(S.modes({}), {local: false, dummy: false, server: false, room: false});
  assert.strictEqual(S.modes({...env, SERVER_TABLE: {on: false}}).server, false);
});

test("the Dummy: seat 1 is the vanilla pile on the judge path, the rule policy answers for it, and a game plays out clean", () => {
  const s = S.openLocal({query: {hero: H[0], foe: "dummy", seed: "d1", pace: "0"}}, env);
  assert.ok(s.dummy);
  assert.strictEqual(s.names[1], "The Dummy");
  assert.strictEqual(s.heroKeys[1], null);
  assert.strictEqual(s.pick.search, false, "the dummy is never sharpened");
  const st0 = s.state();
  assert.strictEqual(st0.sides[1].hp, 42);
  assert.ok(st0.sides[1].deck.concat(st0.sides[1].hand).every(c => (c.name || "").length && !/\w/.test(c.text || "")), "every dummy card is vanilla (no rules text)");
  assert.strictEqual(st0.sides[1].gear.length, env.DUMMY_GEAR.length);
  s.start();
  let n = 0;
  while(!s.state().over && n++ < 3000){
    const a = SP.act(s.state(), 0, {search: false});
    if(!a) break;
    assert.strictEqual(s.submit(a), null, "the person's own policy refused: " + JSON.stringify(a));
  }
  const bad = s.events().filter(e => e.t === "policy-refused" || e.t === "stalled");
  assert.deepStrictEqual(bad, []);
  assert.ok(s.state().turn > 3, "the game moved (turn " + s.state().turn + ")");
  assert.deepStrictEqual(E.DawnInvariants.errors(s.state()), []);
  s.dispose();
  /* sabotage seam: a hero foe is NOT the dummy */
  const h = S.openLocal({query: {hero: H[0], foe: H[1], seed: "d1", pace: "0"}}, env);
  assert.ok(!h.dummy); assert.ok(h.heroKeys[1]); h.dispose();
});

/* ---- a server table, in process ---- */
const settle = (world, ss) => world.settle(ss.map(x => x.channel()).filter(Boolean));
async function driveTable(world, A, B, maxActs){
  const ss = [A, B];
  let acts = 0;
  for(let i = 0; i < maxActs; i++){
    let moved = false;
    for(const x of ss){
      const st = x.state(); if(!st || st.over) continue;
      const a = SP.act(st, x.seat, {search: false});
      if(!a) continue;
      const why = x.submit(a);
      assert.strictEqual(why, null, "seat " + x.seat + " refused its own policy's move: " + why + " " + JSON.stringify(a));
      await settle(world, ss); acts++; moved = true; break;
    }
    if(!moved) break;
  }
  return acts;
}
const throwsOf = [["rock", "scissors"], ["paper", "rock"]];

test("a server table: two surfaces seat, negotiate the lobby, play 60 actions, and agree", async () => {
  const world = makeWorld({seedKey: "ui-session", build: BUILD, deal: spec => dealLikeThePage(spec)});
  const mk = (name, hero, how, code, pick) => S.openNetworked({how, code, hero, build: BUILD, transport: world.transport(name), keep: memKeep(), sleep: FAST.sleep, tune: FAST.tune,
    rand: T.seeded("ui-session|" + name), throwPick: () => pick}, env);
  const A = mk("A", H[0], "server-create", undefined, "rock"), B0 = mk("B", H[1], "server-join", undefined, "scissors");
  await A.start();
  const B = mk("B", H[1], "server-join", A.code(), "scissors");
  await B.start();
  await settle(world, [A, B]);
  for(let i = 0; i < 30 && !(A.phase() === "playing" && B.phase() === "playing"); i++) await settle(world, [A, B]);
  assert.strictEqual(A.phase(), "playing", "A: " + A.phase() + " " + JSON.stringify(A.events()));
  assert.strictEqual(B.phase(), "playing", "B: " + B.phase() + " " + JSON.stringify(B.events()));
  assert.deepStrictEqual([A.seat, B.seat].sort(), [0, 1]);
  assert.deepStrictEqual(A.heroKeys, B.heroKeys);
  const seen = []; A.onStep(e => seen.push(e));
  const acts = await driveTable(world, A, B, 60);
  assert.ok(acts >= 30, "played " + acts);
  assert.ok(seen.length > 5, "onStep heard the commits (" + seen.length + ")");
  assert.ok(seen.every(e => e.prev && e.next && e.action), "onStep carries prev/next/action");
  const [a0, b0] = [A.view(), B.view()];
  for(const i of [0, 1]) assert.strictEqual(a0.sides[i].hp, b0.sides[i].hp, "life agrees at seat " + i);
  assert.strictEqual(A.session().seq(), B.session().seq());
  assert.deepStrictEqual(world.errors, []);
  assert.deepStrictEqual(A.events().concat(B.events()).filter(e => e.t === "refused" || e.t === "fault"), []);
  /* a surface asked before the game begins refuses, never throws */
  assert.ok(B0.submit({t: "pass"}));
  assert.strictEqual(B0.state(), null);
  A.dispose(); B.dispose();
  assert.strictEqual(A.phase(), "closed");
});

/* ---- two phones, over a fake PeerJS ---- */
function fakePeerLib(){
  const registry = new Map();
  const mkConn = () => { const h = {}; const c = {open: false, closed: false, other: null, on(ev, fn){ (h[ev] = h[ev] || []).push(fn); return c; }, fire(ev, d){ (h[ev] || []).forEach(fn => fn(d)); },
    send(m){ if(c.open && c.other) setImmediate(() => c.other.fire("data", JSON.parse(JSON.stringify(m)))); },
    close(){ if(c.closed) return; c.closed = true; c.open = false; c.fire("close"); if(c.other && !c.other.closed) c.other.close(); }}; return c; };
  function Peer(id){
    const self = this, h = {}; this.id = id || "rnd-" + Math.random().toString(36).slice(2);
    this.on = (ev, fn) => { (h[ev] = h[ev] || []).push(fn); return self; };
    this.fire = (ev, d) => (h[ev] || []).forEach(fn => fn(d));
    this.destroy = () => { registry.delete(self.id); };
    this.connect = target => {
      const host = registry.get(target), mine = mkConn(), theirs = mkConn(); mine.other = theirs; theirs.other = mine;
      if(!host){ setTimeout(() => self.fire("error", {type: "peer-unavailable"}), 0); return mine; }
      setTimeout(() => { host.fire("connection", theirs); mine.open = theirs.open = true; mine.fire("open"); theirs.fire("open"); }, 0);
      return mine;
    };
    registry.set(this.id, this);
    setTimeout(() => self.fire("open", this.id), 0);
  }
  return Peer;
}
test("two phones: a room host and guest negotiate the lobby, deal, play 60 actions, and agree", async () => {
  const Peer = fakePeerLib();
  const mk = (how, hero, pick) => S.openNetworked({how, code: "ABCD", hero, build: BUILD, Peer, rand: T.seeded("room|" + how), throwPick: () => pick}, env);
  const A = mk("room-host", H[0], "rock"), B = mk("room-guest", H[1], "scissors");
  await Promise.all([A.start(), B.start()]);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for(let i = 0; i < 100 && !(A.phase() === "playing" && B.phase() === "playing"); i++) await wait(20);
  assert.strictEqual(A.phase(), "playing", JSON.stringify(A.events()));
  assert.strictEqual(B.phase(), "playing", JSON.stringify(B.events()));
  assert.strictEqual(A.seat, 0); assert.strictEqual(B.seat, 1);
  /* a phone's view lags its peer's commit by a tick: act only when both have seen the same commits */
  const quiet = async () => { let same = 0; for(let i = 0; i < 400 && same < 3; i++){ await wait(3); same = A.session().seq() === B.session().seq() ? same + 1 : 0; } };
  let acts = 0;
  for(let i = 0; i < 60; i++){
    let moved = false;
    await quiet();
    for(const x of [A, B]){
      const st = x.state(); if(!st || st.over) continue;
      const a = SP.act(st, x.seat, {search: false}); if(!a) continue;
      assert.strictEqual(x.submit(a), null); acts++; moved = true; break;
    }
    if(!moved) await wait(15);
  }
  assert.ok(acts >= 30, "played " + acts);
  for(const i of [0, 1]) assert.strictEqual(A.view().sides[i].hp, B.view().sides[i].hp);
  assert.deepStrictEqual(A.events().concat(B.events()).filter(e => e.t === "refused" || e.t === "fault"), []);
  A.dispose(); B.dispose();
});

/* ---- the coin, rematch, the door ---- */
test("seating(): the coin off the seed, the winner chooses, the AI winner always goes first", () => {
  let p = null, a = null;
  for(let n = 0; n < 40 && !(p && a); n++){ const c = S.coinCall("coin" + n, env); if(c.winner === 0) p = p || "coin" + n; else a = a || "coin" + n; }
  assert.ok(p && a, "both coin sides occur");
  assert.deepStrictEqual(S.coinCall(p, env), {winner: 0, first: null, needsChoice: true});
  assert.strictEqual(S.coinCall(p, env, "first").first, 0);
  assert.strictEqual(S.coinCall(p, env, "second").first, 1);
  assert.deepStrictEqual(S.coinCall(a, env), {winner: 1, first: 1, needsChoice: false});
  assert.deepStrictEqual(S.coinCall(a, env, "second"), {winner: 1, first: 1, needsChoice: false}, "the AI's call is a rule, not the person's choice");
  assert.deepStrictEqual(S.coinCall(p, env), S.coinCall(p, env), "reproducible from the seed");
  /* openLocal takes the call */
  assert.strictEqual(S.openLocal({query: {hero: H[0], foe: H[1], seed: "f1", pace: "0"}, first: 1}, env).state().turnPlayer, 1);
});

for(const foe of ["hero", "dummy"]){
  test("local rematch (" + foe + "): same heroes, a fresh seed, the coin's first turn; the old table is disposed", () => {
    const s = S.openLocal({query: {hero: H[0], foe: foe === "dummy" ? "dummy" : H[1], seed: "r1", pace: "0"}}, env);
    const r = s.rematch({seed: "r2", choice: "second"});
    assert.strictEqual(r.pick.seed, "r2"); assert.notStrictEqual(r.pick.seed, s.pick.seed);
    assert.strictEqual(r.pick.hero, s.pick.hero); assert.strictEqual(r.pick.foe, s.pick.foe);
    assert.strictEqual(r.dummy, foe === "dummy");
    const want = S.coinCall("r2", env, "second");
    assert.deepStrictEqual(r.seating, want);
    assert.strictEqual(r.state().turnPlayer, want.first);
    assert.notDeepStrictEqual(r.state().sides[0].hand.map(c => c.uid + c.name), s.state().sides[0].hand.map(c => c.uid + c.name), "a fresh deal");
    r.start();
    assert.strictEqual(r.rematch({seed: "r3", first: 1}).state().turnPlayer, 1, "an explicit first beats the coin");
    r.dispose();
  });
}

test("modes(): the ?server= door, read the way index.html does", () => {
  const mem = new Map(); const ls = {getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, v)};
  const at = (search, on) => S.modes({...env, SERVER_TABLE: {on}, localStorage: ls, location: {search}}).server;
  assert.strictEqual(at("", false), false);
  assert.strictEqual(at("", true), true);
  assert.strictEqual(at("?server=1", false), true, "the tester's door opens it");
  assert.strictEqual(at("", false), true, "and is remembered");
  assert.strictEqual(at("?server=0", true), false, "?server=0 closes it and forgets");
  assert.strictEqual(at("", true), false);
  assert.strictEqual(S.modes({...env, SERVER_TABLE: {on: true}, localStorage: {getItem(){ throw new Error("blocked"); }, setItem(){ throw new Error("blocked"); }}, location: {search: ""}}).server, true, "blocked storage never throws");
});

/* ---- the lobby's coin, driven by the flow; and a server rematch ---- */
async function seatServer(world, mk, A, B){
  await A.start(); await B.start();
  await settle(world, [A, B]);
}
test("a server table: the throw and the seating call wait for the person (manual), then the game plays; the coin reads out", async () => {
  const world = makeWorld({seedKey: "ui-manual", build: BUILD, deal: spec => dealLikeThePage(spec)});
  const mk = (name, hero, how, code, pick, extra) => S.openNetworked({how, code, hero, build: BUILD, transport: world.transport(name), keep: memKeep(), sleep: FAST.sleep, tune: FAST.tune,
    rand: T.seeded("ui-manual|" + name), throwPick: () => pick, ...(extra || {})}, env);
  const A = mk("A", H[0], "server-create", undefined, "rock", {manual: {throw: true, seat: true}});
  await A.start();
  const B = mk("B", H[1], "server-join", A.code(), "scissors");
  await B.start();
  const seenAwait = []; A.onAwait(x => seenAwait.push(x));
  for(let i = 0; i < 20 && A.awaiting() !== "throw"; i++) await settle(world, [A, B]);
  assert.strictEqual(A.awaiting(), "throw", "paused at its own throw: " + A.phase());
  assert.strictEqual(B.phase(), "lobby", "the other seat waits on it");
  assert.ok(A.throwNow("lizard"), "a bad throw is refused");
  assert.strictEqual(A.throwNow("rock"), null);
  assert.ok(A.throwNow("rock"), "a second throw is refused");
  for(let i = 0; i < 20 && A.awaiting() !== "seat"; i++) await settle(world, [A, B]);
  assert.strictEqual(A.awaiting(), "seat", "rock beats scissors: A calls the seating");
  assert.strictEqual(A.coin().winner, A.seat);
  assert.strictEqual(A.coin().first, null);
  assert.ok(A.callSeating("sideways"));
  assert.strictEqual(A.callSeating("second"), null);
  for(let i = 0; i < 20 && !(A.phase() === "playing" && B.phase() === "playing"); i++) await settle(world, [A, B]);
  assert.strictEqual(A.phase(), "playing", JSON.stringify(A.events()));
  assert.strictEqual(A.coin().first, B.seat, "second means the other seat goes first");
  assert.strictEqual(A.state().turnPlayer, B.seat);
  assert.deepStrictEqual(seenAwait.filter(Boolean), ["throw", "seat"]);
  assert.strictEqual(A.awaiting(), null);
  A.dispose(); B.dispose();
});

test("a server table: a rematch needs both to ask, then again() sits both at the new table", async () => {
  const world = makeWorld({seedKey: "ui-rematch", build: BUILD, deal: spec => dealLikeThePage(spec)});
  const mk = (name, hero, how, code, pick) => S.openNetworked({how, code, hero, build: BUILD, transport: world.transport(name), keep: memKeep(), sleep: FAST.sleep, tune: FAST.tune,
    rand: T.seeded("ui-rematch|" + name), throwPick: () => pick}, env);
  const A = mk("A", H[0], "server-create", undefined, "rock"); await A.start();
  const B = mk("B", H[1], "server-join", A.code(), "scissors"); await B.start();
  for(let i = 0; i < 20 && !(A.phase() === "playing" && B.phase() === "playing"); i++) await settle(world, [A, B]);
  assert.strictEqual(A.phase(), "playing");
  await assert.rejects(A.askRematch(), e => e.why === "rematch-playing", "not while the game is on");
  await assert.rejects(A.again(), e => e.why === "no-rematch");
  const heard = []; B.onRematch(r => heard.push(r));
  assert.strictEqual(B.submit({t: "concede"}), null);
  await settle(world, [A, B]);
  assert.strictEqual(A.phase(), "ended");
  assert.strictEqual((await A.askRematch()).state, "waiting");
  await settle(world, [A, B]);
  assert.ok(B.rematch().theirs && heard.length, "the other seat hears the ask");
  const old = A.code();
  assert.strictEqual((await B.askRematch()).state, "ready");
  await settle(world, [A, B]);
  const [A2, B2] = await Promise.all([A.again(), B.again()]);
  assert.notStrictEqual(A2.code(), old);
  assert.strictEqual(A2.code(), B2.code());
  assert.strictEqual(A.phase(), "closed");
  for(let i = 0; i < 30 && !(A2.phase() === "playing" && B2.phase() === "playing"); i++) await settle(world, [A2, B2]);
  assert.strictEqual(A2.phase(), "playing", JSON.stringify(A2.events()));
  assert.strictEqual(B2.phase(), "playing");
  A2.dispose(); B2.dispose();
});

test("two phones: a room has no rematch protocol, and says so", async () => {
  const Peer = fakePeerLib();
  const mk = (how, hero, pick) => S.openNetworked({how, code: "WXYZ", hero, build: BUILD, Peer, rand: T.seeded("rm|" + how), throwPick: () => pick}, env);
  const A = mk("room-host", H[0], "rock"), B = mk("room-guest", H[1], "scissors");
  await Promise.all([A.start(), B.start()]);
  assert.strictEqual(A.rematch(), null);
  await assert.rejects(A.askRematch(), e => e.why === "no-rematch");
  await assert.rejects(A.again(), e => e.why === "no-rematch");
  A.dispose(); B.dispose();
});
