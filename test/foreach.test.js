/* ============================================================
   "FOR EACH" IS THE WORDING THE DATABASE PRINTS (v4.48)

   Four pool cards print a value MULTIPLIED by something countable:

     Fender Bender  ×3   "+1{p} for each equipment defending it"
     Overblast      ×3   "+1{p} for each time you've boosted this combat chain"
     Salt the Wound ×1   "+1{p} for each attack that has hit this combat chain"
     Big Blue Sky   ×1   "+1{d} for each blue card you've pitched this turn"

   Every one of them was read as a FLAT +1. The three `{p}` cards fell to
   the loose `this gets +N{p}` matcher and the `{d}` card to the loose
   `defBuff` one, and both drop everything after the pip.

   WRONG IN BOTH DIRECTIONS AT ONCE, which is why no tool here could see
   any of it: at a count of 0 the engine grants a point the card does not
   (STRONGER), at 2 or more it grants less than printed (WEAKER, the
   direction the one-sided fairness sweep is built not to look in), and all
   eight records read `tier: full` throughout, so coverage is blind too.
   The two readings AGREE at a count of exactly 1 — so a drill that tests
   one count cannot see this at all, and the pair either side is what bites
   (v3.92, v3.99).

   AND THE TWO OPS THIS PROJECT HAD ALREADY BUILT FOR IT HAD **ZERO** POOL
   EMITTERS. `perEquipDef` and `perBoost` were anchored on "this gains
   +X{p}, WHERE X IS THE NUMBER OF …" — measured over 797 records, not one
   prints that. So both fire sites in `effects.js` had never once run in a
   real game, and v4.20's own reasoning about `piercing` ("Fender Bender's
   is +N for EACH equipment, this is +N if there is at least one") was a
   comparison drawn against a reader with no card.

   THE DRILL THAT PINNED `perBoost` WROTE THE STALE WORDING OUT BY HAND.
   That is v3.00's editorial-drift defect in its sharpest form yet: the
   fixture was the old text, so the drill stayed green while the card it
   names was broken in production. Both readers are driven off the REAL
   pool record here, and the synthetic fixtures are reserved for the near
   misses no printed card can express.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const ROOT = path.join(__dirname, "..");

/* THE POOL IS THE FIXTURE — 797 records, no network (v3.00). */
const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  const recs = j.cards || j;
  return recs.map(r => {
    const m = C.mapDbCard(r);
    return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, life: m.hp,
            tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
  });
})();

/* ---- 1. THE READER ---------------------------------------------------- */

test("the three printed {p} countables each read as a MULTIPLIER", {skip}, () => {
  const want = {
    "Fender Bender":  "perEquipDef",
    "Overblast":      "perBoost",
    "Salt the Wound": "perChainHit"
  };
  for(const [nm, op] of Object.entries(want)){
    for(const c of pool.filter(x => x.name === nm)){
      P.fxReset();
      const fx = P.fxParse(c);
      assert.ok((fx.ops || []).some(o => o[0] === op && o[1] === 1),
        `${nm} p${c.pitch}: the printed "for each" must read as ${op}, got ${JSON.stringify(fx.ops)}`);
      /* THE FLAT PUMP MUST BE GONE. Reading BOTH is v2.30's VALUE-DOUBLED,
         and asserting only that the multiplier arrived cannot see it. */
      assert.ok(!fx.self,
        `${nm} p${c.pitch}: the flat self-pump must NOT also be read (fx.self = ${fx.self})`);
    }
  }
});

test("the {d} countable reads as a defSelf MULTIPLIER, not an op", {skip}, () => {
  const bbs = pool.find(c => c.name === "Big Blue Sky");
  assert.ok(bbs, "Big Blue Sky is in the pool");
  P.fxReset();
  const fx = P.fxParse(bbs);
  assert.deepEqual(fx.defSelf, {amt: 1, per: "bluePitched"},
    "it carries a COUNT where its siblings carry a gate");
  /* AND NOT AS A `defBuff` OP. That is where it used to land, and
     `runOps`' `defBuff` case only LOGS — so the feed said "+1 defense to
     the wall" and no number moved anywhere. */
  assert.ok(!(fx.ops || []).some(o => o[0] === "defBuff"),
    "the loose defBuff matcher must no longer claim it");
  assert.equal(fx.tier, "full", "and the clause is accounted for");
});

