/* ============================================================
   Dawnblade engine — view.js (HIDDEN HANDS spike, research/hidden-hands)

   `view(state, seat)` — the game as ONE SEAT may know it. HEADLESS: no page
   loads it yet (test/wire.test.js HEADLESS); that is the flag. HIDDEN-HANDS.md
   is the design this proves.

   CR 3.0.4b: "The arsenal, deck, and hand zones are private zones."
   CR 3.0.4c: "A public zone may contain a private object, if the object is
   made private while in that zone, or if the object is moved into that zone
   as a private object." (intimidate's face-down banish, CR 8.5.10; a
   face-down equipment piece.)

   WHAT IS REDACTED, for seat S (opponent O):
     O.hand              -> placeholders, count kept
     O.arsenal           -> a placeholder unless `_faceUp`
     O.intimidated, O face-down gear -> placeholders
     S.deck AND O.deck   -> placeholders, count kept (nobody knows an order)
     game.rng            -> a constant: the seed IS every future draw, so a
                            seat holding it holds both decks' order.
   S's own hand and arsenal are kept. Every public zone is kept as is.

   A placeholder is a card with no text, a positional uid (`?<seat><zone><i>`)
   and `hidden: true`. Positional on purpose: a real uid is the card's index in
   the PUBLIC decklist (build.js counts uids in list order), so a kept uid
   would name the card. `hiddenUids(state, seat)` lists the real uids the view
   withheld, for leak scans.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnView = factory();
})(typeof self!=="undefined" ? self : this, function(){

const ZONE = {hand: "h", deck: "d", arsenal: "a", intimidated: "i", gear: "g"};
const ph = (seat, zone, i) => ({uid: "?" + seat + ZONE[zone] + i, name: "(hidden)", hidden: true,
  q: 1, pitch: 0, cost: 0, power: 0, def: 0, ty: [], kw: [], gkw: [], tx: "", tt: ""});
const RNG_HIDDEN = {seed: 0, s: 0, n: 0, hidden: true};

/* Which cards of `side` (seated at `owner`) are hidden from `seat`. */
const scal = (v, out) => { if(Array.isArray(v)) v.forEach(x => scal(x, out));
  else if(v && typeof v === "object") Object.values(v).forEach(x => scal(x, out));
  else if(v != null) out.add(String(v)); return out; };
/* Hand cards already COMMITTED in public: the card being played and paid for
   (`pending` — a played card is announced onto the stack; judge.js keeps it in
   the hand until paid). */
const committed = g => scal(g.pending || null, new Set());
function hiddenOf(side, owner, seat, pub){
  const out = {deck: (side.deck || []).map((c, i) => i)};
  if(owner !== seat){
    /* CR 7.2/7.3: a declared defender is on the combat chain, public. judge.js
       keeps it IN THE HAND under `blockH` until damage; the view must not hide it.
       Same for a card selected to pitch (`paySel`): CR 3.0.4a, the pitch zone is
       public, and the selection crosses the wire one card at a time today. */
    const shown = new Set([...(side.blockH || []), ...(side.paySel || []), ...(pub || [])].map(String));
    out.hand = (side.hand || []).map((c, i) => (c && shown.has(String(c.uid)) ? -1 : i)).filter(i => i >= 0);
    out.arsenal = side.arsenal && !side.arsenal._faceUp ? [0] : [];
    out.intimidated = (side.intimidated || []).map((c, i) => i);
    out.gear = (side.gear || []).map((c, i) => (c && c._faceDown ? i : -1)).filter(i => i >= 0);
  }
  return out;
}

function view(g, seat){
  if(!g || !g.sides) return g;
  const pub = committed(g);
  const sides = g.sides.map((sd, owner) => {
    const h = hiddenOf(sd, owner, seat, pub), o = {...sd};
    o.deck = (sd.deck || []).map((c, i) => ph(owner, "deck", i));
    if(h.hand) o.hand = (sd.hand || []).map((c, i) => h.hand.indexOf(i) >= 0 ? ph(owner, "hand", i) : c);
    if(h.arsenal && h.arsenal.length) o.arsenal = ph(owner, "arsenal", 0);
    if(h.intimidated) o.intimidated = (sd.intimidated || []).map((c, i) => ph(owner, "intimidated", i));
    if(h.gear && h.gear.length) o.gear = (sd.gear || []).map((c, i) => h.gear.indexOf(i) >= 0 ? {...ph(owner, "gear", i), _faceDown: true} : c);
    return o;
  });
  return {...g, sides, rng: RNG_HIDDEN, viewSeat: seat};
}

function hiddenUids(g, seat){
  const out = new Map(), pub = committed(g);
  g.sides.forEach((sd, owner) => {
    const h = hiddenOf(sd, owner, seat, pub);
    for(const z of Object.keys(h)){
      const arr = z === "arsenal" ? [sd.arsenal] : (sd[z] || []);
      for(const i of h[z]) if(arr[i] && arr[i].uid != null) out.set(String(arr[i].uid), {owner, zone: z, i, card: arr[i]});
    }
  });
  return out;
}

/* REVEAL: put the real card back into a view at its placeholder's slot.
   The unit the wire would carry: {owner, zone, i, card}. */
function reveal(v, r){
  const sides = v.sides.slice(), sd = {...sides[r.owner]};
  if(r.zone === "arsenal") sd.arsenal = r.card;
  else { const arr = (sd[r.zone] || []).slice(); arr[r.i] = r.card; sd[r.zone] = arr; }
  sides[r.owner] = sd;
  return {...v, sides};
}

return {view, hiddenUids, reveal, RNG_HIDDEN};
});
