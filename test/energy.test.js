/* BLAZE SPENDS HIS ENERGY (v6.53, SPXENERGY).
   His hero ability — "Once per Turn Instant - Remove X energy counters from Blaze: Banish
   a Wizard non-attack action card from your hand with an effect that deals arcane damage
   equal to X. You may play it this turn as though it were an instant." — was activated
   by the policy and then the banish sheet, an OPTIONAL pick, was answered with the
   structural "decline what is optional": 93 activations in 32 games, no card ever
   banished, ~10 energy counters left at the end of every game. `judge.ctrPickTakers`
   names what the sheet admits; the policy takes the biggest arcane it can still pay for,
   activates only when there is one, and plays the banished card before the hand.
   Measured on his own seat, same engine, gate on vs off, 12 seeds each chair: 113 -> 136
   of 384 (both chairs moved: 52 -> 65, 61 -> 71).

   Driven through real self-play at the table: the first `energyBanish` the policy calls
   is followed through the pick, the counter spend and the instant-speed play.
   Sabotage checked: `ctrPickTakers` answering null finds no `energyBanish`; the pick
   branch removed leaves the card in hand and the energy unspent (the sheet declines). */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

const energy = sd => ((sd.counters || {}).hero || {}).energy || 0;

function firstBanish(){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "blaze");
  for(let gi = 0; gi < 24; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "blaze", seat ? "blaze" : foe, "energy-drill-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s), a = e.action; if(!a) continue;
        if(s === seat && e.key === "energyBanish") return {n, seat, a};
        const o = J.reduce(n, a, s); if(o.error) continue;
        n = o.state; moved = true;
      }
      if(!moved) break;
    }
  }
  return null;
}

test("Blaze banishes an arcane card he can pay for, spends its arcane in energy, and plays it at instant speed", () => {
  const f = firstBanish();
  assert.ok(f, "an energy banish was found in self-play");
  const {seat, a} = f;
  let n = f.n;
  assert.deepEqual({t: a.t, from: a.from, uid: a.uid}, {t: "activate", from: "hero", uid: "hpow"});
  const takers = J.ctrPickTakers(n, seat);
  assert.ok(takers && takers.length, "the reader names cards the pick admits");
  const held = energy(n.sides[seat]);
  assert.ok(takers.every(t => t.arc >= 1 && t.arc <= held), "every taker's arcane is paid out of the counters held");
  /* activate, then let the policy answer the sheet */
  n = J.reduce(n, a, seat).state;
  assert.ok(n.prompt && n.prompt.ctrSpend === "energy" && n.prompt.side === seat, "the banish sheet is up");
  let chosen = null;
  for(let i = 0; i < 6 && n.prompt; i++){
    const e = SP.explain(n, seat);
    assert.equal(e.key, "energyPick", "the sheet is answered by the energy pick, not declined");
    if(e.action.t === "promptSel") chosen = n.prompt.cards[e.action.i];
    n = J.reduce(n, e.action, seat).state;
  }
  assert.ok(chosen, "a card was chosen");
  const best = Math.max(...takers.map(t => t.arc));
  const sd = n.sides[seat];
  assert.ok(!(sd.hand || []).some(c => c.uid === chosen.uid), "the card left the hand");
  const ban = (sd.banish || []).find(c => c.uid === chosen.uid);
  assert.ok(ban, "it is in the banished zone");
  const arc = J.arcaneOf(n, seat, chosen.uid, "banish");
  assert.ok(arc >= 1 && arc <= best, "its arcane is read in the banished zone too");
  assert.equal(energy(sd), held - arc, "X energy counters were removed, X = the card's arcane");
  /* it is played this turn, from the banished zone, without spending an action point */
  const turn = n.turn;
  let played = false;
  for(let i = 0; i < 200 && !n.over && n.turn === turn && !played; i++){
    let moved = false;
    for(const s of [0, 1]){
      const x = SP.act(n, s); if(!x) continue;
      const ap = n.sides[seat].ap;
      const o = J.reduce(n, x, s); if(o.error) continue;
      if(s === seat && x.t === "play" && x.uid === chosen.uid){
        assert.equal(x.from, "banish");
        assert.equal(o.state.sides[seat].ap, ap, "played as an instant: no action point spent");
        played = true;
      }
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  assert.ok(played, "the banished card was played the same turn");
});