test("the AMOUNT is read off the printed line, not hardcoded", {skip}, () => {
  /* ALL FOUR POOL RECORDS PRINT 1, so a hardcoded 1 is SILENT against
     every real fixture (v3.32, twelfth outing). Synthetic. */
  P.fxReset();
  const two = P.fxParse({name: "SYN-FOREACH-2", pitch: 1, cost: 1, power: 4,
    tt: "Mechanologist Action - Attack", ty: ["Mechanologist", "Action", "Attack"],
    tx: "This gets +2{p} for each time you've boosted this combat chain.",
    kw: [], gkw: []});
  assert.deepEqual(two.ops, [["perBoost", 2]], "a card printing 2 multiplies by 2");

  P.fxReset();
  const three = P.fxParse({name: "SYN-FOREACH-D3", pitch: 3, cost: 0, power: null, def: 2,
    tt: "Mystic Defense Reaction", ty: ["Mystic", "Defense Reaction"],
    tx: "This gets +3{d} for each blue card you've pitched this turn.",
    kw: [], gkw: []});
  assert.deepEqual(three.defSelf, {amt: 3, per: "bluePitched"},
    "and the defence half reads its own number too");
});

test("AN UNKNOWN COUNTABLE REFUSES — falling through IS the bug", {skip}, () => {
  /* This is the load-bearing half rather than caution. A countable the
     engine cannot count, read as a flat +N by the loose matcher below,
     is exactly the defect this file exists for — so the clause is left
     UNREAD and visible in the audit (v2.29). No pool card can express the
     near miss, so it is synthetic (v3.73). */
  assert.equal(P.classifyClause("this gets +2{p} for each moon in the sky"), null,
    "an unreadable {p} countable refuses the whole clause");
  assert.equal(P.classifyClause("this gets +2{d} for each moon in the sky"), null,
    "and so does an unreadable {d} one — it must not reach the loose defBuff matcher");

  P.fxReset();
  const bad = P.fxParse({name: "SYN-FOREACH-UNKNOWN", pitch: 1, cost: 1, power: 4,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
    tx: "This gets +1{p} for each moon in the sky.", kw: [], gkw: []});
  assert.ok(!bad.self, "and the card grants nothing rather than a flat +1");
  assert.deepEqual(bad.ops, [], "no op either");
  assert.equal(bad.tier, "none", "the gap is REPORTED rather than guessed at");

  /* THE {d} HALF'S GUARD IS VISIBLE ONLY IN THE **TIER**, AND THAT IS THE
     WHOLE OF WHAT IT BUYS. Dropping it makes `ds.per` an `undefined`
     lookup, and `defendValue` then finds no `per` and falls through to
     `defSelfMet`, which answers FALSE for a `when` it does not know
     (v3.26) — so the DEFENCE NUMBER IS IDENTICAL either way and a drill
     that asserts on what the card blocks for is silent (found by
     sabotage). What differs is that the clause would be marked `handled`:
     a defender reported FULLY SCRIPTED while blocking for its printed
     value, which is the no-op blind spot exactly. Ask for the refusal
     (v3.98). */
  P.fxReset();
  const badD = P.fxParse({name: "SYN-FOREACH-UNKNOWN-D", pitch: 3, cost: 0,
    power: null, def: 2, tt: "Mystic Defense Reaction", ty: ["Mystic", "Defense Reaction"],
    tx: "This gets +1{d} for each moon in the sky.", kw: [], gkw: []});
  assert.equal(badD.defSelf, undefined,
    "no defSelf entry at all — one carrying an undefined `per` is a clause "
    + "counted as read that nothing can evaluate");
  assert.equal(badD.tier, "none",
    "and the tier says so: the behaviour is identical either way, so the "
    + "REPORT is the only thing this guard changes");
  assert.equal(E.defendValue(S.makeSide(), {name: "SYN-FOREACH-UNKNOWN-D", uid: 5,
    def: 2, pitch: 3, tt: "Mystic Defense Reaction", ty: ["Mystic", "Defense Reaction"],
    tx: "This gets +1{d} for each moon in the sky."}, {}), 2,
    "it blocks for its printed defence — the honest, weaker-than-printed direction");
});

