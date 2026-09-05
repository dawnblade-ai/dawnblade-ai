/* ============================================================
   A BARE "WHEN THIS ATTACKS" FIRES ON DECLARATION (CR 7.2, v4.08)

   The trigger was FLATTENED into `fx.ops` — the parser recorded that the
   card had a payload and not that the payload had a schedule — so it
   rode to RESOLUTION with `pend.ops`:

     VEXING MALICE      "When this attacks, deal 2 arcane damage to
                         target hero."
     SPELLBLADE ASSAULT "When this attacks, create 2 Runechant tokens."

   Both are real orderings and both are WEAKER than printed, because the
   defender never had to answer them:

   - the arcane landed AFTER the swing's own damage, so a hero who would
     have died to it got to block first and a lethal arcane arrived after
     cards had already been spent;
   - the Runechants reached the board after the WALL had been declared
     against a board that did not have them — and CR 7.2 puts a
     when-this-attacks trigger on the stack ABOVE the attack, which is
     the same reasoning that already puts the Runechant POP at
     declaration a few lines up.

   ---- IT IS AN ALLOW-LIST, AND THAT IS THE SAFETY PROPERTY ----------

   `parser.DECL_OPS` names the kinds that can honour the printed moment.
   Everything else stays exactly where it is — unchanged and visible —
   rather than being moved into a moment nothing has checked it in. A
   blacklist is the bug (v3.35, v3.80): the next kind added walks into
   the new site.

   ---- AND THE MEASUREMENT CORRECTED ITSELF -------------------------

   A hand-split scan reported THREE cards. Asked of `fxParse` instead,
   Arcanic Shockwave's arcane is CONDITIONAL ("if it was fused"), so it
   lives in `fx.conds` and has fired at declaration all along — the
   condition loop runs there on an attack. **Ask the function that holds
   the reader** (v3.56); the honest blast radius is two cards, six
   records.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (n, p) => C.resolveEntry(H.db(), {name: n, p, code: null, q: 1});

/* ============================================================
   A. THE PARSE
   ============================================================ */

test("a bare when-this-attacks payload is routed off `fx.ops`", {skip}, () => {
  H.db();
  for(const [n, op] of [["Vexing Malice", ["arcane", 2]], ["Spellblade Assault", ["rune", 2]]]){
    const c = card(n, 1);
    const fx = P.fxParse(c);
    assert.deepEqual(fx.onAtk, [op], `${n}'s trigger is not routed — it rides to resolution again`);
    assert.deepEqual(fx.ops.filter(o => o[0] === op[0]), [],
      `${n}'s payload is in BOTH lists — it will fire twice, which is VALUE-DOUBLED on the ` +
      "fairness sweep's own terms");
  }
});

test("a HERO-GATED trigger keeps its own list — the two are not merged", {skip}, () => {
  H.db();
  /* v3.46 built `onAtkHero` because a bare trigger fires on ANY
     attack-target and a gated one does not. Collapsing them would fire
     these off a swing at an ally, which is the direction that list
     exists to stop. */
  const gated = card("Path of Same Ends", 1);
  const fx = P.fxParse(gated);
  assert.ok((fx.onAtkHero || []).length, "fixture: this card no longer prints a hero-gated trigger");
  assert.deepEqual(fx.onAtk || [], [],
    "a hero-gated trigger leaked into the ungated list — it would now fire against an ally");
});

test("an `if` or `while` clause is a GATE, never this trigger", {skip}, () => {
  /* The same branch in `classifyClause` handles `if`, `when` and
     `while`; only the WHEN form is a trigger. Arcanic Shockwave is the
     pool's proof — "When this attacks, IF IT WAS FUSED, …" nests a gate
     inside the trigger, and its arcane belongs in `fx.conds`, where the
     condition loop already runs it at declaration. */
  H.db();
  const fused = card("Arcanic Shockwave", 1);
  const fx = P.fxParse(fused);
  assert.deepEqual(fx.onAtk || [], [],
    "a CONDITIONAL attacks-trigger was routed as an unconditional one — its gate is dropped");
  assert.ok((fx.conds || []).some(x => x.cond === "fused" && x.op[0] === "arcane"),
    "fixture: Arcanic Shockwave's gate is no longer read at all");

  assert.deepEqual((P.classifyClause("if this attacks, deal 2 arcane damage to target hero") || {}).onAtk,
    undefined, "an `if` clause was read as a trigger");
});

