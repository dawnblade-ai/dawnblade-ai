/* ============================================================
   A PHANTASM POP DOES NOT SWALLOW THE DEFENDER'S TRIGGERS (v5.10)

   > "When this defends, clash with the attacking hero. The winner creates a
   > Might token." — CLASH OF MIGHT, Kayo's, 6{p}
   > "When this defends, you may reveal a card with crush from your hand. If
   > you do, create a Seismic Surge token." — CRASH AND BASH, Bravo's

   Phantasm ("when this is defended by a non-Illusionist attack action card
   with 6 or more {p}, destroy this") and every "when this defends" trigger
   fire on ONE event: the wall being declared. `afterDefenders` handled the
   pop and RETURNED, so the defender's own triggers never ran. Clash of
   Might, Clash of Agility, Clash of Vigor and Brothers in Arms are 6-power
   non-Illusionist attack action cards, so each one IS a popper and lost its
   own trigger every time it popped one.

   Found by measuring `simultaneous-trigger-order`: 12 pops in 630 ladder
   games, and three of them carried a defend trigger that never resolved
   (Crash and Bash, Clash of Might, Fyendal's Fighting Spirit). Weaker than
   printed, and invisible to the one-sided fairness sweep.

   THE DEFENDER'S TRIGGERS RESOLVE FIRST, while the attack is still on the
   chain. Whichever order the CR gives, the pop cannot touch them — it
   depends only on the wall, which no defend trigger changes — and with the
   attack still there, "clash with the ATTACKING hero" needs no ruling about
   a hero whose attack is already gone.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const gate = t => H.hasDb() ? t : {skip: true};
const real = (nm, p, uid) => ({...C.resolveEntry(H.db(), {name: nm, p, code: null, q: 1}), uid});
const top = (uid, power) => ({uid, name: "Top " + power, def: 2, power, pitch: 1, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

/* Drive the table to the defend step, declare the wall, and pass until the
   wall is final — the moment `afterDefenders` runs. Stops there (or at a
   live sheet), because what is asked is what that moment did. */
function defendWith(wall, o){
  o = o || {};
  const atk = real("Spears of Surreality", 1, "ph");
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk], deck: [top("d0", 0)]},
                  {name: "Them", hp: o.hp || 20, hand: [...wall, ...(o.keep || [])],
                   deck: [top("d1", 9)]},
                  {actor: 0, turnPlayer: 0, seed: "phd"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = J.reduce(g, {t: "play", uid: "ph", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++)
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; break; } }
  assert.equal(n.step, "defend", "the drill has to REACH the defend step or it proves nothing");
  for(const c of wall){
    const d = J.reduce(n, {t: "defend", uid: c.uid}, 1);
    assert.equal(d.error, null, "declaring " + c.name + " was refused: " + d.error);
    n = d.state;
  }
  for(let i = 0; i < 8 && n.step === "defend" && !n.prompt; i++)
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; break; } }
  return n;
}
const tokens = (sd, nm) => (sd.board || []).filter(b => b.card && b.card.name === nm).length;

test(gate("Clash of Might pops the phantasm attack AND still clashes"), () => {
  const cm = real("Clash of Might", 1, "w1");
  assert.equal(cm.power, 6, "fixture: Clash of Might prints the threshold, so it IS the popper");
  const n = defendWith([cm]);
  assert.equal(n.sides[1].hp, 20, "popped — no damage reaches the hero");
  assert.equal(n.sides[0].grave.filter(c => c.uid === "ph").length, 1, "and the attack is destroyed, once");
  /* THE TRIGGER THE POP USED TO SWALLOW. Their top card is 9 against 0,
     so the defender wins and the Might is theirs. */
  assert.equal(tokens(n.sides[1], "Might"), 1, "the clash never happened — no Might for the winner");
  assert.equal(tokens(n.sides[0], "Might"), 0);
  assert.deepEqual(INV.errors(n), [], "and the board is clean");
});

test(gate("the clash pays the WINNER, so the attacker can win it too (both halves)"), () => {
  /* A body that always minted for the defender passes the row above. */
  const cm = real("Clash of Might", 1, "w1");
  const n0 = defendWith([cm]);
  assert.equal(tokens(n0.sides[1], "Might"), 1);
  const atk = real("Spears of Surreality", 1, "ph");
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk], deck: [top("d0", 9)]},
                  {name: "Them", hand: [cm], deck: [top("d1", 0)]},
                  {actor: 0, turnPlayer: 0, seed: "phd2"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = J.reduce(g, {t: "play", uid: "ph", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++)
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; break; } }
  n = J.reduce(n, {t: "defend", uid: "w1"}, 1).state;
  for(let i = 0; i < 8 && n.step === "defend"; i++)
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; break; } }
  assert.equal(tokens(n.sides[0], "Might"), 1, "the attacker won the clash and makes the Might");
  assert.equal(n.sides[1].hp, 20, "and the attack is still popped");
});

test(gate("Crash and Bash's offer is made to the defender on a pop"), () => {
  /* Crash and Bash is a Block card — it cannot pop anything — so the popper
     is a second defender, and the trigger belongs to the card beside it. */
  const cb = real("Crash and Bash", 1, "w2");
  const popper = real("Clash of Vigor", 1, "w1");
  const crush = real("Boulder Drop", 1, "k1");
  const n = defendWith([popper, cb], {keep: [crush]});
  const asked = [n.prompt, ...(n.promptQ || [])].filter(Boolean)
    .find(p => p.src === "Crash and Bash");
  assert.ok(asked, "the pop swallowed Crash and Bash's \"you may reveal\"");
  assert.equal(asked.side, 1, "and it is the DEFENDER's to answer");
});

test(gate("a plain wall still pops, and nothing is offered that nobody printed"), () => {
  /* The control: a popper with no defend trigger of its own queues nothing
     — the move must not invent a trigger, only stop deleting one. */
  const six = {uid: "w1", name: "Six Power", def: 3, power: 6, pitch: 1,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []};
  const n = defendWith([six]);
  assert.equal(n.sides[1].hp, 20, "popped");
  assert.equal(tokens(n.sides[0], "Might") + tokens(n.sides[1], "Might"), 0);
  assert.ok(!n.prompt && !(n.promptQ || []).length, "no sheet for a wall that prints none");
});
