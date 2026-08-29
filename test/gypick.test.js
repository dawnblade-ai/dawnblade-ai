/* ============================================================
   PICKING A CARD OUT OF A ZONE — three printed wordings, one op.

     Preserve Tradition  "Put target action card from your graveyard on
                          the bottom of your deck."
     Rise from the Ashes "You may return a Phoenix Flame from your
                          graveyard to your hand."
     Pass Over           "Banish target card from an opposing hero's
                          graveyard."

   NONE OF THIS IS NEW MACHINERY, and that is the finding. `prompts.js`
   has had the `pick` variant since v2.17 and `pickPrompt` has been a
   generic op since v2.39; what was missing was READERS. Three of the
   twelve cards `npm run gaps` files under "pick from a zone" needed
   nothing but a pattern each.

   WHAT THESE DRILLS ASSERT IS ZONES, never feed prose. Two of v2.45's
   nine bugs lived under green drills that read the log: the end phase
   really did print (a) through (f) in order — it was drawing for the
   wrong hero.

   AND THEY DRIVE THE REAL ENTRY POINT. v3.20's `condemn.test.js` built
   its spec by hand and handed it to `buildPrompt`, which measures the
   sheet rather than whether anything opens it — the card's prompt was
   never once offered in a real game and the drill could not tell.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

/* Real pool cards for the graveyard, so a filter that admits nothing and
   a filter that is simply never asked cannot look alike. */
const gyPile = () => [
  Object.assign({}, H.card("Phoenix Flame", 0), {uid: "g1"}),
  Object.assign({}, H.card("Booze!", 3),        {uid: "g2"})];

