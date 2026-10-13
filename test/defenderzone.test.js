/* ============================================================
   A DECLARED DEFENDER IS NOT IN THE HAND (v5.04)

   Declaring a card from hand as a defender commits it to the combat chain.
   Both boards keep it on `sd.hand` until the damage step only because the
   wall is held as uids into the hand (`blockH`) — a representation, not a
   zone — so every reader of "what could this seat spend from hand" had to
   leave it out, and the pitch paths never did. Driven at the table:

     * Wounding Blow declared, then PITCHED for Absorb in Aether — in the
       pitch zone and in the wall at once, and the block was withdrawn after
       the defend step had closed (CR 7.3.2b says it cannot be);
     * Bravo's The Suspense is Killing Me (an Instant printing 2{d})
       declared, then PLAYED from the wall into the arena.

   `parser.handFree` is the one reader. Five copies of the same filter had
   been hand-rolled where the question had come up before; they ask it now.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const J = require("../engine/judge");
const SP = require("../engine/sparring");
const H = require("./helpers/judged.js");
const E = require("../engine/effects");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* seat 1 attacks with `atk`; seat 0 holds priority in the reaction step,
   with `hand` and `blockH` declared. `actor` 0 is the TRAINER's shape: its
   instant-speed doors resolve with the player as the actor, and
   `playAtSpeed` reads `act(s)`. */
function window(hand, blockH, res, actor){
  const atk = {...H.card("Raging Onslaught", 1), uid: "ATK"};
  return {...H.state({hand, res: res || 0, hp: 20, name: "Def", blockH}, {hand: [], name: "Atk"},
                     {turn: 3, actor: actor == null ? 1 : actor}),
    phase: "action", step: "reaction", turnPlayer: 1, attacker: 1, priority: 0,
    passed: [false, false], firstPlayer: 1, round: 1, over: null, stack: [], chain: [], chainCards: [atk],
    pend: {card: atk, from: "hand", by: 1, total: atk.power, ga: false, ops: [], onHit: []}};
}

test("the READER: a declared defender is not part of the free hand, and neither is the card being paid for", () => {
  const sd = {hand: [{uid: 1, pitch: 1}, {uid: 2, pitch: 3}, {uid: 3, pitch: 2}], blockH: [2]};
  assert.deepEqual(P.handFree(sd).map(c => c.uid), [1, 3]);
  assert.deepEqual(P.handFree(sd, {uid: 3}).map(c => c.uid), [1]);
  assert.equal(P.payCeiling(sd), 3, "the 3-pitch card is defending, so it raises nothing");
  assert.equal(P.payCeiling({hand: sd.hand}), 6, "control: undeclared, every card can pitch");
  assert.equal(P.isDeclaredDefender(sd, 2), true);
  assert.equal(P.isDeclaredDefender(sd, 1), false);
});

test("AT THE TABLE: a play only a declared defender could pay for is refused, not opened", {skip}, () => {
  H.db();
  const blk = {...H.card("Wounding Blow", 1), uid: "BLK"};
  const ab = {...H.card("Absorb in Aether", 1), uid: "AB"};
  assert.ok(ab.cost >= 1 && blk.pitch >= ab.cost, "fixture: the defender alone could pay for it");
  const g = window([blk, ab], ["BLK"]);
  assert.match(String(J.legal(g, {t: "play", uid: "AB", from: "hand"}, 0)), /cannot raise it/,
    "the ceiling no longer counts the wall");
  /* CONTROL: the same hand, nothing declared, opens the payment */
  assert.equal(J.legal(window([blk, ab], []), {t: "play", uid: "AB", from: "hand"}, 0), null);
});

test("AT THE TABLE: inside a payment, the declared defender cannot be selected", {skip}, () => {
  H.db();
  const blk = {...H.card("Wounding Blow", 1), uid: "BLK"};
  const fuel = {...H.card("Wounding Blow", 3), uid: "F3"};
  const ab = {...H.card("Absorb in Aether", 1), uid: "AB"};
  const out = J.reduce(window([blk, fuel, ab], ["BLK"]), {t: "play", uid: "AB", from: "hand"}, 0);
  assert.ok(!out.error, "a free card can pay, so the payment opens: " + out.error);
  assert.equal(out.state.pending && out.state.pending.kind, "pay");
  assert.match(String(J.legal(out.state, {t: "paySel", uid: "BLK"}, 0)),
    /^Wounding Blow is defending — it cannot be pitched$/);
  assert.equal(J.legal(out.state, {t: "paySel", uid: "F3"}, 0), null, "the free card still can");
});

