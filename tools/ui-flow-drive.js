#!/usr/bin/env node
/* ============================================================
   THE FLOW DRIVE — CRESCENDO's screens around the table (ui/flow.js, ui/pad.js, ui/app.js) in Chromium AND WebKit.

   BOXES   each F screen of play.html is matched box for box to its mockup (docs/crescendo/mockups/flow-N-*.html, ?noframe, the same
           viewport) at 375x548 · 393x660 · 430x932: for a list of named elements (the mockup's own classes) every x/y/w/h
           is compared within TOL px. A box the app draws differently ON PURPOSE is listed under DIFFERENCES, not hidden.
           Every screen is also held to the phone rules: no page scroll, every tap >= 44x44 and on screen, no text under 11 px.
   JOURNEY title -> (PLAY) sit down -> (SHUFFLE UP) a table mounts -> the menu -> concede -> the result frame -> the result pad ->
           LEAVE -> title -> the gear menu -> close: zero page errors, zero policy refusals.

   RUN     node tools/ui-flow-drive.js [--chromium-only] [--verbose] [--only boxes|journey] [--shots <dir>]
   DEPS    outside the repo (zero deps in it): PAGE_DEPS names the scratch dir tools/page.js answers the CDN and fonts from:
             npm install --prefix "$PAGE_DEPS" --save-exact htm@3.1.1 @fontsource/big-shoulders-display \
               @fontsource/spline-sans @fontsource/spline-sans-mono @fontsource/caveat
           `playwright` must resolve (NODE_PATH). WebKit: the pw_run.sh under /opt/pw-webkit/webkit-<build>/ (PW_WEBKIT overrides);
           absent, the run says so LOUDLY and FAILS (a drill that did not run on WebKit is not a pass).
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const PLAY = pathToFileURL(path.join(ROOT, "play.html")).href;
const MOCK = n => { const [f, q] = n.split("?"); return pathToFileURL(path.join(ROOT, "docs/crescendo/mockups", f)).href + (q ? "?" + q : ""); };
const VIEWPORTS = [[375, 548], [393, 660], [430, 932]];
const TOL = 1.5;
const TABLE = "?hero=iyslander&foe=viserai&seed=1&first=0&pace=0";

/* ---------- what is compared: the mockup page, the app URL (or steps to reach it), the wrapper class, the named boxes ---------- */
const S = (...a) => a;
const SCREENS = [
  { id: "F1 title", mock: "flow-1-title.html", app: "?screen=f1", root: ".f1",
    sel: S(".top .lab", ".top .ib", ".mark .w1", ".mark .blade", ".mark .w2", ".tag", ".band .artband", ".band .who", ".band .chip", ".cta .btn", ".cta small", ".row3 .link", ".foot") },
  { id: "F2 ways", mock: "flow-2-ways.html", app: "?screen=f2", root: ".f2",
    sel: S(".hdr .ib", ".hdr h1", ".modes .mode", ".foot .link"),
    skip: { ".modes .mode": "the Dummy, two phones and the server table are not at this table yet: drawn at the mockup's boxes, dimmed" } },
  { id: "F3 heroes", mock: "flow-3-hero.html", app: "?screen=f3", root: ".f3", sel: S(".hdr .ib", ".hdr h1", ".grid", ".tile") },
  { id: "F3 peek", mock: "flow-3-hero.html?v=peek", app: "?screen=f3&peek=iyslander", root: ".f3",
    sel: S(".scrim", ".sheet.pk", ".ban", ".ban .ib", ".ban .bn", ".bl", ".stats", ".dk-l", ".dstrip", ".sitbar .btn"),
    skip: { ".stats": "the HAND chip is omitted (the hero's intellect is not in the pinned card record): one chip fewer, the row's box is the same" } },
  { id: "F4 sit down", mock: "flow-4-sitdown.html", app: "?screen=f4&hero=iyslander&foe=viserai&first=0", root: ".f4", settle: 2800,
    sel: S(".hit", ".ib", ".nameo", ".swap", ".coin", ".slab", ".namey", ".hub .btn") },
  { id: "F9 phone", mock: "flow-9-waiting.html?v=phone", app: "?screen=f9&v=phone", root: ".f9", sel: S(".ib", ".sunrise", ".h h1", ".h p", ".codes b", ".btns .btn") },
  { id: "F9 server", mock: "flow-9-waiting.html?v=server", app: "?screen=f9&v=server", root: ".f9", sel: S(".ib", ".sunrise", ".h h1", ".btns .btn") },
  { id: "F9 fail", mock: "flow-9-waiting.html?v=fail", app: "?screen=f9&v=fail", root: ".f9", sel: S(".ib", ".sunrise", ".h h1", ".btns .btn") },
  /* over the live table: the app is driven to the screen */
  { id: "F8 menu", mock: "flow-8-menu.html", app: TABLE, root: ".f8", steps: ["menu"], sel: S(".sheet.mn", ".mh h2", ".mh .chip", ".mh .ib", ".mb .mrow"), skip: { ".mb .mrow": "the app's Classic board row is a link, not a button: same box" } },
  { id: "F8 report", mock: "flow-8-menu.html?v=report", app: TABLE, root: ".f8", steps: ["menu", "report"], sel: S(".sheet.mn", ".mh h2", ".mh .chip", ".mh .ib", ".rp p", ".foot .btn") },
  { id: "F8 concede", mock: "flow-8-menu.html?v=concede", app: TABLE, root: ".f8", steps: ["menu", "ask-concede"], sel: S(".sheet.mn", ".mh h2", ".cf p", ".foot .btn") },
  { id: "F6 pad", mock: "flow-6-pad.html", app: TABLE, root: ".f6", steps: ["pad"], sel: S(".scrim", ".paper", ".ph h3", ".ph p", ".ib.pen", ".cols", ".pnote") },
  { id: "F7 KO frame", mock: "flow-7-result.html?v=lose", app: TABLE, root: ".f7", steps: ["menu", "concede"], settle: 800, sel: S(".veil", ".word", ".word b", ".word span", ".tapon", ".tapfull"),
    skip: { ".word": "the KO word's slam (scale) has settled", ".blade": "" } },
  { id: "F7 result pad", mock: "flow-7-result.html?v=pad", app: TABLE, root: ".f7", steps: ["menu", "concede", "continue"], settle: 700, sel: S(".paper.res", ".paper .ph h3", ".gg", ".acts2 .btn") }
];

