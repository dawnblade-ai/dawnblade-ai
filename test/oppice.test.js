/* ============================================================
   SPXOPPICE (v6.68): IYSLANDER CASTS AN ARSENAL FROST SPIKE ON THEIR TURN

   Frost Spike (pinned): a 0-cost Ice instant, "Create a Frostbite token in an
   exposed head, chest, arms, or legs zone." Iyslander (pinned): "Whenever you
   play an Ice card during an opponent's turn, create a Frostbite token under
   their control." Cast on the opponent's turn it makes two Frostbites. The
   census (32 games): legal on the opponent's turn 41 times, cast 0. From the
   ARSENAL only — a hand Spike is a 3-pitch card for her own turn, and casting
   it from the hand measured worse (sparring.js). The fixture is a real
   self-play state on the opponent's turn with a Spike in hand: once with the
   Spike moved to the arsenal (cast), once left in the hand (not cast — the
   refusal half). The observable is the opponent's Frostbite count.
   Sabotage checked: SPXOPPICE=none fails the first test; the reader allowing
   hand cards fails the second.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

/* drive self-play until `hit(n, seat)` holds at a call of the hero's seat */
function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 32); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "oppice-" + gi, gi % 2);
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
const frost = sd => ["board", "gear"].reduce((t, z) =>
  t + (sd[z] || []).filter(c => c && (c.name || (c.card && c.card.name)) === "Frostbite").length, 0);

/* the opponent's turn, outside a defence, nothing of hers on the stack, a Spike in hand
   she could cast there and that would land */
const spikeWindow = (n, s) => n.turnPlayer !== s && !n.pend && !(n.stack || []).some(l => l && l.seat === s)
  && (n.sides[s].hand || []).some(c => c && c.name === "Frost Spike"
    && J.legal(n, {t: "play", uid: c.uid, from: "hand"}, s) == null && !J.landsNothing(n, s, c.uid, "hand"));
const F = find("iyslander", spikeWindow);

test("SPXOPPICE: a hand Frost Spike is kept on their turn (it pitches for hers)", () => {
  assert.ok(F, "found in self-play");
  const spike = F.n.sides[F.seat].hand.find(c => c && c.name === "Frost Spike");
  assert.notEqual(F.e.key, "oppIce");
  assert.ok(!(F.e.action.t === "play" && F.e.action.uid === spike.uid), "the call does not cast the hand Spike: " + F.e.key);
  assert.equal(J.oppTurnTriggerPlay(F.n, F.seat), null);
});

test("SPXOPPICE: an arsenal Frost Spike goes on their turn and gives them two Frostbites", () => {
  assert.ok(F, "found in self-play");
  const seat = F.seat;
  /* the same state with the Spike in the arsenal (the arsenal card, if any, back to hand) */
  let n = JSON.parse(JSON.stringify(F.n));
  const sd = n.sides[seat];
  const k = sd.hand.findIndex(c => c && c.name === "Frost Spike");
  const spike = sd.hand[k];
  sd.hand.splice(k, 1); if(sd.arsenal) sd.hand.push(sd.arsenal); sd.arsenal = spike;
  const e = SP.explain(n, seat);
  assert.equal(e.key, "oppIce");
  assert.deepEqual(e.action, {t: "play", uid: spike.uid, from: "arsenal"});
  assert.ok(J.oppTurnTrigger(n, seat, spike.uid, "arsenal"), "the reader names it");
  const before = frost(n.sides[1 - seat]);
  let o = J.reduce(n, e.action, seat); assert.equal(o.error, null); n = o.state;
  /* pass priority until the Spike has left the stack */
  for(let i = 0; i < 20 && (n.stack || []).some(l => l && l.seat === seat); i++){
    const p = J.reduce(n, {t: "pass"}, n.priority); if(p.error) break; n = p.state;
  }
  assert.ok(!(n.stack || []).some(l => l && l.seat === seat), "the Spike resolved");
  assert.equal(n.sides[seat].arsenal, null, "the arsenal is empty");
  assert.equal(frost(n.sides[1 - seat]), before + 2, "the hero's Frostbite, and the Spike's own");
});
