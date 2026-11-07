/* ============================================================
   A PLAYED CARD WHOSE ONLY EFFECT IS A PRINTED TARGET NEEDS ONE (v5.07)

     "Put three +1{p} counters on target aura with ward you control."
                                                  — ASTRAL ETCHINGS, Enigma's
     "Put target attack action card with cost 2 or less from your graveyard
      on top of your deck."                       — MEMORIAL GROUND

   Both were playable into nothing — paid for, and the feed said nothing
   could be found. `effects.playTargetWhy` asks each targeted op the reader
   its own resolution uses, and refuses when that op is the card's WHOLE
   payload: the paid no-op v4.49 and v5.00 refuse, which needs no ruling on
   targeting.

   v6.00 TURNED THE OTHER HALF ROUND: a card that prints something BESIDE
   its target is refused too — a target is required (RULING user
   2026-11-07, CR 5.1.4a/5.1.5). Those drills, the family census and the
   Mystic instants are in test/targetreq.test.js.

   AND BRAVO'S ABILITY, which `arsNoOpWhy` (v5.00) did not cover: "turn a
   face-down card in your arsenal face-up" on an empty or face-up arsenal
   paid {r}{r} and the hero's tap for nothing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const B = require("../engine/build");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

function at(hand, o){
  return {...H.state(Object.assign({hand, res: 9, ap: 1, name: "Me"}, o || {}), {hp: 20, name: "Them"},
                     {turn: 3, actor: 0, turnPlayer: 0}),
    phase: "action", step: "layer", priority: 0, passed: [false, false], stack: [], chain: [], chainCards: []};
}
const why = (g, uid) => J.legal(g, {t: "play", uid, from: "hand"}, 0);

test("ASTRAL ETCHINGS: refused with no aura with ward, and legal with one", {skip}, () => {
  H.db();
  const ae = {...H.card("Astral Etchings", 1), uid: "AE"};
  assert.match(String(why(at([ae]), "AE")), /^Astral Etchings: you control nothing it can target$/);
  /* the near-miss: an aura with NO ward is not a target either */
  const plain = H.card("Malefic Incantation", 1);
  assert.ok(plain && /aura/i.test(plain.tt || "") && !P.wardValue(plain), "fixture: an aura printing no ward");
  assert.match(String(why(at([ae], {board: [{uid: "mi", card: {...plain, uid: "mi"}, kind: "aura"}]}), "AE")),
    /nothing it can target/, "the printed 'with ward' is read");
  const shield = H.card("Spectral Shield", 0);
  assert.ok(shield && shield.name, "fixture: the Spectral Shield token is in the pool");
  assert.equal(why(at([ae], {board: [{uid: "sh", card: {...shield, uid: "sh"}, kind: "aura"}]}), "AE"), null,
    "a Spectral Shield (Ward 1) is a legal target");
});

test("MEMORIAL GROUND: refused on an empty graveyard, and on one with no qualifying card", {skip}, () => {
  H.db();
  const mg = {...H.card("Memorial Ground", 1), uid: "MG"};
  assert.match(String(why(at([mg]), "MG")), /^Memorial Ground: nothing in your graveyard can be its target$/);
  const big = {...H.card("Raging Onslaught", 1), uid: "g1"};
  assert.ok(big.cost > 2, "fixture: a cost-3 attack is not 'cost 2 or less'");
  assert.match(String(why(at([mg], {grave: [big]}), "MG")), /can be its target/, "the printed limit is read");
  const small = {...H.card("Wounding Blow", 1), uid: "g2"};
  assert.equal(why(at([mg], {grave: [big, small]}), "MG"), null, "a qualifying card is a target");
});

test("THE TRAINER'S INSTANT DOOR refuses the same play, before the payment", {skip}, () => {
  H.db();
  const mg = {...H.card("Memorial Ground", 1), uid: "MG"};
  const r = J.withEffects(at([mg]), (fx, n) => fx.playAtSpeed(n, mg, "hand", {window: "instant"}));
  assert.match(String(r.why), /can be its target/);
  assert.ok(r.game.sides[0].hand.some(c => c.uid === "MG"), "nothing moved");
});

