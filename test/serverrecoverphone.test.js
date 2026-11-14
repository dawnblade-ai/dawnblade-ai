/* test/serverrecoverphone.test.js — THE PHONE'S SIDE OF A RECOVERY CODE (SERVER S4.3).

   engine/servertable.js `recoveryMint` / `recoveryRedeem`, against the S1 referee and its fakes (no account, no network):
     (a) MINT, THEN A NEW PHONE REDEEMS — the code comes back once in the clear; the redeeming phone reads the recovered NAME and, sitting
         down with no key, takes the recovered player's SEAT (the old phone's channel closes saying 'taken').
     (b) THE REFUSALS reach the caller by name: a wrong code ('recovery'), too many tries ('recovery-limited'), a phone that sits at a table
         ('recovery-seated', from the tables it names), a refused or missing sign-in, a dead server.
     (c) WHAT IS SENT — {op, identity:{token}} to mint; {op, identity:{token}, code, tables?} to redeem, the tables normalised and capped.
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
const guard = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), ms || 6000))]);
const whyOf = p => p.then(() => null, e => e.why);

function rWorld(seedKey){
  const world = makeWorld({seedKey}), idp = F.memIdentity(), rec = F.withRecovery(idp);
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  world.deps.mint = (p, h, d) => rec.mint(p, h, d); world.deps.redeem = (t, h) => rec.redeem(t, h);
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, world.server.nameFold(name)); return {tok, identity: {token: async () => tok}}; };
  const opts = (name, extra) => ({transport: world.transport(name), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, keep: PH.memKeep(), ...(extra || {})});
  return {world, idp, rec, player, opts};
}

/* ---------------------------------------------------------------------------------------------- (a) */
async function moveFailures(M){
  const bad = [], {world, player, opts, rec} = rWorld("rec-a");
  const P = player("P-old-player", "Dawn Smith"), Q = player("P-rival-player", "Rival One"), N = player("P-new-throwaway");
  const a = await M.startTable(opts("A", {identity: P.identity}));
  const b = await M.sitAt(opts("B", {code: a.code, identity: Q.identity}));
  await world.settle([a, b]);
  const m = await M.recoveryMint({transport: world.transport("A"), identity: P.identity});
  if(!m || !/^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(m.code) || m.days !== 730) return bad.concat("the mint answered " + JSON.stringify(m));
  const nameBefore = await M.whoAmI({transport: world.transport("N"), identity: N.identity});
  if(nameBefore.name !== null) bad.push("the new phone had a name before it redeemed");
  const r = await M.recoveryRedeem({transport: world.transport("N"), identity: N.identity}, m.code.toLowerCase().replace(/-/g, " "), []);
  if(JSON.stringify(r) !== JSON.stringify({name: "Dawn Smith"})) bad.push("the redeem did not answer the recovered name: " + JSON.stringify(r));
  const who = await M.whoAmI({transport: world.transport("N"), identity: N.identity});
  if(who.name !== "Dawn Smith") bad.push("the new phone does not read the recovered name");
  const a2 = await M.sitAt(opts("N", {code: a.code, identity: N.identity}));
  await world.settle([a, a2, b]);
  if(a2.seat !== a.seat || a2.owned() !== true) bad.push("the recovered phone did not take the player's seat: seat " + a2.seat + " vs " + a.seat);
  if(a.status() !== "closed" || a.closedWhy() !== "taken") bad.push("the old phone was not told its seat was taken: " + a.status() + "/" + a.closedWhy());
  if(rec.codes.size < 1) bad.push("nothing was minted");
  a2.close(); b.close();
  return bad;
}
test("(a) MINT, THEN A NEW PHONE REDEEMS — it reads the recovered name and takes the recovered player's seat; the old phone is told 'taken'", async () => {
  assert.deepEqual(await guard(moveFailures(ST), 12000), []);
});
test("SABOTAGE (a): a mint that answers no code, a redeem that drops the name, or one that never reaches the server is seen", async () => {
  const sabs = [
    [["if(typeof r.code !== \"string\" || !r.code) throw fail(\"unavailable\", \"no code\");\n  return {code: r.code,", "return {code: \"AAAAA-AAAAA-AAAAA\","]],
    [["return {name: typeof r.name === \"string\" ? r.name : null};\n}\n\n/* ---- THE SIGN-IN", "return {name: null};\n}\n\n/* ---- THE SIGN-IN"]],
    [["{op: \"recovery-redeem\", code: String(code == null ? \"\" : code),", "{op: \"recovery-redeem\", code: \"\","]]];
  for(const s of sabs) assert.ok((await guard(moveFailures(stCopy(s)).catch(e => ["threw " + (e.why || e.message)]), 12000)).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});

/* ---------------------------------------------------------------------------------------------- (b) */
async function refusalFailures(M){
  const bad = [], {world, player, opts, idp} = rWorld("rec-b");
  const P = player("P-old-player", "Dawn Smith"), N = player("P-new-throwaway"), S = player("P-seated-throwaway");
  const o = who => ({transport: world.transport("X"), identity: who.identity});
  const m = await M.recoveryMint(o(P));
  const eq = (got, want, what) => { if(got !== want) bad.push(what + ": " + got); };
  eq(await whyOf(M.recoveryRedeem(o(N), "ABCDE-FGHJK-MNPQR")), "recovery", "a wrong code");
  eq(await whyOf(M.recoveryRedeem(o(N), "")), "recovery", "an empty code");
  eq(await whyOf(M.recoveryRedeem(o(N), undefined)), "recovery", "no code");
  /* seated: the throwaway sat at a table; the table is named; nothing moves and the code survives */
  const t = await M.startTable(opts("S", {identity: S.identity})); await world.settle([t]);
  eq(await whyOf(M.recoveryRedeem(o(S), m.code, [t.code.toLowerCase()])), "recovery-seated", "a phone sitting at a table");
  eq(await whyOf(M.recoveryRedeem(o(S), m.code, ["not a table code"])), null, "a table name that is no table code is dropped, and the code then works");
  /* too many tries */
  const m2 = await M.recoveryMint(o(P));
  for(let i = 0; i < 8; i++) await whyOf(M.recoveryRedeem(o(N), "ABCDE-FGHJK-MNPQR"));
  eq(await whyOf(M.recoveryRedeem(o(N), m2.code)), "recovery-limited", "the ninth try");
  /* sign-in problems and a dead server */
  eq(await whyOf(M.recoveryRedeem({transport: world.transport("X"), identity: {token: async () => "jwt.forged"}}, m2.code)), "identity", "a refused sign-in");
  eq(await whyOf(M.recoveryRedeem({transport: world.transport("X"), identity: {token: async () => null}}, m2.code)), "unavailable", "no sign-in");
  eq(await whyOf(M.recoveryMint({transport: world.transport("X")})), "unavailable", "no identity at all (mint)");
  eq(await whyOf(M.recoveryMint({transport: world.transport("X"), identity: {token: async () => "jwt.forged"}})), "identity", "a refused sign-in (mint)");
  world.fault.dead(true);
  eq(await whyOf(M.recoveryMint(o(P))), "unavailable", "a dead server (mint)");
  eq(await whyOf(M.recoveryRedeem(o(N), m2.code)), "unavailable", "a dead server (redeem)");
  world.fault.dead(false);
  void idp; t.close();
  return bad;
}
test("(b) THE REFUSALS reach the caller by name — wrong, limited, seated, refused or missing sign-in, dead server", async () => {
  assert.deepEqual(await guard(refusalFailures(ST), 12000), []);
});
test("SABOTAGE (b): a client that swallows 'recovery', or reads 'limited' as 'wrong', or forgets the tables is seen", async () => {
  const sabs = [
    [["if(r.refused === \"recovery\" || r.refused === \"recovery-limited\" || r.refused === \"recovery-seated\" || r.refused === \"identity\") throw fail(r.refused);", "if(r.refused === \"recovery-limited\" || r.refused === \"recovery-seated\" || r.refused === \"identity\") throw fail(r.refused);"]],
    [["throw fail(r.refused);\n  throw fail(\"unavailable\", \"refused: \" + r.refused);", "throw fail(r.refused === \"recovery-limited\" ? \"recovery\" : r.refused);\n  throw fail(\"unavailable\", \"refused: \" + r.refused);"]],
    [["...(list.length ? {tables: list} : {})", ""]]];
  for(const s of sabs) assert.ok((await guard(refusalFailures(stCopy(s)), 12000)).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});

/* ---------------------------------------------------------------------------------------------- (c) */
async function wireFailures(M){
  const bad = [], {world, player} = rWorld("rec-c");
  const P = player("P-old-player"), N = player("P-new-throwaway");
  const o = who => ({transport: world.transport("X"), identity: who.identity});
  const m = await M.recoveryMint(o(P));
  await whyOf(M.recoveryRedeem(o(N), "  abc-de ", ["abcde2", "Q", "ABCDEF", "bcdefg", "cdefgh", "defghj", "efghjk", "fghjkm"]));
  void m;
  const sent = world.outbound.map(x => JSON.parse(x.text));
  const mint = sent.find(e => e.op === "recovery-mint"), red = sent.find(e => e.op === "recovery-redeem");
  if(!mint || Object.keys(mint).sort().join() !== "identity,op" || typeof mint.identity.token !== "string" || Object.keys(mint.identity).join() !== "token") bad.push("the mint request is not {op, identity:{token}}: " + JSON.stringify(mint));
  if(!red || Object.keys(red).sort().join() !== "code,identity,op,tables" || red.code !== "  abc-de ") bad.push("the redeem request is not {op, identity, code, tables}: " + JSON.stringify(red));
  if(red && (!Array.isArray(red.tables) || red.tables.length > 6 || red.tables.some(x => x !== x.toUpperCase() || x.length !== ST.CODE_LEN))) bad.push("the tables were not normalised, filtered and capped: " + JSON.stringify(red && red.tables));
  return bad;
}
test("(c) WHAT IS SENT — mint: {op, identity:{token}}; redeem: {op, identity, code, tables} with the tables normalised, valid and at most six", async () => {
  assert.deepEqual(await guard(wireFailures(ST)), []);
});
test("SABOTAGE (c): unnormalised or uncapped tables, or a code that is altered on the way, are seen", async () => {
  const sabs = [
    [[".map(normalize).filter(isValid).slice(0, 6)", ".slice(0, 6)"]],
    [[".map(normalize).filter(isValid).slice(0, 6)", ".map(normalize).filter(isValid)"]],
    [["code: String(code == null ? \"\" : code),", "code: String(code == null ? \"\" : code).trim(),"]]];
  for(const s of sabs) assert.ok((await guard(wireFailures(stCopy(s)))).length >= 1, "the sabotage must be seen: " + s[0][0].slice(0, 50));
});
