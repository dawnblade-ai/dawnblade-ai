/* ============================================================
   KAYO — the "6 or more {p}" engine.

   Kayo's deck is one mechanic wearing three sets of words, and until
   v2.55 the engine got all three wrong in ways no tool here could see.

   CLAUSE 2 — "Attack action cards you own get +1{p} while they are in
   any zone other than the combat chain." The combat chain is where an
   attack STRIKES, so this is deliberately NOT a damage buff: it is a
   THRESHOLD rule. 22 of the 47 deck cards print 6 or more; 23 more are
   attack actions printing exactly 5 — and those 23 are precisely the
   pitch-2 and pitch-3 cards you pitch for resources. Without the clause
   the pitch-zone checks essentially never fire and the hero does
   nothing. RULING (user, 2026-08-08): every 6+ check reads the buffed
   value, the strike reads the printed one.

   THE DISCARD — "draw a card then discard a random card" parsed to
   `[["draw",1]]`. The discard was silently deleted, so the cards drew
   for free, and the riders that ask "if a card with 6 or more {p} is
   discarded THIS WAY" then read the whole graveyard instead. Since an
   attack card is put into the graveyard AT DECLARATION, that made the
   condition satisfiable by any 6-power attack already played — and by
   the attacking card itself.

   Assertions here are on HANDS, ZONES and NUMBERS. Two v2.45 bugs lived
   under drills that read the log while the engine did the wrong thing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const GM = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");
const { loadData } = require("./helpers/extract.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";

let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const W = loadData();
const kayoHero = () => W.HEROES.find(h => h.k === "kayo");
const kayoDeck = () => GM.parseDeck(W.DECKS.kayo);
const kayoBuild = () => B.buildSideDefault(kayoHero(), kayoDeck(), DB(), RNG.make("kayo"), {n: 0}).b;
const card = nm => {
  const e = kayoDeck().deck.find(x => x.name === nm) || kayoDeck().gear.find(x => x.name === nm);
  return C.resolveEntry(DB(), e, "SKA");
};

/* ---- CLAUSE 2 --------------------------------------------------------- */

test("clause 2 is read off the hero's PRINTED text, with its own number", {skip}, () => {
  const b = kayoBuild();
  assert.equal(b.atkPowOffChain, 1,
    "the +1 must come from the printed clause, not from a constant in the engine");
  assert.equal(b.mightOnFirst6Discard, true, "clause 3 is read too");
});

test("clause 2 lifts a printed-5 ATTACK ACTION to 6 for a threshold", {skip}, () => {
  const b = kayoBuild();
  const backhand = card("Unexpected Backhand");          // pitch 3, printed power 5
  assert.equal(+backhand.power, 5, "fixture drifted — Unexpected Backhand should print 5");
  assert.equal(P.zonePow(backhand, b), 6);
  assert.equal(P.pow6(backhand, b), true, "a printed 5 counts as 6 while off the chain");
  /* and WITHOUT the hero it is still a 5 — the buff belongs to Kayo, not
     to the card, so nothing may bake it into the card itself */
  assert.equal(P.pow6(backhand, null), false);
  assert.equal(P.pow6(backhand, {atkPowOffChain: 0}), false);
});

test("clause 2 does NOT lift a Block — it says ATTACK ACTION cards", {skip}, () => {
  const b = kayoBuild();
  const tom = card("Test of Might");
  assert.ok(!P.isAtkActionCard(tom), "Test of Might is a Block, not an attack action");
  assert.equal(P.zonePow(tom, b), tom.power == null ? 0 : +tom.power,
    "a Block gets nothing from a clause about attack action cards");
});

/* THE CENSUS, pinned. A number moving here should be a deliberate edit —
   it is the difference between the deck's engine being on and off. */
