/* ============================================================
   SHUFFLE-AND-REDRAW — HOPE MERCHANT'S HOOD (v4.43)

   > "**Instant** - Destroy this: Shuffle any number of cards from your
   >  hand into your deck, then draw that many cards."    — SFA004, Dash · Fai

   THE COST HALF HAS BEEN BUILT FOR VERSIONS AND THE CARD READ `tier:
   none`. Handed the identical printed line with a payload that HAS a
   reader, `parseHeroPower` answers in full — `{cost:0, sd:true,
   kind:"instant"}` — so the destroy, the instant window and the powCard
   were every one of them waiting on this sentence. v3.47's shape, SIXTH
   outing: **reading the payload is what creates the route.** Until now
   `build.js` built the piece no powCard at all and neither board could
   offer it, which is the cheapest diagnostic in this project (v3.79).

   IT IS ONE PICK CARRYING A COUPLING, NOT THREE OPS. "That many" names
   the cards the player just chose, so the count is the ANSWER's own size;
   three ops would need `runOps` to thread "how many did the last one
   move" between them, which is state no op carries (v3.71, v3.88).

   AND THE ORDER IS THE CARD. `applyPrompt` moves the chosen cards to the
   FRONT of the deck, so without the shuffle the controller draws back
   exactly what they put down — a visible no-op wearing the appearance of
   a card that worked. Drawing before shuffling is the same bug spelled
   the other way. Both are drilled, because both leave the hand size and
   every zone count correct.

   THE POOL'S FIRST MULTI-CARD PICK, measured: every other `pickPrompt`
   in the parser is `max: 1`. `maxAll` is the printed "any number" and
   `buildPrompt` resolves it against the CANDIDATE POOL it has already
   filtered — never in the parse, where `fxParse`'s `name|pitch` memo
   would freeze a hand size (v3.39, v3.92).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P   = require("../engine/parser.js");
const PM  = require("../engine/prompts.js");
const B   = require("../engine/build.js");
const G   = require("../engine/game.js");
const CD  = require("../engine/cards.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H   = require("./helpers/judged.js");
const J   = H.J;
const {loadData} = require("./helpers/extract.js");
const fs = require("node:fs");
const path = require("node:path");

const skip = !H.hasDb() && "no cached card database";
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

const LINE = "shuffle any number of cards from your hand into your deck, then draw that many cards";

/* =====================================================================
   1. THE PARSE
   ===================================================================== */

test("the printed payload reads into ONE pick carrying the coupling", () => {
  assert.deepEqual(P.classifyClause(LINE), {status: "run", ops: [["pickPrompt", {
    zone: "hand", to: "deck", filter: {}, min: 0, maxAll: true, shuffleDraw: true,
    title: "Shuffle any number of cards back?",
    hint: "They go into your deck, it is shuffled, and you draw that many — " +
          "what you put back can come off the top again."}]]});
});

test("the SUBJECT goes through `pickSubject`, so a restriction is carried", () => {
  /* No vocabulary is invented (v3.53). The pool prints the unrestricted
     wording, so the restricted one is synthetic (v3.73) — and it is the
     only thing separating a subject that is READ from one hardcoded to
     the empty filter. */
  const spec = P.classifyClause(
    "shuffle any number of red cards from your hand into your deck, then draw that many cards"
  ).ops[0][1];
  assert.deepEqual(spec.filter, {pitch: 1},
    "a printed restriction that no op carries is v2.30's arrow buff on a sword");
  const bare = P.classifyClause(LINE).ops[0][1];
  assert.deepEqual(bare.filter, {}, "and the printed wording restricts nothing");
});

test("\"ANY NUMBER OF\" IS IN THE ANCHOR, because the subject reader refuses it", () => {
  /* MEASURED, and it is why the phrase cannot be left to `pickSubject`:
     handed the whole phrase that reader answers NULL, so the rule would
     simply refuse — and a rule that STRIPPED the phrase first would read
     "shuffle A CARD … then draw that many" as unbounded too, inventing a
     bound on the one card where the bound is the decision. */
  assert.equal(P.pickSubject("any number of cards"), null);
  assert.equal(P.classifyClause(
    "shuffle a card from your hand into your deck, then draw that many cards"), null,
    "a bounded wording refuses: weaker than printed and visible (v2.29)");
  assert.equal(P.classifyClause(
    "shuffle up to 2 cards from your hand into your deck, then draw that many cards"), null);
});

