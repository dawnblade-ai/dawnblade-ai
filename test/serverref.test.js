/* test/serverref.test.js — THE HOSTED REFEREE AS A STATELESS FUNCTION (SERVER S1).

   server/referee.js is the judge's table (engine/hub.js) with no memory: each
   request loads the stored row, rehydrates a hub from it, applies ONE frame,
   saves with an optimistic version check and pushes each seat its own frames.
   An Edge Function lives for one request, so this is the only shape that can
   run there. Nothing here needs an account: the store and the broadcast
   channels are the fakes in test/helpers/serverfakes.js.

     (a) two phones play whole games through `handle` ALONE, the hub rebuilt
         from the stored row before EVERY frame (lobby included), and the
         game is the one the in-process referee plays from the same deal —
         fingerprint for fingerprint — and the same one inside a Workers/Deno
         shaped isolate that has no window, document, require or process;
     (b) BLINDNESS: judgedGame's scans (every frame each phone received, for
         the uids hidden from it and the seed) plus every response and every
         broadcast payload, as text, for the seed, the match seed and the keys;
     (c) a frame with a wrong or missing seat key is refused and changes
         NOTHING (row, version, broadcasts);
     (d) the version race: two requests on the same version — exactly one wins;
     (e) a stale or replayed frame is refused.
   Each of (b)–(e) is run again against a deliberately broken copy of the
   server (or fake) and must FAIL there: a drill that cannot fail guards
   nothing. Deno runs this file unchanged (tools/serverrun.js). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
const {makeIsolate} = require("./helpers/isolate.js");
const SHA = require("../engine/sha256.js");
const Hub = require("../engine/hub.js");
const {R, J, SP, Wr, N, INV, json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");

/* a copy of server/referee.js with named edits — the sabotage seam. Each
   anchor must occur exactly once, or the sabotage did not apply. */
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}

/* ---- the games ----------------------------------------------------------- */
const verifyAll = r => r.t.phones.map(p => { const rv = p.sess.revealed();
  return rv ? R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
    start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: J.reduce, seat: p.seat,
    log: rv.log, hashes: p.sess.hashes(), over: rv.over}) : {ok: false, why: "no reveal"}; });

/* every hub the server builds is counted: the server's own carry an onEvent
   (the inspectors the drills use to look at the row do not) */
const built = {server: 0, resumed: 0};
const realCreate = Hub.createHub;
Hub.createHub = o => { if(o && o.onEvent){ built.server++; if(o.resume) built.resumed++; } return realCreate(o); };

function playServer(k0, k1, salt, cfg){
  const mk = makeServerHub({seedKey: salt, ...(cfg || {})});
  let hub; const b0 = {...built};
  const r = T.judgedGame(k0, k1, salt, {makeHub: o => (hub = mk(o)), stopAtLeak: !!(cfg && cfg.stopAtLeak)});
  return {r, hub, audit: hub.audit, hubs: built.server - b0.server, resumed: built.resumed - b0.resumed};
}

/* the SAME game through the existing in-process referee: the deal the
   server's row recorded, the same policy, no network, no storage */
function reference(g){
  const row = g.audit.store.row(g.audit.code).hub, spec = row.spec;
  const d = T.dealSpec({...spec, seed: SHA.seedOf(row.seedH, spec.seedG)});
  const ref = R.createReferee({state: d.state, reduce: J.reduce, legal: J.legal, check: INV.errors, catalog: d.catalog});
  let n = 0;
  while(!ref.over() && n++ < 3000){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(ref.view(s), s, {search: false});
      if(!a) continue;
      const r = ref.intent(s, a);
      if(r.error) throw new Error("the reference refused " + s + ": " + r.error);
      moved = true; break;
    }
    if(!moved) break;
  }
  return ref;
}

const PAIRS = [["kayo", "dash"], ["briar", "lyath"], ["arakni", "viserai"]];
const GAMES = PAIRS.map(([a, b], i) => ({a, b, g: playServer(a, b, "srv-" + i)}));

