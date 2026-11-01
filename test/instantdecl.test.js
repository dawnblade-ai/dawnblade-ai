/* ======================================================================
   THE TRAINER'S INSTANT-SPEED DOORS ASK THEIR DECLARATIONS (v5.70)

   `trainer-instant-doors-no-declarations` (tools/approx.js, stated since
   v4.95) recorded that the four instant doors — a reaction from hand, a
   reaction from the arsenal, Iyslander's arsenal instant, and an instant on
   the opponent's turn — played a card with no DECLARATION before the
   payment, where the table asks both for every play:

     * "Ice Fusion — as an additional cost you may reveal an Ice card from
       your hand" (Aether Icevein, Brain Freeze, Ice Eternal), and
     * X (Ice Eternal prints XX).

   Through those doors a fused card resolved unfused and Ice Eternal minted
   nothing — weaker than printed, and visible. NO RESERVED-SPEED CARD IN THE
   POOL PRINTS EITHER: what reaches the doors is a card a GRANT frees to
   instant speed (Iyslander's blue non-attack actions from the arsenal on
   their turn; Stir the Aetherwinds' next Wizard non-attack action).

   THE TRAINER'S HALF IS THE REAL FUNCTION TEXT. `askX`, `askInstantDecl`,
   `redoDoor` and `spentDecl` are closures inside `Battle`, which cannot be
   loaded in Node, so this file slices their source out of index.html and
   runs it with the bridge's own readers (`effCost`, `costCtx`,
   `fusionOffer`, `payCeiling`) — the trainer's question, asked of a
   judge-shaped state. Where a claim is about WIRING (each door asks, in
   order, before it pays) it is a source scan and says so; the page drive
   is a scratchpad script beside tools/page.js, not part of this suite.

   THE ENGINE'S HALF is driven: the answers ride on the state exactly as
   the sheets leave them, and `playAtSpeed` is called as the doors call it.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const EFX = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ---- the trainer's own function text, run ---------------------------- */
const SRC = (() => {
  const a = HTML.indexOf("const askX = (s, card, from, idx, door) => {");
  const b = HTML.indexOf("const confirmX = x => {");
  assert.ok(a > 0 && b > a, "askX .. confirmX moved — re-anchor this drill");
  return HTML.slice(a, b);
})();
const trainer = (spy) => new Function("act", "actorOf", "effCost", "costCtx", "L", "DawnParser",
  "playRx", "playRxA", "playArsenalInstant", "playFoeTurnRx",
  SRC + "\nreturn {askX, askInstantDecl, redoDoor, spentDecl};")(
  s => s.sides[s.actor || 0], s => s.actor || 0, P.effCost, P.costCtx,
  (s, m) => ({...s, log: [m, ...(s.log || [])]}), P,
  spy.playRx, spy.playRxA, spy.playArsenalInstant, spy.playFoeTurnRx);
const T = () => trainer({});

