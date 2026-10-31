/* ============================================================
   THE POLICY CASHES AN ARENA ABILITY WHEN IT IS A NET GAIN NOW (QUEUE H20)

   `sparring.act` never activated an arena permanent's ability
   (`arena-ability-policy-declines`, v4.47), so the seven readable records
   — Concealed Object, Energy Potion, Timesnap Potion and Gravy Bones'
   treasure tokens — were decked and never used. `judge.arenaUseful` weighs
   them where card text may be read; the policy asks and `legal` disposes.

   MEASURED against v5.56, own seat, 72 seeds x 14 foes (1008 games a side),
   paired by seed: Lyath 259 -> 296 wins (29 seeds up, 6 down), Gravy Bones
   150 -> 172 (25 up, 11 down). Energy Potion and Timesnap Potion fire about once in 42
   games, which no ladder can resolve: they are kept because each is a gain by
   construction (a card not pitched, a play not stranded), not because a
   count says so.

   EVERY DRILL ASKS FOR BOTH ANSWERS. A fixture where the rule fires and one
   where it must not are the same fixture with one number moved, so a
   sabotage of either half is caught.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const SP = require("../engine/sparring.js");
const J = H.J;
const {match} = require("../tools/selfplay.js");

const skip = H.hasDb() ? false : "no card database";

/* An action-phase table state with `entries` in seat 0's arena. */
function arena(entries, o, extra){
  const g = H.state(Object.assign({res: 0, ap: 1, board: entries}, o || {}), {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []}, extra || {});
}
const ent = (card, uid) => ({uid, kind: "token", card, spent: false});
const attack = (uid, o) => Object.assign({uid, name: "Probe " + uid, pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], kw: [], tx: ""}, o || {});
const blue = uid => attack(uid, {pitch: 3, power: 0, name: "Blue " + uid});
const deck = () => [H.card("Wounding Blow", 1), H.card("Wounding Blow", 2)];
/* seat 0's own attack on the chain, in the reaction step */
const link = by => ({phase: "action", step: "reaction", priority: 0, passed: [], attacker: by, stack: [],
  pend: {card: attack("lk", {power: 4}), by, total: 4, ga: false, ops: [], onHit: []}});
const isUse = (a, uid) => a && a.t === "activate" && a.uid === uid;

/* ---- the draw: Gold, Silver, Copper, Diamond ---------------------------- */

test("a go-again draw is cashed with the resources already floating", {skip}, () => {
  H.db();
  const g = arena([ent(H.card("Gold", 0), 901)], {res: 2, deck: deck(), hand: [attack("a1")]});
  const x = SP.explain(g, 0);
  assert.ok(isUse(x.action, 901), "cashed: " + JSON.stringify(x.action));
  assert.equal(x.key, "arenaDraw");
  assert.equal(x.line, "Use Gold", "the line names the permanent, and it is not an attack");
  assert.deepEqual(x.action, SP.act(g, 0), "explain proposes exactly what act does");
  assert.equal(J.legal(g, x.action, 0), null);
  const s = J.reduce(g, x.action, 0).state.sides[0];
  assert.equal(s.hand.length, 2, "the card was drawn");
  assert.equal(s.res, 0, "the floating resources paid for it, no card was pitched");
  assert.equal(s.ap, 1, "and go again kept the action point");
});

test("a draw is NOT cashed by pitching a card, with too little floating, or from an empty deck", {skip}, () => {
  H.db();
  const gold = () => ent(H.card("Gold", 0), 902);
  /* control: the same hand and arena, one number moved */
  const on = arena([gold()], {res: 2, deck: deck(), hand: [blue("b1")]});
  assert.ok(isUse(SP.act(on, 0), 902), "control: floating 2 cashes the Gold");
  /* the cost is {r}{r}: a hand that COULD raise it is not a reason to pitch for it */
  const pitch = arena([gold()], {res: 0, deck: deck(), hand: [blue("b1"), blue("b2")]});
  assert.equal(J.legal(pitch, {t: "activate", uid: 902}, 0), null, "control: legal by pitching");
  assert.ok(!isUse(SP.act(pitch, 0), 902), "never a card pitched for it");
  const short = arena([gold()], {res: 1, deck: deck(), hand: [blue("b1")]});
  assert.ok(!isUse(SP.act(short, 0), 902), "1 floating is short of {r}{r}");
  const silver = arena([ent(H.card("Silver", 0), 903)], {res: 2, deck: deck(), hand: [blue("b1")]});
  assert.ok(!isUse(SP.act(silver, 0), 903), "Silver costs {r}{r}{r}");
  const empty = arena([gold()], {res: 2, deck: [], hand: [attack("a1")]});
  assert.ok(!isUse(SP.act(empty, 0), 902), "a draw from an empty deck finds nothing");
});

