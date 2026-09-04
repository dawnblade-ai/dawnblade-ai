/* ============================================================
   STIR THE AETHERWINDS — the FOURTH qualified single-shot grant (v3.37)

     "You may play your next WIZARD NON-ATTACK ACTION CARD this turn as
      though it were an instant. If IT has an arcane damage effect,
      instead it deals that much arcane damage plus 1."

   TWO SENTENCES, ONE CARD. They arrive as separate clauses — the splitter
   breaks on the period — so `fxParse` pairs them where the whole card is
   visible, the same place and the same reason `optCost` pairs its halves.

   THE BUG THIS FIXES IS THE UNPAIRED HALF. `amp` is a bare number on the
   side meaning "the next arcane, whatever it is", so Stir's +1 landed on
   ANY next arcane — driven, on Sigil of Suffering, a Runeblade DEFENSE
   REACTION that is neither Wizard nor a non-attack action card.
   RESTRICTION-DROPPED, stronger than printed, and the fairness sweep
   could not see it because that check does not model `amp`. Same shape as
   v2.30's arrow buff landing on a sword.

   AND THE SPEED GRANT ITSELF was one of the 14 "as though it were an
   instant" records that v3.36 found unread. This is the shape v3.36 left
   open on purpose: a grant to a FUTURE card rather than to this one.

   EVERY ASSERTION IS ON STATE OR A REFUSAL, never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");

const P = require("../engine/parser.js");
const S = require("../engine/sides.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const stir = () => H.card("Stir the Aetherwinds", 3);   /* prints "plus 1" */

/* ---- THE READ -------------------------------------------------------- */

test("both sentences fold into ONE grant, carrying the printed number", {skip}, () => {
  for(const [pitch, amp] of [[1, 3], [2, 2], [3, 1]]){
    P.fxReset();
    const ops = P.fxParse(H.card("Stir the Aetherwinds", pitch)).ops;
    assert.equal(ops.length, 1,
      "pitch " + pitch + ": the two sentences must fold into one grant. A loose `amp` op " +
      "beside the grant is the leak this version fixes — and it would ALSO double, since " +
      "the grant carries the same number");
    assert.equal(ops[0][0], "instantNext");
    /* THE ENTRY IS `{q, amp}` AS OF v3.98 — the qualifier is what MATCHES
       and the amp is what the grant PAYS. It used to be `{...q, amp}`,
       which made `amp` show up as a qualifier ATOM in a census of what
       the pool emits and handed `qualMatches` a key that is not a
       question about the card. The other four single-shot grants have
       kept them apart since they were built. */
    assert.deepEqual(ops[0][1], {q: {g: [["wizard"]], nonAtk: true}, amp},
      "the AMOUNT IS THE CARD'S OWN: red prints plus 3, yellow 2, blue 1");
  }
});

test('"non-attack" contains "attack" — the qualifier must not ask for both', {skip}, () => {
  P.fxReset();
  const q = P.fxParse(stir()).ops[0][1].q;
  assert.equal(q.nonAtk, true);
  assert.equal(q.aac, undefined,
    '"action card" in the tail belongs to the SUBJECT phrase. Setting `aac` as well asks ' +
    "for a card that is both an attack action card and a non-attack one, which matches " +
    "nothing at all — v3.31's trap on the sibling grant");
});

test("the UNQUALIFIED sibling keeps its loose amp — it really is unqualified", {skip}, () => {
  /* Cindering Foresight prints "THE NEXT CARD you play this turn with an
     arcane damage effect". Two cards, one op, two printed scopes; folding
     only where a grant is present is what keeps both faithful. */
  P.fxReset();
  const ops = P.fxParse(H.card("Cindering Foresight", 1)).ops;
  assert.ok(ops.some(o => o[0] === "amp" && o[1] === 1),
    "Cindering Foresight must keep the bare `amp` — its printed subject is any next card");
  assert.ok(!ops.some(o => o[0] === "instantNext"),
    "and it grants no next-card window: its own speed grant is about THIS card (v3.36)");
});

/* ---- THE LEAK, WHICH IS WHY THE AMP RIDES ON THE GRANT ---------------- */

