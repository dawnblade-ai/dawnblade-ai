/* ============================================================
   A DISCARD WITH NO RANDOMNESS IS THE DISCARDER'S CHOICE (v4.81)

   "Discard a card" prints no randomness, so WHICH card is a decision — and
   it belongs to whoever discards: the player for their own card's text,
   the OPPONENT for "they discard a card". The engine made it for them on
   both boards, taking the back of the hand, so every card that pays out on
   the card discarded paid out by accident:

     Portside Exchange     a Gold token only if the discard was YELLOW
     Jittery Bones,        go again / +2{d} only if it has WATERY GRAVE
     Washed Up Wave
     Gravy Bones           "draw a card, then discard a card" — how he puts
                           an ally in the graveyard to replay
     Loot the Hold, Short Shrift, Pummel, Winter's Bite, Aether Icevein
                           the OPPONENT picks which card they lose

   A hand no bigger than the discard is no choice, and keeps its immediate
   path. Everything printed after the discard rides on the sheet as its
   continuation, and runs back at the seat whose card asked for it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;
const PM = require("../engine/prompts.js");
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");
const mk = (n, p, u) => Object.assign({}, H.card(n, p), {uid: u});
const vanilla = (u, pitch, name) => ({uid: u, name: name || "Probe " + u, pitch: pitch || 1, power: 3, def: 2,
  cost: 0, tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

function table(mine, theirs, seed){
  const g = H.state(Object.assign({name: "Gravy Bones", res: 9, ap: 1}, mine),
                    Object.assign({name: "Them", hp: 20, hand: [], deck: [{uid: "t1", name: "T"}]}, theirs),
                    {actor: 0, turnPlayer: 0, turn: 3, seed: seed || "cd"});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const choose = (n, uid) => {
  assert.ok(n.prompt && n.prompt.discard, "the discard sheet did not open");
  const i = (n.prompt.cards || []).findIndex(c => c.uid === uid);
  assert.ok(i >= 0, uid + " is not offered");
  const seat = n.prompt.side;
  n = J.reduce(n, {t: "promptSel", i}, seat).state;
  return J.reduce(n, {t: "promptConfirm"}, seat).state;
};
const golds = sd => (sd.board || []).filter(b => b && b.card && /gold/i.test(b.card.name)).length;

/* ---- 1. THE CHOICE IS THE CARD --------------------------------------- */

test("DRIVEN: Portside Exchange asks which card, and the answer decides the Gold", {skip}, () => {
  H.db();
  const play = pick => {
    let n = table({hand: [mk("Portside Exchange", 1, "px"), vanilla("red", 1), vanilla("yel", 2)],
                   deck: [vanilla("d1", 3)]});
    n = H.drain(J.reduce(n, {t: "play", uid: "px", from: "hand"}, 0).state);
    assert.equal(n.prompt && n.prompt.side, 0, "the sheet is the player's");
    assert.deepEqual(n.prompt.cards.map(c => c.uid), ["red", "yel"], "the whole hand is offered");
    assert.equal(n.prompt.min, 1);
    assert.ok(!n.sides[0].hand.some(c => c.uid === "d1"),
      "\"…THEN draw a card\" waits for the discard — or the drawn card could be the one thrown away");
    return choose(n, pick);
  };
  const y = play("yel"), r = play("red");
  assert.equal(golds(y.sides[0]), 1, "the yellow earns the Gold");
  assert.equal(golds(r.sides[0]), 0, "the red, from the SAME hand, does not — so the choice is real");
  assert.ok(y.sides[0].hand.some(c => c.uid === "d1") && y.sides[0].hand.some(c => c.uid === "red"),
    "and the draw happens after, with the other card kept");
  const g = y.sides[0].grave.find(c => c.uid === "yel");
  assert.ok(g && g._gy === 3 && g._disc, "the discard is filed as a DISCARD, turn-stamped (gyDisc)");
  assert.deepEqual(INV.errors(y), []);
});

test("DRIVEN: a hand no bigger than the discard is not a choice — no sheet", {skip}, () => {
  H.db();
  let n = table({hand: [mk("Portside Exchange", 1, "px"), vanilla("yel", 2)], deck: [vanilla("d1", 3)]});
  n = H.drain(J.reduce(n, {t: "play", uid: "px", from: "hand"}, 0).state);
  assert.ok(!n.prompt, "one card to discard one: nothing to decide (v3.55)");
  assert.ok(n.sides[0].grave.some(c => c.uid === "yel"));
  assert.equal(golds(n.sides[0]), 1, "and the payoff still reads it");
});

/* ---- 2. "THEY DISCARD A CARD" IS THEIRS ------------------------------ */

