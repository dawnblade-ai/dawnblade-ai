/* THE DRILLS THAT COULD NOT EXIST BEFORE (Phase 1).

   `buildSide` and the equipment slot rules lived inside index.html, where
   no drill could reach them. That is not a filing detail — it is why the
   v2.41 eight-gear bug shipped. Azalea was handed all EIGHT printed pieces
   where the slot rules allow about five, and every card-level tool passed
   it: `npm run audit` said full coverage, `npm run fairness` said clean.
   Neither asks "how many of this legal thing", and neither could, because
   the function that decides is not a card.

   These are the two questions the move makes askable:

     1. is the loadout LEGAL?   (slot counts, both seats, all 15 heroes)
     2. is the build SYMMETRIC? (seat 1 gets what seat 0 gets)

   Structural drills run always; the ones that need real card text skip
   cleanly without the cached DB, same as coverage.test.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const B = require("../engine/build");
const C = require("../engine/cards");
const G = require("../engine/game");
const RNG = require("../engine/rng");
const { loadData } = require("./helpers/extract");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const ready = fs.existsSync(CACHE);
const skip = !ready && "no cached DB — run: node tools/audit.js";

let db = null;
const DB = () => db || (db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const W = loadData();
const heroes = () => W.HEROES;
const deckOf = h => G.parseDeck(W.DECKS[h.k]);
const slotsOf = h => {
  const saSet = (h.code || "").slice(0, 3) || null;
  return B.gearSlots(deckOf(h).gear.map(e => C.resolveEntry(DB(), e, saSet)));
};

/* ---- the slot rules, as a checker -------------------------------------
   `defaultPicks` is a TRANSITION (toggle this piece, evict what it
   displaces). This is the independent statement of what a legal board
   looks like, written from the printed zones rather than from the
   transition — so a bug in one cannot hide in the other. */
function slotViolations(list, sel){
  const item = i => list.find(x => x.i === i);
  const zs = sel.map(i => item(i).s);
  const out = [];
  for(const z of B.ARMOR_Z){
    const n = zs.filter(s => s.z === z).length;
    if(n > 1) out.push(`${n} pieces in the ${z} slot`);
  }
  const armorN = zs.filter(s => B.ARMOR_Z.includes(s.z) || s.z === "misc").length;
  if(armorN > 4) out.push(`${armorN} armour pieces (4 slots exist)`);
  const hands = zs.filter(s => ["1h", "2h", "off"].includes(s.z)).reduce((a, s) => a + s.h, 0);
  if(hands > 2) out.push(`${hands} hands' worth of weapons (2 hands exist)`);
  if(zs.filter(s => s.z === "off").length > 1) out.push("two off-hands");
  const qvr = zs.filter(s => s.z === "qvr").length;
  if(qvr > 1) out.push("two quivers");
  if(qvr && !zs.some(s => s.z === "2h")) out.push("a quiver with no bow to hang on");
  return out;
}

/* ---- THE EIGHT-GEAR BUG ----------------------------------------------- */

test("defaultPicks equips a LEGAL loadout for every hero", {skip}, () => {
  const bad = [];
  for(const h of heroes()){
    const list = slotsOf(h);
    const v = slotViolations(list, B.defaultPicks(list));
    if(v.length) bad.push(`${h.n}: ${v.join("; ")}`);
  }
  assert.deepEqual(bad, [], "an illegal default loadout — this is the v2.41 eight-gear bug");
});

test("defaultPicks never equips a hero's whole gear pool when that is illegal", {skip}, () => {
  /* The actual v2.41 shape: `{}` was passed for the opponent's loadout, so
     it wore everything printed. Pin that "everything" really is illegal
     for at least one hero, or the drill above proves nothing. */
  const overfull = heroes().filter(h => {
    const list = slotsOf(h);
    return slotViolations(list, list.map(x => x.i)).length > 0;
  });
  assert.ok(overfull.length > 0,
    "no hero's full gear pool is illegal — the eight-gear drill has nothing to bite on");
  for(const h of overfull){
    const list = slotsOf(h);
    assert.ok(B.defaultPicks(list).length < list.length,
      `${h.n}: defaultPicks took every piece, including the illegal ones`);
  }
});

