/* Shared helpers for the drill suite: source extraction from index.html
   and from engine/ files, used by sync.test.js and decks.test.js. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* Pull one top-level definition ("function name(...)" with brace matching,
   or a single-line "const name = ..."). Brace matching is naive by design:
   every regex/template in the extracted functions carries balanced braces. */
function extractDef(src, name){
  let i = src.search(new RegExp("^function " + name + "\\(", "m"));
  if(i >= 0){
    const open = src.indexOf("{", i);
    let depth = 0, j = open;
    for(; j < src.length; j++){
      if(src[j] === "{") depth++;
      else if(src[j] === "}"){ depth--; if(depth === 0) break; }
    }
    return src.slice(i, j + 1);
  }
  i = src.search(new RegExp("^const " + name + " *=", "m"));
  if(i >= 0) return src.slice(i, src.indexOf("\n", i));
  throw new Error("definition not found: " + name);
}

const squash = s => s.replace(/\s+/g, " ").trim();

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

module.exports = { ROOT, html, extractDef, squash, loadData };
