/* ============================================================
   AN EFFECT ARMED AGAINST THEIR NEXT TURN

   Five pool names print a crush rider that reaches forward, and all
   five refused until v3.29 because there was no schedule to fire on —
   the honest refusal v3.16 recorded. `nextTurn` on the side is that
   schedule.

   WHY IT NEEDED A NEW FIELD. `hist` is the natural home for a per-turn
   fact and is CLEARED for the incoming seat at CR 4.4.4 — which is the
   exact moment such an effect has to survive.

   THE LIFECYCLE IS THE RULE:
     armed        created on MY turn, does nothing yet
     ready        turned on at the start of THEIR turn
     spent        consumed by the FIRST attack / FIRST action
     expired      dropped at the end of that turn, fired or not
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

const atk = (u, pw) => ({name: "Swing" + u, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: pw, pitch: 1, cost: 0, uid: u});
const nonAtk = u => ({name: "Ritual" + u, tt: "Runeblade Action",
  ty: ["Runeblade", "Action"], tx: "", kw: [], cost: 2, pitch: 1, uid: u});

const armedOnFoe = ops => {
  P.fxReset();
  let g = H.state({}, {}, {turn: 3});
  g.builds = [{}, {}];
  return H.runOps(g, ops, "Debilitate");
};

/* ---- 1. it does NOT fire on the turn it was created ---------------- */

test("armed is not live — an effect for their NEXT turn waits", {skip: false}, () => {
  const g = armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]);
  assert.equal(g.sides[1].nextTurn.length, 1, "it lands on the FOE, not the actor");
  assert.equal(g.sides[1].nextTurn[0].ready, false);
  assert.equal(P.nextTurnDebuff(g.sides[1], "firstAtkMinus"), 0,
    "unarmed it reads as nothing — firing now would be a whole turn early");
  assert.equal((g.sides[0].nextTurn || []).length, 0, "the actor arms nothing on themselves");
});

test("arming at the start of their turn turns it on", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  assert.equal(P.nextTurnDebuff(g.sides[1], "firstAtkMinus"), 2);
});

/* ---- 2. Debilitate — the FIRST attack, and only the first --------- */

test("their first attack is weaker by the printed amount; the second is not", () => {
  let g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  g.actor = 1; g.builds = [{}, {}]; g.sides[1].res = 9; g.sides[1].ap = 1;

  const first = H.execute(g, atk("s1", 6), "hand", 0, {});
  assert.equal(first.pend.total, 4, "6 printed, 2 off — the crush still tells");

  const mid = {...first, actor: 1, builds: [{}, {}], pend: null, stack: []};
  mid.sides = first.sides.slice();
  mid.sides[1] = {...first.sides[1], res: 9, ap: 1};
  const second = H.execute(mid, atk("s2", 6), "hand", 0, {});
  assert.equal(second.pend.total, 6,
    "the SECOND attack is untouched — a whole-turn debuff is stronger than printed");
});

/* ---- 3. Cartilage Crush — the FIRST action, and only the first ---- */

test("their first action costs an extra {r}; the next does not", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstActionTax", 1]]), 1).game;
  assert.equal(P.effCost(nonAtk("a"), g.sides[1]), 3, "printed 2, taxed to 3");

  /* the tax is spent at the CHARGE, never at the affordability check —
     `effCost` is read twice and only one of those reads takes resources */
  let play = {...g, actor: 1, builds: [{}, {}]};
  play.sides = g.sides.slice();
  play.sides[1] = {...g.sides[1], res: 9, ap: 1};
  const after = H.execute(play, nonAtk("a"), "hand", 0, {});
  assert.equal(after.sides[1].res, 6, "9 - (2 printed + 1 tax)");
  assert.equal(P.effCost(nonAtk("b"), after.sides[1]), 2, "and the tax is spent");
});

/* ---- 3b. THE TWO RESTRICTIONS (v3.30) -----------------------------

   A restriction is a different SHAPE from a debuff, and the difference is
   not cosmetic:

     a debuff      carries an amount, is consumed by the FIRST thing it
                   touches, and the printed word is "first"
     a restriction carries no amount, is NEVER spent, and the printed
                   window is "during their next action phase"

   Reading either as the other has a direction. A debuff that lasts the
   phase is stronger than printed; a restriction spent on one play is
   weaker. ------------------------------------------------------------- */

