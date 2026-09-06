/* OVERPOWER — THE THIRD CAP, AND THE THIRD COUNTED SET (v4.22)
   ============================================================
   > "When you play Spectral Rider, if you control a Spectral Shield, this
   >  gains **overpower**. *(This can't be defended by more than 1 action
   >  card.)*"  — DYN229, fetched and read

   The database prints no reminder text for any keyword; the PRINTING does,
   and it settles both halves at once — the NUMBER and the COUNTED SET.
   That set is neither of the two `defCap` already knows:

     dominate    1  cards FROM HAND      (this project's recorded reading)
     Confidence  2  NON-BLOCK cards      (so a declared equipment counts)
     overpower   1  ACTION cards         (equipment is not one; nor is a
                                          Block, nor a Defense Reaction)

   Defaulting to a sibling's set changes what may block, in both
   directions — which is why v3.64 wrote "the counted set is READ OFF THE
   PRINTED WORD" and why this file drives all four kinds of defender.

   AND THE GATE WAS THE WHOLE BLOCKER. `gainKw` has accepted `overpower`
   since it was written; what refused was "if you control a Spectral
   Shield", the pool's ONLY refusing clause of that shape. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

/* ---- 1. THE GATE ---------------------------------------------------- */

test("the named-permanent condition reads the NAME off the printed line", () => {
  P.fxReset();
  const r = P.classifyClause(
    "When this is played, if you control a Spectral Shield, this gets overpower");
  assert.ok(r && r.status === "run", "the clause must read at all");
  assert.equal(r.cond, "board:spectral shield",
    "the NAME travels in the condition (v3.21) — a boolean would write one card " +
    "into the engine, which is what `seismic` one line above it does");
  assert.deepEqual(r.ops, [["gainKw", "overpower"]]);
});

test("…and it is the PRINTED CAPITALISATION that tells a name from a common noun", () => {
  /* v3.53: `classifyClause` works on the LOWERCASED clause, so the subject
     is recovered from the raw one. Handed lowercase text the reader
     answers null — which looks exactly like a pattern that did not match.
     MEASURED over the pool's four singular subjects of this shape: only
     "Spectral Shield" is a proper noun. */
  P.fxReset();
  assert.equal(P.classifyClause("If you control a Spectral Shield, this gets dominate").cond,
    "board:spectral shield");
  for(const common of ["a Lightning attack", "an aura of suspense", "a card"]){
    P.fxReset();
    const r = P.classifyClause("If you control " + common + ", this gets dominate");
    assert.ok(!r || !/^board:/.test(r.cond || ""),
      common + " is a common noun (or a CLASS), and reading it as a card NAME " +
      "claims every dynamic subject this reader exists to refuse — got " +
      JSON.stringify(r && r.cond));
  }
});

test("the if/when recursion carries the RAW tail, or the name is gone", () => {
  /* v3.53's lesson one recursion deeper. `m` is matched against the
     LOWERCASED clause, so recursing on `m[2]` hands the inner call text
     whose capitalisation is already stripped. The SABOTAGE is to recurse
     on the lowercased capture; this fixture is the one that bites, because
     the gate is only reachable through the wrapper. */
  P.fxReset();
  const wrapped = P.classifyClause(
    "When this is played, if you control a Spectral Shield, this gets overpower");
  P.fxReset();
  const bare = P.classifyClause("If you control a Spectral Shield, this gets overpower");
  assert.equal(wrapped && wrapped.cond, bare && bare.cond,
    "the wrapper must not change what the gate reads");
  assert.equal(wrapped.cond, "board:spectral shield");
});

/* ---- 2. THE CAP, AND THE COUNTED SET -------------------------------- */

const OVER = {name: "Overpowering Swing", tt: "Illusionist Action - Attack",
  ty: ["Illusionist", "Action", "Attack"], pitch: 1, cost: 1, power: 6, def: 2,
  kw: ["Overpower"], tx: "Overpower"};

