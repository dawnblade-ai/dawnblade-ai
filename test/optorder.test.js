/* ============================================================
   optorder.test.js — AN OPT IS PUT BACK IN ANY ORDER (v5.45)

   QUEUE v4 S12. Opt prints "look at the top X cards of your deck, then
   put them back on top or bottom IN ANY ORDER", and the sheet both boards
   render offered only the top/bottom toggle: the cards kept on top went
   back in the order they were dealt. Weaker than printed on every opt
   card in the pool, and the control the user looked for did not exist.

   `prompt.order` is a permutation of the dealt indices, `promptMove` is
   the one reader that changes it (both boards send it, the table as the
   `promptMove` action), and `applyPrompt` writes the kept cards in that
   order. A reorder (`keepTop`, Spire Sniping) gets the same arrows.

   Asserted on the DECK, never on the feed (v2.45).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const PM = require("../engine/prompts.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const MINE = ["Wild Ride", "Buckwild", "Bare Fangs", "Rough Up"];
const THEIRS = ["Cindering Foresight", "Photon Splicing", "Look Tuff", "Frost Spike"];
function deckOf(names, base){
  return names.map((n, i) => {
    const c = H.card(n, 1) || H.card(n, 2) || H.card(n, 3);
    return {...c, uid: base + i};
  });
}

/* a synthetic opt sheet over four plain cards: the module needs no deck */
const card = u => ({uid: u, name: "Card " + u, pitch: 1, tx: ""});
function sheet(n, extra){
  const g = {sides: [{deck: [card(1), card(2), card(3), card(4), card(5)]}, {deck: []}]};
  return PM.buildPrompt(g, Object.assign({tag: "opt", side: 0, n, src: "Probe"}, extra || {}));
}

test("an opt sheet opens in the dealt order", () => {
  const p = sheet(3);
  assert.deepEqual(p.order, [0, 1, 2]);
  assert.deepEqual(PM.optOrder(p), [0, 1, 2]);
  assert.deepEqual(sheet(3, {keepTop: true}).order, [0, 1, 2], "a reorder carries one too");
});

test("promptMove swaps a kept card with its kept neighbour", () => {
  let p = sheet(3);
  p = PM.promptMove(p, 2, -1);
  assert.deepEqual(p.order, [0, 2, 1], "the third card is now drawn second");
  p = PM.promptMove(p, 2, -1);
  assert.deepEqual(p.order, [2, 0, 1], "and then first");
  p = PM.promptMove(p, 0, 1);
  assert.deepEqual(p.order, [2, 1, 0]);
});

test("a card sent to the bottom has no draw to move, and is skipped over", () => {
  let p = PM.promptToggleSel(sheet(3), 1);
  assert.equal(PM.promptMove(p, 1, -1), p, "the bottom card itself does not move");
  p = PM.promptMove(p, 2, -1);
  assert.deepEqual(p.order, [2, 1, 0], "card 2 swaps with card 0, past the bottom card");
});

test("an edge, a bad index or a bad direction leaves the prompt unchanged", () => {
  const p = sheet(3);
  for(const [i, d] of [[0, -1], [2, 1], [3, -1], [-1, 1], [1.5, 1], [1, 2], [1, 0], [null, 1], ["x", 1], [true, 1], ["", 1], [1, null], [1, true]])
    assert.equal(PM.promptMove(p, i, d), p, `move(${i}, ${d})`);
  assert.deepEqual(PM.promptMove(p, "2", "-1").order, [0, 2, 1], "a numeric string off JSON still reads");
  const pick = {tag: "pick", cards: [card(1), card(2)], sel: []};
  assert.equal(PM.promptMove(pick, 1, -1), pick, "only an opt sheet has an order");
  assert.equal(PM.promptMove(null, 0, 1), null);
});

test("an order that is not a permutation reads as the dealt order", () => {
  const p = sheet(3);
  for(const bad of [undefined, [0, 1], [0, 0, 1], [0, 1, 3], "012", [0, 1, 2.5]])
    assert.deepEqual(PM.optOrder({...p, order: bad}), [0, 1, 2], JSON.stringify(bad));
});

test("applyPrompt writes the kept cards in the chosen order, and the bottom after the rest", () => {
  let p = sheet(3);
  p = PM.promptMove(p, 2, -1);
  p = PM.promptMove(p, 2, -1);           /* order 2,0,1 */
  p = PM.promptToggleSel(p, 0);          /* card 0 to the bottom */
  const g = {sides: [{deck: [card(1), card(2), card(3), card(4), card(5)]}, {deck: []}]};
  const out = PM.applyPrompt(g, p);
  assert.deepEqual(out.game.sides[0].deck.map(c => c.uid), [3, 2, 4, 5, 1]);
});

test("a reorder writes its kept cards in order and its tapped ones under them", () => {
  let p = sheet(3, {keepTop: true});
  p = PM.promptMove(p, 1, 1);            /* order 0,2,1 */
  p = PM.promptToggleSel(p, 0);          /* card 0 under the rest */
  const g = {sides: [{deck: [card(1), card(2), card(3), card(4), card(5)]}, {deck: []}]};
  const out = PM.applyPrompt(g, p);
  assert.deepEqual(out.game.sides[0].deck.map(c => c.uid), [3, 2, 1, 4, 5]);
});

