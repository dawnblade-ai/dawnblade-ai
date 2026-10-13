/* ============================================================
   A TOKEN THAT LEAVES THE ARENA CEASES TO EXIST (v5.16)

   QUEUE item 3, CEO-verified and re-verified here. At the end of Enigma v
   Lyath (seed s3, Lyath first) Lyath's graveyard held twelve Might tokens,
   and Pass Over then offered one as a legal banish. Five sites in this
   engine had said "a token that leaves the arena ceases to exist" since
   v2.23 (the Runechant pop, the trigger pop, Frostbite's shatter); the
   writers a tracer found over 630 ladder games had not asked:

     sweepArena      the start-of-turn and end-phase clocks (Might, Vigor,
                     Agility, Confidence, Embodiment of Earth, Bloodrot Pox,
                     Frailty)
     the context gy  a ward permanent spending itself (Spectral Shield),
                     Gravy Bones' destroy-a-Gold cost, the Robe's Runechant
     tickSuspense, sweepGear, damageAlly, prompts.moveCards

   `parser.ceasesToExist(card, to)` is the one reader: a token, bound for
   any zone outside the arena; an ephemeral card, bound for a graveyard.
   And `invariants.js` names a token anywhere else, so a writer nobody
   remembered is caught in every self-play game rather than trusted.

   ASSERT ON ZONES, NEVER ON THE FEED (v2.45).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const B = require("../engine/build.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const plain = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

test("the READER: a token ceases outside the arena; an ephemeral card only on the way to a graveyard", {skip}, () => {
  const might = H.card("Might", 0), tiger = H.card("Crouching Tiger", 0), card = plain("Plain", "p");
  assert.equal(P.isToken(might), true);
  assert.equal(P.isToken(tiger), false, "Crouching Tiger is a real card that is ephemeral, not a token");
  for(const to of ["grave", "banish", "hand", "deck", "soul", "pitch", "arsenal"])
    assert.equal(P.ceasesToExist(might, to), true, "a token bound for the " + to);
  for(const to of ["board", "gear"])
    assert.equal(P.ceasesToExist(might, to), false, "the " + to + " is the arena");
  assert.equal(P.ceasesToExist(might), true, "the default destination is the graveyard");
  assert.equal(P.ceasesToExist(tiger, "grave"), true, "ephemeral: instead of the graveyard");
  assert.equal(P.ceasesToExist(tiger, "hand"), false, "…and only the graveyard");
  for(const to of ["grave", "banish", "hand"]) assert.equal(P.ceasesToExist(card, to), false);
});

test("CENSUS: the structured array and the printed line agree on which pool records are tokens", {skip}, () => {
  /* `isToken` reads `ty` (v2.44) and falls back to the front of `tt`; over
     the pinned pool the two readings must name the same records, or the
     fallback is answering a different question. */
  const DB = H.db(), byTy = new Set(), byTt = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r) continue;
    if(P.isToken(r)) byTy.add(r.name);
    if(P.isToken({...r, ty: null})) byTt.add(r.name);
  }
  assert.ok(byTy.size >= 15, "the scan sees only " + byTy.size + " tokens — aimed wrong");
  assert.deepEqual([...byTy].sort(), [...byTt].sort());
  assert.ok(byTy.has("Might") && byTy.has("Gold") && byTy.has("Graphene Chelicera"));
});

test("WRITER sweepArena: a crumbling token is filed nowhere; a crumbling card is filed", {skip}, () => {
  const might = {...H.card("Might", 0), uid: "m1"};
  const aura = {name: "Plain Aura", uid: "a1", pitch: 1, tt: "Generic Action - Aura",
                ty: ["Generic", "Action", "Aura"], tx: "", kw: []};
  const g = H.state({board: [{card: might, kind: "token", spent: false, uid: "m1", sd: "turn"},
                             {card: aura, kind: "aura", spent: false, uid: "a1", sd: "turn"}]}, {}, {turn: 4});
  const out = E.sweepArena(g, 0, "turn").game;
  assert.deepEqual(out.sides[0].board, [], "both left the arena");
  assert.deepEqual(out.sides[0].grave.map(c => c.uid), ["a1"], "only the card that is not a token is filed");
  assert.deepEqual(INV.errors(out), []);
});

