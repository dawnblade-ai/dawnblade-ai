/* ============================================================
   ARCANE DAMAGE — the one place a hero takes it. (v2.74)

   Before this version there was no such place, and the cost was FOUR dead
   mechanics rather than one. Driven against the pre-fix engine, five
   arcane damage through arcane ward 3 AND Pyroglyphic shield 3 dealt
   five: `awd` and `arcShield` were written by the parser, stored on the
   side, rendered as pips on the hero row — and never once read. Arcane
   Barrier (21 pieces of iron across ALL FIFTEEN heroes) and Spellvoid
   were filed `noop` with the reason "stops arcane damage — the dummy
   throws only fists", another fact about the training prop that expired
   in v2.71. Thirty pool cards deal arcane damage across six heroes and
   nothing could stop any of it.

   NO TOOL IN THIS PROJECT COULD SEE THAT. Every affected card reads tier
   `full` — the text was read correctly and then never charged — and the
   fairness sweep is deliberately one-sided towards cards that are too
   STRONG, while this was every defence being too weak.

   RULINGS (user, 2026-08-14):
     Arcane Barrier N — triggers when a hero is THREATENED with arcane
       damage. Its controller is prompted to pay N; if they do, N is
       subtracted. The payment is the FULL N even when that exceeds the
       damage (Arcane Barrier 2 costs 2 to prevent 1). The piece survives.
       EVERY instance triggers.
     Spellvoid N — same trigger, but the cost is the permanent: destroy it
       and subtract N. No resources.

   ASSERTIONS ARE ON LIFE, RESOURCES AND ZONES. Never on log prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const GM = require("../engine/game.js");
const PR = require("../engine/prompts.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");
const { loadData } = require("./helpers/extract.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";

let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const gear = (nm, uid) => ({...C.resolveEntry(DB(), {name: nm, p: 0, code: null, q: 1}), uid});

function ctx(){
  return {
    L: (s, m) => ({...s, log: [m, ...(s.log || [])], feed: [...(s.feed || []), m]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => ({runeDmg: 1}), bFoe: () => ({runeDmg: 1}), built: {runeDmg: 1},
    db: DB(), dummyDefence: s => ({n: s, note: ""}),
    foe: s => s.sides[1 - (s.actor || 0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false, mkRune: s => s, openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "action", winCheck: s => s
  };
}
const side = o => Object.assign({
  name: "them", hp: 20, res: 0, ap: 1, amp: 0, ward: 0, awd: 0, arcShield: 0,
  hand: [], deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], gear: [],
  counters: {}, weaponUsed: {}, hist: {}
}, o || {});
const game = (a, b) => ({sides: [side(a), side(b)], actor: 0, turn: 2,
  log: [], feed: [], chain: [], hitSeq: 0, promptQ: [], rng: RNG.make("arc")});

/* Five arcane at seat 1, and whatever prompt that leaves queued. */
const bolt = (defender, amount) => {
  const {runOps} = E.makeEffects(ctx());
  return runOps(game({}, defender), [["arcane", amount == null ? 5 : amount]], "Ice Bolt");
};
/* …and the whole loop: build the sheet, choose, apply, run the ops at the
   ASKED side, which is what the trainer's promptConfirm does. */
function answer(n, pickIdx){
  const {runOps} = E.makeEffects(ctx());
  const live0 = PR.buildPrompt(n, n.promptQ[0]);
  const live = pickIdx.reduce((p, i) => PR.promptToggleSel(p, i), live0);
  const r = PR.applyPrompt(n, live);
  let g = r.game;
  g = {...g, actor: live.side};
  if(r.pay > 0){
    const sides = g.sides.slice();
    sides[live.side] = {...sides[live.side], res: Math.max(0, sides[live.side].res - r.pay)};
    g = {...g, sides};
  }
  g = runOps(g, r.ops, "Ice Bolt");
  return {game: {...g, actor: 0}, live, r};
}

/* ---- THE DEAD MECHANICS, NOW ALIVE ------------------------------------ */

test("arcane ward is a POOL, and it drains", {skip}, () => {
  const out = bolt({awd: 3});
  assert.equal(out.sides[1].hp, 18, "5 arcane, 3 warded — before v2.74 this dealt the full 5");
  assert.equal(out.sides[1].awd, 0, "the pool is spent");
  const big = bolt({awd: 9});
  assert.equal(big.sides[1].hp, 20, "nothing gets through");
  assert.equal(big.sides[1].awd, 4, "and only what was needed is spent");
});

