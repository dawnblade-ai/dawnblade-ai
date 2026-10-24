/* ============================================================
   "PLAY THIS ONLY IF …" IS A LEGALITY ON BOTH BOARDS (v4.90)

   > "Play this only if you've pitched a card with 6 or more {p} this turn."
   >                                                   — BEAR HUG ×3, Kayo's
   > "Play this only if you've discarded a card with 6 or more {p} this turn."
   >                                                   — RUN ROUGHSHOD, Kayo's
   > "Play this only if a yellow card has been put into your soul this turn."
   >                                                — DUTY BOUND BLITZ, Boltyn's

   `fx.playIf` was answered by a closure inside the trainer's `Battle` and
   nowhere else, so at the table all five records were playable against
   their own first line (sev-3), and the self-play ladder has played them
   that way. The closure also:

   - hardcoded 6, where both regexes captured the printed number and threw
     it away (v3.32 — the pool prints 6 on both, so only a synthetic sees it);
   - asked whether ANY yellow card was in the soul, dropping "this turn";
   - answered TRUE for a kind it did not know.

   `effects.playIfOk` is the one evaluator, and `had6ThisTurn` the one body
   both contexts hand `execute` (two hand-written copies before).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const PM = require("../engine/prompts");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* seat 0 in its action phase, holding `card`, with `side` laid over */
function holding(card, side, o){
  return Object.assign(H.state(Object.assign({res: 9, ap: 1, hand: [{...card, uid: "UT"}]}, side || {}),
                               {hp: 20, hand: []}, Object.assign({turn: 5, actor: 0}, o || {})),
    {phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null});
}
const playWhy = g => J.legal(g, {t: "play", uid: "UT", from: "hand"}, 0);

