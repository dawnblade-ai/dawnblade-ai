/* ============================================================
   Dawnblade engine — announce.js  ·  TABLE TALK (TT0, v7.18)

   WHAT IS SAID ACROSS THE TABLE. docs/TABLE-TALK.md §4–§5.

   At a real table every play is spoken: "5.1.2 Announce: First, the player
   proposes the card to be played" (CR 5.1.1–5.1.2). "Pitching a blue —
   Snatch, attacking for four." "Block with one." "Take three." And the only
   thing anyone writes down is the life: TRP 5.8 allows "Recording the life
   total, changes to the life total, and the source of the change".

   This module turns ONE ACCEPTED ACTION — the action, its seat, and the
   states either side of it (`engine/local.js`'s `onStep`, or a table's
   commit) — into:

     say(step, viewer)   -> [line]   what is announced, in order
     marks(step)         -> [mark]   what goes on the pad: {seat, delta,
                                     total, source}

   A line is {k, seat, head, sub, card, cards, pitched, n, ga}:
     k        attack | play | ability | hero | block | noblock | arsenal |
              pitch | hit | blocked | life | turn | over
     seat     who is speaking (the actor), or whose life / turn it is
     head     the big words: a card's name, or the phrase ("NO BLOCK")
     sub      the small words: "attacking for 4", "instant", "a card, face down"
     card     the card to glimpse (always public to `viewer`), or null
     cards    for a block: every card declared in this action
     pitched  the cards this seat pitched in this action (public: CR 3.14.1)
     n        the number the line is about (power, damage, life)
     ga       the attack has go again
     again    an attack landing on the chain after its glimpse was shown when it
              was played (it waited on the stack): say the power, no new glimpse

   THREE RULES IT KEEPS:
   1. IT READS NAMES AND ENGINE NUMBERS, NEVER CARD TEXT (the golden rule).
      An attack's power is `pend.total`, the number the engine put on the
      chain; a type is `engine/types.js`'s structured reading.
   2. IT NEVER NAMES WHAT THE VIEWER MAY NOT KNOW. A card is named only if
      `view.hiddenUids(next, viewer)` does not hold it (TRP 5.1: no player
      may know Private information). A card set face down in their arsenal
      is "a card"; it is never inferred from anything else.
   3. IT IS SILENT RATHER THAN WRONG. Passes are not announced. A pad entry
      names its source only when the engine says which link or layer dealt
      it; otherwise it is a number alone, as on a real pad when you missed it.

   Pure: no DOM, no clock, no randomness. test/announce.test.js drives whole
   self-play games through it from both seats.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./types.js"), require("./view.js"));
  else root.DawnAnnounce = factory(root.DawnTypes, root.DawnView);
})(typeof self!=="undefined" ? self : this, function(T, V){

const nameOf = c => c ? String(c.name || c.n || "") : "";
/* "Blossom of Spring — ability" is the ability's own record; the pad and the headline say the card */
const plain = s => String(s || "").replace(/\s+[—-]\s+ability$/i, "");
const uidKey = c => c && c.uid != null ? String(c.uid) : null;
const sideOf = (g, i) => (g && g.sides && g.sides[i]) || {};

/* Every card a state holds, by uid: both seats' zones, the board's entries,
   the attack, the stack, the chain. Finds the card an action named. */
function cardAt(g, uid){
  if(uid == null || !g) return null;
  const k = String(uid);
  for(const sd of g.sides || []){
    for(const z of ["hand", "grave", "pitch", "banish", "soul", "gear", "intimidated", "deck"])
      for(const c of sd[z] || []) if(c && String(c.uid) === k) return c;
    if(sd.arsenal && String(sd.arsenal.uid) === k) return sd.arsenal;
    for(const b of sd.board || []) if(b && (String(b.uid) === k || (b.card && String(b.card.uid) === k))) return b.card || b;
  }
  if(g.pend && g.pend.card && String(g.pend.card.uid) === k) return g.pend.card;
  for(const l of g.stack || []) if(l && l.card && String(l.card.uid) === k) return l.card;
  for(const e of g.chainCards || []) { const c = e && (e.card || e); if(c && String(c.uid) === k) return c; }
  return null;
}

/* cards in `after` that were not in `before`, by uid */
const fresh = (before, after) => {
  const had = new Set((before || []).map(uidKey));
  return (after || []).filter(c => c && !had.has(uidKey(c)));
};

/* WHICH CARD THIS ACTION PUT INTO PLAY, if any. A play whose cost is not yet
   paid opens a `pending` and is announced when it settles (the card and its
   pitch together, as a player says it); a cancelled one is never announced. */
