/* ============================================================
   tools/ledger.js IS NOT PROSE — it is graded.

   `tools/failstates.js` decides how bad a no-op keyword is partly from the
   keyword's LEDGER STATUS rather than from a grep (v3.00), so a stale entry
   is load-bearing in both directions:

     status too LOW   the tool scores a gap that was closed versions ago,
                      and a session spends a day rebuilding it
     status too HIGH  a drawback counts as built when half of it is not,
                      which is the one shape `partial` exists to prevent

   THREE ENTRIES WERE STALE WHEN THIS DRILL WAS WRITTEN, and only the first
   was found by a human:

     reload   `pending`    v3.69 — parser rule, op, arsEmpty gate and prompt
                           had all existed for versions
     charge   `pending`    v3.70 — fx.chargeCost, the charge site in
                           `execute`, hist.charged and the chargedPitchN
                           conditions; four cards read `full`
     surge    `unreviewed` v3.70 — a surgeOverN condition, read and
                           evaluated; corrected to `partial`, not `live`,
                           because the condition is approximated

   AND SIX MORE WERE STALE AT v3.99, all found by asking the engine rather
   than by reading the note:

     high tide  `unreviewed`  a GATED pitchBlueN condition, evaluated in
                              `execute`'s loop; all 6 records read `full`
     meld       `unreviewed`  v3.34 built the whole declaration — isSplit,
                              splitFx, splitCostsAP, and judge refuses
                              half:"both" without the keyword
     unity      `unreviewed`  v3.27 — both walls count their hand
                              defenders before either loop starts
     quickstrike, rupture     BUILT AT v3.99 (their gates were being eaten
                              by the loose pump matcher)
     cloaked    `unreviewed`  half built at v3.99 — the piece equips
                              face-down and the flip cost spends it; what
                              face-down means for defence and Ward is not
                              stated on the card, so `partial`

   v3.41's rule is "when you close a recorded gap, delete the record". Its
   twin, which has now cost NINE entries: WHEN A RECORD SAYS A THING IS
   UNBUILT, GO AND ASK THE ENGINE.

   THIS IS A LEDGER, NOT A HEURISTIC. A mention count is a signal and never
   a verdict (v3.00 says so in as many words — "Seismic Surge" appears only
   inside a refusal message, and the token's name is not the keyword). So
   the SET of unbuilt-claiming keywords is pinned: moving one is a
   deliberate edit, the same discipline as `wire.test.js`'s HEADLESS list
   and `test/sides.test.js`'s symmetry gap.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const L = require("../tools/ledger.js");
const KW = L.KEYWORDS || L.keywords || L;
const entries = Object.entries(KW).filter(([, v]) => v && typeof v === "object" && v.status);

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const engine = ["parser.js", "effects.js", "judge.js"]
  .map(f => strip(fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")))
  .join("\n");
const names = k => (engine.match(new RegExp(k.replace(/[^a-z0-9]/gi, "."), "gi")) || []).length;

/* The keywords whose status CLAIMS nothing is built. Pinned as a set. */
/* -piercing AT v4.20, DELIBERATELY. It sat in `KW_VOCAB_SRC` — so
   `printedKw` could answer for it — with NOTHING in the engine consuming
   it, and the ledger note said "seen in pool; needs CR wording". The
   database carries no reminder text for any keyword, but the AAZ010 face
   of Drill Shot prints the parenthetical it omits: "(If this is defended
   by an EQUIPMENT, this gets +N{p}.)" — sixth time reading the printed
   card has settled one. */
/* v4.21 MOVED THREE MORE, and two of them were STALE RATHER THAN BUILT
   BY THIS VERSION (v3.69: when a record says a thing is unbuilt, ask the
   engine). `ice fusion` and `lightning fusion` are PARTIAL — `fx.fusionCost`
   has parsed them and `execute` has settled `fused` for versions; what is
   approximated is the printed "you MAY reveal", which is auto-taken.
   `lightning flow` is LIVE: its prefix was being eaten, and stripping it
   lets the whole printed line read. `solflare` stays here as PENDING — a
   recorded refusal (v3.38) rather than an unreviewed one, because its
   payload reads and what it waits on is a trigger and a schedule. */
/* v4.22 MOVED `overpower` TO LIVE — the ninth time reading the printed
   card has settled a keyword the ledger called unreviewed. DYN229 carries
   the parenthetical the database omits: "(This can't be defended by more
   than 1 ACTION card.)" — so it is `parser.defCap`'s third source, and
   its counted set is neither sibling's. */
const UNBUILT = ["solflare", "steal"];

test("the ledger's unbuilt set is a LEDGER — moving one is a deliberate edit", () => {
  const claim = entries.filter(([, v]) => /pending|unreviewed/.test(v.status)).map(([k]) => k).sort();
  const pinned = UNBUILT.filter(k => KW[k]).sort();
  assert.deepEqual(claim, pinned,
    "a keyword entered or left the unbuilt set. If it was BUILT, move it to live/partial and " +
    "say so here — `failstates.js` grades severity from this status, so a stale entry scores a " +
    "closed gap (reload v3.69, charge and surge v3.70).");
});

