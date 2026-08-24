/* ============================================================
   BRIAR — "Essence of Earth and Lightning", and both clauses mint.

     The first time an attack action card you control deals damage to
     an opposing hero each turn, create an Embodiment of Earth token.

     The second time you play a non-attack action card each turn,
     create an Embodiment of Lightning token.

   Her ONE mechanic is the Embodiments, so nothing else in the deck can
   matter until the tokens actually get created. Both are AURAS, which
   is load-bearing rather than flavour: seven pool cards count auras
   generically, and a token that never reaches the board cannot be
   counted — the same thing v2.23 settled for Runechants.

   NEITHER MINT SITE NAMES A TOKEN. The build carries the name read off
   her own printed line, so `effects.js` mints whatever she prints.

   Asserted on the BOARD, never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const { loadData } = require("./helpers/extract.js");

const skip = H.hasDb() ? false : "no card database";
const W = loadData();

let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(require("./helpers/extract").cardDbPath(), "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard)));

const briarBuild = () => {
  const h = W.HEROES.find(x => x.k === "briar");
  return B.buildSideDefault(h, G.parseDeck(W.DECKS[h.k]), DB(), RNG.make("briar"), {n: 0}).b;
};

const boardNames = s => (s.sides[0].board || []).map(b => b.card.name);

/* ---- 1. the hero ability is read off her own text ------------------ */

test("both clauses are recognised, and each carries the token it prints", {skip}, () => {
  const b = briarBuild();
  assert.equal(b.earthOnFirstHeroDmg, "Embodiment of Earth");
  assert.equal(b.lightningOnSecondNonAtk, "Embodiment of Lightning");
});

test("the token name keeps its PRINTED capitalisation", {skip}, () => {
  /* `resolveEntry` returns the ENTRY's name, not the database record's, so
     a name captured off the lowercased copy of the hero text rides all the
     way onto the board and deals the player a card called "embodiment of
     lightning". Every drill in the suite was green when that shipped;
     driving the ability is what showed it. */
  const b = briarBuild();
  assert.match(b.earthOnFirstHeroDmg, /^Embodiment of Earth$/);
  assert.match(b.lightningOnSecondNonAtk, /^Embodiment of Lightning$/);
});

test("no other hero answers to these clauses", {skip}, () => {
  const others = W.HEROES.filter(h => h.k !== "briar");
  const ctr = {n: 0}; let rng = RNG.make("others");
  for(const h of others){
    const out = B.buildSideDefault(h, G.parseDeck(W.DECKS[h.k]), DB(), rng, ctr); rng = out.rng;
    assert.equal(out.b.earthOnFirstHeroDmg, "", h.k + " must not mint Earth");
    assert.equal(out.b.lightningOnSecondNonAtk, "", h.k + " must not mint Lightning");
  }
});

/* ---- 2. THE SECOND non-attack, and only the second ----------------- */

function playNonAttacks(count){
  P.fxReset();
  const built = briarBuild();
  let n = H.state({hand: [], res: 9, ap: 3}, {}, {turn: 3});
  for(let i = 0; i < count; i++){
    n.builds = [built, {}];
    const c = Object.assign({}, H.card("Sigil of Suffering", 1), {uid: "na" + i});
    assert.equal(P.isAttack(c), false, "the fixture must be a NON-attack or this drill proves nothing");
    n = H.execute(n, c, "hand", 0, {});
  }
  return n;
}

test("the SECOND non-attack action card mints Lightning — not the first", {skip}, () => {
  assert.deepEqual(boardNames(playNonAttacks(1)), [], "one is not two");
  assert.deepEqual(boardNames(playNonAttacks(2)), ["Embodiment of Lightning"]);
});

test("and not the third — 'the second time' is exactly once", {skip}, () => {
  /* a `>= 2` test mints on every non-attack after the first, which is
     strictly stronger than printed and the direction that steals games */
  const n = playNonAttacks(3);
  assert.deepEqual(boardNames(n), ["Embodiment of Lightning"]);
  assert.equal(n.sides[0].hist.non, 3, "the counter still climbs; only the mint is once");
});

/* ---- 3. THE FIRST attack action card to land on a hero ------------- */

