/* ============================================================
   OUT PACE: "THIS CAN'T BE DEFENDED BY EQUIPMENT" — ON BOTH BOARDS

   CR 1.0.2 (quoted at `parser.noEquipDefendWhy`): "They can't defend this
   with equipment" is a restriction, and a restriction takes precedence over
   7.3.2a's allowance to declare equipment. The trainer's dummy honoured it;
   the table did not (judge.legal's defend door let equipment block an Out
   Pace attack: 18 such blocks in Dash's 48 self-play games at 3 seeds).
   The fixture is a real self-play state: Dash's Out Pace on the chain, at the
   defender's defend step. Observables: `legal` refuses each piece of the
   defender's equipment with the restriction's reason, still accepts a hand
   card, and the same pieces are legal against a different attack (the
   refusal half: the gear itself was declarable).
   Sabotage checked: `noEquipDefendWhy` returning null fails the first test.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const PR = require("../engine/parser.js");
const J = SPL.J, SP = SPL.SP;

/* drive Dash games until his Out Pace sits at the defender's defend step, the defender
   wearing at least one piece with defence */
function find(){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "dash");
  for(let gi = 0; gi < 48; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "dash", seat ? "dash" : foe, "outpace-" + gi, gi % 2);
    for(let i = 0; i < 4000 && !n.over; i++){
      if(n.step === "defend" && n.pend && n.pend.card && n.pend.card.name === "Out Pace"
        && n.turnPlayer === seat && (n.sides[1 - seat].gear || []).some(x => x && x.def > 0)) return {n, def: 1 - seat};
      const w = J.waitingOn(n); if(w == null) break;
      const a = SP.act(n, w); if(!a) break;
      const o = J.reduce(n, a, w); if(o.error) break; n = o.state;
    }
  }
  return null;
}
const F = find();
const iron = (n, s) => (n.sides[s].gear || []).filter(x => x && x.def > 0 && !(n.sides[s].chainBlocked || []).includes(x.uid));

test("Out Pace: the table refuses an equipment defender, and still takes a card from hand", () => {
  assert.ok(F, "found in self-play");
  const {n, def} = F;
  const pieces = iron(n, def);
  assert.ok(pieces.length, "the defender wears iron");
  for(const p of pieces)
    assert.equal(J.legal(n, {t: "defend", uid: p.uid}, def), "Out Pace can't be defended by equipment", p.name);
  const card = (n.sides[def].hand || []).find(c => c && c.def > 0 && !PR.isDR(c));
  if(card) assert.equal(J.legal(n, {t: "defend", uid: card.uid}, def), null, "a hand card still defends");
  /* the policy's wall goes through `legal`: it never proposes the iron */
  const a = SP.act(n, def);
  assert.ok(!(a && a.t === "defend" && pieces.some(p => p.uid === a.uid)), "the AI does not declare equipment");
});

test("Out Pace: the same iron is declarable against an attack without the restriction", () => {
  assert.ok(F, "found in self-play");
  const {n, def} = F;
  const plain = JSON.parse(JSON.stringify(n));
  plain.pend.card = Object.assign({}, plain.pend.card, {name: "Drill Plain Swing", tx: "", text: "", functional_text: ""});
  assert.equal(PR.noEquipDefendWhy(plain.pend.card), null);
  for(const p of iron(plain, def)) assert.equal(J.legal(plain, {t: "defend", uid: p.uid}, def), null, p.name);
  assert.equal(PR.noEquipDefendWhy(null), null, "no attack, no restriction");
});