test("Bear Hug waits for a 6-power card in the pitch zone — at the TABLE", {skip}, () => {
  H.db();
  const bear = H.card("Bear Hug", 1);
  assert.match(String(playWhy(holding(bear))), /can't be played — you haven't pitched a card with 6 or more power this turn/,
    "the table plays Bear Hug against its printed first line again");
  const six = {...H.card("Raging Onslaught", 1), uid: "p1"};
  assert.ok(P.zonePow(six, null) >= 6, "fixture: a 6+ power card");
  assert.equal(playWhy(holding(bear, {pitch: [six]})), null, "a 6-power card pitched opens it");
  /* the near-miss: a pitched card under the threshold */
  const small = {...H.card("Wounding Blow", 3), uid: "p2"};
  assert.ok(P.zonePow(small, null) < 6, "fixture: under 6");
  assert.match(String(playWhy(holding(bear, {pitch: [small]}))), /can't be played/);
});

test("the THRESHOLD is read, never a hardcoded 6", {skip}, () => {
  /* SYNTHETIC (v3.73): both pool cards print 6 */
  P.fxReset();
  const eight = {name: "Synthetic Eight Hug", pitch: 1, cost: 0, power: 4, tt: "Generic Action - Attack",
                 ty: ["Generic", "Action", "Attack"], kw: [],
                 tx: "Play this only if you've pitched a card with 8 or more {p} this turn."};
  const at = pitched => ({turn: 5, actor: 0, sides: [{pitch: pitched}, {}], builds: [{}, {}]});
  const p7 = {name: "Seven", power: 7, tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  const p8 = {name: "Eight", power: 8, tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  assert.equal(E.playIfOk(at([p7]), eight), false, "a 7 opened an 8 — the number was hardcoded");
  assert.equal(E.playIfOk(at([p8]), eight), true);
  P.fxReset();
});

test("Run Roughshod waits for a real DISCARD this turn", {skip}, () => {
  H.db();
  const rr = H.card("Run Roughshod");
  const big = {...H.card("Raging Onslaught", 1), uid: "g1"};
  assert.match(String(playWhy(holding(rr))), /you haven't discarded a card with 6 or more power this turn/);
  assert.equal(playWhy(holding(rr, {grave: [{...big, _gy: 5, _disc: true}]})), null);
  /* an attack reaches the graveyard at declaration: no `_disc`, no discard */
  assert.match(String(playWhy(holding(rr, {grave: [{...big, _gy: 5}]}))), /can't be played/);
  assert.match(String(playWhy(holding(rr, {grave: [{...big, _gy: 4, _disc: true}]}))), /can't be played/,
    "a discard from an EARLIER turn opened it");
});

test("Duty Bound Blitz asks for a yellow card put into the soul THIS TURN", {skip}, () => {
  H.db();
  const db = H.card("Duty Bound Blitz", 1) || H.card("Duty Bound Blitz", 2);
  assert.deepEqual([P.fxParse(db).playIf.kind, P.fxParse(db).playIf.pitch], ["soulPitch", 2]);
  const yel = {...H.card("Raging Onslaught", 2), uid: "s1"};
  assert.equal(yel.pitch, 2, "fixture: a yellow card");
  assert.match(String(playWhy(holding(db))), /no yellow card has been put into your soul this turn/);
  /* v5.40: the gate asks the EVENT (`hist.soulPut`), not the soul's contents */
  const S = require("../engine/sides");
  const put = pitches => ({...S.freshHist(), soulPut: pitches});
  assert.equal(playWhy(holding(db, {soul: [yel], hist: put([2])})), null, "put in this turn opens it");
  /* THE HALF THE TRAINER'S COPY DROPPED: a yellow in the soul from an earlier turn */
  assert.match(String(playWhy(holding(db, {soul: [yel], hist: put([])}))), /can't be played/,
    "a yellow card charged on an EARLIER turn opened the gate — 'this turn' was dropped");
  /* THE HALF v4.90's STAMP DROPPED: put in this turn and banished since */
  assert.equal(playWhy(holding(db, {soul: [], hist: put([2])})), null,
    "a yellow put in this turn and banished since shut the gate — it read the soul, not the event");
  /* and the colour is the printed one */
  assert.match(String(playWhy(holding(db, {soul: [], hist: put([1])}))), /can't be played/);
});

test("every writer that ADDS to a soul records the event", {skip}, () => {
  H.db();
  /* the PICK route — Halo of Illumination, Roaring Beam's charge */
  const g = H.state({hand: [{...H.card("Raging Onslaught", 2), uid: "h1"}], soul: []}, {}, {turn: 7, actor: 0});
  const moved = PM.moveCards(g, 0, "hand", "soul", [g.sides[0].hand[0]]);
  assert.deepEqual(moved.sides[0].hist.soulPut, [2], "a pick into the soul is not recorded");
  /* a pick anywhere else records nothing */
  const elsewhere = PM.moveCards(g, 0, "hand", "grave", [g.sides[0].hand[0]]);
  assert.deepEqual(elsewhere.sides[0].hist.soulPut || [], []);

  /* THE SOURCE CENSUS: every assignment in the engine that ADDS a card to
     a soul records it through `soulPutNote` within the next line. Removals
     (slice/filter) are not writers. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const writers = [];
  for(const f of ["effects.js", "prompts.js", "judge.js"]){
    const lines = strip(fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")).split("\n");
    lines.forEach((line, i) => {
      if(/\.soul = \[|s\[_to\] = \[/.test(line) && !/\.slice\(|\.filter\(/.test(line))
        writers.push([f, line.trim(), line + (lines[i + 1] || "")]);
    });
  }
  assert.ok(writers.length >= 3, "the writer scan stopped matching — " + writers.length);
  for(const [f, line, two] of writers)
    assert.match(two, /soulPutNote/, f + ": a soul writer that does not record the event — " + line.slice(0, 100));
  /* and the retired stamp is gone: one record per fact */
  for(const f of ["effects.js", "prompts.js", "judge.js"])
    assert.doesNotMatch(strip(fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")), /_soulT/, f);
});

test("the evaluator answers every kind the pool emits, and refuses one it does not know", {skip}, () => {
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : Object.values(pool);
  const kinds = new Set();
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "", ty: c.types || [],
                          tx: c.functional_text || "", kw: c.card_keywords || [], power: c.power});
    if(fx.playIf) kinds.add(fx.playIf.kind);
  }
  assert.deepEqual([...kinds].sort(), ["discardPow", "pitchPow", "soulPitch"], "the emitted set moved");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* bounded at the function's own closing brace, never a byte count (v4.57) */
  const at = src.indexOf("function playIfOk(");
  const body = src.slice(at, src.indexOf("\n}\n", at));
  assert.ok(at > 0 && body.length > 300, "playIfOk moved — re-anchor this census");
  for(const k of kinds){
    assert.ok(E.PLAY_IF_KINDS.includes(k), k + " missing from PLAY_IF_KINDS");
    assert.ok(body.indexOf('pif.kind === "' + k + '"') > 0, k + " has no branch — it falls through");
  }
  /* the fallthrough, driven: no pool card can emit an unknown kind */
  P.fxReset();
  const odd = {name: "Synthetic Odd Gate", pitch: 1, tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
               kw: [], tx: "Play this only if the moon is full."};
  assert.equal(E.playIfOk({turn: 1, actor: 0, sides: [{}, {}]}, odd), false,
    "an unread play condition waves the card through");
  P.fxReset();
});

test("ONE evaluator: the trainer asks the shared body, and so do both contexts", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const playIfOk = DawnEffects\.playIfOk;/, "the trainer wrote its own evaluator again");
  assert.match(html, /if\(pif && !playIfOk\(s, card\)\) return L\(s, `\$\{card\.name\} can't be played — \$\{pif\.why\}\.`\);/,
    "the trainer's door stopped asking it");
  const jd = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(jd, /if\(!E\.playIfOk\(\{\.\.\.g, actor: seat\}, c\)\)/, "the table stopped asking it");
});
