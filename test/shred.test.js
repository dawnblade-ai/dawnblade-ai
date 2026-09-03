/* ============================================================
   A DEFENDER SHRUNK FOR THE REST OF THE CHAIN (v3.89)

     "Target card defending an Assassin attack gets -2{d} this combat
      chain."   — SHRED, the pool's only defender debuff

   THE AMOUNT IS READ, AND THE POOL ITSELF PROVES IT: Shred prints
   **-4 / -3 / -2** across its three pitches. Every other time this rule
   has been needed the discriminator had to be synthetic (v3.32, v3.55,
   v3.74, v3.77, v3.81, v3.86, v3.88); here the card does it alone.

   ── AND BUILDING IT UNCOVERED TWO LIVE TWO-BOARD DEFECTS ─────────────

   1. `execute` routed a played attack reaction to `attackRx` only when it
      carried an UNCONDITIONAL pump (`fx.self`). SEVEN of the pool's
      twenty attack reactions carry none, so at the table they fell
      through to the plain resolution while the TRAINER routed every one
      of them. Driven, same state, same card: Ironsong Response ("Reprise
      - … target weapon attack gets +3{p}") pumped the swing by 3 on the
      trainer and by NOTHING at the table.

   2. And judge handed `execute` NO WALL AT ALL, so `attackRx` saw
      `handBlockers: 0` and REPRISE could never fire there even once the
      routing was fixed.

   Both are WEAKER than printed, so the one-sided fairness sweep is blind;
   both affected cards read `tier: full`, so coverage is blind. Only
   driving the same card at both boards sees either.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

const blk = (u, d) => ({uid: u, name: "Blk" + u, tt: "Guardian Action",
  ty: ["Guardian", "Action"], pitch: 1, cost: 1, power: 2, def: d, tx: "", kw: []});

/* An Assassin attack on the chain, Shred in hand, a wall of the caller's
   own making — which is the whole point: the wall is the caller's answer. */
