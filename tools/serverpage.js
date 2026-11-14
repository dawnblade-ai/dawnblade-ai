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
    await click(page, btn(page, /^Open a server table/), "open a server table"); await page.waitForSelector(".tblcode");
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
    row(/Join a server table/i.test(home) && /no direct link needed/i.test(home) && /referee on the web holds the deck/i.test(home) && !/early test/i.test(home), "table screen: the server option sits beside the direct ones, in player words (not an early test), with its honest line");
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
    const txt = await (async () => { await k0.page.getByRole("button", { name: /^Find an opponent/ }).click(); await k0.page.waitForSelector(".tblwrap"); const t = await text(k0.page); await click(k0.page, btn(k0.page, /^Back/), "back"); await k0.page.waitForSelector("button:has-text('Find an opponent')"); return t; })();
    row(!/sb_publishable|supabase|v6\.\d|seedG|nonce|SERVER_TABLE/i.test(txt.match(/Server table Share a code[\s\S]{0,120}/i)[0] + txt.match(/At a server table[\s\S]{0,330}/i)[0]), "the door: the option reads in player language (no identifiers or version numbers)");
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
      const play = () => { const m = DawnBuild.buildMatch({ heroes: ["viserai", "dorinthea"], seed: "probe", first: 0, boards: [{}, {}] }, { db, heroes, decks });
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
    const sentMe = world2.outbound.map(x => JSON.parse(x.text)).filter(e => e.op === "me");
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
  const fail = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length - fail} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FAIL  drive crashed: " + (e && e.stack || e)); process.exit(1); });
