/* test/serverladder.test.js — THE PUBLIC LADDER (SERVER S5.3).

   server/referee.js's {op:"ladder"}, over the fake store, the fake sign-in provider and the fake ratings + ladder backends (test/helpers/serverfakes.js withRatings,
   withLadder: what 008_ladder.sql's ladder_get does, held to the SQL by its own self-check and tools/sql-sab-008.js). Each drill has a sabotage that fails it:

     (1) THE FLOOR AND WHO IS LISTED — three ranked games to be listed; a nameless player and an orphan (no sign-in points at them) never are; the answer's numbers.
     (2) THE ORDER — rating, then more games, then name: a total order, the same every time; ranks are the positions.
     (3) THE CAP — fifty rows, the 51st is not shown; a backend that sends more is refused, never shown.
     (4) THE CALLER'S LINE — rank when listed (also below the cap), games still to play when not, nothing for a stranger, exactly its public fields.
     (5) A PUBLIC READ — no identity, a malformed one, a forged one, a provider that throws or rejects, a function with no provider: the list still answers.
     (6) RECENT RESULTS — the last ten, newest first, both names and heroes, the winner (or none), how it ended, when; a real conceded game reaches it.
     (7) NO LEAK — no player id, token or subject anywhere in any answer; every key is on a public list; a backend that adds an id is stripped.
     (8) NO WRITES — a read changes nothing: no row, no rating for a stranger, no table touched, no result recorded.
     (9) THE BACKEND'S CONTRACT — a list over the cap, under the floor, out of order or with wrong ranks is `internal`; no backend wired is `unavailable`. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub} = require("./helpers/serverhub.js");
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
/* a sabotaged referee may break the probe itself: that is a sabotage seen. A sabotage whose anchor no longer matches is NOT (it would pass for the wrong reason): that throws out */
const probe = f => { try { return f(); } catch(e){ if(e && /sabotage anchor/.test(e.message)) throw e; return ["the probe threw: " + (e && e.message)]; } };
const TOP_KEYS = ["ok", "floor", "cap", "ladder", "recent", "you"], ROW_KEYS = ["draws", "games", "losses", "name", "rank", "rating", "wins"],
  YOU_KEYS = ["draws", "games", "listed", "losses", "name", "rank", "rating", "toGo", "wins"], RECENT_KEYS = ["at", "heroes", "how", "names", "winner"];

/* a referee over the fakes. `go` answers one ladder request as JSON. `player(id, name, rating, games)` seeds a standing (a rating row, a sign-in and, with a name, a registry entry). */
function world(server, o){
  o = o || {};
  const store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp, o.lad), logs = [], sent = [];
  let clock = 1700000000000;
  const deps = {store, broadcast: (t, p) => sent.push({t, p}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => T.seeded("ladder|" + (o.salt || "")),
    identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f), log: e => logs.push(String(e && e.message || e)), ...rat.deps(), ...(o.noLadder ? {} : lad.deps()), ...(o.deps || {})};
  const go = (req, d) => json(server.handleNow(req || {op: "ladder"}, d || deps));
  const player = (id, name, rating, games) => { const tok = idp.issue(id); if(name) idp.rename(id, name, server.nameFold(name));
    if(rating !== undefined){ const g = games === undefined ? 3 : games; rat.rt.set(id, {rating, games: g, wins: g, losses: 0, draws: 0}); } return {id, tok, name}; };
  /* a recorded game between two seeded players (the fake backend's own record, as result_record would) */
  let gn = 0;
  const game = (A, B, winner, how, heroes, ended) => rat.record({game: "G" + (++gn), table: "TBL" + gn, players: [A.id, B.id], names: [A.name || null, B.name || null], heroes: heroes || ["kayo", "dash"],
    winner, how: how || (winner === null ? "stalemate" : "life"), turns: 5, build: null, started: 0, ended: ended || 1700000000000 + gn * 1000});
  const names = r => r.ladder.map(x => x.name);
  return {server, store, idp, rat, lad, deps, logs, sent, go, player, game, names, snap: () => JSON.stringify([[...store.rows.keys()], store.puts, store.gets, [...rat.rt.entries()], rat.records, [...rat.results.keys()], sent.length])};
}

