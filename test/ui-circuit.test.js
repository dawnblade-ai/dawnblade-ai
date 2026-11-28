/* test/ui-circuit.test.js — ui/circuit.js, the Circuit's store and rules (docs/crescendo/SCREENS-CIRCUIT.md, P1-P10).
   Pure drills: assertions on store fields and returned events, never prose. SABOTAGE LOG (each applied to ui/circuit.js, this file
   run, the named drill seen to FAIL, then reverted): P1 id check removed -> "P1"; FOLD 2001 -> "2000 fold"; P2 "daily" out of the AI row -> "P2";
   P3 pair without the sharp gate -> "P3"; P4 ceil(N/3) -> floor -> "P4"; P5 rung overwritten -> "P5"; P6 `b.v >= a.v` -> `>` -> "P6";
   P7 official always true -> "P7"; P8 practice counted in bests -> "P8" (and P7); P9 rung event dropped -> "P9" (and the fixture);
   P10 steady counted as Sharp -> "P10"; save over a newer v -> "storage". */
const test = require("node:test");
const assert = require("node:assert");
const C = require("../ui/circuit.js");
const {loadData} = require("./helpers/extract.js");

const HEROES = loadData().HEROES, N = HEROES.length;
const T0 = Date.UTC(2026, 10, 28, 12, 0, 0);
let seq = 0;
const G = (o) => Object.assign({id: "g" + (++seq), at: T0 + seq * 1000, kind: "ai", me: "iyslander", foe: "kayo", level: "sharp", result: "w", how: "life", turns: 6, life: [7, 0], first: 1, seed: "421873", dv: "t"}, o);
const rec = (s, o) => C.record(s, G(o), HEROES);
const types = (ev) => ev.map(e => e.t);

test("worked fixture, step by step (the doc's six steps)", () => {
  let s = C.empty("d_t");
  let r = rec(s, {id: "a1"}); s = r.store;
  assert.deepStrictEqual(r.events, [
    {t: "rank", hero: "iyslander", from: 0, to: 2}, {t: "rung", foe: "kayo"},
    {t: "best", which: "fastWin", value: 6, was: null}, {t: "pair", hero: "iyslander", beaten: 1}]);
  r = rec(s, {id: "a2"}); assert.deepStrictEqual(r.events, []); s = r.store;
  assert.strictEqual(C.tallies(s).ai.w, 2); assert.strictEqual(s.marks.best.fastWin.turns, 6);
  const marks3 = JSON.stringify(s.marks);
  r = rec(s, {id: "a3", kind: "dummy", foe: "dummy", level: null, turns: 5}); s = r.store;
  assert.deepStrictEqual(r.events, []); assert.strictEqual(JSON.stringify(s.marks), marks3, "a dummy game touches no mark");
  r = rec(s, {id: "a4", kind: "daily", day: "2026-11-28", me: "gravy", foe: "fai", result: "l", turns: 10, life: [0, 5]}); s = r.store;
  assert.deepStrictEqual(r.events, [{t: "daily", r: "l", turns: 10}]);
  assert.strictEqual(s.marks.days["2026-11-28"].r, "l"); assert.strictEqual(C.streak(s, "2026-11-28").cur, 1);
  r = rec(s, {id: "a5", kind: "daily", day: "2026-11-28", me: "gravy", foe: "fai", result: "w", turns: 4}); s = r.store;
  assert.deepStrictEqual(r.events, [{t: "rank", hero: "gravy", from: 1, to: 2}, {t: "rung", foe: "fai"}, {t: "pair", hero: "gravy", beaten: 1}]);
  assert.strictEqual(s.marks.days["2026-11-28"].r, "l", "practice never rewrites the official day");
  assert.strictEqual(s.games[s.games.length - 1].official, false);
  assert.strictEqual(s.marks.best.fastWin.turns, 6, "a practice win is no best");
  assert.strictEqual(C.record(s, G({id: "a5"}), HEROES), null);
});

