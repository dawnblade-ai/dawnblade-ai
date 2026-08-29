/* ============================================================
   RETRIEVE — and the printed card is what settled it.

     Pick Up the Point  "When this attacks, you may retrieve a dagger
                         from your graveyard. (Pay {r} to equip it.)"
     Up Sticks and Run  "You may retrieve a dagger from your graveyard."

   THE DATABASE DEFINES NO KEYWORD. Upstream's own `keyword.json` lists
   Retrieve with an EMPTY description, and the recorded ruling (user,
   2026-07-25) gave the price without naming the destination. The SAR017
   printing answers it in parentheses: **"(Pay {r} to equip it.)"** — so
   retrieve is a graveyard pick costing {r} whose destination is the GEAR
   zone. Third time reading the printing has closed a booked question
   (Clash of Agility, Thunder Quake, this).

   IT NEEDED A DEEPER FIX FIRST. Until v3.53 a destroyed piece of gear was
   flagged `destroyed:true` and left in the gear zone forever — it never
   reached a graveyard, so the pool's only daggers could never be
   retrieved and the reader would have been a card that does nothing.
   RULING (user, 2026-08-29): destroyed gear goes to the graveyard, as the
   CR says of any destroyed permanent. Mark of the Huntsman destroys
   ITSELF to mark, which is the loop these cards are printed for.

   THESE ASSERT ON ZONES, RESOURCES AND FLAGS — never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const G = require("../engine/game.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

const DAGGER = () => Object.assign({}, H.card("Mark of the Huntsman", 0),
                                   {uid: "dag1", destroyed: true, curDef: 0});

/* ---- 1. THE SWEEP — destroyed gear reaches the graveyard ---------- */

test("a destroyed piece leaves the gear zone for the graveyard, turn-stamped", {skip}, () => {
  const g = H.state({gear: [DAGGER()], grave: []}, {}, {turn: 6});
  const out = E.sweepGear(g, 0);
  assert.equal(out.game.sides[0].gear.length, 0, "it leaves the gear zone");
  assert.deepEqual(out.game.sides[0].grave.map(c => c.uid), ["dag1"]);
  assert.equal(out.game.sides[0].grave[0]._gy, 6,
    "turn-stamped, or the '…this turn' family goes quietly wrong");
  assert.deepEqual(out.moved, ["dag1"]);
});

test("a LIVE piece is untouched — the sweep is not passing by finding nothing", {skip}, () => {
  const live = Object.assign({}, H.card("Mark of the Huntsman", 0), {uid: "dag2"});
  const g = H.state({gear: [live], grave: []}, {}, {turn: 6});
  const out = E.sweepGear(g, 0);
  assert.equal(out.game.sides[0].gear.length, 1, "equipped iron stays equipped");
  assert.equal(out.game.sides[0].grave.length, 0);
  assert.deepEqual(out.moved, []);
});

test("it is SEAT-RELATIVE — one seat's end phase does not file the other's iron", {skip}, () => {
  const g = H.state({gear: [DAGGER()]}, {gear: [Object.assign({}, DAGGER(), {uid: "dag9"})]},
                    {turn: 6});
  const out = E.sweepGear(g, 0);
  assert.equal(out.game.sides[0].gear.length, 0, "the swept seat is filed");
  assert.equal(out.game.sides[1].gear.length, 1, "the other seat's is not");
  /* AND THE SWEPT SEAT'S GRAVEYARD HOLDS ONLY ITS OWN IRON. Checking the
     other seat's GEAR cannot see a cross-seat leak: a body that collects
     destroyed pieces from both seats and files them into this one leaves
     seat 1's array untouched and still hands seat 0 a dagger it never
     owned. The sabotage pass found exactly that — assert the destination,
     not only the source. */
  assert.deepEqual(out.game.sides[0].grave.map(c => c.uid), ["dag1"],
    "only this seat's piece is filed here");
  assert.deepEqual(out.moved, ["dag1"]);
  assert.ok(!(out.game.sides[1].grave || []).length,
    "and the other seat's graveyard is untouched");
});

/* ---- 2. THE READING ---------------------------------------------- */

test("retrieve reads as a graveyard pick into GEAR, priced at {r}", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Up Sticks and Run", 1));
  const op = fx.ops.find(o => o[0] === "pickPrompt");
  assert.ok(op, "the keyword must produce a pick");
  assert.equal(op[1].zone, "grave");
  assert.equal(op[1].to, "gear", "it comes back EQUIPPED, not to hand — the printing says so");
  assert.equal(op[1].cost, 1, "(Pay {r} to equip it.)");
  assert.equal(op[1].min, 0, "'you may' — declining stays possible");
  assert.equal(op[1].equipStamp, true);
  assert.equal(fx.tier, "full");
  P.fxReset();
});

/* ---- 3. DRIVEN, END TO END --------------------------------------- */

function played(res){
  H.db();
  const src = Object.assign({}, H.card("Up Sticks and Run", 1), {uid: "src1"});
  /* A NON-DAGGER IN THE GRAVEYARD, or the filter is not under test: with
     the dagger as the only card there the candidate list is identical
     whether the filter applies or is dropped entirely. A fixture where
     two things coincide has tested neither (v3.26) — the arsenal drill in
     this same release was caught by exactly that. */
  const other = Object.assign({}, H.card("Booze!", 3), {uid: "gy2"});
  let g = H.state({name: "Arakni", res: res == null ? 3 : res, ap: 3,
                   hand: [src], gear: [DAGGER()], grave: [other],
                   deck: [{uid: "d1", name: "T"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "ret", turn: 4});
  g = E.sweepGear(g, 0).game;      /* the end phase files the shattered dagger */
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  return J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
}

test("the dagger comes back EQUIPPED and FRESH, and {r} is paid", {skip}, () => {
  let n = played();
  assert.ok(n.prompt, "the sheet must open — a printed choice never offered is a bug");
  assert.deepEqual(n.prompt.cards.map(c => c.uid), ["dag1"],
    "only the dagger is a legal choice — Booze! must not be offered");
  const before = n.sides[0].res;

  const i = n.prompt.cards.findIndex(c => c.uid === "dag1");
  n = J.reduce(n, {t: "promptSel", i}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;

  const me = n.sides[0];
  const back = (me.gear || []).find(c => c.uid === "dag1");
  assert.ok(back, "it is equipped again");
  assert.ok(!me.grave.some(c => c.uid === "dag1"), "and has left the graveyard");
  /* EQUIPPED FRESH. `destroyed` is what put it there and `curDef` is the
     battleworn wear from the life it already had; paying {r} for a shield
     that still blocks for zero is the card doing nothing. */
  assert.equal(back.destroyed, false, "the flag that filed it is cleared");
  assert.equal(back.curDef, null, "and its wear is cleared");
  assert.equal(G.gearDef(back), back.def || 0, "so gearDef reads its PRINTED defence");
  assert.equal(me.res, before - 1, "(Pay {r} to equip it.)");
});

test("declining pays nothing and moves nothing", {skip}, () => {
  let n = played();
  const before = n.sides[0].res;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  const me = n.sides[0];
  assert.ok(me.grave.some(c => c.uid === "dag1"), "the dagger stays in the graveyard");
  assert.ok(!(me.gear || []).some(c => c.uid === "dag1"), "and is not equipped");
  assert.equal(me.res, before,
    "no card moved, so no resource is spent — the v2.04 rule, applied to a " +
    "pick that carries its own cost");
});
