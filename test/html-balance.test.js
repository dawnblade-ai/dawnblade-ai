/* Validation ritual #1, formalized: bracket balance on both text/babel
   blocks. String- and template-literal-aware; NOT regex-literal-aware,
   so the regexes containing apostrophes (hero'?s?) are pre-neutralized
   exactly as the ritual prescribes. Also checks the single-</style> rule
   and that the data script parses as plain JS. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { html } = require("./helpers/extract");

const src = html();

function babelBlocks(s){
  const out = [];
  const re = /<script type="text\/babel"[^>]*>/g;
  let m;
  while((m = re.exec(s))){
    const end = s.indexOf("</script>", m.index);
    out.push(s.slice(m.index + m[0].length, end));
  }
  return out;
}

/* Counts (){}[] outside double-quoted strings, template literals (with
   ${} nesting), and comments. Single quotes are NOT string delimiters
   here (apostrophes appear in JSX prose); the codebase uses none. */
function checkBalance(code){
  code = code.split("hero'?s?").join("heroQsQ");
  /* Pre-neutralized for the same reason and by the same ritual: this
     checker is not regex-literal-aware, and a regex that ENDS in a star
     followed by a slash looks exactly like a comment terminator to the
     orphan check below. Add any new such regex here rather than weakening
     the check — the check is what caught the v2.27 breakage. */
  code = code.split("/^[^:]*:\\s*/").join("RX_NEUTRALIZED");
  const stack = [];
  const OPEN = {"(":")", "{":"}", "[":"]"};
  const CLOSE = {")":"(", "}":"{", "]":"["};
  let mode = "code"; // code | dq | tpl | line | block
  const tplDepth = [];
  for(let i = 0; i < code.length; i++){
    const ch = code[i], nx = code[i+1];
    if(mode === "dq"){
      if(ch === "\\") i++;
      else if(ch === '"') mode = "code";
      continue;
    }
    if(mode === "line"){ if(ch === "\n") mode = "code"; continue; }
    if(mode === "block"){ if(ch === "*" && nx === "/"){ i++; mode = "code"; } continue; }
    if(mode === "tpl"){
      if(ch === "\\") i++;
      else if(ch === "`") mode = "code";
      else if(ch === "$" && nx === "{"){ tplDepth.push(0); mode = "code"; stack.push("tpl{"); i++; }
      continue;
    }
    // code mode
    if(ch === '"'){ mode = "dq"; continue; }
    if(ch === "`"){ mode = "tpl"; continue; }
    if(ch === "/" && nx === "/"){ mode = "line"; continue; }
    if(ch === "/" && nx === "*"){ mode = "block"; continue; }
    /* AN ORPHANED COMMENT TERMINATOR reached in CODE mode: a block comment
       was closed twice, so the prose after the first close became code.
       Not hypothetical — it shipped in v2.27 and broke the page completely
       while all 338 drills stayed green, because the orphaned prose
       happened to contain balanced brackets. Bracket balance alone cannot
       see this class at all. */
    if(ch === "*" && nx === "/")
      return {ok:false, at:i, ch:"star-slash",
              top:"orphaned comment terminator — a block comment was closed twice"};
    if(OPEN[ch]){ stack.push(ch); continue; }
    if(CLOSE[ch]){
      const top = stack.pop();
      if(top === "tpl{" && ch === "}"){ mode = "tpl"; continue; }
      if(top !== CLOSE[ch]) return {ok:false, at:i, ch, top};
    }
  }
  return stack.length ? {ok:false, at:code.length, ch:"EOF", top:stack[stack.length-1]} : {ok:true};
}

/* The page's babel code is FOUR consecutive blocks: script0 (loader / UI shell) and script1 split in three at top-level function seams (1a trainer, 1b server
   table UI, 1c App + the mount), because Babel stops formatting a block over 500,000 characters and tools/page.js treats the console note as a crash
   (v6.88: the trainer block had ~1,000 characters of headroom). Top-level const/function become globals, so the blocks see one another in document order. */
const BLOCK_CAP = 450000;
test("index.html carries exactly four text/babel blocks (script0 and script1 in three)", () => {
  assert.equal(babelBlocks(src).length, 4);
});

["script0 (loader / UI shell)", "script1a (trainer)", "script1b (server table UI)", "script1c (App and the mount)"].forEach((name, i) => {
  test("bracket balance — " + name, () => {
    const r = checkBalance(babelBlocks(src)[i]);
    assert.ok(r.ok, `unbalanced at index ${r.at}: found ${r.ch} against ${r.top}`);
  });
});

/* every block stays under the cap, with room: move a seam or split again BEFORE 500,000 (Babel's deoptimise note is a console.error that fails every page drive) */
function oversize(s){ return babelBlocks(s).map((b, i) => [i, b.length]).filter(x => x[1] > BLOCK_CAP); }
test("no text/babel block is longer than 450,000 characters", () => {
  assert.deepEqual(oversize(src), [], "a block passed the cap: move a seam (see the comment above BLOCK_CAP)");
  const padded = src.replace('data-presets="env,react">\n', m => m + "/*" + "x".repeat(BLOCK_CAP) + "*/\n");
  assert.ok(oversize(padded).length > 0, "sabotage (a padded block) must trip the cap");
});

/* the mount runs last: every component must exist before the first render */
test("the createRoot mount is in the LAST text/babel block, once", () => {
  const bl = babelBlocks(src), at = bl.map((b, i) => /ReactDOM\.createRoot\(/.test(b) ? i : -1).filter(i => i >= 0);
  assert.deepEqual(at, [bl.length - 1]);
  const moved = src.replace("ReactDOM.createRoot(document.getElementById(\"root\")).render(<App/>);\n", "");
  const b2 = babelBlocks(moved).map((b, i) => /ReactDOM\.createRoot\(/.test(b) ? i : -1).filter(i => i >= 0);
  assert.notDeepEqual(b2, [babelBlocks(moved).length - 1], "sabotage (no mount) must trip the guard");
});

test("single </style> block", () => {
  assert.equal((src.match(/<\/style>/g) || []).length, 1);
});

test("data script is valid plain JavaScript", () => {
  const start = src.indexOf("window.CDN");
  const end = src.indexOf("</script>", start);
  assert.doesNotThrow(() => new Function("window", src.slice(start, end)));
});
