/* ============================================================
   Dawnblade engine — net.js (Phase B, roadmap steps 7 & 8)

   TWO PHONES, ONE GAME.

   ---- THE TRANSPORT RECOMMENDATION ------------------------------------

   The question was WebSockets or something else. For Phase B — friend vs
   friend, no accounts — it is **WebRTC DataChannel**, and the reason is
   not preference, it is the hosting:

     GitHub Pages serves static files. There is nothing there to terminate
     a WebSocket. A `ws://` transport is not a different library, it is a
     backend to build, pay for and keep awake — which is Phase C's job
     (ROADMAP-MULTIPLAYER.md step 9), not Phase B's.

   WebRTC gets two phones talking with no backend at all: a room code, a
   free signalling relay, and a peer-to-peer channel. Trystero or PeerJS,
   both CDN-loadable, both no build step. Configure the channel RELIABLE
   and ORDERED — a turn-based game wants correctness, not latency, and
   this module assumes in-order delivery (a gap is treated as a dead
   channel and triggers a resync rather than being reassembled).

   AND YET THIS MODULE MENTIONS NEITHER. It takes a `send` function and
   exposes a `receive` method; that is the entire transport contract.
   Three reasons that seam earns its keep:

     1. Phase C wants a WebSocket to an authoritative server. Same seam,
        a ~15-line adapter — `wsAdapter` below is that adapter, written.
     2. It is testable headlessly. `loopback()` wires two sessions
        together in memory, with drop and delay controls, so packet loss
        and reconnect are drilled instead of hoped for.
     3. Nothing here can be broken by a CDN library changing its API.

   ---- WHY THERE IS A SEQUENCER ----------------------------------------

   Both peers run the same reducer over the same ordered action log from
   the same seed, which needs a TOTAL ORDER on actions. In this game the
   order is very nearly free, because **priority is the lock**: the rules
   already guarantee that at most one seat may act at a time, so there is
   almost nothing to arbitrate.

   Almost. CR 7.3.2 makes declaring defenders a free, simultaneous
   game-state action, and CR 7.3.3 gives the turn-player a priority window
   in that same defend step. So in exactly one step of the game, both
   seats can legally act at the same instant — the defender declaring
   blockers while the attacker plays an instant. Two peers each applying
   their own action first would diverge right there.

   So one peer (the room host) is the SEQUENCER. It assigns the order and
   nothing else. It is deliberately NOT authoritative over outcomes: both
   peers run the identical reducer and both verify the result. That
   distinction is what keeps Phase C's move to a real server a RELOCATION
   of the sequencer rather than a rewrite of the client.

   NO CLIENT-SIDE PREDICTION. The guest waits for the commit before
   applying its own action. Prediction buys ~100ms on a turn-based game
   and costs rollback, which is where lockstep implementations go to die.

   ---- THE DESYNC CANARY -----------------------------------------------

   Every commit carries the sequencer's post-apply state hash. The
   follower applies, hashes, compares, and on mismatch stops trusting
   itself and resyncs. The roadmap is blunt about why this is not optional
   — "silent desync is the characteristic failure of lockstep netcode and
   it is miserable to debug after the fact" — so when it fires, the
   session keeps the state it had, diffs it against the snapshot that
   fixes it, and reports the PATHS that differed. A mismatch therefore
   arrives as `sides/1/grave/0/uid` rather than as two hex strings.

   RESYNC IS CHEAP FIRST, EXPENSIVE SECOND. The sequencer keeps a journal
   of recent commits; a peer that missed three actions is sent those three
   actions (~100 bytes), not the whole board (~20-100KB). A peer that has
   fallen further behind, or that has actually diverged, gets a snapshot.
   Phones background aggressively and drop channels — on mobile this path
   is normal operation, not an error case.

   ---- NO TIMERS -------------------------------------------------------
   Nothing here calls setInterval. Heartbeats are driven by the app
   calling `tick()`, which keeps the module testable and keeps a
   backgrounded phone from being declared dead by its own code.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./wire.js"));
  else root.DawnNet = factory(root.DawnWire);
})(typeof self!=="undefined" ? self : this, function(W){

const PROTO = W.PROTO;

/* Message types. Kept short because every one of them crosses a phone
   network, and flat because a discriminated union is all this needs. */
const MSG = {
  HELLO:    "hello",     /* guest -> host: I would like to play            */
  WELCOME:  "welcome",   /* host -> guest: accepted (or refused, and why)  */
  SNAPSHOT: "snapshot",  /* host -> guest: the whole game, one JSON object */
  INTENT:   "intent",    /* guest -> host: I would like to do this         */
  COMMIT:   "commit",    /* host -> all:   this happened, at this sequence */
  NACK:     "nack",      /* host -> guest: refused, and why                */
  RESYNC:   "resync",    /* peer -> host:  I am at N, catch me up          */
  CATCHUP:  "catchup",   /* host -> peer:  here are the commits you missed */
  PING:     "ping",
  PONG:     "pong"
};

