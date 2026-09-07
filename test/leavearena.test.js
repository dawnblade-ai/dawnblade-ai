/* test/leavearena.test.js — A PRINTED TRIGGER FIRED ON TWO EXITS OF SEVEN (v4.29)
 *
 * "When this leaves the arena, X" fires however the card leaves. It was
 * read in exactly two of the arena's exits — the suspense counter running
 * out, and the card's own printed clock — and both of those are exits the
 * card SCHEDULES FOR ITSELF. Every exit somebody else forced paid nothing.
 *
 * DRIVEN, seat 0 holding Act of Glory (`onLeave: [["buffNext", 6]]`):
 *
 *   suspense runs out          fired, ops [["buffNext",6]]
 *   destroyed by Condemn       board 0, grave 1, ops [], buffNext 0
 *
 * LIVE and CROSS-SEAT. Condemn to Slaughter is Viserai's, the four decked
 * cards that print the trigger are Lyath's and Bravo's, and Condemn's
 * rider (`foeDestroyAura`, v3.20) makes the OPPONENT destroy one.
 *
 * AND NO TOOL HERE COULD SEE IT. All four read `tier: full` — the clause
 * IS consumed, into `fx.onLeave`, faithfully — and every one of these is a
 * payout the controller was promised and did not get, which is the
 * direction the one-sided fairness sweep is built not to look in.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const PR = require("../engine/prompts.js");
const C = require("../engine/cards.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
const gate = t => H.hasDb() ? t : { skip: true };

const AURA = () => {
  const c = H.card("Act of Glory", 1);
  return {card: c, kind: "aura", spent: false, uid: c.uid, sd: null};
};

/* ---- the reader is one body ---------------------------------------- */

test("`leavePayout` is the one reader of what a departing card pays", () => {
  /* Three sites asked `P.fxParse(card).onLeave` by hand. Two copies of one
     rule is where the drift starts, and this one had already drifted into
     "the two exits the card schedules for itself". */
  assert.equal((SRC.match(/function leavePayout\(/g) || []).length, 1,
    "there is exactly one body");
  /* EXCLUDE THE BODY ITSELF, or the scan reports the one legitimate reader
     as a violation — a guard aimed at the wrong shape fails by finding
     the thing it exists to permit. Bounded at the next same-indent
     declaration, which is v4.05's lesson about a slice that swallowed
     three hundred lines of neighbours. */
  const bi = SRC.indexOf("function leavePayout(");
  const be = SRC.indexOf("\nfunction ", bi + 10);
  const outside = SRC.slice(0, bi) + SRC.slice(be);
  const raw = (outside.match(/fxParse\([^)]*\)\.onLeave/g) || []);
  assert.equal(raw.length, 0,
    "every reader goes through `leavePayout`; found a hand-rolled one: " + JSON.stringify(raw));
  assert.match(SRC, /leavePayout,/, "exported, because judge.js and the drills both ask it");
});

test(gate("it reads the printed clause and nothing else"), () => {
  const glory = H.card("Act of Glory", 1);
  assert.deepEqual(E.leavePayout(glory), [["buffNext", 6]],
    "Act of Glory prints +6 at pitch 1");
  /* THE AMOUNT IS THE CARD'S. Its three printings read 6 / 5 / 4, so a
     hardcoded number is right for one and silently wrong for two — the
     rule this project has needed a synthetic for eleven times, and here
     the pool proves it (v3.89's Shred, one trigger over). */
  assert.deepEqual(E.leavePayout(H.card("Act of Glory", 3)), [["buffNext", 4]]);
  /* A card printing no such clause pays nothing, and a missing card
     answers `[]` rather than throwing — `reduce` is fed by JSON off a
     wire, so an entry with no card must cost a payout, never a crash. */
  assert.deepEqual(E.leavePayout(H.card("Raging Onslaught", 1)), []);
  assert.deepEqual(E.leavePayout(null), []);
});

/* ---- the exits ------------------------------------------------------ */

