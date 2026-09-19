/* ============================================================
   A DECK SEARCH IS THE SAME PICK OUT OF A HIDDEN, ORDERED ZONE (v4.58)

   > "When this attacks, if you've played another red card this turn, you may
   >  search your deck for a Phoenix Flame, reveal it, put it into your hand,
   >  then shuffle."                              — FLAMECALL AWAKENING, Fai's

   The GATE already read in full before this version — `cond: "red"` plus
   `onAtk` — so only the payload refused, which is v4.43's Hope Merchant's
   Hood shape exactly: reading one sentence is what creates the route.

   THE ZONE IS THE WHOLE OF WHAT MAKES IT A DIFFERENT MECHANIC. A graveyard
   is public and unordered; a deck is HIDDEN and ORDERED. Looking at it is
   the point of a search, and the printed SHUFFLE is what pays for having
   looked — without it the controller has learned their remaining deck order
   permanently, which is strictly stronger than printed in a game whose opt
   and `lookOrder` exist to manage exactly that (v3.72).

   SO `shuffleAfter` IS `shuffleDraw`'s SIBLING AND NOT A WIDENING OF IT. It
   differs on both axes that matter: it draws NOTHING (the found card is
   already on its way to hand, so a draw is a second card the line never
   grants) and it fires WHETHER OR NOT a card was taken (the sheet showed the
   controller their matching cards in deck order either way). Folded into the
   Hood's flag a search would hand out a free card AND let a decline keep the
   order it had just learned — wrong in both directions at once.

   AND THE REVEAL COST NOTHING TO BUILD. `applyPrompt` already names the
   moved card in `msgs`, and the feed is read by BOTH seats (v2.83) — which
   is what a printed reveal IS. A second line would be two records of one
   fact.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const PR = require("../engine/prompts.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");
const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  return j.cards || j;
})();

/* ---- 1. THE READER, AND WHAT IT REFUSES ------------------------------- */

test("the printed line reads, and the NAME keeps its capitalisation", () => {
  P.fxReset();
  const r = P.classifyClause(
    "you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle");
  assert.ok(r, "the printed clause must read");
  const spec = r.ops[0][1];
  assert.equal(r.ops[0][0], "pickPrompt");
  assert.equal(spec.zone, "deck", "the SOURCE zone is the deck, not the graveyard");
  assert.equal(spec.to, "hand");
  assert.equal(spec.shuffleAfter, true, "the printed shuffle is carried");
  assert.equal(spec.min, 0, "the printed `you may` is what makes it optional");
  assert.equal(spec.max, 1);
  /* `classifyClause` matches on the LOWERCASED clause, so the subject has to
     be recovered from the RAW one or a proper noun becomes a common one
     (v3.53). A name filter reading `^phoenix flame$` matches nothing. */
  assert.deepEqual(spec.filter, {name: "^Phoenix Flame$"});
  P.fxReset();
});

test("a printed `search` with no `you may` is MANDATORY", () => {
  P.fxReset();
  const r = P.classifyClause(
    "search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle");
  assert.equal(r.ops[0][1].min, 1,
    "no printed `you may` means no Choose-none button — the sheet is mandatory");
  P.fxReset();
});

test("READ WHOLE OR REFUSE — every near-miss disposition is refused", () => {
  /* v2.29. The DISPOSITION is in the anchor rather than stripped and
     defaulted, and the pool is why: the two records that print a deck search
     dispose of the found card DIFFERENTLY, so a reader that dropped the tail
     would send Trap-Door's FACE-DOWN BANISH to the hand. */
  P.fxReset();
  for(const tx of [
    "you may search your deck for a card, banish it face-down, then shuffle",
    "you may search your deck for a Phoenix Flame, put it into your hand",
    "you may search your deck for a Phoenix Flame, reveal it, put it into your hand",
    "you may search your deck for a Phoenix Flame, reveal it, then shuffle",
    "you may search your deck for a Phoenix Flame, reveal it, put it into your graveyard, then shuffle"
  ]) assert.equal(P.classifyClause(tx), null, "must refuse: " + tx);
  /* AND THE SHUFFLE IS THE ONE THAT MATTERS MOST, so it gets its own row:
     dropping it is the information the card is printed to destroy. */
  assert.equal(P.classifyClause(
    "you may search your deck for a Phoenix Flame, reveal it, put it into your hand"), null,
    "a search with no printed shuffle is a permanent read of the deck order");
  P.fxReset();
});