test("(a) WHOLE GAMES THROUGH handle ALONE — the hub rebuilt from the stored row before every frame, the game the in-process referee plays", () => {
  for(const {a, b, g} of GAMES){
    const label = a + " v " + b, r = g.r, au = g.audit;
    assert.ok(r.over, label + ": finished");
    assert.deepEqual(r.mism, [0, 0], label + ": each phone's fingerprint is the referee's view of its seat");
    assert.deepEqual(r.deep, [0, 0], label + ": whole views");
    assert.ok(r.big <= 16 * 1024, label + ": a message of " + r.big + " bytes");
    for(const v of verifyAll(r)) assert.ok(v.ok, label + ": verify — " + v.why);
    assert.deepEqual(au.errors, [], label + ": no internal error");
    assert.equal(au.refused.length, 0, label + ": nothing was refused in a clean game: " + au.refused);
    /* STATELESS: a hub was built for every request, and every one after the
       table's creation was rehydrated from the row (the lobby too) */
    assert.equal(g.hubs, au.calls, label + ": one hub per request");
    assert.equal(g.resumed, au.calls - 1, label + ": every request but the create resumed from the stored row");
    assert.ok(au.store.puts >= r.steps, label + ": every action was saved: " + au.store.puts + " puts for " + r.steps + " actions");
    /* the stored game is the one an uninterrupted referee plays */
    const ref = reference(g), full = g.hub.session().full();
    assert.ok(ref.over(), label + ": the reference finished");
    assert.equal(Wr.hash(full), Wr.hash(ref.state()), label + ": final fingerprint, server vs in-process referee");
    assert.deepEqual(json(r.log), json(ref.log()), label + ": the same actions in the same order");
    assert.deepEqual(json(r.over), json(ref.state().over), label + ": the same result");
    assert.ok(au.store.largest() <= 200 * 1024, label + ": the stored row stayed under 200 KB: " + au.store.largest());
  }
  assert.notDeepEqual(json(GAMES[0].g.r.log), json(GAMES[1].g.r.log), "different heroes, different games");
});

test("(a) THE ASYNC BODY — the recorded requests replayed through handle() over a store and a bus that answer through promises: the same responses, the same row", async () => {
  const {g} = GAMES[0], au = g.audit;
  const store = F.memStore(), bus = F.memBus();
  const d0 = au.makeDeps(store, bus);
  const deps = {...d0, store: F.lagged(store), broadcast: F.laggedBus(bus).broadcast};
  for(let i = 0; i < au.reqs.length; i++){
    const res = json(await SERVER.handle(au.reqs[i], deps));
    assert.deepEqual(res, au.resps[i], "request " + i + " (" + au.reqs[i].op + ")");
  }
  assert.equal(store.json(au.code), au.store.json(au.code), "the stored row, byte for byte");
  assert.deepEqual(bus.log, au.bus.log, "every broadcast, in order");
});

test("(a) THE RUNTIME MOVES, THE REFEREE DOES NOT — the same server inside a no-DOM, no-node isolate stores the very same row", () => {
  const iso = makeIsolate();
  for(const k of ["window", "document", "require", "module", "process", "Buffer", "global"]) assert.equal(iso.runtime[k], "undefined", k + " is absent in the isolate");
  assert.ok(iso.serverScripts.includes("server/referee.js") && typeof iso.server.handle === "function");
  const [a, b] = PAIRS[0];
  const here = playServer(a, b, "iso-0"), there = playServer(a, b, "iso-0", {server: iso.server, deal: iso.deal});
  assert.ok(there.r.over, "finished in the isolate");
  assert.equal(there.audit.store.json(there.audit.code), here.audit.store.json(here.audit.code), "the stored row, byte for byte, in the isolate and in node");
  assert.deepEqual(json(there.r.log), json(here.r.log));
  assert.deepEqual(there.audit.errors, []);
  assert.deepEqual(there.audit.leaks, []);
});

