/* ============================================================
   A STANDING ATTACK GRANT, WITH A WINDOW (v3.87)

     "Your attacks with stealth get +1{p} this turn."   Night's Embrace

   It read `tier: none` — one of the pool's seven unread cards — and the
   whole gap was that nothing in the engine could say "every attack of
   this shape, until the window closes".

   IT IS NOT `buffQ`, AND GETTING THAT BACKWARDS IS WRONG IN BOTH
   DIRECTIONS. `buffQ` grants "your NEXT attack" and is SPENT by the card
   it lands on; this applies to EVERY matching attack inside its window
   and is never spent. A standing grant consumed by the first swing is
   weaker than printed; a single-shot grant left standing is stronger.
   That is v3.30's debuff/restriction distinction, one grant over.

   AND IT IS READ IN `linkPumps`, NOT AT DECLARATION. Night's Embrace is
   an ATTACK REACTION, so the grant does not exist yet when the attack is
   declared — read only at declaration, the card cannot pump the very
   swing it was played on, which is the whole of what it does. Read in
   BOTH places it is counted twice.

   THE DOUBLE READ WAS REAL AND THE SWEEP WAS BLIND. `fxParse`'s
   whole-text self-pump fallback read the printed +1 a second time into
   `fx.self`, so the card granted its qualified +1 AND a bare unqualified
   one; driven at the table a 3-power stealth attack dealt 5. v2.30's
   VALUE-DOUBLED, and the third time a new op has arrived without the
   fallback being told (v3.00's `onLeave`, v3.72's arsenal grant, this).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const S = require("../engine/sides.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

/* fxParse memoizes on `name|pitch`, so every synthetic needs a unique one. */
const synth = (name, tx, o) => Object.assign(
  {name, pitch: 3, tt: "Assassin Attack Reaction",
   ty: ["Assassin", "Attack Reaction"], kw: [], cost: 1, def: 3, tx}, o || {});

/* ---- 1. THE READER -------------------------------------------------- */

test("Night's Embrace reads in full", {skip}, () => {
  H.db(); P.fxReset();
  const c = H.card("Night’s Embrace", 3);
  assert.ok(c && c.resolved !== false, "the card resolves");
  const fx = P.fxParse(c);
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.ops, [["atkBuff", 1, {kw: "stealth"}, "turn"]]);
  assert.equal(fx.self, 0,
    "and the printed +1 is NOT read a second time into a bare self-pump");
});

test("the WINDOW is read off the printed words, never defaulted", {skip}, () => {
  P.fxReset();
  const turn = P.fxParse(synth("SG turn", "Your attacks get +1{p} this turn."));
  const chain = P.fxParse(synth("SG chain", "Your attacks get +1{p} this combat chain."));
  assert.equal(turn.ops[0][3], "turn");
  assert.equal(chain.ops[0][3], "chain");
  /* The two expire in DIFFERENT places, so defaulting either way changes
     how long a real card's bonus lasts. */
  assert.notEqual(turn.ops[0][3], chain.ops[0][3]);
});

test("the qualifier can sit on either side of the word, and both use ONE reader",
     {skip}, () => {
  P.fxReset();
  const tail = P.fxParse(synth("SG tail", "Your attacks with stealth get +1{p} this turn."));
  const lead = P.fxParse(synth("SG lead", "Your arrow attacks get +2{p} this turn."));
  assert.deepEqual(tail.ops[0][2], {kw: "stealth"});
  assert.deepEqual(lead.ops[0][2], {g: [["arrow"]]});
  /* `attackQual` is the one tail reader the four single-shot grants use
     (v3.31, v3.37); this invents no vocabulary, which is now the fifth
     time that has been true of the family. */
  assert.deepEqual(tail.ops[0][2], P.attackQual("", "with stealth"));
  assert.deepEqual(lead.ops[0][2], P.attackQual("arrow", ""));
});

test("an unreadable tail REFUSES the whole clause", {skip}, () => {
  /* `false` means "a restriction I cannot read" and is a DIFFERENT answer
     from `null` ("nothing restricts this") — and `qualMatches` answers
     TRUE for a falsy qualifier, so a `false` reaching the side would
     grant to every attack in the game. v3.31's bug, one grant over. */
  P.fxReset();
  assert.equal(P.attackQual("", "with crush"), false, "the premise");
  const fx = P.fxParse(synth("SG unreadable", "Your attacks with crush get +1{p} this turn."));
  assert.deepEqual(fx.ops, [], "nothing is granted");
  assert.equal(fx.tier, "none", "and the gap stays visible in the audit");
});