/* ---- 2. THE POOL, BOTH DIRECTIONS ------------------------------------ */

test("exactly TWO pool records print a deck search, and only one reads", () => {
  /* BOTH DIRECTIONS (v4.17): pinning the reader alone cannot see a record
     arriving, and pinning the refusal alone cannot see one leaving. */
  const searchers = new Map();
  for(const c of pool){
    const tx = c.functional_text || "";
    if(/search(?:ing)?\s+your\s+deck/i.test(tx) && !searchers.has(c.name))
      searchers.set(c.name, tx);
  }
  assert.deepEqual([...searchers.keys()].sort(),
    ["Arakni, Trap-Door", "Flamecall Awakening"]);
  /* AND TRAP-DOOR'S BLOCKER IS NAMED, not guessed. Half-building a
     disposition is worse than the honest gap (v3.23): its found card is
     BANISHED FACE-DOWN — hidden information — and a second printed sentence
     ("if it's a trap, you may play it this turn") hangs a reward off it. */
  assert.match(searchers.get("Arakni, Trap-Door"), /banish it face-down/i,
    "its disposition is a face-down banish, which this reader does not claim");
  assert.match(searchers.get("Arakni, Trap-Door"), /if it'?s a trap/i,
    "…and a rider on a second sentence, which is why it is recorded rather than half-built");
});

test("Flamecall Awakening reads in full, and the GATE was never the blocker", {skip}, () => {
  P.fxReset();
  const rec = pool.find(r => r.name === "Flamecall Awakening");
  const m = C.mapDbCard(rec);
  const fx = P.fxParse({name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
    tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx});
  assert.equal(fx.tier, "full", "the card moved part -> full");
  /* THE OP RIDES AS A GATED COND, WHICH IS THE CR-CORRECT LIST. On an ATTACK
     card `fx.conds` are evaluated at DECLARATION (v3.97), which is what
     CR 7.2 says about a when-this-attacks trigger. */
  assert.equal(fx.conds.length, 1);
  assert.equal(fx.conds[0].cond, "red", "the printed gate is the red-card history");
  assert.equal(fx.conds[0].op[0], "pickPrompt");
  assert.equal(fx.conds[0].op[1].zone, "deck");
  assert.deepEqual(fx.ops, [], "and nothing fires unconditionally");
  P.fxReset();
});

/* ---- 3. THE SPEC FIELD IS CARRIED, OR IT VANISHES (v2.34) ------------- */

test("`buildPrompt` carries `shuffleAfter`, and it is not `shuffleDraw`", () => {
  const g = H.side ? null : null;
  const spec = {tag: "pick", src: "Flamecall Awakening", side: 0, zone: "deck",
    to: "hand", filter: {name: "^Zed$"}, min: 0, max: 1, shuffleAfter: true};
  const game = {sides: [{deck: [{uid: 1, name: "Zed"}]}, {}], rng: {seed: "s", n: 0}};
  const live = PR.buildPrompt(game, spec);
  assert.ok(live, "the sheet must build");
  assert.equal(live.shuffleAfter, true,
    "dropped here the shuffle never happens while the feed says the card was found");
  assert.equal(live.shuffleDraw, false,
    "and it must NOT set the Hood's flag — that one draws what was put back");
  /* BOTH FLAGS EXIST AND ARE INDEPENDENT — and the Hood's sheet needs a
     CANDIDATE, because `buildPrompt` returns null on an empty pool and a
     null answers every field test vacuously (v3.98: ask for the refusal).
     My own first fixture handed it an empty hand and read `null !== false`. */
  const hoodGame = {sides: [{hand: [{uid: 7, name: "Any"}], deck: []}, {}],
                    rng: {seed: "s", n: 0}};
  const hood = PR.buildPrompt(hoodGame, {tag: "pick", src: "H", side: 0, zone: "hand",
    to: "deckBottom", min: 0, maxAll: true, shuffleDraw: true});
  assert.ok(hood, "the control sheet must build, or it proves nothing");
  assert.equal(hood.shuffleDraw, true);
  assert.equal(hood.shuffleAfter, false,
    "the Hood does NOT shuffle-after — it shuffles-and-draws, gated on what was picked");
});

