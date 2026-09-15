/* ============================================================
   CHI — A RESOURCE THAT PAYS FOR MORE THAN A RESOURCE (v4.54)

   THE PRINTING SETTLED IT, THIRTEENTH TIME, and upstream's own keyword
   dictionary could not: `csvs/english/keyword.csv` carries a `Transcend`
   row with an EMPTY description, exactly as `Retrieve`'s did (v3.54). The
   two card faces carry the whole mechanic between them:

     A Drop in the Ocean  "…**transcend**. (Put this into its owner's hand
                           FLIPPED.)"
     Inner Chi            "({c} can pay for {c} and/or {r} costs.)"
                          `Mystic Resource - Chi`, pitch THREE CHI

   And the DATABASE says those two are one card: `Inner Chi`'s printings
   are the `_BACK` images of exactly the printing ids the five Legendary
   Mystic instants carry — SEN031..SEN035 are Enigma's five.

   WHAT WAS WRONG, IN THREE PLACES AT ONCE:

     1. the PAYLOAD had no reader. "Create a Spectral Shield token WITH a
        +1{p} counter" — the token matcher's tail alternation had no
        ` with`, so the clause matched NOTHING, `parseHeroPower` refused
        the line, and `build.js` built her NO powCard: the ability could
        not be offered on either board. It was the LAST unread hero clause
        in the pool (measured: the only other two are printed ability
        NAMES, which v3.86 annotates rather than suppresses).

     2. the COST read ZERO. `parseHeroPower` counts a digit else `{r}`
        pips, and `{c}{c}{c}` has neither — so fixing (1) alone would have
        SHIPPED a free Spectral Shield every turn, which is v2.04's
        free-ability bug arriving through the door a fix opened.

     3. CHI WAS INDISTINGUISHABLE FROM A RESOURCE. Read as three ordinary
        points her ability is "pitch any blue card" and the transcend loop
        her deck is built around is decoration — STRONGER than printed,
        the direction that steals games and the one the one-sided fairness
        sweep is built not to look in.

   AND NO TOOL HERE COULD SEE ANY OF IT. The audit reads a hero through
   `analyzeHero`, which reported the clause unread and nothing more; the
   sweep compares a card against its own printing and has no model of a
   resource type; and the three are only visible together, because each
   one alone hides the next.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const H = require(path.join(ROOT, "test", "helpers", "judged.js"));
const P = require(path.join(ROOT, "engine", "parser.js"));
const J = require(path.join(ROOT, "engine", "judge.js"));
const B = require(path.join(ROOT, "engine", "build.js"));
const G = require(path.join(ROOT, "engine", "game.js"));
const RNG = require(path.join(ROOT, "engine", "rng.js"));
const C = require(path.join(ROOT, "engine", "cards.js"));
const {loadData} = require(path.join(ROOT, "test", "helpers", "extract.js"));

const pool = require(path.join(ROOT, "data", "pool.json"));
const rec = r => ({name: r.name, pitch: r.pitch === "" || r.pitch == null ? 0 : +r.pitch,
                   tt: r.type_text, ty: r.types || [], kw: r.card_keywords || [],
                   tx: r.functional_text_plain || r.functional_text || ""});

const W = loadData();
function enigma(seed){
  H.db();
  const h = W.HEROES.find(x => x.k === "enigma");
  return B.buildSide(h, G.parseDeck(W.DECKS.enigma), H.db(), {},
                     RNG.make(seed || "chi"), {n: 0}).b;
}
const acting = g => Object.assign({}, g, {phase: "action", step: "layer",
                                          priority: 0, passed: [], stack: []});

/* ---- 1. WHAT A CHI IS, AND WHAT IT IS NOT --------------------------- */

test("a Chi is read off the STRUCTURED TYPE, never the name", () => {
  H.db();
  const chi = H.card("Inner Chi", 3);
  assert.equal(P.chiValue(chi), 3, "Inner Chi pitches for three Chi");
  /* THE NEAR-MISS IS A CARD IN HER OWN DECK, which is rarer and better
     than a synthetic (v4.18). Measured over the LIVE database: SIX
     records have "Chi" in the NAME and are not typed Chi — the Tenets —
     and Second Tenet of Chi: Wind is decked here. A name scan hands her
     three Chi for pitching an attack; v4.25's "Lightning Fusion" falling
     back to "lightning", on a card the drills already deal. */
  const tenet = H.card("Second Tenet of Chi: Wind", 3);
  assert.equal(tenet.pitch, 3, "the near-miss pitches for the same 3 — or it cannot tell the readings apart");
  assert.ok(/chi/i.test(tenet.name), "…and its NAME contains Chi");
  assert.equal(P.chiValue(tenet), 0, "a card merely NAMED for Chi is not a Chi");
});

