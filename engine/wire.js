/* ============================================================
   Dawnblade engine — wire.js (Phase B, roadmap step 8)

   THE GAME AS ONE JSON OBJECT — and the fingerprint that proves two
   phones are looking at the same game.

   ROADMAP-MULTIPLAYER.md Phase B has three parts: extract the reducer,
   add a transport, and "hash the state after each action and compare; on
   mismatch, resync from the log. Do not skip this — silent desync is the
   characteristic failure of lockstep netcode and it is miserable to debug
   after the fact." This module is that third part, plus the snapshot
   format the resync needs.

   FOUR JOBS, and they are deliberately separate functions:

     encode(game)        game  -> a plain JSON object, losslessly
     decode(wire)        and back again
     hash(game)          a 64-bit fingerprint of the RULES state
     diffPaths(a, b)     WHERE two states differ, path by path

   The fourth is the one that turns a bad night into a five-minute fix.
   A hash mismatch tells you that you have desynced; it does not tell you
   that seat 1's graveyard has one extra card. `diffPaths` does, and it is
   worth the forty lines precisely because the roadmap is right about how
   miserable this is to debug after the fact.

   ---- THIS MODULE READS NO CARD TEXT ----------------------------------

   Not one line here parses, classifies or interprets a card. A card is an
   opaque bag of fields that gets interned and diffed STRUCTURALLY. That
   is not squeamishness about the golden rule, it is what makes the format
   survive the next parser change: a card that grows a field ships that
   field automatically, and a card the parser has never seen serializes
   exactly as well as one it has.

   ---- WHAT ACTUALLY GOES ON THE WIRE ----------------------------------

   A naive JSON.stringify of a live game is mostly repetition: a 60-card
   deck holds ~25 distinct card definitions, each carrying its rules text,
   its keyword list, its art URLs and its parsed `fx` tree, and each one
   written out in full every time it appears. So cards are INTERNED:

     dict:  [ {k:"Sink Below|3", d:{…the definition…}}, … ]
     zone:  [ [0, {uid:12}], [0, {uid:31}], [4, {uid:7, _gy:3}] ]

   Each card on the wire is `[dictIndex, overrides, deletions?]` where the
   overrides are exactly the fields that differ from the dictionary entry.
   That is where `uid` lives, and `_gy`, and gear's `curDef`/`destroyed`,
   and the arsenal's `_faceUp`/`_arsPow` stamps — every per-instance fact,
   found by diffing rather than by a hardcoded list of field names.

   With a CATALOG (a `name|pitch` -> definition map, which every client
   already has: it is the card cache the loader fills), the definitions do
   not travel at all — the dictionary carries bare keys and both ends
   rehydrate locally. That is the steady-state mode and it is roughly an
   order of magnitude smaller.

   THE CATALOG IS ALSO THE HAZARD, so it is pinned. If two clients hold
   different card data — one warm on `sage-v8`, one on `sage-v9` — then
   bare keys rehydrate into different cards and the game silently diverges
   with nothing to point at. `catalogHash` rides in the payload and
   `decode` refuses a mismatch. A loud refusal at the handshake beats a
   quiet divergence on turn six.

   ---- WHAT THE HASH DELIBERATELY IGNORES ------------------------------

   `hash` fingerprints the RULES state, which is not the same as the whole
   object, and the exclusions are not arbitrary:

     log, feed     THE TAUNTS ARE RANDOM ON PURPOSE. CLAUDE.md keeps
                   taunts, trophy text and the random-hero button on
                   Math.random precisely because they touch no game state.
                   They are therefore guaranteed to differ between two
                   honest peers, and hashing them would report a desync on
                   literally every action.
     inspect,
     boostOn       per-client UI toggles. One player using inspect mode is
                   not a divergence.
     img, dbImg,
     prs           art URLs. Presentation, and catalog-derived anyway.

   Everything else is in, including `rng` — `rng.n` is the draw counter and
   the cheapest desync canary there is, exactly as rng.js says.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnWire = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* Bump WIRE_V for any change to the payload SHAPE. Two clients on
   different wire versions must refuse to play rather than guess, which is
   what `decode` does — same discipline as DATA_VER keying the card cache. */
/* v3.82 — `rune` left SIDE_FIELDS (dead since v2.23 made the count
   derived), so the payload shape changed and this bumps with it. Two
   clients on different versions are refused at the handshake rather than
   discovering it on turn six.
   v3.87 — `atkBuff` JOINED it (Night's Embrace's standing attack grant),
   which is the same kind of shape change in the other direction. */
const WIRE_V = 3;
const PROTO  = "dawnblade/1";