test("no pool record sets BOTH shuffle flags", {skip}, () => {
  /* They are different mechanics and a record carrying both would draw a
     card for a search. Measured rather than assumed. */
  P.fxReset();
  let both = [];
  for(const c of pool){
    const m = C.mapDbCard(c);
    const fx = P.fxParse({name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
      tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx});
    const specs = [];
    const walk = o => { for(const op of (o || [])) if(op[0] === "pickPrompt") specs.push(op[1]); };
    walk(fx.ops); for(const c2 of (fx.conds || [])) walk([c2.op]);
    for(const s of specs) if(s.shuffleAfter && s.shuffleDraw) both.push(m.n);
  }
  assert.deepEqual(both, []);
  P.fxReset();
});

/* ---- 4. DRIVEN, THROUGH THE REAL ENTRY POINT ------------------------- */

const mk = (nm, pitch, uid) => {
  const r = pool.find(x => x.name === nm && (pitch == null || +x.pitch === pitch));
  assert.ok(r, "fixture card missing: " + nm);
  const m = C.mapDbCard(r);
  return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, life: m.hp,
          tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx, uid};
};
const R = (g, a, s) => {
  const o = J.reduce(g, a, s);
  assert.ok(!o.error, "reduce refused: " + o.error);
  return o.state;
};
const order = s => s.sides[0].deck.map(c => c.name[0] + c.uid).join(",");
const feed = s => (s.feed || []).map(f => (typeof f === "string" ? f : (f && f.t) || ""))
                                .filter(Boolean).join(" | ");
/* THE SHEET IS OPENED THE WAY A BOARD OPENS IT. `execute` queues at
   DECLARATION and returns without draining on the attacking path, so the
   drain is the caller's — judge's is at the damage step. Driving
   `J.openPrompt` here is that drain, not a shortcut around one. */
function openSheet(){
  P.fxReset();
  const flame = mk("Flamecall Awakening", 1, 900);
  const deck = [];
  for(let i = 0; i < 8; i++)
    deck.push(i % 3 === 1 ? mk("Phoenix Flame", null, 910 + i)
                          : mk("Brothers in Arms", 1 + (i % 3), 910 + i));
  const g = H.state({hand: [flame], deck, res: 9,
    hist: {red: 1, blue: 0, non: 0, atkNames: [], playTy: []}}, {},
    {turn: 3, actor: 0, seed: "searchseed"});
  const n = H.execute(g, flame, "hand", 0, {attacking: true, isAtk: true, target: "hero"});
  return {queued: (n.promptQ || []).length, game: J.openPrompt(n)};
}

test("DRIVEN: the sheet offers exactly the matching cards, and the deck is untouched", {skip}, () => {
  const {queued, game} = openSheet();
  assert.equal(queued, 1, "the spec is QUEUED at declaration, not opened there");
  assert.equal(game.prompt.tag, "pick");
  assert.deepEqual(game.prompt.cards.map(c => c.uid), [911, 914, 917],
    "the name filter admits the three Phoenix Flames and nothing else");
  assert.equal(game.prompt.min, 0, "optional, so the sheet has a Choose-none");
  assert.equal(game.sides[0].deck.length, 8, "and looking has moved nothing yet");
  assert.equal(game.rng.n, 0, "…nor consumed the seeded stream");
  P.fxReset();
});

test("DRIVEN: taking one moves it to HAND, shuffles, and draws nothing", {skip}, () => {
  const {game} = openSheet();
  const was = order(game);
  const take = R(R(game, {t: "promptSel", i: 0}, 0), {t: "promptConfirm"}, 0);
  assert.deepEqual(take.sides[0].hand.map(c => c.uid), [911],
    "the chosen card, and ONLY it — a draw here is a second card the line never grants");
  assert.equal(take.sides[0].deck.length, 7, "the deck is one shorter, never two");
  assert.notEqual(order(take), was, "and the remaining order is destroyed");
  assert.ok(take.rng.n > game.rng.n,
    "the seeded stream advanced — `rngShuffle` is pure and the store-back is the property");
  /* THE FEED IS THE REVEAL (v2.83): the card is NAMED, in a log both seats
     read, which is what the printed `reveal it` IS. */
  assert.match(feed(take), /Phoenix Flame → hand from deck/);
  assert.match(feed(take), /deck is shuffled/);
  P.fxReset();
});

