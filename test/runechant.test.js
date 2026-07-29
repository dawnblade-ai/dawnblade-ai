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
const { html } = require("./helpers/extract.js");

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
const popBlock = (() => {
  const src = html();
  const at = src.indexOf("if(runeAtPlay > 0){");
  if(at < 0) throw new Error("the runechant pop block moved — re-anchor this drill");
  const end = src.indexOf("\n      }", at);
  return src.slice(at, end);
})();

test("the trainer's runechant pop credits hist.arc", () => {
  assert.match(popBlock, /hist\s*=\s*\{\s*\.\.\.act\(n\)\.hist\s*,\s*arc\s*:/,
    "without this, arcDealt and the arcane pip never see a runechant");
});

test("the pop counts one arcane instance per token, not one per pop", () => {
  /* runOps counts one per arcane op regardless of the points dealt, so N
     separate sources are N instances. `rp.popped` is that number; a bare
     +1 would under-count and `rp.damage` would count POINTS, a different
     quantity that happens to coincide only when the token deals 1. */
  assert.match(popBlock, /arc\s*:\s*\(act\(n\)\.hist\.arc\s*\|\|\s*0\)\s*\+\s*rp\.popped/,
    "credit rp.popped — not a literal 1, and not rp.damage");
});

test("the history is written through actMut, never as a game-object key", () => {
  /* the v2.18/v2.19 bug class: `{...n, hist}` writes to the GAME object,
     the side keeps its old value, and the write silently does nothing.
     `hist` is a per-side field and SIDE-FIELD-ON-GAME exists for this. */
  assert.match(popBlock, /actMut\(n\)\.hist\s*=/);
  assert.doesNotMatch(popBlock, /\{\s*\.\.\.n\s*,[^}]*\bhist\b\s*[,:}]/,
    "hist belongs to the side — write it with actMut, not as a top-level key");
});

test("the pop credits the ACTOR's history, not seat 0's", () => {
  /* same bug class as popRunechants(n, 0, …), fixed in v2.25: the arcane
     a runechant deals belongs to whoever swung. */
  assert.doesNotMatch(popBlock, /you(Mut)?\(n\)\.hist/,
    "a perspective helper here would credit seat 0 whoever is acting");
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
