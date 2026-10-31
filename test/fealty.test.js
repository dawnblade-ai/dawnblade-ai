/* ============================================================
   FEALTY AND THE RIDER THAT MAKES IT (v5.53, QUEUE S15)

   Display Loyalty prints "If you control 2 or more Draconic chain links,
   this gets go again and \"When this attacks a hero, create a Fealty
   token.\"" The head read since v3.10; the rider was `fx.quotedUnread`,
   the last unread quoted ability in the pool. And Fealty read `none`:

     "Instant - Destroy this: The next card you play this turn is
      Draconic."
     "At the beginning of your end phase, if you haven't created a Fealty
      token or played a Draconic card this turn, destroy this."

   Built together or not at all (v3.72): a source that makes a token with
   no clock would leave a Fealty in the arena forever.

   AND ONE DEFECT UNDERNEATH IT. `hist.playTy` — the record "played a
   <class> card this turn" asks — was written only after the NON-attack
   branch, so no attack card ever entered it. Fealty's clock could not see
   a Draconic attack, and Briar's Star Fall and Static Shock never counted
   a Lightning attack. Drilled here, both halves.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const H = require("./helpers/judged.js");
const J = H.J;
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");

const skip = !H.hasDb() && "no cached card database";

const dracLinks = k => Array.from({length: k}, () => ({n: "x", kind: "atk", drac: true}));
const fealtyOn = sd => (sd.board || []).filter(b => b.card && b.card.name === "Fealty");
const yourTurn = (a, o) => H.state(Object.assign({res: 9, ap: 1}, a || {}), {hp: 20},
  Object.assign({turn: 3, actor: 0, turnPlayer: 0}, o || {}));

/* ---- 1. THE RIDER: at the threshold, and only at a hero --------------- */

test("Display Loyalty's rider makes a Fealty at 2 Draconic links attacking a hero, and only then", {skip}, () => {
  H.db();
  const swing = (links, target) => {
    const atk = {...H.card("Display Loyalty", 1), uid: 70};
    return H.execute({...yourTurn(), chain: dracLinks(links)}, atk, "hand", 0,
                     target ? {target} : undefined);
  };
  /* THE PAIR EITHER SIDE OF THE PRINTED THRESHOLD (v3.92) — and the gate is
     the SAME `drac2` the head reads, so the go again moves with it. The
     argument is the links BEFORE it: Display Loyalty counts its own (v5.55). */
  const below = swing(0);
  assert.equal(fealtyOn(below.sides[0]).length, 0, "one link short: no Fealty");
  assert.equal(below.pend.ga, false, "and no go again — the same gate");
  const at = swing(1);
  assert.equal(fealtyOn(at.sides[0]).length, 1, "at the threshold, attacking a hero: one Fealty");
  assert.equal(at.pend.ga, true, "beside the head's go again");
  assert.deepEqual(at.sides[0].hist.madeNames, ["fealty"], "and the turn records which token was made");
  /* AT DECLARATION, NOT ON THE HIT: the token exists before any damage. */
  assert.equal(at.chain.length, 1, "fixture: the attack has not resolved — its link is not on the strip");
  /* AND ONLY AT A HERO (v3.46): the near-miss is an ally target, where the
     head still lands and the rider does not fire. */
  const ally = swing(1, {kind: "ally", uid: "x1"});
  assert.equal(fealtyOn(ally.sides[0]).length, 0, "attacking an ally: the trigger does not fire");
  assert.equal(ally.pend.ga, true, "while the go again, which names no target, still lands");
});

/* ---- 2. THE GRANT: the next CARD, spent by it ------------------------- */

