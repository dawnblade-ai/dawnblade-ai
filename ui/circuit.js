/* ============================================================
   ui/circuit.js — DawnUICircuit (alias DawnCircuit): the Circuit's local store and rules
   (docs/crescendo/SCREENS-CIRCUIT.md "The local store" and P1-P10). PURE except load/save/legacyRead (storage in try/catch).
   Every function takes the store and returns a new one; nothing mutates its input. No DOM, no Math.random in the rules
   (the daily deal is the engine's own seeded RNG, engine/rng.js). A number comes from a finished game or the server, never invented.

   API (names are the contract with the screens):
     KEY                       "dawnblade.circuit"; CACHE_KEY "dawnblade.circuit.cache"; FOLD 2000; RANKS the six names (index = rank)
     empty(device?)            a fresh v:1 store (device id random unless given)
     load(storage?)            -> store; store.flag = null | "corrupt" | "newer" | "unavailable" (unavailable: run from memory, tell the
                               player); a missing key is a clean empty store; never throws. storage = Storage | () => Storage
     save(store, storage?)     -> true | false (false: nothing written: no storage, quota, or a newer build owns the key); never throws
     record(store, game, heroes?) -> {store, events} | null  (null: no result, unknown shape, or the id is already recorded: nothing changed);
                               heroes defaults to window.HEROES. Events, in P9 order: {t:"summit",at} {t:"tier",ch} {t:"rank",hero,from,to}
                               {t:"daily",r,turns} {t:"rung",foe} {t:"best",which:"fastWin"|"closeWin",value,was} {t:"pair",hero,beaten}
     dailyDeal(day, heroes)    -> {day, me, foe, seed, first} (hero keys; heroes = objects with .k or plain keys); never a mirror
     dayOf(date?)              UTC "YYYY-MM-DD" of a Date or ms (default now); prevDay(day)
     tallies(store, legacy?, server?) -> {ai, people, ranked|null, dummy, total}, each {w,l,d}; server = ladder().you or {you}
     mastery(store, hero, heroes) -> {hero, rank, name, games, wins, beat, n, need:{proven,master,dawnblade}, next:{rank,name,need}|null}
     road(store, heroes)       -> {rungs:[{k,ch,cleared}], tiers:[{ch,rungs,done,total,cleared}], next, summit, done, total}
     streak(store, today)      -> {cur, best, today}   (today = "YYYY-MM-DD")
     bests(store, extra?)      -> {fastWin, closeWin, run, peak, streak, dummy}; extra = {rating, best} (a live server rating, the legacy map)
     legacyRead(storage?)      -> {ai, people, best, mine}: the classic page's dawnblade.aiRecord / dawnblade.best, READ ONLY, never written
     cleanGame(g), cleanStore(raw) the clean-on-load discipline (unknown fields dropped, bad games dropped alone)
   Decisions where the doc is silent (also in test/ui-circuit.test.js): record() takes an optional `heroes`; `best` events are the
   fastWin / closeWin kind only, one per game, fastWin first (run and peak are stored and shown on C1, silent on C5); rank events are for
   BLOODED and above and carry the true from (0 -> 2 is legal); a daily game's `official` is decided HERE (first finished game of its day),
   whatever the caller passed; folded games still count in tallies and mastery games/wins.
   ============================================================ */
(function(root, factory){
  var api = factory(root);
  if(typeof module === "object" && module.exports) module.exports = api;
  root.DawnUICircuit = api;
  root.DawnCircuit = api;
})(typeof self !== "undefined" ? self : this, function(root){

var KEY = "dawnblade.circuit", CACHE_KEY = "dawnblade.circuit.cache", FOLD = 2000, V = 1;
var RANKS = ["UNTRIED", "SPARRED", "BLOODED", "PROVEN", "MASTER", "DAWNBLADE"];
var KINDS = ["ai", "dummy", "daily", "road", "friend", "ranked"], AIK = ["ai", "road", "daily"];
var HOWS = ["life", "concession", "stalemate", "forfeit"];

function isObj(x){ return !!x && typeof x === "object" && !Array.isArray(x); }
function cnt(n){ return Number.isInteger(n) && n >= 0 ? n : 0; }
function keyOf(h){ return typeof h === "string" ? h : h && h.k; }
function copy(x){ return JSON.parse(JSON.stringify(x)); }

function empty(device){
  return {v: V, device: device || "d_" + Math.random().toString(36).slice(2, 10), created: Date.now(), games: [],
    marks: {beat: {}, road: {}, days: {}, best: {fastWin: null, closeWin: null, run: 0, peak: null}, streak: {best: 0}, summit: null},
    folded: {}, sync: {at: null}, flag: null};
}

/* ---------- days ---------- */
function dayOf(date){
  var t = date == null ? Date.now() : (date instanceof Date ? date.getTime() : +date);
  return new Date(t).toISOString().slice(0, 10);
}
function prevDay(day){
  var p = day.split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - 1)).toISOString().slice(0, 10);
}

