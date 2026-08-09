/* ============================================================
   effects.test.js — the SEAM of the card-semantics port.

   engine/effects.js holds bodies that were closures inside Battle.
   Moving them is only safe while the handover stays honest, so what
   is pinned here is not the bodies (they are ordinary code, drilled
   by parser/game/judge like everything else) but the two ways this
   particular move can rot:

     1. a dependency is added to the module and the trainer's call
        site is not updated — the module then silently captures a
        global, or throws deep inside a card nobody plays for weeks;
     2. someone re-declares a moved function back inside index.html,
        which is the no-mirror rule (v2.20) one layer down.

   Both failure modes are invisible to every other drill here.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* A context whose every value is a distinguishable stub. The point is
   the SHAPE of the handover, not the behaviour of the trainer. */
function stubCtx(over){
  const base = {
    L: (s, msg) => ({...s, log: [msg, ...(s.log || [])], feed: [...(s.feed || []), msg]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => ({lyathBoo: false, runeDmg: 1}),
    bFoe: () => ({lyathBoo: false, runeDmg: 1}),
    built: {runeDmg: 1},
    db: {},
    dummyDefence: s => s,
    foe: s => s.sides[1 - (s.actor || 0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (turn, ...cards) => cards.map(c => ({...c, _gy: turn})),
    gyDisc: (turn, ...cards) => cards.map(c => ({...c, _gy: turn, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s,
    openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "action",
    winCheck: s => s
  };
  return Object.assign(base, over || {});
}

function stubGame(){
  const side = () => ({name: "x", hp: 20, res: 0, ap: 1, amp: 0, ward: 0, awd: 0, buffNext: 0,
    hand: [], deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], counters: {}, hist: {}});
  return {sides: [side(), side()], actor: 0, turn: 1, log: [], feed: []};
}

test("makeEffects REFUSES a missing context key rather than capturing a global", () => {
  for(const k of E.CTX_KEYS){
    const ctx = stubCtx();
    delete ctx[k];
    assert.throws(() => E.makeEffects(ctx), new RegExp(k),
      `dropping ctx.${k} must throw and NAME the key — a silent capture is how a moved body ` +
      `starts reading a global that only exists in the browser`);
  }
  assert.ok(E.makeEffects(stubCtx()), "a complete context builds");
});

/* THE CALL SITE IS THE OTHER HALF. A key added to CTX_KEYS and not to
   the trainer's literal is exactly the drift this port could hide. */
test("index.html hands makeEffects exactly the keys the module declares", () => {
  const m = HTML.match(/DawnEffects\.makeEffects\(\{([^}]*)\}\)/);
  assert.ok(m, "the trainer must build its effects engine with DawnEffects.makeEffects({...})");
  const passed = m[1].split(",").map(s => s.trim().split(":")[0].trim()).filter(Boolean).sort();
  assert.deepEqual(passed, [...E.CTX_KEYS].sort(),
    "the trainer's context literal and engine/effects.js's CTX_KEYS have drifted");
});

/* The no-mirror rule, applied to the moved bodies specifically. */
test("no moved body is re-declared inside index.html", () => {
  for(const fn of ["runOps", "execute"]){
    const re = new RegExp("(?:const|let|var|function)\\s+" + fn + "\\s*=\\s*\\(s", "g");
    assert.equal((HTML.match(re) || []).length, 0,
      `${fn} is defined again in index.html — that is two copies of the card semantics, ` +
      `which is the state v2.20 deleted 51 duplicated definitions to escape`);
    assert.ok(new RegExp("const " + fn + " = _EFX\\." + fn + ";").test(HTML),
      `the trainer must take ${fn} from the module`);
  }
  /* resolveStack keeps a React wrapper in the trainer — it is a reducer the
     UI calls, so `setG` stays behind while the BODY lives in the module. */
  assert.ok(!/const resolveStack = \(\) => setG\(s=>\{/.test(HTML),
    "resolveStack's body is back in index.html — that is two copies again");
  assert.match(HTML, /const resolveStack = \(\) => setG\(_EFX\.resolveStack\);/,
    "the trainer must hand setG the module's pure body");
  assert.match(E.makeEffects(stubCtx()).resolveStack.toString(), /^\(?s\)? *=>|^function/,
    "and the module's resolveStack must be a plain state function, not a reducer");
});

/* A behavioural smoke test: the moved body still runs, still returns a NEW
   state, and still routes to the acting seat rather than to seat 0. The
   second half is the actor/perspective rule, and it is the one a port can
   break invisibly while every solo game keeps passing. */
test("runOps runs, and it writes to the ACTOR, not to seat 0", () => {
  const {runOps} = E.makeEffects(stubCtx());
  const g = stubGame();
  g.actor = 1;                       // seat 1 is resolving
  const out = runOps(g, [["res", 2], ["ward", 1]], "probe");
  assert.notEqual(out, g, "runOps must not return the same object it was handed");
  assert.equal(out.sides[1].res, 2, "the resource went to the acting seat");
  assert.equal(out.sides[0].res, 0, "seat 0 must be untouched when seat 1 is acting");
  assert.equal(out.sides[1].ward, 1);
  assert.equal(g.sides[1].res, 0, "the input state must not be mutated");
});

test("runOps damages the FOE of the actor", () => {
  const {runOps} = E.makeEffects(stubCtx());
  const g = stubGame();
  g.actor = 1;
  const out = runOps(g, [["dmg", 3]], "probe");
  assert.equal(out.sides[0].hp, 17, "seat 1 acting means seat 0 takes the damage");
  assert.equal(out.sides[1].hp, 20);
});