/* ---- (b) blindness ------------------------------------------------------- */
test("(b) BLINDNESS — no hidden uid, no seed and no key in anything either phone was sent, nor in any response or broadcast", () => {
  for(const {a, b, g} of GAMES){
    const label = a + " v " + b;
    assert.deepEqual([g.r.leaks[0].length, g.r.leaks[1].length], [0, 0], label + ": hidden uids received " + g.r.leaks[0].concat(g.r.leaks[1]).slice(0, 2));
    assert.equal(g.r.seedLeak, 0, label + ": the seed's secret half or the match seed");
    assert.equal(g.r.earlyReveal, 0, label + ": a reveal before the game was over");
    assert.equal(g.r.judgeLeak, 0, label + ": the judge's own screen");
    assert.deepEqual(g.audit.leaks, [], label + ": a response or broadcast carried a secret");
    assert.equal(g.audit.mismatch, 0, label + ": a caller's frames rode its own topic too");
    /* every payload went to one seat's private topic, and carried only {ver, frames} */
    for(const e of g.audit.bus.log){
      assert.match(e.topic, /^table:[A-Za-z0-9_-]+:seat[01]$/, label);
      assert.deepEqual(Object.keys(e.payload).sort(), ["frames", "ver"], label);
    }
    assert.ok(g.audit.bus.log.some(e => e.topic.endsWith("seat0")) && g.audit.bus.log.some(e => e.topic.endsWith("seat1")), label + ": both seats were pushed to");
    /* the stored row is the one place the secrets live */
    const row = g.audit.store.row(g.audit.code);
    assert.ok(row.hub.seedH && row.hub.keys[0] && row.hub.keys[1], label + ": the row holds the seed and both keys");
  }
});

test("(b) SABOTAGE — a bus that forwards one seat's payload to the other seat's topic leaks hidden uids and is caught; a payload carrying a key or the seed is caught by the audit", () => {
  const cross = playServer("kayo", "dash", "sab-b1", {stopAtLeak: true, tamper: {broadcast: (t, p, bus) => {
    bus.broadcast(t, p);
    if(p.frames.some(f => f.m && f.m.t === "commit")) bus.broadcast(t.endsWith("seat0") ? t.replace("seat0", "seat1") : t.replace("seat1", "seat0"), p);
  }}});
  assert.ok(cross.r.leaks[0].length + cross.r.leaks[1].length > 0, "the cross-seat forward must leak a hidden uid and be seen");
  const withKey = playServer("kayo", "dash", "sab-b2", {tamper: {broadcast: (t, p, bus, ctx) => {
    const h = (ctx.store.row(ctx.code) || {}).hub;
    bus.broadcast(t, h && h.keys[0] && p.frames.length ? {...p, frames: p.frames.concat([{ch: "judge", note: h.keys[0]}])} : p);
  }}});
  assert.ok(withKey.audit.leaks.some(l => /key/.test(l)), "a key in a broadcast must be caught: " + withKey.audit.leaks.slice(0, 2));
  const withSeed = playServer("kayo", "dash", "sab-b3", {tamper: {broadcast: (t, p, bus, ctx) => {
    const h = (ctx.store.row(ctx.code) || {}).hub;
    bus.broadcast(t, h && h.seedH && p.frames.length ? {...p, frames: p.frames.concat([{ch: "judge", note: h.seedH}])} : p);
  }}});
  assert.ok(withSeed.audit.leaks.some(l => /seed/.test(l)), "the seed in a broadcast must be caught: " + withSeed.audit.leaks.slice(0, 2));
  const control = playServer("kayo", "dash", "sab-b4", {tamper: {broadcast: (t, p, bus) => bus.broadcast(t, p)}});
  assert.deepEqual(control.audit.leaks, [], "a pass-through bus is clean (control)");
});

