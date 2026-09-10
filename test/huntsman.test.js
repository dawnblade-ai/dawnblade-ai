/* ============================================================
   "YOU MAY CHOOSE TO DESTROY THIS AND …" (v4.37)

   > "When this hits a hero, YOU MAY CHOOSE TO DESTROY THIS AND mark
   >  them."                                — MARK OF THE HUNTSMAN ×2

   v3.93 built the destroy-as-a-cost verb for two records that print it
   across TWO clauses — a cost sentence and an "If you do" rider. This
   card prints the identical cost in ONE sentence, joined by AND, so the
   loose `mark` matcher claimed the whole payload and answered
   `[["mark",1]]`: the printed DESTROY dropped and the printed "you may"
   unrefusable.

   BOTH DIRECTIONS ARE WRONG AND ONLY ONE IS VISIBLE. Taking the mark
   without the destroy is STRONGER than printed; being unable to decline
   is WEAKER, which the one-sided fairness sweep is built not to see
   (v4.33's charge, one cost over). The card read `tier: full` throughout,
   because the clause WAS consumed — so no tool here could see either
   half, and 2512 drills stayed green with the destroy deleted.

   IT IS LIVE. Mark of the Huntsman ×2 is in Arakni's own gear, and it is
   the loop the deck is built around: the destroy is what puts a dagger in
   the graveyard for Pick Up the Point to `retrieve` (v3.54), and the mark
   is what Graphene Chelicera and Mark's own +1{p} condition read.

   FOUR THINGS THIS FILE HOLDS:

     the split      the printed destroy is carried, never read as payload
                    (v4.25's rule, one joiner over)
     the offer      a "you may" that cannot be refused is not a "you may"
     the subject    only the piece that HIT is offered — `offerPayCost`'s
                    `ok` predicate, which is what tells a self-watcher
                    from v3.93's Legs pieces
     the voice      four cost verbs, one `payVerb`, both answers
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const pool = require("../data/pool.json");
const rec = r => ({name: r.name, pitch: +(r.pitch || 0), tt: r.type_text, ty: r.types,
                   tx: r.functional_text || "", kw: r.card_keywords, cost: r.cost,
                   power: (r.power === "" || r.power == null ? null : +r.power),
                   def: (r.defense === "" || r.defense == null ? null : +r.defense)});

/* A SYNTHETIC WEAPON WITH A GIVEN ABILITY LINE. The pool prints this cost
   on exactly one card, so every near-miss below has to be built (v3.73). */
let synN = 0;
const syn = (tx, extra) => Object.assign({
  name: "Huntsman Probe " + (++synN), pitch: 0, cost: null, power: 1, def: null,
  tt: "Assassin Weapon - Dagger (1H)", ty: ["Assassin", "Weapon", "Dagger"], kw: [],
  tx: "**Once per Turn Action** - {r}: **Attack**\n\n" + tx}, extra || {});

/* ---- 1. THE READING ----------------------------------------------- */

test("the one-sentence form reads as `payCost`, and the destroy is carried", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Mark of the Huntsman", 0));
  assert.deepEqual(fx.payCost,
    {cost: 0, taps: false, destroySelf: true, ops: [["mark", 1]], trigger: "selfHitHero"});
  /* AND THE CLAUSE IS NO LONGER THE CARD'S OWN on-hit payload — that is
     the half that was firing free, so asserting the new field alone
     cannot see a reader that claims the clause twice. */
  assert.deepEqual(fx.onHitHero || [], [],
    "read as a plain on-hit payload the mark landed free and unrefusable");
  assert.equal(fx.tier, "full", "the tier cannot move — the clause was consumed either way");
  P.fxReset();
});

test("the payload is READ, not the `mark` she happens to print", () => {
  /* SHE PRINTS ONE PAYLOAD, so no pool fixture can tell a read payload
     from a hardcoded one (v3.32). A synthetic printing something else is
     the only thing that sees it. */
  P.fxReset();
  const a = P.fxParse(syn("When this hits a hero, you may choose to destroy this and draw a card."));
  assert.deepEqual(a.payCost.ops, [["draw", 1]]);
  const b = P.fxParse(syn("When this hits a hero, you may choose to destroy this and deal 2 damage to them."));
  assert.deepEqual(b.payCost.ops, [["dmg", 2]]);
  P.fxReset();
});

