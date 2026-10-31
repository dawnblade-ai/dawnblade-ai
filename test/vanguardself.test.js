/* test/vanguardself.test.js — A STANDING GRANT PRINTED ON AN ATTACK REACHES THAT ATTACK
 *
 * > "Boltyn Specialization
 * >  As an additional cost to play this, you may charge your soul any number
 * >  of times.
 * >  Your attacks this combat chain get +1{p} for each Light card charged
 * >  this way."
 * >   — V OF THE VANGUARD
 *
 * RULING (user, 2026-10-31): V of the Vanguard's "Your attacks this combat
 * chain get +1{p} for each Light card charged this way" includes V itself:
 * "Yes."
 *
 * THE DEFECT WAS A SCHEDULE, NOT A COUNT. An attack card's `fx.ops` ride to
 * RESOLUTION with `pend.ops`, and the standing grant is READ in `linkPumps`,
 * which strikes the total BEFORE `linkPayload` runs those ops. So the grant
 * was made after V's own damage and only the NEXT attack carried it: driven
 * with two Light cards charged, V dealt its printed 3 (the stated record
 * `attack-grant-misses-own-attack`, v4.56 -> closed here).
 *
 * THE FIX IS ONE PRE-RUN in `execute` (declaration), beside the other ops that
 * move there. `linkPumps` stays the ONE reader, so V takes the grant once and
 * every later link takes it once. The two ways to get that wrong are driven
 * below on BOTH boards: no grant at all at V's own link (the old bug), and
 * the grant made twice (declaration AND resolution — V would deal 7, not 5,
 * and the next link would carry +4).
 *
 * BOTH BOARDS, because a schedule written on one board does not exist on the
 * other (v3.01): the TABLE is `judge.reduce` end to end; the TRAINER is
 * `execute` + `resolveStack` + the shared `closeChainGrants`, which is exactly
 * the composition `Battle` in index.html calls (it has no second copy).
 */
const test = require("node:test");
const assert = require("node:assert");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const gate = t => H.hasDb() ? t : { skip: true };

const ent = (maps, nm, p, uid) =>
  ({...C.resolveEntry(maps, {name: nm, p, code: null, q: 1}), uid});

const HP = 40;   // deep enough that no drill here ends the game

/* V (uid 1), two LIGHT cards to charge (2, 3), a GENERIC attack to charge as
   the non-Light case (4), and two more Generic attacks to swing with (5, 6).
   Brutal Assault is the follow-up: printed 6, no keyword that reads a grant,
   and it costs 2 — V's 1 plus two of them fits in 4 action points and 20
   resources, so no drill is limited by its own fixture. */
const seat = maps => {
  P.fxReset();
  const hand = [ent(maps, "V of the Vanguard", 2, 1), ent(maps, "Bolt of Courage", 1, 2),
                ent(maps, "Take Flight", 1, 3), ent(maps, "Brutal Assault", 1, 4),
                ent(maps, "Brutal Assault", 1, 5), ent(maps, "Brutal Assault", 1, 6)];
  const g = H.state({name: "Boltyn", res: 20, ap: 4, hand},
                    {name: "Them", res: 9, hp: HP},
                    {turn: 3, actor: 0, turnPlayer: 0, seed: "vov"});
  return {g: {...g, phase: "action", step: "layer", priority: 0, passed: []}, hand};
};

const isLight = c => (c.ty || []).some(t => /^light$/i.test(String(t)));
const amts = s => s.sides[0].atkBuff.map(b => b.amt);

test(gate("the fixture is what the drills say it is"), () => {
  const maps = H.db();
  const {hand} = seat(maps);
  assert.equal(hand[0].power, 3, "V's printed power");
  assert.deepEqual(hand.slice(1, 6).map(isLight), [true, true, false, false, false],
    "two Light cards to charge, and Generic ones that are not");
  assert.equal(hand[3].power, 6, "the follow-up's printed power");
});

/* ---- THE TABLE ---------------------------------------------------------- */

