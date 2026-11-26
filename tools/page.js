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
       @fontsource/spline-sans-mono @fontsource/caveat
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
  "Caveat":                ["@fontsource/caveat", "caveat"],   /* Table Talk's pad (v7.18) */
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
/* THE HAND ROW SCROLLS (v7.16): a card past the edge is reached the way a thumb does, a sideways touch swipe
   (a real CDP scroll gesture, so the phone's native scroller moves it) toward it, until it is whole in view.
   Not a tap on the edge card: a card that cannot be played opens large on a tap, and that sheet takes every
   click after it. Returns whether it got there. */
async function handTo(page, css){
  const cdp = await page.context().newCDPSession(page);
  const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  try {
    for(let i = 0; i < 10; i++){
      const st = await page.evaluate(sel => {
        const t = document.querySelector(sel); if(!t) return { gone: true };
        const w = t.closest(".phand"); if(!w) return { gone: true };
        w.scrollIntoView({ block: "nearest" });
        const b = w.getBoundingClientRect(), q = t.getBoundingClientRect();
        if(q.left >= b.left - 1 && q.right <= b.right + 1) return { ok: true };
        return { dx: q.left < b.left ? -1 : 1, x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }, css);
      if(st.ok) return true;
      if(st.gone) return false;
      /* the finger moves against the content: to bring a card in from the right, swipe left (CDP touch events; headless
         Chromium scrolls natively on them, where Input.synthesizeScrollGesture moved nothing) */
      await T("touchStart", st.x, st.y);
      for(let k = 1; k <= 8; k++){ await T("touchMove", st.x - st.dx * k * 12, st.y); await page.waitForTimeout(16); }
      await T("touchEnd"); await page.waitForTimeout(600);
    }
    return false;
  } finally { await cdp.detach().catch(() => {}); }
}
/* THE HAND ROW JUDGE (v7.16; it replaces v7.13's wheelJudge). On the screen showing `.phand.hrow`: every card upright
   (no rotation), the same width and at least 76 px wide, in one line (the peek's 7-px lift allowed), wholly inside the
   row's height, no two overlapping; the row inside the phone; when the row is wider than its box it is a native
   x-scroller, and each edge's `+N` counts exactly the cards whose middle lies past that edge. Then the drive: a touch
   swipe scrolls the row and peeks and plays nothing; a tap on a playable card cut by the right edge peeks it, opens
   the dock and glides the card whole into view; and with `commit`, a second tap on the peeked card changes the board.
   Returns rows as [ok, name, detail]. */
async function handJudge(page, prefix, { commit = false } = {}){
  const out = [];
  const geo = () => page.evaluate(() => {
    const w = [...document.querySelectorAll(".board .phand.hrow")].find(e => { const b = e.getBoundingClientRect(); return b.height && b.bottom > 0 && b.top < innerHeight; });
    if(!w) return { bad: ["no hand row on screen"] };
    const bad = [], W = innerWidth, wb = w.getBoundingClientRect();
    if(wb.left < -1 || wb.right > W + 1) bad.push(`the row [${Math.round(wb.left)}..${Math.round(wb.right)}] leaves the phone`);
    const cells = [...w.querySelectorAll(".hrin > .hc")], bx = cells.map(c => c.getBoundingClientRect());
    const w0 = bx.length ? bx[0].width : 0, tops = bx.map(q => q.top);
    cells.forEach((c, i) => { const q = bx[i], tf = getComputedStyle(c).transform;
      if(tf && tf !== "none"){ const m = tf.match(/matrix\(([^)]+)\)/); const v = m ? m[1].split(",").map(Number) : null;
        if(!v || Math.abs(v[1]) > 0.001 || Math.abs(v[2]) > 0.001 || Math.abs(v[0] - 1) > 0.001) bad.push(`card ${i + 1} is turned or scaled (${tf})`); }
      if(Math.abs(q.width - w0) > 1) bad.push(`card ${i + 1} is ${Math.round(q.width)} px wide, card 1 ${Math.round(w0)}`);
      if(q.width < 75.5) bad.push(`card ${i + 1} is ${Math.round(q.width)} px wide (< 76)`);
      if(q.top < wb.top - 1 || q.bottom > wb.bottom + 1) bad.push(`card ${i + 1} [${Math.round(q.top)}..${Math.round(q.bottom)}] outside the row [${Math.round(wb.top)}..${Math.round(wb.bottom)}]`);
      if(i && q.left < bx[i - 1].right - 0.5) bad.push(`cards ${i} and ${i + 1} overlap`); });
    if(tops.length && Math.max(...tops) - Math.min(...tops) > 8) bad.push(`not one line: tops ${Math.round(Math.min(...tops))}..${Math.round(Math.max(...tops))}`);
    const over = w.scrollWidth > w.clientWidth + 1, ox = getComputedStyle(w).overflowX;
    if(over && !/auto|scroll/.test(ox)) bad.push(`the row is ${w.scrollWidth} wide in a ${w.clientWidth} box and does not scroll (overflow-x ${ox})`);
    let l = 0, r = 0; bx.forEach(q => { const m = (q.left + q.right) / 2; if(m < wb.left) l++; else if(m > wb.right) r++; });
    const chip = side => { const b = w.querySelector(".hrmore." + side + " b"); return b && b.getClientRects().length ? +b.innerText.replace(/\D/g, "") : 0; };   /* drawn, not merely present */
    if(chip("l") !== l || chip("r") !== r) bad.push(`the edges say +${chip("l")} / +${chip("r")}, the cards past them are ${l} / ${r}`);
    const pk = cells.findIndex(c => c.classList.contains("peek"));
    return { bad, n: cells.length, w: Math.round(w0), over, sl: Math.round(w.scrollLeft), l, r, peek: pk, dock: !!document.querySelector(".peekwrap"),
             wb: [Math.round(wb.top), Math.round(wb.height)] };
  });
  /* the hand's size or the action bar, never the board's text: the ticker changes that on its own */
  const sig = () => page.evaluate(() => [document.querySelectorAll(".board .phand .hc").length,
    (document.querySelector(".board .actbar") || {}).innerText || ""].join(" | ").replace(/\s+/g, " "));
  const g0 = await geo();
  out.push([!g0.bad.length, prefix + ": the hand row (upright, one size, one line, the edge counts true)",
            g0.bad.length ? g0.bad.join("; ") : `${g0.n} cards ${g0.w} px wide, row at y ${g0.wb[0]} h ${g0.wb[1]}, ${g0.over ? "scrolls" : "fits"}, past the edges ${g0.l} / ${g0.r}`]);
  if(g0.bad.length || g0.n < 2) return out;
  if(g0.over){
    const wb = await page.locator(".board .phand.hrow").first().boundingBox();
    const b0 = await sig(), cdp = await page.context().newCDPSession(page);
    const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const x0 = wb.x + wb.width / 2, y0 = wb.y + wb.height / 2;
    await T("touchStart", x0, y0);
    for(let k = 1; k <= 10; k++){ await T("touchMove", x0 - k * 15, y0); await page.waitForTimeout(16); }
    await T("touchEnd");
    await cdp.detach().catch(() => {});
    await page.waitForTimeout(800);
    const g1 = await geo(), b1 = await sig();
    out.push([!g1.bad.length && g1.sl > g0.sl && g1.peek === g0.peek && b1 === b0, prefix + ": a swipe scrolls the row and peeks and plays nothing",
              `scroll ${g0.sl} -> ${g1.sl}, peek ${g0.peek} -> ${g1.peek}, ${b0 === b1 ? "board unchanged" : b0 + " -> " + b1}` + (g1.bad.length ? "; " + g1.bad.join("; ") : "")]);
    await page.evaluate(() => { const w = document.querySelector(".board .phand.hrow"); if(w) w.scrollLeft = 0; });
    await page.waitForTimeout(250);
  }
  /* a playable card the right edge cuts (or, when the row fits, the last playable card) */
  const pick = await page.evaluate(() => {
    const w = document.querySelector(".board .phand.hrow"), wb = w.getBoundingClientRect();
    const cells = [...w.querySelectorAll(".hrin > .hc")];
    let i = cells.findIndex(c => { const q = c.getBoundingClientRect(); return !c.classList.contains("dis") && q.left < wb.right - 20 && q.right > wb.right + 1; });
    if(i < 0) for(let k = cells.length - 1; k >= 0; k--) if(!cells[k].classList.contains("dis") && !cells[k].classList.contains("peek")){ i = k; break; }
    if(i < 0) return null;
    const q = cells[i].getBoundingClientRect();
    return { i, x: Math.round(Math.max(q.left, wb.left) + Math.min(q.right, wb.right)) / 2, y: Math.round(q.top + q.height / 2), cut: q.right > wb.right + 1 };
  });
  if(!pick){ out.push([true, prefix + ": a tap peeks a card and brings it whole into view", "no playable card in the hand to tap"]); return out; }
  await page.mouse.click(pick.x, pick.y);
  await page.waitForTimeout(700);
  const g2 = await geo();
  const whole = await page.evaluate(i => { const w = document.querySelector(".board .phand.hrow"), b = w.getBoundingClientRect();
    const q = w.querySelectorAll(".hrin > .hc")[i].getBoundingClientRect(); return q.left >= b.left - 1 && q.right <= b.right + 1; }, pick.i);
  out.push([!g2.bad.length && g2.peek === pick.i && g2.dock && whole, prefix + ": a tap peeks a card and brings it whole into view",
            `tapped card ${pick.i + 1}${pick.cut ? " (cut by the edge)" : ""}: peek ${g2.peek + 1}, dock ${g2.dock}, whole ${whole}` + (g2.bad.length ? "; " + g2.bad.join("; ") : "")]);
  if(commit){
    const b0 = await sig();
    await page.locator(".board .phand.hrow .hc.peek").click().catch(() => {});
    await page.waitForTimeout(700);
    const b1 = await sig();
    out.push([b1 !== b0, prefix + ": a second tap on the peeked card commits it", `${b0} -> ${b1}`]);
  }
  return out;
}
/* THE HUB JUDGE (G1c, v7.14; design/STAGE.md App. C.1). When the action bar is a hub (`.actbar.hub`): exactly one
   primary, inside the thumb lane (the middle 51% of the phone), its flat edge on the bottom of the screen, at least
   54 px tall and nothing over its centre; each secondary in a corner, wholly outside the lane, at least 44 px tall
   and inside the phone; no two of them overlapping; no label clipped and none under the 9-px floor. Returns
   {hub, ok, detail}: `hub` false is a row of equals (the per-card pickers), which this does not judge. */