test("the printed pitch is READ, not hardcoded at three", () => {
  /* She is the pool's only Chi and it prints 3, so a hardcoded 3 is
     SILENT against every real fixture (v3.32, twelfth outing). */
  assert.equal(P.chiValue({name: "Lesser Chi", pitch: 2, ty: ["Mystic", "Resource", "Chi"]}), 2);
  assert.equal(P.chiValue({name: "No Chi", pitch: 2, ty: ["Mystic", "Resource"]}), 0);
  assert.equal(P.chiValue(null), 0);
});

test("chiSum, chiFloating and chiCeiling — the three derived numbers", () => {
  H.db();
  const chi  = Object.assign({}, H.card("Inner Chi", 3), {uid: 1});
  const blue = Object.assign({}, H.card("Unmovable", 3), {uid: 2});
  assert.equal(P.chiSum([chi, blue]), 3);
  /* DERIVED, NEVER BANKED (v2.23's runechants, v2.74's frostbite,
     v4.34's ward, and the `sd.rune` field v3.82 had to retire). There is
     no `sd.chi`: the pool is one number and this says how much of it is
     Chi, off the PITCH ZONE — which CR 4.4.3c empties at end of turn, so
     nothing has to expire it. */
  assert.equal(P.chiFloating({res: 3, pitch: [chi]}), 3);
  assert.equal(P.chiFloating({res: 3, pitch: [blue]}), 0);
  /* SPEND NON-CHI FIRST, which is weakly dominant for the controller and
     therefore a measurement rather than a judgement (v4.23's reprieve).
     Pitch 3+3 = 6 raised, 3 spent: the Chi is what is left. */
  assert.equal(P.chiFloating({res: 3, pitch: [chi, blue]}), 3);
  assert.equal(P.chiFloating({res: 1, pitch: [chi]}), 1, "and never more than the pool holds");
  /* THE CEILING IS `payCeiling`'s TWIN. A seat cannot pre-pitch (the
     recorded ruling is that the pool is filled only when a cost demands
     it), so refusing on the FLOATING number alone makes a {c} cost
     unpayable by construction rather than merely hard. */
  assert.equal(P.chiCeiling({res: 0, pitch: [], hand: [chi, blue]}, null), 3);
  assert.equal(P.chiCeiling({res: 3, pitch: [chi], hand: [chi]}, null), 6);
  assert.equal(P.chiCeiling({res: 0, pitch: [], hand: [chi]}, chi), 0,
    "a card never pitches for itself");
  assert.equal(P.chiFloating(null), 0);
  assert.equal(P.chiCeiling(null, null), 0);
});

/* ---- 2. THE COST READ ----------------------------------------------- */

test("parseHeroPower counts {c} pips, into the cost AND into `chi`", () => {
  const c3 = P.parseHeroPower("Once per Turn Instant - {c}{c}{c}: Draw a card.", false);
  assert.equal(c3.cost, 3, "three Chi really is three points out of the pool");
  assert.equal(c3.chi, 3, "…and at least three of them must BE Chi");
  const c1 = P.parseHeroPower("Instant - {c}: Draw a card.", false);
  assert.equal(c1.cost, 1);
  assert.equal(c1.chi, 1, "the count is read, not hardcoded at three");
  /* OPT-IN (v3.58): a key present on every ability would churn the drills
     that `deepEqual` this shape for no card that can read it. */
  const r3 = P.parseHeroPower("Once per Turn Instant - {r}{r}{r}: Draw a card.", false);
  assert.equal(r3.cost, 3);
  assert.ok(!("chi" in r3), "a resource cost carries no `chi` key at all");
});

