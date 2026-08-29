/* ============================================================
   "ATTACK REACTION - <cost>: <effect>" IS AN ACTIVATION LINE.

   `classifyClause` guards `action` and `instant` activation prefixes so
   the generic matchers below cannot eat a line INCLUDING ITS COST. The
   pool prints a third prefix on five records and it was not guarded:

     Prey Spotters     Attack Reaction - Destroy this: Mark target opposing hero
     Stalker's Steps   Attack Reaction - Destroy this: Target attack with stealth gets go again
     Bolt'n Boots      Attack Reaction - {r}, destroy this: Target arrow attack … gets go again
     Danger Digits     Attack Reaction - Destroy this: Target dagger … deals 1 damage …
     Boltyn (hero)     Attack Reaction - Banish a card from your soul: …

   PREY SPOTTERS READ `tier: full` AND COULD NOT BE ACTIVATED AT ALL.
   The loose `mark` matcher claimed the whole line — cost and all — while
   `parseHeroPower` refuses it, so `build.js` gives the piece no powCard
   and neither board offers it. A card that reports finished and is inert
   is the no-op blind spot; this is its unanchored-match half (v3.00's
   Stir the Aetherwinds, on an activation line).

   IT REFUSES OUTRIGHT rather than deferring to the equipment reader like
   the two prefixes above it. `parseHeroPower`'s PROBE form answers
   truthily for these lines, but `build.js` builds a powCard only from an
   `action`/`instant` line — so a `noop` saying "read by the equipment
   reader" names a reader that does not run. Written that way first,
   Stalker's Steps went straight from `part` to `full` while staying
   completely inert: the blind spot re-created one line further down.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);

test("an attack-reaction activation line is REFUSED, not eaten", () => {
  assert.equal(cc("Attack Reaction - Destroy this: Mark target opposing hero"), null,
    "the loose `mark` matcher must not claim the line and drop its cost");
  assert.equal(cc("Attack Reaction - Destroy this: Target attack with stealth gets go again"), null);
  assert.equal(cc("Defense Reaction - {r}: Draw a card"), null);
});

test("…and it does NOT report as read by the equipment reader", () => {
  /* The distinction that matters: `null` says nothing reads this, where a
     `noop` says something does. Only one of those is true today. */
  const r = cc("Attack Reaction - Destroy this: Mark target opposing hero");
  assert.equal(r, null, "not a noop — a noop is a claim that a reader exists");
});

test("A RESTRICTION IS NOT AN ACTIVATION — the guard is anchored on the dash", () => {
  /* Widowmaker and Wreck Havoc print "Defense reactions can't be played
     to this chain link", which is a restriction on the opponent and has
     no dash. Swallowing it would lose a real printed rule. */
  const r = cc("Defense reactions can't be played to this chain link");
  assert.notEqual(r, null, "the restriction must still be read");
});

test("the four equipment cards report honestly, and none has a route", {skip}, () => {
  for(const nm of ["Prey Spotters", "Stalker's Steps", "Bolt'n Boots", "Danger Digits"]){
    P.fxReset();
    const c = H.card(nm, 0);
    const fx = P.fxParse(c);
    assert.notEqual(fx.tier, "full", nm + " must not claim to be finished");
    /* THE REASON IT MUST NOT: build.js gives it no powCard, so neither
       board can offer the ability. Pinned here so a future route change
       has to update this drill deliberately. */
    assert.equal(P.parseHeroPower(c.tx), null,
      nm + ": no activation is parsed, so `build.js` builds no powCard");
  }
  P.fxReset();
});

test("an action/instant ability still gets its route — the refusal is narrow", {skip}, () => {
  /* A control, or this drill passes just as well against a parser that
     refused every activated ability in the pool. */
  P.fxReset();
  const ok = H.card("Concealed Object", 0);
  const pw = P.parseHeroPower(ok.tx);
  assert.notEqual(pw, null,
    "an `Instant - …` ability must still parse into a powCard");
  assert.equal(pw.kind, "instant");
  P.fxReset();
});