async function hubJudge(page){
  return page.evaluate(() => {
    const bar = document.querySelector(".board .actbar");
    if(!bar || !bar.classList.contains("hub")) return { hub: false, ok: true, detail: "a row of equals" };
    const bad = [], W = innerWidth, H = innerHeight, L = W * 0.244, R = W * 0.756;
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const prim = [...bar.querySelectorAll(".hubm > *")], sec = [...bar.querySelectorAll(".hubl > *, .hubr > *")];
    if(prim.length !== 1) return { hub: true, ok: false, detail: `${prim.length} primaries` };
    const p = prim[0], pb = p.getBoundingClientRect(), lab = e => (e.innerText || "").replace(/\s+/g, " ").trim();
    if(pb.left < L - 1 || pb.right > R + 1) bad.push(`primary [${Math.round(pb.left)}..${Math.round(pb.right)}] outside the lane [${Math.round(L)}..${Math.round(R)}]`);
    if(pb.bottom < H - 1 || pb.bottom > H + 1) bad.push(`primary bottom ${Math.round(pb.bottom)} off the screen's edge ${H}`);
    if(pb.height < 53.5) bad.push(`primary ${Math.round(pb.height)} px tall`);
    const over = document.elementFromPoint(pb.left + pb.width / 2, pb.top + pb.height / 2);
    if(!over || !p.contains(over)) bad.push(`over the primary: ${over ? over.className || over.tagName : "-"}`);
    sec.forEach(s => { const b = s.getBoundingClientRect();
      if(!(b.right <= L + 1 || b.left >= R - 1)) bad.push(`"${lab(s)}" [${Math.round(b.left)}..${Math.round(b.right)}] inside the lane`);
      if(b.height < 43.5) bad.push(`"${lab(s)}" ${Math.round(b.height)} px tall`);
      if(b.left < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5) bad.push(`"${lab(s)}" outside the phone`);
      if(hit(b, pb)) bad.push(`"${lab(s)}" over the primary`); });
    if(sec.length === 2 && hit(sec[0].getBoundingClientRect(), sec[1].getBoundingClientRect())) bad.push("the corners overlap");
    [p, ...sec].forEach(e => {
      if(e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) bad.push(`"${lab(e)}" clipped`);
      if(parseFloat(getComputedStyle(e).fontSize) < 9) bad.push(`"${lab(e)}" under 9 px`); });
    return { hub: true, ok: !bad.length, detail: bad.length ? bad.join("; ")
      : `"${lab(p)}" at x ${Math.round(pb.left)}..${Math.round(pb.right)}` + (sec.length ? ", corners: " + sec.map(lab).join(" / ") : "") };
  });
}
/* THE ONE-SCREEN JUDGE (G1c part two, v7.15; design/STAGE.md §2.1). The board is one screen: the board box does not
   scroll vertically and exactly one screen is in flow; their strip sits above the stage and yours above the hand, both
   wholly on the phone, at least 44 px drawn (the tap floor), nothing over their centres; each strip's deck count equals the one its
   sheet shows (the strip is a reading of the side, not a second copy). Then the drive: a tap on their strip opens their
   board as a sheet that covers the stage's centre and hides the peek dock; You ▼ swaps it for yours; Chain closes it.
   Returns rows as [ok, name, detail]. */
/* BACK TO THE STAGE (v7.15): close any board sheet and bring the middle screen's PLAY pane into view, where a drive
   that read the log pane (JUDGE!!, the advisor header) left it scrolled. What a player does coming back from the log. */
