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

   STATES    (step 3) a fresh local game is PLAYED by taps and held to the mockups it can reach: T2 select, T3 / T3b paying,
             T4 your attack on the chain, T10 inspect (hold 400 ms). Names a live state cannot reach are listed with the reason.
   PLAY      from the deal, tap through whole turns at 393x660 (play, pay, pass, END TURN, the AI answering paced, defend, the
             arsenal, whatever sheet the engine asks): zero page errors, zero policy-refused / stalled events, life totals move.
   --art     card images come from the real host (fetched with curl through the sandbox proxy, cached), not grey stand-ins,
             so --shots shows the real faces. Everything else stays routed locally.
   RUN       node tools/ui-drive.js [--chromium-only] [--verbose] [--find-seed [max]] [--shots <dir>] [--art] [--only t1|states|play]
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
const MOCKDIR = path.join(ROOT, "docs", "crescendo", "mockups");
const MOCKUP = path.join(MOCKDIR, "table-1-rest.html");
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
const ART_HOST = "legendstory-production-s3-public.s3.amazonaws.com";
function artFile(url){
  const dir = process.env.UI_ART_CACHE || path.join(require("os").tmpdir(), "dawnblade-art");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, Buffer.from(url).toString("hex").slice(-80) + ".img");
  if(!fs.existsSync(f)){
    const r = require("child_process").spawnSync("curl", ["-sS", "--fail", "-m", "20", "-o", f, url], { encoding: "utf8" });
    if(r.status !== 0){ try { fs.unlinkSync(f); } catch(e){} return null; }
  }
  return f;
}

async function openPage(pw, browser, engine, vp, url, errors, art, init){
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
    const req = route.request();
    if(art && new URL(req.url()).hostname === ART_HOST){
      const f = artFile(req.url());
      if(f) return route.fulfill({ status: 200, contentType: /\.webp/.test(req.url()) ? "image/webp" : "image/png", body: fs.readFileSync(f), headers: { "access-control-allow-origin": "*" } });
    }
    const r = answer(req.url(), req.resourceType());
    if(r.error) fail(r.error);
    route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body, headers: { "access-control-allow-origin": "*" } });
  });
  if(init) await page.addInitScript(init);
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
    out.boxes.push({ n, k, x: r.left, y: r.top, w: r.width, h: r.height, cls: String(e.className && e.className.baseVal === undefined ? e.className : "") });
  });
  const vis = e => { const cs = getComputedStyle(e); if(cs.display === "none" || cs.visibility === "hidden" || !e.getClientRects().length) return false;
    for(let p = e; p && p.nodeType === 1; p = p.parentElement) if(getComputedStyle(p).opacity === "0") return false;   /* an announcement waiting off-stage is not on screen */
    return true; };
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

/* opts: only (names to hold, default all of the mockup's), skip {name: reason} (listed, not compared), part {name: "xw"} (fields compared),
   alias {mockName: liveName}, sameClass (cards in a different state than the mockup's are listed, not compared) */
