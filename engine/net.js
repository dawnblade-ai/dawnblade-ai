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

   ---- REFEREE MODE (HIDDEN HANDS H2, `o.referee`) ----------------------
   Lockstep gives both phones the full state: the other hand, both decks'
   order and the seed (HIDDEN-HANDS.md §1). In referee mode the HOST runs
   `referee.js` on the full state and is the only phone that reduces; the
   guest holds a MIRROR of its own seat's view and applies per-seat commits
   (an action with slot handles, a delta, the view's fingerprint). The guest
   sends intents only, and the host refuses one that names the host's seat.
   The canary, the journal, catch-up and snapshots are the same machinery on
   views instead of states. The host's own screen gets ITS seat's view too.

   WHEN THE HOST DROPS the game PAUSES (`pause`): the guest cannot take over,
   because it holds no hidden card — that is the point. The host persists
   (`persist`) after every commit, a restarted host session takes it back
   (`o.restore`), and the guest's `join` lands it on SNAPSHOT(seatView).
   At game end the host sends REVEAL: the seed's secret half and the full
   log, so the guest can replay every shuffle (`referee.verifyGame`).

   ---- JUDGE MODE (HIDDEN HANDS H3, `createJudgeSession`) ---------------
   The same referee on a THIRD device: `refereeHost` with BOTH seats remote
   (the H2 host is that body with one seat remote and its own local), so
   neither player's phone holds the deck. Each player's phone is a plain
   referee guest and cannot tell a judge from a host. hub.js binds channels
   to seats and owns the lobby; this module only sees `receive(seat, m)`.

   ---- NO TIMERS -------------------------------------------------------
   Nothing here calls setInterval. Heartbeats are driven by the app
   calling `tick()`, which keeps the module testable and keeps a
   backgrounded phone from being declared dead by its own code.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./wire.js"), require("./referee.js"));
  else root.DawnNet = factory(root.DawnWire, root.DawnReferee);
})(typeof self!=="undefined" ? self : this, function(W, R){

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
  REVEAL:   "reveal",    /* host -> guest: the game is over; the seed and the full log */
  PART:     "part",      /* host -> guest: one piece of a message too big for one frame */
  PING:     "ping",
  PONG:     "pong"
};

/* How many commits the sequencer keeps for cheap catch-up. Twenty is
   several turns of a real game and a few KB of memory; past that a
   snapshot is both simpler and smaller than the replay would be. */
const JOURNAL = 20;

/* THE LARGEST FRAME A REFEREE SESSION SENDS. test/table.test.js pins 16KB
   as what a WebRTC data channel carries reliably (a 97KB snapshot was once
   dropped with no error). A guest's view grows with the feed — a reconnect
   late in a game measured ~40KB — so a bigger message is sent in PARTs of
   this many characters and reassembled. */
const CHUNK = 12000;

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
  if(o.referee) return createRefereeSession(o);

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

/* ---- referee mode ------------------------------------------------------ */
/* THE REFEREE'S END OF THE WIRE, for any number of REMOTE seats (HIDDEN HANDS
   H2 and H3). The H2 host is this with one remote seat and its own seat local;
   the H3 JUDGE is this with both seats remote and no seat of its own. One body,
   so a judge cannot drift from the host it generalises.
   o: {state, reduce, legal, check, catalog, build, restore, remote: [seats],
       send(seat, m), onCommit(r, bySeat), onEvent(e)} */
function refereeHost(o){
  const remote  = (o.remote || []).slice();
  const legal   = o.legal || (() => null);
  const catalog = o.catalog || null;
  const build   = o.build || null;
  const sendTo  = o.send || (() => {});
  const onCommit = o.onCommit || (() => {});
  const evt     = o.onEvent || (() => {});
  /* `seatView`: the sabotage drills' seam (referee.js's), passed through */
  const ref = R.createReferee({state: o.state, reduce: o.reduce, legal, check: o.check || null, catalog, seatView: o.seatView});
  if(o.restore) ref.restore(decodeSaved(o.restore, catalog));
  const journal = {};               /* remote seat -> its recent commits, for catch-up */
  for(const s of remote) journal[s] = [];
  const stats = {sent: 0, recv: 0, commits: 0, desyncs: 0, resyncs: 0, nacks: 0, snapshots: 0, bytesOut: 0, rtt: null};
  const out = (seat, m) => { stats.sent++; stats.bytesOut += JSON.stringify(m).length; sendTo(seat, m); };
  const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  let revealedOut = null;

  const snapshotMsg = seat => {
    const snap = ref.snapshot(seat);
    stats.snapshots++;
    const wire = W.encode(snap.view, {catalog});
    return {t: MSG.SNAPSHOT, seq: snap.seq, wire, h: snap.h, size: W.sizeOf(wire)};
  };
  /* Send `m` whole, or in parts no bigger than CHUNK. */
  let partId = 0;
  const outBig = (seat, m) => {
    const str = JSON.stringify(m);
    if(str.length <= CHUNK) return out(seat, m);
    const id = ++partId, n = Math.ceil(str.length / CHUNK);
    for(let i = 0; i < n; i++) out(seat, {t: MSG.PART, id, i, n, s: str.slice(i * CHUNK, (i + 1) * CHUNK)});
  };

  /* one funnel, local and remote intents alike */
  function sequence(action, bySeat, id){
    const r = ref.intent(bySeat, action);
    if(r.error){ stats.nacks++; if(remote.indexOf(bySeat) >= 0) out(bySeat, {t: MSG.NACK, id, reason: r.error}); evt({t: "refused", seat: bySeat, reason: r.error, action}); return r.error; }
    for(const s of remote){
      const c = {t: MSG.COMMIT, id: s === bySeat ? id : 0, ...r.commits[s]};
      journal[s].push(c);
      if(journal[s].length > JOURNAL) journal[s] = journal[s].slice(-JOURNAL);
      out(s, c);
    }
    stats.commits++;
    onCommit(r, bySeat);
    return null;
  }

  function vet(m, chan){
    if(m.proto !== PROTO)     return "protocol mismatch: " + m.proto + " vs " + PROTO;
    if(m.wireV !== W.WIRE_V)  return "wire version mismatch: v" + m.wireV + " vs v" + W.WIRE_V;
    if(build && m.build && m.build !== build)
      return "build mismatch: " + m.build + " vs " + build + " — check APP_VER / DATA_VER on both clients";
    const mine = catalog ? W.catalogHash(catalog) : null;
    if(mine && m.catalog && mine !== m.catalog) return "card data mismatch — one client is on a stale DATA_VER cache";
    if(remote.indexOf(m.seat) < 0) return "seat " + m.seat + " is taken";
    if(chan != null && m.seat !== chan) return "this channel is seat " + chan + "'s";
    return null;
  }

  /* A frame from a remote seat. `chan` is the seat the channel belongs to
     (null: the one remote seat of an H2 host, which reads the seat off HELLO). */
  function receive(m, chan){
    if(!m || typeof m !== "object") return;
    stats.recv++;
    const seat = chan != null ? chan : remote[0];
    switch(m.t){
      case MSG.HELLO: {
        const why = vet(m, chan);
        if(why){ out(seat, {t: MSG.WELCOME, accepted: false, reason: why}); evt({t: "refused-peer", seat, reason: why}); return; }
        out(seat, {t: MSG.WELCOME, accepted: true, seat: m.seat, proto: PROTO, wireV: W.WIRE_V, seq: ref.seq(), referee: true});
        outBig(seat, snapshotMsg(seat));
        evt({t: "peer-joined", seat});
        if(ref.over() && revealedOut) outBig(seat, revealedOut);
        return;
      }
      case MSG.INTENT: {
        /* A PHONE ACTS FOR ITS OWN SEAT ONLY. In lockstep both phones ran
           the reducer and a forged seat desynced; here the referee's word is
           the game, so it checks. */
        if(m.seat !== seat){ stats.nacks++; out(seat, {t: MSG.NACK, id: m.id, reason: "you sit in seat " + seat}); return; }
        sequence(m.action, seat, m.id);
        return;
      }
      case MSG.RESYNC: {
        const from = m.have | 0, j = journal[seat], seq = ref.seq();
        const have = j.length ? j[0].seq : seq + 1;
        if(m.force){ outBig(seat, snapshotMsg(seat)); evt({t: "snapshot-sent", seat, from, forced: true}); return; }
        if(from >= have - 1 && from < seq){
          outBig(seat, {t: MSG.CATCHUP, from, commits: j.filter(c => c.seq > from)});
          evt({t: "catchup-sent", seat, from, count: seq - from});
        } else if(from !== seq){ outBig(seat, snapshotMsg(seat)); evt({t: "snapshot-sent", seat, from}); }
        return;
      }
      case MSG.PING:  out(seat, {t: MSG.PONG, t0: m.t0}); return;
      case MSG.PONG:  if(m.t0 != null) stats.rtt = now() - m.t0; return;
    }
  }

  return {
    ref, sequence, receive, stats: () => ({...stats}),
    ping(seat){ out(seat, {t: MSG.PING, t0: now()}); },
    /* once the game is over: the seed's secret half and the full log, to every remote seat */
    reveal(extra){
      if(!ref.over()) return "the game is not over";
      revealedOut = {t: MSG.REVEAL, seq: ref.seq(), log: ref.log(), over: JSON.parse(JSON.stringify(ref.state().over)), ...(extra || {})};
      for(const s of remote) outBig(s, revealedOut);
      return null;
    },
    persist: () => encodeSaved(ref.persist(), catalog)
  };
}

/* THE GUEST'S END: a MIRROR of its own seat's view, fed by commits. Never
   reduces. The same for an H2 guest (the host's referee) and an H3 player
   (the judge's): the guest cannot tell, and does not need to. */
function createRefereeSession(o){
  const seat    = o.seat != null ? o.seat : 0;
  const host    = !!o.host;
  const foe     = 1 - seat;
  const legal   = o.legal || (() => null);
  const catalog = o.catalog || null;
  const send    = o.send || (() => {});
  const onState = o.onState || (() => {});
  const onEvent = o.onEvent || (() => {});
  const build   = o.build || null;

  let view = null, seq = 0;
  const show = (source, action, bySeat) => onState(view, {seq, action: action || null, seat: bySeat != null ? bySeat : null, source, hash: W.hash(view)});
  const evt = (t, d) => onEvent({t, seat, seq, ...(d || {})});

  if(host){
    /* THE H2 HOST: the referee with the guest's seat remote and its own local.
       Its own screen gets ITS seat's view, exactly what a guest would see. */
    const H = refereeHost({...o, remote: [foe], send: (_s, m) => send(m),
      onEvent: e => { const {t, ...d} = e; evt(t, d); },
      onCommit: (r, bySeat) => { seq = r.seq; view = H.ref.view(seat); show(bySeat === seat ? "local" : "remote", r.commits[seat].action, bySeat); }});
    view = H.ref.view(seat); seq = H.ref.seq();
    const submit = action => {
      const why = legal(view, action, seat);
      if(why){ evt("refused", {reason: why, action, local: true}); return why; }
      return H.sequence(action, seat, 0);
    };
    return {
      join(){}, submit, receive: m => H.receive(m, null),
      tick(){ H.ping(foe); },
      resync(){}, pause(){},
      reveal: extra => H.reveal(extra),
      revealed: () => null, hashes: () => ({}),
      state: () => view, seq: () => seq, seat: () => seat,
      isHost: () => true, isReferee: () => true, status: () => "ready",
      hash: () => (view ? W.hash(view) : null),
      snapshot: () => W.encode(view, {catalog}),
      stats: H.stats,
      /* what to keep on the phone so a reload resumes the game */
      persist: H.persist,
      log: () => H.ref.log(),
      full: () => H.ref.state(),
      violations: () => H.ref.violations()
    };
  }

  const mir = R.createMirror({catalog, seat});
  let status  = "new";
  let pausedWhy = null;
  let inflight = null, queued = [], nextId = 1;
  let revealed = null;              /* the referee's post-game reveal */
  const hashes = {};                /* seq -> the view fingerprint it was shown */
  const stats = {sent: 0, recv: 0, commits: 0, desyncs: 0, resyncs: 0, nacks: 0, snapshots: 0, bytesOut: 0, rtt: null};
  const out = m => { stats.sent++; stats.bytesOut += JSON.stringify(m).length; send(m); };
  const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  let parts = null;   /* the pieces of the message being reassembled */

  function submit(action){
    if(status === "paused") return "the game is paused — " + (pausedWhy || "waiting for the device that holds the deck");
    if(status !== "ready") return "session is " + status;
    const why = legal(view, action, seat);
    if(why){ evt("refused", {reason: why, action, local: true}); return why; }
    if(inflight){ queued.push(action); return null; }
    inflight = {id: nextId++, action};
    out({t: MSG.INTENT, id: inflight.id, seat, action});
    return null;
  }
  function pump(){
    if(inflight || !queued.length || status !== "ready") return;
    const a = queued.shift();
    const why = legal(view, a, seat);
    if(why){ evt("refused", {reason: why, action: a, local: true}); return pump(); }
    inflight = {id: nextId++, action: a};
    out({t: MSG.INTENT, id: inflight.id, seat, action: a});
  }
  function requestResync(reason, force){
    stats.resyncs++; status = "resyncing";
    evt("resync-requested", {reason, have: seq, force: !!force});
    out({t: MSG.RESYNC, have: seq, seat, force: !!force});
  }
  /* apply one commit to the mirror; on distrust, ask for a repair */
  function applyCommit(c){
    const why = mir.commit(c);
    if(why === "gap"){ requestResync("sequence gap: at " + seq + ", received " + c.seq); return false; }
    if(why){
      stats.desyncs++;
      evt("desync", {reason: why, at: c.seq});
      requestResync(why + " at seq " + c.seq, true);
      return false;
    }
    seq = mir.seq(); view = mir.view(); hashes[seq] = c.h;
    stats.commits++;
    show(c.seat === seat ? "local" : "remote", c.action, c.seat);
    return true;
  }

  function receive(m){
    if(!m || typeof m !== "object") return;
    stats.recv++;
    switch(m.t){
      case MSG.WELCOME: {
        if(!m.accepted){ status = "refused"; evt("refused-by-host", {reason: m.reason}); return; }
        status = "handshaking";
        return;
      }
      case MSG.SNAPSHOT: {
        try {
          const v = W.decode(m.wire, {catalog});
          if(mir.load({seq: m.seq, view: v, h: m.h})) throw new Error("the snapshot does not match its fingerprint");
          view = mir.view(); seq = m.seq; hashes[seq] = m.h;
          /* A REFEREE THAT RESUMED FROM AN OLDER SAVE (H3's three-page drive:
             a judge saved at 83 while this phone had seen 100) replays from
             here: the fingerprints this phone kept for the lost timeline are
             not the game any more, and "verify this game" must not hold
             them against it */
          for(const k of Object.keys(hashes)) if(+k > m.seq) delete hashes[k];
          status = "ready"; pausedWhy = null; inflight = null;
          evt("snapshot-applied", {size: m.size});
          show("snapshot");
          pump();
        } catch(e){ status = "refused"; evt("snapshot-failed", {reason: String(e.message || e)}); }
        return;
      }
      case MSG.COMMIT: {
        if(m.id && inflight && inflight.id === m.id) inflight = null;
        if(status === "resyncing") return;
        if(m.seq <= seq) return;
        if(applyCommit(m)) pump();
        return;
      }
      case MSG.NACK: {
        stats.nacks++;
        if(inflight && inflight.id === m.id) inflight = null;
        evt("nacked", {reason: m.reason});
        pump();
        return;
      }
      case MSG.CATCHUP: {
        status = "ready";
        for(const c of m.commits || []){
          if(c.seq <= seq) continue;
          if(!applyCommit(c)) return;
        }
        evt("catchup-applied", {to: seq});
        pump();
        return;
      }
      case MSG.PART: {
        if(!parts || parts.id !== m.id) parts = {id: m.id, n: m.n, got: 0, s: new Array(m.n)};
        if(parts.s[m.i] == null){ parts.s[m.i] = String(m.s); parts.got++; }
        if(parts.got === parts.n){
          const whole = parts.s.join(""); parts = null;
          let msg; try { msg = JSON.parse(whole); } catch(_){ requestResync("a message arrived broken", true); return; }
          stats.recv--;
          receive(msg);
        }
        return;
      }
      case MSG.REVEAL: {
        revealed = {seedH: m.seedH, log: m.log || [], over: m.over || null, seq: m.seq};
        evt("revealed", {over: m.over});
        return;
      }
      case MSG.PING:  out({t: MSG.PONG, t0: m.t0}); return;
      case MSG.PONG:  if(m.t0 != null) stats.rtt = now() - m.t0; return;
    }
  }

  return {
    join(){
      status = "handshaking";
      out({t: MSG.HELLO, proto: PROTO, wireV: W.WIRE_V, seat, build, catalog: catalog ? W.catalogHash(catalog) : null});
    },
    submit, receive,
    tick(){ if(status === "ready") out({t: MSG.PING, t0: now()}); },
    resync(){ requestResync("requested by the app"); },
    /* the channel to the referee closed: nothing this phone holds can carry
       the game on, so it waits. `join` on the new channel resumes. */
    pause(why){ status = "paused"; pausedWhy = why || null; inflight = null; queued = []; evt("paused", {reason: why}); },
    reveal(){ return "the game is not over"; },
    revealed: () => revealed,
    hashes: () => ({...hashes}),
    state:    () => view,
    seq:      () => seq,
    seat:     () => seat,
    isHost:   () => false,
    isReferee: () => true,
    status:   () => status,
    hash:     () => (view ? W.hash(view) : null),
    snapshot: () => W.encode(view, {catalog}),
    stats:    () => ({...stats}),
    persist:  () => null,
    log:      () => null,
    full:     () => null,
    violations: () => []
  };
}

/* ---- judge mode (HIDDEN HANDS H3) ----------------------------------------
   A THIRD DEVICE HOLDS THE DECK. Neither player's phone hosts: the judge's
   device (a store-table judge's phone or tablet, or a server later) runs the
   SAME referee with BOTH seats remote, and each player's phone is a plain
   referee guest (`createSession({referee: true, host: false, seat})`), so
   BOTH phones are blind. The judge sends each seat its own view; its own
   screen shows the PUBLIC view (`seatView(state, -1)`: every hand and deck
   face down), because a judge who wants to look must go out of their way.

   It takes one `send(seat, m)` and `receive(seat, m)` — `seat` is the
   channel the frame rode, bound by the caller (hub.js) — so the transport is
   the caller's: PeerJS in the browser, a WebSocket on a server (`wsAdapter`).
   o: {state, reduce, legal, check, catalog, build, restore, send(seat, m),
       onState(publicView, info), onEvent(e)} */
function createJudgeSession(o){
  o = o || {};
  if(typeof o.reduce !== "function") throw new Error("net: a reduce(state, action, seat) is required");
  const onState = o.onState || (() => {});
  const onEvent = o.onEvent || (() => {});
  const send = o.send || (() => {});
  const PUBLIC = -1;
  const H = refereeHost({...o, remote: [0, 1], send: (s, m) => send(s, m),
    onEvent: e => onEvent({seq: H ? H.ref.seq() : 0, ...e}),
    onCommit: (r, bySeat) => { const last = H.ref.log().slice(-1)[0];
      onState(H.ref.view(PUBLIC), {seq: r.seq, seat: bySeat, source: "remote",
        /* the action as the PUBLIC may know it: slot handles for both seats */
        action: last ? R.redactAction(last.action, H.ref.state(), PUBLIC) : null}); }});
  return {
    receive: (seat, m) => H.receive(m, seat),
    tick(){ H.ping(0); H.ping(1); },
    reveal: extra => H.reveal(extra),
    state: () => H.ref.view(PUBLIC),        /* the judge's screen: the public view */
    full: () => H.ref.state(),
    seq: () => H.ref.seq(),
    log: () => H.ref.log(),
    over: () => H.ref.over(),
    stats: H.stats,
    persist: H.persist,
    violations: () => H.ref.violations(),
    isJudge: () => true
  };
}

/* The host's saved game: the full state on the wire format (catalog-interned)
   plus the sequence and log. */
const encodeSaved = (p, catalog) => ({v: W.WIRE_V, seq: p.seq, log: p.log, wire: W.encode(p.state, {catalog})});
const decodeSaved = (s, catalog) => {
  if(!s || s.v !== W.WIRE_V) throw new Error("net: a saved game from another wire version cannot resume");
  return {seq: s.seq, log: s.log || [], state: W.decode(s.wire, {catalog})};
};

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

return {PROTO, MSG, JOURNAL, CHUNK, createSession, createJudgeSession, loopback, wsAdapter, encodeSaved, decodeSaved};
});
