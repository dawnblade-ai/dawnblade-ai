/* ============================================================
   A TAPPED HERO, AND THE ONE THING IT MEANS (v3.48)

   RULING (user, 2026-08-25), verbatim:

     "Tapping a hero doesn't mean much on its own — when tapped it mainly
      means it cannot be tapped again to pay a cost. The tapping mechanism
      was added in later sets and older heroes are often unaffected by
      being tapped."

   The NARROWNESS is the ruling, not a shortcut. A tapped hero keeps its
   life, its intellect, its defence and its windows; inventing a penalty
   here would be the golden rule broken at the keyword level, and the
   ruling says in as many words that most heroes are unaffected. Exactly
   three of the pool's fifteen print a `{t}` cost on themselves — Bravo,
   Gravy Bones and Lyath — so for the other twelve the tap is a correctly
   read no-op, and the feed says which.

   What it unblocked, and none of it was new machinery:

     Entangling Shot   "you may {t} target hero" on its arsenal-up
                       trigger — `tier: none` -> `full`, because
                       `parseHeroPower` refuses a line whose payload has
                       no reader (v3.04) and now it has one
     Drop the Anchor   the rider `"When this hits a hero, {t} them and
                       all allies they control"` — left `quotedUnread`
     tapsToActivate    a LIVE BUG: it split `clean(tx)`, and `clean`
                       collapses the newlines the split depends on
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");
const J = H.J;
const G = require("../engine/game.js");
const B = require("../engine/build.js");
const RNG = require("../engine/rng.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const W = loadData();
const POOL = require("../data/pool.json");
const rec = nm => POOL.find(r => r.name === nm) || {};

/* ---- 1. tapsToActivate — THE LIVE BUG THIS FOUND --------------------- */

test("the activation line is found wherever it sits on the card", () => {
  /* `clean` COLLAPSES newlines, so `clean(tx).split(/\n+/)` yields ONE
     element containing the whole card — and the `.find` then only ever
     matched a card whose activated ability is its FIRST printed line.
     Split the RAW text, clean each line. Same trap `printedKw` and
     `kwGated` each carry a comment about. */
  const first = "**Instant** - {r}{r}, {t}: Do a thing.\n\n**Go again**";
  const under = "The base {p} of cards you control are halved.\n\n**Instant** - {r}{r}, {t}: Do a thing.";
  assert.equal(P.tapsToActivate(first), true, "the easy case, which always worked");
  assert.equal(P.tapsToActivate(under), true,
    "an ability on the SECOND line taps just as much as one on the first");
});

test("the two live casualties answer correctly now", {skip}, () => {
  /* Lyath's "Instant - {r}{r}, {t}:" sits under his halving static;
     Concealed Object's tap sits under its own destroy clock. For both the
     flag was filed as a per-turn ALLOWANCE instead of a TAP, so
     `perTurnCleared` lifted it at the turn boundary rather than at the
     controller's untap step (CR 4.4.3d). */
  assert.equal(P.tapsToActivate(rec("Lyath Goldmane").functional_text || ""), true);
  assert.equal(P.tapsToActivate(rec("Concealed Object").functional_text || ""), true);
});

test("exactly three pool heroes pay {t}, and it is PINNED", {skip}, () => {
  /* The ruling turns on how rare this is. A fourth means upstream changed
     a hero; a second means the reader regressed. Either way, deliberate. */
  const taps = POOL.filter(r => /Hero/.test(r.type_text || ""))
    .filter(r => P.tapsToActivate(r.functional_text || ""))
    .map(r => r.name).sort();
  assert.deepEqual(taps, ["Bravo, Flattering Showman", "Gravy Bones", "Lyath Goldmane"]);
});

test("a {t} that is not an activation cost is NOT an activation tap", {skip}, () => {
  /* THE PAYLOAD IS NOT THE COST. Drop the Anchor and Entangling Shot both
     print `{t}` as something they DO to a hero, and Turn to Mindfire as an
     optional rider. Reading any of them as a cost would tap the wrong
     permanent — and Magmatic Carapace's "you may {t} this and pay {r}"
     really is a cost, but a TRIGGERED one, which v3.33 already routes
     through the optional-cost prompt's own `taps` field. */
  for(const nm of ["Drop the Anchor", "Entangling Shot", "Turn to Mindfire", "Magmatic Carapace"])
    assert.equal(P.tapsToActivate(rec(nm).functional_text || ""), false, nm);
});

