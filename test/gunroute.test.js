/* ============================================================
   THE GUN WITH NO BUTTON (v4.49)

   PLASMA BARREL SHOT is in Dash's gear list, prints three lines, and had
   NO ROUTE AT ALL on either board:

     Once per Turn Action - Remove a steam counter from this: Attack
     Action - {r}{r}: If this has no steam counters, put a steam counter
                      on it. Go again
     This card's {p} is equal to 1 plus the number of times you've boosted
     this combat chain.

   `parser.isWeapon` asked whether a weapon carries a PRINTED POWER, which
   is a proxy for "does this swing" — and this card's power is a printed
   FORMULA, so it carries none. The predicate that decides whether it
   swings refused it BECAUSE of the very line that says what it swings for;
   and `parseHeroPower` refuses a payload of "Attack" (that is the weapon
   reader's job), so the ability branch built nothing either.

   FIVE THINGS WERE WRONG AND FOUR OF THEM ONLY BECAME VISIBLE ONCE THE
   ROUTE EXISTED — v3.72's rule: building a SOURCE makes a defect
   reachable that was wrong the whole time it could not be reached.

     1  no route at all             `isWeapon` asked a proxy
     2  the base power              an inline regex in `build.js`, dead twice
     3  a free action point         `fx.ga` read the steam line's go again
     4  the steam cost unenforced   at the TABLE only (v3.01's shape)
     5  one tile, two routes        the swing and the ability, one tap
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");
const G = require("../engine/game.js");
const T = require("../engine/types.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  return (j.cards || j).map(r => {
    const m = C.mapDbCard(r);
    return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, tt: m.tt,
            ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
  });
})();

const gun = uid => { H.db();
  const gr = {...H.card("Plasma Barrel Shot", 0), uid: uid == null ? 41 : uid};
  B.equipPiece(gr); return gr; };

/* ---- 1. THE ROUTE ----------------------------------------------------- */

test("it prints its own weapon attack, so `isWeapon` says yes", {skip}, () => {
  const c = pool.find(x => x.name === "Plasma Barrel Shot");
  assert.equal(c.power, null, "it prints NO power — the power is a formula");
  assert.equal(T.isWeaponType(c), true, "and its TYPE is Weapon");
  assert.equal(P.isWeapon(c), true, "so it swings");
  /* THE QUOTE IS THE DISCRIMINATOR, and Cosmo is the control: its only
     attack line is a QUOTED granted ability, so `weaponCost` matches the
     raw text and must NOT be trusted — v3.83's 254 illegal 0-power swings. */
  const cos = pool.find(x => /^Cosmo/.test(x.name));
  assert.ok(P.weaponCost(cos.tx || ""),
    "`weaponCost` DOES match Cosmo's quoted grant — which is why the raw read is wrong");
  assert.equal(P.isWeapon(cos), false, "and Cosmo still prints no attack of its own");
});

test("the piece is BUILT: cost folded, steam button made", {skip}, () => {
  const gr = gun();
  assert.equal(gr.cost, 0, "the activation cost is folded onto the entry (a steam counter, not {r})");
  assert.equal(gr.needSteam, true, "and the printed steam cost is carried");
  assert.ok(gr.pow && gr.powCard, "and it gets its steam-build ability");
  assert.match(gr.powCard.uid, /^gp/, "keyed `gp`+uid, which is what names the route");
});

/* ---- 2. THE BASE POWER IS A PRINTED DEFINITION ------------------------ */

test("the formula is READ, off the LEVELLED clause", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(pool.find(x => x.name === "Plasma Barrel Shot"));
  assert.deepEqual(fx.powFormula, {base: 1, per: "perBoost"});
  const cl = (fx.clauses || []).find(x => /is equal to/i.test(x.t));
  assert.ok(cl && cl.st === "run", "and the clause is credited");
});