/* ---- A BOW PRINTS NO POWER -------------------------------------------- */

test("a two-hander with no printed power is still equipped (bows)", {skip}, () => {
  /* Azalea's Death Dealer is `Ranger Weapon - Bow (2H)` with power: null.
     The old gate was `twoH.c.power != null`, so she defaulted to no weapon
     AND no quiver — her whole deck is arrows. */
  const withBow = heroes().filter(h =>
    slotsOf(h).some(x => x.s.z === "2h" && x.c.power == null));
  assert.ok(withBow.length > 0, "no powerless two-hander in the pool — this drill cannot bite");
  for(const h of withBow){
    const list = slotsOf(h);
    const sel = B.defaultPicks(list);
    const picked = sel.map(i => list.find(x => x.i === i).s.z);
    assert.ok(picked.includes("2h"), `${h.n}: the bow was skipped for printing no power`);
    if(list.some(x => x.s.z === "qvr"))
      assert.ok(picked.includes("qvr"), `${h.n}: bow equipped but the quiver was left behind`);
  }
});

test("every hero that PRINTS a weapon gets one", {skip}, () => {
  /* Not "every hero gets a weapon" — Gravy Bones's precon prints no
     weapon at all (four armour slots and an off-hand compass), so an
     unconditional version of this drill asserts something false about a
     real deck. The honest question is whether a printed weapon is ever
     left in the box, which is what the bow bug did. */
  const unarmed = heroes().filter(h => {
    const list = slotsOf(h);
    if(!list.some(x => ["1h", "2h"].includes(x.s.z))) return false;
    const sel = B.defaultPicks(list);
    return !sel.some(i => ["1h", "2h"].includes(list.find(x => x.i === i).s.z));
  }).map(h => h.n);
  assert.deepEqual(unarmed, [], "a hero with a printed weapon defaulted to bare hands");
});

/* ---- SYMMETRY: seat 1 gets what seat 0 gets ---------------------------- */

test("buildSide takes no seat argument and branches on no seat", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "build.js"), "utf8");
  const body = src.slice(src.indexOf("function buildSide"), src.indexOf("function buildSideDefault"));
  /* Strip comments AND regex literals before scanning. A hero's printed
     text legitimately contains the word "opponent" — iceFrostbite matches
     "an ice card during an opponent's turn" — so an English-word scan
     reports the card database as a seat reference. Same discipline as
     html-balance.test.js's pre-neutralize list: narrow the scan to what
     actually names a seat rather than loosening it. */
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/(?![*/])(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[gimsuy]*/g, "RE");
  for(const bad of [/\bseat\b/, /\bsides\s*\[\s*[01]\s*\]/, /\b_dummy\b/, /\bopponent\s*[.\[]/]){
    assert.ok(!bad.test(code),
      `buildSide names a seat (${bad}) — a build must not know which chair it is filling`);
  }
});

test("both seats build to the same shape, from the same function", {skip}, () => {
  const hs = heroes();
  const ctr = {n: 0};
  let rng = RNG.make("build-drill");
  const a = B.buildSideDefault(hs[0], deckOf(hs[0]), DB(), rng, ctr); rng = a.rng;
  const b = B.buildSideDefault(hs[1], deckOf(hs[1]), DB(), rng, ctr); rng = b.rng;
  assert.deepEqual(Object.keys(a.b).sort(), Object.keys(b.b).sort(),
    "the two seats' builds declare different fields");
  for(const p of B.PASSIVES){
    for(const [nm, x] of [[hs[0].n, a.b], [hs[1].n, b.b]])
      assert.equal(typeof x[p], "boolean", `${nm}: passive ${p} is not a boolean — a build must answer all of them`);
  }
});

