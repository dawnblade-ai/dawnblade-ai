#!/usr/bin/env node
/* ============================================================
   `npm run unanchored` — WHICH SENTENCES DID A LOOSE MATCH ONLY HALF-READ?

     npm run unanchored             the report
     npm run unanchored -- --json   machine-readable, for test/unanchored.test.js

   v4.82 found that the plain-draw rule in `classifyClause` was anchored at
   neither end, so "draw a card AND create a Gold token" read as the draw
   alone. Five shapes, every one `tier: full`. v4.83 ran the question over
   the rest of the family by hand, and a scratch script found three more
   (Aether Spindle's X read as 1, Spectral Manifestations' gated counters,
   a standing static fired once on play). NINE live defects from one
   question, so it is standing now (v4.42: a census run by hand is a
   census somebody will forget to run).

   THE QUESTION. For every clause of every pool record that reads `run`,
   which match produced the answer, and did it cover the sentence? A rule
   that matched a SUBSTRING and returned has claimed the whole clause, and
   whatever it did not match is read by nothing, unless some other reader
   claims it afterwards. So a leftover is a LEAD, not a finding (v3.17,
   v4.18). Most are legitimate: a target or a window left to another
   reader, an `instead` payload, a sentence a whole-card reader pairs later.

   HOW IT SEES. A private copy of `parser.js` is compiled from source in its
   own `vm` realm with every `c.match(` and `.test(c)` inside
   `classifyClause` wrapped, so each successful match is recorded with the
   clause it ran against. The realm keeps the wrapper off this process's
   own `RegExp.prototype`. The LAST successful match before the clause
   returns is the one that decided it — which is exact for a rule that
   matches and returns, and is why an extraction match after the decision
   (the token rule's tail check) is its own family below, stated rather
   than filtered.

   THE POOL IS FROZEN (`data/formats.json`), so the leftover set moves only
   when the PARSER does. That is what makes it pinnable: a new entry is a
   reader that has started swallowing a sentence, and a departure is a
   sentence that has started being read whole.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PARSER = path.join(ROOT, "engine", "parser.js");

/* The instrumented parser, and how many sites it wrapped. The counts are
   reported so a drill can prove the transform reached the function rather
   than silently wrapping nothing (v3.81). */
function instrumented(){
  const src = fs.readFileSync(PARSER, "utf8");
  const a = src.indexOf("function classifyClause(raw){");
  const b = a < 0 ? -1 : src.indexOf("\nfunction ", a + 10);
  if(a < 0 || b < 0) throw new Error("classifyClause moved — re-anchor tools/unanchored.js");
  const body = src.slice(a, b);
  const sites = {match: (body.match(/\bc\.match\(/g) || []).length,
                 test: (body.match(/\.test\(c\)/g) || []).length};
  const wrapped = body.replace(/\bc\.match\(/g, "__UM(c,").replace(/\.test\(c\)/g, ".__UT(c)");
  const log = [];
  const sandbox = {module: {exports: {}}, console};
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  /* the wrappers are defined INSIDE the realm, so a regex literal compiled
     there finds `__UT` on its own RegExp.prototype */
  vm.runInContext(`
    Object.defineProperty(RegExp.prototype, "__UT", {value: function(c){
      const m = String(c).match(this); if(m && globalThis.__ULOG) globalThis.__ULOG.push({src: String(this), m0: m[0], c: String(c)});
      return !!m; }, enumerable: false});
    globalThis.__UM = (c, rx) => { const m = String(c).match(rx);
      if(m && globalThis.__ULOG) globalThis.__ULOG.push({src: String(rx), m0: m[0], c: String(c)}); return m; };`, sandbox);
  vm.runInContext(src.slice(0, a) + wrapped + src.slice(b), sandbox, {filename: "parser.instrumented.js"});
  const P = sandbox.module.exports;
  return {P, sites, begin: () => { log.length = 0; sandbox.__ULOG = log; }, end: () => { sandbox.__ULOG = null; return log.slice(); }};
}

/* Every card a match can deal, resolved the way the game resolves it. */
function poolCards(){
  const C = require(path.join(ROOT, "engine", "cards.js"));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard);
  const db = C.buildMaps(raw);
  return raw.map(r => C.resolveEntry(db, {name: r.n, p: r.p || 0, code: null, q: 1})).filter(Boolean);
}

/* A match "covers" its clause when at most a trailing character is left. */
const covers = (m0, c) => m0.trim().length >= c.trim().length - 1;

function census(){
  const I = instrumented();
  const leftovers = new Map();   /* family (regex source) -> Map(sentence -> Set(card)) */
  let clauses = 0;
  for(const card of poolCards()){
    I.P.fxReset && I.P.fxReset();
    let fx;
    try { fx = I.P.fxParse(card); } catch(e){ continue; }
    for(const cl of (fx.clauses || [])){
      if(cl.st !== "run") continue;
      clauses++;
      I.begin();
      let r = null;
      try { r = I.P.classifyClause(cl.t); } catch(e){}
      const log = I.end();
      if(!r || r.status !== "run" || !log.length) continue;
      const last = log[log.length - 1];
      if(covers(last.m0, last.c)) continue;
      const fam = leftovers.get(last.src) || new Map();
      const s = last.c.trim();
      fam.set(s, (fam.get(s) || new Set()).add(card.name));
      leftovers.set(last.src, fam);
    }
  }
  const families = [...leftovers].map(([src, m]) => ({src,
    sentences: [...m.keys()].sort(), cards: [...new Set([...m.values()].flatMap(s => [...s]))].sort()}))
    .sort((x, y) => y.sentences.length - x.sentences.length || (x.src < y.src ? -1 : 1));
  return {sites: I.sites, clauses, families,
          total: families.reduce((k, f) => k + f.sentences.length, 0)};
}

module.exports = {census, instrumented, covers};

if(require.main === module){
  const r = census();
  if(process.argv.includes("--json")){ process.stdout.write(JSON.stringify(r, null, 2) + "\n"); return; }
  console.log(`UNANCHORED — ${r.total} sentences in ${r.families.length} families, `
    + `over ${r.clauses} run clauses (${r.sites.match} match + ${r.sites.test} test sites wrapped)\n`);
  for(const f of r.families){
    console.log(`### ${f.src}  (${f.sentences.length})`);
    for(const s of f.sentences) console.log("    " + JSON.stringify(s));
    console.log("");
  }
  console.log("A leftover is a LEAD: the match that decided the clause did not cover it.\n"
    + "Ask whether another reader claims the rest — most do — before calling it a defect.");
}
