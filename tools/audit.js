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
const B = require("../engine/build");
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
  /* BOLTYN's clause 1, built v3.74. Clause 2 is his activated attack
     reaction and is recognised by `parseHeroPower` rather than by a
     static, which is why only one entry appears here — the same split
     Blaze's two clauses take. */
  {key:"chargedDefBuff",
   re:/if you'?(?:ve| have) charged this turn, your attacks get \+\d+\{p\} while defended by an attack action card/,
   note:"Boltyn — charged this turn: attacks get +1{p} while an attack action card defends"},
  /* ARAKNI's clause 1, built v3.75. Clause 2 is the Agent-of-Chaos
     transformation and is deliberately NOT here — see HANDOFF.md. */
  {key:"stealthMarkedBuff",
   re:/your attacks with stealth that are attacking a marked hero get \+\d+\{p\}/,
   note:"Arakni — a stealth attack on a marked hero gets +1{p} and an on-hit go again"},
  /* ARAKNI's clause 2, built v3.76 — the Agents of Chaos. Two entries,
     because the two halves are printed on DIFFERENT cards: she becomes,
     an Agent returns. `build:false` on neither — both are real build
     passives and the census asks the build about each. */
  {key:"becomeAgent",
   re:/at the beginning of your end phase, if an opponent is marked, you become a random agent of [a-z]+/,
   note:"Arakni — her end phase turns her into a random Agent of Chaos while an opponent is marked"},
  {key:"daggerDrain",
   re:/whenever a dagger you own hits a hero, they lose \d+\s*\{h\}/,
   note:"Arakni, Tarantula — a dagger of yours that hits a hero drains 1 more"},
  {key:"returnToBrood", re:/at the beginning of your end phase, return to the brood/,
   note:"an Agent of Chaos — its own end phase sends it home, and Arakni's clause fires again"},
  {key:"startItem", re:/start the game with a mechanologist item with cost 2 or less/,
   note:"Dash — pregame item (auto-picked; pick UI pending)"},
  /* FAI's clause 1, built v3.86 — Dash's shape one zone over, and the
     pool's only other "you may start the game with" line. The card's NAME
     is read off the printed text rather than stored, so the recognizer
     matches the SHAPE and not the card. */
  {key:"startGrave", re:/you may start the game with an? .+ in your graveyard/,
   note:"Fai — pregame Phoenix Flame in the graveyard (spliced out of the deck, `_gy` 0)"},
  /* FAI's clause 2's RIDER, built v3.86. `build:false` for Blaze's reason:
     it is carried by the ABILITY itself rather than by a passive on the
     build — `_dracDiscount` is stamped on the hero powCard and `effCost`
     applies it against the chain count the caller hands in. */
  {key:"dracDiscount", build:false,
   re:/this ability costs (?:\{r\})+ less to activate for each draconic chain link you control/,
   note:"Fai — the ability costs {r} less per Draconic chain link (no passive: `_dracDiscount` rides on the powCard and `effCost` reads it)"},
  {key:"wateryGrave", re:/if a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard/,
   note:"Gravy Bones — blue-to-graveyard this turn unlocks watery grave (built.wateryGrave, already wired — this recognizer was simply missing)"},
  {key:"lyathBoo", re:/whenever the crowd boos you, create a might token/,
   note:"Lyath — booed → Might token"},
  /* LYATH's clause 1, built v3.78 — and it was the project's ONLY UNFAIR
     entry from v3.21 until then: a real DRAWBACK left unbuilt, so he
     played strictly better than printed. Spent at the deal rather than
     threaded to thirty readers — see `build.halveCard`. */
  {key:"halveBase", re:/the base \{p\} and \{d\} of cards you control are halved, rounded up/,
   note:"Lyath — every card he controls is dealt at half its printed {p} and {d}, rounded up"},
  /* ENIGMA's clause 1, built v3.84 — reachable only once Cosmo made a
     Spectral Shield attack exist at all. */
  {key:"auraDiscount", re:/your first .+ attack each turn costs (?:\{r\})+ less to activate/,
   note:"Enigma — her first Spectral Shield attack each turn costs {r} less to activate"},
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
  /* `{t}` IS ENFORCED WHEREVER ITS CLAUSE IS READ (v3.48). A blanket flag
     here was a claim that stopped being true in stages, and by v3.48 it
     was wrong about FOURTEEN of the pool's seventeen `{t}` cards: an
     ally's tap since v3.44, a weapon's since v2.46, an equipment ability's
     since `tapsToActivate`, a triggered `you may {t} this` since v3.33,
     and a HERO's since the RULING (user, 2026-08-25).

     The test is the CLAUSE, exactly as for `{u}` beside it. `noop` is the
     right state for an activation LINE — the tap is charged by the ROUTE,
     not by an op (v3.44) — so only a `skip` means nothing enforces it.
     Three remain and all three are the same shape: the ability's PAYLOAD
     has no reader, so there is no ability to charge a tap for. Bravo's
     "turn a face-down card face-up", Goldkiss Rum's (a token nothing
     creates) and Turn to Mindfire's Ponder rider. */
  if((rc.tx||"").includes("{t}")
     && (fx.clauses||[]).some(cl => cl.st === "skip" && String(cl.t).includes("{t}")))
    flags.push("tap cost {t} — not enforced: its clause has no reader");
  /* `{u}` IS PARSED WHERE IT IS BUILT (v3.47). Scuttle Toes' "{u} target
     ally you control" reads now that an untap buys something — allies tap
     to attack since v3.44 — so a blanket flag here is a claim that stopped
     being true. The test is the CLAUSE, not the ops: Scuttle Toes' untap
     lives on its powCard, and what changed about the card is that its
     ability line went from `skip` (no reader, so `build.js` gave it no
     powCard at all) to `noop` (read by the equipment reader). Jack Be
     Quick still flags — its `{u}` unTAPS an OPPOSING ally and then steals
     it, which is a control change nothing models. */
  if((rc.tx||"").includes("{u}")
     && (fx.clauses||[]).some(cl => cl.st === "skip" && String(cl.t).includes("{u}")))
    flags.push("untap {u} — not parsed (see ledger)");
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

