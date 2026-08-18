/* ============================================================
   THE ARENA HAS A CLOCK, AND IT RUNS ON BOTH BOARDS (v3.07)

   Five pool cards and fifteen tokens print a self-destruct schedule.
   The parser has read the plain form for a long time and `execute`
   stamps it onto the board entry as `sd`, so a permanent has been
   carrying its own expiry since it entered the arena. What was missing
   was a reader:

     sd:"turn"   swept in the TRAINER only, inline inside `newTurn`
     sd:"end"    swept on NEITHER board
     tokens      never stamped at all — the mint skips `execute`
     "…, then X" the schedule swallowed by a loose temporal-prefix match

   Every affected card reports `tier: full`. That is the point: coverage
   counts clauses consumed, the fairness sweep reads a card's PARSE, and
   `failstates.js` files "no schedule to fire on" by looking for UNREAD
   text — so a schedule that parses and then evaporates is invisible to
   all three, by construction.

   THE DRILLS DRIVE, THEY DO NOT GREP. `sweepArena` is pure and exported
   precisely so this file can call it; the one source claim left here is
   the negative one — that neither board has grown a second copy.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const E = require("../engine/effects");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const ROOT = path.join(__dirname, "..");

/* A seat holding exactly the cards under test, at a known turn. */
const board = (...entries) => H.state({board: entries}, {}, {turn: 5});
const entry = (c, sd, kind) => ({card: c, kind: kind || "aura", spent: false, uid: c.uid, sd});

/* ---- THE TWO SCHEDULES ARE DIFFERENT MOMENTS ------------------------- */

test("the end-phase sweep destroys its card and leaves the turn-phase one standing", {skip}, () => {
  H.db();
  const co = H.card("Concealed Object", 3);      /* Lyath — "at the beginning of your end phase, destroy this" */
  const pp = H.card("Pyroglyphic Protection", 1);/* Iyslander — "at the beginning of your action phase" */
  const g = board(entry(co, "end", "item"), entry(pp, "turn"));

  const out = E.sweepArena(g, 0, "end");
  assert.deepEqual(out.game.sides[0].board.map(b => b.card.name), ["Pyroglyphic Protection"],
    "only the card whose printed clock says END may leave here");
  assert.deepEqual(out.game.sides[0].grave.map(c => c.name), ["Concealed Object"]);
  assert.equal(out.game.sides[0].grave[0]._gy, 5, "the graveyard is turn-stamped");
});

test("the turn-phase sweep is the other moment, and it is not the end one", {skip}, () => {
  H.db();
  const co = H.card("Concealed Object", 3);
  const pp = H.card("Pyroglyphic Protection", 1);
  const g = board(entry(co, "end", "item"), entry(pp, "turn"));

  const out = E.sweepArena(g, 0, "turn");
  assert.deepEqual(out.game.sides[0].board.map(b => b.card.name), ["Concealed Object"],
    "passing the wrong `when` would sweep a card a whole phase early");
  assert.deepEqual(out.game.sides[0].grave.map(c => c.name), ["Pyroglyphic Protection"]);
});

test("sweepArena never mutates the game it is given", {skip}, () => {
  H.db();
  const pp = H.card("Pyroglyphic Protection", 1);
  const g = board(entry(pp, "turn"));
  E.sweepArena(g, 0, "turn");
  assert.equal(g.sides[0].board.length, 1, "the caller keeps its state");
  assert.equal(g.sides[0].grave.length, 0);
});

/* ---- WHAT THE CARD WAS HOLDING UP ------------------------------------ */

/* BOTH TEARDOWN PREDICATES WERE ALWAYS FALSE, each for its own reason,
   and both were invisible because being wrong in that direction only ever
   tore an effect down EARLY — which looks like the effect expiring. */

test("the arcane shield survives a departure that is not its own", {skip}, () => {
  H.db();
  const pp = H.card("Pyroglyphic Protection", 1);
  const co = H.card("Concealed Object", 3);
  /* Pyroglyphic is the only card in the pool that grants `arcShield`, and
     the predicate this replaced matched "prevent N arcane damage that
     source" — a wording upstream STOPPED PRINTING. It therefore answered
     false for the one card it existed to find. */
  const g = H.state({board: [entry(pp, "turn"), entry(co, "end", "item")], arcShield: 3}, {}, {turn: 5});
  const out = E.sweepArena(g, 0, "end");
  assert.equal(out.game.sides[0].arcShield, 3,
    "Concealed Object leaving must not take Pyroglyphic Protection's shield with it");
});

