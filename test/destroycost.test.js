/* ============================================================
   THE THIRD COST VERB — "YOU MAY DESTROY THIS" (v3.93)

     "Whenever you discard a random card with 6 or more {p}, you may
      destroy this. If you do, gain 1 action point."   — BEATEN TRACKERS

     "When a weapon attack you control hits, you may destroy this. If you
      do, the attack gets go again."             — REFRACTION BOLTERS

   Exactly two pool records print it — measured over all 797 — and both
   are Legs equipment WATCHING an event that happens somewhere else.

   AND ONE OF THEM ALREADY FIRED, THROUGH AN INLINE REGEX. That is
   v3.58's defect exactly: a card read outside the parser is a card
   special-cased, the ledger cannot see it, and Beaten Trackers reported
   `tier: part` while working. **A tier that says `part` on a card that
   works is a lead** — second outing of that sentence. Its sibling, which
   prints the identical cost, was completely dead.

   THE INLINE READER ALSO HARDCODED ITS THRESHOLD: the regex matched
   `\d+` and the test was `pow6`, a literal 6. The pool prints one card
   of this shape, so no pool fixture can tell a read number from a
   literal (v3.32 — tenth outing of that rule).

   FOUR THINGS THIS FILE HOLDS:

     the verb        a cost that spends the PIECE, not resources — and an
                     unpaid cost fires no rider (v2.04)
     the watcher     found in the GEAR zone and in the ARENA, in one body
                     shared with Magmatic Carapace's (v3.33)
     the threshold   READ, and it travels with the trigger (v3.88)
     the timing      a go-again grant that arrives AFTER its layer has
                     settled is CR 5.3.5's action point — and the queue
                     site says so, because the two boards clear `pend` at
                     different moments (v3.01)
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

let _n = 0;
const uniq = () => "SYN-DESTROY-" + (++_n);

const gearPiece = (nm, uid) => Object.assign({}, H.card(nm, 0), {uid: uid || "g1"});

const wpn = () => ({uid: 50, name: "Test Blade", cost: 0, power: 4,
  tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon"], tx: "", kw: [], gkw: []});

const bigCard = () => ({uid: 1, name: "Big Card", cost: 0, pitch: 1, power: 7,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});
const smallCard = () => ({uid: 2, name: "Small Card", cost: 0, pitch: 1, power: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

const board = o => Object.assign(
  H.state(Object.assign({res: 5, ap: 1}, o), {hp: 20}, {turn: 3, turnPlayer: 0}),
  {phase: "action"});

const unwrap = o => (o && o.game) || o;

/* ---- 1. THE READER --------------------------------------------------- */

test("both records are claimed, and each names its own event", {skip}, () => {
  const bt = P.fxParse(H.card("Beaten Trackers", 0)).payCost;
  assert.ok(bt, "Beaten Trackers is read by the PARSER now, not by a regex in effects.js");
  assert.equal(bt.destroySelf, true);
  assert.equal(bt.cost, 0, "the price is the piece, not resources");
  assert.equal(bt.trigger, "discardRandom");
  assert.equal(bt.trigN, 6, "the printed threshold");
  assert.deepEqual(bt.ops, [["ap", 1]]);

  const rb = P.fxParse(H.card("Refraction Bolters", 0)).payCost;
  assert.ok(rb, "…and so is its sibling, which was completely dead before v3.93");
  assert.equal(rb.destroySelf, true);
  assert.equal(rb.trigger, "weaponHit");
  assert.equal(rb.trigN, undefined, "this trigger carries no number");
  assert.deepEqual(rb.ops, [["ga"]]);
});

test("both now read tier FULL", {skip}, () => {
  /* The lead this build started from: Beaten Trackers WORKED and still
     reported `part`, because the reader was somewhere the ledger cannot
     see. A tier is a claim about the parser, so a card handled outside it
     is invisible to every coverage tool here. */
  for(const nm of ["Beaten Trackers", "Refraction Bolters"])
    assert.equal(P.fxParse(H.card(nm, 0)).tier, "full", nm);
});

test("the THRESHOLD is read off the line, not hardcoded", {skip}, () => {
  const real = H.card("Beaten Trackers", 0);
  for(const n of [3, 8]){
    const syn = Object.assign({}, real, {name: uniq(),
      tx: (real.tx || "").replace("6 or more", n + " or more")});
    assert.equal(P.fxParse(syn).payCost.trigN, n);
  }
});