/* Two splitters, one clause. The audit breaks hero text on `/\.\s+/` and
   `fxParse` keeps the final sentence's period (v3.45), so the two spellings
   of one sentence are levelled before they are compared. */
const heroClauseKey = t => String(t).toLowerCase().replace(/\s+/g," ").replace(/\.+$/,"").trim();

/* IS THIS HERO CLAUSE THE ABILITY'S PRINTED NAME RATHER THAN A RULE? (v3.86)

   Briar prints "**Essence of Earth and Lightning**" on a line of its own
   and Iyslander "**Essence of Ice**". The audit splits hero text on
   newlines, so a name arrives looking exactly like a sentence and has
   reported UNREAD since v3.21 — which records it in prose so nobody
   chases it. Prose is not a mechanism.

   THE DATABASE NAMES THEM ITSELF. Both appear in the record's own
   `card_keywords`, which is the printed fact rather than a guess about
   shape — and the bold marker cannot be used, because `mapDbCard` strips
   `**` before anything here sees a record.

   THE DISCRIMINATOR IS `tools/ledger.js`'s CLOSED VOCABULARY, because
   `card_keywords` also carries REAL keywords (Crouching Tiger's whole
   text is "Ephemeral"). One reader, so a keyword added to the ledger is
   understood here the same day.

   MEASURED OVER THE WHOLE POOL before it was written: 63 `card_keywords`
   entries, 59 of them ledger keywords, and of the four that are not, only
   these two are on a HERO — Ash's "Material" and Blasmophet's "Transform"
   are labels on ordinary records this never looks at.

   IT ANNOTATES; IT DOES NOT SUPPRESS. The clause stays in the uncovered
   count, because a hero that printed a real keyword on a line of its own
   would otherwise vanish from the report. Over-reporting is the safe
   direction (v3.21); what the flag buys is that the number can be READ
   rather than investigated. */
