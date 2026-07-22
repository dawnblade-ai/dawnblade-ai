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