test("BOTH printed grammars of the countable reach one key", {skip}, () => {
  /* THE POOL PRINTS THE SAME COUNTABLE TWO WAYS. Overblast says "for each
     TIME you have boosted"; this says "the number of TIMES you have
     boosted" — the head noun is plural after "the number of" and singular
     after "for each". `perCountKey` tries the phrase and then its singular
     head, so the vocabulary stays CLOSED (this widens which STRINGS reach
     a key, never which keys exist) and the countable is not written into
     the table twice, which is where drift starts. */
  const tab = P.PER_COUNT["{p}"];
  assert.equal(P.perCountKey(tab, "time you have boosted this combat chain"), "perBoost");
  assert.equal(P.perCountKey(tab, "times you have boosted this combat chain"), "perBoost");
  assert.equal(P.perCountKey(tab, "moons in the sky"), null,
    "and an unknown countable is still unknown — the closure is not widened");
});

test("the CONTRACTION reads too — a raw scan levels for itself", {skip}, () => {
  /* `tl` is `clean(tx).toLowerCase()` and is NOT levelled (v3.36), so the
     first draft of this reader matched nothing: the card prints "this
     CARD'S" and "you'VE", and `SYNONYMS` rewrites both — but only for
     `classifyClause`. A pattern spelling the printed form looks exactly
     like one that is simply wrong. */
  const at = tx => { P.fxReset();
    return P.fxParse({name: "SYN-FORMULA-" + tx.length, pitch: 0, cost: null,
      power: null, def: null, tt: "Mechanologist Weapon - Gun (2H)",
      ty: ["Mechanologist", "Weapon"], kw: [], gkw: [], tx}).powFormula; };
  for(const tx of [
    "This card's {p} is equal to 1 plus the number of times you've boosted this combat chain.",
    "This card's {p} is equal to 1 plus the number of times you have boosted this combat chain.",
    "This's {p} is equal to 1 plus the number of times you've boosted this combat chain."])
    assert.deepEqual(at(tx), {base: 1, per: "perBoost"}, "must read: " + tx);
  /* THE BASE IS READ. The one pool record prints 1, so a hardcoded 1 is
     SILENT against every real fixture (v3.32). */
  assert.deepEqual(at("This card's {p} is equal to 4 plus the number of times you've boosted this combat chain."),
    {base: 4, per: "perBoost"}, "a card printing 4 starts at 4");
  /* AND AN UNKNOWN COUNTABLE LEAVES IT UNREAD. */
  assert.equal(at("This card's {p} is equal to 1 plus the number of moons in the sky."),
    undefined, "an unreadable countable refuses rather than defaulting to a base");
});

test("DRIVEN: it swings for 1 plus the boosts, with counters ON TOP", {skip}, () => {
  const swing = (boosts, ctrs) => {
    P.fxReset();
    const gr = gun();
    const g = {...H.state({res: 9, ap: 1, gear: [gr],
                           counters: {41: {steam: 1, ...(ctrs ? {pow: ctrs} : {})}}},
                          {}, {turn: 3, actor: 0, turnPlayer: 0}),
               stack: [], chain: [], boostChain: boosts,
               phase: "action", step: "layer", priority: 0, passed: []};
    const out = J.withEffects(g, (fx, s) => fx.execute(s, gr, "weapon", 0));
    return {total: J.withEffects(out, (fx, s) => fx.linkPumps(s, {})).total,
            feed: (out.feed || []).join("\n")};
  };
  /* FOUR ROWS. The old engine swung for 0 at every count, so the 0-boost
     row alone cannot tell a working formula from a hardcoded 1. */
  for(const b of [0, 1, 2, 3])
    assert.equal(swing(b).total, 1 + b, `${b} boosts must swing for ${1 + b}`);
  /* THE COUNTERS RIDE ON TOP, which the dead branch dropped. The card says
     BASE, so a +1{p} counter is not part of it (v3.78, the other way). */
  assert.equal(swing(2, 2).total, 1 + 2 + 2, "two counters add two");
  /* AND THE FEED DOES NOT LIE ABOUT THE PRINTED NUMBER. `card.power || 0`
     said "(printed 0)" beside a perfectly correct 1 — the aura case one
     card over, and the reason that comment is in `effects.js`. */
  assert.ok(!/printed 0/.test(swing(2).feed),
    "the feed must not claim something added a point that never did");
});

/* ---- 3. THE GO AGAIN IS THE ATTACK LINE'S ----------------------------- */

