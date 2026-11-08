/* test/wsreferee.test.js — HIDDEN HANDS H3, INCREMENT 2: THE REFEREE BEHIND
   net.wsAdapter, PROVEN IN A SERVER-LIKE RUNTIME (HIDDEN-HANDS.md §3(c), §6).

   The judge's table (hub.js) does not care what carries its frames. Here:
     1. a judged game where BOTH phones reach the judge over WebSocket pairs
        (strings only, in order), through `wsAdapter(sock).handle()` at each
        phone and `wsAdapter(sock).accept(hub)` at the judge — both phones
        blind and verifying, as test/judgetable.test.js proves over calls;
     2. THE SAME GAME with the judge inside an isolate shaped like a
        Cloudflare Worker / Durable Object (test/helpers/isolate.js: web
        globals only — no window, document, require, process, Buffer), the
        engine loaded as the page's own plain scripts. It must play the SAME
        game, action for action, as the in-process judge: the runtime moves,
        the referee does not;
     3. the isolate's judge restarts from what it persisted (a Durable Object
        evicted and rehydrated) and the game ends as an uninterrupted one;
     4. the adapter's own seams: `first()`, buffering, a closed socket frees
        its seat.
   Sabotage beside each: the isolate really lacks the DOM and node; a
   different seed is a different game (the equality can fail).
   Deno runs this file and the other referee drills unchanged:
   tools/serverrun.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./helpers/judgetable.js");
const {makeIsolate} = require("./helpers/isolate.js");
const {judgedGame, makeTable, R, J, N, Hub, json} = T;

const verifyAll = r => r.t.phones.map(p => { const rv = p.sess.revealed();
  return rv ? R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
    start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: J.reduce, seat: p.seat,
    log: rv.log, hashes: p.sess.hashes(), over: rv.over}) : {ok: false, why: "no reveal"}; });
const clean = (r, label) => {
  assert.ok(r.over, label + ": finished");
  assert.deepEqual(r.mism, [0, 0], label + ": fingerprints");
  assert.deepEqual(r.deep, [0, 0], label + ": whole views");
  assert.deepEqual([r.leaks[0].length, r.leaks[1].length], [0, 0], label + ": hidden uids received " + r.leaks[0].concat(r.leaks[1]).slice(0, 2));
  assert.equal(r.seedLeak, 0); assert.equal(r.earlyReveal, 0); assert.equal(r.judgeLeak, 0);
  assert.ok(r.big <= 16 * 1024, label + ": a frame of " + r.big);
  for(const v of verifyAll(r)) assert.ok(v.ok, label + ": " + v.why);
};

/* the in-isolate judge: a TableObject per hub, its socket accept */
function isolateJudge(){
  const iso = makeIsolate();
  const tables = new Map();
  return {iso,
    makeHub: opts => { const t = new iso.TableObject({code: opts.code, build: opts.build, rand: opts.rand, resume: opts.resume, onEvent: opts.onEvent});
                       tables.set(t.hub, t); return t.hub; },
    accept: (hub, sock) => tables.get(hub).webSocket(sock)};
}

const H0 = "kayo", H1 = "dash";
const CALLS = judgedGame(H0, H1, "ws-0");
const WS = judgedGame(H0, H1, "ws-0", {ws: true});
const ISO = isolateJudge();
const SERVER = judgedGame(H0, H1, "ws-0", {ws: true, makeHub: ISO.makeHub, accept: ISO.accept});

test("OVER WEBSOCKETS — both phones reach the judge through wsAdapter (strings only), stay blind, and verify", () => {
  clean(WS, "ws");
  assert.ok(WS.t.sockets > WS.steps, "every frame crossed a socket: " + WS.t.sockets);
});

test("IN A SERVER-LIKE ISOLATE — no window, document, require, process or Buffer; the page's own scripts; the judge holds the deck there", () => {
  for(const k of ["window", "document", "require", "module", "process", "Buffer", "global"])
    assert.equal(ISO.iso.runtime[k], "undefined", k + " is absent in the isolate");
  assert.ok(ISO.iso.scripts.includes("engine/hub.js") && ISO.iso.scripts.includes("engine/referee.js") && ISO.iso.scripts.includes("data/pool.js"));
  clean(SERVER, "isolate");
});

