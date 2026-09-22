/* ============================================================
   TWO TARGETS IN ONE SENTENCE — CROWN OF DICHOTOMY (v4.59)

   > "Action - {r}, destroy this: Put target Runeblade attack action card
   >  AND target Runeblade non-attack action card from your graveyard on top
   >  of your deck in any order."   — Viserai's Head piece, and Briar's

   MEASURED OVER 797 RECORDS IT IS THE POOL'S ONLY CARD NAMING TWO TARGETS
   IN ONE SENTENCE, and `RX_GY_DECK`'s single-target reader could not have
   it: `(.+)` is greedy, so the first capture swallowed "and target …" and
   `pickSubject` rightly refused the phrase. `tier: part` since the card was
   dealt.

   IT NEEDED ONE READER AND A READINESS RULE, NOT NEW MACHINERY (v3.58,
   v3.73). `promptToggleSel` has pushed onto `sel` in TAP ORDER since
   `prompts.js` was written and `moveCards`' deckTop branch front-inserts the
   list — so the printed "IN ANY ORDER" *is* the selection order, and the
   first card tapped is the first card drawn. What was missing is that ONE
   filter cannot say "one of each": folded into the union with a bound of
   two, the sheet happily accepts two Runeblade ATTACKS, which is the
   printed second target silently deleted (v2.30's arrow buff on a sword,
   v3.31's swallowed tail, in the direction that steals games).

   READING THE PAYLOAD IS WHAT CREATED THE ROUTE — v3.47's shape, EIGHTH
   outing. `parseHeroPower` refuses a line whose payload has no reader, so
   `build.equipPiece` built this piece NO powCard at all and neither board
   could offer it. Nothing was wired; one sentence was read.

   AND BUILDING IT CREATED A LEGALITY THAT DID NOT EXIST. Measured, NO
   activation line in the pool had a pick as its payload before this one —
   so an ability whose sheet cannot be satisfied (an empty graveyard, which
   is every turn one) would destroy the Head piece, charge {r} and spend the
   action point, and then skip the sheet. v2.04 made an UNPAYABLE cost inert
   on purpose; v4.49 states the mirror in as many words, and `abCostWhy` is
   where every cost of that shape is already refused (v3.11, v3.99).
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const X = require("./helpers/extract.js");

const skip = H.db() ? false : "no card database";
const ROOT = path.join(__dirname, "..");
const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  return j.cards || j;
})();
const LINE = "put target Runeblade attack action card and target Runeblade "
           + "non-attack action card from your graveyard on top of your deck in any order";

/* =====================================================================
   1. THE PREMISES, MEASURED OFF THE PINNED POOL
   ===================================================================== */

test("the pool prints exactly ONE sentence naming two targets", () => {
  /* WHICH IS WHY EVERY NEAR-MISS BELOW IS SYNTHETIC (v3.73). A reader with
     one claimant cannot tell a read subject from a hardcoded one, and it
     cannot express its own refusals either. */
  const hits = [];
  for(const c of pool){
    const tx = String(c.functional_text || c.text || "");
    for(const sent of tx.split(/(?<=\.)\s+/)){
      const m = sent.match(/target/gi);
      if(m && m.length >= 2) hits.push(c.name);
    }
  }
  assert.deepEqual([...new Set(hits)], ["Crown of Dichotomy"]);
});

test("FIVE activation lines open a pick, and THREE were paid for a log line", {skip}, () => {
  /* THE MEASUREMENT THE NEW LEGALITY RESTS ON, AND MY FIRST ONE SAID THE
     FAMILY HAD ONE MEMBER. It parsed the whole printed LINE, which
     `classifyClause` files `noop` as an activation — so every record came
     back with no pick and the scan reported ZERO, which is indistinguishable
     from a pool with nothing in it (v3.81, v4.07). `equipPiece` builds the
     powCard out of the PAYLOAD with the cost prefix stripped, and that is
     what the reader is handed. v4.09: check your own fixture by asking the
     file, not by remembering what it does.

     SO THE FINDING IS A FAMILY (v4.21), not one card. `buildPrompt` answers
     null on an empty candidate pool — a prompt politely declining to show
     nothing, right THERE and wrong at the activation, because by then the
     cost is paid. Three were spending for a log line: Fai's {r}{r}{r} and
     his once-per-turn on an empty graveyard, and the Halo and the Hood
     DESTROYING THEMSELVES on an empty hand.

     BLAZE'S WAS ALREADY REFUSED BY NAME (v3.39) and its check STAYS,
     because it asks the sharper question — what the energy pool can afford,
     a dynamic bound no candidate scan knows. Not two records of one fact
     (v3.61): two different questions, like `effCost`'s three readers. */
  const seen = [];
  let k = 0;
  for(const c of pool){
    const m = C.mapDbCard(c);
    for(const line of String(m.tx || "").split(/\n+/)){
      const L = line.replace(/\*\*/g, "").trim();
      if(!/^(Once per Turn )?(Action|Instant|Attack Reaction) - /i.test(L)) continue;
      const hp = P.parseHeroPower(L, true);
      if(!hp) continue;
      P.fxReset();
      const fx = P.fxParse({name: m.n + " -- ab " + (k++), pitch: m.p, cost: m.c,
        power: m.pw, def: m.d, tt: "Equipment Ability", ty: m.ty, kw: [], gkw: [],
        tx: String(hp.eff || "")});
      P.fxReset();
      for(const op of (fx.ops || []))
        if(op[0] === "pickPrompt") seen.push(m.n + (op[1] && op[1].filters ? " [two targets]" : ""));
    }
  }
  assert.deepEqual([...new Set(seen)].sort(), [
    "Blaze, Firemind",
    "Crown of Dichotomy [two targets]",
    "Fai",
    "Halo of Illumination",
    "Hope Merchant's Hood",
  ], "the family moved — a new member is one more activation that can be paid for nothing");
});

