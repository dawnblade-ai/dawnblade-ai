/* test/helpers/servertransport.js — THE HOSTED REFEREE'S WIRE, FAKED (SERVER S2).

   engine/servertable.js talks to the hosted referee through an injected
   transport `{post(envelope) -> Promise<answer>, subscribe(topic, onPayload,
   onState?) -> unsubscribe}`. This is the offline fake of the other end:
   server/referee.js's `handle` over S1's in-memory store and bus, reached
   through a JSON round trip (what the wire does), with the faults a drill
   needs injected between the two:

     world = makeWorld({build, deal, seedKey})
     world.transport(name)      a transport for one phone (its own subscriptions)
     world.fault.failPosts(n)        the next n posts never reach the server (rejects)
     world.fault.loseAnswers(n)      the next n posts REACH the server, the answer is lost (rejects)
     world.fault.conflicts(n)        the next n store writes lose a version race (the server's real `conflict`)
     world.fault.drop(topic, n)      the next n payloads to `topic` are lost
     world.fault.dup(topic, n)       the next n payloads to `topic` are delivered twice
     world.fault.swap(topic)         the next two payloads to `topic` arrive in the other order
     world.fault.cut(topic)/restore(topic)   the subscription drops (payloads are lost while cut) and comes back
     world.fault.dead(on)            every post rejects (the server is gone)
     world.fault.notFound(on)        every post answers like a missing function (the real transport's "unavailable")
   and records everything a client ever receives (`world.inbound`, JSON text,
   answers and payloads) and everything it sends (`world.outbound`) for the scans.
   Nothing here ships: the page never loads this file. */
const path = require("path");
const F = require("./serverfakes.js");
const T = require("./judgetable.js");
const REAL = require(path.join(__dirname, "..", "..", "server", "referee.js"));
const clone = v => JSON.parse(JSON.stringify(v));

function makeWorld(o){
  o = o || {};
  const SERVER = o.server || REAL;
  const store = F.memStore(), bus = F.memBus();
  const rnd = T.seeded("server|" + (o.seedKey || "") + "|world");
  let clock = 1700000000000;
  let failPuts = 0;
  const lagStore = F.lagged({get: id => store.get(id), put: (id, row, v) => { if(failPuts > 0){ failPuts--; return {ok: false, version: store.version(id)}; } return store.put(id, row, v); }}, o.ticks || 2);
  const deps = {store: lagStore, broadcast: (t, p) => bus.broadcast(t, p), deal: o.deal || T.dealSpec, build: o.build || T.BUILD,
                now: () => clock++, rand: () => rnd, log: e => { W.errors.push(String(e && e.stack || e)); }};
  const f = {fail: 0, lose: 0, dead: false, notFound: false, drop: new Map(), dup: new Map(), swap: new Map(), held: new Map(), cut: new Set()};
  const take = (m, k) => { const n = m.get(k) || 0; if(n > 0){ m.set(k, n - 1); return true; } return false; };
  const W = {store, bus, deps, errors: [], inbound: [], outbound: [], calls: 0, inflight: 0, posts: [], answers: [], route: null, subs: new Map(),
    fault: {
      failPosts: n => { f.fail = n; }, loseAnswers: n => { f.lose = n; }, conflicts: n => { failPuts = n; },
      drop: (t, n) => f.drop.set(t, n), dup: (t, n) => f.dup.set(t, n), swap: t => f.swap.set(t, 2),
      cut: t => { f.cut.add(t); for(const s of W.subs.get(t) || []) s.state && s.state("lost"); },
      restore: t => { f.cut.delete(t); for(const s of W.subs.get(t) || []) s.state && s.state("joined"); },
      dead: on => { f.dead = on !== false; }, notFound: on => { f.notFound = on !== false; }
    },
    row: id => store.row(id), server: SERVER};

  /* payloads reach a topic's subscribers through the faults */
  const route = (topic, payload) => {
    const subs = [...(W.subs.get(topic) || [])];
    const send = p => { for(const s of subs){ const text = JSON.stringify(p); W.inbound.push({topic, text, name: s.name}); s.fn(JSON.parse(text)); } };
    if(f.cut.has(topic)) return;
    if(take(f.drop, topic)) return;
    if(f.swap.get(topic) > 0){
      const left = f.swap.get(topic) - 1; f.swap.set(topic, left);
      if(left === 1){ f.held.set(topic, payload); return; }
      send(payload); const h = f.held.get(topic); f.held.delete(topic); if(h) send(h); return;
    }
    send(payload); if(take(f.dup, topic)) send(payload);
  };
  W.route = route;
  deps.broadcast = (t, p) => { bus.broadcast(t, p); route(t, clone(p)); };

  W.transport = name => ({
    name,
    async post(env){
      W.calls++; W.inflight++;
      try {
        W.outbound.push({name, text: JSON.stringify(env)});
        W.posts.push({name, op: env.op, n: env.n, ch: env.frame && env.frame.ch});
        if(f.dead) throw new Error("fetch failed");
        if(f.notFound) throw Object.assign(new Error("function not found"), {status: 404});
        if(f.fail > 0){ f.fail--; throw new Error("network down"); }
        const ans = clone(await SERVER.handle(JSON.parse(JSON.stringify(env)), deps));
        if(f.lose > 0){ f.lose--; throw new Error("network dropped the answer"); }
        const text = JSON.stringify(ans);
        W.inbound.push({topic: null, text, op: env.op, name}); W.answers.push({name, op: env.op, ok: ans.ok, refused: ans.refused, n: env.n});
        return JSON.parse(text);
      } finally { W.inflight--; }
    },
    subscribe(topic, fn, onState){
      const s = {fn, state: onState, name};
      if(!W.subs.has(topic)) W.subs.set(topic, new Set());
      W.subs.get(topic).add(s);
      if(onState) Promise.resolve().then(() => { if(W.subs.get(topic).has(s)) onState(f.cut.has(topic) ? "lost" : "joined"); });
      return () => W.subs.get(topic).delete(s);
    }
  });

  /* wait until the world is quiet: no call in flight, no frame waiting in any given channel, no new call for two turns */
  W.settle = async (handles, maxTurns) => {
    let quiet = 0, last = -1;
    for(let i = 0; i < (maxTurns || 5000) && quiet < 3; i++){
      await new Promise(r => setImmediate(r));
      const busy = W.inflight > 0 || (handles || []).some(h => h && h.status() !== "closed" && h.pending() > 0);
      if(!busy && W.calls === last) quiet++; else quiet = 0;
      last = W.calls;
    }
  };
  return W;
}

module.exports = {makeWorld, SERVER: REAL};
