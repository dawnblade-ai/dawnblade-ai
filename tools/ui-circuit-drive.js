#!/usr/bin/env node
/* ============================================================
   THE CIRCUIT DRIVE — CRESCENDO's meta layer (ui/circuit-view.js, ui/circuit-play.js, the hooks in ui/flow.js and ui/app.js) in Chromium AND
   WebKit, at 375x548 · 393x660 · 430x932 · 393x852.

   BOXES   each Circuit screen of play.html is matched box for box to its mockup (docs/crescendo/mockups/circuit-N-*.html?v=…&noframe, the same
           viewport): the named elements (the mockup's own classes) compared within TOL px. The app is fed a FIXTURE the way a phone would be: a
           Circuit store written by ui/circuit.js's own `record`, the server cache, and a fake server transport (window.__dawnServerTransport,
           the seam engine/servertable.js reads). A box the app draws differently ON PURPOSE is listed under DIFFERENCES.
   PHONE   every screen: no page scroll, taps >= 44x44, no text under 11 px.
   FLOWS   the real thing, by taps: the daily (C6 -> C8 -> F4 fixed -> table -> concede -> F7 + plate -> the store holds the official loss, the
           Circuit's C8 shows it), the road (C7 -> F3 with the foe fixed -> F4 -> table), a Dummy game recorded as "plain", erase, and the
           result plate's ranked / beats variants mounted through the real F7 Result component with a model (the plate's own pure kit).
   RUN     node tools/ui-circuit-drive.js [--chromium-only] [--verbose] [--only boxes|flows|plate]
   DEPS    as tools/ui-flow-drive.js (PAGE_DEPS, NODE_PATH, /opt/pw-webkit).
   ============================================================ */
const path = require("path");
const F = require("./ui-flow-drive.js");
const D = require("./ui-drive.js");
const { MEASURE, PHONE, settle, tapB, PLAY, MOCK } = F;
const { webkitBinary, launch } = D;
const ROOT = path.join(__dirname, "..");
const VIEWPORTS = [[375, 548], [393, 660], [430, 932], [393, 852]];
const TOL = 1.5;

/* ---------- the fixtures: a store the Circuit's own rules wrote, the server's cache, a fake server ---------- */
const W = require("../test/helpers/extract").loadData();
global.window = global; Object.assign(global, { DawnRNG: require("../engine/rng.js") });
const CC = require("../ui/circuit.js");
const H = W.HEROES;
const NOW = Date.now(), DAY = 86400000, M0 = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
function mk(i, kind, me, foe, result, turns, life, at, extra){
  return Object.assign({ id: "fx" + i, at, kind, me, foe, level: kind === "dummy" || kind === "friend" || kind === "ranked" ? null : "sharp", result, how: "life", turns, life, first: i % 2, seed: kind === "friend" || kind === "ranked" ? null : String(100 + i), dv: "sage-v19" }, extra || {});
}
function fixtureStore(){
  let s = CC.empty("d_fixture");
  const gs = [
    mk(1, "ai", "iyslander", "kayo", "w", 6, [11, 0], M0 + DAY - 12 * 3600e3 - 5 * 60e3 > NOW ? NOW - 60e3 : NOW - 60e3),
    mk(2, "ai", "gravy", "fai", "w", 9, [7, 0], NOW - 120e3),
    mk(3, "road", "viserai", "enigma", "l", 8, [0, 4], NOW - 180e3),
    mk(4, "ai", "kayo", "dash", "w", 12, [4, 0], M0 - 3 * 3600e3),
    mk(5, "ranked", "iyslander", "blaze", "w", 11, [3, 0], M0 - 4 * 3600e3, { rating: { from: 1234, to: 1248 } }),
    mk(6, "dummy", "iyslander", "dummy", "w", 5, [20, 0], M0 - 5 * 3600e3),
    mk(7, "ai", "dorinthea", "bravo", "d", 31, [4, 4], M0 - 6 * 3600e3, { how: "stalemate" }),
    mk(8, "friend", "blaze", "arakni", "w", 9, [5, 0], M0 - DAY - 3 * 3600e3),
    mk(9, "ai", "viserai", "dorinthea", "w", 14, [1, 0], M0 - DAY - 4 * 3600e3),
    mk(10, "ai", "iyslander", "viserai", "l", 10, [0, 6], M0 - DAY - 5 * 3600e3)
  ];
  gs.forEach(g => { const r = CC.record(s, g, H); if (r) s = r.store; });
  return JSON.stringify(Object.assign({}, s, { flag: undefined }));
}
const mineRows = [14, -12, 16, 13, -15, 15, -9, 14, -13, 17].map((c, i) => ({ hero: "iyslander", foeHero: "blaze", foe: "Orrin K.", result: c > 0 ? "won" : "lost", how: "life", change: c, at: NOW - (i + 1) * 7200e3 }));
const sum = mineRows.reduce((a, x) => a + x.change, 0);
const YOU = { name: "Kestrel", rating: 1248, games: 21, wins: 7, losses: 4, draws: 0, listed: true, rank: 12, toGo: 0 };
const CACHE = JSON.stringify({ v: 1, at: NOW, you: YOU, mine: mineRows });
const rowsL = [["Marrowgate", 1411, 14, 3, 0], ["Wren Ashby", 1388, 22, 11, 1], ["Quillon", 1371, 9, 2, 0], ["Halloran", 1342, 17, 9, 0], ["Tamsin Vale", 1330, 12, 8, 2], ["Brannock", 1311, 10, 7, 0], ["Ysolde", 1296, 8, 4, 0], ["Orrin K.", 1281, 15, 12, 1], ["Dunmore", 1275, 6, 3, 0], ["Ketterick", 1262, 11, 9, 0], ["Pell", 1255, 5, 3, 0], ["Kestrel", 1248, 7, 4, 0], ["Fenwick", 1239, 6, 6, 0], ["Sorrel", 1226, 4, 3, 0]]
  .map((r, i) => ({ rank: i + 1, name: r[0], rating: r[1], games: r[2] + r[3] + r[4], wins: r[2], losses: r[3], draws: r[4] }));
