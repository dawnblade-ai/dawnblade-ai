/* ============================================================
   A MANDATORY WATCHER ON SOMEBODY ELSE'S HIT (v4.25)

   > "When a Mechanologist attack action card you control hits a hero,
   >  destroy this and deal 4 damage to them."       — BOOM GRENADE ×3

   v4.24 censused the pool's on-hit SUBJECTS — seven distinct, four of
   them third person — and made the third-person ones refuse, because
   `fx.onHitHero` means "when THIS hits" and is read only from `pend`,
   which an ITEM never opens. Three of the four were already built on
   their own routes; this was the one with none, and the refusal was the
   honest report while it lasted. A recorded refusal is a DEBT (v3.38).

   TWO HALVES, AND BOTH WOULD HAVE BEEN WRONG ALONE:

     the ROUTE      `offerPayCost`'s scan one trigger over, mandatory
                    rather than an offer
     the PAYLOAD    `classifyClause("destroy this and deal 4 damage to
                    them")` answers `[["dmg",4]]` — the drawback silently
                    dropped — so reading the tail whole files an
                    UNBOUNDED REPEATABLE 4 damage

   It is the grenade's whole reason to stay alive, which is what makes
   crank's counter a real decision.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});

/* ---- 1. THE READING ----------------------------------------------- */

test("the subject goes through `attackQual`, so no vocabulary is invented", {skip}, () => {
  H.db();
  P.fxReset();
  for(const [p, dmg] of [[1, 4], [2, 3], [3, 2]]){
    const fx = P.fxParse(H.card("Boom Grenade", p));
    assert.deepEqual(fx.hitWatch,
      {q: {aac: true, g: [["mechanologist"]]}, heroOnly: true, selfDestroy: true,
       ops: [["dmg", dmg]]},
      "and the AMOUNT is the printing's own — 4 / 3 / 2 across the three, " +
      "which is the one place the pool can tell a read number from a " +
      "hardcoded one without a synthetic");
  }
  P.fxReset();
});

