/* ============================================================
   AN AURA THAT IS A WEAPON (v3.84) — Cosmo, Scroll of Ancestral Tapestry

     "During your turn, auras you control with WARD are weapons with base
      {p} equal to their WARD and \"Once per Turn Action - {r}: Attack\".
      Your aura attacks with one or more +1{p} counters get go again."

   ENIGMA'S WHOLE ENGINE, and the card everything else of hers waits on.
   The Spectral Shield token's entire printed text is "Ward 1" — it has no
   attack at all, and her hero's clause 1 prices "your first Spectral
   Shield ATTACK each turn". Cosmo is what makes that attack exist.

   THE ROUTE IS `from: "aura"`, which is `from: "ally"`'s twin (v3.44) —
   an arena permanent that attacks. Everything after the seam came free:
   `pend`, the wall, on-hit text, CR 1.4.5 targeting, the action point
   charged at resolution and kept on go again.

   WHAT IS NEW is that THE GRANT COMES FROM A DIFFERENT CARD. An ally
   prints its own attack; an aura is handed one by whatever is equipped.
   So `auraAttackOf` takes the SIDE, and "during your turn" is the
   caller's answer with no default — a caller that does not say gets
   nothing, which is weaker than printed and visible.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const pool = require("../data/pool.json");
const mk = n => { const r = pool.find(x => x.name === n);
  return {name: r.name, tt: r.type_text, ty: r.types, kw: r.card_keywords,
          tx: r.functional_text, power: r.power, pitch: r.pitch, uid: 1}; };

/* A real Enigma table with Cosmo equipped and a Spectral Shield minted. */
function table(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("cosmo");
  const h0 = W.HEROES.find(x => x.k === "enigma"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.enigma), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  g = J.withEffects(g, (fx, n) =>
    ({game: fx.runOps(n, [["token", "Spectral Shield", o.shields || 1, "self"]], "probe")})).game;
  const shields = (g.sides[0].board || []).filter(e => /Spectral Shield/.test(e.card.name));
  const sh = shields[0];
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {res: 9, hand: []},
    o.counters ? {counters: {[sh.uid]: {pow: o.counters}}} : {},
    o.noCosmo ? {gear: (sides[0].gear || []).filter(x => !/^Cosmo/.test(x.name))} : {},
    /* HER CLAUSE 1 IS A HERO PASSIVE, so a fixture that wants full price
       strips it from the BUILD rather than from the card. */
    o.noDiscount ? {} : {});
  sides[1] = Object.assign({}, sides[1], {hand: []});
  let out = Object.assign({}, g, {sides});
  if(o.noDiscount){
    const builds = (out.builds || []).slice();
    builds[0] = Object.assign({}, builds[0], {auraDiscount: null});
    out = Object.assign({}, out, {builds});
  }
  return {g: out, uid: sh.uid, uid2: shields[1] && shields[1].uid};
}
/* CLOSE THE CHAIN WITH PASSES ALONE. Nothing else acts, so the state
   that comes back is the fixture's own — see the note in the two-shield
   drill for what happens when a policy drives it instead. */
function passOut(n){
  for(let i = 0; i < 60 && n.pend; i++){
    let moved = false;
    for(const s of [0, 1]){
      const o = J.reduce(n, {t: "pass"}, s);
      if(o.error) continue;
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  return n;
}

/* drive the declared attack all the way to resolution */
function resolve(n){
  for(let i = 0; i < 40 && n.pend; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s); if(!a) continue;
      const o = J.reduce(n, a, s); if(o.error) continue;
      n = o.state; moved = true; break;
    }
    if(!moved) break;
  }
  return n;
}

/* ---- 1. THE READERS -------------------------------------------------- */

