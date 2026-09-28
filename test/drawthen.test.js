/* ============================================================
   "DRAW A CARD AND <SOMETHING>" IS TWO EFFECTS (v4.82)

   The plain-draw rule in `classifyClause` was `c.match(/draw … cards?/)`
   with no anchor at either end, and it sat above every payload reader
   below it — so it answered for ANY sentence containing "draw a card".
   Measured over the pinned pool, five shapes came back as a bare draw:

     Golden Tipple ×3          "…draw a card and create a Gold token"
     Fire that Burns Within    "…draw a card and this gets +2{p}"
     Rising Sun, Setting Moon  "draw a card, then put a card from your
                                hand on the bottom of your deck"
     Stroke of Foresight ×3    "…then put a card … on the top or bottom"
     Art of Desire ×2          "whenever this banishes a red card, draw a
                                card and gain 1{h}"

   Every one read `tier: full`. The last lost its TRIGGER with its tail, so
   the card drew on every attack whatever it banished — and its banish
   filed the card into NO zone at all.

   Rising Sun also transcends, and building its put-back found that the
   transcend ran FIRST: `execute`'s condition loop runs before the ops
   (v3.60), so the Chi it had not made yet was offered as the card to put
   back. The flip now happens where the card is filed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const J = H.J;
const P = require("../engine/parser.js");
const INV = require("../engine/invariants.js");
const S = require("../engine/sides.js");

const skip = !H.hasDb() && "no cached card database";
const mk = (n, p, u) => Object.assign({}, H.card(n, p), {uid: u});
const van = (u, pitch) => ({uid: u, name: "Probe " + u, pitch: pitch || 1, power: 3, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

function table(mine, theirs, o){
  const g = H.state(Object.assign({name: "Probe", res: 9, ap: 1}, mine),
                    Object.assign({name: "Them", hp: 30, hand: [], deck: [{uid: "t1", name: "T"}]}, theirs),
                    Object.assign({actor: 0, turnPlayer: 0, turn: 3, seed: "drawthen"}, o || {}));
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
let n;
const R = (a, seat) => {
  const r = J.reduce(n, a, seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  n = r.state;
};
/* pass while nothing is being asked and the step is not the one wanted */
const passTo = done => {
  for(let i = 0; i < 24 && !n.prompt && !done(n); i++){
    if(n.priority == null) break;
    const r = J.reduce(n, {t: "pass"}, n.priority);
    if(r.error) break;
    n = r.state;
  }
};
const pick = uid => {
  assert.ok(n.prompt && n.prompt.tag === "pick", "no pick sheet is open");
  const i = n.prompt.cards.findIndex(c => c.uid === uid);
  assert.ok(i >= 0, uid + " is not offered — offered: " + n.prompt.cards.map(c => c.uid));
  const seat = n.prompt.side;
  R({t: "promptSel", i}, seat);
  R({t: "promptConfirm"}, seat);
};
const mode = i => {
  assert.ok(n.prompt && n.prompt.tag === "modal", "no modal sheet is open");
  const seat = n.prompt.side;
  R({t: "promptChoose", choice: i}, seat);
  R({t: "promptConfirm"}, seat);
};
const golds = sd => (sd.board || []).filter(b => b && b.card && /gold/i.test(b.card.name)).length;

/* ---- 1. THE READER ------------------------------------------------------ */

test("the plain draw is anchored, and a draw with a tail carries the tail", () => {
  const ops = t => (P.classifyClause(t) || {}).ops;
  assert.deepEqual(ops("draw a card"), [["draw", 1]]);
  assert.deepEqual(ops("draw 2 cards"), [["draw", 2]]);
  assert.deepEqual(ops("draw a card and create a Gold token").map(o => o[0]), ["draw", "token"]);
  assert.deepEqual(ops("draw a card and this gets +2{p}"), [["draw", 1], ["self", 2]]);
  assert.deepEqual(ops("draw a card and gain 1{h}"), [["draw", 1], ["life", 1]]);
  /* the three compound rules above it still answer first */
  assert.deepEqual(ops("draw a card then discard a random card"), [["draw", 1], ["discardRandom", 1]]);
  assert.deepEqual(ops("draw a card, then discard a card"), [["draw", 1], ["selfDiscard", 1]]);
});

