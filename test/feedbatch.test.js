/* ============================================================
   THE FEED BATCH (v5.28) — QUEUE item 14, part one

   Lines the player reads that said something false or read as a field
   name. Each row is the line a real resolution prints, with the state
   asserted beside it so a reworded line cannot hide a moved number.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const vanilla = (nm, uid, power) => ({name: nm, uid, pitch: 1, cost: 0, power: power || 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const said = g => (g.feed || []).map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

/* [11] A pick line in words, never state keys. */
test("[11] the shared pick line names the zones in words", () => {
  const g = H.state({grave: [vanilla("Swift Probe", "g1")], deck: [vanilla("Deck", "d1")]}, {});
  const p = PM.buildPrompt(g, {tag: "pick", side: 0, src: "Probe", zone: "grave", to: "deckTop", min: 1, max: 1});
  assert.equal(p.hint, "From your graveyard to the top of your deck.");
  const r = PM.applyPrompt(g, {...p, sel: [0]});
  assert.equal(r.game.sides[0].deck[0].uid, "g1", "fixture: the card moved");
  const line = r.msgs.join(" | ");
  assert.match(line, /Swift Probe goes from the graveyard to the top of the deck\./);
  assert.doesNotMatch(line, /deckTop|→| from grave\b/);
});

test("[11] every destination the engine sends a pick to has a word", () => {
  /* A census over the engine's own `to:` values, so a new destination that
     falls through to its key fails here rather than in the feed. */
  const fs = require("fs");
  const src = ["parser", "effects", "judge", "prompts"].map(f => fs.readFileSync("engine/" + f + ".js", "utf8")).join("\n");
  const tos = new Set((src.match(/\bto: *"([a-zA-Z]+)"/g) || []).map(m => m.match(/"(\w+)"/)[1]));
  assert.ok(tos.size >= 6, "the scan found " + tos.size + " destinations");
  for(const t of tos) if(t !== "steal")
    assert.doesNotMatch(PM.promptDestWord(t), /[a-z][A-Z]|\bgrave\b/, t + " -> " + PM.promptDestWord(t));
});

/* [14] A one-event shield's leftover is lost, and the line says so. */
test("[14] a shield bigger than the hit says its leftover is lost", () => {
  const g = H.state({hp: 20, wardNext: [{n: 3, src: "Throw Caution to the Wind", ops: []}]}, {});
  const o = H.J.withEffects(g, (fx, s) => fx.preventDamage(s, 0, 1, "Probe"));
  assert.equal(o.dealt, 0, "fixture: the hit was prevented");
  assert.deepEqual(o.game.sides[0].wardNext, [], "and the shield is gone");
  const f = said(o.game);
  assert.match(f, /1 of that damage is prevented — the other 2 it could have stopped is lost with this hit/);
  assert.doesNotMatch(f, /goes with this hit/);
});

