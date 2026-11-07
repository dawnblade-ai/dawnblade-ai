/* ============================================================
   Dawnblade engine — view.js (HIDDEN HANDS H1, HIDDEN-HANDS.md §4.1)

   `view(state, seat)` is the game as ONE SEAT may know it, and
   `determinize(view, k)` deals that knowledge back out as one playable guess.
   ON THE PAGE because sparring.js calls it: Sharp's lookahead root IS
   `determinize(view(g, seat), k)` (sparring.js `laMask`), one body, so the
   search can never see more than the view does.

   CR 3.0.4a: "The arms, banished, chest, combat chain, graveyard, head, hero,
   legs, permanent, pitch, stack, and weapon zones are public zones."
   CR 3.0.4b: "The arsenal, deck, and hand zones are private zones."
   CR 3.0.4c: "A public zone may contain a private object, if the object is
   made private while in that zone, or if the object is moved into that zone
   as a private object." (intimidate's face-down banish, CR 8.5.10; a
   face-down equipment piece.)
   CR 3.0.4d covers the reverse, a PUBLIC object in a private zone: judge.js
   keeps a declared defender (`blockH`), a card picked to pitch (`paySel`) and
   the card being played (`pending`) in the hand after they went public, and
   the view shows them.

   WHAT IS HIDDEN, for seat S (opponent O):
     O.hand              placeholders, count kept (minus the public cards above)
     O.arsenal           a placeholder unless `_faceUp`
     O.intimidated       placeholders (S sees its own: RULING 2026-11-07)
     O face-down gear    placeholders
     O.soul              shown: the soul is public (RULING 2026-11-07)
     BOTH decks          order hidden, count kept. S's own deck is shown as its
                         COMPOSITION: real cards in canonical order, the range
                         flagged `_unordered` (a seat knows its decklist minus
                         every card it has seen, never the order). O's deck is
                         placeholders; O.unseen is the canonically sorted
                         multiset of every real card behind O's placeholders
                         (decklist minus public cards: public by format),
                         except face-down gear, whose multiset is
                         O.unseenGear (the loadout minus its face-up pieces):
                         equipment is never dealt into a hand or a deck.
     game.rng            a constant: the seed IS every future draw.
   KNOWN SLOTS stay face-up to both: the bottom block put there from the pitch
   zone at the end phase (`_kb`, judge.js endPhaseAfterArsenal). Not yet: a
   revealed top card that stayed there, a card a reveal showed in a hand, and
   Brain Freeze's hand-to-top (HIDDEN-HANDS.md §4.1).

   A placeholder has no text and a POSITIONAL uid (`?<owner><zone><i>`); in a
   carrier field it is `?<owner>x`. A real uid is the card's index in the PUBLIC
   decklist (build.js counts uids in list order), so a kept uid names the card.

   CARRIERS is the census of every game field outside the zones that holds a
   card object or a card's name, with its visibility rule.
   test/view.test.js fails when self-play finds a carrier not listed here.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./rng.js"));
  else root.DawnView = factory(root.DawnRNG);
})(typeof self!=="undefined" ? self : this, function(RNG){

/* THE THREE VISIBILITY QUESTIONS (HIDDEN-HANDS.md §7) — DECIDED. Each stays
   one named switch, so the view reads it in one place.
   RULING (user, 2026-11-07), asked and answered verbatim:
   SOUL_PUBLIC            "Is the soul public?" — "Yes". Both seats see the
                          cards in a hero's soul (charge, Boltyn).
   OWNER_SEES_INTIMIDATED "May an owner look at their own face-down
                          intimidated card?" — "Yes". The owner's view shows
                          its own intimidated cards; the opponent's does not.
   PITCH_ORDER_PUBLIC     "Is the order of pitched cards on the deck bottom
                          known to the opponent?" — "No". The known bottom
                          block is a set (canonical order) to the opponent;
                          its owner knows the order. */
const SWITCHES = {SOUL_PUBLIC: true, OWNER_SEES_INTIMIDATED: true, PITCH_ORDER_PUBLIC: false};

/* THE CARRIER CENSUS. Key: a game field, or `sides.<field>` for a per-side
   field outside the zones. Rule:
     public     what it holds is public (a played, paid-for, resolving or
                chained card). Its cards count as PUBLIC: one still sitting in
                the hand is shown there.
     addressed  a sheet addressed to `side`: its cards are public to that seat
                (the card showed them) and swept for the other.
     revealed   a reveal both seats saw, unless `_to` names the one seat that
                LOOKED (Compass of Sunken Depths): then the other seat sees null.
                Swept too: the table never clears it, and a stale one whose
                card has since been drawn must not tie that card to a slot.
     sweep      may copy a hidden card: every hidden card in it becomes a
                carrier placeholder.
     names      holds card NAMES only, of played or public cards (the feed-leak
                and name drills check it).
   Every rule but `names` is swept too, as defence. */
