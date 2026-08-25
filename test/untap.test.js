/* ============================================================
   UNTAP, AND WHY IT ONLY MEANS SOMETHING NOW (v3.47)

   `{u}` was flagged "not parsed" in the keyword ledger for as long as the
   flag has existed, and REFUSING it was right the whole time: until v3.44
   allies did not tap, so untapping one bought nothing and reading it
   would have been a card doing nothing dressed as a card that works.

   Now `{t}` is what an ally spends to attack, so an untap buys a SECOND
   attack — the only way an ally swings twice in a turn. Scuttle Toes is
   Gravy Bones' Legs piece, in the deck list, and it read `tier: part`
   with its whole ability unread because `parseHeroPower` refuses a line
   whose payload has no reader ("never parse ahead of wiring", v3.04).

   The chain this closes, all of it built in the last four versions:
   an ally attacks and taps (v3.44) -> Scuttle Toes untaps it and stamps
   the end-phase clock -> it attacks again -> the sweep destroys it ->
   "when this dies" fires (v3.46).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const H = require("./helpers/judged.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const C = require("../engine/cards.js");
const RNG = require("../engine/rng.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const W = loadData();

/* Gravy Bones wearing Scuttle Toes, which is NOT in his default loadout
   (Mage Master Boots takes the Legs slot) — so the drill equips it the
   way the Loadout screen would rather than asserting against a build that
   never contains the card. */
function withScuttle(){
  const db = H.db();
  const hero = W.HEROES.find(h => /gravy/i.test(h.k));
  const d = G.parseDeck(W.DECKS.gravy);
  const saSet = (hero.code || "").slice(0, 3) || null;
  const slots = d.gear.map((e, i) => ({i, c: C.resolveEntry(db, e, saSet)}));
  const want = slots.filter(x => /Scuttle Toes/.test(x.c.name)).map(x => x.i);
  const rest = slots.filter(x => !/Scuttle Toes|Mage Master Boots/.test(x.c.name)).map(x => x.i);
  assert.ok(want.length, "Scuttle Toes is not in Gravy Bones' gear list any more");
  return B.buildSide(hero, d, db, {gearIdx: [...want, ...rest.slice(0, 4)]}, RNG.make("st"), {n: 0}).b;
}

/* ---- 1. THE READER, AND WHAT UNLOCKS THE ROUTE ----------------------- */

test("the untap payload reads, which is what lets the ability be routed at all", {skip}, () => {
  assert.deepEqual(P.classifyClause("{u} target ally you control").ops, [["untapAlly", 1]]);
  /* `parseHeroPower` REFUSES a line whose payload has no reader, so the
     route exists only because the payload now does. Before this the card
     had no `powCard` on either board and could not be activated. */
  const line = "Instant - {r}{r}, destroy this: {u} target ally you control. Destroy it at the beginning of the end phase.";
  const pw = P.parseHeroPower(line, true);
  assert.ok(pw, "the ability is unreadable, so build.js gives the piece no powCard");
  assert.equal(pw.cost, 2);
  assert.equal(pw.kind, "instant");
});

test("build.js gives the equipped piece its ability", {skip}, () => {
  const piece = withScuttle().gear.find(x => /Scuttle Toes/.test(x.name));
  assert.ok(piece && piece.powCard, "no powCard — the v3.04 equipment route has nothing to reach");
  P.fxReset();
  assert.deepEqual(P.fxParse(piece.powCard).ops, [["untapAlly", 1, {sd: "end"}]]);
});

/* ---- 2. "IT" IS THE ALLY, NOT THE SOURCE ----------------------------- */

test("the end-phase clock rides on the untap, not on the source", {skip}, () => {
  /* v2.33's Bull's Eye Bracers trap: "Destroy IT" names the card that was
     acted on, not the card doing the acting. The source is Scuttle Toes,
     already destroyed to pay the cost — so a `selfDestruct` would land on
     nothing and the printed drawback would be free. */
  P.fxReset();
  const pc = {name: "ST drill ability", pitch: 0, cost: 2, power: null, def: null,
    tt: "Equipment Ability", kw: [], _instant: true,
    tx: "{u} target ally you control. Destroy it at the beginning of the end phase."};
  const f = P.fxParse(pc);
  assert.deepEqual(f.ops, [["untapAlly", 1, {sd: "end"}]]);
  assert.ok(!f.ops.some(o => o[0] === "selfDestruct"),
    "a selfDestruct here would destroy the SOURCE and leave the ally free");
});

test("an ordinary self-destruct is untouched by the pairing", {skip}, () => {
  P.fxReset();
  const aura = {name: "pairing control aura", pitch: 0, tt: "Generic Aura", kw: [],
    tx: "At the beginning of your end phase, destroy this."};
  assert.deepEqual(P.fxParse(aura).ops, [["selfDestruct", "end"]]);
});