/* ---------- cleaning ---------- */
function cleanGame(g){
  if(!isObj(g)) return null;
  var id = typeof g.id === "string" && g.id && g.id.length <= 120 ? g.id : null;
  if(!id || KINDS.indexOf(g.kind) < 0 || ["w", "l", "d"].indexOf(g.result) < 0) return null;
  if(typeof g.me !== "string" || !g.me || typeof g.foe !== "string" || !g.foe) return null;
  var how = HOWS.indexOf(g.how) >= 0 ? g.how : (g.how == null ? (g.result === "d" ? "stalemate" : "life") : null);
  if(!how) return null;
  var at = typeof g.at === "number" && isFinite(g.at) ? g.at : Date.now();
  var life = Array.isArray(g.life) ? [cnt(g.life[0]), cnt(g.life[1])] : [0, 0];
  var out = {id: id, at: at, kind: g.kind, me: g.me, foe: g.foe,
    level: g.level === "sharp" || g.level === "steady" ? g.level : null, result: g.result, how: how,
    turns: cnt(g.turns), life: life, first: g.first === 1 ? 1 : 0, seed: typeof g.seed === "string" ? g.seed : null,
    day: null, rating: null, dv: typeof g.dv === "string" ? g.dv : ""};
  if(g.kind === "daily"){ out.day = typeof g.day === "string" && /^\d{4}-\d\d-\d\d$/.test(g.day) ? g.day : dayOf(at); out.official = g.official === true; }
  if(g.kind === "ranked" && isObj(g.rating) && isFinite(g.rating.from) && isFinite(g.rating.to)) out.rating = {from: +g.rating.from, to: +g.rating.to};
  return out;
}

function cleanStore(raw){
  if(!isObj(raw) || raw.v !== V) return null;
  var s = empty(typeof raw.device === "string" ? raw.device : undefined);
  s.created = typeof raw.created === "number" ? raw.created : s.created;
  var seen = {};
  (Array.isArray(raw.games) ? raw.games : []).forEach(function(g){
    var c = cleanGame(g); if(c && !seen[c.id]){ seen[c.id] = 1; s.games.push(c); }
  });
  var m = isObj(raw.marks) ? raw.marks : {};
  if(isObj(m.beat)) Object.keys(m.beat).forEach(function(h){ if(Array.isArray(m.beat[h])) s.marks.beat[h] = m.beat[h].filter(function(x, i, a){ return typeof x === "string" && a.indexOf(x) === i; }); });
  if(isObj(m.road)) Object.keys(m.road).forEach(function(k){ if(isObj(m.road[k])) s.marks.road[k] = m.road[k]; });
  if(isObj(m.days)) Object.keys(m.days).forEach(function(d){ if(/^\d{4}-\d\d-\d\d$/.test(d) && isObj(m.days[d]) && ["w", "l", "d"].indexOf(m.days[d].r) >= 0) s.marks.days[d] = m.days[d]; });
  if(isObj(m.best)){
    ["fastWin", "closeWin"].forEach(function(k){ if(isObj(m.best[k])) s.marks.best[k] = m.best[k]; });
    s.marks.best.run = cnt(m.best.run);
    if(isObj(m.best.peak) && isFinite(m.best.peak.rating)) s.marks.best.peak = m.best.peak;
  }
  if(isObj(m.streak)) s.marks.streak.best = cnt(m.streak.best);
  if(isObj(m.summit)) s.marks.summit = m.summit;
  if(isObj(raw.folded)) Object.keys(raw.folded).forEach(function(k){
    if(KINDS.indexOf(k) < 0 || !isObj(raw.folded[k])) return;
    Object.keys(raw.folded[k]).forEach(function(h){
      var c = raw.folded[k][h]; if(!isObj(c)) return;
      (s.folded[k] = s.folded[k] || {})[h] = {w: cnt(c.w), l: cnt(c.l), d: cnt(c.d)};
    });
  });
  if(isObj(raw.sync)) s.sync.at = typeof raw.sync.at === "number" ? raw.sync.at : null;
  return s;
}