test("THE RUNTIME MOVES, THE REFEREE DOES NOT — the isolate's judge, the socket judge and the in-process judge play the same game, action for action", () => {
  assert.deepEqual(json(WS.log), json(CALLS.log), "sockets vs calls");
  assert.deepEqual(json(SERVER.log), json(CALLS.log), "isolate vs calls");
  assert.deepEqual(json(SERVER.over), json(CALLS.over));
  /* each phone was shown the same views, fingerprint for fingerprint */
  for(const s of [0, 1]) assert.deepEqual(SERVER.t.seatPhones()[s].sess.hashes(), CALLS.t.seatPhones()[s].sess.hashes(), "seat " + s);
});

test("SABOTAGE — the equality can fail (another seed is another game), and the isolate really lacks the DOM and node", () => {
  const other = judgedGame(H0, H1, "ws-1", {ws: true, makeHub: ISO.makeHub, accept: ISO.accept});
  assert.notDeepEqual(json(other.log), json(CALLS.log));
  for(const src of ["document.title", "window.location", "require('fs')", "process.env", "Buffer.from('x')"])
    /* the error is the ISOLATE's ReferenceError (another realm), so match by name */
    assert.throws(() => ISO.iso.run(src), e => e && e.name === "ReferenceError", src + " must not resolve in the isolate");
  /* and the same probe resolves in a context that HAS them: the drill can tell */
  const leaky = makeIsolate({extra: {document: {title: "x"}, process: {env: {}}}});
  assert.equal(leaky.runtime.document, "object");
  assert.equal(leaky.runtime.process, "object");
  assert.doesNotThrow(() => leaky.run("document.title"));
});

const play = (t, limit) => { let n = 0; while(n < (limit || 3000) && t.step()) n++; return n; };

test("THE SERVER'S JUDGE IS EVICTED AND REHYDRATED — it resumes from what it persisted, both phones reclaim their seats over new sockets, and the game ends as an uninterrupted one", () => {
  const iso = isolateJudge();
  const base = makeTable({heroes: ["dash", "briar"], salt: "evict", ws: true, makeHub: iso.makeHub, accept: iso.accept}).open();
  play(base);
  const t = makeTable({heroes: ["dash", "briar"], salt: "evict", ws: true, makeHub: iso.makeHub, accept: iso.accept}).open();
  play(t, 70);
  const seq = t.hub.session().seq();
  const saved = t.restartJudge();
  assert.ok(saved.saved && saved.keys, "the persisted table carries the game and the seat keys");
  JSON.parse(JSON.stringify(saved));    /* storage-shaped: plain JSON */
  for(const p of t.phones){ assert.equal(p.sess.status(), "paused"); }
  for(const p of t.phones) p.redial();
  t.flush();
  assert.equal(t.hub.session().seq(), seq);
  for(const p of t.phones) assert.equal(p.sess.status(), "ready");
  play(t);
  assert.deepEqual(json(t.hub.session().full().over), json(base.hub.session().full().over));
  assert.deepEqual(json(t.hub.session().log()), json(base.hub.session().log()));
});

test("THE ADAPTER — handle() buffers until listened to and first() peeks without consuming; accept() frees the seat when the socket closes", () => {
  const q = [];
  const mk = () => ({readyState: 1, l: {}, addEventListener(e, f){ (this.l[e] = this.l[e] || []).push(f); }, fire(e, x){ (this.l[e] || []).forEach(f => f(x)); },
    send(s){ const o = this.other; q.push(() => o.fire("message", {data: s})); }, close(){ this.readyState = 3; const o = this.other; q.push(() => { this.fire("close", {}); o.readyState = 3; o.fire("close", {}); }); }});
  const a = mk(), b = mk(); a.other = b; b.other = a;
  const drain = () => { while(q.length) q.shift()(); };
  const hub = Hub.createHub({code: "WS01", build: T.BUILD, deal: T.dealSpec, reduce: J.reduce, legal: J.legal, rand: T.seeded("ad")});
  const h = N.wsAdapter(a).handle();
  N.wsAdapter(b).accept(hub);
  drain();
  let first = null;
  h.first().then(f => { first = f; });
  return Promise.resolve().then(() => {
    assert.equal(first && first.ch, "judge", "the seat offer, peeked");
    assert.equal(first.seat, 0);
    const got = [];
    h.listen(f => got.push(f));
    assert.equal(got[0].ch, "judge", "…and still delivered, first");
    assert.deepEqual(hub.info().seats, [true, false]);
    a.close(); drain();
    assert.deepEqual(hub.info().seats, [false, false], "a closed socket frees its seat");
    assert.equal(h.status(), "closed");
    /* SABOTAGE: a socket that is not open sends nothing */
    const c = mk(), d = mk(); c.other = d; d.other = c; c.readyState = 0;
    N.wsAdapter(c).send({x: 1}); assert.equal(q.length, 0);
  });
});
