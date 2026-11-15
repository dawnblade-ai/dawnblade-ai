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
   (d) S4.3 (v6.30, UNRUN ON LIVE when written: the recovery SQL and function were not deployed yet): before the table is opened, seat 0's phone
       chooses a one-run player name and gets a recovery code on the name sheet; after the game a THIRD fresh Chromium context (a brand-new
       anonymous sign-in) types that code on its own name sheet and must read "Welcome back, <that name>", with a sign-in of its own (not the
       host's), and the same code typed again must be refused. The recovered player's name is the only mark a run leaves (names are unique
       and one per run: "Lc" + the clock in base 36); the throwaway player the third phone had is deleted by the redeem itself.
   (e) S4.4 (v6.31, UNRUN ON LIVE when written): after both phones reach the board, seat 0's one-run name is beside its hero on BOTH boards. It does NOT create
       six tables (the cap is proven offline: test/servertablecap.test.js, the Deno rehearsal, tools/serverpage.js).
   (f) S5.1 (v6.32, UNRUN ON LIVE when written: 006_ratings.sql and the v6.32 function are not deployed yet): the lightest honest ranked check, over plain
       HTTPS to the function with the two sign-ins the phones above already hold (host = named, guest = nameless): `me` carries a rating (1200, no
       ranked games) for the named host; the nameless guest's ranked create is refused `ranked-name`; the host's ranked create is accepted, an anonymous
       join is refused `ranked-signin`, the host's own join says `ranked:true` with a rating, and the host CLOSES the table. It never plays a ranked game
       on live (that would write a result and move two real ratings) and creates no player and no name of its own. A closed table records nothing.
   (g) S5.2 (v6.33, UNRUN ON LIVE when written: 007_forfeit.sql and the v6.33 function are not deployed yet): inside (f), on the ranked table just made, a claim of the
       forfeit is refused `claim-idle` (no game started, so no clock runs) and a claim with a forged key `auth`. No ranked game is played or recorded on live, so a REAL
       forfeit (five minutes of waiting, a claim, a recorded result) is NOT checked here: it is proven offline only (test/serverforfeit.test.js, the Deno rehearsal,
       tools/serverpage.js).
   (h) S5.3 (v6.34, UNRUN ON LIVE when written: 008_ladder.sql and the v6.34 function are not deployed yet): the public ladder. Over plain HTTPS with NO sign-in the
       function answers `{op:"ladder"}` 200 with a well-formed (possibly empty) list: floor 3, cap 50, every row exactly rank/name/rating/games/wins/losses/draws,
       the recent list's entries exactly names/heroes/winner/how/at, and nothing that looks like an id (the two sign-ins the phones hold are scanned for in the text);
       the same with the host's sign-in (its own line is well-formed), and with a forged token (still the public list). Then a FRESH phone with no sign-in opens the page's
       own Ladder screen (Find an opponent, Join a server table, See the ladder) and must read it, and looking must not have signed that phone in. It reads only: it writes
       and records nothing. (A real ranked game is NOT played here: that is tools/liveranked.js, a separate one-off.)
   Exit 0 only when every check passes; otherwise 1 (and the line that failed says why).

   If the live page's switch is closed (SERVER_TABLE.on false: a release before v6.28) both phones are opened with ?server=1.
   NEEDS: `playwright` (NODE_PATH, as tools/page.js; PW_CHROMIUM = a browser binary, optional). Behind an egress proxy it uses
   HTTPS_PROXY for the browser and re-runs itself with NODE_USE_ENV_PROXY=1 for Node's own fetches. Zero repo dependencies. */
"use strict";
const { spawnSync } = require("child_process");
if(require.main === module && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY){
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" } });
  process.exit(r.status == null ? 1 : r.status);
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const PAGE_URL = arg("--url", "https://dawnblade-ai.github.io/dawnblade-ai/"), N_EACH = +arg("--actions", 20), THR = +arg("--throttle", 1), JSON_OUT = process.argv.includes("--json");
const wait = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };
/* S5.3: the helpers below are SHARED with tools/liveranked.js (one copy): `makeRow` gives a PASS/FAIL printer with its own failure count; this script's own is `row`. */
const makeRow = () => { const st = { failed: 0 }; return { st, row: (ok, name, detail) => { if(!ok) st.failed++; console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); return ok; } }; };
const R = makeRow(), row = R.row, out = {};
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

