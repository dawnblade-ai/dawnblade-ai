/* test/serverforfeitphone.test.js — THE PHONE'S SIDE OF THE FORFEIT CLOCK (SERVER S5.2).

   engine/servertable.js over the fake wire and the real referee (test/helpers/servertransport.js), the function's time and each phone's own time both INJECTED
   (nothing sleeps). Each drill has its sabotage:

     (a) BOTH PHONES READ THE CLOCK — which seat the game waits on, and a countdown made of the SERVER's stamp plus this phone's own elapsed time (never its wall clock
         against the server's); it restarts when the waited-on seat moves; a casual table has none.
     (b) A CLAIM — refused early (the phone is told how long is left), refused for the waited-on seat; due, it ends the game as a forfeit: the claimant reads the result at
         once, the absent phone reads it by asking and its game is over; a casual table's claim is refused in the phone's own word.
     (c) CLOSE — `closeTable` on a started ranked table answers conceded with the result summary; casual and not-started answers are unchanged. */
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
const T0 = 1700000000000, LIMIT = require("../server/referee.js").FORFEIT_MS;

async function seat(M, o){
  o = o || {};
  const world = makeWorld({seedKey: "ffp-" + (o.salt || "")}), idp = F.memIdentity(), rat = F.withRatings();
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f); Object.assign(world.deps, rat.deps());
  const pl = (id, name) => { const tok = idp.issue(id); idp.rename(id, name, world.server.nameFold(name)); return {identity: {token: async () => tok}}; };
  const fn = {t: T0}; world.deps.now = () => fn.t;                                 /* the FUNCTION's time */
  const loc = {t: 5000000};                                                       /* each phone's OWN time, unrelated to the function's */
  const rand = T.seeded("ffp-phones|" + (o.salt || ""));
  const mk = (n, h, p, extra) => PH.makePhone(world, n, {hero: h, rand, ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: p.identity, now: () => loc.t, ...(extra || {})});
  const pA = pl("P-ffp-zero", "Dawn Smith"), pB = pl("P-ffp-one", "Rival One");
  const A = mk("A", "blaze", pA, o.casual ? {} : {ranked: true}), B = mk("B", "dorinthea", pB);
  await A.connect("create"); await B.connect("join", A.code);
  await world.settle([A.ch, B.ch]);
  for(let i = 0; i < 6 && !(A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready"); i++) await world.settle([A.ch, B.ch]);
  return {world, rat, fn, loc, A, B, pA, pB, phones: [A, B], bySeat: s => (A.ch.seat === s ? A : B)};
}

async function clockFailures(M){
  const bad = [], x = await seat(M, {salt: "a"});
  if(!x.A.sess || x.A.sess.status() !== "ready") return ["the game did not start"];
  await Promise.all(x.phones.map(p => p.ch.heal()));
  const w = x.world.row(x.A.code).clock.on, W = x.bySeat(w), O = x.bySeat(1 - w);
  const cw = W.ch.clock(), co = O.ch.clock();
  if(!cw || !co || cw.on !== w || co.on !== w || cw.mine !== true || co.mine !== false) return bad.concat("the phones do not read who the game waits on: " + JSON.stringify([cw, co]));
  if(cw.limit !== LIMIT || co.left > LIMIT || co.left < LIMIT - 5000) bad.push("the countdown does not start from the limit: " + co.left);
  /* the countdown is the server's age plus THIS phone's elapsed time: 200 s on the phone's own clock, whatever the function's says */
  x.loc.t += 200000;
  const after = O.ch.clock();
  if(Math.abs((co.left - after.left) - 200000) > 1) bad.push("the countdown does not follow the phone's own elapsed time: " + (co.left - after.left));
  if(after.due) bad.push("a claim shows as due with time left");
  /* a heal brings the SERVER's age: the function says 200 s have passed (its own clock), and the phone shows that, not its own bookkeeping */
  x.fn.t += 200000; await O.ch.heal();
  const healed = O.ch.clock();
  if(!healed || Math.abs(healed.left - (LIMIT - 200000)) > 5000) bad.push("a heal did not take the server's age: " + (healed && healed.left));
  /* the waited-on seat moves: the stamp restarts and the OTHER phone is told in a sealed push, with no heal asked for */
  const mv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !T.J.legal(W.sess.state(), a, w));
  if(!mv) return bad.concat("no move to make");
  x.fn.t += 1000; x.loc.t += 1000;
  W.sess.submit(mv);
  await x.world.settle([W.ch, O.ch]);
  const stored = x.world.row(x.A.code).clock, told = O.ch.clock();
  if(!stored || !told || told.on !== stored.on || told.limit !== LIMIT || Math.abs(told.left - LIMIT) > 2000) bad.push("the other phone was not told the restarted clock by the push: " + JSON.stringify([stored, told]));
  if(stored && stored.since !== x.fn.t) bad.push("the stamp is not the function's time at the move");
  x.phones.forEach(p => p.ch.close());
  return bad;
}
test("(a) BOTH PHONES READ THE CLOCK — who the game waits on, and a countdown of the server's age plus this phone's own elapsed time; a heal brings the server's account", async () => {
  assert.deepEqual(await guard(clockFailures(ST), 30000), []);
});
test("SABOTAGE (a): a phone that ignores the clock frame and the answer's clock, or counts from its own wall clock, is seen", async () => {
  for(const [what, edits] of [
    ["the clock never read", [["    if(v && typeof v === \"object\" && (v.on === 0 || v.on === 1) && Number.isFinite(v.age) && v.age >= 0 && Number.isFinite(v.limit) && v.limit > 0)", "    if(false)"]]],
    ["the elapsed time never added", [["Math.max(0, (o.now || Date.now)() - clk.at)", "0"]]]])
    assert.ok((await guard(clockFailures(stCopy(edits)), 30000)).length >= 1, "the sabotage must be seen: " + what);
});