test("DRIVEN: DECLINING still shuffles — the distinction from `shuffleDraw`", {skip}, () => {
  /* THIS IS THE ROW THAT BITES. `shuffleDraw` is gated on `picked.length`,
     and `applyPrompt`'s decline path returns BEFORE it sets `picked` — so a
     reader that keyed off the result would let a decline keep the deck order
     it had just been shown. The controller looked either way. */
  const {game} = openSheet();
  const was = order(game);
  const dec = R(R(game, {t: "promptDecline"}, 0), {t: "promptConfirm"}, 0);
  assert.deepEqual(dec.sides[0].hand.map(c => c.uid), [],
    "nothing was taken, so nothing reaches hand (v2.04)");
  assert.equal(dec.sides[0].deck.length, 8, "and the deck is the same SIZE");
  assert.notEqual(order(dec), was, "…but a different ORDER — the shuffle fired anyway");
  assert.ok(dec.rng.n > game.rng.n, "the stream advanced on the decline too");
  assert.match(feed(dec), /chose nothing/);
  assert.match(feed(dec), /deck is shuffled/);
  P.fxReset();
});

test("DRIVEN: the printed GATE refuses when no OTHER red card was played", {skip}, () => {
  /* THIS ROW IS WHAT FOUND v4.58's SECOND DEFECT. It failed on first
     writing, and not because of the search: the colour counters were
     incremented 460 lines ABOVE the condition that reads them, so Flamecall
     Awakening's own play satisfied its own "another red card" gate. See
     `test/colourgate.test.js` — seven pool records, all printing "another".
     Building the route is what made the gate observable (v3.72). */
  P.fxReset();
  const flame = mk("Flamecall Awakening", 1, 900);
  const deck = [mk("Phoenix Flame", null, 911), mk("Brothers in Arms", 1, 912)];
  /* `hist.red`, NOT `hist.redPlayed` — my own first fixture invented the
     field name and read the gate as never blocking (v4.09). */
  const g = H.state({hand: [flame], deck, res: 9,
    hist: {red: 0, blue: 0, non: 0, atkNames: [], playTy: []}}, {}, {turn: 3, actor: 0, seed: "s"});
  const n = H.execute(g, flame, "hand", 0, {attacking: true, isAtk: true, target: "hero"});
  assert.deepEqual(n.promptQ || [], [], "no red card played, so nothing is queued");
  const drained = J.openPrompt(n);
  assert.ok(!drained.prompt, "and no sheet opens");
  assert.equal(drained.sides[0].deck.length, 2, "and the deck is not shuffled for a gate that failed");
  P.fxReset();
});

/* ---- 5. THE DELAY IS STATED, AND MEASURED UNOBSERVABLE --------------- */

test("the sheet opens at the first DRAIN, and for this card that is unobservable", {skip}, () => {
  /* CR 7.2 puts a when-this-attacks trigger on the stack ABOVE the attack,
     so the search should resolve at DECLARATION. `execute`'s attacking path
     queues and returns without draining, and judge's one drain is at the
     DAMAGE step — the standing approximation v4.04 recorded for
     `pickPrompt` by name ("it opens a sheet the caller has not finished
     draining"), inherited rather than newly created.

     AND IT IS UNOBSERVABLE FOR THE ONE CARD THAT USES IT, measured rather
     than assumed: the found card is a Phoenix Flame, an ATTACK ACTION CARD,
     which `rxAllowed` refuses in BOTH reaction windows — so its controller
     could not have played it any earlier than the resolution step, which is
     after the drain either way. A card the search could use sooner would
     make the delay real, and this drill would then be the place that says
     so. */
  const pf = mk("Phoenix Flame", null, 1);
  assert.match(pf.tt, /Action - Attack/, "the found card is an attack action card");
  assert.equal(P.rxAllowed(pf, "attack-reaction"), false,
    "so it cannot be played in the attacker's reaction window…");
  assert.equal(P.rxAllowed(pf, "defense-reaction"), false,
    "…nor the defender's — the delay costs its controller no line of play");
});
