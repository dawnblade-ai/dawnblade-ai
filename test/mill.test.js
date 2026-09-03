/* ============================================================
   A MODAL OPTIONAL COST, AND "THAT CARD" (v3.90)

     "When this ATTACKS, you may discard a card OR destroy the top card of
      your deck. If THAT CARD has watery grave, this gets go again."
                                                     — JITTERY BONES
     "When this DEFENDS, … If that card has watery grave, this gets +2{d}."
                                                     — WASHED UP WAVE

   MEASURED: exactly TWO pool records print this, with the SAME cost, two
   different triggers and two different payloads. One reader closes both,
   and Jittery Bones was among the cards reading NOTHING at all.

   IT IS A MODE, NOT A FILTER. `fx.optCost` describes ONE cost with a zone
   and a filter, and `optFilter` cannot say "either of these two different
   things". Reading it as a plain discard deletes a printed line of play —
   milling is the branch you take when your hand holds nothing with the
   keyword.

   "THAT CARD" IS THE ONE THE COST CONSUMED, on either branch, so the
   condition cannot be answered until the cost has been paid — which is
   why it rides on the SPEC rather than becoming a `fx.conds` entry that
   `execute`'s loop would answer FALSE before any op ran (v3.60).

   AND FOUR POOL RECORDS PRINT "when this defends" ON GEAR — the two Unity
   pieces, Stonewall Impasse and Washed Up Wave — which NEITHER board
   reached: judge's wall is built from the hand alone and the trainer's
   site filters gear out. A trigger with no caller looks exactly like a
   trigger that works (v3.50).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

/* ---- 1. THE READER -------------------------------------------------- */

test("both cards read in full, with the same cost and different payloads",
     {skip}, () => {
  H.db(); P.fxReset();
  const jb = P.fxParse(H.card("Jittery Bones", 3));
  P.fxReset();
  const wuw = P.fxParse(H.card("Washed Up Wave", 0));
  assert.equal(jb.tier, "full");
  assert.equal(wuw.tier, "full");
  assert.deepEqual(jb.millCost, {trigger: "attacks", kw: "watery grave", ops: [["ga"]]});
  assert.deepEqual(wuw.millCost, {trigger: "defends", kw: "watery grave", ops: [["defBuff", 2]]});
});

test("the KEYWORD is read off the line, never stored", {skip}, () => {
  /* Both pool cards name `watery grave`, so no pool fixture can tell a
     read keyword from a literal — a synthetic is what sees it (v3.32,
     v3.55, v3.74, v3.77, v3.81, v3.86, v3.88; ninth outing). */
  P.fxReset();
  const mk = (nm, kw) => P.fxParse({name: nm, pitch: 1, cost: 1, power: 4, def: 2,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [],
    tx: "When this attacks, you may discard a card or destroy the top card of your "
      + "deck. If that card has " + kw + ", this gets go again."});
  assert.equal(mk("MC wg", "watery grave").millCost.kw, "watery grave");
  assert.equal(mk("MC crush", "crush").millCost.kw, "crush");
});

test("a payload that is not RUNNABLE refuses the whole clause", {skip}, () => {
  /* v2.29's rule: half a cost is not a cheap approximation when the half
     that reads is the REWARD.

     TWO WAYS TO FAIL, AND THE GUARD MUST CATCH BOTH. A payload
     `classifyClause` cannot read at all comes back NULL; one it reads as
     a `noop` comes back with a status — and a `noop` payload is a cost
     with no reward, which is the free-ability bug v2.04 fixed wearing a
     mode. Testing only the null case leaves the status test SILENT under
     sabotage. */
  P.fxReset();
  const mk = (nm, pay) => P.fxParse({name: nm, pitch: 1, cost: 1, power: 4, def: 2,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [],
    tx: "When this attacks, you may discard a card or destroy the top card of your "
      + "deck. If that card has crush, " + pay + "."});
  assert.equal(P.classifyClause("banish your opponent's imagination"), null,
    "the premise for the null case");
  assert.equal(mk("MC null", "banish your opponent's imagination").millCost, null);
  assert.equal(P.classifyClause("intimidate").status, "noop",
    "the premise for the noop case");
  assert.equal(mk("MC noop", "intimidate").millCost, null,
    "a noop payload is a cost with no reward");
});

