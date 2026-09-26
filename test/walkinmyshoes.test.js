/* ============================================================
   WALK IN MY SHOES — A HALVING THAT STARTS AND ENDS MID-GAME (v4.73)

   "Crush - When this deals 4 or more damage to a hero, until the end of
    their next turn, the base {p} and {d} of attack action cards they
    control are halved, rounded up."

   The last crush rider of twelve, refused since v3.29 on a stated reason:
   `halveCard` runs once at the DEAL, and that is the whole of v3.78's
   safety argument — thirty readers of a card's base value is thirty
   chances to miss one. The build keeps the argument rather than dropping
   it: the value still lives ON THE CARD, so every reader sees it without
   being told, and only the two moments the window changes re-stamp it.

   WHAT EACH DRILL IS FOR:
     1  the parse — the whole printed shape or nothing (v2.29)
     2  the stamp — live at once, attack action cards only, every zone,
        opt-in, derived off the schedule so windows stack and unstack
     3  driven at the table — the crush halves on the spot, their next
        attack swings halved, their end phase restores
     4  the trainer arms seat 1, or the halving could never expire there
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

const atk = (u, pw, df) => ({name: "Swing " + u, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: pw, def: df, pitch: 1, cost: 0, uid: u});
const rite = (u, df) => ({name: "Rite " + u, tt: "Generic Action", ty: ["Generic", "Action"],
  tx: "", kw: [], def: df, pitch: 1, cost: 0, uid: u});
const dr = (u, df) => ({name: "Parry " + u, tt: "Generic Defense Reaction", ty: ["Generic", "Defense Reaction"],
  tx: "", kw: [], def: df, pitch: 1, cost: 0, uid: u});
const HALVE = ["foeNextTurn", "halveBase", 0];

/* ---- 1. THE PARSE -------------------------------------------------------- */

const RIDER = "until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up";

test("the rider reads as a halving on THEIR schedule", () => {
  const r = P.classifyClause(RIDER);
  assert.ok(r && r.status === "run", "the rider stopped reading");
  assert.deepEqual(r.ops, [HALVE]);
});

test("near-misses refuse — the whole printed shape or nothing (v2.29)", () => {
  /* each one is a DIFFERENT card: a rounding the other way, a halving of
     one symbol, a different subject, a different window. Read as this one,
     every one of them is wrong about a number the player fights with. */
  for(const s of [
    RIDER.replace("rounded up", "rounded down"),
    RIDER.replace("{p} and {d}", "{p}"),
    RIDER.replace("attack action cards", "cards"),
    RIDER.replace("until the end of their next turn", "until end of turn")
  ]) assert.equal(P.classifyClause(s), null, "read a near-miss: " + s);
});

test("the whole card reads in full, and the crush is gated on a HERO", {skip}, () => {
  H.db(); P.fxReset();
  const fx = P.fxParse(H.card("Walk in My Shoes", 2));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.crush, {n: 4, ops: [HALVE], heroOnly: true});
});

/* ---- 2. THE STAMP -------------------------------------------------------- */

const pushed = (foe) => {
  P.fxReset();
  return H.runOps(H.state({}, foe, {turn: 3}), [HALVE], "Walk in My Shoes");
};

test("it is LIVE the moment it is pushed — until the end of their next turn includes THIS one", () => {
  const g = pushed({hand: [atk("a", 6, 3)]});
  assert.equal(g.sides[1].nextTurn[0].ready, false, "the entry is armed for its END like every other kind");
  assert.deepEqual([g.sides[1].hand[0].power, g.sides[1].hand[0].def], [3, 2],
    "armed-is-not-live is the OTHER kinds' rule — this one halves now");
  assert.deepEqual(g.sides[0].hand || [], [], "the actor's own cards are untouched");
});

test("ATTACK ACTION CARDS only — a non-attack, a defence reaction and a weapon keep their numbers", () => {
  const sword = {name: "Probe Sword", tt: "Warrior Weapon - Sword (1H)", ty: ["Warrior", "Weapon", "Sword"],
                 tx: "", kw: [], power: 4, pitch: 0, uid: "sw"};
  const g = pushed({hand: [atk("a", 5, 3), rite("r", 3), dr("d", 4)], gear: [sword]});
  const [a, r, d] = g.sides[1].hand;
  assert.deepEqual([a.power, a.def], [3, 2], "5 and 3 round UP to 3 and 2");
  assert.equal(r.def, 3, "a non-attack action card was halved");
  assert.equal(d.def, 4, "a defence reaction was halved — \"Reaction\" contains \"action\" (v2.44)");
  assert.equal(g.sides[1].gear[0].power, 4, "a weapon was halved — it is not an attack action card");
});

