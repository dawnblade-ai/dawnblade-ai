/* ======================================================================
   A SWING IS SPENT ONLY WHERE THE WEAPON PRINTS A LIMIT (v5.01)

   `execute` marks `weaponUsed[uid]` on every swing. Judge refused a second
   swing only for a weapon printing `Once per Turn` or `{t}`; the trainer's
   door refused ANY second swing. Sledge of Anvilheim ("Action -
   {r}{r}{r}{r}: Attack") prints neither, so on the trainer it could not
   swing again for four more while the table let it — v3.01's one-board
   shape, found reading the weapon door against `judge.legal`.
   `parser.swingSpentWhy` is the one reader.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const piece = (n, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p: 0, code: null, q: 1}), {uid});

test("the reader: only a printed limit spends the swing", {skip}, () => {
  const sledge = piece("Sledge of Anvilheim", 41), scorpio = piece("Scorpio, Comet Tail", 42);
  const once = piece("Raydn, Duskbane", 43);
  const used = {weaponUsed: {41: true, 42: true, 43: true}};
  assert.equal(P.swingSpentWhy(used, sledge), null, "Sledge prints no limit — it swings again");
  assert.match(String(P.swingSpentWhy(used, scorpio)), /is tapped until your end phase/);
  assert.match(String(P.swingSpentWhy(used, once)), /has already swung this turn/);
  /* and nothing is spent before the first swing */
  assert.equal(P.swingSpentWhy({weaponUsed: {}}, once), null);
  assert.equal(P.swingSpentWhy(null, once), null, "no side, no throw");
});

test("DRIVEN at the table: a swung Sledge is still legal, a swung Raydn is not", {skip}, () => {
  const board = gear => Object.assign(
    H.state({gear, hand: [], res: 9, ap: 1, weaponUsed: {41: true}, name: "You"}, {hp: 20},
      {actor: 0, turnPlayer: 0, turn: 3}),
    {phase: "action", step: "layer", priority: 0, passed: []});
  assert.equal(H.J.legal(board([piece("Sledge of Anvilheim", 41)]), {t: "activate", uid: 41, from: "gear"}, 0), null);
  assert.match(String(H.J.legal(board([piece("Raydn, Duskbane", 41)]), {t: "activate", uid: 41, from: "gear"}, 0)),
    /has already swung this turn/);
});

test("both boards ask the one reader, and the trainer no longer refuses on the record alone", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(html, /if\(from==="weapon"\)\{ const _sw = DawnParser\.swingSpentWhy\(act\(s\), card\); if\(_sw\) return L\(s, _sw \+ "\."\); \}/);
  assert.doesNotMatch(html, /\(from==="weapon"\|\|from==="hero"\) && act\(s\)\.weaponUsed\[card\.uid\]/,
    "the blanket refusal came back");
  assert.match(html, /isWeapon\(gr\)&&!gr\.destroyed&&!DawnParser\.swingSpentWhy\(you\(g\), gr\)/,
    "the peek list still hides a swung Sledge");
  const js = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(js, /\{ const _sw = PR\.swingSpentWhy\(sd, piece\); if\(_sw\) return _sw; \}/);
});
