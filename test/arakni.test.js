/* ============================================================
   ARAKNI, WEB OF DECEIT — clause 1 (v3.75)

     "Your attacks with stealth that are attacking a marked hero get
      +1{p} and \"When this hits, this gets go again.\""

   HER ONE MECHANIC IS STEALTH + MARKED, and the deck says so: 18 pool
   cards print stealth, Mark of the Huntsman destroys itself to mark a
   hero, and half a dozen of her cards read one or the other.

   THREE GATES, ALL SETTLED AT DECLARATION — the mark is already on the
   opposing hero, stealth is a printed fact, and the attack-target is the
   caller's answer. So this is not a late condition (v3.71): there is
   nothing here the wall can change.

   Clause 2 is the Agent-of-Chaos transformation and is a separate build;
   see HANDOFF.md for what it needs and what is measured about it.
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
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("arakni"), {n: 0}).b;
  return _b[k];
}

test("the buff is a build passive with the number off the line", {skip}, () => {
  assert.equal(build("arakni").stealthMarkedBuff, 1);
  assert.equal(build("kayo").stealthMarkedBuff, 0, "…and nobody else has it");
});

test("NOTHING IN THE POOL GRANTS STEALTH, which is why `printedKw` is right", {skip}, () => {
  /* v2.84's three questions. 18 pool cards PRINT stealth and 7 more only
     NAME it — Night's Embrace, Stalker's Steps, Stains of the Redback and
     four others all say "attacks with stealth" without carrying the
     keyword. `hasKw` would hand her bonus to every one of them.

     THE MEASUREMENT IS THE DRILL. If upstream ever prints a card that
     GRANTS stealth this fails, and the right answer then is `hasKwNow`
     plus `_kwGrant` — which is a decision, not a silent widening. */
  H.db();
  const pool = require("../data/pool.json");
  const mk = r => ({name: r.name, pitch: r.pitch, tt: r.tt || r.type_text,
                    ty: r.ty || r.types, tx: r.tx || r.functional_text,
                    kw: r.kw || r.card_keywords || [], power: r.power});
  let printed = 0, mentionOnly = 0, granted = [];
  for(const r of pool){
    const c = mk(r);
    if(P.printedKw(c, "stealth")) printed++;
    else if(P.hasKw(c, "stealth")) mentionOnly++;
    if(/\b(?:gets?|gains?|has)\s+stealth\b/i.test(P.clean(c.tx || ""))) granted.push(c.name);
  }
  assert.ok(printed > 0 && mentionOnly > 0,
    "both sets must be non-empty or the predicate choice is untested");
  assert.deepEqual([...new Set(granted)], [],
    "a card that GRANTS stealth means this passive needs `hasKwNow`, not `printedKw`");
});

function swing(o){
  const b = build("arakni");
  const atk = Object.assign({}, o.card, {uid: 600});
  const g = H.state({hand: [atk], res: 9, ap: 1},
                    {hp: 20, marked: o.marked ? 1 : 0, hand: o.wall ? [o.wall] : []},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, atk, "hand", 0, o.target ? {target: o.target} : {});
  return n;
}
const stealthAtk = () => build("arakni").deck.find(c => P.printedKw(c, "stealth") && P.isAttack(c));
const plainAtk   = () => build("arakni").deck.find(c => !P.printedKw(c, "stealth") && P.isAttack(c));

test("DRIVEN: all three gates, and each one alone is not enough", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A passive that fires
     on everything passes the positive case perfectly, so every gate is
     driven from the same board with one fact changed. */
  H.db();
  const s = stealthAtk(), p = plainAtk();
  assert.ok(s && p, "her real deck supplies both fixtures");
  const base = s.power || 0;
  assert.equal(swing({card: s, marked: true}).pend.total, base + 1);
  assert.equal(swing({card: s, marked: false}).pend.total, base,
    "no mark: no bonus");
  assert.equal(swing({card: p, marked: true}).pend.total, p.power || 0,
    "no stealth: no bonus");
  assert.equal(swing({card: s, marked: true,
    target: {kind: "ally", uid: 99, side: 1}}).pend.total, base,
    "CR 1.4.5 — an attack on an ALLY is not attacking a hero, marked or not");
});

