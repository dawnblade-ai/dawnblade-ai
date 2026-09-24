/* ============================================================
   A SPEC ONLY CARRIES FIELDS `prompts.js` READS (v4.42)

   CLAUDE.md states this rule in SIX places and nothing enforced it:

     "A prompt spec only carries fields `buildPrompt` knows about.
      `arsStamp` had to be added there explicitly; until it was, the
      Bracers' +1 was silently dropped."                        — v2.34

   It has cost a real defect five more times since — `taps` (v3.33), `by`
   (v3.28), `faceUp` (v3.69), `lateGa` (v3.93), `spendCtr` (v4.24) — and
   v3.53 found the same rule broken at the CONSUMER end, where `moveFoe`
   carried `{from, to}` for four versions while `applyAnswer` moved hand
   to deck-top whatever it was told. **The sheet opened, the right card
   was offered, the feed said it moved, and nothing moved.**

   SO THE CENSUS IS DRIVEN, NOT GREPPED. Every field that reaches
   `prompts.js` in real games is collected and held to being NAMED there.
   A source scan over the queue sites would report the fields somebody
   WROTE; this reports the fields that arrive.

   IT CAME BACK CLEAN over 32 legs of real Flesh and Blood — 35 fields,
   all named — and a clean result is worth having PROVED (v3.97, v4.00).
   (That was the v4.42 reading. The count is a PIN rather than a constant:
   `drive` names it and the first drill asserts it, so re-derive it from
   there rather than from this sentence — v4.17.)

   THE SET IS SAMPLE-DEPENDENT, AND THAT IS HANDLED RATHER THAN IGNORED.
   Sixteen legs reach 32 fields and thirty-two reach 35, so a pin taken
   off "some games" is a pin on a sample (v4.40, one census over). The
   tournament is a PURE FUNCTION of the card database and its seeds
   (v4.39) — nothing in `leg` draws from a random stream — so this drives
   an exact, named set of legs and the 35 is reproducible. Verified twice.

   AND THE FIRST RUN REPORTED ZERO FIELDS. `T.leg` was handed `{key: name}`
   rather than the tool's own entrants, and it answers `threw: true`
   instead of raising — so the census found nothing and looked exactly
   like a feature that does not exist (v3.81). The leg count and the
   throw count are both asserted now.

   AND THE SCANS READ THE DOCUMENTATION (v4.44). Every naming scan here
   ran over the RAW source, comments included — which is v4.27's own
   defect (`failstates.js` counting a keyword named in a comment) inside
   a drill. It cost this file's sharpest claim: `ANSWER_READS` held
   `optional` on the strength of two comments using the ordinary English
   word, and `applyPrompt` reads no such field. **A member that is in the
   set for a comment's sake can never LEAVE it**, so the one thing this
   drill exists to catch — v3.53's consumer that stopped obeying its spec
   — was unwatchable for that field.

   MEASURED BOTH WAYS (v3.33) BEFORE CHANGING IT: the file scan and
   `buildPrompt`'s are UNCHANGED — all 35 fields are named in CODE, with
   the body going 21,830 chars to 5,546 — so both clean results get
   strictly stronger. Only `applyPrompt`'s set moves, losing exactly the
   two comment-only members.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

/* PATCHED BEFORE `tournament.js` IS REQUIRED, because `effects.js`
   DESTRUCTURES `buildPrompt` at require time (`const {buildPrompt, …} =
   PR`). Patch it afterwards and that copy is the original — the census
   then reports only judge's own call site and silently misses the whole
   card-resolution path. */
const PM = require("../engine/prompts.js");
const reached = new Set();
const realBuild = PM.buildPrompt;
PM.buildPrompt = function(game, spec){
  if(spec && typeof spec === "object")
    for(const k of Object.keys(spec)) reached.add(k);
  return realBuild.apply(this, arguments);
};
const T = require("../tools/tournament.js");

const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "engine/prompts.js"), "utf8");
/* CODE ONLY. A census of what a function READS must not count what a
   comment MENTIONS (v4.27) — and `//` is stripped at line start only,
   because a `https://` in a citation is not a comment (v4.27 again). */
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const PROMPTS = stripComments(RAW);

