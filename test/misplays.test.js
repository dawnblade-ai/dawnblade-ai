/* ============================================================
   THE CARRIED AI MISPLAYS (QA-A H-5, QA-B H-3/H-4/H-5; ship/ai-misplays)

   Four plays the seat policy made into nothing, each now asked of a judge
   reader (the policy reads no card text):

     Uphold Tradition  turned up and paid for with no ward aura to take its
                       +1{p} counter                    judge.landsNothing
     Frost Spike       a Frostbite into a hero with no exposed armour zone
                                                        judge.landsNothing
     Mage Master Boots destroyed for a non-attack go-again grant with no
                       non-attack action card to take it judge.landsNothing
     Bolt'n Boots      destroyed for go again on an arrow that already has it
                                                        judge.gaAbilityRedundant

   Each drill asks for the REFUSAL and for the MATCH: the same state with
   the one missing thing supplied, where the reader flips and the seat acts.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";
const SPP = () => require("../tools/selfplay.js");
const SP = require("../engine/sparring.js");
const J = H.J;

const side = (g, i, o) => ({...g, sides: g.sides.map((s, k) => k === i ? {...s, ...o} : s)});
const gearOf = (g, i, re) => g.sides[i].gear.find(x => re.test(x.name));

test("Uphold Tradition is not turned up with no ward aura to take its counter — and is, once there is one", {skip}, () => {
  const {match} = SPP();
  let g = side(match("enigma", "kayo", "mp-u", 0), 0, {hand: [], arsenal: null, res: 3});
  const up = gearOf(g, 0, /Uphold Tradition/);
  assert.equal(J.landsNothing(g, 0, up.uid, "gear"), true, "an empty board: the counter lands nowhere");
  const a = SP.act(g, 0);
  assert.ok(!(a && a.t === "activate" && a.uid === up.uid), "the seat does not pay for nothing: " + JSON.stringify(a));
  assert.equal(SP.explain(g, 0).key, "endTurnIdle", "and the call says why the turn ends with it unused");
  const isUp = x => x.t === "activate" && x.uid === up.uid;
  assert.ok(!SP.laCands(g, 0, null).some(isUp), "Sharp does not propose it either");

  const shield = {...H.card("Spectral Shield", 0), uid: "tokSS1"};
  g = side(g, 0, {board: [{card: shield, kind: "aura", spent: false, uid: "tokSS1"}]});
  assert.equal(J.landsNothing(g, 0, up.uid, "gear"), false, "a ward aura is there to take it");
  assert.ok(SP.laCands(g, 0, null).some(isUp), "so it is a candidate again");
});

test("Frost Spike is held against a hero with no exposed armour zone — and played into one", {skip}, () => {
  const {match} = SPP();
  let g = match("iyslander", "dash", "mp-f", 0);
  const fs = g.sides[0].deck.find(c => c.name === "Frost Spike");
  assert.ok(fs, "Iyslander decks Frost Spike");
  g = side(g, 0, {hand: [fs], arsenal: null, deck: g.sides[0].deck.filter(c => c !== fs), res: 3});
  assert.equal(J.landsNothing(g, 0, fs.uid, "hand"), true, "Dash wears all four armour pieces");
  const a = SP.act(g, 0);
  assert.ok(!(a && a.t === "play" && a.uid === fs.uid), "it is not played into nothing: " + JSON.stringify(a));

  g = side(g, 1, {gear: g.sides[1].gear.filter(x => !/Helm/.test(x.name))});
  assert.equal(J.landsNothing(g, 0, fs.uid, "hand"), false, "the head zone is exposed now");
  const b = SP.act(g, 0);
  assert.ok(b && b.t === "play" && b.uid === fs.uid, "so it is played: " + JSON.stringify(b));
});

test("Mage Master Boots' non-attack grant lands nothing with only an attack and an instant in hand — and lands with a non-attack action", {skip}, () => {
  const {match} = SPP();
  let g = match("gravy", "dash", "mp-g", 0);
  const boots = gearOf(g, 0, /Mage Master Boots/);
  const pick = re => g.sides[0].hand.concat(g.sides[0].deck).find(c => re.test(c.name));
  const barque = pick(/Battalion Barque/), throwC = pick(/Throw Caution/), portside = pick(/Portside Exchange/);
  g = side(g, 0, {hand: [barque, throwC], arsenal: null, grave: [], banish: [], res: 1});
  assert.equal(J.landsNothing(g, 0, boots.uid, "gear"), true,
    "an attack takes no non-attack grant, and an instant is not an action card");
  g = side(g, 0, {hand: [barque, throwC, portside]});
  assert.equal(J.landsNothing(g, 0, boots.uid, "gear"), false, "Portside Exchange is a non-attack action card");
});

test("Bolt'n Boots' go again is redundant on a link that already goes again — and not on one that does not", {skip}, () => {
  const {match} = SPP();
  const g0 = match("azalea", "dash", "mp-b", 0);
  const boots = gearOf(g0, 0, /Bolt'n Boots/);
  const arrow = {...H.card("Bolt'n' Shot", 1), uid: "arr1"};
  const open = ga => ({...g0, pend: {card: arrow, by: 0, ga, total: 4, ops: [], lateConds: []}});
  assert.equal(J.gaAbilityRedundant(g0, 0, boots.uid), false, "no link, nothing to be redundant about");
  assert.equal(J.gaAbilityRedundant(open(true), 0, boots.uid), true, "the arrow already goes again");
  assert.equal(J.gaAbilityRedundant(open(false), 0, boots.uid), false, "it does not, so the go again is real");
  /* the late "pumped above base" go again counts once the link IS above base */
  const late = (total) => ({...g0, pend: {card: arrow, by: 0, ga: false, total, ops: [],
    lateConds: [{cond: "pumped", op: ["ga"]}]}});
  assert.equal(J.linkGoesAgain(late(9)), true, "pumped far above its base, its own go again is certain");
  assert.equal(J.linkGoesAgain(late(0)), false, "at or below base it is not");
  /* a piece whose payout is anything but that go again is never redundant */
  const blossom = gearOf(g0, 0, /Blossom of Spring/);
  assert.equal(J.gaAbilityRedundant(open(true), 0, blossom.uid), false);
});