test("THE READER ignores attacks — their targeted text is a trigger's", {skip}, () => {
  H.db();
  const bb = {...H.card("Buckling Blow", 1), uid: "BB"};
  assert.ok(P.isAttack(bb), "fixture: Buckling Blow is an attack");
  assert.equal(E.playTargetWhy(at([bb]), bb, 0), null);
});

test("BRAVO: the ability is refused on an empty or face-up arsenal, and legal with a face-down card", {skip}, () => {
  const db = H.db();
  const rec = require("./helpers/extract").readCards(path.join(__dirname, "..", "data", "pool.js"))
    .find(x => /^Bravo, Flattering/.test(x.name));
  const ab = B.heroAbilities({name: rec.name, tx: rec.functional_text, ty: rec.types}, rec.name, "").HPOW;
  assert.deepEqual(P.fxParse(ab).ops.map(o => o[0]), ["arsTurn"], "fixture: the turn is the whole payload");
  assert.match(String(E.arsNoOpWhy({name: "Bravo", arsenal: null}, ab)), /no face-down card to turn/);
  assert.match(String(E.arsNoOpWhy({name: "Bravo", arsenal: {uid: 1, name: "X", _faceUp: true}}, ab)), /no face-down card to turn/);
  assert.equal(E.arsNoOpWhy({name: "Bravo", arsenal: {uid: 1, name: "X"}}, ab), null);
});

/* ---- "ON AN AURA" IS NOT "ON TARGET AURA" (v5.22) -------------------
   QUEUE N6. `playTargetWhy` refused every whole-payload `ctrPut` with no
   candidate, and the trainer's `tryPlay` asks it for powCards too — so
   Uphold Tradition's flip ("Put a +1{p} counter on AN aura you control
   with ward") was refused there with no ward aura, while the table and the
   trainer's own opponent's-turn door allowed it. The flip turns its Ward 1
   on (ruling 2026-10-04), so the activation is not a paid no-op. The flag
   is the printed word "target". */
test("N6: Uphold Tradition's untargeted put is not refused with no aura", {skip}, () => {
  H.db();
  const pc = B.equipPiece({...H.card("Uphold Tradition"), uid: 7}).powCard;
  assert.ok(pc && /on an aura/i.test(pc.tx), "the fixture is the real ability line");
  assert.equal(E.playTargetWhy(at([]), pc, 0), null, "nothing is targeted, so nothing is missing");
});
test("N6: the `target` flag is the printed word — the pool's ctrPut emitters, both ways", {skip}, () => {
  const db = H.db();
  const C = require("../engine/cards.js");
  const tgt = new Set(), untgt = new Set();
  const walk = (o, name) => {
    if(Array.isArray(o)){
      if(o[0] === "ctrPut" && o[1] && typeof o[1] === "object") (o[1].target ? tgt : untgt).add(name);
      o.forEach(x => walk(x, name));
    } else if(o && typeof o === "object") Object.values(o).forEach(x => walk(x, name));
  };
  for(const r of require("../data/pool.js")){
    const m = C.mapDbCard(r), c = C.resolveEntry(db, {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(c) walk(P.fxParse(c), c.name);
  }
  assert.deepEqual([...tgt].sort(), ["Astral Etchings", "Edict of Steel"]);
  assert.deepEqual([...untgt].sort(), ["Big Bertha", "Crankshaft", "Glisten", "Re-Charge!"]);
});
test("N6: a SYNTHETIC whole-payload untargeted put is not refused; its targeted twin is", () => {
  /* the near-miss no pool card prints: the same sentence with and without
     the word, so only the flag separates them (v3.73) */
  P.fxReset();
  const mk = (nm, tx) => ({uid: 9, name: nm, tt: "Generic Action", ty: ["Generic", "Action"],
    pitch: 1, cost: 0, power: null, def: 2, tx, kw: []});
  const un = mk("Ctr Untargeted Probe", "Put a +1{p} counter on an aura you control with ward.");
  const tg = mk("Ctr Targeted Probe", "Put a +1{p} counter on target aura you control with ward.");
  assert.equal(E.playTargetWhy(at([un]), un, 0), null);
  assert.match(E.playTargetWhy(at([tg]), tg, 0) || "", /nothing it can target/);
});
