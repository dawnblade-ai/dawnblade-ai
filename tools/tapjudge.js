/* ============================================================
   THE TAP JUDGE — POLISH.md condition 1, measured (tools/page.js and tools/serverpage.js rows).

   `tapJudge` runs IN THE PAGE (page.evaluate) and asks, of every control a player can meet on the
   screen as it stands:
     small     its HIT AREA is under 44 CSS px in an axis. The hit area is what a finger gets, not what is
               drawn: the control is probed with elementFromPoint along its centre lines, up to `halo` px
               past the box, so an invisible ::after that grows the tap counts (the jump row, JUDGE!!, the
               advisor header) and one another control steals does not. A control a scroller holds half out
               of view is judged on its drawn size along that axis (a thumb scrolls it into reach).
     stolen    the tap at the centre of the part that shows lands on something that is not it.
     clipped   part of it is cut by an ancestor that cannot scroll, or it leaves the viewport with nothing
               to scroll it back.
     overlap   two controls whose showing parts meet.
   Findings are {k, m}: `k` names the control (no numbers), `m` is the sentence.

   `judgeScreen(page)` is the Node side: it measures the screen with every scroller at its top, then with
   every scroller at its end, and keeps stolen / clipped / overlap only where a control is bad in BOTH (a
   control under the action bar at the top that clears it at the end of its pane is reachable; one that
   is under it everywhere is lost). `small` does not depend on scroll and comes from both passes. (A 1px slack: the probe reads fractional boxes.)
   A modal (.bugwrap, .reveal, .modal, .zoomwrap, .psheet) hides what is behind it: only its controls are judged.

   EXEMPT: [name pattern, why] for a control UI-GUIDE.md documents as smaller on purpose. A finding for one
   comes back in `exempt`, never silently dropped. None is listed since v7.16 (the hand wheel's turned cards were the
   one; an entry may name a CSS selector instead). The jump row, JUDGE!! and the advisor header get invisible hit areas
   instead (DECISION B 2026-11-02).
   ============================================================ */
"use strict";

