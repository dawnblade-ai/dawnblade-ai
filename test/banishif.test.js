/* ============================================================
   banishif.test.js — BANISH A CARD, THEN ASK WHAT IT WAS (v6.40)

   The fourth reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).
   Three STAGED cards (data/staged.js), three printed shapes, one idea:
   the card banishes something and the rest of its text is about THAT card.

     Pull from Beyond   "Opt 2 / Banish the top card of your deck. If it's
                         red, create a Gate to i'Arathael token. Go again"
     Embrace Ursur      "When this attacks, you may banish a card from your
                         hand. If it's Runeblade, create a Runechant token.
                         If it's Shadow, this gets go again."
     Corrupted Crown    "When this defends, you may banish a card from your
                         hand. If you do, this gets +1{d}."

   Driven at the table (judge.reduce), asserting on zones, hands, life,
   Runechants and the link's go again — never on feed prose.

   The Gate to i'Arathael token itself is the NEXT reader: here the staged
   Pull from Beyond is held to its parse and to the banish, and the
   conditional is driven on a twin that prints a payload the engine can
   already pay ("draw a card"), so the colour question has an observable.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const pool = (nm, p, uid) => ({...H.card(nm, p), uid});
const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const act = (g, a, seat) => {
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " was refused: " + out.error);
  return out.state;
};
const runeN = sd => (sd.board || []).filter(b => b.card.name === "Runechant").length;
const names = z => (z || []).map(c => c.name);

/* ---------------------------------------------------------------- */

test("the readers: each staged card's banish and its riders are read as data", {skip}, () => {
  H.db();
  const red = P.fxParse(staged("Pull from Beyond", null, 1)), blue = P.fxParse(staged("Pull from Beyond", null, 3));
  for(const [fx, pitch, word] of [[red, 1, "red"], [blue, 3, "blue"]]){
    assert.equal(fx.clauses.filter(c => c.st === "skip").length, 0, "a clause of Pull from Beyond reports unread");
    assert.equal(fx.ops.length, 1, "the banish sits beside the opt instead of waiting for it");
    assert.equal(fx.ops[0][0], "opt");
    assert.equal(fx.ops[0][1], 2);
    const then = fx.ops[0][2].then;
    assert.equal(then.length, 1);
    assert.equal(then[0][0], "banTop");
    assert.equal(then[0][2].pitch, pitch, "the " + word + " printing asks the wrong colour");
    assert.equal(then[0][2].ops[0][0], "token");
  }
  const eu = P.fxParse(staged("Embrace Ursur", null, 1));
  assert.deepEqual(eu.optCost, {trigger: "attacks", kind: "banish", zone: "hand", filter: {}, ops: [],
    classRiders: [{cls: "runeblade", ops: [["rune", 1]]}, {cls: "shadow", ops: [["ga"]]}]});
  assert.ok(!eu.ga, "a conditional go again is read as printed go again");
  const cc = P.fxParse(staged("Corrupted Crown"));
  assert.deepEqual(cc.optCost, {trigger: "defends", kind: "banish", zone: "hand", filter: {}, ops: [["defBuff", 1]]});
});

test("the readers refuse what they cannot pin", {skip}, () => {
  H.db();
  const base = staged("Embrace Ursur", null, 1);
  /* a class word outside the closed list, a colour asked as a class, and a
     payload nothing reads: each leaves the whole card unclaimed */
  for(const [nm, tx] of [
    ["Drill Ursur Guardian", "When this attacks, you may banish a card from your hand. If it's Guardian, create a Runechant token."],
    ["Drill Ursur Red", "When this attacks, you may banish a card from your hand. If it's red, create a Runechant token."],
    ["Drill Ursur Half", "When this attacks, you may banish a card from your hand. If it's Runeblade, create a Runechant token. If it's Shadow, sing a sea shanty."]]){
    const fx = P.fxParse({...base, name: nm, tx});
    assert.equal(fx.optCost, undefined, nm + " was claimed");
    assert.ok(fx.clauses.some(c => c.st === "skip"), nm + " reports every clause read");
  }
  /* a bare "card" is pinned only by the printed hand: from the graveyard,
     or with no zone, the cost still refuses (v3.53) */
  const crown = staged("Corrupted Crown");
  for(const [nm, tx] of [
    ["Drill Crown Nowhere", "When this defends, you may banish a card. If you do, this gets +1{d}."],
    ["Drill Crown Grave", "When this defends, you may banish a card from your graveyard. If you do, this gets +1{d}."],
    ["Drill Crown Discard", "When this defends, you may discard a card from your hand. If you do, this gets +1{d}."]])
    assert.equal(P.fxParse({...crown, name: nm, tx}).optCost, undefined, nm + " was claimed");
  /* a rider that is not the NEXT clause is not paired, and an unreadable
     payload leaves the banish standing alone */
  const pf = staged("Pull from Beyond", null, 1);
  const far = P.fxParse({...pf, name: "Drill Pull Far", tx: "Banish the top card of your deck. Draw a card. If it's red, gain 1{h}."});
  assert.ok(!far.ops.find(o => o[0] === "banTop")[2], "a rider two clauses away was paired with the banish");
  const odd = P.fxParse({...pf, name: "Drill Pull Odd", tx: "Banish the top card of your deck. If it's red, sing a sea shanty."});
  assert.ok(!odd.ops.find(o => o[0] === "banTop")[2]);
  assert.equal(odd.clauses[1].st, "skip", "an unreadable payload is reported as read");
  /* the pool's neighbours are unmoved */
  const ss = P.fxParse(H.card("Soul Shackle", 0));
  assert.equal(ss.ops.length, 0, "Soul Shackle's start-of-phase banish became a play effect");
  assert.equal(P.fxParse(H.card("Brutal Assault", 3)).optCost, undefined);
});

