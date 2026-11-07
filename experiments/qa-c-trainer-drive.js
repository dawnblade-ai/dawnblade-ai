#!/usr/bin/env node
/* QA reader C — a TRAINER driver that plays like a learning player.
   Built on tools/page.js's open() (deps per its header; NODE_PATH=$(npm root -g)).
   It reads the Battle component's live state through the React fiber of
   `.board` (the trainer exposes no window hook), maps every `.phand .hc`
   button to a card by its React key (the card uid), and taps twice to
   commit, exactly as a thumb does. Every step it records the mode, life,
   the Coach's call and the tap; at the end it dumps the full g.feed.

   USE  HEROES=0,3 GAMES_SEED=1 TURNS=15 OUT=/tmp/x.json node experiments/qa-c-trainer-drive.js
   Output JSON: [{hero, steps:[...], feed:[...], over, errors, judge}]  */
"use strict";
const path = require("path"), fs = require("fs");
const { open } = require(path.join(__dirname, "..", "tools/page.js"));
const HEROES = (process.env.HEROES || "0").split(",").map(Number);
const TURNS = +(process.env.TURNS || 15);
const OUT = process.env.OUT || "qa-c-out.json";
let seed = +(process.env.GAMES_SEED || 7);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* in-page: the Battle state, and the hand/playable buttons with their keys */
function readState() {
  const b = document.querySelector(".board"); if (!b) return null;
  const fk = Object.keys(b).find(k => k.startsWith("__reactFiber")); let f = b[fk];
  while (f && !(f.type && f.type.name === "Battle")) f = f.return;
  if (!f) return { err: "no Battle fiber" };
  let h = f.memoizedState, g = null;
  while (h) { const v = h.memoizedState; if (v && typeof v === "object" && v.sides && "feed" in v) { g = v; break; } h = h.next; }
  if (!g) return { err: "no g" };
  const y = g.sides[0], o = g.sides[1];
  const btns = [...document.querySelectorAll(".phand .hc")].map((el, k) => {
    const rk = Object.keys(el).find(x => x.startsWith("__reactFiber")); const key = el[rk] && el[rk].key;
    return { k, key, dis: el.classList.contains("dis"), sel: el.classList.contains("sel"), txt: el.innerText.replace(/\s+/g, " ").slice(0, 60) };
  });
  const bar = [...document.querySelectorAll(".board .actbar button")].map((el, k) => ({ k, t: el.innerText.trim(), dis: el.disabled }));
  const stat = [...document.querySelectorAll(".statusline button")].map((el, k) => ({ k, t: el.innerText.trim() }));
  const sheet = [...document.querySelectorAll(".psheet button")].filter(e => e.offsetParent && !e.disabled).map((el, k) => ({ k, t: el.innerText.replace(/\s+/g, " ").trim() }));
  const status = [...document.querySelectorAll(".statusline")].map(e => e.innerText.replace(/\s+/g, " ")).join(" | ");
  const adv = [...document.querySelectorAll(".adv .advbody")].map(e => e.innerText.replace(/\s+/g, " ")).join(" | ");
  const card = c => c && { uid: c.uid, name: c.name, pitch: c.pitch, cost: c.cost, pow: c.pow, def: c.def, tt: c.tt };
  return { turn: g.turn, mode: g.mode, bphase: g.bphase, over: g.over || null, incoming: g.incoming,
    hp: [y.hp, o.hp], res: y.res, ap: y.ap, hand: y.hand.map(card), arsenal: card(y.arsenal),
    gear: y.gear.map(x => ({ name: x.name, def: x.def, destroyed: !!x.destroyed, uid: x.uid })), paySel: y.paySel,
    blockH: y.blockH, pend: g.pending ? { name: g.pending.card && g.pending.card.name } : null,
    feedN: (g.feed || []).length, feed: g.feed, status, btns, bar, stat, sheet, adv,
    prompt: (g.promptQ || [])[0] ? JSON.stringify((g.promptQ || [])[0]).slice(0, 200) : null };
}

