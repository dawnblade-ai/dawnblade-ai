#!/usr/bin/env node
/* ============================================================
   CHAOS AT THE NEW SHELL — random taps on the REAL play.html, whole games (README step 9, parity with tools/trainchaos.js).

   tools/chaos.js mixes random LEGAL moves into self-play at the engine; tools/trainchaos.js taps random buttons on the trainer.
   This does the same for CRESCENDO: it opens play.html?hero=X&foe=Y&seed=N&first=F&pace=0 at 393x660 (tools/ui-drive.js's launch and
   openPage, so the routing is the drive's) and, step after step, either TAPS a random enabled, visible control a thumb could reach
   (hand cards, permanents, the primary, a sheet's answers, the menu and pad opening and closing) or plays what the coach would
   (the session's own `suggest`, submitted through the session: the "sensible" move that lets games end). The mix is seeded.

   NOT TAPPED: Concede (it would end every game at once), JUDGE!! send, the Classic board link, anything that leaves the page.

   A FINDING (exit 1) is, per game:
     page error        pageerror / console.error / an unrouted network request
     INVARIANT         DawnInvariants.check on EVERY state the session pushes: any `error` severity
     POLICY REFUSED    the AI seat proposed an action the judge refused (session event "policy-refused") — a policy bug
     STALLED           the session's own "stalled" event (the other seat took 400 actions without stopping)
     STUCK             the state stopped changing for STALL steps while the game was not over (the coach included)
     NO RESULT         the step cap was reached with the game not over
   A player's own tap the judge refuses ("refused") is the table saying why, by name: it is COUNTED, never a finding.
   Every line prints the replay: the page URL, the chaos seed, and the tap index of the finding.

   USE   (deps as tools/page.js's header: PAGE_DEPS; `playwright` must resolve)
     node tools/ui-chaos.js                       every hero as "you" once (foe rotated), Chromium, then 3 games on WebKit
     node tools/ui-chaos.js --hero fai --foe dash --seed 7 [--games 2]     one hero
     node tools/ui-chaos.js --engine chromium|webkit  --coach 1 [--tries 4] --hold 0.05  --budget 600 (seconds, default 600)  --taps 1200  --stall 60  --pause 12
     node tools/ui-chaos.js --replay "<url>" --rseed N                    play one game again with its chaos seed
   Exit 0 = clean. Not part of `npm test` (it needs a browser). Pure helpers (rng, candidate filter, plan, replay) are exported.
   ============================================================ */
"use strict";
const path = require("path");
const { pathToFileURL } = require("url");

/* mulberry32: a tiny seeded rng, so a finding replays with its seed */
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- pure: what to play, in what order ---------- */
/* every hero once as "you", the foe rotated through the others; seeds named by the hero's place */
function plan(keys, o){
  o = o || {};
  const n = keys.length, base = o.seed == null ? 1 : +o.seed, gamesEach = o.games || 1, out = [];
  keys.forEach((hero, i) => {
    if(o.hero && o.hero !== hero) return;
    for(let g = 0; g < gamesEach; g++){
      let foe = o.foe || keys[(i + 5 + g * 3) % n];
      if(foe === hero) foe = keys[(i + 1) % n];
      out.push({ hero, foe, seed: base * 1000 + i * 31 + g, first: (i + g) % 2, rseed: base * 7919 + i * 101 + g });
    }
  });
  return out;
}
const urlOf = (game, base) => (base == null ? "play.html" : base) + `?hero=${game.hero}&foe=${game.foe}&seed=${game.seed}&first=${game.first}&pace=0`;
/* the one line that replays a finding */
const replayLine = (game, tapAt, base) => `node tools/ui-chaos.js --replay "${urlOf(game, base)}" --rseed ${game.rseed}   (finding at step ${tapAt})`;

