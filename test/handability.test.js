/* ============================================================
   AN ACTIVATED ABILITY ON A CARD IN HAND.

   "Instant - Discard this: Amp 1". FOUR pool cards across THREE heroes
   print one — Agile Windup (Kayo), Arcane Twining and Photon Splicing
   (Iyslander), Reaper's Call (Arakni) — so it is a rule with a list
   rather than one hero's card. The route was built in `Battle` (v2.63)
   and lived there, so none of the four could be activated at the table.

   AND A FIFTH CARD IS AN IMPOSTOR. `parseHandAbility` matches up to the
   first period, so Rally the Coast Guard's printed "Activate this only
   while this card is defending" is TRUNCATED AWAY from `handAbility` —
   it survives only on `fx.activateIf`. A route built off `handAbility`
   alone would let it buff defence from hand at any time, which is the
   sev-3 direction. The gate is asked, and it is asked WHOLE: the
   trainer's original tested `activateIf.kind === "defending"` and nothing
   else, so any other printed restriction slipped through.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;
const { loadData } = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const W = loadData();
const card = (nm, p) => C.resolveEntry(H.db(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});

function table(hand, o){
  o = o || {};
  let g = H.state({name: "You", res: 9, ap: 3, hand, deck: [{uid: "d1", name: "F"}],
                   blockH: o.blockH},
                  {name: "Them", deck: [{uid: "d2", name: "F2"}]},
                  {actor: 0, turnPlayer: 0, seed: "hand"});
  return {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
}

/* ---- THE CENSUS -------------------------------------------------------- */

test("exactly five pool cards print a hand ability, and nothing is named", {skip}, () => {
  const db = H.db(), hits = [];
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(db, e);
      P.fxReset();
      if(c.resolved && P.fxParse(c).handAbility) hits.push(c.name);
    }
  }
  P.fxReset();
  const uniq = [...new Set(hits)].sort();
  assert.deepEqual(uniq,
    ["Agile Windup", "Arcane Twining", "Photon Splicing", "Rally the Coast Guard", "Reaper's Call"],
    "the reader claims exactly the cards that print one — three of them nothing to do with Kayo, " +
    "which is the golden rule working rather than a coincidence");
});

/* ---- THE ROUTE, AT THE TABLE ------------------------------------------- */

test("a hand ability resolves at the table, and the card pays for itself", {skip}, () => {
  const at = {...card("Arcane Twining", 3), uid: "h1"};
  const g = table([at, {uid: "x1", name: "Spare", pitch: 1, def: 2}]);
  assert.equal(J.legal(g, {t: "activate", uid: "h1", from: "hand"}, 0), null,
    "refused: " + J.legal(g, {t: "activate", uid: "h1", from: "hand"}, 0));

  const r = J.reduce(g, {t: "activate", uid: "h1", from: "hand"}, 0);
  assert.equal(r.error, null);
  const n = r.state;
  assert.deepEqual(n.sides[0].hand.map(c => c.uid), ["x1"], "the card left hand — the cost is real");
  assert.equal(n.sides[0].grave[0].uid, "h1");
  assert.equal(n.sides[0].grave[0]._disc, true,
    "stamped a DISCARD, so everything watching one sees it — Kayo's clause 3 among them");
  assert.equal(n.sides[0].amp, 1, "and the ability actually resolved");
  /* CR 8.1.6 — an instant costs no action point. Collecting the effect
     AND the point back is the direction that steals games. */
  assert.equal(n.sides[0].ap, 3, "an instant costs no action point");
  assert.deepEqual(INV.errors(n), []);
});

test("the discard is not random — Beaten Trackers must not fire on it", {skip}, () => {
  const at = {...card("Photon Splicing", 3), uid: "h2"};
  const n = J.reduce(table([at]), {t: "activate", uid: "h2", from: "hand"}, 0).state;
  assert.equal(n.sides[0].grave[0]._disc, true);
  /* `afterDiscard(..., {random:false})`. A chosen discard is not a random
     one, and Beaten Trackers pays only for random. */
  assert.ok(!n.sides[0].grave[0]._rand, "a chosen discard must not read as a random one");
});

/* ---- THE IMPOSTOR ------------------------------------------------------ */

test("Rally the Coast Guard cannot be activated from hand while it is not defending", {skip}, () => {
  const rally = {...card("Rally the Coast Guard", 3), uid: "r1"};
  /* the truncation that makes this drill necessary */
  const fx = P.fxParse(rally);
  assert.ok(fx.handAbility, "it does print a hand ability");
  assert.equal(fx.handAbility.eff, "This gets +3{d}",
    "and `parseHandAbility` stops at the first period — the restriction is NOT in here");
  assert.equal(fx.activateIf.kind, "defending",
    "it survives on activateIf, which is why the route must ask it");

  const g = table([rally, {uid: "x1", name: "Spare", pitch: 1}]);
  assert.equal(E.handAbilityOK({...g, actor: 0}, rally), false, "not defending — not available");
  assert.match(String(J.legal(g, {t: "activate", uid: "r1", from: "hand"}, 0)),
    /can't be activated — this card isn't defending/,
    "and the refusal names the PRINTED reason, not a board limitation");

  /* THE POSITIVE HALF, or this passes on a route that refuses it always. */
  const def = table([rally, {uid: "x1", name: "Spare", pitch: 1}], {blockH: ["r1"]});
  assert.equal(E.handAbilityOK({...def, actor: 0}, rally), true,
    "declared as a defender, the printed condition is met");
});