test(gate("the exit the card schedules for itself still pays"), () => {
  /* THE CONTROL. A fix that only ever proved the new route would pass
     just as well having broken the two that already worked. */
  const g = H.state({board: [Object.assign(AURA(), {susp: 1})]}, {});
  const out = E.tickSuspense(g, 0);
  assert.deepEqual(out.fired, ["Act of Glory"]);
  assert.deepEqual(out.ops, [["buffNext", 6]], "suspense running out pays it");
});

const condemn = (g, side) => {
  const spec = {tag: "pick", side, src: "Condemn to Slaughter", zone: "board",
                to: "grave", filter: {tt: "aura"}, min: 1, max: 1};
  const built = PR.buildPrompt(g, spec);
  assert.ok(built, "the sheet must open — an aura is on that board");
  return H.fx(g, (f, n) => f.applyAnswer(n, Object.assign({}, built, {sel: [0]})));
};

test(gate("an aura DESTROYED pays what it printed about leaving"), () => {
  const g = H.state({board: [AURA()]}, {});
  const after = condemn(g, 0);
  assert.equal(after.sides[0].board.length, 0, "it left the arena");
  assert.equal(after.sides[0].grave.length, 1, "and reached the graveyard");
  assert.equal(after.sides[0].buffNext, 6,
    "and paid — this was 0 before v4.29, with the card reading `tier: full`");
});

test(gate("the payout is the CONTROLLER's, not the destroyer's"), () => {
  /* `foeDestroyAura` addresses its pick to the OPPOSING seat, so the aura
     that dies is seat 1's and "your next attack" is seat 1's. Read from
     the ambient actor the +6 lands on whoever condemned it — v3.46's
     borrowed-seat inversion, one trigger over. */
  const g = H.state({}, {board: [AURA()]}, {actor: 0});
  const after = condemn(g, 1);
  assert.equal(after.sides[1].buffNext, 6, "the aura's controller is paid");
  assert.equal(after.sides[0].buffNext, 0, "and the seat that destroyed it is NOT");
  assert.equal(after.actor, 0, "and the borrowed seat is handed back");
});

test(gate("a pick from another zone pays nothing"), () => {
  /* `p.zone` is where the pick came FROM. A graveyard pick is not a card
     leaving the arena, and paying there would fire the trigger off a card
     that was never in play — the same clause read on the wrong event. */
  const glory = H.card("Act of Glory", 1);
  const g = H.state({grave: [glory], board: []}, {});
  const spec = {tag: "pick", side: 0, src: "probe", zone: "grave", to: "hand",
                filter: {tt: "aura"}, min: 1, max: 1};
  const built = PR.buildPrompt(g, spec);
  assert.ok(built, "the graveyard sheet opens");
  const after = H.fx(g, (f, n) => f.applyAnswer(n, Object.assign({}, built, {sel: [0]})));
  assert.equal(after.sides[0].buffNext, 0, "a graveyard pick is not an arena exit");
  assert.equal(after.sides[0].hand.length, 1, "and the card really did move");
});

/* ---- the partition, both sides (v4.17) ------------------------------ */

/* WHICH ROUTES PAY IS A JUDGEMENT AND NO SCAN CAN MAKE IT, so it is a PIN
   rather than a derivation: moving a name is a deliberate edit, which is
   the moment somebody states what that exit means. Pinning the payers
   alone cannot see a name LEAVING the list; pinning the exclusions too is
   what makes a removal fail, because a route has to land somewhere. */
const PAYS = [
  "tickSuspense",       /* the suspense counter runs out (v3.07) */
  "sweepArena",         /* the card's own printed clock, incl. v4.23's counter clock */
  "applyAnswer",        /* a board->grave PICK — Condemn's cost and its cross-seat rider */
  "destroyFoeToken",    /* a named token on the opposing board */
  "abDestroyBoard",     /* v3.86's named-permanent activation cost */
  "card.sd",            /* an arena permanent's own "destroy this" cost — the
                           trainer's `boardPow` builds the powCard, and
                           `execute` recognises the route by the schedule
                           stamped on it (v2.35). Named for what is in THIS
                           file, because a pin that names a symbol living in
                           another one passes by finding nothing. */
  "hitWatch"            /* v4.25's watcher destroying itself on somebody else's hit */
];
const EXCLUDED = {
  atkTrigAt:       "the token's own trigger IS the payload (v3.22) — paying `onLeave` too would be VALUE-DOUBLED on the sweep's own terms",
  resolveInertia:  "removes the Inertia token, which prints no leave clause",
  thawFrost:       "removes a Frostbite, which prints no leave clause"
};

