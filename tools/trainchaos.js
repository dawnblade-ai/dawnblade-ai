#!/usr/bin/env node
/* ============================================================
   CHAOS AT THE TRAINER — random taps on the REAL page.

   tools/chaos.js mixes random LEGAL moves into self-play at the table
   (judge.js), where `legal` enumerates every move. The trainer has no
   such list: its doors live in index.html's `Battle`, and the only
   honest enumeration of "what a person could do" is every button the
   screen offers. So this drives the real page (tools/page.js's offline
   open(), the phone viewport) and taps a random enabled button, over and
   over, through whole games.

   A card tile is a two-tap (peek, then commit — `tapTwice`), so a tapped
   tile is tapped again most of the time; the rest of the time the peek is
   left open and something else is tapped, which is also a thing a thumb
   does.

   WHAT IS A FINDING
     pageerror / console.error   anything thrown in the page (React's own
                                 errors included) — `[dawnblade judge]`
                                 lines are the trainer's invariant judge
                                 (setG runs engine/invariants.js on every
                                 state change)
     window.__dawnJudge          the same judge's record, read directly
     STUCK                       no enabled button anywhere for 20s while
                                 the game is not over
   A finding is printed with the hero, the seed and the last taps.

   MEASURED ONCE, WORTH KNOWING (2026-11-22): the first cut fired a tile's
   two taps as two .click() calls in ONE page task. React had not re-rendered
   between them, so both read the same closure: with the peek already armed,
   both COMMITTED and a card was played twice (CARD-DUP-IN-ZONE, Lyath's
   Concealed Object, Viserai BW's Runic Disposition). A thumb cannot do that
   (each real tap is its own event and React flushes between them), so each
   tap is now its own task. The handlers trust that flush; nothing else does.

   NOT TAPPED: JUDGE!! (opens the bug sheet — a person's report, not
   play), "leave" (ends the run), the sound toggle, and anything outside
   the board/sheets while a game runs.

   USE (deps as tools/page.js's header; PAGE_DEPS names them)
     node tools/trainchaos.js                 every hero, 1 game each, seed 1
     node tools/trainchaos.js <hero#|name> <games> <seed>
     TAPS=600 (cap per game)   PAUSE=60 (ms between taps)
   Exit 0 = clean. Not part of `npm test` (it needs a browser).
   ============================================================ */
"use strict";
const { open } = require("./page");

const TAPS = +(process.env.TAPS || 600);
const PAUSE = +(process.env.PAUSE || 60);
const [heroArg = "", gamesArg = "1", seedArg = "1"] = process.argv.slice(2);

/* mulberry32: a tiny seeded rng, so a finding replays with its seed */
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* every enabled, visible button a thumb could reach in play, as {i, t, tile} */
const CANDS = () => {
  const skip = /^(leave|♪|♪̸)$/i;
  return [...document.querySelectorAll("button")].map((b, i) => ({ b, i }))
    .filter(({ b }) => b.offsetParent && !b.disabled && !b.closest(".judgebtn") && !b.classList.contains("judgebtn")
      && !b.closest(".bugwrap") && !b.closest(".screennav")
      && !skip.test(b.innerText.replace(/\s+/g, " ").trim()))
    .map(({ b, i }) => ({ i, t: b.innerText.replace(/\s+/g, " ").trim().slice(0, 40),
      tile: b.classList.contains("hc") || b.classList.contains("g") || b.classList.contains("b") }));
};