test("WRITER tickSuspense: a token that runs out of suspense is filed nowhere", {skip}, () => {
  const might = {...H.card("Might", 0), uid: "m1"};
  const card = {...plain("Suspended", "s1"), tt: "Generic Action - Aura", ty: ["Generic", "Action", "Aura"]};
  const g = H.state({board: [{card: might, kind: "token", uid: "m1", susp: 1},
                             {card, kind: "aura", uid: "s1", susp: 1}]}, {}, {turn: 4});
  const out = E.tickSuspense(g, 0).game;
  assert.deepEqual(out.sides[0].board, []);
  assert.deepEqual(out.sides[0].grave.map(c => c.uid), ["s1"]);
});

test("WRITER sweepGear: a destroyed Graphene Chelicera token ceases to exist", {skip}, () => {
  const dag = {...H.card("Graphene Chelicera", 0), uid: "gc", destroyed: true};
  const iron = {name: "Iron Boots", uid: "ib", tt: "Generic Equipment - Legs", ty: ["Generic", "Equipment", "Legs"],
                def: 1, destroyed: true, tx: "", kw: []};
  const g = H.state({gear: [dag, iron]}, {}, {turn: 4});
  const out = E.sweepGear(g, 0);
  assert.deepEqual(out.game.sides[0].gear, []);
  assert.deepEqual(out.game.sides[0].grave.map(c => c.uid), ["ib"], "the equipment is filed, the token is not");
  assert.match(out.msgs.join(" | "), /Graphene Chelicera is destroyed — a token, it ceases to exist/,
    "the feed says where it went (the one prose assertion: the state cannot show a card in NO zone)");
  /* AND BANISHED: the sweep's other destination (v3.79) asks the reader too */
  const gone = {...dag, destroyed: true, _banished: true};
  const out2 = E.sweepGear(H.state({gear: [gone]}, {}, {turn: 4}), 0).game;
  assert.deepEqual(out2.sides[0].banish, [], "a banished token is filed nowhere either");
});

test("WRITER damageAlly: the corpse of a token ally is filed nowhere when the caller says so", () => {
  const tok = {name: "Token Ally", uid: "t1", life: 2, tt: "Generic Token - Ally", ty: ["Generic", "Token", "Ally"]};
  const g = {sides: [{board: [], grave: []}, {board: [{card: tok, kind: "ally", uid: "t1", life: 2}], grave: []}]};
  const asked = G.damageAlly(g, 1, "t1", 9, {ceases: c => P.ceasesToExist(c)});
  assert.ok(asked.killed, "fixture: the ally died");
  assert.deepEqual(asked.game.sides[1].grave, [], "a token ally's corpse ceases to exist");
  /* the module reads no card types, so a caller that says nothing files it
     — and the invariant below is what names that */
  assert.equal(G.damageAlly(g, 1, "t1", 9).game.sides[1].grave.length, 1);
});

