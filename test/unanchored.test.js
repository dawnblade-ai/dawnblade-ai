/* ============================================================
   THE UNANCHORED-MATCH CENSUS, STANDING (v4.84)

   `npm run unanchored` asks, for every pool clause that reads `run`, which
   match produced the answer and whether it covered the sentence. v4.82 and
   v4.83 ran that question by hand and it found NINE live defects, every
   one `tier: full`:
     - the plain draw dropping "…and create a Gold token";
     - Art of Desire drawing on every attack;
     - Aether Spindle's opt X read as 1;
     - Spectral Manifestations' counters dropped;
     - a standing first-attack bonus fired once.
   v4.84's own run found a tenth: the if/when handler did not know
   `whenever`.

   A LEFTOVER IS A LEAD, NOT A FINDING. So what is pinned is the SET, one
   family at a time, with the reason each is accounted for. A sentence
   ARRIVING is a rule that has started to swallow one; a sentence LEAVING
   is one that has started to be read whole. Both are deliberate edits,
   and a set pinned in one direction cannot see the other (v4.12, v4.17).

   THE POOL IS FROZEN (`data/formats.json`), which is what makes a set of
   sentences pinnable at all: this list moves only when the PARSER moves.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const U = require("../tools/unanchored.js");

const ROOT = path.join(__dirname, "..");
let R = null;
const run = () => R || (R = U.census());

const PIN = [
  {
    "src": "/deals? (\\d+) arcane damage/",
    "n": 19,
    "why": "the TARGET phrase is the caller's routing — arcane goes to the opposing hero; an `instead` payload is flagged by the if/when handler",
    "sentences": [
      "deal 1 arcane damage to any target",
      "deal 1 arcane damage to target hero",
      "deal 1 arcane damage to the attacking hero",
      "deal 1 arcane damage to them",
      "deal 2 arcane damage to any target",
      "deal 2 arcane damage to target hero",
      "deal 2 arcane damage to target opposing hero",
      "deal 3 arcane damage to any target",
      "deal 3 arcane damage to target hero",
      "deal 3 arcane damage to target opposing hero",
      "deal 4 arcane damage to any target",
      "deal 4 arcane damage to target hero",
      "deal 4 arcane damage to target opposing hero",
      "deal 4 arcane damage to them",
      "deal 5 arcane damage to any target",
      "deal 5 arcane damage to target hero",
      "instead deal 4 arcane damage",
      "instead deal 5 arcane damage",
      "instead deal 6 arcane damage"
    ]
  },
  {
    "src": "/tokens?((?:\\s.*|,.*)?)$/",
    "n": 11,
    "why": "the token rule's TAIL CHECK (v4.83), an extraction that runs after the rule decided: nothing follows \"token\", so nothing was refused. The hero passives' prefixes are read by `build.js`",
    "sentences": [
      "create a confidence token",
      "create a courage token",
      "create a fealty token",
      "create a gold token",
      "create a spectral shield token",
      "create a vigor token",
      "create an agility and a vigor token",
      "create an agility token",
      "the first time an attack action card you control deals damage to an opposing hero each turn, create an embodiment of earth token",
      "the first time you discard a card with 6 or more {p} during each of your action phases, create a might token",
      "the second time you play a non-attack action card each turn, create an embodiment of lightning token"
    ]
  },
  {
    "src": "/under (?:their|the attacking hero'?s?|target hero'?s?) control/",
    "n": 7,
    "why": "the token rule's recipient test, after the decision — the control phrase IS the reading",
    "sentences": [
      "create a bloodrot pox token under their control",
      "create a frailty token under the attacking hero's control",
      "create a frailty token under their control",
      "create a frostbite token under their control",
      "create an inertia token under the attacking hero's control",
      "create an inertia token under their control",
      "create x frostbite tokens under target hero's control"
    ]
  },
  {
    "src": "/(?:^|this(?: attack)? |it )(?:gains?|gets?|has) \\+(\\d+)\\s*(?:\\{p\\}|power)( and go again)?/",
    "n": 6,
    "why": "an `instead` pump (Overpower's reprise), an arsenal stamp's window (v2.33's fold) and one rung of v4.19's ladder",
    "sentences": [
      "instead it gets +4{p}",
      "instead it gets +5{p}",
      "instead it gets +6{p}",
      "it gets +1{p} until end of turn",
      "it gets +2{p} this turn",
      "this gets go again, 3 or more, your attacks are draconic this combat chain, 4 or more, this gets +2{p}"
    ]
  },
  {
    "src": "/\\bthis turn\\b/",
    "n": 6,
    "why": "the prevention window (v4.07). \"…to target hero … by a source of your choice\" is `prevention-target-and-source`, stated",
    "sentences": [
      "prevent the next 2 damage that would be dealt to target hero this turn by a source of your choice",
      "prevent the next 3 damage that would be dealt to target hero this turn by a source of your choice",
      "prevent the next 4 damage that would be dealt to target hero this turn by a source of your choice",
      "the next time you would be dealt damage this turn, prevent 1 of that damage",
      "the next time you would be dealt damage this turn, prevent 2 of that damage",
      "the next time you would be dealt damage this turn, prevent 3 of that damage"
    ]
  },
  {
    "src": "/create (a|an|one|two|three|\\d+) runechants?/",
    "n": 6,
    "why": "\"… runechant TOKEN(S)\", and Mauvrion Skies' rider count, read inside its grant (v3.10)",
    "sentences": [
      "create 2 runechant tokens",
      "create 3 runechant tokens",
      "create a runechant token",
      "the next runeblade attack action card you play this turn gets go again and \"when this hits, create 2 runechant tokens.\"",
      "the next runeblade attack action card you play this turn gets go again and \"when this hits, create 3 runechant tokens.\"",
      "the next runeblade attack action card you play this turn gets go again and \"when this hits, create a runechant token.\""
    ]
  },
  {
    "src": "/(?:target )?attack(?:ing card)? (?:gets?|gains?) -(\\d+)\\s*(?:\\{p\\}|power)/",
    "n": 3,
    "why": "Drag Down's \"the attack gets -N{p}\": the trailing \"{p}\" is the whole of what is left",
    "sentences": [
      "the attack gets -1{p}",
      "the attack gets -2{p}",
      "the attack gets -3{p}"
    ]
  },
  {
    "src": "/gains? (\\d+)\\s*(?:\\{h\\}|life)/",
    "n": 3,
    "why": "Arcane Polarity's `instead gain N{h}`, flagged by the if/when handler",
    "sentences": [
      "instead gain 2{h}",
      "instead gain 3{h}",
      "instead gain 4{h}"
    ]
  },
  {
    "src": "/(?:^|this |it )(?:gains?|gets?|has) \\+(\\d+)\\s*(?:\\{d\\}|defense)/",
    "n": 2,
    "why": "Blade Beckoner and Unity, read by the whole-card `defSelf` reader (v3.24, v3.27)",
    "sentences": [
      "this gets +1{d} while defending a weapon attack",
      "unity - when this defends together with a card from hand, this gets +1{d} until end of turn"
    ]
  },
  {
    "src": "/(?:next card you play this turn with an (?:effect that deals arcane damage|arcane damage effect), instead deals|(?:effect that deals arcane damage|arcane damage effect), instead (?:that effect|it) deals) that much arcane damage plus (\\d+)/",
    "n": 2,
    "why": "the amp reader matches from \"next card\", so only the leading \"the \" is left — Absorb in Aether and Cindering Foresight read whole",
    "sentences": [
      "the next card you play this turn with an arcane damage effect, instead deals that much arcane damage plus 1",
      "the next card you play this turn with an arcane damage effect, instead deals that much arcane damage plus 2"
    ]
  },
  {
    "src": "/this gets ([+-])x\\s*\\{p\\}, where x is the pitch value of the card revealed/",
    "n": 2,
    "why": "the Rabbles' reveal: the trailing \"this way\" is what `revPitch` reads by construction",
    "sentences": [
      "this gets +x{p}, where x is the pitch value of the card revealed this way",
      "this gets -x{p}, where x is the pitch value of the card revealed this way"
    ]
  },
  {
    "src": "/(?:they|the defending hero|target hero|defending hero|opponent) discards? a card unless (?:they|he|she) reveals? a card from (?:their|his|her) hand with \\{p\\} greater than the damage dealt/",
    "n": 1,
    "why": "Strongest Survive's reveal-or-discard: the trailing \"this way\" is the damage the reader already names",
    "sentences": [
      "they discard a card unless they reveal a card from their hand with {p} greater than the damage dealt this way"
    ]
  },
  {
    "src": "/(?:they|the defending hero|target hero|defending hero|opponent|each opponent) discards?/",
    "n": 1,
    "why": "\"they discard a card\": the count is always one, and that is a PREMISE drilled below, not an assumption",
    "sentences": [
      "they discard a card"
    ]
  },
  {
    "src": "/\\bin (?:an?|their|the|target(?: hero'?s?)?|an opponent'?s?) (?:opponent'?s? )?exposed ((?:head|chest|arms|legs)(?:,?\\s*(?:or\\s+)?(?:head|chest|arms|legs))*) zones?\\b/",
    "n": 1,
    "why": "Frost Spike: the zone list IS read whole — by the token rule's own exposed-zone check (v2.74)",
    "sentences": [
      "create a frostbite token in an exposed head, chest, arms, or legs zone"
    ]
  },
  {
    "src": "/\\bmark (?:them|the attacking hero|target (?:opposing )?hero)\\b/",
    "n": 1,
    "why": "Mark of the Huntsman: \"you may choose to destroy this and\" is v4.37's cost fold, which reads the whole sentence first",
    "sentences": [
      "you may choose to destroy this and mark them"
    ]
  },
  {
    "src": "/^the next time you would be dealt damage this turn, prevent x of that damage, where x is the pitch value of the card revealed/",
    "n": 1,
    "why": "Throw Caution to the Wind: the trailing \"this way\" is the reveal `revWard` reads (v3.68)",
    "sentences": [
      "the next time you would be dealt damage this turn, prevent x of that damage, where x is the pitch value of the card revealed this way"
    ]
  }
];

test("the instrument is alive — it wrapped the reader and walked the pool", () => {
  const r = run();
  /* v3.81: a scan aimed wrong reports ZERO exactly as a clean result does.
     The site counts prove the transform reached `classifyClause`; the
     clause count proves the pool was walked. */
  assert.ok(r.sites.match > 80, "only " + r.sites.match + " c.match sites were wrapped");
  assert.ok(r.sites.test > 60, "only " + r.sites.test + " .test(c) sites were wrapped");
  assert.ok(r.clauses > 1000, "only " + r.clauses + " run clauses walked");
});

