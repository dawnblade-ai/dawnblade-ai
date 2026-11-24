#!/usr/bin/env node
/* ============================================================
   THE SERVER TABLE, DRIVEN ON THE REAL PAGE (SERVER S2)

   tools/page.js's open(): the real index.html in headless Chromium at 393x852,
   every external request answered locally. Here the page's "Join a server
   table" path is driven through every state a player can meet, and asserted on
   element boxes and text, not screenshots.

   TWO WIRES
     the REAL transport (engine/servertable.js supabaseTransport) with the
       project's URL answered like a project with nothing deployed ("function
       not found", 404) by a route in THIS file — the request never leaves the
       machine. Proves: the page loads with no request to the project, and a
       server table reads "unavailable", not a hang.
     the FAKE: server/referee.js over S1's in-memory store and bus
       (test/helpers/servertransport.js), reached from the page through
       exposed functions and installed as window.__dawnServerTransport (the
       page's own test seam; the fake is never in a script tag). A scripted
       phone (test/helpers/serverphone.js) sits at the other seat.

   DEPS, as tools/page.js: PAGE_DEPS (react, react-dom, @babel/standalone,
   peerjs, @supabase/supabase-js@2.115.0) and `playwright` on NODE_PATH.
   NOT part of `npm test`.   node tools/serverpage.js
   ============================================================ */
"use strict";
const path = require("path");
const { open } = require("./page.js");
const { makeWorld } = require("../test/helpers/servertransport.js");
const PH = require("../test/helpers/serverphone.js");
const F = require("../test/helpers/serverfakes.js");
const T = require("../test/helpers/judgetable.js");
const ST = require("../engine/servertable.js");
const Wr = require("../engine/wire.js");
const R = T.R;

/* THE DEAL, THE PAGE'S WAY (index.html JudgeRoom.deal) — shared with tools/supabase-rehearse.js; sets the page's CDN address */
const { dealLikeThePage, matchCatalog } = require("../test/helpers/pagedeal.js");
const { judgeScreen } = require("./tapjudge.js");

const W = 393, H = 852;
const rows = [];
const row = (ok, name, detail) => { rows.push({ ok, name }); console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* the page's end of the fake wire: post() and subscribe() forwarded to the world in this process */
const SHIM = `
  window.__srvN = 0; window.__srvSubs = {};
  window.__srvDeliver = (id, p) => { const s = window.__srvSubs[id]; if(s) s.fn(p); };
  window.__srvState = (id, st) => { const s = window.__srvSubs[id]; if(s && s.onState) s.onState(st); };
  window.__installFake = () => { window.__dawnServerTransport = {
    post: env => window.__srvPost("PAGE", JSON.stringify(env)).then(t => JSON.parse(t)),
    subscribe(topic, fn, onState){ const id = ++window.__srvN; window.__srvSubs[id] = {fn, onState}; window.__srvSub("PAGE", topic, id);
      return () => { delete window.__srvSubs[id]; window.__srvUnsub(id); }; } }; };
`;

async function wire(page, world){
  const unsubs = new Map();
  await page.exposeFunction("__srvPost", async (name, text) => JSON.stringify(await world.transport(name).post(JSON.parse(text))));
  await page.exposeFunction("__srvSub", (name, topic, id) => {
    const un = world.transport(name).subscribe(topic,
      p => page.evaluate(([i, q]) => window.__srvDeliver(i, q), [id, p]).catch(() => {}),
      st => page.evaluate(([i, s]) => window.__srvState(i, s), [id, st]).catch(() => {}));
    unsubs.set(id, un);
  });
  await page.exposeFunction("__srvUnsub", id => { const u = unsubs.get(id); if(u) u(); unsubs.delete(id); });
  await page.addInitScript(SHIM);
  await page.evaluate(SHIM);
  await page.evaluate(() => window.__installFake());
}

const boxes = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].filter(b => b.offsetParent || getComputedStyle(b).position === "fixed")
  .map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.replace(/\s+/g, " ").trim(), x: Math.round(r.left), r: Math.round(r.right), y: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), dis: !!b.disabled }; }), sel);
const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const overflow = page => page.evaluate(w => document.scrollingElement.scrollWidth <= w, W);
/* every button on the screen: a thumb-sized target inside the viewport */
const thumbs = async (page, name, scope) => {
  const bs = await boxes(page, (scope || ".tblwrap") + " button");
  row(bs.length > 0 && bs.every(b => b.h >= 40 && b.x >= 0 && b.r <= W), name + ": every button is thumb-sized and inside the screen", bs.map(b => `${b.t} ${b.h}px`).join(", "));
};
const inside = async (page, sel, name) => {
  const bs = await boxes(page, sel);
  row(bs.length === 1 && bs[0].x >= 0 && bs[0].r <= W && bs[0].y >= 0 && bs[0].b <= H, name + ": visible, inside 393x852", bs.length ? JSON.stringify(bs[0]) : "not found");
  return bs[0];
};
const click = async (page, loc, what) => { try { await loc.click({ timeout: 4000 }); return true; } catch(e){ row(false, what, "not clickable: " + String(e.message).split("\n")[0]); return false; } };
const btn = (page, re) => page.getByRole("button", { name: re });

/* S4.4 — the board's player names, measured. `.pname` is drawn inside its seat's `.heromid`; a seat with no name draws nothing. */
const pnames = page => page.evaluate(() => { const o = {};
  for(const k of ["me", "foe"]){ const e = document.querySelector('[data-pname="' + k + '"]'), m = e && e.closest(".heromid"), r = e && e.getBoundingClientRect(), q = m && m.getBoundingClientRect(), rr = m && m.closest(".heror").getBoundingClientRect();
    o[k] = e ? { t: e.textContent, x: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), cut: e.scrollWidth > e.clientWidth, ell: getComputedStyle(e).textOverflow, mx: Math.round(q.left), mr: Math.round(q.right), mw: Math.round(q.width), mh: Math.round(q.height), rx: Math.round(rr.left), rr: Math.round(rr.right) } : null; }
  o.scrollW = document.scrollingElement.scrollWidth; o.n = document.querySelectorAll("[data-pname]").length;
  const hm = [...document.querySelectorAll(".heromid")].map(m => Math.round(m.getBoundingClientRect().width)); o.hm = hm; return o; });

/* drive a page (open at the server table chooser) to the board: the page either opens a table (asHost) or types the code of the scripted phone's */
async function toTheBoard(page, world, B, o){
  if(o.asHost){
    await click(page, btn(page, o.openRe || /^Open a server table/), "open a server table"); await page.waitForSelector(".tblcode");
    const code = await page.evaluate(() => document.querySelector(".tblcode").innerText.trim());
    await B.connect("join", code);
    await page.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
    var codeOut = code;
  } else {
    await B.connect("create"); codeOut = B.code;
    await click(page, btn(page, /^Enter a table code/), "enter a table code"); await page.waitForSelector(".tblin");
    await page.fill(".tblin", B.code); await click(page, btn(page, /^Sit down/), "sit down");
    await page.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  }
  await click(page, page.locator(".lobhero", { hasText: /Blaze/ }).first(), "pick Blaze");
  await click(page, btn(page, /^Lock in/), "lock in");
  await page.waitForSelector(".rthrows", { timeout: 10000 });
  await click(page, page.locator(".rthrows button", { hasText: /rock/i }), "throw rock");
  await page.waitForFunction(() => document.querySelector(".rthrows"), null, { timeout: 10000 });
  await wait(300);
  await click(page, page.locator(".rthrows button", { hasText: /paper/i }), "throw paper");
  await page.waitForFunction(() => document.querySelector(".rseatpick") || /Lock the sideboard/i.test(document.body.innerText), null, { timeout: 10000 });
  if(await page.locator(".rseatpick").count()) await click(page, page.locator(".rseatpick button").first(), "I go first");
  await page.waitForFunction(() => /Lock the sideboard/i.test(document.body.innerText), null, { timeout: 15000 });
  await click(page, btn(page, /^Lock the sideboard/), "lock the sideboard");
  await page.waitForSelector(".board", { timeout: 30000 });
  await wait(500);
  return codeOut;
}
/* a few real actions across the page and the scripted phone, so the names are checked in a game that is being played */
async function playSome(page, world, B, seat, n){
  let did = 0;
  for(let i = 0; i < n * 4 && did < n; i++){
    const moved = await page.evaluate(s => { const t = window.__dawnTable; if(!t) return false; const x = t.session; if(x.status() !== "ready") return false; const a = DawnSparring.act(x.state(), s, { search: false }); if(!a) return false; return !x.submit(a); }, seat).catch(() => false);
    if(moved){ did++; await world.settle([B.ch]); await wait(60); continue; }
    if(await PH.step(world, [B])){ did++; await wait(60); continue; }
    await wait(120);
  }
  return did;
}

async function toServerChooser(page){
  await click(page, btn(page, /^Find an opponent/), "find an opponent");
  await page.waitForSelector(".tblwrap");
  await click(page, btn(page, /^Join a server table/), "join a server table");
  await page.waitForSelector(".tblwrap button:has-text('Open a server table')");
}

