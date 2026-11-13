/* ============================================================
   Dawnblade engine — hub.js (HIDDEN HANDS H3, HIDDEN-HANDS.md §3(c), §6)

   THE JUDGE'S TABLE: TWO PLAYERS, ONE DEVICE THAT HOLDS THE DECK.

   At an H2 table one player's phone hosts the referee, so that phone holds
   the deck (HIDDEN-HANDS.md §3(b): "trust the host"). A JUDGED table moves
   the referee to a device neither player controls — a store judge's phone or
   tablet in the browser, or a server — and BOTH phones become guests. This
   module is what sits on that device. It owns no transport: it takes
   connections (anything with `send(frame)`) and returns, for each, the
   `receive(frame)` to feed. room.js hands it PeerJS channels in the browser;
   net.wsAdapter's `accept` hands it WebSockets on a server. The same code,
   unchanged, either way — that is the H3 proof.

   ---- WHAT IT DOES ------------------------------------------------------
     SEATS      a new connection is offered the first seat nobody has sat
                in (`{ch:"judge", seat, key}`); `key` is a secret the judge
                deals that seat's phone. A returning phone CLAIMS its seat
                with it (`{ch:"judge", claim, key}`) and gets it back if no
                live channel holds it. A stranger who dials the table code
                once both seats are dealt is told `full` and can claim
                nothing: the code finds the table, the key holds the chair.
     THE LOBBY  every lobby frame from a seat is checked to speak for THAT
                seat, applied to the judge's copy and relayed to the other
                seat. The lobby is write-once and order-free (lobby.js), so
                relaying is all it needs; a (re)bound phone is replayed the
                whole lobby log. The judge says hello as seat 2 (its build
                must match both phones) and COMMITS to the seed; both
                players answer (lobby.js judge mode).
     THE GAME   when the lobby is ready the judge deals (the caller's
                `deal(spec)`: build.buildMatch + judge.newMatch) and runs
                net.createJudgeSession: both seats remote, each sent only
                its own view. Net frames are routed by the channel's seat.
     THE END    the judge reveals its half of the seed and the full log to
                both seats, so EACH phone can verify every shuffle.
     A DROP     a player's channel closing frees the seat; the game waits on
                that seat (priority is the lock) and the phone rejoins on a
                snapshot. The JUDGE dropping pauses both phones (net.js);
                `persist` is what the judge keeps so a reload resumes.

   NO TIMERS, NO DOM, NO TRANSPORT — it runs under node, a browser, or a
   server runtime with the same drills (test/judgetable.test.js,
   tools/serverrun.js).
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./lobby.js"), require("./net.js"), require("./sha256.js"));
  else root.DawnHub = factory(root.DawnLobby, root.DawnNet, root.DawnSHA);
})(typeof self!=="undefined" ? self : this, function(L, N, SHA){

/* The frame channels. "lobby" and "net" are the page's own (index.html's
   CH_LOBBY/CH_NET); "judge" is the seat handshake, which only a judged table
   speaks. */
const CH = {LOBBY: "lobby", NET: "net", JUDGE: "judge"};

/* o: {code, build, deal(spec) -> {state, catalog}, reduce, legal, check,
       rand?, resume?: {spec, seedH, saved}, onChange?(info), onEvent?(e)} */
