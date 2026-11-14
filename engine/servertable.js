/* ============================================================
   Dawnblade engine — servertable.js (SERVER S2: the page's side of the hosted referee)

   A TABLE ON THE HOSTED REFEREE, AS THE SAME CHANNEL THE OTHER TABLES USE.

   server/referee.js (S1) is a stateless function: one request in, the row
   loaded, ONE frame applied, the row saved, the other seat pushed its own
   frames. This module is the phone's end of it. It turns that request/answer
   world back into the channel TableRoom already speaks to — the shape
   engine/room.js's `open` resolves with —

        {send(frame), listen(fn), first(ms), close(), status(), code}

   so the lobby, net.js's guest session and the whole board run UNCHANGED.
   (A frame is `{ch:"lobby"|"net", m}`; a judged table's seat offer, the
   `{ch:"judge", seat}` frame, is the first thing `first()` hands out, with
   the seat KEY taken out of it — see KEYS below.)

   ---- THE TRANSPORT IS INJECTED ----------------------------------------
     transport = {
       post(envelope) -> Promise<answer>        one referee call
       subscribe(topic, onPayload, onState?) -> unsubscribe
                       onState("joined"|"lost") is optional: a transport that
                       can tell when its subscription dropped says so, and the
                       channel RESYNCS when it is back.
     }
   Nothing here names a socket, a URL or a library: `supabaseTransport` (at the
   bottom) is the one place that does, and it is built to cost NOTHING until a
   player asks for a server table (no request, no script tag). The offline
   fake the drills use lives in test/helpers/servertransport.js and is never
   loaded by the page.

   ---- WHAT THIS MODULE OWNS ----------------------------------------------
   THE COUNTER `n`. The referee refuses a frame whose n is not above the last
   one it applied for this seat (a replay, or one that overtook a newer). The
   channel keeps n, sends ONE frame at a time (a second in flight is how a
   frame overtakes another), and moves n on only when the referee ANSWERED ok.
   NOTE the one liberty taken with "advance only when a frame applied": an ok
   answer to a frame that changed nothing (a refused intent, a read) also
   moves n. That is safe — the referee only asks for n ABOVE its last — and it
   keeps the client from guessing whether a frame applied.
   CONFLICT. {refused:"conflict", retry:true} means somebody wrote first and
   NOTHING of ours was saved: retry the SAME frame with the SAME n after a
   jittered, growing pause, up to `conflictCap` tries.
   A LOST ANSWER. The call failed in the network: the frame may or may not
   have applied. It is resent with the same n; if it HAD applied the referee
   answers `stale`, and the channel then asks where the counter stands
   (a claiming join answers `n`), treats the frame as applied, and heals.
   HEALING (`heal`): the referee's own answers are the repair. A claiming join
   replays the lobby; a `resync` answers the net session's catch-up. It runs
   after a stale answer, after the subscription comes back, after a broadcast
   arrives late, and (when `pollMs` is set) after a long silence — a
   broadcast that never came cannot announce itself.
   BROADCASTS. Each payload is `{ver, frames, mac}`; one whose seal does not verify is ignored (see `onPayload`: the
   channel is public, so the seal is what keeps a listener from forging). A repeated `ver` is dropped; a
   `ver` BELOW one already delivered arrived out of order: its frames are not
   delivered (net.js would take them for a past) and a resync is asked for.
   Gaps in `ver` are NOT a signal: the caller's own writes and the other
   seat's frame-less writes both advance it. net.js's own sequence numbers
   notice a missing commit and ask for a resync through `send`.
   THE KEY. The seat key is dealt in the answer to a first `join`, kept in
   memory and (through the injected `keep`, the page's `store` seam) under
   "srv.<code>" so a RELOAD can claim the seat back. It is sent only inside
   the request envelope. It is never put in a status, an error, a frame handed
   up, `report()`, or a JUDGE!! report (engine/report.js is handed the table
   CODE only), and errors are scrubbed of it before they leave this file.
   HONEST STATUS. `status()` is one of
     connecting     the table is being reached
     waiting        seated; nothing yet heard from the other player
     seated         seated and the other player has spoken
     reconnecting   this phone's link is failing; it keeps trying
     unavailable    the server cannot be reached (or answered something that
                    is not the referee); frames wait, and it probes again
     closed         left, or the seat/table is gone (`closedWhy()` says which)

   NO DOM, NO TIMERS OF ITS OWN BEYOND THE INJECTED ONES: `o.sleep`, `o.rand`
   and `o.timers` let the drills run it without a clock.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./sha256.js"));
  else root.DawnServerTable = factory(root.DawnSHA);
})(typeof self!=="undefined" ? self : this, function(SHA){

/* the referee's code alphabet (server/referee.js CODE_CHARS) and length */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const normalize = c => String(c == null ? "" : c).toUpperCase().split("").filter(x => CODE_CHARS.indexOf(x) >= 0).join("").slice(0, CODE_LEN);
const isValid = c => normalize(c).length === CODE_LEN;
/* the channel a seat listens on (server/referee.js `topic`): derived from the seat's secret key by a one-way
   hash (sha256.js `seatTopic`), so it is unguessable, never reveals the key, and the OTHER seat's name is never
   sent to this phone — it cannot even work it out. A PUBLIC channel, by decision (casual stage): anyone who
   learns this name can read this seat's hand and publish into it, and it cannot be revoked; the seal below is
   what keeps a listener from forging. Private channels with sign-in arrive at S4. */
