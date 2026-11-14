/* ============================================================
   Dawnblade engine — referee.js (HIDDEN HANDS H2, HIDDEN-HANDS.md §3(b), §4.3–4.5)

   THE ONE PHONE THAT HOLDS THE DECK.

   Until v6.02 both phones ran `judge.reduce` in lockstep over the full state,
   so each phone held everything: the other hand, both decks' order, and the
   seed that IS every future draw (HIDDEN-HANDS.md §1). The referee ends that.
   It runs on the HOST (casual play, §3(b)) and, unchanged, on a neutral device
   later (§3(c), H3). It holds the full state and is the only thing that calls
   `judge.reduce` (unchanged: it always ran on full state). Every other phone
   receives only:

     seatView(state, seat)   `view.view(state, seat)` with three more cuts
                             (below), as a SNAPSHOT on join or repair;
     a per-seat COMMIT       after every action: the action REDACTED for that
                             seat, the DELTA from the last view it was sent to
                             the new one, and `h`, the fingerprint of the new
                             view (the desync canary, on views not states).

   and sends INTENTS only. A phone never runs the reducer on a view: §5
   measured that 5.8% of steps need a reveal mid-resolution and 2.2% cannot
   even be validated without a hidden hand. The referee validates (`legal`),
   so P13 disappears; the guest pre-checks on its own view only to keep an
   illegal tap from leaving the phone (§4.2: 0 false refusals in 13,231).

   ---- THE CUTS ON TOP OF view() ----------------------------------------
     the FEED    lines tagged for the other seat (`feedTo`, tagged at the
                 source by effects.js) are dropped, `feedTo` is renumbered,
                 and `log` (the newest-first copy of the feed) is rebuilt
                 from the readable lines. Both are cosmetic (wire.js VOLATILE)
                 and neither is hashed, so the two phones' feeds may differ.
     `still`     judge.stalemateCheck's tracker holds `stillSig`, every
                 zone's uids IN ORDER: both decks' order and the foe's hand,
                 in one string. Only the referee runs the check (it is in
                 `judge.reduce`), so a seat gets the public clocks only.
     `unseen`    the composition multisets keep their cards but lose their
                 real uids (`?u<owner><i>`): a uid is a decklist index, and
                 a hidden card's uid in a phone's memory is the thing the
                 loopback drill forbids, even inside a multiset.
     `counters`  the per-side bag is keyed by uid, and an entry can outlive
                 its card's stay in the arena (found by the loopback drill:
                 Malefic Incantation back in a hand kept its key, naming the
                 card). An entry keyed by a uid hidden from the seat is cut.
     bare uids   view.js sweeps card OBJECTS. A field that names a card by its
                 bare uid (a pending's candidate list `uids`, a fusion
                 declaration's `_fuseUid`, a face-down piece's `_flipGear`)
                 is scrubbed by key (`UID_KEY`): a hidden uid becomes the
                 carrier placeholder `?<owner>x`. The loopback drill deals its
                 games with uids from 100000 so ANY scalar naming a hidden
                 uid, under any key, is caught: that is what proves the key
                 list complete for the pool.

   ---- SLOT HANDLES (P3) ------------------------------------------------
   An action that puts a hidden card in a hidden place (hand to face-down
   arsenal, hand to the top or bottom of a deck) must not name the card to the
   other seat. `redactAction` replaces every uid the receiver may not see
   AFTER the action by the receiver's own placeholder for that slot (the
   positional uid view.js gives it). A uid that went public by the action (a
   card played from hand) stays: the action revealed it.

   ---- THE DELTA ---------------------------------------------------------
   A structural diff of two JSON views: set, delete, and array splice (common
   prefix and suffix trimmed). A card in a delta whose `name|pitch` is in the
   CATALOG (both phones build the same one from the public decklists) ships as
   its key and its instance overrides, exactly wire.js's interning. The
   referee keeps the last view it sent each seat, JSON-normalised, so the
   guest's view after `applyDelta` is exactly the referee's (`h` proves it).

   ---- THE LOG -----------------------------------------------------------
   The referee keeps the FULL action log ({seq, seat, action}, unredacted).
   At game end it is published with the seed's secret half, and `replay`
   (any phone) rebuilds the game from the seed and runs every action through
   `judge.reduce` again: the "verify this game" button (§4.4).

   NO TIMERS, NO TRANSPORT. Like net.js it takes callbacks and returns data;
   test/referee.test.js drills it over an in-memory JSON loopback.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./view.js"), require("./wire.js"), require("./sha256.js"));
  else root.DawnReferee = factory(root.DawnView, root.DawnWire, root.DawnSHA);
})(typeof self!=="undefined" ? self : this, function(V, W, SHA){

const LOG_KEEP = 40;    /* judge.js's `say` keeps this many log lines */

