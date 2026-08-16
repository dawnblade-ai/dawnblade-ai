/* ============================================================
   THE MERGE SEAM — can judge.js drive effects.js? (v2.76)

   The plan in HANDOFF-MERGE.md rests on one property, and this file is it:

     `effects.js` is written in the trainer's MUTABLE idiom
     (`actMut(n).hp -= 4`), and `judge.js` is purely functional
     (`put(g, i, s => ({...s, hp: s.hp-4}))`). For judge to call effects at
     its DEFEND and RESOLUTION steps, handing effects a shallow clone must
     be SAFE — effects must mutate only its own copy and hand back a new
     state, leaving everything the caller still holds untouched.

   That is exactly what `Battle` already relies on through `setG`, so it
   ought to be true. "Ought to be true" is how this project has been bitten
   before, and it is the assumption an entire phase of work is about to be
   built on — so it is pinned here BEFORE anything depends on it, and it
   has to keep being true as effects.js grows.

   The second half pins that judge.js really does already export the
   accessors effects.js needs. That is the finding that made the merge
   tractable (the old handoff estimated it as the biggest remaining seam);
   if an export is renamed, the plan needs re-costing and this drill is
   where that surfaces.

   NOTHING HERE WIRES THE TWO TOGETHER. It measures the seam.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");

const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const RNG = require("../engine/rng.js");

/* A context built ONLY out of names judge.js already exports, or trivial
   one-liners over them. If this can be assembled, judge can assemble it. */
function judgeShapedCtx(){
  return {
    L: (g, m) => m == null ? g : ({...g, log: [m, ...(g.log || [])], feed: [...(g.feed || []), m]}),
    act: g => g.sides[g.actor || 0],
    actorOf: g => g.actor || 0,
    foe: g => g.sides[1 - (g.actor || 0)],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    bAct: g => (g.builds || [])[g.actor || 0] || {runeDmg: 1},
    bFoe: g => (g.builds || [])[1 - (g.actor || 0)] || {runeDmg: 1},
    built: {runeDmg: 1},
    db: {},
    dummyDefence: s => ({n: s, note: ""}),
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s,
    openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "action",
    winCheck: s => s
  };
}
const side = o => Object.assign({
  name: "x", hp: 20, res: 9, ap: 1, amp: 0, ward: 0, awd: 0, arcShield: 0,
  hand: [], deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], gear: [],
  arsenal: null, counters: {}, weaponUsed: {}, hist: {}
}, o || {});
/* Shaped the way judge.js holds a game: `actor`, `sides`, `builds`,
   `tokSeq`, `rng` — the fields it already carries. */
const judgeState = () => ({
  sides: [side({}), side({})], actor: 0, turn: 2, tokSeq: 0,
  builds: [{runeDmg: 1}, {runeDmg: 1}],
  log: [], feed: [], chain: [], stack: [], promptQ: [], rng: RNG.make("merge")
});

/* ---- THE PROPERTY THE PLAN RESTS ON ----------------------------------- */

test("effects.js can be built from a judge-shaped context", () => {
  const fx = E.makeEffects(judgeShapedCtx());
  for(const k of ["runOps", "execute", "afterDefenders", "resolveStack"]){
    assert.equal(typeof fx[k], "function", `${k} must be reachable — judge calls it`);
  }
});

test("a shallow clone into effects leaves the CALLER's state untouched", () => {
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["arcane", 5]], "probe");

  assert.notEqual(out.sides[1].hp, g.sides[1].hp, "the result must actually differ, or this proves nothing");
  assert.equal(out.sides[1].hp, 15);
  assert.equal(JSON.stringify(g), before,
    "THE WHOLE MERGE RESTS ON THIS. effects.js writes through actMut/foeMut, which clone " +
    "`sides` and the side themselves before handing back a mutable object — so a caller " +
    "that passes {...g} and takes the result is safe. judge.reduce is pure and must stay " +
    "pure; if this ever fails, judge cannot call effects without a deep copy.");
});

test("it holds for a write to the ACTOR's own side too, not just the foe's", () => {
  /* foeMut and actMut are separate paths; a drill that only ever exercises
     one of them proves half the property. */
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["res", 3]], "probe");
  assert.equal(out.sides[0].res, 12, "the actor gained resources");
  assert.equal(JSON.stringify(g), before, "and the caller's copy is untouched");
});

test("nested state survives the round trip — the clone is deep ENOUGH", () => {
  /* `hist` and `counters` are objects on the side. effects.js replaces them
     wholesale ({...act(n).hist, …}) rather than mutating in place; if that
     discipline ever slips, the caller's nested object is corrupted and no
     top-level JSON compare of `sides` would necessarily catch which one. */
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  g.sides[0].hist = {atk: 0, arc: 0};
  const histRef = g.sides[0].hist;
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["arcane", 1]], "probe");
  assert.equal(out.sides[0].hist.arc, 1, "the arcane was credited on the way out");
  assert.equal(histRef.arc, 0, "and the caller's own hist object was not written through");
  assert.equal(JSON.stringify(g), before);
});

/* ---- WHAT JUDGE ALREADY BRINGS ---------------------------------------- */

test("judge.js already exports the accessors effects.js needs", () => {
  /* This is the finding that re-costed the merge. The old handoff called
     the context "the next seam of the same kind dummyDefence was, and it is
     bigger"; in fact judge.js already carries the same actor discipline
     under these names. If one is renamed, re-cost the plan. */
  for(const k of ["actorOf", "act", "foe", "at", "put", "bAct", "bOf", "say", "toGrave", "mint"]){
    assert.equal(typeof J[k], "function", `judge.${k} is what effects.js's context is built from`);
  }
});

test("judge's act/foe are ACTOR-relative, matching effects.js exactly", () => {
  const g = {sides: [{name: "zero"}, {name: "one"}], actor: 0, turnPlayer: 0};
  assert.equal(J.act(g).name, "zero");
  assert.equal(J.foe(g).name, "one");
  const flipped = {...g, actor: 1};
  assert.equal(J.act(flipped).name, "one",
    "act follows the ACTOR, not the seat — this is the v2.24 split, and effects.js " +
    "depends on it meaning the same thing on both sides of the merge");
  assert.equal(J.foe(flipped).name, "zero");
});

test("judge has no you()/opp() — perspective is not a rules question", () => {
  assert.equal(J.you, undefined,
    "`you` means seat 0, which asks whose SCREEN this is. No rule has ever wanted it, and " +
    "reintroducing it here is how the actor/perspective split gets undone.");
  assert.equal(J.opp, undefined);
});

/* ---- THE LEDGER ------------------------------------------------------- */

test("the context is still 17 keys — a new one is a new thing judge must supply", () => {
  assert.equal(E.CTX_KEYS.length, 17,
    "every key added to effects.js is another dependency judge.js has to satisfy before it " +
    "can drive the card semantics. Moving this number should be a deliberate edit.");
  /* `dummyDefence` came OFF this list in v2.73 and must not come back: it
     is what made effects callable only by a caller that owns a dummy.
     `built` came off in v2.77 for the neighbouring reason — it was the
     last key that named a SEAT rather than a role, so supplying it meant
     writing seat 0 into judge.js's brand-new caller. */
  for(const gone of ["dummyDefence", "built"]){
    assert.ok(!E.CTX_KEYS.includes(gone),
      "`" + gone + "` came off this list on purpose — putting it back re-closes a door " +
      "this merge walks through");
  }
});
