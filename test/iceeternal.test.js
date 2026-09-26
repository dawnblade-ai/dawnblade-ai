/* ============================================================
   ICE ETERNAL — A FREE X, DECLARED BEFORE THE PAYMENT (v4.72)

   > "XX — Ice Fusion. Create X Frostbite tokens under target hero's
   >  control. Then if this was fused, deal arcane damage to that hero
   >  equal to the number of Frostbites they control."   — Iyslander's

   The pool's only card whose printed COST is an X nothing else settles.
   v4.71 built Beckoning Haunt's X, which the aura it returns decides; this
   one the player NAMES. It was refused for seventy versions for a reason
   the drill carried in its own text — reading X as 1 creates one token for
   a card that charges for X of them — and building the declaration is what
   removed the reason.

   WHAT THIS HOLDS:
     - the COST: how many X the printed cost carries is a card field (`cx`),
       and `effCost` prices it off the declared X
     - the PARSE: the mint carries the letter X, and the "then if this was
       fused" gate is kept rather than dropped — but only THAT gate
     - the QUESTION: a pending before the payment, bounded by what the seat
       could raise, answered with an integer in range and nothing else
     - DRIVEN: X Frostbites under the other seat's control; X = 0 makes
       none; the fused rider counts every Frostbite they control, AFTER the
       mint; cancelling the payment forgets X; a held play keeps it
     - the POLICY takes the most it can pay for, and the trainer asks the
       same question through its own door
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P  = require("../engine/parser.js");
const C  = require("../engine/cards.js");
const SP = require("../engine/sparring.js");
const H  = require("./helpers/judged.js");
const J  = H.J;

const skip = !H.hasDb() && "no cached card database";
const frosts = sd => sd.board.filter(b => /^frostbite$/i.test(b.card.name)).length;

function table(o){
  H.db();
  const ie = {...H.card("Ice Eternal", 3), uid: "ie"};
  const g = {...H.state({res: o.res, ap: 1, hand: [ie].concat(o.hand || [])},
                        {hand: o.foeHand || [], board: o.foeBoard || [], res: o.foeRes || 0},
                        {turn: 3, actor: 0, turnPlayer: 0}),
             phase: "action", step: "layer", priority: 0, passed: [false, false],
             stack: [], chain: [], chainCards: []};
  return g;
}
const play = g => J.reduce(g, {t: "play", uid: "ie", from: "hand"}, 0);

/* ---- 1. THE COST -------------------------------------------------------- */

test("the printed cost's X count is a card FIELD, on both copies of the loader", {skip}, () => {
  H.db();
  const ie = H.card("Ice Eternal", 3);
  assert.equal(ie.cx, 2, "\"XX\" is two X — dropped here, the card is free at any X");
  assert.equal(ie.cost, null, "and the database carries no number for it");
  /* THE ONE MIRROR v2.20 COULD NOT DELETE (v2.48): `mapDbCard` lives in a
     React hook too. A field one copy carries and the other drops is a card
     the Node tools price and the phone gives away. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const rx = /cx:\(String\(c\.cost\|\|""\)\.match\(\/x\/gi\)\|\|\[\]\)\.length\|\|undefined/;
  assert.match(html, rx, "the phone's loader does not carry the X count");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "engine", "cards.js"), "utf8"), rx);
  /* and a card with no X carries no field at all — opt-in (v3.58) */
  assert.equal(H.card("Frost Spike", 3).cx, undefined);
});

test("effCost prices X off the DECLARED value, once per X in the cost", {skip}, () => {
  H.db();
  const ie = H.card("Ice Eternal", 3), sd = H.side({});
  assert.equal(P.effCost(ie, sd, {x: 0}), 0);
  assert.equal(P.effCost(ie, sd, {x: 3}), 6, "XX at X = 3 is 6, not 3");
  assert.equal(P.effCost(ie, sd), 0, "a caller that declares nothing prices X at 0");
  assert.equal(P.costCtx({_x: 2, chain: []}, 0).x, 2, "the game's half of the cost carries the declaration");
  /* A CARD WITH NO X IS NOT PRICED BY ONE: the declaration is about the
     card being played, and it must not leak into a neighbour's price. */
  assert.equal(P.effCost(H.card("Frost Spike", 3), sd, {x: 5}), 0);
});

/* ---- 2. THE PARSE -------------------------------------------------------- */

