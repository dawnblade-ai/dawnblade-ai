#!/usr/bin/env node
/* ============================================================
   tools/gaps.js — WHAT CLOSES THE MOST CARDS? (v3.52)

   The audit answers "how much of this card is read" and the stack answers
   "which RULING is missing". Neither answers the question a session
   actually opens with: **of the cards that are not finished, what one
   reader would finish the most of them?**

   That question was answered by a throwaway `node -e` script while
   scoping the week, and it turned out to be the most useful view of the
   remaining work in the project — 52 of 70 unfinished cards are ONE
   clause away, and those clauses fall into five families that cut across
   the hero list. A view that useful should not have to be re-derived.

   IT READS `tools/audit.json`, so `npm run audit` first if it is stale —
   the header prints the generating version so a stale read is visible
   rather than silently a month old.

   THE FAMILIES ARE PATTERNS OVER PRINTED CLAUSE TEXT, and they are a
   REPORT rather than a claim: a card is filed under the first family it
   matches, "unclustered" is an honest answer, and the counts are printed
   so a pattern that stops matching shows up as a family going to zero
   rather than as a clean sweep. Same discipline as the sweep's mention
   count: report the number, do not assert intent from a grep.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const AUDIT = path.join(__dirname, "audit.json");
if(!fs.existsSync(AUDIT)){
  console.error("no tools/audit.json — run `npm run audit` first");
  process.exit(1);
}
const A = JSON.parse(fs.readFileSync(AUDIT, "utf8"));

/* Each family is [label, pattern, what it needs]. Ordered: a card lands in
   the FIRST that matches, so the more specific shapes come first.

   THE PATTERN IS TEXT AND THE `needs` IS A CLAIM ABOUT MACHINERY, and
   those are not the same kind of statement. The clustering can only see
   what a card SAYS; whether the family shares one fix is something only
   the PARSER can answer. v3.53 checked all five by asking which records
   actually carry the field each family names, and two of the `needs`
   lines did not survive — the "you may" family named two queue sites,
   one of which had been wired since v3.33 and the other of which has no
   pool cards at all, while its eight cards turned out to need five
   different COST shapes.

   So: before building a family, ask the parser which records set the
   field. It is a two-minute script and it moved two of five. */
const FAMILIES = [
  ["pick from a zone", /from your graveyard|from an opposing hero's graveyard|search your deck|from your (?:hand|deck) (?:into|face-up)|shuffle .* into your deck/i,
   "the graveyard readers landed in v3.53/v3.54; what is left is a deck SEARCH, an X-cost (refused), a two-target pick, a hand->soul put and a shuffle-redraw"],
  ["counters on a permanent", /counter[s]? on\b|has an? \w+ counter|enters the arena with a \+/i,
   "the targeted put landed in v3.53 (`ctrPut`); what is left is a TRIGGER each — boost-banish, arrow-put, enters-with, and a reader for 'if this has an aim counter'"],
  ["create a token on a trigger", /create an? [A-Z]/,
   "the mint is generic since v3.33; each card needs its OWN condition, so nine readings rather than one lever"],
  ["\"you may …, if you do …\"", /\byou may\b/i,
   "NOT one fix — measured v3.53: none of these sets `fx.optCost`. Five cost shapes: destroy-this, pay {r}{r}{r}, a modal cost, a dynamic filter (refused), one-off"],
  ["a granted / conditional keyword", /\b(?:it|this) (?:gets|gains|has) \b/i,
   "rider plumbing — hasKwNow / quotedRider"],
];

const rows = [];
for(const k of Object.keys(A.cards || {})){
  const c = A.cards[k];
  if(c.tier === "full") continue;
  const skipped = (c.clauses || []).filter(x => x.st === "skip").map(x => x.t);
  if(!skipped.length) continue;
  rows.push({name: c.name, pitch: c.pitch, tier: c.tier, skipped});
}

const bucket = new Map(FAMILIES.map(f => [f[0], []]));
const loose = [];
for(const r of rows){
  const fam = FAMILIES.find(([, re]) => r.skipped.some(t => re.test(t)));
  if(fam) bucket.get(fam[0]).push(r); else loose.push(r);
}

/* HONOUR NO_COLOR AND A PIPE. Escape codes belong to a terminal; a report
   piped into a file or read by a drill should be plain text, and hardcoding
   them makes the tool unparseable by anything but a human. */
const TTY = process.stdout.isTTY && !process.env.NO_COLOR;
const B = s => TTY ? "\x1b[1m" + s + "\x1b[0m" : s;
/* TWO PRINTINGS OF ONE CARD ARE TWO RECORDS (the audit is keyed
   name|pitch), so a bare name list prints "Crankshaft · Crankshaft" and
   reads as a duplicate bug. Name the pitch only where it disambiguates. */
const label_ = list => {
  const seen = {};
  for(const r of list) seen[r.name] = (seen[r.name] || 0) + 1;
  return list.map(r => r.name + (seen[r.name] > 1 ? " p" + r.pitch : "")
                      + (r.tier === "none" ? "*" : "")).join(" · ");
};
const DIM = s => TTY ? "\x1b[2m" + s + "\x1b[0m" : s;
const one = rows.filter(r => r.skipped.length === 1).length;

console.log("\n" + B("THE GAP") + " — what one reader would close the most cards"
  + DIM("   · audit " + (A.appVer || "?") + " · " + (A.generated || "").slice(0, 10)));
/* Counted here rather than read off a summary key — audit.json carries no
   tier totals, and a missing key printing "?" is a report that quietly
   stops saying anything. */
const full = Object.values(A.cards || {}).filter(c => c.tier === "full").length;
console.log(`  pool ${A.poolUnique} · ${full} full · ${rows.length} unfinished`
  + `  ·  ${B(one + " are ONE clause away")}`);
/* A STALE READ MUST BE VISIBLE. This reads a build artifact, so a version
   older than the app is a report about a codebase that no longer exists. */
try {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/APP_VER\s*=\s*"([\d.]+)"/);
  if(m && m[1] !== A.appVer)
    console.log((TTY ? "\x1b[33m" : "") + "  ⚠ audit.json is v" + A.appVer
      + " and the app is v" + m[1] + " — run `npm run audit`" + (TTY ? "\x1b[0m" : ""));
} catch(_){}
console.log("");

const ranked = [...bucket.entries()].sort((a, b) => b[1].length - a[1].length);
for(const [label, list] of ranked){
  if(!list.length) continue;
  const need = (FAMILIES.find(f => f[0] === label) || [])[2];
  console.log(B(String(list.length).padStart(4) + "  " + label));
  console.log(DIM("      needs: " + need));
  console.log("      " + label_(list));
  console.log("");
}
console.log(B(String(loose.length).padStart(4) + "  unclustered") + DIM("   — each its own reading"));
console.log("      " + label_(loose) + "\n");
console.log(DIM("  * = reads NOTHING today.  Detail: node tools/gaps.js <name fragment>\n"));

/* A dossier for one card, so the next step after reading the ranking is
   not another grep. */
const q = process.argv[2];
if(q){
  const hit = rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  if(!hit.length){ console.log("  no unfinished card matching " + JSON.stringify(q) + "\n"); process.exit(0); }
  for(const r of hit){
    console.log(B("  " + r.name + " (pitch " + r.pitch + ") — " + r.tier));
    for(const t of r.skipped) console.log("    unread: " + t);
    console.log("");
  }
}
