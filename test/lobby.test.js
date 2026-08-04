/* THE LOBBY — the pre-game negotiation, drilled for the property that
   lets it exist outside net.js.

   net.js needs a sequencer because CR 7.3.2 lets both seats act at the
   same instant. The lobby claims it does not, on the grounds that every
   slot is write-once and the writes commute. That is an argument, and an
   argument is not a drill — so the first two tests here enumerate every
   permutation of a full negotiation and assert one outcome, and then
   replay every message to assert nothing moves.

   If either ever fails, the lobby needs a sequencer and the claim in the
   module header is wrong. */
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../engine/lobby.js");
const fs = require("fs");
const path = require("path");

const CODE = "K7QM";
const mk = () => L.newLobby({code: CODE});

/* Drive a message list through a fresh lobby. Refusals are collected
   rather than thrown so a test can assert on them. */
function run(msgs, s0){
  let s = s0 || mk();
  const errs = [];
  for(const m of msgs){
    const r = L.reduce(s, m);
    if(r.error) errs.push({m, ...r.error});
    s = r.state;
  }
  return {s, errs};
}

/* A complete negotiation, in causal order. Seat 0 wins the throw with
   paper over rock and elects to go first. */
const FULL = [
  L.hello(0, "sage-v11"), L.hello(1, "sage-v11"),
  L.hero(0, "kayo"),      L.hero(1, "dorinthea"),
  L.throwIt(0, 0, "paper"), L.throwIt(1, 0, "rock"),
  L.seating(0, "first"),
  L.sideboard(0, [1, 3], {2: 1}), L.sideboard(1, [0], {})
];

/* Every ordering that respects causality. A throw cannot be answered
   before it is thrown in the sense that matters here — both throws are
   independent — but the SEAT call genuinely depends on the throw having
   resolved, and a board on the seating. So permute within each stage and
   keep the stages in order: that is exactly the concurrency a real
   channel can produce. */
function* perms(arr){
  if(arr.length <= 1){ yield arr.slice(); return; }
  for(let i = 0; i < arr.length; i++){
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for(const p of perms(rest)) yield [arr[i], ...p];
  }
}

test("ORDER CANNOT MATTER: every interleaving of a negotiation lands in one state", () => {
  const stages = [
    [L.hello(0, "sage-v11"), L.hello(1, "sage-v11")],
    [L.hero(0, "kayo"), L.hero(1, "dorinthea")],
    [L.throwIt(0, 0, "paper"), L.throwIt(1, 0, "rock")],
    [L.seating(0, "first")],
    [L.sideboard(0, [1, 3], {2: 1}), L.sideboard(1, [0], {})]
  ];
  const want = JSON.stringify(run(FULL).s);
  let seen = 0;
  /* Cartesian product of each stage's permutations. 2*2*2*1*2 = 16
     orderings — small, and it is the whole space that matters. */
  const walk = (i, acc) => {
    if(i === stages.length){
      const {s, errs} = run(acc);
      assert.deepEqual(errs, [], "a legal interleaving was refused: " + JSON.stringify(errs));
      assert.equal(JSON.stringify(s), want, "interleaving diverged: " + acc.map(m => m.t + m.seat).join(" "));
      seen++;
      return;
    }
    for(const p of perms(stages[i])) walk(i + 1, acc.concat(p));
  };
  walk(0, []);
  assert.equal(seen, 16, "the permutation walk stopped driving — it proved nothing");
});

test("IDEMPOTENT: replaying every message changes nothing", () => {
  const {s} = run(FULL);
  const before = JSON.stringify(s);
  const {s: after, errs} = run(FULL, s);
  assert.equal(JSON.stringify(after), before, "a replayed message moved the state");
  assert.equal(errs.length, FULL.length, "a replay should be refused, not silently applied");
  assert.ok(errs.every(e => e.dup), "a replay must be flagged as a duplicate, not a fault: "
    + JSON.stringify(errs.filter(e => !e.dup)));
});

test("the state is returned UNCHANGED on a refusal", () => {
  const {s} = run([L.hero(0, "kayo")]);
  const before = JSON.stringify(s);
  const r = L.reduce(s, L.hero(0, "bravo"));
  assert.ok(r.error, "a second hero pick must be refused");
  assert.equal(JSON.stringify(r.state), before);
});