/* ---- the seat's view ---------------------------------------------------- */
const json = v => v === undefined ? v : JSON.parse(JSON.stringify(v));

/* The public clocks of the stalemate tracker, without its uid signatures. */
function publicStill(st){
  if(!st) return st;
  const out = {since: st.since};
  if(st.loop) out.loop = {turn: st.loop.turn, since: st.loop.since};
  return out;
}

/* The feed as `seat` may read it. */
function seatFeed(g, seat){
  const feed = g.feed || [], to = g.feedTo || {};
  const out = [], outTo = {};
  feed.forEach((line, i) => {
    const t = to[i];
    if(t != null && t !== seat) return;
    if(t != null) outTo[out.length] = t;
    out.push(line);
  });
  return {feed: out, feedTo: outTo, log: out.slice(-LOG_KEEP).reverse()};
}

/* A key that holds a uid (or a list of them): `uid`, `uids`, `picked` (a charge
   pending's chosen cards, v6.25), `_fuseUid`,
   `targetUid`…, a `target`, and `_flipGear` (a face-down piece's own uid,
   carried by its ability). */
const UID_KEY = /uid|^target$|^_flipGear$|^picked$/i;
/* Replace, in place on a JSON copy, every uid-keyed value naming a card in
   `hid` (uid -> {owner}) by `to(uid)`; and drop a uid-keyed bag's hidden keys. */
function scrubUids(v, hid, to){
  /* a piece's ability card carries a DERIVED uid, "gp"/"bp" + the piece's
     (build.js): it names the piece as surely as the piece's own */
  const fix = x => {
    if(x == null) return x;
    if(hid.has(String(x))) return to(String(x));
    const m = typeof x === "string" && /^(gp|bp)(.+)$/.exec(x);
    return m && hid.has(m[2]) ? m[1] + to(m[2]) : x;
  };
  (function walk(x){
    if(x == null || typeof x !== "object") return;
    if(Array.isArray(x)){ x.forEach(walk); return; }
    for(const k of Object.keys(x)){
      const y = x[k];
      if(k === "counters" && y && typeof y === "object" && !Array.isArray(y)){
        for(const u of Object.keys(y)) if(hid.has(String(u))) delete y[u];
        continue;
      }
      if(UID_KEY.test(k)){
        if(Array.isArray(y)){ x[k] = y.map(e => (e != null && typeof e === "object") ? (walk(e), e) : fix(e)); continue; }
        if(y == null || typeof y !== "object"){ x[k] = fix(y); continue; }
      }
      walk(y);
    }
  })(v);
  return v;
}

/* `view` plus the cuts, JSON-normalised (what crosses a wire is JSON, so the
   referee fingerprints exactly what the guest will hold). */
function seatView(g, seat){
  if(!g || !g.sides) return g;
  const hid = V.hiddenUids(g, seat);
  const f = seatFeed(g, seat);
  const v = json({...V.view(g, seat), feed: f.feed, feedTo: f.feedTo, log: f.log, still: publicStill(g.still)});
  /* the composition multisets: each card gets a uid of its own that names no
     decklist slot, everywhere inside it (a face-down piece's ability carries
     its piece's uid) */
  v.sides.forEach((sd, owner) => {
    if(owner === seat) return;
    for(const k of ["unseen", "unseenGear"]) (sd[k] || []).forEach((c, i) => {
      if(!c) return;
      const old = String(c.uid), neu = "?u" + owner + (k === "unseen" ? "" : "g") + i;
      scrubUids(c, new Map([[old, 1]]), () => neu);
    });
  });
  /* every other uid-keyed value naming a hidden card: a carrier placeholder,
     which says whose card it is and nothing about where it sits */
  return scrubUids(v, hid, u => "?" + hid.get(u).owner + "x");
}

/* uid -> placeholder uid, for every card hidden from `seat` in `g`. */
function slotMap(g, seat){
  const m = new Map();
  for(const [uid, r] of V.hiddenUids(g, seat)){
    const z = {hand: "h", deck: "d", arsenal: "a", intimidated: "i", gear: "g", soul: "s"}[r.zone];
    m.set(uid, "?" + r.owner + z + r.i);
  }
  return m;
}
/* THE SLOT HANDLE: the action as `seat` may know it, given the state AFTER it.
   Key-based like the scrub (a uid is a small integer, and so is a prompt
   index), and POSITIONAL: the slot a card went to face-down is public. */