test("every board-removal route is on exactly one side of the partition", () => {
  const named = [...PAYS, ...Object.keys(EXCLUDED)];
  assert.equal(new Set(named).size, named.length, "a route belongs to one side, not both");
  for(const r of PAYS)
    assert.ok(SRC.indexOf(r) > 0, "a payer that is not in the source: " + r);
  for(const r of Object.keys(EXCLUDED))
    assert.ok(SRC.indexOf(r) > 0, "an exclusion that is not in the source: " + r);
  /* THE POSITIVE CONTROL. An empty exclusion list satisfies "every
     exclusion is real" perfectly, and would delete the half of the pin
     that says a route was thought about and left out on purpose. */
  assert.ok(Object.keys(EXCLUDED).length >= 3,
    "the exclusions are the half that records a decision");
  assert.ok(PAYS.length >= 7, "and the payers are the half that records the rule");
});

test(gate("no token an engine can create carries an onLeave — measured"), () => {
  /* THE EXCLUSIONS REST ON THIS, so it is measured rather than asserted.
     Exactly one token in 797 records emits `onLeave` (Sigil of Fate) and
     NOTHING in the pool creates it — so the three token routes cannot
     today drop a payout. The day a card creates one, this fails and the
     exclusion has to be re-argued. */
  const pool = require("../data/pool.json").filter(c => c && c.name).map(C.mapDbCard);
  const seen = new Set(), toks = [];
  for(const r of pool){
    const k = r.n + "|" + r.p; if(seen.has(k)) continue; seen.add(k);
    if(!/token/i.test(r.tt || "")) continue;
    const fx = P.fxParse({name: "leave-probe|" + k, pitch: r.p, tt: r.tt, ty: r.ty, kw: r.kw, tx: r.tx});
    if((fx.onLeave || []).length) toks.push(r.n);
  }
  assert.deepEqual([...new Set(toks)], ["Sigil of Fate"],
    "the token census moved — re-argue the three token exclusions");
  const creators = pool.filter(c => /sigil of fate/i.test(c.tx || "")
                                 && !/^sigil of fate$/i.test(c.n || ""));
  assert.equal(creators.length, 0,
    "something now creates Sigil of Fate, so a token route can drop its opt");
});

test(gate("and the four cards that print it are decked, so this is not latent"), () => {
  /* v3.57 refused this clause and recorded WHY: "`fx.onLeave` has exactly
     ONE caller, `tickSuspense`, and nothing in this engine can make it
     leave the arena." The first half stopped being true at v3.20, when
     `sweepArena` began paying it too — and the second half was never
     about these cards at all. A recorded reason is only as good as the
     day it was measured (v3.69). */
  const db = H.db();
  const G = require("../engine/game.js");
  const W = require("./helpers/extract.js").loadData();
  const decked = new Set();
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(db, e);
      if(c && E.leavePayout(c).length) decked.add(c.name);
    }
  }
  assert.deepEqual([...decked].sort(),
    ["Act of Glory", "Booze!", "Edge of Their Seats", "Tension in the Air"],
    "the decked set moved — re-derive the blast radius");
});

/* ---- the borrow, where it is the whole question --------------------- */