test("the printed DESTROY is kept, and that is why the tail is split", () => {
  /* Asserted rather than described (v3.62): if the payload reader ever
     learns the verb, this drill says so instead of the watcher quietly
     destroying twice. */
  assert.deepEqual(P.classifyClause("destroy this and deal 4 damage to them").ops,
    [["dmg", 4]], "the payload reader drops it");
  const fx = P.fxParse({name: "Split Probe A", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them."});
  assert.equal(fx.hitWatch.selfDestroy, true, "the watcher carries it");
  assert.deepEqual(fx.hitWatch.ops, [["dmg", 4]], "and does not run it twice");
});

test("the HERO gate and the RESTRICTION are both read, and an unreadable one refuses", () => {
  const bare = P.fxParse({name: "Split Probe B", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When a Mechanologist attack action card you control hits, deal 1 damage to them."});
  assert.equal(bare.hitWatch.heroOnly, false, "a bare \"hits\" fires on any attack-target");
  assert.equal(bare.hitWatch.selfDestroy, false, "and a card that prints no destroy gets none");

  /* `false` AND `null` ARE TWO DIFFERENT ANSWERS AND BOTH HALVES ARE
     PINNED (v3.31, v3.87). `attackQual` answering FALSE means "a limit I
     cannot read" and must refuse the clause — `qualMatches` treats a
     falsy qualifier as UNQUALIFIED, so a `false` reaching the fire site
     fires the watcher off every attack in the game. Answering NULL means
     the printed line restricts nothing, which is the faithful reading and
     matches everything on purpose. A drill that only asserts the refusal
     cannot tell the two apart, and neither can one that only asserts the
     bare form parses. */
  const bad = P.fxParse({name: "Split Probe C", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When a shimmering attack of unusual size you control hits a hero, deal 1 damage to them."});
  assert.equal(bad.hitWatch, undefined, "unreadable refuses");

  /* LATENT AND MEASURED: no pool record prints the bare form (all three
     hitWatch records are Boom Grenade, class- and type-qualified), so
     only a synthetic can reach it (v3.73). */
  const bare2 = P.fxParse({name: "Split Probe F", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When an attack you control hits a hero, deal 1 damage to them."});
  assert.equal(bare2.hitWatch.q, null, "an unrestricted watcher carries no qualifier");
  assert.equal(P.qualMatches(bare2.hitWatch.q, {tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]}, {}),
    true, "and therefore reads any attack, which is what the line says");

  /* AND SO DOES AN UNREADABLE PAYLOAD (v2.29). */
  const noPay = P.fxParse({name: "Split Probe D", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When a Mechanologist attack action card you control hits a hero, do something ineffable."});
  assert.equal(noPay.hitWatch, undefined);

  /* A `noop` PAYLOAD REFUSES TOO, and it is a DIFFERENT half of the guard
     from the one above: an unreadable payload answers `null`, a noop
     answers `run: false` with a reason. Built on one, the watcher would
     fire every hit and print the noop's reason into the feed under the
     card's name — the no-op blind spot with a trigger attached (v4.24).
     A fixture whose payload `classifyClause` answers NULL for never
     reaches the status test; that has cost a drill three times (v3.91,
     v3.93, v4.11). */
  assert.equal(P.classifyClause("dominate").status, "noop", "the premise");
  const noopPay = P.fxParse({name: "Split Probe H", pitch: 0, tt: "Mechanologist Action - Item",
    ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
    tx: "When a Mechanologist attack action card you control hits a hero, dominate."});
  assert.equal(noopPay.hitWatch, undefined);
});

test("the OPTIONAL sibling is still `payCost`'s, not this reader's", {skip}, () => {
  H.db();
  P.fxReset();
  /* Refraction Bolters prints the same trigger shape with "you MAY
     destroy this" (v3.93). It is claimed by the whole-card `payCost`
     reader above this loop, and the `you may` wording refuses here in any
     case — two independent reasons, and the drill pins the outcome. */
  const rb = P.fxParse(H.card("Refraction Bolters", 0));
  assert.equal(rb.hitWatch, undefined);
  assert.equal(rb.payCost && rb.payCost.trigger, "weaponHit");
  assert.equal(rb.tier, "full");
  P.fxReset();
});

/* ---- 2. DRIVEN ----------------------------------------------------- */

function swing(cardName, pitch, watcherTx){
  const bg = mk("Boom Grenade", 1, "bg1");
  if(watcherTx) bg.tx = watcherTx;
  const atk = mk(cardName, pitch, "a1");
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [atk], deck: [{uid: "f1", name: "F1"}],
                   board: [{card: bg, kind: "item", spent: false, uid: "bg1", sd: "turn"}],
                   counters: {bg1: {steam: 1}}},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  n = r.state;
  return settle(n);
}

/* DRIVE THE REAL ENTRY POINT (v3.20). The attack is on the STACK after
   `play`, not on the chain, so a loop conditioned on `chain.length` runs
   zero times and the drill passes against an engine that resolves
   nothing — which is what the first draft of this helper did. */
function settle(n0){
  const S = require("../engine/sparring.js");
  let n = n0;
  for(let i = 0; i < 24; i++){
    const seat = n.priority == null ? 0 : n.priority;
    const a = S.act(n, seat);
    if(!a) break;
    const q = J.reduce(n, a, seat);
    if(q.error) break;
    n = q.state;
    if(!n.pend && (!n.chain || !n.chain.length)) break;
  }
  return n;
}

test("DRIVEN: a Mechanologist attack action card connecting sets it off", {skip}, () => {
  H.db();
  const n = swing("Jump Start", 1);
  assert.equal(n.sides[1].hp, 11, "5 from the swing and 4 from the grenade");
  assert.equal((n.sides[0].board || []).length, 0, "and the printed destroy lands");
  assert.ok(n.sides[0].grave.some(c => c.name === "Boom Grenade"),
    "a destroyed permanent reaches the graveyard, turn-stamped");
});

test("DRIVEN: the printed RESTRICTION is enforced — a Generic attack does nothing", {skip}, () => {
  H.db();
  /* THE ROUTE IS THE QUALIFIER'S JOB. Brutal Assault is an attack action
     card and is not Mechanologist, so the class group is the only thing
     that can exclude it — a watcher with the restriction dropped would
     fire off every hero's every swing. */
  const n = swing("Brutal Assault", 1);
  assert.equal(n.sides[1].hp, 14, "6 from the swing, and nothing from the grenade");
  assert.equal((n.sides[0].board || []).length, 1, "it is still on the board");
});

test("DRIVEN: it fires ONCE — the destroy is what stops it repeating", {skip}, () => {
  H.db();
  let n = swing("Jump Start", 1);
  const hp1 = n.sides[1].hp;
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [],
       chain: [], chainCards: [], pend: null,
       sides: n.sides.map((s, i) => i === 0
         ? {...s, ap: 9, hand: [mk("Jump Start", 2, "a2")]} : s)};
  const r = J.reduce(n, {t: "play", uid: "a2", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  n = r.state;
  n = settle(n);
  assert.equal(n.sides[1].hp, hp1 - 4,
    "the second swing deals its own 4 power and no grenade damage — without " +
    "the destroy this is an unbounded repeatable 4 every time a Mechanologist " +
    "attack connects, which is the direction that steals games");
});

test("DRIVEN: it says \"hits a HERO\", so a hit on an ALLY does not set it off", {skip}, () => {
  H.db();
  /* CR 1.4.5 makes an ally an attack-target, so "hits" and "hits a HERO"
     stopped being the same event the moment one could be attacked
     (v3.45). Without this half the grenade goes off — and deals its
     damage to the HERO — because somebody swung at a Barnacle.

     THE THIRD CASE IS THE ONE THE GATE EXISTS FOR (v4.16): hero fires,
     ally does not, and a two-row drill sees neither. This is the ally
     row; the hero row is the first driven test above. */
  const bg = mk("Boom Grenade", 1, "bg1");
  const ally = Object.assign({}, H.card("Barnacle", 2), {uid: "al1"});
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}],
                   board: [{card: bg, kind: "item", spent: false, uid: "bg1", sd: "turn"}],
                   counters: {bg1: {steam: 1}}},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20,
                   board: [{card: ally, kind: "ally", spent: false, uid: "al1",
                            _life: ally.life}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "a1", from: "hand", target: "al1"}, 0);
  assert.ok(!r.error, String(r.error));
  n = settle(r.state);
  assert.equal(n.sides[1].hp, 20,
    "the hero took nothing — neither the swing nor the grenade");
  assert.equal((n.sides[0].board || []).length, 1,
    "and the grenade is still on the board, undestroyed");
});

test("DRIVEN: a swing blocked to nothing did not HIT, so nothing goes off", {skip}, () => {
  H.db();
  /* CR 7.5.5 — if no damage is dealt it is no longer a hit, so the guard
     is `total > 0` and not "an attack resolved". Without it the item
     goes off on a swing the wall stopped dead, which is stronger than
     printed AND destroys the piece for nothing. */
  const bg = mk("Boom Grenade", 1, "bg1");
  /* TWO WATCHERS, BECAUSE THE REAL CARD CANNOT REACH THE GUARD. Boom
     Grenade prints "hits A HERO", so `heroHit` already refuses a swing
     that dealt nothing and `total > 0` is silent against it — which is
     how the first draft of this drill passed with the guard removed. The
     guard is there for the BARE "hits" form (CR 7.5.5: if no damage is
     dealt it is no longer a hit), so the fixture that tests it is a
     synthetic printing exactly that (v3.73). */
  const bare = {name: "Split Probe I", pitch: 0, uid: "g1", cost: null, power: null,
    tt: "Mechanologist Equipment - Chest", ty: ["Mechanologist", "Equipment", "Chest"],
    kw: [], def: 0, curDef: 0,
    tx: "When a Mechanologist attack action card you control hits, deal 4 damage to them."};
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}], gear: [bare],
                   board: [{card: bg, kind: "item", spent: false, uid: "bg1", sd: "turn"}],
                   counters: {bg1: {steam: 1}}},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20,
                   hand: [mk("Wounding Blow", 1, "b1"), mk("Wounding Blow", 2, "b2")]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  n = r.state;
  /* WALK TO THE DEFEND STEP AND DECLARE BY HAND rather than leaving it to
     the policy: `sparring`'s `takeUpTo` will happily eat 5 rather than
     spend two cards, and a fixture that depends on a heuristic has not
     named what it is testing. */
  const S = require("../engine/sparring.js");
  for(let i = 0; i < 12 && n.step !== "defend"; i++){
    const seat = n.priority == null ? 0 : n.priority;
    const a = S.act(n, seat);
    if(!a) break;
    const q = J.reduce(n, a, seat);
    if(q.error) break;
    n = q.state;
  }
  assert.equal(n.step, "defend", "reached the defend step");
  for(const u of ["b1", "b2"]){
    const q = J.reduce(n, {t: "defend", uid: u}, 1);
    assert.ok(!q.error, String(q.error));
    n = q.state;
  }
  n = settle(n);
  assert.equal(n.sides[1].hp, 20, "the wall held — no damage, so no hit");
  assert.equal((n.sides[0].board || []).length, 1,
    "and the grenade is still there: a destroy paid for nothing is the " +
    "drawback taken with none of the payoff");
});

test("DRIVEN: a piece already destroyed holds nothing", {skip}, () => {
  H.db();
  /* A DESTROYED PERMANENT IS SPENT (v3.54, v4.15). Gear is MARKED rather
     than spliced, so `destroyed` is the only thing separating a live
     watcher from one that has already gone off — and `sweepGear` does not
     file it until the end phase, so it is still in the array for the rest
     of the turn. */
  const piece = {name: "Split Probe G", pitch: 0, uid: "g1", cost: null, power: null,
    tt: "Mechanologist Equipment - Chest", ty: ["Mechanologist", "Equipment", "Chest"],
    kw: [], def: 2, curDef: 2, destroyed: true,
    tx: "When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them."};
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}], gear: [piece]},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  n = settle(r.state);
  assert.equal(n.sides[1].hp, 15, "5 from the swing and nothing from the dead piece");
  P.fxReset();
});

