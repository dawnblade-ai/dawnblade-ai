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
