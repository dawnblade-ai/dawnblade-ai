/* The node drills, formalized. Covers the three historical ad-hoc drills
   (weaponCost, classifyClause conditionals, the {p} pump parser) plus the
   op vocabulary and the Kayo printed-vs-granted keyword regression.
   Gotcha honored throughout: fxParse memoizes on name|pitch, so every
   fixture card gets a unique name (and fxReset runs per suite). */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");

const cc = t => P.classifyClause(t);

test("classifyClause — plain go again", () => {
  assert.deepEqual(cc("Go again"), {status:"run", ops:[["ga"]]});
  assert.deepEqual(cc("This gains go again."), {status:"run", ops:[["ga"]]});
});

test("classifyClause — dominate/intimidate are honest noops (dummy has no hand)", () => {
  assert.equal(cc("**Dominate**").status, "noop");
  assert.equal(cc("Intimidate").status, "noop");
});

test("classifyClause — on-hit wraps the inner effect", () => {
  const r = cc("If this hits, draw a card.");
  assert.equal(r.onHit, true);
  assert.deepEqual(r.ops, [["draw",1]]);
});

test("classifyClause — conditional: another attack action this turn", () => {
  const r = cc("If you have played another attack action card this turn, this gets +2 {p}.");
  assert.equal(r.cond, "atk");
  assert.deepEqual(r.ops, [["self",2]]);
});