const topicFor = (code, seat, key) => SHA.seatTopic(code, seat, key);

const STATUS = ["connecting", "waiting", "seated", "reconnecting", "unavailable", "closed"];
const CH_JUDGE = "judge", CH_LOBBY = "lobby", CH_NET = "net";
const clone = v => JSON.parse(JSON.stringify(v));
const defaultSleep = ms => new Promise(r => setTimeout(r, ms));

/* an Error whose `why` is a short machine word the screen maps to a sentence */
const fail = (why, detail) => Object.assign(new Error(detail || why), {why});
/* the referee's refusals, as the words a screen reasons in */
const WHY_OF = {"no-table": "no-table", full: "full", auth: "auth", wire: "wire", exists: "exists", "bad-request": "bad-request"};

/* a transport failure: the network, a function that is not there, a paused
   project, a page that is not the referee. Never carries the request. */
const transportErr = e => Object.assign(new Error("server unreachable"), {transport: true, why: "unavailable", status: e && e.status});

function scrubber(){
  const secrets = [];
  const f = v => { let s = String(v == null ? "" : (v.message || v)); for(const k of secrets) if(k) s = s.split(k).join("…"); return s; };
  f.add = k => { if(k && secrets.indexOf(k) < 0) secrets.push(k); };
  return f;
}

/* ---- one call -----------------------------------------------------------
   Resolves with the answer, or rejects with a transport error: the referee
   always answers {ok:boolean}, so anything else is not it. */
async function call(T, env){
  let r;
  try { r = await T.post(env); } catch(e){ throw transportErr(e); }
  if(!r || typeof r !== "object" || typeof r.ok !== "boolean") throw transportErr();
  return r;
}

/* ---- opening: create / join / resume --------------------------------------
   o: {transport, code?, mode: "create"|"join"|"resume", keep?, onStatus?, ...tuning}
   Resolves with the channel handle once this phone HOLDS A SEAT; rejects with
   an Error whose `.why` is unavailable | no-table | full | auth | wire | code. */