test("the TRIGGER vocabulary is CLOSED — an unknown event refuses", {skip}, () => {
  /* CLOSED HARDER THAN MOST, because this cost DESTROYS the player's own
     equipment: a trigger nobody built would spend a piece on an event that
     never happens, or on one that happens for a different reason. Refusing
     leaves the card unclaimed, which is the never-parse-ahead-of-wiring
     rule at its most literal. */
  const real = H.card("Beaten Trackers", 0);
  /* THE REAL SENTENCE SHAPE with one phrase changed. Written with a
     newline between the two clauses instead of ". ", the splitter leaves a
     trailing period on the trigger clause, the matcher misses for THAT
     reason, and the sabotage that opens the vocabulary comes back
     SILENT — a fixture that cannot express the bug proves nothing
     (v3.62; eleventh "check your own fixture"). */
  const syn = Object.assign({}, real, {name: uniq(),
    tx: (real.tx || "").replace("you discard a random card with 6 or more {p}", "the moon is full")});
  assert.equal(P.fxParse(syn).payCost, undefined);
  /* the control: the SAME sentence shape with a known event still reads */
  const ok = Object.assign({}, real, {name: uniq(), tx: real.tx});
  assert.ok(P.fxParse(ok).payCost, "so the refusal above is the vocabulary, not the shape");
});

test("an unreadable RIDER refuses the whole clause", {skip}, () => {
  /* v2.29's rule: half a cost is not a cheap approximation when the half
     that reads is the REWARD — and here the half that reads is the piece
     being destroyed for nothing. */
  const real = H.card("Beaten Trackers", 0);
  /* THE REAL SENTENCE SHAPE, rider replaced — see the note on the
     vocabulary drill above for why the shape matters. */
  const syn = Object.assign({}, real, {name: uniq(),
    tx: (real.tx || "").replace("gain 1 action point", "ascend to a higher plane")});
  assert.equal(P.fxParse(syn).payCost, undefined);
  /* AND A RIDER THAT PARSES TO A `noop` MUST REFUSE TOO. Written with
     text `classifyClause` answers NULL for, the `!rr2.ops.length` half of
     the guard is never reached and deleting it is silent — the same
     fixture flaw v3.90 and v3.91 each hit once. `intimidate` is read and
     carries no ops. */
  const noop = Object.assign({}, real, {name: uniq(),
    tx: (real.tx || "").replace("gain 1 action point", "intimidate")});
  assert.ok(P.classifyClause("intimidate"), "the control: the rider IS read");
  assert.equal(P.fxParse(noop).payCost, undefined,
    "…and a cost whose reward is nothing still refuses");
});

test("'the attack' is a THIRD subject, and it is measured", {skip}, () => {
  /* Refraction Bolters is a WATCHER, so "this" would be the iron and is
     exactly the wrong subject (v2.33, v3.47, v3.92 — fourth time).
     Measured across all 797 records: six print the phrase, and the three
     `atkTrigger` tokens have their clause claimed by that whole-card
     reader before the clause loop runs, so nothing there moved. */
  assert.deepEqual(P.classifyClause("the attack gets go again"), {status: "run", ops: [["ga"]]});
  assert.deepEqual(P.classifyClause("the attack gains go again"), {status: "run", ops: [["ga"]]});
  assert.deepEqual(P.classifyClause("the attack has go again"), {status: "run", ops: [["ga"]]});
  /* and the sibling subjects it must not disturb */
  assert.deepEqual(P.classifyClause("this gets go again"), {status: "run", ops: [["ga"]]});
  /* three tokens print the phrase inside an `atkTrigger` wrapper and keep
     their own reading — the pop destroys the token AND grants the go again */
  for(const nm of ["Quicken", "Embodiment of Lightning"]){
    const fx = P.fxParse(H.card(nm, 0));
    assert.ok(fx.atkTrigger, nm + " keeps its whole-card reading");
    assert.deepEqual(fx.atkTrigger.ops, [["ga"]]);
  }
});

/* ---- 2. THE WATCHER, AND THE COST ------------------------------------ */

test("driven: a random 6+ discard offers the piece; paying spends it", {skip}, () => {
  const g = board({hand: [bigCard()], gear: [gearPiece("Beaten Trackers")]});
  const n = unwrap(H.runOps(g, [["discardRandom", 1]], "drill"));
  assert.equal((n.promptQ || []).length, 1);

  const sheet = PM.buildPrompt(n, n.promptQ[0]);
  assert.equal(sheet.tag, "pay");
  assert.equal(sheet.cost, 0, "no resources change hands");
  assert.equal(sheet.destroyUid, "g1", "the sheet names WHICH permanent is the price");

  const paid = unwrap(J.withEffects({...n, promptQ: [], prompt: PM.promptChoose(sheet, "pay")},
    (fx, m) => fx.applyAnswer(m, m.prompt)));
  assert.equal(paid.sides[0].ap, 2, "the printed reward");
  assert.equal(paid.sides[0].gear[0].destroyed, true, "and the printed price");
});

