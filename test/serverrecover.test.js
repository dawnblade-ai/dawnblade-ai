/* test/serverrecover.test.js — A LOST PHONE IS NOT A LOST PLAYER: RECOVERY CODES (SERVER S4.3).

   server/referee.js's two ops, `recovery-mint` and `recovery-redeem`, against the S1 fakes (no account, no network). The real SQL
   (004_recovery.sql) is proven on PGlite and under Deno (server/S4-LOG.md); `withRecovery` in serverfakes.js behaves like it.

     (1) MINT, THEN REDEEM MOVES THE PLAYER — a new phone with its own fresh sign-in presents the code: it reads the recovered
         player's NAME, takes over the recovered player's SEAT (fresh key, the old phone told 'taken'), and the throwaway player
         (and the name it had chosen) is gone.
     (2) A CODE WORKS ONCE, and is read leniently (case, spaces, dashes).
     (3) WRONG, USED, EXPIRED, RETIRED AND MALFORMED ARE ONE ANSWER — byte for byte.
     (4) A SECOND MINT RETIRES THE FIRST — one live code per player.
     (5) THE BRAKE — eight wrong tries from one sign-in, then 'limited' (which does not spend a good code); another sign-in is free.
     (6) A THROWAWAY THAT HOLDS A CHAIR — the redeem is refused 'recovery-seated' and NOTHING changes.
     (7) THE CODE ITSELF — 15 characters of a 31-letter alphabet, grouped, drawn from crypto (never Math.random), distinct.
     (8) NOTHING LEAKS — the code is in the mint's answer and nowhere else; no hash, token or player id in any answer, broadcast or
         stored row; the stored hash is the SHA-256 of the normalised code and the code is not stored.
   Each drill is run against a broken copy and must fail there. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const SHA = require("../engine/sha256.js");
const {SERVER} = require("./helpers/serverhub.js");
const {json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}

/* a server with a fake provider, a name registry and a recovery backend; `go` answers as JSON */
function world(server, o){
  o = o || {};
  const store = F.memStore(), sent = [], idp = F.memIdentity(), rec = F.withRecovery(idp, o);
  let clock = 1700000000000; const rnd = T.seeded("rec|" + (o.salt || ""));
  let n = 0;
  const deps = {store, broadcast: (t, p) => sent.push({topic: t, payload: json(p)}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => rnd,
    identify: t => idp.identify(t), rename: (p, nm, f) => idp.rename(p, nm, f), mint: (p, h, d) => rec.mint(p, h, d), redeem: (t, h) => rec.redeem(t, h),
    /* deterministic, still uniform enough to be a code: a counter-driven byte stream (the real default is crypto) */
    ...(o.realRandom ? {} : {randBytes: len => Uint8Array.from({length: len}, (_, i) => ((++n * 2654435761 + i * 40503) >>> 7) & 255)})};
  const ID = "RECTAB1";
  server.handleNow({op: "create", table: ID}, deps);
  const go = req => json(server.handleNow(req, deps));
  const keyOf = r => (r.frames.find(f => f.ch === "judge" && f.key) || {}).key;
  const join = (tok, extra) => go({op: "join", table: ID, ...(tok ? {identity: {token: tok}} : {}), ...(extra || {})});
  const mint = tok => go({op: "recovery-mint", identity: {token: tok}});
  const redeem = (tok, code, extra) => go({op: "recovery-redeem", identity: {token: tok}, code, ...(extra || {})});
  return {server, store, sent, idp, rec, deps, ID, go, keyOf, join, mint, redeem, row: () => store.row(ID)};
}
/* two players at a table: P-old (named, seat A) and a rival; a brand-new phone with a throwaway player of its own */
function scene(server, o){
  const w = world(server, o);
  const tokOld = w.idp.issue("P-old-player"), tokRival = w.idp.issue("P-rival-player"), tokNew = w.idp.issue("P-throwaway");
  assert.equal(w.go({op: "me", identity: {token: tokOld}, name: "Dawn Smith"}).name, "Dawn Smith");
  const a = w.join(tokOld), b = w.join(tokRival);
  assert.ok(a.ok && b.ok && a.seat !== b.seat);
  return {...w, tokOld, tokRival, tokNew, a, b, keyA: w.keyOf(a)};
}
const S = {old: "P-old-player", rival: "P-rival-player", fresh: "P-throwaway"};

/* ---------------------------------------------------------------------------------------------- (1) */
function moveFailures(server, o){
  const bad = [], w = scene(server, o);
  const m = w.mint(w.tokOld);
  if(!m.ok || typeof m.code !== "string" || !/^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(m.code)) return ["the mint answered " + JSON.stringify(m)];
  /* before: the new phone is nobody, and has no name */
  if(w.go({op: "me", identity: {token: w.tokNew}}).name !== null) bad.push("the new phone had a name before it redeemed");
  const r = w.redeem(w.tokNew, m.code);
  if(!r.ok || r.name !== "Dawn Smith") bad.push("the redeem did not answer the recovered name: " + JSON.stringify(r));
  if(w.go({op: "me", identity: {token: w.tokNew}}).name !== "Dawn Smith") bad.push("the new phone does not read the recovered name");
  if(w.go({op: "me", identity: {token: w.tokOld}}).name !== "Dawn Smith") bad.push("the old phone lost the player's name");
  if(w.rec.deleted.join() !== S.fresh) bad.push("the throwaway player was not removed (" + w.rec.deleted + ")");
  /* the seat follows: the new phone sits down with no key and takes the chair; the old phone is told */
  const j = w.join(w.tokNew);
  if(!j.ok || j.seat !== w.a.seat || j.owned !== true) return bad.concat("the recovered phone did not get the player's seat: " + JSON.stringify([j.ok, j.refused, j.seat, j.owned]));
  const k2 = w.keyOf(j);
  if(!k2 || k2 === w.keyA) bad.push("the takeover did not deal a fresh key");
  const old = w.go({op: "resync", table: w.ID, seat: w.a.seat, key: w.keyA});
  if(old.ok || old.refused !== "auth" || old.taken !== true) bad.push("the old phone was not told 'taken': " + JSON.stringify(old));
  if(w.row().owners.filter(Boolean).length !== 2 || w.row().owners.includes(S.fresh)) bad.push("the row's owners are not the two real players");
  /* the rival's seat is untouched */
  if(w.go({op: "join", table: w.ID, seat: w.b.seat, key: w.keyOf(w.b)}).ok !== true) bad.push("the rival's seat moved");
  return bad;
}
test("(1) MINT THEN REDEEM MOVES THE PLAYER — the new phone reads the name, takes the seat (old phone told 'taken'), and the throwaway player is gone", () => {
  assert.deepEqual(moveFailures(SERVER), []);
});
test("SABOTAGE (1): a redeem that answers no name, or a backend that leaves the throwaway behind, is seen", () => {
  const noName = loadServer([["if(r.status === \"ok\") { const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null}; }", "if(r.status === \"ok\") { return {ok: true, name: null}; }"]]);
  assert.ok(moveFailures(noName).some(x => /recovered name/.test(x)), "an answer without the name must be seen");
  assert.ok(moveFailures(SERVER, {leaveThrowaway: true}).some(x => /throwaway player was not removed/.test(x)), "a kept throwaway must be seen");
});

/* ---------------------------------------------------------------------------------------------- (2) */
function onceFailures(server, o){
  const bad = [], w = scene(server, o), code = w.mint(w.tokOld).code, plain = code.replace(/-/g, "");
  if(w.redeem(w.tokNew, " " + plain.toLowerCase().replace(/(.{4})/g, "$1 ") + " ").ok !== true) bad.push("lower case with spaces was refused");
  const again = w.redeem(w.idp.issue("P-second-throwaway"), code);
  if(again.ok !== false || again.refused !== "recovery") bad.push("a second redeem of the same code answered " + JSON.stringify(again));
  const w2 = scene(server, o), c2 = w2.mint(w2.tokOld).code;
  if(w2.redeem(w2.tokNew, c2.replace(/-/g, " - ").toLowerCase()).ok !== true) bad.push("dashes and spaces mixed were refused");
  const w3 = scene(server, o); if(w3.redeem(w3.tokNew, w3.mint(w3.tokOld).code.replace(/-/g, "")).ok !== true) bad.push("a code with no dashes was refused");
  return bad;
}
test("(2) A CODE WORKS ONCE, AND IS READ LENIENTLY — lower case, spaces and dashes, any grouping; a second phone with the same code is refused", () => {
  assert.deepEqual(onceFailures(SERVER), []);
});
test("SABOTAGE (2): a redeem that is case sensitive, or a code that is never spent, is seen", () => {
  const cs = loadServer([["raw.toUpperCase().replace(/[^A-Z0-9]/g, \"\")", "raw.replace(/[^A-Z0-9]/g, \"\")"]]);
  assert.ok(onceFailures(cs).some(x => /lower case/.test(x)), "case sensitivity must be seen");
  assert.ok(onceFailures(SERVER, {neverSpend: true}).some(x => /second redeem/.test(x)), "a code that works twice must be seen");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function sameAnswerFailures(server){
  const bad = [], w = scene(server, {salt: "same"});
  const live = w.mint(w.tokOld).code, retired = (() => { const c = w.mint(w.tokRival).code; w.mint(w.tokRival); return c; })();
  const used = (() => { const c = w.mint(w.tokOld); return c.code; })();
  const gone = w.idp.issue("P-gone-1"); w.redeem(gone, used);                       /* spent now */
  /* an expired code: mint, then the clock moves past two years */
  const expiring = w.mint(w.tokRival).code; w.rec.clock += (server.RECOVERY_DAYS + 1) * 86400000;
  const tries = {wrong: "ABCDE-FGHJK-MNPQR", retired, used, expired: expiring, short: "ABC", long: "ABCDEFGHJKMNPQRSTUVW2345", alphabet: "00000-OOOOO-IIIII", empty: "", number: 12345, nothing: undefined};
  const answers = {};
  for(const [k, v] of Object.entries(tries)){
    const t = w.idp.issue("P-try-" + k);
    answers[k] = JSON.stringify(w.go({op: "recovery-redeem", identity: {token: t}, ...(v === undefined ? {} : {code: v})}));
  }
  const first = answers.wrong;
  for(const [k, a] of Object.entries(answers)) if(a !== first) bad.push("'" + k + "' answers " + a + " but a wrong code answers " + first);
  if(JSON.parse(first).refused !== "recovery") bad.push("the one answer is not 'recovery': " + first);
  /* none of them moved anything, and the live code is still good */
  if(w.rec.deleted.length !== 0 && w.rec.deleted.some(x => x !== "P-gone-1" && x !== S.fresh && !/^P-gone|^P-try/.test(x))) bad.push("a refused try deleted a player");
  return bad;
}
test("(3) WRONG, USED, EXPIRED, RETIRED AND MALFORMED CODES ARE ONE INDISTINGUISHABLE ANSWER", () => {
  assert.deepEqual(sameAnswerFailures(SERVER), []);
});
test("SABOTAGE (3): a referee that answers a malformed or an expired code differently is seen", () => {
  const dist = loadServer([["if(!recoveryValid(code)) return no(\"recovery\");", "if(!recoveryValid(code)) return no(\"bad-request\");"]]);
  assert.ok(sameAnswerFailures(dist).some(x => /'short'|'long'|'empty'/.test(x)), "a distinct malformed answer must be seen");
  const dist2 = loadServer([["if(r.status === \"refused\") return no(\"recovery\");", "if(r.status === \"refused\") return no(\"recovery\", {why: \"no such code\"});"]]);
  assert.ok(sameAnswerFailures(dist2).length > 0, "an answer that explains itself must be seen");
});

/* ---------------------------------------------------------------------------------------------- (4) */
function retireFailures(server, o){
  const bad = [], w = scene(server, o);
  const c1 = w.mint(w.tokOld).code, other = w.mint(w.tokRival).code, c2 = w.mint(w.tokOld).code;
  if(c1 === c2) bad.push("two mints gave the same code");
  if(w.redeem(w.idp.issue("P-a"), c1).refused !== "recovery") bad.push("the first code was not retired by the second mint");
  if([...w.rec.codes.values()].filter(e => e.player === S.old && !e.used).length !== 1) bad.push("more than one live code for a player");
  if(w.redeem(w.idp.issue("P-b"), other).ok !== true) bad.push("the rival's code was retired by another player's mint");
  if(w.redeem(w.idp.issue("P-c"), c2).ok !== true) bad.push("the newest code does not work");
  return bad;
}
test("(4) A SECOND MINT RETIRES THE FIRST — one live code per player; another player's code is untouched", () => {
  assert.deepEqual(retireFailures(SERVER), []);
});
test("SABOTAGE (4): a backend that keeps the older code alive, or retires everyone's, is seen", () => {
  assert.ok(retireFailures(SERVER, {keepOld: true}).some(x => /not retired|more than one/.test(x)));
});

/* ---------------------------------------------------------------------------------------------- (5) */
function brakeFailures(server, o){
  const bad = [], w = scene(server, o), code = w.mint(w.tokOld).code;
  for(let i = 0; i < 8; i++) if(w.redeem(w.tokNew, "ABCDE-FGHJK-MNPQR").refused !== "recovery") bad.push("try " + (i + 1) + " was not a plain refusal");
  const lim = w.redeem(w.tokNew, code);
  if(lim.ok !== false || lim.refused !== "recovery-limited") bad.push("the ninth try answered " + JSON.stringify(lim));
  if([...w.rec.codes.values()].find(e => e.player === S.old).used !== false) bad.push("the limited try spent the code");
  if(w.redeem(w.idp.issue("P-free"), code).ok !== true) bad.push("another sign-in was braked");
  const w2 = scene(server, o), c2 = w2.mint(w2.tokOld).code;
  for(let i = 0; i < 8; i++) w2.redeem(w2.tokNew, "ABCDE-FGHJK-MNPQR");
  w2.rec.clock += 3600001;
  if(w2.redeem(w2.tokNew, c2).ok !== true) bad.push("an hour later the brake did not lift");
  return bad;
}
test("(5) THE BRAKE — eight wrong tries from one sign-in, then 'recovery-limited' (a good code is not spent by a limited try); another sign-in is free; an hour later it lifts", () => {
  assert.deepEqual(brakeFailures(SERVER), []);
});
test("SABOTAGE (5): no brake, or a referee that reads 'limited' as plain 'wrong', is seen", () => {
  assert.ok(brakeFailures(SERVER, {noBrake: true}).some(x => /ninth/.test(x)), "no brake must be seen");
  const flat = loadServer([["if(r.status === \"limited\") return no(\"recovery-limited\");", "if(r.status === \"limited\") return no(\"recovery\");"]]);
  assert.ok(brakeFailures(flat).some(x => /ninth/.test(x)), "a flattened limited answer must be seen");
});

/* ---------------------------------------------------------------------------------------------- (6) */
function seatedFailures(server){
  const bad = [], w = scene(server), code = w.mint(w.tokOld).code;
  const tokS = w.idp.issue("P-seated-throwaway");
  w.go({op: "me", identity: {token: tokS}, name: "Throw Away"});
  /* a third table where the throwaway holds a chair */
  const T2 = "RECTAB2"; server.handleNow({op: "create", table: T2}, w.deps);
  const sj = json(server.handleNow({op: "join", table: T2, identity: {token: tokS}}, w.deps));
  if(!sj.ok || sj.owned !== true) return ["the throwaway did not sit down: " + JSON.stringify(sj.refused)];
  const before = JSON.stringify([w.store.json(T2), w.store.json(w.ID), [...w.rec.codes.entries()], w.idp.names.get("P-seated-throwaway")]);
  const r = w.redeem(tokS, code, {tables: [w.ID, T2]});
  if(r.ok || r.refused !== "recovery-seated") bad.push("a seated throwaway was not refused 'recovery-seated': " + JSON.stringify(r));
  const after = JSON.stringify([w.store.json(T2), w.store.json(w.ID), [...w.rec.codes.entries()], w.idp.names.get("P-seated-throwaway")]);
  if(after !== before) bad.push("a refused redeem changed something");
  if(w.rec.deleted.length) bad.push("a player was deleted");
  /* the same phone, without the seat in view, is let through (the server only knows the tables it is told of) and the code was not spent */
  const ok = w.redeem(tokS, code, {tables: [w.ID]});
  if(!ok.ok) bad.push("the code was spent by the refused try: " + JSON.stringify(ok));
  if(w.redeem(w.idp.issue("P-q"), "ABCDE-FGHJK-MNPQR", {tables: "no"}).refused !== "bad-request") bad.push("a malformed `tables` was not bad-request");
  return bad;
}
test("(6) A THROWAWAY THAT HOLDS A CHAIR IS NOT MOVED — refused 'recovery-seated' before anything changes; the code is not spent; the tables it names are read", () => {
  assert.deepEqual(seatedFailures(SERVER), []);
});
test("SABOTAGE (6): a referee that does not look at the tables, or looks and moves anyway, is seen", () => {
  const blind = loadServer([["if(held) return no(\"recovery-seated\");", "if(false) return no(\"recovery-seated\");"]]);
  assert.ok(seatedFailures(blind).some(x => /not refused/.test(x)), "the missing check must be seen");
  const noTables = loadServer([["const tables = req.tables === undefined ? [] : req.tables;", "const tables = [];"]]);
  assert.ok(seatedFailures(noTables).length > 0, "ignoring the named tables must be seen");
});

/* ---------------------------------------------------------------------------------------------- (7) */
function codeFailures(server){
  const bad = [];
  if(server.RECOVERY_CHARS.length !== 31 || /[01OIL]/.test(server.RECOVERY_CHARS)) bad.push("the alphabet is not the 31 unambiguous characters");
  if(server.RECOVERY_LEN * Math.log2(server.RECOVERY_CHARS.length) < 60) bad.push("fewer than 60 bits");
  if(server.RECOVERY_DAYS !== 730) bad.push("the expiry is not 730 days");
  /* REJECTION: bytes of 248 and over (they would make the first characters likelier) are skipped; the stream is 250s, then 0..31 */
  { let call = 0; const w = world(server, {realRandom: true}); w.deps.randBytes = n => { call++; return Uint8Array.from({length: n}, (_, i) => call === 1 ? 250 : i); };
    const m = w.mint(w.idp.issue("P-rej")), want = Array.from({length: server.RECOVERY_LEN}, (_, i) => server.RECOVERY_CHARS[i % 31]).join("");
    if(!m.ok || m.code.replace(/-/g, "") !== want.slice(0, server.RECOVERY_LEN)) bad.push("the draw did not use rejection sampling: " + (m.code || JSON.stringify(m))); }
  const real = globalThis.crypto; let draws = 0;
  Object.defineProperty(globalThis, "crypto", {configurable: true, value: {getRandomValues: a => { draws++; return real.getRandomValues(a); }}});
  const seen = new Set(), count = {};
  try {
    const w = world(server, {realRandom: true}), tok = w.idp.issue("P-bulk");
    for(let i = 0; i < 400; i++){
      const m = w.mint(tok); if(!m.ok) return bad.concat("a mint was refused: " + JSON.stringify(m));
      if(!/^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(m.code) || m.days !== 730) bad.push("a code or expiry is malformed: " + JSON.stringify(m));
      seen.add(m.code); for(const ch of m.code.replace(/-/g, "")) count[ch] = (count[ch] || 0) + 1;
    }
  } finally { Object.defineProperty(globalThis, "crypto", {configurable: true, value: real}); }
  if(draws < 400) bad.push("crypto.getRandomValues was not the source (" + draws + " draws)");
  if(seen.size !== 400) bad.push("repeats in 400 codes");
  if(Object.keys(count).length !== 31) bad.push("not every character of the alphabet appears");
  const mean = 400 * 15 / 31; if(!Object.values(count).every(c => c > mean * 0.7 && c < mean * 1.3)) bad.push("a character is badly over- or under-used");
  return bad.slice(0, 4);
}
test("(7) THE CODE — 15 characters of the 31-letter alphabet (no 0 O 1 I L), three groups of five, 74 bits, all different, drawn from crypto", () => {
  assert.deepEqual(codeFailures(SERVER), []);
});
test("SABOTAGE (7): a code drawn from Math.random, a 16-letter alphabet, a modulo-biased draw or a short code is seen", () => {
  const weak = loadServer([["const c = typeof crypto !== \"undefined\" ? crypto : null;", "const c = {getRandomValues: a => { for(let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; }};"]]);
  assert.ok(codeFailures(weak).some(x => /not the source/.test(x)), "Math.random must be seen");
  const small = loadServer([["const RECOVERY_CHARS = \"ABCDEFGHJKMNPQRSTUVWXYZ23456789\";", "const RECOVERY_CHARS = \"ABCDEFGHJKMNPQRS\";"]]);
  assert.ok(codeFailures(small).some(x => /alphabet|bits/.test(x)), "a small alphabet must be seen");
  const biased = loadServer([["if(b < 248 && out.length < RECOVERY_LEN)", "if(out.length < RECOVERY_LEN)"]]);
  assert.ok(codeFailures(biased).some(x => /rejection/.test(x)), "a modulo-biased draw must be seen");
  const short = loadServer([["const RECOVERY_LEN = 15;", "const RECOVERY_LEN = 10;"]]);
  assert.ok(codeFailures(short).length > 0, "a short code must be seen");
});
test("(7b) LEDGER — the draw rejects bytes at 248 (31*8) so the modulo is unbiased, and never falls back to Math.random", () => {
  assert.ok(/b < 248/.test(SRC) && 248 === 31 * 8);
  const recovery = SRC.slice(SRC.indexOf("function recoveryDraw"), SRC.indexOf("const recoveryShow"));
  assert.ok(!/Math\.random/.test(recovery), "recoveryDraw must not mention Math.random");
});

/* ---------------------------------------------------------------------------------------------- (8) */
function leakFailures(server){
  const bad = [], w = scene(server, {salt: "leak"});
  const log = [];
  const reqs = [];
  const go = req => { const r = w.go(req); log.push(JSON.stringify(r)); reqs.push(req); return r; };
  const m = go({op: "recovery-mint", identity: {token: w.tokOld}});
  const plain = m.code.replace(/-/g, ""), hash = server.recoveryHash(plain);
  const r1 = go({op: "recovery-redeem", identity: {token: w.tokNew}, code: m.code});
  go({op: "recovery-redeem", identity: {token: w.idp.issue("P-z")}, code: m.code});                  /* used: refused */
  go({op: "recovery-redeem", identity: {token: w.idp.issue("P-y")}, code: "ABCDE-FGHJK-MNPQR"});    /* wrong */
  const j = go({op: "join", table: w.ID, identity: {token: w.tokNew}});
  go({op: "me", identity: {token: w.tokNew}}); go({op: "resync", table: w.ID, seat: w.a.seat, key: w.keyA});
  const answers = log.join("\n");
  /* the code: exactly once, in the mint's own answer */
  if(log[0].indexOf(m.code) < 0) bad.push("the mint did not answer the code");
  if(log.slice(1).join("\n").indexOf(plain) >= 0 || log.slice(1).join("\n").indexOf(m.code) >= 0) bad.push("the code came back in a later answer");
  const hay = JSON.stringify([log.slice(0), w.sent]);
  if(hay.indexOf(hash) >= 0) bad.push("the hash is in an answer or a broadcast");
  for(const x of [hash, plain, m.code]) if(JSON.stringify(w.sent).indexOf(x) >= 0) bad.push("a broadcast carries the code or its hash");
  for(const x of [S.old, S.rival, S.fresh, w.tokOld, w.tokRival, w.tokNew]) if(answers.indexOf(x) >= 0) bad.push("an id or token is in an answer: " + x);
  for(const id of [w.ID]){ const rowText = w.store.json(id); for(const x of [hash, plain, m.code, w.tokOld, w.tokNew, w.tokRival]) if(rowText.indexOf(x) >= 0) bad.push("the stored table row holds a secret"); }
  if(r1.ok !== true || Object.keys(r1).sort().join() !== "name,ok") bad.push("the redeem answer is not exactly {ok, name}: " + JSON.stringify(r1));
  if(Object.keys(m).sort().join() !== "code,days,ok") bad.push("the mint answer grew a field: " + Object.keys(m));
  /* the backend stored the HASH of the normalised code and never the code */
  if(!w.rec.codes.has(hash)) bad.push("the stored key is not the SHA-256 of the normalised code");
  if(/^[0-9a-f]{64}$/.test(hash) === false || hash !== SHA.sha256(plain)) bad.push("the hash is not sha256 hex of the normalised code");
  if([...w.rec.codes.keys()].some(k => k === plain || k === m.code)) bad.push("the backend holds the code itself");
  /* every broadcast envelope is still exactly what it was */
  if(!w.sent.every(e => Object.keys(e.payload).sort().join() === "frames,mac,ver")) bad.push("a broadcast envelope grew a field");
  if(!j.ok) bad.push("the join after the redeem failed");
  return bad;
}
test("(8) NOTHING LEAKS — the code is only in the mint's answer; no hash, token or player id in any answer, broadcast or stored row; the backend holds the SHA-256 and never the code", () => {
  assert.deepEqual(leakFailures(SERVER), []);
});
test("SABOTAGE (8): a code stored plain, a code echoed by the redeem, a hash or an id in an answer are each seen", () => {
  const plainStore = loadServer([["const recoveryHash = code => SHA.sha256(code);", "const recoveryHash = code => code;"]]);
  assert.ok(leakFailures(plainStore).some(x => /sha256|SHA-256|backend holds the code/i.test(x)), "a stored plain code must be seen");
  const echo = loadServer([["const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null}; }", "const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null, code: req.code}; }"]]);
  assert.ok(leakFailures(echo).some(x => /code came back|exactly/.test(x)), "an echoed code must be seen");
  const hashy = loadServer([["return {ok: true, code: recoveryShow(code), days: RECOVERY_DAYS};", "return {ok: true, code: recoveryShow(code), days: RECOVERY_DAYS, h: recoveryHash(code)};"]]);
  assert.ok(leakFailures(hashy).some(x => /hash is in|grew a field/.test(x)), "a hash in the mint answer must be seen");
  const idy = loadServer([["const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null}; }", "const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null, p: who.player}; }"]]);
  assert.ok(leakFailures(idy).some(x => /id or token|exactly/.test(x)), "a player id in the answer must be seen");
});

/* ---------------------------------------------------------------------------------------------- unwired / malformed */
test("(9) NOT WIRED OR MALFORMED — no `mint`/`redeem` dep: 'unavailable'; a forged token: 'identity'; a bad identity: 'bad-request'; nothing is created", () => {
  const w = world(SERVER), tok = w.idp.issue("P-1");
  const bare = {...w.deps}; delete bare.mint; delete bare.redeem;
  const call = (req, d) => json(SERVER.handleNow(req, d || bare));
  assert.equal(call({op: "recovery-mint", identity: {token: tok}}).refused, "unavailable");
  assert.equal(call({op: "recovery-redeem", identity: {token: tok}, code: "ABCDE-FGHJK-MNPQR"}).refused, "unavailable");
  assert.equal(w.go({op: "recovery-mint", identity: {token: "forged"}}).refused, "identity");
  assert.equal(w.go({op: "recovery-redeem", identity: {token: "forged"}, code: "ABCDE-FGHJK-MNPQR"}).refused, "identity");
  for(const bad of [undefined, null, {}, {token: 5}, {token: ""}, []]) { assert.equal(w.go({op: "recovery-mint", identity: bad}).refused, "bad-request"); assert.equal(w.go({op: "recovery-redeem", identity: bad, code: "x"}).refused, "bad-request"); }
  assert.equal(w.rec.codes.size, 0, "nothing was minted by any of those");
  assert.equal(w.rec.mints, 0);
  const throwing = {...w.deps, redeem: () => { throw new Error("db down"); }, log: () => {}};
  assert.equal(call({op: "recovery-redeem", identity: {token: tok}, code: "ABCDE-FGHJK-MNPQR"}, throwing).refused, "internal", "a backend outage is `internal`, not a verdict on the code");
});