/* ---- the step is derived ---------------------------------------------- */

test("the step walks hero -> throw -> seat -> board -> ready", () => {
  const seen = [];
  let s = mk();
  seen.push(L.stepOf(s));
  for(const m of FULL){ s = L.reduce(s, m).state; seen.push(L.stepOf(s)); }
  assert.deepEqual([...new Set(seen)], ["hero", "throw", "seat", "board", "ready"]);
});

test("the step is a function of the slots, never a stored field", () => {
  const s = run(FULL).s;
  assert.equal(s.step, undefined, "storing a step reintroduces a transition, and a transition has an order");
  assert.equal(L.stepOf(s), "ready");
});

/* ---- write-once, the property the whole design rests on ---------------- */

test("WRITE-ONCE: a hero, a throw, a seating and a board each land once", () => {
  let s = run([L.hero(0, "kayo")]).s;
  assert.ok(L.reduce(s, L.hero(0, "bravo")).error.dup, "hero is write-once");

  s = run([L.hero(0, "kayo"), L.hero(1, "bravo"), L.throwIt(0, 0, "rock")]).s;
  assert.ok(L.reduce(s, L.throwIt(0, 0, "paper")).error.dup, "a throw is write-once per round");

  s = run(FULL.slice(0, 7)).s;                       /* through the seating */
  assert.ok(L.reduce(s, L.seating(0, "second")).error.dup, "seating is write-once");

  s = run(FULL).s;
  assert.ok(L.reduce(s, L.sideboard(0, [9], {})).error.dup, "a board is write-once");
});

test("a hero cannot be changed after both seats have chosen", () => {
  const s = run([L.hero(0, "kayo"), L.hero(1, "bravo")]).s;
  const r = L.reduce(s, L.hero(0, "azalea"));
  assert.ok(r.error, "the step has closed");
  assert.deepEqual(r.state.heroes, ["kayo", "bravo"]);
});

/* ---- the card-data check ---------------------------------------------- */

test("mismatched card data FAULTS the lobby before a card is resolved", () => {
  const {s} = run([L.hello(0, "sage-v11"), L.hello(1, "sage-v10")]);
  assert.equal(L.stepOf(s), "fault");
  assert.match(s.fault, /card data differs/);
  assert.match(s.fault, /sage-v11/);
  assert.match(s.fault, /sage-v10/);
});

test("a faulted lobby refuses everything and cannot be driven past it", () => {
  const {s} = run([L.hello(0, "a"), L.hello(1, "b")]);
  for(const m of [L.hero(0, "kayo"), L.throwIt(0, 0, "rock"), L.seating(0, "first"), L.sideboard(0, [], {})]){
    const r = L.reduce(s, m);
    assert.ok(r.error, m.t + " was accepted by a faulted lobby");
    assert.equal(L.stepOf(r.state), "fault");
  }
});

test("both peers reach the SAME fault, in either order", () => {
  const a = run([L.hello(0, "sage-v11"), L.hello(1, "sage-v10")]).s;
  const b = run([L.hello(1, "sage-v10"), L.hello(0, "sage-v11")]).s;
  assert.equal(a.fault, b.fault, "a fault that reads differently on two phones is two bugs");
});

/* ---- the throw --------------------------------------------------------- */

test("a tie replays: the round advances and both throws clear", () => {
  const {s} = run([L.hero(0, "kayo"), L.hero(1, "bravo"),
                   L.throwIt(0, 0, "rock"), L.throwIt(1, 0, "rock")]);
  assert.equal(s.winner, null, "a tie has no winner");
  assert.equal(s.round, 1);
  assert.equal(s.ties, 1);
  assert.deepEqual(s.throws, [null, null]);
  assert.equal(L.stepOf(s), "throw");
});

test("a stale-round throw is refused rather than landing in the next round", () => {
  const {s} = run([L.hero(0, "kayo"), L.hero(1, "bravo"),
                   L.throwIt(0, 0, "rock"), L.throwIt(1, 0, "rock")]);
  const r = L.reduce(s, L.throwIt(0, 0, "paper"));
  assert.ok(r.error, "a round-0 throw must not be accepted in round 1");
  assert.ok(r.error.dup);
  assert.deepEqual(r.state.throws, [null, null]);
});