const armedFoe = (kind, amt) => E.armNextTurn(
  armedOnFoe([["foeNextTurn", kind, amt]]), 1).game;
/* seat 1 with resources, an action point and no build — ready to swing */
const seat1Ready = g => {
  const n = {...g, actor: 1, builds: [{}, {}], pend: null, stack: []};
  n.sides = g.sides.slice();
  n.sides[1] = {...g.sides[1], res: 9, ap: 1};
  return n;
};

test("Chokeslam: an attack action card CANNOT gain {p} — capped at printed", () => {
  const g = seat1Ready(armedFoe("noPump", 0));
  g.sides[1] = {...g.sides[1], buffNext: 3};
  const out = H.execute(g, atk("s1", 5), "hand", 0, {});
  assert.equal(out.pend.total, 5,
    "5 printed and +3 in hand: it resolves for 5, and the label says 5");
});

test("Chokeslam is NOT spent — the whole action phase is barred", () => {
  let g = seat1Ready(armedFoe("noPump", 0));
  g.sides[1] = {...g.sides[1], buffNext: 3};
  const first = H.execute(g, atk("s1", 5), "hand", 0, {});
  assert.equal(first.pend.total, 5);

  let mid = seat1Ready(first);
  mid.sides[1] = {...mid.sides[1], buffNext: 4};
  const second = H.execute(mid, atk("s2", 5), "hand", 0, {});
  assert.equal(second.pend.total, 5,
    "it prints no FIRST — a restriction spent on one attack is weaker than printed");
});

test("Chokeslam names ATTACK ACTION CARDS, so a weapon swing is untouched", () => {
  const g = seat1Ready(armedFoe("noPump", 0));
  g.sides[1] = {...g.sides[1], buffNext: 3,
    gear: [{name: "Sledge", tt: "Guardian Weapon - Hammer", ty: ["Guardian", "Weapon"],
            tx: "", kw: [], power: 4, pitch: 0, uid: "w1"}]};
  const out = H.execute(g, g.sides[1].gear[0], "weapon", 0, {});
  assert.equal(out.pend.total, 7,
    "a weapon is not an attack action card — barring it is stronger than printed");
});

test("Chokeslam holds through the WALL, not only at declaration", () => {
  /* `linkPumps` re-adds every `{k:"rx"}` layer after the declaration, so a
     cap applied only at declaration is undone by any attack reaction. Two
     sites, one rule — and dropping either failed no drill until this one. */
  const g = seat1Ready(armedFoe("noPump", 0));
  const declared = H.execute(g, atk("s1", 5), "hand", 0, {});
  assert.equal(declared.pend.total, 5, "declared at printed");

  const withRx = {...declared, stack: [...(declared.stack || []), {k: "rx", pump: 4}]};
  const out = H.fx(withRx, (f, n) => f.linkPumps(n, {handBlockers: 0}));
  /* READ THE RETURNED TOTAL, not `pend.total` — `linkPumps` hands the wall
     a fresh number and leaves the pend alone, so an assertion on the pend
     measures the declaration a second time and says nothing about here. */
  assert.equal(out.pumps, 4, "the reaction layer really is on the stack");
  assert.equal(out.total, 5,
    "a +4 reaction layer must not lift it — 'can't gain {p}' is not 'can't gain {p} first'");
});

test("Chokeslam CAPS, it never subtracts — a weakened attack stays weakened", () => {
  /* "can't gain {p}" forbids GAINING. An attack already below its printed
     power (frailty, Debilitate) must not be lifted back up to it. */
  let g = armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]);
  g = H.runOps(g, [["foeNextTurn", "noPump", 0]], "Chokeslam");
  g = seat1Ready(E.armNextTurn(g, 1).game);
  const out = H.execute(g, atk("s1", 6), "hand", 0, {});
  assert.equal(out.pend.total, 4, "6 printed, Debilitate takes 2 — the cap does not give it back");
});

test("Crush the Weak bars the PLAY, and the threshold is the card's number", () => {
  const sd = armedFoe("noSmallAtk", 3).sides[1];
  const aac = pw => ({name: "A" + pw, tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: pw, pitch: 1, cost: 0});
  assert.match(P.nextTurnBars(sd, aac(3)) || "", /3 or less base power/, "3 is barred");
  assert.equal(P.nextTurnBars(sd, aac(4)), null, "4 clears the line");
  /* AND THE NUMBER IS READ, not a literal 3 */
  const five = armedFoe("noSmallAtk", 5).sides[1];
  assert.match(P.nextTurnBars(five, aac(4)) || "", /5 or less base power/);
});

