const {match, play, W, FAULTS, summaryLine, routeNames} = require("./selfplay.js");

const keys = W.HEROES.map(h => h.k);
/* An empty argument means "all of them" — "".split(",") is [""], which
   would silently run zero games and report a clean sweep by finding
   nothing, the failure mode this repo names most often. */
const list = a => (a && a.trim()) ? a.split(",").map(x => x.trim()).filter(Boolean) : keys;
const A = list(process.argv[2]);
const B = list(process.argv[3]);
const SEEDS = +(process.argv[4] || 1);

const wins = {}, games = [];
let refusals = [], viols = [], evts = {}, stalls = 0, turnsum = 0, n = 0;
/* KEYED BY FAULT KIND, from `selfplay.js`'s own census — never a bucket
   per fault declared here, which is the shape that let SECOND-PERSON be
   reported as a route (v4.17). */
const faults = Object.fromEntries(FAULTS.map(k => [k, []]));
for(const a of A) for(const b of B){
  if(a === b) continue;
  for(let s = 0; s < SEEDS; s++){
    const seed = `${a}-${b}-${s}`;
    let r;
    try { r = play(match(a, b, seed, s % 2)); }
    /* A THROWN GAME IS A MALFORMED ONE. It is filed by the same name so
       the summary counts it beside the feed lines. */
    catch(e){ faults.MALFORMED.push({seed, throw: e.message}); continue; }
    n++;
    const over = r.game.over;
    if(!over){ stalls++; games.push({seed, a, b, result: "STALL", turn: r.game.turn, steps: r.steps}); }
    else {
      const w = over.winner === 0 ? a : b;
      wins[w] = (wins[w] || 0) + 1;
      turnsum += r.game.turn;
      games.push({seed, a, b, win: w, how: over.how, turn: r.game.turn, steps: r.steps,
                  hp: r.game.sides.map(x => x.hp)});
    }
    for(const e of r.errs)  refusals.push({seed, ...e});
    for(const v of r.viols) viols.push({seed, ...v});
    for(const [k, line] of r.events){ (evts[k] = evts[k] || []).push(line); if(faults[k]) faults[k].push({seed, line}); }
  }
}
console.log(`GAMES ${n} · stalls ${stalls} · avg turns ${(turnsum/Math.max(1,n)).toFixed(1)}`);
console.log(summaryLine(refusals, viols, faults));
console.log("\nWINS:", Object.entries(wins).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${k} ${v}`).join(" · "));
const bad = games.filter(g => g.result === "STALL");
if(bad.length) console.log("\nSTALLS:", JSON.stringify(bad.slice(0,6)));
if(refusals.length) console.log("\nREFUSALS (first 8):", JSON.stringify(refusals.slice(0,8), null, 1));
if(viols.length)    console.log("\nVIOLATIONS (first 8):", JSON.stringify(viols.slice(0,8), null, 1));
for(const k of FAULTS)
  if(faults[k].length) console.log(`\n${k} (first 8):`, JSON.stringify(faults[k].slice(0,8), null, 1));
/* THE ROUTE LIST IS DERIVED, NEVER TYPED (v4.03). It was
   ["tap","ally","death","gold","crush"] — a hardcoded list in the REPORT
   while the counters live in `selfplay.js`, so a route counted there and
   not named here reports NOTHING and reads exactly like a route that
   never fires. That is v3.35's `PENDING_KINDS` blacklist in a third
   consumer, and it bit immediately: v4.03's `reaction` and `layer`
   counters were added, fired thousands of times, and printed nowhere.

   THE FAULTS ARE EXCLUDED BECAUSE THEY ARE FAULTS, and each has its own
   block above. That exclusion was itself a hardcoded list of ONE until
   v4.17 — the same defect this comment describes, on the other half of
   the same split — so it reads `selfplay.js`'s census instead. */
const ROUTES = routeNames(evts);
console.log("\nROUTE COVERAGE (times a feed line matched):");
for(const k of ROUTES)
  console.log(`  ${k.padEnd(9)} ${(evts[k]||[]).length}`);
for(const k of ROUTES){
  const u = [...new Set(evts[k]||[])].slice(0,3);
  if(u.length) console.log(`  e.g. ${k}: ` + u.join(" | ").slice(0,200));
}
const longest = games.filter(g=>g.turn).sort((a,b)=>b.turn-a.turn)[0];
const shortest= games.filter(g=>g.turn).sort((a,b)=>a.turn-b.turn)[0];
console.log(`\nlongest ${longest&&longest.turn} turns (${longest&&longest.seed}) · shortest ${shortest&&shortest.turn} (${shortest&&shortest.seed})`);
/* THE REPORT SURVIVES A FRESH CLONE. `tools/.cache/` is gitignored, so on
   a clone that has never run `npm run audit --refresh` this directory does
   not exist — and this write threw ENOENT *after* the whole 210-game run
   had finished and printed. Four minutes of work, the summary on screen,
   and the machine-readable half lost to a missing mkdir. Same family as
   the skip count nobody read: the tool did its job and the failure was in
   the reporting. */
const _fs = require("fs"), _path = require("path");
const _out = _path.join(__dirname, "..", "tools", ".cache");
_fs.mkdirSync(_out, {recursive: true});
_fs.writeFileSync(_path.join(_out, "games.json"), JSON.stringify({games, refusals, viols, evts:Object.fromEntries(Object.entries(evts).map(([k,v])=>[k,[...new Set(v)].slice(0,40)]))}, null, 1));
