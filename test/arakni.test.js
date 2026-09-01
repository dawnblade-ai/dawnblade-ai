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
  let printed = 0, mentionOnly = 0;
  const granted = [], asked = [];
  for(const r of pool){
    const c = mk(r);
    if(P.printedKw(c, "stealth")) printed++;
    else if(P.hasKw(c, "stealth")) mentionOnly++;
    const t = P.clean(c.tx || "");
    /* GETS/GAINS IS THE GRANT FORM. "HAS" IS THE QUESTION FORM, and this
       drill's first draft did not tell them apart — it flagged three of
       Arakni's own Agents for printing "IF IT HAS stealth", which is a
       test, not a grant. `SYNONYMS` already makes exactly this
       discrimination for pumps ("`has` is levelled only where it governs
       a pump and never where it asks a question"). */
    if(/\b(?:gets?|gains?)\s+stealth\b/i.test(t)) granted.push(c.name);
    for(const m of t.matchAll(/(.{0,14})\bhas (?:crush|dominate|go again|stealth|reprise|intimidate)\b/gi))
      if(!/\bif\b/i.test(m[1])) asked.push(c.name + ": …" + m[0] + "…");
  }
  assert.ok(printed > 0 && mentionOnly > 0,
    "both sets must be non-empty or the predicate choice is untested");
  assert.deepEqual([...new Set(granted)], [],
    "a card that GRANTS stealth means this passive needs `hasKwNow`, not `printedKw`");
  /* AND THE POOL-WIDE FACT BEHIND THE DISCRIMINATION, measured: EVERY
     "has <keyword>" in the pool is preceded by "if". A future card that
     grants one with "has" fails here and forces the decision rather than
     sliding past it. */
  assert.deepEqual([...new Set(asked)], [],
    "every `has <keyword>` in this pool is interrogative — one that is not "
    + "changes what `has` means for every reader that levels it");
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

/* ============================================================
   CLAUSE 2 — THE AGENTS OF CHAOS (v3.76)

     Arakni   "At the beginning of your end phase, if an opponent is
               marked, you become a random Agent of Chaos."
     an Agent "At the beginning of your end phase, return to the brood."

   THE DATABASE CANNOT NAME "AGENT OF CHAOS". No `types` entry, no
   `subtypes` entry and no `type_text` in 4,952 live records contains the
   word "Agent" — so the set is derived from the two things that ARE
   printed: the CLASS the sentence names, and the Demi-Hero TYPE.

   BECOMING ONE SWAPS THE ABILITY AND NOTHING ELSE. Every Agent prints
   `health: "*"` and intellect 4, and Arakni prints intellect 4.
   ============================================================ */

const E = require("../engine/effects.js");

test("the two halves are read off the printed lines", {skip}, () => {
  H.db();
  const b = build("arakni");
  assert.equal(b.becomeAgent, "chaos", "the CLASS comes off the sentence");
  assert.equal(b.returnToBrood, false, "…and she is not an Agent herself");
  const agent = B.heroAbilities(B.agentsOf(H.db(), "chaos")[0], "x");
  assert.equal(agent.returnToBrood, true);
  assert.equal(agent.becomeAgent, "", "an Agent names no set of its own");
});

test("the Agent set is exactly six, and derived rather than listed", {skip}, () => {
  /* A HAND-WRITTEN LIST WOULD BE INVENTING CARD TEXT AT THE SET LEVEL.
     The rule is `Demi-Hero` (the structured type array, v2.44's authority)
     intersected with the class the printed sentence names. Measured over
     the whole live database: exactly six Demi-Heroes carry Chaos, and they
     are exactly the six Arakni's own `referenced_cards` names. */
  const six = B.agentsOf(H.db(), "chaos");
  assert.deepEqual(six.map(c => c.n), [
    "Arakni, Black Widow", "Arakni, Funnel Web", "Arakni, Orb-Weaver",
    "Arakni, Redback", "Arakni, Tarantula", "Arakni, Trap-Door"]);
  /* THE ORDER IS STABLE, because "random" must be reproducible: two peers
     replaying one log pick the same index out of the same seeded stream,
     and an unstable order would make them different Agents (v2.26). */
  assert.deepEqual(six.map(c => c.n).slice().sort(), six.map(c => c.n));
  /* and the class is really being read — a different one gives a
     different set, not the same one */
  const shadow = B.agentsOf(H.db(), "shadow").map(c => c.n);
  assert.ok(shadow.length > 0 && !shadow.some(n => six.some(x => x.n === n)),
    "the class word selects, so it cannot be decoration");
  assert.deepEqual(B.agentsOf(H.db(), ""), [], "and an absent class names nobody");
});

