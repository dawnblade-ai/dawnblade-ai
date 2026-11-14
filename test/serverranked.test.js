/* test/serverranked.test.js — RANKED TABLES: RESULTS AND RATINGS (SERVER S5.1).

   server/referee.js, over the fake store, the fake sign-in provider and a ratings backend that behaves like 006_ratings.sql (test/helpers/serverfakes.js
   withRatings; its arithmetic is checked below against test/fixtures/elo-vectors.json — the very table tools/sql-pglite.js feeds to the SQL itself).
   The drills, each with its sabotage:

     (1) A RANKED TABLE NEEDS TWO DIFFERENT, NAMED, SIGNED-IN PLAYERS — every refusal has its own word, writes nothing, and the lobby says it is ranked
         with each rating as the player sat down.
     (2) A CASUAL TABLE RECORDS NOTHING, AND ITS ANSWERS ARE v6.31's — no ranked/ratings/result key anywhere, the backend is never asked.
     (3) A FINISHED GAME RECORDS EXACTLY ONE RESULT with the right winner, and moves BOTH ratings by the Elo amounts (exact numbers: 1200 v 1200 win,
         an unequal pair both ways, a draw) — the concession, the dead-position draw, and a whole game to its end.
     (4) NEVER TWICE — a replayed ending, resyncs, takeovers, a close, a result lost from the row, a failed record healed later: one result, ratings
         moved once.
     (5) A PHONE CANNOT FORGE A RESULT — no field, op or message of a phone names a winner; the conceding seat is the loser whatever it says.
     (6) CLOSE — a table closed mid-game records nothing (the gap the forfeit clock will close); after a decided game close erases nothing.
     (7) PRIVACY — no player id, token, subject or code in any answer, row summary or broadcast; every new field of an answer is public by design.
     (8) `me` — the rating and the record, for the player asked and nobody else; v6.31's answer when the function cannot read ratings. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
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
const VEC = require("./fixtures/elo-vectors.json");
/* a sabotaged referee may break the probe itself: that is a sabotage seen, not a crashed drill */
const probe = f => { try { return f(); } catch(e){ return ["the probe threw: " + (e && e.message)]; } };

/* ---- a referee over the fakes; `go` answers one request as JSON; `snap` is everything a refusal must not move ---- */
function world(server, o){
  o = o || {};
  const store = F.memStore(), sent = [], idp = F.memIdentity(), rat = F.withRatings(o.rat), logs = [];
  let clock = 1700000000000; const rnd = T.seeded("rank|" + (o.salt || ""));
  const deps = {store, broadcast: (t, p) => sent.push({topic: t, payload: json(p)}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => rnd,
    identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f), log: e => logs.push(String(e && e.message || e)),
    ...(o.noRank ? {} : rat.deps())};
  const go = req => json(server.handleNow(req, deps));
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, server.nameFold(name)); return {id, tok, name}; };
  const ranked = (pl, extra) => go({op: "create", identity: {token: pl.tok}, ranked: true, ...(extra || {})});
  const sit = (code, pl, extra) => go({op: "join", table: code, identity: {token: pl.tok}, ...(extra || {})});
  const snap = code => ({json: store.json(code), version: store.version(code), pushes: sent.length, records: rat.records});
  return {server, store, idp, rat, deps, sent, logs, go, player, ranked, sit, snap, row: c => store.row(c)};
}

