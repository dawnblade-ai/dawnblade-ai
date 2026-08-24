/* ============================================================
   "AS THOUGH IT WERE AN INSTANT" — THE SPEED GRANT (v3.36)

   14 pool records print one and NOT ONE OF THEM WAS READ, across three
   heroes. It is Iyslander's whole identity — both clauses of her hero
   ability are about acting on the opponent's turn — and it is also
   Cindering Foresight, Snapback and Astral Etchings.

   WHAT THE GRANT CHANGES IS THE WINDOW, AND THE ACTION POINT WITH IT.
   RULING (user, 2026-08-10): "as though they were an instant" is more
   than dropping the action point — an instant may be played ANY TIME the
   player has priority, where an action is confined to its own action
   phase. The action point is deliberately never charged (CR 8.1.6), and
   the reductio is that it could not be: a seat holds NO action point
   during the opponent's turn (CR 4.4.3e takes it, CR 4.3.2 issues the
   next at the start of their own action phase), so a grant that still
   charged one would be a grant nobody could ever use.

   EVERY ASSERTION IS ON STATE OR ON A REFUSAL, never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");

const IYS   = {arsenalInstant: true,  iceFrostbite: true};
const PLAIN = {arsenalInstant: false, iceFrostbite: false};

/* A game in the OPPONENT'S action phase with the named seat holding
   priority — the window Iyslander's whole ability lives in. */
function foeTurn(seat0, builds){
  H.db();
  const g = H.state(Object.assign({res: 9, ap: 0}, seat0), {},
                    {actor: 1, turnPlayer: 1, turn: 3, builds: builds || [IYS, {}]});
  return {...g, phase: "action", step: "layer", priority: 0, passed: []};
}
const why = (g, uid, from) => J.legal(g, {t: "play", uid, from: from || "hand"}, 0);

/* ---- THE READER ------------------------------------------------------- */

test("the printed grant is READ, and an unreadable gate is left unread", {skip}, () => {
  const read = (nm, p) => { P.fxReset(); return P.fxParse(H.card(nm, p)).asInstant; };

  assert.deepEqual(read("Cindering Foresight", 1), {when: "notYourTurn"},
    '"If it is not your turn, you may play this as though it were an instant"');
  assert.deepEqual(read("Astral Etchings", 1), {when: "controls", name: "spectral shield"},
    "the NAME is captured off the card — a table of names here would be card text " +
    "written into the engine");

  /* SNAPBACK WAS DELIBERATELY UNREAD AT v3.36 and is READ at v3.38 — a
     deliberate edit to this drill, not a drift. The recorded reason was
     "`hist` counts non-attacks but records no class", and `hist.playTy`
     removed it; approximating it with the bare count would have granted
     the window off ANY non-attack, which is why it waited for the record
     rather than being guessed. */
  assert.deepEqual(read("Snapback", 1), {when: "playedAnotherCls", cls: "wizard"},
    "Snapback's gate is read off a class-aware turn history (v3.38). The CLASS is " +
    "captured off the card rather than listed in the engine");

  /* AND A GATE WITH NO READER STILL REFUSES. The vocabulary is closed on
     purpose: an unrecognised condition leaves the clause unread and the
     card in its printed window, which is weaker than printed and visible. */
  assert.equal(P.asInstantCond("you have three hats"), null,
    "a condition with no reader must refuse — the alternative is a window nobody built");
});

test("an unknown condition answers FALSE, so a forgotten gate is WEAKER than printed", {skip}, () => {
  /* ASKED DIRECTLY, because no card fixture can reach this default: the
     parser only ever emits conditions `asInstantMet` knows, so a sabotage
     of the switch changes nothing observable through a card. Same reason
     `defSelfMet`'s unknown-`when` drill asks the function by name (v3.26). */
  assert.equal(P.asInstantMet({when: "somethingNobodyBuilt"}, {notYourTurn: true}), false,
    "a condition added to asInstantCond and forgotten in asInstantMet must confine the " +
    "card to its printed window — weaker than printed and visible. The other direction " +
    "opens an instant-speed window nobody built.");
  assert.equal(P.asInstantMet(null, {}), false, "no grant is not a grant");
  assert.equal(P.asInstantMet({when: "always"}, {}), true);
});