test("the arcane shield goes when its own granter goes", {skip}, () => {
  H.db();
  const pp = H.card("Pyroglyphic Protection", 1);
  const g = H.state({board: [entry(pp, "turn")], arcShield: 3}, {}, {turn: 5});
  const out = E.sweepArena(g, 0, "turn");
  assert.equal(out.game.sides[0].arcShield, 0, "and it does go when nothing still grants it");
  assert.ok(out.msgs.some(m => /arcane shield/i.test(m)), "and it says so");
});

test("life-gain stays locked while the sword that locks it is still equipped", {skip}, () => {
  H.db();
  const rb = H.card("Reaping Blade", 0);          /* Viserai's Sword — it lives in GEAR */
  const sig = H.card("Sigil of Silphidae", 3);    /* and his aura crumbles at the top of the turn */
  /* The predicate this replaced scanned the BOARD for the granter. Reaping
     Blade is a Sword, so it is never on the board — meaning any aura
     crumbling on Viserai's turn silently unlocked life-gain while his
     sword was still in play. Both cards are in the same deck. */
  const g = H.state({gear: [rb], board: [entry(sig, "turn")], lifeLock: true}, {}, {turn: 5});
  const out = E.sweepArena(g, 0, "turn");
  assert.equal(out.game.sides[0].lifeLock, true, "the sword is still equipped");

  const g2 = H.state({gear: [{...rb, destroyed: true}], board: [entry(sig, "turn")], lifeLock: true}, {}, {turn: 5});
  assert.equal(E.sweepArena(g2, 0, "turn").game.sides[0].lifeLock, false,
    "and it does lift once the sword is gone — a destroyed piece grants nothing");
});

/* ---- "ENTERS OR LEAVES" IS TWO OCCASIONS ----------------------------- */

test("Booze! boos on the way in AND on the way out", {skip}, () => {
  H.db();
  const bz = H.card("Booze!", 3);
  const fx = P.fxParse(bz);
  assert.deepEqual(fx.ops.filter(o => o[0] === "boo"), [["boo", 1]],
    "the ENTRY half — the compound wording used to file the whole payload as a departure");
  assert.deepEqual(fx.onLeave, [["boo", 1]], "and the departure half");
});

test("a leaves-only card keeps its payload on the departure alone", {skip}, () => {
  H.db();
  /* Act of Glory is v3.00's suspense fix and must not regress into paying
     on the way in — that is the bug suspense exists to describe. */
  const ag = H.card("Act of Glory", 1);
  const fx = P.fxParse(ag);
  assert.deepEqual(fx.onLeave, [["buffNext", 6]]);
  assert.ok(!fx.ops.some(o => o[0] === "buffNext"), "and nothing on the way in");
});

test("the crowd boos twice over Booze!'s life, driven", {skip}, () => {
  H.db();
  const bz = H.card("Booze!", 3);
  /* Lyath turns every boo into a Might token, which is his whole engine —
     so a missed departure boo is a missed Might, every time. */
  const g = H.state({board: [entry(bz, "turn")]}, {}, {turn: 3, builds: [{lyathBoo: true}, {}]});
  const out = E.sweepArena(g, 0, "turn");
  assert.deepEqual(out.ops, [["boo", 1]], "the departure pays");
  const n = J.withEffects({...out.game, actor: 0}, (fx, s2) => fx.runOps(s2, out.ops, "drill"));
  assert.equal(n.sides[0].hist.booed, 1, "the crowd boos");
  assert.deepEqual(n.sides[0].board.map(b => b.card.name), ["Might"], "and Lyath makes Might");
});

/* ---- IT RUNS AT THE TABLE, NOT ONLY IN THE TRAINER -------------------- */

