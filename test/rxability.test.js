/* ============================================================
   "ATTACK REACTION - <cost>: <effect>" IS AN ACTIVATION LINE,
   AND THE ROUTE FOR IT WAS BUILT WRONG BEFORE IT WAS BUILT AT ALL.

   Six pool records print the prefix:

     Prey Spotters     Attack Reaction - Destroy this: Mark target opposing hero
     Stalker's Steps   Attack Reaction - Destroy this: Target attack with stealth gets go again
     Bolt'n Boots      Attack Reaction - {r}, destroy this: Target arrow attack … gets go again
     Danger Digits     Attack Reaction - Destroy this: Target dagger … deals 1 damage …
     Boltyn (hero)     Attack Reaction - Banish a card from your soul: …
     Bait (token)      Once per Turn Attack Reaction - 0: This gets +1{p} and go again

   v3.59 guarded `classifyClause` so the loose `mark` matcher could not eat
   the line INCLUDING ITS COST, and asserted here that "none has a route".
   That assertion was about the wrong function. `parseHeroPower` runs its
   OWN regex over the raw text, `clean` collapses the newlines so it could
   not anchor on `^`, and "REACTION" CONTAINS "ACTION" — so three of these
   were built as ACTION-SPEED abilities and offered in the action phase:

     Prey Spotters     marked a hero for free, any time
     Stalker's Steps   granted go again — an action point — with no attack
     Danger Digits     dealt 1 damage from nothing, its printed
                       "Destroy the dagger" dropped along with its subject

   Sev-3 "illegal play allowed", live, and a refusal this project had
   asserted in one function and never driven in the other. v2.44 named the
   Reaction-contains-action trap; this is its third outing.

   WHAT THIS FILE PINS NOW: the anchor, the window, the target legality,
   the action point, and the two refusals that are still honest.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);

/* ---- 1. the clause guard, unchanged from v3.59 ---------------------- */

test("an attack-reaction activation line is REFUSED by classifyClause", () => {
  assert.equal(cc("Attack Reaction - Destroy this: Mark target opposing hero"), null,
    "the loose `mark` matcher must not claim the line and drop its cost");
  assert.equal(cc("Attack Reaction - Destroy this: Target attack with stealth gets go again"), null);
  assert.equal(cc("Defense Reaction - {r}: Draw a card"), null);
});

test("A RESTRICTION IS NOT AN ACTIVATION — the guard is anchored on the dash", () => {
  /* Widowmaker and Wreck Havoc print "Defense reactions can't be played
     to this chain link", which is a restriction on the opponent and has
     no dash. Swallowing it would lose a real printed rule. */
  assert.notEqual(cc("Defense reactions can't be played to this chain link"), null,
    "the restriction must still be read");
});

/* ---- 2. THE ANCHOR — the sev-3 that was live ------------------------ */

test("REACTION CONTAINS ACTION, and parseHeroPower must not read it that way", () => {
  const pw = P.parseHeroPower("Attack Reaction - Destroy this: Mark target opposing hero", true);
  assert.notEqual(pw, null, "the line must parse");
  assert.equal(pw.kind, "attackRx",
    "read as `action` this ability is offered in the ACTION PHASE — sev-3, and it shipped");
});

test("…and the anchor did not cost an ordinary Action or Instant ability", () => {
  /* A control. Without it this file passes just as well against a reader
     that refused every activated ability in the pool. */
  assert.equal(P.parseHeroPower("Action - {r}{r}: Draw a card", true).kind, "action");
  assert.equal(P.parseHeroPower("Instant - Destroy this: Gain 1 action point", true).kind, "instant");
  assert.equal(P.parseHeroPower("Once per Turn Action - {r}: Draw a card", true).kind, "action");
});

test("a SUBJECT before the damage verb refuses — Danger Digits keeps its drawback", () => {
  /* "Target dagger you control THAT ISN'T ON THE ACTIVE CHAIN LINK deals 1
     damage to the defending hero. … Destroy the dagger."  The unanchored
     `dmg` matcher read that as a bare [["dmg",1]] from the EQUIPMENT: the
     chosen dagger, the "has hit" fiction and a printed DRAWBACK all gone. */
  assert.equal(cc("target dagger you control that isn't on the active chain link deals 1 damage to the defending hero"),
    null, "a damage clause whose subject is not the resolving card must refuse");
  assert.equal(P.parseHeroPower(
    "Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero.", true),
    null, "…so no powCard is built for it, and it cannot be activated at all");
});

