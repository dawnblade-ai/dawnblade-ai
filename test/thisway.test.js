/* ============================================================
   "…THIS WAY" IS THIS CARD'S OWN RESOLUTION, NOT THE TURN'S HISTORY.

   Portside Exchange: "Discard a card, then draw a card. If a yellow card
   is discarded this way, create a Gold token."

   TWO BUGS IN ONE CARD, and the first is the worse of them.

   1. THE DISCARD WAS DROPPED. `classifyClause` had compound rules for a
      RANDOM discard ("draw a card, then discard a random card") and none
      for the plain one, so the unanchored plain-draw rule below claimed
      the clause and returned the DRAW ALONE. The card drew for free.

      The comment above those compound rules documents this exact bug for
      the random wording — *"Five Kayo rows drew for free and never
      paid"* — and the non-random form was the same bug, unfixed, one
      wording over. **The clause read `run` the whole time**, so no
      coverage number ever moved: read, and read wrong.

   2. THE PAYOFF COULD NOT BE ANSWERED. `execute` evaluates `fx.conds`
      BEFORE it runs `fx.ops`, so a condition asking what its own ops just
      did reads an empty trace — false on every card, forever. The `way:`
      prefix lets the main loop skip these and a LATE pass pick them up.

   ASSERT ON HANDS, ZONES AND THE BOARD — never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);

/* ---- 1. THE DROPPED DISCARD -------------------------------------- */

test("a plain draw-and-discard reads BOTH halves", () => {
  assert.deepEqual(cc("Draw a card, then discard a card").ops,
    [["draw", 1], ["selfDiscard", 1]]);
  assert.deepEqual(cc("Discard a card, then draw a card").ops,
    [["selfDiscard", 1], ["draw", 1]],
    "and in the PRINTED order — which card you may discard depends on " +
    "whether you have drawn yet, so the two printings genuinely differ");
});

test("the RANDOM form is untouched", () => {
  assert.deepEqual(cc("draw a card, then discard a random card").ops,
    [["draw", 1], ["discardRandom", 1]],
    "`random` must not leak into the new rules: they require the count " +
    "word to be followed immediately by 'card', and the random wording " +
    "puts 'random' between the two");
});

test("a bare draw is still a bare draw — the widening is narrow", () => {
  assert.deepEqual(cc("Draw a card").ops, [["draw", 1]]);
  assert.deepEqual(cc("Draw two cards, then discard a card").ops,
    [["draw", 2], ["selfDiscard", 1]], "the counts are read, not assumed");
});

/* ---- 2. THE "THIS WAY" CONDITION --------------------------------- */

test("the colour is read off the line and carries the `way:` prefix", () => {
  assert.equal(cc("If a yellow card is discarded this way, create a Gold token").cond,
    "way:discardPitch2");
  assert.equal(cc("If a blue card is discarded this way, draw a card").cond,
    "way:discardPitch3");
  /* the 6+ power wording is a DIFFERENT condition and must not move */
  assert.equal(cc("If a card with 6 or more {p} is discarded this way, this gets +2{p}").cond,
    "discard6way");
});

/* ---- 3. DRIVEN --------------------------------------------------- */

const mk = (n, p, u) => Object.assign({}, H.card(n, p), {uid: u, pitch: p});

