/* ============================================================
   SPXCONDGA: A CARD'S OWN GATED GO AGAIN, WHEN THE GATE HOLDS NOW

   Hot on Their Heels (pinned): "If you control 2 or more Draconic chain links, this gets go
   again." Scar for a Scar (pinned): "If you have less {h} than an opposing hero, this gets go
   again." `judge.keepsActionPoint` never read a card's own gated go again, so Fai's Draconic
   chains and every lifeLt / drac2 card ranked as if the action point were spent (census: 13
   heroes print one). `judge.condGaNow` asks `effects.gatesMetNow`, the engine's own gate loop
   over DECIDABLE gates; an attack counts its own chain link (RULING (user, 2026-10-31)), so one
   Draconic link already on the chain plus a Draconic attack is two.
   Fixtures are a real Fai self-play state at her own action decision with the chain and life set.
   Sabotage checked: SPXCONDGA=none fails the policy test; condGaNow answering true always fails
   the refusal halves; false always fails the reader's true halves and the policy test; dropping
   the attack's own link (dracLinks without dracNow) fails the drac2 true half.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 48); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "condga-" + gi, gi % 2);
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
const clone = n => JSON.parse(JSON.stringify(n));
/* her own action decision, nothing open, an action point to spend */
const F = find("fai", (n, s) => n.turnPlayer === s && !n.prompt && !n.pending && !n.pend && !(n.stack || []).length
  && (n.sides[s].ap || 0) >= 1 && !(n.chain || []).length);
/* `n` with the named cards as the whole hand, plenty to pay with, the chain as given */
function fixture(names, chain, hp){
  const n = clone(F.n), sd = n.sides[F.seat];
  sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = [];
  for(const nm of names){ const c = take(sd, nm); assert.ok(c, "pool card " + nm); sd.hand.push(c); }
  if(sd.arsenal){ sd.deck.push(sd.arsenal); sd.arsenal = null; }
  sd.res = 8;
  n.chain = chain || [];
  if(hp){ sd.hp = hp[0]; n.sides[1 - F.seat].hp = hp[1]; }
  return n;
}
const link = (drac, by) => ({n: "Drill Link", kind: "atk", drac, by, dmg: 1, ga: true});

test("SPXCONDGA: drac2 counts a Draconic link on the chain plus the attack's own", () => {
  assert.ok(F, "found in self-play");
  const one = fixture(["Hot on Their Heels"], [link(true, F.seat)]);
  const hot = one.sides[F.seat].hand[0];
  assert.equal(J.condGaNow(one, F.seat, hot.uid, "hand"), true, "one Draconic link + its own = 2");
  assert.equal(J.keepsActionPoint(one, F.seat, hot.uid, "hand"), false, "the old reader cannot see it");
  /* refusal halves: a plain link, or none, is one short */
  const plain = fixture(["Hot on Their Heels"], [link(false, F.seat)]);
  assert.equal(J.condGaNow(plain, F.seat, plain.sides[F.seat].hand[0].uid, "hand"), false);
  const none = fixture(["Hot on Their Heels"], []);
  assert.equal(J.condGaNow(none, F.seat, none.sides[F.seat].hand[0].uid, "hand"), false);
});

test("SPXCONDGA: lifeLt reads the life totals as they are now", () => {
  assert.ok(F, "found in self-play");
  const low = fixture(["Scar for a Scar"], [], [10, 15]);
  assert.equal(J.condGaNow(low, F.seat, low.sides[F.seat].hand[0].uid, "hand"), true);
  const high = fixture(["Scar for a Scar"], [], [15, 10]);
  assert.equal(J.condGaNow(high, F.seat, high.sides[F.seat].hand[0].uid, "hand"), false);
  assert.equal(J.condGaNow(high, F.seat, "no-such-uid", "hand"), false);
});

test("SPXCONDGA: the attack that keeps the action point goes first", () => {
  assert.ok(F, "found in self-play");
  /* Scar for a Scar (go again now: she is behind) beside a BIGGER attack with no go again
     (Art of the Dragon: Fire, which the old ranking led with) */
  const n = fixture(["Scar for a Scar", "Art of the Dragon: Fire"], [], [10, 15]);
  const [scar, art] = n.sides[F.seat].hand;
  assert.ok(+art.power > +scar.power, "the other attack is the bigger one");
  assert.ok(J.condGaNow(n, F.seat, scar.uid, "hand"));
  assert.ok(!J.keepsActionPoint(n, F.seat, art.uid, "hand") && !J.condGaNow(n, F.seat, art.uid, "hand"));
  const e = SP.explain(n, F.seat);
  assert.equal(e.action && e.action.t, "play");
  assert.equal(e.action.uid, scar.uid, "the go-again attack leads: " + e.key);
});