/* ---- the zone ledger -------------------------------------------------
   Which fields of a side hold cards, and in what shape. Taken straight
   from sides.js's SIDE_FIELDS, and split by container shape because that
   is the only thing the encoder needs to know about them.

   THIS IS A LEDGER, in the same sense as sides.js's P_MAP/GAME_KEYS: a
   zone that is missing here is not an error the encoder can detect — it
   simply ships verbatim, uninterned, and keeps working. So the drill in
   test/wire.test.js checks this list against SIDE_FIELDS and fails if a
   new zone-shaped field appears in neither list. A new zone cannot
   quietly escape the format. */
const CARD_ZONES  = ["deck","hand","pitch","grave","banish","soul","gear"];
const SLOT_ZONES  = ["arsenal"];                 /* one card, or null */
const ENTRY_ZONES = ["board"];                   /* {card, kind, spent, uid} */

/* Side fields that are NOT card containers. Listed so the drill can prove
   every SIDE_FIELD is accounted for one way or the other. */
const NON_CARD_SIDE_FIELDS = [
  "id","name","hero","heroKey","hp","maxHp","int","baseInt","intWas",
  "res","ap","wasted","counters","weaponUsed","heroTapped","buffNext","buffQ","atkBuff","gaNext","gaNextQ","costOff","instantNextQ","defCapNext","defActionBuff","wardRider",
  "runeHitNext","amp","ward","awd","arcShield",
  "lifeLock","namedBuff","dracNext","marked","fatigue","hist",
  "blockH","blockG","blockRx","blockedHand","chainBlocked","intimidated","paySel",
  "nextTurn"
];

/* Per-instance by construction: never part of a dictionary entry. `uid`
   is explicit; everything else is caught by the underscore convention the
   trainer already uses for runtime stamps (_gy, _faceUp, _upTurn, _arsPow,
   _arsGA, _dead, _target, _life). Anything else that differs is found by
   the diff, so this list being short is a feature, not a gap. */
const isInstanceKey = k => k === "uid" || k.charCodeAt(0) === 95 /* _ */;

/* Excluded from the rules fingerprint. See the header for why each. */
const VOLATILE_GAME = ["log","feed","inspect","boostOn","_unmapped"];
const VOLATILE_CARD = ["img","dbImg","prs"];
const VOLATILE = new Set([...VOLATILE_GAME, ...VOLATILE_CARD]);

/* ---- canonical form --------------------------------------------------
   One unambiguous string per value, with object keys SORTED so that two
   states built by different code paths — one from makeGame, one decoded
   off the wire — fingerprint identically. JSON.stringify cannot be used
   for this: it preserves insertion order, so `{a:1,b:2}` and `{b:2,a:1}`
   would hash differently and every reconnect would look like a desync.

   Strings are length-prefixed rather than quoted, so no amount of commas
   or braces inside a card's rules text can forge a structural boundary. */
function emitCanon(v, emit, skip){
  if(v === undefined) return emit("u");
  if(v === null)      return emit("z");
  const t = typeof v;
  if(t === "number"){
    if(v !== v)              return emit("#N");        /* NaN — invariants.js watches for these */
    if(v === Infinity)       return emit("#+");
    if(v === -Infinity)      return emit("#-");
    /* -0 and 0 are the same game state; normalize so they cannot differ */
    return emit("#" + (v === 0 ? 0 : v));
  }
  if(t === "boolean")  return emit(v ? "T" : "F");
  if(t === "string")   return emit("s" + v.length + ":" + v);
  /* A function or a symbol in game state is a bug, not a value — say so
     loudly here rather than letting JSON silently drop it and produce two
     peers that agree on a hash and disagree on the game. */
  if(t === "function" || t === "symbol") throw new Error("wire: non-serializable " + t + " in game state");
  if(Array.isArray(v)){
    emit("[");
    for(let i = 0; i < v.length; i++){ if(i) emit(","); emitCanon(v[i], emit, skip); }
    return emit("]");
  }
  const keys = Object.keys(v).filter(k => !skip.has(k) && v[k] !== undefined).sort();
  emit("{");
  for(let i = 0; i < keys.length; i++){
    if(i) emit(";");
    emit("s" + keys[i].length + ":" + keys[i]);
    emit("=");
    emitCanon(v[keys[i]], emit, skip);
  }
  return emit("}");
}

/* The debuggable form. `hash` deliberately does NOT build this — on a
   phone, per action, a full game is a few hundred KB of string and there
   is no reason to materialize it just to fold it down to 16 characters. */
function canon(v, skip){
  const out = [];
  emitCanon(v, s => out.push(s), skip || VOLATILE);
  return out.join("");
}

