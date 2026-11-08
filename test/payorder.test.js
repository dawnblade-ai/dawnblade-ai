/* test/payorder.test.js — A PAID PRICE READS AFTER THE PITCH THAT PAID IT
   (FEED-7, findings/qa-c on v5.96: Bravo's Magmatic Carapace).

   THE ORDER OF THE LINES IS THE OBSERVABLE, so this asserts on feed prose —
   CLAUDE.md's exception ("never on feed prose, except where the line IS the
   observable"). Only the relative order of two lines is pinned, matched by a
   fragment.

   QA read "You paid 1 and tapped Magmatic Carapace — the rider resolves."
   BEFORE "Pitched Edge of Their Seats at instant speed (+3).", the pitch that
   paid it. v5.99 moved the payment line after `autoPitch` inside the shared
   `applyAnswer` (`_lateMsgs`), which both boards call — but nothing pinned it
   (test/qacfeed.test.js's header names it; no drill asserted it). These do,
   on BOTH boards:
     the TABLE     judge.reduce: play The Suspense is Killing Me (an aura),
                   Carapace's sheet opens, confirm it with no resource floating;
     the TRAINER   its own commit funnel (`setG`) and its own `promptConfirm`
                   handler, cut verbatim out of index.html
                   (test/helpers/trainerfunnel.js), around the shared body.
   Sabotage: the check reads QA's reported order as wrong, and a body that logs
   the payment early (the v5.96 order) fails both drills. */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const TF = require("./helpers/trainerfunnel.js");
const PM = require("../engine/prompts.js");
const J = H.J;
const skip = !H.hasDb() && "no cached card database";

const ORDER = [/pitches Edge of Their Seats at instant speed/, /paid 1 and tapped Magmatic Carapace/];
const inOrder = lines => { const ix = ORDER.map(re => lines.findIndex(l => re.test(String(l))));
  return {ix, ok: ix.every(i => i >= 0) && ix[1] > ix[0]}; };

/* Bravo, no resource floating, Edge of Their Seats in hand to pitch; playing
   The Suspense is Killing Me (an aura) opens Magmatic Carapace's pay sheet */
function sheet(){
  H.db();
  const mc = {...H.card("Magmatic Carapace"), uid: "mc1"};
  const sus = {...H.card("The Suspense is Killing Me", 3), uid: "s1"};
  const edge = {...H.card("Edge of Their Seats", 1), uid: "e1"};
  let g = H.state({name: "Bravo", res: 0, ap: 1, hand: [sus, edge], gear: [mc], deck: [{uid: "x", name: "X"}]},
                  {name: "Them", deck: [{uid: "d3", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "br", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const n = J.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0).state;
  assert.equal(n.prompt && n.prompt.tag, "pay", "Carapace's sheet is open (the fixture reaches the path)");
  assert.equal(n.prompt.src, "Magmatic Carapace");
  assert.equal(n.sides[0].res, 0, "nothing floating, so paying must pitch");
  return n;
}
const after = (before, n) => (n.feed || []).slice((before.feed || []).length);

test("THE TABLE — Bravo pitches, THEN pays 1 and taps Magmatic Carapace", {skip}, () => {
  const s = sheet();
  const chose = J.reduce(s, {t: "promptChoose", choice: "pay"}, 0);
  assert.equal(chose.error, null);
  const done = J.reduce(chose.state, {t: "promptConfirm"}, 0);
  assert.equal(done.error, null);
  const n = done.state;
  const lines = after(s, n);
  const r = inOrder(lines);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
  assert.ok(n.sides[0].pitch.some(c => c.uid === "e1"), "the pitch is real");
  assert.ok(n.sides[0].board.some(b => /Seismic Surge/.test(b.card && b.card.name)), "and the rider resolved");
});

/* the trainer's own promptConfirm handler, cut out of index.html */
function trainerConfirm(){
  const m = TF.HTML.match(/const promptConfirm = \(\) => setG\((s => promptReady\(s\.prompt\) \? _EFX\.applyAnswer\(s, s\.prompt\) : s)\);/);
  assert.ok(m, "the trainer's promptConfirm moved — re-anchor this drill");
  return new Function("promptReady", "_EFX", "return " + m[1] + ";");
}
test("THE TRAINER — its own setG funnel and promptConfirm, around the shared body: the same order", {skip}, () => {
  const s = sheet();
  const t = TF.trainerFunnel({...s, mode: "act", over: null});
  /* the trainer's promptPick: `{...s, prompt: promptChoose(s.prompt, choice)}` */
  assert.ok(/const promptPick = choice => setG\(s=> s\.prompt \? \{\.\.\.s, prompt:promptChoose\(s\.prompt, choice\)\} : s\);/.test(TF.HTML),
    "the trainer's promptPick moved — re-anchor this drill");
  t.setG(st => ({...st, prompt: PM.promptChoose(st.prompt, "pay")}));
  const body = trainerConfirm();
  t.setG(st => J.withEffects(st, (fx, n0) => body(PM.promptReady, fx)(n0)));
  const lines = after(s, t.g);
  const r = inOrder(lines);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
  assert.equal(t.g.prompt, null, "the sheet was answered");
});

test("SABOTAGE — the check reads QA's reported order as wrong, and a missing line is not a pass", () => {
  assert.equal(inOrder(["You paid 1 and tapped Magmatic Carapace — the rider resolves.", "You pitches Edge of Their Seats at instant speed (+3)."]).ok, false);
  assert.equal(inOrder(["You paid 1 and tapped Magmatic Carapace — the rider resolves."]).ok, false);
  assert.equal(inOrder(["Bravo pitches Edge of Their Seats at instant speed (+1).", "Bravo paid 1 and tapped Magmatic Carapace — the rider resolves."]).ok, true);
});