test("`defCap` reads overpower, and its counted set is ACTION cards", () => {
  const cap = P.defCap(OVER, null, {});
  assert.deepEqual(cap, {n: 1, count: "action"},
    "1 and `action` are both READ off the printing — a hardcoded `hand` would " +
    "let a Block card through and stop an equipment that the card never names");
});

test("`defCounts` — an action card counts; a Block, a Reaction and iron do not", () => {
  const cap = P.defCap(OVER, null, {});
  const c = (nm, ty) => ({name: nm, tt: ty.join(" "), ty});
  assert.equal(P.defCounts(cap, c("Act", ["Guardian", "Action", "Attack"]), false), true);
  assert.equal(P.defCounts(cap, c("Blk", ["Generic", "Block"]), false), false,
    "a Block card carries no Action");
  assert.equal(P.defCounts(cap, c("DR", ["Guardian", "Defense Reaction"]), false), false,
    "\"Reaction\" contains the substring \"action\" (v2.44) — the STRUCTURED " +
    "array is the authority, and a Defense Reaction carries no Action at all");
  assert.equal(P.defCounts(cap, c("Iron", ["Generic", "Equipment"]), true), false,
    "an equipment is not an action card, so the gear half needs no restating");
});

test("a GRANTED overpower is the caller's answer, exactly as a granted dominate is", () => {
  /* `hasKwNow` correctly drops a keyword every mention of which sits under
     an `if` — Spectral Rider prints it only "if you control a Spectral
     Shield" — so without `_kwGrant` the cap could never apply at all. */
  const gated = {name: "Gated Rider", tt: "Illusionist Action - Attack",
    ty: ["Illusionist", "Action", "Attack"], pitch: 1, cost: 1, power: 6,
    kw: ["Overpower"], tx: "If you control a Spectral Shield, this gets overpower"};
  assert.equal(P.defCap(gated, null, {}), null,
    "conditionally granted, so at rest there is no cap — weaker than printed and visible");
  assert.deepEqual(P.defCap(gated, null, {kwGrant: ["overpower"]}), {n: 1, count: "action"},
    "and the clause hands it over when the gate actually fires (v3.64, v3.71)");
});

/* ---- 3. DRIVEN, on the real card, at the table ---------------------- */

const wall = (atk, hand, gear) => {
  const g = H.state({res: 9, ap: 1}, {hand: hand || [], gear: gear || []},
                    {turn: 3, actor: 0, turnPlayer: 0});
  return {...g, phase: "action", step: "defend", priority: 0, passed: [], attacker: 0,
          stack: [], pend: {card: atk, by: 0, target: {kind: "hero"}, total: 6,
                            ga: false, ops: [], onHit: [], defCap: null}};
};
const act  = uid => ({uid, name: "Act " + uid, tt: "Guardian Action",
                      ty: ["Guardian", "Action"], pitch: 1, cost: 1, power: 2, def: 3});
const blk  = uid => ({uid, name: "Blk " + uid, tt: "Generic Block",
                      ty: ["Generic", "Block"], pitch: 1, cost: null, power: null, def: 4});
const iron = uid => ({uid, name: "Iron " + uid, tt: "Generic Equipment - Chest",
                      ty: ["Generic", "Equipment"], pitch: 0, cost: null, def: 2});
const declare = (g, uid) => J.reduce(g, {t: "defend", uid}, 1).state;

test("DRIVEN: a second ACTION card against overpower is refused at the table", () => {
  let g = wall({...OVER, uid: 50}, [act(1), act(2)]);
  assert.equal(J.legal(g, {t: "defend", uid: 1}, 1), null, "the first is legal");
  g = declare(g, 1);
  const why = J.legal(g, {t: "defend", uid: 2}, 1);
  assert.ok(why && /more than 1 action card/.test(why),
    "and the refusal NAMES the counted set, because the three sets differ — got: " + String(why));
});

