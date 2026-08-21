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

const CACHE = require("./helpers/extract").cardDbPath();
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
  const a = src.indexOf("function buildSide"), b = src.indexOf("function buildSideDefault");
  /* ASSERT THE SLICE BEFORE ASSERTING ABOUT IT (v3.15). Every check below
     is a NEGATIVE, and a negative over an empty slice passes for free —
     rename either anchor, or move `buildSideDefault` above `buildSide`,
     and this test goes green having read nothing at all. The audit that
     found this found only one of its shape; the rule is cheap, so keep it
     wherever a negative scan runs over a slice rather than a whole file. */
  assert.ok(a >= 0 && b > a, "buildSide's anchors moved — re-anchor this drill");
  const body = src.slice(a, b);
  assert.ok(body.length > 400, `the slice is ${body.length} bytes — too small to be buildSide`);
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
      assert.equal(typeof x[p], B.PASSIVE_TYPE[p],
        `${nm}: passive ${p} answers ${typeof x[p]}, ledger says ${B.PASSIVE_TYPE[p]} — a build must answer all of them`);
  }
});

/* The ledger must cover exactly the passives, or a new one can be added to
   PASSIVES with no declared type and `typeof x !== undefined` quietly
   becomes the whole check. */
test("PASSIVE_TYPE covers exactly PASSIVES", () => {
  assert.deepEqual(Object.keys(B.PASSIVE_TYPE).sort(), [...B.PASSIVES].sort(),
    "every passive needs a declared type, and every declared type a passive");
  for(const [p, t] of Object.entries(B.PASSIVE_TYPE))
    /* "string" JOINED THEM AT v3.21, deliberately. Briar's two clauses each
       NAME the token they create, and the passive carries that name so the
       mint site in `effects.js` names no token — the same reasoning that
       makes `atkPowOffChain` a number rather than a flag. Widening this
       list must stay a deliberate edit: it is what stops a passive being
       added with no declared type, where `typeof x !== undefined` quietly
       becomes the whole check. */
    assert.ok(t === "boolean" || t === "number" || t === "string",
      `${p}: a passive answers a boolean, a number or a string, not ${t}`);
});