function board(defs, atk){
  H.db(); P.fxReset();
  const shred = Object.assign({}, H.card("Shred", 3), {uid: 970});
  const attack = atk || Object.assign({}, H.card("Infect", 1), {uid: 971});
  const g = H.state({hand: [shred], res: 9, ap: 1}, {hp: 20, hand: defs},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  return {shred, attack, g: Object.assign({}, g, {
    pend: {card: attack, by: 0, total: attack.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]})};
}
const react = (g, shred, defs) => {
  const out = J.withEffects(g, (fx, s) =>
    ({game: fx.attackRx(s, shred, {handBlockers: defs.length, defenders: defs}).game}));
  const n = out.game || out;
  return J.openPrompt(n) || n;
};

/* ---- 1. THE READER -------------------------------------------------- */

test("all three printings read, and each keeps its own number", {skip}, () => {
  H.db();
  const got = [1, 2, 3].map(p => { P.fxReset(); return P.fxParse(H.card("Shred", p)); });
  assert.deepEqual(got.map(f => f.tier), ["full", "full", "full"]);
  assert.deepEqual(got.map(f => f.defDebuff.amt), [4, 3, 2],
    "the pool itself is the discriminator — no synthetic needed");
  got.forEach(f => assert.deepEqual(f.defDebuff.q, {g: [["assassin"]]},
    "and each carries the printed gate about the ATTACK"));
});

test("the gate uses the ONE qualifier reader", {skip}, () => {
  H.db(); P.fxReset();
  assert.deepEqual(P.fxParse(H.card("Shred", 3)).defDebuff.q, P.attackQual("assassin", ""),
    "no new vocabulary — seventh member of the family");
});

test("the restriction reads on EITHER side of the word", {skip}, () => {
  /* v3.31: "an ASSASSIN attack" is a leading class group, "an attack WITH
     STEALTH" a tail, and `attackQual` is the one reader of both. Without
     the tail capture the refusal below is DEAD CODE that reads like a
     rule (v3.67, v3.77) — the first draft had exactly that, and the
     sabotage for it came back SILENT because the fixture could not
     express the bug (v3.62). */
  P.fxReset();
  const mk = (nm, tx) => P.fxParse({name: nm, pitch: 3, cost: 0, def: 3,
    tt: "Assassin Attack Reaction", ty: ["Assassin", "Attack Reaction"], kw: [], tx});
  const T = t => "Target card defending an attack " + t + "gets -2{d} this combat chain.";
  assert.deepEqual(mk("SH tail kw", T("with stealth ")).defDebuff, {amt: 2, q: {kw: "stealth"}});
  assert.deepEqual(mk("SH none", T("")).defDebuff, {amt: 2, q: null},
    "an unqualified line is a real reading, not a refusal");
});

test("an unreadable restriction refuses the whole clause", {skip}, () => {
  /* `false` means "a restriction I cannot read" and is NOT `null`
     ("nothing restricts this"); `qualMatches` answers TRUE for a falsy
     qualifier, so collapsing them lets the card shrink a defender of any
     swing in the game (v3.31). */
  P.fxReset();
  assert.equal(P.attackTail("with crush"), null, "the premise: it cannot be read");
  const fx = P.fxParse({name: "SH unreadable", pitch: 3, cost: 0, def: 3,
    tt: "Assassin Attack Reaction", ty: ["Assassin", "Attack Reaction"], kw: [],
    tx: "Target card defending an attack with crush gets -2{d} this combat chain."});
  assert.equal(fx.defDebuff, null);
});

/* ---- 2. THE SIDE FIELD ---------------------------------------------- */

test("`defMod` is a real side field — all three ledgers carry it", {skip}, () => {
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.deepEqual(S.makeSide({id: 0}).defMod, []);
  assert.ok(S.SIDE_FIELDS.indexOf("defMod") >= 0);
  assert.match(rd("engine/wire.js"), /"defMod"/);
  assert.match(rd("engine/report.js"), /defMod: sd\.defMod/);
});

test("`defendValue` reads it — signed, keyed by UID, floored at zero", {skip}, () => {
  H.db();
  const three = blk(981, 3), other = blk(982, 3);
  /* `makeSide` takes its zones from options and its counters from
     nothing, so the field is set after — the same thing `H.state`'s own
     side helper does. */
  const sd = Object.assign(S.makeSide({id: 1}), {defMod: [{uid: 981, d: -2}]});
  assert.equal(E.defendValue(sd, three, {}), 1, "the targeted card is shrunk");
  assert.equal(E.defendValue(sd, other, {}), 3,
    "a DIFFERENT card of the same shape keeps its printed value — it was targeted, not named");
  /* FLOORED. A defender blocking for a negative number would ADD damage
     to the swing, which no printed text says. */
  const big = Object.assign(S.makeSide({id: 1}), {defMod: [{uid: 981, d: -9}]});
  assert.equal(E.defendValue(big, three, {}), 0);
  /* AND IT ACCUMULATES, or a second Shred on the same card is dropped. */
  const twice = Object.assign(S.makeSide({id: 1}), {defMod: [{uid: 981, d: -1}, {uid: 981, d: -1}]});
  assert.equal(E.defendValue(twice, three, {}), 1);
});

test("it expires when the CHAIN closes, on both seats", {skip}, () => {
  const g = {sides: [{defMod: [{uid: 1, d: -2}], atkBuff: []},
                     {defMod: [{uid: 2, d: -2}], atkBuff: []}]};
  const n = E.closeChainGrants(g);
  assert.deepEqual(n.sides[0].defMod, []);
  assert.deepEqual(n.sides[1].defMod, [],
    "and the debuff is held on the DEFENDING side — the other seat from the one that played it");
});

/* ---- 3. DRIVEN ------------------------------------------------------ */

test("one defender: it just happens, with no sheet", {skip}, () => {
  /* v3.55 — a sheet offering a single forced choice is a tap that teaches
     nothing. */
  const defs = [blk(981, 3)];
  const {g, shred} = board(defs);
  const n = react(g, shred, defs);
  assert.ok(!n.prompt, "no sheet");
  assert.deepEqual(n.sides[1].defMod, [{uid: 981, d: -2}]);
  assert.equal(E.defendValue(n.sides[1], defs[0], {}), 1, "3 printed, 1 now");
});

test("two defenders: a real sheet, and the CHOSEN one shrinks", {skip}, () => {
  const defs = [blk(981, 3), blk(982, 4)];
  const {g, shred} = board(defs);
  const n = react(g, shred, defs);
  assert.ok(n.prompt, "the sheet opens");
  assert.deepEqual(n.prompt.cards.map(c => c.uid), [981, 982],
    "the candidates are the caller's wall");
  let m = J.reduce(n, {t: "promptSel", i: 1}, n.prompt.side).state;
  m = J.reduce(m, {t: "promptConfirm"}, n.prompt.side).state;
  assert.deepEqual(m.sides[1].defMod, [{uid: 982, d: -2}], "the one that was chosen");
  assert.equal(E.defendValue(m.sides[1], defs[1], {}), 2, "4 printed, 2 now");
  assert.equal(E.defendValue(m.sides[1], defs[0], {}), 3, "and the other is untouched");
});

test("the printed GATE holds — a non-Assassin attack refuses", {skip}, () => {
  H.db(); P.fxReset();
  const defs = [blk(981, 3)];
  const wrong = Object.assign({}, H.card("Wounding Blow", 1), {uid: 990});
  const {g, shred} = board(defs, wrong);
  assert.ok(!/assassin/i.test(wrong.tt), "the control: it is not an Assassin card");
  const n = react(g, shred, defs);
  assert.deepEqual(n.sides[1].defMod, [], "nothing is shrunk");
  assert.match((n.feed || []).join(" | "), /isn't one/, "and the feed says why");
});

test("an EMPTY wall refuses rather than crashing", {skip}, () => {
  const {g, shred} = board([]);
  const n = react(g, shred, []);
  assert.deepEqual(n.sides[1].defMod, []);
  assert.match((n.feed || []).join(" | "), /nothing is defending/);
});

test("a caller that says nothing offers no target", {skip}, () => {
  /* WHICH CARDS DEFEND is the caller's answer, and the absent answer is
     the weaker, VISIBLE one (v3.24). A body that went looking for either
     board's representation is a body the other board cannot call. */
  const defs = [blk(981, 3)];
  const {g, shred} = board(defs);
  const out = J.withEffects(g, (fx, s) => ({game: fx.attackRx(s, shred, {}).game}));
  const n = out.game || out;
  assert.deepEqual(n.sides[1].defMod, []);
});

/* ---- 4. THE TWO DEFECTS BUILDING IT UNCOVERED ----------------------- */

test("a played attack reaction with NO pump still resolves onto the link", {skip}, () => {
  /* SEVEN of the pool's twenty attack reactions carry no unconditional
     pump, and `execute` routed on `fx.self` — so at the table they fell
     through to the plain resolution while the trainer routed every one of
     them to `attackRx`. */
  H.db(); P.fxReset();
  const ir = Object.assign({}, H.card("Ironsong Response", 1), {uid: 960});
  assert.equal(P.fxParse(ir).self, 0, "the premise: its pump is behind reprise");
  const wpn = Object.assign({}, H.card("Dawnblade", 0), {uid: 961});
  const mk = () => {
    const g = H.state({hand: [ir], res: 9, ap: 1}, {hp: 20},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
    return Object.assign({}, g, {
      pend: {card: wpn, by: 0, total: wpn.power || 3, ga: false, ops: [], onHit: [],
             _qCtx: {from: "weapon", atk: true}},
      stack: [{k: "atk", label: "x"}]});
  };
  const rxOf = st => ((st.stack || []).filter(l => l.k === "rx"));
  /* the TRAINER's route */
  const tr = J.withEffects(mk(), (fx, s) =>
    ({game: fx.attackRx(s, ir, {handBlockers: 1}).game}));
  /* the TABLE's route */
  const tb = J.withEffects(mk(), (fx, s) =>
    ({game: fx.execute(s, ir, "hand", 0, {handBlockers: 1})}));
  assert.deepEqual(rxOf(tr.game || tr).map(l => l.pump), [3], "the trainer pumps it");
  assert.deepEqual(rxOf(tb.game || tb).map(l => l.pump), [3],
    "and so must the table — same card, same state, same number");
});

test("its ops are held back from execute's own run", {skip}, () => {
  /* `attackRx` runs them itself, against the attack the card names.
     Running them again is VALUE-DOUBLED on the sweep's own terms — v3.63
     says exactly this about the ACTIVATED twin, and dropping the `fx.self`
     test made it true for the PLAYED one. Driven: Night's Embrace landed
     its standing grant TWICE. */
  H.db(); P.fxReset();
  const ne = Object.assign({}, H.card("Night’s Embrace", 3), {uid: 962});
  const atk = Object.assign({}, H.card("Infect", 1), {uid: 963});
  const g0 = H.state({hand: [ne], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, ne, "hand", 0, {})}));
  assert.equal((out.game || out).sides[0].atkBuff.length, 1, "exactly once");
});

test("a REACTION condition is skipped by the generic loop, not answered false",
     {skip}, () => {
  /* THE FEED IS THE OBSERVABLE WHEN THE STATE IS IDENTICAL (v3.60). The
     generic loop is given no hand-blocker count, so it can only ever
     answer `reprise` FALSE — and then say so, four lines before the
     reaction pumps the link by 3. That is the sev-2 category the player
     TRUSTS, so this drill asserts on PROSE deliberately. */
  H.db(); P.fxReset();
  const ir = Object.assign({}, H.card("Ironsong Response", 1), {uid: 964});
  const wpn = Object.assign({}, H.card("Dawnblade", 0), {uid: 965});
  const g0 = H.state({hand: [ir], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: wpn, by: 0, total: wpn.power || 3, ga: false, ops: [], onHit: [],
           _qCtx: {from: "weapon", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, ir, "hand", 0, {handBlockers: 1})}));
  const feed = ((out.game || out).feed || []).join(" | ");
  assert.doesNotMatch(feed, /condition not met \(reprise\)/,
    "the loop that cannot answer it must not answer it");
  assert.match(feed, /Reprise — 1 card from hand met the attack/,
    "the route that can, does");
});