test("every Agent is life-`*` and intellect 4, which is why only the ABILITY swaps", {skip}, () => {
  /* THE MEASUREMENT THE WHOLE BUILD RESTS ON. If an Agent printed its own
     life, becoming one would be a different and much larger mechanic. */
  const b = build("arakni");
  for(const a of B.agentsOf(H.db(), "chaos")){
    assert.equal(a.hp, null, a.n + " prints life `*`");
    assert.equal(a.int, 4, a.n + " prints intellect 4");
  }
  assert.equal(b.int, 4, "…and so does Arakni, so the swap changes neither");
});

function broodBoard(marked, seed){
  return H.state({}, {marked: marked ? 1 : 0}, {actor: 0, turnPlayer: 0, turn: 3,
    builds: [build("arakni"), {}], seed: seed || "brood"});
}
const endPhase = g => E.beginEndPhase(g, 0, H.db());

test("DRIVEN: a marked opponent turns her into an Agent", {skip}, () => {
  H.db();
  const out = endPhase(broodBoard(true));
  const now = out.game.builds[0];
  assert.match(now.heroRec.n, /^Arakni, /);
  assert.notEqual(now.heroRec.n, "Arakni, Web of Deceit");
  assert.equal(now.returnToBrood, true, "and it knows how to go home");
  assert.equal(now._brood.n, "Arakni, Web of Deceit", "…and who home is");
  assert.ok(out.fired.includes("agent"));
});

test("DRIVEN: nobody marked, nothing happens", {skip}, () => {
  /* THE GATE. Without it she cycles every turn of every game, which is
     strictly stronger than printed and would make the mark — the thing
     half her deck is built to apply — worth nothing. */
  H.db();
  const out = endPhase(broodBoard(false));
  assert.equal(out.game.builds[0].heroRec.n, "Arakni, Web of Deceit");
  assert.equal(out.game.builds[0]._brood, undefined);
  assert.ok(!out.fired.includes("agent"));
});

test("DRIVEN: RETURN comes before BECOME, which is what makes it a cycle", {skip}, () => {
  /* Both lines fire at the beginning of the same end phase. Return first
     and an Agent goes home, Arakni's clause fires and a NEW Agent takes
     the seat. Reversed, she would become one and immediately return, and
     the mechanic would be invisible. */
  H.db();
  let g = broodBoard(true, "cycle");
  const seen = [];
  for(let t = 0; t < 6; t++){
    const out = endPhase(g); g = out.game;
    seen.push(g.builds[0].heroRec.n);
  }
  assert.equal(seen.length, 6);
  assert.ok(seen.every(n => n !== "Arakni, Web of Deceit"),
    "she is an Agent at the END of every end phase, never resting in the brood");
  assert.ok(new Set(seen).size > 1, "and not the same Agent every time");
  assert.equal(g.builds[0]._brood.n, "Arakni, Web of Deceit",
    "the brood is remembered throughout, never overwritten by an Agent");
});

test("the brood survives a swap that did NOT return first", {skip}, () => {
  /* A SYNTHETIC BUILD, because no reachable state produces one. In play
     RETURN always runs first, so by the time BECOME fires `heroRec` is
     already the brood and `cur._brood || cur.heroRec` picks the same card
     either way — which is exactly why sabotaging the `||` away was SILENT
     against every driven drill above.

     THE GUARD IS STILL REAL, and this is what it guards: `builds` crosses
     the wire, and `reduce` is fed by JSON off it (v2.48). A state that
     arrives mid-transformation — an Agent in `heroRec` with the brood
     still recorded — must not have its brood overwritten by the Agent,
     because that is Arakni lost for the rest of the game with no way
     home. Dead-looking rules code with a reachable bad state behind it is
     worth a drill rather than a deletion. */
  H.db();
  const six = B.agentsOf(H.db(), "chaos");
  const home = build("arakni").heroRec;
  const hybrid = Object.assign({}, build("arakni"),
    B.heroAbilities(six[0], six[0].n),
    {_brood: home, becomeAgent: "chaos", returnToBrood: false});
  const g = H.state({}, {marked: 1}, {actor: 0, turnPlayer: 0, turn: 3,
    builds: [hybrid, {}], seed: "hybrid"});
  const out = endPhase(g);
  assert.equal(out.game.builds[0]._brood.n, "Arakni, Web of Deceit",
    "the brood is who she WAS, not the Agent she was standing in when it fired");
});