test("AT THE TABLE: a declared Instant is not played from the wall", {skip}, () => {
  H.db();
  const sus = {...H.card("The Suspense is Killing Me", 3), uid: "SUS"};
  assert.ok((sus.ty || []).includes("Instant") && sus.def != null, "fixture: an Instant that prints a defence");
  const g = window([sus], ["SUS"]);
  assert.match(String(J.legal(g, {t: "play", uid: "SUS", from: "hand"}, 0)),
    /^The Suspense is Killing Me is defending this chain link — it cannot also be played$/);
  assert.notEqual(J.reduce(g, {t: "play", uid: "SUS", from: "hand"}, 0).error, undefined, "`reduce` agrees");
  /* CONTROL: undeclared, it is an ordinary instant in the reaction step */
  assert.equal(J.legal(window([sus], []), {t: "play", uid: "SUS", from: "hand"}, 0), null);
});

test("THE TRAINER'S DOORS: `playAtSpeed` refuses the wall, and its on-demand pitch never spends it", {skip}, () => {
  H.db();
  const sus = {...H.card("The Suspense is Killing Me", 3), uid: "SUS"};
  const r = J.withEffects(window([sus], ["SUS"], 0, 0), (fx, n) => fx.playAtSpeed(n, sus, "hand", {window: "defense-reaction"}));
  assert.match(String(r.why), /is defending this chain link/);
  /* THE PITCH: a cost of 1, the declared defender pitches 1 and the free
     card 3. `autoPitch` ranks on advisor value, so without the reader it
     could take either — the drill asserts which it is ALLOWED to take. */
  const blk = {...H.card("Wounding Blow", 1), uid: "BLK"};
  const fuel = {...H.card("Wounding Blow", 3), uid: "F3"};
  const ab = {...H.card("Absorb in Aether", 1), uid: "AB"};
  const paid = J.withEffects(window([blk, fuel, ab], ["BLK"], 0, 0),
    (fx, n) => fx.playAtSpeed(n, ab, "hand", {window: "defense-reaction"}));
  assert.equal(paid.why, null);
  assert.deepEqual(paid.game.sides[0].pitch.map(c => c.uid), ["F3"], "the free card paid");
  assert.ok(paid.game.sides[0].hand.some(c => c.uid === "BLK"), "the defender is still in the wall");
  /* and with ONLY the defender to pitch, the play is refused with nothing moved */
  const none = J.withEffects(window([blk, ab], ["BLK"], 0, 0),
    (fx, n) => fx.playAtSpeed(n, ab, "hand", {window: "defense-reaction"}));
  assert.match(String(none.why), /not enough in hand to pitch/);
  assert.deepEqual(none.game.sides[0].pitch, []);
});

/* ---- THE HAND-ABILITY DOOR (v5.14) ---------------------------------
   "Instant - Discard this: …" spends the card ITSELF. v5.04 asked every
   reader of the FREE hand and missed this door, because it asks about the
   card's own uid: a seat blocked, saw the attack, then discarded its own
   defender for value (Arcane Twining's amp, Agile Windup's Agility,
   Reaper's Call's mark), and the damage step skipped the card that had
   left. GO AGAIN IS AN ACTION POINT and a withdrawn block is DAMAGE, so
   these assert the zones, the wall and the payload, never prose. */
const SELF_COST = ["Agile Windup", "Arcane Twining", "Photon Splicing", "Reaper's Call"];

test("CENSUS: which hand abilities spend the card itself, and which spend another", {skip}, () => {
  /* Pinned both directions: a new pool record printing a hand ability is
     a deliberate edit here, so somebody asks which door it is. */
  const DB = H.db(), byCost = {};
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    const ha = r && P.fxParse(r).handAbility;
    if(ha) (byCost[ha.cost] = byCost[ha.cost] || new Set()).add(r.name);
  }
  assert.deepEqual(Object.keys(byCost).sort(), ["card", "self"]);
  assert.deepEqual([...byCost.self].sort(), SELF_COST);
  assert.deepEqual([...byCost.card], ["Rally the Coast Guard"]);
});

