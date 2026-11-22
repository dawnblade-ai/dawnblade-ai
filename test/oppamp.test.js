/* ============================================================
   SPXOPPAMP (v6.65): IYSLANDER AMPS HER OFF-TURN ARSENAL CAST

   Crucible of Aetherweave (pinned): "Once per Turn Instant - {r}: The next card
   you play this turn with an arcane damage effect, instead deals that much
   arcane damage plus 1." Iyslander casts her arsenal blue non-attack on the
   opponent's turn (v6.64, SPXOPPARS); the census had the Crucible legal on
   some 275 of those turns and used on 0. When the arsenal card is one the amp
   would reach (`judge.abAmpTakers`) and the seat can afford both, the Crucible
   goes first. Found in real self-play; the observable is the pool and the
   seat's `amp`, then the opponent's life. Sabotage checked: SPXOPPAMP=none
   fails the drive (the branch is never found).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, key, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 32); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "oppamp-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s); if(!e || !e.action) continue;
        if(s === seat && e.key === key) return {n, seat, e};
        const o = J.reduce(n, e.action, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
const step = (n, a, s) => { const o = J.reduce(n, a, s); assert.equal(o.error, null, "legal: " + JSON.stringify(a)); return o.state; };

test("SPXOPPAMP: the Crucible amps the arsenal card Iyslander is about to cast on their turn", () => {
  const f = find("iyslander", "oppArsAmp");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  const sd = n.sides[seat];
  assert.notEqual(n.turnPlayer, seat, "the opponent's turn");
  const piece = (sd.gear || []).find(x => x && x.uid === e.action.uid);
  assert.equal(piece.name, "Crucible of Aetherweave");
  const ars = sd.arsenal;
  assert.ok(ars && J.grantedInstant(n, seat) === ars.uid, "the arsenal card is castable now");
  const amp0 = sd.amp || 0;
  n = step(n, e.action, seat);
  /* the payment (an instant's ability resolves on the spot; the opponent's own play may still wait
     on the stack): drive both seats until the amp has landed and nothing is owed */
  for(let i = 0; i < 60 && !((n.sides[seat].amp || 0) > amp0 && !J.pendingOf(n)); i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s); if(!a) continue;
      const o = J.reduce(n, a, s); if(o.error) continue;
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  assert.equal(n.sides[seat].amp || 0, amp0 + 1, "the amp waits for the next arcane card");
  /* and the next call is the cast it was spent for */
  /* the other seat may hold priority first (it passes) */
  let e2 = SP.explain(n, seat);
  for(let i = 0; i < 6 && !(e2 && e2.action); i++){
    const a = SP.act(n, 1 - seat); if(!a) break;
    n = step(n, a, 1 - seat); e2 = SP.explain(n, seat);
  }
  assert.ok(e2 && e2.action, "a call after the amp");
  assert.equal(e2.key, "oppArs", "the arsenal cast follows");
  assert.equal(e2.action.uid, ars.uid);
  n = step(n, e2.action, seat);
  assert.equal(n.sides[seat].amp || 0, amp0, "the cast takes the amp");
});