test("judge runs both schedules across a real turn boundary", {skip}, () => {
  H.db();
  const co = H.card("Concealed Object", 3);
  const pp = H.card("Pyroglyphic Protection", 1);
  const INV = require("../engine/invariants");
  /* A judge-shaped state driven through the REAL reducer, not a fixture
     asserted about. `judged.js` builds the seats; the CR machine's fields
     are what `newMatch` would have seeded. */
  let g = {...H.state({board: [entry(co, "end", "item"), entry(pp, "turn")], arcShield: 3}, {}, {turn: 1}),
           phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null};
  /* Ending a turn takes TWO actions (CR 4.3.4) — `endTurn` is a pass
     carrying intent, and the opponent still holds their last window. */
  const passTurn = st => {
    let n = J.reduce(st, {t: "endTurn"}, st.turnPlayer).state || st;
    if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state || n;
    while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state || n;
    return n;
  };

  g = passTurn(g);                     /* seat 0's own end phase */
  assert.deepEqual(g.sides[0].board.map(b => b.card.name), ["Pyroglyphic Protection"],
    "the end-phase card left at the table — this ran on NEITHER board before v3.07");
  assert.equal(g.sides[0].arcShield, 3, "and took nothing else with it");
  assert.deepEqual(INV.errors(g).map(x => x.code), []);

  g = passTurn(g);                     /* seat 1's turn, then seat 0's start phase */
  assert.deepEqual(g.sides[0].board.map(b => b.card.name), [],
    "and the turn-phase card left at the start of seat 0's next turn");
  assert.equal(g.sides[0].arcShield, 0, "the shield goes with its granter");
  assert.deepEqual(INV.errors(g).map(x => x.code), []);
});

/* ---- ONE DESCRIPTION OF THE RULE ------------------------------------- */

test("the rule exists once — no board re-reads the printed line", {skip}, () => {
  const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const html = decomment(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
  const judge = decomment(fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8"));
  /* A board that filters its own arena by `sd` is the second sweep coming
     back. Both must reach the shared one instead. */
  assert.ok(!/\.filter\(\s*b\s*=>\s*b\.sd\s*[!=]==/.test(html),
    "the trainer must not sweep its own arena inline");
  assert.ok(!/\.filter\(\s*b\s*=>\s*b\.sd\s*[!=]==/.test(judge),
    "and neither may judge.js");
  assert.ok(/DawnEffects\.sweepArena/.test(html), "the trainer calls the shared sweep");
  assert.ok(/E\.sweepArena/.test(judge), "and so does judge.js");
});

/* THE OTHER CALL SITE, AND IT WAS LOST ONCE ALREADY. Rewriting the old
   Kayo drill from a grep into a drive was right about the rule and wrong
   about the call: deleting the trainer's start-of-turn sweep afterwards
   left the whole suite green, because the only remaining source claim
   asked whether `sweepArena` appeared in the file at all — and it appears
   three times. A drive proves the rule works; only this proves the board
   runs it. */
test("the trainer's start phase reaches the sweep, with the TURN schedule", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf("  function newTurn(s){");
  assert.ok(start > 0, "newTurn moved — re-anchor this drill");
  const stop = html.indexOf("  const toks = [", start);
  assert.ok(stop > start, "newTurn's end anchor moved");
  const body = html.slice(start, stop).replace(/\/\*[\s\S]*?\*\//g, "");
  const hits = body.match(/DawnEffects\.sweepArena\(\s*\w+\s*,\s*0\s*,\s*"turn"\s*\)/g) || [];
  assert.equal(hits.length, 1,
    "exactly one — the crumbling auras and the counter tokens are ONE schedule, " +
    "and two blocks sweeping it is how the table came to have neither");
});

/* SLICED SOURCE, AND ONLY BECAUSE THERE IS NO OTHER WAY. `beginEndPhase`
   is a closure inside `Battle`, so no drill can call it — the same
   reasoning `mirror.test.js` records. The rule ITSELF is drilled by
   driving `sweepArena` above; what this pins is that the trainer's end
   phase actually reaches it, with the right `when`. Passing "turn" here
   would sweep the wrong set a whole phase early. */
test("the trainer's end phase reaches the sweep, with the END schedule", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf("  function beginEndPhase(s, si){");
  assert.ok(start > 0, "beginEndPhase moved — re-anchor this drill");
  const stop = html.indexOf("\n  function ", start + 10);
  assert.ok(stop > start, "beginEndPhase's end anchor moved");
  const body = html.slice(start, stop).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(body, /DawnEffects\.sweepArena\(n,\s*si,\s*"end"\)/,
    'the beginning of the end phase must sweep the "end" schedule for THIS seat');
  assert.match(body, /DawnEffects\.resolveInertia/, "beside Inertia, which shares the moment");
});

test("judge runs the beginning-of-end-phase schedules it never had", {skip}, () => {
  const judge = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  /* All three were pure and shared-shaped in effects.js and judge.js
     called none of them, so Inertia never wiped a hand and a Frostbite
     the frozen seat never spent followed them into the next turn. */
  for(const fn of ["resolveInertia", "thawFrost", "sweepArena"])
    assert.ok(new RegExp("E\\." + fn + "\\(").test(judge), fn + " must run at the table too");
});
