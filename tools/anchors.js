#!/usr/bin/env node
/* ============================================================
   `npm run anchors` — WHICH PARSER READERS HAS THE POOL NEVER REACHED?

     npm run anchors            the report
     npm run anchors -- --json  machine-readable, for test/anchors.test.js

   EVERY OTHER TOOL HERE ASKS ABOUT A CARD. The audit asks how much of a
   card's text was read, the fairness sweep whether the reading was too
   generous, `failstates.js` whether unread text is dangerous, `npm run
   scenes` whether the card DOES what it prints. **Nothing asked about the
   READER** — and that is the question v4.48 answered twice by accident:

     `perEquipDef` and `perBoost` were anchored on "this gets +X{p}, WHERE
     X IS THE NUMBER OF …", which is the RULING's paraphrase. The database
     prints "+N{p} FOR EACH …" on every one of 797 records, so both
     anchors had **never once fired** — two carefully-reasoned fire sites
     with no emitter, and the cards they were written for read a flat +1
     through a loose matcher instead. Dead rules code that reads like a
     rule (v4.11), and the only reason anybody found out is that somebody
     read the four cards side by side.

   THIS IS THAT QUESTION AS A STANDING ONE. Two halves, because they fail
   differently and no single scan can see both:

     ANCHORS   V8 coverage over a run that parses every pool record AND
               every powCard the three builders make. A `return R([…])`
               or `return NOOP(…)` whose first byte never executed is a
               reader with ZERO claimants.

     OP KINDS  every op kind something a match can DEAL emits, against
               `runOps`'s own dispatcher vocabulary — both directions. A
               kind dispatched with no emitter is the `perBoost` shape; a
               kind emitted with no case in `runOps` must name the site
               that dispatches it instead.

   THE POWCARD HALF IS LOAD-BEARING, not thoroughness. Asked of pool
   records alone, TWELVE op kinds look orphaned and SEVEN of the twelve
   are claimed by an equipment or hero ABILITY — `arsCycle` (Azalea),
   `arsTurn` (Bravo), `untapAlly` (Scuttle Toes), `roll` (Knucklehead),
   `mkBanish` (Pouncing Paws), `namedBuff` (Tearing Shuko), `awd`
   (Runebleed Robe). A hero powCard is built by `build.js` out of a
   printed line and is NOT a pool card (v3.73), so a census that stops at
   the pool reports seven false positives — v4.00's false-POSITIVE shape,
   which is exactly what the first run of this tool produced.

   A DEAD ANCHOR IS A LEAD, NOT A FINDING (v3.17, v4.18). Most of them are
   honest: a NOOP shadowed by a whole-card reader built later (the four
   clash reasons, both inertia reasons), or a wording the pool prints only
   inside a compound cost where a different reader correctly claims it
   (`{t} your hero`, `banish N cards from your soul`). What makes one a
   DEFECT is the v4.48 question — **does the pool print a near-miss of
   this wording, and is that near-miss read by something ELSE, wrongly?**
   The tool prints the set; a person asks that question of each.

   AND THE FIRE-SITE HALF IS DELIBERATELY NOT COVERAGE. An `else if(k ===
   …)` in `effects.js` that no parse reaches says nothing — it needs a
   DRIVEN GAME, which is `npm run play`'s job. The op census answers the
   sharper question without a game: not "was this line executed" but "can
   anything a match deals ever produce this op at all".
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const {execFileSync} = require("child_process");

const ROOT = path.join(__dirname, "..");
const PARSER = path.join(ROOT, "engine", "parser.js");

/* ---- the drive leg: parse everything a match can deal --------------- */
function drive(){
  const H = require(path.join(ROOT, "test", "helpers", "judged.js"));
  const P = require(PARSER);
  const B = require(path.join(ROOT, "engine", "build.js"));
  const DB = H.db();
  let n = 0;
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    n++;
    try { P.fxParse(rc); } catch(e){}
    /* THE THREE POWCARD BUILDERS (v3.79, v3.63, v4.47 name them by name).
       Each turns a printed ability line into a card `fxParse` reads, and
       none of those cards is in the pool. */
    try { const gr = B.equipPiece(Object.assign({}, rc, {uid: 900000 + n}));
          if(gr.powCard) P.fxParse(gr.powCard); } catch(e){}
    try { const bp = B.boardPow({card: rc, kind: "aura", uid: 800000 + n});
          if(bp) P.fxParse(bp); } catch(e){}
    try { const hp = P.parseHeroPower(rc.tx);
          if(hp) P.fxParse({name: rc.name + " — hero power", pitch: 0, cost: hp.cost,
            power: null, def: null, tt: "Hero Ability", kw: hp.ga ? ["Go again"] : [],
            tx: B.heroAbilityLine(rc, hp), uid: "hpow"}); } catch(e){}
  }
  return n;
}
if(process.argv.includes("--drive")){ drive(); process.exit(0); }

