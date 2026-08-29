/* test/endphase.test.js — CR 4.4.2, THE BEGINNING OF THE END PHASE (v3.17)
 *
 * The event that fires before the ordered (a)-(f) procedure, and the drills
 * that would have caught three rules living on ONE board.
 *
 * `tools/crindex.js` is what pointed here. It ranks every CR rule this
 * project cites by whether a DRILL cites it too, and CR 4.1.8a came back
 * UNGUARDED: cited in `judge.js` and in `index.html`, in a comment claiming
 * that both boards deliberately run these triggers in the SAME ORDER so
 * they cannot disagree — a claim about behaviour, pinned by nothing.
 *
 * Reading the two call sites to check it turned up something worse than a
 * disagreement about order. THREE beginning-of-end-phase events were not in
 * the shared body at all. They sat inline in the trainer's `endTurn`,
 * written against `you(n)`, so they ran for seat 0 on one board:
 *
 *   rust destruction      Talishar prints its own death at 3 counters and
 *                         swung on past it forever at the table
 *   the idle counter wipe Dawnblade keeps the +{p} counters it prints to
 *                         lose on a turn it never connects
 *   intimidate's return   a card banished face-down never came back — a
 *                         permanent theft, which is v2.10's bug exactly
 *
 * All three fail STRONGER than printed. None was visible to any card-level
 * tool: two are consumed by ops and the third was a NOOP whose stated
 * reason named the trainer's end phase, which is v3.16's shape one level up.
 *
 * ASSERT ON GEAR, COUNTERS AND HANDS — never on the feed's prose. The one
 * message assertion here is deliberate and is about which of TWO readers of
 * one rule gets to speak; it pins the order, not the wording. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* a Sword that prints the rust clause, built from the printed line so the
   threshold under test is the CARD's number and not this drill's */
const RUSTER = (n, uid) => ({
  name: "Ruster " + uid, tt: "Generic Weapon - Sword (2H)", pitch: 0, uid,
  power: 4, tx: "**Once per Turn Action** - {r}{r}, put a rust counter on this: **Attack**\n\n"
      + "At the beginning of your end phase, if this has " + n + " or more rust counters, destroy it.",
  kw: []
});

/* ---- the parser reads the card's own number ------------------------- */

test("the rust threshold is the CARD's printed number, not a literal 3", () => {
  P.fxReset();
  assert.equal(P.fxParse(RUSTER(3, "r3")).rustDestroy, 3);
  assert.equal(P.fxParse(RUSTER(5, "r5")).rustDestroy, 5,
    "a piece printing 5 must not shatter at 3 — the noop this replaced said " +
    "'the end phase already destroys it at 3 counters', which was a claim about " +
    "another board's inline filter rather than about this card");
});

test("rustedThrough compares each piece against ITS OWN threshold", () => {
  P.fxReset();
  const gear = [RUSTER(3, "a"), RUSTER(5, "b")];
  assert.deepEqual(P.rustedThrough(gear, {a: {rust: 3}, b: {rust: 3}}), ["a"],
    "at 3 counters the 3-piece shatters and the 5-piece does not");
  assert.deepEqual(P.rustedThrough(gear, {a: {rust: 5}, b: {rust: 5}}).sort(), ["a", "b"]);
  assert.deepEqual(P.rustedThrough(gear, {a: {rust: 2}, b: {rust: 4}}), [],
    "under threshold, nothing shatters");
  assert.deepEqual(P.rustedThrough([{...RUSTER(3, "c"), destroyed: true}], {c: {rust: 9}}), [],
    "an already-destroyed piece is not shattered twice");
});

test("a piece with no rust clause never rusts through, however many counters", () => {
  P.fxReset();
  const plain = {name: "Plain Blade", tt: "Generic Weapon - Sword", pitch: 0, uid: "p", power: 3, tx: "", kw: []};
  assert.deepEqual(P.rustedThrough([plain], {p: {rust: 99}}), [],
    "the schedule is the CARD's, so a piece that prints none has none");
});

/* ---- the event, at the table -------------------------------------- */

