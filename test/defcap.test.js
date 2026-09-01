/* ============================================================
   HOW MANY CARDS MAY DEFEND THIS ATTACK — one reader, both boards.

   TWO PRINTED SOURCES CAP THE WALL AND THEY COUNT DIFFERENT SETS:

     dominate      1 card FROM HAND. The database prints no reminder text
                   for any keyword, which is why tools/rulings.json exists;
                   this project's recorded reading is the hand limit, and
                   changing it is a RULING rather than an engineering call.
     Confidence    "your next attack action card this turn can't be
                   defended by more than 2 NON-BLOCK cards" — and Block is
                   a TYPE, so a declared piece of equipment counts.

   IT WAS ENFORCED ON ONE BOARD, AND BARELY. `dummyDefence` capped the
   DUMMY'S OWN PICK at `dominating ? 1 : 2` — a heuristic about how many
   cards it chooses to spend — and `judge.legal`'s defend branch mentioned
   dominate NOWHERE AT ALL. At the table any number of cards could be
   declared against a dominate attack: an illegal play allowed, in the
   direction that makes the attacker weaker than printed.

   No tool here could see it. Coverage reads Macho Grande `full` (the
   keyword IS read); the fairness sweep is one-sided toward cards STRONGER
   than printed; and `sparring.act` reads no card text by contract, so it
   cannot know about dominate and relies on `legal` to refuse — which is
   why the gap is `legal`'s and not the policy's.

   CONFIDENCE WAS INERT IN A LIVE DECK. Full of Bravado reads `tier: full`
   and sits in lyath's deck; its entire payoff is this token, and the token
   read `none`. The no-op blind spot with a token on the end.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const DOM = {name: "dom probe", tt: "Guardian Action - Attack", kw: ["Dominate"], tx: "Dominate", power: 5, def: 2};
const PLAIN = {name: "plain probe", tt: "Guardian Action - Attack", kw: [], tx: "", power: 5, def: 2};

/* ---- 1. the parser ------------------------------------------------- */

test("Confidence's payload reads, and the schedule survives it", () => {
  const r = P.classifyClause(
    "the next attack action card you play this turn can't be defended by more than 2 non-block cards");
  assert.deepEqual(r && r.ops, [["defCapNext", 2, {aac: true}, "nonBlock"]]);
  /* v3.07: "…destroy this, THEN X" must not have its schedule swallowed
     by the payload — Might parsed to the payload alone once. */
  const full = P.classifyClause("at the start of your turn, destroy this, then "
    + "the next attack action card you play this turn can't be defended by more than 2 non-block cards");
  assert.deepEqual(full && full.ops, [["selfDestruct", "turn"], ["defCapNext", 2, {aac: true}, "nonBlock"]]);
});

test("the COUNTED SET is read off the printed word, never assumed", () => {
  const nb = P.classifyClause("the next attack you play this turn can't be defended by more than 2 non-block cards");
  const hd = P.classifyClause("the next attack you play this turn can't be defended by more than 2 non-equipment cards");
  assert.equal(nb.ops[0][3], "nonBlock");
  assert.equal(hd.ops[0][3], "hand",
    "two printed sets, two answers — defaulting either to the other changes what may block");
});

test("an unreadable qualifier tail REFUSES the whole clause", () => {
  /* v3.31's rule: `attackQual` returning false means "a restriction I
     cannot read", never "nothing restricts this". */
  assert.equal(P.classifyClause(
    "the next attack with a name you like you play this turn can't be defended by more than 2 non-block cards"),
    null);
});

test("`defCap` is the ONE reader, and the TIGHTEST cap wins", () => {
  assert.deepEqual(P.defCap(DOM, null), {n: 1, count: "hand"});
  assert.deepEqual(P.defCap(PLAIN, {n: 2, count: "nonBlock"}), {n: 2, count: "nonBlock"});
  assert.deepEqual(P.defCap(DOM, {n: 2, count: "nonBlock"}), {n: 1, count: "hand"},
    "two restrictions do not cancel — the looser one would let a card through that either alone forbids");
  assert.equal(P.defCap(PLAIN, null), null);
});