/* ---------- storage ---------- */
function pickStorage(storage){
  try {
    var s = storage === undefined ? root.localStorage : storage;
    if(typeof s === "function") s = s();
    return s && typeof s.getItem === "function" ? s : null;
  } catch(e){ return null; }
}
function load(storage){
  var ls = pickStorage(storage), raw;
  if(!ls){ var u = empty(); u.flag = "unavailable"; return u; }
  try { raw = ls.getItem(KEY); } catch(e){ var f = empty(); f.flag = "unavailable"; return f; }
  if(raw == null) return empty();
  var parsed;
  try { parsed = JSON.parse(raw); } catch(e){ var c = empty(); c.flag = "corrupt"; return c; }
  if(isObj(parsed) && typeof parsed.v === "number" && parsed.v > V){ var n = empty(); n.flag = "newer"; return n; }
  var s = cleanStore(parsed);
  if(!s){ var b = empty(); b.flag = "corrupt"; return b; }
  return s;
}
function save(store, storage){
  try {
    var ls = pickStorage(storage);
    if(!ls || !store || store.flag === "newer") return false;
    var held = ls.getItem(KEY);
    if(held != null){ try { var p = JSON.parse(held); if(isObj(p) && typeof p.v === "number" && p.v > V) return false; } catch(e){} }
    var out = Object.assign({}, store); delete out.flag;
    ls.setItem(KEY, JSON.stringify(out));
    return true;
  } catch(e){ return false; }
}
function legacyRead(storage){
  var out = {ai: {w: 0, l: 0, d: 0}, people: {w: 0, l: 0, d: 0}, best: {}, mine: {}}, ls = pickStorage(storage);
  if(!ls) return out;
  function read(k){ try { var r = ls.getItem(k); return r == null ? null : JSON.parse(r); } catch(e){ return null; } }
  function add(t, c){ if(isObj(c)){ t.w += cnt(c.w); t.l += cnt(c.l); t.d += cnt(c.d); } }
  var r = read("dawnblade.aiRecord");
  if(isObj(r) && [1, 2, 3].indexOf(r.v) >= 0){
    if(isObj(r.foes)) Object.keys(r.foes).forEach(function(k){ var f = r.foes[k]; if(isObj(f)){ add(out.ai, f.sharp); add(out.ai, f.steady); } });
    if(isObj(r.mine)) Object.keys(r.mine).forEach(function(k){ var t = {w: 0, l: 0, d: 0}; add(t, r.mine[k]); out.mine[k] = t; });
    if(r.v === 3 && isObj(r.pvp) && isObj(r.pvp.foes)) Object.keys(r.pvp.foes).forEach(function(k){ add(out.people, r.pvp.foes[k]); });
  }
  var b = read("dawnblade.best");
  if(isObj(b)) Object.keys(b).forEach(function(k){ if(isFinite(b[k]) && b[k] >= 0) out.best[k] = +b[k]; });
  return out;
}

/* ---------- the daily deal (P6) ---------- */
function dailyDeal(day, heroes){
  var R = root.DawnRNG || (typeof require === "function" ? require("../engine/rng.js") : null);
  var keys = (heroes || []).map(keyOf).filter(Boolean), N = keys.length;
  if(N < 2 || !R) return null;
  var base = "dawnblade-daily|" + day;
  var a = R.int(R.make(R.seedFrom(base + "|pair")), N);
  var b = R.int(a.rng, N - 1);
  var seed = base + "|match";
  return {day: day, me: keys[a.v], foe: keys[b.v >= a.v ? b.v + 1 : b.v], seed: seed,
    first: R.int(R.make(R.seedFrom(seed + ":rps")), 2).v};
}

/* ---------- counts ---------- */
function zero(){ return {w: 0, l: 0, d: 0}; }
function bump(t, r){ t[r] += 1; }
function foldedSum(store, kinds, hero){
  var t = zero();
  kinds.forEach(function(k){
    var f = store.folded[k]; if(!f) return;
    Object.keys(f).forEach(function(h){ if(hero == null || hero === h){ t.w += f[h].w; t.l += f[h].l; t.d += f[h].d; } });
  });
  return t;
}
function tallies(store, legacy, server){
  var ai = zero(), people = zero(), dummy = zero();
  store.games.forEach(function(g){
    if(AIK.indexOf(g.kind) >= 0) bump(ai, g.result); else if(g.kind === "friend") bump(people, g.result); else if(g.kind === "dummy") bump(dummy, g.result);
  });
  function plus(t, o){ t.w += o.w; t.l += o.l; t.d += o.d; }
  plus(ai, foldedSum(store, AIK)); plus(people, foldedSum(store, ["friend"])); plus(dummy, foldedSum(store, ["dummy"]));
  if(legacy){ if(legacy.ai) plus(ai, legacy.ai); if(legacy.people) plus(people, legacy.people); }
  var you = server && (server.you || (server.wins != null || server.losses != null ? server : null)), ranked = null;
  if(you) ranked = {w: cnt(you.wins), l: cnt(you.losses), d: cnt(you.draws)};
  var total = zero(); [ai, people, ranked || zero(), dummy].forEach(function(t){ plus(total, t); });
  return {ai: ai, people: people, ranked: ranked, dummy: dummy, total: total};
}