test("…and BOTH HALVES: a Block card and an equipment still get through", () => {
  /* A cap that refuses everything passes the first drill perfectly (v3.45).
     These are the defenders overpower's printed word does NOT count. */
  let g = declare(wall({...OVER, uid: 50}, [act(1), blk(2)]), 1);
  assert.equal(J.legal(g, {t: "defend", uid: 2}, 1), null,
    "a Block card is not an action card — refusing it invents a restriction");
  let h = declare(wall({...OVER, uid: 50}, [act(1)], [iron(7)]), 1);
  assert.equal(J.legal(h, {t: "defend", uid: 7}, 1), null,
    "nor is a declared piece of equipment");
});

test("DRIVEN: the real card, both sides of its own gate", {skip}, () => {
  H.db();
  const rider = H.card("Spectral Rider", 3);
  const shield = H.tok("Spectral Shield");
  assert.ok(rider && rider.name === "Spectral Rider", "fixture");
  assert.ok(shield && shield.name === "Spectral Shield", "the token must resolve");

  const swing = board => {
    const g = H.state({hand: [rider], board}, {});
    const out = H.execute(g, rider, "hand", 0,
      {attacking: true, isAttack: true, heroTarget: true});
    return out.game || out;
  };
  const withShield = swing([{uid: 900, kind: "aura", card: shield}]);
  assert.deepEqual(withShield.pend.defCap, {n: 1, count: "action"},
    "with a Shield on the board the cap reaches `pend` at DECLARATION, which " +
    "is the only moment both facts exist (v3.71)");

  const without = swing([]);
  assert.equal(without.pend.defCap, null,
    "and without one the attack is defended normally — the gate is the card");
  assert.ok((without.feed || []).some(l => /no Spectral Shield/.test(l)),
    "the feed names the CARD that is missing, in the player's words");
});

test("Spectral Rider is LIVE, not latent — Enigma decks two", {skip}, () => {
  /* A build nobody can reach is a claim about today (v3.54). */
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(src, /2\|Spectral Rider\|3\|/,
    "if the deck list moves, this build stops being live and the note above must say so");
});

/* ---- 4. THE POSSESSIVE `sv` WAS MISSING ----------------------------- */

test("`sp` inflects a seat's NAME, and seat 0's possesses as \"your\"", () => {
  /* v3.46 moved deliberately AWAY from a bare "your" — a token line saying
     "created on YOUR board" is a lie under a borrowed seat — so the answer
     is to inflect the NAME, not to replace it. Both rules hold at once. */
  assert.equal(G.sp({name: "You"}), "your",
    "seat 0 is literally named \"You\" (v2.83), so \"You's board\" is the fault");
  assert.equal(G.sp({name: "Kayo"}), "Kayo's");
  assert.equal(G.sp({name: "Gravy Bones"}), "Gravy Bones's",
    "a name ending in s keeps the apostrophe-s the feed has always printed — " +
    "choosing the bare apostrophe is a style judgement about English, not a defect");
  assert.equal(G.spName("You"), "your", "the twin `svName` is, for a caller holding no side");
});

test("no hand-rolled seat possessive survives in `effects.js`", () => {
  /* THE GAP WAS RECORDED IN THE SOURCE, above the one site already fixed:
     "Three older sites in this file still say it." A recorded gap is a
     debt (v3.61) and it came due when a new feed line needed a possessive
     and the second-person ledger refused to grow. MEASURED: 30 sites. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const bad = src.match(/\$\{(?:act|foe)\(n\)\.name\}'s|\$\{sd\.name\}'s/g) || [];
  assert.deepEqual(bad, [],
    "a seat possessive built by hand reads \"You's board\" on the board a player " +
    "uses — `game.sp` is the one body, exactly as `sv` is for the verb (v4.15)");
  assert.ok(/\bsp\(/.test(src), "…and the helper is actually reached for");
});

test("a CARD's possessive is untouched — it is not a seat", () => {
  /* `${top.name}'s` and `${pc.name}'s` name CARDS, whose names are never
     "You", so sweeping them would be a change with no rule behind it. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/\$\{(?:top|pc)\.name\}'s/.test(src),
    "the card possessives stay — a scan that swept them too would be widening " +
    "a fix past the shape it was measured for");
});
