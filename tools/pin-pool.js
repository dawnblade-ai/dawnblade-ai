#!/usr/bin/env node
/* ============================================================
   PIN THE POOL — the drills' copy of the card database.

   `npm test` on a fresh clone was 749 passes and 304 SILENT SKIPS,
   because every drill that needs a card gates on `tools/.cache/card.json`
   — a 22MB download that is gitignored. "1053 green" therefore meant
   "1053 green on the machine that happened to have fetched", and on this
   one it hid 22 pool cards that had quietly stopped resolving.

   So the pool's own records are pinned in the repo. What this writes is
   NOT a second source of truth for the game: `index.html` still streams
   the live database at runtime, which is what keeps errata reaching a
   player. It is (a) the fixture every drill runs on, so a clone with no
   network measures the same engine, and (b) the reference the drift
   guard diffs the live text against.

   IT IS FETCHED DATA, NEVER AUTHORED. Nothing here edits a card's text;
   the golden rule is about not inventing effects, and pinning the source
   verbatim is the opposite of inventing.

   WHAT IT KEEPS: every record whose name the pool can reach — all 15
   decks' heroes, cards and gear, both halves of a DFC, the dummy's pile
   and gear, the two cards effects mint at runtime, and every token named
   in any of their text. Records are kept WHOLE except `printings`, which
   is slimmed to the fields `mapDbCard` actually reads. That slimming is
   not taken on trust: `test/pool.test.js` asserts the pinned records and
   the live ones map to byte-identical cards.

     node tools/pin-pool.js            # rewrite data/pool.json
     node tools/pin-pool.js --check    # exit 1 if it would change
   ============================================================ */
const fs = require("fs");
const path = require("path");
const G = require("../engine/game.js");
const { loadData } = require("../test/helpers/extract.js");

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, "tools", ".cache", "card.json");
const OUT = path.join(ROOT, "data", "pool.json");

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* The same set `index.html`'s loader builds, derived the same way rather
   than listed — a hand-kept list rots the moment a deck changes. */
function neededNames(W){
  const need = new Set();
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    need.add(norm(d.hero.name));
    d.gear.forEach(e => need.add(norm(e.name)));
    d.deck.forEach(e => {
      need.add(norm(e.name));
      /* A DOUBLE-FACED CARD is reachable by its front face too. */
      if(e.name.includes("//")) need.add(norm(e.name.split("//")[0]));
    });
  }
  (W.DUMMY_GEAR || []).forEach(n => need.add(norm(n)));
  (W.DUMMY_DECK || []).forEach(([n]) => need.add(norm(n)));
  /* Cards no deck lists and `effects.js` can still mint at runtime. */
  ["Crouching Tiger", "Inner Chi"].forEach(n => need.add(norm(n)));
  return need;
}

/* TOKENS ARE READ OUT OF THE POOL'S OWN TEXT, never listed by hand — the
   audit learned this the expensive way, with a hardcoded list that
   carried 6 of the 17 real tokens and named "Bloodrot" for what the
   database calls "Bloodrot Pox". */
/* A TOKEN NAME CAN CONTAIN A LOWERCASE WORD (v3.21). This required every
   word of the name to be capitalised, so "create an Embodiment of Earth
   token" captured **"Earth"** — a name no card has. It then added it,
   matched nothing, and said nothing: a scan aimed at the wrong SHAPE
   passes by finding nothing, the same family as the `makeEffects` guard
   that excluded the only call form anyone writes.

   Both of Briar's Embodiments were lost this way, and they are the only
   two in the pool — measured, not assumed. The connective is allowed
   before each following word now; a leading verb or article is stripped
   after the fact, because "Destroy the Runechant token" would otherwise
   capture the verb along with the name. */
function tokenNames(records){
  const found = new Set();
  for(const c of records)
    for(const m of (c.functional_text || "")
        .matchAll(/\b([A-Z][A-Za-z0-9'-]*(?:(?: of| the| and)? [A-Z][A-Za-z0-9'-]*){0,3}) tokens?\b/g))
      found.add(norm(m[1]
        .replace(/^(?:Create|Equip|Destroy|Put|Gain) (?:X |\d+ )?/, "")
        .replace(/^(?:a|an|the|of|and)\s+/i, "")));
  return found;
}

/* `mapDbCard` reads exactly these three things off a printing. Keeping the
   rest is 70% of the file for artist credits and foiling. */
const slimPrinting = pr => {
  const o = {};
  const id = pr.id || pr.identifier || pr.set_printing_unique_id;
  if(id) o.id = id;
  if(pr.image_url || pr.image) o.image_url = pr.image_url || pr.image;
  if(pr.set_id) o.set_id = pr.set_id;
  return o;
};

function build(db, W){
  const need = neededNames(W);
  const direct = db.filter(c => c && c.name && need.has(norm(c.name)));
  tokenNames(direct).forEach(t => need.add(t));
  /* A TOKEN IS KEPT BY ITS TYPE, THE WAY THE LOADER KEEPS ONE (v3.21).
     `index.html` keeps any record whose type says Token — so the browser
     could mint Briar's Embodiments while the PINNED POOL, which found its
     tokens by scanning names out of card text, could not see them. That
     is the fixture and production disagreeing about what a card is, which
     is the hazard `mapDbCard`'s field-map guard exists for one layer up:
     the Node tools audit one pool while the phone plays another.

     One rule for "what is a token", not two. It costs 24 records on 764
     and it cannot be defeated by how a name is spelled. */
  const isTok = c => /token/i.test(c.type_text || "")
                  || /token/i.test((c.types || []).join(" "));
  const keep = db.filter(c => c && c.name && (need.has(norm(c.name)) || isTok(c)));
  /* Stable order, so a re-pin against an unchanged upstream is an empty
     diff rather than a reshuffle nobody can review. */
  keep.sort((a, b) => (a.name === b.name)
    ? (a.pitch || 0) - (b.pitch || 0) || String(a.unique_id||"").localeCompare(String(b.unique_id||""))
    : a.name.localeCompare(b.name));
  return keep.map(c => ({...c, printings: (c.printings || []).map(slimPrinting)}));
}

function main(){
  if(!fs.existsSync(CACHE)){
    console.error("no live database at " + path.relative(ROOT, CACHE) + " — run: node tools/audit.js");
    process.exit(2);
  }
  const W = loadData();
  const db = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const pool = build(db, W);
  const text = JSON.stringify(pool, null, 0) + "\n";
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;

  if(process.argv.includes("--check")){
    if(prev === text){ console.log("data/pool.json is current (" + pool.length + " records)."); return; }
    console.error("data/pool.json is STALE — the live database has moved under it.");
    console.error("Review the drift, then: node tools/pin-pool.js");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), {recursive: true});
  fs.writeFileSync(OUT, text);
  console.log("Pinned " + pool.length + " records ("
    + (text.length / 1048576).toFixed(2) + " MB) to " + path.relative(ROOT, OUT));
}

if(require.main === module) main();
module.exports = {build, neededNames, tokenNames, slimPrinting, OUT, CACHE};
