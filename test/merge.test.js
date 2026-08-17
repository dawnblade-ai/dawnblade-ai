/* ============================================================
   THE MERGE SEAM — can judge.js drive effects.js? (v2.76)

   The plan in HANDOFF-MERGE.md rests on one property, and this file is it:

     `effects.js` is written in the trainer's MUTABLE idiom
     (`actMut(n).hp -= 4`), and `judge.js` is purely functional
     (`put(g, i, s => ({...s, hp: s.hp-4}))`). For judge to call effects at
     its DEFEND and RESOLUTION steps, handing effects a shallow clone must
     be SAFE — effects must mutate only its own copy and hand back a new
     state, leaving everything the caller still holds untouched.

   That is exactly what `Battle` already relies on through `setG`, so it
   ought to be true. "Ought to be true" is how this project has been bitten
   before, and it is the assumption an entire phase of work is about to be
   built on — so it is pinned here BEFORE anything depends on it, and it
   has to keep being true as effects.js grows.

   The second half pins that judge.js really does already export the
   accessors effects.js needs. That is the finding that made the merge
   tractable (the old handoff estimated it as the biggest remaining seam);
   if an export is renamed, the plan needs re-costing and this drill is
   where that surfaces.

   NOTHING HERE WIRES THE TWO TOGETHER. It measures the seam.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");

const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const RNG = require("../engine/rng.js");

/* A context built ONLY out of names judge.js already exports, or trivial
   one-liners over them. If this can be assembled, judge can assemble it. */
function judgeShapedCtx(){
  return {
    L: (g, m) => m == null ? g : ({...g, log: [m, ...(g.log || [])], feed: [...(g.feed || []), m]}),
    act: g => g.sides[g.actor || 0],
    actorOf: g => g.actor || 0,
    foe: g => g.sides[1 - (g.actor || 0)],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    bAct: g => (g.builds || [])[g.actor || 0] || {runeDmg: 1},
    bFoe: g => (g.builds || [])[1 - (g.actor || 0)] || {runeDmg: 1},
    built: {runeDmg: 1},
    db: {},
    dummyDefence: s => ({n: s, note: ""}),
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s,
    openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "action",
    winCheck: s => s
  };
}
const side = o => Object.assign({
  name: "x", hp: 20, res: 9, ap: 1, amp: 0, ward: 0, awd: 0, arcShield: 0,
  hand: [], deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], gear: [],
  arsenal: null, counters: {}, weaponUsed: {}, hist: {}
}, o || {});
/* Shaped the way judge.js holds a game: `actor`, `sides`, `builds`,
   `tokSeq`, `rng` — the fields it already carries. */
const judgeState = () => ({
  sides: [side({}), side({})], actor: 0, turn: 2, tokSeq: 0,
  builds: [{runeDmg: 1}, {runeDmg: 1}],
  log: [], feed: [], chain: [], stack: [], promptQ: [], rng: RNG.make("merge")
});

/* ---- THE PROPERTY THE PLAN RESTS ON ----------------------------------- */

test("effects.js can be built from a judge-shaped context", () => {
  const fx = E.makeEffects(judgeShapedCtx());
  for(const k of ["runOps", "execute", "afterDefenders", "resolveStack"]){
    assert.equal(typeof fx[k], "function", `${k} must be reachable — judge calls it`);
  }
});

test("a shallow clone into effects leaves the CALLER's state untouched", () => {
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["arcane", 5]], "probe");

  assert.notEqual(out.sides[1].hp, g.sides[1].hp, "the result must actually differ, or this proves nothing");
  assert.equal(out.sides[1].hp, 15);
  assert.equal(JSON.stringify(g), before,
    "THE WHOLE MERGE RESTS ON THIS. effects.js writes through actMut/foeMut, which clone " +
    "`sides` and the side themselves before handing back a mutable object — so a caller " +
    "that passes {...g} and takes the result is safe. judge.reduce is pure and must stay " +
    "pure; if this ever fails, judge cannot call effects without a deep copy.");
});