test("the amp lands ONLY on the card the grant names", {skip}, () => {
  const dmg = (nm, pitch, withStir) => {
    const c = H.card(nm, pitch);
    let g = H.state({res: 19, ap: 5, hand: [stir(), c]}, {},
                    {actor: 0, turnPlayer: 0, turn: 3, seed: "stir"});
    if(withStir) g = H.execute(g, stir(), "hand", 0, {});
    const hp0 = g.sides[1].hp;
    g = H.execute(g, c, "hand", 0, {});
    return hp0 - g.sides[1].hp;
  };

  /* A WIZARD NON-ATTACK ACTION CARD — it qualifies, so it is amped. */
  assert.equal(dmg("Ice Bolt", 1, true), dmg("Ice Bolt", 1, false) + 1,
    "Ice Bolt is an Ice WIZARD Action — exactly what the line names");

  /* THE CONTROL, AND IT IS THE ONE THAT BIT. Sigil of Suffering is a
     Runeblade DEFENSE REACTION: not Wizard, and not a non-attack ACTION
     card. It took the amp for as long as the amp sat loose. */
  assert.equal(dmg("Sigil of Suffering", 1, true), dmg("Sigil of Suffering", 1, false),
    "a Runeblade Defense Reaction must NOT be amped — it is neither Wizard nor a " +
    "non-attack action card, and while `amp` sat loose on the side it was");
});

test("an UNREADABLE tail refuses the whole clause, never a bare grant", {skip}, () => {
  /* v3.31's rule, on the fourth member of the family: `attackQual`
     returning false means "there is a restriction here I cannot read",
     which is a DIFFERENT answer from "nothing restricts this". Collapsing
     them yields a grant qualified only by `nonAtk` — one that frees EVERY
     non-attack action card at instant speed, which is the strongest thing
     on this list to get wrong.

     DRIVEN THROUGH `classifyClause` WITH SYNTHETIC TEXT, because no pool
     card prints an unreadable tail on this wording — so no fixture can
     reach the branch, and a sabotage of it changes nothing observable
     through a real card. */
  const read = t => P.classifyClause(t);

  assert.deepEqual(read("You may play your next Wizard non-attack action card this turn as though it were an instant").ops,
    [["instantNext", {q: {g: [["wizard"]], nonAtk: true}}]], "control: a readable tail reads");

  assert.equal(read("You may play your next Wizard non-attack action card with a purple sparkle this turn as though it were an instant"),
    null,
    "a tail with no reader must refuse the CLAUSE — leaving the card honestly unread and " +
    "visible in the audit, rather than emitting a grant with the restriction dropped");

  /* The tail atoms that DO have readers still work, so the refusal above
     is narrow rather than a reader that gave up. */
  assert.deepEqual(read("You may play your next attack action card with stealth this turn as though it were an instant").ops,
    [["instantNext", {q: {aac: true, kw: "stealth"}}]]);
});

/* ---- READ vs SPEND --------------------------------------------------- */

test("the grant is READ without being spent, and SPENT when the card is played", {skip}, () => {
  const q = {q: {g: [["wizard"]], nonAtk: true}, amp: 1};
  const bolt = H.card("Ice Bolt", 1);
  let g = H.state({res: 19, ap: 3, hand: [bolt], instantNextQ: [q]}, {},
                  {actor: 0, turnPlayer: 0, turn: 3});

  /* READING MUST NOT CONSUME. `playsAsInstant` is asked on every dim and
     every legality check, so a grant burned by looking at your hand is
     not a grant. */
  for(let i = 0; i < 5; i++) P.playsAsInstant(bolt, {grants: g.sides[0].instantNextQ});
  assert.equal(g.sides[0].instantNextQ.length, 1, "asking must not spend");

  g = H.execute(g, bolt, "hand", 0, {});
  assert.equal(g.sides[0].instantNextQ.length, 0, "playing a match spends it, exactly once");
});

test("a grant that does not match WAITS rather than being spent", {skip}, () => {
  /* v2.30's rule, kept by all four members of the family. */
  const q = {q: {g: [["wizard"]], nonAtk: true}, amp: 1};
  const bull = H.card("Wounded Bull", 1);            /* an attack */
  let g = H.state({res: 19, ap: 3, hand: [bull], instantNextQ: [q]}, {},
                  {actor: 0, turnPlayer: 0, turn: 3});
  g = H.execute(g, bull, "hand", 0, {});
  assert.equal(g.sides[0].instantNextQ.length, 1,
    "an attack is not what the line names, so the grant must still be waiting");
});

/* ---- THE WINDOW ------------------------------------------------------ */

