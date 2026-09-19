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

const CACHE = require("./helpers/extract").cardDbPath();
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

  const degraded = [], risen = [];
  for(const [key, tier] of Object.entries(baseline)){
    if(seen[key] == null) continue; // card left the pool — baseline entry is stale, not a failure
    if(rank[seen[key]] < rank[tier]) degraded.push(`${key}: ${tier} -> ${seen[key]}`);
    if(rank[seen[key]] > rank[tier]) risen.push(`${key}: ${tier} -> ${seen[key]}`);
  }
  assert.deepEqual(degraded, [], "parser change degraded previously scripted cards");

  /* AND THE FLOOR MUST NOT BE STALE — the other half of the same census
     (v4.58). This drill was one-directional: a card ABOVE its pinned floor
     passes silently, so a floor that was never repinned is a guard switched
     off for exactly that card and nothing says so.

     MEASURED: v4.56 built V of the Vanguard to `full` and did not run
     `--write-baseline`, so `v of the vanguard|2` sat pinned at `part` for
     two versions. A regression on that one card from `full` back to `part`
     would have passed this file perfectly.

     It is the same rule CLAUDE.md already states about `--write-baseline`
     ("only once you've reviewed the diff") with nothing enforcing the second
     half, and v4.12's *a census that only ever goes up is half a census*
     read from the other side. It goes RED at the moment a tier RISES, which
     is exactly when the author should read the audit diff and repin — one
     extra step in a chain that already documents it. */
  assert.deepEqual(risen, [],
    "a card now reads ABOVE its pinned floor, so the floor is stale and cannot catch a "
    + "regression on it. Read the AUDIT.md diff, then: node tools/audit.js --write-baseline");
});