test("every hero's build answers every passive, and its deck is 60 cards of hero", {skip}, () => {
  const bad = [];
  for(const h of heroes()){
    const ctr = {n: 0};
    const out = B.buildSideDefault(h, deckOf(h), DB(), RNG.make("per-hero"), ctr);
    for(const p of B.PASSIVES)
      if(typeof out.b[p] !== B.PASSIVE_TYPE[p]) bad.push(`${h.n}: ${p} is ${out.b[p]} (${typeof out.b[p]}, want ${B.PASSIVE_TYPE[p]})`);
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

/* ============================================================
   buildMatch — TWO SEATS, ONE SPEC, TWO PHONES (Phase 2)

   The lobby ships four small values (two hero keys, two loadouts, a
   seating call, the table code) and each peer builds the decks itself.
   That only works if the build is a pure function of the spec, and "it
   only shows up as a state-hash mismatch on turn one" is exactly the
   silent desync ROADMAP-MULTIPLAYER.md calls miserable to debug after
   the fact. So determinism is drilled head-on rather than inferred from
   the seeded shuffle underneath it.
   ============================================================ */

const mopts = () => ({db: DB(),
  heroes: Object.fromEntries(heroes().map(h => [h.k, h])),
  decks:  Object.fromEntries(heroes().map(h => [h.k, deckOf(h)]))});

/* A real spec, with each hero on its own legal default loadout — an
   empty gearIdx would build a match nobody could have sat down to. */
const spec = (over) => {
  const o = mopts();
  const keys = (over && over.heroes) || ["kayo", "dorinthea"];
  return {heroes: keys, first: 0, seed: "K7QM",
          boards: keys.map(k => ({gearIdx: B.defaultPicks(slotsOf(o.heroes[k])), cuts: {}})),
          ...over};
};

test("TWO PEERS BUILD THE SAME MATCH from the same spec", {skip}, () => {
  const s = spec();
  const a = B.buildMatch(s, mopts());
  const b = B.buildMatch(s, mopts());
  assert.equal(JSON.stringify(a.builds), JSON.stringify(b.builds),
    "two peers built different decks from one spec — this is the silent desync, at turn zero");
  assert.deepEqual(a.names, b.names);
  assert.equal(a.first, b.first);
  assert.ok(a.builds[0].deck.length > 30, "the build drove almost nothing");
});

test("a different table code deals a different game", {skip}, () => {
  const a = B.buildMatch(spec({seed: "K7QM"}), mopts());
  const b = B.buildMatch(spec({seed: "P44R"}), mopts());
  assert.notEqual(a.builds[0].deck.map(c => c.name).join("|"),
                  b.builds[0].deck.map(c => c.name).join("|"),
                  "the table code is the match seed — two codes must not deal one deck");
});

/* THE STREAM IS SEAT-SPECIFIC. One stream for both seats is reproducible
   and still wrong: it makes seat 1's deck the continuation of seat 0's. */
test("each seat draws from its OWN sub-stream", {skip}, () => {
  assert.notEqual(B.buildSeed("K7QM", 0), B.buildSeed("K7QM", 1));
  const m = B.buildMatch(spec({heroes: ["kayo", "kayo"]}), mopts());
  assert.notEqual(m.builds[0].deck.map(c => c.name).join("|"),
                  m.builds[1].deck.map(c => c.name).join("|"),
                  "the mirror match dealt both seats the identical shuffle");
});

/* THE SHUFFLES ARE INDEPENDENT; THE UID NUMBERING IS DELIBERATELY NOT.
   Cutting a card from seat 0 leaves seat 1's deck in the same ORDER —
   that is what the separate streams buy — but shifts every uid in it,
   because one counter is threaded through both seats so that no card in
   the match can repeat a uid. That trade is worth making: a renumbering
   is invisible to both peers (they compute it identically), whereas a
   repeated uid is a card the census cannot see. Pinned in both
   directions so neither half can be "fixed" without a decision. */
test("a cut leaves the other seat's shuffle alone, and renumbers it", {skip}, () => {
  const base = spec();
  const a = B.buildMatch(base, mopts());
  const b = B.buildMatch({...base, boards: [{...base.boards[0], cuts: {0: 1}}, base.boards[1]]}, mopts());
  assert.equal(b.builds[0].deck.length, a.builds[0].deck.length - 1, "the cut did not land");
  assert.equal(a.builds[1].deck.map(c => c.name).join("|"),
               b.builds[1].deck.map(c => c.name).join("|"),
               "seat 0 sideboarded and seat 1's SHUFFLE moved — the streams are entangled");
  assert.notEqual(a.builds[1].deck.map(c => c.uid).join("|"),
                  b.builds[1].deck.map(c => c.uid).join("|"),
                  "the uid counter is shared on purpose; if this stops shifting, it was made per-seat "
                  + "and the no-repeat drill below is now the only thing holding uniqueness");
});

/* A REPEATED UID IS CARD-IN-TWO-ZONES WEARING A DISGUISE. invariants.js
   censuses by uid, so two cards sharing one make a real card invisible
   and a phantom appear — which is how the runechant collision surfaced
   in live play in v2.23. Here the two seats are the new way to collide. */
test("no uid repeats across BOTH seats' decks, gear and start items", {skip}, () => {
  const m = B.buildMatch(spec(), mopts());
  const uids = [];
  m.builds.forEach(b => {
    (b.deck || []).forEach(c => uids.push(c.uid));
    (b.gear || []).forEach(c => uids.push(c.uid));
    if(b.startItem) uids.push(b.startItem.uid);
  });
  assert.ok(uids.length > 100, "the census drove almost nothing");
  assert.equal(new Set(uids).size, uids.length,
    "a uid repeats across the two seats — invariants.js would call it CARD-IN-TWO-ZONES");
});

test("every hero can be seated against every other", {skip}, () => {
  const o = mopts();
  const keys = heroes().map(h => h.k);
  for(const k of keys){
    const m = B.buildMatch(spec({heroes: [k, "kayo"]}), o);
    assert.ok(m.builds[0].deck.length > 30, k + " dealt no deck");
    assert.ok(m.builds[0].hp > 0 && m.builds[0].int > 0, k + " is seated with no life or intellect");
    assert.ok(m.builds[0].deck.length > m.builds[0].int, k + " cannot draw an opening hand");
  }
});

test("the build order is seat order, never the local client's seat", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "build.js"), "utf8");
  const body = src.slice(src.indexOf("function buildMatch"), src.indexOf("const PASSIVES"));
  assert.ok(/\[0,\s*1\]\.map/.test(body),
    "buildMatch must iterate [0,1] literally — a build order derived from who is hosting "
    + "produces two different games from one spec, visible only as a turn-one hash mismatch");
  assert.ok(!/\bhost\b|mySeat|isHost/.test(body),
    "buildMatch must not know which seat this client occupies");
});

/* Built by hand rather than through `spec()`, which would resolve the
   hero's slots and throw first — a drill that passes because the helper
   died proves nothing about the function under test. */
test("buildMatch names a missing hero rather than dealing an empty deck", {skip}, () => {
  const bad = {heroes: ["kayo", "nosuchhero"], first: 0, seed: "K7QM",
               boards: [{gearIdx: [], cuts: {}}, {gearIdx: [], cuts: {}}]};
  assert.throws(() => B.buildMatch(bad, mopts()), /nosuchhero/);
});

