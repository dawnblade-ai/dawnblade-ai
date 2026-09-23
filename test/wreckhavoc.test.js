/* ============================================================
   TURN IT OVER, THEN TAKE IT IF IT IS WHAT YOU FEARED (v4.62)

     "Defense reaction cards can't be played this chain link.
      When this hits a hero, YOU MAY turn a card in their arsenal face-up,
      THEN destroy a defense reaction in their arsenal."
                                            — WRECK HAVOC x3, Dorinthea's

   THE POOL'S LAST `part` DECK CARD. Its first clause was built at v4.60;
   this is the second, and the diagnostic that found the gap is this
   project's cheapest, run from the head end (v3.79, v4.43): hand the SAME
   trigger a payload that already has a reader —

       "when this hits a hero, destroy a card in their arsenal"

   — and it parses in full, hero gate and all. So the trigger and the
   "you may" were never the blocker and BOTH halves of the payload were.
   Ninth outing of v3.47's shape: reading the payload creates the route.

   NEITHER HALF NEEDED NEW MACHINERY (v3.58, v3.73). `faceUpArsenal` has
   turned an arsenal card, fired its triggers and written the feed line
   since v3.71, and v3.72 taught it that TURNING IS NOT PUTTING;
   `foeArsDestroy` has destroyed the other seat's arsenal card since v3.96.
   What was new is the SEAT (the turn is the opponent's arsenal, so the
   actor is borrowed), the printed TYPE filter, and the OFFER — which
   v4.61 made possible by giving the optional modal a Decline control.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P  = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const J  = require("../engine/judge.js");
const S  = require("../engine/sparring.js");
const H  = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
const recs = pool.cards || pool;

/* ============================================================
   1. THE READER
   ============================================================ */
test("the clause reads, and the trigger it rides was never the blocker", () => {
  const got = P.classifyClause(
    "you may turn a card in their arsenal face-up, then destroy a defense reaction in their arsenal");
  assert.equal(got && got.status, "run");
  assert.deepEqual(got.ops, [["mayOffer", {
    label: "Turn their arsenal card face up, then destroy a defense reaction",
    ops: [["foeArsUp", 1], ["foeArsDestroy", 1, "dr"]]}]]);
  /* THE DIAGNOSTIC, KEPT AS A DRILL. The same trigger over a payload that
     already had a reader parses in full — which is how the gap was found
     and is the premise the whole build rests on. */
  const control = P.classifyClause("when this hits a hero, destroy a card in their arsenal");
  assert.equal(control.onHit, true);
  assert.equal(control.heroOnly, true);
  /* AND THE WHOLE PRINTED CLAUSE CARRIES THE SAME GATE. */
  const whole = P.classifyClause(
    "when this hits a hero, you may turn a card in their arsenal face-up, then destroy a defense reaction in their arsenal");
  assert.equal(whole.onHit, true);
  assert.equal(whole.heroOnly, true, "'a hero' is part of the trigger (v3.45)");
  assert.deepEqual(whole.ops, got.ops, "the trigger wrapper changes nothing about the payload");
});

test("the anchor is written against the LEVELLED clause, not the printed one", () => {
  /* v3.71 AND v3.99's RULE, AND THE FIRST DRAFT OF THIS READER HAD IT
     WRONG. The card prints "face-up" and `SYNONYMS` rewrites it to "face
     up" before `classifyClause` sees a word, so an anchor spelling the
     printed hyphen matches NOTHING and looks exactly like a pattern that
     is simply wrong. Both spellings must reach the reader, because the
     levelling is what makes that true rather than the anchor. */
  for(const spelling of ["face-up", "face up"]){
    const got = P.classifyClause(
      "you may turn a card in their arsenal " + spelling +
      ", then destroy a defense reaction in their arsenal");
    assert.ok(got && got.ops[0][0] === "mayOffer", spelling + " reaches the reader");
  }
});

