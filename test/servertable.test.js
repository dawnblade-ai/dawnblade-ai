/* test/servertable.test.js — A TABLE ON THE HOSTED REFEREE, FROM THE PHONE'S SIDE (SERVER S2).

   engine/servertable.js turns server/referee.js's request/answer world back into
   the channel TableRoom speaks to. Nothing here needs an account: the referee,
   its store and its bus are S1's fakes (test/helpers/serverfakes.js), reached
   through test/helpers/servertransport.js, which injects the faults.

     (a) two phones play a WHOLE seeded game through servertable channels and the
         stored game ends with the fingerprint the in-process referee gives — each
         phone's own fingerprint is the referee's view of its seat at the end, the
         replay verifies, the counters only ever climb, nothing was refused;
     (b) CONFLICT: store writes that lose a version race are retried with the SAME
         counter and the game still ends as the referee's; past the cap the channel
         says "unavailable", keeps its frame and recovers;
     (c) BROADCASTS dropped, duplicated and reordered: a duplicate is dropped, a late
         one is not delivered and asks for a resync, a dropped one is healed, and
         the final fingerprint still matches;
     (d) a subscription that drops and comes back reads "reconnecting", then heals;
     (e) a RELOAD mid-game claims the seat back, resumes at the server's counter
         (no stale answer) and finishes the game;
     (f) a wrong key is refused (and the seat record forgotten); a full table, an
         unknown code, a missing server are each told apart and never hang;
     (g) the seat KEY never appears in anything handed up (frames, status, events,
         report), in the console, or in a JUDGE!! report's source; and a
         BLINDNESS scan reads every frame each phone received (the uids hidden
         from it, the seed's secret half, the keys).
   Each of (b)–(g) is run again against a deliberately broken copy of
   servertable.js (or the server) and must FAIL there: a drill that cannot fail
   guards nothing. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const {makeWorld, SERVER} = require("./helpers/servertransport.js");
const PH = require("./helpers/serverphone.js");
const ST = require("../engine/servertable.js");
const {Wr, R, J, Hub} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
const SERVER_SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");

/* a copy of a module with named edits — each anchor must occur exactly once, or the sabotage did not apply */
function loadCopy(src, edits, req){
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, req || (() => { throw new Error("no require"); }), undefined);
  return m.exports;
}
const stCopy = edits => loadCopy(SRC, edits, p => require(path.join(ROOT, "engine", p)));
const serverCopy = edits => loadCopy(SERVER_SRC, edits, p => require(path.join(ROOT, "server", p)));

const HEROES = ["blaze", "dorinthea"];
const nonces = (world, code) => world.row(code).nonces;
const hashOf = (world, code) => Wr.hash(PH.storedGame(world, code));
const refHash = (world, code, cap) => Wr.hash(PH.reference(world.row(code), cap).state());

/* play `cap` actions (0: to the end) */
async function play(world, phones, cap, each){
  let n = 0;
  while(!cap || n < cap){
    let r = await PH.step(world, phones);
    /* nobody can move: a broadcast that never came cannot announce itself, so the poll (pollMs) fires */
    if(!r){ await Promise.all(phones.map(p => p.ch.heal())); await world.settle(phones.map(p => p.ch)); r = await PH.step(world, phones); }
    if(!r) break;
    n++;
    if(each) await each(n, r);
  }
  return n;
}

/* ---- the blindness scanner: judgedGame's, over what a phone's channel handed up -------------- */
function scanner(world, phones, code){
  const out = {leaks: [], seen: [0, 0], big: 0};
  const parts = [null, null];
  const ps = []; for(const p of phones) ps[p.seat] = p;
  let prev = null;
  out.scan = () => {
    const full = PH.storedGame(world, code);
    const row = world.row(code).hub;
    const secret = [row.seedH, row.spec && row.spec.seed].filter(Boolean).map(String);
    const hid = [0, 1].map(s => T.hiddenUidSet(full, s));
    if(!prev) prev = hid;
    for(const s of [0, 1]){
      const both = new Set([...hid[s]].filter(u => prev[s].has(u)));
      for(const f0 of ps[s].inbox.slice(out.seen[s])){
        let f = f0;
        if(f.m && f.m.t === "part"){
          const pp = parts[s] && parts[s].id === f.m.id ? parts[s] : (parts[s] = {id: f.m.id, got: []});
          pp.got[f.m.i] = f.m.s;
          if(pp.got.filter(x => x != null).length < f.m.n) continue;
          f = {ch: f.ch, m: JSON.parse(pp.got.join(""))}; parts[s] = null;
        }
        if(f.m && f.m.t === "reveal"){ if(!full.over) out.leaks.push("early reveal"); continue; }
        const str = JSON.stringify(f); out.big = Math.max(out.big, str.length);
        for(const u of T.tokens(f)) if(both.has(u)) out.leaks.push("seat " + s + ": " + (f.m && f.m.t) + " uid " + u);
        if(secret.some(x => str.indexOf(x) >= 0)) out.leaks.push("seat " + s + ": the seed");
        for(const k of row.keys) if(k && str.indexOf(k) >= 0) out.leaks.push("seat " + s + ": a seat key in a frame handed up");
      }
      out.seen[s] = ps[s].inbox.length;
    }
    prev = hid;
  };
  /* the raw wire: a phone is never sent the other seat's key, and its own only in the answer to its join */
  out.wire = () => {
    const row = world.row(code).hub;
    const seatOf = {}; for(const p of phones) seatOf[p.name] = p.seat;
    for(const e of world.inbound){
      const s = seatOf[e.name]; if(s == null) continue;
      if(row.keys[1 - s] && e.text.indexOf(row.keys[1 - s]) >= 0) out.leaks.push("the other seat's key reached " + e.name);
      if(row.keys[s] && e.text.indexOf(row.keys[s]) >= 0 && !(e.op === "join" && e.topic == null)) out.leaks.push("own key echoed outside a join answer to " + e.name);
    }
  };
  return out;
}