/* ---- a dealt table to attack (c, d, e) ------------------------------------ */
function opened(server){
  const mk = makeServerHub({server, seedKey: "attack"});
  let hub;
  const t = T.makeTable({heroes: ["kayo", "dash"], salt: "attack", throws: [["rock", "rock"], ["paper", "rock"]], makeHub: o => (hub = mk(o))}).open();
  const a = hub.audit, id = a.code, full = hub.session().full();
  /* a seat that can act, and a legal action for it (from its own view) */
  let seat = null, action = null;
  for(const s of [0, 1]){ const x = SP.act(R.seatView(full, s), s, {search: false}); if(x){ seat = s; action = x; break; } }
  assert.ok(seat != null, "someone can act");
  const row = () => a.store.row(id);
  const intent = (s, act, n, key) => ({op: "frame", table: id, seat: s, key: key !== undefined ? key : row().hub.keys[s], n,
    frame: {ch: "net", m: {t: "intent", id: 99, seat: s, action: act}}});
  return {t, hub, a, id, seat, action, row, intent, server: server || SERVER};
}
const snapshotOf = o => ({json: o.a.store.json(o.id), version: o.a.store.version(o.id), bus: o.a.bus.log.length});

/* (c) returns the list of things that went wrong; empty is a pass */
function authFailures(server){
  const o = opened(server), bad = [];
  const keys = o.row().hub.keys, s = o.seat, n = o.row().nonces[s] + 100;
  const tries = {
    "the other seat's key": o.intent(s, o.action, n, keys[1 - s]),
    "no key": o.intent(s, o.action, n, undefined && 0),
    "a made-up key": o.intent(s, o.action, n, "0".repeat(32)),
    "a key of the wrong type": o.intent(s, o.action, n, 12345),
    "a seat that does not exist": {...o.intent(s, o.action, n), seat: 2},
    "a claim with the other seat's key": {op: "join", table: o.id, seat: s, key: keys[1 - s]},
    "a resync with the other seat's key": {op: "resync", table: o.id, seat: s, key: keys[1 - s]}
  };
  delete tries["no key"].key;
  for(const [what, req] of Object.entries(tries)){
    const before = snapshotOf(o);
    const res = json(server.handleNow(req, o.a.deps));
    if(res.ok !== false || res.refused !== "auth") bad.push(what + ": answered " + JSON.stringify(res).slice(0, 80));
    if(res.frames) bad.push(what + ": the refusal carried frames");
    for(const k of keys) if(JSON.stringify(res).indexOf(k) >= 0) bad.push(what + ": the refusal carried a key");
    const after = snapshotOf(o);
    if(after.json !== before.json || after.version !== before.version || after.bus !== before.bus) bad.push(what + ": the table changed");
  }
  /* no such table: nothing to find, nothing created */
  const miss = json(server.handleNow({...o.intent(s, o.action, n), table: "NOPE"}, o.a.deps));
  if(miss.ok !== false || miss.refused !== "no-table" || o.a.store.rows.has("NOPE")) bad.push("an unknown table was not refused as such");
  /* a seated phone cannot speak for the other seat: right key, wrong seat in the frame */
  const before = snapshotOf(o);
  const forged = json(server.handleNow(o.intent(s, o.action, n + 1), o.a.deps));   /* control: the real one applies */
  if(!forged.ok || o.a.store.version(o.id) === before.version) bad.push("control: the genuine frame was not applied");
  const v1 = snapshotOf(o);
  const lie = o.intent(s, o.action, n + 2); lie.frame.m.seat = 1 - s;
  const r2 = json(server.handleNow(lie, o.a.deps));
  if(snapshotOf(o).json !== v1.json || !(r2.frames || []).some(f => f.m && f.m.t === "nack")) bad.push("an intent claiming the other seat was not nacked and left alone");
  const lob = {op: "frame", table: o.id, seat: s, key: keys[s], n: n + 3, frame: {ch: "lobby", m: {t: "hero", seat: 1 - s, hero: "dash"}}};
  server.handleNow(lob, o.a.deps);
  if(snapshotOf(o).json !== v1.json) bad.push("a lobby frame for the other seat changed the table");
  return bad;
}
test("(c) A WRONG OR MISSING SEAT KEY IS REFUSED AND CHANGES NOTHING — frames, claims, resyncs, unknown tables, forged seats", () => {
  assert.deepEqual(authFailures(SERVER), []);
});
test("(c) SABOTAGE — a server whose key check always passes fails the drill", () => {
  const sab = loadServer([["const keyEq = (a, b) => {", "const keyEq = (a, b) => { return true;"]]);
  const bad = authFailures(sab);
  assert.ok(bad.length >= 3, "the drill must see the broken check: " + bad.slice(0, 3));
});

