/* test/serverrankedphone.test.js — THE PHONE AT A RANKED TABLE (SERVER S5.1).

   engine/servertable.js over the fake wire and the real referee (test/helpers/servertransport.js), with the fake sign-in provider and the ratings
   backend that behaves like 006_ratings.sql. Each drill has its sabotage:

     (a) A RANKED TABLE IS ASKED FOR AT CREATE, and both phones read that it is ranked and each other's rating (`rank()`, `onRank`).
     (b) THE REFUSALS ARE THE PHONE'S OWN WORDS — ranked-signin, ranked-name, identity (no casual fallback for a ranked table).
     (c) THE RESULT REACHES BOTH PHONES — the one that made the ending move from its own answer, the other by asking (`result()`); the numbers are the
         Elo ones; a casual table answers null and asks nothing.
     (d) whoAmI / setName carry the rating and the record. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const PH = require("./helpers/serverphone.js");
const {makeWorld} = require("./helpers/servertransport.js");
const ST = require("../engine/servertable.js");
const L = require("../engine/lobby.js");

const ROOT = path.join(__dirname, "..");
const STSRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
function stCopy(edits){
  let src = STSRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "engine", p)), undefined);
  return m.exports;
}
const guard = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("the drill hung")), ms || 15000))]).catch(e => ["threw: " + (e && (e.why || e.message))]);

function rankedWorld(o){
  o = o || {};
  const world = makeWorld({seedKey: (o.seedKey || "rp")}), idp = F.memIdentity(), rat = F.withRatings(o.rat);
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  Object.assign(world.deps, rat.deps());
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, world.server.nameFold(name)); return {id, tok, identity: {token: async () => tok}}; };
  return {world, idp, rat, player};
}
const opts = (world, name, extra) => ({transport: world.transport(name), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, keep: PH.memKeep(), ...(extra || {})});
/* two phones, each a player, to a running game (the lobby and the deal, as the page runs them) */
async function seatPlayers(M, w, P, Q, o){
  o = o || {};
  const rand = T.seeded("rp-phones|" + (o.salt || ""));
  const mk = (n, h, pl, extra) => PH.makePhone(w.world, n, {hero: h, rand, ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: pl.identity, ...(extra || {})});
  const A = mk("A", "blaze", P, o.casual ? {} : {ranked: true}), B = mk("B", "dorinthea", Q);
  const rA = [], rB = []; A.rank = rA; B.rank = rB;
  await A.connect("create"); await B.connect("join", A.code);
  await w.world.settle([A.ch, B.ch]);
  for(let i = 0; i < 6 && !(A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready"); i++){ await w.world.settle([A.ch, B.ch]); }
  return {A, B};
}

/* ---------------------------------------------------------------------------------------------- (a), (c) */
async function playedFailures(M){
  const bad = [], w = rankedWorld({seedKey: "rp-a"});
  const P = w.player("P-rp-zero", "Dawn Smith"), Q = w.player("P-rp-one", "Rival One");
  w.rat.set("P-rp-zero", 1300);
  const seen = [];
  const rand = T.seeded("rp-phones|a");
  const A = PH.makePhone(w.world, "A", {hero: "blaze", rand, ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: P.identity, ranked: true});
  const B = PH.makePhone(w.world, "B", {hero: "dorinthea", rand, ST: M, throws: [["rock", "rock"], ["paper", "rock"]], identity: Q.identity});
  await A.connect("create");
  if(JSON.stringify(A.ch.rank()) !== JSON.stringify({ranked: true, ratings: [1300, null], result: null})) bad.push("the opener's rank() after sitting: " + JSON.stringify(A.ch.rank()));
  await B.connect("join", A.code);
  if(B.ch.rank().ranked !== true || JSON.stringify(B.ch.rank().ratings) !== "[1300,1200]") bad.push("the joiner does not read a ranked lobby with both ratings: " + JSON.stringify(B.ch.rank()));
  await w.world.settle([A.ch, B.ch]);
  for(let i = 0; i < 6 && !(A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready"); i++) await w.world.settle([A.ch, B.ch]);
  if(JSON.stringify(A.ch.rank().ratings) !== "[1300,1200]") bad.push("the opener never learned the joiner's rating: " + JSON.stringify(A.ch.rank()));
  if(!A.sess || A.sess.status() !== "ready") return bad.concat("the game did not start");
  const row = w.world.row(A.code);
  if(row.v !== 5 || row.ranked !== true) bad.push("the table is not a ranked row");
  /* seat 1 (the joiner) concedes: the favourite (1300) wins -> 1312 / 1188 */
  B.sess.submit({t: "concede"});
  await w.world.settle([A.ch, B.ch]);
  const rb = B.ch.rank().result;
  if(!rb || rb.winner !== 0 || rb.how !== "concession" || JSON.stringify(rb.change) !== JSON.stringify([{from: 1300, to: 1312}, {from: 1200, to: 1188}])) bad.push("the conceding phone's own answer did not carry the result: " + JSON.stringify(rb));
  const ra = await A.ch.result(4, 0);
  if(!ra || JSON.stringify(ra.change) !== JSON.stringify([{from: 1300, to: 1312}, {from: 1200, to: 1188}]) || ra.winner !== 0) bad.push("the other phone could not read the result: " + JSON.stringify(ra));
  if(w.rat.results.size !== 1 || w.rat.records !== 1) bad.push("the game recorded " + w.rat.results.size + " results in " + w.rat.records + " calls");
  /* asking again moves nothing and asks the table no more */
  const calls = w.world.calls; await A.ch.result(3, 0); await B.ch.result(3, 0);
  if(w.world.calls !== calls) bad.push("a phone that already holds its result kept asking the table");
  /* an onRank callback told the screen */
  A.ch.close(); B.ch.close();
  return bad;
}
test("(a)(c) A RANKED TABLE IS ASKED FOR AT CREATE — both phones read ranked and both ratings, and after a concession both read the result (one from its own answer, one by asking)", async () => {
  assert.deepEqual(await guard(playedFailures(ST), 30000), []);
});
test("SABOTAGE (a)(c): a phone that never asks for ranked, ignores the ratings, never reads the result, or cannot ask for it is seen", async () => {
  for(const [what, edits] of [
    ["ranked not asked for", [["return {post: env => T.post(env && env.op === \"create\" ? {...env, ranked: true} : env),", "return {post: env => T.post(env),"]]],
    ["ratings ignored", [["if(Array.isArray(v.ratings) && v.ratings.length === 2){", "if(false){"]]],
    ["the result in an answer ignored", [["const r = v.result;\n", "const r = null;\n"]]],
    ["no way to ask for the result", [["        await heal();\n        if(result) return clone(result);", "        if(result) return clone(result);"]]]])
    assert.ok((await guard(playedFailures(stCopy(edits)), 30000)).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (b) */
async function refusalFailures(M){
  const bad = [], w = rankedWorld({seedKey: "rp-b"});
  const named = w.player("P-rb-named", "Dawn Smith"), nameless = w.player("P-rb-nameless"), other = w.player("P-rb-other", "Rival One");
  const why = async f => { try { await f(); return "no refusal"; } catch(e){ return e.why; } };
  const rows0 = w.world.store.rows.size;
  if(await why(() => M.startTable(opts(w.world, "X1", {ranked: true}))) !== "ranked-signin") bad.push("a ranked open with no sign-in at all was not 'ranked-signin'");
  if(await why(() => M.startTable(opts(w.world, "X2", {ranked: true, identity: {token: async () => null}}))) !== "ranked-signin") bad.push("a ranked open with a sign-in that gave no token was not 'ranked-signin'");
  if(await why(() => M.startTable(opts(w.world, "X3", {ranked: true, identity: nameless.identity}))) !== "ranked-name") bad.push("a ranked open by a nameless player was not 'ranked-name'");
  if(await why(() => M.startTable(opts(w.world, "X4", {ranked: true, identity: {token: async () => "jwt.forged"}}))) !== "identity") bad.push("a ranked open with a refused sign-in was not 'identity' (it must not fall back to a casual table)");
  if(w.world.store.rows.size !== rows0) bad.push("a refused ranked open wrote a table (the casual fallback)");
  const a = await M.startTable(opts(w.world, "A", {ranked: true, identity: named.identity}));
  if(await why(() => M.sitAt(opts(w.world, "J1", {code: a.code}))) !== "ranked-signin") bad.push("a join with no sign-in was not 'ranked-signin'");
  if(await why(() => M.sitAt(opts(w.world, "J2", {code: a.code, identity: nameless.identity}))) !== "ranked-name") bad.push("a nameless join was not 'ranked-name'");
  if(await why(() => M.sitAt(opts(w.world, "J3", {code: a.code, identity: {token: async () => "jwt.forged"}}))) !== "ranked-signin") bad.push("a join whose sign-in is refused (it falls back to casual) was not 'ranked-signin'");
  const b = await M.sitAt(opts(w.world, "B", {code: a.code, identity: other.identity}));
  if(b.seat !== 1 || b.rank().ranked !== true) bad.push("a named player could not sit at the ranked table");
  a.close(); b.close();
  return bad;
}
test("(b) THE REFUSALS ARE THE PHONE'S OWN WORDS — ranked-signin, ranked-name and identity; a refused sign-in never falls back to a casual table for a ranked open", async () => {
  assert.deepEqual(await guard(refusalFailures(ST)), []);
});
test("SABOTAGE (b): a phone that reads the refusals as 'unavailable', or falls back to a casual table for a ranked open, is seen", async () => {
  for(const [what, edits] of [
    ["ranked-signin read as unavailable", [["\"ranked-signin\": \"ranked-signin\", ", ""]]],
    ["ranked-name read as unavailable", [["\"ranked-name\": \"ranked-name\", ", ""]]],
    ["a refused sign-in falls back to casual for a ranked open", [["else if(r.refused === \"identity\" && o.ranked === true) throw fail(\"identity\", \"refused: identity\");", ""]]]])
    assert.ok((await guard(refusalFailures(stCopy(edits)))).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- casual */
async function casualPhoneFailures(M){
  const bad = [], w = rankedWorld({seedKey: "rp-c"});
  const P = w.player("P-rc-zero", "Dawn Smith"), Q = w.player("P-rc-one", "Rival One");
  const {A, B} = await seatPlayers(M, w, P, Q, {casual: true, salt: "c"});
  if(A.ch.rank().ranked || B.ch.rank().ranked || w.world.row(A.code).ranked) bad.push("a casual table reads as ranked");
  if(!A.sess || A.sess.status() !== "ready") return bad.concat("the casual game did not start");
  B.sess.submit({t: "concede"}); await w.world.settle([A.ch, B.ch]);
  const calls = w.world.calls;
  if(await A.ch.result(3, 0) !== null || await B.ch.result(3, 0) !== null) bad.push("a casual table produced a result");
  if(w.world.calls !== calls) bad.push("a casual phone asked the table for a result");
  if(w.rat.records !== 0 || w.rat.lookups !== 0) bad.push("a casual game touched the ratings");
  A.ch.close(); B.ch.close();
  return bad;
}
test("(c) A CASUAL TABLE READS AS CASUAL — rank() is {ranked:false}, result() is null and asks the table nothing, the ratings are never touched", async () => {
  assert.deepEqual(await guard(casualPhoneFailures(ST), 30000), []);
});
test("SABOTAGE (c): a phone that asks a casual table for a result is seen", async () => {
  assert.ok((await guard(casualPhoneFailures(stCopy([["if(closed || !ranked) break;", "if(closed) break;"]])), 30000)).length >= 1);
});

/* ---------------------------------------------------------------------------------------------- (d) */
async function meFailures(M){
  const bad = [], w = rankedWorld({seedKey: "rp-d"});
  const P = w.player("P-rd-zero", "Dawn Smith");
  const r = await M.whoAmI({transport: w.world.transport("W"), identity: P.identity});
  if(JSON.stringify(r) !== JSON.stringify({name: "Dawn Smith", rating: 1200, games: 0, wins: 0, losses: 0, draws: 0})) bad.push("whoAmI for a fresh player: " + JSON.stringify(r));
  w.rat.set("P-rd-zero", 1250);
  const n = await M.setName({transport: w.world.transport("W"), identity: P.identity}, "Dawn Prime");
  if(n.name !== "Dawn Prime" || n.rating !== 1250) bad.push("setName did not carry the rating: " + JSON.stringify(n));
  /* a function that cannot read ratings: the v6.31 answer */
  const w2 = rankedWorld({seedKey: "rp-d2"}); delete w2.world.deps.rating; delete w2.world.deps.record;
  const Q = w2.player("P-rd-one", "Rival One");
  const r2 = await M.whoAmI({transport: w2.world.transport("W"), identity: Q.identity});
  if(JSON.stringify(r2) !== JSON.stringify({name: "Rival One"})) bad.push("without ratings whoAmI is not v6.31's: " + JSON.stringify(r2));
  return bad;
}
test("(d) whoAmI AND setName CARRY THE RATING AND THE RECORD — 1200 and no games for a fresh player; v6.31's answer when the function cannot read ratings", async () => {
  assert.deepEqual(await guard(meFailures(ST)), []);
});
test("SABOTAGE (d): a phone that drops the rating from whoAmI is seen", async () => {
  assert.ok((await guard(meFailures(stCopy([["    ...(Number.isInteger(r.rating) ? {rating: r.rating,", "    ...(false ? {rating: r.rating,"]])))).length >= 1);
});
