/* ============================================================
   A NON-ATTACK THAT PUMPS "TARGET ATTACK" LANDS ON ITS TARGET (v5.03)

     "Target attack action card with cost 1 or less gets +3{p}."
                                     — LIGHTNING PRESS, Briar's (an Instant)
     "Instant - {t}: Target attack gets +1{p}."
                                     — CONCEALED OBJECT, Lyath's

   Neither is an attack reaction, so `execute` never routed them through
   `attackRx`: the pump fell to a bare `buffNext`, the printed TARGET and
   its qualifier were dropped, and it landed on whatever attacked next.
   Read off a Briar feed: Fry (the legal target, on the chain) stayed at 3
   and Scorpio — a WEAPON, which the qualifier excludes — swung for +3 on
   the next link. Played with no attack at all it still queued the pump,
   for a target that could never have been declared.

   Every record read `tier: full` (the clause IS consumed) and the drift is
   in both directions at once, so neither coverage nor the one-sided sweep
   could see it — only reading a feed did.

   `effects.pumpTargetWhy` is the one reader, asked before anything moves
   by judge's play branch, `rxTargetWhy` (every activation route), and the
   trainer's `tryPlay`, `activateInstant` and `playAtSpeed`. The resolution
   is `runOps`' `self` case, which lands on `pend.total` for the seat's own
   attack and nowhere else (v3.99).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const B = require("../engine/build");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* seat `atkSeat` has `atk` on the chain, seat 0 holds priority in the
   reaction step with `hand` */
function window(atk, hand, atkSeat, extra){
  const by = atkSeat == null ? 0 : atkSeat;
  const a = atk ? {...atk, uid: "ATK"} : null;
  return Object.assign({...H.state({hand, res: 6, ap: 0, name: "Briar"}, {hp: 20, name: "Bob"}, {turn: 3, actor: 0}),
    phase: "action", step: atk ? "reaction" : "layer", turnPlayer: by, attacker: atk ? by : null, priority: 0,
    passed: [false, false], firstPlayer: 0, round: 1, over: null, stack: [], chain: [],
    chainCards: a ? [a] : [],
    pend: a ? {card: a, from: "hand", by, total: a.power || 0, ga: false, ops: [], onHit: []} : null},
    extra || {});
}
const lp = p => ({...H.card("Lightning Press", p || 1), uid: "LP"});

test("fixtures: the qualifier really separates the two attacks, and the press really prints 3", {skip}, () => {
  H.db();
  const blow = H.card("Wounding Blow", 3), big = H.card("Raging Onslaught", 1);
  assert.ok(blow.cost <= 1 && P.isAttack(blow), "Wounding Blow must be a legal target (cost 1 or less)");
  assert.ok(big.cost > 1 && P.isAttack(big), "Raging Onslaught must NOT be (cost 2 or more)");
  const fx = P.fxParse(lp(1));
  assert.equal(fx.self, 3, "red Lightning Press prints +3{p}");
  assert.ok((lp(1).ty || []).includes("Instant"), "and it is an Instant (the structured array, v2.39)");
  assert.ok(!P.isAR(lp(1)), "premise: Lightning Press is not an attack reaction — that is the whole defect");
});

test("AT THE TABLE: Lightning Press with a legal target on the chain pumps THAT attack, now", {skip}, () => {
  H.db();
  const blow = H.card("Wounding Blow", 3);
  const g = window(blow, [lp(1)]);
  assert.equal(J.legal(g, {t: "play", uid: "LP", from: "hand"}, 0), null, "a legal target is on the chain");
  const n = H.drain(J.reduce(g, {t: "play", uid: "LP", from: "hand"}, 0).state);
  assert.equal(n.pend.total, blow.power + 3, "the +3 landed on the TARGETED attack");
  assert.equal(n.sides[0].buffNext || 0, 0, "…and nothing waits for whatever attacks next");
  assert.ok(!(n.sides[0].buffQ || []).length, "…in either single-shot grant");
});

test("AT THE TABLE: with no attack on the chain it is REFUSED before it leaves the hand", {skip}, () => {
  H.db();
  const g = window(null, [lp(1)]);
  const why = J.legal(g, {t: "play", uid: "LP", from: "hand"}, 0);
  assert.match(String(why), /^Lightning Press targets an attack you control — none is on the chain$/);
  const out = J.reduce(g, {t: "play", uid: "LP", from: "hand"}, 0);
  assert.notEqual(out.error, undefined, "`reduce` agrees with `legal`");
  assert.ok(g.sides[0].hand.some(c => c.uid === "LP"), "the card never left the hand");
});

test("AT THE TABLE: the printed QUALIFIER refuses an attack it does not name", {skip}, () => {
  H.db();
  const g = window(H.card("Raging Onslaught", 1), [lp(1)]);
  assert.match(String(J.legal(g, {t: "play", uid: "LP", from: "hand"}, 0)), /Lightning Press/,
    "a cost-2 attack is not a target of 'cost 1 or less'");
});

test("AT THE TABLE: the OPPONENT's attack is not offered, and the refusal names it", {skip}, () => {
  H.db();
  const g = window(H.card("Wounding Blow", 3), [lp(1)], 1);
  assert.match(String(J.legal(g, {t: "play", uid: "LP", from: "hand"}, 0)),
    /^Lightning Press targets an attack you control — Wounding Blow isn't yours$/,
    "pumping the attack that is hitting you is the dominated half of the choice (instant-pump-own-attack-only)");
});