/* The ring is each entrant against the next and against the fourth along,
   with the seed naming the pairing, plus one leg named in `drive` for the
   row it keeps. Deterministic, ~1.5s. The COUNT is asserted by the first
   drill; do not restate it here (v4.17).

   WHAT 32 LEGS REACH IS A MEASUREMENT, AND ONE SPEC SITE IS OUTSIDE IT.
   The tags that arrive are pay 52 · pick 78 · soak 51 · opt 23 · modal 3,
   and CRANK's own `pay` spec (v4.24, Dash's Hyper Driver) is reached by
   NONE of them — a sabotage planted there came back SILENT, which is a
   fact about what the legs reach rather than a weak drill (v3.62, v4.34:
   when a sabotage is silent, ask which half of the guard your fixture
   reaches). So this census speaks for the sites these games drive, and a
   field added at an unreached site is invisible to it. Recorded rather
   than papered over; the honest widening is more legs, not a looser
   claim. */
let legs = 0, threw = 0;
/* THE FIELDS `applyPrompt` READS — derived once and pinned, because a
   field leaving this set is a consumer that stopped obeying its spec
   (v3.53). The rest are the sheet's alone: a title, a hint, a stamp that
   rides onto the card the answer moves. */
const ANSWER_READS = ["amount", "by", "cards", "cost", "destroyUid", "elseOps",
                      "filter", "max", "min", "ops", "options",
                      "side", "spendCtr", "src", "tag", "tapHero", "tapUid", "taps",
                      "to", "zone"];
/* -optional v4.44: it was here for two comments' sake and nothing reads it. */
/* +spendCtr v4.48: THE REACH LIMIT v4.42 RECORDED IS DISCHARGED. That
   version's one silent sabotage named crank's own `pay` prompt as a spec
   site "32 legs never reach", and wrote down that the honest widening is
   MORE LEGS rather than a looser claim. The legs did widen — not by adding
   any, but because v4.48 corrected three attacks from a flat +1 to a
   printed multiplier, so the policy's own power arithmetic changed and the
   same 32 deterministic legs now play a different game. A sample-dependent
   census moving when the ENGINE moves is the property, not a fault. */

const drive = () => {
  if(legs) return;
  const E = T.ENTRANTS;
  for(let i = 0; i < E.length; i++)
    for(const j of [(i + 1) % E.length, (i + 4) % E.length]){
      if(i === j) continue;
      const r = T.leg(E[i], E[j], "spec-" + i + "-" + j, 0);
      legs++; if(r && r.threw) threw++;
    }
  /* THE 33rd LEG IS NAMED, AND IT IS THE ANSWER TO A ROW THIS CENSUS LOST
     (v4.58). The colour-gate fix stopped Blaze Headlong gaining a free
     action point off its own play, so `sparring.act` plays a different game
     and the ring above stopped reaching a `ctrPut` sheet with two or more
     candidates — `ctrStamp` LEFT the set.

     The wrong answer is to drop it from the pin. A CENSUS THAT LOSES A ROW
     READS EXACTLY LIKE ONE WITH NOTHING TO REPORT (v3.81, v4.07), and
     v4.44's `optional` is the worked example from the other side: a member
     that cannot leave the set can never be watched leaving it, so v3.53's
     consumer-stopped-obeying was unwatchable for that field. v4.42 recorded
     this file's own answer when a field is unreached — *the honest widening
     is MORE LEGS, not a looser claim* — and v4.48 discharged its reach limit
     in the other direction, by the engine moving. This is the same rule with
     the sign flipped.

     MEASURED rather than guessed: every pairing outside the ring was driven
     and Enigma v Dash is the first that reaches it (Re-Charge! is Dash's).
     It brings NO other field with it, which is why the pinned set below is
     unchanged at 38 — a widening that moved the pin would be a fixture
     change wearing a fix's clothes. */
  { const r = T.leg(E[8], E[3], "spec-8-3", 0); legs++; if(r && r.threw) threw++; }
  /* AND THE 34th IS THE SAME RULE A SECOND TIME (v4.59). Generalising the
     activation-pick legality means Fai's hero ability is refused when his
     graveyard holds no Phoenix Flame — three resources and his once-per-turn
     were being spent on a sheet that skipped itself — so he plays a
     different game and the ring's own Fai legs stopped reaching Flamecall
     Awakening's deck search. `shuffleAfter` LEFT the set, exactly as
     `ctrStamp` did one version ago and for the same kind of reason: the
     ENGINE moved, and this census is sample-dependent by construction.

     MORE LEGS, NOT A LOOSER CLAIM (v4.42, v4.58). Measured: nine pairings
     outside the ring reach it and Iyslander v Fai is the first; every field
     it brings is already pinned, so the set below is unchanged at 38 and
     only the leg count moves. A widening that moved the pin would be a
     fixture change wearing a fix's clothes. */
  { const r = T.leg(E[1], E[7], "spec-1-7", 0); legs++; if(r && r.threw) threw++; }
};

