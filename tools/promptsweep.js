/* ============================================================
   THE PROMPT SWEEP — every prompt sheet, as each hero raises it (QUEUE item 6; builds on tools/tapjudge.js).

   Plays real games on the real page (tools/page.js's open()) and, the moment a prompt sheet (`.psheet`) shows that
   this (hero, board, kind) has not shown yet, judges it: tapjudge's four questions (44 px hit floor, a stolen centre
   tap, clipped, overlap), plus what a sheet owes on top of that:
     offscreen   the sheet leaves the screen sideways or off the bottom
     hscroll     the page scrolls sideways
     tall        the sheet is taller than its box and nothing in it scrolls (content lost off the end)
     text        a word in the sheet is drawn under MINFONT px (the token scale's floor, --fs-xs)
   The kind is the engine's prompt tag (`promptQ[0].tag`: opt pick modal pay reveal target alloc soak) at the TABLE; the
   trainer's state is not on `window`, so its kind is read off the sheet's own shape (`sheetFacts().shape`).

   TABLE: seat 0 is piloted by DawnSparring (as tools/tapsweep.js does) against an AI hero, so every hero's own
   prompts come up in its own games; several games (a different foe each) per hero until it has shown every kind or
   the budget is spent. TRAINER: random taps (tools/trainchaos.js's way) through the dummy game.
   Output: one PASS/FAIL row per (hero, board, kind, size), then the COVERAGE table (ok / FAIL / . = not reached).

   node tools/promptsweep.js [--sizes 393x852,320x568] [--heroes 0,3] [--boards table,trainer] [--games 3] [--steps 400]
   Deps and NODE_PATH as tools/page.js's header. Not part of `npm test` (needs a browser).
   ============================================================ */
"use strict";
const { judgeScreen } = require("./tapjudge.js");
const MINFONT = 9;
const KINDS = ["opt", "pick", "modal", "pay", "reveal", "target", "alloc", "soak"];

/* in the page: what the sheet's own controls say its kind is, and the extra checks */
function sheetFacts(minFont) {
  const s = document.querySelector(".psheet"); if (!s) return null;
  const W = innerWidth, H = innerHeight, r = s.getBoundingClientRect(), out = { issues: [] };
  out.shape = s.querySelector(".pstat") ? "soak" : s.querySelector(".pmodal .popt") ? "modal" : s.querySelector(".poptcol") ? "opt"
    : s.querySelector(".pcard") ? "cards" : "other";
  if (r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > H + 0.5) out.issues.push(`offscreen: sheet ${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)} on ${W}x${H}`);
  const de = document.scrollingElement; if (de.scrollWidth > W + 1) out.issues.push(`hscroll: page is ${de.scrollWidth} wide on ${W}`);
  const ys = [s, ...s.querySelectorAll("*")].some(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
  const kids = [...s.children].reduce((a, c) => a + c.getBoundingClientRect().height, 0);
  if (!ys && kids > r.height + 1) out.issues.push(`tall: sheet content ${Math.round(kids)} in a ${Math.round(r.height)} box and nothing scrolls`);
  for (const c of s.children) { const q = c.getBoundingClientRect(); if (q.height && (q.bottom > r.bottom + 1 || q.top < r.top - 1) && !ys) out.issues.push(`tall: .${String(c.className).split(" ")[0]} leaves the sheet ${Math.round(q.top)}..${Math.round(q.bottom)} vs ${Math.round(r.top)}..${Math.round(r.bottom)}`); }
  const small = new Map();
  const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.nodeValue.trim()) continue; const e = n.parentElement, cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const q = e.getBoundingClientRect(); if (!q.width || !q.height) continue;
    if (e.closest(".cfw")) continue;   // a card's own face is art scaled to fit: its printed text is the card's, not the sheet's
    const px = parseFloat(cs.fontSize);
    if (px < minFont - 0.01) small.set(String(e.className) + "|" + px, `${px}px "${n.nodeValue.trim().slice(0, 18)}" (.${String(e.className).split(" ")[0] || e.tagName.toLowerCase()})`);
  }
  for (const v of small.values()) out.issues.push("text: " + v);
  return out;
}

