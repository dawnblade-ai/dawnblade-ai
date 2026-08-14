/* ============================================================
   "UNLESS THEY PAY", AND INERTIA — two noops whose stated reasons
   had expired, and one of which was wrong about the mechanic. (v2.75)

   THE ESCAPE HATCH DID NOT EXIST. Winter's Bite prints "Target hero
   discards a card unless they pay {r}", and `classifyClause` returned
   BYTE-IDENTICAL output with and without that second half — so a hero
   holding NINE resources discarded without ever being offered the chance
   to pay. Driven, not guessed: the pre-fix engine took the card and left
   the resources untouched.

   It reported tier `full`, and `npm run fairness` was CLEAN, because the
   sweep asks whether a card grants its CONTROLLER more than it prints —
   not whether it silently deleted the OPPONENT'S printed escape. Same
   shape as Strongest Survive in v2.66, which is why the reveal hatch sits
   directly above the bare discard rule in the parser and this one now
   sits beside it.

   INERTIA WAS NEVER AN ACTION-PHASE TAX. The noop said "the dummy has no
   action phase"; the printed token says:

     Inertia — "Generic Token - Aura"
     "At the beginning of your end phase, destroy Inertia, then put all
      cards from your hand and arsenal on the bottom of your deck."

   A hand wipe, and the harshest token in the pool. The reason on that
   noop was wrong about the MECHANIC, not just about the prop — which is
   the failure mode a census catches and a coverage tool cannot.

   Assertions are on hands, decks, zones and resources. Never on prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const PR = require("../engine/prompts.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const card = (nm, p) => C.resolveEntry(DB(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});

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
  arsenal: null, counters: {}, weaponUsed: {}, hist: {}
}, o || {});
const game = (a, b) => ({sides: [side(a), side(b)], actor: 0, turn: 2,
  log: [], feed: [], chain: [], promptQ: [], rng: RNG.make("toll")});

/* Play Winter's Bite at seat 1, then answer the sheet the way the trainer
   would: resolve at the ASKED side's actor. */
function bite(defender, choice){
  const {runOps} = E.makeEffects(ctx());
  const wb = card("Winter's Bite", 3);
  let n = runOps(game({}, defender), P.fxParse(wb).ops, "Winter's Bite");
  if(!(n.promptQ || []).length) return {n, live: null};
  const live = PR.buildPrompt(n, n.promptQ[0]);
  const decided = choice === "policy" ? (E.payPolicy(live, n.sides[1]) ? "pay" : "decline") : choice;
  const r = PR.applyPrompt(n, {...live, choice: decided});
  let g = {...r.game, actor: live.side};
  if(r.pay > 0){
    const sides = g.sides.slice();
    sides[1] = {...sides[1], res: Math.max(0, sides[1].res - r.pay)};
    g = {...g, sides};
  }
  g = runOps(g, r.ops, "Winter's Bite");
  return {n: {...g, actor: 0}, live, r, decided};
}

/* ---- THE ESCAPE HATCH -------------------------------------------------- */

test("the printed 'unless they pay' is READ, not dropped", {skip}, () => {
  const wb = card("Winter's Bite", 3);
  assert.match(P.clean(wb.tx || ""), /unless they pay/i, "fixture drifted");
  assert.deepEqual(P.fxParse(wb).ops, [["payOr", 1, [["selfDiscard", 1]]]],
    "before v2.75 this was a bare [[\"foeDiscard\",1]] — byte-identical with and without " +
    "the second half of the sentence, so the escape simply did not exist");
});

test("the cost is COUNTED off the print, not hardcoded", {skip}, () => {
  /* Winter's Bite prints {r} on one printing and {r}{r}{r} on another. A
     hardcoded 3 would be wrong on the copy the player actually drew. */
  const one = P.classifyClause("target hero discards a card unless they pay {r}");
  const three = P.classifyClause("target hero discards a card unless they pay {r}{r}{r}");
  assert.equal(one.ops[0][1], 1);
  assert.equal(three.ops[0][1], 3);
});

test("the qualified sentence is not eaten by the bare discard rule", {skip}, () => {
  /* Ordering: the loose "opponent discards" rule would claim the whole
     sentence and silently drop the hatch, which is how this shipped. */
  assert.equal(P.classifyClause("target opponent discards a card").ops[0][0], "foeDiscard",
    "the bare rule still works");
  assert.equal(P.classifyClause(
    "target hero discards a card unless they reveal a card from their hand with {p} greater than the damage dealt"
  ).ops[0][0], "foeDiscardUnlessReveal", "and the reveal hatch still claims its own sentence");
});