function struck(o){
  o = o || {};
  P.fxReset();
  const built = briarBuild();
  const card = o.card || Object.assign({}, H.card("Rune Flash", 1), {uid: "a1"});
  const g = H.state({hand: [], res: 9, ap: 1, hist: Object.assign(
    {atk:0,non:0,arc:0,aura:0,made:0,booed:0,blue:0,red:0,trans:0,blueGY:0,atkNames:[]},
    o.hist || {})}, {}, {turn: 3});
  g.builds = [built, {}];
  g.pend = {card, from: o.from || "hand", total: 4, ga: false,
            ops: [], onHit: [], condOnHit: [], lateConds: [], lateOps: []};
  return H.fx(g, (f, n) => f.linkPayload(n, {total: 4, pumps: 0, handBlockers: 0,
    defenders: 0, blkNote: "", heroHit: o.heroHit !== false})).game;
}

test("an attack action card that lands on a hero mints Earth", {skip}, () => {
  assert.deepEqual(boardNames(struck()), ["Embodiment of Earth"]);
});

test("a fully blocked attack mints nothing — CR 7.5.5, no damage is no hit", {skip}, () => {
  assert.deepEqual(boardNames(struck({heroHit: false})), []);
});

test("a WEAPON swing mints nothing — the clause says attack action CARD", {skip}, () => {
  assert.deepEqual(boardNames(struck({from: "weapon"})), []);
});

test("the latch is once per turn", {skip}, () => {
  assert.deepEqual(boardNames(struck({hist: {briarEarth: 1}})), [],
    "'the first time ... each turn' must not mint twice in one turn");
});

/* ---- 4. the token arrives with its OWN printed clock --------------- */

test("Earth carries the destroy schedule IT prints, read off its own text", {skip}, () => {
  /* "At the beginning of your action phase, destroy this." A token minted
     outside `execute`'s play path used to carry no clock at all (v3.07),
     which for an Aura also inflates every "auras you control" count on the
     board forever. Nothing here names the schedule — it is read from the
     token's printed line. */
  const n = struck();
  const tok = (n.sides[0].board || []).find(b => /Earth/.test(b.card.name));
  assert.ok(tok, "the token must reach the board");
  assert.equal(tok.sd, "turn", "its printed clock must ride with it");
  assert.match(tok.card.tt || "", /aura/i, "it is an Aura, which is what makes it countable");
});

/* ---- 5. BOTH BOARDS, because the latch is in the shared body ------- */

test("the mint lives in linkPayload, so the table gets it too", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /* v3.45 gave `linkPayload` a NAMED local for this, because four fire
     sites now ask the same question (the on-hit-hero list, the gated
     riders, crush, and this). The guard therefore checks the two halves
     that matter rather than one spelling: the value is DERIVED from the
     caller's `info.heroHit`, and Earth is minted with that value. Replace
     the derivation with a bare `total > 0` and this fails, which is the
     sabotage it exists to catch. */
  assert.match(src, /const heroHit = info\.heroHit != null \? info\.heroHit : \(total > 0\)/,
    "the shared body must DERIVE heroHit from the caller's answer, never guess it");
  assert.match(src, /briarEarth\(n,\s*heroHit\)/,
    "Earth must be minted from the SHARED body — a schedule written into one "
    + "caller's damage step is a rule the other board does not have");
  /* and called from exactly ONE place: two mint sites is the same rule
     described twice, which is how the two boards drift apart in the first
     place. The definition reads `briarEarth = (`, so it does not match. */
  assert.equal((src.match(/briarEarth\(/g) || []).length, 1,
    "Earth must be minted from one site only");
});

test("judge answers heroHit itself, because CR 1.4.5 routes damage there", {skip}, () => {
  /* An attack on an ally never touches the hero, and the shared body
     cannot know that: the trainer wires no ally targeting at all, so a
     guess made inside `linkPayload` would be right on one board and wrong
     on the other. Comments are stripped first — a grep is satisfied by a
     comment, in both directions. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /const heroHit = total > 0 && !\(link\.target && link\.target\.kind === "ally"\)/,
    "judge must decide heroHit off the CR 1.4.5 attack-target");
  assert.match(src, /blkNote,\s*heroHit\}\)\)/, "and pass it into the shared body");
});
