/* THE SERIALIZATION DRILLS (engine/wire.js).

   Two properties carry the whole format and everything else here supports
   one of them:

     decode(encode(g)) deep-equals g      — nothing is lost
     hash(a) === hash(b) iff a and b are the same GAME — not the same object

   The second is the subtle one. Two peers build their state by different
   routes — one from makeGame and a hundred reducer calls, the other from a
   snapshot off the wire — so the fingerprint has to ignore key insertion
   order, per-client UI toggles, and the log (whose taunts are deliberately
   random). Get any of that wrong and every reconnect looks like a desync. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const W = require("../engine/wire.js");
const S = require("../engine/sides.js");
const A = require("../engine/actions.js");

/* A state with something in EVERY zone shape the format knows about, plus
   the per-instance stamps that are the whole reason cards are diffed
   rather than shipped whole: gear wear, a graveyard stamp, an arsenal
   card turned face up. A round-trip drill is only worth as much as the
   fixture it runs on. */
function richFixture(){
  const c = (uid, name, pitch, extra) => Object.assign({
    uid, name, pitch, cost: 1, power: 4, def: 3,
    tt: "Generic Attack Action", tx: "", kw: [],
    img: "https://cdn.example/" + uid + ".png"
  }, extra || {});

  const p = S.makeSide({id: 0, hp: 17, hero: "Test Hero", heroKey: "test"});
  p.deck    = [c(1, "Alpha", 1), c(2, "Alpha", 1), c(3, "Beta", 2)];
  p.hand    = [c(4, "Alpha", 1), c(5, "Gamma", 3)];
  p.pitch   = [c(6, "Beta", 2)];
  p.grave   = [c(7, "Alpha", 1, {_gy: 3}), c(8, "Beta", 2, {_gy: 5})];
  p.banish  = [c(9, "Gamma", 3, {_faceDown: true})];
  p.soul    = [c(10, "Beta", 2)];
  p.arsenal = c(11, "Alpha", 1, {_faceUp: true, _upTurn: 4, _arsPow: 2, _arsGA: true});
  p.gear    = [c(12, "Helm", 0, {tt: "Head", curDef: 1}),
               c(13, "Buckler", 0, {tt: "Off-Hand", destroyed: true, curDef: 0})];
  p.board   = [{card: c(14, "Runechant", 0, {tt: "Runeblade Token - Aura"}), kind: "aura", spent: false, uid: "rune1"},
               {card: c(15, "Scout", 0, {tt: "Ally", life: 2}), kind: "ally", spent: false, uid: 15, life: 1}];
  p.counters = {12: {rust: 2}};
  p.hist = Object.assign(S.freshHist(), {atk: 2, atkNames: ["Alpha", "Beta"]});

  const o = S.makeSide({id: 1, hp: 20});
  o.deck = [c(101, "Alpha", 1), c(102, "Delta", 2)];
  o.hand = [c(103, "Delta", 2)];

  const g = S.makeGame({sides: [p, o], firstPlayer: 0, seed: "fixture"});
  g.log  = ["you swing", "nice one"];
  g.feed = ["a taunt that is random by design"];
  g.chain = [c(16, "Beta", 2)];
  g.chainOpen = true;
  g.pend = {card: c(17, "Gamma", 3), ops: []};
  return g;
}

/* ---- losslessness ---------------------------------------------------- */

test("decode(encode(g)) round-trips a rich state exactly", () => {
  const g = richFixture();
  assert.deepEqual(W.decode(W.encode(g)), g);
});

test("round-trip survives a whole played game, not just a fresh one", () => {
  let g = A.newMatch({seed: "wire-game", first: 0});
  const feed = (a, seat) => { const r = A.reduce(g, a, seat); if(!r.error) g = r.state; };
  feed({t: "pitch", uid: g.sides[0].hand[0].uid}, 0);
  feed({t: "attack", uid: g.sides[0].hand[0].uid}, 0);
  feed({t: "pass"}, 0); feed({t: "pass"}, 1);
  feed({t: "defend", uids: [g.sides[1].hand[0].uid]}, 1);
  for(let i = 0; i < 8 && g.chainOpen; i++){ feed({t: "pass"}, 0); feed({t: "pass"}, 1); }
  feed({t: "endTurn"}, 0);
  assert.equal(g.chainOpen, false, "fixture should have played a full chain link");
  assert.deepEqual(W.decode(W.encode(g)), g);
});

