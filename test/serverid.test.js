/* test/serverid.test.js — A SEAT CAN BELONG TO A PLAYER (SERVER S4.1).

   server/referee.js binds a seat to a player when a join presents an identity token (`deps.identify` is the one seam; the
   referee never sees how a token is verified). The drills, each with its sabotage:

     (1) CASUAL TABLES ARE v6.28 — a scripted no-identity pre-game produces the very responses and rows (sha256 of the JSON
         text, step by step) recorded from the v6.28 referee (test/fixtures/referee-v628.json); `identify` is never called;
         rows stay v2; v2 and v3 rows are read, v1 and v4 are `wire`.
     (2) RECLAIM — the same player, a new phone, no key: a fresh key, the old one refused as TAKEN (never a hang), the old
         claim token dead, the other seat untouched, a sealed notice on the old channel, the old key stored only as a hash.
     (3) FORGED / EXPIRED / UNSUPPORTED tokens are refused and the row, version and pushes do not move; a provider outage is
         `internal`, not a verdict; malformed identity is `bad-request`.
     (4) ANOTHER PLAYER, AND BOTH SEATS — a different player cannot ride a key or a claim token; a player never holds both.
     (5) NAMES — the validator, the public names, an identify-supplied default.
     (6) A WHOLE GAME with one phone losing its key mid-game and reclaiming by identity: it finishes and the stored game is
         the in-process referee's, fingerprint for fingerprint; blindness scans plus identity-secret scans over every
         response, broadcast and frame, and a JUDGE!! report. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
const SHA = require("../engine/sha256.js");
const L = require("../engine/lobby.js");
const Report = require("../engine/report.js");
const scenario = require("./helpers/v628scenario.js");
const {R, J, SP, Wr, INV, json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}

/* a table with a fake sign-in provider; `go` answers a request as JSON and `snap` is everything a refusal must not move */
function world(server, o){
  const store = F.memStore(), sent = [], idp = F.memIdentity();
  let clock = 1700000000000; const rnd = T.seeded("id|" + ((o && o.salt) || ""));
  const deps = {store, broadcast: (t, p) => sent.push({topic: t, payload: json(p)}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => rnd,
    ...(o && o.noIdentify ? {} : {identify: (o && o.identify) || (t => idp.identify(t))})};
  const ID = "IDTAB1";
  server.handleNow({op: "create", table: ID}, deps);
  const go = req => json(server.handleNow(req, deps));
  const snap = () => ({json: store.json(ID), version: store.version(ID), pushes: sent.length});
  const row = () => store.row(ID);
  const keyOf = r => (r.frames.find(f => f.ch === "judge" && f.key) || {}).key;
  const join = (tok, extra) => go({op: "join", table: ID, ...(tok ? {identity: {token: tok}} : {}), ...(extra || {})});
  return {server, store, sent, idp, deps, ID, go, snap, row, keyOf, join};
}
const hero = (w, seat, key, n, hero) => w.go({op: "frame", table: w.ID, seat, key, n, frame: {ch: "lobby", m: L.hero(seat, hero)}});

/* ---------------------------------------------------------------------------------------------- (1) */
function casualFailures(server){
  const rec = require("./fixtures/referee-v628.json").steps, now = scenario.run(server), bad = [];
  if(now.length !== rec.length) bad.push("the script changed length");
  now.forEach((s, i) => { if(!rec[i]) return;
    if(s.res !== rec[i].res) bad.push("step '" + s.what + "': the response differs from v6.28's");
    if(s.row !== rec[i].row) bad.push("step '" + s.what + "': the stored row differs from v6.28's"); });
  return bad;
}
test("(1) A CASUAL TABLE IS v6.28 BYTE FOR BYTE — every response and every stored row of a no-identity pre-game hashes to the recorded v6.28 run", () => {
  assert.deepEqual(casualFailures(SERVER), []);
  const rec = require("./fixtures/referee-v628.json");
  assert.ok(rec.steps.length >= 15 && rec.steps.some(s => s.refused === "full") && rec.steps.some(s => s.refused === "auth"), "a real script: " + rec.steps.length + " steps");
  const w = world(SERVER);
  w.join(null); w.join(null, {claim: "tokenAAAAAAAAAAAAAAAA"});
  assert.equal(w.idp.calls, 0, "identify is never asked when no identity is presented");
  assert.equal(w.row().v, 2, "a casual row stays v2");
  assert.ok(!("owners" in w.row()) && !("names" in w.row()) && !("retired" in w.row()), "and has no identity fields");
});
test("SABOTAGE (1): a referee that stamps every row v3 / adds identity fields to casual rows no longer matches v6.28", () => {
  const sab = loadServer([["const newRow = (id, hub, deps) => ({v: ROW_V_CASUAL,", "const newRow = (id, hub, deps) => ({v: ROW_V,"]]);
  assert.ok(casualFailures(sab).some(x => /stored row differs/.test(x)), "the row difference must be seen");
  const sab2 = loadServer([["return {ok: true, version: got.version, seat: req.seat, n: row.nonces[req.seat], ...(who &&", "return {ok: true, version: got.version, seat: req.seat, n: row.nonces[req.seat], extra: 1, ...(who &&"]]);
  assert.ok(casualFailures(sab2).some(x => /response differs/.test(x)), "a changed response must be seen");
});
test("(1) ROW VERSIONS — v2 (the live rows) and v3 are read; an identity write lifts a v2 row to v3 and keeps its game; v1 and v4 are refused as `wire`", () => {
  assert.equal(SERVER.ROW_V, 3); assert.equal(SERVER.ROW_V_CASUAL, 2);
  const w = world(SERVER), tok = w.idp.issue("P-one");
  const a = w.join(null, {claim: "tokenAAAAAAAAAAAAAAAA"});
  const b = w.join(tok);                         /* an identified player takes the free chair of a v2 table */
  assert.ok(a.ok && b.ok && b.owned === true && b.seat !== a.seat);
  const r = w.row();
  assert.equal(r.v, 3); assert.deepEqual(r.owners.map(x => x != null), b.seat === 0 ? [true, false] : [false, true]);
  assert.deepEqual(r.retired, [[], []]); assert.deepEqual(r.claims[a.seat], "tokenAAAAAAAAAAAAAAAA", "the casual seat's claim survived the lift");
  /* a casual keyed join and a casual claim replay still work on the v3 row */
  assert.ok(w.go({op: "join", table: w.ID, seat: a.seat, key: w.keyOf(a)}).ok);
  assert.equal(w.go({op: "join", table: w.ID, claim: "tokenAAAAAAAAAAAAAAAA"}).seat, a.seat);
  for(const [v, want] of [[1, "wire"], [4, "wire"], [undefined, "wire"], [2, null], [3, null]]){
    const x = world(SERVER); const rw = x.row(); const ver = x.store.version(x.ID);
    x.store.put(x.ID, {...rw, v}, ver);
    const res = x.go({op: "join", table: x.ID});
    assert.equal(res.refused || null, want, "row v" + v);
  }
});

/* ---------------------------------------------------------------------------------------------- (2) */
function reclaimFailures(server){
  const bad = [], w = world(server, {salt: "reclaim"}), P0 = w.idp.issue("P-zero", "Dawn Smith"), P1 = w.idp.issue("P-one");
  const a = w.join(P0, {claim: "tokenAAAAAAAAAAAAAAAA"}), b = w.join(P1);
  if(!a.ok || !b.ok || a.seat === b.seat) return ["two players did not take one chair each: " + JSON.stringify([a.refused, b.refused])];
  const sa = a.seat, sb = b.seat, keyA = w.keyOf(a), keyB = w.keyOf(b);
  hero(w, sa, keyA, 1, "kayo");
  const nA = w.row().nonces[sa];
  const before = w.snap(), topicA = SERVER.topic(w.ID, sa, keyA);
  /* the phone lost its key AND its claim token: it can only say who it is */
  const c = w.join(P0);
  if(!c.ok || c.seat !== sa || c.owned !== true) return bad.concat("the owner's reclaim answered " + JSON.stringify(c).slice(0, 90));
  const keyC = w.keyOf(c);
  if(!keyC || keyC === keyA) bad.push("the reclaim did not deal a fresh key");
  if(c.n !== nA) bad.push("the counter did not resume where the seat's was: " + c.n + " vs " + nA);
  if(!c.frames.some(f => f.ch === "lobby" && f.m && f.m.t === "hero")) bad.push("the lobby was not replayed to the new phone");
  if(w.row().hub.keys[sa] !== keyC || w.row().hub.keys[sb] !== keyB) bad.push("the row does not hold the new key / the other seat's old one");
  if(w.row().v !== 3) bad.push("the row was not lifted to v3");
  if(JSON.stringify(w.row()).indexOf(keyA) >= 0) bad.push("the retired key is stored in the clear");
  if(w.row().retired[sa].length !== 1) bad.push("the old key was not retired");
  /* THE OLD PHONE: every request it can make answers 'taken', not a hang and not a bare nothing */
  const mid = w.snap();
  for(const [what, req] of [["a frame", {op: "frame", table: w.ID, seat: sa, key: keyA, n: 50, frame: {ch: "lobby", m: L.hero(sa, "kayo")}}],
      ["a resync", {op: "resync", table: w.ID, seat: sa, key: keyA}], ["a claiming join", {op: "join", table: w.ID, seat: sa, key: keyA}]]){
    const r = w.go(req);
    if(r.ok !== false || r.refused !== "auth" || r.taken !== true) bad.push("the old key's " + what + " answered " + JSON.stringify(r).slice(0, 80));
    if(JSON.stringify(r).indexOf(keyC) >= 0 || r.frames) bad.push("the 'taken' answer carried something");
  }
  if(JSON.stringify(w.snap()) !== JSON.stringify(mid)) bad.push("the old phone's refused requests changed the table");
  /* a key that was never this seat's is a plain auth, no 'taken' */
  const stranger = w.go({op: "frame", table: w.ID, seat: sa, key: "0".repeat(32), n: 51, frame: {ch: "lobby", m: L.hero(sa, "kayo")}});
  if(stranger.refused !== "auth" || "taken" in stranger) bad.push("a stranger's key was told 'taken'");
  /* the old claim token no longer hands the old seat back */
  const old = w.go({op: "join", table: w.ID, claim: "tokenAAAAAAAAAAAAAAAA"});
  if(old.ok && old.seat === sa) bad.push("the old claim token still returns the seat");
  if(JSON.stringify(old).indexOf(keyC) >= 0) bad.push("the old claim token was handed the NEW key");
  /* the new key works; the other seat's key is unchanged and works */
  const n2 = hero(w, sa, keyC, c.n + 1, "kayo");
  if(!n2.ok) bad.push("the new key does not act: " + JSON.stringify(n2).slice(0, 80));
  if(!hero(w, sb, keyB, 1, "dash").ok) bad.push("the other seat lost its key");
  /* the old phone is told on its own channel, sealed under the key it holds */
  const notice = w.sent.filter(e => e.topic === topicA && e.payload.frames.some(f => f.taken));
  if(notice.length !== 1) bad.push(notice.length + " notices on the old channel");
  else {
    const p = notice[0].payload;
    if(p.mac !== SHA.frameMac(keyA, w.ID, sa, p.ver, p.frames)) bad.push("the notice is not sealed under the old key");
    if(JSON.stringify(p).indexOf(keyC) >= 0) bad.push("the notice carries the new key");
  }
  /* the push of the new seat's frames goes to the NEW topic only */
  if(w.sent.some(e => e.topic === topicA && !e.payload.frames.some(f => f.taken) && e.payload.ver > notice[0].payload.ver)) bad.push("the old channel is still being fed");
  void before;
  return bad;
}
test("(2) RECLAIM BY IDENTITY — the same player, no key, no claim token: a fresh key, the old phone told 'taken', its claim token dead, the other seat untouched", () => {
  assert.deepEqual(reclaimFailures(SERVER), []);
});
test("SABOTAGE (2): no retired list (old key just 'auth') / a takeover that keeps the old key / an old claim token left alive are each seen", () => {
  const noTaken = loadServer([["if((seat === 0 || seat === 1) && typeof key === \"string\" && retiredOf(row)[seat].includes(retireHash(row.id, seat, key))) return no(\"auth\", {taken: true});", ""]]);
  assert.ok(reclaimFailures(noTaken).some(x => /answered/.test(x)), "taken must be missed");
  const sameKey = loadServer([["const key = SHA.nonce(deps.rand ? deps.rand() : undefined);", "const key = oldKey;"]]);
  assert.ok(reclaimFailures(sameKey).some(x => /fresh key/.test(x)), "an unchanged key must be seen");
  const claimLive = loadServer([["row.claims[seat] = tok !== undefined ? tok : null;", "void 0;"]]);
  assert.ok(reclaimFailures(claimLive).some(x => /old claim token/.test(x)), "a live old claim token must be seen");
  const clear = loadServer([["row.retired[seat] = row.retired[seat].concat([retireHash(id, seat, oldKey)]).slice(-RETIRED_CAP);", "row.retired[seat] = row.retired[seat].concat([oldKey]).slice(-RETIRED_CAP);"]]);
  assert.ok(reclaimFailures(clear).some(x => /in the clear/.test(x)), "a key stored in the clear must be seen");
});
test("(2) A RECLAIM RIDES A CLAIM TOKEN TOO — lost answer to the takeover: the same token asked again gets the same new seat and key; a reclaim of a never-owned seat is just a join", () => {
  const w = world(SERVER, {salt: "rc2"}), P = w.idp.issue("P-zero");
  const a = w.join(P); const keyA = w.keyOf(a);
  const t1 = w.join(P, {claim: "newPhoneTokenAAAAAAAA"}), v = w.snap();
  const t2 = w.join(P, {claim: "newPhoneTokenAAAAAAAA"});
  assert.ok(t1.ok && t2.ok && t1.seat === a.seat && t2.seat === a.seat);
  assert.equal(w.keyOf(t2), w.keyOf(t1), "the retry gets the SAME new key"); assert.notEqual(w.keyOf(t1), keyA);
  assert.equal(JSON.stringify(w.snap()), JSON.stringify(v), "and writes nothing");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function forgedFailures(server){
  const bad = [], w = world(server, {salt: "forged"}), P = w.idp.issue("P-zero"), Pgone = w.idp.issue("P-gone");
  const a = w.join(P); w.idp.expire(Pgone);
  const base = w.snap(), keyA = w.keyOf(a);
  const tries = {"a forged token": w.join("jwt.forged.token"), "an expired token": w.join(Pgone),
    "a forged token on a reclaim path (owner's seat)": w.join("jwt.forged.token", {claim: "tokenAAAAAAAAAAAAAAAA"}),
    "a forged token on a keyed join": w.go({op: "join", table: w.ID, seat: a.seat, key: keyA, identity: {token: "jwt.forged.token"}})};
  for(const [what, r] of Object.entries(tries)){
    if(r.ok !== false || r.refused !== "identity") bad.push(what + ": answered " + JSON.stringify(r).slice(0, 80));
    if(r.frames) bad.push(what + ": the refusal carried frames");
  }
  if(JSON.stringify(w.snap()) !== JSON.stringify(base)) bad.push("a refused token changed the table (row, version or pushes)");
  /* malformed identity */
  for(const identity of [null, 7, "tok", [], {}, {token: 5}, {token: ""}, {token: "x".repeat(4097)}]){
    const r = w.go({op: "join", table: w.ID, identity});
    if(r.ok !== false || r.refused !== "bad-request") bad.push("identity " + JSON.stringify(identity).slice(0, 20) + ": " + JSON.stringify(r).slice(0, 60));
  }
  if(JSON.stringify(w.snap()) !== JSON.stringify(base)) bad.push("a malformed identity changed the table");
  /* a function with no identify never guesses */
  const w2 = world(server, {salt: "noid", noIdentify: true}), r2 = w2.join("some.token"), s2 = w2.snap();
  if(r2.refused !== "identity") bad.push("a function without identify answered " + JSON.stringify(r2).slice(0, 60));
  if(w2.row().hub.keys.some(Boolean)) bad.push("a seat was dealt to an unverifiable token");
  void s2;
  /* a provider outage is not a verdict */
  const logged = [], w3 = world(server, {salt: "down", identify: () => { throw new Error("provider down"); }}); w3.deps.log = e => logged.push(String(e));
  const r3 = w3.join("some.token");
  if(r3.refused !== "internal" || logged.length !== 1) bad.push("a provider outage answered " + JSON.stringify(r3) + " / " + logged.length + " log lines");
  if(JSON.stringify(r3).indexOf("provider down") >= 0) bad.push("the outage message left the function");
  if(w3.row().hub.keys.some(Boolean)) bad.push("a seat was dealt during an outage");
  /* identify answering nonsense is an internal fault, never a seat */
  const w4 = world(server, {salt: "junk", identify: () => ({player: {x: 1}})}); w4.deps.log = () => {};
  if(w4.join("t").refused !== "internal" || w4.row().hub.keys.some(Boolean)) bad.push("a junk identify answer was accepted");
  return bad;
}
test("(3) A FORGED, EXPIRED OR UNSUPPORTED TOKEN IS REFUSED AND CHANGES NOTHING — a provider outage is `internal`, malformed identity is `bad-request`", () => {
  assert.deepEqual(forgedFailures(SERVER), []);
});
test("SABOTAGE (3): a referee that treats a null identify as 'no identity' seats the forger", () => {
  const sab = loadServer([["if(who == null) return no(\"identity\");", "if(who == null) return joinAs(req, got, deps, null);"]]);
  assert.ok(forgedFailures(sab).length >= 2, "the forged-token drill must fail");
});

/* ---------------------------------------------------------------------------------------------- (4) */
function ownerFailures(server){
  const bad = [], w = world(server, {salt: "owner"}), P = w.idp.issue("P-zero"), Q = w.idp.issue("P-one");
  const a = w.join(P, {claim: "tokenAAAAAAAAAAAAAAAA"}), keyA = w.keyOf(a);
  /* the same player again, on a NEW claim token: it takes its own seat over, it never sits in the second chair */
  const again = w.join(P, {claim: "tokenPPPPPPPPPPPPPPPP"});
  if(!again.ok || again.seat !== a.seat) bad.push("the same player was dealt seat " + again.seat + " (first seat " + a.seat + ")");
  const keyNow = w.row().hub.keys[a.seat];
  const base = w.snap();
  /* another player: cannot take the seat by key, by claim token or by a keyed claim */
  const r1 = w.go({op: "join", table: w.ID, seat: a.seat, key: keyNow, identity: {token: Q}});
  if(r1.refused !== "seat-owned") bad.push("a keyed join with another player's token answered " + JSON.stringify(r1).slice(0, 60));
  const r2 = w.join(Q, {claim: "tokenPPPPPPPPPPPPPPPP"});
  if(r2.refused !== "seat-owned") bad.push("a replayed claim token of another player answered " + JSON.stringify(r2).slice(0, 60));
  if(JSON.stringify(w.snap()) !== JSON.stringify(base)) bad.push("a refused different player changed the table");
  if(JSON.stringify([r1, r2]).indexOf(keyNow) >= 0 || JSON.stringify([r1, r2]).indexOf("P-zero") >= 0) bad.push("the refusal named the owner or the key");
  /* the same player once more, with no token at all: still its own seat, never the second chair */
  const again2 = w.join(P);
  if(!again2.ok || again2.seat !== a.seat) bad.push("the same player, no token, was dealt seat " + again2.seat);
  if(w.row().hub.keys[1 - a.seat] != null) bad.push("a player's second join dealt the other seat's key");
  /* the other player simply takes the free chair, and then a third cannot join */
  const q = w.join(Q);
  if(!q.ok || q.seat === a.seat) bad.push("the second player did not get the other chair");
  const R3 = w.idp.issue("P-two"), r3 = w.join(R3);
  if(r3.refused !== "full") bad.push("a third player on a full table answered " + JSON.stringify(r3.refused));
  /* an owned seat still answers its key with no token (frames are authenticated by key and counter) */
  if(!w.go({op: "join", table: w.ID, seat: a.seat, key: w.row().hub.keys[a.seat]}).ok) bad.push("an owner's key alone stopped working");
  /* a casual seat claimed with a token later gets bound: same token + identity, once; another player then cannot */
  const w2 = world(server, {salt: "late"}), P2 = w2.idp.issue("P-late"), Q2 = w2.idp.issue("P-q");
  w2.join(null, {claim: "tokenLLLLLLLLLLLLLLLL"});
  const late = w2.join(P2, {claim: "tokenLLLLLLLLLLLLLLLL"});
  if(!late.ok || late.owned !== true || w2.row().owners.filter(Boolean).length !== 1) bad.push("a claim token + identity did not bind the casual seat");
  if(w2.join(Q2, {claim: "tokenLLLLLLLLLLLLLLLL"}).refused !== "seat-owned") bad.push("another player took a bound seat through its claim token");
  return bad;
}
test("(4) ANOTHER PLAYER CANNOT TAKE A SEAT, AND A PLAYER NEVER HOLDS BOTH — by key, by claim token, by a second join", () => {
  assert.deepEqual(ownerFailures(SERVER), []);
});
test("SABOTAGE (4): without the takeover branch the same player sits in both chairs; without the owner check another player rides the key", () => {
  const both = loadServer([["if(mine >= 0) return takeOver(row, got, deps, who, mine, tok);", "if(false) return takeOver(row, got, deps, who, mine, tok);"]]);
  assert.ok(ownerFailures(both).some(x => /same player/.test(x)), "both chairs must be seen");
  const ride = loadServer([["if(who && ownersOf(row)[req.seat] != null && ownersOf(row)[req.seat] !== who.player) return no(\"seat-owned\");", ""]]);
  assert.ok(ownerFailures(ride).some(x => /keyed join with another/.test(x)), "the key ride must be seen");
  const claimRide = loadServer([["if(owner != null && owner !== who.player) return no(\"seat-owned\");", ""]]);
  assert.ok(ownerFailures(claimRide).length >= 1, "the claim ride must be seen");
});

/* ---------------------------------------------------------------------------------------------- (5) */
const GOOD = ["Dawn Smith", "Ana", "Zoë López", "Иван Петров", "李明华", "田中 太郎", "محمد علي", "สมชาย ใจดี", "Ng Văn An", "Player 42", "ÅÄÖ Åse", "a".repeat(16), "Ωmega Λab"];
const BAD = [["", "short"], ["ab", "short"], ["a".repeat(17), "long"], [" Ana", "space"], ["Ana ", "space"], ["Ana  Lee", "space"], ["Ana\tLee", "chars"], ["Ana\nLee", "chars"],
  ["Ana!", "chars"], ["Ana_Lee", "chars"], ["Ana\u{1F600}", "chars"], ["\u{1F600}\u{1F600}\u{1F600}", "chars"], ["A\u200bna", "chars"], ["A\u202ena", "chars"], ["-Ana", "chars"], ["Ana\u0300\u0301\u0302\u0303\u0304", "chars"],
  ["Admin", "reserved"], ["Dawn Blade", "reserved"], ["ADMIN", "reserved"], ["a d m i n", "reserved"], ["Adm1n", "reserved"], ["аdmin", "reserved"], ["Judge", "reserved"], ["You", "reserved"], ["Dawnblade", "reserved"],
  ["Mod", "reserved"], ["Referee", "reserved"], [null, "type"], [42, "type"], [{}, "type"]];
const nameFailures = validate => {
  const bad = [];
  for(const g of GOOD){ const r = validate(g); if(!r.ok) bad.push("good name refused: " + g + " (" + r.reason + ")"); }
  for(const [n, why] of BAD){ const r = validate(n); if(r.ok || r.reason !== why) bad.push("bad name " + JSON.stringify(n) + " answered " + JSON.stringify(r)); }
  /* NFC: a decomposed é is the same 3-letter name as a composed one */
  const a = validate("José"), b = validate("José");
  if(!a.ok || !b.ok || a.name !== b.name) bad.push("NFC is not applied");
  return bad;
};
test("(5) THE NAME VALIDATOR — 3-16 characters, international letters and digits, single spaces, no symbols, reserved words and look-alikes; NFC", () => {
  assert.deepEqual(nameFailures(SERVER.validateName), []);
});
test("SABOTAGE (5): a validator with no character class, or no reserved list, or no trim rule fails", () => {
  for(const [a, b] of [["if(!/^[\\p{L}\\p{M}\\p{Nd} ]+$/u.test(s) || !/^[\\p{L}\\p{Nd}]/u.test(s)) return {ok: false, reason: \"chars\"};", ""],
    ["if(NAME_FOLDED.includes(nameFold(s))) return {ok: false, reason: \"reserved\"};", ""], ["if(s !== s.trim()) return {ok: false, reason: \"space\"};", ""]]){
    const sab = loadServer([[a, b]]);
    assert.ok(nameFailures(sab.validateName).length >= 1, "the broken validator must be seen: " + a.slice(0, 30));
  }
});
function nameJoinFailures(server){
  const bad = [], w = world(server, {salt: "names"}), P = w.idp.issue("P-zero"), Q = w.idp.issue("P-one", "Stored Name"), Z = w.idp.issue("P-zed", "x!");
  const base = w.snap();
  for(const name of ["ab", "Admin", "Ana!", 5]){
    const r = w.go({op: "join", table: w.ID, identity: {token: P, name}});
    if(r.refused !== "bad-request" || r.field !== "name" || typeof r.reason !== "string") bad.push("name " + JSON.stringify(name) + " answered " + JSON.stringify(r).slice(0, 80));
  }
  if(JSON.stringify(w.snap()) !== JSON.stringify(base)) bad.push("a refused name changed the table");
  const a = w.go({op: "join", table: w.ID, identity: {token: P, name: "Dawn Smith"}});
  if(!a.ok || JSON.stringify(a.names) !== JSON.stringify(a.seat === 0 ? ["Dawn Smith", null] : [null, "Dawn Smith"])) bad.push("the namer's own answer does not carry the public names: " + JSON.stringify(a.names));
  const b = w.join(Q);                         /* no name in the request: the provider's stored default, validated */
  const bn = b.seat === 0 ? ["Stored Name", "Dawn Smith"] : ["Dawn Smith", "Stored Name"];
  if(!b.ok || JSON.stringify(b.names) !== JSON.stringify(bn)) bad.push("the other seat's answer does not carry both names: " + JSON.stringify(b.names));
  /* PUBLIC to both: the first seat reads the second's name on its keyed join */
  const back = w.go({op: "join", table: w.ID, seat: a.seat, key: w.keyOf(a)});
  if(JSON.stringify(back.names) !== JSON.stringify(bn)) bad.push("a keyed join does not show both names");
  const z = world(server, {salt: "badstored"}), zt = z.idp.issue("P-z", "x!"), zr = z.join(zt);
  if(!zr.ok || "names" in zr) bad.push("an invalid stored default name was not dropped");
  void Z;
  /* nothing private: no player id, no token, no provider detail, in either seat's answers or any push */
  const text = JSON.stringify([a, b, back, w.sent]);
  for(const x of ["P-zero", "P-one", P, Q, "jwt."]) if(text.indexOf(x) >= 0) bad.push("a private identity string reached a response or push: " + x);
  return bad;
}
test("(5) NAMES RIDE THE IDENTITY — validated, public to both seats, an invalid one is refused with a reason; no player id or token in any answer", () => {
  assert.deepEqual(nameJoinFailures(SERVER), []);
});
test("SABOTAGE (5b): a referee that skips the name check, or answers with the player id, is seen", () => {
  const noCheck = loadServer([["if(!v.ok) return no(\"bad-request\", {field: \"name\", reason: v.reason});", ""]]);
  assert.ok(nameJoinFailures(noCheck).length >= 1);
  const leakId = loadServer([["const pub = row => { const n = namesOf(row);", "const pub = row => { const n = namesOf(row); if(row.owners) return {names: n.slice(), who: row.owners};"]]);
  assert.ok(nameJoinFailures(leakId).some(x => /private identity string/.test(x)));
});

/* ---------------------------------------------------------------------------------------------- (6) */
/* the same deal the table recorded, played by the in-process referee with the same policy */
function reference(audit){
  const row = audit.store.row(audit.code).hub, spec = row.spec;
  const d = T.dealSpec({...spec, seed: SHA.seedOf(row.seedH, spec.seedG)});
  const ref = R.createReferee({state: d.state, reduce: J.reduce, legal: J.legal, check: INV.errors, catalog: d.catalog});
  let n = 0;
  while(!ref.over() && n++ < 3000){
    let moved = false;
    for(const s of [0, 1]){ const a = SP.act(ref.view(s), s, {search: false}); if(!a) continue;
      const r = ref.intent(s, a); if(r.error) throw new Error("the reference refused " + s + ": " + r.error); moved = true; break; }
    if(!moved) break;
  }
  return ref;
}
function takeoverGame(server, cap){
  const idp = F.memIdentity(), ids = ["P-seat-zero-id", "P-seat-one-id"], toks = ids.map(i => idp.issue(i, i === ids[0] ? "Dawn Smith" : "Rival One"));
  const lose = new Set();
  const mk = makeServerHub({server, seedKey: "srv-s2", identify: t => idp.identify(t), identities: toks, lose, secrets: ids.concat(toks)});
  let hub; const t = T.makeTable({heroes: ["blaze", "dorinthea"], salt: "srv-s2", throws: [["rock", "rock"], ["paper", "rock"]], makeHub: o => (hub = mk(o))}).open();
  const ps = t.seatPhones(), audit = hub.audit;
  const oldKeys = {}, drops = [], marks = {};
  let steps = 0, mism = 0;
  while(steps < (cap || 3000) && t.step()){
    steps++;
    for(const s of [0, 1]) if(!t.agrees(s)) mism++;
    /* at action 40 and again at 100, a phone loses its key: seat 0 first, then seat 1 */
    if(steps === 40 || steps === 100){
      const s = steps === 40 ? 0 : 1, row = audit.store.row(audit.code);
      oldKeys[s] = row.hub.keys[s]; drops.push(s); marks[s] = audit.resps.length;
      ps[s].drop(); lose.add(s); ps[s].redial(); t.flush(); lose.delete(s);
      if(audit.store.row(audit.code).hub.keys[s] === oldKeys[s]) throw new Error("the reclaim did not move the key");
    }
  }
  return {t, hub, audit, steps, mism, oldKeys, drops, idp, ids, toks, marks};
}
let GAME = null;
const game = () => GAME || (GAME = takeoverGame(SERVER));
test("(6) A WHOLE GAME, A PHONE LOSES ITS KEY MID-GAME AND RECLAIMS BY IDENTITY (twice, one per seat) — it ends, and is the game the in-process referee plays", () => {
  const g = game(), au = g.audit, full = g.hub.session().full();
  assert.ok(full.over, "the game finished");
  assert.deepEqual(g.drops, [0, 1]);
  assert.equal(g.mism, 0, "each phone's fingerprint was the referee's view of its seat at every step");
  assert.deepEqual(au.errors, [], "no internal error");
  const ref = reference(au);
  assert.ok(ref.over());
  assert.equal(Wr.hash(full), Wr.hash(ref.state()), "final fingerprint, server vs in-process referee");
  assert.deepEqual(json(g.hub.session().log()), json(ref.log()), "the same actions in the same order");
  const row = au.store.row(au.code);
  assert.equal(row.v, 3); assert.deepEqual(row.retired.map(l => l.length), [1, 1], "one retired key per seat");
  /* the refused kinds in this game are exactly the harness's own redial 'full' + nothing else surprising */
  assert.ok(au.refused.every(r => r === "full"), "only the redial's fresh join met a full table: " + [...new Set(au.refused)]);
  /* the old phones: refused 'taken' */
  for(const s of [0, 1]){
    const r = json(SERVER.handleNow({op: "resync", table: au.code, seat: s, key: g.oldKeys[s]}, au.deps));
    assert.deepEqual([r.ok, r.refused, r.taken], [false, "auth", true], "seat " + s + "'s old phone");
  }
});
test("(6) BLINDNESS AND NO IDENTITY LEAK — every response, broadcast, frame and report, as text, for the player ids, the tokens and the retired keys; the audit's own scans", () => {
  const g = game(), au = g.audit;
  assert.deepEqual(au.leaks, [], "the audit (keys, seed, channel names, ids, tokens) found: " + au.leaks.slice(0, 2));
  const secrets = g.ids.concat(g.toks, Object.values(g.oldKeys));
  /* ids and tokens: nowhere. A retired key is its own phone's to know, so: in no broadcast, and in no response after its
     takeover (the old phone's inbox, and the answers that dealt it, are the only places it was ever sent) */
  const hay = JSON.stringify([au.resps, au.bus.log, g.t.phones.map(p => p.inbox)]);
  for(const x of g.ids.concat(g.toks)) assert.equal(hay.indexOf(x), -1, "an id or token reached a response, broadcast or frame: " + x.slice(0, 6));
  for(const s of [0, 1]){
    assert.equal(JSON.stringify(au.bus.log).indexOf(g.oldKeys[s]), -1, "seat " + s + "'s retired key reached a broadcast");
    assert.equal(JSON.stringify(au.resps.slice(g.marks[s])).indexOf(g.oldKeys[s]), -1, "seat " + s + "'s retired key came back in a response");
  }
  /* a JUDGE!! report of the finished game, as the page builds it (handed the table CODE only) */
  const rep = JSON.stringify(Report.build(g.hub.session().state(), {source: "table", table: au.code, mySeat: 0}));
  for(const x of secrets) assert.equal(rep.indexOf(x), -1, "a private string reached a JUDGE!! report");
  /* the public names did ride the answers (so the scan above is not vacuous about names) */
  assert.ok(au.resps.some(r => r.names && r.names.includes("Dawn Smith") && r.names.includes("Rival One")), "both names were public");
  assert.ok(au.bus.log.every(e => Object.keys(e.payload).sort().join() === "frames,mac,ver"), "no broadcast envelope grew a field");
});
test("SABOTAGE (6): an id in a response, a report or a broadcast, and a retired key echoed, are each caught by the scans", () => {
  const g = game(), au = g.audit;
  const secrets = g.ids.concat(g.toks, Object.values(g.oldKeys));
  const dirty = JSON.stringify([...au.resps, {ok: true, who: g.ids[0]}]);
  assert.ok(secrets.some(x => dirty.indexOf(x) >= 0), "the response scan must see a leaked id");
  const st = json(g.hub.session().state()); st.sides[0].name = g.ids[1];
  assert.ok(JSON.stringify(Report.build(st, {source: "table", table: au.code})).indexOf(g.ids[1]) >= 0, "the report scan must see a leaked id");
  /* the audit itself: a referee that pushes the player id inside a frame is flagged through `secrets` */
  const idp = F.memIdentity(), tok = idp.issue("P-leaky-id");
  const leaky = loadServer([["const notice = [{ch: Hub.CH.JUDGE, taken: true, seat}];", "const notice = [{ch: Hub.CH.JUDGE, taken: true, seat, who: who.player}];"]]);
  const w = world(leaky, {salt: "leak", identify: t => idp.identify(t)});
  w.join(tok); w.join(tok);
  assert.ok(JSON.stringify(w.sent).indexOf("P-seat-zero-id") < 0 && JSON.stringify(w.sent).indexOf("P-leaky-id") >= 0, "an id in a notice is visible to the scan");
  /* and the audit inside the server hub (the one every drill uses) flags it through `secrets` */
  const g2 = takeoverGame(leaky, 45);
  assert.ok(g2.audit.leaks.some(l => /identity secret/.test(l)), "the hub audit must flag the id in the notice: " + g2.audit.leaks.slice(0, 2));
  assert.deepEqual(game().audit.leaks, [], "(control) the real referee leaks nothing");
});
test("LEDGER — the identity seam is the whole provider surface: referee.js names no provider, no URL, no HTTP", () => {
  assert.ok(!/supabase|auth\/v1|fetch\(|https?:\/\//i.test(SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "the referee core must be provider-free");
  assert.ok(/deps\.identify/.test(SRC));
});