/* (d) the version race */
async function raceFailures(server, wrapStore){
  const o = opened(server), bad = [];
  const store = wrapStore ? wrapStore(o.a.store) : o.a.store;
  const deps = {...o.a.makeDeps(F.lagged(store), F.laggedBus(o.a.bus)), store: F.lagged(store), broadcast: F.laggedBus(o.a.bus).broadcast};
  const s = o.seat, v0 = o.a.store.version(o.id), seq0 = o.hub.session().seq(), log0 = o.a.bus.log.length;
  const req = o.intent(s, o.action, o.row().nonces[s] + 1);
  const [x, y] = await Promise.all([server.handle(json(req), deps), server.handle(json(req), deps)]);
  const won = [x, y].filter(r => r.ok && r.frames.some(f => f.m && f.m.t === "commit")), lost = [x, y].filter(r => r.refused === "conflict");
  if(won.length !== 1) bad.push(won.length + " of two simultaneous actions applied");
  if(lost.length !== 1 || !lost[0].retry) bad.push("the loser was not told to retry");
  if(o.a.store.version(o.id) !== v0 + 1) bad.push("the row moved " + (o.a.store.version(o.id) - v0) + " versions");
  if(o.hub.session().seq() !== seq0 + 1) bad.push("the game moved " + (o.hub.session().seq() - seq0) + " actions");
  if(o.a.bus.log.length !== log0 + 1) bad.push("the loser pushed to a seat: " + (o.a.bus.log.length - log0) + " payloads");
  /* two phones dialling the same new table at once: one chair each, never the same one twice */
  server.handleNow({op: "create", table: "RACE2"}, o.a.deps);
  const [p, q] = await Promise.all([server.handle({op: "join", table: "RACE2"}, deps), server.handle({op: "join", table: "RACE2"}, deps)]);
  const seated = [p, q].filter(r => r.ok);
  if(seated.length !== 1 || [p, q].filter(r => r.refused === "conflict").length !== 1) bad.push("two simultaneous joins: " + seated.length + " seated");
  const again = await server.handle({op: "join", table: "RACE2"}, deps);
  if(!again.ok || seated.length !== 1 || again.seat === seated[0].seat) bad.push("the loser's retry did not get the other chair");
  return bad;
}
test("(d) THE VERSION RACE — two simultaneous requests on one version: exactly one applies, the loser is told to retry and pushes nothing", async () => {
  assert.deepEqual(await raceFailures(SERVER), []);
});
test("(d) SABOTAGE — a store that ignores the expected version fails the drill", async () => {
  const unversioned = s => ({get: id => s.get(id), put: (id, row) => s.put(id, row, s.version(id))});
  const bad = await raceFailures(SERVER, unversioned);
  assert.ok(bad.length >= 2, "the drill must see two winners: " + bad);
});

