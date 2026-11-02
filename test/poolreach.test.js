/* THE PAGE PLAYS THE PINNED POOL, SO THE POOL MUST HOLD THE WHOLE GAME (v5.75).

   RULING (user, 2026-11-02), "pinned pool only": `index.html` loads
   `data/pool.js` by `<script src>` and fetches no card database. Before
   this, a card the pin had missed was a drill gap and the phone still
   found it upstream. Now a missing record is a card the PHONE cannot
   play — so what the page asks for is checked against what the pool
   holds, by running the PAGE'S OWN loader code, not a Node retelling of
   it: the slice of index.html that builds NEEDED and maps the pool is
   evaluated here against the pinned records.

   It asks three things:
     1. every name the page resolves — each hero, deck card and piece of
        gear, the dummy's pile and gear, and the cards effects mint at
        runtime — is a record in the pool;
     2. the page keeps EVERY pool record (its keep-filter and pin-pool's
        agree, so nothing the drills read is invisible to the phone);
     3. the page carries no live-database fetch at all.

   UNGATED: it needs no network and no cache, which is the point. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("vm");
const P = require("../engine/parser");
const G = require("../engine/game");
const C = require("../engine/cards");
const { html, loadData, readPool } = require("./helpers/extract");

const W = loadData();

/* The page's loader, verbatim: from the deck parse through loadPool. No
   JSX lives in this span (asserted), so it runs as plain script. */
function pageLoader(pool){
  const src = html();
  const a = src.indexOf("const PARSED = {};");
  const b = src.indexOf("function useCardDB(){");
  assert.ok(a > 0 && b > a, "the loader span moved — re-anchor this drill");
  const span = src.slice(a, b);
  assert.ok(!/<[A-Z][A-Za-z]*[\s/>]/.test(span), "JSX inside the loader span");
  const ctx = {
    HEROES: W.HEROES, DECKS: W.DECKS, DUMMY_GEAR: W.DUMMY_GEAR, DUMMY_DECK: W.DUMMY_DECK,
    parseDeck: G.parseDeck, norm: P.norm, toNum: C.toNum,
    window: {DAWN_POOL: pool},
  };
  vm.createContext(ctx);
  vm.runInContext(span + "\n;this.__out = {NEEDED, loadPool};", ctx);
  return ctx.__out;
}

test("every card the page resolves is a record in the pinned pool", () => {
  const pool = readPool();
  const { NEEDED } = pageLoader(pool);
  /* NEEDED also carries the FRONT face of a two-faced name ("Burn Up" for
     "Burn Up // Shock") — the resolver's fallback key, not a record name. */
  const have = new Set(pool.flatMap(r => [P.norm(r.name),
    ...(r.name.includes("//") ? [P.norm(r.name.split("//")[0])] : [])]));

  /* The page's NEEDED must cover what this drill derives independently,
     or a sabotaged NEEDED would pass by asking for less. */
  const derived = new Set();
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    derived.add(P.norm(d.hero.name));
    for(const e of [...d.gear, ...d.deck]) derived.add(P.norm(e.name));
  }
  W.DUMMY_GEAR.forEach(n => derived.add(P.norm(n)));
  W.DUMMY_DECK.forEach(([n]) => derived.add(P.norm(n)));
  for(const n of derived) assert.ok(NEEDED.has(n), "the page no longer asks for " + n);
  assert.ok(NEEDED.has(P.norm("Crouching Tiger")) && NEEDED.has(P.norm("Inner Chi")),
    "the runtime-minted cards left NEEDED");

  const missing = [...NEEDED].filter(n => !have.has(n));
  assert.deepEqual(missing, [], "the page asks for cards the pinned pool does not hold — "
    + "the phone cannot play them; re-pin (node tools/pin-pool.js)");

  /* Every hero portrait resolves through the same maps the page builds. */
  const db = pageLoader(pool).loadPool();
  for(const h of W.HEROES)
    assert.ok(C.resolveHero(db, {name: h.n, code: h.code}), "no hero record for " + h.n);
});

test("the page keeps every pool record, and the tokens and demi-heroes with them", () => {
  const pool = readPool();
  const db = pageLoader(pool).loadPool();
  assert.equal(db.status, "ready");
  assert.equal(db.count, pool.length,
    "the page's keep-filter drops records pin-pool kept — the drills read cards the phone cannot see");
  const types = r => (r.types || []).join(" ");
  const toks = pool.filter(r => /token/i.test(types(r)));
  const demis = pool.filter(r => (r.types || []).some(t => /^demi-hero$/i.test(t)));
  assert.ok(toks.length > 0 && demis.length > 0, "the pool lost its tokens or demi-heroes");
  for(const r of [...toks, ...demis])
    assert.ok(db.byName[P.norm(r.name)], "the page cannot see " + r.name);
});

test("a pool that did not load is an error, not an empty game", () => {
  const { loadPool } = pageLoader(undefined);
  assert.throws(() => loadPool(), /did not load/);
});

test("the page fetches no card database", () => {
  const src = html();
  assert.ok(!/raw\.githubusercontent\.com/.test(src), "index.html names the upstream host");
  assert.ok(!/\bDBSRC\b/.test(src), "index.html still carries DBSRC");
  assert.ok(!/dbcache_"\s*\+\s*DATA_VER/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "index.html still reads or writes the localStorage card cache");
  const tags = [...src.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(t => !/^https?:/.test(t));
  assert.equal(tags[0], "data/pool.js", "the pool must load before every engine script");
});