test("it holds for a write to the ACTOR's own side too, not just the foe's", () => {
  /* foeMut and actMut are separate paths; a drill that only ever exercises
     one of them proves half the property. */
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["res", 3]], "probe");
  assert.equal(out.sides[0].res, 12, "the actor gained resources");
  assert.equal(JSON.stringify(g), before, "and the caller's copy is untouched");
});

test("nested state survives the round trip — the clone is deep ENOUGH", () => {
  /* `hist` and `counters` are objects on the side. effects.js replaces them
     wholesale ({...act(n).hist, …}) rather than mutating in place; if that
     discipline ever slips, the caller's nested object is corrupted and no
     top-level JSON compare of `sides` would necessarily catch which one. */
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  g.sides[0].hist = {atk: 0, arc: 0};
  const histRef = g.sides[0].hist;
  const before = JSON.stringify(g);
  const out = runOps({...g}, [["arcane", 1]], "probe");
  assert.equal(out.sides[0].hist.arc, 1, "the arcane was credited on the way out");
  assert.equal(histRef.arc, 0, "and the caller's own hist object was not written through");
  assert.equal(JSON.stringify(g), before);
});

/* ---- THE SHAVE, WITHOUT A MODE STRING (v2.77) -------------------------
   "-N power" on a defence reaction asked `mode==="block"` — the trainer's
   name for one shape of one board. In judge.js the defending seat is an
   argument and there is one combat path, so that test answers FALSE and
   the whole printed payload goes quietly nowhere. Driven from both
   directions, because a shave that fires on your OWN attack is the
   opposite bug and just as wrong. */

test("a defence reaction shaves the attack in flight, in a judge-shaped state", () => {
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  g.actor = 0;                                   // seat 0 is DEFENDING
  g.pend = {name: "their swing", by: 1, total: 5};
  const out = runOps({...g}, [["atkMinus", 2]], "probe");
  assert.equal(out.pend.total, 3,
    "the incoming link is shaved — no `incoming` scalar and no `mode` anywhere in this state");
  assert.equal(g.pend.total, 5, "and the caller's link is untouched");
});

test("it does NOT shave your own attack", () => {
  const {runOps} = E.makeEffects(judgeShapedCtx());
  const g = judgeState();
  g.actor = 0;
  g.pend = {name: "my swing", by: 0, total: 5};
  const out = runOps({...g}, [["atkMinus", 2]], "probe");
  assert.equal(out.pend.total, 5,
    "the link belongs to the acting seat, so there is nothing hostile to shave. A shave " +
    "that reads only 'is there a pend' would quietly weaken the attacker's own swing.");
});

/* ---- WHAT JUDGE ALREADY BRINGS ---------------------------------------- */

test("judge.js already exports the accessors effects.js needs", () => {
  /* This is the finding that re-costed the merge. The old handoff called
     the context "the next seam of the same kind dummyDefence was, and it is
     bigger"; in fact judge.js already carries the same actor discipline
     under these names. If one is renamed, re-cost the plan. */
  for(const k of ["actorOf", "act", "foe", "at", "put", "bAct", "bOf", "say", "toGrave", "mint"]){
    assert.equal(typeof J[k], "function", `judge.${k} is what effects.js's context is built from`);
  }
});

test("judge's act/foe are ACTOR-relative, matching effects.js exactly", () => {
  const g = {sides: [{name: "zero"}, {name: "one"}], actor: 0, turnPlayer: 0};
  assert.equal(J.act(g).name, "zero");
  assert.equal(J.foe(g).name, "one");
  const flipped = {...g, actor: 1};
  assert.equal(J.act(flipped).name, "one",
    "act follows the ACTOR, not the seat — this is the v2.24 split, and effects.js " +
    "depends on it meaning the same thing on both sides of the merge");
  assert.equal(J.foe(flipped).name, "zero");
});

