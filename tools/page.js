#!/usr/bin/env node
/* ============================================================
   THE PAGE, OFFLINE — the REAL index.html in headless Chromium at phone
   size, with every external request answered from local files.

   CLAUDE.md says a UI change is checked by driving the real page at
   393x852 and asserting on element boxes. A sandbox whose egress proxy
   blocks the CDNs cannot do that: React, Babel, the fonts, the card
   database and the card art all come from other people's servers, and a
   blank page reports as a blank page, not as an error. This file answers
   those requests with `page.route` instead of rewriting the page, so what
   is driven is index.html and engine/*.js byte for byte, loaded from
   file:// the way a phone opens it. (tools/phone/serve.sh is the older
   route: it serves a SUBSTITUTED copy over http and downloads the card
   database. Use whichever the machine allows.)

   WHAT IS ROUTED
     cdnjs react / react-dom / babel-standalone   npm react, react-dom, @babel/standalone
     unpkg peerjs (loaded lazily by engine/room.js) npm peerjs
     fonts.googleapis.com css2                    generated @font-face over @fontsource files
     fonts.gstatic.com                            the @fontsource woff2 files
     raw.githubusercontent.com card.json          the pinned pool (test/helpers/extract.js cardDbPath())
     any image or font from any other host        a 5:7 grey PNG / an empty 200
   Anything ELSE that leaves the page is answered 404 and recorded as an
   error, so a new external dependency fails the smoke check by name
   instead of by a blank screen. CDN versions are read from the URL the
   page asks for and compared with the installed package: if index.html
   moves to a version the deps directory does not hold, that is an error
   too (it would be testing a different React than the phone runs).

   DEPS (outside the repo, which keeps ZERO dependencies)
     npm install --prefix "$PAGE_DEPS" --save-exact react@18.2.0 \
       react-dom@18.2.0 @babel/standalone@7.23.5 peerjs@1.5.4 \
       @fontsource/big-shoulders-display @fontsource/spline-sans \
       @fontsource/spline-sans-mono
   The fonts are optional: without them the CSS is empty and the page
   falls back to system fonts, so widths are only approximate. The
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
  const db = require(path.join(ROOT, "test", "helpers", "extract.js")).cardDbPath();
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
    if(h === "unpkg.com" && (m = u.pathname.match(/^\/([^@/]+)@([\d.]+)\/(.+)$/))) return pkgFile(m[1], m[2], m[3]);
    if(h === "cdn.jsdelivr.net" && (m = u.pathname.match(/^\/npm\/([^@/]+)@([\d.]+)\/(.+)$/))) return pkgFile(m[1], m[2], m[3]);
    if(h === "fonts.googleapis.com") return fontCss(url);
    if(h === "fonts.gstatic.com"){
      const file = path.basename(u.pathname), slug = file.replace(/-latin-.*$/, "");
      const meta = Object.values(FONT_FAMILIES).find(x => x[1] === slug);
      const f = meta && nm(meta[0], "files", file);
      return f && fs.existsSync(f) ? ok("font/woff2", read(f)) : ok("font/woff2", Buffer.alloc(0));
    }
    if(h === "raw.githubusercontent.com" && /card\.json$/.test(u.pathname)) return ok("application/json", read(db));
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
async function open({ w = 393, h = 852, deps = depsDir() } = {}){
  const { chromium } = needPlaywright();
  const answer = makeAnswer(deps);
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
    await page.goto(pathToFileURL(INDEX).href);
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
  return { page, browser, context, errors, routed, check, close };
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
    const row = (ok, name, detail) => { rows.push({ ok, name }); console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); };

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
      const ok = m.sw <= W && !fresh;
      row(ok, name, `scrollWidth ${m.sw}/${W}` + (m.sw > W && m.bad.length ? "  overflow: " + m.bad.join("; ") : "") +
                    (fresh ? "  new errors: " + fresh : "") + (extra ? "  " + extra : ""));
    };
    const click = async (loc, what) => { try { await loc.click({ timeout: 4000 }); return true; } catch(e){ row(false, what, "not clickable: " + String(e.message).split("\n")[0]); return false; } };
    const has = sel => page.locator(sel).first().isVisible().catch(() => false);
    const btn = (re) => page.getByRole("button", { name: re });

    console.log(`dawnblade v${ver} at ${W}x${H}, offline (routed hosts: ${Object.entries(routed).map(([k, v]) => k + "x" + v).join(", ")})`);
    await screen("home: roster");

    /* the heroes: the first pick leads the whole walk */
    if(await click(page.locator(".hcard").first(), "pick a hero")){
      await page.waitForSelector(".sheet");
      await screen("home: hero sheet");
      if(await click(btn(/^View official/), "view the decklist")){ await page.waitForSelector(".sheet ~ *"); await screen("home: decklist"); await click(btn(/^Hide official/), "hide the decklist"); }
    }
    for(const [tab, label] of [["Judge", "judge tab"], ["Trophies", "trophies tab"]]){
      if(await click(page.locator("nav.tabs .tab", { hasText: tab }), label)) await screen(label);
    }
    await click(page.locator("nav.tabs .tab", { hasText: "Heroes" }), "back to heroes");

    /* find an opponent: the code screen (no peer network is reached) */
    if(await click(btn(/^Find an opponent/), "find an opponent")){
      await page.waitForSelector(".tblwrap"); await screen("table: find an opponent");
      await click(page.locator(".tblwrap button", { hasText: /back|leave|cancel/i }).first(), "leave the code screen");
    }

    /* seat a game: roster -> battle -> coin -> loadout. Returns when the loadout is up. */
    const toLoadout = async prefix => {
      if(!(await has(".sheet")) && !(await click(page.locator(".hcard").first(), "pick a hero"))) return false;
      if(!(await click(btn(/^Battle$/), "battle"))) return false;
      await page.waitForSelector(".rps");
      await screen(prefix + ": the coin");
      await page.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
      if(await has(".rseatpick")) await click(page.locator(".rseatpick .go"), "I go first");
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
    const playOn = async prefix => {
      const sigs = new Set(), board = () => page.locator(".board").innerText();
      let moved = 0, taps = 0;
      for(let i = 0; i < 14; i++){
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
      if(await click(page.locator(".actbar .battlebtn"), "Fight")){
        await page.waitForSelector(".board", { timeout: 8000 });
        await screen("trainer: board", "actions: " + names(await handBar()));
        await nav("trainer", ["Chain", "You", "Opp"]);
        await playOn("trainer");
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
        if(await click(btn(/^Fight the new engine/), "Fight the new engine")){
          await page.waitForSelector(".board", { timeout: 15000 });
          /* the top nav names the foe hero only on the table board (the trainer says "Opp") */
          const top = (await page.locator(".screennav").innerText()).replace(/\s+/g, " ");
          row(top.toLowerCase().includes(first.toLowerCase()), "table board is the AI table", `top nav ${JSON.stringify(top)} names ${first}`);
          await screen("table: board", "actions: " + names(await handBar()));
          await nav("table", ["Chain", "You", first]);
          await playOn("table");
          await click(page.locator(".screennav button", { hasText: "leave" }), "leave the table");
        }
      }
    }

    const sw = errors.slice();
    if(sw.length){ console.log("\nPAGE ERRORS (" + sw.length + "):"); sw.forEach(e => console.log("  " + e)); }
    const bad = rows.filter(r => !r.ok).length;
    console.log(`\n${bad || sw.length ? "FAIL" : "PASS"}  ${rows.length - bad}/${rows.length} screens clean, ${sw.length} page error(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await kit.close();
    process.exit(bad || sw.length ? 1 : 0);
  })().catch(e => { console.log("FAIL  " + (e && e.stack || e)); process.exit(1); });
}