const recent = [[["Orrin K.", "Kestrel"], ["blaze", "iyslander"], 0, "life", 3], [["Marrowgate", "Halloran"], ["viserai", "dash"], 0, "life", 11], [["Pell", "Sorrel"], ["kayo", "fai"], null, "stalemate", 40],
  [["Wren Ashby", "Tamsin Vale"], ["enigma", "bravo"], 0, "concession", 60], [["Quillon", "Fenwick"], ["dorinthea", "gravy"], 0, "life", 120]].map(r => ({ names: r[0], heroes: r[1], winner: r[2], how: r[3], at: NOW - r[4] * 60e3 }));
function ladderAnswer(v){
  const base = { ok: true, floor: 3, cap: 50, ladder: rowsL, recent };
  if (v === "empty") return { ...base, ladder: [], recent: [] };
  if (v === "signedout") return base;
  if (v === "provisional") return { ...base, you: { name: "Kestrel", rating: 1216, games: 2, wins: 2, losses: 0, draws: 0, listed: false, rank: null, toGo: 1 } };
  return { ...base, you: YOU, mine: mineRows };
}
/* runs in the page BEFORE its scripts: the store, the cache, the last choices, and the fake server (mode: ok | signedout | empty | provisional | fail | hang) */
const INIT = ({ store, cache, mode, ans }) => {
  try {
    localStorage.clear();
    localStorage.setItem("dawnblade.crescendo.last", JSON.stringify({ hero: "iyslander", foe: "viserai" }));
    if (store) localStorage.setItem("dawnblade.circuit", store);
    if (cache) localStorage.setItem("dawnblade.circuit.cache", cache);
  } catch (e) {}
  window.__dawnServerTransport = { post: env => mode === "fail" ? Promise.reject(new Error("down")) : mode === "hang" ? new Promise(() => {}) : Promise.resolve(env.op === "ladder" ? ans : { ok: false, refused: "x" }), subscribe: () => () => {} };
};
const initFor = (o) => ({ store: o.store || null, cache: o.cache || null, mode: o.mode || "ok", ans: o.mode === "fail" || o.mode === "hang" ? null : ladderAnswer(o.mode === "ok" || !o.mode ? "you" : o.mode) });

