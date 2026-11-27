#!/usr/bin/env node
/* ============================================================
   THE CRESCENDO DRIVE — play.html (the release UI) in Chromium AND WebKit at the phone sizes that matter,
   asserting on element boxes, never on screenshots (docs/crescendo/FRAMEWORK.md 5, PHONE.md).

   WHAT IT PROVES, per engine x viewport
     phone     no horizontal scroll; nothing scrolls (scrollHeight == innerHeight; scrollTo leaves scrollY 0); the stage is
               exactly the visible height; visualViewport.scale is 1
     touch     every interactive element is at least 44 x 44 and inside the viewport (a hand card is judged by its row)
     type      life totals are the largest computed font on screen; no text under 11 px
     BOX MATCH the live resting table (a real local game, taken to the start of its third turn) is held to
               docs/crescendo/mockups/table-1-rest.html?noframe at the SAME viewport: every [data-b] box the mockup has
               exists live, with x / y / w / h within 2 px. Duplicate names pair by order (life, life); the hand's cards
               pair by position (the mockup names them by card). DIFFERENCES lists what is deliberately not compared.
   Viewports (visible CSS px): 375x548 (SE with toolbars), 393x660 (iPhone with toolbars), 430x932 (Pro Max), 393x852.

   RUN       node tools/ui-drive.js [--chromium-only] [--verbose] [--find-seed [max]] [--shots <dir>]
   DEPS      outside the repo, which keeps ZERO dependencies. PAGE_DEPS names the directory (see tools/page.js):
               npm install --prefix "$PAGE_DEPS" --save-exact htm@3.1.1 @fontsource/big-shoulders-display \
                 @fontsource/spline-sans @fontsource/spline-sans-mono @fontsource/caveat
             tools/page.js's router answers the CDN, the fonts and the art; play.html asks nothing else of the network.
             `playwright` must resolve (NODE_PATH). PW_CHROMIUM names a Chromium binary.
   WEBKIT    require('playwright').webkit with the binary at the pw_run.sh under /opt/pw-webkit/webkit-<build>/ (PW_WEBKIT overrides).
             Absent, the run says so LOUDLY and FAILS: a drill that did not run on WebKit is not a pass.
             --chromium-only is the knowing way past it.
   EXIT      0 all PASS; 1 any FAIL or a missing WebKit.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { makeAnswer, depsDir } = require("./page");

const ROOT = path.join(__dirname, "..");
const PLAY = path.join(ROOT, "play.html");
const MOCKUP = path.join(ROOT, "docs", "crescendo", "mockups", "table-1-rest.html");
const VIEWPORTS = [[375, 548], [393, 660], [430, 932], [393, 852]];
const TOL = 2;                                   /* px, the brief's box tolerance */
const MATCH = { hero: "iyslander", foe: "viserai", seed: "2", pace: 0 };   /* mockup 1's cast; the seed is what --find-seed picks (the first deal whose turn-3 table shows every zone the mockup does) */

/* ---------- the deal: reach the start of turn 3 at rest (the mockup's turn), the same way in node and in the page ---------- */

/* Both seats play the AI policy (Sharp, as the page's AI seat does) from the opening to the start of turn 3, with the
   player's seat 0 choosing for itself and the AI seat answering inside submit (pace 0). Pure over {state, submit}. */
const ADVANCE_SRC = `(function(env, s){
  const J = env.DawnJudge, S = env.DawnSparring;
  for(let i = 0; i < 600; i++){
    const st = s.state();
    if(st.over) return "over";
    if(st.turn >= 3 && st.turnPlayer === 0 && st.phase === "action" && J.waitingOn(st) === 0 && !(st.chain || []).length) return "rest";
    const seat = J.waitingOn(st);
    if(seat !== 0) return "waiting on seat " + seat;
    const a = S.act(st, 0, {search: true});
    if(!a) return "no action";
    const why = s.submit(a);
    if(why) return "refused: " + why;
  }
  return "no rest reached";
})`;

/* what the mockup's T1 needs to find in the live state, so that its names exist */
function needs(v){
  const full = sd => (sd.gear || []).length === 5 && sd.grave.length > 0 && !!sd.arsenal;
  return {
    gear: v.sides.every(sd => (sd.gear || []).length === 5), gy: v.sides.every(sd => sd.grave.length > 0),
    arsenal: v.sides.every(sd => !!sd.arsenal), hand4: v.sides.every(sd => sd.hand.length === 4), ok: v.sides.every(full) && v.sides.every(sd => sd.hand.length === 4)
  };
}