test("driven: DECLINING pays nothing and collects nothing — v2.04", {skip}, () => {
  /* The bug v2.04 fixed, and there is a drill named after it one file
     over: an optional cost declined must not fire its rider. */
  const g = board({hand: [bigCard()], gear: [gearPiece("Beaten Trackers")]});
  const n = unwrap(H.runOps(g, [["discardRandom", 1]], "drill"));
  const sheet = PM.buildPrompt(n, n.promptQ[0]);
  const no = unwrap(J.withEffects({...n, promptQ: [], prompt: PM.promptChoose(sheet, "decline")},
    (fx, m) => fx.applyAnswer(m, m.prompt)));
  assert.equal(no.sides[0].ap, 1, "no action point");
  assert.equal(!!no.sides[0].gear[0].destroyed, false, "and the iron is still there");
});

test("driven: a card under the threshold offers nothing", {skip}, () => {
  const g = board({hand: [smallCard()], gear: [gearPiece("Beaten Trackers")]});
  assert.equal((unwrap(H.runOps(g, [["discardRandom", 1]], "drill")).promptQ || []).length, 0);
});

test("driven: a piece already destroyed cannot pay again", {skip}, () => {
  /* Gear is MARKED rather than spliced until the end-phase sweep (v3.54),
     so a destroyed piece is still sitting in the zone and a scan that
     forgets to ask offers it a second time — an action point per discard,
     forever, off one piece of iron. */
  const g = board({hand: [bigCard()],
                   gear: [Object.assign(gearPiece("Beaten Trackers"), {destroyed: true})]});
  assert.equal((unwrap(H.runOps(g, [["discardRandom", 1]], "drill")).promptQ || []).length, 0);
});

test("driven: the watcher is found in the ARENA too", {skip}, () => {
  /* Both v3.93 cards are Legs and Magmatic Carapace is a Chest, so every
     real customer of this scan is in the GEAR zone — the arena half is
     measured-latent, and a scan written for one zone is exactly how three
     cards came to be dead in the other (v3.33, v3.55, v3.72). */
  const piece = gearPiece("Beaten Trackers", "b7");
  const g = board({hand: [bigCard()], gear: [],
                   board: [{uid: "b7", kind: "item", spent: false, card: piece}]});
  assert.equal((unwrap(H.runOps(g, [["discardRandom", 1]], "drill")).promptQ || []).length, 1,
               "a piece in the arena watches just as one in the gear zone does");
});

/* ---- 3. REFRACTION BOLTERS, AND THE TIMING --------------------------- */

/* A REAL SWING THAT CONNECTS, through the shared body both boards call.
   Building the sheet by hand would measure the SHEET and say nothing
   about whether anything opens one (v3.20). */
function swing(o){
  o = o || {};
  const g = board({gear: o.gear || [gearPiece("Refraction Bolters", "g9")]});
  return unwrap(J.withEffects(g, (fx, n) => {
    n = {...n, chain: [], stack: [],
         pend: {card: o.card || wpn(), from: o.from || "weapon", total: o.total == null ? 4 : o.total,
                ops: [], onHit: [], onHitHero: [], ga: false, by: 0, lateConds: []}};
    const r = fx.linkPayload(n, {total: o.total == null ? 4 : o.total, pumps: 0,
                                 heroHit: (o.total == null ? 4 : o.total) > 0});
    return r.game || r;
  }));
}

test("driven: a weapon HIT offers it; a blocked swing and a card attack do not",
     {skip}, () => {
  assert.equal((swing().promptQ || []).length, 1, "a weapon attack that connects");
  assert.equal((swing({total: 0}).promptQ || []).length, 0,
               "CR 7.5.5 — nothing dealt is not a hit");
  assert.equal((swing({from: "hand",
    card: {...wpn(), tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]}}).promptQ || []).length, 0,
    "'a WEAPON attack you control' is the route, and the card came from hand");
});