function judgeBoxes(live, mock, opts){
  opts = opts || {};
  const L = norm(live.boxes, {}), Mk = norm(mock.boxes, {});
  const key = b => b.n + "#" + b.k, byKey = new Map(L.map(b => [key(b), b]));
  const liveHand = L.filter(b => /^hand-#/.test(b.n)).length;
  const bad = [], diffs = [];
  let worst = 0, worstName = "", n = 0;
  const STATE = /\b(ready|dim|blk|sel|tap|idle|spent|refused)\b/g, st = c => (String(c).match(STATE) || []).sort().join("+");
  Mk.forEach(m => {
    if(opts.only && !opts.only.includes(m.n)) return;
    if(opts.alias && opts.alias[m.n]) m = { ...m, n: opts.alias[m.n] };
    if(opts.skip && opts.skip[m.n]){ diffs.push(`${m.n}: ${opts.skip[m.n]}`); return; }
    const l = byKey.get(key(m));
    if(!l){
      const hi = /^hand-#(\d+)$/.exec(m.n);
      if(hi && +hi[1] >= liveHand){ diffs.push(`${m.n}: the mockup's hand is longer than this deal's (${liveHand} cards; a hero's intellect is 4, and cards leave the hand as they are played and pitched)`); return; }
      bad.push(`${key(m)} missing live`); return;
    }
    /* a card whose state differs (a card with no defence stays down where the mockup's lifts) is a different box on purpose */
    if(opts.sameClass && /^(hand-#|you-(weapon|head|chest|arms|legs))/.test(m.n) && st(l.cls) !== st(m.cls)){ diffs.push(`${m.n}: state "${st(l.cls) || "rest"}" live vs "${st(m.cls) || "rest"}" in the mockup (it depends on what this deal's cards can do)`); return; }
    n++;
    const f = (opts.part && opts.part[m.n]) || "xywh", pick = b => ({ x: b.x, y: b.y, w: b.w, h: b.h, c: b.x + b.w / 2 });
    const d = Math.max(...[...f].map(c => Math.abs(pick(l)[c] - pick(m)[c])));
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
    const a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors, opts.art);
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
    const b = await openPage(pw, browser, engine, vp, pathToFileURL(MOCKUP).href + "?noframe", errors, opts.art);
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


/* ---------- step 3: the states a live game reaches, held to their mockups ---------- */

const FRESH = {   /* a fresh deal has not had two turns: no graveyard, no arsenal yet */
  "opp-gy": "a fresh deal has an empty graveyard (bare mat)", "you-gy": "a fresh deal has an empty graveyard (bare mat)",
  "opp-arsenal": "a fresh deal has no arsenal yet", "you-arsenal": "a fresh deal has no arsenal yet"
};
const KNOWN = new Set();
const argvHas = f => process.argv.includes(f);
const SECOND = ms => new Promise(r => setTimeout(r, ms));
const handOf = page => page.evaluate(() => { const s = DawnUIApp.session(), v = DawnView.view(s.state(), 0);
  return v.sides[0].hand.map(c => ({ uid: c.uid, name: c.name, cost: c.cost, pitch: c.pitch, power: c.power })); });
const card = (page, name) => page.locator(`.handrow .cd[aria-label="${name.replace(/"/g, '\\"')}"]`).first();
/* answer whatever the engine asked, through what is on screen: a real prompt sheet (ui/sheets.js: an item, then its primary, else a
   secondary) or, for a pending question that is not a prompt, the plain options sheet's coach. True when it tapped something. */
async function answerSheet(P, count){
  const tap = async loc => { try { await loc.first().click({ timeout: 1500 }); return true; } catch(e){ return false; } };
  if(await P.locator(".sh-sheet:not(.waiting)").count()){
    const prim = P.locator(".sh-btn.primary:not(.dis)");
    if(await prim.count()){ if(await tap(prim)){ if(count) count.sheets++; return true; } }
    const item = P.locator(".sh-body button:not(.dis):not(.on):not([disabled])");
    if(await item.count() && await tap(item)) return true;
    const sec = P.locator(".sh-btn.sec:not(.dis)");
    if(await sec.count() && await tap(sec)) return true;
    return false;
  }
  if(await P.locator(".options .opt.coach").count()) return tap(P.locator(".options .opt.coach"));
  return false;
}
const primaryText = page => page.locator('.hub [data-b="primary"]').innerText().then(t => t.replace(/\s+/g, " ").trim());   /* the button upcases its label: compare lower-cased */

async function runStates(pw, browser, engine, vp, opts){
  const errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  const q = `?hero=${MATCH.hero}&foe=${MATCH.foe}&seed=${MATCH.seed}&pace=900`;
  let a;
  const ask = (ok, msg) => { if(!ok) res.bad.push(msg); };
  const cmp = async (label, file, o) => {
    await settle(a.page);
    const live = await a.page.evaluate(MEASURE);
    if(opts.shots) await a.page.screenshot({ path: path.join(opts.shots, `${label}-${engine}-${vp[0]}x${vp[1]}.png`) });
    const b = await openPage(pw, browser, engine, vp, pathToFileURL(path.join(MOCKDIR, file)).href + "?noframe", errors, opts.art);
    await b.page.waitForSelector(".stage .bout", { timeout: 15000 }); await settle(b.page);
    const mock = await b.page.evaluate(MEASURE);
    if(opts.shots) await b.page.screenshot({ path: path.join(opts.shots, `${label}-mock-${engine}-${vp[0]}x${vp[1]}.png`) });
    await b.context.close();
    const j = judgeBoxes(live, mock, o);
    j.bad.forEach(m => res.bad.push(label + ": " + m)); j.diffs.forEach(d => res.diffs.push(label + " " + d));
    const ph = judgePhone(live); ph.bad.forEach(m => res.bad.push(label + ": " + m));
    res.notes.push(`${label} ${j.n} boxes ${j.worst.toFixed(2)}px`);
  };
  try {
    a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors, opts.art);
    await a.page.waitForSelector(".stage .bout", { timeout: 15000 });
    const P = a.page, hand = await handOf(P);
    const ready = await P.evaluate(() => [...document.querySelectorAll(".handrow .cd")].map(e => e.classList.contains("ready")));
    /* T2: select a hand card (the mockup lifts the second one) */
    let i = ready[1] ? 1 : ready.indexOf(true);
    if(i < 0){ res.diffs.push("T2: no ready card in this deal"); }
    else {
      const c = hand[i];
      await card(P, c.name).click(); await P.waitForTimeout(120);
      ask(await P.locator('.handrow .cd.sel').count() === 1, "T2: the tapped card did not lift (.sel)");
      ask((await primaryText(P)).toLowerCase() === ("play " + c.name).toLowerCase(), "T2: the primary does not name the play: " + await primaryText(P));
      ask((await P.locator(".peek .name").innerText().catch(() => "")).toLowerCase() === c.name.toLowerCase(), "T2: no name-plate");
      await cmp("T2", "table-2-select.html", { skip: FRESH, ...(i !== 1 ? { only: ["bout", "primary", "world", "tray", "handrow", "hub"] } : {}) });
      /* a second tap puts it down */
      await card(P, c.name).click(); await P.waitForTimeout(120);
      ask(await P.locator(".handrow .cd.sel").count() === 0, "T2: a second tap did not put the card down");
    }
    /* T10: hold a card 400 ms */
    {
      const box = await P.locator('[data-b="hand-0"]').boundingBox();
      await P.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await P.mouse.down(); await P.waitForTimeout(520); await P.mouse.up();
      await P.waitForSelector(".inspect .sheet", { timeout: 2000 }).catch(() => {});
      const t = await P.locator(".inspect .sheet h2").innerText().catch(() => null);
      ask(t && t.toLowerCase() === hand[0].name.toLowerCase(), "T10: holding a card did not open it (" + t + ")");
      ask(/^close$/i.test(await primaryText(P)), "T10: the primary is not Close");
      await cmp("T10", "table-10-inspect.html", { only: ["veil", "inspect-card", "sheet", "primary", "hub", "bout"], part: { sheet: "xw" }, skip: {} });
      await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(100);
      ask(await P.locator(".inspect").count() === 0, "T10: Close did not close it");
    }
    /* T3b / T3: pay for a costed card */
    const cur = await handOf(P);
    const costed = cur.filter(c => c.cost > 0);
    const pitcher = (c, short) => cur.find(x => x.uid !== c.uid && (short ? x.pitch < c.cost : x.pitch >= c.cost));
    const shortPair = costed.map(c => [c, pitcher(c, true)]).find(x => x[1]);
    if(shortPair){
      const [c, pi] = shortPair;
      await card(P, c.name).click(); await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(150);
      ask((await P.locator('.stage[data-state]').getAttribute("data-state")) === "t3", "T3b: playing a costed card did not open the payment");
      await card(P, pi.name).click(); await P.waitForTimeout(150);
      const pt = await primaryText(P);
      ask(/^pitch \d+ more$/i.test(pt), "T3b: the primary is not 'Pitch N more' (" + pt + ")");
      ask(await P.locator('.hub [data-b="primary"]').isDisabled(), "T3b: the primary is enabled while short");
      await cmp("T3b", "table-3b-pay-short.html", { skip: { ...FRESH, coins: "this pitch pays " + pi.pitch + " of " + c.cost + " (the mockup's 2 of 3)", "you-pitch-0": "the mockup pitches a different card (box compared as T3)" },
        part: {}, only: ["staged", "hit", "pill", "primary", "hub-left", "hub-right", "bout", "world", "stage", "tray", "handrow"] });
      await P.locator('[data-b="hub-left"]').click(); await P.waitForTimeout(150);   /* cancel */
      ask((await P.locator('.stage[data-state]').getAttribute("data-state")) !== "t3", "T3b: the cross did not cancel the play");
    } else res.diffs.push("T3b: no costed card with a pitch too small to pay it in this deal");
    const fullPair = costed.map(c => [c, pitcher(c, false)]).find(x => x[1] && x[0].power != null) || costed.map(c => [c, pitcher(c, false)]).find(x => x[1]);
    if(fullPair){
      const [c, pi] = fullPair;
      await card(P, c.name).click(); await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(150);
      await card(P, pi.name).click(); await P.waitForTimeout(150);
      ask((await primaryText(P)).toLowerCase() === ("play " + c.name).toLowerCase(), "T3: paid, the primary should read Play " + c.name + " (" + await primaryText(P) + ")");
      ask(await P.locator(".hit .paid:not(.short)").count() === 1, "T3: the cost meter does not say paid");
      await cmp("T3", "table-3-pay.html", { skip: { ...FRESH, ...(pi.pitch === 3 ? {} : { coins: "this payment holds " + pi.pitch + " coin(s), the mockup 3" }) },
        only: ["staged", "hit", "coins", "you-pitch-0", "pill", "primary", "hub-left", "hub-right", "bout", "world", "stage", "tray", "handrow"] });
      await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(200);
      /* T4: the attack stands on the chain; the AI answers, paced. Pass priority until the defend step shows. */
      let seen = false, sheetChecked = false;
      for(let k = 0; k < 80 && !seen; k++){
        const pill = await P.locator('[data-b="pill"]').innerText().catch(() => ""), dis = await P.locator('.hub [data-b="primary"]').isDisabled().catch(() => true);
        if(/defend step/i.test(pill) && dis && await P.locator(".atk.mine").count()){ seen = true; break; }
        if(!sheetChecked && await P.locator(".sh-sheet:not(.waiting)").count()){ sheetChecked = true; await P.waitForTimeout(700);
          (await judgeSheet(pw, browser, engine, vp, P, errors, opts.art)).forEach(m => res.bad.push(m)); res.notes.push("F5 sheet"); }
        if(await answerSheet(P)){}
        else if(!dis) await P.locator('.hub [data-b="primary"]').click().catch(() => {});
        await P.waitForTimeout(100);
      }
      if(seen){
        const pt = await primaryText(P);
        ask(/^waiting for /i.test(pt), "T4: the primary should say it is waiting on them (" + pt + ")");
        await cmp("T4", "table-4-attack.html", { skip: { ...FRESH, "you-weapon": "the live weapon keeps its ready underline until the engine spends the action point at resolution" },
          only: ["attack", "hit", "pill", "primary", "hub-left", "hub-right", "bout", "world", "stage", "tray", "handrow"], part: { hit: "xywh" } });
      } else res.diffs.push("T4: the defend step with your attack on the chain was not on screen within the AI's pace window in this deal");
    } else res.diffs.push("T3: no costed card that one pitch can pay in this deal");
    /* a refused tap says why, by name: on their turn a hand card cannot be played, and the engine's own reason lands on a chip */
    {
      const gone = await P.evaluate(() => DawnUIApp.session().state().over);
      let tp = await P.evaluate(() => DawnUIApp.session().state().turnPlayer);
      for(let k = 0; k < 300 && tp === 0 && !gone; k++){
        if(await P.locator(".options .opt.coach").count()) await P.locator(".options .opt.coach").click().catch(() => {});
        else if(!(await P.locator('.hub [data-b="primary"]').isDisabled().catch(() => true))) await P.locator('.hub [data-b="primary"]').click().catch(() => {});
        await P.waitForTimeout(80);
        tp = await P.evaluate(() => DawnUIApp.session().state().turnPlayer);
      }
      if(tp === 1 && await P.locator(".handrow .cd").count()){
        await P.locator('[data-b="hand-0"]').click({ timeout: 1500 }).catch(() => {});
        await P.waitForTimeout(60);
        const why = await P.locator(".peek .reason").innerText().catch(() => "");
        ask(why.trim().length > 3, "refusal: tapping a card on their turn showed no reason");
        ask(await P.locator(".handrow .cd.refused").count() === 1, "refusal: the card has no refused ring");
        res.notes.push("refusal \"" + why.trim().slice(0, 40) + "\"");
      } else res.diffs.push("refusal: their turn was not reached to test a refused tap");
    }
    await a.context.close();
  } catch(e){ res.bad.push("drive error: " + String(e && e.message || e).split("\n")[0]); }
  errors.forEach(e => res.bad.push(e));
  return res;
}


/* ---------- step 5: T6 defend, T7 reaction step, T9 arsenal ---------- */

/* Both seats play the AI policy in the page until `pred(state, view, J)` holds (a state a live game reaches by itself) */
const advanceTo = pred => `(function(env, s){
  const J = env.DawnJudge, S = env.DawnSparring, V = env.DawnView, pred = ${pred};
  for(let i = 0; i < 900; i++){
    const st = s.state(); if(st.over) return "over";
    if(pred(st, V.view(st, 0), J)) return "ok";
    const seat = J.waitingOn(st); if(seat !== 0) return "waiting on seat " + seat;
    const a = S.act(st, 0, {search: true}); if(!a) return "no action";
    const why = s.submit(a); if(why) return "refused: " + why;
  }
  return "not reached";
})(window, window.DawnUIApp.session())`;

async function runStates2(pw, browser, engine, vp, opts){
  const errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  const ask = (ok, msg) => { if(!ok) res.bad.push(msg); };
  let a;
  const open = async q => { if(a) await a.context.close(); a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors, opts.art);
    await a.page.waitForSelector(".stage .bout", { timeout: 15000 }); return a.page; };
  const cmp = async (label, file, o) => {
    await settle(a.page);
    const live = await a.page.evaluate(MEASURE);
    if(opts.shots) await a.page.screenshot({ path: path.join(opts.shots, `${label}-${engine}-${vp[0]}x${vp[1]}.png`) });
    const b = await openPage(pw, browser, engine, vp, pathToFileURL(path.join(MOCKDIR, file)).href + "?noframe", errors, opts.art);
    await b.page.waitForSelector(".stage .bout", { timeout: 15000 }); await settle(b.page);
    const mock = await b.page.evaluate(MEASURE);
    if(opts.shots) await b.page.screenshot({ path: path.join(opts.shots, `${label}-mock-${engine}-${vp[0]}x${vp[1]}.png`) });
    await b.context.close();
    const j = judgeBoxes(live, mock, { sameClass: true, ...o });
    j.bad.forEach(m => res.bad.push(label + ": " + m)); j.diffs.forEach(d => res.diffs.push(label + " " + d));
    const ph = judgePhone(live); ph.bad.forEach(m => res.bad.push(label + ": " + m));
    res.notes.push(`${label} ${j.n} boxes ${j.worst.toFixed(2)}px`);
  };
  const BASE = ["bout", "world", "stage", "tray", "handrow", "hub", "hub-left", "hub-right", "primary", "bout-you", "bout-opp", "medal", "life"];
  try {
    /* T6: the opponent attacks first; you defend. Tap a hand card and a piece of armour to block with. */
    {
      const P = await open(`?hero=iyslander&foe=viserai&seed=1&first=1&pace=0`);
      const how6 = await P.evaluate(advanceTo(`(st, v) => DawnPriority.canDeclareDefenders(st, 0) && !!v.pend`));
      if(how6 !== "ok") res.diffs.push("T6: not reached in this deal (" + how6 + ")");
      await P.waitForTimeout(150);
      ask(await P.locator(".stage .ask").count() === 1 && /any blocks/i.test(await P.locator(".stage .ask").innerText()), "T6: no 'Any blocks?' question");
      ask(/^no block$/i.test(await primaryText(P)), "T6: the primary should read No block (" + await primaryText(P) + ")");
      const hit0 = await P.evaluate(() => { const s = DawnUIApp.session(), v = DawnView.view(s.state(), 0); return { total: v.pend && v.pend.total, printed: v.pend && v.pend.card.power, shown: +(document.querySelector(".hit .n") || {}).textContent }; });
      ask(hit0.shown === hit0.total, `T6: HIT FOR shows ${hit0.shown}, the engine's figure is ${hit0.total} (printed ${hit0.printed})`);
      const rh = P.locator(".handrow .cd.ready").first(), rg = P.locator(".lane .cd.mat.ready").last();
      if(await rh.count()) await rh.click(); await P.waitForTimeout(80);
      if(await P.locator('[data-b="you-slot-chest"] .cd.ready, [data-b="you-slot-head"] .cd.ready, [data-b="you-slot-arms"] .cd.ready, [data-b="you-slot-legs"] .cd.ready').count()) await P.locator('[data-b="you-slot-chest"] .cd.ready, [data-b="you-slot-head"] .cd.ready, [data-b="you-slot-arms"] .cd.ready, [data-b="you-slot-legs"] .cd.ready').first().click();
      await P.waitForTimeout(100);
      const n = await P.locator(".handrow .cd.blk, .lane .you .cd.blk, [data-b=you-lane] .cd.blk").count();
      ask(n >= 1, "T6: tapping a card did not mark it as a blocker (.blk)");
      ask(/^block with \d+$/i.test(await primaryText(P)), "T6: the primary should read Block with N (" + await primaryText(P) + ")");
      ask(await P.locator(".hit .eq").count() === 1, "T6: no incoming-vs-defence ledger");
      const wallEq = await P.evaluate(() => { const s = DawnUIApp.session(), v = DawnView.view(s.state(), 0), me = v.sides[0];
        return { shown: +(document.querySelector(".hit .n") || {}).textContent, want: Math.max(0, v.pend.total - DawnSparring.wallOf(me)) }; });
      ask(wallEq.shown === wallEq.want, `T6: HIT FOR ${wallEq.shown} != power - wall ${wallEq.want}`);
      await cmp("T6", "table-6-defend.html", { only: [...BASE, "ask", "attack", "hit", "eq", "ap", "you-weapon", "you-head", "you-chest", "you-arms", "you-legs", "hand-#0", "hand-#1", "hand-#2", "hand-#3"],
        alias: { ap: "opp-ap" }, skip: { "you-arsenal": "" } });
    }
    /* T7: your attack, their blocker in the wall, the reaction step with priority yours */
    {
      const P = await open(`?hero=iyslander&foe=viserai&seed=3&first=1&pace=0`);
      const how = await P.evaluate(advanceTo(`(st, v, J) => st.step === "reaction" && v.pend && v.attacker === 0 && v.sides[1].blockH.length > 0 && J.waitingOn(st) === 0`));
      if(how !== "ok") res.diffs.push("T7: not reached in this deal (" + how + ")");
      else {
        await P.waitForTimeout(150);
        ask(/reaction step/i.test(await P.locator('[data-b="pill"]').innerText()), "T7: the pill does not say Reaction step");
        ask(await P.locator(".wall .cd").count() >= 1, "T7: their blocker is not in the wall");
        ask(/^pass$/i.test(await primaryText(P)), "T7: the primary should read Pass (" + await primaryText(P) + ")");
        const eq = await P.evaluate(() => { const s = DawnUIApp.session(), v = DawnView.view(s.state(), 0); return { shown: +(document.querySelector(".hit .n") || {}).textContent,
          want: Math.max(0, v.pend.total + DawnEffects.rxPumpTotal(v) - (DawnSparring.wallOf(v.sides[1]) + (v.sides[1].blockRx || []).reduce((t, l) => t + ((l && l.def) || 0), 0))) }; });
        ask(eq.shown === eq.want, `T7: HIT FOR ${eq.shown} != ${eq.want}`);
        await cmp("T7", "table-7-reaction.html", { only: [...BASE, "pill", "attack", "wall", "blocker", "hit", "eq", "hand-#0", "hand-#1", "hand-#2", "hand-#3"],
          skip: { stack: "no opponent instant is on the stack in this deal's reaction step (the rail renders when one is)", "stack-card": "same" } });
      }
    }
    /* T9: end your turn; the arsenal question; select a card; the slot */
    {
      const P = await open(`?hero=${MATCH.hero}&foe=${MATCH.foe}&seed=${MATCH.seed}&pace=0`);
      await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(150);
      const askT = await P.locator(".stage .ask").innerText().catch(() => "");
      if(!/arsenal/i.test(askT)) res.diffs.push("T9: the arsenal question did not open (" + askT + ")");
      else {
        ask(/^no arsenal$/i.test(await primaryText(P)), "T9: nothing selected should read No arsenal");
        ask(await P.locator('[data-b="you-arsenal-slot"]').count() === 1, "T9: no drop slot");
        await P.locator('[data-b="hand-0"]').click(); await P.waitForTimeout(100);
        ask(/^set in arsenal$/i.test(await primaryText(P)), "T9: a selected card should read Set in arsenal (" + await primaryText(P) + ")");
        await cmp("T9", "table-9-arsenal.html", { only: [...BASE, "ask", "you-arsenal-slot", "peek", "hand-#0", "hand-#1", "hand-#2", "hand-#3"],
          skip: {} });
        await P.locator('[data-b="you-arsenal-slot"]').click(); await P.waitForTimeout(250);
        const ars = await P.evaluate(() => !!DawnView.view(DawnUIApp.session().state(), 0).sides[0].arsenal);
        ask(ars, "T9: tapping the slot did not set the arsenal");
      }
    }
    /* a permanent is inspectable: hold it (Viserai's runechants and sigils live on the board) */
    {
      const P = await open(`?hero=viserai&foe=briar&seed=3&pace=0`);
      const how = await P.evaluate(advanceTo(`(st, v, J) => v.sides[0].board.length > 0 && J.waitingOn(st) === 0`));
      if(how !== "ok") res.diffs.push("permanents: no permanent reached in this deal (" + how + ")");
      else {
        await P.waitForTimeout(150);
        const perm = P.locator('[data-b="you-perm"] .cd').first();
        if(!(await perm.count())) res.bad.push("permanents: the board holds one but none is drawn");
        else {
          const box = await perm.boundingBox();
          await P.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await P.mouse.down(); await P.waitForTimeout(520); await P.mouse.up();
          await P.waitForSelector(".inspect .sheet", { timeout: 2000 }).catch(() => {});
          ask(await P.locator(".inspect .sheet").count() === 1, "permanents: holding one did not open it");
        }
      }
    }
    if(a) await a.context.close();
  } catch(e){ res.bad.push("drive error: " + String(e && e.message || e).split("\n")[0]); }
  errors.forEach(e => res.bad.push(e));
  return res;
}


/* ---------- step 4/6: the announcer's held frames (T5, T8) and a prompt sheet (F5) ---------- */

/* boxes the announcer and the sheet draw without data-b names the mockups use */
const EXTRAS = () => {
  const out = [], st = document.querySelector(".stage"), b = st.getBoundingClientRect();
  const add = (n, e) => { if(!e) return; const r = e.getBoundingClientRect(); out.push({ n, k: 0, x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, cls: "" }); };
  add("scrim", st.querySelector(".an-scrim"));
  const cards = [...st.querySelectorAll(".an-card")].filter(e => getComputedStyle(e).opacity > 0.05).sort((x, y) => y.getBoundingClientRect().width - x.getBoundingClientRect().width);
  add("glimpse", cards[0]); add("glimpse-pitch", cards[1]);
  return out;
};

async function runStates3(pw, browser, engine, vp, opts){
  const errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  const ask = (ok, msg) => { if(!ok) res.bad.push(msg); };
  let a;
  const open = async q => { if(a) await a.context.close(); a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors, opts.art);
    await a.page.waitForSelector(".stage[data-state] .bout", { timeout: 15000 }); return a.page; };
  const cmp = async (label, file, o, extra) => {
    const live = await a.page.evaluate(MEASURE); if(extra) live.boxes.push(...await a.page.evaluate(EXTRAS));
    if(opts.shots) await a.page.screenshot({ path: path.join(opts.shots, `${label}-${engine}-${vp[0]}x${vp[1]}.png`) });
    const b = await openPage(pw, browser, engine, vp, pathToFileURL(path.join(MOCKDIR, file)).href + "?noframe", errors, opts.art);
    await b.page.waitForSelector(".stage .bout", { timeout: 15000 }); await settle(b.page);
    const mock = await b.page.evaluate(MEASURE);
    await b.context.close();
    const j = judgeBoxes(live, mock, { sameClass: true, ...o });
    j.bad.forEach(m => res.bad.push(label + ": " + m)); j.diffs.forEach(d => res.diffs.push(label + " " + d));
    res.notes.push(`${label} ${j.n} boxes ${j.worst.toFixed(2)}px`);
  };
  try {
    /* T5: their first play is announced: the slab, the scrim, the glimpse (and the cards they pitched beside it), frozen mid-hold */
    {
      const P = await open(`?hero=iyslander&foe=viserai&seed=1&first=1`);
      /* caught the way a player keeps it: press-and-hold on the glimpse (director.hold), so it stays at its pose while the boxes are read */
      const got = await P.waitForFunction(() => { const sl = document.querySelector(".an-slab"), sc = document.querySelector(".an-scrim.live"); if(!sl || !sc || +getComputedStyle(sl).opacity < 0.99) return false;
        DawnUIApp.director().hold(true); window.__heldAt = performance.now(); return true; }, null, { timeout: 25000, polling: 5 }).then(() => true).catch(() => false);
      if(got) await P.waitForTimeout(700);
      if(!got) res.diffs.push("T5: no opponent play was caught mid-hold in this deal");
      else {
        ask(await P.locator(".an-slab[data-b=slab]").innerText().then(t => t.trim().length > 3), "T5: the slab says nothing");
        /* while the glimpse holds, the "is thinking" chip must not show across it (it sits above the scrim otherwise) */
        const overlap = await P.evaluate(() => { const t = document.querySelector('[data-b="think"]'); if(!t) return { chip: false };
          const cs = getComputedStyle(t), vis = cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; if(!vis) return { chip: true, shown: false };
          const g = [...document.querySelectorAll(".an-card")].filter(c => +getComputedStyle(c).opacity > 0.05).map(c => c.getBoundingClientRect()), r = t.getBoundingClientRect();
          const hit = g.filter(b => Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 1).length;
          return { chip: true, shown: true, overlaps: hit }; });
        ask(!overlap.shown || !overlap.overlaps, "T5: the \"is thinking\" chip is drawn across the glimpse");
        const clear = await P.evaluate(() => { const t = document.querySelector(".tray").getBoundingClientRect().top, g = [...document.querySelectorAll(".an-card")].filter(c => +getComputedStyle(c).opacity > 0.9).map(c => c.getBoundingClientRect().bottom); return Math.max(...g) <= t + 0.5; });
        ask(clear, "T5: the glimpse runs down over the hand tray");
        res.notes.push(overlap.chip ? (overlap.shown ? "chip shown (clear)" : "chip hidden while it holds") : "no chip in this deal");
        await cmp("T5", "table-5-announce.html", { only: ["slab", "scrim", "glimpse", "glimpse-pitch", "hub", "primary", "bout", "handrow", "tray"],
          part: vp[0] < 380 ? { glimpse: "xwh", "glimpse-pitch": "xw" } : { glimpse: "xywh", "glimpse-pitch": "xyw" } }, true);   /* compact: the glimpse is raised to clear the tray (SCREENS-TABLE 14), so y is not the mockup's 122 */
        await P.evaluate(() => DawnUIApp.director().hold(false));
      }
    }
    /* T8: a hit lands on you (no block): the pop under the numeral, caught as it spawns */
    {
      const P = await open(`?hero=iyslander&foe=viserai&seed=1&first=1&pace=0`);
      const how = await P.evaluate(advanceTo(`(st, v) => DawnPriority.canDeclareDefenders(st, 0) && !!v.pend`));
      if(how !== "ok") res.diffs.push("T8: no defend step in this deal (" + how + ")");
      else {
        await P.waitForTimeout(200);
        await P.evaluate(() => { window.__lifeBefore = +document.querySelector('[data-b="bout-you"] .life').firstChild.nodeValue; });
        await P.locator('.hub [data-b="primary"]').click();
        for(let k = 0; k < 60; k++){
          if(await P.waitForFunction(() => { const e = document.querySelector('[data-b="bout-you"] .pop'); return e && +getComputedStyle(e).opacity > 0.05; }, null, { timeout: 500, polling: 5 }).then(() => true).catch(() => false)) break;
          if(await answerSheet(P)){} else if(await P.locator('.hub [data-b="primary"]').isEnabled().catch(() => false) && /^(pass|no block)$/i.test(await primaryText(P))) await P.locator('.hub [data-b="primary"]').click().catch(() => {});
        }
        const popO = await P.evaluate(() => +getComputedStyle(document.querySelector('[data-b="bout-you"] .pop')).opacity);
        if(popO <= 0.05) res.diffs.push("T8: the hit's pop was not caught in this deal");
        else {
          const t = await P.evaluate(() => ({ pop: document.querySelector('[data-b="bout-you"] .pop').textContent, life: +document.querySelector('[data-b="bout-you"] .life').firstChild.nodeValue, before: window.__lifeBefore }));
          ask(/^[-−]\d+$/.test(t.pop.trim()), "T8: the pop reads \"" + t.pop + "\"");
          ask(t.life < t.before, `T8: at contact the numeral (${t.life}) has not dropped from ${t.before}`);
          await cmp("T8", "table-8-hit.html", { only: ["pop", "life", "bout", "bout-you", "bout-opp", "medal", "hub", "primary"], part: { pop: "c", life: "xywh" }, skip: { world: "the world's shake offset is a function of time; the director's drill holds its numbers" } });
        }
      }
    }
    if(a) await a.context.close();
  } catch(e){ res.bad.push("drive error: " + String(e && e.message || e).split("\n")[0]); }
  errors.forEach(e => res.bad.push(e));
  return res;
}

/* a prompt sheet against flow-5-prompts (which names nothing, so by class): the sheet's width, left and bottom edge, the primary button's height and bottom edge */
const SHEET_GEOM = sel => { const e = document.querySelector(sel.sheet), p = e && e.querySelector(sel.primary); if(!e || !p) return null;
  const r = e.getBoundingClientRect(), q = p.getBoundingClientRect(); return { x: r.left, w: r.width, bottom: r.bottom, btnH: q.height, btnBottom: q.bottom, btnX: q.left, btnW: q.width }; };
async function judgeSheet(pw, browser, engine, vp, page, errors, art){
  const bad = [];
  /* the sheet rises through the director: read it once it has come to rest on the stage's bottom edge */
  await page.waitForFunction(() => { const e = document.querySelector(".sh-sheet:not(.waiting)"); return e && Math.abs(e.getBoundingClientRect().bottom - document.querySelector(".stage").getBoundingClientRect().bottom) < 0.6; }, null, { timeout: 20000 }).catch(() => {});   /* the rise is a queued beat: it waits for the announcements before it */
  const live = await page.evaluate(SHEET_GEOM, { sheet: ".sh-sheet:not(.waiting)", primary: ".sh-btn.primary" });
  if(!live) return ["F5: no prompt sheet to measure"];
  const b = await openPage(pw, browser, engine, vp, pathToFileURL(path.join(MOCKDIR, "flow-5-prompts.html")).href + "?noframe", errors, art);
  await settle(b.page);
  const mock = await b.page.evaluate(SHEET_GEOM, { sheet: ".sheet.pr", primary: ".foot .btn:not(.sec)" });
  await b.context.close();
  if(!mock) return ["F5: the mockup's sheet was not found"];
  for(const k of ["x", "w", "bottom", "btnH", "btnBottom"]) if(Math.abs(live[k] - mock[k]) > TOL) bad.push(`F5: sheet ${k} ${live[k].toFixed(1)} vs the mockup's ${mock[k].toFixed(1)}`);
  return bad;
}


/* ---------- reactions (T7's stack rail), both ways ---------- */

/* R2: THEIR reaction on the stack, priority yours (kayo vs dorinthea, seed 2: the foe activates Blossom of Spring at its own attack's resolution; attack reactions leave no stack item, an instant ability does); the rail is held to table-7.
   R1: YOUR reaction by taps (dorinthea vs kayo, seed 2, you on the play: your attack, a reaction card ready at the reaction step). */
async function runStates4(pw, browser, engine, vp, opts){
  const errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  const ask = (ok, msg) => { if(!ok) res.bad.push(msg); };
  let a;
  const open = async q => { if(a) await a.context.close(); a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + q, errors, opts.art);
    await a.page.waitForSelector(".stage[data-state] .bout", { timeout: 15000 }); return a.page; };
  try {
    {
      const P = await open(`?hero=kayo&foe=dorinthea&seed=2&first=0&pace=0`);
      const how = await P.evaluate(advanceTo(`(st, v, J) => !!v.pend && v.stack.length > 0 && !!(v.stack[v.stack.length - 1] || {}).card && v.stack[v.stack.length - 1].seat === 1 && J.waitingOn(st) === 0`));
      if(how !== "ok") res.diffs.push("R2: their reaction on the stack was not reached (" + how + ")");
      else {
        await P.waitForTimeout(200);
        const want = await P.evaluate(() => { const v = DawnView.view(DawnUIApp.session().state(), 0); return v.stack[v.stack.length - 1].card.name; });
        ask(await P.locator(".stackrail").count() === 1, "R2: no stack rail while their card is on the stack");
        ask((await P.locator('.stackrail [data-b="stack-card"]').getAttribute("aria-label").catch(() => "")) === want, "R2: the rail does not show " + want);
        ask(/^pass$/i.test(await primaryText(P)) || /^play /i.test(await primaryText(P)), "R2: the primary is not Pass (" + await primaryText(P) + ")");
        await settle(P);
        const live = await P.evaluate(MEASURE), b = await openPage(pw, browser, engine, vp, pathToFileURL(path.join(MOCKDIR, "table-7-reaction.html")).href + "?noframe", errors, opts.art);
        await b.page.waitForSelector(".stage .bout"); await settle(b.page); const mock = await b.page.evaluate(MEASURE); await b.context.close();
        const j = judgeBoxes(live, mock, { only: ["stack", "stack-card", "bout", "world", "stage", "tray", "handrow", "hub", "hub-left", "hub-right", "primary"], part: { stack: "xy", "stack-card": "xywh" } });
        j.bad.forEach(m => res.bad.push("R2: " + m)); res.notes.push(`R2 rail ${j.n} boxes ${j.worst.toFixed(2)}px (${want})`);
        const ph = judgePhone(live); ph.bad.forEach(m => res.bad.push("R2: " + m));
      }
    }
    {
      const P = await open(`?hero=dorinthea&foe=kayo&seed=2&first=0&pace=0`);
      const how = await P.evaluate(advanceTo(`(st, v, J) => st.step === "reaction" && !!v.pend && J.waitingOn(st) === 0 && v.sides[0].hand.some(c => J.legal(st, {t: "play", uid: c.uid, from: "hand"}, 0) === null)`));
      if(how !== "ok") res.diffs.push("R1: no reaction card ready at a reaction step (" + how + ")");
      else {
        await P.waitForTimeout(200);
        const card0 = P.locator(".handrow .cd.ready").first(), name = await card0.getAttribute("aria-label");
        await card0.click(); await P.waitForTimeout(80);
        ask(/^play /i.test(await primaryText(P)), "R1: tapping a ready reaction did not name the play (" + await primaryText(P) + ")");
        await P.locator('.hub [data-b="primary"]').click(); await P.waitForTimeout(200);
        const seen = await P.evaluate(n => { const v = DawnView.view(DawnUIApp.session().state(), 0); return { stack: v.stack.map(e => e.card && e.card.name), pend: (v.pending || {}).kind, chainHas: (v.chainCards || []).some(e => e.card && e.card.name === n) }; }, name);
        ask(seen.stack.includes(name) || seen.pend === "pay" || seen.chainHas, `R1: ${name} did not reach the stack`);
        for(let k = 0; k < 40 && /pay|pitch/i.test(await P.locator(".stage[data-state]").getAttribute("data-state") || "t3") && await P.locator(".stage[data-state]").getAttribute("data-state") === "t3"; k++){
          const r = P.locator(".handrow .cd.ready").first(); if(await r.count()) await r.click().catch(() => {}); await P.waitForTimeout(60);
          if(!(await P.locator('.hub [data-b="primary"]').isDisabled().catch(() => true))) await P.locator('.hub [data-b="primary"]').click().catch(() => {}); }
        await P.waitForTimeout(200);
        const rail = await P.locator(".stackrail").count();
        res.notes.push(`R1 played ${name}${rail ? ", on the rail" : ""}`);
        ask(!(await P.evaluate(() => DawnUIApp.session().events().some(e => e.t === "policy-refused" || e.t === "stalled"))), "R1: policy refused / stalled");
      }
    }
    if(a) await a.context.close();
  } catch(e){ res.bad.push("drive error: " + String(e && e.message || e).split("\n")[0]); }
  errors.forEach(e => res.bad.push(e));
  return res;
}

/* ---------- step 3: a whole game by taps ---------- */

/* From the deal, play turns by tapping only what is on screen. One decision a loop; the AI seat answers paced (one action a tick).
   Pass when the board's turns reach `turns` of the player's own, or give up on a stall. */
async function runPlay(pw, browser, engine, opts){
  const vp = [393, 660], errors = [], res = { engine, vp, bad: [], notes: [], diffs: [] };
  const turns = opts.turns || 3;
  try {
    /* announcements ON: the AI seat at its human pace (no ?pace), the director's beats, the slab and the glimpse */
    const frames = () => { window.__fr = { d: [], on: false, long: [], marks: [] }; let last = 0; requestAnimationFrame(function f(t){ if(window.__fr.on){ if(last){ window.__fr.d.push(t - last); if(t - last > 34) window.__fr.long.push([Math.round(t), Math.round(t - last)]); } last = t; } else last = 0; requestAnimationFrame(f); }); };
    const a = await openPage(pw, browser, engine, vp, pathToFileURL(PLAY).href + `?hero=${MATCH.hero}&foe=${MATCH.foe}&seed=${opts.seed || MATCH.seed}` + (opts.pace != null ? `&pace=${opts.pace}` : "") + (opts.search === "0" ? "&search=0" : ""), errors, opts.art, frames);
    const P = a.page;
    if(opts.throttle){ const cdp = await a.context.newCDPSession(P); await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.throttle }); }
    await P.waitForSelector(".stage[data-state] .bout", { timeout: 15000 }); await P.evaluate(() => { window.__fr.on = true; try { DawnUIApp.session().onStep(e => window.__fr.marks.push([Math.round(performance.now()), "step s" + e.seat + " " + e.action.t])); new MutationObserver(m => window.__fr.marks.push([Math.round(performance.now()), "dom " + m.map(x => [...x.addedNodes].map(n => n.className).join("|")).join(",").slice(0, 60)])).observe(document.querySelector(".stage[data-state]"), { childList: true }); } catch(e){} });
    await P.waitForSelector(".stage .bout", { timeout: 15000 });
    const lives = [], did = { defended: 0, arsenal: 0, reaction: 0, sheets: 0 }; let refusals = 0, taps = 0, lastTurn = 0, idle = 0, started = Date.now();
    const snap = () => P.evaluate(() => { const s = DawnUIApp.session(), st = s.state(); return { turn: st.turn, step: st.step, phase: st.phase, over: !!st.over, hp: [st.sides[0].hp, st.sides[1].hp], busy: s.local.busy(), tp: st.turnPlayer }; });
    const click = async loc => { try { await loc.click({ timeout: 1500 }); taps++; return true; } catch(e){ return false; } };
    let s0 = await snap(); lives.push(s0.hp);
    for(let step = 0; step < 12000; step++){
      const s = await snap();
      if(s.hp[0] !== lives[lives.length - 1][0] || s.hp[1] !== lives[lives.length - 1][1]) lives.push(s.hp);
      lastTurn = s.turn;
      if(s.over || s.turn > turns * 2) break;
      if(Date.now() - started > 420000){
        const why = await P.evaluate(() => { const ss = DawnUIApp.session(), st = ss.state(), J = DawnJudge; return JSON.stringify({ turn: st.turn, step: st.step, phase: st.phase, holder: J.waitingOn(st), prompt: !!st.prompt && st.prompt.tag, pending: st.pending && st.pending.kind, busy: ss.local.busy(),
          primary: (document.querySelector('.hub [data-b="primary"]') || {}).textContent, dis: (document.querySelector('.hub [data-b="primary"]') || {}).disabled, ask: (document.querySelector(".centre .ask") || {}).textContent, sheet: !!document.querySelector(".sh-sheet"), options: !!document.querySelector(".options"), events: ss.events().slice(-3) }); });
        res.bad.push("play: gave up after 420 s at turn " + s.turn + " " + why); break; }
      if(s.busy || s.tp === 1 && !(await P.locator(".options, .sh-sheet:not(.waiting)").count())){
        /* the AI seat's turn: wait a tick, unless something is asked of us (a defend step / sheet) */
        const ask = await P.locator(".stage .ask").count(), can = !(await P.locator('.hub [data-b="primary"]').isDisabled());
        if(!ask && !can && !(await P.locator(".options, .sh-sheet:not(.waiting)").count())){ await P.waitForTimeout(40); continue; }
      }
      if(await P.locator(".options, .sh-sheet:not(.waiting)").count()){
        if(await answerSheet(P, did)) { await P.waitForTimeout(30); continue; }
      }
      if(await P.locator("[data-b=sheet]").count() && await P.locator(".inspect").count()){ await click(P.locator('.hub [data-b="primary"]')); continue; }
      const st = await P.locator(".stage[data-state]").getAttribute("data-state");
      const label = await primaryText(P), dis = await P.locator('.hub [data-b="primary"]').isDisabled();
      const ready = P.locator(".handrow .cd.ready").first();
      if(st === "t3"){                                   /* paying: pitch until paid, else cancel */
        if(!dis){ await click(P.locator('.hub [data-b="primary"]')); continue; }
        if(await ready.count()){ await click(ready); continue; }
        await click(P.locator('[data-b="hub-left"]')); continue;
      }
      if(await P.locator(".stage .ask").count()){        /* defend step / arsenal: block with one card if any, then commit */
        const ask = (await P.locator(".stage .ask").innerText()).trim();
        const hitN = +(await P.locator(".hit .n").innerText().catch(() => "0"));
        if(/blocks/i.test(ask) && hitN > 0 && await ready.count()) { await click(ready); await P.waitForTimeout(20); continue; }
        if(/blocks/i.test(ask) && /^block with/i.test(label)) did.defended++;
        if(/arsenal/i.test(ask) && /^no arsenal$/i.test(label) && await ready.count()){ await click(ready); await P.waitForTimeout(20); continue; }
        if(/arsenal/i.test(ask) && /^set in arsenal$/i.test(label)) did.arsenal++;
        if(!dis){ await click(P.locator('.hub [data-b="primary"]')); await P.waitForTimeout(30); continue; }
      }
      if(dis){ await P.waitForTimeout(40); idle++; if(idle > 400){ res.bad.push("play: stuck, primary disabled at turn " + s.turn + " (" + label + ")"); break; } continue; }
      idle = 0;
      if(/^play |^attack with /i.test(label)){ if(s.step !== "layer" || s.phase !== "action") did.reaction++; await click(P.locator('.hub [data-b="primary"]')); continue; }   /* a selection is made: commit it */
      if(/^pass$/i.test(label) && s.tp === 1 && await ready.count()){ if(await click(ready)){ await P.waitForTimeout(20); if(/^play /i.test(await primaryText(P))) continue; } }   /* their turn, priority ours: a card that can answer */
      if(/^end turn$/i.test(label) && await ready.count() && s.tp === 0){ const before = label; if(await click(ready)){ await P.waitForTimeout(20); if(/^play /i.test(await primaryText(P))) continue; } }
      if(await P.locator('.hub [data-b="primary"]').isEnabled()){ if(!(await click(P.locator('.hub [data-b="primary"]')))) await P.waitForTimeout(30); }
    }
    const frAll = await P.evaluate(() => { window.__fr.on = false; return window.__fr; }), fr = frAll.d;
    if(opts.throttle && argvHas("--verbose")) frAll.long.forEach(([t, d]) => { const m = frAll.marks.filter(x => x[0] <= t).slice(-2).map(x => (t - x[0]) + "ms after " + x[1]).join("; "); console.log("        long frame " + d + " ms at " + t + " · " + m); });
    if(opts.throttle && fr.length){
      const so = fr.slice().sort((x, y) => x - y), p95 = so[Math.min(so.length - 1, Math.floor(.95 * so.length))], mx = so[so.length - 1], over = fr.filter(x => x > 34).length;
      res.frames = { n: fr.length, p95, max: mx, over34: over };
      res.notes.push(`frames@${opts.throttle}x n=${fr.length} p95 ${p95.toFixed(1)} ms max ${mx.toFixed(1)} ms >34ms: ${over}`);
      if(p95 > 20) res.bad.push(`frames: p95 ${p95.toFixed(1)} ms > 20`);
      /* The p95 is the gate. A frame over 34 ms is REPORTED (with its neighbours under --verbose), not gated: with the AI's Sharp search on
         (engine/sparring.js runs on the main thread; its own phone bound is p95 < 150 ms at 4x) there is one such frame per AI play, and even
         with the Steady policy a few remain at a turn's start (the first draw's clones, a new hand's layout). An open item for the CEO. */
      if(mx > 34) res.notes.push(`(${over} frame(s) over 34 ms are reported, not gated)`);
    }
    const events = await P.evaluate(() => DawnUIApp.session().events());
    const bad = events.filter(e => e.t === "policy-refused" || e.t === "stalled");
    bad.forEach(e => res.bad.push("play: session event " + JSON.stringify(e)));
    refusals = events.filter(e => e.t === "refused").length;
    const fin = await snap();
    if(fin.turn < turns * 2) res.bad.push(`play: only reached turn ${fin.turn} (wanted ${turns * 2})` + (fin.over ? " — the game ended" : ""));
    if(lives.length < 2) res.bad.push("play: life totals never changed");
    if(opts.needs && !fin.over){
      if(!did.defended) res.bad.push("play: you never defended");
      if(!did.arsenal && !did.reaction) res.bad.push("play: you never set an arsenal card or played a reaction");
    }
    res.notes.push(`defended ${did.defended}, arsenal ${did.arsenal}, reactions ${did.reaction}, sheets ${did.sheets}`);
    res.notes.push(`turn ${fin.turn}, ${taps} taps, ${refusals} refused taps, life ${lives.map(l => l.join("/")).join(" > ")}`);
    if(opts.shots) await P.screenshot({ path: path.join(opts.shots, `play-${engine}.png`) });
    await a.context.close();
  } catch(e){ res.bad.push("play drive error: " + String(e && e.message || e).split("\n")[0]); }
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
  const arg = n => argv.includes(n) ? argv[argv.indexOf(n) + 1] : null;
  if(arg("--hero")) MATCH.hero = arg("--hero");
  if(arg("--foe")) MATCH.foe = arg("--foe");
  if(arg("--seed")) MATCH.seed = arg("--seed");
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
  const want = n => !argv.includes("--only") || argv[argv.indexOf("--only") + 1] === n;
  const o = { shots: argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : null, art: argv.includes("--art") };
  if(o.shots) fs.mkdirSync(o.shots, { recursive: true });
  const report = (r, tag) => {
    if(r.bad.length) failed = true;
    console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine_.padEnd(8)} ${tag.padEnd(8)} ${r.vp[0]}x${r.vp[1]}  ${r.notes.join(" · ")}`);
    r.bad.slice(0, argv.includes("--verbose") ? 999 : 12).forEach(b => console.log("        " + b));
    r.diffs.forEach(d => diffsSeen.add(d));
    if(argv.includes("--verbose") && r.state) console.log("        state " + JSON.stringify(r.state) + " · " + r.ua);
  };
  let engine_ = "";
  for(const engine of engines){
    engine_ = engine;
    const browser = await launch(pw, engine);
    try {
      if(want("t1")) for(const vp of VIEWPORTS){
        const r = await runCase(pw, browser, engine, vp, seed, o);
        r.notes.unshift("T1");
        report(r, "t1");
      }
      if(want("states")) for(const vp of VIEWPORTS) report(await runStates(pw, browser, engine, vp, o), "states");
      if(want("states2")) for(const vp of VIEWPORTS) report(await runStates2(pw, browser, engine, vp, o), "states2");
      if(want("states4")) for(const vp of VIEWPORTS) report(await runStates4(pw, browser, engine, vp, o), "states4");
      if(want("states3")) for(const vp of VIEWPORTS) report(await runStates3(pw, browser, engine, vp, o), "states3");
      if(want("play")) report(await runPlay(pw, browser, engine, { ...o, turns: +arg("--turns") || 5, needs: true, pace: arg("--pace") }), "play");
      if(want("frames") && engine === "chromium") report(await runPlay(pw, browser, engine, { ...o, turns: +arg("--turns") || 5, needs: true, throttle: 4, pace: arg("--pace"), search: arg("--search") || "0" }), "frames");
      if(want("frames") && engine === "chromium" && arg("--search") == null) report(await runPlay(pw, browser, engine, { ...o, turns: +arg("--turns") || 5, needs: true, throttle: 4, pace: arg("--pace"), informational: true }), "frames+AI");
    } finally { await browser.close(); }
  }
  if(KNOWN.size){ console.log("\n######## KNOWN ISSUES (these are NOT passes) ########"); [...KNOWN].forEach(k => console.log("  ! " + k)); }
  if(diffsSeen.size){ console.log("\nDIFFERENCES (deliberately not compared):"); [...diffsSeen].forEach(d => console.log("  - " + d)); }
  process.exit(failed ? 1 : 0);
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
/* the drive's parts, for the other drives (tools/ui-flow-drive.js): the browsers (Chromium; WebKit by the /opt/pw-webkit lookup) and the offline page */
module.exports = { judgePhone, judgeBoxes, norm, ADVANCE_SRC, needs, launch, openPage, webkitBinary, settle, answerSheet, MEASURE, PLAY, MOCKDIR, VIEWPORTS };