test("P1 record: idempotent on id, nothing for no result, immutable, null changes nothing", () => {
  const s = C.empty("d");
  const frozen = JSON.stringify(s);
  const a = rec(s, {id: "x"});
  assert.strictEqual(JSON.stringify(s), frozen, "input not mutated");
  assert.strictEqual(a.store.games.length, 1);
  assert.strictEqual(C.record(a.store, G({id: "x", result: "l"}), HEROES), null);
  assert.strictEqual(a.store.games.length, 1);
  assert.strictEqual(C.record(s, G({id: "y", result: undefined}), HEROES), null);
  assert.strictEqual(C.record(s, G({id: "z", result: null}), HEROES), null);
  assert.strictEqual(C.record(s, G({id: "q", kind: "bogus"}), HEROES), null);
  assert.strictEqual(C.record(s, G({id: "q", how: "bogus"}), HEROES), null);
  const lost = rec(s, {id: "l1", result: "l", level: "sharp"});
  assert.deepStrictEqual(lost.events, [], "nothing for losing"); assert.deepStrictEqual(lost.store.marks.beat, {});
});

test("2000 fold: oldest dropped into folded, counts kept, marks kept", () => {
  let s = C.empty("d");
  s = rec(s, {id: "first", result: "l", me: "kayo", foe: "dash", at: 1}).store;
  s = rec(s, {id: "sw", me: "kayo", foe: "dash", at: 2}).store;
  for(let i = 0; i < 2000; i++) s = rec(s, {id: "f" + i, kind: "friend", level: null, result: "d", how: "stalemate", me: "kayo", foe: "fai", at: 10 + i}).store;
  assert.strictEqual(s.games.length, C.FOLD); assert.strictEqual(C.FOLD, 2000);
  assert.ok(!s.games.some(g => g.id === "first" || g.id === "sw"));
  assert.deepStrictEqual(s.folded.ai.kayo, {w: 1, l: 1, d: 0});
  assert.strictEqual(C.tallies(s).ai.w + C.tallies(s).ai.l, 2, "the fold keeps tallies");
  assert.strictEqual(C.mastery(s, "kayo", HEROES).games, 2002);
  assert.deepStrictEqual(s.marks.beat.kayo, ["dash"], "marks survive the fold");
  assert.strictEqual(C.record(s, G({id: "f5"}), HEROES), null, "a kept id is still refused");
});

test("P2 tallies: rows, legacy merged, ranked from the server, totals", () => {
  let s = C.empty("d");
  [{kind: "ai"}, {kind: "road", result: "l"}, {kind: "daily", day: "2026-11-28", result: "d", how: "stalemate"},
   {kind: "friend", level: null, result: "l", how: "concession"}, {kind: "ranked", level: null, rating: {from: 1, to: 2}},
   {kind: "dummy", foe: "dummy", level: null}].forEach(o => { s = rec(s, o).store; });
  const t = C.tallies(s, {ai: {w: 3, l: 2, d: 1}, people: {w: 1, l: 0, d: 0}}, null);
  assert.deepStrictEqual(t.ai, {w: 4, l: 3, d: 2}); assert.deepStrictEqual(t.people, {w: 1, l: 1, d: 0});
  assert.deepStrictEqual(t.dummy, {w: 1, l: 0, d: 0}); assert.strictEqual(t.ranked, null, "a ranked receipt is not a tally");
  assert.deepStrictEqual(C.tallies(s, null, {you: {wins: 5, losses: 4, draws: 0}}).ranked, {w: 5, l: 4, d: 0});
  const all = C.tallies(s, null, {wins: 2, losses: 1, draws: 1});
  assert.strictEqual(all.total.w, all.ai.w + all.people.w + all.ranked.w + all.dummy.w);
  assert.strictEqual(all.total.d, 2);
});

test("P3 pair: set semantics, Sharp wins only, mirror counts", () => {
  let s = C.empty("d");
  s = rec(s, {me: "dash", foe: "dash"}).store; s = rec(s, {me: "dash", foe: "dash"}).store;
  assert.deepStrictEqual(s.marks.beat.dash, ["dash"]);
  s = rec(s, {me: "dash", foe: "fai", level: "steady"}).store; s = rec(s, {me: "dash", foe: "fai", kind: "friend", level: null}).store;
  s = rec(s, {me: "dash", foe: "fai", result: "l"}).store;
  assert.deepStrictEqual(s.marks.beat.dash, ["dash"]);
  s = rec(s, {me: "dash", foe: "fai", kind: "road"}).store;
  assert.deepStrictEqual(s.marks.beat.dash, ["dash", "fai"]);
});