/* a candidate control: visible, enabled, not one of the never-tapped ones */
const SKIP_B = /^(row-concede|concede|report-send|row-classic|row-report|gear|keep)$/;
function allowed(c){
  if(!c || !c.vis || c.disabled) return false;
  if(c.b && SKIP_B.test(c.b)) return false;
  if(/^(concede|leave)$/i.test((c.t || "").trim())) return false;
  if(c.href) return false;
  return true;
}
/* the choice at one step: "coach" (the session's own suggestion) or a tap on one candidate */
function choose(r, cands, pCoach){
  const ok = cands.filter(allowed);
  if(!ok.length || r() < (pCoach == null ? 0.22 : pCoach)) return { coach: true };
  return { tap: ok[Math.floor(r() * ok.length)] };
}
/* the game's step cap and stall rule */
const stuck = (since, limit) => since >= limit;
/* a card in the player's own hand is face up: a hold on it MUST open the inspect panel; others (a mat card, the chain) may */
const holdable = c => allowed(c) && /^(hand-\d+|you-slot-(weapon|head|chest|arms|legs)|opp-slot-(weapon|head|chest|arms|legs)|attack)$/.test(c.b || "");
const mustInspect = c => /^hand-\d+$/.test(c.b || "");

/* ---------- in the page ---------- */
const HOOK = () => {
  const s = window.DawnUIApp && window.DawnUIApp.session && window.DawnUIApp.session();
  if(!s) return false;
  const c = window.__chaos = { n: 0, viol: [], ev: [], refused: 0, over: null };
  const seen = new Set();
  s.subscribe(st => {
    c.n++;
    if(st && st.over) c.over = st.over;
    try {
      window.DawnInvariants.check(st).forEach(v => {
        if(v.severity !== "error") return;
        const k = v.code + "|" + (v.where || "");
        if(!seen.has(k)){ seen.add(k); c.viol.push(`INVARIANT ${v.code} (turn ${st.turn}): ${v.msg}`); }
      });
    } catch(e){ c.viol.push("INVARIANT check threw: " + e.message); }
  });
  s.onEvent(e => { if(e.t === "policy-refused") c.ev.push("POLICY REFUSED: " + JSON.stringify(e.action) + " - " + e.reason); else if(e.t === "stalled") c.ev.push("STALLED: " + e.reason); else if(e.t === "refused") c.refused++; });
  return true;
};
const CANDS = () => {
  const vis = e => { const r = e.getClientRects(); if(!r.length) return false; const cs = getComputedStyle(e);
    if(cs.visibility === "hidden" || cs.display === "none") return false;
    for(let p = e; p && p.nodeType === 1; p = p.parentElement) if(getComputedStyle(p).opacity === "0") return false;
    const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; };
  return [...document.querySelectorAll("button, [data-tap], [role=button], a[href]")].map((e, i) => ({ i, e })).filter(({ e }) => !e.closest(".stage.fail"))
    .map(({ e, i }) => ({ i, b: e.getAttribute("data-b") || "", t: (e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40),
      vis: vis(e), disabled: e.disabled || e.getAttribute("aria-disabled") === "true" || e.classList.contains("dis") || !!e.closest(".dis"), href: e.tagName === "A" })).filter(c => c.vis);
};
const TAP = ([i, b, t]) => {
  const e = [...document.querySelectorAll("button, [data-tap], [role=button], a[href]")][i];
  if(!e || (e.getAttribute("data-b") || "") !== b) return false;
  e.click(); return true;
};
/* a HOLD (400 ms, SCREENS-TABLE 2) is pointerdown ... pointerup on the element: the inspect panel opens on a card that is face up */
const HOLD_DOWN = ([i, b]) => { const e = [...document.querySelectorAll("button, [data-tap], [role=button], a[href]")][i];
  if(!e || (e.getAttribute("data-b") || "") !== b) return false;
  const r = e.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: "touch", isPrimary: true, button: 0 };
  window.__held = { e, o }; e.dispatchEvent(new PointerEvent("pointerdown", o)); return true; };
const HOLD_UP = () => { const h = window.__held; if(h){ h.e.dispatchEvent(new PointerEvent("pointerup", h.o)); window.__held = null; } };
const INSPECT = () => !!document.querySelector('[data-b="inspect-card"]');
const CLOSE_INSPECT = () => { const v = document.querySelector('[data-b="veil"]'); if(v) v.click(); };
const COACH = () => { const s = window.DawnUIApp.session(), a = s.suggest(); if(!a) return "none"; const why = s.submit(a); return why ? "refused: " + why : "ok"; };
const STATE = () => { const s = window.DawnUIApp.session(); if(!s) return null; const st = s.state(); return { over: st.over || null, turn: st.turn, hp: st.sides.map(x => x.hp), n: window.__chaos ? window.__chaos.n : 0 }; };