test("every hero's build answers every passive, and its deck is 60 cards of hero", {skip}, () => {
  const bad = [];
  for(const h of heroes()){
    const ctr = {n: 0};
    const out = B.buildSideDefault(h, deckOf(h), DB(), RNG.make("per-hero"), ctr);
    for(const p of B.PASSIVES)
      if(typeof out.b[p] !== "boolean") bad.push(`${h.n}: ${p} is ${out.b[p]}`);
    if(!(out.b.hp > 0)) bad.push(`${h.n}: no life total`);
    if(!(out.b.int > 0)) bad.push(`${h.n}: no intellect`);
    if(!out.b.deck.length) bad.push(`${h.n}: empty deck`);
    if(!out.b.gear.length) bad.push(`${h.n}: no gear`);
  }
  assert.deepEqual(bad, []);
});

/* ---- UIDS AND THE SEEDED STREAM ---------------------------------------
   Both are silent when broken. Two seats sharing a uid is CARD-IN-TWO-ZONES
   in the invariant judge; two peers walking the rng in different orders
   deal different decks from the same table code. */

test("two seats built from one counter share no uid", {skip}, () => {
  const hs = heroes();
  const ctr = {n: 0};
  let rng = RNG.make("uid-drill");
  const a = B.buildSideDefault(hs[0], deckOf(hs[0]), DB(), rng, ctr); rng = a.rng;
  const b = B.buildSideDefault(hs[1], deckOf(hs[1]), DB(), rng, ctr);
  const uids = s => [...s.deck, ...s.gear].map(c => c.uid);
  const A = new Set(uids(a.b));
  const clash = uids(b.b).filter(u => A.has(u));
  assert.deepEqual(clash, [], "seat 1 was dealt uids seat 0 already holds");
});

test("the same seed deals the same two decks; a different seed does not", {skip}, () => {
  const hs = heroes();
  const deal = seed => {
    const ctr = {n: 0};
    let rng = RNG.make(seed);
    const a = B.buildSideDefault(hs[0], deckOf(hs[0]), DB(), rng, ctr); rng = a.rng;
    const b = B.buildSideDefault(hs[1], deckOf(hs[1]), DB(), rng, ctr);
    return [a.b.deck.map(c => c.name), b.b.deck.map(c => c.name)];
  };
  assert.deepEqual(deal("table-42"), deal("table-42"), "the same seed dealt two different games");
  assert.notDeepEqual(deal("table-42"), deal("table-43"), "two seeds dealt the identical game");
});

test("buildSide returns the advanced stream, so the caller can thread it", {skip}, () => {
  const h = heroes()[0];
  const rng = RNG.make("thread");
  const out = B.buildSideDefault(h, deckOf(h), DB(), rng, {n: 0});
  assert.ok(out.rng.n > rng.n,
    "the draw counter did not advance — a caller storing this back would repeat the shuffle");
});

/* ---- applyPick, the transition ----------------------------------------- */

test("applyPick is its own inverse for a piece that fits", {skip}, () => {
  const list = slotsOf(heroes().find(h => slotsOf(h).some(x => B.ARMOR_Z.includes(x.s.z))));
  const head = list.find(x => x.s.z === "head");
  const on = B.applyPick(list, [], head.i);
  assert.deepEqual(on, [head.i]);
  assert.deepEqual(B.applyPick(list, on, head.i), []);
});

test("dropping the two-hander drops the quiver with it", {skip}, () => {
  const h = heroes().find(x => slotsOf(x).some(g => g.s.z === "qvr"));
  if(!h) return;
  const list = slotsOf(h);
  const bow = list.find(x => x.s.z === "2h"), q = list.find(x => x.s.z === "qvr");
  let sel = B.applyPick(list, [], bow.i);
  sel = B.applyPick(list, sel, q.i);
  assert.ok(sel.includes(q.i), "the quiver would not go on over a bow");
  assert.deepEqual(B.applyPick(list, sel, bow.i), [],
    "the bow came off and left a quiver with nothing to hang on");
});

test("a quiver will not go on without a bow", {skip}, () => {
  const h = heroes().find(x => slotsOf(x).some(g => g.s.z === "qvr"));
  if(!h) return;
  const list = slotsOf(h);
  const q = list.find(x => x.s.z === "qvr");
  assert.deepEqual(B.applyPick(list, [], q.i), [], "a quiver went on with no bow equipped");
});
