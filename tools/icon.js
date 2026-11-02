#!/usr/bin/env node
/* ============================================================
   THE HOME-SCREEN ICON — icons/icon.svg rasterized to the PNGs the page
   names in its <head> (apple-touch-icon 180x180, favicon 32x32).

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
  await browser.close();
})();
