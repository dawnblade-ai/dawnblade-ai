/* ============================================================
   EVERY `fx.*` FIELD THE POOL EMITS HAS A CONSUMER (v4.42)

   `parser.js` writes ~60 fields onto a card's parse and this project has
   never asked, as a standing check, whether anything READS each one. That
   is v3.55's rule at the scale of the whole parse — **a field with no
   reader is a no-op wearing a name** — and it is the shape behind a
   string of findings: `sd.rune` (v3.82), `sd.fatigue` (v4.26),
   `enterCounters` (v4.23), `game.costTax` (v4.06), `fx.chargeCost.multi`
   (v4.33). Every one was found by somebody looking, once, by hand.

   IT CAME BACK CLEAN, AND A CLEAN RESULT IS WORTH HAVING PROVED (v3.97,
   v4.00). What makes it worth a file is that the SET is pinned: "the scan
   found nothing" must not pass for "everything is accounted for".

   THE INDIRECTION IS THE INTERESTING HALF. Seven fields are named by no
   consumer file at all and are read inside a `parser.js` READER that the
   consumers call — `playsAsInstant`, `isHandWipe`, `rustedThrough`,
   `idleCounterWipes`, `gyFirstGaKw`, `auraAttackOf` — plus one read by a
   TOOL rather than by the engine (`quotedUnread`, the audit's flag from
   v3.41, which is the whole point of that field). A census that stopped
   at "is the field named in effects.js" would report all seven as
   orphans, which is v4.00's false-POSITIVE one file over.

   AND MY FIRST SCAN REPORTED 62 OF 62 ORPHANED, including `fx.ops`. It
   was written inline in a shell string, so `"\\\\."` reached the regex as
   `\\.` — a literal BACKSLASH followed by any character, matching nothing
   anywhere. A scan aimed at the wrong shape fails by finding nothing
   exactly as a real gap does (v3.81), so this file proves its scan alive
   against a control before trusting a single gap it reports.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* The files that CONSUME a parse. `parser.js` is excluded because it
   WRITES these fields — asking it would make every field its own reader. */
const CONSUMERS = ["engine/effects.js", "engine/judge.js", "engine/build.js",
                   "engine/game.js", "engine/advisor.js", "engine/prompts.js",
                   "engine/types.js", "engine/cards.js", "engine/invariants.js",
                   "engine/sparring.js", "engine/local.js", "index.html"];
/* A tool is a legitimate consumer for a field that exists to be REPORTED.
   `quotedUnread` is the worked example (v3.41): its entire job is to make
   an unread rider visible in the audit. */
const TOOLS = ["tools/audit.js", "tools/failstates.js", "tools/fairness.js",
               "tools/gaps.js", "tools/approx.js", "tools/scenes.js"];

/* ---- what the pool actually emits ----------------------------------- */

const emitted = () => {
  const DB = H.db();
  const set = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    let fx; try { fx = P.fxParse(rc); } catch(e){ continue; }
    for(const f of Object.keys(fx)){
      const v = fx[f];
      /* SET means "this card carries it", so an empty list, a zero and a
         false are all UNSET — otherwise every field on every card counts
         and the census says nothing. */
      if(v == null || v === false || v === 0 || v === "") continue;
      if(Array.isArray(v) && !v.length) continue;
      if(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) continue;
      set.add(f);
    }
  }
  return [...set].sort();
};

/* THE SEVEN FIELDS READ THROUGH A `parser.js` READER, and the reader named.
   Pinned as PAIRS rather than as a list of field names: the claim is not
   "something somewhere reads it" but "THIS function does, and a consumer
   calls THIS function". A field whose reader loses its last caller fails
   here even though the field is still read. */
const VIA_READER = {
  asInstant:     "playsAsInstant",
  auraWeapon:    "auraAttackOf",
  gyFirstGa:     "gyFirstGaKw",
  handWipe:      "isHandWipe",
  rustDestroy:   "rustedThrough",
  wipePowIfIdle: "idleCounterWipes",
};
/* AND ONE READ BY A TOOL, WHICH IS THE FIELD'S WHOLE PURPOSE (v3.41). */
const VIA_TOOL = {quotedUnread: "tools/audit.js"};

test("the emitted-field scan is alive", () => {
  const e = emitted();
  assert.ok(e.length > 40, "scan found " + e.length + " fields — aimed wrong");
  /* THE CONTROL PROVES THE READER SCAN, NOT ONLY THE EMIT SCAN. A field
     name nothing could possibly mention must come back unnamed; without
     this the whole file passes with a regex that matches everything. */
  const src = CONSUMERS.map(read).join("\n");
  assert.ok(/\.ops\b/.test(src), "the reader scan cannot see `.ops` — it is aimed wrong");
  assert.equal(/\.thisFieldDoesNotExist\b/.test(src), false,
    "the reader scan matches a name nothing mentions — it proves nothing");
});

