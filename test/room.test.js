/* THE TABLE DRILLS (engine/room.js).

   This is the one engine file that knows a network exists, so it is the
   one that cannot be drilled against the real thing — a test suite must
   not depend on a public rendezvous being up. The Peer constructor is
   therefore injectable, exactly as net.js's `send` is, and these drills
   run a fake one.

   What is actually worth pinning here is not the happy path (two phones
   talk) but the answers: a taken table, an empty table, a dead relay, a
   third phone dialling in. Those are what a player sees. */
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../engine/room.js");
const N = require("../engine/net.js");
const A = require("../engine/actions.js");

/* A PeerJS stand-in. Two of these find each other through a shared
   registry, which is what the real rendezvous does. */
function fakePeerLib(){
  const registry = new Map();
  const mkConn = () => {
    const h = {};
    const c = {
      open: false, closed: false, peer: null, other: null,
      on(ev, fn){ (h[ev] = h[ev] || []).push(fn); return c; },
      fire(ev, d){ (h[ev] || []).forEach(fn => fn(d)); },
      send(m){ if(c.open && c.other) c.other.fire("data", JSON.parse(JSON.stringify(m))); },
      close(){
        if(c.closed) return;
        c.closed = true; c.open = false; c.fire("close");
        if(c.other && !c.other.closed) c.other.close();
      }
    };
    return c;
  };
  function Peer(id, opts){
    const self = this;
    const h = {};
    this.id = id || "rnd-" + Math.random().toString(36).slice(2);
    this.opts = opts;
    this.destroyed = false;
    this.lastConnectOpts = null;
    this.on = (ev, fn) => { (h[ev] = h[ev] || []).push(fn); return self; };
    this.fire = (ev, d) => (h[ev] || []).forEach(fn => fn(d));
    this.destroy = () => { self.destroyed = true; registry.delete(self.id); };
    this.connect = (target, o) => {
      self.lastConnectOpts = o;
      const host = registry.get(target);
      const mine = mkConn(), theirs = mkConn();
      mine.other = theirs; theirs.other = mine;
      /* PeerJS hands back a DataConnection either way and reports an
         unknown peer as an ERROR ON THE PEER, not as a null return. The
         fake has to do the same or room.js's real error path is never
         the one under test. */
      if(!host){ setTimeout(() => self.fire("error", {type: "peer-unavailable"}), 0); return mine; }
      setTimeout(() => {
        /* the host sees the connection BEFORE it opens, which is what
           lets it turn a third phone away */
        host.fire("connection", theirs);
        if(theirs.closed || mine.closed) return;
        theirs.open = true; theirs.fire("open");
        mine.open = true; mine.fire("open");
      }, 0);
      return mine;
    };
    setTimeout(() => {
      if(id && registry.has(id)){ self.fire("error", {type: "unavailable-id"}); return; }
      registry.set(self.id, self);
      self.fire("open", self.id);
    }, 0);
  }
  Peer.registry = registry;
  return Peer;
}

const tick = () => new Promise(r => setTimeout(r, 5));

/* ---- the code ---------------------------------------------------------- */

test("a table code is unambiguous when read aloud", () => {
  /* The code is read off one phone and typed into another across a table
     in bad light, so this matters more than entropy does. */
  for(const bad of ["I", "L", "O", "0", "1"])
    assert.ok(R.ALPHABET.indexOf(bad) < 0, bad + " is too easy to misread to be in a table code");
  for(let i = 0; i < 200; i++){
    const c = R.makeCode();
    assert.equal(c.length, R.CODE_LEN);
    assert.ok([...c].every(ch => R.ALPHABET.indexOf(ch) >= 0), "bad code: " + c);
  }
});

