#!/usr/bin/env node
/* ============================================================
   THE SWEEP — the axes the stack never looked at.

   `tools/stack.js` charges every unscripted POOL CARD to a mechanic, and
   as of 2026-07-25 that list is empty: 119 rulings, 0 open. But the stack
   only ever asked about cards in the 15 decks. Three blind spots survive
   it, and this tool is the review station for them:

     1. HERO abilities — 15 heroes, clause by clause. The stack never
        charged a hero, so nothing here was ever asked.
     2. TOKEN abilities — the 17 tokens the pool creates. `stack.js`
        deliberately treats a token as "resolves, never asked about"
        because its text is printed under every card that makes one. That
        is right for the RULING, and useless for the ENGINE: the question
        is whether the trainer carries it, which is measured here.
     3. The BUILD GAP — cards that have a ruling and still do not fully
        resolve. Understood is not the same as built, and that distance is
        invisible in the stack once every card is answered.

   Run:
     npm run sweep            ranked summary + SWEEP.md + tools/sweep.html
     npm run sweep --html     regenerate the review station only

   The station is a single self-contained page: real card art, verbatim
   text, the unread clauses in red, and a box per entry. Answers autosave
   to localStorage and leave only via Export, which downloads a drop-in
   `tools/sweep-notes.json`. It is a SEPARATE file from rulings.json on
   purpose — a note here is an engineering observation, not a rules ruling,
   and nothing this tool does can put the 119 rulings at risk.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const HERE = __dirname;
const ROOT = path.join(HERE, "..");

const A = JSON.parse(fs.readFileSync(path.join(HERE, "audit.json"), "utf8"));
const RULINGS = readJson(path.join(HERE, "rulings.json")) || {};
const NOTES = readJson(path.join(HERE, "sweep-notes.json")) || {};
const TRAINER = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function readJson(p){ try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch(e){ return null; } }
const slug = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ---- art, shared with the stack's resolution so the two agree -------- */
let _pool = null;
function pool(){
  if(_pool) return _pool;
  const CACHE = require("../test/helpers/extract").cardDbPath();
  const imgs = {}, byName = {};
  if(fs.existsSync(CACHE)){
    for(const c of JSON.parse(fs.readFileSync(CACHE, "utf8"))){
      if(!c || !c.name) continue;
      const url = ((c.printings||[]).find(p=>p.image_url)||{}).image_url;
      const p = (c.pitch === null || c.pitch === undefined || c.pitch === "") ? 0 : c.pitch;
      if(url) imgs[slug(c.name)+"|"+p] = url;
      (byName[c.name] = byName[c.name] || []).push(c);
    }
  }
  return (_pool = {imgs, byName});
}
const artFor = (name, pitch) => {
  const {imgs} = pool();
  return imgs[slug(name)+"|"+(pitch||0)] || imgs[slug(name)+"|0"] || null;
};

/* ---- does the trainer mention this by name? -------------------------
   A blunt signal, and deliberately reported as a COUNT rather than a
   verdict. A high count is consistent with dedicated handling (runechant
   and frostbite really do have counters) but it is not proof: "Seismic
   Surge" appears only inside a refusal message. Zero mentions plus unread
   text is the one combination that reliably means "absent". Everything
   else is for a human to judge, which is what the station is for. */
function mentions(name){
  const bare = String(name||"").replace(/[^A-Za-z ]/g, "").trim();
  if(!bare) return 0;
  const tries = [bare];
  /* the trainer calls the Bloodrot Pox token plain "Bloodrot", so a
     full-name-only search reports a live counter as absent. Fall back to
     the first substantial word before believing something is missing. */
  const first = bare.split(/\s+/)[0];
  if(first && first.length >= 5 && first !== bare) tries.push(first);
  let best = 0;
  for(const t of tries){
    const n = (TRAINER.match(new RegExp("\\b" + t.replace(/\s+/g, "\\s*") + "\\b", "gi")) || []).length;
    if(n > best) best = n;
  }
  return best;
}