test("clause 2 turns 22 of Kayo's 47 deck cards into 45", {skip}, () => {
  const b = kayoBuild(), d = kayoDeck();
  let printed = 0, effective = 0, total = 0;
  for(const e of d.deck){
    const c = C.resolveEntry(DB(), e, "SKA");
    total += e.q;
    if((c.power != null ? +c.power : 0) >= 6) printed += e.q;
    if(P.pow6(c, b)) effective += e.q;
  }
  assert.equal(total, 47, "Kayo's deck is 47 cards");
  assert.equal(printed, 22, "printed 6-or-more");
  assert.equal(effective, 45, "with clause 2 — the two that stay out are the Test of Might copies");
});

/* THE STRIKE IS UNAFFECTED. This is the half of the clause that is easiest
   to get wrong in the generous direction, and generous is the direction
   that steals games. */
test("clause 2 never reaches the damage path", {skip}, () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* Keyword-matching the LINE was too blunt: it flagged a log string that
     happens to contain the word "dealt", and a `zonePow` reading a card in
     the defender's HAND — a perfectly legal threshold. What actually
     matters is narrower and checkable: zonePow must never feed a value that
     BECOMES damage. So look for it on the left of an assignment to one of
     the quantities that do. */
    const offenders = efx.split("\n").filter(l => {
    if(!/zonePow\(/.test(l)) return false;
    const code = l.replace(/`[^`]*`/g, '""');        // drop template strings
    if(!/zonePow\(/.test(code)) return false;         // it was only in a log line
    return /(?:total|_condSelf|lastDmg|\.hp)\s*[-+]?=/.test(code)
        || /\bdmg\s*=/.test(code);
  });
  assert.deepEqual(offenders, [],
    "zonePow feeds a damage quantity. It is a THRESHOLD value: the combat chain is " +
    "exactly the zone Kayo's clause 2 excludes, so an attack strikes for its PRINTED " +
    "power. A 6 that hits for 7 is the direction that steals games.");

  /* And the positive half, so the drill cannot pass by finding nothing:
     the strike total must still be built from the card's printed power. */
  assert.match(efx, /let total = base \+ bonus;/,
    "execute still builds the strike from the card's printed base plus its bonuses");
});

/* ---- THE DISCARD ------------------------------------------------------ */

test("the parser reads BOTH halves of draw-then-discard", {skip}, () => {
  for(const nm of ["Bare Fangs", "Wild Ride"]){
    const fx = P.fxParse(card(nm));
    assert.deepEqual(fx.ops.filter(o => o[0] === "draw" || o[0] === "discardRandom"),
      [["draw", 1], ["discardRandom", 1]],
      `${nm}: the discard is the COST of the draw — dropping it made the card strictly better than printed`);
  }
});

test('"discarded this way" is a different condition from "this turn"', {skip}, () => {
  const way = P.classifyClause("If a card with 6 or more {p} is discarded this way, it gets go again");
  assert.equal(way.cond, "discard6way",
    "the resolution-scoped wording asks about the discard this card just made");

  /* The TURN-scoped wording reaches the engine by two other routes and
     deliberately not through this one: Run Roughshod is a `playIf` gate,
     and Mandible Claw's rider is read where the weapon is activated. Both
     answer `had6ThisTurn`. What matters here is only that the two wordings
     never collapse into each other — collapsing them is what let an
     unrelated earlier discard satisfy a "this way" rider. */
  const turn = P.classifyClause("If you have discarded a card with 6 or more {p} this turn, this gets go again");
  assert.notEqual(turn && turn.cond, "discard6way",
    "the turn-scoped wording must NOT be read as the resolution-scoped one");

  assert.equal(P.fxParse(card("Run Roughshod")).playIf.kind, "discard6",
    "Run Roughshod's play gate is turn-scoped");
});

/* `had6ThisTurn` is a trainer closure, so pin its SHAPE at the call site:
   it must ask for `_disc`, or it goes back to counting the whole graveyard. */
test("the trainer's turn-scoped check asks for a real discard", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/const had6ThisTurn = [^\n]*/);
  assert.ok(m, "had6ThisTurn moved — re-anchor this drill");
  assert.match(m[0], /_disc/,
    "it must require the _disc stamp: an attack reaches the graveyard at DECLARATION, so " +
    "counting the graveyard lets a played 6-power attack satisfy a discard condition, itself included");
  assert.match(m[0], /pow6\(/, "and read effective power, so Kayo's clause 2 applies");
  assert.ok(!/you\(/.test(m[0]), "a rules question belongs to the ACTOR, not to seat 0");
});

/* ---- THE OP ITSELF ---------------------------------------------------- */

function ctx(build){
  return {
    L: (s, m) => ({...s, log: [m, ...(s.log || [])], feed: [...(s.feed || []), m]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => build,
    bFoe: () => build,
    built: build, db: DB(), dummyDefence: s => s,
    foe: s => s.sides[1 - (s.actor || 0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s, openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "attack", winCheck: s => s
  };
}
const side = hand => ({name: "kayo", hp: 20, res: 0, ap: 1, amp: 0, ward: 0, awd: 0, buffNext: 0,
  hand, deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], counters: {}, hist: {}});
const game = hand => ({sides: [side(hand), side([])], actor: 0, turn: 2,
  log: [], feed: [], rng: RNG.make("disc")});

test("discardRandom moves a card from HAND to GRAVEYARD, stamped as a discard", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const hand = [card("Buckwild"), card("Smash Instinct")];
  const out = runOps(game(hand), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].hand.length, 1, "one card left the hand");
  assert.equal(out.sides[0].grave.length, 1, "and reached the graveyard");
  assert.equal(out.sides[0].grave[0]._disc, true,
    "stamped _disc — without it a discard is indistinguishable from a card that was merely played");
  assert.equal(out.sides[0].grave[0]._gy, 2, "and turn-stamped");
});

test("discardRandom is SEEDED — same seed, same card", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const hand = () => [card("Buckwild"), card("Smash Instinct"), card("Bear Hug")];
  const a = runOps(game(hand()), [["discardRandom", 1]], "p");
  const c = runOps(game(hand()), [["discardRandom", 1]], "p");
  assert.equal(a.sides[0].grave[0].name, c.sides[0].grave[0].name,
    "two peers and a replay must discard the same card");
  assert.ok(a.rng.n > 0, "the seeded stream was consumed, not Math.random");
});

test("Reincarnate discarded at random goes to the DECK BOTTOM, not the graveyard", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const out = runOps(game([card("Reincarnate")]), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].grave.length, 0, "it never reaches the graveyard — its own printed text says so");
  assert.equal(out.sides[0].deck.length, 1);
  assert.equal(out.sides[0].deck[0].name, "Reincarnate");
});

/* ---- THE TOKENS, AND CLAUSE 3 ----------------------------------------- */

test("Might / Agility / Vigor each parse to a real payload", {skip}, () => {
  const want = {Might: [["buffNext", 1]], Agility: [["gaNext"]], Vigor: [["res", 1]]};
  for(const [nm, ops] of Object.entries(want)){
    const tok = C.resolveEntry(DB(), {name: nm, p: 0, code: null, q: 1});
    assert.ok(tok.resolved, `${nm} must resolve from the database — never invent a token`);
    assert.deepEqual(P.fxParse(tok).ops, ops, `${nm}`);
    assert.match(P.clean(tok.tx || ""), /at the start of your turn, destroy this/i);
  }
});

/* The schedule is in `newTurn`, a closure inside Battle, so pin the call
   site by reading it — the alternative is no check at all, and these three
   tokens were inert for their whole existence precisely because nothing
   asked. */
test("the trainer fires start-of-turn triggers, off printed text", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const start = html.indexOf("Start phase (CR 4.2)");
  const body = html.slice(start, start + 2200);
  assert.match(body, /at the start of your turn, destroy this/i,
    "newTurn must look for the printed trigger line");
  assert.match(body, /fxParse\(b\.card\)\.ops/,
    "and run the token's OWN parsed ops — never a payload hardcoded per token name");
  assert.ok(!/"Might"|'Might'/.test(body),
    "matched on printed text, not on a token's name");
});

/* Slice to the END of the function, not a fixed byte count: adding the
   Beaten Trackers trigger pushed clause 3 past a hardcoded 900 and the
   drill started reporting a bug that was not there. */
const afterDiscardBody = () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = efx.indexOf("const afterDiscard");
  assert.ok(i > 0, "afterDiscard moved — re-anchor this drill");
  const j = efx.indexOf("\n  const runOps", i);
  assert.ok(j > i, "afterDiscard's end anchor moved");
  return efx.slice(i, j);
};

test("clause 3 is gated on the ACTION phase and latches once", {skip}, () => {
  const body = afterDiscardBody();
  assert.match(body, /phase !== "action"/,
    'RULING: "during each of your action phases" — an end-phase discard makes no Might');
  assert.match(body, /hist\.might6/, "and it must latch, so only the FIRST one fires");
  assert.match(body, /pow6\(/, "the 6+ test is the shared one, so clause 2 applies to it");
});

/* FOUND IN PLAY (v2.61): paying Rally the Coast Guard's discard cost to
   block on the OPPONENT'S turn minted a Might token. `phase === "action"`
   does not mean "your action phase" — in FaB the combat chain lives inside
   the TURN PLAYER's action phase, so while you defend against their swing
   the phase is still "action", just not yours. */
test("clause 3 requires YOUR OWN turn, not merely the action phase", {skip}, () => {
  const body = afterDiscardBody();
  assert.match(body, /turnPlayer !== actorOf\(n\)/,
    "a discard made while DEFENDING on the opponent's turn is still in an action phase — " +
    "the turn has to be the actor's own");

  /* and behaviourally, both ways round */
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const mine = game([card("Buckwild")]);
  mine.phase = "action"; mine.turnPlayer = 0;          // my turn
  const a = runOps(mine, [["discardRandom", 1]], "probe");
  assert.equal(a.sides[0].board.length, 1, "my own action phase makes Might");

  const theirs = game([card("Buckwild")]);
  theirs.phase = "action"; theirs.turnPlayer = 1;      // defending on their turn
  const c2 = runOps(theirs, [["discardRandom", 1]], "probe");
  assert.equal(c2.sides[0].board.length, 0,
    "blocking on their turn is still the action phase — but not YOUR action phase");
});

/* ---- BEATEN TRACKERS --------------------------------------------------- */

test("Beaten Trackers triggers only on a RANDOM discard", {skip}, () => {
  const bt = card("Beaten Trackers");
  assert.match(P.clean(bt.tx || ""), /whenever you discard a random card with 6 or more \{p\}/i,
    "the card says RANDOM, and the hero ability does not");
  const body = afterDiscardBody();
  /* Pin the GATE, not merely the presence of the variable: deleting
     `&& atRandom` from the condition leaves the declaration behind, and a
     drill that only greps the name passes over exactly that edit. */
  assert.match(body, /if\(big && atRandom\)/,
    "clause 3 fires on ANY discard; Beaten Trackers only on a random one. Reading the two " +
    "as the same event hands out a free action point every time a cost is paid by choice.");
  assert.match(body, /whenever you discard a random card with/,
    "matched on the piece's PRINTED TEXT, not by name");
  assert.match(body, /tag:"modal"/,
    'RULING: "you may destroy this" is a real decision — prompt every time it triggers');
  assert.ok(!/"Beaten Trackers"/.test(body), "no card is special-cased by name");
});

test("the trigger only fires when a random 6+ is actually discarded", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const gear = [card("Beaten Trackers")];
  const withGear = hand => { const g = game(hand); g.sides[0].gear = gear; g.phase = "action"; return g; };

  /* a printed-3 card is under the bar even for Kayo — nothing should queue */
  const small = {name:"tiny", uid:"t1", pitch:1, power:3, cost:0,
    tt:"Generic Action - Attack", ty:["Generic","Action","Attack"], tx:"", kw:[]};
  const quiet = runOps(withGear([small]), [["discardRandom", 1]], "probe");
  assert.equal((quiet.promptQ || []).length, 0, "3 power is not 6 — no offer");

  /* a real 6+ discard offers the choice */
  const loud = runOps(withGear([card("Buckwild")]), [["discardRandom", 1]], "probe");
  assert.equal((loud.promptQ || []).length, 1, "a 6+ random discard offers the action point");
  assert.equal(loud.promptQ[0].tag, "modal");
  assert.equal(loud.promptQ[0].options.length, 2, "destroy, or keep the iron");
});

/* CLASH compares the power of the top card of each deck, and the deck is a
   zone other than the combat chain — so clause 2 reaches it, and each card
   must be read with ITS OWN owner's build. Seven of Kayo's cards clash. */
test("clash reads effective power, each side with its own build", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const i = html.indexOf("const myTop = act(clashState).deck[0]");
  assert.ok(i > 0, "the clash loop moved — re-anchor this drill");
  const body = html.slice(i, i + 500);
  assert.match(body, /zonePow\(myTop, bAct\(/, "your revealed card uses YOUR build");
  assert.match(body, /zonePow\(foeTop, bFoe\(/,
    "and theirs uses THEIRS — one shared build would apply the revealer's buff to both cards");
  assert.ok(!/\(myTop\.power\|\|0\)/.test(body), "printed power must not decide a clash any more");
});

/* ---- A KEYWORD THE CARD ONLY GRANTS CONDITIONALLY --------------------- */

test("Pulping's dominate is GATED, and Smash Instinct's intimidate is not", {skip}, () => {
  const pulping = card("Pulping"), smash = card("Smash Instinct");
  assert.equal(P.hasKw(pulping, "dominate"), true, "it is on the card somewhere");
  assert.equal(P.kwGated(pulping, "dominate"), true,
    'but only inside "IF a card with 6 or more {p} is discarded this way"');
  assert.equal(P.hasKwNow(pulping, "dominate"), false,
    "so the engine must not hand it over unconditionally — that is v2.31's lesson, " +
    "applied to fx.ga in 2.31 and never to hasKw");

  /* A TRIGGER IS NOT A GATE. "When this attacks, intimidate" fires on every
     swing; treating it as conditional would turn the card off instead. */
  assert.equal(P.kwGated(smash, "intimidate"), false);
  assert.equal(P.hasKwNow(smash, "intimidate"), true);
});

test("the gate can still fire — the clause grants the keyword", {skip}, () => {
  const cl = P.classifyClause("If a card with 6 or more {p} is discarded this way, this gets dominate");
  assert.equal(cl.cond, "discard6way");
  assert.deepEqual(cl.ops, [["gainKw", "dominate"]],
    "refusing the unconditional grant without building the conditional one would " +
    "just turn the card off, which is the opposite error");
});

test("the trainer asks whether dominate is ACTIVE, not whether it is mentioned", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const dominating = hasKwNow\(card,"dominate"\) \|\| \(n\._kwGrant\|\|\[\]\)/,
    "dummyDefence must read hasKwNow plus this resolution's granted keywords");
  assert.ok(!/hasKw\(card,"dominate"\)/.test(html),
    "the bare hasKw reading is what held the defender to one card on every Pulping swing");
});

/* ---- A BLOCK HAS NO PLAY ---------------------------------------------- */

test("Test of Might cannot be played as an action", {skip}, () => {
  const tom = card("Test of Might");
  const T = require("../engine/types.js");
  assert.equal(T.isBlock(tom), true, "Test of Might is a Block");
  assert.equal(T.isPlayable(tom), false, "and a Block has no play at all");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /DawnTypes\.isBlock\(card\)/,
    "tryPlay must refuse a Block — otherwise it is a free 0-cost play that spends " +
    "an action point and does nothing. judge.js has refused it since v2.47; the " +
    "trainer never did, and Kayo runs two copies.");
});

/* ---- A CARD IN HAND WITH AN ACTIVATED ABILITY -------------------------- */

test("Agile Windup and Rally the Coast Guard both read their ability", {skip}, () => {
  const aw = P.fxParse(card("Agile Windup")).handAbility;
  assert.ok(aw, "Instant - Discard this: Create an Agility token");
  assert.equal(aw.cost, "self", "it spends ITSELF");
  assert.deepEqual(aw.ops, [["token", "agility", 1, "self"]]);

  const rc = P.fxParse(card("Rally the Coast Guard")).handAbility;
  assert.ok(rc, "Once per Turn Instant - Discard a card: This gets +3{d}");
  assert.equal(rc.cost, "card", "it spends ANOTHER card — a different cost, and a choice");
  assert.equal(rc.oncePerTurn, true);
  assert.deepEqual(rc.ops, [["defBuff", 3]]);
  assert.equal(P.fxParse(card("Rally the Coast Guard")).activateIf.kind, "defending",
    "and it may only be activated while it is defending");
});

test("the hand-ability route is wired, and nothing is named", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const handPow = c =>/, "the synthetic ability card");
  assert.match(html, /const handAbilityOK = \(s, c\) =>/, "and the question of whether it is live now");
  assert.match(html, /const activateHand = c => setG/, "and the reducer");
  assert.match(html, /y\.hand\.forEach\(c => \{ const hp = handPow\(c\)/,
    "peekables must span it, or the preview fails silently while the tap still arms");
  assert.match(html, /hand\.flatMap\(handCell\)/,
    "the ability is its own cell — one tap target cannot mean two things");
  /* the defence buff must NOT go through runOps: finishBlock reads a
     per-uid bonus map, and runOps cannot raise one specific defender */
  assert.match(html, /n\.defBonus = \{\.\.\.\(n\.defBonus\|\|\{\}\), \[c\.uid\]/,
    "Rally's +3{d} reaches the wall through defBonus, the way confirmDefPay already routes one");
  for(const nm of ["Agile Windup", "Rally the Coast Guard"])
    assert.ok(!new RegExp('"' + nm + '"').test(html), `${nm} must not be special-cased by name`);
});

test("the ability reader claims exactly the cards that print one", {skip}, () => {
  /* Five pool cards, found by reading text — three of them nothing to do
     with Kayo, which is the golden rule working rather than a coincidence. */
  const hits = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(DB(), e, sa);
      if(c.resolved && P.fxParse(c).handAbility) hits.push(c.name + "|" + c.pitch);
    }
  }
  assert.deepEqual([...new Set(hits)].sort(),
    ["Agile Windup|3", "Arcane Twining|3", "Photon Splicing|3",
     "Rally the Coast Guard|3", "Reaper's Call|3"]);
});

/* ---- STRONGEST SURVIVE: the defender's escape hatch -------------------- */

test("Strongest Survive reads its 'unless they reveal' half", {skip}, () => {
  for(const p of [1, 2, 3]){
    const c = C.resolveEntry(DB(), {name: "Strongest Survive", p, code: null, q: 1}, "SKA");
    const fx = P.fxParse(c);
    assert.deepEqual(fx.onHit, [["foeDiscardUnlessReveal", 1]],
      `pitch ${p}: classifyClause returned BYTE-IDENTICAL output with and without the ` +
      `"unless they reveal…" clause, so all six copies discarded unconditionally — ` +
      `stronger than printed`);
  }
  /* the plain wording must be untouched — other heroes rely on it */
  assert.deepEqual(P.classifyClause("they discard a card").ops, [["foeDiscard", 1]]);
});

test("the reveal beats the DAMAGE DEALT, not the printed power", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const mk = (nm, pow) => ({name: nm, uid: nm, pitch: 1, power: pow, cost: 0,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

  /* a 7-power swing stopped to 3 is beaten by a 4 */
  const g = game([]);
  g.sides[1].hand = [mk("spare", 4)];
  g.lastDmg = 3;
  const dodged = runOps(g, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(dodged.sides[1].hand.length, 1, "they revealed and kept the card");
  assert.equal(dodged.sides[1].grave.length, 0, "nothing was discarded");

  /* and when nothing in hand beats it, the discard lands */
  const g2 = game([]);
  g2.sides[1].hand = [mk("small", 2)];
  g2.lastDmg = 5;
  const hit = runOps(g2, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(hit.sides[1].hand.length, 0, "nothing beat 5, so a card goes");
  assert.equal(hit.sides[1].grave.length, 1);
  assert.equal(hit.sides[1].grave[0]._disc, true, "and it is stamped as a discard");
});

test("the revealed card is read with the DEFENDER's own build", {skip}, () => {
  /* In a Kayo mirror their clause 2 lifts their hand exactly as yours lifts
     yours: a printed 5 attack action in their hand reveals as a 6. Using
     the attacker's build for both sides is the same class of mistake bFoe
     was created to prevent in the clash. */
  const kayo = kayoBuild();
  const { runOps } = E.makeEffects(ctx(kayo));   // ctx gives bFoe the same build
  const g = game([]);
  g.sides[1].hand = [card("Unexpected Backhand")];   // printed 5 -> 6 for a Kayo
  g.lastDmg = 5;
  const out = runOps(g, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(out.sides[1].hand.length, 1,
    "printed 5 is not greater than 5, but their clause 2 makes it a 6 — they escape");

  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.match(efx, /zonePow\(c, bFoe\(n\)\) > dmg/,
    "the defender's hand must be read with bFoe, never bAct");
});

/* ---- SAVAGE FEAST: a cost that was never paid ------------------------- */

test("Savage Feast's additional cost is read, and it is RANDOM", {skip}, () => {
  const fx = P.fxParse(card("Savage Feast"));
  assert.ok(fx.addCost, "the card NAMES ITSELF rather than saying 'this', and there is no comma after the name");
  assert.equal(fx.addCost.discard, 1);
  assert.equal(fx.addCost.random, true,
    "printed 'a random card' — the engine's auto-discard picks your lowest-value card, " +
    "which is strictly better than printed");
  assert.ok((fx.conds || []).some(c => c.cond === "discard6way"),
    '"discarded as an additional cost to play it" is the same scoping as "this way" — ' +
    "the discard this card just made, not the turn's history");
});

test("the additional-cost discard is stamped and counts as this way", {skip}, () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.ok(!/actMut\(n\)\.grave = \[\.\.\.gy\(n\.turn, \.\.\._toGrave\)/.test(efx),
    "the additional-cost discard must use gyDisc — with plain gy it is indistinguishable " +
    "from a card that was merely played, and no discard check can see it");
  assert.match(efx, /actMut\(n\)\.grave = \[\.\.\.gyDisc\(n\.turn, \.\.\._toGrave\)/);
  assert.match(efx, /n\._discWay = \[\.\.\.\(n\._discWay\|\|\[\]\), \.\.\.pool\.map/,
    "and record it, or the card's own rider cannot see the card it just fed the cost");
});

/* ---- PREDATORY PLATING ------------------------------------------------ */

test('"control a card with 6 or more {p}" includes the live attack', {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const i = html.indexOf('g2.kind==="controlPow"');
  assert.ok(i > 0, "the controlPow gate moved — re-anchor this drill");
  const body = html.slice(i, i + 300);
  assert.match(body, /s\.pend&&s\.pend\.card/,
    "RULING: arena + equipment + the attack on the combat chain. Board and gear alone " +
    "left Kayo with nothing over 3 power, so Predatory Plating was unactivatable.");
  assert.ok(!/zonePow/.test(body),
    "and NOT zonePow — the chain is the one zone clause 2 excludes, and gear is not an attack action");
});

/* ---- THE BUG THIS WHOLE DISTINCTION EXISTS FOR ------------------------ */

test("a PLAYED attack in the graveyard does not count as a discard", {skip}, () => {
  /* An attack card is put into the graveyard at declaration. Counting the
     graveyard therefore let any 6-power attack already played satisfy
     "you've discarded a card with 6 or more {p} this turn" — and a
     6-power attack satisfied it for itself. */
  const b = kayoBuild();
  const played = {...card("Buckwild"), _gy: 2};        // reached the graveyard by being PLAYED
  const discarded = {...card("Bear Hug"), _gy: 2, _disc: true};
  const had6 = grave => grave.some(c => c._gy === 2 && c._disc && P.pow6(c, b));
  assert.equal(had6([played]), false, "played, not discarded — it must not count");
  assert.equal(had6([discarded]), true, "an actual discard does");
});
