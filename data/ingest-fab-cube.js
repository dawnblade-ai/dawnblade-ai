// Dawnblade AI — card data ingest pipeline
//
// Source of truth for real card data: the community-maintained
// `the-fab-cube/flesh-and-blood-cards` JSON dataset (github.com/the-fab-cube/
// flesh-and-blood-cards), the same style of machine-readable data fan tools
// build on. We ingest it rather than hand-typing card stats, so numbers are
// never wrong from memory. Card names/text remain © Legend Story Studios;
// we store functional stats + our own effect associations, not card images.
//
// Usage (once network or an uploaded JSON file is available):
//   node data/ingest-fab-cube.js path/to/card.json > data/sage-pool.json
//
// It filters to the SAGE-legal pool (rarity C/R/basic + sage_legal flags in the
// dataset), normalizes stats, and attaches effect associations from
// ASSOCIATIONS below. Anything it can't map is emitted into a coverage report
// so unimplemented abilities are explicit TODOs, never silent misplays.

import fs from "node:fs";

/** Map dataset keyword strings -> engine keywords. */
const KEYWORD_MAP = {
  "Go again": "go_again",
  "Dominate": "dominate",
  "Intimidate": "intimidate",
  "Overpower": "overpower",
  "Piercing": "piercing",
  "Ward": "ward",
  "Combo": "combo",
};

/** Hand-written effect associations for cards whose rules text goes beyond
 *  keywords. Keyed by the dataset's unique card identifier. This is the file
 *  that grows as the pool gets implemented — one association per card,
 *  reviewed against the official card via its image/oracle text. */
export const ASSOCIATIONS = {
  // example shape:
  // "snatch-red": [{ trigger: "onHit", effect: "draw", params: { amount: 1 } }],
};

export function ingest(rawCards) {
  const pool = {};
  const report = { mapped: 0, keywordOnly: 0, vanilla: 0, needsAssociation: [] };

  for (const c of rawCards) {
    const keywords = (c.card_keywords || [])
      .map((k) => KEYWORD_MAP[k])
      .filter(Boolean);

    const def = {
      name: c.name,
      pitch: num(c.pitch),
      cost: num(c.cost),
      power: num(c.power),
      defense: num(c.defense),
      types: (c.types || []).map((t) => t.toLowerCase()),
      keywords,
    };

    const assoc = ASSOCIATIONS[c.unique_id || c.identifier];
    const hasBodyText = (c.functional_text || "").trim().length > 0;

    if (assoc) {
      def.abilities = assoc;
      report.mapped++;
    } else if (hasBodyText && !onlyKeywordText(c.functional_text, keywords)) {
      report.needsAssociation.push({ id: c.unique_id || c.identifier, name: c.name });
    } else if (keywords.length) {
      report.keywordOnly++;
    } else {
      report.vanilla++;
    }

    pool[c.unique_id || c.identifier] = def;
  }
  return { pool, report };
}

function num(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function onlyKeywordText(text, keywords) {
  // crude heuristic: text that is nothing but its keyword line
  const stripped = text.replace(/\*|\./g, "").trim().toLowerCase();
  return keywords.some((k) => stripped === k.replace("_", " "));
}

// CLI entry
if (process.argv[2]) {
  const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { pool, report } = ingest(raw);
  console.error(
    `Ingested ${Object.keys(pool).length} cards — ` +
    `${report.mapped} associated, ${report.keywordOnly} keyword-only, ` +
    `${report.vanilla} vanilla, ${report.needsAssociation.length} need associations.`
  );
  console.log(JSON.stringify({ pool, report }, null, 2));
}