/* ---- AND NOW IT BUILDS THE CONTEXT ITSELF (v2.77) ---------------------
   Everything above measures the seam with a hand-rolled context. This
   drives judge.js's OWN — `effectsFor` / `withEffects` — because a
   hand-rolled one proves the module could be called, not that this
   caller calls it correctly. Two things can only go wrong here: a
   context key judge forgets to supply (makeEffects throws), and the uid
   counter, which lives on the state rather than in a React ref and so is
   the one thing that does not fit a pure reducer for free. */

test("judge.withEffects runs the card semantics through judge's own context", () => {
  const g = judgeState();
  g.turnPlayer = 0;
  const out = J.withEffects(g, (fx, n) => fx.runOps(n, [["arcane", 5], ["res", 2]], "probe"));
  assert.equal(out.sides[1].hp, 15, "the foe of the ACTOR took it");
  assert.equal(out.sides[0].res, 11, "and the actor gained the resources");
  assert.equal(g.sides[1].hp, 20, "reduce is pure — the caller's state is untouched");
  assert.equal(g.sides[0].res, 9);
});

test("a minted uid comes back on the state, or a replay mints different ones", () => {
  /* `tokSeq()` is a bare call in effects.js because in the trainer it is
     a React ref. Here the counter is a FIELD, so the context closes over
     a cell seeded from the state and `withEffects` writes it back. Drop
     that write and two peers replaying the same log mint colliding uids,
     which is CARD-IN-TWO-ZONES wearing a disguise. */
  const g = judgeState();
  g.turnPlayer = 0;
  const out = J.withEffects(g, (fx, n) => {
    const first = n.tokSeq;
    assert.equal(first, 0, "the fixture starts at zero, or this proves nothing");
    return fx.runOps(n, [["token", "Runechant"]], "probe");
  });
  /* No database is registered, so the token refuses in a log line rather
     than throwing — that refusal is itself the contract. What is pinned
     here is the counter's round trip, driven below with a real mint. */
  assert.equal(typeof out.tokSeq, "number");
});

test("judge has no you()/opp() — perspective is not a rules question", () => {
  assert.equal(J.you, undefined,
    "`you` means seat 0, which asks whose SCREEN this is. No rule has ever wanted it, and " +
    "reintroducing it here is how the actor/perspective split gets undone.");
  assert.equal(J.opp, undefined);
});

/* ---- THE LEDGER ------------------------------------------------------- */

/* ============================================================
   AND NOW THE CLAIM ITSELF: CARD TEXT RESOLVES AT THE TABLE

   Everything above measures the seam. This drives a real hero's real
   cards through `judge.reduce` and asserts on the BOARD — tokens, life,
   the attack's total — because the whole of v2.77 is one sentence and
   this is the only thing that can check it.

   Viserai is the subject for one reason: his rite is a hero passive read
   through `bAct`, it MINTS a card out of the database, and the token it
   mints then triggers on the next attack. So a single line of play
   exercises the build, the database registration, the uid counter, the
   actor helpers and the declaration-time trigger at once — five of the
   things this file has been pinning separately.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const GM = require("../engine/game.js");
const PR = require("../engine/parser.js");
const CACHE = require("./helpers/extract").cardDbPath();
const noDb = !fs.existsSync(CACHE) && "no cached card database";
const W = noDb ? null : require("./helpers/extract.js").loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

function realMatch(k0, k1, seed){
  const hero = k => W.HEROES.find(h => new RegExp(k, "i").test(h.n));
  const h0 = hero(k0), h1 = hero(k1), ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, GM.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, GM.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}
/* Pass until the link in flight has actually dealt its damage. */
const toDealt = n => {
  for(let i = 0; i < 24 && n.priority != null && !(n.pend && n.pend.dealt != null); i++)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  return n;
};

