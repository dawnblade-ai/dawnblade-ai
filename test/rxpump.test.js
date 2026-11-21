/* THE ATTACKING REACTION WINDOW CASTS ONLY WHAT IS WORTH IT THERE (v6.57, SPXRXPUMP).
   `reaction()` in sparring.js filtered the defender's cards (`judge.defendsNow`, QUEUE v4 H8)
   but not the attacker's: on its own swing the seat cast the cheapest legal instant as a
   "pump", whatever it did — Oasis Respite and Cloud Cover prevented damage on a turn nobody
   was hitting it, Arcane Polarity gained 1 where it could gain 4, Enigma spent her transcend
   instants for their blue halves. `judge.pumpsNow` answers what is worth casting there: an
   attack reaction, a card that pumps the attack or rides on its hit, or a permanent the arena
   keeps.

   Reader rows ask it of real cards with their refusals. The policy is driven through real
   self-play: every state where the attacking seat is in its reaction step holding a LEGAL
   card the reader refuses is checked, and the seat must not cast that card there.
   Sabotage checked: SPXRXPUMP=none fails the policy row (the window casts a refused card);
   `pumpsNow` answering true for everything fails the reader rows; dropping the permanent
   clause fails the Suspense row. */
const test = require("node:test");
const assert = require("node:assert/strict");
const SPL = require("../tools/selfplay.js");
const J = SPL.J, SP = SPL.SP;

/* a match with the named card moved from the deck into `hero`'s hand (seat 0) */
function holding(hero, name){
  const n = SPL.match(hero, hero === "bravo" ? "briar" : "bravo", "rxpump-" + hero + "-" + name, 0);
  const sd = n.sides[0];
  const c = (sd.deck || []).find(x => x && x.name === name) || (sd.hand || []).find(x => x && x.name === name);
  assert.ok(c, name + " is in " + hero + "'s deck");
  const side = {...sd, deck: sd.deck.filter(x => x !== c), hand: [...sd.hand.filter(x => x !== c), c]};
  return {n: {...n, sides: [side, n.sides[1]]}, c};
}
const asks = (hero, name) => { const {n, c} = holding(hero, name); return J.pumpsNow(n, 0, c.uid, "hand"); };

test("pumpsNow: what pumps the swing, rides on its hit, or stays in the arena", () => {
  assert.equal(asks("briar", "Lightning Press"), true, "target attack action card gets +3");
  assert.equal(asks("prism", "Angelic Wrath"), true, "target Herald attack gets +2");
  assert.equal(asks("briar", "Burn Up // Shock"), true, "the next hit pays off");
  assert.equal(asks("dorinthea", "Agile Engagement"), true, "an attack reaction");
  assert.equal(asks("lyath", "The Suspense is Killing Me"), true, "an aura: the arena keeps it");
  assert.equal(asks("viseraibw", "Runechant of Sloth"), true, "an aura");
});

test("pumpsNow refuses what does nothing for this swing", () => {
  assert.equal(asks("dorinthea", "Oasis Respite"), false, "a prevention");
  assert.equal(asks("briar", "Cloud Cover"), false, "a prevention");
  assert.equal(asks("boltyn", "Toe the Line"), false, "a prevention");
  assert.equal(asks("fai", "Arcane Polarity"), false, "a life gain");
  assert.equal(asks("enigma", "Rising Sun, Setting Moon"), false, "a draw");
  assert.equal(asks("azalea", "Memorial Ground"), false, "a graveyard pick");
  /* a card the seat does not hold */
  const {n} = holding("briar", "Cloud Cover");
  assert.equal(J.pumpsNow(n, 0, "no-such-uid", "hand"), false);
});

test("SPXRXPUMP: on its own swing the seat never casts a card pumpsNow refuses", () => {
  const heroes = ["briar", "dorinthea", "fai", "enigma", "boltyn"];
  let exposed = 0, rx = 0;
  for(let gi = 0; gi < 20; gi++){
    const hero = heroes[gi % heroes.length], foe = SPL.W.HEROES[(gi * 3) % SPL.W.HEROES.length].k;
    if(foe === hero) continue;
    const seat = gi % 2;
    let n = SPL.match(seat ? foe : hero, seat ? hero : foe, "rxpump-" + gi, gi % 2);
    for(let i = 0; i < 3000 && !n.over; i++){
      let moved = false;
      for(const s of [0, 1]){
        const e = SP.explain(n, s); if(!e || !e.action) continue;
        if(s === seat && n.step === "reaction" && n.pend && n.pend.by === s && !(n.stack || []).length){
          const sd = n.sides[s];
          const held = (sd.hand || []).filter(Boolean).map(c => ({c, from: "hand"}))
            .concat(sd.arsenal ? [{c: sd.arsenal, from: "arsenal"}] : [])
            .filter(x => !J.pumpsNow(n, s, x.c.uid, x.from) && J.legal(n, {t: "play", uid: x.c.uid, from: x.from}, s) == null);
          if(held.length) exposed++;
          if(e.key === "rxAttack") rx++;
          if(e.key === "rxAttack")
            assert.ok(J.pumpsNow(n, s, e.action.uid, e.action.from), "the window cast a card the reader refuses (" + gi + ")");
          for(const x of held)
            assert.ok(!(e.action.t === "play" && e.action.uid === x.c.uid && e.key === "rxAttack"),
              x.c.name + " cast into its own reaction window (" + gi + ")");
        }
        const o = J.reduce(n, e.action, s); if(o.error) continue;
        n = o.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  assert.ok(exposed >= 5, "the window was reached holding a refused, legal card: " + exposed);
  assert.ok(rx >= 5, "the window still casts what pumps: " + rx);
});
