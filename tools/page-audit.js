#!/usr/bin/env node
/* ============================================================
   THE 1.0 POLISH AUDIT DRIVE — every hero, both boards, at 393x852.

   Built on tools/page.js's open() (same deps, same offline routing; read
   its header). For each hero on the roster (HEROES=0,3,7 to pick some):
     - the TRAINER: tap through STEPS moves (hand cards two-tap, the sheet,
       the action bar), measuring the screen every few taps, then JUDGE!!;
     - the TABLE vs an AI hero: seat 0 is driven by the seat policy itself
       through the page's own session (window.__dawnTable), so a full game
       plays out on the real board and every prompt addressed to seat 0 is
       measured while it is on screen.
   Each measurement asks element boxes, never pixels: horizontal scroll,
   controls under 44px, overlapping controls, a control whose centre tap
   lands on something else, text wider than its box, page errors. It also
   harvests the feed and the advisor's lines. Output: AUDIT_OUT (JSON).

   Findings are deduplicated by shape; a "stuck" or "stuck-screen" row is a
   lead to reproduce, not a verdict (the trainer driver taps blind).
   NOT part of npm test. docs/archive/POLISH-AUDIT-1.0.md is what it found.
   ============================================================ */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const { open } = require(path.join(ROOT, "tools/page.js"));
const W = 393, H = 852;
const OUT = process.env.AUDIT_OUT || path.join(require("os").tmpdir(), "dawnblade-page-audit.json");
const ONLY = process.env.HEROES ? process.env.HEROES.split(",").map(Number) : null;
const STEPS = +(process.env.STEPS || 40);

const findings = [];   // {kind, where, detail}
const seenF = new Set();
const note = (kind, where, detail) => {
  const key = kind + "|" + (kind === "small-target" || kind === "spill" ? "" : where) + "|" + detail.replace(/\d+(\.\d+)?/g, "#");
  if (seenF.has(key)) return; seenF.add(key);
  findings.push({ kind, where, detail }); console.log("  !!", kind, where, detail);
};
const feedLines = {}, advLines = {}, promptKinds = {}, screensSeen = [];

