/* test/serverseek.test.js — FIND A MATCH: THE QUEUE (SERVER S6.1).

   server/referee.js's {op:"seek"}, over the fake store, the fake sign-in provider, the fake ratings backend and the fake queue (test/helpers/serverfakes.js
   withSeek: what 009_seek.sql's seek_step / seek_cancel do, held to the SQL by its own self-check and tools/sql-sab-009.js). Each drill has a sabotage that fails it:

     (1) TWO STRANGERS MEET — the first seeker waits at a table the function opened for them (they create it, they sit in chair 0); the second is handed THAT
         table and sits in chair 1; the first one's heartbeat then says "taken"; a third seeker is not sent to the full table.
     (2) KINDS NEVER MIX — a ranked seeker never meets a friendly one; a ranked seek needs a chosen name; the table a ranked seeker waits at is ranked.
     (3) CANCEL — a waiting seek is cancelled and its table closed (nobody can sit at it); a seek already taken is not cancelled: the phone is told where to go.
     (4) THE HEARTBEAT'S TABLE — honoured only for the caller's own open, empty table; a stranger's code is ignored (never queued, never closed).
     (5) STALE MATCHES ARE SKIPPED — a queued table that was closed meanwhile is never handed out; the queue is asked again.
     (6) A SEEKER WHO HELD A TABLE AND IS MATCHED ELSEWHERE — their own table is closed (the race of two simultaneous first seekers).
     (7) THE EDGES — no identity, a forged one, bad fields, no queue wired; the cap of open tables still applies; the answers carry public keys only. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
const SERVER = require(path.join(ROOT, "server", "referee.js"));
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}
const probe = f => { try { return f(); } catch(e){ if(e && /sabotage anchor/.test(e.message)) throw e; return ["the probe threw: " + (e && e.message)]; } };
const KEYS = ["beat", "ok", "state", "table"];

function world(server, o){
  o = o || {};
  const store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(), sk = F.withSeek(o.seek), logs = [];
  let clock = 1700000000000, rn = 0;
  const deps = {store, broadcast: () => {}, deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => T.seeded("seek|" + (o.salt || "") + "|" + (++rn)),
    identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f), log: e => logs.push(String(e && e.message || e)), ...rat.deps(), ...(o.noSeek ? {} : sk.deps())};
  const go = req => json(server.handleNow(req, deps));
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, server.nameFold(name)); return {id, tok}; };
  const seek = (P, extra) => go({op: "seek", identity: {token: P.tok}, ...(extra || {})});
  const sit = (P, table) => go({op: "join", table, claim: "claim-" + P.id + "-" + table + "-xxxxxxxxxxxx", identity: {token: P.tok}});
  return {store, idp, sk, logs, deps, go, player, seek, sit};
}
const keysOk = (r, bad, what) => { const extra = Object.keys(r).filter(k => KEYS.indexOf(k) < 0); if(extra.length) bad.push(what + " carries keys off the public list: " + extra.join(",")); };

/* ---------------------------------------------------------------------------------------------- (1) */
function meetFailures(server, so){
  const bad = [], w = world(server, {salt: "meet", seek: so});
  const A = w.player("pa"), B = w.player("pb"), C = w.player("pc");
  const a = w.seek(A);
  if(!a.ok || a.state !== "waiting" || typeof a.table !== "string") return ["the first seeker did not wait: " + JSON.stringify(a)];
  keysOk(a, bad, "a waiting answer");
  if(a.beat !== server.SEEK_BEAT) bad.push("a waiting answer does not say how often to ask again");
  const row = w.store.row(a.table);
  if(!row || row.creator !== "pa" || row.ranked === true) bad.push("the waiting table is not a friendly table created for the seeker: " + JSON.stringify(row && {creator: row.creator, ranked: row.ranked}));
  const sa = w.sit(A, a.table);
  if(!sa.ok || sa.seat !== 0) bad.push("the seeker could not sit at their own waiting table: " + JSON.stringify(sa).slice(0, 120));
  const hb = w.seek(A, {table: a.table});
  if(hb.state !== "waiting" || hb.table !== a.table) bad.push("a heartbeat did not keep the seeker waiting at the same table: " + JSON.stringify(hb));
  const b = w.seek(B);
  if(!b.ok || b.state !== "matched" || b.table !== a.table) bad.push("the second seeker was not handed the first one's table: " + JSON.stringify(b));
  keysOk(b, bad, "a matched answer");
  const sb = w.sit(B, a.table);
  if(!sb.ok || sb.seat !== 1) bad.push("the matched seeker could not sit in the second chair: " + JSON.stringify(sb).slice(0, 120));
  const hb2 = w.seek(A, {table: a.table});
  if(hb2.state !== "taken" || hb2.table !== a.table) bad.push("the first seeker's heartbeat did not say taken: " + JSON.stringify(hb2));
  const c = w.seek(C);
  if(c.state === "matched") bad.push("a third seeker was sent to a full table: " + JSON.stringify(c));
  if(c.state !== "waiting" || c.table === a.table) bad.push("the third seeker does not wait at a table of their own: " + JSON.stringify(c));
  return bad;
}
test("(1) two strangers meet at the first one's table; the heartbeat hears it; a third waits elsewhere", () => {
  assert.deepEqual(meetFailures(SERVER), []);
  assert.ok(probe(() => meetFailures(SERVER, {retake: true})).length > 0, "sabotage (a taken seek matched again) must fail");
  assert.ok(probe(() => meetFailures(SERVER, {selfMatch: true})).length > 0, "sabotage (a seeker matched to itself) must fail");
  assert.ok(probe(() => meetFailures(loadServer([["if(a.state === \"waiting\" || a.state === \"taken\") return fin({ok: true, state: a.state, table: a.table, beat: SEEK_BEAT});", "if(a.state === \"waiting\" || a.state === \"taken\") return fin({ok: true, state: a.state, table: a.table});"]]))).length > 0, "sabotage (no beat) must fail");
});