test("CR 4.4.2 — rust shatters the piece at the beginning of the end phase", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[0].gear = [RUSTER(3, "sw")];
  g.sides[0].counters = {sw: {rust: 3}};

  const out = E.beginEndPhase(g, 0);
  /* THE PIECE IS NOW FILED, NOT FLAGGED IN PLACE (v3.53). RULING (user,
     2026-08-29): destroyed gear goes to the graveyard, as the CR says of
     any destroyed permanent. This drill used to read `gear[0].destroyed`,
     which is the OLD model — the assertion is stronger now, because "it
     left the gear zone AND arrived in the graveyard" is a claim that a
     flag set in place cannot satisfy. */
  assert.equal(out.game.sides[0].gear.length, 0,
    "Talishar prints its own death; at the table it swung on past it forever");
  const gv = out.game.sides[0].grave;
  assert.equal(gv.length, 1, "and the shattered piece is in the graveyard");
  assert.equal(gv[0].uid, "sw");
  assert.equal(gv[0]._gy, g.turn,
    "turn-stamped like every other path into the graveyard, or the " +
    "'…this turn' family goes quietly wrong");
});

test("…and only at ITS controller's end phase", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[1].gear = [RUSTER(3, "sw")];
  g.sides[1].counters = {sw: {rust: 3}};

  const other = E.beginEndPhase(g, 0).game.sides[1];
  assert.equal(other.gear.length, 1,
    "seat 1's piece must not shatter on seat 0's end phase — the clause reads " +
    "'YOUR end phase', and a seat-relative body is the whole point");
  assert.ok(!other.gear[0].destroyed);
  assert.ok(!(other.grave || []).length, "and it must not be filed either");

  const own = E.beginEndPhase(g, 1).game.sides[1];
  assert.equal(own.gear.length, 0, "on its OWN controller's end phase it shatters");
  assert.equal(own.grave[0].uid, "sw", "and is filed to that seat's graveyard");
});

test("under the threshold the piece survives — the drill above is not passing by finding nothing", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[0].gear = [RUSTER(3, "sw")];
  g.sides[0].counters = {sw: {rust: 2}};
  const out = E.beginEndPhase(g, 0);
  assert.ok(!out.game.sides[0].gear[0].destroyed);
  assert.equal(out.game.sides[0].gear.length, 1, "and it is still equipped");
  assert.ok(!(out.game.sides[0].grave || []).length, "and not in the graveyard");
});

/* ---- the idle counter wipe ------------------------------------------ */

const BLADE = uid => ({
  name: "Idle Blade " + uid, tt: "Warrior Weapon - Sword (1H)", pitch: 0, uid, power: 3,
  tx: "The first time this hits each turn, put a +1{p} counter on it.\n\n"
    + "At the beginning of your end phase, if this hasn't hit this turn, remove all +1{p} counters from it.",
  kw: []
});

test("CR 4.4.2 — a blade that never connected loses its counters", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[0].gear = [BLADE("bl")];
  g.sides[0].counters = {bl: {pow: 2}};
  g.sides[0].hist = {wpnHits: {}};

  const out = E.beginEndPhase(g, 0);
  assert.equal(out.game.sides[0].counters.bl.pow, 0,
    "the clause is the only thing that removes them, which is what makes an " +
    "idle turn cost something");
});

test("…and a blade that DID connect keeps them", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[0].gear = [BLADE("bl")];
  g.sides[0].counters = {bl: {pow: 2}};
  g.sides[0].hist = {wpnHits: {bl: 1}};

  assert.equal(E.beginEndPhase(g, 0).game.sides[0].counters.bl.pow, 2,
    "RULING (user, 2026-08-09): the counters PERSIST across turns");
});

test("the wipe is seat-relative too", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[1].gear = [BLADE("bl")];
  g.sides[1].counters = {bl: {pow: 2}};
  g.sides[1].hist = {wpnHits: {}};

  assert.equal(E.beginEndPhase(g, 0).game.sides[1].counters.bl.pow, 2,
    "seat 1's blade is not wiped on seat 0's end phase");
  assert.equal(E.beginEndPhase(g, 1).game.sides[1].counters.bl.pow, 0);
});

/* ---- intimidate returns -------------------------------------------- */

test("CR 4.4.2 — intimidate is a one-turn tax, not a theft", () => {
  const g = H.state([], [], {});
  const stolen = {name: "Taken", tt: "Generic Action - Attack", pitch: 1, uid: "tk", power: 4, tx: "", kw: []};
  g.sides[1].hand = [];
  g.sides[1].intimidated = [stolen];

  const out = E.beginEndPhase(g, 0);
  assert.deepEqual((out.game.sides[1].hand || []).map(c => c.uid), ["tk"],
    "the card comes back at the beginning of the end phase. At the table it " +
    "never did — v2.10 fixed exactly this and it returned on the board nobody " +
    "had checked");
  assert.deepEqual(out.game.sides[1].intimidated, [],
    "and the pile must EMPTY, or the card is in two zones next turn");
});