/* ---------- what is compared ---------- */
const S = (...a) => a;
const FULL = { store: fixtureStore(), cache: CACHE };
const TOP = S(".hdr .ib", ".hdr h1", ".cx-seg", ".cx-seg button");
const SCREENS = [
  { id: "C1 you", mock: "circuit-1-record.html?v=you", app: "?screen=c1", root: ".c1", fx: FULL, sel: S(...TOP, ".cx-card", ".nn", ".mv.big", ".rowl", ".tile2", ".gm", ".link2", ".btn.sec.sm") },
  { id: "C1 new", mock: "circuit-1-record.html?v=new", app: "?screen=c1", root: ".c1", fx: {}, sel: S(...TOP, ".cx-card", ".empty", ".hub .btn") },
  { id: "C1 signedout", mock: "circuit-1-record.html?v=signedout", app: "?screen=c1", root: ".c1", fx: { store: FULL.store }, sel: S(...TOP, ".cx-card", ".nn", ".btn.sec.sm", ".rowl", ".gm") },
  { id: "C1 manage", mock: "circuit-1-record.html?v=manage", app: "?screen=c1", root: ".c1", fx: FULL, steps: [["save"]], sel: S(".scrimf", ".sheet.cs", ".sheet .ttl2", ".sheet .btn") },
  { id: "C1 erase", mock: "circuit-1-record.html?v=erase", app: "?screen=c1", root: ".c1", fx: FULL, steps: [["erase"]], sel: S(".scrimf", ".sheet.cs", ".sheet .ttl2", ".sheet .btn") },
  { id: "C2 list", mock: "circuit-2-heroes.html?v=list", app: "?screen=c2", root: ".c2", fx: FULL, sel: S(...TOP, ".hrow", ".pips", ".dayh") },
  { id: "C2 sheet", mock: "circuit-2-heroes.html?v=sheet", app: "?screen=c2", root: ".c2", fx: FULL, steps: [["hero-iyslander"]], sel: S(".scrimf", ".sheet.cs", ".ban", ".ban .ib", ".thr", ".fg .f", ".sitbar .btn") },
  { id: "C2 empty", mock: "circuit-2-heroes.html?v=empty", app: "?screen=c2", root: ".c2", fx: {}, sel: S(...TOP, ".cx-card", ".hrow") },
  { id: "C3 all", mock: "circuit-3-games.html?v=all", app: "?screen=c3", root: ".c3", fx: FULL, sel: S(...TOP, ".fchips", ".fc", ".dayh", ".gm") },
  { id: "C3 ranked", mock: "circuit-3-games.html?v=ranked", app: "?screen=c3", root: ".c3", fx: FULL, steps: [["chip-ranked"]], sel: S(...TOP, ".fchips", ".note", ".gm"), skip: { ".gm": "the fixture's local ranked receipt joins the server's ten (eleven rows, the mockup has six)" } },
  { id: "C3 empty", mock: "circuit-3-games.html?v=empty", app: "?screen=c3", root: ".c3", fx: {}, sel: S(...TOP, ".fchips", ".cx-card", ".hub .btn") },
  { id: "C3 detail", mock: "circuit-3-games.html?v=detail", app: "?screen=c3", root: ".c3", fx: FULL, steps: [["game"]], sel: S(".scrimf", ".sheet.cs", ".sheet .rs", ".sheet .btn"), skip: { ".sheet.cs": "the app's detail sheet is as tall as the game's own lines (an AI game with a deal to replay has the mockup's five lines and two buttons; the first row is a different game)" } },
  { id: "C4 you", mock: "circuit-4-ladder.html?v=you", app: "?screen=c4", root: ".c4", fx: { mode: "ok" }, sel: S(".hdr .ib", ".hdr h1", ".cx-seg", ".cx-card", ".nn", ".lr") },
  { id: "C4 provisional", mock: "circuit-4-ladder.html?v=provisional", app: "?screen=c4", root: ".c4", fx: { mode: "provisional" }, sel: S(".cx-seg", ".cx-card", ".lr") },
  { id: "C4 signedout", mock: "circuit-4-ladder.html?v=signedout", app: "?screen=c4", root: ".c4", fx: { mode: "signedout" }, sel: S(".cx-seg", ".cx-card", ".cx-card .btn", ".lr") },
  { id: "C4 latest", mock: "circuit-4-ladder.html?v=latest", app: "?screen=c4", root: ".c4", fx: { mode: "ok" }, steps: [["tab-latest"]], sel: S(".cx-seg", ".cx-card", ".lg") },
  { id: "C4 empty", mock: "circuit-4-ladder.html?v=empty", app: "?screen=c4", root: ".c4", fx: { mode: "empty" }, sel: S(".cx-seg", ".cx-card", ".empty", ".hub .btn") },
  { id: "C4 loading", mock: "circuit-4-ladder.html?v=loading", app: "?screen=c4", root: ".c4", fx: { mode: "hang" }, sel: S(".cx-seg", ".lr", ".skel") },
  { id: "C4 fail", mock: "circuit-4-ladder.html?v=fail", app: "?screen=c4", root: ".c4", fx: { mode: "fail" }, sel: S(".cx-seg", ".note", ".hub .btn") },
  { id: "C6 circuit", mock: "circuit-6-home.html?v=midway", app: "?screen=c6", root: ".c6", fx: FULL, sel: S(".hdr .ib", ".hdr h1", ".card", ".k1 .pt", ".dots17", ".tilel", ".hub .btn") },
  { id: "C6 fresh", mock: "circuit-6-home.html?v=fresh", app: "?screen=c6", root: ".c6", fx: {}, sel: S(".card", ".dots17", ".tilel", ".hub .btn") },
  { id: "C7 road", mock: "circuit-7-road.html?v=fresh", app: "?screen=c7", root: ".c7", fx: {}, sel: S(".hdr h1", ".bar2", ".bar2 .tr", ".tier", ".rung", ".hub .btn") },
  { id: "C8 open", mock: "circuit-8-daily.html?v=open", app: "?screen=c8", root: ".c8", fx: {}, sel: S(".hdr h1", ".faces", ".face", ".vsm", ".rl", ".week", ".wd", ".hub .btn"), skip: { ".rl": "the first-player sentence wraps with the day's heroes' names" } },
  { id: "F2 ways", mock: "circuit-9-ways.html", app: "?screen=f2", root: ".f2", fx: {}, sel: S(".hdr .ib", ".hdr h1", ".modes .mode", ".foot .link") }
];

