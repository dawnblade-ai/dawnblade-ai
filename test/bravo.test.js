/* ============================================================
   BRAVO'S LAST TWO CARDS (v3.33)

   His ONE mechanic is the arsenal — the hero ability turns a face-down
   arsenal card face up and rewards crush, and heave (v3.32) puts one
   there face up. What was left was the two cards that mint his keystone
   token, and each needed one small thing the engine could not yet say:

     Crash and Bash      "When this defends, you may REVEAL a card WITH
                          CRUSH from your hand. If you do, create a
                          Seismic Surge token."
     Magmatic Carapace   "Whenever you play an aura, you may {t} THIS and
                          pay {r}. If you do, create a Seismic Surge
                          token."

   THREE THINGS, AND EACH IS A HABITAT RATHER THAN A CAGE: a REVEAL is a
   cost that moves nothing, "with <keyword>" is a printed field once
   `printedKw` can answer it, and a {t} in a pay-cost is part of the cost.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const PM = require("../engine/prompts");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* ---- 1. A REVEAL IS A COST THAT MOVES NOTHING ----------------------- */

test("Crash and Bash reads its whole clause", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Crash and Bash", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.optCost, {
    trigger: "defends", kind: "reveal", zone: "hand",
    filter: {kw: "crush"}, ops: [["token", "seismic surge", 1, "self"]]
  });
});

test("a reveal spec has NO destination — the card stays where it was", {skip}, () => {
  H.db();
  P.fxReset();
  /* DRIVEN THROUGH THE REAL QUEUE SITE. The first draft of this built the
     spec BY HAND and handed it to `buildPrompt`, which measures the sheet
     rather than what the engine puts in it — and `optCostSpec` is exactly
     the thing under test. Sabotaged (filing a reveal to the graveyard) it
     stayed green, which is v3.20's condemn lesson repeating: a drill that
     constructs its own fixture proves the fixture. */
  const cb = {...H.card("Crash and Bash", 1), uid: "d1"};
  const crush = {...H.card("Boulder Drop", 1), uid: "h9"};
  let g = H.state({res: 9}, {hand: [crush], res: 9}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g = {...g, pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"},
                    by: 0, total: 7, ga: false, ops: [], onHit: []}, stack: []};
  const out = J.withEffects(g, (fx, s2) => fx.afterDefenders(s2, [cb]));
  assert.ok(out.prompt, "the real sheet opens");
  assert.ok(!out.prompt.to,
    "a reveal has no destination — sending it to the graveyard would spend a card "
    + "the printed text never spends. (`applyPrompt` tests `if(to)`, so null and "
    + "absent are the same answer; what must never appear is a real zone.)");
  assert.equal(out.prompt.zone, "hand", "and it is read from the hand");
  assert.equal(out.prompt.min, 0, "optional — 'you MAY reveal'");
});

