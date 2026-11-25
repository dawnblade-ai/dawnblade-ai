#!/usr/bin/env node
/* ============================================================
   THE PAGE, OFFLINE — the REAL index.html in headless Chromium at phone
   size, with every external request answered from local files.

   CLAUDE.md says a UI change is checked by driving the real page at
   393x852 and asserting on element boxes. A sandbox whose egress proxy
   blocks the CDNs cannot do that: React, Babel, the fonts and the card
   art all come from other people's servers, and a
   blank page reports as a blank page, not as an error. This file answers
   those requests with `page.route` instead of rewriting the page, so what
   is driven is index.html and engine/*.js byte for byte, loaded from
   file:// the way a phone opens it. (tools/phone/serve.sh is the older
   route: it serves a SUBSTITUTED copy over http and downloads the card
   database. Use whichever the machine allows.)

   WHAT IS ROUTED
     cdnjs react / react-dom / babel-standalone   npm react, react-dom, @babel/standalone
     unpkg peerjs (loaded lazily by engine/room.js) npm peerjs
     jsdelivr @supabase/supabase-js (engine/servertable.js, lazily, on the first server table) npm @supabase/supabase-js
     fonts.googleapis.com css2                    generated @font-face over @fontsource files
     fonts.gstatic.com                            the @fontsource woff2 files
     any image or font from any other host        a 5:7 grey PNG / an empty 200
   The card text is NOT routed: since v5.74 the page loads data/pool.js
   from beside itself (RULING user 2026-11-02, "pinned pool only"), so a
   request to raw.githubusercontent.com is a regression and lands below.
   Anything ELSE that leaves the page is answered 404 and recorded as an
   error, so a new external dependency fails the smoke check by name
   instead of by a blank screen. CDN versions are read from the URL the
   page asks for and compared with the installed package: if index.html
   moves to a version the deps directory does not hold, that is an error
   too (it would be testing a different React than the phone runs).

   DEPS (outside the repo, which keeps ZERO dependencies)
     npm install --prefix "$PAGE_DEPS" --save-exact react@18.2.0 \
       react-dom@18.2.0 @babel/standalone@7.23.5 peerjs@1.5.4 @supabase/supabase-js@2.115.0 \
       @fontsource/big-shoulders-display @fontsource/spline-sans \
       @fontsource/spline-sans-mono
   The fonts are optional for loading, NOT for the width rows: without them the CSS is empty and the
   page falls back to system fonts, so the jump-row and action-bar rows can FAIL for the sandbox's
   reason (the run now warns and tags those FAILs). The
   card art is always a stand-in, so card images are placeholders.
   Needs `playwright` resolvable by require (NODE_PATH, or run from a
   directory that has it). PW_CHROMIUM names an explicit browser binary.

   USE
     node tools/page.js                 smoke check: PASS/FAIL per screen
     const {open} = require("./tools/page");
     const {page, errors, close} = await open({w:393, h:852});

   NOT part of `npm test` and never will be: the suite stays green on a
   fresh clone with no browser (v3.00). Plain Node; requires only playwright.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const DEFAULT_DEPS = "/tmp/claude-0/-home-user-dawnblade-ai/0e392574-df59-5e28-9290-d593d0b10def/scratchpad/pagedeps";
const depsDir = () => process.env.PAGE_DEPS || DEFAULT_DEPS;
/* THE FONT PACKAGES THIS RUN IS MISSING. Without them the page falls back to system fonts and
   the width-sensitive rows (the jump row's hit areas, the crowded action bar) FAIL at 393 px for
   a reason that is the sandbox's, not the page's (2026-11-23: four such FAILs, all clean with the
   fonts installed). A FAIL under missing fonts is therefore printed with the cause. */
const missingFonts = (deps = depsDir()) => Object.values(FONT_FAMILIES).map(x => x[0])
  .filter(pkg => !fs.existsSync(path.join(deps, "node_modules", pkg, "package.json")));

/* ---------- the stand-ins ---------- */

/* A flat grey PNG at card proportions (5:7), so a card image takes the
   room a real one would. Built by hand: CRC and deflate are all a PNG needs. */
