/* ============================================================
   EACH COST TAX TAXES WHAT IT PRINTS (v4.86)

     FROSTBITE        "Cards AND ABILITIES cost you an additional {r} to
                       play or activate."
     HYPER INFLATION  "CARDS cost {r} more to PLAY this turn."
     CARTILAGE CRUSH  "their first ACTION during their next turn costs an
                       additional {r} to play or activate."

   `effCost` added all three to everything it priced, and an ally's or an
   aura's attack (priced off its own printed line, never `effCost`) paid
   none of them. So:

   - Hyper Inflation taxed abilities and weapon swings, which are
     activated, not played. Found in the trainer at v4.85, when Prey
     Spotters' free ability asked Arakni to pitch 1.
   - An ally's attack under a Frostbite paid its printed 2, and the
     Frostbite was destroyed by that activation all the same: the tax went
     free, stronger than printed for the attacker.
   - The first-action tax was paid, and SPENT, by an instant or a reaction,
     so the action it was waiting for went untaxed; and an ally's attack,
     which IS an action, neither paid it nor spent it.

   `parser.costTaxes(c, sd, o, route)` is the one reader. `route` names the
   two activations `effCost` cannot see ("ally", "aura").
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const card = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p, code: null, q: 1}), {uid});
const frost = uid => ({uid, kind: "aura", card: card("Frostbite", 0, uid), spent: false});
const crushTax = () => [{kind: "firstActionTax", amt: 1, ready: true, spent: false}];
const R = (g, a, seat) => {
  const r = J.reduce(g, a, seat == null ? 0 : seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  return r.state;
};
const open = (mine, theirs, extra) => Object.assign(
  H.state(Object.assign({res: 9, ap: 1, hand: []}, mine), Object.assign({hp: 20}, theirs || {}),
          {actor: 0, turnPlayer: 0, turn: 3}),
  {phase: "action", step: "layer", priority: 0, passed: []}, extra || {});

/* ---- 1. THE READER -------------------------------------------------- */