test("driven: revealing pays nothing and still mints the token", {skip}, () => {
  H.db();
  P.fxReset();
  const crush = {...H.card("Boulder Drop", 1), uid: "h1"};
  assert.equal(P.printedKw(crush, "crush"), true, "fixture must actually carry crush");
  let g = H.state({hand: [crush], res: 9}, {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const spec = {tag: "pick", side: 0, src: "Crash and Bash", zone: "hand",
    filter: {kw: "crush"}, min: 0, max: 1,
    ops: [["token", "seismic surge", 1, "self"]]};
  const live = PM.buildPrompt(g, spec);
  const answered = J.withEffects(g, (fx, s) =>
    fx.applyAnswer(s, {...live, sel: [0]}));
  assert.equal(answered.sides[0].hand.length, 1, "the card is SHOWN, not spent");
  assert.equal(answered.sides[0].hand[0].uid, "h1", "and it is the same card");
  assert.equal(answered.sides[0].grave.length, 0, "nothing reached the graveyard");
  assert.equal(answered.sides[0].board.length, 1, "and the token was created");
  assert.equal(answered.sides[0].board[0].card.name, "Seismic Surge");
});

/* ---- 2. "WITH <KEYWORD>" IS A PRINTED FIELD ------------------------- */

test("the filter asks printedKw — CARRIES the keyword, not merely names it", {skip}, () => {
  H.db();
  const f = PM.promptFilter({kw: "crush"});
  const carries = H.card("Boulder Drop", 1);          /* prints "Crush - ..." */
  const names = H.card("Flatten the Field", 3);       /* also prints crush */
  const neither = H.card("Raging Onslaught", 1);
  assert.equal(f(carries), true);
  assert.equal(f(neither), false, "a vanilla attack carries nothing");
  void names;
  /* A CARD THAT ONLY MENTIONS THE WORD IS NOT A LEGAL REVEAL. `hasKw` is
     deliberately loose and answers TRUE for both — which is exactly why
     it is the wrong predicate here. */
  const mentions = {name: "Mentions Crush", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], power: 4, kw: [],
    tx: "When you play a card with crush, draw a card."};
  assert.equal(P.hasKw(mentions, "crush"), true, "the loose predicate says yes");
  assert.equal(f(mentions), false, "…and the filter must still say no");
});

test("the keyword list is CLOSED — an unknown word still refuses", () => {
  /* Widening "with <anything>" would re-open the hole the old refusal was
     protecting: a dynamic limit would read as a keyword and be dropped. */
  assert.deepEqual(P.optFilter("a card with crush"), {kw: "crush"});
  assert.equal(P.optFilter("a card with sparkles"), null);
  assert.equal(P.optFilter("a card"), null, "a bare 'card' restricts nothing");
});

/* ---- 3. THE DEFENDS TRIGGER, ON BOTH BOARDS ------------------------- */

test("the defends trigger fires from afterDefenders — the shared body", () => {
  /* A schedule is written per board (v3.01), so the thing that matters is
     that this one is NOT: `afterDefenders` is where phantasm already
     lives, it already takes the wall as the CALLER's answer, and both
     boards already call it. Comments stripped. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = src.indexOf("const afterDefenders = (s, wall) =>");
  assert.ok(i > 0, "afterDefenders moved — re-anchor this drill");
  const body = src.slice(i, src.indexOf("THE LINK RESOLVES, IN THREE PIECES", i))
    /* COMMENTS STRIPPED. The prose right above this trigger EXPLAINS that
       judge holds its declarations on `blockH`, so an unstripped scan
       reports the explanation as the violation — the same prose
       false-positive `test/sync.test.js` documents. */
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(body, /trigger !== "defends"/, "the trigger is read here");
  assert.ok(!/blockH|k\s*===\s*"def"/.test(body),
    "and the wall is still the caller's answer — reading either board's shape "
    + "is how phantasm came to work on one board and not the other");
});

test("it is addressed to the DEFENDER, never the actor", {skip}, () => {
  H.db();
  P.fxReset();
  /* Inside a link the actor is the ATTACKER — judge sets it from `link.by`
     — so billing `actorOf` would offer the attacking hero a choice printed
     on their opponent's blocker. */
  const cb = {...H.card("Crash and Bash", 1), uid: "d1"};
  const crush = {...H.card("Boulder Drop", 1), uid: "h9"};
  let g = H.state({res: 9}, {hand: [crush], res: 9}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g = {...g, pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"},
                    by: 0, total: 7, ga: false, ops: [], onHit: []}, stack: []};
  const out = J.withEffects(g, (fx, s) => fx.afterDefenders(s, [cb]));
  assert.ok(out.prompt, "the sheet opens");
  assert.equal(out.prompt.side, 1, "seat 1 is defending — it is THEIR reveal");
  assert.equal(out.prompt.src, "Crash and Bash");
});

test("a defender printing no such trigger opens nothing", {skip}, () => {
  H.db();
  P.fxReset();
  /* AND THIS IS THE CONTROL THAT MATTERS: a blanket drain here opened
     whatever else was queued, mid-combat, and stalled three drills at the
     damage step on cards with no defends trigger at all. */
  const plain = {...H.card("Wounding Blow", 1), uid: "d2"};
  let g = H.state({res: 9}, {res: 9}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g = {...g, promptQ: [{tag: "opt", side: 0, n: 1}],
       pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"},
              by: 0, total: 7, ga: false, ops: [], onHit: []}, stack: []};
  const out = J.withEffects(g, (fx, s) => fx.afterDefenders(s, [plain]));
  assert.ok(!out.prompt, "nothing opens — a queued prompt is drained by whoever queued it");
  assert.equal((out.promptQ || []).length, 1, "and it is still waiting");
});

/* ---- 4. THE TAP IS PART OF THE COST --------------------------------- */

test("Magmatic Carapace reads the tap, the cost and the trigger", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Magmatic Carapace", 0));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.payCost, {trigger: "playAura", cost: 1, taps: true,
    ops: [["token", "seismic surge", 1, "self"]]});
});

