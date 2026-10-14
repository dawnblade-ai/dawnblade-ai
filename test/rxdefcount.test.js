/* A PLAYED DEFENCE REACTION IS A DEFENDING CARD — IN THE COUNTS TOO (v5.21)

   The wall has added a played defence reaction's defence since v3.25, and
   no defender COUNT ever saw one, so one wall gave two answers:

     reprise    "if the defending hero has defended with a card from their
                 hand this chain link" — a DR played from hand: no
     defLt2     "defended by fewer than 2 non-equipment cards" — one
                 declared card plus a DR: "fewer than 2"
     defLt2any  "defended by fewer than 2 cards" — the same

   `parser.rxDefenders` is the one reader: every played DR is a
   non-equipment defending card (`all`), and reprise names the ones played
   FROM HAND (`fromHand`). The zone rides on the `blockRx` entry as `from`,
   stamped by both play sites (judge's and `playAtSpeed`).

   Also here: QUEUE N4 (the trainer's two defence-reaction doors counted
   the DUMMY's stack layers for Unity's `handDefenders`) and N5 (the
   `handBlockers` forward in `playAtSpeed` is the only way the trainer's
   reaction doors feed reprise, and no drill asked it). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

test("`rxDefenders` — every played DR counts, and only a HAND one for reprise", () => {
  assert.deepEqual(P.rxDefenders({blockRx: []}), {all: 0, fromHand: 0});
  assert.deepEqual(P.rxDefenders({blockRx: [{def: 3, from: "hand"}, {def: 2, from: "arsenal"}]}),
    {all: 2, fromHand: 1});
  /* an entry with no zone stamp is never read as a hand card */
  assert.deepEqual(P.rxDefenders({blockRx: [{def: 3}]}), {all: 1, fromHand: 0});
  assert.deepEqual(P.rxDefenders(null), {all: 0, fromHand: 0});
});

/* REPRISE AT THE TABLE, driven: Dorinthea's Dawnblade swings, the defender
   has declared nothing and has PLAYED a defence reaction, and seat 0 plays
   Ironsong Response (+3 with reprise) into the reaction window. */
const rxState = rx => {
  const iron = H.card("Ironsong Response", 1), dawn = H.card("Dawnblade");
  const g = H.state({res: 9, ap: 1, hand: [{...iron, uid: 11}]}, {blockRx: rx},
                    {turn: 3, actor: 0, turnPlayer: 0});
  return {...g, phase: "action", step: "reaction", priority: 0, passed: [], attacker: 0,
    pend: {card: {...dawn, uid: 50}, from: "weapon", by: 0, target: {kind: "hero"},
           total: 3, ga: false, ops: [], onHit: []}};
};
const rxPump = g => {
  const out = J.reduce(g, {t: "play", uid: 11, from: "hand"}, 0);
  assert.ok(!out.error, String(out.error));
  return (out.state.stack || []).filter(l => l.k === "rx").reduce((t, l) => t + (l.pump || 0), 0);
};

test("DRIVEN: a DR played FROM HAND satisfies reprise at the table", {skip}, () => {
  H.db();
  assert.equal(rxPump(rxState([{label: "Sigil 3", def: 3, from: "hand"}])), 3,
    "the defender defended with a card from their hand — reprise's +3 lands");
});

test("…and BOTH HALVES: nothing played, or a DR from the ARSENAL, is no reprise", {skip}, () => {
  H.db();
  assert.equal(rxPump(rxState([])), 0, "nothing defended — a reprise read as always-on is the bug");
  assert.equal(rxPump(rxState([{label: "Sigil 3", def: 3, from: "arsenal"}])), 0,
    "a DR from the arsenal defended, but not with a card from their hand");
});

/* THE LATE COUNTS, driven through `strike`: a synthetic 6-power attack
   (the pool's two cards carry other text) met by one declared card worth 1
   and, in two of three rows, a played DR worth 1. */
const atk = (nm, txt) => ({uid: 50, name: nm, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0, power: 6, def: 2, tx: txt});
const blk = uid => ({uid, name: "Blk " + uid, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 1, power: 2, def: 1});
const struck = (a, rx) => {
  const g0 = H.state({res: 0, ap: 0}, {hp: 20, hand: [blk(2)], blockH: [2], blockRx: rx},
                     {turn: 3, actor: 0, turnPlayer: 0});
  const g = {...g0, phase: "action", step: "damage", priority: null, passed: [], attacker: 0,
    chainCards: [a],
    pend: {card: a, from: "hand", by: 0, target: {kind: "hero"}, total: 6, ga: false, ops: [],
           onHit: [], lateConds: P.fxParse(a).conds.filter(c => /^defLt2/.test(c.cond))}};
  return 20 - J.strike(g).sides[1].hp;
};
for(const [nm, txt, cond] of [
  ["Rx Count Nonequip", "If this is defended by fewer than 2 non-equipment cards, this gets +3{p}.", "defLt2"],
  ["Rx Count Any", "If this is defended by fewer than 2 cards, this gets +3{p}.", "defLt2any"]]){
  test(`DRIVEN: ${cond} — a declared card plus a played DR is TWO defenders`, () => {
    const a = atk(nm, txt);
    assert.equal(P.fxParse(a).conds[0].cond, cond, "the fixture reads the condition it is named for");
    assert.equal(struck(a, []), 9 - 1, "control: one defender — the +3 lands");
    assert.equal(struck(a, [{label: "dr 1", def: 1, from: "hand"}]), 6 - 2,
      "a DR from hand is the second defender — no bonus");
    assert.equal(struck(a, [{label: "dr 1", def: 1, from: "arsenal"}]), 6 - 2,
      "and so is one from the arsenal — it is a non-equipment card wherever it came from");
  });
}