/* ---- Pull from Beyond ------------------------------------------- */

const TWIN = () => ({...staged("Pull from Beyond", "pf1", 1), name: "Drill Pull Twin",
  tx: "Opt 2\nBanish the top card of your deck. If it's red, draw a card. Go again"});
const DECK = () => [pool("Brutal Assault", 3, "d1"), pool("Critical Strike", 1, "d2"), pool("Wounding Blow", 2, "d3")];
function pull(card, deck){
  let g = table(H.state({res: 9, ap: 1, hand: [card], deck}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  g = act(g, {t: "play", uid: card.uid, from: "hand"}, 0);
  for(let i = 0; i < 6 && !g.prompt && (g.stack || []).length; i++) g = act(g, {t: "pass"}, g.priority);
  return g;
}

test("Pull from Beyond: the opt is answered FIRST, then the top card is banished and its colour asked", {skip}, () => {
  H.db();
  let g = pull(TWIN(), DECK());
  assert.ok(g.prompt && g.prompt.tag === "opt", "no opt sheet opened");
  assert.deepEqual(names(g.sides[0].banish), [], "the top card was banished before the player arranged it");
  /* keep the order: the blue card stays on top, is banished, and pays nothing */
  let keep = act(g, {t: "promptConfirm"}, 0);
  assert.deepEqual(names(keep.sides[0].banish), ["Brutal Assault"]);
  assert.deepEqual(names(keep.sides[0].hand), [], "a blue card paid the red rider");
  assert.equal(keep.sides[0].deck.length, 2);
  /* send the blue card under: the red one is now on top, is banished, and pays */
  let dig = act(g, {t: "promptSel", i: 0}, 0);
  dig = act(dig, {t: "promptConfirm"}, 0);
  assert.deepEqual(names(dig.sides[0].banish), ["Critical Strike"], "the banish ignored the order the opt chose");
  assert.deepEqual(names(dig.sides[0].hand), ["Wounding Blow"], "the red card did not pay the rider");
  assert.deepEqual(names(dig.sides[0].deck), ["Brutal Assault"]);
  assert.equal(dig.sides[0].ap, 1, "go again was lost");
});

test("Pull from Beyond: an empty deck banishes nothing and pays nothing; the staged card itself banishes", {skip}, () => {
  H.db();
  const empty = pull(TWIN(), []);
  assert.ok(!empty.prompt, "an opt sheet opened on an empty deck");
  assert.deepEqual(names(empty.sides[0].banish), []);
  assert.deepEqual(names(empty.sides[0].hand), []);

  let g = pull(staged("Pull from Beyond", "pf2", 1), [pool("Critical Strike", 1, "d2"), pool("Wounding Blow", 2, "d3")]);
  assert.ok(g.prompt && g.prompt.tag === "opt");
  g = act(g, {t: "promptConfirm"}, 0);
  assert.deepEqual(names(g.sides[0].banish), ["Critical Strike"], "the staged card did not banish the top of the deck");
  assert.equal(g.sides[0].deck.length, 1);
});

/* ---- Embrace Ursur ---------------------------------------------- */

function ursur(other){
  const eu = staged("Embrace Ursur", "eu1", 1);
  let g = table(H.state({res: 9, ap: 1, hand: other ? [eu, other] : [eu]}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  g = act(g, {t: "play", uid: "eu1", from: "hand"}, 0);
  assert.ok(g.pend, "no chain link opened");
  return g;
}
const pay = g => act(act(g, {t: "promptSel", i: 0}, g.prompt.side), {t: "promptConfirm"}, g.prompt.side);

test("Embrace Ursur: each rider asks the BANISHED card, and both can be true", {skip}, () => {
  H.db();
  /* Shadow AND Runeblade: a Runechant and go again */
  let g = ursur(staged("Embrace Ursur", "x1", 2));
  assert.ok(g.prompt && g.prompt.tag === "pick" && g.prompt.side === 0, "the attacker was not offered the banish");
  assert.equal(g.prompt.min, 0, "the banish is not optional");
  assert.equal(g.pend.ga, false);
  let both = pay(g);
  assert.deepEqual(names(both.sides[0].banish), ["Embrace Ursur"]);
  assert.equal(runeN(both.sides[0]), 1);
  assert.equal(both.pend.ga, true, "go again did not reach the link");
  assert.equal(both.sides[1].hp, 20, "the Runechant made by the attack popped on the attack that made it");

  /* Runeblade, not Shadow: the Runechant only */
  const rb = pool("Arcanic Shockwave", 1, "x2");
  assert.ok(rb.ty.includes("Runeblade") && !rb.ty.includes("Shadow"), "the fixture is no longer a non-Shadow Runeblade");
  const rune = pay(ursur(rb));
  assert.equal(runeN(rune.sides[0]), 1);
  assert.equal(rune.pend.ga, false, "a card that is not Shadow gave go again");

  /* Shadow, not Runeblade: go again only */
  const sh = staged("Pull from Beyond", "x3", 1);
  assert.ok(sh.ty.includes("Shadow") && !sh.ty.includes("Runeblade"), "the fixture is no longer a non-Runeblade Shadow");
  const ga = pay(ursur(sh));
  assert.equal(runeN(ga.sides[0]), 0, "a card that is not Runeblade made a Runechant");
  assert.equal(ga.pend.ga, true);

  /* neither: the card is still banished, and nothing else happens */
  const none = pay(ursur(pool("Brutal Assault", 3, "x4")));
  assert.deepEqual(names(none.sides[0].banish), ["Brutal Assault"]);
  assert.equal(runeN(none.sides[0]), 0);
  assert.equal(none.pend.ga, false);
});

test("Embrace Ursur: declining banishes nothing and pays nothing; an empty hand is not asked", {skip}, () => {
  H.db();
  let g = ursur(staged("Embrace Ursur", "x1", 2));
  g = act(g, {t: "promptConfirm"}, 0);
  assert.deepEqual(names(g.sides[0].banish), []);
  assert.deepEqual(names(g.sides[0].hand), ["Embrace Ursur"]);
  assert.equal(runeN(g.sides[0]), 0);
  assert.equal(g.pend.ga, false, "go again without the banish");
  const alone = ursur(null);
  assert.ok(!alone.prompt, "a sheet opened with nothing to banish");
  assert.equal(alone.pend.ga, false);
});

/* ---- Corrupted Crown -------------------------------------------- */

function crown(hand, block){
  const atk = pool("Wounding Blow", 1, "wb1");
  let g = table(H.state({res: 9, ap: 1, hand: [atk]}, {hp: 20, hand, gear: [staged("Corrupted Crown", "cc1")]},
    {actor: 0, turnPlayer: 0, turn: 3}));
  g = act(g, {t: "play", uid: "wb1", from: "hand"}, 0);
  for(let i = 0; i < 6 && g.step !== "defend"; i++) g = act(g, {t: "pass"}, g.priority);
  for(const u of block) g = act(g, {t: "defend", uid: u}, 1);
  for(let i = 0; i < 6 && !g.prompt && g.step === "defend"; i++) g = act(g, {t: "pass"}, g.priority);
  return g;
}

test("Corrupted Crown: banishing a card from hand makes the Crown defend for 1 more", {skip}, () => {
  H.db();
  const cc = staged("Corrupted Crown");
  assert.equal(cc.def, 1, "the fixture's printed defence moved");
  const hand = () => [pool("Critical Strike", 1, "b1")];
  let g = crown(hand(), ["cc1"]);
  assert.ok(g.prompt && g.prompt.tag === "pick" && g.prompt.side === 1, "the defender was not offered the banish");
  assert.equal(g.prompt.min, 0);
  /* paid: 4 power into a wall of 2 */
  let paid = pay(g);
  assert.deepEqual(names(paid.sides[1].banish), ["Critical Strike"]);
  assert.deepEqual(names(paid.sides[1].hand), []);
  for(let i = 0; i < 40 && paid.pend; i++) paid = H.move(paid);
  assert.equal(paid.sides[1].hp, 18, "the banish did not raise the Crown's defence");
  /* declined: 4 power into a wall of 1, and the card stays */
  let no = act(g, {t: "promptConfirm"}, 1);
  assert.deepEqual(names(no.sides[1].banish), []);
  for(let i = 0; i < 40 && no.pend; i++) no = H.move(no);
  assert.equal(no.sides[1].hp, 17, "the Crown defended for more than it prints without the banish");
  assert.deepEqual(names(no.sides[1].hand), ["Critical Strike"]);
});

test("Corrupted Crown: a card declared as a defender is not in the hand to banish", {skip}, () => {
  H.db();
  const g = crown([pool("Brutal Assault", 3, "a1"), pool("Critical Strike", 1, "b1")], ["cc1", "a1"]);
  assert.ok(g.prompt, "no sheet");
  assert.deepEqual(g.prompt.cards.map(c => c.uid), ["b1"], "a blocking card is offered as the banish cost");
  /* with the only hand card blocking there is nothing to pay with */
  const lone = crown([pool("Brutal Assault", 3, "a1")], ["cc1", "a1"]);
  assert.ok(!lone.prompt, "a sheet opened whose only candidate is the blocking card");
  /* and a Crown that is not defending asks nothing */
  const idle = crown([pool("Brutal Assault", 3, "a1"), pool("Critical Strike", 1, "b1")], ["a1"]);
  assert.ok(!idle.prompt, "the Crown asked while it was not defending");
});