const CARRIERS = {
  pending: "public", pend: "public", chainCards: "public", featured: "public", stack: "public",
  _actTarget: "public",
  /* `builds` is swept (HIDDEN HANDS H2, found by the loopback drill): a
     build keeps construction inputs, and Fai's `startGrave` is a COPY of a
     dealt card that can come back to a hand (Phoenix Flame), naming it. Only
     judge.newMatch reads those inputs, so the sweep moves no rule. */
  builds: "sweep",
  prompt: "addressed",
  promptQ: "sweep", _discWay: "sweep", _costWay: "sweep", _tookWay: "sweep",
  revealed: "revealed",
  chain: "names", chainHist: "names",
  "sides.name": "names", "sides.hero": "names", "sides.hist": "names", "sides.wardNext": "names",
  "sides.hitNext": "names", "sides.buffQ": "names"
};
/* The zones the view itself rules on (not carriers). */
const ZONES = ["deck", "hand", "arsenal", "pitch", "grave", "banish", "soul", "board", "gear", "intimidated"];

const ZONE = {hand: "h", deck: "d", arsenal: "a", intimidated: "i", gear: "g", soul: "s"};
const blank = uid => ({uid, name: "(hidden)", hidden: true,
  q: 1, pitch: 0, cost: 0, power: 0, def: 0, ty: [], kw: [], gkw: [], tx: "", tt: ""});
const ph = (owner, zone, i) => blank("?" + owner + ZONE[zone] + i);
const phCarrier = owner => blank("?" + owner + "x");
const RNG_HIDDEN = {seed: 0, s: 0, n: 0, hidden: true};
const isPh = c => !!(c && c.hidden === true && /^\?/.test(String(c.uid)));

/* Canonical order: name, then pitch, then uid. Never where a card sat. */
const num = (c, k) => (c && c[k] != null) ? c[k] : 0;
const canon = (a, b) => String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1
  : num(a, "pitch") - num(b, "pitch") || (String(a.uid) < String(b.uid) ? -1 : String(a.uid) > String(b.uid) ? 1 : 0);

const uidsIn = (v, out, d) => { if(v == null || typeof v !== "object" || (d || 0) > 6) return out;
  if(Array.isArray(v)){ v.forEach(x => uidsIn(x, out, (d || 0) + 1)); return out; }
  if(v.uid != null) out.add(String(v.uid));
  /* a face-down piece being turned face-up as a cost (effects.js, Cloaked) */
  if(v._flipGear != null) out.add(String(v._flipGear));
  for(const k of Object.keys(v)) if(k !== "uid") uidsIn(v[k], out, (d || 0) + 1);
  return out; };

/* Cards that went public while sitting in a private zone (CR 3.0.4d). */
function publicUids(g, seat){
  const s = new Set();
  for(const k of Object.keys(CARRIERS)) if(CARRIERS[k] === "public") uidsIn(g[k], s);
  if(g.prompt && g.prompt.side === seat) uidsIn(g.prompt, s);
  for(const sd of g.sides) for(const u of [...(sd.blockH || []), ...(sd.paySel || [])]) s.add(String(u));
  return s;
}
/* The reveal standing for `seat`, or null. */
const revealFor = (g, seat) => {
  const r = g.revealed;
  return r && (r._to == null || r._to === seat) ? r : null;
};
/* The trailing block of cards put on the bottom from the pitch zone. */
const knownBottom = deck => { let k = 0; for(let i = deck.length - 1; i >= 0 && deck[i] && deck[i]._kb; i--) k++; return k; };

/* Per owner: which slots are hidden from `seat`. Deck slots are listed for
   both owners (nobody knows an order); `identity` is false for the seat's own
   deck (it knows the composition). */
