/* ============================================================
   THE PRE-GAME ORDER — and the solo flow was the only thing in the
   project still doing it backwards. (v2.76)

   `engine/lobby.js` has ruled this since it was written:

     STEPS = ["fault", "hero", "throw", "seat", "board", "ready"]

   and says why in as many words — "The sideboard comes AFTER the throw on
   purpose: you sideboard knowing the matchup and knowing whether you are
   on the play." The table path has always obeyed it.

   The SOLO path ran Loadout -> Pregame -> Battle: every sideboard choice
   made before the throw, so the two facts that make sideboarding a
   decision were shown too late to use. Two descriptions of one rule, and
   the one nobody was reading was wrong — the same shape that let clash
   fire on the wrong trigger for five versions.

   These drills pin the ORDER, not the pixels. A change here should be a
   deliberate edit, because it is a rules change.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const L = require("../engine/lobby.js");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
/* Strip comments before scanning. This file is full of prose about the
   very order being checked, and a grep is satisfied by a comment in both
   directions — v2.68 shipped a drill that stayed green against `if(false)`
   because the identifier sat in the comment above the gate. */
const CODE = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the lobby still rules that the sideboard follows the throw", () => {
  const t = L.STEPS.indexOf("throw"), b = L.STEPS.indexOf("board");
  assert.ok(t >= 0 && b >= 0, "lobby STEPS lost a step — re-anchor this drill");
  assert.ok(t < b, "throw must come before board; this is the rule the solo flow now shares");
});

test("the solo flow renders the THROW before the SIDEBOARD", () => {
  /* Both screens are rendered from one block in App. Their order in the
     source is not the flow — what matters is which one consumes the
     other's output. `Pregame` is entered from `loHero` and produces
     `seating`; `Loadout` is entered from `seating`. */
  const pre = CODE.match(/\{loHero && !fighting && <Pregame[\s\S]{0,400}?\/>\}/);
  assert.ok(pre, "Pregame is no longer the screen `loHero` opens — the reorder was undone");
  assert.match(pre[0], /onSeated=\{first=>\{setSeating\(/,
    "the throw must produce the seating that the sideboard then consumes");

  /* THE WINDOW GREW IN v2.79 and the anchor moved with it deliberately.
     `onStart` now chooses between two boards — the solo trainer and the
     merged table — so the handler is no longer a one-liner and a 400-char
     window stopped containing it. A regex that stops matching because the
     code it guards got longer is a drill that passes by finding nothing,
     so what is asserted is that the handler REACHES the trainer, not that
     it is the first thing in it. */
  const lo = CODE.match(/\{seating && !fighting && <Loadout[\s\S]{0,2600}?\/>\}/);
  assert.ok(lo, "Loadout is no longer entered from `seating` — the reorder was undone");
  assert.match(lo[0], /setFighting\(\{h:seating\.h/,
    "and the sideboard is the last thing before the game");
});

test("the sideboard is TOLD the seating, or boarding after the throw buys nothing", () => {
  const lo = CODE.match(/\{seating && !fighting && <Loadout[\s\S]{0,2600}?\/>\}/);
  assert.ok(lo, "Loadout is no longer entered from `seating`");
  assert.match(lo[0], /onPlay=\{seating\.first===0\}/,
    "the whole reason the sideboard follows the throw is that you board knowing whether " +
    "you are on the play — passing the seating is what makes the order mean anything");
});

/* ============================================================
   THERE IS NO OPPONENT PICKER (v2.81)

   RULING (user, 2026-08-16): seat 1 is either a PERSON, who picks their
   own hero when they join a table, or the dummy — and a seat the dummy
   fills is always the vanilla pile. There is no hero the dummy plays as.

   Five drills used to live here pinning the picker: where it sat, what
   it offered, and that the slot around it was not a button (a <select>
   inside one swallows its own clicks). They are replaced by the single
   claim that matters now, which is that NONE of it is there — because a
   picker is the sort of thing that comes back one branch at a time, and
   every branch it creates has to be carried by the trainer, the loadout,
   the pregame and the table.
   ============================================================ */
test("no opponent picker survives anywhere in the file", () => {
  assert.ok(!/id="foesel"/.test(CODE), "the dropdown is gone");
  assert.ok(!/\boppH\b/.test(CODE),
    "and so is the state it wrote to — `oppH` in live code means a branch somewhere is " +
    "still asking which kind of opponent this is");
  assert.ok(!/setOppH/.test(CODE));
});

test("the trainer and the table seat the SAME punching bag", () => {
  assert.match(CODE, /function VsStrip\(\{hero,db\}\)/,
    "the vs strip takes no opponent — P2 is the dummy, always");
  assert.match(CODE, /buildVanilla\(DUMMY_DECK, DUMMY_GEAR, db, rng, ctr/,
    "the trainer deals the pile through engine/build.js, not a copy of its own");
  assert.match(CODE, /heroes: \[seating\.h\.k, null\]/,
    "and the local table seats a NULL hero key, which buildMatch reads as the dummy — " +
    "both boards face the same opponent, so the only thing that differs between them " +
    "is which engine is driving, which is what makes them comparable");
  assert.match(CODE, /vanilla: \{deck: DUMMY_DECK, gear: DUMMY_GEAR/,
    "with the pile passed in as DATA, the same way buildSide takes a deck");
});

test("the table button is no longer gated on choosing a hero", () => {
  assert.ok(!/Pick a hero opponent to fight at the table/.test(CODE),
    "the merged engine can seat the vanilla pile now, so there is nothing left to ask for");
  assert.match(CODE, /onClick=\{startTable\}/, "and the button is unconditional");
});

test("the P2 slot keeps its poke button", () => {
  /* The slot itself was never a <button> — a <select> inside one swallows
     its own clicks, which would have made the picker unusable while
     looking perfectly fine. The select is gone; the taunt's nested button
     stays, because poking the dummy is the one bit of life on that
     screen. */
  const p2 = CODE.match(/className="vslot p2 clip-sm empty"[\s\S]{0,1200}/);
  assert.ok(p2, "the P2 slot moved — re-anchor this drill");
  assert.ok(!/<button className=\{?"vslot p2/.test(CODE), "the slot is not itself a button");
  assert.match(p2[0], /className="dmybtn"/, "the poke survives");
  assert.match(p2[0], /The Dummy/, "and it says who is sitting there");
});

