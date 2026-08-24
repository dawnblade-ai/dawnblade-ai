/* ============================================================
   BLAZE, FIREMIND — the energy engine (v3.39)

     "Whenever you opt, put energy counters on Blaze equal to the number
      of cards LOOKED AT this way."
     "Once per Turn Instant - Remove X energy counters from Blaze: Banish
      a Wizard non-attack action card from your hand with an effect that
      deals arcane damage equal to X. You may play it this turn as though
      it were an instant."

   NEITHER CLAUSE EXISTED. No build passive, no ledger entry, no route —
   the audit reported all three of his hero-text clauses unrecognised,
   which was honest.

   BOTH CLAUSES OR NEITHER, and clause 1 was written and REVERTED once
   (v3.38) for exactly that reason: energy counters nothing can spend are
   v2.74's Frostbite bug — a number on the hero row and no rule.

   X IS NOT A FREE VARIABLE. The player picks a card and X is that card's
   own arcane damage, so no X-cost machinery is needed: the filter is
   where the coupling lives, and the QUEUE SITE bounds it by the counters
   actually held.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");

const P  = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const B  = require("../engine/build.js");
const H  = require("./helpers/judged.js");
const J  = H.J;

const skip = !H.hasDb() && "no cached card database";
const BZ = {energyOnOpt: true};
const uid = (c, u) => ({...c, uid: u});

/* ---- CLAUSE 1: THE POOL --------------------------------------------- */

test("opt fills the pool by cards LOOKED AT, not by the printed number", {skip}, () => {
  const deckOf = n => Array.from({length: n}, (_, i) => uid(H.card("Ice Bolt", 3), "d" + i));
  const run = (build, deckN, optN) => {
    const g = H.state({res: 9, deck: deckOf(deckN)}, {},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [build, {}]});
    const n = H.runOps(g, [["opt", optN]], "Whisper of the Oracle");
    return ((n.sides[0].counters.hero || {}).energy) || 0;
  };

  assert.equal(run(BZ, 5, 3), 3, "Opt 3 into a five-card deck looks at three");
  /* THE DISTINCTION THAT IS FREE AND EASY TO GET WRONG. `Math.min` was
     already there for the prompt; reading the printed number would pay
     above rate on exactly the turns a deck is running out. */
  assert.equal(run(BZ, 2, 3), 2, "Opt 3 into a TWO-card deck looks at two, and pays two");
  assert.equal(run({energyOnOpt: false}, 5, 3), 0, "another hero banks nothing");
});

test("the passive is read off HIS text, and the ledger knows about it", {skip}, () => {
  const heroTx = "Whenever you opt, put energy counters on Blaze equal to the number of cards looked at this way.";
  assert.ok(B.PASSIVES.includes("energyOnOpt"),
    "a passive missing from PASSIVES reads as a silent `false` on a real hero's turn");
  assert.equal(B.PASSIVE_TYPE.energyOnOpt, "boolean",
    "a boolean: the COUNT belongs to the opt site, which is the only thing that knows it");
  /* THE LEDGER, BOTH DIRECTIONS (v3.21). A passive with no ledger entry is
     never asked about at all — it is absent from the census rather than
     failing it, which is how Kayo reported unread for eleven versions
     AFTER he was built. */
  const audit = require("fs").readFileSync(
    require("path").join(__dirname, "..", "tools", "audit.js"), "utf8");
  assert.match(audit, /energyOnOpt/,
    "tools/audit.js must carry a HERO_STATICS entry or the audit reports Blaze unread " +
    "while he works perfectly");
  assert.match(audit, /you may play it this turn as though it were an instant/,
    "and the ABILITY'S RIDER is a separate printed sentence — the audit splits on " +
    "sentences, so it needs its own entry even though it is built as part of the ability");
});

/* ---- CLAUSE 2: THE SPEND -------------------------------------------- */

test("the ability reads, and its cost is a COUNTER rather than resources", {skip}, () => {
  const tx = "Once per Turn Instant - Remove X energy counters from Blaze: Banish a Wizard " +
             "non-attack action card from your hand with an effect that deals arcane damage " +
             "equal to X. You may play it this turn as though it were an instant.";
  const hp = P.parseHeroPower(tx);
  assert.ok(hp, "parseHeroPower must read it — it refused a `remove` cost outright before v3.39");
  assert.deepEqual(hp.ctr, {kind: "energy", x: "x"});
  assert.equal(hp.cost, 0, "no RESOURCE cost — counters are what it spends");
  assert.equal(hp.kind, "instant");

  /* THE RELAXATION IS NARROW, like v2.34's arsenal put. A broad one would
     raise the tier of cards nothing wires. */
  assert.equal(P.parseHeroPower("Instant - Discard a card: Draw a card."), null,
    "a discard cost is still refused — the guard was narrowed, not removed");
  assert.equal(P.parseHeroPower("Instant - Banish a card: Draw a card."), null,
    "and so is a banish cost");
});

