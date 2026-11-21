/* WHAT THE NEVER-USED CENSUS FOUND (v6.56): gear and instants `legal` offered on hundreds
   of turns and the AI almost never used (`experiments/census/never.js` on findings/queue).
     SPXPIECE    a 0-defence resource piece pays for the play about to be paid (Garland of
                 Spring: legal 555 of Boltyn's turns, used 9)
     SPXGLISTEN  a card whose whole payout is +1{p} counters on weapons goes before the
                 unswung weapon's swing (Glisten: 17 of 79 own turns)
     SPXBOOTS    a non-attack go-again piece is spent so the ally does not end the turn
                 before the attack (Mage Master Boots: 766 / 5)
     SPXCROWN    a go-again draw paid by discarding a card that still plays from the
                 graveyard goes first (Carrion Crown: 72 / 1)
     SPXPOLARITY a life gain is played when its "instead" is true (Arcane Polarity's 4)

   Each policy branch is found in real self-play and its observable checked: zones, the
   pool, counters, action points. The readers are asked directly with their refusals.
   Sabotage checked: each gate set to "none" fails its own drive (the branch is never
   found); `weaponPumpOf` answering null, `gaNextPiece` false and `discardDrawPiece`
   false each fail their reader rows. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

/* the first state where `hero`'s seat would take the branch keyed `key` */
function find(hero, key, games){
  const foes = SPL.W.HEROES.map(h => h.k).filter(k => k !== hero);
  for(let gi = 0; gi < (games || 24); gi++){
    const seat = gi % 2, foe = foes[gi % foes.length];
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "gearpol-" + key + "-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s); if(!e || !e.action) continue;
        if(s === seat && e.key === key) return {n, seat, e};
        const o = J.reduce(n, e.action, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  return null;
}
const step = (n, a, s) => { const o = J.reduce(n, a, s); assert.equal(o.error, null, "legal: " + JSON.stringify(a)); return o.state; };
/* drive both seats until `done(n)` or `seat`'s turn ends */
function until(n, seat, done){
  const turn = n.turn;
  for(let i = 0; i < 400 && !n.over && n.turn === turn; i++){
    if(done(n)) return n;
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s); if(!a) continue;
      const o = J.reduce(n, a, s); if(o.error) continue;
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  return n;
}
const gearNamed = (sd, name) => (sd.gear || []).find(x => x && x.name === name);

test("SPXPIECE: Garland of Spring pays for Boltyn's play and the pool rises by its {r}", () => {
  const f = find("boltyn", "pieceRes");
  assert.ok(f, "found in self-play");
  const {n, seat, e} = f, sd = n.sides[seat];
  const piece = (sd.gear || []).find(x => x && x.uid === e.action.uid);
  assert.equal(piece.def || 0, 0, "a piece that blocks nothing");
  assert.equal(J.abPieceResGain(n, seat, piece.uid), 1);
  /* v6.57: the first find is now an activation made before the play (a layer that resolves when
     both seats pass), not one made inside the payment, so it is resolved before it is read */
  let m = step(n, e.action, seat);
  m = until(m, seat, x => !gearNamed(x.sides[seat], piece.name) && !(x.stack || []).length);
  assert.ok(!gearNamed(m.sides[seat], piece.name), "destroyed");
  assert.equal(m.sides[seat].res || 0, (sd.res || 0) + 1, "its {r} floats for the play");
});

test("SPXGLISTEN: Glisten goes before Raydn swings, and the swing carries the counters", () => {
  const f = find("boltyn", "weaponPump");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  const v = J.weaponPumpOf(n, seat, e.action.uid, e.action.from);
  assert.ok(v && v.n === 4 && v.weapon != null, "four counters, a weapon it reaches");
  assert.ok(!(n.sides[seat].weaponUsed || {})[v.weapon], "the weapon has not swung");
  n = step(n, e.action, seat);
  n = until(n, seat, m => (((m.sides[seat].counters || {})[v.weapon] || {}).pow || 0) > 0);
  assert.equal(((n.sides[seat].counters || {})[v.weapon] || {}).pow, 4, "four +1{p} counters on the weapon");
  n = until(n, seat, m => !!(m.sides[seat].weaponUsed || {})[v.weapon]);
  assert.ok((n.sides[seat].weaponUsed || {})[v.weapon], "and it swings this turn");
});

test("SPXBOOTS: Mage Master Boots buys the go again, the non-attack keeps the point", () => {
  const f = find("gravy", "gaNextPiece");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  assert.ok(J.gaNextPiece(n, seat, e.action.uid));
  n = step(n, e.action, seat);
  n = until(n, seat, m => !gearNamed(m.sides[seat], "Mage Master Boots"));
  assert.ok(!gearNamed(n.sides[seat], "Mage Master Boots"), "destroyed once its {r} is paid");
  n = until(n, seat, m => !m.prompt && !J.pendingOf(m) && !m.pend && !(m.stack || []).length
    && SP.explain(m, seat) && SP.explain(m, seat).key === "gaNextTaker");
  const t = SP.explain(n, seat);
  assert.equal(t.key, "gaNextTaker", "the card the grant waits for is next");
  const ap0 = n.sides[seat].ap;
  n = step(n, t.action, seat);
  n = until(n, seat, m => !m.prompt && !J.pendingOf(m) && !(m.stack || []).length);
  assert.ok(!(n.sides[seat].hand || []).some(c => c && c.uid === t.action.uid), "played");
  assert.equal(n.sides[seat].ap, ap0, "the action point is still there for the attack");
});

test("SPXCROWN: Carrion Crown discards an ally that still plays from the graveyard, for a card", () => {
  const f = find("gravy", "discardDraw");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  assert.ok(J.discardDrawPiece(n, seat, e.action.uid));
  const hand0 = n.sides[seat].hand.length, grave0 = (n.sides[seat].grave || []).length;
  n = step(n, e.action, seat);
  n = until(n, seat, m => !m.prompt && !J.pendingOf(m) && !(m.stack || []).length);
  const sd = n.sides[seat];
  assert.ok(!gearNamed(sd, "Carrion Crown"), "destroyed");
  assert.equal(sd.hand.length, hand0, "one discarded, one drawn");
  const gone = (sd.grave || []).slice(0, (sd.grave || []).length - grave0);
  assert.ok(gone.some(c => J.legal(n, {t: "play", uid: c.uid, from: "grave"}, seat) == null),
    "the discarded ally is playable from the graveyard");
});

test("lifeGainOf: Arcane Polarity is 1 until arcane damage was dealt to its holder this turn, then 4", () => {
  let n = SPL.match("viseraibw", "briar", "polarity-reader", 0);
  const sd = n.sides[0];
  const ap = [...sd.deck].find(c => c.name === "Arcane Polarity");
  assert.ok(ap, "in the deck");
  const put = hist => Object.assign({}, n, {sides: n.sides.map((s, i) => i ? s
    : Object.assign({}, s, {hand: [ap, ...s.hand], hist: Object.assign({}, s.hist, hist)}))});
  assert.deepEqual(J.lifeGainOf(put({arcTaken: 0}), 0, ap.uid, "hand"), {base: 1, now: 1, best: 4});
  assert.deepEqual(J.lifeGainOf(put({arcTaken: 1}), 0, ap.uid, "hand"), {base: 1, now: 4, best: 4});
  const swing = sd.hand.find(c => c && (+c.power || 0) > 0);
  if(swing) assert.equal(J.lifeGainOf(put({}), 0, swing.uid, "hand"), null, "an attack is not a life gain");
  assert.equal(J.lifeGainOf(put({arcTaken: 1}), 1, ap.uid, "hand"), null, "only the holder's hand");
});

test("the readers refuse what they do not describe", () => {
  const n = SPL.match("boltyn", "gravy", "gearpol-refuse", 0);
  for(const p of n.sides[0].gear){
    assert.equal(J.gaNextPiece(n, 0, p.uid), false, p.name + " is no go-again piece");
    assert.equal(J.discardDrawPiece(n, 0, p.uid), false, p.name + " is no discard-draw piece");
  }
  for(const c of n.sides[0].hand) if(c.name !== "Glisten")
    assert.equal(J.weaponPumpOf(n, 0, c.uid, "hand"), null, c.name + " pumps no weapon");
  const boots = gearNamed(n.sides[1], "Mage Master Boots");
  assert.ok(boots && J.gaNextPiece(n, 1, boots.uid), "Gravy's Boots are one");
});

/* SPXTOKENPIECE (v6.57): Runehold Release ("Destroy this: Create a Runechant token. Go again") was
   legal on 157 of Viserai BW's turns and used on 23 — the gear fallback sits after the attacks,
   and the attack had spent the point. Sabotage checked: SPXTOKENPIECE=none fails the drive (the
   branch is never found); `tokenPiece` answering false fails the reader row. */
test("SPXTOKENPIECE: Runehold Release goes first, makes its Runechant and keeps the action point", () => {
  const f = find("viseraibw", "tokenPiece");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  const sd = n.sides[seat], piece = (sd.gear || []).find(x => x && x.uid === e.action.uid);
  assert.equal(piece.name, "Runehold Release");
  assert.equal(piece.def || 0, 0, "it blocks nothing");
  const runes = s => (s.board || []).filter(b => b && b.card && b.card.name === "Runechant").length;
  const before = runes(sd), ap = sd.ap;
  assert.ok(ap >= 1, "an action point to spend on it");
  n = step(n, e.action, seat);
  n = until(n, seat, m => !gearNamed(m.sides[seat], "Runehold Release") && !(m.stack || []).length);
  assert.ok(!gearNamed(n.sides[seat], "Runehold Release"), "destroyed");
  assert.equal(runes(n.sides[seat]), before + 1, "a Runechant on the board");
  assert.equal(n.sides[seat].ap, ap, "go again: the point is still there for the attack");
});

test("SPXTOKENPIECE: Flat Trackers gives up its 1-point block for Boltyn's Agility token", () => {
  const f = find("boltyn", "tokenPiece");
  assert.ok(f, "found in self-play");
  const {seat, e} = f; let n = f.n;
  const piece = (n.sides[seat].gear || []).find(x => x && x.uid === e.action.uid);
  assert.equal(piece.name, "Flat Trackers");
  const agi = s => (s.board || []).filter(b => b && b.card && b.card.name === "Agility").length;
  const before = agi(n.sides[seat]), ap = n.sides[seat].ap;
  n = step(n, e.action, seat);
  n = until(n, seat, m => !gearNamed(m.sides[seat], "Flat Trackers") && !(m.stack || []).length);
  assert.equal(agi(n.sides[seat]), before + 1, "an Agility token on the board");
  assert.equal(n.sides[seat].ap, ap, "go again");
});

/* the first self-play state where `hero` (seat 0) holds priority in its own action phase,
   with an action point, an empty stack and the named piece still in its gear */
function ownMain(hero, foe, piece){
  let n = SPL.match(hero, foe, "tokenpiece-" + hero, 0);
  for(let i = 0; i < 3000 && !n.over; i++){
    if(n.turnPlayer === 0 && n.priority === 0 && n.phase === "action" && !(n.stack || []).length && !n.pend
       && !n.prompt && (n.sides[0].ap || 0) >= 1 && gearNamed(n.sides[0], piece)) return n;
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s); if(!a) continue;
      const o = J.reduce(n, a, s); if(o.error) continue;
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  return null;
}
test("tokenPiece: the reader admits the token piece and refuses the rest", () => {
  const n = ownMain("viseraibw", "boltyn", "Runehold Release"), m = ownMain("boltyn", "viseraibw", "Flat Trackers");
  assert.ok(n && m, "both states found");
  const g0 = (g, name) => gearNamed(g.sides[0], name);
  assert.equal(J.tokenPiece(n, 0, g0(n, "Runehold Release").uid, 0), true, "0 defence, a Runechant, go again");
  if(g0(n, "Blossom of Spring")) assert.equal(J.tokenPiece(n, 0, g0(n, "Blossom of Spring").uid, 0), false, "a resource, not a token");
  assert.equal(J.tokenPiece(m, 0, g0(m, "Flat Trackers").uid, 0), false, "a 1-defence piece is a block given up");
  assert.equal(J.tokenPiece(m, 0, g0(m, "Flat Trackers").uid, 1), true, "...unless the caller allows it");
  assert.equal(J.tokenPiece(n, 1, g0(n, "Runehold Release").uid, 0), false, "not the other seat's piece");
});