test("all three powCard builders stamp `_chiCost`", () => {
  /* v3.63's rule, FIFTH outing — when you add a flag to one powCard
     builder, grep for the others. A Chi cost is ZONE-AGNOSTIC (it reads
     the side's pitch zone and hand, nothing about gear or the arena), so
     unlike `_selfBanish` and `_flipUp` it is safe in all three: a guard
     in two, a fix in one (v4.47's argument, same list). */
  const src = require("fs").readFileSync(path.join(ROOT, "engine", "build.js"), "utf8");
  assert.equal((src.match(/_chiCost:/g) || []).length, 3,
    "the hero builder, `boardPow` and `equipPiece` — a fourth route or a " +
    "dropped stamp is a deliberate edit");
  const b = enigma("stamp");
  assert.ok(b.HPOW, "she has a powCard at all now");
  assert.equal(b.HPOW._chiCost, 3);
  assert.equal(P.abChiCost(b.HPOW), 3, "and one reader answers for it");
  assert.equal(P.abChiCost({}), 0);
  assert.equal(P.abChiCost(null), 0);
});

/* ---- 3. THE PAYLOAD ------------------------------------------------- */

test("a token can be created WITH counters, and an unreadable kind refuses", () => {
  assert.deepEqual(P.classifyClause("create a spectral shield token with a +1{p} counter"),
    {status: "run", ops: [["token", "spectral shield", 1, "self",
                           {ctr: {kind: "pow", n: 1, label: "+1{p}"}}]]});
  /* BOTH NUMBERS OFF THE LINE. She prints ONE and is the pool's only
     record, so a hardcoded 1 is silent against every real fixture — the
     drill that sees it is synthetic (v3.32). */
  assert.deepEqual(P.classifyClause("create 2 spectral shield tokens with two +1{p} counters"),
    {status: "run", ops: [["token", "spectral shield", 2, "self",
                           {ctr: {kind: "pow", n: 2, label: "+1{p}"}}]]});
  /* READ WHOLE OR REFUSE (v2.29), exactly as the exposed-zone list beside
     it is. Widening the tail makes "token with <anything>" reach this
     rule for the FIRST time, so a counter clause the reader cannot read
     must take the clause back rather than mint a bare token and drop a
     printed value. `CTR_KINDS` is closed to counters something consumes
     (v3.55). */
  assert.equal(P.classifyClause("create a spectral shield token with a moonbeam counter"), null);
  /* AND THE KIND IS READ, NOT HARDCODED. Enigma prints `+1{p}` and is the
     pool's only record, so every REAL fixture agrees with a literal
     "pow" — the drill that separates them needs a second KNOWN kind,
     which only a synthetic can print (v3.32, and the sabotage that found
     this gap came back silent against the two rows above). */
  assert.deepEqual(P.classifyClause("create a golden cog token with a steam counter"),
    {status: "run", ops: [["token", "golden cog", 1, "self",
                           {ctr: {kind: "steam", n: 1, label: "steam"}}]]});
  assert.deepEqual(P.classifyClause("create a talishar token with three rust counters"),
    {status: "run", ops: [["token", "talishar", 1, "self",
                           {ctr: {kind: "rust", n: 3, label: "rust"}}]]});
  assert.equal(P.classifyClause("create a spectral shield token with a +1{p} token"), null);
  /* AND THE ORDINARY SHAPES ARE UNTOUCHED — the fifth slot is appended
     only when the card prints something for it. */
  assert.deepEqual(P.classifyClause("create a spectral shield token"),
    {status: "run", ops: [["token", "spectral shield", 1, "self"]]});
  assert.deepEqual(P.classifyClause(
      "create a frostbite token in an exposed head, chest, arms, or legs zone"),
    {status: "run", ops: [["token", "frostbite", 1, "foe", {zone: "exposed"}]]});
});

/* ---- 4. DRIVEN — THE ROUTE THAT DID NOT EXIST ----------------------- */

function board(o, seed){
  const b = enigma(seed || "drive");
  return {b, g: acting(H.state(Object.assign({ap: 1, hand: [], pitch: [], board: []}, o),
                               {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]}))};
}

test("three Chi buys a Spectral Shield carrying its printed counter", () => {
  H.db();
  const chi = Object.assign({}, H.card("Inner Chi", 3), {uid: 801});
  const {b, g} = board({res: 3, pitch: [chi]});
  const n = H.execute(g, b.HPOW, "hero", -1, {});
  const sd = n.sides[0];
  assert.equal((sd.board || []).length, 1);
  assert.equal(sd.board[0].card.name, "Spectral Shield");
  assert.equal(((sd.counters || {})[sd.board[0].uid] || {}).pow, 1,
    "the counter is the whole reason the clause needed a reader");
  assert.equal(sd.res, 0, "and the three points are spent");
});