test("the subject is read whole, class and type together", {skip}, () => {
  assert.deepEqual(P.optFilter("a Wizard non-attack action card"),
    {ty: ["wizard", "action"], type: "nonAttack"},
    "the class and the type must be asked TOGETHER — `action` alone offers a Runeblade " +
    "action, `wizard` alone offers a Wizard attack");

  /* THE WHOLE PHRASE IS TRIED FIRST. Ordered the other way "ATTACK ACTION
     CARD" splits as class "attack" plus "action card" — a subject the
     reader already knows, read as two things it is not. Three existing
     drills caught that when it was written the wrong way round. */
  assert.deepEqual(P.optFilter("an attack action card with cost 1 or less"),
    {costLe: 1, type: "attack"},
    "an existing compound subject must not be re-read as class + remainder");

  assert.equal(P.optFilter("a Wizard sparkle"), null,
    "and an unreadable remainder still refuses — the class does not rescue it");
});

test("X is the CHOSEN card's arcane, and the pool bounds what may be chosen", {skip}, () => {
  /* arcAmount reads the UNCONDITIONAL ops only: this number is the PRICE,
     and Emeritus Scolding prints 4 with a conditional 6. */
  assert.equal(P.arcAmount(H.card("Ice Bolt", 1)), 5);
  assert.equal(P.arcAmount(H.card("Ice Bolt", 3)), 3);
  assert.equal(P.arcAmount(H.card("Emeritus Scolding", 1)), 4,
    "the conditional 6 is NOT counted — charging 6 for a card that deals 4 is the wrong " +
    "direction, and a gated amount is not one the engine can promise");
  assert.equal(P.arcAmount(H.card("Wounded Bull", 1)), 0, "an attack deals none");

  const f = n => PM.promptFilter({ty: ["wizard", "action"], type: "nonAttack", arcGe: 1, arcLe: n});
  assert.equal(f(3)(H.card("Ice Bolt", 3)), true,  "3 arcane is affordable on 3 energy");
  assert.equal(f(3)(H.card("Ice Bolt", 1)), false, "5 arcane is not");
  assert.equal(f(9)(H.card("Wounded Bull", 1)), false, "and an attack is never a legal choice");
});

test("the pool bound is supplied at the QUEUE SITE, never baked into the parse", {skip}, () => {
  /* `fxParse` memoizes on `name|pitch`, so one parse serves every copy in
     a match — a number stored there would freeze at whatever the counters
     were the first time it was read. Same rule `notUid` follows. */
  const ops = P.fxParse({name: "probe-blaze-ability", pitch: 0, tt: "Hero Ability", ty: [], kw: [], gkw: [],
    tx: "Banish a Wizard non-attack action card from your hand with an effect that deals arcane damage equal to X."}).ops;
  assert.equal(ops.length, 1);
  assert.equal(ops[0][0], "pickPrompt");
  assert.equal(ops[0][1].filter.arcLe, undefined,
    "the parse must carry NO pool bound — it is game state, and this parse is shared");
  assert.equal(ops[0][1].ctrSpend, "energy");

  const queued = held => {
    const g = H.state({res: 9, counters: {hero: {energy: held}}, hand: []}, {},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [BZ, {}]});
    return H.runOps(g, ops, "hero power").promptQ[0];
  };
  assert.equal(queued(3).filter.arcLe, 3, "the queue site bounds it by the counters held");
  assert.equal(queued(0).filter.arcLe, 0, "and an empty pool admits nothing");
});

test("answering it pays X, banishes the card and stamps it", {skip}, () => {
  const bolt = uid(H.card("Ice Bolt", 3), "c1");     /* 3 arcane */
  const bull = uid(H.card("Wounded Bull", 1), "c2");
  let g = H.state({res: 9, ap: 1, counters: {hero: {energy: 3}}, hand: [bolt, bull]}, {},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [BZ, {}]});
  g = H.runOps(g, [["pickPrompt", {zone: "hand", to: "banish",
    filter: {ty: ["wizard", "action"], type: "nonAttack", arcGe: 1},
    min: 0, max: 1, ctrSpend: "energy", playThisTurn: true, title: "Banish"}]], "hero power");

  g.prompt = PM.buildPrompt(g, g.promptQ[0]);
  assert.ok(g.prompt, "the sheet must open");
  assert.deepEqual(g.prompt.cards.map(c => c.name), ["Ice Bolt"],
    "only the card the line names, and only one he can afford");
  /* A PROMPT SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34).
     Dropped, the banish is FREE and the card is never marked playable —
     which is exactly what happened the first time this was driven. */
  assert.equal(g.prompt.ctrSpend, "energy", "the cost must survive buildPrompt");
  assert.equal(g.prompt.playThisTurn, true, "and so must the stamp");

  g.prompt = PM.promptToggleSel(g.prompt, 0);
  g = H.fx(g, (f, n) => f.applyAnswer(n, n.prompt));

  const sd = g.sides[0];
  assert.equal((sd.counters.hero || {}).energy, 0, "3 energy paid for a card dealing 3 arcane");
  assert.deepEqual(sd.hand.map(c => c.uid), ["c2"], "only the chosen card left the hand");
  assert.deepEqual(sd.banish.map(c => c.name), ["Ice Bolt"]);

  const ban = sd.banish[0];
  assert.equal(P.playableFromZone(ban, "banish", {turn: g.turn}), true,
    "playable FROM BANISH this turn — Crouching Tiger's `_playTurn`, already honoured");
  assert.equal(P.playsAsInstant(ban, {}), true,
    "and at INSTANT SPEED — the fifth printed source for the one reader, a stamp because " +
    "it names one card instance rather than a qualifier");
});

