/* ============================================================
   RELOAD PUT THE CARD FACE **UP**, AND AZALEA'S WHOLE ARROW PACKAGE
   TRIGGERS ON FACE UP.

   The printed reminder text — read off the 1HP237 printing of Take Aim,
   because the database carries none for any keyword:

     Reload (If you have no cards in your arsenal, you may put a card from
     your hand FACE DOWN into your arsenal.)

   `applyAnswer` treated EVERY `to:"arsenal"` pick as a face-UP put. That
   is right for the three cards v2.33/v2.34 built — Call in the Big Guns,
   Bull's Eye Bracers and Death Dealer all print "face up", and the
   trigger that fires when they do is their whole mechanism — and wrong
   for reload, which prints the opposite.

   IT IS LIVE. Azalea's deck holds Take Aim beside four arrows with
   face-up triggers:

     Swift Shot      go again          Dry Powder Shot   +2{p}
     Entangling Shot taps their hero   Ridge Rider Shot  opt 1

   So reloading Swift Shot handed her a free ACTION POINT and reloading
   Entangling Shot tapped the opposing hero, off a card that grants
   neither. And the prompt's own title said "face-down" while the code set
   `_faceUp: true` — the feed and the state disagreeing, which is the sev-2
   category the player TRUSTS.

   NO TOOL COULD SEE IT. Coverage reads Take Aim `full` — the clause IS
   read and the op DOES run; the fairness sweep models no arsenal face;
   and `tools/ledger.js` still called reload `pending`, so `failstates.js`
   was grading a keyword that had been fully built for versions.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (uid, o) => Object.assign({uid, name: "Card " + uid, tt: "Generic Action",
  pitch: 1, cost: 0, power: 0, def: 2, tx: "", kw: []}, o || {});

function reload(hand, arsenal){
  const g = H.state({hand, arsenal: arsenal || null, res: 9}, {}, {actor: 0, turn: 3});
  let n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reload"]], "Take Aim"));
  n = J.openPrompt(n);
  return n;
}

test("Reload is offered only with an EMPTY arsenal, and it is optional", () => {
  const open = reload([card(1), card(2)]);
  assert.ok(open.prompt, "an empty arsenal offers the choice");
  assert.equal(open.prompt.min, 0, "'you may' — declining must be legal");
  assert.equal(open.prompt.zone, "hand");
  assert.equal(open.prompt.to, "arsenal");

  /* `arsEmpty`, NOT `arsFree` (v2.34). They coincide at capacity 1, which
     is exactly why the wrong one stays invisible — the printed word is
     "no cards in your arsenal". */
  const shut = reload([card(1)], card(9));
  assert.ok(!shut.prompt, "a full arsenal offers nothing");
});

test("THE CARD LANDS FACE DOWN — the printed word, and a different event", () => {
  let n = reload([card(1), card(2)]);
  n = J.reduce(n, {t: "promptSel", i: 0}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.equal(n.sides[0].arsenal.uid, 1, "the chosen card is set");
  assert.notEqual(n.sides[0].arsenal._faceUp, true,
    "reload prints FACE DOWN — face up is the event Azalea's arrows trigger on");
  assert.deepEqual(n.sides[0].hand.map(c => c.uid), [2], "…and it leaves the hand");
});

test("DRIVEN: reloading a face-up-trigger arrow grants NOTHING", {skip}, () => {
  /* The bug, stated as the card it steals from. Swift Shot's arsenal
     trigger is `go again` — an ACTION POINT (CR 5.3.5), which is what to
     assert on rather than a feed line (v3.58). */
  H.db();
  const arrow = H.card("Swift Shot", 1);
  assert.deepEqual(P.fxParse(arrow).arsenalUp, [["ga"]],
    "the fixture must actually print a face-up trigger, or this proves nothing");
  const g = H.state({hand: [{...arrow, uid: 50}], arsenal: null, res: 9, ap: 1},
                    {}, {actor: 0, turn: 3});
  let n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reload"]], "Take Aim"));
  n = J.openPrompt(n);
  n = J.reduce(n, {t: "promptSel", i: 0}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.notEqual(n.sides[0].arsenal._faceUp, true);
  assert.equal(n.sides[0].arsenal._arsGA, undefined,
    "the face-up go again must NOT be stamped onto a card reloaded face down");
  assert.equal(n.sides[0].ap, 1, "…and no action point is gained");
});

test("…while the cards that PRINT face up still get it", {skip}, () => {
  /* The control, and it is the half that matters most: the three cards
     v2.33/v2.34 built exist FOR this trigger. A fix that turned every
     arsenal put face down would silently delete Azalea's whole package,
     which is the opposite error and just as wrong. */
  H.db();
  const arrow = H.card("Swift Shot", 1);
  const g = H.state({hand: [{...arrow, uid: 51}], arsenal: null, res: 9, ap: 1},
                    {}, {actor: 0, turn: 3});
  let n = {...g, promptQ: [{tag: "pick", side: 0, src: "Call in the Big Guns",
    zone: "hand", to: "arsenal", min: 0, max: 1, faceUp: true,
    title: "Put an arrow face up in your arsenal?"}]};
  n = J.openPrompt(n);
  n = J.reduce(n, {t: "promptSel", i: 0}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.equal(n.sides[0].arsenal._faceUp, true, "a printed face-up put still goes up");
  assert.equal(n.sides[0].arsenal._arsGA, true, "…and its trigger still fires");
});

test("`buildPrompt` carries the face — a spec only carries fields it knows", () => {
  /* v2.34's `arsStamp` rule, and this is the fourth field to prove it.
     Dropped here, EVERY arsenal put arrives face down, including the three
     whose whole mechanism is the trigger that fires when they do not. */
  const g = {sides: [{hand: [card(1)], arsenal: null}, {}], turn: 3};
  const mk = extra => PM.buildPrompt(g, Object.assign(
    {tag: "pick", side: 0, src: "s", zone: "hand", to: "arsenal", min: 0, max: 1}, extra));
  assert.equal((mk({faceUp: true}) || {}).faceUp, true);
  assert.equal((mk({}) || {}).faceUp, false, "absent means the printed default: face down");
});

test("the LEDGER says what is built — reload was `pending` and had been live", () => {
  /* `tools/ledger.js` is not prose (v3.48): `failstates.js` grades a
     keyword's severity against its STATUS rather than a grep, so a stale
     `pending` is load-bearing. Reload's parser rule, its op, its
     `arsEmpty` gate and its prompt all existed; only the record was
     wrong, which is the reverse of the usual failure and just as costly. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "tools", "ledger.js"), "utf8");
  const m = src.match(/"reload":\s*\{status:\s*"([a-z]+)"/);
  assert.ok(m, "reload must have a ledger entry");
  assert.equal(m[1], "live", "the record must match what the engine actually does");
});
