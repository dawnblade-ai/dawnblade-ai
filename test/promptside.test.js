/* ============================================================
   promptside.test.js — EVERY QUEUED PROMPT NAMES ITS SEAT (v5.43)

   QUEUE v4 S10(a). `prompts.buildPrompt` defaults a missing `side` to
   0, so a spec queued without one is addressed to seat 0 whoever
   resolved it. The two opt specs (`opt` and `lookOrder`) were the only
   ones: Blaze in seat 1 played Whisper of the Oracle and the sheet
   offered SEAT 0 the top three of SEAT 0's deck — a free opt for the
   wrong player, at the table and over the network alike. Every opt
   drill ran at seat 0, the one seat where the default is right.

   So this is a census, not a list: every push onto `promptQ` in
   `effects.js` is read out of the source and must name a side, either
   as a key on the literal or through a `*Spec(…, side)` builder or a
   variable built with one. A new spec without a side fails here rather
   than defaulting to seat 0. Then both opt variants are DRIVEN at
   seat 1.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const PM = require("../engine/prompts.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
const skip = !H.hasDb() && "no cached card database";

/* The builders that take the seat as an argument, and the variables a
   push site hands over by name. Both PINNED: a new one is a deliberate
   edit, made after checking it carries a side. */
const BUILDERS = ["millCostSpec", "optCostSpec", "payCostSpec"];
const VARS = ["R.tapSpec", "spec", "tapSpec"];

/* Bracket-matched read of the expression pushed after `promptQ||[]),`,
   skipping strings and template literals so a `]` in a feed line does
   not end it early. */
function pushedExpr(src, at){
  let depth = 0, i = at, q = null;
  for(; i < src.length; i++){
    const ch = src[i];
    if(q){ if(ch === "\\"){ i++; continue; } if(ch === q) q = null; continue; }
    if(ch === '"' || ch === "'" || ch === "`"){ q = ch; continue; }
    if("([{".includes(ch)) depth++;
    else if(")]}".includes(ch)){ if(depth === 0) break; depth--; }
  }
  return src.slice(at, i).trim();
}