/* (e) stale and replayed frames */
function staleFailures(server){
  const o = opened(server), bad = [], s = o.seat;
  const n = o.row().nonces[s] + 1, req = o.intent(s, o.action, n);
  const first = json(server.handleNow(req, o.a.deps));
  if(!first.ok || !first.frames.some(f => f.m && f.m.t === "commit")) { bad.push("control: the genuine frame was not applied"); return bad; }
  const v1 = snapshotOf(o);
  const check = (what, rq) => {
    const res = json(server.handleNow(rq, o.a.deps));
    if(res.ok !== false || res.refused !== "stale") bad.push(what + ": answered " + JSON.stringify(res).slice(0, 80));
    const after = snapshotOf(o);
    if(after.json !== v1.json || after.version !== v1.version || after.bus !== v1.bus) bad.push(what + ": the table changed");
  };
  check("the same frame replayed", json(req));
  check("an older counter", {...json(req), n: n - 1});
  check("a counter that is not a number", {...json(req), n: "9"});
  check("a counter that is not whole", {...json(req), n: n + 0.5});
  check("no counter", (() => { const r = json(req); delete r.n; return r; })());
  /* the counter is per seat, and the claim hands a returning phone where to resume */
  const key = o.row().hub.keys[s], claim = json(server.handleNow({op: "join", table: o.id, seat: s, key}, o.a.deps));
  if(!claim.ok || claim.n !== n) bad.push("a claim did not report where the counter resumes: " + claim.n + " vs " + n);
  return bad;
}
test("(e) A STALE OR REPLAYED FRAME IS REFUSED — the same frame again, an older counter, a counter that is not one; the claim says where to resume", () => {
  assert.deepEqual(staleFailures(SERVER), []);
});
test("(e) SABOTAGE — a server with no counter check fails the drill", () => {
  const sab = loadServer([["!Number.isInteger(req.n) || req.n <= row.nonces[seat]", "false"]]);
  const bad = staleFailures(sab);
  assert.ok(bad.length >= 2, "the drill must see replays accepted: " + bad.slice(0, 3));
});

/* ---- the rest of the contract ---------------------------------------------- */
test("a returning phone's claim restores its seat from the row alone, and a third phone on a full table gets nothing", () => {
  const o = opened(SERVER), keys = o.row().hub.keys;
  const full = json(SERVER.handleNow({op: "join", table: o.id}, o.a.deps));
  assert.deepEqual([full.ok, full.refused], [false, "full"]);
  const back = json(SERVER.handleNow({op: "join", table: o.id, seat: 1, key: keys[1]}, o.a.deps));
  assert.ok(back.ok && back.seat === 1);
  assert.ok(back.frames.some(f => f.ch === "judge" && f.seat === 1), "the seat is handed back");
  assert.ok(!back.frames.some(f => f.ch === "judge" && f.key), "a claim is not dealt a key again");
  /* a resync returns this seat's own snapshot, and writes nothing */
  const v = o.a.store.version(o.id), log = o.a.bus.log.length;
  const rs = json(SERVER.handleNow({op: "resync", table: o.id, seat: 0, key: keys[0]}, o.a.deps));
  assert.ok(rs.ok && rs.frames.some(f => f.m && (f.m.t === "snapshot" || f.m.t === "part")), "a snapshot came back");
  assert.equal(o.a.store.version(o.id), v); assert.equal(o.a.bus.log.length, log);
  /* and a table over: a phone that comes back after the game still gets the reveal */
  const g = GAMES[0].g, id = g.audit.code, ks = g.audit.store.row(id).hub.keys;
  const late = json(SERVER.handleNow({op: "resync", table: id, seat: 0, key: ks[0]}, g.audit.deps));
  assert.ok(late.ok);
  const text = late.frames.filter(f => f.m && f.m.t === "part").map(f => f.m.s).join("");
  assert.ok(text.indexOf('"t":"reveal"') >= 0 || late.frames.some(f => f.m && f.m.t === "reveal"), "a rehydrated, finished game still reveals itself to a returning phone");
});

test("bad requests are refused and an internal failure is answered bare (no message that could carry a card)", async () => {
  const deps = {store: F.memStore(), broadcast() {}, deal: T.dealSpec, build: T.BUILD, now: () => 1, log: () => {}};
  for(const bad of [null, 7, {}, {op: "nope"}, {op: "join"}, {op: "join", table: "a b"}, {op: "frame", table: "x".repeat(40)}])
    assert.equal((await SERVER.handle(bad, deps)).refused, "bad-request", JSON.stringify(bad));
  assert.equal((await SERVER.handle({op: "join", table: "NOPE"}, deps)).refused, "no-table");
  assert.equal((await SERVER.handle({op: "create", table: "T1"}, deps)).ok, true);
  assert.deepEqual(json(await SERVER.handle({op: "create", table: "T1"}, deps)), {ok: false, refused: "exists"});
  const gen = await SERVER.handle({op: "create"}, deps);
  assert.ok(gen.ok && /^[A-HJ-NP-Z2-9]{6}$/.test(gen.table), "a generated table code");
  const boom = {...deps, store: {get(){ throw new Error("hidden card 123456"); }, put(){ }}};
  const logged = [];
  const res = await SERVER.handle({op: "join", table: "T1"}, {...boom, log: e => logged.push(e)});
  assert.deepEqual(json(res), {ok: false, refused: "internal"});
  assert.equal(logged.length, 1);
  assert.throws(() => SERVER.handleNow({op: "join", table: "T1"}, {...deps, store: F.lagged(deps.store)}), /synchronous/);
});

