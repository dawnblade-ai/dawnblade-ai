/* The prompt machinery — the thing 26 recorded rulings are waiting on.
   These drills exercise it as DATA: a ruling becomes a spec object, and
   the same five code paths serve every one of them. Prompts are addressed
   to a SIDE, so the opponent-facing cases are drilled too. */
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../engine/prompts.js");
const S = require("../engine/sides.js");

let uid = 0;
const card = o => ({uid:++uid, name:"c"+uid, pitch:1, cost:0, power:0, def:0, tt:"Action", tx:"", kw:[], ...o});

function game(side0, side1){
  const g = S.makeGame({});
  g.sides = [{...S.makeSide({id:0}), ...(side0||{})},
             {...S.makeSide({id:1}), ...(side1||{})}];
  return g;
}

/* ---- zones ----------------------------------------------------------- */
test("promptZone reads a plain list zone", () => {
  const a = card({name:"z-a"}), b = card({name:"z-b"});
  assert.deepEqual(Q.promptZone(game({grave:[a,b]}), 0, "grave"), [a,b]);
});

test("promptZone normalises arsenal (a single card) and board (wrappers)", () => {
  const a = card({name:"z-ars"}), b = card({name:"z-brd"});
  assert.deepEqual(Q.promptZone(game({arsenal:a}), 0, "arsenal"), [a]);
  assert.deepEqual(Q.promptZone(game({arsenal:null}), 0, "arsenal"), []);
  assert.deepEqual(Q.promptZone(game({board:[{card:b}]}), 0, "board"), [b]);
});

test("promptZone reads the OPPONENT's zones too — intimidate needs that", () => {
  const a = card({name:"z-opp"});
  assert.deepEqual(Q.promptZone(game({}, {hand:[a]}), 1, "hand"), [a]);
});

/* ---- filters --------------------------------------------------------- */
test("filter: no spec matches everything", () => {
  assert.equal(Q.promptFilter(null)(card({name:"f-any"})), true);
});

test("filter: every declared key must match", () => {
  const f = Q.promptFilter({pitch:3, costLe:2});
  assert.equal(f(card({name:"f-1", pitch:3, cost:1})), true);
  assert.equal(f(card({name:"f-2", pitch:3, cost:5})), false, "cost is over the cap");
  assert.equal(f(card({name:"f-3", pitch:1, cost:1})), false, "wrong pitch");
});

test("filter: attack / nonAttack read the printed type line", () => {
  const atk = card({name:"f-atk", tt:"Attack Action", power:4});
  const non = card({name:"f-non", tt:"Action"});
  assert.equal(Q.promptFilter({type:"attack"})(atk), true);
  assert.equal(Q.promptFilter({type:"attack"})(non), false);
  assert.equal(Q.promptFilter({type:"nonAttack"})(non), true);
});

test("filter: power and name bounds", () => {
  assert.equal(Q.promptFilter({powerGe:6})(card({name:"f-big", power:6})), true);
  assert.equal(Q.promptFilter({powerGe:6})(card({name:"f-sml", power:5})), false);
  assert.equal(Q.promptFilter({name:"Bolt"})(card({name:"Bolt'n Boots"})), true);
});

/* ---- build ----------------------------------------------------------- */
test("build: a prompt with nothing to ask returns null and skips itself", () => {
  assert.equal(Q.buildPrompt(game({deck:[]}), {tag:"opt", n:1}), null);
  assert.equal(Q.buildPrompt(game({grave:[]}), {tag:"pick", zone:"grave"}), null);
  assert.equal(Q.buildPrompt(game({}), {tag:"modal", options:[{label:"only one"}]}), null,
    "a modal needs at least two options");
});

test("build: opt looks at the top N of the asked side's deck", () => {
  const g = game({deck:[card({name:"o-1"}),card({name:"o-2"}),card({name:"o-3"})]});
  const p = Q.buildPrompt(g, {tag:"opt", n:2, src:"Sigil"});
  assert.equal(p.cards.length, 2);
  assert.equal(p.side, 0);
  assert.equal(p.src, "Sigil");
  assert.match(p.title, /Opt 2/);
});

