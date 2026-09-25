/* ============================================================
   A SHEET WITH NOTHING TO DECIDE IS CONFIRMED ON THE SPOT (v4.68)

   v3.55's rule — a sheet offering one forced choice is a tap that teaches
   nothing — lived in `ctrPut`'s own fast path and nowhere else. Measured
   over 210 driven games, 114 pick sheets were a MANDATORY choice among
   ONE card, 108 of them Fai's hero ability over a graveyard holding a
   single Phoenix Flame.

   `buildPrompt` could not apply the rule: answering null there SKIPS the
   spec, so the card the printed line moves would never move. So the rule
   is a READER (`promptForcedSel`) and both boards' `openPrompt` confirm a
   forced sheet through the one `applyAnswer` a Confirm tap reaches.

   WHAT THIS FILE HOLDS:
     - which sheets are forced, both directions — an OPTIONAL pick over one
       card and a mandatory pick over two are both real decisions
     - the premise that lets the reader carry no `filters` guard
     - the forced answer drains the REST of the queue, like a tap would
     - the trainer's `openPrompt` asks the same reader, through the same
       body, before it can hand the sheet to anybody
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const PM = require("../engine/prompts.js");
const H  = require("./helpers/judged.js");
const J  = H.J;

const skip = !H.hasDb() && "no cached DB";

const card = (uid, extra) => Object.assign({uid, name: "Card " + uid, pitch: 1, cost: 0, power: 3,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []}, extra || {});
const game = grave => ({sides: [{hand: [], deck: [], grave, board: [], gear: [], arsenal: null,
                                 pitch: [], banish: [], soul: []}, {hand: [], deck: [], grave: [],
                                 board: [], gear: [], arsenal: null, pitch: [], banish: [], soul: []}]});
const live = (grave, spec) => PM.buildPrompt(game(grave),
  Object.assign({tag: "pick", side: 0, src: "SYN", zone: "grave", to: "hand"}, spec));

/* ---- 1. WHICH SHEETS ARE FORCED ----------------------------------------- */

test("a MANDATORY pick over exactly ONE card is forced", () => {
  assert.deepEqual(PM.promptForcedSel(live([card("a")], {min: 1, max: 1})), [0]);
  /* "any number" with a floor of one, over one card, is the same question */
  assert.deepEqual(PM.promptForcedSel(live([card("a")], {min: 1, maxAll: true})), [0]);
});

test("…and every real decision is NOT — both directions (v4.12)", () => {
  assert.equal(PM.promptForcedSel(live([card("a"), card("b")], {min: 1, max: 1})), null,
    "two candidates is a choice");
  assert.equal(PM.promptForcedSel(live([card("a"), card("b")], {min: 2, max: 2, to: "deckTop"})), null,
    "two cards for two slots onto a deck is still a decision — the ORDER is the answer (v4.59)");
  assert.equal(PM.promptForcedSel(live([card("a")], {min: 0, max: 1})), null,
    "an OPTIONAL pick over one card is take-it-or-decline — the printed 'you may' is the decision");
  assert.equal(PM.promptForcedSel(null), null);
  assert.equal(PM.promptForcedSel({tag: "modal", min: 1, cards: [card("a")]}), null,
    "only a pick — a modal's modes are its own vocabulary");
});

test("THE PREMISE THAT LETS THE READER CARRY NO `filters` GUARD", () => {
  /* A sheet naming TWO targets cannot reach the reader with one candidate —
     `buildPrompt` refuses it as unsatisfiable (v4.59's livelock guard) —
     and a sheet naming ONE target over one card is exactly the forced
     case. The day `buildPrompt` stops refusing the first, this fails and a
     guard has something to guard. */
  const two = [{type: "attack"}, {type: "nonAttack"}];
  assert.equal(live([card("a")], {filters: two}), null,
    "an unsatisfiable two-target sheet was BUILT");
  const one = live([card("a")], {filters: [{type: "attack"}]});
  assert.ok(one, "fixture: a one-target sheet over its one card should build");
  assert.deepEqual(PM.promptForcedSel(one), [0], "…and is forced, correctly");
});

/* ---- 2. DRIVEN AT THE TABLE --------------------------------------------- */

