/* ============================================================
   SPXBOOSELF: A CARD'S OWN ON-ATTACK BOO, READ BEFORE THE ATTACK

   Mocking Blow (pinned): "When this attacks a hero, if you have more {h} than them, the crowd
   boos you. / If you've been booed this turn, this gets +N{p}." The boo is an on-attack rider,
   so the attack resolves booed and its own pump applies; `effects.effPowerNow` was asked before
   the attack and saw "booed" false, ranking the card at its printed 1 (19 of 166 plays in a
   census came ahead on life). With `{selfBoo: true}` (the policy passes it under SPXBOOSELF) the
   reader asks the card's own boo gate (`selfBooNow`: decidable and true now) and reads "booed"
   as the attack will. The observable is the ENGINE's own number: the attack's total on the
   chain after the play, compared with the prediction, ahead and behind on life.
   Sabotage checked: selfBooNow answering false always fails the first and third tests; true
   always fails the second; SPXBOOSELF=none (the policy no longer passes the option) fails the third.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 48); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "booself-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        if(s === seat && hit(n, seat)) return {n, seat};
        const x = SP.act(n, s); if(!x) continue;
        const o = J.reduce(n, x, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
const ZONES = ["deck", "hand", "grave", "pitch", "banish"];
function take(sd, name){
  for(const z of ZONES){
    const k = (sd[z] || []).findIndex(c => c && c.name === name);
    if(k >= 0) return sd[z].splice(k, 1)[0];
  }
  return null;
}
/* Lyath's own action decision, not yet booed this turn, nothing open */
const F = find("lyath", (n, s) => n.turnPlayer === s && !n.prompt && !n.pending && !n.pend && !(n.stack || []).length
  && (n.sides[s].ap || 0) >= 1 && !(n.chain || []).length && !((n.sides[s].hist || {}).booed));
function fixture(names, mine, theirs){
  const n = JSON.parse(JSON.stringify(F.n)), sd = n.sides[F.seat];
  sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = [];
  for(const nm of names){ const c = take(sd, nm); assert.ok(c, "pool card " + nm); sd.hand.push(c); }
  if(sd.arsenal){ sd.deck.push(sd.arsenal); sd.arsenal = null; }
  sd.res = 6; sd.hp = mine; n.sides[1 - F.seat].hp = theirs;
  return n;
}
/* play it and let the engine take it to its attack step: the total the link carries */
function attackTotal(n0, uid){
  let n = J.reduce(n0, {t: "play", uid, from: "hand", target: "hero"}, F.seat).state;
  for(let i = 0; i < 30 && !(n.pend && n.pend.card && n.pend.card.uid === uid && n.step !== "layer"); i++){
    const who = n.pending ? n.pending.seat : n.prompt ? (n.prompt.side || 0) : n.priority;
    const r = J.reduce(n, SP.act(n, who) || {t: "pass"}, who); if(r.error) break; n = r.state;
  }
  return n.pend && n.pend.card && n.pend.card.uid === uid ? n.pend.total : null;
}

test("SPXBOOSELF: ahead on life, the prediction is the power the attack actually carries", () => {
  assert.ok(F, "found in self-play");
  const n = fixture(["Mocking Blow"], 18, 10), c = n.sides[F.seat].hand[0];
  const pred = J.effPowerNow(n, F.seat, c.uid, "hand", {selfBoo: true});
  const real = attackTotal(n, c.uid);
  assert.ok(real > +c.power, "the engine boos on attack and pumps it: " + real);
  assert.equal(pred.power, real);
  assert.equal(J.effPowerNow(n, F.seat, c.uid, "hand").power, +c.power, "without the option, the old reading");
});

test("SPXBOOSELF: behind on life, no boo, and the prediction stays printed", () => {
  assert.ok(F, "found in self-play");
  const n = fixture(["Mocking Blow"], 10, 18), c = n.sides[F.seat].hand[0];
  const pred = J.effPowerNow(n, F.seat, c.uid, "hand", {selfBoo: true});
  assert.equal(attackTotal(n, c.uid), +c.power);
  assert.equal(pred.power, +c.power);
});

test("SPXBOOSELF: ahead on life, the policy ranks Mocking Blow on the power it will swing for", () => {
  assert.ok(F, "found in self-play");
  /* Full of Bravado (printed 3, the old ranking's lead) beside Mocking Blow (printed 1, 4 once it boos) */
  const n = fixture(["Mocking Blow", "Full of Bravado"], 18, 10);
  const [mb, fob] = n.sides[F.seat].hand;
  assert.ok(+fob.power > +mb.power, "the other attack is the bigger printed one");
  const e = SP.explain(n, F.seat);
  assert.equal(e.action && e.action.t, "play");
  assert.equal(e.action.uid, mb.uid, "Mocking Blow leads: " + e.key);
});