test("…and it SEES a loose match: a synthetic control through the same instrument", () => {
  /* The positive control goes THROUGH the census's own machinery (v4.32):
     the instrumented parser, asked a sentence the plain draw used to
     swallow, must report nothing left over now — and a sentence a rule
     reads only in part must be reported. */
  /* "Draw 2 cards" and not v4.82's compound: there the LAST match is the
     inner token rule's tail check, an extraction after the decision, which
     the tool's header names as a family of its own. The first draft of
     this control used the compound and failed against a correct tool —
     check your own fixture (v4.09). */
  const I = U.instrumented();
  I.begin(); const r1 = I.P.classifyClause("draw 2 cards"); const l1 = I.end();
  assert.equal(r1.status, "run");
  assert.ok(U.covers(l1[l1.length - 1].m0, l1[l1.length - 1].c), "a sentence read whole is not a leftover");
  I.begin(); I.P.classifyClause("deal 3 arcane damage to any target"); const l2 = I.end();
  assert.equal(U.covers(l2[l2.length - 1].m0, l2[l2.length - 1].c), false,
    "a sentence a rule reads in part IS reported — or the census can never find one");
});

test("the leftover set is pinned, family by family, with its reason", () => {
  const r = run();
  const got = r.families.map(f => f.src + " :: " + f.sentences.length).sort();
  const want = PIN.map(p => p.src + " :: " + p.n).sort();
  assert.deepEqual(got, want,
    "a family ARRIVED, LEFT or changed size. A new family is a rule that has started to swallow " +
    "sentences — read them before pinning; one leaving is a reading that became whole");
  for(const p of PIN){
    const f = r.families.find(x => x.src === p.src);
    assert.deepEqual(f.sentences, p.sentences, p.src + " — " + p.why);
    assert.ok(p.why && p.why.length > 20, "every family carries its reason");
  }
  assert.equal(r.total, 72);
});