test("the grant opens the instant window for the named card", {skip}, () => {
  const bolt = H.card("Ice Bolt", 1);
  const at = held => {
    const g = H.state({res: 19, ap: 0, hand: [bolt], instantNextQ: held}, {},
                      {actor: 1, turnPlayer: 1, turn: 3, builds: [{}, {}]});
    return {...g, phase: "action", step: "layer", priority: 0, passed: []};
  };
  const q = {q: {g: [["wizard"]], nonAtk: true}, amp: 1};
  const act = {t: "play", uid: bolt.uid, from: "hand"};

  assert.ok(J.legal(at([]), act, 0),
    "without the grant an action card is refused on the opponent's turn");
  assert.equal(J.legal(at([q]), act, 0), null,
    "holding the grant, the same card in the same window is legal");

  /* AND THE QUALIFIER STILL REFUSES (v3.98). Without a fixture that asks
     for a REFUSAL, `playsAsInstant` reading the whole entry instead of
     its `.q` is silent: `qualMatches` passes every field test vacuously
     on an object with no qualifier keys, so the window opens for
     everything — a printed restriction dropped in the one place it
     decides whether a card may be played at all. */
  const bull = H.card("Wounded Bull", 1);          /* an ATTACK — not what the line names */
  const atBull = held => {
    const g = H.state({res: 19, ap: 0, hand: [bull], instantNextQ: held}, {},
                      {actor: 1, turnPlayer: 1, turn: 3, builds: [{}, {}]});
    return {...g, phase: "action", step: "layer", priority: 0, passed: []};
  };
  assert.ok(J.legal(atBull([q]), {t: "play", uid: bull.uid, from: "hand"}, 0),
    "the grant names a NON-ATTACK, so an attack is still refused in that window");
  /* the control: with a qualifier that DOES match an attack, it is legal */
  const qAtk = {q: {aac: true}, amp: 0};
  assert.equal(J.legal(atBull([qAtk]), {t: "play", uid: bull.uid, from: "hand"}, 0), null,
    "…so the refusal above is the QUALIFIER, not the window");

  /* AND NO ACTION POINT IS CHARGED — the seat has none to charge. Same
     reductio as v3.36: a grant that still cost one could never be used. */
  const out = J.reduce(at([q]), act, 0);
  assert.equal(out.error, null, "reduce must agree with legal (fuzz.test.js's property)");
  assert.equal(out.state.sides[0].ap, 0, "no action point charged (CR 8.1.6)");
});

/* ---- THE FIELD ------------------------------------------------------- */

test("instantNextQ is a real side field — both seats, wire and report", {skip}, () => {
  /* v3.29: a side field is not real until three places carry it —
     SIDE_FIELDS (or invariants reports SIDES-ASYMMETRIC), wire.js (a
     dropped field is a desync) and report.js's seat(). */
  const sd = S.makeSide({});
  assert.deepEqual(sd.instantNextQ, [], "it defaults empty on every seat");
  const gap = S.symmetryGap();
  assert.ok(gap.player.includes("instantNextQ") && gap.opponent.includes("instantNextQ"),
    "both seats must carry it or a second human cannot occupy one");

  /* ASKED OF THE REAL EXPORT, not of the file's text: wire.js names its
     non-card side fields in `NON_CARD_SIDE_FIELDS`, and a grep would be
     satisfied by this drill's own name appearing in a comment there. */
  const W = require("../engine/wire.js");
  assert.ok((W.NON_CARD_SIDE_FIELDS || []).includes("instantNextQ"),
    "wire.js must ship it — a field dropped on the wire is a silent desync, which is the " +
    "one failure a state hash cannot describe usefully");

  /* report.js's seat() is a literal, so this half can only be read. */
  assert.match(require("fs").readFileSync(
    require("path").join(__dirname, "..", "engine", "report.js"), "utf8"), /instantNextQ/,
    "report.js's seat() must name it — a report that silently omits state is worse than none");
});

test('it expires with the turn — the card prints "this turn"', {skip}, () => {
  const q = {q: {g: [["wizard"]], nonAtk: true}, amp: 1};
  const g = H.state({instantNextQ: [q]}, {instantNextQ: [q]}, {});
  const out = E.beginEndPhase(g, 0);
  assert.equal((out.game.sides[0].instantNextQ || []).length, 0,
    "an unspent grant must not survive the turn it was printed for");
  assert.equal((out.game.sides[1].instantNextQ || []).length, 0,
    "BOTH seats — CR 4.4.3e clears for all players, and a hero who banks a grant during " +
    "your turn must not keep it into their own (v3.34's rule, sixth grant)");
});
