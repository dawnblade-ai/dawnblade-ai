/* ============================================================
   gochain.test.js — SEQUENCE THE GO-AGAIN CHAIN (v5.38)

   QUEUE v4 H4. `sparring.offence` ranked attacks on printed power alone,
   so a go-again attack (Golden Tipple, Saltwater Swell) sat behind a
   bigger attack or an ally deploy that spent the action point and was
   stranded; and H2's "go-again non-attack first" step played a pure
   next-attack grant (Avast Ye!, Flying High) with no attack left to take
   it. Two rules, both asked through judge so `sparring.js` still reads no
   card text:

     the attack that keeps the action point goes first —
       `judge.keepsActionPoint`, now ONE reader for every play (v3.61);
     a pure grant waits until an attack its qualifier admits is legal and
       payable without the grant card — `judge.grantTakers`.

   AND THE READER HAD A LATENT FALSE POSITIVE, pinned here: an ally card in
   HAND answered TRUE, because `fx.ga` carries the go again printed on its
   ATTACK line while `execute` grants the DEPLOY nothing (`abilityGa`).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
let _uid = 96000;
const card = (n, p) => { const c = H.card(n, p); c.uid = ++_uid; return c; };

function seat0(o){
  H.db();
  let g = H.state(Object.assign({res: 0, ap: 1, hand: []}, o), {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return g;
}
const onBoard = c => ({card: c, kind: "ally", uid: ++_uid, spent: false, life: +c.life || 3});

/* ---- 1. THE READER ------------------------------------------------------- */

test("an attack's own unconditional go again keeps the point; a bigger one without does not", {skip}, () => {
  const tip = card("Golden Tipple", 1), big = card("Brutal Assault", 1);
  const g = seat0({hand: [tip, big]});
  assert.equal(J.keepsActionPoint(g, 0, tip.uid, "hand"), true, "Golden Tipple prints Go again");
  assert.equal(J.keepsActionPoint(g, 0, big.uid, "hand"), false);
});

test("an ALLY deploy does not keep the point — its go again is its attack line's", {skip}, () => {
  /* The latent false positive: `fx.ga` read off Limpit is the ATTACK line's
     keyword, and the deploy that puts it in the arena is granted nothing. */
  const lim = card("Limpit, Hop-a-long", 1), cut = card("Cutty Shark, Quick Clip", 1);
  const g = seat0({hand: [lim, cut], res: 9});
  assert.equal(J.keepsActionPoint(g, 0, lim.uid, "hand"), false, "Limpit in hand");
  assert.equal(J.keepsActionPoint(g, 0, cut.uid, "hand"), false, "Cutty Shark in hand");
  /* …and it is the ENGINE's answer too: the deploy spends the point. */
  const n = J.reduce(g, {t: "play", uid: lim.uid, from: "hand"}, 0);
  assert.ok(!n.error, n.error);
  assert.equal(H.drain(n.state).sides[0].ap, 0, "the deploy took the action point");
});

test("a board ally whose ATTACK line prints go again keeps it; one that prints none does not", {skip}, () => {
  const lim = onBoard(card("Limpit, Hop-a-long", 1)), bar = onBoard(card("Barnacle", 1));
  const g = seat0({board: [lim, bar], res: 9});
  assert.equal(J.keepsActionPoint(g, 0, lim.uid, "board"), true);
  assert.equal(J.keepsActionPoint(g, 0, bar.uid, "board"), false);
});

test("a waiting bare gaNext keeps an ATTACK's point and not a non-attack's", {skip}, () => {
  const big = card("Brutal Assault", 1);
  const g = seat0({hand: [big], gaNext: true});
  assert.equal(J.keepsActionPoint(g, 0, big.uid, "hand"), true, "the next attack takes it");
  /* A bare gaNext is taken by the next ATTACK (execute's attacking branch),
     never by a non-attack. SYNTHETIC, because nearly every pool non-attack
     prints its own Go again (Flying High does), which answers TRUE for a
     different reason and could not see a reader that forgot the gate. */
  const plain = {uid: ++_uid, name: "Plain Non-Attack Probe " + _uid, pitch: 1, cost: 0, def: 2,
    tt: "Generic Action", ty: ["Generic", "Action"], kw: [], tx: "Gain 1{h}."};
  const gp = seat0({hand: [plain], gaNext: true});
  assert.equal(J.keepsActionPoint(gp, 0, plain.uid, "hand"), false, "a non-attack does not take a bare gaNext");
  const g2 = seat0({hand: [big]});
  assert.equal(J.keepsActionPoint(g2, 0, big.uid, "hand"), false, "control: no grant, no");
});

