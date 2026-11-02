/* ============================================================
   SHARP OR STEADY (lookahead phase 2, increment b).

   The loadout's one difficulty control must reach the AI seat: the tap
   sets `aiLevel`, the table start turns it into `sharp`, the App seats it
   on the local match, and the TableBoard's policy and the player's call
   both pass `{search: match.sharp}` to sparring. A link missing anywhere in
   that chain is a control that changes nothing, which reads as a working
   screen — so every link is asked for here, on the comment-stripped
   source, and the engine end is asked behaviourally: Steady IS the rule
   policy and Sharp is the search (test/lookahead.test.js holds both
   directions over a whole game; this drill holds the one position that
   matters to a player, a move where the two differ).

   The control's boxes at phone size are driven by tools/page.js
   ("table: Sharp / Steady"), which is not part of npm test.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {match} = require("../tools/selfplay.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const CODE = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the loadout offers Sharp and Steady for an AI hero, remembers the pick, and Sharp is the default", () => {
  assert.match(CODE, /const \[aiLevel,setAiLevelS\] = uS\(\(\)=>store\.get\("aiLevel","sharp"\)==="steady" \? "steady" : "sharp"\)/,
    "the level opens on Sharp unless the player chose Steady before");
  assert.match(CODE, /const setAiLevel = v => \{ store\.set\("aiLevel", v\); setAiLevelS\(v\); \}/, "a tap is remembered");
  const ctl = CODE.match(/\{aiFoe!==null && <div className="ailevel"[\s\S]*?<\/div>\}/);
  assert.ok(ctl, "the control sits under the picker and only for an AI hero (the Dummy has no level)");
  assert.match(ctl[0], /onClick=\{\(\)=>setAiLevel\("sharp"\)\}/);
  assert.match(ctl[0], /onClick=\{\(\)=>setAiLevel\("steady"\)\}/);
  assert.equal((ctl[0].match(/<button /g) || []).length, 2, "two tiles, never a select (v2.81)");
  assert.ok(!/<select/.test(ctl[0]));
});

test("the level rides on the table start, onto the match, into the AI seat and the call", () => {
  assert.match(CODE, /onStart\(\{gearIdx:sel, cuts, table:true, aiFoe: pickedFoe, sharp: !!pickedFoe && aiLevel==="sharp"\}\)/,
    "Sharp only for an AI hero, and only when the player left it on Sharp");
  assert.match(CODE, /setLocalTable\(\{\.\.\.m, sharp: !!cfg\.sharp, g: DawnJudge\.newMatch/, "the App seats it on the match");
  assert.match(CODE, /policy: \(st, i\) => DawnSparring\.act\(st, i, \{search: !!match\.sharp\}\)/, "the AI seat reads it");
  assert.match(CODE, /DawnSparring\.explain\(g, mySeat, \{search: !!match\.sharp\}\)/, "and so does the player's call");
  assert.match(CODE, /report: \(\) => \(\{seat: mySeat, local: true, sharp: !!match\.sharp,/, "and a report says which it was");
  assert.ok(!/DawnSparring\.act\(st, i\)\s*,/.test(CODE), "no policy call left that ignores the level");
});

test("Steady is the rule policy and Sharp is the search, at a position where they differ", () => {
  let g = match("arakni", "kayo", "ailevel", 0), seen = 0;
  for(let i = 0; i < 1500 && !g.over && !seen; i++){
    let a = null, s;
    for(s of [0, 1]){ a = SP.act(g, s, {search: false}); if(a) break; }
    if(!a) break;
    const sharp = SP.act(g, s, {search: true});
    if(JSON.stringify(sharp) !== JSON.stringify(a)){
      seen++;
      assert.deepEqual(a, SP.actBase(g, s), "Steady is the rule policy");
      assert.equal(J.legal(g, sharp, s), null, "Sharp's move is legal");
      assert.match(SP.explain(g, s, {search: true}).key, /^la[A-Z]/, "and the call says it was played out");
      assert.ok(!/^la[A-Z]/.test(SP.explain(g, s, {search: false}).key || ""), "Steady's call never claims a search");
    }
    const out = J.reduce(g, a, s); if(out.error) break; g = out.state;
  }
  assert.equal(seen, 1, "a position where the two levels choose differently was reached");
});