test("both printed subjects are read, and they are DIFFERENT filters", () => {
  /* IF THEY WERE THE SAME FILTER THE MATCHING WOULD PROVE NOTHING — a
     perfect matching over two identical filters is just a count. */
  const a = P.pickSubject("Runeblade attack action card");
  const b = P.pickSubject("Runeblade non-attack action card");
  assert.deepEqual(a, {type: "attack", ty: ["runeblade"]});
  assert.deepEqual(b, {ty: ["runeblade", "action"], type: "nonAttack"});
  assert.notDeepEqual(a, b);
});

/* =====================================================================
   2. THE READING
   ===================================================================== */

test("the clause reads, as ONE pick carrying a LIST of filters", () => {
  const r = P.classifyClause(LINE);
  assert.ok(r && r.status === "run", "the clause still refuses");
  assert.equal(r.ops.length, 1, "two ops cannot say 'one of each' — the count is the rule");
  const [kind, spec] = r.ops[0];
  assert.equal(kind, "pickPrompt");
  assert.equal(spec.zone, "grave");
  assert.equal(spec.to, "deckTop", "the printed destination is read (Memorial Ground says top, "
    + "Preserve Tradition says the bottom)");
  assert.deepEqual(spec.filters,
    [{type: "attack", ty: ["runeblade"]}, {ty: ["runeblade", "action"], type: "nonAttack"}]);
  assert.equal(spec.filter, undefined,
    "a single `filter` beside `filters` is two records of one fact (v3.61)");
});

test("the SUBJECTS keep their printed capitalisation in the hint", () => {
  /* `classifyClause` works on the LOWERCASED clause and `cased` recovers the
     raw (v3.53) — and this sheet prints both subjects back to the player,
     where "runeblade" reads as a typo. In a training sim the feed is the
     lesson (v3.60), and the sheet's Confirm is DISABLED until the matching
     is met, so the hint is what tells the player why (v2.83: a dead control
     reads as a broken screen rather than as a rule). */
  const spec = P.classifyClause(LINE).ops[0][1];
  assert.match(spec.hint, /Runeblade attack action card/);
  assert.match(spec.hint, /Runeblade non-attack action card/);
  assert.match(spec.hint, /One of each/);
  assert.match(spec.hint, /first you tap is the first you draw/,
    "the printed 'in any order' is the selection order, and nothing else says so");
  assert.doesNotMatch(spec.title, /up to/,
    "'up to 2' is a lie — the printed line names exactly two");
});

test("AN UNREADABLE HALF REFUSES THE WHOLE CLAUSE (v2.29)", () => {
  /* Claiming the half that reads would file a `full` whose sheet asks for
     one target the card never printed alone. Synthetic, because the pool
     prints one record of this shape (v3.73). */
  for(const bad of [
    "put target Draconic card and target Runeblade non-attack action card from your graveyard on top of your deck in any order",
    "put target Runeblade attack action card and target Draconic card from your graveyard on top of your deck in any order",
  ]){
    assert.equal(P.classifyClause(bad), null, "a half that cannot be read must refuse: " + bad);
  }
  assert.equal(P.pickSubject("a Draconic card"), null, "fixture: that subject really is unread");
});

test("\"IN ANY ORDER\" IS IN THE ANCHOR, and it is not decoration", () => {
  /* It is the phrase that makes the ORDER the controller's choice, and the
     order is exactly what this sheet asks for. Without it the printed line
     says nothing about which card is drawn first, so a sheet that asked
     would be inventing a decision — READ WHOLE OR REFUSE. */
  assert.equal(P.classifyClause(
    "put target Runeblade attack action card and target Runeblade non-attack action card "
    + "from your graveyard on top of your deck"), null);
});

test("THE BOTTOM IS READ TOO, and it drops the tap-order note", () => {
  /* The destination is the printed half that varies, exactly as it is for
     the single-target reader. On the BOTTOM the order still decides which is
     drawn last, but "the first you tap is the first you draw" would be a lie,
     so the hint does not say it. */
  const spec = P.classifyClause(LINE.replace("on top of", "on the bottom of")).ops[0][1];
  assert.equal(spec.to, "deckBottom");
  assert.doesNotMatch(spec.hint, /first you draw/);
  assert.match(spec.title, /bottom/);
});

test("the SINGLE-target reader is unmoved — measured, not assumed", () => {
  /* v3.33: measure a reader change in both directions. The two-target form
     sits ABOVE the single one and could have shadowed it. */
  const r = P.classifyClause("put target Runeblade attack action card from your graveyard on top of your deck");
  assert.deepEqual(r.ops[0][1].filter, {type: "attack", ty: ["runeblade"]});
  assert.equal(r.ops[0][1].max, 1);
  assert.equal(r.ops[0][1].filters, undefined);
});

test("READING THE PAYLOAD CREATED THE ROUTE (v3.47, eighth outing)", {skip}, () => {
  /* `parseHeroPower` refuses a line whose payload has no reader, so before
     this version `build.equipPiece` built the piece no powCard AT ALL and
     neither board could offer the ability. Nothing was wired. */
  const cd = C.resolveEntry(H.db(), {name: "Crown of Dichotomy", p: 0, code: null, q: 1});
  const pw = P.parseHeroPower(cd.tx, true);
  assert.ok(pw, "the ability line refuses — the piece has no powCard and is inert");
  assert.equal(pw.cost, 1, "the printed {r}");
  assert.equal(pw.sd, true, "the printed destroy-this — dropped, the piece survives its own cost");
  assert.equal(pw.kind, "action");
  const gr = Object.assign({}, cd, {uid: 41});
  P.fxReset(); B.equipPiece(gr); P.fxReset();
  assert.ok(gr.powCard, "build.equipPiece built no powCard");
  const spec = P.abPickSpec(gr.powCard);
  assert.equal(spec.zone, "grave");
  assert.deepEqual(spec.filters,
    [{type: "attack", ty: ["runeblade"]}, {ty: ["runeblade", "action"], type: "nonAttack"}]);
});

