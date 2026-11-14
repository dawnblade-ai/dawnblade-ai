/* test/servertablecap.test.js — AT MOST 5 OPEN TABLES PER PLAYER (SERVER S4.4; RULING user 2026-11-14: "cap 5 open tables per player").

   server/referee.js, over the fake store that behaves like 005_table_cap.sql's table_create_capped (test/helpers/serverfakes.js).
   OPEN = created by this player, game not finished, not closed by its creator (and not idle 48 hours: the SQL's own proof, PGlite).
   The drills, each with its sabotage:

     (1) THE CAP — five signed-in creates succeed; the sixth is refused `table-cap` with the five codes and writes NOTHING; another player,
         casual creates and a JOIN of someone else's table never count; the casual create is the v6.28 one (no creator, v2).
     (2) A FINISHED GAME LETS GO — a whole game played to its end marks the creator's row over: the player may open again at the cap.
     (3) CLOSE — the creator closes their own table (frees a slot; the table is gone for both seats); another player, a casual table, a forged
         token and a missing table are each refused with their own word; closing twice writes nothing.
     (4) A RACE — at four open, simultaneous creates yield exactly ONE more (the store decides, atomically).
     (5) NO LEAK — a refusal and a close carry no player id, token, seat key or channel name; the codes in a refusal are the player's own.
     (6) THE PHONE — engine/servertable.js sends the sign-in at create, reads `table-cap` as its own word with the codes, falls back to a casual
         table when the referee will not take the sign-in, and closeTable maps the answers. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeWorld} = require("./helpers/servertransport.js");
const PH = require("./helpers/serverphone.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
const ST = require("../engine/servertable.js");
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
const STSRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
function stCopy(edits){
  let src = STSRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "engine", p)), undefined);
  return m.exports;
}

/* a referee over the fake store, with a sign-in provider; `go` answers one request as JSON */
function world(server, o){
  o = o || {};
  const store = o.store || F.memStore(), idp = F.memIdentity(), sent = [];
  let clock = 1700000000000; const rnd = T.seeded("cap|" + (o.salt || ""));
  const deps = {store: o.lag ? F.lagged(store) : store, broadcast: (t, p) => sent.push({topic: t, payload: json(p)}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => rnd,
    identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f)};
  const go = req => json(server.handleNow(req, deps));
  const goAsync = req => server.handle(req, deps).then(json);
  const player = (id, name) => ({id, tok: idp.issue(id, name)});
  const create = (pl, extra) => go({op: "create", identity: {token: pl.tok}, ...(extra || {})});
  return {server, store, idp, deps, sent, go, goAsync, player, create};
}
const open5 = (w, pl) => { const ids = []; for(let i = 0; i < 5; i++){ const r = w.create(pl); assert.ok(r.ok, "create " + (i + 1) + ": " + JSON.stringify(r)); ids.push(r.table); } return ids; };