const verifyAll = ps => ps.map(p => { const rv = p.sess.revealed();
  return rv ? R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
    start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: J.reduce, seat: p.seat,
    log: rv.log, hashes: p.sess.hashes(), over: rv.over}) : {ok: false, why: "no reveal"}; });

/* every key / seed / event / status / report a phone could ever show, as text */
const shown = p => JSON.stringify([p.ch.report(), p.ch.events(), p.statuses, p.ch.status(), p.ch.closedWhy(), p.refused, p.errors]);

/* capture console output while `fn` runs (the key must never be logged) */
async function withConsole(fn){
  const got = [], real = {};
  for(const k of ["log", "info", "warn", "error", "debug"]){ real[k] = console[k]; console[k] = (...a) => { got.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); }; }
  try { return {value: await fn(), got}; } finally { for(const k in real) console[k] = real[k]; }
}

/* ============================================================ (a) */
let WHOLE = null;
test("(a) A WHOLE GAME THROUGH servertable CHANNELS — the stored game is the one the in-process referee plays, every fingerprint agrees", async () => {
  const world = makeWorld({seedKey: "c"});
  const {A, B} = await PH.seatTwo(world, HEROES, "c");
  const code = A.code, sc = scanner(world, [A, B], code);
  assert.deepEqual([A.seat, B.seat], [0, 1]);
  assert.equal(A.ch.status(), "seated"); assert.equal(B.ch.status(), "seated");
  assert.ok(ST.isValid(code), "a six-character code from the referee's alphabet");
  let climbed = true; const lastN = [0, 0];
  await play(world, [A, B], 0, () => { sc.scan();
    [A, B].forEach((p, i) => { if(p.ch.counter() < lastN[i]) climbed = false; lastN[i] = p.ch.counter(); }); });
  sc.wire();
  const full = PH.storedGame(world, code), ref = PH.reference(world.row(code), 0);
  assert.ok(full.over && ref.over(), "the game was played to its end");
  assert.equal(Wr.hash(full), Wr.hash(ref.state()), "final fingerprint, server row vs in-process referee");
  assert.deepEqual(T.json(full.over), T.json(ref.state().over));
  for(const p of [A, B]) assert.equal(p.sess.hash(), Wr.hash(R.seatView(full, p.seat)), "seat " + p.seat + ": its own fingerprint is the referee's view of it");
  for(const v of verifyAll([A, B])) assert.ok(v.ok, "verify: " + v.why);
  assert.ok(climbed, "the frame counters only ever climb");
  /* per seat, every frame POSTED carried a counter above the last one posted */
  for(const nm of ["A", "B"]){ const ns = world.posts.filter(x => x.name === nm && x.op === "frame").map(x => x.n);
    assert.ok(ns.length > 50 && ns.every((x, i) => i === 0 || x >= ns[i - 1]), nm + ": counters never go backwards"); }
  /* the only refusals a clean game meets are version races (two phones writing at once), and each was retried */
  const refused = world.answers.filter(a => !a.ok);
  assert.deepEqual(refused.filter(a => a.refused !== "conflict"), [], "nothing was refused but races");
  assert.ok(refused.length <= 12, "races are rare: " + refused.length);
  assert.deepEqual(world.errors, [], "no internal error on the server");
  assert.deepEqual([A.refused, B.refused], [[], []], "the lobby refused nothing");
  assert.deepEqual(sc.leaks, [], "blindness over everything each phone received");
  assert.ok(sc.big <= 16 * 1024, "a message of " + sc.big + " bytes");
  WHOLE = {world, A, B};
});

/* ============================================================ (b) */
async function conflictRun(ST_, edits){
  const world = makeWorld({seedKey: "cf"});
  const {A, B} = await PH.seatTwo(world, HEROES, "cf", {ST: ST_});
  const code = A.code, seenN = [];
  await play(world, [A, B], 40, async n => {
    if(n === 8) world.fault.conflicts(3);               /* three writes lose a race, back to back */
    if(n === 20) world.fault.conflicts(1);
  });
  return {world, A, B, code};
}
const cleanConflict = async (r) => {
  const {world, A, B, code} = r;
  const ev = [...A.ch.events(), ...B.ch.events()].filter(e => e.t === "conflict");
  assert.ok(ev.length >= 3, "the channel met the conflicts and retried: " + ev.length);
  /* the same frame was posted again with the SAME counter */
  const posts = world.posts.filter(x => x.op === "frame");
  const retried = posts.filter((x, i) => posts.some((y, j) => j < i && y.name === x.name && y.n === x.n));
  assert.ok(retried.length >= 3, "the retries reused the counter: " + retried.length);
  assert.equal(hashOf(world, code), refHash(world, code, 40), "the game is still the referee's after the conflicts");
  for(const p of [A, B]) assert.equal(p.sess.hash(), Wr.hash(R.seatView(PH.storedGame(world, code), p.seat)));
};
test("(b) CONFLICT — a write that lost the race is retried with the same counter and the game is still the referee's", async () => {
  await cleanConflict(await conflictRun(ST));
});
test("(b) PAST THE CAP the channel says unavailable, keeps its frame, and recovers when the server lets it through", async () => {
  const world = makeWorld({seedKey: "cf2"});
  const {A, B} = await PH.seatTwo(world, HEROES, "cf2", {phone: {tune: {conflictCap: 2}}});
  const code = A.code;
  await play(world, [A, B], 6);
  const before = nonces(world, code).slice();
  A.statuses.length = B.statuses.length = 0;
  world.fault.conflicts(12);                            /* far more than the cap of 2 allows through */
  await play(world, [A, B], 4);
  assert.ok(A.statuses.concat(B.statuses).includes("unavailable"), "it said so: " + A.statuses + " | " + B.statuses);
  assert.deepEqual([A.ch.status(), B.ch.status()], ["seated", "seated"], "and it is seated again");
  assert.ok(nonces(world, code).some((x, i) => x > before[i]), "the frames it was holding were applied");
  assert.equal(hashOf(world, code), refHash(world, code, 10));
});
test("SABOTAGE (b): a channel that does not retry a conflict loses frames", async () => {
  const bad = stCopy([["if(r.refused === \"conflict\"){", "if(r.refused === \"conflict\"){ n++; return true;"]]);
  let bit = false;
  try { const r = await conflictRun(bad); await cleanConflict(r); } catch(e){ bit = true; }
  assert.ok(bit, "the conflict drill did not notice a channel that drops conflicted frames");
});

