/* test/helpers/judgetable.js — A JUDGED TABLE, HEADLESS (HIDDEN HANDS H3).

   Three parties and no network: the JUDGE (engine/hub.js, holding the deck)
   and two PHONES, each a plain referee guest (net.js, host: false) that runs
   the lobby the way index.html's TableRoom does — hello, hero, a SEALED throw,
   the seating, a sideboard, its answer to the judge's seed commitment — then
   builds a BLIND match for the card catalog only and joins the judge's game.

   Every frame crosses as JSON through one FIFO queue (`flush` delivers until
   it is empty), so re-entrancy cannot hide an ordering bug, and every frame a
   phone receives is kept (`phone.inbox`) for the leak scans. A phone's link
   can be cut (`drop`) and re-dialled (`redial`, which CLAIMS its seat), and
   the judge itself can be replaced by one resumed from what it persisted.

   Used by test/judgetable.test.js and tools/serverrun.js (the same drills under a
   server-like runtime). Deals with uids from 100000 (referee.test.js's rule),
   so ANY scalar equal to a hidden uid in a frame is a leak, under any key. */
const J   = require("../../engine/judge.js");
const SP  = require("../../engine/sparring.js");
const B   = require("../../engine/build.js");
const G   = require("../../engine/game.js");
const RNG = require("../../engine/rng.js");
const INV = require("../../engine/invariants.js");
const N   = require("../../engine/net.js");
const L   = require("../../engine/lobby.js");
const Hub = require("../../engine/hub.js");
const Wr  = require("../../engine/wire.js");
const R   = require("../../engine/referee.js");
const V   = require("../../engine/view.js");
const {loadData} = require("./extract.js");
const HJ  = require("./judged.js");

const W = loadData();
const DB = HJ.db();
const HEROES = W.HEROES.filter(h => W.DECKS[h.k]).map(h => h.k);
const BUILD = "judge-drill";
const UID0 = 100000;
const json = v => JSON.parse(JSON.stringify(v));

/* a deterministic [0,1) stream from a string (hostref.test.js's) */
const seeded = str => { let x = 2166136261; for(let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619) >>> 0;
  x = x || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };

