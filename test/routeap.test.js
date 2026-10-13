/* ============================================================
   A BOARD ATTACK COSTS AN ACTION POINT, WHATEVER THE CARD IS (v5.15)

   > "During your turn, auras you control with ward are weapons with base
   > {p} equal to their ward and \"Once per Turn Action - {r}: Attack\"."
   > — COSMO, Enigma's · WAXING SPECTER is a Mystic Illusionist INSTANT - Aura

   The trainer's one action-point gate asked `costsAP(card)`, which reads the
   card's OWN type line. An aura's attack is the grant's "Action -" line, and
   `linkPayload` charges every attack link a point when it resolves, so a
   Cosmo-armed Waxing Specter swung at 0 action points and the link left
   `ap: -1` (`NEGATIVE-AP`, CR 4.4.3e; QUEUE N2). The table refused it.

   `parser.routeCostsAP(card, from)` is the one reader: TRUE on the ally and
   aura routes, `costsAP` everywhere else. Both boards ask it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

test("the PREMISE: which board attackers asking the card would miss", {skip}, () => {
  /* Pinned both directions. Every ally is typed Action or Token, so for
     them the card and the route agree today (the ally half of the fix is
     symmetry); the two ward auras are Instants, which is the defect. */
  const DB = H.db(), missed = new Set();
  let allies = 0;
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r) continue;
    const isAuraCard = (r.ty || []).includes("Aura") && P.wardValue(r) > 0;
    const isAllyCard = (r.ty || []).includes("Ally") && P.allyAttack(r);
    if(isAllyCard) allies++;
    if((isAuraCard || isAllyCard) && !P.costsAP(r)) missed.add(r.name);
  }
  assert.ok(allies >= 6, "the scan sees only " + allies + " attacking allies — aimed wrong");
  assert.deepEqual([...missed].sort(), ["Waning Vengeance", "Waxing Specter"]);
});

test("the READER: the ally and aura routes cost a point; every other route asks the card", {skip}, () => {
  const ws = H.card("Waxing Specter", 3);
  assert.equal(P.costsAP(ws), false, "fixture: the card is an Instant");
  assert.equal(P.routeCostsAP(ws, "aura"), true, "its granted attack is an Action");
  assert.equal(P.routeCostsAP(ws, "ally"), true);
  /* CONTROL: off those routes the instant exemption (CR 8.1.6) holds */
  assert.equal(P.routeCostsAP(ws, "hand"), false, "played from hand it is still an instant");
  const atk = H.card("Raging Onslaught", 1);
  assert.equal(P.routeCostsAP(atk, "hand"), true);
});

/* A real Enigma table, Cosmo equipped, a Waxing Specter in the arena. */
function table(ap){
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make("routeap");
  const h0 = W.HEROES.find(x => x.k === "enigma"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.enigma), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  const g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                        heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  assert.ok((g.sides[0].gear || []).some(x => /^Cosmo/.test(x.name)), "fixture: Cosmo is equipped");
  const ws = {...H.card("Waxing Specter", 3), uid: "WS"};
  const sides = g.sides.slice();
  sides[0] = {...sides[0], res: 9, hand: [], ap, board: [...(sides[0].board || []), {uid: "WS", card: ws, kind: "aura"}]};
  return {...g, sides};
}

test("AT THE TABLE: a Cosmo-armed Waxing Specter is refused at 0 points, through the reader", {skip}, () => {
  assert.equal(J.legal(table(0), {t: "activate", uid: "WS"}, 0), "no action point left");
  assert.equal(J.reduce(table(0), {t: "activate", uid: "WS"}, 0).error, "no action point left");
  /* CONTROL: with a point, the same swing is legal */
  assert.equal(J.legal(table(1), {t: "activate", uid: "WS"}, 0), null);
});

test("THE TRAINER: its one action-point gate asks the reader, of the ROUTE, before the board doors", () => {
  /* The trainer's `tryPlay` is a React closure, so this is a SOURCE pin with
     its reach stated: the driven rows above prove what the reader answers,
     and this proves the trainer asks it with the route. A gate asking the
     card alone is the bug coming back. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const body = html.slice(html.indexOf("const tryPlay = (card,from,idx,half)"),
                          html.indexOf("const confirmPay = () => setG"));
  const gate = body.indexOf("DawnParser.routeCostsAP(card, from) && act(s).ap<1");
  assert.ok(gate > 0, "the trainer's action-point gate must ask `routeCostsAP` with the route");
  assert.ok(gate < body.indexOf('if(from==="ally"){') && gate < body.indexOf('if(from==="aura"){'),
    "and it must sit above the ally and aura doors, or they are reached first");
  assert.doesNotMatch(body, /[^.\w]costsAP\(card\)\s*&&\s*act\(s\)\.ap/,
    "a gate asking the card's own type line is back");
});