/* ============================================================ (c) */
async function brokenWire(ST_){
  const world = makeWorld({seedKey: "bw"});
  const {A, B} = await PH.seatTwo(world, HEROES, "bw", {ST: ST_});
  const code = A.code, tA = world.topicOf(code, 0), tB = world.topicOf(code, 1), injected = {dup: 0};
  await play(world, [A, B], 70, async n => {
    if(n === 10){ world.fault.dup(tB, 1); injected.dup++; }
    if(n === 20){ world.fault.drop(tA, 1); }
    if(n === 32) world.fault.swap(tB);
    if(n === 40){ world.fault.dup(tA, 1); injected.dup++; }
    if(n === 50){ world.fault.drop(tB, 2); }
  });
  /* settle: whatever the last faults left behind is healed by a poll */
  await A.ch.heal(); await B.ch.heal(); await world.settle([A.ch, B.ch]);
  return {world, A, B, code, injected};
}
const cleanWire = async r => {
  const {world, A, B, code, injected} = r;
  const ev = (t) => [...A.ch.events(), ...B.ch.events()].filter(e => e.t === t);
  assert.equal(ev("dup").length, injected.dup, "each duplicated broadcast was recognised and dropped");
  assert.ok(ev("late").length >= 1, "a reordered broadcast was seen arriving late");
  assert.ok(ev("healed").length >= 1, "and the channel healed");
  assert.equal(hashOf(world, code), refHash(world, code, 70), "the stored game is still the referee's");
  for(const p of [A, B]) assert.equal(p.sess.hash(), Wr.hash(R.seatView(PH.storedGame(world, code), p.seat)), "seat " + p.seat + " converged on the referee's view");
};
test("(c) DROPPED, DUPLICATED AND REORDERED BROADCASTS — a duplicate is dropped, a late one asks for a resync, the fingerprint still matches", async () => {
  await cleanWire(await brokenWire(ST));
});
test("SABOTAGE (c): a channel that delivers every payload as it comes (no dedup, no late guard) is noticed", async () => {
  const bad = stCopy([["if(p.ver === lastVer){ ev(\"dup\", {ver: p.ver}); return; }", ""], ["if(p.ver < lastVer){ ev(\"late\", {ver: p.ver}); heal(); return; }", ""]]);
  let bit = false;
  try { await cleanWire(await brokenWire(bad)); } catch(e){ bit = true; }
  assert.ok(bit, "the broken-wire drill did not notice a channel with no dedup and no late guard");
});

/* ============================================================ (d) */
test("(d) A SUBSCRIPTION THAT DROPS READS reconnecting, AND COMES BACK HEALED", async () => {
  const world = makeWorld({seedKey: "sub"});
  const {A, B} = await PH.seatTwo(world, HEROES, "sub");
  const code = A.code, tB = world.topicOf(code, 1);
  await play(world, [A, B], 10);
  B.statuses.length = 0;
  world.fault.cut(tB);
  assert.equal(B.ch.status(), "reconnecting", "this phone says its link is failing");
  await play(world, [A, B], 8, () => {});               /* B hears nothing while A (and B's own posts) play on */
  world.fault.restore(tB);
  await world.settle([A.ch, B.ch]);
  await play(world, [A, B], 6);
  assert.equal(B.ch.status(), "seated");
  assert.ok(B.statuses.indexOf("reconnecting") >= 0 && B.statuses[B.statuses.length - 1] !== "reconnecting", "reconnecting, then seated: " + B.statuses);
  assert.equal(hashOf(world, code), refHash(world, code, 24));
  assert.equal(B.sess.hash(), Wr.hash(R.seatView(PH.storedGame(world, code), 1)));
});