test("THE TRAINER'S INSTANT DOOR: `playAtSpeed` refuses before the payment and resolves onto the link", {skip}, () => {
  H.db();
  const blow = H.card("Wounding Blow", 3);
  const none = J.withEffects(window(null, [lp(1)]), (fx, n) => fx.playAtSpeed(n, lp(1), "hand", {window: "instant"}));
  assert.match(String(none.why), /none is on the chain/, "no target, no play");
  assert.equal(none.game.sides[0].res, 6, "…and nothing was paid for it");
  const yes = J.withEffects(window(blow, [lp(1)]), (fx, n) => fx.playAtSpeed(n, lp(1), "hand", {window: "attack-reaction"}));
  assert.equal(yes.why, null);
  assert.equal(yes.game.pend.total, blow.power + 3, "the trainer's door lands it on the same link");
  assert.equal(yes.game.sides[0].buffNext || 0, 0);
});

test("CONCEALED OBJECT: the {t} is not paid when there is nothing to pump", {skip}, () => {
  H.db();
  const co = {...H.card("Concealed Object", 3), uid: 9705};
  const g = window(null, [], 0, {});
  g.sides[0] = {...g.sides[0], board: [{uid: 9705, kind: "token", card: co, spent: false}]};
  const why = J.legal(g, {t: "activate", uid: 9705}, 0);
  assert.match(String(why), /targets an attack you control — none is on the chain/);
  const out = J.reduce(g, {t: "activate", uid: 9705}, 0);
  assert.notEqual(out.error, undefined);
  assert.equal(g.sides[0].board[0].spent, false, "the permanent is still untapped");
});

test("THE FAMILY: the readers this asks are exactly the instant pumps the pool prints", {skip}, () => {
  /* Censused across every pool record AND every powCard the builders make
     (`equipPiece`, `boardPow`): a non-attack, non-reaction source whose
     parse carries a `self` pump. Two cards, and Raydn / Titan's Fist only
     because `boardPow` reads a weapon's swing line, which no board entry
     can ever be. Pinned as a SET so a third arriving is a decision. */
  const db = H.db();
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const C = require("../engine/cards.js");
  const names = new Set(), seen = new Set();
  let uid = 970000;
  for(const r of raw){
    const m = C.mapDbCard(r);
    const c = C.resolveEntry(db, {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(!c) continue;
    const k = c.name + "|" + c.pitch;
    if(seen.has(k)) continue;
    seen.add(k);
    c.uid = ++uid;
    const cands = [c];
    const gr = {...c}; B.equipPiece(gr); if(gr.powCard) cands.push(gr.powCard);
    const bp = B.boardPow({uid: ++uid, card: c});
    if(bp && !P.isWeapon(c)) cands.push(bp);
    for(const x of cands){
      if(P.isAttack(x) || P.isAR(x) || x._attackRx) continue;
      if((P.fxParse(x).self || 0) > 0) names.add(x.name);
    }
  }
  assert.deepEqual([...names].sort(), ["Concealed Object — ability", "Lightning Press"]);
});

test("EVERY DOOR ASKS IT, as a whole conditional (v4.55: an identifier alone survives `&& false`)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const judge = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const tp = html.slice(html.indexOf("const tryPlay = "), html.indexOf("const confirmPay"));
  assert.ok(tp.length > 1000, "tryPlay anchors moved");
  assert.match(tp, /\{ const _pw = DawnEffects\.pumpTargetWhy\(s, card, actorOf\(s\)\); if\(_pw\) return L\(s, _pw \+ "\."\); \}/,
    "the trainer's play door asks it before anything is paid");
  const ai = html.slice(html.indexOf("const activateInstant = "), html.indexOf("\n  const ", html.indexOf("const activateInstant = ") + 30));
  assert.ok(ai.length > 200, "activateInstant anchors moved");
  assert.match(ai, /\{ const _pw = DawnEffects\.pumpTargetWhy\(s, card, actorOf\(s\)\); if\(_pw\) return L\(s, _pw \+ "\."\); \}/,
    "the trainer's instant-ability door asks it, before the ability is paid");
  assert.match(judge, /\{ const pw = E\.pumpTargetWhy\(g, c, seat\); if\(pw\) return pw; \}/, "judge's play branch asks it");
  assert.match(judge, /if\(want !== "attack-reaction"\) return E\.pumpTargetWhy\(g, ab, seat\);/,
    "and every activation route, through `rxTargetWhy`");
  assert.match(efx, /\{ const pw = pumpTargetWhy\(s, c, actorOf\(s\)\); if\(pw\) return \{game: s, dv: 0, why: pw\}; \}/,
    "`playAtSpeed` asks it");
  /* AND `execute` RESOLVES IT ONTO THE LINK, never into `buffNext` */
  assert.match(efx, /const _tw = pumpTargetWhy\(n, card, actorOf\(n\)\);\s*if\(_tw\) n = L\(n, `\$\{_tw\} — nothing to pump\.`\);\s*else n = runOps\(n, \[\["self", fx\.self\]\], card\.name\);/);
});