test("Crush the Weak reads ATTACK ACTION CARD, never a substring of it", () => {
  const sd = armedFoe("noSmallAtk", 3).sides[1];
  /* "Reaction" CONTAINS "action". A `tt`-substring predicate bars an
     attack reaction the card never names — and `isAttack` is exactly such
     a predicate, which is why this asks `isAtkActionCard`. */
  assert.equal(P.nextTurnBars(sd, {name: "Rx", tt: "Warrior Attack Reaction",
    ty: ["Warrior", "Attack Reaction"], tx: "", kw: [], power: 3}), null,
    "an attack REACTION is not an attack action card");
  assert.equal(P.nextTurnBars(sd, {name: "Sword", tt: "Warrior Weapon - Sword",
    ty: ["Warrior", "Weapon"], tx: "", kw: [], power: 3}), null, "nor is a weapon");
  assert.equal(P.nextTurnBars(sd, {name: "Rite", tt: "Runeblade Action",
    ty: ["Runeblade", "Action"], tx: "", kw: [], cost: 2}), null, "nor a non-attack action");
});

test("an UNARMED restriction bars nothing — armed is not live", () => {
  const cold = armedOnFoe([["foeNextTurn", "noSmallAtk", 3]]).sides[1];   /* ready:false */
  assert.equal(P.nextTurnBars(cold, {name: "A", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: 3}), null,
    "it was created on the attacker's turn — firing now is a whole turn early");

  /* AND THE SAME FOR THE CAP. Asking `nextTurnHas` for a kind that is not
     in the list at all answers false whatever the `ready` test does, so
     the entry here must be the RIGHT kind and merely unarmed — otherwise
     this passes on an engine that ignores `ready` entirely. */
  const coldPump = armedOnFoe([["foeNextTurn", "noPump", 0]]);
  assert.equal(coldPump.sides[1].nextTurn[0].kind, "noPump", "the right kind, unarmed");
  assert.equal(P.nextTurnHas(coldPump.sides[1], "noPump"), false, "not live yet");
  const g = seat1Ready(coldPump);
  g.sides[1] = {...g.sides[1], buffNext: 3};
  assert.equal(H.execute(g, atk("s1", 5), "hand", 0, {}).pend.total, 8,
    "the cap is a whole turn away — capping now would delete a buff they are owed");
});

test("BOTH boards refuse the barred play, and out of the ONE reader", () => {
  /* A route is per board (v3.04). judge.legal refuses it; the trainer's
     `tryPlay` must too, or the same card is legal on one board and not the
     other. Comments stripped — a grep is satisfied by a comment. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  assert.match(jud, /PR\.nextTurnBars\(/, "judge must ask before the card leaves the hand");
  assert.match(htm, /DawnParser\.nextTurnBars\(/, "and so must the trainer");
  /* and NEITHER may restate the rule */
  for(const [nm, src] of [["judge.js", jud], ["index.html", htm]])
    assert.ok(!/noSmallAtk/.test(src),
      nm + " must not re-derive the restriction — one reader, in parser.js");
});

test("driven: judge refuses the barred card and it stays in the hand", {skip}, () => {
  H.db();
  const J = require("../engine/judge.js");
  /* Wounding Blow prints 2 at blue and 4 at red — one card, one side of the
     line each, so the CONTROL differs from the subject only in the number
     the rule reads. Without it this drill passes just as well on an engine
     that can play nothing at all. */
  const small = {...H.card("Wounding Blow", 3), uid: "c1"};
  const big   = {...H.card("Wounding Blow", 1), uid: "c2"};
  assert.ok(small.power <= 3 && big.power > 3, "fixture must straddle the line");

  const bar = [{kind: "noSmallAtk", amt: 3, ready: true, spent: false}];
  let g = H.state({hand: [small, big], res: 9, ap: 1, nextTurn: bar}, {}, {turn: 3, actor: 0});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  /* ASSERT THE REASON, NOT MERELY A REFUSAL (the fuzz lesson). A drill that
     accepts any refusal passes on an engine refusing for priority. */
  assert.match(J.legal(g, {t: "play", uid: "c1", from: "hand"}, 0) || "",
    /can't be played this phase/, "refused, and the reason names the rule");
  assert.equal(J.legal(g, {t: "play", uid: "c2", from: "hand"}, 0), null,
    "and the control is genuinely playable — the bar is the only thing refusing");

  const out = J.reduce(g, {t: "play", uid: "c1", from: "hand"}, 0);
  assert.equal(out.state.sides[0].hand.length, 2,
    "a play the rules never allowed must not cost the player the card");
  assert.equal(out.state.sides[0].res, 9, "and must charge nothing");
  assert.equal(out.state.sides[0].ap, 1, "nor the action point");
});

/* ---- 4. it expires with the turn, fired or not -------------------- */

test("it is dropped at the end of that turn even if it never fired", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  const out = E.beginEndPhase(g, 1);
  assert.deepEqual(out.game.sides[1].nextTurn, [],
    "'their FIRST attack during their next turn' — if they never attacked it is spent all the same");
});