test("codes are forgiving about typing and strict about validity", () => {
  assert.equal(R.normalize("q7-fk"), "Q7FK");
  assert.equal(R.normalize(" q7 fk "), "Q7FK");
  assert.equal(R.normalize("Q7FK"), "Q7FK");
  assert.ok(R.isValid("q7-fk"));
  /* A dropped lookalike must fail rather than silently dial a shorter,
     different table. */
  assert.ok(!R.isValid("Q7F"));
  assert.ok(!R.isValid("QOIL"));
  assert.ok(!R.isValid(""));
});

test("the peer id is namespaced, because the relay is shared with the world", () => {
  /* An unqualified id of "42" would collide with a stranger's project and
     the failure would look like a Dawnblade bug. */
  const id = R.peerIdFor("q7fk");
  assert.ok(id.startsWith("dawnblade-"), id);
  assert.ok(id.includes(R.ROOM_V), "the id must carry a protocol version: " + id);
  assert.ok(id.endsWith("Q7FK"));
  assert.notEqual(R.peerIdFor("q7fk"), "Q7FK");
});

test("an invalid code is refused before any network work happens", async () => {
  await assert.rejects(() => R.open({code: "ABC", host: true, Peer: fakePeerLib()}), /ROOM-CODE/);
});

/* ---- what a player actually sees --------------------------------------- */

test("two phones meet at a table and can talk", async () => {
  const Peer = fakePeerLib();
  const seen = {host: [], guest: []};
  const hostP = R.open({code: "Q7FK", host: true, Peer, onMessage: m => seen.host.push(m)});
  await tick();
  const guest = await R.open({code: "q7-fk", host: false, Peer, onMessage: m => seen.guest.push(m)});
  const host = await hostP;

  assert.equal(host.status(), "connected");
  assert.equal(guest.status(), "connected");
  guest.send({t: "hello", n: 1});
  host.send({t: "welcome", n: 2});
  await tick();
  assert.deepEqual(seen.host, [{t: "hello", n: 1}]);
  assert.deepEqual(seen.guest, [{t: "welcome", n: 2}]);
});

test("the channel is opened RELIABLE and ORDERED", async () => {
  /* net.js treats a sequence gap as a dead channel rather than
     reassembling, so an unordered channel would resync in a loop.
     PeerJS does NOT default to reliable — it has to be asked. */
  const Peer = fakePeerLib();
  const hostP = R.open({code: "Q7FK", host: true, Peer});
  await tick();
  const guest = await R.open({code: "Q7FK", host: false, Peer});
  await hostP;
  assert.equal(guest.peer().lastConnectOpts.reliable, true,
    "an unordered channel would make net.js resync in a loop");
  assert.ok(Peer.registry.get(R.peerIdFor("Q7FK")), "the host should hold the table id");
});

test("a taken table says so, in a player's words", async () => {
  const Peer = fakePeerLib();
  R.open({code: "Q7FK", host: true, Peer});
  await tick();
  const states = [];
  await assert.rejects(
    () => R.open({code: "Q7FK", host: true, Peer, onStatus: (s, d) => states.push([s, d])}),
    /already taken/);
  assert.ok(states.some(([s]) => s === "error"));
});

test("an empty table says so instead of hanging", async () => {
  const Peer = fakePeerLib();
  await assert.rejects(() => R.open({code: "ZZ99", host: false, Peer}), /Nobody is sitting at table ZZ99/);
});

test("a dead relay is reported, not spun on", async () => {
  const Peer = fakePeerLib();
  const P2 = function(){ const self = this; const h = {};
    this.on = (e, f) => { (h[e] = h[e] || []).push(f); return self; };
    this.destroy = () => {};
    setTimeout(() => (h.error || []).forEach(f => f({type: "network"})), 0);
  };
  await assert.rejects(() => R.open({code: "Q7FK", host: true, Peer: P2}), /matchmaking relay/);
  assert.ok(Peer);
});