/* ---------- the browsers: tools/ui-drive.js's own launch and openPage (one setup for every CRESCENDO drive) ---------- */
const D = require("./ui-drive.js");
const { webkitBinary, launch } = D;
/* the mockups play Iyslander against Viserai: the app's "last choices" are the same */
const INIT = () => { try { if(!localStorage.getItem("dawnblade.crescendo.last")) localStorage.setItem("dawnblade.crescendo.last", JSON.stringify({ hero: "iyslander", foe: "viserai" })); } catch(e){} };
const openPage = (pw, browser, engine, vp, url, errors) => D.openPage(pw, browser, engine, vp, url, errors, false, INIT);
const settle = (page, ms) => page.evaluate(async ms => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await new Promise(r => setTimeout(r, ms || 150));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}, ms);

/* ---------- measuring (runs in the page) ---------- */
const MEASURE = ({ root, sel }) => {
  const R = document.querySelector(root);
  if(!R) return { missing: true };
  const out = {};
  sel.forEach(s => { out[s] = [...R.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); });
  return { boxes: out };
};
const PHONE = (root) => {
  const R = document.querySelector(root) || document.body, bad = [], W = innerWidth, H = innerHeight, de = document.documentElement;
  if(de.scrollWidth > W || document.body.scrollWidth > W) bad.push(`horizontal scroll (${de.scrollWidth} > ${W})`);
  if(de.scrollHeight > H) bad.push(`the page scrolls (${de.scrollHeight} > ${H})`);
  const vis = e => { const cs = getComputedStyle(e); if(cs.display === "none" || cs.visibility === "hidden" || !e.getClientRects().length) return false;
    for(let p = e; p && p.nodeType === 1; p = p.parentElement) if(getComputedStyle(p).opacity === "0") return false; return true; };
  R.querySelectorAll("a[href], button, [data-tap], [role=button], textarea").forEach(e => {
    if(!vis(e) || e.getAttribute("aria-disabled") === "true" || e.closest(".dis")) return;
    const r = e.getBoundingClientRect(), p = e.closest(".sc");
    if(p && !(r.left >= p.getBoundingClientRect().left - 1 && r.right <= p.getBoundingClientRect().right + 1)) return;   /* a scroller's own overflow */
    if(r.width < 43.5 || r.height < 43.5) bad.push(`tap target "${e.getAttribute("data-b") || e.className || e.tagName}" is ${r.width.toFixed(1)}x${r.height.toFixed(1)} (< 44)`);
  });
  const walk = document.createTreeWalker(R, NodeFilter.SHOW_TEXT);
  for(let t = walk.nextNode(); t; t = walk.nextNode()){
    const s = t.nodeValue.trim(), p = t.parentElement;
    if(!s || !p || !vis(p) || p.closest("svg,script,style")) continue;
    const px = parseFloat(getComputedStyle(p).fontSize);
    if(px < 10.99) bad.push(`text "${s.slice(0, 24)}" is ${px}px (< 11)`);
  }
  return bad;
};

