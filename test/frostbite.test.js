/* ============================================================
   FROSTBITE — a number on the screen, given a rule. (v2.74)

   Until this version `frost` was an integer on the side that NOTHING
   read. `effCost` did not see it, effects.js never mentioned it, and the
   only writer in the whole project was one hardcoded line in
   `foeTurnIce`. Frost Spike's "create a Frostbite token" resolved to a
   `noop` whose stated reason — "frostbite — dummy pays no costs" — was a
   fact about the training prop, not about the rules, and it expired in
   v2.71 when seat 1 got a real turn with a real action point.

   A `noop` counts as ACCOUNTED FOR, so Frost Spike and Polar Cap both
   reported tier `full` while creating nothing at all. No coverage tool in
   this project could see that, by construction.

   THE PRINTED TOKEN IS THE SPEC, verbatim:

     Frostbite — "Elemental Token - Aura"
     "Cards and abilities cost you an additional {r} to play or activate.
      At the beginning of your end phase or when you play a card or
      activate an ability, destroy Frostbite."

   RULINGS (user):
     2026-08-10  it taxes ONE play or activation and is then destroyed —
                 so the play that destroys it IS the one that is taxed.
     2026-08-14  three Frostbites make one play cost +3 and all three
                 shatter on it; and a Frostbite is handed to the OPPONENT,
                 landing in an exposed armour zone only where the card
                 prints that placement — with no exposed zone it fizzles,
                 which makes Frost Spike weaker than a plain create.

   EVERY ASSERTION HERE IS ON STATE — board contents, resources, hand
   sizes. Two of v2.45's nine bugs lived under drills that read the log
   while the engine did the wrong thing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const GM = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";

let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const tok = nm => C.resolveEntry(DB(), {name: nm, p: 0, code: null, q: 1});
/* A Frostbite as it sits on a board — built from the DATABASE record, never
   described here, so a drill can never pass against an invented token. */
const frostEntry = (i) => {
  const t = tok("Frostbite");
  return {card: {...t, uid: "fb" + i}, kind: "token", spent: false, uid: "fb" + i};
};