test("DRIVEN: \"they discard\" is asked of THEM, and what follows runs back at the asker", {skip}, () => {
  H.db();
  let n = table({hand: [], deck: [vanilla("d1", 3)]}, {hand: [vanilla("a", 1), vanilla("b", 3)]});
  n = H.runOps(n, [["foeDiscard", 1], ["draw", 1]], "Probe Loot");
  assert.ok(!n.prompt, "runOps only queues");
  n = J.openPrompt(n);
  assert.equal(n.prompt && n.prompt.side, 1, "the sheet is addressed to the OPPONENT");
  assert.ok(J.legal(n, {t: "promptSel", i: 0}, 0), "and the player cannot answer it for them");
  n = choose(n, "a");
  assert.ok(n.sides[1].grave.some(c => c.uid === "a" && c._disc), "they lose the card THEY chose");
  assert.ok(n.sides[1].hand.some(c => c.uid === "b"), "and keep the other");
  assert.equal(n.sides[0].hand.length, 1, "the continuation drew for the ASKER (seat 0)");
  assert.equal(n.sides[1].hand.length, 1, "not for the seat that discarded");
});

test("DRIVEN: Loot the Hold's \"if they do\" waits on their choice — and still pays", {skip}, () => {
  /* The granted on-hit ability: "they discard a card. If they do, create a
     Gold token." The gate reads what was TAKEN, which is only known once
     they choose. Driven at the link, where the grant resolves. */
  H.db();
  const hit = foeHand => {
    const atk = vanilla("atk", 1, "Probe Pirate");
    let n = table({hand: []}, {hand: foeHand});
    n = J.withEffects(n, (fx, s) => {
      s = Object.assign({}, s, {chain: [], stack: [], pend: {card: atk, from: "hand", total: 3, by: 0,
        ops: [], onHit: [], onHitHero: [["foeDiscard", 1]], ga: false, lateConds: [],
        condOnHit: [{cond: "way:took", op: ["token", "Gold", 1, "self"], heroOnly: true}]}});
      const r = fx.linkPayload(s, {total: 3, pumps: 0, heroHit: true});
      return r.game || r;
    });
    return n;
  };
  let n = hit([vanilla("a", 1), vanilla("b", 3)]);
  assert.equal(golds(n.sides[0]), 0, "no Gold before they have discarded anything");
  n = choose(J.openPrompt(n), "b");
  assert.equal(golds(n.sides[0]), 1, "they discarded, so the Gold is paid — to the ASKER");
  assert.equal(golds(hit([vanilla("a", 1)]).sides[0]), 1, "one card: no choice, and it still pays");
  assert.equal(golds(hit([]).sides[0]), 0, "an empty hand takes nothing — the control");
});

/* ---- 3. A MODAL COST'S RIDER READS THE CARD CHOSEN ------------------- */

test("DRIVEN: Jittery Bones' go again depends on WHICH card the discard mode spends", {skip}, () => {
  H.db();
  const run = pick => {
    let n = table({hand: [mk("Jittery Bones", 1, "jb"), mk("Barnacle", 1, "bar"), vanilla("plain", 1)],
                   deck: [vanilla("d1", 1)]}, {hp: 30});
    n = J.reduce(n, {t: "play", uid: "jb", from: "hand"}, 0).state;
    for(let i = 0; i < 6 && !n.prompt && n.priority != null; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
    assert.equal(n.prompt && n.prompt.src, "Jittery Bones");
    n = J.reduce(n, {t: "promptChoose", choice: 0}, 0).state;   /* the DISCARD mode */
    n = J.reduce(n, {t: "promptConfirm"}, 0).state;
    n = choose(n, pick);
    for(let i = 0; i < 16 && n.pend && n.step !== "resolution"; i++){
      if(n.priority == null) break;
      const r = J.reduce(n, {t: "pass"}, n.priority); if(r.error) break; n = r.state;
    }
    return n;
  };
  assert.equal(run("bar").sides[0].ap, 1, "Barnacle has watery grave: go again (CR 5.3.5)");
  assert.equal(run("plain").sides[0].ap, 0, "the plain card, from the same hand, earns nothing");
});

/* ---- 4. GRAVY BONES' OWN ABILITY ------------------------------------- */

test("DRIVEN: Gravy Bones draws, THEN chooses — the drawn card is among the choices", {skip}, () => {
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const B = require("../engine/build.js");
  const G = require("../engine/game.js");
  const RNG = require("../engine/rng.js");
  const bd = B.buildSide(W.HEROES.find(h => h.k === "gravy"), G.parseDeck(W.DECKS.gravy), H.db(), {},
                         RNG.make("cd-gravy"), {n: 0}).b;
  const gold = Object.assign({}, H.card("Gold", 0), {uid: "tokG"});
  let n = H.state({name: "Gravy Bones", res: 9, ap: 1, hand: [vanilla("h1", 1)],
                   deck: [mk("Barnacle", 1, "top")],
                   board: [{uid: "tokG", kind: "item", spent: false, card: gold}]},
                  {name: "Them", hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}], seed: "cd-g"});
  n = Object.assign(n, {phase: "action", step: "layer", priority: 0, passed: []});
  const r = J.reduce(n, {t: "activate", from: "hero", uid: "hpow"}, 0);
  assert.equal(r.error, null, r.error);
  n = r.state;
  assert.deepEqual((n.prompt && n.prompt.cards || []).map(c => c.uid).sort(), ["h1", "top"],
    "the card he just drew is offered — the draw came first");
  n = choose(n, "top");
  assert.ok(n.sides[0].grave.some(c => c.uid === "top"), "he discards the ally he drew");
  assert.ok(n.sides[0].hand.some(c => c.uid === "h1"), "and keeps the card he had");
});