/* ============================================================ (e) */
async function reloadRun(ST_){
  const world = makeWorld({seedKey: "rl"});
  const {A, B, rand} = await PH.seatTwo(world, HEROES, "rl", {ST: ST_});
  const code = A.code;
  await play(world, [A, B], 30);
  const keep = A.keep, nonceBefore = nonces(world, code)[0];
  /* the page is reloaded: nothing of A survives but what it put in the store seam */
  A.ch.close();
  const A2 = PH.makePhone(world, "A2", {hero: HEROES[0], rand, keep, ST: ST_, throws: [["rock", "rock"], ["paper", "rock"]]});
  const stale0 = world.answers.filter(a => a.refused === "stale").length;
  await A2.connect("reclaim", code);
  const n0 = A2.ch.counter();
  await world.settle([A2.ch, B.ch]);
  await play(world, [A2, B], 40);
  return {world, A2, B, code, n0, nonceBefore, stale: world.answers.filter(a => a.refused === "stale").length - stale0, keep};
}
const cleanReload = r => {
  const {world, A2, B, code, n0, nonceBefore, stale} = r;
  assert.equal(A2.seat, 0, "the same seat");
  assert.equal(n0, nonceBefore, "the counter resumed where the server had it");
  assert.equal(stale, 0, "and not one frame was refused as stale");
  assert.equal(hashOf(world, code), refHash(world, code, 70), "the game went on to the referee's fingerprint");
  for(const p of [A2, B]) assert.equal(p.sess.hash(), Wr.hash(R.seatView(PH.storedGame(world, code), p.seat)), "seat " + p.seat);
};
test("(e) A RELOAD MID-GAME claims the seat back, resumes at the right counter and finishes", async () => {
  const r = await reloadRun(ST);
  cleanReload(r);
  assert.ok(r.keep.m.get("srv." + r.code), "the seat record lived in the store seam");
});
test("SABOTAGE (e): a reclaim that forgets the counter is noticed", async () => {
  const bad = stCopy([["return channel(o, T, code, res.seat, key, res.n | 0, res.frames || [], scrub, keep);", "return channel(o, T, code, res.seat, key, 0, res.frames || [], scrub, keep);"]]);
  let bit = false;
  try { cleanReload(await reloadRun(bad)); } catch(e){ bit = true; }
  assert.ok(bit, "the reload drill did not notice a counter reset to zero");
});

/* ============================================================ (f) */
const guard = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), ms || 4000))]);
const opts = (world, extra) => ({transport: world.transport("X"), keep: PH.memKeep(), sleep: PH.FAST.sleep, tune: PH.FAST.tune, rand: () => 0.5, ...(extra || {})});
const whyOf = p => p.then(() => null, e => e.why || "?");
async function refusals(srv){
  const world = makeWorld({seedKey: "rf", server: srv});
  const {A, B, rand} = await PH.seatTwo(world, HEROES, "rf");
  const code = A.code; await play(world, [A, B], 6);
  const out = {};
  /* a wrong key */
  const keep = PH.memKeep(); keep.set("srv." + code, {seat: 0, key: "not-the-key-" + "0".repeat(20), role: "creator", at: 1});
  const before = world.store.json(code), v0 = world.store.version(code);
  out.wrong = await guard(whyOf(ST.reclaim(opts(world, {code, keep}))));
  out.forgot = keep.get("srv." + code, "gone") === null;
  out.unchanged = world.store.json(code) === before && world.store.version(code) === v0;
  /* the seat the player really holds still works */
  out.right = await guard(whyOf(ST.reclaim(opts(world, {code, keep: A.keep}))));
  return {world, out, A, B, code};
}
test("(f) A WRONG KEY IS REFUSED (and forgotten); a full table, an unknown code and a missing server are told apart and never hang", async () => {
  const {world, out, code, A} = await refusals(SERVER);
  assert.equal(out.wrong, "auth", "a wrong key is refused");
  assert.ok(out.forgot && out.unchanged, "the bad seat record was dropped and the table did not change");
  assert.equal(out.right, null, "while the right key still claims the seat");
  assert.equal(await guard(whyOf(ST.sitAt(opts(world, {code})))), "full", "a third phone at a full table");
  assert.equal(await guard(whyOf(ST.sitAt(opts(world, {code: "ZZZZZZ"})))), "no-table", "a code nobody opened");
  assert.equal(await guard(whyOf(ST.sitAt(opts(world, {code: "ab"})))), "code", "a code that is not one");
  assert.equal(await guard(whyOf(ST.reclaim(opts(world, {code})))), "auth", "no stored seat at all");
  world.fault.notFound();
  assert.equal(await guard(whyOf(ST.startTable(opts(world)))), "unavailable", "a function that is not there (404)");
  world.fault.notFound(false); world.fault.dead();
  assert.equal(await guard(whyOf(ST.startTable(opts(world)))), "unavailable", "a server that cannot be reached");
  world.fault.dead(false);
  /* mid-game, the server going away reads unavailable and the frame waits */
  A.statuses.length = 0; world.fault.dead();
  A.ch.send({ch: "lobby", m: {t: "noop-probe"}});
  await world.settle([], 200);
  assert.equal(A.ch.status(), "unavailable"); assert.equal(A.ch.pending(), 1, "the frame waits");
  world.fault.dead(false);
  await world.settle([A.ch]);
  assert.notEqual(A.ch.status(), "unavailable", "and the channel comes back by itself");
});
test("SABOTAGE (f): a server that checks no key lets a wrong key sit", async () => {
  const bad = serverCopy([["const keyEq = (a, b) => {", "const keyEq = (a, b) => { return true; "]]);
  const {out} = await refusals(bad);
  assert.notEqual(out.wrong, "auth", "the broken server let the wrong key in, so the (f) drill above fails on it");
});

