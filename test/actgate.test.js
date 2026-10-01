/* ============================================================
   EVERY ACTIVATION GATE IS ANSWERED (v4.89)

   > "Action - Destroy this: Your next attack this turn gets go again.
   >  Activate this only if you've played a Nimblism this turn."
   >                                         — QUICK CLICKS, Azalea's and Briar's

   The parser has read that gate as `playedNamed` since the card was dealt,
   and `test/condcensus.test.js` pinned it as EMITTED. Nothing ANSWERED it:
   `activateIfOk` had no branch and fell through to `return true`, so
   Quick Clicks (go again, an action point) and Swiftstrike Bracers (+2{p})
   were activatable with no Nimblism played, on both boards. Stronger than
   printed, and every coverage tool called it read.

   - `hist.playNames` is the record, the non-attack twin of `atkNames`;
   - the fallthrough REFUSES, and the census asks both directions;
   - Stand Strong's "if you control an aura of suspense" reads, through the
     reader Full of Bravado's condition asks (`controlsAuraOf`);
   - judge's weapon swing asks its gate, which the trainer always did.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const S = require("../engine/sides");
const J = require("../engine/judge");
const B = require("../engine/build");
const H = require("./helpers/judged.js");

/* a piece as the DEAL makes it — `equipPiece` builds its powCard, which
   is what an activation resolves (v4.15: one body, every route) */
const piece = (name, uid) => { const g = {...H.card(name), uid}; B.equipPiece(g); return g; };

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* a judge-shaped game in seat 0's action phase, priority held */
function acting(side){
  return Object.assign(H.state(Object.assign({res: 9, ap: 1, hand: []}, side), {hp: 20, hand: []},
                               {turn: 3, actor: 0}),
    {phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null});
}

test("Quick Clicks and Swiftstrike Bracers wait for a Nimblism", {skip}, () => {
  H.db();
  const qc = piece("Quick Clicks", 501);
  const sw = piece("Swiftstrike Bracers", 502);
  const g = acting({gear: [qc, sw]});
  for(const [p, uid] of [[qc, 501], [sw, 502]])
    assert.match(String(J.legal(g, {t: "activate", uid}, 0)),
      /can't be activated — you haven't played a Nimblism this turn/,
      p.name + " activates with no Nimblism played — the gate fell through");

  /* PLAY ONE, THEN BOTH OPEN — the positive half, or a gate that refuses
     everything passes the first */
  const nim = {...H.card("Nimblism", 1), uid: 601};
  const h = acting({gear: [qc, sw], hand: [nim]});
  const o = J.reduce(h, {t: "play", uid: 601, from: "hand"}, 0);
  assert.ok(!o.error, o.error);
  const after = H.drain(o.state);
  assert.deepEqual(after.sides[0].hist.playNames, ["nimblism"], "the play was recorded by NAME");
  assert.equal(J.legal(after, {t: "activate", uid: 501}, 0), null, "Quick Clicks opens after a Nimblism");
  assert.equal(J.legal(after, {t: "activate", uid: 502}, 0), null, "and so do the Bracers");
  /* AND ACTIVATING ONE IS NOT A PLAY. Driven, because the source pin
     below cannot say what the record holds afterwards. */
  const used = J.reduce(after, {t: "activate", uid: 501}, 0);
  assert.ok(!used.error, used.error);
  assert.deepEqual(H.drain(used.state).sides[0].hist.playNames, ["nimblism"],
    "an activated ability was recorded as a card PLAYED");
});

