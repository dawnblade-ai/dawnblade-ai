/* ============================================================
   NOTHING MAY SHADOW THE SIDE HELPERS (v2.54).

   `act`/`foe`/`you`/`opp` and their Mut forms are globals declared once
   at the top of the babel blocks. A LOCAL binding with one of those
   names does not merely hide the helper — because it is block-scoped,
   it puts the global into the temporal dead zone for the ENTIRE
   enclosing block, including lines ABOVE the declaration:

       const myTop  = act(st).deck[0], foeTop = foe(st).deck[0];
       const mine   = ..., foe = foeTop ? foeTop.power : 0;   // <- this

   Native ES throws "Cannot access 'foe' before initialization". Babel
   rewrites the const to a hoisted `var _foe`, so what actually shipped
   was `TypeError: _foe is not a function`, and it CRASHED the trainer
   on every clash resolved on defence — seven cards in Kayo's deck.

   It survived because clash fires on BLOCK. Every attack-side test in
   the suite passed straight over it, and so did a live play session.

   CLAUDE.md has warned about this class since v2.25, when `tapTwice`'s
   third parameter was renamed from `act` to `commit` for exactly this
   reason. A warning in prose is not a guard; this is the guard.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const { html } = require("./helpers/extract.js");

const HELPERS = ["act", "foe", "you", "opp", "actMut", "foeMut", "youMut", "oppMut", "actorOf"];

/* Strip comments, strings, template TEXT (keeping ${} expressions) and
   regex literals. A scan that is not literal-aware reports prose — the
   same hazard html-balance.test.js and sync.test.js both document. */
function lex(code){
  let out = "", i = 0, prev = "";
  const n = code.length;
  const regexPos = () => prev === "" || "(,=:[!&|?{};+-*%~^<>".includes(prev) || /\s/.test(prev);
  while(i < n){
    const c = code[i], d = code[i+1];
    if(c === "/" && d === "*"){ const e = code.indexOf("*/", i+2); i = e < 0 ? n : e+2; out += " "; continue; }
    if(c === "/" && d === "/"){ const e = code.indexOf("\n", i); i = e < 0 ? n : e; out += " "; continue; }
    if(c === '"' || c === "'" || c === "`"){
      const q = c; i++;
      while(i < n && code[i] !== q){
        if(code[i] === "\\"){ i += 2; continue; }
        if(q === "`" && code[i] === "$" && code[i+1] === "{"){      // keep the expression
          i += 2; let depth = 1; const start = i;
          while(i < n && depth > 0){
            if(code[i] === "{") depth++;
            else if(code[i] === "}"){ depth--; if(!depth) break; }
            i++;
          }
          out += " " + code.slice(start, i) + " "; i++; continue;
        }
        i++;
      }
      i++; out += ' "" '; prev = '"'; continue;
    }
    if(c === "/" && regexPos()){
      let j = i+1, cls = false, ok = false;
      while(j < n){
        const e = code[j];
        if(e === "\\"){ j += 2; continue; }
        if(e === "\n") break;
        if(e === "[") cls = true; else if(e === "]") cls = false;
        else if(e === "/" && !cls){ ok = true; break; }
        j++;
      }
      if(ok){ i = j+1; while(i < n && /[gimsuy]/.test(code[i])) i++; out += " RX "; prev = "X"; continue; }
    }
    if(!/\s/.test(c)) prev = c;
    out += c; i++;
  }
  return out;
}

test("no local binding shadows a side helper", () => {
  const lines = html().split("\n");
  const offenders = [];

  lines.forEach((raw, idx) => {
    const code = lex(raw);
    for(const h of HELPERS){
      const declared = new RegExp("(?:^|[;{,(]|\\b(?:const|let|var)\\s+)\\s*" + h + "\\s*=(?!=|>)").test(code);
      const asParam  = new RegExp("\\(\\s*(?:[\\w$]+\\s*,\\s*)*" + h + "\\s*(?:,|\\)\\s*=>)").test(code);
      if(!declared && !asParam) continue;
      /* the one legal declaration of each: the canonical arrow at the top
         of the babel block, `const you = s => ...` */
      if(new RegExp("^const\\s+" + h + "\\s*=\\s*[sn]\\s*=>").test(raw.trim())) continue;
      offenders.push(`index.html:${idx+1}  [${h}]  ${raw.trim().slice(0, 100)}`);
    }
  });

  assert.deepEqual(offenders, [],
    "a local binding shadows a side helper. Because it is block-scoped it puts the " +
    "global into the temporal dead zone for the WHOLE block — including lines above it — " +
    "so a call on an earlier line binds to this value instead of the function. That is " +
    "the crash v2.54 fixed in takeIt's clash loop. Rename the local (see cellAct, commit):\n  " +
    offenders.join("\n  "));
});

/* The canonical definitions must still be there — without this, deleting
   them all would make the guard above pass by having nothing to find. */
test("the side helpers are each declared exactly once", () => {
  const lines = html().split("\n");
  for(const h of HELPERS){
    const found = lines.filter(l => new RegExp("^const\\s+" + h + "\\s*=\\s*[sn]\\s*=>").test(l.trim()));
    assert.equal(found.length, 1, `${h} must be declared exactly once at module scope, found ${found.length}`);
  }
});
