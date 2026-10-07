/* ======================================================================
   A TAP THAT RETURNS ITS HANDLER INSTEAD OF RUNNING IT (v5.01)

   The trainer's `tapTwice(card, verb, commit)` RETURNS a click handler.
   `gearBtn` wraps its choice in an IIFE — `onClick={(()=>{ … return
   tapTwice(…) })()}` — so React receives the handler. The player's arena
   row wrote the same body as a PLAIN arrow, `onClick={()=>{ … return
   tapTwice(…) }}`, so the click ran the arrow, built a handler and threw it
   away. Every tap on that row was dead: no ally attack, no arena ability
   (Gold, the potions, Concealed Object), and the aura route v5.01 added.

   Found driving that aura route at phone dimensions — a source scan could
   not tell the two shapes apart from the call alone, so this census reads
   the SHAPE: no plain-arrow onClick body may `return tapTwice(`.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAW = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
/* the body of a plain-arrow onClick, bounded by a brace walk that skips
   strings — comments are already gone, and JSX text inside these bodies is
   none (they are handler bodies, not markup) */
function arrowBodies(src){
  const out = [], re = /onClick=\{\(\)\s*=>\s*\{/g; let m;
  while((m = re.exec(src))){
    let i = m.index + m[0].length, d = 1, q = null;
    for(; i < src.length && d > 0; i++){
      const ch = src[i];
      if(q){ if(ch === "\\") i++; else if(ch === q) q = null; continue; }
      if(ch === '"' || ch === "'" || ch === "`") q = ch;
      else if(ch === "{") d++;
      else if(ch === "}") d--;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

test("CENSUS: no plain-arrow onClick returns a tapTwice handler", () => {
  const bodies = arrowBodies(strip(RAW));
  assert.equal(bodies.length, 6, "the plain-arrow onClick count moved (" + bodies.length + ") — read the new one, then repin");
  const dead = bodies.filter(b => /return tapTwice\(/.test(b));
  assert.deepEqual(dead.map(b => b.slice(0, 120)), [], "a tap that builds its handler and throws it away");
});

test("the scan can see the defect it is for (control routed THROUGH the scan)", () => {
  const planted = "<button onClick={()=>{ if(x) return tapTwice(c, " + '"v"' + ", go); return setZoom(c); }}>";
  assert.equal(arrowBodies(planted).filter(b => /return tapTwice\(/.test(b)).length, 1);
  const iife = "<button onClick={(()=>{ return tapTwice(c, " + '"v"' + ", go); })()}>";
  assert.equal(arrowBodies(iife).length, 0, "an IIFE is the correct shape and is not a plain-arrow body");
});

test("the arena row is the IIFE, and it offers all three routes", () => {
  const src = strip(RAW);
  const a = src.indexOf("<InPlayRow entries={you(g).board}");
  assert.ok(a > 0, "the arena row moved — re-anchor");
  const row = src.slice(a, src.indexOf("</button>)}/>", a));
  assert.match(row, /onClick=\{\(\(\)=>\{/, "the row is not an IIFE");
  assert.match(row, /\}\)\(\)\}>/, "…and the IIFE is called");
  assert.match(row, /tryPlay\(b\.card,"ally",i\)/);
  assert.match(row, /if\(auraAtkOf\(g, b\.card\)\)\s*return tapTwice\(b\.card, "attack", \(\)=>tryPlay\(b\.card,"aura",i\)\);/);
  assert.match(row, /tryPlay\(bp,"board",i\)/);
});

test("the trainer's aura door prices and limits what judge does", () => {
  const src = strip(RAW);
  assert.match(src, /const auraAtkOf = \(s, card\) => DawnParser\.auraAttackOf\(card, act\(s\),\s*\{yourTurn: actorOf\(s\) === s\.turnPlayer, discount: bAct\(s\)\.auraDiscount\}\);/,
    "the aura reader is not judge's — `yourTurn` and the hero discount are the caller's answer");
  assert.match(src, /: from==="aura"\s*\? \(\(auraAtkOf\(s, card\)\|\|\{\}\)\.cost \|\| 0\) \+ DawnParser\.costTaxes\(card, act\(s\), costCtx\(s, actorOf\(s\)\), "aura"\)/,
    "the aura attack is priced off the card's PLAY cost");
  assert.match(src, /if\(_ga\.oncePerTurn && act\(s\)\.weaponUsed\["aura"\+card\.uid\]\)/, "the once-per-turn key differs from execute's");
  assert.match(src, /if\(s\.chainOpen && from!=="weapon" && from!=="ally" && from!=="aura" && !isAttack\(card\)/,
    "a second aura cannot join an open chain");
});