/* ============================================================ (g) */
test("(g) THE KEY NEVER LEAVES THE CHANNEL — not in a frame, a status, an event, a report, the console or a JUDGE!! report", async () => {
  const {value, got} = await withConsole(async () => {
    const world = makeWorld({seedKey: "ky"});
    const {A, B} = await PH.seatTwo(world, HEROES, "ky");
    world.fault.failPosts(2); world.fault.loseAnswers(1);          /* transport errors are where a careless message would quote its request */
    await play(world, [A, B], 20);
    world.fault.dead(); A.ch.send({ch: "lobby", m: {t: "noop-probe"}}); await world.settle([], 100); world.fault.dead(false);
    const bad = PH.memKeep(); const keys = world.row(A.code).hub.keys;
    const errs = [];
    for(const how of [() => ST.reclaim(opts(world, {code: A.code, keep: bad})), () => ST.sitAt(opts(world, {code: A.code}))]){ try { await how(); } catch(e){ errs.push(String(e && (e.stack || e.message))); } }
    return {world, A, B, keys, errs};
  });
  const {world, A, B, keys, errs} = value;
  const hay = [shown(A), shown(B), JSON.stringify(A.inbox), JSON.stringify(B.inbox), errs.join("|"), got.join("|")].join("|");
  assert.equal(keys.length, 2); for(const k of keys) assert.ok(k && k.length >= 16, "a real key");
  for(const k of keys) assert.equal(hay.indexOf(k), -1, "a seat key reached a report, log, frame or error");
  /* …and the key is on the wire only where it must be */
  const sc = scanner(world, [A, B], A.code); sc.wire(); assert.deepEqual(sc.leaks, []);
  /* the JUDGE!! report is handed the table CODE only */
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = html.indexOf("report={note2 => [g, {", html.indexOf("function TableBoard"));
  assert.ok(at > 0, "the table board's report call was not found");
  const block = html.slice(at, html.indexOf("}]}/>", at));
  assert.ok(/table: code/.test(block) && !/\bkey\b/i.test(block) && !/judged/.test(block), "the report call must not touch the seat key");
});
test("SABOTAGE (g): a channel that hands the key up in the seat offer is noticed", async () => {
  const bad = stCopy([["const {key: _k, ...rest} = f0;                    /* THE KEY STOPS HERE */", "const rest = f0;"]]);
  const world = makeWorld({seedKey: "ky"});
  const {A, B} = await PH.seatTwo(world, HEROES, "ky", {ST: bad});
  const keys = world.row(A.code).hub.keys;
  const hay = JSON.stringify(A.inbox);
  assert.ok(hay.indexOf(keys[0]) >= 0, "the broken channel put the key in a frame handed up, so (g) above would have failed");
});
test("SABOTAGE (g): the blindness scan bites — the other seat's view delivered to this phone is a leak", async () => {
  const world = makeWorld({seedKey: "bl"});
  const {A, B} = await PH.seatTwo(world, HEROES, "bl");
  const code = A.code, sc = scanner(world, [A, B], code);
  await play(world, [A, B], 12, () => sc.scan());
  assert.deepEqual(sc.leaks, [], "clean before the sabotage");
  /* what seat 1 was told (its own hand, in a commit or a snapshot) arrives on seat 0's topic as well */
  const mine = B.inbox.filter(f => f.ch === "net");
  const k0 = world.row(code).hub.keys[0];
  world.route(world.topicOf(code, 0), {ver: 99999, frames: mine, mac: require("../engine/sha256.js").frameMac(k0, code, 0, 99999, mine)});   /* a buggy SERVER seals what it sends */
  await world.settle([A.ch, B.ch]);
  sc.scan();
  assert.ok(sc.leaks.length > 0, "the scanner did not notice the other seat's frames on this seat's channel");
});

