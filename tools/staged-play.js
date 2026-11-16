#!/usr/bin/env node
/* ============================================================
   tools/staged-play.js — A STAGED HERO, SEATED (v6.44)

   ROADMAP-NEWDECKS.md, Phase 2: "The hero stays out of the loadout until
   the census prints no gap for his list and 630 self-play games with him
   seated show 0 refusals, 0 violations, 0 stalls." The ladder
   (`tools/tourney.js`) seats only heroes the page deals, so this is the
   instrument for the second half of that sentence.

   IT BUILDS NOTHING THE PAGE LOADS. The deck is `data/newsets.json`'s list
   (names, print codes, quantities), the text is `data/staged.js`, and the
   judge's database is the pool PLUS the staged records for the length of
   this process only.

   THE DECK STRING is the page's own format (`game.parseDeck`): every weapon
   and equipment row is gear, every other Arena / Deck / Inventory row is a
   deck card, which is how the fifteen dealt lists are written. Tokens
   (Extras) are not dealt.

       node tools/staged-play.js                         # Viserai v all 15, both chairs, 1 seed
       node tools/staged-play.js viseraiBetweenWorlds 3  # 3 seeds: 90 games
       node tools/staged-play.js viseraiBetweenWorlds 21 kayo,boltyn

   Read refusals, violations and stalls first; all three must be 0. A MEASURING
   INSTRUMENT, not a drill: what it proves that should stay proven goes in test/.
   ============================================================ */
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const X = require("../test/helpers/extract.js");
const SPL = require("./selfplay.js");
const {play, W, J, ladderLine, summaryLine, FAULTS} = SPL;

const NEW = require("../data/newsets.json");
const STAGED = require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard);
const DB = C.buildMaps(X.readPool().filter(c => c && c.name).map(C.mapDbCard).concat(STAGED));
const SDB = C.buildMaps(STAGED);

/* the list as a deck string, and the hero entry `buildSide` wants */
function stagedDeck(key){
  const d = NEW[key];
  if(!d || !d.sections) throw new Error("no staged list named " + key + " (have: "
    + Object.keys(NEW).filter(k => NEW[k] && NEW[k].sections).join(", ") + ")");
  const lines = [], gear = [], deck = [];
  let heroCode = null;
  for(const [sec, s] of Object.entries(d.sections)){
    if(sec === "Extras") continue;
    for(const r of s.rows){
      if(r.name === d.hero){ heroCode = r.code; continue; }
      const rc = C.resolveEntry(SDB, {name: r.name, p: r.p || 0, code: r.code, q: r.q});
      if(!rc.resolved) throw new Error("staged row does not resolve: " + r.name + " " + r.code);
      const isGear = (rc.ty || []).some(t => /^(equipment|weapon)$/i.test(String(t)));
      if(isGear) for(let i = 0; i < (r.q || 1); i++) gear.push(`G|${rc.name}|0|${r.code}`);
      else deck.push(`${r.q || 1}|${rc.name}|${rc.pitch || 0}|${r.code}`);
    }
  }
  lines.push(`H|${d.hero}|0|${heroCode}`, ...gear, ...deck);
  return {raw: lines.join("\n"),
          hero: {k: key, n: d.hero.split(",")[0], code: heroCode, cls: "", ch: 0, blurb: ""}};
}

function match(st, k, seed, stagedSeat, first){
  const h = W.HEROES.find(x => x.k === k);
  const ctr = {n: 0};
  let rng = RNG.make(seed);
  const mk = (hero, raw) => { const b = B.buildSideDefault(hero, G.parseDeck(raw), DB, rng, ctr); rng = b.rng; return b.b; };
  const builds = stagedSeat === 0 ? [mk(st.hero, st.raw), mk(h, W.DECKS[h.k])]
                                  : [mk(h, W.DECKS[h.k]), mk(st.hero, st.raw)];
  const names = stagedSeat === 0 ? [st.hero.n, h.n] : [h.n, st.hero.n];
  return J.newMatch({builds, names, heroKeys: stagedSeat === 0 ? [st.hero.k, h.k] : [h.k, st.hero.k],
                     rng, first, tokSeq: ctr.n});
}

function run(key, seeds, foes){
  J.setDb(DB);
  const st = stagedDeck(key);
  const parsed = G.parseDeck(st.raw);
  const out = {key, games: 0, stalls: 0, draws: [], turnsum: 0, wins: 0, losses: 0, refusals: [], viols: [],
               faults: Object.fromEntries(FAULTS.map(k => [k, []])), back: 0, byFoe: {},
               deck: parsed.deck.reduce((a, e) => a + e.q, 0), gear: parsed.gear.length};
  for(const k of foes) for(const seat of [0, 1]) for(let s = 0; s < seeds; s++){
    const seed = `${key}-${k}-${seat}-${s}`;
    let r;
    try { r = play(match(st, k, seed, seat, s % 2)); }
    catch(e){ out.faults.MALFORMED.push({seed, throw: e.message, at: String(e.stack || "").split("\n")[1]}); continue; }
    out.games++;
    const over = r.game.over, row = out.byFoe[k] = out.byFoe[k] || {w: 0, l: 0, d: 0, stall: 0};
    if(!over){ out.stalls++; row.stall++; }
    else if(over.winner == null){ out.draws.push(seed); out.turnsum += r.game.turn; row.d++; }
    else { out.turnsum += r.game.turn; if(over.winner === seat){ out.wins++; row.w++; } else { out.losses++; row.l++; } }
    /* DID THE MECHANIC HAPPEN? A clean sweep that never turned the hero over
       has measured nothing about traverse. The build remembers the face it
       left, so this counts games that ENDED on the other face (the feed is
       capped and cannot be counted). */
    if((r.game.builds[seat] || {})._face) out.back++;
    for(const e of r.errs)  out.refusals.push({seed, ...e});
    for(const v of r.viols) out.viols.push({seed, ...v});
    for(const [f, line] of r.events) if(out.faults[f]) out.faults[f].push({seed, line});
  }
  return out;
}

if(require.main === module){
  const key = process.argv[2] || "viseraiBetweenWorlds";
  const seeds = +(process.argv[3] || 1);
  const foes = (process.argv[4] || "").split(",").map(x => x.trim()).filter(Boolean);
  const o = run(key, seeds, foes.length ? foes : W.HEROES.map(h => h.k));
  console.log(`${NEW[key].hero}: ${o.deck} deck cards, ${o.gear} gear rows`);
  console.log(ladderLine(o.games, o.stalls, o.draws, o.turnsum));
  console.log(summaryLine(o.refusals, o.viols, o.faults));
  console.log(`record: ${o.wins} won · ${o.losses} lost · ${o.draws.length} drawn · ${o.stalls} stalled`);
  console.log(`games that ended on the hero's other face: ${o.back} of ${o.games}`);
  console.log("by opponent:", Object.entries(o.byFoe).map(([k, v]) => `${k} ${v.w}-${v.l}${v.d ? "-" + v.d + "d" : ""}${v.stall ? " STALL×" + v.stall : ""}`).join(" · "));
  const show = (label, rows) => { if(rows.length){ console.log(`\n${label} (${rows.length}), first 12:`); rows.slice(0, 12).forEach(x => console.log("  " + JSON.stringify(x).slice(0, 400))); } };
  show("POLICY REFUSALS", o.refusals);
  show("INVARIANT VIOLATIONS", o.viols);
  for(const f of FAULTS) show(f, o.faults[f]);
  process.exit(o.refusals.length || o.viols.length || o.stalls || o.faults.MALFORMED.length ? 1 : 0);
}
module.exports = {stagedDeck, match, run, DB};
