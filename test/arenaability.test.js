/* ============================================================
   AN ARENA PERMANENT'S ACTIVATED ABILITY (v4.47)

   THE LAST MEMBER OF v3.01's FAMILY. `judge.legal`'s arena branch read
   `allyAttack`/`auraAttackOf` and refused everything else — "X prints no
   attack to activate" — so at the table an Item or an Aura printing
   `Action -` / `Instant - <cost>:` could not be activated at all, while
   the trainer had the route from v2.35. The family in order: v3.04's
   seventeen dead EQUIPMENT abilities, v3.39's hero branch, v3.44's ally
   attack, v3.84's aura attack, and this.

   MEASURED over the pinned pool: ELEVEN arena records print an activation
   line and SEVEN have one `parseHeroPower` reads — Concealed Object
   (Lyath x2), Energy Potion (Dorinthea, Fai), Timesnap Potion (Gravy
   Bones) and Gravy Bones' whole treasure economy (Gold, Silver, Copper,
   Diamond). Four are decked, three are tokens with no creator yet.

   `build.boardPow` IS THE SHARED READER — build.js's THIRD powCard
   builder, and the other two comment blocks have named it by name since
   v3.79 while it sat inside `Battle` as a React closure. So v3.63's rule
   (when you add a flag to one builder, grep for the others) was a grep
   across two files, one of which no drill could reach, and it had already
   cost the cost flags.

   AND BUILDING THE ROUTE EXPOSED A SECOND DEFECT ON BOTH BOARDS.
   Concealed Object prints `Instant - {t}: Target attack gets +1{p}` and
   NOTHING CHARGED THE TAP — driven three times on one turn it queued +1,
   +2, +3 for free, unbounded, live in Lyath's deck twice. STRONGER than
   printed, `tier: full` throughout (the clause IS read, so coverage is
   blind), and the one-sided fairness sweep looks the other way. v4.46's
   own defect one zone over, found the same way: by making the cost
   legible and then driving it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;
const PR = require("../engine/parser.js");
const BD = require("../engine/build.js");
const TY = require("../engine/types.js");
const CD = require("../engine/cards.js");
const skip = H.hasDb() ? false : "no card database";

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* An action-phase table state with `entries` in seat 0's arena. */
function arena(entries, o){
  const g = H.state(Object.assign({res: 0, board: entries}, o || {}), {hp: 20});
  const n = {...g, phase: "action", step: "layer", priority: 0, turnPlayer: 0, actor: 0};
  n.sides[0] = {...n.sides[0], ap: 1};
  return n;
}
const ent = (card, uid, extra) => Object.assign({uid, kind: "token", card, spent: false}, extra || {});

/* ---- 1. the route, driven at the table -------------------------------- */

test("an arena permanent's ABILITY is legal at the table and RESOLVES", {skip}, () => {
  H.db();
  const pot = H.card("Energy Potion", 3);      /* Instant - Destroy this: Gain {r}{r} */
  const g = arena([ent(pot, 901)]);
  assert.equal(J.legal(g, {t: "activate", uid: 901}, 0), null,
    "the table refuses an arena ability — v3.01's shape, back");
  const out = J.reduce(g, {t: "activate", uid: 901}, 0);
  assert.equal(out.error, null, "`reduce` must agree with `legal` (fuzz.test.js's property)");
  const s = out.state.sides[0];
  assert.equal(s.res, 2, "the payload resolved — +2 resource");
  assert.equal(s.board.length, 0, "…and the printed destroy cost was paid");
  assert.deepEqual(s.grave.map(c => c.name), ["Energy Potion"],
    "a destroyed permanent goes to the GRAVEYARD (the 2026-08-29 ruling)");
  assert.equal(s.ap, 1, "an INSTANT costs no action point (CR 8.1.6)");
});

test("an ACTION ability charges the point and go again gives it back", {skip}, () => {
  H.db();
  const gold = H.card("Gold", 0);   /* Action - {r}{r}, destroy this: Draw a card. Go again */
  const g = arena([ent(gold, 902)], {res: 2, deck: [H.card("Wounding Blow", 1)]});
  assert.equal(J.legal(g, {t: "activate", uid: 902}, 0), null);
  const s = J.reduce(g, {t: "activate", uid: 902}, 0).state.sides[0];
  assert.equal(s.res, 0, "the printed {r}{r} was charged");
  assert.equal(s.hand.length, 1, "and the card was drawn");
  assert.equal(s.board.length, 0, "the Gold is spent");
  assert.equal(s.ap, 1, "CR 5.3.5 — go again is a GAIN, so the point comes back");
});

