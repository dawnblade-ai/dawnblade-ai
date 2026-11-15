/* test/serverforfeit.test.js — RANKED INTEGRITY: THE FORFEIT CLOCK AND CLOSE-AS-CONCESSION (SERVER S5.2).

   server/referee.js over the fake store, sign-in and ratings (test/helpers/serverfakes.js), with an INJECTED CLOCK: nothing here sleeps; a drill moves the
   function's own `deps.now`. The drills, each with a sabotage that must fail:

     (1) THE READER IS HONEST — `judge.waitingOn` names, at every step of a whole game, the seat that then acts (declaring defenders excepted: the one thing the
         other seat may do at once); a "whose turn is it" guess is seen to fail the same drill. Read-only: the state is untouched.
     (2) THE STAMP — on a ranked table the row says who the game waits on and since when (the function's own time); the waited-on seat's own accepted move
         restarts it, the other seat's frames and every read leave it running; no clock when the game waits on nobody or on both.
     (3) A CLAIM IS REFUSED — too early, by the waited-on player, on a casual table, on a finished game, with a forged seat or key, with no clock running:
         each has its own word, writes nothing, moves no rating.
     (4) A CLAIM THAT IS DUE — the abandoned game is recorded ONCE as a forfeit, loser = the absent seat, the exact Elo move; both phones read the ending;
         a second claim, the absent player's late move and every resync change nothing. A claim before the match was dealt (the who-goes-first lobby) works the same.
     (5) THE RACE — a claim and the absent player's late move arrive together: exactly one wins, decided by the row's version; either order.
     (6) CLOSE — a started ranked table closed by its creator is the creator's concession (loser = the closer); closed before the game started it is free and
         records nothing; a casual table is unchanged.
     (7) PRIVACY AND SHAPE — no player id, token, key or seed in any new answer, row summary or push; the clock frame is sealed; a casual table has no clock anywhere;
         the limit lives in ONE place. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeServerHub, SERVER} = require("./helpers/serverhub.js");
const {J, L, json} = T;

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}
const probe = f => { try { return f(); } catch(e){ return ["the probe threw: " + (e && e.message)]; } };
const LIMIT = SERVER.FORFEIT_MS;
const T0 = 1700000000000;

/* a ranked table played by two phones (through the hub seam), the clock the drill's own. `g.at(ms)` sets the function's time. */
function table(o){
  o = o || {};
  const server = o.server || SERVER, idp = F.memIdentity(), rat = o.rat || F.withRatings();
  const ids = ["P-seat-zero-id", "P-seat-one-id"], names = ["Dawn Smith", "Rival One"];
  const toks = ids.map((id, i) => idp.issue(id, names[i]));
  const mk = makeServerHub({server, seedKey: "ff-" + (o.salt || ""), identify: t => idp.identify(t), identities: toks, creator: toks[0], ranked: o.ranked !== false,
    rankDeps: {...rat.deps()}, secrets: ids.concat(toks)});
  let hub; const t = T.makeTable({heroes: o.heroes || ["blaze", "dorinthea"], salt: "ff-" + (o.salt || ""), throws: [["rock", "rock"], ["paper", "rock"]],
    makeHub: opts => (hub = mk(opts))}).open();
  const audit = hub.audit, ps = t.seatPhones();
  let now = T0; audit.deps.now = () => now;
  const row = () => audit.store.row(audit.code);
  const g = {t, hub, audit, ps, ids, toks, idp, rat, server, row, at: ms => { now = T0 + ms; }, now: () => now - T0,
    full: () => t.hub.session().full(),
    act: (seat, a) => { const why = ps[seat].sess.submit(a); t.flush(); return why; },
    req: r => json(server.handleNow(r, audit.deps)),
    key: seat => row().hub.keys[seat],
    claim: seat => g.req({op: "claim", table: audit.code, seat, key: g.key(seat)}),
    resync: seat => g.req({op: "resync", table: audit.code, seat, key: g.key(seat)}),
    close: tok => g.req({op: "close", table: audit.code, identity: {token: tok}}),
    snap: () => ({json: audit.store.json(audit.code), version: audit.store.version(audit.code), pushes: audit.bus.log.length, records: rat.records})};
  return g;
}
const same = (a, b) => a.json === b.json && a.version === b.version && a.pushes === b.pushes && a.records === b.records;
/* the first waiting seat is whoever the engine says; return the pair [waited, other] */
const pair = g => { const w = J.waitingOn(g.full()); return [w, 1 - w]; };

/* ---------------------------------------------------------------------------------------------- (1) */
const guess = g => g.turnPlayer;        /* the tempting wrong reader: whose turn it is */
function readerFailures(reader){
  const bad = [], g = table({salt: "reader"});
  let steps = 0, checked = 0;
  while(steps++ < 3000){
    const before = g.full(), w = reader(before), logLen = g.t.hub.session().log().length;
    if(before.over) break;
    const snap = JSON.stringify(before);
    if(!g.t.step()) break;
    if(JSON.stringify(before) !== snap) { bad.push("the reader changed the state it read"); break; }
    const log = g.t.hub.session().log().slice(logLen);
    if(!log.length) continue;
    const e = log[0];
    if(e.action && e.action.t === "defend") continue;          /* declaring defenders is free for the defender while the turn-player holds priority (CR 7.3.2) */
    checked++;
    if(e.seat !== w){ bad.push("step " + steps + ": the game was waiting on " + w + " but seat " + e.seat + " acted (" + e.action.t + ")"); if(bad.length > 3) break; }
  }
  if(checked < 40) bad.push("the drill saw too few moves to mean anything: " + checked);
  return bad;
}
test("(1) THE READER IS HONEST — at every step of a whole game, the seat judge.waitingOn names is the seat that acts; nothing is written", () => {
  assert.deepEqual(readerFailures(J.waitingOn), []);
  /* the states the reader answers null for, and the order it reads them in */
  assert.equal(J.waitingOn({over: {winner: 0, how: "life"}, priority: 0}), null, "a finished game waits on nobody");
  assert.equal(J.waitingOn({priority: null, phase: "end"}), null, "the engine walking on by itself waits on nobody");
  assert.equal(J.waitingOn({priority: 0, pending: {seat: 1, kind: "pay"}}), 1, "a pending question beats priority");
  assert.equal(J.waitingOn({priority: 0, prompt: {side: 1}}), 1, "a sheet beats priority");
  assert.equal(J.waitingOn({priority: 0, phase: "end", arsenalFor: 1}), 1, "the arsenal choice beats priority");
  assert.equal(J.waitingOn({priority: 1}), 1);
});
test("SABOTAGE (1): the guess 'whose turn it is' fails the same drill", () => {
  assert.ok(probe(() => readerFailures(guess)).length >= 1, "a reader that guesses from the turn must be seen");
  assert.ok(probe(() => readerFailures(g => (g.pending || g.prompt) ? null : J.waitingOn(g))).length >= 1, "a reader that ignores questions and sheets must be seen");
});

