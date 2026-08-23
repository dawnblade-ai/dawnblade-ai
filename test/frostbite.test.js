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

   DRIVEN THROUGH `judge.reduce` (v2.80). The tax is charged when a card is
   PLAYED, so a drill that calls `execute` with a hand-rolled context is
   asserting about a payment nobody made — it never passed through
   `legal`, never opened a `pending`, and the resources it spent were the
   fixture's rather than the player's. `play()` below taps the card.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const GM = require("../engine/game.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const tok = nm => H.tok(nm);
/* A Frostbite as it sits on a board — built from the DATABASE record, never
   described here, so a drill can never pass against an invented token. */
const frostEntry = (i) => {
  const t = tok("Frostbite");
  return {card: {...t, uid: "fb" + i}, kind: "token", spent: false, uid: "fb" + i};
};

const side = o => H.side(Object.assign({res: 9}, o || {}));
const game = (a, b) => H.state(Object.assign({res: 9}, a || {}),
                               Object.assign({res: 9}, b || {}), {seed: "frost"});
const runOps = (g, ops, src) => H.runOps(g, ops, src);

/* TAP THE CARD. The tax is charged at payment, so it is only real if it
   goes through `legal` and the reducer's own play path — `execute` called
   straight is a payment nobody made. */
function play(c, o){
  o = o || {};
  H.db();
  let g = H.state({res: o.res, hand: [c], board: o.board || [], gear: o.gear || []},
                  {board: o.foeBoard || []}, {actor: 0, turnPlayer: 0, seed: "frost"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, 0);
  assert.equal(out.error, null, "the play was refused: " + out.error);
  return out.state;
}

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
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const out = play(c, {res: 9, board: [frostEntry(1)]});
  assert.equal(P.frostCount(out.sides[0]), 0, "the Frostbite is destroyed by the play");
  assert.equal(out.sides[0].res, 9 - printed - 1,
    "RULING 2026-08-10: it taxes the very play that destroys it. Destroying first would " +
    "make Frostbite a permanent that reads as a tax and costs nothing.");
});

test("three Frostbites tax ONE play by three and ALL of them shatter on it", {skip}, () => {
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const out = play(c, {res: 12, board: [frostEntry(1), frostEntry(2), frostEntry(3)]});
  assert.equal(out.sides[0].res, 12 - printed - 3, "+3 on the one play");
  assert.equal(P.frostCount(out.sides[0]), 0,
    "each token carries its own copy of the destroy trigger and they all fire on the same play");
});

test("the tax reaches the resources through the REDUCER's own play path", {skip}, () => {
  /* Not the same statement as the `effCost` drill above: this one spends
     a player's resources by tapping a card, so it fails if the charge
     stops reaching them anywhere between `legal` and `execute`. */
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const frozen = play(c, {res: 9, board: [frostEntry(1)]});
  const clear  = play(c, {res: 9, board: []});
  assert.equal(clear.sides[0].res - frozen.sides[0].res, 1,
    "one Frostbite, one resource, charged where the player actually feels it");
});

test("a play the tax makes UNAFFORDABLE opens a payment instead of resolving free", {skip}, () => {
  /* `effCost` IS READ TWICE AND THE TWO READS ARE DIFFERENT QUESTIONS.
     `execute` charges the cost; `doPlay` asks whether the seat can afford
     it, and only that second read decides whether a payment opens. They
     are separate lines and nothing else in this file drives the second —
     verified by sabotage: replacing doPlay's `effCost` with the printed
     cost leaves every other drill here green and fails only this one.

     CR 8.x — an unaffordable play must not resolve for nothing. With the
     tax the cost is 3, and a hero holding 2 has to find the difference or
     abandon it. */
  const c = {...tok("Ice Bolt"), uid: "c1"};
  H.db();
  let g = H.state({res: 2, hand: [c, {uid: "p1", name: "a blue", pitch: 3}], board: [frostEntry(1)]},
                  {}, {actor: 0, turnPlayer: 0, seed: "frost"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "c1", from: "hand"}, 0);
  assert.equal(out.error, null);
  const p = J.pendingOf(out.state);
  assert.ok(p && p.kind === "pay", "the taxed cost opens a payment rather than resolving free");
  assert.equal(p.need, 3, "printed 2 plus the Frostbite's 1");
  assert.equal(P.frostCount(out.state.sides[0]), 1,
    "and nothing has shattered yet — the token is destroyed BY the play, which has not happened");
});