async function openApp(pw, browser, engine, vp, url, fx, errors){
  const arg = initFor(fx || {});
  const wrapped = `(${INIT.toString()})(${JSON.stringify(arg)})`;
  return D.openPage(pw, browser, engine, vp, PLAY + url, errors, false, new Function(wrapped));
}
async function runBoxes(pw, browser, engine, vp, sc, diffsSeen){
  const errors = [], bad = [];
  const mk0 = await D.openPage(pw, browser, engine, vp, MOCK(sc.mock) + (sc.mock.includes("?") ? "&" : "?") + "noframe", errors, false, null);
  await settle(mk0.page, 400);
  const sel = sc.sel.filter(s => !(sc.skip && sc.skip[s] === ""));
  const M = await mk0.page.evaluate(MEASURE, { root: sc.root, sel });
  await mk0.context.close();
  const a = await openApp(pw, browser, engine, vp, sc.app, sc.fx, errors);
  let L = null, phone = [];
  try {
    await settle(a.page, 500);
    for (const st of sc.steps || []) { await tapB(a.page, st[0]); await a.page.waitForTimeout(150); }
    await settle(a.page, 400);
    L = await a.page.evaluate(MEASURE, { root: sc.root, sel });
    phone = await a.page.evaluate(PHONE, sc.root);
  } catch (e) { bad.push("could not reach the screen: " + e.message.split("\n")[0]); }
  await a.context.close();
  let worst = 0, n = 0, wn = "";
  if (L) {
    if (M.missing || L.missing) bad.push(`${sc.root} missing (${M.missing ? "mockup" : "app"})`);
    else for (const s of sel) {
      const m = M.boxes[s], l = L.boxes[s];
      if (sc.skip && sc.skip[s]) { diffsSeen.add(`${sc.id} ${s}: ${sc.skip[s]}`); continue; }
      if (m.length !== l.length) { bad.push(`${s}: ${l.length} in the app, ${m.length} in the mockup`); continue; }
      m.forEach((mb, i) => { n++; const d = Math.max(...mb.map((v, k) => Math.abs(v - l[i][k]))); if (d > worst) { worst = d; wn = `${s}[${i}]`; }
        if (d > TOL) bad.push(`${s}[${i}] off by ${d.toFixed(1)}px  app [${l[i].map(v => v.toFixed(1))}] mock [${mb.map(v => v.toFixed(1))}]`); });
    }
  }
  phone.forEach(p => bad.push("phone: " + p));
  errors.forEach(e => bad.push(e));
  return { bad, n, worst, wn };
}