test("DRIVEN: a watcher in the GEAR zone fires too, and is MARKED rather than spliced", {skip}, () => {
  H.db();
  /* THE GEAR HALF IS LATENT AND IS DRILLED ANYWAY (v3.73). Measured over
     the pool: exactly one record sets `hitWatch` and it is Boom Grenade,
     an ITEM on the board — so dropping `act(n).gear` from the scan is
     SILENT against every real fixture, exactly as `offerPayCost`'s own
     zone drill found (v3.93: Magmatic Carapace is a Chest and both of
     that version's cards are Legs). A synthetic piece is the only thing
     that can tell "the gear half is read" from "the gear half is
     assumed", and a reader that ignores a zone is reading the shape
     wrong whether or not anything notices today.

     AND THE DESTROY TAKES THE OTHER BRANCH. A gear piece is MARKED
     (v3.54): this fires in the DAMAGE step with the wall still declared,
     and the trainer's wall is INDICES into `gear`, so a splice here
     renumbers the defenders underneath it. `sweepGear` files it at the
     end phase. Asserting only that it fired would pass against a splice. */
  const piece = {name: "Split Probe E", pitch: 0, uid: "g1", cost: null, power: null,
    tt: "Mechanologist Equipment - Chest", ty: ["Mechanologist", "Equipment", "Chest"],
    kw: [], def: 2, curDef: 2,
    tx: "When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them."};
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}], gear: [piece]},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  n = settle(r.state);
  assert.equal(n.sides[1].hp, 11, "5 from the swing and 4 from the piece");
  assert.equal(n.sides[0].gear.length, 1, "the piece is still IN the array");
  assert.equal(n.sides[0].gear[0].destroyed, true, "and marked, not spliced");
  P.fxReset();
});