test("a gaNextQ entry keeps the point only for an attack its qualifier admits", {skip}, () => {
  const bar = onBoard(card("Barnacle", 1)), big = card("Brutal Assault", 1);
  const q = {g: [["pirate", "ally"]], atk: true};
  const g = seat0({hand: [big], board: [bar], res: 9, gaNextQ: [{q}]});
  assert.equal(J.keepsActionPoint(g, 0, bar.uid, "board"), true, "a Pirate ally attack matches");
  assert.equal(J.keepsActionPoint(g, 0, big.uid, "hand"), false, "a Generic attack misses");
});

test("a CONDITIONAL go again is not counted", {skip}, () => {
  const ss = card("Second Strike", 1);
  assert.equal(J.keepsActionPoint(seat0({hand: [ss]}), 0, ss.uid, "hand"), false);
});

/* ---- 2. grantTakers -------------------------------------------------------- */

test("grantTakers is null for a card that prints anything besides a grant", {skip}, () => {
  const sw = card("Saltwater Swell", 1), tip = card("Golden Tipple", 1);
  const g = seat0({hand: [sw, tip]});
  assert.equal(J.grantTakers(g, 0, sw.uid, "hand"), null, "a reveal is not a grant");
  assert.equal(J.grantTakers(g, 0, tip.uid, "hand"), null, "no ops at all");
});

test("grantTakers respects the qualifier: a Pirate-ally grant with only a Generic attack lists nothing", {skip}, () => {
  const av = card("Avast Ye!", 3), big = card("Brutal Assault", 1);
  const g = seat0({hand: [av, big], res: 9});
  assert.deepEqual(J.grantTakers(g, 0, av.uid, "hand"), []);
  const bar = onBoard(card("Barnacle", 1));
  const g2 = seat0({hand: [av, big], board: [bar], res: 9});
  assert.deepEqual(J.grantTakers(g2, 0, av.uid, "hand").map(t => t.uid), [bar.uid],
    "the Pirate ally on the board is the one attack it admits");
});

test("grantTakers never lists the grant card itself", {skip}, () => {
  /* LATENT, MEASURED: the pool's two attacks that are pure grants (Fire
     Tenet: Strike First, Teklo Trebuchet 2000) print a qualifier they do
     not meet themselves, so only a synthetic can express the bug (v3.73). */
  H.db();
  const self = {uid: ++_uid, name: "Self-Granting Probe " + _uid, pitch: 1, cost: 0, power: 3, def: 2,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [],
    tx: "Your next attack this turn gets go again."};
  const g = seat0({hand: [self], res: 9});
  const t = J.grantTakers(g, 0, self.uid, "hand");
  assert.ok(Array.isArray(t), "the probe must read as a pure grant: " + JSON.stringify(t));
  assert.ok(!t.some(x => x.uid === self.uid), "it listed itself");
});

/* ---- 3. THE POLICY ----------------------------------------------------------- */

test("the attack that keeps the point is made before a bigger one that spends it", {skip}, () => {
  const tip = card("Golden Tipple", 1), big = card("Brutal Assault", 1);
  const g = seat0({hand: [big, tip], res: 9});
  const a = SP.act(g, 0);
  assert.equal(a.uid, tip.uid, "3-power Tipple keeps the point, so it goes before 6-power Brutal Assault");
});

test("a pure grant with no attack to take it is held, and played when one is there", {skip}, () => {
  const av = card("Avast Ye!", 3), big = card("Brutal Assault", 1);
  const held = SP.act(seat0({hand: [av, big], res: 9}), 0);
  assert.notEqual(held && held.uid, av.uid, "no Pirate ally attack: Avast Ye! waits");
  const bar = onBoard(card("Barnacle", 1));
  const played = SP.act(seat0({hand: [av, big], board: [bar], res: 9}), 0);
  assert.equal(played && played.uid, av.uid, "with a Pirate ally to take it, it goes first");
});

test("the taker must be payable WITHOUT the grant card", {skip}, () => {
  /* Flying High's bare go again admits any attack, and Brutal Assault costs
     2 — payable only by pitching Flying High itself. Counting the grant as
     its own payment is playing it and then stranding the attack. */
  const fh = card("Flying High", 3), big = card("Brutal Assault", 1);
  const a = SP.act(seat0({hand: [fh, big], res: 0}), 0);
  assert.notEqual(a && a.uid, fh.uid, "the grant would have to pay for its own taker");
  const b = SP.act(seat0({hand: [fh, big], res: 9}), 0);
  assert.equal(b && b.uid, fh.uid, "control: with the cost covered it goes first");
});
