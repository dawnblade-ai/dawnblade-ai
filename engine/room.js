/* ============================================================
   Dawnblade engine — room.js (Phase B step 7, the transport)

   A TABLE NUMBER, AND TWO PHONES AT IT.

   `net.js` deliberately names no transport: it takes a `send` and exposes
   a `receive`, so the session logic can be drilled over an in-memory
   loopback. This module is the other half — the actual pipe — and it is
   the only file in the engine that knows a network exists.

   ---- WHY PEERJS AND NOT A WEBSOCKET ----------------------------------

   GitHub Pages serves static files. There is no origin server to
   terminate a WebSocket, so `ws://` is not a library choice, it is a
   backend to build, pay for and keep awake — Phase C's job.

   WebRTC needs a signalling rendezvous, but only to introduce the peers;
   once the DataChannel is up the traffic is phone-to-phone. PeerJS ships
   a **UMD build**, so it loads with a plain `<script src>` and no build
   step, and it runs a free public rendezvous. Trystero is the other
   obvious candidate and is ESM-only, which would mean `type="module"`
   and no `file://`.

   THE TABLE NUMBER FALLS OUT OF PEERJS'S MODEL RATHER THAN BEING BOLTED
   ON. A PeerJS peer may claim a chosen id; so the host claims the id
   derived from the table code and the guest dials it. "This table is
   taken" and "there is nobody at that table" are then real answers from
   the rendezvous rather than states we have to invent.

   ---- THE ID MUST BE NAMESPACED ---------------------------------------

   The public rendezvous is shared with every other PeerJS app in the
   world. An unqualified id of "42" would collide with a stranger's
   project, and the failure would look like a Dawnblade bug. So the id is
   `dawnblade-v1-<CODE>`, and the version segment means a future
   protocol change cannot connect to an old client at the same table.

   ---- THE CODE IS THE SEED --------------------------------------------

   rng.js: "Phase B wants both peers to derive the same seed from the same
   room code without exchanging it." The table code is therefore the match
   seed, which makes a game reproducible from the code alone.

   ---- LOADED LAZILY, ON PURPOSE ---------------------------------------

   The library is fetched when somebody asks for a table, not on page
   load. Three reasons: the solo trainer is the common case and should not
   pay for a CDN round trip; a `file://` page still runs everything except
   this one feature; and a rendezvous that is down degrades to a clear
   message on one screen instead of a broken app.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnRoom = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* Bumping this makes old clients unable to sit at a new client's table,
   which is what you want the moment the wire format or the action set
   changes. It is the same discipline as DATA_VER keying the card cache. */
const ROOM_V = "v1";
const NS = "dawnblade-" + ROOM_V + "-";

const LIB_URL = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";

/* No I, L, O, 0 or 1. A table code is read off one phone and typed into
   another, usually across a table in bad light, so the alphabet matters
   more than the entropy: 31^4 is 923,521 tables, which is plenty for
   friend play, and every character is unambiguous when spoken aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 4;

function makeCode(rnd){
  const r = rnd || (() => Math.random());
  let out = "";
  for(let i = 0; i < CODE_LEN; i++) out += ALPHABET[Math.floor(r() * ALPHABET.length) % ALPHABET.length];
  return out;
}

/* Forgiving about how it was typed, strict about what it is. Lowercase,
   spaces and dashes are all fine; anything outside the alphabet is
   dropped, and `isValid` then catches a code that was mistyped into
   something too short rather than silently dialling a different table. */
function normalize(code){
  return String(code == null ? "" : code).toUpperCase()
    .split("").filter(c => ALPHABET.indexOf(c) >= 0).join("").slice(0, CODE_LEN);
}
const isValid = code => normalize(code).length === CODE_LEN;
const peerIdFor = code => NS + normalize(code);

/* ---- loading the library --------------------------------------------
   Injected once and memoized, so opening a second table costs nothing.
   Rejects rather than hanging: a phone on a captive-portal wifi will
   otherwise sit on "connecting…" forever. */
let libPromise = null;
function loadLib(o){
  o = o || {};
  const url = o.url || LIB_URL;
  const doc = o.document || (typeof document !== "undefined" ? document : null);
  if(o.Peer) return Promise.resolve(o.Peer);
  if(typeof window !== "undefined" && window.Peer) return Promise.resolve(window.Peer);
  if(!doc) return Promise.reject(new Error("ROOM-NO-DOM: no document to load the transport into"));
  if(libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const el = doc.createElement("script");
    el.src = url; el.async = true;
    el.onload = () => window.Peer
      ? resolve(window.Peer)
      : reject(new Error("ROOM-LIB: the transport loaded but exposed no Peer"));
    /* The honest message. From file:// or with no network this is where
       we land, and "check your connection" beats a silent spinner. */
    el.onerror = () => { libPromise = null; reject(new Error("ROOM-LIB: could not load the transport — check the connection")); };
    doc.head.appendChild(el);
  });
  return libPromise;
}