test("Pyroglyphic's shield is PER SOURCE, and does not drain", {skip}, () => {
  const out = bolt({arcShield: 3});
  assert.equal(out.sides[1].hp, 18);
  assert.equal(out.sides[1].arcShield, 3,
    "it stands against EVERY source — draining it would make it one pool, which is the " +
    "distinction its own ruling turns on");
});

test("the free shield is spent BEFORE the draining pool", {skip}, () => {
  const out = bolt({arcShield: 3, awd: 3});
  assert.equal(out.sides[1].hp, 20, "3 shielded, the remaining 2 warded");
  assert.equal(out.sides[1].awd, 1,
    "only 2 of the ward is spent. Reversing the order would burn a limited pool while a " +
    "renewable prevention sat unused — strictly worse for the defender, and nothing asks for it");
  assert.equal(out.sides[1].arcShield, 3);
});

/* ---- READING THE TWO KEYWORDS ----------------------------------------- */

test("Arcane Barrier and Spellvoid are read off REAL cards, with their numbers", {skip}, () => {
  const hood = gear("Nullrune Hood", "g1");
  assert.deepEqual(hood.kw, ["Arcane Barrier 1"], "fixture drifted");
  assert.equal(P.arcaneBarrier(hood), 1);
  assert.equal(P.spellvoid(hood), 0, "it has no spellvoid — the two keywords are distinct");

  const wellies = gear("Aetherstorm Wellingtons", "g2");
  assert.equal(P.arcaneBarrier(wellies), 2, "the NUMBER is read, not assumed to be 1");

  const halo = gear("Halo of Illumination", "g3");
  assert.equal(P.spellvoid(halo), 2);
  assert.equal(P.arcaneBarrier(halo), 0);
});

test("an X amount is REFUSED, not guessed", {skip}, () => {
  const mask = gear("Mask of the Swarming Claw", "g4");
  assert.deepEqual(mask.kw, ["Arcane Barrier 1", "Spellvoid X"], "fixture drifted");
  assert.equal(P.spellvoid(mask), null,
    "'Spellvoid X, where X is the number of chain links you control' is dynamic, and the " +
    "chain belongs to whoever is ATTACKING rather than to the frozen hero — guessing it " +
    "would be inventing a rule");
  assert.equal(P.arcaneBarrier(mask), 1, "and it keeps the barrier it prints");
  const soaks = P.arcaneSoaks({gear: [mask]});
  assert.deepEqual(soaks.map(s => s.kind), ["barrier"], "only the readable half is offered");
});

test("a DESTROYED piece protects nothing", {skip}, () => {
  const dead = {...gear("Nullrune Hood", "g1"), destroyed: true};
  assert.deepEqual(P.arcaneSoaks({gear: [dead]}), [],
    "equipment WEARS rather than leaving, so a spent piece still sits in sd.gear");
  const out = bolt({gear: [dead], res: 3});
  assert.equal(out.sides[1].hp, 15, "and the damage lands in full");
  assert.equal((out.promptQ || []).length, 0, "with nothing to ask");
});

/* ---- THE DEFERRAL ----------------------------------------------------- */

test("a soak DEFERS the damage — it does not land and then get refunded", {skip}, () => {
  const out = bolt({gear: [gear("Nullrune Hood", "g1")], res: 3});
  assert.equal(out.sides[1].hp, 20,
    "prompts are drained AFTER the action resolves, so damage applied at its own site " +
    "would arrive before the hero was ever asked — the prevention would come after the " +
    "damage it prevents");
  assert.equal(out.promptQ.length, 1);
  assert.equal(out.promptQ[0].tag, "soak");
  assert.equal(out.promptQ[0].side, 1, "addressed to the THREATENED hero, not the attacker");
  assert.equal(out.promptQ[0].amount, 5);
});

test("declining takes the full hit", {skip}, () => {
  const {game: g, r} = answer(bolt({gear: [gear("Nullrune Hood", "g1")], res: 3}), []);
  assert.equal(g.sides[1].hp, 15, "all 5");
  assert.equal(g.sides[1].res, 3, "and nothing is spent");
  assert.equal(r.pay, 0);
});

test("paying an Arcane Barrier prevents its number and charges its cost", {skip}, () => {
  const {game: g} = answer(bolt({gear: [gear("Nullrune Hood", "g1")], res: 3}), [0]);
  assert.equal(g.sides[1].hp, 16, "5 arcane, 1 prevented");
  assert.equal(g.sides[1].res, 2, "1 resource spent");
  assert.equal(g.sides[1].gear.filter(x => !x.destroyed).length, 1,
    "the piece SURVIVES — that is what separates a barrier from a spellvoid");
});

