/* ============================================================
   "LOOK AT THE TOP CARD OF TARGET HERO'S DECK" (S-item, 2026-11-07)

   Scout the Periphery x3 print it. The parser read it with the same regex
   as "look at the top card of YOUR deck", so the look always read the
   actor's own deck and the opponent's could never be chosen. It is now a
   mandatory choice of hero (`modalPrompt`), and the look op carries whose
   deck it reads (`["reveal",1,"look","foe"]`). No other pool record prints
   a look or reveal at "target hero's" deck (grep the pinned pool for
   "target hero's deck").
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const V = require("../engine/view.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});

test("the clause reads a choice of hero; \"your deck\" stays the actor's own look", () => {
  const t = P.classifyClause("Look at the top card of target hero's deck.");
  assert.equal(t.status, "run");
  assert.equal(t.ops.length, 1);
  assert.equal(t.ops[0][0], "modalPrompt", "target hero is a CHOICE — not silently the actor");
  const modes = t.ops[0][1].options.map(o => o.ops);
  assert.deepEqual(modes, [[["reveal", 1, "look", "foe"]], [["reveal", 1, "look"]]],
    "one mode looks at the opposing hero's deck, the other at your own");
  assert.deepEqual(P.classifyClause("Look at the top card of your deck.").ops, [["reveal", 1, "look"]],
    "the \"your deck\" look is untouched");
});

function scoutGame(){
  H.db();
  let n = H.state({name: "Fai", res: 9, ap: 9,
                   hand: [mk("Scout the Periphery", 1, "sp1")],
                   deck: [{uid: "mine1", name: "Mine One", pitch: 1}, {uid: "mine2", name: "Mine Two", pitch: 2}]},
                  {name: "Them", deck: [{uid: "theirs1", name: "Theirs One", pitch: 3}, {uid: "theirs2", name: "Theirs Two", pitch: 1}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "sp1", from: "hand"}, 0);
  assert.equal(r.error, null);
  return r.state;
}
/* answer the sheet, then let any layer it was holding finish */
function choose(n, i){
  assert.ok(n.prompt && n.prompt.tag === "modal", "the play asks whose deck");
  assert.equal(n.prompt.side, 0, "the player who played it chooses");
  n = J.reduce(n, {t: "promptChoose", choice: i}, 0).state;
  const r = J.reduce(n, {t: "promptConfirm"}, 0);
  assert.equal(r.error, null);
  return r.state;
}

test("DRIVEN: target the opposing hero — the look reads THEIR top card, shown only to the looker", {skip}, () => {
  let n = choose(scoutGame(), 0);
  assert.ok(n.revealed, "a look happened");
  assert.equal(n.revealed.uid, "theirs1", "the opposing hero's top card, not the actor's");
  assert.equal(n.revealed._to, 0, "only the seat that looked sees it");
  assert.deepEqual(n.sides[1].deck.map(c => c.uid), ["theirs1", "theirs2"], "it stays on top of their deck");
  assert.deepEqual(n.sides[0].deck.map(c => c.uid), ["mine1", "mine2"], "your deck is not touched");
  assert.equal((V.view(n, 1).revealed || null), null, "the opponent's view carries no look");
  /* THE OBSERVABLE IS THE LINE ITSELF: the card's name reaches the looker in
     the one feed line addressed to their seat alone (`feedTo`). */
  const feed = n.feed || [], to = n.feedTo || {};
  const naming = feed.map((l, i) => [String(l && l.text || l), i]).filter(([l]) => /Theirs One/.test(l));
  assert.equal(naming.length, 1, "exactly one line names the card");
  assert.equal(to[naming[0][1]], 0, "and it is addressed to the seat that looked");
  /* and the looker's VIEW knows it: that top slot is no longer hidden from them */
  const v0 = V.view(n, 0);
  assert.equal((v0.revealed || {}).uid, "theirs1", "the looker's view carries the look");
  assert.equal(v0.sides[1].deck[0].uid, "theirs1", "and shows the opponent's top card where it sits");
  assert.ok(V.isPh(v0.sides[1].deck[1]), "the card under it stays hidden");
});

test("DRIVEN: the look goes stale the moment that deck changes — a shuffle or a draw never leaves a known top", {skip}, () => {
  const n = choose(scoutGame(), 0);
  const prev = n;
  /* the opponent's deck is reordered (a shuffle that brought another card up) */
  const shuffled = {...n, sides: [n.sides[0], {...n.sides[1], deck: [n.sides[1].deck[1], n.sides[1].deck[0]]}]};
  const s1 = J.clearKnown(shuffled, prev);
  assert.equal(s1.revealed, null, "the look is forgotten");
  assert.ok(V.isPh(V.view(s1, 0).sides[1].deck[0]) && V.isPh(V.view(s1, 0).sides[1].deck[1]),
    "and every slot of their deck is hidden from the looker again");
  /* a card put UNDER it keeps the look: the top did not move */
  const under = {...n, sides: [n.sides[0], {...n.sides[1], deck: [...n.sides[1].deck, {uid: "theirs3", name: "Theirs Three", pitch: 2}]}]};
  assert.equal((J.clearKnown(under, prev).revealed || {}).uid, "theirs1", "a card put under the deck keeps the known top");
  /* a look at your OWN deck carries no `_from`, so nothing here touches it */
  const own = choose(scoutGame(), 1);
  assert.equal(own.revealed._from, undefined);
});

test("DRIVEN: target yourself — the look reads your own top card", {skip}, () => {
  const n = choose(scoutGame(), 1);
  assert.equal(n.revealed && n.revealed.uid, "mine1");
  assert.equal(n.revealed._to, 0);
});