/* Play V, answer the charge offers with `picks` (a uid, or null to decline). */
const tDeclare = (g, picks) => {
  let out = J.reduce(g, {t: "play", uid: 1, from: "hand"}, 0);
  assert.ok(!out.error, "V was refused: " + out.error);
  let s = out.state, guard = 0;
  while(s.pending && s.pending.kind === "charge"){
    assert.ok(guard++ < 12, "the charge offer never terminated");
    const nx = picks.shift();
    out = J.reduce(s, nx == null ? {t: "charge"} : {t: "charge", uid: nx}, 0);
    assert.ok(!out.error, "the charge answer was refused: " + out.error);
    s = out.state;
  }
  return s;
};

/* Pass to the RESOLUTION step and stop there: the damage is dealt, the chain
   is still open, and the turn-player holds the window to continue it. */
const tResolve = s0 => {
  let s = s0, guard = 0;
  while(s.pend && s.step !== "resolution" && guard++ < 60){
    const r = J.reduce(s, {t: "pass"}, s.priority);
    assert.ok(!r.error, "a pass was refused: " + r.error);
    s = r.state;
  }
  assert.equal(s.step, "resolution", "the drive never reached the resolution step");
  return s;
};

const tSwing = (s, uid) => {
  const hp0 = s.sides[1].hp;
  const r = J.reduce(s, {t: "play", uid, from: "hand"}, 0);
  assert.ok(!r.error, "the follow-up attack was refused: " + r.error);
  const out = tResolve(r.state);
  return {s: out, dealt: hp0 - out.sides[1].hp};
};

/* The charge picks for a row: N Light cards, or the one Generic card. */
const ROWS = [
  {label: "no charge",           picks: [null],          bonus: 0},
  {label: "one Light card",      picks: [2, null],       bonus: 1},
  {label: "two Light cards",     picks: [2, 3, null],    bonus: 2},
  {label: "a Generic card only", picks: [4, null],       bonus: 0}
];

test(gate("TABLE: V itself deals +1{p} per Light card charged — 3, 4, 5, and a Generic card gives nothing"), () => {
  const maps = H.db();
  for(const row of ROWS){
    const {g} = seat(maps);
    const s = tResolve(tDeclare(g, row.picks.slice()));
    assert.equal(HP - s.sides[1].hp, 3 + row.bonus, row.label + ": V's own damage");
    /* ONCE. A grant made at declaration AND again at resolution would stand
       twice (and V would deal 3 + 2 * bonus), so the entries are counted. */
    assert.deepEqual(amts(s), row.bonus ? [row.bonus] : [], row.label + ": the grant stands once");
    assert.deepEqual(INV.errors(s), [], row.label + ": the board is legal");
  }
});

test(gate("TABLE: the NEXT attack on the chain gets the same bonus, once"), () => {
  const maps = H.db();
  for(const row of ROWS){
    const {g} = seat(maps);
    const link1 = tResolve(tDeclare(g, row.picks.slice()));
    const {s, dealt} = tSwing(link1, 4 + (row.picks[0] === 4 ? 1 : 0));
    assert.equal(s.chainOpen, true, row.label + ": the chain is still open at the second link");
    assert.equal(dealt, 6 + row.bonus, row.label + ": the follow-up carries the grant once");
    assert.deepEqual(amts(s), row.bonus ? [row.bonus] : [],
      row.label + ": and the grant is still one entry, not one per link");
  }
});

test(gate("TABLE: the bonus ends when the chain closes — a fresh chain swings for its printed power"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  const link1 = tResolve(tDeclare(g, [2, 3, null]));
  assert.deepEqual(amts(link1), [2], "granted, with the chain open");
  /* Pass out of the resolution step: nothing continues the chain, so it
     closes — through the real close step, not a call to the sweeper. */
  let s = link1, guard = 0;
  while(s.chainOpen && guard++ < 10){
    const r = J.reduce(s, {t: "pass"}, s.priority);
    assert.ok(!r.error, "a pass was refused: " + r.error);
    s = r.state;
  }
  assert.equal(s.chainOpen, false, "the chain closed");
  assert.deepEqual(amts(s), [], "and the close took the grant, because the card prints `this combat chain`");
  /* A NEW chain in the same turn: the action phase is still open and the
     seat still has action points and a Generic attack in hand. */
  assert.ok(s.sides[0].ap > 0 && s.phase === "action", "fixture: the turn is still live");
  const {dealt} = tSwing(s, 5);
  assert.equal(dealt, 6, "the next chain's attack is its printed 6, not 8");
});

