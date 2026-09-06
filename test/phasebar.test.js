/* test/phasebar.test.js — WHERE AM I? (v3.19)
 *
 * The log screen shows the turn and the phase. Two labels, because the two
 * boards speak different state languages, and the hazard is the one v2.83
 * caught the advisor one line from shipping:
 *
 *   judge.js SEEDS `mode` into its opening state and never writes it
 *   again. A table board that called the trainer's label would print
 *   "your action phase" from the first draw to the last point of life —
 *   present, plausible, and frozen, which reads as an answer.
 *
 * So `phaseLabel` takes the trainer's words and `stepLabel` reads the CR
 * machine, and a drill fails the table for reaching for the wrong one.
 * Both are pure and extracted from the source, which is the only way a
 * drill can reach a function that lives inside a React component.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function lift(name){
  const i = HTML.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " moved — re-anchor this drill");
  const j = HTML.indexOf("\nfunction ", i + 10);
  assert.ok(j > i, name + "'s end anchor moved");
  const src = HTML.slice(i, j);
  assert.ok(src.length > 120, "the slice must actually contain the body");
  return new Function(src + "\nreturn " + name + ";")();
}

const phaseLabel = lift("phaseLabel");
const stepLabel  = lift("stepLabel");

/* ---- the trainer's words ------------------------------------------- */

test("phaseLabel names every mode the trainer can be in", () => {
  assert.equal(phaseLabel("act", null, false), "your action phase");
  assert.equal(phaseLabel("pay", null, false), "paying a cost");
  assert.equal(phaseLabel("arsenal", null, false), "end phase — arsenal");
  assert.equal(phaseLabel("stack", null, false), "attack — reaction step");
  assert.equal(phaseLabel("boostpick", null, false), "boost?");
  assert.equal(phaseLabel("targetpick", null, false), "choosing a target");
});

test("block splits on bphase — defending and reacting are different windows", () => {
  assert.equal(phaseLabel("block", "defend", false), "defend step");
  assert.equal(phaseLabel("block", "react", false), "reaction step",
    "CR 7.3 vs the reaction step: reading `mode` alone collapses two windows " +
    "into one, and which one you are in decides what you may play");
});

test("game over wins over everything", () => {
  assert.equal(phaseLabel("act", null, true), "game over");
  assert.equal(phaseLabel("block", "defend", true), "game over");
});

test("an unknown mode is shown, not swallowed", () => {
  assert.equal(phaseLabel("somethingnew", null, false), "somethingnew",
    "a mode this label has not learned should be visible on screen rather " +
    "than silently blank — that is how the next one gets noticed");
});

/* ---- the table's words --------------------------------------------- */

const T = (o) => Object.assign({over: false, turn: 3, turnPlayer: 0, phase: "action", step: "layer"}, o);

test("stepLabel reads the CR machine, and 'yours' is the TURN PLAYER", () => {
  assert.equal(stepLabel(T({turnPlayer: 0}), 0), "your action phase");
  assert.equal(stepLabel(T({turnPlayer: 1}), 0), "their action phase",
    "'your action phase' is NOT phase === 'action': the combat chain lives " +
    "inside the TURN PLAYER's action phase, so while you defend against " +
    "their swing the phase is still action and simply is not yours");
});

test("it follows the seat, not the chair", () => {
  assert.equal(stepLabel(T({turnPlayer: 1}), 1), "your action phase",
    "seat 1 is occupiable — the label must be right from either chair");
  assert.equal(stepLabel(T({turnPlayer: 0}), 1), "their action phase");
});

test("the combat steps are named, and `layer` is not a step to announce", () => {
  assert.equal(stepLabel(T({step: "defend"}), 0), "your attack — defend step");
  assert.equal(stepLabel(T({turnPlayer: 1, step: "damage"}), 0), "their attack — damage step");
  assert.equal(stepLabel(T({step: "layer"}), 0), "your action phase",
    "the layer step is the open window, which is what 'action phase' already says");
});

test("start and end phases are named for both seats", () => {
  assert.equal(stepLabel(T({phase: "start"}), 0), "your start phase");
  assert.equal(stepLabel(T({phase: "end", turnPlayer: 1}), 0), "their end phase");
  assert.equal(stepLabel(T({phase: "end", over: true}), 0), "game over");
});

/* ---- the frozen-field hazard, pinned -------------------------------- */