test("per-instance stamps survive: gear wear, _gy, the face-up arsenal", () => {
  const back = W.decode(W.encode(richFixture()));
  const p = back.sides[0];
  assert.equal(p.gear[0].curDef, 1);
  assert.equal(p.gear[1].destroyed, true);
  assert.equal(p.grave[0]._gy, 3);
  assert.equal(p.grave[1]._gy, 5);
  assert.equal(p.arsenal._faceUp, true);
  assert.equal(p.arsenal._arsPow, 2);
  assert.equal(p.board[1].life, 1, "a damaged ally keeps its current life, not its base");
});

test("two instances of one card keep their OWN stamps", () => {
  /* Alpha|1 appears six times across five zones with different stamps.
     They share a dictionary entry, so a bug that let one instance's
     overrides leak into another would show up right here. */
  const back = W.decode(W.encode(richFixture()));
  const p = back.sides[0];
  assert.equal(p.deck[0]._gy, undefined);
  assert.equal(p.grave[0]._gy, 3);
  assert.equal(p.arsenal._arsPow, 2);
  assert.equal(p.hand[0]._arsPow, undefined);
});

/* ---- the dictionary -------------------------------------------------- */

test("cards are interned once per name|pitch, not once per instance", () => {
  const w = W.encode(richFixture());
  const keys = w.dict.map(d => d.k);
  assert.equal(keys.length, new Set(keys).size, "a key was interned twice");
  /* Alpha|1 is in the deck twice, the hand, the graveyard and the arsenal */
  assert.equal(keys.filter(k => k === "Alpha|1").length, 1);
});

test("a catalog keeps definitions off the wire entirely", () => {
  const g = richFixture();
  const all = [...g.sides[0].deck, ...g.sides[0].hand, ...g.sides[0].pitch, ...g.sides[0].grave,
               ...g.sides[0].banish, ...g.sides[0].soul, g.sides[0].arsenal, ...g.sides[0].gear,
               ...g.sides[0].board.map(b => b.card), ...g.sides[1].deck, ...g.sides[1].hand];
  const catalog = W.makeCatalog(all);
  const ref = W.encode(g, {catalog}), full = W.encode(g);
  assert.ok(ref.dict.every(d => d.d === undefined), "ref mode must not ship definitions");
  assert.ok(W.sizeOf(ref) < W.sizeOf(full), "ref mode should be smaller");
  assert.deepEqual(W.decode(ref, {catalog}), g);
});

test("a card the catalog does not know still ships its definition", () => {
  /* A token minted at runtime, or a card added to NEEDED since the peer
     last warmed its cache. It must cross correctly, not arrive as a hole. */
  const g = richFixture();
  const catalog = W.makeCatalog([g.sides[0].hand[0]]);   /* Alpha|1 only */
  const w = W.encode(g, {catalog});
  const known = w.dict.find(d => d.k === "Alpha|1");
  const unknown = w.dict.find(d => d.k === "Runechant|0");
  assert.equal(known.d, undefined, "a catalog hit ships bare");
  assert.ok(unknown.d, "a catalog miss ships its definition");
  assert.deepEqual(W.decode(w, {catalog}), g);
});

/* ---- the refusals ---------------------------------------------------- */

test("decode refuses a payload from a different wire version", () => {
  const w = W.encode(richFixture());
  assert.throws(() => W.decode({...w, v: W.WIRE_V + 1}), /WIRE-VERSION/);
});

test("decode refuses when the two clients hold different card data", () => {
  /* THE HAZARD REF MODE INTRODUCES. One client warm on an older DATA_VER
     rehydrates a bare key into a different card and the game diverges with
     nothing to point at. A loud refusal beats a quiet divergence. */
  const g = richFixture();
  const catalog = W.makeCatalog([...g.sides[0].hand, ...g.sides[0].deck]);
  const stale = JSON.parse(JSON.stringify(catalog));
  stale["Alpha|1"].power = 99;
  assert.throws(() => W.decode(W.encode(g, {catalog}), {catalog: stale}), /WIRE-CATALOG/);
});

test("decode refuses a bare key with no catalog to rehydrate it", () => {
  const g = richFixture();
  const catalog = W.makeCatalog([...g.sides[0].hand, ...g.sides[0].deck]);
  const w = W.encode(g, {catalog});
  delete w.cat;                              /* pretend the guard was not there */
  assert.throws(() => W.decode(w), /WIRE-NO-DEF/);
});

