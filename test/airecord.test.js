/* ============================================================
   airecord.test.js — THE RECORD AGAINST AN AI HERO (v5.84, decision D)

   A table win over an AI hero earns no trophy and no best score (v5.79).
   It earns a COUNT: per AI hero and per level (Sharp / Steady), the wins,
   losses and draws of finished local games, kept in localStorage on this
   device. engine/local.js holds the bookkeeping; TableBoard makes the one
   call when `over` arrives.

   Drilled:
     - a finished game bumps exactly ONE counter, keyed by hero and level,
       for a real win, a real concession (a loss) and a real draw;
     - an unfinished or abandoned game (no `over`) bumps nothing and does
       not even write;
     - storage that is missing, throws on access, on read or on write, or
       holds garbage never throws into the game and reads as empty;
     - the board makes the call only for a LOCAL game against a HERO, once.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const L = require("../engine/local.js");
const J = require("../engine/judge.js");

/* a Storage double: getItem / setItem over a Map, counting writes */
function mem(init){
  const m = new Map(Object.entries(init || {}));
  return { writes: 0, getItem: k => (m.has(k) ? m.get(k) : null),
           setItem(k, v){ this.writes++; m.set(k, String(v)); }, raw: k => m.get(k) };
}
const total = r => Object.values(r.foes).reduce((n, f) =>
  n + Object.values(f).reduce((a, c) => a + c.w + c.l + c.d, 0), 0);

test("the outcome is read from `over` and the seat asking", () => {
  assert.equal(L.outcomeOf(null, 0), null, "no result yet: nothing to count");
  assert.equal(L.outcomeOf(undefined, 0), null);
  assert.equal(L.outcomeOf({winner: 0, how: "life"}, 0), "w");
  assert.equal(L.outcomeOf({winner: 1, how: "life"}, 0), "l");
  /* CR 4.5.3c: a player who concedes loses the game */
  assert.equal(L.outcomeOf({winner: 1, how: "concession"}, 0), "l", "a concession is a loss");
  assert.equal(L.outcomeOf({winner: null, how: "stalemate"}, 0), "d", "a dead position is a draw");
  assert.equal(L.outcomeOf({winner: 0, how: "life"}, 1), "l", "from the other seat it is the other result");
});

test("a bump changes exactly one counter, keyed by hero and level", () => {
  const r0 = L.bumpRecord(null, "kayo", "sharp", "w");
  assert.deepStrictEqual(r0, {v: 1, foes: {kayo: {sharp: {w: 1, l: 0, d: 0}}}});
  const r1 = L.bumpRecord(r0, "kayo", "steady", "l");
  assert.deepStrictEqual(r1.foes.kayo, {sharp: {w: 1, l: 0, d: 0}, steady: {w: 0, l: 1, d: 0}},
    "the other level is its own counter");
  const r2 = L.bumpRecord(r1, "azalea", "sharp", "d");
  assert.deepStrictEqual(r2.foes.azalea, {sharp: {w: 0, l: 0, d: 1}}, "and the other hero its own");
  assert.deepStrictEqual(r2.foes.kayo, r1.foes.kayo, "touching nobody else");
  assert.equal(total(r2), 3);
  assert.deepStrictEqual(r0, {v: 1, foes: {kayo: {sharp: {w: 1, l: 0, d: 0}}}}, "the input is never mutated");
  /* ask for the refusal, not only the match */
  for(const [k, lv, o] of [[null, "sharp", "w"], ["kayo", "hard", "w"], ["kayo", "sharp", "x"], ["", "steady", "l"]])
    assert.equal(total(L.bumpRecord(r2, k, lv, o)), 3, `nothing counted for ${k}/${lv}/${o}`);
});

test("a finished game is one write; an unfinished one is none", () => {
  const ls = mem();
  const get = () => ls;
  assert.equal(L.recordResult(get, "kayo", true, null, 0), null, "no `over`: an abandoned game");
  assert.equal(L.recordResult(get, "kayo", true, {winner: 0, how: "life"}, 0) && ls.writes, 1);
  assert.equal(ls.writes, 1, "the abandoned game wrote nothing");
  L.recordResult(get, "kayo", false, {winner: 1, how: "concession"}, 0);
  L.recordResult(get, null, true, {winner: 0, how: "life"}, 0);   // the Dummy: no hero key
  assert.equal(ls.writes, 2, "a game against the Dummy is not counted");
  const back = JSON.parse(ls.raw(L.RECORD_KEY));
  assert.deepStrictEqual(back, {v: 1, foes: {kayo: {sharp: {w: 1, l: 0, d: 0}, steady: {w: 0, l: 1, d: 0}}}});
  assert.deepStrictEqual(L.loadRecord(get), back, "and it reads back as written");
  assert.equal(L.RECORD_KEY, "dawnblade.aiRecord", "the key the page's other settings share a prefix with");
});

