/* ============================================================
   BECKONING HAUNT — AN X COST SETTLED BY THE CHOICE (v4.71)

   > "Action - {x}{x}{r}, destroy this: Return target aura with cost X
   >  from your graveyard to your hand."   — Viserai's Arms piece

   HANDOFF called it "the cheapest X card": X is COUPLED to the choice (the
   returned aura's printed cost), which is Blaze's shape (v3.39) — the pick
   settles X and no number is ever asked for. So it is built the way his is:
   the sheet only offers what the seat can pay for, and the answer charges.

   AND READING IT FOUND A FREE X. Handed a payload it could read,
   `parseHeroPower` counted "{x}{x}{r}" as COST 1 — the X pips were simply
   not counted. Latent only because the payload refused; reading the payload
   alone would have shipped the aura back for {r}. The pips are counted now
   and COUPLED: X pips with no pick to settle them refuse, and a pick that
   settles an X nothing prices refuses too.

   WHAT THIS HOLDS:
     - the parse: pips counted, coupled, stamped on every builder
     - "target" is not a class word, and the class vocabulary is closed
     - the legality, on both boards: an aura the seat cannot pay X for is
       not a choice, and an activation with none is refused by name
     - the sheet offers only what is affordable, and the answer charges
       X once per pip, pitching on demand but never the aura it returned
     - an unaffordable answer off a wire is inert, never free (v2.04)
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const LINE = "Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});

/* ---- 1. THE PARSE -------------------------------------------------------- */

test("the X pips are COUNTED, and the fixed part is still the cost", () => {
  const hp = P.parseHeroPower(LINE, true);
  assert.ok(hp, "the line no longer reads");
  assert.equal(hp.x, 2, "two {x} pips — X is paid twice");
  assert.equal(hp.cost, 1, "the {r} is the fixed part, paid on activation");
  assert.equal(hp.sd, true, "and destroy this is still the price");
});

test("X PIPS WITH NOTHING TO SETTLE THEM REFUSE — the free X, closed both ways", () => {
  /* Until v4.71 this line read as cost 1: an X cost with its X dropped. */
  assert.equal(P.parseHeroPower("Action - {x}{x}{r}, destroy this: Draw a card.", true), null,
    "an X cost whose payload settles no X was read — X is FREE there");
  assert.equal(P.parseHeroPower(
    "Action - {r}, destroy this: Return target aura with cost X from your graveyard to your hand.", true), null,
    "a payload that settles an X the cost never prices was read");
});

test("the pick settles X off the chosen card's COST, and 'target' is not a class", () => {
  const r = P.classifyClause("return target aura with cost x from your graveyard to your hand");
  assert.ok(r && r.status === "run", "the payload no longer reads");
  assert.deepEqual(r.ops[0][1].filter, {tt: "aura"}, "the subject is an aura — never a card of class 'target'");
  assert.equal(r.ops[0][1].xOf, "cost", "X is the chosen aura's printed cost");
  assert.equal(r.ops[0][1].min, 1, "\"return target\" is mandatory — no 'you may'");
  const plain = P.classifyClause("return target aura from your graveyard to your hand");
  assert.deepEqual(plain.ops[0][1].filter, {tt: "aura"}, "'target' leaked into the subject");
  assert.equal(plain.ops[0][1].xOf, undefined, "no X printed, no X read");
});

test("the class before '(non-)attack action card' is a CLOSED vocabulary", () => {
  /* v4.09 closed the bare-"card" branch and left this one open: any leading
     word read as a class, so "target" and a pitch colour built filters that
     match nothing. Measured over the pool and the powCards: wizard and
     runeblade, nothing else. */
  assert.deepEqual(P.optFilter("a wizard non-attack action card"), {ty: ["wizard", "action"], type: "nonAttack"});
  assert.ok(P.optFilter("a runeblade attack action card"), "a real class stopped reading");
  assert.equal(P.optFilter("a red attack action card"), null, "a colour read as a class");
  assert.equal(P.optFilter("target attack action card"), null, "'target' read as a class");
});

test("every powCard builder stamps the pips — v3.63's rule, sixth outing", {skip}, () => {
  H.db();
  const g = c("Beckoning Haunt", 0, 41); B.equipPiece(g);
  assert.ok(g.powCard, "no powCard — the equipment route has nothing to offer");
  assert.equal(g.powCard._xPips, 2, "the equipment builder dropped the pips — X would be free");
  assert.equal(g.powCard.cost, 1);
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "build.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((src.match(/_xPips:/g) || []).length, 3,
    "hero, equipment and arena builders must all carry the pips (a builder that drops one ships a free X)");
});

/* ---- 2. DRIVEN AT THE TABLE --------------------------------------------- */

const GRAVE = () => [c("Pyroglyphic Protection", 1, "pp"),      /* cost 2 */
                     c("Waning Vengeance", 1, "wv"),             /* cost 1 */
                     c("Malefic Incantation", 1, "mi")];         /* cost 0 */
