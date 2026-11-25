/* test/serverladderphone.test.js — THE PHONE'S LADDER CALL (SERVER S5.3).

   engine/servertable.js `ladder(o)` over the fake wire and the real referee (test/helpers/servertransport.js), with the fake sign-in provider and the ratings +
   ladder backends. Each drill has its sabotage:
     (a) THE ANSWER, AS THE SCREEN READS IT — rows, recent results, the caller's line; nothing else.
     (b) A PUBLIC CALL — with no identity the request carries none and asks the provider nothing; a phone with a sign-in sends it and gets its line; a token that
         is refused, a sign-in that throws or yields nothing still answer the list (without a line).
     (c) FAILURES ARE THE PHONE'S OWN WORD — a dead server, a function that is not there, a refusal, an answer that is not a ladder: `unavailable`, never a hang or a
         half list. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const F = require("./helpers/serverfakes.js");
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
const guard = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("the drill hung")), 15000))]).catch(e => ["threw: " + (e && (e.why || e.message))]);

function ladderWorld(){
  const world = makeWorld({seedKey: "lp"}), idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp);
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  Object.assign(world.deps, rat.deps(), lad.deps());
  const player = (id, name, rating, games) => { const tok = idp.issue(id); if(name) idp.rename(id, name, world.server.nameFold(name)); if(rating !== undefined) rat.set(id, rating), (rat.rt.get(id).games = games, rat.rt.get(id).wins = games);
    return {id, tok, identity: {token: async () => tok}}; };
  return {world, idp, rat, lad, player};
}
const sent = w => w.world.outbound.map(e => JSON.parse(e.text)).filter(e => e.op === "ladder");

async function answerFailures(M){
  const bad = [], w = ladderWorld();
  const A = w.player("p-a", "Alpha Player", 1500, 6), B = w.player("p-b", "Bravo Player", 1300, 3), C = w.player("p-c", "Charlie Three", 1250, 1);
  w.rat.record({game: "g1", table: "T1", players: ["p-a", "p-b"], names: ["Alpha Player", "Bravo Player"], heroes: ["kayo", "dash"], winner: 0, how: "life", turns: 5, build: null, started: 0, ended: 1700000000500});
  const r = await M.ladder({transport: w.world.transport("L"), identity: B.identity});
  const eq = (what, got, want) => { if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(what + ": " + JSON.stringify(got) + ", wanted " + JSON.stringify(want)); };
  eq("the keys", Object.keys(r).sort(), ["cap", "floor", "ladder", "recent", "you"]);
  eq("floor and cap", [r.floor, r.cap], [3, 50]);
  eq("the names, in order", r.ladder.map(x => x.name), ["Alpha Player", "Bravo Player"]);
  eq("a row", r.ladder[1], {rank: 2, name: "Bravo Player", rating: r.ladder[1].rating, games: 4, wins: 3, losses: 1, draws: 0});
  eq("a recent result", r.recent, [{names: ["Alpha Player", "Bravo Player"], heroes: ["kayo", "dash"], winner: 0, how: "life", at: 1700000000500}]);
  eq("the caller's line", [r.you.name, r.you.listed, r.you.rank, r.you.toGo, r.you.games], ["Bravo Player", true, 2, 0, 4]);
  const c = await M.ladder({transport: w.world.transport("L"), identity: C.identity});
  eq("a provisional caller", [c.you.listed, c.you.rank, c.you.toGo], [false, null, 2]);
  /* the whole thing as text holds no id or token */
  const hay = JSON.stringify([r, c]); for(const x of ["p-a", "p-b", "p-c", A.tok, B.tok, C.tok]) if(hay.indexOf(x) >= 0) bad.push("the phone's answer holds " + x);
  return bad;
}
test("(a) THE ANSWER, AS THE SCREEN READS IT — rows, recent results and the caller's line, and no id or token", async () => {
  assert.deepEqual(await guard(answerFailures(ST)), []);
});
test("SABOTAGE (a): a phone that drops the caller's line, or the recent list, or passes an unknown key through is seen", async () => {
  for(const [what, edits] of [["the line dropped", [["  return {floor: r.floor, cap: r.cap, ladder: rows, recent, you, ...(mine ? {mine} : {})};", "  return {floor: r.floor, cap: r.cap, ladder: rows, recent, you: null};"]]],
      ["the recent list dropped", [["  return {floor: r.floor, cap: r.cap, ladder: rows, recent, you, ...(mine ? {mine} : {})};", "  return {floor: r.floor, cap: r.cap, ladder: rows, recent: [], you};"]]],
      ["the raw answer passed through", [["  return {floor: r.floor, cap: r.cap, ladder: rows, recent, you, ...(mine ? {mine} : {})};", "  return r;"]]]])
    assert.ok((await guard(answerFailures(stCopy(edits)))).length >= 1, "the sabotage must be seen: " + what);
});

