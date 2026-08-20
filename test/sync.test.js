/* THE NO-MIRROR GUARD (v2.20).

   Until v2.20 every shared function existed TWICE — once in engine/ and
   once copy-pasted into index.html — and this file asserted the two copies
   were textually identical. That guard did real work (it caught boardRed
   drifting) but it only ever covered the names someone remembered to list,
   which is how makeSide and freshHist ended up mirrored and unguarded.

   index.html now LOADS engine/*.js with plain <script> tags, so there is
   one copy of each function and drift is impossible by construction. This
   file guards the opposite property: that no engine export has been
   re-declared inside index.html, and that every module is loaded and
   bridged. Re-introducing a local copy would silently SHADOW the engine —
   that is the failure mode this replaces. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ROOT, html } = require("./helpers/extract");

const htmlSrc = html();
const BABEL = '<script type="text/babel"';

/* Load order matters only in that parser.js must precede its dependents
   (advisor, cards and prompts each take it as their factory argument). */
/* `sparring` and `local` joined in v2.79, which is the same edit that
   emptied test/wire.test.js's HEADLESS list. The policy stayed off the
   page for as long as nothing called it — a thing that proposes actions
   sitting beside a trainer with its own dummy is a second quiet engine —
   and `local.js` is what calls it. */
const MODULES = ["rng","parser","game","types","rps","sides","priority","prompts","invariants","cards","advisor","build",
                 "effects","report","wire","net","judge","sparring","local","lobby","room"];

for(const m of MODULES){
  test(`index.html loads engine/${m}.js`, () => {
    assert.ok(htmlSrc.includes(`<script src="engine/${m}.js"></script>`),
      `index.html must load engine/${m}.js with a plain script tag`);
  });
}

/* EVERY MODULE LOADS AFTER THE MODULES IT TAKES AS FACTORY ARGUMENTS, and
   the list of those is READ OFF THE SOURCE rather than written here.

   It used to be the hardcoded triple ["advisor","cards","prompts"] against
   parser alone, which was true when it was written and silently stopped
   being the whole truth: v2.83 gave advisor.js a second dependency
   (priority.js, for `canDeclareDefenders` — the alternative was a sixth
   hand-rolled copy of a CR rule). A hardcoded ledger cannot fail for a
   dependency nobody remembered to add to it, which is the same shape as
   the old mirror rule missing `makeSide` and `freshHist`.

   The browser branch of each UMD header names its globals in order, so
   that line IS the dependency list. A module loaded before something it
   destructures at factory time throws a TypeError on page load — and the
   page is blank, which is the failure this repo can least afford to ship. */
const DEPS = (() => {
  const out = {};
  for(const m of MODULES){
    const src = fs.readFileSync(path.join(ROOT, "engine", m + ".js"), "utf8");
    const line = src.match(/else\s+root\.\w+\s*=\s*factory\(([\s\S]*?)\);/);
    out[m] = line ? [...line[1].matchAll(/root\.Dawn(\w+)/g)].map(x => x[1].toLowerCase()) : [];
  }
  return out;
})();

test("every engine module loads after the modules it takes as arguments", () => {
  const at = m => htmlSrc.indexOf(`<script src="engine/${m}.js"></script>`);
  /* The census must not pass by finding nothing: if the header shape ever
     changes, every list comes back empty and this drill goes quiet. */
  const total = Object.values(DEPS).reduce((a, d) => a + d.length, 0);
  assert.ok(total >= 20, `only ${total} factory dependencies parsed — the UMD header shape moved, repoint this drill`);
  assert.ok(DEPS.advisor.includes("parser") && DEPS.advisor.includes("priority"),
    "advisor.js takes parser and priority — if that changed, it was a deliberate edit");
  for(const [m, deps] of Object.entries(DEPS))
    for(const d of deps){
      if(!MODULES.includes(d)) continue;   /* a module the page does not load is wire.test.js's business */
      assert.ok(at(d) >= 0 && at(d) < at(m),
        `engine/${d}.js must load before engine/${m}.js — it is a factory argument of it`);
    }
});

/* The engine scripts must load AFTER the plain data script, because
   cards.js is handed window.CDN by the bridge. */
test("the engine loads after the data script that window.CDN lives in", () => {
  assert.ok(htmlSrc.indexOf("window.CDN =") < htmlSrc.indexOf('<script src="engine/parser.js">'),
    "window.CDN must be defined before the bridge calls DawnCards.setCDN");
});

