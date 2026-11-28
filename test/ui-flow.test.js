/* ui-flow.test.js — the flow's LOGIC (ui/flow.js pure half), headless, over the session's real seams:

     modeRows       F2 lights each mode exactly when DawnUISession.modes() says this page can run it
     seatingLocal   the coin off the seed: the winner chooses, the AI winner always goes first, the Dummy has no coin
     seatingNet /   a networked table's coin (the throw, the seating call) and where its life is: wait | sit | play | drop | fail
     netStage       — driven over a REAL room (two openNetworked surfaces over a fake PeerJS), the way the page's two phones talk
     rematchKind    local | server | none (a two-phone room offers "New table")
     findOpponent   the hunt at the server table: matched, waiting (asked again every beat), cancelled, failed

   The page itself (the screens, the taps) is tools/ui-flow-drive.js's. Nothing here is a mirror of the engine: every call is the engine's. */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../ui/session.js");
const F = require("../ui/flow.js");
const {loadData} = require("./helpers/extract.js");
const T = require("./helpers/judgetable.js");

const W = loadData(), E = {};
for(const [k, f] of Object.entries({DawnCards: "cards", DawnGame: "game", DawnBuild: "build", DawnJudge: "judge", DawnSparring: "sparring", DawnLocal: "local", DawnView: "view",
  DawnLobby: "lobby", DawnNet: "net", DawnWire: "wire", DawnInvariants: "invariants", DawnServerTable: "servertable", DawnRoom: "room", DawnRNG: "rng", DawnRPS: "rps"})) E[k] = require("../engine/" + f + ".js");
const env = {...W, ...E, DAWN_POOL: require("../data/pool.js")};

test("F2 lights each mode exactly when the session says so, in the mockup's order", () => {
  const ids = m => F.modeRows(m).map(r => r.id + (r.enabled ? "+" : "-")).join(" ");
  assert.equal(ids({local: true, dummy: true, server: true, room: true}), "dummy+ ai+ phones+ online+");
  assert.equal(ids({local: true, dummy: false, server: false, room: true}), "dummy- ai+ phones+ online-");
  assert.equal(ids({}), "dummy- ai- phones- online-");
  assert.equal(ids(undefined), "dummy- ai- phones- online-");
  assert.equal(F.modeRows({dummy: true})[0].lead, true, "the Dummy is the lead card");
  assert.ok(F.modeRows({}).every(r => r.title && r.text && r.tag), "every row has its words");
  const real = S.modes(env);   /* and against this page's real answer */
  assert.deepEqual(F.modeRows(real).map(r => r.enabled), [real.dummy, real.local, real.room, real.server]);
});

test("the coin: the winner chooses; the AI winner always goes first; the Dummy has no coin", () => {
  let p = null, a = null;
  for(let n = 0; n < 60 && !(p && a); n++){ const c = S.coinCall("flow" + n, env); if(c.winner === 0) p = p || "flow" + n; else a = a || "flow" + n; }
  const won = F.seatingLocal(S.coinCall(p, env), "Viserai", false);
  assert.equal(won.ready, false); assert.deepEqual(won.choices.map(c => c.id), ["first", "second"]); assert.equal(won.first, null); assert.equal(won.won, true);
  const first = F.seatingLocal(S.coinCall(p, env, "first"), "Viserai", false, "first"), second = F.seatingLocal(S.coinCall(p, env, "second"), "Viserai", false, "second");
  assert.equal(first.text, "You go first"); assert.equal(first.ready, true); assert.equal(first.first, 0);
  assert.equal(second.text, "Viserai goes first"); assert.equal(second.first, 1);
  const ai = F.seatingLocal(S.coinCall(a, env), "Viserai", false);
  assert.equal(ai.text, "Viserai goes first"); assert.equal(ai.ready, true); assert.equal(ai.choices, null);
  assert.equal(F.seatingLocal(S.coinCall(a, env, "second"), "Viserai", false).first, 1, "the AI's call is a rule, not the person's choice");
  const d = F.seatingLocal(null, "x", true);
  assert.deepEqual([d.coin, d.text, d.first, d.ready], [false, "You go first", 0, true]);
});

const fake = o => ({networked: true, server: false, seat: 0, phase: () => o.phase, state: () => o.state === undefined ? null : o.state, lobby: () => o.lobby || null,
  awaiting: () => o.awaiting || null, coin: () => o.coin || null, ...o.extra});
