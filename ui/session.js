/* ============================================================
   ui/session.js — DawnUISession: the ONE adapter between the engine and the CRESCENDO shell
   (docs/crescendo/FRAMEWORK.md 4.2). Whatever sits behind it (today a local game against the AI hero; later
   the trainer, a server table, a two-phone table) the screens see the same surface:

       { seat, names, heroKeys, state(), view(), legal(action) -> null|reason, submit(action) -> null|reason,
         subscribe(fn) -> unsubscribe   (fn(state) after every board push),
         onStep(fn) -> unsubscribe      (fn({seat, action, prev, next}) for every accepted action, either seat's),
         heroArt(seat) -> card-art url, start(), dispose(), local }

   NO NEW RULES, NO COPIES: the deal is the page's own (index.html's local table; test/helpers/pagedeal.js) —
   DawnCards.setCDN -> buildMaps(pool) -> DawnGame.parseDeck -> DawnBuild.buildMatch -> DawnJudge.newMatch, and the
   AI seat is DawnLocal.createLocal with DawnSparring.act(search:true). Namespaced engine access only.

   URL (reproducible drives):  ?hero=<k>&foe=<k>&seed=<s>&first=0|1&pace=<ms>  (pace=0: the AI seat runs unpaced).
   With no hero/foe in the URL the last choice (localStorage, try/catch) is used, else the first two heroes.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUISession = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const LAST_KEY = "dawnblade.crescendo.last";
/* THE AI SEAT AT A HUMAN PACE (MOTION.md 4.2): one action a tick; a pass is quick, anything announced waits out its beat
   (the slab and the glimpse, ~1.7 s) plus the next think. A function of the action's kind only, never of a clock or a search. */
const aiPace = (prev, a) => !a ? 500 : a.t === "pass" ? 110 : a.t === "defend" ? 900 : 2000;

function parseQuery(search){
  const q = {};
  try { new URLSearchParams(search || "").forEach((v, k) => { q[k] = v; }); } catch(e){}
  return q;
}

/* storage is a convenience and may throw (private window, blocked site data) */
function readLast(){
  try { const o = JSON.parse(root.localStorage.getItem(LAST_KEY) || "null"); return o && typeof o === "object" ? o : null; }
  catch(e){ return null; }
}
function writeLast(o){
  try { root.localStorage.setItem(LAST_KEY, JSON.stringify(o)); return true; } catch(e){ return false; }
}

/* which match: URL beats the last choice beats the first two heroes; an unknown key falls back to the default */
function choose(q, heroes, last){
  const has = k => heroes.some(h => h.k === k);
  const dflt = [heroes[0].k, (heroes[1] || heroes[0]).k];
  const pick = (want, fallback) => has(want) ? want : fallback;
  const hero = pick(q.hero, pick(last && last.hero, dflt[0]));
  const foe  = pick(q.foe,  pick(last && last.foe,  dflt[1]));
  const seed = q.seed != null && q.seed !== "" ? String(q.seed) : String(Math.floor(Math.random() * 1e9));
  const first = q.first === "1" ? 1 : 0;
  const pace = q.pace != null && q.pace !== "" && !isNaN(+q.pace) ? Math.max(0, +q.pace) : -1;   /* -1: the human pace; 0: unpaced; N: N ms a tick */
  return {hero, foe, seed, first, pace};
}

/* the card pool as the page's own loader builds it (mapDbCard -> buildMaps), registered with the judge */
function openDb(env){
  const pool = env.DAWN_POOL;
  if(!Array.isArray(pool)) throw new Error("the card pool did not load");
  const db = env.DawnCards.buildMaps(pool.filter(c => c && c.name).map(env.DawnCards.mapDbCard));
  env.DawnJudge.setDb(db);
  return db;
}

/* both seats from the spec, the way index.html deals a local table: the AI seat wears the self-play default loadout,
   and so does the player until the loadout screen exists */
function deal(pick, env){
  env = env || root;
  env.DawnCards.setCDN(env.CDN);
  const db = openDb(env);
  const heroes = Object.fromEntries(env.HEROES.map(h => [h.k, h]));
  const decks = Object.fromEntries(env.HEROES.filter(h => env.DECKS[h.k]).map(h => [h.k, env.DawnGame.parseDeck(env.DECKS[h.k])]));
  const m = env.DawnBuild.buildMatch({
    heroes: [pick.hero, pick.foe],
    boards: [env.DawnBuild.defaultBoard(heroes[pick.hero], decks[pick.hero], db),
             env.DawnBuild.defaultBoard(heroes[pick.foe],  decks[pick.foe],  db)],
    first: pick.first, seed: pick.seed
  }, {db, heroes, decks});
  const state = env.DawnJudge.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys, first: m.first, seed: m.seed});
  const art = [pick.hero, pick.foe].map(k => {
    const h = heroes[k], r = env.DawnCards.resolveEntry(db, decks[k].hero, (h.code || "").slice(0, 3) || null);
    return r && r.img ? r.img : null;
  });
  return {state, names: m.names, heroKeys: m.heroKeys, art};
}

/* a LOCAL game: seat 0 is the person, seat 1 the AI hero (Sharp) */
function openLocal(opts, env){
  env = env || root;
  const pick = choose(opts && opts.query ? opts.query : parseQuery(env.location && env.location.search), env.HEROES, readLast());
  const dealt = deal(pick, env);
  writeLast({hero: pick.hero, foe: pick.foe});
  const subs = new Set(), steps = new Set(), evs = new Set(), events = [];
  const local = env.DawnLocal.createLocal({
    seat: 0,
    state: dealt.state,
    reduce: env.DawnJudge.reduce,
    legal: env.DawnJudge.legal,
    policy: (st, i) => env.DawnSparring.act(st, i, {search: true}),
    ...(pick.pace < 0 ? {pace: aiPace} : pick.pace > 0 ? {pace: pick.pace} : {}),
    onStep: e => steps.forEach(fn => fn(e)),
    onEvent: e => { events.push(e); evs.forEach(fn => fn(e)); },
    onState: st => subs.forEach(fn => fn(st))
  });
  const seat = 0;
  return {
    seat, pick,
    names: dealt.names, heroKeys: dealt.heroKeys,
    state: () => local.state(),
    view: () => env.DawnView.view(local.state(), seat),
    legal: a => env.DawnJudge.legal(local.state(), a, seat),
    holder: () => env.DawnJudge.waitingOn(local.state()),
    submit: a => local.submit(a),
    subscribe: fn => { subs.add(fn); return () => subs.delete(fn); },
    onStep: fn => { steps.add(fn); return () => steps.delete(fn); },
    /* the coach: the AI policy's answer for this seat in this state (it can answer anything the judge asks) */
    suggest: () => env.DawnSparring.act(local.state(), seat, {search: true}),
    /* refusals, policy refusals and stalls the local session reported (a drill reads these) */
    events: () => events.slice(),
    onEvent: fn => { evs.add(fn); return () => evs.delete(fn); },
    heroArt: i => dealt.art[i],
    start: () => local.start(),
    dispose: () => local.dispose(),
    local
  };
}

return {openLocal, choose, parseQuery, deal, aiPace, LAST_KEY};
});