/* ============================================================ (h) THE CHANNEL IS PUBLIC: A FORGED PUSH IS IGNORED (SERVER S3) */
async function forgeRun(ST_){
  const world = makeWorld({seedKey: "fg"});
  const {A, B} = await PH.seatTwo(world, HEROES, "fg", {ST: ST_});
  const code = A.code, SHAx = require("../engine/sha256.js");
  await play(world, [A, B], 14);
  const tA = world.topicOf(code, 0), keys = world.row(code).hub.keys;
  const before = A.inbox.length, st0 = A.sess.hash(), seq0 = A.sess.seq();
  /* what a listener who learned seat 0's channel name could publish: B's real frames (a hand!) and a made-up commit, with
     no seal, a seal of the wrong version, the other seat's seal, and a seal over other frames */
  const real = B.inbox.filter(f => f.ch === "net").slice(-3), junk = [{ch: "net", m: {t: "commit", seq: seq0 + 1, bogus: true}}];
  const lastVer = world.store.version(code);
  const ver = lastVer + 50;
  const sends = [
    {ver, frames: real}, {ver: ver + 1, frames: junk, mac: "0".repeat(64)}, {ver: ver + 2, frames: junk, mac: 5},
    {ver: ver + 3, frames: junk, mac: SHAx.frameMac(keys[1], code, 0, ver + 3, junk)},                  /* the other seat's key */
    {ver: ver + 4, frames: junk, mac: SHAx.frameMac(keys[0], code, 0, ver + 3, junk)},                  /* the right key, another version */
    {ver: ver + 5, frames: junk, mac: SHAx.frameMac(keys[0], code, 1, ver + 5, junk)},                  /* the right key, another seat */
    {ver: ver + 6, frames: real, mac: SHAx.frameMac(keys[0], code, 0, ver + 6, junk)}];                 /* a seal over other frames */
  for(const p of sends) world.route(tA, p);
  await world.settle([A.ch, B.ch]);
  const calls0 = world.posts.length;
  return {world, A, B, code, before, st0, seq0, sends, events: A.ch.events(), calls0};
}
const cleanForge = async r => {
  const {world, A, B, code, before, st0, seq0, sends} = r;
  assert.equal(A.ch.events().filter(e => e.t === "unsealed").length, sends.length, "every unsealed push was seen and ignored");
  assert.equal(A.inbox.length, before, "nothing was handed up to the game");
  assert.equal(A.sess.hash(), st0, "the game's state did not move"); assert.equal(A.sess.seq(), seq0);
  /* and the game goes on, and is the referee's */
  await play(world, [A, B], 20);
  assert.equal(hashOf(world, code), refHash(world, code, 34), "the stored game is still the referee's");
  for(const p of [A, B]) assert.equal(p.sess.hash(), Wr.hash(R.seatView(PH.storedGame(world, code), p.seat)), "seat " + p.seat + " agrees with the referee");
};
test("(h) A PUSH ON THE PUBLIC CHANNEL THAT DOES NOT VERIFY IS IGNORED — unsealed, wrongly sealed, another seat's seal, a replayed seal over other frames: the game never sees them", async () => {
  await cleanForge(await forgeRun(ST));
});
test("(h) A GENUINE PUSH REPLAYED LATER cannot move the game (a repeated version is dropped)", async () => {
  const world = makeWorld({seedKey: "rp"});
  const {A, B} = await PH.seatTwo(world, HEROES, "rp");
  const code = A.code, tA = world.topicOf(code, 0);
  await play(world, [A, B], 10);
  const sealed = world.bus.log.filter(e => e.topic === tA).map(e => e.payload);
  assert.ok(sealed.length >= 3, "the referee pushed to seat 0: " + sealed.length);
  const h0 = A.sess.hash(), seq0 = A.sess.seq(), n0 = A.inbox.length;
  for(const p of sealed) world.route(tA, JSON.parse(JSON.stringify(p)));
  await world.settle([A.ch, B.ch]);
  assert.equal(A.sess.hash(), h0); assert.equal(A.sess.seq(), seq0);
  assert.equal(A.inbox.length, n0, "nothing replayed reached the game");
  await play(world, [A, B], 12);
  assert.equal(hashOf(world, code), refHash(world, code, 22));
});
test("SABOTAGE (h): a channel that applies a push without checking its seal takes a forged frame", async () => {
  const bad = stCopy([["if(typeof p.mac !== \"string\" || p.mac !== SHA.frameMac(key, code, seat, p.ver, p.frames)){ ev(\"unsealed\", {ver: p.ver}); return; }", ""]]);
  let bit = false;
  try { await cleanForge(await forgeRun(bad)); } catch(e){ bit = true; }
  assert.ok(bit, "the forgery drill did not notice a channel that skips the seal check");
});

