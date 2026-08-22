/* RUNECHANTS — the printed token, and why it is an aura and not a counter.

     Runechant — "Runeblade Token - Aura"
     "When you play an attack action card or activate a weapon attack,
      destroy this and deal 1 arcane damage to target opposing hero."

   Three things that text settles:

   1. It is an AURA IN THE ARENA. Seven pool cards ask about auras
      generically — "if you control 3 or more auras" (Goon Beatdown, Goon
      Tactics), "you may destroy an aura you control" (Condemn to
      Slaughter), "whenever you play an aura" (Magmatic Carapace), "if
      you've played or created an aura this turn" (Runerager Swarm, Shrill
      of Skullform, Hit the High Notes). While a runechant was an integer,
      NONE of them could see it. That is the reason for this change; the
      card art on the board is a consequence.

   2. EACH IS ITS OWN SOURCE and there is no "you may" — they all pop,
      mandatorily, each dealing its own damage.

   3. The trigger is "when you PLAY an attack action card". A runechant
      that did not exist at that instant never triggered, so one created BY
      the attack survives to the next swing. */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const S = require("../engine/sides.js");
const I = require("../engine/invariants.js");
const { html, effects } = require("./helpers/extract.js");

/* the real token record, shaped as the loader hands it over */
const TOKEN = {name:"Runechant", pitch:0, cost:null, power:null, def:null,
  tt:"Runeblade Token - Aura", kw:[], tx:"When you play an attack action card or " +
  "activate a weapon attack, destroy this and deal 1 arcane damage to target opposing hero.",
  img:"https://example/rune.webp", dbImg:"https://example/rune.webp", _token:true};

let seq = 0;
const uid = () => ++seq;
function game(){
  const g = S.makeGame();
  g.sides[1] = {...g.sides[1], hp: 42};
  return g;
}

/* ---- 1. they are auras, and countable as such ---------------------- */
test("a minted runechant is an aura on the board, carrying the real token art", () => {
  const g = G.addRunechants(game(), 0, 2, TOKEN, uid);
  assert.equal(g.sides[0].board.length, 2);
  const b = g.sides[0].board[0];
  assert.equal(b.kind, "aura");
  assert.equal(b.card.name, "Runechant");
  assert.equal(b.card.tt, "Runeblade Token - Aura");
  assert.equal(b.card.img, "https://example/rune.webp",
    "the board renders CardFrame, so the art is what replaces the old text chip");
});

test("runeCount reads the board — an integer could never be counted", () => {
  assert.equal(P.runeCount({board: []}), 0);
  const g = G.addRunechants(game(), 0, 3, TOKEN, uid);
  assert.equal(P.runeCount(g.sides[0]), 3);
});

test("a runechant counts toward 'if you control 3 or more auras'", () => {
  const g = G.addRunechants(game(), 0, 3, TOKEN, uid);
  assert.equal(P.auraCount(g.sides[0]), 3, "Goon Beatdown / Goon Tactics ask exactly this");
});

test("auraCount also sees a non-token aura, and ignores items and allies", () => {
  const g = game();
  g.sides[0] = {...g.sides[0], board: [
    {card:{uid:1, name:"Sigil of Solace", tt:"Runeblade Aura"}, kind:"aura", uid:1},
    {card:{uid:2, name:"Hyper Driver", tt:"Mechanologist Item"}, kind:"item", uid:2},
    {card:{uid:3, name:"Barnacle", tt:"Pirate Necromancer Action - Ally"}, kind:"ally", uid:3}
  ]};
  assert.equal(P.auraCount(g.sides[0]), 1);
  assert.equal(P.runeCount(g.sides[0]), 0, "a non-runechant aura is not a runechant");
});

/* REGRESSION: minted uids must not collide with real cards.
   `tokSeq` counts from 1 and so does the loadout's card numbering, so the
   first runechant minted took uid 1 — the same uid as a deck card — and the
   state briefly had one card in two zones. The invariant judge caught it in
   live play, which is exactly the job it was built for. addRunechants now
   namespaces the uid itself so no call site can reintroduce it. */
test("a minted uid never collides with a card uid, even from a raw counter", () => {
  let seqq = 0;
  const rawCounter = () => ++seqq;              /* returns 1, 2, 3 — as tokSeq does */
  let g = game();
  g.sides[0] = {...g.sides[0], deck: [{uid: 1, name: "Amplify the Arknight"}, {uid: 2, name: "Rune Flash"}]};
  g = G.addRunechants(g, 0, 2, TOKEN, rawCounter);
  const runeUids = g.sides[0].board.map(b => b.uid);
  assert.deepEqual(runeUids, ["rune1", "rune2"], "tokens live in their own uid space");
  for(const u of runeUids) assert.equal(typeof u, "string");
  assert.deepEqual(I.errors(g), [], I.describe(I.check(g)));
});

