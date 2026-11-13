/* ============================================================
   A TARGET IS REQUIRED (v6.00)

   RULING (user, 2026-11-13): a card that requires a target cannot be played
   when it has no legal target (confirms the ruling below).

   RULING (user, 2026-11-07), asked whether Preserve Tradition ("Put target
   action card from your graveyard on the bottom of your deck.") can be
   played with no legal target: "You're right - target required."

   CR 5.1.4a "…if any resolution abilities generate effects that require a
   target, the player must declare all legal targets for those effects."
   CR 5.1.5 "…or the parameters of the proposed card are illegal, the card
   is illegal to play…"

   The rule is general — `effects.playTargetWhy`, one body, asked by the
   table (`judge.playableWhy`, and every activation route through
   `rxTargetWhy`) and by the trainer's play and instant doors. v5.07 let a
   card that prints something BESIDE its target (the Mystic instants'
   transcend, Edict of Steel's go again) be played into nothing; that
   exemption is gone. An attack is untouched: its target is a hero
   (CR 1.4.5), and targeted text on an attack is a trigger's.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const B = require("../engine/build");
const S = require("../engine/sparring");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

function at(me, them, extra){
  return Object.assign({...H.state(Object.assign({hand: [], res: 9, ap: 1, name: "Me"}, me || {}),
                                   Object.assign({hp: 20, name: "Them"}, them || {}),
                                   {turn: 3, actor: 0, turnPlayer: 0}),
    phase: "action", step: "layer", priority: 0, passed: [false, false], stack: [], chain: [], chainCards: []},
    extra || {});
}
const why = (g, uid) => J.legal(g, {t: "play", uid, from: "hand"}, 0);
const cc = (nm, p, uid) => ({...H.card(nm, p), uid});

test("PRESERVE TRADITION: refused with no action card in your graveyard, legal with one", {skip}, () => {
  H.db();
  const pt = cc("Preserve Tradition", 1, "PT");
  assert.ok(/transcend/i.test(pt.tx || ""), "fixture: it prints a transcend beside its target");
  assert.match(String(why(at({hand: [pt]}), "PT")), /^Preserve Tradition: nothing in your graveyard can be its target$/);
  /* the near-miss: a graveyard holding only a NON-action card */
  const inst = cc("Lightning Press", 1, "g0");
  assert.ok(!(inst.ty || []).includes("Action"), "fixture: an instant is not an action card");
  assert.match(String(why(at({hand: [pt], grave: [inst]}), "PT")), /can be its target/, "'action card' is read");
  const act = cc("Wounding Blow", 1, "g1");
  assert.equal(why(at({hand: [pt], grave: [inst, act]}), "PT"), null, "an action card is a legal target");
});

