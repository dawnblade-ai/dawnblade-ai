#!/usr/bin/env node
/* ============================================================
   tools/livecheck.js — THE CEO'S POST-DEPLOY CHECK (v6.28). Run it after a push of `main`, or any time.

     node tools/livecheck.js [--url <page>] [--actions 20] [--throttle 1] [--json]

   Nothing is served locally: the LIVE page, its scripts and its CDNs, the live function, the real Realtime socket.
   (a) fetches the live page: its APP_VER and DATA_VER, and every <script src> it names must answer 200;
   (b) GETs the server table function's health and compares its build with the page's  v<APP_VER> · <DATA_VER>;
   (c) opens the live page in TWO Chromium contexts (393x852), opens a server table on one, joins by code on the other, walks both
       through the lobby with the page's own buttons, then plays at least --actions moves from EACH seat (default 20 each way)
       through the page's own session hooks (window.__dawnTable, the same ones tools/perf-page.js uses) and reports: seated yes/no,
       how every remote move reached the other phone (push = a Realtime message with no function call, else a fallback ask),
       median / p95 tap -> other seat, any banner text, console errors.
   Exit 0 only when every check passes; otherwise 1 (and the line that failed says why).

   If the live page's switch is closed (SERVER_TABLE.on false: a release before v6.28) both phones are opened with ?server=1.
   NEEDS: `playwright` (NODE_PATH, as tools/page.js; PW_CHROMIUM = a browser binary, optional). Behind an egress proxy it uses
   HTTPS_PROXY for the browser and re-runs itself with NODE_USE_ENV_PROXY=1 for Node's own fetches. Zero repo dependencies. */
"use strict";
const { spawnSync } = require("child_process");
if(process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY){
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status == null ? 1 : r.status);
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const PAGE_URL = arg("--url", "https://dawnblade-ai.github.io/dawnblade-ai/"), N_EACH = +arg("--actions", 20), THR = +arg("--throttle", 1), JSON_OUT = process.argv.includes("--json");
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };
let failed = 0; const out = {};
const row = (ok, name, detail) => { if(!ok) failed++; console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); return ok; };
const fetchT = (u, o) => fetch(u, { ...(o || {}), signal: AbortSignal.timeout(30000) });

/* ---------------- (a) the live page and every script it names ---------------- */
async function pageAndScripts(){
  const res = await fetchT(PAGE_URL + (PAGE_URL.includes("?") ? "&" : "?") + "livecheck=" + Date.now());
  const html = await res.text();
  if(!row(res.status === 200 && html.length > 1000, "live page answers 200", PAGE_URL + " " + res.status + ", " + html.length + " bytes")) return null;
  const app = (html.match(/window\.APP_VER\s*=\s*"([^"]+)"/) || [])[1], data = (html.match(/window\.DATA_VER\s*=\s*"([^"]+)"/) || [])[1];
  const cfgSrc = (html.match(/window\.SERVER_TABLE\s*=\s*(\{[^}]*\});/) || [])[1];
  let cfg = null; try { cfg = cfgSrc && new Function("return " + cfgSrc)(); } catch(_){}
  out.page = { app, data, build: "v" + app + " · " + data, serverTableOn: cfg && cfg.on };
  row(!!app && !!data && !!cfg, "live page reports its version", "APP_VER " + app + ", DATA_VER " + data + ", server table switch " + (cfg && cfg.on ? "OPEN" : "closed"));
  const srcs = [...new Set([...html.matchAll(/<script\b[^>]*?\ssrc=["']([^"']+)["']/g)].map(m => new URL(m[1], PAGE_URL).href))];
  const bad = []; let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while(i < srcs.length){ const u = srcs[i++]; try { const r = await fetchT(u); await r.arrayBuffer(); if(r.status !== 200) bad.push(u + " -> " + r.status); } catch(e){ bad.push(u + " -> " + (e.cause && e.cause.code || e.message)); } } }));
  row(srcs.length > 0 && !bad.length, "every <script src> answers 200", srcs.length + " scripts" + (bad.length ? "; BAD: " + bad.join(", ") : ""));
  out.scripts = srcs.length;
  return { app, data, cfg };
}

/* ---------------- (b) the function's build against the page's ---------------- */
async function health(p){
  const cfg = (p && p.cfg) || { url: "https://fokcpzplomjsraquaaid.supabase.co", key: "sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu", fn: "table" };
  let h = null, status = null;
  try { const r = await fetchT(cfg.url + "/functions/v1/" + cfg.fn, { headers: { apikey: cfg.key } }); status = r.status; h = await r.json(); } catch(e){ status = "error " + (e.cause && e.cause.code || e.message); }
  out.health = h;
  const want = p && "v" + p.app + " · " + p.data;
  row(status === 200 && h && h.service === "dawnblade-table", "function health answers", "HTTP " + status + " " + JSON.stringify(h));
  row(!!h && !!want && h.build === want, "function build equals the live page's", "function " + (h && h.build) + " | page " + want);
  return cfg;
}