/* ---- 5. WHO ANSWERS FOR A SEAT WITH NOBODY IN IT --------------------- */

test("the seat policy answers a discard the old way — the back of the hand", () => {
  const p = {tag: "pick", side: 1, cards: [{uid: 1}, {uid: 2}, {uid: 3}], sel: [], min: 1, max: 1,
             discard: {by: 0, self: false, rest: [], conds: []}};
  assert.deepEqual(PM.promptDiscardDefault(p), [2]);
  assert.deepEqual(PM.promptDiscardDefault({...p, min: 2}), [1, 2]);
  assert.deepEqual(J.autoAnswer({prompt: p, sides: [{}, {hand: []}]}), {t: "promptSel", i: 2},
    "judge's seat policy asks the same body");
  assert.deepEqual(J.autoAnswer({prompt: {...p, sel: [2]}, sides: [{}, {hand: []}]}), {t: "promptConfirm"});
});

test("the trainer's dummy answers its own discard, through the one applyAnswer", () => {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const a = src.indexOf("  function openPrompt(s){");
  const body = src.slice(a, src.indexOf("\n  function foeAnswerPay", a));
  assert.ok(/if\(live\.side === 1 && live\.tag === "pick" && live\.discard\)\s*return _EFX\.applyAnswer\(\{\.\.\.s, promptQ:rest\}, \{\.\.\.live, sel: promptDiscardDefault\(live\)\}\);/.test(body),
    "a pick addressed to the dummy would otherwise be answered by the PLAYER");
});

/* ---- 6. THE IMMEDIATE PATH NOW FILES A DISCARD AS ONE ---------------- */

test("a forced \"they discard\" is stamped as a discard — the old path never was", {skip}, () => {
  /* `foeDiscard` put the card in the graveyard with no `_gy` and no `_disc`,
     so a card the opponent made you discard never counted as "discarded this
     turn". A new path into a graveyard must stamp the turn (v3.62). */
  H.db();
  const n = H.runOps(table({}, {hand: [vanilla("only", 1)]}), [["foeDiscard", 1]], "Probe");
  const c = n.sides[1].grave.find(x => x.uid === "only");
  assert.ok(c && c._gy === 3 && c._disc, "stamped with the turn, and as a discard");
});

/* ---- 7. AN OPTIONAL DISCARD COST IS A DISCARD TOO -------------------- */

test("DRIVEN: Golden Tipple's \"you may discard a yellow card\" files a DISCARD", {skip}, () => {
  /* The optional cost was always a pick — the player chose — but `moveCards`
     put the card in the graveyard with no `_gy` and no `_disc`, so it never
     read as "discarded this turn" and never reached the shared discard
     event. Same marker, nothing to continue. */
  H.db();
  let n = table({hand: [mk("Golden Tipple", 1, "gt"), vanilla("yel", 2), vanilla("red", 1)],
                 deck: [vanilla("d1", 3)]}, {hp: 30});
  n = J.reduce(n, {t: "play", uid: "gt", from: "hand"}, 0).state;
  for(let i = 0; i < 6 && !n.prompt && n.priority != null; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.equal(n.prompt && n.prompt.src, "Golden Tipple", "the optional cost was not offered");
  assert.equal(n.prompt.min, 0, "…and it is optional");
  n = choose(n, "yel");
  const c = n.sides[0].grave.find(x => x.uid === "yel");
  assert.ok(c && c._gy === 3 && c._disc, "the yellow is filed as a discard, turn-stamped");
  assert.ok(n.sides[0].hand.some(x => x.uid === "d1"), "and the \"if you do\" rider paid — it drew");
});
