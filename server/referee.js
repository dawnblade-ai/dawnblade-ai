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
     identify   (token) -> {player, name?} | null   (S4.1, optional; may return a promise) — who a sign-in token is, as OUR
                player id; null when the token is forged, expired or unknown. Only called when a join presents one.

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

   ---- identity (S4.1: a seat can belong to a player) ----------------------
     {op:"join", table, identity:{token, name?}, claim?}
        `token` is whatever the sign-in provider issued; THIS FILE NEVER SEES HOW IT IS VERIFIED: `deps.identify(token)
        -> {player, name?} | null` (promise or not) is the whole seam (the Edge Function wires it to Supabase, the
        drills to a fake). `player` is OUR player id (players table, server/supabase/002_players.sql), never the
        provider's subject. A request with no `identity` is handled byte for byte as in v6.28.
        - first unkeyed join: the seat dealt is BOUND to the player in the stored row (`owners`);
        - a later unkeyed join by the SAME player (no key; a claim token is optional) TAKES THE SEAT OVER: a fresh seat
          key is dealt and the old key RETIRED (its hash is kept, never the key), the old claim token stops working,
          and the old phone gets (a) a sealed push on its own channel `{ch:"judge", taken:true}` and (b) on any request
          it makes with the old key `{ok:false, refused:"auth", taken:true}` — never a hang. A v6.28 page reads that as
          its ordinary fatal `auth`; the S4.4 page reads `taken`. A player never holds both seats (a join by a player who
          already owns a seat is a takeover of THAT seat, never the second one);
        - a keyed join (the key holds the chair) that also presents a token of ANOTHER player, or a claim token
          replayed by another player, is refused `seat-owned`; nothing is written;
        - `identity` that is not an object with a string token, or has an invalid name: `bad-request` (a bad name
          adds `field:"name"` and a `reason`); `identify` answered null (forged, expired, unknown): `identity`; the
          function has no `identify`: `identity` (it never guesses); `identify` THROWING (provider down) is an
          `internal` answer, not a verdict on the token.
        The answers carry `names:[n0,n1]` (public: both seats may read both) only when some seat has a display name, and
        `owned:true` on a join that bound/kept the caller's seat. The player id, the token and the provider's subject
        are never in any response to anyone, any broadcast, or a report (they live only in the row's `owners`).

   ---- responses ----------------------------------------------------------
     {ok:true, version, frames:[...]}   `frames`: what the CALLER's seat
        receives from this call, in order — its commits, a nack, a hello's
        snapshot (a join's include its key, in the judge frame; no other
        response and no broadcast ever does). A caller that never got the
        response asks `resync`.
     {ok:false, refused: "auth"|"stale"|"conflict"|"no-table"|"exists"|
                 "full"|"not-dealt"|"bad-request"|"wire"|"internal"|
                 "identity"|"seat-owned", retry?}
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

/* the stored row's own version: 1 (S1) -> 2 (S3: `claims`, the join tokens) -> 3 (S4.1: `owners`, `names`, `retired`).
   READ: 2 and 3 (a v2 row — the live project's — reads as owners [null,null], names [null,null], retired [[],[]]:
   a table nobody identified into; no migration, nothing is rewritten by reading). WRITE: a row stays v2 until an
   identity binds into it (`stamp`), so a casual table's row is byte for byte v6.28's and the v6.28 function can
   still read it; a v3 row is refused `wire` by v6.28 (it cannot honour owners), the safe way to roll back. */
const ROW_V = 3, ROW_V_CASUAL = 2;
const rowOk = v => v === ROW_V || v === ROW_V_CASUAL;
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

/* ---- display names: THE one validator (S4.1) ----------------------------------------------------------------
   3-16 characters (Unicode code points, after NFC), trimmed, no leading/trailing space, single spaces only.
   Letters (\p{L}), combining marks (\p{M}, at most 2 in a row: Thai, Arabic, Indic and accented scripts need them,
   a stack of them is the zalgo trick), decimal digits (\p{Nd}, any script) and the ASCII space: so Spanish, Portuguese,
   Cyrillic, Greek, Japanese, Chinese, Korean, Arabic, Thai names all work on an international phone audience, while
   emoji, punctuation, symbols, zero-width and bidi controls (category Cf), line breaks and tabs do not. A name must
   start with a letter or digit. Reserved words are matched on a FOLD (lower case, spaces gone, look-alike digits and
   Cyrillic/Greek homoglyphs mapped to Latin) so "Adm1n", "a d m i n" and Cyrillic "аdmin" are reserved too. */
const NAME_MIN = 3, NAME_MAX = 16;
const NAME_RESERVED = ["admin", "administrator", "mod", "moderator", "judge", "referee", "system", "server", "support", "staff",
  "dawnblade", "coach", "you", "opponent", "trainer", "dummy", "guest", "player", "anonymous", "nobody", "null", "undefined"];
const HOMOGLYPH = {"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c",
  "\u0445": "x", "\u0443": "y", "\u0456": "i", "\u0455": "s", "\u03bf": "o", "\u03b1": "a", "\u03b5": "e", "\u03b9": "i", "\u03c1": "p"};
const nameFold = s => Array.from(s.toLowerCase().replace(/ /g, "")).map(ch => HOMOGLYPH[ch] || ch).join("").replace(/i/g, "l");
const NAME_FOLDED = NAME_RESERVED.map(nameFold);
function validateName(raw){
  if(typeof raw !== "string") return {ok: false, reason: "type"};
  const s = raw.normalize("NFC"), cps = Array.from(s);
  if(s !== s.trim()) return {ok: false, reason: "space"};
  if(cps.length < NAME_MIN) return {ok: false, reason: "short"};
  if(cps.length > NAME_MAX) return {ok: false, reason: "long"};
  if(!/^[\p{L}\p{M}\p{Nd} ]+$/u.test(s) || !/^[\p{L}\p{Nd}]/u.test(s)) return {ok: false, reason: "chars"};
  if(/\p{M}{3}/u.test(s)) return {ok: false, reason: "chars"};
  if(/  /.test(s)) return {ok: false, reason: "space"};
  if(NAME_FOLDED.includes(nameFold(s))) return {ok: false, reason: "reserved"};
  return {ok: true, name: s};
}
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
const newRow = (id, hub, deps) => ({v: ROW_V_CASUAL, wireV: W.WIRE_V, id, build: deps.build || null, hub: hub.persistTable(),
  nonces: [0, 0], claims: [null, null], created: deps.now ? deps.now() : 0, updated: deps.now ? deps.now() : 0});

/* ---- S4.1 row readers/writers: a v2 row has none of these fields ---------------------------------------------- */
const ownersOf = row => Array.isArray(row.owners) ? row.owners : [null, null];
const namesOf = row => Array.isArray(row.names) ? row.names : [null, null];
const retiredOf = row => Array.isArray(row.retired) ? row.retired : [[], []];
/* the public part of the stored identity: display names only, and only when there is one */
const pub = row => { const n = namesOf(row); return n[0] != null || n[1] != null ? {names: n.slice()} : {}; };
/* make the row v3 (first identity write): defaults filled, nothing else touched */
function stamp(row){
  row.v = ROW_V; row.owners = ownersOf(row).slice(); row.names = namesOf(row).slice(); row.retired = retiredOf(row).map(l => l.slice());
  return row;
}
/* a retired key is remembered by hash, never by value */
const retireHash = (id, seat, key) => SHA.sha256("dawnblade-retired|" + id + "|" + seat + "|" + key);
const RETIRED_CAP = 8;
/* the answer to a wrong key: `taken:true` when it is a key this seat used to have (an identity takeover) */
function authFail(row, seat, key){
  if((seat === 0 || seat === 1) && typeof key === "string" && retiredOf(row)[seat].includes(retireHash(row.id, seat, key))) return no("auth", {taken: true});
  return no("auth");
}

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
function save(id, row, version, deps, frames, reply, extra, also){
  row.updated = deps.now ? deps.now() : row.updated;
  return then(deps.store.put(id, row, version), p => {
    if(!p || !p.ok) return no("conflict", {retry: true});
    const list = [];
    for(const s of [0, 1]){
      const key = row.hub.keys[s];
      /* a seat nobody was ever dealt has no channel (and no frames); the seal is the seat's own key's */
      if(frames[s].length && key != null) list.push([topic(id, s, key), {ver: p.version, frames: frames[s], mac: SHA.frameMac(key, id, s, p.version, frames[s])}]);
    }
    if(also) for(const a of also(p.version)) list.push(a);
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
  if(req.identity === undefined) return joinAs(req, got, deps, null);
  const idn = req.identity;
  if(!idn || typeof idn !== "object" || Array.isArray(idn) || typeof idn.token !== "string" || idn.token.length < 1 || idn.token.length > 4096) return no("bad-request");
  let name = null;
  if(idn.name !== undefined){
    const v = validateName(idn.name);
    if(!v.ok) return no("bad-request", {field: "name", reason: v.reason});
    name = v.name;
  }
  if(typeof deps.identify !== "function") return no("identity");
  return then(deps.identify(idn.token), who => {
    if(who == null) return no("identity");
    if(typeof who !== "object" || typeof who.player !== "string" || !PLAYER_RE.test(who.player)) throw new Error("identify answered something that is not a player");
    let nm = name;
    if(nm == null && who.name != null){ const v = validateName(who.name); if(v.ok) nm = v.name; }   /* the stored default name; a bad one is dropped */
    return joinAs(req, got, deps, {player: who.player, name: nm});
  });
}
const PLAYER_RE = /^[A-Za-z0-9_-]{1,64}$/;

/* `who`: null (no identity presented: v6.28's body, untouched) or {player, name} */
function joinAs(req, got, deps, who){
  const row = got.row, id = row.id;
  if(req.key !== undefined){
    /* a returning phone: the key holds the chair (and nothing is written) */
    if((req.seat !== 0 && req.seat !== 1) || !keyEq(req.key, row.hub.keys[req.seat])) return authFail(row, req.seat, req.key);
    /* a token of ANOTHER player does not ride a key that is not theirs (S4.1); no token: the key alone, as before */
    if(who && ownersOf(row)[req.seat] != null && ownersOf(row)[req.seat] !== who.player) return no("seat-owned");
    const r = rig(id, row, deps);
    r.seat(req.seat, req.key, true);
    return {ok: true, version: got.version, seat: req.seat, n: row.nonces[req.seat], ...(who && ownersOf(row)[req.seat] === who.player ? {owned: true} : {}), ...pub(row), frames: r.out[req.seat]};
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
      if(!who) return {ok: true, version: got.version, seat: prior, n: row.nonces[prior], ...pub(row), frames};
      /* the same token, now with an identity: another player's seat is refused; an unowned one is bound to this player */
      const owner = ownersOf(row)[prior];
      if(owner != null && owner !== who.player) return no("seat-owned");
      if(owner === who.player) return {ok: true, version: got.version, seat: prior, n: row.nonces[prior], owned: true, ...pub(row), frames};
      if(ownersOf(row)[1 - prior] === who.player) return no("seat-owned");     /* never both seats */
      stamp(row); row.owners[prior] = who.player; if(who.name != null) row.names[prior] = who.name;
      return save(id, row, got.version, deps, [[], []], frames, {seat: prior, n: row.nonces[prior], owned: true, ...pub(row)});
    }
  }
  if(who){
    const mine = ownersOf(row).indexOf(who.player);
    if(mine >= 0) return takeOver(row, got, deps, who, mine, tok);
  }
  const r = rig(id, row, deps), f = r.fresh(), seat = f.link.seat();
  if(seat == null) return no("full");
  row.hub = r.hub.persistTable();          /* the new seat's key is now part of the table */
  if(tok !== undefined){ row.claims = claims.slice(); row.claims[seat] = tok; }
  if(who){ stamp(row); row.owners[seat] = who.player; if(who.name != null) row.names[seat] = who.name; }
  return save(id, row, got.version, deps, [[], []], f.got, {seat, n: row.nonces[seat], ...(who ? {owned: true, ...pub(row)} : {})});
}

/* THE SAME PLAYER, A NEW PHONE: the seat's key is replaced and the old one retired; the old claim token is dropped
   (it would hand the old key back); the old phone is told on its own channel, sealed under the key it holds. */
function takeOver(row, got, deps, who, seat, tok){
  const id = row.id, oldKey = row.hub.keys[seat];
  const key = SHA.nonce(deps.rand ? deps.rand() : undefined);
  stamp(row);
  row.hub = {...row.hub, keys: row.hub.keys.map((k, s) => s === seat ? key : k)};
  row.retired[seat] = row.retired[seat].concat([retireHash(id, seat, oldKey)]).slice(-RETIRED_CAP);
  row.claims = (Array.isArray(row.claims) ? row.claims : [null, null]).slice(); row.claims[seat] = tok !== undefined ? tok : null;
  if(who.name != null) row.names[seat] = who.name;
  const r = rig(id, row, deps);
  r.seat(seat, key, true);
  const frames = r.out[seat].map(f => f && f.ch === Hub.CH.JUDGE && f.seat === seat ? {...f, key} : f);
  const notice = [{ch: Hub.CH.JUDGE, taken: true, seat}];
  return save(id, row, got.version, deps, [[], []], frames, {seat, n: row.nonces[seat], owned: true, ...pub(row)},
    ver => [[topic(id, seat, oldKey), {ver, frames: notice, mac: SHA.frameMac(oldKey, id, seat, ver, notice)}]]);
}

function frame(req, got, deps){
  const row = got.row, id = row.id, seat = req.seat, f = req.frame;
  if((seat !== 0 && seat !== 1) || !keyEq(req.key, row.hub.keys[seat])) return authFail(row, seat, req.key);
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
  return then(frame({op: "frame", table: req.table, seat, key: req.key,
    n: Number.isInteger(req.n) ? req.n : (seat === 0 || seat === 1 ? got.row.nonces[seat] + 1 : 0),
    frame: {ch: Hub.CH.NET, m: {t: "resync", have: req.have | 0, seat, force: req.have == null}}}, got, deps),
    r => r.ok ? {...r, ...pub(got.row)} : r);
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
    if(!rowOk(got.row.v) || got.row.wireV !== W.WIRE_V) return no("wire");
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

return {handle, handleNow, topic, ROW_V, ROW_V_CASUAL, validateName};
});
