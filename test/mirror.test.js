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
  const body = slice("  function foePlay(s, card){", "  const autoPitch = _EFX.autoPitch;");
  assert.ok(/payAddCost\(/.test(body),
    "an additional cost is a COST — Savage Feast's discard was never paid");
  assert.ok(/addCost/.test(body) && /actor\s*:\s*1/.test(body),
    "paid out of seat 1's hand, via the borrow");
});

test("promptConfirm pays out to the prompt's SIDE, not always to seat 0", () => {
  /* THE BODY MOVED to engine/effects.js in v2.77 (`applyAnswer`), so a
     guard aimed at index.html would now find only the setG wrapper — and
     a source guard aimed at the wrong file PASSES BY FINDING NOTHING.
     Repointed, with both anchors asserted found. */
  const EFFECTS = require("./helpers/extract.js").effects();
  const a0 = EFFECTS.indexOf("  const applyAnswer = (s, prompt) => {");
  const b0 = EFFECTS.indexOf("  const fileAttack = (s2, card, from) => {");
  assert.ok(a0 > 0 && b0 > a0, "anchors moved — repoint this drill deliberately");
  const body = EFFECTS.slice(a0, b0);
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
  const play = slice("  function foePlay(s, card){", "  const autoPitch = _EFX.autoPitch;");
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

/* ===================================================================
   INSTANT-SPEED ACTIVATION ON THEIR TURN (v2.71, step 2)

   Spellfire Cloak prints "Activate this ability only during an
   opponent's turn". `fx.activateIf.kind === "foeTurn"` has read that
   gate since v2.x — and the ONLY function that consults it, `tryPlay`,
   refuses outright while `mode === "block"`. So the gate named a window
   the engine could never be in when it was asked. It is Iyslander's only
   Chest piece: equipped in every game she plays, dead in every one.
   =================================================================== */

/* THE GATE IS A FUNCTION NOW, SO DRIVE IT.

   Written as a grep for `activateInstant(gr.powCard,"hero",i)` this drill
   went GREEN with the whole route disabled — replacing `if(instAb)` with
   `if(false)` leaves the call text sitting right there for the scan to
   find. A false PASS, which is worse than no drill, and exactly the trap
   HANDOFF.md's rule 4b names. `parser.instantAbilityReady` was extracted
   so the decision can be called instead of read. */
test("instantAbilityReady: the printed facts, and only those", () => {
  const P = require("../engine/parser.js");
  const sd = used => ({weaponUsed: used || {}});
  const piece = over => Object.assign({
    uid: 7, pow: true, destroyed: false,
    powCard: {uid: "gp7", _instant: true}
  }, over || {});

  assert.equal(P.instantAbilityReady(piece(), sd()), true, "a fresh instant ability is available");
  assert.equal(P.instantAbilityReady(piece({destroyed: true}), sd()), false,
    "a shattered piece has no ability left — Spellfire Cloak destroys itself to pay");
  assert.equal(P.instantAbilityReady(piece({powCard: {uid: "gp7", _instant: false}}), sd()), false,
    "an ACTION-speed ability is not legal in an instant window (CR 8.1.1 vs 8.1.6)");
  assert.equal(P.instantAbilityReady(piece({pow: false}), sd()), false, "no ability, no route");
  /* The flag is namespaced "gp"+uid so it cannot collide with the piece's
     own swing; reading the bare uid would let a spent ability fire twice. */
  assert.equal(P.instantAbilityReady(piece(), sd({gp7: true})), false, "already used this turn");
  assert.equal(P.instantAbilityReady(piece(), sd({7: true})), true,
    "the WEAPON's swing flag is a different limit and must not block the ability");
  assert.equal(P.instantAbilityReady(null, sd()), false, "and it tolerates an empty slot");
});

test("both callers ask instantAbilityReady rather than re-deriving it", () => {
  const gb = slice("  const gearBtn = (gr,i,extra,st) => {", "  const handAct = (c,i) => {");
  assert.ok(/const instAb = instantAbilityReady\(gr, you\(g\)\)/.test(gb),
    "the tap route reads the shared gate");
  assert.ok(/if\(instAb\)\s*\n\s*return tapTwice\(gr\.powCard/.test(gb),
    "and the ability branch is guarded BY it — pin the gate, not the call");
  /* CR 7.3.3 gives priority to the turn-player in the defend step, so
     declaring a defender must still win there. */
  assert.ok(gb.indexOf('blockable && g.bphase==="defend"') < gb.indexOf("if(instAb)"),
    "declaring a defender is tested first, or iron stops being able to block");
  const h = slice("  function foeTurnHasPlay(s){", "  /* ---- SEAT 1'S TURN");
  assert.ok(/instantAbilityReady\(gr, you\(s\)\)/.test(h),
    "and so does the window-opening check, or the two can disagree");
});

test("activateInstant asks priority.js for the window, and restores it", () => {
  const ai = slice("  const activateInstant = (card, from, idx) => setG(s=>{", "  function activateIfOk(s, g2){");
  /* CR 8.1.6 asked of the module that owns it. Restating it here is how
     five copies of "may this be played here" drifted apart pre-rxAllowed. */
  assert.ok(/DawnPriority\.speedAllowed\(s,\s*0\)\.includes\("instant"\)/.test(ai),
    "the window is priority.js's question, never a hand-rolled mode test");
  assert.ok(/execute\(paid, card, from, idx\)/.test(ai),
    "and the card's semantics come from execute — there is ONE copy of those");
  /* v2.72 had to capture and restore `mode`/`bphase` around this call,
     because `execute` opened with `mode:"act"` and leaving that would hand
     the player their own action phase in the middle of the opponent's turn
     (sev-3, illegal play allowed). v2.73 split the phase out of `execute`
     entirely, so the window simply survives and the workaround is GONE.
     Pinned in the negative: if a `mode:` write reappears in this function,
     something has started advancing the turn from inside an instant. */
  /* Comments stripped first — this function's prose is ABOUT the phase
     handling it no longer does, so a raw scan reads the bug it documents.
     Trap 4b, in the direction where a comment causes a false FAIL. */
  const aiCode = ai.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/mode\s*:/.test(aiCode),
    "activateInstant must not need to restore a window execute no longer touches");
});

test("engine/effects.js states no PHASE — that is the whole of the split", () => {
  const fs = require("fs"), path = require("path");
  const raw = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* Comments are stripped first: this module's prose is ABOUT the phases it
     used to write, so a scan that reads them reports the bug it documents.
     Same discipline as sync.test.js's and html-balance.test.js's. */
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const writes = code.match(/mode\s*:\s*"|\.mode\s*=\s*"/g) || [];
  assert.deepEqual(writes, [],
    "a card effect must never say what phase the game is in — that is the caller's, " +
    "and it is the one thing that kept judge.js from ever calling these semantics");
  /* THE LIST SHRANK IN v2.77 and this is a deliberate edit to the ledger.
     Two reads went, and each was a place where a caller driving
     `phase`/`step` would have been refused by a vocabulary it does not
     speak:

       .mode!=="stack"   resolveStack's own guard, and a duplicate of the
                         test the trainer's wrapper already makes one line
                         above the call. The honest question is `!s.pend`
                         — is there a link to resolve.
       .mode==="block"   the "-N power" shave. Whether there is a hostile
                         attack in flight is not a phase question; it is
                         `pend.by !== actorOf` for judge.js and `incoming`
                         for the trainer, and both are now named.

     What is left is ONE shape, and it is honest about being a fallback:
       .mode==="block" / .mode==="foeturn"
                         inside the foeTurn CONDITION, reached only when a
                         state carries no priority fields (every drill that
                         hand-rolls one). The real answer is
                         `turnPlayer !== actorOf`, which is why the pair
                         may look redundant and is not. */
  const reads = (code.match(/\.mode\s*[!=]==?\s*"[a-z]+"/g) || []).sort();
  assert.deepEqual(reads,
    ['.mode==="block"', '.mode==="foeturn"'].sort(),
    "effects.js's remaining mode READS are pinned — adding one is a deliberate edit");

});

test("the activateIf gate has ONE reader, asked by both windows", () => {
  const tp = slice("      const afx = fxParse(card);", "      const pif = afx.playIf;");
  assert.ok(/activateIfOk\(s, g2\)/.test(tp),
    "tryPlay must not re-implement the gate beside activateInstant's copy");
  const ok = slice("  function activateIfOk(s, g2){", "\n  }\n");
  /* "Not your turn" is BOTH their combat window and their action phase.
     Reading it as mode==="block" alone meant the ability was unreachable
     on any turn the opponent did not attack. */
  assert.ok(/g2\.kind==="foeTurn"\s*\?\s*\(s\.mode==="block" \|\| s\.mode==="foeturn"\)/.test(ok),
    "foeTurn must cover their action phase as well as their combat window");
});

test("perTurnCleared has one home, and the trainer uses it", () => {
  const P = require("../engine/parser.js");
  assert.strictEqual(typeof P.perTurnCleared, "function",
    "it reads a printed line, which is parser.js's job");
  /* A TAP and a per-turn ALLOWANCE expire differently (CR 4.4.3d). They
     coincide for a weapon swing and stop coinciding at the first
     `Instant - Once per Turn` equipment ability — Crucible of
     Aetherweave, in Iyslander's gear, now activatable on their turn.
     Without this the allowance would come back once per ROUND. */
  const tapped = {gear:[{uid:"w1", tx:"Once per Turn Instant - {t}: Do a thing."}],
                  weaponUsed:{w1:true}};
  assert.deepEqual(P.perTurnCleared(tapped), {w1:true}, "a TAP survives the turn boundary");
  const allowance = {gear:[{uid:"w2", tx:"Once per Turn Instant - {r}: Do a thing."}],
                     weaponUsed:{w2:true}};
  assert.deepEqual(P.perTurnCleared(allowance), {}, "a per-turn ALLOWANCE comes back");
  /* AN ABILITY'S FLAG IS NAMESPACED — "gp"+uid, so it cannot collide with
     the piece's own swing. The gear lookup therefore has to strip it: with
     the bare uid the piece is never found, every ability entry falls
     through as an allowance, and a TAPPED ability silently untaps at the
     wrong seat's turn boundary. The fixture above cannot see that — its
     uids carry no prefix — so it is asked explicitly here. */
  const tappedAbility = {gear:[{uid:9, tx:"Once per Turn Instant - {t}: Do a thing."}],
                         weaponUsed:{gp9:true}};
  assert.deepEqual(P.perTurnCleared(tappedAbility), {gp9:true},
    "a tapped ABILITY is still tapped, and its namespaced flag must resolve to its piece");
  const allowanceAbility = {gear:[{uid:9, tx:"Once per Turn Instant - {r}: Do a thing."}],
                            weaponUsed:{gp9:true}};
  assert.deepEqual(P.perTurnCleared(allowanceAbility), {},
    "and a NON-tapping ability's allowance still comes back — Crucible of Aetherweave");
  const cf = slice("  function endPhaseCF(s, si){", "  function afterArsenal(s){");
  assert.ok(/foeMut\(n\)\.weaponUsed = perTurnCleared\(foe\(n\)\)/.test(cf),
    "the NON-ending seat keeps its taps and loses its allowance at the boundary");
});

test("the foeturn window will not open on an ability whose gate is unmet", () => {
  const h = slice("  function foeTurnHasPlay(s){", "  /* ---- SEAT 1'S TURN");
  assert.ok(/activateIfOk\(s, afx\.activateIf\)/.test(h),
    "a piece whose printed gate is unmet must not open a window it cannot be used in");
  assert.ok(/effCost\(gr\.powCard, you\(s\)\)\s*<=\s*bank/.test(h),
    "nor one the player cannot pay for, even counting what they could pitch");
});

test("going second still opens turn 1 with an action point (CR 4.3.2)", () => {
  /* THE BUG, found by playing and invisible to every drill and to
     invariants.js: seat 1's end phase (v2.71) correctly zeroes BOTH
     players' points (CR 4.4.3e), and the opponent-first opening hands over
     WITHOUT ticking the clock — so it never passes through `newTurn`,
     which is where every other turn is issued its point. Going second
     meant opening turn 1 unable to play a single action card.

     Zero action points is not an illegal state — it is what you have for
     most of the game — so `invariants.js` cannot see this by construction,
     which is why it is pinned here as a property of the branch. */
  const end = slice("  function foeEnd(s){", "  const toggleBlock = ");
  /* Bound the branch to itself — sliced to the end of foeEnd it swallows
     the `return newTurn(n)` that follows it, and the "does not tick"
     assertion below would then be reading the NORMAL path. */
  const from = end.indexOf("if(n._opening)");
  assert.ok(from > -1, "the opening branch moved — re-anchor this drill");
  const opening = end.slice(from, end.indexOf("return newTurn(", from));
  assert.match(opening, /youMut\(o\)\.ap\s*=\s*1/,
    "the opening handoff must issue the action point — it IS the beginning of your action phase");
  /* And the clock must still NOT tick here: score is turns + wasted, so
     ticking would silently tax a point for going second. */
  assert.ok(!/turn\s*:\s*\w+\.turn\s*\+\s*1/.test(opening) && !/newTurn\(/.test(opening),
    "and must still hand over without ticking the clock");
});

/* ===================================================================
   THE DECLARATION/DEFENCE SPLIT (v2.73, Phase 1 step 4)

   `execute` used to call `dummyDefence` inline and set `mode:"stack"`
   itself — it applied the card's effect AND advanced the turn. That is
   the single knot that kept judge.js from ever calling the card
   semantics: it drives combat through `phase`/`step`/`chainCards` and has
   no dummy to ask. The module now declares and stops.
   =================================================================== */

test("execute hands back a DECLARATION for the caller to defend", () => {
  const rp = slice("  function resolvePlay(s, card, from, idx){", "  const maybeBoost = ");
  assert.match(rp, /if\(!n\._declared\) return n;/,
    "a play that resolved fully must not fall into the defend step");
  assert.match(rp, /dummyDefence\(n, total, atk\)/,
    "declaring the opponent's blockers is the TRAINER's job now, not the module's");
  assert.match(rp, /_EFX\.afterDefenders\(n\)/,
    "and card text that needs the defenders to exist resolves after they do");
  /* The two phases the caller owns, and they are different outcomes:
     a popped attack has no reaction window to open. */
  assert.match(rp, /_fizzled[\s\S]{0,120}mode:"act"/,
    "a phantasm pop returns to the action phase");
  assert.match(rp, /return \{\.\.\.n, mode:"stack"\}/,
    "and a surviving attack opens the reaction window");
});

test("dummyDefence is no longer part of the module's contract", () => {
  /* The measurable result of the split: the one context key that was a
     statement about the TRAINER's opponent rather than about cards. */
  assert.ok(!E.CTX_KEYS.includes("dummyDefence"),
    "effects.js must not need a way to declare the opponent's blockers");
  assert.strictEqual(typeof E.makeEffects(stubCtx()).afterDefenders, "function",
    "afterDefenders is the second half of a declaration and must be exported");
});

test("afterDefenders is inert without a declaration, and clears it", () => {
  const efx = E.makeEffects(stubCtx());
  const g = twoSeats();
  const out = efx.afterDefenders(g);
  assert.ok(!("_declared" in out), "no declaration in flight — nothing to do");
  assert.ok(!out._fizzled, "and nothing fizzled");
  /* A dangling `_declared` would be resolved by a LATER play as if it were
     its own attack, so consuming it is part of the contract. */
  const withDecl = {...g, _declared: {card: card({name: "Declared Atk", tx: ""}), total: 4, declNote: ""}};
  const done = efx.afterDefenders(withDecl);
  assert.ok(!("_declared" in done), "the declaration is consumed, never left dangling");
});

/* "IF IT'S NOT YOUR TURN" IS A QUESTION ABOUT THE TURN (v2.73).

   Read as `mode==="block"` this meant "they are swinging at me" — the only
   shape the opponent's turn had until v2.71 gave them an action phase. The
   moment `mode:"foeturn"` existed it silently answered FALSE there, so an
   Emeritus Scolding played in the new window took the ordinary branch and
   dealt 4 where it prints 6.

   DRIVEN, not grepped. The first version of this drill matched
   `s.turnPlayer !== actorOf(s)` in the source and went green with the
   guard around it replaced by `false` — the identifier survives, which is
   trap 4b for the third time in this change. Printed text in, damage out. */
const SCOLDING = "Deal 4 arcane damage to target hero. If Emeritus Scolding is played " +
                 "during an opponents turn, instead deal 6 arcane damage to them.";

function scold(over){
  const efx = E.makeEffects(stubCtx());
  const g = Object.assign(twoSeats(), {mode: "act", chain: [], stack: [], hitSeq: 0,
    boostChain: 0, turn: 2}, over || {});
  const c = card({name: "Emeritus Scolding " + (over && over._tag || ""), pitch: 1, cost: 0,
    power: null, tt: "Wizard Action", ty: ["Wizard", "Action"], tx: SCOLDING});
  /* MEASURE THE ACTOR'S FOE, not seat 1. With the actor borrowed to seat 1
     (which is exactly what `foePlay` does to resolve the opponent's own
     card) the arcane damage lands on seat 0, and a helper hardcoded to
     seat 1 reports a flat 0 for every such case — a drill that fails for a
     reason that has nothing to do with what it is testing. */
  const me = g.actor || 0, them = 1 - me;
  g.sides[me].hand = [c];
  const before = g.sides[them].hp;
  const out = efx.execute(g, c, "hand", 0);
  return before - out.sides[them].hp;
}

test("Emeritus Scolding deals 6 on THEIR action phase, not just mid-combat", () => {
  /* The new window: their action phase, priority passed to you. Before
     v2.73 this branch read false and the card was quietly weaker. */
  assert.strictEqual(scold({_tag: "foeturn", mode: "foeturn", turnPlayer: 1, actor: 0}), 6,
    "their turn is their TURN — the printed 6 applies in their action phase");
  /* And the shape that always worked: their combat window. */
  assert.strictEqual(scold({_tag: "block", mode: "block", turnPlayer: 1, actor: 0}), 6,
    "and still applies while they are swinging");
});

test("...and 4 on your own turn — the control that makes the pair mean anything", () => {
  /* Without this the drill above passes just as well when the condition is
     ignored and every Scolding deals 6. */
  assert.strictEqual(scold({_tag: "own", mode: "act", turnPlayer: 0, actor: 0}), 4,
    "your own action phase takes the printed base, never the instead");
});

test("the foeTurn fallback still answers on a state with no priority fields", () => {
  /* Every drill that hand-rolls a state omits phase/step/turnPlayer, and
     `withPriority` only merges them through the trainer's setG. The
     fallback is why those states still get a sensible answer. */
  assert.strictEqual(scold({_tag: "fb-block", mode: "block"}), 6, "falls back to the window");
  assert.strictEqual(scold({_tag: "fb-act", mode: "act"}), 4, "and to your own turn");
});

test("seat 1 playing it on ITS OWN turn gets 4 — the discriminator", () => {
  /* THE CASE THE FALLBACK CANNOT ANSWER, and the reason the turn read is
     not just tidier. During the mirror's swing the trainer is in
     `mode:"block"` and `foePlay` BORROWS THE ACTOR to seat 1 to resolve
     the card's own effects. Read as `mode==="block"` the condition says
     "not your turn" — but it IS seat 1's turn, so the old reading handed
     the opponent 6 where the card prints 4, on every Scolding it played.

     Stronger than printed, which is the direction that steals games, and
     `npm run fairness` is deliberately one-sided against ever seeing it
     because the clause is consumed either way. */
  assert.strictEqual(scold({_tag: "theirs-own", mode: "block", turnPlayer: 1, actor: 1}), 4,
    "it is seat 1's own turn — the instead must not fire for the turn player");
  /* And the mirror image, so the pair cannot both be satisfied by a
     constant: you acting during their turn still gets the 6. */
  assert.strictEqual(scold({_tag: "yours-their-turn", mode: "block", turnPlayer: 1, actor: 0}), 6,
    "while you act during their turn, it does");
});