const tableTag = page => page.evaluate(() => { try { const g = window.__dawnTable.session.state(); const p = (g.promptQ || [])[0]; return p ? p.tag : null; } catch (e) { return null; } });

/* the table, at engine speed: seat 0's AI pilot proposes, the judge disposes (as tapsweep.js), in ONE page task, until the next
   prompt whose tag this hero has not shown yet is at the head of the queue (it is left UNANSWERED for the sheet to be judged),
   the game ends, or `n` submits are spent. Returns {tag} | {over} | {wait} (the other seat holds the move: let its timer run) | {spent}. */
const tableRun = (page, need, n) => page.evaluate(([need, n]) => {
  const T = window.__dawnTable;
  for (let i = 0; i < n; i++) {
    const g = T.session.state(); if (!g) return { over: 1 };
    const pq = (g.promptQ || [])[0];
    if (pq && (pq.side || 0) === 0 && need.includes(pq.tag)) return { tag: pq.tag };
    if (g.over) return { over: 1, err: "gameover " + JSON.stringify(g.over) + " t" + g.turn + " seq" + T.session.seq() };
    const mine = (pq && (pq.side || 0) === 0) || (!pq && g.priority === 0) || g.sides[0].pending; let a;
    try { a = DawnSparring.act(g, 0); } catch (e) { return { over: 1, err: String(e && e.message) }; } if (!a) return { wait: 1 };
    if (!mine && DawnJudge.legal(g, a, 0) !== null) return { wait: 1 };
    T.session.submit(a);
  }
  return { spent: 1 };
}, [need, n]);

/* one trainer step: a random enabled button (not leave / JUDGE!!), as tools/trainchaos.js */
const trainerStep = (page, r) => page.evaluate(r => {
  const bs = [...document.querySelectorAll("button")].filter(b => b.offsetParent && !b.disabled && !b.closest(".judgebtn") && !b.classList.contains("judgebtn") && !b.closest(".bugwrap") && !b.closest(".screennav"));
  const c = bs[Math.floor(r * bs.length)]; if (c) c.click(); }, r).catch(() => {});