/* ---------- mastery (P4) ---------- */
function rankFrom(games, wins, b, N){
  if(N > 0 && b >= N) return 5;
  if(b >= Math.ceil(2 * N / 3) && N > 0) return 4;
  if(b >= Math.ceil(N / 3) && N > 0) return 3;
  if(wins >= 1) return 2;
  return games >= 1 ? 1 : 0;
}
function heroCounts(store, hero){
  var games = 0, wins = 0;
  store.games.forEach(function(g){
    if(g.me !== hero) return;
    games++; if(g.result === "w" && g.kind !== "dummy") wins++;
  });
  Object.keys(store.folded).forEach(function(k){
    var c = store.folded[k][hero]; if(!c) return;
    games += c.w + c.l + c.d; if(k !== "dummy") wins += c.w;
  });
  return {games: games, wins: wins, beat: (store.marks.beat[hero] || []).length};
}
function mastery(store, hero, heroes){
  var N = (heroes || []).length, c = heroCounts(store, hero), rank = rankFrom(c.games, c.wins, c.beat, N);
  var need = {proven: Math.ceil(N / 3), master: Math.ceil(2 * N / 3), dawnblade: N};
  var nx = null;
  if(rank < 5){
    var goal = rank < 2 ? 1 : need[["", "", "", "proven", "master", "dawnblade"][rank + 1]];
    nx = {rank: rank + 1, name: RANKS[rank + 1], need: goal};
  }
  return {hero: hero, rank: rank, name: RANKS[rank], games: c.games, wins: c.wins, beat: c.beat, n: N, need: need, next: nx};
}

/* ---------- the road (P5) ---------- */
function road(store, heroes){
  var rungs = (heroes || []).map(function(h){ return {k: keyOf(h), ch: h.ch == null ? null : h.ch, cleared: store.marks.road[keyOf(h)] || null}; });
  var tiers = [];
  rungs.forEach(function(r){
    var t = tiers.filter(function(x){ return x.ch === r.ch; })[0];
    if(!t){ t = {ch: r.ch, rungs: [], done: 0, total: 0, cleared: false}; tiers.push(t); }
    t.rungs.push(r.k); t.total++; if(r.cleared) t.done++;
  });
  tiers.forEach(function(t){ t.cleared = t.total > 0 && t.done === t.total; });
  tiers.sort(function(a, b){ return (a.ch == null ? 99 : a.ch) - (b.ch == null ? 99 : b.ch); });
  var next = rungs.filter(function(r){ return !r.cleared; })[0];
  return {rungs: rungs, tiers: tiers, next: next ? next.k : null, summit: store.marks.summit || null,
    done: rungs.filter(function(r){ return r.cleared; }).length, total: rungs.length};
}

/* ---------- streak and bests (P8) ---------- */
function curStreak(days, today){
  var d = days[today] ? today : prevDay(today), n = 0;
  while(days[d]){ n++; d = prevDay(d); }
  return n;
}
function streak(store, today){
  var cur = curStreak(store.marks.days, today);
  return {cur: cur, best: Math.max(store.marks.streak.best, cur), today: !!store.marks.days[today]};
}
function qualifies(g){ return g.kind === "daily" ? g.official === true : g.kind !== "dummy"; }
function runOf(games){
  var best = 0, cur = 0;
  games.filter(qualifies).sort(function(a, b){ return a.at - b.at; }).forEach(function(g){ cur = g.result === "w" ? cur + 1 : 0; if(cur > best) best = cur; });
  return best;
}
function bests(store, extra){
  var b = store.marks.best, peak = b.peak ? b.peak.rating : null;
  if(extra && isFinite(extra.rating) && (peak == null || extra.rating > peak)) peak = +extra.rating;
  var dummy = null;
  if(extra && isObj(extra.best)) Object.keys(extra.best).forEach(function(k){ if(dummy == null || extra.best[k] < dummy) dummy = extra.best[k]; });
  return {fastWin: b.fastWin, closeWin: b.closeWin, run: b.run, peak: peak, streak: store.marks.streak.best, dummy: dummy};
}

