#!/usr/bin/env node
/* tools/crindex.js — WHICH CR RULES DOES THIS ENGINE DEPEND ON, AND WHO GUARDS THEM?
 *
 *   node tools/crindex.js            ranked report + CR-INDEX.md
 *   node tools/crindex.js --json     machine-readable
 *   node tools/crindex.js --check    exit non-zero if a NEW rule is UNGUARDED
 *
 * `--check` USED TO DEMAND ZERO, AND IT COULD NEVER BE GREEN.  Three of the
 * project's citations are SECTION POINTERS — "CR 4.4" naming the end phase as a
 * whole, "CR 7" naming combat — and a section is not a rule a drill can drive.
 * So the gate failed on every run since v3.17 and nothing ever called it: a
 * check that is always red is a check nobody reads, which is the same defect as
 * a doc claim with no assertion (v3.41) wearing a green-CI coat.
 *
 * IT PINS A SET NOW, the way `wire.test.js`'s HEADLESS list does.  A rule
 * crossing the line is a deliberate edit to `ALLOWED_UNGUARDED`, and a NEW one
 * fails.  `test/crindex.test.js` runs it, so the verdict is drilled rather than
 * being a report somebody remembers to read.
 *
 * WHY THIS EXISTS.  A rules revision (FaB 2.0 happened; 3.0 is teased) does not
 * arrive as a diff against our source.  It arrives as a renumbered, reworded CR,
 * and the cost of absorbing it is exactly "how many places did we encode a rule
 * where nothing would turn red if it changed".
 *
 * So this tool asks ONE question per rule, and it is not "is it cited":
 *
 *     a rule cited in ENGINE code and in NO DRILL is a rule this project
 *     believes but does not check.  Change it upstream and every test stays
 *     green while the game plays the old game.
 *
 * That is the same shape as every guard bug in this repo — a scan aimed at the
 * wrong file, the wrong shape, the wrong scope — one level up: a guard aimed at
 * nothing at all.  CLAUDE.md's claim that "a rules change is a parser change
 * plus a drill" is testable, and this is the test.
 *
 * AN `UNGUARDED` VERDICT IS A LEAD, NOT A FINDING, and the tool's own first
 * run proved both halves of that.  It measures CITATION coverage, not
 * BEHAVIOUR coverage, so it lies in both directions:
 *
 *   a false alarm   judge.js cites "CR 8.1.3" where the rule is 8.1.3a, and
 *                   the behaviour is driven over all 15 of the pool's
 *                   defence reactions.  Guarded; the citation was loose.
 *   a real one      "CR 4.1.8a" appeared in a comment on both boards
 *                   claiming they deliberately run these triggers in the
 *                   SAME ORDER so they cannot disagree.  Nothing checked
 *                   it, and reading the two sites found three rules that
 *                   were not in the shared body at all.
 *
 * So: read the site.  Then ask whether a drill drives the BEHAVIOUR, under
 * this rule's number or a neighbouring one.  Only then is it a gap.
 *
 * THE GLOSS IS HARVESTED, NEVER WRITTEN.  Where the source quotes the CR
 * verbatim beside a citation, that quote is the gloss.  Nothing here restates a
 * rule from memory — same discipline as never inventing card text.
 */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");

/* ── what counts as a citation ────────────────────────────────────────────
   "CR 7.3.2" and also the continuations that follow one: FaB rules are cited
   in runs — "CR 7.3.4, 7.6.4" and "CR 4.2.2 / 7.7.4" — and a naive scan reads
   the first and drops the rest, undercounting exactly the rules that travel
   in company.  A wildcard tail (7.1.x) is kept as written; it is a deliberate
   statement about a family, not a typo. */
const HEAD = /\bCR\s?(\d+(?:\.\d+)*[a-z]?|\d+\.\d+\.x|\d+\.x)/g;
/* A RANGE IS A RUN TOO. "CR 4.3.1-4.3.3" cites three rules and an
   alternation of only , / and & reads one — the far end of every range in
   the source was being dropped silently, which is a scan undercounting
   exactly the rules that travel in company. The endpoint is captured; the
   rules BETWEEN are not expanded, because inventing citations nobody wrote
   is worse than missing one. */
const TAIL = /^\s*(?:,|\/|and|&|-|\u2013|to)\s*(\d+(?:\.\d+)*[a-z]?|\d+\.\d+\.x|\d+\.x)\b/;

function citationsIn(txt) {
  const out = [];
  let m;
  HEAD.lastIndex = 0;
  while ((m = HEAD.exec(txt))) {
    let at = m.index + m[0].length;
    out.push({ rule: m[1], at: m.index });
    /* walk the run */
    for (;;) {
      const t = TAIL.exec(txt.slice(at, at + 24));
      if (!t) break;
      out.push({ rule: t[1], at });
      at += t[0].length;
    }
  }
  return out;
}

