/* THE FIND-AN-OPPONENT SCREEN TELLS THE TRUTH ABOUT THE TABLE (1.0 polish audit).

   Its note said "Card text does not resolve yet: the parser's effects still
   live in the solo trainer" for many releases after engine/effects.js gave
   both boards one copy of the card semantics — stale copy that tells a
   player the table is a lesser game, in an identifier's words ("the
   parser's effects"). The line IS the observable here: this drill reads
   the player-visible text of `TableScreen`, comments stripped. */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function visibleText(fnName){
  const at = html.indexOf("function " + fnName + "(");
  assert.ok(at > 0, fnName + " is in index.html");
  const next = html.indexOf("\nfunction ", at + 10);
  const body = html.slice(at, next > 0 ? next : undefined)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")      // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, "");         // block comments
  /* text between tags, the words a player sees */
  return (body.match(/>[^<>{}]+</g) || []).map(t => t.slice(1, -1)).join(" ").replace(/\s+/g, " ");
}

test("the table note does not say card text is missing at the table", () => {
  const t = visibleText("TableScreen");
  assert.ok(/two real hero decks/i.test(t), "the note is still there: " + t.slice(0, 200));
  assert.ok(!/does not resolve|do not resolve|not resolve yet/i.test(t), "stale claim: " + t);
  assert.ok(!/parser|effects\.js|engine\/|\bfx[A-Z]/.test(t), "an identifier in player copy: " + t);
  assert.ok(/card text/i.test(t), "the note says the card text is played: " + t);
});