test("the keys are the LEVELLED spelling, and the levelling reaches this rule",
     {skip}, () => {
  /* v3.71: `SYNONYMS` rewrites "you've" to "you have" and a pip-leading
     "gains"/"has" to "gets" before `classifyClause` sees a word, so a key
     spelling the printed contraction matches NOTHING and looks exactly
     like a pattern that is simply wrong. Every printed variant upstream
     has used must read identically — the pool prints the contraction
     today and printed the expansion before (v3.00). */
  const same = JSON.stringify([["perBoost", 1]]);
  for(const t of ["this gets +1{p} for each time you've boosted this combat chain",
                  "this gets +1{p} for each time you have boosted this combat chain",
                  "this gains +1{p} for each time you've boosted this combat chain",
                  "this has +1{p} for each time you have boosted this combat chain",
                  "it gets +1{p} for each time you've boosted this combat chain"]){
    assert.equal(JSON.stringify(P.classifyClause(t).ops), same,
      `both printed wordings must read identically: ${t}`);
  }
});

test("the two anchors' own cards, driven off the real record", {skip}, () => {
  /* MOVED HERE FROM `test/parser.test.js` (v4.48), where its fixtures were
     hand-written in the stale wording and it passed for it. This is the
     same claim asked of the printed text. */
  for(const [nm, pitch, op] of [["Fender Bender", 1, "perEquipDef"],
                                ["Overblast", 1, "perBoost"]]){
    P.fxReset();
    const fx = P.fxParse(H.card(nm, pitch));
    assert.ok((fx.ops || []).some(o => o[0] === op && o[1] === 1),
      nm + " must read its printed multiplier as " + op);
    assert.ok(!fx.self, nm + " must not ALSO read a flat pump (v2.30)");
    assert.equal(fx.tier, "full");
  }
});

/* ---- 2. THE CENSUS — v3.99's op check, as a STANDING drill ------------- */

/* v3.99 ran "every op kind the parser emits, against `runOps`' vocabulary"
   BY HAND, once. This is the direction that hand-run missed, and it is the
   one that would have caught this version's whole defect: an op with a
   FIRE SITE and NO EMITTER. `perBoost` and `perEquipDef` each had a
   carefully-reasoned evaluator in `effects.js` and not one pool card could
   produce them — dead rules code that reads like a rule (v4.11), and
   indistinguishable in a green suite from a mechanic that works.

   BOTH DIRECTIONS ARE PINNED (v4.17's partition rule). Pinning the
   emitters alone cannot see a countable leaving the table, and pinning the
   fire sites alone is what let this rot for as long as it did. */

const emittersOf = () => {
  const seen = {};
  for(const c of pool){
    P.fxReset();
    const fx = P.fxParse(c);
    for(const o of [...(fx.ops || []), ...(fx.lateOps || []),
                    ...(fx.conds || []).map(x => x.op)])
      if(o && Object.values(P.PER_COUNT["{p}"]).includes(o[0]))
        (seen[o[0]] = seen[o[0]] || []).push(c.name + "|" + c.pitch);
  }
  return seen;
};

test("CENSUS: every {p} countable in the table has at least one pool emitter",
     {skip}, () => {
  const seen = emittersOf();
  for(const op of Object.values(P.PER_COUNT["{p}"]))
    assert.ok((seen[op] || []).length > 0,
      `${op} has a fire site in effects.js and NO pool card emits it — `
      + "either the anchor is aimed at a wording the database does not print "
      + "(v3.00) or the op is dead rules code (v4.11)");
});

test("CENSUS: and every emitted countable has a fire site", {skip}, () => {
  const src = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  for(const op of Object.values(P.PER_COUNT["{p}"]))
    assert.ok(src.includes(`o[0]==="${op}"`) || src.includes(`op[0]==="${op}"`),
      `${op} is emitted by the parser and nothing in effects.js dispatches it`);
  /* AND IT MUST BE KEPT OFF `pend.ops`, or the multiplier runs a second
     time at resolution — v2.30's VALUE-DOUBLED, one field over. */
  const line = src.split("\n").find(l => l.includes("n.pend = {card, from, by: actorOf(n)"));
  assert.ok(line, "the pend literal is still findable");
  for(const op of ["perBoost", "perChainHit", "perEquipDef"])
    assert.ok(line.includes(`o[0]!=="${op}"`),
      `${op} must be filtered out of pend.ops or it fires twice`);
});

