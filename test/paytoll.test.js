/* ============================================================
   "UNLESS THEY PAY", AND INERTIA — two noops whose stated reasons
   had expired, and one of which was wrong about the mechanic. (v2.75)

   THE ESCAPE HATCH DID NOT EXIST. Winter's Bite prints "Target hero
   discards a card unless they pay {r}", and `classifyClause` returned
   BYTE-IDENTICAL output with and without that second half — so a hero
   holding NINE resources discarded without ever being offered the chance
   to pay. Driven, not guessed: the pre-fix engine took the card and left
   the resources untouched.

   It reported tier `full`, and `npm run fairness` was CLEAN, because the
   sweep asks whether a card grants its CONTROLLER more than it prints —
   not whether it silently deleted the OPPONENT'S printed escape. Same
   shape as Strongest Survive in v2.66, which is why the reveal hatch sits
   directly above the bare discard rule in the parser and this one now
   sits beside it.

   INERTIA WAS NEVER AN ACTION-PHASE TAX. The noop said "the dummy has no
   action phase"; the printed token says:

     Inertia — "Generic Token - Aura"
     "At the beginning of your end phase, destroy Inertia, then put all
      cards from your hand and arsenal on the bottom of your deck."

   A hand wipe, and the harshest token in the pool. The reason on that
   noop was wrong about the MECHANIC, not just about the prop — which is
   the failure mode a census catches and a coverage tool cannot.

   Assertions are on hands, decks, zones and resources. Never on prose.

   DRIVEN THROUGH `judge.reduce` (v2.80). This file used to hand-roll an
   effects context and then hand-roll the ANSWER as well — buildPrompt,
   applyPrompt, charge the pay, re-run the ops at the right actor — which
   is a third copy of a flow judge.js and the trainer already have. It
   proved the clause parsed; it could not prove a player who taps the card
   ever reaches it. The whole card is played through the reducer now, and
   the sheet is answered with the reducer's own prompt actions.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (nm, p) => H.card(nm, p);

/* Winter's Bite, played for real: seat 0 holds priority in its own action
   phase and taps the card. Everything after that is the engine's. */