/* ---- 2. THE OPTIONAL MODE ------------------------------------------- */

test("a modal can be DECLINED, and declining runs nothing", {skip}, () => {
  /* "You may choose one of two things" is a choice the player may also
     refuse; a modal with no way out makes a "you may" mandatory, which is
     stronger than printed and the free-ability rule v2.04 fixed read from
     the other end. Opt-in (v3.58), so every existing modal is unchanged. */
  const PM = require("../engine/prompts.js");
  const g = {sides: [{}, {}], turn: 1};
  const spec = {tag: "modal", side: 0, src: "X", optional: true,
    options: [{label: "A", ops: [["draw", 1]]}, {label: "B", ops: [["draw", 2]]}]};
  const p = PM.buildPrompt(g, spec);
  assert.equal(p.optional, true);
  const dec = PM.promptDecline(p);
  assert.equal(dec.choice, "decline");
  assert.equal(PM.promptReady(dec), true, "a declined modal can be confirmed");
  const outDec = PM.applyPrompt(g, dec);
  assert.deepEqual(outDec.ops, [], "and it runs nothing");
  /* THE FEED IS THE OBSERVABLE WHEN THE STATE IS IDENTICAL (v3.60).
     Without the decline branch the fallback also yields no ops, so the
     only difference is that the player is told "Mode chosen: undefined". */
  assert.match(outDec.msgs.join(" | "), /declined/);
  assert.doesNotMatch(outDec.msgs.join(" | "), /Mode chosen/);
  /* THE CONTROL: an ordinary modal still cannot be declined. */
  const plain = PM.buildPrompt(g, {...spec, optional: false});
  assert.equal(!!plain.optional, false);
  assert.equal(PM.promptDecline(plain).choice, null);
});

/* ---- 3. DRIVEN: THE ATTACK ROUTE ------------------------------------ */

function jitter(mode, top, hand){
  H.db(); P.fxReset();
  const jb = Object.assign({}, H.card("Jittery Bones", 3), {uid: 1001});
  const plain = H.card("Wounding Blow", 1);
  const g = H.state({hand: [jb, ...(hand || [])], res: 9, ap: 1,
                     deck: [top, Object.assign({}, plain, {uid: 1099})]},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, jb, "hand", 0, {})}));
  let n = J.openPrompt(out.game || out) || (out.game || out);
  assert.ok(n.prompt, "the sheet opens");
  n = mode === "decline"
    ? J.reduce(n, {t: "promptDecline"}, n.prompt.side).state
    : J.reduce(n, {t: "promptChoose", choice: mode}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  return {ga: !!(n.pend && n.pend.ga), grave: n.sides[0].grave.map(c => c.name),
          deck: n.sides[0].deck.length, hand: n.sides[0].hand.length, game: n};
}

test("milling a watery-grave card grants the go again", {skip}, () => {
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1010});
  assert.ok(P.printedKw(wg, "watery grave"), "the premise: Barnacle prints it");
  const r = jitter(1, wg);
  assert.equal(r.ga, true, "and the grant reaches the LINK, not just a local (v3.62)");
  assert.deepEqual(r.grave, ["Barnacle"], "the milled card reaches the graveyard");
  assert.equal(r.deck, 1, "off the top of the deck");
});

test("`printedKw`, NEVER `hasKw` — a card that only MENTIONS it has it not",
     {skip}, () => {
  /* v2.84's three questions. Both pool cards that print this cost name
     `watery grave`, and every real card that mentions it also has it — so
     the two predicates agree on the whole pool and only a SYNTHETIC
     near-miss tells them apart (v3.73's Crash-and-Bash discriminator,
     v3.82's ephemeral one). */
  H.db(); P.fxReset();
  const mentions = {uid: 1040, name: "Grave Namer", pitch: 1, cost: 1, power: 3,
    def: 2, tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [],
    tx: "Banish a card with watery grave from your graveyard."};
  assert.equal(P.printedKw(mentions, "watery grave"), false, "it does not HAVE it");
  assert.equal(P.hasKw(mentions, "watery grave"), true, "…and hasKw would say otherwise");
  const r = jitter(1, mentions);
  assert.equal(r.ga, false, "so no bonus");
});