function redactAction(action, after, seat){
  const m = slotMap(after, seat);
  const a = json(action);
  if(!m.size || a == null || typeof a !== "object") return a;
  return scrubUids(a, m, u => m.get(u));
}

/* ---- the delta ---------------------------------------------------------- */
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
function same(a, b){
  if(a === b) return true;
  if(typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if(Array.isArray(a) !== Array.isArray(b)) return false;
  if(Array.isArray(a)){ if(a.length !== b.length) return false; for(let i = 0; i < a.length; i++) if(!same(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if(ka.length !== kb.length) return false;
  for(const k of ka){ if(!Object.prototype.hasOwnProperty.call(b, k) || !same(a[k], b[k])) return false; }
  return true;
}

/* A card, interned against the catalog: {"~c": key, s?: overrides, x?: deletions}. */
function pack(v, catalog){
  if(v == null || typeof v !== "object") return v;
  if(Array.isArray(v)) return v.map(x => pack(x, catalog));
  if(catalog && v.uid != null && v.name != null){
    const k = W.cardKey(v), base = catalog[k];
    if(base){
      const ov = W.overrides(v, W.stripInstance(base));
      const o = {"~c": k};
      if(ov){ if(Object.keys(ov.set).length) o.s = ov.set; if(ov.del.length) o.x = ov.del; }
      return o;
    }
  }
  const o = {};
  for(const k of Object.keys(v)) o[k] = pack(v[k], catalog);
  return o;
}
function unpack(v, catalog){
  if(v == null || typeof v !== "object") return v;
  if(Array.isArray(v)) return v.map(x => unpack(x, catalog));
  if(typeof v["~c"] === "string"){
    const base = catalog && catalog[v["~c"]];
    if(!base) throw new Error("REF-NO-DEF: no catalog entry for " + v["~c"]);
    const card = {...json(W.stripInstance(base)), ...(v.s || {})};
    for(const k of (v.x || [])) delete card[k];
    return card;
  }
  const o = {};
  for(const k of Object.keys(v)) o[k] = unpack(v[k], catalog);
  return o;
}

/* Ops: ["s", path, value] · ["d", path] · ["a", path, start, deleteCount, items]. */
function delta(a, b, catalog){
  const ops = [];
  (function walk(x, y, path){
    if(same(x, y)) return;
    /* a DIFFERENT card in the same place (a placeholder turned real, a new
       top card) is replaced whole, not walked field by field */
    const card = isObj(x) && isObj(y) && (x.uid != null || y.uid != null) && (x.uid !== y.uid || x.name !== y.name);
    if(isObj(x) && isObj(y) && !card){
      for(const k of Object.keys(x)) if(!Object.prototype.hasOwnProperty.call(y, k)) ops.push(["d", path.concat(k)]);
      for(const k of Object.keys(y)){
        if(!Object.prototype.hasOwnProperty.call(x, k)) ops.push(["s", path.concat(k), pack(y[k], catalog)]);
        else walk(x[k], y[k], path.concat(k));
      }
      return;
    }
    if(Array.isArray(x) && Array.isArray(y)){
      let p = 0;
      while(p < x.length && p < y.length && same(x[p], y[p])) p++;
      let s = 0;
      while(s < x.length - p && s < y.length - p && same(x[x.length - 1 - s], y[y.length - 1 - s])) s++;
      const xm = x.length - p - s, ym = y.length - p - s;
      if(xm === ym && xm <= 4){ for(let i = p; i < p + xm; i++) walk(x[i], y[i], path.concat(i)); return; }
      ops.push(["a", path, p, xm, pack(y.slice(p, p + ym), catalog)]);
      return;
    }
    ops.push(["s", path, pack(y, catalog)]);
  })(a, b, []);
  return ops;
}

/* Apply a delta to a view. Copies along every path it writes, so a view the
   caller still holds is never mutated. */
function applyDelta(v, ops, catalog){
  let root = {box: v};
  const copy = x => Array.isArray(x) ? x.slice() : (isObj(x) ? {...x} : x);
  for(const op of ops || []){
    const path = ["box"].concat(op[1]);
    let parent = root = copy(root), node;
    for(let i = 0; i < path.length - (op[0] === "a" ? 0 : 1); i++){
      const k = path[i];
      node = copy(parent[k]);
      if(node == null) throw new Error("REF-PATH: no " + op[1].slice(0, i).join("/"));
      parent[k] = node;
      parent = node;
    }
    if(op[0] === "a"){
      if(!Array.isArray(parent)) throw new Error("REF-PATH: not a list at " + op[1].join("/"));
      parent.splice(op[2], op[3], ...unpack(op[4], catalog));
    } else {
      const last = path[path.length - 1];
      if(op[0] === "d") delete parent[last];
      else parent[last] = unpack(op[2], catalog);
    }
  }
  return root.box;
}

/* ---- the view census (a phone's own invariant check) --------------------
   A phone cannot run invariants.js's full judge: it holds no hidden card.
   What it CAN check is the view's own shape: two seats, every list zone a
   list, the arsenal one card or none, no uid in two places (placeholders are
   positional, so they are unique too), and every number a number. */
const CENSUS_ZONES = ["deck", "hand", "pitch", "grave", "banish", "soul", "board", "gear", "intimidated"];
function viewCensus(v){
  const bad = [];
  if(!v || !Array.isArray(v.sides) || v.sides.length !== 2) return ["a view has two seats"];
  const seen = new Map();
  const put = (uid, where) => { if(uid == null) return; const k = String(uid);
    if(seen.has(k)) bad.push("uid " + k + " is in " + seen.get(k) + " and " + where); else seen.set(k, where); };
  v.sides.forEach((sd, s) => {
    for(const z of CENSUS_ZONES){
      if(sd[z] == null && z === "intimidated") continue;
      if(!Array.isArray(sd[z])){ bad.push("sides[" + s + "]." + z + " is not a list"); continue; }
      sd[z].forEach((e, i) => put(e && (e.uid != null ? e.uid : (e.card && e.card.uid)), "sides[" + s + "]." + z + "[" + i + "]"));
    }
    if(sd.arsenal != null && (typeof sd.arsenal !== "object" || Array.isArray(sd.arsenal))) bad.push("sides[" + s + "].arsenal is not one card");
    else if(sd.arsenal) put(sd.arsenal.uid, "sides[" + s + "].arsenal");
    for(const f of ["hp", "res", "ap"]) if(sd[f] != null && (typeof sd[f] !== "number" || sd[f] !== sd[f])) bad.push("sides[" + s + "]." + f + " is not a number");
  });
  (v.chainCards || []).forEach((e, i) => put(e && (e.card || e).uid, "chain[" + i + "]"));
  return bad;
}

/* ---- the referee -------------------------------------------------------- */
/* o: {state, reduce, legal, check?, catalog?, seats?: [0, 1]}
   `check` is invariants.errors (or any state -> [violation]): it runs on the
   FULL state, here, after every action, because no phone can run it. */
function createReferee(o){
  o = o || {};
  if(typeof o.reduce !== "function") throw new Error("referee: a reduce(state, action, seat) is required");
  const reduce = o.reduce, legal = o.legal || (() => null), check = o.check || null, catalog = o.catalog || null;
  const seats = o.seats || [0, 1];
  /* `seatView` and `redact` are SEAMS for the sabotage drills only
     (test/referee.test.js hands in a leaky one and asserts the drill fails). */
  const SV = o.seatView || seatView, RA = o.redact || redactAction;
  let state = o.state, seq = 0;
  const log = [];
  const sent = {};          /* seat -> the last view that seat was sent */
  /* A referee REBUILT from storage (`restore`) has forgotten `sent`. A server
     that rebuilds on every request would otherwise send every commit as the
     whole view (measured ~90 KB late in a game). It was sent the previous
     state's view — every action goes through here — so that IS the base. */
  let rebuilt = false;
  const violations = [];

  const audit = st => { if(!check) return; try { for(const v of check(st) || []) violations.push({seq, ...v}); } catch(_){} };
  audit(state);

  /* A SNAPSHOT for one seat: its whole view, and the base its next delta
     is computed against. */
  function snapshot(seat){
    const v = SV(state, seat);
    sent[seat] = v;
    return {seq, view: v, h: W.hash(v)};
  }

  /* An INTENT from `seat`. Refused: {error}. Accepted: {seq, commits:{seat: commit}}. */
  function intent(seat, action){
    if(state && state.over && !(action && action.t === "concede")) return {error: "the game is over"};
    const why = legal(state, action, seat);
    if(why) return {error: why};
    const r = reduce(state, action, seat);
    if(r.error) return {error: r.error};
    const prev = state;
    state = r.state;
    seq++;
    log.push({seq, seat, action: json(action)});
    audit(state);
    const commits = {};
    for(const s of seats){
      const v = SV(state, s);
      const base = sent[s] || (rebuilt ? SV(prev, s) : null);
      sent[s] = v;
      commits[s] = {seq, seat, action: RA(action, state, s),
                    d: base ? delta(base, v, catalog) : null, h: W.hash(v),
                    over: state.over ? json(state.over) : null};
      if(!base) commits[s].view = v;    /* no base yet: the commit carries the whole view */
    }
    return {seq, commits};
  }

  return {
    intent, snapshot,
    state: () => state,
    seq: () => seq,
    log: () => log.slice(),
    over: () => !!(state && state.over),
    violations: () => violations.slice(),
    /* For the host's own phone: the host plays from its own seat view too,
       so its screen shows exactly what the guest's would from that chair. */
    view: seat => SV(state, seat),
    /* Load a persisted referee (the host's phone was backgrounded). */
    restore(saved){ state = saved.state; seq = saved.seq; log.length = 0; log.push(...(saved.log || [])); for(const k of Object.keys(sent)) delete sent[k]; rebuilt = true; },
    persist: () => ({state, seq, log: log.slice()})
  };
}

/* ---- the guest's mirror ------------------------------------------------- */
/* Holds one seat's view and applies that seat's commits. Never reduces.
   Returns from `commit`: null, or a reason the mirror stopped trusting itself
   ("gap", "desync", "census") — the caller asks for a snapshot. */
function createMirror(o){
  o = o || {};
  const catalog = o.catalog || null, seat = o.seat != null ? o.seat : 1;
  let view = null, seq = -1, lastAction = null;
  return {
    load(snap){ view = snap.view; seq = snap.seq; return snap.h != null && W.hash(view) !== snap.h ? "desync" : null; },
    commit(c){
      if(c.seq <= seq) return null;                       /* duplicate: apply once */
      if(c.seq !== seq + 1) return "gap";
      let next;
      try { next = c.view ? c.view : applyDelta(view, c.d, catalog); }
      catch(e){ return "desync"; }
      if(W.hash(next) !== c.h) return "desync";
      const bad = viewCensus(next);
      view = next; seq = c.seq; lastAction = c.action;
      return bad.length ? "census: " + bad[0] : null;
    },
    view: () => view, seq: () => seq, seat: () => seat, lastAction: () => lastAction
  };
}

/* ---- verify this game ---------------------------------------------------
   Replays a whole game from its opening state (rebuilt by the caller from the
   revealed seed: build.buildMatch + judge.newMatch) through `reduce`, and
   checks it against what this seat saw: every recorded view fingerprint, and
   the result. {ok, at?, why?, over}. */
function replay(o){
  let g = o.start;
  const seat = o.seat, hashes = o.hashes || {};
  if(hashes[0] != null && W.hash(seatView(g, seat)) !== hashes[0]) return {ok: false, at: 0, why: "the opening does not match what this phone was dealt"};
  for(const e of o.log || []){
    const r = o.reduce(g, e.action, e.seat);
    if(r.error) return {ok: false, at: e.seq, why: "action " + e.seq + " is illegal on replay: " + r.error};
    g = r.state;
    if(hashes[e.seq] != null && W.hash(seatView(g, seat)) !== hashes[e.seq])
      return {ok: false, at: e.seq, why: "after action " + e.seq + " the replay differs from what this phone was shown"};
  }
  /* compared as canonical JSON: a result that came over Supabase Realtime has its keys re-sorted (observed live 2026-11-14) */
  const want = o.over != null ? SHA.canon(o.over) : null;
  if(want != null && SHA.canon(json(g.over)) !== want) return {ok: false, at: (o.log || []).length, why: "the replay ends with a different result"};
  return {ok: true, over: g.over || null, state: g};
}

/* VERIFY THIS GAME, from the host's reveal. o: {seedC, seedG, seedH, start:
   seed -> opening state (build.buildMatch + judge.newMatch on the lobby's
   spec), reduce, seat, log, hashes, over}. Checks the host's half opens its
   commitment, derives the seed both halves fix, and replays. */
function verifyGame(o){
  if(typeof o.seedH !== "string" || SHA.seedCommit(o.seedH) !== o.seedC)
    return {ok: false, at: null, why: "the host's revealed seed does not open the commitment it made before the game"};
  const seed = SHA.seedOf(o.seedH, o.seedG);
  let start;
  try { start = o.start(seed); } catch(e){ return {ok: false, at: null, why: "could not rebuild the opening: " + (e.message || e)}; }
  const r = replay({start, log: o.log, reduce: o.reduce, seat: o.seat, hashes: o.hashes, over: o.over});
  return {...r, seed};
}

return {verifyGame, seatView, seatFeed, publicStill, scrubUids, UID_KEY, redactAction, slotMap, delta, applyDelta, pack, unpack, same,
        viewCensus, createReferee, createMirror, replay, LOG_KEEP};
});