test("DRIVEN: the OPPONENT's watcher does not read your swing", {skip}, () => {
  H.db();
  /* "You control" is satisfied by construction — the scan is over the
     ACTOR, and inside a combat link the actor is the attacker. Written
     over both boards it would fire the defender's own grenade at their
     own hero. */
  const bg = mk("Boom Grenade", 1, "bg1");
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}]},
                  {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20,
                   board: [{card: bg, kind: "item", spent: false, uid: "bg1", sd: "turn"}],
                   counters: {bg1: {steam: 1}}},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0).state;
  n = settle(n);
  assert.equal(n.sides[1].hp, 15, "5 from the swing and nothing else");
  assert.equal((n.sides[1].board || []).length, 1, "their grenade is untouched");
});

/* ---- 3. THE CENSUS ------------------------------------------------- */

test("every third-person on-hit subject in the pool now has a route, and the SET is pinned", {skip}, () => {
  H.db();
  const raw = require("../data/pool.json");
  const C = require("../engine/cards.js");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const rows = [];
  for(const r of raw){
    const lines = (r.functional_text || "").split(/\n+/).flatMap(l => l.split(/(?<=\.)\s+/));
    if(!lines.some(l => /^when(?:ever)? (?:a|an|another|the|nasreth)\b[^,:]*\bhits?\b[^,:]*[,:]/i.test(l))) continue;
    const c = C.resolveEntry(db, {name: r.name, p: r.pitch === "" || r.pitch == null ? 0 : +r.pitch,
                                  code: null, q: 1});
    const fx = c ? P.fxParse(c) : {};
    rows.push(r.name + " -> " + (fx.hitWatch ? "hitWatch"
      : fx.payCost ? "payCost" : "none"));
  }
  assert.deepEqual([...new Set(rows)].sort(), [
    /* ARAKNI IS A DEMI-HERO and her drain is a HERO PASSIVE — `build.js`
       reads it into `daggerDrain` and `linkPayload` fires it (v3.77), so
       the CARD's own parse carries nothing and that is correct. She is in
       the census rather than filtered out of it, because "the card parse
       is empty" and "the mechanic is unbuilt" look identical from here
       and only one of them is true. */
    "Arakni, Tarantula -> none",
    "Boom Grenade -> hitWatch",
    /* NASRETH IS THE ONE STILL WAITING. Her payload — "banish a card from
       their SOUL" — has no reader, so the clause is honestly unread and
       the trigger has nothing to carry. Building that payload fails this
       drill and asks for a route. */
    "Nasreth, the Soul Harrower -> none",
    "Refraction Bolters -> payCost"], rows.join(" | "));
  /* AND THE SCAN IS PROVED ALIVE: three of these four are built, each on
     a different route, so a scan that stopped matching would report an
     empty set and satisfy nothing. */
  assert.ok(rows.length >= 6, "the scan found " + rows.length + " records");
});