test("the mint carries the LETTER — the play decides X, never the parse", () => {
  const r = P.classifyClause("create x frostbite tokens under target hero's control");
  assert.equal(r.status, "run");
  assert.deepEqual(r.ops, [["token", "frostbite", "X", "foe"]]);
});

test("\"then if this was fused\" is KEPT as a gate — and only that gate", () => {
  const r = P.classifyClause("then if this was fused, deal 2 arcane damage");
  assert.ok(r && r.status === "run", "the fused rider stopped reading");
  assert.equal(r.cond, "way:fused",
    "the gate must be answered AFTER the card's ops, or it counts Frostbites that do not exist yet");
  /* NOT A WIDENING OF EVERY "then if". Any other gate behind "then" would be
     read by a reader that only knows how to answer fusion — refused whole
     rather than read wrong (v2.29). */
  assert.equal(P.classifyClause("then if you have less {h} than an opposing hero, deal 2 arcane damage"), null,
    "a \"then if\" whose gate is not fusion was read — answered as fusion, it fires on the wrong fact");
});

test("the whole card: the mint, and the count behind the fusion gate", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Ice Eternal", 3));
  assert.equal(fx.tier, "full");
  assert.ok(fx.ops.some(o => o[0] === "token" && o[2] === "X"));
  assert.deepEqual(fx.conds.map(c => [c.cond, c.op[0], c.op[1].name, c.op[1].side]),
    [["way:fused", "arcaneCount", "Frostbite", "foe"]],
    "the rider must count the NAMED token under the SAME hero's control the mint targeted");
  assert.deepEqual(fx.fusionCost, {types: ["ice"]});
});

/* ---- 3. THE QUESTION ----------------------------------------------------- */

test("the question comes BEFORE the payment, bounded by what the seat could raise", {skip}, () => {
  const r = play(table({res: 4}));
  const p = r.state.pending;
  assert.equal(p && p.kind, "xval", "no X was asked — the payment cannot know what it is paying for");
  assert.equal(p.max, 2, "4 floating pays XX up to X = 2");
  assert.equal(p.per, 2);
  /* THE CARD'S OWN PITCH IS NOT IN THE CEILING — it is the card being paid
     for. 3 floating and a pitch-3 card beside it is 6, so X = 3. */
  const f = {...H.card("Frosting", 3), uid: "f3"};
  assert.equal(play(table({res: 3, hand: [f]})).state.pending.max, 3);
  /* FLOORED, never rounded: 3 floating is X = 1 with one left over. */
  assert.equal(play(table({res: 3})).state.pending.max, 1);
});

test("the answer is an integer in range, and the question freezes everything else", {skip}, () => {
  const n = play(table({res: 4})).state;
  for(const x of [3, -1, 1.5, "2", null, true])
    assert.match(String(J.legal(n, {t: "xval", x}, 0)), /whole number from 0 to 2/,
      "X = " + JSON.stringify(x) + " was accepted — a wire can send any of these (v2.04)");
  assert.equal(J.legal(n, {t: "xval", x: 2}, 0), null);
  assert.match(String(J.legal(n, {t: "pass"}, 0)), /declare X/, "a pass slipped past the question");
  assert.match(String(J.legal(table({res: 4}), {t: "xval", x: 1}, 0)), /nothing is asking for X/);
});

test("a play arriving off a wire with its own `x` is still ASKED", {skip}, () => {
  /* The answer rides on the STATE, never the action — or a crafted play
     skips the question the seat was owed. */
  const r = J.reduce(table({res: 4}), {t: "play", uid: "ie", from: "hand", x: 2}, 0);
  assert.equal(r.state.pending && r.state.pending.kind, "xval");
});

/* ---- 4. DRIVEN ------------------------------------------------------------ */

test("X Frostbites under the OTHER seat's control, and X paid twice", {skip}, () => {
  const n = H.drain(J.reduce(play(table({res: 4})).state, {t: "xval", x: 2}, 0).state);
  assert.equal(frosts(n.sides[1]), 2, "the declared X is not what was created");
  assert.equal(frosts(n.sides[0]), 0, "\"under target hero's control\" — not the player's own");
  assert.equal(n.sides[0].res, 0, "XX at X = 2 is 4");
  assert.equal(n._x, undefined, "the declaration outlived its play — the next X card would skip the question");
  assert.ok(n.sides[0].grave.some(c => c.uid === "ie"));
});

