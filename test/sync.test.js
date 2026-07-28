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
const MODULES = ["parser","game","rps","sides","priority","prompts","invariants","cards","advisor"];

for(const m of MODULES){
  test(`index.html loads engine/${m}.js`, () => {
    assert.ok(htmlSrc.includes(`<script src="engine/${m}.js"></script>`),
      `index.html must load engine/${m}.js with a plain script tag`);
  });
}

test("parser.js loads before the modules that depend on it", () => {
  const at = m => htmlSrc.indexOf(`<script src="engine/${m}.js"></script>`);
  for(const dep of ["advisor","cards","prompts"]){
    assert.ok(at("parser") < at(dep), `engine/parser.js must load before engine/${dep}.js`);
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
   DawnPriority.* and are deliberately NOT bridged wholesale. */
const BRIDGED = [...bridgeSrc.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*Dawn[A-Z]\w*\./g)].map(m => m[1]);

test("the bridge lifts a non-trivial set of names", () => {
  assert.ok(BRIDGED.length > 40, `bridge only lifts ${BRIDGED.length} names — did it get truncated?`);
});

test("every bridged name is really exported by its engine module", () => {
  const all = new Set(MODULES.flatMap(m => exportsOf(m + ".js")));
  const bogus = BRIDGED.filter(n => !all.has(n));
  assert.deepEqual(bogus, [], `bridged but not exported by any engine module: ${bogus.join(", ")}`);
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
