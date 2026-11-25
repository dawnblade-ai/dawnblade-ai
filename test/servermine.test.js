/* test/servermine.test.js — A PLAYER'S OWN LAST RANKED GAMES ON THE LADDER (V; 012_my_games.sql's `mine`).

   server/referee.js's {op:"ladder"} and engine/servertable.js's ladder(), over the fake ratings + ladder backends (test/helpers/serverfakes.js withLadder {mine:true}:
   what 012_my_games.sql does, held to the SQL by its own self-check and tools/sql-sab-012.js). Each drill has a sabotage that fails it:
     (1) THE CALLER'S OWN GAMES — newest first, read from the caller's own seat (own hero, opponent's hero and name, result, rating move, when), exactly the public fields.
     (2) WHO GETS A LIST — a named caller (an empty list when there are no games); no list for a nameless caller, no identity, or a backend that does not know 012.
     (3) THE BACKEND'S CONTRACT — more than ten, or a game that contradicts itself, is `internal`, never shown.
     (4) THE PHONE'S CALL — the page's ladder() carries `mine` for a named caller and has no `mine` key otherwise; a malformed game is dropped. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeWorld} = require("./helpers/servertransport.js");
const ST = require("../engine/servertable.js");
const {json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
const STSRC = fs.readFileSync(path.join(ROOT, "engine", "servertable.js"), "utf8");
function load(src0, rel, edits){
  let src = src0;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, rel, p)), undefined);
  return m.exports;
}
const SERVER_ = require(path.join(ROOT, "server", "referee.js"));
const loadServer = e => load(SRC, "server", e), loadST = e => load(STSRC, "engine", e);
const probe = f => { try { return f(); } catch(e){ if(e && /sabotage anchor/.test(e.message)) throw e; return ["the probe threw: " + (e && e.message)]; } };
const MINE_KEYS = ["at", "change", "foe", "foeHero", "hero", "how", "result"];

function world(server, lo){
  const store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp, lo), sent = [];
  let clock = 1700000000000;
  const deps = {store, broadcast: (t, p) => sent.push({t, p}), deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => T.seeded("mine"), identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f),
    ...rat.deps(), ...lad.deps()};
  const go = (req, d) => json(server.handleNow(req, d || deps));
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, server.nameFold(name)); return {id, tok, name}; };
  let gn = 0;
  const game = (A, B, winner, how, heroes, ended) => rat.record({game: "G" + (++gn), table: "TBL" + gn, players: [A.id, B.id], names: [A.name || null, B.name || null], heroes, winner, how, turns: 5, build: null, started: 0, ended});
  return {store, idp, rat, lad, deps, go, player, game, sent};
}
/* Aye plays Bee four times: a win as seat 0, a loss as seat 1 (heroes the other way round), a draw, a forfeit loss; and Cee (no name) once */
function seeded(server, lo){
  const w = world(server, lo), A = w.player("pa", "Aye Player"), B = w.player("pb", "Bee Player"), C = w.player("pc", null);
  w.game(A, B, 0, "life", ["kayo", "dash"], 1700000001000);
  w.game(B, A, 0, "concession", ["bravo", "katsu"], 1700000002000);
  w.game(A, B, null, "stalemate", ["viserai", "dorinthea"], 1700000003000);
  w.game(A, B, 1, "forfeit", ["rhinar", "dash"], 1700000004000);
  w.game(A, C, 0, "life", ["kayo", "bravo"], 1700000005000);
  return {w, A, B, C};
}
const ask = (w, P) => w.go({op: "ladder", ...(P ? {identity: {token: P.tok}} : {})});