async function claimFailures(M){
  const bad = [], x = await seat(M, {salt: "b"});
  if(!x.A.sess || x.A.sess.status() !== "ready") return ["the game did not start"];
  await Promise.all(x.phones.map(p => p.ch.heal()));
  const w = x.world.row(x.A.code).clock.on, W = x.bySeat(w), O = x.bySeat(1 - w);
  const v0 = x.world.store.version(x.A.code);
  const early = await O.ch.claimWin().then(() => null, e => e);
  if(!early || early.why !== "claim-early" || !(early.left > 0)) bad.push("an early claim was not refused with the time left: " + (early && [early.why, early.left]));
  const self = await W.ch.claimWin().then(() => null, e => e);
  if(!self || self.why !== "claim-self") bad.push("the waited-on phone's claim was not refused in its word: " + (self && self.why));
  if(x.world.store.version(x.A.code) !== v0 || x.rat.records !== 0) bad.push("a refused claim changed the table");
  /* due: the function's time passes the limit, and so does the phone's own */
  x.fn.t += LIMIT; x.loc.t += LIMIT; await O.ch.heal();
  const due = O.ch.clock();
  if(!due || due.left !== 0 || due.due !== true) bad.push("the phone does not show the claim as due: " + JSON.stringify(due));
  const r = await O.ch.claimWin().then(v => v, e => ({threw: e.why}));
  if(!r.result || r.result.how !== "forfeit" || r.result.winner !== O.ch.seat) return bad.concat("a due claim did not answer the forfeit: " + JSON.stringify(r));
  if(x.rat.results.size !== 1 || x.rat.records !== 1) bad.push("the claim recorded " + x.rat.results.size);
  if(JSON.stringify(O.ch.rank().result && O.ch.rank().result.how) !== "\"forfeit\"") bad.push("the claimant's rank() does not carry the forfeit");
  await x.world.settle([W.ch, O.ch]);
  const rw = await W.ch.result(4, 0);
  if(!rw || rw.how !== "forfeit" || rw.winner !== O.ch.seat) bad.push("the absent phone cannot read the forfeit: " + JSON.stringify(rw));
  if(!W.sess.state().over && !(x.world.row(x.A.code).over)) bad.push("the absent phone's game is not over");
  if(O.ch.clock() !== null || W.ch.clock() !== null) bad.push("a clock still shows after the game ended");
  const again = await O.ch.claimWin().then(() => null, e => e);
  if(!again || again.why !== "claim-over" || x.rat.records !== 1) bad.push("a second claim was not refused: " + (again && again.why));
  /* a casual table: no clock, the claim is refused in the phone's word */
  const c = await seat(M, {salt: "bc", casual: true});
  await Promise.all(c.phones.map(p => p.ch.heal()));
  if(c.A.ch.clock() !== null || c.B.ch.clock() !== null) bad.push("a casual phone shows a clock");
  const cr = await c.B.ch.claimWin().then(() => null, e => e);
  if(!cr || cr.why !== "claim-casual") bad.push("a casual claim was not refused in its word: " + (cr && cr.why));
  [x.A, x.B, c.A, c.B].forEach(p => p.ch.close());
  return bad;
}
test("(b) A CLAIM — early (told the time left), by the waited-on phone, due (the claimant reads the forfeit; the absent phone reads it by asking), repeated, on a casual table", async () => {
  assert.deepEqual(await guard(claimFailures(ST), 40000), []);
});
test("SABOTAGE (b): a phone that cannot claim, or never reads the result of its claim, is seen", async () => {
  for(const [what, edits] of [
    ["the claim never sent", [["const r = await call(T, {op: \"claim\", table: code, seat, key});", "const r = {ok: false, refused: \"claim-idle\"};"]]],
    ["the claim's result ignored", [["if(r.ok){ readRank(r); if(r.result) readRank({result: r.result}); ingest(r.frames);", "if(r.ok){ ingest(r.frames);"]]],
    ["a refusal's word lost", [["if(/^claim-/.test(String(r.refused))) throw fail(r.refused);", ""]]]])
    assert.ok((await guard(claimFailures(stCopy(edits)), 40000)).length >= 1, "the sabotage must be seen: " + what);
});