function createHub(o){
  o = o || {};
  if(typeof o.deal !== "function") throw new Error("hub: a deal(spec) is required");
  const onChange = o.onChange || (() => {});
  const onEvent = o.onEvent || (() => {});
  const conns = [null, null];        /* seat -> the live connection holding it */
  /* seat -> the secret its phone holds (a nonce from sha256.js). Kept in
     `persist`, so a resumed judge still knows each phone. */
  const keys = (o.resume && o.resume.keys) ? o.resume.keys.slice() : [null, null];
  const loose = new Set();           /* connected, not yet holding a seat */
  let lob = L.newLobby({code: o.code || null, judge: true});
  const lobLog = [];                 /* every lobby message, for a (re)bound phone */
  let seedH = null, spec = null, sess = null, revealed = false;
  const netQ = [];                   /* net frames that beat the session */
  const evt = (t, d) => onEvent({t, ...(d || {})});
  const changed = () => onChange(info());

  const sendSeat = (seat, f) => { const c = conns[seat]; if(c) try { c.send(f); } catch(_){} };

  /* the judge's own lobby messages: applied here, sent to both seats */
  function sayLobby(m){
    const r = L.reduce(lob, m);
    if(r.error && !r.error.dup) evt("lobby-refused", {seat: m.seat, reason: r.error.why});
    if(r.error) return;
    lob = r.state; lobLog.push(m);
    for(const s of [0, 1]) sendSeat(s, {ch: CH.LOBBY, m});
    maybeDeal();
  }

  function startSession(state, catalog, restore){
    sess = N.createJudgeSession({
      state, catalog, restore: restore || null,
      reduce: o.reduce, legal: o.legal, check: o.check || null, build: o.build || null,
      seatView: o.seatView,   /* the sabotage drills' seam (referee.js's) */
      send: (seat, m) => sendSeat(seat, {ch: CH.NET, m}),
      onState: () => { if(sess && sess.over() && !revealed){ revealed = true; sess.reveal({seedH}); evt("revealed", {}); } changed(); },
      onEvent: e => { evt("net", e); changed(); }
    });
    const q = netQ.splice(0);
    for(const [seat, m] of q) sess.receive(seat, m);
  }

  function maybeDeal(){
    if(sess || L.stepOf(lob) !== "ready") return;
    spec = L.matchSpec(lob, seedH);
    if(!spec){ evt("fault", {reason: "the judge's seed did not open its own commitment"}); return; }
    let d;
    try { d = o.deal(spec); } catch(e){ evt("fault", {reason: "could not deal the match: " + (e.message || e)}); return; }
    startSession(d.state, d.catalog);
    evt("dealt", {});
    changed();
  }

  /* bind a connection to a seat and bring it up to date */
  function bind(c, seat){
    loose.delete(c);
    for(const s of [0, 1]) if(conns[s] === c) conns[s] = null;
    conns[seat] = c;
    c.seat = seat;
    const fresh = keys[seat] == null;
    if(fresh) keys[seat] = SHA.nonce(o.rand);
    c.fresh = fresh;
    try { c.send({ch: CH.JUDGE, seat, judge: true, code: o.code || null, key: fresh ? keys[seat] : undefined}); } catch(_){}
    for(const m of lobLog) try { c.send({ch: CH.LOBBY, m}); } catch(_){}
    evt("seated", {seat});
    changed();
  }
  /* a seat no phone has ever been dealt a key for */
  const unsat = () => [0, 1].filter(s => !conns[s] && keys[s] == null);

  function connect(conn){
    const c = {send: f => conn.send(f), close: () => { try { conn.close && conn.close(); } catch(_){} }, seat: null, live: true};
    loose.add(c);
    const f0 = unsat();
    /* no fresh seat: the connection stays, unseated, for a CLAIM — a
       returning phone's first frame — and can do nothing else */
    if(!f0.length){ try { c.send({ch: CH.JUDGE, full: true}); } catch(_){} evt("full", {}); }
    else bind(c, f0[0]);
    return {
      receive(f){
        if(!c.live || !f || typeof f !== "object") return;
        if(f.ch === CH.JUDGE){
          /* A RETURNING PHONE claims its old seat. Granted only when no live
             channel holds it, so a third phone cannot evict a player. */
          const want = f.claim;
          if((want === 0 || want === 1) && c.seat !== want){
            const no = why => { try { c.send({ch: CH.JUDGE, refused: why}); } catch(_){} evt("claim-refused", {seat: want, reason: why}); };
            if(keys[want] == null || f.key !== keys[want]) return no("that seat's key does not match");
            if(conns[want]) return no("seat " + want + " is taken");
            /* a phone offered a fresh seat on arrival hands it back */
            if(c.seat != null && conns[c.seat] === c){ conns[c.seat] = null; if(c.fresh) keys[c.seat] = null; }
            bind(c, want);
          }
          return;
        }
        if(c.seat == null) return;
        if(f.ch === CH.LOBBY){
          const m = f.m;
          /* A PHONE SPEAKS FOR ITS OWN SEAT ONLY — the judge's seat and the
             other player's are refused, never relayed. */
          if(!m || m.seat !== c.seat){ evt("forged", {seat: c.seat, claimed: m && m.seat}); return; }
          const r = L.reduce(lob, m);
          if(r.error){ if(!r.error.dup) evt("lobby-refused", {seat: c.seat, reason: r.error.why}); return; }
          lob = r.state; lobLog.push(m);
          sendSeat(1 - c.seat, {ch: CH.LOBBY, m});
          maybeDeal();
          changed();
          return;
        }
        if(f.ch === CH.NET){
          if(sess) sess.receive(c.seat, f.m); else netQ.push([c.seat, f.m]);
        }
      },
      /* the channel closed: the seat is free for its phone to reclaim */
      closed(){
        if(!c.live) return;
        c.live = false; loose.delete(c);
        if(c.seat != null && conns[c.seat] === c){ conns[c.seat] = null; evt("left", {seat: c.seat}); }
        changed();
      },
      seat: () => c.seat
    };
  }

  function info(){
    return {step: L.stepOf(lob), lobby: lob, seats: [!!conns[0], !!conns[1]], dealt: !!sess,
            seq: sess ? sess.seq() : 0, over: sess ? (sess.full().over || null) : null,
            fault: lob.fault || null};
  }

  /* ---- start: a fresh table, or a resumed one -------------------------- */
  if(o.resume && !o.resume.spec){
    /* A TABLE THAT HAS NOT DEALT (a server that rehydrates per request keeps
       the lobby between frames): replay the lobby log, silently — nothing is
       sent and nothing deals; the frame that made the lobby ready dealt it
       in its own request, and `persistTable` then kept the game instead. */
    seedH = o.resume.seedH;
    for(const m of (o.resume.lobLog || [])){
      const r = L.reduce(lob, m);
      if(!r.error){ lob = r.state; lobLog.push(m); }
    }
  } else if(o.resume){
    seedH = o.resume.seedH; spec = o.resume.spec;
    /* the lobby, silently (a table's row keeps it, so a phone that reloads mid-game is replayed it on its claim) */
    for(const m of (o.resume.lobLog || [])){
      const r = L.reduce(lob, m);
      if(!r.error){ lob = r.state; lobLog.push(m); }
    }
    const d = o.deal({...spec, seed: SHA.seedOf(seedH, spec.seedG)});
    startSession(d.state, d.catalog, o.resume.saved);
  } else {
    sayLobby(L.hello(L.JUDGE, o.build || null));
    const sc = L.seedCommitMsg(o.rand, L.JUDGE);
    seedH = sc.seedH;
    sayLobby(sc.msg);
  }

  return {
    connect, info,
    lobby: () => lob,
    session: () => sess,
    spec: () => spec,
    /* what the judge's device keeps so a reload resumes the game: the spec,
       its secret half of the seed, and the referee's saved game */
    persist: () => sess && spec ? {judge: true, spec, seedH, keys: keys.slice(), saved: sess.persist()} : null,
    /* `persist`, or — before the deal — the lobby: what a stateless server
       stores after every frame (`resume` takes either). The page's own
       `persist` is unchanged (null until dealt). */
    persistTable(){
      if(sess && spec) return {judge: true, spec, seedH, keys: keys.slice(), saved: sess.persist(), lobLog: lobLog.slice()};
      return {judge: true, spec: null, seedH, keys: keys.slice(), lobLog: lobLog.slice()};
    },
    tick(){ if(sess) sess.tick(); },
    /* the seed's secret half — the drills' and a post-game screen's; it is
       sent to the players only with the reveal */
    seedH: () => (sess && sess.over() ? seedH : null)
  };
}

return {CH, createHub};
});