/* ---------- FLOWS: by taps, the real games ---------- */
const STORE = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("dawnblade.circuit") || "null"); } catch (e) { return null; } });
async function flows(pw, browser, engine, vp){
  const errors = [], bad = [], steps = [], ok = s => steps.push(s);
  const a = await openApp(pw, browser, engine, vp, "?screen=f2", {}, errors), page = a.page;
  const need = async (q, what, ms) => { try { await page.waitForSelector(q, { timeout: ms || 9000, state: "attached" }); ok(what); } catch (e) { bad.push(`${what}: ${q} never appeared`); throw new Error("stop"); } };
  try {
    await settle(page, 300);
    if ((await page.evaluate(() => document.querySelectorAll('[data-b^="mode-"]').length)) !== 5) bad.push("F2 does not show five cards");
    await tapB(page, "mode-circuit"); await need('[data-b="c6"]', "F2 -> The Circuit (C6)");
    const daily = await page.evaluate(() => { const D = window.DawnCircuit; return D.dailyDeal(D.dayOf(), window.HEROES); });
    await tapB(page, "daily"); await need('[data-b="c8"]', "C6 -> Today's challenge (C8)");
    await tapB(page, "play"); await need('[data-b="sitdown"]', "C8 -> F4 (fixed)");
    const f4 = await page.evaluate(() => ({ hits: document.querySelectorAll(".f4 .hit").length, gear: !!document.querySelector('[data-b="gear"]'), label: (document.querySelector('[data-b="sit-label"]') || {}).textContent, slab: (document.querySelector('[data-b="slab"]') || {}).textContent, swap: document.querySelectorAll(".f4 .swap").length }));
    if (f4.hits || f4.gear || f4.swap) bad.push("the daily's F4 is not fixed: " + JSON.stringify(f4));
    if (!/Today/.test(f4.label || "")) bad.push("F4 label is " + JSON.stringify(f4.label));
    if (!/goes first|You go first/.test(f4.slab || "")) bad.push("F4 slab is " + JSON.stringify(f4.slab));
    await page.waitForTimeout(2600);
    await tapB(page, "shuffle"); await need('[data-b="bout"]', "F4 -> the table", 15000);
    const heroes = await page.evaluate(() => { const s = window.DawnUIApp.session(); return { me: s.heroKeys[0], foe: s.heroKeys[1], seed: s.pick.seed, first: s.state().first, search: s.pick.search }; });
    if (heroes.me !== daily.me || heroes.foe !== daily.foe || heroes.seed !== daily.seed || heroes.first !== daily.first || !heroes.search) bad.push("the table is not the deal: " + JSON.stringify({ heroes, daily }));
    else ok("the table is today's deal (" + daily.me + " vs " + daily.foe + ", seed, first, Sharp)");
    await tapB(page, "hub-left"); await need('[data-b="row-concede"]', "menu opens");
    if (await page.evaluate(() => !!document.querySelector('[data-b="row-coach"]'))) bad.push("Coach's call is offered at the daily");
    if (!/official try/.test(await page.evaluate(() => { document.querySelector('[data-b="row-concede"]').click(); return new Promise(r => setTimeout(() => r(document.body.textContent), 150)); }))) bad.push("the concede copy does not say it counts");
    await tapB(page, "concede"); await need('[data-b="continue"]', "concede -> the KO frame", 12000);
    await tapB(page, "continue"); await need('[data-b="plate"]', "the pad shows the plate");
    const rec = await STORE(page);
    const day = await page.evaluate(() => window.DawnCircuit.dayOf());
    if (!rec || rec.games.length !== 1 || rec.games[0].kind !== "daily" || rec.games[0].result !== "l" || rec.games[0].how !== "concession" || !rec.marks.days[day] || rec.games[0].seed !== daily.seed) bad.push("the store did not take the official loss: " + JSON.stringify(rec && rec.games));
    else ok("the store holds ONE game: the daily, lost by concession, official, with the deal's seed");
    const bt = await page.evaluate(() => [...document.querySelectorAll('.acts2 .btn')].map(b => b.textContent.trim()).join("|"));
    if (!/^Share\|Leave\|Practice this deal$/.test(bt)) bad.push("daily-loss buttons: " + bt);
    await tapB(page, "leave"); await need('[data-b="title"]', "LEAVE -> title");
    await page.evaluate(() => { history.replaceState(null, "", "?screen=c6"); });
    await tapB(page, "record"); await need('[data-b="c1"]', "title -> Your record (C1)");
    if ((await page.evaluate(() => document.querySelectorAll(".c1 .gm").length)) !== 1) bad.push("C1 does not list the game just recorded");
    await tapB(page, "tab-c3"); await need('[data-b="c3"]', "C1 -> Games (C3)");
    await tapB(page, "game"); await need('[data-b="detail-sheet"]', "C3 -> the game's detail");
    await tapB(page, "replay"); await need('[data-b="sitdown"]', "PLAY THIS DEAL AGAIN -> F4");
    /* erase */
    await tapB(page, "back"); await need('[data-b="c1"]', "back");
  } catch (e) { if (e.message !== "stop") bad.push(String(e.message).split("\n")[0]); }
  errors.forEach(e => bad.push(e));
  await a.context.close();
  return { bad, steps };
}
/* the road: C7 -> F3 (the foe fixed) -> F4 (the rung) -> the table; and a Dummy game kept as "plain", then ERASE */
async function road(pw, browser, engine, vp){
  const errors = [], bad = [], steps = [], ok = s => steps.push(s);
  const a = await openApp(pw, browser, engine, vp, "?screen=c7", {}, errors), page = a.page;
  const need = async (q, what, ms) => { try { await page.waitForSelector(q, { timeout: ms || 9000, state: "attached" }); ok(what); } catch (e) { bad.push(`${what}: ${q} never appeared`); throw new Error("stop"); } };
  try {
    await settle(page, 300);
    await tapB(page, "rung-enigma"); await tapB(page, "fight"); await need('[data-b="heroes"]', "C7 -> F3");
    if (!(await page.evaluate(() => /Enigma/i.test((document.querySelector('[data-b="foe-chip"]') || {}).textContent || "")))) bad.push("F3 has no FOE chip for Enigma");
    await tapB(page, "tile-iyslander"); await tapB(page, "sit"); await need('[data-b="sitdown"]', "F3 -> F4");
    const f4 = await page.evaluate(() => ({ label: (document.querySelector('[data-b="sit-label"]') || {}).textContent, hits: document.querySelectorAll(".f4 .hit").length }));
    if (!/rung 9 of 17/i.test(f4.label || "")) bad.push("F4 road label " + JSON.stringify(f4.label));
    await page.waitForTimeout(2600); await tapB(page, "shuffle"); await need('[data-b="bout"]', "F4 -> table", 15000);
    const t = await page.evaluate(() => { const s = window.DawnUIApp.session(); return [s.heroKeys[0], s.heroKeys[1]]; });
    if (t[1] !== "enigma") bad.push("the road table's foe is " + t[1]);
    await tapB(page, "hub-left"); await need('[data-b="row-concede"]', "menu"); await page.evaluate(() => document.querySelector('[data-b="row-concede"]').click());
    await page.waitForTimeout(150); await tapB(page, "concede"); await need('[data-b="continue"]', "concede -> KO", 12000); await tapB(page, "continue"); await need('[data-b="cap"]', "road loss: nothing earned, the plain line");
    const rec = await STORE(page);
    if (!rec || rec.games.length !== 1 || rec.games[0].kind !== "road" || rec.games[0].foe !== "enigma" || Object.keys(rec.marks.road).length) bad.push("road game record: " + JSON.stringify(rec && rec.games));
    else ok("the store holds the road game (a loss: no rung cleared)");
    /* ERASE */
    await page.evaluate(() => { const E = window.DawnUIApp; });
    await tapB(page, "leave"); await need('[data-b="title"]', "leave");
    await tapB(page, "record"); await need('[data-b="c1"]', "C1"); await tapB(page, "erase"); await tapB(page, "erase-all");
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => [localStorage.getItem("dawnblade.circuit"), document.querySelectorAll(".c1 .empty").length]);
    if (after[0] !== null || after[1] !== 1) bad.push("erase left " + JSON.stringify(after)); else ok("ERASE cleared the store; C1 reads 'starts here'");
  } catch (e) { if (e.message !== "stop") bad.push(String(e.message).split("\n")[0]); }
  errors.forEach(e => bad.push(e));
  await a.context.close();
  return { bad, steps };
}