test('"choose to" is an OPTIONAL MIDDLE, not a second reader', () => {
  /* v3.79's rule. Measured below: no pool record prints the short form,
     so this moves nothing today and is right the day upstream levels it
     (v3.36 — the database prints both wordings at once). */
  P.fxReset();
  const long  = P.fxParse(syn("When this hits a hero, you may choose to destroy this and mark them."));
  const short = P.fxParse(syn("When this hits a hero, you may destroy this and mark them."));
  assert.deepEqual(short.payCost, long.payCost);
  P.fxReset();
});

test("MEASURED: the short form has no pool claimant, so its drill is synthetic", () => {
  const long  = pool.filter(r => /you may choose to destroy this and/i.test(r.functional_text || ""));
  const short = pool.filter(r => /you may destroy this and/i.test(r.functional_text || ""));
  assert.deepEqual([...new Set(long.map(r => r.name))], ["Mark of the Huntsman"]);
  assert.deepEqual([...new Set(short.map(r => r.name))], [],
    "and if one ever appears, the alternation above is what already reads it");
});

/* ---- 2. WHAT REFUSES ----------------------------------------------- */

test("THE TRIGGER VOCABULARY IS CLOSED — an unknown event leaves the card unclaimed", () => {
  /* The alternative is a piece destroyed by an event nobody built, which
     is the never-parse-ahead-of-wiring rule at its most literal. */
  P.fxReset();
  for(const trig of ["this defends", "you play an aura", "the sun rises"]){
    const fx = P.fxParse(syn("When " + trig + ", you may choose to destroy this and mark them."));
    assert.equal(fx.payCost, undefined, trig + " has no route, so nothing claims the clause");
  }
  P.fxReset();
});

test('a BARE "when this hits" refuses — an ally is an attack-target (v3.45)', () => {
  /* THREE HALVES, NOT TWO. "a hero" is part of the trigger: a bare
     "when this hits" fires on a hit at an ALLY, which is a different
     event, so it stays out of the vocabulary rather than being read as
     the hero form. The positive control sits beside it or a reader that
     refuses EVERYTHING passes this perfectly. */
  P.fxReset();
  assert.equal(P.fxParse(syn("When this hits, you may choose to destroy this and mark them.")).payCost,
    undefined, "the bare trigger is not in the vocabulary");
  assert.ok(P.fxParse(syn("When this hits a hero, you may choose to destroy this and mark them.")).payCost,
    "…and the hero form still reads");
  P.fxReset();
});

test("an UNREADABLE payload refuses, and so does a `noop` one", () => {
  /* v2.29 and v3.93's guard, mirrored: a cost with no reward is v2.04's
     free-ability rule read from the other end, and it matters most on
     this verb, where the price is a permanent rather than resources.
     `classifyClause("dominate")` answers a NOOP, whose `ops.length` is 1
     — so a length test alone destroys the piece for nothing (v3.93). */
  P.fxReset();
  assert.equal(P.classifyClause("dominate").status, "noop", "the premise, driven");
  assert.equal(P.fxParse(syn("When this hits a hero, you may choose to destroy this and dominate.")).payCost,
    undefined, "a noop rider is a cost with no reward");
  assert.equal(P.fxParse(syn("When this hits a hero, you may choose to destroy this and blorf the widget.")).payCost,
    undefined, "and an unreadable one refuses too");
  P.fxReset();
});

/* ---- 3. THE BLAST RADIUS, BOTH DIRECTIONS -------------------------- */

test("exactly one pool record emits the new trigger, and the siblings are unmoved", {skip}, () => {
  H.db();
  P.fxReset();
  const mine = [], sibs = {};
  for(const r of pool){
    const px = P.fxParse(rec(r)).payCost;
    if(!px) continue;
    if(px.trigger === "selfHitHero") mine.push(r.name);
    else (sibs[px.trigger] = sibs[px.trigger] || new Set()).add(r.name);
  }
  assert.deepEqual([...new Set(mine)], ["Mark of the Huntsman"]);
  /* PINNED BOTH SIDES (v4.17): pinning the new trigger alone cannot see a
     record LEAVING one of v3.93's, which is exactly what a widened anchor
     would do. */
  assert.deepEqual(Object.keys(sibs).sort(),
    ["defends", "discardRandom", "playAura", "weaponHit"]);
  assert.deepEqual([...sibs.discardRandom], ["Beaten Trackers"]);
  assert.deepEqual([...sibs.weaponHit],     ["Refraction Bolters"]);
  assert.deepEqual([...sibs.playAura],      ["Magmatic Carapace"]);
  assert.deepEqual([...sibs.defends],       ["Brothers in Arms"]);
  P.fxReset();
});