test("the whole gate is asked, not just the `defending` case", {skip}, () => {
  /* The trainer's original tested only `activateIf.kind === "defending"`.
     Any other printed restriction — including v3.04's `unreadable`, which
     exists precisely so an unread condition REFUSES — went straight
     through. Driven with a synthetic card so it is the RULE under test. */
  const fake = {name: "Drill Gate Card", pitch: 3, tt: "Generic Action", kw: [], uid: "g1",
                tx: "Instant - Discard this: Amp 1. Activate this only if you control a Lightning attack."};
  P.fxReset();
  const fx = P.fxParse(fake);
  assert.ok(fx.handAbility, "it prints a hand ability");
  assert.equal(fx.activateIf.kind, "unreadable", "and a restriction the parser cannot read");
  const g = table([fake]);
  assert.equal(E.handAbilityOK({...g, actor: 0}, fake), false,
    "an unread restriction must refuse — waving it through is the ability escaping its own limit");
  P.fxReset();
});

/* ---- THE RECORDED REFUSAL CAME DUE (v4.53) -----------------------------
   This drill asserted, for four dozen versions, that judge REFUSED Rally
   the Coast Guard by name — "`runOps` cannot raise ONE defender; the
   trainer keeps a `defBonus` map and this board does not." That reason
   went false at v3.89, when `applyDefMod` became the one per-defender map
   and `defendValue` began reading it on BOTH boards, and nobody went back.
   A recorded refusal is a DEBT (v3.38) and this drill is what made paying
   it a deliberate edit rather than a silent widening.

   IT IS THE POSITIVE NOW, AND IT DRIVES. Asserting the refusal is gone
   proves nothing on its own — a `legal` that answers null for everything
   passes that perfectly — so the buff is followed all the way onto the
   card and then off the wall's own total. */

test("Rally the Coast Guard raises the wall AT THE TABLE", {skip}, () => {
  const rally = {...card("Rally the Coast Guard", 3), uid: "r1"};
  const def = table([rally, {uid: "x1", name: "Spare", pitch: 1}], {blockH: ["r1"]});
  assert.equal(J.legal(def, {t: "activate", uid: "r1", from: "hand"}, 0), null,
    "the +{d} refusal is gone: `applyDefMod` IS the per-defender map this board was said to lack");

  const printed = E.defendValue(def.sides[0], rally, {});
  const out = J.reduce(def, {t: "activate", uid: "r1", from: "hand"}, 0).state;
  const still = out.sides[0].hand.find(c => c.uid === "r1") || rally;
  assert.equal(E.defendValue(out.sides[0], still, {}) - printed, 3,
    "and the number LANDS — a `defMod` entry on the card, counted by the one reader both walls use");

  /* THE ENTRY NAMES THE CARD, not the seat. A `defMod` keyed to anything
     but this uid raises whatever else happens to be in the wall (v3.89). */
  const ent = (out.sides[0].defMod || []).filter(e => e.uid === "r1");
  assert.equal(ent.length, 1, "exactly one entry, on the card that braced");
  assert.equal(ent[0].d, 3, "signed and read off the printed line");
  /* AND IT IS CHAIN-SCOPED, which is the window the card prints: nothing
     says "this turn", so the default applies and `closeChainGrants` takes
     it (v3.94's `until` split). */
  assert.equal(ent[0].until, undefined, "no window on the entry means the chain — what the card prints");
});

test("a second defender is NOT raised by Rally's brace", {skip}, () => {
  const rally = {...card("Rally the Coast Guard", 3), uid: "r1"};
  const mate  = {...card("Rally the Coast Guard", 3), uid: "r2"};
  const def = table([rally, mate, {uid: "x1", name: "Spare", pitch: 1}], {blockH: ["r1", "r2"]});
  const out = J.reduce(def, {t: "activate", uid: "r1", from: "hand"}, 0).state;
  const before = E.defendValue(def.sides[0], mate, {});
  assert.equal(E.defendValue(out.sides[0], mate, {}), before,
    "the entry is keyed by UID — a second copy of the same card keeps its printed value");
});

/* ---- ONE COPY ---------------------------------------------------------- */

test("the trainer delegates rather than keeping a second copy", () => {
  const fs = require("fs"), path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /DawnEffects\.handAbilityOK\(s, c\)/,
    "the question is the shared one");
  assert.match(html, /_EFX\.activateHandAbility\(s, c\)/,
    "and so is the payment and the ops");
  /* AND SO IS THE DEFENCE BUFF, AS OF v4.53. It used to be this board's
     own: `activateHandAbility` returned the number and this file wrote it
     into a per-uid `defBonus` map that only `finishBlock` read — a SECOND
     record of the fact `applyDefMod` has held since v3.89. The scan is
     for its ABSENCE, because what makes a mirror a mirror is the copy
     existing at all. */
  assert.ok(!/\bdefBonus\b/.test(html.replace(/\/\*[\s\S]*?\*\//g, "")),
    "no second per-defender map survives in the trainer — `defMod` is the one map, on both boards");
  assert.ok(!/r\.dbuff/.test(html),
    "and nothing routes a returned buff: the shared body lands it");
  for(const nm of ["Agile Windup", "Rally the Coast Guard", "Arcane Twining"])
    assert.ok(!new RegExp('"' + nm + '"').test(html), nm + " must not be special-cased by name");
});
