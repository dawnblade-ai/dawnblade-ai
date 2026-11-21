/* THE CARD GOES WHERE YOU SENT IT (v6.50, UX roadmap step 6).
   The commit tap of the two-tap hand marks the tile's box (`Glide.mark`) and the
   featured slot plays itself back from it (`FeatCard`, FLIP via Web Animations).
   Driven in the real page at 393x852 under 4x CPU throttle (CHANGELOG v6.50): one
   240 ms animation on `.featured`, every frame of it 17 ms, the slot's overflow lifted
   and restored, none under reduced motion. This drill holds the wiring the page cannot
   be unit-run for: BOTH taps-twice mark before they commit (a rule on one board does
   not exist on the other), BOTH featured slots are the one component, and the motion
   asks reduced-motion. Sabotage checked: dropping either `Glide.mark` fails the first
   row; a raw `.featured` div on one board fails the second; deleting the media query
   fails the third. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("both two-tap commits mark where the tile was, before they commit", () => {
  const defs = src.split("const tapTwice = (card, verb, commit) => (e) => {").slice(1).map(b => b.slice(0, b.indexOf("};")));
  assert.equal(defs.length, 2, "the table's (usePeek) and the trainer's");
  for(const b of defs) assert.match(b, /Glide\.mark\(card, e\);\s*commit\(\);/);
});

test("both boards' featured slot is FeatCard", () => {
  assert.equal(src.split("<FeatCard card={featured.card}/>").length - 1, 2);
  assert.ok(!/<div className="featured"><CardFrame/.test(src.replace(/function FeatCard[\s\S]*?\n}\n/, "")), "no raw featured slot left");
});

test("the glide is off under reduced motion and uses one mark once", () => {
  const g = src.slice(src.indexOf("const Glide = "), src.indexOf("function FeatCard"));
  assert.match(g, /prefers-reduced-motion: reduce/);
  assert.match(g, /last = null;/, "a mark is consumed");
  assert.match(g, /m\.uid !== uid/, "only the card the tap committed glides");
});
