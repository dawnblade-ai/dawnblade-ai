/* ============================================================
   ARAKNI'S FOUR TRAPS (v3.08) — and the zone they were sitting in

   Den of the Spider, Lair of the Spider, Frailty Trap and Inertia Trap
   are a 2x2: two conditions over two payloads.

     attack with go again              -> mark the attacking hero
     attack with go again              -> Frailty under the attacker
     attack with {p} above its base    -> mark the attacking hero
     attack with {p} above its base    -> Inertia under the attacker

   All four read `tier: none` — the whole card, unparsed, because the
   qualifier on the attack fell past an anchored "when this defends" rule.
   Both payload ops already existed; only the trigger was missing.

   AND BUILDING THEM MADE A ZONE BUG VISIBLE. `fx.perm` was set off a
   `\btrap\b` match on the printed type line, so all four resolved INTO
   THE ARENA and stayed there for the rest of the game. `types.js` has
   said `destination: "grave"` for every one of them the whole time. It
   is v2.39's ruling — where `tt` and `ty` conflict the structured array
   wins — one layer further down than anyone had looked, and nobody saw
   it because a card that does nothing is a card nobody follows.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const T = require("../engine/types");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

const TRAPS = ["Den of the Spider", "Lair of the Spider", "Frailty Trap", "Inertia Trap"];

const parse = nm => { P.fxReset && P.fxReset(); return P.fxParse(H.card(nm, 1)); };

/* Seat 1 declares an attack; seat 0 is the defender playing the trap.
   `by` is what makes the pend HOSTILE — a pend belongs to whoever
   declared it, and without that test a trap reads its holder's own
   attack and marks the wrong hero. */
function defendWith(trapName, o){
  o = o || {};
  const trap = H.card(trapName, 1);
  const atk = H.card(o.atk || "Raging Onslaught", 1);
  const g = {...H.state({hand: [trap]}, {}, {turn: 3, actor: 0}),
    pend: {card: atk, by: o.by != null ? o.by : 1,
           total: o.total != null ? o.total : (atk.power || 0),
           ga: !!o.ga, ops: [], onHit: []}};
  return {n: H.execute(g, trap, "hand", 0, {}), base: atk.power || 0};
}

/* ---- THE 2x2 IS A CENSUS, AND IT IS PINNED ---------------------------- */

test("all four Traps parse to the right condition and the right payload", {skip}, () => {
  H.db();
  const want = {
    "Den of the Spider":  ["defPumped", ["mark", 1]],
    "Lair of the Spider": ["defGA",     ["mark", 1]],
    "Frailty Trap":       ["defGA",     ["fra", 1]],
    "Inertia Trap":       ["defPumped", ["token", "inertia", 1, "foe"]]
  };
  for(const [nm, [cond, op]] of Object.entries(want)){
    const fx = parse(nm);
    assert.equal(fx.conds.length, 1, nm + ": one gated payload");
    assert.equal(fx.conds[0].cond, cond, nm + ": condition");
    assert.deepEqual(fx.conds[0].op, op, nm + ": payload");
    /* GATED, NEVER UNCONDITIONAL. A payload that leaked into `fx.ops`
       would fire on every play regardless of the attack — the
       COND-BYPASSED shape `npm run fairness` exists to catch. */
    assert.deepEqual(fx.ops, [], nm + ": nothing fires unconditionally");
  }
});

/* ---- THE CONDITION IS ABOUT THE ATTACK COMING AT YOU ------------------ */

test("go again on the incoming attack is what turns Lair of the Spider on", {skip}, () => {
  H.db();
  assert.equal(defendWith("Lair of the Spider", {ga: true}).n.sides[1].marked, true);
  assert.ok(!defendWith("Lair of the Spider", {ga: false}).n.sides[1].marked,
    "and a plain attack leaves the hero unmarked");
});

