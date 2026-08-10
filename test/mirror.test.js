/* ============================================================
   mirror.test.js — the SOLO MIRROR (v2.63) held to its own claims.

   With a hero in seat 1 the opponent plays real cards, and every
   rule that used to be asked of one seat is now asked of two. A
   three-tester round on v2.64 found five ways that had gone wrong,
   and what they had in common is that NO EXISTING DRILL COULD SEE
   ANY OF THEM:

     - the coverage audit counts clauses consumed, not who consumed
       them;
     - `npm run fairness` is deliberately one-sided;
     - `invariants.js` audits STATE, and the worst of the five was a
       control-flow dead end, which is not an illegal state at all
       (`__dawnJudge` stayed empty for the whole soft-locked game).

   So the drills here pin the seat and the gate, never the log line.
   Two kinds, and the split is forced rather than chosen: what lives
   in `engine/` is driven for real, and what is still a closure
   inside `Battle` is pinned by reading the source — the same
   compromise test/actor.test.js and test/sides.test.js already make.
   Each one below was proven to bite by reintroducing the bug it
   describes and watching it go red.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const RNG = require("../engine/rng.js");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* ---- the engine half: driven for real ------------------------------- */

function stubCtx(over){
  const base = {
    L: (s, msg) => ({...s, log: [msg, ...(s.log || [])], feed: [...(s.feed || []), msg]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => ({runeDmg: 1, atkPowOffChain: 0, mightOnFirst6Discard: false}),
    bFoe: () => ({runeDmg: 1, atkPowOffChain: 0, mightOnFirst6Discard: false}),
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

/* `fxParse` memoizes on `name|pitch`, so every card a drill invents needs
   a UNIQUE name or two drills silently share one answer. */
let seq = 0;
const card = over => Object.assign({
  name: "Drill Card " + (++seq), uid: 100 + seq, pitch: 1, cost: 0, power: 4,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: ""
}, over || {});

function twoSeats(){
  const side = who => ({name: who, hp: 20, res: 0, ap: 1, amp: 0, ward: 0, awd: 0,
    buffNext: 0, int: 4, hand: [], deck: [], grave: [], banish: [], pitch: [],
    board: [], soul: [], counters: {}, hist: {}, gear: []});
  return {sides: [side("you"), side("them")], actor: 0, turn: 3,
    log: [], feed: [], rng: RNG.make("mirror-drill")};
}

test("payAddCost is EXPORTED — the mirror's only honest way to pay it", () => {
  const fx = E.makeEffects(stubCtx());
  assert.strictEqual(typeof fx.payAddCost, "function",
    "foePlay reaches this through _EFX; unexported, the trainer would need a second copy");
});

for(const seat of [0, 1]){
  test(`payAddCost discards from the ACTING seat — actor ${seat}`, () => {
    const efx = E.makeEffects(stubCtx());
    const g = twoSeats();
    g.actor = seat;
    const mine = [card({name: "Fodder A" + seat}), card({name: "Fodder B" + seat})];
    const theirs = [card({name: "Bystander " + seat})];
    g.sides[seat].hand = mine;
    g.sides[1 - seat].hand = theirs;

    const played = card({name: "Feast " + seat, tx: "As an additional cost to play this discard a random card."});
    const out = efx.payAddCost(g, played, {addCost: {discard: 1, random: true}});

    assert.strictEqual(out.discarded.length, 1, "exactly the printed number is paid");
    assert.strictEqual(out.game.sides[seat].hand.length, 1, "the ACTING seat pays out of its own hand");
    assert.strictEqual(out.game.sides[seat].grave.length, 1, "and it lands in the acting seat's graveyard");
    /* The half that makes it a real cost rather than a reshuffle: the other
       seat is untouched. Without the actor borrow in foePlay this is where
       seat 0 was quietly paying seat 1's bills. */
    assert.strictEqual(out.game.sides[1 - seat].hand.length, 1, "the other seat's hand is untouched");
    assert.strictEqual(out.game.sides[1 - seat].grave.length, 0, "and its graveyard is untouched");
  });
}

test("payAddCost stamps _disc — an additional-cost discard is a DISCARD", () => {
  const efx = E.makeEffects(stubCtx());
  const g = twoSeats();
  g.actor = 1;
  g.sides[1].hand = [card({name: "Stamped Fodder"})];
  const out = efx.payAddCost(g, card({name: "Feast Stamped"}), {addCost: {discard: 1, random: true}});
  const gone = out.game.sides[1].grave[0];
  /* `gyDisc`, not `gy`. Kayo's whole identity asks "have you discarded a
     card with 6 or more {p} this turn", and `had6ThisTurn` requires BOTH
     `_gy === turn` and `_disc` — an attack reaches the graveyard at
     declaration, so the stamp is what tells a cost from a corpse. */
  assert.strictEqual(gone._disc, true, "stamped as a discard");
  assert.strictEqual(gone._gy, g.turn, "and turn-stamped, or the 6+ family cannot see it");
  assert.ok((out.game._discWay || []).length === 1, "_discWay carries it for the discard6way riders");
});

test("payAddCost stores the rng back — a stalled stream repeats the last draw", () => {
  const efx = E.makeEffects(stubCtx());
  const g = twoSeats();
  g.sides[0].hand = [card({name: "Rng Fodder A"}), card({name: "Rng Fodder B"})];
  const before = g.rng.n;
  const out = efx.payAddCost(g, card({name: "Feast Rng"}), {addCost: {discard: 1, random: true}});
  assert.ok(out.game.rng.n > before,
    "a random discard must consume the seeded stream, or a replay diverges");
});

/* ---- the trainer half: pinned by reading the source ------------------
   These four live inside `Battle`'s React closures and cannot be
   required from Node. A source guard is weaker than driving the code,
   so each pins the GATE that was missing rather than an identifier
   that survives deleting it. */

function slice(from, to){
  const a = HTML.indexOf(from);
  assert.ok(a >= 0, "anchor moved, and a guard aimed at nothing PASSES: " + from);
  const b = HTML.indexOf(to, a + 1);
  assert.ok(b > a, "closing anchor moved: " + to);
  return HTML.slice(a, b);
}

test("the no-play branch still ends the turn — the soft-lock (v2.65, v2.71)", () => {
  /* THE BUG: the branch returned a bare `mode:"act"`. Seat 1's hand only
     refilled in `newTurn` and `foePick` needs a hand — so once it fired it
     could never un-fire. The turn counter froze and END TURN reproduced the
     identical position forever. Found in play and only findable there: a
     control-flow dead end is not an illegal STATE, so invariants.js cannot
     see it by construction.

     v2.71 moved the branch into `foeWindowOrEnd`, which either opens the
     player's window or ends the turn — so the property is now that BOTH
     exits reach `foeEnd`, and that `foeEnd` reaches `newTurn`. Every exit
     is pinned; a new `return` that reaches neither is the bug returning. */
  const win = slice("  function foeWindowOrEnd(s, why){", "  function foeEnd(s){");
  assert.ok(/foeEnd\(/.test(win),
    "the branch where the opponent cannot pay must still be able to END THE TURN");
  assert.ok(/mode\s*:\s*"foeturn"/.test(win),
    "and its other exit is the player's window, which foePassWindow closes into foeEnd");
  const end = slice("  function foeEnd(s){", "  const toggleBlock = ");
  assert.ok(/newTurn\(/.test(end), "foeEnd must hand back through newTurn");
  /* PIN THE GATE, NOT THE IDENTIFIER. Written as /_opening/ this passed
     with the whole guard deleted, because the COMMENT above it says the
     word — the scan reads raw source, prose included. Proven by sabotage. */
  assert.ok(/if\(n\._opening\)\s*\{/.test(end) && /_opening\s*:\s*false/.test(end),
    "and must CONSUME _opening on that path: takeIt never runs here, so nothing else clears it");
  /* The window must be able to skip ITSELF, or the vanilla dummy costs the
     player a dead tap on every turn of every game. */
  assert.ok(/foeTurnHasPlay\(/.test(win),
    "a window with nothing in it must not open — buildPrompt's own rule");
});

test("foePick asks the printed gate, not just type and affordability", () => {
  const body = slice("  function foePick(n){", "  function foePlay(s, card){");
  /* THE BUG: Bear Hug and Run Roughshod both print "Play this only if …"
     and both swung with the gate unmet — sev-3 illegal play allowed. */
  assert.ok(/playIfOk\(/.test(body), "foePick must consult the playIf gate");
  assert.ok(/actor\s*:\s*1/.test(body),
    "and must ask it AS SEAT 1 — at the ambient actor it reads the player's board");
});

test("foePlay pays an additional cost before it resolves the card", () => {
  const body = slice("  function foePlay(s, card){", "  function autoPitch(s, cost, keepUid){");
  assert.ok(/payAddCost\(/.test(body),
    "an additional cost is a COST — Savage Feast's discard was never paid");
  assert.ok(/addCost/.test(body) && /actor\s*:\s*1/.test(body),
    "paid out of seat 1's hand, via the borrow");
});

test("promptConfirm pays out to the prompt's SIDE, not always to seat 0", () => {
  const body = slice("  const promptConfirm = () => setG(s=>{", "  const promptDecline = ");
  /* THE BUG: `spec.side` has meant "whose call is this" since v2.17, but
     this function charged `youMut` and ran the ops at the ambient actor.
     The opponent's Beaten Trackers modal was drained on the PLAYER's next
     execute, so the player collected the action point and the opponent
     kept the gear it was printed to destroy. */
  assert.ok(/p\.side/.test(body), "the prompt's side must be read");
  assert.ok(/actor:\s*pSide/.test(body), "and borrowed for the payout");
  assert.ok(!/const ps = youMut\(n\)/.test(body),
    "the payment must not be hardcoded to seat 0");
});

test("the next-swing prediction is gated on there being no real hero", () => {
  const body = slice('{g.mode==="block" ? "INCOMING "', "</span>");
  /* THE BUG: the [3,4,5] escalation table was read unconditionally, so the
     board announced "NEXT SWING 3" while a real hero swung for 7. A real
     opponent's next card is not knowable — say nothing rather than a lie. */
  assert.ok(/oppH/.test(body),
    "the scripted escalation must not be shown for a hero that plays real cards");
});

/* ===================================================================
   SEAT 1 TAKES A TURN (v2.71)

   The five mechanics `parser.js` filed `noop` — arcane barrier, frostbite,
   inertia, freeze, and "target hero may pay" — all carried the SAME
   justification, and it was a fact about the prop rather than about the
   rules: the dummy has no action phase, the dummy pays no costs. These
   pin the phase they were waiting for.

   Source scans, because foeBegin/foeStep/foeEnd are closures inside
   Battle and Node cannot reach them. So: pin the GATE, never a bare
   identifier, and every one of these was sabotaged.
   =================================================================== */

test("seat 1's turn is a TURN — start phase, action point, end phase", () => {
  const begin = slice("  function foeBegin(s){", "  function foeStep(s){");
  /* CR 4.3.2 — the action point is issued at the beginning of the action
     phase, for whoever's phase it is. Without one, foeStep can never let
     it act and Inertia has nothing to tax. */
  assert.ok(/oppMut\(n\)\.ap\s*=\s*1/.test(begin),
    "seat 1 must receive an action point at the start of its action phase");
  /* CR 4.4.4 — hist is per-turn AND per-seat. Cleared for the incoming
     seat only, "…this turn" reads the wrong turn all through theirs. */
  assert.ok(/oppMut\(n\)\.hist\s*=\s*freshHist\(\)/.test(begin),
    "and a fresh hist, or '…this turn' reads seat 1's PREVIOUS turn");
});

test("the vanilla escalation spends the action point — one swing per turn", () => {
  /* THE REGRESSION THIS EXISTS FOR: finishBlock now returns to foeStep so
     go again can chain a second link. Without the escalation spending its
     point, foeStep would call it again and the tuned [3,4,5] curve would
     swing forever. Verified in play: 3 swings across 3 turns. */
  const van = slice("  function foeVanilla(s){", "  function foeWindowOrEnd(s, why){");
  assert.ok(/oppMut\(n\)\.ap\s*=\s*opp\(n\)\.ap\s*-\s*1/.test(van),
    "the scripted swing must spend the action point or it repeats forever");
  assert.ok(/\[3,4,5\]\[\(n\.turn-1\)%3\]/.test(van),
    "and the tuned curve itself is untouched — it is what difficulty is built on");
});

test("a go again attack lets seat 1 chain a second link (CR 5.3.5)", () => {
  const play = slice("  function foePlay(s, card){", "  function autoPitch(s, cost, keepUid){");
  /* GO AGAIN IS A GAIN, NOT A REFUND — `ga ? keep : -1` cannot say +1, and
     spelling it out is what makes an instant cost nothing (CR 8.1.6). */
  assert.ok(/opp\(n\)\.ap\s*-\s*1\s*\+\s*\(_fga\s*\?\s*1\s*:\s*0\)/.test(play),
    "the action point is spent and go again GAINS one back");
  /* hasKwNow, not raw text: a conditionally-granted go again must not hand
     seat 1 a free action it has not earned (the v2.31 shape). */
  assert.ok(/hasKwNow\(card,\s*"go again"\)/.test(play),
    "read through the keyword gate, never off raw printed text");
});

test("seat 1's end phase is the SAME procedure, not a second copy", () => {
  const end = slice("  function foeEnd(s){", "  const toggleBlock = ");
  assert.ok(/endPhaseCF\(n,\s*1\)/.test(end),
    "foeEnd must drive the shared CR 4.4.3 (c)-(f), or a rule fixed in one stays broken in the other");
  assert.ok(/endPhaseAllies\(n\)/.test(end), "(a) is shared too");
  assert.ok(/arsFree\(opp\(n\)\)/.test(end),
    "(b) must ask arsenal CAPACITY, not assume the slot count is 1");
});

test("the stand-in refill is GONE from newTurn — or seat 1 draws twice", () => {
  /* ROADMAP-OPPONENT.md's own warning: "the moment seat 1 gets a real end
     phase this draw MOVES there. Adding that one without removing this one
     draws twice." This is the removal half, and it is the half that is
     invisible in play — two draws just looks like a generous opponent. */
  const nt = slice("  function newTurn(s){", "  const toks = [");
  assert.ok(!/opp\(s\)\.int\s*-\s*oHand\.length/.test(nt) && !/refilled\.hand/.test(nt),
    "newTurn must no longer refill seat 1 — endPhaseCF's (f) does");
  const cf = slice("  function endPhaseCF(s, si){", "  function afterArsenal(s){");
  assert.ok(/act\(n\)\.int\s*-\s*act\(n\)\.hand\.length/.test(cf),
    "and the end phase must actually draw the ending seat to ITS intellect");
});

test("the end phase is actor-relative, so neither seat is hardcoded", () => {
  const cf = slice("  function endPhaseCF(s, si){", "  function afterArsenal(s){");
  assert.ok(!/youMut\(|oppMut\(/.test(cf),
    "a perspective helper here means the procedure only ever runs for one seat");
  assert.ok(/\{\.\.\.s,\s*actor:si\}/.test(cf) && /actor:_prevActor/.test(cf),
    "the actor is borrowed for the procedure and handed straight back");
});