test(gate("a cross-seat destroy pays the CONTROLLER and hands the seat back"), () => {
  /* THE PICK ROUTE CANNOT ASK THIS. `applyAnswer` has already borrowed the
     actor to `p.side` twenty lines above the payout, so a sabotage that
     reads the ambient actor there is a NO-OP and comes back silent — the
     fixture cannot express the bug (v3.62). `destroyFoeToken` is the site
     where the two genuinely differ: the actor is the DESTROYER and the
     aura is the other seat's.

     LATENT AND DRIVEN ANYWAY. `classifyClause` emits the op and no pool
     card sets it, so the fixture is synthetic (v3.73) — a printed rule
     that only one route can reach is still a rule, and the day a card
     prints one this is already right. */
  const g = H.state({}, {board: [AURA()]}, {actor: 0});
  const after = H.runOps(g, [["destroyFoeToken", "Act of Glory"]], "probe");
  assert.equal(after.sides[1].board.length, 0, "the foe's aura is destroyed");
  assert.equal(after.sides[1].grave.length, 1, "and filed");
  assert.equal(after.sides[1].buffNext, 6,
    "the payout is the AURA's controller's — read from the ambient actor it " +
    "lands on whoever destroyed it (v3.46's inversion, one trigger over)");
  assert.equal(after.sides[0].buffNext, 0, "and the destroyer gets nothing");
  assert.equal(after.actor, 0,
    "and the borrowed seat is handed BACK, or every rule after it in the " +
    "same resolution runs for the wrong hero");
});

test(gate("a destroyed permanent with no leave clause pays nothing"), () => {
  /* THE NEGATIVE CONTROL, in the same state. A payout that fires for every
     departing card would satisfy every assertion above and be a grant no
     text prints. */
  const plain = H.card("Raging Onslaught", 1);
  const g = H.state({}, {board: [{card: plain, kind: "aura", spent: false, uid: plain.uid}]}, {actor: 0});
  const after = H.runOps(g, [["destroyFoeToken", "Raging Onslaught"]], "probe");
  assert.equal(after.sides[1].board.length, 0, "it is still destroyed");
  assert.equal(after.sides[1].buffNext, 0, "and pays nothing");
  assert.ok(!(after.feed || []).some(l => /pays out/.test(l)),
    "and the feed does not announce a payout that did not happen");
});

/* ---- the two exits that already worked, so a collapse cannot break them ---- */

test(gate("the printed CLOCK still pays it — sweepArena's half"), () => {
  /* THE SECOND CONTROL, and the one the one-body collapse could have
     broken silently: `sweepArena` was reading `f.onLeave` by hand and now
     asks `leavePayout`. Booze! prints `[boo 1, selfDestruct turn]` with
     `onLeave: [boo 1]`, so its ops after the destroy are EMPTY and the
     payout here is the leave clause alone — which is what makes this
     fixture able to tell the two halves apart (v3.26). */
  const b = H.card("Booze!", 3);
  const g = H.state({board: [{card: b, kind: "aura", spent: false, uid: b.uid, sd: "turn"}]}, {});
  const out = E.sweepArena(g, 0, "turn");
  assert.deepEqual(out.fired, ["Booze!"]);
  assert.deepEqual(out.ops, [["boo", 1]],
    "the printed clock pays the leave clause — 0 ops means the collapse ate it");
});

test(gate("a named-permanent COST is an exit too (v3.86's route)"), () => {
  /* LATENT AND DRIVEN. Gravy Bones' `destroy a Gold you control` is the
     pool's only cost of its shape and Gold prints no leave clause, so the
     route can drop a payout today only against a synthetic — which is the
     point: the card leaving is leaving however it left.

     `fxParse` MEMOIZES ON `name|pitch`, and this fixture has to be named
     Gold because the route matches the printed NAME. Without the reset it
     poisons that key for every later reader in the process, which is the
     documented drill gotcha inside a drill about a route (v4.04). */
  P.fxReset();
  try {
    const glory = H.card("Act of Glory", 1);
    const fake = Object.assign({}, glory, {name: "Gold", uid: "tokLEAVE"});
    const hpow = {name: "probe-hero-power", pitch: 0, uid: "hpow",
                  tt: "Hero Ability", tx: "Draw a card.",
                  _destroyBoard: "Gold", _effFull: "Draw a card."};
    const g = H.state({board: [{uid: "tokLEAVE", kind: "item", spent: false, card: fake}],
                       res: 5}, {});
    const after = H.execute(g, hpow, "hero", 0, {});
    assert.equal((after.sides[0].board || []).length, 0, "the named permanent is destroyed");
    assert.equal(after.sides[0].buffNext, 6,
      "and it pays what it printed about leaving the arena");
  } finally { P.fxReset(); }
});

/* ---- the two latent exits, driven with synthetics (v3.73) ----------- */

