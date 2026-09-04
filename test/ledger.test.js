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
const UNBUILT = ["crank", "ice fusion", "lightning flow", "lightning fusion",
  "overpower", "piercing", "solflare", "steal"];

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