test("P4 mastery: thresholds at N=17 and at another N, dummy wins excluded, never down", () => {
  assert.strictEqual(N, 17);
  let s = C.empty("d");
  assert.strictEqual(C.mastery(s, "kayo", HEROES).rank, 0);
  s = rec(s, {me: "kayo", result: "l"}).store; assert.strictEqual(C.mastery(s, "kayo", HEROES).rank, 1);
  s = rec(s, {me: "kayo", kind: "dummy", foe: "dummy", level: null}).store; assert.strictEqual(C.mastery(s, "kayo", HEROES).rank, 1, "a dummy win is no BLOODED");
  s = rec(s, {me: "kayo", kind: "friend", level: null, foe: "dash"}).store; assert.strictEqual(C.mastery(s, "kayo", HEROES).rank, 2);
  const foes = HEROES.map(h => h.k);
  const rankAt = (n) => { let t = s; foes.slice(0, n).forEach(f => { t = rec(t, {me: "kayo", foe: f}).store; }); return C.mastery(t, "kayo", HEROES); };
  assert.strictEqual(rankAt(5).rank, 2); assert.strictEqual(rankAt(6).rank, 3); assert.strictEqual(rankAt(11).rank, 3);
  assert.strictEqual(rankAt(12).rank, 4); assert.strictEqual(rankAt(16).rank, 4);
  const full = rankAt(17); assert.strictEqual(full.rank, 5); assert.strictEqual(full.name, "DAWNBLADE"); assert.strictEqual(full.next, null);
  assert.deepStrictEqual(full.need, {proven: 6, master: 12, dawnblade: 17});
  assert.strictEqual(C.mastery(full.beat ? rankAtStore() : s, "kayo", HEROES.concat({k: "x", ch: 5})).rank, 4, "a bigger roster: 17 of 18 is MASTER, shown as 17 of 18");
  function rankAtStore(){ let t = s; foes.forEach(f => { t = rec(t, {me: "kayo", foe: f}).store; }); return t; }
  assert.strictEqual(rankAt(6).next.rank, 4); assert.strictEqual(rankAt(6).next.need, 12);
  const sm = C.mastery(s, "kayo", HEROES.slice(0, 3));
  assert.deepStrictEqual(sm.need, {proven: 1, master: 2, dawnblade: 3});
});

test("P5 road: first clear kept, next in roster order, tiers by ch, summit", () => {
  let s = C.empty("d");
  s = rec(s, {me: "dash", foe: "viserai", turns: 9, id: "r1"}).store;
  s = rec(s, {me: "kayo", foe: "viserai", turns: 3, id: "r2"}).store;
  assert.deepStrictEqual(Object.keys(s.marks.road[("viserai")]).sort(), ["at", "id", "me", "turns"]);
  assert.strictEqual(s.marks.road.viserai.id, "r1"); assert.strictEqual(s.marks.road.viserai.me, "dash");
  let rd = C.road(s, HEROES);
  assert.strictEqual(rd.next, "kayo", "next = first uncleared in roster order"); assert.strictEqual(rd.total, N); assert.strictEqual(rd.done, 1);
  const ch1 = HEROES.filter(h => h.ch === 1).map(h => h.k);
  let last;
  ch1.forEach(f => { const r = rec(s, {me: "iyslander", foe: f}); s = r.store; last = r.events; });
  assert.ok(last.some(e => e.t === "tier" && e.ch === 1), "the clearing rung of a tier fires tier{ch}");
  assert.ok(!types(last).includes("summit"));
  rd = C.road(s, HEROES);
  assert.strictEqual(rd.tiers.find(t => t.ch === 1).cleared, true); assert.strictEqual(rd.tiers.find(t => t.ch === 2).cleared, false);
  assert.deepStrictEqual(rd.tiers.map(t => t.ch), [1, 2, 3, 4]);
  HEROES.forEach(h => { const r = rec(s, {me: "iyslander", foe: h.k}); s = r.store; });
  assert.ok(s.marks.summit && typeof s.marks.summit.at === "number"); assert.strictEqual(C.road(s, HEROES).next, null);
  let t = C.empty("d"), got = [];
  HEROES.forEach(h => { const r = rec(t, {me: "iyslander", foe: h.k}); t = r.store; got.push(types(r.events)[0]); });
  assert.strictEqual(got[got.length - 1], "summit"); assert.strictEqual(got.filter(x => x === "summit").length, 1);
});

