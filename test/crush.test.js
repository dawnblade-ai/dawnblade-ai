/* ============================================================
   CRUSH RUNS THE CARD'S OWN RIDER (v3.16)

   Twelve pool cards across two heroes print a crush rider. Every one of
   them reported `tier: full`, and every one of them ran **Boulder Drop's
   payload**, because two separate things pointed at the same card:

     parser    one rule anchored to the crush PREFIX returned a noop whose
               text asserts a specific payload — "the keyword system
               forces a card from their hand onto their deck"
     effects   the trigger site pushed a card from hand to deck, hardcoded,
               for anything carrying the keyword

   So Buckling Blow's -1{d} counter, Wee Wrecking Ball's arsenal
   destruction and nine others were not merely unbuilt. They were
   **SUBSTITUTED** — the card did something real, and something else.

   A `noop` counts as accounted for, which is why coverage never saw it:
   this is the blind spot CLAUDE.md names, at twelve cards.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const crushOf = nm => {
  for(const p of [1, 2, 3]){
    const c = H.card(nm, p);
    if(c && c.tx){ P.fxReset && P.fxReset(); return P.fxParse(c).crush; }
  }
  return null;
};
/* An opponent holding one of everything a crush rider can reach. */
const foeSide = () => ({
  hand:    [{...H.card("Raging Onslaught", 1), uid: "fh1"}],
  arsenal: {...H.card("Raging Onslaught", 2), uid: "fa1"},
  gear:    [{...H.card("Blade Beckoner Helm", 0), uid: "fg1"}],
  board:   [{card: {...H.card("Seismic Surge", 0), uid: "st1"}, kind: "token", spent: false, uid: "st1"}],
  deck:    [{...H.card("Raging Onslaught", 3), uid: "fd1"}]
});
const fire = (nm, mine) => {
  const cr = crushOf(nm);
  assert.ok(cr, nm + " must carry a crush rider");
  const g = H.state(mine || {}, foeSide(), {turn: 3, actor: 0});
  return J.withEffects(g, (fx, s) => fx.runOps(s, cr.ops, nm));
};

/* ---- EACH CARD DOES ITS OWN THING ------------------------------------ */

test("seven crush riders each resolve to their own printed payload", {skip}, () => {
  H.db();
  const want = {
    "Boulder Drop":      [["foeHandToDeck", 1]],
    "Short Shrift":      [["foeDiscard", 1]],
    "Buckling Blow":     [["foeGearDef", -1]],
    "Wee Wrecking Ball": [["foeArsDestroy", 1]],
    "Disable":           [["foeArsBottom", 1]],
    "Fault Line":        [["allArsBottom", 1]],
    "Flatten the Field": [["destroyFoeToken", "seismic surge"]]
  };
  for(const [nm, ops] of Object.entries(want))
    assert.deepEqual(crushOf(nm).ops, ops, nm);
  /* AND NO TWO OF THEM ARE THE SAME. That is the whole bug in one line:
     before v3.16 every entry above was Boulder Drop's. */
  const seen = Object.values(want).map(o => JSON.stringify(o));
  assert.equal(new Set(seen).size, seen.length, "seven cards, seven payloads");
});

test("driven: each rider changes the zone it names, and no other", {skip}, () => {
  H.db();
  const f = nm => fire(nm).sides[1];
  assert.equal(f("Boulder Drop").hand.length, 0, "hand → deck");
  assert.equal(f("Short Shrift").hand.length, 0, "discarded");
  assert.equal(f("Wee Wrecking Ball").arsenal, null, "arsenal destroyed");
  assert.equal(f("Disable").arsenal, null, "arsenal to the bottom");
  assert.equal(f("Flatten the Field").board.length, 0, "the Seismic Surge is gone");
  const bb = f("Buckling Blow");
  assert.equal(bb.gear[0].curDef, 0, "a 1-defence helm takes a -1{d} counter");
  assert.equal(bb.hand.length, 1, "and NOTHING leaves the hand — that was Boulder Drop's payload");
});

test("Wee Wrecking Ball destroys; Disable buries — and they are not the same", {skip}, () => {
  H.db();
  const dead = fire("Wee Wrecking Ball").sides[1];
  const buried = fire("Disable").sides[1];
  assert.equal(dead.grave.length, 1, "destroyed lands in the graveyard");
  assert.equal(buried.deck[buried.deck.length - 1].uid, "fa1", "buried lands under the deck");
  assert.equal(buried.grave.length, 0, "and never reaches the graveyard");
});