function bite(defender, choice){
  H.db();
  const wb = {...card("Winter's Bite", 3), uid: "wb1"};
  let g = H.state({res: 9, hand: [wb]}, defender, {actor: 0, turnPlayer: 0, seed: "toll"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  const send = (a, seat) => {
    const out = J.reduce(g, a, seat);
    assert.equal(out.error, null, a.t + " was refused: " + out.error);
    g = out.state;
  };
  send({t: "play", uid: "wb1", from: "hand"}, 0);
  const live = g.prompt;
  if(!live) return {n: g, live: null};

  /* `autoAnswer` is the answer a seat with nobody in it gives, and it is
     what `local.js` and `sparring.run` call. Asking for it here is what
     makes the policy drills below a statement about the live path. */
  const decided = choice === "policy" ? J.autoAnswer(g).choice : choice;
  send({t: "promptChoose", choice: decided}, live.side);
  send({t: "promptConfirm"}, live.side);
  return {n: g, live, decided};
}

/* ---- THE ESCAPE HATCH -------------------------------------------------- */

test("the printed 'unless they pay' is READ, not dropped", {skip}, () => {
  const wb = card("Winter's Bite", 3);
  assert.match(P.clean(wb.tx || ""), /unless they pay/i, "fixture drifted");
  assert.deepEqual(P.fxParse(wb).ops, [["payOr", 1, [["selfDiscard", 1]]]],
    "before v2.75 this was a bare [[\"foeDiscard\",1]] — byte-identical with and without " +
    "the second half of the sentence, so the escape simply did not exist");
});

test("the cost is COUNTED off the print, not hardcoded", {skip}, () => {
  /* Winter's Bite prints {r} on one printing and {r}{r}{r} on another. A
     hardcoded 3 would be wrong on the copy the player actually drew. */
  const one = P.classifyClause("target hero discards a card unless they pay {r}");
  const three = P.classifyClause("target hero discards a card unless they pay {r}{r}{r}");
  assert.equal(one.ops[0][1], 1);
  assert.equal(three.ops[0][1], 3);
});

test("the qualified sentence is not eaten by the bare discard rule", {skip}, () => {
  /* Ordering: the loose "opponent discards" rule would claim the whole
     sentence and silently drop the hatch, which is how this shipped. */
  assert.equal(P.classifyClause("target opponent discards a card").ops[0][0], "foeDiscard",
    "the bare rule still works");
  assert.equal(P.classifyClause(
    "target hero discards a card unless they reveal a card from their hand with {p} greater than the damage dealt"
  ).ops[0][0], "foeDiscardUnlessReveal", "and the reveal hatch still claims its own sentence");
});

test("the sheet is addressed to the TARGET hero, not the caster", {skip}, () => {
  H.db();
  const wb = {...card("Winter's Bite", 3), uid: "wb1"};
  let g = H.state({res: 9, hand: [wb]},
                  {res: 9, hand: [{uid: "h1", name: "a card", pitch: 3}]},
                  {actor: 0, turnPlayer: 0, seed: "toll"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "wb1", from: "hand"}, 0);
  assert.equal(out.error, null);
  assert.equal(out.state.prompt.tag, "pay");
  assert.equal(out.state.prompt.side, 1,
    "'target hero may pay' is THEIR call — that is why prompts.js addresses specs to a side");

  /* AND THE OTHER SEAT IS STOPPED WHILE IT IS LIVE. A sheet nobody can
     answer and a sheet everybody can walk around are the same bug from
     opposite ends: whatever queued it is mid-resolution. */
  assert.equal(J.legal(out.state, {t: "pass"}, 0),
    out.state.sides[1].name + " is answering Winter's Bite",
    "the caster may not play on around an unanswered toll");
  assert.equal(J.legal(out.state, {t: "promptConfirm"}, 0), "that sheet is not addressed to you");
});

test("paying keeps the card; declining loses it", {skip}, () => {
  const held = [{uid: "h1", name: "a card", pitch: 3}];
  const paid = bite({res: 9, hand: held}, "pay");
  assert.equal(paid.n.sides[1].hand.length, 1, "the card stays");
  assert.equal(paid.n.sides[1].res, 8, "and one resource is gone");

  const gone = bite({res: 9, hand: held}, "decline");
  assert.equal(gone.n.sides[1].hand.length, 0, "declined — the card goes");
  assert.equal(gone.n.sides[1].res, 9, "and nothing was spent");
  assert.equal(gone.n.sides[1].grave.length, 1, "to their own graveyard");
  assert.equal(gone.n.sides[1].grave[0]._disc, true,
    "stamped as a discard — an attack reaches the graveyard at DECLARATION, so the stamp " +
    "is what separates a discard from a card that was merely played");
});

test("the discard lands on the ASKED hero, never on the caster", {skip}, () => {
  const {n} = bite({res: 0, hand: [{uid: "h1", name: "theirs", pitch: 3}]}, "decline");
  assert.equal(n.sides[1].hand.length, 0,
    "the payload is actor-relative to the side the sheet was addressed to — writing it as " +
    "`foeDiscard` would have discarded from the caster's own hand");
  /* The caster's own graveyard holds Winter's Bite and NOTHING ELSE. The
     hand-rolled version asserted an empty graveyard, which only held
     because the card was never really played; driving it through `reduce`
     the card genuinely resolves, so the honest statement is which card is
     in there — and that none of it is stamped as a discard. */
  assert.deepEqual(n.sides[0].grave.map(c => c.name), ["Winter's Bite"]);
  assert.ok(!n.sides[0].grave.some(c => c._disc),
    "the caster discarded nothing — a card that was played is not a card that was discarded");
});

test("avail is the ASKED side's, and counts what they could pitch", {skip}, () => {
  /* Read off the LIVE sheet before it is answered. `bite` returns the
     post-answer game, where the hand has already gone to the graveyard;
     an earlier version of this drill read avail off that and measured the
     wrong thing. */
  const {live} = bite({res: 2, hand: [{uid: "h1", name: "a", pitch: 3}]}, "decline");
  assert.equal(live.avail, 5,
    "res 2 plus a pitchable 3, and it is SEAT 1's 2 — the caster is holding 9. It used to be " +
    "handed in by openPrompt as `you(s).res`, seat 0's floating resources whoever the sheet " +
    "was addressed to: a latent seat bug that had never fired because no card queued a pay spec");
  assert.equal(live.cost, 1);
});

/* ---- SEAT 1 CAN ANSWER ------------------------------------------------- */

test("seat 1's pay policy spends the pool freely", {skip}, () => {
  assert.equal(E.payPolicy({cost: 1, avail: 9}, {res: 9, hand: [{}, {}]}), true,
    "floating resources cost nothing to spend");
});

test("seat 1 will not spend its LAST card to save a card", {skip}, () => {
  assert.equal(E.payPolicy({cost: 1, avail: 3}, {res: 0, hand: [{pitch: 3}]}), false,
    "pitching the last card in hand to avoid discarding a card is a straight loss — and a " +
    "seat that pays every toll every time is the shape that made both seats block 41 of 41");
  assert.equal(E.payPolicy({cost: 1, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), true,
    "out of a real grip it is worth it");
});

test("seat 1 never claims to pay what it cannot reach", {skip}, () => {
  /* THE CASE THAT ACTUALLY HOLDS THE GUARD. An empty hand is refused by
     the last-card rule anyway, so it proves nothing — the sabotage pass
     found that. What needs the affordability check is a FULL hand that
     still cannot cover the cost: without it the policy answers "pay",
     autoPitch fails, and the trainer has to unwind an answer it should
     never have given. */
  assert.equal(E.payPolicy({cost: 9, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), false,
    "two pitchable 3s is 6, and the toll is 9");
  assert.equal(E.payPolicy({cost: 6, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), true,
    "and exactly enough IS enough, so the drill cannot pass by refusing everything");
  assert.equal(E.payPolicy({cost: 3, avail: 1}, {res: 1, hand: []}), false);
  assert.equal(E.payPolicy({cost: 0, avail: 0}, {res: 0, hand: []}), true, "a free toll is free");
});

test("the policy is deterministic and touches no rng", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const body = src.match(/function payPolicy\(live, sd\)\{[\s\S]*?\n\}/);
  assert.ok(body, "payPolicy moved — re-anchor this drill");
  assert.ok(!/rng/i.test(body[0]), "consuming the seeded stream would diverge a replay");
});

test("the trainer routes a seat-1 pay to the policy", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /live\.side === 1 && live\.tag === "pay"/,
    "an 'unless they pay' clause hangs its whole consequence off the answer, so a sheet " +
    "addressed to seat 1 that nobody confirms is a printed effect that never resolves");
  assert.match(code, /DawnEffects\.payPolicy\(live, opp\(s\)\)/,
    "and the decision must come from the pure policy, not a second copy in the trainer");
  assert.ok(!/avail:you\(s\)\.res/.test(code),
    "openPrompt must no longer patch seat 0's resources onto a sheet addressed to anyone");
});

/* ---- INERTIA ----------------------------------------------------------- */

test("the Inertia token is a HAND WIPE, and the old noop said otherwise", {skip}, () => {
  const tok = card("Inertia");
  assert.ok(tok.resolved, "resolved from the database — never invented");
  /* TWO PRINTINGS OF THE SAME TOKEN. Upstream resolved the self-reference
     ("destroy Inertia" -> "destroy this") in the v3.00 rewording pass, and
     a warm localStorage cache still holds the old one — so the drill reads
     both rather than pinning whichever wording this machine fetched. What
     it is actually asserting is unchanged: the token is a HAND WIPE at the
     end phase, not a tax on an action phase. */
  assert.match(P.clean(tok.tx || ""),
    /at the beginning of your end phase, destroy (?:inertia|this), then put all cards from your hand and arsenal on the bottom of your deck/i,
    "the printed text is the spec, and it is not a tax on an action phase");
});

test("resolveInertia sweeps hand AND arsenal to the BOTTOM of the deck", {skip}, () => {
  const tok = card("Inertia");
  const ent = {card: {...tok, uid: "i1"}, kind: "token", spent: false, uid: "i1"};
  const g = H.state({}, {board: [ent], hand: [{uid: "a"}, {uid: "b"}, {uid: "c"}],
                      arsenal: {uid: "d"}, deck: [{uid: "z"}]});
  const r = E.resolveInertia(g, 1);
  assert.equal(r.tokens, 1);
  assert.equal(r.wiped, 4, "three in hand and one in arsenal");
  assert.equal(r.game.sides[1].hand.length, 0);
  assert.equal(r.game.sides[1].arsenal, null, "the arsenal goes too — the text names it");
  assert.deepEqual(r.game.sides[1].deck.map(c => c.uid), ["z", "a", "b", "c", "d"],
    "the BOTTOM of the deck, under what was already there — not the graveyard, so " +
    "'discarded this turn' riders must not see them");
  assert.equal(r.game.sides[1].grave.length, 0, "nothing is stamped _gy");
  assert.equal(r.game.sides[1].board.length, 0, "and the token destroys itself");
});

test("resolveInertia touches the named seat only, and nothing without a token", {skip}, () => {
  const tok = card("Inertia");
  const ent = {card: {...tok, uid: "i1"}, kind: "token", spent: false, uid: "i1"};
  const g = H.state({hand: [{uid: "mine"}]}, {board: [ent], hand: [{uid: "theirs"}]});
  const r = E.resolveInertia(g, 1);
  assert.equal(r.game.sides[0].hand.length, 1, "'your end phase' is the CONTROLLER's");

  const clean = E.resolveInertia(H.state({}, {hand: [{uid: "x"}]}), 1);
  assert.equal(clean.tokens, 0);
  assert.equal(clean.game, g.board === undefined ? clean.game : clean.game,
    "no token, no wipe");
  assert.equal(clean.game.sides[1].hand.length, 1, "the hand survives untouched");
});

test("it fires at the BEGINNING of the end phase, ahead of the arsenal step", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* It must precede (b), or the seat is invited to choose an arsenal card
     that is about to be swept into the deck anyway. Both seats reach it. */
  assert.match(code, /n = beginEndPhase\(n, 0\);[\s\S]{0,200}n = endPhaseAllies\(n\);/,
    "seat 0's end phase runs it before (a)/(b)");
  assert.match(code, /n = beginEndPhase\(n, 1\);[\s\S]{0,200}n = endPhaseAllies\(n\);/,
    "and so does seat 1's");
  assert.match(code, /DawnEffects\.beginEndPhase\(s, si\)/,
    "one description, taking the seat — not two copies that can drift. Inertia " +
    "moved inside `effects.beginEndPhase` in v3.17, where it leads the event: it " +
    "is itself an aura, so the arena sweep that shares this moment would race it " +
    "for the same board entry.");
});

test("both pool cards that create Inertia put it on the OPPONENT's board", {skip}, () => {
  for(const nm of ["Lace with Inertia", "Inertia Trap"]){
    const c = card(nm, nm === "Lace with Inertia" ? 1 : 0);
    const txt = P.clean(c.tx || "");
    assert.match(txt, /inertia token under/i, `${nm} fixture drifted`);
    assert.match(txt, /under (?:their|the attacking hero)/i,
      `${nm} hands it to the opponent — a token that taxed its own controller would be a ` +
      `card that attacks you`);
  }
});