test("an unreadable tail REFUSES THE WHOLE SENTENCE — the draw alone is the defect", () => {
  assert.equal(P.classifyClause("draw a card and frobnicate the widget"), null);
  /* a tail with its own schedule is a different sentence */
  assert.equal(P.classifyClause("draw a card and when this hits, draw a card"), null);
  /* and a sentence that merely CONTAINS a draw is not a draw */
  assert.equal(P.classifyClause("whenever this banishes a red card, draw a card and gain 1{h}"), null,
    "the trigger is `fxParse`'s to pair — here it must refuse, or the loose life rule claims it");
});

test("the put-back is a pick out of the hand; top-or-bottom is a mode first", () => {
  const bot = P.classifyClause("put a card from your hand on the bottom of your deck").ops;
  assert.equal(bot.length, 1);
  assert.equal(bot[0][0], "pickPrompt");
  assert.deepEqual([bot[0][1].zone, bot[0][1].to, bot[0][1].min, bot[0][1].max], ["hand", "deckBottom", 1, 1]);
  assert.deepEqual(bot[0][1].filter, {}, "every card in the hand is a legal choice");
  const top = P.classifyClause("put a card from your hand on top of your deck").ops;
  assert.equal(top[0][1].to, "deckTop");
  const either = P.classifyClause("put a card from your hand on the top or bottom of your deck").ops;
  assert.equal(either[0][0], "modalPrompt");
  assert.deepEqual(either[0][1].options.map(o => o.ops[0][1].to), ["deckTop", "deckBottom"],
    "both ends, in printed order");
});

test("every pool record the five shapes live on carries its whole sentence", {skip}, () => {
  const fx = (nm, p) => { P.fxReset && P.fxReset(); return P.fxParse(H.card(nm, p)); };
  for(const p of [1, 2, 3]){
    const gt = fx("Golden Tipple", p);
    assert.deepEqual(gt.optCost.ops.map(o => o[0]), ["draw", "token"], "Golden Tipple " + p + " makes its Gold");
    const sf = fx("Stroke of Foresight", p);
    assert.deepEqual(sf.conds.filter(c => c.cond === "reprise").map(c => c.op[0]), ["draw", "modalPrompt"]);
  }
  assert.deepEqual(fx("Fire that Burns Within", 1).optCost.ops, [["draw", 1], ["self", 2]]);
  const rs = fx("Rising Sun, Setting Moon", 3);
  assert.deepEqual(rs.ops.filter(o => o[0] !== "noop").map(o => o[0]), ["draw", "pickPrompt"]);
  for(const [nm, p, word, pitch] of [["Art of Desire: Body", 1, "red", 1], ["Art of Desire: Mind", 3, "blue", 3]]){
    const ad = fx(nm, p);
    assert.equal(ad.ops.some(o => o[0] === "draw"), false, nm + " draws nothing on its own");
    const b = ad.onHitHero.find(o => o[0] === "foeBanishTop");
    assert.ok(b && b[2], nm + "'s banish carries its trigger");
    assert.deepEqual([b[2].word, b[2].pitch, b[2].ops], [word, pitch, [["draw", 1], ["life", 1]]]);
    assert.ok(ad.clauses.every(c => c.st !== "skip"), nm + " reads every clause");
  }
});

/* ---- 2. DRIVEN AT THE TABLE -------------------------------------------- */

test("DRIVEN: Golden Tipple draws AND makes its Gold", {skip}, () => {
  H.db();
  n = table({name: "Gravy Bones", hand: [mk("Golden Tipple", 1, "gt"), van("yel", 2), van("red", 1)], deck: [van("d1", 3)]});
  R({t: "play", uid: "gt", from: "hand"}, 0);
  passTo(() => false);
  assert.equal(n.prompt && n.prompt.src, "Golden Tipple");
  pick("yel");
  assert.ok(n.sides[0].hand.some(c => c.uid === "d1"), "it drew");
  assert.equal(golds(n.sides[0]), 1, "and the Gold is on the board — the half the unanchored draw dropped");
  assert.deepEqual(INV.errors(n), []);
});

test("DRIVEN: declining Golden Tipple's cost pays nothing — the control", {skip}, () => {
  H.db();
  n = table({name: "Gravy Bones", hand: [mk("Golden Tipple", 1, "gt"), van("yel", 2)], deck: [van("d1", 3)]});
  R({t: "play", uid: "gt", from: "hand"}, 0);
  passTo(() => false);
  R({t: "promptConfirm"}, 0);
  assert.equal(golds(n.sides[0]), 0);
  assert.ok(!n.sides[0].hand.some(c => c.uid === "d1"));
});

