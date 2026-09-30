/* ============================================================
   A HAND ABILITY IS AN ACTIVATION, AND IT PAYS LIKE ONE (v4.87)

     "Instant - Discard this: Amp 1"                      — ARCANE TWINING
     "Once per Turn Instant - Discard a card: This gets +3{d}. Activate
      this only while this card is defending."            — RALLY THE COAST GUARD

   Five pool cards carry an activated ability on a card in HAND. It prints
   a discard and no resource cost, so nothing ever priced it, and:

   - FROSTBITE ("cards AND ABILITIES cost you an additional {r} to …
     activate … when you play a card or activate an ability, destroy
     Frostbite") neither taxed it nor shattered: the token stayed to tax
     the next card instead. v4.86's reader, one route over — `effCost`
     never sees this activation, exactly as it never saw an ally's attack.
   - RALLY's "Discard a card" took the lowest-valued card in hand. It is
     the discard-cost question v4.85 built for an equipment's cost,
     asked of a hand ability, through the same reader.

   `parser.handAbilityTax` is the reader, `costTaxes` with the hand-ability
   route; `effects.frostShatter` is the one body `execute` and the hand
   ability share.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const PM = require("../engine/prompts.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const card = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p, code: null, q: 1}), {uid});
const frost = uid => ({uid, kind: "aura", card: card("Frostbite", 0, uid), spent: false});
const R = (g, a, seat) => {
  const r = J.reduce(g, a, seat == null ? 0 : seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  return r.state;
};
const iced = sd => (sd.board || []).some(b => /frostbite/i.test(b.card.name));

/* Seat 0 in its own action phase, holding priority. */
function own(mine){
  return Object.assign(H.state(Object.assign({res: 1, ap: 1, hand: []}, mine), {hp: 20},
                               {actor: 0, turnPlayer: 0, turn: 3}),
                       {phase: "action", step: "layer", priority: 0, passed: []});
}
/* Seat 0 DEFENDING seat 1's attack, in the reaction step, with Rally in
   the wall — the one state its printed gate allows. */
function defending(hand, rally, extra){
  const atk = {uid: 8800, name: "Probe Swing", tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
               power: 6, def: 2, pitch: 1, cost: 0, kw: [], tx: ""};
  const g = H.state(Object.assign({res: 0, ap: 0, hand, blockH: [rally.uid]}, extra || {}), {hp: 20},
                    {actor: 0, turnPlayer: 1, turn: 3});
  return Object.assign(g, {phase: "action", step: "reaction", priority: 0, passed: [], attacker: 1,
                           pend: {card: atk, by: 1, total: 6, base: 6}, chainCards: [atk]});
}

/* ---- 1. THE READER -------------------------------------------------- */

test("a hand ability owes Frostbite's tax, and neither Hyper Inflation's nor the first-action tax", {skip}, () => {
  H.db();
  const tw = card("Arcane Twining", 1, 1);
  const sd = {board: [frost(9)], nextTurn: [{kind: "firstActionTax", amt: 1, ready: true, spent: false}]};
  assert.equal(P.handAbilityTax(tw, sd, {costTax: 1}), 1,
    "Frostbite prints ABILITIES; Hyper Inflation prints CARDS PLAYED; the first-action tax an ACTION — this is an instant");
  assert.equal(P.handAbilityTax(tw, {board: []}, {}), 0, "untaxed, it costs nothing — the printed cost is the discard");
  assert.equal(P.handAbilityTax(card("Wounding Blow", 1, 2), sd, {}), 0, "a card with no hand ability owes nothing here");
  assert.equal(P.isActivation(tw, "handAbility"), true);
  assert.equal(P.isActionPaid(tw, "handAbility"), false, "the pool's five hand abilities are all instants");
});

/* ---- 2. DRIVEN AT THE TABLE ----------------------------------------- */

test("DRIVEN: under a Frostbite the ability pays its tax AND the token shatters", {skip}, () => {
  H.db();
  const g = own({res: 1, hand: [card("Arcane Twining", 1, 700)], board: [frost(990)]});
  const n = R(g, {t: "activate", uid: 700, from: "hand"});
  assert.equal(n.sides[0].res, 0, "the tax was not charged");
  assert.ok(!iced(n.sides[0]), "the Frostbite survived the activation it prints its destroy on");
  assert.equal(n.sides[0].amp, 1, "fixture: the ability did not resolve");
});

