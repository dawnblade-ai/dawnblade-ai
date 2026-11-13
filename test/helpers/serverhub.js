/* test/helpers/serverhub.js — THE HOSTED REFEREE, DRESSED AS A HUB (SERVER S1).

   test/helpers/judgetable.js drives a judged table through one seam: a hub
   with `connect(end)` -> {receive, closed, seat}, plus `session()`, `persist()`
   and `info()` for the scans. This is that seam over server/referee.js: every
   frame a phone says becomes ONE `handleNow` request against a fresh
   rehydration of the stored row (the hub is never held between requests —
   that is the point), and what a phone hears is ONLY what the server
   broadcast to its seat's private topic, plus the join's own response.

   So the drills that already scan a judged game (judgedGame: both phones'
   fingerprints, whole views, every frame for hidden uids and the seed, the
   verify replay) scan THIS game unchanged, and `audit` adds what only a
   server has: every response and every broadcast payload, as text, for the
   seed, the keys and the match seed; each response's frames equal what was
   broadcast to that seat in the same call.

   `session()`/`persist()`/`info()` are INSPECTORS: they rehydrate their own
   hub from the stored row (cached per row version) and send nothing.

   makeServerHub({server, deal?, seedKey, tamper?}) -> makeHub(opts):
     server  the module under test (handleNow) — default server/referee.js
     deal    overrides opts.deal (the isolate's own card database)
     tamper  {broadcast?(topic, payload, bus, {store, code}) -> void} — the sabotage seam:
             it REPLACES the bus's broadcast, to prove the audit bites. */
const path = require("path");
const Hub = require("../../engine/hub.js");
const J = require("../../engine/judge.js");
const INV = require("../../engine/invariants.js");
const {memStore, memBus} = require("./serverfakes.js");
const T = require("./judgetable.js");
const clone = v => JSON.parse(JSON.stringify(v));
const SERVER = require(path.join(__dirname, "..", "..", "server", "referee.js"));