test("DRIVEN: the pick is SEEDED and the rng is stored back", {skip}, () => {
  /* v2.26. Two peers replaying one log must become the same Agent, and a
     forgotten store-back repeats the last draw forever — `rng.n` is the
     canary that says the stream moved. */
  H.db();
  const a = endPhase(broodBoard(true, "seed-a"));
  const b2 = endPhase(broodBoard(true, "seed-a"));
  const c = endPhase(broodBoard(true, "seed-z"));
  assert.equal(a.game.builds[0].heroRec.n, b2.game.builds[0].heroRec.n,
    "same seed, same Agent");
  assert.ok(a.game.rng.n > broodBoard(true, "seed-a").rng.n,
    "the draw counter moved — the rng was stored back");
  const names = new Set();
  for(const s of ["s1","s2","s3","s4","s5","s6","s7","s8"])
    names.add(endPhase(broodBoard(true, s)).game.builds[0].heroRec.n);
  assert.ok(names.size > 1, "and different seeds really do give different Agents");
  assert.ok(c.game.builds[0].heroRec.n, "the control seed produced one at all");
});

test("DRIVEN: the ability swaps and the rest of the build does NOT", {skip}, () => {
  /* THE WHOLE CLAIM, in one assertion each way. Her stealth passive is
     GONE while she is an Agent — which is what the cards say: you have the
     Agent's ability, not your own — and her life, intellect and deck are
     untouched. */
  H.db();
  const before = build("arakni");
  const after = endPhase(broodBoard(true)).game.builds[0];
  assert.equal(before.stealthMarkedBuff, 1);
  assert.equal(after.stealthMarkedBuff, 0, "an Agent does not print her passive");
  assert.equal(after.becomeAgent, "", "…nor her transformation");
  assert.equal(after.hp, before.hp, "life is untouched");
  assert.equal(after.int, before.int, "and so is intellect");
  assert.equal(after.HZOOM.name, after.heroRec.n,
    "and the card the hero row shows follows the Agent, or the swap is invisible");
});

test("the db is the CALLER's answer, and an absent one becomes nobody", {skip}, () => {
  /* v3.24's direction: a caller that says nothing gets the weaker,
     visible outcome rather than a guess. `beginEndPhase` is module-level
     and pure — judge registers a database with `setDb`, the trainer holds
     the loaded one, and neither is reachable from inside. */
  H.db();
  const out = E.beginEndPhase(broodBoard(true), 0);
  assert.equal(out.game.builds[0].heroRec.n, "Arakni, Web of Deceit");
  assert.ok(out.msgs.some(m => /no Agent of chaos/.test(m)),
    "…and it says so rather than failing silently");
});

