/* ============================================================
   A TARGETED COUNTER PUT — the general form of `aim`.

     Re-Charge!       "Put a steam counter on a Hyper Driver you control."
     Astral Etchings  "Put three +1{p} counters on target aura with ward
                       you control."
     Uphold Tradition "Instant - {r}, turn this face-up: Put a +1{p}
                       counter on an aura you control with ward."

   `counters` has been a per-side map keyed by uid for a long time and
   `aim` was the one worked example of putting one on a chosen object.
   What was missing was the general reader — WEEK.md's one family label
   that survived being re-measured against the parser.

   THE KIND IS READ OFF THE LINE AND MAPPED TO A FIELD SOMETHING ALREADY
   READS. An unrecognised kind refuses: a counter nothing consumes is a
   counter that does nothing, filed `full`, which is the no-op blind spot
   at its purest.

   BOTH NUMBERS COME OFF THE LINE. Astral Etchings prints three / two /
   one across its pitches, so a hardcoded amount is right for one
   printing and silently wrong for the other two.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);

/* ---- 1. THE READING ---------------------------------------------- */

test("kind, amount and subject all come off the printed line", () => {
  assert.deepEqual(cc("Put a steam counter on a Hyper Driver you control"),
    {status: "run", ops: [["ctrPut",
      {kind: "steam", n: 1, filter: {name: "^Hyper Driver$"}, label: "steam"}]]},
    "'you control' is consumed — the op searches the ACTOR's own permanents, " +
    "so the words restate what the target zone already says (v3.18's rule)");

  const a = cc("Put three +1{p} counters on target aura with ward you control");
  assert.equal(a.ops[0][1].kind, "pow", "'+1{p}' is the printed spelling of the `pow` field");
  assert.equal(a.ops[0][1].n, 3);
  assert.deepEqual(a.ops[0][1].filter, {kw: "ward", tt: "aura"},
    "the ward qualifier survives — dropping it would target any aura at all");
});

test("the word order may put 'you control' before the qualifier", () => {
  /* Uphold Tradition prints "an aura you control with ward"; Astral
     Etchings prints "target aura with ward you control". Same subject,
     two orders — one reader, or the two cards drift apart. */
  assert.deepEqual(cc("Put a +1{p} counter on an aura you control with ward").ops[0][1].filter,
                   cc("Put a +1{p} counter on target aura with ward you control").ops[0][1].filter);
});

test("AN UNKNOWN COUNTER KIND REFUSES — the no-op blind spot, closed", () => {
  assert.equal(cc("Put a glitter counter on a Hyper Driver you control"), null,
    "a counter kind nothing reads is a counter that does nothing; storing it " +
    "would file the card `full` with its whole effect inert");
  assert.equal(cc("Put a steam counter on the thing over there"), null,
    "and an unreadable SUBJECT refuses too — the whole phrase or nothing");
});

test("the amount is per PRINTING, not hardcoded", {skip}, () => {
  for(const [pitch, want] of [[1, 3], [2, 2], [3, 1]]){
    P.fxReset();
    const op = P.fxParse(H.card("Astral Etchings", pitch)).ops.find(o => o[0] === "ctrPut");
    assert.equal(op[1].n, want, "Astral Etchings at pitch " + pitch + " prints " + want);
  }
  P.fxReset();
});

/* ---- 3. THE BOOST-BANISH TRIGGER (v3.56) -------------------------
   This drill said "Crankshaft still REFUSES — its trigger does not
   exist" at v3.55, and it failed the moment v3.56 built the trigger.
   THAT IS WHAT A RECORDED REFUSAL IS FOR (v3.38): the reason stopped
   being true, the drill went red, and retiring it had to be a deliberate
   edit rather than a quiet one. The refusal PROPERTY is kept alive below
   as its own probe. */

test("the payload is held OFF `fx.ops` — playing the card must not fire it", {skip}, () => {
  /* THE WHOLE POINT OF A SCHEDULE. Crankshaft is an attack card; left in
     `ops` its steam counter would land every time the card was PLAYED,
     which is v3.07's suspense bug — a printed delay collected as a bonus.
     Assert the shape, because the driven test below cannot tell "it fired
     on the boost" from "it fires on everything". */
  P.fxReset();
  const fx = P.fxParse(H.card("Crankshaft", 1));
  assert.ok(!fx.ops.some(o => o[0] === "ctrPut"),
    "the counter must NOT be an unconditional op");
  assert.deepEqual(fx.boostBanish, [["ctrPut",
    {kind: "steam", n: 1, filter: {name: "^Hyper Driver$"}, label: "steam"}]],
    "it rides on the schedule instead");
  P.fxReset();
});