async function toStage(page){
  await page.locator(".board .screennav button", { hasText: "Chain" }).first().click().catch(() => {});
  await page.evaluate(() => { const pp = document.querySelector(".board .tablewrap > .vscreen:not(.side) .playpane");
    const h = pp && pp.closest(".hscroll"); if(h) h.scrollLeft = pp.offsetLeft - h.offsetLeft; });
  await page.waitForTimeout(250);
}
async function screenJudge(page, prefix){
  const out = [];
  await toStage(page);
  await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); });
  await page.waitForTimeout(250);
  const g = await page.evaluate(() => {
    const bad = [], W = innerWidth, H = innerHeight, box = e => e.getBoundingClientRect();
    const tw = document.querySelector(".board .tablewrap");
    if(!tw) return { bad: ["no board"] };
    if(tw.scrollHeight > tw.clientHeight + 1) bad.push(`the board scrolls (${tw.scrollHeight} > ${tw.clientHeight})`);
    const flow = [...tw.children].filter(e => e.classList.contains("vscreen") && !e.classList.contains("side"));
    if(flow.length !== 1) bad.push(`${flow.length} screens in flow`);
    const st = {};
    for(const k of ["them", "you"]){
      const s = document.querySelector(`.board [data-strip="${k}"]`);
      if(!s){ bad.push(`no ${k} strip`); continue; }
      const b = box(s); st[k] = b;
      if(b.left < -0.5 || b.right > W + 0.5 || b.top < 0 || b.bottom > H) bad.push(`${k} strip off the phone`);
      if(b.height < 43.5) bad.push(`${k} strip ${Math.round(b.height)} px`);
      const o = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if(!o || !s.contains(o)) bad.push(`over the ${k} strip: ${o ? o.className || o.tagName : "-"}`);
    }
    const mid = document.querySelector(".board .playmid"), hand = document.querySelector(".board .phand");
    if(st.them && mid && st.them.bottom > box(mid).top + 1) bad.push("their strip is not above the stage");
    if(st.you && hand && st.you.bottom > box(hand).top + 1) bad.push("your strip is not above the hand");
    return { bad, mid: mid ? [box(mid).left + box(mid).width / 2, box(mid).top + box(mid).height / 2] : null };
  });
  out.push([!g.bad.length, prefix + ": one screen (no vertical scroll; their strip over the stage, yours over the hand)", g.bad.length ? g.bad.join("; ") : "ok"]);
  if(g.bad.length) return out;
  const deckOf = k => page.evaluate(k => { const b = [...document.querySelectorAll(`.board [data-strip="${k}"] .bsc`)].find(e => /deck/i.test(e.textContent));
    return b ? +b.querySelector("b").textContent : null; }, k);
  const sheetState = k => page.evaluate(([k, mid]) => {
    const s = document.querySelector(`.board [data-sheet="${k}"]`), open = !!s && s.classList.contains("open");
    const o = mid && document.elementFromPoint(mid[0], mid[1]);
    const d = s && s.querySelector(".dcnt");
    return { open, covers: !!o && !!s && s.contains(o), dock: !!document.querySelector(".peekwrap"),
             deck: d ? +d.textContent.trim() : null, others: document.querySelectorAll(".board .vscreen.side.open").length };
  }, [k, g.mid]);
  const tDeck = await deckOf("them");
  await page.locator('.board [data-strip="them"]').click();
  await page.waitForTimeout(400);
  const a = await sheetState("opp");
  out.push([a.open && a.covers && !a.dock && a.others === 1 && a.deck === tDeck, prefix + ": their strip opens their board as a sheet over the stage (deck count agrees)",
            `open ${a.open}, covers the stage ${a.covers}, dock ${a.dock}, sheets ${a.others}, deck: strip ${tDeck} sheet ${a.deck}`]);
  const yDeck = await deckOf("you");
  await page.locator(".screennav button", { hasText: "You" }).first().click();
  await page.waitForTimeout(400);
  const b = await sheetState("you"), bo = await sheetState("opp");
  out.push([b.open && b.covers && !bo.open && b.others === 1 && b.deck === yDeck, prefix + ": You ▼ swaps in your board (deck count agrees)",
            `yours open ${b.open}, covers ${b.covers}, theirs open ${bo.open}, deck: strip ${yDeck} sheet ${b.deck}`]);
  await page.locator(".screennav button", { hasText: "Chain" }).first().click();
  await page.waitForTimeout(300);
  const c = await sheetState("you");
  out.push([!c.open && c.others === 0 && !c.covers, prefix + ": Chain closes the sheet", `open ${c.open}, sheets ${c.others}`]);
  return out;
}
async function open({ w = 393, h = 852, deps = depsDir(), query = "", launch = null, title = false } = {}){
  /* the title screen shows first on every load; a drive opens past it (`?title=0`) unless it is the title being driven (`title: true`) */
  if(!title) query = query ? query + "&title=0" : "?title=0";
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

/* THE STAGE HUD JUDGE (G1a, docs/GRAPHICS-PLAN.md §3). Both boards draw `.stagehud` between the nav and the
   three screens. It must: sit inside the phone, below the nav and above the screens; carry NO text node under a
   transformed ancestor (the bars are skewed; their numerals are flat siblings, design/STAGE.md §3.1); draw each
   life numeral BESIDE its bar, never over it; keep each row's children from overlapping and every numeral
   unclipped; and say the truth: each numeral equals its bar's `data-hp`, each fill is hp/max of its bar, and
   when `truth` ([your life, theirs]) is given, the numerals equal it. Returns {ok, detail}. */
async function hudJudge(page, truth){
  const m = await page.evaluate(() => {
    const hud = document.querySelector(".board .stagehud");
    if(!hud) return { bad: ["no HUD"] };
    const bad = [], box = e => e.getBoundingClientRect(), W = window.innerWidth;
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const h = box(hud), nav = document.querySelector(".board .screennav"), tw = document.querySelector(".board .tablewrap");
    if(h.left < -0.5 || h.right > W + 0.5) bad.push(`outside the phone [${Math.round(h.left)}..${Math.round(h.right)}]`);
    if(nav && h.top < box(nav).bottom - 0.5) bad.push("over the nav");
    if(tw && h.bottom > box(tw).top + 0.5) bad.push("over the screens");
    const walk = document.createTreeWalker(hud, NodeFilter.SHOW_TEXT); let n, texts = 0;
    while((n = walk.nextNode())){ if(!n.nodeValue.trim()) continue; texts++;
      for(let p = n.parentElement; p && p !== document.body; p = p.parentElement){ const t = getComputedStyle(p).transform;
        if(t && t !== "none"){ bad.push(`"${n.nodeValue.trim()}" under a transform (${p.className})`); break; } } }
    const bars = [...hud.querySelectorAll(".shbar")], nums = [...hud.querySelectorAll(".shnum")];
    if(bars.length !== 2 || nums.length !== 2) bad.push(`${bars.length} bars, ${nums.length} numerals`);
    nums.forEach(x => { bars.forEach(b => { if(hit(box(x), box(b))) bad.push(`numeral ${x.innerText} over a bar`); });
      if(x.scrollWidth > x.clientWidth + 1) bad.push(`numeral ${x.innerText} clipped`); });
    hud.querySelectorAll(".shrow, .shside").forEach(r => { const k = [...r.children].filter(c => box(c).width > 0);
      for(let i = 0; i < k.length; i++) for(let j = i + 1; j < k.length; j++)
        if(!k[i].contains(k[j]) && !k[j].contains(k[i]) && hit(box(k[i]), box(k[j]))) bad.push(`${k[i].className} overlaps ${k[j].className}`); });
    const life = nums.map(x => +x.innerText.trim());
    bars.forEach((b, i) => { const hp = +b.dataset.hp, mx = +b.dataset.max, f = b.querySelector(".fill");
      if(life[i] !== hp) bad.push(`numeral ${life[i]} != bar ${hp}`);
      const want = Math.min(1, hp / mx), got = box(f).width / b.clientWidth;
      if(Math.abs(want - got) > 0.03) bad.push(`fill ${got.toFixed(2)} != ${want.toFixed(2)}`); });
    return { bad, life, texts, h: [Math.round(h.top), Math.round(h.height)] };
  });
  if(truth && m.life && JSON.stringify(m.life) !== JSON.stringify(truth)) m.bad.push(`life ${JSON.stringify(m.life)} != game ${JSON.stringify(truth)}`);
  return { ok: !m.bad.length, detail: m.bad.length ? m.bad.join("; ") : `life ${JSON.stringify(m.life)}, ${m.texts} text nodes flat, at y ${m.h[0]} h ${m.h[1]}` };
}

/* THE GLANCE (v7.17): a tap on a playable hand card opens the peek dock WITH THE CARD in it, at every height. v7.15 hid the
   card under 700 px tall (the hand wheel's top card was already magnified) and v7.16 retired the wheel, so on an iPhone,
   whose Safari view is ~660 px tall, a tapped card showed its name bar alone ("the card previews broke", user 2026-11-26).
   Asserted: the dock opens; its card is drawn, wider than the hand card it shows (or it tells nothing) and at least 88 px;
   inside the phone; its top under the jump row (whose taps stay reachable); the card above the dock's bar and the bar
   above the hand row (`--peekbot`). The dock is closed after. Returns rows as [ok, name, detail]. */
async function peekJudge(page, prefix){
  await toStage(page);
  const card = page.locator(".board .phand .hc:not(.dis):visible").first();
  if(!(await card.count())) return [[false, prefix + ": the glance (a peeked card shows the card)", "no playable hand card"]];
  await card.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const B = e => { if(!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, w: b.width, h: b.height }; };
    const dock = document.querySelector(".peekwrap"), c = dock && dock.querySelector(".peekcard"), bar = dock && dock.querySelector(".peekbar");
    const nav = B(document.querySelector(".board .screennav")), hand = B(document.querySelector(".board .phand"));
    const hc = B(document.querySelector(".board .phand .hc")), cb = B(c), bb = B(bar), bad = [];
    const shown = !!c && getComputedStyle(c).display !== "none" && cb && cb.w > 0 && cb.h > 0;
    if(!dock) bad.push("no dock");
    else if(!shown) bad.push("the dock shows no card");
    else {
      if(cb.w < 88) bad.push(`card ${Math.round(cb.w)} px wide`);
      if(hc && cb.w <= hc.w + 1) bad.push(`card ${Math.round(cb.w)} px, no wider than the hand card (${Math.round(hc.w)})`);
      if(cb.l < -0.5 || cb.r > innerWidth + 0.5 || cb.t < -0.5) bad.push("card outside the phone");
      if(nav && cb.t < nav.b - 0.5) bad.push(`card top ${Math.round(cb.t)} over the jump row (bottom ${Math.round(nav.b)})`);
      if(bb && cb.b > bb.t + 0.5) bad.push("card under its bar");
      if(bb && hand && bb.b > hand.t + 0.5) bad.push(`bar bottom ${Math.round(bb.b)} over the hand (top ${Math.round(hand.t)})`);
    }
    return { bad, w: cb ? Math.round(cb.w) : 0, hw: hc ? Math.round(hc.w) : 0, top: cb ? Math.round(cb.t) : null };
  });
  await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); });
  await page.waitForTimeout(250);
  return [[!r.bad.length, prefix + ": the glance (a peeked card shows the card, wider than the hand's, clear of the jump row and the hand)",
           r.bad.length ? r.bad.join("; ") : `card ${r.w} px (hand ${r.hw}), top ${r.top}`]];
}

