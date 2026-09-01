/* ============================================================
   THE LATE CONDITIONS — the three gates that cannot be answered when the
   card is played (v3.71).

     pumped      "if this has {p} greater than its base"
     defLt2any   "…if this is defended by fewer than 2 cards"
     defLt2      "…by fewer than 2 non-equipment cards"

   THEIR PUMPS WENT NOWHERE FOR AS LONG AS THEY EXISTED. They were
   evaluated inside `linkPayload`, which is handed the damage DEALT and is
   called AFTER both boards have already subtracted it from life — so a
   `+N{p}` there moved the crush threshold and the on-hit gate and never
   once touched a hero:

     Short Shrift · Wee Wrecking Ball · Walk in My Shoes   +1{p} when pumped
     Widowmaker (Azalea's)                                 +3{p} vs one defender

   Twelve records, every one WEAKER than printed — the direction the
   one-sided fairness sweep is built not to look in — and all reading
   `tier: full`, because the clause really was consumed. They live in
   `linkPumps` now, the piece whose whole job is the attack's power before
   the wall.

   AND `pumped` ASKED THE WRONG NUMBER. It compared the DEALT damage with
   the printed base, so an attack pumped from 4 to 6 and met by a wall of 3
   was told it was "not pumped above base".

   AND THE FEED CONTRADICTED ITSELF. `execute`'s condition loop had no case
   for any of the three, so they fell through to the default `false` and
   printed "condition not met (pumped)" at declaration — four lines before
   "pumped above base — +1 power". v3.60's sev-2 category, and v3.60's own
   rule about when a drill may read the log.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const PRI = require("../engine/priority.js");

const skip = !H.hasDb() && "no cached card database";

/* ---- 1. THE READER --------------------------------------------------- */

test("both printed wordings of `pumped` read to one condition", () => {
  /* A FIXED WORDING IS NOT A FIXED SHAPE (v3.60, v3.65). Three Guardian
     attacks print "this HAS {p} greater than its base"; Bolt'n' Shot prints
     "this CARD'S {p} IS greater than its base". Anchored to the first
     alone, Bolt'n' Shot read `tier: none` and did nothing while the
     identical gate worked three cards over. */
  const a = P.classifyClause("if this has {p} greater than its base, it gets +1{p}");
  const b = P.classifyClause("if this card's {p} is greater than its base, it gets go again");
  assert.equal(a && a.cond, "pumped");
  assert.equal(b && b.cond, "pumped");
});

test("the anchor is written against the LEVELLED text, not the printed text", () => {
  /* `SYNONYMS` rewrites "this card's" to "this's" before `classifyClause`
     sees a word of it. A pattern spelling the PRINTED form therefore
     matches nothing and looks exactly like a pattern that is simply wrong —
     which is a whole debugging session if you do not know to look. This
     drill pins the levelling so the anchor and the table cannot drift. */
  /* `levelIdiom` is private, so the levelling is pinned from the OUTSIDE:
     the PRINTED spelling and the LEVELLED one must both reach the anchor.
     Written as `assert.ok(P.levelIdiom && …)` this drill would have passed
     by finding nothing — the export does not exist. */
  assert.equal(P.classifyClause(
    "if this card's {p} is greater than its base, it gets +1{p}").cond, "pumped");
  assert.equal(P.classifyClause(
    "if this's {p} is greater than its base, it gets +1{p}").cond, "pumped");
});

