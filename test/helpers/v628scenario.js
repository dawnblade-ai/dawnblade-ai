/* test/helpers/v628scenario.js — A CASUAL TABLE'S WHOLE PRE-GAME, AS REQUESTS (SERVER S4.1).
   A fixed script of requests that present NO identity, run against a referee module with fixed deps. For each step it
   returns the sha256 of the response's JSON text and of the stored row's JSON text. test/fixtures/referee-v628.json is
   this run recorded against the v6.28 referee (git dc2ee48) in a scratch worktree: the new referee must produce the same
   hashes, i.e. the same responses and the same rows, byte for byte. */
const T = require("./judgetable.js");
const F = require("./serverfakes.js");
const L = require("../../engine/lobby.js");
const SHA = require("../../engine/sha256.js");

function run(server){
  const store = F.memStore(), sent = [];
  let clock = 1700000000000; const rnd = T.seeded("v628-casual");
  const deps = {store, broadcast: (t, p) => sent.push([t, p]), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => rnd};
  const steps = [], ID = "CASUAL1", TA = "tokenAAAAAAAAAAAAAAAA", TB = "tokenBBBBBBBBBBBBBBBB", TC = "tokenCCCCCCCCCCCCCCCC";
  let keys = [];
  const go = (what, req) => {
    const res = server.handleNow(req, deps), text = JSON.stringify(res);
    steps.push({what, res: SHA.sha256(text), row: store.json(ID) ? SHA.sha256(store.json(ID)) : null, version: store.version(ID), ok: res.ok, refused: res.refused || null, pushes: sent.length});
    return res;
  };
  const keyOf = r => (r.frames.find(f => f.ch === "judge" && f.key) || {}).key;
  go("create", {op: "create", table: ID});
  const a = go("join A (claim)", {op: "join", table: ID, claim: TA}); keys[a.seat] = keyOf(a);
  go("join A again (same claim)", {op: "join", table: ID, claim: TA});
  const b = go("join B (no claim)", {op: "join", table: ID}); keys[b.seat] = keyOf(b);
  go("join C (full)", {op: "join", table: ID, claim: TC});
  go("join with a bad claim", {op: "join", table: ID, claim: "short"});
  go("keyed join A", {op: "join", table: ID, seat: a.seat, key: keys[a.seat]});
  go("keyed join with the other seat's key", {op: "join", table: ID, seat: a.seat, key: keys[b.seat]});
  go("resync A", {op: "resync", table: ID, seat: a.seat, key: keys[a.seat]});
  go("frame with a wrong key", {op: "frame", table: ID, seat: b.seat, key: "0".repeat(32), n: 1, frame: {ch: "lobby", m: L.hero(b.seat, "kayo")}});
  go("hero A", {op: "frame", table: ID, seat: a.seat, key: keys[a.seat], n: 1, frame: {ch: "lobby", m: L.hero(a.seat, "kayo")}});
  go("hero B", {op: "frame", table: ID, seat: b.seat, key: keys[b.seat], n: 1, frame: {ch: "lobby", m: L.hero(b.seat, "dash")}});
  go("stale frame", {op: "frame", table: ID, seat: b.seat, key: keys[b.seat], n: 1, frame: {ch: "lobby", m: L.hero(b.seat, "dash")}});
  go("resync B", {op: "resync", table: ID, seat: b.seat, key: keys[b.seat]});
  go("no such table", {op: "join", table: "NOPE"});
  return steps;
}
module.exports = {run};