test("build: pick clamps max to what is actually there", () => {
  const g = game({grave:[card({name:"p-1"}), card({name:"p-2"})]});
  const p = Q.buildPrompt(g, {tag:"pick", zone:"grave", max:5});
  assert.equal(p.max, 2);
  assert.equal(p.cards.length, 2);
});

test("build: pick with min 0 is optional", () => {
  const g = game({hand:[card({name:"p-opt"})]});
  assert.equal(Q.buildPrompt(g, {tag:"pick", min:0, max:1}).optional, true);
  assert.equal(Q.buildPrompt(g, {tag:"pick", min:1, max:1}).optional, false);
});

test("build: pick applies the filter before offering anything", () => {
  const g = game({grave:[card({name:"p-red", pitch:1}), card({name:"p-blue", pitch:3})]});
  const p = Q.buildPrompt(g, {tag:"pick", zone:"grave", filter:{pitch:3}});
  assert.equal(p.cards.length, 1);
  assert.equal(p.cards[0].name, "p-blue");
});

test("build: a prompt can be addressed to the opponent", () => {
  const g = game({}, {hand:[card({name:"p-theirs"})]});
  const p = Q.buildPrompt(g, {tag:"pick", side:1, zone:"hand"});
  assert.equal(p.side, 1);
  assert.equal(p.cards[0].name, "p-theirs");
});

/* ---- selection ------------------------------------------------------- */
test("select: pick refuses to exceed max", () => {
  const g = game({hand:[card({name:"s-1"}),card({name:"s-2"}),card({name:"s-3"})]});
  let p = Q.buildPrompt(g, {tag:"pick", max:2});
  p = Q.promptToggleSel(p, 0);
  p = Q.promptToggleSel(p, 1);
  p = Q.promptToggleSel(p, 2);
  assert.deepEqual(p.sel, [0,1], "the third selection is refused");
  p = Q.promptToggleSel(p, 0);
  assert.deepEqual(p.sel, [1], "tapping again deselects");
});

test("select: opt toggles bottom rather than selecting", () => {
  const g = game({deck:[card({name:"s-o1"}),card({name:"s-o2"})]});
  let p = Q.promptToggleSel(Q.buildPrompt(g, {tag:"opt", n:2}), 1);
  assert.deepEqual(p.down, [1]);
});

test("ready: pick needs its minimum, modal and pay need a choice", () => {
  const g = game({hand:[card({name:"r-1"})]});
  let p = Q.buildPrompt(g, {tag:"pick", min:1, max:1});
  assert.equal(Q.promptReady(p), false);
  assert.equal(Q.promptReady(Q.promptToggleSel(p, 0)), true);

  let m = Q.buildPrompt(g, {tag:"modal", options:[{label:"A"},{label:"B"}]});
  assert.equal(Q.promptReady(m), false);
  assert.equal(Q.promptReady(Q.promptChoose(m, 1)), true);

  let y = Q.buildPrompt(g, {tag:"pay", cost:2, avail:3});
  assert.equal(Q.promptReady(y), false);
  assert.equal(Q.promptReady(Q.promptChoose(y, "decline")), true);
});

test("ready: an optional pick is confirmable with nothing selected", () => {
  const g = game({hand:[card({name:"r-opt"})]});
  assert.equal(Q.promptReady(Q.buildPrompt(g, {tag:"pick", min:0, max:1})), true);
});

/* ---- moving cards ---------------------------------------------------- */
test("moveCards moves between list zones without touching the other side", () => {
  const a = card({name:"m-a"}), b = card({name:"m-b"});
  const g = game({grave:[a,b]}, {grave:[card({name:"m-theirs"})]});
  const n = Q.moveCards(g, 0, "grave", "hand", [a]);
  assert.deepEqual(n.sides[0].grave.map(c=>c.name), ["m-b"]);
  assert.deepEqual(n.sides[0].hand.map(c=>c.name), ["m-a"]);
  assert.equal(n.sides[1].grave.length, 1, "the opponent was not touched");
  assert.equal(g.sides[0].grave.length, 2, "the original state was mutated");
});

