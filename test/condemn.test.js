/* test/condemn.test.js — CONDEMN TO SLAUGHTER (v3.18)
 *
 *   "Your next Runeblade attack this turn gets +N{p}.
 *    You may destroy an aura you control. If you do, each opponent
 *    destroys an aura permanent they control.
 *    Go again"
 *
 * Three cards, one per pitch, all Viserai's. Before this the head resolved
 * and the whole middle sentence was unread: `fx.optCost` was `undefined`,
 * because the pairing accepted only `banish` and `discard` as cost verbs.
 *
 * TWO THINGS MAKE THIS CARD DIFFERENT from the optional costs already
 * built, and each is drilled below:
 *
 *   the cost is paid out of the ARENA — you cannot destroy a card in a
 *   hand or a graveyard — so "you control" is the zone saying itself
 *
 *   the rider is CROSS-SEAT and it is the OPPONENT'S choice which of
 *   their auras dies. Picking for them would be inventing a decision, so
 *   the op opens a prompt addressed to the other seat. `applyAnswer` ends
 *   in `openPrompt`, which is what lets a prompt queued inside a rider's
 *   ops actually open.
 *
 * THE DECLINE PATH IS THE ONE THAT MATTERS. v2.04's bug was a rider firing
 * without its cost being paid; `prompts.js` returns `ops` only when cards
 * actually moved, and there is a drill named for it. This adds the
 * cross-seat version: decline, and the opponent's board must be untouched.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const PR = require("../engine/prompts.js");
const H = require("./helpers/judged.js");

const CONDEMN = pitch => ({
  name: "Condemn to Slaughter p" + pitch, tt: "Runeblade Action", pitch,
  uid: "cts" + pitch, power: null,
  tx: "Your next Runeblade attack this turn gets +" + (4 - pitch) + "{p}.\n\n"
    + "You may destroy an aura you control. If you do, each opponent destroys an aura permanent they control.\n\n"
    + "**Go again**",
  kw: ["Go again"]
});

const aura = (nm, uid) => ({name: nm, tt: "Runeblade Token - Aura", pitch: 0, uid, tx: "", kw: []});
const onBoard = c => ({card: c, kind: "token", spent: false, uid: c.uid, sd: null});

/* ---- the parser reads the whole sentence --------------------------- */

test("all three pitches read the optional cost, out of the ARENA", () => {
  P.fxReset();
  for(const pitch of [1, 2, 3]){
    const fx = P.fxParse(CONDEMN(pitch));
    assert.ok(fx.optCost, "pitch " + pitch + ": the middle sentence was unread before v3.18");
    assert.equal(fx.optCost.kind, "destroy");
    assert.equal(fx.optCost.zone, "board",
      "a destroy is paid out of the arena — falling back to the graveyard would " +
      "destroy a card the text never named, which is the bug the printed-zone " +
      "rule was written for");
    assert.deepEqual(fx.optCost.filter, {tt: "aura"});
    assert.deepEqual(fx.optCost.ops, [["foeDestroyAura", 1]]);
    assert.equal(fx.optCost.trigger, "play", "no trigger prefix — it is offered on play");
  }
});

test("the head still reads its own pitch-scaled pump, qualified to Runeblade", () => {
  P.fxReset();
  assert.deepEqual(P.fxParse(CONDEMN(1)).ops, [["buffNext", 3, {g: [["runeblade"]]}]]);
  assert.deepEqual(P.fxParse(CONDEMN(3)).ops, [["buffNext", 1, {g: [["runeblade"]]}]],
    "the qualifier must survive — v2.30's arrow buff landed on a sword without it");
});

/* ---- "you control" is the zone, and nothing else is waved through --- */

