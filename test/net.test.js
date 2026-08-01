/* THE SYNCHRONIZATION DRILLS (engine/net.js).

   The question every one of these answers is the same: after N messages
   crossed a network that may have lost, duplicated or reordered them, do
   the two phones hold the SAME GAME?

   The measure is `DawnWire.hash` — the rules fingerprint — and it is
   asserted after every scenario rather than at the end of a happy path,
   because the failure this module exists to prevent is the one where
   everything looks fine.

   Everything crossing the loopback is round-tripped through JSON, so a
   message that would not survive a real DataChannel fails here too. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const N = require("../engine/net.js");
const W = require("../engine/wire.js");
const A = require("../engine/actions.js");

/* Two sessions, wired together. The host is seat 0 and the sequencer. */
function pair(o){
  o = o || {};
  const link = N.loopback();
  const events = {a: [], b: []};
  const mk = (end, seat, host) => {
    const s = N.createSession({
      seat, host, reduce: A.reduce, legal: A.legal,
      catalog: o.catalog || null, build: o.build || null,
      state: host ? (o.state || A.newMatch({seed: o.seed || "room-42", first: o.first || 0})) : null,
      send: m => end.send(m),
      onEvent: e => events[end.name].push(e)
    });
    end.session = s;
    return s;
  };
  const host = mk(link.a, 0, true);
  const guest = mk(link.b, 1, false);
  if(o.join !== false) guest.join();
  return {link, host, guest, events};
}

const agree = (p, where) => {
  assert.equal(p.guest.status(), "ready", "guest not ready at " + where);
  assert.equal(p.host.seq(), p.guest.seq(), "sequence diverged at " + where);
  assert.equal(p.host.hash(), p.guest.hash(),
    "STATE DIVERGED at " + where + ": " + W.diffPaths(p.host.state(), p.guest.state()).join(", "));
};

/* Drive a whole chain link across the network, from WHICHEVER SEAT holds
   the turn — the point of the exercise is that both seats are real, so a
   helper that always attacks from seat 0 stops committing anything the
   moment the turn passes. Returns the number of actions committed. */
function playLink(p){
  const st = () => p.host.state();
  const tp = st().turnPlayer, di = 1 - tp;
  const atk = tp === 0 ? p.host : p.guest;
  const def = tp === 0 ? p.guest : p.host;
  let n = 0;
  const go = (s, a) => { const e = s.submit(a); if(!e) n++; return e; };
  if(!st().sides[tp].hand.length) return n;
  go(atk, {t: "attack", uid: st().sides[tp].hand[0].uid});
  go(atk, {t: "pass"}); go(def, {t: "pass"});
  if(st().sides[di].hand.length) go(def, {t: "defend", uids: [st().sides[di].hand[0].uid]});
  for(let i = 0; i < 8 && st().chainOpen; i++){ go(atk, {t: "pass"}); go(def, {t: "pass"}); }
  return n;
}

/* Source scanning, minus comments — a header that says "nothing here
   calls setInterval" must not be what trips the drill that checks it. */