test("an UNREADABLE TAIL refuses the whole clause, rather than losing the shuffle", () => {
  /* THE SHAPE IS MATCHED WIDE AND THE TAIL IS A CLOSED READING. That is
     why this rule sits above the plain-draw rule rather than beside its
     `pickPrompt` family: without the refusal, the unanchored draw matcher
     claims a "…then draw TWO cards" variant and answers a bare
     [["draw",2]] — the payload with the card's entire printed cost gone
     (v3.00's unanchored match, v3.60's rule verbatim). */
  assert.equal(P.classifyClause(
    "shuffle any number of cards from your hand into your deck, then draw two cards"), null);
  assert.equal(P.classifyClause(
    "shuffle any number of cards from your hand into your deck, then gain 2 life"), null);
});

test("THE PREMISE THE PLACEMENT RESTS ON: the plain-draw rule cannot read \"that many\"", () => {
  /* This rule sits ABOVE the plain draw so its refusal means something.
     If somebody widens that pattern to accept "that many cards", the
     refusal above stops being a refusal and a variant silently loses its
     shuffle — so the premise is a drill rather than a comment (v4.13,
     v4.33). Both halves: the plain draw still reads its own wordings. */
  assert.equal(P.classifyClause("draw that many cards"), null);
  assert.deepEqual(P.classifyClause("draw a card").ops, [["draw", 1]]);
  assert.deepEqual(P.classifyClause("draw two cards").ops, [["draw", 2]]);
});

test("READING THE PAYLOAD IS WHAT CREATES THE ROUTE (v3.47, sixth outing)", {skip}, () => {
  const hood = H.card("Hope Merchant's Hood", 0);
  assert.ok(hood && /shuffle any number of cards/i.test(hood.tx),
    "the fixture must be the real record — check it by ASKING (v4.09)");
  assert.equal(P.fxParse(hood).tier, "full");

  const pw = P.parseHeroPower(hood.tx, true);
  assert.ok(pw, "`parseHeroPower` refuses a line whose payload has no reader");
  assert.equal(pw.kind, "instant", "the window is the printed one");
  assert.equal(pw.sd, true, "and the destroy is the cost");
  assert.equal(pw.cost, 0);
});

test("the COST half was never the blocker — the diagnostic that proves it", {skip}, () => {
  /* v3.79's cheapest diagnostic: hand the SAME printed cost a payload
     that has a reader and see whether the reader answers. It does, and
     identically — so nothing about the destroy, the prefix or the window
     was ever missing. */
  const probe = P.parseHeroPower("Instant - Destroy this: Draw a card.", true);
  const real  = P.parseHeroPower(H.card("Hope Merchant's Hood", 0).tx, true);
  for(const k of ["cost", "ga", "sd", "kind"])
    assert.deepEqual(real[k], probe[k], "the cost half answers the same either way: " + k);
});

test("the pool emits `shuffleDraw` from EXACTLY ONE record, and the census is both-sided", {skip}, () => {
  const pool = require("../data/pool.json");
  const recs = Array.isArray(pool) ? pool : Object.values(pool);
  const emit = [], mentions = [];
  for(const raw of recs){
    const c = H.card(raw.name, raw.pitch === "" || raw.pitch == null ? 0 : +raw.pitch)
           || H.card(raw.name);
    if(!c) continue;
    if(/shuffle/i.test(c.tx || "")) mentions.push(c.name);
    const walk = o => JSON.stringify(o || {}).includes('"shuffleDraw":true');
    const fx = P.fxParse(c);
    const pw = P.parseHeroPower(c.tx || "", true);
    if(walk(fx.ops) || (pw && walk(P.classifyClause(String(pw.eff || "").toLowerCase()))))
      emit.push(c.name);
  }
  assert.deepEqual([...new Set(emit)], ["Hope Merchant's Hood"],
    "one record, so every near-miss drill above is SYNTHETIC on purpose (v3.73)");
  /* THE OTHER SIDE OF THE CENSUS (v2.47). Two more records print the word
     and neither is this shape — both are deck SEARCHES whose "then
     shuffle" is the tail of a different mechanic, so the anchor must not
     reach them. Pinning only the emitters cannot see a new claimant. */
  assert.deepEqual([...new Set(mentions)].sort(),
    ["Arakni, Trap-Door", "Flamecall Awakening", "Hope Merchant's Hood"]);
});

