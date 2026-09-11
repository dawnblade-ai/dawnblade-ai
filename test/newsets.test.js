/* test/newsets.test.js — TWO PRECONS THAT CANNOT BE BUILT YET, AND THE
 * PROBE THAT COMES DUE BY ITSELF (v4.32)
 *
 * Two new Silver Age precons dropped after v4.30. Their lists are
 * extracted, reconciled and pinned in `data/newsets.json` as FETCHED
 * data — names, print codes, quantities, sections, and no card text,
 * which is the same shape `window.DECKS` already holds for the fifteen.
 *
 * NEITHER IS BUILDABLE, and the reason is the golden rule: card text
 * STREAMS at runtime from the-fab-cube's `develop` branch, and that
 * branch carries neither set. Its own `csvs/english/set.csv` lists
 * exactly 15 Silver Age sets — the 15 heroes this project decks — and
 * SAT and SBW are not among them. Building either would mean inventing
 * card effects, which is the one thing this project never does.
 *
 * Prism is 2 names short (10 of its 55 cards); Viserai, Between Worlds
 * is 13 names short (34 of its 55, its own HERO record included).
 *
 * A RECORDED GAP IS A DEBT (v3.61), so this file is the probe rather
 * than a note. It asserts the DEVIATION — that the two sets are absent
 * and their blocking names do not resolve — which is a `stated`/`open`
 * record's direction (v4.02): it goes RED the day somebody builds them,
 * forcing the record to be updated rather than leaving a stale sentence
 * behind. The live-wire half is in `drift.test.js`, the one drill
 * allowed to look at the wire, and it fires the day upstream publishes.
 *
 * IT READS NO NETWORK. Every assertion here is against the pinned pool
 * and the pinned lists, because "the suite needs no network" is the
 * property `loader.test.js` states and this file must not cost it.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const C = require("../engine/cards.js");
const { loadData } = require("./helpers/extract.js");

const NEW = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "newsets.json"), "utf8"));
const SETS = ["prism", "viseraiBetweenWorlds"];

let _pool = null;
const pool = () => _pool || (_pool = (() => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"))
    .filter(c => c && c.name);
  return {raw, byName: new Set(raw.map(c => String(c.name).toLowerCase().trim()))};
})());

/* ---- the lists are complete, and each reconciles against itself ----- */

test("each new precon list totals exactly 55 cards, hero excluded", () => {
  /* The same rule `decks.test.js` holds the fifteen to. A list that does
     not total 55 is a list somebody transcribed wrong, and this one was
     read off a page rather than published as JSON. */
  for(const k of SETS){
    const d = NEW[k];
    assert.equal(d.cardsExcludingHero, 55, d.hero + " decks 55 cards");
    let n = 0;
    for(const [sec, o] of Object.entries(d.sections)){
      const counted = o.rows.reduce((a, r) => a + r.q, 0);
      /* EACH SECTION AGAINST ITS OWN CLAIMED COUNT, which is what makes
         this a reconciliation rather than a total that happens to land. */
      assert.equal(counted, o.claimed,
        d.hero + " " + sec + ": counted " + counted + ", the page claims " + o.claimed);
      if(sec !== "Extras") n += counted;
    }
    assert.equal(n - 1, 55, d.hero + " sums to 55 across its sections too");
  }
});

test("every row carries a print code from its own set", () => {
  for(const k of SETS){
    const d = NEW[k];
    const re = new RegExp("^" + d.set + "\\d{3}$");
    for(const o of Object.values(d.sections))
      for(const r of o.rows){
        assert.match(r.code, re, d.hero + ": " + r.name + " is coded " + r.code);
        assert.ok(r.name && r.q > 0, "and names a card with a real quantity");
      }
  }
});

/* ---- the deviation: neither set exists upstream --------------------- */

test("neither set is in the pinned pool — building one would invent card text", () => {
  /* THE PROBE POINTS AT THE GAP (v4.02). It asserts the deviation is
     still there, so it goes RED the day these are built — which is
     exactly when this file, `data/newsets.json` and CLAUDE.md all have
     to be brought up to date. */
  const codes = new Set();
  for(const c of pool().raw)
    for(const p of (c.printings || [])) if(p.set_id) codes.add(p.set_id);
  /* PROVE THE SCAN IS ALIVE FIRST. A census that reports nothing looks
     exactly like one aimed at the wrong field (v3.81, v4.17) — and the
     first draft of this very scan read `set_printing_unique_id`, which
     answered ABSENT for every set including the fifteen. */
  for(const s of ["SAZ", "SDO", "SEN", "SKA"])
    assert.ok(codes.has(s), "the scan is alive — the pool carries " + s);
  for(const k of SETS)
    assert.equal(codes.has(NEW[k].set), false,
      NEW[k].set + " is absent from the pool, so " + NEW[k].hero + " cannot be dealt");
});

