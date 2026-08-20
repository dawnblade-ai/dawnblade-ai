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

/* ============================================================
   THE HERO'S OWN SET IS AN ORACLE ON THE DECK LIST (v3.13)

   A wrong card of the RIGHT COUNT is invisible to every check above: the
   deck still sums to 55, the hero line is there, the gear is there. That
   is exactly how Enigma Chimera sat in Enigma's list at pitch 2 — a
   printing the Silver Age Enigma set never made — displacing the two blue
   copies it prints at SEN021. **Reported by a player checking fabrary.**

   There is a partial oracle in the data, though, and it is worth having:
   each hero's Silver Age set IS essentially their precon. So a card the
   deck lists at a pitch the hero's own set never printed is a red flag,
   and a card the set prints that the deck never lists is the other half.

   PARTIAL, and stated as such: a precon legitimately contains shared
   cards printed in OTHER Silver Age sets (Nullrune, Blade Beckoner), so
   this can only speak about cards the hero's own set printed. It is not a
   substitute for the printed product — see CLAUDE.md — but it would have
   caught this one on the day it was written.
   ============================================================ */
{
  const fs = require("fs");
  const path = require("path");
  const C = require("../engine/cards");
  const CACHE = require("./helpers/extract").cardDbPath();
  const haveDb = fs.existsSync(CACHE);
  const skip = !haveDb && "no cached DB — run: node tools/audit.js";

  const pn = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
  let _db = null, _bySet = null;
  const load = () => {
    if(_bySet) return;
    const raw = JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name);
    _db = C.buildMaps(raw.map(C.mapDbCard));
    _bySet = {};
    for(const r of raw) for(const p of (r.printings || [])){
      const m = (p.id || "").match(/^([A-Z]{3})\d/);
      if(!m) continue;
      (_bySet[m[1]] = _bySet[m[1]] || []).push(
        {name: r.name, pitch: pn(r.pitch), id: p.id, types: r.types || []});
    }
  };
  const entries = k => { const d = G.parseDeck(W.DECKS[k]); return [...d.deck, ...d.gear]; };
  const setOf = h => (h.code || "").slice(0, 3);

  test("deck lists — no card sits at a pitch its hero's own set never printed", {skip}, () => {
    load();
    const flags = [];
    let compared = 0;
    for(const h of W.HEROES){
      const list = _bySet[setOf(h)] || [];
      for(const e of entries(h.k)){
        const p = pn(C.resolveEntry(_db, e).pitch);
        const inSet = list.filter(x => x.name === e.name);
        if(!inSet.length) continue;                 /* shared card from another set */
        compared++;
        if(inSet.some(x => x.pitch === p)) continue;
        flags.push(`${h.k}: ${e.name} at pitch ${p} — ${setOf(h)} prints only `
                 + [...new Set(inSet.map(x => x.pitch))].join("/"));
      }
    }
    /* A CHECK THAT EXAMINES NOTHING ALSO REPORTS ZERO. Assert the work. */
    assert.ok(compared > 400, `only ${compared} entries compared — the oracle went dark`);
    assert.deepEqual(flags, [], "deck-list entries contradicting their own set:\n" + flags.join("\n"));
  });

  test("deck lists — the only set cards absent from a deck are the two minted at runtime", {skip}, () => {
    load();
    const missing = [];
    for(const h of W.HEROES){
      const list = _bySet[setOf(h)] || [];
      const have = new Set(entries(h.k).map(e => e.name + "|" + pn(C.resolveEntry(_db, e).pitch)));
      for(const x of new Map(list.map(x => [x.name + "|" + x.pitch, x])).values()){
        if(have.has(x.name + "|" + x.pitch)) continue;
        if(/Hero|Token/i.test((x.types || []).join(" "))) continue;
        missing.push(x.name);
      }
    }
    /* Crouching Tiger (banished, playable that turn) and Inner Chi
       (transcend) are real database records created DURING PLAY — both are
       in the loader's NEEDED list precisely because no deck lists them.
       Anything else here is a card the precon has and we do not. */
    assert.deepEqual([...new Set(missing)].sort(), ["Crouching Tiger", "Inner Chi"],
      "a set card missing from its own deck:\n" + missing.join("\n"));
  });
}
