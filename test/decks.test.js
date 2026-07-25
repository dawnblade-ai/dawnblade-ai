/* Deck integrity — validation ritual #2, formalized:
   exactly 15 decks, each summing to exactly 55 cards, every deck with a
   hero line and a gear loadout, roster keys matching HEROES. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadData } = require("./helpers/extract");
const G = require("../engine/game");

const W = loadData();

test("data script exposes the versioned constants", () => {
  assert.match(W.APP_VER, /^\d+\.\d+$/);
  assert.match(W.DATA_VER, /^sage-v\d+$/);
  assert.equal(W.DUMMY_GEAR.length, 4);
});

test("roster — exactly 15 heroes across chapters 1-3", () => {
  assert.equal(W.HEROES.length, 15);
  for(const ch of [1,2,3])
    assert.equal(W.HEROES.filter(h=>h.ch===ch).length, 5, `chapter ${ch} should field 5 heroes`);
});

test("DECKS — exactly 15, keys matching the roster", () => {
  const keys = Object.keys(W.DECKS);
  assert.equal(keys.length, 15);
  assert.deepEqual(keys.sort(), W.HEROES.map(h=>h.k).sort());
});

for(const h of Object.keys((() => W.DECKS)() )){
  test(`deck ${h} — hero line, gear, and exactly 55 cards`, () => {
    const d = G.parseDeck(W.DECKS[h]);
    assert.ok(d.hero, "missing H| hero line");
    assert.ok(d.gear.length > 0, "missing G| gear lines");
    // the 55 counts deck cards + the gear loadout (hero card excluded)
    const n = d.deck.reduce((a,e)=>a+e.q, 0) + d.gear.length;
    assert.equal(n, 55, `${h} sums to ${n}, want 55`);
  });
}

/* ---- v2.05: the dummy's own pile ----------------------------------
   The dummy blocks from hand now. Its deck is deliberately built from
   Generic attack actions with NO rules text, so its cards need zero
   parser support — nothing about the dummy is faked. Guard both facts. */
test("dummy deck — 30 cards, every entry resolvable", () => {
  const W = loadData();
  assert.ok(Array.isArray(W.DUMMY_DECK), "DUMMY_DECK is exported to window");
  const total = W.DUMMY_DECK.reduce((a,[,,q]) => a + q, 0);
  assert.equal(total, 30, "the dummy pitches from a 30-card pile");
  for(const [nm,p,q] of W.DUMMY_DECK){
    assert.equal(typeof nm, "string");
    assert.ok(p >= 1 && p <= 3, `${nm} has a real pitch value`);
    assert.ok(q >= 1, `${nm} has at least one copy`);
  }
});

test("dummy deck — the dummy draws to intellect", () => {
  const W = loadData();
  assert.equal(W.DUMMY_INT, 4, "four cards in hand, like any hero");
  const total = W.DUMMY_DECK.reduce((a,[,,q]) => a + q, 0);
  assert.ok(total > W.DUMMY_INT * 4, "deep enough to spar for several turns before recycling");
});
