/* ============================================================
   THE GAP REPORT (v3.52)

   The audit answers "how much of this card is read" and the stack answers
   "which RULING is missing". Neither answers what a session actually opens
   with: **of the cards that are not finished, what one reader closes the
   most of them?**

   It is a REPORT, not a claim — a card lands in the first family it
   matches, "unclustered" is an honest answer, and the counts are printed.
   The failure mode is the one this project names most often: **a scan
   aimed at the wrong shape passes by finding nothing.** So the drills pin
   that it finds something, that its arithmetic is a partition, and that a
   stale read is visible.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIT = path.join(ROOT, "tools", "audit.json");
const skip = !fs.existsSync(AUDIT) && "no tools/audit.json — run: npm run audit";

const run = (...args) => execFileSync("node", [path.join(ROOT, "tools", "gaps.js"), ...args],
  {encoding: "utf8", env: {...process.env, NO_COLOR: "1"}});

test("it reports the unfinished cards, and the families PARTITION them", {skip}, () => {
  const A = JSON.parse(fs.readFileSync(AUDIT, "utf8"));
  const unfinished = Object.values(A.cards).filter(c =>
    c.tier !== "full" && (c.clauses || []).some(x => x.st === "skip")).length;
  const out = run();
  const total = +(out.match(/(\d+) unfinished/) || [])[1];
  assert.equal(total, unfinished, "the header must count what the audit counts");

  /* THE PARTITION IS THE POINT. A family that quietly stopped matching
     would move its cards to `unclustered` rather than losing them, and a
     family that matched twice would double-count — either way the sum
     stops equalling the total, which is the one check that cannot be
     satisfied by finding nothing. */
  const buckets = [...out.matchAll(/^\s*(\d+)\s{2}\S.*$/gm)].map(m => +m[1]);
  const sum = buckets.reduce((a, b) => a + b, 0);
  assert.equal(sum, total,
    "families + unclustered must sum to the unfinished count — got " + buckets.join("+"));
});

test("it finds something — a scan aimed at the wrong shape passes by finding nothing", {skip}, () => {
  const out = run();
  assert.match(out, /pick from a zone/, "the largest family must still match");
  const n = +(out.match(/(\d+)\s+pick from a zone/) || [])[1];
  assert.ok(n >= 5, "the `pick` family collapsing to a handful means a pattern rotted: " + n);
  assert.match(out, /ONE clause away/, "the one-clause count is the reason to read this at all");
});

test("a stale read is VISIBLE, not silent", {skip}, () => {
  /* It reads a build artifact. A report a month older than the code is a
     report about a codebase that no longer exists, and the only thing
     worse than no answer is a confident stale one. */
  const A = JSON.parse(fs.readFileSync(AUDIT, "utf8"));
  const orig = A.appVer;
  try {
    fs.writeFileSync(AUDIT, JSON.stringify({...A, appVer: "0.01"}));
    assert.match(run(), /audit\.json is v0\.01 and the app is/, "it must warn when stale");
  } finally {
    fs.writeFileSync(AUDIT, JSON.stringify({...A, appVer: orig}, null, 1));
  }
});

test("two printings of one card are named apart", {skip}, () => {
  /* The audit is keyed name|pitch, so a bare name list prints "Crankshaft ·
     Crankshaft" and reads as a duplicate bug in the report itself. */
  const out = run();
  const dupes = out.match(/(\w[\w' ]*) p\d/g) || [];
  const bare = (out.match(/Crankshaft(?! p)/g) || []).length;
  assert.equal(bare, 0, "a card at two pitches must carry its pitch: " + dupes.join(", "));
});

test("the dossier answers for one card", {skip}, () => {
  /* THE FIXTURE IS TAKEN FROM THE LIVE REPORT, not hardcoded. It named
     Astral Etchings until v3.55 closed that card, and the drill then
     failed for the best possible reason — which is still a drill rotting
     every time the project does its job. A dossier is about whatever is
     UNFINISHED, so ask the report which cards those are and pick one. */
  /* NOT the `needs:` line, which is indented identically — matching it
     picked up prose, and `out.includes(...)` then passed against the
     report's own header while the real assertion failed. */
  const listed = run().match(/^      (?!needs:)(\S.*)$/m);
  assert.ok(listed, "the report must list at least one unfinished card");
  const first = listed[1].split(" · ")[0].replace(/\*$/, "").replace(/ p\d$/, "").trim();
  const out = run(first.slice(0, 12));
  assert.ok(out.includes(first), "the dossier must name the card it was asked for: " + first);
  assert.match(out, /unread:/, "it must print the clause, not just the name");
});

test("it is wired as `npm run gaps`", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.gaps, "node tools/gaps.js",
    "a tool nobody can invoke is a tool nobody runs");
});