test("the fallback does not read the same +N{p} twice", {skip}, () => {
  /* THE MAGNITUDE IS MATCHED, not the mere presence of an op (v2.30), so
     a card printing two DIFFERENT pumps still gets its unread one. */
  P.fxReset();
  const same = P.fxParse(synth("SG dbl", "Your attacks get +1{p} this turn."));
  assert.equal(same.self, 0);
  const diff = P.fxParse(synth("SG two",
    "Your attacks get +1{p} this turn. This gets +3{p}.",
    {tt: "Assassin Action - Attack", ty: ["Assassin", "Action", "Attack"], power: 4}));
  assert.equal(diff.ops[0][0], "atkBuff");
  assert.equal(diff.ops[0][1], 1);
});

/* ---- 2. THE SIDE FIELD ---------------------------------------------- */

test("`atkBuff` is a real side field — all three ledgers carry it", {skip}, () => {
  /* A SIDE FIELD IS NOT REAL UNTIL THREE PLACES CARRY IT (v3.29):
     `SIDE_FIELDS` (or invariants reports SIDES-ASYMMETRIC), `wire.js` (a
     dropped field is a desync), and `report.js`'s `seat()`. */
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.deepEqual(S.makeSide({id: 0}).atkBuff, []);
  assert.ok(S.SIDE_FIELDS.indexOf("atkBuff") >= 0, "sides.js declares it");
  assert.match(rd("engine/wire.js"), /"atkBuff"/, "the wire ships it");
  assert.match(rd("engine/report.js"), /atkBuff: sd\.atkBuff/, "the report names it");
});

test("the op ACCUMULATES — a second source is not dropped", {skip}, () => {
  H.db();
  let g = H.state({res: 9}, {}, {actor: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.runOps(s,
    [["atkBuff", 1, {kw: "stealth"}, "turn"], ["atkBuff", 2, null, "turn"]], "drill")}));
  const n = out.game || out;
  assert.equal(n.sides[0].atkBuff.length, 2);
  assert.deepEqual(n.sides[0].atkBuff.map(b => b.amt), [1, 2]);
});

/* ---- 3. THE ATTACK COLLECTS IT -------------------------------------- */