/* ---- 4. THE INSTRUMENT --------------------------------------------- */

test("the counter's phrase and the engine's phrase are pinned together", () => {
  /* v3.81: a counter that spells the wrong word reports ZERO exactly as a
     missing feature does, and `death 0, gold 0` stood for three versions
     because of it. Both spellings live here, so a reword of either breaks
     a drill instead of silently zeroing the route count. Driven at v4.25:
     15 firings in 210 games, across three different Mechanologist attacks
     — which is the answer to v3.84's question (when you build a route, go
     and count how often it fires). */
  const fs2 = require("node:fs"), path2 = require("node:path");
  const eff = fs2.readFileSync(path2.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const sp = fs2.readFileSync(path2.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.ok(eff.includes("goes off — ${pc.name} connected"),
    "the engine stopped printing the phrase the counter watches for");
  assert.ok(/\/goes off —\/\.test\(line\)\)\s*events\.push\(\["hitwatch"/.test(sp),
    "the counter stopped watching for the phrase the engine prints");
  /* AND THE LINE COVERS BOTH HALVES OF THE SHAPE. A watcher that prints
     only when it also destroys itself halves its own count on the one
     printed variation the reader exists to carry. */
  assert.ok(/goes off — \$\{pc\.name\} connected` \+\s*\n?\s*\(hw\.selfDestroy \?/.test(eff),
    "the destroy is a RIDER on the sentence, not the reason it is printed");
});