/* the box judge — runs in the page */
function judgeBoxes({ W, H }) {
  const out = { sw: document.scrollingElement.scrollWidth, small: [], overlap: [], spill: [], occluded: [], offscreen: [] };
  const vis = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return null;
    if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return null;
    /* clipped away by an ancestor scroller? */
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p); if (ps.overflowX !== "visible" || ps.overflowY !== "visible") {
        const pr = p.getBoundingClientRect();
        if (r.right <= pr.left + 1 || r.left >= pr.right - 1 || r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1) return null;
      } }
    return r; };
  const name = el => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "") +
    " \"" + (el.innerText || el.getAttribute("aria-label") || el.value || "").replace(/\s+/g, " ").trim().slice(0, 40) + "\"";
  const box = r => `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
  const modal = [...document.querySelectorAll(".bugwrap, .reveal, .modal, .zoomwrap")].find(m => m.getBoundingClientRect().height > 0);
  const ctl = [...(modal || document).querySelectorAll("button, a[href], input, textarea, select, [role=button]")]
    .map(el => ({ el, r: vis(el) })).filter(x => x.r && !x.el.disabled);
  for (const { el, r } of ctl) {
    if (r.width < 44 || r.height < 44) out.small.push(name(el) + " " + box(r));
    let scroller = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflowX !== "visible") { scroller = true; break; } }
    if (!scroller && (r.right > W + 0.5 || r.left < -0.5)) out.offscreen.push(name(el) + " " + box(r));
    /* topmost at the center must be the control or inside it */
    const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && !el.contains(top) && !top.contains(el)) {
      const pc = getComputedStyle(top).pointerEvents;
      if (pc !== "none") out.occluded.push(name(el) + " " + box(r) + " under " + name(top));
    }
  }
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ix > 2 && iy > 2) out.overlap.push(name(a.el) + " " + box(a.r) + " x " + name(b.el) + " " + box(b.r));
  }
  /* text that spills its box: an element with its own text whose content is wider than it */
  for (const el of document.querySelectorAll("body *")) {
    if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = vis(el); if (!r) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline") continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const ell = cs.textOverflow === "ellipsis" && cs.overflowX === "hidden";
      if (!ell) out.spill.push(name(el) + " " + box(r) + ` content ${el.scrollWidth} in ${el.clientWidth} (overflow ${cs.overflowX})`);
    }
  }
  return out;
}

(async () => {
  const kit = await open({ w: W, h: H });
  const { page, errors } = kit;
  let errSeen = 0;
  const measure = async (where) => {
    await page.waitForTimeout(150);
    const m = await page.evaluate(judgeBoxes, { W, H });
    screensSeen.push(where);
    if (m.sw > W) note("hscroll", where, `scrollWidth ${m.sw}`);
    m.small.forEach(s => note("small-target", where, s));
    m.overlap.forEach(s => note("overlap", where, s));
    m.spill.forEach(s => note("spill", where, s));
    m.occluded.forEach(s => note("occluded", where, s));
    m.offscreen.forEach(s => note("offscreen", where, s));
    if (errors.length > errSeen) { errors.slice(errSeen).forEach(e => note("page-error", where, e)); errSeen = errors.length; }
  };
  const click = async (loc, what, where) => { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { note("dead-tap", where, what + ": " + String(e.message).split("\n")[0]); return false; } };
  const has = sel => page.locator(sel).first().isVisible().catch(() => false);
  const btn = re => page.getByRole("button", { name: re });
  const home = async () => {
    for (let k = 0; k < 3 && (await has(".board")); k++) { await page.locator(".screennav button", { hasText: "leave" }).click().catch(() => {}); await page.waitForTimeout(400); }
    await page.locator("nav.tabs .tab", { hasText: "Heroes" }).click().catch(() => {});
    await page.waitForTimeout(200);
  };
  const harvest = async (key) => {
    const r = await page.evaluate(() => ({
      feed: [...document.querySelectorAll(".gamelog .gl")].map(e => e.innerText),
      adv: [...document.querySelectorAll(".adv .advbody")].map(e => e.innerText),
      advh: [...document.querySelectorAll(".adv .advhead")].map(e => e.innerText) }));
    (feedLines[key] = feedLines[key] || new Set()); r.feed.forEach(l => feedLines[key].add(l));
    (advLines[key] = advLines[key] || new Set()); r.adv.concat(r.advh).forEach(l => advLines[key].add(l));
  };
  const toLoadout = async (i, where) => {
    await home();
    if (!(await click(page.locator(".hgrid .hcard").nth(i), "hero " + i, where))) {
      const dump = await page.evaluate(() => ({ body: document.body.innerText.replace(/\s+/g, " ").slice(0, 300), modals: [...document.querySelectorAll(".modal,.bugwrap,.reveal,.peekwrap,.psheet,.sheet,.board,.lose")].map(e => e.className) }));
      note("stuck-screen", where, "could not reach the roster: " + JSON.stringify(dump));
      await page.reload(); await page.waitForSelector(".shell"); await page.waitForTimeout(1500);
      if (!(await click(page.locator(".hgrid .hcard").nth(i), "hero " + i + " after reload", where))) return null;
    }
    await page.waitForSelector(".sheet");
    const hero = (await page.locator(".sheet h2, .sheet h1").first().innerText().catch(() => "?")).replace(/\s+/g, " ");
    if (!(await click(btn(/^Battle$/), "battle", where))) return null;
    await page.waitForSelector(".rps"); await measure(where + " coin");
    await page.waitForSelector(".rseatpick, .actbar", { timeout: 10000 });
    if (await has(".rseatpick")) { await measure(where + " seat pick"); await click(page.locator(".rseatpick .go"), "I go first", where); }
    await page.waitForSelector(".actbar", { timeout: 8000 });
    return hero;
  };
  const visibleText = () => page.locator(".board").innerText().catch(() => "");

  /* ---------- the trainer, driven by taps ---------- */
  const trainer = async (i) => {
    const where0 = `trainer h${i}`;
    const hero = await toLoadout(i, where0); if (!hero) return;
    const where = `trainer ${hero}`;
    await measure(where + " loadout");
    if (!(await click(page.locator(".actbar .battlebtn"), "Fight", where))) return;
    await page.waitForSelector(".board", { timeout: 8000 });
    await measure(where + " board");
    let stuck = 0, lastSig = "", lastPick = null;
    for (let s = 0; s < STEPS; s++) {
      if (await has(".reveal")) { await measure(where + " game over"); const t = await page.locator(".reveal").innerText(); console.log("   over:", t.replace(/\s+/g, " ").slice(0, 80)); await page.locator(".reveal").click(); break; }
      if (await has(".psheet")) {
        const t = (await page.locator(".psheet .pt").first().innerText().catch(() => "?"));
        promptKinds[where + ": " + t] = 1; await measure(where + " prompt " + t);
      }
      const sig = await visibleText();
      if (sig === lastSig) { if (++stuck > 4) { const d = await page.evaluate(() => ({ bar: (document.querySelector(".board .actbar")||{}).innerText, st: [...document.querySelectorAll(".statusline, .tblerr, .refuse, .note")].map(e=>e.innerText).join(" / "), feed: [...document.querySelectorAll(".gamelog .gl")].slice(0,4).map(e=>e.innerText) })); note("stuck", where, "board unchanged across 5 taps at step " + s + " last tap " + JSON.stringify(lastPick) + " " + JSON.stringify(d).replace(/\\n/g," ")); break; } } else stuck = 0;
      lastSig = sig;
      /* candidates */
      const cands = await page.evaluate(() => {
        const vis = b => b.offsetParent && !b.disabled;
        const out = [];
        document.querySelectorAll(".psheet button").forEach((b, k) => vis(b) && out.push({ sel: ".psheet button", k, t: b.innerText.replace(/\s+/g, " ").trim(), z: "sheet" }));
        document.querySelectorAll(".board .hand .hc, .board .phand .hc, .board .chand .hc").forEach((b, k) => vis(b) && !b.classList.contains("dis") && out.push({ sel: ".board .hand .hc, .board .phand .hc, .board .chand .hc", k, t: "card", z: "hand" }));
        document.querySelectorAll(".board .actbar button").forEach((b, k) => vis(b) && out.push({ sel: ".board .actbar button", k, t: b.innerText.replace(/\s+/g, " ").trim(), z: "bar" }));
        return out;
      });
      const bad = /concede|leave/i;
      let pick = cands.find(c => c.z === "sheet" && /confirm|done|keep|accept|ok|take/i.test(c.t))
        || cands.find(c => c.z === "sheet" && !bad.test(c.t))
        || (s % 3 !== 2 && cands.find(c => c.z === "hand"))
        || cands.find(c => c.z === "bar" && /take it|end turn|pass|skip|leave it empty|done|decline|confirm|fight|defend/i.test(c.t) && !bad.test(c.t))
        || cands.find(c => c.z === "bar" && !bad.test(c.t));
      if (!pick) { await page.waitForTimeout(600); continue; }
      lastPick = pick; const loc = page.locator(pick.sel).nth(pick.k);
      if (pick.z === "hand") { await loc.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(200); if (await has(".peekwrap")) await measure(where + " peek"); await loc.click({ timeout: 3000 }).catch(() => {}); }
      else await loc.click({ timeout: 3000 }).catch(e => note("dead-tap", where, pick.t + " " + e.message.split("\n")[0]));
      await page.waitForTimeout(450);
      if (s % 6 === 0) { await measure(where + " step " + s); await harvest("trainer " + hero); }
    }
    await harvest("trainer " + hero);
    /* JUDGE!! once per hero on the chain screen */
    if (await has(".board")) {
      await page.locator(".screennav button", { hasText: "Chain" }).click().catch(() => {});
      await page.waitForTimeout(300);
      if (await click(page.locator(".judgebtn").first(), "JUDGE!!", where)) { await page.waitForTimeout(250); await measure(where + " judge sheet"); await page.locator(".bugsheet button", { hasText: "Close" }).click().catch(() => {}); }
    }
  };

  /* ---------- the table, seat 0 driven by the AI policy through the session ---------- */
  const table = async (i, foeIdx) => {
    const hero = await toLoadout(i, `table h${i}`); if (!hero) return;
    const where = `table ${hero}`;
    const foeBtn = page.locator(".aifoe button").nth(2 + foeIdx);
    const foe = await foeBtn.getAttribute("aria-label");
    await click(foeBtn, "AI foe", where);
    await measure(where + " loadout vs " + foe);
    if (!(await click(btn(/^Fight the new engine/), "Fight the new engine", where))) return;
    await page.waitForSelector(".board", { timeout: 15000 });
    await measure(where + " board");
    let lastSeq = -1, still = 0;
    for (let s = 0; s < STEPS * 12; s++) {
      if (await has(".reveal")) { await measure(where + " game over"); const t = await page.locator(".reveal").innerText(); console.log("   over:", t.replace(/\s+/g, " ").slice(0, 100)); await harvest("table " + hero); await page.locator(".reveal").click(); return; }
      const st = await page.evaluate(() => { const T = window.__dawnTable; if (!T) return null; const g = T.session.state();
        const pq = (g.promptQ || [])[0];
        return { seq: T.session.seq(), over: !!g.over, p: pq ? { tag: pq.tag, side: pq.side || 0, title: pq.title } : null, pri: g.priority, turn: g.turn, pend: !!(g.sides[0].pending) }; });
      if (!st) { await page.waitForTimeout(300); continue; }
      if (st.over) { await page.waitForTimeout(600); await measure(where + " over (state)"); if (!(await has(".reveal"))) { const sc = await page.locator("body").innerText(); console.log("   over in state; body:", sc.replace(/\s+/g, " ").slice(0, 160)); await harvest("table " + hero); return; } continue; }
      if (st.p && (st.p.side === 0)) { promptKinds[st.p.tag] = (promptKinds[st.p.tag] || 0) + 1; await measure(where + " prompt " + st.p.tag + " (" + st.p.title + ")"); }
      if (st.seq === lastSeq) { if (++still > 30) { const dbg = await page.evaluate(() => { const g = window.__dawnTable.session.state(); return JSON.stringify({pri:g.priority, tp:g.turnPlayer, phase:g.phase, step:g.step, pq:(g.promptQ||[]).map(p=>[p.tag,p.side]), pend0:g.sides[0].pending&&g.sides[0].pending.kind, pend1:g.sides[1].pending&&g.sides[1].pending.kind, status:window.__dawnTable.session.status()}); }); const bar = await page.locator(".board .actbar").innerText().catch(()=>"?"); note("stuck", where, "session seq frozen at " + st.seq + " turn " + st.turn + " " + dbg + " bar=" + bar.replace(/\s+/g," ")); break; } } else still = 0;
      lastSeq = st.seq;
      const r = await page.evaluate(() => { const T = window.__dawnTable, g = T.session.state();
        const pq = (g.promptQ || [])[0];
        const mine = (pq && (pq.side || 0) === 0) || (!pq && g.priority === 0) || (g.sides[0].pending);
        let a; try { a = DawnSparring.act(g, 0); } catch (e) { return mine ? "act threw " + e.message : "wait"; }
        if (!a) return "noact";
        if (!mine && DawnJudge.legal(g, a, 0) !== null) return "wait";
        const why = T.session.submit(a); return why ? "refused: " + why + " " + JSON.stringify(a).slice(0, 80) : "ok"; });
      if (/refused|threw/.test(r)) note("policy", where, r);
      await page.waitForTimeout(r === "ok" ? 120 : 250);
      if (s % 25 === 0) { await measure(where + " step " + s); await harvest("table " + hero); }
    }
    console.log("   table end:", await page.evaluate(() => { const g = window.__dawnTable.session.state(); return "turn " + g.turn + " hp " + g.sides[0].hp + "/" + g.sides[1].hp; }));
    await harvest("table " + hero);
    if (await has(".board")) {
      await page.locator(".screennav button", { hasText: "Chain" }).click().catch(() => {});
      await page.waitForTimeout(300);
      if (await click(page.locator(".judgebtn").first(), "JUDGE!! (table)", where)) { await page.waitForTimeout(250); await measure(where + " judge sheet"); await page.locator(".bugsheet button", { hasText: "Close" }).click().catch(() => {}); }
    }
  };

  const n = await page.locator(".hgrid .hcard").count();
  console.log("hero cards:", n);
  await measure("home roster");
  const idx = ONLY || [...Array(n).keys()].filter(k => k < 15);
  for (const i of idx) {
    console.log("== hero", i);
    if (!process.env.NO_TRAINER) await trainer(i).catch(e => note("driver", "trainer h" + i, e.message.split("\n")[0]));
    if (!process.env.NO_TABLE) await table(i, (i + 5) % 15).catch(e => note("driver", "table h" + i, e.message.split("\n")[0]));
  }
  await home();
  const ser = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));
  fs.writeFileSync(OUT, JSON.stringify({ findings, promptKinds, feed: ser(feedLines), adv: ser(advLines), screens: screensSeen.length }, null, 1));
  console.log("findings", findings.length, "screens", screensSeen.length, "prompts", JSON.stringify(promptKinds));
  await kit.close();
})().catch(e => { console.log("FAIL", e.stack); process.exit(1); });
