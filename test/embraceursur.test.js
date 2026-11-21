/* VISERAI BW BANISHES FOR EMBRACE URSUR (v6.59, SPXRIDER).
   Embrace Ursur: "When this attacks, you may banish a card from your hand. If it's
   Runeblade, create a Runechant token. If it's Shadow, this gets go again." The structural
   answer declined all 15 sheets in a 32-game census, and the policy swung a Gloomblade
   ("You may play this from your banished zone") BEFORE Embrace Ursur, so the turn ended on
   it. `judge.riderPick` names a card that fires a rider and still plays from the banished
   zone; `judge.riderLead` puts the attack that asks for it first.

   Driven through real self-play at the table: the first sheet where a Gloomblade is in
   hand is answered with a banish, a Runechant is made and the attack goes again.
   Sabotage checked: `riderPick` returning -1 fails the classifier rows and the drive
   (declined, no Runechant); `riderLead` returning false fails its row. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

const SHADOW = {uid: "s", name: "Riderdrill Gloomblade", pitch: 1, cost: 1, power: 3, def: 3,
  tt: "Shadow Runeblade Action - Attack", ty: ["Shadow", "Runeblade", "Action", "Attack"],
  kw: ["Blood Debt"], gkw: [], tx: "You may play this from your banished zone.\nBlood Debt"};
const PLAIN = {uid: "r", name: "Riderdrill Malice", pitch: 3, cost: 0, power: 1, def: 3,
  tt: "Runeblade Action - Attack", ty: ["Runeblade", "Action", "Attack"], kw: [], gkw: [],
  tx: "When this attacks, deal 2 arcane damage to target hero."};
const RIDERS = [{cls: "runeblade", ops: [["rune", 1]]}, {cls: "shadow", ops: [["ga"]]}];

test("riderPick: banishes a card that still plays from banish and fires a rider; never one that is gone for good", () => {
  const base = {tag: "pick", side: 0, zone: "hand", to: "banish", min: 0, max: 1, cost: 0,
    optional: true, classRider: RIDERS, cards: [PLAIN, SHADOW]};
  const g = p => ({prompt: p, sides: [{}, {}]});
  assert.equal(J.riderPick(g(base), 0), 1, "the Gloomblade, not the plain Runeblade card");
  assert.equal(J.riderPick(g({...base, cards: [PLAIN]}), 0), -1, "a card that would be gone is declined");
  assert.equal(J.riderPick(g(base), 1), -1, "only the seat the sheet is addressed to");
  assert.equal(J.riderPick(g({...base, classRider: null}), 0), -1, "no riders, no reason");
  assert.equal(J.riderPick(g({...base, classRider: [{cls: "light", ops: [["ga"]]}]}), 0), -1, "a rider it does not fire");
  assert.equal(J.riderPick(g({...base, to: "grave"}), 0), -1, "only a banish");
  assert.equal(J.riderPick(g({...base, sel: [1]}), 0), -1, "already chosen: the confirm is the ordinary answer");
});

/* the first state where `pred` holds, Viserai BW in either chair */
function find(pred, tag){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "viseraibw");
  for(let gi = 0; gi < 32; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "viseraibw", seat ? "viseraibw" : foe, tag + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      if(pred(n, seat)) return {n, seat};
      let moved = false;
      for(const s of [0, 1]){
        const a = SP.act(n, s); if(!a) continue;
        const o = J.reduce(n, a, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
const isGloom = c => c && /Gloomblade/.test(c.name);
/* the branch that picks an ATTACK: a non-attack that keeps the point (Malefic Incantation)
   rightly goes before every attack, so the drill asks about the turn's attack choice */
const ATTACK_KEYS = ["riderFirst", "atkKeepsAP", "biggestAttack", "effPower", "chargeFirst", "gateFirst"];

test("riderLead: Embrace Ursur leads while a Gloomblade waits in hand", () => {
  const f = find((n, seat) => n.turnPlayer === seat && !n.prompt && !J.pendingOf(n)
    && (n.sides[seat].hand || []).some(c => c.name === "Embrace Ursur" && J.riderLead(n, seat, c.uid, "hand"))
    && ATTACK_KEYS.includes(SP.explain(n, seat).key), "ursur-lead-");
  assert.ok(f, "a turn holding Embrace Ursur and a payable Gloomblade was found");
  const e = SP.explain(f.n, f.seat), sd = f.n.sides[f.seat];
  const c = sd.hand.find(x => x.uid === e.action.uid);
  assert.ok(c && c.name === "Embrace Ursur", "Embrace Ursur is the play, not " + (c && c.name));
  assert.equal(e.key, "riderFirst");
  const eu = sd.hand.find(x => x.name === "Embrace Ursur");
  const bare = {...f.n, sides: f.n.sides.map((s, i) => i !== f.seat ? s : {...s, hand: s.hand.filter(x => !isGloom(x))})};
  assert.equal(J.riderLead(bare, f.seat, eu.uid, "hand"), false, "no Gloomblade in hand: no reason to lead");
});

test("Viserai BW banishes a Gloomblade for Embrace Ursur: a Runechant, and go again", () => {
  const f = find((n, seat) => n.prompt && n.prompt.tag === "pick" && n.prompt.src === "Embrace Ursur"
    && n.prompt.side === seat && n.prompt.cards.some(isGloom), "ursur-pick-");
  assert.ok(f, "an Embrace Ursur sheet with a Gloomblade in hand was found");
  let {n, seat} = f;
  const runes = s => (s.board || []).filter(b => (b.card ? b.card.name : b.name) === "Runechant").length;
  const r0 = runes(n.sides[seat]);
  let chosen = null;
  for(let i = 0; i < 4 && n.prompt && n.prompt.src === "Embrace Ursur"; i++){
    const e = SP.explain(n, seat);
    assert.equal(e.key, e.action.t === "promptSel" ? "riderPick" : "pickDone", "taken, not declined");
    if(e.action.t === "promptSel") chosen = n.prompt.cards[e.action.i];
    const o = J.reduce(n, e.action, seat);
    assert.equal(o.error, null, "legal");
    n = o.state;
  }
  assert.ok(isGloom(chosen), "a Gloomblade was banished");
  const sd = n.sides[seat];
  assert.ok(sd.banish.some(c => c.uid === chosen.uid), "it is in the banished zone");
  assert.equal(runes(sd), r0 + 1, "the Runeblade rider made a Runechant");
  assert.ok(J.linkGoesAgain(n), "the Shadow rider gave the attack go again");
});