test("the TABLE must not read `mode` — judge seeds it once and never writes it", () => {
  /* Comments stripped: this file is full of prose about exactly this
     hazard, and a grep is satisfied by a comment in both directions. */
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const i = code.indexOf("function TableBoard(");
  assert.ok(i > 0, "TableBoard moved — re-anchor this drill");
  const body = code.slice(i, code.indexOf("\nfunction ", i + 10));
  assert.ok(body.length > 400, "the slice must actually contain the body");

  assert.ok(!/phaseLabel\(/.test(body),
    "the table calling the trainer's label prints 'your action phase' for the " +
    "whole game — judge.js seeds `mode` and never writes it again. A field " +
    "that is present, plausible and frozen reads as an answer; that is the " +
    "sev-2 shape the advisor was one line from shipping in v2.83.");
  assert.match(body, /stepLabel\(g, mySeat\)/,
    "and it must pass the SEAT, or the label is right only from chair 0");
});

test("the trainer keeps its own, because there `mode` is the live one", () => {
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /phaseLabel\(g\.mode, g\.bphase, g\.over\)/,
    "`mode`/`bphase` are authoritative in Battle — the derived phase/step " +
    "there is the v2.27 shadow, which is the mirror image of the table");
});

/* ============================================================
   THE TWO FIGHT BUTTONS SAY WHAT A PLAYER GETS (v3.51)

   The loadout screen offers both boards, and the second one read
   **"Fight at the table — one engine"**. "One engine" is the Phase 1
   rebuild's ARCHITECTURE — the merged judge.js / effects.js path — and it
   is true, and it tells a player nothing about what happens when they tap
   it. Reported from a real table as simply confusing, together with
   "things don't work quite as well", which is the OTHER half: the trainer
   swings the tuned `[3,4,5]` escalation and the table seats
   `sparring.act`, which is untuned and wins most games.

   A label is not decoration here. A player who loses nine straight is
   owed the reason BEFORE the game rather than after it.
   ============================================================ */
test("the fight buttons describe the OPPONENT, not the architecture", () => {
  const bar = HTML.slice(HTML.indexOf('onClick={startTable}') - 3000,
                         HTML.indexOf('onClick={startTable}') + 800);
  assert.ok(!/>\s*Fight at the table — one engine/.test(HTML),
    "\"one engine\" is an architecture note wearing a button's clothes");
  assert.match(bar, /harder/,
    "the untuned board must say so on the button — measured 29 of 45 at v3.51");
  /* SCOPED TO THE TRAINER'S OWN REGION, because "untuned" CONTAINS
     "tuned" — a whole-block match stayed green with the trainer's note
     deleted, which is v2.44's Reaction-contains-action trap in a drill
     rather than in the parser. The sabotage that finds it is deleting the
     word from the first note only. */
  const trainerNote = bar.slice(bar.indexOf("<span>Fight</span>"), bar.indexOf("onClick={startTable}"));
  assert.ok(/(?:^|[^u])tuned/.test(trainerNote),
    "the trainer's own note must call it the tuned one: " + JSON.stringify(trainerNote.slice(0, 300)));
});