test("a GRANTED dominate is the caller's answer, and absent means no", () => {
  /* Pulping prints "IF a card with 6+ {p} is discarded this way, this gets
     dominate" — `hasKwNow` correctly drops it, and `_kwGrant` is how the
     clause hands it over when the gate fires. A reader of the card alone
     cannot see that. */
  assert.equal(P.defCap(PLAIN, null, {}), null);
  assert.deepEqual(P.defCap(PLAIN, null, {kwGrant: ["dominate"]}), {n: 1, count: "hand"});
});

test("`defCounts` — which declared defenders count against which cap", () => {
  const blk = {name: "Test of Might", tt: "Guardian Block"};
  const act = {name: "Some Action", tt: "Guardian Action"};
  /* dominate counts HAND cards; equipment is declared separately */
  assert.equal(P.defCounts({n: 1, count: "hand"}, act, false), true);
  assert.equal(P.defCounts({n: 1, count: "hand"}, act, true),  false);
  /* Confidence counts NON-BLOCK cards — equipment is one */
  assert.equal(P.defCounts({n: 2, count: "nonBlock"}, act, true),  true);
  assert.equal(P.defCounts({n: 2, count: "nonBlock"}, blk, false), false,
    "a Block card is the one thing the printed word excludes");
});

/* ---- 2. the side field ledger -------------------------------------- */

test("a side field is not real until every ledger carries it", () => {
  /* v3.29's rule: SIDE_FIELDS (or invariants reports SIDES-ASYMMETRIC),
     wire.js (a dropped field is a desync), and report.js's seat(). */
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8");
  assert.ok(S.makeSide && Array.isArray(S.makeSide().defCapNext), "makeSide must declare it");
  assert.ok(/"defCapNext"/.test(rd("sides.js")),  "SIDE_FIELDS");
  assert.ok(/"defCapNext"/.test(rd("wire.js")),   "wire.js — a dropped field is a desync");
  assert.ok(/defCapNext: sd\.defCapNext/.test(rd("report.js")), "report.js seat()");
});

/* ---- 3. DRIVEN, at the table --------------------------------------- */

const wallState = (atk, hand, gear) => {
  const g = H.state({res: 9, ap: 1}, {hand: hand || [], gear: gear || []}, {turn: 3, actor: 0, turnPlayer: 0});
  return {...g, phase: "action", step: "defend", priority: 0, passed: [], attacker: 0,
          /* `targetCanBeDefended` reads a TARGET OBJECT (`{kind:"hero"}`),
             not the string — the string reads as an ally and refuses the
             whole wall, which is how the first draft of this drill got a
             refusal that had nothing to do with the cap. */
          stack: [], pend: {card: atk, by: 0, target: {kind: "hero"}, total: atk.power || 5,
                            ga: false, ops: [], onHit: [], defCap: null}};
};
const blocker = (uid, o) => Object.assign({uid, name: "Blocker " + uid, tt: "Guardian Action",
                                           pitch: 1, cost: 1, power: 2, def: 3}, o || {});

test("DRIVEN: dominate is enforced at the table — it was enforced by nothing", () => {
  const g = wallState(DOM, [blocker(1), blocker(2)]);
  assert.equal(J.legal(g, {t: "defend", uid: 1}, 1), null, "the first blocker is legal");
  const g2 = J.reduce(g, {t: "defend", uid: 1}, 1).state;
  const why = J.legal(g2, {t: "defend", uid: 2}, 1);
  assert.ok(why && /more than 1/.test(why),
    "a second card from hand against dominate is a play the rules do not allow — got: " + String(why));
});

test("…and WITHDRAWING a declared defender is always legal", () => {
  /* The cap limits how many may be DECLARED, so a toggle that removes one
     can never breach it. Without this the defender is locked into their
     first choice, which is a dead tap wearing a rule. */
  const g = wallState(DOM, [blocker(1), blocker(2)]);
  const g2 = J.reduce(g, {t: "defend", uid: 1}, 1).state;
  assert.equal(J.legal(g2, {t: "defend", uid: 1}, 1), null,
    "withdrawing the card already declared must stay legal");
});

test("…and a plain attack still takes two", () => {
  /* The control. Without it this file passes just as well against a judge
     that refused every second defender in the game. */
  const g = wallState(PLAIN, [blocker(1), blocker(2)]);
  const g2 = J.reduce(g, {t: "defend", uid: 1}, 1).state;
  assert.equal(J.legal(g2, {t: "defend", uid: 2}, 1), null);
});