/* ---- 1. hero abilities ---------------------------------------------- */
function heroEntries(){
  const out = [];
  for(const [key, h] of Object.entries(A.heroes || {})){
    const clauses = h.clauses || [];
    const unread = clauses.filter(c => !c.covered);
    if(!unread.length) continue;
    out.push({
      slug: "hero-" + slug(h.name),
      kind: "hero",
      title: h.name,
      sub: h.tt || "Hero",
      art: artFor(h.name, 0),
      tx: h.tx || "",
      clauses: clauses.map(c => ({t: c.t, covered: !!c.covered})),
      unread: unread.length,
      total: clauses.length,
      hits: mentions(h.name),
      ask: "Which of these lines does the engine actually need to enforce, and what should each do?"
    });
  }
  return out.sort((a,b) => b.unread - a.unread || a.title.localeCompare(b.title));
}

/* ---- 2. tokens ------------------------------------------------------- */
function tokenEntries(){
  const out = [];
  for(const [name, t] of Object.entries(A.tokens || {})){
    const hits = mentions(name);
    const fx = t.found ? (t.fx || "none") : "missing";
    /* A token whose text the parser reads in FULL needs no name mention —
       the generic token machinery carries it, and special-casing one by
       name would break the golden rule. Only unread text is a problem. */
    if(fx === "full") continue;
    out.push({
      slug: "token-" + slug(name),
      kind: "token",
      title: name,
      sub: t.tt || "Token",
      art: artFor(name, 0),
      tx: t.tx || "",
      fx, hits,
      /* NAMED is a fact (the string appears); it is NOT proof of handling.
         Seismic Surge is named exactly once — in a refusal message — so
         asserting "dedicated counter by design" from a grep count would be
         inventing intent. Report the count, let the reviewer judge. */
      named: hits >= 5,
      ask: hits >= 5
        ? "The trainer names this " + hits + " times. Is it genuinely carried (a dedicated counter, as runechant/frostbite are), or do those mentions only form refusal messages? If carried, is that still the right model?"
        : "The parser cannot read this and the trainer barely names it. What should the engine do when this is created?"
    });
  }
  return out.sort((a,b) => (a.named === b.named ? 0 : a.named ? 1 : -1)
    || a.title.localeCompare(b.title));
}

/* ---- 3. ruled but not built ----------------------------------------- */
/* Every pool card carries a ruling now, so "open" is the wrong question.
   The useful one is: which ruled cards still do not fully resolve? */
/* A clause's status is "run" (handled), "noop" (parsed, deliberately does
   nothing) or "skip" (genuinely unread). Only "skip" is a gap.

   This used to test `st !== "ok"` — and no clause is EVER "ok", so every
   clause counted as unread and a card could be reported as "part, 6/6
   unread", which is self-contradictory: `part` means some clauses run.
   The counts in section 3 were inflated for as long as the tool existed. */
const isUnread = x => x.st === "skip";

function buildGap(){
  const out = [];
  for(const [key, c] of Object.entries(A.cards || {})){
    if(c.tier === "full") continue;
    const unread = (c.clauses || []).filter(isUnread);
    out.push({
      slug: "card-" + slug(c.name) + "-" + (c.pitch||0),
      kind: "build",
      title: c.name,
      sub: (c.tt || "") + " · pitch " + (c.pitch||0),
      art: artFor(c.name, c.pitch),
      tx: (c.clauses||[]).map(x => x.t).join(" "),
      tier: c.tier,
      approx: !!c.approx,
      clauses: (c.clauses||[]).map(x => ({t: x.t, covered: !isUnread(x), st: x.st})),
      unread: unread.length,
      total: (c.clauses||[]).length,
      ask: "The ruling exists — what is still missing in the engine for this to resolve in full?"
    });
  }
  return out.sort((a,b) => (a.tier === b.tier ? b.unread - a.unread
    : a.tier === "none" ? -1 : 1) || a.title.localeCompare(b.title));
}

/* ---- 4. fail states -------------------------------------------------
   The other three sections measure COVERAGE — how much text is unread.
   This one asks the judge's question: how does this card go wrong at the
   table? Ranked by damage to a game judged at pro-tour standards, which
   is a different order from "most unread text". See tools/failstates.js
   for the categories and the honesty rule. */
const FS = require("./failstates.js");