test("Bolt'n' Shot's granted rider rides as a GATED on-hit", {skip}, () => {
  /* v3.10: a gated rider is `condOnHit`, never `onHit`. Filed as a plain
     on-hit it would reload on every hit regardless of the gate —
     KEYWORD-UNGATED, which the fairness sweep exists to catch. */
  H.db();
  const fx = P.fxParse(H.card("Bolt'n' Shot", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual((fx.conds || []).map(c => [c.cond, c.op[0]]), [["pumped", "ga"]]);
  assert.deepEqual((fx.condOnHit || []).map(c => [c.cond, c.op[0]]), [["pumped", "reload"]]);
  assert.deepEqual(fx.onHit, [], "the rider must NOT be an unconditional on-hit");
});

/* ---- 2. DRIVEN, THE TRAINER'S BOARD ---------------------------------- */

function trainerSwing(o){
  const atk = Object.assign({}, H.card(o.name, o.pitch == null ? 1 : o.pitch), {uid: 600});
  const blocker = uid => ({uid, name: "Wall " + uid, tt: "Guardian Action",
                           pitch: 1, cost: 1, power: 1, def: o.wallDef || 3, tx: "", kw: []});
  const wall = (o.blockers || 0);
  const hand = [];
  for(let i = 0; i < wall; i++) hand.push(blocker(610 + i));
  let g = H.state({hand: [atk], res: 9, ap: 1, buffNext: o.pump || 0}, {hand, hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3});
  let n = H.execute(g, atk, "hand", 0, {});
  for(let i = 0; i < wall; i++) n = {...n, stack: [...n.stack, {k: "def", uid: 610 + i}]};
  return {game: J.withEffects(n, (fx, s) => fx.resolveStack(s)), base: atk.power || 0};
}
const dealt = out => 20 - out.game.sides[1].hp;

test("DRIVEN: a pumped attack's +1{p} reaches LIFE, blocked or not", {skip}, () => {
  H.db();
  /* base 3, pitch 2. Unblocked and pumped: 3 + 2 pump + 1 = 6.
     Blocked by a 3-defence card: 6 - 3 = 3. Before v3.71 both were one
     lower, because the bonus was added to a number nothing spent. */
  const open  = trainerSwing({name: "Short Shrift", pitch: 2, pump: 2});
  const block = trainerSwing({name: "Short Shrift", pitch: 2, pump: 2, blockers: 1});
  assert.equal(open.base, 3, "the fixture's base power — the whole gate is about it");
  assert.equal(dealt(open), 6);
  assert.equal(dealt(block), 3);
});

test("DRIVEN: …and an UNPUMPED attack gets nothing", {skip}, () => {
  /* THE CONTROL. Without it the drill above passes just as well against an
     engine that adds +1 to every attack in the game. */
  H.db();
  assert.equal(dealt(trainerSwing({name: "Short Shrift", pitch: 2})), 3);
  assert.equal(dealt(trainerSwing({name: "Short Shrift", pitch: 2, blockers: 1})), 0);
});

test("DRIVEN: `pumped` asks the STRUCK power, not the damage dealt", {skip}, () => {
  /* The bug inside the bug. Pumped 3 -> 5 and met by a wall of 3, the old
     site compared 2 (dealt) against a base of 3 and concluded the attack
     was not pumped. The wall has to be big enough to push the dealt damage
     BELOW the base, or the fixture cannot tell the two numbers apart
     (v3.26) — a wall of 3 against a struck power of 5 leaves 2. */
  H.db();
  const out = trainerSwing({name: "Short Shrift", pitch: 2, pump: 2, blockers: 1, wallDef: 3});
  assert.equal(dealt(out), 3, "struck 5, +1 for being pumped, wall 3");
});

test("DRIVEN: Widowmaker's +3 for a thin wall reaches life too", {skip}, () => {
  /* `defLt2any` counts EVERY defender, equipment included — a different
     set from `defLt2`, and the pool prints both. Azalea's own card, and
     the fourth of the four that were adding to a number nothing spent. */
  H.db();
  const thin = trainerSwing({name: "Widowmaker", pitch: 2, blockers: 1, wallDef: 1});
  const thick = trainerSwing({name: "Widowmaker", pitch: 2, blockers: 2, wallDef: 1});
  /* base 3 at pitch 2. one defender: 3 + 3 - 1 = 5. two: 3 - 2 = 1. */
  assert.equal(dealt(thin), 5);
  assert.equal(dealt(thick), 1);
});

test("DRIVEN: the feed does not refuse a bonus and then grant it", {skip}, () => {
  /* ASSERTING ON PROSE, DELIBERATELY — v3.60's stated exception. The STATE
     is identical either way: the late pass fires regardless, so every zone,
     life total and counter agrees. What differs is that the player was told
     "condition not met (pumped)" and then handed the bonus four lines
     later, and in a training sim the sequence IS the lesson. */
  H.db();
  const out = trainerSwing({name: "Short Shrift", pitch: 2, pump: 2});
  const feed = out.game.feed.join("\n");
  assert.ok(/pumped above base/.test(feed), "the bonus must be announced");
  assert.ok(!/condition not met \(pumped\)/.test(feed),
    "…and it must not ALSO be refused at declaration:\n" + feed);
});

/* ---- 3. DRIVEN, THE TABLE -------------------------------------------- */

test("DRIVEN: the same bonus lands at the TABLE", {skip}, () => {
  /* v3.01: a rule is written per board, so ask which one runs it. Both
     boards call `linkPumps`, so moving the loop there gave the table the
     rule in the same edit — but "both call it" is a claim, and this is the
     drill that makes it a fact. */
  H.db();
  const atk = Object.assign({}, H.card("Short Shrift", 2), {uid: 700});
  let g = H.state({name: "Me", hand: [atk], res: 9, ap: 1, buffNext: 2},
                  {name: "Them", hp: 20, res: 0, hand: []},
                  {actor: 0, turnPlayer: 0, turn: 3});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const send = (a, s) => {
    const r = J.reduce(g, a, s);
    assert.equal(r.error, null, a.t + " was refused: " + r.error);
    g = r.state;
  };
  send({t: "play", uid: 700, from: "hand"}, 0);
  for(let i = 0; i < 80 && g.pend; i++){
    if(g.prompt){ send(J.autoAnswer(g), g.prompt.side || 0); continue; }
    const pri = g.priority;
    if(pri == null) break;
    send({t: "pass"}, pri);
  }
  assert.equal(g.pend, null, "the link never resolved — the drill would prove nothing");
  assert.equal(20 - g.sides[1].hp, 6, "struck 5, +1 for being pumped, no wall");
});

/* ---- 4. THE LIST IS ONE LIST ----------------------------------------- */

test("a late condition is SKIPPED at declaration and RUN at the wall", {skip}, () => {
  /* `LATE_CONDS` is read twice — once by `execute`'s skip and once to build
     `pend.lateConds`. Two hand-written copies of that list drift, and the
     drift is a condition skipped at declaration and then never run: a
     printed bonus that silently vanishes with nothing to report it.

     Driven rather than grepped: the op must be absent from the declaration
     AND present on the link. */
  H.db();
  const atk = Object.assign({}, H.card("Short Shrift", 2), {uid: 601});
  const g = H.state({hand: [atk], res: 9, ap: 1, buffNext: 2}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, atk, "hand", 0, {});
  assert.deepEqual((n.pend.lateConds || []).map(c => c.cond), ["pumped"],
    "it must reach the link");
  assert.equal(n.pend.total, (atk.power || 0) + 2,
    "…and it must NOT have been applied at declaration — that would double it");
});