test("Fealty's ability, at the table: the next card played is Draconic, once", {skip}, () => {
  H.db();
  const fealty = H.tok("Fealty");
  const dp = {...H.card("Dragon Power", 1), uid: 71};           /* Ninja; "if it is Draconic, +3{p}" */
  const dp2 = {...H.card("Dragon Power", 1), uid: 72};
  let g = yourTurn({hand: [dp, dp2], ap: 2,
                    board: [{uid: "tk1", kind: "token", card: {...fealty, uid: "tk1"}, spent: false, sd: "end"}]});
  g = {...g, phase: "action", step: "layer", priority: 0};
  assert.equal(J.legal(g, {t: "activate", uid: "tk1"}, 0), null, "Fealty's ability is offered at the table");
  let out = J.reduce(g, {t: "activate", uid: "tk1"}, 0);
  assert.equal(out.error, null);
  g = out.state;
  assert.equal(fealtyOn(g.sides[0]).length, 0, "its cost destroyed it");
  assert.equal(g.sides[0].dracCard, true, "and the grant waits for the next card");
  assert.equal(g.sides[0].ap, 2, "an Instant costs no action point (CR 8.1.6)");

  const first = H.execute(g, dp, "hand", 0);
  assert.equal(first.pend.total, dp.power + 3, "a Ninja card played next IS Draconic — Dragon Power's +3");
  assert.equal(first.sides[0].dracCard, false, "and the card that took the grant spent it");
  assert.ok(first.sides[0].hist.playTy.some(ty => ty.includes("draconic")),
    "the turn's play record says a Draconic card was played");
  /* THE SPEND IS THE POINT (v4.06): the second card is plain. */
  const second = H.execute({...first, pend: null, chain: []}, dp2, "hand", 0);
  assert.equal(second.pend.total, dp2.power, "the next one is not Draconic — the grant was single-shot");
});

test("the grant is the next CARD — a non-attack takes it; a weapon swing does not", {skip}, () => {
  H.db();
  /* A NON-ATTACK TAKES IT. The printed taker is any card played, where
     `dracNext` waits for an attack. */
  const press = {...H.card("Lightning Press", 1), uid: 73};
  const g = H.runOps(yourTurn(), [["dracCard", 1]], "Fealty — ability");
  const after = H.execute(g, press, "hand", 0);
  assert.equal(after.sides[0].dracCard, false, "an instant played next spends it");
  assert.deepEqual(after.sides[0].hist.playTy.slice(-1)[0], ["lightning", "instant", "draconic"],
    "and was played as a Draconic card");
  const filed = after.sides[0].grave.find(c => c.uid === 73);
  assert.ok(filed && !("_drac" in filed), "filed WITHOUT the stamp — a new object in a new zone");

  /* A WEAPON IS ACTIVATED, NOT PLAYED (v5.05) — the near-miss. */
  const blade = {...H.card("Searing Emberblade", 0), uid: "gp9", cost: 2};
  const swung = H.execute(H.runOps(yourTurn(), [["dracCard", 1]], "Fealty — ability"), blade, "weapon", 0);
  assert.equal(swung.sides[0].dracCard, true, "a weapon swing leaves the grant waiting");
});

test("a card Fealty made Draconic satisfies a Draconic QUALIFIER — Fire Tenet's next Draconic attack", {skip}, () => {
  H.db();
  /* "Your next Draconic attack this combat chain gets +1{p}" is a qualified
     grant matched by `qualMatches` at the play. Fry is a Lightning attack:
     plain, it is not the attack the grant is waiting for. */
  const fry = {...H.card("Fry", 1), uid: 76};
  const tenet = g => H.runOps(g, [["buffNext", 1, {g: [["draconic"]]}]], "Fire Tenet: Strike First");
  const plain = H.execute(tenet(yourTurn()), fry, "hand", 0);
  const made  = H.execute(H.runOps(tenet(yourTurn()), [["dracCard", 1]], "Fealty — ability"), fry, "hand", 0);
  assert.equal(plain.pend.total, fry.power, "the near-miss: a plain Lightning attack does not take it");
  assert.equal(made.pend.total, fry.power + 1, "made Draconic by Fealty, it does");
  /* AND ITS RESOLVED LINK IS A DRACONIC CHAIN LINK — the number Fai's
     discount, every `dracN` gate and Mounting Anger's bound read. */
  const link = g => { const r = H.fx(g, (f, m) => f.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true}));
                      return P.dracLinks((r.game || r).chain); };
  assert.equal(link(plain), 0, "a plain Fry's link is not Draconic");
  assert.equal(link(made), 1, "Fealty's Fry is");
});

