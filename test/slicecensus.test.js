/* ============================================================
   EVERY SOURCE SLICE A DRILL TAKES, AND HOW WIDE IT IS (v4.57)

   A drill that reads a function out of a source file bounds it with two
   `indexOf` anchors. Nothing checked what those anchors actually reached,
   and v4.57 found the two ways that goes wrong — in the same version, in
   the same file:

     `test/priority.test.js` sliced the end phase between CR rule NUMBERS.
     Three COMMENTS cite CR 4.4.3d, the first 394 lines above the step
     marker, so `indexOf` had never once found the step: the slice was
     24,952 characters where the step is 1,680, and the `weaponUsed = {}`
     it found was the right one by coincidence. Demonstrated both ways —
     delete the untap from step (d), plant one in a comment 370 lines up,
     and the drill PASSES.

     The same file sliced `execute` out of `engine/effects.js` and bounded
     it at a section divider SEVEN functions away — 3,317 lines where
     `execute` is 2,236, swallowing `autoPitch`, `activateHandAbility`,
     `applyAnswer`, `fileAttack`, `resolveClash`, `defendsTriggers` and
     `afterDefenders`. Two of its five assertions were therefore about a
     DIFFERENT FUNCTION than the one the drill names, and its own comment
     said "the ONE bare -1 left in execute" when `execute` has none.

   v4.21's rule: when you fix two members of a family, census the family.

   ITS REACH IS STATED, BECAUSE A SCAN'S BLIND SPOT IS PART OF ITS CLAIM. It
   sees ONE shape: two quoted `indexOf` anchors on the same holder. It is
   therefore blind to the SAFER form — bounding at the next same-indent
   declaration with a `search` — which is exactly what the two slices v4.57
   corrected now use. That is the right blindness: what this measures is the
   loose form, and a slice that leaves the census has been tightened. It is
   also blind to a FIXED-WIDTH window, which has its own hazard in the
   opposite direction (v4.05: too narrow INVENTS findings) and is a different
   job. The pattern's own control below pins both blind spots.

   WIDTH IS WHAT THIS CENSUS CAN MEASURE, AND INTENT IS NOT. A comment is
   a legitimate anchor — the end-phase step markers are comments BY DESIGN
   — so a scan cannot tell a deliberate marker from an earlier accidental
   one, and a check that flagged every comment anchor would sit red on
   every ship (which is how UNFAIR came to read 1 for nineteen versions).
   So the SET of widths is pinned as data: a slice that widens fails, and
   moving one is a deliberate edit — `wire.test.js`'s `HEADLESS` shape.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILES = ["index.html", "engine/effects.js", "engine/judge.js", "engine/parser.js",
               "engine/build.js", "engine/prompts.js", "engine/game.js", "engine/sides.js",
               "engine/priority.js", "tools/selfplay.js", "tools/approx.js"];
const SRC = {};
for(const f of FILES) SRC[f] = fs.readFileSync(path.join(ROOT, f), "utf8");

const unq = s => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n")
                  .replace(/\\t/g, "\t").replace(/\\\//g, "/");


/* One holder, sliced between two of its own quoted `indexOf` anchors — the
   SAME holder on both sides, which is what makes it a real source slice
   rather than two unrelated lookups.

   AND THE PATTERN IS NOT WRITTEN OUT IN PROSE ANYWHERE IN THIS FILE. The
   first draft spelled it in this very comment, so the census found itself and
   reported `UNRESOLVED:X` — the instrument built to catch a scan that reads
   documentation, reading its own (v4.27, v4.32). The answer is this project's
   own: REWORD THE PROSE, never weaken the scan. Stripping comments instead
   was tried and cost a legitimate row: `phasebar.test.js` anchors on a
   literal that IS a block-comment divider, so a crude stripper eats the
   ANCHOR — which is exactly what `html-balance.test.js`'s pre-neutralize
   list exists for. Writing that divider out here closed THIS comment early
   and the file stopped parsing, which is the orphaned-terminator bug that
   shipped in v2.27 and broke the page, inside a note about stripping
   comments. A future drill that documents this shape will be reported as
   UNRESOLVED, loudly, and should be reworded too. */
const RX = /\b(\w+)\.slice\(\s*\1\.indexOf\(\s*"((?:[^"\\]|\\.)*)"\s*\)\s*,\s*\1\.indexOf\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

/* WHICH FILE IS THE HOLDER? RESOLVED, NOT GUESSED. The first draft paired
   each literal against every file where BOTH anchors happened to exist, and
   reported `priority.test.js engine/judge.js 108667` — a slice of judge.js
   that no drill takes, because the holder there is `HTML`. The CR 4.4.3e/f
   markers exist in both files, so the coincidence is real and the row was a
   FALSE POSITIVE in the very instrument built to catch them (v4.00, and it
   is the second time in this version that a scan of mine over-reported).
   So the holder's own assignment decides, and a holder we cannot resolve is
   reported rather than silently dropped. */