function failEntries(){
  /* `mentions` is the trainer cross-check: a keyword the parser files as a
     noop may still be enforced by name (phantasm is), so failstates.js must
     not call it ignored on parser status alone. */
  const cards = FS.failStates(A, RULINGS, mentions);
  const heroes = FS.heroFailStates(A, RULINGS, mentions);
  return [...cards, ...heroes].map(e => Object.assign({}, e, {
    art: e.isHero ? artFor(e.title, 0) : artFor(e.title, e.pitch),
    ask: e.sev >= 3
      ? "This lets a player do something the rules forbid, or skips a drawback they were priced for. What should the engine do instead?"
      : e.sev === 2
        ? "This produces a wrong number or fires at the wrong time. What is the correct behaviour?"
        : "The player is denied something they earned. Worth building, or leave it?"
  })).sort((a, b) => b.sev - a.sev ||
    (a.ruled === b.ruled ? 0 : a.ruled ? -1 : 1) ||
    a.title.localeCompare(b.title));
}

/* ---- report ---------------------------------------------------------- */
function build(){
  const heroes = heroEntries(), tokens = tokenEntries(), gap = buildGap();
  const fails = failEntries();
  const answered = k => NOTES[k] && String(NOTES[k]).trim().length;
  const openOf = list => list.filter(e => !answered(e.slug));
  return {heroes, tokens, gap, fails,
    open: {heroes: openOf(heroes).length, tokens: openOf(tokens).length,
      gap: openOf(gap).length, fails: openOf(fails).length}};
}

function report(s){
  const B = t => "\x1b[1m" + t + "\x1b[0m";
  const heroClauses = s.heroes.reduce((a,h) => a + h.unread, 0);
  console.log("\n" + B("THE SWEEP") + " — the axes the stack never looked at");
  console.log("Pool: " + A.poolUnique + " cards · " + A.tiers.full + " full / "
    + A.tiers.part + " part / " + A.tiers.none + " none · rulings " + Object.keys(RULINGS).length);
  console.log("\n" + B("  1. HERO ABILITIES") + "  " + s.heroes.length + " heroes · "
    + heroClauses + " unread clauses");
  for(const h of s.heroes.slice(0, 20))
    console.log("     " + h.title.padEnd(28) + h.unread + "/" + h.total + " unread"
      + (answered(h.slug) ? "  ✓noted" : ""));
  const dead = s.tokens.filter(t => !t.named), ded = s.tokens.filter(t => t.named);
  console.log("\n" + B("  2. TOKENS") + "  " + s.tokens.length + " need a look");
  if(dead.length) console.log("     " + B("unread text, and barely named — likely real gaps:"));
  for(const t of dead) console.log("     " + t.title.padEnd(24) + "fx " + t.fx
    + " · " + t.hits + " mentions" + (answered(t.slug) ? "  ✓noted" : ""));
  if(ded.length) console.log("     unread text but NAMED in the trainer (verify each): "
    + ded.map(t => t.title + "(" + t.hits + ")").join(", "));
  console.log("\n" + B("  3. RULED BUT NOT BUILT") + "  " + s.gap.length + " cards still short of full");
  const none = s.gap.filter(c => c.tier === "none");
  console.log("     " + none.length + " read nothing at all · "
    + (s.gap.length - none.length) + " partial");

  console.log("\n" + B("  4. FAIL STATES") + "  " + s.fails.length + " entries — how cards go WRONG at the table");
  for(const sev of [3, 2, 1, 0]){
    const list = s.fails.filter(f => f.sev === sev);
    if(!list.length) continue;
    console.log("     " + B(FS.SEV_NAME[sev].padEnd(11)) + list.length +
      (sev === 3 ? "  <- a rule is broken every time these are played" : ""));
    if(sev === 3) for(const f of list)
      console.log("       · " + f.title.padEnd(26) + f.cats.filter(c => c.sev === 3).map(c => c.label).join("; ").slice(0, 60));
  }
  const cat = {};
  for(const f of s.fails) for(const x of f.cats) cat[x.label] = (cat[x.label] || 0) + 1;
  console.log("     " + B("by category:"));
  for(const [k, v] of Object.entries(cat).sort((a, b) => b[1] - a[1]))
    console.log("       " + String(v).padStart(4) + "  " + k);

  console.log("\nStation:  open tools/sweep.html");
  function answered(k){ return NOTES[k] && String(NOTES[k]).trim().length; }
}