/* ---------------------------------------------------------------------------------------------- (1) */
function floorFailures(server, lo){
  const bad = [], w = world(server, {salt: "floor", lad: lo}), rows = [];
  for(const [id, name, rating, games] of [["p0", "Zero Games", 1800, 0], ["p1", "One Game", 1700, 1], ["p2", "Two Games", 1600, 2], ["p3", "Three Games", 1500, 3], ["p4", "Four Games", 1400, 4]]) rows.push(w.player(id, name, rating, games));
  const nameless = w.player("pn", null, 1900, 9);                                  /* a rating and a sign-in, no chosen name */
  const orphan = w.player("po", "Orphan Rated", 1950, 9); w.idp.expire(orphan.tok); /* a name and a rating, no sign-in points at it any more */
  const r = w.go();
  if(!r.ok) return ["the ladder was refused: " + JSON.stringify(r)];
  if(r.floor !== 3 || r.cap !== 50) bad.push("floor/cap are " + r.floor + "/" + r.cap + ", wanted 3/50");
  const want = ["Three Games", "Four Games"];
  if(JSON.stringify(w.names(r)) !== JSON.stringify(want)) bad.push("only the players with three games or more are listed (by rating): " + JSON.stringify(w.names(r)));
  if(r.ladder.some(x => x.name === "Orphan Rated")) bad.push("an orphan is on the ladder");
  if(r.ladder.length !== 2 || r.ladder.some(x => !x.name || x.name === "Unnamed")) bad.push("a nameless player is on the ladder");
  /* a player reaches the floor by playing: the third recorded game lists them, the second does not */
  const a = w.player("pa", "Newcomer One"), b = w.player("pb", "Newcomer Two");
  w.game(a, b, 0); w.game(a, b, 1);
  if(w.names(w.go()).some(n => n.startsWith("Newcomer"))) bad.push("two recorded games listed a player");
  w.game(a, b, 0);
  const r3 = w.go(), n3 = w.names(r3).filter(n => n.startsWith("Newcomer"));
  if(n3.length !== 2) bad.push("three recorded games did not list both players: " + JSON.stringify(n3));
  const row = r3.ladder.find(x => x.name === "Newcomer One");
  if(!row || row.games !== 3 || row.wins !== 2 || row.losses !== 1 || row.draws !== 0 || !(row.rating > 1200)) bad.push("the row's numbers are not the record's: " + JSON.stringify(row));
  return bad;
}
test("(1) THE FLOOR AND WHO IS LISTED — three recorded ranked games to appear; a nameless player and an orphan never do; the row carries the record", () => {
  assert.deepEqual(floorFailures(SERVER), []);
});
test("SABOTAGE (1): no floor, a floor of two, listing the nameless or orphans is seen", () => {
  for(const [what, f] of [["no floor (the backend)", () => floorFailures(SERVER, {noFloor: true})], ["nameless listed (the backend)", () => floorFailures(SERVER, {noName: true})],
      ["orphans listed (the backend)", () => floorFailures(SERVER, {noOrphan: true})],
      ["the floor is 2", () => floorFailures(loadServer([["const LADDER_FLOOR = 3,", "const LADDER_FLOOR = 2,"]]))]])
    assert.ok(probe(f).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (2) */
function orderFailures(server, lo){
  const bad = [], w = world(server, {salt: "order", lad: lo});
  /* rating first; then more games; then the name (case does not matter); three players tie on rating and games */
  for(const [id, name, rating, games] of [["a", "Low Rated", 1300, 40], ["b", "Top Rated", 1700, 3], ["c", "Mid Few", 1500, 4], ["d", "Mid Many", 1500, 9], ["e", "zed Tie", 1500, 6], ["f", "Aaron Tie", 1500, 6], ["g", "bob Tie", 1500, 6]]) w.player(id, name, rating, games);
  const want = ["Top Rated", "Mid Many", "Aaron Tie", "bob Tie", "zed Tie", "Mid Few", "Low Rated"];
  const r = w.go(), again = w.go();
  if(!r.ok) return ["refused: " + JSON.stringify(r)];
  if(JSON.stringify(w.names(r)) !== JSON.stringify(want)) bad.push("the order is " + JSON.stringify(w.names(r)) + ", wanted " + JSON.stringify(want));
  if(JSON.stringify(r) !== JSON.stringify(again)) bad.push("two reads of the same ladder differ");
  if(JSON.stringify(r.ladder.map(x => x.rank)) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) bad.push("ranks are not the positions 1..n: " + JSON.stringify(r.ladder.map(x => x.rank)));
  /* seeding in another order changes nothing (a total order, not insertion order) */
  const v = world(server, {salt: "order2", lad: lo});
  for(const [id, name, rating, games] of [["g", "bob Tie", 1500, 6], ["f", "Aaron Tie", 1500, 6], ["e", "zed Tie", 1500, 6], ["d", "Mid Many", 1500, 9], ["c", "Mid Few", 1500, 4], ["b", "Top Rated", 1700, 3], ["a", "Low Rated", 1300, 40]]) v.player(id, name, rating, games);
  if(JSON.stringify(v.names(v.go())) !== JSON.stringify(want)) bad.push("the order depends on who was seeded first: " + JSON.stringify(v.names(v.go())));
  return bad;
}
test("(2) THE ORDER — rating, then more games, then name: a total order, the same every time, ranks are the positions", () => {
  assert.deepEqual(orderFailures(SERVER), []);
});
test("SABOTAGE (2): no games tie-break, names the wrong way round, an unsorted backend is seen", () => {
  for(const [what, lo] of [["no more-games tie-break", {noGames: true}], ["name descending", {byNameDesc: true}], ["rating ascending (the backend)", {unsorted: true}]])
    assert.ok(probe(() => orderFailures(SERVER, lo)).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (3) */
function capFailures(server, lo){
  const bad = [], w = world(server, {salt: "cap", lad: lo});
  for(let i = 0; i < 60; i++) w.player("p" + i, "Player " + String(i).padStart(2, "0"), 1200 + i, 3);       /* 60 listed players: the best has rating 1259 */
  const r = w.go();
  if(!r.ok) return ["refused: " + JSON.stringify(r)];
  if(r.cap !== 50 || r.ladder.length !== 50) bad.push("the list is " + r.ladder.length + " long, wanted 50");
  if(r.ladder[0].rating !== 1259 || r.ladder[49].rating !== 1210) bad.push("the 50 shown are not the best 50: " + r.ladder[0].rating + " .. " + r.ladder[49].rating);
  if(w.lad.last.limit !== 50 || w.lad.last.floor !== 3 || w.lad.last.recent !== 10) bad.push("the backend was asked for " + JSON.stringify(w.lad.last));
  /* the 51st (rating 1209) is not shown, but is ranked 51 in their own line */
  const p51 = w.idp.live.size ? [...w.idp.live.entries()].find(([t, x]) => x.player === "p9") : null;
  const mine = w.go({op: "ladder", identity: {token: p51[0]}});
  if(!mine.ok || !mine.you || mine.you.rank !== 51 || mine.you.listed !== true || mine.ladder.length !== 50 || mine.ladder.some(x => x.name === "Player 09")) bad.push("a listed player below the cap: " + JSON.stringify(mine.you));
  return bad;
}
test("(3) THE CAP — the top fifty; the 51st is not shown but knows their own rank", () => {
  assert.deepEqual(capFailures(SERVER), []);
});
test("SABOTAGE (3): a cap of 49 or 60, a backend that ignores the limit, a caller below the cap who loses their rank are seen", () => {
  for(const [what, f] of [["the cap is 49", () => capFailures(loadServer([["LADDER_CAP = 50,", "LADDER_CAP = 49,"]]))], ["the cap is 60", () => capFailures(loadServer([["LADDER_CAP = 50,", "LADDER_CAP = 60,"]]))],
      ["the backend ignores the limit", () => capFailures(SERVER, {noCap: true})],
      ["the referee does not check the cap AND the backend ignores it", () => { const r = capFailures(loadServer([["if(a.ladder.length > LADDER_CAP) bad(\"more than the cap\");", ""]]), {noCap: true}); return r; }]])
    assert.ok(probe(f).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (4) */
function lineFailures(server, lo){
  const bad = [], w = world(server, {salt: "line", lad: lo});
  const top = w.player("t1", "Top Player", 1600, 8), mid = w.player("t2", "Mid Player", 1400, 5), few = w.player("t3", "Few Games", 1900, 2), none = w.player("t4", "Never Played"), one = w.player("t5", "One Game", 1250, 1);
  const nameless = w.player("t6", null, 1500, 7);
  const as = (p, extra) => w.go({op: "ladder", identity: {token: p.tok}, ...(extra || {})});
  const eq = (what, got, want) => { if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(what + ": " + JSON.stringify(got) + ", wanted " + JSON.stringify(want)); };
  let r = as(mid);
  eq("a listed caller", r.you, {name: "Mid Player", rating: 1400, games: 5, wins: 5, losses: 0, draws: 0, listed: true, rank: 2, toGo: 0});
  eq("a listed caller's public list is the same list", r.ladder.map(x => x.name), ["Top Player", "Mid Player"]);
  eq("the top player", as(top).you.rank, 1);
  r = as(few); eq("a provisional caller (2 games, high rating)", r.you, {name: "Few Games", rating: 1900, games: 2, wins: 2, losses: 0, draws: 0, listed: false, rank: null, toGo: 1});
  r = as(one); eq("one game: two to go", [r.you.listed, r.you.rank, r.you.toGo, r.you.games], [false, null, 2, 1]);
  r = as(none); eq("never played: the starting rating, three to go", [r.you.name, r.you.rating, r.you.games, r.you.listed, r.you.rank, r.you.toGo], ["Never Played", 1200, 0, false, null, 3]);
  r = as(nameless); eq("games but no name: not listed, nothing to wait for but a name", [r.you.name, r.you.games, r.you.listed, r.you.rank, r.you.toGo], [null, 7, false, null, 0]);
  if(Object.keys(r.you).sort().join() !== YOU_KEYS.join()) bad.push("the caller's line has keys " + Object.keys(r.you).sort().join());
  /* the line follows a game: the provisional player plays twice more, then is listed above everyone ahead of them */
  const opp = w.player("t7", "Opponent Seven"); w.game(few, opp, 0); w.game(few, opp, 0);
  r = as(few); eq("after three games the caller is listed", [r.you.listed, r.you.games, r.you.toGo, typeof r.you.rank], [true, 4, 0, "number"]);
  if(r.you.rank !== r.ladder.findIndex(x => x.name === "Few Games") + 1) bad.push("the caller's rank is not their place in the list");
  return bad;
}
test("(4) THE CALLER'S LINE — their rank when listed, the games still to play when not, nothing but public fields", () => {
  assert.deepEqual(lineFailures(SERVER), []);
});
test("SABOTAGE (4): a rank off by one, a floor that does not count down, a line for the provisional that says listed, a dropped line are seen", () => {
  for(const [what, f] of [["rank off by one (the backend)", () => lineFailures(SERVER, {badRank: true})], ["toGo ignores the games", () => lineFailures(loadServer([["Math.max(0, LADDER_FLOOR - y.games)", "LADDER_FLOOR"]]))],
      ["every caller is listed (the backend)", () => lineFailures(SERVER, {noFloor: true})],       ["the line is dropped", () => lineFailures(loadServer([["...(s.you ? {you: s.you} : {})", ""]]))]])
    assert.ok(probe(f).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (5) */
async function publicFailures(server){
  const bad = [], w = world(server, {salt: "public"});
  w.player("a", "Alpha Player", 1500, 5);
  const P = w.player("b", "Bravo Player", 1400, 5);
  const wantNames = ["Alpha Player", "Bravo Player"], listOk = (what, r) => { if(!r || r.ok !== true || JSON.stringify(w.names(r)) !== JSON.stringify(wantNames) || "you" in r) bad.push(what + " did not answer the public list alone: " + JSON.stringify(r && (r.ok ? Object.keys(r) : r))); };
  const before = w.idp.calls;
  listOk("no identity", w.go({op: "ladder"}));
  if(w.idp.calls !== before) bad.push("a read with no identity asked the provider who it was");
  for(const [what, identity] of [["a malformed identity (a string)", "abc"], ["an identity that is a list", [1]], ["a token that is a number", {token: 7}], ["an empty token", {token: ""}], ["a forged token", {token: "jwt.forged"}], ["null", null], ["an over-long token", {token: "x".repeat(5000)}]])
    listOk(what, w.go({op: "ladder", identity}));
  /* the provider throws, rejects, is not wired, or names a player that does not exist: still the public list */
  listOk("a provider that throws", json(server.handleNow({op: "ladder", identity: {token: P.tok}}, {...w.deps, identify: () => { throw new Error("provider down"); }})));
  listOk("a function with no provider", json(server.handleNow({op: "ladder", identity: {token: P.tok}}, {...w.deps, identify: undefined})));
  listOk("a provider that answers nonsense", json(server.handleNow({op: "ladder", identity: {token: P.tok}}, {...w.deps, identify: () => ({player: 7})})));
  const rej = json(await server.handle({op: "ladder", identity: {token: P.tok}}, {...w.deps, identify: () => Promise.reject(new Error("provider down"))}));
  listOk("a provider that rejects", rej);
  const lateOk = json(await server.handle({op: "ladder", identity: {token: P.tok}}, {...w.deps, identify: t => Promise.resolve(w.idp.identify(t)), ladder: x => Promise.resolve(w.lad.ladder(x))}));
  if(!lateOk.ok || !lateOk.you || lateOk.you.rank !== 2) bad.push("the asynchronous path (promises on both seams) lost the caller's line: " + JSON.stringify(lateOk.you));
  if(w.store.gets !== 0 || w.store.puts !== 0) bad.push("a ladder read touched the tables store");
  if(w.logs.length < 1) bad.push("a provider failure was not logged for the operator");
  /* the answer to a stranger with a forged token is byte for byte the answer with no identity */
  if(JSON.stringify(w.go({op: "ladder", identity: {token: "jwt.forged"}})) !== JSON.stringify(w.go({op: "ladder"}))) bad.push("a forged token is told apart from no identity");
  return bad;
}
test("(5) A PUBLIC READ — no identity, a malformed, forged, failing or missing provider: the list still answers, without a caller's line, and the store is never touched", async () => {
  assert.deepEqual(await publicFailures(SERVER), []);
});
test("SABOTAGE (5): a ladder that needs a sign-in, or fails with the provider, is seen", async () => {
  for(const [what, edits] of [["a sign-in is required", [["  if(req.op === \"ladder\") return opLadder(req, deps);", "  if(req.op === \"ladder\" && req.identity === undefined) return no(\"identity\");\n  if(req.op === \"ladder\") return opLadder(req, deps);"]]],
      ["a provider that throws fails the read", [["  let v; try { v = deps.identify(idn.token); } catch(e){ return soft(e); }", "  let v = deps.identify(idn.token);"]]],
      ["a provider that rejects fails the read", [["return isP(v) ? v.then(pick, soft) : pick(v);", "return isP(v) ? v.then(pick) : pick(v);"]]],
      ["a forged token is refused", [["const pick = who => who && typeof who === \"object\" && typeof who.player === \"string\" && PLAYER_RE.test(who.player) ? who.player : null;", "const pick = who => { if(who == null) throw new Error(\"identity\"); return who.player; };"]]]])
    assert.ok((await publicFailures(loadServer(edits)).catch(e => ["rejected: " + e.message])).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (6) */
function recentFailures(server, lo){
  const bad = [], w = world(server, {salt: "recent", lad: lo});
  const A = w.player("a", "Alpha Player", 1200, 0), B = w.player("b", "Bravo Player", 1200, 0);
  const heroes = [["kayo", "dash"], ["dorinthea", "katsu"], ["blaze", "viserai"]];
  /* 12 games: the last two recorded are a draw and a concession; the ladder shows the last ten, newest first */
  for(let i = 0; i < 10; i++) w.game(i % 2 ? B : A, i % 2 ? A : B, 0, "life", heroes[i % 3], 1700000100000 + i * 1000);
  w.game(A, B, null, "stalemate", ["kayo", "katsu"], 1700000200000);
  w.game(B, A, 1, "concession", ["dash", "dorinthea"], 1700000210000);
  const r = w.go();
  if(!r.ok || r.recent.length !== 10) return ["the recent list is " + (r.recent && r.recent.length) + " long, wanted 10"];
  if(JSON.stringify(r.recent[0]) !== JSON.stringify({names: ["Bravo Player", "Alpha Player"], heroes: ["dash", "dorinthea"], winner: 1, how: "concession", at: 1700000210000})) bad.push("the newest result: " + JSON.stringify(r.recent[0]));
  if(JSON.stringify(r.recent[1]) !== JSON.stringify({names: ["Alpha Player", "Bravo Player"], heroes: ["kayo", "katsu"], winner: null, how: "stalemate", at: 1700000200000})) bad.push("a draw: " + JSON.stringify(r.recent[1]));
  for(let i = 1; i < r.recent.length; i++) if(r.recent[i - 1].at < r.recent[i].at) bad.push("recent results are not newest first at " + i);
  if(r.recent.some(x => Object.keys(x).sort().join() !== RECENT_KEYS.join())) bad.push("a recent result has keys other than " + RECENT_KEYS);
  if(new Set(r.recent.map(x => x.at)).size !== 10) bad.push("two recent results share a time (the sample is not distinguishing)");
  /* the ten most recent: the two oldest of twelve are not shown */
  if(r.recent.some(x => x.at < 1700000102000)) bad.push("an old result is among the last ten");
  /* an empty ladder with no results is two empty lists, not a failure */
  const e = world(server, {salt: "empty", lad: lo}).go();
  if(!e.ok || e.ladder.length !== 0 || e.recent.length !== 0) bad.push("an empty project did not answer two empty lists: " + JSON.stringify(e));
  return bad;
}
test("(6) RECENT RESULTS — the last ten, newest first, both names and heroes, the winner (or none), how it ended, when; an empty project answers two empty lists", () => {
  assert.deepEqual(recentFailures(SERVER), []);
});
test("SABOTAGE (6): eleven results, a draw with a winner, the heroes swapped, oldest first are seen", () => {
  for(const [what, f] of [["eleven results", () => recentFailures(loadServer([["LADDER_RECENT = 10;", "LADDER_RECENT = 11;"]]))],
      ["a result's heroes dropped", () => recentFailures(loadServer([["heroes: x.heroes.slice(), winner: x.winner, how: x.how, at: x.at};", "heroes: [\"\", \"\"], winner: x.winner, how: x.how, at: x.at};"]]))],
      ["the winner dropped", () => recentFailures(loadServer([["winner: x.winner, how: x.how, at: x.at};", "winner: 0, how: x.how, at: x.at};"]]))]])
    assert.ok(probe(f).length >= 1, "the sabotage must be seen: " + what);
});
/* a REAL conceded ranked game, played by two phones through the referee, reaches the ladder's recent list with its true winner, heroes and ending */
function realGameFailures(server){
  const bad = [], idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp);
  const ids = ["P-seat-zero-id", "P-seat-one-id"], names = ["Dawn Smith", "Rival One"], toks = ids.map((id, i) => idp.issue(id, names[i]));
  const mk = makeServerHub({server, seedKey: "ladder", identify: t => idp.identify(t), identities: toks, creator: toks[0], ranked: true, rankDeps: {...rat.deps(), ...lad.deps()}, secrets: ids.concat(toks)});
  let hub; const t = T.makeTable({heroes: ["blaze", "dorinthea"], salt: "ladder", throws: [["rock", "rock"], ["paper", "rock"]], makeHub: opts => (hub = mk(opts))}).open();
  const ps = t.seatPhones();
  ps[1].sess.submit({t: "concede"}); t.flush();
  const over = t.hub.session().full().over;
  if(!over || over.how !== "concession" || over.winner !== 0) return ["the game did not end by seat 1's concession"];
  const r = json(server.handleNow({op: "ladder"}, hub.audit.deps).constructor === Object ? server.handleNow({op: "ladder"}, {...hub.audit.deps, ladder: x => lad.ladder(x)}) : null);
  if(!r.ok || r.recent.length !== 1) return ["the conceded game is not in recent results: " + JSON.stringify(r)];
  const x = r.recent[0];
  if(JSON.stringify([x.names, x.heroes, x.winner, x.how]) !== JSON.stringify([["Dawn Smith", "Rival One"], ["blaze", "dorinthea"], 0, "concession"])) bad.push("the recent result is not the game's: " + JSON.stringify(x));
  if(!(x.at > 0)) bad.push("the result has no time");
  if(r.ladder.length !== 0) bad.push("one game put somebody on the ladder");
  return bad;
}
test("(6) A REAL CONCEDED GAME reaches the recent results with its true winner, heroes and ending, and one game lists nobody", () => {
  assert.deepEqual(realGameFailures(SERVER), []);
});
test("SABOTAGE (6b): a referee that records the other winner puts the wrong winner in recent results", () => {
  assert.ok(probe(() => realGameFailures(loadServer([["const winner = over.winner === 0 || over.winner === 1 ? over.winner : null;", "const winner = over.winner === 0 || over.winner === 1 ? 1 - over.winner : null;"]]))).length >= 1);
});

/* ---------------------------------------------------------------------------------------------- (7) */
function leakFailures(server, lo){
  const bad = [], w = world(server, {salt: "leak", lad: lo}), secrets = [];
  const ps = [["p-secret-a", "Alpha Player", 1500, 5], ["p-secret-b", "Bravo Player", 1400, 5], ["p-secret-c", "Charlie Three", 1300, 1]].map(([id, n, r, g]) => { const p = w.player(id, n, r, g); secrets.push(id, p.tok); return p; });
  w.game(ps[0], ps[1], 0);
  const answers = [w.go(), w.go({op: "ladder", identity: {token: ps[0].tok}}), w.go({op: "ladder", identity: {token: ps[2].tok}}), w.go({op: "ladder", identity: {token: "jwt.forged"}})];
  const hay = JSON.stringify(answers);
  for(const x of secrets) if(hay.indexOf(x) >= 0) bad.push("a player id or token is in an answer: " + x.slice(0, 8));
  for(const a of answers){
    for(const k of Object.keys(a)) if(!TOP_KEYS.includes(k)) bad.push("a key that is not public by design: " + k);
    for(const x of a.ladder || []) if(Object.keys(x).sort().join() !== ROW_KEYS.join()) bad.push("a ladder row has keys " + Object.keys(x).sort().join());
    if(a.you && Object.keys(a.you).sort().join() !== YOU_KEYS.join()) bad.push("the caller's line has keys " + Object.keys(a.you).sort().join());
    for(const x of a.recent || []) if(Object.keys(x).sort().join() !== RECENT_KEYS.join()) bad.push("a recent result has keys " + Object.keys(x).sort().join());
  }
  if(!answers[1].ladder.length || !answers[0].recent.length || !answers[1].you) bad.push("(not vacuous) the scanned answers were empty");
  /* what the function logs is the operator's: no id or token there either */
  for(const x of secrets) if(JSON.stringify(w.logs).indexOf(x) >= 0) bad.push("a log line holds " + x.slice(0, 8));
  return bad;
}
test("(7) NO LEAK — no player id, token or subject in any ladder answer; every key is on the public list; a backend that adds an id is stripped", () => {
  assert.deepEqual(leakFailures(SERVER), []);
  assert.deepEqual(leakFailures(SERVER, {leakId: true}), [], "the referee rebuilds every row from its public fields");
});
test("SABOTAGE (7): rows passed through unrebuilt, with a backend that adds the id, are seen", () => {
  assert.ok(probe(() => leakFailures(loadServer([["    return {rank: x.rank, name: x.name, rating: x.rating, games: x.games, wins: x.wins, losses: x.losses, draws: x.draws};", "    return x;"]]), {leakId: true})).length >= 1, "an unrebuilt row must be seen");
  assert.ok(probe(() => leakFailures(loadServer([["    you = {name: y.name,", "    you = {...y, name: y.name,"]]), {leakId: true})).length >= 1, "an unrebuilt caller's line must be seen");
  assert.ok(probe(() => leakFailures(loadServer([["    return {names: x.names.slice(), heroes: x.heroes.slice(), winner: x.winner, how: x.how, at: x.at};", "    return {...x, player: \"p-secret-a\"};"]]))).length >= 1, "an id in a recent result must be seen");
});

/* ---------------------------------------------------------------------------------------------- (8) */
function writeFailures(server, lo){
  const bad = [], w = world(server, {salt: "writes", lad: lo});
  w.player("a", "Alpha Player", 1500, 5); const B = w.player("b", "Bravo Player", 1400, 5);
  const stranger = w.idp.issue("p-stranger");                                       /* signed in, never rated, never named */
  const before = w.snap(), renames = w.idp.renames;
  for(const req of [{op: "ladder"}, {op: "ladder", identity: {token: B.tok}}, {op: "ladder", identity: {token: stranger}}, {op: "ladder", identity: {token: "jwt.forged"}}]) w.go(req);
  if(w.snap() !== before) bad.push("reading the ladder changed the store, a rating, a result or sent a broadcast");
  if(w.rat.rt.has("p-stranger")) bad.push("reading the ladder made a rating row for a player who had none");
  if(w.rat.records !== 0) bad.push("a ladder read recorded something");
  if(w.idp.renames !== renames) bad.push("a ladder read renamed someone");
  if(w.lad.reads < 4) bad.push("(not vacuous) the backend was read " + w.lad.reads + " times");
  return bad;
}
test("(8) NO WRITES — a ladder read changes no row, makes no rating for a stranger, touches no table, records nothing, broadcasts nothing", () => {
  assert.deepEqual(writeFailures(SERVER), []);
});
test("SABOTAGE (8): a read that makes a rating row for its caller is seen", () => {
  assert.ok(probe(() => writeFailures(SERVER, {touch: true})).length >= 1);
});

/* ---------------------------------------------------------------------------------------------- (9) */
function contractFailures(server){
  const bad = [], w = world(server, {salt: "contract"});
  w.player("a", "Alpha Player", 1500, 5); w.player("b", "Bravo Player", 1400, 5);
  const good = w.lad.ladder({player: null, floor: 3, limit: 50, recent: 10});
  const refuse = (what, mutate, want) => {
    const a = JSON.parse(JSON.stringify(good)); mutate(a);
    const r = json(server.handleNow({op: "ladder"}, {...w.deps, ladder: () => a, log: () => {}}));
    if(r.ok || r.refused !== want) bad.push(what + " answered " + JSON.stringify(r.ok ? Object.keys(r) : r) + ", wanted " + want);
  };
  refuse("a list over the cap", a => { a.ladder = Array.from({length: 51}, (_, i) => ({...good.ladder[0], rank: i + 1, rating: 2000 - i})); }, "internal");
  refuse("a player under the floor", a => { a.ladder[1].games = 2; a.ladder[1].wins = 2; }, "internal");
  refuse("rows out of order", a => { a.ladder.reverse(); a.ladder.forEach((x, i) => { x.rank = i + 1; }); }, "internal");
  refuse("ranks that are not 1..n", a => { a.ladder[1].rank = 5; }, "internal");
  refuse("a row without a name", a => { a.ladder[0].name = null; }, "internal");
  refuse("more recent results than asked for", a => { a.recent = Array.from({length: 11}, () => ({names: ["A", "B"], heroes: ["k", "d"], winner: 0, how: "life", at: 1})); }, "internal");
  refuse("a draw with a winner", a => { a.recent = [{names: ["A", "B"], heroes: ["k", "d"], winner: 0, how: "stalemate", at: 1}]; }, "internal");
  refuse("an unknown way to end", a => { a.recent = [{names: ["A", "B"], heroes: ["k", "d"], winner: 0, how: "timeout", at: 1}]; }, "internal");
  refuse("no lists", a => { delete a.ladder; }, "internal");
  refuse("a line that says listed with no rank", a => { a.you = {name: "A", rating: 1, games: 5, wins: 5, losses: 0, draws: 0, listed: true, rank: null}; }, "internal");
  const none = json(server.handleNow({op: "ladder"}, {...w.deps, ladder: undefined}));
  if(none.ok || none.refused !== "unavailable") bad.push("a function with no ladder backend answered " + JSON.stringify(none));
  const down = json(server.handleNow({op: "ladder"}, {...w.deps, ladder: () => { throw new Error("database down p-secret"); }, log: () => {}}));
  if(down.ok || down.refused !== "internal" || JSON.stringify(down).indexOf("database") >= 0) bad.push("a backend failure was not a bare internal: " + JSON.stringify(down));
  return bad;
}
test("(9) THE BACKEND'S CONTRACT — a list over the cap, under the floor, out of order, mis-ranked or malformed is refused internal and never shown; no backend is unavailable", () => {
  assert.deepEqual(contractFailures(SERVER), []);
});
test("SABOTAGE (9): a referee that trusts the backend is seen", () => {
  for(const [what, edits] of [["no floor check", [["    if(x.games < LADDER_FLOOR) bad(\"a player under the floor\");", ""]]], ["no order check", [["  for(let i = 1; i < ladder.length; i++) if(ladderCmp(ladder[i - 1], ladder[i]) > 0) bad(\"rows out of order\");", ""]]],
      ["no rank check", [["    if(x.rank !== i + 1) bad(\"ranks that are not 1..n\");", ""]]], ["no cap check", [["  if(a.ladder.length > LADDER_CAP) bad(\"more than the cap\");", ""]]],
      ["no recent check", [["  if(a.recent.length > LADDER_RECENT) bad(\"more recent results than asked for\");", ""]]]])
    assert.ok(probe(() => contractFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* the ledger: the three numbers are stated once, here, and the referee still imports no rating rule */
test("(ledger) THE LADDER'S NUMBERS ARE STATED ONCE IN THE REFEREE and the answer says them", () => {
  assert.equal(SERVER.LADDER_FLOOR, 3); assert.equal(SERVER.LADDER_CAP, 50); assert.equal(SERVER.LADDER_RECENT, 10);
  assert.equal((SRC.match(/LADDER_FLOOR = /g) || []).length, 1);
  const sql = fs.readFileSync(path.join(ROOT, "server", "supabase", "008_ladder.sql"), "utf8");
  assert.ok(!/p_floor\s*:?=\s*\d/.test(sql) && !/limit\s+50\b/i.test(sql.replace(/--.*$/gm, "")), "the SQL does not hard-code the rule");
  const ts = fs.readFileSync(path.join(ROOT, "server", "supabase", "entry.template.ts"), "utf8");
  assert.ok(/ladder: mkLadder\(c\)/.test(ts) && !/TABLE_IDENTITY"\) === "off" \? \{\} : \{[^}]*ladder/.test(ts), "the function wires the ladder whether or not identity is on (it is public)");
});
