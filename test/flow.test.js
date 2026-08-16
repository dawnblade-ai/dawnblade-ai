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
  assert.match(lo[0], /oppH=\{oppH\}/, "and knowing the matchup");
});

test("Loadout no longer OWNS the opponent — it is a prop", () => {
  assert.match(CODE, /function Loadout\(\{h,db,onBack,onStart,netFoe,netOnPlay,oppH,onPlay\}\)/,
    "oppH and onPlay arrive as props; both are settled before this screen opens");
  assert.ok(!/const \[oppH,setOppH\] = uS\(/.test(CODE),
    "a second copy of the choice inside Loadout would let the throw and the sideboard " +
    "disagree about who is across the table");
});

test("the opponent picker lives on the HERO screen, and defaults to the Dummy", () => {
  assert.match(CODE, /function VsStrip\(\{hero,db,oppH,setOppH\}\)/,
    "the vs strip owns the picker now");
  assert.match(CODE, /<VsStrip hero=\{hero\} db=\{db\} oppH=\{oppH\} setOppH=\{setOppH\}\/>/,
    "and App wires it");
  assert.match(CODE, /const \[oppH,setOppH\]=uS\(null\)/,
    "null is the vanilla Dummy — the one deck where nothing can be faked, so it is the " +
    "honest default to open on");
  /* exactly one picker in the file: two would drift */
  const pickers = (CODE.match(/id="foesel"/g) || []).length;
  assert.equal(pickers, 1, "exactly one opponent picker in the file");
});

test("the picker still offers the Dummy, a random hero and every hero", () => {
  const sel = CODE.match(/<select id="foesel"[\s\S]{0,700}?<\/select>/);
  assert.ok(sel, "the picker moved — re-anchor this drill");
  assert.match(sel[0], /<option value="">The Dummy/, "the vanilla pile is still an option");
  assert.match(sel[0], /<option value="\?">Random hero<\/option>/);
  assert.match(sel[0], /HEROES\.map\(x=><option key=\{x\.k\} value=\{x\.k\}>/,
    "and the roster is read from HEROES rather than listed by hand");
});

test("the seat the picker sits in is not a button", () => {
  /* A <select> inside a <button> swallows its own clicks — the dummy's
     poke had to move to a nested button so the dropdown stays usable. */
  /* A fixed window rather than a `</div>` terminator: the slot contains
     nested divs, so a non-greedy match to the first closing tag stops
     inside the wrong branch and the drill fails for a reason that has
     nothing to do with the claim. */
  const p2 = CODE.match(/className=\{"vslot p2 clip-sm"[\s\S]{0,1400}/);
  assert.ok(p2, "the P2 slot moved — re-anchor this drill");
  assert.ok(!/<button className=\{"vslot p2/.test(CODE),
    "the slot itself must not be a <button>: a <select> inside one swallows its own clicks, " +
    "which would make the picker unusable while looking perfectly fine");
  assert.match(p2[0], /className="dmybtn"/,
    "the taunt keeps its own nested button so the picker stays reachable");
  assert.match(p2[0], /id="foesel"/, "and the picker really does live in this slot");
});