test("…and milling a card WITHOUT it grants nothing", {skip}, () => {
  /* THE CONTROL. Without it the drill above passes just as well against
     an engine that grants the bonus unconditionally. */
  H.db();
  const plain = Object.assign({}, H.card("Wounding Blow", 1), {uid: 1011});
  assert.ok(!P.printedKw(plain, "watery grave"));
  const r = jitter(1, plain);
  assert.equal(r.ga, false);
  assert.deepEqual(r.grave, ["Wounding Blow"], "the cost was still paid");
});

test("the DISCARD branch is a real second mode", {skip}, () => {
  /* Reading the cost as a plain discard would delete a printed line of
     play; reading it as a plain mill would delete the other. */
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1014});
  const plainTop = Object.assign({}, H.card("Wounding Blow", 1), {uid: 1013});
  const r = jitter(0, plainTop, [wg]);
  assert.equal(r.ga, true, "the card in HAND is what was spent");
  assert.equal(r.deck, 2, "and the deck is untouched");
  assert.deepEqual(r.grave, ["Barnacle"]);
});

test("declining spends nothing and grants nothing", {skip}, () => {
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1012});
  const r = jitter("decline", wg);
  assert.equal(r.ga, false);
  assert.deepEqual(r.grave, []);
  assert.equal(r.deck, 2, "the deck is untouched — a 'you may' may be refused");
});

test("the graveyard copy is turn-stamped", {skip}, () => {
  /* `_gy` answers the whole "…this turn" family, and for these two heroes
     it is the point: Gravy Bones plays watery-grave cards OUT of the
     graveyard. A new path in that forgets the stamp makes those cards
     quietly wrong (v3.54). */
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1015});
  const r = jitter(1, wg);
  assert.equal(r.game.sides[0].grave[0]._gy, 3);
});

/* ---- 4. DRIVEN: THE DEFEND ROUTE ------------------------------------ */

function wave(mode, top){
  H.db(); P.fxReset();
  const wuw = Object.assign({}, H.card("Washed Up Wave", 0), {uid: 1101});
  const plain = H.card("Wounding Blow", 1);
  const atk = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 1102});
  const g0 = H.state({res: 9, ap: 1},
    {hp: 20, gear: [wuw], deck: [Object.assign({}, top, {uid: 1110}),
                                 Object.assign({}, plain, {uid: 1111})]},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.afterDefenders(s, [], [wuw])}));
  let n = out.game || out;
  assert.ok(n.prompt, "the sheet opens for a GEAR defender");
  assert.equal(n.prompt.side, 1, "and it is addressed to the DEFENDER, not the actor");
  n = mode === "decline"
    ? J.reduce(n, {t: "promptDecline"}, n.prompt.side).state
    : J.reduce(n, {t: "promptChoose", choice: mode}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  return {mod: n.sides[1].defMod,
          worth: E.defendValue(n.sides[1], wuw, {base: wuw.def}), game: n};
}

test("a GEAR defender's trigger fires — neither board reached it before",
     {skip}, () => {
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1120});
  const r = wave(1, wg);
  assert.deepEqual(r.mod, [{uid: 1101, d: 2}], "the buff is on the PIECE, by uid");
  assert.equal(r.worth, (H.card("Washed Up Wave", 0).def || 0) + 2,
    "and the wall reads it");
});

test("…and only when the card spent has the keyword", {skip}, () => {
  H.db();
  const plain = Object.assign({}, H.card("Wounding Blow", 1), {uid: 1121});
  const r = wave(1, plain);
  assert.deepEqual(r.mod, []);
});

test("a defBuff payload lands as a per-card `defMod`, not a wall number",
     {skip}, () => {
  /* Washed Up Wave is EQUIPMENT that is defending, and "this gets +2{d}"
     belongs to that piece for the rest of the chain. Run as a generic
     `defBuff` the number would go to a defence REACTION being played,
     which is a different card entirely. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.match(src, /const dbuff = \(cr\.ops \|\| \[\]\)\.filter\(o => o\[0\] === "defBuff"\)/);
  /* AND IT IS NOT ALSO RUN GENERICALLY. `runOps`' own `defBuff` only
     LOGS, so the state is identical and the feed is the observable
     (v3.60) — a line telling the player the number went to the wall when
     it went onto the piece is the sev-2 category they trust. */
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1122});
  const r = wave(1, wg);
  assert.doesNotMatch((r.game.feed || []).join(" | "), /defense to the wall/);
});

