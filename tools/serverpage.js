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
    row(/Join a server table/i.test(home) && /A server table needs no direct link/i.test(home), "table screen: the server option sits beside the direct ones, with its honest line");
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

  /* ---- 1b. THE TESTER'S DOOR: off by default; ?server=1 opens it and the page remembers; ?server=0 forgets ---- */
  {
    let hits = 0;
    const doorKit = async (query) => { const k = await open({ w: W, h: H, query }); await k.context.route(/supabase\.co/, route => { hits++; route.fulfill({ status: 404, body: "{}" }); }); return k; };
    const offersServer = async (p) => { await p.getByRole("button", { name: /^Find an opponent/ }).click(); await p.waitForSelector(".tblwrap");
      const r = { btn: await p.evaluate(() => [...document.querySelectorAll("button")].some(b => /^Join a server table/.test(b.textContent.trim()))), note: /early test/i.test(await text(p)) };
      await click(p, btn(p, /^Back/), "back"); await p.waitForSelector("button:has-text('Find an opponent')"); return r; };
    const reopen = async (p, href, query) => { await p.goto(href + query); await p.waitForSelector(".shell", { timeout: 15000 });
      await p.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 30000 }); };
    const k0 = await doorKit("");
    row(await k0.page.evaluate(() => window.SERVER_TABLE.on === false), "tester's door: the shipped switch is off");
    let r = await offersServer(k0.page);
    row(!r.btn && !r.note, "tester's door: no query, nothing remembered - no server option on the table screen");
    await reopen(k0.page, k0.href, "?server=1");
    r = await offersServer(k0.page);
    row(r.btn, "tester's door: ?server=1 shows the server option (shipped switch still off)");
    const txt = await (async () => { await k0.page.getByRole("button", { name: /^Find an opponent/ }).click(); await k0.page.waitForSelector(".tblwrap"); const t = await text(k0.page); await click(k0.page, btn(k0.page, /^Back/), "back"); await k0.page.waitForSelector("button:has-text('Find an opponent')"); return t; })();
    row(/early test/i.test(txt) && !/sb_publishable|supabase|v6\.\d|seedG|nonce/i.test(txt.match(/A server table needs no direct link[\s\S]{0,300}/i)[0]), "tester's door: the option reads as an early test, in player language (no identifiers or version numbers)");
    row(await k0.page.evaluate(() => window.SERVER_TABLE.on === false && window.localStorage.getItem("dawnblade.server") === "true"), "tester's door: the choice is kept in the page's store seam, the shipped switch untouched");
    await reopen(k0.page, k0.href, "");
    r = await offersServer(k0.page);
    row(r.btn, "tester's door: a relaunch without the query keeps it (home-screen launch)");
    await reopen(k0.page, k0.href, "?server=0");
    r = await offersServer(k0.page);
    row(!r.btn, "tester's door: ?server=0 forgets it");
    await reopen(k0.page, k0.href, "");
    r = await offersServer(k0.page);
    row(!r.btn && hits === 0, "tester's door: and it stays forgotten; no request reached the project while only looking", "hits " + hits);
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
    await page.evaluate(() => { delete window.__dawnServerTransport; window.SERVER_TABLE.on = true; });
    await toServerChooser(page);
    await click(page, btn(page, /^Open a server table/), "open a server table (real transport)");
    await page.waitForSelector(".tblcode", { timeout: 15000 }).catch(() => {});
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
  const B = PH.makePhone(world2, "B", { hero: "dorinthea", rand, build, matchCatalog, throws: [["rock", "rock"], ["paper", "rock"]] });
  await B.connect("join", code);
  await page.waitForFunction(() => /server table/i.test(document.body.innerText) && /Choose your fighter/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  const seated = await text(page);
  if(process.env.DEBUG_DRIVE) console.log('DEBUG seated text:', seated.slice(0, 400), JSON.stringify(B.ch.report()), world2.posts.slice(-6));
  row(/Choose your fighter/i.test(seated) && /seat 0 · server table/i.test(seated), "both seated: the lobby opens at seat 0, labelled a server table");
  row(await overflow(page), "lobby: no horizontal overflow");
  row(await page.evaluate(() => !document.querySelector(".srvbar")), "lobby: no server banner while the link is fine");

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

  await kit.close();
  const fail = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length - fail} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FAIL  drive crashed: " + (e && e.stack || e)); process.exit(1); });