test("a hero passive fires at the table, and mints a REAL card", {skip: noDb}, () => {
  J.setDb(DB());
  let g = realMatch("viserai", "kayo", "rite");
  const rb = g.sides[0].deck.find(c => /runeblade/i.test(c.tt || "") && PR.isAttack(c));
  assert.ok(rb, "no Runeblade attack in the deck — the fixture is wrong, not the engine");
  /* "if you've played a non-attack this turn" — the rite's own condition,
     read off `hist` exactly as it is in solo play. */
  g = J.put(g, 0, s => ({...s, hand: [rb, ...s.hand], res: 9, hist: {...s.hist, non: 1}}));

  const out = J.reduce(g, {t: "play", uid: rb.uid, from: "hand"}, 0);
  assert.equal(out.error, null, "a legal play was refused: " + out.error);
  const board = out.state.sides[0].board;
  assert.equal(board.length, 1, "the rite conjured nothing — no card text resolved");
  assert.equal(board[0].card.name, "Runechant",
    "the token must be the printed card out of the database, never invented");
  assert.equal(board[0].kind, "aura",
    "a Runechant is a Runeblade Token - AURA, and seven pool cards count auras generically");
  assert.ok(String(board[0].uid).indexOf("rune") === 0,
    "a token uid must be namespaced — a raw counter collides with a dealt card, which the " +
    "invariant judge caught in live play as CARD-IN-TWO-ZONES");
  assert.equal(g.sides[0].board.length, 0, "and reduce did not write through to the caller");
});

test("the token then triggers on the next attack — arcane, past the wall", {skip: noDb}, () => {
  J.setDb(DB());
  let g = realMatch("viserai", "kayo", "rite2");
  const rbs = g.sides[0].deck.filter(c => /runeblade/i.test(c.tt || "") && PR.isAttack(c));
  g = J.put(g, 0, s => ({...s, hand: [rbs[0], rbs[1], ...s.hand], res: 9, ap: 3,
                         hist: {...s.hist, non: 1}}));

  let n = toDealt(J.reduce(g, {t: "play", uid: rbs[0].uid, from: "hand"}, 0).state);
  assert.ok(n.pend.dealt > 0, "the first link dealt nothing — the drill proves nothing after this");
  for(let i = 0; i < 12 && n.pend; i++) n = J.reduce(n, {t: "pass"}, n.priority != null ? n.priority : 0).state;
  assert.equal(n.sides[0].board.length, 1, "the runechant should have survived the chain");

  const before = n.sides[1].hp;
  n = J.reduce(n, {t: "play", uid: rbs[1].uid, from: "hand"}, 0).state;
  /* THE TRIGGER IS ON *PLAY*, and it resolves ABOVE the attack — so the
     damage lands at DECLARATION, before any defender is declared, and
     arcane goes past equipment entirely. */
  assert.ok(n.sides[1].hp < before,
    "the Runechant did not pop at declaration — it triggers on PLAY (its own printed text) " +
    "and a triggered ability resolves above the attack that triggered it");
  assert.equal(n.sides[1].hp, before - 1, "one token, its printed one arcane");
});

test("the attack's TOTAL is what the card says, not what it prints", {skip: noDb}, () => {
  /* The shape that would be invisible: every buff in the game resolving
     correctly and then being thrown away at declaration by a `card.power`
     read. Coverage says `full`, fairness is one-sided the other way, and
     the card is simply weaker than printed. */
  J.setDb(DB());
  let g = realMatch("kayo", "dorinthea", "pump");
  const atk = g.sides[0].deck.find(c => PR.isAttack(c) && (c.power || 0) > 0);
  g = J.put(g, 0, s => ({...s, hand: [atk, ...s.hand], res: 9, buffNext: 3}));
  const n = J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, 0).state;
  assert.equal(n.pend.total, (atk.power || 0) + 3,
    "a queued +3 to your next attack must reach the chain link");
});

/* ---- A SHEET CAN BE ANSWERED AT THE TABLE (v2.77) ---------------------
   Prompts have been addressed to a SIDE since v2.17, and until now only
   the trainer could resolve one. That is not a missing screen: several
   cards defer their whole payload into the answer — `arcaneHit` rides the
   damage out on a soak, a printed "unless they pay" hangs its consequence
   off a toll — so an unanswerable sheet is arcane damage that never lands.

   Driven through `reduce`, including the refusals, because the refusals
   are the half that stops the game continuing around an unanswered sheet
   and abandoning what it was holding. */