/* ---------------- (h) S5.3: the public ladder, read-only ---------------- */
const LADDER_ROW = "draws,games,losses,name,rank,rating,wins", LADDER_GAME = "at,heroes,how,names,winner", LADDER_YOU = "draws,games,listed,losses,name,rank,rating,toGo,wins";
/* the HTTP half, also run offline by tools/supabase-rehearse.js against the Deno-run function (one copy of the checks). `toks`: sign-ins to scan for and to use as "the host". */
async function ladderOverHttp(cfg, toks, row){
  const post = functionPost(cfg);
  const keys = o => Object.keys(o).sort().join();
  const check = (what, a, tokens) => {
    const okShape = a && a.ok === true && a.floor === 3 && a.cap === 50 && Array.isArray(a.ladder) && Array.isArray(a.recent) && a.ladder.length <= 50 && a.recent.length <= 10
      && a.ladder.every((x, i) => keys(x) === LADDER_ROW && x.rank === i + 1 && x.games >= 3 && typeof x.name === "string" && Number.isInteger(x.rating))
      && a.ladder.every((x, i) => i === 0 || a.ladder[i - 1].rating > x.rating || (a.ladder[i - 1].rating === x.rating && a.ladder[i - 1].games >= x.games))
      && a.recent.every(x => keys(x) === LADDER_GAME && Array.isArray(x.names) && Array.isArray(x.heroes) && ["life", "concession", "stalemate", "forfeit"].includes(x.how))
      && (a.you === undefined || keys(a.you) === LADDER_YOU) && Object.keys(a).every(k => ["ok", "floor", "cap", "ladder", "recent", "you"].includes(k));
    row(okShape, "ladder: " + what + " answers a well-formed list (floor 3, cap 50, public fields only, in order)", okShape ? a.ladder.length + " ranked player(s), " + a.recent.length + " recent game(s)" + (a.you ? ", with its own line" : "") : JSON.stringify(a).slice(0, 160));
    const hay = JSON.stringify(a); row(!tokens.filter(Boolean).some(t => hay.indexOf(t) >= 0) && !/"(id|player|subject|token|table|game)"/.test(hay), "ladder: " + what + " carries no id, token or table code");
  };
  const pub = await post({ op: "ladder" });
  check("the public read (no sign-in)", pub, toks); row(pub.ok === true && pub.you === undefined, "ladder: with no sign-in there is no line of 'you'");
  const host = await post({ op: "ladder", identity: { token: toks[0] } });
  check("the host's read", host, toks); row(host.ok === true && !!host.you && host.you.listed === false && host.you.toGo === 3 && host.you.games === 0, "ladder: the host's own line says no games, three to go", JSON.stringify(host.you));
  check("a forged token", await post({ op: "ladder", identity: { token: "x".repeat(60) } }), toks);
  return { pub, host };
}
async function ladderLight(cfg, phones, browser, proxy, query){
  const toks = [];
  for(const ph of phones) toks.push(await phoneToken(ph.page));
  await ladderOverHttp(cfg, toks, row);
  const L = await openPhone(browser, "ladder-viewer", { proxy, query });
  try {
    await L.page.getByRole("button", { name: /^Find an opponent/ }).click({ timeout: 60000 }); await L.page.waitForSelector(".tblwrap");
    await L.page.getByRole("button", { name: /^Join a server table/ }).click({ timeout: 60000 });
    await L.page.getByRole("button", { name: /^See the ladder/ }).click({ timeout: 60000 });
    const opened = await L.page.waitForSelector('[data-testid="ladder-board"]', { timeout: 60000 }).then(() => true, () => false);
    const said = opened ? (await L.page.evaluate(() => document.querySelector(".tblwrap").innerText)).replace(/\s+/g, " ") : "";
    row(opened && /The ladder/i.test(said) && (/No one is on the ladder yet/.test(said) || sawRows(said)), "ladder: the page's own Ladder screen opens and reads (a list, or the honest empty state)", said.slice(0, 90));
    const signedIn = await L.page.evaluate(() => !!window.localStorage.getItem("dawnblade.who.id"));
    row(!signedIn, "ladder: looking at the Ladder did not sign the phone in");
    row(L.errors.length === 0, "ladder: no page error on the Ladder screen", L.errors.slice(0, 2).join(" | "));
  } catch(e){ row(false, "ladder: the page's Ladder screen", String(e && e.message || e).split("\n")[0]); }
  await L.ctx.close().catch(() => {});
}
const sawRows = said => /\b1\s+\S+/.test(said) && /won/.test(said);

