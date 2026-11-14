#!/usr/bin/env node
/* tools/perf-page.js — THE REAL PAGE AS ONE SEAT OF A SERVER TABLE, TIMED (PERF, 2026-11-14).
   PAGE_DEPS=<scratch> NODE_PATH=<playwright> SBJS=<scratch> NODE_USE_ENV_PROXY=1 node tools/perf-page.js live|fake [actions] [--throttle 4] [--nopush] [--post 200 --push 150]
   live: the page's own supabase-js/Realtime websocket goes through the egress proxy to the DEPLOYED function (page.js's `launch` option);
         the other seat is a scripted Node phone on the same function. fake: server/referee.js in this process, latency injected per
         post (--post ms) and per push (--push ms); --nopush drops every push to the page (what a phone does when Realtime never lands).
   Per move it prints: submit -> that seat sees its own commit, and submit -> the OTHER seat sees it, how the other seat got it (a websocket
   message first = push, else a resync/join POST), and the main-thread task time the page spent. NOT part of `npm test`. */
"use strict";
const { open } = require("./page.js");
const { makeWorld } = require("../test/helpers/servertransport.js");
const PH = require("../test/helpers/serverphone.js");
const T = require("../test/helpers/judgetable.js");
const ST = require("../engine/servertable.js");
const { dealLikeThePage, matchCatalog } = require("../test/helpers/pagedeal.js");
const MODE = process.argv[2] || "fake", arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? +process.argv[i + 1] : d; };
const CAP = +process.argv[3] || 40, THR = arg("--throttle", 4), NOPUSH = process.argv.includes("--nopush"), POST_MS = arg("--post", 0), PUSH_MS = arg("--push", 0);
const SAMPLE_AT = (process.env.SAMPLE_AT || "").split(",").filter(Boolean).map(Number);
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const URL = "https://fokcpzplomjsraquaaid.supabase.co", KEY = "sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu";

/* in-page recorder: every websocket message in, every function call out, and each change of the session's counter */
const RECORD = `
  window.__rec = {ws: [], fx: [], seq: [], subs: []};
  const WS = window.WebSocket; window.WebSocket = function(u, p){ const w = p ? new WS(u, p) : new WS(u); window.__rec.subs.push([Date.now(), "ws-new"]);
    w.addEventListener("open", () => window.__rec.subs.push([Date.now(), "ws-open"])); w.addEventListener("close", e => window.__rec.subs.push([Date.now(), "ws-close " + e.code]));
    w.addEventListener("message", e => { try { const m = JSON.parse(e.data); window.__rec.ws.push([Date.now(), m.topic, m.event, m.payload && m.payload.status || (m.payload && m.payload.event) || ""]); } catch(_){} }); return w; };
  window.WebSocket.prototype = WS.prototype; for(const k of ["CONNECTING","OPEN","CLOSING","CLOSED"]) window.WebSocket[k] = WS[k];
  const F = window.fetch; window.fetch = function(u, i){ if(!/functions\\/v1\\/table/.test(String(u))) return F.apply(this, arguments);
    let op = ""; try { const b = JSON.parse(i.body); op = b.op + (b.frame && b.frame.m ? ":" + b.frame.m.t : ""); } catch(_){} const t0 = Date.now();
    return F.apply(this, arguments).then(r => { window.__rec.fx.push([t0, Date.now(), op, r.status]); return r; }); };
  setInterval(() => { const s = window.__dawnTable && window.__dawnTable.session; if(!s) return; const q = s.seq(); const l = window.__rec.seq; if(!l.length || l[l.length - 1][1] !== q) l.push([Date.now(), q]); }, 5);
`;