test("a free draw (Diamond) is cashed at once", {skip}, () => {
  H.db();
  const g = arena([ent(H.card("Diamond", 0), 904)], {res: 0, deck: deck(), hand: [attack("a1")]});
  const x = SP.explain(g, 0);
  assert.ok(isUse(x.action, 904), JSON.stringify(x.action));
  assert.equal(x.key, "arenaDraw");
});

/* ---- the pump: Concealed Object ------------------------------------------ */

test("Concealed Object pumps the seat's OWN attack, and only once", {skip}, () => {
  H.db();
  const co = () => ent(H.card("Concealed Object", 3), 905);
  const g = arena([co()], {hand: [], res: 0}, link(0));
  const x = SP.explain(g, 0);
  assert.ok(isUse(x.action, 905), "tapped for the pump: " + JSON.stringify(x.action));
  assert.equal(x.key, "arenaPump");
  assert.equal(x.line, "Use Concealed Object");
  assert.deepEqual(x.action, SP.act(g, 0));
  assert.equal(J.legal(g, x.action, 0), null);
  const n = J.reduce(g, x.action, 0).state;
  assert.equal(n.pend.total, 5, "the attack got +1");
  assert.equal(n.sides[0].board[0].spent, true, "and the tap was paid");
  assert.ok(!isUse(SP.act({...n, stack: []}, 0), 905), "a tapped permanent is not asked again");
});

test("Concealed Object never pumps the OPPONENT's attack", {skip}, () => {
  H.db();
  const g = arena([ent(H.card("Concealed Object", 3), 906)], {hand: [], res: 0}, link(1));
  g.turnPlayer = 1;
  assert.ok(!isUse(SP.act(g, 0), 906), "pumping their swing helps only them");
  assert.equal(J.arenaUseful(g, 0, {kinds: ["pump"]}), null);
  const mine = arena([ent(H.card("Concealed Object", 3), 906)], {hand: [], res: 0}, link(0));
  assert.deepEqual(J.arenaUseful(mine, 0, {kinds: ["pump"]}), {uid: 906, kind: "pump"}, "control: it is theirs, not the card");
});

/* ---- resources: Energy Potion --------------------------------------------- */

test("Energy Potion is broken open for the play it pays for, and not for nothing", {skip}, () => {
  H.db();
  const pot = () => ent(H.card("Energy Potion", 3), 907);
  /* a 2-cost attack and a hand that would otherwise pitch for it */
  const need = arena([pot()], {res: 0, hand: [attack("a2", {cost: 2, power: 5}), blue("b1")], deck: deck()});
  const x = SP.explain(need, 0);
  assert.ok(isUse(x.action, 907), "the potion first: " + JSON.stringify(x.action));
  assert.equal(x.key, "arenaRes");
  assert.deepEqual(x.action, SP.act(need, 0));
  assert.equal(J.reduce(need, x.action, 0).state.sides[0].res, 2);
  /* the same hand, a 0-cost attack: nothing for the resources to pay */
  const free = arena([pot()], {res: 0, hand: [attack("a0", {cost: 0, power: 5}), blue("b1")], deck: deck()});
  assert.ok(!isUse(SP.act(free, 0), 907), "a play that costs nothing needs no resources");
  /* a 5-cost attack: the potion does not cover it, so it is not wasted on the attempt */
  const far = arena([pot()], {res: 0, hand: [attack("a5", {cost: 5, power: 9}), blue("b1"), blue("b2")], deck: deck()});
  assert.equal(SP.act(far, 0).uid, "a5", "control: the 5-cost attack IS what it plays, by pitching two");
  assert.ok(!isUse(SP.act(far, 0), 907), "+2 does not reach 5");
  /* nothing to play */
  const none = arena([pot()], {res: 0, hand: [], deck: deck()});
  assert.ok(!isUse(SP.act(none, 0), 907), "resources with nothing to pay are lost at end of turn");
});

/* ---- action points: Timesnap Potion --------------------------------------- */

test("Timesnap Potion is used when two plays each need the point, not for one", {skip}, () => {
  H.db();
  const pot = () => ent(H.card("Timesnap Potion", 0), 908);
  const two = arena([pot()], {res: 0, hand: [attack("a1"), attack("a2")], deck: deck()});
  const x = SP.explain(two, 0);
  assert.ok(isUse(x.action, 908), "two swings, one point: " + JSON.stringify(x.action));
  assert.equal(x.key, "arenaAP");
  assert.equal(J.reduce(two, x.action, 0).state.sides[0].ap, 2, "it spent the point and gave two");
  const one = arena([pot()], {res: 0, hand: [attack("a1")], deck: deck()});
  assert.ok(!isUse(SP.act(one, 0), 908), "one swing needs one point, which it already has");
  /* a go-again swing keeps its own point, so the potion adds nothing to it */
  const ga = arena([pot()], {res: 0, hand: [attack("g1", {name: "Probe Goes Again", kw: ["Go again"], tx: "Go again"}), attack("a2")], deck: deck()});
  assert.equal(J.arenaUseful(ga, 0, {next: {t: "play", uid: "g1", from: "hand"}, kinds: ["ap"]}), null,
    "a go-again play is not short of points");
});