test("an ability the seat cannot fund is refused BEFORE the permanent is spent", {skip}, () => {
  /* v3.11 — a legality, not a modifier. Refusing after the ability
     resolves costs the player the permanent for a play the rules never
     allowed, and it is the shape every cost in `abCostWhy` is there for.
     THE CEILING IS WHAT IS ASKED, not the pool: one pitchable worth 1
     cannot raise 2, and a seat holding exactly 2 in hand can. */
  H.db();
  const gold = H.card("Gold", 0);
  const thin = arena([ent(gold, 903)], {res: 0, hand: [H.card("Wounding Blow", 1)]});
  assert.match(String(J.legal(thin, {t: "activate", uid: 903}, 0)),
    /costs 2 to activate and you cannot raise it/);
  assert.equal(thin.sides[0].board.length, 1, "and nothing was spent saying so");
  const fat = arena([ent(gold, 903)], {res: 0,
    hand: [H.card("Wounding Blow", 3), H.card("Wounding Blow", 3)]});
  assert.equal(J.legal(fat, {t: "activate", uid: 903}, 0), null,
    "…and a hand that CAN raise it is legal — the control that says the refusal " +
    "is the cost talking rather than a branch that refuses everything");
});

test("the affordability read asks what the CHARGE asks — the game's half too", {skip}, () => {
  /* v3.80, and the reason `legal` calls `effCost(ab, sd, PR.costCtx(...))`
     rather than reading `ab.cost`: a Frostbite taxes +1, so a seat holding
     exactly the printed cost and an EMPTY hand is where the two readings
     come apart. Read off the printed number this is legal, `execute`
     charges 3 into a pool of 2, and the seat goes to -1 — `NEGATIVE-RES`,
     CR 4.4.3e, and the `legal`/`reduce` agreement fuzz.test.js holds. */
  H.db();
  const gold = H.card("Gold", 0), frost = H.card("Frostbite", 0);
  const g = arena([ent(gold, 904), ent(frost, 905)], {res: 2, deck: [H.card("Wounding Blow", 1)]});
  assert.equal(PR.frostCount(g.sides[0]), 1, "fixture: one Frostbite on the board");
  assert.match(String(J.legal(g, {t: "activate", uid: 904}, 0)),
    /costs 3 to activate/, "the tax is in the number `legal` quotes");
});

/* ---- 2. the tap nobody charged --------------------------------------- */

test("a {t} arena ability TAPS its permanent, and cannot pay again", {skip}, () => {
  /* THE SECOND DEFECT, and it was live on BOTH boards. Concealed Object is
     the pool's only readable arena record printing a `{t}` cost, and it is
     the only one of the seven that does NOT print "destroy this" — so
     nothing else limited it and it pumped forever. */
  H.db();
  const co = H.card("Concealed Object", 3);
  const g = arena([ent(co, 906)]);
  assert.equal(PR.tapsToActivate(co.tx || ""), true,
    "fixture: the printed line carries {t} (read off the PERMANENT — boardPow " +
    "strips the cost prefix, v3.48's rule)");
  const a = J.reduce(g, {t: "activate", uid: 906}, 0).state;
  assert.equal(a.sides[0].buffNext, 1, "the payload landed once");
  assert.equal(a.sides[0].board[0].spent, true, "…and the permanent is TAPPED");
  assert.match(String(J.legal(a, {t: "activate", uid: 906}, 0)),
    /is tapped until your end phase/, "a tapped permanent cannot pay {t} again");
  const b = J.reduce(a, {t: "activate", uid: 906}, 0);
  assert.notEqual(b.error, null, "…and `reduce` agrees");
  assert.equal(b.state.sides[0].buffNext, 1,
    "the pump did NOT land twice — three activations used to queue +1, +2, +3");
});

