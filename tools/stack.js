#!/usr/bin/env node
/* ============================================================
   THE STACK — the cards Dawnblade can't script without a ruling.

   The pool audit says WHAT is unscripted. The stack says WHY, and
   groups it into the smallest number of questions a human has to
   answer. Almost every gap traces back to a mechanic, not a card:
   teach "watery grave" once and six cards come online together.

   Nothing here guesses. A mechanic sits in the stack precisely
   because neither the card text nor the database defines it, and
   the golden rule forbids inventing card effects.

   Usage:
     node tools/stack.js                 # the ranked stack
     node tools/stack.js <slug>          # full dossier for one entry
     node tools/stack.js explain <slug> "<the ruling>"
     node tools/stack.js done            # what's been answered
     node tools/stack.js --md            # (re)write STACK.md
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { KEYWORDS } = require("./ledger");

const HERE = __dirname, ROOT = path.join(HERE, "..");
const AUDIT = path.join(HERE, "audit.json");
const RULINGS = path.join(HERE, "rulings.json");

if(!fs.existsSync(AUDIT)){
  console.error("No tools/audit.json — run `npm run audit` first.");
  process.exit(1);
}
const A = JSON.parse(fs.readFileSync(AUDIT, "utf8"));
const rulings = fs.existsSync(RULINGS) ? JSON.parse(fs.readFileSync(RULINGS,"utf8")) : {};
/* Follow-ups: entries that HAVE a ruling but where building from it hit a
   specific wall. They come back into the stack flagged "needs detail", with
   the narrow question replacing the generic prompt. */
const FOLLOWUPS = path.join(HERE, "followups.json");
const followups = fs.existsSync(FOLLOWUPS) ? JSON.parse(fs.readFileSync(FOLLOWUPS,"utf8")) : {};
delete followups._README;

/* statuses that mean "the trainer already does the right thing" */
const SETTLED = new Set(["live", "info", "inert-dummy", "approx", "partial"]);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const kwBase = k => {
  k = String(k).toLowerCase().trim();
  if(/ specialization$/.test(k)) return "specialization";
  const m = k.match(/^([a-z][a-z ]*?) (?:\d+|x)$/);
  return m ? m[1] : k;
};
const heroName = k => {
  const h = A.heroes[k];
  return h && h.name ? h.name.split(",")[0] : k;
};

/* ---- concept probes -------------------------------------------------
   A card with no unsettled keyword can still be blocked on a mechanic the
   trainer has no model for — steam counters, the soul, the crowd. These
   probes read the UNPARSED text only, and exist purely to collapse a long
   tail of cards into a short list of questions. They assert nothing about
   how a mechanic works; that is exactly what the ruling is for. Specific
   probes first — the broad ones would otherwise swallow everything. */