/* ---------------- (c) two real phones on the live page ---------------- */
const RECORD = `
  window.__rec = {ws: [], fx: [], seq: [], banners: [], errs: []};
  const WS = window.WebSocket; window.WebSocket = function(u, p){ const w = p ? new WS(u, p) : new WS(u);
    w.addEventListener("message", e => { try { const m = JSON.parse(e.data); window.__rec.ws.push([Date.now(), m.topic, m.event]); } catch(_){} }); return w; };
  window.WebSocket.prototype = WS.prototype; for(const k of ["CONNECTING","OPEN","CLOSING","CLOSED"]) window.WebSocket[k] = WS[k];
  const F = window.fetch; window.fetch = function(u, i){ if(!/functions\\/v1\\/table/.test(String(u))) return F.apply(this, arguments);
    let op = ""; try { const b = JSON.parse(i.body); op = b.op + (b.frame && b.frame.m ? ":" + b.frame.m.t : ""); } catch(_){} const t0 = Date.now();
    return F.apply(this, arguments).then(r => { window.__rec.fx.push([t0, Date.now(), op, r.status]); return r; }); };
  setInterval(() => { const s = window.__dawnTable && window.__dawnTable.session;
    if(s){ const q = s.seq(), l = window.__rec.seq; if(!l.length || l[l.length - 1][1] !== q) l.push([Date.now(), q]); }
    for(const el of document.querySelectorAll(".srvbar, .tblerr")){ const t = (el.className + ": " + el.innerText).replace(/\\s+/g, " ").trim(); if(!window.__rec.banners.includes(t)) window.__rec.banners.push(t); } }, 5);
`;
/* one lobby step, by the page's own buttons; returns the name of what it pressed (or null) */
const LOBBY = ({ role, done }) => {
  const vis = e => e && e.offsetParent !== null, btn = re => [...document.querySelectorAll("button")].find(b => vis(b) && !b.disabled && re.test(b.textContent.trim()));
  const press = (name, el) => { if(!el || done[name]) return null; el.click(); return name; };
  if(document.querySelector(".board")) return "board";
  const heroes = [...document.querySelectorAll(".lobhero")].filter(vis);
  if(heroes.length && !done.hero) { const h = heroes.filter(x => !x.disabled)[role === "host" ? 0 : Math.min(1, heroes.length - 1)] || heroes[0]; return press("hero", h); }
  if(done.hero && btn(/^Lock in/) && !done.lock) return press("lock", btn(/^Lock in/));
  const th = [...document.querySelectorAll(".rthrows button")].filter(b => vis(b) && !b.disabled);
  if(th.length) { const t = th.find(b => new RegExp(role === "host" ? "rock" : "paper", "i").test(b.textContent)); if(t){ t.click(); return "throw"; } }
  const sp = [...document.querySelectorAll(".rseatpick button")].filter(b => vis(b) && !b.disabled);
  if(sp.length && !done.seatpick) return press("seatpick", sp[0]);
  if(btn(/^Lock the sideboard/) && !done.side) return press("side", btn(/^Lock the sideboard/));
  return null;
};