test("driven: the action point is already spent when the sheet opens", {skip}, () => {
  /* THE WHOLE TIMING PROBLEM, stated as an observation. `linkPayload`
     settles the layer's action point on its last line; `openPrompt`
     drains at the tail of the CALLER. So the grant can never arrive in
     time to be "kept". */
  const n = swing();
  assert.equal(n.sides[0].ap, 0, "the swing spent the turn's point");
  assert.equal((n.promptQ || [])[0].lateGa, true,
               "and the queue site says so, rather than the consumer guessing");
});

test("driven: paying hands the point back and marks the link — CR 5.3.5", {skip}, () => {
  const n = J.openPrompt(swing());
  const paid = unwrap(J.withEffects(n, (fx, m) => fx.applyAnswer(m, PM.promptChoose(m.prompt, "pay"))));
  assert.equal(paid.sides[0].ap, 1, "CR 5.3.5 — go again is a GAIN of one action point");
  assert.deepEqual(paid.chain.map(l => l.ga), [true],
    "and the link is marked, so the chain display agrees with what happened");
  assert.equal(paid.sides[0].gear[0].destroyed, true, "the iron is spent");
  assert.equal(paid._gaGrant, undefined, "and nothing is left to leak onto the next attack");
});

test("driven: declining leaves the point spent and the link unmarked", {skip}, () => {
  const n = J.openPrompt(swing());
  const no = unwrap(J.withEffects(n, (fx, m) => fx.applyAnswer(m, PM.promptChoose(m.prompt, "decline"))));
  assert.equal(no.sides[0].ap, 0);
  assert.deepEqual(no.chain.map(l => l.ga), [false]);
  assert.equal(!!no.sides[0].gear[0].destroyed, false);
});

test("driven: the settlement does NOT depend on which board cleared `pend`",
     {skip}, () => {
  /* v3.01's shape, and the first draft created it deliberately: the guard
     asked `!s.pend`, which is the TRAINER's marker — `resolveStack` nulls
     `pend` before draining and `judge.js` holds it until `closeChain`, two
     steps later. So the rule worked on one board and leaked a free action
     point onto the next attack on the other. `spec.lateGa` is set by the
     one site that KNOWS, because it is inside `linkPayload` itself. */
  const answer = g => {
    const n = J.openPrompt(g);
    return unwrap(J.withEffects(n, (fx, m) => fx.applyAnswer(m, PM.promptChoose(m.prompt, "pay"))));
  };
  const live = swing();                        /* judge-shaped: pend still set */
  assert.ok(live.pend, "the fixture really does hold a live pend");
  const cleared = {...live, pend: null};       /* trainer-shaped */

  assert.equal(answer(live).sides[0].ap, 1);
  assert.equal(answer(cleared).sides[0].ap, 1);
  assert.equal(answer(live)._gaGrant, undefined);
  assert.equal(answer(cleared)._gaGrant, undefined);
});

test("a grant with no `lateGa` still goes through the ORDINARY consumers",
     {skip}, () => {
  /* The settlement is opt-in on the spec (v3.58) so every other prompt
     keeps the behaviour it had: an unflagged spec whose ops grant go again
     must NOT hand back a point of its own — `execute` and `linkPayload`
     fold `_gaGrant` onto the live layer, and doing both is VALUE-DOUBLED
     on the fairness sweep's own terms. */
  const g = board({});
  const spec = {tag: "pay", side: 0, src: "probe", cost: 0, ops: [["ga"]]};
  const sheet = PM.buildPrompt(g, spec);
  assert.equal(sheet.lateGa, false, "not flagged");
  const out = unwrap(J.withEffects({...g, prompt: PM.promptChoose(sheet, "pay")},
    (fx, m) => fx.applyAnswer(m, m.prompt)));
  assert.equal(out.sides[0].ap, 1, "the action point is untouched by this route");
  assert.equal(out._gaGrant, true, "the grant is left for the ordinary consumers");
});

/* ---- 4. NO CARD IS SPECIAL-CASED ------------------------------------- */

test("neither card is named anywhere in the engine", {skip}, () => {
  /* THE GOLDEN RULE, and the defect this version fixed: Beaten Trackers
     was read by a regex over raw text sitting in `afterDiscard`, which is
     v3.58's "an inline reader is a card special-cased by name" one file
     over. Both cards are now read by `classifyClause`/`fxParse` like
     everything else. */
  const fs = require("fs"), path = require("path");
  for(const f of ["effects.js", "parser.js", "judge.js", "prompts.js"]){
    const src = fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for(const nm of ["Beaten Trackers", "Refraction Bolters"])
      assert.ok(src.indexOf(nm) < 0, nm + " must not appear in engine/" + f);
  }
});