/* ---------- record (P1-P9) ---------- */
function record(store, game, heroes){
  var g = cleanGame(game);
  if(!g || store.games.some(function(x){ return x.id === g.id; })) return null;
  heroes = heroes || root.HEROES || [];
  var N = heroes.length, events = [];
  var s = copy(store); s.flag = store.flag || null;
  var m = s.marks;
  var before = heroCounts(s, g.me), rankBefore = rankFrom(before.games, before.wins, before.beat, N);
  var sharpWin = AIK.indexOf(g.kind) >= 0 && g.level === "sharp" && g.result === "w";
  var official = false;
  if(g.kind === "daily"){ official = !m.days[g.day]; g.official = official; }
  var roadBefore = road(s, heroes);

  s.games.push(g);
  while(s.games.length > FOLD){
    var o = s.games.shift(), f = (s.folded[o.kind] = s.folded[o.kind] || {});
    (f[o.me] = f[o.me] || zero())[o.result] += 1;
  }

  var newTierCh = null, newRung = false, summit = false, pairAdded = false;
  if(sharpWin){
    var bl = m.beat[g.me] = m.beat[g.me] || [];
    if(bl.indexOf(g.foe) < 0){ bl.push(g.foe); pairAdded = true; }
    if(!m.road[g.foe]){
      m.road[g.foe] = {at: g.at, me: g.me, turns: g.turns, id: g.id}; newRung = true;
      var r1 = road(s, heroes);
      r1.tiers.forEach(function(t, i){ if(t.cleared && !roadBefore.tiers[i].cleared) newTierCh = t.ch; });
      if(N > 0 && r1.next === null && !m.summit){ m.summit = {at: g.at}; summit = true; }
    }
  }
  var today = g.kind === "daily" ? g.day : dayOf(g.at);
  if(official) m.days[g.day] = {r: g.result, turns: g.turns, life: g.life[0], me: g.me, foe: g.foe, id: g.id};
  m.streak.best = Math.max(m.streak.best, curStreak(m.days, today));

  var bestEvent = null;
  if(qualifies(g)){
    var bb = m.best;
    if(g.result === "w" && g.how === "life"){
      if(!bb.fastWin || g.turns < bb.fastWin.turns){
        bestEvent = {t: "best", which: "fastWin", value: g.turns, was: bb.fastWin ? bb.fastWin.turns : null};
        bb.fastWin = {turns: g.turns, me: g.me, foe: g.foe, at: g.at};
      }
      if(g.life[0] >= 1 && (!bb.closeWin || g.life[0] < bb.closeWin.life)){
        if(!bestEvent) bestEvent = {t: "best", which: "closeWin", value: g.life[0], was: bb.closeWin ? bb.closeWin.life : null};
        bb.closeWin = {life: g.life[0], me: g.me, foe: g.foe, at: g.at};
      }
    }
    bb.run = Math.max(bb.run, runOf(s.games));
    if(g.kind === "ranked" && g.rating && (!bb.peak || g.rating.to > bb.peak.rating)) bb.peak = {rating: g.rating.to, at: g.at};
  }

  var after = heroCounts(s, g.me), rankAfter = rankFrom(after.games, after.wins, after.beat, N);
  if(summit) events.push({t: "summit", at: g.at});
  if(newTierCh !== null) events.push({t: "tier", ch: newTierCh});
  if(rankAfter > rankBefore && rankAfter >= 2) events.push({t: "rank", hero: g.me, from: rankBefore, to: rankAfter});
  if(official) events.push({t: "daily", r: g.result, turns: g.turns});
  if(newRung) events.push({t: "rung", foe: g.foe});
  if(bestEvent) events.push(bestEvent);
  if(pairAdded) events.push({t: "pair", hero: g.me, beaten: m.beat[g.me].length});
  return {store: s, events: events};
}

return {KEY: KEY, CACHE_KEY: CACHE_KEY, FOLD: FOLD, RANKS: RANKS, empty: empty, load: load, save: save, record: record,
  dailyDeal: dailyDeal, dayOf: dayOf, prevDay: prevDay, tallies: tallies, mastery: mastery, road: road, streak: streak,
  bests: bests, legacyRead: legacyRead, cleanGame: cleanGame, cleanStore: cleanStore};
});
