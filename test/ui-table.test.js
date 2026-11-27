/* CRESCENDO's table model (ui/table.js `model`, no browser): what the seat is shown and may tap, from a real deal,
   read only through DawnView.view and DawnJudge.legal. Taps are checked as the ENGINE's answers: a card is "ready"
   exactly when legal(play) is null, a payment opens as the pay state, the cost meter reads the pitch, the primary names
   the play, and the defend / arsenal steps get their own primaries. */
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const W = require("./helpers/extract").loadData();
const ROOT = path.join(__dirname, "..");
const env = { ...W, DAWN_POOL: require("../data/pool.js") };
Object.entries({ DawnCards: "cards", DawnGame: "game", DawnBuild: "build", DawnJudge: "judge", DawnSparring: "sparring", DawnView: "view", DawnPriority: "priority" })
  .forEach(([k, f]) => { env[k] = require(path.join(ROOT, "engine", f + ".js")); });
const S = require("../ui/session.js"), T = require("../ui/table.js");
const J = env.DawnJudge;

const deal = (hero, foe, seed) => S.deal({ hero, foe, seed, first: 0 }, env).state;
const modelOf = (st, ui) => {
  const me = 0;
  return T.model(env.DawnView.view(st, me), {
    seat: me, holder: J.waitingOn(st), legal: a => J.legal(st, a, me), ui: ui || {},
    defending: env.DawnPriority.canDeclareDefenders(st, me), game: { slotOf: env.DawnGame.slotOf, gearDef: env.DawnGame.gearDef },
    paySum: J.paySum, art: [null, null], name: i => i === me ? "You" : "Foe"
  });
};
const step = (st, a, seat) => { const o = J.reduce(st, a, seat || 0); assert.strictEqual(o.error, null, JSON.stringify(a) + ": " + o.error); return o.state; };

test("at rest: a hand card is ready exactly when the engine would let it be played; one primary says END TURN", () => {
  const st = deal("iyslander", "viserai", "2"), m = modelOf(st);
  assert.strictEqual(m.primary.label, "End turn");
  assert.ok(m.hand.length === 4 && m.hand.every(h => (h.state === "ready") === (J.legal(st, { t: "play", uid: h.card.uid, from: "hand" }, 0) === null)));
  assert.strictEqual(m.stage.pill, "Action phase");
});

test("a selected card lifts and the primary names the play", () => {
  const st = deal("iyslander", "viserai", "2"), c = modelOf(st).hand.find(h => h.state === "ready").card;
  const m = modelOf(st, { sel: { uid: c.uid, from: "hand" } });
  assert.strictEqual(m.primary.label, "Play " + c.name);
  assert.strictEqual(m.hand.filter(h => h.state === "sel").length, 1);
});

test("a payment: the played card is staged, pitched cards leave the hand for the fan, the meter fills, the primary waits then plays", () => {
  let st = deal("iyslander", "viserai", "2");
  const hand = modelOf(st).hand.map(h => h.card), c = hand.find(x => x.name === "Look Tuff"), pitch = hand.find(x => x.pitch >= c.cost);
  st = step(st, { t: "play", uid: c.uid, from: "hand" });
  let m = modelOf(st);
  assert.ok(m.pay && m.staged && m.staged.card.uid === c.uid && m.hit.kind === "cost");
  assert.ok(!m.hand.some(h => h.card.uid === c.uid), "the card being played leaves the hand row");
  assert.match(m.primary.label, /^Pitch \d+ more$/); assert.ok(m.primary.disabled);
  st = step(st, { t: "paySel", uid: pitch.uid });
  m = modelOf(st);
  assert.strictEqual(m.hit.have, pitch.pitch); assert.strictEqual(m.you.coins, pitch.pitch);
  assert.deepStrictEqual(m.you.fan.map(f => f.card.uid), [pitch.uid]);
  assert.ok(!m.hand.some(h => h.card.uid === pitch.uid));
  assert.strictEqual(m.primary.label, "Play " + c.name); assert.deepStrictEqual(m.primary.act, { t: "payConfirm" });
  st = step(st, { t: "payCancel" });
  assert.ok(!modelOf(st).pay, "the cross cancels");
});

test("the opponent's turn: the primary waits and nothing is ready; their hand is a count of backs, never faces", () => {
  let st = deal("iyslander", "viserai", "2");
  st = step(st, { t: "endTurn" });
  for(let i = 0; i < 40 && J.waitingOn(st) === 0 && !st.over; i++){ const a = J.legal(st, { t: "pass" }, 0) === null ? { t: "pass" } : env.DawnSparring.act(st, 0, {}); st = step(st, a); }
  while(!st.over && J.waitingOn(st) === 1){ const a = env.DawnSparring.act(st, 1, {}); if(!a) break; st = step(st, a, 1); if(J.waitingOn(st) === 0) break; }
  const v = env.DawnView.view(st, 0);
  assert.ok(v.sides[1].hand.every(c => c.hidden), "the view hides their hand");
  const m = modelOf(st);
  assert.strictEqual(m.opp.handN, v.sides[1].hand.length);
});

test("permanents group by kind with a count", () => {
  const g = T.permsOf({ board: [{ card: { name: "Runechant" } }, { card: { name: "Runechant" } }, { card: { name: "Sigil" } }] });
  assert.deepStrictEqual(g.map(x => [x.card.name, x.n]), [["Runechant", 2], ["Sigil", 1]]);
});