test("the grant's cost is read off the QUOTED ability, by weaponCost", {skip}, () => {
  /* ONE READER OF THE GRAMMAR for all three sources of activated attacks
     — a weapon, an ally and now an aura. It is also exactly why Cosmo was
     routed as a swing ITSELF until v3.83: `weaponCost` matches the quoted
     line whether it belongs to the card or to something the card is
     talking about, so the ROUTE is decided by `isWeapon`, never by
     asking it. */
  const g = P.auraWeaponGrant(mk("Cosmo, Scroll of Ancestral Tapestry"));
  assert.ok(g);
  assert.equal(g.cost, 1);
  assert.equal(g.oncePerTurn, true);
  assert.equal(g.taps, false);
  assert.equal(g.gaWithCounters, true, "its second sentence rides with the grant");
  assert.equal(g.ownTurnOnly, true, "\"during your turn\"");
  assert.equal(P.auraWeaponGrant(mk("Act of Glory")), null, "and nothing else grants it");
});

test("a ward is a NUMBER the aura carries, read off its printed line", {skip}, () => {
  /* COSMO'S OWN TEXT SETTLES WHICH READING IS WANTED — "base {p} equal to
     their WARD" is a number, not the side's prevention pool. `fx.ops`
     gives Spectral Shield `[["ward",1]]`, which is the op that fills that
     pool when a card RESOLVES, and a token minted onto the board never
     takes that path. */
  assert.equal(P.wardValue(mk("Spectral Shield")), 1);
  assert.equal(P.wardValue(mk("Waxing Specter")), 3, "and it is read, not hardcoded");
  assert.equal(P.wardValue(mk("Act of Glory")), 0);
  assert.deepEqual(P.fxParse(mk("Spectral Shield")).ops, [["ward", 1]],
    "the op is still there — this reader is a second question about the same line");
});

test("every gate on the grant answers, and a silent caller gets NOTHING", {skip}, () => {
  const shield = mk("Spectral Shield");
  const cosmo = mk("Cosmo, Scroll of Ancestral Tapestry");
  const on = {gear: [cosmo]};
  assert.ok(P.auraAttackOf(shield, on, {yourTurn: true}), "the working case");
  assert.equal(P.auraAttackOf(shield, on, {yourTurn: false}), null, "\"during YOUR turn\"");
  assert.equal(P.auraAttackOf(shield, on, {}), null,
    "a caller that does not say gets nothing — weaker than printed and visible");
  assert.equal(P.auraAttackOf(shield, {gear: []}, {yourTurn: true}), null, "no grant, no weapon");
  assert.equal(P.auraAttackOf(mk("Act of Glory"), on, {yourTurn: true}), null, "no ward, no weapon");
  assert.equal(P.auraAttackOf(shield, {gear: [Object.assign({}, cosmo, {destroyed: true})]},
    {yourTurn: true}), null, "a destroyed piece grants nothing");
});

test("the power is the WARD, and it is read per card", {skip}, () => {
  /* SPECTRAL SHIELD PRINTS 1, so no fixture built on it alone can tell a
     read number from a hardcoded one (v3.32, v3.74, v3.77, v3.78 — fifth
     time). Waxing Specter prints Ward 3. */
  const on = {gear: [mk("Cosmo, Scroll of Ancestral Tapestry")]};
  assert.equal(P.auraAttackOf(mk("Spectral Shield"), on, {yourTurn: true}).power, 1);
  assert.equal(P.auraAttackOf(mk("Waxing Specter"), on, {yourTurn: true}).power, 3);
});

/* ---- 2. THE ROUTE, DRIVEN ------------------------------------------- */