test("DRIVEN: short of the tax, a PAYMENT opens — and its answer activates, never plays", {skip}, () => {
  H.db();
  const tw = card("Arcane Twining", 1, 700), fuel = card("Wounding Blow", 3, 701);
  let n = R(own({res: 0, hand: [tw, fuel], board: [frost(990)]}), {t: "activate", uid: 700, from: "hand"});
  assert.equal(n.pending && n.pending.kind, "pay", "no payment opened for the tax");
  assert.equal(n.pending.need, 1);
  assert.match(String(J.legal(n, {t: "paySel", uid: 700}, 0)), /cannot pitch for itself/);
  n = R(R(n, {t: "paySel", uid: 701}), {t: "payConfirm"});
  assert.equal(n.pending, null);
  assert.equal(n.sides[0].amp, 1, "the payment did not resolve the ability");
  assert.ok(n.sides[0].grave.some(c => c.uid === 700), "the ability's own cost (discard this) was not paid");
  assert.ok(!(n.chainCards || []).some(c => c.uid === 700) && !(n.stack || []).length,
    "the payment PLAYED the card instead of activating its ability");
  assert.ok(!iced(n.sides[0]));
});

test("DRIVEN: with nothing to raise the tax, the activation is refused before anything is spent", {skip}, () => {
  H.db();
  const g = own({res: 0, hand: [card("Arcane Twining", 1, 700)], board: [frost(990)]});
  assert.match(String(J.legal(g, {t: "activate", uid: 700, from: "hand"}, 0)), /costs 1 to activate/);
  /* the control: untaxed, the same seat activates it for free */
  assert.equal(J.legal(own({res: 0, hand: [card("Arcane Twining", 1, 700)]}), {t: "activate", uid: 700, from: "hand"}, 0), null);
});

test("DRIVEN: Rally asks WHICH card its discard spends, and spends that one", {skip}, () => {
  H.db();
  const rally = card("Rally the Coast Guard", 1, 710);
  const a = card("Wounding Blow", 1, 711), b = card("Brutal Assault", 2, 712);
  const g = defending([rally, a, b], rally);
  assert.equal(J.legal(g, {t: "activate", uid: 710, from: "hand"}, 0), null, "fixture: Rally is not activatable here");
  const asked = R(g, {t: "activate", uid: 710, from: "hand"});
  assert.equal(asked.pending && asked.pending.kind, "discost", "the discard was taken without asking");
  assert.deepEqual(asked.pending.uids, [711, 712]);
  const n = R(asked, {t: "discost", uid: 712});
  assert.ok(n.sides[0].grave.some(c => c.uid === 712), "the named card was not the one discarded");
  assert.ok(n.sides[0].hand.some(c => c.uid === 711), "…and the other left the hand anyway");
  assert.equal(n._discCostUid, undefined, "the answer outlived the ability");
});

test("the question never offers Rally itself, or a card already in the wall", {skip}, () => {
  H.db();
  const rally = card("Rally the Coast Guard", 1, 710);
  const a = card("Wounding Blow", 1, 711), b = card("Brutal Assault", 2, 712);
  assert.equal(PM.discCostChoice(rally, {hand: [rally, a], blockH: [710]}), null, "one payer is no choice");
  /* …and with Rally NOT in the wall, so the wall check cannot be the thing
     excluding it (v3.62: a fixture where two guards coincide tests neither) */
  assert.equal(PM.discCostChoice(rally, {hand: [rally, a]}), null, "Rally was offered to pay its own cost");
  assert.equal(PM.discCostChoice(rally, {hand: [rally, a, b], blockH: [710, 712]}), null,
    "a declared defender is committed and cannot pay the cost");
  assert.equal(PM.discCostChoice(card("Arcane Twining", 1, 1), {hand: [a, b]}), null, "\"Discard THIS\" is no choice");
});