test("the recorded upstream gap is internally consistent with the lists", () => {
  /* THE POOL IS THE WRONG ORACLE FOR THIS QUESTION, and the first draft
     of this drill asked it anyway. `data/pool.json` is what the FIFTEEN
     precons can reach — 797 records — so almost every card in a
     sixteenth list is "missing" from it, and the answer looked like a
     finding. A scan aimed at the wrong data set fails exactly as a real
     gap does (v3.81, v4.07).

     The right oracle is the LIVE database, and the suite reads no
     network (`loader.test.js` states that property and this file must
     not cost it). So the measurement is FETCHED DATA in
     `data/newsets.json` — taken 2026-09-07 over 4,952 records — and
     what is checked HERE is that the record and the lists agree with
     each other. `drift.test.js` re-derives it against the wire. */
  for(const k of SETS){
    const d = NEW[k];
    const names = new Set();
    for(const [sec, o] of Object.entries(d.sections)) if(sec !== "Extras")
      for(const r of o.rows) names.add(r.name);

    assert.ok(d.upstreamMissing.length > 0,
      d.hero + " is blocked — the day this is empty the record is stale and the drill says so");
    for(const n of d.upstreamMissing)
      assert.ok(names.has(n), n + " is recorded missing but is not in " + d.hero + "'s list");
    assert.equal(d.namesTotal, names.size, "the recorded name count matches the list");
    assert.equal(d.namesResolving, names.size - d.upstreamMissing.length,
      "and resolving + missing is the whole list");

    /* "2 names" and "10 of 55 cards" are different facts, and only the
       second says whether a partial build could ever be honest. */
    let blocked = 0;
    for(const [sec, o] of Object.entries(d.sections)) if(sec !== "Extras")
      for(const r of o.rows) if(d.upstreamMissing.indexOf(r.name) >= 0) blocked += r.q;
    assert.equal(blocked, d.cardsBlocked,
      d.hero + ": the recorded card count does not match its own rows");
    assert.deepEqual(d.pitchShort, [],
      "no resolving name is pitch-short, so the gap is exactly the absent names");
  }
});

test("the blocking names are pinned by NAME, not by a count", () => {
  /* A count says "13 missing"; a set says WHICH, which is what a data
     drop has to satisfy — and it is what turns red the day one of them
     is published rather than the day all of them are. */
  assert.deepEqual(NEW.prism.upstreamMissing, ["Figment of Hope", "Herald of Hope"]);
  assert.equal(NEW.prism.cardsBlocked, 10, "10 of Prism's 55 cards");
  assert.deepEqual(NEW.viseraiBetweenWorlds.upstreamMissing, [
    "Bloodfrenzy Gloomblade", "Corrupted Crown", "Cullingsong Gloomblade",
    "Demonbound Gloomblade", "Embrace Ursur", "Murmuring Gloomblade",
    "Otherworldly Sins", "Plundersong Gloomblade", "Pull from Beyond",
    "Runic Disposition", "Seven Sin Nebula", "Vexing Gloomblade",
    "Viserai, Between Worlds"
  ], "its own HERO record among them");
  assert.equal(NEW.viseraiBetweenWorlds.cardsBlocked, 34, "34 of its 55 cards");
});

/* ---- and the fifteen we DO have are untouched ----------------------- */

test("the fifteen built precons are unchanged by any of this", () => {
  /* The control. A file that adds two heroes' worth of data must not
     have moved the deck list the game actually plays. */
  const W = loadData();
  assert.equal(Object.keys(W.DECKS).length, 15, "still fifteen decks");
  for(const k of SETS)
    assert.equal(k in W.DECKS, false, k + " is a SPEC, not a playable deck");
  assert.ok(C.buildMaps, "and the loader is untouched");
});

/* ---- THE ANNOUNCEMENT, AND WHICH SOURCE IS THE ORACLE (v4.40) --------

   Flesh and Blood Weekly announced *Silver Age: Usurp the Shadow Throne*
   for 2026-09-18 — the two precons this file pins. That date is recorded
   because a reader who does not know it cannot tell "upstream has not
   published yet" from "nobody is coming", and those want different
   responses.

   IT IS A CALENDAR HINT AND NOTHING MORE. What decides whether these are
   buildable is whether the-fab-cube's `develop` carries the sets, which
   is the golden rule's own question and which `test/drift.test.js`
   measures on the live wire. A street date can say roughly WHEN to expect
   that probe to go red; it can never say that it HAS. So the announcement
   keeps its own provenance block rather than being folded into `source`
   (the fabrary deck pages the lists came from) or `upstream` (the
   measurement), and this drill pins that separation. */