test("…and the two printed subjects that ARE the resolving card still read", () => {
  /* Measured over the pool: exactly two records print the third-person
     "deals", and Bloodrot Pox's subject is "it". Everything else is
     imperative. Refuse more than that and real cards go dark. */
  assert.deepEqual(cc("deal 2 damage to any target").ops, [["dmg", 2]]);
  assert.deepEqual(cc("destroy this, then it deals 2 damage to them").ops.slice(-1), [["dmg", 2]]);
  assert.deepEqual(cc("destroy this and deal 4 damage to them").ops.slice(-1), [["dmg", 4]]);
});

/* ---- 3. the qualifier atom the link answers ------------------------- */

test("`with {p} greater than its base` is the CALLER's answer, and absent means no", () => {
  const q = P.attackQual("arrow", "with {p} greater than its base");
  assert.equal(q.pumped, true, "the atom must be read, not swallowed");
  const arrow = {tt: "Ranger Attack Action - Arrow", power: 4};
  assert.equal(P.qualMatches(q, arrow, {}), false,
    "an unpumped attack is not a legal target — a caller that does not say answers NO");
  assert.equal(P.qualMatches(q, arrow, {pumped: true}), true);
  assert.equal(P.qualMatches(q, {tt: "Warrior Attack Action", power: 4}, {pumped: true}), false,
    "the type half must survive too — a pumped SWORD is not an arrow");
});

test("an unreadable tail still refuses the whole clause", () => {
  /* v3.31's rule, still holding: `false` (something restricts this and we
     cannot say what) must never collapse into `null` (nothing does). */
  assert.equal(P.attackQual("arrow", "with a name you like"), false);
});

/* ---- 4. the route, off the real build ------------------------------- */

const gearOf = (heroKey, pieceName) => {
  const fs = require("fs");
  const C = require("../engine/cards.js");
  const GM = require("../engine/game.js");
  const RNG = require("../engine/rng.js");
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === heroKey);
  const d = GM.parseDeck(W.DECKS[heroKey]);
  const b = B.buildSide(h, d, H.db(), {}, RNG.make("rxab"), {n: 0}).b;
  return b.gear.find(x => x.name === pieceName);
};

test("the three readable pieces get an `_attackRx` powCard carrying the WHOLE line", {skip}, () => {
  const want = [["arakni", "Prey Spotters"], ["arakni", "Stalker's Steps"], ["azalea", "Bolt'n Boots"]];
  for(const [hk, nm] of want){
    const gr = gearOf(hk, nm);
    assert.ok(gr && gr.powCard, nm + ": no powCard — the ability is unreachable");
    assert.equal(gr.powCard._attackRx, true, nm + ": built in the wrong window");
    assert.equal(gr.powCard._instant, false, nm + ": an attack reaction is not an instant");
    assert.ok(!/attack reaction/i.test(gr.powCard.tx),
      nm + ": the cost prefix must be stripped, or `execute` re-reads it and refuses");
  }
});

test("Danger Digits gets NO powCard, and that is the honest state", {skip}, () => {
  const gr = gearOf("arakni", "Danger Digits");
  assert.ok(gr, "the piece must still be in the gear list");
  assert.equal(gr.powCard, undefined,
    "its payload drops a printed drawback, so nothing may offer it");
});

test("an attack-reaction ability costs NO action point", () => {
  /* CR 8.1.1 charges the point to an ACTION. `costsAP`'s own note: "a card
     played in a reaction window is not being played as one", which is why
     Den of the Spider costs a point as an Action and none as a Defense
     Reaction. The flag says it, because a powCard has no printed type. */
  assert.equal(P.costsAP({_attackRx: true}), false);
  assert.equal(P.costsAP({_instant: true}), false);
  assert.equal(P.costsAP({tt: "Warrior Action"}), true, "the control");
});

test("`abWindow` is the ONE reader, and it names all three flavours", () => {
  assert.equal(P.abWindow({_attackRx: true}), "attack-reaction");
  assert.equal(P.abWindow({_instant: true}), "instant");
  assert.equal(P.abWindow({}), "action");
  assert.equal(P.abWindow(null), "action");
});