function slots(g, seat){
  const pub = publicUids(g, seat);
  return g.sides.map((sd, owner) => {
    const deck = sd.deck || [], kb = knownBottom(deck);
    /* A KNOWN TOP is not modelled: the table never clears `revealed`, so a
       stale reveal cannot tell "still on top" from "drawn, shuffled back and
       on top by chance", and a private reorder (opt) moves it unseen. */
    const top = 0;
    const out = {deck: [], kb, top, hand: [], arsenal: [], intimidated: [], gear: [], soul: []};
    for(let i = top; i < deck.length - kb; i++) if(!(deck[i] && pub.has(String(deck[i].uid)))) out.deck.push(i);
    const foe = owner !== seat;
    if(foe){
      (sd.hand || []).forEach((c, i) => { if(c && !pub.has(String(c.uid))) out.hand.push(i); });
      if(sd.arsenal && !sd.arsenal._faceUp && !pub.has(String(sd.arsenal.uid))) out.arsenal.push(0);
      (sd.gear || []).forEach((c, i) => { if(c && c._faceDown && !pub.has(String(c.uid))) out.gear.push(i); });
      if(!SWITCHES.SOUL_PUBLIC) (sd.soul || []).forEach((c, i) => { if(c && !pub.has(String(c.uid))) out.soul.push(i); });
    }
    if(foe || !SWITCHES.OWNER_SEES_INTIMIDATED) (sd.intimidated || []).forEach((c, i) => { if(c && !pub.has(String(c.uid))) out.intimidated.push(i); });
    return out;
  });
}
const zoneArr = (sd, z) => z === "arsenal" ? [sd.arsenal] : (sd[z] || []);

/* uid -> {owner, zone, i, card} for every card whose identity `seat` may not
   tie to its slot. The seat's own deck is not listed: it knows the cards. */
function hiddenFrom(g, seat, sl){
  const out = new Map();
  (sl || slots(g, seat)).forEach((h, owner) => {
    const sd = g.sides[owner];
    for(const z of ["hand", "deck", "arsenal", "intimidated", "gear", "soul"]){
      if(z === "deck" && owner === seat) continue;
      const arr = zoneArr(sd, z);
      for(const i of h[z]) if(arr[i] && arr[i].uid != null) out.set(String(arr[i].uid), {owner, zone: z, i, card: arr[i]});
    }
  });
  return out;
}

/* Replace every hidden card inside `v` by a carrier placeholder. Returns `v`
   itself when nothing inside changed. */
function sweep(v, hid, d){
  if(v == null || typeof v !== "object" || (d || 0) > 8) return v;
  if(Array.isArray(v)){ let ch = false; const o = v.map(x => { const y = sweep(x, hid, (d || 0) + 1); if(y !== x) ch = true; return y; }); return ch ? o : v; }
  if(v.uid != null && hid.has(String(v.uid))) return phCarrier(hid.get(String(v.uid)).owner);
  let o = null;
  for(const k of Object.keys(v)){ const y = sweep(v[k], hid, (d || 0) + 1); if(y !== v[k]){ o = o || {...v}; o[k] = y; } }
  return o || v;
}

function view(g, seat){
  if(!g || !g.sides) return g;
  if(g.viewSeat === seat) return g;   /* a view of a view is the view */
  const sl = slots(g, seat), hid = hiddenFrom(g, seat, sl);
  const sides = g.sides.map((sd, owner) => {
    const h = sl[owner], o = {...sd}, deck = sd.deck || [], foe = owner !== seat;
    const unseen = [], unseenGear = [];
    const a = h.top, b = deck.length - h.kb;
    const mid = deck.slice(a, b);
    let block = deck.slice(b);
    if(foe && !SWITCHES.PITCH_ORDER_PUBLIC) block = block.slice().sort(canon);
    const dh = new Set(h.deck);
    o.deck = deck.slice(0, a).concat(foe ? mid.map((c, j) => dh.has(a + j) ? ph(owner, "deck", a + j) : c) : mid.slice().sort(canon), block);
    o._unordered = [a, b];
    if(foe) unseen.push(...mid.filter((c, j) => dh.has(a + j)));
    const mask = (z, hidIdx) => {
      if(!hidIdx.length) return;
      const set = new Set(hidIdx);
      o[z] = (sd[z] || []).map((c, i) => { if(!set.has(i)) return c; (z === "gear" ? unseenGear : unseen).push(c); return z === "gear" ? {...ph(owner, z, i), _faceDown: true} : ph(owner, z, i); });
    };
    mask("hand", h.hand); mask("intimidated", h.intimidated); mask("gear", h.gear); mask("soul", h.soul);
    if(h.arsenal.length){ unseen.push(sd.arsenal); o.arsenal = ph(owner, "arsenal", 0); }
    o.unseen = unseen.sort(canon);
    o.unseenGear = unseenGear.sort(canon);
    return o;
  });
  const out = {...g, sides, rng: RNG_HIDDEN, viewSeat: seat};
  for(const k of Object.keys(CARRIERS)){
    if(k.indexOf(".") >= 0 || g[k] == null) continue;
    const rule = CARRIERS[k];
    if(rule === "names") continue;
    if(rule === "revealed"){ out.revealed = sweep(revealFor(g, seat), hid); continue; }
    out[k] = sweep(g[k], hid);
  }
  return out;
}

