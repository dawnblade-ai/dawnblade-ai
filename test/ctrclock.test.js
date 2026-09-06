/* ============================================================
   A PERMANENT ON A COUNTER CLOCK (v4.23)

   Eleven pool records print the same three-part machine and not one of
   them ran it:

     ENTER   "this enters the arena with N <kind> counters"
     TICK    "(Once per turn, )when you <EVENT>, remove a <kind> counter
              from this[ and <PAYLOAD>]"   [+ "If you do, <PAYLOAD>"]
     EMPTY   "when (it|this) has (none | no <kind> counters), destroy it"

   plus a fourth printed sentence that buys the schedule off:

     SPARE   "at the start of your turn, destroy this UNLESS you remove a
              <kind> counter from it"

   WHAT WAS ACTUALLY THERE. Malefic Incantation's clock ran, through an
   INLINE REGEX over its raw text inside `execute` (v3.58's defect),
   ticking a `b.verse` field on the board entry — a SECOND counter storage
   for one card, beside the `counters` bag every other counter uses. Hyper
   Driver prints the identical EMPTY clause, read `tier: full`, and was
   IMMORTAL: its `noop` named that inline reader, so v3.16's rule (a noop
   must describe the clause in front of it, never a sibling) was broken
   across four records. Its tick clause parsed to a bare `["res",1]` — the
   payload with the trigger and the removal both eaten — so the {r} landed
   once, on PLAY, and the counters never moved.

   AND `enterCounters` WAS DEAD. `runOps` stashed it as `_enterCounters`
   and NOTHING read that field; the number the clause describes was
   recovered by a separate regex at the board-placement site. One op, one
   write, no reader.

   BOTH DIRECTIONS. Hyper Driver and the two grenades are STRONGER than
   printed (a printed drawback skipped — `failstates.js`'s sev-3), and
   Malefic Incantation p3 was WEAKER: it prints "a verse counter",
   singular, which the old numeric-only reader missed, so it entered with
   ZERO and the whole card was inert while reading `part`.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
const synth = (name, tx, tt) => ({name, pitch: 0, tt: tt || "Mechanologist Action - Item",
                                  ty: (tt || "Mechanologist Action - Item").split(/[ /-]+/),
                                  kw: [], tx, power: null, cost: 0});

/* ---- 1. THE READING ---------------------------------------------- */

test("the clock is a WHOLE-CARD reading, so the clause reader alone refuses", () => {
  /* v3.56: ask the function that holds the reader. The tick's payload can
     be in the NEXT clause ("If you do, …"), which one clause at a time
     cannot see — so a probe written against `classifyClause` would pass
     against an engine that reads none of this. */
  assert.equal(cc("Once per turn, when you boost a card, remove a steam counter from this and gain {r}"), null);
  assert.equal(cc("Once per turn, when you play an attack action card, remove a verse counter from this"), null);
  assert.equal(cc("When this has none, destroy it"), null);
  assert.equal(cc("When this has no steam counters, destroy it"), null);
});

test("BOTH PRINTED WORDINGS of the EMPTY clause read, and the kind comes off the card", () => {
  /* v3.36/v3.65: the database prints both spellings. The Hyper Driver
     TOKEN names the kind ("no STEAM counters"); all three Action
     printings say "none" and leave it to the sentence beside them. */
  P.fxReset();
  const named = P.fxParse(synth("Clock Probe Named",
    "When this has no steam counters, destroy it."));
  assert.equal(named.emptyDies, "steam", "the printed kind is read");

  P.fxReset();
  const bare = P.fxParse(synth("Clock Probe Bare",
    "This enters the arena with 2 steam counters. When this has none, destroy it."));
  assert.equal(bare.emptyDies, "steam",
    "a bare 'none' is resolved from the clock the card already declared");

  /* AND A CARD THAT DECLARES NEITHER REFUSES rather than guessing a kind
     — a destroy armed against a bag that is empty because nothing ever
     filled it would kill the permanent on sight. */
  P.fxReset();
  const alone = P.fxParse(synth("Clock Probe Orphan", "When this has none, destroy it."));
  assert.equal(alone.emptyDies, undefined, "no declared kind, no destroy");
  assert.equal((alone.clauses[0] || {}).st, "skip", "and the clause is visibly unread");
  P.fxReset();
});

