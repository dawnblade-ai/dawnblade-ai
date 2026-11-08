/* test/helpers/blind.js — BOTH PHONES BLIND, AS ONE CHECK (HIDDEN HANDS H3).

   `blind(v, me, full, isPh)`: on a phone's own view `v` of seat `me`, every
   face-up card of the OTHER seat's hand or deck must be shown by one of the
   view's legitimate grants, named here one by one; anything else is a LEAK.
     hand: defending (blockH) · picked to pitch (paySel) · being played
           (pending.card) · known in hand after a reveal (_kh)
     deck: the known bottom block (_kb) · the known top block (_kt) · the top
           card a private look at THIS deck showed THIS seat (Scout the
           Periphery, v6.08: revealed._to = me, revealed._from = foe, deck[0];
           view.js `slots`, "looked") · a card a both-seat reveal shows
   plus: the rng is withheld, and the phone holds no full state.
   Returns {ok, bad: [...], grants: [...]}.

   Self-contained (no closure, no require) on purpose: tools/twophone.js
   injects `blind.toString()` into each real page, so the drive and
   test/blind.test.js run the SAME function. */
function blind(v, me, full, isPh){
  const foe = 1 - me, sd = v.sides[foe], bad = [], grants = [];
  const hold = new Set([...(sd.blockH || []), ...(sd.paySel || [])].map(String));
  const r = v.revealed || null, rc = r ? [].concat(r.cards || [], r.card || [], r) : [];
  const shared = new Set(r && r._to == null ? rc.map(c => c && c.uid).filter(u => u != null).map(String) : []);
  sd.hand.forEach((c, i) => { if(!c || isPh(c)) return;
    const g = hold.has(String(c.uid)) ? "defend/pitch" : (v.pending && v.pending.card && String(v.pending.card.uid) === String(c.uid)) ? "being played" : c._kh ? "_kh" : null;
    (g ? grants : bad).push("hand[" + i + "] " + c.name + (g ? " [" + g + "]" : "")); });
  sd.deck.forEach((c, i) => { if(!c || isPh(c)) return;
    const g = c._kb ? "_kb" : c._kt ? "_kt"
      : (i === 0 && r && r._to === me && r._from === foe && String(r.uid) === String(c.uid)) ? "look"
      : shared.has(String(c.uid)) ? "both-seat reveal" : null;
    (g ? grants : bad).push("deck[" + i + "] " + c.name + (g ? " [" + g + "]" : "")); });
  if(!(v.rng && v.rng.hidden)) bad.push("the rng is not withheld");
  if(full) bad.push("the phone holds the full state");
  return {ok: !bad.length, bad, grants};
}
module.exports = {blind};
