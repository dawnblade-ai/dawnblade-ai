/* ============================================================
   A TIE THAT COUNTS AS A LEAD, ONE WAY ONLY (v4.51)

   > "If you have the same {h} as a hero, it also counts as YOU HAVING
   >  MORE {h} than them, and THEM HAVING LESS {h} than you."
   >                                — LINE CROSSERS, Lyath's Arms piece

   The clause read NOTHING since the card was dealt, and it is wrong in
   BOTH directions at once — which is why neither the coverage audit nor
   the one-sided fairness sweep could see it. Lyath lost Mocking Blow's
   boo on a tie (and with it the Might token his own hero passive makes of
   one); the opponent lost every "if you have less {h}" clause they hold.

   THE ASYMMETRY IS THE CARD. Its controller counts as AHEAD and their
   OPPONENT counts as BEHIND — nothing makes the controller count as
   behind and nothing makes the opponent count as ahead, so the reader
   takes its two sides in opposite orders and all four combinations are
   driven here. "A tie counts as both" is the collapse the deleted
   `lifeTie` CONDITION asserted in its own comment, and it is wrong.

   MEASURED over the pinned pool: five conditions across five cards read a
   life comparison, plus Reaping Blade's `lifeLock`, and `effects.js` holds
   all three sites that compare the two heroes' life. Lyath decks Line
   Crossers, Mocking Blow AND Oasis Respite, so it is reachable in one
   list; Wounded Bull, Scar for a Scar and Fyendal's Fighting Spirit are
   the opponent's half, across five other decks.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");

const ROOT = path.join(__dirname, "..");
const skip = !fs.existsSync(require("./helpers/extract").cardDbPath())
  && "needs the pinned pool";

const piece = () => {
  for(const p of [null, 0, 1, 2, 3]){ const c = H.card("Line Crossers", p); if(c) return c; }
  return null;
};

/* ---- the parse ------------------------------------------------------- */

test("Line Crossers' static is read off its printed line", {skip}, () => {
  const lc = piece();
  assert.ok(lc, "Line Crossers left the pool");
  const fx = P.fxParse(lc);
  assert.deepEqual(fx.lifeTie, {ahead: true, behind: true});
  assert.equal(fx.clauses[0].st, "run", "the static clause still reads nothing");
  assert.equal(fx.tier, "full");
});

test("the two halves are READ, not assumed as a pair", {skip}, () => {
  /* THE ONE REAL RECORD PRINTS BOTH, so no pool fixture can tell a read
     pair from a hardcoded one — the near-miss is synthetic (v3.73). */
  const half = {name: "v4.51 half crossers", pitch: 0, tt: "Generic Equipment - Arms",
    power: null, def: 1, kw: [],
    tx: "If you have the same {h} as a hero, it also counts as you having more {h} than them."};
  assert.deepEqual(P.fxParse(half).lifeTie, {ahead: true, behind: false},
    "only the printed half is granted");
  const other = {name: "v4.51 other half crossers", pitch: 0, tt: "Generic Equipment - Arms",
    power: null, def: 1, kw: [],
    tx: "If you have the same {h} as a hero, it also counts as them having less {h} than you."};
  assert.deepEqual(P.fxParse(other).lifeTie, {ahead: false, behind: true});
});

test("an unreadable tail refuses the whole clause", {skip}, () => {
  /* v2.29 — claiming the head and guessing the tail would file a `full`
     whose grant nobody read. */
  const bad = {name: "v4.51 unreadable crossers", pitch: 0, tt: "Generic Equipment - Arms",
    power: null, def: 1, kw: [],
    tx: "If you have the same {h} as a hero, it also counts as the moon being blue."};
  const fx = P.fxParse(bad);
  assert.equal("lifeTie" in fx, false, "a tail it cannot read must grant nothing");
  assert.equal(fx.clauses[0].st, "skip");
  assert.equal(fx.tier, "none");
});

/* ---- the asymmetry, all four combinations --------------------------- */

const bare   = () => ({hp: 20, board: [], gear: []});
const holder = () => ({hp: 20, board: [], gear: [Object.assign({uid: 5}, piece())]});

