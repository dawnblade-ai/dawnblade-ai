/* test/serverrematch.test.js — REMATCH: THE SAME TWO PLAYERS AGAIN (v6.83).

   server/referee.js's {op:"rematch"}, over a real game played by two phones through makeServerHub (the fake store, the fake sign-in provider and
   the fake ratings backend of test/helpers/serverfakes.js). Each drill has a sabotage that fails it:

     (1) BOTH ASK, ONE NEW TABLE — the first ask waits and the other seat is pushed the ask (sealed, on its own channel); the second ask opens a NEW
         table of the SAME kind (ranked after ranked) and both seats are handed the same code; asked again it answers the same code; both players
         sit down at it in the two chairs; its game id is its own, so a game played there is recorded as a second ranked game.
     (2) ONLY AFTER THE GAME, ONLY THE SEAT — a game still being played is refused; a wrong key is refused; a ranked rematch without a sign-in is
         refused; nothing is written by a refusal.
     (3) AN ASK GOES STALE — an ask older than REMATCH_MS is forgotten: the other player's later ask waits instead of opening a table.
     (4) CANCEL — a cancelled ask is gone (the other's ask then waits) and the other seat is told.
     (5) A MISSED PUSH HEALS — a resync's answer carries the rematch state (who asked, and the code once there is one).
     (6) A FRIENDLY TABLE WITH NOBODY SIGNED IN — the rematch is a casual table (no creator, not ranked).
     (7) A LOST RACE — the second ask's save loses to another write: it answers conflict and the table it opened is closed (nobody holds its code). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
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
const probe = f => { try { return f(); } catch(e){ if(e && /sabotage anchor/.test(e.message)) throw e; return ["the probe threw: " + (e && e.message)]; } };

/* a table played by two phones: ranked (two signed-in players, seat 0's creates it) or casual with nobody signed in */
function table(o){
  o = o || {};
  const server = o.server || SERVER, idp = F.memIdentity(), rat = F.withRatings();
  const ids = ["P-rm-zero", "P-rm-one"], names = ["Dawn Smith", "Rival One"];
  const toks = ids.map((id, i) => idp.issue(id, names[i]));
  const cfg = o.casual ? {server, seedKey: "rm-" + (o.salt || "")}
    : {server, seedKey: "rm-" + (o.salt || ""), identify: t => idp.identify(t), identities: toks, creator: toks[0], ranked: true, rankDeps: rat.deps(), secrets: ids.concat(toks)};
  const mk = makeServerHub(cfg);
  let hub; const t = T.makeTable({heroes: ["blaze", "dorinthea"], salt: "rm-" + (o.salt || ""), throws: [["rock", "rock"], ["paper", "rock"]], makeHub: opts => (hub = mk(opts))}).open();
  const audit = hub.audit, ps = t.seatPhones(), code = audit.code;
  const row = c => audit.store.row(c || code);
  const concede = seat => { ps[seat].sess.submit({t: "concede"}); t.flush(); };
  let clock = 1800000000000;
  const deps = o2 => ({...audit.deps, now: () => (o2 && o2.at) || clock++, ...(o2 && o2.store ? {store: o2.store} : {})});
  const ask = (seat, extra, o2) => json(server.handleNow({op: "rematch", table: code, seat, key: row().hub.keys[seat], ...(o.casual ? {} : {identity: {token: toks[seat]}}), ...(extra || {})}, deps(o2)));
  const pushes = seat => audit.bus.log.filter(e => e.topic === server.topic(code, seat, row().hub.keys[seat])).flatMap(e => e.payload.frames || []).filter(f => f && f.ch === "rematch");
  return {t, audit, ps, code, row, concede, ask, deps, pushes, toks, ids, idp, rat, server};
}
/* the two players sit down at the rematch's table and play a short game there: seat 1 concedes */
function playAt(g, newCode){
  const go = req => json(g.server.handleNow(req, g.deps()));
  const s0 = go({op: "join", table: newCode, claim: "claim-zero-" + newCode + "-xxxxxxxx", identity: {token: g.toks[0]}});
  const s1 = go({op: "join", table: newCode, claim: "claim-one-" + newCode + "-xxxxxxxxx", identity: {token: g.toks[1]}});
  return {s0, s1};
}