test("the gate: SPXFIX names the seats the fixes are on for, and the call key for each is in CALL_WHY", () => {
  for(const k of ["endTurnIdle", "rxGaHeld"]) assert.ok(SP.CALL_WHY[k], k);
  assert.ok(!/\b(uid|pend|gaQ|fx)\b/.test(SP.CALL_WHY.endTurnIdle + SP.CALL_WHY.rxGaHeld), "no identifiers in player-facing text");
});

test("Refraction Bolters is destroyed for go again when the kept action point buys a swing — and kept when it buys nothing", {skip}, () => {
  const {match} = SPP();
  const g0 = match("dorinthea", "arakni", "mp-r", 0);
  const bolters = gearOf(g0, 0, /Refraction Bolters/), blade = gearOf(g0, 0, /Dawnblade/);
  const sheet = (o, pend) => ({...side(g0, 0, {res: 1, hand: [], arsenal: null, ...o}),
    pend: {card: blade, by: 0, ga: false, total: 3, ops: [], lateConds: [], ...pend},
    prompt: {tag: "pay", side: 0, src: "Refraction Bolters", cost: 0, ops: [["ga"]], destroyUid: bolters.uid, choice: null}});
  /* Dorinthea's hit has lifted the Dawnblade's once-per-turn limit: one more swing is there */
  const live = sheet({weaponUsed: {}}, {});
  assert.equal(J.payBuysGoAgain(live, 0), true);
  const e = SP.explain(live, 0);
  assert.deepEqual(e.action, {t: "promptChoose", choice: "pay"}, "the piece is spent for the second swing");
  assert.equal(e.key, "payGoAgain");
  /* the refusals: nothing to swing, a link that already goes again, a sheet that also asks resources */
  const spent = sheet({weaponUsed: {[blade.uid]: true}}, {});
  assert.equal(J.payBuysGoAgain(spent, 0), false, "the weapon is spent and no attack is held: the point buys nothing");
  assert.equal(SP.act(spent, 0).choice, "decline");
  assert.equal(J.payBuysGoAgain(sheet({weaponUsed: {}}, {ga: true}), 0), false, "it already goes again");
  const priced = sheet({weaponUsed: {}}, {});
  assert.equal(J.payBuysGoAgain({...priced, prompt: {...priced.prompt, cost: 2}}, 0), false, "a resource price is the price rule's to weigh");
});

test("a soak that needs a card pitched is priced as the card: 1 point is not worth one, 2 is, lethal always is", () => {
  const E = require("../engine/effects.js");
  const bar = n => ({uid: "b" + n, name: "Barrier " + n, kind: "barrier", amount: n, cost: n});
  const live = (amount, opts, avail) => ({amount, options: opts, avail});
  const sd = (res, hp) => ({res, hp, hand: [{uid: "h1", pitch: 3}]});
  /* the old price: resources only — a whole card pitched to stop 1 */
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 20)), [0], "the plain rule takes it");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 20), {cardPrice: true}), [],
    "priced as the card it pitches, 1 point is not worth it");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(1, 20), {cardPrice: true}), [0],
    "paid from what is already floating, nothing is pitched: taken");
  assert.deepEqual(E.soakPolicy(live(2, [bar(2)], 3), sd(0, 20), {cardPrice: true}), [0], "2 points for the card: taken");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 1), {cardPrice: true}), [0], "at lethal nothing held is worth more");
  const J = require("../engine/judge.js");
  const g = {sides: [sd(0, 20), sd(0, 20)], prompt: {tag: "soak", side: 0, ...live(1, [bar(1)], 3), sel: []}};
  assert.deepEqual(J.autoAnswer(g, {cardPrice: true}), {t: "promptConfirm"}, "the one answer body carries the ask");
  assert.deepEqual(J.autoAnswer(g), {t: "promptSel", i: 0});
});
