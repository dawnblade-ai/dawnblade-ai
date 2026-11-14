/* test/servernames.test.js — A PLAYER'S NAME IS ON THE BOARD, FOR BOTH PHONES, DURING THE GAME (SERVER S4.4).

   The board (index.html TableBoard) reads `table.names()` off the server channel — the very read the lobby's "A vs B" line has made since
   v6.29 (engine/servertable.js `names()`, fed by the `names` field of the function's own answers; nothing about it is a wire payload, a prompt
   or a game key, so WIRE_V stays). These drills prove the DATA the board shows, from the phone's side, at the moments a board lives through:

     (1) IN A GAME — both seats read both names while the game is played (not only in the lobby), the opener having learned the joiner's,
         and a player with no name reads null (the board then draws nothing, exactly as before).
     (2) A RELOAD — a seat claimed back with its stored key reads both names at once (the keyed join answers them).
     (3) A TAKEOVER — the same player on another phone reads both names at once, and the other player's phone still reads both.
     (4) THE GAME'S OWN STATE HOLDS NO NAME — the stored game and every frame a phone received carry no player name (names are the
         function's envelope, never the engine's state, which the rules and the AI read).
   Each drill is run against a broken referee and must fail there. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require("./helpers/judgetable.js");
const F = require("./helpers/serverfakes.js");
const {makeWorld} = require("./helpers/servertransport.js");
const PH = require("./helpers/serverphone.js");
const ST = require("../engine/servertable.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}
const guard = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("hung")), ms || 20000); })]).finally(() => clearTimeout(t)); };
const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want);

async function namesFailures(server){
  const bad = [], world = makeWorld({seedKey: "names", server}), idp = F.memIdentity();
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  const player = (id, name) => { const tok = idp.issue(id); if(name) idp.rename(id, name, world.server.nameFold(name)); return {tok, identity: {token: async () => tok}}; };
  const P = player("P-names-zero", "Dawn Smith"), Q = player("P-names-one", "Rival One");
  const want = ["Dawn Smith", "Rival One"];
  const heard = [];
  const rand = T.seeded("names|phones");
  const mk = (n, h, who, extra) => PH.makePhone(world, n, {hero: h, rand, throws: [["rock", "rock"], ["paper", "rock"]], identity: who.identity, ...(extra || {})});
  const a = mk("A1", "kayo", P), b = mk("B1", "dash", Q);
  await a.connect("create");
  await b.connect("join", a.code);
  await world.settle([a.ch, b.ch]);
  /* (1) in a game */
  for(let i = 0; i < 40 && !(a.sess && b.sess && a.sess.status() === "ready" && b.sess.status() === "ready"); i++) await world.settle([a.ch, b.ch]);
  let moved = 0; for(let i = 0; i < 14; i++){ if(await PH.step(world, [a, b])) moved++; }
  if(moved < 8) bad.push("the game did not get going (" + moved + " actions)");
  if(!eq(a.ch.names(), want)) bad.push("seat 0 does not read both names during the game: " + JSON.stringify(a.ch.names()));
  if(!eq(b.ch.names(), want)) bad.push("seat 1 does not read both names during the game: " + JSON.stringify(b.ch.names()));
  /* (4) the engine's state and frames hold no name */
  const full = PH.storedGame(world, a.code), blob = JSON.stringify(full) + JSON.stringify(a.inbox) + JSON.stringify(b.inbox) + JSON.stringify(world.row(a.code).hub);
  for(const n of want) if(blob.indexOf(n) >= 0) bad.push("the stored game or a frame carries the player name '" + n + "'");
  /* (2) a reload of seat 0 and of seat 1 */
  for(const [ph, label] of [[a, "seat 0"], [b, "seat 1"]]){
    const key = ph.keep.get("srv." + ph.code, null);
    if(!key || typeof key.key !== "string") { bad.push(label + ": no stored seat to reload"); continue; }
    const r = await ST.reclaim({transport: world.transport("R" + label), keep: ph.keep, code: ph.code, sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, identity: ph === a ? P.identity : Q.identity}).then(c => c, e => ({err: e.why}));
    if(r.err) { bad.push(label + ": the reload was refused: " + r.err); continue; }
    if(!eq(r.names(), want)) bad.push(label + " reads " + JSON.stringify(r.names()) + " straight after a reload, wanted both names");
    r.close();
  }
  /* (3) the same player on another phone (no stored key): takes seat 0 */
  const oldKey = world.row(a.code).hub.keys[0];
  const a2 = await ST.sitAt({transport: world.transport("A2"), keep: PH.memKeep(), code: a.code, sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, identity: P.identity, onNames: n => heard.push(n)}).then(c => c, e => ({err: e.why}));
  if(a2.err) bad.push("the takeover was refused: " + a2.err);
  else {
    if(a2.seat !== 0 || world.row(a.code).hub.keys[0] === oldKey) bad.push("the second phone did not take seat 0");
    if(!eq(a2.names(), want)) bad.push("the phone that took the seat reads " + JSON.stringify(a2.names()) + ", wanted both names");
    await world.settle([a2.ch || a2, b.ch]);
    b.ch.heal(); await world.settle([b.ch]);
    if(!eq(b.ch.names(), want)) bad.push("the other player's phone lost a name after the takeover: " + JSON.stringify(b.ch.names()));
    a2.close();
  }
  /* a player with no name: the other seat reads null for them, never a placeholder */
  const w2 = makeWorld({seedKey: "names2", server}), idp2 = F.memIdentity();
  w2.deps.identify = t => idp2.identify(t); w2.deps.rename = (p, n, f) => idp2.rename(p, n, f);
  const nameless = idp2.issue("P-nameless"), named = idp2.issue("P-named"); idp2.rename("P-named", "Rival One", w2.server.nameFold("Rival One"));
  const o2 = (nm, tok, extra) => ({transport: w2.transport(nm), keep: PH.memKeep(), sleep: PH.FAST.sleep, tune: {...PH.FAST.tune}, rand: () => 0.5, identity: {token: async () => tok}, ...(extra || {})});
  const c1 = await ST.startTable(o2("C1", nameless)), c2 = await ST.sitAt(o2("C2", named, {code: c1.code}));
  c2.send({ch: "lobby", m: require("../engine/lobby.js").hello(1, T.BUILD)}); await w2.settle([c1, c2]);
  if(!eq(c1.names(), [null, "Rival One"]) || !eq(c2.names(), [null, "Rival One"])) bad.push("a player with no name did not read null: " + JSON.stringify([c1.names(), c2.names()]));
  c1.close(); c2.close(); a.ch.close(); b.ch.close();
  return bad;
}
test("(1)-(4) A PLAYER'S NAME IS ON BOTH PHONES DURING THE GAME, after a reload and after a takeover, and in no game state; a player with no name reads null", async () => {
  assert.deepEqual(await guard(namesFailures(require(path.join(ROOT, "server", "referee.js")))), []);
});
test("SABOTAGE: a keyed join that answers no names, a takeover that answers none, and a referee that writes the name into the game are each seen", async () => {
  const noKeyed = loadServer([["...(who && ownersOf(row)[req.seat] === who.player ? {owned: true} : {}), ...pub(row), frames: r.out[req.seat]};", "...(who && ownersOf(row)[req.seat] === who.player ? {owned: true} : {}), frames: r.out[req.seat]};"]]);
  assert.ok((await guard(namesFailures(noKeyed))).some(x => /after a reload/.test(x)), "a reload that learns no names must be seen");
  const noTake = loadServer([["{seat, n: row.nonces[seat], owned: true, ...pub(row)},\n    ver =>", "{seat, n: row.nonces[seat], owned: true},\n    ver =>"]]);
  assert.ok((await guard(namesFailures(noTake))).some(x => /took the seat reads/.test(x)), "a takeover that learns no names must be seen");
  const inState = loadServer([["row.hub = r.hub.persistTable();\n  /* S4.4:", "row.hub = r.hub.persistTable(); if(row.names) row.hub.nameLeak = row.names[0];\n  /* S4.4:"]]);
  assert.ok((await guard(namesFailures(inState))).some(x => /carries the player name/.test(x)), "a name in the stored hub must be seen");
});