/* ---------------------------------------------------------------------------------------------- (1) */
function capFailures(server, store){
  const bad = [], w = world(server, {salt: "cap1", store});
  const P = w.player("P-cap-one"), Q = w.player("P-cap-two");
  const made = [];
  for(let i = 0; i < 5; i++){ const r = w.create(P); if(!r.ok) return ["create " + (i + 1) + " of 5 was refused: " + JSON.stringify(r)]; made.push(r.table); }
  const rowOf = made.map(id => w.store.row(id));
  if(!rowOf.every(r => r.v === 3 && r.creator === "P-cap-one" && Array.isArray(r.owners) && r.owners.every(x => x === null))) bad.push("a signed-in create is not a v3 row recording its creator");
  const before = w.store.rows.size, puts = w.store.puts;
  const six = w.create(P);
  if(six.ok || six.refused !== "table-cap") bad.push("the sixth open table was not refused table-cap: " + JSON.stringify(six));
  else {
    if(six.cap !== 5) bad.push("the refusal does not say the cap");
    if(JSON.stringify(six.open) !== JSON.stringify(made)) bad.push("the refusal's codes are not the five open tables, oldest first: " + JSON.stringify(six.open));
    if(Object.keys(six).sort().join() !== "cap,ok,open,refused") bad.push("the refusal carries something besides ok, refused, cap and open: " + Object.keys(six));
  }
  if(w.store.rows.size !== before || w.store.puts !== puts) bad.push("a refused create wrote something");
  /* the same refusal again (nothing moved), and a client-chosen code is capped too */
  const six2 = w.create(P, {table: "CHOSEN"});
  if(six2.refused !== "table-cap" || w.store.row("CHOSEN")) bad.push("a create with a chosen code got round the cap");
  /* another player is unaffected; casual creates never count and are never refused */
  if(!w.create(Q).ok) bad.push("another player was held to this player's tables");
  const casual = []; for(let i = 0; i < 8; i++){ const r = w.go({op: "create"}); if(!r.ok) bad.push("a casual create was refused: " + JSON.stringify(r)); else casual.push(r.table); }
  for(const id of casual){ const r = w.store.row(id); if(r.v !== 2 || "creator" in r || "owners" in r) bad.push("a casual row is not the v6.28 row"); }
  if(!casual.length || w.create(P).refused !== "table-cap") bad.push("casual tables changed this player's count");
  return bad;
}
test("(1) THE CAP — five open tables per signed-in player; the sixth is refused `table-cap` with the five codes and writes nothing; other players and casual tables are untouched", () => {
  assert.deepEqual(capFailures(SERVER), []);
});
test("SABOTAGE (1): a store that never counts, a referee that creates signed-in tables with a plain put, and a refusal that stores the row are each seen", () => {
  const noCount = F.memStore(); noCount.noCount = true;
  assert.ok(capFailures(SERVER, noCount).some(x => /sixth open table/.test(x)), "a store that never counts must be seen");
  const plainPut = loadServer([["then(deps.store.createCapped(id, row, who.player, OPEN_CAP), p => {", "then(deps.store.put(id, row, 0), p => {"]]);
  assert.ok(capFailures(plainPut).some(x => /sixth open table/.test(x)), "an uncounted create must be seen");
  const leaky = loadServer([["return no(\"table-cap\", {cap: OPEN_CAP, open:", "return no(\"table-cap\", {cap: OPEN_CAP, who: who.player, open:"]]);
  assert.ok(capFailures(leaky).some(x => /something besides/.test(x)), "an extra field in the refusal must be seen");
  const casualStamp = loadServer([["const row = newRow(id, r.hub, deps);\n  return then(deps.store.put(id, row, 0), p => p && p.ok", "const row = newRow(id, r.hub, deps); row.creator = \"x\";\n  return then(deps.store.put(id, row, 0), p => p && p.ok"]]);
  assert.ok(capFailures(casualStamp).some(x => /casual row is not the v6.28 row/.test(x)), "a casual row that gets a creator must be seen");
});
test("(1) NO STORE THAT CAN COUNT, NO SIGNED-IN TABLE — the referee never creates an unchecked table for a signed-in player; the casual create still works on that store", () => {
  const store = F.memStore(); delete store.createCapped;
  const w = world(SERVER, {store, salt: "nocount"}), P = w.player("P-x");
  assert.deepEqual([w.create(P).ok, w.create(P).refused], [false, "unavailable"]);
  assert.equal(w.store.rows.size, 0);
  assert.ok(w.go({op: "create"}).ok, "a casual create needs nothing of the store");
  const forged = w.go({op: "create", identity: {token: "jwt.forged"}});
  assert.deepEqual([forged.ok, forged.refused], [false, "identity"]);
  assert.equal(w.go({op: "create", identity: {}}).refused, "bad-request");
  assert.equal(w.go({op: "create", identity: "tok"}).refused, "bad-request");
});

