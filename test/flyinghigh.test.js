/* ============================================================
   TWO "IT"S, ONE ANCHOR — FLYING HIGH (v4.12)

   The pool prints the same rider about two different subjects:

     "Your next attack this turn gets go again. If it's RED, it gets
      +1{p}."                            — FLYING HIGH (red/yellow/blue)

     "When this attacks, reveal the top card of your deck. If it's BLUE,
      pitch it."                         — SALTWATER SWELL

   `classifyClause` sees one clause at a time, so it cannot know which
   "it" it is holding. It had one answer — `/^it is blue$/ -> revBlue`,
   written for the reveal — and that anchor claimed Flying High's rider
   too. Measured: **revBlue had exactly ONE claimant in the whole pool
   and it was the wrong card.**

   SO THE BLUE PRINTING READ `tier: full` AND DID NOTHING, TWICE OVER:
   the condition asked `n.revealed.pitch === 3` on a card that reveals
   nothing, and the payload `["self", 1]` pumped Flying High itself — a
   Generic NON-ATTACK with no printed power. Red and yellow were honestly
   `skip`. v2.33's Bull's Eye Bracers trap (sixth outing) wearing v3.58's
   disguise, and no tool here could see it: coverage counted the clause
   consumed, and the fairness sweep is one-sided toward too-STRONG while
   all three printings are WEAKER than printed.

   IT IS A CONDITION, NOT A RESTRICTION (v3.30, one grant over). A
   qualified `buffQ` WAITS for a card it matches (v2.30) — right for
   "your next ARROW attack", and stronger than printed here: the line
   names YOUR NEXT ATTACK, and a red one takes the go again and ends the
   sentence.
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = H.db() ? false : "no card database";

const rec = (name, pitch, tx) => ({name, pitch, tt: "Generic Action",
  ty: ["Generic", "Action"], tx, kw: ["Go again"], gkw: [],
  cost: 1, power: null, def: 2});

/* ---- THE READING ---------------------------------------------------- */

test("all three printings read, and the colour is the card's own", {skip}, () => {
  P.fxReset();
  const want = {red: 1, yellow: 2, blue: 3};
  for(const col of Object.keys(want)){
    const fx = P.fxParse(rec("Flying High " + col, want[col],
      "Your next attack this turn gets **go again**. If it's " + col +
      ", it gets +1{p}.\n\n**Go again**"));
    const b = (fx.ops || []).find(o => o[0] === "buffNext");
    assert.ok(b, col + ": the rider is unread — the printed +1{p} lands nowhere");
    assert.deepEqual(b[2], {pitch: want[col]},
      col + ": the colour is not the card's own printing. A hardcoded 3 is right " +
      "for blue and silently wrong for the other two — and the pool cannot tell " +
      "you, because every printing prints 1 (v3.17, v3.32, v3.55)");
    assert.equal(b[1], 1, col + ": the amount is not read off the printed line");
    assert.equal(b[4], true,
      col + ": the grant is not marked `once` — it would WAIT for a card of that " +
      "colour, and the sentence names your NEXT attack, whatever colour it is");
    assert.ok((fx.ops || []).some(o => o[0] === "gaNext" && !o[1]),
      col + ": the HEAD stopped reading — the fold must claim the rider only");
    assert.deepEqual(fx.conds || [], [],
      col + ": a stale colour condition is still emitted, so the payload lands twice");
    assert.equal(fx.tier, "full", col + ": the card is still short");
  }
  /* AND THE AMOUNT NEEDS A FIXTURE THAT CAN EXPRESS THE BUG. All three
     printings print **1**, so a hardcoded 1 is silent against every one
     of them — the comment above says so and the first draft of this drill
     then asserted `b[1] === 1` against those three anyway. A synthetic
     printing a different number is what sees it (v3.32, v3.74, v3.86). */
  const three = P.fxParse(rec("Flying Higher", 1,
    "Your next attack this turn gets **go again**. If it's red, it gets +3{p}.\n\n**Go again**"));
  assert.equal((three.ops || []).find(o => o[0] === "buffNext")[1], 3,
    "the amount is HARDCODED — right for this card's three printings and wrong " +
    "for any other, which no pool fixture can tell you");
  P.fxReset();
});

test("SALTWATER SWELL — the other \"it\" — is pinned unmoved", {skip}, () => {
  P.fxReset();
  /* THE CONTROL, AND IT IS THE WHOLE REASON THE FOLD KEYS ON THE HEAD
     CLAUSE. Its rider is byte-identical to the blue printing's opening
     words and means something else entirely. */
  const fx = P.fxParse({name: "Saltwater Probe", pitch: 1, tt: "Pirate Action - Attack",
    ty: ["Pirate", "Action", "Attack"], power: 4, cost: 1, def: 2, kw: [], gkw: [],
    tx: "When this attacks, reveal the top card of your deck. If it's blue, pitch it.\n\n**Go again**"});
  assert.ok((fx.ops || []).some(o => o[0] === "revColorPitch" && o[1] === 3),
    "the reveal-and-pitch op stopped reading — the fold has claimed the wrong card");
  assert.ok(!(fx.ops || []).some(o => o[0] === "buffNext"),
    "a reveal's rider was read as a next-attack pump — the two \"it\"s have collapsed");
  assert.equal(fx.tier, "full", "Saltwater Swell regressed");
  P.fxReset();
});

