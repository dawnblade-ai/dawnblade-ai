/* ============================================================
   Dawnblade server — referee.js (SERVER S1: the hosted referee's pure core)

   The judge's table (engine/hub.js) as a STATELESS function. A hosted
   referee on an Edge Function (Deno) lives for one request and is gone: so
   every call here LOADS the table's row, REHYDRATES a hub from it, APPLIES
   the one frame, SAVES the row (optimistic version check) and PUSHES each
   seat the frames addressed to it on that seat's own channel.

     handle(request, deps) -> Promise<response>      (handleNow: same body, sync deps)

   NOT LOADED BY THE PAGE (headless, like engine/actions.js: test/serverref
   .test.js is the ledger that keeps it off index.html). It re-declares no
   engine export: hub.js owns the seats, the lobby and the keys, net.js the
   referee session, wire.js the snapshot, sha256.js the seat secrets.

   ---- deps ---------------------------------------------------------------
     store      {get(id) -> {version, row}|null, put(id, row, expectedVersion)
                 -> {ok, version}}   (expectedVersion 0 = "must not exist";
                 a put against any other version than the stored one is
                 {ok:false} — that is the whole concurrency story). Either
                 may return a promise.
     broadcast  (topic, payload) — fire the payload at the seat's channel
     deal       (spec) -> {state, catalog}   hub.js's `deal`: the card
                database lives with the caller, as in the page and the isolate
     build      the build id both phones must match (hub.js's)
     now        () -> ms      rand  () -> a [0,1) function (default: crypto)
     log        (error) -> void   server-side only; never in a response

   ---- requests (one JSON frame; the payloads are hub.js's own) ----------
     {op:"create", table?}                       a fresh table (lobby open)
     {op:"join", table, claim?}                  the first seat nobody has
                                                 sat in; the answer carries
                                                 {ch:"judge", seat, key}.
                                                 `claim`: a token the phone
                                                 chose (16-64 of A-Za-z0-9_-);
                                                 asked again with the same
                                                 token the answer is the SAME
                                                 seat, key and lobby (a lost
                                                 answer can be retried)
     {op:"join", table, seat, key}               a returning phone's claim; the
                                                 answer's `n` is where its frame
                                                 counter resumes (above it)
     {op:"frame", table, seat, key, n, frame}    `frame` is a hub frame:
                {ch:"lobby", m} | {ch:"net", m} (intent, hello, resync…)
     {op:"resync", table, seat, key, have?}      shorthand for the net
                                                 resync frame; never writes
     `key` is the secret hub.js dealt that seat. `n` is the phone's frame
     counter: a frame whose n is not above the last one APPLIED for that seat
     is stale (a replay, or one that overtook a newer) and is refused.

   ---- responses ----------------------------------------------------------
     {ok:true, version, frames:[...]}   `frames`: what the CALLER's seat
        receives from this call, in order — its commits, a nack, a hello's
        snapshot (a join's include its key, in the judge frame; no other
        response and no broadcast ever does). A caller that never got the
        response asks `resync`.
     {ok:false, refused: "auth"|"stale"|"conflict"|"no-table"|"exists"|
                 "full"|"not-dealt"|"bad-request"|"wire"|"internal", retry?}
        `conflict` (someone else wrote first) is the only retry:true.

   ---- broadcasts ---------------------------------------------------------
     topic table:<id>:<hash of the seat's key> (sha256.js seatTopic; PUBLIC
     channel — see there for the trade-off), payload {ver, frames:[{ch, m}...],
     mac} — `mac` is HMAC-SHA256 under the seat's key (sha256.js frameMac):
     a phone applies a push only if it verifies. ONLY
     that seat's frames (net.js sends each seat its own view), and only
     frames a CALLER is not already holding in its response: the other
     seat's. Sent after a successful save, never for a refused, read-only or
     conflicted call. No response ever names a topic: a phone derives its OWN from the key it was dealt,
     and the other seat's name is never sent to anyone.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("../engine/hub.js"), require("../engine/wire.js"), require("../engine/judge.js"), require("../engine/invariants.js"), require("../engine/sha256.js"));
  else root.DawnServer = factory(root.DawnHub, root.DawnWire, root.DawnJudge, root.DawnInvariants, root.DawnSHA);
})(typeof self!=="undefined" ? self : this, function(Hub, W, J, INV, SHA){

/* the stored row's own version: 1 (S1) -> 2 (S3: `claims`, the join tokens) */
const ROW_V = 2;
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/* a seat's channel: derived from its secret key by a one-way hash (sha256.js `seatTopic`), so the name is
   unguessable and never reveals the key. PUBLIC channel, CEO decision (casual stage): see sha256.js. */
const topic = (id, seat, key) => SHA.seatTopic(id, seat, key);
const CLAIM_RE = /^[A-Za-z0-9_-]{16,64}$/;
const clone = v => JSON.parse(JSON.stringify(v));

/* a value that may or may not be a promise: the core runs synchronously
   over synchronous deps (the drills' fakes) and asynchronously over a
   database, with ONE body */
