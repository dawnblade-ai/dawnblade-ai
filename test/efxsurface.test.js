/* EVERY NAME THE PAGE CALLS ON AN ENGINE SURFACE EXISTS (1.0 polish audit).

   The trainer's block wall called `_EFX.defendValue(...)`. `defendValue` is a
   module export of effects.js and never a member of the `makeEffects`
   context, so the call was `undefined(...)`: the first time the PLAYER
   blocked with a card in the trainer and tapped "Resolve damage", the
   reducer threw and React unmounted the whole page — a blank screen. No
   drill could see it: the call sits in a closure inside `Battle`, and the
   smoke walk only ever takes the hit.

   Two surfaces, both asked rather than read:
   - `_EFX.<name>`: the keys `makeEffects` actually returns;
   - `Dawn<Module>.<name>`: the exports of the module scripts index.html
     loads, run in the order the page loads them.
   Comments are stripped first: prose that names a call is not a call. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ROOT, html } = require("./helpers/extract");

const code = () => html().replace(/\/\*[\s\S]*?\*\//g, "");

test("every _EFX.<name> the trainer calls is a member of the effects context", () => {
  const E = require("../engine/effects");
  const ctx = {};
  /* makeEffects names its own required context when one is missing */
  let need = [];
  try { E.makeEffects({}); } catch(e){ need = (String(e.message).split("—")[1] || "").split(",").map(x => x.trim()).filter(Boolean); }
  assert.ok(need.length, "makeEffects still names its required context");
  for(const n of need) ctx[n] = () => {};
  const have = new Set(Object.keys(E.makeEffects(ctx)));
  const used = [...new Set([...code().matchAll(/\b_EFX\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]))];
  assert.ok(used.length > 5, "the trainer's calls were found: " + used.join(", "));
  assert.deepEqual(used.filter(u => !have.has(u)), [], "called on _EFX but not returned by makeEffects");
});

test("every Dawn<Module>.<name> the page calls is exported by that module", () => {
  const src = html();
  const order = [...src.matchAll(/<script src="((?:engine|data)\/[a-z]+\.js)"/g)].map(m => m[1]);
  const win = {}; win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  for(const f of order) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  const used = [...new Set([...code().matchAll(/\b(Dawn[A-Z][A-Za-z]*)\.([A-Za-z_$][\w$]*)/g)].map(m => m[1] + "." + m[2]))];
  assert.ok(used.length > 50, "the page's module calls were found");
  const miss = used.filter(u => { const [m, k] = u.split("."); return !win[m] || !(k in win[m]); });
  assert.deepEqual(miss, [], "called on a module that does not export it");
});