test("P6 daily deal: the doc's vectors, never a mirror, deterministic, derived from the roster", () => {
  const V = [["2026-11-28", "gravy", "fai", 1], ["2026-11-29", "kayo", "blaze", 1], ["2026-11-30", "fai", "iyslander", 1], ["2026-12-01", "viserai", "azalea", 1],
    ["2026-12-02", "iyslander", "lyath", 0], ["2026-12-03", "enigma", "iyslander", 1], ["2026-12-04", "boltyn", "blaze", 1], ["2027-01-01", "blaze", "arakni", 1]];
  V.forEach(([d, me, foe, first]) => {
    const x = C.dailyDeal(d, HEROES);
    assert.deepStrictEqual([x.me, x.foe, x.first], [me, foe, first], d);
    assert.strictEqual(x.seed, "dawnblade-daily|" + d + "|match");
    assert.deepStrictEqual(C.dailyDeal(d, HEROES), x);
  });
  const seen = {}; let firsts = 0;
  for(let i = 0; i < 730; i++){
    const d = C.dayOf(Date.UTC(2026, 10, 28) + i * 86400000), x = C.dailyDeal(d, HEROES);
    assert.notStrictEqual(x.me, x.foe, "mirror on " + d); seen[x.me] = (seen[x.me] || 0) + 1; firsts += x.first;
  }
  assert.strictEqual(Object.keys(seen).length, N); assert.strictEqual(firsts, 387, "doc: first-player split 343/387 (first=0 / first=1)");
  const vals = Object.values(seen); assert.ok(Math.min(...vals) >= 35 && Math.max(...vals) <= 56);
  const three = C.dailyDeal("2026-11-28", ["a", "b", "c"]); assert.ok(["a", "b", "c"].includes(three.me) && three.me !== three.foe);
  assert.strictEqual(C.dailyDeal("2026-11-28", ["a"]), null);
});

test("dayOf is UTC", () => {
  assert.strictEqual(C.dayOf(Date.UTC(2026, 10, 28, 23, 59, 59)), "2026-11-28");
  assert.strictEqual(C.dayOf(new Date(Date.UTC(2026, 10, 29, 0, 0, 0))), "2026-11-29");
  assert.strictEqual(C.prevDay("2026-12-01"), "2026-11-30"); assert.strictEqual(C.prevDay("2027-01-01"), "2026-12-31");
});

test("P7 daily result: first finished game is official, practice never touches days, streak or bests; a concession is an official loss", () => {
  let s = C.empty("d");
  let r = rec(s, {kind: "daily", day: "2026-11-28", result: "l", how: "concession", turns: 3, life: [4, 9], official: false}); s = r.store;
  assert.strictEqual(s.games[0].official, true, "official is decided by the store, not the caller");
  assert.deepStrictEqual(s.marks.days["2026-11-28"], {r: "l", turns: 3, life: 4, me: "iyslander", foe: "kayo", id: s.games[0].id});
  const days = JSON.stringify(s.marks.days), best = JSON.stringify(s.marks.best);
  r = rec(s, {kind: "daily", day: "2026-11-28", result: "w", turns: 2, life: [1, 0], official: true}); s = r.store;
  assert.strictEqual(s.games[1].official, false);
  assert.strictEqual(JSON.stringify(s.marks.days), days); assert.strictEqual(JSON.stringify(s.marks.best), best);
  assert.strictEqual(s.marks.streak.best, 1); assert.ok(!types(r.events).includes("daily") && !types(r.events).includes("best"));
  assert.ok(types(r.events).includes("rung"), "a practice Sharp win is still a rung");
  assert.strictEqual(C.tallies(s).ai.w, 1);
  r = rec(s, {kind: "daily", day: "2026-11-29", result: "w", turns: 8}); assert.deepStrictEqual(r.events.filter(e => e.t === "daily"), [{t: "daily", r: "w", turns: 8}]);
});