test("PASS OVER: refused on an empty opposing graveyard, legal with a card in it", {skip}, () => {
  H.db();
  const po = cc("Pass Over", 1, "PO");
  /* YOUR graveyard is not its zone */
  assert.match(String(why(at({hand: [po], grave: [cc("Wounding Blow", 1, "m1")]}), "PO")),
    /^Pass Over: nothing in Them's graveyard can be its target$/);
  assert.equal(why(at({hand: [po]}, {grave: [cc("Wounding Blow", 1, "t1")]}), "PO"), null);
});

test("A DROP IN THE OCEAN and EDICT OF STEEL: refused with nothing to target, legal with it", {skip}, () => {
  H.db();
  const dr = cc("A Drop in the Ocean", 3, "DR");
  assert.match(String(why(at({hand: [dr]}), "DR")), /no attack is on the chain/);
  const atk = cc("Wounding Blow", 1, "ATK");
  const swing = at({hand: [dr], ap: 0}, {}, {step: "reaction", turnPlayer: 1, attacker: 1, chainCards: [atk],
    pend: {card: atk, from: "hand", by: 1, total: atk.power || 0, ga: false, ops: [], onHit: []}});
  assert.equal(why(swing, "DR"), null, "an attack on the chain is its target");
  const ed = cc("Edict of Steel", 1, "ED");
  assert.match(String(why(at({hand: [ed]}), "ED")), /^Edict of Steel: you control nothing it can target$/);
});

test("SCUTTLE TOES: the ability needs an ally to target (2026-11-13); no gate on an unparsed optional target", {skip}, () => {
  H.db();
  const st = {...H.card("Scuttle Toes", 0), uid: "ST"};
  const ab = B.equipPiece({...st}).powCard;
  assert.ok(ab, "fixture: the equipment has an activated ability");
  assert.match(String(E.playTargetWhy(at(), ab, 0)), /^Scuttle Toes — ability: you control no ally for it to target$/);
  const ally = {card: {...H.card("Swabbie", 0), uid: "AL"}, kind: "ally", uid: "AL"};
  assert.ok(require("../engine/game").isAlly(ally), "fixture: a real ally entry");
  assert.equal(E.playTargetWhy(at({board: [ally]}), ab, 0), null, "an ally is a legal target");
  const gate = {...H.card("Gate to i'Arathael", 0), uid: "GT"};
  assert.equal(E.playTargetWhy(at(), gate, 0), null);
});

test("THE TRAINER'S INSTANT DOOR refuses the same play, before anything moves", {skip}, () => {
  H.db();
  const pt = cc("Preserve Tradition", 1, "PT");
  const r = J.withEffects(at({hand: [pt]}), (fx, n) => fx.playAtSpeed(n, pt, "hand", {window: "instant"}));
  assert.match(String(r.why), /can be its target/);
  assert.ok(r.game.sides[0].hand.some(c => c.uid === "PT"), "nothing moved");
});

test("ATTACKS ARE UNTOUCHED: an attack with targeted text stays playable (CR 1.4.5)", {skip}, () => {
  H.db();
  const bb = cc("Buckling Blow", 1, "BB");
  assert.ok(P.isAttack(bb) && /\btarget\b/i.test(bb.tx || ""), "fixture: an attack that prints a target");
  assert.equal(E.playTargetWhy(at({hand: [bb]}), bb, 0), null);
  assert.equal(why(at({hand: [bb]}), "BB"), null, "and the table lets it attack the hero");
});

test("THE AI NEVER PROPOSES IT: act with a target-less Preserve Tradition proposes a legal action", {skip}, () => {
  H.db();
  const pt = cc("Preserve Tradition", 1, "PT");
  const g = at({hand: [pt]});
  const a = S.act(g, 0);
  assert.ok(!(a && a.uid === "PT"), "it proposed the card with nothing to target: " + JSON.stringify(a));
  assert.equal(a == null ? null : J.legal(g, a, 0), null, "its proposal is legal");
});

/* THE CENSUS — every pool card (and every ability a pool card grants) the
   rule can gate, asked against an EMPTY state. A new name here is a
   decision. Beckoning Haunt, Crown of Dichotomy and Fai are activations the
   table's `abCostWhy` already refused for the same empty graveyard; Fai's
   "a Phoenix Flame" is no target, and it is refused as a paid no-op. */
test("THE CENSUS: which pool cards a missing target refuses", {skip}, () => {
  const db = H.db();
  const out = new Set(), seen = new Set();
  for(const r of require("../data/pool.js")){
    const m = C.mapDbCard(r), c = C.resolveEntry(db, {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(!c || seen.has(c.name)) continue; seen.add(c.name);
    c.uid = "Z";
    const cands = [c];
    try { const pc = B.equipPiece({...c}).powCard; if(pc) cands.push(pc); } catch(e){}
    for(const x of cands) if(E.playTargetWhy(at(), x, 0)) out.add(x.name);
  }
  assert.deepEqual([...out].sort(), [
    "A Drop in the Ocean", "Astral Etchings", "Beckoning Haunt — ability", "Concealed Object — ability",
    "Crown of Dichotomy — ability", "Edict of Steel", "Fai — ability", "Lightning Press",
    "Memorial Ground", "Pass Over", "Preserve Tradition", "Scuttle Toes — ability"]);
});