test("CENSUS: the {d} table is EMPTY, and that is a decision", {skip}, () => {
  /* An op lands on the resolving attack's POWER. What a `{d}` countable
     moves is what a card is worth at the WALL — `defendValue`'s number,
     on a card that may never be on the chain at all (Big Blue Sky is a
     Defense Reaction). So the two live in different tables on purpose, and
     the day an entry appears here somebody has to decide where it lands
     rather than it being silently fired as a pump (v4.33's `multi` rule). */
  assert.deepEqual(P.PER_COUNT["{d}"], {},
    "a {d} countable read as an OP would be fired as a power pump");
  assert.deepEqual(Object.keys(P.PER_COUNT).sort(), ["{d}", "{p}"],
    "and the table is keyed by the printed SYMBOL");
});

test("CENSUS: every DEF_PER key is counted by defPerCount", {skip}, () => {
  /* v3.96's rule one vocabulary over: when you have a second evaluator,
     measure what reaches it. A key the parser emits and this counter does
     not know answers ZERO — a defender silently blocking for its printed
     value while the audit reports the clause read. */
  const sd = Object.assign(S.makeSide(),
    {pitch: [{name: "B1", uid: 900, pitch: 3}, {name: "B2", uid: 901, pitch: 3}]});
  for(const key of Object.values(P.DEF_PER))
    assert.equal(E.defPerCount(key, sd), 2,
      `defPerCount has no branch for ${key} — it answers 0, so the clause is a no-op`);
  assert.equal(E.defPerCount("no-such-countable", sd), 0,
    "and an unknown key answers zero rather than throwing (reduce is fed JSON off a wire)");
});

test("CENSUS: every DEF_PER key has a pool emitter too", {skip}, () => {
  const seen = new Set();
  for(const c of pool){
    P.fxReset();
    const ds = P.fxParse(c).defSelf;
    if(ds && ds.per) seen.add(ds.per);
  }
  for(const key of Object.values(P.DEF_PER))
    assert.ok(seen.has(key), `${key} is in DEF_PER and no pool card emits it`);
  assert.deepEqual([...seen].sort(), ["bluePitched"],
    "one entry, measured — Big Blue Sky is the pool's only record of the shape");
});

/* ---- 3. DRIVEN — the pair either side of a count of 1 ------------------ */

const swing = (nm, pitch, over, pumpOpts) => {
  H.db();
  P.fxReset();
  const atk = {...H.card(nm, pitch), uid: 61};
  const g = Object.assign(
    {...H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
     stack: [], chain: []}, over || {});
  const out = J.withEffects(g, (fx, s) => fx.execute(s, atk, "hand", 0));
  const pre = J.withEffects(out, (fx, s) => fx.linkPumps(s, pumpOpts || {}));
  return {bonus: pre.total - (atk.power || 0), feed: out.feed || []};
};

test("DRIVEN: Overblast multiplies by the boosts on this chain", {skip}, () => {
  /* FOUR ROWS. The flat reading and the correct one AGREE at exactly 1, so
     the 0-row and the 2-row are what tell them apart (v3.92). */
  for(const n of [0, 1, 2, 3])
    assert.equal(swing("Overblast", 1, {boostChain: n}).bonus, n,
      `${n} boosts on the chain must grant exactly ${n}`);
});

test("DRIVEN: Fender Bender multiplies by the equipment defending", {skip}, () => {
  for(const eq of [0, 1, 2, 3])
    assert.equal(swing("Fender Bender", 1, {}, {equipDefenders: eq}).bonus, eq,
      `${eq} equipment defending must grant exactly ${eq}`);
});

