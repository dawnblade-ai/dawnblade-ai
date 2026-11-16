#!/usr/bin/env node
/* ============================================================
   tools/newdecks-census.js — HOW FAR IS EACH NEW PRECON FROM PLAYABLE?

   The lists in `data/newsets.json` name cards the pinned pool does not
   hold; their text is staged in `data/staged.js` (tools/pin-staged.js).
   This runs every card of both lists through the real parser and prints
   what `fxParse` cannot read yet. It reads no network, writes nothing and
   changes no card.

     node tools/newdecks-census.js

   It is the measure ROADMAP-NEWDECKS.md's phases are counted against: a
   hero is ready for the loadout when its list prints no gap here. A row
   that reads "full" can still hide a keyword with no reader, so this is a
   floor on the work, not a ceiling.
   ============================================================ */
const C = require("../engine/cards.js");
const P = require("../engine/parser.js");
const A = require("./audit.js");
const NEW = require("../data/newsets.json");

function main(){
  const raw = require("../data/staged.js");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const pinned = new Set(require("../data/pool.js").map(c => String(c.name).toLowerCase()));
  P.fxReset();
  console.log(`staged records: ${raw.length}`);
  for(const k of Object.keys(NEW).filter(k => NEW[k] && NEW[k].sections)){
    const d = NEW[k], tiers = {full:0, part:0, none:0}, gaps = [], kws = new Set(), fresh = new Set();
    let unresolved = 0;
    for(const [sec, s] of Object.entries(d.sections)) for(const r of s.rows){
      if(r.name === d.hero){
        const h = C.resolveHero(db, {name:r.name, code:r.code});
        const a = A.analyzeHero(h, r.name);
        const un = (a.clauses || []).filter(c => !c.covered).map(c => c.t);
        if(un.length) gaps.push(`[hero] ${r.name}: ` + un.join(" || "));
        /* A DOUBLE-FACED HERO IS TWO RECORDS (v6.44): the list names the
           front, and the back's lines are dealt to nobody until a traverse.
           Read them here or the census says "no gap" about half a card. */
        for(const f of require("../engine/build.js").facesOf(db, h)){
          const fa = A.analyzeHero(f, f.n);
          const fun = (fa.clauses || []).filter(c => !c.covered).map(c => c.t);
          if(fun.length) gaps.push(`[hero, other face] ${f.n}: ` + fun.join(" || "));
        }
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