test("a caller that already prefixes is not double-prefixed", () => {
  let n = 0;
  const g = G.addRunechants(game(), 0, 1, TOKEN, () => "rune" + (++n));
  assert.equal(g.sides[0].board[0].uid, "rune1");
});

test("each minted runechant is a distinct object with its own uid", () => {
  const g = G.addRunechants(game(), 0, 3, TOKEN, uid);
  const uids = g.sides[0].board.map(b => b.uid);
  assert.equal(new Set(uids).size, 3, "shared uids would trip the invariant judge");
  assert.deepEqual(I.errors(g), [], I.describe(I.check(g)));
});

test("minting is immutable and side-addressed", () => {
  const g0 = game();
  const g1 = G.addRunechants(g0, 1, 2, TOKEN, uid);
  assert.equal(P.runeCount(g0.sides[0]), 0, "the original state must be untouched");
  assert.equal(P.runeCount(g1.sides[1]), 2);
  assert.equal(P.runeCount(g1.sides[0]), 0, "side 1's runechants are not side 0's");
});

test("minting nothing, or with no token record, is a no-op", () => {
  const g = game();
  assert.equal(P.runeCount(G.addRunechants(g, 0, 0, TOKEN, uid).sides[0]), 0);
  assert.equal(P.runeCount(G.addRunechants(g, 0, 2, null, uid).sides[0]), 0);
});

/* ---- 2. all of them pop, each its own source ----------------------- */
test("every runechant pops at once and each deals its own damage", () => {
  const g = G.addRunechants(game(), 0, 3, TOKEN, uid);
  const r = G.popRunechants(g, 0, 3, 1);
  assert.equal(r.popped, 3);
  assert.equal(r.damage, 3, "each token deals 1 — three separate sources");
  assert.equal(P.runeCount(r.game.sides[0]), 0);
});

test("the token's own printed damage is honoured, not hardcoded", () => {
  const g = G.addRunechants(game(), 0, 2, TOKEN, uid);
  assert.equal(G.popRunechants(g, 0, 2, 2).damage, 4);
});

test("a popped token ceases to exist — it never enters a graveyard", () => {
  const g = G.addRunechants(game(), 0, 2, TOKEN, uid);
  const r = G.popRunechants(g, 0, 2, 1);
  assert.equal(r.game.sides[0].grave.length, 0, "a token is not a card and files nowhere");
  assert.deepEqual(I.errors(r.game), []);
});

test("popping leaves other permanents on the board alone", () => {
  let g = game();
  g.sides[0] = {...g.sides[0], board:[{card:{uid:99, name:"Hyper Driver"}, kind:"item", uid:99}]};
  g = G.addRunechants(g, 0, 2, TOKEN, uid);
  const r = G.popRunechants(g, 0, 2, 1);
  assert.equal(r.game.sides[0].board.length, 1);
  assert.equal(r.game.sides[0].board[0].card.name, "Hyper Driver");
});

test("popping nothing when there are none is harmless", () => {
  const g = game();
  const r = G.popRunechants(g, 0, 0, 1);
  assert.equal(r.popped, 0);
  assert.equal(r.damage, 0);
});

/* ---- 3. the trigger fires on PLAY -------------------------------- */
test("a runechant created BY the attack does not pop on that attack", () => {
  /* two in the arena when the attack is played; Viserai's rite then conjures
     a third during the same declaration. The third was not there when the
     attack was played, so only two trigger. This is the bug CLAUDE.md
     carried as a known approximation for several versions. */
  let g = G.addRunechants(game(), 0, 2, TOKEN, uid);
  const runeAtPlay = P.runeCount(g.sides[0]);          /* captured at play */
  g = G.addRunechants(g, 0, 1, TOKEN, uid);            /* conjured after */
  assert.equal(P.runeCount(g.sides[0]), 3);
  const r = G.popRunechants(g, 0, runeAtPlay, 1);
  assert.equal(r.popped, 2, "only the two that existed at play time trigger");
  assert.equal(r.damage, 2);
  assert.equal(P.runeCount(r.game.sides[0]), 1, "the freshly forged one survives to the next swing");
});

test("the cap never pops more than are actually there", () => {
  const g = G.addRunechants(game(), 0, 1, TOKEN, uid);
  const r = G.popRunechants(g, 0, 5, 1);
  assert.equal(r.popped, 1);
  assert.equal(r.damage, 1);
});