test("moveCards handles deckTop and deckBottom distinctly", () => {
  const a = card({name:"m-top"});
  const g = game({hand:[a], deck:[card({name:"m-d1"}), card({name:"m-d2"})]});
  assert.equal(Q.moveCards(g, 0, "hand", "deckTop", [a]).sides[0].deck[0].name, "m-top");
  const bot = Q.moveCards(g, 0, "hand", "deckBottom", [a]).sides[0].deck;
  assert.equal(bot[bot.length-1].name, "m-top");
});

test("moveCards empties the arsenal on the way out and fills it on the way in", () => {
  const a = card({name:"m-ars"});
  const g = game({arsenal:a});
  assert.equal(Q.moveCards(g, 0, "arsenal", "grave", [a]).sides[0].arsenal, null);
  const b = card({name:"m-into"});
  const g2 = game({hand:[b]});
  assert.equal(Q.moveCards(g2, 0, "hand", "arsenal", [b]).sides[0].arsenal.name, "m-into");
});

/* ---- resolution ------------------------------------------------------ */
test("apply: opt reorders the deck, bottoms go under the untouched rest", () => {
  const g = game({deck:[card({name:"a-1"}),card({name:"a-2"}),card({name:"a-3"})]});
  let p = Q.buildPrompt(g, {tag:"opt", n:2});
  p = Q.promptToggleSel(p, 0);            /* send a-1 to the bottom */
  const r = Q.applyPrompt(g, p);
  assert.deepEqual(r.game.sides[0].deck.map(c=>c.name), ["a-2","a-3","a-1"]);
  assert.match(r.msgs[0], /sent to the bottom/);
});

test("apply: pick moves the chosen cards to the destination zone", () => {
  const a = card({name:"a-pick"});
  const g = game({grave:[a, card({name:"a-left"})]});
  let p = Q.buildPrompt(g, {tag:"pick", zone:"grave", to:"hand", max:1});
  p = Q.promptToggleSel(p, 0);
  const r = Q.applyPrompt(g, p);
  assert.deepEqual(r.game.sides[0].hand.map(c=>c.name), ["a-pick"]);
  assert.deepEqual(r.game.sides[0].grave.map(c=>c.name), ["a-left"]);
});

test("apply: a pick with no destination is a reveal, and moves nothing", () => {
  const g = game({deck:[card({name:"a-rev"})]});
  let p = Q.buildPrompt(g, {tag:"pick", zone:"deck", max:1});
  p = Q.promptToggleSel(p, 0);
  const r = Q.applyPrompt(g, p);
  assert.equal(r.game.sides[0].deck.length, 1, "nothing moved");
  assert.match(r.msgs[0], /revealed/);
});

test("apply: choosing nothing on an optional pick is honest about it", () => {
  const g = game({hand:[card({name:"a-none"})]});
  const r = Q.applyPrompt(g, Q.buildPrompt(g, {tag:"pick", min:0, max:1}));
  assert.deepEqual(r.ops, []);
  assert.match(r.msgs[0], /chose nothing/);
});

test("apply: a modal hands back the chosen mode's ops and nothing else", () => {
  const g = game({});
  const p = Q.promptChoose(Q.buildPrompt(g, {tag:"modal", options:[
    {label:"Deal 3", ops:[["dmg",3]]},
    {label:"Draw 1", ops:[["draw",1]]}]}), 1);
  const r = Q.applyPrompt(g, p);
  assert.deepEqual(r.ops, [["draw",1]]);
  assert.match(r.msgs[0], /Draw 1/);
});

/* Pay-or-decline is the one that unblocks the "If you do, …" family —
   the rider must NOT resolve unless the cost was actually paid. That is
   the bug v2.04 fixed and this is where it would come back. */
test("apply: paying charges the cost and returns the rider's ops", () => {
  const g = game({});
  const p = Q.promptChoose(Q.buildPrompt(g, {tag:"pay", cost:2, avail:3, ops:[["dmg",4]]}), "pay");
  const r = Q.applyPrompt(g, p);
  assert.equal(r.pay, 2);
  assert.deepEqual(r.ops, [["dmg",4]]);
});