function tapJudge({ min, halo, exempt }) {
  const W = innerWidth, H = innerHeight, de = document.scrollingElement;
  const out = { small: [], overlap: [], stolen: [], clipped: [], exempt: [], n: 0 };
  const isDoc = p => p === document.documentElement || p === document.body;
  const scrolls = (p, ax) => {
    if (isDoc(p)) return ax === "y" ? de.scrollHeight > H + 1 : de.scrollWidth > W + 1;
    const ps = getComputedStyle(p);
    return ax === "y" ? /auto|scroll/.test(ps.overflowY) && p.scrollHeight > p.clientHeight + 1
                      : /auto|scroll/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1;
  };
  const scrollerAbove = (el, ax) => { for (let p = el.parentElement; p; p = p.parentElement) if ((!ax || ax === "y") && scrolls(p, "y") || (!ax || ax === "x") && scrolls(p, "x")) return true; return false; };
  const key = el => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "") +
    " \"" + (el.innerText || el.getAttribute("aria-label") || el.value || "").replace(/\s+/g, " ").trim().slice(0, 32) + "\"";
  const box = r => `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
  const modal = [...document.querySelectorAll(".bugwrap, .reveal, .modal, .zoomwrap, .psheet")].find(m => m.getBoundingClientRect().height > 0);
  const exOf = el => { const n = key(el), e = exempt.find(([re, , css]) => css ? el.matches(css) : new RegExp(re, "i").test(n)); return e ? e[1] : null; };
  const ctl = [];
  for (const el of (modal || document).querySelectorAll("button, a[href], input:not([type=hidden]), textarea, select, [role=button]")) {
    if (el.disabled) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    let hidden = false, cut = null, v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    /* a screen parked above or below the one in view (the loadout's pager) is not on screen, whatever its box says */
    const vs = el.closest(".vscreen");
    if (vs) { const q = vs.getBoundingClientRect(); if (q.top > H / 2 || q.bottom < H / 2) continue; }
    for (let p = el.parentElement; p && !isDoc(p); p = p.parentElement) {
      const ps = getComputedStyle(p); if (ps.display === "none" || ps.visibility === "hidden") { hidden = true; break; }
      if (ps.overflowX === "visible" && ps.overflowY === "visible") continue;
      const q = p.getBoundingClientRect();
      if (v.right <= q.left + 1 || v.left >= q.right - 1 || v.bottom <= q.top + 1 || v.top >= q.bottom - 1) { hidden = true; break; }
      const outY = v.top < q.top - 1 || v.bottom > q.bottom + 1, outX = v.left < q.left - 1 || v.right > q.right + 1;
      if (!cut && ((outY && !scrolls(p, "y")) || (outX && !scrolls(p, "x"))))
        cut = `cut by ${p.tagName.toLowerCase()}.${String(p.className).trim().split(/\s+/).join(".")} (overflow ${ps.overflowX}/${ps.overflowY}) ${Math.round(q.left)},${Math.round(q.top)}..${Math.round(q.right)},${Math.round(q.bottom)}`;
      v = { left: Math.max(v.left, q.left), top: Math.max(v.top, q.top), right: Math.min(v.right, q.right), bottom: Math.min(v.bottom, q.bottom) };
    }
    if (hidden) continue;
    const off = v.right <= 0 || v.left >= W || v.bottom <= 0 || v.top >= H;
    if (off) {   // wholly off the viewport: a thumb scrolls it back only if something scrolls
      if (!scrollerAbove(el)) out.clipped.push({ k: key(el), m: key(el) + " " + box(r) + " lies wholly outside the " + W + "x" + H + " screen with nothing to scroll it back" });
      continue;
    }
    const full = v; v = { left: Math.max(v.left, 0), top: Math.max(v.top, 0), right: Math.min(v.right, W), bottom: Math.min(v.bottom, H) };
    v.width = v.right - v.left; v.height = v.bottom - v.top;
    const edge = { x: r.left < -0.5 || r.right > W + 0.5, y: r.top < -0.5 || r.bottom > H + 0.5 };   // the box itself leaves the screen (a scroller's own clip does not count here)
    if (!cut && ((edge.x && !scrollerAbove(el, "x")) || (edge.y && !scrollerAbove(el, "y")))) cut = `leaves the ${W}x${H} screen (${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)}) with nothing to scroll it back`;
    /* a scroller's own clip holds part of it out of view (a list scrolled to its end): a thumb scrolls the rest into reach */
    const part = { x: full.right - full.left < r.width - 1 && scrollerAbove(el, "x"), y: full.bottom - full.top < r.height - 1 && scrollerAbove(el, "y") };
    ctl.push({ el, r, v, cut, edge, part });
  }
  const hitOf = c => {
    const { el, v } = c, probe = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && el.contains(t); };
    const cx = v.left + v.width / 2, cy = v.top + v.height / 2, S = 0.5;   // half-pixel steps: a 42px box reads 42, not 43
    if (!probe(cx, cy)) { const t = document.elementFromPoint(cx, cy); return { lost: true, on: t ? key(t) : "nothing" }; }
    const run = (x, y, dx, dy, lim) => { let n = 0; while (n * S < lim) { const nx = x + dx * (n + 1) * S, ny = y + dy * (n + 1) * S; if (nx < 0 || ny < 0 || nx >= W || ny >= H || !probe(nx, ny)) break; n++; } return n * S; };
    return { w: run(cx, cy, -1, 0, v.width / 2 + halo) + run(cx, cy, 1, 0, v.width / 2 + halo), h: run(cx, cy, 0, -1, v.height / 2 + halo) + run(cx, cy, 0, 1, v.height / 2 + halo) };
  };
  for (const c of ctl) {
    out.n++; const h = hitOf(c), k = key(c.el), why = exOf(c.el);
    const put = (kind, m) => (why ? out.exempt : out[kind]).push({ k, m: (why ? kind + " (" + why + "): " : "") + m });
    if (h.lost) put("stolen", k + " " + box(c.r) + " the tap at its centre lands on " + h.on);
    else {
      /* a control a scroller holds half out of view is judged on its drawn size along that axis */
      const w = c.edge.x || c.part.x ? Math.max(h.w, c.r.width) : h.w, ht = c.edge.y || c.part.y ? Math.max(h.h, c.r.height) : h.h;
      if (w < min - 1 || ht < min - 1) put("small", k + " drawn " + box(c.r) + " hit " + Math.round(w) + "x" + Math.round(ht));
    }
    if (c.cut) put("clipped", k + " " + box(c.r) + " " + c.cut);
  }
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const a = ctl[i], b = ctl[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left), iy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ix > 2 && iy > 2) {
      const why = exOf(a.el) || exOf(b.el), ka = key(a.el), kb = key(b.el);
      (why ? out.exempt : out.overlap).push({ k: ka + " x " + kb, m: (why ? "overlap (" + why + "): " : "") + ka + " " + box(a.v) + " x " + kb + " " + box(b.v) });
    }
  }
  return out;
}

/* every scroller (the document too) to its top or its end; the in-page half of judgeScreen */
function scrollAll(to) {
  const de = document.scrollingElement;
  for (const el of [de, ...document.querySelectorAll("*")]) {
    if (el !== de) { const o = getComputedStyle(el).overflowY; if (!/auto|scroll/.test(o) || el.scrollHeight <= el.clientHeight + 1) continue; }
    el.scrollTop = to === "end" ? el.scrollHeight : 0;
  }
}

/* [name pattern, why] or [null, why, css selector]. Empty since v7.16: the hand wheel's turned cards (v7.15) were the
   one entry, and the flat hand row that replaced the wheel is an ordinary x-scroller, judged like any other (a card
   it holds half out of view is judged on its drawn width; a thumb scrolls the rest into reach). */
const EXEMPT = [];
const MIN = 44, HALO = 24;

/* Judge the screen as it stands: {n, small, stolen, clipped, overlap, exempt}, each a list of {k, m}. */
async function judgeScreen(page, { min = MIN, halo = HALO, exempt = EXEMPT } = {}) {
  const run = async to => { await page.evaluate(scrollAll, to); await page.waitForTimeout(120); return page.evaluate(tapJudge, { min, halo, exempt }); };
  const top = await run("top"), end = await run("end");
  await page.evaluate(scrollAll, "top");
  const both = (a, b) => a.filter(x => b.some(y => y.k === x.k));
  return { n: Math.max(top.n, end.n), small: top.small.concat(end.small.filter(x => !top.small.some(y => y.k === x.k))),
           stolen: both(top.stolen, end.stolen), clipped: both(top.clipped, end.clipped), overlap: both(top.overlap, end.overlap), exempt: top.exempt };
}

module.exports = { tapJudge, scrollAll, judgeScreen, EXEMPT, MIN, HALO };