/* THESE TWO PROBES ASK `fxParse`, NOT `classifyClause`, AND THAT IS THE
   WHOLE POINT. The boost-banish reader is a WHOLE-CARD reader — it scans
   `clauses` inside `fxParse` — so `classifyClause` returns null for these
   shapes whatever the reader does. Written against `cc` (as they were
   first) both probes passed against a sabotaged engine that claimed every
   "when this is …" trigger and every unreadable payload: they were
   asserting a different function's refusal. Sabotage is what said so.

   Synthetic fixtures, with unique names — `fxParse` memoizes on
   `name|pitch`, so a reused name silently returns the previous answer. */
const synth = (name, tx) => ({name, pitch: 0, tt: "Mechanologist Action", kw: [], tx});

test("AN UNKNOWN TRIGGER STILL REFUSES — the vocabulary stays closed", () => {
  /* The refusal property this drill used to assert about Crankshaft,
     kept alive on shapes nothing prints. A payload that parses with no
     schedule to fire on is the one case `failstates.js` cannot reach
     (v3.07), and the wrapper refusing is what prevents it. */
  P.fxReset();
  for(const [nm, tx] of [
    ["Moon Probe",      "When the moon turns blue, put a steam counter on a Hyper Driver you control."],
    ["Destroyed Probe", "When this is destroyed, put a steam counter on a Hyper Driver you control."],
    ["Leaves Probe",    "When this leaves the arena, put a steam counter on a Hyper Driver you control."]]){
    const fx = P.fxParse(synth(nm, tx));
    assert.ok(!fx.boostBanish, nm + ": only the boost-banish wording may claim this schedule");
    assert.ok(!fx.ops.some(o => o[0] === "ctrPut"),
      nm + ": and it must not fall through to an unconditional op either");
  }
  P.fxReset();
});

test("AN UNREADABLE PAYLOAD REFUSES THE WHOLE TRIGGER", () => {
  P.fxReset();
  const fx = P.fxParse(synth("Ineffable Probe",
    "When this is banished from boosting, do something ineffable."));
  assert.ok(!fx.boostBanish,
    "the clause stays unclaimed rather than the trigger firing a guess");
  P.fxReset();
});

