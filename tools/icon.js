#!/usr/bin/env node
/* ============================================================
   THE HOME-SCREEN ICON — icons/icon.svg rasterized to the PNGs the page
   names in its <head> (apple-touch-icon 180x180, favicon 32x32) — and the
   LINK PREVIEW (v6.57): icons/share.png, 1200x630, the card a messenger
   shows under a shared link (og:image). The same blade and sun beside the
   name and one line of what the game is. Its fonts are the page's own,
   read from PAGE_DEPS' @fontsource files (tools/page.js's deps); without
   them it refuses rather than ship a card in a fallback face.

   The art is ORIGINAL (decision C, CEO 2026-11-02): a blade in a rising
   sun, drawn in the page's own palette. No Legend Story Studios art or
   logos. The PNGs are committed, so the page needs no build step; rerun
   this only when icon.svg changes. Needs `playwright` resolvable by
   require (NODE_PATH=$(npm root -g)), like tools/page.js.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DIR = path.join(__dirname, "..", "icons");
const OUT = [["apple-touch-icon.png", 180], ["favicon-32.png", 32]];

(async () => {
  const svg = fs.readFileSync(path.join(DIR, "icon.svg"), "utf8");
  const browser = await chromium.launch();
  for(const [name, size] of OUT){
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0">${svg.replace(/width="180" height="180"/, `width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: path.join(DIR, name), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`icons/${name} ${size}x${size}`);
  }
  /* THE LINK PREVIEW */
  const deps = process.env.PAGE_DEPS || "";
  const font = (pkg, file) => path.join(deps, "node_modules", "@fontsource", pkg, "files", file);
  const faces = [["Big Shoulders Display", 800, font("big-shoulders-display", "big-shoulders-display-latin-800-normal.woff2")],
                 ["Spline Sans", 500, font("spline-sans", "spline-sans-latin-500-normal.woff2")]];
  if(!deps || faces.some(f => !fs.existsSync(f[2]))){
    console.log("icons/share.png NOT written: set PAGE_DEPS to tools/page.js's deps (the @fontsource files)");
  } else {
    const css = faces.map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString("base64")}) format('woff2')}`).join("");
    const art = svg.replace(/width="180" height="180"/, 'width="420" height="420"');
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(`<html><head><style>${css}
      body{margin:0;width:1200px;height:630px;background:#14100E;display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;overflow:hidden}
      .t{font-family:'Big Shoulders Display';font-weight:800;font-size:132px;letter-spacing:.04em;color:#E8DFD0;line-height:1}
      .t em{font-style:normal;color:#E8B33C}
      .s{font-family:'Spline Sans';font-weight:500;font-size:31px;color:#E8DFD0;line-height:1.35;margin-top:22px;max-width:640px}
      .f{font-family:'Spline Sans';font-weight:500;font-size:24px;color:#A89C8A;margin-top:26px;letter-spacing:.02em}
      .bar{height:6px;width:120px;background:#C4302B;margin-top:30px}
      </style></head><body>${art}<div><div class="t">DAWN<em>BLADE</em></div>
      <div class="s">Flesh and Blood sparring on your phone. Real Silver Age precons, an AI that plays them, a coach at your side.</div>
      <div class="bar"></div><div class="f">Fan-made · free · no ads, forever</div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(DIR, "share.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await page.close();
    console.log("icons/share.png 1200x630");
  }
  await browser.close();
})();