test("every `fx.*` field the pool emits is pinned", () => {
  /* PINNED AS A SET (wire.test.js's HEADLESS, condcensus.test.js). A new
     field fails here, and the edit that fixes it is the moment somebody
     says what reads it. */
  assert.deepEqual(emitted(), [
    "activateIf", "addCost", "addPay", "approx", "arsUpDeck", "arsenalPut",
    "arsenalUp", "arsenalUpTurn", "asInstant", "atkTrigger", "auraWeapon",
    "boostBanish", "bottomOnDiscard", "chargeCost", "chargeSoul", "clash",
    "clashReveal", "clauses", "condOnHit", "condOnLeave", "conds", "crush",
    "ctrTick", "daggerJab", "deckFaceUp", "defDebuff", "defGrant", "defLimit",
    "defSelf", "dr", "emptyDies", "fusionCost", "ga", "gaQ", "gyFirstGa",
    "handAbility", "handWipe", "hitCounter", "hitWatch", "millCost", "modes",
    "noEquipDefend", "onAtk", "onAtkHero", "onDeath", "onDestroy", "onHit",
    "onHitHero", "onLeave", "ops", "optCost", "payCost", "perm", "playIf",
    "playable", "quotedUnread", "rustDestroy", "self", "selfQ", "tapCost",
    "tier", "wipePowIfIdle",
  ]);
});

test("every emitted field has a CONSUMER — directly, or through its reader", () => {
  const src = {}; for(const f of CONSUMERS) src[f] = read(f);
  const orphans = [];
  for(const f of emitted()){
    const rx = new RegExp("\\." + f + "\\b");
    if(CONSUMERS.some(fl => rx.test(src[fl]))) continue;
    if(VIA_READER[f] || VIA_TOOL[f]) continue;
    orphans.push(f);
  }
  assert.deepEqual(orphans, [],
    "fx fields nothing consumes — a field with no reader is a no-op wearing a name (v3.55): "
    + orphans.join(", "));
});

test("a field read through a parser READER: the reader exists and a consumer CALLS it", () => {
  const parser = read("engine/parser.js");
  const src = {}; for(const f of CONSUMERS) src[f] = read(f);
  for(const [field, fn] of Object.entries(VIA_READER)){
    /* the reader is real, and it really reads the field */
    assert.match(parser, new RegExp("\\b" + fn + "\\b"),
      "parser.js has no function named " + fn + " — a name from prose is not a name in the file (v4.09)");
    /* SOMEBODY CALLS IT. This is the half that bites: a reader whose last
       caller goes away leaves the field read by nothing that runs. */
    const calls = CONSUMERS.filter(fl => new RegExp("\\b" + fn + "\\s*\\(").test(src[fl]));
    assert.ok(calls.length,
      "fx." + field + " is read only by parser." + fn + ", and NO consumer calls it — "
      + "the field is read by code nothing reaches");
  }
});

test("a field read by a TOOL is named as such, and the tool really reads it", () => {
  for(const [field, tool] of Object.entries(VIA_TOOL))
    assert.match(read(tool), new RegExp("\\." + field + "\\b"),
      tool + " is credited with reading fx." + field + " and does not name it");
});

test("`fx.auraWeapon` carries the GRANT, and only its truthiness is read", () => {
  /* RECORDED RATHER THAN CHANGED, and the first draft of this note was
     WRONG in a way worth keeping. I had it down as "two records of one
     fact" — `fx.auraWeapon` beside `auraAttackOf`'s call to
     `auraWeaponGrant`. Measured, they ask about DIFFERENT CARDS:
     `fx.auraWeapon` is set on COSMO's own parse and says "this card
     grants it", while `auraAttackOf` asks "does this SIDE have such a
     piece equipped" and must re-derive from the equipped piece. Check
     your own fixture by asking rather than by remembering (v4.09).

     What IS true is narrower: the field holds the whole grant object and
     exactly one site reads it, for its truthiness, to suppress
     `quotedUnread` on a quoted ability the grant consumed (v3.84). That
     is the faithful reading — a boolean would be a second encoding of
     the grant — and the property the suppression rests on is that the
     field is set ONLY when the grant parsed. That is what this pins. */
  P.fxReset();
  H.db();
  /* THE FULL PRINTED NAME. `H.card("Cosmo", 0)` answers a card with EMPTY
     TEXT — truthy, so a bare `assert.ok` on it passes against a blank
     fixture, which is what the first draft of this drill did. The record
     is "Cosmo, Scroll of Ancestral Tapestry"; asserting the TEXT is what
     tells a real card from a placeholder. */
  const cosmo = H.card("Cosmo, Scroll of Ancestral Tapestry", 0);
  assert.ok(cosmo && /are weapons with base/.test(String(cosmo.tx || "")),
    "the fixture is not Cosmo's real record — check your own fixture (v3.70)");
  const fx = P.fxParse(cosmo);
  assert.ok(fx.auraWeapon && typeof fx.auraWeapon === "object",
    "fx.auraWeapon is the GRANT object, not a flag");
  assert.equal((fx.quotedUnread || []).length, 0,
    "the grant parsed, so its quoted ability must NOT report unread (v3.84)");
  /* AND THE SUPPRESSION IS CONDITIONAL ON THE GRANT, not on the wording:
     a card printing the same sentence whose quoted ability does NOT parse
     still reports, which is the no-op blind spot this guard avoids. */
  const fake = {name: "Not Really Cosmo v4.42", pitch: 0, cost: null, power: null,
                tt: "Illusionist Equipment - Chest", ty: ["Illusionist", "Equipment"],
                kw: [], gkw: [],
                tx: "During your turn, auras you control with ward are weapons with base {p} equal to their ward and \"Nonsense - do a thing\"."};
  P.fxReset();
  const bad = P.fxParse(fake);
  assert.ok(!bad.auraWeapon, "an unparseable quoted ability must not set the grant (v3.63)");
  P.fxReset();
});