test("a Frostbite the OPPONENT controls does not tax YOUR play", {skip}, () => {
  const c = {...tok("Ice Bolt"), uid: "c1"};
  const printed = c.cost != null ? +c.cost : 0;
  const out = play(c, {res: 9, board: [], foeBoard: [frostEntry(1)]});
  assert.equal(out.sides[0].res, 9 - printed, "the printed cost, untaxed");
  assert.equal(P.frostCount(out.sides[1]), 1,
    "and theirs survives — it says 'cost YOU an additional {r}', so it is the controller who pays");
});

/* ---- WHOSE BOARD IT LANDS ON ------------------------------------------ */

test("Polar Cap's 'under their control' puts it on the OPPONENT's board", {skip}, () => {
  const ops = P.classifyClause("create a frostbite token under their control").ops;
  const out = runOps(game({}, {}), ops, "Polar Cap");
  assert.equal(P.frostCount(out.sides[1]), 1, "on theirs");
  assert.equal(P.frostCount(out.sides[0]), 0, "not on yours — it is a tax you hand them");
});

test("Frost Spike lands in an EXPOSED armour zone, on the opponent", {skip}, () => {
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

test("the end-phase thaw is DRIVEN by the shared beginning-of-end-phase body", {skip}, () => {
  /* REPOINTED IN v3.17, deliberately. This drill used to pin the call
     inside `endPhaseCF` and it was right to: two copies of one expiry is
     the shape that let clash fire on the wrong trigger for five versions.
     The expiry moved one step earlier, into `E.beginEndPhase`, because
     Frostbite prints "at the beginning of your end phase" and the arena
     sweep at the beginning was taking the token before the thaw could
     name it.

     And it is DRIVEN now rather than grepped. A source scan for
     `thawFrost` is satisfied by the identifier surviving, which says
     nothing about whether the token actually leaves the board. */
  const g = H.state([], [], {});
  const frost = {name:"Frostbite", tt:"Elemental Token - Aura",
                 tx:"Cards and abilities cost you an additional {r} to play or activate.\n\nWhen you play a card or activate an ability, destroy this.\n\nAt the beginning of your end phase, destroy this.",
                 pitch:0, uid:"fb1", kw:[]};
  g.sides[0].board = [{card:frost, kind:"token", spent:false, uid:"fb1", sd:"end"}];

  const out = E.beginEndPhase(g, 0);
  assert.equal((out.game.sides[0].board||[]).filter(P.isFrostbite).length, 0,
    "the Frostbite must be gone from the board at the beginning of the end phase");
  assert.ok(out.msgs.some(m => /Frostbite/.test(m) && /thaw/i.test(m)),
    "and the SPECIFIC line must be the one that speaks — the generic sweep line " +
    "('is destroyed at the beginning of the end phase') tells the player a token " +
    "left without telling them what it cost. Order the thaw before the sweep.");

  /* both seats reach it */
  const g2 = H.state([], [], {});
  g2.sides[1].board = [{card:{...frost, uid:"fb2"}, kind:"token", spent:false, uid:"fb2", sd:"end"}];
  assert.equal((E.beginEndPhase(g2, 1).game.sides[1].board||[]).filter(P.isFrostbite).length, 0,
    "seat 1's Frostbite thaws on seat 1's end phase");
  assert.equal((E.beginEndPhase(g2, 0).game.sides[1].board||[]).filter(P.isFrostbite).length, 1,
    "and NOT on seat 0's — the expiry is the controller's end phase, not any end phase");
});

/* ---- IYSLANDER'S CLAUSE 2, DRIVEN (v3.36) ---------------------------
   This was a SOURCE SCAN of `index.html` — it matched `function
   foeTurnIce(n, c)` and read the body for a `frost++`. Two things wrong
   with that, and the second is the reason it is being replaced rather
   than re-anchored:

     * the body LEFT that file in v3.36, and a source guard aimed at the
       wrong file passes by finding nothing. This one failed loudly,
       which is the lucky direction;
     * it never once asked whether the ability FIRES. A grep for
       `runOps(... token ... Frostbite)` is satisfied by a body gated on
       a condition that is never true — and that is exactly what the
       table had for three versions: the build carried `iceFrostbite`,
       the trainer had the body, and no route at the table called it.

   So it is driven now, and it pins the three gates the scan could not
   see: the hero, the turn, and the talent. */
const iysB   = {arsenalInstant: true,  iceFrostbite: true};
const plainB = {arsenalInstant: false, iceFrostbite: false};

/* Play a card with a given build, on a given turn-player, and count what
   landed on the OPPONENT'S board. */
function icePlay(c, build, turnPlayer){
  H.db();
  const g = H.state({res: 9, hand: [c]}, {},
                    {actor: 0, turnPlayer, turn: 3, builds: [build, {}], seed: "frost"});
  const n = H.execute(g, c, "hand", 0, {});
  return {
    game: n,
    frost: (n.sides[1].board || []).filter(P.isFrostbite).length
  };
}

test("clause 2 mints a REAL token under THEIR control, and only for her", {skip}, () => {
  const spike = H.card("Frost Spike", 3);          /* Ice Wizard Instant */
  assert.ok((spike.ty || []).some(t => /^ice$/i.test(t)),
    "fixture check: Frost Spike must carry the Ice talent in its structured array");

  /* Frost Spike's OWN text creates one; her ability adds a second. Pinning
     the difference rather than the total is what makes this a test of the
     ABILITY instead of a test of the card. */
  const own  = icePlay(spike, plainB, 1).frost;
  const hers = icePlay(spike, iysB,   1).frost;
  assert.equal(hers, own + 1,
    "Iyslander playing an Ice card on the opponent's turn creates one MORE Frostbite " +
    "than the same card played by anyone else — that difference is the hero ability");

  /* THE TOKEN IS RESOLVED FROM THE DATABASE, not described. A counter — the
     `frost++` this replaced — carries no text and no type, so it can never
     be counted as an aura, destroyed by "destroy an aura", or taxed. */
  const ent = (icePlay(spike, iysB, 1).game.sides[1].board || []).filter(P.isFrostbite).pop();
  assert.ok(ent && ent.card, "the ability put a board ENTRY there, not a number");
  assert.match(ent.card.tt || "", /aura/i, "and the entry is the printed Aura token");
  assert.match(ent.card.tx || "", /cost you an additional/i,
    "carrying its own printed rules text — which is what makes the tax real");
  assert.equal(H.state({}, {}, {}).sides[0].frost, undefined,
    "and no `frost` counter came back with it");
});

test("clause 2 is gated on the TURN and on the TALENT", {skip}, () => {
  const spike = H.card("Frost Spike", 3);            /* Ice     */
  const vein  = H.card("Aether Icevein", 3);         /* NOT Ice */
  assert.ok(!(vein.ty || []).some(t => /^ice$/i.test(t)),
    "fixture check: Aether Icevein is Elemental Wizard, not Ice — the discriminator " +
    "only bites if the control card genuinely lacks the talent");

  /* THE TURN. "During an opponent's turn" is the whole of what makes her
     slippery; fired on her own turn it would be a free Frostbite a turn. */
  assert.equal(icePlay(spike, iysB, 1).frost, icePlay(spike, plainB, 1).frost + 1,
    "on the OPPONENT'S turn it fires");
  assert.equal(icePlay(spike, iysB, 0).frost, icePlay(spike, plainB, 0).frost,
    "on HER OWN turn it must not — the clause names the opponent's turn");

  /* THE TALENT, read off `ty`. Aether Icevein is a blue non-attack she can
     play on their turn through clause 1, so it travels the identical route
     and differs only in the talent — which is the point. */
  assert.equal(icePlay(vein, iysB, 1).frost, icePlay(vein, plainB, 1).frost,
    "a non-Ice card played on their turn creates nothing — the clause says Ice");
});
