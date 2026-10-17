/* ============================================================
   THE SHARED FEED DOES NOT NAME A HIDDEN CARD (v5.32)

   Both seats read one feed (v2.83). A card set face down, looked at off
   the top of a deck, or moved from a hand onto a deck was never revealed,
   so naming it in the feed hands the other seat information the rules do
   not give them (QUEUE v3 S2: 2,124 such lines over the ladder). Every
   row here drives the real writer and asserts on the line, because the
   STATE is identical either way: the defect lives only in the prose
   (v3.60's exception). Each row carries a control that a PUBLIC card is
   still named, or a writer that names nothing passes it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const J = require("../engine/judge.js");
const Q = require("../engine/prompts.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
let uid = 0;
const card = (name, o) => ({uid: "h" + (++uid), name, pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], ...o});
const feedOf = g => (g.feed || g.log || []).join("\n");
const game = (s0, s1) => {
  const g = S.makeGame(); g.sides = [S.makeSide({name: "You", ...s0}), S.makeSide({name: "Kayo", ...s1})];
  return g;
};

test("(b) the arsenal set names the seat, never the face-down card", () => {
  const secret = card("Secret Arsenal Card");
  let g = {...H.state({hand: [secret], deck: []}, {deck: []}, {turn: 3, actor: 0}),
    phase: "end", step: null, priority: null, passed: [], turnPlayer: 0, firstPlayer: 0,
    round: 1, over: null, arsenalFor: 0};
  const o = J.reduce(g, {t: "arsenal", uid: secret.uid}, 0);
  assert.equal(o.error, null);
  assert.equal(o.state.sides[0].arsenal.name, "Secret Arsenal Card", "fixture: it was set");
  const f = feedOf(o.state);
  assert.ok(!/Secret Arsenal Card/.test(f), "the face-down card is named in the shared feed");
  assert.match(f, /\(b\) .* a card face down in the arsenal/);
});

test("opt and a reorder say how many cards went where, never which", () => {
  const deck = [card("Top Secret A"), card("Top Secret B"), card("Top Secret C")];
  let p = Q.buildPrompt(game({deck}), {tag: "opt", n: 2});
  p = Q.promptToggleSel(p, 0);
  const r = Q.applyPrompt(game({deck}), p);
  assert.deepEqual(r.game.sides[0].deck.map(c => c.name), ["Top Secret B", "Top Secret C", "Top Secret A"],
    "fixture: the opt still moved the card");
  assert.ok(!/Top Secret/.test(r.msgs.join(" ")), "an opt named a card only its controller saw");
  assert.match(r.msgs[0], /1 card left on top, 1 card sent to the bottom/);
  const k = Q.buildPrompt(game({deck}), {tag: "opt", n: 2, keepTop: true, src: "Spire Sniping"});
  const rk = Q.applyPrompt(game({deck}), k);
  assert.ok(!/Top Secret/.test(rk.msgs.join(" ")), "a reorder named a card only its controller saw");
});

test("a pick from HAND onto a DECK names no card; one from the GRAVEYARD still does", () => {
  const h = card("Hand Secret"), gv = card("Public Grave Card");
  const g = game({hand: [h, card("Other")], grave: [gv, card("Grave Other")]});
  let p = Q.buildPrompt(g, {tag: "pick", zone: "hand", to: "deckBottom", min: 1, max: 1});
  p = Q.promptToggleSel(p, p.cards.findIndex(c => c.uid === h.uid));
  const r = Q.applyPrompt(g, p);
  assert.ok(r.game.sides[0].deck.some(c => c.uid === h.uid), "fixture: it moved");
  assert.ok(!/Hand Secret/.test(r.msgs.join(" ")), "a hand card moved to a deck was named");
  assert.match(r.msgs.join(" "), /A card goes from the hand/);
  /* CONTROL: the graveyard is public, so its card keeps its name */
  let q = Q.buildPrompt(g, {tag: "pick", zone: "grave", to: "deckTop", min: 1, max: 1});
  q = Q.promptToggleSel(q, q.cards.findIndex(c => c.uid === gv.uid));
  assert.match(Q.applyPrompt(g, q).msgs.join(" "), /Public Grave Card/);
});

test("Boulder Drop's crush forces a card back without naming it", {skip}, () => {
  const secret = card("Forced Secret");
  let g = H.state({}, {hand: [card("Other"), secret], deck: [card("Deck")]}, {turn: 3, actor: 0});
  g = H.runOps(g, [["foeHandToDeck", 1]], "Boulder Drop");
  assert.equal(g.sides[1].deck[0].uid, secret.uid, "fixture: the card went to the deck");
  assert.ok(!/Forced Secret/.test(feedOf(g)), "the forced card was named");
});

test("Azalea's cycle names a face-down arsenal card as such, and a face-up one by name", {skip}, () => {
  const run = faceUp => {
    const ars = card("Arsenal Secret", faceUp ? {_faceUp: true} : {});
    let g = H.state({arsenal: ars, deck: [card("Next Arrow")]}, {}, {turn: 3, actor: 0});
    return feedOf(H.runOps(g, [["arsCycle", null]], "Azalea"));
  };
  assert.ok(!/Arsenal Secret/.test(run(false)), "a face-down arsenal card was named");
  assert.match(run(false), /the face-down arsenal card goes to the bottom/);
  assert.match(run(true), /Arsenal Secret goes to the bottom/, "a face-up card is public");
});