test("P8 streak and bests", () => {
  let s = C.empty("d");
  const day = (d, result) => { s = rec(s, {kind: "daily", day: d, result, turns: 9, id: "d" + d, me: "kayo", foe: "dash"}).store; };
  day("2026-11-26", "l"); day("2026-11-27", "w"); day("2026-11-28", "l");
  assert.strictEqual(C.streak(s, "2026-11-28").cur, 3, "a loss counts as showing up");
  assert.deepStrictEqual(C.streak(s, "2026-11-29"), {cur: 3, best: 3, today: false}, "yesterday keeps it alive");
  assert.strictEqual(C.streak(s, "2026-11-30").cur, 0, "a missing day resets, no comment");
  assert.strictEqual(C.streak(s, "2026-11-30").best, 3);
  day("2026-12-05", "w"); assert.strictEqual(C.streak(s, "2026-12-05").cur, 1); assert.strictEqual(C.streak(s, "2026-12-05").best, 3);
  // bests
  let b = C.empty("d");
  const g = (o) => { b = rec(b, o).store; };
  g({turns: 8, life: [5, 0], at: 100}); g({turns: 6, life: [9, 0], at: 200}); g({turns: 6, life: [2, 0], at: 300, me: "dash", foe: "fai"});
  let x = C.bests(b);
  assert.strictEqual(x.fastWin.turns, 6); assert.strictEqual(x.fastWin.at, 200, "a tie keeps the earlier");
  assert.strictEqual(x.closeWin.life, 2); assert.strictEqual(x.run, 3);
  g({result: "l", at: 400}); g({at: 500}); assert.strictEqual(C.bests(b).run, 3, "a loss breaks the chain");
  g({kind: "dummy", foe: "dummy", level: null, turns: 1, at: 600}); assert.strictEqual(C.bests(b).fastWin.turns, 6, "the dummy is no best");
  g({how: "concession", turns: 2, life: [30, 0], at: 700}); assert.strictEqual(C.bests(b).fastWin.turns, 6, "only life wins are fast wins");
  g({result: "w", turns: 1, life: [0, 0], at: 800}); assert.strictEqual(C.bests(b).closeWin.life, 2, "life 0 is not a close win");
  g({kind: "ranked", level: null, rating: {from: 1200, to: 1248}, at: 900}); assert.strictEqual(C.bests(b).peak, 1248);
  g({kind: "ranked", level: null, result: "l", rating: {from: 1248, to: 1230}, at: 950}); assert.strictEqual(C.bests(b).peak, 1248);
  assert.strictEqual(C.bests(b, {rating: 1300}).peak, 1300); assert.strictEqual(C.bests(b, {best: {a: 14, b: 9}}).dummy, 9);
  let c = C.empty("d"); c = rec(c, {kind: "daily", day: "2026-11-28", result: "l", id: "o"}).store; c = rec(c, {kind: "daily", day: "2026-11-28", turns: 1, life: [3, 0], id: "p"}).store;
  assert.strictEqual(C.bests(c).fastWin, null, "practice replays are no best");
});

test("P9 events: priority order and each one a fact of a change", () => {
  let s = C.empty("d");
  const ch3 = HEROES.filter(h => h.ch !== 4).map(h => h.k).filter(k => k !== "gravy");
  HEROES.forEach(h => { if(h.k !== "gravy") s = rec(s, {me: "dash", foe: h.k, turns: 20}).store; });
  const r = rec(s, {me: "dash", foe: "gravy", turns: 3, id: "last"});
  assert.deepStrictEqual(types(r.events), ["summit", "tier", "rank", "rung", "best", "pair"]);
  assert.deepStrictEqual(r.events.find(e => e.t === "tier"), {t: "tier", ch: 3});
  assert.deepStrictEqual(r.events.find(e => e.t === "rank"), {t: "rank", hero: "dash", from: 4, to: 5});
  const daily = rec(C.empty("d"), {kind: "daily", day: "2026-11-28", me: "kayo", foe: "dash", turns: 4});
  assert.deepStrictEqual(types(daily.events), ["rank", "daily", "rung", "best", "pair"]);
  assert.ok(ch3.length > 0);
  const again = rec(r.store, {me: "dash", foe: "gravy", turns: 3}); assert.deepStrictEqual(again.events, [], "no change, no event");
  const spar = rec(C.empty("d"), {result: "l"}); assert.deepStrictEqual(spar.events, [], "SPARRED fills quietly");
  const close = rec(rec(C.empty("d"), {turns: 5, life: [9, 0], id: "q1"}).store, {turns: 7, life: [2, 0], foe: "fai", id: "q2"});
  assert.deepStrictEqual(close.events.filter(e => e.t === "best"), [{t: "best", which: "closeWin", value: 2, was: 9}]);
});