test("Fault Line empties ALL arsenals, including the caster's", {skip}, () => {
  H.db();
  /* It prints "all cards in all arsenals". Reading it as the opponent's
     alone would make it strictly better than printed. */
  const out = fire("Fault Line", {arsenal: {...H.card("Raging Onslaught", 1), uid: "ma1"}});
  assert.equal(out.sides[1].arsenal, null, "theirs");
  assert.equal(out.sides[0].arsenal, null, "and yours — the card says ALL");
});

/* ---- THE THRESHOLD, AND THE HONEST REFUSALS -------------------------- */

test("the threshold is the card's printed number, not a literal 4", {skip}, () => {
  H.db();
  for(const nm of ["Boulder Drop", "Short Shrift", "Buckling Blow"])
    assert.equal(crushOf(nm).n, 4, nm + " prints 4");
  assert.equal(P.classifyClause(
    "Crush - When this deals 6 or more damage to a hero, they discard a card.").ops[0][1], 6,
    "a card printing 6 must carry 6");
});

test("FOUR of the five next-turn riders are built; ONE still refuses", {skip}, () => {
  H.db();
  /* All five reach into the OPPONENT'S NEXT TURN. v3.16 refused all five
     because no such schedule existed; `nextTurn` on the side is that
     schedule (v3.29), and v3.30 added the two RESTRICTIONS — which are a
     different shape from a debuff, because nothing consumes them: one caps
     a total and one refuses a play.

     THE LAST ONE STILL REFUSES, and for its own reason rather than a shared
     shrug. Claiming it here would file a card `full` that does nothing,
     which is the tier lie this project keeps finding. */
  assert.deepEqual(crushOf("Debilitate"), {n: 4, ops: [["foeNextTurn", "firstAtkMinus", 2]]},
    "a deferred power debuff — the amount read off the clause");
  assert.deepEqual(crushOf("Cartilage Crush"), {n: 4, ops: [["foeNextTurn", "firstActionTax", 1]]},
    "a deferred cost tax");
  assert.deepEqual(crushOf("Chokeslam"), {n: 4, ops: [["foeNextTurn", "noPump", 0]]},
    "a deferred PUMP BAR — attack action cards they control can't gain {p}");
  assert.deepEqual(crushOf("Crush the Weak"), {n: 4, ops: [["foeNextTurn", "noSmallAtk", 3]]},
    "a deferred PLAY BAR, with the threshold read off the clause rather than a literal");

  assert.equal(crushOf("Walk in My Shoes"), undefined,
    "Walk in My Shoes must not claim a rider it cannot run — halving base {p} AND base {d} "
    + "for a whole turn is a modifier on every attack action card they control, which is "
    + "neither a cap nor a gate and has nowhere to live");
});

test("the DEBUFFS are FIRST-only; the RESTRICTIONS are whole-phase — by print", {skip}, () => {
  /* Two shapes, and reading either as the other is a bug with a direction.
     A blanket debuff for the whole turn is strictly stronger than printed;
     a restriction spent by the first play is strictly weaker. The printed
     words are what separate them, so they are asserted off the card. */
  H.db();
  for(const nm of ["Debilitate", "Cartilage Crush"]){
    const c = H.card(nm, 1);
    assert.match((c.tx || "").toLowerCase(), /their first (attack|action) during their next turn/,
      nm + ": the printed word is FIRST");
  }
  for(const nm of ["Chokeslam", "Crush the Weak"]){
    const c = H.card(nm, 1);
    const tx = (c.tx || "").toLowerCase();
    assert.match(tx, /during their next action phase/,
      nm + ": the printed window is the whole action phase");
    assert.ok(!/\bfirst\b/.test(tx),
      nm + ": it prints no FIRST — spending it on one play is weaker than printed");
  }
});

