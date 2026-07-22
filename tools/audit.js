#!/usr/bin/env node
/* ============================================================
   DAWNBLADE POOL AUDITOR
   Reads every card the 15 Silver Age decks can present — deck
   cards, gear, heroes, dummy gear, tokens — through the engine's
   own parser, and reports what is scripted, what is inert by
   design, and what is silently unhandled. Never guesses: gaps
   are surfaced verbatim for the parser to be taught.

   Usage:
     node tools/audit.js                  # audit -> AUDIT.md + tools/audit.json
     node tools/audit.js --write-baseline # also pin tools/coverage-baseline.json
     node tools/audit.js --refresh        # force re-download of the card DB
   ============================================================ */
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const G = require("../engine/game");
const C = require("../engine/cards");
const { KEYWORDS, SYMBOLS } = require("./ledger");
const { loadData } = require("../test/helpers/extract");

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(__dirname, ".cache", "card.json");

/* ---- hero static-ability recognizers — mirrors of Battle's `built`
   memo in index.html; if those regexes change, change these by hand ---- */
const HERO_STATICS = [
  {key:"arsenalInstant", re:/play blue[^.]*non-attack[^.]*action cards from your arsenal as though/,
   note:"Iyslander — blue non-attacks from arsenal at instant speed"},
  {key:"iceFrostbite", re:/ice card during an opponent.{0,4}turn.{0,4}create a frostbite/,
   note:"Iyslander — Ice on opponent's turn → Frostbite"},
  {key:"viseraiPassive", re:/whenever you play a runeblade card, if you.{0,15}played another.{0,8}non-attack.{0,8}action card this turn, create a runechant/,
   note:"Viserai — Runeblade after a non-attack → Runechant"},
  {key:"startItem", re:/start the game with a mechanologist item with cost 2 or less/,
   note:"Dash — pregame item (auto-picked; pick UI pending)"}
];
const TOKEN_NAMES = ["Runechant","Frostbite","Seismic Surge","Vigor","Bloodrot","Frailty"];