/* THE PLATE: F7's real Result component mounted with a model, every variant of C5, boxes against circuit-5 */
const PLATES = [
  { v: "ranked-win", model: () => ({ kind: "ranked", events: [], ranked: { state: "ok", from: 1236, to: 1248, stand: "ok", you: { listed: true, rank: 12, games: 20, toGo: 0 }, floor: 3, was: 14 } }), sel: S(".plate", ".plate .old", ".plate .new", ".plate .mv", ".plate .stand") },
  { v: "ranked-loss", model: () => ({ kind: "ranked", events: [], ranked: { state: "ok", from: 1248, to: 1233, stand: "ok", you: { listed: true, rank: 13, games: 20, toGo: 0 }, floor: 3, was: 12 } }), sel: S(".plate", ".plate .new", ".plate .mv") },
  { v: "ranked-new", model: () => ({ kind: "ranked", events: [], ranked: { state: "ok", from: 1200, to: 1216, stand: "ok", you: { listed: false, rank: null, games: 2, toGo: 1 }, floor: 3 } }), sel: S(".plate", ".plate .new", ".plate .mv") },
  { v: "ranked-wait", model: () => ({ kind: "ranked", events: [], ranked: { state: "wait" } }), sel: S(".plate", ".plate .skel") },
  { v: "plain", model: () => ({ kind: "ai", events: [] }), sel: S(".cap") }
];
async function plates(pw, browser, engine, vp, diffsSeen){
  const out = [];
  for (const pl of PLATES) {
    const errors = [], bad = [];
    const mk0 = await D.openPage(pw, browser, engine, vp, MOCK("circuit-5-result.html?v=" + pl.v) + "&noframe", errors, false, null);
    await settle(mk0.page, 400);
    const sel = S(".paper.res", ".gg", ".acts2 .btn", ...pl.sel);
    const M = await mk0.page.evaluate(MEASURE, { root: ".c5", sel });
    await mk0.context.close();
    const a = await openApp(pw, browser, engine, vp, "?screen=f1", {}, errors);
    let L = null;
    try {
      await settle(a.page, 300);
      L = await a.page.evaluate(async ({ pm, sel }) => {
        const K = window.DawnUIFlow, P = window.htmPreact, CP = window.DawnUICircuitPlay, Pad = window.DawnUIPad, html = P.html;
        const m = Object.assign({ game: { id: "x", kind: "ai", me: "iyslander", foe: "viserai" }, store: window.DawnCircuit.empty(), hooks: {} }, pm);
        const kit = CP.resultKit(m);
        const host = document.createElement("div"); host.className = "stage fl"; host.style.cssText = "position:fixed;inset:0;z-index:999";
        document.body.appendChild(host);
        P.render(html`<${K.Sprite}/><${K.Result} director=${null} conceded=${true} pad=${Pad.empty([20, 20])} names=${["You", "Viserai"]} first=${0} turn=${9} winner=${0} extra=${kit} onNew=${() => {}} onLeave=${() => {}} onRematch=${() => {}}/>`, host);
        await new Promise(r => setTimeout(r, 900));
        const b = host.querySelector('[data-b="continue"]'); if (b) b.click();
        await new Promise(r => setTimeout(r, 500));
        const R = host.querySelector(".f7"); R.classList.add("c5");
        const out = {};
        const sels = sel;
        sels.forEach(s => { out[s] = [...R.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); });
        return { boxes: out };
      }, { pm: pl.model(), sel });
    } catch (e) { bad.push("could not mount: " + e.message.split("\n")[0]); }
    const ph = await a.page.evaluate(PHONE, ".f7").catch(() => []);
    await a.context.close();
    let worst = 0, n = 0;
    if (L) for (const s of sel) {
      const m = M.boxes[s], l = L.boxes[s];
      if (!m || !l) { bad.push(s + " missing"); continue; }
      if (m.length !== l.length) { bad.push(`${s}: ${l.length} in the app, ${m.length} in the mockup`); continue; }
      m.forEach((mb, i) => { n++; const d = Math.max(...mb.map((v, k) => Math.abs(v - l[i][k]))); worst = Math.max(worst, d); if (d > TOL) bad.push(`${s}[${i}] off by ${d.toFixed(1)}px  app [${l[i].map(v => v.toFixed(1))}] mock [${mb.map(v => v.toFixed(1))}]`); });
    }
    ph.forEach(p => bad.push("phone: " + p)); errors.forEach(e => bad.push(e));
    out.push({ v: pl.v, bad, n, worst });
  }
  return out;
}