/* How many commits the sequencer keeps for cheap catch-up. Twenty is
   several turns of a real game and a few KB of memory; past that a
   snapshot is both simpler and smaller than the replay would be. */
const JOURNAL = 20;

function createSession(o){
  o = o || {};
  const seat    = o.seat != null ? o.seat : 0;
  const host    = !!o.host;
  const reduce  = o.reduce;
  const legal   = o.legal || (() => null);
  const catalog = o.catalog || null;
  const send    = o.send || (() => {});
  const onState = o.onState || (() => {});
  const onEvent = o.onEvent || (() => {});
  /* Pins what "the same game" means. Two clients on different card data
     rehydrate bare dictionary keys into different cards, so this is
     checked at the handshake and the match is refused rather than played
     to a silent divergence. DATA_VER belongs here. */
  const build   = o.build || null;

  if(typeof reduce !== "function") throw new Error("net: a reduce(state, action, seat) is required");

  let state    = o.state || null;
  let seq      = 0;
  let status   = host ? "ready" : "new";
  let journal  = [];                 /* host only: recent commits, for catch-up */
  let inflight = null;               /* guest only: the intent awaiting a commit */
  let queued   = [];                 /* guest only: submits made while one is in flight */
  let nextId   = 1;
  let suspect  = null;               /* the state we no longer trust, kept for the diff */
  const stats  = {sent: 0, recv: 0, commits: 0, desyncs: 0, resyncs: 0, nacks: 0,
                  snapshots: 0, bytesOut: 0, rtt: null};

  const out = m => { stats.sent++; stats.bytesOut += JSON.stringify(m).length; send(m); };
  const evt = (t, d) => onEvent({t, seat, seq, ...(d || {})});

  const snapshotMsg = () => {
    const wire = W.encode(state, {catalog});
    stats.snapshots++;
    return {t: MSG.SNAPSHOT, seq, wire, size: W.sizeOf(wire)};
  };

  /* Apply one action locally. The single funnel — local submits, remote
     commits and catch-up replays all land here, so there is exactly one
     description of how an action becomes a state. */
  function apply(action, bySeat, source, atSeq){
    const r = reduce(state, action, bySeat);
    if(r.error) return r.error;
    state = r.state;
    seq = atSeq != null ? atSeq : seq + 1;
    onState(state, {seq, action, seat: bySeat, source, hash: W.hash(state)});
    return null;
  }

  /* ---- the sequencer side -------------------------------------------- */
  function sequence(action, bySeat, id){
    const why = legal(state, action, bySeat);
    if(why){ stats.nacks++; out({t: MSG.NACK, id, reason: why}); evt("refused", {reason: why, action}); return why; }
    const err = apply(action, bySeat, bySeat === seat ? "local" : "remote");
    if(err){ stats.nacks++; out({t: MSG.NACK, id, reason: err}); return err; }
    const commit = {t: MSG.COMMIT, seq, seat: bySeat, action, id, h: W.hash(state)};
    journal.push(commit);
    if(journal.length > JOURNAL) journal = journal.slice(-JOURNAL);
    stats.commits++;
    out(commit);
    return null;
  }

  /* ---- the public surface -------------------------------------------- */

  /* Offer an action. The guest checks legality locally FIRST so an
     illegal tap never leaves the phone, then waits for the sequencer. */
  function submit(action){
    if(status !== "ready") return "session is " + status;
    const why = legal(state, action, seat);
    if(why){ evt("refused", {reason: why, action, local: true}); return why; }
    if(host) return sequence(action, seat, 0);
    /* One in flight at a time. A double-tap therefore queues instead of
       racing, and the second submit is re-checked against the state the
       first one produced — which is the state it will actually run on. */
    if(inflight){ queued.push(action); return null; }
    inflight = {id: nextId++, action};
    out({t: MSG.INTENT, id: inflight.id, seat, action});
    return null;
  }

  function pump(){
    if(host || inflight || !queued.length || status !== "ready") return;
    const a = queued.shift();
    const why = legal(state, a, seat);
    if(why){ evt("refused", {reason: why, action: a, local: true}); return pump(); }
    inflight = {id: nextId++, action: a};
    out({t: MSG.INTENT, id: inflight.id, seat, action: a});
  }

  /* `force` demands a snapshot instead of a log replay. THE TWO CASES ARE
     NOT INTERCHANGEABLE. A peer that merely MISSED actions can be sent
     those actions. A peer whose state has actually diverged cannot: it
     would replay the same log over the same wrong state and arrive at the
     same wrong answer, having spent a round trip to learn nothing. And it
     is already level with the sequencer on `seq`, so the cheap path would
     decide it needs nothing at all and send silence. */
  function requestResync(reason, force){
    stats.resyncs++;
    status = "resyncing";
    evt("resync-requested", {reason, have: seq, force: !!force});
    out({t: MSG.RESYNC, have: seq, seat, force: !!force});
  }

  function adopt(wire, atSeq){
    const before = suspect || state;
    state = W.decode(wire, {catalog});
    seq = atSeq;
    status = "ready";
    inflight = null;
    /* THE PAYOFF. A hash mismatch names two hex strings; this names the
       fields. Only computed when we actually distrusted ourselves, so a
       clean first join pays nothing for it. */
    if(suspect){
      const paths = W.diffPaths(suspect, state);
      evt("desync-resolved", {paths});
      suspect = null;
    }
    onState(state, {seq, action: null, seat: null, source: "snapshot", hash: W.hash(state)});
    pump();
  }

  function receive(m){
    if(!m || typeof m !== "object") return;
    stats.recv++;
    switch(m.t){

      case MSG.HELLO: {
        if(!host) return;
        const why = vet(m);
        if(why){ status = "refused"; out({t: MSG.WELCOME, accepted: false, reason: why}); evt("refused-peer", {reason: why}); return; }
        out({t: MSG.WELCOME, accepted: true, seat: 1 - seat, proto: PROTO, wireV: W.WIRE_V, seq});
        out(snapshotMsg());
        evt("peer-joined", {});
        return;
      }

      case MSG.WELCOME: {
        if(!m.accepted){ status = "refused"; evt("refused-by-host", {reason: m.reason}); return; }
        status = "handshaking";
        return;
      }

      case MSG.SNAPSHOT: {
        try { adopt(m.wire, m.seq); evt("snapshot-applied", {size: m.size}); }
        /* A snapshot that will not decode is fatal and must say so: the
           alternative is playing on against a state we know is wrong. */
        catch(e){ status = "refused"; evt("snapshot-failed", {reason: String(e.message || e)}); }
        return;
      }

      case MSG.INTENT: {
        if(!host) return;                       /* only the sequencer orders */
        if(status !== "ready") return;
        sequence(m.action, m.seat, m.id);
        return;
      }

      case MSG.COMMIT: {
        if(host) return;                        /* the sequencer authored it */
        if(m.id && inflight && inflight.id === m.id) inflight = null;
        /* A repair is already in flight and will bring us current. Applying
           commits underneath it would race the snapshot and could wind the
           sequence backwards when it lands. */
        if(status === "resyncing") return;
        if(m.seq <= seq) return;                /* duplicate — apply-once by seq */
        if(m.seq !== seq + 1){                  /* a gap: the channel dropped something */
          requestResync("sequence gap: at " + seq + ", received " + m.seq);
          return;
        }
        const err = apply(m.action, m.seat, m.seat === seat ? "local" : "remote", m.seq);
        if(err){
          /* The sequencer accepted an action this peer's reducer rejects.
             The two are running different code or different state; either
             way this peer is no longer entitled to an opinion. */
          suspect = state;
          requestResync("reducer disagreed: " + err, true);
          return;
        }
        const mine = W.hash(state);
        if(m.h && m.h !== mine){
          stats.desyncs++;
          suspect = state;
          evt("desync", {expected: m.h, local: mine, action: m.action});
          requestResync("state hash mismatch at seq " + m.seq, true);
          return;
        }
        stats.commits++;
        pump();
        return;
      }

      case MSG.NACK: {
        stats.nacks++;
        if(inflight && inflight.id === m.id) inflight = null;
        evt("nacked", {reason: m.reason});
        pump();
        return;
      }

      case MSG.RESYNC: {
        if(!host) return;
        const from = m.have | 0;
        const have = journal.length ? journal[0].seq : seq + 1;
        /* FORCE IS CHECKED FIRST, and that ordering is the whole fix. A
           peer that has DIVERGED is usually level on `seq` — it applied
           the action, it just got a different answer — so every cheap
           test says it needs nothing, or needs a replay of a log it has
           already run. Sending that replay makes it fail identically and
           ask again: a repair loop that never terminates and never says
           why. It asked for the board; give it the board. */
        if(m.force){ out(snapshotMsg()); evt("snapshot-sent", {from, forced: true}); return; }
        /* Otherwise cheap first: a peer three actions behind costs a few
           hundred bytes of commits instead of the whole board. */
        if(from >= have - 1 && from < seq){
          out({t: MSG.CATCHUP, from, commits: journal.filter(c => c.seq > from)});
          evt("catchup-sent", {from, count: seq - from});
        } else if(from < seq){
          out(snapshotMsg());
          evt("snapshot-sent", {from});
        }
        return;
      }

      case MSG.CATCHUP: {
        if(host) return;
        for(const c of m.commits || []){
          if(c.seq <= seq) continue;
          if(c.seq !== seq + 1){ requestResync("catch-up gap"); return; }
          const err = apply(c.action, c.seat, "remote", c.seq);
          if(err || (c.h && W.hash(state) !== c.h)){
            suspect = state;
            /* `force` skips straight to a snapshot: replaying the log
               again would reproduce exactly the same divergence. */
            stats.resyncs++; status = "resyncing";
            out({t: MSG.RESYNC, have: seq, seat, force: true});
            evt("catchup-failed", {at: c.seq});
            return;
          }
        }
        status = "ready";
        evt("catchup-applied", {to: seq});
        pump();
        return;
      }

      case MSG.PING:  out({t: MSG.PONG, t0: m.t0}); return;
      case MSG.PONG:  if(m.t0 != null) stats.rtt = now() - m.t0; return;
    }
  }

  /* The handshake is where a mismatched build is caught. Every one of
     these refusals is a silent divergence that did not happen. */
  function vet(m){
    if(m.proto !== PROTO)     return "protocol mismatch: " + m.proto + " vs " + PROTO;
    if(m.wireV !== W.WIRE_V)  return "wire version mismatch: v" + m.wireV + " vs v" + W.WIRE_V;
    if(build && m.build && m.build !== build)
      return "build mismatch: " + m.build + " vs " + build + " — check APP_VER / DATA_VER on both clients";
    const mine = catalog ? W.catalogHash(catalog) : null;
    if(mine && m.catalog && mine !== m.catalog)
      return "card data mismatch — one client is on a stale DATA_VER cache";
    if(m.seat === seat) return "seat " + seat + " is taken";
    return null;
  }

  const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  return {
    /* the guest opens the conversation */
    join(){
      if(host) return;
      status = "handshaking";
      out({t: MSG.HELLO, proto: PROTO, wireV: W.WIRE_V, seat, build,
           catalog: catalog ? W.catalogHash(catalog) : null});
    },
    submit, receive,
    /* Heartbeat, driven by the app rather than a timer in here. A phone
       that backgrounds mid-match often leaves a half-open channel that
       never fires onclose, so a missing pong is the real liveness signal. */
    tick(){ if(status === "ready") out({t: MSG.PING, t0: now()}); },
    resync(){ requestResync("requested by the app"); },

    state:    () => state,
    seq:      () => seq,
    seat:     () => seat,
    isHost:   () => host,
    status:   () => status,
    hash:     () => (state ? W.hash(state) : null),
    snapshot: () => W.encode(state, {catalog}),
    stats:    () => ({...stats}),
    /* Load a state into a fresh host — used when the match begins, and by
       drills that want a pinned board. */
    load(s){ state = s; seq = 0; journal = []; status = host ? "ready" : status; }
  };
}