test("EVERY instance triggers — two pieces are two separate offers", {skip}, () => {
  const n = bolt({gear: [gear("Nullrune Hood", "g1"), gear("Nullrune Robe", "g2")], res: 3});
  assert.equal(n.promptQ[0].options.length, 2, "both are offered");
  const {game: g} = answer(n, [0, 1]);
  assert.equal(g.sides[1].hp, 17, "2 prevented");
  assert.equal(g.sides[1].res, 1, "2 paid");
});

test("Spellvoid destroys the permanent and costs no resources", {skip}, () => {
  const n = bolt({gear: [gear("Halo of Illumination", "gh")], res: 0});
  assert.equal(n.promptQ[0].options[0].cost, 0,
    "always affordable — the cost is the iron, not an {r}");
  const {game: g, r} = answer(n, [0]);
  assert.equal(g.sides[1].hp, 17, "2 prevented");
  assert.equal(g.sides[1].res, 0);
  assert.ok(r.ops.some(o => o[0] === "destroyGear"), "the piece is destroyed");
  assert.equal(g.sides[1].gear.filter(x => !x.destroyed).length, 0);
});

test("a barrier costs its FULL number even to prevent less", {skip}, () => {
  /* RULING: "Arcane Barrier 2 would cost 2 to prevent 1." Charging only
     what was used would make the keyword strictly better than printed. */
  const n = bolt({gear: [gear("Aetherstorm Wellingtons", "g1")], res: 4}, 1);
  const {game: g} = answer(n, [0]);
  assert.equal(g.sides[1].hp, 20, "the 1 damage is fully prevented");
  assert.equal(g.sides[1].res, 2, "and 2 was paid for it, not 1");
});

test("a hero cannot select more barriers than they can reach", {skip}, () => {
  const n = bolt({gear: [gear("Nullrune Hood", "g1"), gear("Nullrune Robe", "g2"),
                         gear("Nullrune Boots", "g3")], res: 1});
  let live = PR.buildPrompt(n, n.promptQ[0]);
  assert.equal(live.options.length, 3, "all three trigger");
  assert.equal(live.avail, 1);
  live = [0, 1, 2].reduce((p, i) => PR.promptToggleSel(p, i), live);
  assert.equal(live.sel.length, 1,
    "without a budget check the trainer's Math.max(0, res - pay) would clamp the payment " +
    "to zero and soak three for free");
});

test("pitching is on demand — a hand counts toward what a hero can reach", {skip}, () => {
  const n = bolt({gear: [gear("Nullrune Hood", "g1")], res: 0,
                  hand: [{uid: "h1", name: "blue thing", pitch: 3}]});
  assert.equal(n.promptQ.length, 1,
    "a hero hit on someone else's turn has no other way to find an {r} (RULING 2026-08-01)");
  /* Read off the BUILT sheet, not the queued spec: the spec deliberately
     carries no `avail`, because a figure frozen at queue time is stale by
     the second of three Runechant soaks. See the drill below. */
  assert.equal(PR.buildPrompt(n, n.promptQ[0]).avail, 3);
  const bare = bolt({gear: [gear("Nullrune Hood", "g1")], res: 0});
  assert.equal((bare.promptQ || []).length, 0, "with nothing to reach, nothing is asked");
  assert.equal(bare.sides[1].hp, 15, "and the damage lands rather than hanging");
});

test("no soakable iron means no sheet AND no lost damage", {skip}, () => {
  const out = bolt({gear: [gear("Ironrot Helm", "g1")], res: 5});
  assert.equal((out.promptQ || []).length, 0, "Ironrot prints neither keyword");
  assert.equal(out.sides[1].hp, 15,
    "the hit must land immediately — a deferral with no prompt to drain it is damage that " +
    "never arrives");
});

/* ---- EACH RUNECHANT IS ITS OWN SOURCE --------------------------------- */

test("three Runechants are three separate threats, not one pooled hit", {skip}, () => {
  const {execute} = E.makeEffects(ctx());
  const tokRune = i => ({card: {...C.resolveEntry(DB(), {name: "Runechant", p: 0, code: null, q: 1}), uid: "r" + i},
                         kind: "aura", spent: false, uid: "r" + i});
  const atk = {...C.resolveEntry(DB(), {name: "Vexing Malice", p: 3, code: null, q: 1}), uid: "a1"};
  const g = game({res: 9, hand: [atk], board: [tokRune(1), tokRune(2), tokRune(3)]},
                 {gear: [gear("Nullrune Hood", "g1")], res: 9});
  const out = execute(g, atk, "hand", 0);
  assert.equal(P.runeCount(out.sides[0]), 0, "all three pop");
  assert.equal((out.promptQ || []).filter(p => p.tag === "soak").length, 3,
    "Pyroglyphic prevents per SOURCE and Arcane Barrier triggers per threat, so three " +
    "Runechants are three 1-point threats a hero may answer three times. Pooling them " +
    "would push more damage through than the cards print.");
  assert.deepEqual((out.promptQ || []).filter(p => p.tag === "soak").map(p => p.amount), [1, 1, 1]);
});