test("the throw resolves the same way whichever throw arrives first", () => {
  const a = run([L.hero(0, "k"), L.hero(1, "b"), L.throwIt(0, 0, "paper"), L.throwIt(1, 0, "rock")]).s;
  const b = run([L.hero(0, "k"), L.hero(1, "b"), L.throwIt(1, 0, "rock"), L.throwIt(0, 0, "paper")]).s;
  assert.equal(a.winner, 0);
  assert.equal(a.winner, b.winner);
  assert.deepEqual(a.rounds, b.rounds);
});

/* THE FIELD IS `pick`, AND THAT IS NOT COSMETIC. Every message carries
   `v` as the lobby version. Naming the throw value `v` too shadowed it in
   the message literal, so the version guard compared "paper" against 1
   and refused every throw ever made — the whole game unreachable, from
   one letter. Same-name-different-meaning, which is the trap
   test/sync.test.js polices for the engine's globals. */
test("a throw carries `pick`, and `v` stays the lobby version", () => {
  const m = L.throwIt(0, 0, "rock");
  assert.equal(m.pick, "rock");
  assert.equal(m.v, L.LOBBY_V, "the throw value must not shadow the version field");
});

test("a throw that is not a throw is refused, and is not a duplicate", () => {
  const s = run([L.hero(0, "k"), L.hero(1, "b")]).s;
  const r = L.reduce(s, L.throwIt(0, 0, "dynamite"));
  assert.ok(r.error && !r.error.dup, "a malformed throw is a fault in the sender, not a replay");
});

/* ---- the seating call -------------------------------------------------- */

test("THE WINNER CHOOSES — and the loser cannot call it", () => {
  const s = run(FULL.slice(0, 6)).s;                 /* seat 0 won the throw */
  assert.equal(s.winner, 0);
  const bad = L.reduce(s, L.seating(1, "first"));
  assert.ok(bad.error, "the loser called the seating");
  assert.match(bad.error.why, /did not win/);
  assert.equal(bad.state.first, null);
});

test("the winner may elect to go SECOND, and it seats the other player", () => {
  let s = run(FULL.slice(0, 6)).s;
  s = L.reduce(s, L.seating(0, "second")).state;
  assert.equal(s.first, 1, "electing second must hand the first turn over, not take it");
});

test("a seating call that is neither first nor second is refused", () => {
  const s = run(FULL.slice(0, 6)).s;
  const r = L.reduce(s, L.seating(0, "whenever"));
  assert.ok(r.error && !r.error.dup);
  assert.equal(r.state.first, null);
});

/* ---- the board --------------------------------------------------------- */

test("a board is NORMALISED on the way in, so two peers hold one spec", () => {
  let s = run(FULL.slice(0, 7)).s;
  s = L.reduce(s, L.sideboard(0, [3, 1, 1], {"2": 1, "bad": 4, "5": 0, "6": -2})).state;
  assert.deepEqual(s.boards[0].gearIdx, [1, 1, 3], "gear picks must arrive sorted");
  assert.deepEqual(s.boards[0].cuts, {"2": 1},
    "a non-numeric key, a zero and a negative would each build a different deck on one phone");
});

test("a board with no gear list is refused", () => {
  const s = run(FULL.slice(0, 7)).s;
  assert.ok(L.reduce(s, {t: "board", v: L.LOBBY_V, seat: 0, cuts: {}}).error);
});

/* ---- the handoff ------------------------------------------------------- */

test("matchSpec is null until every slot is filled", () => {
  let s = mk();
  for(const m of FULL.slice(0, FULL.length - 1)){
    assert.equal(L.matchSpec(s), null, "a half-negotiated lobby must not start a match");
    s = L.reduce(s, m).state;
  }
  assert.equal(L.matchSpec(s), null);
  s = L.reduce(s, FULL[FULL.length - 1]).state;
  assert.ok(L.matchSpec(s), "a complete lobby must hand off");
});

test("matchSpec carries the two heroes, the two boards, the seating and the seed", () => {
  const spec = L.matchSpec(run(FULL).s);
  assert.deepEqual(spec.heroes, ["kayo", "dorinthea"]);
  assert.equal(spec.first, 0);
  assert.equal(spec.seed, CODE, "the table code is the match seed");
  assert.deepEqual(spec.boards[0].gearIdx, [1, 3]);
  assert.deepEqual(spec.boards[1].cuts, {});
  assert.equal(spec.build, "sage-v11");
});

