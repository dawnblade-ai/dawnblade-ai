/* ============================================================
   THE SCENES, AS DRILLS.

   `tools/scenes/*.js` holds the scenes; `tools/scenes.js` prints the report
   and this file runs the same objects as drills. ONE COPY, TWO READERS —
   a report and a drill that drift are worse than either alone, and this
   repo has the scar to prove it (v2.20 deleted 51 duplicated definitions a
   text-comparison guard had been holding in step by hand).

   WHY THE SUITE NEEDED THIS. Every other tool here answers a question about
   TEXT: the audit asks whether a clause was read, the fairness sweep
   whether the reading is too generous, `failstates.js` whether unread text
   is dangerous. `npm run play` watches behaviour and reads no card text by
   contract. Nothing drove a card and checked what happened — and six live
   defects went through that hole in seven releases, FIVE of them in cards
   the audit called `full`. See FINISH.md §0.

   EACH SCENE CARRIES ITS OWN `why`, naming the defect it exists for, so the
   next reader can re-sabotage it rather than trusting that it once bit.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../tools/scenes/runner.js");

const skip = !R.hasDb() && "no cached card database";

/* One drill per scene, named as the report names it, so a CI failure says
   which HERO is broken rather than which line of a helper threw. */
for(const scene of R.load()){
  test("scene · " + scene.hero + " · " + scene.name, {skip}, () => {
    const res = R.runOne(scene, R.ctx());
    assert.equal(res.threw, undefined,
      "the scene threw rather than observing: " + res.threw);
    for(const c of res.checks)
      assert.deepEqual(c.have, c.want,
        c.k + "\n\n     why this scene exists: " + scene.why + "\n");
  });
}

test("every scene observes at least two things, and checks all of them", {skip}, () => {
  /* A scene with one observation is usually asserting that something did
     not crash. And an observation the scene RETURNED and never named in
     `want` is a scene that measured something and then said nothing about
     it — the runner already reports that as a failure; this states it as a
     rule so a new scene cannot arrive that way. */
  const thin = [];
  for(const s of R.load()){
    const n = Object.keys(s.want || {}).length;
    if(n < 2) thin.push(s.hero + " · " + s.name + " (" + n + ")");
  }
  assert.deepEqual(thin, []);
});

test("every scene says WHY it exists", {skip}, () => {
  /* The `why` is not documentation, it is the re-sabotage instruction. A
     scene whose defect nobody recorded is a scene the next reader cannot
     tell from a tautology. */
  const mute = R.load().filter(s => !s.why || s.why.length < 40)
    .map(s => s.hero + " · " + s.name);
  assert.deepEqual(mute, []);
});

test("the scene files are named for the hero they are about", {skip}, () => {
  /* The hero comes from the FILENAME, so a scene cannot claim to be about a
     hero whose file it is not in — which is what makes "does Azalea work"
     answerable by reading one line of the report. */
  const fs = require("fs"), path = require("path");
  const dir = path.join(__dirname, "..", "tools", "scenes");
  const {loadData} = require("./helpers/extract.js");
  const heroes = new Set(loadData().HEROES.map(h => h.k));
  const bad = fs.readdirSync(dir)
    .filter(f => /\.js$/.test(f) && f !== "runner.js")
    .map(f => f.replace(/\.js$/, ""))
    .filter(k => !heroes.has(k));
  assert.deepEqual(bad, [],
    "a scene file must be named for a hero in the pool");
});
