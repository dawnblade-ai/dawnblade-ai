#!/usr/bin/env node
/* ============================================================
   TABLE TALK, DRIVEN (TT0, v7.18) — the new table on the real page (docs/TABLE-TALK.md).

   `talkJudge(page, prefix)` asks of an AI table opened with the switch on (`?talk=1`):
     order     one screen, top to bottom: the bout, their side, the middle, your side, the hand, the hub;
               inside the phone; the board does not scroll
     pad       the bout (the fighting-game life bars, read off the pad) shows each hero's life EXACTLY as
               the engine holds it (the only life display on this table, so a stale bout is a wrong game)
     private   no card the opponent holds face down (hand, arsenal) is named anywhere on the table
               (text or image alt) unless a card of that name is public or yours (TRP 5.1)
     taps      every control takes a 44 px tap, nothing stolen, clipped or overlapping
               (tools/tapjudge.js), measured with no call on the table
     said      after you end your turn the opponent's play is SAID (a call slams in) and SHOWN: the
               glimpse is the very card the engine put on the stack or chain, at least 150 px wide
               where the phone has the room, wholly on screen; a tap moves the call on
   Returns rows as [ok, name, detail]. `talkTo(page)` goes from the roster to such a table.

     result    (v7.20, last: it ends the game) you concede; once the last call is said the end panel holds the pad,
               each column's current total the engine's life, the winner's ringed and no other, GG
   USE   node tools/talk.js            the three phones (393x660, 393x852, 320x568); deps as tools/page.js
         SAB=pad|private|glimpse|result node tools/talk.js    a sabotage, which must FAIL its row
   ============================================================ */
"use strict";
const { open } = require("./page.js");
const { judgeScreen } = require("./tapjudge.js");

async function talkTo(page, { foe = 3 } = {}){
  await page.waitForSelector(".hgrid .hcard", { timeout: 20000 });
  await page.locator(".hgrid .hcard").nth(1).click(); await page.waitForTimeout(250);
  await page.locator("button.battlebtn").first().click(); await page.waitForSelector(".foestep");
  await page.locator('.aifoe button:not([aria-label="The Dummy"]):not([aria-label="A random hero"])').nth(foe).click();
  await page.waitForTimeout(200); await page.locator("[data-foe-go]").click();
  await page.waitForSelector(".rseatpick, .lo", { timeout: 15000 });
  if(await page.locator(".rseatpick").isVisible().catch(() => false)) await page.locator(".rseatpick .go").click();
  await page.waitForSelector(".lo", { timeout: 10000 });
  await page.locator('.lo .actbar [data-start="table"]').click();
  await page.waitForSelector(".board.talk [data-talk-pad]", { timeout: 15000 });
  await page.waitForTimeout(700);
}
/* wait until no call is on the table (a call is transient: a tap would move it on) */
const quiet = page => page.waitForFunction(() => !document.querySelector("[data-talk-call]"), null, { timeout: 15000 }).catch(() => {});