test("it is the pool's FIRST multi-card pick — every other `pickPrompt` is max 1", () => {
  /* MEASURED FROM THE SOURCE, because the claim is about the parser's
     whole `pickPrompt` family rather than about one card. A second
     `maxAll` arriving is a deliberate edit here. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "parser.js"), "utf8");
  const maxes = (src.match(/max: *\d+/g) || []).map(s => s.replace(/\D/g, ""));
  assert.deepEqual([...new Set(maxes)], ["1"],
    "a numeric max other than 1 means a second multi-card pick exists");
  assert.equal((src.match(/maxAll: *true/g) || []).length, 1);
});

/* =====================================================================
   2. THE SHEET
   ===================================================================== */

const hand = n => Array.from({length: n}, (_, i) => ({uid: "h" + i, name: "Hand" + i,
  pitch: i === 0 ? 1 : 3, tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: [], gkw: []}));
const sheet = (cards, over) => PM.buildPrompt(
  {sides: [H.side({name: "You", hand: cards}, 0), H.side({name: "Them"}, 1)]},
  Object.assign({tag: "pick", src: "Hood", zone: "hand", to: "deck", filter: {},
                 min: 0, maxAll: true, shuffleDraw: true}, over || {}));

test("`maxAll` is resolved against the CANDIDATE POOL, not a number", () => {
  assert.equal(sheet(hand(2)).max, 2);
  assert.equal(sheet(hand(5)).max, 5,
    "a hand size baked into the parse freezes at whatever the first reader saw");
  /* THE CONTROL. An ordinary spec is unmoved, or this widened every pick
     in the engine rather than this one card (v3.33: measure both ways). */
  assert.equal(sheet(hand(5), {maxAll: false, max: 1}).max, 1);
  assert.equal(sheet(hand(5), {maxAll: false, max: undefined}).max, 1);
});

test("`maxAll` counts the FILTERED pool", () => {
  /* The restricted wording carries a filter, and "any number" means any
     number of the cards the card actually names — never of the hand. */
  const s = sheet(hand(5), {filter: {pitch: 1}});
  assert.equal(s.max, 1, "one red card in this hand");
  assert.equal(s.cards.length, 1);
});

test("A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34, seventh field)", () => {
  assert.equal(sheet(hand(3)).shuffleDraw, true,
    "dropped here, the sheet opens, the cards go back and the redraw never happens — " +
    "the player has thrown their hand away and destroyed the Hood for nothing");
  assert.equal(sheet(hand(3), {shuffleDraw: false}).shuffleDraw, false);
});

test("\"any number\" includes ZERO, so the sheet offers Choose none", () => {
  const s = sheet(hand(3));
  assert.equal(s.min, 0);
  assert.equal(s.optional, true, "refusing zero is a restriction the card does not print");
});

test("an empty hand opens no sheet at all", () => {
  assert.equal(sheet([]), null, "and the Hood is destroyed for nothing — the printed consequence");
});

/* =====================================================================
   3. DRIVEN — THE WHOLE ROUTE, AT THE TABLE
   ===================================================================== */

let _W = null;
const W = () => (_W || (_W = loadData()));

/* A seat wearing the Hood. The DEFAULT loadout does not equip it — Blade
   Beckoner Helm wins the head slot for both heroes that deck it — so the
   fixture picks it explicitly, which is exactly what a player does on the
   loadout screen. A drill against `buildSideDefault` would find no Hood
   and prove nothing (v3.50's coincident fixture, one zone over). */
function hooded(key, seed){
  const hero = W().HEROES.find(h => h.k === key);
  const d = G.parseDeck(W().DECKS[key]);
  const saSet = (hero.code || "").slice(0, 3) || null;
  const slots = B.gearSlots(d.gear.map(e => CD.resolveEntry(H.db(), e, saSet)));
  const hi = slots.find(s => /Hope Merchant/.test(s.c.name));
  assert.ok(hi, key + " does not deck the Hood — re-pick the fixture");
  return B.buildSide(hero, d, H.db(),
    {gearIdx: B.applyPick(slots, B.defaultPicks(slots), hi.i)},
    RNG.make(seed || "hood"), {n: 0}).b;
}

const plain = (p, n) => Array.from({length: n}, (_, i) => ({uid: p + i, name: p + i,
  pitch: 1, tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: [], gkw: []}));

/* Seat `who` activates the Hood; returns {g, pc}. */
function seated(o){
  o = o || {};
  const who = o.who || 0;
  const b = hooded(o.hero || "dash", o.seed);
  const pc = b.gear.find(x => /Hope Merchant/.test(x.name));
  const mine = {name: who === 0 ? "You" : "Dash", res: 9, ap: 3, gear: b.gear,
                hand: o.hand || plain("H", 4), deck: o.deck || plain("D", 6)};
  const other = {name: "Them", hp: 20, deck: plain("X", 4), hand: []};
  let g = H.state(who === 0 ? mine : other, who === 0 ? other : mine,
    {actor: who, turnPlayer: who, seed: o.seed || "hood",
     builds: who === 0 ? [b, {}] : [{}, b]});
  g = Object.assign({}, g, {phase: "action", step: "layer", priority: who, passed: [], turn: 4});
  return {g, pc, who};
}
function activate(o){
  const {g, pc, who} = seated(o);
  assert.equal(J.legal(g, {t: "activate", uid: pc.uid}, who), null,
    "the ability was refused: " + J.legal(g, {t: "activate", uid: pc.uid}, who));
  const r = J.reduce(g, {t: "activate", uid: pc.uid}, who);
  assert.equal(r.error, null);
  return {g: r.state, pc, who};
}
function answer(g, who, picks){
  for(const i of picks) g = J.reduce(g, {t: "promptSel", i}, who).state;
  return J.reduce(g, {t: "promptConfirm"}, who).state;
}

test("driven at the table: activate, shuffle three back, draw three", {skip}, () => {
  const a = activate({});
  assert.ok(a.g.prompt, "the sheet opened");
  assert.equal(a.g.prompt.max, 4, "any number of a four-card hand");
  assert.equal(a.g.prompt.shuffleDraw, true);

  const before = a.g.sides[0].deck.length, rngBefore = a.g.rng.n;
  const g = answer(a.g, 0, [0, 1, 2]);

  assert.equal(g.sides[0].hand.length, 4, "one kept plus three drawn — the hand size holds");
  assert.equal(g.sides[0].deck.length, before, "three in, three out");
  assert.ok(g.rng.n > rngBefore, "THE DECK WAS SHUFFLED — a dropped store repeats the next one");
  assert.equal(g.sides[0].gear.find(x => x.uid === a.pc.uid).destroyed, true,
    "'Destroy this' is the cost — collecting the redraw without paying it is the v2.04 bug");
  assert.deepEqual(INV.errors(g), []);
  assert.match(said(g), /3 cards back into your deck — shuffled/);
});

test("THE DECK IS REALLY SHUFFLED — the cards put back are not simply drawn again", {skip}, () => {
  /* `moveCards` puts the chosen cards at the FRONT of the deck, so with
     the shuffle dropped the controller draws back exactly what they put
     down, in the same order, and every zone count is still correct. That
     is a visible no-op wearing the appearance of a card that worked —
     which is why the assertion is on the ORDER rather than on the sizes. */
  const a = activate({hand: plain("H", 3), deck: plain("D", 20)});
  const put = [0, 1, 2].map(i => a.g.prompt.cards[i].name);
  const g = answer(a.g, 0, [0, 1, 2]);
  const drew = g.sides[0].hand.map(c => c.name);
  assert.notDeepEqual(drew, put,
    "drawn back in the order they were put down means nothing shuffled");
  assert.equal(g.sides[0].deck.length, 20);
  /* AND THE PILE IS THE SAME PILE. Shuffling must not conjure or lose a
     card — 23 cards were in the deck at the moment of the draw and 20 are
     left, with the other 3 in hand. */
  const all = [...g.sides[0].deck, ...g.sides[0].hand].map(c => c.name).sort();
  assert.equal(all.length, 23);
  assert.equal(new Set(all).size, 23, "no card is in two zones and none was minted");
});

test("WHAT WENT BACK CAN COME OUT AGAIN — the card's whole identity", {skip}, () => {
  /* With an EMPTY deck, shuffling three cards in and drawing three gives
     those same three cards back, freshly ordered. That is not a defect —
     it is what "shuffle into your deck, then draw that many" says, and it
     is the difference between this card and a cycle. */
  const a = activate({hand: plain("H", 3), deck: []});
  const g = answer(a.g, 0, [0, 1, 2]);
  assert.deepEqual(g.sides[0].hand.map(c => c.name).sort(), ["H0", "H1", "H2"]);
  assert.equal(g.sides[0].deck.length, 0);
  assert.deepEqual(INV.errors(g), []);
});

test("THE COUNT IS THE ANSWER'S, not a literal (v3.32)", {skip}, () => {
  /* The card prints no number at all — "that many" IS the count — so the
     only fixture that can tell a read count from a hardcoded 1 is two
     answers of different sizes. */
  const one = answer(activate({}).g, 0, [0]);
  assert.equal(one.sides[0].hand.length, 4, "one back, one drawn");
  assert.equal(one.sides[0].deck.length, 6);

  const three = answer(activate({}).g, 0, [0, 1, 2]);
  assert.equal(three.sides[0].hand.length, 4, "three back, three drawn");
  assert.equal(three.sides[0].deck.length, 6);
  assert.match(said(one), /1 card back into/,  "and the line agrees in number");
  assert.match(said(three), /3 cards back into/);
});

test("DECLINING shuffles nothing and draws nothing (v2.04)", {skip}, () => {
  const a = activate({});
  const deckBefore = a.g.sides[0].deck.map(c => c.name);
  const g = J.reduce(a.g, {t: "promptConfirm"}, 0).state;
  assert.deepEqual(g.sides[0].deck.map(c => c.name), deckBefore,
    "not even the shuffle — a cost that was not paid buys nothing");
  assert.equal(g.rng.n, a.g.rng.n, "and the seeded stream is untouched");
  assert.equal(g.sides[0].hand.length, 4, "the hand is exactly as it was");
  assert.equal(g.sides[0].gear.find(x => x.uid === a.pc.uid).destroyed, true,
    "the Hood is still spent — the cost was paid at activation, not at the answer");
});

test("IT IS THE ASKED SIDE'S DECK, not seat 0's (v3.46's borrowed seat)", {skip}, () => {
  const a = activate({who: 1});
  assert.ok(a.g.prompt, "the sheet opened for seat 1");
  assert.equal(a.g.prompt.side, 1);
  const rngBefore = a.g.rng.n;
  const g = answer(a.g, 1, [0, 1]);
  assert.equal(g.sides[1].hand.length, 4, "seat 1 drew");
  assert.equal(g.sides[1].deck.length, 6);
  assert.equal(g.sides[0].hand.length, 0, "seat 0 is untouched");
  assert.equal(g.sides[0].deck.length, 4);
  assert.ok(g.rng.n > rngBefore);
  assert.deepEqual(INV.errors(g), []);
  assert.match(said(g), /2 cards back into Dash's deck — shuffled/,
    "and a shared-feed line names the seat (v2.83, v4.22)");
});

test("the RNG is stored back — two shuffles in one game differ", {skip}, () => {
  /* rng.js's founding discipline, and the one thing a single-shuffle
     drill cannot see: with the store dropped, `rng.n` stalls and the NEXT
     shuffle in the match reproduces this one exactly. */
  let g = answer(activate({hand: plain("H", 4), deck: plain("D", 12)}).g, 0, [0, 1]);
  const first = g.sides[0].deck.map(c => c.name).join(",");
  const nAfter1 = g.rng.n;
  assert.ok(nAfter1 > 0);
  /* A SECOND shuffle of the same pile, same state, must land elsewhere. */
  const sh = RNG.shuffle(g.rng, g.sides[0].deck);
  assert.notEqual(sh.arr.map(c => c.name).join(","), first,
    "the same pile shuffled from the advanced stream must differ");
  assert.ok(sh.rng.n > nAfter1, "and `rng.n` only ever goes up");
});

test("the ROUTE COUNTER spells the ENGINE's own phrase (v3.81)", {skip}, () => {
  /* A counter that spells the wrong word reports ZERO exactly as a missing
     feature does — `death 0, gold 0` stood for three versions on that. So
     the two spellings are pinned against each other: a rewording of either
     breaks a drill rather than silently zeroing a count.

     THE NUMBER IS GENUINELY ZERO ON THE LADDER, and that is about the
     LOADOUT rather than about the route. Measured: the Hood prints 0
     defence and Blade Beckoner Helm prints 1, so `defaultPicks` — which
     reads no card text, by contract — takes the Helm in both lists that
     deck the Hood. A player picks it on the loadout screen; the drills
     above seat it explicitly. */
  const src = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  const rx = src.match(/if\((\/[^/]+\/)\.test\(line\)\) events\.push\(\["hood"/);
  assert.ok(rx, "the hood counter is gone from selfplay.js");
  const g = answer(activate({}).g, 0, [0, 1]);
  const line = g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || ""))
                     .find(l => new RegExp(rx[1].slice(1, -1)).test(l));
  assert.ok(line, "the counter's own regex matches no line the engine printed");
  assert.match(line, /shuffled/);
});

test("THE LOADOUT IS WHY THE COUNTER IS ZERO — measured, not assumed", {skip}, () => {
  /* The claim the counter's comment makes, as a drill. If a future
     `defaultPicks` starts choosing by text rather than by printed defence,
     this fails and the recorded reason has to be re-measured (v3.69). */
  for(const k of ["dash", "fai"]){
    const hero = W().HEROES.find(h => h.k === k);
    const d = G.parseDeck(W().DECKS[k]);
    const saSet = (hero.code || "").slice(0, 3) || null;
    const slots = B.gearSlots(d.gear.map(e => CD.resolveEntry(H.db(), e, saSet)));
    const picks = B.defaultPicks(slots);
    const heads = slots.filter(x => x.s.z === "head");
    const hood = heads.find(x => /Hope Merchant/.test(x.c.name));
    const won  = heads.find(x => picks.includes(x.i));
    assert.ok(hood && won, k + ": no head slot to compare");
    assert.equal(picks.includes(hood.i), false,
      k + ": the default loadout does NOT wear the Hood");
    assert.equal(hood.c.def || 0, 0, k + ": and the reason is the printed defence");
    assert.ok((won.c.def || 0) > (hood.c.def || 0),
      k + ": the piece that won the slot blocks for more");
  }
});

test("BOTH HEROES THAT DECK IT CAN REACH IT", {skip}, () => {
  /* Two live precons, measured — so this is not a latent route. Fai's
     loadout is a different shape from Dash's (two weapons, no Blossom),
     and the piece is a Head slot in both. */
  for(const k of ["dash", "fai"]){
    const b = hooded(k);
    const pc = b.gear.find(x => /Hope Merchant/.test(x.name));
    assert.ok(pc.powCard, k + " built no powCard");
    assert.equal(pc.powCard._instant, true, k + ": the window is the printed one");
    assert.equal(pc.powCard.sd, true, k + ": the destroy is the cost");
    assert.match(pc.powCard.tx, /shuffle any number of cards/i,
      k + ": the powCard carries the ability's WHOLE printed line (v2.34)");
  }
});