test("the tick reads its EVENT, its KIND and its PAYLOAD off the printed line", () => {
  P.fxReset();
  const hd = P.fxParse(H.card ? synth("Clock Probe Boost",
    "This enters the arena with 3 steam counters. When this has none, destroy it.\n" +
    "Once per turn, when you boost a card, remove a steam counter from this and gain {r}.") : null);
  assert.deepEqual(hd.ctrTick, {on: "boost", kind: "steam", n: 1, once: true, ops: [["res", 1]]});

  P.fxReset();
  const mi = P.fxParse(synth("Clock Probe Play",
    "This enters the arena with 3 verse counters. When it has none, destroy it.\n" +
    "Once per turn, when you play an attack action card, remove a verse counter from this. " +
    "If you do, create a Runechant token.", "Runeblade Action - Aura"));
  assert.deepEqual(mi.ctrTick, {on: "atkPlay", kind: "verse", n: 1, once: true, ops: [["rune", 1]]},
    "the payload arrives in the NEXT clause here and is folded where the whole card is visible");
  assert.equal(mi.emptyDies, "verse");

  /* AND THE "IF YOU DO" CLAUSE IS MARKED READ by the fold, not left to
     report unread beside a trigger that consumed it. */
  assert.equal(mi.clauses.filter(x => x.st === "skip").length, 0);
  P.fxReset();
});

test("an unreadable payload refuses the whole clock (v2.29)", () => {
  P.fxReset();
  const fx = P.fxParse(synth("Clock Probe Ineffable",
    "This enters the arena with 2 steam counters. When this has none, destroy it.\n" +
    "Once per turn, when you boost a card, remove a steam counter from this and do something ineffable."));
  assert.equal(fx.ctrTick, undefined,
    "a tick whose payload nobody built would spend the counter, kill the " +
    "permanent on schedule and pay nothing — weaker than printed AND reported read");
  /* THE EMPTY HALF STILL READS, off the counter the card enters with —
     the two are separate printed sentences and only one of them refused. */
  assert.equal(fx.emptyDies, "steam");
  P.fxReset();
});

test("an unknown counter KIND refuses both halves", () => {
  P.fxReset();
  const fx = P.fxParse(synth("Clock Probe Glitter",
    "This enters the arena with 2 glitter counters. When this has no glitter counters, destroy it.\n" +
    "Once per turn, when you boost a card, remove a glitter counter from this and gain {r}."));
  assert.equal(fx.ctrTick, undefined);
  assert.equal(fx.emptyDies, undefined);
  assert.equal(fx.clauses.filter(x => x.st === "skip").length, 3,
    "all three clauses are visibly unread — a kind nothing consumes is a " +
    "counter that does nothing, and claiming it is the no-op blind spot");
  P.fxReset();
});

/* ---- 2. THE REPRIEVE ---------------------------------------------- */

test("the reprieve rides on the selfDestruct op, and the kind is read", () => {
  assert.deepEqual(cc("At the start of your turn, destroy this unless you remove a steam counter from it."),
    {status: "run", ops: [["selfDestruct", "turn", {kind: "steam", n: 1}]]});
  /* THE SCHEDULE IS READ TOO — the same three windows the payout half
     reads, so a card printing the end phase does not silently get the
     start of the turn. */
  assert.deepEqual(cc("At the beginning of your end phase, destroy this unless you remove a rust counter from it."),
    {status: "run", ops: [["selfDestruct", "end", {kind: "rust", n: 1}]]});
  /* AND A KIND NOTHING READS REFUSES. Zen State prints "unless you remove
     a BALANCE counter"; `balance` is not in the vocabulary, its own enter
     clause refuses for the same reason, and building one half of a card
     whose other two clauses have no reader is worse than the honest gap. */
  assert.equal(cc("At the beginning of your action phase, destroy this unless you remove a balance counter from it."), null);

  /* THE AMOUNT IS READ, AND ONLY A SYNTHETIC CAN SAY SO. All four pool
     records print "a <kind> counter" — one — so hardcoding the number is
     SILENT against every real fixture (v3.32, and the tenth outing of
     that rule). Both the word form and the digit form are printed
     elsewhere in this vocabulary, so both are asked. */
  assert.deepEqual(cc("At the start of your turn, destroy this unless you remove two steam counters from it.").ops,
    [["selfDestruct", "turn", {kind: "steam", n: 2}]]);
  assert.deepEqual(cc("At the start of your turn, destroy this unless you remove 3 rust counters from it.").ops,
    [["selfDestruct", "turn", {kind: "rust", n: 3}]]);
});