async function loadDB(refresh, DBSRC){
  if(!refresh && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  console.log("Fetching card database:", DBSRC);
  const res = await fetch(DBSRC);
  if(!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  fs.mkdirSync(path.dirname(CACHE), {recursive:true});
  fs.writeFileSync(CACHE, text);
  console.log("Cached", (text.length/1048576).toFixed(1), "MB at", path.relative(ROOT, CACHE));
  return JSON.parse(text);
}

const lc = s => (s||"").toLowerCase();
const cardKey = c => P.norm(c.name) + "|" + (c.pitch||0);

/* "Ward 3" -> "ward", "Opt X" -> "opt", "Kayo Specialization" -> "specialization" */
const kwBase = k => {
  k = lc(k).trim();
  if(/ specialization$/.test(k)) return "specialization";
  const m = k.match(/^([a-z][a-z ]*?) (?:\d+|x)$/);
  return m ? m[1] : k;
};

/* Symbols like {p} {r} {h} appearing anywhere in a text */
const symbolsIn = tx => [...new Set(([...(tx||"").matchAll(/\{[a-z0-9]+\}/gi)]).map(m=>lc(m[0])))];

/* keyword mentions in rules text that the ledger tracks (nuance guard:
   a keyword can appear in text without being a printed keyword) */
const ledgerMentions = tx => Object.keys(KEYWORDS).filter(k => new RegExp("\\b"+k.replace(/ /g,"\\s+")+"\\b","i").test(tx||""));

function analyzeCard(rc){
  const fx = P.fxParse(rc);
  const flags = [];
  if(!rc.resolved) flags.push("UNRESOLVED — no database record found");
  const skipped = fx.clauses.filter(cl=>cl.st==="skip").map(cl=>cl.t);
  const kws = (rc.kw||[]).map(lc);
  const gkws = (rc.gkw||[]).map(lc);
  for(const k of kws) if(!KEYWORDS[kwBase(k)]) flags.push(`UNDOCUMENTED printed keyword: "${k}"`);
  for(const k of gkws) if(!KEYWORDS[kwBase(k)]) flags.push(`UNDOCUMENTED granted keyword: "${k}"`);
  for(const k of [...kws, ...gkws].map(kwBase))
    if(KEYWORDS[k] && KEYWORDS[k].status==="unreviewed") flags.push(`unreviewed keyword: "${k}"`);
  if((rc.tx||"").includes("{t}")) flags.push("tap cost {t} — not enforced (see ledger)");
  if((rc.tx||"").includes("{u}")) flags.push("untap {u} — not parsed (see ledger)");
  /* the Kayo nuance: a granted keyword must be wired to a parsed grant
     (condition, on-hit, or a next-attack grant), never treated as printed */
  if(gkws.includes("go again")){
    const wired = fx.conds.some(x=>x.op[0]==="ga") || fx.onHit.some(o=>o[0]==="ga")
      || fx.ops.some(o=>o[0]==="gaNext") || fx.ga /* printed too (legit: e.g. boost grants) */;
    if(!wired && !kws.includes("boost")) flags.push("granted go-again with no parsed grant path");
  }
  if(/\bgo again\b/i.test(rc.tx||"") && !fx.ga && !fx.conds.some(x=>x.op[0]==="ga")
     && !fx.onHit.some(o=>o[0]==="ga") && !fx.ops.some(o=>o[0]==="gaNext"))
    flags.push("text mentions go again but no clause parses it");
  const syms = symbolsIn(rc.tx);
  for(const s of syms) if(!SYMBOLS[s]) flags.push(`UNDOCUMENTED symbol in text: ${s}`);
  const wc = P.isWeapon(rc) ? P.weaponCost(rc.tx) : null;
  const eqAbility = (!P.isWeapon(rc) && /equipment/i.test(rc.tt||"")) ? P.parseHeroPower(rc.tx, true) : null;
  return {
    name: rc.name, pitch: rc.pitch, tt: rc.tt, cost: rc.cost, power: rc.power, def: rc.def,
    kw: rc.kw||[], gkw: rc.gkw||[], symbols: syms, mentions: ledgerMentions(rc.tx),
    tier: fx.tier, approx: fx.approx, playable: fx.playable,
    clauses: fx.clauses, skipped, weaponCost: wc, eqAbility: eqAbility ? eqAbility.label : null,
    tx: rc.tx || "", flags
  };
}

function analyzeHero(rec, heroName){
  if(!rec) return {name: heroName, flags:["UNRESOLVED — hero not found in database"], clauses:[], statics:[], power:null};
  const tl = P.clean(rec.tx||"").toLowerCase();
  const statics = HERO_STATICS.filter(s=>s.re.test(tl)).map(s=>s.note);
  const power = P.parseHeroPower(rec.tx||"");
  const clauses = P.clean(rec.tx||"").split(/\.\s+|\n+/).map(s=>s.trim()).filter(Boolean).map(cl=>{
    const cll = cl.toLowerCase();
    const covered = HERO_STATICS.some(s=>s.re.test(cll))
      || (/(action|instant)/i.test(cl) && !!P.parseHeroPower(cl));
    return {t:cl, covered};
  });
  const flags = [];
  const uncovered = clauses.filter(c=>!c.covered);
  if(uncovered.length) flags.push(`${uncovered.length} hero-text clause(s) not recognized by any ability reader`);
  return {name: rec.n, hp: rec.hp, int: rec.int, tt: rec.tt, tx: rec.tx,
    statics, power: power ? power.label : null, clauses, flags};
}

async function main(){
  const W = loadData(); // window.* from index.html — DECKS, HEROES, DBSRC, DUMMY_GEAR, DATA_VER
  const refresh = process.argv.includes("--refresh");
  const raw = await loadDB(refresh, W.DBSRC);
  const db = C.buildMaps(raw.filter(c=>c && c.name).map(C.mapDbCard));
  console.log("Database:", db.count, "cards mapped.");
  P.fxReset();

  const heroes = {};
  const cards = {};   // key -> analysis (unique by name|pitch)
  const usage = {};   // key -> [{hero, q, zone}]
  const addCard = (rc, heroK, zone) => {
    const key = cardKey(rc);
    if(!cards[key]) cards[key] = analyzeCard(rc);
    (usage[key] = usage[key] || []).push({hero: heroK, q: rc.q||1, zone});
  };

  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    heroes[h.k] = analyzeHero(C.resolveHero(db, d.hero), d.hero.name);
    for(const e of d.gear) addCard(C.resolveEntry(db, e), h.k, "gear");
    for(const e of d.deck) addCard(C.resolveEntry(db, e), h.k, "deck");
  }
  for(const nm of W.DUMMY_GEAR) addCard(C.resolveEntry(db, {name:nm, p:0, code:null, q:1}), "dummy", "gear");
  const tokens = {};
  for(const nm of TOKEN_NAMES){
    const rec = (db.byName[P.norm(nm)]||[])[0] || null;
    tokens[nm] = rec ? {found:true, tt:rec.tt, tx:rec.tx} : {found:false};
  }

  /* ---- inventories ---- */
  const allKeys = Object.keys(cards).sort();
  const kwInv = {}, gkwInv = {}, symInv = {};
  for(const k of allKeys){
    const c = cards[k];
    c.kw.forEach(x=>{ (kwInv[kwBase(x)] = kwInv[kwBase(x)]||[]).push(c.name); });
    c.gkw.forEach(x=>{ (gkwInv[kwBase(x)] = gkwInv[kwBase(x)]||[]).push(c.name); });
    c.symbols.forEach(x=>{ (symInv[x] = symInv[x]||[]).push(c.name); });
  }
  const tiers = {full:0, part:0, none:0};
  allKeys.forEach(k=>tiers[cards[k].tier]++);
  const flagged = allKeys.filter(k=>cards[k].flags.length);
  const gapped = allKeys.filter(k=>cards[k].tier!=="full");

  /* ---- audit.json ---- */
  const out = {
    generated: new Date().toISOString(), appVer: W.APP_VER, dataVer: W.DATA_VER,
    dbCount: db.count, poolUnique: allKeys.length, tiers,
    heroes, tokens, cards, usage
  };
  fs.writeFileSync(path.join(__dirname, "audit.json"), JSON.stringify(out, null, 1));

  if(process.argv.includes("--write-baseline")){
    const base = {};
    allKeys.forEach(k=>base[k] = cards[k].tier);
    fs.writeFileSync(path.join(__dirname, "coverage-baseline.json"), JSON.stringify(base, null, 1));
    console.log("Baseline pinned:", allKeys.length, "cards.");
  }

  /* ---- AUDIT.md ---- */
  const L = [];
  const uniq = a => [...new Set(a)];
  L.push(`# DAWNBLADE POOL AUDIT`);
  L.push(``);
  L.push(`Generated ${out.generated} · app v${W.APP_VER} · data ${W.DATA_VER} · db ${db.count} records`);
  L.push(``);
  L.push(`## Summary`);
  L.push(``);
  L.push(`| | count |`);
  L.push(`|---|---|`);
  L.push(`| Unique cards in pool (name\\|pitch) | ${allKeys.length} |`);
  L.push(`| Fully scripted | ${tiers.full} |`);
  L.push(`| Partially scripted | ${tiers.part} |`);
  L.push(`| Text-only (nothing parsed) | ${tiers.none} |`);
  L.push(`| Cards with audit flags | ${flagged.length} |`);
  L.push(``);
  L.push(`## Symbols found in pool text`);
  L.push(``);
  L.push(`| symbol | ledger status | cards using it |`);
  L.push(`|---|---|---|`);
  for(const s of Object.keys(symInv).sort())
    L.push(`| \`${s}\` | ${SYMBOLS[s] ? SYMBOLS[s].status + " — " + SYMBOLS[s].note : "**UNDOCUMENTED**"} | ${uniq(symInv[s]).length} |`);
  L.push(``);
  L.push(`## Printed keywords in pool`);
  L.push(``);
  L.push(`| keyword | ledger status | cards |`);
  L.push(`|---|---|---|`);
  for(const k of Object.keys(kwInv).sort())
    L.push(`| ${k} | ${KEYWORDS[k] ? KEYWORDS[k].status + " — " + KEYWORDS[k].note : "**UNDOCUMENTED**"} | ${uniq(kwInv[k]).join(", ")} |`);
  L.push(``);
  L.push(`## Granted keywords in pool (conditional grants — never merged with printed)`);
  L.push(``);
  L.push(`| keyword | ledger status | cards |`);
  L.push(`|---|---|---|`);
  for(const k of Object.keys(gkwInv).sort())
    L.push(`| ${k} | ${KEYWORDS[k] ? KEYWORDS[k].status : "**UNDOCUMENTED**"} | ${uniq(gkwInv[k]).join(", ")} |`);
  L.push(``);
  L.push(`## Heroes`);
  L.push(``);
  for(const h of W.HEROES){
    const hr = heroes[h.k];
    L.push(`### ${h.n} (${h.cls})`);
    if(hr.power) L.push(`- hero power: ${hr.power}`);
    for(const s of hr.statics) L.push(`- static: ${s}`);
    for(const cl of hr.clauses.filter(c=>!c.covered)) L.push(`- ⚠ unrecognized: "${cl.t}"`);
    for(const f of hr.flags) L.push(`- 🚩 ${f}`);
    L.push(``);
  }
  L.push(`## Tokens`);
  L.push(``);
  for(const [nm,t] of Object.entries(tokens))
    L.push(`- ${nm}: ${t.found ? "in database — “"+(t.tx||"(no text)")+"”" : "**not found in database**"}`);
  L.push(``);
  L.push(`## Coverage gaps — every unparsed clause, verbatim`);
  L.push(``);
  L.push(`The fix for any of these is always to teach \`classifyClause\`/\`fxParse\`, never to special-case the card.`);
  L.push(``);
  for(const k of gapped){
    const c = cards[k];
    const who = uniq(usage[k].map(u=>u.hero)).join(", ");
    L.push(`### ${c.name} (pitch ${c.pitch}) — ${c.tier} · [${who}]`);
    L.push(`- type: ${c.tt}${c.kw.length ? " · printed: " + c.kw.join(", ") : ""}${c.gkw.length ? " · granted: " + c.gkw.join(", ") : ""}`);
    for(const cl of c.clauses) L.push(`- ${cl.st==="run"?"▶":cl.st==="noop"?"○":"—"} ${cl.t}`);
    for(const f of c.flags) L.push(`- 🚩 ${f}`);
    L.push(``);
  }
  L.push(`## Flags on otherwise fully-scripted cards`);
  L.push(``);
  const fullFlagged = flagged.filter(k=>cards[k].tier==="full");
  if(!fullFlagged.length) L.push(`(none)`);
  for(const k of fullFlagged){
    const c = cards[k];
    L.push(`- **${c.name}** (pitch ${c.pitch}): ${c.flags.join(" · ")}`);
  }
  L.push(``);
  L.push(`## Fully scripted, no flags — the roll call`);
  L.push(``);
  const clean = allKeys.filter(k=>cards[k].tier==="full" && !cards[k].flags.length);
  L.push(clean.map(k=>`${cards[k].name} (${cards[k].pitch})`).join(" · "));
  L.push(``);
  fs.writeFileSync(path.join(ROOT, "AUDIT.md"), L.join("\n"));

  console.log(`\nPool: ${allKeys.length} unique cards — ${tiers.full} full / ${tiers.part} part / ${tiers.none} none`);
  console.log(`Flagged: ${flagged.length} cards · Gaps detailed in AUDIT.md`);
  const undocKw = uniq([...Object.keys(kwInv), ...Object.keys(gkwInv)]).filter(k=>!KEYWORDS[k]);
  const undocSym = Object.keys(symInv).filter(s=>!SYMBOLS[s]);
  if(undocKw.length) console.log("UNDOCUMENTED keywords:", undocKw.join(", "));
  if(undocSym.length) console.log("UNDOCUMENTED symbols:", undocSym.join(", "));
}

main().catch(e=>{ console.error(e); process.exit(1); });