/* BOUND A FUNCTION AT THE NEXT SAME-LEVEL DECLARATION, NEVER AT A CHAR
   COUNT (v4.05). The first draft of this file sliced `buildPrompt` as
   `indexOf(...) + 9000` and reported EIGHT fields the sheet "ignores" —
   every one of them an artefact of the cut, because the real body is
   17,519 characters. A bound that is too narrow invents findings exactly
   as one that is too wide hides them. */
const fnBody = name => {
  const i0 = PROMPTS.indexOf("function " + name);
  if(i0 < 0) return null;
  const rest = PROMPTS.slice(i0 + 1);
  const m = rest.match(/\n(?:function |const [A-Za-z_$][\w$]*\s*=)/);
  return PROMPTS.slice(i0, i0 + 1 + (m ? m.index : rest.length));
};

test("the driven census is alive — the legs really ran", () => {
  drive();
  assert.equal(legs, 34, "the leg count moved; the pinned field set is taken at 34 "
    + "(32 in the ring, plus the two named legs that keep `ctrStamp` and "
    + "`shuffleAfter` in it — see `drive`)");
  assert.equal(threw, 0,
    "a leg threw — `leg` reports that as `threw: true` rather than raising, so a "
    + "census built on it reports ZERO exactly as a missing feature does (v3.81)");
  assert.ok(reached.size > 20, "only " + reached.size + " spec fields arrived — aimed wrong");
});

test("every spec field that reaches prompts.js is pinned", () => {
  drive();
  assert.deepEqual([...reached].sort(), [
    "amount", "arsStamp", "avail", "banStamp", "by", "cards", "charge", "cost", "costRider",
    "ctrHeld", "ctrSpend", "ctrStamp", "destroyUid", "elseOps", "equipStamp",
    "faceUp", "filter", "hint", "jab", "lateGa", "max", "min", "moveFoe", "n",
    "ops", "optional", "options", "playThisTurn", "shuffleAfter", "side", "spendCtr",
    "src", "tag", "tapHero", "tapUid", "taps", "title", "to", "zone",
  /* +charge v4.64 — Roaring Beam's charge made as an EFFECT, and it arrived
     on the same 34 legs with no leg written, so Boltyn really does play it
     into an empty soul in a driven game: the route is not latent. */
  /* +shuffleAfter v4.58 — Flamecall Awakening's deck search, and THIS
     CENSUS IS WHERE ITS LIVENESS WAS FIRST PROVED. The field arrived on the
     same 32 deterministic legs with no new leg written, which means Fai
     really does search his deck in a driven game rather than the route
     being latent. It is `shuffleDraw`'s SIBLING, not a widening: it draws
     nothing and it fires whether or not a card was taken. */
  /* +avail +spendCtr v4.48, AND NEITHER IS A NEW QUEUE SITE. The set is
     sample-dependent — this file's own header says so — and v4.48 changed
     what three attacks are WORTH, from a flat +1 to the printed multiplier,
     so the same 32 deterministic legs play a different game and reach two
     more sheets. `spendCtr` is crank's (v4.24) and `avail` is a `pay`
     spec's; both were already read by `prompts.js`, which is what the two
     assertions below then confirm. v4.42 recorded `spendCtr` as a REACH
     LIMIT of this fixture and said the honest widening is more legs — this
     is that limit closing, by the engine moving rather than the claim
     loosening. */
  ], "the set of spec fields reaching prompts.js moved — a NEW one is the v2.34 "
   + "defect waiting to happen, and one LEAVING is a queue site that stopped saying it");
});