test("the FEED says the tap was paid", {skip}, () => {
  /* IN A TRAINING SIM THE FEED IS THE LESSON (v3.60, v4.24, v4.46). Before
     v4.46 the hero's tap produced no line at all and a player learned it
     had happened by being refused a play; this is the same cost one zone
     over, so it announces itself the same way — the seat NAMED and the
     verb agreeing with the name (v2.83, v4.15's `sv`). */
  H.db();
  const co = H.card("Concealed Object", 3);
  const g = arena([ent(co, 907)]);
  g.sides[0] = {...g.sides[0], name: "Lyath Goldmane"};
  const feed = (J.reduce(g, {t: "activate", uid: 907}, 0).state.feed || []).join(" | ");
  assert.match(feed, /Concealed Object: Lyath Goldmane taps it to pay/,
    "the line names the PERMANENT and the seat");
  assert.match(feed, /CR 4\.4\.3d/,
    "…and names the rule that lifts it, because 'until your untap step' is the " +
    "thing a player plans around and a turn number is not");
});

test("the TAP is the arena's record, not a per-turn allowance", {skip}, () => {
  /* v2.46's Sledge/Scorpio split, one zone in. `weaponUsed` comes back at
     EVERY turn boundary for both seats; `spent` is lifted only by the
     controller's own untap step (CR 4.4.3d). Writing the wrong one makes
     the cost payable again on the opponent's turn. */
  H.db();
  const co = H.card("Concealed Object", 3);
  const g = arena([ent(co, 908)]);
  const a = J.reduce(g, {t: "activate", uid: 908}, 0).state;
  assert.deepEqual(a.sides[0].weaponUsed, {},
    "a tap is NOT an allowance — nothing may be keyed into weaponUsed for it");
  /* AND THE UNTAP STEP LIFTS IT — DRIVEN through a whole turn cycle rather
     than asserted about a field, which is the only thing that can tell the
     two records apart: an allowance comes back at every boundary, a tap
     only at the controller's OWN untap step (CR 4.4.3d, judge's step (d)).

     ENDING A TURN TAKES TWO ACTIONS (v2.46) — `endTurn` is a pass carrying
     intent, so the opponent still gets their last instant window. */
  const passTurn = st => {
    let n = J.reduce(st, {t: "endTurn"}, st.turnPlayer).state;
    if(n.phase === "action" && n.priority != null)
      n = J.reduce(n, {t: "pass"}, n.priority).state;
    while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
    return n;
  };
  const mine = passTurn(a);
  assert.equal(mine.sides[0].board[0].spent, false,
    "the controller's own untap step lifts it (CR 4.4.3d)");
  /* AND THE OPPONENT'S TURN DOES NOT, which is the half that separates the
     two records: through THEIR end phase a tap must still be paid. */
  const theirs = {...a};
  theirs.sides = a.sides.slice();
  theirs.turnPlayer = 1; theirs.priority = 1;
  const after = passTurn(theirs);
  assert.equal(after.sides[0].board[0].spent, true,
    "seat 1's end phase must NOT untap seat 0's permanent — writing this as an " +
    "allowance makes the cost payable again on the opponent's turn");
});

/* ---- 3. the shared builder, and the flags ---------------------------- */