/* ---- and it does not fight v5.56's resUnlock ------------------------------ */

test("a draw does not spend the pool a resource piece is about to complete", {skip}, () => {
  H.db();
  const P = require("../engine/parser.js"), B = require("../engine/build.js");
  const blossom = H.card("Blossom of Spring", 0);
  Object.assign(blossom, {uid: 41}); P.fxReset(); B.equipPiece(blossom); P.fxReset();
  /* a 3-cost attack, 2 floating, nothing to pitch: Blossom's {r} is what makes it legal */
  const fix = res => arena([ent(H.card("Gold", 0), 909)],
    {res, gear: [blossom], deck: deck(), hand: [attack("a3", {cost: 3, power: 5})]});
  const g = fix(2);
  assert.notEqual(J.legal(g, {t: "play", uid: "a3", from: "hand"}, 0), null, "control: the attack is not legal yet");
  assert.equal(J.legal(g, {t: "activate", uid: 41}, 0), null, "control: Blossom is");
  const x = SP.explain(g, 0);
  assert.deepEqual(x.action, {t: "activate", uid: 41}, "the piece is spent, the Gold waits: " + JSON.stringify(x.action));
  assert.equal(x.key, "resUnlock");
  /* the control: with the attack payable by itself the Gold IS cashed */
  const free = arena([ent(H.card("Gold", 0), 909)],
    {res: 2, gear: [blossom], deck: deck(), hand: [attack("a2", {cost: 2, power: 5})]});
  assert.ok(isUse(SP.act(free, 0), 909), "nothing is spoken for, so the draw is cashed: " + JSON.stringify(SP.act(free, 0)));
});

/* ---- the whole thing, on real games --------------------------------------- */

function census(k0, k1, seed){
  let g = match(k0, k1, `${k0}-${k1}-${seed}`, seed % 2), steps = 0;
  const keys = {}, bad = [];
  while(!g.over && steps < 4000){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(g, s); if(!a) continue;
      const e = SP.explain(g, s);
      if(JSON.stringify(e.action) !== JSON.stringify(a)) bad.push(`explain differs at step ${steps}`);
      if(/^arena/.test(e.key || "")){
        keys[e.key] = (keys[e.key] || 0) + 1;
        if(!e.why || !e.line || e.line === "activate") bad.push(`${e.key} has no voice: ${e.line}`);
      }
      const o = J.reduce(g, a, s);
      if(o.error){ bad.push("refused: " + o.error); continue; }
      g = o.state; steps++; moved = true; break;
    }
    if(!moved) break;
  }
  return {keys, bad, over: !!g.over};
}

/* THE FIRST SEED THAT REACHES IT, not one named seed: a policy change anywhere
   (the spare-card block, H21) moves every trajectory, and a drill pinned to one
   game then fails for a game that no longer visits the route. The count stays
   a real census: six seeds to find it, every game clean. */
const reach = (k0, k1, key) => {
  const seen = [];
  for(let s = 0; s < 6; s++){
    const r = census(k0, k1, s);
    assert.deepEqual(r.bad, [], `${k0} v ${k1} seed ${s}`);
    seen.push(r.keys);
    if(r.keys[key] > 0) return {seed: s, seen};
  }
  return {seed: null, seen};
};
test("Lyath's pump and Gravy's draw are REACHED in real games, with no refusal", {skip}, () => {
  const l = reach("lyath", "viserai", "arenaPump");
  assert.ok(l.seed != null, "Concealed Object was cashed: " + JSON.stringify(l.seen));
  const g = reach("gravy", "blaze", "arenaDraw");
  assert.ok(g.seed != null, "a Gold was cashed: " + JSON.stringify(g.seen));
});

test("every arena reason is a sentence in the coach's voice", () => {
  for(const k of ["arenaPump", "arenaDraw", "arenaRes", "arenaAP"]){
    const s = SP.CALL_WHY[k];
    assert.ok(s && /[.!]$/.test(s), k + " has a reason");
    assert.ok(!/[a-z][A-Z]|\.js|\bfx\b/.test(s), k + " names no identifier: " + s);
  }
});