/* ---- 2. THE READER --------------------------------------------------- */

test("the three printed tap clauses read, and nothing else does", () => {
  assert.deepEqual(P.classifyClause("you may {t} target hero").ops, [["tapFoeHero", 1]]);
  assert.deepEqual(P.classifyClause("{t} them").ops, [["tapFoeHero", 1]]);
  assert.deepEqual(P.classifyClause("you may {t} your hero").ops, [["tapSelfHero", 1]]);
  /* ONE PRINTED SENTENCE NAMING TWO TARGETS IS ONE OP WITH A FLAG, not
     two clauses — the ally half is what the card is FOR now that allies
     tap to attack (v3.44). */
  assert.deepEqual(P.classifyClause("{t} them and all allies they control").ops,
    [["tapFoeHero", 1, {allies: true}]]);
});

test("self and foe are two ops, never one with a guessed subject", () => {
  const self = P.classifyClause("you may {t} your hero").ops[0][0];
  const foe  = P.classifyClause("you may {t} target hero").ops[0][0];
  assert.notEqual(self, foe,
    "\"your hero\" and \"target hero\" bill different seats — the same "
    + "self/foe pairing `selfDiscard`/`foeDiscard` keep");
});

test("Entangling Shot's arsenal trigger now has a payload, so it has a route", {skip}, () => {
  /* `parseHeroPower` and the arsenal-up reader both REFUSE a line whose
     payload nothing reads ("never parse ahead of wiring", v3.04). The
     route opens by itself the moment the payload does. */
  P.fxReset();
  const f = P.fxParse(H.card("Entangling Shot", 1));
  assert.deepEqual(f.arsenalUp, [["tapFoeHero", 1]]);
});

test("Drop the Anchor's rider is read, and it is HERO-gated", {skip}, () => {
  /* The rider prints "When this hits A HERO", so it must not fire off a
     hit on an ally (v3.45). A rider that landed in `onHit` would. */
  P.fxReset();
  const f = P.fxParse(H.card("Drop the Anchor", 1));
  /* `buffNext`'s rider rides at op[3] — op[1] is the amount and op[2] the
     qualifier. `gaNextQ`'s rides at op[2], because there is no amount.
     Two positions, one family (CLAUDE.md, "FOUR QUALIFIED SINGLE-SHOT
     GRANTS"), and reaching for the wrong one finds `undefined` on a card
     that works perfectly. */
  const bn = (f.ops || []).find(o => o[0] === "buffNext");
  assert.ok(bn, "the head is a qualified +3{p} for the next ARROW attack");
  assert.deepEqual(bn[2], {g: [["arrow"]]}, "and the qualifier survives (v3.31)");
  assert.ok(bn[3], "the grant must carry a rider (v3.42's field)");
  assert.deepEqual(bn[3].onHitHero, [["tapFoeHero", 1, {allies: true}]]);
  assert.equal(bn[3].onHit, undefined, "not the any-hit list");
  assert.deepEqual(f.quotedUnread || [], [], "and it is no longer a recorded refusal");
});

/* ---- 3. THE STATE IS A REAL SIDE FIELD ------------------------------- */

test("heroTapped is carried in all three places a side field must be", () => {
  /* v3.29's rule: SIDE_FIELDS (or invariants reports SIDES-ASYMMETRIC),
     wire.js (a dropped field is a desync) and report.js's seat(). */
  assert.ok(S.SIDE_FIELDS.includes("heroTapped"), "sides.js");
  assert.equal(S.makeSide().heroTapped, false, "and it defaults to UNtapped");
  const wire = fs.readFileSync(path.join(__dirname, "..", "engine", "wire.js"), "utf8");
  assert.match(wire, /heroTapped/, "wire.js — a dropped field is a desync");
  const rep = fs.readFileSync(path.join(__dirname, "..", "engine", "report.js"), "utf8");
  assert.match(rep, /heroTapped/, "report.js — a report that omits state is worse than none");
});

/* ---- 4. DRIVEN — the ruling's single consequence ---------------------- */