test("P10 honesty: steady games are games, never Sharp wins; opening the app awards nothing", () => {
  let s = C.empty("d");
  const r = rec(s, {level: "steady"}); s = r.store;
  assert.strictEqual(s.games.length, 1); assert.strictEqual(C.tallies(s).ai.w, 1);
  assert.deepStrictEqual(s.marks.beat, {}); assert.deepStrictEqual(s.marks.road, {}); assert.deepStrictEqual(r.events.map(e => e.t), ["rank", "best"].filter(t => r.events.some(e => e.t === t)));
  assert.strictEqual(C.mastery(s, "iyslander", HEROES).rank, 2);
  const e = C.empty("d");
  assert.deepStrictEqual(C.bests(e), {fastWin: null, closeWin: null, run: 0, peak: null, streak: 0, dummy: null});
  assert.strictEqual(C.streak(e, "2026-11-28").cur, 0); assert.strictEqual(C.road(e, HEROES).done, 0);
});

/* ---- storage ---- */
const mem = (init) => { const m = Object.assign({}, init); return {m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }}; };

test("storage: round trip, flags, never throws, a newer build is never overwritten", () => {
  const st = mem();
  const fresh = C.load(st); assert.strictEqual(fresh.flag, null); assert.strictEqual(fresh.v, 1);
  const s = rec(fresh, {}).store;
  assert.strictEqual(C.save(s, st), true);
  assert.ok(!("flag" in JSON.parse(st.m[C.KEY])), "the flag is never persisted");
  const back = C.load(st); assert.strictEqual(back.games.length, 1); assert.deepStrictEqual(back.marks, s.marks); assert.strictEqual(back.device, s.device);
  // corrupt
  const bad = mem({[C.KEY]: "{not json"}); const cb = C.load(bad);
  assert.strictEqual(cb.flag, "corrupt"); assert.deepStrictEqual(cb.games, []);
  assert.strictEqual(C.load(mem({[C.KEY]: JSON.stringify({v: 1, games: "x"})})).games.length, 0);
  assert.strictEqual(C.load(mem({[C.KEY]: "[1,2]"})).flag, "corrupt");
  // half-written: one bad game dropped alone
  const half = mem({[C.KEY]: JSON.stringify(Object.assign({}, s, {games: [s.games[0], {id: "x", kind: "ai", result: "zz"}, {junk: 1}]}))});
  assert.strictEqual(C.load(half).games.length, 1);
  // unavailable
  const boom = {getItem(){ throw new Error("no"); }, setItem(){ throw new Error("no"); }};
  assert.strictEqual(C.load(boom).flag, "unavailable"); assert.strictEqual(C.save(s, boom), false);
  assert.strictEqual(C.load(() => { throw new Error("blocked"); }).flag, "unavailable"); assert.strictEqual(C.save(s, null), false);
  assert.strictEqual(C.load(null).flag, "unavailable");
  assert.strictEqual(C.save(s, {getItem: () => null, setItem(){ throw new Error("quota"); }}), false);
  // a newer build owns it
  const newer = mem({[C.KEY]: JSON.stringify({v: 2, games: [1]})}); const nl = C.load(newer);
  assert.strictEqual(nl.flag, "newer"); assert.deepStrictEqual(nl.games, []);
  assert.strictEqual(C.save(rec(nl, {}).store, newer), false); assert.strictEqual(JSON.parse(newer.m[C.KEY]).v, 2);
  assert.strictEqual(C.save(rec(C.empty("d"), {}).store, newer), false, "even a clean store refuses to overwrite a newer one");
});

test("legacyRead: reads the classic page's keys, never writes", () => {
  const rec3 = {v: 3, foes: {kayo: {sharp: {w: 2, l: 1, d: 0}, steady: {w: 1, l: 0, d: 1}}}, mine: {iyslander: {w: 3, l: 1, d: 1}}, pvp: {mine: {}, foes: {fai: {w: 4, l: 0, d: 0}}, seen: []}};
  const st = mem({"dawnblade.aiRecord": JSON.stringify(rec3), "dawnblade.best": JSON.stringify({kayo: 12, dash: 9})});
  const before = JSON.stringify(st.m);
  const l = C.legacyRead(st);
  assert.deepStrictEqual(l.ai, {w: 3, l: 1, d: 1}); assert.deepStrictEqual(l.people, {w: 4, l: 0, d: 0}); assert.deepStrictEqual(l.best, {kayo: 12, dash: 9});
  assert.strictEqual(JSON.stringify(st.m), before, "nothing written");
  assert.deepStrictEqual(C.tallies(C.empty("d"), l).ai, {w: 3, l: 1, d: 1});
  assert.deepStrictEqual(C.legacyRead(mem({"dawnblade.aiRecord": "garbage"})).ai, {w: 0, l: 0, d: 0});
  assert.deepStrictEqual(C.legacyRead(null).best, {});
});