test("a rider with no next-attack head is REFUSED", {skip}, () => {
  P.fxReset();
  /* THE FOLD IS A PAIRING, NOT A PATTERN. Without a head that says what
     "it" is, the rider names nothing this reader can pin — so it refuses
     rather than guessing, which is v2.29's rule about an unreadable
     subject. No pool card prints the near-miss, so it is synthetic
     (v3.73). */
  const fx = P.fxParse(rec("Rider With No Head", 1,
    "Draw a card. If it's red, it gets +1{p}.\n\n**Go again**"));
  assert.ok(!(fx.ops || []).some(o => o[0] === "buffNext"),
    "an orphan rider was claimed — \"it\" names nothing the reader can see");
  assert.equal((fx.clauses || [])[1].st, "skip", "…and the clause was filed as read");
  P.fxReset();
});

/* ---- DRIVEN --------------------------------------------------------- */

const atk = (uid, name, pitch, power) => ({uid, name, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], power, pitch, cost: 0, def: 2,
  kw: [], gkw: [], tx: ""});

/* Declare an attack and read back what the wall-free swing is worth. */
const swing = (buffQ, card) => {
  const g = H.state({hand: [card], res: 9, ap: 1, buffQ}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const out = H.execute(g, card, "hand", 0, {});
  const st = out.game || out;
  return {total: (st.pend || {}).total, kept: (st.sides[0].buffQ || []).length};
};

test("DRIVEN: the colour decides the pump, and the grant is spent either way", {skip}, () => {
  H.db();
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45): a qualifier that
     refuses everything passes the red half perfectly. Two attacks
     differing in exactly one printed field. */
  const q = {amt: 1, q: {pitch: 3}, rider: null, once: true};

  const blue = swing([q], atk(8801, "Blue Swing", 3, 4));
  assert.equal(blue.total, 5, "a BLUE attack did not collect the printed +1");
  assert.equal(blue.kept, 0, "the grant was not spent by the card it named");

  const red = swing([q], atk(8802, "Red Swing", 1, 4));
  assert.equal(red.total, 4,
    "a RED attack collected a +1 the card grants only to a blue one — v2.30's " +
    "arrow buff on a sword, one atom over");
  assert.equal(red.kept, 0,
    "the grant SURVIVED a non-matching attack. `once` is the whole point: the " +
    "printed line names your NEXT attack, so a red one ends the sentence — kept, " +
    "it waits for a blue attack later in the turn that the card never named");
});

test("DRIVEN: an ordinary qualified grant still WAITS (v2.30)", {skip}, () => {
  H.db();
  /* THE CONTROL FOR `once`, AND WITHOUT IT THE DRILL ABOVE PROVES
     NOTHING: an engine that spent EVERY buffQ entry on every attack
     passes both halves above and breaks "your next ARROW attack". */
  const q = {amt: 3, q: {g: [["arrow"]]}, rider: null};
  const g = H.state({hand: [atk(8803, "Not An Arrow", 1, 4)], res: 9, ap: 1, buffQ: [q]},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const out = H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  const st = out.game || out;
  assert.equal((st.pend || {}).total, 4, "an unqualified attack collected an arrow buff");
  assert.equal((st.sides[0].buffQ || []).length, 1,
    "a qualified grant that did not match was SPENT — `once` has leaked onto every entry");
});

test("DRIVEN: the whole card, from the play that grants to the swing that collects", {skip}, () => {
  H.db();
  P.fxReset();
  /* DRIVE THE REAL ENTRY POINT, OR PIN NOTHING (v3.20, v3.89, v4.03).
     Every assertion above hands `execute` a buffQ entry built by hand;
     this one plays Flying High and lets the engine build it. */
  const fh = Object.assign(rec("Flying High Driven", 3,
    "Your next attack this turn gets **go again**. If it's blue, it gets +1{p}.\n\n**Go again**"),
    {uid: 8810});
  const g = H.state({hand: [fh], res: 9, ap: 1}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const o1 = H.execute(g, fh, "hand", 0, {});
  const s1 = o1.game || o1;
  assert.equal((s1.sides[0].buffQ || []).length, 1,
    "playing the card granted no conditional pump — the fold never reached the engine");
  assert.equal(s1.sides[0].gaNext, true, "and the head's go again is gone too");

  const blue = atk(8811, "Blue Follow-Up", 3, 4);
  const s2raw = H.execute(Object.assign({}, s1, {sides: [
    Object.assign({}, s1.sides[0], {hand: [blue], ap: 1}), s1.sides[1]]}), blue, "hand", 0, {});
  const s2 = s2raw.game || s2raw;
  assert.equal((s2.pend || {}).total, 5,
    "the blue follow-up did not collect the +1 the card granted it");
  assert.equal((s2.pend || {}).ga, true, "…and the head's go again did not reach it either");

  /* AND THE RED HALF, END TO END. Without it the `once` flag is never
     reached through the op handler at all: a blue follow-up matches the
     qualifier, so it is spent either way and dropping `op[4]` is SILENT.
     Both halves or the drill proves nothing (v3.45) — and "both halves"
     has to mean both halves of the ROUTE, not only of the matcher. */
  const red = atk(8812, "Red Follow-Up", 1, 4);
  const s3raw = H.execute(Object.assign({}, s1, {sides: [
    Object.assign({}, s1.sides[0], {hand: [red], ap: 1}), s1.sides[1]]}), red, "hand", 0, {});
  const s3 = s3raw.game || s3raw;
  assert.equal((s3.pend || {}).total, 4,
    "the red follow-up collected a +1 the card grants only to a blue attack");
  assert.equal((s3.sides[0].buffQ || []).length, 0,
    "the grant survived the attack it named — `once` was dropped between the parse " +
    "and the entry, so it waits for a blue attack the sentence never mentioned");
  P.fxReset();
});
