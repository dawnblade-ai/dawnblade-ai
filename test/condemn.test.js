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
  assert.deepEqual(P.fxParse(CONDEMN(1)).ops, [["buffNext", 3, [["runeblade"]]]]);
  assert.deepEqual(P.fxParse(CONDEMN(3)).ops, [["buffNext", 1, [["runeblade"]]]],
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
  assert.ok(!variant("another aura you control", "v2"),
    "an EXCLUSION is not a field filter and must still refuse — v2.29's rule, " +
    "and the reason Sigil of Silphidae is still unbuilt");
  assert.ok(!variant("an aura you control with cost less than the number of Draconic chain links you control", "v3"),
    "a DYNAMIC limit must still refuse — Mounting Anger's bug was exactly this " +
    "phrase being dropped silently");
  assert.ok(!variant("a card with crush you control", "v4"),
    "a RULES-TEXT qualifier must still refuse — promptFilter reads printed fields");
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