test("X = 0 creates NONE and costs nothing — the card is legal to play for nothing", {skip}, () => {
  const n = H.drain(J.reduce(play(table({res: 4})).state, {t: "xval", x: 0}, 0).state);
  assert.equal(frosts(n.sides[1]), 0, "X = 0 created a Frostbite");
  assert.equal(n.sides[0].res, 4);
});

test("a mint with NO declared X creates none — inert, never free (v2.04)", {skip}, () => {
  /* The route every play takes asks the question, so this is the guard for
     a state that arrived some other way. */
  const g = table({res: 4});
  const out = H.runOps(g, [["token", "frostbite", "X", "foe"]], "Ice Eternal");
  assert.equal(frosts(out.sides[1]), 0);
});

test("FUSED: the arcane counts EVERY Frostbite they control, after the mint", {skip}, () => {
  /* One Frostbite already on their board, and X = 2: three under their
     control once the mint lands, so 3 arcane. A rider answered BEFORE the
     ops (the main loop) would count 1; a rider counting only this card's
     tokens would count 2. Only the printed reading says 3. */
  H.db();
  const old = {uid: "fb0", card: {...H.card("Frostbite", 0), uid: "fb0"}};
  const cs = {...H.card("Cold Snap", 1), uid: "cs"};
  const f = {...H.card("Frosting", 3), uid: "f3"};
  let n = play(table({res: 2, hand: [cs, f], foeBoard: [old]})).state;
  n = J.reduce(n, {t: "xval", x: 2}, 0).state;
  for(let i = 0; i < 6 && n.pending; i++){
    const p = n.pending;
    if(p.kind === "pay"){
      const sd = n.sides[0];
      n = J.reduce(n, sd.res + J.paySum(sd) < p.need ? {t: "paySel", uid: "f3"} : {t: "payConfirm"}, 0).state;
    } else if(p.kind === "fuse") n = J.reduce(n, {t: "fuse", uid: "cs"}, 0).state;
    else assert.fail("unexpected pending " + p.kind);
  }
  n = H.drain(n);
  assert.equal(frosts(n.sides[1]), 3);
  assert.equal(n.sides[1].hp, 20 - 3, "the fused rider did not count every Frostbite they control");
  assert.ok(n.sides[0].hand.some(c => c.uid === "cs"), "a revealed card stays in the hand");
});

test("UNFUSED: the rider does not fire, and the feed says why", {skip}, () => {
  const n = H.drain(J.reduce(play(table({res: 4})).state, {t: "xval", x: 1}, 0).state);
  assert.equal(n.sides[1].hp, 20, "an unfused Ice Eternal dealt arcane");
  /* The one prose assertion, on purpose (v3.60): the state is identical
     whether the feed explains itself or not, and a feed that says "nothing
     matching happened this way" about a card that was simply not fused is
     a riddle in the one place the player learns. */
  assert.ok(n.feed.some(l => /Ice Eternal was not fused — its rider does not fire/.test(l)));
});

test("cancelling the payment FORGETS X — the next play is asked again", {skip}, () => {
  /* 0 floating and a pitch-3 card: X = 1 opens a payment. Cancelled, the
     declaration must go with it, or the next attempt skips the question
     and plays at a price nobody chose. */
  const f = {...H.card("Frosting", 3), uid: "f3"};
  let n = play(table({res: 0, hand: [f]})).state;
  n = J.reduce(n, {t: "xval", x: 1}, 0).state;
  assert.equal(n.pending && n.pending.kind, "pay");
  n = J.reduce(n, {t: "payCancel"}, 0).state;
  assert.equal(n._x, undefined, "the declaration survived the cancel");
  assert.equal(play(n).state.pending.kind, "xval", "the next play was not asked for X");
});

test("A HELD PLAY KEEPS ITS X — `_x` is a declaration that rides the layer", {skip}, () => {
  /* v4.66: a play at action speed waits on the stack while the other seat
     can answer, and every settled declaration rides in `decl`
     (`judge.HELD_DECL`). Left off that list, X is dropped between the
     play and its resolution and the mint creates none. */
  H.db();
  const spike = {...H.card("Frost Spike", 3), uid: "fs"};
  let n = J.reduce(play(table({res: 4, foeHand: [spike], foeRes: 3})).state, {t: "xval", x: 2}, 0).state;
  const layer = (n.stack || []).find(l => l.k === "play");
  assert.ok(layer, "fixture: the play was not held — seat 1 holds an instant it could answer with");
  assert.equal(layer.decl && layer.decl._x, 2, "X did not ride the held layer");
  n = H.drain(n);
  assert.equal(frosts(n.sides[1]), 2, "the held play resolved without its X");
});