/* ---- 5. DRIVEN — the window, the target, and the grant -------------- */

const withPend = (atk, o) => {
  const g = H.state({hand: [], res: 9, ap: 1}, {}, {turn: 3, actor: 0});
  return {...g, stack: [], pend: {card: atk, by: 0, total: (o && o.total != null) ? o.total : (atk.power || 0),
                                  ga: false, ops: [], onHit: [], onHitHero: [], condOnHit: []}};
};

test("DRIVEN: Stalker's Steps grants go again to a stealth attack on the link", {skip}, () => {
  H.db();
  const gr = gearOf("arakni", "Stalker's Steps");
  /* Pick a real pool attack that PRINTS stealth on its own line — the
     qualifier asks `printedKw`, so a card that merely mentions the word
     must not qualify. */
  const pool = require("../data/pool.json");
  const rec = pool.find(r => P.isAttack({tt: r.type_text || "", ty: r.types || [], power: r.power})
                          && P.printedKw({tx: r.functional_text || "", kw: r.card_keywords || []}, "stealth"));
  assert.ok(rec, "the pool must contain a printed-stealth attack, or this drill proves nothing");
  const atk = H.card(rec.name, rec.pitch);
  const g = withPend(atk);
  const out = J.withEffects(g, (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  assert.equal(out.pend.ga, true,
    "the attack the ability names must actually gain go again");
});

test("…and it REFUSES an attack with no stealth, leaving the link alone", {skip}, () => {
  H.db();
  const gr = gearOf("arakni", "Stalker's Steps");
  const plain = H.card("Brutal Assault", 1);
  assert.equal(P.printedKw(plain, "stealth"), false, "the fixture must not print stealth");
  const g = withPend(plain);
  const out = J.withEffects(g, (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  assert.equal(out.pend.ga, false,
    "an ability whose printed target it does not match must grant nothing");
});

test("DRIVEN: Prey Spotters marks the opposing hero — assert the STATE", {skip}, () => {
  H.db();
  const gr = gearOf("arakni", "Prey Spotters");
  const atk = H.card("Brutal Assault", 1);
  const g = withPend(atk);
  const before = !!(g.sides[1] || {}).marked;
  const out = J.withEffects(g, (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  assert.equal(before, false);
  assert.equal(!!out.sides[1].marked, true,
    "the mark must land on the opposing hero, not merely be logged");
});

test("DRIVEN: the ops run ONCE, not once here and once on the link", {skip}, () => {
  /* `execute` normally runs `fx.ops` itself and `attackRx` runs them onto
     the link. Running both is VALUE-DOUBLED on the fairness sweep's own
     terms — and with `mark` it is invisible in the state, so the drill
     counts the feed lines the mark writes. */
  H.db();
  const gr = gearOf("arakni", "Prey Spotters");
  const g = withPend(H.card("Brutal Assault", 1));
  const out = J.withEffects(g, (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  const marks = (out.feed || []).filter(l => /mark/i.test(String(l && l.t || l))).length;
  assert.equal(marks, 1, "the mark fired " + marks + " times — the ops ran twice");
});

test("DRIVEN: Bolt'n Boots needs the arrow to be PUMPED above its base", {skip}, () => {
  H.db();
  const gr = gearOf("azalea", "Bolt'n Boots");
  const pool = require("../data/pool.json");
  /* "Ranger Action - Arrow Attack" — `attack action` is not a substring of
     that line, and asking for one is how a fixture search finds nothing and
     the drill passes by proving nothing. Ask the predicate. */
  const rec = pool.find(r => P.isArrow({tt: r.type_text || ""}) && P.isAttack({tt: r.type_text || "", ty: r.types || [], power: r.power}) && r.power > 0);
  assert.ok(rec, "the pool must contain an arrow attack");
  const arrow = H.card(rec.name, rec.pitch);
  const base = arrow.power || 0;

  const flat = J.withEffects(withPend(arrow, {total: base}),
    (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  assert.equal(flat.pend.ga, false, "an arrow at its printed power is not a legal target");

  const up = J.withEffects(withPend(arrow, {total: base + 2}),
    (fx, s) => fx.execute(s, gr.powCard, "hero", 0));
  assert.equal(up.pend.ga, true, "…and one above its base is");
});

test("`pendPumped` counts the rx layers already waiting on the stack", {skip}, () => {
  /* `linkPumps` folds `{k:"rx"}` layers in at SETTLE time, so at REACTION
     time an earlier reaction's pump is still on the stack. Read only off
     `pend.total`, a link pumped by one reaction reads unpumped to the
     next — and Bolt'n Boots is refused a target it legally has. */
  H.db();
  const E = require("../engine/effects.js");
  const atk = {name: "probe atk", tt: "Warrior Attack Action", power: 4, uid: "a1"};
  const g = withPend(atk, {total: 4});
  assert.equal(E.pendPumped(g), false);
  assert.equal(E.pendPumped({...g, stack: [{k: "rx", label: "x", pump: 2}]}), true,
    "a pump waiting on the stack is a pump");
});

/* ---- 6. the WINDOW, through judge.legal ----------------------------- */

test("judge.legal refuses the ability in the ACTION phase and allows it in the reaction step", {skip}, () => {
  H.db();
  const gr = gearOf("arakni", "Prey Spotters");
  const base = H.state({hand: [], res: 9, ap: 1, gear: [gr]}, {}, {turn: 3, actor: 0});
  const act = {...base, phase: "action", step: "layer", priority: 0, passed: [], pend: null};
  const why = J.legal(act, {t: "activate", uid: gr.uid, from: "gear"}, 0);
  assert.ok(why && /attack-reaction/.test(why),
    "an attack reaction offered in the action phase is `illegal play allowed` — got: " + why);
});

test("the target restriction is a LEGALITY, refused BEFORE the piece is destroyed", {skip}, () => {
  H.db();
  const gr = gearOf("arakni", "Stalker's Steps");
  const plain = H.card("Brutal Assault", 1);
  const g = {...H.state({hand: [], res: 9, ap: 1, gear: [gr]}, {}, {turn: 3, actor: 0}),
             phase: "action", step: "reaction", priority: 0, passed: [], attacker: 0,
             stack: [], pend: {card: plain, by: 0, total: plain.power || 4, ga: false, ops: [], onHit: []}};
  const why = J.legal(g, {t: "activate", uid: gr.uid, from: "gear"}, 0);
  assert.ok(why && /isn't one/.test(why),
    "refusing after the piece has been destroyed costs a card for a play the rules never allowed — got: " + String(why));
});

/* ---- 7. `pend.by` — the field one board never wrote ----------------- */

test("BOTH boards record WHO declared the attack", {skip}, () => {
  /* `pend.by` was written by `judge.declareAttack` and by nothing else, so
     on the trainer it was `undefined` — and every reader guards on
     `by != null`, which made `execute`'s own attack-reaction branch
     unreachable there. A field that exists on one board is the shape this
     project finds over and over (phantasm, the graveyard gate, the arena
     sweep); here it was the field rather than the rule. */
  H.db();
  const atk = H.card("Brutal Assault", 1);
  const g = {...H.state({hand: [atk], res: 9, ap: 1}, {}, {turn: 3, actor: 0}), stack: []};
  const out = J.withEffects(g, (fx, s) => fx.execute(s, atk, "hand", 0));
  assert.equal(out.pend && out.pend.by, 0,
    "the declaring seat must be on the pend — without it the reaction branch is dead code");
});

test("…and it is the ACTOR, not a hardcoded seat", {skip}, () => {
  H.db();
  const atk = H.card("Brutal Assault", 1);
  const g = {...H.state({}, {hand: [atk], res: 9, ap: 1}, {turn: 3, actor: 1, turnPlayer: 1}), stack: []};
  const out = J.withEffects(g, (fx, s) => fx.execute(s, atk, "hand", 0));
  assert.equal(out.pend && out.pend.by, 1,
    "seat 1's swing must be seat 1's — a literal 0 makes every reaction hostile");
});

/* ---- 8. the trainer's own gate, which no drill can drive ------------ */

test("THE TRAINER ASKS `abWindow` AND REFUSES THE WRONG WINDOW", {skip: false}, () => {
  /* The trainer's play path is a React closure, so this is a SOURCE scan
     and it is written down as one. What it can prove is that the gate
     EXISTS and names the window; what it cannot prove is that the tap
     reaches it on a phone. That half is validated on-device, per the
     roadmap loop, and is recorded in HANDOFF.md as unvalidated rather
     than reported as shipped. */
  const fs = require("fs");
  const src = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/card\._attackRx && !\(s\.mode==="stack"/.test(src),
    "tryPlay must refuse an attack-reaction ability outside the reaction window");
  assert.ok(/!card\._instant && !card\._attackRx\)\s*\n\s*return L\(s, "Combat chain is open/.test(src),
    "…and must NOT tell it to close the chain first — the open chain is the only time it is legal");
  assert.ok(/abWindow = DawnParser\.abWindow/.test(src),
    "the trainer must ask the ONE reader, not re-derive the window");
  assert.ok(/_attackRx:pw\.kind==="attackRx"/.test(src),
    "boardPow must stamp the window flag too, or an arena ability is offered at action speed");
});

test("THE CREDIT IS CONDITIONAL — the clauses that refuse stay `skip`", {skip}, () => {
  /* `fxParse` marks the "Attack Reaction - …" clause read because
     `parseHeroPower` reads it, exactly as it does for `handAbility`. Made
     UNCONDITIONAL the credit becomes a lie: Danger Digits' payload drops a
     printed drawback, so it would report its ability read with nothing
     behind it — the no-op blind spot, created by the very line meant to
     stop under-reporting.

     BOLTYN LEFT THIS LIST AT v3.74, and that is what a recorded refusal is
     for (v3.38). His cost was "a soul banish nothing builds"; the soul
     banish is built now, so the credit is earned and he is the POSITIVE
     control below — without one, this drill passes just as well against a
     credit that never fires at all.

     ASSERT ON THE CLAUSE, NOT THE TIER. Written against `fx.tier` this
     drill was SILENT under sabotage, because all three cards carry ANOTHER
     unread clause that pins them at `part` whatever the credit does — a
     derived aggregate that other facts also determine cannot see a change
     to one of them. The clause status is what the credit writes. */
  const pool = require("../data/pool.json");
  const mk = r => ({name: r.name + "|rxcredit|" + r.pitch, tx: r.functional_text || "",
                    tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                    pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  const rxClause = r => {
    P.fxReset();
    return (P.fxParse(mk(r)).clauses || []).find(c => /^(?:once per turn )?attack reaction\s*[-—]/i.test(c.t));
  };
  for(const nm of ["Danger Digits", "Bait"]){
    const r = pool.find(x => x.name === nm);
    assert.ok(r, nm + " must be in the pinned pool");
    const cl = rxClause(r);
    assert.ok(cl, nm + ": its attack-reaction line must still be a clause");
    assert.equal(cl.st, "skip",
      nm + ": no reader answers for this line, so crediting it is the no-op blind spot"
      + (nm === "Bait" ? " (and nothing in the pool can even create Bait)" : ""));
  }
  /* THE POSITIVE CONTROL. A drill that only ever asserts `skip` passes
     against a credit that was deleted outright. */
  {
    const r = pool.find(x => x.name === "Boltyn");
    const cl = rxClause(r);
    assert.ok(cl, "Boltyn's attack-reaction line must still be a clause");
    assert.equal(cl.st, "run",
      "his soul-banish cost has a reader as of v3.74, so the credit is earned");
  }
  P.fxReset();
});

test("…while the three that DO have a route are credited", {skip}, () => {
  const pool = require("../data/pool.json");
  const mk = r => ({name: r.name + "|rxok|" + r.pitch, tx: r.functional_text || "",
                    tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                    pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  for(const nm of ["Prey Spotters", "Stalker's Steps", "Bolt'n Boots"]){
    const r = pool.find(x => x.name === nm);
    P.fxReset();
    const fx = P.fxParse(mk(r));
    const cl = (fx.clauses || []).find(c => /^attack reaction\s*[-—]/i.test(c.t));
    assert.ok(cl && cl.st === "run",
      nm + ": the ability is built and routed on both boards — leaving it `skip` is v3.21's one-sided ledger");
    assert.equal(fx.tier, "full", nm + " should now report finished");
  }
  P.fxReset();
});