/* the nearest verbatim quote on the citing line, if the source carries one */
function glossAt(txt, at) {
  const ls = txt.lastIndexOf("\n", at) + 1;
  let le = txt.indexOf("\n", at);
  if (le < 0) le = txt.length;
  /* a quote can wrap one line; look at this line and the next */
  let le2 = txt.indexOf("\n", le + 1);
  if (le2 < 0) le2 = txt.length;
  const win = txt.slice(ls, le2).replace(/\s*\*\s?|\s*\/\/\s?/g, " ");
  const q = win.match(/[“"]([^”"]{12,240})[”"]/);
  return q ? q[1].replace(/\s+/g, " ").trim() : null;
}

function lineOf(txt, at) { return txt.slice(0, at).split("\n").length; }

/* ── the corpus, split by what a citation there MEANS ─────────────────── */
const GROUPS = [
  { key: "engine", label: "engine",  files: fs.readdirSync(path.join(ROOT, "engine")).filter(f => f.endsWith(".js")).map(f => "engine/" + f) },
  { key: "trainer", label: "trainer", files: ["index.html"] },
  { key: "drill", label: "drills",   files: fs.readdirSync(path.join(ROOT, "test")).filter(f => f.endsWith(".test.js")).map(f => "test/" + f) },
  /* THE TOOL'S OWN OUTPUT IS NOT AN INPUT (v4.02). `CR-INDEX.md` is
     written into the directory this line scans, so every rule the report
     names was counted as a `docs` citation of itself — which means a rule
     that appeared ONCE could never leave the index, and the tool's own
     `prose` bucket and rule total carried its history rather than the
     source's. Found by sabotage: a fake rule injected into engine/ to
     prove the drill bites was still in the index after the sabotage was
     reverted, because the report had already written it down.

     A SCAN THAT READS ITS OWN OUTPUT IS THE NO-MIRROR RULE INSIDE ONE
     TOOL — the same family as a source guard aimed at the wrong file
     (v3.00) or a report that rots against the code it describes (v3.52). */
  { key: "docs",  label: "docs",     files: fs.readdirSync(ROOT)
      .filter(f => f.endsWith(".md") && f !== "CR-INDEX.md") },
];

const rules = new Map();  // rule -> {rule, sites:{engine:[],trainer:[],drill:[],docs:[]}, gloss}

for (const g of GROUPS) {
  for (const rel of g.files) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    for (const c of citationsIn(txt)) {
      if (!rules.has(c.rule)) rules.set(c.rule, { rule: c.rule, sites: { engine: [], trainer: [], drill: [], docs: [] }, gloss: null });
      const r = rules.get(c.rule);
      r.sites[g.key].push(rel + ":" + lineOf(txt, c.at));
      if (!r.gloss) r.gloss = glossAt(txt, c.at);
    }
  }
}

/* ── the verdict ──────────────────────────────────────────────────────────
   CODE is engine + trainer: a citation there is a rule the game RUNS ON.
   A citation in docs alone is a rule we have written about; it costs nothing
   to restate and nothing turns red either way, so it is neither guarded nor
   at risk — it is filed apart rather than counted as a gap. */
function verdict(r) {
  const code = r.sites.engine.length + r.sites.trainer.length;
  const drl = r.sites.drill.length;
  if (code && drl) return "guarded";
  if (code && !drl) return "UNGUARDED";
  if (!code && drl) return "drill-only";
  return "prose";
}

const all = [...rules.values()].map(r => ({
  rule: r.rule,
  gloss: r.gloss,
  verdict: verdict(r),
  engine: r.sites.engine, trainer: r.sites.trainer, drill: r.sites.drill, docs: r.sites.docs,
  total: r.sites.engine.length + r.sites.trainer.length + r.sites.drill.length + r.sites.docs.length,
}));

/* sort: the risky ones first, then by how deeply we lean on the rule */
const ORD = { UNGUARDED: 0, "drill-only": 1, guarded: 2, prose: 3 };
const cmp = (a, b) => (ORD[a.verdict] - ORD[b.verdict]) || (b.total - a.total) || a.rule.localeCompare(b.rule);
all.sort(cmp);

const by = v => all.filter(r => r.verdict === v);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ rules: all }, null, 2));
  process.exit(0);
}

/* ── console ─────────────────────────────────────────────────────────── */
const cite = r => (r.engine.length ? "engine " : "") + (r.trainer.length ? "trainer " : "") + (r.drill.length ? "drills " : "") + (r.docs.length ? "docs" : "");
console.log("\nCR CITATION INDEX — " + all.length + " distinct rules, " + all.reduce((n, r) => n + r.total, 0) + " citations\n");
for (const v of ["UNGUARDED", "drill-only", "guarded", "prose"]) {
  const g = by(v);
  console.log(v.padEnd(11) + " " + String(g.length).padStart(3) + "   " + ({
    UNGUARDED: "cited in code, NO drill — a rules change here goes green",
    "drill-only": "pinned by a drill with no code citation",
    guarded: "cited in code AND pinned by a drill",
    prose: "documentation only",
  })[v]);
}
if (by("UNGUARDED").length) {
  console.log("\n── UNGUARDED ──────────────────────────────────────────────");
  for (const r of by("UNGUARDED")) {
    console.log("  CR " + r.rule.padEnd(9) + " x" + String(r.total).padStart(2) + "  " + cite(r));
    if (r.gloss) console.log("               " + JSON.stringify(r.gloss).slice(0, 96));
    for (const s of [...r.engine, ...r.trainer].slice(0, 4)) console.log("               " + s);
  }
}