test("a null cap pops everything — the plain 'all of them' case", () => {
  const g = G.addRunechants(game(), 0, 4, TOKEN, uid);
  assert.equal(G.popRunechants(g, 0, null, 1).popped, 4);
});

/* ---- the pop must CREDIT THE HISTORY (v2.28) -----------------------
   `popRunechants` is pure and deliberately does not touch `hist` — it
   reports what popped and leaves the bookkeeping to its caller, exactly
   as runOps's `arcane` op does its own. The trainer's call site forgot,
   so three runechants could pop for 3 arcane (verified in live play
   2026-07-27, opponent 42 -> 39) while `hist.arc` stayed 0. Two things
   read that field and both went quietly wrong:

     - `arcDealt` ("you have dealt arcane damage this turn"), which stayed
       FALSE right after Viserai's PRIMARY arcane source resolved;
     - the "arcane dealt" pip, which never lit from a runechant.

   `execute` is inside the React component, so no drill can call it. Pin
   the call site by reading it, the way the actor ledger does — a source
   check is worth more than no check when the alternative is unreachable. */
/* `popBlock` (a source slice of the pop) was retired at v3.28: every
   property it guarded is driven above. */

/* ---- THE ARCANE CREDIT IS DRIVEN NOW (v3.28) -------------------------

   These three used to slice the pop block and grep it, because `execute`
   lived inside the React component and no drill could call it. It does
   not any more, and the credit has moved out of the pop entirely: it
   happens in `arcaneHit`, at the point the damage actually lands. So the
   same three properties are DRIVEN instead of read.

   That is strictly better and it is also the reason they had to change:
   a source check pinned to a location stops meaning anything the moment
   the rule moves, which is what happened here twice (v3.22, v3.28). */

const HH = require("./helpers/judged.js");

const arcOnce = o => {
  o = o || {};
  const g = HH.state({}, {hp: 20, arcShield: o.shield || 0, awd: o.ward || 0}, {turn: 3});
  g.builds = [{}, {}];
  return HH.runOps(g, o.ops || [["arcane", 1]], "Runechant");
};

test("arcane that LANDS credits the dealer's hist.arc", () => {
  const n = arcOnce();
  assert.equal(n.sides[1].hp, 19, "it landed");
  assert.equal(n.sides[0].hist.arc, 1, "and the DEALER is credited, not the hero hit");
  assert.equal((n.sides[1].hist || {}).arc || 0, 0, "the side taking it dealt nothing");
});

test("arcane that is PREVENTED credits nothing — CR 7.5.5", () => {
  /* RULING (user, 2026-08-22): Sigil of Suffering's own arcane satisfies
     its own condition "as long as it's not prevented". The credit used to
     be added at the call site BEFORE any prevention ran, so a point
     turned aside entirely still counted as dealt. */
  const n = arcOnce({shield: 5});
  assert.equal(n.sides[1].hp, 20, "every point of it prevented");
  assert.equal((n.sides[0].hist || {}).arc || 0, 0, "so nothing was dealt this turn");
});

test("partial prevention still counts — some of it landed", () => {
  const n = arcOnce({shield: 1, ops: [["arcane", 3]]});
  assert.equal(n.sides[1].hp, 18, "3 minus a 1-point shield");
  assert.equal(n.sides[0].hist.arc, 1, "one instance, and it dealt damage");
});

test("one instance per SOURCE, not one per point", () => {
  /* runOps counts one per arcane op regardless of the points dealt, so N
     separate sources are N instances — three Runechants are three threats
     a hero may answer three times. Points and instances coincide only
     while a token deals exactly 1, which is the coincidence this exists
     to survive. */
  const n = arcOnce({ops: [["arcane", 1], ["arcane", 1], ["arcane", 1]]});
  assert.equal(n.sides[1].hp, 17, "three points");
  assert.equal(n.sides[0].hist.arc, 3, "and three instances");
  const one = arcOnce({ops: [["arcane", 3]]});
  assert.equal(one.sides[1].hp, 17, "the same three points");
  assert.equal(one.sides[0].hist.arc, 1, "from ONE source");
});

test("the history is written through the side, never as a game-object key", () => {
  /* the v2.18/v2.19 bug class: `{...n, hist}` writes to the GAME object,
     the side keeps its old value, and the write silently does nothing. */
  const n = arcOnce();
  assert.equal(n.hist, undefined, "hist belongs to a side, not to the game");
  assert.equal(n.sides[0].hist.arc, 1);
});

