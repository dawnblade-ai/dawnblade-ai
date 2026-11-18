/* ============================================================
   test/iris.test.js — IRIS OF REALITY (v6.47, Prism reader 4)

   Iris of Reality (staged, Prism's weapon): "During your action phase, Illusionist auras you
   control are weapons with 4 base {p} and "Once per Turn Action - {r}{r}{r}: Attack. Go again""

   Cosmo's grant (test/cosmo.test.js) with three words moved: the subject is a CLASS of aura,
   the power a printed NUMBER, and the go again rides on the quoted line itself. One reader
   (`parser.auraWeaponGrant`) answers both; this drives Iris on Cosmo's real Enigma table with
   Iris in Cosmo's place (both are Illusionist 2H weapons).
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
const IRIS = C.resolveEntry(STAGED, {name: "Iris of Reality", p: 0, code: null, q: 1});

function table(o){
  o = o || {};
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make("iris");
  const h0 = W.HEROES.find(x => x.k === "enigma"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.enigma), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [Object.assign({}, b0.b, {auraDiscount: null}), b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  g = J.withEffects(g, (fx, n) => ({game: fx.runOps(n, [["token", "Spectral Shield", 1, "self"]], "probe")})).game;
  const sh = (g.sides[0].board || []).find(e => /Spectral Shield/.test(e.card.name));
  const sides = g.sides.slice();
  const gear = (sides[0].gear || []).filter(x => !/^Cosmo/.test(x.name));
  sides[0] = Object.assign({}, sides[0], {res: 9, hand: [],
    gear: o.noIris ? gear : gear.concat([Object.assign({}, IRIS, {uid: "iris1"})])},
    o.board ? {board: sides[0].board.concat(o.board)} : {});
  sides[1] = Object.assign({}, sides[1], {hand: []});
  return {g: Object.assign({}, g, {sides}), uid: sh.uid};
}
function passOut(n){
  for(let i = 0; i < 60 && (n.pend || (n.stack || []).length || n.prompt); i++){
    if(n.prompt){ const o = J.reduce(n, {t: "promptConfirm"}, n.prompt.side || 0); if(o.error) break; n = o.state; continue; }
    let moved = false;
    for(const s of [0, 1]){ const o = J.reduce(n, {t: "pass"}, s); if(o.error) continue; n = o.state; moved = true; break; }
    if(!moved) break;
  }
  return n;
}

test("the reader: Iris's grant reads its class, its number and its go again; Cosmo's is unchanged", {skip}, () => {
  assert.ok(IRIS && IRIS.resolved, "fixture: Iris did not resolve");
  const g = P.auraWeaponGrant(IRIS);
  assert.deepEqual([g.cost, g.oncePerTurn, g.cls, g.basePow, g.ga, g.gaWithCounters], [3, true, "illusionist", 4, true, false]);
  const cos = P.auraWeaponGrant({tx: require("../data/pool.js").find(r => /^Cosmo/.test(r.name)).functional_text});
  assert.deepEqual([cos.cost, cos.cls, cos.basePow, cos.ga, cos.gaWithCounters], [1, null, null, false, true]);
  /* a subject and a power that do not travel together refuse */
  assert.equal(P.auraWeaponGrant({tx: 'Illusionist auras you control are weapons with base {p} equal to their ward and "Action - {r}: Attack"'}), null);
  P.fxReset();
  assert.equal(P.fxParse({...IRIS, name: "Drill Iris"}).tier, "full");
});

test("DRIVEN: a Spectral Shield swings for 4 at {r}{r}{r} and goes again", {skip}, () => {
  const t = table();
  const A = {t: "activate", uid: t.uid};
  assert.equal(J.legal(t.g, A, 0), null, "the table refused the Shield's swing");
  /* the AI's reader agrees (it reads no card text, only this) */
  assert.equal(J.keepsActionPoint(t.g, 0, t.uid, "board"), true, "keepsActionPoint missed the quoted go again");
  assert.equal(J.keepsActionPoint(table({noIris: true}).g, 0, t.uid, "board"), false, "fixture: a bare Shield keeps the point");
  const declared = J.reduce(t.g, A, 0).state;
  assert.equal(t.g.sides[0].res - declared.sides[0].res, 3, "the swing did not cost {r}{r}{r}");
  const out = passOut(declared);
  assert.equal(t.g.sides[1].hp - out.sides[1].hp, 4, "the Shield did not hit for Iris's 4, not its ward");
  assert.equal(out.sides[0].ap, t.g.sides[0].ap, "the quoted go again did not keep the action point");
  assert.ok(J.legal(out, A, 0), "the once-per-turn swing was offered twice");
});

test("not without Iris; not an aura of another class; not an Illusionist that is not an aura; not on their turn", {skip}, () => {
  const none = table({noIris: true});
  assert.ok(J.legal(none.g, {t: "activate", uid: none.uid}, 0), "the Shield swung with no grant equipped");
  const t = table();
  const sd = t.g.sides[0];
  const shield = sd.board.find(e => e.uid === t.uid).card;
  assert.ok(P.auraAttackOf(shield, sd, {yourTurn: true}), "fixture: the Shield is not a weapon");
  assert.equal(P.auraAttackOf({...shield, ty: ["Generic", "Token", "Aura"]}, sd, {yourTurn: true}), null,
    "a non-Illusionist aura was made a weapon");
  assert.equal(P.auraAttackOf({...shield, ty: ["Illusionist", "Ally"]}, sd, {yourTurn: true}), null,
    "an Illusionist that is not an aura was made a weapon");
  assert.equal(P.auraAttackOf(shield, sd, {yourTurn: false}), null, "the grant answered on the opponent's turn");
});
