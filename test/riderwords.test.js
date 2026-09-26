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
  assert.match(lineFor(["buffNext", 0, {g: [["pirate", "ally"]]}, {onHitHero: [["token", "Gold", 1]]}]),
    /a granted ability/);
  assert.match(lineFor(["buffNext", 3, Q, {gaIf: "fused"}]), /goes again if it was fused/);
});

test("a zero-power grant does not print +0", {skip}, () => {
  const l = lineFor(["buffNext", 0, {g: [["pirate", "ally"]]}, {onHitHero: [["token", "Gold", 1]]}]);
  assert.ok(l, "fixture: no feed line");
  assert.doesNotMatch(l, /\+0/, "a Loot card's grant announced +0 power");
});
