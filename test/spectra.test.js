/* ============================================================
   test/spectra.test.js — SPECTRA (v6.47, Prism reader 5a)

   CR 8.3.14, verbatim: "Spectra is a static ability and a triggered-static ability that
   respectively mean "This can be attacked." and "When this becomes the target of an attack,
   destroy this." 8.3.14a An object with Spectra can be the target of an attack, even if it
   is not a living-card. 8.3.14b When an object with Spectra becomes the target of an attack,
   a triggered-layer is put on the stack. When the triggered-layer resolves, the object with
   Spectra is destroyed. If there are not other legal attack-targets, the combat chain
   closes."  CR 7.2.2c: with no legal attack-target "the attack is cleared from the queue".

   Staged Passing Mirage (an Illusionist aura with Spectra) sits on Enigma's board; Kayo
   swings an attack action card at it (CR 8.3.14a: the aura is a legal target; CR 7.2.3: the
   cleared attack never reaches the "attack" event). Assertions are on zones, life, action points and the
   step, never the feed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const MIRAGE = C.resolveEntry(STAGED, {name: "Passing Mirage", p: 3, code: null, q: 1});

/* Kayo (seat 0) on turn, one attack action card in hand with no "when this attacks" line;
   Enigma (seat 1) with a Passing Mirage in the arena and an empty hand. */
function table(o){
  o = o || {};
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make("spectra");
  const h0 = W.HEROES.find(x => x.k === "kayo"), h1 = W.HEROES.find(x => x.k === "enigma");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.enigma), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sides = g.sides.slice();
  const all = [...sides[0].hand, ...sides[0].deck];
  const cands = all.filter(c => P.isAtkActionCard(c) && (+c.power || 0) >= 3
                            && !(P.fxParse(c).onAtk || []).length && !(P.fxParse(c).onAtkHero || []).length
                            && !P.hasKw(c, "intimidate"));
  cands.sort((x, y) => String(x.tx || "").length - String(y.tx || "").length || String(x.uid).localeCompare(String(y.uid)));
  const atk = cands.find(c => {
    const s0 = Object.assign({}, sides[0], {res: 9, hand: [c]});
    const gg = Object.assign({}, g, {sides: [s0, sides[1]]});
    return J.legal(gg, {t: "play", uid: c.uid}, 0) == null;
  });
  const mirage = Object.assign({}, o.card || MIRAGE, {uid: "mirage1"});
  sides[0] = Object.assign({}, sides[0], {res: 9, hand: [atk], deck: all.filter(c => c !== atk)});
  sides[1] = Object.assign({}, sides[1], {hand: [],
    board: [...(sides[1].board || []), {card: mirage, kind: "aura", spent: false, uid: "mirage1"}]});
  return {g: Object.assign({}, g, {sides}), atk};
}
function passOut(n){
  for(let i = 0; i < 60 && (n.pend || (n.stack || []).length || n.prompt || n.chainOpen); i++){
    const m = H.move(n); if(m === n) break; n = m;
  }
  return n;
}
const onBoard = (sd, uid) => (sd.board || []).some(b => b && b.uid === uid);
const inGrave = (sd, uid) => (sd.grave || []).some(c => c && c.uid === uid);

test("the reader: the Spectra line is read, and only a Spectra permanent is offered as a target", {skip}, () => {
  assert.ok(MIRAGE && MIRAGE.resolved, "fixture: Passing Mirage did not resolve");
  P.fxReset();
  const sp = P.fxParse({...MIRAGE, name: "Drill Mirage"}).clauses.find(c => /^spectra$/i.test(c.t));
  assert.equal(sp && sp.st, "noop", "the Spectra line is not read");
  const t = table();
  const list = J.targets(t.g, 1);
  assert.deepEqual(list.map(x => x._target.kind), ["hero", "spectra"]);
  assert.equal(J.targetSpec(list[1]), "mirage1");
  /* a plain aura (Spectra struck off) is not attackable */
  const plain = table({card: {...MIRAGE, name: "Drill Plain Aura", tx: "Your first Illusionist attack each turn loses and can't gain phantasm.", kw: []}});
  assert.deepEqual(J.targets(plain.g, 1).map(x => x._target.kind), ["hero"], "an aura without Spectra was offered as a target");
  /* game.js offers nothing without the caller's predicate (the trainer's call) */
  assert.deepEqual(G.attackTargets(t.g, 1).map(x => x._target.kind), ["hero"]);
});

test("DRIVEN: attacking the Spectra aura destroys it, clears the attack and closes the chain", {skip}, () => {
  const t = table();
  assert.ok(t.atk, "fixture: no plain attack action card in Kayo's deck");
  const A = {t: "play", uid: t.atk.uid, target: "mirage1"};
  assert.equal(J.legal(t.g, A, 0), null, "the table refused an attack on a Spectra aura");
  const ap0 = t.g.sides[0].ap, hp1 = t.g.sides[1].hp;
  const out = passOut(J.reduce(t.g, A, 0).state);
  assert.equal(onBoard(out.sides[1], "mirage1"), false, "the Spectra aura is still in the arena");
  assert.ok(inGrave(out.sides[1], "mirage1"), "the destroyed aura is not in its owner's graveyard");
  assert.ok(inGrave(out.sides[0], t.atk.uid), "the cleared attack card was not filed");
  assert.equal(out.sides[1].hp, hp1, "the cleared attack dealt damage");
  assert.equal(out.sides[0].ap, ap0 - 1, "the cleared attack refunded or kept its action point");
  assert.equal(out.pend, null, "a chain link is open after the attack was cleared");
  assert.equal(out.chainOpen, false, "the combat chain did not close");
  assert.equal(out.step, "layer", "the action phase did not continue");
  assert.equal(out.priority, 0, "the turn-player does not hold priority");
});

test("the control: the same attack at the hero lands and the aura stays", {skip}, () => {
  const t = table();
  const hp1 = t.g.sides[1].hp;
  const out = passOut(J.reduce(t.g, {t: "play", uid: t.atk.uid, target: "hero"}, 0).state);
  assert.ok(onBoard(out.sides[1], "mirage1"), "attacking the hero destroyed the Spectra aura");
  assert.ok(out.sides[1].hp < hp1, "the hero attack dealt nothing");
});

test("CR 7.2.2c: the cleared attack never reaches the attack event — no \"when this attacks\" line fires", {skip}, () => {
  const t = table();
  const sa = Object.assign({}, H.card("Spellblade Assault", 1), {uid: "sa1"});
  assert.ok(sa && sa.resolved && (P.fxParse(sa).onAtk || []).length, "fixture: Spellblade Assault has no attack trigger");
  const sides = t.g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {hand: [sa], board: []});
  const g = Object.assign({}, t.g, {sides});
  const runes = s => (s.board || []).filter(b => b && /Runechant/.test(b.card.name)).length;
  const at = passOut(J.reduce(g, {t: "play", uid: "sa1", target: "mirage1"}, 0).state);
  assert.equal(onBoard(at.sides[1], "mirage1"), false, "fixture: the aura was not destroyed");
  assert.equal(runes(at.sides[0]), 0, "the cleared attack's \"when this attacks\" made Runechants");
  const hero = H.drain(J.reduce(g, {t: "play", uid: "sa1", target: "hero"}, 0).state);
  assert.equal(runes(hero.sides[0]), 2, "control: the same attack at the hero made no Runechants");
});