test("a tie counts as a lead for the HOLDER and a deficit for their OPPONENT", {skip}, () => {
  const C = holder(), O = bare();
  assert.equal(E.lifeAhead(C, O),  true,  "'you having more {h} than them'");
  assert.equal(E.lifeBehind(O, C), true,  "'them having less {h} than you'");
  /* AND THE TWO THE CARD NEVER SAYS. Read the other way round, the holder
     turns on their own Fyendal's Fighting Spirit and the opponent gets
     Mocking Blow's boo — both grants the printed line withholds. */
  assert.equal(E.lifeBehind(C, O), false, "the holder is never BEHIND on a tie");
  assert.equal(E.lifeAhead(O, C),  false, "the opponent is never AHEAD on a tie");
});

test("an untied comparison is unchanged in both directions", {skip}, () => {
  /* THE CONTROL. A reader that always answered TRUE passes the tie half
     perfectly, so the real numbers have to be asked too. */
  const hi = Object.assign(holder(), {hp: 21}), lo = bare();
  assert.equal(E.lifeAhead(hi, lo),  true);
  assert.equal(E.lifeBehind(hi, lo), false);
  assert.equal(E.lifeAhead(lo, hi),  false);
  assert.equal(E.lifeBehind(lo, hi), true);
  /* and with NO piece anywhere, a tie is a tie */
  const a = bare(), b = bare();
  assert.equal(E.lifeAhead(a, b),  false);
  assert.equal(E.lifeBehind(a, b), false);
});

test("a HALF piece grants only its printed half, at the SIDE level too", {skip}, () => {
  /* THE PARSE HALF IS NOT ENOUGH. `tieGrantOf` merges every bearer's grant,
     so a merge that simply sets both flags is silent against the one real
     record — which prints both — and silent against a parse assertion.
     Driving the synthetic THROUGH the side reader is what sees it, and the
     sabotage that forces both came back silent until this existed (v3.62). */
  const half = {name: "v4.51 side-level half", pitch: 0, tt: "Generic Equipment - Arms",
    power: null, def: 1, kw: [],
    tx: "If you have the same {h} as a hero, it also counts as you having more {h} than them."};
  const C = {hp: 20, board: [], gear: [{uid: 4, ...half}]}, O = {hp: 20, board: [], gear: []};
  assert.deepEqual(E.tieGrantOf(C), {ahead: true, behind: false});
  assert.equal(E.lifeAhead(C, O),  true,  "its printed half applies");
  assert.equal(E.lifeBehind(O, C), false, "the half it does NOT print does not");
});

test("a destroyed piece grants nothing", {skip}, () => {
  /* v3.54 files a destroyed piece at the end phase, so it sits in the gear
     zone marked for the rest of the turn — `gearDef` answers 0 for one and
     so must this (v4.34's ward bearers, same rule). */
  const dead = {hp: 20, board: [], gear: [Object.assign({uid: 5, destroyed: true}, piece())]};
  assert.deepEqual(E.tieGrantOf(dead), {ahead: false, behind: false});
});

test("the scan covers the BOARD as well as the gear", {skip}, () => {
  /* LATENT AND MEASURED: the pool's one record is Equipment, so a
     board-borne grant needs a synthetic — a gear-only scan is a guess
     about the next card (v3.33, v3.55, v4.34). */
  const item = {name: "v4.51 tie totem", pitch: 0, tt: "Generic Item", power: null, def: null, kw: [],
    tx: "If you have the same {h} as a hero, it also counts as you having more {h} than them, "
      + "and them having less {h} than you."};
  assert.deepEqual(E.tieGrantOf({hp: 20, board: [{uid: 9, card: item}], gear: []}),
    {ahead: true, behind: true});
});

/* ---- the three sites, DRIVEN ---------------------------------------- */

test("MOCKING BLOW boos on a tie — Lyath's own card (`lifeGt`)", {skip}, () => {
  const mb = H.card("Mocking Blow", 1);
  assert.ok(mb, "Mocking Blow left the pool");
  const run = withPiece => {
    const g = H.state({hp: 20, hand: [Object.assign({uid: 11}, mb)],
                       gear: withPiece ? [Object.assign({uid: 5}, piece())] : []},
                      {hp: 20}, {actor: 0, turnPlayer: 0});
    /* ASSERT ON `hist.booed`, NEVER ON THE FEED (v2.45). */
    return H.execute(g, Object.assign({uid: 11}, mb), "hand", 0, {target: "hero"})
             .sides[0].hist.booed || 0;
  };
  assert.equal(run(false), 0, "at a tie with no piece the crowd says nothing");
  assert.equal(run(true),  1, "the piece makes the tie a lead, so the crowd boos");
});