/* =====================================================================
   3. THE PERFECT MATCHING — the rule that is NOT a count
   ===================================================================== */

const card = (nm, over) => Object.assign({uid: nm, name: nm, pitch: 1, cost: 1, power: 3,
  tt: "Runeblade Action - Attack", ty: ["Runeblade", "Action", "Attack"], tx: "", kw: [], gkw: []}, over || {});
const RATK = nm => card(nm);
const RNON = nm => card(nm, {power: null, tt: "Runeblade Action", ty: ["Runeblade", "Action"]});
const FILT = [{type: "attack", ty: ["runeblade"]}, {ty: ["runeblade", "action"], type: "nonAttack"}];

test("\"every card matches something\" is the WRONG test and passes the bug", () => {
  /* THE WHOLE REASON THIS IS KUHN'S ALGORITHM AND NOT A PAIR OF LOOPS. Two
     Runeblade attacks each match the attack filter, so a per-card scan
     answers TRUE while the non-attack target goes uncovered — and the
     printed second target is silently deleted. */
  const two = [RATK("a1"), RATK("a2")];
  assert.ok(two.every(c => FILT.some(f => PM.promptFilter(f)(c))),
    "fixture: both cards DO match a filter, which is what makes the wrong test pass");
  assert.equal(PM.promptMatchSet(two, FILT), false,
    "two attacks cover ONE of the two printed targets");
  assert.equal(PM.promptMatchSet([RATK("a1"), RNON("n1")], FILT), true);
  assert.equal(PM.promptMatchSet([RNON("n1"), RATK("a1")], FILT), true,
    "and the ORDER of the selection cannot change whether it is legal");
});

test("it is a MATCHING, not a per-filter existence check", () => {
  /* A card matching BOTH filters must not be counted twice. Synthetic and
     impossible in this pool — a card cannot be attack and non-attack — so
     the fixture is a filter pair that overlaps instead, which is the same
     property of the algorithm. */
  const both = [{ty: ["runeblade"]}, {ty: ["runeblade"]}];
  assert.equal(PM.promptMatchSet([RATK("a1")], both), false,
    "one card cannot satisfy two targets");
  assert.equal(PM.promptMatchSet([RATK("a1"), RATK("a2")], both), true);
});

test("an EMPTY filter list answers TRUE, which is what leaves every other pick alone", () => {
  assert.equal(PM.promptMatchSet([], null), true);
  assert.equal(PM.promptMatchSet([], []), true);
});

const sheet = (grave, over) => PM.buildPrompt(
  {sides: [H.side({name: "You", grave: grave}, 0), H.side({name: "Them"}, 1)]},
  Object.assign({tag: "pick", src: "Crown", zone: "grave", to: "deckTop", filters: FILT}, over || {}));

test("the sheet's BOUNDS come off the list's length and nothing else", () => {
  /* Two records of one fact is how the count comes to disagree with the
     matching (v3.61), so a spec's own min/max are ignored where `filters`
     decides. */
  const s = sheet([RATK("a1"), RNON("n1")]);
  assert.equal(s.max, 2);
  assert.equal(s.min, 2);
  assert.equal(sheet([RATK("a1"), RNON("n1")], {min: 0, max: 7}).max, 2,
    "a spec's max must not override the printed target count");
  assert.equal(sheet([RATK("a1"), RNON("n1")], {min: 0}).optional, false,
    "and it is never optional — the printed line names both targets");
});

test("the CANDIDATE POOL is the UNION, so a card that only fits the second is offered", () => {
  const s = sheet([RATK("a1"), RNON("n1"), card("other", {tt: "Generic Action", ty: ["Generic", "Action"]})]);
  assert.deepEqual(s.cards.map(c => c.name), ["a1", "n1"],
    "the union admits both printed subjects and nothing else");
});

test("AN UNSATISFIABLE SHEET IS REFUSED RATHER THAN BUILT — it would be a LIVELOCK", () => {
  /* `judge.legal` freezes the game for BOTH seats while a prompt is live
     (v4.44), so a sheet whose Confirm can never light is a hard stop for
     both players. Both boards refuse the ACTIVATION first; this is the
     second line of the same defence, and it is needed because `reduce` is
     fed by JSON off a wire (v2.04). */
  assert.equal(sheet([]), null, "an empty graveyard");
  assert.equal(sheet([RATK("a1"), RATK("a2")]), null, "two attacks and no non-attack");
  assert.equal(sheet([RNON("n1")]), null, "a non-attack and no attack");
  assert.ok(sheet([RATK("a1"), RNON("n1")]), "…and one of each builds");
});

test("CONFIRM is gated on the MATCHING, not on the count", () => {
  const s = sheet([RATK("a1"), RATK("a2"), RNON("n1")]);
  const idx = nm => s.cards.findIndex(c => c.name === nm);
  const sel = (...nms) => nms.reduce((p, nm) => PM.promptToggleSel(p, idx(nm)), s);
  assert.equal(PM.promptReady(sel("a1")), false, "one card is not two targets");
  assert.equal(PM.promptReady(sel("a1", "a2")), false,
    "TWO ATTACKS IS THE SELECTION THE PRINTED LINE FORBIDS, and `sel.length >= min` lights it");
  assert.equal(PM.promptReady(sel("a1", "n1")), true);
  assert.equal(PM.promptReady(sel("n1", "a1")), true);
});