async function twoPhones(p, cfg){
  let pw; try { pw = require("playwright"); } catch(e){ return row(false, "playwright resolves", "set NODE_PATH to a playwright install"); }
  const proxy = process.env.HTTPS_PROXY;
  const browser = await pw.chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), ...(proxy ? { proxy: { server: proxy } } : {}) });
  const closed = p && p.cfg && p.cfg.on !== true, q = closed ? "?server=1" : "";
  const phones = [];
  const mk = async name => {
    const ctx = await browser.newContext({ ...(proxy ? { ignoreHTTPSErrors: true } : {}), viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), ph = { name, ctx, page, errors: [], consoleErrors: [], done: {} };
    page.on("pageerror", e => ph.errors.push(String(e && e.message || e).slice(0, 200)));
    page.on("console", m => { if(m.type() === "error") ph.consoleErrors.push(m.text().slice(0, 200) + (m.location().url ? " @ " + m.location().url.slice(0, 80) : "")); });
    page.on("dialog", d => { ph.errors.push("dialog: " + d.message()); d.dismiss().catch(() => {}); });
    await page.addInitScript(RECORD);
    await page.goto(PAGE_URL.replace(/\?.*$/, "") + q, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 120000 });
    phones.push(ph); return ph;
  };
  let seated = false, verdict = "";
  try {
    const A = await mk("host"), B = await mk("guest");
    out.loaded = { A: await A.page.evaluate(() => window.APP_VER), B: await B.page.evaluate(() => window.APP_VER) };
    const click = (ph, re, t) => ph.page.getByRole("button", { name: re }).click({ timeout: t || 60000 });
    await click(A, /^Find an opponent/); await A.page.waitForSelector(".tblwrap");
    const offered = await A.page.evaluate(() => [...document.querySelectorAll("button")].some(b => /^Join a server table/.test(b.textContent.trim())));
    row(offered, "the table screen offers the server table" + (closed ? " (opened with ?server=1: the switch is closed)" : " (no query: the door is open)"));
    if(!offered) throw new Error("no server option on the table screen");
    await click(A, /^Join a server table/); await click(A, /^Open a server table/);
    await A.page.waitForSelector(".tblcode", { timeout: 90000 });
    const code = (await A.page.evaluate(() => document.querySelector(".tblcode").innerText)).trim();
    out.code = code;
    await click(B, /^Find an opponent/); await B.page.waitForSelector(".tblwrap");
    await click(B, /^Join a server table/); await click(B, /^Enter a table code/);
    await B.page.locator("input.tblin").pressSequentially(code);
    const tJoin = Date.now();
    await click(B, /^Sit down/);
    /* seated: both phones reach the fighter choice */
    const both = ph => ph.page.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 90000 });
    await Promise.all([both(A), both(B)]);
    seated = true; out.seatedMs = Date.now() - tJoin;
    row(true, "both phones seated at table " + code, "guest tap to both on the lobby screen " + out.seatedMs + " ms");
    /* the lobby, by each phone's own buttons, until both have a board */
    const t0 = Date.now(); let tb = null;
    while(Date.now() - t0 < 150000){
      const r = await Promise.all([A, B].map(async (ph, i) => { const x = await ph.page.evaluate(LOBBY, { role: i ? "guest" : "host", done: ph.done }).catch(() => null); if(x && x !== "board" && x !== "throw") ph.done[x] = true; return x; }));
      if(r[0] === "board" && r[1] === "board"){ tb = Date.now() - t0; break; }
      await wait(250);
    }
    out.lobbyMs = tb;
    if(!row(tb != null, "both phones reach the board", tb != null ? "lobby walked in " + tb + " ms" : "stuck; host " + JSON.stringify(A.done) + " guest " + JSON.stringify(B.done))) throw new Error("lobby");
    for(const ph of phones) await ph.page.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.state() != null, null, { timeout: 90000 });
    const cdps = [];
    if(THR > 1) for(const ph of phones){ const c = await ph.ctx.newCDPSession(ph.page); await c.send("Emulation.setCPUThrottlingRate", { rate: THR }); cdps.push(c); }
    /* play: whichever phone can move, moves, through the page's own session; wait until BOTH phones' counters have moved */
    const seatOf = ph => ph.page.evaluate(() => window.__dawnTable.seat);
    const seats = [await seatOf(A), await seatOf(B)];
    out.seats = seats;
    const seqNow = ph => ph.page.evaluate(() => window.__dawnTable.session.seq());
    const move = ph => ph.page.evaluate(seat => { const s = window.__dawnTable.session; if(s.status() !== "ready") return false; const a = DawnSparring.act(s.state(), seat, { search: false }); if(!a) return false; window.__t_submit = Date.now(); return !s.submit(a); }, seats[phones.indexOf(ph)]).catch(() => false);
    const rows = []; let idle = 0, lost = 0;
    const count = who => rows.filter(r => r.who === who).length;
    while((count("host") < N_EACH || count("guest") < N_EACH) && rows.length < 600 && idle < 400){
      let mover = null;
      for(const ph of (rows.length % 2 ? [B, A] : [A, B])){
        const seq0 = await seqNow(ph), oSeq0 = await seqNow(ph === A ? B : A);
        const rec0 = await Promise.all(phones.map(x => x.page.evaluate(() => ({ ws: window.__rec.ws.length, fx: window.__rec.fx.length }))));
        if(await move(ph)){ mover = { ph, seq0, oSeq0, rec0 }; break; }
      }
      if(!mover){ idle++; await wait(60); continue; } idle = 0;
      const { ph, seq0, oSeq0, rec0 } = mover, other = ph === A ? B : A, oi = phones.indexOf(other);
      const ts = await ph.page.evaluate(() => window.__t_submit);
      const t0 = Date.now(); let own = null, oth = null;
      while(Date.now() - t0 < 45000 && (own == null || oth == null)){
        await wait(10);
        if(own == null) own = await ph.page.evaluate(([s0, t]) => { const l = window.__rec.seq.filter(x => x[1] !== s0 && x[0] >= t - 5); return l.length ? l[0][0] : null; }, [seq0, ts]);
        if(oth == null) oth = await other.page.evaluate(([s0, t]) => { const l = window.__rec.seq.filter(x => x[1] !== s0 && x[0] >= t - 5); return l.length ? l[0][0] : null; }, [oSeq0, ts]);
      }
      await wait(120);
      const rec = await other.page.evaluate(r0 => ({ ws: window.__rec.ws.slice(r0.ws).length, fx: window.__rec.fx.slice(r0.fx).map(f => f[2]) }), rec0[oi]);
      if(oth == null) lost++;
      rows.push({ who: ph === A ? "host" : "guest", ownMs: own && own - ts, otherMs: oth && oth - ts, via: rec.fx.length === 0 && rec.ws > 0 ? "push" : "fallback" + (rec.fx.length ? ": " + [...new Set(rec.fx)].join("+") : " (nothing seen)") });
    }
    const sm = who => { const a = rows.filter(r => r.who === who); return { moves: a.length, median: pct(a.map(r => r.otherMs), .5), p95: pct(a.map(r => r.otherMs), .95), max: pct(a.map(r => r.otherMs), 1), missing: a.filter(r => r.otherMs == null).length }; };
    const hs = sm("host"), gs = sm("guest"), allMs = rows.map(r => r.otherMs);
    const pushed = rows.filter(r => r.via === "push").length, fallback = rows.length - pushed;
    out.play = { host: hs, guest: gs, all: { moves: rows.length, median: pct(allMs, .5), p95: pct(allMs, .95) }, push: pushed, fallback, fallbackKinds: [...new Set(rows.filter(r => r.via !== "push").map(r => r.via))] };
    row(hs.moves >= N_EACH && gs.moves >= N_EACH, "at least " + N_EACH + " moves each way", "host " + hs.moves + ", guest " + gs.moves);
    row(lost === 0, "every move reached the other phone", lost + " lost");
    console.log("      how remote moves arrived: push " + pushed + ", fallback " + fallback + (fallback ? " (" + out.play.fallbackKinds.join("; ") + ")" : ""));
    console.log("      tap -> other seat (ms): all median " + out.play.all.median + ", p95 " + out.play.all.p95 + " | host moves: median " + hs.median + ", p95 " + hs.p95 + ", max " + hs.max + " | guest moves: median " + gs.median + ", p95 " + gs.p95 + ", max " + gs.max);
    row(fallback === 0, "every remote move arrived by push", fallback ? fallback + " of " + rows.length + " came by a fallback ask" : "");
  } catch(e){ verdict = String(e && e.message || e); if(verdict !== "lobby") row(false, "two-phone drive", verdict.split("\n")[0]); }
  row(seated, "seated: " + (seated ? "yes" : "no"));
  const banners = [], errs = [], cerrs = [];
  for(const ph of phones){ const b = await ph.page.evaluate(() => window.__rec && window.__rec.banners).catch(() => null); (b || []).forEach(t => banners.push(ph.name + " " + t)); ph.errors.forEach(e => errs.push(ph.name + " " + e)); ph.consoleErrors.forEach(e => cerrs.push(ph.name + " " + e)); }
  out.banners = banners; out.pageErrors = errs; out.consoleErrors = cerrs;
  console.log("      banner text seen: " + (banners.length ? banners.join(" | ") : "none"));
  row(!banners.some(t => /srvbar bad/.test(t)), "no \"server is not answering\" banner");
  const real = cerrs.filter(e => !/Failed to load resource/.test(e));
  console.log("      console errors: " + (cerrs.length ? cerrs.length + " (" + real.length + " beyond failed resource loads)" + (cerrs.length ? "\n        " + cerrs.slice(0, 8).join("\n        ") : "") : "none"));
  row(errs.length === 0 && real.length === 0, "no page errors, no console errors beyond failed resource loads", errs.concat(real).slice(0, 3).join(" | "));
  await browser.close().catch(() => {});
}

(async () => {
  const t0 = Date.now();
  console.log("livecheck " + PAGE_URL + "  (" + new Date().toISOString() + ")");
  const p = await pageAndScripts().catch(e => { row(false, "live page fetch", String(e && e.message || e)); return null; });
  const cfg = await health(p).catch(e => { row(false, "function health", String(e && e.message || e)); return null; });
  if(p) await twoPhones({ ...p, cfg: p.cfg }, cfg).catch(e => row(false, "two-phone check", String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")));
  else row(false, "two-phone check", "skipped: no live page");
  console.log((failed ? "FAILED: " + failed + " check(s)" : "ALL PASS") + "  in " + Math.round((Date.now() - t0) / 1000) + " s");
  if(JSON_OUT) console.log("JSON " + JSON.stringify(out));
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
})();