/* [15] Bare Fangs' bonus lands, and nothing says it skipped. */
test("[15] a discard6way EFFECT is not told it had no additional-cost discard", {skip}, () => {
  H.db(); P.fxReset();
  const bf = Object.assign(H.card("Bare Fangs", 1), {uid: "bf"});
  const g = H.state({hand: [bf], res: 9, ap: 1, deck: [vanilla("Big Top", "t1", 7)]}, {hp: 20},
                    {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const n = H.execute(g, bf, "hand", 0, {});
  assert.equal(n.pend.total, bf.power + 2, "fixture: the 7-power card was discarded and the bonus landed");
  assert.doesNotMatch(said(n), /bonus skips/);
});

/* ============================================================
   PART TWO (v5.29): [16]-[18] and N8-N11.
   ============================================================ */
const B = require("../engine/build.js");
const J = H.J;
const E = require("../engine/effects.js");

/* [16] The turn header comes before that turn's start-phase lines. */
test("[16] TABLE: a start-phase trigger prints under its own turn's header", () => {
  const aura = {uid: "au", name: "Brief Aura", tt: "Generic Action - Aura",
                ty: ["Generic", "Action", "Aura"], tx: "", kw: []};
  const deck = p => [1, 2, 3, 4].map(i => vanilla(p, p + i));
  let g = {...H.state({deck: deck("A")}, {board: [{card: aura, kind: "aura", uid: "au", sd: "turn"}], deck: deck("B")},
                      {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  g = J.reduce(g, {t: "endTurn"}, 0).state;
  for(let i = 0; i < 10 && g.turnPlayer === 0; i++) g = J.reduce(g, {t: "pass"}, g.priority).state;
  assert.equal(g.turnPlayer, 1, "fixture: the turn handed over");
  assert.ok(!g.sides[1].board.length, "fixture: the aura was swept at the top of the turn");
  const lines = g.feed.map(f => (typeof f === "string" ? f : f.t));
  const head = lines.findIndex(t => /'s turn 4 —/.test(t));
  const swept = lines.findIndex(t => /Brief Aura/.test(t));
  assert.ok(head >= 0 && swept > head, "header " + head + " before the sweep " + swept);
});

test("[16] TRAINER: the start-phase header opens `newTurn`'s lines", () => {
  /* The trainer's `newTurn` is a closure inside Battle, so this is a source
     pin of WHERE the header is written: before the thaw, the suspense tick
     and the sweep, never after them. */
  const src = require("fs").readFileSync("index.html", "utf8");
  const at = src.indexOf("let n = L({...s}, `— Turn ${s.turn+1}. Start phase");
  assert.ok(at > 0, "the header is the first line of the start phase");
  const thaw = src.indexOf("DawnEffects.thawFreeze(n, 0)");
  assert.ok(thaw > at, "and the thaw comes after it");
  assert.equal(src.indexOf("let out = L(fresh, `— Turn"), -1, "and it is not written a second time below");
});

/* [17] Waxing Specter's entry clause is not asked when Cosmo swings it. */
function cosmoTable(auraName){
  const X = require("./helpers/extract.js"), G = require("../engine/game.js"), RNG = require("../engine/rng.js");
  const Wd = X.loadData(), c = {n: 0};
  let rng = RNG.make("feed-cosmo");
  const h0 = Wd.HEROES.find(x => x.k === "enigma"), h1 = Wd.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(Wd.DECKS.enigma), H.db(), rng, c); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(Wd.DECKS.kayo), H.db(), rng, c); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k],
                      rng, first: 0, tokSeq: c.n});
  const au = Object.assign({}, H.card(auraName, 3), {uid: "ws1"});
  const sides = g.sides.slice();
  sides[0] = {...sides[0], res: 9, hand: [], pitch: [], board: [{card: au, kind: "aura", uid: "ws1"}]};
  return {g: {...g, sides}, uid: "ws1"};
}

test("[17] Waxing Specter swinging through Cosmo does not re-ask its entry clause", {skip}, () => {
  H.db(); P.fxReset();
  const t = cosmoTable("Waxing Specter");
  const r = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
  assert.equal(r.error, null, r.error);
  assert.ok(r.state.pend, "fixture: the aura attacked");
  assert.doesNotMatch(said(r.state), /condition not met \(no blue card/);
  assert.equal(((r.state.sides[0].counters || {}).ws1 || {}).pow || 0, 0, "and no counter was put on it");
});

/* [18] A "Destroy this:" cost is paid before the effect. */
test("[18] an equipment's destroy-this cost is paid first", {skip}, () => {
  H.db(); P.fxReset();
  const piece = B.equipPiece({...H.card("Achilles Accelerator"), uid: 41});
  assert.ok(piece.powCard && piece.powCard.sd, "fixture: a destroy-this ability");
  const g = H.state({gear: [piece], res: 9, ap: 0}, {hp: 20}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const n = H.execute(g, piece.powCard, "hero", 0, {});
  assert.equal(n.sides[0].ap, 1, "fixture: the action point was gained");
  const lines = n.feed.map(f => (typeof f === "string" ? f : f.t));
  const paid = lines.findIndex(t => /shatters — cost paid/.test(t));
  const gain = lines.findIndex((t, i) => i > 0 && /action point/i.test(t) && !/shatters/.test(t));
  assert.ok(paid >= 0 && gain > paid, "cost " + paid + " before the effect " + gain + ": " + lines.join(" | "));
});

/* N8: the end-phase grant count. */
test("N8 a spent ward and one +6 grant are counted honestly", () => {
  const g = H.state({hp: 20, ward: 4, wardTurn: 4, buffNext: 6}, {});
  const hit = H.J.withEffects(g, (fx, s) => fx.preventDamage(s, 0, 4, "Probe").game);
  assert.equal(hit.sides[0].ward, 0, "fixture: the ward was spent");
  assert.equal(hit.sides[0].wardTurn, 0, "and its windowed part with it");
  const out = E.beginEndPhase({...hit, turnPlayer: 0}, 0, H.hasDb() ? H.db() : null);
  const m = (out.msgs || []).join(" | ");
  assert.match(m, /1 unspent “this turn” grant expires/, m);
});

/* N9: the boo names the seat and says nothing false. */
test("N9 the crowd's boo names the seat", () => {
  const g = H.state({name: "Lyath"}, {name: "Bob"});
  g.builds = [{}, {}];
  const n = H.runOps(g, [["boo", 1]], "Mocking Blow");
  assert.equal(n.sides[0].hist.booed, 1, "fixture: the boo landed");
  const f = said(n);
  assert.match(f, /Lyath hears the crowd boo — Reviled this turn\./);
  assert.doesNotMatch(f, /Bravo|boos you/);
});

/* N10: the minted card's own name, and the seat's possessive. */
test("N10 Pouncing Paws names the card and the seat", {skip}, () => {
  H.db();
  const g = H.state({name: "Kayo"}, {name: "Bob"});
  g.builds = [{}, {}];
  const n = H.runOps(g, [["mkBanish", "crouching tiger"]], "Pouncing Paws");
  assert.equal(n.sides[0].banish.length, 1, "fixture: the card was minted");
  assert.match(said(n), /Crouching Tiger springs into Kayo's banished zone/);
});

/* N11: a defence reaction's value is its value, not a bonus. */
test("N11 a defence reaction says what it defends for", {skip}, () => {
  H.db(); P.fxReset();
  const wax = Object.assign(H.card("Wax On", 1), {uid: "wx"});
  let g = {...H.state({res: 9, ap: 1, hand: [vanilla("Swing", "s1")], deck: [vanilla("T", "t1")]},
                      {hand: [wax], hp: 20, res: 9, deck: [vanilla("D", "d1")]}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, JSON.stringify(a) + ": " + o.error); g = o.state; };
  go({t: "play", uid: "s1", from: "hand"}, 0);
  g = H.answerAll(H.drain(g));
  for(let i = 0; i < 10 && g.step !== "reaction"; i++) go({t: "pass"}, g.priority);
  for(let i = 0; i < 4 && g.priority !== 1; i++) go({t: "pass"}, g.priority);
  go({t: "play", uid: "wx", from: "hand"}, 1);
  const f = said(g);
  assert.match(f, /Wax On joins the wall at instant speed — it defends for \d+/);
  assert.doesNotMatch(f, /answers at instant speed — \+/);
});
