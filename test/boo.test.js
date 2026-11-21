/* LYATH BOOS WHILE HE IS THE WALL (v6.51, SPXBOO).
   His hero ability — "{r}{r}, {t}: The crowd boos you. Defending action cards you
   control get +1{d} this turn." plus "Whenever the crowd boos you, create a Might
   token." — was only ever offered on his OWN turn, as the policy's last resort, where
   nothing of his defends: the wall half was wasted on every one of 50 uses in 212
   turns. `judge.defActGainNow` says what the ability adds to the declared block (the
   amount times the action cards declared, 0 while this seat is not defending) and the
   reaction branch uses it while damage would still get through.
   Measured on his own seat, same engine, gate on vs off, 12 seeds each chair: 117 -> 140
   of 384 (both chairs moved: 54 -> 66, 63 -> 74).

   Driven through real self-play at the table: the first boo the policy calls `rxBoo` is
   checked against the reader, the leak it was meant to stop, and what resolving it does.
   Sabotage checked: `defActGainNow` returning 0 finds no boo; the boo resolving
   without `defActBuff` fails the wall row. Dropping the reader's `g.pend.by === seat`
   guard does NOT fail the own-turn row (on his own turn no card of his is declared,
   so the count alone answers 0): the guard is belt and braces, said here so nobody
   reads that row as proving it. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP, PR = require("../engine/parser.js");

function firstBoo(){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "lyath");
  let ownTurnZero = 0;
  for(let gi = 0; gi < 24; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "lyath", seat ? "lyath" : foe, "boo-drill-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        if(s === seat && n.actor === seat && J.defActGainNow(n, s, "hpow") === 0) ownTurnZero++;
        const e = SP.explain(n, s), a = e.action; if(!a) continue;
        if(s === seat && e.key === "rxBoo") return {n, seat, a, ownTurnZero};
        const o = J.reduce(n, a, s); if(o.error) continue;
        n = o.state; moved = true;
      }
      if(!moved) break;
    }
  }
  return null;
}

test("Lyath boos on the opponent's attack, for a block of action cards that still leaks", () => {
  const f = firstBoo();
  assert.ok(f, "a boo while defending was found in self-play");
  const {n, seat, a} = f;
  assert.ok(f.ownTurnZero > 0, "on his own turn the reader answered 0 (nothing of his defends)");
  assert.notEqual(n.pend.by, seat, "the attack is the opponent's");
  const sd = n.sides[seat];
  const actionBlockers = (sd.blockH || []).map(u => sd.hand.find(c => c.uid === u)).filter(c => c && PR.isActionCard(c)).length;
  assert.ok(actionBlockers > 0, "he declared action cards as defenders");
  assert.equal(J.defActGainNow(n, seat, "hpow"), actionBlockers, "+1{d} for each defending action card");
  assert.deepEqual({t: a.t, uid: a.uid}, {t: "activate", uid: "hpow"});
  /* resolve it: the side holds the grant, and a Might token is minted */
  let m = J.reduce(n, a, seat).state;
  for(let i = 0; i < 40 && !(m.sides[seat].defActionBuff > 0); i++){
    let moved = false;
    for(const s of [0, 1]){ const x = SP.act(m, s); if(!x) continue; const o = J.reduce(m, x, s); if(o.error) continue; m = o.state; moved = true; if(m.sides[seat].defActionBuff > 0) break; }
    if(!moved) break;
  }
  assert.equal(m.sides[seat].defActionBuff, 1, "defending action cards get +1{d} this turn");
  assert.ok((m.sides[seat].board || []).some(b => b && b.card && b.card.name === "Might"), "the boo minted a Might token");
});