const carapaceTurn = () => {
  P.fxReset();
  const g = H.state({gear: [{...H.card("Magmatic Carapace", 0), uid: "mc1"}],
                     res: 9, ap: 1,
                     hand: [{...H.card("Edge of Their Seats", 1), uid: "a1"},
                            {...H.card("Tension in the Air", 1), uid: "a2"}]},
                    {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  return g;
};

test("driven: playing an aura offers it, and paying taps the piece", {skip}, () => {
  H.db();
  const g = carapaceTurn();
  const n = H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  assert.ok(n.prompt, "the offer opens");
  assert.equal(n.prompt.tag, "pay");
  assert.equal(n.prompt.cost, 1);
  assert.equal(n.prompt.src, "Magmatic Carapace");

  const paid = J.withEffects(n, (fx, s) => fx.applyAnswer(s, {...s.prompt, choice: "pay"}));
  assert.equal(paid.sides[0].res, 9 - 3 - 1, "the aura's cost, then the {r}");
  assert.ok(paid.sides[0].board.some(b => b.card.name === "Seismic Surge"),
    "and the token is minted under its PRINTED name");
  assert.equal((paid.sides[0].weaponUsed || {}).mc1, true, "the piece is tapped");
});

test("the TAP makes it once per turn on a card that never prints it", {skip}, () => {
  H.db();
  const g = carapaceTurn();
  let n = H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  n = J.withEffects(n, (fx, s) => fx.applyAnswer(s, {...s.prompt, choice: "pay"}));

  /* A tapped permanent does not untap until CR 4.4.3d, which is what
     limits this without the card printing "Once per Turn". Reading only
     the {r} makes it repeatable — strictly stronger than printed, and the
     Scorpio-vs-Sledge shape (v2.42). */
  let mid = {...n, prompt: null, promptQ: []};
  mid.sides = n.sides.slice();
  mid.sides[0] = {...mid.sides[0], ap: 1, hand: [{...H.card("Tension in the Air", 1), uid: "a2"}]};
  const second = H.execute(mid, mid.sides[0].hand[0], "hand", 0, {});
  assert.ok(!second.prompt, "a second aura the same turn offers nothing");
  assert.equal(second.sides[0].board.filter(b => b.card.name === "Seismic Surge").length, 1,
    "and exactly one token exists");
});

test("declining costs nothing and taps nothing", {skip}, () => {
  H.db();
  const g = carapaceTurn();
  const n = H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  const no = J.withEffects(n, (fx, s) => fx.applyAnswer(s, {...s.prompt, choice: "decline"}));
  assert.equal(no.sides[0].res, 9 - 3, "only the aura was paid for");
  assert.ok(!no.sides[0].board.some(b => b.card.name === "Seismic Surge"), "no token");
  assert.ok(!(no.sides[0].weaponUsed || {}).mc1, "and the piece is untapped — v2.04's rule");
});

test("the watcher is found in GEAR, not only on the board", {skip}, () => {
  H.db();
  /* Every other trigger in that block asks the resolving card about
     itself. This one asks what is WATCHING, and Magmatic Carapace is a
     Chest piece — a scan of the board alone finds nothing at all. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = src.indexOf('trigger === "playAura"');
  assert.ok(i > 0, "the playAura site moved — re-anchor this drill");
  const body = src.slice(Math.max(0, i - 700), i + 300);
  assert.match(body, /act\(n\)\.gear/, "the gear must be scanned");
  assert.match(body, /act\(n\)\.board/, "and the board");
});

/* ---- 5. THE TOKEN'S PRINTED NAME ------------------------------------ */

test("a token minted from card text carries its PRINTED name", {skip}, () => {
  H.db();
  /* `classifyClause` works on the lowercased clause and `resolveEntry`
     returns the ENTRY's name by design (v2.48), so every token the parser
     minted reached the board as "seismic surge" / "might" / "frostbite" —
     twelve names across a dozen cards, shown to the player. The v3.21
     shape exactly: a lowercased capture riding onto the board.

     The DATABASE is the authority for what a card is called, as it is for
     everything else on it. */
  for(const [op, printed] of [
    ["might", "Might"], ["frostbite", "Frostbite"], ["seismic surge", "Seismic Surge"],
    ["embodiment of earth", "Embodiment of Earth"], ["vigor", "Vigor"],
    ["agility", "Agility"], ["spectral shield", "Spectral Shield"]
  ]){
    let g = H.state({res: 9}, {}, {turn: 3, actor: 0});
    g.builds = [{}, {}];
    const out = H.runOps(g, [["token", op, 1, "self"]], "drill");
    assert.equal(out.sides[0].board[0].card.name, printed, op + " must mint as " + printed);
  }
});

test("`name` still means the ENTRY's name — a deck list names its own cards", {skip}, () => {
  H.db();
  const C = require("../engine/cards.js");
  const db = H.db();
  const r = C.resolveEntry(db, {name: "Seismic Surge", p: 0, code: null, q: 1});
  assert.equal(r.name, "Seismic Surge");
  assert.equal(r.dbName, "Seismic Surge", "and dbName answers what the DATABASE calls it");
  const lower = C.resolveEntry(db, {name: "seismic surge", p: 0, code: null, q: 1});
  assert.equal(lower.name, "seismic surge", "the entry keeps what it was given (v2.48)");
  assert.equal(lower.dbName, "Seismic Surge", "…and dbName is the printed one");
  const missing = C.resolveEntry(db, {name: "No Such Card", p: 0, code: null, q: 1});
  assert.equal(missing.dbName, null, "null when nothing resolved — the caller must choose");
});

/* ---- 6. A MODAL HEADING IS NOT A CLAUSE ----------------------------- */

test("'Choose 1;' is a heading — and saying so is only honest once the modes are built", {skip}, () => {
  H.db();
  /* The audit splits on newlines and a modal header reads as a sentence,
     so both modal cards reported `part` with BOTH modes read. Same shape
     as Briar's "Essence of Earth and Lightning". */
  assert.equal(P.classifyClause("Choose 1;").status, "noop");
  for(const nm of ["Pummel", "Two Sides to the Blade"]){
    P.fxReset();
    const fx = P.fxParse(H.card(nm, 1));
    assert.equal(fx.tier, "full", nm);
    /* AND THE MODES MUST ACTUALLY BE THERE. Filed before they were built
       this would be the no-op blind spot: a line counted as accounted for
       with the card's whole choice unbuilt. */
    assert.equal((fx.modes || []).length, 2, nm + " must carry both modes");
    for(const md of fx.modes)
      assert.ok(md.q, nm + ": every mode must carry a READ restriction, or it is not selectable");
  }
});
