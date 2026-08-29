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

test("…BUT IT MUST NOT STEAL THE CLAUSE FROM A READER THAT KNOWS IT", {skip}, () => {
  /* Written as match-then-refuse, the enters-with reader swallowed
     Malefic Incantation's "this enters the arena with 3 VERSE counters" —
     a kind it does not know — and returned null, killing a clause an
     existing verse reader further down was already handling. The card
     went `full` -> `part`, and `coverage.test.js`'s pinned baseline is
     what caught it, which is exactly what that baseline is for.

     The kind is tested in the GUARD now, so an unknown kind falls
     through. Both properties survive: nothing else claims "glitter", so
     that still refuses, and "verse" reaches the reader that wants it. */
  P.fxReset();
  const fx = P.fxParse(H.card("Malefic Incantation", 1));
  assert.equal(fx.tier, "full",
    "the verse-counter reader must still get its clause");
  assert.ok(!fx.ops.some(o => o[0] === "ctrSelf"),
    "and the counter reader must not have claimed it");
  P.fxReset();
  /* THE VERSE READER OWNS THIS PHRASE, and it is the one that must get it:
     `enterCounters` is the verse mechanic's own op, wired to the board
     entry's `verse` field. The fall-through hands it over intact. */
  assert.deepEqual(cc("This enters the arena with 3 verse counters"),
    {status: "run", ops: [["enterCounters", 3]]},
    "the verse reader still claims its own clause");
  /* AND A KIND NOBODY OWNS STILL REFUSES — the fall-through is not a
     licence, it just stops this reader answering for shapes it cannot
     read. */
  assert.equal(cc("This enters the arena with 3 glitter counters"), null);
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

/* ---- 4. "ENTERS WITH A COUNTER", AND THE GATE THAT NEARLY VANISHED ----
   Waxing Specter: "If you've pitched a blue card this turn, this enters
   the arena with a +1{p} counter."

   THE CONDITION MAPS ONTO AN EVALUATOR THAT ALREADY EXISTED. `pitchBlue<N>`
   has been there since High Tide, reachable only through that keyword's
   wording. CR 4.4.3c sends the pitch zone to the bottom of the deck in the
   end phase, so during a turn that zone holds exactly the cards pitched
   this turn — "pitched a blue card this turn" and "a blue card is in your
   pitch zone" are one question asked twice, which is why this reuses the
   evaluator rather than adding a second record of one fact.
   ---------------------------------------------------------------- */

test("the printed 'pitched a blue card' wording reads, and is not 'played'", () => {
  const r = cc("If you've pitched a blue card this turn, draw a card");
  assert.equal(r.cond, "pitchBlue1");
  /* PITCHED AND PLAYED ARE TWO FATES OF ONE CARD, and the engine has kept
     them apart since before this reader existed. Collapsing them would pay
     Waxing Specter for a blue card that was spent the other way. */
  assert.equal(cc("If you've played another blue card this turn, draw a card").cond, "blue");
});

test("the counter it enters with is GATED, not automatic", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Waxing Specter", 1));
  assert.ok(!fx.ops.some(o => o[0] === "ctrSelf"),
    "an unconditional op would make the printed gate decoration");
  assert.deepEqual(fx.conds.map(x => [x.cond, x.op[0]]), [["pitchBlue1", "ctrSelf"]]);
  P.fxReset();
});

function specter(pitchZone){
  H.db();
  const spec = Object.assign({}, H.card("Waxing Specter", 1), {uid: "ws1"});
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand: [spec], board: [],
                   counters: {}, pitch: pitchZone, deck: [{uid: "d1", name: "T"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "ws", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  return J.reduce(g, {t: "play", uid: "ws1", from: "hand"}, 0).state;
}

test("driven: a blue card in the pitch zone earns the counter", {skip}, () => {
  const n = specter([{uid: "pz1", name: "A Blue", pitch: 3}]);
  assert.ok((n.sides[0].board || []).some(b => b.uid === "ws1"), "the aura lands either way");
  assert.equal((n.sides[0].counters.ws1 || {}).pow, 1);
});

test("driven: a RED card in the pitch zone does not — the gate is real", {skip}, () => {
  /* A RED CARD RATHER THAN AN EMPTY ZONE. An empty pitch zone cannot tell
     "the gate checked the colour" from "the gate checked for anything at
     all" — a fixture where two things coincide has tested neither. */
  const n = specter([{uid: "pz2", name: "A Red", pitch: 1}]);
  assert.ok((n.sides[0].board || []).some(b => b.uid === "ws1"),
    "the aura still enters — only the counter is conditional");
  assert.ok(!n.sides[0].counters.ws1, "and it brings no counter");
});

/* ---- 5. A GATED LEAVE-TRIGGER REFUSES ---------------------------- */

test("a gated 'when this leaves the arena' clause is REFUSED", {skip}, () => {
  /* Found by building `pitchBlue1`, which made Waning Vengeance's gate
     readable for the first time. `fxParse`'s op dispatcher files an
     onLeave payload into `fx.onLeave` and has NO branch for a condition
     riding with it, so the gate was silently DROPPED and the token minted
     unconditionally — COND-BYPASSED, and **the fairness sweep does not
     catch it**: its model wants a condition gating an effect the engine
     ALSO grants unconditionally, and here the condition simply vanishes,
     leaving no unconditional twin to compare against.

     `fx.onLeave` also has exactly one caller (`tickSuspense`), and this
     card prints no suspense, so reading the clause would file it `full`
     with a dropped gate on a trigger that cannot fire. */
  assert.equal(cc("When this leaves the arena, if you've pitched a blue card this turn, create a Spectral Shield token"),
    null);
  P.fxReset();
  const fx = P.fxParse(H.card("Waning Vengeance", 1));
  assert.ok(!(fx.onLeave || []).length, "no ungated payload may be manufactured from a gated clause");
  assert.equal(fx.tier, "part", "the card stays honestly unfinished");
  P.fxReset();
});

test("an UNGATED leave-trigger still reads — the refusal is narrow", {skip}, () => {
  assert.equal(cc("When this leaves the arena, draw a card").onLeave, true);
  P.fxReset();
  const booze = P.fxParse(H.card("Booze!", 3));
  assert.ok((booze.onLeave || []).length, "Booze!'s boo must survive");
  assert.equal(booze.tier, "full");
  P.fxReset();
});