test("DRIVEN: Confidence's cap counts a BLOCK card as free and equipment as spent", {skip}, () => {
  H.db();
  const blk = {...H.card("Test of Might", 1), uid: 7};
  assert.ok(/block/i.test(blk.tt || ""), "the fixture must actually be a Block card");
  const iron = {uid: 9, name: "Iron", tt: "Guardian Equipment - Chest", def: 2, gi: 0};
  const g0 = wallState(PLAIN, [blocker(1), blk], [iron]);
  const g = {...g0, pend: {...g0.pend, defCap: {n: 1, count: "nonBlock", q: null}}};

  /* DECLARE THE GEAR FIRST. Written the other way round — hand card, then
     equipment — the drill passes even when the tally never LOOKS at
     `blockG`, because the one hand card already fills a cap of 1. A
     fixture that cannot tell two things apart has tested neither
     (v3.26), and the sabotage that removes the gear term is what said so. */
  const g2 = J.reduce(g, {t: "defend", uid: 9}, 1).state;
  assert.deepEqual(g2.sides[1].blockG, [9], "the equipment must actually be declared");
  assert.ok(/more than 1 non-block/.test(String(J.legal(g2, {t: "defend", uid: 1}, 1))),
    "equipment is a non-block card, so it fills the cap and the hand card must be refused");
  /* … but a Block card never counts, so it may still be declared */
  assert.equal(J.legal(g2, {t: "defend", uid: 7}, 1), null,
    "a Block card is excluded by the printed word and must stay declarable");
});

test("…and the cap is APPLIED to a gear declaration, not only counted from one", {skip}, () => {
  /* TWO DIRECTIONS, TWO DRILLS. The one above declares the gear first and
     proves the TALLY sees `blockG`; this one fills the cap from hand and
     proves the CHECK runs for a gear declaration. Sabotaging the check to
     skip equipment (`gi < 0 &&`) is silent against the first drill alone —
     the gear is declared while the cap is still empty, so nothing refuses
     it either way. */
  H.db();
  const iron = {uid: 9, name: "Iron", tt: "Guardian Equipment - Chest", def: 2, gi: 0};
  const g0 = wallState(PLAIN, [blocker(1)], [iron]);
  const g = {...g0, pend: {...g0.pend, defCap: {n: 1, count: "nonBlock", q: null}}};
  const g2 = J.reduce(g, {t: "defend", uid: 1}, 1).state;
  assert.deepEqual(g2.sides[1].blockH, [1], "the hand card must actually be declared");
  assert.ok(/more than 1 non-block/.test(String(J.legal(g2, {t: "defend", uid: 9}, 1))),
    "the cap counts equipment, so it must also REFUSE equipment once full");
});

/* ---- 4. DRIVEN: the grant, end to end ------------------------------ */

test("DRIVEN: Confidence's grant is TAKEN by the attack it names", {skip}, () => {
  H.db();
  const g = H.state({res: 9, ap: 1, defCapNext: [{n: 2, count: "nonBlock", q: {aac: true}}]},
                    {}, {turn: 3, actor: 0, turnPlayer: 0});
  const atk = {...H.card("Brutal Assault", 1), uid: 40};
  const out = J.withEffects({...g, stack: []}, (fx, s) => fx.execute(s, atk, "hand", 0));
  /* WHAT THE WALL READS, AND NOTHING ELSE (v3.71). This used to assert the
     whole entry INCLUDING its `q` — but `pend.defCap` now goes through
     `parser.defCap`, which merges the held grant with the card's own
     dominate and rebuilds `{n, count}`. The qualifier had already done its
     one job by then: it decided that THIS card is the one the grant named,
     and `takeDefCap` spent it on that basis. Neither wall has ever read
     `pend.defCap.q` — `defCap` drops it too — so carrying it here was
     incidental rather than load-bearing.

     The fixture was read before the assertion was reshaped (v3.31's rule);
     the `q` in the fixture is what makes the grant match, and it is still
     asserted where it matters, by the grant being SPENT below. */
  assert.deepEqual(out.pend.defCap, {n: 2, count: "nonBlock"},
    "the cap must ride on the link — the wall is built from `pend` on both boards");
  assert.deepEqual(out.sides[0].defCapNext, [], "…and the grant is spent");
});