test("…and judge hands `damageAlly` the reader, driven through an attack at a token ally", {skip}, () => {
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make("tokenally");
  const h0 = W.HEROES.find(h => h.k === "kayo"), h1 = W.HEROES.find(h => h.k === "gravy");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.gravy), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const seat = g.turnPlayer, def = 1 - seat;
  /* a real Gravy ally, made a TOKEN — the pool's token allies (the Demon
     tokens, Cintari Sellsword) have no creator in a precon */
  const real = g.sides[def].deck.find(c => (c.ty || []).includes("Ally") && (c.life || 0) >= 2);
  const ally = {...real, ty: [...real.ty, "Token"], tt: "Pirate Token - Ally"};
  /* an attack with no printed play gate that kills it outright */
  const fits = c => P.isAttack(c) && !P.fxParse(c).playIf && (c.power || 0) >= ally.life;
  const atk = g.sides[seat].hand.find(fits) || g.sides[seat].deck.find(fits);
  assert.ok(atk, "fixture: an attack that kills the ally");
  g = J.put(g, def, s => ({...s, board: [{card: ally, kind: "ally", spent: false, uid: ally.uid, life: ally.life}],
                                deck: s.deck.filter(c => c.uid !== real.uid)}));
  g = J.put(g, seat, s => ({...s, res: 9, hand: [atk, ...s.hand.filter(c => c.uid !== atk.uid)],
                                 deck: s.deck.filter(c => c.uid !== atk.uid)}));
  const played = J.reduce(g, {t: "play", uid: atk.uid, from: "hand", target: ally.uid}, seat);
  assert.equal(played.error, null, "the attack must be playable: " + played.error);
  let n = H.answerAll(H.drain(played.state));
  for(let i = 0; i < 12 && n.step !== "resolution"; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.deepEqual(n.sides[def].board, [], "the token ally died");
  assert.equal(n.sides[def].grave.some(c => c.uid === ally.uid), false, "…and ceased to exist");
  assert.deepEqual(INV.errors(n), []);
});

test("THE TRAINER's graveyard funnel asks the same reader", () => {
  /* `gy` is a closure inside `Battle`, so this is a source pin with its
     reach stated; every driven row above goes through judge's twin. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const gy = html.slice(html.indexOf("const gy = (turn, ...cards) => cards"), html.indexOf("const gyDisc = "));
  assert.match(gy, /\.filter\(c => !DawnParser\.ceasesToExist\(c\)\)/);
  assert.doesNotMatch(gy, /isEphemeral/, "the ephemeral half alone is the bug coming back");
});

test("THE GUARD: a token outside the arena is an error, in every zone but the board and the gear", {skip}, () => {
  const might = {...H.card("Might", 0), uid: "m9"};
  for(const z of ["grave", "banish", "hand", "deck", "soul", "pitch"]){
    const g = H.state({[z]: [might]}, {}, {});
    assert.ok(INV.errors(g).some(v => v.code === "TOKEN-OUT-OF-ARENA"), "a token in the " + z);
  }
  assert.ok(INV.errors(H.state({arsenal: might}, {}, {})).some(v => v.code === "TOKEN-OUT-OF-ARENA"), "the arsenal");
  assert.ok(INV.errors({...H.state({}, {}, {}), chainCards: [might]}).some(v => v.code === "TOKEN-OUT-OF-ARENA"),
    "the combat chain");
  /* CONTROL: in the arena it is a token doing what tokens do */
  const ok = H.state({board: [{card: might, kind: "token", uid: "m9"}],
                      gear: [{...H.card("Graphene Chelicera", 0), uid: "gc"}]}, {}, {});
  assert.deepEqual(INV.errors(ok).filter(v => v.code === "TOKEN-OUT-OF-ARENA"), []);
  /* and a real card in a graveyard is a graveyard */
  assert.deepEqual(INV.errors(H.state({grave: [plain("Plain", "p")]}, {}, {})), []);
});

test("THE QUEUE'S OWN REPRO: Enigma v Lyath, s3 — no Might in any graveyard, no violation", {skip}, () => {
  const SP = require("../tools/selfplay.js");
  const r = SP.play(SP.match("enigma", "lyath", "s3", 1));
  for(const i of [0, 1])
    for(const z of ["grave", "banish"])
      assert.deepEqual(r.game.sides[i][z].filter(c => P.isToken(c)).map(c => c.name), [],
        "seat " + i + "'s " + z + " holds a token");
  assert.deepEqual(r.viols.filter(v => v.code === "TOKEN-OUT-OF-ARENA"), []);
});