test("the return does not disturb the rest of the hand", () => {
  const g = H.state([], [], {});
  const held = {name: "Held", tt: "Generic Action - Attack", pitch: 1, uid: "h1", power: 3, tx: "", kw: []};
  const stolen = {name: "Taken", tt: "Generic Action - Attack", pitch: 1, uid: "tk", power: 4, tx: "", kw: []};
  g.sides[1].hand = [held];
  g.sides[1].intimidated = [stolen];

  const hand = (E.beginEndPhase(g, 0).game.sides[1].hand || []).map(c => c.uid);
  assert.equal(hand.length, 2);
  assert.ok(hand.indexOf("h1") >= 0 && hand.indexOf("tk") >= 0);
});

test("nothing is stranded: a pile on either seat is swept", () => {
  /* An attack is declared by the turn-player, so only the OTHER seat can be
     holding anything here. Both are swept anyway — a card face-down in a
     zone nothing empties is one the census keeps finding and the player
     never gets back. */
  const g = H.state([], [], {});
  g.sides[0].hand = []; g.sides[1].hand = [];
  g.sides[0].intimidated = [{name: "A", tt: "Generic Action - Attack", pitch: 1, uid: "a", power: 1, tx: "", kw: []}];
  g.sides[1].intimidated = [{name: "B", tt: "Generic Action - Attack", pitch: 1, uid: "b", power: 1, tx: "", kw: []}];

  const out = E.beginEndPhase(g, 0);
  assert.deepEqual(out.game.sides[0].intimidated, []);
  assert.deepEqual(out.game.sides[1].intimidated, []);
  assert.equal(out.game.sides[0].hand.length, 1);
  assert.equal(out.game.sides[1].hand.length, 1);
});

/* ---- the no-mirror rule, for this event ---------------------------- */