test("no crush rider leaks into fx.ops — it is a gated trigger", {skip}, () => {
  H.db();
  /* Left in `fx.ops` a rider fires at DECLARATION, for every crush card,
     regardless of damage. Short Shrift discarded on play while this was
     being built. */
  for(const nm of ["Boulder Drop", "Short Shrift", "Buckling Blow", "Fault Line"]){
    for(const p of [1, 2, 3]){
      const c = H.card(nm, p);
      if(!c || !c.tx) continue;
      P.fxReset && P.fxReset();
      const fx = P.fxParse(c);
      assert.ok(!(fx.ops || []).some(o => /^(foe|all|destroyFoe)/.test(o[0])),
        nm + ": the payload must sit on fx.crush, never fx.ops");
      break;
    }
  }
});

test("the trigger site names no card", {skip}, () => {
  const fs = require("fs"), path = require("path");
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = efx.indexOf("CRUSH RUNS THE CARD'S OWN RIDER");
  assert.ok(i > 0, "the crush trigger moved — re-anchor this drill");
  const body = efx.slice(i, i + 1400);
  assert.ok(body.length > 400, "slice too small to be the trigger");
  assert.match(body, /fxParse\(pc\)\.crush/, "it must read the swinging card's own rider");
  assert.ok(!/hand\.length\s*-\s*1|slice\(0,\s*-1\)/.test(body),
    "and must not still carry Boulder Drop's hand-to-deck push inline");
});

/* ---- THE TRIGGER, DRIVEN --------------------------------------------- */

/* SABOTAGING THE TRIGGER LEFT EVERY DRILL ABOVE GREEN. They call `runOps`
   on the rider directly, which proves the PAYLOAD works and says nothing
   about whether anything fires it. That is the same gap this session found
   in the arena sweep and in `attackRx`, and it is the reason a payload
   drill is never enough on its own. `linkPayload` is the shared body that
   owns everything a link does once damage is struck; both boards call it. */
function strike(nm, total){
  const cr = crushOf(nm);
  let c = null;
  for(const p of [1, 2, 3]){ const x = H.card(nm, p); if(x && x.tx){ c = {...x, uid: "atk1"}; break; } }
  const g = {...H.state({}, foeSide(), {turn: 3, actor: 0}),
             pend: {card: c, by: 0, total, ga: false, ops: [], onHit: [], condOnHit: []},
             stack: [], chain: []};
  return J.withEffects(g, (fx, s) => fx.linkPayload(s, {total, pumps: 0, handBlockers: 0,
                                                        defenders: 0, blkNote: ""}).game);
}

test("driven through linkPayload: a crush hit runs THAT card's rider", {skip}, () => {
  H.db();
  /* Buckling Blow weakens a piece and takes nothing from the hand.
     Boulder Drop takes from the hand and touches no piece. Before v3.16
     both did the second thing. */
  const bb = strike("Buckling Blow", 4).sides[1];
  assert.equal(bb.gear[0].curDef, 0, "the helm took its -1{d} counter");
  assert.equal(bb.hand.length, 1, "and the hand is untouched");

  const bd = strike("Boulder Drop", 4).sides[1];
  assert.equal(bd.hand.length, 0, "Boulder Drop empties the hand instead");
  assert.equal(bd.gear[0].curDef == null ? bd.gear[0].def : bd.gear[0].curDef, 1,
    "and leaves the helm alone");
});

test("driven: below the printed threshold, no rider fires", {skip}, () => {
  H.db();
  const under = strike("Buckling Blow", 3).sides[1];
  assert.equal(under.gear[0].curDef == null ? under.gear[0].def : under.gear[0].curDef, 1,
    "3 damage is not 4 — crush is a threshold, not a hit trigger");
  assert.equal(under.hand.length, 1);
});

test("driven: a rider runs ITS OWN payload and no other card's", {skip}, () => {
  H.db();
  /* Debilitate reaches into the opponent's next turn. It must not quietly
     borrow another card's payload, which is what it did for twelve
     versions — that is the whole point of this file. Its own payload lands
     on `nextTurn` (drilled in test/nextturn.test.js); NOTHING here moves. */
  const s = strike("Debilitate", 6).sides[1];
  assert.equal(s.hand.length, 1, "nothing leaves the hand");
  assert.equal(s.arsenal.uid, "fa1", "nothing leaves the arsenal");
  assert.equal(s.board.length, 1, "no token is destroyed");
  assert.equal(s.gear[0].curDef == null ? s.gear[0].def : s.gear[0].curDef, 1, "no counter lands");
});