function nodeEnv(){
  const W = require("../test/helpers/extract").loadData();
  const env = { ...W, DAWN_POOL: require("../data/pool.js") };
  global.window = global; Object.assign(global, W);
  for(const [k, f] of Object.entries({ DawnCards: "cards", DawnGame: "game", DawnBuild: "build", DawnJudge: "judge", DawnSparring: "sparring",
      DawnLocal: "local", DawnView: "view" })) env[k] = require("../engine/" + f + ".js");
  return env;
}

/* node-side seed search: the first seed whose turn-3 table has every name the mockup shows (both arsenals, both graveyards,
   five pieces of gear each, four cards in each hand) */
function findSeed(max){
  const env = nodeEnv(), S = require("../ui/session.js"), advance = eval(ADVANCE_SRC);
  let best = null;
  for(let n = 1; n <= max; n++){
    const d = S.deal({ hero: MATCH.hero, foe: MATCH.foe, seed: String(n), first: 0 }, env);
    let state = d.state;
    const how = advance(env, { state: () => state, submit: a => {
      const o = env.DawnJudge.reduce(state, a, 0); if(o.error) return o.error; state = o.state;
      /* the AI seat answers, unpaced, exactly as DawnLocal does */
      for(let k = 0; k < 400 && !state.over; k++){
        const b = env.DawnSparring.act(state, 1, { search: true }); if(!b) break;
        const o2 = env.DawnJudge.reduce(state, b, 1); if(o2.error) break; state = o2.state;
      }
      return null; } });
    const nd = how === "rest" ? needs(env.DawnView.view(state, 0)) : null;
    process.stdout.write(`seed ${n}: ${how}${nd ? " " + JSON.stringify(nd) : ""}\n`);
    if(nd && nd.ok) return String(n);
    if(nd && (!best || Object.values(nd).filter(Boolean).length > best[1])) best = [String(n), Object.values(nd).filter(Boolean).length];
  }
  return best && best[0];
}

/* ---------- the browsers ---------- */

function webkitBinary(){
  if(process.env.PW_WEBKIT) return fs.existsSync(process.env.PW_WEBKIT) ? process.env.PW_WEBKIT : null;
  try {
    const dir = fs.readdirSync("/opt/pw-webkit").filter(d => /^webkit-/.test(d)).sort().reverse();
    for(const d of dir){ const f = path.join("/opt/pw-webkit", d, "pw_run.sh"); if(fs.existsSync(f)) return f; }
  } catch(e){}
  return null;
}

async function launch(pw, engine){
  if(engine === "chromium") return pw.chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  return pw.webkit.launch({ executablePath: webkitBinary() });
}

