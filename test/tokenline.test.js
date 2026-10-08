/* ======================================================================
   THE TOKEN-CREATED LINE (v5.00)

   Found by READING self-play feeds rather than counting them:
     "Might created on Lyath Goldmane's board — … gets +1{p}.."
   The line quotes the token's first sentence and appends a period, and a
   token whose whole text is ONE sentence already ends in one. And its foe
   half hand-rolled the possessive, which v4.22 measured as reading
   "You's board" on the trainer whenever the token lands under seat 0's
   control from a seat-1 actor. Both are the feed the player TRUSTS.

   Driven through `runOps`, asserting the line rather than the state — the
   state is identical either way, so the line is the observable (v3.60).
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const line = g => (g.feed || []).find(m => / created on /.test(m)) || "";

test("a one-sentence token text is quoted with exactly one period", {skip}, () => {
  H.db();
  const g = H.runOps(H.state({name: "Kayo"}, {name: "Dorinthea"}), [["token", "Might", 1, "self"]], "Probe");
  const l = line(g);
  /* v5.08: the line leads with its SOURCE — the shape every other
     `runOps` line has — so two mints from two sources read as two */
  assert.match(l, /^Probe: Might created on Kayo's board — /, l);
  assert.doesNotMatch(l, /\.\.$/, "a doubled period: " + l);
  assert.match(l, /[^.]\.$/, "the line still ends its sentence: " + l);
});

test("a token under the OTHER seat names that seat — and seat 0 called You possesses as 'your'", {skip}, () => {
  H.db();
  const g = H.runOps(H.state({name: "You"}, {name: "Dorinthea"}, {actor: 1, turnPlayer: 1}),
    [["token", "Frostbite", 1, "foe"]], "Probe");
  const l = line(g);
  assert.match(l, /created on your board/, l);
  assert.doesNotMatch(l, /You's/, l);
  const h = H.runOps(H.state({name: "Kayo"}, {name: "Dorinthea"}), [["token", "Frostbite", 1, "foe"]], "Probe");
  assert.match(line(h), /created on Dorinthea's board/, "the hero name keeps its apostrophe-s");
  /* the SELF half, the trainer's ordinary case: seat 0 mints its own */
  const own = H.runOps(H.state({name: "You"}, {name: "Dorinthea"}), [["token", "Might", 1, "self"]], "Probe");
  assert.match(line(own), /created on your board/, line(own));
});