test("PREMISE: every opponent discard in the pool is ONE card", () => {
  /* The loose discard rule reads no count and answers 1 — right for the
     pool, where every opponent discard prints "a card". Measured; a card
     printing two fails here rather than silently discarding one. */
  const pool = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  const counts = new Set();
  for(const c of pool)
    for(const m of String(c.functional_text || "").matchAll(/(?:they|opponent|defending hero|target hero)[^.]{0,20}?discards? (a|an|one|two|three|\d+) /gi))
      counts.add(m[1].toLowerCase());
  assert.deepEqual([...counts].sort(), ["a"]);
});

test("`whenever` is `when`: \"Whenever this attacks a hero\" keeps its trigger and its hero gate", () => {
  const P = require("../engine/parser.js");
  assert.deepEqual(P.classifyClause("whenever this attacks a hero, they discard a card"),
    {status: "run", ops: [["foeDiscard", 1]], atkHero: true});
  assert.deepEqual(P.classifyClause("when this attacks a hero, they discard a card"),
    P.classifyClause("whenever this attacks a hero, they discard a card"), "the two spellings read alike");
  /* and an unknown trigger REFUSES rather than falling to a loose payload
     rule — the hero passives' loose token read is gone */
  assert.equal(P.classifyClause("whenever the crowd boos you, create a might token"), null);
});