/* ---- SWEEP.md -------------------------------------------------------- */
function writeMd(s){
  const L = [];
  L.push("# The Sweep");
  L.push("");
  L.push("Generated " + new Date().toISOString().slice(0,10) + " from `tools/audit.json`.");
  L.push("The card stack is empty — every pool card has a ruling. These are the");
  L.push("axes it never covered.");
  L.push("");
  L.push("| area | entries | note |");
  L.push("|---|---|---|");
  L.push("| Hero abilities | " + s.heroes.length + " heroes, "
    + s.heroes.reduce((a,h)=>a+h.unread,0) + " unread clauses | never charged by the stack |");
  L.push("| Tokens | " + s.tokens.length + " | "
    + s.tokens.filter(t=>!t.named).length + " barely named in the trainer |");
  L.push("| Ruled but not built | " + s.gap.length + " cards | understood ≠ built |");
  L.push("| **Fail states** | " + s.fails.length + " entries, "
    + s.fails.filter(f => f.sev === 3).length + " break a rule | how cards go *wrong* at the table |");
  L.push("");
  L.push("## 1. Hero abilities");
  L.push("");
  for(const h of s.heroes){
    L.push("### " + h.title + " — " + h.unread + "/" + h.total + " unread");
    for(const c of h.clauses) L.push("- " + (c.covered ? "✅" : "❌") + " " + c.t);
    L.push("");
  }
  L.push("## 2. Tokens");
  L.push("");
  for(const t of s.tokens){
    L.push("### " + t.title + " — fx `" + t.fx + "`, " + t.hits + " mentions in the trainer"
      + (t.named ? " (named in the trainer — verify it is carried, not just a refusal string)" : " — **likely a real gap**"));
    if(t.tx) L.push("> " + t.tx);
    L.push("");
  }
  L.push("## 3. Ruled but not built");
  L.push("");
  L.push("Cards whose ruling exists but which still do not resolve in full.");
  L.push("");
  for(const c of s.gap.slice(0, 60))
    L.push("- **" + c.title + "** (" + c.tier + ", " + c.unread + "/" + c.total + " unread)"
      + (c.approx ? " · flagged approx" : ""));
  if(s.gap.length > 60) L.push("- … and " + (s.gap.length - 60) + " more (see the station)");

  /* ---- 4. fail states ---- */
  L.push("");
  L.push("## 4. Fail states — how cards go WRONG at the table");
  L.push("");
  L.push("Sections 1–3 measure *coverage* (how much text is unread). This one asks");
  L.push("the judge's question: if this card is played tonight, what happens that");
  L.push("should not? Ranked by damage to a game judged at pro-tour standards —");
  L.push("a different order from \"most unread text\".");
  L.push("");
  L.push("**Every verdict here is inferred from clause text by pattern, not from");
  L.push("playing the card.** Each entry names the clause that triggered it so it");
  L.push("can be overruled. Same discipline as the mention count.");
  L.push("");
  const catCount = {};
  for(const f of s.fails) for(const x of f.cats) catCount[x.label] = (catCount[x.label] || 0) + 1;
  L.push("| category | entries |");
  L.push("|---|---|");
  for(const [k, v] of Object.entries(catCount).sort((a, b) => b[1] - a[1]))
    L.push("| " + k + " | " + v + " |");
  L.push("");
  for(const sev of [3, 2, 1, 0]){
    const list = s.fails.filter(f => f.sev === sev);
    if(!list.length) continue;
    L.push("### " + FS.SEV_NAME[sev] + " — " + list.length + " entries");
    L.push("");
    if(sev === 3){
      L.push("**A rule is broken every time one of these is played.** This is the");
      L.push("worst thing a trainer can do: it teaches wrong play.");
      L.push("");
    }
    for(const f of list.slice(0, sev === 3 ? 99 : 25)){
      L.push("- **" + f.title + "**" + (f.pitch ? " (" + f.pitch + ")" : "") +
        " · tier `" + f.tier + "`" + (f.heroes && f.heroes.length ? " · " + f.heroes.join(", ") : ""));
      for(const x of f.cats){
        L.push("  - *" + x.label + "* — " + x.table);
        if(x.clause) L.push("    > " + x.clause);
      }
    }
    if(list.length > 25 && sev !== 3) L.push("- … and " + (list.length - 25) + " more (see the station)");
    L.push("");
  }

  fs.writeFileSync(path.join(ROOT, "SWEEP.md"), L.join("\n") + "\n");
  console.log("Wrote SWEEP.md");
}

