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

/* ============================================================
   THE GRANT'S CARD IS THE RIDER'S "IT" TOO — WEAVE LIGHTNING (v4.13)

     "The next Lightning or Elemental attack action card you play this
      turn gets +3{p}. If it's FUSED, it gets go again."

   Same family, one atom over — and the atom cannot live in the qualifier
   at all. `fused` is not a printed field; it is HOW THE CARD WAS PLAYED
   (v3.96), settled at the top of `execute`. So it rides on `buffQ`'s
   existing RIDER slot, which v3.42 built precisely because a rider
   "belongs to the attack that eventually collects the pump".

   LIVE, NOT LATENT: Briar decks Weave Lightning AND both of the pool's
   fusable Lightning attack action cards (Arcanic Shockwave, Entwine
   Lightning), so the printed ACTION POINT has been lost in real games.
   ============================================================ */

/* THE PRINTED FORM, READ OFF THE POOL RATHER THAN INVENTED. Fusion is a
   KEYWORD LINE — "**Lightning Fusion**" on a paragraph of its own — and
   the first draft of this drill wrote a sentence describing the cost
   instead, which `fxParse` files as a `noop` and never turns into
   `fx.fusionCost`. So `fused` was false in every half and the drill
   failed against a correct engine: check your own fixture (v3.82, and
   the tenth outing of that rule). */
const FUSE = "**Lightning Fusion**";

const lightAtk = (uid, name, tx) => ({uid, name,
  tt: "Lightning Wizard Action - Attack", ty: ["Lightning", "Wizard", "Action", "Attack"],
  power: 3, pitch: 1, cost: 0, def: 2, kw: [], gkw: [], tx: tx || ""});

test("the fused rider rides on the grant that waits for the card", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse({name: "Weave Probe", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: ["Go again"], gkw: [],
    tx: "The next Lightning or Elemental attack action card you play this turn gets " +
        "+3{p}. If it's **fused**, it gets **go again**.\n\n**Go again**"});
  const b = (fx.ops || []).find(o => o[0] === "buffNext");
  assert.ok(b, "the head stopped reading");
  assert.deepEqual(b[3], {gaIf: "fused"},
    "the rider is not on the grant's own entry — a separate gaNextQ would be spent " +
    "by a card the head never matched, and `once` cannot say \"the card that took " +
    "the OTHER grant\"");
  assert.deepEqual(b[2], {aac: true, g: [["lightning"], ["elemental"]]},
    "the head's printed RESTRICTION moved or was replaced");
  assert.equal(fx.tier, "full", "the card is still short");
  P.fxReset();
});

test("a rider with no waiting grant is REFUSED", {skip}, () => {
  P.fxReset();
  /* THE FOLD IS A PAIRING. Without a head that says what "it" is, the
     rider names nothing — synthetic, because no pool card prints the
     near-miss (v3.73). */
  const fx = P.fxParse({name: "Fused Orphan", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: [], gkw: [],
    tx: "Draw a card. If it's **fused**, it gets **go again**."});
  assert.ok(!(fx.ops || []).some(o => o[0] === "buffNext"),
    "an orphan rider invented a grant to hang itself on");
  assert.equal((fx.clauses || [])[1].st, "skip", "…and the clause was filed as read");
  P.fxReset();
});

