/* ============================================================
   THE CARD DATABASE IS SOMEBODY ELSE'S `develop` BRANCH.

   The golden rule of this project is that card text STREAMS at runtime
   from the public Flesh and Blood database and is read by the parser —
   never invented, never hardcoded. That is right, and it has a price
   nobody had priced: every anchored regex in `parser.js` is a hostage to
   an upstream editor's wording, and the game fetches that wording live.

   It has already been collected. Between v2.84 and v3.00 upstream ran an
   editorial pass — "it" to "this", "its owner's deck" to "your deck",
   `instead` moved to the front of its clause — and 22 pool cards
   silently stopped resolving. No tool here reported it:

     * `npm run audit` measures COVERAGE and printed the new, lower
       number without comparing it to anything;
     * `npm run fairness` is deliberately one-sided toward cards that are
       STRONGER than printed, and a card that stops being read is weaker;
     * `npm test` was green, because the 22MB database is gitignored and
       every drill that needs a card SKIPPED.

   So this file is the one place allowed to look at the live wire. It
   reads both databases and compares WHAT THE PARSER MAKES OF EACH, not
   the text — the text is upstream's to edit, and a rewording the parser
   reads identically is not an event. It fails only when a rewording
   costs a card, and it names the card, both texts and the tier it fell
   to, because "22 cards regressed" is not actionable and "Reincarnate:
   full to none, `its owner's deck` is now `your deck`" is.

   IT SKIPS WITHOUT A LIVE COPY, and that is not the hole it was before:
   the suite no longer skips anything for want of a database, so a skip
   here means "nobody fetched", not "nobody checked". Fetch with
   `node tools/audit.js --refresh`, and re-pin with `node
   tools/pin-pool.js` once the parser reads both wordings.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const P = require("../engine/parser");
const C = require("../engine/cards");
const G = require("../engine/game");
const { loadData, cardDbPath, hasLiveDb, liveDbPath } = require("./helpers/extract");

const skip = !hasLiveDb() && "no live database — run: node tools/audit.js --refresh";

const W = loadData();
const RANK = {none: 0, part: 1, full: 2};
const load = p => C.buildMaps(JSON.parse(fs.readFileSync(p, "utf8"))
  .filter(c => c && c.name).map(C.mapDbCard));

/* Every entry the pool actually plays, resolved the way the game resolves
   it — `resolveEntry`, not the raw record, because pitch normalises on
   resolution and a raw key mismatches about 12 cards a hero. */
function poolEntries(){
  const out = [];
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    for(const e of [...d.deck, ...d.gear]) out.push({hero: k, e});
  }
  return out;
}

test("no upstream rewording has cost a card its reading", {skip}, () => {
  const pinned = load(cardDbPath()), live = load(liveDbPath());
  const seen = new Set(), lost = [];

  for(const {hero, e} of poolEntries()){
    const a = C.resolveEntry(pinned, e), b = C.resolveEntry(live, e);
    const key = P.norm(a.name) + "|" + (a.pitch || 0);
    if(seen.has(key)) continue;
    seen.add(key);
    if(!b.resolved){ lost.push({key, why: "the card is GONE from the live database"}); continue; }

    /* fxParse memoizes on `name|pitch`, so the two readings would collide
       in one cache and the drill would compare a card with itself.

       CLEAR THE MEMO — never rename the card to dodge it. `fxParse`
       rewrites a card's OWN NAME to "this" before reading a clause
       ("Sigil of Suffering gains +1{d}"), so a fixture with a decorated
       name loses that rewrite and reads worse for a reason the card does
       not have. Written that way first, this drill reported 27 cards
       broken that were fine. */
    P.fxReset(); const ta = P.fxParse(a).tier;
    P.fxReset(); const tb = P.fxParse(b).tier;
    P.fxReset();
    if(RANK[tb] < RANK[ta])
      lost.push({key, hero, why: ta + " -> " + tb,
                 pin: P.clean(a.tx || ""), now: P.clean(b.tx || "")});
  }

  assert.deepEqual(lost, [], lost.length + " card(s) read worse on the live database than on "
    + "the pinned pool — upstream reworded them and the parser's anchors no longer match. Teach "
    + "the parser BOTH wordings (a warm localStorage cache still holds the old text, so the two "
    + "populations coexist), then re-pin with `node tools/pin-pool.js`:" + "\n"
    + lost.map(l => "  " + l.key + "  " + l.why
        + (l.pin ? "\n" + "      pinned: " + l.pin + "\n" + "      live:   " + l.now : "")).join("\n"));
});

