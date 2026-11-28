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
   THE SEATING SEAM (F4, the coin) AND REMATCH (F7) — for the flow:
     DawnUISession.coinCall(seed, env, choice?) -> {winner: 0|1, first: 0|1|null, needsChoice}
         The local table's own rule (index.html Pregame): a COIN off the match seed (DawnRNG sub-stream seed+":rps") picks the winner
         (0 = the person); the WINNER CHOOSES who goes first (DawnRPS.rpsSeat); the AI as winner always goes first (stated, not a coin).
         needsChoice: the person won and gave no `choice` ("first"|"second"); show the choice, then call it again with it.
         openLocal({query, first: 0|1}) takes the result's `first` (default, unchanged: ?first=1 or seat 0).
     local / Dummy:  s.rematch({seed?, choice?, first?}) -> a NEW surface (same heroes, a fresh seed, first by the coin; `choice`
         defaults to "first" when the person wins it); it disposes s. The result carries .seating (the call). Not started: call start().
     server / room:  openNetworked option `manual: {throw: true, seat: true}` pauses the lobby at the person's own throw / seating
         call (default: automatic, as before). Then  s.awaiting() -> null|"throw"|"seat",  s.onAwait(fn) -> unsub,
         s.throwNow("rock"|"paper"|"scissors"), s.callSeating("first"|"second") (each returns null or a reason), and s.coin() ->
         {winner: seat|null, first: seat|null, throws} read from the lobby (winner/first are null until decided).
     server only:  s.rematch() -> {want, table, mine, theirs}|null, s.onRematch(fn), s.askRematch(cancel) (the referee decides; both
         must ask; rejects with .why), s.again() -> Promise of a NEW started surface sat at the rematch table (rejects without one).
         A two-phone ROOM has no rematch protocol: rematch() is null and again() rejects (open a new table).
   With no hero/foe in the URL the last choice (localStorage, try/catch) is used, else the first two heroes.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUISession = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const LAST_KEY = "dawnblade.crescendo.last";
/* the foe key that seats THE DUMMY (a null hero key in buildMatch, the vanilla pile index.html deals); never a hero's own key */
const DUMMY = "dummy";
/* THE AI SEAT AT A HUMAN PACE (MOTION.md 4.2): one action a tick; a pass is quick, anything announced waits out its beat
   (the slab and the glimpse, ~1.7 s) plus the next think. A function of the action's kind only, never of a clock or a search. */
const aiPace = (prev, a) => !a ? 500 : a.t === "pass" ? 110 : a.t === "defend" ? 900 : 2000;

/* the page's own storage seam (index.html `store`): the same "dawnblade." keys, so the ?server= door's remembered choice is shared */
function pageStore(env){
  return {
    get(k, f){ try { const v = env.localStorage.getItem("dawnblade." + k); return v == null ? f : JSON.parse(v); } catch(e){ return f; } },
    set(k, v){ try { env.localStorage.setItem("dawnblade." + k, JSON.stringify(v)); } catch(e){} }
  };
}