test("DRIVEN: the reprieve spends the number the card prints, not one", {skip}, () => {
  /* And it is asked of the SWEEP, not only of the parse: a reader that
     returns 2 and a sweep that removes 1 disagree, and the pool cannot
     tell them apart because every printing says one. */
  H.db();
  const two = Object.assign({}, H.card("Boom Grenade", 1), {uid: "bg2"});
  two.tx = "At the start of your turn, destroy this unless you remove two steam counters from it.";
  two.name = "Twin Fuse Probe";
  let n = H.state({name: "Dash", res: 5, ap: 1, deck: [{uid: "f1", name: "F1"}],
                   board: [{card: two, kind: "item", spent: false, uid: "bg2", sd: "turn"}],
                   counters: {bg2: {steam: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  const one = E.sweepArena(n, 0, "turn");
  assert.equal(one.fired.length, 0);
  assert.equal(((one.game.sides[0].counters || {}).bg2 || {}).steam, 1,
    "two counters come off, because the card says two");
  const nxt = E.sweepArena(one.game, 0, "turn");
  assert.deepEqual(nxt.fired, ["Twin Fuse Probe"],
    "and one counter is not enough to buy the next turn");
});

test("the PAYOUT half of the same schedule is untouched", () => {
  /* "…destroy this, THEN X" is the sibling rule one printed word over,
     and the reprieve must not have widened into it. */
  assert.deepEqual(cc("At the start of your turn, destroy this, then your next attack this turn gets +1{p}"),
    {status: "run", ops: [["selfDestruct", "turn"], ["buffNext", 1]]});
  assert.deepEqual(cc("At the start of your turn, destroy this"),
    {status: "run", ops: [["selfDestruct", "turn"]]});
});

/* ---- 3. DRIVEN — THE BOOST CLOCK ---------------------------------- */

const board = (n, seat) => (n.sides[seat].board || []).map(b => b.card.name);
const steam = (n, uid) => ((n.sides[0].counters || {})[uid] || {}).steam || 0;

function boostOnce(n, uid){
  let r = J.reduce(n, {t: "play", uid, from: "hand"}, 0);
  if(r.error) throw new Error("play refused: " + r.error);
  n = r.state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: true}, 0).state;
  return n;
}
const freshLayer = n => ({...n, phase: "action", step: "layer", priority: 0, passed: [],
                          chain: [], chainCards: [], pend: null, _doBoost: true,
                          sides: n.sides.map((s, i) => i === 0 ? {...s, weaponUsed: {}} : s)});

test("DRIVEN: a Hyper Driver spends a steam counter per boost, pays {r}, and DIES when empty", {skip}, () => {
  H.db();
  const drv = mk("Hyper Driver", 1, "hd1");
  let n = H.state({name: "Dash", res: 9, ap: 9,
                   hand: [mk("Jump Start", 1, "j1"), mk("Jump Start", 2, "j2")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}, {uid: "f3", name: "F3"}],
                   board: [{card: drv, kind: "item", spent: false, uid: "hd1"}],
                   counters: {hd1: {steam: 2}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = freshLayer(n);
  const res0 = n.sides[0].res;
  n = boostOnce(n, "j1");
  assert.equal(steam(n, "hd1"), 1, "one counter comes off per boost");
  assert.ok(board(n, 0).indexOf("Hyper Driver") >= 0, "and it is still on the board at 1");

  n = freshLayer(n);
  n = boostOnce(n, "j2");
  assert.equal(steam(n, "hd1"), 0);
  assert.equal(board(n, 0).indexOf("Hyper Driver"), -1,
    "\"when this has none, destroy it\" — a printed drawback that was skipped " +
    "on four records reading `tier: full`");
  assert.ok(n.sides[0].grave.some(c => c.name === "Hyper Driver"),
    "and a destroyed permanent reaches the GRAVEYARD (the sweep files it, turn-stamped)");
  /* THE {r} IS THE OTHER HALF and it is asserted against the cost: Jump
     Start prints 2 and discounts itself to 1 while a Driver is out, so
     two boosts cost 2 and pay 2 back. */
  assert.equal(n.sides[0].res, res0, "two counters, two {r}");
});

test("DRIVEN: the once-per-turn latch holds — a second boost the same turn ticks nothing", {skip}, () => {
  H.db();
  const drv = mk("Hyper Driver", 1, "hd1");
  let n = H.state({name: "Dash", res: 9, ap: 9,
                   hand: [mk("Jump Start", 1, "j1"), mk("Jump Start", 2, "j2")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}, {uid: "f3", name: "F3"}],
                   board: [{card: drv, kind: "item", spent: false, uid: "hd1"}],
                   counters: {hd1: {steam: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  n = boostOnce(n, "j1");
  assert.equal(steam(n, "hd1"), 2);
  /* NO `weaponUsed` RESET between the two — that is what the turn
     boundary does, and this drill is the one that must not do it. */
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [],
       chain: [], chainCards: [], pend: null, _doBoost: true};
  n = boostOnce(n, "j2");
  assert.equal(steam(n, "hd1"), 2, "once per turn is once per turn");
});

test("DRIVEN: an empty bag removes nothing, pays nothing, and does not spend the allowance", {skip}, () => {
  H.db();
  const drv = mk("Hyper Driver", 1, "hd1");
  let n = H.state({name: "Dash", res: 9, ap: 9,
                   hand: [mk("Jump Start", 1, "j1")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}],
                   board: [{card: drv, kind: "item", spent: false, uid: "hd1"}],
                   counters: {}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  const res0 = n.sides[0].res;
  n = boostOnce(n, "j1");
  assert.equal(res0 - n.sides[0].res, 1, "the cost was paid and nothing was gained");
  assert.ok(board(n, 0).indexOf("Hyper Driver") >= 0,
    "and it is NOT destroyed: \"when this has none\" is a trigger on a removal, " +
    "not a standing state test, so a permanent that never held a counter survives");
  assert.ok(!((n.sides[0].weaponUsed || {})["cthd1"]),
    "a tick that found nothing has not used the once-per-turn ability");
});

test("DRIVEN: a tick that costs TWO cannot be paid with one (synthetic — the pool prints only 1)", {skip}, () => {
  /* Every pool tick removes exactly one counter, so the guard `have <
     t.n` and a hardcoded `have < 1` agree on every real card — the
     sabotage for it came back SILENT until this fixture existed (v3.32,
     eleventh outing). A clock that costs two and holds one must remove
     NOTHING: the alternative is a negative bag and a payload paid for
     with counters that were never there. */
  H.db();
  const twin = {name: "Twin Cog Probe", pitch: 0, tt: "Mechanologist Action - Item",
                ty: ["Mechanologist", "Action", "Item"], kw: [], cost: 0, power: null,
                uid: "tw1",
                tx: "Once per turn, when you boost a card, remove two steam counters from this and gain {r}."};
  let n = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "j1")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}],
                   board: [{card: twin, kind: "item", spent: false, uid: "tw1"}],
                   counters: {tw1: {steam: 1}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  const res0 = n.sides[0].res;
  n = boostOnce(n, "j1");
  assert.equal(((n.sides[0].counters || {}).tw1 || {}).steam, 1,
    "one counter cannot pay a two-counter cost, so nothing comes off");
  assert.equal(res0 - n.sides[0].res, 2,
    "and nothing is paid out — Jump Start costs 2 with no Hyper Driver to discount it");

  /* THE POSITIVE CONTROL, in the same state: at two counters it fires and
     takes both. A drill that only ever sees the refusal passes against an
     engine that reads no clock at all (v3.98: ask for BOTH halves). */
  let m = H.state({name: "Dash", res: 9, ap: 9, hand: [mk("Jump Start", 1, "j1")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}],
                   board: [{card: twin, kind: "item", spent: false, uid: "tw1"}],
                   counters: {tw1: {steam: 2}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  m = {...m, phase: "action", step: "layer", priority: 0, passed: [], _doBoost: true};
  const res1 = m.sides[0].res;
  m = boostOnce(m, "j1");
  assert.equal(((m.sides[0].counters || {}).tw1 || {}).steam, 0, "both come off");
  assert.equal(res1 - m.sides[0].res, 1, "and the {r} lands");
});

/* ---- 4. DRIVEN — THE PLAY CLOCK ----------------------------------- */

test("DRIVEN: Malefic Incantation unwinds a verse counter per attack action card", {skip}, () => {
  H.db();
  let n = H.state({name: "Viserai", res: 9, ap: 9,
                   hand: [mk("Malefic Incantation", 3, "mi1"), mk("Brutal Assault", 1, "a1")],
                   deck: [{uid: "f1", name: "F1"}, {uid: "f2", name: "F2"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "mi1", from: "hand"}, 0).state;
  /* THE p3 PRINTING SAYS "A VERSE COUNTER", SINGULAR, and the old reader
     wanted a digit — so this card entered with ZERO and the whole clock
     was inert while it reported `part`. */
  assert.equal(((n.sides[0].counters || {}).mi1 || {}).verse, 1,
    "it enters with the counter its own line prints");

  n = {...n, phase: "action", step: "layer", priority: 0, passed: [],
       chain: [], chainCards: [], pend: null};
  n = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0).state;
  assert.equal(((n.sides[0].counters || {}).mi1 || {}).verse, 0);
  assert.ok(board(n, 0).indexOf("Runechant") >= 0, "\"if you do\" paid out");
  assert.equal(board(n, 0).indexOf("Malefic Incantation"), -1, "and the clock ran out");
  assert.ok(n.sides[0].grave.some(c => c.name === "Malefic Incantation"),
    "AND IT REACHES THE GRAVEYARD. The inline walk this replaced simply did " +
    "not push a spent aura back onto the board, so the card was in NO zone — " +
    "which `invariants.js` cannot see, because a card in TWO zones is an " +
    "error and a card in none falls out of the census silently");
});

test("DRIVEN: a WEAPON swing is not \"playing an attack action card\"", {skip}, () => {
  H.db();
  /* The printed subject is the whole restriction (v3.65). Routed on the
     bare attack branch, a weapon swing and an ally's activated attack
     would tick a clock whose line names neither. */
  const mi = mk("Malefic Incantation", 1, "mi1");
  const wpn = mk("Dawnblade", 0, "w1");
  let n = H.state({name: "Viserai", res: 9, ap: 9, hand: [],
                   deck: [{uid: "f1", name: "F1"}],
                   gear: [Object.assign({}, wpn, {uid: "w1"})],
                   board: [{card: mi, kind: "aura", spent: false, uid: "mi1"}],
                   counters: {mi1: {verse: 3}}},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "activate", uid: "w1"}, 0);
  if(!r.error) n = r.state;
  assert.equal(((n.sides[0].counters || {}).mi1 || {}).verse, 3,
    "the weapon route never ticks a clock whose printed subject is a played card");
});

/* ---- 5. DRIVEN — THE REPRIEVE ------------------------------------- */

test("DRIVEN: Boom Grenade buys one turn with its steam counter, then dies", {skip}, () => {
  H.db();
  let n = H.state({name: "Dash", res: 5, ap: 1, hand: [mk("Boom Grenade", 1, "bg1")],
                   deck: [{uid: "f1", name: "F1"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T"}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  n = J.reduce(n, {t: "play", uid: "bg1", from: "hand"}, 0).state;
  assert.deepEqual((n.sides[0].board || []).map(b => ({n: b.card.name, sd: b.sd})),
    [{n: "Boom Grenade", sd: "turn"}],
    "the schedule is stamped on the entry exactly as the plain destroy is");
  assert.equal(steam(n, "bg1"), 1);

  const one = E.sweepArena(n, 0, "turn");
  assert.equal(one.fired.length, 0, "the reprieve is paid and nothing dies");
  assert.equal(((one.game.sides[0].counters || {}).bg1 || {}).steam, 0,
    "and the counter it was paid with is gone");
  assert.equal(one.game.sides[0].board.length, 1);
  assert.ok(one.msgs.join(" ").indexOf("pays a steam counter") >= 0,
    "the feed says which counter was spent — the sequence IS the lesson");

  const two = E.sweepArena(one.game, 0, "turn");
  assert.deepEqual(two.fired, ["Boom Grenade"],
    "with an empty bag the reprieve cannot be paid, and the printed drawback " +
    "lands — it was skipped entirely before v4.23, so the item was immortal");
  assert.equal(two.game.sides[0].board.length, 0);
  assert.ok(two.game.sides[0].grave.some(c => c.name === "Boom Grenade"));
});

/* ---- 6. THE CENSUS ------------------------------------------------ */

test("every pool record that prints a counter clock is READ (both halves pinned)", {skip}, () => {
  const raw = require("../data/pool.json");
  const C = require("../engine/cards.js");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const tick = [], empty = [], spare = [];
  for(const r of raw){
    if(!r || !r.name) continue;
    const c = C.resolveEntry(db, {name: r.name, p: r.pitch === "" || r.pitch == null ? 0 : +r.pitch,
                                  code: null, q: 1});
    if(!c) continue;
    const key = r.name + "|" + (r.pitch == null ? "" : r.pitch);
    const t = (r.functional_text || "");
    const fx = P.fxParse(c);
    if(/remove an? [a-z+{}0-9-]+ counter from (?:this|it)/i.test(t) && /^once per turn, when you /im.test(t))
      tick.push(key + (fx.ctrTick ? "" : " UNREAD"));
    if(/when (?:it|this) has (?:none|no [a-z+{}0-9-]+ counters?), destroy it/i.test(t))
      empty.push(key + (fx.emptyDies ? "" : " UNREAD"));
    if(/destroy this unless you remove/i.test(t))
      spare.push(key + ((fx.ops || []).some(o => o[0] === "selfDestruct" && o[2]) ? "" : " UNREAD"));
  }
  /* PINNED AS SETS, not counts (v3.98, v4.17): two records swapping
     buckets keeps every number intact, and a scan that stops matching
     returns an empty set which satisfies "all of them read" perfectly. */
  assert.deepEqual(tick.sort(), [
    "Hyper Driver|", "Hyper Driver|1", "Hyper Driver|2", "Hyper Driver|3",
    "Malefic Incantation|1", "Malefic Incantation|2", "Malefic Incantation|3"]);
  assert.deepEqual(empty.sort(), [
    "Hyper Driver|", "Hyper Driver|1", "Hyper Driver|2", "Hyper Driver|3",
    "Malefic Incantation|1", "Malefic Incantation|2", "Malefic Incantation|3"]);
  assert.deepEqual(spare.sort(), [
    "Boom Grenade|1", "Boom Grenade|2", "Boom Grenade|3", "Golden Cog|",
    /* ZEN STATE IS IN THE SCAN AND DELIBERATELY UNREAD: its counter is
       `balance`, which nothing consumes, and its other two clauses have no
       reader either. Half-building a card is worse than the honest gap
       (v3.23) — so it is pinned as UNREAD rather than left out of the
       census, where a later widening would be invisible. */
    "Zen State| UNREAD"]);
});

test("`enterCounters` is gone, and nothing writes a field with no reader", () => {
  const fs = require("node:fs"), path = require("node:path");
  const root = path.join(__dirname, "..");
  for(const f of ["engine/parser.js", "engine/effects.js"]){
    const src = fs.readFileSync(path.join(root, f), "utf8")
      .split("\n").filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join("\n");
    assert.equal(/\benterCounters\b/.test(src), false,
      f + " still names the dead op — it stashed `_enterCounters` and " +
      "nothing ever read that field");
  }
});