test("Den of the Spider reads the attack's power against its printed base", {skip}, () => {
  H.db();
  const hot = defendWith("Den of the Spider", {total: 99});
  assert.equal(hot.n.sides[1].marked, true, "pumped above base");
  const cold = defendWith("Den of the Spider", {});
  assert.ok(!cold.n.sides[1].marked, "exactly its base is NOT greater than its base");
});

test("a pend the trap's own seat declared satisfies neither condition", {skip}, () => {
  H.db();
  /* THE HALF THAT WOULD FAIL SILENTLY. A `pend` belongs to whoever
     declared it; drop the ownership test and a trap reads its holder's
     OWN swing and marks the wrong hero — with a payload that looks
     perfectly correct in the feed. */
  for(const nm of ["Lair of the Spider", "Den of the Spider"]){
    const own = defendWith(nm, {by: 0, ga: true, total: 99});
    assert.ok(!own.n.sides[1].marked, nm + ": my own attack is not an attack against me");
    assert.ok(!own.n.sides[0].marked, nm + ": and it certainly does not mark me");
  }
});

test("the payload lands under the ATTACKING hero's control", {skip}, () => {
  H.db();
  const inert = defendWith("Inertia Trap", {total: 99});
  assert.deepEqual(inert.n.sides[1].board.map(b => b.card.name.toLowerCase()), ["inertia"],
    "Inertia is created on the attacker's board, not the defender's");
  assert.deepEqual(inert.n.sides[0].board, [], "and nothing lands on the trap's own side");
});

test("Frailty Trap fires on go again, and its counter is trainer-only today", {skip}, () => {
  H.db();
  const hit = defendWith("Frailty Trap", {ga: true});
  assert.equal(hit.n.sides[0].fra, 1, "the trigger fires and the counter is written");
  assert.ok(!defendWith("Frailty Trap", {ga: false}).n.sides[0].fra,
    "and a plain attack does not");
  /* STATED, NOT HIDDEN: `fra` is read in ONE place — the trainer's
     `foeSwing`, where the swing is a fabricated scalar — so at the table
     the counter is written and never spent. Frailty Trap's TRIGGER is
     built on both boards; its payload is not, and that is the next
     schedule-per-board job rather than something this drill can assert
     away. Bloodrot (`rot`) is the same shape, from three more cards. */
});

/* ---- A DEFENCE REACTION IS NOT A PERMANENT --------------------------- */

test("no Trap resolves into the arena", {skip}, () => {
  H.db();
  for(const nm of TRAPS){
    assert.equal(parse(nm).perm, null, nm + " is a Defense Reaction, not a permanent");
    assert.equal(T.destination(H.card(nm, 1)), "grave", nm + ": types.js has always said so");
  }
  const played = defendWith("Lair of the Spider", {ga: true}).n;
  assert.deepEqual(played.sides[0].board, [],
    "and driven, it does not stay on the board for the rest of the game");
});

test("fx.perm and types.destination agree across the whole pool", {skip}, () => {
  H.db();
  /* THE GUARD THAT WOULD HAVE CAUGHT IT. `fx.perm` decides where a
     resolved card goes and `types.destination` answers the same question
     off the structured array; they disagreed on exactly the four Traps
     and nothing compared them. A card in the wrong zone is invisible to
     every coverage tool, because its TEXT parses perfectly. */
    const a = require("../tools/audit.json");
  const bad = [];
  for(const k of Object.keys(a.cards)){
    const c = a.cards[k];
    const full = H.card(c.name, c.pitch);
    if(!full || !full.ty) continue;
    P.fxReset && P.fxReset();
    const perm = P.fxParse(full).perm;
    const dest = T.destination(full);
    if(perm && dest !== "arena") bad.push(`${c.name} (p${c.pitch}) perm=${perm} dest=${dest}`);
    if(!perm && dest === "arena") bad.push(`${c.name} (p${c.pitch}) perm=null dest=arena`);
  }
  assert.deepEqual(bad, [], "a card whose two readers disagree lands in the wrong zone");
});
