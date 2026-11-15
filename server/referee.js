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
     rename     (player, name, fold) -> "ok" | "taken"   (S4.2, optional; may return a promise) — store the player's display
                name; "taken" when another player holds a name with the same fold. Only called by op "me" with a name.
     mint       (player, hash, days) -> "ok"   (S4.3, optional; may return a promise) — store a recovery code's SHA-256 hex for the
                player, retiring that player's older unused codes (004_recovery.sql recovery_mint). Only called by op "recovery-mint".
     store.createCapped  (id, row, creator, cap) -> {ok:true, version} | {ok:false, exists:true} | {ok:false, capped:true, open:[ids]}   (S4.4,
                optional; may return a promise) — create a table for a SIGNED-IN player unless they already hold `cap` open ones, the count and
                the insert ONE atomic step (005_table_cap.sql table_create_capped). Only called by op "create" with an identity.
     rating     (player) -> {rating, games, wins, losses, draws}   (S5.1, optional; may return a promise) — 006_ratings.sql rating_get. Only called by op "me"
                and by a join at a ranked table. record  (result) -> {recorded, ratings:[{from,to},{from,to}]}   (S5.1, optional; may return a
                promise) — 006_ratings.sql result_record, once per game (see "ranked tables" below). A function without both cannot make a ranked table.
     ladder     ({player|null, floor, limit, recent}) -> {ladder:[...], recent:[...], you?}   (S5.3, optional; may return a promise) — 008_ladder.sql ladder_get: the public
                ladder, the last recorded results and, when `player` (OUR id) is given, that player's own line. Only called by op "ladder"; a function without it answers
                `unavailable`. It is handed the three numbers below (LADDER_FLOOR, LADDER_CAP, LADDER_RECENT): the rules live in this file, the database only bounds them.
     redeem     (token, hash) -> {status:"ok"|"refused"|"limited", name?} | null   (S4.3, optional; may return a promise) — spend the
                code and move the token's sign-in to the code's player (recovery_redeem). null: the token is not a sign-in. Only
                called by op "recovery-redeem". The Edge Function owns the provider subject; this file never sees it.

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
     {op:"join", table, identity:{token}, claim?}        (a display name is set with op "me", S4.2 — never at a join)
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
        - `identity` that is not an object with a string token, or that carries a `name`: `bad-request` (a name
          adds `field:"name"`, `reason:"at-join"`); `identify` answered null (forged, expired, unknown): `identity`; the
          function has no `identify`: `identity` (it never guesses); `identify` THROWING (provider down) is an
          `internal` answer, not a verdict on the token.
        The answers carry `names:[n0,n1]` (public: both seats may read both) only when some seat has a display name, and
        `owned:true` on a join that bound/kept the caller's seat. The player id, the token and the provider's subject
        are never in any response to anyone, any broadcast, or a report (they live only in the row's `owners`).

   ---- at most 5 open tables per player (S4.4; RULING user 2026-11-14 "cap 5 open tables per player") ---------------------
     {op:"create", identity:{token}, table?}
        a SIGNED-IN create: the row is stamped v3 with `creator` (OUR player id, in the row only) and the table is made through
        `deps.store.createCapped` — the count of the creator's OPEN tables and the insert in one atomic step. OPEN = created by this
        player, game not finished (the referee sets `over` when the session ends) and not closed by its creator, and not idle for 48
        hours (forgotten). A player holding OPEN_CAP of them is refused `{ok:false, refused:"table-cap", cap, open:[their codes]}`
        and nothing is written. Joining another player's table never counts (only `creator` does). A create with NO identity is the
        casual create, byte for byte as before (no creator, never counted). Refusals: bad-request | identity | unavailable (the
        store cannot count) | table-cap | exists (retry:true when the code was ours to pick) | internal.
     {op:"close", table, identity:{token}}
        the creator closes their own table (the smallest way out of the cap: a table nobody will play still counts as open until it is
        48 hours idle). Marks the row `over` and `closed`: a closed table is then answered `no-table` to every join, frame and resync,
        for both seats. -> {ok:true}; refusals: bad-request | identity | no-table | not-creator | conflict (retry:true) | internal.
        Closing a table that is already over or closed is {ok:true} and writes nothing.

   ---- ranked tables: results and ratings (S5.1) ----------------------------------------------------------------------------------
     {op:"create", identity:{token}, ranked:true}
        a RANKED table (casual stays the default: no `ranked`, byte for byte v6.31). Needs a signed-in creator who has a chosen name: no
        identity `ranked-signin`; a nameless creator `ranked-name`; a function with no `record`/`rating` `unavailable`. The row is v4 with
        `ranked:true`, `ratings:[null,null]` (each player's rating as they SAT DOWN) and, later, `result`. `ranked` that is not `true`: bad-request.
     {op:"join", table, identity:{token}} at a ranked table: every chair needs a signed-in player with a chosen name, and the two are two
        different players (a player who already holds a chair takes THAT chair over, never the other). A join with no identity is refused
        `ranked-signin`, one whose player has no name `ranked-name` (nothing is written); a phone that already holds its chair (a keyed
        join) is not asked again. The answers carry `ranked:true`, `ratings:[r0|null, r1|null]` and, once recorded, `result`.
     THE RESULT. When the move that ends a ranked game has been saved (win, loss, the engine's dead-position draw, or a concession — the
        reducer's `concede` action is the only way out a table has), the function reads who won and how from ITS OWN game state, calls
        `deps.record({game, table, players, names, heroes, winner, how, turns, build, started, ended})` -> {recorded, ratings:[{from,to},
        {from,to}]} (006_ratings.sql result_record: one row per game id and both ratings moved in ONE transaction, idempotent), keeps the
        public summary {winner, how, turns, heroes, change:[{from,to},{from,to}]} in the row (`result`) and answers it to the caller as `result`
        (the other seat reads it from its next join/resync answer, as `result`). A failed record never undoes the game: the NEXT request on
        that table (any op) finds a ranked game that is over and has no `result`, and records it first. A table CLOSED by its creator before
        the game ended records nothing in this release (the forfeit clock will close that gap); a close that finds a decided, unrecorded game
        records it first (and refuses `internal` if it cannot), and a decided game's table is never closed over: a result cannot be erased.
     {op:"me"} also answers `rating, games, wins, losses, draws` when the function can read ratings (`deps.rating(player) -> {rating, games,
        wins, losses, draws}`; an unrated player is at the starting rating with no games). Ratings and names are public; the player id, the
        token and the subject never are.

   ---- the ladder (S5.3: PUBLIC, read without signing in) ---------------------------------------------------------------------------
     {op:"ladder", identity?:{token}}
        -> {ok:true, floor, cap, ladder:[{rank, name, rating, games, wins, losses, draws}], recent:[{names:[a,b], heroes:[a,b], winner:0|1|null, how, at}], you?}
        WHO IS LISTED: a player with a chosen name, at least `floor` (3) recorded ranked games and a sign-in that points at them (an orphan kept by 007's recovery
        rule, a nameless player and a provisional player (fewer games) never appear). ORDER: rating, then more games, then name: a total order; `rank` is the
        position. The top `cap` (50). `recent`: the last LADDER_RECENT (10) recorded ranked results, newest first: both names, both heroes, the winner (null: a draw),
        how it ended (life | concession | stalemate | forfeit) and when it was recorded (ms since 1970).
        THE CALLER'S LINE (`you`, only when the request presents a token that identifies): {name|null, rating, games, wins, losses, draws, listed, rank|null, toGo}:
        `rank` is their position among LISTED players (also below the cap), `toGo` the ranked games still to play before they are listed (0 when listed, or when they
        have the games but no chosen name). A request with no identity, a malformed one, a forged or expired token, or a provider that is down is simply answered WITHOUT
        `you`: the public read never fails for the caller's sake. NOTHING ELSE LEAVES: no player id, no sign-in subject, no table code, no game id, no token; every row
        is rebuilt here from its public fields. READ-ONLY: nothing is written and no row is made for anyone; not cached (see S5-LOG: one indexed statement, and a
        ladder that does not show your own game just finished would read as a bug). The answer is checked against its own rules (at most `cap` rows, none under the
        floor, in the stated order, ranks 1..n): a backend that breaks them is `internal`, never shown. Refusals: unavailable (no `ladder` wired) | internal.

   ---- recovery codes (S4.3: a lost phone is not a lost player) ------------------------------------------------
     {op:"recovery-mint", identity:{token}}
        -> {ok:true, code:"XXXXX-XXXXX-XXXXX", days:730}. THE ONLY ANSWER, BROADCAST, ROW OR REPORT THAT EVER HOLDS A CODE: it is
        shown to the player once and only its SHA-256 hex is stored (never the code). 15 characters of a 31-letter alphabet
        (no 0 O 1 I L) = 74 bits, drawn from crypto.getRandomValues with rejection sampling (never Math.random), grouped for reading.
        One live code per player: a new one retires the older unused ones. Refusals: bad-request | identity | unavailable (no
        `mint` wired) | internal.
     {op:"recovery-redeem", identity:{token}, code, tables?:[table ids]}
        -> {ok:true, name: <the recovered player's name> | null}: THIS sign-in (a new phone's own fresh one) now belongs to the
        code's player; the old phone's sign-in stays on that player (one player, two phones; the last to sit down wins the seat).
        The code is normalised (case, spaces, dashes and any other separators ignored). Wrong, used, expired, retired and malformed
        are ONE answer, {ok:false, refused:"recovery"}; too many wrong tries from one sign-in in an hour is {refused:"recovery-limited"}
        (it says nothing about the code). `tables`: the tables this phone knows it has sat at; if its current player holds a seat at
        any of them the redeem is refused `recovery-seated` BEFORE anything changes (the seat would be left to a player that no
        longer exists). The code, its hash and every identifier stay inside; the answer carries only `name`.
        Refusals: bad-request | identity | unavailable | recovery | recovery-limited | recovery-seated | internal.

   ---- responses ----------------------------------------------------------
     {ok:true, version, frames:[...]}   `frames`: what the CALLER's seat
        receives from this call, in order — its commits, a nack, a hello's
        snapshot (a join's include its key, in the judge frame; no other
        response and no broadcast ever does). A caller that never got the
        response asks `resync`.
     {ok:false, refused: "auth"|"stale"|"conflict"|"no-table"|"exists"|
                 "full"|"not-dealt"|"bad-request"|"wire"|"internal"|
                 "identity"|"seat-owned"|"table-cap"|"not-creator"|"ranked-signin"|"ranked-name"|"unavailable", retry?}
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
  if(typeof module==="object" && module.exports) module.exports = factory(require("../engine/hub.js"), require("../engine/wire.js"), require("../engine/judge.js"), require("../engine/invariants.js"), require("../engine/sha256.js"), require("../engine/lobby.js"));
  else root.DawnServer = factory(root.DawnHub, root.DawnWire, root.DawnJudge, root.DawnInvariants, root.DawnSHA, root.DawnLobby);
})(typeof self!=="undefined" ? self : this, function(Hub, W, J, INV, SHA, L){

/* the stored row's own version: 1 (S1) -> 2 (S3: `claims`, the join tokens) -> 3 (S4.1: `owners`, `names`, `retired`) -> 4 (S5.1: a RANKED
   table: `ranked`, `ratings`, `result`; written only by a ranked create, so a v6.31 function refuses it as `wire` — a rollback can never
   turn a ranked table into a casual one that records nothing) -> 5 (S5.2: a ranked table also keeps `clock` and, once a claim ended it, `forfeit`; a
   v6.32 function refuses a v5 row as `wire`, so a rollback cannot keep playing a ranked game without maintaining its forfeit clock). READ: 2, 3, 4 and 5
   (a v4 ranked row, made by v6.32, simply has no clock until its next saved move). (Earlier note, v3's:) READ: 2 and 3 (a v2 row — the live project's — reads as owners [null,null], names [null,null], retired [[],[]]:
   a table nobody identified into; no migration, nothing is rewritten by reading). WRITE: a row stays v2 until an
   identity binds into it (`stamp`), so a casual table's row is byte for byte v6.28's and the v6.28 function can
   still read it; a v3 row is refused `wire` by v6.28 (it cannot honour owners), the safe way to roll back. */
const ROW_V = 3, ROW_V_CASUAL = 2, ROW_V_RANKED = 5, ROW_V_RANKED_4 = 4;
const rowOk = v => v === ROW_V || v === ROW_V_CASUAL || v === ROW_V_RANKED || v === ROW_V_RANKED_4;
/* S5.2: THE FORFEIT CLOCK'S LIMIT, in ONE place. A claim is refused until the player the game is waiting on has made no accepted move for this long
   (server time, from the row's own stamp). A placeholder the user may rule on; `deps.forfeitMs` replaces it (the drills' injected clock). */
const FORFEIT_MS = 5 * 60 * 1000;
const forfeitLimit = deps => Number.isInteger(deps && deps.forfeitMs) && deps.forfeitMs >= 0 ? deps.forfeitMs : FORFEIT_MS;
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
const pub = (row, deps) => { const n = namesOf(row); return {...(n[0] != null || n[1] != null ? {names: n.slice()} : {}), ...rankPub(row, deps)}; };
/* ---- S5.1 row readers: a casual row has none of these fields, and rankPub answers {} for it (a casual answer is byte for byte v6.31's) ---- */
const ratingsOf = row => Array.isArray(row.ratings) ? row.ratings : [null, null];
/* public by design: that the table is ranked, the two ratings as each player SAT DOWN, and, once recorded, how the game ended and the rating moves */
const rankPub = (row, deps) => row.ranked === true ? {ranked: true, ratings: ratingsOf(row).slice(), ...(row.result ? {result: row.result} : {}), ...clockPub(row, deps)} : {};
/* ---- S5.2: the forfeit clock's public face. `row.clock` = {on: the seat the game is waiting on, since: SERVER ms of that seat's last accepted move (or of
   the moment the wait on it began)}. What a phone is told is {on, age, limit}: which seat, how long it has waited as the SERVER counts it, and the limit; the phone
   adds only the time elapsed on its own clock since it heard (never its wall clock against ours). That the game waits on a seat is already public (priority,
   a pending question and a sheet's side are in both seats' views); WHAT is being decided never is. A casual row, a finished game and a wait on nobody have none. */
const clockOn = row => row.clock && (row.clock.on === 0 || row.clock.on === 1) && Number.isFinite(row.clock.since) ? row.clock : null;
const clockAge = (row, deps) => Math.max(0, (deps && deps.now ? deps.now() : 0) - row.clock.since);
const clockPub = (row, deps) => row.over !== true && clockOn(row) ? {clock: {on: row.clock.on, age: clockAge(row, deps), limit: forfeitLimit(deps)}} : {};
/* the same fact as a sealed frame (a push rides the seat's own seal, so a listener on the public channel cannot forge it); phones that do not know the channel skip it */
const CH_CLOCK = "clock";
const clockFrame = (row, deps) => ({ch: CH_CLOCK, m: clockOn(row) && row.over !== true ? {on: row.clock.on, age: clockAge(row, deps), limit: forfeitLimit(deps)} : {on: null}});
/* make the row v3 (first identity write): defaults filled, nothing else touched */
function stamp(row){
  row.v = row.v === ROW_V_RANKED || row.v === ROW_V_RANKED_4 ? row.v : ROW_V; row.owners = ownersOf(row).slice(); row.names = namesOf(row).slice(); row.retired = retiredOf(row).map(l => l.slice());
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
function save(id, row, version, deps, frames, reply, extra, also, settle){
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
    /* S5.1: the move that ENDS a ranked game is recorded here, after the row is saved and before the other seat is told (a failure is logged, never
       fatal: the next request that finds the game decided and unrecorded settles it, and the record is idempotent) */
    return then(settle ? settleSafe(settle, p.version, deps) : null, st => then(pushAll(list, deps, 0, false), sent => ({ok: true, version: p.version, ...(extra || {}),
      ...(st && st.result ? {result: st.result} : {}), frames: reply, ...(sent ? {} : {broadcast: "failed"})})));
  });
}

/* ---- S5.1: ranked results and ratings ---------------------------------------------------------------------------------------------
   The RESULT of a ranked game comes from one place only: the referee's own game state (`hub.session().full().over`, written by judge.js's
   reducer), read by this function after the move that decided it was SAVED. No request field is ever read for it: a phone that says "winner"
   (in a frame, a lobby message or the envelope) is talking to a reducer that has no such action. `deps.record(result)` stores it ONCE and moves
   both ratings in the same transaction (006_ratings.sql result_record: idempotent on the game id, so a replay, a resync, a takeover or a second
   request answers the stored result and moves nothing). The rating arithmetic lives in SQL only; this file never computes a rating. */
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
/* what `deps.rating(player)` must answer: the rating and the record, as integers (a malformed answer is a bug, answered `internal`) */
function ratingOf(rt){
  if(!rt || typeof rt !== "object" || !intIn(rt.rating, 0, 100000) || !["games", "wins", "losses", "draws"].every(k => intIn(rt[k], 0, 1e9))) throw new Error("rating answered something that is not a rating");
  return {rating: rt.rating, games: rt.games, wins: rt.wins, losses: rt.losses, draws: rt.draws};
}
const RANKED_HOW = ["life", "concession", "stalemate", "forfeit"];
/* the record's key: the table code AND the moment the table was made, so a code that is drawn again after the old table was forgotten is a new game */
const gameId = row => row.id + "-" + (Number.isInteger(row.created) ? row.created : 0);
/* the result of a finished ranked game as the function knows it, or null (logged) when it is not a result that may be recorded */
function resultOf(row, hub, deps){
  const bad = why => { try { if(deps.log) deps.log(new Error("ranked result not recorded: " + why)); } catch(_){} return null; };
  const sess = hub.session(), owners = ownersOf(row);
  const fl = row.forfeit && (row.forfeit.loser === 0 || row.forfeit.loser === 1) ? row.forfeit.loser : null;
  /* a forfeit claimed in the who-goes-first lobby (both heroes chosen, the match not dealt): no game was played; the lobby has the heroes and the row the ending */
  const lobbyEnd = fl !== null && !sess;
  const spec = lobbyEnd ? {heroes: (hub.lobby() || {}).heroes} : hub.spec();
  if(!spec || (!lobbyEnd && (!sess || !sess.over()))) return bad("the game is not over");
  const g = lobbyEnd ? {turn: 0, over: {winner: 1 - fl, how: "concession"}} : sess.full(), over = g.over;
  if(!over || RANKED_HOW.indexOf(over.how) < 0) return bad("an ending that is not life, concession, stalemate or forfeit");
  const winner = over.winner === 0 || over.winner === 1 ? over.winner : null;
  let how = over.how;
  /* a CLAIMED FORFEIT ends the game through the reducer's concession for the absent seat; the record says what it was */
  if(fl !== null){ if(how !== "concession" || winner !== 1 - fl) return bad("a forfeit that is not the absent seat's concession"); how = "forfeit"; }
  if((winner === null) !== (how === "stalemate")) return bad("a winner that does not fit how the game ended");
  if(typeof owners[0] !== "string" || typeof owners[1] !== "string" || owners[0] === owners[1]) return bad("the two seats do not belong to two different players");
  if(!Array.isArray(spec.heroes) || typeof spec.heroes[0] !== "string" || typeof spec.heroes[1] !== "string") return bad("no heroes");
  const names = namesOf(row);
  return {game: gameId(row), table: row.id, players: owners.slice(), names: names.slice(), heroes: spec.heroes.slice(), winner, how,
    turns: Number.isInteger(g.turn) && g.turn >= 0 ? g.turn : 0, build: row.build || null, started: Number.isInteger(row.created) ? row.created : 0, ended: deps.now ? deps.now() : 0};
}
/* record the decided game and keep its public summary in the row. Returns {result, version} or null. `row` gets `result` in memory even when the
   second write loses a race (the record itself is what counts, and any later request reads it back from there). */
function settleRow(id, row, version, deps, hub){
  if(typeof deps.record !== "function") throw new Error("a ranked table without a way to record its result");
  const res = resultOf(row, hub, deps);
  if(!res) return null;
  return then(deps.record(res), rec => {
    if(!rec || !Array.isArray(rec.ratings) || rec.ratings.length !== 2 || !rec.ratings.every(x => x && intIn(x.from, 0, 100000) && intIn(x.to, 0, 100000))) throw new Error("record answered something that is not a result");
    const shown = {winner: res.winner, how: res.how, turns: res.turns, heroes: res.heroes.slice(), change: rec.ratings.map(x => ({from: x.from, to: x.to}))};
    row.result = shown;
    return then(deps.store.put(id, row, version), p => ({result: shown, version: p && p.ok ? p.version : version, saved: !!(p && p.ok)}));
  });
}
/* the version of settleRow that logs and goes on (the move that decided the game, a heal on any request) */
function settleSafe(settle, version, deps){
  const bad = e => { try { if(deps.log) deps.log(e); } catch(_){} return null; };
  try { const v = settle(version); return isP(v) ? v.then(x => x, bad) : v; } catch(e){ return bad(e); }
}
/* a request found a ranked game over and unrecorded: record it first, then serve the request on the row as it now is */
function healSoft(id, got, deps){
  const bad = e => { try { if(deps.log) deps.log(e); } catch(_){} return got; };
  try {
    const r = rig(id, got.row, deps), v = settleRow(id, got.row, got.version, deps, r.hub), ok = st => st ? {version: st.version, row: got.row} : got;
    return isP(v) ? v.then(ok, bad) : ok(v);
  } catch(e){ return bad(e); }
}
/* the same, but a failure is the caller's: `close` must not close over a result it could not record */
function healStrict(id, got, deps){
  const r = rig(id, got.row, deps);
  return then(settleRow(id, got.row, got.version, deps, r.hub), st => st ? {version: st.version, row: got.row} : got);
}

/* ---- S5.2: THE FORFEIT CLOCK ---------------------------------------------------------------------------------------------------
   WHO THE TABLE IS WAITING ON — one reader per stage, both read-only: once the match is dealt `judge.waitingOn(full game)` (a pending question, a sheet's
   side, the arsenal choice, else the priority holder: judge.js says why); before it, in the who-goes-first lobby, `lobby.waitingOn` — and only once BOTH heroes
   are chosen (a table where a player sat down and never picked has nothing to forfeit: it ages out). In the lobby a seat is waited on when it alone still owes
   the step (a throw's seal or open, the seat choice by the throw's winner, a sideboard, the seed answer). NO CLOCK RUNS (the answer is null) when the game is over,
   when the engine walks on by itself (priority null), when the lobby is still choosing heroes, or when BOTH seats owe the step (both unsealed, both unopened,
   both without a sideboard): a wait on both is a wait on neither. Never guessed from whose turn it is. */
function waitedOn(hub){
  const sess = hub.session();
  if(sess) return J.waitingOn(sess.full());
  const lob = hub.lobby();
  if(!lob) return null;
  const step = L.stepOf(lob);
  if(step === "fault" || step === "hero" || step === "ready") return null;
  let w = L.waitingOn(lob).filter(x => x === 0 || x === 1);
  if(step === "throw" && lob.seals[0] != null && lob.seals[1] != null) w = [0, 1].filter(x => lob.throws[x] == null);   /* both sealed: whoever has not opened */
  return w.length === 1 ? w[0] : null;
}
/* after a saved move by `moved` on a RANKED row: who the game waits on now, and since when. The stamp restarts when the wait changes seat or when the
   waited-on seat itself moved (any accepted move by that player restarts it); a move by the OTHER seat leaves it running. Returns true when it changed. */
function stampClock(row, hub, moved, deps){
  if(row.ranked !== true) return false;
  const was = JSON.stringify(row.clock == null ? null : row.clock);
  if(row.over === true){ row.clock = null; return was !== "null"; }
  const w = waitedOn(hub), prev = clockOn(row), now = deps.now ? deps.now() : 0;
  row.clock = w === null ? null : {on: w, since: prev && prev.on === w && moved !== w ? prev.since : now};
  return JSON.stringify(row.clock) !== was;
}
/* the function concedes for a seat THROUGH THE HUB'S OWN SEAT AND REDUCER (the reducer's `concede` is the only way a game ends by a person leaving it; this
   is a close or a claimed forfeit, never a phone's word). Returns {r, mine, theirs} (frames for the loser's and the winner's phones) or null when the match
   has not been dealt or somehow did not end. The caller saves. */
function concedeAs(id, row, deps, loser){
  const r = rig(id, row, deps), s0 = r.hub.session();
  if(!s0 || s0.over()) return null;
  const other = 1 - loser;
  r.seat(loser, row.hub.keys[loser], false);
  r.seat(other, row.hub.keys[other], false);
  r.links[loser].receive({ch: Hub.CH.NET, m: {t: "intent", id: 0, seat: loser, action: {t: "concede"}}});
  if(!r.hub.session().over()) return null;
  row.hub = r.hub.persistTable();
  row.over = true;
  return {r, mine: r.out[loser], theirs: r.out[other]};
}

/* ---- ops ------------------------------------------------------------- */

const OPEN_CAP = 5;
function create(req, deps){
  const given = req.table != null;
  const id = given ? req.table : newId(deps);
  if(typeof id !== "string" || !ID_RE.test(id)) return no("bad-request");
  if(req.ranked !== undefined && req.ranked !== true) return no("bad-request");
  if(req.ranked === true && req.identity === undefined) return no("ranked-signin");     /* a ranked table is only for signed-in players */
  if(req.identity !== undefined) return createAs(req, id, given, deps);
  const r = rig(id, null, deps);
  const row = newRow(id, r.hub, deps);
  return then(deps.store.put(id, row, 0), p => p && p.ok ? {ok: true, table: id, version: p.version} : no("exists", {retry: !given}));
}
/* S4.4: a signed-in create. The decision (count, then insert) is the STORE's, in one atomic step; this only says who and what. */
function createAs(req, id, given, deps){
  return recoveryWho(req, deps, who => {
    if(typeof deps.store.createCapped !== "function") return no("unavailable");      /* never create an unchecked table for a signed-in player */
    const ranked = req.ranked === true;
    /* S5.1: a ranked table needs a way to record its result and to read ratings, and a creator with a chosen name (never an unchecked ranked table) */
    if(ranked){
      if(typeof deps.record !== "function" || typeof deps.rating !== "function") return no("unavailable");
      const v = who.name != null ? validateName(who.name) : null;
      if(!v || !v.ok) return no("ranked-name");
    }
    const r = rig(id, null, deps);
    const row = stamp(newRow(id, r.hub, deps));
    row.creator = who.player;
    if(ranked){ row.v = ROW_V_RANKED; row.ranked = true; row.ratings = [null, null]; }
    return then(deps.store.createCapped(id, row, who.player, OPEN_CAP), p => {
      if(p && p.ok) return {ok: true, table: id, version: p.version};
      if(p && p.capped === true) return no("table-cap", {cap: OPEN_CAP, open: (Array.isArray(p.open) ? p.open : []).filter(x => typeof x === "string" && ID_RE.test(x)).slice(0, 10)});
      if(p && p.exists === true) return no("exists", {retry: !given});
      throw new Error("createCapped answered something that is neither created, capped nor exists");
    });
  });
}

/* ---- {op:"ladder", identity?:{token}} (S5.3) — the public ladder -------------------------------------------------------------------- */
const LADDER_FLOOR = 3, LADDER_CAP = 50, LADDER_RECENT = 10;
const ladderStr = v => typeof v === "string" && v.length >= 1 && v.length <= 64;
const ladderCmp = (x, y) => y.rating - x.rating || y.games - x.games;
/* the caller, if they can be told: never a reason to fail the public read */
function ladderWho(req, deps){
  const idn = req.identity;
  if(!idn || typeof idn !== "object" || Array.isArray(idn) || typeof idn.token !== "string" || idn.token.length < 1 || idn.token.length > 4096 || typeof deps.identify !== "function") return null;
  const soft = e => { try { if(deps.log) deps.log(e); } catch(_){} return null; };
  const pick = who => who && typeof who === "object" && typeof who.player === "string" && PLAYER_RE.test(who.player) ? who.player : null;
  let v; try { v = deps.identify(idn.token); } catch(e){ return soft(e); }
  return isP(v) ? v.then(pick, soft) : pick(v);
}
function ladderShape(a){
  const bad = why => { throw new Error("ladder answered something that is not a ladder: " + why); };
  if(!a || typeof a !== "object" || !Array.isArray(a.ladder) || !Array.isArray(a.recent)) bad("no lists");
  if(a.ladder.length > LADDER_CAP) bad("more than the cap");
  if(a.recent.length > LADDER_RECENT) bad("more recent results than asked for");
  const ladder = a.ladder.map((x, i) => {
    if(!x || typeof x !== "object" || !ladderStr(x.name) || !intIn(x.rating, 0, 100000) || !["games", "wins", "losses", "draws"].every(k => intIn(x[k], 0, 1e9))) bad("a row");
    if(x.rank !== i + 1) bad("ranks that are not 1..n");
    if(x.games < LADDER_FLOOR) bad("a player under the floor");
    return {rank: x.rank, name: x.name, rating: x.rating, games: x.games, wins: x.wins, losses: x.losses, draws: x.draws};
  });
  for(let i = 1; i < ladder.length; i++) if(ladderCmp(ladder[i - 1], ladder[i]) > 0) bad("rows out of order");
  const recent = a.recent.map(x => {
    if(!x || typeof x !== "object" || !Array.isArray(x.names) || x.names.length !== 2 || !x.names.every(n => n === null || ladderStr(n)) || !Array.isArray(x.heroes) || x.heroes.length !== 2 || !x.heroes.every(ladderStr)
       || !(x.winner === null || x.winner === 0 || x.winner === 1) || RANKED_HOW.indexOf(x.how) < 0 || (x.winner === null) !== (x.how === "stalemate") || !intIn(x.at, 0, 1e15)) bad("a recent result");
    return {names: x.names.slice(), heroes: x.heroes.slice(), winner: x.winner, how: x.how, at: x.at};
  });
  let you = null;
  if(a.you != null){
    const y = a.you;
    if(typeof y !== "object" || !(y.name === null || ladderStr(y.name)) || !intIn(y.rating, 0, 100000) || !["games", "wins", "losses", "draws"].every(k => intIn(y[k], 0, 1e9)) || typeof y.listed !== "boolean"
       || (y.listed ? !intIn(y.rank, 1, 1e9) : y.rank !== null)) bad("the caller's line");
    you = {name: y.name, rating: y.rating, games: y.games, wins: y.wins, losses: y.losses, draws: y.draws, listed: y.listed, rank: y.listed ? y.rank : null, toGo: y.listed ? 0 : Math.max(0, LADDER_FLOOR - y.games)};
  }
  return {ladder, recent, you};
}
function opLadder(req, deps){
  if(typeof deps.ladder !== "function") return no("unavailable");
  return then(ladderWho(req, deps), player => then(deps.ladder({player, floor: LADDER_FLOOR, limit: LADDER_CAP, recent: LADDER_RECENT}), a => {
    const s = ladderShape(a);
    return {ok: true, floor: LADDER_FLOOR, cap: LADDER_CAP, ladder: s.ladder, recent: s.recent, ...(s.you ? {you: s.you} : {})};
  }));
}

/* ---- {op:"close", table, identity:{token}} (S4.4) --------------------------------------------------------------- */
function opCloseTable(req, deps){
  if(typeof req.table !== "string" || !ID_RE.test(req.table)) return no("bad-request");
  return recoveryWho(req, deps, who => then(deps.store.get(req.table), got => {
    if(!got || !got.row || got.row.closed === true) return no("no-table");
    if(!rowOk(got.row.v) || got.row.wireV !== W.WIRE_V) return no("wire");
    if(got.row.creator == null || got.row.creator !== who.player) return no("not-creator");
    /* S5.1: a decided ranked game is recorded BEFORE anything else, and the table is not closed over it (it is already over): closing is never
       a way to erase a result. If the record cannot be made now this refuses `internal` and the table stays as it is. A game still being
       played is closed as before and records nothing (the forfeit clock, a later release, closes that gap). */
    if(got.row.ranked === true && got.row.over === true && got.row.result == null)
      return then(healStrict(req.table, got, deps), () => ({ok: true}));
    if(got.row.over === true) return {ok: true};
    /* S5.2: CLOSING A STARTED RANKED GAME IS A CONCESSION. STARTED = the match has been dealt (the table's row holds the spec: both seats sat down and the
       who-goes-first lobby is finished, so there is a game) and is not over. The creator, if they hold a chair, concedes through the reducer exactly as the
       board's Concede button does (how: "concession", the closer the loser) and the table is NOT closed over it (it is over, with a result, and the other phone
       reads the ending). A ranked table closed before the deal, a creator with no chair, and every casual table close as they always did and record nothing. */
    if(got.row.ranked === true && got.row.hub && got.row.hub.spec){
      const row = got.row, seat = ownersOf(row).indexOf(who.player);
      if(seat >= 0){
        const c = concedeAs(req.table, row, deps, seat);
        if(!c) return no("internal");
        stampClock(row, c.r.hub, seat, deps);
        const pushed = [[], []]; pushed[1 - seat] = c.theirs;
        const ck = clockFrame(row, deps); pushed[1 - seat] = pushed[1 - seat].concat([ck]);
        return then(save(req.table, row, got.version, deps, pushed, [], undefined, undefined, ver => settleRow(req.table, row, ver, deps, c.r.hub)),
          a => a.ok ? {ok: true, conceded: true, ...(a.result ? {result: a.result} : {})} : a);
      }
    }
    const row = got.row; row.over = true; row.closed = true;
    return then(save(req.table, row, got.version, deps, [[], []], []), a => a.ok ? {ok: true} : a);
  }));
}

function join(req, got, deps){
  const ranked = got.row.ranked === true, fresh = req.key === undefined;       /* a keyed join is a phone that already holds its chair */
  if(req.identity === undefined){
    if(ranked && fresh) return no("ranked-signin");                            /* S5.1: a ranked chair is only for a signed-in player */
    return joinAs(req, got, deps, null);
  }
  const idn = req.identity;
  if(!idn || typeof idn !== "object" || Array.isArray(idn) || typeof idn.token !== "string" || idn.token.length < 1 || idn.token.length > 4096) return no("bad-request");
  /* S4.2: a display name is the PLAYER'S (op "me": validated, unique on its fold, stored once) and a join shows the stored one.
     A name offered at a join would let anyone wear another player's name for a game, so it is refused, never ignored. */
  if(idn.name !== undefined) return no("bad-request", {field: "name", reason: "at-join"});
  const name = null;
  if(typeof deps.identify !== "function") return no("identity");
  return then(deps.identify(idn.token), who => {
    if(who == null) return no("identity");
    if(typeof who !== "object" || typeof who.player !== "string" || !PLAYER_RE.test(who.player)) throw new Error("identify answered something that is not a player");
    let nm = name;
    if(nm == null && who.name != null){ const v = validateName(who.name); if(v.ok) nm = v.name; }   /* the stored default name; a bad one is dropped */
    if(!(ranked && fresh)) return joinAs(req, got, deps, {player: who.player, name: nm});
    /* S5.1: a ranked chair needs a chosen name, and the lobby shows the player's rating as they sit down (read once, kept in the row) */
    if(nm == null) return no("ranked-name");
    if(typeof deps.rating !== "function" || typeof deps.record !== "function") return no("unavailable");
    return then(deps.rating(who.player), rt => joinAs(req, got, deps, {player: who.player, name: nm, rating: ratingOf(rt).rating}));
  });
}
const PLAYER_RE = /^[A-Za-z0-9_-]{1,64}$/;

/* ---- {op:"me", identity:{token}, name?} (S4.2) ---------------------------------------------------------------
   WHO AM I, and what am I called. No table: a player's name is theirs across every table.
     no `name`  -> {ok:true, name: <the stored display name> | null}                       (never writes)
     `name`     -> validated by THE validator, then `deps.rename(player, name, fold)` -> "ok" | "taken":
                   {ok:true, name} | {ok:false, refused:"name-taken"}. `fold` is nameFold(name): lower case, spaces gone,
                   look-alikes levelled, so "Dawn Smith", "dawnsmith" and "Dawn Sm1th" are ONE name and only one player
                   can hold it (RULING (user, 2026-11-14): display names are unique, case-folded). Asking for the name
                   you already hold is "ok". The store decides the race (a unique index), not this function.
   Refusals: bad-request (+field:"name", reason) | identity (forged, expired, or no provider / no registry wired) |
   name-taken | internal (the provider or the registry threw). The player id never rides the answer. */
/* S5.1: `me` answers who the player is and what they are called (meCore, S4.2); when the function can read ratings the answer also carries the
   player's rating and record, read for the very player meCore identified (public by design; the player id stays inside) */
function me(req, deps){
  const seen = {player: null};
  return then(meCore(req, deps, seen), ans => {
    if(!ans || ans.ok !== true || typeof deps.rating !== "function" || seen.player == null) return ans;
    return then(deps.rating(seen.player), rt => ({...ans, ...ratingOf(rt)}));
  });
}
function meCore(req, deps, seen){
  const idn = req.identity;
  if(!idn || typeof idn !== "object" || Array.isArray(idn) || typeof idn.token !== "string" || idn.token.length < 1 || idn.token.length > 4096) return no("bad-request");
  let want = null;
  if(req.name !== undefined){
    const v = validateName(req.name);
    if(!v.ok) return no("bad-request", {field: "name", reason: v.reason});
    want = v.name;
  }
  if(typeof deps.identify !== "function") return no("identity");
  return then(deps.identify(idn.token), who => { if(who && typeof who.player === "string") seen.player = who.player;      /* for `me`'s rating */
    if(!who) return no("identity");                 /* forged, expired, unknown */
    if(typeof who !== "object" || typeof who.player !== "string" || !PLAYER_RE.test(who.player)) throw new Error("identify answered something that is not a player");
    if(want == null){ const v = who.name != null ? validateName(who.name) : null; return {ok: true, name: v && v.ok ? v.name : null}; }
    if(typeof deps.rename !== "function") return no("identity");
    return then(deps.rename(who.player, want, nameFold(want)), r => {
      if(r === "ok") return {ok: true, name: want};
      if(r === "taken") return no("name-taken");
      throw new Error("rename answered something that is neither ok nor taken");
    });
  });
}

/* ---- recovery codes (S4.3) ------------------------------------------------------------------------------------ */
const RECOVERY_DAYS = 730;                                /* two years; recovery_mint's own bound is 1..3650 */
const RECOVERY_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; /* 31 characters: no 0 O 1 I L */
const RECOVERY_LEN = 15;                                  /* 15 * log2(31) = 74.3 bits */
const recoveryNormal = raw => typeof raw === "string" ? raw.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
const recoveryValid = c => c.length === RECOVERY_LEN && Array.from(c).every(ch => RECOVERY_CHARS.indexOf(ch) >= 0);
const recoveryHash = code => SHA.sha256(code);            /* of the NORMALISED code, no salt: the code itself is 74 random bits */
function recoveryDraw(deps){
  const rb = deps.randBytes || (n => { const c = typeof crypto !== "undefined" ? crypto : null;
    if(!c || typeof c.getRandomValues !== "function") throw new Error("no cryptographic randomness for a recovery code");
    return c.getRandomValues(new Uint8Array(n)); });
  let out = "";
  while(out.length < RECOVERY_LEN){
    for(const b of Array.from(rb(32))){ if(b < 248 && out.length < RECOVERY_LEN) out += RECOVERY_CHARS[b % 31]; }   /* 248 = 31*8: no modulo bias */
  }
  return out;
}
const recoveryShow = c => c.match(/.{1,5}/g).join("-");
function recoveryWho(req, deps, f){
  const idn = req.identity;
  if(!idn || typeof idn !== "object" || Array.isArray(idn) || typeof idn.token !== "string" || idn.token.length < 1 || idn.token.length > 4096) return no("bad-request");
  if(typeof deps.identify !== "function") return no("identity");
  return then(deps.identify(idn.token), who => {
    if(!who) return no("identity");
    if(typeof who !== "object" || typeof who.player !== "string" || !PLAYER_RE.test(who.player)) throw new Error("identify answered something that is not a player");
    return f(who, idn.token);
  });
}
function opMintCode(req, deps){
  return recoveryWho(req, deps, who => {
    if(typeof deps.mint !== "function") return no("unavailable");
    const code = recoveryDraw(deps);
    return then(deps.mint(who.player, recoveryHash(code), RECOVERY_DAYS), r => {
      if(r !== "ok") throw new Error("mint answered something that is not ok");
      return {ok: true, code: recoveryShow(code), days: RECOVERY_DAYS};
    });
  });
}
function opRedeemCode(req, deps){
  const code = recoveryNormal(req.code);
  const tables = req.tables === undefined ? [] : req.tables;
  if(!Array.isArray(tables) || tables.length > 6 || !tables.every(t => typeof t === "string" && ID_RE.test(t))) return no("bad-request");
  return recoveryWho(req, deps, (who, token) => {
    if(typeof deps.redeem !== "function") return no("unavailable");
    /* the throwaway player must not be left holding a chair: look at the tables the phone says it has sat at */
    const seated = i => i >= tables.length ? false : then(deps.store.get(tables[i]), got => {
      const owners = got && got.row && Array.isArray(got.row.owners) ? got.row.owners : [];
      return owners.indexOf(who.player) >= 0 ? true : seated(i + 1);
    });
    return then(seated(0), held => {
      if(held) return no("recovery-seated");
      if(!recoveryValid(code)) return no("recovery");          /* malformed = the same answer as wrong */
      return then(deps.redeem(token, recoveryHash(code)), r => {
        if(r == null) return no("identity");
        if(r.status === "ok") { const v = r.name != null ? validateName(r.name) : null; return {ok: true, name: v && v.ok ? v.name : null}; }
        if(r.status === "limited") return no("recovery-limited");
        if(r.status === "refused") return no("recovery");
        throw new Error("redeem answered something that is not ok, refused or limited");
      });
    });
  });
}

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
    return {ok: true, version: got.version, seat: req.seat, n: row.nonces[req.seat], ...(who && ownersOf(row)[req.seat] === who.player ? {owned: true} : {}), ...pub(row, deps), frames: r.out[req.seat]};
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
      if(!who) return {ok: true, version: got.version, seat: prior, n: row.nonces[prior], ...pub(row, deps), frames};
      /* the same token, now with an identity: another player's seat is refused; an unowned one is bound to this player */
      const owner = ownersOf(row)[prior];
      if(owner != null && owner !== who.player) return no("seat-owned");
      if(owner === who.player) return {ok: true, version: got.version, seat: prior, n: row.nonces[prior], owned: true, ...pub(row, deps), frames};
      if(ownersOf(row)[1 - prior] === who.player) return no("seat-owned");     /* never both seats */
      stamp(row); row.owners[prior] = who.player; if(who.name != null) row.names[prior] = who.name; bindRank(row, prior, who);
      return save(id, row, got.version, deps, [[], []], frames, {seat: prior, n: row.nonces[prior], owned: true, ...pub(row, deps)});
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
  if(who){ stamp(row); row.owners[seat] = who.player; if(who.name != null) row.names[seat] = who.name; bindRank(row, seat, who); }
  return save(id, row, got.version, deps, [[], []], f.got, {seat, n: row.nonces[seat], ...(who ? {owned: true, ...pub(row, deps)} : {})});
}

/* S5.1: a ranked table remembers each player's rating as they sat down (the lobby's "1200 vs 1216"); a casual row is never touched */
function bindRank(row, seat, who){
  if(row.ranked === true && who.rating != null){ row.ratings = ratingsOf(row).slice(); row.ratings[seat] = who.rating; }
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
  bindRank(row, seat, who);
  const r = rig(id, row, deps);
  r.seat(seat, key, true);
  const frames = r.out[seat].map(f => f && f.ch === Hub.CH.JUDGE && f.seat === seat ? {...f, key} : f);
  const notice = [{ch: Hub.CH.JUDGE, taken: true, seat}];
  return save(id, row, got.version, deps, [[], []], frames, {seat, n: row.nonces[seat], owned: true, ...pub(row, deps)},
    ver => [[topic(id, seat, oldKey), {ver, frames: notice, mac: SHA.frameMac(oldKey, id, seat, ver, notice)}]]);
}

function frame(req, got, deps){
  const row = got.row, id = row.id, seat = req.seat, f = req.frame;
  if((seat !== 0 && seat !== 1) || !keyEq(req.key, row.hub.keys[seat])) return authFail(row, seat, req.key);
  if(!Number.isInteger(req.n) || req.n <= row.nonces[seat]) return no("stale");
  if(!f || typeof f !== "object" || (f.ch !== Hub.CH.LOBBY && f.ch !== Hub.CH.NET)) return no("bad-request");
  if(f.ch === Hub.CH.NET && !row.hub.spec) return no("not-dealt");
  /* S5.2: a ranked table whose forfeit was claimed before the match was dealt is over: a late lobby frame changes nothing (it reads the ending from the answer) */
  if(row.ranked === true && row.over === true && row.forfeit && !row.hub.spec) return {ok: true, version: got.version, frames: [], ...pub(row, deps)};
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
  /* S4.4: the row of a table a signed-in player created learns when its game ends, so the player's count of OPEN tables lets go of it
     (005_table_cap.sql reads `over`). A casual table has no creator and its row is never touched by this. */
  if(row.creator != null && row.over !== true){ const s = r.hub.session(); if(s && s.over()) row.over = true; }
  row.nonces = row.nonces.slice(); row.nonces[seat] = req.n;
  /* the caller's frames ride its response; only the OTHER seat's are pushed */
  const pushed = [[], []]; pushed[other] = r.out[other];
  /* S5.2: on a ranked table the forfeit clock follows the game: who it waits on now, since when, told to both phones as a sealed frame of its own */
  let mine = r.out[seat];
  if(row.ranked === true){
    stampClock(row, r.hub, seat, deps);
    const ck = clockFrame(row, deps);
    pushed[other] = pushed[other].concat([ck]); mine = mine.concat([ck]);
  }
  /* S5.1: the frame that decided a ranked game; the result comes from THIS hub's own game state, never from anything the phone said */
  const decided = row.ranked === true && row.over === true && row.result == null;
  return save(id, row, got.version, deps, pushed, mine, undefined, undefined, decided ? ver => settleRow(id, row, ver, deps, r.hub) : undefined);
}

/* ---- {op:"claim", table, seat, key} (S5.2): CLAIM THE WIN BY FORFEIT ------------------------------------------------------------
   The seat that is being kept waiting asks the function to end a RANKED game the other player has abandoned. The function decides, from its own row and its own
   game: the claimant holds the chair (seat + key, as a frame does), the table is ranked, the game is not over, a clock is running (the row's stamp) AND the
   game is still waiting on that seat now (re-read from the rehydrated hub, not trusted from the stamp), the waited-on seat is NOT the claimant, and the stamp
   is older than the limit by the SERVER's clock. Then the absent seat concedes through the reducer (the other phone is pushed the ending like any move), the row is
   marked over with `forfeit:{loser}` and saved under the row's version check, and the result is recorded as how:"forfeit". Nothing a phone sends names a winner.
   Refusals, each writing nothing: auth | bad-request | claim-casual | claim-over | claim-idle (no clock is running) | claim-self (the game is waiting on you) |
   claim-early (+ left: ms to wait) | conflict (retry:true: somebody wrote first; asked again it meets the answers above). THE RACE with the absent player's late
   move is the row's version: both save against the version they read, exactly one put wins; the loser of the race re-reads (a claim then meets claim-early or
   claim-idle, a late move meets "the game is over"). */
function claim(req, got, deps){
  const row = got.row, id = row.id, seat = req.seat;
  if((seat !== 0 && seat !== 1) || !keyEq(req.key, row.hub.keys[seat])) return authFail(row, seat, req.key);
  if(row.ranked !== true) return no("claim-casual");
  if(row.over === true || row.result) return no("claim-over");
  const ck = clockOn(row);
  if(!ck) return no("claim-idle");
  if(ck.on === seat) return no("claim-self");
  const left = forfeitLimit(deps) - clockAge(row, deps);
  if(left > 0) return no("claim-early", {left});
  const r0 = rig(id, row, deps);
  if(waitedOn(r0.hub) !== ck.on) return no("claim-idle");          /* the stamp is old news: the game is not waiting on that seat now */
  const loser = ck.on;
  row.forfeit = {loser};
  let pushed = [[], []], reply = [], hub = r0.hub;
  if(row.hub.spec){
    const c = concedeAs(id, row, deps, loser);
    if(!c) return no("internal");
    hub = c.r.hub; pushed[loser] = c.mine; reply = c.theirs;
  } else row.over = true;                                          /* the lobby: no game was dealt, the ending is the row's */
  stampClock(row, hub, loser, deps);
  return save(id, row, got.version, deps, pushed, reply, {claimed: true}, undefined, ver => settleRow(id, row, ver, deps, hub));
}

function resync(req, got, deps){
  const seat = req.seat;
  return then(frame({op: "frame", table: req.table, seat, key: req.key,
    n: Number.isInteger(req.n) ? req.n : (seat === 0 || seat === 1 ? got.row.nonces[seat] + 1 : 0),
    frame: {ch: Hub.CH.NET, m: {t: "resync", have: req.have | 0, seat, force: req.have == null}}}, got, deps),
    r => r.ok ? {...r, ...pub(got.row, deps)} : r);
}

/* ---- the entry ------------------------------------------------------- */
function serve(req, deps){
  if(!req || typeof req !== "object" || !deps || !deps.store) return no("bad-request");
  if(req.op === "create") return create(req, deps);
  if(req.op === "me") return me(req, deps);
  if(req.op === "ladder") return opLadder(req, deps);
  if(req.op === "close") return opCloseTable(req, deps);
  if(req.op === "recovery-mint") return opMintCode(req, deps);
  if(req.op === "recovery-redeem") return opRedeemCode(req, deps);
  if(typeof req.table !== "string" || !ID_RE.test(req.table)) return no("bad-request");
  const fn = req.op === "join" ? join : req.op === "frame" ? frame : req.op === "resync" ? resync : req.op === "claim" ? claim : null;
  if(!fn) return no("bad-request");
  return then(deps.store.get(req.table), got => {
    if(!got || !got.row || got.row.closed === true) return no("no-table");       /* a closed table (S4.4) is gone for both seats */
    if(!rowOk(got.row.v) || got.row.wireV !== W.WIRE_V) return no("wire");
    /* S5.1: a ranked game that is over and has no recorded result (its recording failed when it ended) is settled by whoever asks next */
    if(got.row.ranked === true && got.row.over === true && got.row.result == null) return then(healSoft(req.table, got, deps), g2 => fn(req, g2, deps));
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

return {handle, handleNow, topic, OPEN_CAP, FORFEIT_MS, LADDER_FLOOR, LADDER_CAP, LADDER_RECENT, ROW_V, ROW_V_CASUAL, ROW_V_RANKED, ROW_V_RANKED_4, validateName, nameFold, recoveryNormal, recoveryHash, RECOVERY_DAYS, RECOVERY_CHARS, RECOVERY_LEN};
});
