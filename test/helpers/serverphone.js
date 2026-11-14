/* test/helpers/serverphone.js — A PHONE AT A SERVER TABLE, HEADLESS (SERVER S2).

   test/helpers/judgetable.js's phone, with the judge's `connect` replaced by a
   servertable channel over the fake wire: the lobby the way index.html's
   TableRoom runs it (hello, hero, a SEALED throw, the seating, a sideboard, the
   answer to the seed commitment), then a BLIND match for the card catalog and
   net.js's guest session. Everything a phone is told is kept in `inbox` for the
   scans. `reload()` is a page reload: a NEW phone object over the same `keep`
   (the page's store seam), claiming the seat back. */
const ST = require("../../engine/servertable.js");
const T = require("./judgetable.js");
const {J, SP, N, L, Hub, Wr, R} = T;
const json = T.json;

function memKeep(){
  const m = new Map();
  return {m, get: (k, f) => m.has(k) ? JSON.parse(m.get(k)) : f, set: (k, v) => { m.set(k, JSON.stringify(v)); }};
}

const FAST = {sleep: () => new Promise(r => setImmediate(r)), tune: {base: 1, max: 4, probeMs: 1}};

/* o: {hero, rand, throws, chooser, keep, tune?, onStatus?} */
function makePhone(world, name, o){
  const keep = o.keep || memKeep();
  const P = {name, hero: o.hero, keep, seat: null, lob: null, sess: null, ch: null, inbox: [], refused: [], statuses: [], events: [], spec: null,
             open: null, sentSeed: false, catalog: null, errors: []};
  const rand = o.rand;
  const opts = () => ({transport: world.transport(name), keep, sleep: FAST.sleep, tune: {...FAST.tune, ...(o.tune || {})}, rand: () => 0.5,
                       onStatus: s => P.statuses.push(s), have: () => P.sess ? P.sess.seq() : undefined, now: () => Date.now()});
  /* how: "create" | "join" | "reclaim"; code for the last two */
  P.connect = async (how, code) => {
    const M = o.ST || ST, f = how === "create" ? M.startTable : how === "reclaim" ? M.reclaim : M.sitAt;
    P.reclaimed = how === "reclaim";   /* a reloaded seat already answered every lobby step: the table replays them, and answering anew BEFORE the replay reaches the seat's own answer would put a different seed half into this phone's local lobby (the page's seat does not: its lobby takes the whole replay in one batch before its effect runs) */
    P.ch = await f({...opts(), code});
    P.code = P.ch.code;
    P.ch.listen(fr => P.receive(json(fr)));
    return P;
  };
  P.say = fr => { if(P.ch) P.ch.send(fr); };
  P.lobby = m => { const r = L.reduce(P.lob, m); if(r.error && !r.error.dup) P.refused.push(r.error.why); if(!r.error) P.lob = r.state; P.say({ch: Hub.CH.LOBBY, m}); P.step(); };
  P.receive = f => {
    P.inbox.push(f);
    if(f.ch === Hub.CH.JUDGE){
      if(f.seat != null && P.seat == null){ P.seat = f.seat; P.lob = L.newLobby({code: f.code, judge: true}); P.lobby(L.hello(P.seat, o.build || T.BUILD)); }
      return;
    }
    if(f.ch === Hub.CH.LOBBY){ if(!P.lob) return; const r = L.reduce(P.lob, f.m); if(!r.error) P.lob = r.state; P.step(); return; }
    if(f.ch === Hub.CH.NET && P.sess) P.sess.receive(f.m);
  };
  P.step = () => {
    const s = P.lob, st = L.stepOf(s), me = P.seat;
    if(P.reclaimed && st !== "ready") return;
    if(st === "hero" && s.heroes[me] == null) return P.lobby(L.hero(me, P.hero));
    if(st === "throw"){
      if(s.seals[me] == null){ const th = (o.throws || [["paper", "rock"]])[Math.min(s.round, (o.throws || [1]).length - 1)][me];
        const k = L.throwSeal(me, s.round, th, rand); P.open = k.open; return P.lobby(k.seal); }
      if(P.open && P.open.round === s.round && L.canOpen(s, me)){ const k = P.open; P.open = null; return P.lobby(k); }
    }
    if(st === "seat" && s.winner === me && s.first == null) return P.lobby(L.seating(me, o.chooser || "first"));
    if(st === "board" && s.boards[me] == null) return P.lobby(L.sideboard(me, [], {}));
    if(s.seedC && s.seedGs && s.seedGs[me] == null && !P.sentSeed){ P.sentSeed = true; return P.lobby(L.seedAnswer(rand, me)); }
    if(st === "ready" && !P.sess) P.start();
  };
  P.start = () => {
    P.spec = L.matchSpec(P.lob);
    const blind = T.deal(P.spec.heroes[0], P.spec.heroes[1], "blind|" + P.spec.seedC, P.spec.first);
    P.catalog = o.matchCatalog ? o.matchCatalog(P.spec) : T.catalogOf(blind);   /* a drive against the real page deals the page's way (tools/serverpage.js) */
    P.sess = N.createSession({seat: P.seat, host: false, referee: true, reduce: J.reduce, legal: J.legal, catalog: P.catalog, build: o.build || T.BUILD,
      send: m => P.say({ch: Hub.CH.NET, m}), onEvent: e => P.events.push(e)});
    P.sess.join();
  };
  return P;
}