/* ---- fixtures -------------------------------------------------------- */
const fuel = (n, pitch) => ({name: "Fuel" + n, uid: "F" + n, pitch: pitch || 3, power: null, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
/* a cost-0 ACTION for Brain Freeze to find in the opponent's hand */
const cheap = {name: "Cheap Action", uid: "CH", pitch: 1, power: null, def: 0, cost: 0,
  tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: []};
const card = (nm, p, uid) => ({...H.card(nm, p), uid});
/* THE OPPONENT'S TURN: seat 0 holds priority in `foeturn`. */
const foeTurn = (mine, theirs) => ({
  ...H.state(Object.assign({res: 0, ap: 0}, mine), Object.assign({res: 0}, theirs || {}),
    {actor: 0, turnPlayer: 1}), mode: "foeturn", pend: null});
const play = (g, c, from, o) => H.fx(g, (f, n) => f.playAtSpeed(n, c, from, o));
const frost = sd => (sd.board || []).filter(b => b && b.card && b.card.name === "Frostbite").length;

/* ---- WHAT THE TRAINER NOW ASKS --------------------------------------- */

test("X is asked first, and the sheet carries the mode it returns to", {skip}, () => {
  H.db();
  const ie = card("Ice Eternal", 3, "IE");
  /* hand 3 + 3 and nothing floating: X = 3 is the most (2 per X) */
  const g = foeTurn({arsenal: ie, hand: [card("Cold Snap", 3, "CS"), fuel(1)]});
  const q = T().askInstantDecl(g, ie, "arsenal", 0, {k: "arsenalInstant"});
  assert.ok(q, "an X card at instant speed asks nothing — the record's deviation");
  assert.equal(q.mode, "xpick");
  assert.equal(q.xPick.max, 3);
  assert.equal(q.xPick.per, 2);
  assert.equal(q.xPick.door.k, "arsenalInstant");
  assert.equal(q.xPick.door.back, "foeturn", "the answer must return to the opponent's-turn window");
  /* THE BOUND IS PRICED, not just counted: a Frostbite on the player's own board taxes
     the play by 1, so six in hand raise X = 2 (cost 1 + 2 + 2), not 3 */
  const fb = {...H.tok("Frostbite"), uid: "FB1"};
  const taxed = foeTurn({arsenal: ie, hand: [card("Cold Snap", 3, "CS"), fuel(1)], board: [{card: fb, uid: "FB1"}]});
  assert.equal(T().askInstantDecl(taxed, ie, "arsenal", 0, {k: "arsenalInstant"}).xPick.max, 2,
    "the X bound ignores what the play already costs");
  /* AND X = 0 IS ALWAYS A BUTTON: the bound is a ceiling, the floor is 0 */
  const poor = foeTurn({arsenal: ie, hand: [fuel(1, 1)]});
  assert.equal(T().askInstantDecl(poor, ie, "arsenal", 0, {k: "arsenalInstant"}).xPick.max, 0);
});

test("…then fusion, from the hand's Ice cards, in the table's order", {skip}, () => {
  H.db();
  const ie = card("Ice Eternal", 3, "IE"), cs = card("Cold Snap", 3, "CS");
  const g = {...foeTurn({arsenal: ie, hand: [cs, fuel(1), fuel(2)]}), _x: 2};
  const q = T().askInstantDecl(g, ie, "arsenal", 0, {k: "arsenalInstant"});
  assert.equal(q && q.mode, "fusepick", "an Ice Fusion card at instant speed asks nothing");
  assert.deepEqual(q.pending.uids, ["CS"], "only the Ice card can be revealed");
  assert.deepEqual(q.pending.types, ["ice"]);
  assert.equal(q.pending.door.back, "foeturn");
  /* answered either way, there is nothing left to ask: a decline is `null`, which
     is NOT `undefined` — declining must not loop the question */
  for(const ans of [null, "CS"])
    assert.equal(T().askInstantDecl({...g, _fuseUid: ans}, ie, "arsenal", 0, {k: "arsenalInstant"}), null,
      "an answered fusion (" + ans + ") is asked again");
  /* a play that prints neither asks nothing, and a hand with no Ice card cannot pay */
  const bf = card("Brain Freeze", 3, "BF");
  assert.equal(T().askInstantDecl(foeTurn({hand: [bf, fuel(1)]}), bf, "hand", 0, {k: "foeRx", i: 0}), null,
    "a hand with no Ice card is asked about a reveal it cannot make");
  const fs1 = card("Frost Spike", 1, "FS");
  assert.equal(T().askInstantDecl(foeTurn({hand: [fs1, cs]}), fs1, "hand", 0, {k: "foeRx", i: 0}), null,
    "an instant that prints neither fusion nor X is asked something");
});

test("a reveal the PAYMENT would spend is not offered", {skip}, () => {
  H.db();
  /* Ice Eternal at X = 1 costs 2. With only the Cold Snap (pitch 3) in hand it is
     the only way to pay, so revealing it would be a bonus the payment then spends. */
  const ie = card("Ice Eternal", 3, "IE"), cs = card("Cold Snap", 3, "CS");
  const lone = {...foeTurn({arsenal: ie, hand: [cs]}), _x: 1};
  assert.equal(T().askInstantDecl(lone, ie, "arsenal", 0, {k: "arsenalInstant"}), null);
  const spare = {...foeTurn({arsenal: ie, hand: [cs, fuel(1)]}), _x: 1};
  assert.deepEqual(T().askInstantDecl(spare, ie, "arsenal", 0, {k: "arsenalInstant"}).pending.uids, ["CS"]);
  /* …and the engine keeps what was revealed out of the pitch, with the cheaper
     card to spend being the revealed one (it is the pool's lowest by value) */
  const g = {...spare, _fuseUid: "CS"};
  const out = play(g, ie, "arsenal", {window: "instant"});
  assert.equal(out.why, null);
  assert.ok(out.game.sides[0].hand.some(c => c.uid === "CS"), "the revealed card was pitched to pay");
  assert.ok(out.game.sides[0].pitch.some(c => c.uid === "F1"), "the other card paid");
});

test("`redoDoor` re-enters the door the question came from, with its own arguments", () => {
  const seen = [];
  const rec = nm => (...a) => seen.push([nm, ...a]);
  const t = trainer({playRx: rec("playRx"), playRxA: rec("playRxA"),
    playArsenalInstant: rec("playArsenalInstant"), playFoeTurnRx: rec("playFoeTurnRx")});
  t.redoDoor({k: "hand", i: 4, addPaid: undefined});
  t.redoDoor({k: "arsenalRx"});
  t.redoDoor({k: "arsenalInstant"});
  t.redoDoor({k: "foeRx", i: 2});
  assert.deepEqual(seen, [["playRx", 4, undefined], ["playRxA"], ["playArsenalInstant"], ["playFoeTurnRx", 2]]);
});

test("`spentDecl` drops both answers and touches nothing else", () => {
  const t = T();
  const g = {a: 1, _x: 2, _fuseUid: null};
  assert.deepEqual(t.spentDecl(g), {a: 1});
  assert.deepEqual(t.spentDecl({a: 1, _fuseUid: "U"}), {a: 1});
  const clean = {a: 1};
  assert.equal(t.spentDecl(clean), clean, "a state with no answers is returned as it is");
  assert.deepEqual(g, {a: 1, _x: 2, _fuseUid: null}, "the caller's state was mutated");
});

/* ---- WHAT THE ANSWERS DO (driven, as the doors call it) --------------- */

test("X at instant speed mints X Frostbites; unasked it mints none", {skip}, () => {
  H.db();
  const ie = card("Ice Eternal", 3, "IE");
  const mk = () => foeTurn({arsenal: ie, hand: [fuel(1), fuel(2), fuel(3)]});
  const asked = play({...mk(), _x: 2, _fuseUid: null}, ie, "arsenal", {window: "instant"});
  assert.equal(asked.why, null);
  assert.equal(frost(asked.game.sides[1]), 2, "X = 2 declared, and two Frostbites were not created");
  assert.equal(asked.game.sides[0].pitch.length, 2, "X = 2 costs 4: two blues pitched");
  /* the old behaviour, which is the record's measurement: no declaration, no tokens */
  const unasked = play(mk(), ie, "arsenal", {window: "instant"});
  assert.equal(frost(unasked.game.sides[1]), 0, "an undeclared X is inert, never free (v2.04)");
  /* X = 0 declined is legal and free */
  const zero = play({...mk(), _x: 0, _fuseUid: null}, ie, "arsenal", {window: "instant"});
  assert.equal(frost(zero.game.sides[1]), 0);
  assert.equal(zero.game.sides[0].pitch.length, 0, "X = 0 pays nothing");
});

test("a revealed Ice card fuses Ice Eternal at instant speed; declining gives no rider", {skip}, () => {
  H.db();
  const ie = card("Ice Eternal", 3, "IE"), cs = card("Cold Snap", 3, "CS");
  const mk = () => foeTurn({arsenal: ie, hand: [cs, fuel(1), fuel(2)]});
  const lifeOf = g => g.sides[1].hp;
  const base = lifeOf(mk());
  /* FUSED: "deal arcane damage to that hero equal to the number of Frostbites
     they control" — two of them, so two damage */
  const fused = play({...mk(), _x: 2, _fuseUid: "CS"}, ie, "arsenal", {window: "instant"});
  assert.equal(fused.why, null);
  assert.equal(frost(fused.game.sides[1]), 2);
  assert.equal(base - lifeOf(fused.game), 2, "the fused rider did not land");
  assert.ok(fused.game.sides[0].hand.some(c => c.uid === "CS"), "revealing moves nothing");
  /* DECLINED: the same play with `null` answers the same question */
  const plain = play({...mk(), _x: 2, _fuseUid: null}, ie, "arsenal", {window: "instant"});
  assert.equal(frost(plain.game.sides[1]), 2);
  assert.equal(base - lifeOf(plain.game), 0, "declining the reveal still fused the card");
});

test("Brain Freeze, a fusion card with no X, is fused the same way from the hand on their turn", {skip}, () => {
  H.db();
  const bf = card("Brain Freeze", 3, "BF"), cs = card("Cold Snap", 3, "CS");
  const mk = () => foeTurn({hand: [bf, cs]}, {hand: [{...cheap}]});
  const decks = g => g.sides[1].deck.map(c => c.uid);
  const fused = play({...mk(), _fuseUid: "CS"}, bf, "hand", {window: "instant"});
  assert.equal(fused.why, null);
  assert.ok(!fused.game.sides[1].hand.some(c => c.uid === "CH"), "the cost-0 action stayed in their hand");
  assert.equal(decks(fused.game)[0], "CH", "and went on top of their deck");
  const plain = play({...mk(), _fuseUid: null}, bf, "hand", {window: "instant"});
  assert.ok(plain.game.sides[1].hand.some(c => c.uid === "CH"), "an unfused Brain Freeze moved their card");
});

test("the declarations are spent: a played card leaves neither answer on the state", {skip}, () => {
  H.db();
  const ie = card("Ice Eternal", 3, "IE"), cs = card("Cold Snap", 3, "CS");
  const g = {...foeTurn({arsenal: ie, hand: [cs, fuel(1), fuel(2)]}), _x: 2, _fuseUid: "CS"};
  const out = play(g, ie, "arsenal", {window: "instant"});
  assert.equal(out.why, null);
  assert.equal(out.game._x, undefined, "the next X card would be played at this one's X, unasked");
  assert.equal(out.game._fuseUid, undefined, "the next fusion card would be fused as this one was, unasked");
});

/* ---- THE WIRING (a source scan, stated as one) ------------------------ */

const DOORS = [
  ["playRx", "const playRx = (i, addPaid) => setG", "const playRxA = () => setG", /askInstantDecl\(s, c, "hand", i, \{k:"hand", i, addPaid\}\)/],
  ["playRxA", "const playRxA = () => setG", "const playArsenalInstant = () => setG", /askInstantDecl\(s, c, "arsenal", 0, \{k:"arsenalRx"\}\)/],
  ["playArsenalInstant", "const playArsenalInstant = () => setG", "const playFoeTurnRx = i => setG", /askInstantDecl\(s, c, "arsenal", 0, \{k:"arsenalInstant"\}\)/],
  ["playFoeTurnRx", "const playFoeTurnRx = i => setG", "const foePassWindow = ", /askInstantDecl\(s, c, "hand", i, \{k:"foeRx", i\}\)/]
];
const doorBody = (a, b) => HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a) + 10));