async function open(o){
  o = o || {};
  const T = o.transport, mode = o.mode || "join";
  if(!T || typeof T.post !== "function" || typeof T.subscribe !== "function") throw fail("unavailable", "no transport");
  const keep = o.keep || null;
  const kget = k => { try { return keep ? keep.get(k, null) : null; } catch(_){ return null; } };
  const kset = (k, v) => { try { if(keep) keep.set(k, v); } catch(_){} };
  let code = normalize(o.code), rec = null;
  const scrub = scrubber();
  const say = s => { try { if(o.onStatus) o.onStatus(s); } catch(_){} };
  say("connecting");

  const refusal = r => fail(WHY_OF[r.refused] || "unavailable", "refused: " + r.refused);
  if(mode === "create"){
    let made = null;
    for(let i = 0; i < 3 && !made; i++){
      const r = await call(T, {op: "create"});
      if(r.ok && typeof r.table === "string") made = r.table;
      else if(r.refused === "exists" && r.retry) continue;
      else throw r.ok ? fail("unavailable") : refusal(r);
    }
    if(!made) throw fail("unavailable", "no free table code");
    code = made;
  } else if(!isValid(code)) throw fail("code", "a table code is " + CODE_LEN + " characters");
  if(mode === "resume"){
    rec = kget("srv." + code);
    if(!rec || (rec.seat !== 0 && rec.seat !== 1) || typeof rec.key !== "string") throw fail("auth", "no seat to claim");
    scrub.add(rec.key);
  }

  /* THE CLAIM TOKEN. An unkeyed join deals a seat; if its ANSWER is lost the phone cannot tell, and a second join
     would deal the other seat (or "full"), stranding the first one. So the phone picks 128 random bits ONCE per
     open and sends them with every attempt: the referee remembers which seat the token took, saves the two in one
     write, and answers a repeat with the SAME seat, key and lobby. Always real randomness (never `o.rand`, which
     the drills pin): two phones must never share a token. A claiming join (resume) is already idempotent. */
  const claim = mode === "resume" ? null : (o.claim || SHA.nonce());
  const req0 = mode === "resume" ? {op: "join", table: code, seat: rec.seat, key: rec.key} : {op: "join", table: code, claim};
  /* a join that lost a version race wrote NOTHING: it is asked again. One that FAILED in the network may or may
     not have been applied: it is asked again too (a claim token / a keyed claim makes that safe), a couple of
     times, but never when the function is simply not there (404): that answer is final. */
  const sleep0 = o.sleep || defaultSleep, tune0 = {joinCap: 8, joinFailCap: 2, base: 120, max: 2000, ...(o.tune || {})};
  let res = null, netFails = 0;
  for(let k = 0; k <= tune0.joinCap + tune0.joinFailCap; k++){
    try { res = await call(T, req0); }
    catch(e){
      if(e && e.status === 404) throw e;
      if(++netFails > tune0.joinFailCap) throw e;
      await sleep0(Math.min(tune0.max, tune0.base * Math.pow(2, netFails)) * (0.5 + (o.rand || Math.random)()));
      continue;
    }
    if(res.ok || res.refused !== "conflict") break;
    await sleep0(Math.min(tune0.max, tune0.base * Math.pow(2, k)) * (0.5 + (o.rand || Math.random)()));
  }
  if(!res.ok){
    if(mode === "resume" && res.refused === "auth") kset("srv." + code, null);   /* a seat that is not ours any more */
    if(mode === "resume" && res.refused === "no-table") kset("srv." + code, null);
    throw refusal(res);
  }
  if(res.seat !== 0 && res.seat !== 1) throw fail("unavailable");
  let key = rec ? rec.key : null;
  if(!key) for(const f of res.frames || []) if(f && f.ch === CH_JUDGE && typeof f.key === "string") key = f.key;
  if(!key) throw fail("unavailable", "the table dealt no seat key");
  scrub.add(key);
  kset("srv." + code, {seat: res.seat, key, role: mode === "create" ? "creator" : (rec && rec.role) || "joiner", at: (o.now || Date.now)()});
  return channel(o, T, code, res.seat, key, res.n | 0, res.frames || [], scrub, keep);
}

