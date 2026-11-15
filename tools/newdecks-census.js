#!/usr/bin/env node
/* ============================================================
   tools/newdecks-census.js — HOW FAR IS EACH NEW PRECON FROM PLAYABLE?

   The lists in `data/newsets.json` name cards the pinned pool does not
   hold. Their text exists upstream, but on a FEATURE BRANCH
   (`usurp-the-shadow-throne`), not on `develop`. This reads that branch
   (downloaded once into tools/.cache, gitignored), runs every card of
   both lists through the real parser, and prints what `fxParse` cannot
   read yet. It writes nothing in the repo and changes no card.

     node tools/newdecks-census.js             # use the cached download
     node tools/newdecks-census.js --refresh   # download again first

   It is the measure ROADMAP-NEWDECKS.md's phases are counted against:
   a hero is ready for the loadout when its list prints no gap here.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const https = require("https");
const ROOT = path.join(__dirname, "..");
const C = require("../engine/cards.js");
const P = require("../engine/parser.js");
const A = require("./audit.js");
const NEW = require("../data/newsets.json");

const BRANCH = "usurp-the-shadow-throne";
const URL = `https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/${BRANCH}/json/english/card.json`;
const CACHE = path.join(ROOT, "tools", ".cache", `card-${BRANCH}.json`);

function fetchTo(file){
  /* curl honours the sandbox's proxy and CA bundle; node's https does not. */
  fs.mkdirSync(path.dirname(file), {recursive:true});
  require("child_process").execFileSync("curl", ["-sS", "--fail", "-m", "180", "-o", file, URL], {stdio:"inherit"});
}

function main(){
  if(process.argv.includes("--refresh") || !fs.existsSync(CACHE)) fetchTo(CACHE);
  const raw = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const pinned = new Set(require("../data/pool.js").map(c => String(c.name).toLowerCase()));
  P.fxReset();
  console.log(`upstream branch ${BRANCH}: ${raw.length} records`);
  for(const k of Object.keys(NEW).filter(k => NEW[k] && NEW[k].sections)){
    const d = NEW[k], tiers = {full:0, part:0, none:0}, gaps = [], kws = new Set(), fresh = new Set();
    let unresolved = 0;
    for(const [sec, s] of Object.entries(d.sections)) for(const r of s.rows){
      if(r.name === d.hero){
        const h = C.resolveHero(db, {name:r.name, code:r.code});
        const a = A.analyzeHero(h, r.name);
        const un = (a.clauses || []).filter(c => !c.covered).map(c => c.t);
        if(un.length) gaps.push(`[hero] ${r.name}: ` + un.join(" || "));
        continue;
      }
      const rc = C.resolveEntry(db, {name:r.name, p:r.p || 0, code:r.code, q:r.q});
      if(!rc.resolved){ unresolved++; gaps.push(`[UNRESOLVED] ${r.name} ${r.code}`); continue; }
      if(!pinned.has(rc.name.toLowerCase())) fresh.add(rc.name);
      const fx = P.fxParse(rc);
      tiers[fx.tier]++;
      (rc.kw || []).forEach(x => kws.add(x));
      const sk = fx.clauses.filter(c => c.st === "skip").map(c => c.t);
      if(fx.tier !== "full" || sk.length) gaps.push(`[${fx.tier}] ${rc.name} (${sec}): ` + sk.join(" || "));
    }
    console.log(`\n## ${d.hero} (${d.set})  rows by tier ${JSON.stringify(tiers)} · unresolved ${unresolved} · names not pinned ${fresh.size}`);
    console.log("keywords: " + [...kws].sort().join(", "));
    for(const g of gaps) console.log("  " + g);
  }
}
main();