const isP = v => !!v && typeof v.then === "function";
const then = (v, f) => isP(v) ? v.then(f) : f(v);

const no = (refused, extra) => ({ok: false, refused, ...(extra || {})});
/* equal strings, without stopping at the first difference */
const keyEq = (a, b) => { if(typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for(let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/* ---- one request's hub --------------------------------------------------
   `data` is the stored table (null: a new one). A seat the request needs is
   bound to a capturing connection through hub.js's own `connect` and claim,
   so the seat rules (a phone speaks for its own seat, a claim needs the key)
   are the hub's, not a copy. Frames the hub sends while a seat is being
   bound (its lobby replay) are dropped unless `replay` asks for them. */
function rig(id, data, deps){
  const out = [[], []], cap = [false, false], events = [], links = [null, null];
  const hub = Hub.createHub({code: id, build: deps.build, deal: deps.deal, reduce: J.reduce, legal: J.legal, check: INV.errors,
    rand: deps.rand ? deps.rand() : null, resume: data ? data.hub : null, onEvent: e => events.push(e)});
  /* a game already over when this instance woke has no reveal in memory:
     set it BEFORE any seat is bound, so it goes nowhere now and a returning
     phone's hello still gets it */
  const s0 = hub.session();
  if(s0 && s0.over()) s0.reveal({seedH: hub.seedH()});
  return {hub, out, cap, events, links,
    seat(seat, key, replay){
      cap[seat] = false;
      const link = hub.connect({send: f => { if(cap[seat]) out[seat].push(clone(f)); }, close: () => {}});
      cap[seat] = !!replay;
      link.receive({ch: Hub.CH.JUDGE, claim: seat, key});
      cap[seat] = true;
      links[seat] = link;
      return link;
    },
    /* a phone with no seat yet: whatever the hub says to it, in order */
    fresh(){
      const got = [];
      const link = hub.connect({send: f => got.push(clone(f)), close: () => {}});
      return {link, got};
    },
    mark: () => ({lob: hub.lobby(), seq: hub.info().seq})};
}

/* the row a table is stored as */
const newRow = (id, hub, deps) => ({v: ROW_V, wireV: W.WIRE_V, id, build: deps.build || null, hub: hub.persistTable(),
  nonces: [0, 0], claims: [null, null], created: deps.now ? deps.now() : 0, updated: deps.now ? deps.now() : 0});

function newId(deps){
  const r = deps.rand ? deps.rand() : Math.random;
  let s = ""; for(let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(r() * CODE_CHARS.length)];
  return s;
}

/* send every payload in turn; a failed push is reported, never thrown (the
   row is already saved — a seat that missed it resyncs) */
function pushAll(list, deps, i, failed){
  if(i >= list.length) return !failed;
  let res;
  try { res = deps.broadcast(list[i][0], list[i][1]); } catch(_){ return pushAll(list, deps, i + 1, true); }
  if(isP(res)) return res.then(() => pushAll(list, deps, i + 1, failed), () => pushAll(list, deps, i + 1, true));
  return pushAll(list, deps, i + 1, failed);
}

/* write the row if nobody wrote since it was read, then tell each seat its
   own frames. `reply`: the caller's response frames. */
function save(id, row, version, deps, frames, reply, extra){
  row.updated = deps.now ? deps.now() : row.updated;
  return then(deps.store.put(id, row, version), p => {
    if(!p || !p.ok) return no("conflict", {retry: true});
    const list = [];
    for(const s of [0, 1]){
      const key = row.hub.keys[s];
      /* a seat nobody was ever dealt has no channel (and no frames); the seal is the seat's own key's */
      if(frames[s].length && key != null) list.push([topic(id, s, key), {ver: p.version, frames: frames[s], mac: SHA.frameMac(key, id, s, p.version, frames[s])}]);
    }
    return then(pushAll(list, deps, 0, false), sent => ({ok: true, version: p.version, ...(extra || {}), frames: reply,
      ...(sent ? {} : {broadcast: "failed"})}));
  });
}

/* ---- ops ------------------------------------------------------------- */

function create(req, deps){
  const given = req.table != null;
  const id = given ? req.table : newId(deps);
  if(typeof id !== "string" || !ID_RE.test(id)) return no("bad-request");
  const r = rig(id, null, deps);
  const row = newRow(id, r.hub, deps);
  return then(deps.store.put(id, row, 0), p => p && p.ok ? {ok: true, table: id, version: p.version} : no("exists", {retry: !given}));
}

function join(req, got, deps){
  const row = got.row, id = row.id;
  if(req.key !== undefined){
    /* a returning phone: the key holds the chair (and nothing is written) */
    if((req.seat !== 0 && req.seat !== 1) || !keyEq(req.key, row.hub.keys[req.seat])) return no("auth");
    const r = rig(id, row, deps);
    r.seat(req.seat, req.key, true);
    return {ok: true, version: got.version, seat: req.seat, n: row.nonces[req.seat], frames: r.out[req.seat]};
  }
  /* AN UNKEYED JOIN carries a CLAIM TOKEN the phone chose (128+ random bits). The seat and the token are saved
     in ONE write, so a phone that never got the answer asks again with the same token and is handed the SAME
     seat, key and lobby — instead of a second seat dealt to nobody. (A token is a bearer secret like the key,
     stored only in the row.) */
  const tok = req.claim;
  if(tok !== undefined && (typeof tok !== "string" || !CLAIM_RE.test(tok))) return no("bad-request");
  const claims = Array.isArray(row.claims) ? row.claims : [null, null];
  if(tok !== undefined){
    const prior = [0, 1].find(s => claims[s] != null && keyEq(claims[s], tok));
    if(prior !== undefined){
      const r = rig(id, row, deps), key = row.hub.keys[prior];
      r.seat(prior, key, true);
      /* the first answer's seat offer carried the key; the claim's replay does not, so it is put back */
      const frames = r.out[prior].map(f => f && f.ch === Hub.CH.JUDGE && f.seat === prior ? {...f, key} : f);
      return {ok: true, version: got.version, seat: prior, n: row.nonces[prior], frames};
    }
  }
  const r = rig(id, row, deps), f = r.fresh(), seat = f.link.seat();
  if(seat == null) return no("full");
  row.hub = r.hub.persistTable();          /* the new seat's key is now part of the table */
  if(tok !== undefined){ row.claims = claims.slice(); row.claims[seat] = tok; }
  return save(id, row, got.version, deps, [[], []], f.got, {seat, n: row.nonces[seat]});
}

function frame(req, got, deps){
  const row = got.row, id = row.id, seat = req.seat, f = req.frame;
  if((seat !== 0 && seat !== 1) || !keyEq(req.key, row.hub.keys[seat])) return no("auth");
  if(!Number.isInteger(req.n) || req.n <= row.nonces[seat]) return no("stale");
  if(!f || typeof f !== "object" || (f.ch !== Hub.CH.LOBBY && f.ch !== Hub.CH.NET)) return no("bad-request");
  if(f.ch === Hub.CH.NET && !row.hub.spec) return no("not-dealt");
  const other = 1 - seat;
  const r = rig(id, row, deps);
  r.seat(seat, req.key, false);
  if(row.hub.keys[other] != null) r.seat(other, row.hub.keys[other], false);
  if(r.links[seat].seat() !== seat) return no("auth");
  const before = r.mark();
  r.links[seat].receive(clone(f));
  const after = r.mark();
  if(before.lob === after.lob && before.seq === after.seq) return {ok: true, version: got.version, frames: r.out[seat]};   /* a refusal or a read: nothing to save */
  row.hub = r.hub.persistTable();
  row.nonces = row.nonces.slice(); row.nonces[seat] = req.n;
  /* the caller's frames ride its response; only the OTHER seat's are pushed */
  const pushed = [[], []]; pushed[other] = r.out[other];
  return save(id, row, got.version, deps, pushed, r.out[seat]);
}

function resync(req, got, deps){
  const seat = req.seat;
  return frame({op: "frame", table: req.table, seat, key: req.key,
    n: Number.isInteger(req.n) ? req.n : (seat === 0 || seat === 1 ? got.row.nonces[seat] + 1 : 0),
    frame: {ch: Hub.CH.NET, m: {t: "resync", have: req.have | 0, seat, force: req.have == null}}}, got, deps);
}

/* ---- the entry ------------------------------------------------------- */
function serve(req, deps){
  if(!req || typeof req !== "object" || !deps || !deps.store) return no("bad-request");
  if(req.op === "create") return create(req, deps);
  if(typeof req.table !== "string" || !ID_RE.test(req.table)) return no("bad-request");
  const fn = req.op === "join" ? join : req.op === "frame" ? frame : req.op === "resync" ? resync : null;
  if(!fn) return no("bad-request");
  return then(deps.store.get(req.table), got => {
    if(!got || !got.row) return no("no-table");
    if(got.row.v !== ROW_V || got.row.wireV !== W.WIRE_V) return no("wire");
    return fn(req, got, deps);
  });
}
/* a failure inside is logged for the operator and answered as a bare
   "internal": an error message must never carry a hidden card out */
const failed = (deps, e) => { try { if(deps && deps.log) deps.log(e); } catch(_){} return no("internal"); };
function handle(req, deps){
  return new Promise(res => {
    let v; try { v = serve(req, deps); } catch(e){ return res(failed(deps, e)); }
    if(isP(v)) v.then(res, e => res(failed(deps, e))); else res(v);
  });
}
/* the same body for synchronous deps (the drills' fakes): returns the response */
function handleNow(req, deps){
  let v; try { v = serve(req, deps); } catch(e){ return failed(deps, e); }
  if(isP(v)) throw new Error("server: handleNow needs synchronous deps");
  return v;
}

return {handle, handleNow, topic, ROW_V};
});