/* Declare an attack, then settle its power the way both walls do. */
function swing(atk, held){
  H.db();
  const card = Object.assign({}, atk, {uid: 601});
  const g = H.state({hand: [card], res: 9, ap: 1, atkBuff: held || []},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const ex = J.withEffects(g, (fx, s) => ({game: fx.execute(s, card, "hand", 0, {})}));
  const n = ex.game || ex;
  const lp = J.withEffects(n, (fx, s) => {
    const r = fx.linkPumps(s, {defenders: 0, handBlockers: 0});
    return {game: r.game, _total: r.total};
  });
  return {declared: n.pend && n.pend.total, struck: lp._total, game: lp.game || lp};
}

test("driven: a matching attack collects it, and a non-matching one does not",
     {skip}, () => {
  H.db(); P.fxReset();
  const stealthy = H.card("Infect", 1);
  const plain = H.card("Wounding Blow", 1);
  assert.ok(P.printedKw(stealthy, "stealth"), "Infect prints Stealth");
  assert.ok(!P.printedKw(plain, "stealth"), "Wounding Blow does not — the control");

  const held = [{amt: 1, q: {kw: "stealth"}, until: "turn"}];
  assert.equal(swing(stealthy, []).struck, stealthy.power);
  assert.equal(swing(stealthy, held).struck, stealthy.power + 1, "the stealth attack is pumped");
  assert.equal(swing(plain, []).struck, plain.power);
  assert.equal(swing(plain, held).struck, plain.power,
    "and the plain one is NOT — the printed qualifier holds");
});

test("it is NEVER SPENT — two attacks in the window both get it", {skip}, () => {
  /* THE DIFFERENCE FROM `buffQ`, and the whole reason it is a separate
     field. A standing grant consumed by the first swing is weaker than
     printed. */
  H.db(); P.fxReset();
  const stealthy = H.card("Infect", 1);
  const held = [{amt: 1, q: {kw: "stealth"}, until: "turn"}];
  const first = swing(stealthy, held);
  assert.equal(first.struck, stealthy.power + 1);
  assert.equal(first.game.sides[0].atkBuff.length, 1,
    "the grant is still standing after the swing collected it");
  /* and a second attack, from that same state, collects it too */
  const second = swing(stealthy, first.game.sides[0].atkBuff);
  assert.equal(second.struck, stealthy.power + 1);
});

test("it is read ONCE — declaration does not also add it", {skip}, () => {
  /* Read in both places the printed +1 lands twice, which is
     VALUE-DOUBLED on the fairness sweep's own terms. The declared total
     must be the bare printed power; the STRUCK total carries the grant. */
  H.db(); P.fxReset();
  const stealthy = H.card("Infect", 1);
  const r = swing(stealthy, [{amt: 1, q: {kw: "stealth"}, until: "turn"}]);
  assert.equal(r.declared, stealthy.power, "declaration is untouched");
  assert.equal(r.struck, stealthy.power + 1, "and the grant lands exactly once");
});

/* ---- 4. THE TWO EXPIRIES -------------------------------------------- */

test("a 'this turn' grant expires in the end phase, for BOTH seats", {skip}, () => {
  H.db();
  let g = H.state({atkBuff: [{amt: 1, q: null, until: "turn"}]},
                  {atkBuff: [{amt: 2, q: null, until: "turn"}]},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const out = E.beginEndPhase(g, 0, H.db());
  const n = out.game;
  assert.deepEqual(n.sides[0].atkBuff, [], "the turn player's expires");
  assert.deepEqual(n.sides[1].atkBuff, [],
    "and so does the other seat's — a grant banked during your turn is not kept into theirs");
});

test("…and a 'this combat chain' grant SURVIVES the end phase", {skip}, () => {
  /* Sweeping both there makes a chain grant last a whole turn, which is
     stronger than printed. */
  H.db();
  let g = H.state({atkBuff: [{amt: 1, q: null, until: "chain"},
                             {amt: 5, q: null, until: "turn"}]},
                  {}, {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const n = E.beginEndPhase(g, 0, H.db()).game;
  assert.deepEqual(n.sides[0].atkBuff.map(b => b.amt), [1],
    "the turn-scoped one goes, the chain-scoped one stays");
});

test("the chain grant expires when the CHAIN closes — one shared body", {skip}, () => {
  const g = {sides: [{atkBuff: [{amt: 1, q: null, until: "chain"},
                                {amt: 2, q: null, until: "turn"}]},
                     {atkBuff: [{amt: 3, q: null, until: "chain"}]}]};
  const n = E.closeChainGrants(g);
  assert.deepEqual(n.sides[0].atkBuff.map(b => b.amt), [2]);
  assert.deepEqual(n.sides[1].atkBuff, [], "both seats — a chain belongs to nobody");
});

test("BOTH boards call that body — a schedule written on one board is the bug",
     {skip}, () => {
  /* v3.01's rule. The trainer closes a chain in `closeChain` AND at the
     turn boundary; judge closes it in `closeChain`. Written into one of
     them, a chain grant lasts a whole turn on the other. */
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const html = rd("index.html"), judge = rd("engine/judge.js");
  assert.equal((html.match(/closeChainGrants\(/g) || []).length, 2,
    "the trainer's two chain-close sites both call it");
  assert.match(judge, /E\.closeChainGrants\(n\)/, "and judge's does");
});

/* ---- 5. THE WHOLE CARD, AT THE TABLE -------------------------------- */

test("driven end to end: Night's Embrace pumps the swing it reacts to", {skip}, () => {
  /* THE REASON THE READ IS IN `linkPumps`. It is an ATTACK REACTION — the
     grant does not exist when the attack is declared, so a declaration-time
     read leaves the card unable to do the one thing it prints. */
  H.db(); P.fxReset();
  const W = loadData();
  const mk = () => {
    const ctr = {n: 0};
    let rng = RNG.make("standing");
    const h0 = W.HEROES.find(x => x.k === "arakni"), h1 = W.HEROES.find(x => x.k === "dorinthea");
    const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.arakni), H.db(), rng, ctr); rng = b0.rng;
    const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.dorinthea), H.db(), rng, ctr);
    return {g: J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
      heroKeys: ["arakni", "dorinthea"], rng: b1.rng, first: 0, tokSeq: ctr.n}), b0: b0.b};
  };
  const {g: g0, b0} = mk();
  const ne = b0.deck.find(c => /Night.s Embrace/i.test(c.name));
  const infect = b0.deck.find(c => /^Infect$/i.test(c.name));
  assert.ok(ne && infect, "his deck holds both");
  assert.ok(P.printedKw(infect, "stealth"), "and Infect prints Stealth");

  const run = withNE => {
    let n = {...g0, sides: g0.sides.map((s, i) => i === 0
      ? {...s, hand: [infect, ne], res: 9, ap: 1,
         deck: s.deck.filter(c => c.uid !== infect.uid && c.uid !== ne.uid)}
      : {...s, hand: [], gear: []})};
    n = J.reduce(n, {t: "play", uid: infect.uid, from: "hand", target: "hero"}, 0).state;
    for(let i = 0; i < 40 && n.step !== "reaction" && n.pend; i++){
      if(n.priority == null) break;
      const o = J.reduce(n, {t: "pass"}, n.priority); if(o.error) break; n = o.state;
    }
    if(withNE){
      const o = J.reduce(n, {t: "play", uid: ne.uid, from: "hand"}, 0);
      assert.ok(!o.error, "it is legal in the reaction step: " + o.error);
      n = o.state;
    }
    for(let i = 0; i < 40 && n.pend; i++){
      if(n.priority == null) break;
      const o = J.reduce(n, {t: "pass"}, n.priority); if(o.error) break; n = o.state;
    }
    return {dealt: 20 - n.sides[1].hp, bad: INV.errors(n).length,
            held: (n.sides[0].atkBuff || []).length};
  };
  const bare = run(false), with_ = run(true);
  assert.equal(bare.dealt, infect.power, "the bare swing deals its printed power");
  assert.equal(with_.dealt, infect.power + 1,
    "and the reaction lifts the swing it was played on by exactly its printed +1");
  assert.equal(with_.held, 1, "one grant on the side, not two");
  assert.equal(bare.bad + with_.bad, 0);
});

