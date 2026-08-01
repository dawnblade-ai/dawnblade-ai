#!/usr/bin/env node
/* ============================================================
   CARD_PROGRESS — Phase 3's checklist over the whole pool.

   Every other pool tool answers a narrow question (audit: how much
   text is read; stack: what mechanic is a card waiting on; sweep:
   what hasn't even been asked about). This one is the roll-up: one
   checkbox per hero, token and pool card, sourced entirely from
   tools/audit.json (npm run audit) so it can never drift into
   claiming a card is done when the audit disagrees.

   It does not guess and it does not invent status: a box is checked
   only when tools/audit.json says tier "full" (cards) or every
   clause covered (heroes) or fx "full" (tokens). Regenerate after
   any parser change:

     npm run audit && npm run progress

   Usage:
     node tools/progress.js         # (re)write CARD_PROGRESS.md
   ============================================================ */
const fs = require("fs");
const path = require("path");

const HERE = __dirname, ROOT = path.join(HERE, "..");
const AUDIT = path.join(HERE, "audit.json");
const OUT = path.join(ROOT, "CARD_PROGRESS.md");

if(!fs.existsSync(AUDIT)){
  console.error("No tools/audit.json — run `npm run audit` first.");
  process.exit(1);
}
const A = JSON.parse(fs.readFileSync(AUDIT, "utf8"));

const esc = s => (s||"").replace(/\|/g, "\\|");
const box = done => done ? "- [x]" : "- [ ]";

/* ---- heroes ------------------------------------------------ */
const heroNames = Object.keys(A.heroes).sort();
let heroDone = 0, heroTotal = 0, heroLines = [];
heroNames.forEach(k=>{
  const h = A.heroes[k];
  const clauses = h.clauses || [];
  const allCovered = clauses.length > 0 && clauses.every(c=>c.covered);
  heroTotal++; if(allCovered) heroDone++;
  heroLines.push(`${box(allCovered)} **${esc(h.name)}** — ${clauses.filter(c=>c.covered).length}/${clauses.length} clauses read`);
  clauses.forEach(c=>{
    heroLines.push(`  ${box(c.covered)} ${esc(c.t)}`);
  });
});

/* ---- tokens -------------------------------------------------- */
const tokNames = Object.keys(A.tokens).sort();
let tokDone = 0, tokLines = [];
tokNames.forEach(name=>{
  const t = A.tokens[name];
  const done = t.found && t.fx === "full";
  if(done) tokDone++;
  const status = !t.found ? "not in database" : `fx tier: ${t.fx}`;
  tokLines.push(`${box(done)} **${esc(name)}** — ${status}`);
});

/* ---- pool cards ----------------------------------------------- */
const cardKeys = Object.keys(A.cards).sort((a,b)=>A.cards[a].name.localeCompare(A.cards[b].name));
let cardDone = 0, cardLines = [];
cardKeys.forEach(k=>{
  const c = A.cards[k];
  const done = c.tier === "full";
  if(done) cardDone++;
  const usage = (A.usage[k]||[]).map(u=>u.hero).sort();
  const uniqHeroes = [...new Set(usage)];
  const deckNote = uniqHeroes.length ? ` _(${uniqHeroes.join(", ")})_` : "";
  const pitchNote = c.pitch ? ` [pitch ${c.pitch}]` : "";
  const skipped = (c.skipped||[]).length;
  const tierNote = c.tier === "full" ? "" :
    ` — ${c.tier}${skipped?`, ${skipped} clause(s) unread`:""}`;
  cardLines.push(`${box(done)} ${esc(c.name)}${pitchNote}${tierNote}${deckNote}`);
});

const total = heroTotal + tokNames.length + cardKeys.length;
const done = heroDone + tokDone + cardDone;
const pct = total ? Math.round(100*done/total) : 0;

const md = `# CARD_PROGRESS — Phase 3 pool checklist

**Generated from \`tools/audit.json\`** (audit run: ${A.generated}, DATA_VER \`${A.dataVer}\`,
APP_VER ${A.appVer}). This file is a **build artifact, not a source file** — hand edits
here do not change what the engine reads. Regenerate after any parser change:

\`\`\`
npm run audit && npm run progress
\`\`\`

A box is checked **only** when the audit says so: a pool card at tier \`full\`,
a hero with every printed clause covered, a token whose lifecycle reads at
\`fx: full\`. Nothing here is asserted by hand — that is what keeps this
different from a todo list someone forgets to update. Cards below \`full\`
carry their audit tier and unread-clause count; see \`AUDIT.md\` for the
verbatim clause text, \`STACK.md\` for what mechanic a gap is waiting on, and
\`SWEEP.md\` for hero/token/ruled-not-built axes the stack never charged.

Per CLAUDE.md's golden rule, "done" here means the generic parser
(\`classifyClause\`/\`fxParse\` in \`engine/parser.js\`) reads the card's own
printed text — never that a card was special-cased by name. The guarded
override registry (\`CARD_OVERRIDES\` in \`engine/parser.js\`) exists for the
rare genuinely non-generalizable ability; any card resolved that way is
noted inline below.

**Overall: ${done} / ${total} (${pct}%)** — heroes ${heroDone}/${heroTotal} ·
tokens ${tokDone}/${tokNames.length} · pool cards ${cardDone}/${cardKeys.length}
(tiers: full ${A.tiers.full}, part ${A.tiers.part}, none ${A.tiers.none})

---

## Heroes (${heroDone}/${heroTotal})

${heroLines.join("\n")}

---

## Tokens (${tokDone}/${tokNames.length})

${tokLines.join("\n")}

---

## Pool cards (${cardDone}/${cardKeys.length})

${cardLines.join("\n")}
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote CARD_PROGRESS.md — ${done}/${total} (${pct}%).`);