/* ---------------------------------------------------------------------------------------------- (1) */
function bothFailures(server){
  const bad = [], g = table({server, salt: "both"});
  g.concede(1);
  if(g.rat.records !== 1) return ["the first game was not recorded"];
  const a = g.ask(0);
  if(!a.ok || a.state !== "waiting" || JSON.stringify(a.want) !== "[true,false]") bad.push("the first ask did not wait: " + JSON.stringify(a));
  const p1 = g.pushes(1);
  if(!p1.length || JSON.stringify(p1[p1.length - 1].m) !== JSON.stringify({want: [true, false], table: null})) bad.push("the other seat was not pushed the ask: " + JSON.stringify(p1));
  if(g.pushes(0).length) bad.push("the asking seat was pushed its own ask");
  const b = g.ask(1);
  if(!b.ok || b.state !== "ready" || typeof b.table !== "string" || b.table === g.code) return bad.concat(["the second ask did not open a new table: " + JSON.stringify(b)]);
  const p0 = g.pushes(0);
  if(!p0.length || p0[p0.length - 1].m.table !== b.table) bad.push("the first asker was not pushed the new table's code: " + JSON.stringify(p0));
  const a2 = g.ask(0);
  if(a2.state !== "ready" || a2.table !== b.table) bad.push("asked again, the first seat was not handed the same code: " + JSON.stringify(a2));
  const nr = g.row(b.table);
  if(!nr || nr.ranked !== true || nr.creator !== g.ids[1] || nr.closed === true) bad.push("the new table is not an open ranked table opened by the second asker: " + JSON.stringify(nr && {ranked: nr.ranked, creator: nr.creator, closed: nr.closed}));
  const {s0, s1} = playAt(g, b.table);
  if(!s0.ok || !s1.ok || s0.seat === s1.seat) bad.push("the two players could not sit in the two chairs: " + JSON.stringify([s0.refused, s1.refused]));
  /* a NEW ranked game: the result is keyed on the table code and the moment it was made (referee gameId), so the rematch records on its own */
  if(nr && nr.id + "-" + nr.created === g.row().id + "-" + g.row().created) bad.push("the rematch shares the first game's id");
  return bad;
}
test("(1) both ask: one new table of the same kind, the same code for both, both chairs taken there", () => {
  assert.deepEqual(bothFailures(SERVER), []);
  assert.ok(probe(() => bothFailures(loadServer([["if(cur.at[other] == null){", "if(false){"]]))).length > 0, "sabotage (the first ask opens the table) must fail");
  assert.ok(probe(() => bothFailures(loadServer([["p[other] = [{ch: CH_REMATCH, m: {want: want.slice(), table}}];", "p[1 - other] = [{ch: CH_REMATCH, m: {want: want.slice(), table}}];"]]))).length > 0, "sabotage (the ask pushed to the asker) must fail");
  assert.ok(probe(() => bothFailures(loadServer([["...(ranked ? {ranked: true} : {})}, newId(deps), false, deps) : create({}, deps)", "}, newId(deps), false, deps) : create({}, deps)"]]))).length > 0, "sabotage (a ranked rematch opens a friendly table) must fail");
  assert.ok(probe(() => bothFailures(loadServer([["if(cur.table) return {ok: true, state: \"ready\", table: cur.table};", ""]]))).length > 0, "sabotage (asked again, a second table) must fail");
});