test("BOTH wordings of the contraction read — upstream prints each today", {skip}, () => {
  /* v3.00's lesson wearing a contraction: the database prints "if it's
     not your turn" on Iyslander and Cindering Foresight AND "if it is
     Draconic" elsewhere, so an anchor written against either spelling is
     one editorial pass from silence. SYNONYMS levels it in one place. */
  assert.deepEqual(P.asInstantCond("it's not your turn"), {when: "notYourTurn"});
  assert.deepEqual(P.asInstantCond("it is not your turn"), {when: "notYourTurn"});
});

/* ---- THE HERO'S STANDING GRANT ---------------------------------------- */

test("Iyslander plays a blue non-attack from ARSENAL on their turn", {skip}, () => {
  const blue = H.card("Aether Icevein", 3);
  assert.equal(why(foeTurn({arsenal: blue}), blue.uid, "arsenal"), null,
    "her clause 1 is the whole reason she is playable — at the table it was refused " +
    "as 'an action ... during an instant-speed window' for every version before v3.36");
});

test("and every word of that line is a gate", {skip}, () => {
  const blue = H.card("Aether Icevein", 3);
  const red  = H.card("Aether Icevein", 1);
  /* PICK A FIXTURE THAT TELLS THE TWO HALVES APART (v3.31). This was
     Wounded Bull, a RED attack — so the blue gate refused it and dropping
     the non-attack gate changed nothing: the drill passed against a
     sabotaged engine. Brothers in Arms is BLUE and an ATTACK, out of her
     own deck, so it can only be refused by the half under test. */
  const atk  = H.card("Brothers in Arms", 3);

  /* THE HERO. Another hero holding the identical card in the identical
     window is refused — the grant is hers, not the zone's. */
  assert.ok(why(foeTurn({arsenal: blue}, [PLAIN, {}]), blue.uid, "arsenal"),
    "a hero without the passive gets nothing");

  /* THE ZONE. Her line names the ARSENAL; the same card in hand is not
     freed, which is what makes setting it in arsenal a real decision. */
  assert.ok(why(foeTurn({hand: [blue]}), blue.uid, "hand"),
    "the same card in HAND is refused — her line names the arsenal");

  /* BLUE. */
  assert.ok(why(foeTurn({arsenal: red}), red.uid, "arsenal"),
    "a red non-attack in the arsenal is refused — the line says blue");

  /* NON-ATTACK. */
  assert.ok(why(foeTurn({arsenal: atk}), atk.uid, "arsenal"),
    "an attack action card is refused — the line says non-attack");

  /* THE TURN. On her OWN turn the grant does not apply; the card is
     playable anyway, as an ordinary action, so this asserts the WINDOW
     rather than the legality — see the action-point drill below. */
  const mine = H.state({res: 9, ap: 1, arsenal: blue}, {},
                       {actor: 0, turnPlayer: 0, turn: 3, builds: [IYS, {}]});
  const g = {...mine, phase: "action", step: "layer", priority: 0, passed: []};
  assert.equal(J.legal(g, {t: "play", uid: blue.uid, from: "arsenal"}, 0), null,
    "on her own turn it is an ordinary action play");
});

/* ---- THE ACTION POINT, WHICH IS THE HALF THAT BIT --------------------- */

