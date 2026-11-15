#!/usr/bin/env node
/* ============================================================
   PIN THE STAGED CARDS — the text of precons that are being BUILT.

   RULING (user, 2026-11-15): "Yes to all" — (1) Dawnblade's pool grows as
   new Silver Age precons are built, and (2) their text is pinned NOW from
   the-fab-cube's unmerged branch rather than waiting for the merge into
   `develop`.

   WHY A SECOND FILE AND NOT data/pool.js. The pool is what the PHONE
   plays, and every pool-wide census in the suite counts it. A card nobody
   can be dealt yet does not belong on the phone, and sixty records of
   mechanics the engine cannot read would move every one of those counts
   for no player. So the cards wait in `data/staged.js`: the page never
   loads it, and the readers a new hero needs are built and drilled
   against it. The day a hero opens (a `DECKS` entry), `pin-pool.js`
   reaches its cards by name and they move into the pool.

   IT IS FETCHED DATA, NEVER AUTHORED, exactly as the pool is. The source
   is recorded as a COMMIT, not a branch name, so the file can be
   reproduced byte for byte: `SOURCE` below. A branch moves; a commit does
   not. Take a newer commit on purpose: change the hash, rerun, read the
   diff.

   WHAT IT KEEPS: every record with a printing in a staged set (the sets
   `data/newsets.json` names) — which is both faces of a double-faced
   card and both faces of a double-faced hero, since the faces share a
   print code — plus every token their text names. Records are whole
   except `printings`, slimmed the way the pool's are.

     node tools/pin-staged.js            # rewrite data/staged.js (downloads once into tools/.cache)
     node tools/pin-staged.js --check    # exit 1 if it would change
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { tokenNames, slimPrinting } = require("./pin-pool.js");

const ROOT = path.join(__dirname, "..");
const SOURCE = {
  repo: "the-fab-cube/flesh-and-blood-cards",
  branch: "usurp-the-shadow-throne",
  commit: "ec42d952da9c56a6a94855de8f27daeef2d7730f",
  taken: "2026-11-15",
};
const URL = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/json/english/card.json`;
const CACHE = path.join(ROOT, "tools", ".cache", `card-${SOURCE.commit}.json`);
const OUT = path.join(ROOT, "data", "staged.js");
const NEWSETS = path.join(ROOT, "data", "newsets.json");

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* the sets being built: every list in newsets.json that names one */
function stagedSets(NEW){
  return Object.keys(NEW).filter(k => NEW[k] && NEW[k].set && NEW[k].sections).map(k => NEW[k].set).sort();
}

function build(db, NEW){
  const sets = new Set(stagedSets(NEW));
  const inSet = c => (c.printings || []).some(p => sets.has(p.set_id));
  const direct = db.filter(c => c && c.name && inSet(c));
  const toks = tokenNames(direct);
  const isTok = c => /token/i.test(c.type_text || "") || /token/i.test((c.types || []).join(" "));
  const keep = db.filter(c => c && c.name && (inSet(c) || (isTok(c) && toks.has(norm(c.name)))));
  keep.sort((a, b) => (a.name === b.name)
    ? (a.pitch || 0) - (b.pitch || 0) || String(a.unique_id || "").localeCompare(String(b.unique_id || ""))
    : a.name.localeCompare(b.name));
  return keep.map(c => ({...c, printings: (c.printings || []).map(slimPrinting)}));
}

const HEAD = "/* THE STAGED CARDS — the text of precons being built, as the-fab-cube printed it.\n"
  + "   Written by tools/pin-staged.js; fetched data, NEVER AUTHORED — do not edit by hand.\n"
  + "   The page does NOT load this file. RULING (user, 2026-11-15). Source commit:\n"
  + "   " + SOURCE.repo + "@" + SOURCE.commit + " (branch " + SOURCE.branch + ", taken " + SOURCE.taken + "). */\n"
  + "(function(root, records){\n"
  + "  if(typeof module === \"object\" && module.exports) module.exports = records;\n"
  + "  else root.DAWN_STAGED = records;\n"
  + "})(typeof window !== \"undefined\" ? window : this,\n";
const serialize = recs => HEAD + "[\n" + recs.map(r => JSON.stringify(r)).join(",\n") + "\n]);\n";

function main(){
  if(!fs.existsSync(CACHE)){
    /* curl honours the sandbox's proxy and CA bundle; node's https does not. */
    fs.mkdirSync(path.dirname(CACHE), {recursive: true});
    require("child_process").execFileSync("curl", ["-sS", "--fail", "-m", "240", "-o", CACHE, URL], {stdio: "inherit"});
  }
  const db = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const NEW = JSON.parse(fs.readFileSync(NEWSETS, "utf8"));
  const recs = build(db, NEW);
  const text = serialize(recs);
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  if(process.argv.includes("--check")){
    if(prev === text){ console.log("data/staged.js is current (" + recs.length + " records)."); return; }
    console.error("data/staged.js does not match what the source commit derives.");
    process.exit(1);
  }
  fs.writeFileSync(OUT, text);
  console.log("Staged " + recs.length + " records (" + (text.length / 1024).toFixed(0) + " KB) from "
    + SOURCE.repo + "@" + SOURCE.commit.slice(0, 10) + " for sets " + stagedSets(NEW).join(", "));
}

if(require.main === module) main();
module.exports = {build, stagedSets, serialize, SOURCE, OUT};
