/* ============================================================
   THE DAWNBLADE FORMAT (v4.76) — data/formats.json

   Dawnblade is a fan-made sub-format of Silver Age: the fifteen Chapter 1-3
   precons as printed, legal whatever Silver Age's rolling ban list or its
   seasonal hero bench says. These drills hold the file to that claim, and
   hold the Silver Age legality block (filled in later, from a desktop that
   can reach the official announcements) to naming real pool cards.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadData } = require("./helpers/extract");
const G = require("../engine/game");

const F = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "formats.json"), "utf8"));
const W = loadData();

/* every card name a Dawnblade match can deal, deck and gear, plus the heroes */
function poolNames(){
  const names = new Set();
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    if(d.hero) names.add(d.hero.name || d.hero);
    for(const e of d.deck) names.add(e.name);
    for(const e of d.gear) names.add(e.name);
  }
  return names;
}

test("the Dawnblade format fields exactly the fifteen heroes the game deals", () => {
  assert.equal(F.dawnblade.name, "Dawnblade");
  assert.deepEqual([...F.dawnblade.heroes].sort(), W.HEROES.map(h => h.k).sort(),
    "the format's hero list and the roster disagree");
  assert.deepEqual([...F.dawnblade.heroes].sort(), Object.keys(W.DECKS).sort());
});

test("Dawnblade's legality does not follow Silver Age's ban list", () => {
  /* the claim that makes it a format rather than a snapshot of Silver Age */
  assert.match(F.dawnblade.legality, /whatever Silver Age/);
  assert.ok(!("banned" in F.dawnblade) && !("benched" in F.dawnblade),
    "a ban list inside the format would make Dawnblade follow it");
});

/* `null` is "not yet recorded"; `[]` would claim nothing is banned. Until the
   desktop task lands, the pending marker must say where the work lives. */
test("the Silver Age block is either pending or a sourced list of real pool cards", () => {
  const sa = F.silverAge;
  const names = poolNames();
  assert.ok(names.size > 300, "the pool scan found almost nothing, so it cannot vouch for a name");
  if(sa.banned === null){
    assert.match(sa.pending, /DESKTOP-TASKS\.md/, "a pending block must name where the work lives");
    assert.ok(fs.existsSync(path.join(__dirname, "..", "DESKTOP-TASKS.md")));
  } else {
    assert.ok(Array.isArray(sa.banned) && sa.banned.length > 0,
      "an empty list claims nothing is banned — leave it null until it is recorded");
    for(const b of sa.banned){
      assert.ok(names.has(b.name), `"${b.name}" is not a card in any Dawnblade precon`);
      assert.match(String(b.since || ""), /^\d{4}-\d{2}-\d{2}$/, `${b.name} carries no effective date`);
      assert.ok(b.source, `${b.name} carries no source`);
    }
  }
  if(sa.benched !== null){
    assert.ok(Array.isArray(sa.benched));
    for(const h of sa.benched){
      assert.ok(F.dawnblade.heroes.includes(h.hero), `"${h.hero}" is not a Dawnblade hero key`);
      assert.ok(h.source, `${h.hero}'s bench carries no source`);
    }
  }
});

test("the pool scan can tell a real card from a typo", () => {
  /* the control for the check above: without it, a scan that returned every
     string would vouch for any name at all */
  const names = poolNames();
  assert.ok(names.has("Jack Be Quick"));
  assert.ok(!names.has("Jack Be Quik"));
});