test("the grant charges NO action point — and legal/reduce must agree", {skip}, () => {
  const blue = H.card("Aether Icevein", 3);
  const g = foeTurn({arsenal: blue});
  assert.equal(g.sides[0].ap, 0, "fixture: a seat holds no action point on the opponent's turn");
  assert.equal(why(g, blue.uid, "arsenal"), null, "fixture: the play is legal");

  const out = J.reduce(g, {t: "play", uid: blue.uid, from: "arsenal"}, 0);
  assert.equal(out.error, null, "reduce refused what legal allowed — that is the desync " +
    "fuzz.test.js exists to hold");

  /* THE BUG THIS PINS. The window was widened in `playableWhy` and not in
     `playWindowFor`, so the play was ALLOWED in the instant window and
     then CHARGED as an action: driven, this reached ap -1, which is
     NEGATIVE-AP — CR 4.4.3e, points are lost and never owed. `windowsNow`
     is the one body both now ask. */
  assert.equal(out.state.sides[0].ap, 0,
    "an action point was charged for a play the rules make free (CR 8.1.6) — and a seat " +
    "on the opponent's turn has none to charge, so this goes NEGATIVE");
  assert.equal(out.state.sides[0].arsenal, null, "the card actually left the arsenal");
  assert.ok((out.state.sides[0].grave || []).some(c => c.uid === blue.uid),
    "and reached the graveyard — the play resolved rather than being quietly dropped");
});

test("a card's OWN grant opens the same window", {skip}, () => {
  /* Cindering Foresight prints the gate Iyslander prints, on a card. It is
     a Blaze card, so this is the reader paying out beyond the hero whose
     ability motivated it. */
  const cf = H.card("Cindering Foresight", 1);
  assert.ok(!(cf.ty || []).some(t => /^instant$/i.test(t)),
    "fixture: Cindering Foresight is an ACTION — if it were printed an instant this " +
    "drill would pass without the grant existing at all");

  assert.equal(why(foeTurn({hand: [cf]}, [PLAIN, {}]), cf.uid), null,
    "its own line frees it on the opponent's turn, with no hero ability involved");

  /* AND THE GATE IS REAL: on the holder's OWN turn the grant does not
     apply, which the window test below makes observable. */
  assert.equal(P.playsAsInstant(cf, {notYourTurn: false}), false,
    "on your own turn the card is an ordinary action");
  assert.equal(P.playsAsInstant(cf, {notYourTurn: true}), true);
});

test("a board-scan gate reads the board, by the card's own printed name", {skip}, () => {
  const ae = H.card("Astral Etchings", 1);
  const shield = H.tok("Spectral Shield");
  const ent = c => ({card: c, kind: "token", spent: false, uid: c.uid});

  assert.equal(P.playsAsInstant(ae, {notYourTurn: true, board: []}), false,
    "no Spectral Shield on the board — the gate is not met, whosever turn it is");
  assert.equal(P.playsAsInstant(ae, {board: [ent(shield)]}), true,
    "with one on the board it is freed");
  assert.equal(P.playsAsInstant(ae, {board: [ent(H.tok("Frostbite"))]}), false,
    "and it is the NAMED aura, not any aura");
});

/* ---- THE GUARD ------------------------------------------------------- */

test("every judge call site names the ZONE it is asking about", {skip}, () => {
  /* v3.24's lesson, and it was learned by sabotaging the guard rather than
     the code: `defendValue`'s guard matched the CALL and a dropped third
     argument matched it perfectly. Iyslander's grant is over her ARSENAL,
     so a caller that forgets the zone silently denies her hero ability —
     the safe direction, and still a bug. The DEFINITIONS are excluded:
     they match the same text and have no arguments. */
  const src = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  for(const fn of ["playableWhy", "playWindowFor", "windowsNow"]){
    /* The DEFINITION is excluded by requiring no `function` in front; a
       bare mention in the export list carries no parens and never matches. */
    const calls = [...src.matchAll(new RegExp("(?<!function\\s)\\b" + fn + "\\(([^)]*)\\)", "g"))]
      .map(m => m[1]);
    assert.ok(calls.length, fn + " has no call site — re-anchor this guard rather than " +
      "letting it pass by finding nothing, which is how a source scan lies");
    for(const args of calls)
      assert.match(args, /\bzone\b/,
        fn + " is called without naming a zone: `" + fn + "(" + args.trim() + ")`. " +
        "Iyslander's grant is over the ARSENAL, so a zone-less call silently denies her " +
        "hero ability — weaker than printed, and invisible.");
  }
});