/* ---------------------------------------------------------------------------------------------- (2) */
function refuseFailures(server){
  const bad = [], g = table({server, salt: "refuse"});
  const before = g.audit.store.json(g.code);
  const mid = g.ask(0);
  if(mid.ok || mid.refused !== "rematch-playing") bad.push("a game still being played was not refused: " + JSON.stringify(mid));
  g.concede(0);
  const v0 = g.audit.store.version(g.code);
  const wrong = json(g.server.handleNow({op: "rematch", table: g.code, seat: 0, key: g.row().hub.keys[1], identity: {token: g.toks[0]}}, g.deps()));
  if(wrong.ok || wrong.refused !== "auth") bad.push("a wrong key was not refused: " + JSON.stringify(wrong));
  const anon = json(g.server.handleNow({op: "rematch", table: g.code, seat: 0, key: g.row().hub.keys[0]}, g.deps()));
  if(!anon.ok || anon.state !== "waiting") bad.push("an unsigned FIRST ask (it opens nothing) was refused: " + JSON.stringify(anon));
  const anon2 = json(g.server.handleNow({op: "rematch", table: g.code, seat: 1, key: g.row().hub.keys[1]}, g.deps()));
  if(anon2.ok || anon2.refused !== "ranked-signin") bad.push("a ranked rematch with no sign-in opened a table: " + JSON.stringify(anon2));
  const silly = g.ask(0, {cancel: "yes"});
  if(silly.ok || silly.refused !== "bad-request") bad.push("cancel that is not true was taken: " + JSON.stringify(silly));
  if(g.audit.store.version(g.code) !== v0 + 1) bad.push("refusals wrote to the table (" + (g.audit.store.version(g.code) - v0) + " writes; the one unsigned ask is the only write)");
  void before;
  return bad;
}
test("(2) only after the game, only the seat's own key, a ranked rematch only for the signed in", () => {
  assert.deepEqual(refuseFailures(SERVER), []);
  assert.ok(probe(() => refuseFailures(loadServer([["if(!gameOver(id, row, deps)) return no(\"rematch-playing\");", ""]]))).length > 0, "sabotage (asked mid-game) must fail");
  assert.ok(probe(() => refuseFailures(loadServer([["if(ranked && req.identity === undefined) return no(\"ranked-signin\");", ""]]))).length > 0, "sabotage (a ranked rematch without a sign-in) must fail");
});

/* ---------------------------------------------------------------------------------------------- (3) (4) (5) */
function staleFailures(server){
  const bad = [], g = table({server, salt: "stale"});
  g.concede(1);
  g.ask(0, {}, {at: 1900000000000});
  const late = g.ask(1, {}, {at: 1900000000000 + server.REMATCH_MS + 1});
  if(late.state !== "waiting" || JSON.stringify(late.want) !== "[false,true]") bad.push("a stale ask still paired: " + JSON.stringify(late));
  const soon = g.ask(0, {}, {at: 1900000000000 + server.REMATCH_MS + 1000});
  if(soon.state !== "ready") bad.push("two fresh asks did not pair: " + JSON.stringify(soon));
  return bad;
}
test("(3) an ask older than two minutes is forgotten", () => {
  assert.deepEqual(staleFailures(SERVER), []);
  assert.ok(probe(() => staleFailures(loadServer([["now - r.at[s] < REMATCH_MS ? r.at[s] : null", "true ? r.at[s] : null"]]))).length > 0, "sabotage (asks never go stale) must fail");
});
function cancelFailures(server){
  const bad = [], g = table({server, salt: "cancel"});
  g.concede(1);
  g.ask(0);
  const c = g.ask(0, {cancel: true});
  if(!c.ok || c.state !== "cancelled") bad.push("a cancel was not answered cancelled: " + JSON.stringify(c));
  const p1 = g.pushes(1);
  if(!p1.length || JSON.stringify(p1[p1.length - 1].m.want) !== "[false,false]") bad.push("the other seat was not told of the cancel: " + JSON.stringify(p1));
  const rs = json(g.server.handleNow({op: "resync", table: g.code, seat: 1, key: g.row().hub.keys[1]}, g.deps()));
  if(!rs.rematch || JSON.stringify(rs.rematch.want) !== "[false,false]") bad.push("a resync does not carry the rematch state: " + JSON.stringify(rs.rematch));
  const b = g.ask(1);
  if(b.state !== "waiting") bad.push("after a cancel the other's ask opened a table: " + JSON.stringify(b));
  const rs0 = json(g.server.handleNow({op: "resync", table: g.code, seat: 0, key: g.row().hub.keys[0]}, g.deps()));
  if(!rs0.rematch || JSON.stringify(rs0.rematch.want) !== "[false,true]") bad.push("a resync does not say who asked: " + JSON.stringify(rs0.rematch));
  const none = g.ask(0, {cancel: true});
  if(none.state !== "none") bad.push("cancelling no ask was not answered none: " + JSON.stringify(none));
  const r = g.ask(0);
  const rs1 = json(g.server.handleNow({op: "resync", table: g.code, seat: 1, key: g.row().hub.keys[1]}, g.deps()));
  if(r.state !== "ready" || !rs1.rematch || rs1.rematch.table !== r.table) bad.push("a resync does not carry the new table's code: " + JSON.stringify(rs1.rematch));
  return bad;
}
test("(4)(5) cancel takes the ask back and tells the other seat; a resync carries who asked and the code", () => {
  assert.deepEqual(cancelFailures(SERVER), []);
  assert.ok(probe(() => cancelFailures(loadServer([["const at = cur.at.slice(); at[seat] = null;", "const at = cur.at.slice();"]]))).length > 0, "sabotage (cancel keeps the ask) must fail");
  assert.ok(probe(() => cancelFailures(loadServer([["...rankPub(row, deps), ...rematchPub(row, deps)}; };", "...rankPub(row, deps)}; };"]]))).length > 0, "sabotage (a resync forgets the rematch) must fail");
});