const CONCEPTS = [
  [/\bsteam counter/i,              "steam-counters",  "Mechanologist steam counters — Dash's Hyper Driver engine"],
  [/\baim counter/i,                "aim-counters",    "Azalea's aim counters on arrows"],
  [/\bverse counter/i,              "verse-counters",  "verse counters — enters-the-arena-with-N auras"],
  [/\brust counter/i,               "rust-counters",   "rust counters on weapons"],
  [/\+\s*1\s*\{p\} counter/i,       "power-counters",  "+1{p} counters on weapons and auras"],
  [/hero'?s soul|\bcharged?\b/i,    "soul-charge",     "Boltyn's soul — charging cards into it and spending them"],
  [/\bclash\b|the winner creates/i, "clash-payoffs",   "clash outcomes — the dummy only pantomimes its reveal"],
  [/booed|crowd (?:boos|cheers)|revered|reviled/i, "crowd", "Bravo's Revered / Reviled crowd states"],
  [/draconic chain link/i,          "draconic-chain",  "counting Draconic chain links"],
  [/\bfused\b|fusion/i,             "fusion",          "fusion — the elemental reveal/pitch cost"],
  [/\bboost\b/i,                    "boost-riders",    "riders hanging off the boost keyword"],
  [/\baction points?\b/i,           "action-points",   "gaining and spending extra action points"],
  /* Tokens are cards: every one the pool references is in the database with
     its own rules text, shown inline under each card. So the open question
     is not what they do — it is how the engine should carry them. */
  [/create (?:a|an|\d+|x) [\w' ]*token/i, "token-library",
   "every token below is already defined in the card database — what's open is how the ENGINE carries them",
   "The token's own text is printed under each card, so no rules lookup is needed. What's open is the engine model: where does a token live, when does it tick, and when is it destroyed? Note the trainer already keeps three ad-hoc counters — n.rune (Runechant), n.rot (Bloodrot) and n.fra (Frailty) — so say whether a general token zone should absorb those."],
  [/\bdie\b|\brolled\b|6-sided/i,   "dice",            "die rolls (Kayo's Specialization)"],
  [/opt \d|look at the top|top \d+ cards/i, "deck-peek", "looking at and reordering the top of the deck"],
  [/\bpitch zone\b/i,               "pitch-zone",      "reading cards in the pitch zone"],
  [/\baura\b/i,                     "auras",           "counting, creating and destroying auras"],
  [/\barsenal\b/i,                  "arsenal-triggers","effects conditional on the arsenal"],
  [/\bgraveyard\b/i,                "graveyard",       "graveyard recursion and banishing from it"],
];
const conceptFor = txt => CONCEPTS.find(([re]) => re.test(txt));

/* ---- build the stack ------------------------------------------------
   Every card that isn't fully scripted is charged to a blocker: first an
   unsettled keyword it carries, else a concept probe over its unread
   text, else its own name. One answer clears everything charged to it. */
function build(){
  const entries = {};   // slug -> entry
  const add = (key, kind, title, note, ask) => entries[key] = entries[key] ||
    {slug:key, kind, title, note, ask:ask||null, cards:[], heroes:new Set()};

  for(const [ck, card] of Object.entries(A.cards)){
    if(card.tier === "full" && !card.flags.length) continue;
    const gaps = card.clauses.filter(c => c.st === "skip").map(c => c.t);
    if(!gaps.length && card.tier === "full") continue;

    const kws = [...(card.kw||[]), ...(card.gkw||[])].map(kwBase)
      .filter(k => !SETTLED.has((KEYWORDS[k]||{}).status));
    const users = (A.usage[ck]||[]).map(u => u.hero);

    if(kws.length){
      /* charge the card to each unsettled keyword it carries — a card can
         legitimately be blocked on two mechanics at once */
      for(const k of kws){
        const st = (KEYWORDS[k]||{}).status || "UNDOCUMENTED";
        const e = add(slug(k), "mechanic", k,
          (KEYWORDS[k]||{}).note || "not in the ledger at all");
        e.status = st;
        e.cards.push({...card, gaps, key:ck});
        users.forEach(h => e.heroes.add(h));
      }
    } else if(gaps.length){
      const con = conceptFor(gaps.join(" "));
      const e = con
        ? add(con[1], "concept", con[1].replace(/-/g," "), con[2], con[3])
        /* same name at a different pitch is a different card — keep the
           pitch in the title or three "Jump Start"s look like duplicates */
        : add("card-"+slug(card.name+"-"+card.pitch), "card",
              card.name + " · pitch " + card.pitch,
              "no keyword or known mechanic to blame — this card's own text needs a reading");
      e.status = con ? "unmodelled" : "one-off";
      e.cards.push({...card, gaps, key:ck});
      users.forEach(h => e.heroes.add(h));
    }
  }

  return Object.values(entries).map(e => ({
    ...e,
    heroes: [...e.heroes],
    answered: !!rulings[e.slug] && !followups[e.slug],
    followup: followups[e.slug] || null,
    priorRuling: rulings[e.slug] ? rulings[e.slug].ruling : null,
    /* leverage: cards unlocked, then breadth across the 15 decks */
    score: e.cards.length * 100 + [...e.heroes].length
  })).sort((a,b) => (a.answered - b.answered) || (b.score - a.score));
}

/* ---- renderers ----------------------------------------------------- */
function list(stack){
  const open = stack.filter(e => !e.answered);
  const mech = open.filter(e => e.kind === "mechanic" || e.kind === "concept");
  const one  = open.filter(e => e.kind === "card");
  const fups = open.filter(e=>e.followup);
  console.log("\n\x1b[1mTHE STACK\x1b[0m — " + open.length + " open · " +
    stack.filter(e=>e.answered).length + " answered" +
    (fups.length ? " · \x1b[31m" + fups.length + " need one more detail\x1b[0m" : ""));
  if(fups.length) console.log("  needs detail: " + fups.map(e=>e.slug).join(", "));
  console.log("Pool: " + A.poolUnique + " unique cards · " +
    A.tiers.full + " full / " + A.tiers.part + " part / " + A.tiers.none + " none\n");

  console.log("\x1b[1m  MECHANICS — one ruling each, unlocks every card listed\x1b[0m");
  console.log("  " + "SLUG".padEnd(20) + "STATUS".padEnd(14) + "CARDS  DECKS");
  for(const e of mech)
    console.log("  " + e.slug.padEnd(20) + String(e.status).padEnd(14) +
      String(e.cards.length).padStart(5) + String(e.heroes.length).padStart(7));

  console.log("\n\x1b[1m  ONE-OFF CARDS — " + one.length + " cards, own text needs a reading\x1b[0m");
  const names = one.map(e => e.cards[0].name);
  console.log("  " + names.join(" · ").replace(/(.{74}) /g, "$1\n  "));
  console.log("\nDossier:  node tools/stack.js <slug>");
  console.log("Answer :  node tools/stack.js explain <slug> \"...\"\n");
}

function dossier(e){
  console.log("\n\x1b[1m" + e.title.toUpperCase() + "\x1b[0m  (" + e.slug + ")");
  console.log("ledger status : " + e.status);
  console.log("ledger note   : " + e.note);
  console.log("blocks        : " + e.cards.length + " card(s) across " +
    e.heroes.length + " deck(s) — " + e.heroes.map(heroName).join(", "));
  if(rulings[e.slug]){
    console.log("\n\x1b[32mANSWERED " + rulings[e.slug].at + "\x1b[0m");
    console.log(rulings[e.slug].ruling);
  }
  console.log("\n\x1b[1mCards waiting on it\x1b[0m");
  for(const c of e.cards){
    console.log("\n  \x1b[1m" + c.name + "\x1b[0m (pitch " + c.pitch + ") — " + c.tt +
      " · tier " + c.tier);
    if(c.kw.length)  console.log("    printed: " + c.kw.join(", "));
    if(c.gkw.length) console.log("    granted: " + c.gkw.join(", "));
    console.log("    text: " + (c.tx || "(none)").replace(/\n+/g, "  ⏎  "));
    for(const g of c.gaps) console.log("    \x1b[31m— unread:\x1b[0m " + g);
    /* a token is a card — print what it actually says instead of asking */
    for(const t of tokenRefsIn(c.tx)){
      const tk = pool().TOKENS[t]; if(!tk) continue;
      console.log("    \x1b[32m↳ " + tk.name + "\x1b[0m (" + tk.tt + "): " +
        tk.tx.replace(/\n+/g, " / "));
    }
  }
  console.log("\nAnswer: node tools/stack.js explain " + e.slug + " \"...\"\n");
}

/* ---- STACK.md — the readable-on-a-phone version -------------------- */
function writeMd(stack){
  const L = [];
  const open = stack.filter(e => !e.answered);
  L.push("# THE STACK — rulings Dawnblade is waiting on");
  L.push("");
  L.push("Generated " + new Date().toISOString() + " from `tools/audit.json`.");
  L.push("");
  L.push("Every gap below is charged to the *mechanic* that causes it, so one");
  L.push("answer lights up every card in its list. Nothing here is guessed:");
  L.push("these sit in the stack because neither the card text nor the card");
  L.push("database defines them, and the golden rule forbids inventing effects.");
  L.push("");
  L.push("Answer one with:");
  L.push("");
  L.push("```bash");
  L.push("node tools/stack.js explain <slug> \"your ruling\"");
  L.push("```");
  L.push("");
  L.push("| # | mechanic | status | cards | decks |");
  L.push("|---|---|---|---|---|");
  open.filter(e=>e.kind==="mechanic"||e.kind==="concept").forEach((e,i) =>
    L.push(`| ${i+1} | \`${e.slug}\` | ${e.status} | ${e.cards.length} | ${e.heroes.length} |`));
  L.push("");
  for(const e of open.filter(e=>e.kind==="mechanic"||e.kind==="concept")){
    L.push("## " + e.title + "  `" + e.slug + "`");
    L.push("");
    L.push("*" + e.status + "* — " + e.note);
    L.push("");
    L.push("Decks affected: " + e.heroes.map(heroName).join(", "));
    L.push("");
    for(const c of e.cards){
      L.push("- **" + c.name + "** (pitch " + c.pitch + ", " + c.tt + ")  ");
      L.push("  " + (c.tx||"(no text)").replace(/\n+/g, "  \n  "));
      for(const g of c.gaps) L.push("  - ⛔ unread: " + g);
      for(const t of tokenRefsIn(c.tx)){
        const tk = pool().TOKENS[t]; if(!tk) continue;
        L.push("  - ↳ **" + tk.name + "** (" + tk.tt + ") — " + tk.tx.replace(/\n+/g, " / "));
      }
    }
    L.push("");
  }
  const one = open.filter(e=>e.kind==="card");
  L.push("## One-off cards — " + one.length + " cards whose own text needs a reading");
  L.push("");
  for(const e of one){
    const c = e.cards[0];
    L.push("- **" + c.name + "** (pitch " + c.pitch + ", " + c.tt + ") — " +
      e.heroes.map(heroName).join(", "));
    for(const g of c.gaps) L.push("  - ⛔ " + g);
  }
  L.push("");
  fs.writeFileSync(path.join(ROOT, "STACK.md"), L.join("\n"));
  console.log("Wrote STACK.md — " + open.length + " open entries.");
}

/* ---- review.html — the card-by-card review station ------------------
   A self-contained page: the stack data is inlined, so it opens with a
   double-click and works offline. Card art comes from the printing URLs
   in the cached database — the same images the trainer shows. Rulings
   autosave to localStorage and export as a drop-in tools/rulings.json. */
/* Token names a text references. Tokens are cards, so their rules text is
   authoritative and already in the database — the review station shows it
   inline rather than asking for a ruling it doesn't need. */
const tokenRefsIn = tx => [...new Set(
  [...(tx||"").matchAll(/\b([A-Z][A-Za-z0-9'-]*(?: [A-Z][A-Za-z0-9'-]*){0,3}) tokens?\b/g)]
    .map(m => m[1].replace(/^(?:Create|Equip|Destroy) (?:X |\d+ )?/, "").trim()))];

/* Card art and the token registry, read once from the cached database and
   shared by every renderer so the CLI, the markdown and the review station
   can never disagree about what a token says. */
let _pool = null;
function pool(){
  if(_pool) return _pool;
  const CACHE = path.join(HERE, ".cache", "card.json");
  const imgs = {}, byName = {}, TOKENS = {};
  if(fs.existsSync(CACHE)){
    for(const c of JSON.parse(fs.readFileSync(CACHE,"utf8"))){
      if(!c || !c.name) continue;
      const url = ((c.printings||[]).find(p=>p.image_url)||{}).image_url;
      /* equipment and weapons carry pitch "" — normalize to 0, the same
         way the audit keys them, or their art never resolves */
      const p = (c.pitch === null || c.pitch === undefined || c.pitch === "") ? 0 : c.pitch;
      if(url) imgs[slug(c.name)+"|"+p] = url;
      (byName[c.name] = byName[c.name] || []).push(c);
    }
  }
  /* every token the pool references, resolved to the record actually typed
     as a token (Gold and Might collide with ordinary cards of that name) */
  for(const e of Object.values(A.cards))
    for(const t of tokenRefsIn(e.tx)){
      if(TOKENS[t]) continue;
      const cands = byName[t] || [];
      const rec = cands.find(c=>/token/i.test(c.type_text||"")) || cands[0];
      if(!rec) continue;
      TOKENS[t] = {
        /* prefer the plain variant, same as mapDbCard does for the pool —
           functional_text carries **bold** markers that would render raw */
        name: t, tt: rec.type_text || "",
        tx: (rec.functional_text_plain || rec.functional_text || "").replace(/\*\*?/g, ""),
        pw: rec.power, def: rec.defense,
        img: ((rec.printings||[]).find(p=>p.image_url)||{}).image_url || null
      };
    }
  return (_pool = {imgs, TOKENS});
}

function writeHtml(stack){
  const {imgs, TOKENS} = pool();
  const data = stack.filter(e=>!e.answered).map(e => ({
    slug: e.slug, kind: e.kind, title: e.title, note: e.note, status: e.status, ask: e.ask,
    followup: e.followup, priorRuling: e.priorRuling,
    decks: e.heroes.map(heroName),
    cards: e.cards.map(c => ({
      name: c.name, pitch: c.pitch, tt: c.tt, cost: c.cost, power: c.power, def: c.def,
      kw: c.kw, gkw: c.gkw, tier: c.tier, tx: c.tx || "", gaps: c.gaps,
      img: imgs[slug(c.name)+"|"+(c.pitch||0)] || imgs[slug(c.name)+"|0"] || null,
      refs: tokenRefsIn(c.tx).filter(t => TOKENS[t])
    }))
  }));
  const seeded = {};
  for(const [k,v] of Object.entries(rulings)) seeded[k] = v.ruling;
  /* The export must never be able to LOSE a ruling. Answered entries are not
     in DATA (that is the point of the stack), so an export built only from
     DATA silently dropped every previously-answered slug. Ship the whole
     prior file and let new answers overwrite into a copy of it. */

  const html = TEMPLATE
    .replace("/*__DATA__*/null", JSON.stringify(data).replace(/<\/script>/gi,"<\\/script>"))
    .replace("/*__SAVED__*/null", JSON.stringify(seeded).replace(/<\/script>/gi,"<\\/script>"))
    .replace("/*__TOKENS__*/null", JSON.stringify(TOKENS).replace(/<\/script>/gi,"<\\/script>"))
    .replace("/*__PRIOR__*/null", JSON.stringify(rulings).replace(/<\/script>/gi,"<\\/script>"))
    .replace("/*__PROGRESS__*/null", JSON.stringify({
      tiers: A.tiers, pool: A.poolUnique, answered: Object.keys(rulings).length,
      open: data.length, appVer: A.appVer
    }));
  fs.writeFileSync(path.join(HERE, "review.html"), html);
  console.log("Wrote tools/review.html — " + data.length + " entries, " +
    data.reduce((a,e)=>a+e.cards.length,0) + " cards, " +
    Object.keys(TOKENS).length + " tokens resolved.");
  console.log("Open it:  open tools/review.html");
}

const TEMPLATE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>Dawnblade — The Stack</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Spline+Sans:wght@400;500;600&family=Spline+Sans+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
:root{--r:#C4302B;--y:#E8B33C;--b:#3B6FB0;--ink:#14100E;--forge:#241B16;--forge2:#2E241D;
 --bone:#E8DFD0;--bone-dim:#B8AC98;--line:#4A3B2E;--ok:#7BA05B}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--ink);color:var(--bone);font-family:'Spline Sans',sans-serif;font-size:15px;line-height:1.5;padding-bottom:96px}
h1,h2,h3,.disp{font-family:'Big Shoulders Display',sans-serif;letter-spacing:.02em;text-transform:uppercase}
.mono{font-family:'Spline Sans Mono',monospace}
button{font-family:inherit;color:inherit;background:none;border:none;cursor:pointer}
.wrap{max-width:1000px;margin:0 auto;padding:0 16px}
header{position:sticky;top:0;z-index:20;background:rgba(20,16,14,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
.hrow{display:flex;align-items:center;gap:12px;padding:12px 0}
.brand{font-family:'Big Shoulders Display';font-weight:800;font-size:21px;letter-spacing:.06em}
.brand em{font-style:normal;color:var(--y)}
.spacer{flex:1}
.btn{padding:7px 14px;border:1px solid var(--line);border-radius:4px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-family:'Big Shoulders Display';font-weight:700;color:var(--bone-dim);white-space:nowrap}
.btn:hover{border-color:var(--y);color:var(--y)}
.btn.go{background:var(--y);color:var(--ink);border-color:var(--y)}
.btn.go:hover{background:#f2c256}
.bar{height:3px;background:var(--forge2)}
.bar i{display:block;height:100%;background:var(--y);transition:width .3s}
.meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--bone-dim);padding-bottom:10px}
.pill{padding:3px 9px;border-radius:99px;border:1px solid var(--line);font-family:'Spline Sans Mono';font-size:10px;letter-spacing:.08em}
.pill.st{color:var(--y);border-color:#5c4a2a}
.pill.n{color:var(--bone)}
h1.title{font-size:44px;font-weight:800;margin:18px 0 6px;line-height:1}
.note{color:var(--bone-dim);max-width:70ch;margin-bottom:6px}
.decks{font-size:12px;color:var(--bone-dim);margin-bottom:20px}
.decks b{color:var(--bone);font-weight:500}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;margin-bottom:26px}
.card{background:var(--forge);border:1px solid var(--line);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;display:block;background:var(--forge2)}
.cbody{padding:12px 13px 14px}
.cname{font-family:'Big Shoulders Display';font-weight:700;font-size:19px;line-height:1.1}
.ctt{font-size:11px;color:var(--bone-dim);text-transform:uppercase;letter-spacing:.08em;margin:3px 0 9px}
.ctx{font-family:'Spline Sans Mono';font-size:12px;line-height:1.55;white-space:pre-wrap;color:#d6cbb8;background:var(--ink);border:1px solid #362a20;border-radius:4px;padding:9px 10px}
.gap{margin-top:8px;font-size:11.5px;line-height:1.45;color:#f0a9a5;display:flex;gap:7px}
.gap b{color:var(--r);font-weight:600;flex:none}
.fup{border:1px solid var(--r);border-left:3px solid var(--r);border-radius:4px;background:rgba(196,48,43,.09);padding:12px 14px;margin-bottom:18px}
.fup .fl{font-family:'Big Shoulders Display';font-weight:800;font-size:13px;letter-spacing:.11em;text-transform:uppercase;color:#f0a9a5;margin-bottom:7px}
.fup .fq{font-size:14.5px;line-height:1.55}
.fup dl{margin-top:10px;font-size:12px;line-height:1.5;color:var(--bone-dim)}
.fup dt{font-family:'Spline Sans Mono';font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#8a7f6f;margin-top:7px}
.prior{border:1px solid var(--line);border-radius:4px;padding:10px 12px;margin-bottom:16px;font-size:12.5px;line-height:1.55;color:var(--bone-dim)}
.prior b{display:block;font-family:'Spline Sans Mono';font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ok);margin-bottom:5px;font-weight:500}
.tokref{margin-top:11px;border-top:1px solid #362a20;padding-top:10px}
.tokref .lab{font-family:'Big Shoulders Display';font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ok);margin-bottom:7px}
.tok{display:flex;gap:9px;margin-bottom:9px}
.tok img{width:46px;flex:none;border-radius:3px;align-self:flex-start;background:var(--forge2)}
.tokb{min-width:0}
.tokn{font-family:'Big Shoulders Display';font-weight:700;font-size:14px;line-height:1.15}
.tokt{font-size:9.5px;color:var(--bone-dim);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
.tokx{font-family:'Spline Sans Mono';font-size:11px;line-height:1.5;color:#c3bbaa;white-space:pre-wrap}
.kws{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}
.kw{font-family:'Spline Sans Mono';font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:3px;background:var(--forge2);border:1px solid var(--line);color:var(--bone-dim)}
.asklab{font-family:'Big Shoulders Display';font-weight:700;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:var(--y);margin-bottom:8px}
textarea{width:100%;min-height:190px;background:var(--forge);color:var(--bone);border:1px solid var(--line);border-radius:6px;padding:14px;font-family:'Spline Sans Mono';font-size:13.5px;line-height:1.6;resize:vertical}
textarea:focus{outline:none;border-color:var(--y)}
.hint{font-size:11.5px;color:#8a7f6f;margin-top:8px;line-height:1.6}
.hint kbd{font-family:'Spline Sans Mono';font-size:10.5px;background:var(--forge2);border:1px solid var(--line);border-radius:3px;padding:1px 5px}
footer{position:fixed;left:0;right:0;bottom:0;background:rgba(20,16,14,.97);border-top:1px solid var(--line);backdrop-filter:blur(8px);z-index:20}
.frow{display:flex;align-items:center;gap:10px;padding:12px 0}
.saved{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ok);opacity:0;transition:opacity .3s}
.saved.on{opacity:1}
select{background:var(--forge);color:var(--bone);border:1px solid var(--line);border-radius:4px;padding:7px 9px;font-family:'Spline Sans Mono';font-size:11.5px;max-width:230px}
.prog{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0 10px}
.prog .cov{flex:1;min-width:190px;height:9px;border-radius:5px;overflow:hidden;display:flex;background:var(--forge2);border:1px solid var(--line)}
.prog .cov i{display:block;height:100%}
.prog .cov .cf{background:var(--ok)}
.prog .cov .cp{background:var(--y)}
.prog .cov .cn{background:#6B6258}
.prog .lab{font-family:'Spline Sans Mono';font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--bone-dim);white-space:nowrap}
.prog .lab b{color:var(--ok)}
.prog .lab i{color:var(--y);font-style:normal}
.prog .lab s{color:#8a7f6f;text-decoration:none}
.done{text-align:center;padding:80px 20px}
.done h1{font-size:50px;color:var(--y)}
.pill{white-space:nowrap}
@media(max-width:640px){
  h1.title{font-size:32px}.cards{grid-template-columns:1fr}.wrap{padding:0 12px}
  .brand{font-size:17px}#count{font-size:9px;padding:2px 7px}
  /* the jump menu gets its own full-width row rather than being crushed
     to a bare chevron between the brand and the export button */
  .hrow{gap:7px;flex-wrap:wrap;padding-bottom:10px}
  select{max-width:none;flex:1 0 100%;order:5;font-size:11.5px;padding:8px}
  .btn{padding:6px 10px;font-size:11px}
}
</style></head><body>
<header><div class="wrap">
  <div class="hrow">
    <span class="brand">DAWN<em>BLADE</em></span>
    <span class="pill mono" id="count"></span>
    <span class="spacer"></span>
    <select id="jump"></select>
    <button class="btn go" id="export">Export JSON</button>
  </div></div>
  <div class="wrap"><div class="prog" id="cov"></div></div>
  <div class="bar"><i id="prog"></i></div>
</header>
<main class="wrap" id="main"></main>
<footer><div class="wrap"><div class="frow">
  <button class="btn" id="prev">← Prev</button>
  <span class="saved" id="saved">saved</span>
  <span class="spacer"></span>
  <button class="btn" id="skip">Skip</button>
  <button class="btn go" id="next">Save &amp; Next →</button>
</div></div></footer>
<script>
const DATA = /*__DATA__*/null;
const SEED = /*__SAVED__*/null;
const TOKENS = /*__TOKENS__*/null;
/* every ruling already on disk, metadata and all — the export starts from a
   copy of this so an answered entry can never be dropped */
const PRIOR = /*__PRIOR__*/null;
const PROGRESS = /*__PROGRESS__*/null;
const KEY = "dawnblade.stack.rulings";
let store = Object.assign({}, SEED, JSON.parse(localStorage.getItem(KEY) || "{}"));
let i = 0;
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* A token is a card, so its rules text is already known — show it instead
   of asking. What is still open is how the ENGINE should carry it. */
function tokenPanel(refs){
  if(!refs || !refs.length) return "";
  return '<div class="tokref"><div class="lab">Token'+(refs.length>1?"s":"")+' it references — already defined in the card database</div>'
    + refs.map(n => { const t = TOKENS[n]; if(!t) return "";
        return '<div class="tok">'
          + (t.img ? '<img loading="lazy" src="'+esc(t.img)+'" alt="'+esc(t.name)+'"/>' : "")
          + '<div class="tokb"><div class="tokn">'+esc(t.name)+'</div>'
          + '<div class="tokt">'+esc(t.tt)+(t.pw?" · "+t.pw+" power":"")+'</div>'
          + '<div class="tokx">'+esc(t.tx || "(no text)")+'</div></div></div>';
      }).join("") + '</div>';
}

function render(){
  const e = DATA[i];
  if(!e){ $("#main").innerHTML = '<div class="done"><h1>Stack cleared</h1><p class="note">Every entry has a ruling. Hit <b>Export JSON</b> and drop it in as <span class="mono">tools/rulings.json</span>.</p></div>'; return; }
  const done = DATA.filter(x => (store[x.slug]||"").trim()).length;
  $("#count").textContent = (i+1) + " / " + DATA.length + "  ·  " + done + " answered";
  $("#prog").style.width = (done / DATA.length * 100) + "%";
  const cards = e.cards.map(c => {
    const kws = [].concat(c.kw||[], (c.gkw||[]).map(k=>k+" (granted)"));
    return '<div class="card">'
      + (c.img ? '<img loading="lazy" src="'+esc(c.img)+'" alt="'+esc(c.name)+'"/>' : "")
      + '<div class="cbody"><div class="cname">'+esc(c.name)+'</div>'
      + '<div class="ctt">pitch '+c.pitch+' · '+esc(c.tt||"")+' · tier '+esc(c.tier)+'</div>'
      + '<div class="ctx">'+esc(c.tx || "(no rules text)")+'</div>'
      + (c.gaps||[]).map(g => '<div class="gap"><b>UNREAD</b><span>'+esc(g)+'</span></div>').join("")
      + tokenPanel(c.refs)
      + (kws.length ? '<div class="kws">'+kws.map(k=>'<span class="kw">'+esc(k)+'</span>').join("")+'</div>' : "")
      + '</div></div>';
  }).join("");
  $("#main").innerHTML =
      '<div class="meta" style="padding-top:18px">'
    +   '<span class="pill st">'+esc(e.status)+'</span>'
    +   '<span class="pill n">'+e.cards.length+' card'+(e.cards.length>1?"s":"")+'</span>'
    +   '<span class="pill n">'+e.decks.length+' deck'+(e.decks.length>1?"s":"")+'</span>'
    + '</div>'
    + '<h1 class="title">'+esc(e.title)+'</h1>'
    + '<p class="note">'+esc(e.note)+'</p>'
    + '<p class="decks">Decks affected: <b>'+esc(e.decks.join(", "))+'</b></p>'
    + (e.followup ? '<div class="fup"><div class="fl">Needs one more detail</div>'
        + '<div class="fq">'+esc(e.followup.question)+'</div>'
        + '<dl><dt>what I built</dt><dd>'+esc(e.followup.built)+'</dd>'
        + '<dt>where I got stuck</dt><dd>'+esc(e.followup.wall)+'</dd></dl></div>' : "")
    + (e.priorRuling ? '<div class="prior"><b>Your ruling so far</b>'+esc(e.priorRuling)+'</div>' : "")
    + '<div class="cards">'+cards+'</div>'
    + '<div class="asklab">How should Dawnblade handle this?</div>'
    + '<textarea id="ans" placeholder="'+esc((e.followup && e.followup.question) || e.ask || "Explain the rule the way you'd explain it at the table — what it does, when it triggers, and what it should do against a dummy with no hand and no turn.\\n\\nBe as loose or as precise as you like; this becomes the spec for the parser.")+'"></textarea>'
    + '<p class="hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> save &amp; next · <kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> move · autosaves to this browser. Nothing leaves the page until you export.</p>';
  $("#ans").value = store[e.slug] || "";
  $("#ans").addEventListener("input", save);
  $("#jump").value = String(i);
}
function save(){
  const e = DATA[i]; if(!e) return;
  const v = $("#ans") ? $("#ans").value : "";
  if(v.trim()) store[e.slug] = v; else delete store[e.slug];
  localStorage.setItem(KEY, JSON.stringify(store));
  const s = $("#saved"); s.classList.add("on"); clearTimeout(save._t);
  save._t = setTimeout(()=>s.classList.remove("on"), 900);
  const done = DATA.filter(x => (store[x.slug]||"").trim()).length;
  $("#prog").style.width = (done / DATA.length * 100) + "%";
  $("#count").textContent = (i+1) + " / " + DATA.length + "  ·  " + done + " answered";
}
const go = d => { save(); i = Math.max(0, Math.min(DATA.length-1, i+d)); render(); window.scrollTo(0,0); };
$("#next").onclick = () => go(1);
$("#prev").onclick = () => go(-1);
$("#skip").onclick = () => go(1);
$("#jump").onchange = ev => { save(); i = +ev.target.value; render(); window.scrollTo(0,0); };
$("#export").onclick = () => {
  save();
  const out = JSON.parse(JSON.stringify(PRIOR || {}));
  const today = new Date().toISOString().slice(0,10);
  for(const e of DATA){
    const r = (store[e.slug]||"").trim(); if(!r) continue;
    out[e.slug] = {at:today, mechanic:e.title, status:e.status,
      cards:e.cards.map(c=>c.name+" ("+c.pitch+")"), ruling:r};
  }
  /* anything answered in this browser that is no longer an open entry */
  for(const [k,v] of Object.entries(store)){
    const r = (v||"").trim(); if(!r) continue;
    if(out[k] && out[k].ruling === r) continue;
    if(!DATA.some(e=>e.slug===k)) out[k] = {...(out[k]||{at:today, mechanic:k, status:"answered", cards:[]}), ruling:r};
  }
  const blob = new Blob([JSON.stringify(out,null,1)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "rulings.json"; a.click();
};
document.addEventListener("keydown", ev => {
  if(!(ev.ctrlKey||ev.metaKey)) return;
  if(ev.key === "Enter"){ ev.preventDefault(); go(1); }
  if(ev.key === "ArrowRight"){ ev.preventDefault(); go(1); }
  if(ev.key === "ArrowLeft"){ ev.preventDefault(); go(-1); }
});
if(PROGRESS){
  const t = PROGRESS.tiers, tot = PROGRESS.pool;
  const pct = n => (n / tot * 100).toFixed(1) + "%";
  $("#cov").innerHTML =
      '<span class="lab">Dawnblade v' + esc(PROGRESS.appVer) + ' · pool ' + tot + ' cards</span>'
    + '<span class="cov" title="fully scripted / partial / nothing parsed">'
    +   '<i class="cf" style="width:'+pct(t.full)+'"></i>'
    +   '<i class="cp" style="width:'+pct(t.part)+'"></i>'
    +   '<i class="cn" style="width:'+pct(t.none)+'"></i>'
    + '</span>'
    + '<span class="lab"><b>' + t.full + ' full</b> · <i>' + t.part + ' part</i> · <s>' + t.none + ' none</s></span>'
    + '<span class="lab">' + PROGRESS.answered + ' rulings in</span>';
}
$("#jump").innerHTML = DATA.map((e,n) =>
  '<option value="'+n+'">'+(n+1)+'. '+esc(e.title)+' ('+e.cards.length+')</option>').join("");
render();
</script></body></html>`;

/* ---- cli ------------------------------------------------------------ */
const stack = build();
const [cmd, ...rest] = process.argv.slice(2);

if(!cmd){ list(stack); writeMd(stack); writeHtml(stack); }
else if(cmd === "--md"){ writeMd(stack); }
else if(cmd === "--html" || cmd === "review"){ writeHtml(stack); }
else if(cmd === "done"){
  const ans = stack.filter(e => e.answered);
  if(!ans.length) console.log("\nNothing answered yet.\n");
  for(const e of ans){
    console.log("\n\x1b[32m" + e.slug + "\x1b[0m (" + e.cards.length + " cards) — " + rulings[e.slug].at);
    console.log("  " + rulings[e.slug].ruling.replace(/\n/g,"\n  "));
  }
  console.log("");
}
else if(cmd === "explain"){
  const [s, ...words] = rest;
  const e = stack.find(x => x.slug === s);
  if(!e){ console.error("No stack entry \"" + s + "\". Run `node tools/stack.js` for the list."); process.exit(1); }
  const ruling = words.join(" ").trim();
  if(!ruling){ console.error("Give the ruling as the last argument, in quotes."); process.exit(1); }
  rulings[s] = {
    at: new Date().toISOString().slice(0,10),
    mechanic: e.title,
    status: e.status,
    cards: e.cards.map(c => c.name + " (" + c.pitch + ")"),
    ruling
  };
  fs.writeFileSync(RULINGS, JSON.stringify(rulings, null, 1));
  console.log("\n\x1b[32mRecorded\x1b[0m " + s + " — unblocks " + e.cards.length + " card(s):");
  console.log("  " + e.cards.map(c=>c.name).join(", "));
  console.log("\n  \"" + ruling + "\"\n");
  console.log("Next: hand this to Claude to teach the parser, then `npm run audit`.\n");
}
else {
  const e = stack.find(x => x.slug === cmd) ||
            stack.find(x => x.slug.startsWith(cmd)) ||
            stack.find(x => x.title.toLowerCase() === cmd.toLowerCase());
  if(!e){ console.error("No stack entry \"" + cmd + "\"."); process.exit(1); }
  dossier(e);
}