const ACTION  = {name: "Probe Action", tt: "Generic Action", ty: ["Generic", "Action"], cost: 1};
const INSTANT = {name: "Probe Instant", tt: "Generic Instant", ty: ["Generic", "Instant"], cost: 1};
const DREACT  = {name: "Probe Reaction", tt: "Generic Defense Reaction", ty: ["Generic", "Defense Reaction"], cost: 1};
const ABILITY = {name: "Probe — ability", tt: "Equipment Ability", cost: 0};
const INST_AB = {name: "Probe — ability", tt: "Hero Ability", cost: 0, _instant: true};
const RX_AB   = {name: "Probe — ability", tt: "Equipment Ability", cost: 0, _attackRx: true};
const WEAPON  = {name: "Probe Sword", tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon", "Sword", "1H"], cost: 1};
const ALLY    = {name: "Probe Ally", tt: "Pirate Action - Ally", ty: ["Pirate", "Action", "Ally"], cost: 3};

test("an ACTIVATION is an ability or a weapon's attack, or the route says so", () => {
  for(const c of [ABILITY, INST_AB, RX_AB, WEAPON, {tt: "Arena Ability"}, {tt: "Hero Ability"}])
    assert.equal(P.isActivation(c), true, c.tt);
  for(const c of [ACTION, INSTANT, DREACT, ALLY]) assert.equal(P.isActivation(c), false, c.tt);
  assert.equal(P.isActivation(ALLY, "ally"), true, "an ally's ATTACK is activated, not played");
  assert.equal(P.isActivation({name: "Spectral Shield"}, "aura"), true);
  /* A near-miss that differs ONLY in what follows the word, so the end
     anchor is the one thing refusing it (v3.62: a fixture must be able to
     express the bug). Synthetic: no pool record prints either (v3.73). */
  assert.equal(P.isActivation({tt: "Equipment Ability Gauntlet"}), false,
    "the word must END the type line — a record carrying it mid-line is not a powCard");
});

test("an ACTION is an action card or an action-speed ability, never an instant or a reaction", () => {
  for(const c of [ACTION, ABILITY, WEAPON, ALLY]) assert.equal(P.isActionPaid(c), true, c.name);
  for(const c of [INSTANT, DREACT, INST_AB, RX_AB]) assert.equal(P.isActionPaid(c), false, c.name + " / " + c.tt);
  /* "Reaction" contains "action" (v2.44): the STRUCTURED array decides */
  assert.equal(P.isActionPaid({tt: "Generic Action Defense Reaction", ty: ["Generic", "Defense Reaction"]}), false);
  assert.equal(P.isActionPaid(ALLY, "ally"), true);
  assert.equal(P.isActionPaid({name: "x"}, "aura"), true);
});

test("each tax reaches what it prints, and nothing else", () => {
  const sd = {board: [], nextTurn: []};
  for(const c of [ACTION, INSTANT, DREACT])
    assert.equal(P.costTaxes(c, sd, {costTax: 1}), 1, "Hyper Inflation taxes every CARD played: " + c.name);
  for(const c of [ABILITY, INST_AB, RX_AB, WEAPON])
    assert.equal(P.costTaxes(c, sd, {costTax: 1}), 0, "Hyper Inflation taxed an ACTIVATION: " + c.name);
  assert.equal(P.costTaxes(ALLY, sd, {costTax: 1}, "ally"), 0, "…an ally's attack included");
  const iced = {board: [{kind: "aura", card: {name: "Frostbite", tt: "Generic Token - Aura", tx: ""}}], nextTurn: []};
  const fc = P.costTaxes(ACTION, iced, {});
  const fa = P.costTaxes(ABILITY, iced, {});
  const fr = P.costTaxes(ALLY, iced, {}, "ally");
  assert.ok(fc >= 1 && fa === fc && fr === fc, "Frostbite taxes cards AND abilities alike: " + [fc, fa, fr]);
  const crushed = {board: [], nextTurn: crushTax()};
  for(const c of [ACTION, ABILITY, WEAPON]) assert.equal(P.costTaxes(c, crushed, {}), 1, "the first action: " + c.name);
  assert.equal(P.costTaxes(ALLY, crushed, {}, "ally"), 1, "an ally's attack IS an action");
  for(const c of [INSTANT, DREACT, INST_AB, RX_AB]) assert.equal(P.costTaxes(c, crushed, {}), 0, "not an action: " + c.name);
});

test("effCost adds exactly the taxes `costTaxes` answers — one reader, not two", () => {
  const sd = {board: [], nextTurn: crushTax()};
  for(const c of [ACTION, INSTANT, ABILITY, WEAPON])
    assert.equal(P.effCost(c, sd, {costTax: 1}), Math.max(0, c.cost || 0) + P.costTaxes(c, sd, {costTax: 1}), c.name);
});

/* ---- 2. DRIVEN AT THE TABLE ----------------------------------------- */

test("DRIVEN: an ally's attack under a Frostbite PAYS the tax that destroys the token", {skip}, () => {
  H.db();
  const sw = card("Swabbie", 2, 300);
  const g = open({board: [{uid: 300, kind: "ally", card: sw, spent: false, life: sw.life}, frost(990)]});
  const printed = P.allyAttack(sw).cost;
  const n = H.drain(R(g, {t: "activate", uid: 300, from: "board"}));
  assert.equal(n.sides[0].res, 9 - printed - 1,
    "the attack paid its printed " + printed + " and nothing for the Frostbite it destroyed");
  assert.ok(!n.sides[0].board.some(b => /frostbite/i.test(b.card.name)), "fixture: the Frostbite was not spent");
});

test("DRIVEN: …and a seat that can raise only the printed cost is refused", {skip}, () => {
  H.db();
  const sw = card("Swabbie", 2, 300);
  const printed = P.allyAttack(sw).cost;
  const g = open({res: printed, board: [{uid: 300, kind: "ally", card: sw, spent: false, life: sw.life}, frost(990)]});
  assert.match(String(J.legal(g, {t: "activate", uid: 300, from: "board"}, 0)), /costs 3 to attack/,
    "the refusal must quote the taxed cost");
  assert.equal(J.boardAttackOf(g, 0, 300).cost, printed + 1, "the policy's view quotes a different price from legal");
});

test("DRIVEN: under Hyper Inflation a free ability is still free, and a card still pays", {skip}, () => {
  H.db();
  const cc = C.resolveEntry(H.db(), {name: "Carrion Crown", p: 0, code: null, q: 1});
  const pw = P.parseHeroPower(cc.tx, true);
  const pc = {name: "Carrion Crown — ability", pitch: 0, cost: 0, power: null, def: null,
    tt: "Equipment Ability", kw: ["Go again"], gkw: [], tx: "Draw a card. Go again",
    sd: true, _discardCost: pw.discardCost.filter, _discardSubject: pw.discardCost.subject, uid: "gp901"};
  const g = open({res: 0, gear: [Object.assign({}, cc, {uid: 901, pow: pw, powCard: pc})],
                  hand: [card("Barnacle", 2, 500)], deck: [card("Wounding Blow", 1, 600)]}, {}, {costTax: 1});
  assert.equal(J.legal(g, {t: "activate", uid: 901, from: "gear"}, 0), null,
    "an ACTIVATION was taxed by a card that taxes cards PLAYED");
  const n = H.drain(R(g, {t: "activate", uid: 901, from: "gear"}));
  assert.equal(n.sides[0].res, 0, "resources were charged for a free ability");
  /* the control: a CARD played under the same tax pays it */
  const atk = card("Wounding Blow", 1, 700);
  const g2 = open({res: 9, hand: [atk]}, {}, {costTax: 1});
  const p2 = R(g2, {t: "play", uid: 700, from: "hand"});
  assert.equal(p2.sides[0].res, 9 - (atk.cost || 0) - 1, "the card played did not pay the tax");
});

test("DRIVEN: the first-action tax waits past an instant, then lands on the action", {skip}, () => {
  H.db();
  const inst = card("Cloud Cover", 3, 710), atk = card("Wounding Blow", 1, 711);
  let g = open({res: 9, ap: 1, hand: [inst, atk], nextTurn: crushTax()});
  g = H.drain(R(g, {t: "play", uid: 710, from: "hand"}));
  assert.equal(g.sides[0].res, 9 - (inst.cost || 0), "an INSTANT paid the first-action tax");
  assert.ok(g.sides[0].nextTurn.some(e => e.kind === "firstActionTax" && !e.spent),
    "an instant SPENT the tax, so the action it was printed for goes free");
  const before = g.sides[0].res;
  g = R(g, {t: "play", uid: 711, from: "hand"});
  assert.equal(g.sides[0].res, before - (atk.cost || 0) - 1, "the first ACTION was not taxed");
  assert.ok(g.sides[0].nextTurn.every(e => e.kind !== "firstActionTax" || e.spent), "…or was taxed and not spent");
});

test("DRIVEN: an ally's attack is an action — it pays the first-action tax and spends it", {skip}, () => {
  H.db();
  const sw = card("Swabbie", 2, 300);
  const g = open({board: [{uid: 300, kind: "ally", card: sw, spent: false, life: sw.life}], nextTurn: crushTax()});
  const n = R(g, {t: "activate", uid: 300, from: "board"});
  assert.equal(n.sides[0].res, 9 - P.allyAttack(sw).cost - 1);
  assert.ok(n.sides[0].nextTurn.every(e => e.kind !== "firstActionTax" || e.spent));
});

/* ---- 3. THE TRAINER, WHICH NO DRILL CAN DRIVE ------------------------ */

test("the trainer prices every payment through ONE reader, and it knows the ally route", () => {
  assert.match(HTML, /const payCost = \(s, card, from\) => from==="ally"\n    \? \(\(DawnParser\.allyAttack\(card\)\|\|\{\}\)\.cost \|\| 0\) \+ DawnParser\.costTaxes\(card, act\(s\), costCtx\(s, actorOf\(s\)\), "ally"\)\n    : effCost\(card, act\(s\), costCtx\(s, actorOf\(s\)\)\);/,
    "an ally's attack must be priced off its own line, with its taxes");
  const tp = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx,half)"), HTML.indexOf("const confirmPay = () => setG"));
  assert.match(tp, /const cost = payCost\(s, card, from\);/, "tryPlay prices a play its own way again");
  const cp = HTML.slice(HTML.indexOf("const confirmPay = () => setG"), HTML.indexOf("const cancelPay = () =>"));
  assert.match(cp, /const need = payCost\(s, s\.pending\.card, s\.pending\.from\)-you\(s\)\.res;/,
    "confirmPay prices an ally's attack at the ally's PLAY cost — Limpit reads covered at 0 and charges 1");
  assert.equal((HTML.match(/payCost\(g, g\.pending\.card, g\.pending\.from\)/g) || []).length, 2,
    "the pay chip and the statusline must quote the price confirmPay charges");
  assert.doesNotMatch(HTML, /effCost\(g\.pending\.card/, "a display site still prices the pending card itself");
});
