/* ============================================================
   A FREE OPTIONAL PICK IS TAKEN; A PRICED ONE IS LEFT ALONE (QUEUE v4 H12)
   a policy for the arsenal that never stores a dead card (H13), and a
   charge that asks for the colour the card pays off for (H14a).

   `judge.autoAnswer` declined every `min:0` pick, including ones the seat
   had already paid for. `judge.freePick` names the free ones; the others
   (any cost, a filter, a discard, "all of them", a caller's pool, a board
   or gear zone, a hand to banish or graveyard) are declined as before.
   Driven on real cards; asserted on zones and hands, never on feed prose
   except where the line IS the observable (the `explain` drills say so).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const PM = require("../engine/prompts.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, H.card(n, p), {uid});
const piece = (n, uid) => { const g = ent(n, 0, uid); P.fxReset(); B.equipPiece(g); P.fxReset(); return g; };
const atk = (uid, pitch, power) => ({uid, name: "Probe " + uid, pitch, power: power || 3, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const table = (mine, extra) => Object.assign(
  H.state(Object.assign({name: "You", res: 0, ap: 1, deck: [atk("d1", 3)]}, mine), {hp: 20, hand: [], deck: [atk("t1", 3)]},
    {actor: 0, turnPlayer: 0, turn: 3}),
  {phase: "action", step: "layer", priority: 0, passed: []}, extra || {});

/* let the seat policy answer everything that blocks play, until it is clear */
const settle = (n, seat) => {
  for(let i = 0; i < 20 && (n.prompt || n.pending); i++){
    const a = SP.act(n, seat || 0);
    assert.ok(a, "the policy proposed nothing for " + JSON.stringify(n.prompt || n.pending).slice(0, 80));
    const r = J.reduce(n, a, seat || 0);
    assert.ok(r.state && !r.refused, "refused: " + JSON.stringify(r).slice(0, 120));
    n = H.drain(r.state);
  }
  return n;
};
const names = zone => zone.map(c => c.name);

test("H12 taken: Death Dealer and Bull's Eye Bracers put the arrow in the arsenal, and Death Dealer draws", {skip}, () => {
  for(const [nm, drew] of [["Death Dealer", true], ["Bull's Eye Bracers", false]]){
    const gr = piece(nm, 41);
    const g = table({gear: [gr], arsenal: null, res: 2, hand: [ent("Swift Shot", 1, 701), atk("pitch1", 1)]});
    assert.equal(J.legal(g, {t: "activate", uid: 41, from: "gear"}, 0), null, nm + " is not playable here");
    let n = H.drain(J.reduce(g, {t: "activate", uid: 41, from: "gear"}, 0).state);
    n = settle(n);
    assert.equal(n.sides[0].arsenal && n.sides[0].arsenal.name, "Swift Shot", nm + ": the arrow reaches the arsenal");
    assert.equal(n.sides[0].hand.some(c => c.name === "Swift Shot"), false);
    assert.equal(n.sides[0].hand.some(c => c.uid === "d1"), drew, nm + ": the draw (Death Dealer only)");
  }
});

test("H12 taken: Rise from the Ashes brings a Phoenix Flame back to hand", {skip}, () => {
  const g = table({hand: [ent("Rise from the Ashes", 1, "rise")], grave: [ent("Phoenix Flame", 0, "pf")], res: 5});
  let n = H.drain(J.reduce(g, {t: "play", uid: "rise", from: "hand"}, 0).state);
  assert.ok(n.prompt && J.freePick(n.prompt) === "dead", "the pick is a free dead-zone pick");
  n = settle(n);
  assert.deepEqual(names(n.sides[0].hand), ["Phoenix Flame"]);
  assert.equal(n.sides[0].grave.some(c => c.uid === "pf"), false);
});

/* the ring's own games, because some pickers only open mid-combat: the legs
   below are the ones that reach each card; every prompt is real, and the
   answer is the policy's own (`autoAnswer`) */
const T = require("../tools/tournament.js");
const probe = (a, ch) => {
  const out = {};
  const real = PM.buildPrompt;
  PM.buildPrompt = function(game, spec){
    const p = real.apply(this, arguments);
    if(p && p.tag === "pick" && !(p.min > 0) && p.src){
      const ans = J.autoAnswer(Object.assign({}, game, {prompt: p}));
      (out[p.src] = out[p.src] || []).push({cls: J.freePick(p), ans: ans && ans.t,
        pick: ans && ans.t === "promptSel" ? (p.cards || [])[ans.i] : null, p});
    }
    return p;
  };
  try { const E = T.ENTRANTS; T.leg(E[a], E[(a + 5) % E.length], "col-" + a, ch); }
  finally { PM.buildPrompt = real; }
  return out;
};
const GAMES = {};
const games = a => GAMES[a] || (GAMES[a] = probe(a, 0));
const seen = (a, src) => {
  const k = Object.keys(games(a)).find(s => s.startsWith(src));
  assert.ok(k, src + " never asked in the leg that is meant to reach it — re-anchor the leg");
  return games(a)[k];
};