/* THE COIN, THEN THE WINNER'S CALL (index.html's Pregame, one rule): see the header */
function coinCall(seed, env, choice){
  env = env || root;
  const winner = env.DawnRNG.int(env.DawnRNG.make(env.DawnRNG.seedFrom(String(seed == null ? 0 : seed) + ":rps")), 2).v;
  if(winner === 1) return {winner, first: 1, needsChoice: false};
  const first = choice ? env.DawnRPS.rpsSeat(0, choice) : null;
  return {winner, first, needsChoice: first == null};
}

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
  const hasFoe = k => k === DUMMY || has(k);
  const dflt = [heroes[0].k, (heroes[1] || heroes[0]).k];
  const pick = (want, fallback) => has(want) ? want : fallback;
  const hero = pick(q.hero, pick(last && last.hero, dflt[0]));
  const foe  = hasFoe(q.foe) ? q.foe : hasFoe(last && last.foe) ? last.foe : dflt[1];
  const seed = q.seed != null && q.seed !== "" ? String(q.seed) : String(Math.floor(Math.random() * 1e9));
  const first = q.first === "1" ? 1 : 0;
  const pace = q.pace != null && q.pace !== "" && !isNaN(+q.pace) ? Math.max(0, +q.pace) : -1;   /* -1: the human pace; 0: unpaced; N: N ms a tick */
  return {hero, foe, seed, first, pace, search: q.search !== "0" && foe !== DUMMY};   /* the Dummy is a vanilla pile: the rule policy (index.html's table seats it unsharpened unless asked) */   /* ?search=0: the Steady rule policy (a drive's way to tell the AI's own thinking from the shell's) */
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
  const dummy = pick.foe === DUMMY;
  /* A SEAT THE DUMMY FILLS IS ALWAYS THE VANILLA PILE (ruling 2026-08-16): a null hero key, dealt by buildMatch from the page's own pile */
  const m = env.DawnBuild.buildMatch({
    heroes: [pick.hero, dummy ? null : pick.foe],
    boards: [env.DawnBuild.defaultBoard(heroes[pick.hero], decks[pick.hero], db),
             dummy ? {} : env.DawnBuild.defaultBoard(heroes[pick.foe], decks[pick.foe], db)],
    first: pick.first, seed: pick.seed
  }, {db, heroes, decks, ...(dummy ? {vanilla: {deck: env.DUMMY_DECK, gear: env.DUMMY_GEAR, hp: 42, int: env.DUMMY_INT, name: "The Dummy"}} : {})});
  const state = env.DawnJudge.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys, first: m.first, seed: m.seed});
  const art = [pick.hero, pick.foe].map(k => {
    if(k === DUMMY) return null;
    const h = heroes[k], r = env.DawnCards.resolveEntry(db, decks[k].hero, (h.code || "").slice(0, 3) || null);
    return r && r.img ? r.img : null;
  });
  return {state, names: m.names, heroKeys: m.heroKeys, art};
}

/* THE AI'S THINKING OFF THE FRAME PATH (ui/worker/ai.js). Sharp is one long task; the pace already leaves ~1.7 s between the AI's
   plays, so the answer is asked for the moment a state is reached (a Worker thinks while the slab and the glimpse play) and the
   policy hands the engine THAT answer: DawnSparring.act's own, computed from a structured clone of the same state, so no decision
   changes (test/ui-ai-worker.test.js). `local.js` takes the policy synchronously, so the brain also supplies `later`, the tick
   timer: a tick whose answer is still being thought waits for it (up to WAIT_MS), then the page computes it itself.
   EVERY failure is the old path: no Worker (file:// in Chromium throws or errors), an error, a timeout -> act on the main thread. */
const WAIT_MS = 5000;
function makeBrain(env, pick, getState){
  const W = env.Worker;
  if(!pick.search || typeof W !== "function") return null;
  let w = null;
  try { w = new W(env.AI_WORKER_URL || "ui/worker/ai.js"); } catch(e){ return null; }
  let broken = false, id = 0, flight = null, queued = null, cur = null;
  const waiters = new Set();
  const fail = () => { broken = true; flight = queued = cur = null; try { w.terminate(); } catch(e){} [...waiters].forEach(x => x.go()); };
  const post = j => { flight = j; w.postMessage({t: "act", id: j.id, state: j.state, seat: j.seat, search: true}); };
  w.onmessage = ev => {
    const m = ev.data || {};
    if(m.t === "ready") return;
    if(m.t === "error" && m.id == null){ fail(); return; }
    if(!flight || m.id !== flight.id) return;
    const j = flight; flight = null;
    if(m.t === "act"){ j.done = true; j.action = m.action; } else j.failed = true;   /* an error: this state is the page's to compute */
    if(queued){ const q = queued; queued = null; try { post(q); } catch(e){ fail(); } }
    [...waiters].forEach(x => { if(x.j === j) x.go(); });
  };
  w.onerror = fail; w.onmessageerror = fail;
  try { w.postMessage({t: "init", cdn: env.CDN}); } catch(e){ fail(); return null; }
  return {
    /* a state was reached: think about the AI seat's answer to it (the latest wins; one job at a time) */
    request(st, seat){
      if(broken || !st || st.over) return;
      if(cur && cur.state === st && cur.seat === seat) return;
      const j = cur = {id: ++id, state: st, seat, done: false, failed: false, action: null};
      try { if(flight) queued = j; else post(j); } catch(e){ fail(); }
    },
    /* the policy: the worker's answer for exactly this state and seat, else the page's own */
    policy(st, seat, think){
      if(cur && cur.state === st && cur.seat === seat && cur.done) return cur.action;
      return think(st, seat);
    },
    later(fn, ms){
      const h = {t: null, x: null};
      h.t = setTimeout(() => {
        h.t = null;
        const st = getState(), j = cur;
        if(broken || !j || j.state !== st || j.done || j.failed){ fn(); return; }
        const x = h.x = {j, to: null, go: () => { if(h.x === x){ h.x = null; clearTimeout(x.to); waiters.delete(x); fn(); } }};
        x.to = setTimeout(x.go, WAIT_MS); waiters.add(x);
      }, ms);
      return h;
    },
    cancel(h){ if(!h) return; clearTimeout(h.t); if(h.x){ clearTimeout(h.x.to); waiters.delete(h.x); h.x = null; } },
    dispose(){ broken = true; waiters.forEach(x => clearTimeout(x.to)); waiters.clear(); try { w.terminate(); } catch(e){} }
  };
}