test("the trainer's build ledger is on the STATE, not in a closure", {skip}, () => {
  /* THE FIRST RULE THAT EVER CHANGED A HERO (v3.76), and it exposed that
     one board could not express it. `bAct` read `built.both` — a `useMemo`
     constant, immutable by construction — so the transformation would have
     been announced in the feed while every passive kept answering for the
     hero she used to be. That is v3.01's one-board shape, created
     deliberately rather than found, and the sev-2 category where the feed
     and the state disagree.

     ALL THREE HELPERS TAKE THE STATE NOW. `bOf` used to close over `g`,
     which inside a `setG` reducer is the PREVIOUS state — harmless while
     the only thing it read was `_dummy` and a stale read waiting to matter
     the moment a build does. */
  const html = require("fs").readFileSync(
    require("path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const _blds = s => \(s && s\.builds\) \|\| built\.both;/,
    "one reader for the ledger, taking the state");
  for(const h of ["bOf", "bAct", "bFoe"])
    assert.match(html, new RegExp("const " + h + "\\s+=\\s+\\(?s"),
      h + " must take the state rather than closing over it");
  assert.match(html, /builds: built\.both\.map\(b => \{ const \{deck, gear, \.\.\.rest\} = b/,
    "…and the state is seeded with the construction inputs stripped, the way "
    + "`judge.newMatch` strips them");
  const S = require("../engine/sides.js");
  assert.ok(S.GAME_KEYS.indexOf("builds") >= 0,
    "a new top-level state field must have a home in sides.js, or the census "
    + "reports it unclassified");
});

/* ---- AN AGENT'S OWN STATIC (v3.77) ---------------------------------- */

test("Tarantula's dagger drain is read off her line, and only hers", {skip}, () => {
  H.db();
  const six = B.agentsOf(H.db(), "chaos");
  const tara = six.find(a => /Tarantula/.test(a.n));
  assert.ok(tara, "she must be in the set");
  assert.equal(B.heroAbilities(tara, tara.n).daggerDrain, 1);
  assert.equal(build("arakni").daggerDrain, 0, "the brood does not print it");
  for(const a of six.filter(x => x !== tara))
    assert.equal(B.heroAbilities(a, a.n).daggerDrain, 0, a.n + " does not either");
});

function asAgent(name){
  const a = B.agentsOf(H.db(), "chaos").find(x => new RegExp(name).test(x.n));
  return Object.assign({}, build("arakni"), B.heroAbilities(a, a.n),
                       {_brood: build("arakni").heroRec});
}
function weaponSwing(bd, piece){
  const g = H.state({gear: [piece], res: 9, ap: 1, hand: []}, {hp: 20, hand: []},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
  const n = H.execute(g, piece, "weapon", 0, {});
  return 20 - J.withEffects(n, (fx, s) => fx.resolveStack(s)).sides[1].hp;
}
const DAGGER = () => Object.assign({},
  build("arakni").gear.find(g => /dagger/i.test(g.tt || "")), {uid: 900});
const SWORD = {uid: 901, name: "Plain Sword", tt: "Generic Weapon - Sword (1H)",
               ty: ["Generic", "Weapon", "Sword"], power: 1, cost: null, pitch: 0,
               def: null, kw: [], tx: "Once per Turn Action - {r}: Attack"};

test("DRIVEN: as Tarantula a DAGGER drains one more, and a sword does not", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). The sword is matched
     to the dagger's printed power on purpose, so the two swings differ by
     the drain alone and nothing else can explain the number. */
  H.db();
  const dagger = DAGGER();
  assert.equal(dagger.power, SWORD.power, "the fixtures must swing for the same base");
  const tara = asAgent("Tarantula");
  assert.equal(weaponSwing(build("arakni"), dagger), dagger.power,
    "in the brood the dagger swings for its printed power");
  assert.equal(weaponSwing(tara, dagger), dagger.power + 1, "…and one more as Tarantula");
  assert.equal(weaponSwing(tara, SWORD), SWORD.power,
    "a sword is not a dagger — a passive that fires on any weapon is wrong "
    + "the moment she equips one");
});

test("DRIVEN: a dagger fully blocked drains nothing", {skip}, () => {
  /* "HITS a hero" — CR 7.5.5, prevented is not dealt. A drain that fires
     off a blocked swing is a printed trigger turned into an unconditional
     one, which is the direction that steals games. */
  H.db();
  const tara = asAgent("Tarantula");
  const dagger = DAGGER();
  const wall = {uid: 910, name: "Wall", tt: "Generic Action", pitch: 1, cost: 1,
                power: 0, def: 9, tx: "", kw: []};
  const g = H.state({gear: [dagger], res: 9, ap: 1, hand: []},
                    {hp: 20, hand: [wall]}, {actor: 0, turnPlayer: 0, turn: 3,
                                             builds: [tara, {}]});
  let n = H.execute(g, dagger, "weapon", 0, {});
  n = {...n, stack: [...n.stack, {k: "def", uid: 910}]};
  const out = J.withEffects(n, (fx, s) => fx.resolveStack(s));
  assert.equal(20 - out.sides[1].hp, 0);
});

test("the drain magnitude is READ, not the 1 she happens to print", {skip}, () => {
  /* SHE PRINTS 1, SO NO POOL FIXTURE CAN TELL A READ NUMBER FROM A
     HARDCODED ONE (v3.32, v3.74). Sabotaging the capture to a literal was
     SILENT against every driven drill in this file; a synthetic hero
     record is the only thing that sees it. */
  const three = {n: "Arakni, Synthetic", tt: "Chaos Demi-Hero",
                 ty: ["Chaos", "Demi-Hero"], health: "*", intellect: 4,
                 tx: "Whenever a dagger you own hits a hero, they lose 3{h}.\n"
                   + "At the beginning of your end phase, return to the brood."};
  assert.equal(B.heroAbilities(three, three.n).daggerDrain, 3);
  const zero = Object.assign({}, three, {tx: "At the beginning of your end "
                 + "phase, return to the brood."});
  assert.equal(B.heroAbilities(zero, zero.n).daggerDrain, 0,
    "and a line that does not print it grants nothing");
});

function paid(o){
  /* THE SHARED BODY, DRIVEN DIRECTLY, because `heroHit` is the CALLER's
     answer (CR 1.4.5) and only judge can route an attack at an ally. The
     trainer wires no ally targeting at all, so the ally half of this rule
     is unreachable through `resolveStack` and asserting on that board
     alone would prove the hero half twice. Same driver `briar.test.js`
     uses for the same reason. */
  H.db();
  const dagger = DAGGER();
  const g = H.state({gear: [dagger], res: 9, ap: 1, hand: []}, {hp: 20, hand: []},
                    {actor: 0, turnPlayer: 0, turn: 3,
                     builds: [asAgent("Tarantula"), {}]});
  g.pend = {card: o.card || dagger, from: o.from || "weapon", total: 2, ga: false,
            ops: [], onHit: [], onHitHero: [], condOnHit: [], lateConds: [],
            lateOps: []};
  /* THE 2 IS NOT IN THIS NUMBER. Both callers subtract the damage dealt
     from life BEFORE calling this body — its own header says so — so what
     comes back here is the DRAIN alone, which is exactly what is under
     test. (Written expecting 2 the first time: check your own fixture.) */
  const out = H.fx(g, (fx, n) => fx.linkPayload(n, {total: 2, pumps: 0,
    handBlockers: 0, defenders: 0, blkNote: "",
    heroHit: o.heroHit !== false})).game;
  return 20 - out.sides[1].hp;
}

test("DRIVEN: a dagger that hits an ALLY drains no hero — CR 1.4.5", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A gate that refuses
     everything passes the ally half perfectly, so the hero half is
     asserted against the identical fixture one flag over. */
  assert.equal(paid({}), 1, "the hero half: her printed 1, on top of the 2 dealt");
  assert.equal(paid({heroHit: false}), 0,
    "an ally is an attack-target (CR 1.4.5) and is not the hero the line names");
});

test("DRIVEN: the route is not the restriction — a dagger CARD drains too", {skip}, () => {
  /* "A DAGGER YOU OWN HITS A HERO" NAMES AN OBJECT, NOT A ROUTE. Measured:
     the pool prints two Dagger records and both are Weapons, so this is
     LATENT — and a reader that refuses one is reading the card wrong
     whether or not anything notices today (v3.73). The negative control
     is the same swing with a sword's type line. */
  const asCard = {uid: 902, name: "Synthetic Dirk", tt: "Assassin Attack Action - Dagger",
                  ty: ["Assassin", "Action", "Attack"], power: 2, pitch: 1,
                  cost: 1, def: 2, kw: [], tx: ""};
  assert.equal(paid({card: asCard, from: "hand"}), 1, "her printed 1, off a card");
  const notDagger = Object.assign({}, asCard, {tt: "Assassin Attack Action - Sword"});
  assert.equal(paid({card: notDagger, from: "hand"}), 0, "…and a sword is not one");
  /* THE SUBTYPE IS A WORD, NOT A SUBSTRING. Dropping the word boundary was
     SILENT against every other fixture here, because nothing real spells
     one inside another — the same shape as "Reaction" containing "action"
     (v2.44), which this project has now been bitten by three times. */
  const nearMiss = Object.assign({}, asCard,
    {tt: "Assassin Attack Action - Daggerfall Sword"});
  assert.equal(paid({card: nearMiss, from: "hand"}), 0,
    "a Daggerfall Sword is not a Dagger");
});

test("becoming Tarantula is no longer a pure downgrade", {skip}, () => {
  /* THE POINT OF BUILDING IT. Before v3.77 every Agent's ability refused,
     so the transformation cost Arakni her own readable passive and gave
     nothing back — faithful to what was built, and not what the cards do.
     One of the six pays out now; the other five refuse on their COST
     (`Discard an Assassin card`), which is recorded in HANDOFF.md. */
  H.db();
  const built = B.agentsOf(H.db(), "chaos")
    .map(a => B.heroAbilities(a, a.n))
    .filter(ab => ab.daggerDrain > 0 || ab.HPOW);
  assert.equal(built.length, 1,
    "exactly one Agent has something the engine can run — when a second "
    + "arrives, this number is a deliberate edit");
});

test("the pinned pool carries the Agents at all", {skip}, () => {
  /* THE POOL AND THE PHONE MUST AGREE ON WHAT A CARD IS (v3.21).
     `tools/pin-pool.js` keeps a Demi-Hero by TYPE and `index.html`'s
     loader keeps one by the identical test — so the Node tools and the
     browser can both see what Arakni becomes. Without it the fixture and
     production reason about different pools, each internally consistent. */
  const pool = require("../data/pool.json");
  const demi = pool.filter(c => /demi-hero/i.test(c.type_text || ""));
  assert.ok(demi.length >= 6, "the pool must carry the Demi-Heroes");
  const html = require("fs").readFileSync(
    require("path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const isDemi = \/demi-hero\/i\.test\(c\.type_text\|\|""\)/,
    "the loader keeps them by the same rule, or the phone cannot mint one");
  assert.match(html, /!isDemi/, "…and actually consults it");
});