/* one page at a viewport; every external request answered locally (tools/page.js), anything unrouted is an error */
async function openPage(pw, browser, engine, vp, url, errors){
  const ctxOpts = engine === "webkit"
    ? { ...pw.devices["iPhone 15"], viewport: { width: vp[0], height: vp[1] }, screen: { width: vp[0], height: vp[1] } }
    : { viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const answer = makeAnswer(depsDir());
  const seen = new Set();
  const fail = m => { if(!seen.has(m)){ seen.add(m); errors.push(m); } };
  page.on("pageerror", e => fail("pageerror: " + String(e && e.stack || e).split("\n").slice(0, 2).join(" | ")));
  page.on("console", m => { if(m.type() === "error") fail("console.error: " + m.text()); });
  await context.route(/^https?:/, route => {
    const req = route.request(), r = answer(req.url(), req.resourceType());
    if(r.error) fail(r.error);
    route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body, headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto(url);
  return { page, context };
}

const settle = page => page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
});

/* ---------- what is measured in a page (runs in the browser) ---------- */

const MEASURE = () => {
  const out = { boxes: [], text: [], tap: [], doc: {} };
  const seenName = {};
  document.querySelectorAll("[data-b]").forEach(e => {
    const r = e.getBoundingClientRect(), n = e.getAttribute("data-b");
    const k = (seenName[n] = (seenName[n] || 0) + 1) - 1;
    out.boxes.push({ n, k, x: r.left, y: r.top, w: r.width, h: r.height });
  });
  const vis = e => { const cs = getComputedStyle(e); return cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0; };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for(let t = walk.nextNode(); t; t = walk.nextNode()){
    const s = t.nodeValue.trim(), p = t.parentElement;
    if(!s || !p || !vis(p) || p.closest("svg,script,style")) continue;
    out.text.push({ s: s.slice(0, 24), px: parseFloat(getComputedStyle(p).fontSize), cls: p.className && p.className.baseVal === undefined ? String(p.className) : "" });
  }
  const W = innerWidth, H = innerHeight;
  document.querySelectorAll("a[href], button, [data-tap], [role=button]").forEach(e => {
    if(!vis(e)) return;
    const row = e.closest(".handrow"), r = e.getBoundingClientRect(), box = row ? row.getBoundingClientRect() : r;
    out.tap.push({ n: e.getAttribute("data-b") || e.className || e.tagName, w: r.width, h: r.height, ew: row ? 0 : r.width,
      inside: box.left >= -0.5 && box.top >= -0.5 && box.right <= W + 0.5 && box.bottom <= H + 0.5 && (!row || r.left >= box.left - 0.5) });
  });
  const de = document.documentElement, st = document.querySelector(".stage"), vv = window.visualViewport;
  window.scrollTo(0, 50);
  out.doc = { sw: de.scrollWidth, sh: de.scrollHeight, bsw: document.body.scrollWidth, bsh: document.body.scrollHeight, W, H, sy: window.scrollY,
    stageH: st ? st.getBoundingClientRect().height : null, vvH: vv ? vv.height : H, scale: vv ? vv.scale : 1,
    band: de.getAttribute("data-band"), vh: de.style.getPropertyValue("--vh") };
  window.scrollTo(0, 0);
  return out;
};

/* ---------- the assertions ---------- */

function judgePhone(m){
  const bad = [], d = m.doc;
  if(d.sw > d.W || d.bsw > d.W) bad.push(`horizontal scroll (${d.sw}/${d.bsw} > ${d.W})`);
  if(d.sh !== d.H || d.bsh > d.H) bad.push(`the page scrolls (scrollHeight ${d.sh}/${d.bsh} vs innerHeight ${d.H})`);
  if(d.sy !== 0) bad.push(`scrollTo moved the page (scrollY ${d.sy})`);
  if(d.stageH == null || Math.abs(d.stageH - d.vvH) > 1) bad.push(`stage height ${d.stageH} != visible height ${d.vvH}`);
  if(d.scale !== 1) bad.push(`visualViewport.scale ${d.scale}`);
  m.tap.forEach(t => {
    if(t.w < 43.5 || t.h < 43.5) bad.push(`tap target "${t.n}" is ${t.w.toFixed(1)}x${t.h.toFixed(1)} (< 44)`);
    if(!t.inside) bad.push(`tap target "${t.n}" is outside the viewport`);
  });
  const life = m.text.filter(t => /\blife\b/.test(t.cls)), mx = Math.max(...m.text.map(t => t.px));
  if(life.length !== 2) bad.push(`${life.length} life totals on screen`);
  life.forEach(t => { if(t.px < mx - 0.01) bad.push(`life "${t.s}" ${t.px}px is not the largest type (${mx}px)`); });
  m.text.filter(t => t.px < 11).forEach(t => bad.push(`text "${t.s}" is ${t.px}px (< 11)`));
  return { bad, note: `${m.tap.length} taps, ${m.text.length} texts, life ${life.map(t => t.px)[0]}px, band ${d.band}` };
}

/* the mockup names its hand cards by card; live names are by position */
const norm = (boxes, hand) => boxes.map(b => /^hand-/.test(b.n) ? { ...b, n: "hand-#" + (hand.i = (hand.i == null ? -1 : hand.i) + 1), k: 0 } : b);

function judgeBoxes(live, mock){
  const L = norm(live.boxes, {}), Mk = norm(mock.boxes, {});
  const key = b => b.n + "#" + b.k, byKey = new Map(L.map(b => [key(b), b]));
  const liveHand = L.filter(b => /^hand-#/.test(b.n)).length;
  const bad = [], diffs = [];
  let worst = 0, worstName = "", n = 0;
  Mk.forEach(m => {
    const l = byKey.get(key(m));
    if(!l){
      const hi = /^hand-#(\d+)$/.exec(m.n);
      if(hi && +hi[1] >= liveHand){ diffs.push(`${m.n}: the mockup deals six cards, this deal holds ${liveHand} (a hero's intellect is 4; the 5th card cut at the edge is the scroll cue and needs a hand of five or more)`); return; }
      bad.push(`${key(m)} missing live`); return;
    }
    n++;
    const d = Math.max(Math.abs(l.x - m.x), Math.abs(l.y - m.y), Math.abs(l.w - m.w), Math.abs(l.h - m.h));
    if(d > worst){ worst = d; worstName = key(m); }
    if(d > TOL) bad.push(`${key(m)} off by ${d.toFixed(1)} px  live [${[l.x, l.y, l.w, l.h].map(v => v.toFixed(1))}] mock [${[m.x, m.y, m.w, m.h].map(v => v.toFixed(1))}]`);
  });
  return { bad, diffs, worst, worstName, n };
}

/* ---------- one engine x viewport ---------- */

async function runCase(pw, browser, engine, vp, seed, opts){
  opts = opts || {};
  const errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  let live, mock;
  try {
    const q = `?hero=${MATCH.hero}&foe=${MATCH.foe}&seed=${seed}&pace=0`;
    const a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors);
    await a.page.waitForSelector(".stage .bout", { timeout: 15000 });
    const how = await a.page.evaluate(`(${ADVANCE_SRC})(window, window.DawnUIApp.session())`);
    if(how !== "rest") res.bad.push("the deal did not reach the resting table: " + how);
    await settle(a.page);
    live = await a.page.evaluate(MEASURE);
    res.ua = await a.page.evaluate(() => navigator.userAgent.replace(/^Mozilla\/5.0 /, "").slice(0, 60));
    if(opts.shots){ fs.mkdirSync(opts.shots, { recursive: true }); await a.page.screenshot({ path: path.join(opts.shots, `live-${engine}-${vp[0]}x${vp[1]}.png`) }); }
    res.state = await a.page.evaluate(() => { const s = DawnUIApp.session(), v = DawnView.view(s.state(), 0); return { turn: v.turn, hand: v.sides[0].hand.length, foeHand: v.sides[1].hand.length,
      gy: v.sides.map(x => x.grave.length), ars: v.sides.map(x => !!x.arsenal), gear: v.sides.map(x => x.gear.length) }; });
    await a.context.close();
    const b = await openPage(pw, browser, engine, vp, pathToFileURL(MOCKUP).href + "?noframe", errors);
    await b.page.waitForSelector(".stage .bout", { timeout: 15000 });
    await settle(b.page);
    mock = await b.page.evaluate(MEASURE);
    if(opts.shots) await b.page.screenshot({ path: path.join(opts.shots, `mock-${engine}-${vp[0]}x${vp[1]}.png`) });
    await b.context.close();
  } catch(e){ res.bad.push("drive error: " + String(e && e.message || e).split("\n")[0]); }
  if(live){
    const p = judgePhone(live); res.bad.push(...p.bad); res.notes.push(p.note);
    if(mock){
      const j = judgeBoxes(live, mock); res.bad.push(...j.bad); res.diffs = j.diffs;
      res.notes.push(`${j.n} boxes, worst ${j.worst.toFixed(2)} px (${j.worstName})`);
    }
  }
  errors.forEach(e => res.bad.push(e));
  return res;
}

async function main(){
  const argv = process.argv.slice(2);
  if(argv.includes("--find-seed")){
    const s = findSeed(+(argv[argv.indexOf("--find-seed") + 1]) || 60);
    console.log(s ? "SEED " + s : "no seed found");
    return process.exit(s ? 0 : 1);
  }
  let pw;
  try { pw = require("playwright"); } catch(e){ console.error("tools/ui-drive.js needs `playwright` (set NODE_PATH, or run where require('playwright') resolves)"); return process.exit(1); }
  const seed = MATCH.seed;
  const engines = ["chromium"];
  let failed = false;
  if(!argv.includes("--chromium-only")){
    if(webkitBinary()) engines.push("webkit");
    else {
      console.log("\n######## WEBKIT DID NOT RUN ########\n  no WebKit binary: pw_run.sh under /opt/pw-webkit/webkit-<build>/ is absent (PW_WEBKIT names one).\n  A drill that did not run on WebKit is NOT a pass. Install it (see FRAMEWORK.md 1.1) or pass --chromium-only knowingly.\n####################################\n");
      failed = true;
    }
  }
  console.log(`play.html, seed ${seed}, ${MATCH.hero} vs ${MATCH.foe}; mockup ${path.relative(ROOT, MOCKUP)}`);
  const diffsSeen = new Set(), rows = [];
  for(const engine of engines){
    const browser = await launch(pw, engine);
    try {
      for(const vp of VIEWPORTS){
        const r = await runCase(pw, browser, engine, vp, seed, { shots: argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : null });
        rows.push(r);
        if(r.bad.length) failed = true;
        console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${vp[0]}x${vp[1]}  ${r.notes.join(" · ")}`);
        r.bad.slice(0, argv.includes("--verbose") ? 999 : 12).forEach(b => console.log("        " + b));
        r.diffs.forEach(d => { if(!diffsSeen.has(d)){ diffsSeen.add(d); } });
        if(argv.includes("--verbose") && r.state) console.log("        state " + JSON.stringify(r.state) + " · " + r.ua);
      }
    } finally { await browser.close(); }
  }
  if(diffsSeen.size){ console.log("\nDIFFERENCES (deliberately not compared):"); [...diffsSeen].forEach(d => console.log("  - " + d)); }
  process.exit(failed ? 1 : 0);
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { judgePhone, judgeBoxes, norm, ADVANCE_SRC, needs };
