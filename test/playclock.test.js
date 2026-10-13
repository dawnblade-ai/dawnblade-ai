/* ============================================================
   A "WHEN YOU PLAY" TRIGGER RESOLVES BEFORE THE CARD'S OWN CONDITIONS
   ARE READ (v5.19)

   > "Once per turn, when you play an attack action card, remove a verse
   > counter from this. If you do, create a Runechant token."
   > — MALEFIC INCANTATION, Viserai's
   > "If you've played or created an aura this turn, this gets +2{p}." —
   > HIT THE HIGH NOTES · +3{p} SHRILL OF SKULLFORM · go again RUNERAGER SWARM

   QUEUE N3, CEO-verified and re-verified here. `execute` read the condition
   loop first and ticked Malefic's clock four hundred lines later, so the
   Runechant the play itself created was invisible to the card that played:
   "condition not met (no aura played or created this turn)", then "+1
   Runechant". The trigger resolves above the attack, so its token exists
   before the attack does anything; the clock now fires just above the loop,
   and still below the Runechant pop's firing-set capture (v2.23), so the new
   token does not pop on the swing that made it.

   ASSERT ON POWER, ACTION POINTS AND ZONES (v2.45, v3.58).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const mk = (n, p, u) => Object.assign({}, H.card(n, p), {uid: u});

/* Viserai's side, one attack in hand, Malefic on the board with its verse. */
function play(nm, o){
  o = o || {};
  const board = o.noMalefic ? [] : [{card: mk("Malefic Incantation", 1, "mi1"), kind: "aura", spent: false, uid: "mi1"}];
  let n = H.state({name: "Viserai", res: 9, ap: 9, hand: [mk(nm, 1, "h1")], deck: [{uid: "f1", name: "F1"}],
                   board, counters: o.noMalefic ? {} : {mi1: {verse: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(n, {t: "play", uid: "h1", from: "hand"}, 0);
  assert.equal(out.error, null, out.error);
  return H.drain(out.state);
}

test("CENSUS: the play clocks, and the cards that ask about an aura this turn", {skip}, () => {
  /* Pinned both ways: a second `atkPlay` clock, or a fourth card asking,
     is a deliberate edit — and the move is safe only while the one clock's
     only op mints a Runechant. */
  const DB = H.db(), clocks = {}, asks = {};
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r) continue;
    const fx = P.fxParse(r);
    if(fx.ctrTick && fx.ctrTick.on === "atkPlay") clocks[r.name] = JSON.stringify(fx.ctrTick.ops);
    for(const e of fx.conds || []) if(e.cond === "auraTurn") asks[r.name] = JSON.stringify(e.op);
  }
  assert.deepEqual(clocks, {"Malefic Incantation": '[["rune",1]]'});
  assert.deepEqual(asks, {"Hit the High Notes": '["self",2]', "Runerager Swarm": '["ga"]',
                          "Shrill of Skullform": '["self",3]'});
});

test("the Runechant Malefic makes on the play counts for the card that played", {skip}, () => {
  H.db();
  const hit = play("Hit the High Notes"), shrill = play("Shrill of Skullform"), swarm = play("Runerager Swarm");
  assert.equal(hit.pend.total, H.card("Hit the High Notes", 1).power + 2, "Hit the High Notes gets its +2");
  assert.equal(shrill.pend.total, H.card("Shrill of Skullform", 1).power + 3, "Shrill of Skullform gets its +3");
  assert.equal(swarm.pend.ga, true, "Runerager Swarm goes again");
  /* CONTROL: with no Malefic, no aura was played or created this turn */
  const none = play("Hit the High Notes", {noMalefic: true});
  assert.equal(none.pend.total, H.card("Hit the High Notes", 1).power);
  assert.equal(play("Runerager Swarm", {noMalefic: true}).pend.ga, false);
});

test("…and that Runechant does not pop on the swing that made it (v2.23)", {skip}, () => {
  /* The firing set is captured before the card acts, so the token the
     trigger creates waits for the NEXT attack. Moving the clock above that
     capture would pop it here, for one arcane, on its own swing. */
  H.db();
  const n = play("Hit the High Notes");
  assert.equal(P.runeCount(n.sides[0]), 1, "the Runechant is still on the board");
  assert.equal(n.sides[1].hp, H.state({}, {}, {}).sides[1].hp, "and dealt nothing yet");
  assert.equal(n.sides[0].counters.mi1.verse, 2, "the verse counter came off");
});

test("a weapon swing is not playing an attack action card — the clock does not move", {skip}, () => {
  /* The printed subject is a CARD PLAYED; the guard that says so moved with
     the clock, and a route that drops it ticks Malefic off every swing. */
  H.db();
  const sword = {uid: "w1", name: "Probe Sword", tt: "Generic Weapon - Sword (2H)", ty: ["Generic", "Weapon", "Sword"],
                 power: 3, cost: 0, pitch: 0, def: null, kw: [], tx: "Once per Turn Action - {r}: Attack"};
  let n = H.state({name: "Viserai", res: 9, ap: 9, gear: [sword], deck: [{uid: "f1", name: "F1"}],
                   board: [{card: mk("Malefic Incantation", 1, "mi1"), kind: "aura", spent: false, uid: "mi1"}],
                   counters: {mi1: {verse: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = H.execute({...n, phase: "action", step: "layer"}, sword, "weapon", 0, {});
  assert.equal(n.sides[0].counters.mi1.verse, 3);
  assert.equal(P.runeCount(n.sides[0]), 0);
});

test("…nor is a NON-attack played from hand — and here the card-type guard is the only thing that says so", {skip}, () => {
  /* The clock moved ABOVE the attack/non-attack split (v5.19), so the card
     half of the printed subject is now load-bearing: dropped, Viserai's
     non-attacks would each peel a verse counter. Synthetic, so the card
     does nothing else (v3.73). */
  H.db();
  const spell = {uid: "s1", name: "Probe Spell", tt: "Generic Action", ty: ["Generic", "Action"],
                 cost: 0, pitch: 1, def: 2, power: null, kw: [], tx: ""};
  let n = H.state({name: "Viserai", res: 9, ap: 9, hand: [spell], deck: [{uid: "f1", name: "F1"}],
                   board: [{card: mk("Malefic Incantation", 1, "mi1"), kind: "aura", spent: false, uid: "mi1"}],
                   counters: {mi1: {verse: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = H.execute({...n, phase: "action", step: "layer"}, spell, "hand", 0, {});
  assert.equal(n.sides[0].counters.mi1.verse, 3, "a non-attack ticked the attack clock");
  assert.equal(P.runeCount(n.sides[0]), 0);
});
