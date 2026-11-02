/* ADD TO HOME SCREEN (decision C, CEO 2026-11-02).

   An iPhone's Add to Home Screen used the page title and a screenshot,
   because the page named no icon (1.0 polish audit #17). It names one now:
   an ORIGINAL glyph (icons/icon.svg, rasterized by tools/icon.js), self-
   hosted, referenced RELATIVELY so the page still runs from file://, and
   present in the repo so the pushed commit carries it. Standalone mode
   (`apple-mobile-web-app-capable`) is deliberately absent: iOS keeps a
   standalone app's storage apart from Safari's, and saved games must stay
   shared. The <head> tags ARE the observable here. */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const head = html.slice(0, html.indexOf("</head>") > 0 ? html.indexOf("</head>") : html.indexOf("<style>"))
  .replace(/<!--[\s\S]*?-->/g, "");

/* the width and height a PNG's IHDR chunk records */
function pngSize(file){
  const b = fs.readFileSync(file);
  assert.strictEqual(b.toString("latin1", 1, 4), "PNG", file + " is a PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const link = rel => [...head.matchAll(/<link\b[^>]*>/g)].map(m => m[0])
  .filter(t => new RegExp(`rel="${rel}"`).test(t));
const href = tag => (tag.match(/href="([^"]+)"/) || [])[1];

test("the page names a home-screen icon and a favicon, both relative and both present", () => {
  const touch = link("apple-touch-icon"), icons = link("icon");
  assert.strictEqual(touch.length, 1, "one apple-touch-icon");
  assert.ok(icons.length >= 1, "a favicon");
  for(const tag of [...touch, ...icons]){
    const h = href(tag);
    assert.ok(h && !/^(\/|[a-z]+:)/i.test(h), `${h} is relative, so file:// finds it`);
    assert.ok(fs.existsSync(path.join(ROOT, h)), `${h} is in the repo`);
  }
  assert.deepStrictEqual(pngSize(path.join(ROOT, href(touch[0]))), [180, 180], "the touch icon is 180x180");
  const png = icons.find(t => /\.png"/.test(t));
  assert.ok(png, "a PNG favicon");
  assert.deepStrictEqual(pngSize(path.join(ROOT, href(png))), [32, 32], "the favicon is 32x32");
});

test("the home screen gets a proper name, and NOT standalone mode", () => {
  assert.match(head, /<meta name="apple-mobile-web-app-title" content="Dawnblade"\/>/);
  assert.ok(!/apple-mobile-web-app-capable|mobile-web-app-capable/.test(head),
    "standalone mode splits saved games from Safari's (decision C)");
});

test("the icon's source is original art: no external image, no font, no raster pasted in", () => {
  const svg = fs.readFileSync(path.join(ROOT, "icons", "icon.svg"), "utf8");
  assert.ok(!/<image\b|<text\b|href="(https?:|data:)/.test(svg), "shapes only, drawn here");
});