/* Two real precons, seated — the same shape `judge.test.js` uses, kept
   local so this file drives a whole game rather than a fabricated state. */
function match(o){
  o = o || {};
  const db = H.db();
  const h0 = o.h0 || W.HEROES.find(h => h.k === "lyath");
  const h1 = o.h1 || W.HEROES.find(h => h.k === "gravy");
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "tapped");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), db, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), db, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}

/* ENDING A TURN TAKES TWO ACTIONS (v2.46) — `endTurn` is a PASS carrying
   intent, so the opponent still gets their last instant window. */
function passTurn(g){
  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  return n;
}

const tapBoth = g => ({...g, sides: g.sides.map(s => ({...s, heroTapped: true}))});

function heroBuild(key){
  const db = H.db();
  const hero = W.HEROES.find(h => h.k === key);
  assert.ok(hero, "no such hero: " + key);
  return B.buildSide(hero, G.parseDeck(W.DECKS[key]), db, {}, RNG.make("tap"), {n: 0}).b;
}

test("driven: a tapped hero cannot pay {t} again — and that is ALL", {skip}, () => {
  const b = heroBuild("lyath");
  assert.ok(b.HPOW, "Lyath prints an activated ability");
  let g = H.state({res: 9, ap: 1, name: "Lyath"}, {}, {turn: 3, actor: 0});
  g.builds = [b, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;

  assert.equal(J.legal(g, {t: "activate", from: "hero", uid: "hpow"}, 0), null,
    "untapped, the ability is legal");

  const tapped = {...g, sides: g.sides.map((s, i) => i ? s : {...s, heroTapped: true})};
  const why = J.legal(tapped, {t: "activate", from: "hero", uid: "hpow"}, 0);
  assert.match(String(why), /tapped/, "tapped, it is refused — and the refusal says why");

  /* AND NOTHING ELSE MOVES. The ruling is explicit that a tapped hero is
     otherwise unaffected, so anything that changed here would be a rule
     this project invented. */
  assert.equal(tapped.sides[0].hp, g.sides[0].hp);
  assert.equal(tapped.sides[0].int, g.sides[0].int);
  assert.equal(J.legal(tapped, {t: "pass"}, 0), null, "they still hold priority");
});

test("driven: a hero with no {t} cost is untouched by being tapped", {skip}, () => {
  /* Blaze pays ENERGY COUNTERS, not a tap, so the ruling's one consequence
     does not reach him. A gate that asked `heroTapped` alone would lock an
     ability the card never taps for — twelve of fifteen heroes. */
  const b = heroBuild("blaze");
  assert.ok(b.HPOW, "Blaze prints an activated ability");
  assert.equal(P.tapsToActivate((b.heroRec || {}).tx || ""), false);
  let g = H.state({res: 9, ap: 1, name: "Blaze", heroTapped: true,
                   board: [{card: H.tok("Energy"), kind: "token", uid: "e1"}]},
                  {}, {turn: 3, actor: 0});
  g.builds = [b, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  const why = J.legal(g, {t: "activate", from: "hero", uid: "hpow"}, 0);
  assert.ok(!/tapped/.test(String(why || "")),
    "whatever else refuses Blaze, it must never be the tap: " + why);
});

test("driven: the hero's OWN {t} payment taps it — one record, not two", {skip}, () => {
  /* v2.46's lesson one zone further in. `weaponUsed["hpow"]` is the
     per-turn ALLOWANCE, cleared at the turn boundary for both seats;
     `heroTapped` is the STATE, lifted only by the controller's untap step.
     They coincide for a hero using its own ability and come apart the
     moment an opponent taps you. */
  const b = heroBuild("lyath");
  P.fxReset();
  let g = H.state({res: 9, ap: 1, name: "Lyath"}, {}, {turn: 3, actor: 0});
  g.builds = [b, {}];
  assert.equal(g.sides[0].heroTapped, false);
  g = H.execute(g, b.HPOW, "hero", 0, {});
  assert.equal(g.sides[0].heroTapped, true, "paying {t} taps the hero");
  assert.ok((g.sides[0].weaponUsed || {})["hpow"], "and spends the allowance");
});

test("driven: a hero whose ability costs no {t} is NOT tapped by using it", {skip}, () => {
  const b = heroBuild("blaze");
  P.fxReset();
  let g = H.state({res: 9, ap: 1, name: "Blaze",
                   board: [{card: H.tok("Energy"), kind: "token", uid: "e1"}]},
                  {}, {turn: 3, actor: 0});
  g.builds = [b, {}];
  g = H.execute(g, b.HPOW, "hero", 0, {});
  assert.equal(g.sides[0].heroTapped, false,
    "the tap follows the printed COST, never the fact that an ability was used");
});

test("driven: tapFoeHero taps THEM, and reads THEIR build for the message", {skip}, () => {
  H.db();
  const bl = heroBuild("blaze"), ly = heroBuild("lyath");
  /* THE BUILD OF THE TAPPED SIDE, not the actor's. Blaze taps Lyath: the
     message is about Lyath's {t} ability, and `bAct` here would ask about
     Blaze's — the wrong hero, and right by accident only in the self
     branch. */
  let g = H.state({name: "Blaze"}, {name: "Lyath"}, {turn: 3, actor: 0});
  g.builds = [bl, ly];
  const out = H.runOps(g, [["tapFoeHero", 1]], "Entangling Shot");
  assert.equal(out.sides[1].heroTapped, true, "they tap");
  assert.equal(out.sides[0].heroTapped, false, "and the tapper does not");
  assert.ok((out.feed || []).some(m => /Lyath/.test(m) && /\{t\} ability is locked/.test(m)),
    "the feed must name the TAPPED hero's ability: " + JSON.stringify(out.feed));

  /* And the other way round: Lyath taps Blaze, whose ability costs
     counters, so the honest line is that the tap cost them nothing. */
  let g2 = H.state({name: "Lyath"}, {name: "Blaze"}, {turn: 3, actor: 0});
  g2.builds = [ly, bl];
  const o2 = H.runOps(g2, [["tapFoeHero", 1]], "Entangling Shot");
  assert.ok((o2.feed || []).some(m => /Blaze/.test(m) && /nothing they were using/.test(m)),
    "twelve of fifteen heroes are unaffected, and the feed says so: " + JSON.stringify(o2.feed));
});

test("driven: the ally half is what the card is FOR", {skip}, () => {
  H.db();
  /* Allies tap to attack (v3.44), so tapping theirs stops a swing — where
     tapping the hero mostly does not. */
  const swab = H.card("Swabbie", 2);
  let g = H.state({}, {board: [{card: swab, kind: "ally", uid: swab.uid, spent: false, life: 3}]},
                  {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = H.runOps(g, [["tapFoeHero", 1, {allies: true}]], "Drop the Anchor");
  assert.equal(out.sides[1].heroTapped, true);
  assert.equal(out.sides[1].board[0].spent, true, "the ally is tapped and cannot attack");
  /* COUNTING THE BOARD CANNOT SEE THIS — the ally stays on it either way,
     so ask for the thing by name (v3.45). */
  assert.equal(out.sides[1].board.length, 1);
});

test("driven: the plain tap leaves allies alone", {skip}, () => {
  H.db();
  const swab = H.card("Swabbie", 2);
  let g = H.state({}, {board: [{card: swab, kind: "ally", uid: swab.uid, spent: false, life: 3}]},
                  {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = H.runOps(g, [["tapFoeHero", 1]], "Entangling Shot");
  assert.equal(out.sides[1].board[0].spent, false,
    "Entangling Shot prints no ally half — reading one in would be inventing card text");
});

test("driven: an already-tapped hero is not re-tapped, and the feed says so", {skip}, () => {
  H.db();
  let g = H.state({}, {name: "Them", heroTapped: true}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = H.runOps(g, [["tapFoeHero", 1]], "Entangling Shot");
  assert.ok((out.feed || []).some(m => /already tapped/i.test(m)), JSON.stringify(out.feed));
});

/* ---- 5. THE UNTAP STEP LIFTS IT, ON BOTH BOARDS ---------------------- */

test("judge: CR 4.4.3d lifts the tap, for the turn-player only", {skip}, () => {
  /* DRIVEN, not grepped. A source scan for the assignment stays green when
     the step around it stops running, and this project has shipped exactly
     that kind of green drill more than once. */
  let g = match();
  g = tapBoth(g);
  const before = g.turnPlayer;
  const after = passTurn(g);
  assert.equal(after.sides[before].heroTapped, false, "the turn-player untaps");
  assert.equal(after.sides[1 - before].heroTapped, true,
    "CR 4.4.3d untaps the TURN-PLAYER's permanents only — the other seat keeps its tap");
});

test("the trainer lifts it in the same step", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(src, /CR 4\.4\.3d[\s\S]{0,1200}?actMut\(n\)\.heroTapped = false/,
    "a rule that exists on one board only is v3.17's shape — both boards untap");
  /* AND ONE RECORD ON SCREEN. The hero portrait used to hand-roll its own
     test (`weaponUsed["hpow"] && /\{t\}/.test(heroRec.tx)`), which is a
     second description of the same fact — and one that answers TRUE for a
     hero merely MENTIONING {t}. */
  assert.match(src, /"tapwrap"\+\(you\(g\)\.heroTapped\?" tapped":""\)/,
    "the portrait reads the state, not a regex over the hero's whole text");
});

test("driven: a tap outlives the allowance, which is why they are two records", {skip}, () => {
  /* This is the half `weaponUsed` cannot express. `perTurnCleared` gives
     an allowance back at EVERY turn boundary for BOTH seats; a TAP waits
     for the controller's own untap step. Tap the non-turn-player and pass
     a whole turn: the allowance would have come back and the tap does
     not. */
  let g = match();
  const other = 1 - g.turnPlayer;
  g = {...g, sides: g.sides.map((s, i) => i === other
        ? {...s, heroTapped: true, weaponUsed: {...(s.weaponUsed || {}), hpow: true}} : s)};
  const after = passTurn(g);
  assert.equal(after.sides[other].weaponUsed.hpow, undefined,
    "the ALLOWANCE comes back at the turn boundary for both seats");
  assert.equal(after.sides[other].heroTapped, true,
    "the TAP does not — only their own untap step lifts it");
  /* And their own turn does lift it. */
  const back = passTurn(after);
  assert.equal(back.sides[other].heroTapped, false);
});

/* ---- 6. THE FLAG MUST STOP LYING ABOUT A BUILT CARD ------------------ */

test("the audit's {t} flag is asked of the CLAUSE, not of the symbol", {skip}, () => {
  /* v3.41's lesson with the sign flipped. There, a refusal nobody was told
     about was a lie; here, a blanket flag kept SAYING "not enforced" about
     fourteen cards that are. A doc claim is a test with no assertion, and
     an audit flag is a doc claim the tool regenerates every run.

     `noop` is the right state for an activation LINE — the tap is charged
     by the ROUTE, not by an op (v3.44) — so only a `skip` means nothing
     enforces it. */
  const gen = fs.readFileSync(path.join(__dirname, "..", "tools", "audit.js"), "utf8");
  assert.match(gen, /includes\("\{t\}"\)\s*\n?\s*&& \(fx\.clauses\|\|\[\]\)\.some\(cl => cl\.st === "skip"/,
    "the flag must test the clause carrying {t}, the way the {u} flag beside it does");

  const C = require("../engine/cards.js");
  const flagged = [];
  for(const r of POOL){
    const m = C.mapDbCard(r); if(!m || !m.tx || !m.tx.includes("{t}")) continue;
    const c = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
               tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    P.fxReset();
    if((P.fxParse(c).clauses || []).some(cl => cl.st === "skip" && String(cl.t).includes("{t}")))
      flagged.push(m.n);
  }
  /* ONE, and it is the same shape the two before it were: the ability's
     PAYLOAD has no reader, so there is no ability for a tap to be charged
     against. A SECOND means a reader regressed; ZERO means the last one
     was built.

     BRAVO LEFT THIS LIST AT v3.72 and TURN TO MINDFIRE AT v3.91, which is
     what a shrinking pin is for. His "turn a face-down card in your
     arsenal face-up" now reads; its "you may {t} your hero" is now a real
     optional cost charged against `heroTapped` (v3.48's state, not
     `weaponUsed`'s per-turn allowance). */
  assert.deepEqual(flagged.sort(),
    ["Goldkiss Rum"],
    "seventeen pool cards print {t} and sixteen of them enforce it");
});