async function sweep({ page, w, h, heroes, boards, games, steps, row, seen, log, budgetMs = +(process.env.PS_BUDGET || 20000) }) {
  const has = sel => page.locator(sel).first().isVisible().catch(() => false);
  const home = async () => { await page.reload(); await page.waitForSelector(".hcard", { timeout: 20000 }); };
  const toLoadout = async hi => {
    await page.locator(".hgrid .hcard").nth(hi).click(); await page.waitForSelector(".sheet");
    await page.getByRole("button", { name: /^Battle$/ }).first().click();
    await page.waitForSelector(".rps"); await page.waitForSelector(".rseatpick, .actbar", { timeout: 10000 });
    if (await has(".rseatpick")) await page.locator(".rseatpick .go").click();
    await page.waitForSelector(".actbar", { timeout: 8000 });
  };
  const judgeHere = async (hero, board, tag) => {
    await page.waitForSelector(".psheet", { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);   // the sheet's slide-in
    const f = await page.evaluate(sheetFacts, MINFONT); if (!f) return;
    const r = await judgeScreen(page);
    const bad = ["small", "stolen", "clipped", "overlap"].flatMap(k => r[k].map(x => k + ": " + x.m)).concat(f.issues);
    const kind = tag && KINDS.includes(tag) ? tag : (f.shape === "cards" ? "cards" : f.shape);
    const key = `${hero}|${board}|${kind}`; if (seen.has(key)) return;
    seen.set(key, bad.length ? "FAIL" : "ok");
    row(r.n > 0 && !bad.length, `prompt sweep ${w}x${h}: ${hero} / ${board} / ${kind}`, `${r.n} controls` + (bad.length ? "  " + bad.slice(0, 4).join(" | ") + (bad.length > 4 ? ` (+${bad.length - 4} more)` : "") : ""));
  };
  for (const hi of heroes) {
    await home();
    const hero = (await page.locator(".hgrid .hcard").nth(hi).innerText()).replace(/\s+/g, " ").trim().slice(0, 22);
    for (const board of boards) {
      for (let gi = 0; gi < games; gi++) {
        if (board === "table" && KINDS.every(k => seen.has(`${hero}|table|${k}`))) break;
        try {
          await home(); await toLoadout(hi);
          if (board === "table") {
            await page.locator(".aifoe button").nth((hi + 1 + gi * 5) % (await page.locator(".aifoe button").count())).click(); await page.waitForTimeout(250);
            await page.locator('.lo .actbar [data-start="table"]').click();
          } else await page.locator('.lo .actbar [data-start="trainer"]').click();
          await page.waitForSelector(".board", { timeout: 15000 });
          let seed = gi * 7919 + hi * 31 + 1, last = "";
          const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
          if (board === "table") {
            let spent = 0; const t0 = Date.now();
            while (spent < steps && Date.now() - t0 < budgetMs) {
              const need = KINDS.filter(k => !seen.has(`${hero}|table|${k}`));
              if (!need.length) break;
              const r = await tableRun(page, need, 400); if (process.env.PS_DEBUG) log("   run " + JSON.stringify(r)); spent += r.wait ? 1 : 400;
              if (r.tag) { await page.waitForTimeout(60); await judgeHere(hero, board, r.tag); await tableRun(page, [], 1); /* answer it (no tag asked for) */ seen.set(`${hero}|table|${r.tag}`, seen.get(`${hero}|table|${r.tag}`) || "nosheet"); }
              else if (r.over) break;
              await page.waitForTimeout(r.wait ? 90 : 40);
              if (await has(".reveal")) break;
            }
          } else for (let i = 0; i < steps; i++) {
            if (await has(".reveal")) break;
            await trainerStep(page, rnd());
            await page.waitForTimeout(60);
            if (await has(".psheet")) {
              const sig = await page.locator(".psheet .pt").first().innerText().catch(() => "");
              if (sig !== last) { last = sig; await judgeHere(hero, board, null); }
            } else last = "";
          }
        } catch (e) { log(`  (${hero} ${board} game ${gi}: ${String(e.message).split("\n")[0]})`); }
      }
    }
  }
}

module.exports = { sweep, KINDS, MINFONT, sheetFacts };

if (require.main === module) {
  const { open } = require("./page.js");
  const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
  (async () => {
    const sizes = arg("sizes", "393x852,320x568").split(",").map(x => x.split("x").map(Number));
    const boards = arg("boards", "table,trainer").split(","), games = +arg("games", 3), steps = +arg("steps", 400);
    let bad = 0, n = 0; const results = [];
    const row = (ok, name, detail) => { n++; if (!ok) bad++; console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); };
    for (const [w, h] of sizes) {
      const kit = await open({ w, h }); const seen = new Map();
      await kit.page.waitForSelector(".hcard", { timeout: 20000 });
      const nH = await kit.page.locator(".hgrid .hcard").count();
      const heroes = arg("heroes", "") ? arg("heroes").split(",").map(Number) : [...Array(nH).keys()];
      try { await sweep({ page: kit.page, w, h, heroes, boards, games, steps, row, seen, log: console.log }); }
      catch (e) { row(false, `prompt sweep ${w}x${h}: ran to the end`, String(e && e.message || e).split("\n")[0]); }
      kit.errors.forEach(e => row(false, `prompt sweep ${w}x${h}: page error`, e));
      results.push({ w, h, seen }); await kit.close();
    }
    for (const { w, h, seen } of results) {
      console.log(`\nCOVERAGE ${w}x${h}  (ok / FAIL / . = not reached; trainer kinds are read off the sheet's shape)`);
      const names = [...new Set([...seen.keys()].map(k => k.split("|")[0]))];
      for (const b of boards) {
        const cols = b === "table" ? KINDS : ["opt", "cards", "modal", "soak", "other"];
        console.log(`  ${b}:  ` + " ".repeat(22) + cols.map(k => k.padEnd(8)).join(""));
        for (const hn of names) console.log("    " + hn.padEnd(24) + cols.map(k => (seen.get(`${hn}|${b}|${k}`) || ".").padEnd(8)).join(""));
      }
    }
    console.log(`\n${bad ? "FAIL" : "PASS"}  ${n - bad}/${n} prompt-sweep rows clean`);
    process.exit(bad ? 1 : 0);
  })().catch(e => { console.log("FAIL  " + (e && e.stack || e)); process.exit(1); });
}