test("the counter is an OVERRIDE, never an addition to the token's own", () => {
  /* LATENT AND MEASURED: no pool record creates a token that ALSO prints
     `ctrSelf` — Golden Cog prints one and nothing in the pool creates it
     — so this is drilled with a synthetic (v3.73). Added rather than
     overridden, a creator's counter would stack on top of the token's and
     a card would be stronger than either printing says. */
  H.db();
  const golden = H.card("Golden Cog", 0);
  assert.ok((P.fxParse(golden).ops || []).some(o => o[0] === "ctrSelf"),
    "the control: Golden Cog's OWN text prints a steam counter");
  const {g} = board({res: 9});
  const own = H.runOps(g, [["token", "golden cog", 1, "self"]], "t");
  const over = H.runOps(g, [["token", "golden cog", 1, "self",
                             {ctr: {kind: "pow", n: 1, label: "+1{p}"}}]], "t");
  const ctr = s => (s.sides[0].counters || {})[s.sides[0].board[0].uid] || {};
  assert.equal(ctr(own).steam, 1, "handed nothing, the token's own clause answers");
  assert.equal(ctr(over).pow, 1, "handed a spec, the creator's answers");
  assert.ok(!ctr(over).steam, "…and the token's own does NOT also fire");
});

/* ---- 5. THREE LEGALITIES, THREE LAYERS ------------------------------ */

test("plain resources buy nothing — and each layer refuses its own row", () => {
  H.db();
  const chi  = Object.assign({}, H.card("Inner Chi", 3), {uid: 801});
  const blue = Object.assign({}, H.card("Unmovable", 3), {uid: 802});

  /* (a) `execute` guards the charge, because `reduce` is fed by JSON off
     a wire (v2.04: an unpayable cost is INERT, never free). */
  { const {b, g} = board({res: 3, pitch: [blue]}, "guard");
    const n = H.execute(g, b.HPOW, "hero", -1, {});
    assert.equal((n.sides[0].board || []).length, 0, "nothing is minted");
    assert.equal(n.sides[0].res, 3, "and the pool is untouched"); }

  /* (b) `abCostWhy` refuses a seat that cannot REACH the Chi, before the
     payment sheet opens — one body, both boards (v3.99). */
  { const {g} = board({res: 0, hand: [blue]}, "reach");
    const why = String(J.legal(g, {t: "activate", uid: "hpow", from: "hero"}, 0) || "");
    assert.ok(/only a Chi pays a Chi cost/.test(why), why); }

  /* (c) AND THE ROW ONLY `payConfirm` CAN SEE: the cost IS covered in
     resources and is not covered in Chi. Both earlier layers pass it. */
  { const {g} = board({res: 0, hand: [chi, blue]}, "sel");
    const open = J.reduce(g, {t: "activate", uid: "hpow", from: "hero"}, 0).state;
    assert.equal(open.pending.need, 3, "the sheet opens, because a Chi is reachable");
    const pickBlue = J.reduce(open, {t: "paySel", uid: 802}, 0).state;
    assert.ok(/Chi short/.test(String(J.legal(pickBlue, {t: "payConfirm"}, 0) || "")),
      "pitch 3 covers the cost and covers no Chi");
    const out = J.reduce(pickBlue, {t: "payConfirm"}, 0);
    assert.ok(out.error, "and `reduce` agrees with `legal` (fuzz.test.js's property)");
    const pickChi = J.reduce(open, {t: "paySel", uid: 801}, 0).state;
    assert.equal(J.legal(pickChi, {t: "payConfirm"}, 0), null, "the Chi is accepted");
    const done = J.reduce(pickChi, {t: "payConfirm"}, 0).state;
    assert.equal(done.sides[0].board[0].card.name, "Spectral Shield"); }
});

