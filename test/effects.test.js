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
     UI calls, so `setG` stays behind while the BODY lives in the module.
     v2.73 gave that wrapper one more job: the module no longer says what
     phase the game is in when a link resolves, so the trainer says
     `mode:"act"` (CR 7.6.3 hands priority back to the turn-player). The
     guard is still that the BODY is the module's — a wrapper that
     delegates is fine, a wrapper that reimplements is the thing v2.20
     deleted 51 duplicated definitions to escape. */
  assert.ok(!/const resolveStack = \(\) => setG\(s=>\{[\s\S]{200}/.test(HTML),
    "resolveStack's body is back in index.html — that is two copies again");
  assert.match(HTML, /_EFX\.resolveStack\(s\)|_EFX\.resolveStack\)/,
    "the trainer must call the module's pure body, not its own");
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

/* ---- THE LAST SEAT-0 READ (v2.77) ------------------------------------
   `built` was the one context key that named a SEAT rather than a role:
   seat 0's build, captured for the UI, read at four rules sites inside
   `execute`. v2.41 fixed exactly this shape for the hero passives and
   said so — "a passive read as `built.X` inside a rules function is the
   bug this fixed" — and these four were left behind because moving them
   was a behaviour change and the port's rule was that bodies move
   unrewritten.

   It comes off now because judge.js is about to build this context, and
   a key meaning "seat 0" is a seat-0 rules read written into a caller
   that does not have one yet.

   THE DRILL DRIVES IT rather than grepping for `built`: a grep is
   satisfied by whatever survives deleting the gate, and here the gate is
   an arithmetic operand. Seat 1 swings with runechants whose token deals
   THREE, and seat 0 must lose 6 — a version reading seat 0's build reads
   1 and deals 2. */
test("a runechant pops for the ACTOR's printed damage, not seat 0's", () => {
  const runechant = () => ({card: {name: "Runechant", tt: "Runeblade Token - Aura",
                                   tx: "When you play an attack action card or activate a weapon attack, "
                                     + "destroy this and deal 1 arcane damage to target opposing hero.",
                                   uid: "rune1"}, kind: "aura", uid: "rune1"});
  const swing = {name: "Merge Probe Swing", tt: "Generic Attack Action", tx: "", kw: [],
                 power: 4, pitch: 1, cost: 0, uid: 501};

  /* Two DIFFERENT builds, so "which build answered" is observable. */
  const builds = [{runeDmg: 1}, {runeDmg: 3}];
  const {execute} = E.makeEffects(stubCtx({
    bAct: g => builds[g.actor || 0],
    bFoe: g => builds[1 - (g.actor || 0)]
  }));

  const g = stubGame();
  g.actor = 1;                                  // SEAT 1 is swinging
  g.chain = []; g.stack = []; g.hitSeq = 0;
  g.sides[1].hand = [swing];
  g.sides[1].board = [runechant(), runechant()];
  g.sides[1].hist = {atk: 0, non: 0};

  const out = execute(g, swing, "hand", 0);
  assert.equal(out.sides[1].board.filter(b => b.card.name === "Runechant").length, 0,
    "both tokens destroy themselves on the play — mandatorily, there is no 'you may'");
  assert.equal(out.sides[0].hp, 14,
    "two Runechants at the ACTOR's printed 3 each = 6. Reading seat 0's build gives 1 each " +
    "and 2 damage, which is the v2.41 bug wearing the one context key that still named a seat.");
});

test("`built` is off the context — nothing in effects.js may name a seat", () => {
  /* A ledger, like CTX_KEYS itself. Putting it back is allowed, but it
     has to be a deliberate edit here, because every key on that list is
     another thing judge.js must supply before it can drive card text. */
  assert.ok(!E.CTX_KEYS.includes("built"),
    "`built` means seat 0. The rules ask `bAct`; only the UI asks `built`, and the UI is " +
    "not this module.");

  /* DRIVEN, not grepped. A scan for the identifier is answered by the
     English word sitting in a comment ("a state built without the
     priority fields") — rule 4b, in the direction that makes a working
     drill fail. So hand it a `built` that would be LOUD if anything read
     it, and prove the state comes out identical. */
  const loud = E.makeEffects(stubCtx({built: {runeDmg: 99}}));
  const quiet = E.makeEffects(stubCtx());
  const probe = () => {
    const g = stubGame();
    g.actor = 0; g.chain = []; g.stack = []; g.hitSeq = 0;
    g.sides[0].board = [{card: {name: "Runechant", tt: "Runeblade Token - Aura", tx: "", uid: "r"},
                         kind: "aura", uid: "r"}];
    g.sides[0].hist = {atk: 0, non: 0};
    return g;
  };
  const swing = {name: "Merge Probe Swing II", tt: "Generic Attack Action", tx: "", kw: [],
                 power: 4, pitch: 1, cost: 0, uid: 502};
  const a = loud.execute(probe(), swing, "hand", 0);
  const b = quiet.execute(probe(), swing, "hand", 0);
  assert.equal(a.sides[1].hp, b.sides[1].hp,
    "a `built` in the context must change nothing — if 99 shows up in the damage, a rules " +
    "site is still reading seat 0's build");
  assert.equal(b.sides[1].hp, 19, "one runechant, one point (the stub build's default)");
});
