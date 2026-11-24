#!/usr/bin/env node
/* tools/perf-practice.js — PRACTICE WHILE WAITING, TIMED AT 4x CPU THROTTLE (O, 2026-11-24). NOT part of `npm test`.
   PAGE_DEPS=<scratch> NODE_PATH=<playwright> node tools/perf-practice.js [taps=120] [--throttle 4]
   The real page (tools/page.js open(), the referee faked in this process with a seek queue) plays the SAME seeded trainer game three ways:
     none    no search at all (Battle from the lobby: the baseline)
     hb20    Find a match -> Play the AI while you wait, the search heartbeating at its real 20 s pace
     hb2     the same with the heartbeat every 2 s (10x the real rate (2 s is the least the page accepts), so a short run still lands several beats: a stress, not a phone's day)
   Per tap it records the main-thread time (CDP TaskDuration, tap to tap) and the page's own long tasks (>50 ms, PerformanceObserver); per run it
   counts DOM mutation batches (a re-render storm on every heartbeat would show here) and, on the quiet practice grid, the cost of a lone beat.
   Prints p50 / p95 / worst of the per-tap task time and the long-task list, so "with" and "without" can be set side by side. */
"use strict";
const { open } = require("./page.js");
const { makeWorld } = require("../test/helpers/servertransport.js");
const F = require("../test/helpers/serverfakes.js");
const { dealLikeThePage } = require("../test/helpers/pagedeal.js");
const TAPS = +process.argv[2] || 120, THR = (i => i >= 0 ? +process.argv[i + 1] : 4)(process.argv.indexOf("--throttle"));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const SHIM = `
  window.__srvN = 0; window.__srvSubs = {};
  window.__srvDeliver = (id, p) => { const s = window.__srvSubs[id]; if(s) s.fn(p); };
  window.__srvState = (id, st) => { const s = window.__srvSubs[id]; if(s && s.onState) s.onState(st); };
  window.__beatMs = null; window.__seeks = 0;
  window.__installFake = () => { window.__dawnServerTransport = {
    post: env => window.__srvPost("PAGE", JSON.stringify(env)).then(t => { const r = JSON.parse(t);
      if(env.op === "seek"){ window.__seeks++; if(window.__beatMs && r && r.beat) r.beat = window.__beatMs; } return r; }),
    subscribe(topic, fn, onState){ const id = ++window.__srvN; window.__srvSubs[id] = {fn, onState}; window.__srvSub("PAGE", topic, id);
      return () => { delete window.__srvSubs[id]; window.__srvUnsub(id); }; } }; };
`;
const RECORD = `
  window.__long = []; try { new PerformanceObserver(l => { for(const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({entryTypes: ["longtask"]}); } catch(_){}
  window.__mut = 0; new MutationObserver(m => { window.__mut++; }).observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
`;
async function wire(page, world){
  const unsubs = new Map();
  await page.exposeFunction("__srvPost", async (name, text) => JSON.stringify(await world.transport(name).post(JSON.parse(text))));
  await page.exposeFunction("__srvSub", (name, topic, id) => { unsubs.set(id, world.transport(name).subscribe(topic,
    p => page.evaluate(([i, q]) => window.__srvDeliver(i, q), [id, p]).catch(() => {}), st => page.evaluate(([i, s]) => window.__srvState(i, s), [id, st]).catch(() => {}))); });
  await page.exposeFunction("__srvUnsub", id => { const u = unsubs.get(id); if(u) u(); unsubs.delete(id); });
  await page.addInitScript(SHIM); await page.evaluate(SHIM); await page.evaluate(() => window.__installFake());
}
const CANDS = () => [...document.querySelectorAll("button")].map((b, i) => ({ b, i }))
  .filter(({ b }) => b.offsetParent && !b.disabled && !b.closest(".judgebtn") && !b.closest(".bugwrap") && !b.closest(".screennav") && !/^(leave|♪|♪̸)$/i.test(b.innerText.replace(/\s+/g, " ").trim()))
  .map(({ b, i }) => ({ i, t: b.innerText.replace(/\s+/g, " ").trim().slice(0, 40), tile: b.classList.contains("hc") || b.classList.contains("g") || b.classList.contains("b") }));