test("netStage: where a networked table is in its life", () => {
  const lob = (a, b) => ({heroes: [a, b]});
  assert.equal(F.netStage(null, null), "wait"); assert.equal(F.netStage(null, new Error("x")), "fail");
  assert.equal(F.netStage(fake({phase: "connecting"})), "wait");
  assert.equal(F.netStage(fake({phase: "lobby", lobby: lob("a", null)})), "wait", "the friend has not arrived");
  assert.equal(F.netStage(fake({phase: "lobby", lobby: lob("a", "b")})), "sit");
  assert.equal(F.netStage(fake({phase: "playing", state: {over: null}})), "play");
  assert.equal(F.netStage(fake({phase: "ended", state: {over: {}}})), "end");
  assert.equal(F.netStage(fake({phase: "closed", state: {over: null}})), "drop", "mid-game: F9 quiet");
  assert.equal(F.netStage(fake({phase: "fault", state: {over: null}})), "drop");
  assert.equal(F.netStage(fake({phase: "closed", state: {over: {winner: 0}}})), "end", "a finished game is not a drop");
  assert.equal(F.netStage(fake({phase: "fault", state: null})), "fail", "it never came up");
  assert.equal(F.netStage({...fake({phase: "playing", state: {over: null}}), dropped: true}), "drop", "the room channel closed");
  assert.equal(F.netStage({...fake({phase: "ended", state: {over: {}}}), dropped: true}), "end");
  assert.equal(F.netStage(fake({phase: "closed", state: null})), "fail");
});

test("seatingNet: the throw, the seating call, then the coin's answer", () => {
  assert.deepEqual(F.seatingNet(fake({phase: "lobby", awaiting: "throw"}), "Fai").choices.map(c => c.id), ["rock", "paper", "scissors"]);
  const seat = F.seatingNet(fake({phase: "lobby", awaiting: "seat"}), "Fai");
  assert.deepEqual(seat.choices.map(c => c.id), ["first", "second"]); assert.equal(seat.ready, false);
  const thinking = F.seatingNet(fake({phase: "lobby", coin: {winner: null, first: null}}), "Fai");
  assert.equal(thinking.choices, null); assert.equal(thinking.ready, false);
  const mine = F.seatingNet(fake({phase: "playing", coin: {winner: 0, first: 0}}), "Fai");
  assert.deepEqual([mine.text, mine.first, mine.ready], ["You go first", 0, true]);
  const theirs = F.seatingNet(fake({phase: "playing", coin: {winner: 1, first: 1}}), "Fai");
  assert.deepEqual([theirs.text, theirs.first], ["Fai goes first", 1]);
  assert.equal(F.seatingNet(fake({phase: "lobby", coin: {winner: 1, first: 1}}), "Fai").ready, false, "SHUFFLE UP waits until the table has dealt");
});

test("rematchKind: local, server, and a room's honest 'New table'", () => {
  assert.equal(F.rematchKind({networked: false}), "local");
  assert.equal(F.rematchKind({networked: true, server: true}), "server");
  assert.equal(F.rematchKind({networked: true, server: false}), "none");
  assert.equal(F.rematchKind(null), "none");
});