test("a keyword marked LIVE is named by the engine", () => {
  /* The sound direction. A mention count cannot prove something IS built —
     the token "Seismic Surge" is not the keyword surge — but zero mentions
     with a `live` status is wrong however it is counted. */
  const dead = entries.filter(([k, v]) => v.status === "live" && names(k) === 0).map(([k]) => k);
  assert.deepEqual(dead, [],
    "these claim to be live and no engine file names them at all");
});

test("every ANSWERED ruling has a ledger entry that is not still pending", () => {
  /* `tools/rulings.json` and `tools/ledger.js` are two records of one fact.
     A ruling marked answered while its keyword still reads `pending` is the
     exact drift that hid reload and charge. */
  const rulings = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "tools", "rulings.json"), "utf8"));
  const bad = [];
  for(const [slug, r] of Object.entries(rulings)){
    if(!r || r.status !== "answered") continue;
    const e = KW[slug];
    if(e && /pending|unreviewed/.test(e.status)) bad.push(slug);
  }
  assert.deepEqual(bad, [],
    "answered in rulings.json and still unbuilt in the ledger — one of the two records is lying");
});

test("the ledger still describes every status the tools grade on", () => {
  /* A control: if a status string is renamed, `failstates.js`'s grading
     silently falls through. Pin the vocabulary. */
  const seen = [...new Set(entries.map(([, v]) => v.status))].sort();
  assert.deepEqual(seen,
    ["escaped", "inert-dummy", "info", "live", "partial", "pending", "unreviewed"].filter(
      s => seen.includes(s)).sort(),
    "an unknown status string means failstates.js is grading against a value it does not know");
});

/* ============================================================
   ONE SCAN, TWO CONSUMERS (v4.25)

   `failstates.js` grades a no-op keyword partly on how often the SOURCE
   names it, and v3.00 fixed that scan after finding it pointed at
   `index.html` — the file the card semantics left at v2.53. It fixed the
   ONE consumer it was looking at. `tools/sweep.js` kept its own copy,
   still reading the trainer alone, and passed that copy back INTO
   `FS.failStates` — so one grading function scored the same card two ways
   and the block CLAUDE.md tells a reader to act on was produced by the
   wrong one:

     npm run sweep          Boom Grenade · sev 3 · "it is a DRAWBACK"   (crank: 2 mentions)
     node tools/failstates  Boom Grenade · sev 1 · "the trainer names it" (crank: 16)

   UNFAIR therefore read 1 for four versions after crank was BUILT and
   drilled. v3.35's rule — when a census exists, grep for every consumer
   of it — and the no-mirror rule, inside a pair of tools.
   ============================================================ */

test("the source scan reads the ENGINE, not the file the semantics left", () => {
  const FS = require("../tools/failstates.js");
  const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const inIndex = kw => (idx.match(new RegExp("\\b" + kw.replace(/\s+/g, "\\s*") + "\\b", "gi")) || []).length;
  /* DRIVEN, AND WITH A CONTROL. `crank` is the worked example — 2 in the
     trainer, well over the tool's threshold of 3 across the engine — and
     `boost` proves the scan alive rather than merely large. */
  assert.ok(FS.sourceMentions("crank") > inIndex("crank"),
    "the scan is back to index.html alone: crank " + FS.sourceMentions("crank") +
    " vs " + inIndex("crank"));
  assert.ok(FS.sourceMentions("crank") >= 3,
    "a keyword this project has BUILT must clear the tool's own threshold");
  assert.ok(FS.sourceMentions("phantasm") >= 3 && FS.sourceMentions("watery grave") >= 3,
    "v3.00's own two examples still clear it");
});

test("the first-word fallback is OPT-IN, because a keyword's first word is not its name", () => {
  const FS = require("../tools/failstates.js");
  /* sweep.js added it for a TOKEN NAME — the trainer calls the Bloodrot
     Pox token plain "Bloodrot" — and folding it into the KEYWORD count
     moved a card on a lie: "Lightning Fusion" falls back to "lightning",
     which the engine says about a class, a talent and a token. Measured
     both ways before choosing (v3.33). */
  assert.equal(FS.sourceMentions("Lightning Fusion"), 0,
    "the keyword itself is genuinely unbuilt and the strict count says so");
  assert.ok(FS.sourceMentions("Lightning Fusion", {loose: true}) > 10,
    "and the loose one counts a CLASS — which is why it is not the default");
  assert.ok(FS.sourceMentions("Bloodrot Pox", {loose: true}) >
            FS.sourceMentions("Bloodrot Pox"),
    "while the token half is exactly what `loose` exists for");
});

test("`tools/sweep.js` grades on that one body and keeps no copy", () => {
  /* A SOURCE PIN, deliberately narrow: what must not come back is a
     SECOND scan in this file feeding the SAME grading function. The
     behaviour is driven above; this is the shape that let it drift. */
  const sw = fs.readFileSync(path.join(__dirname, "..", "tools", "sweep.js"), "utf8");
  assert.ok(/FS\.failStates\(A, RULINGS, FS\.sourceMentions\)/.test(sw),
    "sweep.js is passing its own counter into failStates again");
  assert.ok(/FS\.heroFailStates\(A, RULINGS, FS\.sourceMentions\)/.test(sw),
    "…and the hero half too — v3.98: pin BOTH halves or a drill sees one");
  assert.equal((sw.match(/readFileSync\([^)]*index\.html/g) || []).length, 0,
    "sweep.js reads index.html directly again — that is the copy that drifted");
});