test("DRIVEN: the fused half and the unfused half of the same grant", {skip}, () => {
  H.db();
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45): a rider that grants
     unconditionally passes the fused half perfectly. Same card, same
     grant, same board — only the additional cost differs.

     GO AGAIN IS A GAIN, SO `ap` IS THE OBSERVABLE (v3.58, CR 5.3.5) —
     never the feed. */
  const q = {amt: 3, q: {aac: true, g: [["lightning"], ["elemental"]]},
             rider: {gaIf: "fused"}};
  const run = (tx, hand2) => {
    const c = lightAtk(9101, "Fusable Bolt", tx);
    const g = H.state({hand: [c, ...(hand2 || [])], res: 9, ap: 1, buffQ: [q]},
                      {hp: 30}, {actor: 0, turnPlayer: 0, turn: 3});
    const out = H.execute(g, c, "hand", 0, {});
    const st = out.game || out;
    return {ga: !!(st.pend || {}).ga, total: (st.pend || {}).total};
  };

  /* A Lightning card in hand is what pays the additional cost. */
  const pay = {uid: 9102, name: "Lightning Fodder", tt: "Lightning Action",
               ty: ["Lightning", "Action"], power: null, pitch: 1, cost: 0, def: 2,
               kw: [], gkw: [], tx: ""};

  const fused = run(FUSE, [pay]);
  assert.equal(fused.total, 6, "the head's +3 did not land on the fused card");
  assert.equal(fused.ga, true,
    "a FUSED card did not get the printed go again — CR 5.3.5's action point, lost");

  const notFused = run(FUSE, []);       /* nothing in hand to reveal */
  assert.equal(notFused.total, 6,
    "the head's +3 was gated too — the rider's condition has leaked onto the pump");
  assert.equal(notFused.ga, false,
    "an UNFUSED card got the go again — the printed condition is decoration");

  const noFusion = run("");             /* the card prints no Fusion at all */
  assert.equal(noFusion.ga, false, "a card that cannot fuse collected the grant anyway");
});

test("DRIVEN: a card the head's restriction refuses gets neither half", {skip}, () => {
  H.db();
  /* THE HEAD IS A REAL RESTRICTION — "the next LIGHTNING OR ELEMENTAL
     attack action card" — so a Generic attack must collect nothing, and
     the grant WAITS (v2.30). This is the control that separates v4.13's
     rider from v4.12's `once`: here the grant is genuinely looking for a
     particular card, and must not be spent by one that is not it. */
  const q = {amt: 3, q: {aac: true, g: [["lightning"], ["elemental"]]},
             rider: {gaIf: "fused"}};
  const c = Object.assign(lightAtk(9103, "Generic Swing", FUSE),
                          {tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]});
  const pay = {uid: 9104, name: "Lightning Fodder", tt: "Lightning Action",
               ty: ["Lightning", "Action"], power: null, pitch: 1, cost: 0, def: 2,
               kw: [], gkw: [], tx: ""};
  const g = H.state({hand: [c, pay], res: 9, ap: 1, buffQ: [q]}, {hp: 30},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const out = H.execute(g, c, "hand", 0, {});
  const st = out.game || out;
  assert.equal((st.pend || {}).total, 3, "a Generic attack collected a Lightning-only pump");
  assert.equal(!!(st.pend || {}).ga, false, "…and its rider's go again too");
  assert.equal((st.sides[0].buffQ || []).length, 1,
    "the grant was SPENT by a card its printed restriction refuses (v2.30)");
});

test("an UNQUALIFIED head takes the rider too", {skip}, () => {
  P.fxReset();
  /* THE FOLD'S HEAD IS "the `buffNext` op this card produced", not "a
     QUALIFIED one". An earlier draft demanded a printed restriction and
     that guard was both unexpressible against the pool and narrower than
     the printed rule — "your next attack gets +3. If it's fused, it gets
     go again" is a perfectly good card. Synthetic, because no pool record
     prints the shape (v3.73). */
  const fx = P.fxParse({name: "Bare Weave", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: [], gkw: [],
    tx: "Your next attack this turn gets +3{p}. If it's **fused**, it gets **go again**."});
  const b = (fx.ops || []).find(o => o[0] === "buffNext");
  assert.ok(b, "the head stopped reading");
  assert.deepEqual(b[3], {gaIf: "fused"},
    "an unqualified head was refused the rider — the guard is narrower than the card");
  assert.equal((fx.clauses || [])[1].st, "run", "…and the clause reports unread");
  P.fxReset();
});

