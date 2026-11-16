/* test/staged.test.js — THE STAGED CARDS (data/staged.js)

   RULING (user, 2026-11-15): new Silver Age precons join Dawnblade as they
   are built, and their text is pinned now from the-fab-cube's unmerged
   branch. `tools/pin-staged.js` writes that text to `data/staged.js`, which
   the page does not load: the cards wait there while their readers are
   built, and move into `data/pool.js` the day their hero opens.

   These drills hold the file to what the plan needs from it, offline:
   every row of both lists resolves BY ITS PRINT CODE, both faces of a
   two-faced card are there, every token the text names exists, a card the
   pool already holds reads the same in both files, and the phone never
   sees any of it.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const C = require("../engine/cards.js");
const { html, readCards, readPool } = require("./helpers/extract.js");
const { tokenNames } = require("../tools/pin-pool.js");
const ST = require("../tools/pin-staged.js");

const ROOT = path.join(__dirname, "..");
const NEW = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "newsets.json"), "utf8"));
const LISTS = Object.keys(NEW).filter(k => NEW[k] && NEW[k].set && NEW[k].sections);
const staged = () => readCards(ST.OUT).filter(c => c && c.name);
const dbOf = recs => C.buildMaps(recs.map(C.mapDbCard));
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* how many rows of the lists a database resolves to a card that CARRIES the row's print code */
function resolvedRows(db){
  let rows = 0, ok = 0; const miss = [];
  for(const k of LISTS) for(const o of Object.values(NEW[k].sections)) for(const r of o.rows){
    rows++;
    const c = C.resolveEntry(db, {name: r.name, p: 0, code: r.code, q: r.q});
    if(c.resolved && (db.byCode[r.code] || {}).n && norm(db.byCode[r.code].n) === norm(c.dbName || c.name)
       || (c.resolved && (db.byName[norm(r.name)] || []).some(x => x.pr[r.code]))) ok++;
    else miss.push(r.code + " " + r.name);
  }
  return {rows, ok, miss};
}

test("every row of both new lists resolves from the staged cards, by its own print code", () => {
  assert.deepEqual(LISTS.sort(), ["prism", "viseraiBetweenWorlds"], "the set of staged lists moved");
  const got = resolvedRows(dbOf(staged()));
  assert.ok(got.rows > 60, "the walk found almost no rows");
  assert.deepEqual(got.miss, [], "list rows the staged cards cannot deal");

  /* THE CONTROL: the pool alone must NOT resolve them, or this drill would
     pass with an empty staged file. */
  const bare = resolvedRows(dbOf(readPool().filter(c => c && c.name)));
  assert.ok(bare.miss.length > 30, "the pinned pool already resolves the new lists — the control is dead");
});

test("the staged sets are exactly the lists' sets, and nothing else rides along but tokens", () => {
  const sets = new Set(ST.stagedSets(NEW));
  assert.deepEqual([...sets].sort(), ["SAT", "SBW"]);
  for(const r of staged()){
    const inSet = (r.printings || []).some(p => sets.has(p.set_id));
    assert.ok(inSet || /token/i.test(r.type_text || ""), r.name + " is staged and belongs to no staged set");
  }
});

test("a two-faced card is staged with both faces", () => {
  /* The faces share a print code, which is how the tool reaches the back. */
  const byCode = {};
  for(const r of staged()) for(const p of (r.printings || []))
    if(/^(SAT|SBW)\d{3}$/.test(p.id || "")) (byCode[p.id] = byCode[p.id] || new Set()).add(r.name);
  const two = Object.entries(byCode).filter(([, n]) => n.size > 1).map(([id, n]) => id + ": " + [...n].sort().join(" / "));
  assert.deepEqual(two.sort(), [
    "SAT023: Figment of Hope / Suraya, Archangel of Endless Hope",
    "SBW001: Viserai, Between Worlds / Viserai, Usurper",
  ], "the set of two-faced staged cards moved");
});

test("every token the staged text names is a record the engine can find", () => {
  const recs = staged();
  const have = new Set([...recs, ...readPool()].filter(c => c && c.name).map(c => norm(c.name)));
  const named = [...tokenNames(recs)];
  assert.ok(named.length >= 3, "the token scan found almost nothing in the staged text");
  const tokenRecs = new Set([...recs, ...readPool()].filter(c => c && /token/i.test(c.type_text || "")).map(c => norm(c.name)));
  for(const n of ["runechant", "spectral shield"]){
    assert.ok(named.includes(n), "the staged text no longer names " + n);
    assert.ok(tokenRecs.has(n) && have.has(n), n + " is named and is not a token record");
  }
  /* THE GATE'S WHOLE NAME (v6.41). Until reader 5 the scan read "Gate to
     i'Arathael token" as "arathael": the name has a lowercase connective and
     a word that opens with a lowercase letter and an apostrophe. The record
     the scan names must be the token record, or a re-pin would go looking
     for a card called "arathael". */
  assert.ok(tokenRecs.has("gate to i arathael"), "the Gate token is not staged");
  assert.ok(named.includes("gate to i arathael"), "the token scan lost the Gate's whole name");
  assert.ok(!named.includes("arathael"), "the token scan reads the Gate's name as its last word again");
});

test("a card the pool already holds reads the same staged as pinned", () => {
  /* TWO FILES MUST NOT DISAGREE ABOUT ONE CARD. Printings may differ (the
     staged record carries the new set's print); nothing the engine reads may. */
  const pool = new Map(readPool().filter(c => c && c.unique_id).map(c => [c.unique_id, c]));
  const strip = r => { const m = {...C.mapDbCard(r)}; delete m.pr; delete m.prs; delete m.img;
    return JSON.stringify(m) + "\n" + (r.functional_text || ""); };   /* the mapped card AND the raw printed text */
  let shared = 0; const bad = [];
  for(const r of staged()){
    const p = pool.get(r.unique_id);
    if(!p) continue;
    shared++;
    if(strip(r) !== strip(p)) bad.push(r.name + "|" + (r.pitch || 0));
  }
  assert.ok(shared >= 10, "no staged card is shared with the pool — the comparison compared nothing");
  assert.deepEqual(bad, [], "staged and pinned disagree about a card");
  /* the control: the comparison sees a changed text */
  const r0 = staged().find(r => pool.has(r.unique_id));
  assert.notEqual(strip({...r0, functional_text: (r0.functional_text || "") + " Draw a card.", functional_text_plain: (r0.functional_text_plain || "") + " Draw a card."}), strip(pool.get(r0.unique_id)));
});

test("the phone does not load the staged cards, and the file says where it came from", () => {
  assert.ok(!/staged\.js/.test(html()), "index.html loads or names data/staged.js");
  const src = fs.readFileSync(ST.OUT, "utf8");
  assert.ok(!/DAWN_POOL/.test(src), "the staged file writes the pool's global");
  assert.match(ST.SOURCE.commit, /^[0-9a-f]{40}$/, "the source is a commit, not a branch name");
  assert.ok(src.includes(ST.SOURCE.commit), "the file's header does not name its source commit");
  assert.equal((NEW.staged || {}).commit, ST.SOURCE.commit, "data/newsets.json records a different source than the tool pins");
});