/* the in-process referee's game from the deal a table's row recorded: the same policy, no network */
function reference(row, cap, dealFn){
  const spec = row.hub.spec, SHA = require("../../engine/sha256.js"), INV = T.INV;
  const d = (dealFn || T.dealSpec)({...spec, seed: SHA.seedOf(row.hub.seedH, spec.seedG)});
  const ref = R.createReferee({state: d.state, reduce: J.reduce, legal: J.legal, check: INV.errors, catalog: d.catalog});
  let n = 0;
  while(!ref.over() && n++ < (cap || 3000)){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(ref.view(s), s, {search: false});
      if(!a) continue;
      const r = ref.intent(s, a);
      if(r.error) throw new Error("the reference refused " + s + ": " + r.error);
      moved = true; break;
    }
    if(!moved) break;
  }
  return ref;
}

/* the stored game, rehydrated by a hub that is never fed a frame */
function storedGame(world, code){
  const hub = Hub.createHub({code, build: T.BUILD, deal: world.deps.deal, reduce: J.reduce, legal: J.legal, check: T.INV.errors, resume: world.row(code).hub});
  return hub.session().full();
}

/* one action by whichever seat's phone the policy moves, from THAT PHONE'S VIEW; false when nobody can move */
async function step(world, phones){
  const ps = []; for(const p of phones) if(p.seat != null) ps[p.seat] = p;
  for(const s of [0, 1]){
    const p = ps[s];
    if(!p || !p.sess || p.sess.status() !== "ready") continue;
    const a = SP.act(p.sess.state(), s, {search: false});
    if(!a) continue;
    const why = p.sess.submit(a);
    if(why) throw new Error("seat " + s + " refused on its own view: " + why);
    await world.settle(phones.map(x => x.ch));
    return {seat: s, a};
  }
  return null;
}

/* seat two phones and negotiate until both have a running session. Returns [A, B]. */
async function seatTwo(world, heroes, salt, o){
  o = o || {};
  const rand = T.seeded(heroes.join("|") + "|" + salt);
  const mk = (n, h, extra) => makePhone(world, n, {hero: h, rand, ST: o.ST, throws: [["rock", "rock"], ["paper", "rock"]], ...(o.phone || {}), ...(extra || {})});
  const A = mk("A", heroes[0]), B = mk("B", heroes[1]);
  await A.connect("create");
  await B.connect("join", A.code);
  await world.settle([A.ch, B.ch]);
  return {A, B, rand};
}

module.exports = {makePhone, memKeep, reference, storedGame, step, seatTwo, FAST};