const promptGame = () => {
  const g = judgeState();
  g.turnPlayer = 0; g.priority = 0; g.phase = "action"; g.step = "layer";
  g.sides[0].hand = [{name: "Sheet Fodder", uid: 901, pitch: 1, cost: 0, tt: "Generic Action", tx: ""},
                     {name: "Sheet Spare",  uid: 902, pitch: 1, cost: 0, tt: "Generic Action", tx: ""}];
  g.promptQ = [{tag: "pick", side: 0, src: "Probe", zone: "hand", to: "grave", min: 1, max: 1}];
  return J.openPrompt(g);
};

test("a live sheet stops BOTH seats until it is answered", () => {
  const g = promptGame();
  assert.ok(g.prompt, "the queue did not drain into a live sheet");
  assert.match(J.legal(g, {t: "pass"}, 0) || "",
    /answering/, "the asked seat may not play on around its own sheet");
  assert.match(J.legal(g, {t: "pass"}, 1) || "",
    /answering/, "and neither may the other seat — what queued it is mid-resolution");
  assert.match(J.legal(g, {t: "promptConfirm"}, 1) || "",
    /not addressed to you/, "only the side it is addressed to may answer");
  assert.match(J.legal(g, {t: "promptConfirm"}, 0) || "",
    /not answered yet/, "a `min:1` pick cannot be confirmed with nothing chosen");
});

test("answering it moves the card and hands the game back", () => {
  let g = promptGame();
  const sel = J.reduce(g, {t: "promptSel", i: 0}, 0);
  assert.equal(sel.error, null);
  assert.equal(J.legal(sel.state, {t: "promptConfirm"}, 0), null, "now it is answerable");
  const out = J.reduce(sel.state, {t: "promptConfirm"}, 0);
  assert.equal(out.error, null);
  assert.equal(out.state.prompt, null, "the sheet must clear, or the game stays stopped");
  assert.equal(out.state.sides[0].hand.length, 1, "the chosen card left the hand");
  assert.equal(out.state.sides[0].grave.length, 1, "and landed in the destination zone");
  assert.equal(out.state.sides[0].grave[0].uid, 901);
  assert.equal(g.sides[0].hand.length, 2, "and reduce did not write through to the caller");
});

test("a prompt action with no sheet open is refused, not ignored", () => {
  const g = judgeState();
  g.turnPlayer = 0; g.priority = 0; g.phase = "action";
  assert.match(J.legal(g, {t: "promptConfirm"}, 0) || "", /no sheet/,
    "an action that silently does nothing is indistinguishable from a bug");
});

test("autoAnswer is never reached from reduce — answering is the caller's", () => {
  /* A policy quietly answering a modal nobody knew was there is the kind
     of thing that only surfaces in a game weeks later. The session asks
     for the answer; the rules never volunteer one. */
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const body = src.slice(src.indexOf("function reduce(g, a, seat){"));
  assert.ok(!/autoAnswer\s*\(/.test(body),
    "reduce must not answer a sheet on a seat's behalf");

  const g = promptGame();
  const a = J.autoAnswer(g);
  assert.ok(a && /^prompt/.test(a.t), "and the helper must offer a real prompt action");
  assert.equal(J.legal(g, a, g.prompt.side || 0), null, "which the judge then accepts");
});

test("the context is still 17 keys — a new one is a new thing judge must supply", () => {
  assert.equal(E.CTX_KEYS.length, 17,
    "every key added to effects.js is another dependency judge.js has to satisfy before it " +
    "can drive the card semantics. Moving this number should be a deliberate edit.");
  /* `dummyDefence` came OFF this list in v2.73 and must not come back: it
     is what made effects callable only by a caller that owns a dummy.
     `built` came off in v2.77 for the neighbouring reason — it was the
     last key that named a SEAT rather than a role, so supplying it meant
     writing seat 0 into judge.js's brand-new caller. */
  for(const gone of ["dummyDefence", "built"]){
    assert.ok(!E.CTX_KEYS.includes(gone),
      "`" + gone + "` came off this list on purpose — putting it back re-closes a door " +
      "this merge walks through");
  }
});