/* ---- transports ------------------------------------------------------ */

/* Two ends of a wire, in memory. Everything crossing it is round-tripped
   through JSON, so a message that would not survive a real channel fails
   here too rather than in the field. `drop` and `delay` are what let the
   drills exercise packet loss and reconnect deliberately. */
function loopback(){
  const ends = {};
  const mk = name => {
    const e = {
      name, peer: null, session: null, drop: false, delay: false,
      held: [], log: [],
      send(m){
        const wire = JSON.parse(JSON.stringify(m));
        e.log.push(wire);
        if(e.drop) return;
        if(e.delay){ e.held.push(wire); return; }
        if(e.peer && e.peer.session) e.peer.session.receive(wire);
      },
      /* release anything held while `delay` was on, in order */
      flush(){
        const q = e.held; e.held = [];
        for(const m of q) if(e.peer && e.peer.session) e.peer.session.receive(m);
      }
    };
    return e;
  };
  ends.a = mk("a"); ends.b = mk("b");
  ends.a.peer = ends.b; ends.b.peer = ends.a;
  return ends;
}

/* Phase C's adapter, written now so the seam is proven rather than
   promised. Works with a browser WebSocket or any object with the same
   three members. */
function wsAdapter(socket){
  return {
    send: m => { if(socket.readyState === 1 || socket.readyState == null) socket.send(JSON.stringify(m)); },
    attach(session){
      socket.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch(_){ return; }
        session.receive(m);
      };
      return session;
    }
  };
}

/* WebRTC is not adapted here on purpose: the channel comes from a CDN
   library (Trystero, PeerJS) whose API this module must not depend on.
   The adapter is three lines at the call site —

     const s = DawnNet.createSession({..., send: m => channel.send(m)});
     channel.onmessage = m => s.receive(m);

   — and it belongs in the page that loaded the library, not in here. */

return {PROTO, MSG, JOURNAL, createSession, loopback, wsAdapter};
});
