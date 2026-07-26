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

module.exports = { ROOT, html, loadData };