(async () => {
  const live = MODE === "live";
  const kit = await open({ w: 393, h: 852, launch: live ? { proxy: { server: process.env.HTTPS_PROXY } } : null });
  const { page, context } = kit;
  page.on('console', m => { if(process.env.DEBUG_PERF) console.log('PAGE', m.type(), m.text().slice(0, 300)); }); page.on('request', r => { if(process.env.DEBUG_PERF && /supabase|jsdelivr/.test(r.url())) console.log('REQ', r.resourceType(), r.url().slice(0, 130)); }); page.on('requestfailed', r => { if(process.env.DEBUG_PERF) console.log('REQFAIL', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
  const cdp = await context.newCDPSession(page);
  await page.addInitScript(RECORD); await page.evaluate(RECORD);
  const build = await page.evaluate(() => TABLE_BUILD);
  let world, SBlib = null;
  const reqLog = [];
  if(live){
    await context.route(/supabase\.co/, r => r.continue());          /* registered last: wins over page.js's local answer */
    SBlib = require(process.env.SBJS + "/node_modules/@supabase/supabase-js");
    world = { errors: [], deps: {}, transport: name => { const real = ST.supabaseTransport({ url: URL, key: KEY, fn: "table", lib: SBlib, fetch: (u, i) => fetch(u, i) });
      return { post: async env => { const t0 = Date.now(); const a = await real.post(env); reqLog.push({ name, op: env.op, t0, t1: Date.now(), ver: a.version }); return a; }, subscribe: (t, f, s) => real.subscribe(t, f, s) }; } };
    await page.evaluate(() => { window.SERVER_TABLE.on = true; });
  } else {
    world = makeWorld({ seedKey: "perf", build, deal: dealLikeThePage });
    const base = world.transport;
    const unsubs = new Map();
    await page.exposeFunction("__srvPost", async (name, text) => { await wait(POST_MS / 2); const a = JSON.stringify(await base(name).post(JSON.parse(text))); await wait(POST_MS / 2); return a; });
    await page.exposeFunction("__srvSub", (name, topic, id) => { if(NOPUSH) setTimeout(() => page.evaluate(i => window.__srvState(i, "lost"), id).catch(() => {}), 50);   /* --nopush: the library never loaded, as in v6.26 browsers: the subscription reads lost, no push ever comes */
      unsubs.set(id, base(name).subscribe(topic,
      p => { if(NOPUSH) return; setTimeout(() => page.evaluate(([i, q]) => { window.__rec.ws.push([Date.now(), "fake", "push", ""]); window.__srvDeliver(i, q); }, [id, p]).catch(() => {}), PUSH_MS); },
      st => page.evaluate(([i, s]) => window.__srvState(i, s), [id, st]).catch(() => {}))); });
    await page.exposeFunction("__srvUnsub", id => { const u = unsubs.get(id); if(u) u(); unsubs.delete(id); });
    const SHIM = `window.__srvN = 0; window.__srvSubs = {}; window.__srvDeliver = (id, p) => { const s = window.__srvSubs[id]; if(s) s.fn(p); }; window.__srvState = (id, st) => { const s = window.__srvSubs[id]; if(s && s.onState) s.onState(st); };
      window.__dawnServerTransport = { post: env => { const t0 = Date.now(); const op = env.op + (env.frame && env.frame.m ? ":" + env.frame.m.t : ""); return window.__srvPost("PAGE", JSON.stringify(env)).then(t => { window.__rec.fx.push([t0, Date.now(), op, 200]); return JSON.parse(t); }); },
        subscribe(topic, fn, onState){ const id = ++window.__srvN; window.__srvSubs[id] = {fn, onState}; window.__srvSub("PAGE", topic, id); return () => { delete window.__srvSubs[id]; window.__srvUnsub(id); }; } };`;
    await page.evaluate(SHIM); await page.evaluate(() => { window.SERVER_TABLE.on = true; });
  }
  const deal = live ? s => dealLikeThePage(s, 0) : dealLikeThePage;
  const click = (loc) => loc.click({ timeout: 150000 });
  const btn = re => page.getByRole("button", { name: re });
  await click(btn(/^Find an opponent/)); await page.waitForSelector(".tblwrap");
  await click(btn(/^Join a server table/)); await click(btn(/^Open a server table/));
  await page.waitForSelector(".tblcode", { timeout: 90000 });
  const code = await page.evaluate(() => document.querySelector(".tblcode").innerText.trim());
  const rand = T.seeded("perfpage");
  const B = PH.makePhone(world, "B", { hero: "dorinthea", rand, build, matchCatalog: s => matchCatalog(s, 0), throws: [["rock", "rock"], ["paper", "rock"]] });
  const tl = Date.now();
  await B.connect("join", code);
  await page.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 90000 }).catch(async e => { console.log("lib " + (await page.evaluate(async () => { const o = {hasLib: !!window.supabase}; try { const c = window.supabase.createClient("https://fokcpzplomjsraquaaid.supabase.co", "sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu"); const ch = c.channel("table:ABCDEF:" + "0".repeat(64), {config: {broadcast: {self: false}}}); o.st = await new Promise(r => { ch.subscribe((s, e) => r(s + " " + (e && e.message))); setTimeout(() => r("t/o"), 6000); }); } catch(e){ o.err = String(e); } return JSON.stringify(o); })) + "\nSTUCK page text: " + (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300))) + "\nrec " + JSON.stringify(await page.evaluate(() => window.__rec)).slice(0, 1500) + "\nB " + JSON.stringify(B.ch.report())); throw e; });
  await click(page.locator(".lobhero", { hasText: /Blaze/ }).first()); await click(btn(/^Lock in/));
  await page.waitForSelector(".rthrows", { timeout: 90000 });
  await click(page.locator(".rthrows button", { hasText: /rock/i }));
  await wait(1500);
  await click(page.locator(".rthrows button", { hasText: /paper/i }));
  await page.waitForSelector(".rseatpick", { timeout: 90000 });
  await click(page.locator(".rseatpick button").first());
  await page.waitForFunction(() => /Lock the sideboard/i.test(document.body.innerText), null, { timeout: 90000 });
  await click(btn(/^Lock the sideboard/));
  await page.waitForSelector(".board", { timeout: 60000 });
  await page.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.state() != null, null, { timeout: 90000 });
  const lobbyMs = Date.now() - tl;
  console.log("lobby (incl. my own UI waits) to board: " + lobbyMs + " ms; subs " + JSON.stringify(await page.evaluate(() => window.__rec.subs)));
  /* throttle only for the measured part, so the lobby is not slowed */
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THR });
  await cdp.send("Performance.enable");
  const tasks = async () => { const m = (await cdp.send("Performance.getMetrics")).metrics; const g = n => (m.find(x => x.name === n) || {}).value || 0; return { task: g("TaskDuration"), script: g("ScriptDuration"), layout: g("LayoutDuration") + g("RecalcStyleDuration") }; };
  const pageSeq = () => page.evaluate(() => window.__dawnTable.session.seq());
  const pageMove = () => page.evaluate(() => { const s = window.__dawnTable.session; if(s.status() !== "ready") return false; const a = DawnSparring.act(s.state(), 0, { search: false }); if(!a) return false; window.__t_submit = Date.now(); return !s.submit(a); });
  const bSeqLog = []; let bLast = -1; const bWatch = setInterval(() => { const q = B.sess && B.sess.seq(); if(q !== bLast){ bLast = q; bSeqLog.push([Date.now(), q]); } }, 5);
  const rows = []; let n = 0, idle = 0;
  while(n < CAP && idle < 200){
    const m0 = await tasks(); const rec0 = await page.evaluate(() => ({ ws: window.__rec.ws.length, fx: window.__rec.fx.length }));
    let who = null, ts = 0, seq0 = await pageSeq(), bseq0 = B.sess.seq();
    ts = Date.now();
    if(await pageMove().catch(() => false)) who = "page";
    else if(B.sess.status() === "ready"){ const a = require("../engine/sparring.js").act(B.sess.state(), 1, { search: false }); if(a && !B.sess.submit(a)) who = "B"; }
    if(!who){ idle++; await wait(60); continue; } idle = 0;
    if(who === "page") ts = await page.evaluate(() => window.__t_submit);
    /* wait until both seats' counters moved (or 12 s) */
    const t0 = Date.now(); let tPage = null, tB = null;
    while(Date.now() - t0 < 45000 && (tPage == null || tB == null)){
      await wait(8);
      const pl = await page.evaluate(([s0, t]) => { const l = window.__rec.seq.filter(x => x[1] !== s0 && x[0] >= t - 5); return l.length ? l[0][0] : null; }, [seq0, ts]);
      if(pl != null) tPage = pl;
      const bl = bSeqLog.find(x => x[1] !== bseq0 && x[0] >= ts - 5); if(bl) tB = bl[0];
    }
    await wait(150);
    const m1 = await tasks(), rec = await page.evaluate(r0 => ({ ws: window.__rec.ws.slice(r0.ws), fx: window.__rec.fx.slice(r0.fx) }), rec0);
    n++;
    const own = who === "page" ? tPage : tB, other = who === "page" ? tB : tPage;
    const pushed = who === "B" ? rec.ws.filter(w => w[3] === "frame" || w[2] === "push") : [];
    const row = { n, who, ownMs: own && own - ts, otherMs: other && other - ts, pageTaskMs: +((m1.task - m0.task) * 1000).toFixed(0), pageScriptMs: +((m1.script - m0.script) * 1000).toFixed(0),
      via: who === "B" ? (rec.fx.length === 0 ? "push" : "poll: " + rec.fx.map(f => f[2]).join("+")) : "-", pagePosts: rec.fx.length };
    rows.push(row);
    if(n <= 6 || n % 10 === 0 || (row.otherMs == null || row.otherMs > 1500)) console.log(JSON.stringify(row));
    if(SAMPLE_AT.includes(n)) console.log("   sample@" + n + " " + JSON.stringify(row));
  }
  clearInterval(bWatch);
  const mine = rows.filter(r => r.who === "page"), theirs = rows.filter(r => r.who === "B");
  const sm = (a, f) => ({ n: a.length, median: pct(a.map(f).filter(x => x != null), .5), p95: pct(a.map(f).filter(x => x != null), .95), max: pct(a.map(f).filter(x => x != null), 1), missing: a.filter(x => f(x) == null).length });
  console.log("SUMMARY " + JSON.stringify({ mode: MODE, throttle: THR, nopush: NOPUSH, post: POST_MS, push: PUSH_MS, actions: rows.length,
    pageMoves: { ownSeesCommitMs: sm(mine, r => r.ownMs), otherSeesMs: sm(mine, r => r.otherMs), pageTaskMs: sm(mine, r => r.pageTaskMs) },
    bMoves: { bSelfMs: sm(theirs, r => r.ownMs), pageSeesMs: sm(theirs, r => r.otherMs), pageTaskMs: sm(theirs, r => r.pageTaskMs), viaPush: theirs.filter(r => /^push/.test(r.via)).length, viaOther: theirs.filter(r => !/^push/.test(r.via)).length },
    byQuarter: [0, 1, 2, 3].map(q => { const a = rows.slice(Math.floor(rows.length * q / 4), Math.floor(rows.length * (q + 1) / 4)); return { from: a[0] && a[0].n, taskMs: pct(a.map(r => r.pageTaskMs), .5) }; }) }));
  console.log("ws status/sub log: " + JSON.stringify(await page.evaluate(() => window.__rec.subs)) + "  ws msgs " + (await page.evaluate(() => window.__rec.ws.length)));
  await kit.close(); try { B.ch.close(); } catch(_){}
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error("CRASH " + (e && e.stack || e)); process.exit(1); });