async function talkJudge(page, prefix){
  const out = [];
  await quiet(page);
  /* ---- order ---- */
  const o = await page.evaluate(() => {
    const B = s => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height }; };
    const bout = B("[data-talk-bout]"), them = B('[data-talk-side="them"]'), mid = B(".board.talk .tk-mid"), you = B('[data-talk-side="you"]'),
          hand = B(".board.talk .phand"), hub = B(".actbar"), pad = B("[data-talk-pad]"), bad = [];
    const W = innerWidth, H = innerHeight, board = document.querySelector(".board.talk");
    for(const [k, v] of Object.entries({bout, them, mid, you, hand, hub, pad})) if(!v) bad.push("no " + k);
    if(!bad.length){
      const chain = [["the bout", bout], ["their side", them], ["the middle", mid], ["your side", you], ["the hand", hand], ["the hub", hub]];
      for(let i = 1; i < chain.length; i++) if(chain[i][1].t < chain[i - 1][1].b - 1) bad.push(`${chain[i][0]} (top ${Math.round(chain[i][1].t)}) is not below ${chain[i - 1][0]} (bottom ${Math.round(chain[i - 1][1].b)})`);
      if(mid.h < 120) bad.push(`the middle is ${Math.round(mid.h)} px tall`);
      if(bout.t > 12 || pad.t < bout.t - 1 || pad.b > bout.b + 1 || pad.r > W + 0.5) bad.push("the bout is not across the top");
      if(hub.b > H + 1) bad.push("the hub is off the screen");
      if(document.scrollingElement.scrollWidth > W + 1) bad.push("the page scrolls sideways");
      if(board.scrollHeight > board.clientHeight + 1) bad.push("the board scrolls");
    }
    return { bad, mid: mid ? Math.round(mid.h) : 0 };
  });
  out.push([!o.bad.length, prefix + ": the new table is one screen, in order (the bout, their side, the middle, yours, the hand, the hub)", o.bad.length ? o.bad.join("; ") : "middle " + o.mid + " px"]);
  /* ---- pad ---- */
  const p = await page.evaluate(() => {
    const T = window.__dawnTable, g = T && T.session.state(), me = T ? T.seat : 0;
    const read = k => { const e = document.querySelector(`[data-talk-life="${k}"] .tk-hp`); return e ? +e.textContent.trim() : null; };
    return { you: read("you"), them: read("them"), hp: g ? [g.sides[me].hp, g.sides[1 - me].hp] : null };
  });
  out.push([!!p.hp && p.you === p.hp[0] && p.them === p.hp[1], prefix + ": the bout shows each hero's life exactly as the engine holds it",
            `pad you ${p.you} them ${p.them}; engine ${p.hp && p.hp.join(" / ")}`]);
  /* ---- private ---- */
  const pv = await page.evaluate(() => {
    const T = window.__dawnTable, g = T.session.state(), me = T.seat, foe = g.sides[1 - me], mine = g.sides[me];
    const nm = c => c && (c.name || c.n);
    const pub = new Set();
    for(const sd of g.sides) for(const z of ["grave", "pitch", "banish", "soul"]) (sd[z] || []).forEach(c => pub.add(nm(c)));
    for(const sd of g.sides) (sd.gear || []).forEach(c => pub.add(nm(c)));
    for(const sd of g.sides) (sd.board || []).forEach(b => pub.add(nm(b.card)));
    (g.chainCards || []).forEach(e => pub.add(nm(e && (e.card || e)))); (g.stack || []).forEach(l => l && l.card && pub.add(nm(l.card)));
    if(g.pend && g.pend.card) pub.add(nm(g.pend.card));
    for(const z of ["hand", "deck", "arsenal"]) [].concat(mine[z] || []).forEach(c => pub.add(nm(c)));
    (foe.blockH || []).forEach(u => { const c = (foe.hand || []).find(x => x.uid === u); if(c) pub.add(nm(c)); });
    const secret = [...(foe.hand || []), ...(foe.arsenal && !foe.arsenal._faceUp ? [foe.arsenal] : [])].map(nm).filter(n => n && !pub.has(n));
    const root = document.querySelector(".board.talk");
    const text = root.innerText + " " + [...root.querySelectorAll("img")].map(i => i.alt).join(" | ");
    return { secret, leaked: secret.filter(n => text.includes(n)) };
  });
  out.push([pv.secret.length > 0 && !pv.leaked.length, prefix + ": nothing the opponent holds face down is named on the table (TRP 5.1)",
            pv.leaked.length ? "LEAKED: " + pv.leaked.join(", ") : `${pv.secret.length} hidden cards checked`]);
  /* ---- taps ---- */
  await quiet(page);
  const j = await judgeScreen(page);
  const tb = [...j.small, ...j.stolen, ...j.clipped, ...j.overlap];
  out.push([!tb.length, prefix + ": every control on the new table takes a 44 px tap (nothing stolen, clipped or overlapping)",
            tb.length ? tb.slice(0, 4).map(x => x.m).join(" | ") : `${j.n} controls` + (j.exempt.length ? `, ${j.exempt.length} exempt` : "")]);
  /* ---- said and shown ---- */
  const end = page.locator('.actbar [data-testid="end-turn"]');
  let said = null;
  if(await end.isEnabled().catch(() => false)){
    await end.click().catch(() => {});
    for(let i = 0; i < 160 && !said; i++){
      await page.waitForTimeout(150);
      /* the arsenal step after your turn: leave it empty */
      const leave = page.locator(".actbar button", { hasText: /leave it empty/i });
      if(await leave.count()) await leave.first().click().catch(() => {});
      said = await page.evaluate(() => {
        const c = document.querySelector("[data-talk-call]"); if(!c) return null;
        const k = c.getAttribute("data-talk-call"), img = c.querySelector(".tk-glimpse img, .tk-glimpse .ccfall");
        if(!img || !["attack", "play", "ability", "hero"].includes(k)) return null;
        const T = window.__dawnTable, g = T.session.state();
        const onTable = [g.pend && g.pend.card, ...(g.stack || []).map(l => l && l.card)].filter(Boolean).map(x => x.name);
        const b = c.querySelector(".tk-glimpse").getBoundingClientRect();
        return { k, head: (c.querySelector(".tk-head") || {}).textContent, alt: img.alt || (img.querySelector && (img.querySelector(".pn") || {}).textContent) || "",
                 onTable, w: Math.round(b.width), inside: b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5 };
      });
    }
  }
  const room = (await page.evaluate(() => innerHeight)) >= 640 ? 150 : 100;
  const okSaid = !!said && said.inside && said.w >= room && said.onTable.some(n => n === said.alt || String(said.head).toUpperCase() === n.toUpperCase());
  out.push([okSaid, prefix + ": the opponent's play is said and shown (the glimpse is the card on the stack or chain, on screen, wide enough to read)",
            said ? `${said.k} "${said.head}" glimpse ${said.alt} ${said.w} px (want >= ${room}), on the table: ${said.onTable.join(", ") || "-"}, inside ${said.inside}` : "no play was announced within 24 s of ending the turn"]);
  if(said){
    const before = await page.evaluate(() => { const c = document.querySelector("[data-talk-call]"); return c ? c.textContent : null; });
    await page.locator("[data-talk-call]").click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => { const c = document.querySelector("[data-talk-call]"); return c ? c.textContent : null; });
    out.push([after !== before, prefix + ": a tap moves the call on", `before "${before}", after "${after}"`]);
  }
  /* ---- the result (v7.20): the game ends (you concede) and, once its last call is said, the end panel holds THE PAD —
     each column's current total is the engine's life, and the winner's (theirs) is ringed, nobody else's ---- */
  await page.evaluate(() => window.__dawnTable.session.submit({t: "concede"}));
  const res = await page.waitForSelector("[data-talk-result]", {timeout: 15000}).then(() => page.evaluate(() => {
    const T = window.__dawnTable, g = T.session.state(), me = T.seat, r = document.querySelector("[data-talk-result]");
    const now = k => [...r.querySelectorAll(`.tk-padv.now[data-col="${k}"] > span`)].map(e => +e.textContent.trim());
    const rings = [...r.querySelectorAll(".tk-padv.ring")].map(e => e.getAttribute("data-col"));
    return { you: now("you"), them: now("them"), hp: [g.sides[me].hp, g.sides[1 - me].hp], rings, gg: !!r.querySelector(".tk-gg") };
  })).catch(e => ({ err: String(e.message || e).split("\n")[0] }));
  const okRes = !res.err && res.you.length === 1 && res.them.length === 1 && res.you[0] === res.hp[0] && res.them[0] === res.hp[1]
    && res.rings.length === 1 && res.rings[0] === "them" && res.gg;
  out.push([okRes, prefix + ": the result is the pad (each column's total is the engine's life, the winner's ringed, GG)",
            res.err ? res.err : `you ${res.you} them ${res.them}; engine ${res.hp.join(" / ")}; ringed ${res.rings.join(",") || "-"}`]);
  return out;
}