function play(lastInHand){
  H.db();
  const src = Object.assign({}, H.card("Portside Exchange", 3), {uid: "pe1"});
  let g = H.state({name: "Gravy Bones", res: 9, ap: 3,
                   hand: [src, mk("Booze!", 3, "h1"), lastInHand],
                   board: [], counters: {},
                   deck: [{uid: "d1", name: "Top", pitch: 1}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "pe", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  return J.reduce(g, {t: "play", uid: "pe1", from: "hand"}, 0).state;
}

test("driven: the card is ACTUALLY discarded, and the draw happens", {skip}, () => {
  const me = play(mk("A Yellow", 2, "y1")).sides[0];
  assert.ok(!me.hand.some(c => c.uid === "y1"), "it leaves the hand");
  assert.ok(me.grave.some(c => c.uid === "y1"), "and reaches the graveyard");
  assert.ok(me.hand.some(c => c.uid === "d1"), "the drawn card arrives");
});

test("driven: a YELLOW discard earns the Gold token", {skip}, () => {
  const me = play(mk("A Yellow", 2, "y1")).sides[0];
  assert.ok((me.board || []).some(b => b && b.card && /gold/i.test(b.card.name)),
    "the payoff fires — which it cannot do at all unless the LATE pass runs");
});

test("driven: a RED discard does not — the condition is real", {skip}, () => {
  /* A RED CARD RATHER THAN AN EMPTY HAND. With nothing to discard the
     trace is empty either way, and the drill could not tell "it checked
     the colour" from "it checked for anything at all" (v3.26). */
  const me = play(mk("A Red", 1, "r1")).sides[0];
  assert.ok(me.grave.some(c => c.uid === "r1"), "the red card is still discarded");
  assert.ok(!(me.board || []).some(b => b && b.card && /gold/i.test(b.card.name)),
    "but no token — a yellow card was not discarded this way");
});

test("Portside Exchange resolves in full", {skip}, () => {
  P.fxReset();
  assert.equal(P.fxParse(H.card("Portside Exchange", 3)).tier, "full");
  P.fxReset();
});

/* ---- 4. THE THREE THINGS SABOTAGE FOUND -------------------------- */

const E = require("../engine/effects.js");

test("AN UNKNOWN `way:` CONDITION ANSWERS FALSE", () => {
  /* ASKED BY NAME, because no card fixture can reach this branch: the
     parser only emits conditions the evaluator knows, so a sabotage of
     the default passes silently against every driven drill. Exactly the
     situation v3.26 records for `defSelfMet` and v3.36 for
     `asInstantMet` — which is why this is a named function at all. */
  assert.equal(E.thisWayMet("way:somethingNobodyBuilt", {discarded: [{pitch: 2}]}), false,
    "a condition added to the parser and forgotten here must leave the " +
    "card at its printed value, not grant a bonus nobody built");
  assert.equal(E.thisWayMet("way:discardPitch2", {discarded: [{pitch: 2}]}), true);
  assert.equal(E.thisWayMet("way:discardPitch2", {discarded: [{pitch: 1}]}), false);
  assert.equal(E.thisWayMet("way:discardPitch2", {}), false, "an empty trace answers no");
});

test("the trace is CLEARED with the resolution", {skip}, () => {
  /* "This way" is one card's own doing. A trace left on the state is the
     NEXT card's condition reading a discard it never made — and a drill
     that plays ONE card cannot see that, which is how the sabotage
     removing the clear stayed green. */
  H.db();
  const first  = Object.assign({}, H.card("Portside Exchange", 3), {uid: "pe1"});
  const second = Object.assign({}, H.card("Portside Exchange", 3), {uid: "pe2"});
  let g = H.state({name: "Gravy Bones", res: 9, ap: 3,
                   hand: [first, second, mk("A Red", 1, "r1"), mk("A Yellow", 2, "y1")],
                   board: [], counters: {},
                   deck: [{uid: "d1", name: "T1", pitch: 1}, {uid: "d2", name: "T2", pitch: 1}]},
                  {name: "Them", deck: [{uid: "d3", name: "T3"}]},
                  {actor: 0, turnPlayer: 0, seed: "pe2", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  /* first play discards the YELLOW (selfDiscard takes from the end of hand) */
  let n = J.reduce(g, {t: "play", uid: "pe1", from: "hand"}, 0).state;
  const golds1 = (n.sides[0].board || []).filter(b => b && b.card && /gold/i.test(b.card.name)).length;
  assert.equal(golds1, 1, "the first play earns its token");

  /* second play now has no yellow left to discard */
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "pe2", from: "hand"}, 0).state;
  const golds2 = (n.sides[0].board || []).filter(b => b && b.card && /gold/i.test(b.card.name)).length;
  assert.equal(golds2, 1,
    "and the SECOND play earns nothing — a leaked trace would mint a " +
    "second Gold off the first card's discard");
});

test("the main condition loop SKIPS these, so the feed never contradicts itself", {skip}, () => {
  /* THE ONE PLACE IN THIS FILE THAT ASSERTS ON PROSE, AND DELIBERATELY.
     Without the skip the condition is evaluated TWICE: once in the main
     loop against an empty trace (false), then again in the late pass
     (true). The state comes out identical — the token is still created —
     so every zone-based assertion here passes, which is exactly how the
     sabotage removing the skip stayed green.

     What differs is that the player is told "condition not met" and then
     handed the bonus anyway. In a training sim the sequence IS the
     lesson, and a feed that contradicts itself is the sev-2 category the
     player TRUSTS. So the observable is the prose, and it is asserted
     here rather than nowhere. */
  const n = play(mk("A Yellow", 2, "y1"));
  const me = n.sides[0];
  assert.ok((me.board || []).some(b => b && b.card && /gold/i.test(b.card.name)),
    "premise: the bonus really did fire");
  assert.ok(!(n.feed || []).some(l => /Portside Exchange: condition not met/i.test(l)),
    "so nothing may have told the player it did not");
});