test("DRIVEN: Fire that Burns Within's +2{p} lands on its own swing", {skip}, () => {
  H.db();
  n = table({name: "Fai", hand: [mk("Fire that Burns Within", 1, "ftb"), mk("Phoenix Flame", 1, "pf")], deck: [van("d1", 3)]});
  const printed = H.card("Fire that Burns Within", 1).power;
  R({t: "play", uid: "ftb", from: "hand"}, 0);
  passTo(() => false);
  assert.equal(n.prompt && n.prompt.src, "Fire that Burns Within");
  pick("pf");
  assert.equal(n.pend.total, printed + 2, "the swing carries the +2 — it was dropped before");
  assert.ok(n.sides[0].hand.some(c => c.uid === "d1"), "and it drew");
  passTo(s => !s.pend);
  assert.equal(n.sides[1].hp, 30 - (printed + 2), "and it is DEALT");
});

test("DRIVEN: Rising Sun draws, then the chosen card goes to the bottom", {skip}, () => {
  H.db();
  n = table({name: "Enigma", hand: [mk("Rising Sun, Setting Moon", 3, "rs"), van("keep", 1), van("away", 1)],
             deck: [van("d1", 3), van("d2", 3)]});
  R({t: "play", uid: "rs", from: "hand"}, 0);
  passTo(() => false);
  assert.deepEqual(n.prompt.cards.map(c => c.uid).sort(), ["away", "d1", "keep"], "the drawn card is a choice too");
  pick("away");
  const deck = n.sides[0].deck.map(c => c.uid);
  assert.equal(deck[deck.length - 1], "away", "…on the BOTTOM");
  assert.deepEqual(n.sides[0].hand.map(c => c.uid).sort(), ["d1", "keep"]);
});

test("DRIVEN: Rising Sun's transcend comes AFTER the put-back — the Chi is not a choice", {skip}, () => {
  /* Before v4.82 the transcend minted Inner Chi in the condition loop,
     ahead of the card's own ops, and the sheet offered it. */
  H.db();
  n = table({name: "Enigma", hand: [mk("Rising Sun, Setting Moon", 3, "rs"), van("keep", 1)],
             deck: [van("d1", 3)], hist: Object.assign({}, S.makeSide({}).hist, {blue: 1})});
  R({t: "play", uid: "rs", from: "hand"}, 0);
  passTo(() => false);
  const chi = n.sides[0].hand.find(c => /^chi/.test(String(c.uid)));
  assert.ok(chi, "it transcended");
  assert.equal(n.prompt.cards.some(c => c.uid === chi.uid), false, "the Chi it made afterwards is not offered");
  assert.deepEqual(n.prompt.cards.map(c => c.uid).sort(), ["d1", "keep"]);
  pick("keep");
  assert.ok(n.sides[0].hand.some(c => c.uid === chi.uid), "and it stays in the hand");
  assert.equal(n.sides[0].hist.trans, 1);
  assert.equal(n.sides[0].grave.some(c => c.uid === "rs"), false, "transcended, not filed");
});

/* a Dawnblade swing met by a card from hand, then Stroke of Foresight */
function strokeBoard(){
  H.db();
  n = table({name: "Dorinthea", gear: [mk("Dawnblade", 0, "wpn")],
             hand: [mk("Stroke of Foresight", 1, "sf"), van("keep", 1)],
             deck: [van("d1", 3), van("d2", 3), van("d3", 3)]},
            {hand: [van("blk", 1)]});
  R({t: "activate", uid: "wpn"}, 0);
  passTo(s => s.step === "defend");
  R({t: "defend", uid: "blk"}, 1);
  passTo(s => s.step === "reaction");
  R({t: "play", uid: "sf", from: "hand"}, 0);
  passTo(() => false);
}

test("DRIVEN: Stroke of Foresight's reprise draws, then asks top or bottom — TOP", {skip}, () => {
  strokeBoard();
  assert.ok(n.sides[0].hand.some(c => c.uid === "d1"), "it drew");
  mode(0);
  pick("keep");
  assert.equal(n.sides[0].deck[0].uid, "keep", "on TOP — the next card drawn");
});

test("DRIVEN: …and BOTTOM", {skip}, () => {
  strokeBoard();
  mode(1);
  pick("keep");
  const deck = n.sides[0].deck;
  assert.equal(deck[deck.length - 1].uid, "keep", "on the BOTTOM");
});

test("DRIVEN: the reprise is announced ONCE — two ops under one gate are one event", {skip}, () => {
  /* The state is identical either way, so the feed is the observable
     (v3.60's exception, stated rather than assumed): a two-op payload
     printed "Reprise — 1 card from hand met the attack." twice. */
  strokeBoard();
  assert.equal(n.feed.filter(l => /^Reprise — /.test(l.msg || l)).length, 1);
});

