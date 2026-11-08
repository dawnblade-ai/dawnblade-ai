/* test/feedorder.test.js — THE FEED READS IN THE ORDER THINGS HAPPENED
   (FEED-7, findings/qa-c on v5.96).

   THE ORDER OF THE LINES IS THE OBSERVABLE here, so these drills assert on
   feed prose — CLAUDE.md's exception: "never on feed prose, except where the
   line IS the observable". What they pin is only the RELATIVE ORDER of lines
   (which index each one sits at), matched by a fragment, never their wording.

   Two cases QA read backwards on the trainer:
     Big Bertha   Dash boosts Crankshaft and banishes Big Bertha: the feed
                  said "Big Bertha: … nothing that can take a steam counter",
                  THEN "Dash plays Crankshaft", THEN the banish that caused it.
     Oasis Respite "+1 life." came BEFORE "plays Oasis Respite", so the gain
                  read as the card pitched on the line above.
   The cause was one body, effects.execute, which both boards call: a boost's
   banish rode in `declNote` (printed by the caller after the declaration)
   while the banished card's trigger logged at once; and a non-attack card's
   play line was printed after the conditions loop had run its riders. Each
   drill drives the table (judge.reduce) and the shared `execute` the trainer
   calls, and each has a sabotage: the drill reads the wrong order as wrong. */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const J = H.J;
const skip = !H.hasDb() && "no cached card database";

/* the index of the first line (at or after `from`) matching each fragment, in turn */
const at = (lines, re) => lines.findIndex(l => re.test(String(l)));
const inOrder = (lines, res) => { const ix = res.map(re => at(lines, re)); return {ix, ok: ix.every(i => i >= 0) && ix.every((v, i) => i === 0 || v > ix[i - 1])}; };

/* ---- Big Bertha ---------------------------------------------------------- */
function dash(){
  H.db();
  const crank = {...H.card("Crankshaft", 1), uid: "src1"};
  const bb = {...H.card("Big Bertha", 3), uid: "bb1"};
  let g = H.state({name: "Dash", res: 9, ap: 3, hand: [crank], deck: [bb, {uid: "d2", name: "Filler"}]},
                  {name: "Them", deck: [{uid: "d3", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "bb", turn: 4});
  return {g: {...g, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true}, crank};
}
const BERTHA = [/plays Crankshaft/, /Boost: Big Bertha banished/, /^Big Bertha:/];

test("BIG BERTHA, AT THE TABLE — the play, then the boost banish, then the banished card's trigger", {skip}, () => {
  const {g} = dash();
  const f0 = (g.feed || []).length;
  let n = J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
  n = J.reduce(n, {t: "boost", yes: true}, 0).state;
  const lines = n.feed.slice(f0);
  const r = inOrder(lines, BERTHA);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
  assert.equal(n.sides[0].banish[0].uid, "bb1", "and the boost happened (the banish is real)");
});

test("BIG BERTHA, IN THE SHARED execute (the trainer's path) — the same order, and the banish no longer rides in declNote", {skip}, () => {
  const {g, crank} = dash();
  const f0 = (g.feed || []).length;
  const n = H.execute({...g, sides: g.sides.map((sd, i) => i ? sd : {...sd, hand: []})}, crank, "hand", 0, {attacking: true, isAtk: true, target: "hero"});
  const lines = n.feed.slice(f0);
  const r = inOrder(lines, BERTHA);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
  assert.ok(n._declared, "an attack declaration for the caller");
  assert.ok(!/Boost:/.test(n._declared.declNote || ""),
    "the trainer prints declNote after its defend note — a boost line left in it would print twice");
});

/* ---- Oasis Respite ------------------------------------------------------- */
function oasis(){
  H.db();
  const card = {...H.card("Oasis Respite", 1), uid: "oa1"};
  let g = H.state({name: "Dorinthea", res: 9, ap: 3, hp: 10, hand: [card], deck: [{uid: "x1", name: "X"}]},
                  {name: "Them", hp: 20, deck: [{uid: "d3", name: "T"}]}, {actor: 0, turnPlayer: 0, seed: "oo", turn: 4});
  return {g: {...g, phase: "action", step: "layer", priority: 0, passed: []}, card};
}
const OASIS = [/plays Oasis Respite/, /^\+1 life/];

test("OASIS RESPITE, AT THE TABLE — the play line comes before the life it grants", {skip}, () => {
  const {g} = oasis();
  const f0 = (g.feed || []).length;
  const n = J.reduce(g, {t: "play", uid: "oa1", from: "hand"}, 0).state;
  const lines = n.feed.slice(f0);
  assert.equal(n.sides[0].hp, 11, "the rider really fired (less life than the other hero)");
  const r = inOrder(lines, OASIS);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
  assert.equal(lines.filter(l => /plays Oasis Respite/.test(l)).length, 1, "announced once, not twice");
});

test("OASIS RESPITE, IN THE SHARED execute — the same order", {skip}, () => {
  const {g, card} = oasis();
  const f0 = (g.feed || []).length;
  const n = H.execute({...g, sides: g.sides.map((sd, i) => i ? sd : {...sd, hand: []})}, card, "hand", 0, {});
  const lines = n.feed.slice(f0);
  const r = inOrder(lines, OASIS);
  assert.ok(r.ok, "order " + JSON.stringify(r.ix) + " in:\n  " + lines.join("\n  "));
});

test("SABOTAGE — the check reads QA's reported (backwards) orders as wrong, and an unreached rider does not pass vacuously", () => {
  assert.equal(inOrder(["Big Bertha: Dash controls nothing that can take a steam counter.", "Dash plays Crankshaft — 5 power on the chain.",
                        "Boost: Big Bertha banished — Mechanologist, go again!"], BERTHA).ok, false);
  assert.equal(inOrder(["+1 life.", "Dorinthea plays Oasis Respite.", "Ward 4."], OASIS).ok, false);
  assert.equal(inOrder(["Dorinthea plays Oasis Respite.", "Ward 4."], OASIS).ok, false, "a missing line is a failure, not a pass");
  assert.equal(inOrder(["Dorinthea plays Oasis Respite.", "+1 life.", "Ward 4."], OASIS).ok, true);
});
