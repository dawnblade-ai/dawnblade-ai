/* ============================================================
   THE CR INDEX IS A VERDICT, NOT A REPORT.

   `tools/crindex.js` scores every CR rule this project cites as
   **guarded** / **UNGUARDED** / drill-only / prose, and its whole argument
   is that a rules revision arrives as a renumbered CR rather than as a
   diff — so the cost of absorbing one is exactly how many places encode a
   rule where nothing would turn red.

   IT HAD A GATE THAT COULD NEVER BE GREEN, AND NOTHING RAN IT. `--check`
   demanded ZERO unguarded rules; several of the project's citations are
   SECTION POINTERS — a whole section named as a whole rather than a rule —
   and no drill can drive one, so the gate exited non-zero on every run
   since v3.17 and no drill and no CI step ever called it. A check that is
   always red is a check nobody reads: v3.41's doc-claim-with-no-assertion
   in a green-CI coat.

   AND WRITING THIS FILE MOVED THE INDEX, WHICH IS THE HAZARD THE TOOL'S
   OWN HEADER NAMES. Its first draft spelled two of those section pointers
   in this comment — prose, in a file the scan classifies as a DRILL — and
   both were upgraded from UNGUARDED to guarded on the strength of a
   sentence that drives nothing. Same trap `sync.test.js` documents, and
   the same answer: REWORD THE PROSE RATHER THAN WEAKEN THE SCAN. Nothing
   below spells a citation it does not drive; the pinned sets are built
   from the tool's output, never typed.

   RE-DERIVED AT v4.02, eighty-five versions after the numbers were last
   written down: **63 distinct rules, 50 guarded, 3 UNGUARDED**. The
   verdicts had not moved at all — a CLEAN RESULT, and worth having PROVED
   rather than assumed (v3.97, v4.00), which is why the sets are pinned
   below: "the scan found nothing" must not be able to pass for "everything
   is accounted for".

   THE CITATION COUNT HAD MOVED, AND IT WAS THE TOOL COUNTING ITSELF. It
   scans every `*.md` in the root and WRITES `CR-INDEX.md` into that same
   directory, so 123 of the 1123 citations it reported were its own output
   — and, worse, a rule that appeared once could never leave the index,
   because the report had written it down. Found by SABOTAGE: a fake rule
   injected into engine/ to prove this drill bites was still in the index
   after the sabotage was reverted. Excluded at v4.02; the honest count is
   1000.

   THE ONE THING THAT DID MOVE IS THE `prose` BUCKET, 6 -> 4, and the
   approximation ledger moved it. A rule cited only in documentation is one
   this project has written ABOUT and never encoded; two of them are now
   pinned by a drill that asserts the deviation and fails the day it is
   built. That is the ledger doing its job at the level of the index.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const idx = () => JSON.parse(execFileSync(process.execPath,
  [path.join(ROOT, "tools", "crindex.js"), "--json"],
  {cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024})).rules;

const by = (rs, v) => rs.filter(r => r.verdict === v).map(r => r.rule).sort();

test("crindex — the verdict counts are pinned", () => {
  const rs = idx();
  assert.equal(rs.length, 63, "the number of distinct CR rules this project cites moved");
  assert.equal(by(rs, "guarded").length,   50, "guarded count moved");
  assert.equal(by(rs, "UNGUARDED").length,  3, "UNGUARDED count moved");
  assert.equal(by(rs, "drill-only").length, 6, "drill-only count moved");
  assert.equal(by(rs, "prose").length,      4, "prose count moved");
});

/* A COUNT IS NOT A SET. Two rules swapping buckets keeps every number
   above intact, which is exactly the shape v3.98's qualifier census had to
   fix — so the members are pinned too. */
test("crindex — the UNGUARDED set is the three section pointers, by name", () => {
  const rs = idx();
  assert.deepEqual(by(rs, "UNGUARDED"), ["4.3.1", "4.4", "7"],
    "a rule crossed into UNGUARDED, or one of the section pointers grew a drill. " +
    "READ THE SITE FIRST — an UNGUARDED verdict is a LEAD, not a finding: it " +
    "measures CITATION coverage, and v3.17's own first run had a false alarm " +
    "(CR 8.1.3 cited where the rule is 8.1.3a, behaviour driven over all fifteen " +
    "of the pool's defence reactions) beside a real one.");
});

test("crindex — the prose-only set is pinned, and it is where the unbuilt rules live", () => {
  const rs = idx();
  assert.deepEqual(by(rs, "prose"), ["4.5.3a", "6.3", "6.4", "7.5.2"],
    "the set of rules cited ONLY in documentation moved. A rule leaving this set " +
    "has been encoded (good — check it gained a drill too); a rule arriving has " +
    "been written about and not built, and belongs in tools/approx.js.");
  /* AND THE LAYER-STEP RULE HAS LEFT `prose` FOR `drill-only` — cited by no
     engine code, because it is not built, and now pinned by the drill that
     asserts the deviation. The ledger and the index must not be able to
     disagree about which rule that is. */
  const A = require("../tools/approx.js");
  const lay = A.APPROX["layer-step-window"].cr.replace(/^CR /, "");
  assert.ok(by(rs, "drill-only").includes(lay),
    "the ledger's layer-step record cites a rule the index no longer files as " +
    "drill-only — either it was built (delete the record) or the probe stopped " +
    "driving it");
  assert.ok(!by(rs, "guarded").includes(lay),
    "the layer step is now cited in ENGINE code — it is being built, and the " +
    "ledger record must move");
});

test("crindex --check passes, and it is the gate that could not before", () => {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, "tools", "crindex.js"), "--check"],
    {cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  assert.match(out, /check: the UNGUARDED set is exactly the 3 allowed section pointers/,
    "`--check` no longer reports a clean verdict");
});