test("only 'you control' is consumed — every other qualifier still refuses", () => {
  P.fxReset();
  const variant = (subject, uid) => P.fxParse({
    name: "Variant " + uid, tt: "Runeblade Action", pitch: 1, uid,
    tx: "You may destroy " + subject + ". If you do, deal 1 arcane damage to target hero.",
    kw: []
  }).optCost;

  assert.ok(variant("an aura you control", "v1"), "the phrase the pool actually prints");
  /* DELIBERATE CHANGE AT v3.20 — this line asserted a REFUSAL and the
     reason it gave ("the reason Sigil of Silphidae is still unbuilt") is
     no longer true. The exclusion is now CARRIED as `notSelf` rather than
     dropped, which is what v2.29's rule actually demands: read the whole
     phrase or refuse. Carrying it is reading it. The two siblings below
     still refuse, which is what keeps this drill about the rule rather
     than about one card. */
  const v2 = variant("another aura you control", "v2");
  assert.ok(v2 && v2.filter.notSelf === true,
    "an EXCLUSION must be carried structurally, never flattened away");
  assert.equal(v2.zone, "board", "and 'you control' is still the board");
  assert.ok(!variant("an aura you control with cost less than the number of Draconic chain links you control", "v3"),
    "a DYNAMIC limit must still refuse — Mounting Anger's bug was exactly this " +
    "phrase being dropped silently");
  /* DELIBERATE CHANGE AT v3.33, and for the same reason v3.20 changed the
     line above: the refusal was honest only while nothing could answer the
     phrase. `printedKw` can, and it asks the precise question — does the
     card CARRY the keyword as printed rules text, which is a printed
     KEYWORD LINE rather than free rules text. So "with crush" is read.

     WHAT MUST STILL REFUSE is a keyword the engine does not know, because
     that is still an unreadable limit; and the dynamic limit above, which
     no printed field can express at all. */
  const v4 = variant("a card with crush you control", "v4");
  assert.ok(v4 && v4.filter.kw === "crush",
    "a PRINTED KEYWORD is a printed field — printedKw answers it exactly");
  assert.ok(!variant("a card with sparkles you control", "v5"),
    "an unknown keyword is still an unreadable limit, and still refuses");
  assert.ok(!variant("a card you control", "v6"),
    "and a bare 'card' restricts nothing — a filter that filters nothing is not a read");
});

/* ---- the cost is offered, and declining costs the opponent nothing -- */

function played(){
  P.fxReset();
  const g = H.state([], [], {});
  const mine = aura("Runechant", "a1");
  const theirs = aura("Frostbite", "b1");
  g.sides[0].board = [onBoard(mine)];
  g.sides[1].board = [onBoard(theirs)];
  return {g, mine, theirs};
}

test("the offer is a PICK on your own board, optional, addressed to you", () => {
  const {g} = played();
  const spec = {tag: "pick", side: 0, src: "Condemn to Slaughter", zone: "board",
                to: "grave", filter: {tt: "aura"}, min: 0, max: 1,
                ops: [["foeDestroyAura", 1]]};
  const p = PR.buildPrompt(g, spec);
  assert.ok(p, "with an aura on the board there is something to ask");
  assert.equal(p.side, 0);
  assert.equal(p.min, 0, "min:0 is what puts a 'Choose none' button on the sheet");
  assert.equal((p.cards || p.options || []).length, 1);
});

test("with no aura of your own, the cost skips itself rather than showing an empty sheet", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[1].board = [onBoard(aura("Frostbite", "b1"))];
  const p = PR.buildPrompt(g, {tag: "pick", side: 0, src: "Condemn", zone: "board",
                               to: "grave", filter: {tt: "aura"}, min: 0, max: 1,
                               ops: [["foeDestroyAura", 1]]});
  assert.equal(p, null, "a cost you cannot pay is not a decision");
});

test("DECLINING pays nothing and costs the opponent nothing — v2.04's rule, cross-seat", () => {
  const {g, theirs} = played();
  const p = PR.buildPrompt(g, {tag: "pick", side: 0, src: "Condemn", zone: "board",
                               to: "grave", filter: {tt: "aura"}, min: 0, max: 1,
                               ops: [["foeDestroyAura", 1]]});
  const out = PR.applyPrompt(g, PR.promptDecline(p));
  assert.deepEqual(out.ops || [], [],
    "the rider must not come back when nothing moved — running it anyway is the " +
    "free-ability bug v2.04 fixed, and here it would destroy an opponent's card " +
    "for a cost nobody paid");
  assert.equal(out.game.sides[0].board.length, 1, "and your own aura survives");
  assert.ok((out.game.sides[1].board || []).some(b => b.uid === theirs.uid),
    "and theirs is untouched");
});