test("classifyClause — conditional: another non-attack action this turn", () => {
  const r = cc("If you have played another non-attack action card this turn, this gains go again.");
  assert.equal(r.cond, "non");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("classifyClause — Buckwild condition: 6+ {p} in pitch zone", () => {
  const r = cc("If there are 6 or more {p} worth of cards in your pitch zone, this gains go again.");
  assert.equal(r.cond, "pitch6");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("classifyClause — Pulping condition: defended by fewer than 2 non-equipment", () => {
  const r = cc("If this is defended by fewer than 2 non-equipment cards, it gains go again.");
  assert.equal(r.cond, "defLt2");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("classifyClause — Savage Feast condition: 6+ {p} discarded as cost", () => {
  const r = cc("If a card with 6 or more {p} was discarded to play this, it gains go again.");
  assert.equal(r.cond, "discard6");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("classifyClause — unmet condition wrapper with unparsed body returns null", () => {
  assert.equal(cc("If you have played another attack action card this turn, transmogrify the fortress."), null);
});

test("classifyClause — op vocabulary", () => {
  assert.deepEqual(cc("Target defending card gains +2 {d}.").ops, [["defBuff",2]]);
  assert.deepEqual(cc("Target attack gets -1 {p}.").ops, [["atkMinus",1]]);
  assert.deepEqual(cc("Ward 3").ops, [["ward",3]]);
  assert.deepEqual(cc("Prevent the next 2 arcane damage that would be dealt to you.").ops, [["awd",2]]);
  assert.deepEqual(cc("Deal 2 arcane damage to any target.").ops, [["arcane",2]]);
  assert.deepEqual(cc("Draw two cards.").ops, [["draw",2]]);
  assert.deepEqual(cc("Gain 2 {r}.").ops, [["res",2]]);
  assert.deepEqual(cc("Gain 3 {h}.").ops, [["life",3]]);
  /* The qualifier is CARRIED now. This line used to assert a bare
     [["buffNext",1]], which pinned the bug: a "weapon attack" buff was
     applied to any next attack at all. op[2] is the type-line matcher. */
  assert.deepEqual(cc("Your next weapon attack this turn gains +1 {p}.").ops, [["buffNext",1,[["weapon"]]]]);
  assert.deepEqual(cc("Your next attack this turn gains +1 {p}.").ops, [["buffNext",1]],
    "a genuinely unqualified buff must stay unqualified");
  assert.deepEqual(cc("This attack gains +3 {p}.").ops, [["self",3]]);
  assert.deepEqual(cc("Amp 1").ops, [["amp",1]]);
  assert.deepEqual(cc("Create a Runechant token.").ops, [["rune",1]]);
  assert.deepEqual(cc("Create 2 Runechant tokens.").ops, [["rune",2]]);
  /* v2.74: this line used to assert `status === "noop"`. That was not a
     rule, it was a fact about the training prop — "frostbite — dummy pays
     no costs" — and it expired in v2.71 when seat 1 got a real turn. A
     Frostbite is an ordinary token op now and the tax it applies is read
     off the board by `frostCount` inside `effCost`. Changing this drill is
     the deliberate edit the behaviour change requires. */
  assert.deepEqual(cc("Create a Frostbite token.").ops, [["token","frostbite",1,"self"]]);
});

test("classifyClause — gaNext, and the runechant rider carries its PRINTED count", () => {
  assert.deepEqual(cc("The next attack action card you play this turn gains go again.").ops, [["gaNext"]]);
  /* v3.10: `runeHitNext` was a bare flag and the test for it was the
     literal string "create a runechant" — so of Mauvrion Skies' three
     pitches only the BLUE copy matched, and it forged one Runechant
     because one was all a boolean could say. Red prints 3 and yellow 2,
     and both forged nothing at all. */
  assert.deepEqual(cc("The next attack action card you play this turn gains go again, and if it hits create a Runechant.").ops,
    [["gaNext"],["runeHitNext",1]]);
  assert.deepEqual(cc("The next Runeblade attack action card you play this turn gets go again and \"When this hits, create 3 Runechant tokens.\"").ops,
    [["gaNext"],["runeHitNext",3]], "the printed count, not a flag");
  assert.deepEqual(cc("The next Runeblade attack action card you play this turn gets go again and \"When this hits, create 2 Runechant tokens.\"").ops,
    [["gaNext"],["runeHitNext",2]]);
});

test("classifyClause — soul: self-entombing and soul spend", () => {
  const hit = cc("When this hits, put it into your hero's soul.");
  assert.equal(hit.onHit, true);
  assert.deepEqual(hit.ops, [["soulSelf"]]);
  // note: an inner effect like "draw a card" is claimed by the earlier
  // unanchored draw regex; ^-anchored effects (Ward) reach the soul branch
  const spend = cc("Banish a card from your soul: Ward 2");
  assert.deepEqual(spend.ops, [["soulSpend",1,[["ward",2]]]]);
});

test("classifyClause — foe discard (live vs a real opponent, logged inert vs dummy)", () => {
  assert.deepEqual(cc("They discard a card.").ops, [["foeDiscard",1]]);
});

test("classifyClause — never guesses: unknown text returns null", () => {
  assert.equal(cc("Shuffle your deck."), null);
  assert.equal(cc(""), null);
});

/* ---------- fxParse ---------- */

test("fxParse — Kayo regression: granted keywords must NOT read as printed", () => {
  P.fxReset();
  const fx = P.fxParse({name:"kayo-guard-1", pitch:1, tt:"Attack Action", power:4,
    kw:[], gkw:["Go again"], tx:""});
  assert.equal(fx.ga, false, "granted go-again leaked into printed ga — the Kayo bug");
});

test("fxParse — printed go again keyword sets ga", () => {
  P.fxReset();
  const fx = P.fxParse({name:"kayo-guard-2", pitch:1, tt:"Attack Action", power:4,
    kw:["Go again"], gkw:[], tx:""});
  assert.equal(fx.ga, true);
});

test("fxParse — conditional go again stays conditional, not printed", () => {
  P.fxReset();
  const fx = P.fxParse({name:"buckwild-drill", pitch:1, tt:"Attack Action", power:4, kw:[],
    tx:"If there are 6 or more {p} worth of cards in your pitch zone, this gains go again."});
  assert.equal(fx.ga, false);
  /* `instead` rides along from v2.32 — a conditional payload that REPLACES
     the printed value rather than adding to it. False here, and that is
     the point: this card adds go again, it does not replace anything. */
  assert.deepEqual(fx.conds, [{cond:"pitch6", op:["ga"], instead:false}]);
});

test("fxParse — the {p} pump drill: +1/2/3{p} reads the copy's pitch", () => {
  P.fxReset();
  for(const pitch of [1,2,3]){
    const fx = P.fxParse({name:"pummel-drill-"+pitch, pitch, tt:"Instant - Attack Reaction", power:null,
      kw:[], tx:"Target attack action card gains +1/2/3 {p}."});
    assert.equal(fx.self, pitch, `red/yellow/blue shorthand should pump by pitch (${pitch})`);
  }
});

test("fxParse — Pummel's second clause: on-hit discard rides along", () => {
  P.fxReset();
  const fx = P.fxParse({name:"pummel-drill-full", pitch:2, tt:"Instant - Attack Reaction", power:null,
    kw:[], tx:"Target attack action card gains +1/2/3 {p}. When this hits a hero, they discard a card."});
  assert.equal(fx.self, 2);
  assert.deepEqual(fx.onHit, [["foeDiscard",1]]);
});

test("fxParse — explicit +N{p} pump on a non-attack", () => {
  P.fxReset();
  const fx = P.fxParse({name:"pump-drill-flat", pitch:3, tt:"Action", power:null,
    kw:[], tx:"Target attack gains +2 {p}."});
  assert.equal(fx.self, 2);
});

test("fxParse — additional cost: mandatory discard is captured, optional is not", () => {
  P.fxReset();
  const must = P.fxParse({name:"feast-drill-must", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play this, discard a card."});
  assert.deepEqual(must.addCost, {discard:1, random:false});
  const may = P.fxParse({name:"feast-drill-may", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play this, you may discard a card."});
  assert.equal(may.addCost, undefined);
});

/* THE TWO THINGS THAT MADE THIS MISS SAVAGE FEAST, pinned separately so a
   future tightening of the pattern cannot quietly drop either again.
   Missing them meant `fx.addCost` was never set on ANY Kayo card: the cost
   went unpaid and the rider that asks about it read an unrelated event —
   cost skipped, payload collected. */
test("fxParse — an additional cost may NAME the card instead of saying 'this'", () => {
  P.fxReset();
  const fx = P.fxParse({name:"feast-drill-named", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play Savage Feast discard a random card."});
  assert.ok(fx.addCost, "the card names itself, and there is no comma after the name");
  assert.equal(fx.addCost.discard, 1);
});

test("fxParse — a RANDOM discard is a different cost from a chosen one", () => {
  P.fxReset();
  const rnd = P.fxParse({name:"feast-drill-rand", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play this, discard a random card."});
  assert.equal(rnd.addCost.random, true,
    "the engine's auto-discard picks your LOWEST-VALUE card, which is strictly " +
    "better than a card that prints 'random'");
  const chosen = P.fxParse({name:"feast-drill-chosen", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play this, discard a card."});
  assert.equal(chosen.addCost.random, false);
});

test("fxParse — graveyard/banish play flags", () => {
  P.fxReset();
  const gy = P.fxParse({name:"gy-drill", pitch:1, tt:"Attack Action", power:3, kw:[],
    tx:"You may play this from your graveyard."});
  assert.equal(gy.fromGY, true);
  const ban = P.fxParse({name:"ban-drill", pitch:1, tt:"Attack Action", power:3, kw:[],
    tx:"You may play this from your banished zone."});
  assert.equal(ban.fromBan, true);
});

test("fxParse — permanents and defense reactions detected from type text", () => {
  P.fxReset();
  assert.equal(P.fxParse({name:"perm-drill-ally", pitch:2, tt:"Ally", power:2, kw:[], tx:""}).perm, "ally");
  assert.equal(P.fxParse({name:"perm-drill-item", pitch:2, tt:"Item", power:null, kw:[], tx:""}).perm, "item");
  assert.equal(P.fxParse({name:"perm-drill-aura", pitch:2, tt:"Aura", power:null, kw:[], tx:""}).perm, "aura");
  assert.equal(P.fxParse({name:"dr-drill", pitch:3, tt:"Defense Reaction", power:null, kw:[], tx:""}).dr, true);
});

test("fxParse — coverage tiers count unparsed clauses honestly", () => {
  P.fxReset();
  const part = P.fxParse({name:"tier-drill-part", pitch:1, tt:"Attack Action", power:4, kw:[],
    tx:"Go again. Perform an unscriptable ritual."});
  assert.equal(part.tier, "part");
  const none = P.fxParse({name:"tier-drill-none", pitch:1, tt:"Action", power:null, kw:[],
    tx:"Perform an unscriptable ritual."});
  assert.equal(none.tier, "none");
});

test("fxParse — THE MEMO GOTCHA: same name|pitch silently returns the cached parse", () => {
  P.fxReset();
  const a = P.fxParse({name:"memo-drill", pitch:1, tt:"Attack Action", power:4, kw:["Go again"], tx:""});
  const b = P.fxParse({name:"memo-drill", pitch:1, tt:"Attack Action", power:4, kw:[], tx:"Ward 3"});
  assert.equal(a, b, "expected the documented memoization collision — unique fixture names are mandatory");
});

/* ---------- weaponCost ---------- */

test("weaponCost — resource costs in numeral and {r} symbol form", () => {
  assert.deepEqual(P.weaponCost("Once per Turn Action - [2 Resources]: Attack"),
    {cost:2, addRust:false, needSteam:false, taps:false, oncePerTurn:true});
  assert.deepEqual(P.weaponCost("Action - {r}{r}: Attack"),
    {cost:2, addRust:false, needSteam:false, taps:false, oncePerTurn:false});
  assert.deepEqual(P.weaponCost("Action - 0: Attack"),
    {cost:0, addRust:false, needSteam:false, taps:false, oncePerTurn:false});
});

/* ONCE PER TURN IS PRINTED, NOT UNIVERSAL (Phase 1). Eleven of the pool's
   thirteen weapons print it and two do not — Sledge of Anvilheim and
   Scorpio, Comet Tail may swing again for anyone who can pay again.
   Gating every weapon on a blanket "already swung" flag, which is what
   the trainer does, makes those two strictly WEAKER than printed. That is
   a direction `npm run fairness` is deliberately one-sided against and
   cannot report, and coverage cannot see it either: the text was read
   correctly and then charged wrongly — the same shape as the instant that
   ate an action point. */
test("weaponCost — 'once per turn' is read off the line, not assumed", () => {
  assert.equal(P.weaponCost("Once per Turn Action - {r}: Attack").oncePerTurn, true);
  assert.equal(P.weaponCost("Action - {r}: Attack").oncePerTurn, false);
  /* the real pair, verbatim in shape */
  assert.equal(P.weaponCost("Once per Turn Action - {r}: Attack\nGo again").oncePerTurn, true);
  assert.equal(P.weaponCost("Action - {r}{r}{r}{r}: Attack").oncePerTurn, false);
});

/* TWO LIMITS, TWO REASONS, and honouring one without the other gets a
   card wrong in a different direction each time.

     Sledge of Anvilheim  "Action - {r}{r}{r}{r}: Attack"
       neither limit — genuinely repeatable. A blanket "already swung"
       flag makes it WEAKER than printed.
     Scorpio, Comet Tail  "Action - {t}: Attack. ..."
       no "Once per Turn", but {t} taps it and a tapped permanent does
       not untap until CR 4.4.3d. Reading only `oncePerTurn` would make
       it STRONGER than printed.

   Neither sweep can see either one: fairness is deliberately one-sided
   towards too-strong, and coverage reads both cards as `full` because
   the text was read correctly and then CHARGED wrongly. */
test("weaponCost — the {t} tap cost is read separately from 'once per turn'", () => {
  const scorpio = P.weaponCost("Action - {t}: Attack. Activate this only if you control a Lightning attack.");
  assert.equal(scorpio.taps, true, "the {t} cost was not read");
  assert.equal(scorpio.oncePerTurn, false, "Scorpio does not print 'Once per Turn'");

  const sledge = P.weaponCost("Action - {r}{r}{r}{r}: Attack");
  assert.equal(sledge.taps, false);
  assert.equal(sledge.oncePerTurn, false, "Sledge does not print 'Once per Turn' either");
  assert.equal(sledge.cost, 4);

  /* the tap is a COST, so it must not be counted as a resource */
  assert.equal(scorpio.cost, 0, "{t} was counted as a resource cost");
});

test("weaponCost — Talishar rust and steam-spend riders", () => {
  const rust = P.weaponCost("Once per Turn Action - 0, put a rust counter on this: Attack");
  assert.equal(rust.addRust, true);
  const steam = P.weaponCost("Action - 0, remove a steam counter from this: Attack");
  assert.equal(steam.needSteam, true);
});

test("weaponCost — non-attack ability text is not a weapon cost", () => {
  assert.equal(P.weaponCost("Instant - 2: Draw a card"), null);
  assert.equal(P.weaponCost(""), null);
});

/* ---------- parseHeroPower ---------- */

test("parseHeroPower — cost, effect, kind, trailing go again", () => {
  const p = P.parseHeroPower("Once per Turn Action - 3: Draw a card. Go again");
  assert.equal(p.cost, 3);
  assert.equal(p.ga, true);
  assert.equal(p.kind, "action");
});

test("parseHeroPower — {r} symbol costs and instant kind", () => {
  const p = P.parseHeroPower("Instant - {r}{r}: Amp 1");
  assert.equal(p.cost, 2);
  assert.equal(p.kind, "instant");
  assert.equal(p.ga, false);
});

test("parseHeroPower — refuses non-resource costs unless destroy is allowed", () => {
  assert.equal(P.parseHeroPower("Action - Discard a card: Draw a card"), null);
  assert.equal(P.parseHeroPower("Action - Destroy this: Draw a card"), null);
  const sd = P.parseHeroPower("Action - Destroy this: Draw a card", true);
  assert.equal(sd.sd, true);
});

test("parseHeroPower — refuses effects it cannot script", () => {
  assert.equal(P.parseHeroPower("Action - 2: Transmogrify the fortress"), null);
});

/* Runechants are AURAS on the board now, not an integer, so a cost-reduction
   fixture has to build the real thing. `runeCount` reads the board — that is
   the whole point of the v2.23 change (an integer could never be counted by
   "3 or more auras" or destroyed by "destroy an aura you control"). */
const runeBoard = n => ({board: Array.from({length:n}, (_,i) =>
  ({card:{uid:"r"+i, name:"Runechant", tt:"Runeblade Token - Aura"}, kind:"aura", uid:"r"+i}))});

/* ---------- runechant cost reduction ---------- */

test("runeRed / effCost — 'costs less per runechant' discounts, floored at 0", () => {
  const card = {cost:3, tx:"This costs {1} less for each Runechant you control."};
  assert.equal(P.runeRed(card), 1);
  assert.equal(P.effCost(card, runeBoard(2)), 1);
  assert.equal(P.effCost(card, runeBoard(9)), 0);
  assert.equal(P.effCost({cost:2, tx:"Go again."}, runeBoard(5)), 2);
});

/* ---------- predicates ---------- */

test("card predicates — attack/arrow/weapon/reaction/instant typing", () => {
  assert.equal(P.isAttack({tt:"Attack Action", power:4}), true);
  assert.equal(P.isAttack({tt:"Action", power:null}), false);
  assert.equal(P.isArrow({tt:"Attack Action - Arrow"}), true);
  assert.equal(P.isWeapon({tt:"Weapon - Sword 1H", power:3}), true);
  assert.equal(P.isAR({tt:"Instant - Attack Reaction"}), true);
  assert.equal(P.isInstantT({tt:"Instant"}), true);
  assert.equal(P.isInstantT({tt:"Instant - Defense Reaction"}), false);
  assert.equal(P.hasKw({kw:["Boost"], tx:""}, "boost"), true);
  assert.equal(P.hasKw({kw:[], tx:"**Crush** — deals 4 or more damage"}, "crush"), true);
});

/* ---------- v1.21: printed-line splitting + keyword lines ----------
   The database prints keyword lines in their own paragraph. clean()
   collapses newlines, so fxParse must split on them FIRST or "Stealth"
   gets glued to the rules text and the whole card reads as one clause. */

test("fxParse — splits on the printed line breaks, not just sentences", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Drill Line Split", pitch:1, tt:"Attack Action",
    power:3, kw:["Stealth"], tx:"**Stealth**\n\nWhen this hits, draw a card."});
  assert.equal(fx.clauses.length, 2, "keyword line and rules text are separate clauses");
  assert.equal(fx.clauses[0].t, "Stealth");
  assert.deepEqual(fx.onHit, [["draw",1]], "the on-hit trigger survives the split");
});

test("classifyClause — engine-handled keyword lines are honest noops", () => {
  for(const k of ["Boost","Battleworn","Temper","Guardwell","Blade Break","Crush"])
    assert.equal(cc(k).status, "noop", k+" is carried by the keyword system");
  assert.equal(cc("Arcane Barrier 1").status, "noop");
  assert.equal(cc("Legendary").status, "noop");
  assert.equal(cc("Kayo Specialization").status, "noop");
});

test("classifyClause — pending keywords stay gaps, never papered over", () => {
  for(const k of ["Charge","Combo"])
    assert.equal(cc(k), null, k+" must keep surfacing as a coverage gap");
  /* Reload was taught in v2.39 — CR-verified (put a card from hand
     face-down into an empty arsenal, no type filter). Moved out of this
     list deliberately, not silently. */
  assert.deepEqual(cc("Reload"), {status:"run", ops:[["reload"]]});
});

/* ---- v2.06: the rulings of 2026-07-25 ----------------------------------
   Stealth, mark and aim counters were ruled pure qualifiers: they do nothing
   alone, other cards test for them. Opt was ruled outright. Tokens are cards
   and go on a player's board. */

test("rulings — stealth and mark are qualifiers, not gaps", () => {
  assert.equal(cc("Stealth").status, "noop");
  assert.equal(cc("Mark").status, "noop");
});

test("rulings — mark/aim leave state behind when a clause sets them", () => {
  const r = cc("When this hits a hero, mark them.");
  assert.equal(r.onHit, true);
  assert.deepEqual(r.ops, [["mark",1]]);
  assert.deepEqual(cc("Put an aim counter on it").ops, [["aim",1]]);
});

test("rulings — opt X reads as a deck-peek op", () => {
  assert.deepEqual(cc("Opt 1").ops, [["opt",1]]);
  assert.deepEqual(cc("Opt 2").ops, [["opt",2]]);
});

test("rulings — tokens resolve to a board-side token op", () => {
  assert.deepEqual(cc("Create an Agility token").ops, [["token","agility",1,"self"]]);
  assert.deepEqual(cc("Create a Gold token.").ops, [["token","gold",1,"self"]]);
  assert.deepEqual(cc("Create an Inertia token under their control.").ops,
    [["token","inertia",1,"foe"]], "under their control targets the opponent");
  /* one noun, two tokens — Goblet of Bloodrun Wine. Reads as "agility and a
     vigor" if the list isn't split, which resolves to no card at all. */
  assert.deepEqual(cc("Create an Agility and a Vigor token.").ops,
    [["token","agility",1,"self"],["token","vigor",1,"self"]]);
});

test("rulings — RUNECHANT is the last dedicated counter; every other token is a board token", () => {
  /* THIS LIST HAS ONLY EVER SHRUNK, and that is the direction it should
     go. It was four counters; Frostbite left at v2.74, Bloodrot Pox and
     Frailty at v3.09. Each departure bought the same three things: the
     token expires on its own printed schedule, the seven pool cards that
     count auras generically can see it, and there is no bespoke per-token
     state to keep in step with the board.

     Runechant keeps `rune` because `addRunechants` owns its uid
     namespacing (v2.23's `CARD-IN-TWO-ZONES`), not because it is a
     counter — it is a real Aura on the board like the others. */
  assert.deepEqual(cc("Create a Runechant token.").ops, [["rune",1]]);
  assert.deepEqual(cc("Create a Frostbite token.").ops, [["token","frostbite",1,"self"]],
    "Frostbite is a board token (v2.74) — it must NOT be intercepted here");
  assert.deepEqual(cc("Create a Bloodrot Pox token under their control.").ops,
    [["token","bloodrot pox",1,"foe"]],
    "Bloodrot Pox is a board token (v3.09), on the side the card prints");
  assert.deepEqual(cc("Create a Frailty token under their control.").ops,
    [["token","frailty",1,"foe"]],
    "and so is Frailty — the counter it replaced was never once set in a real game");
});

test("rulings — arsenal and life-total conditions are readable now", () => {
  assert.equal(cc("If this was played from arsenal, it gets +5{p}.").cond, "arsenal");
  assert.equal(cc("When this is played, if you have less {h} than an opposing hero, it gets go again.").cond, "lifeLt");
  assert.equal(cc("If you control 2 or more Draconic chain links, this gets go again.").cond, "drac2");
});

test("rulings — 'if you do' stays unread: it hangs off an optional cost", () => {
  assert.equal(cc("If you do, create a Seismic Surge token."), null,
    "running an optional-cost payload free is the bug v2.04 fixed");
});

test("classifyClause — a crush rider is the CARD'S OWN payload, not one card's", () => {
  /* THE NOOP THIS REPLACES DESCRIBED ONE CARD AND CLAIMED TWELVE. It was
     anchored to the crush PREFIX and returned "the keyword system forces a
     card from their hand onto their deck" — true of Boulder Drop and of
     nothing else. Eleven other pool cards print a different rider behind
     the same prefix, and every one reported `tier: full` while the engine
     ran Boulder Drop's payload for them. Not unbuilt: SUBSTITUTED. */
  assert.deepEqual(
    cc("Crush - When this deals 4 or more damage to a hero, they put a card from their hand on top of their deck.").ops,
    [["crushRider", 4, [["foeHandToDeck", 1]]]], "Boulder Drop's own payload, read");
  assert.deepEqual(
    cc("Crush - When this deals 4 or more damage to a hero, they discard a card.").ops,
    [["crushRider", 4, [["foeDiscard", 1]]]], "Short Shrift's, which is a different thing");
  assert.deepEqual(
    cc("Crush - When this deals 4 or more damage to a hero, put a -1{d} counter on target equipment they control.").ops,
    [["crushRider", 4, [["foeGearDef", -1]]]], "and Buckling Blow's");
  /* THE THRESHOLD IS PRINTED, not a literal 4. */
  assert.equal(cc("Crush - When this deals 6 or more damage to a hero, they discard a card.").ops[0][1], 6);
  /* AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE. The five "during their
     next turn" riders need a schedule that does not exist, and a noop
     would hide them again — which is precisely what it did. */
  assert.equal(
    cc("Crush - When this deals 4 or more damage to a hero, their first attack during their next turn gets -2{p}."),
    null, "no schedule for the opponent's next turn — say so by refusing");
});

test("classifyClause — target-attack pump folds into self (the reaction pump)", () => {
  /* op[2] IS THE PRINTED TARGET RESTRICTION (v2.69). `self` had nowhere to
     carry one, so `[^.]*` swallowed it and eleven cards pumped whatever was
     swinging — Puncture's "sword or dagger" landing on a bow. Same shape
     v2.30 fixed for buffNext, in the op that never got it. Asserted rather
     than tolerated: a bare ["self",N] here means the restriction is gone. */
  assert.deepEqual(cc("Target weapon attack gains +4{p}"),
    {status:"run", ops:[["self",4,[["weapon"]]]]});
  assert.deepEqual(cc("Target sword or dagger attack gains +3{p} and piercing 1."),
    {status:"run", ops:[["self",3,[["sword"],["dagger"]]]]});
  assert.deepEqual(cc("Target attack gains +2{p}"),
    {status:"run", ops:[["self",2,null]]}, "an unqualified target really is unqualified");
});

test("classifyClause — 'the next ... attack' buffs, not just 'your next'", () => {
  assert.deepEqual(cc("The next attack action card you play this turn gets +4{p}"),
    {status:"run", ops:[["buffNext",4]]});
  assert.deepEqual(cc("Your next attack this turn gets go again"),
    {status:"run", ops:[["gaNext"]]});
});

test("classifyClause — 'prevent N of that damage' reads as ward", () => {
  assert.deepEqual(cc("The next time you would be dealt damage this turn, prevent 2 of that damage"),
    {status:"run", ops:[["ward",2]]});
});

test("classifyClause — activated abilities defer to the weapon/equipment readers", () => {
  assert.equal(cc("Action - {r}, {t}: Attack").status, "noop");
  assert.equal(cc("Instant - Destroy this: Gain {r}").status, "noop");
  assert.equal(cc("Action - Destroy this: Gain 2 action points.").status, "noop");
  assert.deepEqual(cc("Gain {r}{r}"), {status:"run", ops:[["res",2]]});
});

/* WAS "fires early, flagged approx" UNTIL v3.00. The trainer had no
   arena-departure schedule, so the payload was queued on PLAY and Act of
   Glory handed you +6{p} the moment the aura landed instead of two turns
   later — the whole drawback of Suspense inverted into a bonus. It is a
   DEPARTURE TRIGGER now, tagged the way `onHit` is and fired by whatever
   destroys the permanent. This drill changed deliberately: it used to
   assert the approximation. */
test("classifyClause — 'when this leaves the arena' is a departure trigger, not a play effect", () => {
  const r = cc("When this leaves the arena, your next attack this turn gets +6{p}.");
  assert.equal(r.onLeave, true, "tagged for the site that destroys the permanent");
  assert.deepEqual(r.ops, [["buffNext",6]], "and the payload is read, not guessed");
});

/* ---- v2.08: the 2026-07-25 late rulings ------------------------------- */

test("rulings — reveal-and-shift reads the revealed card's pitch", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Drill Rabble", pitch:1, tt:"Generic Action - Attack", power:5,
    tx:"When this attacks, reveal the top card of your deck. This gets -X{p}, where X is the pitch value of the card revealed this way.\nGo again"});
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.ops, [["reveal",1],["revPitch",-1]]);
  assert.equal(fx.ga, true);
});

test("rulings — d6 roll and the intellect rider are separate ops", () => {
  assert.deepEqual(cc("Roll a 6-sided die").ops, [["roll",6]]);
  assert.deepEqual(cc("Until end of turn, your base {i} is the number rolled").ops, [["intRoll"]]);
});

test("rulings — a printed defender limit is hoisted for the declare step", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Drill Context", pitch:3, tt:"Generic Defense Reaction", def:3,
    tx:"This can only defend an attack with 3 or less base {p}."});
  assert.equal(fx.defLimit, 3);
  assert.equal(fx.tier, "full", "the limit is handled, not a gap");
});

test("rulings — phantasm is a drawback checked at the declare step", () => {
  assert.equal(cc("Phantasm").status, "noop");
});

test("rulings — the crowd leaves a per-turn state, Revered is static", () => {
  assert.deepEqual(cc("The crowd boos you").ops, [["boo",1]]);
  assert.deepEqual(cc("The crowd boos each Reviled hero").ops, [["boo",1]]);
  assert.equal(cc("The crowd cheers each Revered hero").status, "noop");
  assert.equal(cc("If you've been booed this turn, this gets +2{p}.").cond, "booed");
  const r = cc("When this attacks a hero, if you have more {h} than them, the crowd boos you");
  assert.equal(r.cond, "lifeGt");
  assert.deepEqual(r.ops, [["boo",1]]);
});

test("rulings — transcend flips the card to Inner Chi", () => {
  assert.deepEqual(cc("Transcend").ops, [["transcend"]]);
  const r = cc("If you've played another blue card this turn, transcend.");
  assert.equal(r.cond, "blue");
  assert.deepEqual(r.ops, [["transcend"]]);
});

test("rulings — reprise reads the dummy's hand blockers (live since v2.05)", () => {
  const r = cc("Reprise - If the defending hero has defended with a card from their hand this chain link, target weapon attack gains +3{p}.");
  assert.equal(r.cond, "reprise");
  assert.deepEqual(r.ops, [["self",3,[["weapon"]]]],
    "the reprise payload keeps its printed 'weapon' restriction (v2.69)");
  const r2 = cc("Reprise - If the defending hero has defended with a card from their hand this chain link, instead it gains +6{p}.");
  assert.deepEqual(r2.ops, [["self",6]]);
  assert.equal(r2.instead, true, "and 'instead' REPLACES inside a keyword gate (v2.66)");
  assert.equal(cc("Reprise").status, "noop", "the bare keyword is a qualifier");
  assert.equal(cc("Inertia").status, "noop", "inertia still has no opponent turn to tax");
});

test("rulings — High Tide reads as a named-keyword-gated condition (Swiftwater Sloop)", () => {
  /* Before this the anchored go-again regex couldn't see it (the clause
     opens with "High Tide - If …", not "if"/"when"), so the card was
     unclaimed. See the comment above the anchored regex in parser.js. */
  const r = cc("High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again.");
  assert.equal(r.status, "run");
  assert.equal(r.cond, "pitchBlue2");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("rulings — Surge reads as a named-keyword-gated condition (Aether Quickening)", () => {
  const r = cc("Surge - If this deals more than 2 damage, it gets go again.");
  assert.equal(r.status, "run");
  assert.equal(r.cond, "surgeOver2");
  assert.deepEqual(r.ops, [["ga"]]);
});

test("rulings — High Tide / Surge do not swallow an unparsed inner clause", () => {
  assert.equal(cc("High Tide - If there are 2 or more blue cards in your pitch zone, transmogrify the fortress."), null);
  assert.equal(cc("Surge - If this deals more than 2 damage, transmogrify the fortress."), null);
});

/* ---- v2.10: the late-July ruling batch --------------------------------- */

test("rulings — runechant cost reduction reads the printed {r} pip", () => {
  /* the cards print "costs {r} less", not "costs 1 less" — the old digit-only
     pattern meant the discount never applied to either card that has it */
  const c = {cost:2, tx:"This costs {r} less to play for each Runechant you control."};
  assert.equal(P.runeRed(c), 1);
  assert.equal(P.effCost(c, runeBoard(2)), 0);
  assert.equal(P.effCost(c, runeBoard(0)), 2);
});

test("rulings — 'Play this only if' is a gate, not an effect", () => {
  P.fxReset();
  const bear = P.fxParse({name:"Drill Bear", pitch:3, tt:"Brute Action - Attack", power:6,
    tx:"Play this only if you've pitched a card with 6 or more {p} this turn."});
  assert.deepEqual(bear.playIf && bear.playIf.kind, "pitch6");
  assert.equal(bear.tier, "full");
  const rough = P.fxParse({name:"Drill Rough", pitch:3, tt:"Brute Action - Attack", power:6,
    tx:"Play this only if you've discarded a card with 6 or more {p} this turn."});
  assert.equal(rough.playIf.kind, "discard6");
});

test("rulings — Reincarnate redirects its own random discard", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Drill Reincarnate", pitch:3, tt:"Brute Action - Attack", power:6,
    tx:"When this is discarded at random, put it on the bottom of its owner's deck."});
  assert.equal(fx.bottomOnDiscard, true);
  assert.equal(fx.tier, "full");
});

test("rulings — life lock and per-source arcane shield read as ops", () => {
  assert.deepEqual(cc("If a hero has more {h} than any other hero, they can't gain {h}").ops, [["lifeLock",1]]);
  assert.deepEqual(cc("If your hero would be dealt arcane damage, prevent 1 arcane damage that source would deal").ops,
    [["arcShield",1]]);
});

test("rulings — self-scrubbing auras carry a schedule", () => {
  assert.deepEqual(cc("At the beginning of your action phase, destroy this").ops, [["selfDestruct","turn"]]);
  assert.deepEqual(cc("At the start of your turn, destroy this").ops, [["selfDestruct","turn"]]);
  assert.deepEqual(cc("At the beginning of your end phase, destroy this").ops, [["selfDestruct","end"]]);
});

test("rulings — Stir the Aetherwinds' longhand amp is read", () => {
  assert.deepEqual(cc("You may play your next Wizard 'non-attack' action card this turn as though it were an instant and if it has an effect that deals arcane damage, instead that effect deals that much arcane damage plus 1.").ops,
    [["amp",1]]);
});

/* ---- v2.11: the Mechanologist batch ------------------------------------ */

test("rulings — Hyper Driver discounts by name off the card's own text", () => {
  const jump = {cost:2, tx:"If you control a Hyper Driver, this costs {r} less to play.\nBoost"};
  assert.equal(P.boardRed(jump, {board:[]}), 0);
  assert.equal(P.boardRed(jump, {board:[{card:{name:"Hyper Driver"}}]}), 1);
  assert.equal(P.effCost(jump, {board:[]}), 2);
  assert.equal(P.effCost(jump, {board:[{card:{name:"Hyper Driver"}}]}), 1);
  /* an unrelated permanent must not discount it */
  assert.equal(P.effCost(jump, {board:[{card:{name:"Teklo Plasma Pistol"}}]}), 2);
});

test("rulings — Out Pace refuses equipment defenders", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Drill OutPace", pitch:1, tt:"Mechanologist Action - Attack",
    power:4, def:3, kw:["Boost"], tx:"Boost\nThis can't be defended by equipment."});
  assert.equal(fx.noEquipDefend, true);
  assert.equal(fx.tier, "full");
});

test("rulings — Fender Bender counts equipment defenders, Overblast counts boosts", () => {
  assert.deepEqual(cc("This gets +X{p}, where X is the number of equipment defending it").ops,
    [["perEquipDef",1]]);
  P.fxReset();
  const ob = P.fxParse({name:"Overblast", pitch:1, tt:"Mechanologist Action - Attack", power:5,
    kw:["Boost"], tx:"Overblast gains +X{p}, where X is the number of times you have boosted this combat chain."});
  assert.deepEqual(ob.ops, [["perBoost",1]]);
  assert.equal(ob.tier, "full");
});

test("rulings — Under Loop recycles on hit, via the normal on-hit path", () => {
  const r = cc("When this hits, put it on the bottom of its owner's deck");
  assert.equal(r.onHit, true);
  assert.deepEqual(r.ops, [["bottomSelf",1]]);
});

/* ---- v2.12: the deep-dive pass ----------------------------------------
   Most of what was left unread turned out to be mechanics the engine ALREADY
   had, hidden by two structural faults in the clause reader:
     1. the if/when handler ran before whole-clause rules, so it split
        "If you control a Hyper Driver, this costs {r} less" and gave up;
     2. it rejected any clause whose inner half was a noop, which killed
        "When this attacks, intimidate." even though intimidate is live.
   Both are guarded below — they are easy to reintroduce. */

test("deep dive — cost reductions are read, not split", () => {
  assert.equal(cc("If you control a Hyper Driver, this costs {r} less to play.").status, "noop");
  assert.equal(cc("This costs {r} less to play for each Runechant you control.").status, "noop");
});

test("deep dive — a noop inner clause passes through instead of voiding the clause", () => {
  assert.equal(cc("When this attacks, intimidate.").status, "noop");
  assert.equal(cc("The winner creates a Might token.").status, "noop");
  assert.equal(cc("Watery Grave").status, "noop");
});

test("deep dive — clash resolves on DEFENCE, as every clash card is printed", () => {
  assert.equal(cc("When this defends, clash with the attacking hero").status, "noop");
  assert.equal(cc("When you win a clash revealing this, deal 1 damage to the other hero.").status, "noop");
});

test("deep dive — 'has +N' is a printed form alongside 'gains/gets +N'", () => {
  assert.deepEqual(cc("If this has an aim counter, it has +1{p}.").ops, [["self",1]]);
  assert.equal(cc("If this has an aim counter, it has +1{p}.").cond, "aim");
  assert.deepEqual(cc("If you control a Seismic Surge token, this gets +1{d}.").ops, [["defBuff",1]]);
});

test("deep dive — conditions the engine could already answer", () => {
  const t = {
    "If you control 3 or more auras, this gets +3{p} and \"x\".": "auras3",
    "If you have a card in your arsenal, this gets +1{p}.": "hasArsenal",
    "If there is a card with cost 3 or greater in your pitch zone, this has +1{p}.": "pitchCost3",
    "If an ally has been put into your graveyard this turn, this gets +1{d}.": "allyDied",
    "If you have attacked with a weapon this turn, your next attack this turn gains +1{p}.": "weaponSwung",
    "If this is defended by fewer than 2 cards, it has +3{p}.": "defLt2any",
    "If this has {p} greater than its base, it gets +1{p}.": "pumped"
  };
  for(const [txt, want] of Object.entries(t))
    assert.equal(cc(txt).cond, want, txt);
});

test("deep dive — plain damage, Draconic grants and unpreventable damage", () => {
  assert.deepEqual(cc("Deal 2 damage to any target").ops, [["dmg",2]]);
  assert.deepEqual(cc("Your next attack this combat chain is Draconic in addition to its other card types.").ops,
    [["dracNext",1]]);
  assert.deepEqual(cc("Damage that would be dealt by this can't be prevented.").ops, [["unpreventable",1]]);
  const d = cc("When this attacks, if it is Draconic, deal 2 damage to any target.");
  assert.equal(d.cond, "isDraconic");
  assert.deepEqual(d.ops, [["dmg",2]]);
});

test("deep dive — 'While …' is a real condition, not free text", () => {
  /* Wax On reads "While Wax On is defending an attack action card with cost 0,
     it gains +2{d}". Before "while" joined if/when in the conditional handler,
     the whole line fell through to the generic pump rule and granted the +2
     UNCONDITIONALLY. It is now an honest gap: the dummy's swing is a scripted
     number, not a card, so it has no cost to compare against. */
  assert.equal(cc("While this is defending an attack action card with cost 0, it gains +2{d}."), null);
  /* but a while-condition the engine CAN answer resolves normally */
  const r = cc("While there is a card in your pitch zone with {p} greater than this's base {p}, this has go again.");
  assert.equal(r.cond, "pitchOverBase");
  assert.deepEqual(r.ops, [["ga"]]);
});

/* ---- v2.13: the Ninja / Crouching Tiger batch --------------------------- */

test("rulings — a card can be minted straight into the banished zone", () => {
  /* written off the NAME in the text, so it is not Crouching-Tiger-specific */
  assert.deepEqual(cc("Create a Crouching Tiger in your banished zone").ops,
    [["mkBanish","crouching tiger"]]);
  assert.equal(cc("You may play it this turn.").status, "noop");
  assert.deepEqual(cc("The next Crouching Tiger you play this turn gains +2{p}.").ops,
    [["namedBuff","crouching tiger",2]]);
});

test("rulings — activation gates are hoisted and refuse with a reason", () => {
  P.fxReset();
  const blood = P.fxParse({name:"Drill Blood Scent", pitch:0, tt:"Ninja Equipment - Chest",
    kw:["Battleworn"], tx:"Instant - Destroy this: Gain {r}. Activate this only if you've attacked with a Crouching Tiger this turn.\nBattleworn"});
  assert.equal(blood.activateIf.kind, "atkNamed");
  assert.equal(blood.activateIf.name, "crouching tiger");
  assert.equal(blood.tier, "full");
  const cross = P.fxParse({name:"Drill Double Cross", pitch:0, tt:"Ninja Equipment - Chest",
    kw:["Arcane Barrier 1"], tx:"Instant - Destroy this: Gain {r}. Activate this only if you've hit 2 or more times this combat chain.\nArcane Barrier 1"});
  assert.deepEqual(cross.activateIf.kind, "hits");
  assert.equal(cross.activateIf.n, 2);
});

test("rulings — Crouching Tiger is a real database card, 0 power with go again", () => {
  /* its whole value is being a free attack trigger; the printed reminder text
     on the card is also where Ephemeral is defined */
  P.fxReset();
  const fx = P.fxParse({name:"Crouching Tiger", pitch:0, tt:"Ninja Action - Attack",
    power:0, cost:0, kw:["Ephemeral","Go again"], tx:"Ephemeral\nGo again"});
  assert.equal(fx.ga, true, "go again comes off the printed keyword");
  assert.equal(fx.tier, "full");
});

/* ===================================================================
   OPTIONAL COST + "If you do, …"  (v2.28)

   24 pool cards are shaped "you may <banish/discard> X. If you do, Y"
   and not one was fully read: the rider was deliberately skipped because
   paying nothing and getting the payload is the v2.04 free-ability bug.
   The `pick` prompt now carries a rider that fires only when cards moved,
   so the text can be read instead of skipped.

   NOTE every card below has a UNIQUE name — fxParse memoizes on
   name|pitch and identical names silently collide in the cache.
   =================================================================== */
const oc = (name, tx, tt) => P.fxParse({name, tt: tt || "Attack Action", tx, kw: []}).optCost;

test("optCost — banish an aura from the graveyard, deal arcane", () => {
  const o = oc("OC Fellingsong",
    "When this attacks, you may banish an aura from your graveyard. If you do, deal 1 arcane damage to target hero.");
  assert.ok(o, "the pair must be read");
  assert.equal(o.trigger, "attacks");
  assert.equal(o.kind, "banish");
  assert.equal(o.zone, "grave");
  assert.deepEqual(o.filter, {tt:"aura"});
  assert.deepEqual(o.ops, [["arcane", 1]]);
});

test("optCost — the printed zone wins even mid-phrase", () => {
  /* "an attack action card FROM YOUR HAND with cost 2 or less" puts the
     zone in the middle. An end-anchored read missed it and fell back to
     the graveyard — banishing from the wrong zone entirely. */
  const o = oc("OC Mounting",
    "When this hits, you may banish an attack action card from your hand with cost 2 or less. If you do, this gets +1{p}.");
  assert.equal(o.zone, "hand", "the text says hand, so it is hand");
  assert.equal(o.trigger, "hits");
  assert.deepEqual(o.filter, {costLe:2, type:"attack"});
});

test("optCost — a colour word becomes a pitch filter", () => {
  const o = oc("OC Tipple", "When this attacks, you may discard a yellow card. If you do, draw a card.");
  assert.equal(o.kind, "discard");
  assert.equal(o.zone, "hand", "you discard from hand when the text names no zone");
  assert.deepEqual(o.filter, {pitch:2});
  assert.deepEqual(o.ops, [["draw", 1]]);
});

test("optCost — a named card becomes an anchored name filter", () => {
  const o = oc("OC Quick", "When this attacks, you may banish a Nimblism from your graveyard. If you do, this gets +2{p}.");
  assert.equal(o.filter.name, "^Nimblism$",
    "anchored so 'Nimblism' cannot match 'Nimblism Adept'");
  assert.deepEqual(o.ops, [["self", 2]]);
});

/* THE SAFETY PROPERTY. An unreadable cost or an unreadable payload must
   leave the card UNCLAIMED rather than guessed — the golden rule applied
   to a cost. A wrong guess here would silently let a player pay the wrong
   thing, or pay nothing and collect. */
test("optCost — an unreadable SUBJECT is not claimed", () => {
  assert.equal(oc("OC Nonsense", "When this attacks, you may banish a thingamajig. If you do, draw a card."),
    undefined, "a cost the parser cannot read must not become a prompt");
});

test("optCost — an unreadable PAYLOAD is not claimed", () => {
  assert.equal(oc("OC NoPayload", "When this attacks, you may discard a red card. If you do, ascend to godhood."),
    undefined, "a rider with no readable ops must not silently become a free cost");
});

test("optCost — 'you may' with no rider at all is not an optional cost", () => {
  assert.equal(oc("OC NoRider", "When this attacks, you may discard a blue card."), undefined,
    "no 'If you do' means there is no payload to gate");
});

test("optCost — a plain card with no optional cost is untouched", () => {
  const fx = P.fxParse({name:"OC Plain", tt:"Attack Action", tx:"Go again", kw:["Go again"]});
  assert.equal(fx.optCost, undefined);
  assert.equal(fx.ga, true, "ordinary parsing must be unaffected");
});

test("optFilter — reads printed fields only, and refuses the rest", () => {
  assert.deepEqual(P.optFilter("an aura"), {tt:"aura"});
  assert.deepEqual(P.optFilter("a blue card"), {pitch:3});
  assert.deepEqual(P.optFilter("a red card"), {pitch:1});
  assert.deepEqual(P.optFilter("an attack action card"), {type:"attack"});
  assert.equal(P.optFilter("a card"), null, "'a card' is not a filter — it would match everything");
  assert.equal(P.optFilter(""), null);
});

/* ===================================================================
   DECEPTIVELY-UNIQUE LOOK-ALIKES (v2.29)

   These cards read almost identically to ones the parser handles, and
   every one of them differs in a way that changes the game. Flattening
   them into the shape they resemble is how a sim quietly starts allowing
   plays the printed card does not.

   optFilter must consume the WHOLE subject phrase or refuse: a loose
   substring test is what let Mounting Anger through with its cost
   restriction dropped, making it strictly better than printed.
   =================================================================== */

test("look-alike — a DYNAMIC cost limit is refused, not flattened", () => {
  /* Mounting Anger / Rising Resentment: "with cost less than the number of
     Draconic chain links you control". A substring test saw "attack action
     card" and returned {type:"attack"}, silently dropping the limit — so
     any attack card in hand became a legal banish. */
  assert.equal(
    P.optFilter("an attack action card from your hand with cost less than the number of Draconic chain links you control"),
    null, "an inexpressible limit must leave the card unclaimed");
  assert.equal(
    P.optFilter("an attack action card with cost less than the number of Draconic chain links you control"),
    null);
  /* the readable sibling still works, so the refusal is specific */
  assert.deepEqual(P.optFilter("an attack action card with cost 2 or less"),
    {costLe:2, type:"attack"});
});

test("look-alike — 'ANOTHER aura' is an exclusion and is refused", () => {
  /* Sigil of Silphidae says "banish ANOTHER aura", which excludes itself.
     A prompts filter reads printed fields and cannot say "not this one",
     so offering it as "an aura" would offer an illegal choice. */
  assert.equal(P.optFilter("another aura"), null);
  assert.deepEqual(P.optFilter("an aura"), {tt:"aura"}, "the plain form is still read");
});

test("look-alike — a RULES-TEXT qualifier is refused", () => {
  /* Crash and Bash: "a card with crush from your hand". `crush` is a
     keyword in the card's text, not a printed field, and promptFilter
     reads fields only. */
  assert.equal(P.optFilter("a card with crush"), null);
});

test("look-alike — Mounting Anger and Rising Resentment are BOTH unclaimed", () => {
  const MA = P.fxParse({name:"Mounting Anger", pitch:1, tt:"Draconic Ninja Action - Attack",
    tx:"When Mounting Anger hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control. If you do, it gains +1{p} and you may play it this turn.\nGo again", kw:["Go again"]});
  const RR = P.fxParse({name:"Rising Resentment", pitch:1, tt:"Draconic Ninja Action - Attack",
    tx:"When Rising Resentment hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control. If you do, it costs {r} less to play and you may play it this turn.\nGo again", kw:["Go again"]});
  assert.equal(MA.optCost, undefined,
    "Mounting Anger's limit is dynamic — claiming it allowed an illegal banish");
  assert.equal(RR.optCost, undefined, "and its look-alike must be refused for the same reason");
});

test("look-alike — the payload's SUBJECT differs between siblings", () => {
  /* Even had the filter been readable, these two riders are NOT the same
     effect and must never share one reading:
       Mounting Anger    — "IT gains +1{p}"        (the banished card)
       Rising Resentment — "IT costs {r} less"     (a cost reduction)
     and in both, "it" is the BANISHED card, not the attacker — so the
     existing `self` op (which buffs the card being played) is the wrong
     op for either. Pinned so a future wiring pass cannot assume it. */
  const ma = P.classifyClause("it gains +1{p} and you may play it this turn");
  const rr = P.classifyClause("it costs {r} less to play and you may play it this turn");
  assert.notDeepEqual(ma && ma.ops, rr && rr.ops,
    "two different riders must not resolve to the same ops");
});

/* ===================================================================
   TYPE-QUALIFIED NEXT-ATTACK BUFFS (v2.30)

   "Your next ARROW attack this turn gets +3{p}" is not "your next attack
   gets +3". The old pattern swallowed the qualifier and 24 pool cards
   granted their pump to any attack at all — an arrow buff landing on a
   sword, a Runeblade buff on a Generic. Same class as the Mounting Anger
   filter bug: a printed restriction silently dropped, making the card
   strictly better than printed.

   The qualifier is read off the printed TYPE LINE only, never rules text.
   =================================================================== */
test("qualified buff — the qualifier is carried, not swallowed", () => {
  const q = t => P.classifyClause(t).ops[0];
  assert.deepEqual(q("your next arrow attack this turn gets +3{p}"),  ["buffNext",3,[["arrow"]]]);
  assert.deepEqual(q("your next runeblade attack this turn gets +3{p}"), ["buffNext",3,[["runeblade"]]]);
  assert.deepEqual(q("your next attack this turn gets +3{p}"), ["buffNext",3],
    "an unqualified buff must stay unqualified — it really does hit anything");
});

test("qualified buff — 'X or Y' is OR, 'X Y' is AND", () => {
  /* These two shapes look alike and mean different things. "Brute or
     Warrior" matches either type; "Pirate ally" needs BOTH words on the
     type line, because it means an ally that is also a Pirate. */
  assert.deepEqual(P.attackQual(" Brute or Warrior "), [["brute"],["warrior"]]);
  assert.deepEqual(P.attackQual(" Pirate ally "), [["pirate","ally"]]);
  assert.equal(P.attackQual(""), null, "no qualifier at all is null, not an empty matcher");
});

test("qualified buff — matching reads the printed type line", () => {
  const arrow = P.attackQual("arrow");
  assert.equal(P.qualMatches(arrow, {tt:"Ranger Action - Arrow Attack"}), true);
  assert.equal(P.qualMatches(arrow, {tt:"Warrior Action - Attack"}), false,
    "an arrow buff must NOT land on a non-arrow — this is the whole bug");

  const bw = P.attackQual("Brute or Warrior");
  assert.equal(P.qualMatches(bw, {tt:"Warrior Action - Attack"}), true);
  assert.equal(P.qualMatches(bw, {tt:"Brute Action - Attack"}), true);
  assert.equal(P.qualMatches(bw, {tt:"Ranger Action - Attack"}), false);

  const pa = P.attackQual("Pirate ally");
  assert.equal(P.qualMatches(pa, {tt:"Pirate Ally"}), true);
  assert.equal(P.qualMatches(pa, {tt:"Pirate Action - Attack"}), false,
    "AND means both words, so a Pirate ATTACK is not a Pirate ALLY");

  assert.equal(P.qualMatches(null, {tt:"anything at all"}), true,
    "no qualifier means it applies to everything");
});

test("qualified buff — the real cards keep their restriction", () => {
  const big = P.fxParse({name:"CIBG probe", pitch:1, tt:"Ranger Action",
    tx:"Your next arrow attack this turn gets +3{p}.\nYou may put an arrow from your hand face-up into your arsenal.\nGo again", kw:["Go again"]});
  const op = big.ops.find(o=>o[0]==="buffNext");
  assert.ok(op && op[2], "Call in the Big Guns must carry its 'arrow' restriction");
  assert.equal(P.qualMatches(op[2], {tt:"Ranger Action - Arrow Attack"}), true);
  assert.equal(P.qualMatches(op[2], {tt:"Ranger Action - Attack"}), false,
    "a plain Ranger attack is not an arrow and must not collect +3");
});

/* THE DOUBLE-COUNT (v2.30) — a card granting twice its printed buff.

   fxParse has a fallback that scans the WHOLE text of a non-attack for
   "gains/gets +N{p}" and queues it as a self-pump. "Your next arrow attack
   this turn GAINS +3{p}" matched there as well as in the buffNext rule, and
   execute added both — 34 pool cards granted double, up to Act of Glory at
   +12 from a printed +6.

   The coverage audit could not see this: every one of those cards reported
   tier `full`. They were read, and read WRONG. Same blind spot as the
   `noop` keywords in CLAUDE.md. */
test("double-count — a buffNext op suppresses the fallback self-pump", () => {
  const fx = P.fxParse({name:"DC next-attack", pitch:1, tt:"Ranger Action",
    tx:'Your next arrow attack this turn gains +3{p} and "When this hits a hero, create a Frailty token under their control."'});
  assert.equal(fx.self, 0,
    "the fallback must not re-read a +N{p} the buffNext rule already took");
  const buffs = fx.ops.filter(o=>o[0]==="buffNext");
  assert.equal(buffs.length, 1, "and the buff is counted exactly once");
  assert.equal(buffs[0][1], 3);
  assert.deepEqual(buffs[0][2], [["arrow"]], "with its qualifier");
  /* op[3] is the GRANTED ABILITY (v2.69). This fixture happens to print one,
     and it used to be thrown away with the rest of the tail — the same shape
     that cost Warrior's Valor half its text on six physical cards. */
  assert.ok(buffs[0][3] && buffs[0][3].onHit.length,
    "and the quoted granted ability rides along with it rather than being dropped");
});

test("double-count — the fallback still catches a genuine self-pump", () => {
  /* The safety net must survive: a non-attack whose pump never became an
     op still queues it. Removing the fallback entirely would break these. */
  const fx = P.fxParse({name:"DC plain pump", pitch:1, tt:"Generic Action", tx:"This gains +2{p}."});
  assert.equal(fx.self, 2, "a real self-pump with no buffNext op still reads");
  assert.deepEqual(fx.ops.filter(o=>o[0]==="buffNext"), []);
});

test("double-count — an unqualified next-attack buff is also counted once", () => {
  const fx = P.fxParse({name:"DC act of glory", pitch:1, tt:"Generic Action",
    tx:"Your next attack this turn gains +6{p}."});
  assert.equal(fx.self, 0, "printed +6 must not become +12");
  assert.deepEqual(fx.ops.filter(o=>o[0]==="buffNext"), [["buffNext",6]]);
});

/* ===================================================================
   PRINTED go again vs MENTIONED go again (v2.31)

   The database's `card_keywords` is a keyword INDEX — it lists every
   keyword appearing anywhere on the card, including ones the text only
   grants conditionally. Seeding fx.ga from it gave 27 pool cards
   unconditional go again against their own printed text.

   This is the Kayo bug's family. kw and gkw are already kept apart; the
   remaining trap was INSIDE card_keywords. Go again keeps your action
   point, so it is the most valuable keyword in the game to get wrong.
   =================================================================== */
const gaOf = (name, tx, kw) => P.fxParse({name, pitch:1, tt:"Generic Action - Attack",
  tx, kw: kw||[], power:4});

test("go again — a CONDITIONAL grant is not unconditional", () => {
  /* Buckwild: "IF there is a card with 6 or more {p} in your pitch zone,
     this gets go again." It went again on an empty pitch zone. */
  const fx = gaOf("GA buckwild",
    "If there is a card with 6 or more {p} in your pitch zone, this gets go again.", ["Go again"]);
  assert.equal(fx.ga, false, "the keyword index must not grant it outright");
  assert.deepEqual(fx.conds.map(c=>c.cond+":"+c.op[0]), ["pitch6:ga"],
    "and the conditional path must still carry it, so a MET condition still grants it");
});

test("go again — a PRINTED keyword line still grants it", () => {
  /* A real printed keyword sits on its own line; that must keep working
     or the fix trades one bug for a worse one. */
  const fx = gaOf("GA printed", "When this attacks, draw a card.\nGo again", ["Go again"]);
  assert.equal(fx.ga, true);
});

test("go again — trust the keyword list when the text never mentions it", () => {
  /* Some records carry the keyword without repeating it in functional
     text. Absent any mention, the list is the only evidence there is. */
  const fx = gaOf("GA silent", "Deal 2 damage to target hero.", ["Go again"]);
  assert.equal(fx.ga, true);
});

test("go again — the real cards land on the right side of the line", () => {
  const cond = gaOf("GA swarm",
    "If you've played or created an aura this turn, this gets go again.", ["Go again"]);
  assert.equal(cond.ga, false, "Runerager Swarm logged 'condition not met' and went again anyway");

  const printed = gaOf("GA tipple",
    "When this attacks, you may discard a yellow card. If you do, draw a card.\nGo again", ["Go again"]);
  assert.equal(printed.ga, true, "Golden Tipple really does print go again");
});

/* ===================================================================
   ARSENAL FACE-UP (v2.33) — Azalea's engine.

   The trainer's end-of-turn arsenal sets cards FACE DOWN. These arrows
   trigger on FACE UP, which is a different event reached only by an
   enabler that says so. Conflating the two would fire triggers the cards
   do not have.
   =================================================================== */
const ars = (name, tx, tt) => P.fxParse({name, pitch:1, power:3,
  tt: tt || "Ranger Action - Arrow Attack", tx, kw:[]});

test("arsenal — the three printed phrasings are one trigger", () => {
  assert.deepEqual(ars("ARS a", "When this is put face-up into your arsenal, it gets +2{p} this turn.").arsenalUp,
    [["self",2]]);
  assert.deepEqual(ars("ARS b", "If ARS b is put into your arsenal face up, opt 1.").arsenalUp,
    [["opt",1]], "Ridge Rider Shot puts 'face up' at the END");
  assert.deepEqual(ars("ARS c", "When ARS c is put or turned face up in arsenal, it gets +1{p} this turn.").arsenalUp,
    [["self",1]], "Spire Sniping says 'put OR TURNED'");
});

test("arsenal — the payload is NOT the card's own on-play effect", () => {
  /* Routed before the ga/self folds. Otherwise Swift Shot's "it gets go
     again this turn" would become printed go again on the card itself. */
  const fx = ars("ARS swift", "When this is put face-up into your arsenal, it gets go again this turn.");
  assert.deepEqual(fx.arsenalUp, [["ga"]]);
  assert.equal(fx.ga, false, "the arrow does not have printed go again");
  assert.equal(fx.self, 0);
  const dp = ars("ARS dry", "When this is put face-up into your arsenal, it gets +2{p} this turn.");
  assert.equal(dp.self, 0, "the +2 waits for the arsenal, it is not an on-play pump");
});

test("arsenal — the enabler reads its SUBJECT, so it cannot put a non-arrow", () => {
  const fx = P.fxParse({name:"ARS enabler", pitch:1, tt:"Ranger Action",
    tx:"Your next arrow attack this turn gets +3{p}.\nYou may put an arrow from your hand face-up into your arsenal.\nGo again", kw:["Go again"]});
  assert.deepEqual(fx.arsenalPut, {filter:{tt:"arrow"}});
  /* and its FIRST effect is unaffected — the user's ruling is that it
     resolves whether or not the put happens */
  assert.ok(fx.ops.some(o=>o[0]==="buffNext" && o[1]===3 && o[2]),
    "the +3 arrow buff still resolves, and keeps its qualifier");
});

/* ===================================================================
   THE TWO REMAINING ENABLERS (v2.34) — Bull's Eye Bracers and Death
   Dealer. Both are ACTIVATED abilities with a cost, and both gate on
   "if you have no cards in your arsenal", which is a different question
   from Call in the Big Guns' "a free slot".
   =================================================================== */
const pow = (name, tx) => P.fxParse({name, pitch:0, tt:"Equipment Ability", tx, kw:[]});

test("arsenal — 'no cards in your arsenal' is ZERO, not a free slot", () => {
  const b = pow("BEB pow", "If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. It gains +1{p} until end of turn. Go again");
  assert.equal(b.arsenalPut.needEmpty, true);
  /* Call in the Big Guns prints no such condition, so it needs only a slot */
  const g = P.fxParse({name:"BG pow", pitch:1, tt:"Ranger Action",
    tx:"Your next arrow attack this turn gets +3{p}.\nYou may put an arrow from your hand face-up into your arsenal.\nGo again", kw:[]});
  assert.ok(!g.arsenalPut.needEmpty, "an unconditional put must not demand an EMPTY arsenal");
});

test("arsenal capacity — free slot and empty are separate questions", () => {
  /* They coincide at the normal capacity of 1, which is exactly why
     hardcoding 1 would have hidden Death Dealer's stricter gate. */
  assert.equal(P.arsFree({arsenal:null}), 1);
  assert.equal(P.arsEmpty({arsenal:null}), true);
  assert.equal(P.arsFree({arsenal:{name:"x"}}), 0);
  assert.equal(P.arsEmpty({arsenal:{name:"x"}}), false);
  /* with a second slot they come apart: one card means a free slot but NOT empty */
  assert.equal(P.arsFree({arsenal:{name:"x"}, arsCap:2}), 1);
  assert.equal(P.arsEmpty({arsenal:{name:"x"}, arsCap:2}), false,
    "'no cards in your arsenal' must still refuse with one card and a spare slot");
});

test("arsenal — the Bracers' +1 lands on the ARROW, never on the equipment", () => {
  /* REGRESSION. "It gains +1{p} until end of turn" — "it" is the card that
     was just put. The whole-text self-pump fallback read it as the source's
     own pump, so the BRACERS gained the power the arrow is printed to get.
     Coverage cannot see this: the clause is consumed either way. */
  const b = pow("BEB subj", "If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. It gains +1{p} until end of turn. Go again");
  assert.equal(b.self, 0, "the equipment must not pump itself");
  assert.deepEqual(b.arsenalPut.stamp, [["self",1]], "the +1 is stamped onto the put arrow");
});

test("arsenal — Death Dealer's 'if you do' rider hangs off the put", () => {
  const d = pow("DD pow", "If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. If you do, draw a card. Go again");
  assert.deepEqual(d.arsenalPut.ops, [["draw",1]]);
  assert.ok(!d.arsenalPut.stamp, "Death Dealer prints no power rider");
  /* the draw must NOT be an unconditional on-play op — declining the put
     would then draw for free, which is the v2.04 bug */
  assert.ok(!d.ops.some(o=>o[0]==="draw"),
    "the draw is the prompt's rider, not an on-play effect");
});

test("arsenal — both activated abilities are read by the equipment reader", () => {
  /* Before v2.34 parseHeroPower rejected any conditional effect, so both of
     these returned null and the abilities were silently INERT. */
  const beb = P.parseHeroPower("Action - Destroy Bull's Eye Bracers: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. It gains +1{p} until end of turn. Go again", true);
  assert.ok(beb, "Bull's Eye Bracers has an ability");
  assert.equal(beb.sd, true, "its cost is destroying itself");
  assert.equal(beb.cost, 0);
  const dd = P.parseHeroPower("Once per Turn Action - {r}: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. If you do, draw a card. Go again", true);
  assert.ok(dd, "Death Dealer has an ability even though it is a weapon");
  assert.equal(dd.cost, 1, "it costs one resource");
  assert.equal(dd.sd, false);
});

test("arsenal — the reader is NOT loosened for other conditional abilities", () => {
  /* The relaxation is keyed to the arsenal-put shape only. A conditional
     ability nothing wires must still be refused, or its tier would rise
     while the trainer does nothing with it. */
  assert.equal(P.parseHeroPower("Action - {r}: If you control a Runechant, deal 3 damage to target hero", true), null);
});

test("arsenal — an unreadable payload leaves the card unclaimed", () => {
  /* Entangling Shot taps a hero (not modelled) and Spire Sniping's "put
     them back in any order" is a REORDER, which opt is not — opt lets you
     bottom cards, which would be strictly more powerful. */
  assert.equal(ars("ARS tap", "When this is put face-up into your arsenal, you may {t} target hero.").arsenalUp,
    undefined);
  assert.equal(ars("ARS reorder",
    "When ARS reorder is put or turned face up in arsenal, look at the top 2 cards of your deck, then put them back in any order.").arsenalUp,
    undefined);
});

/* ---- CARD OVERRIDES — the guarded escape hatch (v2.39) ---------------- */
test("override — an entry matching the live text is applied and marks its clause run", () => {
  const text = "This is a made-up drill ability that no generic rule reads.";
  P.CARD_OVERRIDES["override drill match|1"] = {
    text,
    read(card, fx){ return {self:5, clausesRun:[text]}; }
  };
  try {
    P.fxReset();
    const fx = P.fxParse({name:"Override Drill Match", pitch:1, tt:"Action", power:null, kw:[], tx:text});
    assert.equal(fx.self, 5);
    assert.equal(fx.overrideApplied, "override drill match|1");
    assert.equal(fx.tier, "full", "the marked clause must count toward coverage");
  } finally {
    delete P.CARD_OVERRIDES["override drill match|1"];
  }
});

test("override — REFUSES ITSELF the instant the live text drifts from the pinned text", () => {
  P.CARD_OVERRIDES["override drill drift|1"] = {
    text: "The pinned text this override was written against.",
    read(card, fx){ return {self:99}; }
  };
  try {
    P.fxReset();
    const fx = P.fxParse({name:"Override Drill Drift", pitch:1, tt:"Action", power:null, kw:[],
      tx:"The database now prints something different."});
    assert.equal(fx.self, 0, "a drifted override must never run its hardcoded logic");
    assert.equal(fx.overrideRefused, "override drill drift|1");
    assert.equal(fx.overrideApplied, undefined);
  } finally {
    delete P.CARD_OVERRIDES["override drill drift|1"];
  }
});

test("override — a read() that declines (returns null) leaves the generic fx untouched", () => {
  P.CARD_OVERRIDES["override drill decline|1"] = {
    text: "Go again",
    read(card, fx){ return null; }
  };
  try {
    P.fxReset();
    const fx = P.fxParse({name:"Override Drill Decline", pitch:1, tt:"Action", power:null, kw:[], tx:"Go again"});
    assert.equal(fx.ga, true, "the generic reader already read plain go again on its own");
    assert.equal(fx.overrideApplied, undefined);
  } finally {
    delete P.CARD_OVERRIDES["override drill decline|1"];
  }
});

/* ---- CHARGE (Boltyn) — the stack mechanic, v2.39 ---------------------- */
test("charge — the additional cost is hoisted whether the card says 'this' or names itself", () => {
  const a = P.fxParse({name:"Charge Drill A", pitch:1, tt:"Action - Attack", power:4, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. If a yellow card is charged this way, this gets +1{p}"});
  assert.deepEqual(a.chargeCost, {multi:false});
  const b = P.fxParse({name:"Charge Drill B", pitch:1, tt:"Action - Attack", power:4, kw:[],
    tx:"As an additional cost to play Charge Drill B, you may charge your hero's soul. If you've charged this turn, Charge Drill B gains go again."});
  assert.deepEqual(b.chargeCost, {multi:false});
});

test("charge — 'if a yellow card is charged this way' reads as chargedPitch2 (Beaming Bravado)", () => {
  const fx = P.fxParse({name:"Beaming Bravado Drill", pitch:1, tt:"Action - Attack", power:4, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. If a yellow card is charged this way, this gets +1{p}"});
  assert.deepEqual(fx.conds, [{cond:"chargedPitch2", op:["self",1], instead:false}]);
});

test("charge — 'if you've charged this turn, gains go again' reads as a plain conditional GA (Take Flight)", () => {
  const fx = P.fxParse({name:"Take Flight Drill", pitch:1, tt:"Action - Attack", power:4, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. If you've charged this turn, this gains go again."});
  assert.deepEqual(fx.conds, [{cond:"charged", op:["ga"], instead:false}]);
  assert.equal(fx.condOnHit, undefined, "a plain (non on-hit) grant belongs in conds, not condOnHit");
});

test("charge — a CONDITIONALLY GRANTED on-hit ability lands in condOnHit, never in the unconditional onHit list (Bolt of Courage)", () => {
  /* This is the regression the dispatcher fix exists for: checking r.onHit
     before r.cond used to push the op into fx.onHit unconditionally, which
     would have granted "draw a card" on every hit regardless of whether the
     player charged — the exact VALUE-DOUBLED/KEYWORD-UNGATED shape
     `npm run fairness` exists to catch. */
  const fx = P.fxParse({name:"Bolt of Courage Drill", pitch:1, tt:"Action - Attack", power:3, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. If you've charged this turn, this gains \"If this hits, draw a card.\""});
  assert.deepEqual(fx.onHit, [], "must NOT be unconditional");
  assert.deepEqual(fx.condOnHit, [{cond:"charged", op:["draw",1]}]);
});

test("charge — a conditionally granted on-hit ability with a colour gate (Light the Way)", () => {
  const fx = P.fxParse({name:"Light the Way Drill", pitch:1, tt:"Action - Attack", power:3, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. When this hits, if a yellow card was charged this way, this gets go again."});
  assert.deepEqual(fx.onHit, []);
  assert.deepEqual(fx.condOnHit, [{cond:"chargedPitch2", op:["ga"]}]);
});

test("charge — a conditionally granted on-hit ability reuses the existing soulSelf op (Engulfing Light)", () => {
  const fx = P.fxParse({name:"Engulfing Light Drill", pitch:1, tt:"Action - Attack", power:3, kw:[],
    tx:"As an additional cost to play this, you may charge your hero's soul. If you've charged this turn, this gains \"If this hits, put it into your hero's soul.\""});
  assert.deepEqual(fx.condOnHit, [{cond:"charged", op:["soulSelf"]}]);
});

test("charge — 'gains \"...\"' with an unparsed inner clause is refused, not guessed", () => {
  assert.equal(P.classifyClause('this gains "transmogrify the fortress"'), null);
});

test("charge — all five real pool cards resolve to tier full", () => {
  ["Beaming Bravado", "Bolt of Courage", "Engulfing Light", "Light the Way", "Take Flight"].forEach(base=>{
    const name = base+" Tier Drill";
    const tx = base === "Beaming Bravado"
      ? "As an additional cost to play this, you may charge your hero's soul. If a yellow card is charged this way, this gets +1{p}"
      : base === "Light the Way"
      ? "As an additional cost to play this, you may charge your hero's soul. When this hits, if a yellow card was charged this way, this gets go again."
      : base === "Bolt of Courage"
      ? `As an additional cost to play ${name}, you may charge your hero's soul. If you've charged this turn, ${name} gains "If this hits, draw a card."`
      : base === "Engulfing Light"
      ? `As an additional cost to play ${name}, you may charge your hero's soul. If you've charged this turn, ${name} gains "If this hits, put it into your hero's soul."`
      : `As an additional cost to play ${name}, you may charge your hero's soul. If you've charged this turn, ${name} gains go again.`;
    const fx = P.fxParse({name, pitch:1, tt:"Action - Attack", power:4, kw:[], tx});
    assert.equal(fx.tier, "full", base);
  });
});

/* ---- FUSION — CR: an additional cost that REVEALS, never spends, v2.39 */
test("fusion — the bare keyword line hoists fx.fusionCost and reads as a noop clause", () => {
  const fx = P.fxParse({name:"Fusion Drill Hoist", pitch:1, tt:"Action", power:null, kw:[],
    tx:"Ice Fusion\n\nDeal 2 arcane damage to any target."});
  assert.deepEqual(fx.fusionCost, {types:["ice"]});
  assert.equal(fx.clauses[0].st, "noop");
});

test("fusion — a compound type line splits on 'and', 'and/or', and comma", () => {
  const and_ = P.fxParse({name:"Fusion Drill And", pitch:1, tt:"Action", power:null, kw:[],
    tx:"Earth and Lightning Fusion\n\nDeal 2 arcane damage to any target."});
  assert.deepEqual(and_.fusionCost, {types:["earth","lightning"]});
  const andOr = P.fxParse({name:"Fusion Drill AndOr", pitch:1, tt:"Action", power:null, kw:[],
    tx:"Ice and/or Lightning Fusion\n\nDeal 2 arcane damage to any target."});
  assert.deepEqual(andOr.fusionCost, {types:["ice","lightning"]});
});

test("fusion — 'if this was fused, it gains go again' reads as a plain conditional GA (Entwine Lightning)", () => {
  const fx = P.fxParse({name:"Entwine Lightning", pitch:1, tt:"Elemental Action - Attack", power:3, kw:[],
    tx:"Lightning Fusion\n\nIf Entwine Lightning was fused, it gains go again."});
  assert.deepEqual(fx.fusionCost, {types:["lightning"]});
  assert.deepEqual(fx.conds, [{cond:"fused", op:["ga"], instead:false}]);
  assert.equal(fx.tier, "full");
});

test("fusion — 'when you attack with this, if it was fused, deal N arcane' reads as an immediate conditional, not on-hit (Arcanic Shockwave)", () => {
  const fx = P.fxParse({name:"Arcanic Shockwave", pitch:1, tt:"Elemental Runeblade Action - Attack", power:4, kw:[],
    tx:"Lightning Fusion\n\nWhen you attack with Arcanic Shockwave, if it was fused, deal 1 arcane damage to target hero."});
  assert.deepEqual(fx.conds, [{cond:"fused", op:["arcane",1], instead:false}]);
  assert.equal(fx.tier, "full");
});

test("fusion — the compound 'was fused and deals damage to a hero' gate is read as one unit", () => {
  const r = P.classifyClause("if this was fused and deals damage to a hero, this gets +1{p}");
  assert.equal(r.cond, "fused");
  assert.equal(r.onHit, true);
  assert.deepEqual(r.ops, [["self",1]]);
});

/* ---- SUSPENSE — a board qualifier tag, v2.39 -------------------------- */
test("suspense — the bare keyword is a qualifier-only noop, same shape as stealth/mark", () => {
  assert.equal(P.classifyClause("Suspense").status, "noop");
});

test("suspense — the payload waits on `onLeave` and is NOT queued on play (Act of Glory)", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Act of Glory", pitch:1, tt:"Guardian Instant - Aura", power:null, kw:["Suspense"],
    tx:"Suspense\n\nWhen this leaves the arena, your next attack this turn gets +6{p}."});
  assert.deepEqual(fx.onLeave, [["buffNext",6]], "held for the departure");
  assert.ok(!fx.ops.some(o=>o[0]==="buffNext"),
    "and NOT queued on play — that was the bug: +6{p} the moment the aura landed");
  assert.equal(fx.tier, "full");
  P.fxReset();
});

test("suspense — 'if you control an aura of suspense' reads as cond suspenseAura (Full of Bravado)", () => {
  const r = P.classifyClause("if you control an aura of suspense, create a Confidence token");
  assert.equal(r.cond, "suspenseAura");
  assert.deepEqual(r.ops, [["token","confidence",1,"self"]]);
});

/* ---- Saltwater Swell — reveal-then-conditional-pitch, v2.39 ----------- */
test("reveal+pitch — 'if it's blue, pitch it' is read as ONE atomic op, not a cond+op split", () => {
  /* Splitting it (cond revBlue + a separate pitch op) would check the
     condition in the EARLY conds loop, before the reveal that sets
     n.revealed has even run at declaration — see the comment above the
     pattern in parser.js. */
  const r = P.classifyClause("if it's blue, pitch it");
  assert.equal(r.status, "run");
  assert.deepEqual(r.ops, [["revColorPitch", 3]]);
  assert.equal(r.cond, undefined, "must not be split into a separate cond");
});

test("reveal+pitch — red and yellow read their own pitch values", () => {
  assert.deepEqual(P.classifyClause("if it's red, pitch it").ops, [["revColorPitch", 1]]);
  assert.deepEqual(P.classifyClause("if it's yellow, pitch it").ops, [["revColorPitch", 2]]);
});

test("reveal+pitch — Saltwater Swell resolves to tier full", () => {
  const fx = P.fxParse({name:"Saltwater Swell", pitch:1, tt:"Pirate Action - Attack", power:4, kw:[],
    tx:"When this attacks, reveal the top card of your deck. If it's blue, pitch it.\nGo again"});
  assert.deepEqual(fx.ops, [["reveal",1],["revColorPitch",3]]);
  assert.equal(fx.tier, "full");
});

/* ---- Mark of the Black Widow — a compound on-hit+marked gate, v2.39 --- */
test("marked — 'they banish a card from their hand' reads as a mandatory foeBanish op", () => {
  assert.deepEqual(P.classifyClause("they banish a card from their hand"), {status:"run", ops:[["foeBanish",1]]});
});

test("marked — 'this hits a marked hero' is read as a COMPOUND onHit+marked gate, not unconditional onHit", () => {
  /* The generic /hits?/ catch-all just below would otherwise match first
     and silently drop the marked half, making the banish fire on every
     hit — the same bug class as the fusion compound gate. */
  const r = P.classifyClause("if this hits a marked hero, they banish a card from their hand");
  assert.equal(r.cond, "marked");
  assert.equal(r.onHit, true);
  assert.deepEqual(r.ops, [["foeBanish",1]]);
});

test("marked — Mark of the Black Widow resolves to full, and its banish lands in condOnHit (never unconditional onHit)", () => {
  const fx = P.fxParse({name:"Mark of the Black Widow", pitch:1, tt:"Assassin Action - Attack", power:4, kw:["Stealth"],
    tx:"Stealth\nWhen this hits a marked hero, they banish a card from their hand."});
  assert.deepEqual(fx.onHit, []);
  assert.deepEqual(fx.condOnHit, [{cond:"marked", op:["foeBanish",1]}]);
  assert.equal(fx.tier, "full");
});

/* ---- Malefic Incantation — verse counters, credited not re-read, v2.39 */
test("verse counters — the unwind clauses are noop-credited (handled by execute()'s board scan, not this reader)", () => {
  assert.equal(P.classifyClause("Once per turn, when you play an attack action card, remove a verse counter from this").status, "noop");
  assert.equal(P.classifyClause("If you do, create a Runechant token").status, "noop");
});

test("verse counters — Malefic Incantation resolves to tier full", () => {
  const fx = P.fxParse({name:"Malefic Incantation", pitch:1, tt:"Runeblade Action - Aura", power:null, kw:[],
    tx:"Go again\nThis enters the arena with 3 verse counters. When it has none, destroy it.\nOnce per turn, when you play an attack action card, remove a verse counter from this. If you do, create a Runechant token."});
  assert.equal(fx.tier, "full");
});

/* ---- RELOAD — CR-verified: no type filter, empty-arsenal only, v2.39 -- */
test("reload — Take Aim resolves to tier full", () => {
  const fx = P.fxParse({name:"Take Aim", pitch:1, tt:"Ranger Action", power:null, kw:[],
    tx:"The next Ranger attack action card you play this turn, gains +3{p}.\nReload\nGo again"});
  assert.ok(fx.ops.some(o=>o[0]==="reload"));
  assert.equal(fx.tier, "full");
});

/* ---- pickPrompt — a generic mandatory targeted pick, v2.39 ------------ */
test("pickPrompt — Memorial Ground reads a mandatory graveyard->deck-top pick with the subject's filter", () => {
  const r = P.classifyClause("Put target attack action card with cost 1 or less from your graveyard on top of your deck");
  assert.equal(r.status, "run");
  assert.deepEqual(r.ops, [["pickPrompt", {zone:"grave", to:"deckTop",
    filter:{costLe:1, type:"attack"}, min:1, max:1,
    title:"Put a card from your graveyard on top of your deck"}]]);
});

test("pickPrompt — an unreadable subject leaves the card unclaimed, same discipline as optFilter elsewhere", () => {
  /* A dynamic limit optFilter already refuses for the exact same reason
     Mounting Anger does (see optFilter's own comment). */
  assert.equal(P.classifyClause(
    "Put target attack action card with cost less than the number of Draconic chain links you control from your graveyard on top of your deck"),
    null);
});

test("pickPrompt — Memorial Ground resolves to tier full", () => {
  const fx = P.fxParse({name:"Memorial Ground", pitch:2, tt:"Generic Instant", power:null, kw:[],
    tx:"Put target attack action card with cost 1 or less from your graveyard on top of your deck."});
  assert.equal(fx.tier, "full");
});

/* ---- payOrLose — Look Tuff's "unless you pay", v2.39 ------------------ */
test("payOrLose — reads the power penalty and the {r} cost as one op (Look Tuff)", () => {
  const r = P.classifyClause("it gets -1{p} unless you pay {r}");
  assert.deepEqual(r.ops, [["payOrLose", 1, 1]]);
});

test("payOrLose — a numeric cost is read too, not just {r} pips", () => {
  assert.deepEqual(P.classifyClause("it gets -2{p} unless you pay 3").ops, [["payOrLose", 2, 3]]);
});

test("payOrLose — must not be confused with the plain 'it gets -N{p}' defend-side shave", () => {
  /* atkMinus is a DIFFERENT op with different semantics (shaves an
     INCOMING attack while blocking) — the anchored $ on the plain pattern
     is what keeps "unless you pay" from falling into it by accident. */
  assert.deepEqual(P.classifyClause("it gets -1{p}").ops, [["atkMinus", 1]]);
});

test("payOrLose — Look Tuff resolves to tier full", () => {
  const fx = P.fxParse({name:"Look Tuff", pitch:1, tt:"Generic Action - Attack", power:5, kw:[],
    tx:"When this attacks, it gets -1{p} unless you pay {r}."});
  assert.deepEqual(fx.ops, [["payOrLose",1,1]]);
  assert.equal(fx.tier, "full");
});

/* ---- Cold Snap — freeze is UNREAD, and that is the honest answer -----

   These two drills asserted the opposite until v3.02: that both halves
   were `noop` and the card resolved `tier: full`. The reasons filed with
   those noops were "the dummy pays no costs" and "Freeze taxes a
   play/activation the dummy's scripted swing never makes" — facts about a
   training prop that stopped existing in v2.71, when seat 1 gained a real
   action phase and started paying costs.

   A `noop` COUNTS AS ACCOUNTED FOR, so the card reported fully scripted
   while doing nothing at all: the no-op blind spot, on Iyslander's
   signature card. v2.74 removed exactly this for Frostbite; Cold Snap was
   the last card carrying it.

   UNREAD RATHER THAN APPROXIMATED, and the direction matters. `payOr`
   exists and would ask the opponent to pay — but with the freeze unbuilt
   as its else-payload it would ask a question with NO CONSEQUENCE, which
   makes paying strictly a waste. Worse than not asking. So the card sits
   at `part` and the tools report the gap. */
test("cold snap — NEITHER HALF is readable alone; the pair is what carries it", () => {
  /* Read on its own, the offer asks the opponent to pay for nothing and
     the freeze has lost what it is conditional on. They are one reading,
     paired in `fxParse` where the whole card is visible — the same reason
     `optCost` and `payCost` are paired there. */
  assert.equal(cc("Target hero may pay {r}"), null);
  assert.equal(cc("If they don't, freeze a card in their arsenal or an ally they control until the start of your next turn."), null);
});

test("cold snap — the pair reads as payOr with the FREEZE as its else", () => {
  P.fxReset();
  const fx = P.fxParse({name:"Cold Snap", pitch:3, tt:"Ice Action", power:null, kw:[],
    tx:"Target hero may pay {r}. If they don't, freeze a card in their arsenal or an ally they control until the start of your next turn.\nIf Cold Snap is played from arsenal, draw a card.\nGo again"});
  assert.deepEqual(fx.ops, [["payOr", 1, [["freeze", 1]]]],
    "declining is what makes the consequence happen — that is payOr's whole rule");
  assert.equal(fx.tier, "full");
  assert.equal(fx.ga, true, "go again is printed and still granted");
  P.fxReset();
});

/* ---- fx.payCost — Brothers in Arms, a real mid-block pay window, v2.39 */
test("payCost — pairs 'you may pay X' with its 'if you do' rider, same as optCost", () => {
  const fx = P.fxParse({name:"Brothers in Arms", pitch:3, tt:"Generic Action - Attack", power:4, def:2, kw:[],
    tx:"When this defends, you may pay {r}. If you do, it gets +2{d}."});
  assert.deepEqual(fx.payCost, {trigger:"defends", cost:1, ops:[["defBuff",2]]});
  assert.equal(fx.tier, "full");
});

test("payCost — a numeric cost is read too, not just {r} pips", () => {
  const fx = P.fxParse({name:"payCost Drill Numeric", pitch:1, tt:"Action - Attack", power:4, def:1, kw:[],
    tx:"When this defends, you may pay 2. If you do, it gets +1{d}."});
  assert.deepEqual(fx.payCost, {trigger:"defends", cost:2, ops:[["defBuff",1]]});
});

test("payCost — an unreadable rider leaves the card unclaimed rather than guessed", () => {
  const fx = P.fxParse({name:"payCost Drill Unreadable", pitch:1, tt:"Action - Attack", power:4, def:1, kw:[],
    tx:"When this defends, you may pay {r}. If you do, transmogrify the fortress."});
  assert.equal(fx.payCost, undefined);
});

test("payCost — does not collide with optCost's banish/discard pairing on the same card shape", () => {
  const fx = P.fxParse({name:"payCost Drill NoClash", pitch:1, tt:"Action - Attack", power:4, kw:[],
    tx:"When this attacks, you may banish an aura from your graveyard. If you do, deal 1 arcane damage to target hero."});
  assert.equal(fx.payCost, undefined);
  assert.ok(fx.optCost);
});

/* ===================================================================
   THE ACTION POINT IS AN *ACTION'S* COST — CR 8.1.1 / 8.1.6.

   Reported from the table (2026-08-01): instants were eating the
   turn's action point. `execute` charged every non-attack that
   resolved through it, so Energy Potion's "Instant - Destroy this:
   Gain {r}{r}" cost you your action, and Achilles Accelerator's
   "Instant - Destroy this: Gain 1 action point" netted to zero — the
   equipment did nothing at all.

   Coverage cannot see this: every one of these cards reads as tier
   `full`. The text was read correctly and then charged wrongly.
   =================================================================== */

test("costsAP — an action card carries the action point cost (CR 8.1.1)", () => {
  assert.equal(P.costsAP({name:"apCost Drill Action", tt:"Generic Action", pitch:1}), true);
  assert.equal(P.costsAP({name:"apCost Drill Attack", tt:"Generic Action - Attack", pitch:1}), true);
  /* a weapon swing is an "Action - …: Attack" ability, so it pays too */
  assert.equal(P.costsAP({name:"apCost Drill Weapon", tt:"Warrior Weapon - Sword (1H)", pitch:0}), true);
});

test("costsAP — an instant does not (CR 8.1.6)", () => {
  /* real pool cards, verbatim type lines */
  assert.equal(P.costsAP({name:"Frost Spike", tt:"Ice Wizard Instant", pitch:1}), false);
  assert.equal(P.costsAP({name:"Concealed Object", tt:"Reviled Instant - Item", pitch:2}), false);
  assert.equal(P.costsAP({name:"Memorial Ground", tt:"Generic Instant", pitch:3}), false);
});

test("costsAP — an 'Instant - …' ACTIVATED ability is free too, and its powCard says so", () => {
  /* Achilles Accelerator. parseHeroPower stamps kind:"instant" on the
     ability; index.html turns that into the powCard's `_instant`. Charging
     an action point here is what made this equipment a no-op: it gains
     exactly the one point it was being charged. */
  const pw = P.parseHeroPower("Instant - Destroy Achilles Accelerator: Gain 1 action point.", true);
  assert.ok(pw, "the ability must parse at all");
  assert.equal(pw.kind, "instant");
  assert.deepEqual(P.classifyClause(pw.eff).ops, [["ap",1]]);
  assert.equal(P.costsAP({name:"Achilles Accelerator ability", tt:"Equipment Ability", _instant:true}), false);
  /* and the "Action - …" sibling still pays (Timesnap Potion: gain 2, spend
     1, net +1 — it must not silently become +2) */
  const act = P.parseHeroPower("Action - Destroy this: Gain 2 action points.", true);
  assert.equal(act.kind, "action");
  assert.equal(P.costsAP({name:"Timesnap ability", tt:"Equipment Ability", _instant:false}), true);
});

test("isInstantT reads the FRONT face of a double-faced type line", () => {
  /* Both pool DFCs print "Action // … Instant". You play the front face;
     the back is reachable only by melding. Reading the whole line made
     them instants, which would have let two real action cards skip their
     action point — strictly stronger than printed. */
  const seeds = {name:"Arcane Seeds // Life", tt:"Runeblade Action // Earth Instant", pitch:3};
  const burn  = {name:"Burn Up // Shock",     tt:"Runeblade Action // Lightning Instant", pitch:1};
  assert.equal(P.isInstantT(seeds), false);
  assert.equal(P.isInstantT(burn), false);
  assert.equal(P.costsAP(seeds), true, "Arcane Seeds is played as an ACTION and pays for it");
  assert.equal(P.costsAP(burn), true, "Burn Up is played as an ACTION and pays for it");
  /* the genuine instants are unaffected */
  assert.equal(P.isInstantT({name:"Frost Spike", tt:"Ice Wizard Instant"}), true);
  /* and a reaction is never an instant, front face or not */
  assert.equal(P.isInstantT({name:"Sink Below drill", tt:"Generic Defense Reaction"}), false);
  assert.equal(P.isAR({name:"AR drill", tt:"Generic Attack Reaction"}), true);
});

/* ===================================================================
   A REACTION BELONGS TO THE REACTION STEP — CR 8.1.2a / 8.1.3a.

   The reaction step is TWO windows, not one: the attacking player may
   play attack reactions, the defending player defense reactions, and
   neither may play the other's. Before v2.40 `tryPlay` accepted a
   reaction straight out of the ACTION phase (23 pool cards — Reduce to
   Runechant minting a runechant on your own turn), and the attack
   window also admitted any non-attack carrying a pump, which let three
   plain action cards in.

   `speedAllowed` splits the windows by attacker; `rxAllowed` answers
   the card half. These pin the card half.
   =================================================================== */

test("rxAllowed — the attacking player's window takes attack reactions, not defense ones", () => {
  const ar = {name:"Ironsong Response", pitch:1, tt:"Warrior Attack Reaction", kw:["Reprise"],
    tx:"Reprise - If the defending hero has defended with a card from their hand this chain link, target weapon attack gains +3{p}."};
  const dr = {name:"Reduce to Runechant", pitch:1, tt:"Runeblade Defense Reaction", kw:[],
    tx:"Reduce to Runechant costs {r} less to play for each Runechant you control.\nCreate a Runechant token."};
  assert.equal(P.rxAllowed(ar, "attack-reaction"), true);
  assert.equal(P.rxAllowed(dr, "attack-reaction"), false, "CR 8.1.3a — a defense reaction belongs to the defending player");
  assert.equal(P.rxAllowed(dr, "defense-reaction"), true);
  assert.equal(P.rxAllowed(ar, "defense-reaction"), false, "CR 8.1.2a — an attack reaction belongs to the attacking player");
});

test("rxAllowed — an instant is legal in either window (CR 8.1.6), an action in neither", () => {
  const inst = {name:"Frost Spike", pitch:3, tt:"Ice Wizard Instant", kw:[],
    tx:"Create a Frostbite token in an exposed head, chest, arms, or legs zone."};
  assert.equal(P.rxAllowed(inst, "attack-reaction"), true);
  assert.equal(P.rxAllowed(inst, "defense-reaction"), true);
  /* Flying High is a plain Generic Action that pumps. The old attack-window
     test was `!isAttack(c) && fx.self>0`, which admitted it — no action card
     is legal in the reaction step. Hit and Run and Cutty Shark were the
     other two. */
  const act = {name:"Flying High", pitch:1, tt:"Generic Action", kw:["Go again"],
    tx:"Your next attack this turn gets go again. If it's red, it gets +1{p}.\nGo again"};
  assert.equal(P.rxAllowed(act, "attack-reaction"), false, "a plain action card is not an attack reaction");
  assert.equal(P.rxAllowed(act, "defense-reaction"), false);
});

test("rxAllowed — an instant the parser reads nothing from is a dead tap, not an offer", () => {
  /* the one non-citation in the rule: an unscripted instant would arm the
     tap and then do nothing. Refusing it is a trainer decision, not a CR one. */
  const blank = {name:"rxAllowed Drill Blank Instant", pitch:2, tt:"Generic Instant", kw:[], tx:"Transmogrify the fortress."};
  assert.equal(P.fxParse(blank).ops.length, 0);
  assert.equal(P.rxAllowed(blank, "attack-reaction"), false);
});

test("isDR / isRx read the printed type, and fx.dr is the same answer", () => {
  const dr = {name:"isDR Drill Defense", pitch:3, tt:"Generic Defense Reaction", kw:[], tx:"Go again"};
  const ar = {name:"isDR Drill Attack", pitch:1, tt:"Warrior Attack Reaction", kw:[], tx:"Target attack gains +2{p}."};
  assert.equal(P.isDR(dr), true);   assert.equal(P.isAR(dr), false);
  assert.equal(P.isAR(ar), true);   assert.equal(P.isDR(ar), false);
  assert.equal(P.isRx(dr) && P.isRx(ar), true);
  assert.equal(P.isRx({name:"isDR Drill Plain", tt:"Generic Action"}), false);
  /* fx.dr must not be a second copy of the regex — it drifts from isDR the
     moment one of them learns something the other does not (the DFC front
     face was exactly that lesson). */
  assert.equal(P.fxParse(dr).dr, P.isDR(dr));
  assert.equal(P.fxParse(ar).dr, P.isDR(ar));
});
