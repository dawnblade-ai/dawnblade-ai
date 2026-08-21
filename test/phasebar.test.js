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