const SETTLES = new Set(["payConfirm", "boost", "addPay", "xval", "split", "fuse", "charge",
                         "discost", "soulcost", "boardcost", "usurp", "bancost", "abtarget"]);
function playedBy(prev, a, seat, next){
  const np = next.pending, pp = prev.pending;
  const still = c => np && np.card && c && String(np.card.uid) === String(c.uid);
  if(a.t === "play" || a.t === "activate"){
    const src = String(a.uid || "");
    let card = null, how = a.t;
    if(a.t === "activate" && src === "hpow") how = "hero";
    else if(a.t === "activate" && /^gp/.test(src)) card = cardAt(prev, src.slice(2));
    if(!card && how !== "hero") card = cardAt(prev, a.uid);
    if(how === "hero"){
      const top = (next.stack || [])[(next.stack || []).length - 1];
      card = top && top.seat === seat ? top.card : null;
    }
    if(card && still(card)) return null;          /* waiting on its cost */
    if(pp && np && pp === np) return null;
    return {card, how, from: a.from || null};
  }
  if(SETTLES.has(a.t) && pp && pp.card && !(np && np.card && String(np.card.uid) === String(pp.card.uid)))
    return {card: pp.card, how: pp.kind === "activate" ? "activate" : "play", from: pp.from || null};
  return null;
}

/* the line's small words for a card that is not an attack */
function kindWords(card, how){
  if(how === "hero") return "hero ability";
  if(how === "activate") return "activates";
  if(!card) return "";
  if(T.isDR(card)) return "defense reaction";
  if(T.isAR(card)) return "attack reaction";
  if(T.isInstant(card)) return "instant";
  return "";
}

/* A NEW ATTACK ON THE CHAIN in this action: a different card than the last
   one, or the same weapon swinging again (the old link had struck, the new one
   has not). Returns the attack (`pend`) or null. */
function newAttack(prev, next){
  const np = next.pend, pp = prev.pend;
  if(!np || !np.card) return null;
  if(!pp || !pp.card) return np;
  if(String(pp.card.uid) !== String(np.card.uid)) return np;
  return (pp._struck != null || pp.dealt != null) && np._struck == null && np.dealt == null ? np : null;
}
/* a weapon swings; armour and other equipment activate (Blossom of Spring is a chest piece, not an attack) */
const swings = c => T.isWeaponType(c);
const atkWords = p => (swings(p.card) ? "swinging for " : "attacking for ") + (p.total | 0);