/* A DECK IS NOT THE POOL. Written to walk deck entries only, this file
   would have reported the v3.00 rewording as 22 cards — and the same pass
   rewrote SEVEN of the fifteen hero abilities and EIGHT tokens, including
   Dorinthea's, which stopped being recognised at all, and Briar's, which
   gained a per-turn reset that is a rules change rather than a rewording.
   None of those is a deck entry, so none of them was in the census.

   Heroes are read by RECOGNIZERS in `build.js` rather than by `fxParse`,
   so the question here is not a tier: it is whether every passive that
   was found on the pinned text is still found on the live text. A hero
   ability that stops being recognised is a hero that quietly stops
   working, which is what happened. */
test("no upstream rewording has cost a hero its passive", {skip}, () => {
  const pinned = load(cardDbPath()), live = load(liveDbPath());
  const RNG = require("../engine/rng");
  const B = require("../engine/build");
  const lost = [];
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    const of = db => {
      P.fxReset();
      return B.buildSideDefault(h, G.parseDeck(W.DECKS[h.k]), db, RNG.make("drift"), {n: 0}).b;
    };
    const a = of(pinned), b = of(live);
    for(const k of B.PASSIVES){
      /* only a passive that WAS on counts — this asks what was lost, not
         what upstream may have granted. */
      if(a[k] && !b[k]) lost.push(h.k + ": " + k);
    }
  }
  assert.deepEqual(lost, [], "hero passive(s) no longer recognised on the live database — the "
    + "printed ability was reworded and `build.js`'s recognizer still reads only the old "
    + "wording. Teach it both, then re-pin:\n  " + lost.join("\n  "));
});

/* TOKENS ARE CARDS AND THEY DRIFTED TOO — Inertia's "destroy Inertia"
   became "destroy this", which took the token from `full` to `none`. They
   are resolved out of the pool's own text rather than listed, the same
   way `pin-pool.js` and the audit find them, so a token nobody has named
   yet is still covered the day a card creates it. */
test("no upstream rewording has cost a token its reading", {skip}, () => {
  const pinned = load(cardDbPath()), live = load(liveDbPath());
  const {tokenNames} = require("../tools/pin-pool.js");
  const texts = [];
  for(const {e} of poolEntries()){
    const c = C.resolveEntry(pinned, e);
    if(c.resolved) texts.push({functional_text: c.tx || ""});
  }
  const lost = [];
  for(const t of tokenNames(texts)){
    const a = C.resolveEntry(pinned, {name: t, p: 0, code: null, q: 1});
    const b = C.resolveEntry(live,   {name: t, p: 0, code: null, q: 1});
    if(!a.resolved) continue;                 /* not a real token name */
    if(!b.resolved){ lost.push(t + ": GONE from the live database"); continue; }
    P.fxReset(); const ta = P.fxParse(a).tier;
    P.fxReset(); const tb = P.fxParse(b).tier;
    P.fxReset();
    if(RANK[tb] < RANK[ta]) lost.push(t + ": " + ta + " -> " + tb);
  }
  assert.deepEqual(lost, [], "token(s) read worse on the live database:\n  " + lost.join("\n  "));
});

/* THE SLIMMING IS NOT TAKEN ON TRUST. `pin-pool.js` drops the fields of a
   printing that `mapDbCard` does not read — even after that, 58% of the
   file is image URLs. If it ever drops one the engine DOES read, every
   drill in the suite would measure a subtly different card and agree
   with itself about it, which is the failure mode the pin exists to end.
   So assert the two map to the same card, field for field. */
test("the pinned pool maps to the same cards the live database does", {skip}, () => {
  const pinned = load(cardDbPath()), live = load(liveDbPath());
  const bad = [];
  for(const {e} of poolEntries()){
    const a = C.resolveEntry(pinned, e), b = C.resolveEntry(live, e);
    if(!b.resolved) continue;                 /* the other drill's business */
    /* `tx` is upstream's to edit and is compared above; everything else is
       structure the slimming could have broken. */
    const strip = c => { const o = {...c}; delete o.tx; return JSON.stringify(o); };
    if(strip(a) !== strip(b)) bad.push(a.name + "|" + (a.pitch || 0));
  }
  assert.deepEqual([...new Set(bad)], [],
    "the pinned pool no longer resolves to the same card as the live database — either "
    + "`pin-pool.js` is dropping a field `mapDbCard` reads, or upstream changed more than text. "
    + "Re-pin and review the diff.");
});