function grayPng(w, h){
  const T = new Uint32Array(256).map((_, n) => { let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = ~0; for(const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.concat([Buffer.from(type), data]), n = Buffer.alloc(4), s = Buffer.alloc(4);
    n.writeUInt32BE(data.length); s.writeUInt32BE(crc(t));
    return Buffer.concat([n, t, s]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 0x55); for(let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- the routing table ---------- */

const FONT_FAMILIES = {   // Google family -> [npm package, file slug]
  "Big Shoulders Display": ["@fontsource/big-shoulders-display", "big-shoulders-display"],
  "Spline Sans":           ["@fontsource/spline-sans", "spline-sans"],
  "Spline Sans Mono":      ["@fontsource/spline-sans-mono", "spline-sans-mono"],
};
const CDN_PKG = { "react": "react", "react-dom": "react-dom", "babel-standalone": "@babel/standalone" };

/* Returns answer(url, resourceType) -> {status, contentType, body} | {error}. */
function makeAnswer(deps){
  const nm = (...p) => path.join(deps, "node_modules", ...p);
  const png = grayPng(50, 70);
  const read = f => fs.readFileSync(f);
  const ok = (contentType, body) => ({ status: 200, contentType, body });
  const TYPES = { ".js": "text/javascript", ".woff2": "font/woff2", ".css": "text/css", ".json": "application/json" };

  /* a package file, after checking the version the page asked for is the one installed */
  const pkgFile = (pkg, want, rel) => {
    const pj = nm(pkg, "package.json");
    if(!fs.existsSync(pj)) return { error: `${pkg} is not installed under ${deps} (see the header of tools/page.js)` };
    const have = JSON.parse(read(pj)).version;
    if(want && have !== want) return { error: `index.html asks for ${pkg}@${want} but ${deps} holds ${have}` };
    const f = nm(pkg, rel);
    if(!fs.existsSync(f)) return { error: `${pkg}@${have} has no file ${rel}` };
    return ok(TYPES[path.extname(f)] || "application/octet-stream", read(f));
  };

  const fontCss = url => {
    const q = new URL(url).searchParams, out = [];
    for(const fam of q.getAll("family")){
      const [name, spec] = fam.split(":"), meta = FONT_FAMILIES[name];
      const weights = ((spec || "").match(/wght@([\d;]+)/) || [, "400"])[1].split(";");
      if(!meta || !fs.existsSync(nm(meta[0], "package.json"))) continue;
      for(const w of weights)
        out.push(`@font-face{font-family:'${name}';font-style:normal;font-weight:${w};font-display:swap;` +
          `src:url(https://fonts.gstatic.com/s/${meta[1]}-latin-${w}-normal.woff2) format('woff2');}`);
    }
    return ok("text/css", Buffer.from(out.join("\n")));
  };

  return function answer(url, type){
    const u = new URL(url), h = u.hostname;
    let m;
    if(h === "cdnjs.cloudflare.com" && (m = u.pathname.match(/^\/ajax\/libs\/([^/]+)\/([\d.]+)\/(.+)$/)) && CDN_PKG[m[1]]){
      return pkgFile(CDN_PKG[m[1]], m[2], m[3]);
    }
    if(h === "unpkg.com" && (m = u.pathname.match(/^\/((?:@[^/]+\/)?[^@/]+)@([\d.]+)\/(.+)$/))) return pkgFile(m[1], m[2], m[3]);
    if(h === "cdn.jsdelivr.net" && (m = u.pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)@([\d.]+)\/(.+)$/))) return pkgFile(m[1], m[2], m[3]);
    if(h === "fonts.googleapis.com") return fontCss(url);
    if(h === "fonts.gstatic.com"){
      const file = path.basename(u.pathname), slug = file.replace(/-latin-.*$/, "");
      const meta = Object.values(FONT_FAMILIES).find(x => x[1] === slug);
      const f = meta && nm(meta[0], "files", file);
      return f && fs.existsSync(f) ? ok("font/woff2", read(f)) : ok("font/woff2", Buffer.alloc(0));
    }
    if(type === "image") return ok("image/png", png);
    if(type === "font") return ok("font/woff2", Buffer.alloc(0));
    return { status: 404, contentType: "text/plain", body: Buffer.from("offline harness: unrouted"),
             error: `unrouted external request: ${url}` };
  };
}

/* ---------- open ---------- */

function needPlaywright(){
  try { return require("playwright"); }
  catch(e){ throw new Error("tools/page.js needs `playwright` (set NODE_PATH, or run where require('playwright') resolves)"); }
}

/* Load the real page. Resolves once the card database is ready (the topbar
   reads "N cards"). Rejects, after closing the browser, if the load itself
   produced a page error or console error. `errors` keeps filling afterwards:
   call check() to throw on anything new. */
async function open({ w = 393, h = 852, deps = depsDir(), query = "", launch = null } = {}){
  const { chromium } = needPlaywright();
  const answer = makeAnswer(deps);
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), ...(launch || {}) });   /* `launch`: e.g. the egress proxy, for tools/perf-page.js's live drive */
  const context = await browser.newContext({ ...(launch ? { ignoreHTTPSErrors: true } : {}), viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [], routed = {};
  const seen = new Set();
  const fail = msg => { if(!seen.has(msg)){ seen.add(msg); errors.push(msg); } };
  page.on("pageerror", e => fail("pageerror: " + String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")));
  page.on("console", m => { if(m.type() === "error") fail("console.error: " + m.text() + (m.location().url ? " @ " + m.location().url : "")); });
  page.on("dialog", d => { fail(`dialog(${d.type()}): ${d.message()}`); d.dismiss().catch(() => {}); });
  await context.route(/^https?:/, route => {
    const req = route.request(), r = answer(req.url(), req.resourceType());
    const host = new URL(req.url()).hostname;
    routed[host] = (routed[host] || 0) + 1;
    if(r.error) fail(r.error);
    route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body,
                    headers: { "access-control-allow-origin": "*" } });
  });
  const check = () => { if(errors.length) throw new Error(errors.length + " page error(s):\n  " + errors.join("\n  ")); };
  const close = () => browser.close();
  try {
    /* THE SAME DEAL EVERY RUN: the AI table is seeded by the clock, so which
       opportunistic checks run used to depend on the hand dealt (70-73 screens
       on one page). index.html's `battleSeed` reads this instead. */
    await page.addInitScript(() => { window.__dawnSeedFix = 1730000000000; });
    await page.goto(pathToFileURL(INDEX).href + query);   /* `query`: e.g. "?server=1", the tester's door */
    await page.waitForSelector(".shell", { timeout: 15000 });
    await page.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    check();
  } catch(e){
    await close();
    /* a missing dependency shows up first as a recorded error and then as a timeout: say the cause */
    if(errors.length) throw new Error(errors.length + " error(s) while loading:\n  " + errors.join("\n  "));
    throw e;
  }
  return { page, browser, context, errors, routed, check, close, href: pathToFileURL(INDEX).href };
}

module.exports = { open, makeAnswer, depsDir };

/* ============================================================
   THE SMOKE CHECK
   ============================================================ */
if(require.main === module){
  const W = 393, H = 852;
  (async () => {
    const t0 = Date.now(), rows = [];
    let kit;
    try { kit = await open({ w: W, h: H }); }
    catch(e){ console.log("FAIL  load: " + e.message); process.exit(1); }
    const { page, errors, routed } = kit;
    const ver = await page.evaluate(() => window.APP_VER);
    const noFonts = missingFonts();
    if(noFonts.length) console.log("WARN  fonts not installed (" + noFonts.join(", ") + "): system fonts stand in, so a width FAIL below may be the sandbox's; install them (header of tools/page.js) before trusting it");
    const row = (ok, name, detail) => { rows.push({ ok, name }); console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "") + (!ok && noFonts.length ? "  [fonts missing: may be an artifact]" : "")); };

    /* No horizontal overflow. The page is judged by scrollWidth; the elements
       that stick out (outside any scroller of their own) are the diagnosis. */
    const widths = name => page.evaluate(({ w }) => {
      const se = document.scrollingElement, bad = [];
      const clipped = el => { for(let p = el.parentElement; p && p !== document.body; p = p.parentElement){
        const o = getComputedStyle(p).overflowX; if(o !== "visible") return true; } return false; };
      document.querySelectorAll("body *").forEach(el => {
        const r = el.getBoundingClientRect();
        if(r.width && (r.right > w + 0.5 || r.left < -0.5) && !clipped(el) && bad.length < 4)
          bad.push((el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined ? "." + String(el.className).trim().split(/\s+/).join(".") : "")) + " [" + Math.round(r.left) + ".." + Math.round(r.right) + "]");
      });
      return { sw: se.scrollWidth, cw: se.clientWidth, bad };
    }, { w: W }).then(m => ({ ...m, name }));
    let errSeen = 0;
    const screen = async (name, extra) => {
      await page.waitForTimeout(250);
      const m = await widths(name), fresh = errors.length - errSeen; errSeen = errors.length;
      /* no raw card-text pip ("+1{p}", "{r}") in what a player reads: the feed,
         the ticker, the advisor, the prompt sheet (PipLine, 1.0 polish audit) */
      const pip = await page.evaluate(() => [...document.querySelectorAll(".gamelog, .ticker, .adv, .psheet")]
        .map(e => (e.innerText.match(/[^\n]{0,40}\{[pdrhicut]\}[^\n]{0,20}/) || [])[0]).find(Boolean) || null);
      const ok = m.sw <= W && !fresh && !pip;
      row(ok, name, `scrollWidth ${m.sw}/${W}` + (m.sw > W && m.bad.length ? "  overflow: " + m.bad.join("; ") : "") +
                    (fresh ? "  new errors: " + fresh : "") + (pip ? "  raw pip: " + JSON.stringify(pip) : "") + (extra ? "  " + extra : ""));
    };
    const click = async (loc, what) => { try { await loc.click({ timeout: 4000 }); return true; } catch(e){ row(false, what, "not clickable: " + String(e.message).split("\n")[0]); return false; } };
    const has = sel => page.locator(sel).first().isVisible().catch(() => false);
    const btn = (re) => page.getByRole("button", { name: re });

    console.log(`dawnblade v${ver} at ${W}x${H}, offline (routed hosts: ${Object.entries(routed).map(([k, v]) => k + "x" + v).join(", ")})`);
    await screen("home: roster");
    /* how to play (v6.57): the sheet opens from the roster, fits the phone, every
       section is there, and "Got it" closes it */
    const fresh0 = await has(".howbtn.fresh");
    if(await click(page.locator(".howbtn"), "how to play")){
      await page.waitForSelector(".howsheet");
      const n = await page.locator(".howsheet .howh").count();
      await screen("home: how to play", n === 6 ? "6 sections" : "SECTIONS " + n);
      if(n !== 6) row(false, "home: how to play sections", n + " of 6");
      await click(page.locator(".howsheet .bigbtn"), "how to play: got it");
      row(!(await has(".howsheet")), "home: how to play closes");
      /* a new phone sees it framed; once opened, it is quiet text */
      row(fresh0 && !(await has(".howbtn.fresh")), "home: how to play is framed until opened", `before ${fresh0}`);
    }

    /* the heroes: the first pick leads the whole walk */
    if(await click(page.locator(".hcard").first(), "pick a hero")){
      await page.waitForSelector(".sheet");
      await screen("home: hero sheet");
      /* THE KEYWORDS A DECK USES (v6.60): the banner shows up to three, a tap opens the
         rule that defines one (full width, under the banner), a second tap folds it */
      { const chips = await page.locator(".hbanner .kwrow .kw").count();
        await click(page.locator(".hbanner .kwrow .kw").first(), "a keyword on the banner");
        await page.waitForTimeout(200);
        const d = await page.evaluate(() => { const e = document.querySelector(".kwdef"), b = document.querySelector(".hbanner");
          if(!e || !b) return null; const r = e.getBoundingClientRect(), q = b.getBoundingClientRect();
          return {t: e.innerText, below: r.top >= q.bottom - 1, w: Math.round(r.width), bw: Math.round(q.width)}; });
        await screen("home: a keyword's rule", d ? d.t.split("\n")[0] : "no rule shown");
        row(chips >= 1 && chips <= 3 && !!d && /COMPREHENSIVE RULES 8\.\d+\.\d+/i.test(d.t) && d.below && d.w >= d.bw - 2,
          "home: a keyword opens its rule under the banner, full width", JSON.stringify(d && {chips, below: d.below, w: d.w, bw: d.bw}));
        await click(page.locator(".hbanner .kwrow .kw").first(), "the keyword again");
        row(!(await has(".kwdef")), "home: a second tap folds the rule"); }
      if(await click(btn(/^View official/), "view the decklist")){ await page.waitForSelector(".sheet ~ *"); await screen("home: decklist");
        /* A ZOOMED CARD'S KEYWORDS (v6.60): the first card in the list that carries one shows
           it as a chip, and the chip opens the same rule as the banner's */
        let z = null;
        for(let i = 0, n = await page.locator(".cgrid .cc").count(); i < n && i < 30 && !z; i++){
          await page.locator(".cgrid .cc").nth(i).click();
          await page.waitForSelector(".modal");
          if(await page.locator(".modal .kw").count()){
            await page.locator(".modal .kw").first().click(); await page.waitForTimeout(150);
            z = await page.evaluate(() => { const d = document.querySelector(".modal .kwdef"), b = document.querySelector(".modal .inner");
              return {card: (document.querySelector(".modal .txt b") || {}).innerText, rule: d ? d.innerText.split("\n")[0] : null,
                      scrolls: b.scrollHeight <= b.clientHeight + 1 || getComputedStyle(b).overflowY === "auto"}; });
            await screen("home: a zoomed card's keyword rule");
          }
          await page.mouse.click(4, 4);   /* the backdrop closes the zoom */
          await page.waitForSelector(".modal", {state: "detached", timeout: 3000}).catch(() => {});
        }
        row(!!z && /COMPREHENSIVE RULES 8\.\d+\.\d+/i.test(z.rule || "") && z.scrolls, "home: a zoomed card's keyword opens its rule", JSON.stringify(z));
        await click(btn(/^Hide official/), "hide the decklist"); }
    }
    for(const [tab, label] of [["Judge", "judge tab"], ["Trophies", "trophies tab"]]){
      if(await click(page.locator("nav.tabs .tab", { hasText: tab }), label)) await screen(label);
    }
    await click(page.locator("nav.tabs .tab", { hasText: "Heroes" }), "back to heroes");

    /* find an opponent: the code screen (no peer network is reached) */
    if(await click(btn(/^Find an opponent/), "find an opponent")){
      await page.waitForSelector(".tblwrap"); await screen("table: find an opponent");
      /* the lobby's Back / Leave buttons were unstyled `.a` buttons, 16px tall
         (1.0 polish audit): every button on the screen is a real button */
      const lob = await page.evaluate(() => [...document.querySelectorAll(".tblwrap button")].filter(b => b.offsetParent)
        .map(b => ({ t: b.innerText.trim(), h: Math.round(b.getBoundingClientRect().height) })));
      row(lob.length > 0 && lob.every(b => b.h >= 40), "table: the lobby's buttons are thumb-sized", lob.map(b => `${b.t} ${b.h}px`).join(", "));
      await click(page.locator(".tblwrap button", { hasText: /back|leave|cancel/i }).first(), "leave the code screen");
    }

    /* JUDGE MODE (HIDDEN HANDS H3): this page as the judge's device. PeerJS is
       stubbed (no relay is reached); two fake channels sit down and negotiate
       the lobby with the page's own engine, and the judge's screen is checked
       at each stage: waiting, the lobby, the game dealt. */
    if(await click(btn(/^Find an opponent/), "find an opponent (judge)")){
      await page.waitForSelector(".tblwrap");
      /* v6.82: the honest lines live in one sheet, opened from the find screen (closed, the screen does not say it; open, it does) */
      const shut = await page.evaluate(() => /judge's device holds the deck/i.test(document.body.innerText));
      await click(page.locator('[data-testid="hands-open"]'), "open how each table keeps hands hidden");
      const honest = await page.evaluate(() => /judge's device holds the deck/i.test(document.body.innerText));
      row(!shut && honest, "table: the find screen's sheet says a judged table's deck is on the judge's device (one tap, not under the buttons)", "closed " + shut + ", open " + honest);
      await click(btn(/^Got it/), "close the sheet");
      await page.evaluate(() => { window.Peer = class { constructor(id){ this.h = {}; window.__jpeer = this; setTimeout(() => this.emit("open", id), 10); }
        on(e, f){ (this.h[e] = this.h[e] || []).push(f); } emit(e, ...a){ (this.h[e] || []).forEach(f => f(...a)); } destroy(){} connect(){ return null; } }; });
      if(await click(btn(/^Judge a table/), "judge a table")){
        await page.waitForSelector(".judgeroom", { timeout: 8000 });
        await screen("table: judge's device, waiting for players");
        await page.evaluate(() => {
          const mk = () => ({open: false, h: {}, got: [], on(e, f){ (this.h[e] = this.h[e] || []).push(f); }, emit(e, ...a){ (this.h[e] || []).forEach(f => f(...a)); },
            send(m){ this.got.push(JSON.parse(JSON.stringify(m))); }, close(){ this.open = false; this.emit("close"); }});
          const cs = window.__jc = [mk(), mk()];
          cs.forEach(c => { window.__jpeer.emit("connection", c); c.open = true; c.emit("open"); });
          const say = window.__jsay = (i, m) => cs[i].emit("data", {ch: "lobby", m});
          [0, 1].forEach(i => say(i, DawnLobby.hello(i, TABLE_BUILD)));
          say(0, DawnLobby.hero(0, "kayo"));
        });
        await screen("table: judge's device, the lobby");
        await page.evaluate(() => { const say = window.__jsay;
          say(1, DawnLobby.hero(1, "azalea"));
          const t0 = DawnLobby.throwSeal(0, 0, "paper"), t1 = DawnLobby.throwSeal(1, 0, "rock");
          say(0, t0.seal); say(1, t1.seal); say(0, t0.open); say(1, t1.open);
          say(0, DawnLobby.seating(0, "first")); say(0, DawnLobby.sideboard(0, [], {})); say(1, DawnLobby.sideboard(1, [], {}));
          [0, 1].forEach(i => say(i, DawnLobby.seedAnswer(undefined, i))); });
        await page.waitForFunction(() => /Turn \d/.test((document.querySelector(".judgeroom") || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
        await screen("table: judge's device, the game dealt");
        const j = await page.evaluate(() => { const t = (document.querySelector(".judgeroom") || {}).innerText || "";
          const seen = window.__jc.map(c => c.got.some(f => f.ch === "judge" && f.key));
          return {dealt: /Turn \d/.test(t), holds: /This device holds the deck/.test(t), keys: seen.every(Boolean)}; });
        row(j.dealt && j.holds && j.keys, "table: the judge's device seats two phones (each dealt a key), deals, and says it holds the deck", JSON.stringify(j));
        await click(page.locator(".judgeroom button", { hasText: /^Leave/ }).first(), "leave the judged table");
      }
      await page.evaluate(() => { delete window.Peer; try { Object.keys(localStorage).filter(k => /^dawnblade\.judge\./.test(k)).forEach(k => localStorage.removeItem(k)); } catch(_){} });
      if(await has(".tblwrap")) await click(page.locator(".tblwrap button", { hasText: /^Back$/ }).first(), "leave the code screen (judge)");
    }

    /* seat a game: roster -> battle -> coin -> loadout. Returns when the loadout is up. */
    const toLoadout = async (prefix, seat = 0) => {
      if(!(await has(".sheet")) && !(await click(page.locator(".hcard").first(), "pick a hero"))) return false;
      if(!(await click(btn(/^Battle$/), "battle"))) return false;
      await page.waitForSelector(".rps");
      /* THE COIN IS PERMANENT AGAINST THE AI (v6.01, RULING user 2026-11-07):
         the screen says so, and no longer calls itself a testing stopgap. */
      { const sub = await page.locator(".rps .rsub").innerText();
        row(/Against the AI a coin decides it/.test(sub) && /ranked ladder/.test(sub) && !/testing|launch/i.test(sub),
          prefix + ": the coin screen says the coin is how the AI game is seated", sub.replace(/\s+/g, " ")); }
      await screen(prefix + ": the coin");
      await page.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
      if(await has(".rseatpick")) await click(page.locator(".rseatpick button").nth(seat), seat ? "it goes first" : "I go first");
      await page.waitForSelector(".actbar", { timeout: 8000 });
      return true;
    };
    /* The action bar, plus any in-board prompt button whose whole label is a safe
       answer (the trainer asks for the arsenal in a sheet, not in the bar). A card
       tile's text carries its cost and stats, so it can never match SAFE. */
    const SAFE = /^(take it|end turn|pass|leave it empty|skip|done defending|decline|confirm)$/i;
    const handBar = () => page.evaluate(src => { const safe = new RegExp(src, "i");
      return [...document.querySelectorAll(".board button")].filter(b => b.offsetParent)
        .map(b => ({ t: b.innerText.replace(/\s+/g, " ").trim(), dis: b.disabled, bar: !!b.closest(".actbar") }))
        .filter(b => b.bar || safe.test(b.t)); }, SAFE.source);
    const names = bar => bar.map(b => b.t + (b.dis ? " (waiting)" : "")).join(" | ");
    const nav = async (prefix, names) => {
      for(const n of names)
        if(await click(page.locator(".screennav button", { hasText: n }).first(), prefix + " nav " + n)) await screen(prefix + ": " + n);
    };
    /* Play on: take the hit / end the turn / pass, up to 14 taps, measuring each
       NEW action bar once. The board must change under the taps (the engine, and
       at the table the AI seat, are running in the page), and it must stay in. */
    const PICKS = [/^take it$/i, /^end turn$/i, /^pass$/i, /^(leave it empty|skip|done defending|decline|confirm)$/i];
    /* THE PREVIEW CLEARS THE STATUS LINE'S CONTROLS (1.0 polish audit). Once
       per board, when the line over the hand holds a button ("skip" at the
       arsenal step, "✕ cancel" while paying), peek a hand card and ask what
       is topmost at each button's centre: the button, never the dock. */
    /* HIT AREAS (1.0 polish audit). The tall span, at the button's centre x,
       over which a tap lands on the button: JUDGE!! drew 18px and "skip" /
       "✕ cancel" 15px, each given an invisible ::after hit area. And on the
       board every visible control still takes the tap at its own centre, so a
       hit area never steals a neighbour's. */
    const hitSpan = async sel => {
      const pick = sel => [...document.querySelectorAll(sel)].find(x => { const r = x.getBoundingClientRect(); return x.offsetParent && r.height && r.bottom > 0 && r.top < innerHeight; });
      await page.evaluate(src => { window.__pickShown = new Function("sel", "return (" + src + ")(sel)"); }, pick.toString());
      const there = await page.evaluate(sel => { const b = window.__pickShown(sel);
        /* sideways only: the log pane sits left of the play pane, and a vertical
           scroll would move the button off its snapped resting place */
        for(let p = b && b.parentElement; p; p = p.parentElement) if(/auto|scroll/.test(getComputedStyle(p).overflowX)){
          const q = p.getBoundingClientRect(), r = b.getBoundingClientRect();
          if(r.left < q.left || r.right > q.right) p.scrollLeft += r.left - q.left - 8; }
        return !!b; }, sel);
      if(!there) return null;
      await page.waitForTimeout(600);
      return page.evaluate(sel => {
      const b = window.__pickShown(sel);
      if(!b) return null;
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, on = y => { const t = document.elementFromPoint(x, y); return !!t && b.contains(t); };
      let lo = r.top + r.height / 2, hi = lo;
      while(lo > 0 && on(lo - 1)) lo--;
      while(hi < innerHeight && on(hi + 1)) hi++;
      const what = y => { const t = document.elementFromPoint(x, y); return t ? (t.className || t.tagName) : "-"; };
      return { t: b.innerText.trim(), drawn: Math.round(r.height), hit: Math.round(hi - lo + 1),
               at: `x ${Math.round(x)} y ${Math.round(r.top)}; above: ${what(lo - 2)}, below: ${what(hi + 2)}` };
    }, sel); };
    const ownTaps = (scope = ".board") => page.evaluate(scope => [...document.querySelectorAll(scope + " button")].filter(b => {
      if(!b.offsetParent || b.closest(".peekwrap")) return false;
      const r = b.getBoundingClientRect(); if(!r.width || r.bottom < 0 || r.top > innerHeight) return false;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if(cx < 0 || cx > innerWidth) return false;
      for(let p = b.parentElement; p; p = p.parentElement){ const q = p.getBoundingClientRect(), o = getComputedStyle(p);
        if((o.overflowX !== "visible" || o.overflowY !== "visible") && (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom)) return false; }
      const t = document.elementFromPoint(cx, cy);
      return t && !b.contains(t) && !t.contains(b) && t.closest("button") && !t.closest(".peekwrap");
    }).map(b => b.innerText.replace(/\s+/g, " ").trim().slice(0, 24)), scope);
    const hitChecked = new Set();
    const hitCheck = async (prefix, sel, min) => {
      if(hitChecked.has(prefix + sel)) return;
      const h = await hitSpan(sel); if(!h) return;
      hitChecked.add(prefix + sel);
      const stolen = await ownTaps();
      row(h.hit >= min && !stolen.length, `${prefix}: ${h.t} hit area`, `drawn ${h.drawn}px, takes taps over ${h.hit}px (want >= ${min})` + (h.hit < min ? "  " + h.at : "") + (stolen.length ? "  STOLEN: " + stolen.join(", ") : ""));
    };
    /* DECISION B (CEO, 2026-11-02): the jump row (drawn 25px) and the advisor
       header (drawn 26px) take taps over 44px, through invisible hit areas,
       with NO layout change: every jump-row button must still DRAW at most
       30px (one line), the header at most 30px, and no control in `scope`
       may lose the tap at its own centre. The advisor is measured open and
       closed (closed, its box is 28px tall: the hit area must reach past it). */
    const jumpHits = async (prefix, scope) => {
      const spans = [];
      for(let i = 0; i < 4; i++){
        const sel = `.screennav button:nth-child(${i + 1})`, h = await hitSpan(sel);
        if(h) spans.push(h);
      }
      const stolen = await ownTaps(scope);
      row(spans.length === 4 && spans.every(h => h.hit >= 44 && h.drawn <= 30) && !stolen.length, `${prefix}: the jump row's hit areas`,
        spans.map(h => `${h.t} drawn ${h.drawn} hit ${h.hit}` + (h.hit < 44 ? " (" + h.at + ")" : "")).join(", ") + (stolen.length ? "  STOLEN: " + stolen.join(", ") : ""));
    };
    const advHits = async prefix => {
      const out = [];
      for(const state of ["open", "closed"]){
        const h = await hitSpan(".advhead"); if(!h){ out.push(state + ": no header"); break; }
        const stolen = await ownTaps();
        out.push({ state, ok: h.hit >= 44 && h.drawn <= 30 && !stolen.length,
                   say: `${state} drawn ${h.drawn} hit ${h.hit}` + (h.hit < 44 ? " (" + h.at + ")" : "") + (stolen.length ? " STOLEN: " + stolen.join(", ") : "") });
        await page.locator(".advhead:visible").first().click();   // open -> closed -> open again (the choice is stored)
        await page.waitForTimeout(250);
      }
      row(out.length === 2 && out.every(o => o.ok), `${prefix}: the advisor header's hit area`, out.map(o => o.say || o).join("; "));
    };
    const peekChecked = new Set();
    const peekClear = async prefix => {
      if(peekChecked.has(prefix)) return;
      const ctl = page.locator(".board .statusline button:visible");
      const card = page.locator(".board .phand .hc:not(.dis):visible").first();
      if(!(await ctl.count()) || !(await card.count())) return;
      peekChecked.add(prefix);
      await card.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(350);
      const hit = await page.evaluate(() => [...document.querySelectorAll(".board .statusline button")].filter(b => b.offsetParent).map(b => {
        const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { t: b.innerText.trim(), y: Math.round(r.top), ok: !!top && (b.contains(top) || top.contains(b)), over: top ? top.className || top.tagName : "-" };
      }));
      const peeked = await page.locator(".peekwrap").isVisible().catch(() => false);
      const bad = hit.filter(h => !h.ok);
      row(peeked && !bad.length, prefix + ": the preview clears the status line",
        peeked ? hit.map(h => `${h.t}@${h.y}` + (h.ok ? "" : " UNDER " + h.over)).join(", ") : "no preview opened");
      await page.locator(".peekwrap").click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); });
      await page.waitForTimeout(250);
    };
    /* THE PEEK NAMES A CARD'S KEYWORDS AND THE LINE TAKES NO TAP (v6.63): peek hand
       cards until one carries a keyword; its line must sit inside the screen, above the
       rail, and a tap ON it must close the preview (the dock is one tap-to-close surface). */
    const peekKw = async prefix => {
      const cards = page.locator(".board .phand .hc:visible");
      const n = await cards.count(), seen = [];
      let got = null;
      for(let i = 0; i < n && !got; i++){
        await cards.nth(i).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const w = document.querySelector(".peekwrap"), k = w && w.querySelector(".pkkw");
          if(!w) return null;
          const nm = w.querySelector(".pknm").innerText;
          if(!k) return { nm };
          const b = k.getBoundingClientRect(), rail = document.querySelector(".board .phand").getBoundingClientRect();
          const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { nm, kw: k.innerText, inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= rail.top,
                   plain: !!top && !!top.closest(".peekwrap") && !top.closest("button,a,[role=button]") };
        });
        if(r && r.kw){
          await page.locator(".peekwrap .pkkw").click().catch(() => {});
          await page.waitForTimeout(250);
          r.closed = !(await page.locator(".peekwrap").count());
          got = r;
        } else if(r){ seen.push(r.nm); }
        await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); });
        await page.waitForTimeout(200);
      }
      row(!!got && got.inside && got.plain && got.closed, prefix + ": a peeked card names its keywords, and a tap on them closes the peek",
        got ? `${got.nm}: "${got.kw}" inside ${got.inside} plain ${got.plain} closed ${got.closed}` : "no keyworded card in hand: " + seen.join(", "));
    };
    const playOn = async prefix => {
      const sigs = new Set(), board = () => page.locator(".board").innerText();
      let moved = 0, taps = 0;
      for(let i = 0; i < 14; i++){
        await hitCheck(prefix, ".board .statusline button", 30);
        await peekClear(prefix);
        /* a disabled bar is the other seat thinking: wait it out (6s), never tap it */
        let bar, pick;
        for(let w = 0; w < 20; w++){
          bar = await handBar();
          pick = PICKS.map(re => bar.find(b => !b.dis && re.test(b.t))).find(Boolean);
          if(pick || !bar.some(b => b.dis)) break;
          await page.waitForTimeout(300);
        }
        const sig = names(bar);
        if(!sigs.has(sig)){ sigs.add(sig); await screen(prefix + ": " + (sig || "(no actions)")); }
        if(!pick) break;
        const before = await board();
        const label = new RegExp("^\\s*" + pick.t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i");
        if(!(await click(page.locator(".board button:not([disabled])").filter({ hasText: label }).first(), prefix + " tap " + pick.t))) break;
        taps++; await page.waitForTimeout(900);
        if((await board()) !== before) moved++;
      }
      row(moved > 0, prefix + ": plays on", `${moved}/${taps} taps changed the board`);
    };

    /* ---- the trainer ---- */
    if(await toLoadout("trainer")){
      await screen("trainer: loadout");
      await jumpHits("trainer: loadout", ".lo");
      if(await click(page.locator('.lo .actbar [data-start="trainer"]'), "Fight")){
        await page.waitForSelector(".board", { timeout: 8000 });
        await screen("trainer: board", "actions: " + names(await handBar()));
        await jumpHits("trainer", ".board");
        await nav("trainer", ["Chain"]);
        /* the first game points at the call (v6.59): a phone that has never seen it reads one
           line saying what the box is for, inside the screen, until both seats have had a turn */
        /* measured against its own box: the log pane may sit beside the screen in the pane row */
        { const nb = await page.evaluate(() => { const n = document.querySelector(".advnew"), a = n && n.closest(".adv");
            if(!n || !a) return null; const r = n.getBoundingClientRect(), q = a.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= q.left && r.right <= q.right, sw: n.scrollWidth <= n.clientWidth}; });
          row(!!nb && nb.inside && nb.sw && nb.w <= W && nb.h > 0, "trainer: a new phone's first game says what the call is for",
            nb ? `${nb.w}x${nb.h}px, inside its box ${nb.inside}` : "no line"); }
        await hitCheck("trainer", ".board .judgebtn", 40); await advHits("trainer");
        await nav("trainer", ["You", "Opp"]);
        await peekKw("trainer");
        await playOn("trainer");
        await click(page.locator(".screennav button", { hasText: "leave" }), "leave the trainer");
        await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
      }
    }

    /* ---- the trainer: the PLAYER blocks (1.0 polish audit) ----
       The walk above only ever takes the hit. The first block with a card
       and "Resolve damage" threw (`_EFX.defendValue` was undefined) and
       blanked the page. Hand the dummy the first turn, defend with the first
       card the rail offers, and play the step out. */
    if(await toLoadout("block", 1)){
      if(await click(page.locator('.lo .actbar [data-start="trainer"]'), "block: Fight")){
        await page.waitForSelector(".board", { timeout: 8000 });
        let bar = "";
        for(let i = 0; i < 20 && !/take it/i.test(bar); i++){
          bar = (await page.locator(".board .actbar").innerText().catch(() => "")).replace(/\s+/g, " ");
          if(/take it/i.test(bar)) break;
          const go = page.locator(".board .actbar button:not([disabled])", { hasText: /end turn|pass/i }).first();
          if(await go.count()) await go.click().catch(() => {});
          await page.waitForTimeout(600);
        }
        const card = page.locator(".board .phand .hc:not(.dis)").first();
        const hp0 = await page.locator(".board").innerText();
        await card.click().catch(() => {}); await page.waitForTimeout(250); await card.click().catch(() => {}); await page.waitForTimeout(350);
        const steps = [];
        for(let k = 0; k < 4; k++){
          const b = page.locator(".board .actbar button:not([disabled])", { hasText: /defend\s*→|resolve|pass|done/i }).first();
          if(!(await b.count())) break;
          steps.push((await b.innerText()).replace(/\s+/g, " ").trim()); await b.click().catch(() => {}); await page.waitForTimeout(700);
          if(/resolve/i.test(steps[steps.length - 1])) break;
        }
        const alive = await page.locator(".board").isVisible().catch(() => false);
        row(alive && steps.some(t => /resolve/i.test(t)) && hp0 !== "", "trainer: the player blocks and the damage resolves",
          `incoming bar ${JSON.stringify(bar)}; tapped ${steps.join(" > ") || "(nothing)"}; board ${alive ? "still up" : "GONE"}`);
        await screen("trainer: after a block");
        await click(page.locator(".screennav button", { hasText: "leave" }), "leave the trainer");
        await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
      }
    }

    /* ---- the table against an AI-piloted hero ---- */
    if(await toLoadout("table")){
      const foeBtn = page.locator(".aifoe button").nth(2);   // 0 = the Dummy, 1 = Random, 2 = first hero
      const foeName = (await foeBtn.getAttribute("aria-label")) || "", first = foeName.split(",")[0];
      if(await click(foeBtn, "pick an AI hero")){
        await screen("table: loadout, AI foe picked", foeName);
        /* SHARP / STEADY (lookahead phase 2): two tiles under the picker, Sharp
           on by default, both inside the phone's width and a thumb tall, and a
           tap moves the choice. Left on Sharp, which the board must then report. */
        const lv = page.locator(".ailevel button");
        const boxes = await lv.evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect();
          return {t: b.innerText.split("\n")[0].trim(), on: b.classList.contains("on"), l: r.left, r: r.right, h: r.height}; }));
        row(boxes.length === 2 && /sharp/i.test(boxes[0].t) && /steady/i.test(boxes[1].t) && boxes[0].on && !boxes[1].on
            && boxes.every(x => x.l >= 0 && x.r <= W && x.h >= 44),
            "table: Sharp / Steady", JSON.stringify(boxes.map(x => [x.t, x.on, Math.round(x.l), Math.round(x.r), Math.round(x.h)])));
        /* THE TILES CAN BE REACHED (v5.83). They sat 647..713 against a bar
           starting at 683, cut by their own screen's clipped bottom: the picker
           shared the deck screen and `.hpane`'s 100% basis made it a whole
           screen tall. Jump to the Foe screen, scroll its pane to the end (what
           a thumb can do), and every tile must sit inside the screen, above the
           bar, and take a tap at its centre. The deck screen's trim grid must
           keep real height (it was crushed to 15px of padding). */
        const reach = await page.evaluate(async () => {
          const jump = [...document.querySelectorAll(".lo .screennav button")].find(b => /foe/i.test(b.innerText));
          if(!jump) return {err: "no Foe jump"};
          jump.click(); await new Promise(r => setTimeout(r, 700));
          const t0 = document.querySelector(".ailevel"); const pane = t0 && t0.closest(".hpane"), scr = t0 && t0.closest(".vscreen");
          if(!pane) return {err: "no level tiles"};
          pane.scrollTop = pane.scrollHeight; await new Promise(r => setTimeout(r, 300));
          const bar = document.querySelector(".lo .actbar").getBoundingClientRect(), sr = scr.getBoundingClientRect();
          const tiles = [...document.querySelectorAll(".ailevel button")].map(b => { const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {t: b.innerText.split("\n")[0].trim(), top: Math.round(r.top), bot: Math.round(r.bottom), hit: !!hit && b.contains(hit)}; });
          const cut = document.querySelector(".cutgrid").closest(".hpane").getBoundingClientRect().height;
          return {tiles, bar: Math.round(bar.top), scr: [Math.round(sr.top), Math.round(sr.bottom)], cut: Math.round(cut)};
        });
        row(!reach.err && reach.tiles.length === 2 && reach.tiles.every(x => x.hit && x.top >= reach.scr[0] && x.bot <= reach.scr[1] && x.bot <= reach.bar)
            && reach.cut >= 200, "table: Sharp / Steady clear the bar",
            reach.err || `tiles ${reach.tiles.map(x => `${x.t} ${x.top}..${x.bot}${x.hit ? "" : " (tap lands elsewhere)"}`).join(", ")}; screen ${reach.scr.join("..")}; bar ${reach.bar}; trim grid ${reach.cut}px`);
        if(boxes.length === 2){
          await lv.nth(1).click(); const st = await lv.evaluateAll(bs => bs.map(b => b.classList.contains("on")));
          await lv.nth(0).click(); const sh = await lv.evaluateAll(bs => bs.map(b => b.classList.contains("on")));
          row(!st[0] && st[1] && sh[0] && !sh[1], "table: the level follows the tap", `steady ${st} · sharp ${sh}`);
        }
        if(await click(page.locator('.lo .actbar [data-start="table"]'), "Fight at the table")){
          await page.waitForSelector(".board", { timeout: 15000 });
          /* the top nav names the foe hero only on the table board (the trainer says "Opp") */
          const top = (await page.locator(".screennav").innerText()).replace(/\s+/g, " ");
          row(top.toLowerCase().includes(first.toLowerCase()), "table board is the AI table", `top nav ${JSON.stringify(top)} names ${first}`);
          const lvl = await page.evaluate(() => window.__dawnTable && window.__dawnTable.report().sharp);
          row(lvl === true, "table: the AI seat plays Sharp", "report().sharp " + lvl);
          await screen("table: board", "actions: " + names(await handBar()));
          /* A CROWDED BAR STAYS ON SCREEN (1.0 polish audit). A cost picker
             lays one button per card in the row (Boltyn's soul: the last
             button at x 348..410). Lay seven long-named buttons in the live
             bar for one measurement, then take them out again. On screen, and
             no button taller than three lines of the bar's 16px type (96px). */
          const crowd = await page.evaluate(() => {
            const bar = document.querySelector(".board .actbar") || document.querySelector(".actbar");
            if(!bar) return null;
            const made = [];
            for(let k = 0; k < 7; k++){ const b = document.createElement("button"); b.className = "a go"; b.textContent = "Banish Light the Way (" + k + ")"; bar.appendChild(b); made.push(b); }
            const boxes = [...bar.querySelectorAll(":scope > .a")].map(b => b.getBoundingClientRect());
            made.forEach(b => b.remove());
            return { n: boxes.length, right: Math.round(Math.max(...boxes.map(r => r.right))), left: Math.round(Math.min(...boxes.map(r => r.left))),
                     tall: Math.round(Math.max(...boxes.map(r => r.height))), top: Math.round(Math.min(...boxes.map(r => r.top))) };
          });
          row(!!crowd && crowd.right <= W && crowd.left >= 0 && crowd.tall <= 96 && crowd.top >= 0, "table: a crowded action bar stays on screen",
            crowd ? `${crowd.n} buttons span x ${crowd.left}..${crowd.right}, tallest ${crowd.tall}px, top ${crowd.top}` : "no action bar");
          await jumpHits("table", ".board");
          await nav("table", ["Chain"]);
          /* once the first game has gone past both seats' turns, the line is stored as seen and never shows again */
          { const seen = await page.evaluate(() => localStorage.getItem("dawnblade.coachSeen"));
            const shown = await has(".advnew");
            row(seen === "true" ? !shown : true, "table: the call's newcomer line is gone once seen", `seen ${seen}, shown ${shown}`); }
          await hitCheck("table", ".board .judgebtn", 40); await advHits("table");
          await nav("table", ["You", first]);
          await playOn("table");
          await click(page.locator(".screennav button", { hasText: "leave" }), "leave the table");
        }
      }
    }

    /* ---- game over at the table ----
       Three endings, each reached in one move: the AI seat concedes (a WIN),
       you concede (a LOSS). A win over an AI HERO is not a win over the
       dummy: it must not read "DUMMY DESTROYED" nor write the dummy's best
       score (v5.74 did both). A win over the Dummy at the table still does. */
    const ending = async (foeIdx, who, want, label) => {
      if(!(await toLoadout("over"))) return;
      const foeBtn = typeof foeIdx === "string" ? page.locator(`.aifoe button[aria-label^="${foeIdx}"]`).first() : page.locator(".aifoe button").nth(foeIdx);
      const foe = ((await foeBtn.getAttribute("aria-label")) || "").split(",")[0];
      if(!(await click(foeBtn, label + ": pick " + foe))) return;
      const best0 = await page.evaluate(() => { localStorage.removeItem("dawnblade.best"); return null; });
      const rec0 = await page.evaluate(() => JSON.parse(localStorage.getItem("dawnblade.aiRecord") || "null"));
      if(who === 1) await page.evaluate(() => {   // the AI seat's next move is to concede
        const act = DawnSparring.act; DawnSparring.act = (st, i) => i === 1 ? { t: "concede" } : act(st, i);
        window.__restoreAct = () => { DawnSparring.act = act; };
      });
      if(!(await click(page.locator('.lo .actbar [data-start="table"]'), label + ": fight"))) return;
      await page.waitForSelector(".board", { timeout: 15000 });
      /* the jump row stays one line with the longest foe name in the pool
         ("▲ LYATH GOLDMANE" wrapped and grew the row, 1.0 polish audit) */
      if(want.navOneLine){
        const nav = await page.evaluate(() => [...document.querySelectorAll(".screennav button")].map(b => ({ t: b.innerText.trim(), h: Math.round(b.getBoundingClientRect().height) })));
        /* one line of 9px type is 25px tall (the trainer's row); a wrap makes the WHOLE row 36 */
        row(nav.length && nav.every(b => b.h <= 30), label + ": the jump row is one line", nav.map(b => `${b.t} ${b.h}px`).join(", "));
      }
      const foeKey = await page.evaluate(() => window.__dawnTable.session.state().sides[1].heroKey || null);
      if(who === 0) await page.evaluate(() => window.__dawnTable.session.submit({ t: "concede" }));
      const shown = await page.waitForSelector(".reveal", { timeout: 15000 }).then(() => page.locator(".reveal").innerText()).catch(() => "");
      await page.evaluate(() => window.__restoreAct && window.__restoreAct());
      const best1 = await page.evaluate(() => localStorage.getItem("dawnblade.best"));
      const head = shown.split("\n")[0].trim();
      const ok = want.head.test(head) && (want.records ? best1 !== best0 : best1 === best0);
      row(ok, label, `vs ${foe}: ${JSON.stringify(head)}` + (want.records ? "" : best1 === best0 ? ", best score untouched" : ", WROTE THE BEST SCORE"));
      /* THE RECORD (v5.84): a finished game against an AI hero moves exactly
         one counter, that hero's at the level it played (Sharp, as left by
         the Sharp / Steady row); a game against the Dummy moves none. */
      const rec1 = await page.evaluate(() => JSON.parse(localStorage.getItem("dawnblade.aiRecord") || "null"));
      const flat = r => { const o = {}; for(const [k, f] of Object.entries((r && r.foes) || {})) for(const [lv, c] of Object.entries(f)) for(const x of ["w", "l", "d"]) o[k + "/" + lv + "/" + x] = c[x]; return o; };
      const f0 = flat(rec0), f1 = flat(rec1);
      const moved = [...new Set([...Object.keys(f0), ...Object.keys(f1)])].filter(k => (f1[k] || 0) !== (f0[k] || 0)).map(k => k + " " + ((f1[k] || 0) - (f0[k] || 0) > 0 ? "+" : "") + ((f1[k] || 0) - (f0[k] || 0)));
      const wantMoved = want.rec ? [foeKey + "/sharp/" + want.rec + " +1"] : [];
      row(JSON.stringify(moved) === JSON.stringify(wantMoved), label + ": the record",
          `moved ${JSON.stringify(moved)}, want ${JSON.stringify(wantMoved)}`);
      await screen(label + " screen");
      await page.locator(".reveal").click().catch(() => {});
      await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
    };
    await page.evaluate(() => localStorage.removeItem("dawnblade.aiRecord"));
    await ending("Lyath", 1, { head: /^you take it$/i, records: false, navOneLine: true, rec: "w" }, "table: win over an AI hero");
    await ending(3, 0, { head: /^they take it$/i, records: false, rec: "l" }, "table: loss to an AI hero");
    await ending(0, 1, { head: /^dummy destroyed$/i, records: true }, "table: win over the Dummy");

    /* THE RECORD ON THE PICKER (v5.84). After the win and the concession
       above, at Sharp: Lyath's tile reads 1–0 and the other foe's 0–1, every
       other tile reads nothing; each label sits inside its tile, inside the
       phone, on one line. At Steady (no games played there) no label shows. */
    if(await toLoadout("record")){
      const labels = () => page.evaluate(() => [...document.querySelectorAll(".aifoe button")].map(b => {
        const f = b.querySelector(".frec"); if(!f) return null;
        const r = f.getBoundingClientRect(), t = b.getBoundingClientRect();
        return { foe: (b.getAttribute("aria-label") || "").split(",")[0], t: f.innerText.trim(), l: r.left, r: r.right, h: r.height,
                 inTile: r.left >= t.left - 0.5 && r.right <= t.right + 0.5 && r.top >= t.top - 0.5 && r.bottom <= t.bottom + 0.5,
                 fits: f.scrollWidth <= f.clientWidth + 1 };
      }).filter(Boolean));
      const sharp = await labels();
      const okS = sharp.length === 2 && sharp.some(x => /^lyath/i.test(x.foe) && x.t === "1–0") && sharp.some(x => !/^lyath/i.test(x.foe) && x.t === "0–1")
        && sharp.every(x => x.inTile && x.fits && x.l >= 0 && x.r <= W && x.h > 0 && x.h <= 14);
      row(okS, "table: the record on the picker", JSON.stringify(sharp.map(x => [x.foe, x.t, Math.round(x.l), Math.round(x.r), Math.round(x.h), x.inTile, x.fits])));
      await screen("table: the picker with a record");
      const lv = page.locator(".ailevel button");
      await click(page.locator(".aifoe button").nth(2), "pick an AI hero to show the level");
      const tapped = await click(lv.nth(1), "Steady"); await page.waitForTimeout(150); const steady = await labels();
      const note = await page.locator(".frecnote").count();
      await lv.nth(0).click().catch(() => {});
      row(tapped && steady.length === 0 && note === 0, "table: the record follows the level", `at Steady ${steady.length} labels, ${note} notes`);
      await click(page.locator(".lo .screennav button", { hasText: "back" }), "leave the record loadout");
      await page.locator(".rps .rback").click().catch(() => {});
      await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
    }

    /* NO STORAGE AT ALL (v5.84). A private window or blocked site data makes
       reading window.localStorage THROW. The page must still render the
       picker, play a game against an AI hero to its end, and raise nothing. */
    {
      const k2 = await open({ w: W, h: H });
      await k2.page.context().addInitScript(() => {
        Object.defineProperty(window, "localStorage", { configurable: true, get(){ throw new DOMException("blocked", "SecurityError"); } }); });
      await k2.page.reload(); await k2.page.waitForSelector(".hgrid", { timeout: 15000 }).catch(() => {});
      const p2 = k2.page; let got = "";
      try {
        await p2.locator(".hcard").first().click(); await p2.getByRole("button", { name: /^Battle$/ }).click();
        await p2.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
        if(await p2.locator(".rseatpick").isVisible().catch(() => false)) await p2.locator(".rseatpick button").first().click();
        await p2.waitForSelector(".lo .actbar", { timeout: 8000 });
        const tiles = await p2.locator(".aifoe button").count(), recs = await p2.locator(".aifoe .frec").count();
        await p2.locator(".aifoe button").nth(2).click();
        await p2.locator('.lo .actbar [data-start="table"]').click();
        await p2.waitForSelector(".board", { timeout: 15000 });
        await p2.evaluate(() => window.__dawnTable.session.submit({ t: "concede" }));
        const head = await p2.waitForSelector(".reveal", { timeout: 15000 }).then(() => p2.locator(".reveal h2").innerText()).catch(() => "(no reveal)");
        got = `${tiles} tiles, ${recs} records, ended ${JSON.stringify(head)}`;
        const thrown = await p2.evaluate(() => { try { void window.localStorage; return false; } catch(e){ return true; } });
        row(tiles >= 3 && recs === 0 && /they take it/i.test(head) && thrown && !k2.errors.length, "table: no storage, the record stays out of the way",
            got + (thrown ? "" : " (storage did NOT throw: the fixture is wrong)") + (k2.errors.length ? " errors: " + k2.errors.join(" | ") : ", 0 page errors"));
      } catch(e){ row(false, "table: no storage, the record stays out of the way", got + " " + String(e.message).split("\n")[0] + " " + k2.errors.join(" | ")); }
      await k2.close();
    }

    /* THE TAP FLOOR (M; POLISH.md condition 1): every control on every screen takes a 44px tap, nothing stolen,
       clipped or overlapped, at the phone it is played on (393x852) AND the smallest one (320x568). tools/tapsweep.js
       walks the screens, tools/tapjudge.js judges each; a fresh page per size so the walk starts at the roster. */
    for(const [tw, th] of [[W, H], [320, 568]]){
      const tk = await open({ w: tw, h: th });
      try { await require("./tapsweep.js").sweepScreens(tk.page, row, { w: tw, h: th }); }
      catch(e){ row(false, `tap floor ${tw}x${th}: the sweep ran to the end`, String(e && e.message || e).split("\n")[0]); }
      tk.errors.forEach(e => errors.push(`tap floor ${tw}x${th}: ${e}`));
      await tk.close();
    }

    /* READABILITY (U; tools/contrast.js): the tap sweep above carries one `readability` row per screen (WCAG AA against the
       real composited background, both phones). This row SABOTAGES the roster's text colour with the line colour and the
       measure must find it, so a measure gone blind fails here instead of passing every screen. */
    {
      const { judgeText } = require("./contrast.js");
      const rk = await open({ w: 320, h: 568 });
      try {
        const clean = await judgeText(rk.page);
        await rk.page.addStyleTag({ content: ".shell *{color:#4A3B2E !important}" });
        const sab = await judgeText(rk.page);
        row(clean.n > 0 && clean.fails.length === 0 && sab.fails.length >= 5, "readability: the measure finds a sabotaged colour (clean roster 0, sabotaged >= 5)", `clean ${clean.fails.length}, sabotaged ${sab.fails.length}`);
      } catch(e){ row(false, "readability: the measure finds a sabotaged colour", String(e && e.message || e).split("\n")[0]); }
      await rk.close();
    }

    /* EVERY PROMPT KIND, PUT ON THE BOARD (R; tools/promptsweep.js --inject): a real table game, then a real prompts.js spec of each
       kind (the longest realistic list) opened through judge.openPrompt, judged by tapjudge + the sheet checks at the smallest phone,
       and the same sheet with its CSS sabotaged, which must be found. All heroes: `node tools/promptsweep.js --inject`. */
    {
      const ik = await open({ w: 320, h: 568 });
      try { await require("./promptsweep.js").injectDrill(ik.page, row, { w: 320, h: 568 }); }
      catch(e){ row(false, "inject 320x568: the drill ran to the end", String(e && e.message || e).split("\n")[0]); }
      ik.errors.forEach(e => errors.push(`inject 320x568: ${e}`));
      await ik.close();
    }

    const sw = errors.slice();
    if(sw.length){ console.log("\nPAGE ERRORS (" + sw.length + "):"); sw.forEach(e => console.log("  " + e)); }
    const bad = rows.filter(r => !r.ok).length;
    console.log(`\n${bad || sw.length ? "FAIL" : "PASS"}  ${rows.length - bad}/${rows.length} screens clean, ${sw.length} page error(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await kit.close();
    process.exit(bad || sw.length ? 1 : 0);
  })().catch(e => { console.log("FAIL  " + (e && e.stack || e)); process.exit(1); });
}