/* ---- the channel ----------------------------------------------------------- */
function channel(o, T, code, seat, key, n0, firstFrames, scrub, keep){
  const sleep = o.sleep || defaultSleep, rand = o.rand || Math.random;
  const timers = o.timers || {setInterval: (f, ms) => setInterval(f, ms), clearInterval: h => clearInterval(h)};
  const tune = {conflictCap: 8, joinCap: 8, failCap: 4, base: 120, max: 2000, probeMs: 5000, pollMs: 0, fallbackMs: 0, ...(o.tune || {})};
  const onStatus = o.onStatus || (() => {});
  const topic = (o.topic || topicFor)(code, seat, key);
  let n = n0, st = "connecting", closed = false, closedWhy = null, sink = null, backlog = [];
  let judgeSent = false, peerHeard = false, sawNet = false, lastVer = 0, lastIn = (o.now || Date.now)();
  let unsub = null, subLost = false, subJoined = false, healing = false, healAgain = false, haveFn = o.have || null;
  const outbox = []; let pumping = false;
  const events = []; const ev = (t, d) => { events.push({t, ...(d || {})}); if(events.length > 200) events.shift(); };
  const set = s => { if(st === s || (st === "closed" && s !== "closed")) return; st = s; try { onStatus(s); } catch(_){} };
  const peerSeat = 1 - seat;

  const deliver = f => { if(sink) sink(f); else backlog.push(f); };
  /* what comes up from the server: the seat offer once (key taken out), lobby and net frames as they are */
  function ingest(frames){
    for(const f0 of frames || []){
      if(!f0 || typeof f0 !== "object") continue;
      if(f0.ch === CH_JUDGE){
        if(judgeSent) continue;
        judgeSent = true;
        const {key: _k, ...rest} = f0;                    /* THE KEY STOPS HERE */
        deliver(clone(rest)); continue;
      }
      if(f0.ch !== CH_LOBBY && f0.ch !== CH_NET) continue;
      if(f0.ch === CH_NET) sawNet = true;
      if(!peerHeard && ((f0.ch === CH_LOBBY && f0.m && f0.m.seat === peerSeat) || (f0.ch === CH_NET))){ peerHeard = true; }
      deliver(clone(f0));
    }
    if(peerHeard && st === "waiting") set("seated");
  }
  ingest(firstFrames);
  set(peerHeard ? "seated" : "waiting");

  /* ---- backoff: grows, is capped, is jittered -------------------------- */
  const pause = k => sleep(Math.min(tune.max, tune.base * Math.pow(2, k)) * (0.5 + rand()));

  /* ---- an answer that is not ok: what to do about it ---------------------- */
  const fatal = (why) => { if(closedWhy == null) closedWhy = why; ev("fatal", {why}); stop(); };

  /* ---- send: one frame at a time, in order ------------------------------- */
  async function post1(item){
    let conflicts = 0, fails = 0, soft = 0;
    for(;;){
      if(closed) return false;
      let r;
      try { r = await call(T, {op: "frame", table: code, seat, key, n: n + 1, frame: item.frame}); }
      catch(e){
        fails++; ev("post-failed", {fails});
        if(fails < tune.failCap){ set("reconnecting"); await pause(fails); continue; }
        /* parked: frames wait, the server is probed until it answers — nothing is dropped */
        set("unavailable");
        await sleep(tune.probeMs);
        continue;
      }
      if(st === "reconnecting" || st === "unavailable") set(peerHeard ? "seated" : "waiting");
      fails = 0;
      if(r.ok){ n++; ingest(r.frames); return true; }
      if(r.refused === "conflict"){
        ev("conflict", {n: conflicts + 1});
        if(++conflicts > tune.conflictCap){ set("unavailable"); await sleep(tune.probeMs); conflicts = 0; continue; }
        await pause(conflicts); continue;
      }
      if(r.refused === "stale"){
        /* it may have applied (a lost answer): ask where the counter stands */
        ev("stale");
        const j = await rejoin();
        if(j === null) continue;                           /* transport trouble: the loop's own handling retries */
        if(closed) return false;
        if(j >= n + 1){ n = j; heal(); return true; }      /* applied (or a later one did) */
        n = j; continue;                                   /* ours is still unapplied: resend above the counter */
      }
      if(r.refused === "auth" || r.refused === "no-table" || r.refused === "wire"){ fatal(r.refused); return false; }
      /* not-dealt, internal, bad-request…: transient or a frame the server will not take */
      if(r.refused === "bad-request"){ ev("bad-frame"); return true; }
      if(++soft > tune.conflictCap){ set("unavailable"); await sleep(tune.probeMs); soft = 0; continue; }
      await pause(soft);
    }
  }
  async function pump(){
    if(pumping) return; pumping = true;
    try { while(outbox.length && !closed){ const it = outbox[0]; const ok = await post1(it); if(!closed || ok) outbox.shift(); } }
    finally { pumping = false; }
  }

  /* a claiming join: the lobby replay and the counter; null on a transport failure */
  async function rejoin(){
    let r;
    try { r = await call(T, {op: "join", table: code, seat, key}); } catch(_){ return null; }
    if(!r.ok){ if(r.refused === "auth" || r.refused === "no-table") fatal(r.refused); return null; }
    ingest(r.frames);
    return r.n | 0;
  }

  /* ---- heal: ask the referee to bring this phone up to date -------------- */
  async function heal(){
    if(closed) return;
    if(healing){ healAgain = true; return; }
    healing = true;
    try {
      do {
        healAgain = false;
        let ok1 = false;
        if(!sawNet){ if(await rejoin() === null) ev("heal-failed"); else ok1 = true; }      /* before there is a game: the lobby, replayed */
        else {                                                             /* a game: the net session's catch-up */
          let r = null;
          try { r = await call(T, {op: "resync", table: code, seat, key, have: haveFn ? haveFn() : undefined}); } catch(_){ r = null; }
          if(r && r.ok){ ingest(r.frames); ok1 = true; }
          else if(r && (r.refused === "auth" || r.refused === "no-table")) fatal(r.refused);
          else ev("heal-failed");
        }
        ev("healed");
        /* THE LINK TO THE SERVER WORKS (it just answered) even though Realtime is down: polling carries the table, so the
           phone is not "reconnecting" and a lobby that waits for the peer can open (it stayed shut in v6.26) */
        if(ok1 && st === "reconnecting") set(peerHeard ? "seated" : "waiting");
        if(ok1 && peerHeard && st === "waiting") set("seated");
      } while(healAgain && !closed);
    } finally { healing = false; }
  }

  /* ---- the broadcast side ------------------------------------------------ */
  /* BROADCASTS ARE SEALED. The channel is public, so anyone who learns its name may publish into it. The referee
     seals every push with HMAC-SHA256 under this seat's key (sha256.js `frameMac`, over code, seat, ver and the
     frames); a push whose seal does not verify is IGNORED — not applied, not counted as news (it neither moves
     `lastIn` nor starts a heal, so a flood of forgeries costs a hash each and nothing else). Without the key no
     frame can be made that passes, so an intruder can READ a seat's hand (the stated trade-off) but cannot put a
     frame into a game. A genuine push replayed later is a repeated or lower `ver`: dropped as a duplicate, or
     answered with a resync, exactly like a late one. */
  function onPayload(p){
    if(closed || !p || typeof p !== "object" || !Number.isInteger(p.ver) || !Array.isArray(p.frames)) return;
    if(typeof p.mac !== "string" || p.mac !== SHA.frameMac(key, code, seat, p.ver, p.frames)){ ev("unsealed", {ver: p.ver}); return; }
    lastIn = (o.now || Date.now)();
    if(p.ver === lastVer){ ev("dup", {ver: p.ver}); return; }
    if(p.ver < lastVer){ ev("late", {ver: p.ver}); heal(); return; }
    lastVer = p.ver;
    ingest(p.frames);
  }
  function onSub(state){
    if(closed) return;
    if(state === "lost"){ subLost = true; subJoined = false; ev("sub-lost"); set("reconnecting"); }
    else if(state === "joined"){ const was = subLost; subLost = false; subJoined = true; ev("sub-joined", {again: was}); if(st === "reconnecting") set(peerHeard ? "seated" : "waiting"); heal(); }
  }
  try { unsub = T.subscribe(topic, onPayload, onSub); } catch(_){ unsub = null; set("unavailable"); }
  /* the gap between the join's answer and the subscription is healed at once */
  heal();

  /* NO PUSH, NO WAIT: while the subscription is not joined (the library did not load, the socket is down, a network that blocks
     websockets) the other seat's moves arrive only by asking, so ask every `fallbackMs` (the page sets it; 0 = never). It stops
     the moment a subscription joins. Costs one function call per phone per period while push is down. */
  let fb = null;
  if(tune.fallbackMs > 0) fb = timers.setInterval(() => { if(!closed && !subJoined && !healing) heal(); }, tune.fallbackMs);
  let poll = null;
  if(tune.pollMs > 0) poll = timers.setInterval(() => { if(!closed && (o.now || Date.now)() - lastIn >= tune.pollMs) heal(); }, tune.pollMs);

  function stop(){
    if(closed) return;
    closed = true;
    try { if(unsub) unsub(); } catch(_){}
    if(poll) try { timers.clearInterval(poll); } catch(_){}
    if(fb) try { timers.clearInterval(fb); } catch(_){}
    set("closed");
    try { if(o.onClose) o.onClose(closedWhy); } catch(_){}
  }

  const handle = {
    code, seat, srv: true,
    /* the channel shape room.js gives the table */
    send(f){
      if(closed || !f || typeof f !== "object" || (f.ch !== CH_LOBBY && f.ch !== CH_NET)) return;
      outbox.push({frame: clone(f)}); pump();
    },
    listen(fn){ sink = fn || null; if(sink && backlog.length){ const q = backlog; backlog = []; q.forEach(m => sink(m)); } },
    /* the first frame without consuming it: the seat offer, which is already here */
    first(ms){
      return new Promise(res => {
        if(backlog.length) return res(backlog[0]);
        const prev = sink; let done = false;
        sink = m => { backlog.push(m); if(!done){ done = true; sink = prev; res(m); } };
        (o.setTimeout || setTimeout)(() => { if(!done){ done = true; sink = prev; res(null); } }, ms || 2500);
      });
    },
    close(){ stop(); },
    status: () => st,
    /* beyond room.js's shape */
    peerHeard: () => peerHeard,
    closedWhy: () => closedWhy,
    quietFor: () => (o.now || Date.now)() - lastIn,
    setHave(fn){ haveFn = fn; },
    heal,
    forget(){ try { if(keep) keep.set("srv." + code, null); } catch(_){} },
    /* a drill's and a screen's inspectors — never the key */
    counter: () => n,
    pending: () => outbox.length,
    events: () => events.slice(),
    report: () => ({code, seat, status: st, n, pending: outbox.length, peerHeard, lastVer, push: subJoined ? "joined" : "polling"})
  };
  void scrub;
  return handle;
}

