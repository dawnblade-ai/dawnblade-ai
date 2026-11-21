/* GRAVY TAKES THE TIPPLE (v6.55, SPXCYCLE).
   Golden Tipple: "When this attacks, you may discard a yellow card. If you do, draw a card
   and create a Gold token." The sheet is an optional self-discard whose rider (`ops`, data
   `optCostSpec` carries) draws the card back, and the structural answer declined it every
   time: 49 times in 272 games, a Gold (fuel for Gravy's hero ability) turned down for a
   hand of the same size. `judge.cyclePick` names the card to give up: the lowest-power one
   the sheet admits. Measured on his own seat, gate on vs off, 12 seeds each chair:
   103 -> 135 of 384 (52 -> 70 first-named, 51 -> 65 second-named).

   Driven through real self-play at the table: the first such sheet is answered, the hand
   stays the same size and a Gold is on his board. Sabotage checked: `cyclePick` returning
   -1 fails the classifier row and the drive (declined, no Gold). */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

test("cyclePick: a self-discard that draws is taken, lowest power first; one that draws nothing is not", () => {
  const base = {tag: "pick", side: 0, zone: "hand", to: "grave", min: 0, max: 1, cost: 0,
    discard: {by: 0, self: true}, ops: [["draw", 1], ["token", "gold", 1, "self"]],
    cards: [{uid: "b", power: 5}, {uid: "a", power: 2}, {uid: "c", power: 2}]};
  const g = p => ({prompt: p, sides: [{}, {}]});
  assert.equal(J.cyclePick(g(base), 0), 1, "the 2-power card, uid breaking the tie");
  assert.equal(J.cyclePick(g(base), 1), -1, "only the seat the sheet is addressed to");
  assert.equal(J.cyclePick(g({...base, ops: [["token", "gold", 1, "self"]]}), 0), -1, "no draw, no cycle");
  assert.equal(J.cyclePick(g({...base, to: "banish"}), 0), -1, "a banish is not a discard");
  assert.equal(J.cyclePick(g({...base, discard: null}), 0), -1, "only a discard");
  assert.equal(J.cyclePick(g({...base, sel: [1]}), 0), -1, "already chosen: the confirm is the ordinary answer");
});

test("Gravy's Golden Tipple discards, draws, and makes a Gold", () => {
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "gravy");
  let found = null;
  for(let gi = 0; gi < 24 && !found; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "gravy", seat ? "gravy" : foe, "tipple-drill-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over && !found; i++){
      if(n.prompt && n.prompt.tag === "pick" && n.prompt.src === "Golden Tipple" && n.prompt.side === seat){ found = {n, seat}; break; }
      let moved = false;
      for(const s of [0, 1]){
        const a = SP.act(n, s); if(!a) continue;
        const o = J.reduce(n, a, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  assert.ok(found, "a Golden Tipple sheet was found in self-play");
  let {n, seat} = found;
  const golds = s => (s.board || []).filter(b => (b.card ? b.card.name : b.name) === "Gold").length;
  const hand0 = n.sides[seat].hand.length, gold0 = golds(n.sides[seat]), pool = n.prompt.cards.map(c => c.uid);
  let chosen = null;
  for(let i = 0; i < 4 && n.prompt && n.prompt.src === "Golden Tipple"; i++){
    const e = SP.explain(n, seat);
    assert.equal(e.key, e.action.t === "promptSel" ? "cyclePick" : "pickDone", "taken, not declined");
    if(e.action.t === "promptSel") chosen = n.prompt.cards[e.action.i].uid;
    const o = J.reduce(n, e.action, seat);
    assert.equal(o.error, null, "legal");
    n = o.state;
  }
  assert.ok(chosen != null && pool.includes(chosen), "a card from the sheet was chosen");
  const sd = n.sides[seat];
  assert.ok(sd.grave.some(c => c.uid === chosen), "the chosen card is in the graveyard");
  assert.equal(sd.hand.length, hand0, "drawn back: same hand size");
  assert.equal(golds(sd), gold0 + 1, "one more Gold on the board");
});