/* ---- half one: the anchors, by coverage ----------------------------- */
function deadAnchors(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-anchors-"));
  execFileSync(process.execPath, [__filename, "--drive"],
    {env: Object.assign({}, process.env, {NODE_V8_COVERAGE: dir}), stdio: "ignore"});
  const files = fs.readdirSync(dir).filter(x => /^coverage.*\.json$/.test(x));
  if(!files.length) throw new Error("no coverage written to " + dir);
  /* MERGE every coverage file. One process writes one, but a child that
     forks would write more and taking only the first would report its
     own un-run half as dead. */
  const fns = [];
  for(const f of files){
    const cov = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const e = (cov.result || []).find(r => r.url && r.url.endsWith("engine/parser.js"));
    if(e) fns.push(...e.functions);
  }
  for(const f of files) fs.unlinkSync(path.join(dir, f));
  fs.rmdirSync(dir);
  if(!fns.length) throw new Error("parser.js has no coverage — the drive leg did not load it");

  const src = fs.readFileSync(PARSER, "utf8");
  const hit = new Uint8Array(src.length);
  /* COVERED FIRST, THEN UNCOVERED. V8 nests ranges: a count-0 range sits
     inside its enclosing count-N one, so painting them in this order is
     what makes an unexecuted branch read as unexecuted. */
  for(const fn of fns) for(const r of fn.ranges) if(r.count > 0)
    for(let i = r.startOffset; i < r.endOffset && i < src.length; i++) hit[i] = 1;
  for(const fn of fns) for(const r of fn.ranges) if(r.count === 0)
    for(let i = r.startOffset; i < r.endOffset && i < src.length; i++) hit[i] = 0;

  const lines = src.split("\n");
  const all = [], dead = [];
  let off = 0;
  for(let i = 0; i < lines.length; i++){
    const L = lines[i];
    /* A RETURN SITE, never a `return null` or a bare `return`: what this
       asks is "does any card reach this READING", and refusing is the
       default every unreachable path shares. */
    const m = L.match(/\breturn\s+(?:R\(|NOOP\(|\{status)/);
    if(m){
      const at = off + L.indexOf("return");
      const row = {line: i + 1, ran: !!hit[at], txt: L.trim()};
      all.push(row);
      if(!row.ran) dead.push(row);
    }
    off += L.length + 1;
  }
  return {sites: all.length, dead};
}

/* ---- half two: the op kinds, by asking the parser ------------------- */
function opCensus(){
  const H = require(path.join(ROOT, "test", "helpers", "judged.js"));
  const P = require(PARSER);
  const B = require(path.join(ROOT, "engine", "build.js"));

  /* WHAT `runOps` DISPATCHES. Read out of the one body that dispatches
     ops, bounded at the next same-indent declaration of any kind — a
     bound too WIDE hides a finding and one too narrow invents one
     (v4.05, both directions in one release). */
  const efx = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const at = efx.indexOf("const runOps = (s, ops, srcName) => {");
  if(at < 0) throw new Error("runOps not found in effects.js");
  const rest = efx.slice(at + 10);
  const end = rest.match(/\n  (?:const|function|let|var|\/\* -)/);
  const body = efx.slice(at, at + 10 + (end ? end.index : rest.length));
  const disp = new Set();
  for(const m of body.matchAll(/\bk\s*===\s*"([a-zA-Z][\w]*)"/g)) disp.add(m[1]);

  /* WHAT ANYTHING A MATCH CAN DEAL EMITS. A recursive walk, never a
     hand-picked field list — v4.18 reported two built cards as unbuilt
     because its walk named the fields it expected. */
  const cand = new Map();                       // kind -> a source that emits it
  const seen = new WeakSet();
  const walk = (v, src) => {
    if(v == null) return;
    if(Array.isArray(v)){
      if(typeof v[0] === "string" && !cand.has(v[0])) cand.set(v[0], src);
      v.forEach(x => walk(x, src));
      return;
    }
    if(typeof v === "object"){
      if(seen.has(v)) return;
      seen.add(v);
      for(const k of Object.keys(v)) walk(v[k], src);
    }
  };
  const DB = H.db();
  let n = 0, pow = 0;
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    n++;
    try { walk(P.fxParse(rc), "card:" + rc.name); } catch(e){}
    try { const gr = B.equipPiece(Object.assign({}, rc, {uid: 900000 + n}));
          if(gr.powCard){ pow++; walk(P.fxParse(gr.powCard), "equip:" + rc.name); } } catch(e){}
    try { const bp = B.boardPow({card: rc, kind: "aura", uid: 800000 + n});
          if(bp){ pow++; walk(P.fxParse(bp), "arena:" + rc.name); } } catch(e){}
    try { const hp = P.parseHeroPower(rc.tx);
          if(hp){ pow++; walk(P.fxParse({name: rc.name + " — hero power", pitch: 0,
            cost: hp.cost, power: null, def: null, tt: "Hero Ability",
            kw: hp.ga ? ["Go again"] : [], tx: B.heroAbilityLine(rc, hp),
            uid: "hpow"}), "hero:" + rc.name); } } catch(e){}
  }
  const noEmitter = [...disp].filter(x => !cand.has(x)).sort();
  const noRunOps  = [...cand.keys()].filter(x => !disp.has(x)).sort();
  return {records: n, powCards: pow, dispatched: disp.size,
          noEmitter, noRunOps,
          emitters: Object.fromEntries([...cand].filter(([k]) => disp.has(k)))};
}

/* ---- report -------------------------------------------------------- */
const A = deadAnchors();
const O = opCensus();

/* THE THREE OPS WITH A PRODUCER THAT IS NOT THE PARSER. Named rather
   than filtered out of the scan, because a name LEAVING this list is as
   deliberate an edit as one arriving (v4.12, v4.17). */
const NON_PARSER = {
  arcTaken:    "engine/prompts.js — the arcane soak answer records who was dealt it",
  destroyGear: "engine/prompts.js — the spellvoid answer destroys the piece that soaked",
  deckDestroy: "engine/effects.js — the modal cost's mill branch (v3.90, Jittery Bones)",
};
/* THE SIX OPS `runOps` DOES NOT DISPATCH, and the site that does (v3.99
   ran this half by hand once; v4.48 built the last three). */
const ELSEWHERE = {
  pump:        "the attack-trigger pop site (v3.22/v3.65)",
  wpnAgain:    "the attack-trigger pop site — Flurry's second swing",
  payOrLose:   "its own toll site in `execute` (Look Tuff)",
  perEquipDef: "`linkPumps` — settled after the wall is declared (v3.71, v4.48)",
  perBoost:    "`linkPumps` — the chain's boost count (v4.48)",
  perChainHit: "`linkPumps` — `parser.chainHits` (v4.48)",
};

if(process.argv.includes("--json")){
  console.log(JSON.stringify({
    sites: A.sites,
    dead: A.dead.map(d => ({line: d.line, txt: d.txt})),
    records: O.records, powCards: O.powCards, dispatched: O.dispatched,
    noEmitter: O.noEmitter, noRunOps: O.noRunOps,
  }, null, 1));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log("\n=== ANCHORS — parser readings the pool never reaches ===");
console.log(`    ${A.sites} return sites, ${A.dead.length} never reached`
          + ` (${O.records} records, ${O.powCards} powCards driven)\n`);
for(const d of A.dead) console.log("  L" + pad(d.line, 6) + d.txt.slice(0, 104));

console.log("\n=== OP KINDS — `runOps`'s vocabulary against what is emitted ===");
console.log(`    ${O.dispatched} kinds dispatched, `
          + `${O.dispatched - O.noEmitter.length} with a claimant\n`);
console.log("  DISPATCHED, NOTHING A MATCH CAN DEAL EMITS IT:");
for(const k of O.noEmitter)
  console.log("    " + pad(k, 14) + (NON_PARSER[k] || "** no producer anywhere — a LEAD **"));
console.log("\n  EMITTED, NOT IN `runOps` — each must name its own site:");
for(const k of O.noRunOps.filter(k => ELSEWHERE[k]))
  console.log("    " + pad(k, 14) + ELSEWHERE[k]);
const stray = O.noRunOps.filter(k => !ELSEWHERE[k]);
console.log("\n  (" + stray.length + " further strings sit at position 0 of an array that is not an op —"
          + "\n   qualifier class and type words, which is what an op-shaped walk cannot"
          + "\n   tell apart from an op: " + stray.slice(0, 8).join(" ") + (stray.length > 8 ? " …)" : ")"));
console.log("");