test("DRIVEN: a Spectral Shield attacks for its ward, and costs the point", {skip}, () => {
  const t = table();
  assert.equal(J.legal(t.g, {t: "activate", uid: t.uid}, 0), null);
  const declared = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  /* THE {r} IS ASSERTED AT THE DECLARATION, where `execute` charges it —
     NOT after driving to resolution, because `resolve()` lets the policy
     act and it spends resources of its own. Written that way first, the
     pool dropped by 2 and the drill blamed the aura for a card the
     opponent played. A measurement taken through unrelated actions is
     not a measurement of the thing it names. */
  assert.equal(declared.sides[0].res, t.g.sides[0].res,
    "her FIRST Spectral Shield attack each turn costs {r} less — 1 minus 1 is free");
  const out = resolve(declared);
  assert.equal(t.g.sides[1].hp - out.sides[1].hp, 1, "one damage — its ward");
  assert.equal(out.sides[0].ap, t.g.sides[0].ap - 1,
    "CR 8.1.1 — the granted line is an ACTION, so it costs an action point");
});

test("DRIVEN: an aura it cannot fund is refused, not swung for free", {skip}, () => {
  /* v2.04 — AN UNPAYABLE COST IS INERT, NEVER FREE. With no resources and
     nothing in hand to pitch, `legal` must refuse: offering it opens a
     payment whose only exit is cancel, which is the live-lock v2.45
     names. Her discount is stripped, or the attack is free and there is
     nothing to be unable to fund. */
  const t = table({noDiscount: true});
  const sides = t.g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {res: 0, hand: []});
  const g = Object.assign({}, t.g, {sides});
  const why = J.legal(g, {t: "activate", uid: t.uid}, 0);
  assert.ok(why != null, "it must be refused — got: " + why);
  assert.match(String(why), /cannot raise it/);
});

/* ---- ENIGMA'S CLAUSE 1 (v3.84) --------------------------------------
   "Your first Spectral Shield attack each turn costs {r} less to
    activate."

   REACHABLE ONLY NOW. Until Cosmo was built there was no such thing as a
   Spectral Shield attack, so this priced a play that could not happen —
   which is the whole reason her hero read 0 of 2 clauses. */

test("the discount is READ — the card name and the amount both", {skip}, () => {
  /* THE NAME IS CAPTURED AS A STRING (v3.21) because the printed line
     NAMES it: a boolean would move "Spectral Shield" into the engine,
     which is inventing card text one level up. */
  const W = loadData();
  const b = B.buildSideDefault(W.HEROES.find(x => x.k === "enigma"),
    G.parseDeck(W.DECKS.enigma), H.db(), RNG.make("d"), {n: 0}).b;
  assert.deepEqual(b.auraDiscount, {name: "spectral shield", amt: 1});
  const k = B.buildSideDefault(W.HEROES.find(x => x.k === "kayo"),
    G.parseDeck(W.DECKS.kayo), H.db(), RNG.make("d"), {n: 0}).b;
  assert.equal(k.auraDiscount, null, "and only she prints it");
});

test("the AMOUNT is read, not the one pip she happens to print", {skip}, () => {
  /* SHE PRINTS {r}, so no fixture built on her alone can tell a read
     number from a literal 1 (v3.32, v3.74, v3.77, v3.78, v3.84 — sixth
     time). A synthetic hero record printing {r}{r} is what sees it. */
  const two = {n: "Enigma, Synthetic", tt: "Illusionist Hero - Young",
               ty: ["Illusionist", "Hero"], health: 20, intellect: 4,
               tx: "Your first Spectral Shield attack each turn costs {r}{r} "
                 + "less to activate."};
  assert.deepEqual(B.heroAbilities(two, two.n).auraDiscount,
    {name: "spectral shield", amt: 2});
  const other = Object.assign({}, two, {tx: "Your first Waxing Specter attack "
    + "each turn costs {r} less to activate."});
  assert.deepEqual(B.heroAbilities(other, other.n).auraDiscount,
    {name: "waxing specter", amt: 1}, "…and the NAME is read too");
});