test("DRIVEN: an attack that only MENTIONS stealth does not have it", {skip}, () => {
  /* `printedKw` IS THE PREDICATE, and the drill above cannot tell it from
     `hasKw`: her non-stealth fixture does not name the keyword either, so
     the two predicates agree on it and the sabotage is SILENT (v3.26,
     and Bravo's Crash and Bash one hero over).

     SEVEN POOL CARDS NAME STEALTH WITHOUT CARRYING IT and not one of them
     is an attack, so the fixture is synthetic — the smallest card that
     tells the two predicates apart. */
  H.db();
  const bait = {uid: 605, name: "Stealth Namer", tt: "Assassin Action - Attack",
                ty: ["Assassin", "Action", "Attack"], pitch: 1, cost: 1,
                power: 3, def: 2, kw: [],
                /* THE TEXT MUST NAME STEALTH AND READ AS NOTHING ELSE. The
                   first draft said "Target attack with stealth gets +1{p}"
                   and the card pumped ITSELF by 1 — so it passed the
                   sabotage for the wrong reason and failed the honest
                   engine. Check your own fixture (v3.70, fifth time). */
                tx: "The web trembles where stealth has passed."};
  assert.equal(P.hasKw(bait, "stealth"), true, "it does name stealth…");
  assert.equal(P.printedKw(bait, "stealth"), false, "…and it does not carry it");
  assert.equal(swing({card: bait, marked: true}).pend.total, 3,
    "so it gets no bonus");
  /* the positive control, in the same shape, or this passes against a
     passive that fires for nobody */
  const real = Object.assign({}, bait, {uid: 606, name: "Stealth Carrier",
    kw: ["Stealth"], tx: "Stealth"});
  assert.equal(P.fxParse(bait).self || 0, 0,
    "and the bait must pump NOTHING of its own, or it passes for the wrong reason");
  assert.equal(P.printedKw(real, "stealth"), true);
  assert.equal(swing({card: real, marked: true}).pend.total, 4);
});

test("DRIVEN: the rider is an ON-HIT go again, not an unconditional one", {skip}, () => {
  /* "When this hits, this gets go again." Filed unconditionally it is a
     free action point on a swing that was fully blocked — which is the
     direction that steals games. */
  H.db();
  const s = stealthAtk();
  assert.deepEqual(swing({card: s, marked: true}).pend.onHit, [["ga"]]);
  assert.deepEqual(swing({card: s, marked: false}).pend.onHit, [],
    "and an ungated swing carries no rider at all");
});

test("DRIVEN: it lands on a hit and fizzles on a full block", {skip}, () => {
  /* GO ALL THE WAY TO THE OBSERVABLE. `pend.onHit` is a list nobody feels;
     the ACTION POINT is what the player keeps or spends (CR 5.3.5). */
  H.db();
  const b = build("arakni");
  const s = stealthAtk();
  const run = wallDef => {
    const atk = Object.assign({}, s, {uid: 601});
    const wall = wallDef ? {uid: 610, name: "Wall", tt: "Generic Action", pitch: 1,
                            cost: 1, power: 0, def: wallDef, tx: "", kw: []} : null;
    let g = H.state({hand: [atk], res: 9, ap: 1},
                    {hp: 20, marked: 1, hand: wall ? [wall] : []},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    let n = H.execute(g, atk, "hand", 0, {});
    if(wall) n = {...n, stack: [...n.stack, {k: "def", uid: 610}]};
    return J.withEffects(n, (fx, st) => fx.resolveStack(st));
  };
  assert.equal(run(0).sides[0].ap, 1, "it hit — the action point is kept");
  assert.equal(run(9).sides[0].ap, 0, "fully blocked — the rider fizzles");
});

test("DRIVEN: the same bonus lands at the TABLE", {skip}, () => {
  /* v3.01: a rule is written per board, so ask which one runs it. This one
     lives in `execute`, which both boards call — and "both call it" is a
     claim until something drives it. */
  H.db();
  const b = build("arakni");
  const s = Object.assign({}, stealthAtk(), {uid: 700});
  let g = H.state({name: "Arakni", hand: [s], res: 9, ap: 1},
                  {name: "Them", hp: 20, res: 0, hand: [], marked: 1},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const send = (a, seat) => {
    const r = J.reduce(g, a, seat);
    assert.equal(r.error, null, a.t + " was refused: " + r.error);
    g = r.state;
  };
  send({t: "play", uid: 700, from: "hand"}, 0);
  for(let i = 0; i < 80 && g.pend; i++){
    if(g.prompt){ send(J.autoAnswer(g), g.prompt.side || 0); continue; }
    if(g.priority == null) break;
    send({t: "pass"}, g.priority);
  }
  assert.equal(g.pend, null, "the link never resolved — the drill would prove nothing");
  assert.equal(20 - g.sides[1].hp, (s.power || 0) + 1);
});