/* ---------------------------------------------------------------------------------------------- (6) */
function casualFailures(server){
  const bad = [], g = table({server, salt: "casual", casual: true});
  g.concede(1);
  const a = g.ask(1), b = g.ask(0);
  if(a.state !== "waiting" || b.state !== "ready") return ["the casual rematch did not pair: " + JSON.stringify([a, b])];
  const nr = g.row(b.table);
  if(!nr || nr.ranked === true || nr.creator != null) bad.push("a casual rematch is not a casual table: " + JSON.stringify(nr && {ranked: nr.ranked, creator: nr.creator}));
  return bad;
}
test("(6) a friendly table with nobody signed in rematches as a casual table", () => {
  assert.deepEqual(casualFailures(SERVER), []);
  assert.ok(probe(() => casualFailures(loadServer([["req.identity !== undefined || ranked ? createAs(", "true ? createAs("]]))).length > 0, "sabotage (a casual rematch needs a sign-in) must fail");
});

/* ---------------------------------------------------------------------------------------------- (7) */
function raceFailures(server){
  const bad = [], g = table({server, salt: "race"});
  g.concede(1);
  g.ask(0);
  /* a store whose next put of the FIRST table loses (another write landed between the read and the save) */
  const inner = g.audit.store; let armed = true;
  const racy = {...inner, get: id => inner.get(id), put: (id, row, v) => { if(armed && id === g.code && row.rematch && row.rematch.table){ armed = false; return {ok: false, version: v + 1}; } return inner.put(id, row, v); },
    createCapped: (id, row, c, cap) => inner.createCapped(id, row, c, cap)};
  const b = g.ask(1, {}, {store: racy});
  if(b.ok || b.refused !== "conflict" || b.retry !== true) bad.push("a lost race was not answered conflict: " + JSON.stringify(b));
  const opened = [...inner.rows.keys()].filter(k => k !== g.code);
  if(opened.length !== 1) bad.push("the lost race opened " + opened.length + " tables");
  else if(inner.row(opened[0]).closed !== true) bad.push("the table a lost race opened was left open");
  const again = g.ask(1);
  if(again.state !== "ready" || again.table === opened[0]) bad.push("asked again after the race, no fresh table: " + JSON.stringify(again));
  return bad;
}
test("(7) a lost race answers conflict and closes the table it opened", () => {
  assert.deepEqual(raceFailures(SERVER), []);
  assert.ok(probe(() => raceFailures(loadServer([["return then(rematchDrop(c.table, deps), () => a);", "return a;"]]))).length > 0, "sabotage (the orphan left open) must fail");
});