/* ---------------- (f) S5.1: a ranked table is accepted, refused and closed on live — without playing it ---------------- */
async function rankedLight(cfg, pages){
  const tok = phoneToken, post = functionPost(cfg);
  const [named, nameless] = [await tok(pages[0]), await tok(pages[1])];
  if(!row(!!named && !!nameless, "ranked: both phones hold a sign-in to check with")) return;
  const me = await post({ op: "me", identity: { token: named } });
  row(me.ok === true && me.rating === 1200 && me.games === 0, "ranked: `me` carries the host player's rating (1200, no ranked games)", JSON.stringify({ rating: me.rating, games: me.games, refused: me.refused }));
  const no = await post({ op: "create", identity: { token: nameless }, ranked: true });
  row(no.ok === false && no.refused === "ranked-name", "ranked: a nameless player's ranked create is refused 'ranked-name'", JSON.stringify(no));
  const bad = await post({ op: "create", identity: { token: named }, ranked: "yes" });
  row(bad.ok === false && bad.refused === "bad-request", "ranked: a ranked flag that is not true is refused", JSON.stringify(bad));
  const made = await post({ op: "create", identity: { token: named }, ranked: true });
  row(made.ok === true && /^[A-Z0-9]{6}$/.test(made.table || ""), "ranked: the host's ranked create is accepted", JSON.stringify(made));
  if(!made.ok) return;
  const anon = await post({ op: "join", table: made.table });
  row(anon.ok === false && anon.refused === "ranked-signin", "ranked: an anonymous join of the ranked table is refused 'ranked-signin'", JSON.stringify(anon).slice(0, 120));
  const mine = await post({ op: "join", table: made.table, identity: { token: named } });
  row(mine.ok === true && mine.ranked === true && Array.isArray(mine.ratings) && mine.ratings.includes(1200), "ranked: the host's own join says the table is ranked and shows the rating", JSON.stringify({ ranked: mine.ranked, ratings: mine.ratings, refused: mine.refused }));
  /* S5.2 (v6.33, UNRUN ON LIVE when written): the lightest honest check of the forfeit clock — on the table just made, with the host seated, no clock runs, so a claim
     is refused as `claim-idle` (and a forged key as `auth`); nothing is written and no game is played or recorded */
  const hostKey = ((mine.frames || []).find(f => f && f.ch === "judge" && f.key) || {}).key;
  if(hostKey && (mine.seat === 0 || mine.seat === 1)){
    const idle = await post({ op: "claim", table: made.table, seat: mine.seat, key: hostKey });
    row(idle.ok === false && idle.refused === "claim-idle", "forfeit: a claim on the table just made (no game started, no clock) is refused 'claim-idle'", JSON.stringify(idle).slice(0, 120));
    const forged = await post({ op: "claim", table: made.table, seat: mine.seat, key: "x".repeat(hostKey.length) });
    row(forged.ok === false && forged.refused === "auth", "forfeit: a claim with a forged seat key is refused 'auth'", JSON.stringify(forged).slice(0, 120));
  } else row(false, "forfeit: the host's seat key was in the join answer to claim with", JSON.stringify({ seat: mine.seat }));
  const closed = await post({ op: "close", table: made.table, identity: { token: named } });
  const gone = await post({ op: "join", table: made.table, identity: { token: named } });
  row(closed.ok === true && gone.refused === "no-table", "ranked: the host closes the table (nothing was recorded), and it is gone", JSON.stringify({ closed: closed.ok, after: gone.refused }));
}