test("DRIVEN: Salt the Wound counts attacks that HIT, not chain links", {skip}, () => {
  const lk = (kind, dmg) => ({n: "x", dmg, kind});
  for(const [chain, want, why] of [
    [[], 0, "an empty chain"],
    [[lk("atk", 3)], 1, "one attack that hit"],
    [[lk("atk", 3), lk("atk", 2)], 2, "two attacks that hit"],
    /* CR 7.5.5 — if prevention means no damage is dealt it is no longer a
       hit. `linkPayload` pushes an attack's link UNCONDITIONALLY with
       `dmg: total`, so a swing blocked to nothing is on the strip at zero
       and `dracLinks` (which asks nothing about damage) would count it. */
    [[lk("atk", 0)], 0, "an attack blocked to nothing has NOT hit (CR 7.5.5)"],
    /* v4.39 — `g.chain` is the display strip and `effects.js` pushes an
       entry for anything that dealt damage, ARCANE INCLUDED. */
    [[lk("arc", 1)], 0, "an arcane link is not an attack (v4.39)"],
    [[lk("atk", 3), lk("atk", 0), lk("arc", 2)], 1, "one of three counts"],
  ]) assert.equal(swing("Salt the Wound", 2, {chain}).bonus, want,
      `${why}: must grant exactly ${want}`);
});

test("DRIVEN: Big Blue Sky blocks for its printed def PLUS the blues pitched",
     {skip}, () => {
  H.db();
  const bbs = {...H.card("Big Blue Sky", 3), uid: 71};
  assert.equal(bbs.def, 2, "the printed defence, so the sum is visible");
  const at = zone => E.defendValue(Object.assign(S.makeSide(), {pitch: zone}), bbs, {});
  const blue = n => Array.from({length: n}, (_, i) => ({name: "B" + i, uid: 800 + i, pitch: 3}));
  for(const n of [0, 1, 2, 3])
    assert.equal(at(blue(n)), 2 + n, `${n} blue pitched must block for ${2 + n}`);
  /* ONLY BLUE COUNTS, and blue is pitch 3 — read off the printed pitch
     value rather than a colour word, because the colour is not a field.
     A fixture holding only blues cannot see a reader that counts the whole
     pitch zone (v3.26). */
  assert.equal(at([{name: "R", uid: 810, pitch: 1}, {name: "Y", uid: 811, pitch: 2},
                   {name: "B", uid: 812, pitch: 3}]), 3,
    "a red and a yellow in the pitch zone count for nothing");
});

test("DRIVEN: the multiplier does not fire a SECOND time at resolution",
     {skip}, () => {
  /* It is evaluated at DECLARATION and must be filtered out of `pend.ops`,
     or `runOps` gets it again when the link resolves — v2.30's
     VALUE-DOUBLED on the fairness sweep's own terms. The census above
     pins the filter textually; this drives it. */
  H.db();
  P.fxReset();
  const atk = {...H.card("Overblast", 1), uid: 62};
  const g = {...H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
             stack: [], chain: [], boostChain: 2};
  const out = J.withEffects(g, (fx, s) => fx.execute(s, atk, "hand", 0));
  assert.ok(!(out.pend.ops || []).some(o => o[0] === "perBoost"),
    "the op must not ride to resolution");
  assert.equal(J.withEffects(out, (fx, s) => fx.linkPumps(s, {})).total, 5 + 2,
    "and the swing carries the multiplier exactly once");
});

test("DRIVEN: the feed names the count, and its plural agrees", {skip}, () => {
  /* IN A TRAINING SIM THE FEED IS THE LESSON (v3.60, v4.24, v4.46). These
     two lines had NEVER ONCE FIRED in a real game — zero pool emitters —
     and the boost line read "0 boostes". A line nothing can reach is a
     line nobody proofread. */
  const one = swing("Overblast", 1, {boostChain: 1}).feed.join("\n");
  const two = swing("Overblast", 1, {boostChain: 2}).feed.join("\n");
  const nil = swing("Overblast", 1, {boostChain: 0}).feed.join("\n");
  assert.match(one, /1 boost on this chain/, "singular");
  assert.match(two, /2 boosts on this chain/, "plural");
  assert.match(nil, /0 boosts on this chain/, "and zero is plural, not \"boostes\"");
  assert.ok(!/boostes/.test(one + two + nil), "never \"boostes\"");

  const h1 = swing("Salt the Wound", 2, {chain: [{n: "x", dmg: 3, kind: "atk"}]}).feed.join("\n");
  const h2 = swing("Salt the Wound", 2,
    {chain: [{n: "x", dmg: 3, kind: "atk"}, {n: "y", dmg: 1, kind: "atk"}]}).feed.join("\n");
  assert.match(h1, /1 attack has hit this chain/, "singular verb agrees too");
  assert.match(h2, /2 attacks have hit this chain/, "and the plural one");
});