/* ============================================================
   NETWORKED TABLES — a server table (engine/servertable.js) and two phones (engine/room.js) behind the SAME surface.
   Both hand back a CHANNEL ({send, listen, first, close, status, code}), so ONE adapter drives either: it runs the lobby the
   way index.html's TableRoom does (hello, hero, a SEALED throw, the seating, a sideboard, the answers to the seed commitment),
   deals the page's own way (buildMatch), and seats net.js's referee session. NO NEW RULES: every step is the engine's.
   The person's choices are made FOR them until the lobby screens exist: their hero (?hero=), a random throw, "first" if they
   win it, the self-play default loadout (the same stand-in openLocal wears).

   Before the game the surface answers state() === null; phase() says where it is:
     connecting | lobby | playing | ended | closed | fault        onPhase(fn) -> unsubscribe
   (lobby() is the lobby's state, for a screen that wants to say who it waits on.)
   ============================================================ */
const FRAME = {JUDGE: "judge", LOBBY: "lobby", NET: "net"};
const THROWS = ["rock", "paper", "scissors"];

/* o: {how: "server-create"|"server-join"|"server-reclaim"|"room-host"|"room-guest", code, hero, transport?, keep?, Peer?, tune?, sleep?,
       rand?, now?, build?, throwPick?(round) -> "rock"|"paper"|"scissors", chooser?: "first"|"second", onStatus?} */