async function closeFailures(M){
  const bad = [], x = await seat(M, {salt: "c"});
  if(!x.A.sess || x.A.sess.status() !== "ready") return ["the game did not start"];
  const code = x.A.code, creator = x.A.ch.seat;
  const r = await M.closeTable({transport: x.world.transport("closer"), identity: x.pA.identity, sleep: PH.FAST.sleep}, code).then(v => v, e => ({threw: e.why}));
  if(!r.closed || r.conceded !== true || !r.result || r.result.how !== "concession" || r.result.winner !== 1 - creator || r.result.change.length !== 2) bad.push("a started ranked close did not answer as a concession with the result: " + JSON.stringify(r));
  if(x.rat.results.size !== 1) bad.push("the close recorded " + x.rat.results.size);
  await x.world.settle([x.A.ch, x.B.ch]);
  const rb = await x.bySeat(1 - creator).ch.result(4, 0);
  if(!rb || rb.winner !== 1 - creator) bad.push("the opponent's phone cannot read the ending: " + JSON.stringify(rb));
  /* a casual table's close is the old one */
  const c = await seat(M, {salt: "cc", casual: true});
  const cr = await M.closeTable({transport: c.world.transport("closer"), identity: c.pA.identity, sleep: PH.FAST.sleep}, c.A.code).then(v => v, e => ({threw: e.why}));
  if(JSON.stringify(cr) !== "{\"closed\":true}" || c.rat.results.size !== 0) bad.push("a casual close is not {closed:true}: " + JSON.stringify(cr));
  [x.A, x.B, c.A, c.B].forEach(p => p.ch.close());
  return bad;
}
test("(c) CLOSE — a started ranked table closed by its creator answers as their concession with the result; a casual close answers {closed:true}", async () => {
  assert.deepEqual(await guard(closeFailures(ST), 40000), []);
});
test("SABOTAGE (c): a phone that drops the concession from the close's answer is seen", async () => {
  assert.ok((await guard(closeFailures(stCopy([["if(r.ok) return r.conceded === true ?", "if(r.ok) return false ?"]])), 40000)).length >= 1);
});