function ctx(over){
  return Object.assign({
    L: (s, m) => ({...s, log: [m, ...(s.log || [])], feed: [...(s.feed || []), m]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => ({runeDmg: 1}), bFoe: () => ({runeDmg: 1}), built: {runeDmg: 1},
    db: DB(),
    /* HANDOFF: a dummyDefence stub must return {n, note} — the moment a
       drill drives `execute` rather than `runOps`, the bare state reads
       `undefined.log` and dies. */
    dummyDefence: s => ({n: s, note: ""}),
    foe: s => s.sides[1 - (s.actor || 0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s, openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "action", winCheck: s => s
  }, over || {});
}
const side = o => Object.assign({
  name: "you", hp: 20, res: 9, ap: 1, amp: 0, ward: 0, awd: 0, buffNext: 0, buffQ: [],
  hand: [], deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], gear: [],
  counters: {}, weaponUsed: {}, hist: {}
}, o || {});
const game = (a, b) => ({sides: [side(a), side(b)], actor: 0, turn: 2,
  log: [], feed: [], chain: [], hitSeq: 0, rng: RNG.make("frost")});

/* ---- THE TAX ---------------------------------------------------------- */

test("frostCount is derived off the BOARD — there is no `frost` field", {skip}, () => {
  const S = require("../engine/sides.js");
  const sd = S.makeSide({});
  assert.equal(sd.frost, undefined,
    "a bare integer beside the board is a second source of truth for the same fact, and " +
    "while it existed nothing read it — not effCost, not effects.js");
  assert.equal(P.frostCount(sd), 0);
  assert.equal(P.frostCount({board: [frostEntry(1), frostEntry(2)]}), 2);
});

test("a Frostbite is an AURA, so the generic aura questions can finally see it", {skip}, () => {
  const t = tok("Frostbite");
  assert.ok(t.resolved, "resolved from the database — never invented");
  assert.match(t.tt || "", /aura/i, "the printed type line says Aura");
  const sd = {board: [frostEntry(1)]};
  assert.equal(P.auraCount(sd), 1,
    "'if you control 3 or more auras' and 'destroy an aura you control' were blind to it " +
    "for as long as it was an integer — the same blindness the v2.23 runechant move fixed");
  assert.equal(P.isFrostbite(frostEntry(1)), true);
  assert.equal(P.isFrostbite({card: tok("Runechant")}), false, "and it is not a Runechant");
});

test("effCost charges an additional {r} PER Frostbite", {skip}, () => {
  const c = {cost: 2, tx: "", tt: "Wizard Action"};
  assert.equal(P.effCost(c, side({board: []})), 2, "no Frostbite, printed cost");
  assert.equal(P.effCost(c, side({board: [frostEntry(1)]})), 3);
  assert.equal(P.effCost(c, side({board: [frostEntry(1), frostEntry(2), frostEntry(3)]})), 5,
    "RULING 2026-08-14: three Frostbites tax one play by three");
  assert.equal(P.effCost({cost: 0}, side({board: [frostEntry(1)]})), 1,
    "a free card is not free while you are frostbitten");
});

test("a cost REDUCTION cannot eat the Frostbite tax", {skip}, () => {
  /* The floor belongs to the reduction, not to the whole expression. A
     reduction that overshoots must not bank the difference and cancel a
     tax — that would make Frostbite vanish on precisely the cheap cards
     Iyslander plays it against. */
  const c = {cost: 1, tx: "This costs {r} less to play for each Runechant you control.",
             tt: "Wizard Action"};
  const rune = i => ({card: {...tok("Runechant"), uid: "rc" + i}, kind: "aura", spent: false, uid: "rc" + i});
  const sd = side({board: [rune(1), rune(2), rune(3), frostEntry(9)]});
  assert.equal(P.effCost(c, sd), 1,
    "cost 1, three runechants of reduction, one Frostbite: the reduction floors at 0 and the tax adds 1");
});

/* ---- THE DESTRUCTION -------------------------------------------------- */

test("the play that DESTROYS a Frostbite is the play that is TAXED", {skip}, () => {
  const {execute} = E.makeEffects(ctx());
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const g = game({res: 9, hand: [c], board: [frostEntry(1)]});
  const out = execute(g, c, "hand", 0);
  assert.equal(P.frostCount(out.sides[0]), 0, "the Frostbite is destroyed by the play");
  assert.equal(out.sides[0].res, 9 - printed - 1,
    "RULING 2026-08-10: it taxes the very play that destroys it. Destroying first would " +
    "make Frostbite a permanent that reads as a tax and costs nothing.");
});

test("three Frostbites tax ONE play by three and ALL of them shatter on it", {skip}, () => {
  const {execute} = E.makeEffects(ctx());
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const g = game({res: 12, hand: [c], board: [frostEntry(1), frostEntry(2), frostEntry(3)]});
  const out = execute(g, c, "hand", 0);
  assert.equal(out.sides[0].res, 12 - printed - 3, "+3 on the one play");
  assert.equal(P.frostCount(out.sides[0]), 0,
    "each token carries its own copy of the destroy trigger and they all fire on the same play");
});

test("a Frostbite the OPPONENT controls does not tax YOUR play", {skip}, () => {
  const {execute} = E.makeEffects(ctx());
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const g = game({res: 9, hand: [c], board: []}, {board: [frostEntry(1)]});
  const out = execute(g, c, "hand", 0);
  assert.equal(out.sides[0].res, 9 - printed, "the printed cost, untaxed");
  assert.equal(P.frostCount(out.sides[1]), 1,
    "and theirs survives — it says 'cost YOU an additional {r}', so it is the controller who pays");
});

/* ---- WHOSE BOARD IT LANDS ON ------------------------------------------ */

test("Polar Cap's 'under their control' puts it on the OPPONENT's board", {skip}, () => {
  const {runOps} = E.makeEffects(ctx());
  const ops = P.classifyClause("create a frostbite token under their control").ops;
  const out = runOps(game({}, {}), ops, "Polar Cap");
  assert.equal(P.frostCount(out.sides[1]), 1, "on theirs");
  assert.equal(P.frostCount(out.sides[0]), 0, "not on yours — it is a tax you hand them");
});

test("Frost Spike lands in an EXPOSED armour zone, on the opponent", {skip}, () => {
  const {runOps} = E.makeEffects(ctx());
  const spike = tok("Frost Spike");
  assert.match(P.clean(spike.tx || ""), /exposed head, chest, arms, or legs zone/i,
    "fixture drifted — Frost Spike must still print the exposed-zone placement");
  const ops = P.fxParse(spike).ops.filter(o => o[0] === "token");
  assert.deepEqual(ops, [["token", "frostbite", 1, "foe", {zone: "exposed"}]],
    "the placement rides in the op as DATA — no card is named in the wiring");
  /* a hero wearing nothing has four exposed zones */
  const out = runOps(game({}, {gear: []}), ops, "Frost Spike");
  assert.equal(P.frostCount(out.sides[1]), 1);
});

test("Frost Spike FIZZLES against a fully armoured hero — the placement is a WEAKNESS", {skip}, () => {
  const {runOps} = E.makeEffects(ctx());
  const ops = P.fxParse(tok("Frost Spike")).ops.filter(o => o[0] === "token");
  const armoured = [
    {name: "H", tt: "Generic Equipment - Head", uid: "g1"},
    {name: "C", tt: "Generic Equipment - Chest", uid: "g2"},
    {name: "A", tt: "Generic Equipment - Arms", uid: "g3"},
    {name: "L", tt: "Generic Equipment - Legs", uid: "g4"}
  ];
  assert.equal(GM.hasExposedZone({gear: armoured}), false, "all four zones are covered");
  const out = runOps(game({}, {gear: armoured}), ops, "Frost Spike");
  assert.equal(P.frostCount(out.sides[1]), 0,
    "RULING 2026-08-14: with no exposed zone the card simply fizzles. An ungated token " +
    "would be strictly STRONGER than printed, which is the direction that steals games.");
  /* and the same card against a hero missing one piece DOES land, so the
     drill cannot pass by the op being broken outright */
  const out2 = runOps(game({}, {gear: armoured.slice(0, 3)}), ops, "Frost Spike");
  assert.equal(P.frostCount(out2.sides[1]), 1, "one bare leg is all it needs");
});

test("a DESTROYED piece leaves its zone exposed", {skip}, () => {
  const armoured = [
    {name: "H", tt: "Generic Equipment - Head", uid: "g1"},
    {name: "C", tt: "Generic Equipment - Chest", uid: "g2"},
    {name: "A", tt: "Generic Equipment - Arms", uid: "g3"},
    {name: "L", tt: "Generic Equipment - Legs", uid: "g4", destroyed: true}
  ];
  assert.deepEqual(GM.exposedZones({gear: armoured}), ["legs"],
    "equipment WEARS rather than leaving, so a destroyed piece still sits in sd.gear — " +
    "read the flag or a hero who has lost every piece still reports a full set of armour");
});

/* ---- WHAT IS DELIBERATELY NOT BUILT ----------------------------------- */

test("Ice Eternal's X is REFUSED, not quietly read as one", {skip}, () => {
  const ie = tok("Ice Eternal");
  assert.equal(ie.cost, null, "its printed cost is XX — nothing here models an X cost");
  const r = P.classifyClause("create x frostbite tokens under target hero's control");
  assert.equal(r, null,
    "reading X as 1 would create ONE Frostbite for a card that charges for X of them: " +
    "quietly WEAKER than printed, the direction the fairness sweep is one-sided against " +
    "and coverage reads as `full` because the clause was consumed. It stays a visible gap.");
  assert.ok(!P.fxParse(ie).ops.some(o => o[0] === "token"),
    "so the card creates nothing at all rather than the wrong thing");
});

/* ---- THE OTHER EXPIRY ------------------------------------------------- */

/* THIS DRILL WAS WRITTEN AS A SOURCE SCAN FIRST AND IT PROVED NOTHING.
   It grepped `endPhaseCF` for `isFrostbite`; the sabotage neutered the
   gate with `const thawed = 0;` and the identifier sat there inside the
   dead block, so the drill stayed GREEN against code that never thawed
   anything. That is HANDOFF rule 4b verbatim — a grep is satisfied by
   what survives deleting the gate. The rule was extracted to a pure
   `DawnEffects.thawFrost` so it can be DRIVEN instead. */
test("the end-phase thaw destroys that SEAT's Frostbites and nobody else's", {skip}, () => {
  const g = game({board: [frostEntry(1), frostEntry(2)]},
                 {board: [frostEntry(3)]});
  const out = E.thawFrost(g, 0);
  assert.equal(out.thawed, 2, "both of seat 0's thaw");
  assert.equal(P.frostCount(out.game.sides[0]), 0);
  assert.equal(P.frostCount(out.game.sides[1]), 1,
    "it says 'at the beginning of YOUR end phase' — the other seat's are untouched");
});

test("thawFrost leaves a board with no Frostbite completely alone", {skip}, () => {
  const rune = {card: tok("Runechant"), kind: "aura", spent: false, uid: "rc1"};
  const g = game({board: [rune]});
  const out = E.thawFrost(g, 0);
  assert.equal(out.thawed, 0);
  assert.equal(out.game, g, "an untouched game is returned by identity — no needless clone");
  assert.equal(out.game.sides[0].board.length, 1, "and the Runechant survives the end phase");
});

test("thawFrost returns {game, thawed}, not a bare game", {skip}, () => {
  /* `resetAllyLife` returns THE GAME, and the CR review found a call site
     reading `out.game` off it and falling back to the unchanged state — so
     CR 4.4.3a ran only in the log for several versions. Pin the shape. */
  const out = E.thawFrost(game({board: [frostEntry(1)]}), 0);
  assert.ok(out.game && out.game.sides, "carries the game under a named key");
  assert.equal(typeof out.thawed, "number");
  assert.ok(!out.sides, "and is NOT the game itself, which is how that bug read as working");
});

test("the trainer's SHARED end phase actually calls it", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  /* Strip comments first — this file is full of prose about Frostbite and
     a grep is satisfied by a comment in both directions. */
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const m = code.match(/function endPhaseCF\(s, si\)\{[\s\S]{0,1200}/);
  assert.ok(m, "endPhaseCF moved — re-anchor this drill");
  assert.match(m[0], /DawnEffects\.thawFrost\(n, si\)/,
    "the thaw must sit in endPhaseCF, which BOTH seats reach (yours via afterArsenal, " +
    "seat 1's via foeEnd). Two copies of one expiry is the shape that let clash fire on " +
    "the wrong trigger for five versions.");
  assert.match(m[0], /n = _fb\.game;/,
    "and the result must be taken UNCONDITIONALLY — a gated call is a gate a sabotage " +
    "can switch off while leaving this identifier sitting in the source");
  /* Both seats reach it: pin the two callers rather than trusting the prose. */
  assert.match(code, /endPhaseCF\(s, 0\)/, "your end phase");
  assert.match(code, /endPhaseCF\(n, 1\)/, "seat 1's end phase");
});

test("the hero ability mints a real token, not a counter", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const m = code.match(/function foeTurnIce\(n, c\)\{[\s\S]*?\n  \}/);
  assert.ok(m, "foeTurnIce moved — re-anchor this drill");
  assert.ok(!/\.frost\b/.test(m[0]),
    "the one hardcoded `frost++` in the project lived here and incremented a number nothing read");
  assert.match(m[0], /runOps\([\s\S]*token[\s\S]*Frostbite/,
    "it goes through the same token op every card uses, so the token is RESOLVED from the " +
    "database rather than described — the golden rule at the hero-ability level");
});
