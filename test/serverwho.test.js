/* test/serverwho.test.js — THE PHONE SIGNS IN, SITS DOWN AS A PLAYER, AND HAS A NAME (SERVER S4.2).

   engine/servertable.js, from the phone's side, against the S1 referee and its fakes (no account, no network):

     (a) THE SIGN-IN (`supabaseIdentity`, a fake auth service behind `fetch`): the first ask makes ONE anonymous user and keeps
         the session; a fresh session costs no request; an old one is traded with its refresh token; a REFUSED refresh makes a
         new user; a network failure or a 5xx is NOT a refusal (null now, the session kept); callers share one request.
     (b) A SIGNED-IN PHONE'S JOIN binds its seat to the player (the stored row's owners), reads `owned`, and both phones read
         both display names — the opener learns the joiner's when the joiner sits down. The token is in nothing handed up.
     (c) NO SIGN-IN, NO PROBLEM: a null token, a throwing sign-in and a token the referee refuses each sit down casually.
     (d) THE SAME PLAYER ON A SECOND PHONE takes the seat (last one wins, RULING (user, 2026-11-14)); the first phone's
         channel closes saying "taken" — by the sealed push, and by its next request when the push is lost.
     (e) THE NAME CALLS (`whoAmI`, `setName`): the referee's reasons reach the caller; a taken name is its own answer.
   Each drill is run against a broken copy and must fail there. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const F = require("./helpers/serverfakes.js");
const {makeWorld} = require("./helpers/servertransport.js");
const PH = require("./helpers/serverphone.js");
const ST = require("../engine/servertable.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
function stCopy(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "engine", p)), undefined);
  return m.exports;
}
const guard = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), ms || 4000))]);
const whyOf = p => p.then(() => null, e => e.why + (e.reason ? ":" + e.reason : ""));

/* ---------------------------------------------------------------------------------------------- (a) */
/* a stand-in for the project's auth service: counts every request, hands out numbered sessions */
function fakeAuth(){
  const A = {reqs: [], users: 0, mode: "ok", live: new Set()};
  A.fetch = async (url, init) => {
    const body = JSON.parse(init.body), kind = /grant_type=refresh_token/.test(url) ? "refresh" : /\/auth\/v1\/signup$/.test(url) ? "signup" : "?";
    A.reqs.push({kind, url, apikey: init.headers.apikey, body});
    await new Promise(r => setImmediate(r));
    /* the outage hits the REFRESH route only: a sign-up would still work, so a sign-in that reads the outage as a refusal makes a new player */
    if(A.mode === "down" && kind === "refresh") throw new Error("fetch failed");
    if(A.mode === "500" && kind === "refresh") return {ok: false, status: 503, json: async () => ({})};
    const mint = () => { const n = ++A.users, r = "refresh-" + n; A.live.add(r); return {ok: true, status: 200, json: async () => ({access_token: "access-" + n, refresh_token: r, expires_in: 3600, user: {is_anonymous: true}})}; };
    if(kind === "signup") return mint();
    if(kind === "refresh"){ if(!A.live.has(body.refresh_token)) return {ok: false, status: 400, json: async () => ({error_code: "refresh_token_not_found"})}; A.live.delete(body.refresh_token); return mint(); }
    return {ok: false, status: 404, json: async () => ({})};
  };
  return A;
}
async function signInFailures(M){
  const bad = [], A = fakeAuth(), keep = PH.memKeep(); let clock = 1e12;
  const cfg = {url: "https://project.example/", key: "pub-key", fetch: A.fetch};
  const id = M.supabaseIdentity(cfg, keep, {now: () => clock});
  if(id.known()) bad.push("a phone that never signed in says it has");
  const [t1, t1b] = await Promise.all([id.token(), id.token()]);
  if(t1 !== "access-1" || t1b !== "access-1") bad.push("the first ask did not answer one session to both callers: " + t1 + "," + t1b);
  if(A.reqs.length !== 1 || A.reqs[0].kind !== "signup" || A.reqs[0].apikey !== "pub-key" || A.reqs[0].url !== "https://project.example/auth/v1/signup") bad.push("the first ask was not ONE anonymous sign-up with the publishable key: " + JSON.stringify(A.reqs.map(r => r.kind)));
  if(!id.known() || keep.get("who.id", null).r !== "refresh-1") bad.push("the session was not kept on the phone");
  clock += 50 * 60 * 1000;                                   /* 10 minutes left: still good */
  if(await id.token() !== "access-1" || A.reqs.length !== 1) bad.push("a session with time left cost a request");
  clock += 9 * 60 * 1000;                                    /* 1 minute left: trade it */
  if(await id.token() !== "access-2" || A.reqs.length !== 2 || A.reqs[1].kind !== "refresh" || A.reqs[1].body.refresh_token !== "refresh-1") bad.push("an old session was not traded with its refresh token");
  if(A.users !== 2 || keep.get("who.id", null).r !== "refresh-2") bad.push("the traded session was not kept");
  /* the service is down, then answers 5xx: NOT a verdict — null now, the session untouched, no new user */
  clock += 61 * 60 * 1000;
  for(const mode of ["down", "500"]){
    A.mode = mode; const before = A.users;
    if(await id.token() !== null) bad.push("with the auth service " + mode + " a token was answered");
    if(A.users !== before || keep.get("who.id", null).r !== "refresh-2") bad.push("with the auth service " + mode + " the kept session was replaced (the player would be lost)");
  }
  A.mode = "ok";
  if(await id.token() !== "access-3" || A.reqs[A.reqs.length - 1].kind !== "refresh") bad.push("the kept session did not work once the service was back");
  /* the refresh is REFUSED (the session is gone on the server): a new anonymous user, the only way back before a recovery code */
  clock += 61 * 60 * 1000; A.live.clear(); const n0 = A.reqs.length;
  if(await id.token() !== "access-4") bad.push("a refused refresh did not end in a new sign-in");
  if(A.reqs.slice(n0).map(r => r.kind).join() !== "refresh,signup") bad.push("a refused refresh was not followed by exactly one sign-up: " + A.reqs.slice(n0).map(r => r.kind).join());
  /* nothing configured: no request, null */
  const none = M.supabaseIdentity({url: "", key: "k", fetch: A.fetch}, PH.memKeep()); const n1 = A.reqs.length;
  if(await none.token() !== null || A.reqs.length !== n1) bad.push("a phone with no project address asked something");
  /* the door: shut, or sign-in switched off, there is no identity at all; a drive's own one wins */
  if(M.defaultIdentity({on: false, url: "u", key: "k"}, keep, {}) !== null || M.defaultIdentity({on: true, signIn: false, url: "u", key: "k"}, keep, {}) !== null) bad.push("a shut door still signs in");
  const mine = {token: async () => "x"};
  if(M.defaultIdentity({on: false}, keep, {__dawnServerIdentity: mine}) !== mine) bad.push("a drive's own sign-in was not used");
  if(typeof M.defaultIdentity({on: true, url: "u", key: "k"}, keep, {}).token !== "function") bad.push("an open door has no sign-in");
  return bad;
}
test("(a) THE SIGN-IN — one anonymous user, kept; fresh costs nothing; old is traded; a refused refresh is a new user; an outage is never a refusal", async () => {
  assert.deepEqual(await guard(signInFailures(ST)), []);
});
test("SABOTAGE (a): a sign-in that reads an outage as a refusal, never reuses a session, or shares no flight is seen", async () => {
  const sabs = [
    [["if(!resp || (resp.status !== 400 && resp.status !== 401 && resp.status !== 403)) return null;", ""]],
    [["if(rec && typeof rec.a === \"string\" && rec.a && Number(rec.exp) - 120000 > now()) return rec.a;", ""]],
    [["token(){ if(!flight){", "token(){ if(true){"]],
    [["let resp; try { resp = await ask(\"/auth/v1/token?grant_type=refresh_token\", {refresh_token: rec.r}); } catch(_){ return null; }", "let resp; try { resp = await ask(\"/auth/v1/token?grant_type=refresh_token\", {refresh_token: rec.r}); } catch(_){ resp = null; }\n      if(!resp) resp = {ok: false, status: 400};"]]];
  for(const s of sabs) assert.ok((await guard(signInFailures(stCopy(s)))).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});

/* ---------------------------------------------------------------------------------------------- (b)–(d) */
/* a world whose referee knows players (the fake provider + name registry), and phones that are players */
function idWorld(o){
  const world = makeWorld({seedKey: (o && o.seedKey) || "who"}), idp = F.memIdentity();
  if(!(o && o.noProvider)){ world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f); }
  const asked = [];
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, world.server.nameFold(name)); return {tok, identity: {token: async () => { asked.push(id); return tok; }}}; };
  const opts = (M, name, extra) => ({transport: world.transport(name), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, keep: PH.memKeep(), ...(extra || {})});
  return {world, idp, player, opts, asked};
}
const handedUp = ch => JSON.stringify([ch.events(), ch.report(), ch.names(), ch.status(), ch.closedWhy()]);