/* ---- the table -------------------------------------------------------
   `open` resolves once there is a live channel to the other phone, which
   is the moment net.js can be handed its `send`. Everything before that
   is reported through `onStatus` so the screen can say what it is doing.

     open({code, host:true})     claim the table and wait
     open({code, host:false})    sit down at an existing one

   Returns {send, close, code, status}. `send` takes a plain object; the
   channel is configured RELIABLE and ORDERED because net.js treats a
   sequence gap as a dead channel rather than reassembling it. */
function open(o){
  o = o || {};
  const code = normalize(o.code);
  const host = !!o.host;
  const onStatus  = o.onStatus  || (() => {});
  const onClose   = o.onClose   || (() => {});

  if(!isValid(code)) return Promise.reject(new Error("ROOM-CODE: a table code is " + CODE_LEN + " characters"));

  let peer = null, conn = null, status = "loading", closed = false;
  const set = (s, detail) => { status = s; onStatus(s, detail); };

  /* THE SINK IS REPLACEABLE, AND IT BUFFERS UNTIL SOMEBODY LISTENS.
     The channel opens before the caller has a net.js session to feed —
     the session cannot exist until there is a `send` to build it with, so
     the ordering is unavoidable. Anything that arrives in that gap is
     held and flushed on `listen`, rather than being dropped into a
     handler that is not there yet. A dropped handshake would strand the
     guest on "connecting" with no error to show. */
  let sink = o.onMessage || null;
  let backlog = [];
  const deliver = m => { if(sink) sink(m); else backlog.push(m); };

  const attach = c => {
    conn = c;
    c.on("data", d => { try { deliver(typeof d === "string" ? JSON.parse(d) : d); } catch(_){ /* not ours */ } });
    c.on("close", () => { if(!closed){ set("closed", "the other phone left the table"); onClose(); } });
    c.on("error", e => set("error", String((e && e.message) || e)));
  };

  set("loading");
  return loadLib(o).then(Peer => new Promise((resolve, reject) => {
    set("connecting");
    /* The host claims the table's id; the guest takes whatever id the
       rendezvous hands out and dials the host's. */
    peer = host ? new Peer(peerIdFor(code), o.peerOpts || undefined)
                : new Peer(undefined, o.peerOpts || undefined);

    const handle = {
      code,
      /* Point the channel at a message handler. Anything that arrived
         before now is flushed in order, so the handshake cannot be lost
         in the gap between the channel opening and the session existing. */
      listen(fn){
        sink = fn || null;
        if(sink && backlog.length){ const q = backlog; backlog = []; q.forEach(m => sink(m)); }
      },
      send: m => { if(conn && conn.open) conn.send(m); },
      close(){
        closed = true;
        try { if(conn) conn.close(); } catch(_){}
        try { if(peer) peer.destroy(); } catch(_){}
        set("closed", "you left the table");
      },
      status: () => status,
      peer: () => peer
    };

    peer.on("error", e => {
      const t = (e && e.type) || "";
      /* Translate the rendezvous's vocabulary into the table's. These
         two are not errors in any real sense — they are the answers to
         "is this table free?" and "is anyone sitting here?" — and a
         player should see them as such. */
      const msg =
        t === "unavailable-id" ? "That table is already taken — try another code."
      : t === "peer-unavailable" ? "Nobody is sitting at table " + code + " yet."
      : t === "browser-incompatible" ? "This browser cannot open a table (no WebRTC)."
      : t === "network" || t === "server-error" ? "Cannot reach the matchmaking relay — check the connection."
      : String((e && e.message) || e);
      set("error", msg);
      reject(Object.assign(new Error(msg), {type: t, handle}));
    });

    peer.on("open", () => {
      if(host){
        set("waiting", code);
        peer.on("connection", c => {
          /* One opponent per table. A third phone dialling in is turned
             away rather than silently becoming a second guest whose
             actions the sequencer would interleave into the match. */
          if(conn && conn.open){ try { c.close(); } catch(_){} return; }
          attach(c);
          c.on("open", () => { set("connected"); resolve(handle); });
        });
      } else {
        set("dialling", code);
        /* RELIABLE AND ORDERED. PeerJS defaults are not, and an unordered
           channel would hand net.js a sequence gap on every reorder — it
           would read as a dead channel and resync in a loop. */
        const c = peer.connect(peerIdFor(code), {reliable: true, serialization: "json"});
        if(!c){ const m = "Could not open a channel to table " + code + "."; set("error", m); return reject(new Error(m)); }
        attach(c);
        c.on("open", () => { set("connected"); resolve(handle); });
      }
    });
  }));
}

/* Test seam: the drills inject a fake Peer, so the memoized real library
   must be forgettable between them. */
function _resetLib(){ libPromise = null; }

return {ROOM_V, NS, LIB_URL, ALPHABET, CODE_LEN,
        makeCode, normalize, isValid, peerIdFor, loadLib, open, _resetLib};
});
