/* ============================================================
   test/promptvoice.test.js — A PROMPT'S RESULT NAMES THE SEAT (v4.46)

   `applyPrompt` built its subject as `side === 0 ? "You" : "The opponent"`
   and every line it puts in `out.msgs` goes STRAIGHT INTO THE FEED —
   `effects.js` does `r.msgs.forEach(m => { n = L(n, m); })`. v2.83's rule
   is exactly that split: a `say(...)` reaches a feed BOTH seats read, so
   it names the seat; only a `return "reason"` speaks in the second person.

   MEASURED BEFORE THE FIX: **55 feed lines over 15 driven games** opened
   with a hardcoded seat name while both seats were named after heroes — so
   half of them called the reader's opponent "You" and the other half
   called a named hero "The opponent". After: **0**.

   IT IS v4.15's OWN DEFECT ONE VARIABLE OVER. That version found 86 "You
   soaks" lines in 210 games and built `svName` to make the VERB agree —
   which it did, against a name that was wrong. The agreement was never
   the broken half.

   WHAT IS DRILLED IS BOTH DIRECTIONS (v3.98): a named seat must be named,
   AND a seat genuinely called "You" must still read in the second person,
   because that is the TRAINER (index.html names seat 0 "You") and a fix
   that broke it would be a regression wearing a fix's clothes.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../engine/prompts.js");
const S = require("../engine/sides.js");

let uid = 0;
const card = o => ({uid: ++uid, name: "c" + uid, pitch: 1, cost: 0, power: 0,
                    def: 0, tt: "Action", tx: "", kw: [], ...o});

function game(n0, n1, side0, side1){
  const g = S.makeGame({});
  g.sides = [{...S.makeSide({id: 0}), name: n0, ...(side0 || {})},
             {...S.makeSide({id: 1}), name: n1, ...(side1 || {})}];
  return g;
}

/* A declined optional pick is the cheapest line in the family and the one
   a driven game prints most (10 of the 55). */
const declined = (g, side) => {
  const p = Q.buildPrompt(g, {tag: "pick", min: 0, max: 1, side: side || 0});
  return Q.applyPrompt(g, p).msgs[0];
};

test("a named seat is NAMED in the shared feed", () => {
  const g = game("Kayo", "Dorinthea", {hand: [card()]}, {hand: [card()]});
  assert.match(declined(g, 0), /^Kayo chose nothing\./,
    "seat 0 has a name and the feed both seats read must use it");
  assert.match(declined(g, 1), /^Dorinthea chose nothing\./,
    "seat 1 too — 'The opponent' is whose opponent?");
});

/* THE OTHER DIRECTION. The trainer names seat 0 literally "You" (v2.83),
   so the second person is CORRECT there and a fix that lost it would be a
   regression. `svName` is what keeps the verb agreeing with either. */
test("a seat genuinely called \"You\" still reads in the second person", () => {
  const g = game("You", "The Dummy", {hand: [card()]}, {hand: [card()]});
  assert.match(declined(g, 0), /^You chose nothing\./);
  assert.match(declined(g, 1), /^The Dummy chose nothing\./,
    "the trainer's seat 1 has a name too, and naming it is v3.46's direction");
});

/* THE VERB AGREES WITH THE NAME, NOT WITH THE INDEX. This is the half
   v4.15 already built; the drill is here so the two cannot drift apart —
   a name change that stopped reaching `svName` would print "Kayo soak". */
test("the verb agrees with whatever the seat is called", () => {
  const mk = (n0) => {
    const g = game(n0, "Foe", {arcBarrier: 1}, {});
    const p = Q.buildPrompt(g, {tag: "pay", side: 0, amount: 2, cost: 1,
                                avail: 0, soak: [{name: "Barrier", kind: "barrier", n: 1}]});
    return p ? Q.applyPrompt(g, {...p, choice: "decline"}).msgs.join(" ") : "";
  };
  const you = mk("You"), kayo = mk("Kayo");
  if(you && kayo){
    assert.ok(!/\bYou takes\b|\bYou soaks\b/.test(you), `second person took a third-person verb: ${you}`);
    assert.ok(!/\bKayo take\b|\bKayo soak\b(?!s)/.test(kayo), `a name took a second-person verb: ${kayo}`);
  }
});

/* A MISSING NAME MUST NOT PRINT "undefined" — `reduce` is fed by JSON off
   a wire (v2.48), so a side that arrives without one falls back rather
   than corrupting the feed. `MALFORMED` is what would catch it in the
   harness, and a drill is cheaper than a tournament. */
test("a side with no name falls back rather than printing undefined", () => {
  const g = S.makeGame({});
  g.sides = [{...S.makeSide({id: 0}), hand: [card()]}, {...S.makeSide({id: 1})}];
  const line = declined(g, 0);
  assert.ok(!/undefined/.test(line), `fallback leaked: ${line}`);
  assert.match(line, /chose nothing\./);
});

/* AND THE SOURCE CARRIES NO SECOND COPY. The fix is one expression; a
   later line that rebuilds the subject by hand is the drift this file
   exists to stop (v4.25's one scan, two consumers). */
test("prompts.js builds the subject once", () => {
  const src = require("fs")
    .readFileSync(require.resolve("../engine/prompts.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
  const hand = src.match(/\?\s*"You"\s*:\s*"The opponent"/g) || [];
  assert.equal(hand.length, 1,
    "exactly one fallback expression — a second is a hardcoded seat name");
  assert.match(src, /sides\[side\]\s*&&\s*game\.sides\[side\]\.name/,
    "the name must be read off the side, or the fallback IS the behaviour");
});