function exportsOf(file){
  const src = fs.readFileSync(path.join(ROOT, "engine", file), "utf8");
  const m = src.match(/\nreturn \{([\s\S]*?)\n?\};\n\}\);/);
  if(!m) throw new Error("no export block in engine/" + file);
  return m[1].replace(/\/\*[\s\S]*?\*\//g, "")
             .split(/[,\s]+/).map(s => s.split(":")[0].trim()).filter(Boolean);
}

/* The bridge itself declares these names on purpose; everything after it
   is the trainer, and that is where a re-declaration would be a bug. */
const bridgeStart = htmlSrc.indexOf("DawnCards.setCDN(window.CDN);");
const bridgeSrc   = htmlSrc.slice(bridgeStart, htmlSrc.indexOf(BABEL));
const trainerSrc  = htmlSrc.slice(htmlSrc.indexOf(BABEL));

/* Only the names the bridge actually lifts can be shadowed, so that is the
   set to guard. sides.js and priority.js are reached as DawnSides.* /
   DawnPriority.* and are deliberately NOT bridged wholesale.

   The bridge may ALIAS: `rngShuffle = DawnRNG.shuffle` is deliberate,
   because a bare global `shuffle` already means DawnGame's unseeded one
   and bare `make`/`next`/`int` would be indefensibly generic. So capture
   both halves — the LOCAL name (what can be shadowed) and the MEMBER
   (what must really exist on the module). */
const BRIDGE_PAIRS = [...bridgeSrc.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*(Dawn[A-Z]\w*)\.([A-Za-z_$][\w$]*)/g)]
  .map(m => ({local: m[1], mod: m[2], member: m[3]}));
const BRIDGED = BRIDGE_PAIRS.map(p => p.local);

test("the bridge lifts a non-trivial set of names", () => {
  assert.ok(BRIDGED.length > 40, `bridge only lifts ${BRIDGED.length} names — did it get truncated?`);
});

/* The failure this catches is a typo'd or removed member: the bridge
   would quietly lift `undefined` and the trainer would die far away from
   the cause. Checking the MEMBER (not the alias) is what makes that real. */
test("every bridged member is really exported by its engine module", () => {
  const all = new Set(MODULES.flatMap(m => exportsOf(m + ".js")));
  const bogus = BRIDGE_PAIRS.filter(p => !all.has(p.member))
                            .map(p => p.local + " = " + p.mod + "." + p.member);
  assert.deepEqual(bogus, [], `bridged from a member no engine module exports: ${bogus.join(", ")}`);
});

/* The real guard: a bridged name must not be re-declared in the trainer.
   A local `const fxParse = …` would shadow the bridged one and we would be
   back to two copies with nothing watching them. */
test("the trainer does not re-declare (shadow) any bridged engine name", () => {
  const dupes = BRIDGED.filter(n =>
    new RegExp("^\\s*(?:const|let|var|function)\\s+" + n + "\\b", "m").test(trainerSrc));
  assert.deepEqual(dupes, [], `re-declared in index.html, shadowing the engine: ${dupes.join(", ")}`);
});

/* COLLISION WATCH — pinned, and moving it must be a deliberate edit.

   These engine exports share a name with something the trainer declares
   for itself, with DIFFERENT semantics. Today that is harmless: the
   trainer calls its own by the bare name and would reach the engine's as
   DawnPriority.endTurn, so they never meet. It stops being harmless the
   moment engine/priority.js is wired into Battle (roadmap item 1, step 4),
   because `endTurn` is exactly one of the functions that wiring replaces.
   Rename at that point; do not bridge these silently.

     trainer `endTurn` (Battle)   — a setG reducer that ends YOUR turn in the UI
     engine  `endTurn` (priority) — pure: fizzles resources, passes the seat, ticks
     trainer `other`   (DeckView) — the off-pitch cards in a deck listing
     engine  `other`   (priority) — i => i === 0 ? 1 : 0, the OTHER seat

   RESOLVED in v2.24 — `you` is off this list. engine/sides.js exported a
   seat-hardcoded `you`/`foe` pair that nothing called; introducing the
   trainer's actor-relative `foe` would have made `foe` a collision with
   DIFFERENT semantics (engine: sides[1]; trainer: sides[1-actor]), which is
   the dangerous kind rather than the harmless kind. Both engine helpers were
   deleted instead of pinned, so the collision surface SHRANK. Keep it that
   way: prefer deleting a dead engine export over adding a name here. */
const KNOWN_COLLISIONS = ["endTurn", "other"];