test("the announced street date is recorded with its own source, apart from the measurement", () => {
  const a = NEW.announced;
  assert.ok(a, "the announcement block is gone");
  assert.match(a.street, /^\d{4}-\d{2}-\d{2}$/, "an ISO date, so it can be compared");
  assert.ok(a.source && /weekly|announc/i.test(a.source), "an announcement needs its source named");
  assert.ok(a.block && a.block.length, "the product carries a name, not only two print codes");
  assert.deepEqual([...a.heroes].sort(),
    [NEW.prism.hero, NEW.viseraiBetweenWorlds.hero].sort(),
    "the announcement names the same two heroes the lists pin");

  /* THE THREE PROVENANCES STAY APART. Folding a street date into the
     upstream measurement would make a CLAIM look like an OBSERVATION —
     the shape v4.25 found when one scan fed two consumers. */
  assert.ok(!("street" in NEW.upstream), "a street date is not an upstream measurement");
  assert.ok(!/announc/i.test(String(NEW.source)), "the lists' source is fabrary, not the announcement");
});

/* ---- THE HEADER'S OWN STANDING CLAIM, AS A DRILL (v4.40) -------------

   This file has said "NO CARD TEXT IS RECORDED HERE and none may be"
   since v4.32 and nothing asserted it — a doc claim is a test with no
   assertion (v3.41). It is the one claim that matters most here, because
   recording a single line of rules text for an unpublished set is the
   golden rule broken at the point where nobody could check it against a
   printing.

   THE SCAN IS AIMED AT WHAT CARD TEXT ACTUALLY LOOKS LIKE, measured over
   the file first: 203 string values, 0 pip tokens, 0 rules verbs. A pip
   token cannot appear in a card NAME, so there is no false positive to
   trade away. The control is a literal here rather than by concatenation
   because the scan reads `data/newsets.json` and never this file — the
   opposite of v4.36's probe census, which had to dodge its own source. */
const CARD_TEXT = /\{[rpdh]\}|\b(?:go again|when this|whenever|target \w|deals \d|gets \+)\b/i;

test("no card text is recorded for an unpublished set — the golden rule, where nobody could check it", () => {
  /* ONE BODY, DRIVEN TWICE. The first draft asserted the REGEX could see a
     keyword and left the FILTER unproven — so neutering the filter
     (`false && CARD_TEXT.test(s)`) came back SILENT, because the real file
     is clean and an empty result is an empty result either way. That is
     v4.00's own finding verbatim: a check that only ever sees zero cannot
     tell a live scan from a dead one. The control goes through the SAME
     census now. */
  const cardTextIn = obj => {
    const strs = [];
    (function walk(x){
      if(typeof x === "string") strs.push(x);
      else if(Array.isArray(x)) x.forEach(walk);
      else if(x && typeof x === "object") Object.values(x).forEach(walk);
    })(obj);
    return {seen: strs.length, found: strs.filter(s => CARD_TEXT.test(s))};
  };

  const real = cardTextIn(NEW);
  assert.ok(real.seen > 100, "the walk found almost nothing — it is aimed at the wrong shape");
  assert.deepEqual(real.found, [],
    "card text recorded in newsets.json: " + JSON.stringify(real.found.slice(0, 3)));

  /* THE POSITIVE CONTROL, through the census rather than beside it — and
     NESTED, because a walk that stops descending is the other way this
     passes by finding nothing.

     TWO ROWS, EACH REACHABLE BY ONLY ONE HALF OF THE PATTERN. Written as
     one row printing "…it gets +1{p}. Go again" the fixture carries a pip
     AND a verb, so dropping either half of the alternation stayed SILENT —
     a fixture where two things coincide has tested neither (v3.26). */
  const planted = cardTextIn({prism: {sections: [{rows: [
    {name: "Herald of Hope"},
    {name: "a pip and no verb",  tx: "Prevent 2{h}"},
    {name: "a verb and no pip",  tx: "When this attacks, draw a card"}]}]}});
  assert.equal(planted.found.length, 2,
    "the census misses card text two levels down, or one half of the pattern is dead");
});