async function main(){
  const argv = process.argv.slice(2);
  let pw;
  try { pw = require("playwright"); } catch (e) { console.error("tools/ui-circuit-drive.js needs `playwright` (set NODE_PATH)"); return process.exit(1); }
  const arg = n => argv.includes(n) ? argv[argv.indexOf(n) + 1] : null, only = arg("--only"), verbose = argv.includes("--verbose");
  const engines = ["chromium"]; let failed = false;
  if (!argv.includes("--chromium-only")) {
    if (webkitBinary()) engines.push("webkit");
    else { console.log("\n######## WEBKIT DID NOT RUN ########\n  no pw_run.sh under /opt/pw-webkit/webkit-<build>/ (PW_WEBKIT names one). A drill that did not run on WebKit is not a pass.\n"); failed = true; }
  }
  const diffsSeen = new Set(), flt = arg("--screen");
  for (const engine of engines) {
    const browser = await launch(pw, engine);
    try {
      if (!only || only === "boxes") for (const sc of SCREENS) {
        if (flt && !sc.id.startsWith(flt)) continue;
        for (const vp of VIEWPORTS) {
          const r = await runBoxes(pw, browser, engine, vp, sc, diffsSeen);
          if (r.bad.length) failed = true;
          console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${sc.id.padEnd(15)} ${vp[0]}x${vp[1]}  ${r.n} boxes, worst ${r.worst.toFixed(1)}px${r.wn ? " (" + r.wn + ")" : ""}`);
          r.bad.slice(0, verbose ? 999 : 5).forEach(b => console.log("        " + b));
        }
      }
      if (!only || only === "plate") for (const vp of VIEWPORTS) {
        for (const r of await plates(pw, browser, engine, vp, diffsSeen)) {
          if (r.bad.length) failed = true;
          console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${("C5 " + r.v).padEnd(15)} ${vp[0]}x${vp[1]}  ${r.n} boxes, worst ${r.worst.toFixed(1)}px`);
          r.bad.slice(0, verbose ? 999 : 5).forEach(b => console.log("        " + b));
        }
      }
      if (!only || only === "flows") for (const [nm, fn] of [["daily flow", flows], ["road flow", road]]) {
        const r = await fn(pw, browser, engine, [393, 660]);
        if (r.bad.length) failed = true;
        console.log(`${r.bad.length ? "FAIL" : "PASS"}  ${engine.padEnd(8)} ${nm.padEnd(15)} 393x660  ${r.steps.length} steps${verbose ? ": " + r.steps.join(" > ") : ""}`);
        r.bad.slice(0, 12).forEach(b => console.log("        " + b));
      }
    } finally { await browser.close(); }
  }
  if (diffsSeen.size) { console.log("\nDIFFERENCES (deliberately not compared):"); [...diffsSeen].forEach(d => console.log("  - " + d)); }
  process.exit(failed ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { SCREENS, VIEWPORTS };