test("BOTH boards hand in the declared GEAR, separately from `wall`", {skip}, () => {
  /* `wall` is pinned as the declared NON-EQUIPMENT cards because phantasm
     reads no other kind — widening it to serve a new reader would change
     what phantasm looks at, silently. A second named argument is the
     honest answer, and both boards must supply it (v3.01). */
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.match(rd("engine/effects.js"), /const afterDefenders = \(s, wall, gearWall\) =>/);
  assert.match(rd("engine/judge.js"), /fx\.afterDefenders\(s, wall, gearWall\)/);
  assert.match(rd("index.html"), /_EFX\.afterDefenders\(n, n\.stack[\s\S]{0,400}?gear\[l\.gi\]/);
  /* AND PHANTASM STILL READS ONLY THE NON-EQUIPMENT WALL. */
  const src = rd("engine/effects.js");
  const i = src.indexOf('if(hasKw(card,"phantasm")){');
  const body = src.slice(i, src.indexOf('"WHEN THIS DEFENDS', i));
  assert.doesNotMatch(body, /gearWall/, "phantasm's reading is unchanged");
});

/* ---- 5. THE TRACE --------------------------------------------------- */

test("`_costWay` is a SECOND record of a second fact", {skip}, () => {
  /* v3.61 warns against two records of ONE fact. These are two facts: a
     milled card was never DISCARDED, so `_discWay` cannot answer "that
     card" — and a discarded one feeds both, because other cards really do
     ask about discards. */
  H.db();
  const c = {uid: 5, name: "MillTrace", tt: "Generic Action", ty: ["Generic", "Action"],
             pitch: 1, cost: 0, power: 0, def: 2, tx: "", kw: []};
  let g = H.state({hand: [c], deck: [Object.assign({}, c, {uid: 6, name: "DeckTop"})],
                   res: 9}, {}, {actor: 0, turn: 3, builds: [{}, {}]});
  const mill = J.withEffects(g, (fx, s) => ({game: fx.runOps(s, [["deckDestroy", 1]], "drill")}));
  const m = mill.game || mill;
  assert.deepEqual((m._costWay || []).map(x => x.name), ["DeckTop"]);
  assert.deepEqual((m._discWay || []).map(x => x.name), [],
    "a milled card was NOT discarded");
  const disc = J.withEffects(g, (fx, s) => ({game: fx.runOps(s, [["selfDiscard", 1]], "drill")}));
  const d = disc.game || disc;
  assert.deepEqual((d._costWay || []).map(x => x.name), ["MillTrace"]);
  assert.deepEqual((d._discWay || []).map(x => x.name), ["MillTrace"],
    "…and a discarded one feeds both");
});

test("an empty deck mills nothing rather than crashing", {skip}, () => {
  H.db();
  let g = H.state({deck: [], res: 9}, {}, {actor: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.runOps(s, [["deckDestroy", 1]], "drill")}));
  const n = out.game || out;
  assert.deepEqual(n.sides[0].grave, []);
  assert.match((n.feed || []).join(" | "), /no deck left/);
});

test("the seat's own name decides the verb", {skip}, () => {
  /* "You discards Barnacle" — a feed line that NAMES the seat has to
     agree with the name it used (v3.88's rule, and this line predates
     it). Named helper, hoisted out of the template, because the
     second-person ledger scans template literals. */
  H.db();
  const wg = Object.assign({}, H.card("Barnacle", 0), {uid: 1030});
  const r = jitter(0, Object.assign({}, H.card("Wounding Blow", 1), {uid: 1031}), [wg]);
  const feed = (r.game.feed || []).join(" | ");
  assert.match(feed, /You discard Barnacle/);
  assert.doesNotMatch(feed, /You discards/);
});