/* ============================================================
   THE PUNCHING BAG — a seat the dummy fills (v2.81)

   RULING (user, 2026-08-16): seat 1 is either a person, who picks their
   own hero, or the dummy — and a seat the dummy fills is ALWAYS the
   vanilla pile. There is no hero the dummy plays as. That choice existed
   and was never load-bearing; what it cost was a branch in the trainer,
   the loadout, the pregame and the table, each of which had to keep
   answering "which kind of opponent is this".

   The property that makes the pile honest is that NOTHING ABOUT IT NEEDS
   THE PARSER: it blocks with printed defence and swings with printed
   power. That is also exactly what `sparring.act` reads, so the policy
   piloting it is playing the deck at full strength rather than ignoring
   text it cannot see.
   ============================================================ */

const vanillaOpts = () => Object.assign(mopts(), {vanilla: {
  deck: W.DUMMY_DECK, gear: W.DUMMY_GEAR, hp: 42, int: W.DUMMY_INT, name: "The Dummy"}});
const vspec = (keys) => ({heroes: keys, first: 0, seed: "K7QM",
  boards: keys.map(k => k == null ? {}
    : {gearIdx: B.defaultPicks(slotsOf(mopts().heroes[k])), cuts: {}})});

test("a null hero key seats the vanilla pile, not an empty deck", {skip}, () => {
  const m = B.buildMatch(vspec(["kayo", null]), vanillaOpts());
  const d = m.builds[1];
  assert.equal(d.deck.length, 30, "the dummy's 30-card pile");
  assert.equal(d.gear.length, 4, "and its four pieces of iron");
  assert.equal(d.hp, 42);
  assert.equal(d.int, W.DUMMY_INT);
  assert.equal(d._dummy, true);
  assert.deepEqual(m.names, ["Kayo", "The Dummy"]);
  assert.deepEqual(m.heroKeys, ["kayo", null], "the key stays null — the seat has no hero");
});

/* THE WHOLE POINT OF THE PILE, and the one property worth a drill of its
   own: it is the one deck in the project where nothing can be faked. */
test("NOT ONE CARD IN THE PILE HAS RULES TEXT", {skip}, () => {
  const m = B.buildMatch(vspec(["kayo", null]), vanillaOpts());
  const carded = m.builds[1].deck.filter(c => (c.tx || "").trim());
  assert.deepEqual(carded.map(c => c.name), [],
    "a card with text in the punching bag is a card the trainer would have to READ, and " +
    "the pile exists precisely so that nothing about the opponent is faked or parsed");
  assert.ok(m.builds[1].deck.every(c => c.resolved),
    "and every one resolved from the database — never invented");
});

test("every passive is ANSWERED, not defaulted", {skip}, () => {
  const d = B.buildMatch(vspec(["kayo", null]), vanillaOpts()).builds[1];
  for(const p of B.PASSIVES){
    assert.notEqual(d[p], undefined,
      p + " reads undefined on the dummy — a passive added to buildSide and forgotten here " +
      "is a silent false at a rules site on a real hero's turn (the v2.41 shape)");
    assert.equal(typeof d[p], B.PASSIVE_TYPE[p],
      p + " must answer in its declared type");
  }
});

/* SYMMETRY IS THE CONTRACT, and a dummy seat must not quietly become an
   exception to it. `buildSide` has no seat argument; neither does this. */
test("the dummy can sit in EITHER chair", {skip}, () => {
  const m = B.buildMatch(vspec([null, "kayo"]), vanillaOpts());
  assert.equal(m.builds[0]._dummy, true, "seat 0 can be the dummy");
  assert.ok(!m.builds[1]._dummy, "and seat 1 the hero");
  assert.deepEqual(m.names, ["The Dummy", "Kayo"]);
});

test("no uid repeats across a hero seat and a dummy seat", {skip}, () => {
  const m = B.buildMatch(vspec(["kayo", null]), vanillaOpts());
  const all = m.builds.flatMap(b => [...b.deck, ...b.gear, ...(b.startItem ? [b.startItem] : [])]);
  const uids = all.map(c => c.uid);
  assert.equal(new Set(uids).size, uids.length,
    "one counter threaded through both seats — a repeat is CARD-IN-TWO-ZONES in disguise, " +
    "because the census works by uid");
});

test("two peers deal the same punching bag from one spec", {skip}, () => {
  const s = vspec(["kayo", null]);
  const a = B.buildMatch(s, vanillaOpts()), b = B.buildMatch(s, vanillaOpts());
  assert.equal(JSON.stringify(a.builds), JSON.stringify(b.builds));
  /* and a DIFFERENT seed deals a different order, or the shuffle is not
     consuming the stream at all and the drill above proves nothing */
  const other = B.buildMatch(Object.assign(vspec(["kayo", null]), {seed: "ZZZZ"}), vanillaOpts());
  assert.notEqual(a.builds[1].deck.map(c => c.uid).join("|"),
                  other.builds[1].deck.map(c => c.name).join("|"));
});

test("a dummy seat with no pile is NAMED, not dealt empty", {skip}, () => {
  assert.throws(() => B.buildMatch(vspec(["kayo", null]), mopts()),
    /seat 1 is the dummy and no vanilla pile was given/,
    "the same discipline as a missing hero — refuse loudly rather than seat an empty deck");
});