for(const nm of SELF_COST) test("AT THE TABLE: " + nm + " declared as a defender cannot discard itself", {skip}, () => {
  H.db();
  const c = {...H.card(nm, 1), uid: "AW"};
  /* A SECOND, FREE card in hand: with the declared card alone, "is this
     card in the wall" and "is the free hand empty" coincide, and a guard
     asking the wrong one passes (the first sabotage of this drill was
     silent). */
  const spare = {...H.card("Wounding Blow", 3), uid: "SP"};
  const g = window([c, spare], ["AW"]);
  const act = {t: "activate", uid: "AW", from: "hand"};
  assert.equal(J.legal(g, act, 0), nm + " is defending this chain link — discarding it would withdraw the block");
  const out = J.reduce(g, act, 0);
  assert.ok(out.error, "`reduce` agrees with `legal`");
  assert.equal(E.handAbilityOK({...g, actor: 0}, c), false, "and the trainer dims the tile off the same reader");
  /* CONTROL: undeclared, the same card in the same window activates —
     the refusal is about the WALL, not the window or the card. */
  const ok = J.reduce(window([c, spare], []), act, 0);
  assert.equal(ok.error, null, "undeclared, it must activate: " + ok.error);
  assert.deepEqual(ok.state.sides[0].grave.map(x => x.uid), ["AW"], "and it discards itself");
});

test("THE TRAINER'S DOOR: the shared `activateHandAbility` refuses the wall and moves nothing", {skip}, () => {
  H.db();
  const c = {...H.card("Arcane Twining", 1), uid: "AW"};
  const r = J.withEffects(window([c], ["AW"], 0, 0), (fx, n) => fx.activateHandAbility(n, c));
  assert.match(String(r.why), /^Arcane Twining is defending this chain link/);
  const sd = r.game.sides[0];
  assert.deepEqual(sd.hand.map(x => x.uid), ["AW"], "the card is still in the wall");
  assert.deepEqual(sd.grave, []);
  assert.equal(sd.amp || 0, 0, "and the amp did not land");
  /* CONTROL through the same body */
  const go = J.withEffects(window([c], [], 0, 0), (fx, n) => fx.activateHandAbility(n, c));
  assert.equal(go.why, null);
  assert.equal(go.game.sides[0].amp, 1);
});

test("Rally the Coast Guard's \"discard A card\", gated \"while defending\", stays legal from the wall", {skip}, () => {
  /* The positive control the fix must keep: a guard on every declared
     defender's hand ability passes every row above and kills this card. */
  H.db();
  const rally = {...H.card("Rally the Coast Guard", 1), uid: "RC"};
  const spare = {...H.card("Wounding Blow", 1), uid: "SP"};
  assert.equal(J.legal(window([rally, spare], ["RC"]), {t: "activate", uid: "RC", from: "hand"}, 0), null);
  assert.equal(E.handAbilityOK({...window([rally, spare], ["RC"]), actor: 0}, rally), true);
});

test("THE POLICY never proposes pitching a defender — a refusal is always a bug in the policy", () => {
  const sd = {hand: [{uid: 1, pitch: 3, name: "a"}, {uid: 2, pitch: 1, name: "b"}], blockH: [1], paySel: []};
  assert.equal(SP.pitchPick(sd, null, {}).uid, 2, "the 3-pitch card is defending; the 1 is what is free");
  assert.equal(SP.pitchPick({...sd, blockH: [1, 2]}, null, {}), null, "nothing free, nothing proposed");
});

test("CENSUS: no engine module hand-rolls the filter again", () => {
  /* comments stripped, so the reader's own header — which quotes the
     pattern it replaces — does not count against it */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dir = path.join(__dirname, "..", "engine");
  const hits = [];
  for(const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))){
    const src = strip(fs.readFileSync(path.join(dir, f), "utf8"));
    const re = /blockH \|\| \[\]\)\.indexOf\([^)]*\) < 0/g;
    let m; while((m = re.exec(src))) hits.push(f + ": " + src.slice(Math.max(0, m.index - 160), m.index + 40).replace(/\s+/g, " "));
  }
  assert.equal(hits.length, 1, "a second copy of the free-hand filter: \n" + hits.join("\n"));
  assert.match(hits[0], /^parser\.js: .*handFree/, "…and the one copy is the reader");
  /* the stripper's control goes THROUGH the scan (v4.32) */
  const ctrl = "/" + "* (sd.blockH || []).indexOf(c.uid) < 0 *" + "/";
  assert.equal(/blockH \|\| \[\]\)\.indexOf\([^)]*\) < 0/.test(strip(ctrl)), false);
});