/* ---- the review station ---------------------------------------------- */
function writeHtml(s){
  /* Fail states come FIRST: a card that breaks a rule every time it is
     played outranks a card that is merely incomplete. */
  const data = [...s.fails, ...s.heroes, ...s.tokens, ...s.gap];
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dawnblade — The Sweep</title>
<style>
:root{--r:#C4302B;--y:#E8B33C;--ok:#7BA05B;--ink:#14100E;--forge:#241B16;--forge2:#2E241D;
  --bone:#E8DFD0;--dim:#B8AC98;--line:#4A3B2E}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--bone);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:9;background:var(--ink);border-bottom:1px solid var(--line);
  padding:9px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.brand{font-weight:800;letter-spacing:.02em}.brand em{color:var(--y);font-style:normal}
.count{font:12px ui-monospace,monospace;color:var(--dim);border:1px solid var(--line);border-radius:99px;padding:2px 10px}
select{background:var(--forge2);color:var(--bone);border:1px solid var(--line);border-radius:4px;padding:6px 8px;max-width:44vw}
button{font:inherit;cursor:pointer;border-radius:4px}
.exp{margin-left:auto;background:var(--y);color:var(--ink);border:none;font-weight:700;padding:7px 14px;letter-spacing:.04em}
.bar{padding:5px 14px;font:11px ui-monospace,monospace;color:var(--dim);border-bottom:1px solid var(--line);
  display:flex;gap:12px;flex-wrap:wrap}
.bar b{color:var(--y);font-weight:600}
main{padding:16px 14px 120px;max-width:960px;margin:0 auto}
.tag{display:inline-block;font:10px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;
  border:1px solid var(--line);border-radius:99px;padding:2px 9px;margin-right:6px;color:var(--dim)}
.tag.hero{border-color:var(--y);color:var(--y)}
.tag.token{border-color:#6aa6d8;color:#6aa6d8}
.tag.build{border-color:var(--r);color:#f0a9a5}
.tag.fail{border-color:#d8562f;color:#ff9d76}
.tag.ded{border-color:var(--ok);color:var(--ok)}
.tag.ruled{border-color:var(--ok);color:var(--ok)}
/* fail-state severity banner */
.sev{border-radius:6px;padding:10px 13px;margin:10px 0 4px;font-size:13.5px;border:1px solid}
.sev b{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px}
.sev.s3{background:#33120e;border-color:#d8562f;color:#ffcdb8}
.sev.s2{background:#332612;border-color:var(--y);color:#f4e2bd}
.sev.s1{background:#1d2716;border-color:var(--ok);color:#d7e7c8}
.sev.s0{background:var(--forge);border-color:var(--line);color:var(--dim)}
ul.fx{list-style:none;padding:0;margin:10px 0}
ul.fx li{padding:9px 11px;background:var(--forge);border-left:3px solid var(--line);margin-bottom:6px;font-size:13.5px}
ul.fx li.s3{border-left-color:#d8562f}
ul.fx li.s2{border-left-color:var(--y)}
ul.fx li.s1{border-left-color:var(--ok)}
ul.fx li em{display:block;color:var(--y);font-style:normal;font-weight:600;font-size:12px;
  letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
ul.fx li q{display:block;margin-top:6px;color:var(--dim);font-size:12.5px;font-family:ui-monospace,monospace}
.caveat{margin:10px 0;padding:8px 11px;border:1px dashed var(--line);border-radius:6px;
  color:var(--dim);font-size:12px}
h1{font-size:27px;margin:12px 0 4px;letter-spacing:.01em}
.sub{color:var(--dim);font-size:13px;margin:0 0 14px}
.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.art{width:230px;max-width:60vw;border-radius:8px;border:1px solid var(--line);background:var(--forge)}
.body{flex:1;min-width:260px}
.txt{background:var(--forge);border:1px solid var(--line);border-radius:6px;padding:11px 13px;white-space:pre-wrap;font-size:14px}
ul.cl{list-style:none;padding:0;margin:12px 0}
ul.cl li{padding:7px 10px;border-left:3px solid var(--ok);background:var(--forge);margin-bottom:5px;font-size:13.5px}
ul.cl li.bad{border-left-color:var(--r);background:#2a1614}
.ask{margin:14px 0 6px;color:var(--y);font-size:13.5px}
textarea{width:100%;min-height:120px;background:var(--forge);color:var(--bone);border:1px solid var(--line);
  border-radius:6px;padding:11px;font:14px/1.5 inherit;resize:vertical}
.nav{position:fixed;left:0;right:0;bottom:0;background:var(--forge2);border-top:1px solid var(--line);
  padding:9px 14px;display:flex;gap:9px;align-items:center}
.nav button{flex:1;padding:12px;background:var(--forge);border:1px solid var(--line);color:var(--bone);font-weight:600}
.nav button.go{background:var(--y);color:var(--ink);border-color:var(--y)}
.done{color:var(--ok);font:12px ui-monospace,monospace}
</style></head><body>
<header>
  <span class="brand">DAWN<em>BLADE</em></span>
  <span class="count" id="cnt"></span>
  <select id="filt" title="which entries to work through">
    <option value="all">everything</option>
    <option value="fail">fail states only</option>
    <option value="s3">⚠ breaks a rule (worst first)</option>
    <option value="hero">hero abilities</option>
    <option value="token">tokens</option>
    <option value="build">build gap</option>
    <option value="todo">not yet noted</option>
  </select>
  <select id="jump"></select>
  <button class="exp" onclick="expo()">Export JSON</button>
</header>
<div class="bar">
  <span>pool <b>${A.poolUnique}</b></span>
  <span><b>${A.tiers.full}</b> full · <b>${A.tiers.part}</b> part · <b>${A.tiers.none}</b> none</span>
  <span>rulings <b>${Object.keys(RULINGS).length}</b></span>
  <span>heroes <b>${s.heroes.length}</b></span>
  <span>tokens <b>${s.tokens.length}</b></span>
  <span>build gap <b>${s.gap.length}</b></span>
  <span>fail states <b>${s.fails.length}</b> (<b>${s.fails.filter(f=>f.sev===3).length}</b> break a rule)</span>
</div>
<main id="main"></main>
<div class="nav">
  <button onclick="go(-1)">← Prev</button>
  <span class="done" id="dn"></span>
  <button onclick="go(1)">Skip →</button>
  <button class="go" onclick="save(1)">Save &amp; Next →</button>
</div>
<script>
const ALL = ${JSON.stringify(data)};
const PRIOR = ${JSON.stringify(NOTES)};
const SEV_NAME = ${JSON.stringify(FS.SEV_NAME)};
const KEY = "dawnblade-sweep-v1";
let notes = Object.assign({}, PRIOR, JSON.parse(localStorage.getItem(KEY) || "{}"));
let DATA = ALL.slice();
let i = 0;
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const noted = x => (notes[x.slug]||"").trim().length > 0;

/* The severity banner: what actually goes wrong if this ships. */
const SEV_BLURB = {
  3: "A rule is broken every time this is played. The player wins games they should lose — the worst thing a trainer can do, because it teaches wrong play.",
  2: "The number on screen is wrong, or the effect fires at the wrong time. Insidious: the player trusts the total.",
  1: "The player is denied something they earned. Honest and visible — they can see the card did nothing.",
  0: "The card does nothing, and looks like it does nothing."
};

function applyFilter(){
  const f = document.getElementById("filt").value;
  DATA = ALL.filter(e =>
    f === "all"  ? true :
    f === "fail" ? e.kind === "fail" :
    f === "s3"   ? e.sev === 3 :
    f === "todo" ? !noted(e) :
    e.kind === f);
  if(!DATA.length) DATA = ALL.slice();
  i = 0;
}

function render(){
  const e = DATA[i];
  if(!e){ document.getElementById("main").innerHTML = "<h1>Nothing to sweep.</h1>"; return; }
  const dedTag = e.kind === "token" && e.named ? '<span class="tag ded">named in trainer — verify</span>' : "";
  const ruledTag = e.ruled ? '<span class="tag ruled">ruling exists — ready to build</span>' : "";
  const cl = (e.clauses||[]).map(c =>
    '<li class="' + (c.covered ? "" : "bad") + '">' + (c.covered ? "✅ " : "❌ ") + esc(c.t) +
    (c.st === "noop" ? ' <span style="color:#B8AC98">(parser: no-op)</span>' : "") + "</li>").join("");
  /* fail-state specific: the severity banner and the categories, each with
     the clause that triggered it so a wrong call can be overruled */
  const sevBlock = e.kind === "fail"
    ? '<div class="sev s' + e.sev + '"><b>' + esc(SEV_NAME[e.sev]) + '</b>' + esc(SEV_BLURB[e.sev]) + "</div>"
    : "";
  const fxBlock = (e.cats && e.cats.length)
    ? '<ul class="fx">' + e.cats.map(c =>
        '<li class="s' + c.sev + '"><em>' + esc(c.label) + "</em>" + esc(c.table) +
        (c.clause ? "<q>" + esc(c.clause) + "</q>" : "") + "</li>").join("") + "</ul>"
    : "";
  const caveat = e.kind === "fail"
    ? '<div class="caveat">Inferred from clause text by pattern, not from playing the card. ' +
      'The quoted clause is what triggered each verdict — overrule it if the pattern misread it.</div>'
    : "";
  document.getElementById("main").innerHTML =
    '<span class="tag ' + e.kind + '">' + e.kind + "</span>" + dedTag + ruledTag +
    (e.tier ? '<span class="tag">tier ' + esc(e.tier) + "</span>" : "") +
    (e.fx ? '<span class="tag">fx ' + esc(e.fx) + "</span>" : "") +
    (e.hits != null ? '<span class="tag">' + e.hits + " mentions</span>" : "") +
    (e.heroes && e.heroes.length ? '<span class="tag">' + esc(e.heroes.join(" · ")) + "</span>" : "") +
    "<h1>" + esc(e.title) + "</h1><p class='sub'>" + esc(e.sub||"") + "</p>" +
    sevBlock +
    '<div class="row">' +
      (e.art ? '<img class="art" src="' + esc(e.art) + '" alt="">' : "") +
      '<div class="body">' +
        (e.tx ? '<div class="txt">' + esc(e.tx) + "</div>" : "") +
        fxBlock + caveat +
        (cl ? '<ul class="cl">' + cl + "</ul>" : "") +
        '<p class="ask">' + esc(e.ask||"") + "</p>" +
        '<textarea id="ta" placeholder="What should the engine do?">' + esc(notes[e.slug]||"") + "</textarea>" +
      "</div>" +
    "</div>";
  document.getElementById("cnt").textContent = (i+1) + " / " + DATA.length;
  document.getElementById("dn").textContent = ALL.filter(noted).length + " noted";
  const j = document.getElementById("jump");
  j.innerHTML = DATA.map((x,n) => '<option value="' + n + '"' + (n===i?" selected":"") + ">" +
    (n+1) + ". " + (x.sev === 3 ? "⚠ " : "") + esc(x.title) + (noted(x) ? " ✓" : "") + "</option>").join("");
}
function stash(){ const ta = document.getElementById("ta"); if(!ta || !DATA[i]) return;
  const v = ta.value.trim();
  if(v) notes[DATA[i].slug] = v; else delete notes[DATA[i].slug];
  localStorage.setItem(KEY, JSON.stringify(notes)); }
function go(d){ stash(); i = Math.max(0, Math.min(DATA.length-1, i+d)); render(); window.scrollTo(0,0); }
function save(d){ go(d); }
function expo(){
  stash();
  /* start from the WHOLE prior file, never from the open list — that is how
     the rulings export lost 37 answers once. Merge, never replace. */
  const out = Object.assign({}, PRIOR, notes);
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "sweep-notes.json"; a.click();
}
document.getElementById("jump").addEventListener("change", ev => { stash(); i = +ev.target.value; render(); window.scrollTo(0,0); });
document.getElementById("filt").addEventListener("change", () => { stash(); applyFilter(); render(); window.scrollTo(0,0); });
document.addEventListener("keydown", ev => { if(ev.key === "Enter" && (ev.metaKey||ev.ctrlKey)) save(1); });
render();
</script></body></html>`;
  fs.writeFileSync(path.join(HERE, "sweep.html"), html);
  console.log("Wrote tools/sweep.html — " + data.length + " entries");
}

const s = build();
if(!process.argv.includes("--html")){ report(s); writeMd(s); }
writeHtml(s);