test("engine/trainer name collisions are exactly the pinned set", () => {
  const engineOnly = new Set(["sides","priority"].flatMap(m => exportsOf(m + ".js")));
  const found = [...engineOnly].filter(n =>
    !BRIDGED.includes(n) &&
    new RegExp("^\\s*(?:const|let|var|function)\\s+" + n + "\\b", "m").test(trainerSrc)).sort();
  assert.deepEqual(found, [...KNOWN_COLLISIONS].sort(),
    "a new engine/trainer name collision appeared (or one was resolved) — " +
    "update KNOWN_COLLISIONS deliberately, and see the note above before wiring priority.js");
});

/* Every bare name the babel blocks call must actually be bridged onto a
   global, or the page dies at runtime with a ReferenceError that no other
   drill would catch. */
test("the bridge lifts every engine export the trainer calls by bare name", () => {
  assert.ok(bridgeStart > 0, "bridge script not found");
  const declaredLocally = n =>
    new RegExp("^\\s*(?:const|let|var|function)\\s+" + n + "\\b", "m").test(trainerSrc);
  const missing = [];
  for(const m of MODULES){
    for(const n of exportsOf(m + ".js")){
      if(BRIDGED.includes(n) || declaredLocally(n)) continue;
      /* a bare call to a name that is neither bridged nor local is a
         ReferenceError waiting to happen at runtime */
      if(new RegExp("[^.\\w]" + n + "\\s*\\(").test(trainerSrc)) missing.push(n);
    }
  }
  assert.deepEqual(missing, [], `called bare in index.html but never bridged: ${missing.join(", ")}`);
});

/* ============================================================
   THE NO-MIRROR RULE, APPLIED TO THE DRILLS (v2.80)

   `engine/effects.js` is the one copy of the card semantics, and
   `judge.effectsFor` is the one context a player's cards actually run
   in. A drill file that builds its OWN context is a second description
   of that context sitting where nothing watches it — the same shape the
   sync guard exists to prevent one layer down, and it had already
   drifted: five files still passed `dummyDefence` and `built`, neither
   of which has been in `CTX_KEYS` since v2.73 / v2.77, while stubbing
   `mkRune`, `openPrompt` and `winCheck` to `s => s` and `had6ThisTurn`
   to a constant `false`.

   A stub is not a lie when the stub IS the subject. Three files are
   sanctioned, and each measures the seam rather than a card:

     effects.test.js  the CTX_KEYS contract — it must hand over an
                      INCOMPLETE context to prove makeEffects refuses one
     merge.test.js    that a shallow clone into effects leaves the
                      caller's state untouched
     mirror.test.js   the trainer's own mirror path, which is Battle's
                      context and not judge's

   Everything else goes through `test/helpers/judged.js`. Adding a file
   here must be a deliberate edit, with a reason of the same kind.
   ============================================================ */
const SEAM_FILES = ["effects.test.js", "merge.test.js", "mirror.test.js"];

test("no drill builds its own effects context outside the sanctioned seam files", () => {
  const dir = __dirname;
  const rogue = fs.readdirSync(dir)
    .filter(f => f.endsWith(".test.js") && SEAM_FILES.indexOf(f) < 0)
    /* MATCH THE PROPERTY FORM, which is the only form anyone uses:
       `E.makeEffects({…})`. Written first as `[^.\w]makeEffects\(` —
       borrowed from the bare-name guard above, where excluding a property
       access is right — it excluded every call it existed to catch, and
       the sabotage that re-grew a context in a drill file passed. A
       source guard aimed at the wrong SHAPE passes by finding nothing,
       exactly as one aimed at the wrong file does. */
    .filter(f => /makeEffects\s*\(/.test(
      fs.readFileSync(path.join(dir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
  assert.deepEqual(rogue, [],
    "these files hand-roll an effects context. Use test/helpers/judged.js, which goes " +
    "through judge.withEffects — a context a drill wrote is not the one a player gets, " +
    "and every one of the five gate files was asserting against a stub that had gone stale.");
});

/* The other half, or the guard above is satisfied by a file that reaches
   effects.js through some third door instead. */
test("the five gate drills reach the semantics through judge", () => {
  const GATE = ["kayo.test.js", "dorinthea.test.js", "frostbite.test.js",
                "arcane.test.js", "paytoll.test.js"];
  for(const f of GATE){
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    assert.match(src, /require\("\.\/helpers\/judged\.js"\)/,
      f + " must reach the card semantics through judge's own context");
    assert.match(src, /J\.reduce\(/,
      f + " must drive the REDUCER — `Battle` retires only once these five prove the " +
      "semantics about the path a player takes, not about a context a test wrote");
  }
});