test("the allow-list is PINNED, and it is an allow-list", {skip}, () => {
  /* v3.87's rule about `PUMP_OPS`, one list over: the set is the claim.
     A kind arriving here is a deliberate edit with a reason, because
     moving an op into a moment nothing has checked it in is exactly how
     a timing fix becomes a new bug. */
  assert.deepEqual([...P.DECL_OPS].sort(), ["arcane", "rune"]);

  /* AND THE KINDS THAT STAY BEHIND REALLY DO. `buffNext` fired here is
     taken by THIS attack — a self-pump the card does not print. */
  const probe = {name: "OnAtk Buff Probe", pitch: 1, cost: 0, power: 4,
                 tt: "Generic Attack Action", ty: ["Generic", "Attack", "Action"], kw: [], gkw: [],
                 tx: "When this attacks, your next attack this turn gets +3{p}."};
  const fx = P.fxParse(probe);
  assert.deepEqual(fx.onAtk || [], [],
    "`buffNext` was routed to declaration — the grant is then taken by the attack that " +
    "made it, which is a self-pump the card never prints");
  assert.ok((fx.ops || []).some(o => o[0] === "buffNext"), "…and it must still be read at all");
});

/* ============================================================
   B. DRIVEN — THE ORDERING IS THE WHOLE POINT
   ============================================================ */

function swing(cardName, pitch, opp){
  const atk = {...card(cardName, pitch), uid: "oa1", cost: 0};
  let g = H.state({res: 9, hand: [atk], ap: 1}, opp || {hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "onatk"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "oa1", from: "hand"}, 0);
  assert.equal(out.error, null, "the swing was refused: " + out.error);
  return out.state;
}

test("DRIVEN: the arcane has landed by the time the attack is on the chain", {skip}, () => {
  H.db();
  const before = 20;
  const n = swing("Vexing Malice", 1, {hp: before, gear: [], res: 0});
  /* THE OBSERVABLE IS THAT IT HAS ALREADY HAPPENED. `pend` exists, the
     attack has NOT resolved, and the hero is already down 2 — which is
     what "fires on declaration" means and what riding to `pend.ops`
     could never produce. */
  assert.ok(n.pend, "fixture: no attack was declared");
  assert.equal(n.sides[1].hp, before - 2,
    "the arcane has not landed at declaration — it is still riding to resolution, so it " +
    "arrives after the swing's own damage and the defender never has to answer it");
  assert.deepEqual(((n.pend && n.pend.ops) || []).map(o => o[0]), [],
    "the payload is ALSO still queued — it will fire a second time when the link resolves");
});

test("DRIVEN: the Runechants are on the board before the wall is declared", {skip}, () => {
  H.db();
  const n = swing("Spellblade Assault", 1);
  assert.ok(n.pend, "fixture: no attack was declared");
  assert.equal(P.runeCount(n.sides[0]), 2,
    "the tokens are not on the board at declaration — the wall is declared against a board " +
    "that does not have them, and the defender answers a threat that is not there yet");
});

test("DRIVEN: a Runechant made by the attack does NOT pop for it", {skip}, () => {
  H.db();
  /* v2.23's rule, and this build is the first thing that could break it:
     the trigger now mints AT DECLARATION, which is the same moment the
     pop site runs. `atkTrigAt` is captured at the top of `execute`,
     BEFORE the card acts, so the new tokens are not in the firing set —
     and the observable is that they survive. */
  const n = swing("Spellblade Assault", 1, {hp: 20, gear: [], res: 0});
  assert.equal(P.runeCount(n.sides[0]), 2,
    "the attack popped the Runechants it had just created — the token's own trigger is " +
    "'when you PLAY an attack action card', and one that did not exist at that instant " +
    "never triggered for it");
  assert.equal(n.sides[1].hp, 20,
    "…and it dealt their arcane too, so the swing paid itself twice");
});

test("DRIVEN: a swing at an ALLY still fires it — a bare trigger has no target gate", {skip}, () => {
  H.db();
  /* THE HALF THAT SEPARATES THIS LIST FROM `onAtkHero` (v3.46). Routed
     into the gated list, this would print "its 'attacks a hero' ability
     does not fire" and do nothing — weaker than printed on a card whose
     own text names no target for the trigger. */
  const ally = {card: {...card("Barnacle", 1), uid: "al1"}, kind: "ally",
                uid: "al1", life: 4, spent: false};
  const atk = {...card("Vexing Malice", 1), uid: "oa2", cost: 0};
  let g = H.state({res: 9, hand: [atk], ap: 1}, {hp: 20, board: [ally], gear: [], res: 0},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "onatk2"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "oa2", from: "hand", target: "al1"}, 0);
  assert.equal(out.error, null, "the swing was refused: " + out.error);
  assert.equal(out.state.sides[1].hp, 18,
    "the trigger did not fire against an ally — its printed text names no target, so " +
    "gating it on the hero is weaker than printed");
});