test("WOUNDED BULL grows for the OPPONENT on a tie (`lifeLt`)", {skip}, () => {
  /* THE PRINTED DRAWBACK. "Them having less {h} than you" is not Lyath's
     upside — it turns on five other decks' life-behind clauses, and
     reading only the first half would be the direction that steals games. */
  const wb = H.card("Wounded Bull", 1);
  assert.ok(wb, "Wounded Bull left the pool");
  assert.equal(wb.power, 7, "its printed power moved — re-read the numbers below");
  const run = foeHolds => {
    const g = H.state({hp: 20, hand: [Object.assign({uid: 12}, wb)], gear: []},
                      {hp: 20, gear: foeHolds ? [Object.assign({uid: 6}, piece())] : []},
                      {actor: 0, turnPlayer: 0});
    return H.execute(g, Object.assign({uid: 12}, wb), "hand", 0, {target: "hero"}).pend.total;
  };
  assert.equal(run(false), 7, "at a tie with no piece it is its printed power");
  assert.equal(run(true),  8, "the defender's piece makes the attacker count as behind");
});

test("`lifeLock` fizzles a gain on a tie under the piece (Reaping Blade)", {skip}, () => {
  const run = withPiece => {
    const g = H.state({hp: 20, lifeLock: true,
                       gear: withPiece ? [Object.assign({uid: 7}, piece())] : []},
                      {hp: 20}, {actor: 0});
    return H.runOps(g, [["life", 1]], "Fyendal's Fighting Spirit").sides[0].hp;
  };
  assert.equal(run(false), 21, "a tie is not ahead, so the gain lands");
  assert.equal(run(true),  20, "the piece makes it a lead, so the lock fizzles the gain");
});

/* ---- one body, and the census --------------------------------------- */

test("every cross-seat life comparison goes through the one pair", () => {
  /* THREE SITES, and a fourth written inline would silently ignore Line
     Crossers. COMMENTS ARE STRIPPED FIRST: this file's own prose names the
     shape it forbids (`act(n).hp > foe(n).hp`), and a raw scan reports that
     sentence as the defect — v4.27's `failstates.js` counting a keyword
     inside a comment, and `sync.test.js`'s prose false positives. Rewording
     the documentation to appease a scan is the wrong trade when the
     documentation is what says WHY the rule exists. */
  const raw = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "")
                  .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  /* THE STRIPPER'S CONTROL GOES THROUGH THE CENSUS (v4.32) — a stripper
     that removed everything would satisfy the assertion below perfectly. */
  const inComment = "Never `act(n).hp > foe(n).hp` inline";
  assert.ok(raw.includes(inComment), "the control phrase left effects.js — pick another");
  assert.equal(code.includes(inComment), false, "the comment stripper is not stripping");
  assert.ok(/mine\.hp\s*>\s*theirs\.hp/.test(code), "the stripper ate the pair itself");

  /* The life thresholds a side asks about ITSELF (`hp <= 0`, the advisor's
     bands) are not comparisons between seats, and the pair's own two lines
     are the answer rather than an offender. */
  const inline = [...code.matchAll(/\.hp\s*[<>]=?\s*(?!=)[^\n;{]*/g)]
    .map(m => m[0].trim())
    .filter(l => !/\.hp\s*[<>]=?\s*-?\d/.test(l))
    .filter(l => !/mine\.hp|theirs\.hp/.test(l));
  assert.deepEqual(inline, [],
    "a cross-seat life comparison outside the pair: " + inline.join(" | "));
});

test("exactly one pool record carries the static, and the condition is gone", {skip}, () => {
  const DB = H.db();
  const carry = [];
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    let fx; try { fx = P.fxParse(rc); } catch(e){ continue; }
    if(fx.lifeTie) carry.push(rc.name);
  }
  assert.deepEqual([...new Set(carry)], ["Line Crossers"]);
  /* THE DELETED CONDITION. It had zero emitters for as long as it existed —
     the clause's payload has no reader, so `classifyClause` refuses the
     whole line — and its comment asserted the WRONG semantics ("both
     ways"). A condition is the wrong shape besides: it gates a payload,
     and this card has none. */
  for(const f of ["engine/parser.js", "engine/effects.js"]){
    const src = fs.readFileSync(path.join(ROOT, f), "utf8")
      .split("\n").filter(l => !/^\s*(\/\*|\*|\/\/|>)/.test(l)).join("\n");
    assert.equal(/cond:\s*"lifeTie"|cond\s*===\s*"lifeTie"/.test(src), false,
      "the dead `lifeTie` condition is back in " + f);
  }
});