test("the printed subject is a CLOSED vocabulary and an unknown one refuses", () => {
  /* READ WHOLE OR REFUSE (v2.29). The unrestricted `foeArsDestroy` sits two
     rules away, so a loose reading is that op wearing a restriction it does
     not enforce — v2.30's arrow buff on a sword, one zone over, and the
     direction that steals games. */
  for(const bad of ["aura", "card", "attack action card", "weapon", "arrow"])
    assert.equal(P.classifyClause(
      "you may turn a card in their arsenal face-up, then destroy a" +
      (/^[aeiou]/.test(bad) ? "n " : " ") + bad + " in their arsenal"), null,
      "'" + bad + "' is not a subject this reader can enforce");
  /* BOTH SPELLINGS OF THE TYPE, because the database prints both forms of
     the word elsewhere and v3.36's rule is that it moves under you. */
  for(const good of ["defense reaction", "defence reaction"])
    assert.ok(P.classifyClause(
      "you may turn a card in their arsenal face-up, then destroy a " + good +
      " in their arsenal"), good + " reads");
});

test("the pool prints exactly this one filtered arsenal destroy", () => {
  /* THE MEASUREMENT THE CLOSED VOCABULARY RESTS ON, driven off the printed
     text rather than remembered (v4.09). A second subject arriving fails
     here and asks for a decision rather than falling through. */
  /* THE SUBJECT MUST NOT BE THE BARE "card", or the scan reports the
     unrestricted family too and the claim collapses into "the pool prints
     an arsenal destroy" — which is true and is not what this pins. My first
     draft did exactly that and named Loot the Arsenal and Wee Wrecking Ball
     (v4.07: a scan aimed at the wrong shape). */
  const hits = recs.filter(r => {
    const m = /destroy an? ([a-z ]+?) in their arsenal/i.exec(r.functional_text || "");
    return m && m[1].toLowerCase() !== "card";
  }).map(r => r.name);
  assert.deepEqual([...new Set(hits)], ["Wreck Havoc"]);
  /* AND THE UNRESTRICTED ONE STILL HAS ITS OWN CLAIMANTS, so the filter is
     opt-in and no existing caller moved (v3.58). */
  const bare = recs.filter(r => /destroy a card in their arsenal/i.test(r.functional_text || ""))
                   .map(r => r.name);
  assert.ok(bare.length >= 1, "the bare form is still printed: " + [...new Set(bare)].join(", "));
});

/* ============================================================
   2. THE SHEET — A ONE-MODE OPTIONAL MODAL
   ============================================================ */
const g0 = {sides: [{hand: [], deck: [], grave: [], board: [], gear: [], res: 3}, {}], turn: 1};

test("a single mode builds a sheet only when it can be REFUSED", () => {
  /* THE FLOOR OF TWO IS RIGHT FOR A MANDATORY MODAL — a forced choice among
     one is a tap that teaches nothing (v3.55) — and exactly wrong for an
     OPTIONAL one, where the alternative is not a second mode but declining.
     Both directions, or widening the floor is unwatched (v4.12). */
  const one = [{label: "Do the thing", ops: [["draw", 1]]}];
  assert.equal(PM.buildPrompt(g0, {tag: "modal", side: 0, src: "S", options: one}), null,
    "a mandatory single-mode modal is still refused");
  const p = PM.buildPrompt(g0, {tag: "modal", side: 0, src: "S", optional: true, options: one});
  assert.ok(p, "an optional one builds");
  assert.equal(p.options.length, 1);
  assert.equal(p.optional, true);
  /* AND IT CAN ACTUALLY BE ANSWERED BOTH WAYS, which is the property the
     widening exists for — v4.61 is the version that gave the sheet the
     control, so this is the half that would otherwise be a livelock. */
  assert.equal(PM.promptReady(p), false, "nothing chosen yet");
  assert.equal(PM.promptReady(PM.promptDecline(p)), true);
  assert.deepEqual(PM.applyPrompt(g0, PM.promptDecline(p)).ops, []);
  assert.deepEqual(PM.applyPrompt(g0, PM.promptChoose(p, 0)).ops, [["draw", 1]]);
  /* AN EMPTY OPTION LIST STILL ASKS NOTHING. */
  assert.equal(PM.buildPrompt(g0, {tag: "modal", side: 0, src: "S", optional: true, options: []}), null);
});

