// PHONE BOUND (v6.75): Sharp (DawnSparring.act {search:true}) timed on the REAL page at CPU throttle,
// on per-hero self-play positions from gen.js (own- and opp-turn decisions of the hero's seat).
// Per hero: p50 / p95 / worst ms, split own/opp, and the reason keys of the 3 slowest positions.
process.env.PAGE_DEPS = process.env.PAGE_DEPS || "/tmp/claude-0/-home-user-dawnblade-ai/fa3b2344-1f3c-53b3-b7f1-729f8e99311d/scratchpad/pagedeps";
const {open} = require("/home/user/dawnblade-ai/tools/page.js");
const fs = require("fs"), dir = process.argv[2], RATE = +(process.argv[3] || 4), only = process.argv[4];
(async () => {
  const kit = await open({w: 393, h: 852}); const {page} = kit;
  await page.waitForFunction(() => window.DawnSparring && window.DawnSparring.act, null, {timeout: 60000});
  const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", {rate: RATE});
  await page.evaluate(o => { const L = window.DawnSparring.LA; if(o.b) L.budget = o.b; if(o.k) L.dets = o.k; }, {b: +(process.env.XB || 0), k: +(process.env.XK || 0)});
  const heroes = fs.readdirSync(dir).filter(f => /^[a-z]+\.json$/.test(f)).map(f => f.slice(0, -5)).filter(h => !only || only.split(",").includes(h));
  const rows = [];
  for(const h of heroes){
    const pos = JSON.parse(fs.readFileSync(`${dir}/${h}.json`));
    const r = await page.evaluate(pos => { const SP = window.DawnSparring, out = [];
      for(const p of pos){ SP.act(p.g, p.seat, {search: true}); const t0 = performance.now(); SP.act(p.g, p.seat, {search: true});
        const ms = performance.now() - t0; let key = "?"; try { key = SP.explain(p.g, p.seat, {search: true}).key; } catch(e){}
        out.push({ms, side: p.side, key, turn: p.g.turn, step: p.g.step}); }
      return out; }, pos);
    const q = (a, f) => { const s = a.map(x => x.ms).sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(1) : null; };
    const worst = a => a.length ? +Math.max(...a.map(x => x.ms)).toFixed(1) : null;
    const own = r.filter(x => x.side === "own"), opp = r.filter(x => x.side === "opp");
    const slow = r.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(x => `${x.ms.toFixed(0)}ms ${x.side} ${x.key} ${x.step}`);
    const row = {h, n: r.length, p50: q(r, .5), p95: q(r, .95), worst: worst(r), ownP95: q(own, .95), ownWorst: worst(own), oppP95: q(opp, .95), oppWorst: worst(opp), slow};
    rows.push(row); console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${dir}/times-x${RATE}-${process.env.TAG || "base"}.json`, JSON.stringify(rows, null, 1));
  await kit.close();
})().catch(e => { console.error(e); process.exit(1); });
