/* ATTACK TARGETS (CR 1.4.5) — declaring what an attack is aimed at.

   "If a player plays, activates, or triggers an attack or attack-layer, the
   player MUST declare an attackable object controlled by an opponent as the
   attack-target."                                            — CR 1.4.5
   "An object is attackable if it is a living object, or if it is made
   attackable by an effect."                                   — CR 1.4.5a
   "If the attack-target is a hero, their controller may declare any number
   of non-defense-reaction cards ... Otherwise, a player may only declare
   cards for an attack-target if a rule or effect specifies it."
                                                               — CR 7.3.2a
   "Allies' life totals reset to base" in the end phase.       — CR 4.4.3a

   The load-bearing consequence, and the reason this is a real decision
   rather than a worse way to hit the hero: **an attack on an ally cannot be
   blocked.** It always connects, and it kills. */
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../engine/game.js");
const P = require("../engine/prompts.js");
const S = require("../engine/sides.js");
const C = require("../engine/cards.js");

const ally = (uid, name, power, life) => ({
  card: {uid, name, power, life, tt: "Pirate Necromancer Action - Ally", kw: [], tx: ""},
  kind: "ally", spent: false, uid
});
const heroCard = {name: "The Dummy", tt: "Hero", tx: "", img: null, dbImg: null};

function game(oppBoard){
  const g = S.makeGame();
  g.sides[1] = {...g.sides[1], hp: 42, board: oppBoard || [], name: "The Dummy"};
  return g;
}

/* ---- what is attackable (CR 1.4.5a) -------------------------------- */
test("a hero is always a legal attack-target", () => {
  const ts = G.attackTargets(game([]), 1, heroCard);
  assert.equal(ts.length, 1);
  assert.equal(ts[0]._target.kind, "hero");
  assert.equal(ts[0]._target.side, 1);
});

test("an ally with life is attackable — it is a living object", () => {
  const ts = G.attackTargets(game([ally(9, "Barnacle", 4, 3)]), 1, heroCard);
  assert.equal(ts.length, 2);
  assert.equal(ts[1]._target.kind, "ally");
  assert.equal(ts[1]._target.uid, 9);
  assert.equal(ts[1]._life, 3);
  assert.equal(ts[1].name, "Barnacle");
});

test("an ally with NO life value is not attackable", () => {
  /* resolveEntry returns life:null for anything the DB has no health for.
     Offering it as a target would be inventing a life total. */
  const ts = G.attackTargets(game([ally(9, "Mystery", 4, null)]), 1, heroCard);
  assert.equal(ts.length, 1, "only the hero should be offered");
});

test("a non-ally permanent (item, aura) is not an attack-target", () => {
  const g = game([{card: {uid: 5, name: "Hyper Driver", life: null}, kind: "item", uid: 5}]);
  assert.equal(G.attackTargets(g, 1, heroCard).length, 1);
});

test("an ally already at 0 life is not offered", () => {
  const g = game([{...ally(9, "Barnacle", 4, 3), life: 0}]);
  assert.equal(G.attackTargets(g, 1, heroCard).length, 1);
});

test("multiple allies all become targets, hero first", () => {
  const ts = G.attackTargets(game([ally(1,"Swabbie",7,3), ally(2,"Riggermortis",6,4)]), 1, heroCard);
  assert.deepEqual(ts.map(t => t._target.kind), ["hero","ally","ally"]);
  assert.deepEqual(ts.slice(1).map(t => t.name), ["Swabbie","Riggermortis"]);
});

/* ---- CR 7.3.2a: only a hero target may be blocked ------------------ */
test("only a hero attack-target may be defended with cards (CR 7.3.2a)", () => {
  assert.equal(G.targetCanBeDefended({kind: "hero"}), true);
  assert.equal(G.targetCanBeDefended({kind: "ally"}), false);
});

/* ---- the prompt (CR 1.4.5, mandatory) ------------------------------ */
test("one legal target asks nothing — the sheet skips itself", () => {
  const g = game([]);
  const live = P.buildPrompt(g, {tag: "target", side: 0, cards: G.attackTargets(g, 1, heroCard)});
  assert.equal(live, null, "an attack into an empty arena must not show a prompt");
});

test("two legal targets opens a target prompt", () => {
  const g = game([ally(9, "Barnacle", 4, 3)]);
  const live = P.buildPrompt(g, {tag: "target", side: 0, cards: G.attackTargets(g, 1, heroCard)});
  assert.ok(live);
  assert.equal(live.tag, "target");
  assert.equal(live.cards.length, 2);
  assert.match(live.hint, /cannot be blocked|cannot be defended/i);
});

test("the target choice is mandatory — no confirm until one is picked", () => {
  const g = game([ally(9, "Barnacle", 4, 3)]);
  let live = P.buildPrompt(g, {tag: "target", side: 0, cards: G.attackTargets(g, 1, heroCard)});
  assert.equal(P.promptReady(live), false, "CR 1.4.5 makes declaring a target mandatory");
  live = P.promptChoose(live, 1);
  assert.equal(P.promptReady(live), true);
});

