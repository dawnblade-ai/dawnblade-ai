/* ============================================================
   BOLTYN — the soul, and a free action point three abilities were taking.

     "If you've charged this turn, your attacks get +1{p} while defended
      by an attack action card.
      Attack Reaction - Banish a card from your soul: Target attack with
      {p} greater than its base gets go again."

   HIS ONE MECHANIC IS THE SOUL (v2.55's rule, third payout). Five cards in
   his deck plus both hero clauses are soul-shaped: Radiant Touch banishes
   from it, Halo of Illumination puts into it, Roaring Beam reads whether
   it is empty, V of the Vanguard counts what was charged into it.

   CLAUSE 2 WAS REFUSED ON ITS COST, and the refusal was recorded in
   `test/rxability.test.js`'s own assertion text — "Boltyn's cost is a soul
   banish nothing builds". That is what a recorded refusal is for (v3.38);
   the payload and the whole attack-reaction route already existed (v3.63,
   and Bolt'n Boots is the same shape one cost over).

   AND DRIVING IT FOUND A LIVE ONE. Three of the pool's four
   attack-reaction abilities print "…gets go again" as their PAYLOAD, and
   `fx.ga` read it as the ability's own — so activating one handed its
   controller a free ACTION POINT. Bolt'n Boots and Stalker's Steps have
   done that since v3.63.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("boltyn"), {n: 0}).b;
  return _b[k];
}

/* ---- 1. CLAUSE 1 — a passive settled at the WALL --------------------- */

test("his charged buff is a build passive, with the number off the line", {skip}, () => {
  /* A hardcoded 1 is right for this printing and silently wrong for the
     next — the same rule Kayo's `atkPowOffChain` follows, which is why
     `PASSIVE_TYPE` calls both a number. */
  assert.equal(build("boltyn").chargedDefBuff, 1);
  assert.equal(build("kayo").chargedDefBuff, 0, "…and nobody else has it");
});

test("…and the number is READ, which only a synthetic can show", {skip}, () => {
  /* HE PRINTS 1, SO NO POOL FIXTURE CAN TELL A READ NUMBER FROM A
     HARDCODED ONE — v3.32's Thunder Quake lesson, where the cost and the
     token count are both the keyword's N and both are 3. Sabotaging the
     capture to a literal 1 was SILENT against every drill above.

     The database is cloned with one extra hero in it, which is the
     smallest thing that reaches `buildSide`'s reader. */
  const W = loadData();
  const real = H.db();
  const boltyn = real.byName[require("../engine/cards.js").norm ?
    require("../engine/cards.js").norm("Boltyn") : "boltyn"][0];
  const fake = Object.assign({}, boltyn, {
    tx: "If you've charged this turn, your attacks get +3{p} while defended by "
      + "an attack action card."});
  const db2 = Object.assign({}, real,
    {byName: Object.assign({}, real.byName, {"threep hero": [fake]})});
  const h = W.HEROES.find(x => x.k === "boltyn");
  const d = G.parseDeck(W.DECKS.boltyn);
  const b = B.buildSide(h, Object.assign({}, d, {hero: {...d.hero, name: "Threep Hero"}}),
                        db2, {}, RNG.make("threep"), {n: 0}).b;
  assert.equal(b.chargedDefBuff, 3, "the magnitude comes off the printed line");
});

const ATK_DEF = {uid: 610, name: "Attack Blocker", tt: "Generic Action - Attack",
                 ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []};
const PLAIN_DEF = {uid: 611, name: "Plain Blocker", tt: "Generic Action",
                   ty: ["Generic", "Action"], pitch: 1, cost: 1, power: 0, def: 3, tx: "", kw: []};

function swing(o){
  const atk = Object.assign({}, H.card("Brutal Assault", 1), {uid: 600});
  const g = H.state({hand: [atk], res: 9, ap: 1},
                    {hand: o.blocker ? [o.blocker] : [], hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [build("boltyn"), {}]});
  if(o.charged) g.sides[0].hist = {...g.sides[0].hist, charged: 1};
  let n = H.execute(g, atk, "hand", 0, {});
  if(o.blocker) n = {...n, stack: [...n.stack, {k: "def", uid: o.blocker.uid}]};
  return J.withEffects(n, (fx, s) => fx.resolveStack(s));
}
const dealt = n => 20 - n.sides[1].hp;

test("DRIVEN: both gates, and each one alone is not enough", {skip}, () => {
  /* TWO GATES ANSWERED IN TWO PLACES: "you've charged this turn" is his own
     turn history, "defended by an attack action card" is a fact about the
     WALL. Dropping either is a card stronger than printed, so both halves
     are driven — a drill that only shows the met case passes against an
     engine that pumps every attack in the game. */
  assert.equal(dealt(swing({charged: true,  blocker: ATK_DEF})),   4, "6 + 1 - 3");
  assert.equal(dealt(swing({charged: true,  blocker: PLAIN_DEF})), 3, "a non-attack defender: no bonus");
  assert.equal(dealt(swing({charged: false, blocker: ATK_DEF})),   3, "no charge this turn: no bonus");
  assert.equal(dealt(swing({charged: true,  blocker: null})),      6, "nothing defends: no bonus");
});

/* ---- 2. CLAUSE 2 — the soul as a cost ------------------------------- */

