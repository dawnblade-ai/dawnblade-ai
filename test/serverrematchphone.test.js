/* test/serverrematchphone.test.js — REMATCH, AS THE PHONES SEE IT (v6.83).

   engine/servertable.js over the fake wire and the real referee (test/helpers/servertransport.js), with the fake sign-in provider and the ratings
   backend. One ranked game is played and conceded; then:
     (a) one phone asks (`askRematch`), the OTHER phone learns it from the sealed push alone (`rematch().theirs`, `onRematch`), without asking;
     (b) the other asks too: the referee opens the new table and BOTH phones hold its code (the first one from the push);
     (c) both phones sit down at the new table, a second ranked game is dealt and conceded, and it is recorded as a second result (both ratings moved twice);
     (d) a missed push heals: a phone whose push never came reads the code from its next resync (`heal`). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const PH = require("./helpers/serverphone.js");
const {makeWorld} = require("./helpers/servertransport.js");
const ST = require("../engine/servertable.js");

const ROOT = path.join(__dirname, "..");
const STSRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
function stCopy(edits){
  let src = STSRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "engine", p)), undefined);
  return m.exports;
}
const guard = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("the drill hung")), ms || 20000))]).catch(e => ["threw: " + (e && (e.why || e.message))]);

function rankedWorld(seedKey){
  const world = makeWorld({seedKey}), idp = F.memIdentity(), rat = F.withRatings();
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  Object.assign(world.deps, rat.deps());
  const player = (id, name) => { const tok = idp.issue(id); idp.rename(id, name, world.server.nameFold(name)); return {id, tok, identity: {token: async () => tok}}; };
  return {world, idp, rat, player};
}
async function seat(w, A, B, code){
  if(code){ await A.connect("join", code); await B.connect("join", code); }
  else { await A.connect("create"); await B.connect("join", A.code); }
  for(let i = 0; i < 8 && !(A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready"); i++) await w.world.settle([A.ch, B.ch]);
  return A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready";
}

async function rematchFailures(M, o){
  o = o || {};
  const bad = [], w = rankedWorld("rmp-" + (o.salt || "a"));
  const P = w.player("P-rmp-zero", "Dawn Smith"), Q = w.player("P-rmp-one", "Rival One");
  const mk = (n, h, pl, extra) => PH.makePhone(w.world, n, {hero: h, rand: T.seeded("rmp|" + n + "|" + (o.salt || "")), ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: pl.identity, ...(extra || {})});
  const A = mk("A", "blaze", P, {ranked: true}), B = mk("B", "dorinthea", Q);
  if(!await seat(w, A, B)) return ["the first game did not start"];
  B.sess.submit({t: "concede"});
  await w.world.settle([A.ch, B.ch]);
  if(w.rat.records !== 1) return ["the first game was not recorded"];
  const heard = [];
  B.ch.onRematch(r => heard.push(r));
  if(o.dropPush) w.world.deps.broadcast = () => {};
  /* (a) */
  const a = await A.ch.askRematch();
  if(a.state !== "waiting" || !A.ch.rematch().mine) bad.push("the first ask did not wait: " + JSON.stringify(a));
  await w.world.settle([A.ch, B.ch]);
  if(!o.dropPush && (!B.ch.rematch().theirs || !heard.length)) bad.push("the other phone did not learn of the ask from the push: " + JSON.stringify(B.ch.rematch()));
  if(o.dropPush){ await B.ch.heal(); if(!B.ch.rematch().theirs) bad.push("a missed push did not heal on a resync"); }
  /* (b) */
  const b = await B.ch.askRematch();
  if(b.state !== "ready" || typeof b.table !== "string" || b.table === A.code) return bad.concat("the second ask did not open a new table: " + JSON.stringify(b));
  await w.world.settle([A.ch, B.ch]);
  if(o.dropPush) await A.ch.heal();
  if(A.ch.rematch().table !== b.table) bad.push("the first phone does not hold the new table's code: " + JSON.stringify(A.ch.rematch()));
  if(o.dropPush) return bad;
  /* (c) */
  const A2 = mk("A2", "blaze", P), B2 = mk("B2", "dorinthea", Q);
  if(!await seat(w, A2, B2, b.table)) return bad.concat("the rematch did not start");
  B2.sess.submit({t: "concede"});
  await w.world.settle([A2.ch, B2.ch]);
  if(w.rat.records !== 2 || w.rat.duplicates !== 0) bad.push("the rematch was not recorded as a second game: records " + w.rat.records + ", duplicates " + w.rat.duplicates);
  if(w.rat.rt.get("P-rmp-zero").games !== 2) bad.push("seat 0's player does not have two games");
  return bad;
}
test("(a)(b)(c) the ask reaches the other phone by push; both hold the new code; the rematch is a second ranked game", async () => {
  assert.deepEqual(await guard(rematchFailures(ST)), []);
  assert.ok((await guard(rematchFailures(stCopy([["      if(f0.ch === CH_REMATCH){ readRematch(f0.m); continue; }", ""]])))).length > 0, "sabotage (the push is not read) must fail");
  assert.ok((await guard(rematchFailures(stCopy([["    for(const f of rmFns.slice()) try { f(handle.rematch()); } catch(_){}", ""]])))).length > 0, "sabotage (onRematch never called) must fail");
});
test("(d) a missed push heals: the next resync carries who asked and the code", async () => {
  assert.deepEqual(await guard(rematchFailures(ST, {salt: "drop", dropPush: true})), []);
  assert.ok((await guard(rematchFailures(stCopy([["if(r && r.ok){ readNames(r.names); readRank(r); readRematch(r.rematch); ingest(r.frames); ok1 = true; }", "if(r && r.ok){ readNames(r.names); readRank(r); ingest(r.frames); ok1 = true; }"]]), {salt: "drop", dropPush: true}))).length > 0, "sabotage (a resync ignores the rematch) must fail");
});

/* (e) LEAVING TAKES THE ASK BACK (v6.87): a phone that asked and then leaves the table (closes it) cancels its ask, so the other phone stops seeing
   "wants a rematch" at once; a phone that never asked sends nothing; a phone that closes after the code is agreed does not cancel it. */
async function leaveFailures(M, o){
  o = o || {};
  const bad = [], w = rankedWorld("rmp-leave-" + (o.salt || "a"));
  const P = w.player("P-rml-zero", "Dawn Smith"), Q = w.player("P-rml-one", "Rival One");
  const mk = (n, h, pl, extra) => PH.makePhone(w.world, n, {hero: h, rand: T.seeded("rml|" + n + "|" + (o.salt || "")), ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: pl.identity, ...(extra || {})});
  const A = mk("A", "blaze", P, {ranked: true}), B = mk("B", "dorinthea", Q);
  if(!await seat(w, A, B)) return ["the game did not start"];
  B.sess.submit({t: "concede"});
  await w.world.settle([A.ch, B.ch]);
  await A.ch.askRematch(); await w.world.settle([A.ch, B.ch]);
  if(!B.ch.rematch().theirs) return ["the other phone did not hear the ask"];
  A.ch.close(); await w.world.settle([B.ch]);
  if(B.ch.rematch().theirs) bad.push("the other phone still shows the ask after the asker left");
  return bad;
}
test("(e) leaving the table takes a pending rematch ask back; the other phone stops seeing it", async () => {
  assert.deepEqual(await guard(leaveFailures(ST)), []);
  assert.ok((await guard(leaveFailures(stCopy([["      if(!closed && rm.want[seat] === true && !rm.table){", "      if(false){"]]), {salt: "sab"}))).length > 0, "sabotage (close does not cancel) must fail");
});