function table(res, hand){
  H.db();
  const haunt = c("Beckoning Haunt", 0, 41); B.equipPiece(haunt);
  return {...H.state({res, ap: 1, gear: [haunt], hand: hand || [], grave: GRAVE()}, {hand: []},
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const activate = g => H.drain(J.reduce(g, {t: "activate", uid: 41, from: "gear"}, 0).state);
const offered = n => (n.prompt ? n.prompt.cards : []).map(x => x.name).sort();

test("the sheet offers ONLY what the seat can pay X for, after the fixed {r}", {skip}, () => {
  /* 3 floating: {r} paid, 2 left, X pips 2 — so cost 1 at most. */
  const n = activate(table(3));
  assert.deepEqual(offered(n), ["Malefic Incantation", "Waning Vengeance"],
    "an aura the seat cannot pay X for was offered — the choice would be refused after the cost is paid");
  assert.ok(n.sides[0].gear[0].destroyed, "destroy this is paid on activation");
});

test("the answer RETURNS the aura and CHARGES X per pip", {skip}, () => {
  let n = activate(table(3));
  n = J.reduce(n, {t: "promptSel", i: n.prompt.cards.findIndex(x => x.uid === "wv")}, 0).state;
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.ok(n.sides[0].hand.some(x => x.uid === "wv"), "the aura never came back");
  assert.ok(!n.sides[0].grave.some(x => x.uid === "wv"), "…and is still in the graveyard too");
  assert.equal(n.sides[0].res, 0, "X is 1 and it is paid TWICE: 3 - 1 - 2");
});

test("X is paid by pitching on demand — and NEVER by pitching the aura it returned", {skip}, () => {
  /* 1 floating pays the {r}; two 3-pitch cards cover up to X = 3. The
     returned aura is in the hand by the time X is charged, and pitching it
     would pay for the card with the card. */
  const f1 = c("Raging Onslaught", 3, "f1"), f2 = c("Raging Onslaught", 3, "f2");
  let n = activate(table(1, [f1, f2]));
  assert.deepEqual(offered(n), ["Malefic Incantation", "Pyroglyphic Protection", "Waning Vengeance"]);
  n = J.reduce(n, {t: "promptSel", i: n.prompt.cards.findIndex(x => x.uid === "pp")}, 0).state;
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.ok(n.sides[0].hand.some(x => x.uid === "pp"), "the returned aura was pitched to pay for itself");
  assert.equal(n.sides[0].pitch.length, 2, "X is 2, paid twice: 4 needs both pitch cards");
  assert.equal(n.sides[0].res, 2, "6 pitched, 4 paid, 2 floating");
});

test("THE LEGALITY: nothing affordable refuses by name, before the piece is destroyed", {skip}, () => {
  /* 1 floating pays the {r} and leaves 0 — X = 0 is still affordable, so
     make the only aura cost 2 to leave nothing. */
  const g = table(1);
  g.sides[0].grave = [c("Pyroglyphic Protection", 1, "pp")];
  const why = J.legal(g, {t: "activate", uid: 41, from: "gear"}, 0);
  assert.match(String(why), /cost X/, "an activation with no affordable aura was allowed — paid for nothing");
  /* THE FIXED {r} COMES OFF FIRST. With 4 floating a cost-2 aura needs
     1 + 2×2 = 5, so it is refused; a bound that forgot the {r} reads 4/2 = 2
     and allows it, and the seat then cannot pay X after paying the {r}.
     The first draft of this drill could not tell the two apart (its numbers
     never crossed a multiple of the pip count), and its sabotage came back
     SILENT — v3.62: check that a fixture can express the bug it names. */
  const four = table(4);
  four.sides[0].grave = [c("Pyroglyphic Protection", 1, "pp")];
  assert.match(String(J.legal(four, {t: "activate", uid: 41, from: "gear"}, 0)), /cost X/,
    "the bound forgot the fixed {r} the activation pays first");
  /* CONTROL: the same graveyard with enough to pay is legal. */
  const ok = table(5);
  ok.sides[0].grave = [c("Pyroglyphic Protection", 1, "pp")];
  assert.equal(J.legal(ok, {t: "activate", uid: 41, from: "gear"}, 0), null,
    "the affordable case was refused — a legality that refuses everything is not a check");
});

test("ONE affordable aura is not a choice — it returns on the spot (v4.68)", {skip}, () => {
  const n = activate(table(1));
  assert.ok(!n.prompt, "a forced choice of one opened a sheet");
  assert.ok(n.sides[0].hand.some(x => x.uid === "mi"), "the only affordable aura (X = 0) did not return");
  assert.equal(n.sides[0].res, 0, "X = 0 costs nothing past the {r}");
});

test("an unaffordable answer off a wire is INERT, never free (v2.04)", {skip}, () => {
  /* The sheet cannot offer it; a crafted prompt can. */
  let n = activate(table(3));
  const crafted = {...n.prompt, cards: [...n.prompt.cards, n.sides[0].grave.find(x => x.uid === "pp")]};
  crafted.sel = [crafted.cards.length - 1];
  const out = H.fx(n, (fx, s) => fx.applyAnswer(s, crafted));
  assert.ok(!out.sides[0].hand.some(x => x.uid === "pp"),
    "an aura the seat cannot pay X for was returned — the X was free");
});

/* ---- 3. THE TRAINER ASKS THE SAME BOUNDED READER ------------------------ */

test("the trainer's legality asks `abPickBound`, with the game's half of the cost", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(html, /DawnParser\.abPickBound\(act\(s\), card, costCtx\(s, actorOf\(s\)\)\)/,
    "the trainer's pick legality does not bound X — one board would allow a paid-for-nothing activation");
  const judge = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(judge, /PR\.abPickBound\(sd, ab, ctx\)/, "judge's legality does not bound X");
});
