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

   A card that prints something BESIDE its target keeps resolving the rest
   (`played-target-partial-resolution`, stated) — whether the CR refuses it
   is not sourced here, and the two readings part exactly on Re-Charge!'s
   +4{p}, Edict of Steel's go again and the Mystic instants' transcend.

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

test("THE STATED HALF: a card printing something beside its target still resolves the rest", {skip}, () => {
  /* `played-target-partial-resolution` — and this is the drill a ruling would
     turn round. Each fixture is a REAL card with nothing to target. */
  H.db();
  for(const [nm, p] of [["Edict of Steel", 1], ["Re-Charge!", 1], ["Pass Over", 1], ["Preserve Tradition", 1], ["A Drop in the Ocean", 3]]){
    const c = {...H.card(nm, p), uid: "PX"};
    assert.ok(c && c.name, nm + " is not in the pool");
    assert.equal(why(at([c]), "PX"), null, nm + " prints more than its target, so it stays playable");
  }
});

test("THE READER ignores attacks — their targeted text is a trigger's", {skip}, () => {
  H.db();
  const bb = {...H.card("Buckling Blow", 1), uid: "BB"};
  assert.ok(P.isAttack(bb), "fixture: Buckling Blow is an attack");
  assert.equal(E.playTargetWhy(at([bb]), bb, 0), null);
});

test("BRAVO: the ability is refused on an empty or face-up arsenal, and legal with a face-down card", {skip}, () => {
  const db = H.db();
  const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"))
    .find(x => /^Bravo, Flattering/.test(x.name));
  const ab = B.heroAbilities({name: rec.name, tx: rec.functional_text, ty: rec.types}, rec.name, "").HPOW;
  assert.deepEqual(P.fxParse(ab).ops.map(o => o[0]), ["arsTurn"], "fixture: the turn is the whole payload");
  assert.match(String(E.arsNoOpWhy({name: "Bravo", arsenal: null}, ab)), /no face-down card to turn/);
  assert.match(String(E.arsNoOpWhy({name: "Bravo", arsenal: {uid: 1, name: "X", _faceUp: true}}, ab)), /no face-down card to turn/);
  assert.equal(E.arsNoOpWhy({name: "Bravo", arsenal: {uid: 1, name: "X"}}, ab), null);
});

test("THE FAMILY, pinned both ways: which played cards refuse and which resolve the rest", {skip}, () => {
  /* Every pool record that is a played non-attack with a targeted op, asked
     against an EMPTY state. A third whole-payload card arriving is a
     decision, not a default. */
  const db = H.db();
  const C = require("../engine/cards.js");
  const refused = new Set(), seen = new Set();
  for(const r of require("../data/pool.json")){
    const m = C.mapDbCard(r), c = C.resolveEntry(db, {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(!c || seen.has(c.name)) continue; seen.add(c.name);
    c.uid = "Z";
    const w = E.playTargetWhy(at([c]), c, 0);
    if(w && !/targets an attack you control/.test(w)) refused.add(c.name);
  }
  assert.deepEqual([...refused].sort(), ["Astral Etchings", "Memorial Ground"]);
});

test("PREMISE: every targeted foePick or 'target attack' payload prints something beside it", {skip}, () => {
  /* Why `playTargetWhy` carries no branch for either (v4.11): measured, both
     claimants also print a transcend. The day a card arrives whose WHOLE
     payload is one of these, this fails and the branch is built then. */
  const db = H.db();
  const C = require("../engine/cards.js");
  const bare = [], claim = new Set(), seen = new Set();
  for(const r of require("../data/pool.json")){
    const m = C.mapDbCard(r), c = C.resolveEntry(db, {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(!c || seen.has(c.name) || P.isAttack(c) || P.isDR(c)) continue; seen.add(c.name);
    const fx = P.fxParse(c), ops = (fx.ops || []).filter(o => o[0] !== "noop");
    const tgt = ops.filter(o => o[0] === "foePick" || (o[0] === "atkMinus" && /\btarget attack\b/i.test(c.tx || "")));
    if(tgt.length) claim.add(c.name);
    if(tgt.length && ops.length === tgt.length && !(fx.conds || []).length && !fx.ga) bare.push(c.name);
  }
  assert.deepEqual([...claim].sort(), ["A Drop in the Ocean", "Pass Over"], "the scan is alive and its claimants are pinned");
  assert.deepEqual(bare, []);
});