function play(name, pitch, mine, theirs){
  H.db();
  const c = Object.assign({}, H.card(name, pitch), {uid: "src1"});
  let g = H.state({name: "Me", res: 9, ap: 3, hand: [c],
                   grave: mine || [], deck: [{uid: "d1", name: "Top"}]},
                  {name: "Them", grave: theirs || [],
                   deck: [{uid: "d2", name: "TheirTop"}]},
                  {actor: 0, turnPlayer: 0, seed: "gy"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
  return J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
}
const pickUid = (n, uid) => {
  const i = n.prompt.cards.findIndex(c => c.uid === uid);
  assert.ok(i >= 0, "the card must be offered: " + uid);
  n = J.reduce(n, {t: "promptSel", i}, n.prompt.side).state;
  return J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
};

/* ---- 1. THE DESTINATION IS READ, NOT FIXED ------------------------ */

test("Preserve Tradition puts the chosen card on the BOTTOM of the deck", {skip}, () => {
  let n = play("Preserve Tradition", 3, gyPile());
  assert.ok(n.prompt, "the sheet must actually open — a reader nothing calls is not a reader");
  assert.equal(n.prompt.to, "deckBottom");
  /* "target ACTION card" — Booze! is a Generic Action, Phoenix Flame an
     attack action card, so both are legal here and the filter is proven
     by the card that must NOT appear in the next drill instead. */
  n = pickUid(n, "g2");
  const me = n.sides[0];
  assert.equal(me.deck[me.deck.length - 1].uid, "g2", "it goes to the BOTTOM");
  assert.notEqual(me.deck[0].uid, "g2", "and specifically not the top");
  assert.ok(!me.grave.some(c => c.uid === "g2"), "and it has left the graveyard");
});

test("Memorial Ground still puts its pick on TOP — one reader, both destinations", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Memorial Ground", 2));
  const op = fx.ops.find(o => o[0] === "pickPrompt");
  assert.equal(op[1].to, "deckTop",
    "the shared reader must not have moved the card that was already working");
  P.fxReset();
});

/* ---- 2. "YOU MAY" IS WHAT MAKES IT OPTIONAL ----------------------- */

test("Rise from the Ashes returns the named card to HAND, and only that card", {skip}, () => {
  let n = play("Rise from the Ashes", 1, gyPile());
  assert.ok(n.prompt, "the sheet must open");
  assert.equal(n.prompt.to, "hand");
  assert.equal(n.prompt.min, 0, "'you may' — declining must stay possible");
  /* THE NAME FILTER IS THE WHOLE READING. `classifyClause` lowercases,
     and `optFilter`'s named-card branch is anchored on a proper noun, so
     a reader that passed the lowercased subject through would refuse the
     card entirely and look exactly like a pattern that did not match. */
  assert.deepEqual(n.prompt.cards.map(c => c.uid), ["g1"],
    "only the Phoenix Flame is a legal choice — Booze! must not be offered");
  n = pickUid(n, "g1");
  assert.ok(n.sides[0].hand.some(c => c.uid === "g1"), "it comes back to hand");
  assert.ok(!n.sides[0].grave.some(c => c.uid === "g1"), "and leaves the graveyard");
});

test("declining Rise from the Ashes moves nothing", {skip}, () => {
  let n = play("Rise from the Ashes", 1, gyPile());
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.ok(n.sides[0].grave.some(c => c.uid === "g1"),
    "nothing was chosen, so nothing moves");
  assert.ok(!n.sides[0].hand.some(c => c.uid === "g1"));
});

/* ---- 3. THE CROSS-SEAT PICK, AND THE FIELD ITS CONSUMER IGNORED --- */

test("Pass Over banishes out of the OPPONENT's graveyard, not the caster's", {skip}, () => {
  /* BOTH GRAVEYARDS ARE STOCKED, with the same two cards under different
     uids. A drill that stocks only one cannot tell "it read the right
     side" from "it read the only side there was" — v3.26's rule about a
     fixture that cannot tell two halves apart. */
  const mine   = gyPile().map(c => Object.assign({}, c, {uid: "mine-" + c.uid}));
  const theirs = gyPile().map(c => Object.assign({}, c, {uid: "their-" + c.uid}));
  let n = play("Pass Over", 3, mine, theirs);
  assert.ok(n.prompt, "the sheet must open");
  assert.deepEqual(n.prompt.cards.map(c => c.uid).sort(),
    ["their-g1", "their-g2"],
    "only THEIR graveyard is offered — the caster's own is not a legal choice");

  n = pickUid(n, "their-g1");
  /* THE MOVE ITSELF. `moveFoe` has carried {from,to} since v3.03 and the
     consumer ignored both, moving hand -> deck top whatever it was told.
     Against that body this whole card was a sheet that changed nothing:
     the right card was offered, the feed said it was banished, and it
     stayed in the graveyard. Assert the ZONES. */
  const them = n.sides[1];
  assert.ok(!them.grave.some(c => c.uid === "their-g1"), "it leaves their graveyard");
  assert.ok(them.banish.some(c => c.uid === "their-g1"), "and lands in their BANISH");
  assert.ok(!them.deck.some(c => c.uid === "their-g1"),
    "and NOT on top of their deck — the hardcoded destination is gone");
  /* THE CASTER'S OWN GRAVEYARD IS UNTOUCHED — asserted by UID, not by
     count. Pass Over is an Instant, so it resolves into that graveyard
     itself and a length check reads 3; the question being asked is
     whether the effect reached across the table, so ask it by name. */
  assert.deepEqual(n.sides[0].grave.filter(c => c.uid.startsWith("mine-"))
                     .map(c => c.uid).sort(),
    ["mine-g1", "mine-g2"],
    "neither of the caster's own graveyard cards was banished");
});

/* ---- 4. THE REFUSAL THAT MUST SURVIVE ----------------------------- */

test("Beckoning Haunt still refuses — an X-cost subject is not readable", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Beckoning Haunt", 0));
  assert.ok(!fx.ops.some(o => o[0] === "pickPrompt"),
    "'target aura WITH COST X' must not be flattened to 'an aura' — dropping a " +
    "printed restriction is the direction that steals games (v3.31)");
  P.fxReset();
});