test("matchSpec is a COPY — mutating it cannot reach the lobby", () => {
  const s = run(FULL).s;
  const spec = L.matchSpec(s);
  spec.heroes[0] = "tampered";
  spec.boards[0].gearIdx.push(99);
  spec.boards[0].cuts.hacked = 1;
  assert.deepEqual(s.heroes, ["kayo", "dorinthea"]);
  assert.deepEqual(s.boards[0].gearIdx, [1, 3]);
  assert.deepEqual(s.boards[0].cuts, {2: 1});
});

/* ---- what the UI asks --------------------------------------------------- */

test("waitingOn names the seats that have not committed at this step", () => {
  let s = mk();
  assert.deepEqual(L.waitingOn(s), [0, 1]);
  s = L.reduce(s, L.hero(0, "kayo")).state;
  assert.deepEqual(L.waitingOn(s), [1], "seat 0 has chosen — the UI must say 'waiting on them'");
  s = L.reduce(s, L.hero(1, "bravo")).state;
  assert.deepEqual(L.waitingOn(s), [0, 1], "and the throw is nobody's yet");
  s = run([L.throwIt(0, 0, "paper"), L.throwIt(1, 0, "rock")], s).s;
  assert.deepEqual(L.waitingOn(s), [0], "only the winner may call the seating");
  s = L.reduce(s, L.seating(0, "first")).state;
  assert.deepEqual(L.waitingOn(s), [0, 1]);
  s = run([L.sideboard(0, [], {}), L.sideboard(1, [], {})], s).s;
  assert.deepEqual(L.waitingOn(s), [], "a ready lobby waits on nobody");
});

/* ---- the malformed-message surface -------------------------------------- */

test("it never throws on junk, and never mutates on junk", () => {
  const s = run(FULL.slice(0, 4)).s;
  const before = JSON.stringify(s);
  const junk = [null, undefined, 0, "hero", [], {}, {t: "hero"}, {t: "hero", seat: 7, key: "k"},
                {t: "nope", seat: 0}, {t: "hero", seat: 0, key: "k", v: 999},
                {t: "throw", seat: 0, round: "x", pick: "rock"},
                {t: "throw", seat: 0, round: 0, pick: "rock", v: 999},
                {t: "board", seat: 0, gearIdx: "all"},
                {t: "__proto__", seat: 0}, {t: "constructor", seat: 0}];
  for(const m of junk){
    let r;
    assert.doesNotThrow(() => { r = L.reduce(s, m); }, "threw on " + JSON.stringify(m));
    assert.ok(r.error, "accepted junk: " + JSON.stringify(m));
    assert.equal(JSON.stringify(r.state), before, "mutated on junk: " + JSON.stringify(m));
  }
});

test("a lobby-version skew is refused rather than misread", () => {
  const s = mk();
  const r = L.reduce(s, {t: "hero", v: L.LOBBY_V + 1, seat: 0, key: "kayo"});
  assert.ok(r.error);
  assert.match(r.error.why, /version/);
});

test("stepOf survives a missing state instead of throwing", () => {
  assert.equal(L.stepOf(null), "fault");
  assert.ok(L.reduce(null, L.hero(0, "k")).error);
});

/* ---- the discipline ------------------------------------------------------
   Same rule that keeps actions.js free of the parser and sparring.js free
   of fxParse: a NEGOTIATION bug and a card being read wrong must never be
   confusable. The lobby moves four small values and answers one question;
   the caller builds the decks. */

test("it reads no card text and resolves no card", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "lobby.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* Plain substrings, so a stray regex metacharacter in the banned list
     cannot quietly turn a real check into a syntax error. */
  for(const banned of ["./parser.js", "./cards.js", "./build.js", "./judge.js",
                       "fxParse", "resolveEntry", "buildSide", "effCost", ".tx", ".kw"]){
    assert.ok(src.indexOf(banned) < 0,
      "lobby.js reached for " + banned + " — the caller builds the decks, this only agrees on the spec");
  }
});

test("its only engine dependency is rps.js", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "lobby.js"), "utf8");
  const deps = [...src.matchAll(/require\("\.\/(\w+)\.js"\)/g)].map(m => m[1]);
  assert.deepEqual([...new Set(deps)], ["rps"]);
});