test("the record is a NAME, it counts PLAYS, and an activation is not one", {skip}, () => {
  H.db();
  /* a different card does not answer "a Nimblism" */
  const other = {...H.card("Raging Onslaught", 1), uid: 602};
  const qc = piece("Quick Clicks", 501);
  let g = acting({gear: [qc], hand: [other]});
  g = H.drain(J.reduce(g, {t: "play", uid: 602, from: "hand"}, 0).state);
  assert.deepEqual(g.sides[0].hist.playNames, ["raging onslaught"]);
  /* (an attack's declaration leaves the seat in the combat chain; ask the
     reader directly, which is what both boards ask) */
  assert.equal(E.activateIfOk(g, P.fxParse(qc).activateIf, qc), false,
    "a card that is not a Nimblism opened the gate");

  /* an ACTIVATION is not a play: `isActivation` keeps powCards, weapons
     and board attacks out of the record */
  assert.equal(P.isActivation({name: "Quick Clicks — ability", tt: "Equipment Ability", ty: []}), true);
  assert.equal(P.isActivation(H.card("Nimblism", 1)), false);
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /if\(!P\.isActivation\(card, from\)\)\s*actMut\(n\)\.hist = \{\.\.\.act\(n\)\.hist, playNames:/,
    "the record must skip activations, or an ability counts as the card it names");
  /* and the turn boundary empties it (CR 4.4.4), which is "this turn" */
  assert.deepEqual(S.freshHist().playNames, []);
});

test("Stand Strong reads its aura of suspense — the reader Full of Bravado asks", {skip}, () => {
  H.db();
  const ss = piece("Stand Strong", 503);
  assert.deepEqual(P.fxParse(ss).activateIf.kind, "auraOf");
  const none = acting({gear: [ss]});
  assert.match(String(J.legal(none, {t: "activate", uid: 503}, 0)), /you control no aura of suspense/);

  const act = {...H.card("Act of Glory", 1), uid: 701};
  assert.ok(P.printedKw(act, "suspense"), "premise: Act of Glory carries suspense");
  const withAura = acting({gear: [ss], board: [{uid: 701, kind: "aura", card: act}]});
  assert.equal(J.legal(withAura, {t: "activate", uid: 503}, 0), null, "an aura of suspense opens it");

  /* an aura WITHOUT the keyword does not — the near-miss that tells the
     reader from "any aura" */
  const plain = {uid: 702, name: "Plain Aura", tt: "Generic Aura", ty: ["Generic", "Aura"],
                 tx: "", kw: [], pitch: 1};
  const wrong = acting({gear: [ss], board: [{uid: 702, kind: "aura", card: plain}]});
  assert.match(String(J.legal(wrong, {t: "activate", uid: 503}, 0)), /no aura of suspense/);

  /* ONE READER: the condition Full of Bravado prints asks the same one */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.match(src, /cond==="suspenseAura" \? controlsAuraOf\(act\(n\), "suspense"\)/,
    "the two printed spellings of one question have two readers again");
});

test("a CARD that merely mentions suspense is not an aura of it", {skip}, () => {
  H.db();
  /* `printedKw`, not `hasKw` (v2.84): an aura that NAMES suspense in a
     sentence does not carry it. No pool aura tells them apart (measured),
     so the near-miss is synthetic (v3.73). */
  const talker = {uid: 703, name: "Talking Aura", tt: "Generic Aura", ty: ["Generic", "Aura"],
                  tx: "When an aura of suspense leaves the arena, gain 1{h}.", kw: [], pitch: 1};
  assert.ok(P.hasKw(talker, "suspense") && !P.printedKw(talker, "suspense"), "premise: the two predicates split here");
  assert.equal(E.controlsAuraOf({board: [{uid: 703, kind: "aura", card: talker}]}, "suspense"), false);
});

test("the TABLE's weapon swing asks its printed gate, as the trainer does", {skip}, () => {
  H.db();
  const sc = piece("Scorpio, Comet Tail", 504);
  const g = acting({gear: [sc]});
  assert.match(String(J.legal(g, {t: "activate", uid: 504}, 0)),
    /Scorpio, Comet Tail can't be activated — its printed activation condition isn't modelled yet/,
    "the table swings Scorpio past its gate — a rule on one board (v3.01)");
  /* the control: a swing with no gate is untouched */
  const sl = piece("Sledge of Anvilheim", 505);
  assert.equal(P.fxParse(sl).activateIf, undefined);
  assert.equal(J.legal(acting({gear: [sl]}), {t: "activate", uid: 505}, 0), null);
});
