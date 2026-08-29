const {match, play, W} = require("./selfplay.js");
const keys = W.HEROES.map(h => h.k);
/* An empty argument means "all of them" — "".split(",") is [""], which
   would silently run zero games and report a clean sweep by finding
   nothing, the failure mode this repo names most often. */
const list = a => (a && a.trim()) ? a.split(",").map(x => x.trim()).filter(Boolean) : keys;
const A = list(process.argv[2]);
const B = list(process.argv[3]);
const SEEDS = +(process.argv[4] || 1);

const wins = {}, games = [];
let refusals = [], viols = [], evts = {}, malformed = [], stalls = 0, turnsum = 0, n = 0;
for(const a of A) for(const b of B){
  if(a === b) continue;
  for(let s = 0; s < SEEDS; s++){
    const seed = `${a}-${b}-${s}`;
    let r;
    try { r = play(match(a, b, seed, s % 2)); }
    catch(e){ malformed.push({seed, throw: e.message}); continue; }
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
    for(const [k, line] of r.events){ (evts[k] = evts[k] || []).push(line); if(k==="MALFORMED") malformed.push({seed, line}); }
  }
}
console.log(`GAMES ${n} · stalls ${stalls} · avg turns ${(turnsum/Math.max(1,n)).toFixed(1)}`);
console.log(`POLICY REFUSALS ${refusals.length} · INVARIANT VIOLATIONS ${viols.length} · MALFORMED FEED ${malformed.length}`);
console.log("\nWINS:", Object.entries(wins).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${k} ${v}`).join(" · "));
const bad = games.filter(g => g.result === "STALL");
if(bad.length) console.log("\nSTALLS:", JSON.stringify(bad.slice(0,6)));
if(refusals.length) console.log("\nREFUSALS (first 8):", JSON.stringify(refusals.slice(0,8), null, 1));
if(viols.length)    console.log("\nVIOLATIONS (first 8):", JSON.stringify(viols.slice(0,8), null, 1));
if(malformed.length)console.log("\nMALFORMED (first 8):", JSON.stringify(malformed.slice(0,8), null, 1));
console.log("\nROUTE COVERAGE (times a feed line matched):");
for(const k of ["tap","ally","death","gold","crush"])
  console.log(`  ${k.padEnd(7)} ${(evts[k]||[]).length}`);
for(const k of ["tap","ally","death","gold"]){
  const u = [...new Set(evts[k]||[])].slice(0,4);
  if(u.length) console.log(`  e.g. ${k}: ` + u.join(" | ").slice(0,220));
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