async function run(mode){
  const kit = await open({ w: 393, h: 852 }), page = kit.page;
  const build = await page.evaluate(() => TABLE_BUILD);
  const world = makeWorld({ seedKey: "perfprac-" + mode, build, deal: dealLikeThePage });
  await wire(page, world);
  const idp = F.memIdentity(), sk = F.withSeek(), rat = F.withRatings();
  world.deps.identify = t => idp.identify(t); world.deps.rename = (pl, n, f) => idp.rename(pl, n, f); Object.assign(world.deps, rat.deps(), sk.deps());
  const shim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(idp.issue("P-pp-a")) + ")};";
  await page.addInitScript(shim); await page.evaluate(shim); await page.addInitScript(RECORD); await page.evaluate(RECORD);
  await page.evaluate(() => { window.SERVER_TABLE.on = true; window.SERVER_TABLE.quietMs = 1500; });
  const cdp = await kit.context.newCDPSession(page); await cdp.send("Performance.enable");
  const taskMs = async () => ((await cdp.send("Performance.getMetrics")).metrics.find(x => x.name === "TaskDuration") || {}).value * 1000;
  const out = { mode, quiet: null };
  if(mode !== "none"){
    await page.evaluate(b => { window.__beatMs = b; }, mode === "hb2" ? 2000 : null);
    await page.getByRole("button", { name: /^Find an opponent/ }).click(); await page.waitForSelector(".tblwrap");
    await page.locator('[data-testid="seek-open"]').click();
    await page.waitForSelector('[data-testid="seek-play-ai"]', { timeout: 15000 });
    await page.locator('[data-testid="seek-play-ai"]').click(); await page.waitForSelector('[data-testid="wait-bar"]');
    /* the lone beat on the quiet practice grid, throttled: main-thread time per second of just waiting, and DOM batches */
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: THR });
    const s0 = await page.evaluate(() => window.__seeks), m0 = await page.evaluate(() => window.__mut), t0 = await taskMs(), w0 = Date.now();
    await wait(mode === "hb2" ? 9000 : 4000);
    const dt = (Date.now() - w0) / 1000, s1 = await page.evaluate(() => window.__seeks);
    out.quiet = { seconds: +dt.toFixed(1), seeks: s1 - s0, taskMsPerSec: +((await taskMs() - t0) / dt).toFixed(2), mutationBatches: (await page.evaluate(() => window.__mut)) - m0 };
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  /* the same seeded trainer game */
  const r = rng(77);
  await page.locator(".hcard").nth(3).click(); await page.locator("button", { hasText: /^Battle$/ }).first().click();
  await page.waitForSelector(".rps", { timeout: 8000 }); await page.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
  if(await page.locator(".rseatpick").count()) await page.locator(".rseatpick button").nth(Math.floor(r() * 2)).click();
  await page.waitForSelector('.lo .actbar [data-start="trainer"]'); await page.locator('.lo .actbar [data-start="trainer"]').click(); await page.waitForSelector(".board");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THR });
  await page.evaluate(() => { window.__long.length = 0; window.__mut = 0; });
  const per = [], seeks0 = await page.evaluate(() => window.__seeks), t00 = Date.now();
  for(let n = 0; n < TAPS; n++){
    if(await page.locator(".reveal").count()) break;
    const c = await page.evaluate(CANDS); if(!c.length){ await wait(200); n--; continue; }
    const pick = c[Math.floor(r() * c.length)], twice = pick.tile && r() < 0.75;
    const tap = () => page.evaluate(([i, t]) => { const b = document.querySelectorAll("button")[i]; if(b && b.innerText.replace(/\s+/g, " ").trim().slice(0, 40) === t) b.click(); }, [pick.i, pick.t]);
    const a = await taskMs(); await tap(); if(twice){ await wait(40); await tap(); } await wait(60);
    per.push(await taskMs() - a);
  }
  out.taps = per.length; out.seconds = +((Date.now() - t00) / 1000).toFixed(1); out.seeksDuringGame = (await page.evaluate(() => window.__seeks)) - seeks0;
  out.perTapMs = { p50: pct(per, 0.5), p95: pct(per, 0.95), worst: pct(per, 1) };
  out.longTasks = await page.evaluate(() => window.__long.slice().sort((a, b) => b - a)); out.domBatches = await page.evaluate(() => window.__mut);
  /* the banner: a match arrives mid-practice (a second seeker through the same queue) — the cost of showing it */
  if(mode !== "none"){
    await page.evaluate(() => { window.__long.length = 0; });
    const t1 = await taskMs();
    try { const PH = require("../test/helpers/serverphone.js"), T = require("../test/helpers/judgetable.js");
      const B = PH.makePhone(world, "B", { hero: "dorinthea", rand: T.seeded("pp"), build, matchCatalog: s => require("../test/helpers/pagedeal.js").matchCatalog(s, 0), throws: [["rock", "rock"], ["paper", "rock"]] });
      const r = await world.transport("B").post({ op: "seek", identity: { token: idp.issue("P-pp-b") } });
      if(r && r.table) await B.connect("join", r.table); else out.bannerErr = JSON.stringify(r).slice(0, 80); } catch(e){ out.bannerErr = String(e.message).slice(0, 120); }
    await page.waitForSelector('[data-testid="match-ready"]', { timeout: 25000 }).then(() => { out.banner = "shown"; }, () => { out.banner = "not shown in 25 s"; });
    out.bannerTaskMs = +((await taskMs() - t1)).toFixed(1); out.bannerLongTasks = await page.evaluate(() => window.__long.slice());
  }
  void out.errors; out.pageErrors = kit.errors.filter(e => !/404|Failed to load resource/.test(e)).length;
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await kit.close();
  return out;
}
(async () => {
  console.log("throttle " + THR + "x, " + TAPS + " taps of the same seeded trainer game per run\n");
  for(const m of ["none", "hb20", "hb2"]) console.log(JSON.stringify(await run(m)), "\n");
})().catch(e => { console.error(e); process.exit(1); });
