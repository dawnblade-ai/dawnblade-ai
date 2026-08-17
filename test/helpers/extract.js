/* Shared helpers for the drill suite: reading index.html and the deck
   data out of it.

   `extractDef` / `squash` lived here until v2.20 to compare a function
   body in index.html against its copy in engine/. There are no copies
   any more — index.html loads engine/*.js — so they went with the
   mirrors. sync.test.js now guards the inverse property (no shadowing)
   and needs no source extraction. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* THE CARD SEMANTICS MOVED (v2.53, the effects port). Several drills pin
   a line of `runOps`/`execute` by reading the source, because those were
   closures inside a React component and no drill could CALL them. They
   are reachable now, so those guards can become behavioural over time —
   but a source guard pointed at the wrong file passes by finding nothing,
   so they are repointed here rather than left to rot. */
const effects = () => fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");

/* The plain data <script> (window.CDN ... DECKS ... TROPHIES), evaluated
   with a bare window stub so tests can read the real deck lists. */
function loadData(){
  const src = html();
  const start = src.indexOf("window.CDN");
  if(start < 0) throw new Error("data script not found");
  const end = src.indexOf("</script>", start);
  const w = {};
  new Function("window", src.slice(start, end))(w);
  return w;
}

/* ---- WHERE THE CARD DATABASE COMES FROM -----------------------------

   `npm test` on a fresh clone used to be 749 passes and 304 SILENT
   SKIPS: every drill that needs a card gated on `tools/.cache/card.json`,
   a 22MB download that is gitignored. "1053 green" therefore meant
   "green on a machine that had happened to fetch", and it hid 22 pool
   cards that had stopped resolving when the upstream database reworded
   them.

   THE SUITE READS THE PINNED POOL, AND PREFERS IT EVEN WHEN A LIVE COPY
   IS SITTING THERE. That is the whole point: a drill is a statement
   about the engine, and a drill whose fixture is re-downloaded from
   someone else's `develop` branch is a statement about two things at
   once. When upstream moves, exactly one drill is allowed to notice —
   `test/drift.test.js`, which reads the live copy on purpose and
   compares what the parser makes of each.

   `data/pool.json` is written by `tools/pin-pool.js` and is fetched
   data, never authored. The GAME still streams the live database at
   runtime; pinning the fixture does not pin the player. */
const POOL = path.join(ROOT, "data", "pool.json");
const LIVE = path.join(ROOT, "tools", ".cache", "card.json");

const cardDbPath = () => fs.existsSync(POOL) ? POOL : LIVE;
const hasLiveDb  = () => fs.existsSync(LIVE);
const liveDbPath = () => LIVE;

module.exports = { ROOT, html, effects, loadData, cardDbPath, hasLiveDb, liveDbPath, POOL, LIVE };