/* ---------------------------------------------------------------------------------------------- (1) */
function ownFailures(server, lo){
  const bad = [], {w, A, B} = seeded(server, lo), r = ask(w, A), m = r.mine || [];
  const eq = (what, got, want) => { if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(what + ": " + JSON.stringify(got) + ", wanted " + JSON.stringify(want)); };
  eq("five games, newest first", m.map(x => x.at), [1700000005000, 1700000004000, 1700000003000, 1700000002000, 1700000001000]);
  eq("the results", m.map(x => x.result), ["won", "lost", "drew", "lost", "won"]);
  eq("the endings", m.map(x => x.how), ["life", "forfeit", "stalemate", "concession", "life"]);
  eq("own hero first, the opponent's second (seat 0 and seat 1)", m.map(x => x.hero + ">" + x.foeHero), ["kayo>bravo", "rhinar>dash", "viserai>dorinthea", "katsu>bravo", "kayo>dash"]);
  eq("the opponent's name", m.map(x => x.foe), [null, "Bee Player", "Bee Player", "Bee Player", "Bee Player"]);
  const truth = n => { const x = w.rat.results.get("G" + n); return x.players[0] === "pa" ? x.a0 - x.b0 : x.a1 - x.b1; };
  eq("the rating move is the caller's own", m.map(x => x.change), [5, 4, 3, 2, 1].map(truth));
  if(!(m[4] && m[4].change > 0) || !(m[3] && m[3].change > 0 === false)) bad.push("a win must move up and a loss down: " + JSON.stringify(m.map(x => x.change)));
  eq("a game's keys", m[0] && Object.keys(m[0]).sort(), MINE_KEYS);
  const b = ask(w, B).mine || [];
  eq("Bee sees only Bee's four games, from Bee's own seat", b.map(x => x.result + ":" + x.hero), ["won:dash", "drew:dorinthea", "won:bravo", "lost:dash"]);
  eq("Bee's last game is the mirror of Aye's", b[0] && b[0].change, -(m[1] && m[1].change));
  const text = JSON.stringify(r);
  if(/"pa"|"pb"|"pc"|"G\d|TBL/.test(text)) bad.push("the answer holds a player id, a game id or a table code");
  return bad;
}
test("(1) THE CALLER'S OWN GAMES — newest first, from the caller's own seat, own hero first, the rating move signed, exactly the public fields", () => {
  assert.deepEqual(ownFailures(SERVER_, {mine: true}), []);
});
test("SABOTAGE (1): a backend that flips the move, or a referee that drops the list, is seen", () => {
  const flipped = probe(() => ownFailures(SERVER_, {mine: true, mineFlip: true}));
  assert.ok(flipped.length >= 1, "a flipped rating move must be seen");
  const dropped = probe(() => ownFailures(loadServer([["...(s.you && s.mine ? {mine: s.mine} : {})", ""]]), {mine: true}));
  assert.ok(dropped.length >= 1, "a referee that drops the list must be seen");
});

/* ---------------------------------------------------------------------------------------------- (2) */
function whoFailures(server, lo){
  const bad = [], {w, A, B, C} = seeded(server, lo), D = w.player("pd", "Dee Player");
  if(!Array.isArray(ask(w, D).mine) || ask(w, D).mine.length !== 0) bad.push("a named player with no games must get an empty list: " + JSON.stringify(ask(w, D).mine));
  if("mine" in ask(w, C)) bad.push("a nameless caller got a list");
  if("mine" in ask(w, null)) bad.push("a caller with no identity got a list");
  const stranger = {tok: "forged-token"};
  if("mine" in ask(w, stranger)) bad.push("a forged token got a list");
  if(!ask(w, A).mine) bad.push("a named player with games got no list");
  return bad;
}
test("(2) WHO GETS A LIST — a named caller (empty when no games); none for a nameless caller, no identity or a forged token", () => {
  assert.deepEqual(whoFailures(SERVER_, {mine: true}), []);
  const old = seeded(SERVER_, {}); assert.ok(!("mine" in ask(old.w, old.A)), "a backend that does not know 012 answers no list, and the ladder still answers");
  assert.ok(ask(old.w, old.A).ok && ask(old.w, old.A).you.name === "Aye Player");
});
test("SABOTAGE (2): a list for everyone is seen", () => {
  assert.ok(probe(() => whoFailures(SERVER_, {mine: true, mineForAll: true})).length >= 1, "a backend that lists for a nameless caller must be seen");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function contractFailures(server){
  const bad = [], {w, A} = seeded(server, {mine: true}), real = w.lad.ladder, good = real({player: "pa", floor: 3, limit: 50, recent: 10}).mine;
  const refused = (what, mine) => {
    w.deps.ladder = x => { const o = real(x); o.mine = mine; return o; };
    const r = ask(w, A);
    if(r.ok !== false || r.refused !== "internal" || "mine" in r) bad.push(what + " was not refused internal: " + JSON.stringify(r).slice(0, 120));
  };
  refused("eleven games", Array.from({length: 11}, () => ({...good[0]})));
  refused("a draw that says won", [{...good[2], result: "won"}]);
  refused("a win by stalemate", [{...good[0], how: "stalemate"}]);
  refused("a result nobody has heard of", [{...good[0], result: "tied"}]);
  refused("a move out of range", [{...good[0], change: 5000}]);
  refused("a list that is not a list", {0: good[0]});
  w.deps.ladder = x => { const o = real(x); o.mine = good.slice(0, 2); return o; };
  const ok = ask(w, A); if(!ok.ok || !ok.mine || ok.mine.length !== 2) bad.push("a good list was refused");
  return bad;
}
test("(3) THE BACKEND'S CONTRACT — more than ten games or a game that contradicts itself is refused internal, never shown", () => {
  assert.deepEqual(contractFailures(SERVER_), []);
});
test("SABOTAGE (3): a referee that trusts the list is seen", () => {
  for(const [what, edits] of [["no cap on the list", [["a.mine.length > LADDER_MINE", "false"]]], ["a draw that says won", [["(x.result === \"drew\") !== (x.how === \"stalemate\")", "false"]]], ["no move range", [["!intIn(x.change, -1000, 1000)", "false"]]],
      ["no result check", [["[\"won\", \"lost\", \"drew\"].indexOf(x.result) < 0", "false"]]]])
    assert.ok(probe(() => contractFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (4) */
async function phoneFailures(M){
  const bad = [], wd = makeWorld({seedKey: "mine-phone"}), idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp, {mine: true});
  wd.deps.identify = t => idp.identify(t); wd.deps.rename = (p, n, f) => idp.rename(p, n, f); Object.assign(wd.deps, rat.deps(), lad.deps());
  const pl = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, wd.server.nameFold(name)); return {tok, identity: {token: async () => tok}}; };
  const A = pl("pa", "Aye Player"), B = pl("pb", "Bee Player"), N = pl("pn", null);
  rat.record({game: "g1", table: "T1", players: ["pa", "pb"], names: ["Aye Player", "Bee Player"], heroes: ["kayo", "dash"], winner: 0, how: "life", turns: 5, build: null, started: 0, ended: 1700000000500});
  const T0 = wd.transport("M");
  const r = await M.ladder({transport: T0, identity: A.identity});
  const eq = (what, got, want) => { if(JSON.stringify(got) !== JSON.stringify(want)) bad.push(what + ": " + JSON.stringify(got) + ", wanted " + JSON.stringify(want)); };
  eq("Aye's game", r.mine, [{hero: "kayo", foeHero: "dash", foe: "Bee Player", result: "won", how: "life", change: r.mine && r.mine[0] && r.mine[0].change, at: 1700000000500}]);
  if(!(r.mine && r.mine[0] && r.mine[0].change > 0)) bad.push("the winner's move is not up");
  eq("Bee's game", (await M.ladder({transport: T0, identity: B.identity})).mine.map(x => x.result + ":" + x.hero + ">" + x.foeHero), ["lost:dash>kayo"]);
  if("mine" in (await M.ladder({transport: T0, identity: N.identity}))) bad.push("a nameless caller's answer carries a list");
  if("mine" in (await M.ladder({transport: T0}))) bad.push("a public call's answer carries a list");
  /* the phone's own filter, with the referee out of the way: a transport that answers a list with bad games in it */
  const g0 = r.mine[0], you = r.you;
  const raw = {post: async () => ({ok: true, floor: 3, cap: 50, ladder: [], recent: [], you: {...you, toGo: 0}, mine: [{...g0, result: "tied"}, {...g0, hero: 7}, {...g0, change: 1.5}, {...g0, foe: 3}, g0]})};
  const odd = await M.ladder({transport: raw, identity: A.identity}).catch(e => ({threw: e.why}));
  const noYou = await M.ladder({transport: {post: async () => ({ok: true, floor: 3, cap: 50, ladder: [], recent: [], mine: [g0]})}}).catch(e => ({threw: e.why}));
  if("mine" in noYou) bad.push("a list with no caller's line was passed on");
  if(odd.threw || !odd.mine) bad.push("a list with bad games was not answered"); else if(odd.mine.length !== 1) bad.push("malformed games were not dropped: " + odd.mine.length);
  return bad;
}
test("(4) THE PHONE'S CALL — ladder() carries the caller's games, and no `mine` for a nameless caller or a public call; a malformed game is dropped", async () => {
  assert.deepEqual(await phoneFailures(ST), []);
});
test("SABOTAGE (4): a phone that drops the list, keeps a malformed game or lists for everyone is seen", async () => {
  for(const [what, edits] of [["the list dropped", [["...(mine ? {mine} : {})", ""]]], ["no check of the result", [["OUTCOME.indexOf(x.result) >= 0", "true"]]], ["a list even without a line", [["Array.isArray(r.mine) && you ?", "Array.isArray(r.mine) ?"]]],
      ["no check of the hero", [["typeof x.hero === \"string\" && typeof x.foeHero", "typeof x.foeHero"]]]])
    assert.ok((await phoneFailures(loadST(edits)).catch(e => ["threw " + e.message])).length >= 1, "the sabotage must be seen: " + what);
});