test("applyPrompt reports the chosen target and moves nothing", () => {
  const g = game([ally(9, "Barnacle", 4, 3)]);
  const live = P.promptChoose(
    P.buildPrompt(g, {tag: "target", side: 0, cards: G.attackTargets(g, 1, heroCard)}), 1);
  const r = P.applyPrompt(g, live);
  assert.deepEqual(r.target, {kind: "ally", side: 1, uid: 9});
  assert.match(r.msgs[0], /Barnacle/);
  assert.match(r.msgs[0], /7\.3\.2a/);
  assert.equal(r.pay, 0);
  assert.deepEqual(r.ops, []);
  /* nothing on the board moved — the trainer routes the damage */
  assert.equal(r.game.sides[1].board.length, 1);
  assert.equal(r.game.sides[1].hp, 42);
});

test("choosing the hero reports a hero target", () => {
  const g = game([ally(9, "Barnacle", 4, 3)]);
  const live = P.promptChoose(
    P.buildPrompt(g, {tag: "target", side: 0, cards: G.attackTargets(g, 1, heroCard)}), 0);
  const r = P.applyPrompt(g, live);
  assert.equal(r.target.kind, "hero");
  assert.equal(r.target.side, 1);
});

/* ---- damage to an ally --------------------------------------------- */
test("non-lethal damage leaves the ally on the board with reduced life", () => {
  const g = game([ally(9, "Swabbie", 7, 3)]);
  const r = G.damageAlly(g, 1, 9, 2);
  assert.equal(r.killed, null);
  assert.equal(r.game.sides[1].board.length, 1);
  assert.equal(G.allyLife(r.game.sides[1].board[0]), 1);
  assert.equal(r.game.sides[1].grave.length, 0);
});

test("lethal damage kills the ally and puts it in its controller's graveyard", () => {
  const g = game([ally(9, "Swabbie", 7, 3)]);
  const r = G.damageAlly(g, 1, 9, 3);
  assert.equal(r.killed, "Swabbie");
  assert.equal(r.game.sides[1].board.length, 0);
  assert.equal(r.game.sides[1].grave.length, 1);
  assert.equal(r.game.sides[1].grave[0].name, "Swabbie");
  assert.match(r.msgs[0], /goes down/);
});

test("excess damage does not spill onto the hero", () => {
  const g = game([ally(9, "Limpit", 2, 3)]);
  const r = G.damageAlly(g, 1, 9, 99);
  assert.equal(r.game.sides[1].hp, 42, "an ally is a separate attack-target; damage stops there");
});

test("damaging one ally leaves its neighbour untouched", () => {
  const g = game([ally(1, "A", 2, 3), ally(2, "B", 2, 3)]);
  const r = G.damageAlly(g, 1, 1, 1);
  assert.equal(G.allyLife(r.game.sides[1].board[0]), 2);
  assert.equal(G.allyLife(r.game.sides[1].board[1]), 3);
});

test("damageAlly does not mutate the state it was handed", () => {
  const g = game([ally(9, "Swabbie", 7, 3)]);
  const before = G.allyLife(g.sides[1].board[0]);
  G.damageAlly(g, 1, 9, 2);
  assert.equal(G.allyLife(g.sides[1].board[0]), before, "the original state must be untouched");
});

/* ---- CR 4.4.3a: allies heal every turn ----------------------------- */
test("ally life resets to base in the end phase (CR 4.4.3a)", () => {
  const g = game([ally(9, "Swabbie", 7, 3)]);
  const hurt = G.damageAlly(g, 1, 9, 2).game;
  assert.equal(G.allyLife(hurt.sides[1].board[0]), 1);
  const healed = G.resetAllyLife(hurt, 1);
  assert.equal(G.allyLife(healed.sides[1].board[0]), 3, "ally damage is a per-turn race");
});

test("resetAllyLife leaves undamaged allies and non-allies alone", () => {
  const g = game([ally(9, "Swabbie", 7, 3), {card: {uid: 5, name: "Aura"}, kind: "aura", uid: 5}]);
  const out = G.resetAllyLife(g, 1);
  assert.equal(out.sides[1].board.length, 2);
  assert.equal(G.allyLife(out.sides[1].board[0]), 3);
});

/* ---- the loader must carry ally life at all ------------------------ */
test("resolveEntry carries an ally's life from the database's health", () => {
  const db = C.buildMaps([C.mapDbCard({
    name: "Barnacle", pitch: 2, cost: 2, power: 4, health: 3,
    type_text: "Pirate Necromancer Action - Ally", functional_text_plain: "Watery Grave", printings: []
  })]);
  const e = C.resolveEntry(db, {name: "Barnacle", p: 2, code: null, q: 1});
  assert.equal(e.resolved, true);
  assert.equal(e.life, 3, "without this an ally can never be a legal attack-target");
  assert.equal(e.power, 4);
});

test("resolveEntry leaves life null for a card with no health", () => {
  const db = C.buildMaps([C.mapDbCard({
    name: "Head Jab", pitch: 3, cost: 0, power: 3,
    type_text: "Brute Attack Action", functional_text_plain: "Go again", printings: []
  })]);
  assert.equal(C.resolveEntry(db, {name: "Head Jab", p: 3, code: null, q: 1}).life, null);
});