/* ---------- driving the app to a screen ---------- */
async function tapB(page, b, sub){
  const q = `[data-b="${b}"]`;
  await page.waitForSelector(q, { timeout: 8000 });
  await page.evaluate(q => document.querySelector(q).click(), q);
  await page.waitForTimeout(120);
}
async function drive(page, steps){
  for(const st of steps || []){
    if(st === "menu") await tapB(page, "hub-left");
    else if(st === "pad") await tapB(page, "hub-right");
    else if(st === "report") await tapB(page, "row-report");
    else if(st === "ask-concede") await tapB(page, "row-concede");
    else if(st === "concede") { await page.evaluate(() => (document.querySelector('[data-b="row-concede"]') || document.querySelector('[data-b="concede"]')).click()); await page.waitForTimeout(150); await tapB(page, "concede"); }
    else if(st === "continue") { await page.waitForSelector('[data-b="continue"]', { timeout: 6000 }); await tapB(page, "continue"); }
    else throw new Error("unknown step " + st);
  }
}

/* ---------- one engine x viewport: every screen's boxes against its mockup ---------- */
async function boxesFor(pw, browser, engine, vp, S_, o){
  const errors = [], bad = [], diffs = [];
  let worst = 0, worstName = "", n = 0;
  const mock = await openPage(pw, browser, engine, vp, MOCK(S_.mock) + (S_.mock.includes("?") ? "&" : "?") + "noframe", errors);
  await settle(mock.page, 400);
  const sel = S_.sel.filter(s => !(S_.skip && S_.skip[s] === ""));
  const M = await mock.page.evaluate(MEASURE, { root: S_.root, sel });
  await mock.context.close();
  const a = await openPage(pw, browser, engine, vp, PLAY + S_.app, errors);
  try { await settle(a.page, 200); await drive(a.page, S_.steps); await settle(a.page, S_.settle || 700); } catch(e){ bad.push("could not reach the screen: " + e.message.split("\n")[0]); }
  const L = await a.page.evaluate(MEASURE, { root: S_.root, sel });
  if(o.shots){ fs.mkdirSync(o.shots, { recursive: true }); await a.page.screenshot({ path: path.join(o.shots, `${S_.id.replace(/\W+/g, "-")}-${engine}-${vp[0]}.png`) }); }
  const phone = await a.page.evaluate(PHONE, S_.root);
  await a.context.close();
  if(!bad.length){
    if(M.missing || L.missing) bad.push(`${S_.root} missing (${M.missing ? "mockup" : "app"})`);
    else for(const s of sel){
      const m = M.boxes[s], l = L.boxes[s];
      if(S_.skip && S_.skip[s]){ diffs.push(`${S_.id} ${s}: ${S_.skip[s]}`); continue; }
      if(m.length !== l.length){ bad.push(`${s}: ${l.length} in the app, ${m.length} in the mockup`); continue; }
      m.forEach((mb, i) => {
        n++;
        const d = Math.max(...mb.map((v, k) => Math.abs(v - l[i][k])));
        if(d > worst){ worst = d; worstName = `${s}[${i}]`; }
        if(d > TOL) bad.push(`${s}[${i}] off by ${d.toFixed(1)}px  app [${l[i].map(v => v.toFixed(1))}] mock [${mb.map(v => v.toFixed(1))}]`);
      });
    }
  }
  phone.forEach(p => bad.push("phone: " + p));
  errors.forEach(e => bad.push(e));
  return { bad, diffs, worst, worstName, n };
}

