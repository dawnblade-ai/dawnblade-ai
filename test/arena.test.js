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

/* REPOINTED IN v3.17. These two used to scan each board for its own calls
   to `resolveInertia` / `thawFrost` / `sweepArena` — which is what you write
   when the event is assembled twice, and it passes happily while the two
   assemblies drift. They did drift: three MORE beginning-of-end-phase rules
   were sitting inline in the trainer and at the table there were none.
   `effects.beginEndPhase` is the whole event now, so what these pin is that
   each board DELEGATES and restates nothing. The event's own content and
   its order are drilled in `test/endphase.test.js`. */
test("the trainer's end phase delegates the whole event, restating none of it", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf("  function beginEndPhase(s, si){");
  assert.ok(start > 0, "beginEndPhase moved — re-anchor this drill");
  const stop = html.indexOf("\n  function ", start + 10);
  assert.ok(stop > start, "beginEndPhase's end anchor moved");
  const body = html.slice(start, stop).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(body, /DawnEffects\.beginEndPhase\(s, si, db\)/,
    "the trainer's half is to log the messages and run the ops, nothing more");
  assert.ok(!/DawnEffects\.(sweepArena|resolveInertia|thawFrost)\(/.test(body),
    "a board reaching past the shared body for one step of the event is that " +
    "board growing its own copy of the order again");
  assert.match(body, /runOps\(n, r\.ops/,
    "the ops come back rather than being run inside — an op is actor-relative " +
    "and the two boards reach runOps differently");
});

test("the shared body still runs every schedule the table never had", {skip}, () => {
  const eff = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const i = eff.indexOf("function beginEndPhase(game, seat, db){");
  assert.ok(i > 0, "beginEndPhase moved — re-anchor this drill");
  const body = eff.slice(i, eff.indexOf("\nfunction ", i + 10)).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(body.length > 400, "the slice must actually contain the body");
  /* All three were pure and shared-shaped in effects.js and judge.js called
     none of them, so Inertia never wiped a hand and a Frostbite the frozen
     seat never spent followed them into the next turn. */
  for(const fn of ["resolveInertia", "thawFrost", "sweepArena"])
    assert.ok(new RegExp(fn + "\\(").test(body), fn + " must run at the table too");
  const judge = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/E\.beginEndPhase\(n, seat, getDb\(\)\)/.test(judge), "and judge must call the body");
});

/* ============================================================
   THE HAND WIPE IS READ, NOT MATCHED BY NAME (v4.03)

   `effects.isInertia` was `norm(b.card.name) === "inertia"` — a card
   special-cased by NAME, which is the golden rule broken at the top of
   CLAUDE.md and exactly v3.22's Runechant defect one token over: built by
   name, while the parser filed its clause `skip` and the token reported
   `tier: none` beside seven siblings that genuinely do nothing.

   **A TIER THAT SAYS `none` ON A CARD THAT WORKS IS A LEAD** (v3.93), and
   this is the third time it has paid.

   THE NAME AND THE TEXT MUST BE ABLE TO DISAGREE, or the drill cannot
   tell the two readers apart — no pool card does, so both fixtures are
   synthetic (v3.73's Crash-and-Bash discriminator, one token over).
   ============================================================ */
const HJ = require("./helpers/judged.js");

const wipeText = "At the beginning of your end phase, destroy this, then put all " +
                 "cards from your hand and arsenal on the bottom of your deck.";
const tokenCard = (name, tx) => ({
  uid: "hw-" + name, name, tt: "Generic Token - Disease Aura",
  ty: ["Generic", "Token", "Aura"], tx, kw: [], gkw: [], pitch: 0
});
const boardWith = card => HJ.state({
  board: [{uid: 77, kind: "aura", card}],
  hand: [{uid: 1, name: "HW Hand A", tt: "Generic Action", ty: ["Generic","Action"], tx: "", kw: []},
         {uid: 2, name: "HW Hand B", tt: "Generic Action", ty: ["Generic","Action"], tx: "", kw: []}],
  arsenal: null, deck: []
}, {});

test("a token printing the wipe fires it — whatever it is called", () => {
  const odd = tokenCard("Not Called Inertia At All", wipeText);
  assert.equal(P.isHandWipe(odd), true, "the parser does not read the printed wipe");
  const out = E.resolveInertia(boardWith(odd), 0);
  assert.equal(out.game.sides[0].hand.length, 0,
    "a token printing the wipe did not fire it — the reader is matching the NAME " +
    "again, which is the golden rule broken");
  assert.equal(out.game.sides[0].deck.length, 2, "the hand did not reach the deck");
  assert.equal((out.game.sides[0].board || []).length, 0, "the token was not destroyed");
});

test("a token NAMED Inertia that prints no wipe does nothing", () => {
  /* THE OTHER HALF, and the one that actually bites: reverting to the
     name match passes the test above perfectly, because the real token IS
     called Inertia. Only a card whose name and text disagree can tell the
     two readers apart. */
  /* THE IMPOSTOR MUST CARRY THE REAL NAME, or it cannot tell a
     name-matcher from a text-reader — and `fxParse` MEMOIZES ON
     `name|pitch`, so parsing a fake "Inertia" poisons that key for every
     later reader in the process. `fxReset` at the end of this test is not
     tidiness: without it the drill below got this card's parse back and
     reported the wipe leaking into `fx.ops`. The documented drill gotcha,
     in a drill about a memo hazard's own family. */
  const impostor = tokenCard("Inertia", "Ward 1");
  assert.equal(P.isHandWipe(impostor), false, "the parser reads a wipe off a card that prints none");
  const out = E.resolveInertia(boardWith(impostor), 0);
  assert.equal(out.game.sides[0].hand.length, 2,
    "a token that merely CARRIES THE NAME wiped the hand — the reader is the " +
    "name rather than the printed text");
  assert.equal((out.game.sides[0].board || []).length, 1, "and it destroyed a card it does not read");
  P.fxReset();
});

test("the wipe is held off `fx.ops`, so playing the token does not fire it", () => {
  /* v3.56's rule one schedule over. Left in `ops` the wipe would fire
     when the token is PLAYED rather than at the end phase — v3.07's
     suspense bug, a printed delay collected as a bonus — and emitting the
     `selfDestruct` would hand the token to `sweepArena` as well, so it
     would be destroyed twice and the wipe would move in the end-phase
     order. */
  const real = tokenCard("HW Ops Probe", wipeText);
  const fx = P.fxParse(real);
  assert.deepEqual(fx.ops || [], [],
    "the wipe leaked into fx.ops — it will fire when the token is played, and " +
    "`sweepArena` will destroy it a second time");
  assert.ok(fx.handWipe, "the whole-card reader did not claim the clause");
  assert.equal(fx.tier, "full",
    "the token no longer reports fully scripted — the clause is unclaimed again");
});