test("rounded UP — a 1 stays 1, and a card with no printed value gains none", () => {
  const g = pushed({hand: [atk("one", 1, 1), atk("zero", 0, null)]});
  const [one, zero] = g.sides[1].hand;
  assert.deepEqual([one.power, one.def], [1, 1], "floor would read a 1-power attack as a blank");
  assert.deepEqual([zero.power, zero.def], [0, null]);
  assert.equal("_unhalvedPow" in one, false, "a value that did not MOVE carries no stamp (opt-in, v3.58)");
});

test("every zone they hold is stamped — the stated approximation", () => {
  const g = pushed({hand: [atk("h", 6, 3)], deck: [atk("k", 6, 3)], grave: [atk("g", 6, 3)],
                    banish: [atk("b", 6, 3)], pitch: [atk("p", 6, 3)], arsenal: atk("r", 6, 3)});
  const sd = g.sides[1];
  for(const [z, c] of [["hand", sd.hand[0]], ["deck", sd.deck[0]], ["grave", sd.grave[0]],
                       ["banish", sd.banish[0]], ["pitch", sd.pitch[0]], ["arsenal", sd.arsenal]])
    assert.equal(c.power, 3, "the " + z + " was not stamped");
  /* the card they DRAW during their next turn is the point of the deck */
});

test("two windows QUARTER, and the first to close leaves the second standing", () => {
  let g = pushed({hand: [atk("a", 7, 5)]});
  g = H.runOps(g, [HALVE], "Walk in My Shoes");
  assert.deepEqual([g.sides[1].hand[0].power, g.sides[1].hand[0].def], [2, 2], "7 -> 4 -> 2, 5 -> 3 -> 2");
  /* the first window was armed at their turn; a second, pushed AFTER that
     turn began, is aimed at the one after and must survive its expiry. */
  g = E.armNextTurn(pushed({hand: [atk("a", 7, 5)]}), 1).game;
  g = H.runOps(g, [HALVE], "Walk in My Shoes");
  const out = E.beginEndPhase(g, 1).game;
  assert.equal(out.sides[1].nextTurn.length, 1, "the later window was dropped with the earlier one");
  assert.equal(out.sides[1].hand[0].power, 4, "one window closed: 7 halves once, not twice and not zero times");
});

test("the end of their next turn RESTORES, and the stamp goes with it", () => {
  let g = E.armNextTurn(pushed({hand: [atk("a", 6, 3)], deck: [atk("k", 5, 2)]}), 1).game;
  const out = E.beginEndPhase(g, 1).game;
  const [a] = out.sides[1].hand;
  assert.deepEqual([a.power, a.def], [6, 3]);
  assert.equal("_unhalvedPow" in a || "_unhalvedDef" in a, false, "a stamp outlived its window");
  assert.equal(out.sides[1].deck[0].power, 5);
});

test("a window that has NOT been armed survives an end phase — it is aimed at their NEXT turn", () => {
  /* the crush lands on MY turn; MY end phase must not drop it. */
  const g = pushed({hand: [atk("a", 6, 3)]});
  const out = E.beginEndPhase(g, 1).game;
  assert.equal(out.sides[1].hand[0].power, 3, "the window closed a whole turn early");
});

test("a mirror composes with Lyath's own deal-time halving — nested ceilings, either order", () => {
  /* a Lyath deck's 7 is dealt at 4 (v3.78); the window halves THAT. */
  const dealt = {...atk("L", 4, 2), _printedPow: 7, _printedDef: 3};
  const g = pushed({hand: [dealt]});
  const c = g.sides[1].hand[0];
  assert.equal(c.power, 2, "ceil(ceil(7/2)/2) is 2");
  assert.equal(c._printedPow, 7, "the deal's own record of the printed value was touched");
  const back = E.beginEndPhase(E.armNextTurn(g, 1).game, 1).game.sides[1].hand[0];
  assert.equal(back.power, 4, "the window restored PAST the deal's halving");
});

/* ---- 3. DRIVEN AT THE TABLE ---------------------------------------------- */