module.exports = { open, makeAnswer, depsDir, hudJudge, hubJudge, screenJudge, toStage, handTo, handJudge, peekJudge };

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

    /* SHARE THE TABLE NUMBER (v7.07, QUEUE NEXT 2). A direct host's screen offers the share sheet; a stand-in navigator.share
       records what it is handed (the number must be in it), and with no share sheet the same button copies instead.
       PeerJS is stubbed so no relay is reached. Sabotage: drop the <ShareCode> under the direct host's number. */
    for(const sheet of [true, false]){
      const name = sheet ? "table: the host shares the table number through the phone's share sheet" : "table: with no share sheet the host copies the table number";
      if(!(await click(btn(/^Find an opponent/), "find an opponent (share)"))) { row(false, name, "no find button"); continue; }
      await page.waitForSelector(".tblwrap");
      await page.evaluate((sheet) => { window.Peer = class { constructor(id){ this.h = {}; setTimeout(() => this.emit("open", id), 10); }
          on(e, f){ (this.h[e] = this.h[e] || []).push(f); } emit(e, ...a){ (this.h[e] || []).forEach(f => f(...a)); } destroy(){} connect(){ return null; } };
        window.__shared = null; window.__copied = null;
        Object.defineProperty(navigator, "share", { configurable: true, value: sheet ? (d => { window.__shared = d; return Promise.resolve(); }) : undefined });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: t => { window.__copied = t; return Promise.resolve(); } } }); }, sheet);
      let got = {};
      if(await click(btn(/^Open a table$/), "open a direct table (share)")){
        await page.waitForSelector('[data-testid="share-code"]', { timeout: 8000 }).catch(() => {});
        const b = await page.locator('[data-testid="share-code"]').boundingBox().catch(() => null);
        got.code = (await page.locator(".tblcode").first().innerText().catch(() => "")).trim();
        got.label = (await page.locator('[data-testid="share-code"]').innerText().catch(() => "")).trim();
        got.h = b ? Math.round(b.height) : 0; got.fits = !!b && b.x >= 0 && b.x + b.width <= W;
        await page.locator('[data-testid="share-code"]').click().catch(() => {});
        await page.waitForTimeout(150);
        got.out = await page.evaluate(() => window.__shared ? window.__shared.text : window.__copied);
        got.said = (await page.locator('[data-testid="share-said"]').innerText().catch(() => "")).trim();
      }
      const ok = got.code.length >= 4 && got.h >= 44 && got.fits && typeof got.out === "string" && got.out.includes(got.code)
        && (sheet ? /^Share/i.test(got.label) && !got.said : /^Copy/i.test(got.label) && /Copied/.test(got.said));
      row(ok, name, JSON.stringify(got));
      await page.evaluate(() => { delete window.Peer; delete navigator.share; delete navigator.clipboard; });
      if(await has(".tblwrap")) await click(page.locator(".tblwrap button", { hasText: /^(Back|Leave|Close the table|Cancel)/i }).first(), "leave the host screen (share)");
      await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
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
    /* THE OPPONENT IS PICKED FIRST (v7.xx, user 2026-11-25): Battle opens the opponent step, then the
       coin, then the sideboard. `foe`: null = leave the Dummy; a number = the nth tile of the step
       (0 Dummy, 1 Random, 2+ heroes); a string = the tile whose label starts with it. `onFoe` runs
       on the step after the pick, before Continue. `toLoadout.foe` is the name the step revealed. */
    const toLoadout = async (prefix, seat = 0, foe = null, onFoe = null) => {
      if(!(await has(".sheet")) && !(await click(page.locator(".hcard").first(), "pick a hero"))) return false;
      if(!(await click(btn(/^Battle$/), "battle"))) return false;
      await page.waitForSelector(".foestep", { timeout: 8000 });
      if(foe !== null){
        const tile = typeof foe === "string" ? page.locator(`.aifoe button[aria-label^="${foe}"]`).first() : (foe === 0 ? page.locator('.aifoe button[aria-label="The Dummy"]') : foe === 1 ? page.locator('.aifoe button[aria-label="A random hero"]') : page.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').nth(foe - 2));
        if(!(await click(tile, prefix + ": pick the opponent"))) return false;
      }
      toLoadout.foe = (await page.locator(".foereveal b").innerText().catch(() => "")).trim();
      if(onFoe) await onFoe();
      if(!(await click(page.locator("[data-foe-go]"), prefix + ": continue past the opponent step"))) return false;
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
      /* one screen (v7.15): the hand is on the stage, under any board sheet the drive left open */
      await toStage(page);
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
      const hubs = [], hubBad = [];   /* every bar state this drive reaches, judged as a hub (v7.14) */
      /* one screen (v7.15): the plays are on the stage, so close any board sheet the drive left open */
      await toStage(page);
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
        if(!sigs.has(sig)){ sigs.add(sig); await screen(prefix + ": " + (sig || "(no actions)"));
          const hj = await hubJudge(page); if(hj.hub){ hubs.push(sig); if(!hj.ok) hubBad.push(`[${sig}] ${hj.detail}`); } }
        if(!pick) break;
        const before = await board();
        const label = new RegExp("^\\s*" + pick.t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i");
        if(!(await click(page.locator(".board button:not([disabled])").filter({ hasText: label }).first(), prefix + " tap " + pick.t))) break;
        taps++; await page.waitForTimeout(900);
        if((await board()) !== before) moved++;
      }
      row(moved > 0, prefix + ": plays on", `${moved}/${taps} taps changed the board`);
      row(hubs.length > 0 && !hubBad.length, prefix + ": the hub (the primary in the thumb lane on the bottom edge, secondaries in the corners)",
          hubBad.length ? hubBad.join(" | ") : `${hubs.length} bar state(s): ${hubs.join(" / ")}`);
    };

    /* ---- the trainer ---- */
    if(await toLoadout("trainer")){
      await screen("trainer: loadout");
      await jumpHits("trainer: loadout", ".lo");
      if(await click(page.locator('.lo .actbar [data-start="trainer"]'), "Fight")){
        await page.waitForSelector(".board", { timeout: 8000 });
        await screen("trainer: board", "actions: " + names(await handBar()));
        await jumpHits("trainer", ".board");
        { const j = await hudJudge(page); row(j.ok, "trainer: the life HUD (bars, numerals beside them, nothing under a skew)", j.detail); }
        await nav("trainer", ["Chain"]);
        /* the first game points at the call (v6.59): a phone that has never seen it reads one
           line saying what the box is for, inside the screen, until both seats have had a turn */
        /* measured against its own box: the log pane may sit beside the screen in the pane row */
        { const nb = await page.evaluate(() => { const n = document.querySelector(".advnew"), a = n && n.closest(".adv");
            if(!n || !a) return null; const r = n.getBoundingClientRect(), q = a.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= q.left && r.right <= q.right, sw: n.scrollWidth <= n.clientWidth}; });
          row(!!nb && nb.inside && nb.sw && nb.w <= W && nb.h > 0, "trainer: a new phone's first game says what the call is for",
            nb ? `${nb.w}x${nb.h}px, inside its box ${nb.inside}` : "no line"); }
        for(const [ok, name, d] of await handJudge(page, "trainer")) row(ok, name, d);
        for(const [ok, name, d] of await screenJudge(page, "trainer")) row(ok, name, d);
        await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); });
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
        { const j = await hudJudge(page); row(j.ok, "trainer: the life HUD after the damage resolves", j.detail); }
        await click(page.locator(".screennav button", { hasText: "leave" }), "leave the trainer");
        await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
      }
    }

    /* ---- the table against an AI-piloted hero ---- */
    let foeName = "", first = "";
    if(await toLoadout("table", 0, 2, async () => {
      const foeBtn = page.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').first();   // the first hero tile, by label
      foeName = (await foeBtn.getAttribute("aria-label")) || ""; first = foeName.split(",")[0];
      row((await page.locator('.aifoe button[aria-label="The Dummy"]').count()) === 1, "table: with the title skipped the opponent step still offers the Dummy tile");
      {
        await screen("table: opponent step, AI foe picked", foeName);
        /* SHARP / STEADY (lookahead phase 2): two tiles under the picker, Sharp
           on by default, both inside the phone's width and a thumb tall, and a
           tap moves the choice. Left on Sharp, which the board must then report. */
        const lv = page.locator(".ailevel button");
        const boxes = await lv.evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect();
          return {t: b.innerText.split("\n")[0].trim(), on: b.classList.contains("on"), l: r.left, r: r.right, h: r.height}; }));
        row(boxes.length === 2 && /sharp/i.test(boxes[0].t) && /steady/i.test(boxes[1].t) && boxes[0].on && !boxes[1].on
            && boxes.every(x => x.l >= 0 && x.r <= W && x.h >= 44),
            "table: Sharp / Steady", JSON.stringify(boxes.map(x => [x.t, x.on, Math.round(x.l), Math.round(x.r), Math.round(x.h)])));
        /* THE TILES CAN BE REACHED, and the step never scrolls sideways. Scroll the tiles into the
           middle of the screen (what a thumb can do): each must sit above the Continue bar and take a
           tap at its centre; the page is no wider than the phone. */
        const reach = await page.evaluate(async () => {
          const t0 = document.querySelector(".ailevel");
          if(!t0) return {err: "no level tiles"};
          t0.scrollIntoView({block: "center"}); await new Promise(r => setTimeout(r, 300));
          const bar = document.querySelector(".foebar").getBoundingClientRect();
          const tiles = [...document.querySelectorAll(".ailevel button")].map(b => { const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {t: b.innerText.split("\n")[0].trim(), top: Math.round(r.top), bot: Math.round(r.bottom), hit: !!hit && b.contains(hit)}; });
          return {tiles, bar: Math.round(bar.top), vh: window.innerHeight, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth};
        });
        row(!reach.err && reach.tiles.length === 2 && reach.tiles.every(x => x.hit && x.top >= 0 && x.bot <= reach.bar) && reach.sw <= W && reach.bw <= W,
            "table: Sharp / Steady clear the Continue bar, no sideways scroll",
            reach.err || `tiles ${reach.tiles.map(x => `${x.t} ${x.top}..${x.bot}${x.hit ? "" : " (tap lands elsewhere)"}`).join(", ")}; bar ${reach.bar}; scrollWidth ${reach.sw}/${reach.bw} vs ${W}`);
        if(boxes.length === 2){
          await lv.nth(1).click(); const st = await lv.evaluateAll(bs => bs.map(b => b.classList.contains("on")));
          await lv.nth(0).click(); const sh = await lv.evaluateAll(bs => bs.map(b => b.classList.contains("on")));
          row(!st[0] && st[1] && sh[0] && !sh[1], "table: the level follows the tap", `steady ${st} · sharp ${sh}`);
        }
      }
    })){
      {
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
          for(const [ok, name, d] of await screenJudge(page, "table")) row(ok, name, d);
          /* the hand row at the table too (v7.16): the same judge, no commit; the peek it opens is closed after */
          for(const [ok, name, d] of await handJudge(page, "table")) row(ok, name, d);
          await page.evaluate(() => { const w = document.querySelector(".peekwrap"); if(w) w.click(); }); await page.waitForTimeout(250);
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
      if(!(await toLoadout("over", 0, foeIdx))) return;
      const foe = toLoadout.foe.split(",")[0];
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
      /* THE RECAP (v7.09, QUEUE NEXT 2): every ending carries the recap card, and its numbers are the game's own count
         (`recap` on the state, kept by judge.recapStep): turns, then "You" first with this seat's life lost. It fits 393.
         Sabotage: drop <Recap> from the table's end panel (both the WinPanel and the EndPanel branch). */
      { const rc = await page.evaluate(() => { const el = document.querySelector('.reveal [data-testid="recap"]'), st = window.__dawnTable.session.state();
          if(!el) return { shown: false };
          const b = el.getBoundingClientRect(), cells = [...el.querySelectorAll("tbody tr:first-child td b")].map(x => x.innerText.trim());
          return { shown: true, head: el.querySelector(".rchead").innerText.trim(), you: el.querySelector("thead th:nth-child(2)").innerText.trim(),
            lost: cells, want: st.recap ? st.recap.lost.map(String) : null, turn: st.turn, fits: b.left >= 0 && b.right <= innerWidth }; });
        row(rc.shown && rc.fits && /^you$/i.test(rc.you) && new RegExp("^" + rc.turn + " turns?$", "i").test(rc.head) && JSON.stringify(rc.lost) === JSON.stringify(rc.want),
          label + ": the recap card tells the game's own count", JSON.stringify(rc)); }
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

    /* ---- EQUIPMENT THAT CAN BLOCK IS ON THE HAND RAIL (v7.11; user, 2026-11-25: "make sure the equipment
       is showing up in the hand wheel when it can be blocked with"). The AI goes first; at the table's first
       defend step the rail's gear entries are exactly the pieces `judge.legal` lets seat 0 declare (and there
       is at least one), and two taps on one declare it: it lands in `blockG` and wears ⛨ DEF on the rail.
       Sabotage: drop the defend loop from TableBoard's `railPlays` (the set comes back empty). */
    if(await toLoadout("gear", 1, 2) && await click(page.locator('.lo .actbar [data-start="table"]'), "gear: fight at the table")){
      await page.waitForSelector(".board", { timeout: 15000 });
      const reach = await page.evaluate(async () => {
        const T = window.__dawnTable, s = T.session;
        for(let k = 0; k < 400; k++){
          const st = s.state();
          if(st.over) return { ok: false, why: "over" };
          if(DawnPriority.canDeclareDefenders(st, 0)) return { ok: true, turn: st.turn };
          for(const a of [{ t: "pass" }, { t: "endTurn" }, { t: "arsenal", uid: null }]) if(DawnJudge.legal(st, a, 0) == null){ s.submit(a); break; }
          await new Promise(r => setTimeout(r, 150));
        }
        return { ok: false, why: "no defend step" };
      });
      if(reach.ok){
        await nav("gear", ["Chain"]);
        await page.waitForTimeout(400);
        const want = await page.evaluate(() => { const st = window.__dawnTable.session.state();
          return st.sides[0].gear.filter(x => !x.destroyed && DawnJudge.legal(st, { t: "defend", uid: x.uid }, 0) == null).map(x => String(x.uid)).sort(); });
        const got = await page.evaluate(() => [...document.querySelectorAll(".phand [data-rail-def]")].map(b => b.getAttribute("data-rail-def")).sort());
        row(want.length > 0 && JSON.stringify(want) === JSON.stringify(got), "table: equipment that can block is on the hand rail at the defend step",
            `legal ${JSON.stringify(want)}, rail ${JSON.stringify(got)}, turn ${reach.turn}`);
        if(got.length){
          const cell = page.locator(`.phand [data-rail-def="${got[0]}"]`);
          await handTo(page, `.phand [data-rail-def="${got[0]}"]`);
          await cell.click().catch(() => {}); await page.waitForTimeout(250); await cell.click().catch(() => {}); await page.waitForTimeout(400);
          const after = await page.evaluate(u => ({ blk: (window.__dawnTable.session.state().sides[0].blockG || []).map(String).includes(u),
            mark: !!document.querySelector(`.phand [data-rail-def="${u}"] .defsel`) }), got[0]);
          row(after.blk && after.mark, "table: two taps on a rail piece declare it (⛨ DEF on the rail)", JSON.stringify(after));
        }
        { const st = await page.evaluate(() => { const g = window.__dawnTable.session.state(); return [g.sides[0].hp, g.sides[1].hp, g.turnPlayer]; });
          const j = await hudJudge(page, st.slice(0, 2));
          const mark = await page.locator(".board .stagehud .shturn").getAttribute("aria-label").catch(() => "");
          row(j.ok && /theirs$/.test(mark || "") === (st[2] !== 0), "table: the life HUD says each seat's life and whose turn it is", j.detail + "; " + mark); }
        await screen("gear: the defend step's rail");
      } else row(false, "table: equipment that can block is on the hand rail at the defend step", "never reached: " + reach.why);
      await click(page.locator(".screennav button", { hasText: "leave" }), "leave the gear table");
      await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
    }

    /* THE RECORD ON THE PICKER (v5.84). After the win and the concession
       above, at Sharp: Lyath's tile reads 1–0 and the other foe's 0–1, every
       other tile reads nothing; each label sits inside its tile, inside the
       phone, on one line. At Steady (no games played there) no label shows. */
    if(await toLoadout("record", 0, null, async () => {
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
      await click(page.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').first(), "pick an AI hero to show the level");
      const tapped = await click(lv.nth(1), "Steady"); await page.waitForTimeout(150); const steady = await labels();
      const note = await page.locator(".frecnote").count();
      await lv.nth(0).click().catch(() => {});
      row(tapped && steady.length === 0 && note === 0, "table: the record follows the level", `at Steady ${steady.length} labels, ${note} notes`);
    })){
      await click(page.locator(".lo .screennav button", { hasText: "back" }), "leave the record loadout (back to the opponent step)");
      await page.waitForSelector(".foestep", { timeout: 5000 }).catch(() => {});
      await click(page.locator(".foestep .screennav button", { hasText: "back" }), "leave the opponent step");
      await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
    }

    /* PICK THE OPPONENT BEFORE THE SIDEBOARD (v7.xx, user 2026-11-25). Random is drawn the moment it is
       tapped and named on the opponent step; the sideboard's strip names that same hero; the match deals
       that hero; Back from the sideboard lands on the step with the choice kept; the Dummy path still
       goes to the trainer. Every row below was sabotaged (see the commit message). */
    {
      const heroKeys = await page.evaluate(() => HEROES.map(x => x.k));
      await page.evaluate(() => { window.__dawnTable = null; });
      let K = "", R = "";
      const ok1 = await toLoadout("foefirst", 0, 1, async () => {
        const reveal = await page.evaluate(() => { const e = document.querySelector(".foereveal"); return { key: e && e.getAttribute("data-foe"), text: e ? e.innerText : "", name: e && e.querySelector("b") ? e.querySelector("b").innerText : "" }; });
        K = reveal.key; R = reveal.name;
        row(heroKeys.includes(reveal.key) && reveal.name && !/dummy|random hero|^\?+$/i.test(reveal.name) && /^Your opponent:/.test(reveal.text),
          "foefirst: Random is drawn and NAMED on the opponent step, before the coin and the sideboard", JSON.stringify(reveal.text));
        const strip = await page.evaluate(() => (document.querySelector(".foestep .vslot.p2 .vname") || {}).innerText || "");
        row(!!strip && !/\?/.test(strip) && !/random hero/i.test(strip), "foefirst: the step's strip shows the real hero, never the mystery card", JSON.stringify(strip));
      });
      if(ok1){
        const lo = await page.evaluate(k => { const hs = heroShort(HEROES.find(x => x.k === k)); const v = [...document.querySelectorAll(".lo .vslot.p2 .vname")].map(e => e.innerText);
          return { want: hs, strips: v, picker: document.querySelectorAll(".lo .aifoe").length, mystery: /random hero/i.test(document.querySelector(".lo").innerText) }; }, K);
        row(lo.strips.length >= 1 && lo.strips.every(t => t.toLowerCase().includes(lo.want.toLowerCase())) && lo.picker === 0 && !lo.mystery,
          "foefirst: the sideboard's VsStrip names the same hero, carries no picker, and never shows the mystery card", JSON.stringify(lo));
        const startBtn = await page.locator('.lo .actbar [data-start="table"]').innerText();
        row(startBtn.toLowerCase().includes(lo.want.toLowerCase()), "foefirst: the sideboard's fight button names the drawn hero", JSON.stringify(startBtn));
        /* Back walks the steps in order and keeps the choice */
        await click(page.locator(".lo .screennav button", { hasText: "back" }), "foefirst: back from the sideboard");
        await page.waitForSelector(".foestep", { timeout: 5000 }).catch(() => {});
        const back = await page.evaluate(() => { const e = document.querySelector(".foereveal"); const on = document.querySelector(".aifoe button.on"); return { onStep: !!document.querySelector(".foestep"), key: e && e.getAttribute("data-foe"), on: on ? on.getAttribute("aria-label") : "" }; });
        row(back.onStep && back.key === K && /random/i.test(back.on),
          "foefirst: Back from the sideboard returns to the opponent step with the choice kept (the same hero, Random still lit)", JSON.stringify(back));
        await click(page.locator("[data-foe-go]"), "foefirst: continue again");
        await page.waitForSelector(".rps"); await page.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
        if(await has(".rseatpick")) await click(page.locator(".rseatpick button").first(), "I go first");
        await page.waitForSelector(".lo .actbar", { timeout: 8000 });
        if(await click(page.locator('.lo .actbar [data-start="table"]'), "foefirst: fight")){
          await page.waitForSelector(".board", { timeout: 15000 });
          const dealt = await page.evaluate(() => { const t = window.__dawnTable; return t ? { key: t.session.state().sides[1].heroKey || null } : null; });
          row(!!dealt && dealt.key === K, "foefirst: the match deals the very hero the step revealed", JSON.stringify({ revealed: K, dealt: dealt && dealt.key }));
          await click(page.locator(".screennav button", { hasText: "leave" }), "foefirst: leave the table");
          await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
        }
      }
      /* the Dummy stays the default, and its path still lands on the trainer */
      await page.evaluate(() => { window.__dawnTable = null; });
      let dummy = "";
      if(await toLoadout("foefirst-dummy", 0, null, async () => { dummy = await page.evaluate(() => (document.querySelector(".foereveal") || {}).innerText || ""); })){
        const primary = await page.locator('.lo .actbar [data-start="trainer"]').getAttribute("class");
        if(await click(page.locator('.lo .actbar [data-start="trainer"]'), "foefirst: fight the dummy")){
          await page.waitForSelector(".board", { timeout: 8000 });
          const t = await page.evaluate(() => ({ table: !!window.__dawnTable, board: !!document.querySelector(".board") }));
          row(/Your opponent: The Dummy/.test(dummy) && /battlebtn/.test(primary) && t.board && !t.table,
            "foefirst: the Dummy is the default and its path still lands on the trainer", JSON.stringify({ step: dummy, primary, ...t }));
          await click(page.locator(".screennav button", { hasText: "leave" }), "foefirst: leave the trainer");
          await page.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
        }
      }
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
        await p2.waitForSelector(".foestep", { timeout: 8000 });
        const tiles = await p2.locator(".aifoe button").count(), recs = await p2.locator(".aifoe .frec").count();
        await p2.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').first().click();
        await p2.locator("[data-foe-go]").click();
        await p2.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
        if(await p2.locator(".rseatpick").isVisible().catch(() => false)) await p2.locator(".rseatpick button").first().click();
        await p2.waitForSelector(".lo .actbar", { timeout: 8000 });
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

    /* THE SCREEN STAYS AWAKE (v7.06, QUEUE NEXT 1). A stand-in navigator.wakeLock counts what the page asks for: no lock on
       the hero grid, one held on the trainer board and on an AI table board, none left once each is left, and a hidden page
       that comes back asks again (the browser drops the lock on hide). Sabotage: delete either useWakeLock() call. */
    {
      const kw = await open({ w: W, h: H });
      const name = "wake lock: held on the trainer and the table board, released on leave, asked again on return";
      let got = {};
      try {
        await kw.page.context().addInitScript(() => {
          const w = window.__wake = { asked: 0, held: 0 };
          Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request(t){
            w.asked++; w.held++; const ls = [];
            const l = { type: t, released: false, addEventListener(e, f){ if(e === "release") ls.push(f); },
              release(){ if(!l.released){ l.released = true; w.held--; ls.forEach(f => f()); } return Promise.resolve(); } };
            w.last = l; return Promise.resolve(l); } } }); });
        await kw.page.reload(); await kw.page.waitForSelector(".hgrid", { timeout: 15000 });
        const P = kw.page, wake = () => P.evaluate(() => ({ asked: window.__wake.asked, held: window.__wake.held }));
        got.grid = await wake();
        const seat = async () => { await P.locator("[data-foe-go]").click(); await P.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
          if(await P.locator(".rseatpick").isVisible().catch(() => false)) await P.locator(".rseatpick button").first().click();
          await P.waitForSelector(".lo .actbar", { timeout: 8000 }); };
        await P.locator(".hcard").first().click(); await P.getByRole("button", { name: /^Battle$/ }).click();
        await P.waitForSelector(".foestep", { timeout: 8000 }); await seat();
        await P.locator('.lo .actbar [data-start="trainer"]').click(); await P.waitForSelector(".board", { timeout: 8000 });
        await P.waitForTimeout(100); got.trainer = await wake();
        /* hidden then visible: the browser releases on hide, the page asks again on return */
        await P.evaluate(() => { window.__wake.last.release(); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
          document.dispatchEvent(new Event("visibilitychange")); });
        await P.waitForTimeout(100); got.back = await wake();
        await P.locator(".screennav button", { hasText: "leave" }).click(); await P.waitForSelector(".hgrid", { timeout: 5000 }).catch(() => {});
        await P.waitForTimeout(100); got.left = await wake();
        await P.locator(".hcard").first().click(); await P.getByRole("button", { name: /^Battle$/ }).click();
        await P.waitForSelector(".foestep", { timeout: 8000 });
        await P.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').first().click();
        await seat();
        await P.locator('.lo .actbar [data-start="table"]').click(); await P.waitForSelector(".board", { timeout: 15000 });
        await P.waitForTimeout(100); got.table = await wake();
        const ok = got.grid.asked === 0 && got.trainer.held === 1 && got.back.held === 1 && got.back.asked === 2 && got.left.held === 0
          && got.table.held === 1 && got.table.asked === 3 && !kw.errors.length;
        row(ok, name, JSON.stringify(got) + (kw.errors.length ? " errors: " + kw.errors.join(" | ") : ""));
      } catch(e){ row(false, name, JSON.stringify(got) + " " + String(e.message).split("\n")[0]); }
      await kw.close();
    }

    /* JOIN FROM THE LINK (v7.08, QUEUE NEXT 1). A shared link carries `?join=CODE`: a direct table's number (4 characters,
       typed in lower case here to prove it is read as the table reads it) opens Join a table with it filled in, a server
       table's (6) opens Enter a table code with it filled in, and a number of neither length opens the page as usual. Each
       time the parameter is gone from the address after it was read (a reload does not sit down again), and nothing is
       sat at until the player taps Sit down. Sabotage: drop the TableScreen effect that reads `join`. */
    for(const [q, want] of [["abcd", "ABCD"], ["ABCDEF", "ABCDEF"], ["XY", null]]){
      const name = want == null ? "join link: a number of neither length opens the page as usual" : `join link: a ${want.length}-character number opens its table's join screen, filled in`;
      let got = {}, kj = null;
      try {
        /* open() waits for the hero grid's card count, which a join link skips past: open as usual, then follow the link */
        kj = await open({ w: W, h: H });
        const P = kj.page;
        await P.goto(kj.href + "?join=" + q + "&title=0");
        await P.waitForSelector(".tblwrap, .hgrid", { timeout: 15000 });
        await P.waitForTimeout(300);
        got.search = await P.evaluate(() => window.location.search);
        got.input = await P.locator(".tblwrap input.tblin").inputValue({ timeout: 3000 }).catch(() => null);
        got.grid = await P.locator(".hgrid").isVisible().catch(() => false);
        got.sit = await P.locator(".tblwrap button.bigbtn", { hasText: /^Sit down$/ }).isEnabled({ timeout: 2000 }).catch(() => false);
        got.stat = await P.locator(".tblwrap .tblstat").allInnerTexts().catch(() => []);
        const ok = !/join=/.test(got.search) && !kj.errors.length && (want == null ? got.input == null && got.grid : got.input === want && got.sit && !got.grid);
        row(ok, name, JSON.stringify(got) + (kj.errors.length ? " errors: " + kj.errors.join(" | ") : ""));
      } catch(e){ row(false, name, JSON.stringify(got) + " " + String(e.message).split("\n")[0]); }
      if(kj) await kj.close();
    }

    /* YOUR RECORD (v7.00, QUEUE NEXT 3): the title's fourth door. A record against two AI heroes seeded in storage must come
       back as one row per hero (most games first) and the right total; the same page with NOTHING seeded must say so (the
       sabotage: an empty record must not draw rows). A phone with no server sign-in shows the ranked card's empty line and
       makes no request (any request off the routed list is a page error, counted below). */
    {
      const seedRec = { v: 2, foes: { kayo: { sharp: { w: 2, l: 1, d: 0 } }, dorinthea: { sharp: { w: 0, l: 1, d: 0 }, steady: { w: 1, l: 0, d: 1 } } },
        mine: { viserai: { w: 3, l: 1, d: 0 }, azalea: { w: 1, l: 1, d: 1 }, unknown: { w: 0, l: 0, d: 0 } } };
      for (const seeded of [true, false]) {
        const name = seeded ? "your record: a seeded record reads back per hero, most games first" : "your record: nothing seeded says so and draws no rows (sabotage)";
        const kr = await open({ w: W, h: H, title: true });
        try {
          await kr.page.evaluate((v) => { localStorage.clear(); if (v) localStorage.setItem("dawnblade.aiRecord", JSON.stringify(v)); }, seeded ? seedRec : null);
          await kr.page.reload(); await kr.page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
          await kr.page.locator('[data-testid="more-record"]').click();
          await kr.page.waitForSelector('[data-testid="record-page"]', { timeout: 8000 });
          const got = await kr.page.evaluate(() => ({
            rows: [...document.querySelectorAll('[data-testid="record-ai-row"]')].map(e => e.innerText.replace(/\s+/g, " ").trim()),
            total: (document.querySelector('[data-testid="record-ai-total"]') || {}).innerText || "",
            none: !!document.querySelector('[data-testid="record-ai-none"]'),
            mine: [...document.querySelectorAll('[data-testid="record-mine-row"]')].map(e => e.innerText.replace(/\s+/g, " ").trim()),
            ranked: !!document.querySelector('[data-testid="record-ranked-none"]'),
            tab: !!document.querySelector('[data-testid="tab-record"].on') }));
          const ok = seeded
            ? got.rows.length === 2 && /Dorinthea/.test(got.rows[0]) && /1–1–1/.test(got.rows[0]) && /Kayo/.test(got.rows[1]) && /2–1/.test(got.rows[1]) && /3 won, 2 lost, 1 drawn/.test(got.total) && !got.none
              && got.mine.length === 2 && /Viserai/.test(got.mine[0]) && /×4/.test(got.mine[0]) && /3–1/.test(got.mine[0]) && /1–1–1/.test(got.mine[1]) && !got.mine.some(t => /unknown/i.test(t))
            : got.rows.length === 0 && got.none && !got.total && got.mine.length === 0;
          row(ok && got.ranked && got.tab && !kr.errors.length, name, JSON.stringify(got) + (kr.errors.length ? " errors: " + kr.errors.join(" | ") : ", 0 page errors"));
        } catch (e) { row(false, name, String(e.message).split("\n")[0] + " " + kr.errors.join(" | ")); }
        await kr.close();
      }
    }

    /* YOUR RECORD ON THE HERO TILES (v7.10, QUEUE NEXT 3). The roster tile of a hero you played carries won–lost (–drawn) with
       it, the AI's games (`mine`) and people's (`pvp.mine`) added together; a hero never played carries nothing. At 393 and at
       320 the chip sits inside its tile and clear of the best-score star. An empty record draws no chip (the sabotage case). */
    for (const [w, h] of [[393, 852], [320, 568]]) for (const seeded of [true, false]) {
      const name = `hero tiles ${w}: ` + (seeded ? "a played hero's tile carries your record (AI and people added)" : "no games, no chip (sabotage)");
      const kt = await open({ w, h });
      try {
        await kt.page.evaluate((sd) => { localStorage.clear();
          if (sd){ localStorage.setItem("dawnblade.aiRecord", JSON.stringify({ v: 3, foes: { kayo: { sharp: { w: 2, l: 1, d: 0 } } }, mine: { viserai: { w: 2, l: 1, d: 0 } },
            pvp: { mine: { viserai: { w: 3, l: 1, d: 0 }, azalea: { w: 1, l: 1, d: 1 } }, foes: {}, seen: [] } }));
            localStorage.setItem("dawnblade.best", JSON.stringify({ viserai: 12 })); } }, seeded);
        await kt.page.reload(); await kt.page.waitForSelector(".hgrid", { timeout: 15000 });
        const got = await kt.page.evaluate((vw) => {
          const tiles = [...document.querySelectorAll(".hgrid .hcard")], out = {};
          HEROES.forEach((hh, i) => { const c = tiles[i] && tiles[i].querySelector('[data-testid="tile-rec"]'); if (!c) return;
            const t = tiles[i].getBoundingClientRect(), b = c.getBoundingClientRect(), st = tiles[i].querySelector(".best");
            const sb = st && st.getBoundingClientRect();
            out[hh.k] = { text: c.innerText.trim(), inside: b.left >= t.left && b.right <= t.right && b.top >= t.top && b.bottom <= t.bottom && b.right <= vw,
              clear: !sb || b.right <= sb.left || b.left >= sb.right || b.bottom <= sb.top || b.top >= sb.bottom, label: c.getAttribute("aria-label") }; });
          return out; }, w);
        const ks = Object.keys(got).sort();
        const ok = seeded ? JSON.stringify(ks) === '["azalea","viserai"]' && got.viserai.text === "5–2" && got.azalea.text === "1–1–1"
            && ks.every(k => got[k].inside && got[k].clear) && /5 won, 2 lost/.test(got.viserai.label) && !kt.errors.length
          : ks.length === 0 && !kt.errors.length;
        row(ok, name, JSON.stringify(got) + (kt.errors.length ? " errors: " + kt.errors.join(" | ") : ""));
      } catch(e){ row(false, name, String(e.message).split("\n")[0]); }
      await kt.close();
    }

    /* YOUR RECORD, AGAINST PEOPLE (worker AF): friendly and direct table games kept apart from the AI's. A v3 record with a
       `pvp` section draws one row per hero you played (most games first, draws only when there is one), inside the phone's
       width; a v2 record (the migration) and an empty one draw NO section (the sabotage: an unseeded phone must not show it);
       the AI rows are unchanged beside it. */
    {
      const ai = { foes: { kayo: { sharp: { w: 2, l: 1, d: 0 } } }, mine: { viserai: { w: 2, l: 1, d: 0 } } };
      const cases = [
        ["a v3 record draws one row per hero you played, most games first", { v: 3, ...ai, pvp: { mine: { azalea: { w: 1, l: 1, d: 1 }, viserai: { w: 3, l: 1, d: 0 } }, foes: { kayo: { w: 4, l: 2, d: 1 } }, seen: ["x|a|b"] } }, true],
        ["a v2 record migrates and draws no people section", { v: 2, ...ai }, false],
        ["an empty people record draws no section (sabotage)", { v: 3, ...ai, pvp: { mine: {}, foes: {}, seen: [] } }, false]];
      for (const [label, rec, wantSection] of cases) {
        const name = "your record, against people: " + label;
        const kr = await open({ w: W, h: H, title: true });
        try {
          await kr.page.evaluate((v) => { localStorage.clear(); localStorage.setItem("dawnblade.aiRecord", JSON.stringify(v)); }, rec);
          await kr.page.reload(); await kr.page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
          await kr.page.locator('[data-testid="more-record"]').click();
          await kr.page.waitForSelector('[data-testid="record-page"]', { timeout: 8000 });
          const got = await kr.page.evaluate((vw) => {
            const rows = [...document.querySelectorAll('[data-testid="record-pvp-row"]')];
            const box = e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= vw && r.height > 0; };
            return { rows: rows.map(e => e.innerText.replace(/\s+/g, " ").trim()), fits: rows.every(box),
              total: (document.querySelector('[data-testid="record-pvp-total"]') || {}).innerText || "",
              aiRows: document.querySelectorAll('[data-testid="record-ai-row"]').length,
              mine: document.querySelectorAll('[data-testid="record-mine-row"]').length,
              whomBefore: document.querySelectorAll('[data-testid="record-whom-row"]').length,
              whomBtn: !!document.querySelector('[data-testid="record-whom-btn"]') };
          }, W);
          /* "Against whom?" (v7.05): hidden until tapped, then one row per hero ACROSS the table (pvp.foes) */
          if (got.whomBtn) {
            await kr.page.locator('[data-testid="record-whom-btn"]').click();
            Object.assign(got, await kr.page.evaluate((vw) => {
              const rows = [...document.querySelectorAll('[data-testid="record-whom-row"]')];
              const b = document.querySelector('[data-testid="record-whom-btn"]').getBoundingClientRect();
              return { whom: rows.map(e => e.innerText.replace(/\s+/g, " ").trim()),
                whomFits: rows.every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= vw && r.height > 0; }),
                whomTap: b.height >= 44 };
            }, W));
          }
          const whomOk = wantSection
            ? got.whomBtn && got.whomBefore === 0 && got.whom.length === 1 && /vs Kayo ×7/.test(got.whom[0]) && /4–2–1$/.test(got.whom[0]) && got.whomFits && got.whomTap
            : !got.whomBtn;
          const ok = whomOk && wantSection
            ? got.rows.length === 2 && /Viserai/.test(got.rows[0]) && /×4/.test(got.rows[0]) && /3–1$/.test(got.rows[0]) && /Azalea/.test(got.rows[1]) && /1–1–1/.test(got.rows[1]) && got.fits
              && /4 won, 2 lost, 1 drawn in all/.test(got.total)
            : got.rows.length === 0 && !got.total;
          row(ok && got.aiRows === 1 && got.mine === 1 && !kr.errors.length, name, JSON.stringify(got) + (kr.errors.length ? " errors: " + kr.errors.join(" | ") : ", 0 page errors"));
        } catch (e) { row(false, name, String(e.message).split("\n")[0] + " " + kr.errors.join(" | ")); }
        await kr.close();
      }
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

    /* THE LIFE HUD AT THE SMALLEST PHONE (G1a): the same judge as the trainer row above, at 320x568. */
    {
      const sk = await open({ w: 320, h: 568 });
      try {
        const p = sk.page;
        await p.locator(".hcard").first().click(); await p.getByRole("button", { name: /^Battle$/ }).click();
        await p.waitForSelector(".foestep"); await p.locator("[data-foe-go]").click();
        await p.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
        if(await p.locator(".rseatpick").isVisible().catch(() => false)) await p.locator(".rseatpick button").first().click();
        await p.locator('.lo .actbar [data-start="trainer"]').click(); await p.waitForSelector(".board", { timeout: 8000 });
        await p.waitForTimeout(700);
        const j = await hudJudge(p); row(j.ok, "trainer 320x568: the life HUD", j.detail);
        await p.locator(".screennav button", { hasText: "Chain" }).click(); await p.waitForTimeout(700);
        { const hj = await hubJudge(p); row(hj.hub && hj.ok, "trainer 320x568: the hub", hj.detail); }
        for(const [ok, name, d] of await handJudge(p, "trainer 320x568", { commit: true })) row(ok, name, d);
        for(const [ok, name, d] of await screenJudge(p, "trainer 320x568")) row(ok, name, d);
      } catch(e){ row(false, "trainer 320x568: the life HUD", String(e && e.message || e).split("\n")[0]); }
      sk.errors.forEach(e => errors.push(`hud 320x568: ${e}`));
      await sk.close();
    }

    /* THE GLANCE AT AN IPHONE'S REAL HEIGHT (v7.17): Safari's view on a 393-wide iPhone is ~660 px tall, and the drives
       ran only at 852 and 568, so the hidden preview card (v7.15..v7.16) reached the player without a row failing. The
       trainer and the AI table, at 393x660 and at 320x568; a fresh page each. */
    for(const [pw, ph] of [[393, 660], [320, 568]]) for(const tbl of [false, true]){
      const lbl = `${tbl ? "table" : "trainer"} ${pw}x${ph}`;
      const gk = await open({ w: pw, h: ph });
      try {
        const p = gk.page;
        await p.locator(".hcard").first().click(); await p.getByRole("button", { name: /^Battle$/ }).click();
        await p.waitForSelector(".foestep");
        if(tbl) await p.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').nth(2).click();
        else await p.locator('.aifoe button[aria-label="The Dummy"]').click();
        await p.waitForTimeout(200); await p.locator("[data-foe-go]").click();
        await p.waitForSelector(".rseatpick, .lo", { timeout: 15000 });
        if(await p.locator(".rseatpick").isVisible().catch(() => false)) await p.locator(".rseatpick .go").click();
        await p.waitForSelector(".lo", { timeout: 10000 });
        await p.locator(tbl ? '.lo .actbar [data-start="table"]' : '.lo .actbar [data-start="trainer"]').click();
        await p.waitForSelector(".board .phand .hc", { timeout: 15000 }); await p.waitForTimeout(600);
        for(const [ok, name, d] of await peekJudge(p, lbl)) row(ok, name, d);
      } catch(e){ row(false, lbl + ": the glance", String(e && e.message || e).split("\n")[0]); }
      gk.errors.forEach(e => errors.push(`glance ${lbl}: ${e}`));
      await gk.close();
    }

    /* TABLE TALK (TT0, v7.18; docs/TABLE-TALK.md): the new table behind its switch (`?talk=1`), at the iPhone's real
       height, the drives' phone and the smallest — tools/talk.js's judge: one screen in order, the pad agreeing with the
       engine, nothing private named, the tap floor, the opponent's play said and shown, a tap moving the call on. */
    for(const [tw, th] of [[393, 660], [393, 852], [320, 568]]){
      const tk = await open({ w: tw, h: th, query: "?talk=1" });
      try {
        const T = require("./talk.js");
        await T.talkTo(tk.page);
        for(const [ok, name, d] of await T.talkJudge(tk.page, `talk ${tw}x${th}`)) row(ok, name, d);
      } catch(e){ row(false, `talk ${tw}x${th}: the drive ran to the end`, String(e && e.message || e).split("\n")[0]); }
      tk.errors.forEach(e => errors.push(`talk ${tw}x${th}: ${e}`));
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

    /* THE TRAINER'S PROMPT SHEETS (S; tools/promptsweep.js --trainer): the same sweep through window.__battle, which exists ONLY under
       ?drill=1. The first row proves the normal page has no such handle; the rest raise every kind through Battle's own openPrompt. */
    {
      const nk = await open({ w: 393, h: 852 });
      try { await nk.page.waitForSelector(".hcard", { timeout: 20000 });
        const has = await nk.page.evaluate(() => typeof window.__battle);
        row(has === "undefined", "trainer inject: the normal page carries no window.__battle", has); }
      catch(e){ row(false, "trainer inject: the normal page carries no window.__battle", String(e && e.message || e).split("\n")[0]); }
      await nk.close();
      const tk = await open({ w: 320, h: 568, query: "?drill=1" });
      try { await require("./promptsweep.js").injectDrill(tk.page, row, { w: 320, h: 568, board: "trainer" }); }
      catch(e){ row(false, "trainer inject 320x568: the drill ran to the end", String(e && e.message || e).split("\n")[0]); }
      tk.errors.forEach(e => errors.push(`trainer inject 320x568: ${e}`));
      await tk.close();
    }

    /* THE TITLE SCREEN (user request, 2026-11-25): the first screen on every load. Each mode opens its existing screen, Back returns to the
       title, nothing is asked of the server while a player only looks, and the choices are thumb-sized with no sideways scroll. */
    for(const [tw, th] of [[393, 852], [320, 568]]){
      const T = await open({ w: tw, h: th, title: true }), P = `title ${tw}x${th}`;
      const tb = (sel) => T.page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim().split("\n")[0], x: r.left, r: r.right, y: r.top, b: r.bottom, h: r.height }; }), sel);
      const shown = sel => T.page.locator(sel).first().isVisible().catch(() => false);
      const toTitle = async () => { await T.page.waitForSelector('[data-testid="title-screen"]', { timeout: 4000 }).catch(() => {}); return shown('[data-testid="title-screen"]'); };
      row(await shown('[data-testid="title-screen"]') && !(await shown(".hcard")) && !(await shown("nav.tabs")), P + ": the title is the first screen (no hero grid, no tabs yet)");
      const modes = await tb(".tmode"), more = await tb(".tmore button"), sw = await T.page.evaluate(() => document.scrollingElement.scrollWidth);
      const overlap = modes.some((m, i) => i && m.y < modes[i - 1].b - 0.5);
      row(modes.length === 4 && more.length === 4 && [...modes, ...more].every(m => m.h >= 44 && m.x >= 0 && m.r <= tw + 0.5) && !overlap && sw <= tw, P + ": four modes and four more (Your record, v7.00), each thumb-sized, separate, no sideways scroll", JSON.stringify({ n: modes.length, more: more.length, min: Math.min(...[...modes, ...more].map(m => Math.round(m.h))), sw }));
      row(/Train against the Dummy/i.test(modes[0].t) && /Play the AI/i.test(modes[1].t) && /Find an opponent/i.test(modes[2].t) && /Two phones/i.test(modes[3].t) && (await shown('[data-testid="format-note"]')), P + ": the modes are named plainly and the format note moved here");
      for (const id of ["dummy", "ai"]) {
        await T.page.locator('[data-testid="mode-' + id + '"]').click();
        await T.page.waitForSelector(".hcard", { timeout: 6000 }).catch(() => {});
        row(await shown(".hcard") && !(await shown('[data-testid="title-screen"]')) && (await T.page.locator("[data-mode]").first().getAttribute("data-mode").catch(() => null)) === id, P + ": " + id + " opens the hero grid in that mode");
        const tt = (await tb('[data-testid="to-title"]'))[0];
        row(!!tt && tt.h >= 44, P + ": the hero grid has a thumb-sized way back to the title", tt && Math.round(tt.h) + "px");
        await T.page.locator('[data-testid="to-title"]').click().catch(() => {});
        row(await toTitle(), P + ": " + id + " -> Back returns to the title");
      }
      for (const [id, want, notWant] of [["online", /Server table/i, /Direct table|Judge's table/i], ["direct", /Direct table[\s\S]*Judge's table/i, /Server table/i]]) {
        await T.page.locator('[data-testid="mode-' + id + '"]').click();
        await T.page.waitForSelector(".tblwrap", { timeout: 6000 }).catch(() => {});
        const body = await T.page.locator(".tblwrap").innerText().catch(() => "");
        row(want.test(body) && !notWant.test(body), P + ": " + id + " opens its half of the table screen");
        await T.page.locator(".tblwrap > .bigbtn.alt", { hasText: /^Back$/ }).click().catch(() => {});
        row(await toTitle(), P + ": " + id + " -> Back returns to the title");
      }
      await T.page.locator('[data-testid="more-judge"]').click();
      await T.page.waitForSelector("nav.tabs", { timeout: 4000 }).catch(() => {});
      row(await shown("nav.tabs") && !(await shown('[data-testid="title-screen"]')), P + ": Judge's quiz opens the judge tab");
      await T.page.locator('[data-testid="to-title"]').click().catch(() => {});
      row(await toTitle(), P + ": the judge tab has a way back to the title");
      await T.page.locator('[data-testid="how-btn"]').click();
      await T.page.waitForSelector(".howsheet", { timeout: 4000 }).catch(() => {});
      row(await shown(".howsheet"), P + ": How to play opens its sheet from the title");
      /* THE MODE MEETS THE OPPONENT STEP (CEO join, 2026-11-25): the Dummy door's Battle goes straight to the throw;
         the Play the AI door's Battle opens the opponent step with a hero already drawn and named, before the sideboard. */
      await T.page.locator(".howsheet .bigbtn").first().click().catch(() => {});
      const battleFrom = async (id) => {
        if (!(await toTitle())) { await T.page.locator(".foestep .screennav button", { hasText: "back" }).click().catch(() => {}); await T.page.locator('[data-testid="to-title"]').click().catch(() => {}); await toTitle(); }
        await T.page.locator('[data-testid="mode-' + id + '"]').click({ timeout: 4000 }).catch(() => {});
        await T.page.waitForSelector(".hcard", { timeout: 6000 }).catch(() => {});
        await T.page.locator(".hgrid .hcard").nth(0).click().catch(() => {});
        const b = T.page.getByRole("button", { name: /^Battle$/ });
        await b.waitFor({ timeout: 15000 }).catch(() => {});
        for (let k = 0; k < 40 && await b.isDisabled().catch(() => true); k++) await T.page.waitForTimeout(250);
        await b.click({ timeout: 4000 }).catch(() => {});
        await T.page.waitForSelector(".foestep, .rps", { timeout: 8000 }).catch(() => {});
      };
      await battleFrom("dummy");
      row(await shown(".rps") && !(await shown(".foestep")), P + ": the Dummy door's Battle skips the opponent step and goes to the throw");
      await T.page.locator(".rps .rback").first().click().catch(() => {});
      await T.page.waitForSelector(".hcard", { timeout: 4000 }).catch(() => {});
      row(await shown(".hcard") && !(await shown(".foestep")), P + ": and Back from that throw returns to the hero grid, not the step");
      await T.page.locator('[data-testid="to-title"]').click().catch(() => {});
      await battleFrom("ai");
      row(await shown(".foestep") && (await T.page.locator('.aifoe button[aria-label="The Dummy"]').count()) === 0 && (await T.page.locator('.aifoe button[aria-label="A random hero"]').count()) === 1 && (await T.page.locator(".aifoe button").count()) > 2, P + ": the Play the AI door's opponent step offers no Dummy tile");
      row(await T.page.evaluate(() => { const g = document.querySelector(".aifoe"); const bs = [...g.querySelectorAll("button")].map(b => b.getBoundingClientRect()); return bs.every(r => r.left >= 0 && r.right <= innerWidth + .5) && document.documentElement.scrollWidth <= innerWidth + 1 && bs[0].left === Math.min(...bs.map(r => r.left)); }), P + ": the grid stays tidy without the Dummy tile");
      const rv = await T.page.evaluate(() => { const e = document.querySelector(".foereveal"); return { key: e && e.getAttribute("data-foe"), text: e ? e.innerText : "" }; });
      row(await shown(".foestep") && rv.key && rv.key !== "dummy" && /drawn at random/.test(rv.text), P + ": the Play the AI door's Battle opens the opponent step with a random hero already named", JSON.stringify(rv));
      row(T.errors.length === 0, P + ": no page errors", T.errors.join(" | "));
      T.errors.forEach(e => errors.push(P + ": " + e));
      await T.close();
    }

    const sw = errors.slice();
    if(sw.length){ console.log("\nPAGE ERRORS (" + sw.length + "):"); sw.forEach(e => console.log("  " + e)); }
    const bad = rows.filter(r => !r.ok).length;
    console.log(`\n${bad || sw.length ? "FAIL" : "PASS"}  ${rows.length - bad}/${rows.length} screens clean, ${sw.length} page error(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await kit.close();
    process.exit(bad || sw.length ? 1 : 0);
  })().catch(e => { console.log("FAIL  " + (e && e.stack || e)); process.exit(1); });
}