test("the discount can never drive a cost below zero", {skip}, () => {
  /* CR 4.4.3e — points are lost, never owed — and a negative cost would
     hand the seat a resource. Her printed 1 against a printed 1 cannot
     express it, so the discount is oversized here. */
  const shield = mk("Spectral Shield");
  const on = {gear: [mk("Cosmo, Scroll of Ancestral Tapestry")], hist: {auraAtkNames: []}};
  const at = P.auraAttackOf(shield, on,
    {yourTurn: true, discount: {name: "spectral shield", amt: 99}});
  assert.equal(at.cost, 0, "floored at zero, never negative");
});

test("DRIVEN: a DIFFERENTLY NAMED aura is not discounted", {skip}, () => {
  /* "YOUR FIRST *SPECTRAL SHIELD* ATTACK" NAMES ONE CARD. Every other
     driven fixture here mints Spectral Shields, so dropping the name test
     is invisible to them — Waxing Specter is the ward aura that tells the
     two readings apart (and prints ward 3, so it also proves the power is
     per card). */
  const specter = mk("Waxing Specter");
  const on = {gear: [mk("Cosmo, Scroll of Ancestral Tapestry")], hist: {auraAtkNames: []}};
  const d = {name: "spectral shield", amt: 1};
  assert.equal(P.auraAttackOf(specter, on, {yourTurn: true, discount: d}).cost, 1,
    "a Waxing Specter pays the printed {r} — her line does not name it");
  assert.equal(P.auraAttackOf(mk("Spectral Shield"), on, {yourTurn: true, discount: d}).cost, 0,
    "…and the card she DOES name is free");
});

test("DRIVEN: the discount decides LEGALITY, not just the charge", {skip}, () => {
  /* `legal` ASKS WHETHER THE SEAT COULD RAISE THE COST, and with a full
     pool the discount never decides anything — which is why judge failing
     to pass it was invisible to every other drill here. At zero
     resources and an empty hand it is the whole question. */
  const t = table();
  const strip = (g, disc) => {
    const sides = g.sides.slice();
    sides[0] = Object.assign({}, sides[0], {res: 0, hand: []});
    const builds = (g.builds || []).slice();
    builds[0] = Object.assign({}, builds[0], disc ? {} : {auraDiscount: null});
    return Object.assign({}, g, {sides, builds});
  };
  assert.equal(J.legal(strip(t.g, true), {t: "activate", uid: t.uid}, 0), null,
    "with her discount the attack is free, so it is legal at zero resources");
  assert.ok(J.legal(strip(t.g, false), {t: "activate", uid: t.uid}, 0) != null,
    "…and without it, it is not");
});

test("DRIVEN: the FIRST is discounted and the SECOND pays full", {skip}, () => {
  /* THE FIXTURE IS TWO SHIELDS, because the discount is spent by a swing
     from a card of that NAME — "your first SPECTRAL SHIELD attack". One
     shield cannot tell "discounted once" from "discounted always": the
     once-per-turn limit stops the same aura swinging twice, so the second
     attack has to come from a second copy. */
  /* THE FIRST SHIELD CARRIES A COUNTER, so Cosmo's go again keeps the
     action point and the second attack is legal at all. Without it the
     first swing spends the turn's one point and the second is refused —
     correct rules, and a fixture that cannot reach the thing it names.
     It also means this drill exercises BOTH of Cosmo's sentences. */
  const t = table({shields: 2, counters: 1});
  assert.ok(t.uid2, "the fixture needs two");
  const declared = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.equal(declared.sides[0].res, t.g.sides[0].res,
    "the first is free — 1 minus her 1");
  /* THE FIRST CHAIN MUST CLOSE BEFORE THE SECOND CAN BE DECLARED. Written
     as two `reduce`s back to back, the second was refused "no
     action-speed window" and the resource simply did not move — which
     looks exactly like a discount that never spends. */
  /* RESOLVED BY PASSING, NOT BY THE POLICY. `resolve()` lets
     `sparring.act` act — and since v3.84 the policy can propose an aura
     attack, so it spent the SECOND shield during the resolution and this
     drill was handed "Spectral Shield has already attacked this turn".
     A fixture driven through a policy is a fixture the policy can
     consume; second time in one version. */
  const one = passOut(declared);
  const two = J.reduce(one, {t: "activate", uid: t.uid2}, 0);
  assert.ok(!two.error, "the second must be legal: " + two.error);
  assert.equal(two.state.sides[0].res, one.sides[0].res - 1,
    "…and the second pays the printed {r}");
});