const startTable = o => open({...o, mode: "create"});
const sitAt = o => open({...o, mode: "join"});
const reclaim = o => open({...o, mode: "resume"});

/* the seats this phone may claim back: [{code, role, at}], newest first. `keep` is the page's store seam,
   `keys` is its list of stored names (a drive or the page passes localStorage's keys) */
function savedSeats(keep, names, now, maxAgeMs){
  const out = [];
  for(const nm of names || []){
    const m = /^srv\.([A-Z0-9]+)$/.exec(nm); if(!m) continue;
    let r = null; try { r = keep.get(nm, null); } catch(_){}
    if(!r || typeof r.key !== "string" || (r.seat !== 0 && r.seat !== 1)) continue;
    if(now != null && maxAgeMs && now - (r.at || 0) > maxAgeMs) continue;
    out.push({code: m[1], role: r.role || "joiner", at: r.at || 0});
  }
  return out.sort((a, b) => b.at - a.at);
}

/* THE TESTER'S DOOR (v6.26): the shipped switch stays off; a player opts in with the address `?server=1`, which the page's store
   seam remembers (so a home-screen relaunch, which drops the query, keeps it), and `?server=0` forgets it. Returns whether this
   phone is opted in. `keep` is the page's store seam; `search` is location.search. Never throws. */