test("an X card that is NOT held forgets X at the commit — the other clear", {skip}, () => {
  /* A held play strips every declaration twice over (`holdPlay` and
     `resolveHeld` both walk `HELD_DECL`), so the sabotage that drops `_x`
     from `commitPlayBoosted`'s own clear is SILENT against Ice Eternal — an
     Action, always held. An INSTANT is never held (CR 8.1.6 at this table,
     `instant-speed-plays-resolve-on-play`), and that clear is the only one
     it passes. No pool card is an X instant, so the fixture is synthetic
     (v3.73) and the drill is what keeps the guard from being dead code
     that reads like a rule (v4.11). */
  H.db();
  const syn = {name: "Synthetic X Instant", uid: "sx", pitch: 3, cost: null, cx: 1, power: null, def: null,
               tt: "Ice Wizard Instant", ty: ["Ice", "Wizard", "Instant"],
               tx: "Create X Frostbite tokens under target hero's control.", kw: [], gkw: []};
  const g = table({res: 2, hand: [syn]});
  let n = J.reduce(g, {t: "play", uid: "sx", from: "hand"}, 0).state;
  assert.equal(n.pending && n.pending.kind, "xval", "fixture: the instant was not asked for X");
  n = J.reduce(n, {t: "xval", x: 2}, 0).state;
  assert.ok(!(n.stack || []).some(l => l.k === "play"), "fixture: the instant was held — it must resolve on play");
  assert.equal(frosts(n.sides[1]), 2);
  assert.equal(n._x, undefined, "an instant's X outlived its play — the next X card skips the question");
});

/* ---- 5. THE POLICY AND THE TRAINER --------------------------------------- */

test("the policy takes the most it can pay for", {skip}, () => {
  /* A printed X is value the card is paid FOR — every X is one more token
     on the other seat — and it is a number the policy reads off the
     question, never off card text.

     IT IS NOT DOMINANT, AND THAT IS MEASURED RATHER THAN CLAIMED. Fusion is
     asked AFTER the payment, and paying the largest X pitches every card
     that can pay — including the Ice card fusion would have revealed. Over
     56 Iyslander games Ice Eternal was fused on 10 of 21 plays before v4.72
     (when it created nothing either way) and on 1 of 20 after. Which card
     to keep back for a reveal is a judgement about card text, which this
     policy reads none of (v4.24), so the simplification is stated here and
     in CHANGELOG rather than dressed as a proof. */
  const n = play(table({res: 4})).state;
  assert.deepEqual(SP.act(n, 0), {t: "xval", x: 2});
});

const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HTML = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));

test("the trainer asks the same question through its own door", () => {
  /* `Battle` cannot be loaded in Node, so this half is a scan — the WHOLE
     conditional, because `if(false && …)` keeps every name (v4.00, v4.55). */
  assert.ok(HTML.includes("if(card.cx && s._x == null){"),
    "the trainer's tryPlay never asks for X — the card is played at X = 0 on the board a player uses");
  assert.ok(HTML.includes("const base = effCost(card, act(s), costCtx(s, actorOf(s)));"),
    "the trainer's bound is not priced with the game's half of the cost (a Frostbite tax, a costTax)");
  assert.ok(HTML.includes("return {...s, mode:\"act\", xPick:null, _x:x};"),
    "the trainer's answer does not ride on the state");
  /* AND THE DECLARATION IS FORGOTTEN on both ways out of a play */
  const cancel = HTML.slice(HTML.indexOf("const cancelPay = () => setG"));
  assert.ok(cancel.slice(0, cancel.indexOf("\n")).includes("delete n._x;"),
    "cancelling a payment keeps X — the next X card skips the question");
  assert.match(HTML, /if\(n\._x !== undefined\)\{ n = \{\.\.\.n\}; delete n\._x; \}/,
    "a resolved play keeps X");
});

test("the table offers every value the question allows, and sends it as the action", () => {
  assert.match(HTML, /const xval\s*=\s*kindIs\("xval"\);/);
  assert.match(HTML, /fire\(\{t:"xval",x\}\)/, "the table's X buttons send nothing judge accepts");
  assert.match(HTML, /length:\s*\(xval\.max\|\|0\)\s*\+\s*1/, "the table does not offer X = 0 through the bound");
});