test("a failed table build is never silent", () => {
  /* v2.51's clipboard rule — never dress a failure as a success — in the
     one place the two boards are hardest to tell apart. Falling through
     to the trainer is right; doing it QUIETLY means the player tapped one
     board, got the other, and attributes every difference to the wrong
     thing. */
  const i = HTML.indexOf("FALL THROUGH TO THE TRAINER RATHER THAN DEAD-ENDING");
  assert.ok(i > 0, "the fall-through must still be there — dead-ending is worse");
  const blk = HTML.slice(i, i + 1400);
  assert.match(blk, /console\.warn/, "it must log which board they ended up on");
  assert.match(blk, /alert\(/, "…and say it on screen, not only in a console nobody opens");
  /* Pin that it is the TABLE's catch, so the drill cannot drift onto some
     other try/catch that happens to warn. */
  assert.ok(HTML.slice(Math.max(0, i - 2200), i).includes("cfg.table"),
    "this must be the catch on the table build");
});

/* ============================================================
   A DISCLOSURE THAT IS NOT READABLE IS NOT A DISCLOSURE (v4.28)

   v3.51's lesson was **"a doc the player cannot read is not a disclosure
   — put it on the button"**, and the drill above pins the words. It was
   the right pin and it is only half the claim: the words were put on the
   button and then rendered in a ribbon about six characters across, and
   **a text pin cannot see a layout.**

   `.actbar` is SHARED. `display:flex` with no direction is a ROW — right
   for the board, where `.actbar .a{flex:1}` lays four buttons out side by
   side, and wrong the moment v3.51 put a STACK in it. Measured in Chromium
   at 393x852: the four children became four COLUMNS, the striped Fight
   button 66px wide, its note 51px, and the bar 163px tall against a pane
   that had reserved 236px of chrome for a bar one button high — so it
   painted over the bottom 29px of the scout pane and struck through the
   seating line.

   TWO RULES, AND THE SECOND IS THE ONE THAT ROTS. The direction is the
   bug; the hardcoded reserve is why it could not be seen coming, and it
   is the same shape as `--peekbot` before v2.52 measured it. Both are
   source rules, because `npm test` runs on a fresh clone with no
   dependencies (v3.00) and neither can be driven without a browser — the
   browser measurement is a pre-ship step, beside the compile check, and
   CLAUDE.md carries the recipe.
   ============================================================ */
const CSS = HTML.slice(HTML.indexOf("<style>"), HTML.indexOf("</style>"));

test("the loadout's action bar is a COLUMN, because it holds a stack", () => {
  /* The bar's own children, counted rather than assumed: a rule about a
     stack is only owed where there IS a stack, and if the screen ever goes
     back to one button this drill should say so out loud rather than
     quietly keep demanding a column. */
  const i = HTML.indexOf('<div className="actbar" ref={bar}>');
  assert.ok(i > 0, "the loadout's action bar moved — re-anchor this drill");
  const bar = HTML.slice(i, HTML.indexOf("<CardModal", i));
  const kids = (bar.match(/\n\s{14}<(?:button|p)\b/g) || []).length;
  assert.ok(kids >= 4, "v3.51 puts two options and their disclosure in this " +
    "bar; found " + kids + " stacked children");

  assert.match(CSS, /\.lo \.actbar\{[^}]*flex-direction:column/,
    "`.actbar` is shared and its default direction is ROW, which lays this " +
    "stack out as " + kids + " columns — measured at 393x852 the disclosure " +
    "came out 51px wide, about six characters");
  /* AND THE BOARD'S MUST STAY A ROW. The two boards share the class, so a
     fix written on `.actbar` itself would turn the action bar — four
     buttons with `flex:1` — into a four-storey tower on every turn of
     every game. That is the half a scoped fix is FOR, and pinning only
     the column half cannot see it. */
  assert.ok(!/\n\.actbar\{[^}]*flex-direction:column/.test(CSS),
    "the board's own action bar is a row of `.a` buttons and must stay one");
});

test("the pane's reserve is MEASURED, not stated", () => {
  const rule = (CSS.match(/\.lo \.tablewrap,\.lo \.vscreen\{[^}]*\}/) || [""])[0];
  assert.ok(rule, "the loadout pane's height rule moved — re-anchor this drill");
  assert.match(rule, /var\(--lochrome/,
    "this read `calc(100vh - 236px)`, a number written when the bar was one " +
    "button tall; a hardcoded offset is wrong the moment the layout moves, " +
    "which is exactly how `--peekbot` shipped (v2.52)");

  /* A VARIABLE WITH NO WRITER IS THE FALLBACK WEARING A VARIABLE'S CLOTHES
     — the counter-with-no-reader shape (v3.55, v4.06) with the arrows
     reversed. Measured in Chromium it resolves to 284px at 393x852, 301px
     at 360x740 and 267px at 820x1180: three different right answers, none
     of them the literal. */
  const lo = HTML.slice(HTML.indexOf("function Loadout("),
                        HTML.indexOf("/* ---------- APP ---------- */"));
  assert.ok(lo.length > 2000, "Loadout's slice must contain its body");
  const writes = (lo.match(/setProperty\("--lochrome"/g) || []).length;
  assert.equal(writes, 1, "exactly one writer, in the component that owns the " +
    "chrome — two would be the no-mirror rule broken inside one screen");
  assert.match(lo, /removeProperty\("--lochrome"\)/,
    "and it is cleared on unmount, or a measurement taken on this screen " +
    "outlives it on every other one");
  /* BOTH ENDS OF THE PANE. Reserving only the bar's height leaves the
     header and the screen nav out and the pane runs off the top; reserving
     only what is above it puts the bar back over the bottom, which is the
     defect this replaced. */
  assert.match(lo, /wb\.top/, "everything ABOVE the pane is measured");
  assert.match(lo, /innerHeight - bb\.top/, "and everything BELOW it");
});