test("`filters` is a spec field `buildPrompt` NAMES (v2.34, ninth field)", () => {
  /* Dropped there it vanishes silently: the sheet opens, the right cards are
     offered, `promptReady` falls back to the count, and Confirm lights on two
     attacks. */
  const src = fs.readFileSync(path.join(ROOT, "engine", "prompts.js"), "utf8");
  /* BOUNDED AT THE PICK BRANCH ITSELF, not at `buildPrompt`'s declaration
     (v4.57, v4.05): anchored at the function the drill would have read the
     `opt` branch too, which is 13,303 characters for a claim about one
     field. A bound too wide reads exactly like a drill that passes. */
  const body = src.slice(src.indexOf("if(spec.tag === \"pick\"){"),
                         src.indexOf("ALLOC — THE SIXTH VARIANT"));
  assert.ok(body.length > 200 && body.length < 12000, "re-anchor this slice");
  assert.match(body, /\bfilters,/, "`buildPrompt` must put `filters` on the prompt");
  const s = sheet([RATK("a1"), RNON("n1")]);
  assert.deepEqual(s.filters, FILT, "and it must arrive on the live prompt");
});

/* =====================================================================
   4. DRIVEN — the whole route, through the real builder and `reduce`
   ===================================================================== */

const ent = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p: p, code: null, q: 1}), {uid});
function crown(){
  const gr = Object.assign({}, C.resolveEntry(H.db(), {name: "Crown of Dichotomy", p: 0, code: null, q: 1}), {uid: 41});
  P.fxReset(); B.equipPiece(gr); P.fxReset();
  return gr;
}
function board(grave){
  const g = H.state({gear: [crown()], hand: [], grave: grave,
      deck: [ent("Wounding Blow", 1, 600)], res: 9, ap: 1},
    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const ATK1 = () => ent("Arcanic Shockwave", 1, 701);
const ATK2 = () => ent("Amplify the Arknight", 1, 703);
const NON1 = () => ent("Malefic Incantation", 1, 702);
const ACT = {t: "activate", uid: 41, from: "gear"};

test("DRIVEN: a graveyard that cannot supply both targets is REFUSED", {skip}, () => {
  /* v3.11, and v4.49's mirror of v2.04: the cost DESTROYS the Head piece, so
     refusing after the ability resolves costs the player the piece, the {r}
     and the action point for a log line. And the real entry point is
     `legal`, not `abCostWhy` (v3.20). */
  for(const [what, grave] of [["an empty graveyard", []],
                              ["two attacks and no non-attack", [ATK1(), ATK2()]],
                              ["a non-attack and no attack", [NON1()]]]){
    const why = J.legal(board(grave), ACT, 0);
    assert.ok(why, "the ability was allowed with " + what);
    assert.match(String(why), /BOTH its targets/, "the refusal does not name the cause: " + why);
    /* SEAT 0 IS LITERALLY NAMED "You" (v2.83), so a hand-rolled possessive
       reads "You's graveyard" — v4.22's finding, and `game.sp` is the one
       reader. And "grave" is a field name, not a word anybody says. */
    assert.doesNotMatch(String(why), /You's/, "the possessive was built by hand: " + why);
    assert.match(String(why), /your graveyard/, "the zone key leaked into the feed: " + why);
  }
  assert.equal(J.legal(board([ATK1(), NON1()]), ACT, 0), null, "one of each was refused");
});

test("DRIVEN: the whole cost is paid and the sheet asks for one of each", {skip}, () => {
  const s = J.reduce(board([ATK1(), NON1()]), ACT, 0).state;
  assert.equal(s.sides[0].res, 8, "the printed {r} was not charged");
  assert.equal(s.sides[0].ap, 0, "CR 8.1.1 — an activated ability costs the action point");
  assert.equal((s.sides[0].gear || []).find(x => x.uid === 41).destroyed, true,
    "the piece survived its own printed cost — the drawback is free");
  assert.ok(s.prompt, "no sheet opened, so the ability was paid for and did nothing");
  assert.equal(s.prompt.tag, "pick");
  assert.equal(s.prompt.min, 2);
  assert.deepEqual(s.prompt.cards.map(c => c.name).sort(),
    ["Arcanic Shockwave", "Malefic Incantation"]);
});

test("DRIVEN: the TAP ORDER is the deck order — the printed \"in any order\"", {skip}, () => {
  /* THE PROPERTY THE WHOLE READING RESTS ON, and it is asserted BOTH WAYS:
     a single order proves nothing, because a reader that always put the
     attack on top would pass one of these two rows perfectly (v3.26). */
  const answer = first => {
    let s = J.reduce(board([ATK1(), NON1()]), ACT, 0).state;
    const idx = nm => s.prompt.cards.findIndex(c => c.name === nm);
    const other = first === "Arcanic Shockwave" ? "Malefic Incantation" : "Arcanic Shockwave";
    s = J.reduce(s, {t: "promptSel", i: idx(first)}, 0).state;
    s = J.reduce(s, {t: "promptSel", i: idx(other)}, 0).state;
    return J.reduce(s, {t: "promptConfirm"}, 0).state;
  };
  const a = answer("Arcanic Shockwave");
  assert.deepEqual(a.sides[0].deck.map(c => c.name),
    ["Arcanic Shockwave", "Malefic Incantation", "Wounding Blow"]);
  const b = answer("Malefic Incantation");
  assert.deepEqual(b.sides[0].deck.map(c => c.name),
    ["Malefic Incantation", "Arcanic Shockwave", "Wounding Blow"]);
  /* AND BOTH CARDS LEFT THE GRAVEYARD. A card in two zones is what
     `invariants.js` catches; a card in NONE falls out of the census
     silently (v2.45), so the zone count is asserted on both sides. */
  for(const s of [a, b]){
    assert.deepEqual(s.sides[0].grave.map(c => c.name), []);
    assert.equal(s.sides[0].deck.length, 3);
  }
  /* AND THE FEED SAYS WHICH ONE IS ON TOP, because the order is the whole
     decision this card offers (v3.60). */
  assert.ok((a.feed || []).some(l => /On top of the deck: Arcanic Shockwave first/.test(l)),
    "the order is not announced, so the player cannot see the choice they made");
  assert.ok((b.feed || []).some(l => /On top of the deck: Malefic Incantation first/.test(l)));
});

test("DRIVEN: two attacks cannot be confirmed at the table either", {skip}, () => {
  /* THE SAME REFUSAL THROUGH `reduce`, because the sheet lives in the
     sequenced state there and `promptReady` is what `promptConfirm` asks. */
  let s = J.reduce(board([ATK1(), ATK2(), NON1()]), ACT, 0).state;
  const idx = nm => s.prompt.cards.findIndex(c => c.name === nm);
  s = J.reduce(s, {t: "promptSel", i: idx("Arcanic Shockwave")}, 0).state;
  s = J.reduce(s, {t: "promptSel", i: idx("Amplify the Arknight")}, 0).state;
  const out = J.reduce(s, {t: "promptConfirm"}, 0);
  assert.ok(out.error || (out.state && out.state.prompt),
    "two attacks were accepted — the printed second target is deleted");
  if(out.state) assert.deepEqual(out.state.sides[0].deck.map(c => c.name), ["Wounding Blow"],
    "…and nothing moved");
});

/* =====================================================================
   5. ONE BOARD IS NOT TWO (v3.01)
   ===================================================================== */

test("the TRAINER asks the same legality, out of the same readers", () => {
  /* v3.01's shape is the recurring defect in exactly this area: a rule that
     exists on one board only. Scanned with comments stripped, because this
     project's own prose names the shapes it forbids and a raw scan reports
     the sentence as the defect (v4.27, v4.32, v4.44). */
  const raw = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.ok(!src.includes("/*"), "the comment stripper is not stripping");
  assert.ok(src.includes("const tryPlay"), "…and it has eaten the code it was meant to read");
  assert.match(src, /abPickSpec\(card\)/, "the trainer must ask the same reader");
  assert.match(src, /promptPickAskable\(promptPickPool\(act\(s\), _pk\), _pk\)/,
    "…of the same side, through the same predicate `buildPrompt` refuses on");
  const jsrc = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.match(jsrc, /PR\.abPickSpec\(ab\)/, "and so must `abCostWhy`");
  assert.match(jsrc, /PM\.promptPickAskable\(PM\.promptPickPool\(sd, _pk\), _pk\)/);
  /* AND IT IS THE PREDICATE `buildPrompt` ITSELF USES, so the sheet and the
     legality cannot disagree about whether there is anything to choose. */
  const psrc = fs.readFileSync(path.join(ROOT, "engine", "prompts.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.match(psrc, /if\(!promptPickAskable\(pool, spec\)\) return null;/,
    "`buildPrompt` must refuse through the same predicate, or it is a second copy");
});

test("`promptZoneWord` is ONE reader, and it reaches the default hint too", () => {
  /* The state keys are field names and one of them is not a word anybody
     says. Two spellings of one noun across two boards is the mirror the
     no-mirror rule exists to stop, so it is one body — and it had a second
     caller the moment it existed: this module's own default hint read "From
     your grave." on every pick that supplies none. */
  assert.equal(PM.promptZoneWord("grave"), "graveyard");
  for(const z of PM.PROMPT_ZONES)
    if(z !== "grave") assert.equal(PM.promptZoneWord(z), z, "the fallback is the key itself");
  const s = PM.buildPrompt(
    {sides: [H.side({name: "You", grave: [RATK("a1")]}, 0), H.side({name: "Them"}, 1)]},
    {tag: "pick", zone: "grave", to: "hand", min: 1, max: 1});
  assert.match(s.hint, /From your graveyard/, "the default hint still says \"grave\"");
});

test("`promptSideZone` is `promptZone`'s BODY, not a second copy", () => {
  /* One reader of what is in a zone. `abCostWhy` takes `(sd, ab)` and has no
     game to index, and the alternative was a synthetic `{sides:[sd]}` at the
     call site or three zone shapes written twice (v4.05: expose the reader
     rather than duplicating it). */
  const g = {sides: [H.side({name: "You", grave: [RATK("a1")], arsenal: RNON("n1")}, 0),
                     H.side({name: "Them"}, 1)]};
  for(const z of PM.PROMPT_ZONES)
    assert.deepEqual(PM.promptZone(g, 0, z), PM.promptSideZone(g.sides[0], z), "zone " + z);
  const src = fs.readFileSync(path.join(ROOT, "engine", "prompts.js"), "utf8");
  const body = src.slice(src.indexOf("function promptZone(game, side, zone){"),
                         src.indexOf("/* Selection filters read printed card"));
  assert.match(body, /return promptSideZone\(game\.sides\[side\], zone\);/,
    "`promptZone` must delegate — a second copy of the three zone shapes is the mirror");
  assert.ok(body.length < 400, "…and it must be nothing else");
});

/* =====================================================================
   6. REACHABILITY, AND WHY NO ROUTE COUNTER IS ADDED
   ===================================================================== */

test("the ability is REACHABLE — both lists deck the two targets", {skip}, () => {
  const W = X.loadData();
  for(const [hk, atkMin, nonMin] of [["viserai", 20, 14], ["briar", 6, 3]]){
    const deck = G.parseDeck(W.DECKS[hk]);
    let a = 0, na = 0;
    for(const e of deck.deck){
      const c = C.resolveEntry(H.db(), e);
      if(!c) continue;
      const ty = (c.ty || []).map(x => String(x).toLowerCase());
      if(ty.indexOf("runeblade") < 0) continue;
      if(ty.indexOf("attack") >= 0 && ty.indexOf("action") >= 0) a += e.q || 1;
      else if(ty.indexOf("action") >= 0) na += e.q || 1;
    }
    assert.ok(a >= atkMin, hk + " decks " + a + " Runeblade attack action cards");
    assert.ok(na >= nonMin, hk + " decks " + na + " Runeblade non-attack action cards");
    assert.ok(deck.gear.some(e => /Crown of Dichotomy/i.test(e.name)), hk + " lists the piece");
  }
});

test("NO ROUTE COUNTER IS ADDED, AND THAT IS ABOUT THE LOADOUT", {skip}, () => {
  /* v4.43's Hope Merchant's Hood, v4.49's Plasma Barrel Shot, v4.52's Silent
     Stilettos and v4.55's Runebleed Robe — FIFTH outing. `defaultPicks` ranks
     armour by printed defence, and both lists hold Blade Beckoner Helm at 1
     against this piece at 0, so the Crown is never worn in a driven game. A
     number that can only read 0 because of the loadout is a number about the
     loadout (v4.24, v4.29, v4.41, v4.52), and a counter that cannot see its
     own event is v4.46's defect.

     A PLAYER PICKS IT ON THE LOADOUT SCREEN, which is the route the drills
     above seat explicitly. And the premise is a DRILL, so a `defaultPicks`
     that starts ranking by card text has to re-measure this rather than
     silently changing what a zero means. */
  const W = X.loadData();
  for(const hk of ["viserai", "briar"]){
    const hero = W.HEROES.find(h => h.k === hk);
    const deck = G.parseDeck(W.DECKS[hk]);
    const heads = deck.gear.map(e => C.resolveEntry(H.db(), e))
      .filter(c => c && /- Head\b/.test(String(c.tt || "")));
    assert.deepEqual(heads.map(c => c.name).sort(), ["Blade Beckoner Helm", "Crown of Dichotomy"],
      hk + " lists exactly two Head pieces");
    const helm = heads.find(c => c.name === "Blade Beckoner Helm");
    const crn  = heads.find(c => c.name === "Crown of Dichotomy");
    assert.ok((helm.def || 0) > (crn.def || 0), "the Helm prints MORE defence — the whole reason it wins");
    const built = B.buildSideDefault(hero, deck, H.db(), RNG.make("cd-loadout"), {n: 0});
    const worn = (built.b.gear || []).map(c => c.name);
    assert.ok(worn.indexOf("Blade Beckoner Helm") >= 0, "so `defaultPicks` wears the Helm");
    assert.equal(worn.indexOf("Crown of Dichotomy"), -1, "…and never the piece this version built");
  }
});

/* =====================================================================
   7. THE FAMILY — three activations that were paid for a log line
   ===================================================================== */

function piece(nm){
  const gr = Object.assign({}, C.resolveEntry(H.db(), {name: nm, p: 0, code: null, q: 1}), {uid: 41});
  P.fxReset(); B.equipPiece(gr); P.fxReset();
  return gr;
}
function gearBoard(gr, side){
  const g = H.state(Object.assign({gear: [gr], hand: [], grave: [],
      deck: [ent("Wounding Blow", 1, 600)], res: 9, ap: 1}, side || {}),
    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}

test("DRIVEN: the Halo and the Hood no longer destroy themselves for nothing", {skip}, () => {
  /* BOTH PRINT "destroy this" AND PICK FROM THE HAND, so an empty hand
     shattered the piece and showed no sheet. Neither is this version's card
     and both are the same defect, which is why the reader is general rather
     than aimed at Crown of Dichotomy (v4.21: fix the family). */
  for(const nm of ["Halo of Illumination", "Hope Merchant's Hood"]){
    const gr = piece(nm);
    assert.ok(gr.powCard, nm + " has no powCard — re-anchor this drill");
    const why = J.legal(gearBoard(gr), ACT, 0);
    assert.ok(why, nm + " was activatable with an empty hand");
    assert.match(String(why), /nothing to choose in your hand/, String(why));
    /* THE PIECE SURVIVES, which is the whole point of refusing FIRST. */
    const s = J.reduce(gearBoard(gr), ACT, 0);
    const kept = (s.state || gearBoard(gr)).sides[0].gear.find(x => x.uid === 41);
    assert.ok(!kept.destroyed, nm + " was destroyed by a refused activation");
    /* AND THE POSITIVE CONTROL — a guard that refuses everything passes the
       row above perfectly (v3.98). */
    assert.equal(J.legal(gearBoard(gr, {hand: [ent("Wounding Blow", 1, 702)]}), ACT, 0), null,
      nm + " is refused even with a card to choose");
  }
});

test("DRIVEN: Fai's ability is refused with no Phoenix Flame in the graveyard", {skip}, () => {
  /* HIS COST IS {r}{r}{r} AND HIS ONCE-PER-TURN, and both were spent on a
     sheet that skipped itself. His is a HERO powCard, so this also drives
     the other of judge's two activation branches (v3.99: an activation's
     costs are one body, and the hero branch is where they lived alone). */
  const W = X.loadData();
  const built = B.buildSideDefault(W.HEROES.find(h => h.k === "fai"),
    G.parseDeck(W.DECKS.fai), H.db(), RNG.make("fai-459"), {n: 0});
  const pc = built.b.HPOW;
  assert.ok(pc, "Fai's hero powCard is gone — re-anchor this drill");
  const spec = P.abPickSpec(pc);
  assert.equal(spec.zone, "grave");
  assert.deepEqual(spec.filter, {name: "^Phoenix Flame$"});
  /* DRIVEN THROUGH `legal`, THE REAL ENTRY POINT (v3.20). The hero branch
     reads `bOf(g, seat).HPOW`, so the build goes on `g.builds` where the
     rules sites look for it (v2.80's `judged.js` note) rather than being
     handed to a context. */
  const side = grave => {
    const g = Object.assign(
      H.state({gear: [], hand: [], grave: grave, deck: [ent("Wounding Blow", 1, 600)],
               res: 9, ap: 1, name: "You"},
        {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}),
      {phase: "action", step: "layer", priority: 0, passed: []});
    g.builds = [built.b, g.builds && g.builds[1] || {}];
    return g;
  };
  const why = J.legal(side([]), {t: "activate", uid: "hpow", from: "hero"}, 0);
  assert.ok(why, "his ability was activatable with no Phoenix Flame to return");
  assert.match(String(why), /nothing to choose in your graveyard/, String(why));
  assert.equal(J.legal(side([ent("Phoenix Flame", 1, 705)]), {t: "activate", uid: "hpow", from: "hero"}, 0),
    null, "…and with the Flame there it is legal");
});

test("Blaze's by-name refusal STAYS, and it is the sharper question", {skip}, () => {
  /* v3.39 refused his dead tap by asking what the ENERGY POOL can afford —
     `arcLe: held`, a dynamic bound no candidate scan knows. The general check
     asks only whether there is a candidate at all, so the two are different
     questions rather than two records of one fact (v3.61). */
  const jsrc = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8");
  assert.match(jsrc, /arcLe: held/, "Blaze's affordability bound was deleted with the widening");
  const W = X.loadData();
  const built = B.buildSideDefault(W.HEROES.find(h => h.k === "blaze"),
    G.parseDeck(W.DECKS.blaze), H.db(), RNG.make("blaze-459"), {n: 0});
  const pc = built.b.HPOW;
  const spec = P.abPickSpec(pc);
  assert.equal(spec.ctrSpend, "energy", "his spec is the one the named check reads");
  assert.equal(spec.zone, "hand");
});

test("a HAND ability's own card is not a candidate for its own pick — measured", {skip}, () => {
  /* THE HAZARD IN GENERALISING THIS: if an ability printed on a card IN HAND
     picked from the hand, the card paying the cost would be in its own
     candidate pool and the legality would answer TRUE off it. Measured over
     the pinned pool — every activation line that opens a pick is on a HERO or
     on EQUIPMENT, so the source is never in the picked zone. A record
     arriving on a hand card fails here rather than being silently counted. */
  let k = 0;
  const holders = [];
  for(const c of pool){
    const m = C.mapDbCard(c);
    for(const line of String(m.tx || "").split(/\n+/)){
      const L = line.replace(/\*\*/g, "").trim();
      if(!/^(Once per Turn )?(Action|Instant|Attack Reaction) - /i.test(L)) continue;
      const hp = P.parseHeroPower(L, true);
      if(!hp) continue;
      P.fxReset();
      const fx = P.fxParse({name: m.n + " -- h " + (k++), pitch: m.p, cost: m.c,
        power: m.pw, def: m.d, tt: "Equipment Ability", ty: m.ty, kw: [], gkw: [],
        tx: String(hp.eff || "")});
      P.fxReset();
      if((fx.ops || []).some(op => op[0] === "pickPrompt")) holders.push(String(m.tt || ""));
    }
  }
  for(const tt of holders)
    assert.ok(/Equipment|Hero/.test(tt),
      "an activation pick on a " + tt + " — its own card may be in the picked zone");
});

test("`abPickSpec` never throws — `legal` is fed JSON off a wire", () => {
  /* `fxParse` memoizes on `name|pitch` and throws without a name, and this
     reader is reached from `judge.legal`, whose contract is that it never
     throws (`fuzz.test.js`). Every other `ab*` reader beside it reads a
     stamp and cannot. */
  for(const bad of [null, undefined, {}, {name: 42}, {name: null, tx: "x"}])
    assert.equal(P.abPickSpec(bad), null, "threw or answered for " + JSON.stringify(bad));
});

test("`promptPickPool` honours CALLER-SUPPLIED candidates", () => {
  /* A choice does not always live in one zone — Cold Snap's freeze picks
     across the opponent's arsenal and their allies (v3.47). The legality and
     `buildPrompt` share this body, so a pool that ignored `spec.cards` would
     read the wrong zone at BOTH. */
  const mine = [RATK("a1")], theirs = [RNON("n1")];
  const sd = H.side({name: "You", grave: mine}, 0);
  assert.deepEqual(PM.promptPickPool(sd, {zone: "grave", filter: {}}).map(c => c.name), ["a1"]);
  assert.deepEqual(PM.promptPickPool(sd, {cards: theirs, filter: {}}).map(c => c.name), ["n1"],
    "`spec.cards` must win over the zone");
});

test("the LAZY captures buy nothing on this card, and that is measured", () => {
  /* A SABOTAGE TO GREEDY CAME BACK SILENT, and it was the sabotage that could
     not express its bug rather than a weak drill (v3.62). The printed clause
     holds exactly one " and target ", so a greedy group backtracks to the same
     split and both quantifiers answer BYTE-IDENTICALLY.

     SO THE PREMISE IS RECORDED HERE instead, or the next reader is left
     thinking the `?` is load-bearing — v4.50 deleted a rung that could not
     express its own bug and made its premise a drill; this one cannot be
     deleted (there is no simpler regex), so it is pinned. */
  const lazy   = /^put target (.+?) and target (.+?) from your graveyard on (?:the )?(top|bottom) of your deck in any order$/;
  const greedy = /^put target (.+) and target (.+) from your graveyard on (?:the )?(top|bottom) of your deck in any order$/;
  const cap = rx => { const m = LINE.match(rx); return m && [m[1], m[2], m[3]]; };
  assert.deepEqual(cap(lazy), ["Runeblade attack action card", "Runeblade non-attack action card", "top"]);
  assert.deepEqual(cap(greedy), cap(lazy),
    "they differ on this card now, so the quantifier IS load-bearing — say so above");
  /* WHERE THEY DO PART, BOTH STILL REFUSE. A three-target clause splits
     differently under each, and `pickSubject` cannot read either compound —
     which is what keeps an unreadable third target out (v2.29). */
  const three = "put target A and target B and target C from your graveyard on top of your deck in any order";
  assert.notDeepEqual(three.match(lazy)[1], three.match(greedy)[1],
    "fixture: a three-target clause is where the quantifiers disagree");
  assert.equal(P.classifyClause(three), null, "and the clause refuses either way");
});

test("a `filters` prompt survives the wire, which is what the bump is ABOUT", () => {
  /* `WIRE_V` went 11 -> 12 because the live `prompt` gained a field and
     `hash` fingerprints the whole rules state — so a v11 peer and a v12 peer
     hash differently the moment such a sheet opens, and `diffPaths` names
     `/prompt/filters`, a field neither of them can fix (v4.26, v4.56).

     THIS ASSERTS THE OTHER HALF: that the field really does ride. A bump for a
     field the wire drops would be a version number with nothing behind it. */
  const W = require("../engine/wire.js");
  assert.equal(W.WIRE_V, 12, "the bump moved — say what changed in wire.js's header");
  const g = H.state({grave: [RATK("a1"), RNON("n1")], res: 9, ap: 1}, {}, {actor: 0, turn: 3});
  g.prompt = sheet([RATK("a1"), RNON("n1")]);
  assert.ok(g.prompt && g.prompt.filters, "fixture: the sheet carries the field");
  /* `decode` ANSWERS THE GAME, not a wrapper — checked rather than assumed
     (v4.09), because a wrapper key would make the assertion below read a
     `filters` that is simply undefined on both sides. */
  const back = W.decode(W.encode(g));
  assert.ok(back && back.sides, "decode's shape moved — re-anchor this drill");
  assert.deepEqual(back.prompt.filters, FILT,
    "`filters` did not survive the round trip, so the sheet a peer rebuilds "
    + "cannot say \"one of each\" and Confirm lights on two attacks");
  assert.equal(W.hash(back), W.hash(g),
    "the fingerprint moved across a round trip — every action would read as a desync");
});

test("the matcher agrees with brute force on EVERY small case", () => {
  /* THE ONE PIECE OF REAL ALGORITHM THIS VERSION ADDS, so it is checked
     against the definition rather than against two cards. `promptMatchSet`
     asks whether every filter can be given a DISTINCT card; brute force
     enumerates the assignments. Exhaustive over 1..3 filters and 0..4 cards
     and every possible matches-matrix between them — deterministic, because a
     randomised property test is not reproducible and this project's drills
     are (v2.26).

     THE MATRIX IS EXPRESSED THROUGH A REAL FILTER, not a stub: `promptFilter`
     reads `name` as a REGEX, so an alternation names exactly the set of cards
     a row matches. That keeps the drill driving the engine's own matcher
     (v3.56: ask the function that holds the reader) instead of a copy. */
  const cards = n => Array.from({length: n}, (_, i) => card("c" + i));
  const rowFilter = row => ({name: row.length ? "^(" + row.map(i => "c" + i).join("|") + ")$" : "^$"});
  const brute = (ok, n) => {
    const used = new Array(n).fill(false);
    const go = fi => {
      if(fi === ok.length) return true;
      for(const ci of ok[fi]){ if(used[ci]) continue; used[ci] = true;
        if(go(fi + 1)) return true; used[ci] = false; }
      return false;
    };
    return go(0);
  };
  let cases = 0, trues = 0;
  for(let nF = 1; nF <= 3; nF++) for(let nC = 0; nC <= 4; nC++){
    const cs = cards(nC);
    for(let mask = 0; mask < (1 << (nF * nC)); mask++){
      const ok = [];
      for(let f = 0; f < nF; f++){
        const row = [];
        for(let c = 0; c < nC; c++) if(mask & (1 << (f * nC + c))) row.push(c);
        ok.push(row);
      }
      const want = brute(ok, nC);
      const got = PM.promptMatchSet(cs, ok.map(rowFilter));
      assert.equal(got, want,
        "filters " + JSON.stringify(ok) + " over " + nC + " cards: got " + got + ", want " + want);
      cases++; if(want) trues++;
    }
  }
  /* BOTH ANSWERS ARE EXERCISED, or the drill passes by only ever seeing one
     (v3.98: ask for the refusal too). */
  assert.ok(cases > 5000, "only " + cases + " cases — the enumeration collapsed");
  assert.ok(trues > cases / 10 && trues < cases * 9 / 10,
    trues + " of " + cases + " answered TRUE — one branch is barely reached");
});

test("`autoAnswer` ANSWERS a multi-target sheet — a refusal is a policy bug", {skip}, () => {
  /* `sparring.act` hands a live prompt to `judge.autoAnswer`, and its pick
     branch took the first `min` cards — which on this sheet can be two
     Runeblade ATTACKS. `judge.legal` then refuses `promptConfirm`, and a
     refusal is ALWAYS a bug in the policy by `sparring.js`'s own contract;
     proposed again every tick it is v4.54's livelock.

     LATENT, AND THAT IS WHY IT HAD TO BE READ RATHER THAN COUNTED (v3.50):
     `defaultPicks` never wears the Crown, so no driven game opens this sheet
     and the ladder reports 0 refusals either way.

     THE FIXTURE PUTS THE TWO ATTACKS FIRST, because with one of each in card
     order the old branch happened to answer correctly — a fixture that cannot
     express the bug proves nothing (v3.62). */
  let s = J.reduce(board([ATK1(), ATK2(), NON1()]), ACT, 0).state;
  assert.ok(s.prompt, "no sheet opened");
  const names = s.prompt.cards.map(c => c.name);
  assert.deepEqual(names.slice(0, 2).sort(), ["Amplify the Arknight", "Arcanic Shockwave"],
    "fixture: the two attacks really are the first two candidates");
  for(let i = 0; i < 6 && s.prompt; i++){
    const a = J.autoAnswer(s);
    assert.ok(a, "the policy has no answer for its own sheet — that is a livelock");
    assert.equal(J.legal(s, a, s.prompt.side || 0), null,
      "the policy proposed an illegal action: " + JSON.stringify(a));
    s = J.reduce(s, a, s.prompt.side || 0).state;
  }
  assert.equal(s.prompt, null, "the sheet never resolved");
  /* AND THE ANSWER IS LEGAL BY THE CARD, not merely accepted: one of each. */
  const top = s.sides[0].deck.slice(0, 2).map(c => c.name);
  assert.ok(top.indexOf("Malefic Incantation") >= 0,
    "the policy put back two attacks — the printed second target is deleted: " + top.join(", "));
});