/* ---- 4. THE STALE-FIXTURE LESSON, AS A DRILL -------------------------- */

test("the WHERE-X-IS wording the old anchors spelled is printed by NO pool record",
     {skip}, () => {
  /* THE FINDING, PINNED. `perEquipDef` and `perBoost` were both anchored
     on "this gains +X{p}, where X is the number of …", and the drill that
     pinned `perBoost` wrote that wording out BY HAND — so it was green
     against text the database does not print. If upstream ever levels back
     to it, this drill fails and somebody widens the anchor deliberately
     instead of a card silently going quiet (v3.00). */
  const stale = pool.filter(c => c.tx && /where x is the number of times/i.test(c.tx));
  assert.deepEqual(stale.map(c => c.name), [],
    "no pool record prints the WHERE-X-IS form — the anchors were aimed at nothing");
  const live = pool.filter(c => c.tx && /\+\d+\{[pd]\} for each /i.test(c.tx))
    .map(c => c.name + "|" + c.pitch).sort();
  assert.deepEqual(live,
    ["Big Blue Sky|3", "Fender Bender|1", "Fender Bender|2", "Fender Bender|3",
     "Overblast|1", "Overblast|2", "Overblast|3", "Salt the Wound|2",
     "V of the Vanguard|2"],
    "and these are the NINE records that print the FOR-EACH form");

  /* EIGHT ARE CLAIMED AND ONE REFUSES, AND THE PARTITION IS PINNED BOTH
     WAYS (v4.17). Pinning the claimants alone cannot see a record leaving
     the set, and the scan above is deliberately WIDER than the reader — it
     asks which records print the shape, not which ones this version reads.
     That width is what found the ninth: the first draft of this drill
     listed eight from memory and the scan corrected it, which is v4.09's
     rule (check your own fixture by ASKING rather than by remembering)
     landing inside the drill written to state a measurement. */
  const read = [], refused = [];
  for(const c of pool.filter(c => c.tx && /\+\d+\{[pd]\} for each /i.test(c.tx))){
    P.fxReset();
    const fx = P.fxParse(c);
    const got = (fx.ops || []).some(o => Object.values(P.PER_COUNT["{p}"]).includes(o[0]))
             || !!(fx.defSelf && fx.defSelf.per);
    (got ? read : refused).push(c.name + "|" + c.pitch);
  }
  assert.deepEqual(read.sort(),
    ["Big Blue Sky|3", "Fender Bender|1", "Fender Bender|2", "Fender Bender|3",
     "Overblast|1", "Overblast|2", "Overblast|3", "Salt the Wound|2"],
    "the eight this reader claims");

  /* V OF THE VANGUARD IS THE REFUSAL, AND ITS SUBJECT IS WHY. It prints
     "YOUR ATTACKS this combat chain get +1{p} for each Light card charged
     this way" — a STANDING grant over a window (`dracChain`'s shape,
     v4.19), not a pump on the resolving card, so it lands somewhere else
     entirely and this reader's "this"/"it" anchor is right to refuse it.

     AND ITS COUNTABLE NEEDS A FIELD THIS PROJECT DELIBERATELY LEFT
     UNCARRIED. "Charged THIS WAY" counts the cards that card's own
     additional cost charged, which is `fx.chargeCost.multi` — read from
     the printed "any number of times" and consumed by nothing, pinned as
     an EMPTY SET at v4.33 precisely so the day something needs it
     somebody decides rather than it being silently charged once. So this
     card is the standing reason that set is not empty by accident, and it
     stays `part` until `multi` is built. */
  assert.deepEqual(refused, ["V of the Vanguard|2"],
    "and the one it refuses, on a printed subject that is not this card");
  P.fxReset();
  const vov = P.fxParse(pool.find(c => c.name === "V of the Vanguard"));
  assert.equal(vov.tier, "part", "reported as unfinished rather than guessed at");
  assert.ok(!vov.self, "and it grants no flat pump either");
});