test("an effect armed DURING this turn survives it — it is aimed at the next", () => {
  /* only entries that were ready for THIS turn expire. One created here is
     for the turn after, and dropping it would delete the card's whole
     effect the moment it was played. */
  const g = armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]);   /* ready:false */
  const out = E.beginEndPhase(g, 1);
  assert.equal(out.game.sides[1].nextTurn.length, 1, "still armed for next turn");
  assert.equal(out.game.sides[1].nextTurn[0].ready, false);
});

/* ---- 5. BOTH BOARDS arm it ---------------------------------------- */

test("both boards call armNextTurn at the top of the turn", () => {
  /* A schedule is written per board — the field and the reader existing is
     not the same as something turning it on. Comments stripped: a grep is
     satisfied by a comment, in both directions. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  assert.match(jud, /E\.armNextTurn\(n, inc\)/, "judge must arm the incoming seat");
  assert.match(htm, /DawnEffects\.armNextTurn\(n, 0\)/, "the trainer must arm its seat too");
});

/* ---- 6. the side field is carried everywhere a side is ------------ */

test("nextTurn is a real side field, serialized and reported", () => {
  const S = require("../engine/sides.js");
  assert.ok(S.SIDE_FIELDS.includes("nextTurn"), "or invariants reports SIDES-ASYMMETRIC");
  const W = fs.readFileSync(path.join(__dirname, "..", "engine", "wire.js"), "utf8");
  assert.match(W, /"nextTurn"/, "a field the wire drops is a desync waiting to happen");
  const R = fs.readFileSync(path.join(__dirname, "..", "engine", "report.js"), "utf8");
  assert.match(R, /nextTurn/, "a report that omits state is worse than no report");
});

/* ---- 7. "THIS TURN" ENDS WITH THE TURN (v3.34) ---------------------- */

test("every single-shot 'this turn' grant expires in the shared end phase", () => {
  /* FIVE GRANTS, all printed "this turn", and the expiry was written on
     ONE BOARD: the trainer cleared two of them at CR 4.4.3e and judge
     cleared nothing at all — so at the table a next-attack buff survived
     every later turn of the game. Permanent where the card prints one
     turn, which is the direction that steals games. A schedule is written
     per board (v3.01); this one belongs in the shared event. */
  let g = H.state({buffNext: 3, buffQ: [{amt: 2, q: null}], gaNext: true,
                   gaNextQ: [{powLe: 3}], costOff: [{amt: 1, q: null}]},
                  {buffNext: 5}, {turn: 4, actor: 0});
  const out = E.beginEndPhase(g, 0);
  const me = out.game.sides[0], them = out.game.sides[1];
  assert.equal(me.buffNext, 0);
  assert.deepEqual(me.buffQ, []);
  assert.equal(me.gaNext, false);
  assert.deepEqual(me.gaNextQ, []);
  assert.deepEqual(me.costOff, []);
  /* BOTH SEATS, not just the turn player. CR 4.4.3e loses points for all
     players and a grant is the same kind of thing: a hero who banks one
     during your turn must not keep it into their own. */
  assert.equal(them.buffNext, 0, "the other seat's grants expire too");
  assert.ok(out.msgs.some(m => /expire/.test(m)), "and the feed says so");
});

test("the expiry does not fire when there is nothing to expire", () => {
  /* A step that announces itself and does nothing is worse than one that
     is missing (CR 4.4.3a's lesson). */
  const g = H.state({}, {}, {turn: 4, actor: 0});
  const out = E.beginEndPhase(g, 0);
  assert.ok(!out.msgs.some(m => /expire/.test(m)));
});