test("the swing does NOT keep an action point the attack line never grants",
     {skip}, () => {
  /* Its go again is printed on the STEAM-BUILD line. The clause splitter
     breaks on the period, so `Go again` arrives as its own clause and sets
     `fx.ga` — the CARD's — and driven, the swing kept an ACTION POINT
     (CR 5.3.5). STRONGER than printed.

     `attackLineGa` IS THE READER AND IT ALREADY EXISTED, built for Cutty
     Shark, who prints two activated abilities where only one carries the
     keyword (v3.58, v3.73). */
  const c = pool.find(x => x.name === "Plasma Barrel Shot");
  P.fxReset();
  assert.equal(P.fxParse(c).ga, true, "the CARD does carry a go again somewhere");
  assert.equal(P.attackLineGa(c), false, "…but not on its attack line");

  const ap = () => {
    P.fxReset();
    const gr = gun();
    const g = {...H.state({res: 9, ap: 1, gear: [gr], counters: {41: {steam: 1}}},
                          {}, {turn: 3, actor: 0, turnPlayer: 0}),
               stack: [], chain: [], boostChain: 0,
               phase: "action", step: "layer", priority: 0, passed: []};
    const out = J.withEffects(g, (fx, s) => fx.execute(s, gr, "weapon", 0));
    return {ga: out.pend.ga, feed: (out.feed || []).join("\n")};
  };
  assert.equal(ap().ga, false, "so the swing grants none");
  assert.ok(!/goes again/.test(ap().feed), "and the feed does not say it does");
});

test("a weapon whose go again IS on its attack line keeps it", {skip}, () => {
  /* THE CONTROL, and it is a real card: Mark of the Huntsman prints
     "Once per Turn Action - {r}: Attack. Go again". A reader that refused
     every weapon's go again would pass the drill above perfectly.
     Measured over the pool's 13 swinging weapons, exactly ONE record moved. */
  const mk = pool.find(x => x.name === "Mark of the Huntsman");
  assert.ok(mk, "it is in the pool");
  assert.equal(P.attackLineGa(mk), true, "its go again is on its attack line");
  const moved = pool.filter(c => P.isWeapon(c))
    .filter(c => { P.fxReset(); return !!P.fxParse(c).ga !== P.attackLineGa(c); })
    .map(c => c.name).sort();
  assert.deepEqual(moved, ["Plasma Barrel Shot"],
    "the set of weapons where the two readings disagree moved");

  /* AND IT IS **DRIVEN**, because the two assertions above are about the
     PARSER and a swing site that refused EVERY weapon's go again passes
     them perfectly — found by sabotage.

     THE OBSERVABLE IS `pend.ga`, NOT `ap`, AND THAT IS A FACT ABOUT WHEN
     THE POINT IS SPENT. Go again is a GAIN of one action point (CR 5.3.5,
     v3.58) — but on an ATTACK the point is settled at RESOLUTION, in
     `linkPayload`, so both seats still read `ap: 1` the moment `execute`
     returns and an `ap` comparison here proves nothing. The first draft of
     this assertion made exactly that mistake and failed against a correct
     engine. What the link carries is what resolves. */
  H.db();
  const swingGa = nm => {
    P.fxReset();
    const gr = {...H.card(nm, 0), uid: 44};
    B.equipPiece(gr);
    const g = {...H.state({res: 9, ap: 1, gear: [gr], counters: {44: {steam: 1}}},
                          {}, {turn: 3, actor: 0, turnPlayer: 0}),
               stack: [], chain: [], boostChain: 0,
               phase: "action", step: "layer", priority: 0, passed: []};
    const out = J.withEffects(g, (fx, s) => fx.execute(s, gr, "weapon", 0));
    return {ga: out.pend.ga, ap: out.sides[0].ap};
  };
  const mkS = swingGa("Mark of the Huntsman");
  assert.equal(mkS.ga, true, "Mark of the Huntsman's swing KEEPS its printed go again");
  const pbsS = swingGa("Plasma Barrel Shot");
  assert.equal(pbsS.ga, false, "and the Gun's does not");
  assert.notEqual(mkS.ga, pbsS.ga,
    "the PAIR is what bites — a site that refused every weapon's go again, "
    + "or granted every one, leaves these two equal");
});