/* ---------- one game ---------- */
async function oneGame(D, pw, browser, engine, game, o, log){
  const errors = [], r = rng(game.rseed);
  const url = pathToFileURL(D.PLAY).href + urlOf(game, "") + (o.coach ? "&search=0" : "");
  const a = await D.openPage(pw, browser, engine, [393, 660], url, errors);
  const page = a.page, finds = [];
  let steps = 0, since = 0, lastN = -1, over = null, coach = 0, taps = 0, coachBad = 0, holds = 0, opened = 0;
  try {
    await page.waitForSelector('[data-b="bout"]', { timeout: 15000 });
    await page.waitForFunction(() => window.DawnUIApp && window.DawnUIApp.session(), null, { timeout: 8000 });
    if(!(await page.evaluate(HOOK))) throw new Error("no session to hook");
    for(; steps < o.taps; steps++){
      const st = await page.evaluate(STATE);
      if(!st) throw new Error("the session is gone");
      if(st.over){ over = st.over; break; }
      if(st.n !== lastN){ lastN = st.n; since = 0; } else since++;
      if(stuck(since, o.stall)){ finds.push(`STUCK: the state did not change for ${o.stall} steps (turn ${st.turn})`); break; }
      const cands = await page.evaluate(CANDS);
      const hc = !o.coach && r() < o.hold ? cands.filter(holdable) : [];
      if(hc.length){
        const c = hc[Math.floor(r() * hc.length)];
        holds++;
        await page.evaluate(HOLD_DOWN, [c.i, c.b]); await page.waitForTimeout(470);
        const open = await page.evaluate(INSPECT);
        await page.evaluate(HOLD_UP); await page.waitForTimeout(60);
        if(mustInspect(c) && !open) finds.push(`INSPECT: a 400 ms hold on ${c.b} did not open the panel (step ${steps})`);
        if(open){ opened++; await page.evaluate(CLOSE_INSPECT); await page.waitForTimeout(80); if(await page.evaluate(INSPECT)) finds.push(`INSPECT: the panel opened from ${c.b} did not close (step ${steps})`); }
        if(finds.length) break;
        continue;
      }
      const pick = o.coach ? { coach: true } : choose(r, cands, since > 8 ? 0.7 : 0.22);
      if(pick.coach){ coach++; const res = await page.evaluate(COACH); if(res !== "ok") coachBad++; }
      else { taps++; await page.evaluate(TAP, [pick.tap.i, pick.tap.b, pick.tap.t]); }
      await page.waitForTimeout(o.pause);
    }
    if(!over){ const st = await page.evaluate(STATE); if(st && st.over) over = st.over; }
    if(!over && !finds.length){ const st = await page.evaluate(STATE); finds.push(`NO RESULT: ${o.taps} steps and the game is not over (turn ${st && st.turn}, life ${st && st.hp}, ${st && st.n} states pushed)`); }
    const c = await page.evaluate(() => window.__chaos);
    if(c){ finds.push(...c.viol, ...c.ev); game.refused = c.refused; }
    /* the result must SHOW: the KO word (a win) or the result frame, once the game is over */
    if(over && !finds.length){
      try { await page.waitForSelector('[data-b="result-ko"], [data-b="result-pad"], [data-b="word"]', { timeout: 6000 }); }
      catch(e){ finds.push("the game is over (" + JSON.stringify(over) + ") but no result screen appeared"); }
      if(over.winner === 0){   /* the player won: the KO word, DAWN above BREAK, and "You win" (Q11) */
        const w = await page.evaluate(() => { const e = document.querySelector('[data-b="word"]'); return e ? { b: [...e.querySelectorAll("b")].map(x => x.textContent.trim().toUpperCase()).join("|"), s: (e.querySelector("span") || {}).textContent } : null; });
        if(!w) finds.push("you won but the KO word never showed"); else if(w.b !== "DAWN|BREAK" || !/^you win$/i.test(w.s || "")) finds.push("the win frame reads " + JSON.stringify(w));
      }
    }
  } catch(e){ finds.push("drive threw: " + String(e.message).split("\n")[0]); }
  errors.forEach(e => finds.push(e));
  await a.context.close();
  const res = over ? (over.winner === null ? "draw" : "seat " + over.winner + " won (" + over.how + ")") : "no result";
  log(`${finds.length ? "FIND" : "ok  "}  ${engine.padEnd(8)} ${(game.hero + " v " + game.foe).padEnd(26)} seed ${String(game.seed).padEnd(6)} ${String(steps).padStart(4)} steps (${taps} taps, ${coach} coach${coachBad ? ", " + coachBad + " coach no-ops" : ""}, ${holds} holds/${opened} inspects, ${game.refused || 0} refused taps)  ${res}`);
  finds.forEach(f => log("      " + f));
  if(finds.length) log("      replay: " + replayLine(game, steps));
  game.over = over;
  return finds.length;
}