async function publicFailures(M){
  const bad = [], w = ladderWorld();
  const A = w.player("p-a", "Alpha Player", 1500, 6), N = w.player("p-n");
  const T = () => w.world.transport("L");
  const before = w.idp.calls;
  const r0 = await M.ladder({transport: T()});
  if(!r0.ladder.length || r0.you !== null) bad.push("no identity: " + JSON.stringify(r0.you));
  if(sent(w).some(e => "identity" in e) || w.idp.calls !== before) bad.push("a call with no identity carried one or asked the provider");
  const r1 = await M.ladder({transport: T(), identity: A.identity});
  if(!r1.you || r1.you.rank !== 1 || sent(w).filter(e => e.identity && e.identity.token === A.tok).length !== 1) bad.push("a phone with a sign-in did not send it exactly once and get its line");
  for(const [what, identity] of [["a token the server does not know", {token: async () => "jwt.forged"}], ["a sign-in that throws", {token: async () => { throw new Error("no sign-in"); }}],
      ["a sign-in that yields nothing", {token: async () => null}], ["an identity with no token function", {}]]){
    const r = await M.ladder({transport: T(), identity}).catch(e => ({threw: e.why}));
    if(r.threw || !r.ladder || r.ladder.length !== 1 || r.you !== null) bad.push(what + " did not answer the list alone: " + JSON.stringify(r.threw || r.you));
  }
  const un = await M.ladder({transport: T(), identity: N.identity});
  if(!un.you || un.you.listed !== false || un.you.name !== null || un.you.toGo !== 3) bad.push("a signed-in player with no name and no games: " + JSON.stringify(un.you));
  return bad;
}
test("(b) A PUBLIC CALL — no identity sent and the provider never asked; a sign-in is sent once and answered with the line; a refused, failing or missing sign-in still gets the list", async () => {
  assert.deepEqual(await guard(publicFailures(ST)), []);
});
test("SABOTAGE (b): a call that always signs in, one that fails with the sign-in, one that never sends it are seen", async () => {
  for(const [what, edits] of [["an identity sent even when there is none (an empty token)", [["{op: \"ladder\", ...(typeof token === \"string\" && token ? {identity: {token}} : {})}", "{op: \"ladder\", identity: {token: token || \"\"}}"]]],
      ["a sign-in that throws fails the call", [["try { token = await o.identity.token(); } catch(_){ token = null; } }\n  const r = await call(T, {op: \"ladder\"", "token = await o.identity.token(); }\n  const r = await call(T, {op: \"ladder\""]]],
      ["the sign-in is never sent", [["{op: \"ladder\", ...(typeof token === \"string\" && token ? {identity: {token}} : {})}", "{op: \"ladder\"}"]]]])
    assert.ok((await guard(publicFailures(stCopy(edits)))).length >= 1, "the sabotage must be seen: " + what);
});

async function failureFailures(M){
  const bad = [], w = ladderWorld();
  w.player("p-a", "Alpha Player", 1500, 6);
  const why = async (what, f, want) => { const r = await f().then(() => "answered", e => e && e.why); if(r !== want) bad.push(what + " -> " + r + ", wanted " + want); };
  w.world.fault.dead(true); await why("a dead server", () => M.ladder({transport: w.world.transport("L")}), "unavailable"); w.world.fault.dead(false);
  w.world.fault.notFound(true); await why("a function that is not there", () => M.ladder({transport: w.world.transport("L")}), "unavailable"); w.world.fault.notFound(false);
  await why("no transport", () => M.ladder({}), "unavailable");
  const bareDeps = {...w.world.deps}; delete w.world.deps.ladder;
  await why("a function with no ladder", () => M.ladder({transport: w.world.transport("L")}), "unavailable"); w.world.deps.ladder = bareDeps.ladder;
  const fake = ans => ({post: async () => ans, subscribe: () => () => {}});
  for(const [what, ans] of [["an answer that is not a ladder", {ok: true, ladder: "x", recent: [], floor: 3, cap: 50}], ["a row with no name", {ok: true, floor: 3, cap: 50, recent: [], ladder: [{rank: 1, rating: 1, games: 3, wins: 3, losses: 0, draws: 0}]}], ["no floor", {ok: true, cap: 50, recent: [], ladder: []}], ["not even an answer", "hello"]])
    await why(what, () => M.ladder({transport: fake(ans)}), "unavailable");
  return bad;
}
test("(c) FAILURES ARE THE PHONE'S OWN WORD — a dead server, a missing function, no ladder in the function, an answer that is not a ladder: unavailable", async () => {
  assert.deepEqual(await guard(failureFailures(ST)), []);
});
test("SABOTAGE (c): a phone that shows a half answer is seen", async () => {
  assert.ok((await guard(failureFailures(stCopy([["  if(!r.ladder.every(rec)) throw bad();", ""]])))).length >= 1);
});
