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
  world2.fault.cut(world2.topicOf(code, 0));
  await page.waitForSelector(".srvbar.warn", { timeout: 5000 }).catch(() => {});
  const warn = await inside(page, ".srvbar", "reconnecting: the banner");
  row(!!warn && /reconnecting/.test(warn.t), "reconnecting: it says so", warn && warn.t);
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