/* ---------------------------------------------------------------------------------------------- (2) */
function kindFailures(server, so){
  const bad = [], w = world(server, {salt: "kind", seek: so});
  const A = w.player("pa", "Alpha One"), B = w.player("pb", "Bravo Two"), N = w.player("pn");
  const a = w.seek(A, {ranked: true});
  if(a.state !== "waiting") return ["a named ranked seeker did not wait: " + JSON.stringify(a)];
  if(!w.store.row(a.table) || w.store.row(a.table).ranked !== true) bad.push("a ranked seeker waits at a table that is not ranked");
  const f = w.seek(B);
  if(f.state === "matched") bad.push("a friendly seeker was matched to a ranked table");
  const n = w.seek(N, {ranked: true});
  if(n.ok || n.refused !== "ranked-name") bad.push("a nameless player was queued for a ranked match: " + JSON.stringify(n));
  const b = w.seek(B, {ranked: true});                     /* B switches kind: its friendly table is dropped, and it meets A */
  if(b.state !== "matched" || b.table !== a.table) bad.push("two ranked seekers did not meet: " + JSON.stringify(b));
  if(f.table && w.store.row(f.table) && w.store.row(f.table).closed !== true) bad.push("the friendly table B left behind when it switched to ranked was not closed");
  /* switching kind with nobody waiting of the new kind: the old table is closed and a new one of the new kind is opened */
  const D = w.player("pd", "Delta Four");
  const d1 = w.seek(D), d2 = w.seek(D, {ranked: true});
  if(d2.state !== "waiting" || d2.table === d1.table || !w.store.row(d2.table) || w.store.row(d2.table).ranked !== true) bad.push("switching to ranked with nobody waiting did not open a ranked table: " + JSON.stringify(d2));
  if(!w.store.row(d1.table) || w.store.row(d1.table).closed !== true) bad.push("the friendly table left behind by a switch (nobody waiting) was not closed");
  return bad;
}
test("(2) a ranked seeker meets only a ranked one, needs a name, waits at a ranked table; switching kind closes the old table", () => {
  assert.deepEqual(kindFailures(SERVER), []);
  assert.ok(probe(() => kindFailures(SERVER, {anyKind: true})).length > 0, "sabotage (kinds mix) must fail");
  assert.ok(probe(() => kindFailures(loadServer([["      if(!v || !v.ok) return no(\"ranked-name\");\n    }\n    const step", "    }\n    const step"]]))).length > 0, "sabotage (no name check) must fail");
  assert.ok(probe(() => kindFailures(loadServer([["return then(seekDrop(dropped, who, deps), () => then(createAs(", "return then(null, () => then(createAs("]]))).length > 0, "sabotage (a switched-from table is not closed) must fail");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function cancelFailures(server){
  const bad = [], w = world(server, {salt: "cancel"});
  const A = w.player("pa"), B = w.player("pb"), C = w.player("pc");
  const a = w.seek(A);
  w.sit(A, a.table);
  const x = w.seek(A, {cancel: true});
  if(!x.ok || x.state !== "cancelled") bad.push("a waiting seek was not cancelled: " + JSON.stringify(x));
  keysOk(x, bad, "a cancel answer");
  if(!w.store.row(a.table) || w.store.row(a.table).closed !== true) bad.push("a cancelled seek's table was left open");
  const b = w.seek(B);
  if(b.state === "matched") bad.push("a cancelled seek was matched");
  const c = w.seek(C);
  if(c.state !== "matched" || c.table !== b.table) bad.push("the next two seekers did not meet: " + JSON.stringify(c));
  const late = w.seek(B, {cancel: true});
  if(late.state !== "taken" || late.table !== b.table) bad.push("a taken seek was cancelled instead of sending the phone to its table: " + JSON.stringify(late));
  if(w.store.row(b.table).closed === true) bad.push("a taken seek's table was closed by a late cancel");
  const none = w.seek(A, {cancel: true});
  if(none.state !== "none") bad.push("a cancel with no seek found something: " + JSON.stringify(none));
  return bad;
}
test("(3) cancel closes a waiting table; a taken seek is not cancelled and names its table", () => {
  assert.deepEqual(cancelFailures(SERVER), []);
  assert.ok(probe(() => cancelFailures(loadServer([["if(a.state === \"cancelled\") return then(seekDrop(a.table, who, deps), () => ({ok: true, state: \"cancelled\"}));", "if(a.state === \"cancelled\") return {ok: true, state: \"cancelled\"};"]]))).length > 0, "sabotage (cancel leaves the table open) must fail");
});

/* ---------------------------------------------------------------------------------------------- (4) */
function beatFailures(server){
  const bad = [], w = world(server, {salt: "beat"});
  const A = w.player("pa"), B = w.player("pb"), S = w.player("ps");
  /* a stranger's open table (S opened it the ordinary way and sat down) */
  const made = w.go({op: "create", identity: {token: S.tok}});
  w.sit(S, made.table);
  const a = w.seek(A, {table: made.table});
  if(a.state !== "waiting" || a.table === made.table) bad.push("a stranger's table code was queued as the seeker's own: " + JSON.stringify(a));
  if(w.store.row(made.table).closed === true) bad.push("a stranger's table was closed by someone else's seek");
  const b = w.seek(B);
  if(b.table === made.table) bad.push("the queue sent a seeker to a stranger's private table");
  return bad;
}
test("(4) the heartbeat's table is honoured only for the caller's own table", () => {
  assert.deepEqual(beatFailures(SERVER), []);
  assert.ok(probe(() => beatFailures(loadServer([["    if(!seekOpen(row) || row.creator !== who.player) return null;\n    const o", "    if(!seekOpen(row)) return null;\n    const o"], ["    return o.every(x => x == null || x === who.player) ? code : null;", "    return code;"]]))).length > 0, "sabotage (any code is queued) must fail");
});

/* ---------------------------------------------------------------------------------------------- (5) */
function staleFailures(server){
  const bad = [], w = world(server, {salt: "stale"});
  const A = w.player("pa"), B = w.player("pb"), C = w.player("pc");
  const a = w.seek(A); w.sit(A, a.table);
  /* A's table closes behind the queue's back (A closed it from another screen) */
  const cl = w.go({op: "close", table: a.table, identity: {token: A.tok}});
  if(!cl.ok) return ["the close was refused: " + JSON.stringify(cl)];
  const c = w.seek(C);                                 /* C is matched to A's (closed) seek: skipped, so C waits at its own */
  if(c.state === "matched" && c.table === a.table) bad.push("a closed table was handed out by the queue");
  const b = w.seek(B);
  if(c.state === "waiting" && (b.state !== "matched" || b.table !== c.table)) bad.push("after a stale match was skipped the next seekers did not meet: " + JSON.stringify([c, b]));
  return bad;
}
test("(5) a queued table that closed meanwhile is skipped, never handed out", () => {
  assert.deepEqual(staleFailures(SERVER), []);
  assert.ok(probe(() => staleFailures(loadServer([["        if(good) return fin({ok: true, state: \"matched\", table: a.table});", "        if(true) return fin({ok: true, state: \"matched\", table: a.table});"]]))).length > 0, "sabotage (no check of a matched table) must fail");
});

/* ---------------------------------------------------------------------------------------------- (6) */
function raceFailures(server){
  const bad = [], w = world(server, {salt: "race"});
  const A = w.player("pa"), B = w.player("pb");
  /* the race: both found the queue empty and both now wait (forced: B's seek is put in directly, older than A's) */
  const a = w.seek(A); w.sit(A, a.table);
  const made = w.go({op: "create", identity: {token: B.tok}});
  w.sit(B, made.table);
  w.sk.q.set("pb", {table: made.table, ranked: false, born: -1, seen: w.sk.clock, taken: false});
  const hb = w.seek(A, {table: a.table});
  if(hb.state !== "matched" || hb.table !== made.table) bad.push("two waiting seekers were not joined on a heartbeat: " + JSON.stringify(hb));
  if(!w.store.row(a.table) || w.store.row(a.table).closed !== true) bad.push("the table the matched seeker left was not closed");
  if(w.store.row(made.table).closed === true) bad.push("the table the seeker was sent to was closed");
  return bad;
}
test("(6) a waiting seeker matched elsewhere has its own table closed", () => {
  assert.deepEqual(raceFailures(SERVER), []);
  assert.ok(probe(() => raceFailures(loadServer([["      const fin = ans => then(seekDrop(dropped, who, deps), () => ans);", "      const fin = ans => ans;"]]))).length > 0, "sabotage (no drop on a match) must fail");
});

/* ---------------------------------------------------------------------------------------------- (7) */
function edgeFailures(server){
  const bad = [], w = world(server, {salt: "edge"});
  const A = w.player("pa");
  const r1 = w.go({op: "seek"});
  if(r1.ok || r1.refused !== "bad-request") bad.push("a seek with no identity was not bad-request: " + JSON.stringify(r1));
  const r2 = w.go({op: "seek", identity: {token: "jwt.forged"}});
  if(r2.ok || r2.refused !== "identity") bad.push("a forged token was not refused identity: " + JSON.stringify(r2));
  for(const extra of [{ranked: false}, {ranked: "yes"}, {cancel: 1}, {table: "bad code!"}, {table: 7}]){
    const r = w.seek(A, extra);
    if(r.ok || r.refused !== "bad-request") bad.push("a seek with " + JSON.stringify(extra) + " was not bad-request: " + JSON.stringify(r));
  }
  const nq = world(server, {salt: "noq", noSeek: true}), P = nq.player("pp");
  const r3 = nq.seek(P);
  if(r3.ok || r3.refused !== "unavailable") bad.push("a function with no queue did not answer unavailable: " + JSON.stringify(r3));
  if(nq.store.rows.size) bad.push("a function with no queue opened a table anyway");
  /* the cap of open tables: a player holding five open tables cannot open a sixth to wait at */
  const cw = world(server, {salt: "cap"}), K = cw.player("pk");
  for(let i = 0; i < server.OPEN_CAP; i++) cw.go({op: "create", identity: {token: K.tok}});
  const r4 = cw.seek(K);
  if(r4.ok || r4.refused !== "table-cap") bad.push("a seeker at the cap of open tables was not refused table-cap: " + JSON.stringify(r4));
  /* no id or token in any answer */
  const all = JSON.stringify([w.seek(A), w.seek(A, {cancel: true})]);
  if(/"pa"|jwt\./.test(all)) bad.push("an answer carried a player id or a token");
  return bad;
}
test("(7) edges: identity, fields, no queue, the cap, nothing private in an answer", () => {
  assert.deepEqual(edgeFailures(SERVER), []);
  assert.ok(probe(() => edgeFailures(loadServer([["  if(req.ranked !== undefined && req.ranked !== true) return no(\"bad-request\");\n  if(req.cancel", "  if(req.cancel"]]))).length > 0, "sabotage (ranked:false accepted) must fail");
  assert.ok(probe(() => edgeFailures(loadServer([["    if(typeof deps.seek !== \"function\") return no(\"unavailable\");\n    if(req.cancel === true){", "    if(req.cancel === true){"]]))).length > 0, "sabotage (no queue check) must fail");
});

/* ---------------------------------------------------------------------------------------------- (8) */
function lookingFailures(server){
  const bad = [], w = world(server, {salt: "look"});
  const r0 = w.go({op: "looking"});
  if(!r0.ok || r0.friendly !== 0 || r0.ranked !== 0) bad.push("an empty queue did not count 0/0: " + JSON.stringify(r0));
  const A = w.player("pa", "Alpha One"), B = w.player("pb");
  w.seek(A, {ranked: true}); w.seek(B);
  const calls0 = w.idp.calls, r1 = w.go({op: "looking"});
  if(r1.friendly !== 1 || r1.ranked !== 1) bad.push("two waiting seekers were not counted: " + JSON.stringify(r1));
  if(Object.keys(r1).sort().join() !== "friendly,ok,ranked") bad.push("the count carries more than numbers: " + JSON.stringify(r1));
  if(w.idp.calls !== calls0) bad.push("looking asked the sign-in provider");
  const nq = world(server, {salt: "noq", noSeek: true});
  if(nq.go({op: "looking"}).refused !== "unavailable") bad.push("no count wired was not unavailable");
  return bad;
}
test("(8) looking: a public count of the queue, numbers only", () => {
  assert.deepEqual(lookingFailures(SERVER), []);
  assert.ok(probe(() => lookingFailures(loadServer([["  if(req.op === \"looking\") return opLooking(req, deps);\n", ""]]))).length > 0, "sabotage (no looking op) must fail");
});