function openNetworked(o, env){
  env = env || root;
  const L = env.DawnLobby, N = env.DawnNet;
  const server = /^server/.test(o.how), host = o.how === "room-host";
  const build = o.build || L.buildId(env.APP_VER, env.DATA_VER);
  const heroes = Object.fromEntries(env.HEROES.map(h => [h.k, h]));
  const decks = Object.fromEntries(env.HEROES.filter(h => env.DECKS[h.k]).map(h => [h.k, env.DawnGame.parseDeck(env.DECKS[h.k])]));
  const subs = new Set(), steps = new Set(), phs = new Set(), evs = new Set(), events = [];
  let ch = null, seat = host ? 0 : o.how === "room-guest" ? 1 : null, lob = null, spec = null, sess = null, db = null;
  let phase = "connecting", seedH = null, openK = null, sentSeed = false, reclaimed = o.how === "server-reclaim", lastState = null, dead = false;
  const rand = o.rand;
  const queue = [];   /* net frames that beat the session */
  /* THE COIN'S SEAM (header): `manual` pauses the lobby at the person's own throw / seating call */
  const manual = o.manual || {}, awaits = new Set(), rmFns = [];
  let waiting = null;
  const holdFor = x => { if(waiting === x) return; waiting = x; awaits.forEach(fn => fn(x)); };
  const done = () => { if(waiting != null){ waiting = null; awaits.forEach(fn => fn(null)); } };
  const setPhase = p => { if(phase === p) return; phase = p; phs.forEach(fn => fn(p)); };
  const emit = e => { events.push(e); evs.forEach(fn => fn(e)); };
  const fault = why => { emit({t: "fault", reason: why}); setPhase("fault"); };

  const say = m => {
    const r = L.reduce(lob, m);
    if(r.error && !r.error.dup) emit({t: "refused", reason: r.error.why});
    if(!r.error) lob = r.state;
    try { ch.send({ch: FRAME.LOBBY, m}); } catch(e){ emit({t: "refused", reason: String(e && e.message || e)}); }
    step();
  };
  const hear = m => {
    const r = L.reduce(lob, m);
    if(r.error && !r.error.dup) emit({t: "refused", reason: r.error.why});
    if(!r.error) lob = r.state;
    step();
  };

  function step(){
    if(dead || !lob || seat == null) return;
    const st = L.stepOf(lob), me = seat;
    if(st === "fault"){ fault(lob.fault); return; }
    if(sess) return;
    if(phase === "connecting") setPhase("lobby");
    if(reclaimed && st !== "ready") return;   /* a reloaded seat already answered every step; the table replays them */
    if(st === "hero" && lob.heroes[me] == null) return say(L.hero(me, o.hero));
    if(st === "throw"){
      if(lob.seals[me] == null){
        if(manual.throw){ holdFor("throw"); return; }
        const pick = o.throwPick ? o.throwPick(lob.round) : THROWS[Math.floor((rand ? rand() : Math.random()) * 3) % 3];
        const k = L.throwSeal(me, lob.round, pick, rand); openK = k.open; return say(k.seal);
      }
      if(openK && openK.round === lob.round && L.canOpen(lob, me)){ const k = openK; openK = null; return say(k); }
    }
    if(st === "seat" && lob.winner === me && lob.first == null){
      if(manual.seat){ holdFor("seat"); return; }
      return say(L.seating(me, o.chooser || "first"));
    }
    if(st === "board" && lob.boards[me] == null){
      const b = env.DawnBuild.defaultBoard(heroes[o.hero], decks[o.hero], db);
      return say(L.sideboard(me, b.gearIdx, b.cuts || {}));
    }
    /* the guest (a room's) answers the host's commitment; at a server table each player answers the referee's */
    if(lob.seedC && !sentSeed && (server ? lob.seedGs && lob.seedGs[me] == null : !host && lob.seedG == null)){ sentSeed = true; return say(L.seedAnswer(rand, me)); }
    if(st === "ready") begin();
  }

  function begin(){
    const spec0 = host ? L.matchSpec(lob, seedH) : L.matchSpec(lob);
    if(!spec0) return fault("The seed did not open its commitment — leave and open a new table.");
    spec = spec0;
    let m, g = null;
    try {
      /* ONLY A ROOM'S HOST DEALS; everybody else builds a BLIND match from the spec (the cards, never the game) for the catalog */
      m = env.DawnBuild.buildMatch(host ? spec0 : {...spec0, seed: "blind|" + spec0.seedC}, {db, heroes, decks});
      if(host) g = env.DawnJudge.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys, first: m.first, seed: m.seed});
    } catch(e){ return fault("Could not deal the match: " + (e.message || e)); }
    const catalog = env.DawnWire.makeCatalog(m.builds.flatMap(b => [...(b.deck || []), ...(b.gear || []), ...(b.startItem ? [b.startItem.card] : [])]));
    const names = m.names, heroKeys = m.heroKeys;
    sess = N.createSession({
      seat, host, referee: true, check: env.DawnInvariants.errors, reduce: env.DawnJudge.reduce, legal: env.DawnJudge.legal,
      catalog, build, state: host ? g : null,
      send: f => ch && ch.send({ch: FRAME.NET, m: f}),
      onState: (st, info) => {
        if(info && info.action && lastState) steps.forEach(fn => fn({seat: info.seat, action: info.action, prev: lastState, next: st}));
        lastState = st;
        if(st && st.over) setPhase("ended"); else if(phase === "lobby") setPhase("playing");
        subs.forEach(fn => fn(st));
      },
      onEvent: e => emit(e)
    });
    surface.names = names; surface.heroKeys = heroKeys;
    if(ch.setHave) ch.setHave(() => sess.seq());
    queue.splice(0).forEach(f => sess.receive(f));
    if(!host) sess.join();
    lastState = sess.state();
    setPhase("playing");
    subs.forEach(fn => fn(sess.state()));
  }

  function onFrame(f){
    if(!f || typeof f !== "object" || dead) return;
    if(f.ch === FRAME.JUDGE){
      if(f.seat != null && seat == null){ seat = f.seat; surface.seat = seat; lob = L.newLobby({code: f.code || (ch && ch.code), judge: true}); say(L.hello(seat, build)); }
      return;
    }
    if(f.ch === FRAME.LOBBY){ if(lob) hear(f.m); return; }
    if(f.ch === FRAME.NET){ if(sess) sess.receive(f.m); else queue.push(f.m); }
  }

  const surface = {
    seat: seat == null ? 0 : seat, pick: {hero: o.hero, how: o.how}, names: [null, null], heroKeys: [o.hero, null], networked: true, server,
    phase: () => phase, onPhase: fn => { phs.add(fn); return () => phs.delete(fn); },
    lobby: () => lob, code: () => ch && ch.code,
    channel: () => ch,
    state: () => sess ? sess.state() : null,
    view: () => sess && sess.state(),   /* the referee session's state IS this seat's view */
    legal: a => sess ? env.DawnJudge.legal(sess.state(), a, seat) : "the game has not begun",
    holder: () => sess ? env.DawnJudge.waitingOn(sess.state()) : null,
    submit: a => sess ? sess.submit(a) : "the game has not begun",
    subscribe: fn => { subs.add(fn); return () => subs.delete(fn); },
    onStep: fn => { steps.add(fn); return () => steps.delete(fn); },
    /* A RANKED TABLE has no coach (SCREENS-FLOW F8): the AI never answers for a person's seat there */
    ranked: () => { try { return !!(ch && ch.rank && ch.rank().ranked); } catch(e){ return false; } },
    suggest: () => sess && !(server && surface.ranked()) ? env.DawnSparring.act(sess.state(), seat, {search: true}) : null,
    events: () => events.slice(), onEvent: fn => { evs.add(fn); return () => evs.delete(fn); },
    heroArt: i => null,
    awaiting: () => waiting, onAwait: fn => { awaits.add(fn); return () => awaits.delete(fn); },
    throwNow(pick){
      if(waiting !== "throw") return "not waiting on a throw";
      if(THROWS.indexOf(pick) < 0) return "a throw is rock, paper or scissors";
      done(); const k = L.throwSeal(seat, lob.round, pick, rand); openK = k.open; say(k.seal); return null;
    },
    callSeating(choice){
      if(waiting !== "seat") return "not waiting on the seating call";
      if(choice !== "first" && choice !== "second") return "first or second";
      done(); say(L.seating(seat, choice)); return null;
    },
    coin: () => lob ? {winner: lob.winner == null ? null : lob.winner, first: lob.first == null ? null : lob.first, throws: lob.throws ? lob.throws.slice() : []} : null,
    /* REMATCH — a server table only (the referee opens a new table once both ask); a room has no protocol for it */
    rematch: () => ch && ch.rematch ? ch.rematch() : null,
    onRematch(fn){ if(ch && ch.onRematch) return ch.onRematch(fn); rmFns.push(fn); return () => { const i = rmFns.indexOf(fn); if(i >= 0) rmFns.splice(i, 1); }; },
    askRematch(cancel){ return ch && ch.askRematch ? ch.askRematch(cancel) : Promise.reject(Object.assign(new Error("no rematch here"), {why: "no-rematch"})); },
    async again(){
      const r = surface.rematch();
      if(!server || !r || !r.table) throw Object.assign(new Error("no rematch table"), {why: "no-rematch"});
      surface.dispose();
      return openNetworked({...o, how: "server-join", code: r.table}, env).start();
    },
    status: () => sess ? sess.status() : phase,
    session: () => sess,
    /* open the channel and begin; resolves with the surface (rejects with the channel's own error: .why) */
    async start(){
      env.DawnCards.setCDN(env.CDN);
      db = openDb(env);
      const common = {onStatus: o.onStatus, ...(o.transport ? {transport: o.transport} : {}), ...(o.keep ? {keep: o.keep} : {}), ...(o.tune ? {tune: o.tune} : {}),
        ...(o.sleep ? {sleep: o.sleep} : {}), ...(o.rand ? {rand: () => 0.5} : {}), ...(o.now ? {now: o.now} : {}), have: () => sess ? sess.seq() : undefined, code: o.code};
      if(server){
        const ST = env.DawnServerTable, f = o.how === "server-create" ? ST.startTable : o.how === "server-reclaim" ? ST.reclaim : ST.sitAt;
        /* the table's own door, the classic page's call for call (index.html srvWire / srvWho / store): the page's transport (a drive's wins), the sign-in that
           binds this seat to a PLAYER (a ranked table needs it, to sit at it), and the seat keys kept in the page's store; `role` "creator" = the seat a seek opened */
        const keep = o.keep || pageStore(env);
        ch = await f({...common, transport: o.transport || ST.defaultTransport(env.SERVER_TABLE, env), keep,
          identity: o.identity || ST.defaultIdentity(env.SERVER_TABLE, keep, env), ...(o.role ? {role: o.role} : {})});
        rmFns.splice(0).forEach(fn => ch.onRematch && ch.onRematch(fn));
        ch.listen(onFrame);
      } else {
        ch = await env.DawnRoom.open({code: o.code, host, ...(o.Peer ? {Peer: o.Peer} : {}), onStatus: o.onStatus});
        ch.listen(onFrame);
        lob = L.newLobby({code: ch.code, judge: false});
        if(host){ say(L.hello(0, build)); const sc = L.seedCommitMsg(rand); seedH = sc.seedH; say(sc.msg); }
        else say(L.hello(1, build));
      }
      return surface;
    },
    dispose(){ dead = true; try { ch && ch.close(); } catch(e){} setPhase("closed"); }
  };
  return surface;
}

