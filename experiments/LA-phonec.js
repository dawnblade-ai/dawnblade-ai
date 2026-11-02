/* LOOKAHEAD phase (c): what each SEARCHED decision type costs on the real page
   at phone speed.
     NODE_PATH=... node experiments/LA-phonec.js [throttle] [nPerType] [envJSON]
   envJSON: LA settings applied in node AND in the page, e.g. '{"blocks":1,"arsenal":1}'.
   Positions: node self-play, every hero, search on in both seats; a position
   counts for a type when the search actually ran there (action / block /
   arsenal), every 4th one. Each is JSON round-tripped and node's choice on the
   copy must equal its choice on the original. The page (tools/page.js:
   index.html and engine/*.js byte for byte) times `DawnSparring.act(g, seat,
   {search: true})` after one warm-up pass. */
const path = require("path");
const ROOT = path.join(__dirname, "..");
const {match, W, SP, J} = require(path.join(ROOT, "tools/selfplay.js"));
const {open} = require(path.join(ROOT, "tools/page.js"));
const RATE = +(process.argv[2] || 4), N = +(process.argv[3] || 200), SET = JSON.parse(process.argv[4] || "{}");
Object.assign(SP.LA, SET);
const typeOf = d => d.bSearched ? "block" : d.aSearched ? "arsenal" : "action";
function positions(){
  const keys = W.HEROES.map(h => h.k), out = {action: [], block: [], arsenal: []}, k = {action: 0, block: 0, arsenal: 0};
  const full = () => Object.keys(out).every(t => out[t].length >= N || (t === "block" && !SET.blocks) || (t === "arsenal" && !SET.arsenal));
  for(let gi = 0; !full() && gi < 600; gi++){
    const a = keys[gi % keys.length], b = keys[(gi + 1 + Math.floor(gi / keys.length)) % keys.length];
    if(a === b) continue;
    let g = match(a, b, `${a}-${b}-phc${gi}`, gi % 2);
    for(let i = 0; i < 4000 && !g.over; i++){
      let act = null, s, d = null;
      for(s of [0, 1]){ const st = {...SP.LA.stats}; act = SP.act(g, s, {search: true});
        if(SP.LA.stats.searched > st.searched) d = {bSearched: (SP.LA.stats.bSearched || 0) - (st.bSearched || 0), aSearched: (SP.LA.stats.aSearched || 0) - (st.aSearched || 0)};
        if(act || d) break; }
      if(d){ const t = typeOf(d);
        if(out[t].length < N && (k[t]++ % 4 === 0)){
          const js = JSON.stringify(g), back = SP.act(JSON.parse(js), s, {search: true});
          if(JSON.stringify(back) === JSON.stringify(act)) out[t].push({js, seat: s});
        } }
      if(!act){ /* the searched seat may stop blocking with no action: let the other seat move */
        let moved = false;
        for(const s2 of [0, 1]){ const a2 = SP.act(g, s2, {search: true}); if(!a2) continue; const r = J.reduce(g, a2, s2); if(r.error) continue; g = r.state; moved = true; break; }
        if(!moved) break; continue; }
      const r = J.reduce(g, act, s); if(r.error) break; g = r.state;
    }
  }
  return out;
}
const pct = (xs, p) => { const s = xs.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
(async () => {
  const P = positions();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(P).map(([t, v]) => [t, v.length]))) + " positions; throttle " + RATE + "x; " + JSON.stringify(SET));
  const kit = await open({w: 393, h: 852});
  const {page} = kit;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", {rate: RATE});
  const rows = [];
  for(const [t, list] of Object.entries(P)){
    if(!list.length) continue;
    await page.evaluate(() => { window.__laP = []; });
    for(let i = 0; i < list.length; i += 20)
      await page.evaluate(chunk => { window.__laP.push(...chunk); }, list.slice(i, i + 20).map(p => [p.js, p.seat]));
    const r = await page.evaluate(set => {
      const SPg = window.DawnSparring, LA = SPg.LA; Object.assign(LA, set);
      const games = window.__laP.map(([js, s]) => [JSON.parse(js), s]);
      games.forEach(([g, s]) => SPg.act(g, s, {search: true}));
      const ms = [], steps = [];
      for(const [g, s] of window.__laP.map(([js, s]) => [JSON.parse(js), s])){
        const st0 = LA.stats.steps, t0 = performance.now();
        SPg.act(g, s, {search: true});
        ms.push(performance.now() - t0); steps.push(LA.stats.steps - st0);
      }
      return {ms, steps};
    }, SET);
    rows.push({type: t, n: list.length, p50: +pct(r.ms, .5).toFixed(1), p95: +pct(r.ms, .95).toFixed(1), worst: +Math.max(...r.ms).toFixed(1),
               steps50: pct(r.steps, .5), steps95: pct(r.steps, .95), stepsMax: Math.max(...r.steps),
               msPerStep: +(r.ms.reduce((x, y) => x + y, 0) / Math.max(1, r.steps.reduce((x, y) => x + y, 0))).toFixed(3)});
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  console.table(rows);
  kit.check();
  await kit.close();
})().catch(e => { console.error(e); process.exit(1); });