/* The real uids `view(g, seat)` withheld, for leak scans and reveals. */
const hiddenUids = (g, seat) => hiddenFrom(g, seat);

/* REVEAL: put the real card back into a view at its placeholder's slot (the
   unit a commit would carry: {owner, zone, i, card}). */
function reveal(v, r){
  const sides = v.sides.slice(), sd = {...sides[r.owner]};
  if(r.zone === "arsenal") sd.arsenal = r.card;
  else { const arr = (sd[r.zone] || []).slice(); arr[r.i] = r.card; sd[r.zone] = arr; }
  for(const k of ["unseen", "unseenGear"]) if(sd[k]){ const j = sd[k].findIndex(c => c && String(c.uid) === String(r.card.uid));
    if(j >= 0) sd[k] = sd[k].slice(0, j).concat(sd[k].slice(j + 1)); }
  sides[r.owner] = sd;
  return {...v, sides};
}

/* ONE GUESS AT THE HIDDEN CARDS, as a playable state: Sharp's lookahead root
   (sparring.js `laMask`). The opponent's hand, face-down arsenal and deck are
   pooled with the cards behind its placeholders, sorted canonically, and
   dealt back from a stream seeded by public facts only; the seat's own deck
   is reshuffled the same way; the game gets its own rng. Any other placeholder
   (intimidated, a hidden soul) is dealt from what is left; face-down gear
   from `unseenGear`.
   With none of those, this is v5.37's `laMask` deal byte for byte. */
function determinize(v, k, salt){
  const seat = v.viewSeat, op = 1 - seat, sides = v.sides.slice();
  const me = sides[seat], o = sides[op];
  const pub = [v.turn, seat, k, salt != null ? salt : (v.feed || []).length, (o.hand || []).length, (o.deck || []).length,
               (me.deck || []).length, (me.hand || []).map(c => c.uid).join(".")].join("|");
  let r = RNG.make("la|" + pub);
  const strip = sd => { const x = {...sd}; delete x.unseen; delete x.unseenGear; delete x._unordered; return x; };
  /* the opponent */
  const hidArs = !!(o.arsenal && !o.arsenal._faceUp);
  const real = c => c && !isPh(c);
  const extra = [];
  for(const z of ["intimidated", "soul"]) (o[z] || []).forEach((c, i) => { if(isPh(c)) extra.push([z, i]); });
  const pool = (o.hand || []).concat(o.deck || [], hidArs ? [o.arsenal] : []).filter(real)
    .concat(o.unseen || []).sort(canon);
  let sh = RNG.shuffle(r, pool); r = sh.rng;
  const nh = (o.hand || []).length, nd = (o.deck || []).length, na = hidArs ? 1 : 0;
  const so = strip(o);
  so.hand = sh.arr.slice(0, nh);
  so.arsenal = hidArs ? sh.arr[nh] : o.arsenal;
  so.deck = sh.arr.slice(nh + na, nh + na + nd);
  dealExtra(so, o, extra, sh.arr.slice(nh + na + nd));
  /* face-down gear: from its own multiset, in order (one piece per slot in
     every pool loadout, so in practice there is one way) */
  const gearAt = [];
  (o.gear || []).forEach((c, i) => { if(isPh(c)) gearAt.push(["gear", i]); });
  dealExtra(so, o, gearAt, o.unseenGear || []);
  sides[op] = so;
  /* the seat itself */
  const mine = [];
  for(const z of ["intimidated"]) (me[z] || []).forEach((c, i) => { if(isPh(c)) mine.push([z, i]); });
  sh = RNG.shuffle(r, (me.deck || []).concat(me.unseen || []).slice().sort(canon)); r = sh.rng;
  const sm = strip(me), md = (me.deck || []).length;
  sm.deck = sh.arr.slice(0, md);
  dealExtra(sm, me, mine, sh.arr.slice(md));
  sides[seat] = sm;
  const out = {...v, sides, rng: RNG.make("la-game|" + pub), feed: [], log: []};
  delete out.viewSeat;
  return out;
}
function dealExtra(dst, src, at, cards){
  let j = 0;
  for(const [z, i] of at){
    const arr = (dst[z] === src[z] ? (src[z] || []).slice() : dst[z]);
    const c = cards[j++];
    arr[i] = c && z === "gear" ? {...c, _faceDown: true} : c;
    dst[z] = arr;
  }
}

return {view, hiddenUids, reveal, determinize, canon, isPh, SWITCHES, CARRIERS, ZONES, RNG_HIDDEN};
});