test("a tampered or truncated payload fails loudly instead of desyncing", () => {
  const w = W.encode(richFixture());
  const hit = JSON.parse(JSON.stringify(w));
  hit.game.sides[0].hp = 3;
  assert.throws(() => W.decode(hit), /WIRE-HASH/);
});

test("a function in game state is refused, not silently dropped", () => {
  /* JSON.stringify would drop it and produce two peers that agree on a
     hash and disagree on the game. */
  const g = richFixture();
  g.sides[0].hand[0].onPlay = () => {};
  assert.throws(() => W.hash(g), /non-serializable/);
});

/* ---- the fingerprint ------------------------------------------------- */

test("the hash ignores key insertion order", () => {
  /* The reason JSON.stringify cannot be the fingerprint: one peer builds
     its state through the reducer, the other rebuilds it from a snapshot,
     and the two end up with the same fields in a different order. */
  const a = {x: 1, y: {p: 2, q: 3}, z: [1, 2]};
  const b = {z: [1, 2], y: {q: 3, p: 2}, x: 1};
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
  assert.equal(W.hash(a), W.hash(b));
});

test("the hash ignores the log and feed — the taunts are random ON PURPOSE", () => {
  /* CLAUDE.md keeps taunts, trophy text and the random-hero button on
     Math.random because they touch no game state. Two honest peers are
     therefore GUARANTEED to differ there, and hashing it would report a
     desync on literally every action. */
  const g = richFixture();
  const chatty = {...g, log: [...g.log, "a different taunt"], feed: ["something else entirely"]};
  assert.equal(W.hash(g), W.hash(chatty));
});

test("the hash ignores per-client UI toggles and art URLs", () => {
  const g = richFixture();
  assert.equal(W.hash(g), W.hash({...g, inspect: true, boostOn: false}));
  const arty = W.decode(W.encode(g));
  arty.sides[0].hand[0].img = "https://cdn.example/other.png";
  assert.equal(W.hash(g), W.hash(arty), "art is presentation, not rules state");
});

test("the hash catches a card moving zone", () => {
  const g = richFixture();
  const moved = W.decode(W.encode(g));
  moved.sides[0].grave = [moved.sides[0].hand[0], ...moved.sides[0].grave];
  moved.sides[0].hand = moved.sides[0].hand.slice(1);
  assert.notEqual(W.hash(g), W.hash(moved));
});

test("the hash catches an rng that advanced on one peer only", () => {
  /* rng.js calls `n` the desync canary: two peers at the same action with
     different draw counts have already diverged. */
  const g = richFixture();
  assert.notEqual(W.hash(g), W.hash({...g, rng: {...g.rng, n: g.rng.n + 1}}));
});

test("the hash catches a priority handoff that went the other way", () => {
  const g = richFixture();
  assert.notEqual(W.hash(g), W.hash({...g, priority: 1}));
  assert.notEqual(W.hash(g), W.hash({...g, passed: [true, false]}));
  assert.notEqual(W.hash(g), W.hash({...g, step: "defend"}));
});

test("strings cannot forge structure, and -0 is not a divergence", () => {
  /* Length-prefixed strings: no amount of punctuation inside a card's
     rules text can look like a structural boundary. */
  assert.notEqual(W.hash({a: "1,2"}), W.hash({a: ["1", "2"]}));
  assert.notEqual(W.hash({a: "b", c: ""}), W.hash({a: "b,c", d: ""}));
  assert.equal(W.hash({hp: -0}), W.hash({hp: 0}));
  assert.notEqual(W.hash({hp: NaN}), W.hash({hp: 0}));
});

/* ---- the differ ------------------------------------------------------ */

test("diffPaths names the field, not just 'they differ'", () => {
  /* The payoff. A hash mismatch after a chain link could be any of a
     hundred things; this is what turns it into a one-line fix. */
  const g = richFixture();
  const other = W.decode(W.encode(g));
  other.sides[1].hp = 12;
  other.rng = {...other.rng, n: other.rng.n + 1};
  const paths = W.diffPaths(g, other);
  assert.ok(paths.includes("/sides/1/hp"), "got: " + paths.join(", "));
  assert.ok(paths.includes("/rng/n"), "got: " + paths.join(", "));
});

test("diffPaths reports a length change instead of every index after it", () => {
  const a = {z: [1, 2, 3]}, b = {z: [9, 1, 2, 3]};
  const paths = W.diffPaths(a, b);
  assert.ok(paths.some(p => p.includes("#length 3 vs 4")), "got: " + paths.join(", "));
});