function joinFailures(server, store){
  const bad = [], w = world(server, {salt: "joins", store}), host = w.player("P-host"), guest = w.player("P-guest");
  const theirs = open5(w, host);
  for(const id of theirs){ const j = w.go({op: "join", table: id, identity: {token: guest.tok}}); if(!j.ok || j.owned !== true) bad.push("the guest did not sit down at " + id); }
  if(w.store.rows.size !== 5) bad.push("joining created a table");
  let mine = 0; for(let i = 0; i < 5; i++) if(w.create(guest).ok) mine++;
  if(mine !== 5) bad.push("the guest, with five joins behind them, opened only " + mine + " tables");
  if(w.create(guest).refused !== "table-cap") bad.push("the guest's own sixth was not refused");
  /* the creator sitting at their own table is not a second table */
  const own = w.store.openOf("P-guest"); for(const id of own) if(!w.go({op: "join", table: id, identity: {token: guest.tok}}).ok) bad.push("the creator could not sit at their own table");
  if(w.store.openOf("P-guest").length !== 5) bad.push("a creator's own join changed the count");
  /* and the host, whose five are full of guests, is still at their cap */
  if(w.create(host).refused !== "table-cap") bad.push("the host's count changed");
  return bad;
}
test("(1) JOINING SOMEONE ELSE'S TABLE DOES NOT COUNT — five joins as a guest leave the player's own five slots; a player's own join does not double-count", () => {
  assert.deepEqual(joinFailures(SERVER), []);
});
test("SABOTAGE (1b): a count that includes the tables a player merely sits at (owners) is seen", () => {
  const sab = F.memStore();
  sab.openOf = c => [...sab.rows.entries()].filter(([, e]) => { const r = JSON.parse(e.json); return r.over !== true && (r.creator === c || (r.owners || []).includes(c)); }).map(([id]) => id);
  sab.createCapped = (id, row, creator, cap) => { if(sab.rows.has(id)) return {ok: false, exists: true}; const o = sab.openOf(creator); if(o.length >= cap) return {ok: false, capped: true, open: o}; return sab.put(id, row, 0); };
  assert.ok(joinFailures(SERVER, sab).some(x => /guest, with five joins/.test(x)), "joins that count must be seen");
});