/* ---- 3. DRIVEN — the untap buys a second attack ---------------------- */

test("driven: an ally attacks, is untapped, and attacks again", {skip}, () => {
  const b = withScuttle();
  const piece = b.gear.find(x => /Scuttle Toes/.test(x.name));
  const swab = H.card("Swabbie", 2);
  P.fxReset();
  let g = H.state({res: 9, ap: 2, gear: b.gear,
    board: [{card: swab, kind: "ally", uid: swab.uid, spent: false, life: 3}]},
    {hp: 20}, {turn: 3, actor: 0});
  g.builds = [b, {}];

  g = H.fx(H.execute(g, swab, "ally", 0, {}), (f, n) => f.resolveStack(n));
  assert.equal(g.sides[0].board[0].spent, true, "the attack taps it");
  assert.equal(g.sides[1].hp, 13, "and lands for 7");

  g = H.execute(g, piece.powCard, "hero", 0, {});
  assert.ok(g.prompt && g.prompt.tag === "pick", "the ability must ask which ally");
  g = H.fx(g, (f, n) => f.applyAnswer(n, {...n.prompt, sel: [0]}));
  assert.equal(g.sides[0].board[0].spent, false, "untapped");
  assert.equal(g.sides[0].board[0].sd, "end", "and carrying the printed clock");

  g = H.fx(H.execute(g, swab, "ally", 0, {}), (f, n) => f.resolveStack(n));
  assert.equal(g.sides[1].hp, 6, "the SECOND attack lands — 14 from one ally in a turn");
});

test("a dead tap is refused by name, not opened as an empty sheet", {skip}, () => {
  H.db();
  /* v3.39's rule: an ability with nothing to choose says so rather than
     spending its cost and showing a sheet whose only exit is Cancel. */
  let g = H.state({res: 9, ap: 2, board: []}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = H.runOps(g, [["untapAlly", 1, {sd: "end"}]], "Scuttle Toes");
  assert.ok(!out.prompt && !(out.promptQ || []).length, "no sheet with nothing to pick");
  assert.ok((out.feed || []).some(m => /controls no ally/i.test(m)), "and it says why");
});

/* ---- 4. THE CHAIN CLOSES ON THE DEATH TRIGGER ------------------------ */

test("the sweep destroys the stamped ally, and a destroyed ally has DIED", {skip}, () => {
  H.db();
  /* "Destroy" and "dies" are the same event for a living object, so
     Oysten's "when this dies, create a Gold token" fires here — the whole
     point of the interaction, and it needed v3.46's reader plus this
     version's clock to be reachable at all. */
  P.fxReset();
  const oy = H.card("Oysten, Heart of Gold", 2);
  let g = H.state({board: [{card: oy, kind: "ally", uid: oy.uid, spent: false, life: 1, sd: "end"}]},
                  {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const sw = E.sweepArena(g, 0, "end");
  assert.deepEqual(sw.game.sides[0].board, [], "the ally is destroyed");
  assert.deepEqual(sw.ops, [["token", "gold", 1, "self"]], "and its death trigger pays out");
});

test("an AURA on the same clock is destroyed but does not DIE", {skip}, () => {
  /* "Dies" is printed about a LIVING object. Reading the trigger off
     anything that happened to print one would be inventing a rule the CR
     does not have, so the gate is `isAlly` rather than the op's presence. */
  P.fxReset();
  const fake = {name: "untap drill aura", pitch: 0, tt: "Generic Aura", kw: [],
    tx: "When this dies, create a Gold token."};
  let g = H.state({board: [{card: fake, kind: "token", uid: "t1", spent: false, sd: "end"}]},
                  {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  assert.deepEqual(E.sweepArena(g, 0, "end").ops, []);
});

/* ---- 5. THE SPEC FIELD SURVIVES buildPrompt -------------------------- */

test("untapStamp reaches the sheet — a spec only carries fields it knows", {skip}, () => {
  /* The `arsStamp` lesson (v2.34): a field `buildPrompt` has never heard
     of is dropped in silence, and the drawback simply never lands. */
  const PM = require("../engine/prompts.js");
  const swab = H.card("Swabbie", 2);
  const p = PM.buildPrompt(H.state({}, {}, {turn: 3, actor: 0}),
                           {tag: "pick", side: 0, src: "drill", cards: [swab],
                            min: 1, max: 1, untapStamp: {sd: "end"}});
  assert.ok(p, "the sheet must open");
  assert.deepEqual(p.untapStamp, {sd: "end"});
});
