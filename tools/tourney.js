const {match, play, W, FAULTS, summaryLine, routeNames} = require("./selfplay.js");

const keys = W.HEROES.map(h => h.k);
/* An empty argument means "all of them" — "".split(",") is [""], which
   would silently run zero games and report a clean sweep by finding
   nothing, the failure mode this repo names most often. */
const list = a => (a && a.trim()) ? a.split(",").map(x => x.trim()).filter(Boolean) : keys;
const A = list(process.argv[2]);
const B = list(process.argv[3]);
const SEEDS = +(process.argv[4] || 1);

/* THE DISPERSION, AS A PURE FUNCTION so a drill can drive it with
   synthetic counts rather than 630 games — v4.17's rule, which moved
   `summaryLine` and `routeNames` out of this report for exactly this
   reason: a source slice rots where a rule moves. */
function seedRows(bySeed, names){
  return names.map(k => {
    const v = bySeed.map(w => w[k] || 0);
    const mean = v.reduce((x, y) => x + y, 0) / v.length;
    return {k, v, mean, spread: Math.max(...v) - Math.min(...v)};
  }).sort((x, y) => y.mean - x.mean);
}
/* THE BAND IS THE SPREADS' OWN MEDIAN AND MAX — never the mean of the
   spreads, which a single well-behaved hero drags toward zero, and never
   a figure carried over from another run. A band is an OBSERVATION of the
   samples in front of it or it is a claim (v4.39, one instrument over). */
function band(rows){
  const sp = rows.map(r => r.spread).sort((x, y) => x - y);
  return sp.length ? {min: sp[0], median: sp[Math.floor(sp.length / 2)], max: sp[sp.length - 1]}
                   : {min: 0, median: 0, max: 0};
}
if(require.main !== module) { module.exports = {seedRows, band}; return; }

const wins = {}, games = [];
/* PER SEED INDEX, NOT ONLY POOLED (v4.40). `SEEDS` has existed since this
   tool was written and every run POOLED its samples into one win count —
   so the instrument could take five samples of a hero and report their
   sum, with no dispersion anywhere in the output.

   That matters because a ladder is REPRODUCIBLE (the seed is derived from
   the pairing, so re-running gives the same answer) and is NOT REPEATABLE
   (a different seed gives a different answer). Measured over twelve
   identical ladders on an unchanged engine: a hero's win count moves by a
   MEDIAN of 6 and as much as 8 — Lyath ran 0 to 8, Dorinthea 19 to 27.
   Any engine change that alters which actions get proposed reshuffles
   every downstream draw, so a version-to-version comparison is a
   CROSS-SEED comparison and cannot resolve a difference smaller than that
   band. Pass a seed count and read the spread before calling a move real.

   Within one seed index the CHAIR is balanced — `first: s % 2` is fixed
   across the whole ladder and every hero is first-named exactly as often
   as it is second-named — so the per-index totals are comparable to each
   other. Across indices they are not, which is the point. */
const winsBySeed = Array.from({length: SEEDS}, () => ({}));
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
      winsBySeed[s][w] = (winsBySeed[s][w] || 0) + 1;
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

/* ---- THE BAND, WHEN THERE IS MORE THAN ONE SAMPLE ------------------
   A single number with no dispersion beside it invites a reader to treat
   a 5-win move as a finding. Printing the spread is the whole fix, and
   printing it ONLY when it was actually measured is the honest half — a
   band inferred from one sample would be a claim, not an observation. */
if(SEEDS > 1){
  const rows = seedRows(winsBySeed, keys.filter(k => A.includes(k) || B.includes(k)));
  console.log(`\nPER SEED (${SEEDS} samples of the same ladder — the engine never changed):`);
  console.log("  hero        " + rows[0].v.map((_, i) => `s${i}`.padStart(4)).join("") + "   mean  spread");
  for(const r of rows)
    console.log(`  ${r.k.padEnd(11)}${r.v.map(x => String(x).padStart(4)).join("")}  ${r.mean.toFixed(1).padStart(5)}  ${String(r.spread).padStart(5)}`);
  const bd = band(rows);
  console.log(`\n  NOISE BAND: min ${bd.min} · median ${bd.median} · MAX ${bd.max}`
    + `  — a version-to-version move smaller than this is not resolvable by one ladder.`);
} else {
  console.log("\n  ONE SAMPLE PER PAIRING. Measured over twelve identical ladders, a hero's"
    + "\n  count moves by a median of 6 and has been observed at 10 on an UNCHANGED"
    + "\n  engine — so a delta under that is not a finding. Re-run for the spread:"
    + "\n      npm run play '' '' 5");
}
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
