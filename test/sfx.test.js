/* THREE SOUNDS THAT MEAN THREE THINGS (v6.50, UX roadmap step 9, POLISH §4).
   The board plays a hit, a block or a prevention when a link resolves. This
   drill holds the shape the page cannot be unit-run for:
   - the voices are exactly the three outcomes the engine records
     (`effects.linkOutcome`'s words, the keys of OUT_WORD) — a fourth sound, or
     a missing one, is a sound that means nothing or an outcome heard as silence;
   - BOTH boards mount the listener beside the stamp (a rule on one board does
     not exist on the other);
   - the sounds are synthesized: no audio file, no audio URL, nothing fetched.
   The behaviour (silent on mount, once per new outcome, mute holds) was driven
   in the real page through tools/page.js's `open()` — see CHANGELOG v6.50.
   Sabotage checked: deleting one board's <LinkSfx> fails the census; adding a
   `fizzle` voice fails the key match; an `.mp3` src fails the self-hosted row. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const objKeys = (name) => {
  const i = src.indexOf("const " + name + " = {");
  assert.ok(i > 0, name + " is declared");
  const body = src.slice(i, src.indexOf(name === "VOICE" ? "\n  };" : "};", i));
  return [...body.matchAll(/(?:^|[{,\n])\s*([a-z]+)\s*:/g)].map(m => m[1]).filter(k => k !== name);
};

test("the voices are the three outcomes, no more and no fewer", () => {
  const words = objKeys("OUT_WORD").sort();
  const voices = objKeys("VOICE").sort();
  assert.deepEqual(words, ["blocked", "hit", "prevented"]);
  assert.deepEqual(voices, words);
});

test("both boards hear the link: every stamp has its listener", () => {
  const stamps = src.split("<LinkStamp l={featOutcome(featured, g.chain)}").length - 1;
  const ears = src.split("<LinkSfx chain={g.chain}/>").length - 1;
  assert.equal(stamps, 2, "the trainer and the table each stamp the featured slot");
  assert.equal(ears, stamps, "each stamp has a LinkSfx beside it");
  const navs = src.split('<div className="screennav">').length - 1;
  assert.ok(src.split("<SoundBtn/>").length - 1 >= 2, "both boards carry the mute toggle (" + navs + " nav rows)");
});

test("the sounds are synthesized: no audio file or URL anywhere on the page", () => {
  assert.ok(!/\.(mp3|ogg|wav|m4a|aac|flac)\b/i.test(src), "no audio file named");
  assert.ok(!/new Audio\(|<audio/i.test(src), "no <audio> element or Audio()");
  assert.ok(/createOscillator\(\)/.test(src) && /createBuffer\(/.test(src), "Web Audio builds the voices");
});