/* ============================================================ (i) THE CLAIM TOKEN, FROM THE PHONE'S SIDE (SERVER S3) */
async function lostJoinRun(ST_){
  const world = makeWorld({seedKey: "lj"});
  const opts = (name, extra) => ({transport: world.transport(name), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, keep: PH.memKeep(), ...(extra || {})});
  const M = ST_ || ST;
  world.fault.loseUnkeyedJoins(1);                           /* the opener's first join is dealt a seat, its answer is lost */
  const a = await M.startTable(opts("A"));
  const code = a.code;
  const b = await M.sitAt(opts("B", {code}));
  return {world, a, b, code};
}
test("(i) A LOST ANSWER TO THE OPENING JOIN IS RETRIED AND LANDS ON THE SAME SEAT — the other phone gets the other chair, none is stranded", async () => {
  const {world, a, b, code} = await lostJoinRun(ST);
  assert.equal(a.seat, 0, "the opener holds seat 0"); assert.equal(b.seat, 1, "the joiner holds seat 1");
  const asks = world.outbound.filter(x => x.name === "A").map(x => JSON.parse(x.text)).filter(e => e.op === "join" && e.claim);
  assert.equal(asks.length, 2, "the opener asked twice");
  assert.equal(asks[0].claim, asks[1].claim, "with the same token");
  assert.deepEqual(world.row(code).hub.keys.map(k => !!k), [true, true], "two seats dealt, no more");
  assert.equal(world.row(code).claims.filter(Boolean).length, 2);
  /* the claim token is never sent to the other phone */
  const tokA = world.row(code).claims[0];
  assert.ok(!world.inbound.filter(e => e.name === "B").some(e => e.text.indexOf(tokA) >= 0), "seat 0's token did not reach seat 1");
  a.close(); b.close();
});
test("SABOTAGE (i): a phone that sends no claim token strands the seat its lost answer was dealt", async () => {
  const bad = stCopy([["{op: \"join\", table: code, claim}", "{op: \"join\", table: code}"]]);
  const r = await lostJoinRun(bad).then(x => x, e => ({err: e}));
  assert.ok(r.err || r.a.seat !== 0 || r.b.seat !== 1 || r.world.row(r.code).hub.keys.filter(Boolean).length !== 2, "the drill must see a stranded or swapped seat");
  assert.ok(!r.err ? r.b.seat !== 1 || r.a.seat !== 0 : true);
});
test("a 404 from the function is final (not retried); a network error is retried a couple of times, then unavailable", async () => {
  let posts = 0;
  const mk = status => ({post: async () => { posts++; throw Object.assign(new Error("x"), {status}); }, subscribe: () => () => {}});
  posts = 0; assert.equal(await guard(whyOf(ST.sitAt({transport: mk(404), code: "ABCDEF", sleep: PH.FAST.sleep}))), "unavailable"); assert.equal(posts, 1, "a missing function is not asked again");
  posts = 0; assert.equal(await guard(whyOf(ST.sitAt({transport: mk(undefined), code: "ABCDEF", sleep: PH.FAST.sleep}))), "unavailable"); assert.equal(posts, 3, "a failing network is asked three times, then given up on");
});
test("THE SWITCH in index.html: one config value gates every entry; the table screen renders the option only behind it", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/window\.SERVER_TABLE = (\{[^}]*\});/);
  assert.ok(m, "window.SERVER_TABLE is declared in the data script");
  const cfg = new Function("return " + m[1])();
  assert.equal(typeof cfg.on, "boolean"); assert.equal(cfg.fn, "table");
  assert.match(cfg.url, /^https:\/\/[a-z0-9]+\.supabase\.co$/); assert.match(cfg.key, /^sb_publishable_/);
  assert.ok(!/service_role|sb_secret_|eyJ[A-Za-z0-9_-]{20,}/.test(html.slice(html.indexOf("window.SERVER_TABLE"), html.indexOf("window.SERVER_TABLE") + 600)), "no secret in the config");
  assert.ok(!/SERVER_CFG/.test(html), "the old unguarded config name is gone");
  assert.equal(html.split("Join a server table").length - 1, 1, "the entry is rendered in one place");
  assert.match(html, /\{srvOn && <div className="tblrow"><button className="bigbtn alt" onClick=.*>Join a server table<\/button><\/div>\}/, "and that place is behind the switch");
  assert.match(html, /const srvSit = \(how, c, role\) => \{\s*if\(!srvOn\) return;/, "so is the only caller of the server transport");
  assert.equal(html.split("DawnServerTable.defaultTransport(").length - 1, 1);
});
test("THE TESTER'S DOOR: the shipped switch is off; ?server=1 opts a phone in and is remembered; ?server=0 forgets it", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.equal(new Function("return " + html.match(/window\.SERVER_TABLE = (\{[^}]*\});/)[1])().on, false, "off by default for everyone");
  const mk = () => { const m = new Map(); return {get: (k, f) => m.has(k) ? JSON.parse(m.get(k)) : f, set: (k, v) => m.set(k, JSON.stringify(v)), m}; };
  const keep = mk();
  assert.equal(ST.testerDoor(keep, ""), false, "no query, nothing stored: closed");
  assert.equal(ST.testerDoor(keep, "?server=yes"), false, "only 1 opens it");
  assert.equal(ST.testerDoor(keep, "?x=1&server=1"), true, "the query opens it");
  assert.equal(ST.testerDoor(keep, ""), true, "a relaunch without the query stays open (remembered)");
  assert.equal(ST.testerDoor(keep, "?server=0"), false, "0 forgets it");
  assert.equal(ST.testerDoor(keep, ""), false, "and it stays forgotten");
  const broken = {get(){ throw new Error("blocked"); }, set(){ throw new Error("blocked"); }};
  assert.equal(ST.testerDoor(broken, ""), false, "blocked storage: closed, no throw");
  assert.equal(ST.testerDoor(broken, "?server=1"), true, "blocked storage: this load is still opted in");
  assert.match(html, /const SRV_TESTER = DawnServerTable\.testerDoor\(store, window\.location\.search\);/, "the page asks through its store seam");
  assert.match(html, /const srvOn = !!\(window\.SERVER_TABLE && \(window\.SERVER_TABLE\.on === true \|\| SRV_TESTER\)\)/, "and srvOn is the only gate that reads it");
});
test("the page registers its card database with the judge engine (a replay of a server game needs the tokens the server made)", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /function useCardDB\(\)\{[\s\S]*?const db = loadPool\(\);[\s\S]*?DawnJudge\.setDb\(db\);\s*return db;/, "useCardDB registers what loadPool read; tools/serverpage.js plays the page's own judge with and without it");
  assert.equal(html.split("DawnJudge.setDb(").length - 1, 1, "registered in one place");
});
test("the server switch: off, the page's transport makes no request and loads no library", async () => {
  const w = {};
  const t = ST.defaultTransport({on: false, url: "https://example.invalid", key: "k"}, w);
  assert.equal(await guard(whyOf(ST.startTable({transport: t, sleep: PH.FAST.sleep}))), "unavailable");
  assert.equal(await guard(whyOf(ST.defaultTransport(undefined, w).post({}))), "unavailable", "no config is off, too");
  const real = ST.defaultTransport({on: true, url: "https://example.invalid", key: "k", fetch: async () => ({ok: false, status: 404})}, w);
  assert.equal(await guard(whyOf(ST.startTable({transport: real, sleep: PH.FAST.sleep}))), "unavailable");
  const fake = {post: async () => ({ok: false}), subscribe: () => () => {}};
  assert.equal(ST.defaultTransport({on: false}, {__dawnServerTransport: fake}), fake, "a drive's installed transport still wins");
});