test(gate("a watcher that destroys ITSELF pays for leaving (v4.25's route)"), () => {
  /* LATENT, MEASURED, AND DRILLED ANYWAY. The pool's one `hitWatch` record
     is Boom Grenade, which prints no leave clause — so nothing real can
     drop a payout here, and a reader that ignores the printed distinction
     is reading a card wrong whether or not anything notices today (v3.73).
     The synthetic carries BOTH printed sentences on one permanent. */
  const J = H.J;
  P.fxReset();
  try {
    const bg = Object.assign({}, H.card("Boom Grenade", 1), {uid: "bg1",
      name: "Leave Probe Grenade",
      tx: "When a Mechanologist attack action card you control hits a hero, " +
          "destroy this and deal 4 damage to them.\n" +
          "When this leaves the arena, your next attack this turn gets +6{p}."});
    const fxw = P.fxParse(bg);
    assert.ok(fxw.hitWatch && fxw.hitWatch.selfDestroy, "the fixture is a self-destroying watcher");
    assert.deepEqual(E.leavePayout(bg), [["buffNext", 6]], "and it prints a leave clause");

    const atk = Object.assign({}, H.card("Zipper Hit", 1), {uid: "a1"});
    let n = H.state({name: "Dash", res: 9, ap: 9, hand: [atk], deck: [{uid: "f1", name: "F1"}],
                     board: [{card: bg, kind: "item", spent: false, uid: "bg1", sd: "turn"}]},
                    {name: "Them", deck: [{uid: "d1", name: "T"}], hp: 20},
                    {actor: 0, turnPlayer: 0, seed: "lv", turn: 3});
    n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
    const r = J.reduce(n, {t: "play", uid: "a1", from: "hand"}, 0);
    assert.ok(!r.error, String(r.error));
    n = r.state;
    const S = require("../engine/sparring.js");
    for(let i = 0; i < 24; i++){
      const seat = n.priority == null ? 0 : n.priority;
      const a = S.act(n, seat); if(!a) break;
      const q = J.reduce(n, a, seat); if(q.error) break;
      n = q.state;
      if(!n.pend && (!n.chain || !n.chain.length)) break;
    }
    assert.equal((n.sides[0].board || []).filter(b => b && b.uid === "bg1").length, 0,
      "the watcher destroyed itself on the hit");
    assert.equal(n.sides[0].buffNext, 6,
      "and paid what it printed about leaving the arena");
  } finally { P.fxReset(); }
});

test(gate("an arena permanent's own destroy-this cost is an exit too"), () => {
  /* THE FOURTH LATENT ROUTE. `boardPow` (v2.35) builds a powCard for an
     arena permanent printing "Destroy this: X"; `execute` recognises the
     route by the schedule stamped on it. Measured: no pool card prints
     both an activated destroy-this and a leave clause, so this too is a
     synthetic — and the uid convention (`"bp" + entry uid`) is what the
     route matches on, so the fixture has to speak it. */
  P.fxReset();
  try {
    const glory = H.card("Act of Glory", 1);
    const ent = {card: Object.assign({}, glory, {uid: "ap1"}), kind: "aura",
                 spent: false, uid: "ap1", sd: "turn"};
    const pow = {name: "probe-arena-power", pitch: 0, uid: "bpap1", tt: "Arena Ability",
                 tx: "Draw a card.", sd: "turn", _effFull: "Draw a card."};
    const g = H.state({board: [ent], res: 5, deck: [{uid: "f1", name: "F1"}]}, {});
    const after = H.execute(g, pow, "board", 0, {});
    assert.equal((after.sides[0].board || []).length, 0, "the permanent paid itself as the cost");
    assert.equal(after.sides[0].buffNext, 6, "and paid its leave clause on the way out");
  } finally { P.fxReset(); }
});

/* ---- the gate rides with the payload (v4.30) ------------------------ */

const WV = () => {
  const c = H.card("Waning Vengeance", 1);
  return {card: c, kind: "aura", spent: false, uid: c.uid, sd: null};
};
const BLUE = () => H.card("Ice Bolt", 3);

