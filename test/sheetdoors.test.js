/* ============================================================
   A LIVE SHEET STOPS THE GAME ON EVERY TRAINER DOOR (v4.88)

   `judge.legal` freezes the game for both seats while a prompt is live,
   so every control the TABLE renders is dimmed off it and cannot disagree.
   The trainer has no single oracle: each control calls its own `setG`
   door, and v4.80 put the rule in four of them.

   THE DEAD-TAP SWEEP FOUND THE REST, driving every lit ⚡ at phone
   dimensions (scratch `phone/deadtap2.js`, recorded in CHANGELOG):

     - playRx, playRxA, the arsenal instant, the opponent's-turn window,
       the hand ability, the defend-to-react step, the arsenal step and
       PASS — RESOLVE had NO guard, so this board played a card the table
       refuses (v3.01's one-board shape);
     - the four that had one returned in SILENCE while every tile stayed
       lit — a dead tap, which reads as a broken screen (v2.83).

   A SOURCE CENSUS, because `Battle` is a React closure no drill can
   drive, and it says so. What it proves is the partition: every `setG`
   door in `Battle` either opens by asking `sheetFirst`, or is one of the
   pinned answers to a question already on screen. A door added without
   the guard fails here by name.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* Battle's body, bounded at the next top-level component (the safe form,
   v4.57: the next declaration, never a byte count). */
function battle(){
  const a = HTML.indexOf("\nfunction Battle(");
  const b = HTML.indexOf("\nfunction ", a + 10);
  assert.ok(a > 0 && b > a, "Battle moved — re-anchor this drill");
  return HTML.slice(a, b);
}
/* Every `const X = … setG(` door and its body, bounded at the next
   two-space declaration. */
function doors(){
  const src = battle();
  const out = [];
  const rx = /\n  const ([A-Za-z_]+) = [^\n]*?setG\(/g;
  let m;
  while((m = rx.exec(src))){
    const start = m.index + 1;
    const next = src.slice(start + 5).search(/\n  (?:const|function) /);
    out.push({name: m[1], body: src.slice(start, next < 0 ? src.length : start + 5 + next)});
  }
  return out;
}

/* THE ANSWERS: each responds to a question ALREADY on screen, so it is
   the way out of a sheet or a pending mode, never a way around one. The
   prompt sheet's own controls, and the pre-payment and payment modes,
   which `tryPlay` (guarded) is the only way into. */
const ANSWERS = ["promptToggle", "promptPick", "promptConfirm", "promptDecline", "promptTakeBackC",
                 "confirmBoost", "confirmCharge", "confirmFuse", "confirmPay", "cancelPay", "cancelDiscCost"];
const GUARDED = ["playRx", "playRxA", "playArsenalInstant", "playFoeTurnRx", "foePassWindow", "activateInstant",
                 "resolveStack", "tryPlay", "activateHand", "closeChain", "endTurn", "pickArsenal", "skipArsenal",
                 "doHeave", "toggleBlock", "moveToReact", "takeIt"];

test("the census finds the doors at all, or it passes by finding nothing", () => {
  const d = doors();
  assert.ok(d.length >= 25, "the door scan stopped matching — " + d.length);
  assert.ok(d.some(x => x.name === "tryPlay") && d.some(x => x.name === "takeIt"));
});

test("every door is either guarded or an answer — and the two sets are pinned, both directions", () => {
  const names = doors().map(x => x.name).sort();
  assert.deepEqual(names, [...ANSWERS, ...GUARDED].sort(),
    "a door was added or removed: decide whether it is a way INTO the game (guard it with `sheetFirst`) "
    + "or an ANSWER to a question already on screen, and pin it here");
});

test("every guarded door OPENS by asking `sheetFirst`", () => {
  for(const d of doors().filter(x => GUARDED.includes(x.name))){
    const code = strip(d.body);
    /* the guard STATEMENT — either spelling the doors use */
    const at = [code.indexOf("{ const _w = sheetFirst(s); if(_w) return _w; }"), code.indexOf("sheetFirst(s) ||")]
      .filter(i => i >= 0).sort((x, y) => x - y)[0];
    assert.ok(at >= 0, d.name + " never asks whether a sheet is open — it can play under one");
    /* FIRST, not somewhere: a door that refuses on mode first and asks the
       sheet second is fine only if nothing in between can act, and the
       simplest rule to hold is that nothing comes before it but `s.over`. */
    const before = code.slice(code.indexOf("setG(") + 5, at).replace(/^s\s*=>\s*/, "")
      .replace(/if\(s\.over\) return s;/g, "").replace(/[\s{(]/g, "");
    assert.equal(before, "", d.name + " does work before asking the sheet: " + JSON.stringify(before.slice(0, 80)));
  }
});

test("no door refuses a live sheet in SILENCE any more", () => {
  /* The v4.80 spelling returned `s` unchanged — a dead tap. Every guard
     says what is waiting now. */
  for(const d of doors()){
    assert.doesNotMatch(strip(d.body), /s\.prompt\)\s*return s;|\|\|\s*s\.prompt\)\s*return s/,
      d.name + " refuses a live sheet without saying so");
  }
});

test("`sheetFirst` names what is waiting, and passes when nothing is", () => {
  const src = strip(battle());
  const a = src.indexOf("const sheetFirst = s => {"), b = src.indexOf("\n  };", a);
  assert.ok(a > 0 && b > a, "sheetFirst moved");
  const body = src.slice(a, b);
  assert.match(body, /if\(!s\.prompt\) return null;/, "a door is refused with no sheet open");
  assert.match(body, /String\(s\.prompt\.title \|\| s\.prompt\.src \|\| "the sheet"\)/, "the refusal must name what is waiting");
  assert.match(body, /return L\(s, `Answer the open question first — /, "the refusal must be SAID, not a silent return");
  /* "Put an arrow face up in your arsenal?." — found on the page, v4.88 */
  assert.match(body, /\/\[\.\?!\]\$\/\.test\(what\) \? "" : "\."/, "a title ending in its own mark gets a second one");
});