/* ---- the hunt at the server table ---- */
function clock(){
  let id = 0, q = [];
  return {setTimer: (fn, ms) => { q.push({id: ++id, fn, ms}); return id; }, clearTimer: h => { q = q.filter(x => x.id !== h); },
    pending: () => q.length, fire: () => { const x = q.shift(); if(x) x.fn(); return !!x; }, beat: () => q.length ? q[0].ms : null};
}
const flush = () => new Promise(r => setImmediate(r));
function deps(script, c){
  const calls = [], opened = [], disposed = [];
  return {calls, opened, disposed,
    d: {seek: q => { calls.push(q); const r = script.shift(); return r instanceof Error ? Promise.reject(r) : Promise.resolve(r || {state: "cancelled"}); },
      open: t => { opened.push(t); const sf = {t, dispose: () => disposed.push(t)}; return Promise.resolve(sf); }, setTimer: c.setTimer, clearTimer: c.clearTimer}};
}
test("findOpponent: a match sits at once; a wait sits, asks again every beat, and stops when told", async () => {
  let c = clock(), x = deps([{state: "matched", table: "ABCD"}], c), got = [];
  F.findOpponent(x.d, {onSurface: (s, i) => got.push([s.t, i.matched]), onFail: e => got.push(["fail", e.message])});
  await flush(); await flush();
  assert.deepEqual(got, [["ABCD", true]]); assert.equal(c.pending(), 0, "a match does not poll");
  c = clock(); x = deps([{state: "waiting", table: "WXYZ", beat: 5000, typical: 20}, {state: "waiting", table: "WXYZ", beat: 7000}, {state: "taken", table: "WXYZ", beat: 9000}], c); got = [];
  const h = F.findOpponent(x.d, {onSurface: (s, i) => got.push([s.t, i.matched, i.typical]), onFail: e => got.push(["fail"])});
  await flush(); await flush();
  assert.deepEqual(got, [["WXYZ", false, 20]]); assert.equal(c.beat(), 5000);
  c.fire(); await flush(); assert.equal(c.beat(), 7000, "asked again with its own table, then waits the next beat");
  assert.deepEqual(x.calls[1], {table: "WXYZ"});
  c.fire(); await flush(); assert.equal(c.beat(), 9000);
  h.cancel(); await flush();
  assert.equal(c.pending(), 0, "STOP LOOKING clears the timer"); assert.deepEqual(x.calls.at(-1), {cancel: true}, "and cancels the seek");
  assert.deepEqual(x.disposed, ["WXYZ"], "and lets the table go");
  assert.equal(h.table(), "WXYZ");
});
test("findOpponent: a failure to ask, to sit, or to ask again says so once; a cancel before the answer sits nowhere", async () => {
  let c = clock(), x = deps([new Error("unavailable")], c), got = [];
  F.findOpponent(x.d, {onSurface: () => got.push("sat"), onFail: e => got.push("fail " + e.message)});
  await flush(); await flush(); assert.deepEqual(got, ["fail unavailable"]);
  c = clock(); x = deps([{state: "waiting", table: "WXYZ", beat: 2000}, new Error("gone")], c); got = [];
  F.findOpponent(x.d, {onSurface: () => got.push("sat"), onFail: e => got.push("fail " + e.message)});
  await flush(); await flush(); c.fire(); await flush(); await flush();
  assert.deepEqual(got, ["sat", "fail gone"]);
  c = clock(); x = deps([{state: "matched", table: "QQQQ"}], c); got = [];
  const h = F.findOpponent(x.d, {onSurface: () => got.push("sat"), onFail: () => got.push("fail")});
  h.cancel(); await flush(); await flush();
  assert.deepEqual(got, [], "a hunt cancelled before the answer never reports");
  assert.deepEqual(x.opened, [], "and sits at no table");
});

/* ---- two phones, over a fake PeerJS: the flow's stages on REAL surfaces ---- */
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
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(f, n){ for(let i = 0; i < (n || 200); i++){ if(f()) return true; await wait(15); } return false; }

test("two phones: the host's flow goes wait -> sit -> (throw, seating call) -> play, and drops to 'quiet' when the friend leaves", async () => {
  const Peer = fakePeerLib(), code = env.DawnRoom.makeCode(), heroes = ["iyslander", "viserai"].filter(k => W.HEROES.some(h => h.k === k));
  const host = S.openNetworked({how: "room-host", code, hero: heroes[0], build: "flow-drill", Peer, manual: {throw: true, seat: true}, rand: T.seeded("flow|h"),
    onStatus: st => { if(st === "closed" || st === "error") host.dropped = true; }}, env);   /* what the app wires */
  assert.equal(F.netStage(host), "wait", "before it opens");
  const hostUp = host.start();   /* a room's host resolves when the friend connects */
  await wait(60);
  assert.equal(F.netStage(host), "wait", "open, and the friend has not come");
  /* the friend: an automatic guest (a person on the other phone) */
  const guest = S.openNetworked({how: "room-guest", code, hero: heroes[1], build: "flow-drill", Peer, throwPick: () => "scissors", rand: T.seeded("flow|g")}, env);
  await Promise.all([hostUp, guest.start()]);
  assert.ok(await until(() => F.netStage(host) === "sit"), "both heroes known: F4");
  assert.ok(await until(() => host.awaiting() === "throw"));
  assert.deepEqual(F.seatingNet(host, "Viserai").choices.map(c => c.id), ["rock", "paper", "scissors"]);
  assert.equal(host.throwNow("rock"), null);   /* rock beats scissors: the host wins the throw */
  assert.ok(await until(() => host.awaiting() === "seat"));
  const call = F.seatingNet(host, "Viserai"); assert.deepEqual(call.choices.map(c => c.id), ["first", "second"]); assert.equal(call.ready, false);
  assert.equal(host.callSeating("first"), null);
  assert.ok(await until(() => F.netStage(host) === "play"), JSON.stringify(host.events()));
  const done = F.seatingNet(host, "Viserai"); assert.deepEqual([done.text, done.ready], ["You go first", true]);
  assert.equal(F.rematchKind(host), "none", "a room has no rematch: 'New table'");
  guest.dispose();
  assert.ok(await until(() => F.netStage(host) === "drop"), "the friend left mid-game: " + host.phase());
  host.dispose();
});