test(gate("the GATE decides, and both halves are driven"), () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING. A gate that refuses
     everything passes the unmet half perfectly, and one that grants
     everything passes the met half — the pair is what tests anything. */
  P.fxReset();
  try {
    const wv = H.card("Waning Vengeance", 1);
    assert.deepEqual(P.fxParse(wv).condOnLeave,
      [{cond: "pitchBlue1", op: ["token", "spectral shield", 1, "self"]}]);

    const unmet = H.state({board: [WV()], pitch: []}, {});
    assert.deepEqual(E.leavePayout(wv, unmet.sides[0]), [],
      "no blue pitched — the gate refuses and nothing is minted");

    const met = H.state({board: [WV()], pitch: [BLUE()]}, {});
    assert.deepEqual(E.leavePayout(wv, met.sides[0]),
      [["token", "spectral shield", 1, "self"]],
      "a blue in the pitch zone — the gate opens");

    /* AND A CALLER THAT SAYS NOTHING GETS NOTHING (v3.24, v3.36, v3.87).
       Weaker than printed and visible, never a payload granted off a
       condition nobody answered. */
    assert.deepEqual(E.leavePayout(wv, null), [],
      "a caller that names no side grants nothing");
  } finally { P.fxReset(); }
});

test(gate("driven: destroying it mints the Shield only when the gate is met"), () => {
  P.fxReset();
  try {
    for (const [label, pitch, want] of [["gate unmet", [], 0], ["gate met", [BLUE()], 1]]) {
      const g = H.state({board: [WV()], pitch}, {});
      const spec = {tag: "pick", side: 0, src: "Condemn to Slaughter", zone: "board",
                    to: "grave", filter: {tt: "aura"}, min: 1, max: 1};
      const built = PR.buildPrompt(g, spec);
      assert.ok(built, "the sheet opens");
      const after = H.fx(g, (f, n) => f.applyAnswer(n, Object.assign({}, built, {sel: [0]})));
      const shields = (after.sides[0].board || [])
        .filter(b => b && b.card && /spectral shield/i.test(b.card.name || "")).length;
      assert.equal(shields, want, label + ": expected " + want + " Spectral Shield");
      assert.equal((after.sides[0].board || []).filter(b => b && b.uid === WV().uid).length, 0,
        label + ": the aura left either way — the gate is on the PAYLOAD, not the exit");
    }
  } finally { P.fxReset(); }
});

test("the gated-leave condition vocabulary is CLOSED, and the pool is inside it", () => {
  /* v3.96's rule for `condOnHit`, one trigger over: the parser emits into
     this list and an evaluator answers it, and nothing compared them. A
     condition the evaluator does not know answers FALSE — weaker than
     printed and visible — and this fails the day the pool emits one that
     is not named, rather than the payload quietly never firing. */
  const pool = require("../data/pool.json").filter(c => c && c.name).map(C.mapDbCard);
  const seen = new Set(), emitted = new Set(), cards = new Set();
  for(const r of pool){
    const k = r.n + "|" + r.p; if(seen.has(k)) continue; seen.add(k);
    const fx = P.fxParse({name: "gl-probe|" + k, pitch: r.p, tt: r.tt, ty: r.ty, kw: r.kw, tx: r.tx});
    for(const e of (fx.condOnLeave || [])){ emitted.add(e.cond); cards.add(r.n); }
  }
  assert.deepEqual([...emitted].sort(), ["pitchBlue1"],
    "a gate the evaluator has not been taught: " +
    [...emitted].filter(c => E.CONDONLEAVE_CONDS.indexOf(c) < 0).join(", "));
  for(const c of emitted)
    assert.ok(E.CONDONLEAVE_CONDS.indexOf(c) >= 0, "unnamed in the census: " + c);
  assert.deepEqual([...cards], ["Waning Vengeance"],
    "the pool's only gated leave-trigger — re-derive the blast radius if this moves");
  /* THE POSITIVE CONTROL. A census over an empty set satisfies "every
     emitted gate is named" perfectly (v3.98: ask for the refusal). */
  assert.ok(emitted.size > 0, "the scan must actually find the card it exists for");
  assert.equal(E.condOnLeaveMet("noSuchGate", {pitch: [BLUE()]}), false,
    "and an unknown gate answers FALSE rather than falling through");
});