test("DRIVEN: without the passive, the first pays full too", {skip}, () => {
  /* THE NEGATIVE CONTROL. Every drill above passes on an engine where the
     aura attack is simply free. */
  const t = table({noDiscount: true});
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.equal(out.sides[0].res, t.g.sides[0].res - 1);
});

test("the discount is spent by name, and the record clears with the turn", {skip}, () => {
  /* "EACH TURN" NEEDS NO BOOKKEEPING OF ITS OWN — CR 4.4.4 clears `hist`
     at the turn boundary, which is the same thing `atkNames` leans on. */
  const S = require("../engine/sides.js");
  assert.deepEqual(S.freshHist().auraAtkNames, [],
    "the record exists and starts empty every turn");
  const t = table();
  const after = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.deepEqual(after.sides[0].hist.auraAtkNames, ["Spectral Shield"],
    "the swing is recorded by NAME, not by uid — a second copy spends it too");
});

test("DRIVEN: a +1{p} counter makes it 2, and it goes again", {skip}, () => {
  /* COSMO'S SECOND SENTENCE, and Enigma's deck is where the counters come
     from — Astral Etchings, Uphold Tradition, Spectral Manifestations all
     put +1{p} on an aura with ward. Go again is a GAIN (CR 5.3.5), so the
     observable is the action point, not a log line (v3.58). */
  const t = table({counters: 1});
  const out = resolve(J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state);
  assert.equal(t.g.sides[1].hp - out.sides[1].hp, 2, "ward 1 plus the counter");
  assert.equal(out.sides[0].ap, t.g.sides[0].ap,
    "…and the point is KEPT — one spent, one gained");
});

test("DRIVEN: without Cosmo the aura cannot attack at all", {skip}, () => {
  /* THE NEGATIVE CONTROL. Every drill above passes just as well on an
     engine where any board aura may swing. */
  const t = table({noCosmo: true});
  const why = J.legal(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(why != null, "it must be refused");
  assert.match(String(why), /prints no attack to activate/);
});

test("DRIVEN: it is once per turn", {skip}, () => {
  const t = table();
  const after = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.match(String(J.legal(after, {t: "activate", uid: t.uid}, 0)),
    /already attacked this turn/);
});

test("the once-per-turn key is namespaced, so routes cannot collide", {skip}, () => {
  /* AN ALLY AND AN AURA CAN SHARE A UID SPACE — both are board entries —
     so an `ally<uid>` key would spend the other's allowance. `weaponUsed`
     is keyed `aura<uid>` on this route. */
  const t = table();
  const after = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.ok((after.sides[0].weaponUsed || {})["aura" + t.uid],
    "the aura's allowance is spent under its own prefix");
  assert.ok(!(after.sides[0].weaponUsed || {})["ally" + t.uid],
    "…and not under the ally's");
});

test("the whole static reads, and only when the grant parses", {skip}, () => {
  /* v3.63's RULE — credit the clauses only if the reader actually
     answered. Crediting a clause whose reader declined is the no-op blind
     spot, and the audit counts a `run` clause as accounted for. */
  const fx = P.fxParse(mk("Cosmo, Scroll of Ancestral Tapestry"));
  assert.equal(fx.tier, "full");
  assert.ok(fx.auraWeapon, "the grant rides on the parse");
  assert.ok(fx.clauses.every(c => c.st === "run"), "both sentences are read");
  /* an UNREADABLE quoted ability refuses the whole grant */
  const broken = {name: "Cosmo probe BROKEN", pitch: 0, tt: "Illusionist Weapon - Scroll (2H)",
                  ty: ["Illusionist", "Weapon"], kw: [], power: null,
                  tx: "During your turn, auras you control with ward are weapons with "
                    + "base {p} equal to their ward and \"Something Unreadable\""};
  assert.equal(P.auraWeaponGrant(broken), null);
  assert.ok(!P.fxParse(broken).auraWeapon, "…and the card is not credited");
});

/* ---- THE GUARD THAT BELONGS TO THE SHAPE ----------------------------- */

test("an attacking aura stays in the ARENA — it is not filed to the chain", {skip}, () => {
  /* v3.43's RULE, THIRD OUTING. `declareAttack`'s `inPlay` guard was
     written for weapons ("a weapon stays equipped, so it never leaves the
     gear zone"), v3.44 added the ally route and had to be told, and this
     is the third. Measured before it had its third sibling: **3182
     `CARD-IN-TWO-ZONES` violations in 210 self-play games**, the board and
     the chain both holding the same aura.

     A GUARD BELONGS TO THE SHAPE, NOT TO THE VERSION THAT WROTE IT — and
     the shape here is "an ACTIVATION route leaves its card where it is". */
  const INV = require("../engine/invariants.js");
  const t = table();
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0).state;
  assert.ok((out.sides[0].board || []).some(b => b && b.uid === t.uid),
    "the aura is still in the arena");
  assert.ok(!(out.chainCards || []).some(x => x.card && x.card.uid === t.uid),
    "…and NOT also on the combat chain");
  assert.deepEqual(INV.errors(out).filter(v => v.code === "CARD-IN-TWO-ZONES"), []);
});

