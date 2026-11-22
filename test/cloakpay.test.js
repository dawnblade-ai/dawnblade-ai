/* ============================================================
   SPXCLOAK: A PIECE THAT PAYS ON THE OPPONENT'S TURN PAYS INSTEAD OF A CARD

   Spellfire Cloak (pinned): "Instant - Destroy this: Gain {r}. Activate this
   only during an opponent's turn." A card pitched on the opponent's turn is a
   card missing from your own (you draw only at the end of your own turn), so
   before an off-turn play whose payment the piece covers, the piece is spent
   and the card stays in hand. The census (1 seed, 32 games): 70 of Iyslander's
   130 off-turn pitches were one card for one last point with the Cloak legal;
   Cloak used 0 times. The fixture is a real self-play state where the call is
   `cloakPay`. Observables: the Cloak leaves the gear, the payment that follows
   pitches nothing, and the hand loses only the card played. Refusal halves:
   the same state with the pool already covering the cost, and with the piece
   given a point of defence (a piece that blocks is not spent this way).
   Sabotage checked: `cloakFirst` returning its input fails the first test.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 32); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "cloakpay-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s); if(!e || !e.action) continue;
        if(s === seat && hit(n, seat, e)) return {n, seat, e};
        const o = J.reduce(n, e.action, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
const cloakOf = sd => (sd.gear || []).find(c => c && c.name === "Spellfire Cloak");
const F = find("iyslander", (n, s, e) => e.key === "cloakPay");

test("SPXCLOAK: the Cloak pays an off-turn cost and the hand keeps its pitch card", () => {
  assert.ok(F, "found in self-play");
  const seat = F.seat;
  let n = F.n;
  const cloak = cloakOf(n.sides[seat]);
  assert.ok(cloak, "the Cloak is worn");
  assert.notEqual(n.turnPlayer, seat, "on the opponent's turn");
  assert.deepEqual(F.e.action, {t: "activate", uid: cloak.uid});
  const handBefore = n.sides[seat].hand.length;
  const pitchBefore = (n.sides[seat].pitch || []).length;
  let o = J.reduce(n, F.e.action, seat); assert.equal(o.error, null); n = o.state;
  assert.ok(!cloakOf(n.sides[seat]), "the Cloak is destroyed");
  /* play on until the seat has played a card: let both seats act by the policy */
  let played = null;
  for(let i = 0; i < 40 && !played; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s); if(!a) continue;
      if(s === seat && a.t === "play") played = a.uid;
      const r = J.reduce(n, a, s); if(r.error) continue; n = r.state; moved = true; break;
    }
    if(!moved) break;
  }
  for(let i = 0; i < 10 && n.pending && n.pending.seat === seat; i++){
    const a = SP.act(n, seat); const r = J.reduce(n, a, seat); if(r.error) break; n = r.state;
  }
  assert.ok(played != null, "a card was played after the Cloak");
  assert.equal((n.sides[seat].pitch || []).length, pitchBefore, "nothing was pitched");
  assert.equal(n.sides[seat].hand.length, handBefore - 1, "only the played card left the hand");
});

test("SPXCLOAK: not spent when the pool already pays, nor when the piece blocks", () => {
  assert.ok(F, "found in self-play");
  const seat = F.seat;
  const rich = JSON.parse(JSON.stringify(F.n)); rich.sides[seat].res = 9;
  assert.notEqual(SP.explain(rich, seat).key, "cloakPay", "the pool covers it");
  const wall = JSON.parse(JSON.stringify(F.n)); cloakOf(wall.sides[seat]).def = 1;
  assert.notEqual(SP.explain(wall, seat).key, "cloakPay", "a piece that blocks is kept");
});