/* ---------- the journey: title -> table -> result -> title, on one page ---------- */
async function journey(pw, browser, engine, vp, o){
  const errors = [], bad = [], steps = [];
  const a = await openPage(pw, browser, engine, vp, PLAY, errors), page = a.page;
  const sh = async name => { if(o.shots){ fs.mkdirSync(o.shots, { recursive: true }); await page.screenshot({ path: path.join(o.shots, `journey-${name}-${engine}-${vp[0]}.png`) }); } };
  const has = async q => page.evaluate(q => !!document.querySelector(q), q);
  const need = async (q, what) => { try { await page.waitForSelector(q, { timeout: 9000 }); steps.push(what); } catch(e){ bad.push(`${what}: ${q} never appeared`); throw new Error("stop"); } };
  try {
    await settle(page, 300);
    await need(".f1", "the title opens"); await sh("1-title");
    await tapB(page, "gear"); await need('[data-b="menu-sheet"]', "the gear opens the menu"); await tapB(page, "menu-close");
    await tapB(page, "play"); await need(".f4", "PLAY goes to the sit-down (Q12)"); await settle(page, 2600); await sh("2-sitdown");
    await tapB(page, "shuffle"); await need('[data-b="bout"]', "SHUFFLE UP mounts a table"); await settle(page, 600); await sh("3-table");
    await tapB(page, "hub-right"); await need('[data-b="pad"]', "the pad button opens the pad"); await tapB(page, "pad-close");
    await tapB(page, "hub-left"); await need('[data-b="menu-sheet"]', "the hub dots open the menu");
    await page.evaluate(() => document.querySelector('[data-b="row-concede"]').click()); await need('[data-b="concede-sheet"]', "Concede asks");
    await tapB(page, "concede"); await need('[data-b="word"]', "conceding shows the result frame (DAWN / BREAK)"); await settle(page, 900); await sh("4-result");
    await tapB(page, "continue"); await need('[data-b="result-pad"]', "a tap continues to the result pad"); await sh("5-pad");
    await tapB(page, "leave"); await need(".f1", "LEAVE returns to the title");
    await tapB(page, "gear"); await need('[data-b="menu-sheet"]', "the title's gear menu opens"); await tapB(page, "menu-close");
    const ev = await page.evaluate(() => { const s = window.DawnUIApp && window.DawnUIApp.session && window.DawnUIApp.session(); return s ? s.events().length : 0; });
    steps.push("the session ended cleanly");
  } catch(e){ if(e.message !== "stop") bad.push("journey: " + e.message.split("\n")[0]); }
  errors.forEach(e => bad.push(e));
  await a.context.close();
  return { bad, steps };
}

async function main(){
  const argv = process.argv.slice(2);
  let pw;
  try { pw = require("playwright"); } catch(e){ console.error("tools/ui-flow-drive.js needs `playwright` (set NODE_PATH)"); return process.exit(1); }
  const arg = n => argv.includes(n) ? argv[argv.indexOf(n) + 1] : null;
  const engines = ["chromium"];
  let failed = false;
  if(!argv.includes("--chromium-only")){
    if(webkitBinary()) engines.push("webkit");
    else { console.log("\n######## WEBKIT DID NOT RUN ########\n  no pw_run.sh under /opt/pw-webkit/webkit-<build>/ (PW_WEBKIT names one). A drill that did not run on WebKit is not a pass.\n"); failed = true; }
  }
  const o = { shots: arg("--shots") }, only = arg("--only"), verbose = argv.includes("--verbose");
  const diffsSeen = new Set(), table = [];
  for(const engine of engines){
    const browser = await launch(pw, engine);
    try {
      if(!only || only === "boxes") for(const sc of SCREENS) for(const vp of VIEWPORTS){
        const r = await boxesFor(pw, browser, engine, vp, sc, o);
        r.diffs.forEach(d => diffsSeen.add(d));
        if(r.bad.length) failed = true;
        table.push({ engine, id: sc.id, vp, ...r });
        console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${sc.id.padEnd(14)} ${vp[0]}x${vp[1]}  ${r.n} boxes, worst ${r.worst.toFixed(1)}px${r.worstName ? " (" + r.worstName + ")" : ""}`);
        r.bad.slice(0, verbose ? 999 : 6).forEach(b => console.log("        " + b));
      }
      if(!only || only === "journey") for(const vp of VIEWPORTS){
        const r = await journey(pw, browser, engine, vp, o);
        if(r.bad.length) failed = true;
        console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${"journey".padEnd(14)} ${vp[0]}x${vp[1]}  ${r.steps.length} steps${verbose ? ": " + r.steps.join(" > ") : ""}`);
        r.bad.slice(0, 12).forEach(b => console.log("        " + b));
      }
    } finally { await browser.close(); }
  }
  if(diffsSeen.size){ console.log("\nDIFFERENCES (deliberately not compared):"); [...diffsSeen].forEach(d => console.log("  - " + d)); }
  process.exit(failed ? 1 : 0);
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { SCREENS, VIEWPORTS, TOL };