/* ---- SEAT 1 CAN ANSWER ------------------------------------------------ */

test("seat 1's soak policy spends spellvoid free, and never overpays", {skip}, () => {
  const opts = [
    {uid: "a", name: "Halo", kind: "spellvoid", amount: 2, cost: 0},
    {uid: "b", name: "Hood", kind: "barrier", amount: 1, cost: 1}
  ];
  const sel = E.soakPolicy({amount: 5, avail: 9, options: opts}, {hp: 20});
  assert.deepEqual(sel, [0, 1], "both are worth taking against 5 incoming");

  /* A barrier that costs more than the damage is worth is declined... */
  const dear = [{uid: "c", name: "Wellies", kind: "barrier", amount: 2, cost: 2}];
  assert.deepEqual(E.soakPolicy({amount: 1, avail: 9, options: dear}, {hp: 20}), [],
    "2 resources to stop 1 damage is a bad deal, and a seat that takes every deal drains " +
    "itself — the same lesson that made both seats block 41 of 41 attacks");
  /* …unless it is lethal, where nothing in hand is worth more than living. */
  assert.deepEqual(E.soakPolicy({amount: 1, avail: 9, options: dear}, {hp: 1}), [0],
    "at lethal it pays whatever it takes");
});

test("seat 1's policy stops once the damage is covered, and respects its budget", {skip}, () => {
  const three = [
    {uid: "a", name: "A", kind: "barrier", amount: 1, cost: 1},
    {uid: "b", name: "B", kind: "barrier", amount: 1, cost: 1},
    {uid: "c", name: "C", kind: "barrier", amount: 1, cost: 1}
  ];
  assert.deepEqual(E.soakPolicy({amount: 2, avail: 9, options: three}, {hp: 20}), [0, 1],
    "two is enough for 2 damage — the third would be paid for nothing");
  assert.deepEqual(E.soakPolicy({amount: 3, avail: 1, options: three}, {hp: 20}), [0],
    "and it never spends what it cannot reach");

  /* THE "ALREADY COVERED" GUARD NEEDS ITS OWN CASE, and finding that out
     is what the sabotage pass is for: deleting the guard broke nothing
     above, because for BARRIERS the bad-deal check happens to catch the
     same thing. Spellvoid skips that check entirely — it costs no
     resources — so only this shape holds the guard. Destroying a second
     piece of iron to prevent damage that is already fully prevented is
     pure loss, and it is the shape that makes a seat spend everything on
     everything. */
  const twoVoids = [
    {uid: "a", name: "Halo", kind: "spellvoid", amount: 2, cost: 0},
    {uid: "b", name: "Ebon", kind: "spellvoid", amount: 2, cost: 0}
  ];
  assert.deepEqual(E.soakPolicy({amount: 2, avail: 9, options: twoVoids}, {hp: 20}), [0],
    "the first covers all 2 — the second would destroy a piece of iron for nothing");
  assert.deepEqual(E.soakPolicy({amount: 4, avail: 9, options: twoVoids}, {hp: 20}), [0, 1],
    "and it does take both when both are needed, so the drill cannot pass by refusing everything");

  /* At LETHAL the bad-deal check is skipped, so the guard is the only
     thing stopping it emptying the whole rack. */
  const dearPair = [
    {uid: "a", name: "W1", kind: "barrier", amount: 3, cost: 3},
    {uid: "b", name: "W2", kind: "barrier", amount: 3, cost: 3}
  ];
  assert.deepEqual(E.soakPolicy({amount: 3, avail: 9, options: dearPair}, {hp: 1}), [0],
    "one is enough even when it is dying — the second is 3 resources for nothing");
});