/* what the flow may light: each mode reports whether THIS page can run it (a server table needs the door open: index.html's switch) */
function modes(env){
  env = env || root;
  const has = n => !!env[n];
  return {
    local: has("DawnLocal") && has("DawnSparring"),
    dummy: has("DawnLocal") && has("DawnSparring") && !!env.DUMMY_DECK && !!env.DUMMY_GEAR,
    /* the ?server= door, read the way index.html does: this phone's remembered choice beats the shipped switch */
    server: has("DawnServerTable") && has("DawnLobby") && has("DawnNet") && !!env.SERVER_TABLE &&
            env.DawnServerTable.doorOpen(env.DawnServerTable.doorChoice(pageStore(env), env.location && env.location.search), env.SERVER_TABLE.on),
    room: has("DawnRoom") && has("DawnLobby") && has("DawnNet")
  };
}

/* a LOCAL game: seat 0 is the person, seat 1 the AI hero (Sharp) */
function openLocal(opts, env){
  env = env || root;
  const pick = choose(opts && opts.query ? opts.query : parseQuery(env.location && env.location.search), env.HEROES, readLast());
  if(opts && (opts.first === 0 || opts.first === 1)) pick.first = opts.first;
  const dealt = deal(pick, env);
  writeLast({hero: pick.hero, foe: pick.foe});
  const subs = new Set(), steps = new Set(), evs = new Set(), events = [];
  const think = (st, i) => env.DawnSparring.act(st, i, {search: pick.search});
  let local = null;
  const seat = 0;
  /* only a PACED table has a beat to think behind; unpaced (pace=0) the loop runs to the end now, as it always did */
  const brain = pick.pace !== 0 ? makeBrain(env, pick, () => local && local.state()) : null;
  local = env.DawnLocal.createLocal({
    seat,
    state: dealt.state,
    reduce: env.DawnJudge.reduce,
    legal: env.DawnJudge.legal,
    policy: brain ? (st, i) => brain.policy(st, i, think) : think,
    ...(brain ? {later: (fn, ms) => brain.later(fn, ms), cancel: h => brain.cancel(h)} : {}),
    ...(pick.pace < 0 ? {pace: aiPace} : pick.pace > 0 ? {pace: pick.pace} : {}),
    onStep: e => { if(brain) brain.request(e.next, 1 - seat); steps.forEach(fn => fn(e)); },
    onEvent: e => { events.push(e); evs.forEach(fn => fn(e)); },
    onState: st => subs.forEach(fn => fn(st))
  });
  const surface = {
    seat, pick, dummy: pick.foe === DUMMY,
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
    /* REMATCH: the same heroes, a fresh seed, the first turn by the coin and the winner's call (the AI winner always goes first) */
    rematch(o2){
      o2 = o2 || {};
      const seed = o2.seed != null ? String(o2.seed) : String(Math.floor(Math.random() * 1e9));
      const call = coinCall(seed, env, o2.choice || "first");
      const base = opts && opts.query ? opts.query : parseQuery(env.location && env.location.search);
      const first = o2.first === 0 || o2.first === 1 ? o2.first : call.first;
      surface.dispose();
      const next = openLocal({query: {...base, hero: pick.hero, foe: pick.foe, seed}, first}, env);
      next.seating = call;
      return next;
    },
    start: () => { if(brain) brain.request(local.state(), 1 - seat); local.start(); },
    dispose: () => { if(brain) brain.dispose(); local.dispose(); },
    local
  };
  return surface;
}

return {openLocal, openNetworked, modes, coinCall, pageStore, DUMMY, makeBrain, choose, parseQuery, deal, aiPace, LAST_KEY};
});