async function main(){
  const argv = process.argv.slice(2), arg = n => argv.includes(n) ? argv[argv.indexOf(n) + 1] : null;
  let pw;
  try { pw = require("playwright"); } catch(e){ console.error("tools/ui-chaos.js needs `playwright` (set NODE_PATH)"); return process.exit(2); }
  const D = require("./ui-drive.js");
  const t0 = Date.now(), budget = (+arg("--budget") || 600) * 1000;
  const o = { coach: arg("--coach") === "1", tries: +arg("--tries") || 4, hold: arg("--hold") != null ? +arg("--hold") : 0.05, taps: +arg("--taps") || 1200, stall: +arg("--stall") || 60, pause: arg("--pause") != null ? +arg("--pause") : 12 };
  const engines = arg("--engine") ? [arg("--engine")] : ["chromium", "webkit"];
  /* the hero keys come from the page's own data, so the list is never a copy */
  const keys = require("../test/helpers/extract").loadData().HEROES.map(h => h.k);
  let finds = 0, games = 0, skipped = 0;
  const jobs = [];
  if(arg("--replay")){
    const q = new URL(arg("--replay"), "file:///x/"), g = { hero: q.searchParams.get("hero"), foe: q.searchParams.get("foe"), seed: q.searchParams.get("seed"), first: +q.searchParams.get("first") || 0, rseed: +arg("--rseed") || 1 };
    jobs.push({ engine: engines[0], game: g });
  } else for(const engine of engines){
    const list = plan(keys, { seed: arg("--seed"), hero: arg("--hero"), foe: arg("--foe"), games: +arg("--games") || 1 });
    const pickN = engine === "webkit" && !arg("--hero") && !arg("--engine") ? list.filter((_, i) => i % Math.ceil(list.length / 3) === 0) : list;
    pickN.forEach(g => jobs.push({ engine, game: g }));
  }
  if(!engines.includes("webkit") === false && !D.webkitBinary() && !arg("--engine")){ console.log("\n######## WEBKIT DID NOT RUN ######## (no pw_run.sh under /opt/pw-webkit; PW_WEBKIT names one)\n"); finds++; }
  const browsers = {};
  for(const j of jobs){
    if(Date.now() - t0 > budget){ skipped++; continue; }
    if(j.engine === "webkit" && !D.webkitBinary()) continue;
    const browser = browsers[j.engine] || (browsers[j.engine] = await D.launch(pw, j.engine));
    try {
      if(o.coach){   /* the coach plays every step against the Steady foe; a seed that does not let it win is tried again (reported) */
        let won = false; const tried = [];
        for(let t = 0; t < o.tries && !won; t++){
          const g = {...j.game, seed: +j.game.seed + t * 7};
          const f = await oneGame(D, pw, browser, j.engine, g, o, s => { if(g.over === undefined) console.log(s); });
          tried.push(g.seed); finds += f; won = !!(g.over && g.over.winner === 0); if(f) break;
        }
        if(!won && !finds){ finds++; console.log(`FIND  ${j.engine} ${j.game.hero}: the coach did not win on seeds ${tried.join(", ")}`); }
      } else finds += await oneGame(D, pw, browser, j.engine, j.game, o, s => console.log(s));
    }
    catch(e){ finds++; console.log(`FIND  ${j.engine} ${j.game.hero}: ${String(e.message).split("\n")[0]}`); }
    games++;
  }
  for(const b of Object.values(browsers)) await b.close();
  console.log(`\n${finds ? "FINDINGS " + finds : "CLEAN"}  ${games} game(s), ${((Date.now() - t0) / 1000).toFixed(0)}s${skipped ? `, ${skipped} not started (budget ${budget / 1000}s)` : ""}`);
  process.exit(finds ? 1 : 0);
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(2); });
module.exports = { rng, plan, urlOf, replayLine, allowed, choose, stuck, holdable, mustInspect };