/* ---- 4. DRIVEN ----------------------------------------------------- */

const mark = uid => Object.assign({}, H.card("Mark of the Huntsman", 0), {uid});
const other = uid => Object.assign({}, H.card("Mark of the Huntsman", 0), {uid});

function swung(o){
  o = o || {};
  const gear = o.gear || [mark(900)];
  const g = H.state({gear, res: 9, ap: 1, hand: []},
                    {hp: 20, hand: o.foeHand || []},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, g.sides[0].gear[0], "weapon", 0, {});
  return J.withEffects(n, (fx, s) => fx.resolveStack(s));
}
const answer = (g, choice) => {
  const r = J.withEffects(g, (fx, m) => fx.applyAnswer(m, PM.promptChoose(m.prompt, choice)));
  return r.game || r;
};

test("DRIVEN: the sheet is OFFERED rather than the mark taken", {skip}, () => {
  H.db();
  const out = swung();
  /* AN EXPLICIT `false` IS NOT `undefined` (v3.85). `makeSide` defaults
     the field, so asserting on absence would pass against an engine that
     had never written it either way. */
  assert.equal(out.sides[1].marked, false,
    "nothing is marked until somebody answers — this is the whole defect");
  assert.ok(out.prompt, "and a sheet is open");
  assert.equal(out.prompt.tag, "pay");
  assert.equal(out.prompt.src, "Mark of the Huntsman");
  assert.equal(out.prompt.destroyUid, 900, "the price is the piece itself");
});

test("DRIVEN: BOTH ANSWERS — pay marks and destroys, decline does neither", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A route that refuses
     everything passes the decline half perfectly. */
  H.db();
  const yes = answer(swung(), "pay");
  assert.equal(yes.sides[1].marked, true, "the mark lands");
  assert.equal(yes.sides[0].gear[0].destroyed, true, "and the printed price is paid");

  const no = answer(swung(), "decline");
  assert.equal(no.sides[1].marked, false, "declining marks nobody");
  assert.ok(!no.sides[0].gear[0].destroyed, "…and keeps the dagger");
});

test("DRIVEN: a fully blocked swing offers nothing (CR 7.5.5)", {skip}, () => {
  /* Prevented is not dealt, so it did not HIT. `heroHit` is the gate and
     it is the caller's answer on both boards. */
  H.db();
  const dagger = mark(900);
  const g = H.state({gear: [dagger], res: 9, ap: 1, hand: []},
                    {hp: 20, hand: [], blockH: []},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, g.sides[0].gear[0], "weapon", 0, {});
  /* the dagger prints 1, so one point of defence takes it to nothing */
  const walled = J.withEffects({...n, pend: {...n.pend, total: 0}},
    (fx, s) => fx.linkPayload(s, {total: 0, heroHit: false}));
  const out = walled.game || walled;
  assert.equal((out.promptQ || []).length, 0, "no sheet — nothing hit");
  assert.equal(out.sides[1].marked, false);
});

test("DRIVEN: a hit on an ALLY offers nothing — the third half (v4.16)", {skip}, () => {
  /* `heroHit` false with damage DEALT is the case a two-row drill cannot
     see, and it is the one the printed "a hero" exists for. */
  H.db();
  const dagger = mark(900);
  const g = H.state({gear: [dagger], res: 9, ap: 1, hand: []}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, g.sides[0].gear[0], "weapon", 0, {});
  const ally = J.withEffects(n, (fx, s) => fx.linkPayload(s, {total: 1, heroHit: false}));
  const hero = J.withEffects(n, (fx, s) => fx.linkPayload(s, {total: 1, heroHit: true}));
  assert.equal(((ally.game || ally).promptQ || []).length, 0, "an ally hit is not a hero hit");
  assert.equal(((hero.game || hero).promptQ || []).length, 1, "…and a hero hit is");
});