function codeOf(file){
  return fs.readFileSync(path.join(__dirname, "..", "engine", file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/* ---- the transport seam ---------------------------------------------- */

test("net.js names no transport — that is the whole point of the seam", () => {
  /* Phase B is WebRTC (GitHub Pages has no server to hold a WebSocket);
     Phase C is a WebSocket to an authoritative server. Both are adapters
     at the call site, so a dependency on either belongs nowhere in here. */
  const body = codeOf("net.js");
  for(const banned of ["RTCPeerConnection", "new WebSocket", "Trystero", "PeerJS", "fetch(", "XMLHttpRequest"]){
    assert.ok(body.indexOf(banned) < 0, "net.js code references " + banned);
  }
});

test("the module runs no timers of its own", () => {
  /* A backgrounded phone must not be declared dead by its own heartbeat.
     The app drives tick(); nothing in here schedules anything. */
  for(const banned of ["setInterval", "setTimeout", "requestAnimationFrame"]){
    assert.ok(codeOf("net.js").indexOf(banned) < 0, "net.js calls " + banned);
  }
});

test("every message on the wire survives a JSON round-trip", () => {
  const p = pair();
  playLink(p);
  const msgs = [...p.link.a.log, ...p.link.b.log];
  assert.ok(msgs.length > 10, "expected real traffic, got " + msgs.length);
  for(const m of msgs) assert.deepEqual(JSON.parse(JSON.stringify(m)), m, "unserializable: " + m.t);
});

/* ---- the handshake ---------------------------------------------------- */

test("a guest joins and lands on the host's exact game", () => {
  const p = pair({seed: "join"});
  agree(p, "handshake");
  assert.equal(p.guest.seat(), 1);
  assert.deepEqual(p.guest.state().sides[0].hand.map(c => c.uid),
                   p.host.state().sides[0].hand.map(c => c.uid));
});

test("a build mismatch is refused at the handshake, not discovered in play", () => {
  /* Different DATA_VER means different card data means a different game.
     Refusing here costs a message; discovering it on turn six costs the
     match, and there is nothing to point at when it happens. */
  const link = N.loopback();
  const mk = (end, seat, host, build) => {
    const s = N.createSession({seat, host, reduce: A.reduce, legal: A.legal, build,
      state: host ? A.newMatch({seed: "v"}) : null, send: m => end.send(m)});
    end.session = s; return s;
  };
  const host = mk(link.a, 0, true, "sage-v9");
  const guest = mk(link.b, 1, false, "sage-v8");
  guest.join();
  assert.equal(guest.status(), "refused");
  assert.equal(guest.state(), null, "a refused guest must not be holding a game");
});

test("different card data is refused at the handshake too", () => {
  const g0 = A.newMatch({seed: "cat"});
  const mine = W.makeCatalog(g0.sides[0].deck);
  const theirs = W.makeCatalog(g0.sides[0].deck.map(c => ({...c, power: c.power + 1})));
  const link = N.loopback();
  const mk = (end, seat, host, catalog) => {
    const s = N.createSession({seat, host, reduce: A.reduce, legal: A.legal, catalog,
      state: host ? g0 : null, send: m => end.send(m)});
    end.session = s; return s;
  };
  mk(link.a, 0, true, mine);
  const guest = mk(link.b, 1, false, theirs);
  guest.join();
  assert.equal(guest.status(), "refused");
});

/* ---- priority handoff, which is what the whole thing is for ----------- */

test("a seat that does not hold priority is refused BEFORE anything is sent", () => {
  const p = pair({seed: "pri"});
  const sentBefore = p.link.b.log.length;
  const why = p.guest.submit({t: "pass"});
  assert.match(why, /does not hold priority/);
  assert.equal(p.link.b.log.length, sentBefore, "an illegal tap must not leave the phone");
  agree(p, "after a local refusal");
});

test("priority crosses the network and the other seat can then act", () => {
  const p = pair({seed: "handoff"});
  assert.equal(p.guest.state().priority, 0);
  assert.equal(p.host.submit({t: "attack", uid: p.host.state().sides[0].hand[0].uid}), null);
  assert.equal(p.host.submit({t: "pass"}), null);
  /* the pass slid priority to seat 1, and the GUEST's copy knows it */
  assert.equal(p.guest.state().priority, 1);
  assert.equal(p.guest.submit({t: "pass"}), null, "seat 1 should now be able to act");
  agree(p, "after the handoff");
});

test("a guest action goes through the sequencer and lands on both peers", () => {
  const p = pair({seed: "guest-act"});
  p.host.submit({t: "attack", uid: p.host.state().sides[0].hand[0].uid});
  p.host.submit({t: "pass"});
  const uid = p.guest.state().sides[1].hand[0].uid;
  p.guest.submit({t: "pass"});
  p.guest.submit({t: "defend", uids: [uid]});
  assert.deepEqual(p.host.state().sides[1].blockH, [uid], "the host applied the guest's declaration");
  agree(p, "after a guest action");
});

test("the host refuses an illegal intent from a buggy or stale guest", () => {
  /* The guest checks legality locally, but the sequencer checks again —
     a client that skips its own check cannot push a bad action into the
     shared log. Same predicate both ends. */
  const p = pair({seed: "nack"});
  p.host.receive({t: "intent", id: 99, seat: 1, action: {t: "pitch", uid: p.host.state().sides[1].hand[0].uid}});
  const nack = p.link.a.log.filter(m => m.t === "nack").pop();
  assert.ok(nack, "expected a nack");
  assert.match(nack.reason, /does not hold priority/);
  agree(p, "after a nack");
});

/* ---- THE ONE PLACE TWO SEATS CAN ACT AT ONCE -------------------------- */

test("the defend-step race resolves identically on both peers", () => {
  /* CR 7.3.2 makes declaring defenders free and simultaneous; CR 7.3.3
     gives the TURN-PLAYER a priority window in that same step. So in the
     defend step — and nowhere else in this action set — both seats can
     legally act at the same instant.
     Without a sequencer each peer would apply its own action first and
     the two would order the pair differently. This is the drill that
     says the sequencer earns its place. */
  const p = pair({seed: "race"});
  p.host.submit({t: "attack", uid: p.host.state().sides[0].hand[0].uid});
  p.host.submit({t: "pass"}); p.guest.submit({t: "pass"});
  assert.equal(p.host.state().step, "defend");

  const uid = p.guest.state().sides[1].hand[0].uid;
  p.link.b.delay = true;                    /* hold the guest's intent in flight */
  p.guest.submit({t: "defend", uids: [uid]});
  p.host.submit({t: "pass"});               /* the host acts in the same instant */
  p.link.b.delay = false; p.link.b.flush(); /* now the guest's intent arrives */

  agree(p, "after the simultaneous defend-step actions");
  const order = p.link.a.log.filter(m => m.t === "commit").map(m => m.seat + ":" + m.action.t);
  assert.deepEqual(order.slice(-2), ["0:pass", "1:defend"],
    "the sequencer's order is the order, and both peers applied it");
  assert.deepEqual(p.guest.state().sides[1].blockH, [uid]);

  /* PREVENTED, NOT REPAIRED — and this pair of assertions is the whole
     drill. Without them it passes either way: a peer that applies its own
     action optimistically diverges here, gets caught by the hash on the
     next commit, and is snapped back into line, so the end state agrees
     and the test goes green having proved nothing. Ordering is supposed
     to make the divergence impossible, not survivable. */
  assert.equal(p.guest.stats().desyncs, 0, "the sequencer must PREVENT divergence, not repair it");
  assert.equal(p.guest.stats().resyncs, 0, "no repair should have been needed");
});

/* ---- determinism over many passes ------------------------------------- */

test("sixty alternating actions leave the two peers byte-identical", () => {
  const p = pair({seed: "long-game"});
  let acted = 0;
  for(let turn = 0; turn < 6; turn++){
    acted += playLink(p);
    agree(p, "turn " + turn + " chain");
    const tp = p.host.state().turnPlayer;
    const me = tp === 0 ? p.host : p.guest;
    if(!me.submit({t: "roll", sides: 6})) acted++;
    if(!me.submit({t: "endTurn"})) acted++;
    agree(p, "turn " + turn + " handoff");
    if(p.host.state().over) break;
  }
  assert.ok(acted >= 60, "expected 60+ committed actions, got " + acted);
  assert.equal(p.host.state().rng.n, p.guest.state().rng.n, "the seeded stream diverged");
  assert.equal(p.host.stats().desyncs, 0);
  assert.equal(p.guest.stats().desyncs, 0);
});

test("a game is its seed plus its action log — replay reproduces it exactly", () => {
  /* rng.js's first stated payoff, and the property that makes a bug
     report reproducible instead of a screenshot to squint at. */
  const p = pair({seed: "replay", first: 0});
  playLink(p);
  p.host.submit({t: "roll", sides: 6});
  p.host.submit({t: "endTurn"});
  playLink(p);

  const log = p.link.a.log.filter(m => m.t === "commit");
  assert.ok(log.length > 15, "expected a real log, got " + log.length);
  let g = A.newMatch({seed: "replay", first: 0});
  for(const c of log){
    const r = A.reduce(g, c.action, c.seat);
    assert.equal(r.error, null, "replay refused " + c.action.t + " at seq " + c.seq);
    g = r.state;
  }
  assert.equal(W.hash(g), p.host.hash(), "replay diverged from the live game");
});

test("two independent matches from one seed and one script agree", () => {
  /* The lockstep requirement stated directly: two clients must derive the
     same shuffle from the same seed, or the boards differ on turn one. */
  const run = () => { const p = pair({seed: "lockstep"}); playLink(p); return p.host.hash(); };
  assert.equal(run(), run());
});

/* ---- when the network misbehaves -------------------------------------- */

test("a dropped commit is detected as a gap and repaired from the journal", () => {
  const p = pair({seed: "loss"});
  playLink(p);
  agree(p, "before the loss");

  p.link.a.drop = true;                       /* the guest misses three commits */
  p.host.submit({t: "roll", sides: 6});
  p.host.submit({t: "roll", sides: 6});
  p.host.submit({t: "roll", sides: 6});
  p.link.a.drop = false;
  assert.notEqual(p.host.seq(), p.guest.seq(), "the guest should be behind");

  p.host.submit({t: "roll", sides: 6});       /* the next commit exposes the gap */
  agree(p, "after the repair");
  const ev = p.events.b.map(e => e.t);
  assert.ok(ev.includes("resync-requested"), "expected a resync: " + ev.join(","));
  assert.ok(ev.includes("catchup-applied"), "a small gap should replay commits, not ship the board");
  assert.equal(p.guest.stats().snapshots, 0, "no snapshot should have been needed");
});

test("a gap too large for the journal falls back to a snapshot", () => {
  const p = pair({seed: "biggap"});
  p.link.a.drop = true;
  for(let i = 0; i < N.JOURNAL + 5; i++) p.host.submit({t: "roll", sides: 6});
  p.link.a.drop = false;
  p.host.submit({t: "roll", sides: 6});
  agree(p, "after the snapshot");
  assert.ok(p.events.b.some(e => e.t === "snapshot-applied"),
    "expected a snapshot once the journal could not cover the gap");
});

test("a duplicated commit is applied exactly once", () => {
  const p = pair({seed: "dup"});
  p.host.submit({t: "roll", sides: 6});
  const commit = p.link.a.log.filter(m => m.t === "commit").pop();
  const before = p.guest.hash(), seqBefore = p.guest.seq();
  p.guest.receive(JSON.parse(JSON.stringify(commit)));
  assert.equal(p.guest.seq(), seqBefore, "a replayed commit must not advance the sequence");
  assert.equal(p.guest.hash(), before);
  agree(p, "after a duplicate");
});

/* ---- THE DESYNC CANARY ------------------------------------------------ */

test("a diverged peer is caught on the very next commit and repaired", () => {
  /* The roadmap: silent desync is the characteristic failure of lockstep
     netcode and it is miserable to debug after the fact. So it is not
     allowed to be silent, and it is not allowed to persist. */
  const p = pair({seed: "desync"});
  playLink(p);
  agree(p, "before the corruption");

  p.guest.state().sides[0].hp -= 5;           /* the guest's board is now wrong */
  assert.notEqual(p.host.hash(), p.guest.hash());

  p.host.submit({t: "roll", sides: 6});       /* the next commit carries the truth */
  assert.equal(p.guest.stats().desyncs, 1, "the mismatch must be noticed");
  agree(p, "after the repair");
});

test("a desync reports the FIELD that diverged, not two hex strings", () => {
  /* The payoff function. `sides/0/hp` is a five-minute fix; "the hashes
     differ" is an evening. */
  const p = pair({seed: "diag"});
  playLink(p);
  p.guest.state().sides[0].hp -= 5;
  p.host.submit({t: "roll", sides: 6});
  const resolved = p.events.b.find(e => e.t === "desync-resolved");
  assert.ok(resolved, "expected a desync-resolved event");
  assert.ok(resolved.paths.includes("/sides/0/hp"),
    "expected the hp path, got: " + resolved.paths.join(", "));
});

test("a diverged peer takes a snapshot, not a log replay", () => {
  /* Replaying the same actions over the same wrong state reproduces the
     same wrong answer. And a diverged peer is level on `seq`, so the
     cheap path would conclude it needs nothing at all. */
  const p = pair({seed: "force"});
  playLink(p);
  p.guest.state().sides[1].hp -= 3;
  p.host.submit({t: "roll", sides: 6});
  agree(p, "after the forced snapshot");
  assert.ok(p.events.b.some(e => e.t === "snapshot-applied"));
  assert.ok(p.events.b.some(e => e.t === "resync-requested" && e.force === true));
});

test("a peer whose reducer disagrees stops trusting itself", () => {
  const link = N.loopback();
  const state = A.newMatch({seed: "disagree", first: 0});
  const host = N.createSession({seat: 0, host: true, reduce: A.reduce, legal: A.legal,
    state, send: m => link.a.send(m)});
  const events = [];
  /* A guest running a reducer that refuses what the sequencer accepted —
     the shape of two clients on different builds. */
  const guest = N.createSession({seat: 1, host: false, legal: A.legal,
    reduce: (s, a, seat) => a.t === "roll" ? {state: s, error: "this build has no roll"} : A.reduce(s, a, seat),
    send: m => link.b.send(m), onEvent: e => events.push(e)});
  link.a.session = host; link.b.session = guest;
  guest.join();
  host.submit({t: "roll", sides: 6});
  assert.ok(events.some(e => e.t === "resync-requested" && /reducer disagreed/.test(e.reason)));
  assert.ok(events.some(e => e.t === "snapshot-applied"));
  assert.equal(host.hash(), guest.hash(), "the snapshot should have restored agreement");
});

/* ---- reconnect -------------------------------------------------------- */

test("a phone that dropped out rejoins mid-match on one snapshot", () => {
  /* Phones background aggressively and kill channels. On mobile this is
     normal operation, not an error case. */
  const p = pair({seed: "reconnect"});
  playLink(p);
  p.host.submit({t: "roll", sides: 6});
  const at = p.host.seq(), truth = p.host.hash();

  /* the guest's phone dies and comes back as a brand-new session */
  const events = [];
  const fresh = N.createSession({seat: 1, host: false, reduce: A.reduce, legal: A.legal,
    send: m => p.link.b.send(m), onEvent: e => events.push(e)});
  p.link.b.session = fresh;
  fresh.join();

  assert.equal(fresh.status(), "ready");
  assert.equal(fresh.seq(), at, "the rejoining peer must land on the current sequence");
  assert.equal(fresh.hash(), truth);
  assert.ok(events.some(e => e.t === "snapshot-applied"));

  /* and it can play on from there */
  assert.equal(p.host.submit({t: "endTurn"}), null);
  assert.equal(fresh.hash(), p.host.hash());
});

/* ---- flow control ----------------------------------------------------- */

test("a double tap queues instead of racing", () => {
  const p = pair({seed: "doubletap"});
  const hand = p.guest.state().sides[1].hand;
  p.host.submit({t: "attack", uid: p.host.state().sides[0].hand[0].uid});
  p.host.submit({t: "pass"});
  p.link.b.delay = true;
  p.guest.submit({t: "pass"});                /* first: in flight */
  p.guest.submit({t: "pass"});                /* second: queued, not sent */
  assert.equal(p.link.b.log.filter(m => m.t === "intent").length, 1,
    "only one intent may be in flight");
  p.link.b.delay = false; p.link.b.flush();
  agree(p, "after the first intent");
  p.link.b.flush();                           /* the queued one follows */
  agree(p, "after the queued intent");
  assert.ok(hand.length > 0);
});

test("the heartbeat measures a round trip and nothing else", () => {
  const p = pair({seed: "ping"});
  const before = p.host.hash();
  p.host.tick();
  assert.equal(p.host.hash(), before, "a ping must not touch game state");
  assert.equal(p.host.seq(), p.guest.seq());
  assert.ok(p.link.a.log.some(m => m.t === "ping"));
  assert.ok(p.link.b.log.some(m => m.t === "pong"));
});

/* ---- the snapshot itself ---------------------------------------------- */

test("a snapshot is one JSON object and the ref mode shrinks it", () => {
  const g = A.newMatch({seed: "size"});
  const all = [...g.sides[0].deck, ...g.sides[0].hand, ...g.sides[1].deck, ...g.sides[1].hand];
  const p = pair({seed: "size", state: g});
  const full = p.host.snapshot();
  assert.equal(typeof full, "object");
  assert.deepEqual(JSON.parse(JSON.stringify(full)), full, "a snapshot must be plain JSON");

  const withCat = pair({seed: "size", state: g, catalog: W.makeCatalog(all)});
  agree(withCat, "ref-mode handshake");
  assert.ok(W.sizeOf(withCat.host.snapshot()) < W.sizeOf(full),
    "a shared catalog should keep definitions off the wire");
});

test("the session reports what it has done, for the JUDGE!! report", () => {
  const p = pair({seed: "stats"});
  playLink(p);
  const s = p.host.stats();
  assert.ok(s.commits > 5);
  assert.ok(s.bytesOut > 0);
  assert.equal(s.desyncs, 0);
  assert.equal(p.host.isHost(), true);
  assert.equal(p.guest.isHost(), false);
});