test("the policy is DETERMINISTIC and touches no rng", {skip}, () => {
  const opts = [{uid: "b", name: "B", kind: "barrier", amount: 1, cost: 1},
                {uid: "a", name: "A", kind: "barrier", amount: 1, cost: 1}];
  const a = E.soakPolicy({amount: 9, avail: 9, options: opts}, {hp: 20});
  const b = E.soakPolicy({amount: 9, avail: 9, options: opts}, {hp: 20});
  assert.deepEqual(a, b, "two peers and a replay must decide identically");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const body = src.match(/function soakPolicy\(live, sd\)\{[\s\S]*?\n\}/);
  assert.ok(body, "soakPolicy moved — re-anchor this drill");
  assert.ok(!/rng/i.test(body[0]),
    "consuming the seeded stream would shift every later shuffle, so a replay would diverge");
});

test("arcaneSoaks is a TOTAL order — ties broken on uid", {skip}, () => {
  const a = P.arcaneSoaks({gear: [gear("Nullrune Robe", "zz"), gear("Nullrune Hood", "aa")]});
  assert.deepEqual(a.map(s => s.uid), ["aa", "zz"],
    "an unordered list of two equal pieces is a desync waiting to happen");
});

/* ---- THE CENSUS, PINNED ----------------------------------------------- */

test("every one of the 15 heroes has arcane defence available", {skip}, () => {
  const W = loadData();
  const missing = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]);
    const any = d.gear.some(e => {
      const c = C.resolveEntry(DB(), e, null);
      return P.arcaneBarrier(c) || P.spellvoid(c);
    });
    if(!any) missing.push(h.k);
  }
  assert.deepEqual(missing, [],
    "this is why it is a rule and not a card: 21 unique pieces, and no hero in the pool " +
    "is without one. It was a noop for all of them.");
});

/* ---- FOUND BY PLAYING, NOT BY A DRILL --------------------------------- */

test("avail is computed when the SHEET IS RAISED, not when the spec is queued", {skip}, () => {
  /* Three Runechants queue three soaks off ONE attack. Answering the first
     one pitches, so an `avail` frozen at queue time is already wrong by
     the second sheet — and wrong in the dangerous direction: it offers a
     barrier the hero can no longer reach, the payment fails, and the
     prevention fires unpaid. That is the v2.04 free-ability bug again. */
  /* Drive the REAL queue — an earlier version of this drill built its own
     spec and so proved only that the fixture was well-formed. */
  const n = bolt({gear: [gear("Nullrune Hood", "g1")], res: 0,
                  hand: [{uid: "h1", name: "blue", pitch: 3}]}, 1);
  const spec = n.promptQ[0];
  assert.equal(spec.avail, undefined,
    "the spec arcaneHit queues must NOT carry a frozen figure");
  assert.equal(PR.buildPrompt(n, spec).avail, 3, "read off the live hand instead");

  /* now the hand is gone — the very next sheet must see that */
  const spent = {...n, sides: [n.sides[0], {...n.sides[1], hand: []}]};
  assert.equal(PR.buildPrompt(spent, spec), null,
    "with nothing left to pitch there is nothing to ask, so the damage lands instead of " +
    "offering a barrier that cannot be paid for");
});

test("a soak the hero cannot pay for is not offered at all", {skip}, () => {
  const n = bolt({gear: [gear("Aetherstorm Wellingtons", "g1")], res: 1});
  assert.equal((n.promptQ || []).length, 0,
    "Arcane Barrier 2 on 1 reachable resource is not a choice, it is a dead sheet whose " +
    "only exit is decline");
  assert.equal(n.sides[1].hp, 15, "and the damage lands rather than hanging on a prompt");
});

test("the trainer treats an unpayable answer as a DECLINE, not a free soak", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const m = code.match(/function foeAnswerSoak\(s, live\)\{[\s\S]*?\n  \}/);
  assert.ok(m, "foeAnswerSoak moved — re-anchor this drill");
  assert.match(m[0], /else \{[\s\S]*?applyPrompt\(n, \{\.\.\.live, sel: \[\]\}\)/,
    "if autoPitch cannot reach the cost the answer must be re-derived with an EMPTY " +
    "selection — otherwise the hero soaks with iron they never paid for");
  assert.ok(!/n = r\.game/.test(m[0]),
    "applyPrompt moves nothing for a soak, so it hands back the game it was GIVEN — from " +
    "before the pitch. Taking it would undo the payment and return the pitched card.");
});

test("the trainer routes seat 1's soak to the policy rather than to the player", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /live\.side === 1 && live\.tag === "soak"/,
    "arcaneHit DEFERS the damage into the answer, so a seat-1 sheet nobody confirms is an " +
    "arcane hit that never lands");
  assert.match(code, /DawnEffects\.soakPolicy\(live, opp\(s\)\)/,
    "and the decision must come from the pure policy, not a second copy in the trainer");
});