test("the seat policy keeps the dealt order, so its answer is unchanged", {skip}, () => {
  H.db();
  let g = H.state({deck: deckOf(MINE, 100)}, {deck: deckOf(THEIRS, 200)}, {actor: 0, turnPlayer: 0, turn: 3});
  g = H.runOps(g, [["opt", 3]], "Whisper of the Oracle");
  g = J.openPrompt(g);
  assert.equal(g.prompt.tag, "opt");
  const a = J.autoAnswer(g);
  assert.equal(a.t, "promptConfirm", "the policy confirms the sheet as dealt");
  g = J.reduce(g, a, 0).state;
  assert.deepEqual(g.sides[0].deck.map(c => c.uid), [100, 101, 102, 103]);
});

test("DRIVEN AT THE TABLE, seat 1: opt 3, reorder two, bottom one, confirm", {skip}, () => {
  H.db();
  let g = H.state({deck: deckOf(MINE, 100)}, {deck: deckOf(THEIRS, 200)}, {actor: 1, turnPlayer: 1, turn: 3});
  g = H.runOps(g, [["opt", 3]], "Whisper of the Oracle");
  g = J.openPrompt(g);
  assert.equal(g.prompt.side, 1);
  assert.ok(J.legal(g, {t: "promptMove", i: 2, dir: -1}, 0), "seat 0 may not reorder seat 1's sheet");
  assert.equal(J.legal(g, {t: "promptMove", i: 2, dir: -1}, 1), null);
  for(const a of [{t: "promptMove", i: 2, dir: -1}, {t: "promptMove", i: 2, dir: -1},
                  {t: "promptSel", i: 1}, {t: "promptConfirm"}]){
    const r = J.reduce(g, a, 1);
    assert.ok(!r.error, JSON.stringify(a) + ": " + r.error);
    g = r.state;
  }
  assert.equal(g.prompt, null);
  assert.deepEqual(g.sides[1].deck.map(c => c.uid), [202, 200, 203, 201],
    "Look Tuff drawn first, then Cindering Foresight; Photon Splicing on the bottom");
  assert.deepEqual(g.sides[0].deck.map(c => c.uid), [100, 101, 102, 103], "seat 0's deck untouched");
});

/* ---- the sheet, read as source (a React component cannot load in Node) */
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, " ");
const SRC = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
const S0 = SRC.indexOf("function PromptSheet({p, me,");
const SHEET = SRC.slice(S0, S0 + SRC.slice(S0).search(/\n\}\n/));

test("the sheet shows the resulting order with arrows on every kept card", () => {
  assert.ok(S0 > 0 && SHEET.length > 3000 && SHEET.length < 7000, "sheet slice " + SHEET.length);
  const a = SHEET.indexOf('{p.tag==="opt" && !!p.cards.length');
  assert.ok(a > 0, "the opt row is its own block");
  const row = SHEET.slice(a, SHEET.indexOf('{(p.tag==="pick"', a));
  assert.ok(row.length > 400 && row.length < 2200, "opt row width " + row.length);
  assert.match(row, /const ord0 = optOrder\(p\);/, "it reads the one order reader");
  assert.match(row, /const seq = \[\.\.\.kept, \.\.\.ord0\.filter\(i=>p\.down\.includes\(i\)\)\];/,
    "kept in order, then the bottom");
  assert.match(row, /onClick=\{go\(\(\)=>onToggle\(i\)\)\}/, "a tap still toggles");
  assert.match(row, /\{!down && kept\.length > 1 && <div className="parrows">/, "arrows on kept cards only");
  assert.match(row, /disabled=\{!mine \|\| at===0\} onClick=\{go\(\(\)=>onMove\(i,-1\)\)\}>◀/);
  assert.match(row, /disabled=\{!mine \|\| at===kept\.length-1\} onClick=\{go\(\(\)=>onMove\(i,1\)\)\}>▶/);
  assert.match(row, /ord\(pos\)\+" draw"/, "each card is labelled with its draw");
  assert.ok(SHEET.indexOf('(p.tag==="opt" || p.tag==="pick"') < 0, "opt left the shared card row");
});

test("both boards wire the arrows to the one reader", () => {
  assert.match(SRC, /onMove=\{promptMoveC\}/, "the trainer");
  assert.match(SRC, /const promptMoveC = \(i, dir\) => setG\(s=> s\.prompt \? \{\.\.\.s, prompt:promptMove\(s\.prompt, i, dir\)\} : s\);/);
  assert.match(SRC, /onMove=\{\(i,dir\)=>fire\(\{t:"promptMove", i, dir\}\)\}/, "the table");
  assert.equal((SRC.match(/onMove=\{/g) || []).length, 2);
});

test("the arrows are big enough to tap", () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = raw.match(/\.psheet \.parrows button\{min-width:(\d+)px;min-height:(\d+)px/);
  assert.ok(m, "the arrow rule is there");
  assert.ok(+m[1] >= 36 && +m[2] >= 28, `arrows are ${m[1]}x${m[2]}`);
});