/* ---- THE TRAINER -------------------------------------------------------- */

/* `Battle`'s own composition: `execute` (with the answered charge uids on the
   state, as `tryPlay` hands them over), then `resolveStack`. */
const bPlay = (s, uid, charged) => {
  const c = s.sides[0].hand.find(x => x.uid === uid);
  assert.ok(c, "the card is in hand");
  const hp0 = s.sides[1].hp;
  let n = H.execute({...s, _chargeUids: charged || []}, c, "hand", 0, {});
  n = J.withEffects(n, (fx, st) => fx.resolveStack(st));
  return {s: n, dealt: hp0 - n.sides[1].hp};
};

test(gate("TRAINER: V itself deals 3 / 4 / 5, the next link carries it once, a Generic charge gives nothing"), () => {
  const maps = H.db();
  for(const row of ROWS){
    const {g} = seat(maps);
    const charged = row.picks.filter(u => u != null);
    const v = bPlay(g, 1, charged);
    assert.equal(v.dealt, 3 + row.bonus, row.label + ": V's own damage");
    assert.deepEqual(amts(v.s), row.bonus ? [row.bonus] : [], row.label + ": the grant stands once");
    assert.equal(v.s.chainOpen, true, row.label + ": the chain is open");
    const next = bPlay(v.s, row.picks[0] === 4 ? 5 : 4);
    assert.equal(next.dealt, 6 + row.bonus, row.label + ": the next link carries it once");
    assert.deepEqual(amts(next.s), row.bonus ? [row.bonus] : [], row.label + ": still one entry");
    assert.deepEqual(INV.errors(next.s), [], row.label + ": the board is legal");
  }
});

test(gate("TRAINER: the bonus ends when the chain closes"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  const v = bPlay(g, 1, [2, 3]);
  assert.deepEqual(amts(v.s), [2], "granted, with the chain open");
  /* index.html's `closeChain` is this call on a state with the chain emptied;
     the chain-grant sweep is the shared body both boards call. */
  const closed = E.closeChainGrants({...v.s, chain: [], chainOpen: false, boostChain: 0, featured: null});
  assert.deepEqual(amts(closed), [], "the close took the grant");
  const next = bPlay(closed, 4);
  assert.equal(next.dealt, 6, "a fresh chain's attack is its printed 6");
});

/* ---- THE REACH OF THE FIX ---------------------------------------------- */

test(gate("CENSUS: V is the only ATTACK card in the pool whose ops carry a standing attack grant"), () => {
  /* The blast radius of the pre-run, asked of the pool rather than recalled.
     Night's Embrace is an attack REACTION: it is not `attacking`, makes its
     grant at its own resolution, and does not pass through the pre-run. */
  const fs = require("fs");
  const X = require("./helpers/extract.js");
  const TY = require("../engine/types.js");
  const pool = JSON.parse(fs.readFileSync(X.POOL, "utf8")).filter(c => c && c.name).map(C.mapDbCard)
    .map(m => ({name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, tt: m.tt, ty: m.ty, tx: m.tx, kw: m.kw, gkw: m.gkw}));
  const seen = new Set(), hit = [];
  for(const c of pool){
    const key = c.name + "|" + c.pitch;
    if(seen.has(key)) continue;
    seen.add(key);
    P.fxReset();
    const grants = (P.fxParse(c).ops || []).some(o => o[0] === "atkBuff");
    if(grants) hit.push({name: c.name, attack: TY.isAttack(c)});
  }
  assert.deepEqual(hit.filter(h => h.attack).map(h => h.name), ["V of the Vanguard"],
    "the attack cards the pre-run moves — a second one is a new card to drive on both boards");
  assert.deepEqual(hit.filter(h => !h.attack).map(h => h.name), ["Night's Embrace"],
    "and the non-attack carrier, which the pre-run leaves alone");
});