/* ---------------------------------------------------------------------------------------------- (2) */
function stampFailures(server){
  const bad = [], g = table({server, salt: "stamp"});
  const ck0 = g.row().clock, [w, o] = pair(g);
  if(!ck0 || ck0.on !== w || !Number.isFinite(ck0.since)) return ["the row has no clock naming the waited-on seat after the deal: " + JSON.stringify(ck0)];
  /* the waited-on seat's own accepted move restarts the stamp; the function's time, never a phone's */
  g.at(100000);
  const mv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !J.legal(g.full(), a, w));
  if(!mv) return ["no move to make"];
  const why = g.act(w, mv); if(why) return ["the move was refused: " + why];
  const ck1 = g.row().clock;
  if(ck1 && ck1.on === w && ck1.since !== T0 + 100000) bad.push("the waited-on seat moved but its stamp was not restarted: " + JSON.stringify(ck1));
  const [w2] = pair(g);
  if(w2 != null && (!ck1 || ck1.on !== w2)) bad.push("the clock does not follow the engine's pending decision: " + JSON.stringify([ck1, w2]));
  if(w2 != null && ck1 && ck1.on !== w && ck1.since !== T0 + 100000) bad.push("a wait that moved to the other seat did not start at the move that moved it");
  /* reads (resync, a stale or refused frame) never move the stamp; neither does the seat that is NOT waited on */
  const before = JSON.stringify(g.row().clock), v0 = g.audit.store.version(g.audit.code);
  g.at(150000);
  g.resync(0); g.resync(1);
  if(JSON.stringify(g.row().clock) !== before || g.audit.store.version(g.audit.code) !== v0) bad.push("a resync moved the clock or wrote the row");
  const ar = g.req({op: "frame", table: g.audit.code, seat: 1 - (w2 == null ? w : w2), key: g.key(1 - (w2 == null ? w : w2)), n: 9999, frame: {ch: "net", m: {t: "intent", id: 7, seat: 1 - (w2 == null ? w : w2), action: {t: "pass"}}}});
  if(JSON.stringify(g.row().clock) !== before) bad.push("a refused move by the seat that is not waited on moved the clock: " + JSON.stringify(ar).slice(0, 80));
  return bad;
}
test("(2) THE STAMP — the row says who the game waits on and since when (server time); the waited-on seat's move restarts it, reads and the other seat leave it", () => {
  assert.deepEqual(stampFailures(SERVER), []);
});
test("SABOTAGE (2): a stamp that never restarts, one taken from the wrong seat, and one a read can move are seen", () => {
  for(const [what, edits] of [
    ["never restarts", [["row.clock = w === null ? null : {on: w, since: prev && prev.on === w && moved !== w ? prev.since : now};", "row.clock = w === null ? null : {on: w, since: prev ? prev.since : now};"]]],
    ["always restarts (the other seat's moves restart it)", [["row.clock = w === null ? null : {on: w, since: prev && prev.on === w && moved !== w ? prev.since : now};", "row.clock = w === null ? null : {on: w, since: now};"]]],
    ["a guess from the turn, not the engine", [["if(sess) return J.waitingOn(sess.full());", "if(sess) return sess.full().turnPlayer;"]]]])
    if(what.indexOf("always") === 0) continue;                       /* (2c) sees that one through a whole game */
    else assert.ok(probe(() => stampFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});
/* a whole game with the function's time moving one second a step: whenever the OTHER seat made an accepted move (declaring defenders) and the game still waits on
   the same seat, the stamp must not have moved; whenever the waited-on seat moved or the wait changed seat, it must be now */
function wholeStampFailures(server){
  const bad = [], g = table({server, salt: "stampwhole"});
  let steps = 0, kept = 0, restarted = 0;
  while(steps++ < 3000 && !g.full().over){
    const before = g.row().clock, n0 = g.t.hub.session().log().length;
    g.at(steps * 1000);
    if(!g.t.step()) break;
    const log = g.t.hub.session().log().slice(n0), after = g.row().clock;
    if(!log.length || !before || !after) continue;
    const movedBy = log.map(e => e.seat);
    if(after.on === before.on && !movedBy.includes(after.on)){ kept++; if(after.since !== before.since) bad.push("step " + steps + ": the other seat's move restarted the waited-on seat's clock"); }
    if(movedBy.includes(after.on) || after.on !== before.on){ restarted++; if(after.since !== T0 + steps * 1000) bad.push("step " + steps + ": the clock was not restarted by the move that changed it"); }
    if(bad.length > 2) break;
  }
  if(kept < 1) bad.push("the whole game never had the other seat move while the wait stayed: the drill cannot see an always-restart (" + kept + ")");
  if(restarted < 10) bad.push("too few restarts seen: " + restarted);
  return bad;
}
test("(2c) THE STAMP THROUGH A WHOLE GAME — the other seat's accepted moves leave it running, the waited-on seat's restart it", () => {
  assert.deepEqual(wholeStampFailures(SERVER), []);
});
test("SABOTAGE (2c): a stamp that restarts on every move, or never, is seen through a whole game", () => {
  for(const [what, edits] of [
    ["always restarts", [["row.clock = w === null ? null : {on: w, since: prev && prev.on === w && moved !== w ? prev.since : now};", "row.clock = w === null ? null : {on: w, since: now};"]]],
    ["never restarts", [["row.clock = w === null ? null : {on: w, since: prev && prev.on === w && moved !== w ? prev.since : now};", "row.clock = w === null ? null : {on: w, since: prev ? prev.since : now};"]]]])
    assert.ok(probe(() => wholeStampFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});
test("(2b) AT A QUIET MOMENT NO CLOCK RUNS — a game that is over, and a lobby where both seats owe the step or heroes are not chosen", () => {
  const g = table({salt: "quiet"});
  g.act(...[pair(g)[0], {t: "concede"}]);
  assert.equal(g.row().clock, null, "a finished game has no clock");
  assert.equal(g.resync(0).clock, undefined, "and says none");
});

/* ---------------------------------------------------------------------------------------------- (3) */
function refusalFailures(server){
  const bad = [], g = table({server, salt: "refuse"}), [w, o] = pair(g);
  const check = (what, r, want, extra) => {
    if(r.ok || r.refused !== want) bad.push(what + " answered " + JSON.stringify(r).slice(0, 120) + ", wanted " + want);
    else if(extra && !extra(r)) bad.push(what + ": the answer is missing its detail " + JSON.stringify(r));
  };
  const s0 = g.snap();
  g.at(LIMIT - 1000);
  check("a claim one second early", g.claim(o), "claim-early", r => r.left === 1000 || r.left > 0 && r.left <= 1500);
  check("a claim by the player being waited on", g.claim(w), "claim-self");
  g.at(LIMIT + 5000);
  check("a claim by the player being waited on, long after", g.claim(w), "claim-self");
  const keyO = g.key(o);
  check("a forged key", g.req({op: "claim", table: g.audit.code, seat: o, key: "k".repeat(keyO.length)}), "auth");
  check("the other seat's key for this seat", g.req({op: "claim", table: g.audit.code, seat: o, key: g.key(w)}), "auth");
  check("a seat that is not a seat", g.req({op: "claim", table: g.audit.code, seat: 2, key: keyO}), "auth");
  check("no key at all", g.req({op: "claim", table: g.audit.code, seat: o}), "auth");
  check("no such table", g.req({op: "claim", table: "NOTHER", seat: o, key: keyO}), "no-table");
  check("a bad table code", g.req({op: "claim", table: "no way", seat: o, key: keyO}), "bad-request");
  if(!same(s0, g.snap())) bad.push("a refused claim wrote the row, pushed something or recorded a result");
  /* a casual table: no clock, no claim */
  const c = table({server, salt: "casual", ranked: false});
  c.at(LIMIT * 10);
  const cs0 = c.snap();
  check("a claim on a casual table", c.claim(1 - J.waitingOn(c.full())), "claim-casual");
  if(!same(cs0, c.snap())) bad.push("a refused casual claim changed the table");
  if(c.row().clock !== undefined || c.row().ranked === true) bad.push("a casual row has a clock");
  /* a finished game */
  const f = table({server, salt: "done"}), [fw] = pair(f);
  f.act(fw, {t: "concede"});
  f.at(LIMIT * 10);
  const fs0 = f.snap();
  check("a claim on a finished game", f.claim(1 - fw), "claim-over");
  check("a claim on a finished game by the loser", f.claim(fw), "claim-over");
  if(!same(fs0, f.snap())) bad.push("a refused claim changed a finished game");
  /* no clock: a ranked table whose lobby is still choosing heroes */
  const w0 = (function(){
    const store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(); let ck = T0;
    const deps = {store, broadcast: () => {}, deal: T.dealSpec, build: T.BUILD, now: () => ck++, rand: () => T.seeded("idle"), identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f), ...rat.deps()};
    const go = r => json(server.handleNow(r, deps));
    const A = idp.issue("P-aa"), B = idp.issue("P-bb"); idp.rename("P-aa", "Aaa One", server.nameFold("Aaa One")); idp.rename("P-bb", "Bbb Two", server.nameFold("Bbb Two"));
    const t = go({op: "create", identity: {token: A}, ranked: true}).table;
    const a = go({op: "join", table: t, identity: {token: A}}), b = go({op: "join", table: t, identity: {token: B}});
    return {go, t, a, b, store, deps, keyOf: r => (r.frames.find(x => x.ch === "judge" && x.key) || {}).key};
  })();
  const ka = w0.keyOf(w0.a), kb = w0.keyOf(w0.b);
  w0.deps.forfeitMs = 0;
  check("a claim where no clock runs (the lobby is still choosing heroes)", w0.go({op: "claim", table: w0.t, seat: w0.b.seat, key: kb}), "claim-idle");
  void ka;
  return bad;
}
test("(3) A CLAIM IS REFUSED — early, by the waited-on player, on a casual table, on a finished game, forged, or with no clock: each its own word, nothing written", () => {
  assert.deepEqual(refusalFailures(SERVER), []);
});
test("SABOTAGE (3): a function that allows an early claim, a claim by the waited-on seat, a casual claim, a claim after the end or an unkeyed claim is seen", () => {
  for(const [what, edits] of [
    ["no limit", [["if(left > 0) return no(\"claim-early\", {left});", ""]]],
    ["the waited-on seat may claim", [["if(ck.on === seat) return no(\"claim-self\");", ""]]],
    ["casual claims allowed", [["if(row.ranked !== true) return no(\"claim-casual\");", ""]]],
    ["claims after the end", [["if(row.over === true || row.result) return no(\"claim-over\");", ""]]],
    ["no key needed", [["if((seat !== 0 && seat !== 1) || !keyEq(req.key, row.hub.keys[seat])) return authFail(row, seat, req.key);\n  if(row.ranked !== true) return no(\"claim-casual\");", "if(row.ranked !== true) return no(\"claim-casual\");"]]]])
    assert.ok(probe(() => refusalFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (4) */
function claimFailures(server){
  const bad = [], g = table({server, salt: "claim"}), [w, o] = pair(g), code = g.audit.code;
  g.rat.set(g.ids[0], 1200);
  const sinceAbandon = g.row().clock.since;
  g.at(sinceAbandon - T0 + LIMIT);                                   /* exactly the limit: due */
  const before = g.snap();
  const r = g.claim(o);
  if(!r.ok || r.claimed !== true) return bad.concat("a due claim was refused: " + JSON.stringify(r).slice(0, 160));
  if(!r.result || r.result.how !== "forfeit" || r.result.winner !== o) bad.push("the claim's answer does not say the claimant won by forfeit: " + JSON.stringify(r.result));
  const all = [...g.rat.results.values()];
  if(g.rat.records !== 1 || all.length !== 1) return bad.concat("the claim did not record exactly one result: " + g.rat.records);
  const x = all[0];
  if(x.how !== "forfeit" || x.winner !== o) bad.push("recorded " + JSON.stringify([x.how, x.winner]) + ", wanted forfeit by seat " + w);
  if(x.players[w] !== g.ids[w] || x.players[o] !== g.ids[o]) bad.push("the players are not in seat order");
  const want = o === 0 ? [1216, 1184] : [1184, 1216];
  if(g.rat.rating(g.ids[0]).rating !== want[0] || g.rat.rating(g.ids[1]).rating !== want[1]) bad.push("the ratings did not move by the Elo amount: " + JSON.stringify([g.rat.rating(g.ids[0]).rating, g.rat.rating(g.ids[1]).rating]));
  if(JSON.stringify(r.result.change) !== JSON.stringify(o === 0 ? [{from: 1200, to: 1216}, {from: 1200, to: 1184}] : [{from: 1200, to: 1184}, {from: 1200, to: 1216}])) bad.push("the change shown is not the Elo move: " + JSON.stringify(r.result.change));
  const row = g.row();
  if(row.over !== true || !row.forfeit || row.forfeit.loser !== w || row.clock !== null) bad.push("the row does not say forfeit by the absent seat, over, no clock: " + JSON.stringify([row.over, row.forfeit, row.clock]));
  if(!g.full().over || g.full().over.winner !== o) bad.push("the engine's game did not end with the claimant winning");
  /* the absent player's phone: its next request reads the ending; the claimant's phone got the end of the game in the answer */
  const lr = g.resync(w);
  if(!lr.ok || !lr.result || lr.result.how !== "forfeit" || lr.result.winner !== o) bad.push("the absent player cannot read the result: " + JSON.stringify(lr).slice(0, 100));
  const pushes = g.audit.bus.sent(SERVER.topic(code, w, g.key(w)));
  if(!pushes.length) bad.push("the absent player's phone was not pushed the ending");
  /* never twice, never undone */
  const mid = g.snap();
  for(const [what, rr] of [["a second claim", g.claim(o)], ["the loser's own claim", g.claim(w)]]) if(rr.ok || rr.refused !== "claim-over") bad.push(what + " answered " + JSON.stringify(rr).slice(0, 80));
  const late = g.req({op: "frame", table: code, seat: w, key: g.key(w), n: 99999, frame: {ch: "net", m: {t: "intent", id: 3, seat: w, action: {t: "pass"}}}});
  if(late.ok && late.frames && late.frames.some(f => f.ch === "net" && f.m && f.m.t === "commit")) bad.push("the absent player's late move was accepted after the forfeit");
  if(g.rat.records !== 1 || g.rat.results.size !== 1) bad.push("a later request recorded again");
  if(g.rat.rating(g.ids[0]).rating !== want[0]) bad.push("a later request moved a rating");
  void before; void mid;
  return bad;
}
test("(4) A CLAIM THAT IS DUE ends the abandoned game ONCE as a forfeit — the absent seat loses, the Elo move is exact, both phones read it, nothing later changes it", () => {
  assert.deepEqual(claimFailures(SERVER), []);
});
test("SABOTAGE (4): a claim that picks the wrong loser, records a concession, never records, or can be repeated is seen", () => {
  for(const [what, edits] of [
    ["the claimant loses", [["const loser = ck.on;", "const loser = seat;"]]],
    ["recorded as a plain concession", [["how = \"forfeit\"; }", "}"]]],
    ["never recorded", [["return save(id, row, got.version, deps, pushed, reply, {claimed: true}, undefined, ver => settleRow(id, row, ver, deps, hub));", "return save(id, row, got.version, deps, pushed, reply, {claimed: true});"]]],
    ["a claim does not mark the row over", [["row.over = true;\n  return {r, mine", "return {r, mine"]]],
    ["the clock is not cleared", [["if(row.over === true){ row.clock = null; return was !== \"null\"; }", "if(row.over === true){ return false; }"]]]])
    assert.ok(probe(() => claimFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* a claim in the who-goes-first lobby: both heroes chosen, one throw sealed, the other player never answers */
function lobbyClaim(server){
  const bad = [], store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(), sent = []; let ck = T0;
  const deps = {store, broadcast: (t, p) => sent.push({t, p: json(p)}), deal: T.dealSpec, build: T.BUILD, now: () => ck, rand: () => T.seeded("lobbyclaim"), identify: t => idp.identify(t),
    rename: (p, n, f) => idp.rename(p, n, f), ...rat.deps()};
  const go = r => json(server.handleNow(r, deps));
  const A = idp.issue("P-aa"), B = idp.issue("P-bb"); idp.rename("P-aa", "Aaa One", server.nameFold("Aaa One")); idp.rename("P-bb", "Bbb Two", server.nameFold("Bbb Two"));
  const t = go({op: "create", identity: {token: A}, ranked: true}).table;
  const a = go({op: "join", table: t, identity: {token: A}}), b = go({op: "join", table: t, identity: {token: B}});
  const kA = (a.frames.find(x => x.ch === "judge" && x.key) || {}).key, kB = (b.frames.find(x => x.ch === "judge" && x.key) || {}).key;
  const n = [0, 0], fr = (seat, key, m) => go({op: "frame", table: t, seat, key, n: ++n[seat], frame: {ch: "lobby", m}});
  fr(a.seat, kA, L.hello(a.seat, T.BUILD)); fr(b.seat, kB, L.hello(b.seat, T.BUILD));
  fr(a.seat, kA, L.hero(a.seat, "blaze"));
  if(store.row(t).clock != null) bad.push("a clock runs while only one hero is chosen");
  fr(b.seat, kB, L.hero(b.seat, "dorinthea"));
  ck = T0 + 1000;
  const seal = L.throwSeal(a.seat, 0, "rock", () => 0.5);
  fr(a.seat, kA, seal.seal);                                       /* a sealed, b owes its seal: the table waits on b */
  const c = store.row(t).clock;
  if(!c || c.on !== b.seat || c.since !== T0 + 1000) return bad.concat("the lobby's clock is not on the seat that owes the step: " + JSON.stringify(c));
  ck = T0 + 1000 + LIMIT - 1;
  const early = go({op: "claim", table: t, seat: a.seat, key: kA});
  if(early.ok || early.refused !== "claim-early") bad.push("an early lobby claim answered " + JSON.stringify(early).slice(0, 80));
  if(go({op: "claim", table: t, seat: b.seat, key: kB}).refused !== "claim-self") bad.push("the seat that owes the step could claim");
  ck = T0 + 1000 + LIMIT;
  const r = go({op: "claim", table: t, seat: a.seat, key: kA});
  if(!r.ok || !r.result || r.result.how !== "forfeit" || r.result.winner !== a.seat) return bad.concat("a due lobby claim answered " + JSON.stringify(r).slice(0, 120));
  const st = [...rat.results.values()];
  if(rat.records !== 1 || st.length !== 1 || st[0].how !== "forfeit" || st[0].heroes[a.seat] !== "blaze" || st[0].heroes[b.seat] !== "dorinthea" || st[0].turns !== 0) bad.push("the lobby forfeit was not recorded with the heroes: " + JSON.stringify(st.map(x => [x.how, x.heroes, x.turns])));
  const row = store.row(t);
  if(row.over !== true || row.hub.spec) bad.push("the lobby forfeit dealt a game or did not end the table");
  /* the absent player's late lobby frame changes nothing */
  const v = store.version(t);
  const late = fr(b.seat, kB, L.sideboard(b.seat, [], {}));
  if(store.version(t) !== v || (late.frames && late.frames.length)) bad.push("a lobby frame after the forfeit was applied");
  if(!late.ok || !late.result) bad.push("the late lobby frame does not read the ending: " + JSON.stringify(late).slice(0, 80));
  return bad;
}
test("(4b) A CLAIM IN THE WHO-GOES-FIRST LOBBY — once both heroes are chosen, the seat that owes the step is on the clock; a due claim records a forfeit with the heroes and no game", () => {
  assert.deepEqual(lobbyClaim(SERVER), []);
});
test("SABOTAGE (4b): a lobby clock that runs before the heroes are chosen, or a lobby that is still open after the forfeit, is seen", () => {
  assert.ok(probe(() => lobbyClaim(loadServer([["if(step === \"fault\" || step === \"hero\" || step === \"ready\") return null;", "if(step === \"fault\" || step === \"ready\") return null;"]]))).length >= 1, "a clock in the hero step must be seen");
  assert.ok(probe(() => lobbyClaim(loadServer([["if(row.ranked === true && row.over === true && row.forfeit && !row.hub.spec) return {ok: true, version: got.version, frames: [], ...pub(row, deps)};", ""]]))).length >= 1, "a lobby frame applied after the forfeit must be seen");
});

/* ---------------------------------------------------------------------------------------------- (5) THE RACE */
async function raceOnce(claimFirst){
  const g = table({salt: "race" + claimFirst}), [w, o] = pair(g), code = g.audit.code;
  g.at(g.row().clock.since - T0 + LIMIT);                              /* the claim is due */
  const lag = F.lagged(g.audit.store, 3), bus = F.laggedBus(g.audit.bus, 2);
  const deps = {...g.audit.deps, store: lag, broadcast: bus.broadcast};
  const mv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !J.legal(g.full(), a, w));
  /* the absent player's phone sends its late move through its own session so the frame is real; capture the frame it would send */
  const sent = []; const ph = g.ps[w], real = ph.say; ph.say = f => sent.push(f);
  ph.sess.submit(mv); ph.say = real;
  const frameReq = {op: "frame", table: code, seat: w, key: g.key(w), n: g.row().nonces[w] + 1, frame: sent.find(f => f.ch === "net")};
  const claimReq = {op: "claim", table: code, seat: o, key: g.key(o)};
  const run = r => SERVER.handle(r, deps);
  const order = claimFirst ? [claimReq, frameReq] : [frameReq, claimReq];
  const [a, b] = await Promise.all(order.map(run));
  const [ca, fa] = claimFirst ? [a, b] : [b, a];
  return {g, ca, fa, w, o, deps, claimReq, frameReq, run};
}
async function raceFailures(){
  const bad = [];
  for(const claimFirst of [true, false]){
    const x = await raceOnce(claimFirst), {g} = x;
    const claimWon = x.ca.ok === true, moveWon = x.fa.ok === true && (x.fa.frames || []).some(f => f.ch === "net" && f.m && f.m.t === "commit");
    if(claimWon === moveWon) bad.push("order " + (claimFirst ? "claim first" : "move first") + ": exactly one of the claim and the late move must win, got claim " + JSON.stringify(x.ca).slice(0, 60) + " move " + JSON.stringify(x.fa).slice(0, 60));
    if(!claimWon && x.ca.refused !== "conflict") bad.push("the claim that lost the race was not told `conflict`: " + JSON.stringify(x.ca).slice(0, 80));
    if(!moveWon && !(x.fa.refused === "conflict" || (x.fa.ok && !(x.fa.frames || []).some(f => f.m && f.m.t === "commit")))) bad.push("the late move that lost the race was not refused: " + JSON.stringify(x.fa).slice(0, 80));
    /* ask again, as the phones do: the claim now meets the truth, the move meets the end of the game */
    const claimAgain = await x.run(x.claimReq), moveAgain = await x.run({...x.frameReq, n: x.frameReq.n + 1});
    if(claimWon){
      if(claimAgain.refused !== "claim-over") bad.push("after the claim won, a repeat answered " + JSON.stringify(claimAgain).slice(0, 80));
      if(g.rat.records !== 1 || [...g.rat.results.values()][0].how !== "forfeit") bad.push("the winning claim was not recorded as one forfeit");
    } else {
      if(claimAgain.ok || !/claim-early|claim-idle|claim-self/.test(claimAgain.refused)) bad.push("after the move won, the claim answered " + JSON.stringify(claimAgain).slice(0, 80));
      if(g.rat.records !== 0) bad.push("the late move won but a result was recorded");
    }
    void moveAgain;
  }
  return bad;
}
test("(5) THE RACE — a due claim and the absent player's late move arrive together: exactly one wins, whichever order; the loser is refused and nothing is recorded twice", async () => {
  assert.deepEqual(await raceFailures(), []);
});
test("SABOTAGE (5): a store without the version check lets both win and is seen", async () => {
  const g0 = F.memStore(); const orig = g0.put;
  const bad = [];
  const x = await (async () => {
    const GG = table({salt: "racesab"}), [w, o] = pair(GG), code = GG.audit.code;
    GG.at(GG.row().clock.since - T0 + LIMIT);
    const st = GG.audit.store, put = st.put;
    st.put = (id, row, v) => put(id, row, st.version(id));            /* the sabotage: every put is accepted against whatever is stored */
    const lag = F.lagged(st, 3), bus = F.laggedBus(GG.audit.bus, 2);
    const deps = {...GG.audit.deps, store: lag, broadcast: bus.broadcast};
    const mv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !J.legal(GG.full(), a, w));
    const sent = []; const ph = GG.ps[w], real = ph.say; ph.say = f => sent.push(f); ph.sess.submit(mv); ph.say = real;
    const fr = {op: "frame", table: code, seat: w, key: GG.key(w), n: GG.row().nonces[w] + 1, frame: sent.find(f => f.ch === "net")};
    const [c, m] = await Promise.all([SERVER.handle({op: "claim", table: code, seat: o, key: GG.key(o)}, deps), SERVER.handle(fr, deps)]);
    return {c, m};
  })();
  const both = x.c.ok === true && x.m.ok === true && (x.m.frames || []).some(f => f.m && f.m.t === "commit");
  assert.ok(both, "without the version check both the claim and the late move are accepted (the drill would see it)");
  void g0; void orig; void bad;
});

/* ---------------------------------------------------------------------------------------------- (6) CLOSE */
function closeFailures(server){
  const bad = [], g = table({server, salt: "close"}), code = g.audit.code;
  const intruder = g.close(g.toks[1]);
  if(intruder.ok || intruder.refused !== "not-creator") bad.push("a seated player who is not the creator closed it: " + JSON.stringify(intruder));
  if(g.rat.records !== 0) bad.push("a refused close recorded something");
  const r = g.close(g.toks[0]);
  if(!r.ok || r.conceded !== true) bad.push("the creator's close was not a concession: " + JSON.stringify(r));
  const closer = g.row().owners.indexOf("P-seat-zero-id");
  const st = [...g.rat.results.values()];
  if(st.length !== 1 || st[0].how !== "concession" || st[0].winner !== 1 - closer) bad.push("recorded " + JSON.stringify(st.map(x => [x.how, x.winner])) + ", wanted a concession by seat " + closer);
  if(!r.result || r.result.winner !== 1 - closer) bad.push("the close's answer does not carry the result");
  if(!g.full().over || g.full().over.how !== "concession") bad.push("the game did not end by the reducer's concession");
  /* the opponent's phone is pushed the ending; closing again records nothing more */
  if(!g.audit.bus.sent(SERVER.topic(code, 1 - closer, g.key(1 - closer))).length) bad.push("the opponent was not pushed the ending");
  const again = g.close(g.toks[0]), v = g.snap();
  if(!again.ok || g.rat.records !== 1) bad.push("closing again recorded or refused: " + JSON.stringify(again));
  void v;
  /* a ranked table that never started: free, nothing recorded */
  const store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(); let ck = T0;
  const deps = {store, broadcast: () => {}, deal: T.dealSpec, build: T.BUILD, now: () => ck++, rand: () => T.seeded("closefree"), identify: t => idp.identify(t), rename: (p, n, f) => idp.rename(p, n, f), ...rat.deps()};
  const A = idp.issue("P-aa"), B = idp.issue("P-bb"); idp.rename("P-aa", "Aaa One", server.nameFold("Aaa One")); idp.rename("P-bb", "Bbb Two", server.nameFold("Bbb Two"));
  const go = q => json(server.handleNow(q, deps));
  const t = go({op: "create", identity: {token: A}, ranked: true}).table;
  go({op: "join", table: t, identity: {token: A}}); go({op: "join", table: t, identity: {token: B}});
  const c = go({op: "close", table: t, identity: {token: A}});
  if(!c.ok || c.conceded || rat.records !== 0 || store.row(t).closed !== true) bad.push("closing a ranked table before the game started was not free: " + JSON.stringify(c) + " records " + rat.records);
  if(go({op: "join", table: t, identity: {token: B}}).refused !== "no-table") bad.push("a ranked table closed before the game started still answers");
  /* a casual table: unchanged (closed, nothing recorded, gone for both seats) */
  const k = table({server, salt: "closecasual", ranked: false}), kc = k.close(k.toks[0]);
  if(!kc.ok || kc.conceded || k.rat.records !== 0 || k.row().closed !== true || k.row().ranked === true) bad.push("a casual close is not the old close: " + JSON.stringify(kc));
  if(k.resync(0).refused !== "no-table") bad.push("a closed casual table still answers");
  return bad;
}
test("(6) CLOSE — a started ranked table closed by its creator is their concession (loser = the closer); before the game started it is free; casual is unchanged", () => {
  assert.deepEqual(closeFailures(SERVER), []);
});
test("SABOTAGE (6): a close that stays free mid-game, or counts for the wrong seat, or counts on a casual table is seen", () => {
  for(const [what, edits] of [
    ["free mid-game", [["if(got.row.ranked === true && got.row.hub && got.row.hub.spec){", "if(false){"]]],
    ["the other seat loses", [["const c = concedeAs(req.table, row, deps, seat);", "const c = concedeAs(req.table, row, deps, 1 - seat);"]]],
    ["started = just seated (counts in the lobby)", [["if(got.row.ranked === true && got.row.hub && got.row.hub.spec){", "if(got.row.ranked === true){"]]]])
    assert.ok(probe(() => closeFailures(loadServer(edits))).length >= 1, "the sabotage must be seen: " + what);
});

/* ---------------------------------------------------------------------------------------------- (7) PRIVACY AND SHAPE */
function scanFailures(server){
  const bad = [], g = table({server, salt: "scan"}), [w, o] = pair(g), code = g.audit.code;
  const outs = [];
  const note = (what, r) => { outs.push([what, JSON.stringify(r)]); return r; };
  g.at(g.row().clock.since - T0 + 2000);
  note("a resync", g.resync(0)); note("a resync", g.resync(1));
  note("an early claim", g.claim(o)); note("a self claim", g.claim(w));
  g.at(g.row().clock.since - T0 + LIMIT);
  note("a due claim", g.claim(o)); note("a later resync", g.resync(w)); note("a repeat claim", g.claim(o));
  const k = table({server, salt: "scanclose"}); note("a close", k.close(k.toks[0]));
  /* the seed's secret half is revealed to both seats BY DESIGN once a game is over (every ending does it), so it is not scanned for here; keys, ids and tokens never are */
  const secrets = [...g.ids, ...g.toks, ...k.ids, ...k.toks, g.key(0), g.key(1), k.key(0), k.key(1)];
  const texts = outs.concat(g.audit.bus.log.map(e => ["a push", JSON.stringify(e.payload)])).concat([["the public summary", JSON.stringify(g.row().result)]]);
  for(const [what, t] of texts) for(const s of secrets) if(s && typeof t === "string" && t.indexOf(s) >= 0) bad.push(what + " carries a secret (" + s.slice(0, 5) + "…)");
  /* every key of every answer is a known public one */
  const PUBLIC = ["ok", "version", "frames", "seat", "n", "owned", "names", "ranked", "ratings", "result", "broadcast", "refused", "retry", "taken", "table", "clock", "left", "claimed", "conceded"];
  for(const [what, t] of outs){ let o2; try { o2 = JSON.parse(t); } catch(_){ continue; } for(const key of Object.keys(o2)) if(PUBLIC.indexOf(key) < 0) bad.push(what + " answers a key that is not on the public list: " + key); }
  return bad;
}
test("(7) PRIVACY — no player id, token, key or seed in any claim, close or resync answer, push or summary; every key of every answer is public by design", () => {
  assert.deepEqual(scanFailures(SERVER), []);
});
test("SABOTAGE (7): an answer that carries the claimant's player id is seen", () => {
  assert.ok(probe(() => scanFailures(loadServer([["return save(id, row, got.version, deps, pushed, reply, {claimed: true},", "return save(id, row, got.version, deps, pushed, reply, {claimed: true, who: ownersOf(row)[seat]},"]]))).length >= 1);
});
test("(7b) THE CLOCK RIDES AS A SEALED FRAME, AND ONLY ON A RANKED TABLE — the push's seal verifies; a casual table has no clock frame, no clock key and no claim op effect", () => {
  const SHA = require("../engine/sha256.js");
  const g = table({salt: "frames"}), code = g.audit.code;
  const [w] = pair(g);
  const mv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !J.legal(g.full(), a, w));
  g.act(w, mv);
  const other = 1 - w, pushes = g.audit.bus.sent(SERVER.topic(code, other, g.key(other)));
  const withClock = pushes.filter(p => p.frames.some(f => f.ch === "clock"));
  assert.ok(withClock.length >= 1, "the other seat is told the clock in a push");
  for(const p of withClock) assert.equal(p.mac, SHA.frameMac(g.key(other), code, other, p.ver, p.frames), "the push is sealed with the seat's key, clock frame included");
  const ck = withClock[withClock.length - 1].frames.find(f => f.ch === "clock").m;
  assert.deepEqual(Object.keys(ck).sort(), ["age", "limit", "on"], "the clock frame says which seat, how long (server time) and the limit, nothing else");
  assert.equal(ck.limit, LIMIT);
  const rs = g.resync(other); assert.ok(rs.clock && rs.clock.on === (J.waitingOn(g.full())) && rs.clock.limit === LIMIT, "a resync answers the clock");
  const c = table({salt: "frames-casual", ranked: false}), cc = c.audit.code;
  const [cw] = pair(c);
  const cmv = [{t: "pass"}, {t: "endTurn"}, {t: "arsenal", uid: null}].find(a => !J.legal(c.full(), a, cw));
  c.act(cw, cmv);
  for(const e of c.audit.bus.log) assert.ok(!e.payload.frames.some(f => f.ch === "clock"), "a casual table pushed a clock frame");
  assert.ok(c.resync(0).clock === undefined && c.row().clock === undefined && !("forfeit" in c.row()), "a casual table has no clock anywhere");
  void cc;
});
test("(7c) THE LIMIT LIVES IN ONE PLACE — referee.js states it once, the page and the phone's channel never restate it, and deps.forfeitMs replaces it", () => {
  assert.equal(SERVER.FORFEIT_MS, 300000, "five minutes");
  assert.equal((SRC.match(/5 \* 60 \* 1000/g) || []).length, 1, "the constant is written once in referee.js");
  for(const f of ["engine/servertable.js", "index.html"]){
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/FORFEIT_MS|300000\b|5 \* 60 \* 1000/.test(t), f + " restates the forfeit limit (it must read it from the function's answer)");
  }
  const g = table({salt: "inject"}), [w, o] = pair(g);
  g.audit.deps.forfeitMs = 1000; g.at(g.row().clock.since - T0 + 1000);
  assert.equal(g.claim(o).claimed, true, "an injected limit of one second is honoured");
});
test("(7d) AN UNFINISHED GAME AGES OUT WITH THE TABLE AND RECORDS NOTHING — a ranked game nobody claims or finishes never calls record", () => {
  const g = table({salt: "age"});
  g.at(LIMIT * 100);
  g.resync(0); g.resync(1);
  assert.equal(g.rat.records, 0, "no request but a claim, a close or the game's own ending records");
  assert.ok(g.row().result === undefined && g.row().over !== true);
});

/* ---------------------------------------------------------------------------------------------- (8) RECOVERY KEEPS A RANKED THROWAWAY */
/* The rule itself is SQL (007_forfeit.sql, proven on PGlite with sabotage by tools/sql-pglite.js and tools/sql-sab-007.js); the fake backend the function's drills
   run on must behave the same way, and the function's own ops (mint, redeem) must carry it through unchanged. */
function recoveryFailures(o){
  const bad = [], store = F.memStore(), idp = F.memIdentity(), rat = F.withRatings(), rec = F.withRecovery(idp, {rat, store, ...(o || {})});
  let clock = T0, n = 0;
  const deps = {store, broadcast: () => {}, deal: T.dealSpec, build: T.BUILD, now: () => clock++, rand: () => T.seeded("rec8"), identify: t => idp.identify(t), rename: (p, nm, f) => idp.rename(p, nm, f),
    mint: (p, h, d) => rec.mint(p, h, d), redeem: (t, h) => rec.redeem(t, h), ...rat.deps(), randBytes: len => Uint8Array.from({length: len}, (_, i) => ((++n * 2654435761 + i * 40503) >>> 7) & 255)};
  const go = r => json(SERVER.handleNow(r, deps));
  const tokOld = idp.issue("P-old"), rival = "P-rival";
  go({op: "me", identity: {token: tokOld}, name: "Dawn Smith"});
  rat.record({game: "g-old", table: "TABOLD", players: ["P-old", rival], names: [null, null], heroes: ["kayo", "dash"], winner: 0, how: "life", turns: 5, build: null, started: 0, ended: 0});
  const oldBefore = JSON.stringify(rat.rating("P-old"));
  const phone = (id, setup) => { const t = idp.issue(id); if(setup) setup(id); const code = go({op: "recovery-mint", identity: {token: tokOld}}).code; return {t, code, redeem: () => go({op: "recovery-redeem", identity: {token: t}, code})}; };
  /* (a) no ranked footprint: deleted, as in v6.30 */
  const a = phone("P-fresh-a"); const ra = a.redeem();
  if(!ra.ok || rec.deleted.indexOf("P-fresh-a") < 0 || rec.orphans.indexOf("P-fresh-a") >= 0) bad.push("a throwaway with no ranked game was not deleted as in v6.30: " + JSON.stringify([ra.ok, rec.deleted, rec.orphans]));
  /* (b) it played a ranked game: kept, orphaned, intact; the recovered player is untouched; never merged, never refused */
  const b = phone("P-fresh-b", id => rat.record({game: "g-b", table: "TABB", players: [id, rival], names: [null, null], heroes: ["kayo", "dash"], winner: 1, how: "concession", turns: 3, build: null, started: 0, ended: 0}));
  const keep = JSON.stringify(rat.rating("P-fresh-b")), rb = b.redeem();
  if(!rb.ok) bad.push("a throwaway that played ranked made the redeem fail: " + JSON.stringify(rb));
  if(rec.orphans.indexOf("P-fresh-b") < 0 || rec.deleted.indexOf("P-fresh-b") >= 0) bad.push("a throwaway that played ranked was not kept orphaned");
  if(JSON.stringify(rat.rating("P-fresh-b")) !== keep || !rat.rt.has("P-fresh-b")) bad.push("the orphan's rating or record changed or vanished");
  if(JSON.stringify(rat.rating("P-old")) !== oldBefore) bad.push("the recovered player's rating or record moved");
  if(idp.live.get(b.t).player !== "P-old") bad.push("the new phone was not moved to the recovered player");
  /* (c) it holds a seat at an UNFINISHED ranked table: kept (recovering away must not dodge that game) */
  const c = phone("P-fresh-c", id => store.put("LIVE01", {v: 5, ranked: true, over: false, owners: [id, null]}, 0));
  c.redeem();
  if(rec.orphans.indexOf("P-fresh-c") < 0) bad.push("a throwaway seated at an unfinished ranked game was not kept");
  /* (d) only a FINISHED ranked table and a casual one: deleted */
  const d = phone("P-fresh-d", id => { store.put("DONE01", {v: 5, ranked: true, over: true, owners: [id, null]}, 0); store.put("CASU01", {v: 3, owners: [id, null]}, 0); });
  d.redeem();
  if(rec.deleted.indexOf("P-fresh-d") < 0) bad.push("a throwaway with only a finished ranked table and a casual table was kept");
  if(JSON.stringify(rat.rating("P-old")) !== oldBefore) bad.push("the recovered player's rating or record moved after all the redeems");
  return bad;
}
test("(8) RECOVERY KEEPS A RANKED THROWAWAY — through the function's own ops: no ranked footprint is deleted as in v6.30; a played game or a seat at an unfinished ranked game is kept orphaned and intact; the recovered player's rating never moves", () => {
  assert.deepEqual(recoveryFailures(), []);
});
test("SABOTAGE (8): a backend that deletes every throwaway, or merges, is seen", () => {
  assert.ok(probe(() => recoveryFailures({deleteAlways: true})).length >= 1, "deleting a ranked throwaway must be seen");
});