test("DRIVEN: under a tax, the legality keeps a card back for the discard", {skip}, () => {
  /* One other card in hand, a Frostbite, no resources: that card cannot
     both pay the {r} and be discarded, so the activation is refused
     rather than pitched for and then resolved to nothing (v4.49). */
  H.db();
  const rally = card("Rally the Coast Guard", 1, 710);
  const g = defending([rally, card("Wounding Blow", 3, 711)], rally, {board: [frost(990)]});
  assert.match(String(J.legal(g, {t: "activate", uid: 710, from: "hand"}, 0)), /cannot raise it/,
    "the only card was allowed to pay the tax AND the discard");
  /* the control: two other cards, and one of them can pay */
  const g2 = defending([rally, card("Wounding Blow", 3, 711), card("Brutal Assault", 1, 712)], rally, {board: [frost(990)]});
  assert.equal(J.legal(g2, {t: "activate", uid: 710, from: "hand"}, 0), null);
});

test("DRIVEN: the card declared for the discard cannot also pitch for the tax", {skip}, () => {
  H.db();
  const rally = card("Rally the Coast Guard", 1, 710);
  const g = defending([rally, card("Wounding Blow", 3, 711), card("Brutal Assault", 1, 712)], rally, {board: [frost(990)]});
  let n = R(R(g, {t: "activate", uid: 710, from: "hand"}), {t: "discost", uid: 711});
  assert.equal(n.pending && n.pending.kind, "pay", "no payment opened for the tax");
  assert.match(String(J.legal(n, {t: "paySel", uid: 711}, 0)), /already spent on the discard/);
  n = R(R(n, {t: "paySel", uid: 712}), {t: "payConfirm"});
  assert.ok(n.sides[0].grave.some(c => c.uid === 711), "the declared card was not the one discarded");
  assert.ok(!iced(n.sides[0]), "the Frostbite survived");
});

test("an unaffordable tax off the wire is INERT, never free", {skip}, () => {
  /* Both boards raise the resources first, so only a stale or crafted
     action reaches `activateHandAbility` short. v2.04: inert, never free. */
  H.db();
  const g = own({res: 0, hand: [card("Arcane Twining", 1, 700)], board: [frost(990)]});
  const r = J.withEffects(g, (fx, s) => fx.activateHandAbility(s, g.sides[0].hand[0]));
  assert.ok(r.why, "an ability short of its tax resolved anyway");
  assert.equal(r.game.sides[0].amp || 0, 0);
  assert.ok(iced(r.game.sides[0]), "…and shattered the Frostbite it never paid");
});

/* ---- 3. ONE BODY ------------------------------------------------------ */

test("Frostbite's shatter is ONE body, asked by `execute` and by the hand ability", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /function frostShatter\(n, name\)\{/);
  assert.equal((src.match(/board\.filter\(b => !isFrostbite\(b\)\)/g) || []).length, 1,
    "a second copy of the shatter — the one that let a hand ability skip it");
  assert.equal((src.match(/n = frostShatter\(n, /g) || []).length, 2, "execute and the hand ability must both ask it");
});

/* ---- 4. THE TRAINER, WHICH NO DRILL CAN DRIVE ------------------------ */

test("the trainer's hand-ability door asks the question and raises the tax", () => {
  const body = HTML.slice(HTML.indexOf("const activateHand = c => setG(s=>{"), HTML.indexOf("const closeChain = () => setG"));
  assert.match(body, /const _dcq = DawnPrompts\.discCostChoice\(c, act\(s\)\);\n      if\(_dcq\) return L\(\{\.\.\.s, mode:"discpick"/,
    "Rally's discard is taken without asking on the trainer");
  assert.match(body, /redo:"hand"/, "the answer would re-enter `tryPlay`, which PLAYS the card");
  assert.match(body, /const _hat = DawnParser\.handAbilityTax\(c, act\(s\), costCtx\(s, actorOf\(s\)\)\);/);
  assert.match(body, /autoPitch\(s, _hat, \[c\.uid, s\._discCostUid\]\)/,
    "the pitch may spend the card itself or the one declared for the discard");
  assert.match(body, /if\(r\.why\)\{ const back = \{\.\.\.s0\};/, "a refusal keeps the pitched cards spent");
  assert.match(HTML, /if\(pk\.redo === "hand"\) activateHand\(pk\.card\);\n    else tryPlay\(pk\.card, pk\.from, pk\.idx\);/);
});
