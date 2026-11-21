/* PRISM TAKES HER FIGMENT (v6.54, SPXPUT).
   "Whenever a card with Herald in its name is put into your soul during an action phase,
   you may search your deck for a figment, put it into the arena, then shuffle." The sheet
   is an optional pick from the deck into the arena, and `judge.freePick` (H12's classes:
   dead, rev, ars) had no class for it, so the AI declined it every time: 157 times in 272
   games, and her figments never left the deck. "put" is that class: free, nothing filtered,
   from the deck into the arena. Measured on her own seat, gate on vs off, 12 seeds each
   chair: 170 -> 307 of 384 (84 -> 154 first-named, 86 -> 153 second-named; up on every seed).

   Driven through real self-play at the table: the first such sheet is answered and the
   figment is on her board, out of her deck. Sabotage checked: the "put" class removed
   from `freePick` fails the classifier row and leaves the figment in the deck. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

test("freePick: a free search from the deck into the arena is a put; a priced one is not", () => {
  const base = {tag: "pick", zone: "deck", to: "arena", cost: 0, min: 0, cards: [{uid: "a"}]};
  assert.equal(J.freePick(base), "put");
  assert.equal(J.freePick({...base, cost: 1}), null);
  assert.equal(J.freePick({...base, filters: [{}]}), null);
  assert.equal(J.freePick({...base, zone: "grave"}), null, "only the deck");
});

test("Prism's Herald search puts a figment from her deck onto her board", () => {
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== "prism");
  let found = null;
  for(let gi = 0; gi < 16 && !found; gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : "prism", seat ? "prism" : foe, "put-drill-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over && !found; i++){
      if(n.prompt && n.prompt.tag === "pick" && n.prompt.to === "arena" && n.prompt.side === seat){ found = {n, seat}; break; }
      let moved = false;
      for(const s of [0, 1]){
        const a = SP.act(n, s); if(!a) continue;
        const o = J.reduce(n, a, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  assert.ok(found, "a figment search sheet was found in self-play");
  let {n, seat} = found;
  const deck0 = n.sides[seat].deck.length, board0 = (n.sides[seat].board || []).length;
  const pool = n.prompt.cards.map(c => c.uid);
  let chosen = null;
  for(let i = 0; i < 4 && n.prompt; i++){
    const e = SP.explain(n, seat);
    assert.equal(e.key, e.action.t === "promptSel" ? "pickFree" : "pickDone", "taken, not declined");
    if(e.action.t === "promptSel") chosen = n.prompt.cards[e.action.i].uid;
    n = J.reduce(n, e.action, seat).state;
  }
  assert.ok(chosen != null && pool.includes(chosen), "a figment from the sheet was chosen");
  const sd = n.sides[seat];
  assert.equal(sd.deck.length, deck0 - 1, "one card left the deck");
  assert.ok(!sd.deck.some(c => c.uid === chosen), "the chosen figment is not in the deck");
  assert.equal((sd.board || []).length, board0 + 1, "one more permanent in the arena");
  assert.ok((sd.board || []).some(b => (b.card ? b.card.uid : b.uid) === chosen || b.uid === chosen), "and it is the figment");
});