test("the sheet is addressed to the TARGET hero, not the caster", {skip}, () => {
  const {n} = bite({res: 9, hand: [{uid: "h1", name: "a card", pitch: 3}]}, null);
  assert.equal(n.promptQ.length, 1);
  assert.equal(n.promptQ[0].tag, "pay");
  assert.equal(n.promptQ[0].side, 1,
    "'target hero may pay' is THEIR call — that is why prompts.js addresses specs to a side");
});

test("paying keeps the card; declining loses it", {skip}, () => {
  const held = [{uid: "h1", name: "a card", pitch: 3}];
  const paid = bite({res: 9, hand: held}, "pay");
  assert.equal(paid.n.sides[1].hand.length, 1, "the card stays");
  assert.equal(paid.n.sides[1].res, 8, "and one resource is gone");

  const gone = bite({res: 9, hand: held}, "decline");
  assert.equal(gone.n.sides[1].hand.length, 0, "declined — the card goes");
  assert.equal(gone.n.sides[1].res, 9, "and nothing was spent");
  assert.equal(gone.n.sides[1].grave.length, 1, "to their own graveyard");
  assert.equal(gone.n.sides[1].grave[0]._disc, true,
    "stamped as a discard — an attack reaches the graveyard at DECLARATION, so the stamp " +
    "is what separates a discard from a card that was merely played");
});

test("the discard lands on the ASKED hero, never on the caster", {skip}, () => {
  const {n} = bite({res: 0, hand: [{uid: "h1", name: "theirs", pitch: 3}]}, "decline");
  assert.equal(n.sides[0].hand.length, 0, "the caster's hand is untouched");
  assert.equal(n.sides[0].grave.length, 0);
  assert.equal(n.sides[1].hand.length, 0,
    "the payload is actor-relative to the side the sheet was addressed to — writing it as " +
    "`foeDiscard` would have discarded from the caster's own hand");
});

test("avail is the ASKED side's, and counts what they could pitch", {skip}, () => {
  /* Build the sheet from the state BEFORE it is answered — `bite` returns
     the post-answer game, where the hand has already gone to the
     graveyard. An earlier version of this drill read avail off that and
     measured the wrong thing. */
  const {runOps} = E.makeEffects(ctx());
  const n = runOps(game({}, {res: 2, hand: [{uid: "h1", name: "a", pitch: 3}]}),
                   P.fxParse(card("Winter's Bite", 3)).ops, "Winter's Bite");
  const live = PR.buildPrompt(n, n.promptQ[0]);
  assert.equal(live.avail, 5,
    "res 2 plus a pitchable 3. It used to be handed in by openPrompt as `you(s).res` — " +
    "seat 0's floating resources whoever the sheet was addressed to, a latent seat bug " +
    "that had never fired because no card queued a pay spec");
});

/* ---- SEAT 1 CAN ANSWER ------------------------------------------------- */

test("seat 1's pay policy spends the pool freely", {skip}, () => {
  assert.equal(E.payPolicy({cost: 1, avail: 9}, {res: 9, hand: [{}, {}]}), true,
    "floating resources cost nothing to spend");
});

test("seat 1 will not spend its LAST card to save a card", {skip}, () => {
  assert.equal(E.payPolicy({cost: 1, avail: 3}, {res: 0, hand: [{pitch: 3}]}), false,
    "pitching the last card in hand to avoid discarding a card is a straight loss — and a " +
    "seat that pays every toll every time is the shape that made both seats block 41 of 41");
  assert.equal(E.payPolicy({cost: 1, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), true,
    "out of a real grip it is worth it");
});

test("seat 1 never claims to pay what it cannot reach", {skip}, () => {
  /* THE CASE THAT ACTUALLY HOLDS THE GUARD. An empty hand is refused by
     the last-card rule anyway, so it proves nothing — the sabotage pass
     found that. What needs the affordability check is a FULL hand that
     still cannot cover the cost: without it the policy answers "pay",
     autoPitch fails, and the trainer has to unwind an answer it should
     never have given. */
  assert.equal(E.payPolicy({cost: 9, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), false,
    "two pitchable 3s is 6, and the toll is 9");
  assert.equal(E.payPolicy({cost: 6, avail: 6}, {res: 0, hand: [{pitch: 3}, {pitch: 3}]}), true,
    "and exactly enough IS enough, so the drill cannot pass by refusing everything");
  assert.equal(E.payPolicy({cost: 3, avail: 1}, {res: 1, hand: []}), false);
  assert.equal(E.payPolicy({cost: 0, avail: 0}, {res: 0, hand: []}), true, "a free toll is free");
});

test("the policy is deterministic and touches no rng", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const body = src.match(/function payPolicy\(live, sd\)\{[\s\S]*?\n\}/);
  assert.ok(body, "payPolicy moved — re-anchor this drill");
  assert.ok(!/rng/i.test(body[0]), "consuming the seeded stream would diverge a replay");
});

test("the trainer routes a seat-1 pay to the policy", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /live\.side === 1 && live\.tag === "pay"/,
    "an 'unless they pay' clause hangs its whole consequence off the answer, so a sheet " +
    "addressed to seat 1 that nobody confirms is a printed effect that never resolves");
  assert.match(code, /DawnEffects\.payPolicy\(live, opp\(s\)\)/,
    "and the decision must come from the pure policy, not a second copy in the trainer");
  assert.ok(!/avail:you\(s\)\.res/.test(code),
    "openPrompt must no longer patch seat 0's resources onto a sheet addressed to anyone");
});