async function seatedFailures(M){
  const bad = [], {world, player, opts, asked} = idWorld({seedKey: "who-b"});
  const P = player("P-zero-id", "Dawn Smith"), Q = player("P-one-id", "Rival One");
  const framesA = [], framesB = [], namesA = [];
  const a = await M.startTable(opts(M, "A", {identity: P.identity, onNames: n => namesA.push(n)}));
  a.listen(f => framesA.push(f));
  await world.settle([a]);
  if(asked.join() !== "P-zero-id") bad.push("opening a table did not sign in exactly once (lazily): " + asked.join());
  if(a.owned() !== true) bad.push("the opener's seat does not read as owned");
  if(JSON.stringify(a.names()) !== JSON.stringify(["Dawn Smith", null])) bad.push("the opener does not read its own name: " + JSON.stringify(a.names()));
  const calls0 = world.calls;
  const b = await M.sitAt(opts(M, "B", {code: a.code, identity: Q.identity}));
  b.listen(f => framesB.push(f));
  if(JSON.stringify(b.names()) !== JSON.stringify(["Dawn Smith", "Rival One"]) || b.owned() !== true) bad.push("the joiner does not read both names at once: " + JSON.stringify(b.names()));
  /* the joiner speaks (the lobby hello): the opener hears its peer and asks once who that is */
  b.send({ch: "lobby", m: require("../engine/lobby.js").hello(1, require("./helpers/judgetable.js").BUILD)});
  await world.settle([a, b]);
  if(JSON.stringify(a.names()) !== JSON.stringify(["Dawn Smith", "Rival One"])) bad.push("the opener never learned the joiner's name: " + JSON.stringify(a.names()));
  if(JSON.stringify(namesA[namesA.length - 1]) !== JSON.stringify(["Dawn Smith", "Rival One"])) bad.push("onNames did not tell the screen");
  const row = world.row(a.code);
  if(row.v !== 3 || JSON.stringify(row.owners) !== JSON.stringify(["P-zero-id", "P-one-id"])) bad.push("the stored row does not bind both seats to their players: " + JSON.stringify(row.owners));
  /* every join that dealt a seat carried the identity; none carried a name */
  const joins = world.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "join" && e.claim);
  if(joins.length !== 2 || !joins.every(j => j.identity && typeof j.identity.token === "string" && !("name" in j.identity))) bad.push("the unkeyed joins did not carry {identity:{token}} alone");
  /* the token and the player id are in nothing the module hands up, and in no frame either phone received */
  const up = handedUp(a) + handedUp(b) + JSON.stringify([framesA, framesB]);
  for(const x of [P.tok, Q.tok, "P-zero-id", "P-one-id"]) if(up.indexOf(x) >= 0) bad.push("a private identity string was handed up: " + x);
  /* a casual drill's request count is untouched: with no identity the peer's arrival asks nothing extra */
  void calls0;
  a.close(); b.close();
  return bad;
}
test("(b) A SIGNED-IN PHONE SITS DOWN AS A PLAYER — owners in the row, `owned`, both names on both phones, the token handed to nobody", async () => {
  assert.deepEqual(await guard(seatedFailures(ST), 8000), []);
});
test("SABOTAGE (b): a join that drops the identity, a channel deaf to names, or one that never asks who sat down is seen", async () => {
  const sabs = [
    [["claim, ...(token ? {identity: {token}} : {})}", "claim}"]],
    [["  readNames(who && who.names);\n", ""]],
    [["if(started && wantNames && peerHeard && !namesAsked && names[peerSeat] == null){", "if(false){"]]];
  for(const s of sabs) assert.ok((await guard(seatedFailures(stCopy(s)), 8000)).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});

async function casualFailures(M){
  const bad = [];
  /* (1) no token, (2) a sign-in that throws, (3) a referee with no provider, (4) a token the referee refuses */
  const cases = [
    ["a null token", {}, {token: async () => null}],
    ["a throwing sign-in", {}, {token: async () => { throw new Error("no storage"); }}],
    ["a referee with no provider", {noProvider: true}, {token: async () => "jwt.orphan"}],
    ["a refused token", {}, {token: async () => "jwt.forged"}]];
  for(const [what, wo, identity] of cases){
    const {world, opts} = idWorld({seedKey: "who-c" + what, ...wo});
    let a = null, b = null;
    try {
      a = await M.startTable(opts(M, "A", {identity}));
      b = await M.sitAt(opts(M, "B", {code: a.code, identity}));
    } catch(e){ bad.push(what + ": the table did not open (" + (e.why || e.message) + ")"); continue; }
    const row = world.row(a.code);
    if(a.seat !== 0 || b.seat !== 1) bad.push(what + ": seats " + a.seat + "," + b.seat);
    if(row.v !== 2 || "owners" in row) bad.push(what + ": the row is not the casual one");
    if(a.owned() || b.owned()) bad.push(what + ": a casual seat reads as owned");
    a.close(); b.close();
  }
  return bad;
}
test("(c) NO SIGN-IN, NO PROBLEM — no token, a throwing sign-in, no provider, a refused token: each sits down casually (a v2 row)", async () => {
  assert.deepEqual(await guard(casualFailures(ST), 8000), []);
});
test("SABOTAGE (c): without the casual retry a refused sign-in leaves the player outside; without the guard a throwing sign-in does", async () => {
  const noRetry = stCopy([["if(!res.ok && res.refused === \"identity\" && req0.identity){ req0 = {op: \"join\", table: code, claim}; token = null; continue; }", ""]]);
  assert.ok((await guard(casualFailures(noRetry), 8000)).some(x => /did not open/.test(x)));
  const noGuard = stCopy([["try { token = await o.identity.token(); } catch(_){ token = null; } }\n  if(typeof token !== \"string\" || !token) token = null;\n  if(token) scrub.add(token);", "token = await o.identity.token(); }"]]);
  assert.ok((await guard(casualFailures(noGuard), 8000)).some(x => /throwing sign-in/.test(x)));
});

async function takenFailures(M, lostPush){
  const bad = [], {world, player, opts} = idWorld({seedKey: "who-d" + (lostPush ? "x" : "")});
  const P = player("P-zero-id", "Dawn Smith"), Q = player("P-one-id");
  const a = await M.startTable(opts(M, "A", {identity: P.identity}));
  const b = await M.sitAt(opts(M, "B", {code: a.code, identity: Q.identity}));
  await world.settle([a, b]);
  const oldKey = world.row(a.code).hub.keys[0];
  if(lostPush) world.fault.cut(world.topicOf(a.code, 0));           /* the old phone hears no push */
  /* the same player, another phone (its own storage: no seat key), sits down at the same table */
  const a2 = await M.sitAt(opts(M, "A2", {code: a.code, identity: P.identity}));
  await world.settle([a, a2, b]);
  if(a2.seat !== 0 || a2.owned() !== true) bad.push("the second phone did not take the player's own seat: seat " + a2.seat);
  if(world.row(a.code).hub.keys[0] === oldKey) bad.push("the takeover did not deal a fresh key");
  if(world.row(a.code).hub.keys[1] == null || b.status() === "closed") bad.push("the other player's seat was disturbed");
  if(lostPush){
    if(a.status() === "closed" && a.closedWhy() === "taken") { /* the heal's own request already told it: fine */ }
    else { a.send({ch: "lobby", m: {t: "noop"}}); await world.settle([a, a2, b]); }
  }
  if(a.status() !== "closed" || a.closedWhy() !== "taken") bad.push("the old phone was not told its seat was taken (" + (lostPush ? "by its next request" : "by the push") + "): " + a.status() + "/" + a.closedWhy());
  if(a2.status() === "closed") bad.push("the new phone's channel closed");
  /* a phone resuming with the retired key is told the same, by name */
  const keepOld = PH.memKeep(); keepOld.set("srv." + a.code, {seat: 0, key: oldKey, role: "creator", at: 1});
  const why = await M.reclaim(opts(M, "A3", {code: a.code, keep: keepOld})).then(() => null, e => e.why);
  if(why !== "taken") bad.push("a resume with the retired key answered " + why);
  if(keepOld.get("srv." + a.code, null) !== null) bad.push("the retired seat record was kept");
  a2.close(); b.close();
  return bad;
}
test("(d) THE SAME PLAYER ON A SECOND PHONE TAKES THE SEAT — the first phone closes saying 'taken', by the push and (push lost) by its next request", async () => {
  assert.deepEqual(await guard(takenFailures(ST, false), 8000), []);
  assert.deepEqual(await guard(takenFailures(ST, true), 8000), []);
});
test("SABOTAGE (d): a channel that ignores the notice, or reads a taken seat as a plain refusal, is seen", async () => {
  const deafPush = stCopy([["if(f0.taken === true){ fatal(\"taken\"); return; }", ""]]);
  assert.ok((await guard(takenFailures(deafPush, false), 8000)).some(x => /was not told/.test(x)));
  const plain = stCopy([["if(res.refused === \"auth\" && res.taken === true) throw fail(\"taken\", \"refused: auth (taken)\");", ""]]);
  assert.ok((await guard(takenFailures(plain, false), 8000)).some(x => /retired key answered auth/.test(x)));
});

/* ---------------------------------------------------------------------------------------------- (e) */
async function nameFailures(M){
  const bad = [], {world, player, idp} = idWorld({seedKey: "who-e"});
  const P = player("P-zero-id"), Q = player("P-one-id");
  const o = who => ({transport: world.transport("N"), identity: who.identity});
  const eq = (got, want, what) => { if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(what + ": " + JSON.stringify(got)); };
  eq(await M.whoAmI(o(P)), {name: null}, "a new player");
  eq(await M.setName(o(P), "Dawn Smith"), {name: "Dawn Smith"}, "a free name");
  eq(await M.whoAmI(o(P)), {name: "Dawn Smith"}, "the name reads back");
  eq(await whyOf(M.setName(o(Q), "dawn sm1th")), "name-taken", "a look-alike of a held name");
  for(const [name, reason] of [["ab", "short"], ["Seventeen Letters X", "long"], ["Ana!", "chars"], ["Judge", "reserved"], [" Ana", "space"]])
    eq(await whyOf(M.setName(o(Q), name)), "name:" + reason, "the reason for " + JSON.stringify(name));
  eq(await whyOf(M.setName({transport: world.transport("N"), identity: {token: async () => "jwt.forged"}}, "Free Name")), "identity", "a refused sign-in");
  eq(await whyOf(M.setName({transport: world.transport("N"), identity: {token: async () => null}}, "Free Name")), "unavailable", "no sign-in");
  eq(await whyOf(M.setName({transport: world.transport("N")}, "Free Name")), "unavailable", "no identity at all");
  world.fault.dead(true);
  eq(await whyOf(M.setName(o(Q), "Free Name")), "unavailable", "a dead server");
  world.fault.dead(false);
  if(idp.names.size !== 1) bad.push("a refused name was stored");
  const sent = world.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "me");
  if(!sent.length || !sent.every(e => e.identity && typeof e.identity.token === "string" && !("table" in e))) bad.push("op me was not sent as {op, identity, name?}");
  return bad;
}
test("(e) THE NAME CALLS — whoAmI/setName: stored, read back, a taken look-alike, the validator's reason, a refused or missing sign-in, a dead server", async () => {
  assert.deepEqual(await guard(nameFailures(ST), 8000), []);
});
test("SABOTAGE (e): name calls that swallow 'taken', lose the reason, or send no name are seen", async () => {
  const sabs = [
    [["if(r.refused === \"name-taken\") throw fail(\"name-taken\");", "if(r.refused === \"name-taken\") return {name};"]],
    [["{reason: typeof r.reason === \"string\" ? r.reason : \"chars\"}", "{reason: \"chars\"}"]],
    [["...(name !== undefined ? {name} : {})});\n  if(r.ok) return {name:", "});\n  if(r.ok) return {name:"]]];
  for(const s of sabs) assert.ok((await guard(nameFailures(stCopy(s)), 8000)).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});
