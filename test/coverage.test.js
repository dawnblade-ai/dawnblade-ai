/* Coverage regression guard: with the card DB cached (run tools/audit.js
   once), re-parse the whole pool and require that no card's coverage tier
   degrades below the pinned baseline. Skips cleanly when offline/uncached
   so the core drill suite never needs the network. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const G = require("../engine/game");
const C = require("../engine/cards");
const { loadData } = require("./helpers/extract");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const BASELINE = path.join(__dirname, "..", "tools", "coverage-baseline.json");
const ready = fs.existsSync(CACHE) && fs.existsSync(BASELINE);

test("pool coverage — no card degrades below the pinned baseline", {skip: !ready && "no cached DB/baseline — run: node tools/audit.js --write-baseline"}, () => {
  const W = loadData();
  const raw = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const db = C.buildMaps(raw.filter(c=>c && c.name).map(C.mapDbCard));
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const rank = {none:0, part:1, full:2};
  P.fxReset();

  const seen = {};
  const unresolved = [];
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    for(const e of [...d.gear, ...d.deck]){
      const rc = C.resolveEntry(db, e);
      if(!rc.resolved) unresolved.push(`${h.k}: ${e.name}`);
      seen[P.norm(rc.name)+"|"+(rc.pitch||0)] = P.fxParse(rc).tier;
    }
    assert.ok(C.resolveHero(db, d.hero), `hero not resolved: ${d.hero.name}`);
  }
  assert.deepEqual(unresolved, [], "every pool card must resolve against the database");

  const degraded = [];
  for(const [key, tier] of Object.entries(baseline)){
    if(seen[key] == null) continue; // card left the pool — baseline entry is stale, not a failure
    if(rank[seen[key]] < rank[tier]) degraded.push(`${key}: ${tier} -> ${seen[key]}`);
  }
  assert.deepEqual(degraded, [], "parser change degraded previously scripted cards");
});