/* ============================================================ the module itself */
test("the channel's shape is room.js's, and the page loads it without a fake in it", () => {
  const ch = ["send", "listen", "first", "close", "status"];
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for(const k of ch) assert.ok(new RegExp("\\b" + k + "\\(").test(SRC), "channel has " + k);
  assert.ok(src.includes('<script src="engine/servertable.js"></script>'), "index.html loads engine/servertable.js");
  for(const tag of src.match(/<script src="[^"]+"><\/script>/g) || []) assert.ok(!/servertransport|serverfakes|serverphone/.test(tag), "a test fake is a script tag: " + tag);
  assert.ok(!/memStore|memBus|referee\.js/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, "")), "the module names no fake");
});
test("loading the module costs no request; the real transport answers unavailable when its function is missing", async () => {
  const calls = [];
  const tr = ST.supabaseTransport({url: "https://example.invalid", key: "k", fetch: async (u, i) => { calls.push({u, i}); return {ok: false, status: 404, json: async () => ({message: "not found"})}; }});
  assert.equal(calls.length, 0, "building the transport made no request");
  assert.equal(await guard(whyOf(ST.startTable({transport: tr, sleep: PH.FAST.sleep}))), "unavailable");
  assert.equal(calls.length, 1); assert.equal(calls[0].u, "https://example.invalid/functions/v1/table");
  assert.equal(calls[0].i.headers.apikey, "k"); assert.ok(!("authorization" in calls[0].i.headers));
  /* a 200 that is not the referee (a login page, say) reads the same */
  const tr2 = ST.supabaseTransport({url: "https://example.invalid", key: "k", fetch: async () => ({ok: true, status: 200, json: async () => ({hello: 1})})});
  assert.equal(await guard(whyOf(ST.sitAt({transport: tr2, code: "ABCDEF"}))), "unavailable");
  /* and the library is pinned to one exact version */
  assert.match(ST.SUPABASE_JS, /@supabase\/supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js$/);
});

/* ============================================================ PERF (2026-11-14): the push never landed in a browser */
test("PERF: the library is loaded from the pinned CDN address, never from the project URL (v6.26 asked the project for its script, so no browser ever got Realtime)", async () => {
  const srcs = [];
  const doc = {createElement: () => ({}), head: {appendChild: el => { srcs.push(el.src); }}};
  const w = global.window; delete global.window;
  try {
    const p = ST.loadSupabase({document: doc, url: "https://fokcpzplomjsraquaaid.supabase.co", key: "k"});
    p.catch(() => {});
    assert.equal(srcs.length, 1);
    assert.equal(srcs[0], ST.SUPABASE_JS, "the script address is the pinned CDN file, not config.url");
    assert.ok(srcs[0].indexOf("fokcpzplomjsraquaaid") < 0);
  } finally { if(w) global.window = w; }
  /* the page's own call path: supabaseTransport hands its whole config (url = the project) to loadSupabase */
  assert.ok(/loadSupabase\(config\)/.test(SRC), "the transport still passes its config (so the drill above is the guard)");
  /* sabotage: the old line must fail the drill's own assertion */
  const bad = stCopy([["el.src = o.libUrl || SUPABASE_JS;", "el.src = o.url || SUPABASE_JS;"]]);
  const srcs2 = [], doc2 = {createElement: () => ({}), head: {appendChild: el => { srcs2.push(el.src); }}};
  bad.loadSupabase({document: doc2, url: "https://p.example", key: "k"}).catch(() => {});
  assert.equal(srcs2[0], "https://p.example", "sabotage applied: the old code takes the project URL");
});

test("PERF: with no push the other seat is still heard within one fallback tick, a lobby opens, and 'reconnecting' clears once the table answers", async () => {
  const run = async (src, fallbackMs) => {
    const world = makeWorld({seedKey: "fb"});
    const ticks = [];
    const timers = {setInterval: (f, ms) => { ticks.push({f, ms}); return ticks.length; }, clearInterval: () => {}};
    const M = src || ST;
    /* a bare channel for A (the host waiting on 'seated' sends nothing, as in the page's lobby) */
    const Ach = await M.startTable({transport: world.transport("A"), keep: PH.memKeep(), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune, fallbackMs}, timers, rand: () => 0.5});
    const A = {ch: Ach, code: Ach.code};
    await world.settle([A.ch]);
    world.fault.cut(world.topicOf(A.code, 0));                       /* A's push channel is gone: payloads lost, the subscription reads "lost" */
    const B = PH.makePhone(world, "B", {hero: "dorinthea", rand: T.seeded("fb"), ST: M});
    await B.connect("join", A.code);
    await world.settle([A.ch, B.ch]);
    const before = {peer: A.ch.peerHeard(), st: A.ch.status(), reportPush: A.ch.report().push};
    for(const t of ticks.filter(t => t.ms === fallbackMs && fallbackMs > 0)) await t.f();
    await world.settle([A.ch, B.ch]);
    for(let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
    const out = {before, peer: A.ch.peerHeard(), st: A.ch.status(), registered: ticks.filter(t => t.ms === fallbackMs).length};
    A.ch.close(); B.ch.close(); return out;
  };
  const on = await run(null, 2000);
  assert.equal(on.registered, 1, "one fallback timer");
  assert.equal(on.before.peer, false, "no push reached A: it has not heard B yet (the fixture)");
  assert.equal(on.before.reportPush, "polling");
  assert.equal(on.peer, true, "one tick and A has heard B");
  assert.equal(on.st, "seated", "and the status is no longer 'reconnecting'");
  /* sabotage: no fallback timer (the v6.26 page) -> A never hears; and the status stays reconnecting */
  const off = await run(null, 0);
  assert.equal(off.peer, false); assert.equal(off.st, "reconnecting");
  const old = await run(stCopy([["if(ok1 && st === \"reconnecting\") set(peerHeard ? \"seated\" : \"waiting\");", ""], ["if(ok1 && peerHeard && st === \"waiting\") set(\"seated\");", ""]]), 2000);
  assert.equal(old.peer, true); assert.equal(old.st, "reconnecting", "sabotage applied: without the clearing, a lobby that waits on 'seated' stays shut");
});

test("PERF: the page turns the fallback poll on, and it is stopped when the table closes", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(/tune: \{pollMs: 20000, fallbackMs: 2000\}/.test(html));
  assert.ok(/if\(fb\) try \{ timers\.clearInterval\(fb\)/.test(SRC));
});