test("storage that is missing or throws never reaches the game", () => {
  const boom = () => { throw new Error("SecurityError"); };
  const throwing = [
    ["no storage at all", () => undefined],
    ["access throws", boom],
    ["read throws", () => ({getItem: boom, setItem: boom})],
    ["write throws (quota)", () => ({getItem: () => null, setItem: boom})],
  ];
  for(const [why, get] of throwing){
    assert.deepStrictEqual(L.loadRecord(get), {v: 1, foes: {}}, why + ": reads as empty");
    assert.equal(L.saveRecord(get, L.bumpRecord(null, "kayo", "sharp", "w")), false, why + ": the write says it failed");
    const r = L.recordResult(get, "kayo", true, {winner: 0, how: "life"}, 0);
    assert.deepStrictEqual(r && r.foes.kayo, {sharp: {w: 1, l: 0, d: 0}}, why + ": the game still gets its answer");
  }
  for(const raw of ["{not json", "[]", "7", JSON.stringify({v: 2, foes: {kayo: {sharp: {w: 9}}}}),
                    JSON.stringify({v: 1, foes: {kayo: {sharp: {w: -3, l: 1.5, d: "x"}}}})]){
    const r = L.loadRecord(() => mem({[L.RECORD_KEY]: raw}));
    assert.equal(total(r), 0, "garbage reads as no games, never as a number nobody counted: " + raw);
  }
});

/* ---- A REAL ENDING -------------------------------------------------------
   The concession is the judge's own: seat 0 concedes through `reduce`, and
   the `over` it writes is what the board hands over. A draw is the judge's
   own stalemate shape. */
const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached card database";
test("the judge's own concession counts as one loss", {skip}, () => {
  const DATA = require("./helpers/extract.js").loadData();
  const C = require("../engine/cards.js"), B = require("../engine/build.js");
  const G = require("../engine/game.js"), RNG = require("../engine/rng.js");
  const db = C.buildMaps(require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard));
  const h0 = DATA.HEROES.find(h => /kayo/i.test(h.n)), h1 = DATA.HEROES.find(h => /dorinthea/i.test(h.n));
  const ctr = {n: 0}; let rng = RNG.make("airecord");
  const b0 = B.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), db, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), db, rng, ctr); rng = b1.rng;
  const g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const ls = mem(), get = () => ls;
  assert.equal(L.recordResult(get, g.sides[1].heroKey, false, g.over, 0), null, "mid-game: nothing");
  const res = J.reduce(g, {t: "concede"}, 0);
  assert.ok(!res.error, "the judge accepts the concession: " + res.error);
  const done = res.state;
  assert.ok(done.over, "the concession ended the game");
  const r = L.recordResult(get, done.sides[1].heroKey, false, done.over, 0);
  assert.deepStrictEqual(r.foes, {[h1.k]: {steady: {w: 0, l: 1, d: 0}}});
});

/* ---- THE BOARD'S CALL ----------------------------------------------------
   The call site is the observable here: TableBoard is a React component in
   index.html with no headless harness, and tools/page.js drives it on the
   real page (a win and a concession, then the picker's label). This pins
   the gate the drive cannot vary: local only, a hero only, `over` only,
   once per `over`. */
test("the board counts only a finished local game against a hero, once", () => {
  const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const i = HTML.indexOf("function TableBoard(");
  const body = HTML.slice(i, HTML.indexOf("\nfunction ", i + 10));
  const calls = body.match(/DawnLocal\.recordResult\(/g) || [];
  assert.equal(calls.length, 1, "one call site");
  const at = body.indexOf("DawnLocal.recordResult(");
  const eff = body.slice(body.lastIndexOf("uE(", at), body.indexOf("},[g.over]);", at) + 12);
  assert.match(eff, /if\(!over \|\| !local \|\| !them\.heroKey \|\| counted\.current === over\) return;/,
    "gated on a result, a local game, a hero seat, and not already counted");
  assert.match(eff, /counted\.current = over;/, "and it remembers what it counted");
  assert.match(eff, /recordResult\(lsGet, them\.heroKey, !!match\.sharp, over, mySeat\)/, "keyed by the AI's hero and level");
  assert.ok(eff.endsWith("},[g.over]);"), "and runs when the result arrives");
  /* the trainer never counts */
  const bi = HTML.indexOf("function Battle(");
  assert.ok(!/recordResult/.test(HTML.slice(bi, HTML.indexOf("\nfunction ", bi + 10))), "the trainer is untouched");
});
