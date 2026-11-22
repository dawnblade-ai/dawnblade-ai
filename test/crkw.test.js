/* THE KEYWORDS A DECK USES, AND WHAT EACH MEANS (v6.60).

   The hero banner and sheet show the keywords a deck's cards use
   (`cards.deckKeywords`), and a tap opens the Comprehensive Rules sentence
   that defines it (`cards.crKeyword` over data/crkw.js, which
   tools/pin-crkw.js pins verbatim from rules.fabtcg.com). This holds:
     1. the pinned file's shape (numbers, names, a definition, no markup);
     2. every keyword any hero's deck uses has a rule to open — a new precon
        whose keyword the pin lacks fails here, by name;
     3. the counter: copies, a parameter folded, deck-building keywords out,
        one count per card — each with its refusal;
     4. the lookup: an exact name beats a tail, a tail is a whole word, an
        alternative name is a name, and an unknown word answers null;
     5. the page loads the file and reaches both readers only through the bridge.
   UNGATED: the pool and the pin are in the repo. */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../engine/cards");
const G = require("../engine/game");
const K = require("../data/crkw.js");
const H = require("./helpers/judged.js");
const { html, loadData } = require("./helpers/extract");

const W = loadData();

test("data/crkw.js: the keyword chapter's ability, label and effect rows, each a number, a name and a plain-text definition", () => {
  assert.ok(Array.isArray(K.rows) && K.rows.length >= 100, "too few rows: " + (K.rows || []).length);
  assert.match(K.src, /^https:\/\/rules\.fabtcg\.com\//);
  const seen = new Set();
  for(const r of K.rows){
    assert.match(r.r, /^8\.[345]\.\d+$/, "a row outside the three keyword sections: " + r.r);
    assert.ok(!seen.has(r.r), "two rows for " + r.r); seen.add(r.r);
    assert.ok(r.n && r.t && r.t.length > 20, r.r + " has no definition");
    assert.ok(!/<[a-z\/]|&[a-z]+;/i.test(r.t + r.n), r.r + " carries markup: " + r.t);
  }
  const ga = K.rows.find(r => r.r === "8.3.5");
  assert.equal(ga.n, "Go again");
  assert.equal(ga.t, "Go again is a special resolution ability that means \"Gain 1 action point.\"");
  /* an icon is kept as its card-text token, never dropped */
  assert.match(K.rows.find(r => r.n === "Clash").t, /greatest \{p\} value/);
});

test("every keyword any hero's deck uses has a rule to open", () => {
  const db = H.db(), missing = [], used = new Set();
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]), sa = (d.hero.code || "").slice(0, 3) || null;
    const rows = C.deckKeywords(d.deck.map(e => C.resolveEntry(db, e, sa)));
    assert.ok(rows.length > 0, h.k + " shows no keyword at all");
    rows.forEach(r => { used.add(r.k); if(!C.crKeyword(r.k, K.rows)) missing.push(h.k + ": " + r.k); });
  }
  assert.deepEqual(missing, [], "keywords with no rule to open (re-pin, or teach crKeyword the spelling)");
  /* the spellings this lookup exists for were really met */
  for(const k of ["Ice Fusion", "Lightning Flow", "The Crowd Boos", "Go again"]) assert.ok(used.has(k), "fixture: no deck uses " + k);
});

test("deckKeywords: copies counted, a parameter folded, deck-building keywords left out", () => {
  const card = (name, kw, q) => ({name, kw, q});
  const rows = C.deckKeywords([
    card("A", ["Go again", "Opt 2"], 3),
    card("B", ["go again", "Opt X", "Legendary"], 2),
    card("C", ["Opt 1", "Opt 3", "Ice Fusion"], 1),          /* two Opt parameters on one card: one count */
    card("D", ["Kayo Specialization", "Unlimited", "Heave 3"], 2),
    card("E", [], 4), null
  ]);
  assert.deepEqual(rows, [{k: "Go again", n: 5}, {k: "Opt", n: 6}, {k: "Heave", n: 2}, {k: "Ice Fusion", n: 1}]
    .sort((a, b) => (b.n - a.n) || (a.k.toLowerCase() < b.k.toLowerCase() ? -1 : 1)));
  /* CR 1.3: Legendary, Specialization and Unlimited are deck-building, not play */
  assert.ok(!rows.some(r => /legendary|specialization|unlimited/i.test(r.k)), "a deck-building keyword was shown (CR 1.3)");
  assert.deepEqual(C.deckKeywords([]), []);
});

test("crKeyword: exact beats tail, a tail is a whole word, alternatives are names, unknown is null", () => {
  const rows = [{r: "1", n: "Power"}, {r: "2", n: "Overpower"}, {r: "3", n: "Fusion"},
                {r: "4", n: "The Crowd Cheers / The Crowd Boos"}, {r: "5", n: "Pairs [with CARD]"},
                {r: "6", n: "Lightning Fusion"}];
  assert.equal(C.crKeyword("Overpower", rows).r, "2", "the exact name lost to a tail");
  assert.equal(C.crKeyword("overpower", rows).r, "2", "case matters");
  /* CR 8.3.17 writes it "[SUPERTYPES] Fusion"; the card index writes "Ice Fusion" */
  assert.equal(C.crKeyword("Ice Fusion", rows).r, "3", "CR 8.3.17's Fusion was not found from Ice Fusion");
  assert.equal(C.crKeyword("Lightning Fusion", rows).r, "6", "a longer exact name lost to the tail");
  assert.equal(C.crKeyword("The Crowd Boos", rows).r, "4");
  assert.equal(C.crKeyword("Pairs", rows).r, "5", "the bracketed argument is not part of the name");
  assert.equal(C.crKeyword("Superpower", rows), null, "a tail inside a word matched");
  assert.equal(C.crKeyword("Nonsense", rows), null);
  assert.equal(C.crKeyword("", rows), null);
});

test("the page loads data/crkw.js and reaches both readers through the bridge only", () => {
  const src = html();
  assert.ok(src.indexOf('<script src="data/crkw.js"></script>') > 0, "index.html does not load data/crkw.js");
  assert.match(src, /deckKeywords = DawnCards\.deckKeywords/);
  assert.match(src, /crKeyword = DawnCards\.crKeyword/);
  assert.ok(!/(const|function|let)\s+(deckKeywords|crKeyword)\b/.test(src), "index.html re-declares an engine reader");
  assert.match(src, /window\.DAWN_CRKW/, "the page no longer reads the pinned rows");
});