test("the trainer asks the identical pair", () => {
  /* v3.01's shape is a rule that exists on ONE board, and this build
     creates three legalities at once — so the trainer's own copies are
     asserted rather than assumed. It calls the same parser readers, which
     is what keeps ONE reader of each question.

     THE REACH OF THIS SCAN IS STATED (v4.44). `Battle` is React closures
     inside `index.html`, so no drill in this project can DRIVE the
     trainer's `tryPlay` from Node — what a scan can honestly carry is
     that the call is present AND NOT NEUTERED. A bare name test cannot
     tell a live guard from `if(false && …)`, which keeps every name
     intact (v4.00, verbatim — and the sabotage that found this gap came
     back SILENT against exactly that shape). So the WHOLE CONDITIONAL is
     pinned, opening paren included: a neutered copy no longer matches. */
  const raw = require("fs").readFileSync(path.join(ROOT, "index.html"), "utf8");
  /* COMMENTS STRIPPED, with the stripper's control routed THROUGH the
     scan (v4.27, v4.32) — this project's own prose names the shapes it
     forbids, and a raw scan reports that sentence as the code. Built by
     concatenation, because written as a literal the control appears in
     THIS file rather than in the one being scanned. */
  const src = raw.split("\n").filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join("\n");
  const CONTROL = "if(_ch && DawnParser." + "chiCeiling(act(s), null) < _ch)";
  assert.ok(src.indexOf(CONTROL) >= 0,
    "tryPlay asks the Chi cost against the CEILING, live — a {c} cost is " +
    "unpayable by construction if it asks the floating pool instead");
  assert.ok(src.indexOf("DawnParser." + "abChiCost(card)") >= 0,
    "…of the ability it is about to offer");
  assert.ok(src.indexOf("if(_hv < _ch) return L(s,") >= 0,
    "and confirmPay refuses a selection that covers the cost and no Chi, live");
  assert.ok(src.indexOf("if(act(s).res>=cost && _chiShort<=0)") >= 0,
    "and the payment sheet opens for a Chi cost — asked of the resources " +
    "alone this LIVELOCKS, which is what one game in 630 did");
  assert.ok(src.indexOf("DawnParser." + "chiFloating(you(s))") >= 0
         && src.indexOf("DawnParser." + "chiSum(you(s).paySel") >= 0,
    "…out of the floating pool plus the selection");
  /* THE STRIPPER IS PROVED ALIVE, through the scan rather than beside it:
     this file's own prose says the forbidden phrase and must not be found
     in the stripped source of the OTHER file. */
  assert.ok(raw.indexOf("chiCeiling") >= 0, "the scan reaches the file at all");
});

/* ---- 6. THE POOL CENSUS, BOTH DIRECTIONS ---------------------------- */

test("the pool's Chi census — pinned both ways", () => {
  const printsC = pool.filter(r => /\{c\}/.test(r.functional_text_plain || r.functional_text || ""))
                      .map(r => r.name);
  assert.deepEqual([...new Set(printsC)], ["Enigma"],
    "exactly one record prices anything in Chi. A second is a deliberate edit");
  const typedChi = pool.filter(r => (r.types || []).indexOf("Chi") >= 0).map(r => r.name);
  assert.deepEqual([...new Set(typedChi)], ["Inner Chi"],
    "and exactly one record IS a Chi — the back face of the five Legendary " +
    "Mystic instants, which is why `transcend` is its only source");
  /* THE SOURCE IS REACHABLE, which is what makes the whole loop live
     rather than latent: five of her own cards print `transcend`, and the
     op has flipped a card to Inner Chi since it was written. */
  const trans = pool.filter(r => /\btranscend\b/i.test(r.functional_text_plain || r.functional_text || ""))
                    .filter(r => /instant/i.test(r.type_text || "")).map(r => r.name);
  assert.equal(new Set(trans).size, 5, "five Legendary Mystic instants transcend");
  assert.deepEqual(P.classifyClause("transcend"), {status: "run", ops: [["transcend"]]});
});

test("the pool's token-with-counters census — and the near-miss that is a different shape", () => {
  H.db();
  P.fxReset();
  const withCtr = [], withExtra = [];
  for(const r of pool){
    const fx = P.fxParse(rec(r));
    for(const o of (fx.ops || [])) if(o[0] === "token" && o[4]){
      withExtra.push(r.name);
      if(o[4].ctr) withCtr.push(r.name);
    }
  }
  /* A HERO POWCARD IS NOT A POOL CARD (v3.73, v4.50). Enigma's mint lives
     on the powCard `build.js` makes out of her printed line, so a census
     stopping at the pool sees none of it — which is why the drills above
     DRIVE her ability rather than reading a count here. */
  assert.deepEqual([...new Set(withCtr)], [],
    "no POOL record creates a token with counters; hers is on a powCard");
  assert.deepEqual([...new Set(withExtra)], ["Frost Spike"],
    "and the fifth slot's only pool claimant is still the exposed-zone placement");
  /* AND THE NEAR-MISS IS A DIFFERENT PRINTED SHAPE, already read: Spectral
     Manifestations says "create a Spectral Shield token, THEN if you
     control no other Illusionist auras, put three +1{p} counters on it" —
     a gated `ctrPut`, not a counter the creation carries. */
  const sm = P.fxParse(rec(pool.find(r => r.name === "Spectral Manifestations")));
  assert.equal(sm.tier, "full");
  assert.ok((sm.ops || []).some(o => o[0] === "token" && !o[4]),
    "its mint is a bare token and its counters are a separate clause");
  P.fxReset();
});