test("BOTH boards land the same grant, by two different routes", {skip}, () => {
  /* v3.01's rule, asked of a card rather than a schedule. The trainer
     routes every attack reaction through `effects.attackRx` (which runs
     the ops and pushes a `{k:"rx"}` layer); at the table `execute` takes
     that branch only for a card with a PUMP, so Night's Embrace — which
     now correctly carries none — falls through to the plain resolution.
     Two routes, and they must agree about what the card did. */
  H.db(); P.fxReset();
  const ne = Object.assign({}, H.card("Night’s Embrace", 3), {uid: 801});
  const infect = Object.assign({}, H.card("Infect", 1), {uid: 802});
  const base = H.state({hand: [ne], res: 9, ap: 1}, {hp: 20},
                       {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const withLink = Object.assign({}, base, {
    pend: {card: infect, by: 0, total: infect.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});

  /* the TRAINER's route */
  const rx = J.withEffects(withLink, (fx, s) => {
    const r = fx.attackRx(s, ne, {handBlockers: 0});
    return {game: r.game, _why: r.why, _pump: r.pump};
  });
  assert.equal(rx._why, null, "it resolves rather than refusing");
  assert.equal(rx._pump, 0, "it is a GRANT, not a pump onto the link");
  assert.deepEqual((rx.game || rx).sides[0].atkBuff,
                   [{amt: 1, q: {kw: "stealth"}, until: "turn"}]);

  /* the TABLE's route */
  const ex = J.withEffects(withLink, (fx, s) => ({game: fx.execute(s, ne, "hand", 0, {})}));
  assert.deepEqual((ex.game || ex).sides[0].atkBuff,
                   (rx.game || rx).sides[0].atkBuff,
                   "the two boards must not disagree about what the card did");

  /* and the wall reads it identically on both */
  const struck = st => J.withEffects(st, (fx, s) =>
    ({game: s, _t: fx.linkPumps(s, {defenders: 0, handBlockers: 0}).total}))._t;
  assert.equal(struck(rx.game || rx), infect.power + 1);
  assert.equal(struck(ex.game || ex), infect.power + 1);
});