test("widening the floor moved no pool record", {skip}, () => {
  /* MEASURED BEFORE IT WAS CARRIED (v3.33). `millCostSpec` is the engine's
     only builder that sets `optional` and it always supplies two modes, so
     nothing that existed before v4.62 can reach the new branch. */
  const EFX = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const spec = EFX.slice(EFX.indexOf("function millCostSpec"), EFX.indexOf("function optCostSpec"));
  assert.equal((spec.match(/\{label:/g) || []).length, 2, "millCostSpec prints two modes");
  assert.equal((EFX.match(/optional: true/g) || []).length, 1,
    "and it is the only builder that sets the flag");
});

/* ============================================================
   3. DRIVEN — THE WHOLE ROUTE
   ============================================================ */
const mk = (nm, pitch, uid) => Object.assign({}, H.card(nm, pitch), {uid});

/* DRIVE THE REAL ENTRY POINT (v3.20, v4.03): `play`, then let both seats
   pass until the chain closes, so the prompt is opened and answered by the
   policy rather than by the fixture. */
function settle(n0, max){
  let n = n0;
  for(let i = 0; i < (max || 40); i++){
    const seat = n.priority == null ? 0 : n.priority;
    const a = S.act(n, seat);
    if(!a) break;
    const q = J.reduce(n, a, seat);
    if(q.error) break;
    n = q.state;
    if(!n.prompt && !n.pend && (!n.chain || !n.chain.length)) break;
  }
  return n;
}

function havoc(theirArsenal, opts){
  H.db(); P.fxReset();
  const o = opts || {};
  const wh = mk("Wreck Havoc", 3, "wh1");
  let n = H.state({name: "Dorinthea", res: 9, ap: 9, hand: [wh],
                   deck: [{uid: "f1", name: "F1"}]},
                  {name: "Them", hp: 20, deck: [{uid: "d1", name: "T"}, {uid: "d2", name: "T2"}],
                   arsenal: theirArsenal || null,
                   hand: o.theirHand || []},
                  {actor: 0, turnPlayer: 0, seed: "wh", turn: 3});
  n = {...n, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(n, {t: "play", uid: "wh1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  return r.state;
}

test("DRIVEN: it turns their arsenal card face up and destroys a defence reaction",
     {skip}, () => {
  const dr = mk("Sigil of Suffering", 1, "x1");
  assert.ok(P.isDR(dr), "the premise: it is a printed Defense Reaction");
  let n = havoc(dr);
  n = settle(n);
  assert.equal(n.sides[1].arsenal, null, "the arsenal is empty — it was destroyed");
  assert.deepEqual(n.sides[1].grave.map(c => c.name), ["Sigil of Suffering"],
    "and it reached THEIR graveyard, where retrieve can still find it (v3.96)");
});

test("DRIVEN: a card that is NOT what the card names is turned up and SURVIVES",
     {skip}, () => {
  /* THE ROW THAT BITES. A reader that ignored the printed type passes the
     row above perfectly and destroys this one too — the restriction is only
     observable on a non-matching card (v3.26, v3.98). */
  const other = mk("Spire Sniping", 2, "x2");
  assert.equal(P.isDR(other), false, "the premise: it is not a Defense Reaction");
  let n = havoc(other);
  n = settle(n);
  assert.ok(n.sides[1].arsenal, "it is still in the arsenal");
  assert.equal(n.sides[1].arsenal.name, "Spire Sniping");
  assert.equal(n.sides[1].arsenal._faceUp, true, "and it was turned FACE UP");
  assert.equal(n.sides[1].grave.length, 0, "nothing was destroyed");
});

test("DRIVEN: an empty arsenal turns nothing and destroys nothing", {skip}, () => {
  let n = havoc(null);
  n = settle(n);
  assert.equal(n.sides[1].arsenal, null);
  assert.equal(n.sides[1].grave.length, 0);
  /* AND THE HERO STILL TOOK THE SWING, so the drill is measuring the
     payload rather than an attack that never happened. */
  assert.ok(n.sides[1].hp < 20, "the attack still connected: " + n.sides[1].hp);
});

test("DRIVEN: the TURN fires the card's own trigger, for ITS controller", {skip}, () => {
  /* SPIRE SNIPING IS THE POOL'S ONLY "put OR TURNED face-up" (v3.72), so it
     is the one card a turn can trigger — and its payload looks at ITS
     OWN deck. Read at the ambient actor the attacker would look at theirs,
     which is v3.46's `allyDeath` inversion and the reason the actor is
     BORROWED rather than a seat being threaded (`faceUpArsenal` runs each
     `arsenalUp` op through `runOps`). */
  const other = mk("Spire Sniping", 2, "x3");
  P.fxReset();
  assert.equal(P.fxParse(H.card("Spire Sniping", 2)).arsenalUpTurn, true, "the premise");
  let n = havoc(other);
  n = settle(n);
  /* THE OBSERVABLE IS WHOSE SHEET IT IS, or whose deck was looked at. Its
     payload is a reorder of the CONTROLLER's top two (v4.59's `lookOrder`),
     so a sheet addressed to seat 0 would be the inversion. */
  const lines = (n.feed || []).join(" | ");
  assert.match(lines, /Spire Sniping/, "the turned card announced itself: " + lines.slice(-260));
  assert.ok(n.sides[1].arsenal && n.sides[1].arsenal._faceUp === true);
  /* AND THE ATTACKER'S OWN DECK IS UNTOUCHED — one card, as dealt. */
  assert.equal(n.sides[0].deck.length, 1, "seat 0's deck was not the one looked at");
});

test("DRIVEN: a swing at an ALLY offers nothing (CR 7.5.5 and v3.45)", {skip}, () => {
  /* "A HERO" IS PART OF THE TRIGGER, so the parse files it in
     `fx.onHitHero` — read from `fx.onHit` it would fire off a hit on an
     ally, which is the direction that list exists to stop. */
  P.fxReset();
  const fx = P.fxParse(H.card("Wreck Havoc", 3));
  assert.deepEqual(fx.onHit, [], "nothing in the bare list");
  assert.equal(fx.onHitHero.length, 1, "and the whole payload in the hero-gated one");
});

test("DRIVEN: declining leaves their arsenal exactly as it was", {skip}, () => {
  /* THE PRINTED "you may". Answered through `reduce`, which is the surface
     both boards and a wire reach (v3.20). */
  const dr = mk("Sigil of Suffering", 1, "x4");
  let n = havoc(dr);
  /* settle only until the sheet is up, then decline it by hand — the policy
     ACCEPTS (autoAnswer sends choice 0), so the decline path needs driving
     explicitly or it has no caller (v3.50). */
  for(let i = 0; i < 40 && !n.prompt; i++){
    const seat = n.priority == null ? 0 : n.priority;
    const a = S.act(n, seat); if(!a) break;
    const q = J.reduce(n, a, seat); if(q.error) break;
    n = q.state;
  }
  assert.ok(n.prompt, "the sheet opened");
  assert.equal(n.prompt.tag, "modal");
  assert.equal(n.prompt.optional, true);
  assert.equal(n.prompt.options.length, 1, "one printed mode");
  n = J.reduce(n, {t: "promptDecline"}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.ok(n.sides[1].arsenal, "it is still there");
  assert.equal(n.sides[1].arsenal.name, "Sigil of Suffering");
  assert.ok(!n.sides[1].arsenal._faceUp, "and it was never turned over");
  assert.equal(n.sides[1].grave.length, 0);
});

test("the POLICY takes it, so the route is driven rather than refused", {skip}, () => {
  /* v4.24's standing rule is to DECLINE a price this policy cannot weigh,
     and this play has NO price — both halves land on the opponent — so the
     rule does not reach it. `judge.autoAnswer` answering a modal with
     `choice: 0` is what makes that true, and it is asserted rather than
     assumed: a policy that declined would leave the accept path with no
     caller in any driven game (v3.50, seven outings). */
  const dr = mk("Sigil of Suffering", 1, "x5");
  let n = havoc(dr);
  for(let i = 0; i < 40 && !n.prompt; i++){
    const seat = n.priority == null ? 0 : n.priority;
    const a = S.act(n, seat); if(!a) break;
    const q = J.reduce(n, a, seat); if(q.error) break;
    n = q.state;
  }
  assert.ok(n.prompt, "the sheet opened");
  /* IT TAKES THE GAME, not the prompt — `autoAnswer` reads `g.prompt` and
     the side off it, which is how `sparring.act` calls it. Handed a prompt
     it answers `null`, and a null read exactly like a policy that declines
     (v4.09: check your own fixture by asking the file). */
  const ans = J.autoAnswer(n);
  assert.deepEqual(ans, {t: "promptChoose", choice: 0}, "the policy takes the one mode");
});

/* ============================================================
   4. THE OP'S OWN GUARDS
   ============================================================ */
test("`foeArsDestroy` refuses a filter key it cannot read, rather than falling through",
     {skip}, () => {
  /* `reduce` IS FED BY JSON OFF A WIRE (v2.04). Falling through on an
     unknown key destroys ANY card in the arsenal, which is exactly the
     unrestricted reading the parser is anchored to avoid — so the guard is
     synthetic by construction (no pool record can emit a bad key) and that
     is v3.73's rule rather than a gap. */
  H.db();
  const dr = mk("Sigil of Suffering", 1, "y1");
  const base = () => H.state({name: "A", res: 5}, {name: "B", arsenal: Object.assign({}, dr)},
                             {actor: 0, turn: 2, builds: [{}, {}]});
  const run = op => J.withEffects(base(), (fx, s) => ({game: fx.runOps(s, [op], "T")})).game;
  assert.equal(run(["foeArsDestroy", 1, "dr"]).sides[1].arsenal, null, "the known key destroys");
  for(const bad of ["aura", "DR", "", 1, true])
    assert.ok(run(["foeArsDestroy", 1, bad]).sides[1].arsenal,
      "an unreadable restriction destroys nothing: " + JSON.stringify(bad));
  /* AND THE BARE FORM IS UNCHANGED, so no existing caller moved. */
  assert.equal(run(["foeArsDestroy", 1]).sides[1].arsenal, null);
});

test("`foeArsUp` names the cases that do nothing, because the feed is the lesson",
     {skip}, () => {
  H.db();
  const up = Object.assign({}, mk("Spire Sniping", 2, "y2"), {_faceUp: true});
  const state = ars => H.state({name: "A", res: 5, deck: [{uid: "q1", name: "Q"}]},
                               {name: "B", arsenal: ars, deck: [{uid: "q2", name: "Q2"}]},
                               {actor: 0, turn: 2, builds: [{}, {}]});
  const feedOf = ars => (J.withEffects(state(ars), (fx, s) =>
    ({game: fx.runOps(s, [["foeArsUp", 1]], "T")})).game.feed || []).join(" | ");
  assert.match(feedOf(null), /arsenal is empty/, "an empty arsenal says so");
  assert.match(feedOf(up), /already face up/, "an already-up card says so");
  /* AND THE SEAT IS NAMED IN BOTH, or the line reads from one chair only
     (v2.83). Seat 1 is called "B" here, so "their" would be wrong. */
  assert.match(feedOf(null), /B/);
});

test("a TURN is not a PUT, so a put-only trigger sits it out", {skip}, () => {
  /* v3.72's DISTINCTION, AND MY FIRST SABOTAGE PASS COULD NOT EXPRESS IT
     (v3.62). Reading the turn as `from: "hand"` came back SILENT because
     every fixture used Spire Sniping, whose "put OR TURNED face-up" fires
     either way — so the drill was asserting about the one card that cannot
     tell the two readings apart (v3.26, a fixture where two things
     coincide has tested neither).

     THE CARD THAT BITES IS A PUT-ONLY TRIGGER. Swift Shot prints "when
     this is put face-up into your arsenal, it gets GO AGAIN this turn",
     which `faceUpArsenal` stamps as `_arsGA` — an ACTION POINT (CR 5.3.5),
     this file's own "most valuable keyword in the game to get wrong",
     handed to the OPPONENT off an attack aimed at them. */
  H.db();
  const swift = Object.assign({}, mk("Swift Shot", 1, "y4"));
  P.fxReset();
  const sfx = P.fxParse(H.card("Swift Shot", 1));
  assert.ok((sfx.arsenalUp || []).some(op => op[0] === "ga"), "the premise: it grants go again");
  assert.ok(!sfx.arsenalUpTurn, "and it is PUT-only — a turn must not fire it");
  const g = H.state({name: "A", res: 5, deck: [{uid: "q3", name: "Q"}]},
                    {name: "B", arsenal: swift, deck: [{uid: "q4", name: "Q4"}]},
                    {actor: 0, turn: 2, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s2) => ({game: fx.runOps(s2, [["foeArsUp", 1]], "T")})).game;
  assert.equal(out.sides[1].arsenal._faceUp, true, "it is turned over");
  assert.ok(!out.sides[1].arsenal._arsGA, "and its PUT trigger did NOT fire");
  /* THE POSITIVE CONTROL: the one card whose trigger a turn DOES reach. */
  P.fxReset();
  assert.equal(P.fxParse(H.card("Spire Sniping", 2)).arsenalUpTurn, true);
});

test("`mayOffer` with nothing to offer asks nothing", {skip}, () => {
  /* LATENT AND SYNTHETIC (v3.73). No pool record emits an empty payload —
     the parser builds the ops from the printed line — so this guard exists
     for the wire (v2.04) and its sabotage is silent against every real
     fixture. Drilled rather than deleted, because the alternative is a
     sheet with a button that runs nothing, which is a dead control (v2.83). */
  H.db();
  const g = H.state({name: "A", res: 5}, {name: "B"}, {actor: 0, turn: 2, builds: [{}, {}]});
  const bare = J.withEffects(g, (fx, s2) =>
    ({game: fx.runOps(s2, [["mayOffer", {label: "X", ops: []}]], "T")})).game;
  assert.equal((bare.promptQ || []).length, 0, "nothing is queued");
  assert.equal(J.openPrompt(bare) ? (J.openPrompt(bare).prompt || null) : null, null);
  /* AND THE POSITIVE CONTROL, or a body that queues NOTHING passes this. */
  const real = J.withEffects(g, (fx, s2) =>
    ({game: fx.runOps(s2, [["mayOffer", {label: "X", ops: [["draw", 1]]}]], "T")})).game;
  assert.equal((real.promptQ || []).length, 1, "a real payload does queue");
});

test("the route counter's phrase and the engine's phrase are pinned together", () => {
  /* v3.81's RULE, AND MY SABOTAGE PASS FOUND IT MISSING: widening the
     counter to /arsenal/ came back SILENT, so it would have reported every
     line the feed says about an arsenal — v4.46's `tap` reading 335
     firings of which every one was the end phase announcing an UNTAP,
     with the sign flipped. The two spellings are pinned against each
     other, so a rewording of either fails a test rather than silently
     zeroing (or inflating) a count. */
  const SELF = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.match(SELF, /if\(\/Turn their arsenal card face up\/\.test\(line\)\) events\.push\(\["arsflip", line\]\);/,
    "the counter spells the engine's own phrase");
  /* THE ENGINE'S HALF: the label the parser builds, which `applyPrompt`
     prints verbatim as the chosen mode. */
  const got = P.classifyClause(
    "you may turn a card in their arsenal face-up, then destroy a defense reaction in their arsenal");
  assert.match(got.ops[0][1].label, /^Turn their arsenal card face up/);
  /* AND IT IS UNIQUE IN THE POOL, which is what makes counting the LABEL a
     number about this card rather than about three (v4.25). */
  const shared = recs.filter(r => /Turn their arsenal card face up/i.test(r.functional_text || ""));
  assert.equal(shared.length, 0, "no card prints the phrase itself — it is the engine's own line");
});

test("the actor is handed back, or every later rule runs for the wrong hero", {skip}, () => {
  /* v3.46's `allyDeath` inversion, stated as an assertion. A body that
     leaves the actor moved corrupts everything after it in the same
     resolution. */
  H.db();
  const dr = mk("Sigil of Suffering", 1, "y3");
  const g = H.state({name: "A", res: 5}, {name: "B", arsenal: Object.assign({}, dr)},
                    {actor: 0, turn: 2, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.runOps(s, [["foeArsUp", 1]], "T")})).game;
  assert.equal(out.actor, 0, "the actor is back where it started");
});

/* ============================================================
   5. THE FAMILY — A COSTLESS "you may", BOTH ANSWERS
   ============================================================ */
test("the pool's costless 'you may' payloads are exactly these two, measured", {skip}, () => {
  /* WRECK HAVOC IS OFFERED AND ENTANGLING SHOT IS NOT, and the difference
     is a MEASUREMENT rather than a preference:

       Entangling Shot   "you may {t} target hero" — tapping an opponent's
                         hero can never help them (v3.48's ruling is that
                         narrow), so declining is strictly DOMINATED and it
                         is taken without asking (v4.23's reprieve).
       Wreck Havoc       turning their card face up fires their own
                         turn-legal arsenal trigger, so accepting can hand
                         the opponent value — and the controller cannot see
                         which card it is before choosing.

     Pinned as a SET, so a third costless "you may" arriving is a decision
     somebody makes rather than a default (v3.35, v4.17). */
  H.db();
  const offered = [], taken = [];
  for(const r of recs){
    const tx = r.functional_text || "";
    if(!/you may/i.test(tx)) continue;
    P.fxReset();
    const fx = P.fxParse({name: r.name, pitch: (r.printings && r.printings[0] || {}).pitch,
      cost: r.cost, power: r.power, def: r.defense, tt: r.type_text, ty: r.types,
      kw: r.card_keywords, gkw: r.granted_keywords, tx: tx});
    P.fxReset();
    /* THE WHOLE PARSE, never `fx.ops` — Wreck Havoc's payload rides in
       `fx.onHitHero` because "a hero" is part of the trigger (v3.45), so a
       scan of the top-level op list reports an EMPTY set, which reads
       exactly like a pool with nothing in it (v3.81, v4.07). */
    const all = JSON.stringify(fx);
    if(all.indexOf("mayOffer") >= 0) offered.push(r.name);
    else if(all.indexOf("tapFoeHero") >= 0) taken.push(r.name);
  }
  assert.deepEqual([...new Set(offered)], ["Wreck Havoc"]);
  assert.deepEqual([...new Set(taken)], ["Entangling Shot"]);
});

test("Entangling Shot's tap is still taken without asking", {skip}, () => {
  /* THE OTHER HALF OF THE MEASUREMENT. A build that offered every costless
     "you may" would put a sheet in front of a decision nobody would ever
     make differently, which is a tap that teaches nothing (v3.55). */
  const got = P.classifyClause("when this is put face-up into your arsenal, you may {t} target hero");
  assert.deepEqual(got.ops, [["tapFoeHero", 1]]);
  assert.equal(got.arsUp, true);
});

/* ============================================================
   6. THE BLAST RADIUS
   ============================================================ */
test("exactly THREE pool records move, all Wreck Havoc, part -> full", {skip}, () => {
  H.db(); P.fxReset();
  const tiers = {};
  const offers = [];
  for(const r of recs){
    const pitch = (r.printings && r.printings[0] || {}).pitch;
    P.fxReset();
    const fx = P.fxParse({name: r.name, pitch: pitch, cost: r.cost, power: r.power,
      def: r.defense, tt: r.type_text, ty: r.types, kw: r.card_keywords,
      gkw: r.granted_keywords, tx: r.functional_text});
    tiers[fx.tier] = (tiers[fx.tier] || 0) + 1;
    if(JSON.stringify(fx).indexOf("mayOffer") >= 0) offers.push(r.name + "|" + pitch);
  }
  /* THE THREE PRINTINGS, and nothing else in the pool emits the op. */
  assert.equal(offers.length, 3, offers.join(", "));
  assert.deepEqual([...new Set(offers.map(x => x.split("|")[0]))], ["Wreck Havoc"]);
  P.fxReset();
});