/* ---- INERTIA ----------------------------------------------------------- */

test("the Inertia token is a HAND WIPE, and the old noop said otherwise", {skip}, () => {
  const tok = card("Inertia");
  assert.ok(tok.resolved, "resolved from the database — never invented");
  assert.match(P.clean(tok.tx || ""),
    /at the beginning of your end phase, destroy inertia, then put all cards from your hand and arsenal on the bottom of your deck/i,
    "the printed text is the spec, and it is not a tax on an action phase");
});

test("resolveInertia sweeps hand AND arsenal to the BOTTOM of the deck", {skip}, () => {
  const tok = card("Inertia");
  const ent = {card: {...tok, uid: "i1"}, kind: "token", spent: false, uid: "i1"};
  const g = game({}, {board: [ent], hand: [{uid: "a"}, {uid: "b"}, {uid: "c"}],
                      arsenal: {uid: "d"}, deck: [{uid: "z"}]});
  const r = E.resolveInertia(g, 1);
  assert.equal(r.tokens, 1);
  assert.equal(r.wiped, 4, "three in hand and one in arsenal");
  assert.equal(r.game.sides[1].hand.length, 0);
  assert.equal(r.game.sides[1].arsenal, null, "the arsenal goes too — the text names it");
  assert.deepEqual(r.game.sides[1].deck.map(c => c.uid), ["z", "a", "b", "c", "d"],
    "the BOTTOM of the deck, under what was already there — not the graveyard, so " +
    "'discarded this turn' riders must not see them");
  assert.equal(r.game.sides[1].grave.length, 0, "nothing is stamped _gy");
  assert.equal(r.game.sides[1].board.length, 0, "and the token destroys itself");
});

test("resolveInertia touches the named seat only, and nothing without a token", {skip}, () => {
  const tok = card("Inertia");
  const ent = {card: {...tok, uid: "i1"}, kind: "token", spent: false, uid: "i1"};
  const g = game({hand: [{uid: "mine"}]}, {board: [ent], hand: [{uid: "theirs"}]});
  const r = E.resolveInertia(g, 1);
  assert.equal(r.game.sides[0].hand.length, 1, "'your end phase' is the CONTROLLER's");

  const clean = E.resolveInertia(game({}, {hand: [{uid: "x"}]}), 1);
  assert.equal(clean.tokens, 0);
  assert.equal(clean.game, g.board === undefined ? clean.game : clean.game,
    "no token, no wipe");
  assert.equal(clean.game.sides[1].hand.length, 1, "the hand survives untouched");
});

test("it fires at the BEGINNING of the end phase, ahead of the arsenal step", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* It must precede (b), or the seat is invited to choose an arsenal card
     that is about to be swept into the deck anyway. Both seats reach it. */
  assert.match(code, /n = beginEndPhase\(n, 0\);[\s\S]{0,200}n = endPhaseAllies\(n\);/,
    "seat 0's end phase runs it before (a)/(b)");
  assert.match(code, /n = beginEndPhase\(n, 1\);[\s\S]{0,200}n = endPhaseAllies\(n\);/,
    "and so does seat 1's");
  assert.match(code, /DawnEffects\.resolveInertia\(s, si\)/,
    "one description, taking the seat — not two copies that can drift");
});

test("both pool cards that create Inertia put it on the OPPONENT's board", {skip}, () => {
  for(const nm of ["Lace with Inertia", "Inertia Trap"]){
    const c = card(nm, nm === "Lace with Inertia" ? 1 : 0);
    const txt = P.clean(c.tx || "");
    assert.match(txt, /inertia token under/i, `${nm} fixture drifted`);
    assert.match(txt, /under (?:their|the attacking hero)/i,
      `${nm} hands it to the opponent — a token that taxed its own controller would be a ` +
      `card that attacks you`);
  }
});