/* ---- the fingerprint -------------------------------------------------
   Two FNV-1a streams with different offset bases, folded into 16 hex
   characters. 32 bits would already make an accidental agreement about a
   1-in-4-billion event per comparison; 64 makes it not worth thinking
   about, and it costs one extra multiply per character.

   Not cryptographic and not trying to be. This detects DIVERGENCE between
   two cooperating peers, which is a very different threat model from an
   opponent forging a state — and per ROADMAP-MULTIPLAYER.md fact 4, Phase
   B does not have a cheat-proof threat model at all. Phase C's server
   holding authoritative state is the answer to that, not a bigger hash. */
function hash(value, skip){
  let a = 0x811c9dc5, b = 0x01000193;
  const feed = s => {
    for(let i = 0; i < s.length; i++){
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b ^ c, 0x85ebca6b);
      b = (b ^ (b >>> 13)) >>> 0;
    }
  };
  emitCanon(value, feed, skip || VOLATILE);
  const hx = n => ((n >>> 0).toString(16).padStart(8, "0"));
  return hx(a) + hx(b);
}

/* ---- where two states differ -----------------------------------------
   The payoff function. Returns up to `limit` paths, deepest-first in
   traversal order, each a slash path into the state:

     sides/1/grave/0/uid          seat 1 buried a different card
     rng/n                        one peer took a draw the other did not
     priority                     the handoff diverged

   That last one matters: a bare hash mismatch after a chain link could be
   any of a hundred things, and this names it in one line. */
function diffPaths(a, b, limit, skip){
  const cap = limit == null ? 24 : limit;
  const sk = skip || VOLATILE;
  const out = [];
  (function walk(x, y, path){
    if(out.length >= cap) return;
    const cx = canon(x, sk), cy = canon(y, sk);
    if(cx === cy) return;
    const bothObj = x && y && typeof x === "object" && typeof y === "object" &&
                    Array.isArray(x) === Array.isArray(y);
    if(!bothObj){ out.push(path || "/"); return; }
    if(Array.isArray(x)){
      const n = Math.max(x.length, y.length);
      /* A length change is the fact worth reporting; without it, shifting
         a deck by one card reports every index as different. */
      if(x.length !== y.length){ out.push(path + "/#length " + x.length + " vs " + y.length); }
      for(let i = 0; i < n && out.length < cap; i++) walk(x[i], y[i], path + "/" + i);
      return;
    }
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => !sk.has(k)).sort();
    for(const k of keys){ if(out.length >= cap) return; walk(x[k], y[k], path + "/" + k); }
  })(a, b, "");
  return out;
}

/* ---- the card dictionary --------------------------------------------- */
/* Cards are identified the way the parser's memo already identifies them
   (`name|pitch`) — not because this module knows what a card is, but
   because that pair is what the loader keys its cache on, so a catalog
   handed in from the trainer is already in this shape. */
const cardKey = c => String((c && c.name) || "") + "|" + ((c && c.pitch) || 0);

/* A catalog is a plain `key -> definition` map. Its hash pins that both
   clients rehydrate bare keys into identical cards. Sorted, so two
   catalogs built by different load orders agree. */
function catalogHash(catalog){
  if(!catalog) return null;
  const keys = Object.keys(catalog).sort();
  return hash(keys.map(k => [k, stripInstance(catalog[k])]));
}

function stripInstance(card){
  const out = {};
  for(const k of Object.keys(card)) if(!isInstanceKey(k)) out[k] = card[k];
  return out;
}

/* Everything about `card` that disagrees with `base`. `set` carries the
   differing values, `del` the keys base has and card does not. Both are
   found structurally — no field is named anywhere in this function, which
   is what lets a card grow a field without touching the format. */
function overrides(card, base){
  const set = {}, del = [];
  let any = false;
  for(const k of Object.keys(card)){
    if(!(k in base) || canon(card[k], VOLATILE) !== canon(base[k], VOLATILE)){ set[k] = card[k]; any = true; }
  }
  for(const k of Object.keys(base)) if(!(k in card)){ del.push(k); any = true; }
  return any ? {set, del} : null;
}

/* ---- encode ----------------------------------------------------------
   Options:
     catalog   key -> definition. Present: the dictionary ships bare keys
               and the payload shrinks by roughly 10x. Absent: definitions
               travel, so a peer with a cold cache can still join.
     log       false drops log/feed from the payload. They are cosmetic
               (see the header) and they are most of a long game's bytes.
               Default true, because lossless round-trip is the contract
               this module is tested against and trimming is the option.

   PER-ENTRY FALLBACK: a card the catalog does not know still ships its
   definition. A token minted at runtime, or a card added to NEEDED since
   the peer last warmed its cache, therefore crosses correctly instead of
   arriving as a hole. */