/* ---------------------------------------------------------------------------------------------- (2) */
/* a whole game, created signed in by seat 0's player; cached (about ten seconds) */
let GAME = null;
function finishedGame(server, cap){
  const idp = F.memIdentity(), ids = ["P-game-zero", "P-game-one"], toks = ids.map(i => idp.issue(i));
  const mk = makeServerHub({server, seedKey: "srv-s4", identify: t => idp.identify(t), identities: toks, creator: toks[0], secrets: ids.concat(toks)});
  let hub; const t = T.makeTable({heroes: ["blaze", "dorinthea"], salt: "srv-s4", throws: [["rock", "rock"], ["paper", "rock"]], makeHub: o => (hub = mk(o))}).open();
  const au = hub.audit; let steps = 0, midOver = null, midOpen = null;
  while(steps < (cap || 3000) && t.step()){
    steps++;
    if(steps === 30){ midOver = au.store.row(au.code).over; midOpen = au.store.openOf(ids[0]).length; }
  }
  return {t, hub, audit: au, ids, toks, idp, midOver, midOpen, steps};
}
const game = () => GAME || (GAME = finishedGame(SERVER));
function finishedFailures(g){
  const bad = [], au = g.audit;
  if(!g.hub.session().full().over) return ["the game did not finish"];
  if(g.midOpen !== 1) bad.push("mid-game the table did not count as open");
  if(g.midOver === true) bad.push("mid-game the row was already over");
  if(au.store.row(au.code).over !== true) bad.push("the finished row is not marked over");
  if(au.store.openOf(g.ids[0]).length !== 0) bad.push("a finished table still counts as open");
  /* at the cap: the finished one does not take a slot — five more open, the sixth refused */
  const w = world(SERVER, {salt: "fin", store: au.store}), P = {id: g.ids[0], tok: g.toks[0]};
  w.idp.live.set(P.tok, {player: P.id});
  let n = 0; for(let i = 0; i < 5; i++) if(w.create(P).ok) n++;
  if(n !== 5) bad.push("with one finished table behind them the player could open only " + n + " more");
  if(w.create(P).refused !== "table-cap") bad.push("the sixth open table was not refused");
  if(au.store.row(au.code).creator !== g.ids[0]) bad.push("the row does not record its creator");
  return bad;
}
test("(2) A FINISHED GAME LETS GO — while it is played the creator's table is open; when the session ends the row is marked over and the player may open again at the cap", () => {
  assert.deepEqual(finishedFailures(game()), []);
});
test("SABOTAGE (2): a referee that never marks a finished game over keeps it counted", () => {
  const sab = loadServer([["if(row.creator != null && row.over !== true){ const s = r.hub.session(); if(s && s.over()) row.over = true; }", ""]]);
  assert.ok(finishedFailures(finishedGame(sab)).some(x => /not marked over|still counts/.test(x)), "a finished table that keeps counting must be seen");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function closeFailures(server){
  const bad = [], w = world(server, {salt: "close"}), P = w.player("P-closer"), Q = w.player("P-other");
  const made = open5(w, P);
  if(w.create(P).refused !== "table-cap") return ["the cap did not hold before the close"];
  const a = w.go({op: "join", table: made[0], identity: {token: P.tok}}), b = w.go({op: "join", table: made[0], identity: {token: Q.tok}});
  if(!a.ok || !b.ok || a.seat === b.seat) return ["two players did not sit at the table to be closed"];
  const keyA = (a.frames.find(f => f.ch === "judge" && f.key) || {}).key, keyB = (b.frames.find(f => f.ch === "judge" && f.key) || {}).key;
  const ask = (tok, table) => w.go({op: "close", table, identity: {token: tok}});
  const snap = () => w.store.json(made[0]) + "|" + w.store.version(made[0]);
  /* not theirs: another player (even one sitting at it), a casual table, a table that is not there, a forged token, a malformed ask */
  const casual = w.go({op: "create"}).table;
  const before = snap();
  for(const [what, r, want] of [["another player", ask(Q.tok, made[0]), "not-creator"], ["a casual table", ask(P.tok, casual), "not-creator"], ["a missing table", ask(P.tok, "ZZZZZZ"), "no-table"],
      ["a forged token", ask("jwt.forged", made[0]), "identity"], ["no token", w.go({op: "close", table: made[0]}), "bad-request"], ["a bad code", ask(P.tok, "x y"), "bad-request"]])
    if(r.ok || r.refused !== want) bad.push(what + " answered " + JSON.stringify(r) + ", wanted " + want);
  if(snap() !== before) bad.push("a refused close changed the table");
  if(w.create(P).refused !== "table-cap") bad.push("a refused close freed a slot");
  /* the creator's close: one slot freed, exactly one more table may be opened */
  const r = ask(P.tok, made[0]);
  if(!r.ok || Object.keys(r).join() !== "ok") bad.push("the creator's close answered " + JSON.stringify(r));
  const row = w.store.row(made[0]);
  if(row.over !== true || row.closed !== true) bad.push("the closed row is not over and closed");
  if(!w.create(P).ok) bad.push("a closed table did not free a slot");
  if(w.create(P).refused !== "table-cap") bad.push("closing one freed more than one slot");
  /* the table is gone for both seats: join, frame, resync */
  const gone = [w.go({op: "join", table: made[0], identity: {token: Q.tok}}), w.go({op: "join", table: made[0], seat: a.seat, key: keyA}),
    w.go({op: "frame", table: made[0], seat: b.seat, key: keyB, n: 1, frame: {ch: "lobby", m: {t: "noop"}}}), w.go({op: "resync", table: made[0], seat: b.seat, key: keyB})];
  if(!gone.every(g => g.ok === false && g.refused === "no-table")) bad.push("a closed table still answers: " + JSON.stringify(gone.map(g => g.refused)));
  /* closing it again: it is gone (no-table), writes nothing; and a table that finished is closed as ok without a write */
  const v = w.store.version(made[0]);
  if(ask(P.tok, made[0]).refused !== "no-table" || w.store.version(made[0]) !== v) bad.push("a second close wrote something or was not 'no-table'");
  w.store.put(made[1], {...w.store.row(made[1]), over: true}, w.store.version(made[1]));
  const v1 = w.store.version(made[1]);
  if(!ask(P.tok, made[1]).ok || w.store.version(made[1]) !== v1) bad.push("closing a finished table was not a quiet ok");
  return bad;
}
test("(3) CLOSE — the creator frees one slot and the table is gone for both seats; another player, a casual table, a forged token and a missing table are refused with their own word", () => {
  assert.deepEqual(closeFailures(SERVER), []);
});
test("SABOTAGE (3): a close that anyone may do, one that does not mark the row, and one that leaves the table playable are each seen", () => {
  const anyone = loadServer([["if(got.row.creator == null || got.row.creator !== who.player) return no(\"not-creator\");", ""]]);
  assert.ok(closeFailures(anyone).some(x => /another player answered/.test(x) || /casual table answered/.test(x)), "a close by anyone must be seen");
  const unmarked = loadServer([["const row = got.row; row.over = true; row.closed = true;", "const row = got.row; row.closed = true;"]]);
  assert.ok(closeFailures(unmarked).some(x => /did not free a slot|not over and closed/.test(x)), "a close that leaves the table counted must be seen");
  const playable = loadServer([["if(!got || !got.row || got.row.closed === true) return no(\"no-table\");       /* a closed table", "if(!got || !got.row) return no(\"no-table\");       /* a closed table"]]);
  assert.ok(closeFailures(playable).some(x => /still answers/.test(x)), "a closed table that still answers must be seen");
});

/* ---------------------------------------------------------------------------------------------- (4) */
async function raceFailures(server, mkStoreFor){
  const bad = [];
  for(const [label, n] of [["two", 2], ["eight", 8]]){
    const store = mkStoreFor ? mkStoreFor() : F.memStore();
    const w = world(server, {salt: "race" + label, store, lag: true}), P = w.player("P-racer"), Q = w.player("P-bystander");
    /* the lagged store answers through promises, so every request goes through `handle` */
    const setup = []; for(let i = 0; i < 4; i++) setup.push(await w.goAsync({op: "create", identity: {token: P.tok}}));
    if(!setup.every(r => r.ok)) { bad.push("four setup creates failed: " + JSON.stringify(setup.map(r => r.refused))); continue; }
    const answers = await Promise.all(Array.from({length: n}, () => w.goAsync({op: "create", identity: {token: P.tok}})));
    const ok = answers.filter(r => r.ok).length, capped = answers.filter(r => r.refused === "table-cap").length;
    if(ok !== 1 || capped !== n - 1) bad.push(label + " simultaneous creates at four open: " + ok + " created, " + capped + " refused (wanted 1 and " + (n - 1) + ")");
    if(store.openOf("P-racer").length !== 5) bad.push(label + ": the player ended with " + store.openOf("P-racer").length + " open tables, not 5");
    /* a different player's simultaneous create is not held up by this player's */
    const mixed = await Promise.all([w.goAsync({op: "create", identity: {token: P.tok}}), w.goAsync({op: "create", identity: {token: Q.tok}})]);
    if(mixed[0].refused !== "table-cap" || !mixed[1].ok) bad.push(label + ": a bystander's create was refused or the full player's passed: " + JSON.stringify(mixed.map(r => r.refused || "ok")));
  }
  return bad;
}
test("(4) A RACE — at four open, two (and eight) simultaneous creates yield exactly one more table; a bystander's create is untouched", async () => {
  assert.deepEqual(await raceFailures(SERVER), []);
});
test("SABOTAGE (4): a referee that counts and THEN inserts as two steps lets simultaneous creates through", async () => {
  const racy = loadServer([["then(deps.store.createCapped(id, row, who.player, OPEN_CAP), p => {",
    "then(deps.store.openOf(who.player).length >= OPEN_CAP ? {capped: true, open: deps.store.openOf(who.player)} : deps.store.put(id, row, 0), p => {"]]);
  const bad = await raceFailures(racy);
  assert.ok(bad.some(x => /simultaneous creates at four open/.test(x)), "the two-step count must be seen: " + bad.slice(0, 2));
});

/* ---------------------------------------------------------------------------------------------- (5) */
function leakFailures(server, store){
  const bad = [], w = world(server, {salt: "leak", store}), P = w.player("P-leak-id-one"), Q = w.player("P-leak-id-two");
  const made = open5(w, P);
  const j = w.go({op: "join", table: made[0], identity: {token: Q.tok}});
  const keys = w.store.row(made[0]).hub.keys.filter(Boolean);
  const answers = [w.create(P), w.go({op: "close", table: made[1], identity: {token: P.tok}}), w.go({op: "close", table: made[2], identity: {token: Q.tok}}), w.go({op: "close", table: made[1], identity: {token: P.tok}}), w.create(P)];
  const text = JSON.stringify(answers) + JSON.stringify(w.sent) + JSON.stringify(j.names || null);
  for(const x of ["P-leak-id-one", "P-leak-id-two", P.tok, Q.tok, ...keys, ...keys.map(k => server.topic(made[0], 0, k).split(":")[2])]) if(text.indexOf(x) >= 0) bad.push("a private string is in an answer or a broadcast: " + String(x).slice(0, 12));
  const cap = answers[4];
  if(cap.refused === "table-cap" && cap.open.some(c => made.indexOf(c) < 0)) bad.push("the refusal names a table that is not this player's");
  /* the codes in a refusal are the player's OWN open tables: not a table another player made */
  const other = w.create(Q); if(!other.ok) bad.push("setup: the other player's table");
  const again = w.create(P);
  if(again.refused === "table-cap" && again.open.indexOf(other.table) >= 0) bad.push("the refusal lists another player's table");
  return bad;
}
test("(5) NO LEAK — a refusal and a close carry no player id, token, seat key or channel name; the codes in a refusal are the player's own open tables", () => {
  assert.deepEqual(leakFailures(SERVER), []);
});
test("SABOTAGE (5): an id echoed in the refusal, and a refusal that lists everybody's open tables, are each seen", () => {
  const idLeak = loadServer([["return no(\"table-cap\", {cap: OPEN_CAP, open:", "return no(\"table-cap\", {cap: OPEN_CAP, by: who.player, open:"]]);
  assert.ok(leakFailures(idLeak).some(x => /private string/.test(x)));
  const store = F.memStore(); const real = store.createCapped;
  store.createCapped = (id, row, creator, cap) => { const r = real(id, row, creator, cap); return r.capped ? {...r, open: [...store.rows.keys()]} : r; };
  assert.ok(leakFailures(SERVER, store).some(x => /not this player's|another player's/.test(x)), "a refusal listing other players' tables must be seen");
});

/* ---------------------------------------------------------------------------------------------- (6) */
const guard = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("hung")), ms || 20000); })]).finally(() => clearTimeout(t)); };
function pWorld(seed){
  const w = makeWorld({seedKey: seed}), idp = F.memIdentity();
  w.deps.identify = t => idp.identify(t); w.deps.rename = (p, n, f) => idp.rename(p, n, f);
  const asked = [];
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, w.server.nameFold(name)); return {tok, identity: {token: async () => { asked.push(id); return tok; }}}; };
  const opts = (name, extra) => ({transport: w.transport(name), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, keep: PH.memKeep(), ...(extra || {})});
  return {w, idp, player, opts, asked};
}
async function phoneFailures(M){
  const bad = [], {w, idp, player, opts} = pWorld("cap-phone");
  const P = player("P-phone-cap", "Dawn Smith");
  const made = [];
  for(let i = 0; i < 5; i++){ const ch = await M.startTable(opts("A" + i, {identity: P.identity})); made.push(ch); }
  const creates = w.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "create");
  if(creates.length !== 5 || !creates.every(e => e.identity && typeof e.identity.token === "string")) bad.push("opening a table did not carry the sign-in");
  const stored = made.map(c => w.row(c.code));
  if(!stored.every(r => r.creator === "P-phone-cap" && Array.isArray(r.owners) && r.owners[0] === "P-phone-cap")) bad.push("the opener's table does not record its creator and bind its seat");
  let err = null;
  try { await M.startTable(opts("A6", {identity: P.identity})); } catch(e){ err = e; }
  if(!err || err.why !== "table-cap") bad.push("the sixth table was not read as table-cap: " + (err && err.why));
  else {
    if(JSON.stringify(err.open) !== JSON.stringify(made.map(c => c.code))) bad.push("the cap error does not carry the five codes: " + JSON.stringify(err.open));
    if(err.cap !== 5) bad.push("the cap error does not carry the cap");
    if(JSON.stringify([err.message, err.open]).indexOf(P.tok) >= 0) bad.push("the cap error carries the token");
  }
  const rowsBefore = w.store.rows.size;
  /* close one of them: the way out; then a table can be opened again; closeTable's words */
  const gone = made[0].code;
  const why = p => p.then(() => null, e => e.why);
  if(await why(M.closeTable({transport: w.transport("C"), identity: {token: async () => "jwt.forged"}, sleep: PH.FAST.sleep}, gone)) !== "identity") bad.push("closeTable with a forged sign-in");
  if(await why(M.closeTable({transport: w.transport("C"), sleep: PH.FAST.sleep}, gone)) !== "unavailable") bad.push("closeTable with no sign-in");
  if(await why(M.closeTable({transport: w.transport("C"), identity: P.identity, sleep: PH.FAST.sleep}, "nope")) !== "code") bad.push("closeTable with a bad code");
  const Q = player("P-phone-other");
  if(await why(M.closeTable({transport: w.transport("C"), identity: Q.identity, sleep: PH.FAST.sleep}, gone)) !== "not-creator") bad.push("closeTable of someone else's table");
  if(w.row(gone).closed === true) bad.push("a refused close closed the table");
  const r1 = await M.closeTable({transport: w.transport("C"), identity: P.identity, sleep: PH.FAST.sleep}, gone).catch(e => ({err: e.why}));
  if(!r1 || r1.closed !== true) bad.push("the creator's closeTable answered " + JSON.stringify(r1));
  if(await why(M.closeTable({transport: w.transport("C"), identity: P.identity, sleep: PH.FAST.sleep}, gone)) !== "no-table") bad.push("closing a closed table");
  const again = await M.startTable(opts("A7", {identity: P.identity})).then(c => c, e => ({err: e.why}));
  if(again.err) bad.push("after a close the player could not open a table: " + again.err); else made.push(again);
  if(w.store.rows.size !== rowsBefore + 1) bad.push("a refused create (or a close) changed the number of tables");
  /* the sign-in the referee will not take: a casual table (a v2 row), the sit-down casual too */
  const forged = await M.startTable(opts("F", {identity: {token: async () => "jwt.forged"}})).then(c => c, e => ({err: e.why}));
  if(forged.err) bad.push("a refused sign-in left the player without a table: " + forged.err);
  else { const r = w.row(forged.code); if(r.v !== 2 || "creator" in r || "owners" in r) bad.push("a refused sign-in did not make a casual table"); forged.close(); }
  /* no sign-in: the very request the casual create has always been */
  const casual = await M.startTable(opts("N")).then(c => c, e => ({err: e.why}));
  const lastCreate = w.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "create").pop();
  if(casual.err || JSON.stringify(lastCreate) !== '{"op":"create"}') bad.push("a casual create is not exactly {op:create}: " + JSON.stringify(lastCreate));
  else casual.close();
  for(const c of made) { try { c.close(); } catch(_){} }
  return bad;
}
test("(6) THE PHONE — sends the sign-in when it opens a table, reads `table-cap` with the codes, closeTable frees a slot and says why when it cannot, a refused sign-in or none opens a casual table", async () => {
  assert.deepEqual(await guard(phoneFailures(ST), 20000), []);
});
test("SABOTAGE (6): a phone that opens tables with no sign-in, one that reads the cap as 'unavailable', and one that never falls back to a casual table are each seen", async () => {
  const noToken = stCopy([["const r = await call(T, {op: \"create\", ...(asToken ? {identity: {token: asToken}} : {})});", "const r = await call(T, {op: \"create\"});"]]);
  assert.ok((await guard(phoneFailures(noToken), 20000)).length >= 1, "no sign-in at create must be seen");
  const noWord = stCopy([["else if(r.refused === \"table-cap\") throw Object.assign(refusal(r), {open:", "else if(r.refused === \"table-cap\") throw Object.assign(fail(\"unavailable\"), {open:"]]);
  assert.ok((await guard(phoneFailures(noWord), 20000)).some(x => /table-cap/.test(x)), "the cap read as unavailable must be seen");
  const noFallback = stCopy([["else if(r.refused === \"identity\" && asToken){ asToken = null; token = null; i--; continue; }", ""]]);
  assert.ok((await guard(phoneFailures(noFallback), 20000)).some(x => /refused sign-in/.test(x)), "no casual fallback must be seen");
  const noClose = stCopy([["const r = await call(T, {op: \"close\", table: c, identity: {token}});", "const r = {ok: false, refused: \"internal\"};"]]);
  assert.ok((await guard(phoneFailures(noClose), 20000)).some(x => /closeTable/.test(x)), "a close that never reaches the server must be seen");
});