test("apply: declining charges nothing and the rider does NOT resolve", () => {
  const g = game({});
  const p = Q.promptChoose(Q.buildPrompt(g, {tag:"pay", cost:2, avail:3, ops:[["dmg",4]]}), "decline");
  const r = Q.applyPrompt(g, p);
  assert.equal(r.pay, 0);
  assert.deepEqual(r.ops, [], "an unpaid optional cost must never fire its payload");
  assert.match(r.msgs[0], /declined/);
});

test("apply: an opponent-facing prompt names them, not you", () => {
  const g = game({}, {});
  const p = Q.promptChoose(Q.buildPrompt(g, {tag:"pay", side:1, cost:1, avail:1}), "decline");
  assert.match(Q.applyPrompt(g, p).msgs[0], /opponent/i);
});

test("apply: resolution never mutates the state it was handed", () => {
  const a = card({name:"a-imm"});
  const g = game({grave:[a]});
  let p = Q.promptToggleSel(Q.buildPrompt(g, {tag:"pick", zone:"grave", to:"hand", max:1}), 0);
  Q.applyPrompt(g, p);
  assert.equal(g.sides[0].grave.length, 1);
  assert.equal(g.sides[0].hand.length, 0);
});

/* ===================================================================
   THE "IF YOU DO" RIDER on a pick (v2.28).

   "You may banish an aura from your graveyard. If you do, deal 1 arcane
   damage" is an OPTIONAL COST with a payload. `min:0` makes the pick
   declinable; `ops` is the payload. The rule that matters is that the
   payload fires ONLY if the cost was actually paid — granting it for
   free is the bug v2.04 fixed, and it is why "If you do" was left
   deliberately unread until the machinery existed.
   =================================================================== */
const riderGame = () => {
  const g = S.makeGame({seed: 7});
  g.sides[0].grave = [
    {name:"Sigil of Silphidae", uid:71, tt:"Runeblade Action - Aura", pitch:3},
    {name:"Wild Ride",          uid:72, tt:"Brute Attack Action",     pitch:1}
  ];
  return g;
};
const RIDER = [["arcane", 1]];

test("pick rider — paying the cost fires the rider AND moves the card", () => {
  const g = riderGame();
  const p = Q.buildPrompt(g, {tag:"pick", side:0, src:"Runic Fellingsong",
    zone:"grave", to:"banish", filter:{tt:"aura"}, min:0, max:1, ops:RIDER});
  assert.ok(p, "a graveyard with a matching aura must produce a prompt");
  assert.equal(p.cards.length, 1, "only the aura matches the filter");
  assert.equal(p.optional, true, "min:0 makes it declinable");

  const out = Q.applyPrompt(g, Q.promptToggleSel(p, 0));
  assert.deepEqual(out.ops, RIDER, "paying the cost must fire the rider");
  assert.equal(Q.promptZone(out.game, 0, "banish").length, 1, "the aura moved to banish");
  assert.equal(Q.promptZone(out.game, 0, "grave").length, 1, "and left the graveyard");
});

test("pick rider — DECLINING fires nothing and moves nothing (the v2.04 rule)", () => {
  const g = riderGame();
  const p = Q.buildPrompt(g, {tag:"pick", side:0, src:"Runic Fellingsong",
    zone:"grave", to:"banish", filter:{tt:"aura"}, min:0, max:1, ops:RIDER});
  const out = Q.applyPrompt(g, p);          /* nothing selected */
  assert.deepEqual(out.ops, [], "declining must NOT fire the rider — that is the free-ability bug");
  assert.equal(out.pay, 0);
  assert.equal(Q.promptZone(out.game, 0, "banish").length, 0, "nothing may move on a decline");
  assert.equal(Q.promptZone(out.game, 0, "grave").length, 2, "the graveyard is untouched");
});

test("pick rider — a pick with no ops still behaves exactly as before", () => {
  const g = riderGame();
  const p = Q.buildPrompt(g, {tag:"pick", side:0, zone:"grave", to:"hand", min:0, max:1});
  const out = Q.applyPrompt(g, Q.promptToggleSel(p, 0));
  assert.deepEqual(out.ops, [], "no rider declared, so no ops — retrieve/reload are unaffected");
  assert.equal(Q.promptZone(out.game, 0, "hand").length, 1, "but the card still moves");
});