/* ---- 4. THE STEAM COST, AT THE TABLE ---------------------------------- */

const seated = (over, ctrs) => {
  P.fxReset();
  const gr = gun();
  return {gr, g: {...H.state({res: 20, ap: 9, gear: [gr], counters: ctrs || {}},
                             {}, {turn: 3, actor: 0, turnPlayer: 0}),
                  stack: [], chain: [], boostChain: 0,
                  phase: "action", step: "layer", priority: 0, passed: [],
                  ...(over || {})}};
};

test("DRIVEN: the table refuses a swing with no steam counter", {skip}, () => {
  /* `weaponCost` has answered `needSteam` since it was written and the
     TRAINER has refused this since v2.35 — `judge.legal` asked nothing, so
     at the table the swing was FREE and REPEATABLE: sev-3 *illegal play
     allowed*. v3.01's shape, one limit over from `oncePerTurn` and `taps`.
     `execute` spends the counter on both boards and always has, so the
     state was right and only the legality was missing. */
  const {g} = seated(null, {});
  const out = J.reduce(g, {t: "activate", uid: 41, target: "hero"}, 0);
  assert.ok(out.error, "it must be refused");
  assert.match(out.error, /steam counter/, "and named for what is missing");

  const ok = seated(null, {41: {steam: 1}});
  const fired = J.reduce(ok.g, {t: "activate", uid: 41, target: "hero"}, 0);
  assert.ok(!fired.error, "with one it fires: " + fired.error);
  assert.equal(((fired.state.sides[0].counters || {})[41] || {}).steam, 0,
    "and the counter is SPENT — the cost is real");
});

test("the trainer's own refusal is still there, and both read the same field",
     {skip}, () => {
  /* ONE FIELD, TWO BOARDS. The trainer's line has existed since v2.35 and
     is what this version's table branch was measured against — a rule on
     one board is the shape this project keeps finding (v3.01). */
  assert.match(HTML, /card\.needSteam/, "the trainer asks `needSteam`");
  const src = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8");
  assert.match(src, /piece\.needSteam/, "and so does judge");
});

/* ---- 5. ONE PIECE, TWO ROUTES ----------------------------------------- */

test("a `gp`-prefixed uid names the ABILITY, a bare one the SWING", {skip}, () => {
  /* The branch used to choose by ELIMINATION — `isWeapon` false meant the
     ability — which is right for 32 of the pool's 33 ability-bearing
     pieces and wrong for the one with both. Whichever branch it landed in,
     the OTHER button did not exist at the table.

     THE DISCRIMINATOR ALREADY EXISTED: `equipPiece` keys the powCard
     `"gp"+uid` and `execute` finds the piece back off it. */
  const ability = seated(null, {});
  let out = J.reduce(ability.g, {t: "activate", uid: "gp41"}, 0);
  assert.ok(!out.error, "the ability is reachable by its own uid: " + out.error);
  assert.equal(((out.state.sides[0].counters || {})[41] || {}).steam, 1,
    "and it builds the steam counter");

  /* AND THE SWING IS STILL THE BARE UID. */
  const swing = seated(null, {41: {steam: 1}});
  out = J.reduce(swing.g, {t: "activate", uid: 41, target: "hero"}, 0);
  assert.ok(!out.error, "the swing is reachable by the bare uid: " + out.error);
  assert.ok(out.state.pend, "and it declares an attack");
});

test("a bare uid on a piece with NO attack still means the ability", {skip}, () => {
  /* ELIMINATION STAYS THE DEFAULT, or every one of the 32 ability-only
     routes would need its caller changed. Death Dealer is the control. */
  H.db();
  const W = require("./helpers/extract").loadData();
  const dd = (B.buildSideDefault(W.HEROES.find(h => h.k === "azalea"),
    G.parseDeck(W.DECKS.azalea), H.db(),
    require("../engine/rng.js").make("gun"), {n: 0}).b.gear || [])
    .find(g => /Death Dealer/.test(g.name));
  assert.ok(dd, "it is in Azalea's gear");
  assert.equal(P.isWeapon(dd), false, "it prints no attack");
  assert.ok(dd.pow && dd.powCard, "and build.js gives it an ability");
});