test("an INSTANT in the arsenal needs no grant (CR 8.1.6)", {skip}, () => {
  /* Her line frees blue non-attack ACTION CARDS. A blue Instant set in the
     arsenal — Frost Spike, out of her own deck — is not covered by it and
     is playable on its own printed type, for ANY hero. Worth a drill
     because the first draft of the trainer's shared-reader edit asked only
     about the grant, which refused this card with "is an attack": a lost
     line of play AND a wrong message, from a change that was otherwise a
     pure de-duplication. */
  const spike = H.card("Frost Spike", 3);
  assert.equal(P.isNonAtkActionCard(spike), false,
    "fixture: Frost Spike is an Instant, so it is NOT the action card her line names — " +
    "if it were, this drill would pass through the grant and prove nothing");
  assert.equal(why(foeTurn({arsenal: spike}), spike.uid, "arsenal"), null,
    "Iyslander plays it — but not because of her ability");
  assert.equal(why(foeTurn({arsenal: spike}, [PLAIN, {}]), spike.uid, "arsenal"), null,
    "and so does a hero with no ability at all — which is what proves the grant is not " +
    "what is doing the work here");
  assert.equal(P.playsAsInstant(spike, {zone: "arsenal", notYourTurn: true,
                                        arsenalInstant: true}), false,
    "the GRANT itself correctly declines it — an Instant is not an action card");
});