function encode(game, opts){
  opts = opts || {};
  const catalog = opts.catalog || null;
  const dict = [], index = new Map();

  const encCard = card => {
    if(!card) return card;
    const k = cardKey(card);
    let slot = index.get(k);
    if(!slot){
      /* The base MUST be whatever the decoder will rebuild from, or the
         diff is computed against the wrong thing. With a catalog hit that
         is the catalog entry; otherwise it is this first sighting,
         stripped of its instance fields. */
      const fromCat = catalog && catalog[k];
      const base = fromCat ? stripInstance(fromCat) : stripInstance(card);
      slot = {i: dict.length, base};
      dict.push(fromCat ? {k} : {k, d: base});
      index.set(k, slot);
    }
    const ov = overrides(card, slot.base);
    if(!ov) return [slot.i];
    return ov.del.length ? [slot.i, ov.set, ov.del] : [slot.i, ov.set];
  };

  const out = {...game, sides: (game.sides || []).map(sd => mapZones(sd, encCard))};
  if(opts.log === false){ delete out.log; delete out.feed; }

  return {
    v: WIRE_V, proto: PROTO,
    /* the fingerprint of the state being sent, computed BEFORE the
       zones were rewritten — decode checks its rebuild against it */
    h: hash(game),
    cat: catalog ? catalogHash(catalog) : null,
    dict, game: out
  };
}

/* ---- decode ----------------------------------------------------------
   Refuses rather than guesses, in three places, and each refusal is a
   silent desync that did not happen:

     WIRE-VERSION     the payload shape is from a different build
     WIRE-CATALOG     the peers hold different card data (DATA_VER skew)
     WIRE-NO-DEF      a bare key with no catalog to rehydrate it from
     WIRE-HASH        the rebuild does not match what the sender fingerprinted */
function decode(w, opts){
  opts = opts || {};
  if(!w || typeof w !== "object") throw new Error("WIRE-EMPTY: nothing to decode");
  if(w.v !== WIRE_V) throw new Error("WIRE-VERSION: payload v" + w.v + ", this build speaks v" + WIRE_V);
  const catalog = opts.catalog || null;
  if(w.cat != null && catalogHash(catalog) !== w.cat)
    throw new Error("WIRE-CATALOG: peers hold different card data — check DATA_VER on both clients");

  const bases = (w.dict || []).map(e => {
    const base = (catalog && catalog[e.k]) ? stripInstance(catalog[e.k]) : e.d;
    if(!base) throw new Error("WIRE-NO-DEF: no definition for " + e.k + " and no catalog to rehydrate it");
    return base;
  });

  const decCard = enc => {
    if(!enc) return enc;
    if(!Array.isArray(enc)) return enc;          /* already a card — decode is idempotent */
    const card = {...bases[enc[0]], ...(enc[1] || {})};
    if(enc[2]) for(const k of enc[2]) delete card[k];
    return card;
  };

  const game = {...w.game, sides: (w.game.sides || []).map(sd => mapZones(sd, decCard))};

  /* The integrity check that makes a truncated or tampered payload fail
     loudly. Skipped only when the sender trimmed the log, since the
     fingerprint ignores log/feed anyway — so this stays exact either way. */
  if(w.h != null && hash(game) !== w.h)
    throw new Error("WIRE-HASH: rebuilt state does not match the sender's fingerprint");
  return game;
}

/* One traversal, used by both directions — which is what makes them
   provably symmetric rather than two lists that have to be kept in step. */
function mapZones(side, fn){
  if(!side) return side;
  const out = {...side};
  for(const z of CARD_ZONES)  if(Array.isArray(side[z])) out[z] = side[z].map(fn);
  for(const z of SLOT_ZONES)  if(side[z]) out[z] = fn(side[z]);
  for(const z of ENTRY_ZONES) if(Array.isArray(side[z]))
    out[z] = side[z].map(e => (e && e.card) ? {...e, card: fn(e.card)} : e);
  return out;
}

/* Build a catalog from any collection of resolved cards — the trainer can
   hand this its card cache directly. Later duplicates lose, so the first
   printing wins, matching cards.js's per-set rule. */
function makeCatalog(cards){
  const out = {};
  for(const c of cards || []){ const k = cardKey(c); if(!(k in out)) out[k] = stripInstance(c); }
  return out;
}

/* Payload size in bytes, for the diagnostics the session layer reports.
   Cheap enough to call per snapshot, which is the only place it is used. */
const sizeOf = w => JSON.stringify(w).length;

return {
  WIRE_V, PROTO,
  CARD_ZONES, SLOT_ZONES, ENTRY_ZONES, NON_CARD_SIDE_FIELDS,
  VOLATILE_GAME, VOLATILE_CARD, VOLATILE,
  canon, hash, diffPaths,
  cardKey, catalogHash, makeCatalog, stripInstance, overrides,
  encode, decode, mapZones, sizeOf
};
});
