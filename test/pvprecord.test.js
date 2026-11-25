/* ============================================================
   pvprecord.test.js — THE RECORD AGAINST PEOPLE (worker AF)

   A finished friendly or direct table game against a PERSON is kept on this
   phone under `pvp`, apart from the AI record. Opponents are filed by HERO
   only. A game counts once per phone (its id is remembered), a ranked game is
   left to the server's Ranked card, and the judge's-table device never mounts
   the board that records.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const L = require("../engine/local.js");

function mem(init){
  const m = new Map(Object.entries(init || {}));
  return { writes: 0, getItem: k => (m.has(k) ? m.get(k) : null),
           setItem(k, v){ this.writes++; m.set(k, String(v)); }, raw: k => m.get(k) };
}
const WIN = {winner: 0, how: "life"}, LOSS = {winner: 1, how: "life"}, DRAW = {winner: null, how: "stalemate"};
const EMPTY = {mine: {}, foes: {}, seen: []};

test("a game against a person counts once, by hero on both sides", () => {
  const ls = mem();
  const r = L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "T1|a|b");
  assert.deepStrictEqual(r.pvp.mine, {viserai: {w: 1, l: 0, d: 0}});
  assert.deepStrictEqual(r.pvp.foes, {kayo: {w: 1, l: 0, d: 0}});
  assert.deepStrictEqual(r.foes, {}, "the AI record is untouched");
  assert.deepStrictEqual(r.mine, {}, "and so is the AI record's own hero list");
  const r2 = L.recordPvp(() => ls, "kayo", LOSS, 1, "azalea", "T2|a|b");   /* seat 1 and winner 1 is a win */
  assert.equal(r2.pvp.mine.azalea.w, 1, "seat 1 winning is a win for seat 1");
  const r3 = L.recordPvp(() => ls, "kayo", DRAW, 0, "viserai", "T3|a|b");
  assert.deepStrictEqual(r3.pvp.mine.viserai, {w: 1, l: 0, d: 1});
  assert.deepStrictEqual(r3.pvp.foes.kayo, {w: 2, l: 0, d: 1});
});

test("the same game is never counted twice (reconnect, rejoin, replayed end state)", () => {
  const ls = mem();
  assert.ok(L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "T1|a|b"));
  const writes = ls.writes;
  for(let i = 0; i < 3; i++) assert.equal(L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "T1|a|b"), null, "replay " + i);
  assert.equal(ls.writes, writes, "a replay does not even write");
  assert.equal(L.loadRecord(() => ls).pvp.mine.viserai.w, 1);
  /* a fresh load (a reload / another mount) still knows the id: it lives in storage, not in a ref */
  assert.equal(L.recordPvp(() => mem({[L.RECORD_KEY]: ls.raw(L.RECORD_KEY)}), "kayo", WIN, 0, "viserai", "T1|a|b"), null);
  /* a rematch at the same table is a different deal, so a different id, and counts */
  assert.ok(L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "T1|c|d"));
  assert.equal(L.loadRecord(() => ls).pvp.mine.viserai.w, 2);
});

test("nothing is counted without a result, a hero on each side, or an id", () => {
  const ls = mem();
  for(const args of [[null, 0, "viserai", "g"], [{}, 0, "viserai", "g"], [WIN, 0, null, "g"], [WIN, 0, "viserai", ""], [WIN, 0, "unknown", "g"]]){
    assert.equal(L.recordPvp(() => ls, "kayo", ...args), null);
  }
  assert.equal(L.recordPvp(() => ls, null, WIN, 0, "viserai", "g"), null, "no opponent hero");
  assert.equal(ls.writes, 0);
});

test("bumpPvp itself refuses an unknown outcome, so it is safe to call without the wrapper", () => {
  const r = L.bumpPvp(null, "kayo", "x", "viserai", "g");
  assert.deepStrictEqual(r.pvp, EMPTY);
});

