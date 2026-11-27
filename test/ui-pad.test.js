/* ============================================================
   ui-pad.test.js — CRESCENDO's scratch pad (ui/pad.js, F6/F7), the pure half

   There is NO LOG in ranked (TRP 5.8: "Recording the life total, changes to the life total, and the source of the change"),
   so the pad is exactly that and nothing else. Driven over whole self-played games (the five of test/announce.test.js):

     - every figure comes from the engine's marks: a seat's current total on the pad is that seat's life in the final state,
       and the opening total plus the signed changes IS the current total, step by step;
     - the pad writes one line per life change and no line for anything else (no cards, no phases, no passes);
     - the rows are the paper's: the old totals struck, the last one current, each change between its two totals;
     - recording is immutable and a step that changes no life leaves the pad as it was.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const PAD = require("../ui/pad.js");
const A = require("../engine/announce.js");
const L = require("../engine/local.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached card database";
const DATA = skip ? null : require("./helpers/extract.js").loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard)));
function play(k0, k1, seed, first){
  const h0 = DATA.HEROES.find(h => h.k === k0), h1 = DATA.HEROES.find(h => h.k === k1), ctr = {n: 0}, steps = [];
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  const g0 = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
  const s = L.createLocal({seat: 0, state: g0, reduce: J.reduce, legal: J.legal, policy: (st, i) => SP.act(st, i), onStep: e => steps.push(e)});
  s.start();
  for(let i = 0; i < 4000 && !s.state().over; i++){ const a = SP.act(s.state(), 0); if(!a) break; if(s.submit(a)) break; }
  return {g0, end: s.state(), steps};
}
const GAMES = [["kayo", "dorinthea", "pad1", 0], ["viserai", "iyslander", "pad2", 1], ["enigma", "briar", "pad3", 0], ["arakni", "azalea", "pad4", 1], ["fai", "dash", "pad5", 0]];
let _g = null;
const games = () => _g || (_g = GAMES.map(x => ({key: x.slice(0, 2).join("/"), ...play(...x)})));
const hp = (g, i) => g.sides[i].hp;

test("the pad is exact: opening total + the signed changes is the current total, at every step of every game", {skip}, () => {
  let changes = 0;
  for(const G0 of games()){
    let pad = PAD.empty([hp(G0.g0, 0), hp(G0.g0, 1)]);
    for(const st of G0.steps){
      const before = pad;
      pad = PAD.record(pad, st);
      assert.notStrictEqual(pad.seats[0], before.seats[0] === pad.seats[0] ? null : before.seats[0], "immutable");
      const cols = PAD.columns(pad, ["A", "B"]);
      for(const i of [0, 1]){
        const sum = pad.start[i] + pad.seats[i].reduce((n, e) => n + e.delta, 0);
        assert.equal(cols[i].cur, hp(st.next, i), `${G0.key} T${st.next.turn}: seat ${i} pad says ${cols[i].cur}, the game says ${hp(st.next, i)}`);
        assert.equal(sum, cols[i].cur, `${G0.key}: the changes do not add up`);
      }
      changes += A.marks(st).length;
    }
    /* the end of the game: the paper's current totals are the final lives */
    const cols = PAD.columns(pad, ["A", "B"]);
    assert.equal(cols[0].cur, hp(G0.end, 0)); assert.equal(cols[1].cur, hp(G0.end, 1));
    assert.equal(pad.seats[0].length + pad.seats[1].length, G0.steps.reduce((n, st) => n + A.marks(st).length, 0), "one entry per life change, none for anything else");
  }
  assert.ok(changes > 40, "the games moved life: " + changes);
});

test("the paper: old totals struck, the last total current, each change between its two totals, nothing else", {skip}, () => {
  const G0 = games()[0];
  let pad = PAD.empty([hp(G0.g0, 0), hp(G0.g0, 1)]);
  for(const st of G0.steps) pad = PAD.record(pad, st);
  const cols = PAD.columns(pad, ["You", "Them"]);
  const KEYS = new Set(["k", "v", "cls", "turn", "src", "delta", "text"]);
  for(const c of cols){
    assert.equal(c.rows[0].k, "t", "a column opens on a total");
    c.rows.forEach((r, i) => {
      assert.ok(Object.keys(r).every(k => KEYS.has(k)), "a row carries only what a pad writes: " + Object.keys(r));
      if(r.k === "a"){ assert.equal(c.rows[i - 1].k, "t"); assert.equal(c.rows[i + 1].k, "t"); assert.match(r.text, /^[−+]\d+$/); assert.equal(PAD.lineText(r).startsWith("T" + r.turn), true); }
      else assert.equal(r.cls, i === c.rows.length - 1 ? "cur" : "x", "only the last total is current");
    });
    assert.equal(c.rows[c.rows.length - 1].k, "t");
    /* between two totals the line says exactly their difference */
    for(let i = 1; i < c.rows.length; i += 2) assert.equal(c.rows[i - 1].v + c.rows[i].delta, c.rows[i + 1].v);
  }
  assert.ok(cols[0].rows.length + cols[1].rows.length > 10);
  assert.equal(PAD.signed(-3), "−3"); assert.equal(PAD.signed(2), "+2");
});

test("a step that changes no life leaves the pad as it was; a source is named only when the engine said it", {skip}, () => {
  const G0 = games()[1];
  let pad = PAD.empty([hp(G0.g0, 0), hp(G0.g0, 1)]), still = 0, sourced = 0, bare = 0;
  for(const st of G0.steps){
    const next = PAD.record(pad, st);
    if(!A.marks(st).length){ assert.deepEqual(next.seats, pad.seats); if(next.seats === pad.seats) still++; }
    pad = next;
  }
  for(const e of pad.seats[0].concat(pad.seats[1])) e.source ? sourced++ : bare++;
  assert.ok(still > 100, "most steps change nothing: " + still);
  assert.ok(sourced > 0, "some changes name their source"); 
  /* an empty pad writes no line */
  const e = PAD.columns(PAD.empty([20, 20]), ["A", "B"]);
  assert.deepEqual(e.map(c => c.rows.map(r => r.cls)), [["cur"], ["cur"]]);
});

test("the pad is not a log: the module reads life marks and nothing from a card, a phase or the feed", () => {
  const src = fs.readFileSync(require("path").join(__dirname, "..", "ui", "pad.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for(const bad of [/\.feed\b/, /\.hand\b/, /\.phase\b/, /\.step\b/, /\.deck\b/, /\.grave\b/, /pitch/i]) assert.ok(!bad.test(src), "pad.js reads " + bad);
  assert.ok(/A\.marks\(/.test(src), "it asks the engine what changed");
});