test("exactly ONE pool piece prints both an attack and an ability", {skip}, () => {
  /* THE MEASUREMENT THE ROUTE CHANGE RESTS ON, pinned BOTH ways (v4.17):
     the one with both, and the count that has only an ability — because
     pinning the first alone cannot see the default changing underneath
     the other 32. */
  let both = [], abOnly = 0;
  for(const c of pool){
    if(!(T.isEquipment(c) || T.isWeaponType(c))) continue;
    const gr = {...c, uid: 1}; P.fxReset(); B.equipPiece(gr);
    if(!gr.pow) continue;
    if(P.isWeapon(gr)) both.push(c.name); else abOnly++;
  }
  assert.deepEqual(both, ["Plasma Barrel Shot"], "the set with BOTH routes moved");
  assert.equal(abOnly, 32, "and the count with an ability alone moved");
});

test("a PAID cost that resolves to nothing is refused first", {skip}, () => {
  /* The steam-build ability prints "IF THIS HAS NO STEAM COUNTERS, put a
     steam counter on it" and `effects.js` honours that at RESOLUTION — it
     logs "it already carries a steam counter" and puts nothing. So
     activating it with a counter already there charged {r}{r} AND the
     action point for a log line.

     v2.04 SETTLED THE OPPOSITE CASE AND THIS IS ITS MIRROR: an unpayable
     cost is deliberately INERT; a PAID cost that does nothing is the
     player losing value for a play the rules should have refused before
     they paid (v3.11). `fuzz.test.js` holds the property it rests on —
     `legal` and `reduce` agree. */
  const first = seated(null, {});
  let out = J.reduce(first.g, {t: "activate", uid: "gp41"}, 0);
  assert.ok(!out.error, "the first build is legal");
  /* clear the per-turn allowance so ONLY the printed gate can refuse */
  const again = {...out.state,
    sides: out.state.sides.map((s, i) => i === 0 ? {...s, weaponUsed: {}, ap: 9} : s)};
  out = J.reduce(again, {t: "activate", uid: "gp41"}, 0);
  assert.ok(out.error, "the second must be refused BEFORE it is paid");
  assert.match(out.error, /already carries a steam counter/);
});

/* ---- the table's tile offers both, and says which ---------------------- */

test("the table's gear tile offers the ability as a fallback", {skip}, () => {
  /* A SOURCE SCAN CANNOT TELL A LIVE OFFER FROM A DEAD ONE (v4.00), so the
     reach of this one is STATED: it asserts the tile BUILDS both actions
     and names the route in the verb. What carries the real property is the
     driven census above — every route `judge.legal` accepts is reachable. */
  /* BOUNDED AT THE NEXT SAME-INDENT DECLARATION, never at a character
     count (v4.05): a bound too NARROW invents findings exactly as one too
     WIDE hides them, and the first draft of this drill used 3000 and
     reported the verb line missing from a body that contains it. */
  const i = HTML.indexOf("const gearTile = ");
  assert.ok(i > 0, "gearTile is gone");
  const rest = HTML.slice(i + 1);
  const end = (rest.match(/\n  (?:const|function|let) /) || {index: rest.length}).index;
  const body = HTML.slice(i, i + 1 + end);
  assert.ok(body.length > 1500 && body.length < 12000,
    "the gearTile body came out " + body.length + " chars — check the bound");
  assert.match(body, /const ability = \(gr\.pow && gr\.powCard\) \? \{t:"activate", uid:"gp"\+gr\.uid\} : null;/,
    "the tile builds the ABILITY action off the powCard's own uid");
  assert.match(body, /mine\(swing\) \? swing/, "the swing is offered first — it is the play");
  assert.match(body, /\(ability && mine\(ability\)\)/, "…and the ability is the fallback");
  /* THE VERB NAMES THE ROUTE. It said "swing" for every `activate`, so
     tapping any of the 32 ability-only pieces promised a swing the piece
     does not print — and the two-tap peek shows the ABILITY's card, so the
     word and the picture disagreed. */
  assert.match(body, /abTap \? "activate" : "swing"/, "the verb names which route");
  assert.match(body, /abTap && gr\.powCard \? gr\.powCard : gr/,
    "and the peek shows the thing being committed to");
});