test("the trainer holds NO beginning-of-end-phase rule of its own", () => {
  /* Comments stripped: this file is full of prose about exactly these
     three rules, and a grep is satisfied by a comment in both directions.
     Same discipline as the frostbite call-site drill. */
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /* ANCHOR TO THE PAYLOAD, NOT THE WORD — v3.16's lesson, and this drill
     needed it on its first run. The trainer legitimately still says
     "rust": `.cc.rust` styles the counter chip, the chip renderer reads
     `ct.rust` to draw it, and Dorinthea's list contains Valiant *Thrust*.
     What must be gone is the DESTRUCTION. */
  assert.ok(!/rust[^;\n]{0,80}destroyed|destroyed[^;\n]{0,80}rust/i.test(code),
    "the rust filter was inline in `endTurn` against `you(n)` with a literal 3; " +
    "the destruction belongs to `effects.beginEndPhase`, which both boards call");
  assert.ok(!/idleCounterWipes\(/.test(code),
    "so does the idle counter wipe — no CALL to it survives here");
  assert.ok(!/intimidated/.test(code),
    "so does intimidate's return");
  assert.match(code, /DawnEffects\.beginEndPhase\(s, si\)/,
    "and the trainer's `beginEndPhase` must DELEGATE to it");
});

test("judge.js calls the shared body rather than restating the event", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /E\.beginEndPhase\(n, seat\)/);
  assert.ok(!/E\.resolveInertia\(/.test(code),
    "Inertia is inside the shared body now — reaching for it here is the second " +
    "caller growing its own copy of the order, which is what CR 4.1.8a's comment " +
    "promised would not happen and nothing checked");
  assert.ok(!/E\.thawFrost\(/.test(code));
  assert.ok(!/E\.sweepArena\(n, seat, "end"\)/.test(code));
});

test("the ORDER is one description — CR 4.1.8a's claim, finally pinned", () => {
  /* The rule this engine does not model is the turn-player's CHOICE of
     order among simultaneous triggers. What it must not do is have two
     boards make that choice separately. Inertia leads because it is itself
     an aura and the sweep would otherwise race it for the same entry. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = src.indexOf("function beginEndPhase(game, seat){");
  assert.ok(i > 0, "beginEndPhase moved — re-anchor this drill");
  const body = src.slice(i, src.indexOf("\nfunction ", i + 10));
  assert.ok(body.length > 400, "the slice must actually contain the body");

  const at = s => body.indexOf(s);
  assert.ok(at("resolveInertia(") > 0 && at("thawFrost(") > 0
         && at("rustedThrough(") > 0 && at("idleCounterWipes(") > 0
         && at("sweepArena(") > 0, "all six steps must be here");
  assert.ok(at("resolveInertia(") < at("thawFrost("),
    "Inertia first — it is an aura, and the sweep would race it");
  assert.ok(at("thawFrost(") < at("sweepArena("),
    "the SPECIFIC reader before the generic one: Frostbite prints 'at the " +
    "beginning of your end phase, destroy this', so it carries sd:'end' and " +
    "the sweep would take it silently");
});

/* ---- the TABLE actually reaches it, with real iron ------------------ */

const skip = !H.hasDb() && "no cached card database";
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const C = require("../engine/cards.js");
const { loadData, cardDbPath } = require("./helpers/extract");
const W = loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(cardDbPath(), "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

test("driven: Dash's Talishar shatters at the table, through judge.reduce", {skip}, () => {
  /* The drills above call `beginEndPhase` directly, which proves the body
     is right and says nothing about whether the reducer REACHES it. This
     one drives the real turn structure over Dash's real gear — Talishar,
     the Lost Prince is the pool's only ruster and it is his. */
  const db = DB();
  const hero = W.HEROES.find(h => /dash/i.test(h.n));
  assert.ok(hero, "Dash left the roster — re-anchor this drill");
  const ctr = {n: 0};
  let rng = RNG.make("rust-drive");
  const b0 = B.buildSideDefault(hero, G.parseDeck(W.DECKS[hero.k]), db, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(hero, G.parseDeck(W.DECKS[hero.k]), db, rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [hero.n, hero.n],
                      heroKeys: [hero.k, hero.k], rng, first: 0, tokSeq: ctr.n});

  const tal = (g.sides[0].gear || []).find(x => /Talishar/.test(x.name));
  assert.ok(tal, "Dash must be carrying Talishar — if his gear changed, re-anchor this");
  assert.equal(P.fxParse(tal).rustDestroy, 3, "off the printed line, not this drill's number");

  /* stand it at the threshold, then end the turn through the reducer */
  g = {...g, sides: g.sides.map((sd, i) => i !== 0 ? sd
        : {...sd, counters: {...(sd.counters || {}), [tal.uid]: {rust: 3}}})};

  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;

  /* IT LEAVES THE GEAR ZONE FOR THE GRAVEYARD (v3.53). This assertion used
     to read "the piece must still be IN the gear list — destroyed, not
     vanished", which was the old model: gear was flagged in place and
     never filed anywhere. RULING (user, 2026-08-29) made it CR-accurate,
     and this drill is the one that proves the REDUCER reaches it rather
     than only that the body is right. */
  assert.ok(!(n.sides[0].gear || []).some(x => x.uid === tal.uid),
    "the shattered piece leaves the gear zone");
  const filed = (n.sides[0].grave || []).find(x => x.uid === tal.uid);
  assert.ok(filed,
    "the table ran no beginning-of-end-phase rule of its own until v3.17, so " +
    "Talishar accrued counters forever and swung on past the death it prints — " +
    "and until v3.53 the death filed it nowhere");
  assert.ok(filed._gy != null,
    "turn-stamped like every other path into the graveyard, or the " +
    "'…this turn' family goes quietly wrong");
});

test("driven: and a Talishar under the threshold survives the same end phase", {skip}, () => {
  const db = DB();
  const hero = W.HEROES.find(h => /dash/i.test(h.n));
  const ctr = {n: 0};
  let rng = RNG.make("rust-drive");
  const b0 = B.buildSideDefault(hero, G.parseDeck(W.DECKS[hero.k]), db, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(hero, G.parseDeck(W.DECKS[hero.k]), db, rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [hero.n, hero.n],
                      heroKeys: [hero.k, hero.k], rng, first: 0, tokSeq: ctr.n});
  const tal = (g.sides[0].gear || []).find(x => /Talishar/.test(x.name));
  g = {...g, sides: g.sides.map((sd, i) => i !== 0 ? sd
        : {...sd, counters: {...(sd.counters || {}), [tal.uid]: {rust: 2}}})};

  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;

  assert.ok(!(n.sides[0].gear || []).find(x => x.uid === tal.uid).destroyed,
    "two counters is not three — without this the drill above passes against " +
    "a body that shatters every piece it looks at");
});
