/* ============================================================
   THE BOARD AT THE HIT (v5.09)

   "When this hits a MARKED hero, they banish a card from their hand."
   — MARK OF THE BLACK WIDOW ×3 · MARK OF THE FUNNEL WEB ×3, Arakni's

   Found by MEASURING which triggers fire together on one event, which is
   what `simultaneous-trigger-order` asked for. Two Sides to the Blade's
   second mode grants "When this hits a hero, mark them" to a stealth
   attack action card, so one hit sets off TWO triggers: the grant's mark
   and the card's own banish. `linkPayload` ran the granted on-hit first
   and then asked the gate — so the banish found a hero the grant had
   just marked, on a hit that landed on an UNMARKED hero.

   THAT IS NOT AN ORDER, AND NO ORDER FIXES IT. The order of simultaneous
   triggers decides which one RESOLVES first; whether a trigger EXISTS is
   decided at the event. An unmarked hero was hit, so "hits a marked
   hero" never triggered. 3 of 630 ladder games, every one STRONGER than
   printed, and the card read `tier: full` throughout.

   A STATE GATE IS READ OFF THE BOARD AT THE HIT; a `way:` gate still
   waits for the ops it asks about (v3.60), and `test/loot.test.js` holds
   that half. The mark is the only state gate an on-hit trigger in this
   pool can move today, which is why it is the one driven here.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const junk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

/* A REAL PLAY, the REAL grant (Two Sides to the Blade through
   `attackRx`, which picks its stealth mode off the printed targets), and
   a real hit. */
function hit(nm, o){
  P.fxReset();
  const c = Object.assign(H.card(nm, 1), {uid: "atk1"});
  const g = H.state({name: "Alice", hand: [c], res: 9, ap: 1},
                    {name: "Bob", hp: 20, marked: !!o.marked,
                     hand: [junk("Kept", "h1"), junk("Spare", "h2")],
                     arsenal: junk("Set", "a1"), deck: [junk("Top", "t1")]},
                    {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  let out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}),
                             c, "hand", 0, {}));
  assert.ok(out.pend, nm + " opened a link");
  if(o.grant)
    out = H.J.withEffects(out, (fx, s) =>
      fx.attackRx(s, H.card("Two Sides to the Blade", 1), {handBlockers: 0}).game);
  return {before: out, after: unwrap(H.fx(out, (fx, m) => {
    const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
    return r.game || r;
  }))};
}

test("the grant is real: Two Sides to the Blade puts \"mark them\" on the link", {skip}, () => {
  /* The fixture first (v4.09): without the grant on `pend.onHit` the
     unmarked rows below prove nothing. */
  const {before, after} = hit("Mark of the Black Widow", {grant: true});
  assert.deepEqual((before.pend.onHit || []).map(op => op[0]), ["mark"]);
  assert.equal(after.sides[1].marked, true, "and the hit still marks them — the grant is untouched");
});

test("Mark of the Black Widow: an UNMARKED hero hit is not a marked hero hit", {skip}, () => {
  const {after} = hit("Mark of the Black Widow", {grant: true, marked: false});
  assert.deepEqual(after.sides[1].hand.map(c => c.name), ["Kept", "Spare"],
    "the banish fired off a mark the same hit granted");
  assert.deepEqual(after.sides[1].banish, []);
  /* the one feed assertion, and it is about the WORDS: asked of the board
     at the hit, "isn't marked" would be a lie the line above it refutes */
  assert.match(said(after), /condition not met \(Bob wasn't marked when it hit\)/);
});

test("…and a hero marked BEFORE the hit still loses the card (positive control)", {skip}, () => {
  /* A gate that refuses everything passes the row above perfectly (v3.45). */
  for(const grant of [false, true]){
    const {after} = hit("Mark of the Black Widow", {grant, marked: true});
    assert.equal(after.sides[1].hand.length, 1, "marked, grant:" + grant + " — the banish must land");
    assert.equal(after.sides[1].banish.length, 1);
  }
});

test("Mark of the Funnel Web: the same gate on the arsenal half", {skip}, () => {
  const off = hit("Mark of the Funnel Web", {grant: true, marked: false}).after;
  assert.ok(off.sides[1].arsenal, "unmarked at the hit — the arsenal is untouched");
  const on = hit("Mark of the Funnel Web", {grant: true, marked: true}).after;
  assert.equal(on.sides[1].arsenal, null);
  assert.deepEqual(on.sides[1].banish.map(c => c.name), ["Set"]);
});