test("the TRAINER's arsenal route asks the SHARED reader, not a second copy", {skip}, () => {
  /* A SOURCE SCAN, AND ITS WEAKNESS IS STATED. `playArsenalInstant` is a
     `setG` closure inside `Battle`, so no drill can drive it — the same
     compromise mirror.test.js and actor.test.js already make, and the
     reason this route went four versions with no drill at all.

     WHAT IT PINS is the thing that actually went wrong: the trainer had
     a HAND-ROLLED copy of her printed line (`isAttack(c)` plus a pitch
     test) beside the table's copy in `judge.legal`, and the two read
     DIFFERENT FIELDS — `tt` against the structured array. Two
     descriptions of one rule that can disagree about a card is the
     no-mirror rule broken in the trainer.

     Comments are stripped first: this file's own prose names both the
     helper and the zone, and a guard a comment can satisfy is a guard
     that has stopped asking. */
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const m = src.match(/const playArsenalInstant\b[\s\S]*?\n  \}\);/);
  assert.ok(m, "playArsenalInstant moved — re-anchor this guard rather than letting it " +
    "pass by finding nothing, which is how a source scan lies");
  const body = m[0];

  assert.match(body, /playsAsInstant\(/,
    "the trainer must ask the shared reader — a second copy of her printed line here is " +
    "free to disagree with the table's about which cards she may play");
  assert.match(body, /zone\s*:\s*["']arsenal["']/,
    "and it must name the ARSENAL: her line grants over that zone specifically, and the " +
    "reader denies a zone it was not told about");
  assert.ok(!/if\(isAttack\(c\)\)\s*return/.test(body),
    "the hand-rolled `isAttack` gate is the second copy — it reads `tt` where the shared " +
    "reader reads the structured array (v2.44), so it is the one that is wrong when they differ");

  /* AND IT MUST STILL HONOUR AN INSTANT ON ITS OWN TYPE (CR 8.1.6). The
     grant covers action cards only, so a route that asks about the grant
     ALONE refuses a blue Instant set in the arsenal — a line of play the
     trainer already had, and one the table allows for every hero. Driven
     at the table by the drill above; here the trainer's own closure can
     only be read. */
  assert.match(body, /isInstantT\(/,
    "the trainer's arsenal route must let an INSTANT through on its own printed type — " +
    "asking only about the grant loses a line of play the table still allows");
});

/* ---- THE CLASS-AWARE TURN HISTORY (v3.38) ---------------------------
   `hist.non` counts non-attacks and records no CLASS, so Snapback's "if
   you have played another WIZARD non-attack action card this turn" could
   not be asked at all — and reading it as the bare count would have
   granted the window off ANY non-attack, which is stronger than the
   card's own text. That is why v3.36 refused it rather than guessing.
   `hist.playTy` is the record that removed the reason. */

const S = require("../engine/sides.js");
const hist = played => Object.assign(S.freshHist(), {playTy: played});
const tyOf = c => (c.ty || []).map(t => String(t).toLowerCase());

test("every play records its STRUCTURED type words, after it resolves", {skip}, () => {
  const bolt = H.card("Ice Bolt", 1);
  let g = H.state({res: 19, ap: 3, hand: [bolt]}, {}, {actor: 0, turnPlayer: 0, turn: 3});
  assert.deepEqual(g.sides[0].hist.playTy, [], "a fresh turn records nothing");

  g = H.execute(g, bolt, "hand", 0, {});
  assert.deepEqual(g.sides[0].hist.playTy, [["ice", "wizard", "action"]],
    "the whole structured array, lowercased — `tt` calls Den of the Spider an " +
    '"Action Defense Reaction" and the array does not (v2.44)');
});

test("the class and the type are asked TOGETHER, off one entry", {skip}, () => {
  const q = {when: "playedAnotherCls", cls: "wizard"};
  const met = h => P.asInstantMet(q, {hist: hist(h)});

  assert.equal(met([]), false, "nothing played — the gate is shut");
  assert.equal(met([["ice", "wizard", "action"]]), true,
    "a Wizard non-attack action card opens it");
  assert.equal(met([["wizard", "action", "attack"]]), false,
    "a Wizard ATTACK action card does not — the line says non-attack");
  assert.equal(met([["runeblade", "action"]]), false,
    "a non-Wizard non-attack does not — the line names the class");

  /* THE REASON THE RECORD IS AN ARRAY OF ENTRIES rather than a flat set
     of words: two cards contributing half the condition each must not
     satisfy it. A flat set would answer TRUE here. */
  assert.equal(met([["wizard", "action", "attack"], ["generic", "action"]]), false,
    "a Wizard ATTACK plus an unrelated non-attack is two cards contributing half the " +
    "condition each — a flat set of type words would wrongly answer true");
});

test("Snapback is playable at instant speed once, and only once, it is earned", {skip}, () => {
  const snap = H.card("Snapback", 1);
  const bolt = H.card("Ice Bolt", 1);       /* Ice Wizard Action — non-attack */
  const bull = H.card("Wounded Bull", 1);   /* Generic Action - Attack        */
  const at = played => {
    const g = H.state({res: 19, ap: 0, hand: [snap], hist: hist(played)}, {},
                      {actor: 1, turnPlayer: 1, turn: 3, builds: [{}, {}]});
    return {...g, phase: "action", step: "layer", priority: 0, passed: []};
  };
  const act = {t: "play", uid: snap.uid, from: "hand"};

  assert.ok(J.legal(at([]), act, 0),
    "with nothing played this turn Snapback is an ordinary action and is refused");
  assert.equal(J.legal(at([tyOf(bolt)]), act, 0), null,
    "after a Wizard non-attack action card, its own line frees it on the opponent's turn");
  assert.ok(J.legal(at([tyOf(bull)]), act, 0),
    "an ATTACK does not earn it — the discriminator is the card TYPE, not the count");

  /* AND NO ACTION POINT IS CHARGED — the seat has none on their turn. */
  const out = J.reduce(at([tyOf(bolt)]), act, 0);
  assert.equal(out.error, null, "reduce must agree with legal");
  assert.equal(out.state.sides[0].ap, 0, "no action point charged (CR 8.1.6)");
});
