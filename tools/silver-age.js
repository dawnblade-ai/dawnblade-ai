#!/usr/bin/env node
/* ============================================================
   SILVER AGE LEGALITY, DERIVED (v6.23) — fills data/formats.json's
   `silverAge` block from the PINNED POOL, never by hand.

   The card database we pin from (the-fab-cube) carries, per record,
   `silver_age_banned` and `silver_age_banned_start`. This reads those
   fields off data/pool.js for exactly the cards and heroes a Dawnblade
   precon plays, and writes them beside the format. It is NOT a reading
   of fabtcg.com's announcements (unreachable from the sandbox): it is
   what the upstream database says, as of the last re-pin.

   Dawnblade's own legality does not change. The block only records what
   a player would meet at a Silver Age event.

     node tools/silver-age.js           # rewrite the silverAge block
     node tools/silver-age.js --check   # exit 1 if it would change
   `derive()` is exported for test/formats.test.js.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const G = require("../engine/game.js");
const { loadData } = require("../test/helpers/extract.js");

const ROOT = path.join(__dirname, "..");
const FORMATS = path.join(ROOT, "data", "formats.json");
const SOURCE = "the-fab-cube card database, field silver_age_banned (pinned in data/pool.js)";

function derive(pool, W){
  /* name -> kind, for every card and hero a Dawnblade precon deals */
  const played = new Map();
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    played.set(d.hero.name || d.hero, "hero");
    for(const e of d.deck.concat(d.gear)) if(!played.has(e.name)) played.set(e.name, "card");
  }
  const byName = new Map();
  for(const r of pool) if(played.has(r.name)){
    if(!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const banned = [];
  for(const [name, kind] of played){
    const recs = byName.get(name) || [];
    const hit = recs.filter(r => r.silver_age_banned === true);
    if(!hit.length) continue;
    if(hit.length !== recs.length)
      throw new Error(`"${name}": printings of one card disagree on silver_age_banned`);
    const starts = new Set(hit.map(r => String(r.silver_age_banned_start || "").slice(0, 10)));
    if(starts.size !== 1 || ![...starts][0]) throw new Error(`"${name}": no single ban start date`);
    banned.push({ name, kind, since: [...starts][0], source: SOURCE });
  }
  banned.sort((a, b) => a.since.localeCompare(b.since) || a.name.localeCompare(b.name));
  return banned;
}

function block(pool, W){
  return {
    _why: [
      "Silver Age's legality is recorded BESIDE the format, never inside it:",
      "it is information a player may want (which of these cards would they",
      "not be allowed at a Silver Age event) and it changes every season, while",
      "Dawnblade's pool does not.",
      "",
      "DERIVED, NOT AUTHORED: tools/silver-age.js reads `silver_age_banned` and",
      "`silver_age_banned_start` off the pinned card database (data/pool.js), for the",
      "cards and heroes the fifteen precons play. This is the upstream DATABASE's",
      "statement as of the last re-pin, NOT a reading of fabtcg.com's announcements",
      "(still unreachable from the sandbox; see DESKTOP-TASKS.md).",
      "",
      "HEROES: the database marks a hero 'banned' (`kind: hero`) and has no separate",
      "hero-bench field, so a seasonal bench is recorded here as a ban, in the",
      "database's own words, with no 'until' date (the data carries none).",
      "`benched` stays null: the data does not distinguish a bench from a ban."
    ],
    banned: derive(pool, W),
    benched: null
  };
}

function main(){
  const pool = require("../data/pool.js");
  const W = loadData();
  const cur = fs.readFileSync(FORMATS, "utf8");
  /* replace only the silverAge block's text, so the hand-written rest of the file keeps its layout */
  const at = cur.indexOf('  "silverAge": {');
  if(at < 0 || !/\n}\n$/.test(cur)) throw new Error("data/formats.json: silverAge block not found where expected");
  const F = { silverAge: block(pool, W) };
  const out = cur.slice(0, at) + '  "silverAge": ' + JSON.stringify(F.silverAge, null, 2).replace(/\n/g, "\n  ") + "\n}\n";
  if(process.argv.includes("--check")){
    if(out !== cur){ console.error("data/formats.json silverAge block is stale; run node tools/silver-age.js"); process.exit(1); }
    console.log("silverAge block is current (" + F.silverAge.banned.length + " entries)");
    return;
  }
  fs.writeFileSync(FORMATS, out);
  console.log("Wrote " + F.silverAge.banned.length + " banned entries");
}
if(require.main === module) main();
module.exports = { derive, SOURCE };