test("pick rider — an empty zone yields no prompt, so the cost cannot be paid", () => {
  const g = S.makeGame({seed: 7});
  const p = Q.buildPrompt(g, {tag:"pick", side:0, zone:"grave",
    to:"banish", filter:{tt:"aura"}, min:0, max:1, ops:RIDER});
  assert.equal(p, null,
    "nothing to banish means the prompt skips itself — and a skipped prompt fires no rider");
});

/* ===================================================================
   THE ARSENAL PUT, as a prompt (v2.34).

   Death Dealer's "If you do, draw a card" and Bull's Eye Bracers'
   "It gains +1{p} until end of turn" both hang off the put ACTUALLY
   HAPPENING. `ops` is already enforced that way; `arsStamp` is carried
   through untouched so the trainer can stamp the card that moved.
   =================================================================== */
const arrowGame = () => {
  const g = S.makeGame({seed: 11});
  g.sides[0].hand = [
    {name:"Dry Powder Shot", uid:81, tt:"Ranger Action - Arrow Attack", pitch:1},
    {name:"Sharpen Steel",   uid:82, tt:"Warrior Action",              pitch:1}
  ];
  return g;
};

test("arsenal put — the prompt offers only arrows, and the put fills the arsenal", () => {
  const g = arrowGame();
  const p = Q.buildPrompt(g, {tag:"pick", side:0, src:"Death Dealer",
    zone:"hand", to:"arsenal", filter:{tt:"arrow"}, min:0, max:1, ops:[["draw",1]]});
  assert.ok(p);
  assert.equal(p.cards.length, 1, "the filter reads the printed type line, so only the arrow matches");
  const out = Q.applyPrompt(g, Q.promptToggleSel(p, 0));
  assert.deepEqual(out.ops, [["draw",1]], "the draw rides on the put actually happening");
  assert.equal(out.game.sides[0].arsenal.name, "Dry Powder Shot");
  assert.equal(out.game.sides[0].hand.length, 1, "and it left the hand");
});

test("arsenal put — declining draws nothing and puts nothing", () => {
  const g = arrowGame();
  const p = Q.buildPrompt(g, {tag:"pick", side:0, src:"Death Dealer",
    zone:"hand", to:"arsenal", filter:{tt:"arrow"}, min:0, max:1, ops:[["draw",1]]});
  const out = Q.applyPrompt(g, p);
  assert.deepEqual(out.ops, [], "a declined put must not draw — the v2.04 rule");
  assert.equal(out.game.sides[0].arsenal, null);
  assert.equal(out.game.sides[0].hand.length, 2);
});

test("arsenal put — no arrow in hand means no prompt at all", () => {
  const g = S.makeGame({seed: 11});
  g.sides[0].hand = [{name:"Sharpen Steel", uid:82, tt:"Warrior Action", pitch:1}];
  assert.equal(Q.buildPrompt(g, {tag:"pick", side:0, zone:"hand", to:"arsenal",
    filter:{tt:"arrow"}, min:0, max:1}), null,
    "an enabler with nothing to put skips itself rather than showing an empty sheet");
});

test("arsenal put — the Bracers' stamp rides on the spec, it is not an op", () => {
  /* The stamp must NOT be returned as ops: runOps would apply it to the
     SOURCE. It is carried so the trainer can put it on the card that moved. */
  const g = arrowGame();
  const spec = {tag:"pick", side:0, src:"Bull's Eye Bracers", zone:"hand",
    to:"arsenal", filter:{tt:"arrow"}, min:0, max:1, arsStamp:[["self",1]]};
  const p = Q.buildPrompt(g, spec);
  assert.deepEqual(p.arsStamp, [["self",1]], "buildPrompt carries the stamp through");
  const out = Q.applyPrompt(g, Q.promptToggleSel(p, 0));
  assert.deepEqual(out.ops, [], "the stamp is never run as an effect on the source");
});