const PUSH = /promptQ\s*(?:=|:)\s*\[\s*\.\.\.\(\s*[\w.]+\.promptQ\s*\|\|\s*\[\]\s*\)\s*,/g;

function pushSites(src){
  const out = [];
  let m;
  PUSH.lastIndex = 0;
  while((m = PUSH.exec(src))){
    const line = src.slice(0, m.index).split("\n").length;
    out.push({line, expr: pushedExpr(src, m.index + m[0].length)});
  }
  return out;
}

/* How a pushed expression names its seat, or null if it does not. */
function sideOf(expr){
  let e = expr;
  const oa = e.match(/^Object\.assign\(\s*/);
  if(oa) e = e.slice(oa[0].length);
  if(e.startsWith("{")) return /[{,]\s*side\s*[:,}]/.test(pushedExpr(e, 1).replace(/^/, "{")) ? "literal" : null;
  const call = e.match(/^(\w+)\(/);
  if(call) return BUILDERS.includes(call[1]) ? "builder" : null;
  const v = e.match(/^([\w.]+)$/);
  if(v) return VARS.includes(v[1]) ? "var" : null;
  return null;
}

test("the scan is alive: it finds the push sites and refuses a spec with no side", () => {
  const sites = pushSites(SRC);
  assert.ok(sites.length >= 30, "the scan found " + sites.length + " push sites");
  /* CONTROLS ROUTED THROUGH THE SCAN, never beside it (v4.32). Built by
     concatenation so the file under test is not the one carrying them. */
  const bad = "n." + "promptQ = [...(n." + "promptQ||[]), {tag:\"opt\", n:3, src:x}];";
  const good = "n." + "promptQ = [...(n." + "promptQ||[]), {tag:\"opt\", side:actorOf(n), n:3}];";
  const short = "n." + "promptQ = [...(n." + "promptQ||[]), {tag:\"opt\", side, n:3}];";
  assert.equal(sideOf(pushSites(bad)[0].expr), null, "a literal with no side is refused");
  assert.equal(sideOf(pushSites(good)[0].expr), "literal");
  assert.equal(sideOf(pushSites(short)[0].expr), "literal", "shorthand `side,` counts");
  assert.equal(sideOf("mysterySpec(oc, card)"), null, "an unknown builder is refused");
  assert.equal(sideOf("someVar"), null, "an unknown variable is refused");
});

test("every promptQ push in effects.js names a side", () => {
  const missing = pushSites(SRC).filter(s => !sideOf(s.expr))
    .map(s => `effects.js:${s.line}: ${s.expr.slice(0, 80)}`);
  assert.deepEqual(missing, [], "a spec without a side is addressed to seat 0 whoever resolved it");
});

test("the pinned builders and variables are each one that carries a side", () => {
  const used = new Set(pushSites(SRC).map(s => {
    const e = s.expr.replace(/^Object\.assign\(\s*/, "");
    const c = e.match(/^(\w+)\(/); if(c) return "b:" + c[1];
    const v = e.match(/^([\w.]+)$/); if(v) return "v:" + v[1];
    return null;
  }).filter(Boolean));
  assert.deepEqual([...used].filter(x => x.startsWith("b:")).map(x => x.slice(2)).sort(), BUILDERS,
    "the builder set moved: check the new one takes and returns a side");
  assert.deepEqual([...used].filter(x => x.startsWith("v:")).map(x => x.slice(2)).sort(), VARS,
    "the variable set moved: check how the new one is built");
  for(const b of BUILDERS){
    const i = SRC.indexOf("function " + b + "(");
    assert.ok(i > 0, b + " is defined");
    const body = SRC.slice(i, SRC.indexOf("\nfunction ", i + 1));
    assert.match(body.split("\n")[0], /,\s*side\b/, b + " takes the seat as a parameter");
    assert.match(body, /[{,]\s*side\s*[:,]/, b + " returns a spec carrying it");
  }
  /* Every place the named variables are BUILT carries a side, or comes
     out of a pinned builder. */
  const defs = [...SRC.matchAll(/const (spec|tapSpec)\s*=\s*([^;]*)/g)];
  assert.ok(defs.length >= 3, "the definitions were found");
  for(const d of defs){
    if(!/^\s*(?:\{|\w+Spec\()/.test(d[2])) continue;   /* a `spec` that is not a prompt */
    assert.ok(/\bside\b/.test(d[2].slice(0, 400)) || BUILDERS.some(b => d[2].startsWith(b + "(")),
      "const " + d[1] + " is built without a side: " + d[2].slice(0, 80));
  }
});

/* ---- DRIVEN: both opt variants at seat 1 -------------------------------- */

const MINE = ["Wild Ride", "Buckwild", "Bare Fangs", "Rough Up"];
const THEIRS = ["Cindering Foresight", "Photon Splicing", "Look Tuff", "Frost Spike"];
function deckOf(names, base){
  return names.map((n, i) => {
    const c = H.card(n, 1) || H.card(n, 2) || H.card(n, 3);
    return {...c, uid: base + i};
  });
}

for(const kind of ["opt", "lookOrder"]){
  test(kind + " resolved by seat 1 opens on SEAT 1, over seat 1's deck", {skip}, () => {
    H.db();
    for(const seat of [0, 1]){
      let g = H.state({deck: deckOf(MINE, 100)}, {deck: deckOf(THEIRS, 200)},
                      {actor: seat, turnPlayer: seat, turn: 3});
      g = H.runOps(g, [[kind, 3]], "Whisper of the Oracle");
      const spec = (g.promptQ || [])[0];
      assert.ok(spec, "the sheet is queued");
      assert.equal(spec.side, seat, "addressed to the seat that opted");
      const live = PM.buildPrompt(g, spec);
      assert.equal(live.side, seat);
      const own = seat ? THEIRS : MINE;
      assert.deepEqual(live.cards.map(c => c.name), own.slice(0, 3),
        "it looks at the opting seat's OWN top three");
    }
  });
}

test("seat 1's opt answered: its own deck is reordered, seat 0's is untouched", {skip}, () => {
  H.db();
  let g = H.state({deck: deckOf(MINE, 100)}, {deck: deckOf(THEIRS, 200)},
                  {actor: 1, turnPlayer: 1, turn: 3});
  g = H.runOps(g, [["opt", 2]], "Whisper of the Oracle");
  g.prompt = PM.buildPrompt(g, g.promptQ[0]);
  g.promptQ = [];
  /* Send the first card to the bottom: the answer that tells the decks apart. */
  g.prompt = PM.promptToggleSel(g.prompt, 0);
  g = H.fx(g, (f, n) => f.applyAnswer(n, n.prompt));
  assert.deepEqual(g.sides[0].deck.map(c => c.uid), [100, 101, 102, 103], "seat 0's deck untouched");
  const d1 = g.sides[1].deck.map(c => c.uid);
  assert.equal(d1.length, 4);
  assert.notDeepEqual(d1, [200, 201, 202, 203], "seat 1's own deck was the one reordered");
});
