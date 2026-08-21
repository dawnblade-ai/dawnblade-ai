/* ============================================================
   SIGIL OF SILPHIDAE — "another" is an exclusion, and the LEAVE
   trigger is where it earns its keep.

     Go again
     When this enters or leaves the arena, you may banish another
     aura from your graveyard. If you do, deal 1 arcane damage to
     target hero.
     At the beginning of your action phase, destroy this.

   ONE PRINTED CLAUSE, TWO SCHEDULES. The enters half is `execute`'s;
   the leaves half is `sweepArena`'s, because the card's own printed
   clock is what takes it away — a schedule is written per board, so
   the trigger name is shared and the two sites are not.

   THE SELF-EATING CASE IS THE POINT. By the time the leave trigger
   asks, `sweepArena` has already filed the Sigil into the graveyard
   it is banishing FROM — it is an Aura sitting among the legal
   choices, looking at itself. Without the exclusion it pays its own
   cost and collects a free point of arcane damage every single turn.

   These assert on ZONES and CANDIDATE LISTS, never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");

const P  = require("../engine/parser.js");
const PR = require("../engine/prompts.js");
const E  = require("../engine/effects.js");
const H  = require("./helpers/judged.js");

const skip = H.hasDb() ? false : "no card database";

const SIGIL = () => Object.assign({}, H.card("Sigil of Silphidae", 3), {uid: "sig1"});
/* A REAL aura, from the pool, to stand beside it in the graveyard.
   Without a legal choice present an empty candidate list proves
   nothing — it cannot tell "the Sigil was correctly excluded" from
   "there was never anything there". */
const OTHER = () => Object.assign({}, H.card("Booze!", 3), {uid: "other1"});

/* ---- 1. the printed clause is read, and read as an exclusion ------- */

test("the clause is read: one trigger naming two events, and 'another' is carried", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(SIGIL());
  assert.ok(fx.optCost, "the enters-or-leaves trigger must be in the pairing's alternation");
  assert.equal(fx.optCost.trigger, "entersLeaves");
  assert.equal(fx.optCost.kind, "banish");
  assert.equal(fx.optCost.zone, "grave");
  assert.equal(fx.optCost.filter.notSelf, true,
    "'another' must be CARRIED — flattened away, the Sigil banishes itself");
  assert.deepEqual(fx.optCost.ops, [["arcane", 1]]);
  /* THE UID MUST NOT BE IN THE PARSE. `fxParse` memoizes on name|pitch,
     so one parse serves every copy of the card in the match; a uid
     stored here would name whichever copy was parsed first and go on
     excluding that one forever. */
  assert.equal(fx.optCost.filter.notUid, undefined,
    "the uid belongs to the queue site — the parse is shared by every copy");
});

/* ---- 2. THE LEAVE TRIGGER, and the card it must not eat ----------- */

function swept(){
  const g = H.state(
    {board: [{card: SIGIL(), sd: "turn"}], grave: [OTHER()]},
    {},
    {turn: 3});
  return E.sweepArena(g, 0, "turn");
}

test("leaving the arena queues the choice, addressed to the controller", {skip}, () => {
  const out = swept();
  const pp = out.ops.filter(o => o[0] === "pickPrompt");
  assert.equal(pp.length, 1, "the leave half of the printed clause must fire");
  assert.equal(pp[0][1].side, 0, "the choice belongs to the Sigil's controller");
  assert.equal(pp[0][1].zone, "grave");
  assert.equal(pp[0][1].to, "banish");
  assert.equal(pp[0][1].min, 0, "'you may' — declining must stay possible");
  assert.deepEqual(pp[0][1].ops, [["arcane", 1]], "the rider rides with it");
});

test("THE SELF-EATING CASE — the Sigil is in its own graveyard and is excluded", {skip}, () => {
  const out = swept();
  /* the state really did file it there — that is what makes this live */
  assert.ok(out.game.sides[0].grave.some(c => c.uid === "sig1"),
    "sweepArena files the departing card into the graveyard before the ops run");

  const spec = out.ops.find(o => o[0] === "pickPrompt")[1];
  assert.equal(spec.filter.notUid, "sig1", "the queue site supplies the uid the parse must not");

  const pr = PR.buildPrompt(out.game, Object.assign({tag: "pick", src: "Sigil of Silphidae"}, spec));
  assert.ok(pr, "there is a legal choice, so the sheet must open");
  const uids = pr.cards.map(c => c.uid);
  assert.ok(!uids.includes("sig1"),
    "the Sigil must NOT be able to banish itself for a free point of arcane damage");
  assert.deepEqual(uids, ["other1"], "the other aura in the graveyard is the only legal choice");
});

/* ---- 3. THE SAFETY PROPERTY — a flag with no uid refuses ---------- */

test("a notSelf filter that was never given a uid refuses every candidate", {skip}, () => {
  const g = H.state({grave: [OTHER(), SIGIL()]}, {}, {turn: 3});
  /* the same spec with the uid withheld — a queue site that forgot to
     thread it. Offering the source is STRONGER than printed, so the
     honest failure is an empty pool and a sheet that skips itself. */
  const pr = PR.buildPrompt(g, {tag: "pick", side: 0, src: "x", zone: "grave",
    to: "banish", min: 0, max: 1, filter: {notSelf: true, tt: "aura"}});
  assert.equal(pr, null,
    "no uid means no exclusion can be enforced — refuse rather than offer the source");
  /* the control: the identical spec WITH a uid does open, so the refusal
     above is about the missing uid and not about an empty zone. */
  const ok = PR.buildPrompt(g, {tag: "pick", side: 0, src: "x", zone: "grave",
    to: "banish", min: 0, max: 1, filter: {notSelf: true, tt: "aura", notUid: "sig1"}});
  assert.ok(ok && ok.cards.length === 1 && ok.cards[0].uid === "other1");
});

/* ---- 4. the ENTERS half, and a second copy IS a legal choice ------ */

test("entering the arena queues the same choice", {skip}, () => {
  P.fxReset();
  const g = H.state({hand: [SIGIL()], grave: [OTHER()], res: 9, ap: 1}, {}, {turn: 3});
  const n = H.execute(g, SIGIL(), "hand", 0, {});
  const q = (n.promptQ || []).concat(n.prompt ? [n.prompt] : []);
  assert.ok(q.length, "playing the aura must offer the cost on the way IN as well as out");
});

test("'another' means another OBJECT — a second copy in the graveyard is legal", {skip}, () => {
  /* two copies of one card are two objects, so the exclusion is by uid
     and never by name. Excluding the name would refuse a legal choice. */
  const twin = Object.assign({}, H.card("Sigil of Silphidae", 3), {uid: "sig2"});
  const g = H.state({grave: [twin]}, {}, {turn: 3});
  const pr = PR.buildPrompt(g, {tag: "pick", side: 0, src: "Sigil of Silphidae", zone: "grave",
    to: "banish", min: 0, max: 1, filter: {notSelf: true, tt: "aura", notUid: "sig1"}});
  assert.ok(pr, "a DIFFERENT copy of the same card is a legal choice");
  assert.deepEqual(pr.cards.map(c => c.uid), ["sig2"]);
});
