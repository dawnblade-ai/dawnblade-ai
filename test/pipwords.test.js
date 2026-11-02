/* THE PRINTED PIPS READ AS WORDS ON THE SCREEN (1.0 polish audit).

   Card text carries its icons as tokens and the engine keeps them in the
   feed verbatim (v4.98). The screen drew them raw — "Bare Fangs:
   discarded Bare Fangs (7{p}) at random.", "Kayo's hero ability: the first
   card with 6 or more {p} …" — found reading Kayo's trainer feed at 393x852.
   `game.pipParts` is the one body; `PipLine` draws it on both boards' feed,
   the ticker, the advisor and the prompt sheet. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../engine/game");
const { html } = require("./helpers/extract");

test("stat pips read as nouns, counted pips as counts", () => {
  const cases = [
    ["discarded Bare Fangs (7{p}) at random.", "discarded Bare Fangs (7 power) at random."],
    ["the first card with 6 or more {p} Kayo has discarded", "the first card with 6 or more power Kayo has discarded"],
    ["nothing that can take a +1{p} counter.", "nothing that can take a +1 power counter."],
    ["it takes -1{p}.", "it takes -1 power."],
    ["The base {p} and {d} of cards", "The base power and defense of cards"],
    ["gain 2{h}", "gain 2 life"],
    ["costs {r} less", "costs 1 resource less"],
    ["Pay {r}{r}{r}: draw", "Pay 3 resources: draw"],
    ["{c}{c}{c}: Create a Spectral Shield", "3 chi: Create a Spectral Shield"],
    ["no pips at all", "no pips at all"],
  ];
  for(const [raw, want] of cases) assert.equal(G.pipWords(raw), want, raw);
});

test("an icon the table does not know stays as printed, never a guessed word", () => {
  assert.equal(G.pipWords("{x}{x}{r}, destroy this"), "{x}{x}1 resource, destroy this");
  assert.equal(G.pipWords("{q} oddity"), "{q} oddity");
});

test("each word names its icon, and plain text is merged", () => {
  assert.deepEqual(G.pipParts("+1{p} and {r}"), [["+1 ", null], ["power", "p"], [" and ", null], ["1 resource", "r"]]);
  assert.deepEqual(G.pipParts(null), []);
});

test("both boards' feed, the ticker, the advisor and the prompt sheet draw through PipLine", () => {
  const src = html();
  assert.ok(/pipParts = DawnGame\.pipParts/.test(src), "the bridge lifts pipParts");
  const logs = src.match(/className="gamelog"[^\n]*/g) || [];
  assert.equal(logs.length, 2, "two feeds, one per board");
  for(const l of logs) assert.ok(/<PipLine s=\{l\}\/>/.test(l), "feed line drawn raw: " + l.slice(0, 120));
  assert.ok(/className="cap" key=\{idx\}><PipLine s=\{shown\}\/>/.test(src), "the ticker draws raw");
  assert.ok(/<PipLine s=\{rec\.line\}\/>/.test(src) && /<PipLine s=\{rec\.why\}\/>/.test(src), "the advisor draws raw");
  assert.ok(/className="phint"><PipLine s=\{p\.hint\}\/>/.test(src), "the prompt hint draws raw");
});