function holderFile(t, name){
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp("\\b(?:const|let|var)\\s+" + esc + "\\s*=([^;]*);").exec(t)
        || new RegExp("\\b" + esc + "\\s*=([^;]*);").exec(t);
  if(!m) return null;
  for(const f of FILES){
    /* "index.html" appears whole; "engine/effects.js" is written as
       path.join(..., "engine", "effects.js") as often as as one string. */
    const parts = f.split("/");
    if(m[1].includes('"' + f + '"')) return f;
    if(parts.every(p => m[1].includes('"' + p + '"'))) return f;
  }
  return null;
}

function census(){
  const out = [];
  for(const tf of fs.readdirSync(path.join(ROOT, "test")).filter(f => f.endsWith(".test.js"))){
    const t = fs.readFileSync(path.join(ROOT, "test", tf), "utf8");
    let m; RX.lastIndex = 0;
    while((m = RX.exec(t))){
      const holder = m[1], a = unq(m[2]), b = unq(m[3]);
      const f = holderFile(t, holder);
      if(!f){
        /* A SLICE OF A SLICE IS BOUNDED BY ITS PARENT, so it is DERIVED rather
           than unresolved — three drills do it (`TABLE`, `bar`, `lit`) and each
           one narrows a source holder this census already measures. Named
           apart rather than dropped: a census that silently skips what it
           cannot parse reads exactly like a clean codebase (v3.81, v4.07). */
        const asn = new RegExp("\\b(?:const|let|var)\\s+" + holder + "\\s*=([^;]*);").exec(t);
        const kind = asn && /\.slice\(|\(\)\.slice\(/.test(asn[1]) ? "DERIVED:" : "UNRESOLVED:";
        out.push({tf, f: kind + holder, w: 0});
        continue;
      }
      const raw = SRC[f], ia = raw.indexOf(a), ib = raw.indexOf(b);
      if(ia < 0 || ib < 0 || ib <= ia) continue;   /* B precedes A, or an anchor is gone */
      out.push({tf, f, w: ib - ia});
    }
  }
  return out;
}

test("the pattern matches a real slice and not a near-miss", () => {
  /* BUILT BY CONCATENATION, because written as a literal the phrase would
     appear in THIS file and the census would find it (v4.32, v4.36). */
  const hit  = "ZZ" + ".slice(ZZ.indexOf(\"a\"), ZZ.indexOf(\"b\"))";
  const miss = "ZZ" + ".slice(YY.indexOf(\"a\"), YY.indexOf(\"b\"))";
  const win  = "ZZ" + ".slice(ZZ.indexOf(\"a\"), ZZ.indexOf(\"a\") + 900)";
  RX.lastIndex = 0; assert.ok(RX.exec(hit), "a real source slice must be seen");
  RX.lastIndex = 0; assert.equal(RX.exec(miss), null,
    "…and TWO holders is not one slice, or the census pairs unrelated lookups");
  /* A FIXED-WIDTH WINDOW IS MATCHED BY THE PATTERN AND EXCLUDED BY THE
     CENSUS, and asserting the wrong one of those was my own control's first
     draft. The pattern does not require a closing paren after the second
     `indexOf`, so `X.indexOf("a") + 900` reads as anchor B === anchor A —
     and `ib <= ia` is what drops it. That shape has its own hazard (v4.05:
     too narrow INVENTS findings, and v4.49 had one report a line missing
     from a body that contains it) and is deliberately out of scope here, so
     what is pinned is WHICH guard does the excluding. */
  RX.lastIndex = 0;
  const w = RX.exec(win);
  assert.ok(w, "the pattern DOES match a fixed-width window…");
  assert.equal(w[2], w[3], "…reading its two anchors as the same one…");
  RX.lastIndex = 0;
  assert.ok(!census().some(r => r.w <= 0 && !r.f.includes(":")),
    "…and the census drops it, because a slice needs B strictly after A");
});

test("the census finds the slices at all, or it passes by finding nothing", () => {
  /* v3.81, v4.07: a scan aimed at the wrong SHAPE reports zero exactly as a
     clean codebase does. So the count is asserted before anything is judged. */
  const rows = census();
  assert.ok(rows.length >= 10,
    "found only " + rows.length + " source slices — the pattern stopped matching, "
    + "which looks identical to a codebase with none");
});

test("no drill slices more than 200,000 characters of a source file", () => {
  /* THE CAP IS DELIBERATELY GENEROUS AND THE POINT IS THE CEILING. `execute`
     is 141,000 characters on its own, so a cap tight enough to be interesting
     per-slice would be a different number per slice — which is the pinned set
     below. What this asserts is that nothing slices a whole FILE, which is what
     a stale end anchor produces: `indexOf` answers -1, `slice(i, -1)` runs to
     one character short of the end, and the drill passes by reading everything.
     That has happened twice here (v2.73's export list, v4.57's divider). */
  for(const r of census())
    assert.ok(r.w < 200000,
      r.tf + " slices " + r.w + " chars of " + r.f + " — a stale end anchor reads "
      + "the whole file and passes by reading too much");
});

test("which SOURCE FILE each slice reads is pinned, or the resolver is unwatched", () => {
  /* THE RESOLVER'S ANSWER HAD NO DRILL, and a sabotage found it: forcing
     every holder to "index.html" came back SILENT, because 14 of the 18 rows
     really are index.html and the one that is not — `build.test.js` reading
     `engine/build.js` — simply DROPPED out (its anchors do not exist in the
     other file), leaving the count above the alive-check's floor. A census
     that loses a row reads exactly like one with nothing to report (v3.81,
     v4.07), so the DISTRIBUTION is the thing to pin. */
  const by = {};
  for(const r of census()) by[r.f] = (by[r.f] || 0) + 1;
  assert.deepEqual(by, {
    "index.html": 14,
    "engine/build.js": 1,
    /* +2 AT v4.59, READ FIRST: `dichotomy.test.js` pins that `buildPrompt`
       names the new `filters` field (v2.34's rule, ninth field) and that
       `promptZone` DELEGATES to `promptSideZone` rather than keeping a second
       copy of the three zone shapes. Both are claims about `prompts.js`, so
       the census gains a third source file — which is exactly the row this
       drill exists to make visible (v3.81, v4.07: a census that silently
       gains or loses a row reads like one with nothing to report). */
    "engine/prompts.js": 2,
    "DERIVED:TABLE": 1,
    "DERIVED:bar": 1,
    "DERIVED:lit": 1
  }, "a slice changed which file it reads, or the holder resolver stopped "
   + "distinguishing them — read the row before repinning");
});

test("the WIDEST slices are pinned, so one growing is a deliberate edit", () => {
  /* Pinned as a SET with the file and the width, the way `HEADLESS` is. A slice
     that widens because its end anchor went stale shows up here rather than as a
     drill that quietly starts reading its neighbours. Only the widest are pinned:
     the small ones are bounded by construction and pinning all 21 would make
     every drill edit a two-file edit for no gain. */
  const rows = census().filter(r => r.w > 8000)
    .map(r => r.tf + " " + r.f + " " + r.w).sort();
  assert.deepEqual(rows, [
    /* +dichotomy AT v4.59: `buildPrompt`'s PICK BRANCH, anchored at the
       branch rather than at the function — at the declaration it read the
       `opt` branch too (13,303 chars for a claim about one field), which is
       a bound too wide reading exactly like a drill that passes (v4.57). */
    "dichotomy.test.js engine/prompts.js 11759",
    "dorinthea.test.js index.html 8550",
    "phasebar.test.js index.html 15953",
    "phasebar.test.js index.html 62489",
    "priority.test.js index.html 16557",
    "priority.test.js index.html 16557",
    "priority.test.js index.html 8550"
  ], /* 15,440 -> 16,557 AT v4.59, READ FIRST (v4.57: a pin edited without
        being read is a guard switched off). Both rows are
        `tryPlay` -> `confirmPay` — anchored on the body's own declaration and
        bounded at the NEXT one, which is the safe form — and the growth is
        v4.59's new activation legality, inserted INTO `tryPlay` beside the
        four costs it sits with. The anchors still bound the body the drill
        names, which is the question this census exists to ask. */
     "a slice over 8,000 characters moved — read it before repinning, and check "
   + "the anchors still bound the body the drill NAMES (v4.57)");
});

test("every holder resolves to a source file, or the census is under-reporting", () => {
  /* A holder the resolver cannot place is reported as UNRESOLVED rather than
     dropped, because a census that silently skips what it cannot parse reads
     exactly like a clean codebase (v3.81, v4.07) — and this instrument has
     already over-reported once in this version, so it must not be allowed to
     under-report in the other direction without saying so. */
  const rows = census();
  assert.deepEqual(rows.filter(r => r.f.startsWith("UNRESOLVED:")).map(r => r.tf + " " + r.f), [],
    "a slice's holder could not be traced to a source file — either name the "
    + "path in its assignment, or teach the resolver deliberately");
  /* AND THE DERIVED ONES ARE PINNED, both directions (v4.17): one arriving is
     a new second-order slice somebody should have bounded, and one leaving
     means a drill stopped reading source where it used to. */
  assert.deepEqual(rows.filter(r => r.f.startsWith("DERIVED:"))
                       .map(r => r.tf + " " + r.f).sort(),
    ["arenaability.test.js DERIVED:TABLE",
     "phasebar.test.js DERIVED:bar",
     "sides.test.js DERIVED:lit"]);
});