(async () => {
  const kit = await open({ w: 393, h: 852 }); const { page, errors } = kit;
  const games = [];
  const btn = re => page.getByRole("button", { name: re });
  const has = sel => page.locator(sel).first().isVisible().catch(() => false);
  for (const hi of HEROES) {
    const G = { heroIdx: hi, steps: [], errors: [], adv: [] }; games.push(G);
    try {
      await page.locator("nav.tabs .tab", { hasText: "Heroes" }).click().catch(() => {});
      await page.locator(".hgrid .hcard").nth(hi).click(); await page.waitForSelector(".sheet");
      G.hero = (await page.locator(".sheet h2, .sheet h1").first().innerText()).replace(/\s+/g, " ");
      await btn(/^Battle$/).click(); await page.waitForSelector(".rseatpick, .actbar", { timeout: 10000 });
      if (await has(".rseatpick")) await page.locator(".rseatpick .go").click();
      await page.waitForSelector(".actbar"); await page.locator(".actbar .battlebtn").click();
      await page.waitForSelector(".board", { timeout: 8000 });
      page.setDefaultTimeout(4000);
      /* open the advisor if collapsed */
      if (!(await has(".adv .advbody"))) await page.locator(".adv .advhead").click({ force: true }).catch(() => {});
      let same = 0, lastSig = "", lastAdv = "";
      const tap2 = async (k) => { const l = page.locator(".phand .hc").nth(k); await l.click({ timeout: 3000, force: true }); await page.waitForTimeout(120); await l.click({ timeout: 3000, force: true }); };
      const bar = async (re) => { const s = await page.evaluate(readState); const b = s.bar.find(x => new RegExp(re.source, "i").test(x.t) && !x.dis); if (!b) return false; await page.locator(".board .actbar button").nth(b.k).click({ timeout: 3000, force: true }); return b.t; };
      for (let step = 0; step < 600; step++) {
        const s = await page.evaluate(readState);
        if (!s || s.err) { G.errors.push("state: " + (s && s.err)); break; }
        if (s.over) { G.over = s.over; break; }
        if (s.turn > TURNS) { G.over = { cut: "turn cap" }; break; }
        if (s.adv && s.adv !== lastAdv) { G.adv.push({ turn: s.turn, mode: s.mode, hp: s.hp, res: s.res, ap: s.ap, inc: s.incoming, hand: s.hand.map(c => c.name + "/" + c.pitch + "/" + c.pow + "/" + c.def), ars: s.arsenal && s.arsenal.name, gear: s.gear.filter(x => !x.destroyed).map(x => x.name), adv: s.adv }); lastAdv = s.adv; }
        const sig = JSON.stringify([s.mode, s.bphase, s.feedN, s.hand.length, s.paySel, s.blockH, s.res, s.ap, s.prompt, s.sheet.length]);
        if (sig === lastSig) { if (++same > 6) { G.errors.push("STUCK " + JSON.stringify({ mode: s.mode, bphase: s.bphase, bar: s.bar, stat: s.stat, sheet: s.sheet, prompt: s.prompt, last: G.steps.slice(-3), feed: s.feed.slice(-4) })); break; } } else same = 0;
        lastSig = sig;
        let did = null;
        const byUid = u => s.btns.find(b => String(b.key) === String(u));
        const live = s.btns.filter(b => !b.dis);
        try {
          if (s.sheet.length) {
            const pick = s.sheet.find(b => /confirm|done|keep|accept|ok|take|yes/i.test(b.t)) || s.sheet[Math.floor(rnd() * s.sheet.length)];
            await page.evaluate(k => [...document.querySelectorAll(".psheet button")].filter(e => e.offsetParent && !e.disabled)[k].click(), pick.k); did = "sheet:" + pick.t;
          } else if (s.mode === "pay") {
            const pool = s.hand.map((c, i) => ({ c, i })).filter(x => !s.paySel.includes(x.i) && x.c.uid !== (s.pend && s.pend.uid));
            if (/covered/.test(s.status)) { did = "confirm " + await bar(/Pitch & play/); }
            else {
              /* a learner pitches the blue first */
              pool.sort((a, b) => (b.c.pitch || 0) - (a.c.pitch || 0));
              const x = pool.find(p => byUid(p.c.uid) && p.c.name !== (s.pend && s.pend.name));
              if (x && same < 3) { await tap2(byUid(x.c.uid).k); did = "pitch " + x.c.name; }
              else { did = "cancel " + await bar(/Cancel/); }
            }
          } else if (s.mode === "arsenal") {
            const cands = s.hand.filter(c => byUid(c.uid));
            if (cands.length && rnd() < 0.7) { const c = cands[Math.floor(rnd() * cands.length)]; await tap2(byUid(c.uid).k); did = "arsenal " + c.name; }
            else { await page.locator(".statusline button", { hasText: "skip" }).click({ force: true }); did = "skip arsenal"; }
          } else if (s.mode === "block" && s.bphase === "defend") {
            const chosen = s.btns.filter(b => b.sel).length;
            const blockers = live.filter(b => !b.sel);
            if (s.incoming >= 3 && chosen < 2 && blockers.length && rnd() < 0.75) { const b = blockers[Math.floor(rnd() * blockers.length)]; await tap2(b.k); did = "block " + b.txt; }
            else did = "defend->react " + await bar(/Defend|Take it/);
          } else if (s.mode === "block") {
            if (live.length && rnd() < 0.6 && !G.steps.slice(-2).some(x => x.did.startsWith("dr"))) { const b = live[Math.floor(rnd() * live.length)]; await tap2(b.k); did = "dr " + b.txt; }
            else did = "resolve " + await bar(/Resolve damage/);
          } else if (s.mode === "stack") {
            if (live.length && rnd() < 0.5 && !G.steps.slice(-2).some(x => x.did.startsWith("ar"))) { const b = live[Math.floor(rnd() * live.length)]; await tap2(b.k); did = "ar " + b.txt; }
            else did = "pass " + await bar(/Pass/);
          } else if (s.mode === "act") {
            const tried = new Set(G.steps.filter(x => x.turn === s.turn && x.did.startsWith("play")).map(x => x.key));
            const opts = live.filter(b => !tried.has(b.key));
            if (opts.length && rnd() < 0.85) { const b = opts[Math.floor(rnd() * opts.length)]; await tap2(b.k); did = "play " + b.txt; G._key = b.key; }
            else did = "end " + await bar(/End turn/);
          } else if (s.bar.length) {
            /* boostpick, fusepick, chargepick, xpick, discpick, foeturn, ... : pick a bar button */
            const ok = s.bar.filter(b => !b.dis); const b = ok[Math.floor(rnd() * ok.length)];
            await page.locator(".board .actbar button").nth(b.k).click({ force: true }); did = s.mode + ":" + b.t;
          } else { await page.waitForTimeout(300); did = "wait"; }
        } catch (e) { G.errors.push("tap: " + String(e.message).split("\n")[0]); did = "err"; }
        G.steps.push({ turn: s.turn, mode: s.mode, bphase: s.bphase, hp: s.hp, res: s.res, ap: s.ap, did, key: G._key });
        G._key = undefined;
        await page.waitForTimeout(220);
      }
      const s = await page.evaluate(readState);
      G.feed = s && s.feed; G.final = s && { turn: s.turn, hp: s.hp, mode: s.mode, over: s.over };
      G.judge = await page.evaluate(() => window.__dawnJudge || null);
      G.reveal = await has(".reveal") ? (await page.locator(".reveal").innerText()).slice(0, 200) : null;
      G.boardBlank = await page.evaluate(() => document.body.innerText.trim().length < 20);
    } catch (e) { G.errors.push("driver: " + String(e.message).split("\n")[0]); }
    G.pageErrors = errors.splice(0);
    console.log(G.hero, JSON.stringify(G.final), "errors", G.errors.length, "pageErrors", G.pageErrors.length, "judge", JSON.stringify(G.judge));
    /* back home */
    await page.reload(); await page.waitForSelector(".shell"); await page.waitForTimeout(1200);
  }
  fs.writeFileSync(OUT, JSON.stringify(games, null, 1));
  await kit.close();
})().catch(e => { console.log("FAIL", e.stack); process.exit(1); });