async function oneGame(kit, heroIx, seed, log){
  const { page, errors } = kit;
  const r = rng(seed);
  const taps = [];
  const e0 = errors.length;
  const judge = () => page.evaluate(() => (window.__dawnJudge || []).length).catch(() => 0);
  const j0 = await judge();
  /* to the trainer: hero, Battle, the coin, Fight */
  await page.locator(".hcard").nth(heroIx).click();
  const hero = await page.locator(".sheet .shn, .sheet h2, .sheet .hname").first().innerText().catch(() => "hero " + heroIx);
  await page.locator("button", { hasText: /^Battle$/ }).first().click();
  await page.waitForSelector(".rps", { timeout: 8000 });
  await page.waitForSelector(".rseatpick, .actbar", { timeout: 8000 });
  if(await page.locator(".rseatpick").count()) await page.locator(".rseatpick button").nth(Math.floor(r() * 2)).click();
  await page.waitForSelector('.lo .actbar [data-start="trainer"]', { timeout: 8000 });
  await page.locator('.lo .actbar [data-start="trainer"]').click();
  await page.waitForSelector(".board", { timeout: 8000 });
  let idle = 0, over = false, n = 0;
  for(; n < TAPS; n++){
    if(await page.locator(".reveal").count()){ over = true; break; }
    const c = await page.evaluate(CANDS);
    if(!c.length){
      if(++idle > 20000 / 250) break;
      await page.waitForTimeout(250); n--; continue;
    }
    idle = 0;
    const pick = c[Math.floor(r() * c.length)];
    const twice = pick.tile && r() < 0.75;
    taps.push(pick.t + (twice ? " ×2" : ""));
    /* each tap is its own task, as two thumb taps are: React flushes between them
       (two .click() calls in ONE evaluate both read the pre-render closure) */
    const tap = () => page.evaluate(([i, t]) => { const b = document.querySelectorAll("button")[i];
      if(b && b.innerText.replace(/\s+/g, " ").trim().slice(0, 40) === t) b.click(); }, [pick.i, pick.t]);
    await tap();
    if(twice){ await page.waitForTimeout(40); await tap(); }
    await page.waitForTimeout(PAUSE);
  }
  const j1 = await judge();
  const found = errors.slice(e0);
  if(j1 > j0) found.push(...(await page.evaluate(() => window.__dawnJudge)).slice(j0).map(v => `JUDGE ${v.code} (turn ${v.turn}, ${v.mode}): ${v.msg}`));
  if(!over && n < TAPS) found.push("STUCK: no enabled button for 20s");
  const turn = await page.evaluate(() => { const s = document.querySelector(".statusline"); return s ? s.innerText.replace(/\s+/g, " ").slice(0, 60) : ""; }).catch(() => "");
  log(`${found.length ? "FIND" : "ok  "}  ${hero.replace(/\s+/g, " ").slice(0, 24).padEnd(24)} seed ${seed}  ${n} taps  ${over ? "game over" : "cap"}  ${turn}`);
  for(const f of found) log("      " + f + "\n      last taps: " + taps.slice(-12).join(" · "));
  return found.length;
}

(async () => {
  const t0 = Date.now();
  let kit;
  try { kit = await open({ w: 393, h: 852 }); }
  catch(e){ console.log("FAIL  load: " + e.message); process.exit(2); }
  const { page } = kit;
  await page.waitForSelector(".hcard", { timeout: 20000 });
  const heroes = await page.locator(".hcard").allInnerTexts();
  const pickH = heroArg === "" ? heroes.map((_, i) => i)
    : /^\d+$/.test(heroArg) ? [+heroArg]
    : heroes.map((t, i) => [t, i]).filter(([t]) => t.toLowerCase().includes(heroArg.toLowerCase())).map(([, i]) => i);
  let finds = 0, games = 0;
  for(const h of pickH) for(let k = 0; k < +gamesArg; k++){
    const seed = (+seedArg) * 1000 + h * 31 + k;
    try { finds += await oneGame(kit, h, seed, s => console.log(s)); }
    catch(e){ finds++; console.log(`FIND  hero ${h} seed ${seed}: drive threw ${String(e.message).split("\n")[0]}`); }
    games++;
    /* back to the title for the next game: a reload is the one clean reset */
    await page.reload(); await page.waitForSelector(".hcard", { timeout: 20000 });
  }
  console.log(`\n${finds ? "FINDINGS " + finds : "CLEAN"}  ${games} game(s), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await kit.close();
  process.exit(finds ? 1 : 0);
})();