test("DRIVEN: judge's own DR play stamps the zone it was played from", {skip}, () => {
  H.db();
  const dawn = H.card("Dawnblade");
  const dr = H.card("Sigil of Suffering", 1);
  assert.ok(dr && P.isDR(dr), "a defence reaction out of Viserai's deck");
  const g0 = H.state({res: 0, ap: 1}, {res: 9, hand: [{...dr, uid: 31}]},
                     {turn: 3, actor: 0, turnPlayer: 0});
  const g = {...g0, phase: "action", step: "reaction", priority: 1, passed: [], attacker: 0,
    pend: {card: {...dawn, uid: 50}, from: "weapon", by: 0, target: {kind: "hero"},
           total: 3, ga: false, ops: [], onHit: []}};
  const out = J.reduce(g, {t: "play", uid: 31, from: "hand"}, 1);
  assert.ok(!out.error, String(out.error));
  const rx = out.state.sides[1].blockRx || [];
  assert.equal(rx.length, 1, "the DR defends");
  assert.equal(rx[0].from, "hand", "and the entry says where it came from");
});

/* N5 — `playAtSpeed` forwards the caller's wall into `attackRx`. It is the
   only route by which the trainer's reaction doors feed reprise. */
test("DRIVEN (N5): `playAtSpeed` forwards `handBlockers` — both halves", {skip}, () => {
  H.db();
  const run = hb => {
    const g = rxState([]);
    const out = H.fx(g, (f, n) => f.playAtSpeed(n, n.sides[0].hand[0], "hand",
      {window: "attack-reaction", handBlockers: hb, defenders: []}));
    assert.equal(out.why, null, String(out.why));
    return (out.game.stack || []).filter(l => l.k === "rx").reduce((t, l) => t + (l.pump || 0), 0);
  };
  assert.equal(run(1), 3, "a card from hand met the attack — reprise lands");
  assert.equal(run(0), 0, "none did — no reprise");
});

/* N4 — the trainer's two defence-reaction doors. In the DEFENCE window the
   player's declared hand defenders are `blockH`; the `{k:"def"}` stack
   layers are the dummy's, on the player's own attack. A React closure
   cannot be driven in Node, so the doors are scanned. */
test("N4: the trainer's DR doors count `blockH`, never the dummy's stack layers", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const body = name => {
    const a = src.search(new RegExp("const " + name + " = \\([^)]*\\) => setG\\("));
    assert.ok(a > 0, name + " not found");
    const b = src.indexOf("\n  const ", a + 10);
    return src.slice(a, b);
  };
  const def = src.match(/const blockHandCount = n => ([^;]+);/);
  assert.ok(def && /blockH/.test(def[1]) && !/stack/.test(def[1]),
    "the one reader counts the player's declared hand defenders");
  for(const d of ["playRx", "playRxA"]){
    const b = body(d);
    assert.ok(!/handDefenders:\s*s\.stack/.test(b), d + " counts the dummy's stack layers for Unity");
    assert.ok(/handDefenders:[^,}]*blockHandCount\(s\)/.test(b), d + " asks `blockHandCount`");
  }
});

/* THE SECOND STAMP SITE — `playAtSpeed`, the body every trainer
   instant-speed door goes through (v4.95). */
test("DRIVEN: `playAtSpeed` stamps the zone a DR was played from", {skip}, () => {
  H.db();
  const dr = H.card("Sigil of Suffering", 1);
  const g0 = H.state({res: 9, hand: [{...dr, uid: 31}]}, {}, {turn: 3, actor: 0, turnPlayer: 1});
  const g = {...g0, pend: {card: {...H.card("Dawnblade"), uid: 50}, from: "weapon", by: 1,
    target: {kind: "hero"}, total: 3, ga: false, ops: [], onHit: []}};
  const out = H.fx(g, (f, n) => f.playAtSpeed(n, n.sides[0].hand[0], "hand", {window: "defense-reaction"}));
  assert.equal(out.why, null, String(out.why));
  const rx = out.game.sides[0].blockRx || [];
  assert.equal(rx.length, 1, "the DR defends");
  assert.equal(rx[0].from, "hand");
});

/* THE TRAINER'S OWN WALL — `resolveStack`, where the player attacks and the
   defender's declarations are `{k:"def"}` layers. Latent (the trainer's
   defender is the vanilla dummy, which plays no DR), driven anyway. */
test("DRIVEN: the trainer's `resolveStack` counts a played DR too", () => {
  const a = atk("Rx Count Trainer", "If this is defended by fewer than 2 non-equipment cards, this gets +3{p}.");
  const run = rx => {
    const g0 = H.state({res: 0, ap: 1}, {hp: 20, hand: [blk(2)], blockRx: rx},
                       {turn: 3, actor: 0, turnPlayer: 0});
    const g = {...g0, stack: [{k: "def", uid: 2}],
      pend: {card: a, from: "hand", by: 0, target: {kind: "hero"}, total: 6, ga: false, ops: [],
             onHit: [], lateConds: P.fxParse(a).conds}};
    const out = H.fx(g, (f, n) => f.resolveStack(n));
    assert.deepEqual(out.sides[1].blockRx || [], [],
      "the played DR is spent with the link — left standing, it defends the next one for free (v2.46)");
    return 20 - out.sides[1].hp;
  };
  assert.equal(run([]), 9 - 1, "control: one defender — the +3 lands");
  assert.equal(run([{label: "dr 1", def: 1, from: "hand"}]), 6 - 2, "a played DR is the second defender");
});