test("she was the LAST unread hero clause in the pool", () => {
  /* The other two `analyzeHero` reports are printed ability NAMES —
     Iyslander's "Essence of Ice" and Briar's "Essence of Earth and
     Lightning" — which v3.86 ANNOTATES rather than suppresses, because a
     wholly-bold line can be real rules text (Teklovossen prints
     "**Battleworn**"). Pinned as a SET so a hero clause going unread
     again fails here rather than being read as one of these two. */
  const A = require(path.join(ROOT, "tools", "audit.js"));
  const db = C.buildMaps(pool.filter(r => r && r.name).map(C.mapDbCard));
  const un = [];
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    const a = A.analyzeHero(C.resolveHero(db, d.hero), d.hero.name);
    for(const cl of a.clauses) if(!cl.covered) un.push(cl.t);
  }
  assert.deepEqual(un.sort(), ["Essence of Earth and Lightning", "Essence of Ice"]);
});

/* ---- 7. THE LIVELOCK THE LADDER FOUND -------------------------------- */

test("a seat rich in resources and short of Chi opens a PAYMENT, never a no-op", () => {
  /* AN ACTIVATION READS ITS COST THREE TIMES (v3.80) and a Chi cost adds a
     fourth question: `legal` asks whether the seat could RAISE the Chi,
     `execute` asks whether it is floating at the charge, and `doActivate`
     asks whether a payment must open at all. Asked only of the RESOURCES,
     the third disagrees with the first:

       legal      ceiling counts the hand  -> yes, activate
       doActivate acost > res is FALSE     -> no sheet
       execute    no floating Chi          -> refuses

     …and `sparring.act`, handed a legal action that changes nothing,
     proposes it again every tick. ONE GAME IN 630 SAT AT TURN 8 FOR 4,000
     STEPS, and `npm run play` is the only instrument here that could have
     seen it — every drill in this file passed. It is the `legal`/`reduce`
     agreement `fuzz.test.js` exists to hold. */
  H.db();
  const chi = Object.assign({}, H.card("Inner Chi", 3), {uid: 811});
  /* A SECOND CARD OF THE SAME PITCH, or neither half of this can be told
     apart from the engine doing nothing special (v3.26). `pitchPick` ranks
     on printed pitch then on power ASCENDING, and Unmovable is a pitch-3
     Defense Reaction with no power — so it ties the Chi on both keys and
     the uid breaks it. A fixture holding only the Chi is one where every
     wrong answer is also the right one. */
  const blue = Object.assign({}, H.card("Unmovable", 3), {uid: 810});
  const {b, g} = board({res: 3, hand: [blue, chi]}, "livelock");
  assert.equal(J.legal(g, {t: "activate", uid: "hpow", from: "hero"}, 0), null,
    "she can reach the Chi, so the activation is legal");
  const out = J.reduce(g, {t: "activate", uid: "hpow", from: "hero"}, 0);
  assert.ok(!out.error);
  const n = out.state;
  assert.ok(n.pending && n.pending.kind === "pay",
    "and it opens a PAYMENT — the resources are covered and the CHI is not");
  assert.equal(n.pending.need, 3);
  assert.equal((n.sides[0].board || []).length, 0, "nothing resolved yet");
  assert.equal(n.sides[0].res, 3, "and nothing was charged");

  /* AND THE SEAT CAN FINISH IT — pitch the Chi, confirm, resolve. Without
     this half the drill passes against an engine that opens a sheet
     nobody can answer, which is the livelock wearing a sheet. */
  /* AND THE BLUE ONE DOES NOT FINISH IT, which is the row only
     `payConfirm` can see: three pitched covers the COST and no Chi. */
  const wrong = J.reduce(n, {t: "paySel", uid: 810}, 0).state;
  assert.ok(/Chi short/.test(String(J.legal(wrong, {t: "payConfirm"}, 0) || "")));
  const sel = J.reduce(n, {t: "paySel", uid: 811}, 0).state;
  assert.equal(J.legal(sel, {t: "payConfirm"}, 0), null);
  const done = J.reduce(sel, {t: "payConfirm"}, 0).state;
  assert.equal(done.sides[0].board[0].card.name, "Spectral Shield");
  assert.equal(((done.sides[0].counters || {})[done.sides[0].board[0].uid] || {}).pow, 1);

  /* THE POLICY REACHES THE SAME PLACE, and that is the half `sparring.js`'s
     own contract is about: a refusal there is always a bug in that file.
     `judge.chiNeed` is how it asks without reading card text. */
  const POL = require(path.join(ROOT, "engine", "sparring.js"));
  const need = J.chiNeed(n, 0);
  assert.equal(need.short, 3);
  assert.deepEqual(need.uids, [811],
    "only the CHI is offered — the blue card beside it pitches for the same 3 " +
    "and pays none of it");
  assert.deepEqual(POL.act(n, 0), {t: "paySel", uid: 811},
    "the policy pitches the CHI rather than whatever pitches highest");

  /* AND THE CONFIRM GUARD HAS A ROW OF ITS OWN. Branch 1 covers every
     state the policy itself opened, so the `chi.short <= 0` half of the
     confirm test only bites where branch 1 finds NOTHING to select — a
     payment this policy did not open, which is the case `pitchPick`'s own
     note is about: a human taps a card and hands the seat over
     mid-decision. Without it the policy proposes `payConfirm`, `legal`
     refuses, and a refusal is always a bug in that file. */
  const {g: noChi} = board({res: 3, hand: [Object.assign({}, blue, {uid: 812})]}, "noChi");
  const opened = Object.assign({}, noChi, {
    pending: {kind: "pay", seat: 0, card: b.HPOW, from: "hero", need: 3, target: null}});
  assert.equal(J.chiNeed(opened, 0).short, 3, "still three Chi short");
  assert.deepEqual(J.chiNeed(opened, 0).uids, [], "…and nothing in hand pays it");
  assert.notDeepEqual(POL.act(opened, 0), {t: "payConfirm"},
    "so the policy must NOT confirm — `legal` would refuse it");
});

