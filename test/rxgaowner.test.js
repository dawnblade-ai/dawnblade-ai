/* ============================================================
   A PLAYED ATTACK REACTION'S GO AGAIN IS THE TARGET'S (v5.12)

   > "Target attack with stealth gets +3{p} and go again." — STAINS OF THE
   > REDBACK ×3, Arakni's
   > "Target sword attack gets go again." — RUN THROUGH ×3, Dorinthea's

   v3.74 fixed this for an attack-reaction ABILITY (`_attackRx`): the
   payload's go again belongs to the attack it targets, never to the
   ability. A PLAYED attack-reaction CARD fell through to `fx.ga` one line
   down, so the card itself "went again" — and since an attack reaction
   costs no action point, CR 5.3.5 turned that into a GAINED one. Arakni's
   AP went 1 -> 2 on the play and she made three attacks where the printed
   text allows two. Stronger than printed, `tier: full`, found by reading a
   self-play feed (QUEUE item 1).

   GO AGAIN IS AN ACTION POINT, AND THAT IS WHAT TO ASSERT ON (v3.58):
   the reacting seat's `ap` across the play, and the TARGET's `pend.ga`.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

/* `reactions.test.js`'s fixture: a real attack declared at the table, the
   reacting seat standing in the reaction window of its own attack. */
function reacting(rx, atk){
  const a = {...atk, uid: "atk1"};
  let g = {...H.state({hand: [a, {...rx, uid: "h0"}], res: 9, ap: 1}, {}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [],
           firstPlayer: 0, round: 1, over: null};
  g = J.reduce(g, {t: "play", uid: "atk1", from: "hand"}, 0).state;
  for(let i = 0; i < 8 && g.step !== "reaction"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break;
    g = o.state;
  }
  assert.equal(g.step, "reaction", "the drill has to stand in the reaction window");
  return g;
}

test("the census: which attack reactions carry a go again, and whose it is", {skip}, () => {
  /* The premise the fix rests on, driven over the pool: every attack
     reaction whose parse carries `fx.ga` carries it with a TARGET
     qualifier, and none prints a go again of its own. A record arriving
     that prints one is the day `printedKw` has to answer TRUE here. */
  const DB = H.db(), rows = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r || !(P.isAR(r) && !P.isAttack(r))) continue;
    const fx = P.fxParse(r);
    if(!fx.ga) continue;
    assert.ok(fx.gaQ, r.name + " carries a go again with no target qualifier — read it again");
    assert.equal(P.printedKw(r, "go again"), false, r.name + " prints a go again of its own");
    rows.add(r.name);
  }
  assert.deepEqual([...rows].sort(), ["Run Through", "Stains of the Redback"]);
});

test("Stains of the Redback: the attack goes again, the reacting seat gains NOTHING", {skip}, () => {
  const g = reacting(H.card("Stains of the Redback", 1), H.card("Mark the Prey", 1));
  assert.equal(g.pend.ga, false, "fixture: the stealth attack carries no go again of its own");
  const ap0 = g.sides[0].ap;
  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.ok(!out.error, out.error || "the play must be legal");
  const n = out.state;
  assert.equal(n.sides[0].ap, ap0, "playing the reaction banked an action point (CR 5.3.5 read off the target's grant)");
  assert.equal(n.pend.ga, true, "and the TARGET still goes again — the grant is untouched");
});

test("Run Through: the same, on a sword", {skip}, () => {
  /* Dorinthea's own swing is a weapon attack; a sword attack ACTION is the
     simplest fixture that the qualifier admits from hand. */
  const sword = {name: "Practice Sword Strike", uid: "x", pitch: 1, cost: 0, power: 4, def: 2,
                 tt: "Warrior Action - Sword Attack", ty: ["Warrior", "Action", "Sword", "Attack"],
                 tx: "", kw: [], gkw: []};
  const g = reacting(H.card("Run Through", 1), sword);
  const ap0 = g.sides[0].ap;
  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.ok(!out.error, out.error || "the play must be legal");
  assert.equal(out.state.sides[0].ap, ap0, "Run Through banked its controller an action point");
  assert.equal(out.state.pend.ga, true, "and the sword attack goes again");
});

test("a reaction that PRINTS its own go again keeps it (synthetic — no pool card does)", {skip}, () => {
  /* The census above pins that no pool attack reaction prints one, so a
     body answering FALSE for every played reaction passes both driven rows
     perfectly (v3.73). This one prints the keyword on its own line, which
     is what `printedKw` asks, and CR 5.3.5 makes it a GAINED point. */
  P.fxReset();
  const own = {name: "Synthetic Riposte Ga", uid: "x", pitch: 1, cost: 0, def: 2,
               tt: "Generic Attack Reaction", ty: ["Generic", "Attack Reaction"],
               tx: "Target attack gets +1{p}.\nGo again", kw: ["Go again"], gkw: []};
  const g = reacting(own, H.card("Mark the Prey", 1));
  const ap0 = g.sides[0].ap;
  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.ok(!out.error, out.error || "the play must be legal");
  assert.equal(out.state.sides[0].ap, ap0 + 1, "a printed go again on the reaction itself is an action point gained");
  assert.equal(out.state.pend.ga, false, "…and it is the REACTION's, so the attack it targets does not go again");
  P.fxReset();
});
