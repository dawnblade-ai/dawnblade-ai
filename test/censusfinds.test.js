/* ============================================================
   THREE SENTENCES AN UNANCHORED MATCH HAD HALF-READ (v4.83)

   v4.82 anchored the plain draw and wrote v4.21's rule down again: when
   you fix one member, census the family. The census instruments every
   `c.match` inside `classifyClause` and records, for each pool clause that
   reads `run`, whether the match that produced it covered the sentence.
   Most of what it reports is a target or a window legitimately left to
   another reader. Three were not, and every one read `tier: full`:

     Aether Spindle            "Opt X, where X is the damage dealt by this"
                               read `m[1]==="x" ? 1` — X was ONE, whatever
                               the card dealt
     Spectral Manifestations   "…token, then if you control no other
                               Illusionist auras, put three +1{p} counters
                               on it" — the generic token rule stopped at the
                               comma and minted a bare Shield
     The Suspense is Killing Me "Your first attack each turn gets +1{p}" — a
                               STANDING static on an aura, read as an op that
                               fired once, when the aura was played
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const J = H.J;
const P = require("../engine/parser.js");
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached card database";
const mk = (n, p, u) => Object.assign({}, H.card(n, p), {uid: u});
const van = (u, pow) => ({uid: u, name: "Probe " + u, pitch: 1, power: pow == null ? 3 : pow, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const deck = k => Array.from({length: k}, (_, i) => van("d" + i));

let n;
function table(mine, theirs){
  n = H.state(Object.assign({name: "Probe", res: 9, ap: 1}, mine),
              Object.assign({name: "Them", hp: 30, hand: [], deck: [{uid: "t1", name: "T"}]}, theirs),
              {actor: 0, turnPlayer: 0, turn: 3, seed: "censusfinds"});
  n = Object.assign(n, {phase: "action", step: "layer", priority: 0, passed: []});
}
const R = (a, seat) => {
  const r = J.reduce(n, a, seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  n = r.state;
};
/* play and pass only until something asks */
const play = uid => {
  R({t: "play", uid, from: "hand"}, 0);
  for(let i = 0; i < 6 && !n.prompt && (n.stack || []).length; i++) R({t: "pass"}, n.priority);
};
const ctrOn = (sd, uid) => ((sd.counters || {})[uid] || {}).pow || 0;

/* ---- 1. AETHER SPINDLE: X IS WHAT IT DEALT ----------------------------- */

test("\"opt X, where X is the damage dealt by this\" is a way:dealt gate, not opt 1", () => {
  assert.deepEqual(P.classifyClause("opt x, where x is the damage dealt by this"),
    {status: "run", ops: [["opt", "dealt"]], cond: "way:dealt"});
  assert.deepEqual(P.classifyClause("opt 2").ops, [["opt", 2]], "a printed number still reads");
  assert.equal(P.classifyClause("opt x"), null, "an X this reader cannot count is not a 1");
});

test("DRIVEN: Aether Spindle deals 4, so it opts FOUR", {skip}, () => {
  H.db();
  table({name: "Iyslander", hand: [mk("Aether Spindle", 1, "as")], deck: deck(6)});
  play("as");
  assert.equal(n.sides[1].hp, 26);
  assert.equal(n.prompt && n.prompt.tag, "opt");
  assert.equal(n.prompt.cards.length, 4, "X is the damage dealt — before v4.83 it was always 1");
});

test("DRIVEN: prevented in part, X is what got through; prevented whole, nothing to opt", {skip}, () => {
  H.db();
  table({name: "Iyslander", hand: [mk("Aether Spindle", 1, "as")], deck: deck(6)}, {ward: 1});
  play("as");
  assert.equal(n.sides[1].hp, 27);
  assert.equal(n.prompt && n.prompt.cards.length, 3, "four printed, one prevented: opt 3");
  table({name: "Iyslander", hand: [mk("Aether Spindle", 1, "as")], deck: deck(6)}, {ward: 9});
  play("as");
  assert.equal(n.sides[1].hp, 30);
  assert.ok(!n.prompt, "no damage dealt (CR 7.5.5), so no opt at all — the old reading opted one");
});

test("DRIVEN: through an arcane barrier, X waits for the sheet and takes its answer", {skip}, () => {
  H.db();
  const run = soak => {
    table({name: "Iyslander", hand: [mk("Aether Spindle", 1, "as")], deck: deck(6)},
          {res: 3, gear: [mk("Nullrune Hood", 0, "g1")]});
    play("as");
    assert.equal(n.prompt && n.prompt.tag, "soak", "the barrier is offered first");
    if(soak) R({t: "promptSel", i: 0}, 1);
    R({t: "promptConfirm"}, 1);
    return n;
  };
  const took = run(false);
  assert.equal(took.sides[1].hp, 26);
  assert.equal(took.prompt && took.prompt.tag, "opt");
  assert.equal(took.prompt.cards.length, 4, "declined: all four landed, opt 4");
  const soaked = run(true);
  assert.equal(soaked.sides[1].hp, 27);
  assert.equal(soaked.prompt && soaked.prompt.cards.length, 3, "one soaked: opt 3");
});

/* ---- 2. SPECTRAL MANIFESTATIONS: THE COUNTERS, AND THE GATE ------------ */

