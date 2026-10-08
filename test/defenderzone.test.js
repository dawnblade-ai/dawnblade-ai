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