test("every instant door asks its declarations BEFORE it pays, and returns the sheet", () => {
  for(const [nm, a, b, ask] of DOORS){
    const body = doorBody(a, b);
    assert.ok(body.length > 300, nm + " anchors moved");
    assert.match(body, ask, nm + " asks no declaration — the record's deviation");
    /* EVERY payment in the door is preceded by its own question (playRxA has two) */
    const segs = body.split("_EFX.playAtSpeed(");
    assert.ok(segs.length >= 2, nm + " no longer plays through playAtSpeed");
    for(let k = 0; k < segs.length - 1; k++){
      assert.match(segs[k], /askInstantDecl\(/, nm + " pays (#" + (k + 1) + ") with no question before it");
      assert.match(segs[k], /askInstantDecl\([^\n]*if\(_dq\) return _dq;/, nm + " drops the sheet it was handed");
    }
    const asks = (body.match(/askInstantDecl\(/g) || []).length, held = (body.match(/if\(_dq\) return _dq;/g) || []).length;
    assert.equal(asks, segs.length - 1, nm + " asks a different number of times than it pays");
    assert.equal(held, asks, nm + " drops a sheet it was handed");
    assert.equal((body.match(/if\(out\.why\) return L\(spentDecl\(s\), /g) || []).length, segs.length - 1,
      nm + " keeps the answers of a refused play");
  }
  /* the hand door asks fusion BEFORE the additional cost, the table's order */
  const hand = doorBody(DOORS[0][1], DOORS[0][2]);
  assert.ok(hand.search(/askInstantDecl\(/) < hand.search(/mode:"rxaddpay"/),
    "the table asks fusion before the additional cost (judge.maybeFuse -> maybeAddPay)");
});

test("the answers re-enter the door and restore the window they were asked in", () => {
  const x = HTML.slice(HTML.indexOf("const confirmX = x => {"), HTML.indexOf("const auraAtkOf"));
  assert.ok(x.length > 100 && x.length < 1200, "confirmX anchors moved");
  assert.match(x, /mode:\(pick\.door&&pick\.door\.back\)\|\|"act", xPick:null, _x:x/,
    "X does not restore the window it was asked in");
  assert.match(x, /if\(pick && pick\.door\) redoDoor\(pick\.door\);\s*else if\(pick\) tryPlay\(/,
    "an instant door's X goes back to `tryPlay`, which refuses an instant's window");
  const f = HTML.slice(HTML.indexOf("const confirmFuse = (uid) => {"), HTML.indexOf("const confirmFuseAt"));
  assert.ok(f.length > 100, "confirmFuse moved");
  assert.match(f, /_fuseUid:pick\} : s\);\s*redoDoor\(pk\);/, "a door's fusion answer is not sent back to the door");
  assert.match(f, /mode:pk\.back\|\|"act"/, "fusion does not restore the window it was asked in");
  assert.match(f, /: null;/, "a decline must be `null`, not undefined, or the question repeats");
});

test("`tryPlay` and the doors ask X through ONE body", () => {
  assert.match(HTML, /if\(card\.cx && s\._x == null\) return askX\(s, card, from, idx\);/);
  assert.match(HTML, /if\(card\.cx && s\._x == null\) return askX\(s, card, from, idx, dq\);/);
  assert.equal((HTML.match(/mode:"xpick"/g) || []).length, 1, "a second place opens the X sheet");
});

test("`playAtSpeed` spends the answers and keeps a revealed card out of the pitch", () => {
  const a = EFX.indexOf("const playAtSpeed = (s, c, from, o) =>");
  const body = EFX.slice(a, EFX.indexOf("function applyArsGrant", a));
  assert.match(body, /delete n\._addPaid; delete n\._x; delete n\._fuseUid;/);
  assert.match(body, /autoPitch\(s, cost \+ extra, s\._fuseUid != null \? \[c\.uid, s\._fuseUid\] : \[c\.uid\]\)/);
});