test("the forced answer lands AND drains the rest of the queue to the next real sheet", {skip}, () => {
  H.db();
  const g = {...H.state({res: 9, ap: 1, grave: [card("g1")], hand: [card("h1"), card("h2")]}, {},
                        {turn: 3, actor: 0, turnPlayer: 0}),
             phase: "action", step: "layer", priority: 0};
  g.promptQ = [
    {tag: "pick", side: 0, src: "SYN-A", zone: "grave", to: "hand", min: 1, max: 1},
    {tag: "pick", side: 0, src: "SYN-B", zone: "hand", to: "grave", min: 1, max: 1}];
  const n = J.openPrompt(g);
  assert.ok(n.sides[0].hand.some(c => c.uid === "g1"), "the forced card never moved");
  assert.ok(n.prompt && n.prompt.src === "SYN-B",
    "the queue stalled behind a sheet nobody was shown — a forced answer must drain like a tap");
  assert.equal(n.prompt.cards.length, 3, "…and the real sheet sees the card the first one moved");
  assert.deepEqual(n.promptQ, [], "…with nothing left behind it");
});

test("an OPTIONAL one-card pick still ASKS, at the table", {skip}, () => {
  H.db();
  const g = {...H.state({res: 9, ap: 1, grave: [card("g1")]}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
             phase: "action", step: "layer", priority: 0};
  g.promptQ = [{tag: "pick", side: 0, src: "SYN", zone: "grave", to: "hand", min: 0, max: 1}];
  const n = J.openPrompt(g);
  assert.ok(n.prompt, "a printed 'you may' over one card was taken without asking");
  assert.ok(!n.sides[0].hand.length, "…and nothing moved before the answer");
});

/* ---- 3. THE TRAINER ASKS THE SAME READER -------------------------------- */

/* `Battle` is a React closure in a `text/babel` block and cannot be loaded
   in Node, so this half is a scan — bounded at the next same-indent
   declaration (v4.57's safer form) with comments stripped, because the
   rule's own prose names the call it looks for (v4.27, v4.32). */
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function trainerOpenPrompt(){
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const a = html.indexOf("  function openPrompt(s){");
  assert.ok(a > 0, "fixture: the trainer's openPrompt moved");
  const rest = html.slice(a + 10);
  const b = rest.search(/\n  (?:function|const|let) /);
  return strip(html.slice(a, a + 10 + b));
}

test("the trainer's openPrompt confirms a forced sheet through the SAME body", () => {
  const body = trainerOpenPrompt();
  const ask = body.indexOf("const forced = promptForcedSel(live);");
  assert.ok(ask > 0, "the trainer never asks — every forced sheet is a dead tap on the board a player uses");
  /* THE WHOLE CONDITIONAL IS PINNED, not the identifier: `if(false && …)`
     keeps every name intact and a scan for names walks straight through it
     (v4.00, v4.55). What the pin cannot see is a live call that is
     unreachable some other way — that half is the judge drills above,
     which drive the same reader through the same body. */
  assert.ok(body.includes("if(forced) return _EFX.applyAnswer({...s, promptQ:rest}, {...live, sel: forced});"),
    "a forced sheet answered by anything but `applyAnswer`, or not with the rest of the queue, " +
    "is a second copy of the payout or a queue that never drains");
  /* BEFORE THE SEAT-1 HAND-OFFS AND THE RETURN, or a forced sheet addressed
     to seat 1 is answered by a policy and one addressed to seat 0 is shown */
  assert.ok(ask < body.indexOf("foeAnswerSoak("), "asked after the seat-1 soak hand-off");
  assert.ok(ask < body.indexOf("prompt:live"), "asked after the sheet is already returned");
  assert.ok(ask > body.indexOf("buildPrompt(s, p)"), "asked of a spec, not of the built sheet");
});

test("the scan is alive: a trainer that never asks is reported", () => {
  const body = trainerOpenPrompt();
  const dead = body.replace("if(forced) return", "if(false && forced) return");
  assert.ok(!dead.includes("if(forced) return _EFX.applyAnswer("),
    "the pin cannot tell a neutered call from a live one");
  /* and the stripper does not eat code — the anchor survives it */
  assert.ok(strip("x = promptForcedSel(live); /" + "* promptForcedSel(live) *" + "/").includes("promptForcedSel(live)"));
  assert.ok(!strip("/" + "* promptForcedSel(live) *" + "/").includes("promptForcedSel"));
});