/* ---------------------------------------------------------------------------------------------- (1) */
function requireFailures(server){
  const bad = [], w = world(server, {salt: "req"});
  const A = w.player("P-alpha", "Alpha One"), B = w.player("P-bravo", "Bravo Two"), N = w.player("P-nameless"), C = w.player("P-charlie", "Charlie Three");
  /* the creator: signed in, named */
  const ok = w.ranked(A);
  if(!ok.ok || !ok.table) return ["a named signed-in creator could not make a ranked table: " + JSON.stringify(ok)];
  const id = ok.table, r0 = w.row(id);
  if(r0.v !== 4 || r0.ranked !== true || r0.creator !== "P-alpha" || JSON.stringify(r0.ratings) !== "[null,null]") bad.push("the ranked row is not v4 with ranked/creator/ratings: " + JSON.stringify([r0.v, r0.ranked, r0.ratings]));
  /* create refusals: each its own word, nothing written */
  const before = w.store.rows.size;
  for(const [what, r, want] of [["no sign-in", w.go({op: "create", ranked: true}), "ranked-signin"], ["a nameless creator", w.ranked(N), "ranked-name"],
      ["a forged token", w.go({op: "create", identity: {token: "jwt.forged"}, ranked: true}), "identity"], ["ranked that is not true", w.go({op: "create", identity: {token: A.tok}, ranked: "yes"}), "bad-request"],
      ["ranked:false", w.go({op: "create", identity: {token: A.tok}, ranked: false}), "bad-request"]])
    if(r.ok || r.refused !== want) bad.push("create with " + what + " answered " + JSON.stringify(r) + ", wanted " + want);
  if(w.store.rows.size !== before) bad.push("a refused ranked create wrote a table");
  /* a function that cannot record or read ratings never makes a ranked table */
  const w2 = world(server, {salt: "req2", noRank: true}), A2 = w2.player("P-a2", "Alpha Two");
  const r2 = w2.ranked(A2);
  if(r2.ok || r2.refused !== "unavailable" || w2.store.rows.size) bad.push("a function without ratings made a ranked table: " + JSON.stringify(r2));
  /* join refusals: nothing written, no push */
  const snap0 = w.snap(id);
  for(const [what, r, want] of [["no sign-in", w.go({op: "join", table: id}), "ranked-signin"], ["no sign-in with a claim", w.go({op: "join", table: id, claim: "tokenAAAAAAAAAAAAAAAA"}), "ranked-signin"],
      ["a nameless player", w.sit(id, N), "ranked-name"], ["a forged token", w.go({op: "join", table: id, identity: {token: "jwt.forged"}}), "identity"]])
    if(r.ok || r.refused !== want) bad.push("join with " + what + " answered " + JSON.stringify(r) + ", wanted " + want);
  const snap1 = w.snap(id);
  if(snap0.json !== snap1.json || snap0.version !== snap1.version || snap0.pushes !== snap1.pushes) bad.push("a refused join moved the table");
  /* two different named players take the two chairs; the answers say ranked and carry both ratings */
  w.rat.set("P-alpha", 1300);
  const a = w.sit(id, A);
  if(!a.ok || a.ranked !== true || JSON.stringify(a.ratings) !== JSON.stringify(a.seat === 0 ? [1300, null] : [null, 1300])) bad.push("the first player's answer: " + JSON.stringify([a.ok, a.ranked, a.ratings]));
  /* the same player again is a takeover of THEIR chair, never the second one */
  const again = w.sit(id, A);
  if(!again.ok || again.seat !== a.seat || w.row(id).owners.filter(Boolean).length !== 1) bad.push("a player took both chairs of a ranked table");
  const b = w.sit(id, B);
  if(!b.ok || b.seat === a.seat || b.ranked !== true) bad.push("the second player did not take the other chair: " + JSON.stringify([b.ok, b.seat, b.ranked]));
  const keyA = (again.frames.find(f => f.ch === "judge" && f.key) || {}).key;      /* the takeover dealt a fresh key; the first one is retired */
  const lob = w.go({op: "join", table: id, seat: a.seat, key: keyA});       /* a keyed return: the lobby as a returning phone sees it (before the deal a resync is not-dealt) */
  const want = [null, null]; want[a.seat] = 1300; want[b.seat] = 1200;
  if(!lob.ok || lob.ranked !== true || JSON.stringify(lob.ratings) !== JSON.stringify(want)) bad.push("the lobby does not show both ratings: " + JSON.stringify([lob.ok, lob.ratings]));
  if(JSON.stringify(lob.names) !== JSON.stringify(a.seat === 0 ? ["Alpha One", "Bravo Two"] : ["Bravo Two", "Alpha One"])) bad.push("the lobby does not show both names");
  /* a third player: full */
  const c = w.sit(id, C);
  if(c.ok || c.refused !== "full") bad.push("a third player at a ranked table answered " + JSON.stringify(c));
  /* a returning phone that holds its chair is not asked for a name or a sign-in again */
  if(!lob.ok || lob.ranked !== true) bad.push("a keyed return to a ranked chair was refused: " + JSON.stringify(lob));
  return bad;
}
test("(1) A RANKED TABLE NEEDS TWO DIFFERENT, NAMED, SIGNED-IN PLAYERS — each refusal has its own word and writes nothing; the lobby is ranked and shows both ratings", () => {
  assert.deepEqual(requireFailures(SERVER), []);
});
test("SABOTAGE (1): a referee that skips the sign-in, the name or the ranked flag is seen", () => {
  for(const [what, edits, re] of [
    ["no sign-in needed", [["if(ranked && fresh) return no(\"ranked-signin\");", ""]], /ranked-signin|no sign-in/],
    ["no name needed", [["if(nm == null) return no(\"ranked-name\");", ""]], /ranked-name|nameless/],
    ["the creator's name not needed", [["if(!v || !v.ok) return no(\"ranked-name\");", ""]], /nameless creator/],
    ["a ranked create without a sign-in is a casual one", [["if(req.ranked === true && req.identity === undefined) return no(\"ranked-signin\");", ""]], /no sign-in/],
    ["ratings not shown", [["...(row.result ? {result: row.result} : {})} : {};", "...(row.result ? {result: row.result} : {})} : {}; void 0;"], ["{ranked: true, ratings: ratingsOf(row).slice(),", "{ranked: true,"]], /ratings/],
    ["the joiner's rating never stored", [["if(row.ranked === true && who.rating != null){ row.ratings = ratingsOf(row).slice(); row.ratings[seat] = who.rating; }", ""]], /ratings|lobby/]])
    assert.ok(probe(() => requireFailures(loadServer(edits))).some(x => re.test(x) || /probe threw/.test(x)), "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- tables, played by phones */
/* a ranked (or casual) signed-in table played by two phones through makeServerHub. `rat` is the ratings backend; seat 0's player creates it.
   o: {server, salt, rat, ranked: true|false, heroes, names: [n0, n1], forge} */
function table(o){
  o = o || {};
  const server = o.server || SERVER, idp = F.memIdentity(), rat = o.rat || F.withRatings();
  const ids = o.ids || ["P-seat-zero-id", "P-seat-one-id"], names = o.names || ["Dawn Smith", "Rival One"];
  const toks = ids.map((id, i) => idp.issue(id, names[i]));
  const logs = [];
  const mk = makeServerHub({server, seedKey: "rank-" + (o.salt || ""), identify: t => idp.identify(t), identities: toks, creator: toks[0], ranked: o.ranked !== false,
    rankDeps: {...rat.deps(), ...(o.noRecord ? {record: undefined} : {})}, secrets: ids.concat(toks)});
  let hub; const t = T.makeTable({heroes: o.heroes || ["blaze", "dorinthea"], salt: "rank-" + (o.salt || ""), throws: [["rock", "rock"], ["paper", "rock"]], forge: o.forge,
    makeHub: opts => (hub = mk(opts))}).open();
  const audit = hub.audit, ps = t.seatPhones();
  const row = () => audit.store.row(audit.code);
  /* an action by a seat, through its own phone */
  const act = (seat, a) => { const why = ps[seat].sess.submit(a); t.flush(); return why; };
  const concede = seat => act(seat, {t: "concede"});
  /* the dead position: both seats do nothing but end their turns until the engine calls it */
  const drawIt = () => { let n = 0;
    while(!t.hub.session().full().over && n++ < 400){ let moved = false;
      for(const s of [0, 1]){ for(const a of [{t: "endTurn"}, {t: "arsenal", uid: null}, {t: "charge", uid: null}, {t: "pass"}]){
        if(J.legal(t.hub.session().full(), a, s)) continue;
        if(ps[s].sess.submit(a)) continue; t.flush(); moved = true; break; } if(moved) break; }
      if(!moved) throw new Error("the draw driver is stuck"); } };
  return {t, hub, audit, ps, ids, toks, idp, rat, server, row, act, concede, drawIt, logs,
    resync: seat => json(server.handleNow({op: "resync", table: audit.code, seat, key: audit.store.row(audit.code).hub.keys[seat]}, audit.deps))};
}

/* ---------------------------------------------------------------------------------------------- (3) */
function resultFailures(server){
  const bad = [];
  /* 1200 v 1200: seat 1 concedes, seat 0 wins -> 1216 / 1184 */
  const g = table({server, salt: "win"});
  if(JSON.stringify(g.row().ratings) !== "[1200,1200]") bad.push("the lobby ratings were " + JSON.stringify(g.row().ratings));
  if(g.row().result !== undefined || g.rat.records !== 0) bad.push("a result existed before the game ended");
  g.concede(1);
  const full = g.t.hub.session().full();
  if(!full.over || full.over.winner !== 0 || full.over.how !== "concession") return bad.concat("the game did not end by seat 1's concession: " + JSON.stringify(full.over));
  if(g.rat.results.size !== 1 || g.rat.records !== 1) bad.push("a decided game recorded " + g.rat.results.size + " results in " + g.rat.records + " calls");
  const stored = [...g.rat.results.values()][0];
  if(stored.winner !== 0 || stored.how !== "concession" || stored.players.join() !== g.ids.join() || stored.heroes.join() !== "blaze,dorinthea" || stored.names.join() !== "Dawn Smith,Rival One") bad.push("the stored result is not the game's: " + JSON.stringify(stored));
  if(!(stored.turns >= 1) || stored.build !== T.BUILD || stored.table !== g.audit.code || !stored.game.startsWith(g.audit.code)) bad.push("the stored result lacks turns, build or table: " + JSON.stringify(stored));
  if(!(stored.started > 0) || !(stored.ended >= stored.started)) bad.push("the stored result lacks its times");
  const r0 = g.rat.rating(g.ids[0]), r1 = g.rat.rating(g.ids[1]);
  if(r0.rating !== 1216 || r1.rating !== 1184) bad.push("1200 v 1200 win: ratings " + r0.rating + " / " + r1.rating + ", wanted 1216 / 1184");
  if(r0.games !== 1 || r0.wins !== 1 || r1.games !== 1 || r1.losses !== 1) bad.push("the records are wrong: " + JSON.stringify([r0, r1]));
  /* each phone can read the change: the caller from its response, the other seat from its next answer; the row keeps the public summary */
  const res = g.row().result;
  if(!res || JSON.stringify(res.change) !== JSON.stringify([{from: 1200, to: 1216}, {from: 1200, to: 1184}]) || res.winner !== 0 || res.how !== "concession") bad.push("the row's summary: " + JSON.stringify(res));
  const callerResp = g.audit.resps[g.audit.resps.length - 1];
  if(!callerResp.result || callerResp.result.winner !== 0) bad.push("the conceding phone's own answer did not carry the result: " + JSON.stringify(Object.keys(callerResp)));
  const other = g.resync(0);
  if(!other.ok || !other.result || JSON.stringify(other.result.change) !== JSON.stringify(res.change)) bad.push("the other seat's resync did not carry the result");
  /* the other way: seat 0 concedes, seat 1 wins */
  const h = table({server, salt: "win1"}); h.concede(0);
  if(h.rat.rating(h.ids[1]).rating !== 1216 || h.rat.rating(h.ids[0]).rating !== 1184 || h.row().result.winner !== 1) bad.push("seat 1's win did not move 1200 v 1200 to 1184 / 1216");
  /* an unequal pair: seat 0 at 1300, seat 1 at 1200 — the favourite wins (1312 / 1188) ... */
  const u = F.withRatings(); u.set("P-seat-zero-id", 1300);
  const fav = table({server, salt: "fav", rat: u}); fav.concede(1);
  if(u.rating("P-seat-zero-id").rating !== 1312 || u.rating("P-seat-one-id").rating !== 1188) bad.push("1300 beats 1200: " + u.rating("P-seat-zero-id").rating + " / " + u.rating("P-seat-one-id").rating + ", wanted 1312 / 1188");
  /* ... or loses (1280 / 1220) */
  const u2 = F.withRatings(); u2.set("P-seat-zero-id", 1300);
  const dog = table({server, salt: "dog", rat: u2}); dog.concede(0);
  if(u2.rating("P-seat-zero-id").rating !== 1280 || u2.rating("P-seat-one-id").rating !== 1220) bad.push("1300 loses to 1200: " + u2.rating("P-seat-zero-id").rating + " / " + u2.rating("P-seat-one-id").rating + ", wanted 1280 / 1220");
  /* a DRAW, the engine's dead position: 1300 v 1200 -> 1296 / 1204; each player's record counts a draw */
  const u3 = F.withRatings(); u3.set("P-seat-zero-id", 1300);
  const dr = table({server, salt: "draw", rat: u3}); dr.drawIt();
  const dover = dr.t.hub.session().full().over;
  if(!dover || dover.winner !== null || dover.how !== "stalemate") return bad.concat("the dead position did not end as a draw: " + JSON.stringify(dover));
  if(u3.results.size !== 1) bad.push("a draw recorded " + u3.results.size + " results");
  const ds = [...u3.results.values()][0];
  if(ds.winner !== null || ds.how !== "stalemate") bad.push("the draw was stored as " + JSON.stringify([ds.winner, ds.how]));
  if(u3.rating("P-seat-zero-id").rating !== 1296 || u3.rating("P-seat-one-id").rating !== 1204) bad.push("a 1300 v 1200 draw: " + u3.rating("P-seat-zero-id").rating + " / " + u3.rating("P-seat-one-id").rating + ", wanted 1296 / 1204");
  if(u3.rating("P-seat-zero-id").draws !== 1 || u3.rating("P-seat-one-id").draws !== 1 || u3.rating("P-seat-zero-id").wins !== 0) bad.push("a draw was not counted as a draw");
  if(dr.row().result.winner !== null || dr.row().result.how !== "stalemate") bad.push("the row's summary of the draw: " + JSON.stringify(dr.row().result));
  /* 1200 v 1200 draw: nobody moves */
  const e = table({server, salt: "draw2"}); e.drawIt();
  if(e.rat.rating(e.ids[0]).rating !== 1200 || e.rat.rating(e.ids[1]).rating !== 1200 || e.rat.rating(e.ids[0]).games !== 1) bad.push("an even draw moved a rating or was not counted");
  return bad;
}
test("(3) A FINISHED GAME RECORDS EXACTLY ONE RESULT with the right winner and the exact Elo move — a win, an unequal pair both ways, a draw (the engine's dead position)", () => {
  assert.deepEqual(resultFailures(SERVER), []);
});
test("SABOTAGE (3): a referee that inverts the winner, records a draw as a win, drops the turns, or never records is seen", () => {
  for(const [what, edits] of [
    ["the winner inverted", [["const winner = over.winner === 0 || over.winner === 1 ? over.winner : null;", "const winner = over.winner === 0 || over.winner === 1 ? 1 - over.winner : null;"]]],
    ["a concession read as the conceder's win (winner = the seat that asked)", [["const winner = over.winner === 0 || over.winner === 1 ? over.winner : null;", "const winner = over.how === \"concession\" ? 1 - over.winner : (over.winner === 0 || over.winner === 1 ? over.winner : null);"]]],
    ["the heroes swapped", [["heroes: spec.heroes.slice(),", "heroes: spec.heroes.slice().reverse(),"]]],
    ["the players swapped", [["players: owners.slice(),", "players: owners.slice().reverse(),"]]],
    ["no turn count", [["turns: Number.isInteger(g.turn) && g.turn >= 0 ? g.turn : 0,", "turns: 0,"]]],
    ["the build forgotten", [["build: row.build || null,", "build: null,"]]],
    ["never recorded", [["const decided = row.ranked === true && row.over === true && row.result == null;", "const decided = false;"], ["if(got.row.ranked === true && got.row.over === true && got.row.result == null) return then(healSoft", "if(false) return then(healSoft"]]],
    ["the change shown in the row is the wrong way round", [["change: rec.ratings.map(x => ({from: x.from, to: x.to}))};", "change: rec.ratings.map(x => ({from: x.from, to: x.to})).reverse()};"]]]])
    assert.ok(probe(() => resultFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
  /* and the fake backend itself: a draw that scores nothing, or a K of 16, would be seen by the shared Elo table */
  assert.ok(eloFailures(F.withRatings({k: 16})).length >= 1, "(control) the shared vectors see a wrong K");
});
/* the fake backend's arithmetic against the shared table (the SQL is held to the same one by tools/sql-pglite.js) */
function eloFailures(rat){
  const bad = [];
  VEC.vectors.forEach((v, i) => {
    const a = "vec-a" + i, b = "vec-b" + i; rat.set(a, v.a).set(b, v.b);
    const r = rat.record({game: "vec-" + i, table: "VECTOR", players: [a, b], names: [null, null], heroes: ["k", "d"], winner: v.outcome === "a" ? 0 : v.outcome === "b" ? 1 : null,
      how: v.outcome === "draw" ? "stalemate" : "life", turns: 5, build: null, started: 0, ended: 0});
    const got = [r.ratings[0].to, r.ratings[1].to];
    if(got[0] !== v.after[0] || got[1] !== v.after[1]) bad.push("vector " + i + " " + JSON.stringify(v) + " -> " + JSON.stringify(got));
  });
  return bad;
}
test("(3) THE ELO TABLE — the fake ratings backend reproduces every shared vector (start 1200, K 32, draw = half a point, rounded)", () => {
  assert.equal(VEC.start, 1200); assert.equal(VEC.k, 32);
  assert.deepEqual(eloFailures(F.withRatings()), []);
  assert.ok(VEC.vectors.length >= 10 && VEC.vectors.some(v => v.outcome === "draw") && VEC.vectors.some(v => v.a !== v.b));
});

/* ---------------------------------------------------------------------------------------------- (2) */
function casualFailures(server){
  const bad = [], g = table({server, salt: "casual", ranked: false});
  const row0 = g.row();
  if(row0.v !== 3 || "ranked" in row0 || "ratings" in row0) bad.push("a casual signed-in row is not the v6.31 shape: " + JSON.stringify([row0.v, Object.keys(row0).filter(k => /rank|rating|result/.test(k))]));
  g.concede(1);
  if(!g.t.hub.session().full().over) return bad.concat("the casual game did not end");
  if(g.rat.records !== 0 || g.rat.results.size !== 0 || g.rat.rt.size !== 0) bad.push("a casual game touched the ratings: records " + g.rat.records + ", players rated " + g.rat.rt.size);
  if(g.rat.lookups !== 0) bad.push("a casual table asked for a rating");
  if("result" in g.row()) bad.push("a casual row grew a result");
  for(const r of g.audit.resps) for(const k of ["ranked", "ratings", "result"]) if(k in r) bad.push("a casual answer carries `" + k + "`: " + r.req);
  const rs = g.resync(0);
  if(!rs.ok || "ranked" in rs || "result" in rs) bad.push("a casual resync carries a ranked field");
  if(g.audit.store.row(g.audit.code).over !== true) bad.push("the casual finished game was not marked over (v6.31 behaviour)");
  /* a game with NO signed-in player at all: nothing but v6.28 */
  const w = world(server, {salt: "plain"});
  const mk = w.go({op: "create"}); const a = w.go({op: "join", table: mk.table}), b = w.go({op: "join", table: mk.table});
  if(!a.ok || !b.ok || "ranked" in a || "ratings" in a || w.row(mk.table).v !== 2) bad.push("an anonymous casual table changed shape");
  if(w.rat.lookups !== 0) bad.push("an anonymous casual join asked for a rating");
  return bad;
}
test("(2) A CASUAL TABLE RECORDS NOTHING and its rows and answers carry no ranked field — the ratings backend is never even asked", () => {
  assert.deepEqual(casualFailures(SERVER), []);
});
test("SABOTAGE (2): a referee that records casual games, or marks every row ranked, is seen", () => {
  for(const [what, edits] of [
    ["every decided game is recorded", [["const decided = row.ranked === true && row.over === true && row.result == null;", "const decided = row.over === true && row.result == null;"]]],
    ["a signed-in casual row answers as ranked", [["const rankPub = row => row.ranked === true ? {", "const rankPub = row => row.ranked === true || row.v === 3 ? {"]]]])
    assert.ok(probe(() => casualFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (4) */
function twiceFailures(server, o){
  o = o || {};
  const bad = [], g = table({server, salt: "twice", rat: o.rat}), au = g.audit;
  g.concede(1);
  if(g.rat.records !== 1) return bad.concat("the first end recorded " + g.rat.records + " times");
  const rate = () => [g.rat.rating(g.ids[0]).rating, g.rat.rating(g.ids[1]).rating, g.rat.rating(g.ids[0]).games, g.rat.rating(g.ids[1]).games].join();
  const want = "1216,1184,1,1";
  if(rate() !== want) bad.push("after one end the ratings read " + rate());
  /* (a) the ending frame, replayed (the same n): stale, nothing more */
  const lastFrame = au.reqs.filter(r => r.op === "frame" && r.seat === 1).pop();
  const replay = json(server.handleNow(lastFrame, au.deps));
  if(replay.ok) bad.push("a replayed ending frame was accepted");
  /* (b) resyncs from both seats, three times */
  for(let i = 0; i < 3; i++) for(const s of [0, 1]){ const r = g.resync(s); if(!r.ok || !r.result) bad.push("a resync did not answer the result"); }
  /* (c) takeovers by identity (a new phone, no key) for both seats */
  for(const s of [0, 1]){ const r = json(server.handleNow({op: "join", table: au.code, identity: {token: g.toks[s]}}, au.deps)); if(!r.ok || !r.result) bad.push("a takeover did not answer the result: " + JSON.stringify(r).slice(0, 80)); }
  /* (d) a keyed rejoin, a second concede from the other seat, a frame after the end */
  const keys = au.store.row(au.code).hub.keys;
  for(const s of [0, 1]) json(server.handleNow({op: "join", table: au.code, seat: s, key: keys[s]}, au.deps));
  g.concede(0);
  if(g.rat.records !== 1 || g.rat.duplicates !== 0) bad.push("replays, resyncs, takeovers and a second concede reached the backend " + g.rat.records + " times (" + g.rat.duplicates + " duplicates)");
  if(rate() !== want) bad.push("ratings moved after the end: " + rate());
  if(g.rat.results.size !== 1) bad.push(g.rat.results.size + " results stored");
  /* (e) the result is lost from the ROW (a lost second write): the next request records again, the backend answers the stored result, nothing moves */
  const row = au.store.row(au.code); delete row.result;
  au.store.put(au.code, row, au.store.version(au.code));
  const heal = g.resync(0);
  if(!heal.ok || !heal.result || JSON.stringify(heal.result.change) !== JSON.stringify([{from: 1200, to: 1216}, {from: 1200, to: 1184}])) bad.push("a row that lost its result was not healed with the STORED change: " + JSON.stringify(heal.result));
  if(g.rat.records !== 2 || g.rat.duplicates !== 1) bad.push("the healing record was not a duplicate at the backend: " + g.rat.records + "/" + g.rat.duplicates);
  if(rate() !== want || g.rat.results.size !== 1) bad.push("healing moved a rating or stored a second result: " + rate());
  g.resync(1); g.resync(0);
  if(g.rat.records !== 2) bad.push("a settled game kept asking the backend");
  return bad;
}
test("(4) NEVER TWICE — a replayed ending, resyncs, takeovers, a keyed return, a second concede and a row that lost its result: one result, both ratings moved once", () => {
  assert.deepEqual(twiceFailures(SERVER), []);
});
test("SABOTAGE (4): a backend that is not idempotent, or a referee that asks again after it is settled, is seen", () => {
  assert.ok(twiceFailures(SERVER, {rat: F.withRatings({noIdempotent: true})}).length >= 1, "a backend that records every call must be seen");
  assert.ok(twiceFailures(loadServer([["if(got.row.ranked === true && got.row.over === true && got.row.result == null) return then(healSoft", "if(got.row.ranked === true && got.row.over === true) return then(healSoft"]])).length >= 1, "a referee that keeps asking after it is settled must be seen");
});

function failedRecordFailures(server){
  const bad = [], g = table({server, salt: "fail"}), au = g.audit;
  g.rat.failing = true;
  g.concede(1);
  const full = g.t.hub.session().full();
  if(!full.over) return ["the game did not end while the ratings database was down — a failed record must never undo or block the game"];
  if(g.row().result !== undefined) bad.push("a result is in the row though the backend failed");
  if(!g.logs.length && !au.errors.some(e => /ratings database is down/.test(e))) bad.push("the failure was not logged for the operator");
  if(g.row().over !== true) bad.push("the finished game is not marked over");
  if(au.responses.some(x => x.req === "frame" && x.ok === false && x.refused === "internal")) bad.push("the ending move was refused `internal` though it was saved");
  if(g.rat.results.size !== 0) bad.push("something was stored while down");
  /* still down: a resync serves the table and the game is still over; nothing is erased */
  const down = g.resync(0);
  if(!down.ok || down.result) bad.push("a resync while the backend is down: " + JSON.stringify([down.ok, down.refused, !!down.result]));
  /* the creator closes now: refused, and the table stays (it is NOT closed over a result it could not record) */
  const close = json(server.handleNow({op: "close", table: au.code, identity: {token: g.toks[0]}}, au.deps));
  if(close.ok || close.refused !== "internal") bad.push("a close that could not record the result answered " + JSON.stringify(close));
  if(g.row().closed === true) bad.push("the table was closed over an unrecorded result");
  /* back up: the next request of any kind records it */
  g.rat.failing = false;
  const up = g.resync(1);
  if(!up.ok || !up.result || up.result.winner !== 0) bad.push("the next request did not settle the game: " + JSON.stringify([up.ok, up.result]));
  if(g.rat.results.size !== 1 || g.rat.rating(g.ids[0]).rating !== 1216 || g.rat.rating(g.ids[1]).rating !== 1184) bad.push("the healed result is wrong: " + g.rat.rating(g.ids[0]).rating + " / " + g.rat.rating(g.ids[1]).rating);
  const closeOk = json(server.handleNow({op: "close", table: au.code, identity: {token: g.toks[0]}}, au.deps));
  if(!closeOk.ok || g.row().closed === true || !g.row().result) bad.push("a close after a decided game erased or closed it: " + JSON.stringify(closeOk));
  if(!g.resync(0).result) bad.push("the result is gone after a close");
  return bad;
}
test("(4) A FAILED RECORD NEVER UNDOES THE GAME — the move is saved, the failure is logged, any later request records it, and a close in between is refused rather than closing over it", () => {
  assert.deepEqual(failedRecordFailures(SERVER), []);
});
test("SABOTAGE (4b): a referee that fails the move when the record fails, never heals, or lets a close through is seen", () => {
  for(const [what, edits] of [
    ["the move fails with the record", [["try { const v = settle(version); return isP(v) ? v.then(x => x, bad) : v; } catch(e){ return bad(e); }", "return settle(version);"]]],
    ["never heals", [["if(got.row.ranked === true && got.row.over === true && got.row.result == null) return then(healSoft(req.table, got, deps), g2 => fn(req, g2, deps));", ""]]],
    ["close ignores an unrecorded result and closes the table", [["return then(healStrict(req.table, got, deps), () => ({ok: true}));\n    if(got.row.over === true) return {ok: true};", "void 0;"]]]])
    assert.ok(failedRecordFailures(loadServer(edits)).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (5) */
function forgeFailures(server){
  const bad = [];
  /* a phone's intent that says who wins: the seat is the CHANNEL's, the winner is the reducer's. Seat 0 concedes and claims to have won. */
  const forge = (m, P) => m && m.t === "intent" ? {...m, winner: P.seat, result: {winner: P.seat}, over: {winner: P.seat, how: "life"}, action: {...m.action, winner: P.seat, over: {winner: P.seat}}} : m;
  const g = table({server, salt: "forge", forge});
  g.concede(0);
  const over = g.t.hub.session().full().over;
  if(!over || over.winner !== 1 || over.how !== "concession") bad.push("a forged intent changed how the game ended: " + JSON.stringify(over));
  if(g.rat.results.size !== 1 || [...g.rat.results.values()][0].winner !== 1) bad.push("the conceding seat was not recorded as the loser: " + JSON.stringify([...g.rat.results.values()].map(x => x.winner)));
  if(g.rat.rating(g.ids[0]).rating !== 1184 || g.rat.rating(g.ids[1]).rating !== 1216) bad.push("the forged claim moved the ratings the wrong way");
  /* the same intent claiming the OTHER seat's name (a phone speaks for its own seat only): refused, nothing ends, nothing is recorded */
  const swap = table({server, salt: "forge-seat", forge: (m, P) => m && m.t === "intent" ? {...m, seat: 1 - P.seat} : m});
  swap.concede(0);
  if(swap.t.hub.session().full().over || swap.rat.records !== 0) bad.push("an intent that spoke for the other seat ended the game or recorded a result");
  /* requests of every op, carrying a winner, a result or a rating: none writes a result */
  const h = table({server, salt: "forge2"}), au2 = h.audit, code = au2.code, keys = au2.store.row(code).hub.keys;
  const spam = [
    {op: "record", table: code, winner: 0, how: "life"}, {op: "result", table: code, winner: 0}, {op: "settle", table: code}, {op: "rate", player: h.ids[0], rating: 3000},
    {op: "resync", table: code, seat: 0, key: keys[0], winner: 0, result: {winner: 0, how: "life"}, ranked: true, ratings: [3000, 0], over: {winner: 0}},
    {op: "frame", table: code, seat: 0, key: keys[0], n: 9999, winner: 0, result: {winner: 0}, frame: {ch: "net", m: {t: "over", winner: 0, how: "life"}}},
    {op: "frame", table: code, seat: 0, key: keys[0], n: 10000, frame: {ch: "lobby", m: {t: "result", winner: 0, seat: 0}}},
    {op: "frame", table: code, seat: 0, key: keys[0], n: 10001, frame: {ch: "judge", winner: 0}},
    {op: "join", table: code, seat: 0, key: keys[0], winner: 0, result: {winner: 0}},
    {op: "close", table: code, identity: {token: h.toks[1]}, winner: 0, result: {winner: 0}},      /* not the creator: refused (a creator's own close is drill 6) */
    {op: "create", table: "FORGE1", identity: {token: h.toks[0]}, ranked: true, result: {winner: 0}, ratings: [3000, 3000], over: true}];
  for(const req of spam){ try { server.handleNow(req, au2.deps); } catch(e){ bad.push("a request threw: " + req.op); } }
  if(h.rat.records !== 0 || h.rat.results.size !== 0 || h.rat.rt.size !== 0) bad.push("a request with a winner in it reached the ratings: records " + h.rat.records);
  if(h.row().result !== undefined) bad.push("a request put a result in the row");
  if(h.t.hub.session().full().over) bad.push("a request ended the game");
  const refusedOps = ["record", "result", "settle", "rate"].map(op => json(server.handleNow({op, table: code, winner: 0}, au2.deps)));
  if(!refusedOps.every(r => r.ok === false && r.refused === "bad-request")) bad.push("an op that is not the function's was not refused bad-request: " + JSON.stringify(refusedOps));
  /* the game goes on and ends the honest way */
  h.concede(1);
  if(h.rat.records !== 1 || [...h.rat.results.values()][0].winner !== 0) bad.push("after the forgeries the honest ending was not recorded once, for seat 0");
  return bad;
}
test("(5) A PHONE CANNOT FORGE A RESULT — forged intents, requests of every op and a lobby or net frame that name a winner change nothing; the conceder is the loser", () => {
  assert.deepEqual(forgeFailures(SERVER), []);
});
test("SABOTAGE (5): a referee that takes a winner from the request, or has an op that records one, is seen", () => {
  assert.ok(forgeFailures(loadServer([["  if(req.op === \"close\") return opCloseTable(req, deps);", "  if(req.op === \"close\") return opCloseTable(req, deps);\n  if(req.op === \"record\") return then(deps.store.get(req.table), got => then(deps.record({game: gameId(got.row), table: req.table, players: ownersOf(got.row), names: [null, null], heroes: [\"a\", \"b\"], winner: req.winner, how: req.how, turns: 1, build: null, started: 0, ended: 0}), () => ({ok: true})));"]])).some(x => /bad-request|reached the ratings/.test(x)), "an op that records what the phone says must be seen");
  assert.ok(forgeFailures(loadServer([["const winner = over.winner === 0 || over.winner === 1 ? over.winner : null;", "const winner = hub.claimed != null ? hub.claimed : (over.winner === 0 || over.winner === 1 ? over.winner : null);"]])).length === 0, "(control) an unused hook changes nothing");
});

/* ---------------------------------------------------------------------------------------------- (6) */
function closeFailures(server){
  const bad = [], g = table({server, salt: "close"}), au = g.audit;
  const close = tok => json(server.handleNow({op: "close", table: au.code, identity: {token: tok}}, au.deps));
  /* another player cannot close it */
  const intruder = close(g.toks[1]);
  if(intruder.ok || intruder.refused !== "not-creator") bad.push("a seated player who is not the creator closed it: " + JSON.stringify(intruder));
  /* the creator closes it MID-GAME: allowed (v6.31), and nothing is recorded — the gap */
  const mid = close(g.toks[0]);
  if(!mid.ok) bad.push("the creator could not close a table mid-game: " + JSON.stringify(mid));
  if(g.row().closed !== true || g.rat.records !== 0 || g.rat.results.size !== 0 || g.rat.rt.size !== 0) bad.push("a mid-game close recorded something or did not close: records " + g.rat.records);
  if(g.resync(0).refused !== "no-table") bad.push("a closed table still answers its seats");
  /* a lobby that never started: closes, records nothing */
  const w = world(server, {salt: "close0"}), A = w.player("P-closer", "Closer One"), t0 = w.ranked(A);
  if(!w.go({op: "close", table: t0.table, identity: {token: A.tok}}).ok || w.rat.records !== 0) bad.push("an empty ranked table could not be closed quietly");
  /* after a decided game: the close changes nothing and the result stands (v6.31's `over` rule), through every later request */
  const h = table({server, salt: "close2"}), au2 = h.audit;
  h.concede(1);
  const rows0 = JSON.stringify(h.row().result), ver0 = au2.store.version(au2.code);
  const after = json(server.handleNow({op: "close", table: au2.code, identity: {token: h.toks[0]}}, au2.deps));
  if(!after.ok) bad.push("closing a decided table answered " + JSON.stringify(after));
  if(h.row().closed === true || JSON.stringify(h.row().result) !== rows0 || au2.store.version(au2.code) !== ver0) bad.push("a close after a decided game changed or closed the table");
  if(h.rat.results.size !== 1) bad.push("a close after a decided game erased the result");
  const rs = h.resync(1); if(!rs.ok || !rs.result) bad.push("the result is not readable after the close");
  return bad;
}
test("(6) CLOSE — a ranked table closed mid-game records nothing (the gap the forfeit clock will close); after a decided game a close erases and changes nothing", () => {
  assert.deepEqual(closeFailures(SERVER), []);
});
test("SABOTAGE (6): a close that closes a decided table, or that records a mid-game table, is seen", () => {
  assert.ok(closeFailures(loadServer([["    if(got.row.over === true) return {ok: true};\n    const row = got.row; row.over = true; row.closed = true;", "    const row = got.row; row.over = true; row.closed = true;"]])).length >= 1, "a close that closes over a decided game must be seen");
  assert.ok(closeFailures(loadServer([["    const row = got.row; row.over = true; row.closed = true;", "    const row = got.row; row.over = true; row.closed = true; if(row.ranked === true) deps.record({game: gameId(row), table: row.id, players: ownersOf(row), names: [null, null], heroes: [\"a\", \"b\"], winner: 0, how: \"concession\", turns: 1, build: null, started: 0, ended: 0});"]])).length >= 1, "a close that records a result for a game nobody finished must be seen");
});

/* ---------------------------------------------------------------------------------------------- (7), (3c) a whole game */
const PUBLIC_KEYS = ["ok", "version", "frames", "seat", "n", "owned", "names", "ranked", "ratings", "result", "broadcast", "refused", "retry", "taken", "table"];
function wholeGame(server){
  const g = table({server, salt: "whole"});
  let steps = 0, mism = 0;
  while(steps < 3000 && g.t.step()){ steps++; for(const s of [0, 1]) if(!g.t.agrees(s)) mism++; }
  return {g, steps, mism};
}
let WHOLE = null; const whole = () => WHOLE || (WHOLE = wholeGame(SERVER));
test("(3) A WHOLE RANKED GAME, played by both phones to its end — one result, the winner and the ending are the engine's, the ratings moved by the Elo amount, and the scans find nothing", () => {
  const {g, mism} = whole(), au = g.audit, full = g.hub.session().full();
  assert.ok(full.over, "the game finished");
  assert.equal(mism, 0, "each phone's fingerprint was the referee's view of its seat at every step");
  assert.deepEqual(au.errors, [], "no internal error");
  assert.equal(g.rat.results.size, 1); assert.equal(g.rat.records, 1);
  const stored = [...g.rat.results.values()][0];
  assert.equal(stored.winner, full.over.winner); assert.equal(stored.how, full.over.how); assert.equal(stored.turns, full.turn);
  assert.equal(stored.heroes.join(), "blaze,dorinthea");
  const [a, b] = [g.rat.rating(g.ids[0]), g.rat.rating(g.ids[1])];
  const want = full.over.winner === 0 ? [1216, 1184] : full.over.winner === 1 ? [1184, 1216] : [1200, 1200];
  assert.deepEqual([a.rating, b.rating], want);
  assert.equal(a.games, 1); assert.equal(b.games, 1);
  assert.deepEqual(au.leaks, [], "the audit (keys, seed, channel names, ids, tokens) found: " + au.leaks.slice(0, 2));
  assert.equal(g.row().result.how, full.over.how);
  assert.equal(g.row().over, true);
});
test("(7) PRIVACY — in a whole ranked game no player id or token is in any response, broadcast, frame or stored summary; every answer key is on the public list; the result summary has exactly its public fields", () => {
  const {g} = whole(), au = g.audit;
  const hay = JSON.stringify([au.resps, au.bus.log, g.t.phones.map(p => p.inbox), g.row().result]);
  for(const x of g.ids.concat(g.toks)) assert.equal(hay.indexOf(x), -1, "an id or token reached a response, broadcast, frame or the result: " + x.slice(0, 6));
  for(const r of au.resps) for(const k of Object.keys(r)) assert.ok(PUBLIC_KEYS.includes(k), "an answer carries a key that is not public by design: " + k);
  assert.deepEqual(Object.keys(g.row().result).sort(), ["change", "heroes", "how", "turns", "winner"]);
  assert.ok(au.bus.log.every(e => Object.keys(e.payload).sort().join() === "frames,mac,ver"), "no broadcast envelope grew a field");
  assert.ok(au.resps.some(r => r.ranked === true && Array.isArray(r.ratings)), "(not vacuous) ranked answers were sent");
  assert.ok(au.resps.some(r => r.result), "(not vacuous) the result was sent");
  /* what the stored row holds is the function's own; the phones' inboxes never saw a rating row or a result outside an answer */
  for(const p of g.t.phones) assert.equal(JSON.stringify(p.inbox).indexOf('"change"'), -1, "the rating change rode a frame");
});
test("SABOTAGE (7): a result that carries the player ids, or a broadcast that carries the result, is seen by the scans", () => {
  const leaky = loadServer([["const shown = {winner: res.winner, how: res.how, turns: res.turns,", "const shown = {players: res.players, winner: res.winner, how: res.how, turns: res.turns,"]]);
  const g = table({server: leaky, salt: "leak"}); g.concede(1);
  assert.ok(g.audit.leaks.length >= 1 || JSON.stringify(g.audit.resps).indexOf(g.ids[0]) >= 0, "the id inside the result must be seen");
  assert.ok(Object.keys(g.row().result).sort().join() !== "change,heroes,how,turns,winner", "and the key list sees it");
  assert.ok(g.audit.resps.some(r => r.result && r.result.players), "(control) the leaky referee did put ids in an answer");
});

/* ---------------------------------------------------------------------------------------------- (8) */
function meFailures(server){
  const bad = [], w = world(server, {salt: "me"});
  const A = w.player("P-me-a", "Alpha One"), B = w.player("P-me-b", "Bravo Two");
  const fresh = w.go({op: "me", identity: {token: A.tok}});
  if(JSON.stringify(fresh) !== JSON.stringify({ok: true, name: "Alpha One", rating: 1200, games: 0, wins: 0, losses: 0, draws: 0})) bad.push("a fresh player's me: " + JSON.stringify(fresh));
  w.rat.record({game: "g-me", table: "TME", players: ["P-me-a", "P-me-b"], names: [null, null], heroes: ["k", "d"], winner: 0, how: "life", turns: 4, build: null, started: 0, ended: 0});
  const a = w.go({op: "me", identity: {token: A.tok}}), b = w.go({op: "me", identity: {token: B.tok}});
  if(a.rating !== 1216 || a.wins !== 1 || a.games !== 1 || b.rating !== 1184 || b.losses !== 1) bad.push("me after a game: " + JSON.stringify([a, b]));
  const named = w.go({op: "me", identity: {token: A.tok}, name: "Alpha Prime"});
  if(!named.ok || named.name !== "Alpha Prime" || named.rating !== 1216) bad.push("a name change did not answer the rating: " + JSON.stringify(named));
  for(const r of [fresh, a, b, named]) for(const k of Object.keys(r)) if(!["ok", "name", "rating", "games", "wins", "losses", "draws"].includes(k)) bad.push("me carries `" + k + "`");
  if(JSON.stringify([fresh, a, b]).indexOf("P-me-") >= 0) bad.push("a player id rode me");
  const forged = w.go({op: "me", identity: {token: "jwt.forged"}});
  if(forged.ok || forged.refused !== "identity") bad.push("a forged token read a rating");
  /* a function that cannot read ratings answers v6.31's me, byte for byte */
  const w2 = world(server, {salt: "me2", noRank: true}), C = w2.player("P-me-c", "Charlie Three");
  if(JSON.stringify(w2.go({op: "me", identity: {token: C.tok}})) !== JSON.stringify({ok: true, name: "Charlie Three"})) bad.push("without ratings me is not v6.31's answer");
  return bad;
}
test("(8) me — the rating and the record of the player asked (1200 and no games when fresh), public fields only; v6.31's answer when the function cannot read ratings", () => {
  assert.deepEqual(meFailures(SERVER), []);
});
test("SABOTAGE (8): a me that reads another player's rating, or adds an id, is seen", () => {
  assert.ok(meFailures(loadServer([["return then(deps.rating(seen.player), rt => ({...ans, ...ratingOf(rt)}));", "return then(deps.rating(\"P-me-b\"), rt => ({...ans, ...ratingOf(rt)}));"]])).length >= 1, "another player's rating must be seen");
  assert.ok(meFailures(loadServer([["return then(deps.rating(seen.player), rt => ({...ans, ...ratingOf(rt)}));", "return then(deps.rating(seen.player), rt => ({...ans, ...ratingOf(rt), player: seen.player}));"]])).length >= 1, "an id in me must be seen");
});

/* ---------------------------------------------------------------------------------------------- the ledger */
test("LEDGER — the rating arithmetic lives in SQL only: referee.js computes no rating, and names no table, URL or SQL", () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/Math\.pow|\*\* ?\(|1200|expected score|\belo\b/i.test(code) && !/\bK ?[=*]/.test(code), "the referee must not do Elo");
  assert.ok(!/select |insert into|rpc\/|result_record|rating_get/i.test(code), "the referee must name no SQL");
  assert.ok(/deps\.record/.test(code) && /deps\.rating/.test(code));
  const sql = fs.readFileSync(path.join(ROOT, "server", "supabase", "006_ratings.sql"), "utf8");
  assert.equal((sql.match(/select 1200/g) || []).length, 1, "the starting rating is stated once");
  assert.equal((sql.match(/select 32/g) || []).length, 1, "K is stated once");
});