function table(buff){
  H.db(); P.fxReset();
  const w = {...H.card("Walk in My Shoes", 2), uid: "w"};
  return {...H.state({res: 3, ap: 1, hand: [w], buffNext: buff},
                     {hp: 20, res: 0, hand: [atk("t1", 6, 3), rite("t2", 3)], deck: [atk("t3", 5, 2)], board: []},
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const pass = n => { const o = J.reduce(n, {t: "pass"}, n.priority); if(o.error) throw new Error(o.error); return o.state; };
const toDamage = g => {
  let n = H.drain(J.reduce(g, {t: "play", uid: "w", from: "hand"}, 0).state);
  for(let i = 0; i < 40 && !(n.chain || []).length; i++) n = pass(n);
  return n;
};

test("4 or more to a hero halves their attack action cards ON THE SPOT", {skip}, () => {
  /* 3 printed, +1 from a waiting grant, and the card's own "if this has {p}
     greater than its base" makes it 5 — past the printed threshold. */
  const n = toDamage(table(1));
  assert.equal(n.sides[1].hp, 15, "fixture: the swing did not connect for 5");
  const [a, r] = n.sides[1].hand;
  assert.deepEqual([a.power, a.def], [3, 2]);
  assert.equal(r.def, 3, "their non-attack was halved");
  assert.equal(n.sides[1].deck[0].power, 3, "the card they will draw was not halved");
});

test("3 to a hero halves NOTHING — the crush threshold is the card's own 4", {skip}, () => {
  const n = toDamage(table(0));
  assert.equal(n.sides[1].hp, 17, "fixture: the unbuffed swing did not connect for 3");
  assert.equal(n.sides[1].hand[0].power, 6);
  assert.equal((n.sides[1].nextTurn || []).length, 0);
});

/* close the open chain, then hand the turn over the way judge's own drills
   do — `endTurn` is a pass carrying intent (v2.46), and the end phase's
   arsenal step asks the turn-player (CR 4.4.3b). */
const settle = n => {
  for(let i = 0; i < 60 && n.priority != null && (n.pend || n.step !== "layer"); i++) n = pass(n);
  return n;
};
const passTurn = g => {
  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  return n;
};

test("their next attack SWINGS halved, and their end phase gives the numbers back", {skip}, () => {
  let n = passTurn(settle(toDamage(table(1))));
  assert.equal(n.turnPlayer, 1, "fixture: the turn never passed");
  assert.equal(n.sides[1].hand.find(c => c.uid === "t1").power, 3, "the window closed at MY end phase");
  n = {...n, sides: n.sides.map((s, i) => i === 1 ? {...s, res: 9} : s)};
  n = H.drain(J.reduce(n, {t: "play", uid: "t1", from: "hand"}, 1).state);
  assert.equal(n.pend && n.pend.total, 3, "their attack swung at its printed 6");
  n = passTurn(settle(n));
  assert.equal(n.turnPlayer, 0, "fixture: their turn never ended");
  const back = [...n.sides[1].hand, ...n.sides[1].grave, ...n.sides[1].deck].find(c => c.uid === "t1");
  assert.equal(back && back.power, 6, "their end phase did not restore the halved card");
  assert.equal((n.sides[1].nextTurn || []).length, 0);
});

/* ---- 4. THE TRAINER ------------------------------------------------------- */

test("the trainer ARMS seat 1's schedule at its turn — or the halving never expires there", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const begin = html.slice(html.indexOf("function foeBegin(s){"), html.indexOf("function foeStep(s){"));
  assert.ok(begin.length > 0 && begin.length < 4000, "fixture: the slice lost its anchors");
  /* THE WHOLE CONDITIONAL, not the identifier (v4.55): `if(false && …)`
     keeps a bare name intact. */
  assert.match(begin, /\{ const aw = DawnEffects\.armNextTurn\(n, 1\);\s*if\(aw\.msgs\.length\)\{ n = aw\.game;/,
    "seat 1's turn start does not arm its schedule");
});

/* ---- 5. THE ROUTE COUNTER -------------------------------------------------- */

test("the ladder's `halve` counter spells the engine's own phrase (v3.81)", () => {
  /* A counter that spells the wrong word reports ZERO exactly as a missing
     feature does. Drive the line and hand it to the counter's own pattern. */
  const SELF = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  const m = SELF.match(/if\(\/(.+?)\/\.test\(line\)\) events\.push\(\["halve", line\]\);/);
  assert.ok(m, "the counter left selfplay.js");
  const g = pushed({hand: [atk("a", 6, 3)]});
  const line = (g.log || g.feed || []).map(String).find(l => /halved/.test(l));
  assert.ok(line, "fixture: the halving printed no line");
  assert.ok(new RegExp(m[1]).test(line), "the counter no longer matches the engine's line: " + line);
});