test("…and a grant that does NOT match is not spent, it waits", {skip}, () => {
  /* v2.30's rule, held by every member of this family: a qualified grant
     that does not match WAITS rather than being burned.

     THE FIXTURE MUST BE AN ATTACK. Written with a non-attack it proved
     nothing at all — `takeDefCap` is only called on the attacking branch
     (correctly: the reader anchors on the printed word "attack", so no
     non-attack can ever satisfy one of these qualifiers), so the grant
     survived a sabotaged matcher too. It has to be an attack the
     QUALIFIER rejects. */
  H.db();
  const held = [{n: 2, count: "nonBlock", q: {g: [["sword"]]}}];
  const g = H.state({res: 9, ap: 1, defCapNext: held}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const atk = {...H.card("Brutal Assault", 1), uid: 42};
  assert.ok(P.isAttack(atk), "the fixture must be an attack, or the take is never even reached");
  assert.ok(!/sword/i.test(atk.tt || ""), "…and must not satisfy the qualifier");
  const out = J.withEffects({...g, stack: []}, (fx, s) => fx.execute(s, atk, "hand", 0));
  assert.equal((out.sides[0].defCapNext || []).length, 1, "the grant must still be held");
  assert.equal(out.pend.defCap, null, "…and nothing may ride on the link");
});

test("the grant expires with the turn, like the other four", {skip}, () => {
  const E = require("../engine/effects.js");
  const g = H.state({defCapNext: [{n: 2, count: "nonBlock", q: null}]}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = E.beginEndPhase({...g, phase: "end"}, 0);
  assert.deepEqual(out.game.sides[0].defCapNext, [],
    "every “this turn” grant is cleared in the shared end phase (v3.34)");
});

/* ---- 5. the trainer's wall ----------------------------------------- */

test("THE TRAINER CAPS ITS HEURISTIC, IT DOES NOT REPLACE IT", () => {
  /* Two different numbers live in `dummyDefence`: the 2 is a HEURISTIC —
     how many cards this tuned dummy chooses to spend — and `defCap` is the
     RULE. Folding them together would let the dummy block harder than it
     was tuned to the moment a cap was looser than 2. A source scan,
     because the wall is a React closure; what it can prove is that the
     rule caps rather than assigns. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/const cap = _cap \? Math\.min\(2, _cap\.n\) : 2;/.test(src),
    "the rule must CAP the heuristic (Math.min), never assign over it");
  assert.ok(/DawnParser\.defCap\(card, n\.pend && n\.pend\.defCap, \{kwGrant: n\._kwGrant\}\)/.test(src),
    "the trainer must ask the ONE reader, and hand it the granted keyword");
});

/* ---- 6. the branch this version restructured ------------------------
   The cap check had to sit BELOW both branches (a gear-only `return null`
   bypassed a cap that counts equipment), which moved two pre-existing
   rules. Sabotaging them found that one had NO DRILL ANYWHERE in the
   suite while its neighbour one line up did:

     chainBlocked (CR 7.3.2b)   drilled
     gearDef <= 0               silent across all 1618

   Silver Age equipment is nearly all battleworn, so a piece worn to zero
   re-blocking is reachable rather than theoretical — and it is the exact
   shape of v2.46's bug, where a spent wall was counted a second time. */

test("a piece with no defence left cannot be declared", {skip}, () => {
  H.db();
  const worn = {uid: 9, name: "Worn Iron", tt: "Guardian Equipment - Chest", def: 2, curDef: 0, gi: 0};
  const g = wallState(PLAIN, [], [worn]);
  const why = J.legal(g, {t: "defend", uid: 9}, 1);
  assert.ok(why && /no defence left/.test(why),
    "a battleworn piece at 0 is not a defender — got: " + String(why));
  /* the control: the same piece with its printed defence intact */
  const ok = wallState(PLAIN, [], [{...worn, curDef: null}]);
  assert.equal(J.legal(ok, {t: "defend", uid: 9}, 1), null);
});

test("…and a piece already spent on this chain cannot block again (CR 7.3.2b)", {skip}, () => {
  H.db();
  const iron = {uid: 9, name: "Iron", tt: "Guardian Equipment - Chest", def: 2, gi: 0};
  const g0 = wallState(PLAIN, [], [iron]);
  const g = {...g0, sides: g0.sides.map((sd, i) => i === 1 ? {...sd, chainBlocked: [9]} : sd)};
  assert.ok(/already blocked this chain/.test(String(J.legal(g, {t: "defend", uid: 9}, 1))));
});