test("the guard names every activation route, so a fourth cannot be forgotten", {skip: false}, () => {
  const src = require("fs").readFileSync(__dirname + "/../engine/judge.js", "utf8");
  const m = src.match(/const inPlay = [^;]+;/);
  assert.ok(m, "the guard must exist");
  for(const route of ["fromWeapon", '"ally"', '"aura"'])
    assert.ok(m[0].indexOf(route) >= 0,
      "the `inPlay` guard must name the " + route + " route — every source of "
      + "activated attacks leaves its card where it is");
});

test("the POLICY can propose it — a route with no caller is not built", {skip}, () => {
  /* THE THIRD TIME IN ONE CYCLE that a built route sat unproposed (v3.50's
     allies, v3.80's non-attacks, this). `sparring.js` reads no card text
     by contract, so an aura's power — its printed WARD rather than a
     `power` field — was unreachable to it; `judge.boardAttackOf` answers
     for both routes and the policy asks judge. */
  const t = table();
  const sides = t.g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {hand: []});   /* nothing better to do */
  const g = Object.assign({}, t.g, {sides});
  const a = SP.act(g, 0);
  assert.ok(a, "the policy must have something to do");
  assert.equal(a.t, "activate");
  assert.equal(a.uid, t.uid, "…and it is the aura");
  /* and judge answers the same thing the policy ranked on */
  const at = J.boardAttackOf(g, 0, t.uid);
  assert.equal(at.power, 1, "its ward");
  assert.equal(at.kind, "aura");
  assert.equal(J.boardAttackOf(g, 1, t.uid), null, "and it is not the other seat's");
  /* "DURING YOUR TURN" MUST REACH THIS ANSWER TOO. Asking as seat 1 above
     returns null for a weaker reason — the entry is not on seat 1's board
     at all — so hardcoding `yourTurn: true` inside `boardAttackOf` passes
     it. The fixture that bites keeps the aura on seat 0's board and hands
     the turn to seat 1. A fixture where two things coincide has tested
     neither (v3.50). */
  const theirTurn = Object.assign({}, g, {turnPlayer: 1});
  assert.equal(J.boardAttackOf(theirTurn, 0, t.uid), null,
    "on the opponent's turn the grant does not apply — the card's first three words");
});