function deal(k0, k1, seed, first){
  const h0 = W.HEROES.find(h => h.k === k0), h1 = W.HEROES.find(h => h.k === k1);
  const ctr = {n: UID0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
}
/* the board too: Dash's Hyper Driver starts in play (the page builds its
   catalog from the builds' deck, gear and start item — the same cards) */
const catalogOf = g => Wr.makeCatalog([].concat(...g.sides.map(sd => [...sd.deck, ...sd.hand, ...sd.gear, ...(sd.board || []).map(e => (e && e.card) || e), ...(sd.arsenal ? [sd.arsenal] : [])])));
const dealSpec = spec => { const state = deal(spec.heroes[0], spec.heroes[1], spec.seed, spec.first); return {state, catalog: catalogOf(state)}; };

/* o: {heroes: [k0, k1], salt, throws: [[a, b], ...], chooser: "first"|"second",
       seatView? (sabotage seam, handed to the judge's referee), forge?} */
function makeTable(o){
  o = o || {};
  const rand = seeded((o.heroes || []).join("|") + "|" + (o.salt || ""));
  const queue = [];
  const flush = () => { let n = 0; while(queue.length){ if(++n > 1e6) throw new Error("the queue never drained"); queue.shift()(); } };
  const ev = [];
  const hubOpts = {code: "JDGE", build: BUILD, deal: dealSpec, reduce: J.reduce, legal: J.legal, check: INV.errors,
                   rand, onEvent: e => ev.push(e), seatView: o.seatView};
  const T = {queue, flush, ev, phones: [], hub: null, rand, sockets: 0};
  /* WHERE THE JUDGE RUNS. By default a hub.js in this process, reached by
     direct calls. `o.makeHub(opts)` puts it elsewhere (tools/serverrun.js:
     a Durable-Object-shaped table inside a server-like isolate); with
     `o.ws` every phone reaches it over a WebSocket pair through
     net.wsAdapter — `handle()` at the phone, `accept(hub)` at the judge
     (`o.accept(hub, socket)` when the hub lives elsewhere). */
  const makeHub = o.makeHub || (opts => Hub.createHub(opts));
  const accept = o.accept || ((hub, sock) => N.wsAdapter(sock).accept(hub));
  T.hub = makeHub(hubOpts);
  /* A WebSocketPair, as Workers and Deno hand one out: two ends that carry
     STRINGS (a non-string send throws), deliver in order through the queue,
     and close both ways. */
  function socketPair(){
    const mk = () => ({readyState: 1, l: {}, addEventListener(ev, f){ (this.l[ev] = this.l[ev] || []).push(f); },
      fire(ev, e){ (this.l[ev] || []).forEach(f => f(e)); },
      send(str){ if(typeof str !== "string") throw new Error("a WebSocket carries strings"); const other = this.other; T.sockets++;
        queue.push(() => { if(other.readyState === 1) other.fire("message", {data: str}); }); },
      close(){ if(this.readyState === 3) return; this.readyState = 3; const other = this.other;
        queue.push(() => { this.fire("close", {}); if(other.readyState !== 3){ other.readyState = 3; other.fire("close", {}); } }); }});
    const a = mk(), b = mk(); a.other = b; b.other = a;
    return [a, b];
  }

  /* a phone: dials the judge, is offered (or claims) a seat, runs the lobby */
  function phone(name, hero){
    const P = {name, hero, seat: null, key: null, lob: null, sess: null, link: null, up: false, inbox: [], open: null, sentSeed: false,
               events: [], catalog: null, spec: null, refused: []};
    const deliver = f => P.receive(json(f));
    P.dial = claim => {
      P.up = true;
      if(o.ws){
        const [client, server] = socketPair();
        accept(T.hub, server);
        const h = N.wsAdapter(client).handle();
        P.sock = client; P.h = h;
        h.listen(f => { if(P.up && P.h === h) P.receive(f); });
      } else {
        const end = {send: f => { const w = json(f); queue.push(() => { if(P.up && P.end === end) P.receive(w); }); }, close(){}};
        P.end = end;
        P.link = T.hub.connect(end);
      }
      if(claim != null) P.say({ch: Hub.CH.JUDGE, claim, key: P.key});
    };
    P.say = f => {
      if(o.ws){ if(P.up) P.h.send(f); return; }
      const w = json(f), link = P.link; queue.push(() => { if(P.up && P.link === link) link.receive(w); });
    };
    P.drop = () => { P.up = false; if(o.ws) P.sock.close(); else P.link.closed(); if(P.sess) P.sess.pause("the channel closed"); };
    P.redial = () => { P.dial(P.seat); if(P.sess) P.sess.join(); };
    P.lobby = m => { const r = L.reduce(P.lob, m); if(r.error && !r.error.dup) P.refused.push(r.error.why); if(!r.error) P.lob = r.state; P.say({ch: Hub.CH.LOBBY, m}); P.step(); };
    P.receive = f => {
      P.inbox.push(f);
      if(f.ch === Hub.CH.JUDGE){
        if(f.seat != null && f.key) P.key = f.key;
        if(f.seat != null && P.seat == null){ P.seat = f.seat; P.lob = L.newLobby({code: f.code, judge: true}); P.lobby(L.hello(P.seat, BUILD)); }
        return;
      }
      if(f.ch === Hub.CH.LOBBY){ if(!P.lob) return; const r = L.reduce(P.lob, f.m); if(!r.error) P.lob = r.state; P.step(); return; }
      if(f.ch === Hub.CH.NET && P.sess) P.sess.receive(f.m);
    };
    /* the lobby, as TableRoom drives it */
    P.step = () => {
      const s = P.lob, st = L.stepOf(s), me = P.seat;
      if(st === "hero" && s.heroes[me] == null) return P.lobby(L.hero(me, P.hero));
      if(st === "throw"){
        if(s.seals[me] == null){ const tr = (o.throws || [["paper", "rock"]])[Math.min(s.round, (o.throws || [1]).length - 1)][me];
          const k = L.throwSeal(me, s.round, tr, rand); P.open = k.open; return P.lobby(k.seal); }
        if(P.open && P.open.round === s.round && L.canOpen(s, me)){ const k = P.open; P.open = null; return P.lobby(k); }
      }
      if(st === "seat" && s.winner === me && s.first == null) return P.lobby(L.seating(me, o.chooser || "first"));
      if(st === "board" && s.boards[me] == null) return P.lobby(L.sideboard(me, [], {}));
      if(s.seedC && s.seedGs && s.seedGs[me] == null && !P.sentSeed){ P.sentSeed = true; return P.lobby(L.seedAnswer(rand, me)); }
      if(st === "ready" && !P.sess) P.start();
    };
    /* READY: the phone builds a BLIND match (a seed of its own) for the card
       catalog only — the judge deals the real game and sends a view of it */
    P.start = () => {
      P.spec = L.matchSpec(P.lob);
      const blind = deal(P.spec.heroes[0], P.spec.heroes[1], "blind|" + P.spec.seedC, P.spec.first);
      P.catalog = catalogOf(blind);
      P.sess = N.createSession({seat: P.seat, host: false, referee: true, reduce: J.reduce, legal: J.legal, catalog: P.catalog, build: BUILD,
        send: m => P.say({ch: Hub.CH.NET, m: o.forge ? o.forge(m, P) : m}), onEvent: e => P.events.push(e)});
      P.sess.join();
    };
    return P;
  }
  T.phone = phone;
  T.seatPhones = () => { const out = []; for(const p of T.phones) if(p.seat != null) out[p.seat] = p; return out; };
  /* both phones sit down and negotiate; the judge deals; both join */
  T.open = () => {
    const [k0, k1] = o.heroes;
    const a = phone("A", k0); T.phones.push(a); a.dial(); flush();
    const b = phone("B", k1); T.phones.push(b); b.dial(); flush();
    /* the hero each phone picks follows its seat, so the matchup is fixed */
    return T;
  };
  /* one action by whichever seat the policy moves, from THAT PHONE'S VIEW,
     through its own session (twophone.js's split) */
  T.step = () => {
    const sess = T.hub.session();
    if(!sess || sess.full().over) return false;
    const ps = T.seatPhones();
    for(const s of [0, 1]){
      const p = ps[s];
      if(!p || !p.up || !p.sess || p.sess.status() !== "ready") continue;
      const a = SP.act(p.sess.state(), s, {search: false});
      if(!a) continue;
      const why = p.sess.submit(a);
      flush();
      if(why) throw new Error("seat " + s + " refused on its own view: " + why);
      return true;
    }
    return false;
  };
  T.agrees = s => { const p = T.seatPhones()[s]; return p.sess.hash() === Wr.hash(R.seatView(T.hub.session().full(), s)); };
  /* the judge's device restarts from what it persisted */
  T.restartJudge = () => {
    const saved = json(T.hub.persist());
    for(const p of T.phones) if(p.up){ p.up = false; if(o.ws) p.sock.close(); if(p.sess) p.sess.pause("the judge's device left the table"); }
    flush();
    T.hub = makeHub({...hubOpts, resume: saved});
    return saved;
  };
  return T;
}

/* every scalar, key and long digit run in a frame (referee.test.js's scanner) */
function tokens(v, out){
  out = out || [];
  if(v == null) return out;
  if(Array.isArray(v)){ v.forEach(x => tokens(x, out)); return out; }
  /* a KEY can carry a uid inside it (`ct100083`, `ally100083`, v6.25): its digit runs are tokens too */
  if(typeof v === "object"){ for(const k of Object.keys(v)){ out.push(k); if(k === "tokSeq") continue;   /* a counter of tokens made, not a card: it can equal a uid by chance (Enigma's deal, 100110) */  const m = k.match(/\d{6,}/g); if(m) out.push(...m); tokens(v[k], out); } return out; }
  const s = String(v); out.push(s);
  if(typeof v === "string"){ const m = s.match(/\d{6,}/g); if(m) out.push(...m); }
  return out;
}
const hiddenUidSet = (g, seat) => new Set([...V.hiddenUids(g, seat).keys()].map(String));

/* Play one judged game to its end (test/judgetable.test.js's proving run;
   `o.ws`/`o.makeHub`/`o.accept` move the judge behind a socket or into an
   isolate, and the scans are the same). Scans, after EVERY commit: both phones'
   fingerprints and (every third step) whole views against the referee's;
   every new frame each phone received against the uids hidden from THAT
   phone before and after the step; the frame size; the seed's secret half. */
function judgedGame(k0, k1, salt, o){
  o = o || {};
  const t = makeTable({heroes: [k0, k1], salt, throws: [["rock", "rock"], ["paper", "rock"]], seatView: o.seatView,
                       ws: o.ws, makeHub: o.makeHub, accept: o.accept}).open();
  const ps = t.seatPhones();
  const rec = {t, steps: 0, mism: [0, 0], deep: [0, 0], leaks: [[], []], big: 0, seedLeak: 0, judgeLeak: 0, earlyReveal: 0};
  const parts = [null, null];
  const sess = t.hub.session();
  const seen = [0, 0];
  let prevHid = [0, 1].map(s => hiddenUidSet(sess.full(), s));
  const scan = () => {
    const full = t.hub.session().full();
    /* the seed's secret half and the match seed (both hex, so a match is no accident) */
    const kept = t.hub.persist() || {};
    const secret = [kept.seedH, kept.spec && kept.spec.seed].filter(Boolean).map(String);
    for(const s of [0, 1]){
      const hid = hiddenUidSet(full, s), both = new Set([...hid].filter(u => prevHid[s].has(u)));
      const inbox = ps[s].inbox;
      for(const f0 of inbox.slice(seen[s])){
        /* a message too big for one frame arrives in PARTs: scan it whole */
        let f = f0;
        if(f.m && f.m.t === "part"){
          const pp = parts[s] && parts[s].id === f.m.id ? parts[s] : (parts[s] = {id: f.m.id, got: []});
          pp.got[f.m.i] = f.m.s;
          if(pp.got.filter(x => x != null).length < f.m.n) continue;
          f = {ch: f.ch, m: JSON.parse(pp.got.join(""))}; parts[s] = null;
        }
        /* THE REVEAL is the post-game publication of the seed and the whole
           log — legitimate only once the game is over */
        if(f.m && f.m.t === "reveal"){ if(!full.over) rec.earlyReveal++; continue; }
        const str = JSON.stringify(f);
        rec.big = Math.max(rec.big, str.length);
        for(const u of tokens(f)) if(both.has(u)) rec.leaks[s].push(rec.steps + ": " + (f.m && f.m.t) + " uid " + u);
        if(secret.some(x => str.indexOf(x) >= 0)) rec.seedLeak++;
      }
      seen[s] = inbox.length;
      prevHid[s] = hid;
    }
  };
  scan();
  while(rec.steps < (o.maxSteps || 3000) && t.step()){
    rec.steps++;
    for(const s of [0, 1]){
      if(!t.agrees(s)) rec.mism[s]++;
      if(rec.steps % 3 === 0 && !o.seatView && !R.same(ps[s].sess.state(), R.seatView(t.hub.session().full(), s))) rec.deep[s]++;
    }
    scan();
    if(o.stopAtLeak && (rec.leaks[0].length || rec.leaks[1].length)) break;
    if(rec.steps % 25 === 0){
      /* the judge's own screen is the PUBLIC view: no hidden card of either seat */
      const pub = t.hub.session().state(), full = t.hub.session().full();
      const hid = new Set([...hiddenUidSet(full, 0)].filter(u => hiddenUidSet(full, 1).has(u)));
      if(tokens(pub).some(u => hid.has(u))) rec.judgeLeak++;
    }
  }
  rec.over = t.hub.session().full().over;     /* falsy when `o.maxSteps` stopped the game short */
  rec.log = t.hub.session().log();
  return rec;
}

module.exports = {makeTable, judgedGame, deal, dealSpec, catalogOf, seeded, tokens, hiddenUidSet, HEROES, BUILD, UID0, J, SP, N, L, Hub, Wr, R, V, INV, W, json};