test("RX_CONDS is ONE list with two readers", {skip}, () => {
  /* v3.71's rule for `LATE_CONDS`: two copies drift into a condition that
     is skipped and then never run. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const m = src.match(/const RX_CONDS = (\[[^\]]*\]);/);
  assert.ok(m, "the list is named");
  /* `defAtkAction` JOINED AT v3.91 — Agile Engagement asks the identical
     question of the wall that Boltyn's clause 1 does (v3.74), and this is
     the route that is given the wall. Moving this list is a deliberate
     edit: a condition IN it with no branch in the dispatcher is a gate
     that is skipped and then never run. */
  assert.deepEqual(eval(m[1]).slice().sort(), ["charged", "defAtkAction", "reprise"]);
  assert.equal((src.match(/RX_CONDS/g) || []).length, 3,
    "declared once and read exactly twice — the skip and the dispatcher");
  /* AND EVERY NAME IN IT HAS A BRANCH. Without this the list can grow a
     condition the dispatcher never answers, which is exactly the gate
     that is skipped and then never run. */
  const i = src.indexOf("const attackRx = (s, c, o) =>");
  const body = src.slice(i, src.indexOf("PIECE ONE", i));
  for(const k of eval(m[1]))
    assert.ok(body.indexOf('cond === "' + k + '"') > 0, k + " has no branch in attackRx");
});