test("DRIVEN: no card from hand defended — no reprise, no draw, no sheet (the control)", {skip}, () => {
  H.db();
  n = table({name: "Dorinthea", gear: [mk("Dawnblade", 0, "wpn")],
             hand: [mk("Stroke of Foresight", 1, "sf"), van("keep", 1)], deck: [van("d1", 3)]});
  R({t: "activate", uid: "wpn"}, 0);
  passTo(s => s.step === "reaction");
  R({t: "play", uid: "sf", from: "hand"}, 0);
  passTo(() => false);
  assert.ok(!n.prompt, "nothing is asked");
  assert.equal(n.sides[0].hand.some(c => c.uid === "d1"), false, "and nothing is drawn");
});

/* Art of Desire into a hero whose top card is `top` */
function artBoard(nm, p, top, blocker){
  H.db();
  n = table({name: "Arakni", hp: 20, hand: [mk(nm, p, "ad")], deck: [van("d1", 3)]},
            {hp: 30, deck: [top, van("t2", 2)], hand: blocker ? [blocker] : []});
  R({t: "play", uid: "ad", from: "hand"}, 0);
  if(blocker){ passTo(s => s.step === "defend"); R({t: "defend", uid: blocker.uid}, 1); }
  passTo(s => !s.pend);
}

test("DRIVEN: Art of Desire: Body banishes a RED card — draw a card and gain 1{h}", {skip}, () => {
  artBoard("Art of Desire: Body", 1, van("topR", 1));
  assert.ok(n.sides[1].banish.some(c => c.uid === "topR"), "the banished card is IN the banished zone");
  assert.equal(n.sides[1].deck.some(c => c.uid === "topR"), false);
  assert.ok(n.sides[0].hand.some(c => c.uid === "d1"), "it drew");
  assert.equal(n.sides[0].hp, 21, "and gained 1{h}");
  assert.deepEqual(INV.errors(n), []);
});

test("DRIVEN: …a BLUE card pays nothing — the trigger reads the colour", {skip}, () => {
  artBoard("Art of Desire: Body", 1, van("topB", 3));
  assert.ok(n.sides[1].banish.some(c => c.uid === "topB"), "still banished");
  assert.equal(n.sides[0].hand.some(c => c.uid === "d1"), false,
    "no draw — before v4.82 it drew on EVERY attack");
  assert.equal(n.sides[0].hp, 20);
});

test("DRIVEN: Art of Desire: Mind is the other colour", {skip}, () => {
  artBoard("Art of Desire: Mind", 3, van("topB", 3));
  assert.ok(n.sides[0].hand.some(c => c.uid === "d1"));
  assert.equal(n.sides[0].hp, 21);
  artBoard("Art of Desire: Mind", 3, van("topR", 1));
  assert.equal(n.sides[0].hand.some(c => c.uid === "d1"), false);
});

test("DRIVEN: blocked to nothing, it banishes nothing and draws nothing (CR 7.5.5)", {skip}, () => {
  const wall = Object.assign(van("blk", 1), {def: 9});
  artBoard("Art of Desire: Body", 1, van("topR", 1), wall);
  assert.equal(n.sides[1].hp, 30, "the wall stopped all of it — so this drill really is the miss");
  assert.equal(n.sides[1].banish.length, 0);
  assert.ok(n.sides[1].deck.some(c => c.uid === "topR"));
  assert.equal(n.sides[0].hand.some(c => c.uid === "d1"), false);
});

/* ---- 3. THE OPS, DIRECTLY ---------------------------------------------- */

test("`foeBanishTop` files the card into the banished zone — never into no zone", () => {
  const g = H.state({}, {deck: [van("a", 1), van("b", 2)], banish: [van("old", 1)]});
  const out = H.runOps(g, [["foeBanishTop", 1]], "Probe");
  assert.deepEqual(out.sides[1].banish.map(c => c.uid), ["a", "old"]);
  assert.deepEqual(out.sides[1].deck.map(c => c.uid), ["b"]);
});

test("`modalPrompt` with fewer than two modes asks nothing", () => {
  const g = H.state({}, {});
  const out = H.runOps(g, [["modalPrompt", {options: [{label: "only", ops: [["draw", 1]]}]}]], "Probe");
  assert.equal((out.promptQ || []).length, 0, "a forced choice among one is not a choice (v3.55)");
});
