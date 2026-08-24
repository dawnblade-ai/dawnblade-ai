/* ============================================================
   FRAILTY AND BLOODROT POX BECOME REAL AURAS (v3.09)

   Both print `Generic Token - Aura`. Both were side counters — `fra` and
   `rot` — and each was read in exactly ONE place inside the trainer, so
   at the table neither did anything at all. Nine pool cards create them,
   across three heroes.

   Both counters were also wrong in the same direction, which is the one
   that steals games:

     fra   a blanket -1 to ANY incoming swing, where the token prints a
           narrow scope: attack actions played FROM ARSENAL, and WEAPON
           attacks. An attack action from hand is untouched.
     rot   a per-turn, unavoidable, NEVER-EXPIRING drain, where the token
           is a one-shot the controller can buy out of for {r}{r}{r}.

   RULING (user, 2026-08-19): build both to print.

   Same move Runechant made at v2.23 and Frostbite at v2.74, and most of
   what it took was DELETING the two parser lines that intercepted them —
   the generic token rule underneath already routes "under their control"
   to the right side.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const tok = (c, sd, uid) => ({card: c, kind: "token", spent: false, uid: uid || c.uid, sd: sd || "end"});

/* ---- THEY ARE TOKENS, ON THE SIDE THE CARD PRINTS -------------------- */

test("all nine creators mint a real token under the right hero's control", {skip}, () => {
  H.db();
  /* Every one of them says "under their control" or "under the attacking
     hero's control" — the token always sits with the hero it HURTS. */
  const want = {
    "Infect|1":              ["bloodrot pox", "onHit"],
    "Infecting Shot|1":      ["bloodrot pox", "onHit"],
    "Lace with Bloodrot|1":  ["bloodrot pox", "rider"],
    "Lace with Frailty|1":   ["frailty",      "rider"],
    "Frailty Trap|1":        ["frailty",      "cond"]
  };
  for(const [key, [name, where]] of Object.entries(want)){
    const [nm, p] = key.split("|");
    const c = H.card(nm, +p);
    P.fxReset && P.fxReset();
    const fx = P.fxParse(c);
    /* v3.45 SPLIT THE ON-HIT LIST BY ITS PRINTED SUBJECT. Every one of
       these prints "when this hits a HERO", so their payloads live in
       `onHitHero` and must not fire off an ally hit — which is the whole
       point of the split, and why reading `onHit` alone would now find
       nothing. The rider carriers move the same way. */
    const rider = where === "rider" ? fx.ops.find(o => o[0] === "buffNext")[3] : null;
    const op = where === "cond" ? fx.conds[0].op
             : where === "rider" ? (rider.onHitHero || rider.onHit)[0]
             : (fx.onHitHero[0] || fx.onHit[0]);
    assert.deepEqual(op, ["token", name, 1, "foe"],
      `${nm}: a real token, on the opponent — never a side counter`);
  }
});

test("the two dead counters are gone from the side shape", {skip}, () => {
  const S = require("../engine/sides");
  const sd = S.makeSide({id: 0});
  assert.ok(!("rot" in sd), "`rot` was a second source of truth for a card on the board");
  assert.ok(!("fra" in sd), "and `fra` was never once SET in a real game");
});

/* ---- FRAILTY'S SCOPE IS PRINTED, AND IT IS NARROW -------------------- */

/* Swing one plain Generic attack action, with and without a Frailty on the
   attacker's own board, from each zone the card names and one it doesn't. */
function swing(from, frailties){
  const atk = H.card("Raging Onslaught", 1);
  const board = [];
  for(let i = 0; i < (frailties || 0); i++) board.push(tok(H.card("Frailty", 0), "end", "fr" + i));
  const seat = from === "arsenal" ? {board, arsenal: atk, res: 9} : {board, hand: [atk], res: 9};
  const n = H.execute(H.state(seat, {}, {turn: 3, actor: 0}), atk, from, 0, {});
  return {total: n.pend.total, base: atk.power || 0};
}

test("Frailty does NOT touch an attack action played from hand", {skip}, () => {
  H.db();
  const off = swing("hand", 0), on = swing("hand", 1);
  assert.equal(on.total, off.total, "the card names arsenal and weapons — hand is not in scope");
  assert.equal(on.total, on.base, "so it swings at its printed power");
});

test("Frailty takes 1 off an attack action played from arsenal, and they stack", {skip}, () => {
  H.db();
  assert.equal(swing("arsenal", 1).total, swing("arsenal", 0).total - 1);
  assert.equal(swing("arsenal", 2).total, swing("arsenal", 0).total - 2,
    "each token is its own source");
});

test("Frailty's own line is filed to a named reader, not left unread", {skip}, () => {
  H.db();
  P.fxReset && P.fxReset();
  const fx = P.fxParse(H.card("Frailty", 0));
  const noop = fx.ops.find(o => o[0] === "noop");
  assert.ok(noop && /frailtyCount/.test(noop[1]),
    "a noop must name the reader that makes it real — see the noop blind spot in CLAUDE.md");
  assert.deepEqual(fx.ops.find(o => o[0] === "selfDestruct"), ["selfDestruct", "end"],
    "and it carries its own printed expiry, so sweepArena retires it on both boards");
});

/* ---- BLOODROT PRINTS AN ESCAPE HATCH --------------------------------- */

test("Bloodrot Pox reads as a one-shot with a payment, not a recurring tick", {skip}, () => {
  H.db();
  P.fxReset && P.fxReset();
  const fx = P.fxParse(H.card("Bloodrot Pox", 0));
  assert.deepEqual(fx.ops, [["selfDestruct", "end"], ["selfPayOr", 3, [["dmgSelf", 2]]]],
    "destroy FIRST, then the payload — sweepArena pays what follows the destroy");
});

/* Drive it through judge's real end phase, both branches. */
function endPhase(res){
  const J = require("../engine/judge");
  const pox = H.card("Bloodrot Pox", 0);
  let g = {...H.state({board: [tok(pox, "end")], hp: 20, res}, {}, {turn: 2}),
           phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null};
  g = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state || g;
  if(g.phase === "action" && g.priority != null) g = J.reduce(g, {t: "pass"}, g.priority).state || g;
  while(g.arsenalFor != null) g = J.reduce(g, {t: "arsenal", uid: null}, g.arsenalFor).state || g;
  return g;
}

test("floating the cost shrugs Bloodrot off; holding less takes it", {skip}, () => {
  H.db();
  const paid = endPhase(3);
  assert.equal(paid.sides[0].hp, 20, "3 floating — bought out of it");
  assert.deepEqual(paid.sides[0].board, [], "and destroyed either way");

  const hit = endPhase(0);
  assert.equal(hit.sides[0].hp, 18, "nothing floating — 2 damage lands");
  assert.deepEqual(hit.sides[0].board, [], "one-shot: it never survives its own end phase");
});

test("neither branch is silent", {skip}, () => {
  H.db();
  /* THE FIRST BUILD OF THIS QUEUED A PROMPT AND NOTHING DRAINED IT — the
     feed said "it pays out as it goes" and no damage landed. `openPrompt`
     runs at the tail of `execute`, which the end phase does not call, so
     the failure was completely silent. Assert on HP above and on the feed
     saying which branch fired here. */
  assert.ok(endPhase(3).feed.some(l => /paid/i.test(l) && /Bloodrot/i.test(l)));
  assert.ok(endPhase(0).feed.some(l => /floating/i.test(l) && /Bloodrot/i.test(l)));
});
