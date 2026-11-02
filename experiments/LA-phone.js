/* LOOKAHEAD phase 2: what a searched decision costs ON THE REAL PAGE, at
   phone speed.
     NODE_PATH=$(npm root -g) node experiments/LA-phone.js [settings] [throttle] [n]
       settings  comma list of horizon/budget, default "own/2400,own/600,own/300,opp/600,opp/300"
       throttle  Chromium CPU throttling rate (CDP Emulation.setCPUThrottlingRate), default 4
       n         positions, default 300
   Positions come from node self-play (every hero, search on in both seats,
   every 8th decision the search actually ran on: 2+ distinct starts at an action point).
   Each is JSON round-tripped (lossless for game state; checked on the way:
   node's choice on the copy must equal its choice on the original) and
   handed to the page that tools/page.js opens: index.html and engine/*.js
   byte for byte. In the page, `DawnSparring.act(g, seat, {search: true})`
   is timed with performance.now() after one warm-up pass. Reports p50 /
   p95 / worst ms and engine steps per decision for each setting.
   Run it on an IDLE machine: a parallel A/B steals the cores it measures. */
const path = require("path");
const ROOT = path.join(__dirname, "..");
const {match, W, SP, J} = require(path.join(ROOT, "tools/selfplay.js"));
const {open} = require(path.join(ROOT, "tools/page.js"));
const SETTINGS = (process.argv[2] || "own/2400,own/600,own/300,opp/600,opp/300").split(",").map(s => s.split("/"));
const RATE = +(process.argv[3] || 4), N = +(process.argv[4] || 300);

function positions(){
  const keys = W.HEROES.map(h => h.k), out = [];
  SP.LA.horizon = "own"; SP.LA.budget = 2400;
  for(let gi = 0; out.length < N && gi < 400; gi++){
    const a = keys[gi % keys.length], b = keys[(gi + 1 + Math.floor(gi / keys.length)) % keys.length];
    if(a === b) continue;
    let g = match(a, b, `${a}-${b}-ph${gi}`, gi % 2), k = 0;
    for(let i = 0; i < 4000 && !g.over; i++){
      let act = null, s, searched = false;
      for(s of [0, 1]){ const n0 = SP.LA.stats.searched; act = SP.act(g, s, {search: true}); searched = SP.LA.stats.searched > n0; if(act) break; }
      if(!act) break;
      const sd = g.sides[s];
      if(searched && (k++ % 8 === 0)){
        const js = JSON.stringify(g), back = SP.act(JSON.parse(js), s, {search: true});
        if(JSON.stringify(back) === JSON.stringify(act)) out.push({js, seat: s, hero: sd.heroKey});
      }
      const r = J.reduce(g, act, s); if(r.error) break; g = r.state;
    }
  }
  return out.slice(0, N);
}

const pct = (xs, p) => { const s = xs.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

(async () => {
  const P = positions();
  console.log(`${P.length} positions from ${new Set(P.map(p => p.hero)).size} heroes; throttle ${RATE}x`);
  const kit = await open({w: 393, h: 852});
  const {page} = kit;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", {rate: RATE});
  await page.evaluate(() => { window.__laP = []; });
  for(let i = 0; i < P.length; i += 20)
    await page.evaluate(chunk => { window.__laP.push(...chunk); }, P.slice(i, i + 20).map(p => [p.js, p.seat]));
  const rows = [];
  for(const [h, b] of SETTINGS){
    const r = await page.evaluate(([h, b]) => {
      const SPg = window.DawnSparring, LA = SPg.LA;
      LA.horizon = h; LA.budget = +b;
      const games = window.__laP.map(([js, s]) => [JSON.parse(js), s]);
      games.forEach(([g, s]) => SPg.act(g, s, {search: true}));          /* warm-up */
      const ms = [], steps = [];
      for(const [g, s] of games){
        const st0 = LA.stats.steps, t0 = performance.now();
        SPg.act(g, s, {search: true});
        ms.push(performance.now() - t0); steps.push(LA.stats.steps - st0);
      }
      return {ms, steps};
    }, [h, b]);
    const perStep = r.ms.reduce((x, y) => x + y, 0) / Math.max(1, r.steps.reduce((x, y) => x + y, 0));
    rows.push({setting: h + "/" + b, p50: +pct(r.ms, .5).toFixed(1), p95: +pct(r.ms, .95).toFixed(1), worst: +Math.max(...r.ms).toFixed(1),
               mean: +(r.ms.reduce((x, y) => x + y, 0) / r.ms.length).toFixed(1),
               steps50: pct(r.steps, .5), steps95: pct(r.steps, .95), stepsMax: Math.max(...r.steps), msPerStep: +perStep.toFixed(3)});
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  console.table(rows);
  kit.check();
  await kit.close();
})().catch(e => { console.error(e); process.exit(1); });
