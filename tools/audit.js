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
     node tools/audit.js --live           # audit the LIVE upstream database
     node tools/audit.js --refresh        # force re-download, then audit it

   IT READS THE PINNED POOL BY DEFAULT (`data/pool.json`), so a fresh
   clone can audit with no network and two machines produce the same
   AUDIT.md. `--live`/`--refresh` point it at the upstream database
   instead, which is how you see what has moved; `test/drift.test.js`
   is the guard that says whether the movement broke anything.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const G = require("../engine/game");
const C = require("../engine/cards");
const { KEYWORDS, SYMBOLS } = require("./ledger");
const { loadData, cardDbPath, hasLiveDb } = require("../test/helpers/extract");

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
  /* BLAZE's clause 1, built v3.39. Clause 2 is his activated ability and
     is recognised by `parseHeroPower` rather than by a static, which is
     why only one entry appears here. */
  {key:"energyOnOpt",
   re:/whenever you opt, put energy counters on [a-z, ]+ equal to the number of cards looked at this way/,
   note:"Blaze — opt fills the energy pool, by cards LOOKED AT rather than the printed number"},
  /* THE RIDER ON BLAZE'S ABILITY LINE, and it is a LEDGER entry rather
     than a second passive because it is BUILT as part of the ability
     itself: `playThisTurn` on the pick spec stamps the banished card, and
     `playsAsInstant` reads the stamp. The audit splits hero text on
     sentences, so this half arrives on its own and would report
     unrecognised while working perfectly — v3.21's exact shape, and the
     reason that entry says a hero ability is finished when the clause is
     BUILT *and* the ledger has been told. */
  {key:"blazeBanishInstant", re:/you may play it this turn as though it were an instant/, build:false,
   note:"Blaze — the banished card is stamped playable-this-turn at instant speed (no passive: it rides on the ability's own pick spec)"},
  {key:"startItem", re:/start the game with a mechanologist item with cost 2 or less/,
   note:"Dash — pregame item (auto-picked; pick UI pending)"},
  {key:"wateryGrave", re:/if a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard/,
   note:"Gravy Bones — blue-to-graveyard this turn unlocks watery grave (built.wateryGrave, already wired — this recognizer was simply missing)"},
  {key:"lyathBoo", re:/whenever the crowd boos you, create a might token/,
   note:"Lyath — booed → Might token"},
  /* BRIAR's two clauses, built in v3.21. Both mint a token, and the token's
     NAME is read off her printed line rather than stored as a flag — so
     these passives answer a string, not a boolean. */
  {key:"earthOnFirstHeroDmg",
   re:/the first time an attack action card you control deals damage to an opposing hero each turn, create an? [a-z][a-z' -]*? token/,
   note:"Briar — first attack action card to damage a hero each turn → Embodiment of Earth"},
  {key:"lightningOnSecondNonAtk",
   re:/the second time you play a non-attack action card each turn, create an? [a-z][a-z' -]*? token/,
   note:"Briar — the SECOND non-attack action card each turn → Embodiment of Lightning"},
  /* KAYO's three clauses were BUILT in v2.55–v2.56 and this ledger was
     never told, so the audit reported all three as "not recognized by any
     ability reader" for eleven versions while the handoff called the hero
     complete. Nothing cross-checked the two, which is why the drill below
     `test/dorinthea.test.js` now does. */
  {key:"gearSlots", re:/you have 1 weapon zone/, build:false,
   note:"Kayo — one weapon zone (no passive: the generic equipment slot rules already model this)"},
  {key:"atkPowOffChain", re:/attack action cards you own get \+(\d+)\{p\} while they are in any zone other than the combat chain/,
   note:"Kayo — attack actions get +N{p} off the combat chain (a THRESHOLD rule, not a damage buff)"},
  {key:"mightOnFirst6Discard", re:/the first time you discard a card with 6 or more \{p\} during each of your action phases, create a might token/,
   note:"Kayo — first 6+{p} discard per action phase → Might token"},
  {key:"weaponRefresh", re:/(?:when a weapon you control hits|the first time your weapon attack hits each turn), you may attack an additional time with that weapon this turn/,
   note:"Dorinthea — a weapon that hits may swing again this turn (once per turn; pays {r} and an action point again)"}
];
/* Tokens are read out of the pool's own text rather than listed by hand —
   a hardcoded list silently rots (it carried 6 of the 17 real tokens, and
   named "Bloodrot" for what the database calls "Bloodrot Pox"). Every
   token our cards reference is itself a card in the database, so the
   golden rule applies: resolve it, never describe it. */
const tokensReferencedIn = texts => {
  const found = new Set();
  for(const tx of texts)
    for(const m of (tx||"").matchAll(/\b([A-Z][A-Za-z0-9'-]*(?: [A-Z][A-Za-z0-9'-]*){0,3}) tokens?\b/g)){
      /* "Create X Frostbite tokens" — drop a leading count word */
      found.add(m[1].replace(/^(?:Create|Equip|Destroy) (?:X |\d+ )?/, "").trim());
    }
  return [...found].sort();
};

async function loadDB(refresh, DBSRC, live){
  /* The pinned pool is the default so this is reproducible offline. It
     holds every record the pool can reach and nothing else, which is all
     an audit of the pool ever looks at. */
  if(!refresh && !live) return JSON.parse(fs.readFileSync(cardDbPath(), "utf8"));
  if(!refresh && hasLiveDb()) return JSON.parse(fs.readFileSync(CACHE, "utf8"));
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
  /* A QUOTED GRANTED ABILITY THE PARSER COULD NOT READ (v3.40). The
     clause's HEAD parses, so the tier says `full` and says it honestly —
     what was invisible is the ability riding in quotes beside it. Flagged
     by name rather than folded into the tier, because downgrading the
     clause claims the head does not work either. */
  for(const q of (fx.quotedUnread || []))
    flags.push(`granted ability in quotes has NO reader: "${q}" — the head parses, this does not`);
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
  const clauses = (rec.tx||"").split(/\n+/).map(s=>P.clean(s)).filter(Boolean)
    .reduce((a,s)=>a.concat(s.split(/\.\s+/)),[]).map(s=>s.trim()).filter(Boolean).map(cl=>{
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
  const live = refresh || process.argv.includes("--live");
  const raw = await loadDB(refresh, W.DBSRC, live);
  if(live) console.log("Auditing the LIVE database — `data/pool.json` is what the drills read.");
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
  for(const nm of tokensReferencedIn(Object.values(cards).map(c=>c.tx))){
    /* prefer the record actually typed as a token — several token names
       (Gold, Might) collide with ordinary cards */
    const cands = db.byName[P.norm(nm)] || [];
    const rec = cands.find(c=>/token/i.test(c.tt||"")) || cands[0] || null;
    tokens[nm] = rec ? {found:true, tt:rec.tt, tx:rec.tx, pw:rec.pw, def:rec.d,
      fx: P.fxParse({name:"token:"+nm, pitch:0, tt:rec.tt, kw:rec.kw, tx:rec.tx}).tier}
      : {found:false};
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