/* ---- shared with tools/liveranked.js: a browser, a phone, and the lobby walked to the board ---- */
async function launchBrowser(){
  const pw = require("playwright");
  const proxy = process.env.HTTPS_PROXY;
  const browser = await pw.chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), ...(proxy ? { proxy: { server: proxy } } : {}) });
  return { browser, proxy };
}
/* one fresh phone (its own context, so its own sign-in) on the live page, opened and ready ("N cards" in the top bar) */
async function openPhone(browser, name, o){
  o = o || {};
  const ctx = await browser.newContext({ ...(o.proxy ? { ignoreHTTPSErrors: true } : {}), viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), ph = { name, ctx, page, errors: [], consoleErrors: [], done: {} };
  page.on("pageerror", e => ph.errors.push(String(e && e.message || e).slice(0, 200)));
  page.on("console", m => { if(m.type() === "error") ph.consoleErrors.push(m.text().slice(0, 200) + (m.location().url ? " @ " + m.location().url.slice(0, 80) : "")); });
  page.on("dialog", d => { ph.errors.push("dialog: " + d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(RECORD);
  await page.goto((o.url || PAGE_URL).replace(/\?.*$/, "") + (o.query || ""), { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 120000 });
  return ph;
}
/* both phones walk the who-goes-first lobby by their own buttons until each has a board; returns the ms it took, or null */
async function walkLobby(A, B, maxMs){
  const t0 = Date.now();
  while(Date.now() - t0 < (maxMs || 150000)){
    const r = await Promise.all([A, B].map(async (ph, i) => { const x = await ph.page.evaluate(LOBBY, { role: i ? "guest" : "host", done: ph.done }).catch(() => null); if(x && x !== "board" && x !== "throw") ph.done[x] = true; return x; }));
    if(r[0] === "board" && r[1] === "board") return Date.now() - t0;
    await wait(250);
  }
  return null;
}
/* S4.2: the access token a phone holds for its own sign-in (kept in its localStorage under the page's own key) */
const phoneToken = pg => pg.evaluate(() => { try { return JSON.parse(window.localStorage.getItem("dawnblade.who.id") || "null").a || null; } catch(_){ return null; } });
const functionPost = cfg => async body => { try { const r = await fetchT(cfg.url + "/functions/v1/" + cfg.fn, { method: "POST", headers: { apikey: cfg.key, "content-type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); } catch(e){ return { ok: false, refused: "network " + (e.cause && e.cause.code || e.message) }; } };

async function twoPhones(p, cfg){
  let pw; try { pw = require("playwright"); } catch(e){ return row(false, "playwright resolves", "set NODE_PATH to a playwright install"); }
  const { browser, proxy } = await launchBrowser();
  const closed = p && p.cfg && p.cfg.on !== true, q = closed ? "?server=1" : "";
  const phones = [];
  const mk = async name => { const ph = await openPhone(browser, name, { proxy, query: q }); phones.push(ph); return ph; };
  let seated = false, verdict = "", liveName = null, recCode = null;
  try {
    const A = await mk("host"), B = await mk("guest");
    out.loaded = { A: await A.page.evaluate(() => window.APP_VER), B: await B.page.evaluate(() => window.APP_VER) };
    const click = (ph, re, t) => ph.page.getByRole("button", { name: re }).click({ timeout: t || 60000 });
    await click(A, /^Find an opponent/); await A.page.waitForSelector(".tblwrap");
    const offered = await A.page.evaluate(() => [...document.querySelectorAll("button")].some(b => /^Join a server table/.test(b.textContent.trim())));
    row(offered, "the table screen offers the server table" + (closed ? " (opened with ?server=1: the switch is closed)" : " (no query: the door is open)"));
    if(!offered) throw new Error("no server option on the table screen");
    await click(A, /^Join a server table/);
    /* S4.3: seat 0's player gets a one-run name and a recovery code on the name sheet (the same buttons tools/serverpage.js drives offline) */
    liveName = "Lc" + Date.now().toString(36).slice(-8);
    await click(A, /^Choose a name/); await A.page.waitForSelector(".tblname", { timeout: 60000 });
    await A.page.fill(".tblname", liveName); await click(A, /^Save name/);
    await A.page.waitForFunction(n => document.body.innerText.indexOf(n) >= 0 && /Playing as/i.test(document.body.innerText), liveName, { timeout: 90000 });
    await click(A, /^Change/); await A.page.waitForSelector(".tblname", { timeout: 30000 });
    await click(A, /^Get a recovery code/); await A.page.waitForSelector(".tblrec", { timeout: 90000 });
    recCode = (await A.page.evaluate(() => document.querySelector(".tblrec").innerText)).trim();
    row(/^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(recCode), "seat 0's player got a recovery code (three groups of five)", "name " + liveName);
    await click(A, /^I wrote it down/); await click(A, /^Back/);
    await A.page.waitForSelector("button:has-text('Open a server table')", { timeout: 30000 });
    await click(A, /^Open a server table/);
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
    /* S4.2: each phone signed in by itself when it opened or joined the table (an anonymous player, kept on the phone) */
    const signed = [];
    for(const ph of phones) signed.push(await ph.page.evaluate(() => { try { const r = JSON.parse(window.localStorage.getItem("dawnblade.who.id") || "null"); return !!(r && typeof r.a === "string" && r.a && typeof r.r === "string" && r.r); } catch(_){ return false; } }));
    row(signed.every(Boolean), "both phones signed in as players (no email, no password)", "host " + (signed[0] ? "yes" : "no") + ", guest " + (signed[1] ? "yes" : "no"));
    /* the lobby, by each phone's own buttons, until both have a board */
    const tb = await walkLobby(A, B, 150000);
    out.lobbyMs = tb;
    if(!row(tb != null, "both phones reach the board", tb != null ? "lobby walked in " + tb + " ms" : "stuck; host " + JSON.stringify(A.done) + " guest " + JSON.stringify(B.done))) throw new Error("lobby");
    for(const ph of phones) await ph.page.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.state() != null, null, { timeout: 90000 });
    const cdps = [];
    if(THR > 1) for(const ph of phones){ const c = await ph.ctx.newCDPSession(ph.page); await c.send("Emulation.setCPUThrottlingRate", { rate: THR }); cdps.push(c); }
    /* play: whichever phone can move, moves, through the page's own session; wait until BOTH phones' counters have moved */
    const seatOf = ph => ph.page.evaluate(() => window.__dawnTable.seat);
    const seats = [await seatOf(A), await seatOf(B)];
    out.seats = seats;
    /* S4.4 (v6.31, UNRUN ON LIVE when written: the v6.31 page and function are not deployed yet): seat 0's one-run player name is on BOTH boards, beside
       that seat's hero: the host reads it as its own (data-pname "me"), the guest as its opponent's ("foe"). Names are the one mark a run leaves. */
    {
      const seen = await Promise.all([[A, "me"], [B, "foe"]].map(([ph, who]) => ph.page.waitForFunction(([w, n]) => { const e = document.querySelector('[data-pname="' + w + '"]'); return !!e && e.textContent === n; }, [who, liveName], { timeout: 45000 }).then(() => true, () => false)));
      row(seen[0] && seen[1], "seat 0's player name is beside its hero on BOTH boards (host: mine, guest: theirs)", "name " + liveName + ", host " + (seen[0] ? "yes" : "no") + ", guest " + (seen[1] ? "yes" : "no"));
    }
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
    /* S5.1: the lightest honest ranked check, with the sign-ins these two phones already hold (no ranked game is played, no player or name is made) */
    await rankedLight(cfg, phones.map(ph => ph.page));
    /* S5.3: the public ladder, read-only (it needs the two sign-ins above only to scan for them) */
    await ladderLight(cfg, phones, browser, proxy, q).catch(e => row(false, "ladder check", String(e && e.message || e).split("\n")[0]));
    /* S4.3: a third, fresh phone redeems seat 0's code and is that player */
    if(recCode){
      const C = await mk("recovered");
      const hostA = await A.page.evaluate(() => { try { return JSON.parse(window.localStorage.getItem("dawnblade.who.id") || "null").a; } catch(_){ return null; } });
      await click(C, /^Find an opponent/); await C.page.waitForSelector(".tblwrap");
      await click(C, /^Join a server table/);
      await click(C, /^Choose a name/); await C.page.waitForSelector(".tblname", { timeout: 60000 });
      await click(C, /^I have a code/); await C.page.waitForSelector(".tblrecin", { timeout: 30000 });
      await C.page.fill(".tblrecin", recCode.toLowerCase().replace(/-/g, " "));
      await click(C, /^Recover my player/);
      const welcomed = await C.page.waitForSelector("[data-testid=rec-done]", { timeout: 90000 }).then(() => true, () => false);
      const said = welcomed ? (await C.page.evaluate(() => document.querySelector("[data-testid=rec-done]").innerText)).replace(/\s+/g, " ").trim() : (await C.page.evaluate(() => (document.querySelector(".tblerr") || { innerText: "" }).innerText)).trim();
      row(welcomed && said.indexOf("Welcome back, " + liveName) === 0, "a third fresh phone redeemed seat 0's recovery code and is recognised as that player", said.slice(0, 100));
      const mine = await C.page.evaluate(() => { try { return { who: JSON.parse(window.localStorage.getItem("dawnblade.who.name") || "null"), a: JSON.parse(window.localStorage.getItem("dawnblade.who.id") || "null").a }; } catch(_){ return null; } });
      row(!!mine && mine.who === liveName && !!mine.a && mine.a !== hostA, "the third phone holds the recovered name and a sign-in of its own (not the host's)");
      /* the same code again, from yet another fresh sign-in: refused, and the screen says nothing about why */
      await click(C, /^Done/); await C.page.waitForSelector("button:has-text('Open a server table')");
      await C.page.evaluate(() => { window.localStorage.removeItem("dawnblade.who.id"); window.localStorage.removeItem("dawnblade.who.name"); });
      await C.page.reload({ waitUntil: "load" });
      await C.page.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 120000 });
      await click(C, /^Find an opponent/); await C.page.waitForSelector(".tblwrap");
      await click(C, /^Join a server table/); await click(C, /^Choose a name/); await C.page.waitForSelector(".tblname", { timeout: 60000 });
      await click(C, /^I have a code/); await C.page.waitForSelector(".tblrecin", { timeout: 30000 });
      await C.page.fill(".tblrecin", recCode); await click(C, /^Recover my player/);
      const refused = await C.page.waitForSelector(".tblerr", { timeout: 90000 }).then(() => C.page.evaluate(() => document.querySelector(".tblerr").innerText.replace(/\s+/g, " ").trim()), () => "");
      row(/did not work/.test(refused) && !(await C.page.evaluate(() => !!document.querySelector("[data-testid=rec-done]"))), "the same code typed again is refused, in plain words", refused.slice(0, 80));
      await C.ctx.close().catch(() => {});           /* its page errors were recorded as they happened and are still counted below */
    }
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

module.exports = { ladderOverHttp, makeRow, wait, fetchT, RECORD, LOBBY, launchBrowser, openPhone, walkLobby, phoneToken, functionPost, pageAndScripts, health, PAGE_URL };
if(require.main === module) (async () => {
  const t0 = Date.now();
  console.log("livecheck " + PAGE_URL + "  (" + new Date().toISOString() + ")");
  const p = await pageAndScripts().catch(e => { row(false, "live page fetch", String(e && e.message || e)); return null; });
  const cfg = await health(p).catch(e => { row(false, "function health", String(e && e.message || e)); return null; });
  if(p) await twoPhones({ ...p, cfg: p.cfg }, cfg).catch(e => row(false, "two-phone check", String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")));
  else row(false, "two-phone check", "skipped: no live page");
  console.log((R.st.failed ? "FAILED: " + R.st.failed + " check(s)" : "ALL PASS") + "  in " + Math.round((Date.now() - t0) / 1000) + " s");
  if(JSON_OUT) console.log("JSON " + JSON.stringify(out));
  setTimeout(() => process.exit(R.st.failed ? 1 : 0), 200);
})();