test("DRIVEN: only the piece that HIT is offered", {skip}, () => {
  /* THE LOAD-BEARING HALF. `offerPayCost` scans every watcher in the gear
     zone and the arena; without `ok`, a second Mark of the Huntsman that
     did nothing would be offered its own destroy off somebody else's hit.
     That is the whole difference between this trigger and v3.93's two,
     whose watchers genuinely are not the resolving card. */
  H.db();
  const out = swung({gear: [mark(900), other(901)]});
  const sheets = out.prompt ? [out.prompt, ...(out.promptQ || [])] : (out.promptQ || []);
  assert.equal(sheets.length, 1, "one sheet, not two");
  assert.equal(sheets[0].destroyUid, 900, "and it is the dagger that swung");
});

test("DRIVEN AT THE TABLE TOO — one body, both boards", {skip}, () => {
  /* v3.01's shape is the recurring defect in exactly this area, and
     `resolveStack` is the TRAINER's path: judge never calls it. The offer
     lives in `linkPayload`, which both boards share, so this asserts the
     shared body rather than assuming it. */
  H.db();
  const dagger = mark(900);
  const g = H.state({gear: [dagger], res: 9, ap: 1, hand: []}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, g.sides[0].gear[0], "weapon", 0, {});
  const out = J.withEffects(n, (fx, s) => fx.linkPayload(s, {total: 1, heroHit: true}));
  const q = ((out.game || out).promptQ || []);
  assert.equal(q.length, 1);
  assert.equal(q[0].destroyUid, 900);
});

/* ---- 5. THE POLICY, AND THE FEED'S FOUR VERBS ---------------------- */

test("the seat DECLINES, and that is v4.24's standing rule rather than an accident", {skip}, () => {
  /* A PRICE THE POLICY CANNOT WEIGH IS NOT NO PRICE. `sparring.js` reads
     no card text, so it cannot know that marking is Arakni's whole deck —
     and declining can never make the seat stronger than printed. Stated
     with its number rather than left as a surprise: the mark from this
     card fires zero times in self-play, and Prey Spotters is the route
     that still reaches it. */
  H.db();
  const out = swung();
  assert.equal(E.payPolicy(out.prompt, out.sides[0]), false);
});

test("FOUR COST VERBS, ONE `payVerb`, BOTH ANSWERS", () => {
  /* v4.24 named the rule — "a cost that is not resources must not say
     declined to pay 0" — and fixed ONE member of the family, leaving the
     destroy and the hero-tap saying exactly that on three live pool
     records. And the ACCEPT line had the same hole, which only asking
     both halves finds (v3.98).

     THE CENSUS IS `effects.payPolicy`'s OWN, one function over: it has
     enumerated all four since v4.24 (`otherPrice`). Pinned as a SET so a
     fifth verb is a deliberate edit in both places. */
  const specs = {
    res:     {tag: "pay", side: 0, src: "Toll", cost: 2},
    tapPerm: {tag: "pay", side: 0, src: "Carapace", cost: 1, taps: true, tapUid: 7},
    tapHero: {tag: "pay", side: 0, src: "Turn to Mindfire", cost: 0, tapHero: true},
    destroy: {tag: "pay", side: 0, src: "Beaten Trackers", cost: 0, destroyUid: 7},
    counter: {tag: "pay", side: 0, src: "Hyper Driver", cost: 0,
              spendCtr: {uid: 7, kind: "steam", n: 1}}
  };
  const say = (sp, choice) => {
    const p = PM.promptChoose(PM.buildPrompt({sides: [{res: 9}, {res: 9}]}, sp), choice);
    return PM.applyPrompt({sides: [{res: 9}, {res: 9}]}, p).msgs.join(" ");
  };
  for(const [k, sp] of Object.entries(specs)){
    for(const choice of ["pay", "decline"]){
      const line = say(sp, choice);
      if(k === "res" || k === "tapPerm"){
        assert.match(line, /pay(ed|s|) ?\d|paid \d|declined to pay \d/,
          k + "/" + choice + " genuinely IS a resource price and says the number");
      } else {
        assert.doesNotMatch(line, /pay 0|paid 0/,
          k + "/" + choice + ': a price that is not resources must not say "0"');
        assert.match(line, new RegExp(sp.src.split(" ")[0]),
          k + "/" + choice + " names what was actually spent or kept");
      }
    }
  }
  /* BOTH SIDES OF THE PARTITION. Pinning the non-resource verbs alone
     cannot see the resource line losing its number. */
  assert.match(say(specs.res, "pay"), /paid 2/);
  assert.match(say(specs.res, "decline"), /declined to pay 2/);
  assert.match(say(specs.tapPerm, "pay"), /paid 1 and tapped Carapace/);
});