function testerDoor(keep, search){
  let q = null; try { q = new URLSearchParams(search || "").get("server"); } catch(_){}
  try {
    if(q === "1") keep.set("server", true);
    else if(q === "0") keep.set("server", false);
    return keep.get("server", false) === true;
  } catch(_){ return q === "1"; }
}

/* ============================================================
   THE REAL TRANSPORT — Supabase (S3: checked against the live project where no secret is needed)
   ============================================================
   Project fokcpzplomjsraquaaid, publishable key only, 2026-11-13, from the build sandbox (Node 22 through the
   egress proxy — NOT a browser, so browser-only behaviour stays UNVERIFIED). Full record: server/S3-LOG.md and
   server/supabase/DEPLOY.md ("What was checked"). Each claim below is tagged VERIFIED (observed) or UNVERIFIED. */
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js";
/* ^ the file dist/umd/supabase.js exists in the 2.115.0 npm package and declares the global `supabase` (VERIFIED, read
     from the installed package). UNVERIFIED: that jsdelivr serves this URL — the sandbox's proxy answers 403 for
     cdn.jsdelivr.net, unpkg.com and cdnjs (host not allowed), so the HEAD request could not be made. */

let libP = null;
/* LAZY: nothing is requested until a player picks a server table. Rejects (never hangs) so the screen can say so. */
function loadSupabase(o){
  o = o || {};
  if(o.lib) return Promise.resolve(o.lib);
  if(typeof window !== "undefined" && window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  const doc = o.document || (typeof document !== "undefined" ? document : null);
  if(!doc) return Promise.reject(transportErr());
  if(libP) return libP;
  libP = new Promise((resolve, reject) => {
    const el = doc.createElement("script");
    el.src = o.libUrl || SUPABASE_JS;   /* `o.url` is the PROJECT address (config.url), never the script: v6.26 asked the project for its script and never got Realtime (PERF-LOG) */ el.async = true;
    el.onload = () => (window.supabase && window.supabase.createClient) ? resolve(window.supabase) : (libP = null, reject(transportErr()));
    el.onerror = () => { libP = null; reject(transportErr()); };
    doc.head.appendChild(el);
  });
  return libP;
}

/* config: {url, key, fn?: "table", fetch?, lib?, document?}
   post:      POST <url>/functions/v1/<fn>, header `apikey` (the publishable key). A function that is not deployed answers
              HTTP 404, content-type application/json, body {"code":"NOT_FOUND","message":"Requested function was not found"},
              header sb-error-code: NOT_FOUND, access-control-allow-origin: * (VERIFIED today, with and without the apikey
              header, for POST and for a CORS preflight): `!resp.ok` below reads it as UNAVAILABLE, and a browser can read
              the status. A paused project or a 5xx reads the same. UNVERIFIED: that a DEPLOYED function accepts the
              publishable (non-JWT) key in `apikey` alone with JWT verification off (the function is deployed with it OFF;
              server/supabase/DEPLOY.md), and the CORS preflight against it (the function answers OPTIONS itself).
   subscribe: supabase-js's Realtime Broadcast, lazily loaded. VERIFIED with supabase-js 2.115.0 in Node 22 on a throwaway
              topic: createClient(url, publishableKey, {auth:{persistSession:false,...}}) joins a PUBLIC broadcast channel
              with no signed-in user; client.channel(topic, {config:{broadcast:{self:false}}}).on("broadcast", {event:"frame"},
              msg => msg.payload).subscribe(cb) reports "SUBSCRIBED" (and "CLOSED" after removeChannel); two clients joined the
              same topic and a broadcast reached both (this very transport, `subscribe`, got a payload sent over the HTTP
              endpoint). A topic shaped table:<6 chars>:<64 hex> joins. A PRIVATE channel (config.private:true) without a user
              is refused: status "CHANNEL_ERROR", "Unauthorized: You do not have permissions to read from this Channel topic".
              Status strings seen: SUBSCRIBED, CLOSED, CHANNEL_ERROR. Not provoked: TIMED_OUT. A client may also publish to a
              public channel (channel.send) and the other client receives it — the reason every push is sealed (see onPayload). */
function supabaseTransport(config){
  config = config || {};
  const base = String(config.url || "").replace(/\/+$/, ""), fnName = config.fn || "table";
  const doFetch = config.fetch || (typeof fetch === "function" ? (u, i) => fetch(u, i) : null);
  let client = null;
  const getClient = () => client ? Promise.resolve(client) : loadSupabase(config).then(lib => (client = lib.createClient(base, config.key,
    {auth: {persistSession: false, autoRefreshToken: false}, realtime: {params: {eventsPerSecond: 20}}})));
  return {
    async post(env){
      if(!doFetch || !base) throw transportErr();
      let resp;
      try {
        resp = await doFetch(base + "/functions/v1/" + fnName, {method: "POST", headers: {"content-type": "application/json", apikey: config.key},
          body: JSON.stringify(env)});
      } catch(_){ throw transportErr(); }
      if(!resp || !resp.ok) throw transportErr({status: resp && resp.status});
      let body; try { body = await resp.json(); } catch(_){ throw transportErr(); }
      return body;
    },
    subscribe(topic, onPayload, onState){
      let ch = null, dead = false, retry = null, told = false;
      const attempt = () => { if(dead) return; getClient().then(c => {
        if(dead) return;
        ch = c.channel(topic, {config: {broadcast: {self: false}}});
        ch.on("broadcast", {event: "frame"}, msg => { if(!dead) onPayload(msg && msg.payload); })
          .subscribe(s => { if(dead || !onState) return; if(s === "SUBSCRIBED") onState("joined"); else if(s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") onState("lost"); });
      }).catch(() => { if(!dead && onState && !told){ told = true; onState("lost"); } if(!dead) retry = setTimeout(attempt, 10000); });
    };
    attempt();
    return () => { dead = true; if(retry) clearTimeout(retry); try { if(ch && client) client.removeChannel(ch); } catch(_){} };
    }
  };
}

/* the transport the page uses: a drive or test may install one first (window.__dawnServerTransport — never the fake
   by default); otherwise the real one, built from the page's config. Cheap: nothing is fetched here. */
function defaultTransport(config, root_){
  const w = root_ || (typeof window !== "undefined" ? window : null);
  if(w && w.__dawnServerTransport) return w.__dawnServerTransport;
  /* THE SWITCH (index.html `window.SERVER_TABLE.on`): off, no server code path can start — the page does not even
     offer the option, and this transport answers "unavailable" without a request or a script tag. */
  if(!config || config.on !== true) return {post: () => Promise.reject(transportErr()), subscribe: () => () => {}};
  return supabaseTransport(config);
}

return {TABLE_CODE_CHARS: CODE_CHARS, CODE_LEN, STATUS, SUPABASE_JS, normalize, isValid, topicFor, open, startTable, sitAt, reclaim, savedSeats, testerDoor,
        supabaseTransport, loadSupabase, defaultTransport};
});
