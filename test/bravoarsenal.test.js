/* ============================================================
   SPXFLIPCRUSH + SPXARSPAY: BRAVO'S ARSENAL

   Bravo, Flattering Showman (pinned): "Action - {r}{r}, {t}: Turn a face-down card in your
   arsenal face-up. If it has crush, it gets +2{p} and dominate this turn. Go again".
   SPXFLIPCRUSH: the census (96 games) found 33 of 65 uses on a card WITHOUT crush ({r}{r} for
   nothing) and a crush card face-down at the start of 422 of 1171 turns. `judge.arsTurnPays`
   answers from the ability's parsed rider (`parser.arsGrantMet`, the body the engine grants
   with); the policy turns the card before it attacks, and never when the rider would not apply.
   SPXARSPAY: the arsenal step stored the biggest printed attack whatever its cost; Macho Grande
   (cost 7) sat in the arsenal at the start of 205 of 1171 turns and was played from there 2 of
   85 times. `judge.arsenalPayable` asks the policy's own maxPitch rule of next turn's hand.
   Fixtures are real Bravo self-play states with the arsenal or hand set to named pool cards.
   Sabotage checked: SPXFLIPCRUSH=none fails the first two tests (no flipFirst; the blind flip
   comes back); parser.arsGrantMet answering true always fails the second; SPXARSPAY=none fails
   the third; judge.arsenalPayable answering true always, or false always, fails the third and
   the fourth.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

function find(hero, hit, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 48); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "bravoars-" + gi, gi % 2);
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
/* a copy of `n` with the named card (any colour unless `pitch`) taken out of its zone */
function take(sd, name, pitch){
  for(const z of ZONES){
    const k = (sd[z] || []).findIndex(c => c && c.name === name && (pitch == null || +c.pitch === pitch));
    if(k >= 0) return sd[z].splice(k, 1)[0];
  }
  if(sd.arsenal && sd.arsenal.name === name){ const c = sd.arsenal; sd.arsenal = null; return c; }
  return null;
}
const clone = n => JSON.parse(JSON.stringify(n));
function withArsenal(n0, seat, name){
  const n = clone(n0), sd = n.sides[seat];
  const c = take(sd, name); assert.ok(c, "pool card " + name);
  if(sd.arsenal) sd.deck.push(sd.arsenal);
  sd.arsenal = Object.assign({}, c, {_faceUp: false});
  sd.res = 6;                     /* the {r}{r} and any attack's cost are covered */
  return n;
}

/* Bravo's own action decision, the hero ability legal, nothing open */
const F = find("bravo", (n, s) => n.turnPlayer === s && !n.prompt && !n.pending && !n.pend && !(n.stack || []).length
  && n.sides[s].arsenal && !n.sides[s].arsenal._faceUp && J.legal(n, {t: "activate", from: "hero", uid: "hpow"}, s) == null);

test("SPXFLIPCRUSH: a face-down crush attack is turned face-up before it attacks", () => {
  assert.ok(F, "found in self-play");
  const n = withArsenal(F.n, F.seat, "Chokeslam");
  assert.equal(J.arsTurnPays(n, F.seat, "hpow").pays, true);
  const e = SP.explain(n, F.seat);
  assert.equal(e.key, "flipFirst");
  assert.deepEqual(e.action, {t: "activate", from: "hero", uid: "hpow"});
  /* and the engine grants what the reader promised */
  const o = J.reduce(n, e.action, F.seat); assert.equal(o.error, null);
  let m = o.state;
  for(let i = 0; i < 20 && (m.pending || m.prompt || (m.stack || []).length); i++){
    const x = SP.act(m, m.pending ? m.pending.seat : m.prompt ? (m.prompt.side || 0) : m.priority);
    if(!x) break; const r = J.reduce(m, x, m.pending ? m.pending.seat : m.prompt ? (m.prompt.side || 0) : m.priority);
    if(r.error) break; m = r.state;
  }
  const a = m.sides[F.seat].arsenal;
  assert.ok(a && a._faceUp, "turned face-up");
  assert.equal(a._arsPow, 2);
});

test("SPXFLIPCRUSH: an arsenal card without crush is not turned at all", () => {
  assert.ok(F, "found in self-play");
  /* nothing else to do: no hand, {r}{r} floating (the flip's price; the hammer and Macho cost more),
     which is exactly where the old policy fell through to the blind flip */
  const n = withArsenal(F.n, F.seat, "Macho Grande"), sd = n.sides[F.seat];
  sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = []; sd.res = 2;
  assert.equal(J.legal(n, {t: "activate", from: "hero", uid: "hpow"}, F.seat), null, "the flip is legal");
  assert.equal(J.arsTurnPays(n, F.seat, "hpow").pays, false);
  const e = SP.explain(n, F.seat);
  assert.ok(!(e.action && e.action.t === "activate" && e.action.from === "hero"), "no blind flip: " + e.key);
  /* a crush card already face-up pays nothing either */
  const up = withArsenal(F.n, F.seat, "Chokeslam"); up.sides[F.seat].arsenal._faceUp = true;
  assert.equal(J.arsTurnPays(up, F.seat, "hpow").pays, false);
});

/* Bravo's arsenal step */
const A = find("bravo", (n, s) => n.arsenalFor === s && !n.sides[s].arsenal);
function withHand(n0, seat, names){
  const n = clone(n0), sd = n.sides[seat];
  sd.deck.push(...sd.hand.filter(Boolean)); sd.hand = [];
  for(const [nm, p] of names){ const c = take(sd, nm, p); assert.ok(c, "pool card " + nm); sd.hand.push(c); }
  return n;
}

test("SPXARSPAY: the arsenal step stores a card next turn can pay for, not the 7-cost Macho Grande", () => {
  assert.ok(A, "found in self-play");
  const n = withHand(A.n, A.seat, [["Macho Grande"], ["Cartilage Crush"]]);
  const macho = n.sides[A.seat].hand[0], cc = n.sides[A.seat].hand[1];
  assert.ok(+macho.power > +cc.power, "Macho is the bigger printed attack (the old pick)");
  const e = SP.explain(n, A.seat);
  assert.equal(e.action.t, "arsenal");
  assert.equal(e.action.uid, cc.uid);
});

test("SPXARSPAY: the reader asks next turn's hand (kept cards plus draws at the deck's mean pitch)", () => {
  assert.ok(A, "found in self-play");
  const n = withHand(A.n, A.seat, [["Macho Grande"], ["Disable", 3], ["Chokeslam", 3], ["Boulder Drop", 3]]);
  const [macho, dis] = n.sides[A.seat].hand;
  assert.equal(J.arsenalPayable(n, A.seat, macho.uid, 2), false, "7 > two pitches of 3");
  assert.equal(J.arsenalPayable(n, A.seat, dis.uid, 2), true, "5 <= two kept blue pitches");
  assert.equal(J.arsenalPayable(n, A.seat, "no-such-uid", 2), false);
});