function makeServerHub(cfg){
  cfg = cfg || {};
  const server = cfg.server || SERVER;
  return function makeHub(opts){
    const code = opts.code, deal = cfg.deal || opts.deal;
    const store = memStore(), bus = memBus();
    const rnd = T.seeded("server|" + (cfg.seedKey || "") + "|" + code);
    let clock = 1700000000000;
    const broadcast = cfg.tamper && cfg.tamper.broadcast ? (t, p) => cfg.tamper.broadcast(t, p, bus, {store, code}) : (t, p) => bus.broadcast(t, p);
    /* the deps, from a clean clock and a clean seed: the async replay builds a second set */
    const makeDeps = (st, bs) => { let ck = 1700000000000; const r = T.seeded("server|" + (cfg.seedKey || "") + "|" + code);
      return {store: st, broadcast: (t, p) => bs.broadcast(t, p), deal, build: opts.build, now: () => ck++, rand: () => r,
              log: e => { audit.errors.push(String(e && e.stack || e)); }}; };
    const deps = {...makeDeps(store, bus), broadcast, now: () => clock++, rand: () => rnd};
    const audit = {calls: 0, timings: [], responses: [], reqs: [], resps: [], leaks: [], mismatch: 0, errors: [], refused: [], store, bus, deps, makeDeps, code};

    /* ---- inspector: a hub rehydrated from the stored row, never fed a frame ---- */
    let cache = {version: -1, hub: null};
    const inspect = () => {
      const v = store.version(code);
      if(cache.version !== v){
        cache = {version: v, hub: Hub.createHub({code, build: opts.build, deal, reduce: J.reduce, legal: J.legal, check: INV.errors,
                                                  resume: store.row(code).hub})};
      }
      return cache.hub;
    };

    /* the strings that must never leave: the seed's secret half, the match
       seed and both seats' keys (read off the stored row, after the call) */
    const secrets = () => { const h = (store.row(code) || {}).hub || {};
      return {seedH: h.seedH, seed: h.spec && h.spec.seed, keys: (h.keys || []).filter(Boolean)}; };
    const scanText = (what, text, seat, allowOwnKey) => {
      const s = secrets();
      if(s.seedH && text.indexOf(s.seedH) >= 0) audit.leaks.push(what + ": the seed's secret half");
      if(s.seed && text.indexOf(String(s.seed)) >= 0) audit.leaks.push(what + ": the match seed");
      s.keys.forEach((k, i) => { if(text.indexOf(k) >= 0 && !(allowOwnKey && i === seat)) audit.leaks.push(what + ": seat " + i + "'s key"); });
      /* a channel name is a bearer secret (S3, Option B): no response and no frame may carry either seat's */
      s.keys.forEach((k, i) => { const h = server.topic(code, i, k).split(":")[2]; if(text.indexOf(h) >= 0) audit.leaks.push(what + ": seat " + i + "'s channel name"); });
    };

    function call(req){
      const mark = bus.log.length, t0 = performance.now();
      const res = clone(server.handleNow(req, deps));
      /* what one request cost: load, rehydrate, apply, save, push (tools/servermeasure.js reads these) */
      audit.timings.push({op: req.op, what: req.frame ? req.frame.ch + ":" + ((req.frame.m && req.frame.m.t) || "") : req.op, ms: performance.now() - t0,
                          bytes: JSON.stringify(res).length, version: res.version});
      audit.calls++; audit.reqs.push(clone(req)); audit.resps.push(res);
      audit.responses.push({req: req.op, ok: res.ok, refused: res.refused});
      if(!res.ok) audit.refused.push(res.refused);
      const sent = bus.log.slice(mark);
      /* a reveal is the post-game publication of the seed and the log: legitimate once over */
      /* a message too big for one frame arrives in parts: scan it WHOLE */
      const wholes = frames => { const out = [], parts = {};
        for(const f of frames || []){
          if(f.m && f.m.t === "part"){ const p = parts[f.m.id] = parts[f.m.id] || []; p[f.m.i] = f.m.s;
            if(p.filter(x => x != null).length === f.m.n){ const s = p.join(""); if(s.indexOf('"t":"reveal"') < 0) out.push(s); } }
          else if(!(f.m && f.m.t === "reveal")) out.push(JSON.stringify(f));
        }
        return out; };
      const joined = req.op === "join" && res.ok;
      for(const t of wholes(res.frames)) scanText(req.op + " response", t, res.seat != null ? res.seat : req.seat, joined);
      scanText(req.op + " response (envelope)", JSON.stringify({...res, frames: undefined}), req.seat, false);
      for(const e of sent) for(const t of wholes(e.payload.frames)) scanText("broadcast to " + e.topic, t, null, false);
      for(const e of sent) secrets().keys.forEach((k, i) => { if(e.topic.indexOf(k) >= 0) audit.leaks.push("a channel name carries seat " + i + "'s key"); });
      /* a call's frames reach the caller in its response; its own topic carries none of them */
      if(req.op !== "create" && req.seat != null && sent.some(e => e.topic === server.topic(code, req.seat, ((store.row(code) || {}).hub || {keys: []}).keys[req.seat]))) audit.mismatch++;
      return res;
    }
    call({op: "create", table: code});

    const hub = {
      audit,
      connect(end){
        const L = {seat: null, key: null, n: 0, unsub: null};
        const seated = (res) => {
          L.seat = res.seat; L.n = res.n || 0;
          for(const f of res.frames){ if(f.ch === Hub.CH.JUDGE && f.key) L.key = f.key; end.send(f); }
          if(L.unsub) L.unsub();
          L.unsub = bus.subscribe(server.topic(code, L.seat, L.key), p => p.frames.forEach(f => end.send(f)));
        };
        const first = call({op: "join", table: code});
        if(first.ok) seated(first); else end.send({ch: Hub.CH.JUDGE, full: first.refused === "full" ? true : undefined, refused: first.refused});
        return {
          receive(f){
            if(!f || typeof f !== "object") return;
            if(f.ch === Hub.CH.JUDGE){
              if(f.claim === 0 || f.claim === 1){
                const r = call({op: "join", table: code, seat: f.claim, key: f.key});
                if(r.ok){ L.key = f.key; seated(r); } else end.send({ch: Hub.CH.JUDGE, refused: r.refused});
              }
              return;
            }
            if(L.seat == null) return;
            const r = call({op: "frame", table: code, seat: L.seat, key: L.key, n: ++L.n, frame: f});
            if(!r.ok && r.refused === "conflict") throw new Error("a sequential drive lost a version race");
            for(const g of (r.frames || [])) end.send(g);
          },
          closed(){ if(L.unsub) L.unsub(); L.unsub = null; },
          seat: () => L.seat
        };
      },
      session: () => inspect().session(),
      persist: () => store.row(code).hub,
      info: () => inspect().info(),
      spec: () => inspect().spec(),
      seedH: () => inspect().seedH()
    };
    return hub;
  };
}

module.exports = {makeServerHub, SERVER};