test("a third phone at the table is turned away, not seated", async () => {
  /* A second guest would become a second actor whose intents the
     sequencer would happily interleave into somebody else's match. */
  const Peer = fakePeerLib();
  const heard = [];
  const hostP = R.open({code: "Q7FK", host: true, Peer, onMessage: m => heard.push(m)});
  await tick();
  const g1 = await R.open({code: "Q7FK", host: false, Peer});
  const host = await hostP;
  await tick();

  /* The gatecrasher's channel is refused before it opens, so its open
     never resolves — hold it loosely rather than awaiting it. */
  let g2 = null;
  R.open({code: "Q7FK", host: false, Peer}).then(h => { g2 = h; }, () => {});
  await tick(); await tick();

  g1.send({t: "intent", from: "the opponent"});
  if(g2) g2.send({t: "intent", from: "gatecrasher"});
  await tick();

  assert.deepEqual(heard.map(m => m.from), ["the opponent"],
    "only the seated opponent may push into the match");
  assert.equal(host.status(), "connected");
  assert.equal(g1.status(), "connected");
});

test("closing a table tells the other phone", async () => {
  const Peer = fakePeerLib();
  const hostP = R.open({code: "Q7FK", host: true, Peer});
  await tick();
  let left = false;
  const guest = await R.open({code: "Q7FK", host: false, Peer, onClose: () => { left = true; }});
  const host = await hostP;
  host.close();
  await tick();
  assert.equal(host.status(), "closed");
  assert.ok(left, "the guest should have been told the table emptied");
});

/* ---- the seam to net.js ------------------------------------------------ */

test("a real match runs over a real table", async () => {
  /* The end-to-end shape: room.js supplies `send`, net.js supplies
     `receive`, actions.js supplies the rules, and the two phones agree.
     Every drill in net.test.js runs over the in-memory loopback; this is
     the one that runs over the transport. */
  const Peer = fakePeerLib();
  const code = "Q7FK";
  const sessions = {};
  const hostP = R.open({code, host: true, Peer, onMessage: m => sessions.host.receive(m)});
  await tick();
  const guestT = await R.open({code, host: false, Peer, onMessage: m => sessions.guest.receive(m)});
  const hostT = await hostP;

  sessions.host = N.createSession({seat: 0, host: true, reduce: A.reduce, legal: A.legal,
    state: A.newMatch({seed: code, first: 0}), send: m => hostT.send(m)});
  sessions.guest = N.createSession({seat: 1, host: false, reduce: A.reduce, legal: A.legal,
    send: m => guestT.send(m)});

  sessions.guest.join();
  await tick();
  assert.equal(sessions.guest.status(), "ready");
  assert.equal(sessions.host.hash(), sessions.guest.hash(), "the two phones must open on the same board");

  /* play a chain link across the wire */
  const st = () => sessions.host.state();
  sessions.host.submit({t: "attack", uid: st().sides[0].hand[0].uid});
  await tick();
  sessions.host.submit({t: "pass"});
  sessions.guest.submit({t: "pass"});
  await tick();
  sessions.guest.submit({t: "defend", uids: [st().sides[1].hand[0].uid]});
  await tick();
  for(let i = 0; i < 8 && st().chainOpen; i++){
    sessions.host.submit({t: "pass"});
    sessions.guest.submit({t: "pass"});
    await tick();
  }
  assert.equal(st().chainOpen, false, "the chain should have closed");
  assert.equal(sessions.host.hash(), sessions.guest.hash(), "the two phones diverged over the transport");
  assert.equal(sessions.guest.stats().desyncs, 0);
});

test("the table code is the match seed, so a game is reproducible from it", async () => {
  /* rng.js: both peers derive the same seed from the same room code
     without exchanging it. */
  const a = A.newMatch({seed: R.normalize("q7-fk"), first: 0});
  const b = A.newMatch({seed: "Q7FK", first: 0});
  assert.deepEqual(a.sides[0].hand.map(c => c.uid), b.sides[0].hand.map(c => c.uid));
  assert.notDeepEqual(a.sides[0].hand.map(c => c.uid),
                      A.newMatch({seed: "ZZ99", first: 0}).sides[0].hand.map(c => c.uid));
});
