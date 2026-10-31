/* ============================================================
   A GRANT'S FEED LINE NAMES WHAT ITS RIDER DOES (v4.69)

   `runOps`' buffNext line read ", and it goes again if it hits" for EVERY
   rider. True of Warrior's Valor, and false of every other rider in the
   family: Yo Ho Ho!'s Gold, the Loot cards' discard and destroy, Weave
   Lightning's fused go again — and Release the Tension's bar, which is how
   it was found. The Loot cards also printed "+0". In a training sim the
   feed is the lesson (v3.60), so a line naming the wrong ability teaches
   the wrong card.

   THIS FILE READS PROSE ON PURPOSE, which this project otherwise forbids:
   the STATE is identical whichever words the line uses, so the words are
   the only observable (v3.60's exception, and v4.65's). Each case drives
   the real op through `runOps`, with the real rider shape the parser emits.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const lineFor = (op, src) => {
  H.db();
  const g = H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const n = H.runOps(g, [op], src || "SYN");
  const feed = (n.feed || n.log || []).map(x => typeof x === "string" ? x : (x && (x.t || x.msg || x.text)) || "");
  return feed.filter(l => /^Next /.test(l) || /Next /.test(l)).pop() || "";
};
const Q = {g: [["arrow"]]};

test("a static bar says WHICH door it closes", {skip}, () => {
  assert.match(lineFor(["buffNext", 3, Q, {noDrx: "arsenal"}], "Release the Tension"),
    /no defence reaction can be played from arsenal to its chain link/);
  assert.match(lineFor(["buffNext", 3, Q, {noDrx: true}]),
    /no defence reaction can be played to its chain link/);
  assert.doesNotMatch(lineFor(["buffNext", 3, Q, {noDrx: "arsenal"}]), /goes again/,
    "the bar was described as a go again — the line this version exists to fix");
});

test("an on-hit go again still says so, and only that", {skip}, () => {
  assert.match(lineFor(["buffNext", 3, {g: [["weapon"]]}, {onHit: [["ga"]]}]), /goes again if it hits/);
});

test("anything else is 'a granted ability', never a guessed one", {skip}, () => {
  /* THE FALLBACK FIXTURE MOVED AT v5.54: the Gold rider is named now (below),
     so an op kind the describer does not know stands in for "anything else". */
  assert.match(lineFor(["buffNext", 0, {g: [["pirate", "ally"]]}, {onHitHero: [["boo", 1]]}]),
    /a granted ability/);
  assert.match(lineFor(["buffNext", 3, Q, {gaIf: "fused"}]), /goes again if it was fused/);
});

/* ---- WHAT THE RIDER DOES, SAID (v5.54, FEED 21) ----------------------
   Yo Ho Ho! and the Loot cards printed ", and a granted ability". Each
   case is the rider shape the parser emits for that card. */
test("a rider's on-hit effect is named: Gold, a discard or destroy and its tail, a foe's token, a tap", {skip}, () => {
  const PA = {g: [["pirate", "ally"]]};
  assert.equal(lineFor(["buffNext", 1, PA, {onHitHero: [["token", "gold", 1, "self"]]}], "Yo Ho Ho!"),
    "Next Pirate ally attack +1, and if it hits a hero, create a Gold token.");
  assert.equal(lineFor(["buffNext", 0, {...PA, atk: true}, {onHitHero: [["foeDiscard", 1]],
    condOnHit: [{cond: "way:took", op: ["token", "gold", 1, "self"], heroOnly: true}]}], "Loot the Hold"),
    "Next Pirate ally attack, and if it hits a hero, they discard a card \u2014 if they do, create a Gold token.");
  assert.match(lineFor(["buffNext", 0, {...PA, atk: true}, {onHitHero: [["foeArsDestroy", 1]],
    condOnHit: [{cond: "way:took", op: ["token", "gold", 1, "self"], heroOnly: true}]}], "Loot the Arsenal"),
    /destroy the card in their arsenal \u2014 if one is destroyed, create a Gold token/);
  assert.match(lineFor(["buffNext", 3, Q, {onHitHero: [["token", "bloodrot pox", 1, "foe"]]}]),
    /create a Bloodrot Pox token under their control/);
  assert.match(lineFor(["buffNext", 3, Q, {onHitHero: [["tapFoeHero", 1, {allies: true}]]}]),
    /tap them and all allies they control/);
  /* THE NEAR-MISS: a tail the describer cannot attribute is not half-said. */
  assert.match(lineFor(["buffNext", 0, PA, {onHitHero: [["foeDiscard", 1]],
    condOnHit: [{cond: "marked", op: ["token", "gold", 1, "self"]}]}]), /a granted ability/,
    "a gated tail that is not `way:took` falls back whole");
});

test("a go-again grant's rider is named too, and a colour reads after the pump", {skip}, () => {
  H.db();
  const g = H.runOps(H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
    [["gaNext", {g: [["pirate", "ally"]], atk: true}, {onHitHero: [["token", "gold", 1, "self"]]}]], "Avast Ye!");
  const ga = (g.feed || g.log || []).map(x => typeof x === "string" ? x : (x && (x.t || x.msg || x.text)) || "")
    .filter(l => /carry go again/.test(l)).pop() || "";
  assert.match(ga, /Pirate ally attack this turn will carry go again, and if it hits a hero, create a Gold token\.$/);
  assert.equal(lineFor(["buffNext", 1, {pitch: 3}, null, true], "Flying High"), "Next attack +1 if it is blue.",
    "it read \"Next attack if it is blue +1\" — backwards");
});

test("a zero-power grant does not print +0", {skip}, () => {
  const l = lineFor(["buffNext", 0, {g: [["pirate", "ally"]]}, {onHitHero: [["token", "Gold", 1]]}]);
  assert.ok(l, "fixture: no feed line");
  assert.doesNotMatch(l, /\+0/, "a Loot card's grant announced +0 power");
});