test("the trainer refuses a tapped arena permanent too", () => {
  /* A PRINTED RULE ON ONE BOARD IS v3.01's SHAPE whether or not anything
     reaches it, so the trainer's gate is asserted — and `tryPlay` is a
     React closure, so this is a SOURCE SCAN and it is written down as one
     (the same treatment `rxability.test.js` gives the trainer's window
     gate). What it can prove is that the gate EXISTS and asks the one
     reader; what it cannot prove is that the tap reaches it on a phone,
     which is validated on-device per the roadmap loop.

     It is here because the sabotage that deletes the gate came back SILENT
     with no drill at all — a reach limit of the harness is not a licence
     to leave the rule unasserted (v3.62, v4.34). */
  const T = HTML.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(T, /if\(from === "board"\)\{\s*\n\s*const _tb = act\(s\)\.board\[idx\];/,
    "tryPlay must look the permanent up by the index the board cell passed");
  assert.match(T, /_tb\.spent && DawnParser\.tapsToActivate\(_tb\.card\.tx \|\| ""\)/,
    "…and refuse a TAPPED one, reading the PERMANENT's printed line — the powCard " +
    "has had its cost prefix stripped, so asking it finds no {t} at all");
  assert.ok(!/_tb\.spent && DawnParser\.tapsToActivate\(_tb\.powCard/.test(T),
    "and never the powCard's");
  /* A SOURCE SCAN CANNOT TELL A LIVE TEST FROM A NEUTERED ONE (v4.00,
     verbatim: `if(false && …)` keeps every name intact), and that is
     exactly what came back SILENT here — so the one shape is refused BY
     NAME and the reach of the scan is STATED rather than assumed. The
     property that is genuinely covered is `judge.legal`'s half, which is
     DRIVEN two drills up; this is the one-board guard beside it. */
  assert.ok(!/if\(\s*(?:false|0)\s*&&[^)]*_tb/.test(T),
    "the gate is neutered rather than deleted — a source scan cannot see that " +
    "unless it refuses the shape by name");
});

test("the trainer reads the SHARED builder", () => {
  assert.match(HTML, /const boardPow = DawnBuild\.boardPow;/,
    "a second copy in `index.html` is the no-mirror rule, and it is what kept " +
    "`judge.legal` from having the route at all");
  assert.equal((HTML.match(/const boardPow = /g) || []).length, 1,
    "exactly one binding");
});

test("`boardPow` stamps the window, and refuses an ALLY", () => {
  const line = tx => BD.boardPow({uid: 5, kind: "token",
    card: {name: "Probe " + tx.length, uid: 5, tt: "Generic Token - Item",
           ty: ["Generic", "Item"], tx}});
  const inst = line("Instant - Destroy this: Gain {r}{r}");
  assert.equal(inst._instant, true);
  assert.equal(inst._attackRx, false);
  assert.equal(inst.uid, "bp5", "keyed \"bp\"+uid — gear's is \"gp\"+uid (v2.71)");
  const rx = line("Attack Reaction - 0: Target attack gets +1{p}");
  assert.equal(rx._attackRx, true, "v3.63 — a builder that drops the window offers " +
    "an attack-reaction ability at ACTION speed");
  /* AN ALLY IS THE OTHER ROUTE (v3.44), so this answers null for one even
     though `weaponCost` reads its printed grammar perfectly. */
  assert.equal(BD.boardPow({uid: 6, kind: "ally",
    card: {name: "Probe Ally", uid: 6, tt: "Pirate Ally", ty: ["Pirate", "Ally"],
           power: 2, tx: "Action - {r}: Attack"}}), null);
  assert.equal(BD.boardPow({uid: 7, kind: "token",
    card: {name: "Probe Sigil", uid: 7, tt: "Generic Token - Aura",
           ty: ["Generic", "Aura"], tx: "Ward 1"}}), null,
    "and null where there is no activation line at all");
});

test("the three cost flags that GENERALISE are stamped", () => {
  /* v3.63's rule, sixth outing. `equipPiece` stamps five and this builder
     stamped NONE, so a cost the parser reads was charged on the gear route
     and free on this one. These three are ZONE-AGNOSTIC — `execute` takes
     the soul out of `sd.soul`, the discard out of `sd.hand` and the named
     permanent off the board — and `judge.abCostWhy` refuses each before
     the ability resolves, out of the one body all three branches call.

     THEY ARE GUARDS: measured over the pinned pool, no arena record prints
     any of them (the census below pins that), so the fixtures are
     synthetic (v3.73). */
  const mk = tx => BD.boardPow({uid: 9, kind: "token",
    card: {name: "Probe " + tx.length, uid: 9, tt: "Generic Token - Item",
           ty: ["Generic", "Item"], tx}});
  const soul = mk("Instant - Banish a card from your soul: Gain {r}{r}");
  assert.equal(soul && soul._soulCost, 1, "the soul cost rides on the powCard");
  const disc = mk("Action - Discard an ally: Draw a card");
  assert.ok(disc && disc._discardCost, "the discard cost rides too");
  assert.equal(disc._discardSubject, "ally",
    "…with the printed SUBJECT, because the refusal quotes the word (v4.14)");
  const named = mk("Instant - {t}, destroy a Gold you control: Draw a card");
  assert.equal(named && named._destroyBoard, "Gold",
    "and the named permanent, with its printed CAPITALISATION (v3.53, v3.86)");
});

test("the two that carry a GEAR uid are deliberately NOT stamped", () => {
  /* HALF-BUILDING A COST IS WORSE THAN THE HONEST GAP (v3.23).
     `_selfBanish` carries `_banishGear` and `_flipUp` carries `_flipGear`,
     and BOTH `execute` and `abCostWhy` resolve those uids against
     `sd.gear` — so an arena permanent stamped with either has its ability
     refused forever (the flip can never find a face-down piece) or
     banishes nothing at all (its entry is on the board, not in the gear).
     Wrong rather than latent, so they are left off and the census below
     fails the day a pool record prints one. */
  const flip = BD.boardPow({uid: 11, kind: "token",
    card: {name: "Probe Cloak", uid: 11, tt: "Generic Token - Aura", ty: ["Generic", "Aura"],
           tx: "Instant - {r}, turn this face-up: Draw a card"}});
  if(flip) assert.equal(flip._flipUp, undefined,
    "a flip cost on an arena permanent would refuse the ability forever");
  const ban = BD.boardPow({uid: 12, kind: "token",
    card: {name: "Probe Relic", uid: 12, tt: "Generic Token - Item", ty: ["Generic", "Item"],
           tx: "Instant - Banish this and a card from your soul: Gain {r}{r}"}});
  if(ban) assert.equal(ban._selfBanish, undefined,
    "a self-banish would banish nothing — the entry is on the board");
  /* AND THE GEAR BUILDER STILL STAMPS BOTH, which is the control: asserting
     an absence proves nothing if the flags stopped being produced at all
     (v3.98 — ask for both halves). */
  const gr = {uid: 13, name: "Probe Piece", tt: "Generic Equipment - Chest",
              ty: ["Generic", "Equipment"],
              tx: "Instant - {r}, turn this face-up: Draw a card"};
  BD.equipPiece(gr);
  assert.ok(gr.powCard && gr.powCard._flipUp === true,
    "the GEAR builder still stamps the flip — the scan is alive");
  assert.equal(gr.powCard._flipGear, 13, "…with the gear uid this builder cannot supply");
});

/* ---- 4. the one reader the UI asks ---------------------------------- */

test("`boardAbilityOf` is how a caller asks, so no UI reads card text", {skip}, () => {
  H.db();
  const pot = H.card("Energy Potion", 3);
  const g = arena([ent(pot, 921)]);
  const ab = J.boardAbilityOf(g, 0, 921);
  assert.ok(ab, "it answers the powCard");
  assert.equal(ab.uid, "bp921");
  assert.equal(J.boardAbilityOf(g, 0, 999), null, "null for a uid that is not there");
  /* AND NULL FOR AN ALLY, whose attack is the other route (v3.44). LATENT
     — both `legal` and the tile ask the attack FIRST, so nothing reaches
     this today — which is exactly why it needs a drill: the sabotage that
     forces `kind:"token"` came back SILENT without one, and `weaponCost`
     reads an ally's printed grammar perfectly (v3.73's synthetic rule). */
  /* THE FIXTURE MUST BE AN ALLY `parseHeroPower` WOULD OTHERWISE READ, or
     the `kind` guard is not the thing refusing: handed the bare `Action -
     {r}: Attack`, `classifyClause("Attack")` answers null and `boardPow`
     refuses for the PAYLOAD, so dropping the guard is silent. Cutty Shark's
     shape — an attack line plus a real second ability — is what bites. */
  const ally = {uid: 922, name: "Probe Deckhand", tt: "Pirate Ally", ty: ["Pirate", "Ally"],
                power: 2, life: 3, cost: 1,
                tx: "Action - {r}: Attack\nOnce per Turn Action - {r}: " +
                    "Your next ally attack this turn gets +1{p}"};
  assert.ok(PR.parseHeroPower(ally.tx, true),
    "fixture: `parseHeroPower` DOES read this line, so only the ally guard can refuse it");
  const ga = arena([{uid: 922, kind: "ally", card: ally, life: 3}]);
  assert.equal(J.boardAbilityOf(ga, 0, 922), null,
    "an ally is the ATTACK route — an ability powCard for one is a second reader " +
    "of the same printed line");
  assert.ok(J.boardAttackOf(ga, 0, 922), "…and the attack reader DOES answer for it");
  assert.equal(J.boardAttackOf(g, 0, 921), null,
    "…and the ATTACK reader answers null for the same entry — two questions");
  /* THE TABLE ASKS IT, and asks the attack FIRST: `boardPow` answers null
     for an ally, but an aura Cosmo has turned into a weapon can print an
     ability too and the attack is the route its deck is built for. */
  const TABLE = HTML.slice(HTML.indexOf("function TableBoard("))
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(TABLE, /DawnJudge\.boardAbilityOf\(g, mySeat, b\.uid\)/,
    "the arena tile must offer the ability, or the route has no caller here (v3.50)");
  assert.ok(TABLE.indexOf("boardAttackOf") < TABLE.indexOf("boardAbilityOf"),
    "the attack is asked first");
  assert.ok(!/parseHeroPower|fxParse/.test(TABLE.slice(TABLE.indexOf("InPlayRow entries={me.board}"),
                                                       TABLE.indexOf("InPlayRow entries={me.board}") + 900)),
    "and the tile reads NO card text — judge asks the parser (v3.84's contract)");
});

test("all three activation branches refuse a tapped or unpayable ability", {skip}, () => {
  /* ONE BODY, THREE BRANCHES (v3.99, and `cloaked.test.js` pins the call
     count). What this drives is that the ARENA branch is one of them: an
     empty soul must refuse an ability whose cost is a soul banish, here as
     much as on the hero's route and the gear piece's. Synthetic, because
     no pool arena record prints the cost. */
  H.db();
  const relic = {uid: 931, name: "Probe Reliquary", tt: "Generic Token - Item",
                 ty: ["Generic", "Item"],
                 tx: "Instant - Banish a card from your soul: Gain {r}{r}"};
  const empty = arena([ent(relic, 931)], {soul: []});
  assert.match(String(J.legal(empty, {t: "activate", uid: 931}, 0)), /from the soul/,
    "the arena branch must ask `abCostWhy` — a cost nobody refuses is the sev-1 " +
    "category wearing a legal move's clothes");
  const held = arena([ent(relic, 931)], {soul: [{name: "Soul", uid: "s1", pitch: 1}]});
  assert.equal(J.legal(held, {t: "activate", uid: 931}, 0), null,
    "…and a stocked soul CAN pay — the control (v3.98)");
});

test("the WINDOW is read, so an instant ability is legal on their turn", {skip}, () => {
  /* TWO GUARDS, AND ONE FIXTURE CANNOT SEE BOTH. Written as "their turn
     with ap 0" the window test refuses first and the action-point test is
     unreachable behind it, so BOTH sabotages came back silent — v3.62, and
     v4.34's *ask which half of the guard your fixture reaches*. Each half
     gets a state where the OTHER guard is satisfied. */
  H.db();
  const pot  = H.card("Energy Potion", 3);         /* Instant */
  const snap = H.card("Timesnap Potion", 3);       /* Action  */

  /* (a) THE WINDOW, with the action point HELD. Seat 0 defends in the
     DEFEND step: CR 7.3.3 gives the turn-player priority there and
     `speedAllowed` opens instants only — so an ACTION ability must be
     refused for the window even with a point in hand. */
  const g = arena([ent(pot, 941), ent(snap, 942)]);
  const def = {...g, turnPlayer: 0, phase: "action", step: "defend", priority: 0};
  def.sides = g.sides.slice();
  def.sides[0] = {...g.sides[0], ap: 1};
  assert.deepEqual(require("../engine/priority.js").speedAllowed(def, 0), ["instant"],
    "fixture: the defend step opens instants only (CR 7.3.3)");
  assert.match(String(J.legal(def, {t: "activate", uid: 942}, 0)),
    /no action-speed window for Timesnap Potion/,
    "an ACTION ability is refused for the WINDOW, and the refusal names it");
  assert.equal(J.legal(def, {t: "activate", uid: 941}, 0), null,
    "…while the INSTANT is legal in the same state — the control, or the " +
    "refusal above says nothing about windows (v3.98)");

  /* (b) THE ACTION POINT, with the window OPEN. Same seat, the action
     phase's own layer step, and no point: CR 8.1.1 charges the point to an
     ACTION and CR 8.1.6 charges an instant nothing. */
  const flat = {...g, turnPlayer: 0, phase: "action", step: "layer", priority: 0};
  flat.sides = g.sides.slice();
  flat.sides[0] = {...g.sides[0], ap: 0};
  assert.equal(String(J.legal(flat, {t: "activate", uid: 942}, 0)), "no action point left",
    "CR 8.1.1 — an ACTION ability costs the point, and the window is open here");
  assert.equal(J.legal(flat, {t: "activate", uid: 941}, 0), null,
    "CR 8.1.6 — and an instant needs none");
});

/* ---- 5. the pool census --------------------------------------------- */

test("the arena activation census is pinned, both halves", {skip}, () => {
  /* A CENSUS, NOT A COUNT (v4.17): the SET, so a record joining or leaving
     is a deliberate edit. Both halves are pinned — the seven that READ and
     the four that REFUSE — because pinning the readers alone cannot see a
     name leaving the list (v4.29). */
  const raw = JSON.parse(fs.readFileSync(require("./helpers/extract").cardDbPath(), "utf8"));
  const all = raw.filter(c => c && c.name).map(c => {
    const m = CD.mapDbCard(c);
    return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, life: m.hp,
            tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
  });
  const reads = new Set(), refuses = new Set();
  const flags = {soul: [], disc: [], destroyBoard: [], selfBanish: [], flipUp: []};
  const taps = new Set(), noDestroy = new Set();
  for(const c of all){
    if(TY.destination(c) !== "arena") continue;
    if(TY.permanentKind(c) === "ally") continue;
    if(!/(?:once per turn )?(?:attack reaction|action|instant)\s*[-—]/i.test(c.tx || "")) continue;
    const pw = PR.parseHeroPower(c.tx || "", true);
    if(!pw){ refuses.add(c.name); continue; }
    reads.add(c.name);
    if(pw.soul) flags.soul.push(c.name);
    if(pw.discardCost) flags.disc.push(c.name);
    if(pw.destroyBoard) flags.destroyBoard.push(c.name);
    if(pw.selfBanish) flags.selfBanish.push(c.name);
    if(pw.flipUp) flags.flipUp.push(c.name);
    if(PR.tapsToActivate(c.tx || "")) taps.add(c.name);
    if(!pw.sd) noDestroy.add(c.name);
  }
  assert.deepEqual([...reads].sort(),
    ["Concealed Object", "Copper", "Diamond", "Energy Potion", "Gold", "Silver",
     "Timesnap Potion"],
    "the arena records whose ability READS — four decked (Lyath, Dorinthea, Fai, " +
    "Gravy Bones) plus three treasure tokens with no creator yet");
  assert.deepEqual([...refuses].sort(),
    ["Bait", "Fealty", "Gate to i'Arathael", "Goldkiss Rum"],
    "and the four that refuse — Bait's payload is its own +1{p} (v3.63), Fealty's " +
    "\"the next CARD you play is Draconic\" has no reader, Gate plays from the " +
    "banished zone, and Goldkiss Rum's cost is a compound {t}-your-hero");
  /* THE TAP IS THE SHARP HALF: exactly one record prints it, and it is the
     only one of the seven that does NOT print "destroy this" — which is
     why nothing else limited it and it pumped forever. */
  assert.deepEqual([...taps], ["Concealed Object"],
    "one {t} cost in the arena, so the tap fix is about exactly this card");
  assert.deepEqual([...noDestroy], ["Concealed Object"],
    "…and it is the only one whose permanent is not spent by its own cost");
  /* AND THE THREE STAMPED FLAGS ARE GUARDS while these stay empty; the two
     UNSTAMPED ones are the honest gap while theirs do (v3.23). */
  for(const k of Object.keys(flags))
    assert.deepEqual(flags[k], [],
      "an arena record now prints a " + k + " cost — `build.boardPow` must be " +
      "re-measured: the three zone-agnostic flags are stamped as guards, and " +
      "`_selfBanish`/`_flipUp` are LEFT OFF because they carry a gear uid");
});