test("the token rule refuses a tail it cannot read — the comma no longer ends the sentence", () => {
  assert.equal(P.classifyClause("create a gold token, then draw a card"), null);
  const sm = P.classifyClause("create a spectral shield token, then if you control no other illusionist auras, put two +1{p} counters on it");
  assert.deepEqual(sm.ops, [["token", "spectral shield", 1, "self",
    {ctr: {kind: "pow", n: 2, label: "+1{p}"}, ctrIf: {noOther: "illusionist"}}]]);
  /* the tails the pool does print still read */
  assert.equal(P.classifyClause("create a bloodrot pox token under their control").ops[0][3], "foe");
  assert.deepEqual(P.classifyClause("create a frostbite token in an exposed head, chest, arms, or legs zone").ops[0][4], {zone: "exposed"});
  assert.equal(P.classifyClause("create a spectral shield token with a +1{p} counter").ops[0][4].ctr.n, 1);
});

test("DRIVEN: alone, the Shield enters with the printed counters — THREE / TWO / ONE by pitch", {skip}, () => {
  H.db();
  for(const [p, want] of [[1, 3], [2, 2], [3, 1]]){
    table({name: "Enigma", hand: [mk("Spectral Manifestations", p, "sm")]});
    play("sm");
    const sh = n.sides[0].board.find(b => /spectral shield/i.test(b.card.name));
    assert.ok(sh, "the Shield is on the board");
    assert.equal(ctrOn(n.sides[0], sh.uid), want, "pitch " + p + ": the counters the generic rule dropped");
    assert.deepEqual(INV.errors(n), []);
  }
});

test("DRIVEN: another Illusionist aura on the board — no counters; a Runeblade aura does not count", {skip}, () => {
  H.db();
  const shield = Object.assign({}, H.card("Spectral Shield", 0), {uid: "pre"});
  table({name: "Enigma", hand: [mk("Spectral Manifestations", 1, "sm")],
         board: [{card: shield, kind: "token", spent: false, uid: "pre"}]});
  play("sm");
  const made = n.sides[0].board.find(b => /spectral shield/i.test(b.card.name) && b.uid !== "pre");
  assert.ok(made);
  assert.equal(ctrOn(n.sides[0], made.uid), 0, "\"no OTHER Illusionist auras\" is false — no counters");
  const rune = Object.assign({}, H.card("Runechant", 0), {uid: "rc"});
  table({name: "Enigma", hand: [mk("Spectral Manifestations", 1, "sm")],
         board: [{card: rune, kind: "token", spent: false, uid: "rc"}]});
  play("sm");
  const sh = n.sides[0].board.find(b => /spectral shield/i.test(b.card.name));
  assert.equal(ctrOn(n.sides[0], sh.uid), 3, "a Runechant is an aura, but not an ILLUSIONIST one");
});

/* ---- 3. THE SUSPENSE IS KILLING ME: EVERY TURN, THE FIRST ATTACK ------- */

const suspense = () => ({card: Object.assign({}, H.card("The Suspense is Killing Me", 0), {uid: "sus"}),
  kind: "aura", spent: false, uid: "sus"});

test("it is a standing static, not an op fired on play", {skip}, () => {
  P.fxReset && P.fxReset();
  const fx = P.fxParse(H.card("The Suspense is Killing Me", 0));
  assert.equal(fx.firstAtk, 1);
  assert.equal(fx.ops.some(o => o[0] !== "noop"), false, "nothing fires when it is played");
});

test("DRIVEN: the turn's first attack gets +1{p}, and the second does not", {skip}, () => {
  H.db();
  table({name: "Lyath", ap: 2, board: [suspense()], hand: [van("a1"), van("a2")]});
  R({t: "play", uid: "a1", from: "hand"}, 0);
  assert.equal(n.pend.total, 4, "first attack: 3 + 1");
  for(let i = 0; i < 12 && n.pend; i++) R({t: "pass"}, n.priority);
  assert.equal(n.sides[1].hp, 26);
  R({t: "play", uid: "a2", from: "hand"}, 0);
  assert.equal(n.pend.total, 3, "second attack this turn: no bonus");
});

test("DRIVEN: …and on a LATER turn it applies again — the half the one-shot never did", {skip}, () => {
  H.db();
  table({name: "Lyath", board: [suspense()], hand: [van("a1")]});
  n.sides[0].hist = Object.assign({}, n.sides[0].hist, {atk: 0});
  n = Object.assign({}, n, {turn: 7});
  R({t: "play", uid: "a1", from: "hand"}, 0);
  assert.equal(n.pend.total, 4);
});

test("DRIVEN: two copies are two grants", {skip}, () => {
  H.db();
  const two = [suspense(), Object.assign(suspense(), {uid: "sus2"})];
  two[1].card = Object.assign({}, two[1].card, {uid: "sus2"});
  table({name: "Lyath", board: two, hand: [van("a1")]});
  R({t: "play", uid: "a1", from: "hand"}, 0);
  assert.equal(n.pend.total, 5);
});

test("an opt whose X was never counted opts nothing — a wire guard, driven synthetically", () => {
  /* Both paths that hold the trace resolve `dealt` before `runOps` sees it,
     so no pool card reaches this; `reduce` is fed JSON off a wire (v2.04),
     and an uncounted X read as anything but zero is the v4.83 defect. */
  for(const v of ["dealt", 0, -2]){
    const out = H.runOps(H.state({deck: deck(4)}, {}), [["opt", v]], "Probe");
    assert.equal((out.promptQ || []).length, 0, JSON.stringify(v) + " opted something");
  }
  const ok = H.runOps(H.state({deck: deck(4)}, {}), [["opt", 2]], "Probe");
  assert.equal(ok.promptQ.length, 1, "the control: a counted X still opts");
});
