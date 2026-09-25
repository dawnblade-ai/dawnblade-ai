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

test("the families are ALIVE — each matches the clause of a card that left it", () => {
  /* EVERY FAMILY EMPTIED BY BEING BUILT (v4.71). This drill used to ask the
     report for its largest family, and its own comment recorded why that
     rotted: the count IS the work (v3.53, v4.58). With Beckoning Haunt, the
     last one left, so the report can no longer prove a pattern is alive —
     an empty bucket and a rotted pattern both print nothing (v3.81).

     SO EACH PATTERN IS HELD AGAINST A PRINTED CLAUSE IT EXISTS TO CATCH,
     taken from a card that was in it and left by being built. That is the
     property the old drill was reaching for, with no magnitude in it. */
  const {FAMILIES} = require("../tools/gaps.js");
  const CONTROL = {
    "pick from a zone":            "Return target aura with cost X from your graveyard to your hand.",
    "counters on a permanent":     "Put three +1{p} counters on target sword you control.",
    "create a token on a trigger": "When this hits a hero, create a Gold token.",
    "\"you may …, if you do …\"": "When this defends, you may pay {r}. If you do, it gets +2{d}.",
    "a granted / conditional keyword": "If it's fused, it gets go again.",
  };
  assert.deepEqual(FAMILIES.map(f => f[0]).sort(), Object.keys(CONTROL).sort(),
    "the family list moved — give the new one a control clause here");
  for(const [label, re] of FAMILIES)
    assert.ok(re.test(CONTROL[label]), label + " no longer matches the clause it was written for");
  /* and requiring it printed nothing and read no audit, or a drill would
     depend on a build artifact to ask about a pattern */
  assert.ok(Array.isArray(FAMILIES) && FAMILIES.length === 5);
});

test("every bucket the report prints lists exactly as many cards as it counts", {skip}, () => {
  /* A heading printed over an empty roll call, or a roll call that lost a
     name, reads exactly like a correct report (v3.81). Held for every bucket
     that prints — the families that have members and `unclustered`. */
  const out = run();
  const heads = [...out.matchAll(/^\s*(\d+)\s{2}(\S[^\n]*?)(?:\s{3}—[^\n]*)?\n(?:\s{6}needs:[^\n]*\n)?\s{6}([^\n]*)$/gm)];
  assert.ok(heads.length >= 1, "the report printed no bucket at all — the scan found nothing");
  for(const h of heads){
    const listed = h[3].split("·").map(x => x.trim()).filter(Boolean);
    assert.equal(listed.length, +h[1], h[2].trim() + ": " + h[1] + " counted, [" + listed.join(", ") + "] listed");
  }
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