test("judge hands `execute` the wall — reprise was dead there without it", {skip}, () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(src, /function declaredWall\(g, defSeat\)/);
  assert.match(src, /handBlockers: _wall\.handBlockers, defenders: _wall\.defenders/);
  /* and the trainer's own site names its own representation */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /attackRx\(n, c, \{handBlockers, defenders\}\)/);
});

test("driven at the table: the shrunk wall lets damage through", {skip}, () => {
  /* THE DRILL THAT WOULD HAVE CAUGHT THE LAST BUG. Everything above
     passed while `execute` threaded `handBlockers` into `attackRx` and
     DROPPED `defenders` — so the card said "nothing is defending" in
     every real game and every unit drill was green, because they called
     `attackRx` directly. v3.20's condemn lesson: drive the real entry
     point, or pin nothing. */
  const B = require("../engine/build.js");
  const G = require("../engine/game.js");
  const RNG = require("../engine/rng.js");
  const INV = require("../engine/invariants.js");
  const {loadData} = require("./helpers/extract.js");
  H.db(); P.fxReset();
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("shred-table");
  const h0 = W.HEROES.find(x => x.k === "arakni"), h1 = W.HEROES.find(x => x.k === "bravo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.arakni), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.bravo), H.db(), rng, ctr);
  const g0 = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
    heroKeys: ["arakni", "bravo"], rng: b1.rng, first: 0, tokSeq: ctr.n});

  const shred = b0.b.deck.find(c => /^Shred$/i.test(c.name));
  const infect = b0.b.deck.find(c => /^Infect$/i.test(c.name));
  const blocker = b1.b.deck.find(c => (c.def || 0) >= 3);
  assert.ok(shred && infect && blocker, "the fixture is real cards from real decks");
  assert.equal(P.fxParse(shred).defDebuff.amt, 2, "this printing shrinks by 2");

  const run = useShred => {
    let n = {...g0, sides: g0.sides.map((s, i) => i === 0
      ? {...s, hand: [infect, shred], res: 9, ap: 1,
         deck: s.deck.filter(c => c.uid !== infect.uid && c.uid !== shred.uid)}
      : {...s, hand: [blocker], gear: [],
         deck: s.deck.filter(c => c.uid !== blocker.uid)})};
    const step = () => { for(let i = 0; i < 60 && n.pend; i++){
      if(n.priority == null) break;
      const r = J.reduce(n, {t: "pass"}, n.priority); if(r.error) break; n = r.state; } };
    n = J.reduce(n, {t: "play", uid: infect.uid, from: "hand", target: "hero"}, 0).state;
    for(let i = 0; i < 40 && n.step !== "defend" && n.pend; i++){
      if(n.priority == null) break;
      const r = J.reduce(n, {t: "pass"}, n.priority); if(r.error) break; n = r.state; }
    n = J.reduce(n, {t: "defend", uid: blocker.uid}, 1).state;
    for(let i = 0; i < 40 && n.step !== "reaction" && n.pend; i++){
      if(n.priority == null) break;
      const r = J.reduce(n, {t: "pass"}, n.priority); if(r.error) break; n = r.state; }
    if(useShred){
      const o = J.reduce(n, {t: "play", uid: shred.uid, from: "hand"}, 0);
      assert.ok(!o.error, "Shred is legal in the reaction step: " + o.error);
      n = o.state;
      assert.deepEqual(n.sides[1].defMod, [{uid: blocker.uid, d: -2}],
        "and the debuff actually landed — `defenders` reached `attackRx`");
    }
    step();
    return {dealt: 20 - n.sides[1].hp, bad: INV.errors(n).length,
            left: n.sides[1].defMod};
  };
  const bare = run(false), shredded = run(true);
  assert.equal(bare.dealt, 0, `a ${infect.power}-power swing into a ${blocker.def} wall is stopped`);
  assert.equal(shredded.dealt, infect.power - (blocker.def - 2),
    "with the wall shrunk by 2, the difference gets through");
  assert.deepEqual(shredded.left, [], "and it expires when the chain closes");
  assert.equal(bare.bad + shredded.bad, 0);
});

test("BOTH attackRx routes are handed the wall — one is latent, deliberately",
     {skip}, () => {
  /* Two routes reach `attackRx`: an ACTIVATED ability (`_attackRx`,
     v3.63) and a PLAYED attack reaction. Only the second has a pool card
     printing Shred's shape today, so sabotaging the FIRST comes back
     SILENT — that is genuine LATENCY rather than a weak drill, and the
     honest instrument for a latent route is a source guard (v3.73's rule
     for the arsenal turn, one route over).

     v3.63 states the sibling rule for the powCard BUILDERS: when you add
     a flag to one, grep for the others. This is the same sentence about
     the places that FEED what they built. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const calls = src.match(/attackRx\(n, card, \{[\s\S]*?\}\);/g) || [];
  assert.equal(calls.length, 2, "exactly two routes reach it");
  calls.forEach((c, i) => assert.ok(/opts\.defenders/.test(c),
    "route " + i + " must hand in the wall, not a literal"));
});
