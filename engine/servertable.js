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
const CH_JUDGE = "judge", CH_LOBBY = "lobby", CH_NET = "net", CH_CLOCK = "clock", CH_REMATCH = "rematch";
const clone = v => JSON.parse(JSON.stringify(v));
const defaultSleep = ms => new Promise(r => setTimeout(r, ms));

/* an Error whose `why` is a short machine word the screen maps to a sentence */
const fail = (why, detail) => Object.assign(new Error(detail || why), {why});
/* the referee's refusals, as the words a screen reasons in */
const WHY_OF = {"no-table": "no-table", full: "full", auth: "auth", wire: "wire", exists: "exists", "bad-request": "bad-request", "seat-owned": "seat-owned", "table-cap": "table-cap",
  "ranked-signin": "ranked-signin", "ranked-name": "ranked-name", unavailable: "unavailable"};

/* a transport failure: the network, a function that is not there, a paused
   project, a page that is not the referee. Never carries the request. */
const transportErr = e => Object.assign(new Error("server unreachable"), {transport: true, why: "unavailable", status: e && e.status});

function scrubber(){
  const secrets = [];
  const f = v => { let s = String(v == null ? "" : (v.message || v)); for(const k of secrets) if(k) s = s.split(k).join("…"); return s; };
  f.add = k => { if(k && secrets.indexOf(k) < 0) secrets.push(k); };
  return f;
}

/* S5.1: a RANKED table is asked for in the create request (`ranked: true`); the one place that says so is this wrapper around the transport, so the create
   call below stays the casual one for everybody else */