test("the credit goes to the ACTOR's history, not seat 0's", () => {
  /* Same bug class as popRunechants(n, 0, …), fixed in v2.25: the arcane a
     runechant deals belongs to whoever swung. DRIVEN from seat 1 now
     rather than grepped — the write moved into `creditArc` at v3.28, and
     a scan pinned to where a rule USED to live stops meaning anything the
     moment it moves. */
  const g = HH.state({hp: 20}, {}, {turn: 3, actor: 1});
  g.builds = [{}, {}];
  const n = HH.runOps(g, [["arcane", 1]], "Runechant");
  assert.equal(n.sides[0].hp, 19, "seat 1 is acting, so seat 0 takes it");
  assert.equal(n.sides[1].hist.arc, 1, "and seat 1 is credited");
  assert.equal((n.sides[0].hist || {}).arc || 0, 0,
    "a perspective helper would have credited seat 0 whoever is acting");
});

/* ---- cost reduction still works off the board --------------------- */
test("'costs {r} less for each runechant' reads the board, not a counter", () => {
  const card = {cost: 3, tx: "This costs {r} less to play for each Runechant you control."};
  const g = G.addRunechants(game(), 0, 2, TOKEN, uid);
  assert.equal(P.effCost(card, g.sides[0]), 1);
  const many = G.addRunechants(game(), 0, 9, TOKEN, uid);
  assert.equal(P.effCost(card, many.sides[0]), 0, "floored at 0");
  assert.equal(P.effCost(card, game().sides[0]), 3, "no runechants, no discount");
});

test("effCost survives a side with no board at all", () => {
  const card = {cost: 3, tx: "This costs {r} less to play for each Runechant you control."};
  assert.equal(P.effCost(card, {}), 3);
  assert.equal(P.effCost(card, null), 3);
});

/* ---- THE DEFERRED PATH CREDITS THE DEALER, NOT THE VICTIM (v3.28) ----

   When the threatened hero has a barrier to spend, `arcaneHit` does not
   apply the damage — it queues a soak prompt and the damage "rides out
   on the answer" as an `arcTaken` op. That answer is given by the side
   being HIT, and `promptConfirm` borrows their seat, so at `arcTaken`
   time the actor is the victim.

   Crediting `act` there hands the arcane to the hero taking it. Which
   seat dealt it therefore rides on the spec (`by`) and is passed through
   `buildPrompt` explicitly — a spec only carries fields it knows about,
   which is the `arsStamp` lesson from v2.34.

   Sabotage is why this drill exists: on the IMMEDIATE path the dealer
   and the actor are the same seat, so replacing the dealer lookup with
   `actMut` failed nothing at all. -------------------------------------- */

test("a soak-deferred hit still credits the DEALER", () => {
  const PRM = require("../engine/prompts.js");
  const barrier = {name: "Nullrune Boots", uid: "nb1", tt: "Generic Equipment - Legs",
                   kw: ["Arcane Barrier 1"], def: 1};
  const g = HH.state({}, {hp: 20, gear: [barrier], res: 5}, {turn: 3});
  g.builds = [{}, {}];

  const n = HH.runOps(g, [["arcane", 1]], "Runechant");
  const spec = (n.promptQ || [])[0] || n.prompt;
  assert.ok(spec, "a hero holding a barrier must be ASKED before the damage lands");
  assert.equal(spec.tag, "soak");
  assert.equal(spec.side, 1, "the side being hit is the one asked");
  assert.equal(spec.by, 0, "and the spec records who dealt it");
  assert.equal(n.sides[1].hp, 20, "nothing has landed yet — it rides on the answer");
  assert.equal((n.sides[0].hist || {}).arc || 0, 0, "and nothing is credited yet either");

  /* decline the barrier: take all of it */
  const live = PRM.buildPrompt(n, spec);
  assert.ok(live, "the sheet must open");
  assert.equal(live.by, 0, "buildPrompt must carry `by` through — a spec only keeps what it knows");
  const out = PRM.applyPrompt(n, {...live, sel: []});
  const taken = (out.ops || []).find(o => o[0] === "arcTaken");
  assert.ok(taken, "the damage rides out as arcTaken");
  assert.equal(taken[1], 1, "all of it, undeclined");
  assert.equal(taken[3], 0, "carrying the DEALER's seat");

  /* and running it credits seat 0, while the ACTOR at that moment is the
     victim — which is the whole point */
  const vg = {...n, actor: 1};
  const done = HH.runOps(vg, [taken], "Runechant");
  assert.equal(done.sides[1].hp, 19, "the victim takes it");
  assert.equal(done.sides[0].hist.arc, 1, "the DEALER is credited");
  assert.equal((done.sides[1].hist || {}).arc || 0, 0, "the victim dealt nothing");
});