const KW_WORDS = Object.keys(KEYWORDS);
const isLedgerKeyword = s =>
  KW_WORDS.some(k => new RegExp("\\b" + k.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&") + "\\b", "i").test(s));
const abilityNamesOf = rec =>
  new Set(((rec && rec.kw) || []).filter(k => !isLedgerKeyword(k)).map(k => P.clean(k)));

function analyzeHero(rec, heroName){
  if(!rec) return {name: heroName, flags:["UNRESOLVED — hero not found in database"], clauses:[], statics:[], power:null};
  const tl = P.clean(rec.tx||"").toLowerCase();
  const statics = HERO_STATICS.filter(s=>s.re.test(tl)).map(s=>s.note);
  const power = P.parseHeroPower(rec.tx||"");
  /* THE ABILITY'S OWN RIDERS ARE READ BY `fxParse`, NOT BY THIS FUNCTION
     (v3.71). `parseHeroPower` answers about the ability's FIRST sentence;
     `build.js` then hands the powCard the WHOLE printed line (v3.39's
     `_hEffFull`) and `execute` re-reads it, so every sentence after the
     first is read exactly as a card's would be.

     Without this the audit reported a fully built hero ability as three
     unread clauses — v3.21's one-sided ledger, which is the reason that
     entry says a hero ability is finished when the clause is BUILT *and*
     the ledger has been told. The line comes from `build.heroAbilityLine`
     rather than being re-derived here: one body, two readers.

     A unique fixture NAME, because `fxParse` memoizes on `name|pitch`. */
  const abLine = power ? B.heroAbilityLine(rec, P.parseHeroPower(rec.tx||"")) : "";
  const abRead = new Set();
  if(abLine){
    const abFx = P.fxParse({name: "hero-ability|" + (rec.n || heroName), pitch: 0,
                            tt: "Hero Ability", kw: [], tx: abLine});
    for(const c of abFx.clauses) if(c.st !== "skip") abRead.add(heroClauseKey(c.t));
  }
  /* A BOLD ABILITY NAME IS A HEADING, AND IT IS ANNOTATED RATHER THAN
     SUPPRESSED (v3.86). Briar prints "**Essence of Earth and Lightning**"
     and Iyslander "**Essence of Ice**" on lines of their own; the audit
     splits hero text on newlines, so a heading arrives looking exactly
     like a sentence and has reported unread since v3.21, which records it
     in prose so nobody chases it. Prose is not a mechanism.

     IT IS NOT DROPPED FROM THE COUNT, deliberately. A wholly-bold line CAN
     be real rules text — Teklovossen prints "**Battleworn**", a keyword —
     so a suppressor would hide a genuine gap the moment one appears, and
     over-reporting is the safe direction (v3.21). What the flag buys is
     that the report SAYS which lines are names, so the number can be read
     rather than investigated.

     The test is on the RAW line: bold in the source, no sentence
     punctuation, and not a printed keyword the ledger knows. */
  const abilityNames = abilityNamesOf(rec);
  const clauses = (rec.tx||"").split(/\n+/).map(s=>P.clean(s)).filter(Boolean)
    .reduce((a,s)=>a.concat(s.split(/\.\s+/)),[]).map(s=>s.trim()).filter(Boolean).map(cl=>{
    const cll = cl.toLowerCase();
    const covered = HERO_STATICS.some(s=>s.re.test(cll))
      || (/(action|instant)/i.test(cl) && !!P.parseHeroPower(cl))
      || abRead.has(heroClauseKey(cl));
    return abilityNames.has(cl) ? {t:cl, covered, heading:true} : {t:cl, covered};
  });
  const flags = [];
  const uncovered = clauses.filter(c=>!c.covered);
  const named = uncovered.filter(c=>c.heading).length;
  if(uncovered.length) flags.push(`${uncovered.length} hero-text clause(s) not recognized by any ability reader`
    + (named ? ` (${named} of them the ability's printed NAME, not a rule)` : ""));
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
    for(const cl of hr.clauses.filter(c=>!c.covered))
      L.push(`- ⚠ unrecognized: "${cl.t}"`
        + (cl.heading ? "  _(the ability's printed NAME — a heading, not a rule)_" : ""));
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

/* ONE COPY OF "IS THIS HERO CLAUSE READ", TWO READERS (v3.71).
   `test/dorinthea.test.js` used to re-derive that test inline — the
   no-mirror rule broken between a drill and the tool it is auditing, and
   the drill was silently a version behind the moment the tool learned to
   ask `fxParse` about the ability's riders. Exported instead, behind a
   `require.main` guard so requiring this file audits nothing. */
if(require.main === module) main().catch(e=>{ console.error(e); process.exit(1); });
module.exports = {analyzeHero, HERO_STATICS, heroClauseKey, abilityNamesOf, isLedgerKeyword};
