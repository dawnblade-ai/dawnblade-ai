#!/usr/bin/env node
/* ============================================================
   THE READABILITY MEASURE — WCAG AA contrast and minimum text size, on the
   REAL rendered page (QUEUE item 4, readability sweep).

   `measure` runs IN the page. For every element that owns visible text it
   takes the computed foreground (alpha and every ancestor's opacity folded
   in) and composites the real background under it: walk up for each layer's
   background colour until the first opaque one, then paint them back down.
   A gradient layer is judged at its WORST stop. WCAG AA: 4.5:1 for normal
   text, 3:1 for large text (>= 24px, or >= 18.66px at weight >= 700).

   SKIPPED, honestly (each counted in `skipped`, never silently):
     disabled   a disabled control (WCAG exempts inactive UI)
     image      text over a url() image or a <canvas>/<img> sibling stack: no
                single background colour exists (card art overlays)
     clipped    text clipped away by an overflow:hidden ancestor (not visible)
   Decorative glyphs with no letters or digits (arrows, pips, dots) are
   skipped as `glyph`: not text a player reads.

   SIZE: text under MIN_PX (default 10) is a `small` finding, reported apart
   from contrast.

   USE
     node tools/contrast.js               drive the main screens, both sizes
     const { measure, MIN_PX } = require("./contrast");
     const r = await page.evaluate(measure, { minPx: MIN_PX });
       -> { n, fails:[{sel,text,fg,bg,ratio,need,px}], small:[...], skipped:{...} }
   The page has ONE theme (UI-GUIDE: "there is no dark/light split"), so
   "both themes" is one pass. NOT part of npm test (needs a browser); the
   page.js smoke check calls `measure` on every screen it visits and fails a
   row if any text is below AA.
   ============================================================ */
"use strict";
const MIN_PX = 10;

function measure({ minPx }) {
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a);
    return a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const gradColors = s => { const out = []; const re = /rgba?\([^)]+\)|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi; let m;
    while ((m = re.exec(s))) { let t = m[0]; if (t[0] === "#") { if (t.length === 4) t = "#" + [...t.slice(1)].map(x => x + x).join("");
      out.push({ r: parseInt(t.slice(1, 3), 16), g: parseInt(t.slice(3, 5), 16), b: parseInt(t.slice(5, 7), 16), a: 1 }); } else out.push(parse(t)); }
    return out.filter(Boolean); };
  const sel = el => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const out = { n: 0, fails: [], small: [], skipped: { disabled: 0, image: 0, clipped: 0, glyph: 0 } };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const owners = new Set();
  for (let t; (t = walker.nextNode());) if (/[A-Za-z0-9]/.test(t.nodeValue) || t.nodeValue.trim()) owners.add(t.parentElement);
  for (const el of owners) {
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join("").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
    let op = 1, hidden = false, clipped = false;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p); op *= +ps.opacity; if (ps.display === "none" || ps.visibility === "hidden") hidden = true;
      if (p !== el && (ps.overflowX !== "visible" || ps.overflowY !== "visible")) {
        const pr = p.getBoundingClientRect();
        if (r.right <= pr.left || r.left >= pr.right || r.bottom <= pr.top || r.top >= pr.bottom) clipped = true; } }
    if (hidden || op === 0) continue;
    if (clipped) { out.skipped.clipped++; continue; }
    if (!/[A-Za-z0-9]/.test(txt)) { out.skipped.glyph++; continue; }
    if (el.closest("button:disabled, input:disabled, [disabled], [aria-disabled=true]")) { out.skipped.disabled++; continue; }
    /* background layers, innermost first, until an opaque colour */
    const layers = []; let imageBg = false;
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p), bg = parse(ps.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
      const bi = ps.backgroundImage;
      if (bi && bi !== "none") { if (/url\(/.test(bi)) { imageBg = true; break; }
        const gs = gradColors(bi); if (gs.length) layers.push({ grad: gs, alpha: 1 }); }
      if (bg.a > 0) layers.push({ color: bg }); if (bg.a >= 1) break; if (p === document.documentElement) break; }
    if (imageBg || el.querySelector("img, canvas") || (el.parentElement && el.parentElement.querySelector(":scope > img.cardimg, :scope > canvas"))) { out.skipped.image++; continue; }
    /* paint back down; a gradient forks into one candidate per stop (worst case wins) */
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i];
      cands = L.color ? cands.map(c => over(L.color, c)) : L.grad.flatMap(g => cands.map(c => over(g, c))); }
    const fgRaw = parse(cs.color); if (!fgRaw) continue;
    const px = parseFloat(cs.fontSize), wt = +cs.fontWeight || 400;
    const large = px >= 24 || (px >= 18.66 && wt >= 700), need = large ? 3 : 4.5;
    let worst = null;
    for (const bg of cands) { const fg = over({ ...fgRaw, a: fgRaw.a * op }, bg), rt = ratio(fg, bg);
      if (!worst || rt < worst.rt) worst = { rt, fg, bg }; }
    out.n++;
    const row = { sel: sel(el), text: txt.slice(0, 32), fg: hex(worst.fg), bg: hex(worst.bg), ratio: +worst.rt.toFixed(2), need, px };
    const key = row.sel + "|" + row.fg + "|" + row.bg + "|" + px;
    if (seen.has(key)) continue; seen.add(key);
    if (worst.rt < need) out.fails.push(row);
    if (px < minPx) out.small.push(row);
  }
  return out;
}