/* ── CR-INDEX.md ─────────────────────────────────────────────────────── */
const md = [];
md.push("# CR citation index");
md.push("");
md.push("*Generated by `node tools/crindex.js`. Do not hand-edit — regenerate it.*");
md.push("");
md.push("**" + all.length + " distinct Comprehensive Rules cited, " + all.reduce((n, r) => n + r.total, 0) + " citations.**");
md.push("");
md.push("This is the answer to *what does a rules revision cost us*. Flesh and Blood");
md.push("renumbers and rewords its CR between editions; the expensive half is never the");
md.push("rules we tested, it is the rules we only believed. So the column that matters is");
md.push("the last one:");
md.push("");
md.push("| verdict | meaning |");
md.push("|---|---|");
md.push("| **guarded** | cited in engine or trainer code **and** pinned by at least one drill — change the rule upstream and something turns red |");
md.push("| **UNGUARDED** | cited in code and in **no** drill — a rules change here ships green |");
md.push("| drill-only | a drill pins it; no code comment cites it |");
md.push("| prose | discussed in the docs, not encoded |");
md.push("");
md.push("**An `UNGUARDED` verdict is a lead, not a finding.** This measures *citation*");
md.push("coverage, not *behaviour* coverage, and it misreads in both directions. `CR 8.1.3`");
md.push("is cited in `judge.js` where the rule is really `8.1.3a`, whose behaviour is driven");
md.push("over all fifteen of the pool's defence reactions — guarded, loosely cited. `CR 4.1.8a`");
md.push("was the opposite: a comment on *both* boards claiming they deliberately run their");
md.push("end-phase triggers in the same order so they cannot disagree, checked by nothing —");
md.push("and reading the two sites turned up three rules that were not in the shared body at");
md.push("all (v3.17). Read the site, then ask whether a drill drives the behaviour under this");
md.push("rule's number *or a neighbouring one*. Only then is it a gap.");
md.push("");
for (const v of ["UNGUARDED", "guarded", "drill-only", "prose"]) {
  const g = by(v);
  if (!g.length) continue;
  md.push("## " + v + " — " + g.length);
  md.push("");
  md.push("| rule | cites | where | what the source quotes |");
  md.push("|---|---|---|---|");
  for (const r of g) {
    const where = [r.engine.length && "engine", r.trainer.length && "trainer", r.drill.length && "drills", r.docs.length && "docs"].filter(Boolean).join(", ");
    md.push("| CR " + r.rule + " | " + r.total + " | " + where + " | " + (r.gloss ? r.gloss.replace(/\|/g, "\\|").slice(0, 180) : "—") + " |");
  }
  md.push("");
}
md.push("## Where each rule is encoded");
md.push("");
md.push("Only rules cited in code. A rules revision is a lookup here, not an archaeology dig.");
md.push("");
for (const r of all.filter(x => x.engine.length + x.trainer.length)) {
  md.push("**CR " + r.rule + "** — " + [...r.engine, ...r.trainer].join(", ") + (r.drill.length ? "  \n*drills:* " + r.drill.join(", ") : "  \n*no drill*"));
  md.push("");
}
fs.writeFileSync(path.join(ROOT, "CR-INDEX.md"), md.join("\n"));
console.log("\nwrote CR-INDEX.md");

/* THE THREE SECTION POINTERS. Each names a whole CR section rather than a
   rule — there is no behaviour "CR 7" alone asserts — so no drill can
   guard one, and demanding zero made the gate permanently red. Pinned, so
   a fourth is a deliberate edit and anything else fails. */
const ALLOWED_UNGUARDED = ["4.4", "4.3.1", "7"];
if (process.argv.includes("--check")) {
  const bad = by("UNGUARDED").map(r => r.rule).filter(r => !ALLOWED_UNGUARDED.includes(r));
  const gone = ALLOWED_UNGUARDED.filter(r => !by("UNGUARDED").some(x => x.rule === r));
  if (bad.length)  console.error("UNGUARDED and not allowed: " + bad.join(", "));
  if (gone.length) console.error("allowed-unguarded rules that are no longer unguarded " +
                                 "(delete them from ALLOWED_UNGUARDED): " + gone.join(", "));
  if (bad.length || gone.length) process.exit(1);
  console.log("check: the UNGUARDED set is exactly the " + ALLOWED_UNGUARDED.length +
              " allowed section pointers");
}