test("every field that arrives is NAMED in prompts.js", () => {
  drive();
  const unread = [...reached].filter(k => !new RegExp("\\b" + k + "\\b").test(PROMPTS)).sort();
  assert.deepEqual(unread, [],
    "spec fields prompts.js never names — they are silently dropped, which is v2.34's "
    + "`arsStamp` and v3.33's `taps`: " + unread.join(", "));
});

test("the scan is proved alive against a control", () => {
  /* A NAMING SCAN THAT MATCHES EVERYTHING PASSES BY FINDING NOTHING
     (v3.81, v4.00). A field name nothing could mention must come back
     unnamed, or the drill above proves only that the regex works. */
  assert.equal(/\bthisSpecFieldDoesNotExist\b/.test(PROMPTS), false);
  assert.ok(/\barsStamp\b/.test(PROMPTS), "the scan cannot see arsStamp — it is aimed wrong");
  /* AND THE STRIPPER IS PROVED ALIVE THROUGH THE CENSUS, not beside it
     (v4.32): the control word is built by CONCATENATION, because written
     as a literal it would appear in this very file and only prompts.js is
     scanned — so it is the STRIPPED SOURCE that must not contain it while
     the raw source does. */
  const marker = "optional" + " " + "cost can be modelled";
  assert.ok(RAW.includes(marker), "the control phrase left prompts.js — pick another");
  assert.equal(PROMPTS.includes(marker), false,
    "stripComments did not remove a block comment, so every scan here is reading prose");
  assert.ok(PROMPTS.length < RAW.length / 2,
    "the stripped source is barely smaller than the raw one — the stripper is aimed wrong");
});

test("`buildPrompt` itself names EVERY field that arrives", () => {
  drive();
  /* THE RULE, STATED EXACTLY AS CLAUDE.md STATES IT: "a spec only carries
     fields `buildPrompt` knows about." Bounded properly, that is true of
     all 35 — there is no half the sheet ignores, which is a stronger
     result than the one this drill's first draft reported. */
  const body = fnBody("buildPrompt");
  assert.ok(body && body.length > 4000,
    "buildPrompt's body came out " + (body ? body.length : 0) + " chars — the bound is wrong, "
    + "and a bound that is too narrow INVENTS findings (v4.05). The figure is CODE ONLY "
    + "(5,546 of 21,830 raw), because a scan that counts comments reports a field as read "
    + "when a sentence merely mentions it (v4.27)");
  const unread = [...reached].filter(k => !new RegExp("\\b" + k + "\\b").test(body)).sort();
  assert.deepEqual(unread, [],
    "spec fields `buildPrompt` never names — v2.34's `arsStamp`, silently dropped: "
    + unread.join(", "));
});

test("the fields that ride to the ANSWER are read there too", () => {
  drive();
  /* v3.53 FOUND THIS RULE BROKEN AT THE CONSUMER END: `moveFoe` carried
     `{from, to}` for four versions while `applyAnswer` moved hand to
     deck-top whatever it was told — the sheet opened, the right card was
     offered, the feed said it moved, and NOTHING MOVED. So the fields
     `applyPrompt` names are pinned, and a field leaving that set is a
     consumer that stopped obeying its spec. */
  const tail = fnBody("applyPrompt");
  assert.ok(tail && tail.length > 2000, "applyPrompt's body came out wrong — check the bound");
  const inAnswer = [...reached].filter(k => new RegExp("\\b" + k + "\\b").test(tail)).sort();
  assert.deepEqual(inAnswer, ANSWER_READS,
    "the set of spec fields `applyPrompt` reads moved — say which step reads it now");
  assert.ok(inAnswer.length && inAnswer.length < reached.size,
    "applyPrompt reads SOME of them and not all — a set of 0 or of everything means "
    + "the bound is wrong rather than the engine");
});