/* WHAT IS SAID. `step` = {seat, action, prev, next} (local.js onStep). */
function say(step, viewer){
  const {seat, action: a, prev, next} = step || {};
  if(!prev || !next || !a || !next.sides || !prev.sides) return [];
  const hid = V.hiddenUids(next, viewer);
  const seen = c => !!c && c.uid != null && !hid.has(String(c.uid)) && !(V.isPh && V.isPh(c));
  const out = [];
  const pitched = [0, 1].map(i => fresh(sideOf(prev, i).pitch, sideOf(next, i).pitch).filter(seen));
  const atk = newAttack(prev, next);
  let atkSaid = false;

  const pl = playedBy(prev, a, seat, next);
  if(pl){
    const lands = atk && atk.by === seat && pl.card && String(atk.card.uid) === String(pl.card.uid);
    if(lands){
      out.push({k: "attack", seat, head: nameOf(atk.card), card: seen(atk.card) ? atk.card : null,
                sub: atkWords(atk), n: atk.total | 0, ga: !!atk.ga, pitched: pitched[seat]});
      atkSaid = true;
    } else if(pl.card && seen(pl.card)){
      /* AN ATTACK THAT WAITS ON THE STACK (a weapon's swing, a card with an extra cost while the other seat may
         answer): its glimpse now, with what was pitched; its power when it lands on the chain (`again` below) */
      const waits = (pl.how !== "hero") && (T.isAttack(pl.card) || (pl.how === "activate" && swings(pl.card)));
      out.push({k: waits ? "attack" : pl.how === "hero" ? "hero" : pl.how === "activate" ? "ability" : "play", seat,
                head: plain(nameOf(pl.card)), card: pl.card, pitched: pitched[seat],
                sub: waits ? (swings(pl.card) ? "swing" : "attack") : kindWords(pl.card, pl.how)});
    }
    if(out.length) pitched[seat] = [];
  }
  /* the attack landed in this action without being played in it: the power it lands with, said once more, quietly */
  if(atk && !atkSaid)
    out.push({k: "attack", seat: atk.by, head: nameOf(atk.card), card: seen(atk.card) ? atk.card : null, again: true,
              sub: atkWords(atk), n: atk.total | 0, ga: !!atk.ga, pitched: []});

  if(a.t === "defend"){
    const c = cardAt(next, a.uid);
    if(seen(c)) out.push({k: "block", seat, head: "BLOCKING", sub: nameOf(c), card: c, cards: [c], n: c.defense != null ? c.defense : null});
  }
  /* THE DEFENDER'S LAST PASS OF THE DEFEND STEP, WITH NOTHING DECLARED: "no block" */
  if(a.t === "pass" && prev.step === "defend" && next.step !== "defend" && seat !== prev.turnPlayer && prev.pend){
    const sd = sideOf(next, seat);
    if(!(sd.blockH || []).length && !(sd.blockG || []).length && !(prev.pend.target && prev.pend.target.kind && prev.pend.target.kind !== "hero"))
      out.push({k: "noblock", seat, head: "NO BLOCK", sub: "", card: null});
  }
  if(a.t === "arsenal" && a.uid != null){
    const c = sideOf(next, seat).arsenal;
    out.push({k: "arsenal", seat, head: "ARSENAL", sub: seen(c) ? nameOf(c) : "a card, face down", card: seen(c) ? c : null});
  }
  /* what a seat pitched with no play of its own to carry it (a "pay or" prompt, a cost settled later) */
  [0, 1].forEach(i => { if(pitched[i].length) out.push({k: "pitch", seat: i, head: "PITCH", sub: pitched[i].map(nameOf).join(", "), card: null, pitched: pitched[i]}); });

  /* A LINK RESOLVED: hit, or turned away */
  const pc = prev.chain || [], nc = next.chain || [];
  if(nc.length > pc.length){
    const L = nc[nc.length - 1];
    if(L && L.kind === "atk"){
      if((L.dmg | 0) > 0) out.push({k: "hit", seat: L.by, head: "HIT", sub: plain(L.n), n: L.dmg | 0, card: null});
      else out.push({k: "blocked", seat: 1 - (L.by | 0), head: L.out === "prevented" ? "PREVENTED" : "BLOCKED", sub: plain(L.n), n: 0, card: null});
    }
  }
  /* LIFE: said by whoever's life it is (the pad writes it, see marks) */
  for(const m of marks(step)) out.push({k: "life", seat: m.seat, head: (m.delta > 0 ? "+" : "") + m.delta, sub: m.source || "", n: m.delta, total: m.total, card: null});

  if((next.turn | 0) !== (prev.turn | 0) && next.turnPlayer != null)
    out.push({k: "turn", seat: next.turnPlayer, head: "TURN " + (next.turn | 0), sub: "", card: null, n: next.turn | 0});
  if(next.over && !prev.over)
    out.push({k: "over", seat: next.over.winner, head: "GAME", sub: next.over.how || "", card: null});
  return out;
}

/* WHAT GOES ON THE PAD (TRP 5.8): each change to a hero's life, the total it
   leaves, and the source when the engine says it — the link that dealt it, or
   the one layer that resolved in this action. Nothing else is ever written. */
function marks(step){
  const {action: a, prev, next, seat} = step || {};
  if(!prev || !next || !prev.sides || !next.sides) return [];
  const out = [];
  const pc = prev.chain || [], nc = next.chain || [];
  const link = nc.length > pc.length ? nc[nc.length - 1] : null;
  const nk = new Set((next.stack || []).map(l => l && l.card && String(l.card.uid)));
  const gone = (prev.stack || []).filter(l => l && l.card && !nk.has(String(l.card.uid)));
  for(const i of [0, 1]){
    const before = sideOf(prev, i).hp, after = sideOf(next, i).hp;
    if(before == null || after == null || before === after) continue;
    const delta = after - before;
    let source = null;
    if(delta < 0 && link && link.by !== i && (link.dmg | 0) === -delta) source = plain(link.n);
    else if(delta < 0 && next.pend && next.pend.by !== i && next.pend.dealt != null && !(prev.pend && prev.pend.dealt != null)
            && (next.pend.dealt | 0) === -delta) source = plain(next.pend.name || nameOf(next.pend.card));
    else if(gone.length === 1) source = plain(nameOf(gone[0].card));
    else if(delta > 0 && a && (a.t === "defend" || a.t === "play") && seat === i){
      const c = cardAt(next, a.uid); if(c) source = plain(nameOf(c));
    }
    out.push({seat: i, delta, total: after, source});
  }
  return out;
}

/* the words a voice says for a line (Web Speech, optional): the headline and its small words */
const spoken = l => !l ? "" : [l.head, l.sub].filter(Boolean).join(", ").replace(/\bHIT\b/, "hit").toLowerCase();

return {say, marks, spoken, cardAt, playedBy};
});