test("diffPaths is empty for states that differ only in volatile fields", () => {
  const g = richFixture();
  assert.deepEqual(W.diffPaths(g, {...g, log: ["different"], inspect: true}), []);
});

/* ---- the zone ledger ------------------------------------------------- */

test("every SIDE_FIELD is classified — a new zone cannot escape the format", () => {
  /* Same discipline as sides.js's P_MAP / GAME_KEYS ledger: a zone that is
     missing from the encoder's lists is not an error the encoder can
     detect, it just ships uninterned and keeps working. So the ledger is
     checked here instead. Adding a zone to sides.js means adding it to
     one of wire.js's four lists, deliberately. */
  const classified = new Set([...W.CARD_ZONES, ...W.SLOT_ZONES, ...W.ENTRY_ZONES, ...W.NON_CARD_SIDE_FIELDS]);
  const stray = S.SIDE_FIELDS.filter(f => !classified.has(f));
  assert.deepEqual(stray, [], "unclassified side field(s) — add to a zone list or to NON_CARD_SIDE_FIELDS");
  const bogus = [...classified].filter(f => S.SIDE_FIELDS.indexOf(f) < 0);
  assert.deepEqual(bogus, [], "wire.js lists a field sides.js does not have");
});

test("the encoder actually visits every declared zone", () => {
  /* Guards against a zone being listed but mapped into the wrong bucket —
     a SLOT_ZONE listed under CARD_ZONES would silently ship verbatim. */
  const g = richFixture();
  const w = W.encode(g);
  const p = w.game.sides[0];
  for(const z of W.CARD_ZONES)
    assert.ok(p[z].every(c => Array.isArray(c)), z + " was not interned");
  assert.ok(Array.isArray(p.arsenal), "arsenal was not interned");
  assert.ok(p.board.every(b => Array.isArray(b.card)), "board entries were not interned");
});

test("every engine module is loaded by index.html, or declared headless", () => {
  /* wire, net, actions and room are all loaded by index.html and all four
     are in test/sync.test.js's MODULES, so the bridge guard covers them.

     `judge` is headless ON PURPOSE. It is the Phase 1 reducer and it
     models the turn structure, the combat chain and the costs — but not
     yet card EFFECTS, which are still `runOps`/`execute` in the trainer.
     Loading it before that port lands would put a second, quieter rules
     engine on the page next to the real one. It comes off this list in
     the same edit that adds it to MODULES and wires `Battle` to dispatch.

     A new engine module that nothing loads yet belongs here, and moving
     one out must be the same edit that adds it to MODULES — otherwise a
     module can be wired into the page with nothing watching for a
     shadowed export. */
  /* `types` is headless with `judge`, and deliberately NOT bridged: its
     natural names (`isAttack`, `isWeaponType`, `isAllyCard`) sit next to
     parser.js's and game.js's, and two of those pairs mean genuinely
     different things — `parser.isWeapon` is "a weapon with printed
     power" and `game.isAlly` takes a board entry, not a card. Bridging
     both sets into one bare namespace is the same-name-different-meaning
     trap that KNOWN_COLLISIONS exists to police. It comes off this list
     with judge.js, and the names get resolved then, not silently now. */
  /* judge.js and types.js came off this list in v2.49, when the table
     screen stopped playing actions.js's blank decks and started playing
     two real hero decks. sparring.js stays headless: nothing on the page
     calls it, and loading a policy that proposes actions next to a
     trainer that has its own dummy is exactly the second-quiet-engine
     hazard this list exists to name. */
  const HEADLESS = ["sparring"];
  const dir = path.join(__dirname, "..", "engine");
  const mods = fs.readdirSync(dir).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3));
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const loaded = mods.filter(m => src.includes('<script src="engine/' + m + '.js"></script>'));

  assert.deepEqual(mods.filter(m => loaded.indexOf(m) < 0 && HEADLESS.indexOf(m) < 0), [],
    "an engine module is neither loaded by index.html nor declared headless here");
  assert.deepEqual(HEADLESS.filter(m => loaded.indexOf(m) >= 0), [],
    "a headless module is now loaded — add it to test/sync.test.js's MODULES and remove it here");
});

test("dropping the log is opt-in, and does not disturb the fingerprint", () => {
  const g = richFixture();
  const trimmed = W.encode(g, {log: false});
  assert.ok(W.sizeOf(trimmed) < W.sizeOf(W.encode(g)));
  const back = W.decode(trimmed);
  assert.equal(back.log, undefined);
  assert.equal(W.hash(back), W.hash(g), "log/feed are outside the fingerprint either way");
});