test("the seen list is capped, and keeps the newest", () => {
  let ls = mem();
  for(let i = 0; i < L.SEEN_CAP + 10; i++) L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "g" + i);
  const r = L.loadRecord(() => ls);
  assert.equal(r.pvp.seen.length, L.SEEN_CAP);
  assert.equal(r.pvp.seen[r.pvp.seen.length - 1], "g" + (L.SEEN_CAP + 9));
  assert.equal(r.pvp.mine.viserai.w, L.SEEN_CAP + 10, "the counts are never capped");
});

test("a v2 record migrates on load with no write, and nothing in it is lost", () => {
  const v2 = {v: 2, foes: {kayo: {sharp: {w: 2, l: 1, d: 0}}}, mine: {viserai: {w: 2, l: 1, d: 0}}};
  const ls = mem({[L.RECORD_KEY]: JSON.stringify(v2)});
  const r = L.loadRecord(() => ls);
  assert.equal(r.v, 3);
  assert.deepStrictEqual(r.foes, v2.foes); assert.deepStrictEqual(r.mine, v2.mine);
  assert.deepStrictEqual(r.pvp, EMPTY);
  assert.equal(ls.writes, 0, "loading alone does not rewrite storage");
  /* an AI game after the migration keeps working and keeps pvp */
  const a = L.recordResult(() => ls, "kayo", true, WIN, 0, "viserai");
  assert.equal(a.foes.kayo.sharp.w, 3);
  const p = L.recordPvp(() => ls, "azalea", LOSS, 0, "viserai", "g1");
  assert.equal(p.pvp.mine.viserai.l, 1);
  assert.equal(L.recordResult(() => ls, "kayo", true, WIN, 0, "viserai").pvp.mine.viserai.l, 1, "an AI write keeps the people record");
  assert.equal(JSON.parse(ls.raw(L.RECORD_KEY)).v, 3);
});

test("junk in pvp reads as empty or is cleaned, never as a number nobody counted", () => {
  const read = pvp => L.loadRecord(() => mem({[L.RECORD_KEY]: JSON.stringify({v: 3, foes: {}, mine: {}, pvp})})).pvp;
  assert.deepStrictEqual(read(7), EMPTY);
  assert.deepStrictEqual(read({mine: {viserai: {w: 2, l: -1, d: "x"}, bad: 5, unknown: {w: 9, l: 0, d: 0}}, seen: ["a", 3, ""]}),
    {mine: {viserai: {w: 2, l: 0, d: 0}}, foes: {}, seen: ["a"]});
  /* a v1/v2 record that smuggles a pvp is not believed */
  assert.deepStrictEqual(L.loadRecord(() => mem({[L.RECORD_KEY]: JSON.stringify({v: 2, foes: {}, mine: {}, pvp: {mine: {viserai: {w: 5, l: 0, d: 0}}}})})).pvp, EMPTY);
});

test("no name or person id is ever stored", () => {
  const ls = mem();
  L.recordPvp(() => ls, "kayo", WIN, 0, "viserai", "T1|a|b");
  assert.deepStrictEqual(Object.keys(JSON.parse(ls.raw(L.RECORD_KEY)).pvp).sort(), ["foes", "mine", "seen"]);
});

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("the board counts a person game: not local, not ranked, one stable id; the judge's device never mounts the board", () => {
  const m = HTML.match(/DawnLocal\.recordPvp\(lsGet,[^;]*;/);
  assert.ok(m, "the board makes the call");
  assert.match(m[0], /them\.heroKey/); assert.match(m[0], /me\.heroKey/);
  assert.match(HTML, /if\(!over \|\| local \|\| ranked[^)]*\) return;[\s\S]{0,200}recordPvp/, "gated off for local and ranked");
  assert.match(HTML, /seedC[^;]*seedG|seedG[^;]*seedC/, "the id names the deal");
  const judgeRoom = HTML.slice(HTML.indexOf("function JudgeRoom("), HTML.indexOf("function TableBoard("));
  assert.ok(judgeRoom.length > 500 && !/DawnLocal\.record|<TableBoard/.test(judgeRoom), "the hub's screen never records");
});