function rankedWire(T, ranked){
  if(!ranked || !T || typeof T.post !== "function") return T;
  return {post: env => T.post(env && env.op === "create" ? {...env, ranked: true} : env), subscribe: (a, b, c) => T.subscribe(a, b, c)};
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
   an Error whose `.why` is unavailable | no-table | full | auth | wire | code | table-cap (S4.4: opening as a signed-in
   player met the cap of open tables; `.open` holds their codes) | ranked-signin | ranked-name (S5.1: a ranked table needs a signed-in player with a chosen
   name, to open it and to sit at it). `o.ranked: true` (mode create) asks for a RANKED table: there is no casual fallback for it. */
async function open(o){
  o = o || {};
  const T = rankedWire(o.transport, o.ranked === true), mode = o.mode || "join";
  if(!T || typeof T.post !== "function" || typeof T.subscribe !== "function") throw fail("unavailable", "no transport");
  const keep = o.keep || null;
  const kget = k => { try { return keep ? keep.get(k, null) : null; } catch(_){ return null; } };
  const kset = (k, v) => { try { if(keep) keep.set(k, v); } catch(_){} };
  let code = normalize(o.code), rec = null;
  const scrub = scrubber();
  const say = s => { try { if(o.onStatus) o.onStatus(s); } catch(_){} };
  say("connecting");

  const refusal = r => fail(WHY_OF[r.refused] || "unavailable", "refused: " + r.refused);
  /* WHO IS SITTING DOWN (S4.2). `o.identity` ({token() -> Promise<string|null>}; `supabaseIdentity` on the page, a fake in
     the drills) signs this phone in LAZILY, here, the first time it opens or joins a server table. With a token the seat is
     bound to the player (the referee's `owners`); with none (sign-in off, unreachable, refused) the join is the casual one,
     byte for byte: a game must never wait on an account. A keyed claim (resume) needs no token: the key holds the chair.
     S4.4: the token is asked BEFORE a table is opened too, because opening one as a signed-in player is what the referee counts
     (at most 5 open tables per player). */
  let token = null;
  if(mode !== "resume" && o.identity && typeof o.identity.token === "function"){ try { token = await o.identity.token(); } catch(_){ token = null; } }
  if(typeof token !== "string" || !token) token = null;
  if(token) scrub.add(token);
  if(mode === "create"){
    let made = null, asToken = token;
    for(let i = 0; i < 3 && !made; i++){
      const r = await call(T, {op: "create", ...(asToken ? {identity: {token: asToken}} : {})});
      if(r.ok && typeof r.table === "string") made = r.table;
      else if(r.refused === "exists" && r.retry) continue;
      /* the referee would not take the sign-in (expired between the check and the call, or no provider there): open the table casually,
         and sit down at it casually too. Nothing was written by the refusal. */
      else if(r.refused === "identity" && o.ranked === true) throw fail("identity", "refused: identity");      /* a RANKED table has no casual fallback (S5.1) */
      else if(r.refused === "identity" && asToken){ asToken = null; token = null; i--; continue; }
      /* THE CAP (S4.4): this player already holds the most open tables there may be. The codes ride along so the screen can say which. */
      else if(r.refused === "table-cap") throw Object.assign(refusal(r), {open: (Array.isArray(r.open) ? r.open : []).map(normalize).filter(isValid).slice(0, 10), cap: Number(r.cap) > 0 ? Number(r.cap) : null});
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
  let req0 = mode === "resume" ? {op: "join", table: code, seat: rec.seat, key: rec.key} : {op: "join", table: code, claim, ...(token ? {identity: {token}} : {})};
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
    /* the referee would not take the sign-in (expired between the check and the call, or no provider there): sit down
       casually instead. Nothing was written by the refusal, and the claim token is the same. */
    if(!res.ok && res.refused === "identity" && req0.identity){ req0 = {op: "join", table: code, claim}; token = null; continue; }
    if(res.ok || res.refused !== "conflict") break;
    await sleep0(Math.min(tune0.max, tune0.base * Math.pow(2, k)) * (0.5 + (o.rand || Math.random)()));
  }
  if(!res.ok){
    if(mode === "resume" && res.refused === "auth") kset("srv." + code, null);   /* a seat that is not ours any more */
    if(res.refused === "auth" && res.taken === true) throw fail("taken", "refused: auth (taken)");
    if(mode === "resume" && res.refused === "no-table") kset("srv." + code, null);
    throw refusal(res);
  }
  if(res.seat !== 0 && res.seat !== 1) throw fail("unavailable");
  let key = rec ? rec.key : null;
  if(!key) for(const f of res.frames || []) if(f && f.ch === CH_JUDGE && typeof f.key === "string") key = f.key;
  if(!key) throw fail("unavailable", "the table dealt no seat key");
  scrub.add(key);
  kset("srv." + code, {seat: res.seat, key, role: mode === "create" ? "creator" : (rec && rec.role) || (o.role === "creator" ? "creator" : "joiner"), at: (o.now || Date.now)()});
  return channel(o, T, code, res.seat, key, res.n | 0, res.frames || [], scrub, keep, {owned: res.owned === true, names: res.names, ranked: res.ranked, ratings: res.ratings, result: res.result});
}

/* ---- the channel ----------------------------------------------------------- */
function channel(o, T, code, seat, key, n0, firstFrames, scrub, keep, who){
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
  /* the two display names, public to both seats (S4.2): they ride a join's and a resync's answer, never a push */
  const owned = !!(who && who.owned);
  let names = [null, null], namesAsked = false, started = false;
  const wantNames = !!(o.identity || o.onNames);      /* a casual drill's request count is untouched */
  const readNames = v => { if(!Array.isArray(v) || v.length !== 2) return;
    const nx = v.map(x => typeof x === "string" && x.length <= 64 ? x : null);
    if(nx[0] === names[0] && nx[1] === names[1]) return;
    names = nx; try { if(o.onNames) o.onNames(names.slice()); } catch(_){} };
  readNames(who && who.names);
  /* S5.1: a RANKED table, public to both seats like the names: that it is ranked, each player's rating as they sat down, and — once the game is
     decided and recorded — how it ended and each rating's move. They ride a join's and a resync's answer (and the answer to the move that ended the
     game), never a push; a casual table's answers carry none of it and `rank()` stays {ranked: false}. */
  let ranked = false, ratings = [null, null], result = null;
  const readClock0 = v => readClock(v);
  const readRank = v => { if(!v || typeof v !== "object" || (v.ranked !== true && !ranked)) return;
    if(v.ranked === true) readClock0(v.clock);                           /* a join's or resync's answer is the whole truth about the clock: none in it means none runs */       /* the answer to a move carries `result` alone: this phone already knows the table is ranked */
    let changed = !ranked; ranked = true;
    if(Array.isArray(v.ratings) && v.ratings.length === 2){ const nr = v.ratings.map(x => Number.isInteger(x) && x >= 0 && x < 100000 ? x : null);
      if(nr[0] !== ratings[0] || nr[1] !== ratings[1]){ ratings = nr; changed = true; } }
    const r = v.result;
    if(!result && r && typeof r === "object" && (r.winner === 0 || r.winner === 1 || r.winner === null) && typeof r.how === "string" && Array.isArray(r.change) && r.change.length === 2
       && r.change.every(c => c && Number.isInteger(c.from) && Number.isInteger(c.to))){
      result = {winner: r.winner, how: r.how, turns: Number.isInteger(r.turns) ? r.turns : null, change: r.change.map(c => ({from: c.from, to: c.to}))}; changed = true; }
    if(changed) try { if(o.onRank) o.onRank({ranked, ratings: ratings.slice(), result: result ? clone(result) : null}); } catch(_){} };
  /* S5.2: THE FORFEIT CLOCK, as this phone was last told it (a sealed frame with a push, or `clock` in a join's or resync's answer). It is the SERVER's account:
     which seat the game waits on, how long it has waited as the server counts it (`age`), and the limit. This phone adds only the time elapsed on ITS OWN clock since
     it heard, so `clock().left` is a display; whether a claim is due is the function's decision alone. null: no clock runs (casual table, nobody waited on, game over). */
  let clk = null;
  const readClock = v => {
    let nx = null;
    if(v && typeof v === "object" && (v.on === 0 || v.on === 1) && Number.isFinite(v.age) && v.age >= 0 && Number.isFinite(v.limit) && v.limit > 0)
      nx = {on: v.on, age: v.age, limit: v.limit, at: (o.now || Date.now)()};
    const same = (!nx && !clk) || (nx && clk && nx.on === clk.on && nx.age === clk.age && nx.limit === clk.limit);
    clk = nx;
    if(!same) try { if(o.onClock) o.onClock(handle.clock()); } catch(_){}
  };
  readRank(who);
  if(who && who.ranked === true) readClock(who.clock);
  /* v6.83: REMATCH — who has asked for one ([seat 0, seat 1]) and, once both have, the NEW table's code. A sealed push on its own channel when the
     other player asks or cancels, and `rematch` in a join's or resync's answer (so a missed push heals). Only ever moves forward to a code. */
  let rm = {want: [false, false], table: null};
  const rmFns = [];
  const readRematch = v => {
    if(!v || typeof v !== "object" || !Array.isArray(v.want) || v.want.length !== 2) return;
    const table = typeof v.table === "string" && isValid(v.table) ? normalize(v.table) : null;
    if(rm.table && !table) return;                                     /* a code, once known, is never taken back */
    const nx = {want: table ? [true, true] : v.want.map(x => x === true), table};
    if(nx.table === rm.table && nx.want[0] === rm.want[0] && nx.want[1] === rm.want[1]) return;
    rm = nx;
    for(const f of rmFns.slice()) try { f(handle.rematch()); } catch(_){}
  };
  readRematch(who && who.rematch);

  const deliver = f => { if(sink) sink(f); else backlog.push(f); };
  /* what comes up from the server: the seat offer once (key taken out), lobby and net frames as they are */
  function ingest(frames){
    for(const f0 of frames || []){
      if(!f0 || typeof f0 !== "object") continue;
      if(f0.ch === CH_JUDGE){
        /* the same player sat down on another phone: this key is retired (sealed push, or a first frame) */
        if(f0.taken === true){ fatal("taken"); return; }
        if(judgeSent) continue;
        judgeSent = true;
        const {key: _k, ...rest} = f0;                    /* THE KEY STOPS HERE */
        deliver(clone(rest)); continue;
      }
      if(f0.ch === CH_CLOCK){ readClock(f0.m); continue; }                 /* S5.2: the forfeit clock, sealed with the push; never handed up to the game */
      if(f0.ch === CH_REMATCH){ readRematch(f0.m); continue; }             /* v6.83: the other player asked for (or took back) a rematch */
      if(f0.ch !== CH_LOBBY && f0.ch !== CH_NET) continue;
      if(f0.ch === CH_NET) sawNet = true;
      if(!peerHeard && ((f0.ch === CH_LOBBY && f0.m && f0.m.seat === peerSeat) || (f0.ch === CH_NET))){ peerHeard = true; }
      deliver(clone(f0));
    }
    if(peerHeard && st === "waiting") set("seated");
    /* the other player just sat down: ask once who they are (their name rides a join's answer, not a push) */
    if(started && wantNames && peerHeard && !namesAsked && names[peerSeat] == null){ namesAsked = true; Promise.resolve().then(() => { if(!closed) heal(); }); }
  }
  ingest(firstFrames);
  started = true;                        /* the join's own answer already carried the names it knew */
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
      if(r.ok){ n++; readRank(r); ingest(r.frames); return true; }
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
      if(r.refused === "auth" || r.refused === "no-table" || r.refused === "wire"){ fatal(r.refused === "auth" && r.taken === true ? "taken" : r.refused); return false; }
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
    if(!r.ok){ if(r.refused === "auth" || r.refused === "no-table") fatal(r.refused === "auth" && r.taken === true ? "taken" : r.refused); return null; }
    readNames(r.names); readRank(r); readRematch(r.rematch);
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
          if(r && r.ok){ readNames(r.names); readRank(r); readRematch(r.rematch); ingest(r.frames); ok1 = true; }
          else if(r && (r.refused === "auth" || r.refused === "no-table")) fatal(r.refused === "auth" && r.taken === true ? "taken" : r.refused);
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
    /* v6.87: LEAVING TAKES A PENDING REMATCH ASK BACK — the other player's page stops saying "wants a rematch" at once, not after REMATCH_MS. Best effort,
       sent before the table shuts; never waited for, never thrown. A code already agreed (rm.table) is not taken back. */
    close(){
      if(!closed && rm.want[seat] === true && !rm.table){
        try { const p = call(T, {op: "rematch", table: code, seat, key, cancel: true}); if(p && p.catch) p.catch(() => {}); } catch(_){}
      }
      stop();
    },
    status: () => st,
    /* beyond room.js's shape */
    peerHeard: () => peerHeard,
    /* ask the referee for anything this phone missed, now (the found-match window asks every few seconds whether the table it waits at was given back) */
    refresh: () => { try { const p = heal(); if(p && p.catch) p.catch(() => {}); } catch(_){} },
    closedWhy: () => closedWhy,
    names: () => names.slice(),          /* [seat 0's display name | null, seat 1's] */
    /* S5.1: {ranked, ratings: [seat 0's rating | null, seat 1's], result: null | {winner, how, turns, change: [{from, to}, {from, to}]}} (index = seat) */
    rank: () => ({ranked, ratings: ratings.slice(), result: result ? clone(result) : null}),
    /* the recorded result of a decided ranked game, or null: the function records it as the game ends, and the answer to the move that ended it
       carries it for the seat that made it; the other seat asks here (a few tries, `gapMs` apart: the record is one more round trip behind the move).
       A casual table answers null at once. */
    async result(tries, gapMs){
      const nTry = tries > 0 ? tries : 6, gap = gapMs >= 0 ? gapMs : 1000;
      for(let i = 0; i < nTry; i++){
        if(result) return clone(result);
        if(closed || !ranked) break;
        await heal();
        if(result) return clone(result);
        if(i + 1 < nTry) await sleep(gap);
      }
      return result ? clone(result) : null;
    },
    /* S5.2: the forfeit clock as this phone can show it: {on: the seat the game waits on, left: ms until a claim may be made (never below 0; the server's
       age plus this phone's own elapsed time), limit, mine: the game waits on THIS seat, due: left is 0 and the wait is on the other seat}, or null */
    clock(){
      if(!clk || closed) return null;
      const left = Math.max(0, clk.limit - clk.age - Math.max(0, (o.now || Date.now)() - clk.at));
      return {on: clk.on, left, limit: clk.limit, mine: clk.on === seat, due: clk.on !== seat && left === 0};
    },
    /* S5.2: CLAIM THE WIN. Asks the function to end the game the other player has abandoned; the function decides (its own stamp, its own pending decision). Resolves
       {result} (and the game's ending arrives like any move); rejects with `.why`: claim-early (`.left` ms to wait) | claim-self | claim-idle | claim-over | claim-casual |
       auth | no-table | unavailable. A lost version race is asked again (the function then answers the truth). */
    async claimWin(){
      if(closed) throw fail("no-table");
      for(let k = 0; k < 5; k++){
        const r = await call(T, {op: "claim", table: code, seat, key});
        if(r.ok){ readRank(r); if(r.result) readRank({result: r.result}); ingest(r.frames); readClock(null); return {result: result ? clone(result) : null}; }
        if(r.refused === "conflict" || r.retry === true){ await pause(k); continue; }
        if(r.refused === "claim-early"){ if(Number.isFinite(r.left) && r.left >= 0 && clk) clk = {...clk, age: Math.max(clk.age, clk.limit - r.left), at: (o.now || Date.now)()}; throw Object.assign(fail("claim-early"), {left: Number.isFinite(r.left) ? r.left : null}); }
        if(r.refused === "auth" || r.refused === "no-table") throw fail(r.refused);
        if(/^claim-/.test(String(r.refused))) throw fail(r.refused);
        throw fail("unavailable", "refused: " + r.refused);
      }
      throw fail("unavailable", "the table kept changing");
    },
    /* v6.83: REMATCH. `rematch()` -> {want: [seat 0 asked, seat 1 asked], table: the new table's code | null, mine: this seat asked, theirs: the other did};
       `onRematch(fn)` calls fn with it whenever it changes (returns an unsubscribe). `askRematch(cancel)` asks (or takes the ask back) — the referee decides:
       resolves {state: "waiting"|"ready"|"cancelled"|"none", table?}; rejects with `.why`: rematch-playing | rematch-alone | ranked-signin | ranked-name |
       table-cap (`.open`) | identity | auth | no-table | unavailable. A lost version race (the other player wrote first) is asked again. With a sign-in the ask
       carries it: the player who completes the pair opens the new table, counted like any table they open. */
    rematch: () => ({want: rm.want.slice(), table: rm.table, mine: rm.want[seat], theirs: rm.want[peerSeat]}),
    onRematch(fn){ if(typeof fn !== "function") return () => {}; rmFns.push(fn); return () => { const i = rmFns.indexOf(fn); if(i >= 0) rmFns.splice(i, 1); }; },
    async askRematch(cancel){
      if(closed) throw fail("no-table");
      let tok = null;
      if(!cancel && o.identity && typeof o.identity.token === "function"){ try { tok = await o.identity.token(); } catch(_){ tok = null; } }
      if(typeof tok !== "string" || !tok) tok = null; else scrub.add(tok);
      for(let k = 0; k < 6; k++){
        let r;
        try { r = await call(T, {op: "rematch", table: code, seat, key, ...(tok ? {identity: {token: tok}} : {}), ...(cancel ? {cancel: true} : {})}); }
        catch(e){ if(k < 2){ await pause(k); continue; } throw e; }
        if(r.ok){
          const st = String(r.state);
          if(st === "ready" && typeof r.table === "string" && isValid(r.table)) readRematch({want: [true, true], table: r.table});
          else if(st === "waiting" && Array.isArray(r.want)) readRematch({want: r.want, table: null});
          else if(st === "cancelled" || st === "none"){ const w = rm.want.slice(); w[seat] = false; readRematch({want: w, table: null}); }
          return {state: st, ...(rm.table ? {table: rm.table} : {})};
        }
        if(r.refused === "conflict" || r.retry === true){ await pause(k); continue; }
        if(r.refused === "table-cap") throw Object.assign(fail("table-cap"), {open: (Array.isArray(r.open) ? r.open : []).map(normalize).filter(isValid).slice(0, 10)});
        if(r.refused === "rematch-playing" || r.refused === "rematch-alone") throw fail(r.refused);
        throw fail(WHY_OF[r.refused] || "unavailable", "refused: " + r.refused);
      }
      throw fail("unavailable", "the table kept changing");
    },
    /* v6.88: close one of THIS player's own open tables from here (the end screen's full-tables help): the same call as `closeTable`, over this table's wire and
       sign-in. Resolves as closeTable does; rejects with its `.why`. */
    closeOwn: c => closeTable({transport: T, identity: o.identity, sleep: o.sleep}, c),
    owned: () => owned,                  /* this seat is bound to this phone's player */
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

/* ---- WHO AM I / MY NAME (S4.2) ---------------------------------------------------------------------------------
   o: {transport, identity}. `whoAmI(o)` -> {name | null, rating?, games?, wins?, losses?, draws?} (S5.1: the rating and the record, public by design, when the
   function reads ratings); `setName(o, name)` -> the same. Both sign this phone in if it
   is not yet (lazily: only a server table or the name sheet ever asks). Rejects with `.why`:
     unavailable (no sign-in, no server) | name (the referee's validator refused it; `.reason`: short | long | chars |
     space | reserved | type) | name-taken (another player holds it; names are unique whatever the capitals, spaces or
     look-alike letters) | identity (the server would not take this sign-in).
   The referee is THE validator: nothing here judges a name, so the page and the server cannot disagree. */
async function me(o, name){
  o = o || {};
  const T = o.transport;
  if(!T || typeof T.post !== "function" || !o.identity || typeof o.identity.token !== "function") throw fail("unavailable", "no sign-in");
  let token = null; try { token = await o.identity.token(); } catch(_){ token = null; }
  if(typeof token !== "string" || !token) throw fail("unavailable", "no sign-in");
  const r = await call(T, {op: "me", identity: {token}, ...(name !== undefined ? {name} : {})});
  if(r.ok) return {name: typeof r.name === "string" ? r.name : null,
    ...(Number.isInteger(r.rating) ? {rating: r.rating, games: r.games | 0, wins: r.wins | 0, losses: r.losses | 0, draws: r.draws | 0} : {})};   /* S5.1: the rating and the record, when the function reads ratings */
  if(r.refused === "name-taken") throw fail("name-taken");
  if(r.refused === "bad-request" && r.field === "name") throw Object.assign(fail("name"), {reason: typeof r.reason === "string" ? r.reason : "chars"});
  if(r.refused === "identity") throw fail("identity");
  throw fail("unavailable", "refused: " + r.refused);
}
const whoAmI = o => me(o);
const setName = (o, name) => me(o, name);

/* ---- THE LADDER (S5.3): who stands where, and the last games — PUBLIC, read with no sign-in --------------------------------------------
   o: {transport, identity?}. `ladder(o)` -> {floor, cap, ladder: [{rank, name, rating, games, wins, losses, draws}], recent: [{names: [a, b], heroes: [a, b],
   winner: 0 | 1 | null, how: "life" | "concession" | "stalemate" | "forfeit", at}], mine?: [{hero, foeHero, foe | null, result: "won" | "lost" | "drew", how, change, at}] (a named player's own last games, newest first), you: {name | null, rating, games, wins, losses, draws, listed, rank | null, toGo} | null}.
   `you` is the caller's own line and exists only when `o.identity` yields a token the server knows: pass an identity ONLY for a phone that already has a sign-in
   (looking at the ladder must never sign anyone in; the page asks `known()` first). A token the server refuses is not an error: the list still answers, without `you`.
   One copy: the page and the drills call this and nothing else. Rejects with `.why`: unavailable (no server, a function that does not do this yet, or an answer that is
   not a ladder). Nothing is cached here and nothing is written anywhere. The server decides who is listed (a chosen name, three ranked games); nothing here judges it. */
const LADDER_HOW = ["life", "concession", "stalemate", "forfeit"];
const isInt = v => Number.isInteger(v) && v >= 0;
async function ladder(o){
  o = o || {};
  const T = o.transport;
  if(!T || typeof T.post !== "function") throw fail("unavailable", "no transport");
  let token = null;
  if(o.identity && typeof o.identity.token === "function"){ try { token = await o.identity.token(); } catch(_){ token = null; } }
  const r = await call(T, {op: "ladder", ...(typeof token === "string" && token ? {identity: {token}} : {})});
  if(!r.ok) throw fail("unavailable", "refused: " + r.refused);
  const bad = () => fail("unavailable", "an answer that is not a ladder");
  if(!Array.isArray(r.ladder) || !Array.isArray(r.recent) || !isInt(r.floor) || !isInt(r.cap)) throw bad();
  const rec = x => x && typeof x === "object" && typeof x.name === "string" && ["rank", "rating", "games", "wins", "losses", "draws"].every(k => isInt(x[k]));
  if(!r.ladder.every(rec)) throw bad();
  const rows = r.ladder.map(x => ({rank: x.rank, name: x.name, rating: x.rating, games: x.games, wins: x.wins, losses: x.losses, draws: x.draws}));
  const recent = r.recent.filter(x => x && Array.isArray(x.names) && x.names.length === 2 && Array.isArray(x.heroes) && x.heroes.length === 2 && x.heroes.every(h => typeof h === "string")
    && (x.winner === null || x.winner === 0 || x.winner === 1) && LADDER_HOW.indexOf(x.how) >= 0 && isInt(x.at))
    .map(x => ({names: x.names.map(n => typeof n === "string" ? n : null), heroes: x.heroes.slice(), winner: x.winner, how: x.how, at: x.at}));
  let you = null;
  const y = r.you;
  if(y && typeof y === "object" && ["rating", "games", "wins", "losses", "draws", "toGo"].every(k => isInt(y[k])) && typeof y.listed === "boolean")
    you = {name: typeof y.name === "string" ? y.name : null, rating: y.rating, games: y.games, wins: y.wins, losses: y.losses, draws: y.draws, listed: y.listed, rank: y.listed && isInt(y.rank) ? y.rank : null, toGo: y.toGo};
  /* 012: a named player's own last games (newest first), or no `mine` key when this server does not send them (an older function, a nameless or signed-out player): the page then shows nothing new */
  const OUTCOME = ["won", "lost", "drew"];
  const mine = Array.isArray(r.mine) && you ? r.mine.filter(x => x && typeof x.hero === "string" && typeof x.foeHero === "string" && (x.foe === null || typeof x.foe === "string") && OUTCOME.indexOf(x.result) >= 0
    && LADDER_HOW.indexOf(x.how) >= 0 && Number.isInteger(x.change) && isInt(x.at)).slice(0, 10).map(x => ({hero: x.hero, foeHero: x.foeHero, foe: x.foe, result: x.result, how: x.how, change: x.change, at: x.at})) : null;
  return {floor: r.floor, cap: r.cap, ladder: rows, recent, you, ...(mine ? {mine} : {})};
}

/* ---- RECOVERY CODE (S4.3): a lost phone is not a lost player ---------------------------------------------------
   o: {transport, identity}, as whoAmI. `recoveryMint(o)` -> {code, days}: the signed-in player's NEW recovery code, in the clear, ONCE (the
   server keeps only its hash; the page must show it and then forget it — nothing here stores it). A new code retires the old one.
   `recoveryRedeem(o, code, tables?)` -> {name | null}: this phone's own (new) sign-in now belongs to the code's player, so its name and
   its seats are back. `code` is typed by a person: nothing here judges it, the server reads it leniently (case, spaces, dashes). `tables`:
   the table codes this phone has sat at; the server refuses while this phone's current player holds a chair at one of them. Rejects with `.why`:
     unavailable (no sign-in, no server, or the server does not do this yet) | identity (the server would not take this sign-in) |
     recovery (that code does not work: wrong, used, expired or replaced — the server says no more than that) |
     recovery-limited (too many wrong tries; wait an hour) | recovery-seated (this phone is sitting at a table: leave it first). */
async function recoveryCall(o, req){
  o = o || {};
  const T = o.transport;
  if(!T || typeof T.post !== "function" || !o.identity || typeof o.identity.token !== "function") throw fail("unavailable", "no sign-in");
  let token = null; try { token = await o.identity.token(); } catch(_){ token = null; }
  if(typeof token !== "string" || !token) throw fail("unavailable", "no sign-in");
  const r = await call(T, {...req, identity: {token}});
  if(r.ok) return r;
  if(r.refused === "recovery" || r.refused === "recovery-limited" || r.refused === "recovery-seated" || r.refused === "identity") throw fail(r.refused);
  throw fail("unavailable", "refused: " + r.refused);
}
async function recoveryMint(o){
  const r = await recoveryCall(o, {op: "recovery-mint"});
  if(typeof r.code !== "string" || !r.code) throw fail("unavailable", "no code");
  return {code: r.code, days: Number(r.days) > 0 ? Number(r.days) : null};
}
async function recoveryRedeem(o, code, tables){
  const list = (Array.isArray(tables) ? tables : []).map(normalize).filter(isValid).slice(0, 6);
  const r = await recoveryCall(o, {op: "recovery-redeem", code: String(code == null ? "" : code), ...(list.length ? {tables: list} : {})});
  return {name: typeof r.name === "string" ? r.name : null};
}

/* ---- THE SIGN-IN (S4.2): an anonymous Supabase user, kept on this phone ---------------------------------------
   No email, no password, nothing typed: the first time a server table (or the name sheet) needs to know who this phone
   is, it asks the project's auth service for an anonymous user and keeps the session in `keep` under "who.id"
   ({a: access token, r: refresh token, exp: ms}). `token()` answers a usable access token or null:
     - a stored token with more than two minutes left: that one, no request;
     - else the refresh token is traded for a new pair;
     - a refresh the service REFUSES (400/401/403: the sign-in is gone) or no session at all: a new anonymous user —
       a NEW PLAYER. Until S4.3's recovery code that is the only way back, and it is why a network failure or a 5xx
       is never read as a refusal: they answer null (this table is casual) and the session is kept for next time.
   Callers share one request in flight. Nothing here is a secret of the game: the token says who the PLAYER is, the
   referee turns it into a seat, and the seat key (never this token) is what moves a card.
   VERIFIED live 2026-11-14: POST /auth/v1/signup {} and POST /auth/v1/token?grant_type=refresh_token
   {refresh_token}, both with the publishable key as `apikey`, answer {access_token, refresh_token, expires_in}. */
function supabaseIdentity(config, keep, o){
  config = config || {}; o = o || {};
  const base = String(config.url || "").replace(/\/+$/, "");
  const doFetch = config.fetch || (typeof fetch === "function" ? (u, i) => fetch(u, i) : null);
  const now = o.now || Date.now, K = "who.id";
  const kget = () => { try { return keep ? keep.get(K, null) : null; } catch(_){ return null; } };
  const kset = v => { try { if(keep) keep.set(K, v); } catch(_){} };
  const ask = (path, body) => doFetch(base + path, {method: "POST", headers: {"content-type": "application/json", apikey: config.key}, body: JSON.stringify(body)});
  async function take(resp){
    let j; try { j = await resp.json(); } catch(_){ return null; }
    if(!j || typeof j.access_token !== "string" || !j.access_token || typeof j.refresh_token !== "string" || !j.refresh_token) return null;
    const secs = Number(j.expires_in);
    kset({a: j.access_token, r: j.refresh_token, exp: now() + (secs > 0 ? secs : 3600) * 1000});
    return j.access_token;
  }
  async function fresh(){
    const rec = kget();
    if(rec && typeof rec.a === "string" && rec.a && Number(rec.exp) - 120000 > now()) return rec.a;
    if(!doFetch || !base || !config.key) return null;
    if(rec && typeof rec.r === "string" && rec.r){
      let resp; try { resp = await ask("/auth/v1/token?grant_type=refresh_token", {refresh_token: rec.r}); } catch(_){ return null; }
      if(resp && resp.ok) return take(resp);
      if(!resp || (resp.status !== 400 && resp.status !== 401 && resp.status !== 403)) return null;
    }
    let resp; try { resp = await ask("/auth/v1/signup", {}); } catch(_){ return null; }
    if(!resp || !resp.ok) return null;
    return take(resp);
  }
  let flight = null;
  return {
    token(){ if(!flight){ flight = fresh().then(v => { flight = null; return v; }, () => { flight = null; return null; }); } return flight; },
    known(){ const rec = kget(); return !!(rec && typeof rec.r === "string" && rec.r); }
  };
}
/* the sign-in the page uses: a drive may install one first (window.__dawnServerIdentity); with the door shut there is
   none (null: every table is casual and nothing is asked of the auth service) */
function defaultIdentity(config, keep, root_){
  const w = root_ || (typeof window !== "undefined" ? window : null);
  if(w && w.__dawnServerIdentity) return w.__dawnServerIdentity;
  if(!config || config.on !== true || config.signIn === false) return null;
  return supabaseIdentity(config, keep);
}

/* ---- FIND A MATCH (S6.1): the queue of players looking for an opponent -------------------------------------------------------------------------
   o: {transport, identity}. `seek(o, {ranked?, table?, cancel?})` asks the referee's queue once and resolves with
     {state: "matched", table}           somebody was waiting: sit down at `table` (sitAt) — the game starts at once
     {state: "waiting" | "taken", table, beat, typical?}   (`typical`: the usual wait in seconds, only when the server had enough seeks to say)   wait at `table` (this player's own: sitAt it, then call seek again every `beat` ms with {table});
                                         "taken": somebody is on their way there
     {state: "cancelled" | "none"}        (cancel) the seek is gone and its table closed
   `ranked: true` queues for a ranked table (a chosen name). The server decides every match; nothing here judges one. Rejects with `.why`: unavailable (no sign-in,
   no server, or a function that does not do this yet) | identity | ranked-name | table-cap (`.open`: this player's open tables) | code.
   `looking(o)` -> {friendly, ranked}: how many players wait in the queue right now (public; never signs in). Rejects `unavailable`. */
async function seek(o, q){
  o = o || {}; q = q || {};
  const T = o.transport;
  if(!T || typeof T.post !== "function" || !o.identity || typeof o.identity.token !== "function") throw fail("unavailable", "no sign-in");
  let token = null; try { token = await o.identity.token(); } catch(_){ token = null; }
  if(typeof token !== "string" || !token) throw fail("unavailable", "no sign-in");
  const table = q.table == null ? null : normalize(q.table);
  if(table != null && !isValid(table)) throw fail("code", "a table code is " + CODE_LEN + " characters");
  const r = await call(T, {op: "seek", identity: {token}, ...(q.ranked === true ? {ranked: true} : {}), ...(q.cancel === true ? {cancel: true} : {}), ...(table ? {table} : {})});
  if(r.ok){
    const st = r.state;
    if((st === "matched" || st === "waiting" || st === "taken") && isValid(normalize(r.table)))
      return {state: st, table: normalize(r.table), ...(st !== "matched" ? {beat: Number.isInteger(r.beat) && r.beat >= 2000 ? r.beat : 20000} : {}),
        ...(st === "waiting" && Number.isInteger(r.typical) && r.typical >= 5 && r.typical <= 86400 ? {typical: r.typical} : {})};
    if(st === "cancelled" || st === "none") return {state: st};
    throw fail("unavailable", "an answer that is not a seek");
  }
  if(r.refused === "table-cap") throw Object.assign(fail("table-cap"), {open: (Array.isArray(r.open) ? r.open : []).map(normalize).filter(isValid).slice(0, 10), cap: Number(r.cap) > 0 ? Number(r.cap) : null});
  if(["identity", "ranked-name", "ranked-signin"].indexOf(r.refused) >= 0) throw fail(r.refused, "the queue refused: " + r.refused);
  throw fail("unavailable", "the queue refused: " + r.refused);
}
async function looking(o){
  o = o || {};
  const T = o.transport;
  if(!T || typeof T.post !== "function") throw fail("unavailable", "no transport");
  const r = await call(T, {op: "looking"});
  if(!r.ok || !isInt(r.friendly) || !isInt(r.ranked)) throw fail("unavailable", "refused: " + r.refused);
  return {friendly: r.friendly, ranked: r.ranked};
}

/* ---- CLOSE MY OWN TABLE (S4.4) -------------------------------------------------------------------------------------
   o: {transport, identity, sleep?}. `closeTable(o, code)` -> {closed:true}: the creator ends a table of theirs that nobody will play, which is
   how a player at the cap of open tables gets unstuck (a table nobody sits at counts as open until it has been idle 48 hours). The table is
   gone for both seats afterwards. S5.2: closing a RANKED table whose game has started is the creator's concession — the answer is then {closed:true, conceded:true,
   result?: {winner, how, change}} and the table is over, not gone (the other phone reads the ending). Rejects with `.why`: unavailable (no sign-in / server) | identity | no-table (not there, or already
   closed) | not-creator (it is somebody else's, or a casual table) . A lost version race is asked again. */
async function closeTable(o, code){
  o = o || {};
  const T = o.transport, c = normalize(code);
  if(!T || typeof T.post !== "function" || !o.identity || typeof o.identity.token !== "function") throw fail("unavailable", "no sign-in");
  if(!isValid(c)) throw fail("code", "a table code is " + CODE_LEN + " characters");
  let token = null; try { token = await o.identity.token(); } catch(_){ token = null; }
  if(typeof token !== "string" || !token) throw fail("unavailable", "no sign-in");
  const sleep = o.sleep || defaultSleep;
  for(let k = 0; k < 5; k++){
    const r = await call(T, {op: "close", table: c, identity: {token}});
    if(r.ok) return r.conceded === true ? {closed: true, conceded: true, ...(r.result && Array.isArray(r.result.change) ? {result: {winner: r.result.winner, how: r.result.how, change: r.result.change.map(c => ({from: c.from, to: c.to}))}} : {})} : {closed: true};
    if(r.refused === "identity" || r.refused === "no-table" || r.refused === "not-creator") throw fail(r.refused);
    if(r.retry === true){ await sleep(120 * (k + 1)); continue; }          /* a lost version race (the only retry:true answer) */
    throw fail("unavailable", "refused: " + r.refused);
  }
  throw fail("unavailable", "the table kept changing");
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

/* THE DOOR'S KILL SWITCH (v6.28; the tester's door of v6.26, kept). The table is open to everyone through the page's own switch
   (`window.SERVER_TABLE.on`); one phone can still say what it wants with the address: `?server=0` hides the server table on that phone
   (remembered through the page's `store` seam, so a home-screen relaunch that drops the query keeps it), `?server=1` brings it back
   (and offers it even while the shipped switch is off). Returns that phone's choice: true, false, or null (no choice: the shipped
   switch decides). `keep` is the page's store seam; `search` is location.search. Never throws. */
function doorChoice(keep, search){
  let q = null; try { q = new URLSearchParams(search || "").get("server"); } catch(_){}
  try {
    if(q === "1") keep.set("server", true);
    else if(q === "0") keep.set("server", false);
    const v = keep.get("server", null);
    return v === true ? true : v === false ? false : null;
  } catch(_){ return q === "1" ? true : q === "0" ? false : null; }
}
/* whether the server table is offered: this phone's choice beats the shipped switch */
function doorOpen(choice, on){ return choice === false ? false : (choice === true || on === true); }

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

return {TABLE_CODE_CHARS: CODE_CHARS, CODE_LEN, STATUS, SUPABASE_JS, normalize, isValid, topicFor, open, startTable, sitAt, reclaim, savedSeats, seek, looking, doorChoice, doorOpen,
        supabaseTransport, loadSupabase, defaultTransport, whoAmI, setName, ladder, recoveryMint, recoveryRedeem, closeTable, supabaseIdentity, defaultIdentity};
});