test("and the two other activation routes ask the same question", () => {
  /* v3.80's three cost readers, and this is the fourth — one body
     (`chiShort`) at all three sites that commit an ABILITY, so a route
     cannot be taught the resource half and not the Chi half. The hero
     branch is driven above; the gear and arena branches carry it as
     GUARDS, because no pool EQUIPMENT or arena permanent prints {c}
     (measured: one claimant in 797 records, and it is a hero). */
  const src = require("fs").readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8");
  assert.equal((src.match(/chiShort\(sd, ab\) > 0/g) || []).length, 3,
    "the hero, arena and gear ability branches — a fourth activation route " +
    "is a deliberate edit in both places (v4.47 pinned `abCostWhy`'s count " +
    "the same way)");
  assert.equal((src.match(/const chiShort =/g) || []).length, 1, "one body");
});

test("the route counter's phrase and the engine's are pinned together", () => {
  /* v3.81: a counter that spells the wrong word reports ZERO exactly as a
     missing feature does, and v4.46 found the sign flipped — `tap` reading
     335 firings of which every one was the end phase announcing an UNTAP.
     So the two spellings are pinned against each other rather than each
     being trusted on its own. */
  const fx = require("fs").readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const sp = require("fs").readFileSync(path.join(ROOT, "tools", "selfplay.js"), "utf8");
  assert.ok(fx.indexOf("${_chi} Chi spent — a Chi pays for Chi ") >= 0,
    "`execute` says which price was paid — a cost charged in silence is one " +
    "the player learns about by being refused (v4.46)");
  assert.ok(sp.indexOf('/: \\d+ Chi spent —/') >= 0,
    "and the counter spells the EVENT, not the word: the feed says " +
    "\"Inner Chi\" on every pitch and \"Spectral Shield\" on four cards' mints");
  /* DRIVEN, so the pin is not two strings agreeing with each other while
     neither reaches a game. */
  H.db();
  const chi = Object.assign({}, H.card("Inner Chi", 3), {uid: 821});
  const {b, g} = board({res: 3, pitch: [chi]}, "phrase");
  const n = H.execute(g, b.HPOW, "hero", -1, {});
  assert.ok((n.feed || []).some(l => /: \d+ Chi spent —/.test(l)),
    "the line the counter looks for is the line the engine prints");
});