/* ---- THE ROUTE, AT THE TABLE ---------------------------------------- */

function tableGame(energy, hand){
  const g = H.state({res: 9, ap: 1, counters: {hero: {energy}}, hand}, {},
                    {actor: 0, turnPlayer: 0, turn: 3,
                     builds: [{energyOnOpt: true, HPOW: {name: "Blaze — hero power", pitch: 0, cost: 0,
                       tt: "Hero Ability", kw: [], ty: [], gkw: [], _instant: true, uid: "hpow",
                       tx: "Banish a Wizard non-attack action card from your hand with an effect that deals arcane damage equal to X. You may play it this turn as though it were an instant."}}, {}]});
  return {...g, phase: "action", step: "layer", priority: 0, passed: []};
}
const ACT = {t: "activate", from: "hero", uid: "hpow"};

test("the hero's activated ability has a route at the TABLE", {skip}, () => {
  /* `doActivate` handled hand abilities and gear and had NO "hero" branch,
     so an ACTIVATED hero ability was unreachable here — the same
     one-board shape v3.04 found for the 17 equipment abilities. */
  const bolt = uid(H.card("Ice Bolt", 3), "c1");
  const g = tableGame(3, [bolt]);
  assert.equal(J.legal(g, ACT, 0), null, "it must be activatable at the table");

  const out = J.reduce(g, ACT, 0);
  assert.equal(out.error, null);
  assert.ok(out.state.prompt, "and it opens its pick sheet");
  assert.equal((out.state.sides[0].weaponUsed || {})["hpow"], true, "once per turn, marked spent");
  assert.equal(out.state.sides[0].ap, 1,
    "an Instant costs NO action point (CR 8.1.6) — it must not eat the turn's action");

  /* ONCE PER TURN, ASKED PROPERLY. Checking the FLAG is not checking the
     RULE: a second activation is refused mid-prompt by the interaction
     gate whatever the flag says, so the prompt has to be cleared first or
     the drill passes against a missing guard. */
  const after = {...out.state, prompt: null, promptQ: []};
  const why2 = J.legal(after, ACT, 0);
  assert.ok(why2, "a SECOND activation the same turn must be refused");
  assert.match(String(why2), /spent/, "and the refusal must say why: " + why2);
});

test("an INSTANT hero ability needs no action point, but an ACTION one does", {skip}, () => {
  /* WITH `ap: 1` THIS PROVES NOTHING — the gate passes either way. The
     seat must hold ZERO for the two readings to come apart, which is the
     same fixture lesson v3.31 and v3.36 each paid for once. */
  const bolt = uid(H.card("Ice Bolt", 3), "c1");
  const g = tableGame(3, [bolt]);
  const broke = {...g, sides: [{...g.sides[0], ap: 0}, g.sides[1]]};
  assert.equal(J.legal(broke, ACT, 0), null,
    "his ability is printed `Instant`, so a seat on zero action points may still use it " +
    "(CR 8.1.6) — and on the opponent's turn zero is all anyone has");
});

test("an empty pool refuses BY NAME rather than opening an empty sheet", {skip}, () => {
  /* With nothing affordable the filter admits nothing, `buildPrompt`
     returns null and the sheet skips itself — having already burned the
     once-per-turn. A dead tap reads as a broken screen, not as a rule. */
  const bolt = uid(H.card("Ice Bolt", 3), "c1");
  const why = J.legal(tableGame(0, [bolt]), ACT, 0);
  assert.ok(why, "with no energy the ability must be refused, not silently wasted");
  assert.match(String(why), /energy/, "and the refusal must name the reason: " + why);

  /* A HAND WITH NOTHING THE LINE NAMES is the same refusal for a different
     reason — the pool is full, the choices are not there. */
  const bull = uid(H.card("Wounded Bull", 1), "c2");
  assert.ok(J.legal(tableGame(9, [bull]), ACT, 0),
    "a hand of attacks offers no legal choice either");
});