test("an unspent grant expires with the turn", {skip}, () => {
  H.db();
  const g = H.runOps(yourTurn(), [["dracCard", 1]], "Fealty — ability");
  assert.equal(g.sides[0].dracCard, true, "fixture: the grant is live");
  const end = E.beginEndPhase(g, 0, H.db()).game;
  assert.equal(end.sides[0].dracCard, false, "\"this turn\" — swept in step (8) with its siblings");
});

/* ---- 3. THE CLOCK ------------------------------------------------------ */

test("Fealty's clock: destroyed unless a Fealty was created or a Draconic card played this turn", {skip}, () => {
  H.db();
  const fealty = H.tok("Fealty");
  const withFealty = hist => {
    const g = yourTurn({board: [{uid: "tk2", kind: "token", card: {...fealty, uid: "tk2"}, spent: false, sd: "end"}]});
    g.sides[0] = {...g.sides[0], hist: {...g.sides[0].hist, ...hist}};
    return E.beginEndPhase(g, 0, H.db()).game.sides[0];
  };
  assert.equal(fealtyOn(withFealty({})).length, 0, "neither happened: it is destroyed");
  assert.equal(fealtyOn(withFealty({madeNames: ["fealty"]})).length, 1, "a Fealty was created this turn: it stays");
  assert.equal(fealtyOn(withFealty({playTy: [["draconic", "ninja", "action", "attack"]]})).length, 1,
    "a Draconic card was played: it stays");
  /* THE NEAR-MISSES: another token made, and a card of another class. */
  assert.equal(fealtyOn(withFealty({madeNames: ["gold"]})).length, 0, "a different token does not spare it");
  assert.equal(fealtyOn(withFealty({playTy: [["ninja", "action", "attack"]]})).length, 0,
    "nor does a non-Draconic card");
  assert.deepEqual(P.fxParse(fealty).ops.find(o => o[0] === "selfDestruct"),
    ["selfDestruct", "end", {spare: [{made: "self"}, {playedCls: "draconic"}]}],
    "the clock is read off the printed line, both reasons");
});

/* ---- 4. AN ATTACK IS A CARD PLAYED ------------------------------------- */

test("an attack card enters the play record: a Draconic attack keeps Fealty, a Lightning attack lifts Star Fall", {skip}, () => {
  H.db();
  /* THE DEFECT UNDER THE CLOCK: the attack branch returned before the only
     write of `hist.playTy`. Driven through `execute`, then the end phase. */
  const fealty = H.tok("Fealty");
  const brand = {...H.card("Brand with Cinderclaw", 1), uid: 74};
  let g = yourTurn({board: [{uid: "tk3", kind: "token", card: {...fealty, uid: "tk3"}, spent: false, sd: "end"}]});
  g = H.execute(g, brand, "hand", 0);
  assert.ok(g.sides[0].hist.playTy.some(ty => ty.includes("draconic") && ty.includes("attack")),
    "a Draconic ATTACK is in the record");
  const end = E.beginEndPhase({...g, pend: null}, 0, H.db()).game;
  assert.equal(fealtyOn(end.sides[0]).length, 1, "so Fealty survives a turn of Draconic attacks");

  /* STAR FALL: "If you've played a Lightning card this turn, this card's
     attacks get +1{p} and go again." Fry is a Lightning ATTACK. */
  const fry = {...H.card("Fry", 1), uid: 75};
  const star = {...H.card("Star Fall", 0), uid: "gp8", cost: 1};
  const bare = H.execute(yourTurn(), star, "weapon", 0);
  let h = H.execute(yourTurn({ap: 2}), fry, "hand", 0);
  h = H.execute({...h, pend: null}, star, "weapon", 0);
  assert.equal(bare.pend.ga, false, "fixture: no Lightning card played, no go again");
  assert.equal(h.pend.ga, true, "after a Lightning attack: go again");
  assert.equal(h.pend.total, bare.pend.total + 1, "and +1{p}");
});