test("the soul banish is read, and it is not a resource cost", {skip}, () => {
  const b = build("boltyn");
  assert.ok(b.HPOW, "without a powCard neither board can offer the ability");
  assert.equal(b.HPOW._attackRx, true, "it is an ATTACK REACTION, not an action");
  assert.equal(b.HPOW._soulCost, 1);
  assert.equal(b.HPOW.cost, 0, "the cost is paid in soul cards, not resources");
  assert.equal(P.abWindow(b.HPOW), "attack-reaction");
  assert.equal(P.abSoulCost(b.HPOW), 1, "one reader, and both boards ask it");
});

test("the soul cost is OPT-IN — an ability without one carries no field", {skip}, () => {
  /* v3.58's rule. A field that is always present changes the shape of
     every powCard and breaks every `deepEqual` on one. */
  assert.equal(build("kayo").HPOW ? build("kayo").HPOW._soulCost : undefined, undefined);
});

function react(o){
  const b = build("boltyn");
  const soul = [];
  for(let i = 0; i < (o.soul || 0); i++)
    soul.push({uid: 700 + i, name: "Soul " + i, tt: "Light Action", pitch: 1, tx: "", kw: []});
  const atk = Object.assign({}, H.card("Brutal Assault", 1), {uid: 601});
  const g = H.state({hand: [atk], res: 9, ap: 1, soul, buffNext: o.pump || 0}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  return {before: n, after: H.execute(n, b.HPOW, "hero", 0, {}),
          why: J.legal(Object.assign({}, n, {phase: "action", step: "reaction",
            priority: 0, passed: [], attacker: 0}),
            {t: "activate", from: "hero", uid: "hpow"}, 0)};
}

test("DRIVEN: it spends a soul card and grants the attack go again", {skip}, () => {
  const r = react({soul: 2, pump: 2});
  assert.equal(r.why, null, "legal must allow it");
  assert.equal(r.after.sides[0].soul.length, 1, "one banished");
  assert.equal(r.after.pend.ga, true);
});

test("DRIVEN: an EMPTY soul is refused, and refused BEFORE it resolves", {skip}, () => {
  /* v3.11. Refusing afterwards costs the player an activation the rules
     never allowed — and `execute` guards it too, because `reduce` is fed
     by JSON off a wire (v2.48). An unpayable cost is INERT, never free
     (v2.04). */
  const r = react({soul: 0, pump: 2});
  assert.match(String(r.why), /costs 1 from the soul/);
  assert.equal(r.after.pend.ga, false, "…and driving it anyway grants nothing");
});

test("DRIVEN: the printed qualifier still refuses an unpumped attack", {skip}, () => {
  const r = react({soul: 2, pump: 0});
  assert.match(String(r.why), /\{p\} above its base/);
  assert.equal(r.after.pend.ga, false);
});

/* ---- 3. THE FREE ACTION POINT, WHICH WAS LIVE ----------------------- */

test("DRIVEN: an attack reaction's go again is the TARGET's, not its own", {skip}, () => {
  /* THE BUG THIS VERSION FOUND, and it was two versions old. "Target
     attack … GETS GO AGAIN" grants it to the ATTACK; `fx.ga` read it as
     the ability's own, so activating one gained its controller an ACTION
     POINT (CR 5.3.5 makes go again a GAIN, not a refund).

     Three of the pool's four attack-reaction abilities print that shape —
     Bolt'n Boots, Stalker's Steps and Boltyn's hero — and NOT ONE prints a
     go again of its own. Stronger than printed, and invisible to every
     tool here: a powCard is built out of a hero's or a piece's printed
     line and is not a pool card, so neither the audit nor the fairness
     sweep ever looks at one (v3.73, two versions running). */
  const r = react({soul: 2, pump: 2});
  assert.equal(r.before.sides[0].ap, r.after.sides[0].ap,
    "the ability costs no action point AND grants none — the go again is the attack's");
  assert.equal(r.after.pend.ga, true, "…and the attack really does have it");
});

test("DRIVEN: Bolt'n Boots, the same shape one cost over", {skip}, () => {
  /* The equipment twin, live since v3.63. Driven from Azalea's real build
     so the drill measures the piece a player is handed. */
  const b = build("azalea");
  const boots = b.gear.find(g => /Bolt'n Boots/.test(g.name));
  assert.ok(boots && boots.powCard, "her Legs slot is the fixture");
  assert.equal(boots.powCard._attackRx, true);
  const atk = Object.assign({}, H.card("Swift Shot", 1), {uid: 602});
  const g = H.state({hand: [atk], res: 9, ap: 1, gear: [boots], buffNext: 2}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  const m = H.execute(n, boots.powCard, "hero", 0, {});
  assert.equal(m.sides[0].ap, n.sides[0].ap, "no action point may be gained");
  assert.equal(m.pend.ga, true, "the arrow goes again");
});

test("an ability that DOES print its own go again keeps it", {skip}, () => {
  /* THE CONTROL, and it is what stops the fix being "never grant one".
     `build.js` puts the ability's own trailing "Go again" into the
     powCard's `kw` from `parseHeroPower`; the payload's is only ever in
     the text. A synthetic powCard, because no pool card prints both. */
  const b = build("boltyn");
  const own = Object.assign({}, b.HPOW, {uid: "hpow2", kw: ["Go again"]});
  const atk = Object.assign({}, H.card("Brutal Assault", 1), {uid: 603});
  const soul = [{uid: 710, name: "Soul", tt: "Light Action", pitch: 1, tx: "", kw: []}];
  const g = H.state({hand: [atk], res: 9, ap: 1, soul, buffNext: 2}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  const m = H.execute(n, own, "hero", 0, {});
  assert.equal(m.sides[0].ap, n.sides[0].ap + 1,
    "a printed go again on the ABILITY is a real gain (CR 5.3.5)");
});