test("the rider MERGES with a granted-ability rider, and the anchor keeps its word", {skip}, () => {
  P.fxReset();
  /* TWO SILENT SABOTAGES, TWO SYNTHETIC FIXTURES (v3.73). No pool record
     prints either near-miss, so nothing driven could see the merge being
     replaced by an assignment, or the anchor widened off `fused`. */

  /* (a) A HEAD THAT ALREADY CARRIES A RIDER. The wording is Lace with
     Frailty's, which is the pool's own shape for `op[3]`. */
  const merged = P.fxParse({name: "Laced Weave", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: [], gkw: [],
    tx: "Your next arrow attack this turn gets +3{p} and \"When this hits a hero, " +
        "create a Frailty token under their control.\"\n\nIf it's **fused**, it gets " +
        "**go again**."});
  const m = (merged.ops || []).find(o => o[0] === "buffNext");
  assert.ok(m && m[3], "the head's own rider vanished");
  assert.equal(m[3].gaIf, "fused", "the fused rider did not land");
  assert.equal(((m[3].onHitHero || [])[0] || [])[0], "token",
    "the fused rider REPLACED the granted ability instead of joining it — one printed " +
    "sentence ate another");

  /* (b) THE ANCHOR NAMES `fused`, not any word in that slot. A colour
     there is v4.12's family and grants a PUMP; read as a fused rider it
     would hand out an ACTION POINT (CR 5.3.5) off a condition the card
     never prints. */
  const wrong = P.fxParse({name: "Coloured Weave", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: [], gkw: [],
    tx: "Your next arrow attack this turn gets +3{p}. If it's blue, it gets **go again**."});
  const w = (wrong.ops || []).find(o => o[0] === "buffNext");
  assert.ok(!(w && w[3] && w[3].gaIf),
    "a colour was read as `fused` — the anchor matches any word in that slot, so an " +
    "unrelated condition hands out an action point");
  P.fxReset();
});

test("the premise the fold's clause claim rests on, and ENTWINE LIGHTNING", {skip}, () => {
  H.db();
  P.fxReset();
  /* THE FOLD MARKS ITS RIDER CLAUSE `run` WITH NO "already read" GUARD,
     and that is safe only while `classifyClause` refuses the phrase on
     its own — which is also the whole reason the fold exists. Pinned, so
     a reader arriving for it fails here rather than silently making the
     fold a second claimant (v4.11's two-shapes drill, one fold over). */
  assert.equal(P.classifyClause("if it is fused, it gets go again"), null,
    "the rider now reads on its own — the fold has become a SECOND reader of one " +
    "clause, which is the defect v4.12 fixed. Restore the `st === \"run\"` guard.");

  /* AND THE POOL'S OWN CONTROL. Entwine Lightning prints the same idea
     about a DIFFERENT subject — "if THIS WAS fused", where "this" is the
     card itself, an attack — and `classifyClause` reads it in full. Two
     wordings, two subjects; the anchor must not reach across. */
  assert.deepEqual(P.classifyClause("if this was fused, it gets go again"),
    {status: "run", ops: [["ga"]], cond: "fused"},
    "Entwine Lightning's own reading moved");
  const C = require("../engine/cards.js");
  const el = C.resolveEntry(H.db(), {name: "Entwine Lightning", p: 1, code: null, q: 1});
  const fx = P.fxParse(el);
  assert.ok(!(fx.ops || []).some(o => o[0] === "buffNext"),
    "the fold claimed Entwine Lightning — it prints no next-attack grant at all");
  assert.equal(fx.tier, "full", "Entwine Lightning regressed");

  /* AND THE REAL CARD CANNOT SEE A WIDENED ANCHOR, which is why the
     fixture below exists. Entwine Lightning prints no next-attack grant,
     so the fold's `op` is undefined and its loop never runs — widening
     the anchor to reach "this was fused" is SILENT against it. The
     fixture that bites carries BOTH: a head grant AND that wording, where
     `classifyClause` has already read the clause as the card's own go
     again. Claimed a second time, one printed sentence grants an action
     point twice, to two different cards — VALUE-DOUBLED on the fairness
     sweep's own terms. */
  const both = P.fxParse({name: "Entwined Weave", pitch: 1, tt: "Lightning Action",
    ty: ["Lightning", "Action"], cost: 1, power: null, def: 2, kw: [], gkw: [],
    tx: "Your next arrow attack this turn gets +3{p}. If this was **fused**, it gets " +
        "**go again**."});
  const bo = (both.ops || []).find(o => o[0] === "buffNext");
  assert.ok(bo, "the head stopped reading");
  assert.ok(!(bo[3] && bo[3].gaIf),
    "the fold claimed a clause `classifyClause` had already read — \"this\" is the " +
    "card itself and \"it\" is the card the grant names, so one printed sentence " +
    "now grants go again to both");
  assert.ok((both.conds || []).some(x => x.cond === "fused"),
    "…and the card's OWN conditional go again was eaten in the process");
  P.fxReset();
});