/* a sabotage, for the drill's own proof (SAB=pad|private|glimpse|result): each must FAIL its row */
const SABOTAGE = {
  pad: `[data-talk-life] .tk-hp{font-size:0} [data-talk-life] .tk-hp::after{content:"99";font-size:20px}`,
  glimpse: `.tk-glimpse{width:60px !important;height:84px !important}`,
};
/* SAB=result rings your column as well, the moment the result appears */
async function sabotage(page, kind){
  if(SABOTAGE[kind]){
    await page.addStyleTag({ content: SABOTAGE[kind] });
    if(kind === "pad") await page.evaluate(() => document.querySelectorAll("[data-talk-life] .tk-hp").forEach(b => { b.textContent = "99"; }));
  }
  if(kind === "result") await page.evaluate(() => { new MutationObserver(() => { const r = document.querySelector("[data-talk-result]"); if(!r) return;
    const y = r.querySelector('.tk-padv.now[data-col="you"]'); if(y && !y.classList.contains("ring")) y.classList.add("ring"); })
    .observe(document.body, {subtree: true, childList: true}); });
  if(kind === "private") await page.evaluate(() => { const T = window.__dawnTable, g = T.session.state(), foe = g.sides[1 - T.seat];
    const c = (foe.hand || [])[0]; const d = document.createElement("span"); d.textContent = c ? c.name : ""; document.querySelector(".board.talk .tk-mid").appendChild(d); });
}

if(require.main === module){
  (async () => {
    const SAB = process.env.SAB || "";
    let fails = 0;
    for(const [w, h] of [[393, 660], [393, 852], [320, 568]]){
      const k = await open({ w, h, query: "?talk=1" });
      try {
        await talkTo(k.page);
        if(SAB) await sabotage(k.page, SAB);
        for(const [ok, name, d] of await talkJudge(k.page, `talk ${w}x${h}`)){ if(!ok) fails++; console.log((ok ? "PASS  " : "FAIL  ") + name + "  " + d); }
      } catch(e){ fails++; console.log(`FAIL  talk ${w}x${h}: the drive ran to the end  ` + String(e && e.message || e).split("\n")[0]); }
      if(k.errors.length){ fails++; console.log(`FAIL  talk ${w}x${h}: page errors  ` + k.errors.join(" | ")); }
      await k.close();
    }
    console.log(fails ? `FAIL  ${fails} row(s)` : "PASS  the new table, three phones");
    process.exit(fails ? 1 : 0);
  })();
}
module.exports = { talkJudge, talkTo };