test("H12 taken (driven games): the reveal for Crash and Bash's Seismic Surge, and Sigil's graveyard banish", {skip}, () => {
  for(const r of seen(4, "Crash and Bash")){ assert.equal(r.cls, "rev"); assert.equal(r.ans, "promptSel"); }
  for(const r of seen(2, "Sigil of Silphidae")){ assert.equal(r.cls, "dead"); assert.equal(r.ans, "promptSel"); }
});

test("H12 still declined: every priced pick keeps its refusal", {skip}, () => {
  const declined = [[4, "Pick Up the Point"], [2, "Condemn to Slaughter"], [8, "Golden Tipple"], [10, "Blaze"]];
  for(const [a, src] of declined) for(const r of seen(a, src)){
    assert.equal(r.cls, null, src + " is not a free pick");
    assert.equal(r.ans, "promptConfirm", src + " is declined");
  }
});

/* ---- the classifier, every exclusion beside its positive control ---- */
test("freePick: each exclusion refuses, and the control beside it is taken", () => {
  const base = {tag: "pick", zone: "grave", to: "hand", cost: 0, min: 0, cards: [{uid: "a"}]};
  assert.equal(J.freePick(base), "dead");
  assert.equal(J.freePick({...base, zone: "deck", to: "banish"}), "dead");
  assert.equal(J.freePick({...base, zone: "hand", to: null}), "rev");
  assert.equal(J.freePick({...base, zone: "hand", to: "arsenal"}), "ars");
  const no = o => assert.equal(J.freePick({...base, ...o}), null, JSON.stringify(o));
  no({cost: 1}); no({filters: [{}]}); no({discard: {by: 0}}); no({maxAll: true}); no({zone: null});
  no({zone: "board", to: "grave"}); no({zone: "gear", to: "hand"}); no({zone: "grave", to: "gear"});
  no({zone: "hand", to: "banish"}); no({zone: "hand", to: "grave"});
  assert.equal(J.freePick(null), null);
});

test("a free pick takes the highest printed power, ties on uid", () => {
  const g = H.state({name: "You", hand: []}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const p = {tag: "pick", side: 0, zone: "grave", to: "hand", cost: 0, min: 0, sel: [],
    cards: [{uid: "b", power: 3}, {uid: "c", power: 6}, {uid: "a", power: 6}, {uid: "d", power: 1}]};
  assert.deepEqual(J.autoAnswer(Object.assign({}, g, {prompt: p})), {t: "promptSel", i: 2}, "a before c");
});

/* ---- H13: the arsenal never stores a card that cannot leave it ---- */
const arsenalStep = (hand, hero) => {
  const g = table({hand, name: hero || "Enigma"});
  return Object.assign(g, {phase: "end", arsenalFor: 0, arsenal: null});
};
test("H13: Enigma with only Test of Strength and On the Horizon stores nothing", {skip}, () => {
  const g = arsenalStep([ent("Test of Strength", 1, "ts"), ent("On the Horizon", 1, "oh")]);
  g.sides[0].arsenal = null;
  const a = SP.act(g, 0);
  assert.deepEqual(a, {t: "arsenal", uid: null});
  assert.equal(SP.explain(g, 0).key, "arsenalSkip");
  assert.deepEqual(SP.explain(g, 0).action, a, "explain holds act's action");
});
test("H13: with an attack in hand it is the one stored; Inner Chi never is", {skip}, () => {
  const wb = ent("Wounding Blow", 1, "wb");
  const g = arsenalStep([ent("Test of Strength", 1, "ts"), wb]);
  assert.deepEqual(SP.act(g, 0), {t: "arsenal", uid: "wb"});
  assert.equal(SP.explain(g, 0).key, "arsenalBest");
  const c = arsenalStep([ent("Inner Chi", 1, "ic")]);
  assert.equal(J.arsenalUsable(c, 0, "ic"), false, "Inner Chi has no play");
  assert.deepEqual(SP.act(c, 0), {t: "arsenal", uid: null});
});
test("H13: a playable non-attack is kept under its own reason", {skip}, () => {
  const g = arsenalStep([ent("Condemn to Slaughter", 1, "cs")]);
  const x = SP.explain(g, 0);
  assert.deepEqual(x.action, {t: "arsenal", uid: "cs"});
  assert.equal(x.key, "arsenalOther");
});

/* ---- H14a: charge the colour the card pays off for ---- */
const chargeGame = nm => {
  const card = ent(nm, 1, "pc");
  const g = table({hand: [atk("red", 1), atk("yel", 2), atk("blu", 3)], name: "Boltyn", soul: []});
  g.pending = {kind: "charge", card, uids: ["red", "yel", "blu"], picked: [], seat: 0};
  return g;
};
test("H14a: Beaming Bravado charges the yellow; Bolt of Courage the lowest", {skip}, () => {
  for(const nm of ["Beaming Bravado"]){
    const g = chargeGame(nm);
    assert.equal(J.chargePitchWanted(g), 2, nm + " asks for yellow");
    assert.equal(SP.act(g, 0).uid, "yel", nm);
    assert.equal(SP.explain(g, 0).key, "chargeColour");
    assert.match(SP.explain(g, 0).why, /yellow/);
  }
  const g = chargeGame("Bolt of Courage");
  assert.equal(J.chargePitchWanted(g), null);
  assert.equal(SP.act(g, 0).uid, "red");
  assert.equal(SP.explain(g, 0).key, "charge");
});
