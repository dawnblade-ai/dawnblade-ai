#!/usr/bin/env node
/* tools/perf-live.js — WHERE THE TIME GOES in a real game against the deployed function (PERF, 2026-11-14). Publishable key only.
   SBJS=<dir with node_modules/@supabase/supabase-js> NODE_USE_ENV_PROXY=1 node tools/perf-live.js [kayo,dash] [maxActions] [thinkMs]
   Two engine/servertable.js phones play through supabaseTransport's own wire; this wrapper records, per request, the client's
   wall time, the function's Server-Timing / x-table-meta headers, bytes, and per push the arrival time next to the POST answer
   that caused it. `thinkMs` is a pause BEFORE each action (a person thinking), so cold instances show. Prints a JSON summary.
   NOT part of `npm test`. */
const R0 = require("path").join(__dirname, "..") + "/";
const ST = require(R0 + "engine/servertable.js");
const PH = require(R0 + "test/helpers/serverphone.js");
const {dealLikeThePage, matchCatalog} = require(R0 + "test/helpers/pagedeal.js");
const SB = require(process.env.SBJS + "/node_modules/@supabase/supabase-js");
const URL = "https://fokcpzplomjsraquaaid.supabase.co", KEY = "sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu";
const HEROES = (process.argv[2] || "kayo,dash").split(","), CAP = +process.argv[3] || 120, THINK = +process.argv[4] || 0;
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const parseST = h => { const o = {}; for(const m of String(h || "").matchAll(/(\w+);dur=([\d.]+)/g)) o[m[1]] = +m[2]; return o; };
const parseMeta = h => { const o = {}; for(const m of String(h || "").matchAll(/(\w+)=([^;]+)/g)) o[m[1]] = m[2]; return o; };
const reqs = [], pushes = [];
let phase = "lobby", actNo = 0;
function transport(name){
  const real = ST.supabaseTransport({url: URL, key: KEY, fn: "table", lib: SB, fetch: (u, i) => fetch(u, i)});
  return {
    async post(env){
      const t0 = performance.now(), up = JSON.stringify(env).length;
      const resp = await fetch(URL + "/functions/v1/table", {method: "POST", headers: {"content-type": "application/json", apikey: KEY}, body: JSON.stringify(env)});
      const text = await resp.text(), t1 = performance.now();
      const ans = JSON.parse(text);
      reqs.push({name, phase, act: actNo, op: env.op, mt: env.frame && env.frame.m && env.frame.m.t, ms: t1 - t0, t0, t1, up, down: text.length, ok: ans.ok, refused: ans.refused, ver: ans.version,
        st: parseST(resp.headers.get("server-timing")), meta: parseMeta(resp.headers.get("x-table-meta")), envoy: +resp.headers.get("x-envoy-upstream-service-time") || null, status: resp.status});
      return ans;
    },
    subscribe(topic, fn, onState){ return real.subscribe(topic, p => { pushes.push({name, t: performance.now(), ver: p && p.ver, bytes: JSON.stringify(p).length}); fn(p); }, onState); }
  };
}
(async () => {
  const world = {errors: [], deps: {deal: spec => dealLikeThePage(spec, 0)}, transport,
    settle: async (hs, quiet) => { quiet = quiet || 300; const t0 = Date.now(); let last = Date.now(), n = reqs.length, np = pushes.length;
      for(;;){ await wait(25); if(reqs.length !== n || pushes.length !== np){ n = reqs.length; np = pushes.length; last = Date.now(); }
        const busy = (hs || []).some(h => h && h.status() !== "closed" && h.pending() > 0);
        if(!busy && Date.now() - last >= quiet) return; if(Date.now() - t0 > 30000) return; } }};
  const health = await (await fetch(URL + "/functions/v1/table", {headers: {apikey: KEY}})).json();
  const tl = Date.now();
  const {A, B} = await PH.seatTwo(world, HEROES, "perf" + Date.now(), {phone: {matchCatalog: s => matchCatalog(s, 0), build: health.build}});
  while(!(A.sess && B.sess && A.sess.status() === "ready" && B.sess.status() === "ready") && Date.now() - tl < 90000) await wait(50);
  const lobbyMs = Date.now() - tl; await world.settle([A.ch, B.ch], 800);
  const lobbyReqs = reqs.length; phase = "game";
  const acts = [];
  while(actNo < CAP){
    if(THINK) await wait(THINK * (0.5 + Math.random()));
    actNo++; const ta = performance.now(), np = pushes.length, nr = reqs.length;
    const r = await PH.step(world, [A, B]); if(!r){ actNo--; break; }
    acts.push({act: actNo, seat: r.seat, ms: performance.now() - ta, reqs: reqs.length - nr, pushes: pushes.length - np});
  }
  await world.settle([A.ch, B.ch], 800);
  /* push latency: for each write answer (ver v from request by name X), the push with ver v received by the OTHER name */
  const lat = []; const byVer = new Map();
  for(const q of reqs) if(q.ok && q.ver != null && q.op === "frame") byVer.set(q.ver + "|" + q.name, q);
  for(const p of pushes){ for(const [k, q] of byVer){ const [v, nm] = k.split("|"); if(+v === p.ver && nm !== p.name){ lat.push({sendToPush: p.t - q.t0, answerToPush: p.t - q.t1, act: q.act, phase: q.phase}); } } }
  const g = reqs.filter(q => q.phase === "game"), lob = reqs.filter(q => q.phase === "lobby");
  const sm = (a, f) => ({median: pct(a.map(f), .5), p95: pct(a.map(f), .95), max: pct(a.map(f), 1)});
  const insts = {}; for(const q of reqs) if(q.meta.inst) insts[q.meta.inst] = (insts[q.meta.inst] || 0) + 1;
  const sum = {health, heroes: HEROES, thinkMs: THINK, lobbyMs, lobbyReqs, gameReqs: g.length, actions: acts.length,
    perActionMs: sm(acts, a => a.ms), reqsPerAction: acts.reduce((m, a) => (m[a.reqs] = (m[a.reqs] || 0) + 1, m), {}),
    client: sm(g, q => q.ms), server: {total: sm(g.filter(q => q.st.total != null), q => q.st.total), get: sm(g.filter(q => q.st.get != null), q => q.st.get), put: sm(g.filter(q => q.st.put), q => q.st.put),
      bc: sm(g.filter(q => q.st.bc), q => q.st.bc), app: sm(g.filter(q => q.st.app != null), q => q.st.app), ready: sm(g.filter(q => q.st.ready), q => q.st.ready)},
    overhead: sm(g.filter(q => q.st.total != null), q => q.ms - q.st.total), envoy: sm(g.filter(q => q.envoy), q => q.envoy),
    bytesUp: sm(g, q => q.up), bytesDown: sm(g, q => q.down), rowb: sm(g.filter(q => q.meta.rowb), q => +q.meta.rowb),
    cold: {requests: reqs.filter(q => q.meta.cold === "1").length, of: reqs.length, ms: reqs.filter(q => q.meta.cold === "1").map(q => Math.round(q.ms))}, instances: Object.keys(insts).length, perInstance: insts,
    refused: reqs.filter(q => !q.ok).reduce((m, q) => (m[q.refused] = (m[q.refused] || 0) + 1, m), {}),
    pushLatency: {sendToPush: sm(lat.filter(l => l.phase === "game"), l => l.sendToPush), answerToPush: sm(lat.filter(l => l.phase === "game"), l => l.answerToPush), n: lat.length,
      pushBeforeAnswer: lat.filter(l => l.answerToPush < 0).length},
    lobbyReq: sm(lob, q => q.ms)};
  console.log(JSON.stringify(sum, null, 1));
  require("fs").writeFileSync(process.env.PERF_OUT || "/tmp/claude-0/s/perf-last.json", JSON.stringify({reqs, pushes, acts, sum}));
  A.ch.close(); B.ch.close(); setTimeout(() => process.exit(0), 500);
})().catch(e => { console.log("CRASH " + (e && e.stack || e)); process.exit(1); });