/* the screen as it stands, at the top of every scroller and at its end (clipped text is skipped, so both ends are read) */
async function judgeText(page, minPx = MIN_PX) {
  const { scrollAll } = require("./tapjudge.js");
  const one = async to => { await page.evaluate(scrollAll, to); await page.waitForTimeout(120); return page.evaluate(measure, { minPx }); };
  const a = await one("top"), b = await one("end");
  await page.evaluate(scrollAll, "top");
  const merge = (x, y) => x.concat(y.filter(f => !x.some(g => g.sel === f.sel && g.fg === f.fg && g.bg === f.bg && g.px === f.px)));
  return { n: Math.max(a.n, b.n), fails: merge(a.fails, b.fails), small: merge(a.small, b.small), skipped: a.skipped };
}
const say = f => `${f.sel} "${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (want ${f.need}) ${f.px}px`;

module.exports = { measure, judgeText, say, MIN_PX };

/* ============================================================
   THE DRIVE — the main screens, at both phone sizes
   ============================================================ */
if (require.main === module) {
  const { open } = require("./page.js");
  const SIZES = [[393, 852], [320, 568]];
  (async () => {
    let bad = 0;
    for (const [w, h] of SIZES) {
      const kit = await open({ w, h }); const { page } = kit;
      const tally = {};
      const take = async name => { await page.waitForTimeout(250);
        const r = await page.evaluate(measure, { minPx: MIN_PX }); tally[name] = r;
        console.log(`${w}x${h}  ${name}: ${r.n} texts, ${r.fails.length} below AA, ${r.small.length} under ${MIN_PX}px, skipped ${JSON.stringify(r.skipped)}`);
        for (const f of r.fails) console.log(`    AA   ${f.ratio}<${f.need}  ${f.sel} "${f.text}" ${f.fg} on ${f.bg} ${f.px}px`);
        for (const f of r.small) console.log(`    SIZE ${f.px}px  ${f.sel} "${f.text}"`);
        bad += r.fails.length; };
      await take("first screen");
      for (const [name, sel] of [["how to play", ".howbtn"]]) {
        const l = page.locator(sel).first();
        if (await l.isVisible().catch(() => false)) { await l.click().catch(() => {}); await take(name);
          await page.locator(".howsheet button").last().click().catch(() => {}); } }
      await kit.close();
    }
    process.exit(bad ? 1 : 0);
  })().catch(e => { console.error(e); process.exit(2); });
}