test("a table that has not dealt rehydrates from its lobby; a net frame before the deal is refused, not queued and lost", () => {
  const deps = {store: F.memStore(), broadcast() {}, deal: T.dealSpec, build: T.BUILD, now: () => 1, rand: () => T.seeded("pre")};
  SERVER.handleNow({op: "create", table: "PRE"}, deps);
  const j = json(SERVER.handleNow({op: "join", table: "PRE"}, deps));
  const key = j.frames.find(f => f.ch === "judge").key;
  assert.equal(deps.store.row("PRE").hub.spec, null);
  assert.ok(deps.store.row("PRE").hub.lobLog.length >= 2, "the judge's hello and its seed commitment are in the row");
  const early = json(SERVER.handleNow({op: "frame", table: "PRE", seat: j.seat, key, n: 1, frame: {ch: "net", m: {t: "hello"}}}, deps));
  assert.equal(early.refused, "not-dealt");
  /* the page's own persist is untouched: null until the deal */
  const h = Hub.createHub({code: "X", build: T.BUILD, deal: T.dealSpec, reduce: J.reduce, legal: J.legal});
  assert.equal(h.persist(), null);
  assert.equal(h.persistTable().spec, null);
});

test("a referee rebuilt from storage commits exactly what a continuous one does — a delta, not the whole view (engine/referee.js)", () => {
  const play = rebuild => {
    const d = T.dealSpec({heroes: ["kayo", "dash"], seed: "rebuild-1", first: 0});
    let ref = R.createReferee({state: d.state, reduce: J.reduce, legal: J.legal, catalog: d.catalog});
    ref.snapshot(0); ref.snapshot(1);
    const commits = [];
    for(let i = 0; i < 60 && !ref.over(); i++){
      let acted = false;
      for(const s of [0, 1]){
        const a = SP.act(ref.view(s), s, {search: false});
        if(!a) continue;
        const r = ref.intent(s, a);
        assert.ok(!r.error);
        commits.push(json(r.commits));
        acted = true; break;
      }
      if(!acted) break;
      if(rebuild){
        const saved = json(N.encodeSaved(ref.persist(), d.catalog));
        ref = R.createReferee({state: null, reduce: J.reduce, legal: J.legal, catalog: d.catalog});
        ref.restore(N.decodeSaved(saved, d.catalog));
      }
    }
    return commits;
  };
  const whole = play(false), rebuilt = play(true);
  assert.ok(whole.length >= 40, "a real stretch of play: " + whole.length);
  assert.deepEqual(rebuilt, whole, "every commit, seat for seat");
  assert.ok(rebuilt.every(c => c[0].view === undefined && c[1].view === undefined), "no commit carried a whole view");
});

test("LEDGER — server/referee.js is headless (not a page script) and re-declares no engine export", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!html.includes("server/"), "index.html must not load the server");
  const names = new Set();
  for(const f of fs.readdirSync(path.join(ROOT, "engine")).filter(x => x.endsWith(".js"))){
    let m; try { m = require(path.join(ROOT, "engine", f)); } catch(_){ continue; }
    for(const k of Object.keys(m || {})) names.add(k);
  }
  assert.ok(names.size > 100, "the census found the engine's exports: " + names.size);
  const decl = [...SRC.matchAll(/(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  assert.deepEqual(decl.filter(n => names.has(n)), [], "the server re-declares an engine export");
  assert.ok(decl.includes("handle") && decl.includes("rig"), "the census read the source");
});