test("driven: boosting with Crankshaft on top fires ITS trigger", {skip}, () => {
  H.db();
  const boostCard = Object.assign({}, H.card("Jump Start", 1), {uid: "src1"});
  const crank     = Object.assign({}, H.card("Crankshaft", 1), {uid: "cr1"});
  const drv       = Object.assign({}, H.card("Hyper Driver", 0), {uid: "hd1"});
  let g = H.state({name: "Dash", res: 9, ap: 3, hand: [boostCard],
                   deck: [crank, {uid: "d2", name: "Filler"}],
                   board: [{card: drv, kind: "item", spent: false, uid: "hd1"}],
                   counters: {}},
                  {name: "Them", deck: [{uid: "d3", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "bb", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  let n = J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
  assert.equal(n.pending && n.pending.kind, "boost", "boost is a choice, and it is asked");
  n = J.reduce(n, {t: "boost", yes: true}, 0).state;

  assert.ok((n.sides[0].banish || []).some(c => c.uid === "cr1"),
    "Crankshaft is banished off the top of the deck to pay for the boost");
  assert.equal((n.sides[0].counters.hd1 || {}).steam, 1,
    "and the trigger it prints fires — from the DECK, on a card its " +
    "controller never played");
});

test("THE TRIGGER BELONGS TO THE BANISHED CARD, not the played one", {skip}, () => {
  /* Crankshaft prints Boost itself, so it can be the card being PLAYED
     while something else is banished for it. Read off the played card
     instead of the banished one, the counter would land here too — and
     the drill above could not tell the difference, because there
     Crankshaft is both. */
  H.db();
  const crank = Object.assign({}, H.card("Crankshaft", 1), {uid: "src1"});
  const plain = Object.assign({}, H.card("Booze!", 3), {uid: "top1"});
  const drv   = Object.assign({}, H.card("Hyper Driver", 0), {uid: "hd1"});
  let g = H.state({name: "Dash", res: 9, ap: 3, hand: [crank],
                   deck: [plain, {uid: "d2", name: "Filler"}],
                   board: [{card: drv, kind: "item", spent: false, uid: "hd1"}],
                   counters: {}},
                  {name: "Them", deck: [{uid: "d3", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "bb2", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  let n = J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: true}, 0).state;
  assert.ok((n.sides[0].banish || []).some(c => c.uid === "top1"), "the plain card paid the boost");
  assert.ok(!n.sides[0].counters.hd1,
    "no counter — the banished card printed no trigger, and the PLAYED card's " +
    "trigger is not the one that fires");
});

/* ---- 2. DRIVEN --------------------------------------------------- */

const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
const ent = c => ({card: c, kind: "item", spent: false, uid: c.uid});

function play(boardCards){
  H.db();
  let g = H.state({name: "Dash", res: 9, ap: 3, hand: [mk("Re-Charge!", 1, "src1")],
                   board: boardCards.map(ent), counters: {},
                   deck: [{uid: "d1", name: "T"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "ctr", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  return J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
}

test("one legal target takes the counter with no sheet", {skip}, () => {
  /* A DECOY ON THE BOARD, or the filter is not under test: with the
     driver as the only permanent the target is the same whether the
     filter applies or is dropped entirely. A fixture where two things
     coincide has tested neither (v3.26). */
  const n = play([mk("Hyper Driver", 0, "hd1"), mk("Energy Potion", 0, "ep1")]);
  assert.ok(!n.prompt, "a single forced choice is a tap that teaches nothing");
  assert.equal((n.sides[0].counters.hd1 || {}).steam, 1);
  assert.ok(!n.sides[0].counters.ep1, "the decoy takes nothing — the name filter is real");
});

test("two legal targets is a real choice, and the CHOICE is honoured", {skip}, () => {
  let n = play([mk("Hyper Driver", 0, "hd1"), mk("Hyper Driver", 0, "hd2")]);
  assert.ok(n.prompt, "the sheet must open");
  assert.deepEqual(n.prompt.cards.map(c => c.uid), ["hd1", "hd2"]);
  assert.deepEqual(n.prompt.ctrStamp, {kind: "steam", n: 1, label: "steam"},
    "the stamp rides on the spec — dropped, the sheet opens, names the right " +
    "permanent and places nothing (v2.34's `arsStamp` rule)");

  /* PICK THE SECOND ONE. Choosing index 0 cannot tell "the player's choice
     was applied" from "the first candidate was taken". */
  n = J.reduce(n, {t: "promptSel", i: 1}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.equal((n.sides[0].counters.hd2 || {}).steam, 1, "the chosen one takes it");
  assert.ok(!n.sides[0].counters.hd1, "and the other does not");
});

test("no legal target — the rest of the card still resolves", {skip}, () => {
  const n = play([mk("Energy Potion", 0, "ep1")]);
  assert.deepEqual(n.sides[0].counters, {}, "nothing takes a counter");
  /* Re-Charge! also prints "The next attack you boost this turn gets
     +4{p}" — a missing target must not swallow the rest of the card. */
  assert.ok((n.sides[0].buffQ || []).length || n.sides[0].buffNext,
    "the printed +4{p} still applies");
});

test("GEAR IS A LEGAL HOME TOO — a counter can sit on either zone", {skip}, () => {
  /* A steam counter goes on a Hyper Driver, which is an ITEM and lives on
     the board; rust and +1{p} counters go on EQUIPMENT. A scan of one
     zone finds nothing for half the family — v3.33's Magmatic Carapace
     lesson, where a board-only scan missed a Chest piece. */
  H.db();
  let g = H.state({name: "Dash", res: 9, ap: 3, hand: [mk("Re-Charge!", 1, "src1")],
                   gear: [mk("Hyper Driver", 0, "hd9")], board: [], counters: {},
                   deck: [{uid: "d1", name: "T"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "ctr2", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const n = J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
  assert.equal((n.sides[0].counters.hd9 || {}).steam, 1, "gear takes the counter too");
});
