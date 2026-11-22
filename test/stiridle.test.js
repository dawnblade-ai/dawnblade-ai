/* ============================================================
   SPXSTIRIDLE: A PURE INSTANT-SPEED GRANT IS NOT CAST ON THEIR TURN WITH NOTHING TO TAKE IT

   Stir the Aetherwinds (pinned): "You may play your next Wizard non-attack action card this
   turn as though it were an instant. If it has an arcane damage effect, instead it deals that
   much arcane damage plus N." Its whole payload is that grant (`instantNext`). Iyslander's
   hero lets a blue non-attack go from her arsenal on the opponent's turn (SPXOPPARS), and the
   census (96 games) caught Stir cast there 16 times. Every cast pitched hand cards for its
   {r}{r}, and none was followed by a Wizard card. A follower on their turn could only come
   from the hand, which is next turn's card (v6.68's lesson), and the arsenal holds the grant
   itself. `judge.instantNextTakers` answers {hand, arsenal}: how many OTHER cards the
   qualifier admits. Shipped as an advice fix: 24 seeds, 287 -> 284 of 768 (noise).
   The fixture is a real self-play state on the opponent's turn: Stir moved to the arsenal
   (NOT cast), and the same state with a non-grant blue card there (cast, so the window is live
   and the skip is specific). Third test: the reader counts an arsenal taker.
   Sabotage checked: SPXSTIRIDLE=none fails the first test; the reader reporting an arsenal
   taker always fails the first and third; never, the third; null fails the file (the
   fixture asks the reader).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 48); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "stiridle-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s); if(!e || !e.action) continue;
        if(s === seat && hit(n, seat)) return {n, seat};
        const o = J.reduce(n, e.action, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
/* `n` with card `name` (from hand or deck) put in the arsenal; the old arsenal card goes to the deck */
function intoArsenal(n0, seat, name){
  const n = JSON.parse(JSON.stringify(n0)), sd = n.sides[seat];
  for(const z of ["hand", "deck"]){
    const k = (sd[z] || []).findIndex(c => c && c.name === name);
    if(k < 0) continue;
    const c = sd[z].splice(k, 1)[0];
    if(sd.arsenal) sd.deck.push(sd.arsenal);
    sd.arsenal = c;
    return {n, c};
  }
  return null;
}
const hasCard = (sd, name) => ["hand", "deck"].some(z => (sd[z] || []).some(c => c && c.name === name));
/* their turn, outside a defence, nothing of hers on the stack, a Stir she holds that the
   arsenal grant would let her cast (and pay for), and a Photon Splicing to compare */
const window_ = (n, s) => {
  if(n.turnPlayer === s || n.pend || (n.stack || []).some(l => l && l.seat === s) || n.prompt) return false;
  const sd = n.sides[s];
  if(!hasCard(sd, "Stir the Aetherwinds") || !hasCard(sd, "Photon Splicing")) return false;
  const a = intoArsenal(n, s, "Stir the Aetherwinds"), b = intoArsenal(n, s, "Photon Splicing");
  return a && b && J.grantedInstant(a.n, s) === a.c.uid && J.grantedInstant(b.n, s) === b.c.uid
    && J.instantNextTakers(a.n, s, a.c.uid, "arsenal").hand > 0;
};
const F = find("iyslander", window_);

test("SPXSTIRIDLE: an arsenal Stir with no arsenal taker is not cast on their turn", () => {
  assert.ok(F, "found in self-play");
  const {n, c} = intoArsenal(F.n, F.seat, "Stir the Aetherwinds");
  assert.deepEqual(J.instantNextTakers(n, F.seat, c.uid, "arsenal").arsenal, 0);
  assert.ok(J.instantNextTakers(n, F.seat, c.uid, "arsenal").hand > 0, "a hand card could follow it, and still it is kept");
  const e = SP.explain(n, F.seat);
  assert.notEqual(e.key, "oppArs");
  assert.ok(!(e.action && e.action.t === "play" && e.action.uid === c.uid), "the call does not cast Stir: " + e.key);
});

test("SPXSTIRIDLE: the same window casts a non-grant arsenal card (the skip is the grant's)", () => {
  assert.ok(F, "found in self-play");
  const {n, c} = intoArsenal(F.n, F.seat, "Photon Splicing");
  assert.equal(J.instantNextTakers(n, F.seat, c.uid, "arsenal"), null, "not a pure grant");
  /* v6.69: SPXCLOAK would spend Spellfire Cloak first to pay this very cast. This drill is about the
     grant skip, not the payment, so the Cloak is taken off this copy (test/cloakpay.test.js owns it). */
  const m = {...n, sides: n.sides.map((sd, i) => i !== F.seat ? sd
    : {...sd, gear: (sd.gear || []).filter(x => !(x && /Spellfire Cloak/.test(x.name || x.n || "")))})};
  const e = SP.explain(m, F.seat);
  assert.ok(e.key === "oppArs" || e.key === "oppArsAmp", "cast on their turn: " + e.key);
  if(e.key === "oppArs") assert.equal(e.action && e.action.uid, c.uid, "the cast is the arsenal card");
});

test("SPXSTIRIDLE: the reader counts a Wizard non-attack in the arsenal as a taker for a hand Stir", () => {
  assert.ok(F, "found in self-play");
  const {n} = intoArsenal(F.n, F.seat, "Photon Splicing");
  const sd = n.sides[F.seat];
  let k = sd.hand.findIndex(c => c && c.name === "Stir the Aetherwinds");
  if(k < 0){ const d = sd.deck.findIndex(c => c && c.name === "Stir the Aetherwinds"); sd.hand.push(sd.deck.splice(d, 1)[0]); k = sd.hand.length - 1; }
  const t = J.instantNextTakers(n, F.seat, sd.hand[k].uid, "hand");
  assert.equal(t.arsenal, 1);
  /* refusal half: an attack in the arsenal is no taker */
  const n2 = JSON.parse(JSON.stringify(n)), s2 = n2.sides[F.seat];
  s2.arsenal = Object.assign({}, s2.arsenal, {name: "Drill Wizard Attack Stir", type_text: "Wizard Action - Attack", ty: ["Wizard", "Action", "Attack"], power: 3});
  assert.equal(J.instantNextTakers(n2, F.seat, sd.hand[k].uid, "hand").arsenal, 0);
});