(async () => {
  const t0 = Date.now();
  const world = makeWorld({ seedKey: "page" });
  let real = null;

  /* ---- 1. THE REAL TRANSPORT, with nothing deployed ---------------------------------- */
  {
    const kit = await open({ w: W, h: H });
    const { page, context, errors } = kit;
    let hits = 0;
    await context.route(/supabase\.co/, route => { hits++; route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Requested function was not found" }) }); });
    row(hits === 0, "the page loaded without one request to the server project (lazy)", "hits " + hits);
    await page.evaluate(() => { delete window.__dawnServerTransport; });

    /* THE SWITCH (index.html window.SERVER_TABLE.on). The shipped value, then OFF forced, then ON forced. */
    const cfg = await page.evaluate(() => JSON.parse(JSON.stringify(window.SERVER_TABLE || null)));
    row(!!cfg && typeof cfg.on === "boolean" && cfg.fn === "table" && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.url) && /^sb_publishable_/.test(cfg.key),
        "the switch: window.SERVER_TABLE is {on, url, key, fn:'table'} with a publishable key", "shipped on=" + (cfg && cfg.on));
    const offState = async (label) => {
      await page.evaluate(() => { window.SERVER_TABLE.on = false; });
      await page.getByRole("button", { name: /^Find an opponent/ }).click();
      await page.waitForSelector(".tblwrap");
      const t = await text(page);
      if(process.env.DEBUG_DRIVE) console.log("OFF TEXT:", t.match(/.{0,60}server.{0,60}/gi));
      row(!/server table/i.test(t) && (await boxes(page, ".tblwrap button")).every(b => !/server/i.test(b.t)) && /open a table/i.test(t), label + ": OFF - the table screen offers no server table at all (no button, no blurb), the direct options are there");
      row(hits === 0, label + ": OFF - no request to the project", "hits " + hits);
      row(await overflow(page), label + ": OFF - no horizontal overflow"); await thumbs(page, label + " (off)");
      /* and no server code path can start: the page's own transport, off, is inert */
      const r = await page.evaluate(async () => { const t = DawnServerTable.defaultTransport(window.SERVER_TABLE); try { await t.post({ op: "create" }); return "answered"; } catch(e){ return e.why || "?"; } });
      row(r === "unavailable" && hits === 0, label + ": OFF - the transport the page would use answers unavailable without a request", r + ", hits " + hits);
      await click(page, btn(page, /^Back/), "back out of the table screen");
      await page.waitForSelector("button:has-text('Find an opponent')");
    };
    await offState("switch");
    await page.evaluate(() => { window.SERVER_TABLE.on = true; });
    await page.getByRole("button", { name: /^Find an opponent/ }).click();
    await page.waitForSelector(".tblwrap");
    const home = await text(page);
    /* v6.82 (NEXT 4): the honest lines are one sheet, one tap from the buttons: closed, the screen is the choices; open, every table's line is there */
    await click(page, page.locator('[data-testid="hands-open"]'), "open how each table keeps hands hidden");
    await page.waitForSelector('[data-testid="hands-sheet"]', { timeout: 4000 }).catch(() => {});
    const sheet = await text(page);
    row(/Join a server table/i.test(home) && /no direct link needed/i.test(home) && !/(referee on the web|host's phone|judge's device) holds the deck/i.test(home) && /How each table keeps hands hidden/i.test(home) && !/early test/i.test(home), "table screen: the server option sits beside the direct ones, in player words (not an early test); the honest lines are behind one button, not under the choices");
    row(/referee on the web holds the deck/i.test(sheet) && /host's phone holds the deck/i.test(sheet) && /judge's device holds the deck/i.test(sheet), "hands sheet: one tap shows the honest line for the server, direct and judged tables");
    const sb = await boxes(page, '[data-testid="hands-sheet"] .bugsheet');
    row(sb.length === 1 && sb[0].x >= 0 && sb[0].r <= W && await overflow(page), "hands sheet: inside 393 wide, no horizontal overflow", JSON.stringify(sb[0])); await thumbs(page, "hands sheet");
    await click(page, btn(page, /^Got it/), "close the hands sheet");
    row((await boxes(page, '[data-testid="hands-sheet"]')).length === 0, "hands sheet: Got it closes it");
    /* THREE CHOICES SIDE BY SIDE (v6.28): server, direct, judge's - each a labelled group, stacked in order, all inside 393 wide, their buttons visible on the first screen */
    const grp = await page.evaluate(() => [...document.querySelectorAll(".tblgroup")].map(g => { const r = g.getBoundingClientRect(), n = (g.querySelector(".tblgname") || {}).textContent;
      const bs = [...g.querySelectorAll("button")].map(b => { const q = b.getBoundingClientRect(); return { t: b.textContent.trim(), x: Math.round(q.left), r: Math.round(q.right), y: Math.round(q.top), b: Math.round(q.bottom), h: Math.round(q.height) }; });
      return { n, x: Math.round(r.left), r: Math.round(r.right), y: Math.round(r.top), b: Math.round(r.bottom), bs }; }));
    row(grp.map(g => g.n).join("|") === "Server table|Direct table|Judge's table", "table screen: three labelled choices in order: server, direct, judge's", grp.map(g => g.n).join("|"));
    row(grp.length === 3 && grp.every((g, i) => g.x >= 0 && g.r <= W && (i === 0 || g.y >= grp[i - 1].b)) && grp.every(g => g.bs.length > 0 && g.bs.every(b => b.x >= 0 && b.r <= W && b.h >= 40 && b.b <= H)),
        "table screen: the three groups do not overlap, stay inside 393 wide, and every button is thumb-sized and on the first 852px", grp.map(g => `${g.n} y${g.y}-${g.b}`).join(", "));
    row(grp.every(g => g.bs.every((a, i) => g.bs.every((c, j) => j <= i || a.r <= c.x || c.r <= a.x || a.b <= c.y || c.b <= a.y))), "table screen: no two buttons overlap");
    row(await overflow(page), "table screen: no horizontal overflow");
    await thumbs(page, "table screen");
    await click(page, btn(page, /^Join a server table/), "join a server table");
    await page.waitForSelector(".tblwrap button:has-text('Open a server table')");
    row(await overflow(page), "server chooser: no horizontal overflow"); await thumbs(page, "server chooser");
    await click(page, btn(page, /^Open a server table/), "open a server table");
    await page.waitForSelector(".tblerr", { timeout: 8000 }).catch(() => {});
    const gone = await text(page);
    row(/not answering/.test(gone) && /direct two-phone table/.test(gone) && !/Reaching the server/.test(gone), "unavailable: it says so (and does not hang on connecting)", hits + " request(s) to the project");
    row(hits >= 1, "the real transport reached for the project's function (answered 404 here)", "hits " + hits);
    await inside(page, ".tblerr", "unavailable: the message");
    row(await overflow(page), "unavailable: no horizontal overflow"); await thumbs(page, "unavailable");
    row(/Use a direct table instead/i.test(await text(page)), "unavailable: the direct table is offered");
    await click(page, btn(page, /^Use a direct table instead/), "use a direct table");
    await page.waitForSelector("button:has-text('Open a table')");
    row(await page.evaluate(() => !!document.querySelector(".tblwrap") && /Open a table/i.test(document.body.innerText)), "unavailable: one tap lands on the direct table's options");
    /* the only errors the page may have raised are the 404 the route answered */
    const bad = errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0, "no page error besides the 404 the route answered", bad.join(" | ").slice(0, 200));
    await kit.close();
  }

  /* ---- 1b. THE DOOR (v6.28): open for everyone; ?server=0 hides it on one phone (remembered); ?server=1 brings it back ---- */
  {
    let hits = 0;
    const doorKit = async (query) => { const k = await open({ w: W, h: H, query }); await k.context.route(/supabase\.co/, route => { hits++; route.fulfill({ status: 404, body: "{}" }); }); return k; };
    const offersServer = async (p) => { await p.getByRole("button", { name: /^Find an opponent/ }).click(); await p.waitForSelector(".tblwrap");
      const r = { btn: await p.evaluate(() => [...document.querySelectorAll("button")].some(b => /^Join a server table/.test(b.textContent.trim()))), note: /early test/i.test(await text(p)) };
      await click(p, btn(p, /^Back/), "back"); await p.waitForSelector("button:has-text('Find an opponent')"); return r; };
    const reopen = async (p, href, query) => { await p.goto(href + query); await p.waitForSelector(".shell", { timeout: 15000 });
      await p.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 30000 }); };
    const k0 = await doorKit("");
    row(await k0.page.evaluate(() => window.SERVER_TABLE.on === true), "the door: the shipped switch is open");
    let r = await offersServer(k0.page);
    row(r.btn && !r.note, "the door: no query - everyone sees the server option, and it is not called an early test");
    const txt = await (async () => { await k0.page.getByRole("button", { name: /^Find an opponent/ }).click(); await k0.page.waitForSelector(".tblwrap");
      await click(k0.page, k0.page.locator('[data-testid="hands-open"]'), "open the hands sheet"); const t = await text(k0.page); await click(k0.page, btn(k0.page, /^Got it/), "close the hands sheet"); await click(k0.page, btn(k0.page, /^Back/), "back"); await k0.page.waitForSelector("button:has-text('Find an opponent')"); return t; })();
    row(!/sb_publishable|supabase|v6\.\d|seedG|nonce|SERVER_TABLE/i.test(txt.match(/Server table Get matched[\s\S]{0,160}/i)[0] + (txt.match(/At a server table[\s\S]{0,330}/i) || ["sb_publishable (no server line)"])[0]), "the door: the option reads in player language (no identifiers or version numbers)");
    await reopen(k0.page, k0.href, "?server=0");
    r = await offersServer(k0.page);
    row(!r.btn, "the door: ?server=0 hides it on this phone (kill switch)");
    row(await k0.page.evaluate(() => window.SERVER_TABLE.on === true && window.localStorage.getItem("dawnblade.server") === "false"), "the door: the choice is kept in the page's store seam, the shipped switch untouched");
    await reopen(k0.page, k0.href, "");
    r = await offersServer(k0.page);
    row(!r.btn && hits === 0, "the door: a relaunch without the query keeps it hidden; no request reached the project while only looking", "hits " + hits);
    await reopen(k0.page, k0.href, "?server=1");
    r = await offersServer(k0.page);
    row(r.btn, "the door: ?server=1 brings it back");
    await reopen(k0.page, k0.href, "");
    r = await offersServer(k0.page);
    row(r.btn, "the door: and it stays");
    /* THE RULES NEED THE CARDS: the page registers its card database with the judge engine (it did not until v6.26, and a replay of a
       server game diverged at the first token the server minted). Seeded Viserai v Dorinthea, played through the page's own judge. */
    const tokens = await k0.page.evaluate(() => {
      const db = loadPool(), heroes = Object.fromEntries(HEROES.map(h => [h.k, h])), decks = Object.fromEntries(HEROES.map(h => [h.k, PARSED[h.k]]));
      /* THREE SEEDS, SUMMED (v6.81): one seed alone stopped reaching a token made through the database as the AI changed (v6.79 read 0 missing with the sabotage on) */
      const play = () => ["probe", "probe-1", "probe-2"].map(play1).reduce((a, b) => ({ n: a.n + b.n, missing: a.missing + b.missing, rune: a.rune + b.rune }));
      const play1 = seed => { const m = DawnBuild.buildMatch({ heroes: ["viserai", "dorinthea"], seed, first: 0, boards: [{}, {}] }, { db, heroes, decks });
        let g = DawnJudge.newMatch({ builds: m.builds, names: m.names, heroKeys: m.heroKeys, first: m.first, seed: m.seed }), n = 0;
        while(!g.over && n++ < 600){ let moved = false; for(const s of [0, 1]){ const a = DawnSparring.act(g, s, { search: false }); if(!a) continue; const r = DawnJudge.reduce(g, a, s); if(r.error) break; g = r.state; moved = true; break; } if(!moved) break; }
        const feed = (g.feed || []).map(f => typeof f === "string" ? f : (f.t || f.text || JSON.stringify(f))).join("\n");
        return { n, missing: (feed.match(/token not created/g) || []).length, rune: (feed.match(/Runechant/g) || []).length }; };
      const on = play();                    /* as the page loaded: whatever the page registered */
      DawnJudge.setDb(null); const off = play(); DawnJudge.setDb(db);   /* the sabotage: no database registered, then put back */
      return { off, on }; });
    row(tokens.off.missing >= 1, "card database: the probe sees a token go missing when the judge has no database (sabotage applied)", JSON.stringify(tokens.off));
    row(tokens.on.missing === 0 && tokens.on.rune > 0, "card database: the page's judge has the database - every token a card makes is made", JSON.stringify(tokens.on));
    await k0.close();
  }

  /* ---- 1c. THE REAL LOADER PATH (v6.27): the page's own config through the real transport, the library fetched the way a phone
          fetches it (from the CDN address, served here by page.js's local route). v6.26 asked the PROJECT for its script, so no browser
          ever got a push, while every drive passed: they all installed a fake transport or a `lib`. This row cannot pass that way. ---- */
  {
    const kit = await open({ w: W, h: H });
    const { page, context } = kit;
    const build = await page.evaluate(() => TABLE_BUILD);
    const w3 = makeWorld({ seedKey: "loader", build, deal: dealLikeThePage });
    const scripts = [];
    page.on("request", r => { if(r.resourceType() === "script") scripts.push(r.url()); });
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };
    await context.route(/supabase\.co\/functions/, async route => {
      const req = route.request();
      if(req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const ans = await w3.transport("PAGE").post(JSON.parse(req.postData() || "{}"));
      route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(ans) });
    });
    await context.route(/supabase\.co\/realtime/, route => route.abort());      /* no socket offline: the subscription reads lost, which is fine here */
    /* S4.2 — THE REAL SIGN-IN (engine/servertable.js supabaseIdentity, the page's own config): the auth service is answered here */
    const idp3 = F.memIdentity(), tok3 = idp3.issue("P-page-real"), auths = [];
    w3.deps.identify = t => idp3.identify(t); w3.deps.rename = (p, n, f) => idp3.rename(p, n, f);
    await context.route(/supabase\.co\/auth/, async route => {
      const req = route.request();
      if(req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      auths.push({ url: req.url(), apikey: req.headers().apikey, body: req.postData() });
      route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ access_token: tok3, refresh_token: "page-refresh-1", expires_in: 3600, token_type: "bearer", user: { is_anonymous: true } }) });
    });
    await page.evaluate(() => { delete window.__dawnServerTransport; delete window.__dawnServerIdentity; window.SERVER_TABLE.on = true; });
    await toServerChooser(page);
    row(auths.length === 0, "real sign-in: nothing is asked of the auth service until a table is opened (lazy)", "asks " + auths.length);
    await click(page, btn(page, /^Open a server table/), "open a server table (real transport)");
    await page.waitForSelector(".tblcode", { timeout: 15000 }).catch(() => {});
    {
      const code3 = await page.evaluate(() => { const e = document.querySelector(".tblcode"); return e ? e.innerText.trim() : ""; });
      const r3 = ST.isValid(code3) ? w3.row(code3) : null;
      row(auths.length === 1 && /\/auth\/v1\/signup$/.test(auths[0].url) && /^sb_publishable_/.test(auths[0].apikey || "") && auths[0].body === "{}",
          "real sign-in: opening a table made ONE anonymous sign-up with the publishable key", JSON.stringify(auths.map(a => a.url.replace(/^.*supabase\.co/, ""))));
      row(!!r3 && r3.v === 3 && r3.owners[0] === "P-page-real", "real sign-in: the seat the page was dealt belongs to the signed-in player", r3 ? JSON.stringify(r3.owners) : "no table");
      const kept = await page.evaluate(() => JSON.parse(window.localStorage.getItem("dawnblade.who.id") || "null"));
      row(!!kept && kept.r === "page-refresh-1" && typeof kept.exp === "number", "real sign-in: the session is kept on the phone for next time");
    }
    await page.waitForFunction(() => window.supabase && window.supabase.createClient, null, { timeout: 15000 }).catch(() => {});
    const lib = await page.evaluate(() => !!(window.supabase && window.supabase.createClient));
    const cdn = scripts.filter(u => /supabase-js/.test(u)), proj = scripts.filter(u => /supabase\.co/.test(u));
    row(cdn.length === 1 && cdn[0] === ST.SUPABASE_JS && proj.length === 0 && lib,
        "real loader: the page's own config makes the page fetch supabase-js from the CDN address (never the project) and the library is there", "scripts " + JSON.stringify(scripts.filter(u => /supabase/.test(u))));
    await kit.close();
  }

  /* ---- 2. THE FAKE: a table, seated, played -------------------------------------------- */
  const kit = await open({ w: W, h: H });
  const { page, errors } = kit;
  const build = await page.evaluate(() => TABLE_BUILD);
  const world2 = makeWorld({ seedKey: "page", build, deal: dealLikeThePage });
  await wire(page, world2);
  /* S4.2 — players: the fake referee knows a sign-in provider and a name registry; the page and the scripted phone are players */
  const idp = F.memIdentity(), tokPage = idp.issue("P-page"), tokB = idp.issue("P-phone-b"), tok0 = () => tokPage;
  world2.deps.identify = t => idp.identify(t); world2.deps.rename = (p, n, f) => idp.rename(p, n, f);
  idp.rename("P-phone-b", "Rival One", world2.server.nameFold("Rival One"));
  /* S4.3 — recovery codes: the fake backend behaves like 004_recovery.sql (test/helpers/serverfakes.js withRecovery) */
  const rec = F.withRecovery(idp); world2.deps.mint = (p, h, d) => rec.mint(p, h, d); world2.deps.redeem = (t, h) => rec.redeem(t, h);
  const idShim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokPage) + ")};";
  await page.addInitScript(idShim); await page.evaluate(idShim);
  await page.evaluate(() => { window.SERVER_TABLE.on = true; });          /* the drive forces the switch ON */

  /* a code that nobody opened; a table that is full */
  await toServerChooser(page);
  await click(page, btn(page, /^Enter a table code/), "enter a table code");
  await page.waitForSelector(".tblin");
  row(await page.evaluate(() => document.querySelector(".tblin").value === ""), "code entry: empty");
  row((await boxes(page, ".tblin")).every(b => b.x >= 0 && b.r <= W), "code entry: the field is inside the screen");
  await page.fill(".tblin", "zzzzzz");
  await click(page, btn(page, /^Sit down/), "sit down");
  await page.waitForSelector(".tblerr");
  row(/No table is open with that code/.test(await text(page)), "table code not found: said plainly");
  await inside(page, ".tblerr", "not found: the message"); await thumbs(page, "not found");
  {
    const rand = T.seeded("full");
    const X = PH.makePhone(world2, "X", { hero: "kayo", rand, build, matchCatalog }), Y = PH.makePhone(world2, "Y", { hero: "dash", rand, build, matchCatalog });
    await X.connect("create"); await Y.connect("join", X.code);
    await page.fill(".tblin", X.code);
    await click(page, btn(page, /^Sit down/), "sit down (full)");
    await page.waitForFunction(() => /already has two players/i.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    row(/already has two players/.test(await text(page)), "table full: said plainly");
    X.ch.close(); Y.ch.close();
  }
  await click(page, btn(page, /^Back/), "back to the chooser");

  /* ---- THE NAME SHEET (S4.2) ---- */
  {
    const who0 = await text(page);
    row(/No player name yet/i.test(who0) && /Choose a name/.test(who0), "name: with no name the chooser says so and offers to choose one");
    await thumbs(page, "name row");
    await click(page, btn(page, /^Choose a name/), "choose a name");
    await page.waitForSelector(".tblname");
    await inside(page, ".tblname", "name sheet: the field");
    row(await overflow(page), "name sheet: no horizontal overflow"); await thumbs(page, "name sheet");
    const saveOff = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^Save name/.test(x.textContent.trim())); return !!b && b.disabled; });
    await page.fill(".tblname", "ab");
    row(await saveOff(), "name sheet: two letters cannot be saved");
    const tryName = async (name, re, what) => {
      await page.fill(".tblname", name); await click(page, btn(page, /^Save name/), "save " + name);
      await page.waitForFunction(r => new RegExp(r, "i").test((document.querySelector(".tblerr") || {}).innerText || ""), re.source, { timeout: 5000 }).catch(() => {});
      const e = await page.evaluate(() => (document.querySelector(".tblerr") || {}).innerText || "");
      row(re.test(e) && !/undefined|bad-request|name-taken|reserved\b/.test(e), what, e.slice(0, 90));
    };
    await tryName("Judge", /set aside/i, "name sheet: a reserved name is refused in plain words");
    await tryName("Ana!", /letters, numbers/i, "name sheet: a symbol is refused in plain words");
    await tryName("rival 0ne", /already has that name/i, "name sheet: another player's name (a look-alike of it) is refused as taken");
    await inside(page, ".tblerr", "name sheet: the refusal");
    row(idp.names.size === 1, "name sheet: no refused name was stored", "stored " + idp.names.size);
    await page.fill(".tblname", "Dawn Smith"); await click(page, btn(page, /^Save name/), "save Dawn Smith");
    await page.waitForFunction(() => /Playing as/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
    const who1 = await text(page);
    row(/Playing as\s+Dawn Smith/.test(who1) && /Open a server table/i.test(who1) && !/No player name yet/.test(who1), "name: saved, the chooser reads 'Playing as Dawn Smith'");
    row(idp.names.get("P-page") && idp.names.get("P-page").name === "Dawn Smith", "name: the registry holds it for this player");
    row(await page.evaluate(() => JSON.parse(window.localStorage.getItem("dawnblade.who.name")) === "Dawn Smith"), "name: the phone remembers it");
    row(await overflow(page), "name row: no horizontal overflow"); await thumbs(page, "name row (named)");
    /* S5.1: the screens also READ the player's rating (an `me` with no name), so the saves are the requests that carry a name */
    const sentMe = world2.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "me" && e.name !== undefined);
    row(sentMe.length === 4 && sentMe.every(e => e.identity && e.identity.token === tokPage), "name: each save was one request carrying the sign-in", sentMe.length + " requests");
  }

  /* ---- A RECOVERY CODE, MINTED ON ONE PAGE AND REDEEMED ON A SECOND (S4.3) ---- */
  {
    await click(page, btn(page, /^Change/), "change the name (opens the name sheet)");
    await page.waitForSelector(".tblname");
    const sheet = await text(page);
    row(/If you lose this phone/i.test(sheet) && /Get a recovery code/i.test(sheet) && /I have a code/i.test(sheet), "recovery: the name sheet offers 'Get a recovery code' and 'I have a code', with a plain line about why");
    row(await overflow(page), "recovery: the sheet has no horizontal overflow"); await thumbs(page, "recovery sheet");
    await click(page, btn(page, /^Get a recovery code/), "get a recovery code");
    await page.waitForSelector(".tblrec");
    const box = await inside(page, ".tblrec", "recovery: the code");
    const code = await page.evaluate(() => document.querySelector(".tblrec").innerText.trim());
    row(/^[A-HJ-KM-NP-Z2-9]{5}(-[A-HJ-KM-NP-Z2-9]{5}){2}$/.test(code), "recovery: the code is three groups of five, no look-alike characters", code);
    row(!!box && box.h >= 30 && box.r - box.x >= 200, "recovery: the code is large enough to copy down", box && (box.r - box.x) + "x" + box.h);
    const shown = await text(page);
    row(/Write this down/.test(shown) && /shown only once/.test(shown) && /new code, this one stops working/.test(shown), "recovery: it says write it down, that it is shown once, and that a new code replaces it");
    row(!/recovery-|undefined|bad-request|identity\b/.test(shown), "recovery: no identifier or field name in the words");
    await thumbs(page, "recovery code shown"); row(await overflow(page), "recovery: no overflow with the code shown");
    row(rec.codes.size === 1 && ![...rec.codes.keys()].includes(code.replace(/-/g, "")), "recovery: the server holds one hash, not the code", rec.codes.size + " held");
    await click(page, btn(page, /^I wrote it down/), "I wrote it down");
    await page.waitForSelector("button:has-text('Get a recovery code')");
    const gone = await page.evaluate(c => { const plain = c.replace(/-/g, ""); const blob = document.documentElement.innerHTML + JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage));
      return blob.indexOf(c) < 0 && blob.indexOf(plain) < 0; }, code);
    row(gone, "recovery: once dismissed the code is nowhere on the page or in the phone's storage");

    /* the SECOND page: a new phone, its own fresh sign-in, no name */
    const kit2 = await open({ w: W, h: H });
    const p2 = kit2.page, tokNew = idp.issue("P-new-phone");
    await wire(p2, world2);
    const shim2 = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokNew) + ")};";
    await p2.addInitScript(shim2); await p2.evaluate(shim2);
    await p2.evaluate(() => { window.SERVER_TABLE.on = true; });
    await toServerChooser(p2);
    row(/No player name yet/.test(await text(p2)), "recovery: the new phone starts with no name");
    await click(p2, btn(p2, /^Choose a name/), "choose a name (second page)");
    await p2.waitForSelector(".tblname");
    await click(p2, btn(p2, /^I have a code/), "I have a code");
    await p2.waitForSelector(".tblrecin");
    await inside(p2, ".tblrecin", "recovery: the code field"); await thumbs(p2, "recovery entry"); row(await overflow(p2), "recovery: the entry has no overflow");
    const goOff = () => p2.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^Recover my player/.test(x.textContent.trim())); return !!b && b.disabled; });
    row(await goOff(), "recovery: an empty field cannot be sent");
    /* a wrong code: plain words, the same for any reason it might be wrong */
    await p2.fill(".tblrecin", "abcde fghjk mnpqr"); await click(p2, btn(p2, /^Recover my player/), "recover (wrong code)");
    await p2.waitForSelector(".tblerr");
    const werr = await p2.evaluate(() => document.querySelector(".tblerr").innerText.replace(/\s+/g, " ").trim());
    row(/did not work/.test(werr) && /works once/.test(werr) && !/recovery-|undefined|expired|used|wrong/i.test(werr.replace(/A code works once/, "")), "recovery: a wrong code is refused in plain words that do not say why it failed", werr.slice(0, 120));
    await inside(p2, ".tblerr", "recovery: the refusal");
    row(idp.live.get(tokNew).player === "P-new-phone", "recovery: a wrong code moved nothing");
    /* the right code, typed the way a person might: lower case, spaces */
    await p2.fill(".tblrecin", code.toLowerCase().replace(/-/g, " ")); await click(p2, btn(p2, /^Recover my player/), "recover (right code)");
    await p2.waitForSelector("[data-testid=rec-done]");
    const done = await inside(p2, "[data-testid=rec-done]", "recovery: the welcome");
    row(!!done && /Welcome back, Dawn Smith\. This phone is you now\./.test(done.t), "recovery: the new phone's sheet shows the recovered name", done && done.t);
    row(await p2.evaluate(() => JSON.parse(window.localStorage.getItem("dawnblade.who.name")) === "Dawn Smith"), "recovery: the new phone remembers the recovered name");
    row(idp.live.get(tokNew).player === "P-page" && idp.live.get(tok0()).player === "P-page", "recovery: the new sign-in and the old one are the same player");
    row(rec.deleted.join() === "P-new-phone", "recovery: the throwaway player was removed", rec.deleted.join());
    const sentR = world2.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "recovery-redeem");
    row(sentR.length === 2 && sentR.every(e => e.identity && e.identity.token === tokNew && !("table" in e)), "recovery: each try was one request carrying the new sign-in", sentR.length + " tries");
    await thumbs(p2, "recovery welcome"); row(await overflow(p2), "recovery: the welcome has no overflow");
    await click(p2, btn(p2, /^Done/), "done");
    await p2.waitForSelector("button:has-text('Open a server table')");
    row(/Playing as\s+Dawn Smith/.test(await text(p2)), "recovery: back on the chooser it reads 'Playing as Dawn Smith'");
    /* the same code a second time (from a third sign-in): one answer, nothing moves */
    await click(p2, btn(p2, /^Change/), "change (second page)"); await p2.waitForSelector(".tblname");
    const tokThird = idp.issue("P-third-phone");
    await p2.evaluate(t => { window.__dawnServerIdentity = {token: () => Promise.resolve(t)}; }, tokThird);
    await click(p2, btn(p2, /^I have a code/), "I have a code (again)"); await p2.waitForSelector(".tblrecin");
    await p2.fill(".tblrecin", code); await click(p2, btn(p2, /^Recover my player/), "recover (used code)"); await p2.waitForSelector(".tblerr");
    row(/did not work/.test(await p2.evaluate(() => document.querySelector(".tblerr").innerText)) && idp.live.get(tokThird).player === "P-third-phone", "recovery: a used code is refused the same way and moves nothing");
    row(world2.errors.length === 0, "recovery: no internal error on the fake server", world2.errors.join("|").slice(0, 150));
    const bug2 = kit2.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bug2.length === 0, "recovery: no page error on the second page", bug2.join(" | ").slice(0, 200));
    await kit2.close();
    await click(page, btn(page, /^Back/), "back to the chooser (first page)");
    await page.waitForSelector("button:has-text('Open a server table')");
  }

  /* open one: waiting */
  await click(page, btn(page, /^Open a server table/), "open a server table");
  await page.waitForSelector(".tblcode");
  const code = await page.evaluate(() => document.querySelector(".tblcode").innerText.trim());
  row(ST.isValid(code), "waiting: a short code is shown to share", code);
  await inside(page, ".tblcode", "waiting: the code");
  const live = await text(page);
  row(/waiting for your opponent/i.test(live) && /Cancel/i.test(live), "waiting: it says it is waiting for the opponent, and offers Cancel");
  row(await overflow(page), "waiting: no horizontal overflow"); await thumbs(page, "waiting");

  /* the other phone types the code */
  const rand = T.seeded("page-b");
  const B = PH.makePhone(world2, "B", { hero: "dorinthea", rand, build, matchCatalog, throws: [["rock", "rock"], ["paper", "rock"]], identity: { token: async () => tokB } });
  await B.connect("join", code);
  await page.waitForFunction(() => /server table/i.test(document.body.innerText) && /Choose your fighter/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  const seated = await text(page);
  if(process.env.DEBUG_DRIVE) console.log('DEBUG seated text:', seated.slice(0, 400), JSON.stringify(B.ch.report()), world2.posts.slice(-6));
  row(/Choose your fighter/i.test(seated) && /seat 0 · server table/i.test(seated), "both seated: the lobby opens at seat 0, labelled a server table");
  row(await overflow(page), "lobby: no horizontal overflow");
  row(await page.evaluate(() => !document.querySelector(".srvbar")), "lobby: no server banner while the link is fine");
  /* S4.2: both seats are players; the lobby names them (the opener learns the joiner's name when the joiner sits down) */
  await page.waitForFunction(() => /Rival One/.test((document.querySelector(".tblvs") || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
  row(/^Dawn Smith\s+vs\s+Rival One$/.test(await page.evaluate(() => ((document.querySelector(".tblvs") || {}).innerText || "").trim())), "lobby: it reads 'Dawn Smith vs Rival One'");
  await inside(page, ".tblvs", "lobby: the names line");
  row(JSON.stringify(world2.row(code).owners) === JSON.stringify(["P-page", "P-phone-b"]), "both seats belong to their players in the stored table");
  row(await page.evaluate(([a, b]) => document.documentElement.innerHTML.indexOf(a) < 0 && document.documentElement.innerHTML.indexOf(b) < 0, ["P-page", "P-phone-b"]), "no player id is anywhere in the page");

  /* the lobby: hero, throw (a tie, then paper over rock), seating, sideboard */
  await click(page, page.locator(".lobhero", { hasText: /Blaze/ }).first(), "pick Blaze");
  await click(page, btn(page, /^Lock in/), "lock in");
  await page.waitForSelector(".rthrows", { timeout: 10000 });
  await click(page, page.locator(".rthrows button", { hasText: /rock/i }), "throw rock");
  await page.waitForFunction(() => document.querySelector(".rthrows"), null, { timeout: 10000 });
  await wait(300);
  await click(page, page.locator(".rthrows button", { hasText: /paper/i }), "throw paper");
  await page.waitForSelector(".rseatpick", { timeout: 10000 });
  await click(page, page.locator(".rseatpick button").first(), "I go first");
  await page.waitForFunction(() => /Lock the sideboard/i.test(document.body.innerText), null, { timeout: 15000 });
  await click(page, btn(page, /^Lock the sideboard/), "lock the sideboard");
  await page.waitForFunction(() => window.__dawnTable && window.__dawnTable.report().seq != null && (document.querySelector(".board") || {}).offsetParent !== undefined, null, { timeout: 30000 }).catch(() => {});
  await page.waitForSelector(".board", { timeout: 30000 });
  await wait(500);
  row(await page.evaluate(() => !!window.__dawnTable && window.__dawnTable.host === false && window.__dawnTable.seat === 0), "the board is up: this page is seat 0 of a server table");

  /* opening turns: the page's own net session through its own server channel, the scripted phone for seat 1 */
  const play = async (n) => {
    let did = 0;
    for(let i = 0; i < n * 3 && did < n; i++){
      const pageMoved = await page.evaluate(() => { const s = window.__dawnTable.session; if(s.status() !== "ready") return false;
        const a = DawnSparring.act(s.state(), 0, { search: false }); if(!a) return false; return !s.submit(a); }).catch(() => false);
      if(pageMoved){ did++; await world2.settle([B.ch]); await wait(60); await world2.settle([B.ch]); continue; }
      const bMoved = await PH.step(world2, [B]);
      if(bMoved){ did++; await wait(60); continue; }
      await wait(150);
    }
    return did;
  };
  await page.waitForFunction(() => window.__dawnTable.session.state() != null, null, { timeout: 15000 }).catch(() => {});
  if(process.env.DEBUG_DRIVE) console.log('DEBUG play:', JSON.stringify(await page.evaluate(() => { const s = window.__dawnTable.session; return {st: s.status(), seq: s.seq(), has: s.state() != null, err: [...document.querySelectorAll('.tblerr')].map(e => e.innerText).join('/'), stats: s.stats ? s.stats() : null}; })), B.sess && B.sess.status(), B.ch.report(), world2.posts.slice(-8));
  const moves = await play(24);
  await wait(400); await world2.settle([B.ch]);
  const rep = await page.evaluate(() => window.__dawnTable.report());
  const full = PH.storedGame(world2, code);
  row(moves >= 20, "the opening turns were played across the page and the scripted phone", moves + " actions");
  row(rep.hash === Wr.hash(R.seatView(full, 0)) && B.sess.hash() === Wr.hash(R.seatView(full, 1)), "both phones' fingerprints are the referee's views of their seats", rep.hash);
  row(Wr.hash(full) === Wr.hash(PH.reference(world2.row(code), B.sess.seq(), world2.deps.deal).state()), "the stored game is the in-process referee's, action for action", B.sess.seq() + " actions");
  row(world2.errors.length === 0, "no internal error on the fake server", world2.errors.join("|").slice(0, 150));
  row(await overflow(page), "board: no horizontal overflow");
  /* S4.4: both players' names are on the board, beside each hero */
  await page.waitForFunction(() => document.querySelectorAll("[data-pname]").length === 2, null, { timeout: 8000 }).catch(() => {});
  const pn0 = await pnames(page);
  row(pn0.me && pn0.foe && pn0.me.t === "Dawn Smith" && pn0.foe.t === "Rival One", "board: each seat's player name is beside its hero ('Dawn Smith' mine, 'Rival One' theirs)", JSON.stringify([pn0.me && pn0.me.t, pn0.foe && pn0.foe.t]));
  row(!!pn0.me && !!pn0.foe && [pn0.me, pn0.foe].every(p => p.x >= p.mx && p.r <= p.mr && p.mx >= 0 && p.mr <= W && p.rx >= 0 && p.rr <= W) && pn0.scrollW <= W, "board: each name sits inside its hero's box, inside 393 wide, no horizontal overflow", JSON.stringify(pn0));
  row(!/Dawn Smith|Rival One/.test(await page.evaluate(() => JSON.stringify(window.__dawnTable.report()))), "board: the names are not part of the table's report or state");
  globalThis.__pn0 = pn0;

  /* the link drops and comes back */
  /* the push channel drops (every payload to this page is lost, the subscription reads lost): since the PERF fix the page
     keeps asking the table every 2 s, so the other seat's move STILL arrives, within a poll - not after the 20 s idle poll, and
     with no scary banner while the table answers */
  world2.fault.cut(world2.topicOf(code, 0));
  {
    let seq0 = 0, moved = null;
    for(let i = 0; i < 200 && !moved; i++){
      seq0 = await page.evaluate(() => window.__dawnTable.session.seq());
      moved = await PH.step(world2, [B]);
      if(!moved){ await page.evaluate(() => { const s = window.__dawnTable.session; if(s.status() === "ready"){ const a = DawnSparring.act(s.state(), 0, { search: false }); if(a) s.submit(a); } }); await wait(150); }
    }
    const t0 = Date.now();
    while(Date.now() - t0 < 6000 && (await page.evaluate(() => window.__dawnTable.session.seq())) <= seq0) await wait(50);
    const dt = Date.now() - t0;
    if(process.env.DEBUG_DRIVE) console.log("DEBUG fb:", seq0, JSON.stringify(moved && moved.seat), await page.evaluate(() => window.__dawnTable.session.seq()), B.sess.seq(), B.ch.report().n);
    row(!!moved && (await page.evaluate(() => window.__dawnTable.session.seq())) > seq0 && dt < 5000, "push lost: the other seat's move still reaches the page by the fallback poll, within a few seconds (not the 20 s idle poll)", dt + " ms after the move");
  }
  world2.fault.restore(world2.topicOf(code, 0));
  await page.waitForFunction(() => !document.querySelector(".srvbar"), null, { timeout: 8000 }).catch(() => {});
  row(await page.evaluate(() => !document.querySelector(".srvbar")), "reconnecting: the banner clears when the link is back");

  /* the server goes away mid-game */
  /* a move to make: drive the scripted phone until it is this page's turn (a state, not a wait: the old fixed wait
     timed out under load, no move was submitted, no request failed, and no banner ever came) */
  const pageHasMove = () => page.evaluate(() => { const s = window.__dawnTable && window.__dawnTable.session; return !!(s && s.status() === "ready" && DawnSparring.act(s.state(), 0, { search: false })); });
  for(let i = 0; i < 400 && !(await pageHasMove()); i++){ if(!(await PH.step(world2, [B]))) await wait(50); await world2.settle([B.ch]); }
  row(await pageHasMove(), "unavailable mid-game: the page has a move to submit while the server is down");
  world2.fault.dead();
  await page.evaluate(() => { const s = window.__dawnTable.session; const a = DawnSparring.act(s.state(), 0, { search: false }); if(a) s.submit(a);
    window.__dawnTable.report(); });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForSelector(".srvbar.bad", { timeout: 15000 }).catch(() => {});
  const bad = await inside(page, ".srvbar", "unavailable mid-game: the banner");
  row(!!bad && /not answering/.test(bad.t), "unavailable mid-game: it says so", bad && bad.t);
  world2.fault.dead(false);
  await page.waitForFunction(() => !document.querySelector(".srvbar.bad"), null, { timeout: 15000 }).catch(() => {});
  row(await page.evaluate(() => !document.querySelector(".srvbar.bad")), "unavailable mid-game: it comes back by itself and the banner clears");
  await world2.settle([B.ch]);

  /* a reload: the seat is claimed back from the stored key */
  const seedGBefore = await page.evaluate(() => window.__dawnTable.seedG);
  const nonceBefore = world2.row(code).nonces[0];
  const seqBefore = B.sess.seq();
  await page.reload();
  await page.waitForSelector(".shell");
  await page.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 30000 });
  await page.evaluate(() => window.__installFake());
  await page.evaluate(() => { window.SERVER_TABLE.on = true; });            /* a reload re-reads the shipped value: forced ON again */
  await toServerChooser(page);
  const resumeBtn = page.getByRole("button", { name: new RegExp("^Resume table " + code) });
  row(await resumeBtn.count() === 1, "reload: the table offers to resume this seat", code);
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /^dawnblade\.srv\./.test(k)));
  row(stored.length === 1, "reload: the seat is held in the page's store seam", stored.join(","));
  await click(page, resumeBtn, "resume the table");
  await page.waitForSelector(".board", { timeout: 30000 });
  await wait(800); await world2.settle([B.ch]);
  const rep2 = await page.evaluate(() => window.__dawnTable.report());
  const full2 = PH.storedGame(world2, code);
  row(rep2.seat === 0 && rep2.hash === Wr.hash(R.seatView(full2, 0)), "reload: back at seat 0, on the referee's view of the game", rep2.hash);
  await page.waitForFunction(() => document.querySelectorAll("[data-pname]").length === 2, null, { timeout: 8000 }).catch(() => {});
  { const pn = await pnames(page);
    row(pn.me && pn.foe && pn.me.t === "Dawn Smith" && pn.foe.t === "Rival One", "reload: both names are on the board again, straight from the claimed seat", JSON.stringify([pn.me && pn.me.t, pn.foe && pn.foe.t])); }
  const seedGAfter = await page.evaluate(() => window.__dawnTable.seedG), tableSeedG = world2.row(code).hub.spec.seedG;
  row(!!tableSeedG && seedGBefore === tableSeedG && seedGAfter === tableSeedG, "reload: the page's lobby holds the table's own seed half (so 'verify this game' still opens the right deal)", "before " + String(seedGBefore).slice(0, 8) + ", after " + String(seedGAfter).slice(0, 8) + ", table " + String(tableSeedG).slice(0, 8));
  const stale = world2.answers.filter(a => a.refused === "stale").length;
  row(stale === 0, "reload: no frame was refused as stale");
  const more = await play(10);
  await wait(300); await world2.settle([B.ch]);
  const full3 = PH.storedGame(world2, code), rep3 = await page.evaluate(() => window.__dawnTable.report());
  row(more >= 8 && B.sess.seq() >= seqBefore + 8, "reload: the game went on", more + " more actions");
  row(rep3.hash === Wr.hash(R.seatView(full3, 0)) && B.sess.hash() === Wr.hash(R.seatView(full3, 1)), "reload: both phones still agree with the referee");

  /* THE END, AND "VERIFY THIS GAME" ON A RELOADED SEAT (v6.26): play on to the end of the game, then press the page's own button.
     The reloaded page rebuilt its lobby from the table's replay: its verdict must be the same as a seat that never reloaded. */
  {
    let n = 0, overNow = async () => page.evaluate(() => { const s = window.__dawnTable.session.state(); return !!(s && s.over); });
    for(let i = 0; i < 60 && !(await overNow()); i++){ n += await play(30); await world2.settle([B.ch]); }
    row(await overNow(), "reload: the game was played to its end through the reloaded page", n + " more actions");
    await page.waitForSelector("button:has-text('Verify this game')", { timeout: 20000 }).catch(() => {});
    row(await page.getByRole("button", { name: /^Verify this game/ }).count() === 1, "reload: the end screen offers 'Verify this game'");
    await world2.settle([B.ch]); await wait(500);
    await click(page, page.getByRole("button", { name: /^Verify this game/ }), "verify this game (reloaded seat)");
    await page.waitForFunction(() => /Verified:|Not verified:/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
    const vt = ((await text(page)).match(/(Verified:|Not verified:)[^\n]*/) || [""])[0];
    row(/^Verified:/.test(vt), "reload: the reloaded seat's own 'Verify this game' passes", vt.slice(0, 140));
    const rv = B.sess.revealed(), full4 = PH.storedGame(world2, code), sp = world2.row(code).hub.spec;
    const vB = rv && R.verifyGame({ seedC: B.spec.seedC, seedG: B.spec.seedG, seedH: rv.seedH, start: sd => dealLikeThePage({ ...B.spec, seed: sd }).state, reduce: T.J.reduce, seat: 1, log: rv.log, hashes: B.sess.hashes(), over: rv.over });
    row(!!vB && vB.ok, "the scripted seat (never reloaded) verifies the same game", vB && (vB.ok ? "ok" : vB.why));
    row(!!rv && B.spec.seedG === sp.seedG && Wr.hash(full4) === Wr.hash(PH.reference(world2.row(code), 0, world2.deps.deal).state()), "the finished game is the in-process referee's");
  }

  /* the key is nowhere a player or a report can read it */
  const keys = world2.row(code).hub.keys;
  const shown = await page.evaluate(() => document.body.innerText + JSON.stringify(window.__dawnTable.report()));
  row(keys.every(k => shown.indexOf(k) < 0), "the seat key is not on the screen or in the table report");
  const bug = errors.filter(e => !/404|Failed to load resource/.test(e));
  row(bug.length === 0, "no page error during the whole drive", bug.join(" | ").slice(0, 200));

  /* S4.4 — a seat takeover: the opponent's player sits down on another phone; this page's board keeps both names */
  {
    const B2 = PH.makePhone(world2, "B2", { hero: "dorinthea", rand: T.seeded("page-b2"), build, matchCatalog, throws: [["rock", "rock"], ["paper", "rock"]], identity: { token: async () => tokB } });
    await B2.connect("join", code);
    await world2.settle([B.ch, B2.ch]); await wait(1200);
    const nm = B2.ch.names();
    row(B2.seat === 1 && JSON.stringify(nm) === JSON.stringify(["Dawn Smith", "Rival One"]), "takeover: the phone that took seat 1 reads both names at once", JSON.stringify(nm));
    await page.evaluate(() => window.__dawnTable && window.__dawnTable.report());
    const pn = await pnames(page);
    row(pn.me && pn.foe && pn.me.t === "Dawn Smith" && pn.foe.t === "Rival One", "takeover: this page's board still shows both names", JSON.stringify([pn.me && pn.me.t, pn.foe && pn.foe.t]));
    B2.ch.close();
  }

  await kit.close();

  /* ---- S4.4: LONG NAMES, A NAMELESS OPPONENT, AND THE JOINER'S BOARD (each its own page and world) ---- */
  const LONG_ME = "Wwwwwwwwwwwwwwww", LONG_FOE = "Mmmmmmmmmmmmmmmm";
  for(const phase of [{ label: "long names, page opens the table", asHost: true, me: LONG_ME, foe: LONG_FOE, throws: [["rock", "rock"], ["paper", "rock"]] },
                      { label: "joiner's board, nameless opponent", asHost: false, me: "Seat One", foe: null, throws: [["rock", "rock"], ["rock", "paper"]] }]){
    const kit3 = await open({ w: W, h: H }), p3 = kit3.page;
    const b3 = await p3.evaluate(() => TABLE_BUILD);
    const w3 = makeWorld({ seedKey: "names-" + phase.label, build: b3, deal: dealLikeThePage });
    await wire(p3, w3);
    const idp3 = F.memIdentity(), tokMe = idp3.issue("P-name-me"), tokFoe = idp3.issue("P-name-foe");
    w3.deps.identify = t => idp3.identify(t); w3.deps.rename = (pl, n, f) => idp3.rename(pl, n, f);
    idp3.rename("P-name-me", phase.me, w3.server.nameFold(phase.me));
    if(phase.foe) idp3.rename("P-name-foe", phase.foe, w3.server.nameFold(phase.foe));
    const shim3 = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokMe) + ")};";
    await p3.addInitScript(shim3); await p3.evaluate(shim3);
    await p3.evaluate(() => { window.SERVER_TABLE.on = true; });
    const B3 = PH.makePhone(w3, "B3", { hero: "dorinthea", rand: T.seeded("names-b3"), build: b3, matchCatalog, throws: phase.throws, identity: { token: async () => tokFoe } });
    await toServerChooser(p3);
    const code3 = await toTheBoard(p3, w3, B3, phase);
    await playSome(p3, w3, B3, phase.asHost ? 0 : 1, 6);
    await p3.waitForFunction(n => document.querySelectorAll("[data-pname]").length === n, phase.foe ? 2 : 1, { timeout: 8000 }).catch(() => {});
    const pn = await pnames(p3), L = phase.label;
    row(!!pn.me && pn.me.t === phase.me, L + ": my own name is beside my hero (seat " + (phase.asHost ? 0 : 1) + ")", pn.me && pn.me.t);
    if(phase.foe){
      row(!!pn.foe && pn.foe.t === phase.foe, L + ": the opponent's name is beside their hero", pn.foe && pn.foe.t);
      const ps = [pn.me, pn.foe];
      row(ps.every(p => p && p.x >= p.mx && p.r <= p.mr && p.mr <= W && p.rr <= W) && pn.scrollW <= W, L + ": a 16-letter name stays inside its hero's box and inside 393 wide, no horizontal overflow", JSON.stringify(pn));
      row(ps.every(p => p && p.ell === "ellipsis" && p.h <= 14), L + ": a name is one line with an ellipsis style (never wrapped)", JSON.stringify(ps.map(p => p && [p.cut, p.ell, p.h])));
      const base = globalThis.__pn0;
      row(!!base && ps.every((p, i) => p && Math.abs(p.mw - (i === 0 ? base.me.mw : base.foe.mw)) <= 1 && Math.abs(p.mh - (i === 0 ? base.me.mh : base.foe.mh)) <= 1), L + ": the hero boxes are exactly as wide and as tall as with a short name (the long name pushed nothing)", JSON.stringify([pn.me.mw, pn.me.mh, pn.foe.mw, pn.foe.mh]) + " vs " + JSON.stringify([base.me.mw, base.me.mh, base.foe.mw, base.foe.mh]));
      /* on a narrower phone the same names no longer fit their boxes: they are cut with an ellipsis, inside the box, never pushing the row */
      await p3.setViewportSize({ width: 320, height: 568 }); await wait(400);
      const nn = await pnames(p3), qs = [nn.me, nn.foe];
      row(qs.every(p => p && p.x >= p.mx && p.r <= p.mr && p.rr <= 320 && p.h <= 14) && nn.scrollW <= 320 && qs.some(p => p.cut), L + ": at 320 wide a 16-letter name is cut cleanly with an ellipsis, inside its box, no overflow", JSON.stringify(nn));
      await p3.setViewportSize({ width: W, height: H }); await wait(300);
    } else {
      row(pn.foe === null && pn.n === 1, L + ": a player with no name draws nothing beside their hero", "elements " + pn.n);
      const hmNone = await p3.evaluate(() => [...document.querySelectorAll(".heromid")].map(m => m.innerText.replace(/\s+/g, " ").trim()));
      row(hmNone.length === 2 && !hmNone.some(t => /undefined|null|no name/i.test(t)), L + ": no placeholder text in the nameless seat's box", JSON.stringify(hmNone));
    }
    row(await overflow(p3), L + ": board: no horizontal overflow");
    row(w3.errors.length === 0, L + ": no internal error on the fake server", w3.errors.join("|").slice(0, 150));
    const bad3 = kit3.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad3.length === 0, L + ": no page error", bad3.join(" | ").slice(0, 200));
    void code3;
    B3.ch.close(); await kit3.close();
  }

  /* ---- S4.4: THE CAP OF OPEN TABLES, ON THE PAGE ---- */
  {
    const kit4 = await open({ w: W, h: H }), p4 = kit4.page;
    const b4 = await p4.evaluate(() => TABLE_BUILD);
    const w4 = makeWorld({ seedKey: "cap-page", build: b4, deal: dealLikeThePage });
    await wire(p4, w4);
    const idp4 = F.memIdentity(), tokCap = idp4.issue("P-cap-page");
    w4.deps.identify = t => idp4.identify(t); w4.deps.rename = (pl, n, f) => idp4.rename(pl, n, f);
    const shim4 = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokCap) + ")};";
    await p4.addInitScript(shim4); await p4.evaluate(shim4);
    await p4.evaluate(() => { window.SERVER_TABLE.on = true; });
    /* the player already holds five open tables (made on other phones, as the server sees it) */
    const held = []; for(let i = 0; i < 5; i++){ const r = await w4.transport("held").post({ op: "create", identity: { token: tokCap } }); held.push(r.table); }
    const casualBefore = []; for(let i = 0; i < 3; i++) casualBefore.push((await w4.transport("c").post({ op: "create" })).table);
    await toServerChooser(p4);
    await click(p4, btn(p4, /^Open a server table/), "open a server table (the sixth)");
    await p4.waitForSelector(".tblerr", { timeout: 8000 }).catch(() => {});
    const capText = await text(p4);
    row(/You already have 5 tables open/.test(capText) && /Finish a game, or close one/.test(capText), "cap: the sixth table is refused in warm, plain words (what happened, what to do)", (capText.match(/You already have.{0,160}/) || [""])[0]);
    row(!/table-cap|refused|bad-request|identity|undefined|v6\.|creator/i.test((await p4.evaluate(() => document.querySelector(".tblerr").innerText))), "cap: the sentence carries no identifier, field name or version number");
    await inside(p4, ".tblerr", "cap: the message");
    const rowsOpen = await boxes(p4, '[data-testid="cap-open"] .tblopen');
    row(rowsOpen.length === 5 && rowsOpen.map(r => r.t.split(" ")[0]).join() === held.join(), "cap: it lists the five open tables by code, oldest first", rowsOpen.map(r => r.t).join(" | "));
    const closeBtns = await boxes(p4, '[data-testid="cap-open"] button');
    row(closeBtns.length === 5 && closeBtns.every(b => b.h >= 44 && b.x >= 0 && b.r <= W), "cap: each table has its own thumb-sized Close button, inside the screen", closeBtns.map(b => b.h + "px").join());
    row(await overflow(p4), "cap: no horizontal overflow"); await thumbs(p4, "cap");
    row(w4.store.rows.size === 5 + 3, "cap: nothing was created by the refused open", "rows " + w4.store.rows.size);
    await click(p4, p4.locator('[data-testid="cap-open"] button[aria-label="Close table ' + held[0] + '"]'), "close the first table");
    await p4.waitForSelector('[data-testid="close-warn"]', { timeout: 8000 }).catch(() => {});
    const warn0 = await boxes(p4, '[data-testid="close-warn"]'), wb0 = await boxes(p4, '[data-testid="close-warn"] button');
    row(warn0.length === 1 && /Closing now counts as a loss/.test(warn0[0].t) && /ranked table with a game under way/.test(warn0[0].t) && /without a trace/.test(warn0[0].t), "close warning: before anything is closed the page says, plainly, that closing a started ranked table counts as a loss", warn0[0] && warn0[0].t.slice(0, 120));
    row(warn0.length === 1 && warn0[0].x >= 0 && warn0[0].r <= W && warn0[0].b <= H && wb0.length === 2 && wb0.every(b => b.h >= 44 && b.x >= 0 && b.r <= W) && await overflow(p4), "close warning: inside 393x852, both buttons thumb-sized, no horizontal overflow", JSON.stringify(wb0.map(b => [b.t, b.h])));
    row(!/closeTable|conceded|undefined|refused|v6\.|creator|identity/i.test(warn0[0] ? warn0[0].t : ""), "close warning: the sentence carries no identifier, field name or version number");
    row(w4.row(held[0]).closed !== true, "close warning: nothing is closed until the player says yes");
    await click(p4, p4.locator('[data-testid="close-no"]'), "keep it");
    row((await boxes(p4, '[data-testid="close-warn"]')).length === 0 && (await boxes(p4, '[data-testid="cap-open"] .tblopen')).length === 5 && w4.row(held[0]).closed !== true, "close warning: 'Keep it' closes the question and the table stays");
    await click(p4, p4.locator('[data-testid="cap-open"] button[aria-label="Close table ' + held[0] + '"]'), "close the first table (again)");
    await p4.waitForSelector('[data-testid="close-yes"]', { timeout: 8000 });
    await click(p4, p4.locator('[data-testid="close-yes"]'), "yes, close it");
    await p4.waitForSelector('[data-testid="cap-note"]', { timeout: 8000 }).catch(() => {});
    const afterClose = await text(p4);
    row(/Table .{6} is closed\. You can open a new table now\./.test(afterClose) && (await boxes(p4, '[data-testid="cap-open"] .tblopen')).length === 4, "cap: closing one says so and takes it off the list", (afterClose.match(/Table .{6} is closed.{0,50}/) || [""])[0]);
    row(w4.row(held[0]).closed === true && w4.row(held[0]).over === true, "cap: the table is closed on the server");
    await click(p4, btn(p4, /^Open a server table/), "open a server table (one slot free)");
    await p4.waitForSelector(".tblcode", { timeout: 8000 }).catch(() => {});
    const newCode = await p4.evaluate(() => (document.querySelector(".tblcode") || {}).innerText);
    row(ST.isValid((newCode || "").trim()) && w4.row(newCode.trim()).creator === "P-cap-page", "cap: with one closed the player can open a table again", newCode);
    row(await overflow(p4), "cap: waiting screen: no horizontal overflow");
    const bad4 = kit4.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad4.length === 0 && w4.errors.length === 0, "cap: no page error and no internal error on the fake server", bad4.concat(w4.errors).join(" | ").slice(0, 200));
    await kit4.close();
  }
  /* ---- S5.1: RANKED TABLES, ON THE PAGE (each phase its own page and world; the ratings backend behaves like 006_ratings.sql) ---- */
  const rankedKit = async (label, o) => {
    const kit = await open({ w: o.w || W, h: o.h || H }), pg = kit.page;
    const bld = await pg.evaluate(() => TABLE_BUILD);
    const wd = makeWorld({ seedKey: "ranked-" + label, build: bld, deal: dealLikeThePage });
    await wire(pg, wd);
    const idp = F.memIdentity(), rat = F.withRatings(), sk = F.withSeek();   /* the queue too: the end screen's Find another match (v6.81) */
    wd.deps.identify = t => idp.identify(t); wd.deps.rename = (pl, n, f) => idp.rename(pl, n, f); Object.assign(wd.deps, rat.deps(), sk.deps());
    const tokMe = idp.issue("P-rk-me"), tokFoe = idp.issue("P-rk-foe");
    if(o.me) idp.rename("P-rk-me", o.me, wd.server.nameFold(o.me));
    idp.rename("P-rk-foe", "Rival One", wd.server.nameFold("Rival One"));
    if(o.meRating) rat.set("P-rk-me", o.meRating);
    const shim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokMe) + ")};";
    await pg.addInitScript(shim); await pg.evaluate(shim);
    await pg.evaluate(() => { window.SERVER_TABLE.on = true; });
    const Bp = PH.makePhone(wd, "B", { hero: "dorinthea", rand: T.seeded("ranked-b-" + label), build: bld, matchCatalog, throws: o.throws || [["rock", "rock"], ["paper", "rock"]], identity: { token: async () => tokFoe }, ...(o.bRanked ? { ranked: true } : {}) });
    return { kit, pg, wd, rat, Bp, idp, tokMe, tokFoe, sk };
  };
  const leaveBoard = async pg => { await click(pg, pg.locator(".reveal h2"), "tap the end screen to leave"); await pg.waitForSelector(".shell"); };
  const noJargon = t => !/undefined|NaN|\bnull\b|ranked-|refused|bad-request|ratings?:|winner|change|\bv6\.|player id|table-cap/i.test(t);

  /* R1: the page opens a RANKED table, a named opponent sits down, the game is played to a concession by the opponent; the page's seat wins (1300 v 1200) */
  {
    const k = await rankedKit("open", { me: "Dawn Smith", meRating: 1300 }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    await toServerChooser(pg);
    await pg.waitForSelector('[data-testid="my-rating"]', { timeout: 8000 }).catch(() => {});
    const mr = await boxes(pg, '[data-testid="my-rating"]');
    row(mr.length === 1 && mr[0].t === "1300", "ranked: the chooser shows the player's rating beside their name", JSON.stringify(mr[0]));
    const sw0 = await boxes(pg, '[data-testid="ranked-switch"]');
    row(sw0.length === 1 && /Friendly table/.test(sw0[0].t) && sw0[0].h >= 44 && sw0[0].x >= 0 && sw0[0].r <= W && (await pg.getAttribute('[data-testid="ranked-switch"]', "aria-checked")) === "false", "ranked: the switch starts on Friendly (the default is the casual table), thumb-sized, inside the screen", JSON.stringify(sw0[0]));
    row(await btn(pg, /^Open a server table/).count() === 1, "ranked: with the switch off the button is still 'Open a server table'");
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    const sw1 = await boxes(pg, '[data-testid="ranked-switch"]'), note = await boxes(pg, '[data-testid="ranked-note"]');
    row(sw1.length === 1 && /Ranked table/.test(sw1[0].t) && /Counts toward both ratings/.test(sw1[0].t) && (await pg.getAttribute('[data-testid="ranked-switch"]', "aria-checked")) === "true" && note.length === 1 && /1200/.test(note[0].t) && note[0].r <= W,
      "ranked: switching it on says what changes, in plain words", sw1[0] && sw1[0].t);
    row(await btn(pg, /^Open a ranked table/).count() === 1 && await overflow(pg), "ranked: the button now reads 'Open a ranked table'; no horizontal overflow"); await thumbs(pg, "ranked chooser");
    const code = await toTheBoard(pg, wd, B, { asHost: true, openRe: /^Open a ranked table/ });
    row(wd.row(code).ranked === true && wd.row(code).v === 5 && wd.row(code).creator === "P-rk-me", "ranked: the table the page opened is a ranked table created by the page's player", "v" + wd.row(code).v);
    await pg.waitForFunction(() => document.querySelectorAll("[data-pname]").length === 2, null, { timeout: 8000 }).catch(() => {});
    const pn = await pnames(pg);
    row(pn.me && pn.foe && /^Dawn Smith\s*1300$/.test(pn.me.t) && /^Rival One\s*1200$/.test(pn.foe.t), "ranked: each hero has its player's name AND rating beside it on the board", JSON.stringify([pn.me && pn.me.t, pn.foe && pn.foe.t]));
    row(!!pn.me && !!pn.foe && [pn.me, pn.foe].every(p => p.x >= p.mx && p.r <= p.mr && p.rr <= W && p.h <= 14) && pn.scrollW <= W, "ranked: the name and rating stay inside the hero's box, one line, inside 393 wide", JSON.stringify(pn));
    const flags = await pg.evaluate(() => [...document.querySelectorAll(".paneflag")].map(e => e.innerText.replace(/\s+/g, " ")));
    row(flags.some(f => /ranked/i.test(f)), "ranked: the board says the table is ranked", JSON.stringify(flags.slice(0, 3)));
    await playSome(pg, wd, B, 0, 6);
    B.sess.submit({ t: "concede" });
    await wd.settle([B.ch]);
    await pg.waitForSelector('[data-testid="rank-change"]', { timeout: 15000 }).catch(() => {});
    await pg.waitForFunction(() => /rose from/.test((document.querySelector('[data-testid="rank-change"]') || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
    const rc = await boxes(pg, '[data-testid="rank-change"]');
    row(rc.length === 1 && /Well played\. Your rating rose from 1300 → 1312 \(\+12\)\./.test(rc[0].t), "ranked: the page's end screen shows its own rating change (old → new), warm and plain", rc[0] && rc[0].t);
    row(rc.length === 1 && rc[0].x >= 0 && rc[0].r <= W && rc[0].y >= 0 && rc[0].b <= H && await overflow(pg), "ranked: the rating change is inside 393x852, no horizontal overflow", JSON.stringify(rc[0]));
    row(rc.length === 1 && noJargon(rc[0].t), "ranked: the sentence carries no identifier, field name or version number");
    const rb = B.ch.rank().result;
    row(!!rb && JSON.stringify(rb.change) === JSON.stringify([{ from: 1300, to: 1312 }, { from: 1200, to: 1188 }]) && rb.winner === 0 && rb.how === "concession", "ranked: the other phone read the same result (its own rating 1200 → 1188)", JSON.stringify(rb && rb.change));
    row(rat.results.size === 1 && rat.records === 1 && rat.rating("P-rk-me").rating === 1312 && rat.rating("P-rk-foe").rating === 1188, "ranked: exactly one result was recorded and both ratings moved by the Elo amounts", rat.records + " record call(s)");
    await wait(2500);
    row(rat.records === 1 && (await boxes(pg, '[data-testid="rank-change"]')).length === 1, "ranked: nothing was recorded again while the end screen stayed open");
    const ag = await boxes(pg, '[data-testid="seek-again"]');
    row(ag.length === 1 && /^find another ranked match$/i.test(ag[0].t) && ag[0].h >= 44 && ag[0].x >= 0 && ag[0].r <= W && ag[0].b <= H, "play again: a ranked game's end screen offers Find another ranked match, thumb-sized, on screen", JSON.stringify(ag[0]));
    /* the name sheet shows the new rating and record */
    await leaveBoard(pg); await toServerChooser(pg);
    await pg.waitForFunction(() => (document.querySelector('[data-testid="my-rating"]') || {}).innerText === "1312", null, { timeout: 8000 }).catch(() => {});
    row((await boxes(pg, '[data-testid="my-rating"]')).map(b => b.t).join() === "1312", "ranked: the chooser shows the NEW rating");
    await click(pg, btn(pg, /^(Change|Choose a name)/), "open the name sheet"); await pg.waitForSelector('[data-testid="my-record"]', { timeout: 8000 }).catch(() => {});
    const rec = await boxes(pg, '[data-testid="my-record"]');
    row(rec.length === 1 && /Your rating is 1312\. 1 ranked game: 1 won, 0 lost, 0 drawn\./.test(rec[0].t) && rec[0].r <= W, "ranked: the name sheet shows the rating and the record", rec[0] && rec[0].t);
    row(await overflow(pg) && noJargon(rec[0] ? rec[0].t : ""), "ranked: the name sheet: no overflow, no jargon"); await thumbs(pg, "ranked name sheet");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "ranked: no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    B.ch.close(); await k.kit.close();
  }

  /* R2: the page's seat LOSES by its own concession (1200 v 1200): the phone that made the last move reads the result from its own answer */
  {
    const k = await rankedKit("loss", { me: "Dawn Smith" }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    await toServerChooser(pg);
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    await toTheBoard(pg, wd, B, { asHost: true, openRe: /^Open a ranked table/ });
    await playSome(pg, wd, B, 0, 4);
    await pg.evaluate(() => window.__dawnTable.session.submit({ t: "concede" }));
    await wd.settle([B.ch]);
    await pg.waitForFunction(() => /moved from/.test((document.querySelector('[data-testid="rank-change"]') || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
    const rc = await boxes(pg, '[data-testid="rank-change"]');
    row(rc.length === 1 && /Your rating moved from 1200 → 1184 \(\u221216\)\. Every game teaches something\./.test(rc[0].t), "ranked: the loser's end screen shows 1200 → 1184, kindly", rc[0] && rc[0].t);
    row(rc.length === 1 && rc[0].r <= W && rc[0].b <= H && noJargon(rc[0].t) && await overflow(pg), "ranked: the loss sentence is inside the screen and carries no jargon");
    row(rat.results.size === 1 && [...rat.results.values()][0].winner === 1 && rat.rating("P-rk-me").rating === 1184 && rat.rating("P-rk-foe").rating === 1216, "ranked: the loss was recorded once, for the right player");
    /* PLAY AGAIN (v6.81): one tap from the end screen and the page is in the queue again, the same kind of match, its waiting card up */
    row(k.sk.count(60).ranked === 0, "play again: nobody is queued before the tap (sabotage guard)");
    await click(pg, pg.locator('[data-testid="seek-again"]'), "find another ranked match");
    await pg.waitForSelector('[data-testid="seek-card"]', { timeout: 8000 }).catch(() => {});
    const sc = await text(pg);
    row(/Finding a ranked match/.test(sc) && k.sk.count(60).ranked === 1 && k.sk.count(60).friendly === 0, "play again: one tap puts the page back in the queue for a RANKED match, waiting card on screen", JSON.stringify(k.sk.count(60)));
    row((await boxes(pg, '[data-testid="seek-cancel"]')).length === 1 && await overflow(pg), "play again: Stop looking is there; no horizontal overflow"); await thumbs(pg, "play again waiting");
    await click(pg, pg.locator('[data-testid="seek-cancel"]'), "stop looking"); await pg.waitForSelector('[data-testid="seek-go"]', { timeout: 6000 }).catch(() => {});
    const sg = await boxes(pg, '[data-testid="seek-go"]');
    row(k.sk.count(60).ranked === 0 && sg.length === 1 && /^find a ranked match$/i.test(sg[0].t), "play again: Stop looking leaves the queue and the server screen keeps the switch on Ranked", sg[0] && sg[0].t);
    B.ch.close(); await k.kit.close();
  }

  /* RM: REMATCH (v6.83) — after a ranked game, the opponent asks first (the page hears it by push), takes it back (the page hears that too), then the page asks
     and waits, the opponent says yes, and the page sits down at the NEW ranked table at once (back to the hero pick) */
  {
    const k = await rankedKit("rematch", { me: "Dawn Smith" }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    await toServerChooser(pg);
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    const code = await toTheBoard(pg, wd, B, { asHost: true, openRe: /^Open a ranked table/ });
    await playSome(pg, wd, B, 0, 4);
    B.sess.submit({ t: "concede" });
    await wd.settle([B.ch]);
    await pg.waitForSelector('[data-testid="rematch"]', { timeout: 15000 }).catch(() => {});
    const rb0 = await boxes(pg, '[data-testid="rematch"]');
    row(rb0.length === 1 && /^rematch$/i.test(rb0[0].t) && rb0[0].h >= 44 && rb0[0].x >= 0 && rb0[0].r <= W && rb0[0].b <= H, "rematch: the end screen offers Rematch, thumb-sized, on screen", JSON.stringify(rb0[0]));
    const ag = await boxes(pg, '[data-testid="seek-again"]');
    row(ag.length === 1 && rb0.length === 1 && ag[0].y > rb0[0].y && await overflow(pg), "rematch: Find another ranked match is still there, under it; no horizontal overflow"); await thumbs(pg, "rematch end screen", ".reveal");
    /* the opponent asks first: the page hears it from the push */
    const a1 = await B.ch.askRematch(); await wd.settle([B.ch]);
    await pg.waitForFunction(() => /wants a rematch/.test((document.querySelector('[data-testid="rematch-note"]') || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
    const n1 = await boxes(pg, '[data-testid="rematch-note"]'), rb1 = await boxes(pg, '[data-testid="rematch"]');
    row(a1.state === "waiting" && n1.length === 1 && /^Rival One wants a rematch\.$/.test(n1[0].t) && rb1.length === 1 && /say yes/i.test(rb1[0].t), "rematch: the opponent's ask reaches the page — 'Rival One wants a rematch.' and the button says yes", n1[0] && n1[0].t);
    await B.ch.askRematch(true); await wd.settle([B.ch]);
    await pg.waitForFunction(() => !document.querySelector('[data-testid="rematch-note"]'), null, { timeout: 8000 }).catch(() => {});
    row((await boxes(pg, '[data-testid="rematch-note"]')).length === 0 && /^rematch$/i.test(((await boxes(pg, '[data-testid="rematch"]'))[0] || {}).t || ""), "rematch: when the opponent takes it back, the page stops saying they want one");
    /* the page asks and waits */
    const rows0 = wd.store.rows.size;
    await click(pg, pg.locator('[data-testid="rematch"]'), "rematch");
    await pg.waitForSelector('[data-testid="rematch-cancel"]', { timeout: 8000 }).catch(() => {});
    const n2 = await boxes(pg, '[data-testid="rematch-note"]'), cx = await boxes(pg, '[data-testid="rematch-cancel"]');
    row(n2.length === 1 && /^You asked for a rematch\. Waiting for Rival One to say yes… [12]:\d\d$/.test(n2[0].t) && cx.length === 1 && cx[0].h >= 44 && cx[0].b <= H, "rematch: the page says it is waiting for Rival One, with a calm count and Take it back", n2[0] && n2[0].t);
    row(B.ch.rematch().theirs === true && wd.store.rows.size === rows0, "rematch: the opponent's phone heard the ask; no table opened on one ask", JSON.stringify(B.ch.rematch()));
    row(n2.length === 1 && noJargon(n2[0].t) && await overflow(pg), "rematch: the waiting words carry no jargon; no horizontal overflow"); await thumbs(pg, "rematch waiting", ".reveal");
    /* the opponent says yes: the page sits down at the new table */
    const b2 = await B.ch.askRematch(); await wd.settle([B.ch]);
    const nc = b2.table;
    await pg.waitForFunction(c => document.body.innerText.indexOf(c) >= 0 && !document.querySelector('[data-testid="rematch-row"]'), nc, { timeout: 15000 }).catch(() => {});
    const nrow = nc ? wd.row(nc) : null;
    row(b2.state === "ready" && nc !== code && !!nrow && nrow.ranked === true && (nrow.owners || []).indexOf("P-rk-me") >= 0, "rematch: both said yes — a new RANKED table, and the page sat down at it by itself", JSON.stringify(nrow && { ranked: nrow.ranked, owners: nrow.owners }));
    row((await text(pg)).indexOf(nc) >= 0 && (await boxes(pg, '[data-testid="rank-change"]')).length === 0, "rematch: the page left the old end screen for the new table", nc);
    row(rat.records === 1, "rematch: the first game was recorded once; the new table records nothing until its own game ends");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "rematch: no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    B.ch.close(); await k.kit.close();
  }

  /* R2c — THE RANKED END SCREEN AT 320x568 (M, QUEUE NEXT 6; POLISH.md condition 1). The end panel stacks the title, the names card, the life left,
     the note, the rating change, Find another ranked match, (a joiner's) the Verify paragraph and button, and Leave the table. On the smallest phone
     none may be pushed off the screen with no way back, and every button takes a 44px tap (tools/tapjudge.js; its scroll passes put the panel's
     own scroll at its top and at its end). Both seats: the creator's panel, and a joiner's (which also carries "Verify this game"). */
  for(const asHost of [true, false]){
    const L = asHost ? "creator" : "joiner", k = await rankedKit("end320-" + L, { me: "Dawn Smith", meRating: 1300, bRanked: !asHost, w: 320, h: 568, ...(asHost ? {} : { throws: [["rock", "rock"], ["rock", "paper"]] }) }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    await toServerChooser(pg);
    if(asHost) await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    await toTheBoard(pg, wd, B, asHost ? { asHost: true, openRe: /^Open a ranked table/ } : { asHost: false });
    await playSome(pg, wd, B, 0, 4);
    B.sess.submit({ t: "concede" }); await wd.settle([B.ch]);
    await pg.waitForFunction(() => /rose from/.test((document.querySelector('[data-testid="rank-change"]') || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
    await pg.waitForSelector("button:has-text('Verify this game')", { timeout: 20000 }).catch(() => {});
    const ends = await pg.evaluate(() => ({ n: document.querySelectorAll(".reveal").length, again: !!document.querySelector('[data-testid="seek-again"]'), verify: [...document.querySelectorAll(".reveal button")].some(b => /verify this game/i.test(b.innerText)), leave: !!document.querySelector(".reveal .endleave"), rc: !!document.querySelector('[data-testid="rank-change"]') }));
    row(ends.n === 1 && ends.rc && ends.again && ends.leave && ends.verify, "ranked end 320x568 (" + L + "): the end panel stacks the rating change, Find another ranked match, Verify this game, and Leave", JSON.stringify(ends));
    const r = await judgeScreen(pg), bad = ["small", "stolen", "clipped", "overlap"].flatMap(x => r[x].map(f => x + ": " + f.m));
    row(r.n >= 3 && !bad.length, "ranked end 320x568 (" + L + "): every button takes a 44px tap, none is stolen, clipped or pushed off the screen", r.n + " controls" + (bad.length ? "  " + bad.join(" | ").slice(0, 600) : ""));
    /* where each sits with the panel scrolled to its end: Leave must be reachable, and the title must not be cut off at the top */
    const geo = await pg.evaluate(() => { const rv = document.querySelector(".reveal"), q = s => { const e = rv.querySelector(s); return e && e.getBoundingClientRect(); };
      const t = q(".endtitle"), lv = q(".endleave"), sa = q('[data-testid="seek-again"]'), vf = [...rv.querySelectorAll("button")].find(b => /Verify/.test(b.innerText));
      const sc = rv.scrollHeight > rv.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(rv).overflowY);
      const top0 = t && Math.round(t.top); rv.scrollTop = rv.scrollHeight; const lv1 = q(".endleave");
      return { scrolls: sc, titleTop: top0, leaveBottomAtEnd: lv1 && Math.round(lv1.bottom), leaveRight: lv && Math.round(lv.right), again: sa && [Math.round(sa.left), Math.round(sa.right)], verifyW: vf && Math.round(vf.getBoundingClientRect().width) }; });
    row(geo.titleTop >= 0 && geo.leaveBottomAtEnd <= 568 && geo.leaveRight <= 320 && (!geo.again || (geo.again[0] >= 0 && geo.again[1] <= 320)), "ranked end 320x568 (" + L + "): the title is not cut off at the top, Leave sits inside the screen (at the panel's end), no button leaves the 320 width", JSON.stringify(geo));
    row(await pg.evaluate(() => document.scrollingElement.scrollWidth <= 320), "ranked end 320x568 (" + L + "): no horizontal overflow");
    /* ONE MORE BUTTON (a Rematch is coming): inject a thumb-sized one above Leave; the panel must scroll, not push Leave or the title out of reach */
    await pg.evaluate(() => { const b = document.createElement("button"); b.className = "bigbtn"; b.setAttribute("data-testid", "inject-m"); b.textContent = "Rematch"; const lv = document.querySelector(".reveal .endleave"); lv.parentNode.insertBefore(b, lv); });
    const r2 = await judgeScreen(pg), bad2 = ["small", "stolen", "clipped", "overlap"].flatMap(x => r2[x].map(f => x + ": " + f.m));
    const reach = await pg.evaluate(() => { const rv = document.querySelector(".reveal"); rv.scrollTop = 0; const t0 = rv.querySelector(".endtitle").getBoundingClientRect().top; rv.scrollTop = rv.scrollHeight; const l1 = rv.querySelector(".endleave").getBoundingClientRect().bottom;
      return { scrolls: rv.scrollHeight > rv.clientHeight, titleTopAtStart: Math.round(t0), leaveBottomAtEnd: Math.round(l1) }; });
    row(r2.n >= 4 && !bad2.length && reach.scrolls && reach.titleTopAtStart >= 0 && reach.leaveBottomAtEnd <= 568, "ranked end 320x568 (" + L + "): with one more button (a Rematch) the panel scrolls: title reachable at the top, Leave at the end, every tap still 44px", r2.n + " controls " + JSON.stringify(reach) + (bad2.length ? "  " + bad2.join(" | ").slice(0, 400) : ""));
    B.ch.close(); await k.kit.close();
  }

  /* R3: the refusals — a nameless player cannot sit at a ranked table (the page says what to do), and cannot open one */
  {
    const k = await rankedKit("nameless", { me: null, bRanked: true }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    await B.connect("create");
    const code = B.code;
    await toServerChooser(pg);
    await click(pg, btn(pg, /^Enter a table code/), "enter a table code"); await pg.waitForSelector(".tblin");
    await pg.fill(".tblin", code); await click(pg, btn(pg, /^Sit down/), "sit down at the ranked table");
    await pg.waitForSelector(".tblerr", { timeout: 8000 }).catch(() => {});
    const er = await boxes(pg, ".tblerr");
    row(er.length === 1 && /A ranked table needs a player name for both players\. Choose yours under Playing as, then try again\./.test(er[0].t), "ranked refusal: a nameless joiner is told what to do, in plain words", er[0] && er[0].t);
    row(er.length === 1 && er[0].x >= 0 && er[0].r <= W && er[0].b <= H && noJargon(er[0].t) && await overflow(pg), "ranked refusal: the sentence is inside 393x852 and carries no identifier or field name");
    row(wd.row(code).owners.filter(Boolean).length === 1 && rat.records === 0, "ranked refusal: nothing was written by the refused seat");
    await click(pg, btn(pg, /^Back/), "back to the chooser"); await pg.waitForSelector('[data-testid="ranked-switch"]');
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    const rowsN = wd.store.rows.size;
    await click(pg, btn(pg, /^Open a ranked table/), "open a ranked table without a name");
    await pg.waitForSelector(".tblerr", { timeout: 8000 }).catch(() => {});
    const er2 = await boxes(pg, ".tblerr");
    row(er2.length === 1 && /needs a player name/.test(er2[0].t) && wd.store.rows.size === rowsN, "ranked refusal: a nameless player cannot open a ranked table either, and no table was made", er2[0] && er2[0].t);
    row((await boxes(pg, ".tblwho button")).some(b => /Choose a name/.test(b.t) && b.h >= 40), "ranked refusal: the way out (Choose a name) is on the same screen, thumb-sized");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "ranked refusal: no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    B.ch.close(); await k.kit.close();
  }

  /* ---- S5.2: THE FORFEIT CLOCK AND CLOSE-AS-CONCESSION, ON THE PAGE ---- */
  const LIMIT = ST && require("../server/referee.js").FORFEIT_MS;
  const fnClock = wd => { const c = { t: 1700000000000 }; wd.deps.now = () => c.t; return c; };
  /* play until the table's clock is on `seat` (a state, not a wait), the page moving for seat 0 and the scripted phone for seat 1 */
  const untilWaitingOn = async (pg, wd, B, code, seat) => {
    for(let i = 0; i < 300; i++){
      const ck = wd.row(code).clock;
      if(ck && ck.on === seat) return true;
      const moved = await pg.evaluate(() => { const t = window.__dawnTable; if(!t) return false; const x = t.session; if(x.status() !== "ready") return false; const a = DawnSparring.act(x.state(), t.seat, { search: false }); if(!a) return false; return !x.submit(a); }).catch(() => false);
      if(moved){ await wd.settle([B.ch]); await wait(60); continue; }
      if(await PH.step(wd, [B])){ await wait(60); continue; }
      await wait(100);
    }
    return false;
  };
  const pollClock = async (pg, re, ms) => { await pg.waitForFunction(r => new RegExp(r).test(document.body.innerText), re, { timeout: ms || 9000 }).catch(() => {}); };
  /* F1: the opponent is the one the game waits on; the page waits, then may claim, and claims */
  {
    const k = await rankedKit("forfeit", { me: "Dawn Smith" }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp, ck = fnClock(wd);
    await toServerChooser(pg);
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    const code = await toTheBoard(pg, wd, B, { asHost: true, openRe: /^Open a ranked table/ });
    await playSome(pg, wd, B, 0, 4);
    row(await untilWaitingOn(pg, wd, B, code, 1), "forfeit: the table's clock is on the opponent (the page waits)", JSON.stringify(wd.row(code).clock));
    wd.fault.cut(wd.topicOf(code, 0));                          /* the page asks the table every 2 s, so it learns the server's account of the wait */
    row(await pg.evaluate(() => !document.querySelector(".ffbar")), "forfeit: no bar at all while the wait is short (a quiet table stays quiet)");
    ck.t += 70000; await pollClock(pg, "taking a while");
    const wt = await boxes(pg, '[data-testid="forfeit-wait"]');
    row(wt.length === 1 && /Rival One is taking a while\. You may claim the win in \d:\d\d\./.test(wt[0].t), "forfeit: after a minute's wait the page says how long until it may claim (the server's account plus its own elapsed time)", wt[0] && wt[0].t);
    row(wt.length === 1 && wt[0].x >= 0 && wt[0].r <= W && wt[0].y >= 0 && wt[0].b <= H && await overflow(pg) && (await boxes(pg, '[data-testid="claim-win"]')).length === 0, "forfeit: the countdown is inside 393x852, no horizontal overflow, and there is NO claim button yet", JSON.stringify(wt[0]));
    row(wt.length === 1 && !/undefined|NaN|\bnull\b|claim-|refused|clock|stamp|v6\./i.test(wt[0].t), "forfeit: the countdown carries no identifier, field name or version number, and says nothing of what the opponent is deciding");
    const v0 = wd.store.version(code);
    ck.t += LIMIT - 70000 + 1000; await pollClock(pg, "may claim the win:");   /* past the limit, whatever it is */
    const due = await boxes(pg, '[data-testid="forfeit-due"]'), cb = await boxes(pg, '[data-testid="claim-win"]');
    row(due.length === 1 && cb.length === 1 && /^Claim the win$/.test(cb[0].t) && /has not moved for 7\.5 minutes/.test(due[0].t), "forfeit: once the limit has passed the page offers 'Claim the win' and says why", due[0] && due[0].t);
    row(cb.length === 1 && cb[0].h >= 44 && cb[0].x >= 0 && cb[0].r <= W && cb[0].b <= H && await overflow(pg), "forfeit: the claim button is thumb-sized and inside 393x852", JSON.stringify(cb[0])); await thumbs(pg, "forfeit claim", ".ffbar");
    row(rat.records === 0 && wd.row(code).over !== true, "forfeit: nothing is recorded before the claim is pressed");
    await click(pg, pg.locator('[data-testid="claim-win"]'), "claim the win");
    await pg.waitForSelector(".reveal", { timeout: 15000 }).catch(() => {});
    await pg.waitForFunction(() => /rose from/.test((document.querySelector('[data-testid="rank-change"]') || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
    const how = await boxes(pg, '[data-testid="forfeit-how"]'), rc = await boxes(pg, '[data-testid="rank-change"]');
    row(how.length === 1 && /Won by forfeit: your opponent did not come back in time\./.test(how[0].t) && rc.length === 1 && /Your rating rose from 1200 → 1216 \(\+16\)/.test(rc[0].t), "forfeit: the winner's end screen says it was a win by forfeit, and the rating move", rc[0] && rc[0].t);
    row(rc.length === 1 && rc[0].x >= 0 && rc[0].r <= W && rc[0].b <= H && await overflow(pg) && noJargon(rc[0].t), "forfeit: the winner's end screen is inside 393x852, no overflow, no jargon");
    const rb = B.ch.rank().result;
    await wd.settle([B.ch]); await B.ch.result(4, 20);
    const rb2 = B.ch.rank().result;
    row(!!(rb2 || rb) && (rb2 || rb).how === "forfeit" && (rb2 || rb).winner === 0 && JSON.stringify((rb2 || rb).change) === JSON.stringify([{ from: 1200, to: 1216 }, { from: 1200, to: 1184 }]), "forfeit: the absent phone reads the same result (1200 → 1184, forfeit, seat 0 won)", JSON.stringify(rb2 || rb));
    row(rat.results.size === 1 && rat.records === 1 && [...rat.results.values()][0].how === "forfeit" && wd.store.version(code) > v0, "forfeit: exactly one result was recorded, as a forfeit");
    await wait(2500);
    row(rat.records === 1 && (await boxes(pg, '[data-testid="claim-win"]')).length === 0, "forfeit: nothing more was recorded and the claim button is gone");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "forfeit: no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    B.ch.close(); await k.kit.close();
  }
  /* F2: the page is the one the game waits on: a calm countdown in the last two minutes; the opponent claims; the page's end screen says what happened */
  {
    const k = await rankedKit("forfeit-mine", { me: "Dawn Smith" }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp, ck = fnClock(wd);
    await toServerChooser(pg);
    await click(pg, pg.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    const code = await toTheBoard(pg, wd, B, { asHost: true, openRe: /^Open a ranked table/ });
    await playSome(pg, wd, B, 0, 4);
    for(let i = 0; i < 200 && !((wd.row(code).clock || {}).on === 0); i++){ await PH.step(wd, [B]); await wait(60); }
    row((wd.row(code).clock || {}).on === 0, "forfeit (mine): the table's clock is on the page's seat", JSON.stringify(wd.row(code).clock));
    wd.fault.cut(wd.topicOf(code, 0));
    ck.t += 100000; await wait(2600);
    row(await pg.evaluate(() => !document.querySelector('[data-testid="forfeit-mine"]')), "forfeit (mine): with plenty of time left the page's own clock stays out of the way");
    ck.t += LIMIT - 200000; await pollClock(pg, "waiting on you");   /* 100 s left: inside the last two minutes */
    const mine = await boxes(pg, '[data-testid="forfeit-mine"]');
    row(mine.length === 1 && /The game is waiting on you\. Rival One may claim the win in \d:\d\d\. Any move you make carries on as normal\./.test(mine[0].t), "forfeit (mine): in the last two minutes the page says, calmly, how long it has", mine[0] && mine[0].t);
    row(mine.length === 1 && mine[0].x >= 0 && mine[0].r <= W && mine[0].b <= H && await overflow(pg) && (await boxes(pg, '[data-testid="claim-win"]')).length === 0, "forfeit (mine): inside 393x852, no overflow, and no claim button on the waited-on phone");
    row(mine.length === 1 && !/undefined|NaN|\bnull\b|claim-|refused|stamp|v6\./i.test(mine[0].t), "forfeit (mine): no identifier or field name in the sentence");
    /* the opponent's phone claims once it is due; the page learns the game is over */
    ck.t += 101000;
    const early = await B.ch.claimWin().then(() => null, e => e);
    row(!early, "forfeit (mine): the opponent's claim, now due, goes through");
    await pg.waitForSelector(".reveal", { timeout: 20000 }).catch(() => {});
    await pg.waitForFunction(() => /moved from/.test((document.querySelector('[data-testid="rank-change"]') || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
    const how = await boxes(pg, '[data-testid="forfeit-how"]'), rc = await boxes(pg, '[data-testid="rank-change"]');
    row(how.length === 1 && /Lost by forfeit: the game waited for you and you did not come back in time\./.test(how[0].t) && rc.length === 1 && /Your rating moved from 1200 → 1184/.test(rc[0].t), "forfeit (mine): the absent player's end screen says it was a loss by forfeit, kindly, with the rating move", rc[0] && rc[0].t);
    row(rc.length === 1 && rc[0].x >= 0 && rc[0].r <= W && rc[0].b <= H && await overflow(pg) && noJargon(rc[0].t), "forfeit (mine): inside 393x852, no overflow, no jargon");
    row(rat.results.size === 1 && [...rat.results.values()][0].how === "forfeit" && [...rat.results.values()][0].winner === 1 && rat.rating("P-rk-me").rating === 1184, "forfeit (mine): one forfeit recorded, the page's player the loser");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "forfeit (mine): no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    B.ch.close(); await k.kit.close();
  }
  /* F3: CLOSE counts as a loss — the player holds five tables, one of them a ranked game under way; the page warns before it closes it, and says what it counted as */
  {
    const k = await rankedKit("close-loss", { me: "Dawn Smith" }), pg = k.pg, wd = k.wd, rat = k.rat, B = k.Bp;
    const A0 = PH.makePhone(wd, "A0", { hero: "blaze", rand: T.seeded("ranked-a0"), build: await pg.evaluate(() => TABLE_BUILD), matchCatalog, throws: [["rock", "rock"], ["paper", "rock"]], identity: { token: async () => k.tokMe }, ranked: true });
    await A0.connect("create"); const live = A0.code;
    await B.connect("join", live); await wd.settle([A0.ch, B.ch]);
    for(let i = 0; i < 8 && !(A0.sess && B.sess && A0.sess.status() === "ready" && B.sess.status() === "ready"); i++) await wd.settle([A0.ch, B.ch]);
    row(!!A0.sess && !!B.sess && !!wd.row(live).hub.spec, "close loss: a ranked game is under way at a table the page's player created");
    const extra = []; for(let i = 0; i < 4; i++) extra.push((await wd.transport("held").post({ op: "create", identity: { token: k.tokMe } })).table);
    await toServerChooser(pg);
    await click(pg, btn(pg, /^Open a server table/), "open a server table (the sixth)");
    await pg.waitForSelector('[data-testid="cap-open"]', { timeout: 8000 }).catch(() => {});
    await click(pg, pg.locator('[data-testid="cap-open"] button[aria-label="Close table ' + live + '"]'), "close the live ranked table");
    await pg.waitForSelector('[data-testid="close-warn"]', { timeout: 8000 }).catch(() => {});
    const w1 = await boxes(pg, '[data-testid="close-warn"]');
    row(w1.length === 1 && /Closing now counts as a loss/.test(w1[0].t) && w1[0].r <= W && w1[0].b <= H, "close loss: the page warns before it closes", w1[0] && w1[0].t.slice(0, 90));
    row(!wd.row(live).over && rat.records === 0, "close loss: nothing is recorded while the question is open");
    await click(pg, pg.locator('[data-testid="close-yes"]'), "yes, close it");
    await pg.waitForSelector('[data-testid="cap-note"]', { timeout: 8000 }).catch(() => {});
    const note = await boxes(pg, '[data-testid="cap-note"]');
    row(note.length === 1 && /had a ranked game under way, so closing it counted as a loss\. Your rating moved from 1200 to 1184\./.test(note[0].t) && note[0].r <= W && noJargon(note[0].t), "close loss: after yes the page says it counted as a loss and how the rating moved", note[0] && note[0].t);
    const st = [...rat.results.values()];
    row(st.length === 1 && st[0].how === "concession" && st[0].winner === 1 - wd.row(live).owners.indexOf("P-rk-me") && rat.rating("P-rk-me").rating === 1184 && wd.row(live).closed !== true && wd.row(live).over === true, "close loss: one concession recorded, the closer the loser, the table over (not erased)");
    await wd.settle([A0.ch, B.ch]); await B.ch.result(4, 20);
    row(!!B.ch.rank().result && B.ch.rank().result.winner === 1 - wd.row(live).owners.indexOf("P-rk-me"), "close loss: the opponent's phone reads the win");
    const idle = extra[0], r1 = rat.records;
    await click(pg, pg.locator('[data-testid="cap-open"] button[aria-label="Close table ' + idle + '"]'), "close an empty table");
    await click(pg, pg.locator('[data-testid="close-yes"]'), "yes, close it (empty)");
    await pg.waitForFunction(t => new RegExp("Table " + t + " is closed").test(document.body.innerText), idle, { timeout: 8000 }).catch(() => {});
    row(rat.records === r1 && wd.row(idle).closed === true && /Table .{6} is closed\. You can open a new table now\./.test(await text(pg)), "close loss: an empty table closes without a trace (no loss, nothing recorded)");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && wd.errors.length === 0, "close loss: no page error and no internal error on the fake server", bad.concat(wd.errors).join(" | ").slice(0, 200));
    A0.ch.close(); B.ch.close(); await k.kit.close();
  }

  /* ---- S5.3: THE LADDER, ON THE PAGE (each phase its own page and world; the ladder backend behaves like 008_ladder.sql) ----
     Asserted on element boxes and text, at 393 wide and at 320, with 16-letter names and four-digit ratings. */
  const ladderKit = async (label, o) => {
    o = o || {};
    const kit = await open({ w: o.w || W, h: o.h || H }), pg = kit.page;
    const wd = makeWorld({ seedKey: "ladder-" + label });
    await wire(pg, wd);
    const idp = F.memIdentity(), rat = F.withRatings(), lad = F.withLadder(rat, idp);
    wd.deps.identify = t => idp.identify(t); wd.deps.rename = (pl, n, f) => idp.rename(pl, n, f); Object.assign(wd.deps, rat.deps(), lad.deps());
    const seed = (id, name, rating, games) => { const tok = idp.issue(id); if(name) idp.rename(id, name, wd.server.nameFold(name)); if(rating !== undefined) rat.rt.set(id, { rating, games, wins: games, losses: 0, draws: 0 }); return tok; };
    const tokMe = seed("P-lad-me", o.me === undefined ? "Dawn Smith" : o.me, o.meRating, o.meGames);
    if(o.crowd) for(const [id, nm, r, g] of [["c1", "Abcdefghijklmnop", 1842, 12], ["c2", "WWWWWWWWWWWWWWWW", 1790, 9], ["c3", "Mmmmmmmmmmmmmmmm", 1502, 4], ["c4", "Iiiiiiiiiiiiiiii", 1500, 4], ["c5", "Zed Zed", 1311, 3], ["c6", "Quick Brown Fox", 1203, 7]]) seed(id, nm, r, g);
    if(o.games){ for(const [id, nm] of [["r1", "Rec One"], ["r2", "Rec Two"], ["r3", "Rec Three"], ["r4", "Rec Four"], ["r5", "Rec Five"], ["r6", "Rec Six"]]) seed(id, nm);     /* three games between three pairs: nobody reaches the floor */
      const g = (n, a, b, winner, how, heroes, ago) => rat.record({ game: "LG" + n, table: "LT" + n, players: ["r" + a, "r" + b], names: ["Rec " + ["", "One", "Two", "Three", "Four", "Five", "Six"][a], "Rec " + ["", "One", "Two", "Three", "Four", "Five", "Six"][b]], heroes, winner, how, turns: 5, build: null, started: 0, ended: Date.now() - ago });
      g(1, 1, 2, 0, "life", ["kayo", "dash"], 2 * 86400000); g(2, 3, 4, null, "stalemate", ["bravo", "katsu"], 3 * 3600000); g(3, 5, 6, 1, "concession", ["viserai", "dorinthea"], 5 * 60000); }
    const shim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(tokMe) + ")" + (o.known === false ? ", known: () => false" : "") + "};";
    await pg.addInitScript(shim); await pg.evaluate(shim);
    await pg.evaluate(() => { window.SERVER_TABLE.on = true; });
    return { kit, pg, wd, rat, lad, idp, tokMe, W: o.w || W };
  };
  const ladderOpen = async (pg, how) => {
    await click(pg, btn(pg, /^Find an opponent/), "find an opponent"); await pg.waitForSelector(".tblwrap");
    if(how === "first") await click(pg, pg.locator('[data-testid="ladder-open"]'), "the ladder (first screen)");
    else {
      await click(pg, btn(pg, /^Join a server table/), "join a server table"); await pg.waitForSelector(".tblwrap button:has-text('Open a server table')");
      if(how === "name"){ await click(pg, btn(pg, /^(Change|Choose a name)/), "player name"); await pg.waitForSelector(".tblname"); }
      await click(pg, pg.locator('[data-testid="ladder-open"]'), "the ladder (" + how + ")");
    }
    await pg.waitForFunction(() => !document.querySelector('[data-testid="ladder-loading"]') && /The ladder/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  };
  const ladFits = async (pg, w, name) => {
    const m = await pg.evaluate(() => ({ sw: document.scrollingElement.scrollWidth,
      rows: [...document.querySelectorAll('[data-testid="ladder-row"]')].map(r => { const b = r.getBoundingClientRect(), n = r.querySelector(".ladnm"), t = r.querySelector(".ladrt"), nb = n.getBoundingClientRect(), tb = t.getBoundingClientRect();
        return { x: Math.round(b.left), r: Math.round(b.right), nameCut: n.scrollWidth > n.clientWidth + 1, nr: Math.round(nb.right), tl: Math.round(tb.left), tr: Math.round(tb.right), txt: n.innerText.split("\n")[0], rt: t.innerText }; }),
      games: [...document.querySelectorAll('[data-testid="ladder-game"]')].map(g => { const b = g.getBoundingClientRect(); return { x: Math.round(b.left), r: Math.round(b.right) }; }),
      cards: [...document.querySelectorAll(".tblwrap > *")].map(c => { const b = c.getBoundingClientRect(); return { x: Math.round(b.left), r: Math.round(b.right) }; }) }));
    row(m.sw <= w, name + ": no horizontal overflow", "scrollWidth " + m.sw + " of " + w);
    row(m.rows.length > 0 && m.rows.every(r => r.x >= 0 && r.r <= w && !r.nameCut && r.nr <= r.tl && r.tr <= r.r), name + ": every row is inside the screen, no name is cut, and the name never runs under the rating", m.rows.map(r => r.txt + " " + r.rt).join(" | "));
    row(m.games.every(g => g.x >= 0 && g.r <= w) && m.cards.every(c => c.x >= 0 && c.r <= w), name + ": the latest games and every card are inside the screen");
  };
  const ladText = async pg => (await boxes(pg, ".tblwrap")).map(b => b.t).join(" ");
  const ladJargon = t => !/undefined|NaN|\bnull\b|refused|bad-request|unavailable|identity|ladder_get|\bop\b|\bv6\.|player id|toGo|\bwinner\b|stalemate|concession/i.test(t);

  /* L1: a crowd, the page's player ranked third; long names and four-digit ratings at 393 AND at 320 */
  for(const [w, h] of [[W, H], [320, 568]]) {
    const k = await ladderKit("crowd" + w, { w, h, crowd: true, games: true, meRating: 1655, meGames: 5 }), pg = k.pg;
    await ladderOpen(pg, "first");
    const rowsT = await boxes(pg, '[data-testid="ladder-row"]');
    row(rowsT.length === 7, "ladder " + w + ": seven players are listed (everyone with three games or more, nobody with one)", rowsT.length + " rows");
    row(/^1 Abcdefghijklmnop.*1842$/.test(rowsT[0].t) && /^2 WWWWWWWWWWWWWWWW.*1790$/.test(rowsT[1].t) && /^3 Dawn Smith.*1655$/.test(rowsT[2].t) && /^4 Mmmmmmmmmmmmmmmm.*1502$/.test(rowsT[3].t) && /^5 Iiiiiiiiiiiiiiii.*1500$/.test(rowsT[4].t),
        "ladder " + w + ": the order is rating first (1842, 1790, 1655, 1502, 1500), then the lower ranks", rowsT.map(r => r.t).join(" | ").slice(0, 300));
    const mine = await boxes(pg, '[data-testid="ladder-row"].me');
    row(mine.length === 1 && /Dawn Smith/.test(mine[0].t), "ladder " + w + ": exactly one row is the caller's, highlighted");
    const you = await boxes(pg, '[data-testid="ladder-you"]');
    row(you.length === 1 && /You are number 3 on the ladder with a rating of 1655: 5 won, 0 lost, 0 drawn\./.test(you[0].t) && you[0].r <= w, "ladder " + w + ": the caller's own line says where they stand", you[0] && you[0].t);
    await ladFits(pg, w, "ladder " + w);
    const rec = await boxes(pg, '[data-testid="ladder-game"]');
    row(rec.length === 3 && /^Rec Six \(Dorinthea\) beat Rec Five \(Viserai\) conceded · 5 min ago$/.test(rec[0].t) && /^Rec Three \(Bravo\) and Rec Four \(Katsu\) drew draw · 3 hours ago$/.test(rec[1].t) && /^Rec One \(Kayo\) beat Rec Two \(Dash\) won · 2 days ago$/.test(rec[2].t),
        "ladder " + w + ": the latest games read in plain words (who beat whom with which hero, how it ended, when), newest first", rec.map(r => r.t).join(" | ").slice(0, 400));
    const full = await ladText(pg);
    row(ladJargon(full) && /fan-made ladder, for fun and glory: no ads, forever/.test(full), "ladder " + w + ": no identifier, field name or version number in the words, and the mission line is there");
    /* rows do nothing, so they are not controls: no button, link or tab stop inside the list, and tapping a row changes nothing */
    const ctl = await pg.evaluate(() => document.querySelectorAll('[data-testid="ladder-board"] button, [data-testid="ladder-board"] a, [data-testid="ladder-board"] [tabindex], [data-testid="ladder-board"] [role="button"], [data-testid="ladder-recent"] button').length + [...document.querySelectorAll('[data-testid="ladder-row"]')].filter(r => getComputedStyle(r).cursor === "pointer").length);
    const before = await text(pg); await pg.locator('[data-testid="ladder-row"]').first().click(); await wait(150);
    row(ctl === 0 && (await text(pg)) === before, "ladder " + w + ": the rows are not controls (no button, link, tab stop or pointer), and tapping one changes nothing");
    const reads = k.lad.reads;
    row(reads === 1 && k.lad.last.player !== null, "ladder " + w + ": opening it was one read of the backend, with the caller's line asked for", reads + " reads");
    await thumbs(pg, "ladder " + w, ".tblwrap");
    await click(pg, btn(pg, /^Back/), "back from the ladder"); await pg.waitForSelector('[data-testid="ladder-open"]');
    row(/Find a match to play the next player/.test(await text(pg)), "ladder " + w + ": Back from the ladder returns to the first screen it was opened from");
    const bad = k.kit.errors.filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && k.wd.errors.length === 0, "ladder " + w + ": no page error and no internal error on the fake server", bad.concat(k.wd.errors).join(" | ").slice(0, 200));
    await k.kit.close();
  }
  /* L2: the empty ladder, and the caller who has not played */
  {
    const k = await ladderKit("empty", {}), pg = k.pg;
    await ladderOpen(pg, "srv");
    const em = await boxes(pg, '[data-testid="ladder-empty"]');
    row(em.length === 1 && em[0].t === "No one is on the ladder yet. Be the first: play three ranked games." && (await boxes(pg, '[data-testid="ladder-row"]')).length === 0, "empty ladder: the honest empty state, and no rows", em[0] && em[0].t);
    const you = await boxes(pg, '[data-testid="ladder-you"]');
    row(you.length === 1 && /Your rating is 1200\. 3 more ranked games and you are on the ladder\./.test(you[0].t), "empty ladder: a caller with no games is told how many more it takes", you[0] && you[0].t);
    row((await boxes(pg, '[data-testid="ladder-recent"]')).length === 0, "empty ladder: no 'latest games' card with nothing in it");
    row(await overflow(pg), "empty ladder: no horizontal overflow");
    await click(pg, btn(pg, /^Back/), "back from the ladder"); await pg.waitForSelector(".tblwrap button:has-text('Open a server table')");
    row((await boxes(pg, ".tblwrap button")).some(b => /^open a server table/i.test(b.t)), "ladder from the server table screen: Back returns to it");
    await k.kit.close();
  }
  /* L3: one game played, two to go; from the name sheet; Back returns to the name sheet */
  {
    const k = await ladderKit("two", { crowd: false, meRating: 1216, meGames: 1 }), pg = k.pg;
    await ladderOpen(pg, "name");
    const you = await boxes(pg, '[data-testid="ladder-you"]');
    row(you.length === 1 && /Your rating is 1216 after 1 ranked game\. 2 more ranked games and you are on the ladder\./.test(you[0].t), "provisional: one game played, two to go, said in words", you[0] && you[0].t);
    await click(pg, btn(pg, /^Back/), "back from the ladder"); await pg.waitForSelector(".tblname");
    row(await pg.evaluate(() => /Your player name/.test(document.body.innerText)), "ladder from the name sheet: Back returns to the name sheet");
    await k.kit.close();
  }
  /* L4: failure and retry */
  {
    const k = await ladderKit("fail", { crowd: true, meRating: 1655, meGames: 5 }), pg = k.pg;
    k.wd.fault.dead(true);
    await ladderOpen(pg, "first");
    await pg.waitForSelector('[data-testid="ladder-fail"]', { timeout: 8000 }).catch(() => {});
    const f = await boxes(pg, '[data-testid="ladder-fail"]');
    row(f.length === 1 && /The ladder is not answering right now\. Check your connection, then try again\./.test(f[0].t) && f[0].r <= W && ladJargon(f[0].t), "ladder failure: a plain sentence and a way to try again", f[0] && f[0].t);
    await thumbs(pg, "ladder failure", '[data-testid="ladder-fail"]');
    k.wd.fault.dead(false);
    await click(pg, btn(pg, /^Try again/), "try again");
    await pg.waitForSelector('[data-testid="ladder-row"]', { timeout: 8000 }).catch(() => {});
    row((await boxes(pg, '[data-testid="ladder-row"]')).length >= 5 && (await boxes(pg, '[data-testid="ladder-fail"]')).length === 0, "ladder failure: Try again reads the ladder and the failure is gone");
    await k.kit.close();
  }
  /* L5: a phone with no sign-in reads the public list, is never signed in by looking, and is told what it takes */
  {
    const k = await ladderKit("anon", { crowd: true, known: false }), pg = k.pg;
    const calls0 = k.idp.calls;
    await ladderOpen(pg, "first");
    const sent = await pg.evaluate(() => window.__srvPosted || null);
    row((await boxes(pg, '[data-testid="ladder-row"]')).length >= 5 && (await boxes(pg, '[data-testid="ladder-you"]')).length === 0, "anonymous: the public list shows with no caller's line");
    const anon = await boxes(pg, '[data-testid="ladder-anon"]');
    row(anon.length === 1 && /Open a ranked table to get a place here: a player name, then 3 ranked games\./.test(anon[0].t), "anonymous: a one-line way in", anon[0] && anon[0].t);
    row(k.lad.reads === 1 && k.lad.last.player === null && k.idp.calls === calls0, "anonymous: no identity was sent and the sign-in provider was never asked", JSON.stringify(k.lad.last));
    row(!k.wd.outbound.some(e => /"op":"ladder"/.test(e.text) && /identity/.test(e.text)), "anonymous: the request on the wire carried no sign-in");
    void sent;
    await k.kit.close();
  }
  /* L6: a listed caller below the player, a nameless caller with games */
  {
    const k = await ladderKit("nameless", { me: null, meRating: 1500, meGames: 7 }), pg = k.pg;
    await ladderOpen(pg, "srv");
    const you = await boxes(pg, '[data-testid="ladder-you"]');
    row(you.length === 1 && /You have played 7 ranked games\. Choose a player name and you are on the ladder\./.test(you[0].t) && (await boxes(pg, '[data-testid="ladder-row"]')).length === 0, "nameless: games but no name is told to choose a name, and is not listed", you[0] && you[0].t);
    await k.kit.close();
  }

  /* ---- S6.1: FIND A MATCH, ON THE PAGE: two real pages meet through the queue (009_seek.sql's behaviour, test/helpers/serverfakes.js withSeek) ---- */
  const seekKit = async (label, o) => {
    o = o || {};
    const kA = await open({ w: o.w || W, h: H }), kB = await open({ w: W, h: H });
    const bld = await kA.page.evaluate(() => TABLE_BUILD);
    const wd = makeWorld({ seedKey: "seek-" + label, build: bld, deal: dealLikeThePage });
    await wire(kA.page, wd); await wire(kB.page, wd);
    const idp = F.memIdentity(), rat = F.withRatings(), sk = F.withSeek();
    wd.deps.identify = t => idp.identify(t); wd.deps.rename = (pl, n, f) => idp.rename(pl, n, f); Object.assign(wd.deps, rat.deps(), sk.deps());
    const toks = [idp.issue("P-sk-a"), idp.issue("P-sk-b")];
    if(o.names){ idp.rename("P-sk-a", o.names[0], wd.server.nameFold(o.names[0])); idp.rename("P-sk-b", o.names[1], wd.server.nameFold(o.names[1])); }
    for(const [k, t] of [[kA, toks[0]], [kB, toks[1]]]){ const shim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(t) + ")};"; await k.page.addInitScript(shim); await k.page.evaluate(shim); await k.page.evaluate(() => { window.SERVER_TABLE.on = true; }); }
    return { kA, kB, A: kA.page, B: kB.page, wd, sk, idp, rat };
  };
  const toFirst = async pg => { await click(pg, btn(pg, /^Find an opponent/), "find an opponent"); await pg.waitForSelector(".tblwrap"); };
  const lobbyUp = pg => pg.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 12000 }).then(() => true, () => false);
  const seekJargon = t => !/undefined|NaN|\bnull\b|refused|bad-request|unavailable|seek_|\bop\b|\bv6\.|player id|table-cap/i.test(t);
  /* K1: A taps Find a match (first screen) and waits; B taps it and both reach the lobby at A's table */
  {
    const k = await seekKit("meet");
    await toFirst(k.A); await toFirst(k.B);
    const fb = await boxes(k.A, '[data-testid="seek-open"]');
    row(fb.length === 1 && /^find a match$/i.test(fb[0].t) && fb[0].h >= 44 && fb[0].x >= 0 && fb[0].r <= W, "seek: the first screen offers Find a match, thumb-sized, inside the screen", JSON.stringify(fb[0]));
    await click(k.A, k.A.locator('[data-testid="seek-open"]'), "A: find a match");
    await k.A.waitForSelector('[data-testid="seek-card"]', { timeout: 8000 }).catch(() => {});
    await k.A.waitForFunction(() => /Looking for an opponent/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const card = await inside(k.A, '[data-testid="seek-card"]', "seek: the waiting card");
    const c1 = (await boxes(k.A, '[data-testid="seek-clock"]'))[0];
    await wait(2100);
    const c2 = (await boxes(k.A, '[data-testid="seek-clock"]'))[0];
    row(!!c1 && !!c2 && /^\d+:\d\d$/.test(c1.t) && c1.t !== c2.t, "seek: the waiting clock ticks (m:ss)", (c1 && c1.t) + " -> " + (c2 && c2.t));
    const at = await text(k.A);
    row(/Finding a match/.test(at) && /Looking for an opponent/.test(at) && /Keep this screen open/.test(at) && seekJargon(at), "seek: the card says what is happening and what to do, in plain words");
    const cancelB = await boxes(k.A, '[data-testid="seek-cancel"]');
    row(cancelB.length === 1 && /^stop looking$/i.test(cancelB[0].t) && cancelB[0].h >= 40 && cancelB[0].b <= H, "seek: Stop looking is on screen", JSON.stringify(cancelB[0]));
    await thumbs(k.A, "seek waiting"); row(await overflow(k.A), "seek waiting: no horizontal overflow");
    row(k.sk.q.size === 1 && k.sk.count(60).friendly === 1, "seek: A is in the queue (one friendly seek)");
    const aTable = [...k.sk.q.values()][0] && [...k.sk.q.values()][0].table;
    row(!!aTable && k.wd.row(aTable) && k.wd.row(aTable).creator === "P-sk-a", "seek: A waits at a table opened for A");
    /* B, on the SERVER TABLE screen, sees one player looking (the first screen asks the server nothing while a player only looks) */
    row((await boxes(k.B, '[data-testid="looking"]')).length === 0, "seek: the first screen shows no count (it makes no request while a player only looks)");
    await click(k.B, btn(k.B, /^Join a server table/), "B: the server table screen");
    await k.B.waitForSelector('[data-testid="looking-srv"]', { timeout: 6000 }).catch(() => {});
    const lk = await boxes(k.B, '[data-testid="looking-srv"]');
    row(lk.length === 1 && lk[0].t === "1 player is looking for a match right now." && lk[0].r <= W, "seek: another phone's server table screen says one player is looking", lk[0] && lk[0].t);
    await click(k.B, k.B.locator('[data-testid="seek-go"]'), "B: find a match");
    const upA = await lobbyUp(k.A), upB = await lobbyUp(k.B);
    row(upA && upB, "seek: both pages reach the lobby (Choose your fighter) together", "A " + upA + ", B " + upB);
    const r = k.wd.row(aTable);
    row(!!r && Array.isArray(r.owners) && r.owners[0] === "P-sk-a" && r.owners[1] === "P-sk-b", "seek: A holds chair one and B chair two at A's table", JSON.stringify(r && r.owners));
    row(k.sk.count(60).friendly === 0, "seek: the queue is empty after the match");
    await wait(300);
    const bad = k.kA.errors.concat(k.kB.errors).filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && k.wd.errors.length === 0, "seek: no page error and no internal error on the fake server", bad.concat(k.wd.errors).join(" | ").slice(0, 200));
    await k.kA.close(); await k.kB.close();
  }
  /* K1b: WAITING IS LONELY (SEEK N). After the quiet minute (shortened here through SERVER_TABLE.quietMs) the card offers Play the AI while you wait;
     the search keeps running behind the practice screens; a match that lands mid-practice is a banner, taken only by a tap, and ignored it is just an unanswered match */
  {
    const k = await seekKit("lonely");
    await k.A.evaluate(() => { window.SERVER_TABLE.quietMs = 3500; });
    await toFirst(k.A); await toFirst(k.B);
    await click(k.A, k.A.locator('[data-testid="seek-open"]'), "A: find a match");
    await k.A.waitForFunction(() => /Looking for an opponent/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    row((await boxes(k.A, '[data-testid="seek-play-ai"]')).length === 0 && (await boxes(k.A, '[data-testid="seek-quiet"]')).length === 0, "waiting: no offer of the AI before the quiet minute has passed");
    await k.A.waitForSelector('[data-testid="seek-play-ai"]', { timeout: 9000 }).catch(() => {});
    const ai = await boxes(k.A, '[data-testid="seek-play-ai"]'), qn = await boxes(k.A, '[data-testid="seek-quiet"]');
    row(ai.length === 1 && /^play the ai while you wait$/i.test(ai[0].t) && ai[0].h >= 40 && ai[0].x >= 0 && ai[0].r <= W && ai[0].b <= H, "waiting: after the quiet minute the card offers Play the AI while you wait, thumb-sized, on screen", JSON.stringify(ai[0]));
    row(qn.length === 1 && seekJargon(qn[0].t) && /keeps going/.test(qn[0].t), "waiting: the line under the clock is plain and says the search keeps going", qn[0] && qn[0].t);
    const aTable = [...k.sk.q.values()][0] && [...k.sk.q.values()][0].table;
    await click(k.A, k.A.locator('[data-testid="seek-play-ai"]'), "A: play the AI while waiting");
    await k.A.waitForSelector('[data-testid="wait-bar"]', { timeout: 6000 }).catch(() => {});
    const wb = await boxes(k.A, '[data-testid="wait-bar"]');
    row(wb.length === 1 && wb[0].r <= W && seekJargon(wb[0].t) && (await boxes(k.A, '[data-testid="seek-card"]')).length === 0, "waiting: tapping it opens the hero grid with a Still looking bar, and the seek card is out of sight", wb[0] && wb[0].t);
    await wait(400);
    row(k.sk.q.size === 1 && !!aTable && k.wd.row(aTable) && k.wd.row(aTable).closed !== true, "waiting: the search is NOT cancelled by practising (A still queued, table open)", "queue " + k.sk.q.size);
    await k.A.locator(".hcard").first().click(); await k.A.locator(".battlebtn").first().click();
    await k.A.waitForFunction(() => /throw|first|coin|who goes/i.test(document.body.innerText) && !document.querySelector('[data-testid="wait-bar"]'), null, { timeout: 8000 }).catch(() => {});
    row((await boxes(k.A, '[data-testid="wait-bar"]')).length === 0 && (await boxes(k.A, '[data-testid="match-ready"]')).length === 0, "waiting: a practice game starts, no banner yet");
    await click(k.B, k.B.locator('[data-testid="seek-open"]'), "B: find a match");
    await k.A.waitForSelector('[data-testid="match-ready"]', { timeout: 15000 }).catch(() => {});
    const bn = await boxes(k.A, '[data-testid="match-ready"]'), tk = await boxes(k.A, '[data-testid="match-take"]');
    row(bn.length === 1 && /^your match is ready/i.test(bn[0].t) && seekJargon(bn[0].t) && bn[0].y <= 2 && bn[0].r <= W, "waiting: a match arriving mid-practice shows Your match is ready over the game", bn[0] && bn[0].t);
    row(tk.length === 1 && tk[0].h >= 44 && tk[0].r <= W && !/Choose your fighter/i.test(await text(k.A)), "waiting: the practice game is not taken away from the player, and the take button is thumb-sized", JSON.stringify(tk[0]));
    await wait(1500);
    const r0 = k.wd.row(aTable);
    row((await boxes(k.A, '[data-testid="match-ready"]')).length === 1 && !!r0 && r0.owners && r0.owners[1] === "P-sk-b" && r0.closed !== true, "waiting: ignored, the match simply stands as an unanswered match does (banner stays, table open, both chairs held)", JSON.stringify(r0 && r0.owners));
    await click(k.A, k.A.locator('[data-testid="match-take"]'), "A: join them");
    const upA = await lobbyUp(k.A), upB = await lobbyUp(k.B);
    row(upA && upB && (await boxes(k.A, '[data-testid="match-ready"]')).length === 0, "waiting: taking the match leaves the practice game and both reach the lobby", "A " + upA + ", B " + upB);
    const bad = k.kA.errors.concat(k.kB.errors).filter(e => !/404|Failed to load resource/.test(e));
    row(bad.length === 0 && k.wd.errors.length === 0, "waiting: no page error and no internal error", bad.concat(k.wd.errors).join(" | ").slice(0, 200));
    await k.kA.close(); await k.kB.close();
  }
  /* K2: Stop looking takes A out of the queue and closes the table; a ranked search from the server screen needs a name and meets only a ranked seeker */
  {
    const k = await seekKit("cancel", { names: ["Dawn Smith", "Rival One"] });
    await toFirst(k.A); await click(k.A, k.A.locator('[data-testid="seek-open"]'), "A: find a match");
    await k.A.waitForFunction(() => /Looking for an opponent/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const t0 = [...k.sk.q.values()][0] && [...k.sk.q.values()][0].table;
    await click(k.A, k.A.locator('[data-testid="seek-cancel"]'), "A: stop looking");
    await k.A.waitForSelector('[data-testid="seek-go"]', { timeout: 6000 }).catch(() => {});
    await wait(400);
    row(k.sk.q.size === 0 && !!t0 && k.wd.row(t0).closed === true, "seek: Stop looking leaves the queue and closes the waiting table", "queue " + k.sk.q.size);
    row((await boxes(k.A, '[data-testid="seek-go"]')).length === 1, "seek: Stop looking returns to the server table screen (Find a match is there)");
    /* ranked: B queues FRIENDLY, A queues RANKED: they must not meet */
    await toFirst(k.B); await click(k.B, k.B.locator('[data-testid="seek-open"]'), "B: find a (friendly) match");
    await k.B.waitForFunction(() => /Looking for an opponent/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    await click(k.A, k.A.locator('[data-testid="ranked-switch"]'), "A: switch to ranked");
    const rb = await boxes(k.A, '[data-testid="seek-go"]');
    row(rb.length === 1 && /^find a ranked match$/i.test(rb[0].t), "seek: with the switch on the button reads 'Find a ranked match'", rb[0] && rb[0].t);
    await click(k.A, k.A.locator('[data-testid="seek-go"]'), "A: find a ranked match");
    await k.A.waitForFunction(() => /Finding a ranked match/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    await wait(500);
    row(/Finding a ranked match/.test(await text(k.A)) && k.sk.count(60).friendly === 1 && k.sk.count(60).ranked === 1, "seek: a ranked seeker waits beside a friendly one; they do not meet", JSON.stringify(k.sk.count(60)));
    /* B stops, switches to ranked, finds: they meet at a ranked table */
    await click(k.B, k.B.locator('[data-testid="seek-cancel"]'), "B: stop looking");
    await k.B.waitForSelector('[data-testid="ranked-switch"]', { timeout: 6000 }).catch(() => {});
    await click(k.B, k.B.locator('[data-testid="ranked-switch"]'), "B: switch to ranked");
    await click(k.B, k.B.locator('[data-testid="seek-go"]'), "B: find a ranked match");
    const upA = await lobbyUp(k.A), upB = await lobbyUp(k.B);
    const rt = [...k.wd.store.rows.keys()].map(id => k.wd.row(id)).find(x => x.ranked === true && Array.isArray(x.owners) && x.owners[1] === "P-sk-b");
    row(upA && upB && !!rt && rt.owners[0] === "P-sk-a", "seek: two ranked seekers meet at a ranked table and both reach the lobby", "A " + upA + ", B " + upB);
    await k.kA.close(); await k.kB.close();
  }
  /* K3: a nameless player's ranked search is refused in words, and the page stays usable */
  {
    const k = await seekKit("noname");
    await toServerChooser(k.A);
    await click(k.A, k.A.locator('[data-testid="ranked-switch"]'), "switch to ranked");
    await click(k.A, k.A.locator('[data-testid="seek-go"]'), "find a ranked match (no name)");
    await k.A.waitForSelector(".tblerr", { timeout: 6000 }).catch(() => {});
    const er = await boxes(k.A, ".tblerr");
    row(er.length === 1 && /needs a player name/.test(er[0].t) && seekJargon(er[0].t) && k.sk.q.size === 0, "seek: a nameless ranked search is refused in words, nobody is queued", er[0] && er[0].t);
    row((await boxes(k.A, '[data-testid="seek-go"]')).length === 1, "seek: after the refusal the server screen is still there");
    await k.kA.close(); await k.kB.close();
  }

  /* ---- S5.3: tools/liveranked.js, PROVED OFFLINE: its `run` drives two real pages through one whole ranked game (names, a ranked table, the lobby, a concession, the end
     screens, `me`, the ladder, the Ladder screen) against the fake referee with the fake ratings and ladder backends. Then each of two sabotages must make it FAIL.
     (It is UNRUN on live: that needs 006-008 and the v6.34 function deployed; it writes to the live project.) ---- */
  const LR = require("./liveranked.js");
  const lrRun = async (label, ratOpts, ladOpts, show) => {
    const kA = await open({ w: W, h: H }), kB = await open({ w: W, h: H });
    const bld = await kA.page.evaluate(() => TABLE_BUILD);
    const wd = makeWorld({ seedKey: "lr-" + label, build: bld, deal: dealLikeThePage });
    wd.deps.now = () => Date.now();                     /* the recorded game's time is read against the page's clock, as on live ("just now") */
    await wire(kA.page, wd); await wire(kB.page, wd);
    const idp = F.memIdentity(), rat = F.withRatings(ratOpts), lad = F.withLadder(rat, idp, ladOpts);
    wd.deps.identify = t => idp.identify(t); wd.deps.rename = (pl, n, f) => idp.rename(pl, n, f); Object.assign(wd.deps, rat.deps(), lad.deps());
    const toks = [idp.issue("P-lr-a"), idp.issue("P-lr-b")];
    for(const [k, t] of [[kA, toks[0]], [kB, toks[1]]]){ const shim = "window.__dawnServerIdentity = {token: () => Promise.resolve(" + JSON.stringify(t) + ")};"; await k.page.addInitScript(shim); await k.page.evaluate(shim); await k.page.evaluate(() => { window.SERVER_TABLE.on = true; }); }
    const mkPh = (nm, k, i) => ({ name: nm, page: k.page, done: {}, tok: toks[i], get errors(){ return k.errors.filter(e => !/404|Failed to load resource/.test(e)); } });
    const A = mkPh("host", kA, 0), B = mkPh("guest", kB, 1), got = [];
    await LR.run({ A, B, post: b => wd.transport("lr").post(b), token: ph => Promise.resolve(ph.tok) }, (ok, name, d) => { got.push({ ok, name }); if(show) row(ok, "liveranked: " + name, d); });
    await kA.close(); await kB.close();
    return { got, rat, lad, wd };
  };
  {
    const r = await lrRun("main", {}, {}, true);
    row(r.got.length >= 18 && r.got.every(x => x.ok), "liveranked: the whole run passed offline (" + r.got.length + " checks), against the fake referee", r.got.filter(x => !x.ok).map(x => x.name).join(" | ").slice(0, 200));
    row(r.rat.results.size === 1 && r.rat.records === 1 && [...r.rat.results.values()][0].how === "concession" && r.wd.errors.length === 0, "liveranked: exactly one concession was recorded and the fake server logged no error", r.wd.errors.slice(0, 1).join());
  }
  for(const [what, ro, lo] of [["a K of 16 (the winner reads 1208, not 1216)", { k: 16 }, {}], ["a ladder that lists players under the floor", {}, { noFloor: true }]]){
    const r = await lrRun("sab", ro, lo, false);
    row(r.got.some(x => !x.ok), "liveranked: its sabotage is SEEN: " + what, r.got.filter(x => !x.ok).map(x => x.name).join(" | ").slice(0, 160));
  }

  const fail = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length - fail} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FAIL  drive crashed: " + (e && e.stack || e)); process.exit(1); });