test("PAYING returns the rider, and the cost really leaves the arena", () => {
  const {g, mine} = played();
  const p = PR.buildPrompt(g, {tag: "pick", side: 0, src: "Condemn", zone: "board",
                               to: "grave", filter: {tt: "aura"}, min: 0, max: 1,
                               ops: [["foeDestroyAura", 1]]});
  /* `sel` holds INDICES, not uids — `promptToggleSel(p, i)` indexes
     `p.cards`. Passing a uid selects nothing and the drill then reports a
     rider that did not fire, which looks exactly like the bug it is
     written to catch. */
  const i = p.cards.findIndex(c => c.uid === mine.uid);
  assert.ok(i >= 0, "the chosen aura must be among the candidates");
  const out = PR.applyPrompt(g, PR.promptToggleSel(p, i));
  assert.deepEqual(out.ops, [["foeDestroyAura", 1]], "paid, so the rider resolves");
  assert.equal((out.game.sides[0].board || []).length, 0, "the aura left the arena");
  assert.ok((out.game.sides[0].grave || []).some(c => c.uid === mine.uid),
    "and reached the graveyard — a destroyed card in NO zone falls out of the census");
});

/* ---- the rider: THEIR aura, THEIR choice --------------------------- */

test("the rider opens a prompt addressed to the OPPONENT, not to you", () => {
  const {g} = played();
  const out = H.runOps(g, [["foeDestroyAura", 1]], "Condemn");
  const q = (out.promptQ || []);
  const opened = out.prompt || q[0];
  assert.ok(opened, "something must be asked");
  assert.equal(opened.side, 1,
    "picking for them would be inventing a decision — the card says THEY destroy one");
  assert.equal(opened.min, 1, "mandatory once the cost is paid: there is no 'you may' in the rider");
  assert.equal(opened.zone, "board");
});

test("an opponent controlling no aura loses nothing, and the feed says which", () => {
  P.fxReset();
  const g = H.state([], [], {});
  g.sides[0].board = [onBoard(aura("Runechant", "a1"))];
  const out = H.runOps(g, [["foeDestroyAura", 1]], "Condemn");
  assert.ok(!(out.prompt) && !(out.promptQ || []).length,
    "nothing to ask when they control no aura");
  const said = (out.feed || []).concat(out.log || []).join(" ");
  assert.match(said, /no aura/i,
    "'nothing happened' and 'they chose not to' are different lessons");
});

test("it destroys an aura and NOT a non-aura permanent", () => {
  P.fxReset();
  const g = H.state([], [], {});
  const item = {name: "Energy Potion", tt: "Generic Item", pitch: 0, uid: "it1", tx: "", kw: []};
  g.sides[1].board = [onBoard(item)];
  const out = H.runOps(g, [["foeDestroyAura", 1]], "Condemn");
  assert.ok(!(out.prompt) && !(out.promptQ || []).length,
    "an Item is a permanent and is not an aura — the printed word is the filter");
});

/* ---- THE OFFER IS ACTUALLY REACHED — v3.20 ------------------------- */

test("DRIVEN: playing it offers the cost — the queue site was attack-only", () => {
  /* THE BUG THIS PINS. From v3.18 until v3.20 the only `optCost` queue
     site sat inside `execute`'s `if(attacking)` branch, and every
     `play`-trigger card in the pool is a NON-ATTACK — all three
     printings of this one. So the printed "you may destroy an aura you
     control" was never offered at either board.

     NONE OF THE DRILLS ABOVE COULD SEE IT, and that is the lesson worth
     keeping: they build the spec BY HAND and hand it to `buildPrompt`,
     which measures the sheet rather than whether anything ever asks for
     it. A drill that constructs its own fixture proves the fixture. This
     one drives `execute` and asserts the offer EXISTS. */
  P.fxReset();
  const card = Object.assign({}, H.card("Condemn to Slaughter", 1), {uid: "cds"});
  const g = H.state(
    {hand: [card], board: [onBoard(aura("Runechant", "a1"))], res: 9, ap: 1},
    {board: [onBoard(aura("Frostbite", "b1"))]},
    {turn: 3});
  const out = H.execute(g, card, "hand", 0, {});
  const asked = (out.promptQ || []).concat(out.prompt ? [out.prompt] : []);
  assert.equal(asked.length, 1, "the printed optional cost must be offered when the card is played");
  assert.equal(asked[0].src, "Condemn to Slaughter");
  assert.equal(asked[0].zone, "board", "'you control' is the board");
  assert.equal(asked[0].side, 0, "the cost is paid by the player who played it");
  assert.equal(asked[0].min, 0, "'you may' — declining stays possible");
  assert.deepEqual(asked[0].ops, [["foeDestroyAura", 1]], "the rider rides with the cost");
});
