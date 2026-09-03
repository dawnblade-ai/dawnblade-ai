/* ============================================================
   WHICH ROUTE IS THIS PIECE ON? (v3.83)

   CLAUDE.md pins the split in as many words:

     types.isWeaponType(c)   is this card's TYPE Weapon
     parser.isWeapon(c)      is this a weapon WITH A PRINTED POWER

   and the second is the question "does this thing swing". `judge.js`
   asked the FIRST one, at both of its activation sites, and four pool
   records are Weapon-typed with no printed power:

     Cosmo, Scroll of Ancestral Tapestry   Plasma Barrel Shot
     Death Dealer (Bow)                    Crucible of Aetherweave

   THEY CAME OUT WRONG IN BOTH DIRECTIONS.

   Cosmo and Plasma Barrel Shot fell into the SWING branch, where
   `weaponCost` matched the QUOTED granted ability inside their rules text
   — Cosmo's "auras you control with ward are weapons with … 'Once per
   Turn Action - {r}: Attack'". Measured: **254 illegal 0-power swings in
   five Enigma games**, and it was a stall contributor before v3.80.

   Death Dealer and the Crucible fell there too, where `weaponCost` found
   nothing and the branch refused them "prints no weapon attack" — so
   Azalea's arsenal put and Iyslander's amp were UNREACHABLE at the table
   while working perfectly in the trainer.

   The trainer has always asked `isWeapon` and `build.js` builds the
   powCard off the same predicate. v3.01's shape: a rule that exists on
   one board.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const T = require("../engine/types.js");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("wpr"), {n: 0}).b;
  return _b[k];
}
const gearOf = (k, re) => build(k).gear.find(g => re.test(g.name));

/* A REAL MATCH, driven through `judge.legal` — `H.state` builds an
   effects-shaped state and carries no CR machine at all, so a drill about
   `legal` has to open a real game. Seat 0 is the named hero, and its gear
   is replaced with the one piece under test. */
function table(k, piece){
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("wproute");
  const h0 = W.HEROES.find(x => x.k === k), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[k]), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {gear: [piece], res: 9});
  return Object.assign({}, g, {sides});
}

test("the pool prints exactly four Weapon-typed pieces with no power", {skip}, () => {
  /* THE MEASUREMENT THE SPLIT RESTS ON. `types.test.js` pins the same
     four from the other end; a fifth means something changed that nobody
     decided, and it would land on whichever route this file chose. */
  const W = loadData();
  const found = new Set();
  for(const h of W.HEROES)
    for(const g of build(h.k).gear)
      if(T.isWeaponType(g) && !P.isWeapon(g)) found.add(g.name);
  assert.deepEqual([...found].sort(), [
    "Cosmo, Scroll of Ancestral Tapestry",
    "Crucible of Aetherweave",
    "Death Dealer",
    "Plasma Barrel Shot"
  ]);
});

test("judge routes on parser.isWeapon, never on the TYPE", {skip}, () => {
  const src = fs.readFileSync(__dirname + "/../engine/judge.js", "utf8");
  assert.equal((src.match(/if\(!PR\.isWeapon\(piece\)\)\{/g) || []).length, 2,
    "both activation sites — `legal` and `doActivate`");
  assert.doesNotMatch(src, /if\(!TY\.isWeaponType\(piece\)\)/,
    "the TYPE question is not the route question");
});

test("DRIVEN: Cosmo is NOT offered a swing — it prints no attack of its own", {skip}, () => {
  /* IT GRANTS ONE. "During your turn, auras you control with ward are
     weapons with base {p} equal to their ward and …" — the attack belongs
     to the AURA, and that grant is unbuilt. Refusing is weaker than
     printed and visible; swinging a 0-power scroll is an illegal play. */
  const cos = gearOf("enigma", /^Cosmo/);
  assert.ok(cos, "it is in her gear");
  assert.equal(P.isWeapon(cos), false, "no printed power");
  assert.ok(P.weaponCost(cos.tx || ""),
    "…and `weaponCost` DOES match the quoted granted ability — which is "
    + "exactly why the route cannot be decided by asking it");
  const why = J.legal(table("enigma", cos), {t: "activate", uid: cos.uid}, 0);
  assert.ok(why != null, "it must be refused");
  assert.match(String(why), /prints no activated ability/,
    "…and refused on the ABILITY route, which is the route it is actually on");
});

test("DRIVEN: Death Dealer's ability is reachable at the table now", {skip}, () => {
  /* A BOW WHOSE PRINTED ABILITY IS AN ARSENAL PUT (v2.34). `build.js`
     gives it a powCard because `parser.isWeapon` is false for it — and
     judge then refused that very piece "prints no weapon attack". */
  const dd = gearOf("azalea", /Death Dealer/);
  assert.ok(dd, "it is in Azalea's gear");
  assert.equal(P.isWeapon(dd), false);
  assert.ok(dd.pow && dd.powCard, "build.js gives it an ability");
  assert.equal(P.weaponCost(dd.tx || ""), null,
    "…and it prints no weapon attack, which is why the old branch refused it");
  const why = J.legal(table("azalea", dd), {t: "activate", uid: dd.uid, from: "gear"}, 0);
  assert.ok(!/prints no weapon attack/.test(String(why)),
    "it must not be refused as a weapon — got: " + why);
});

test("a REAL weapon still swings, and is not sent down the ability route", {skip}, () => {
  /* THE CONTROL. Routing everything to the ability branch would pass the
     three drills above perfectly. */
  const blade = gearOf("dorinthea", /Dawnblade/);
  assert.ok(blade && P.isWeapon(blade), "the Dawnblade prints power");
  assert.equal(J.legal(table("dorinthea", blade), {t: "activate", uid: blade.uid}, 0), null,
    "a printed weapon is legal to swing");
});

test("the TRAINER has always asked the same question", {skip: false}, () => {
  /* AND IT IS WHY THE BUG WAS INVISIBLE IN SOLO PLAY. `index.html` gates
     its swing route on `isWeapon` and its ability route on `gr.pow`, and
     `build.js` builds the powCard off `isWeapon` too — three readers
     agreeing, and judge was the fourth asking something else. */
  const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.match(html, /isWeapon\(gr\)&&!gr\.destroyed/,
    "the trainer's swing route is power-gated");
  const bld = fs.readFileSync(__dirname + "/../engine/build.js", "utf8");
  assert.match(bld, /if\(\(!isWeapon\(gr\) \|\| _armed\) && gr\.tx\)/,
    "and build.js decides the ability route off the same predicate");
});
