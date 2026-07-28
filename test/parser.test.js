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
  assert.deepEqual(cc("Your next weapon attack this turn gains +1 {p}.").ops, [["buffNext",1]]);
  assert.deepEqual(cc("This attack gains +3 {p}.").ops, [["self",3]]);
  assert.deepEqual(cc("Amp 1").ops, [["amp",1]]);
  assert.deepEqual(cc("Create a Runechant token.").ops, [["rune",1]]);
  assert.deepEqual(cc("Create 2 Runechant tokens.").ops, [["rune",2]]);
  assert.equal(cc("Create a Frostbite token.").status, "noop");
});

test("classifyClause — gaNext, with and without the runechant rider", () => {
  assert.deepEqual(cc("The next attack action card you play this turn gains go again.").ops, [["gaNext"]]);
  const r = cc("The next attack action card you play this turn gains go again, and if it hits create a Runechant.");
  assert.deepEqual(r.ops, [["gaNext"],["runeHitNext"]]);
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
  assert.deepEqual(fx.conds, [{cond:"pitch6", op:["ga"]}]);
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
  assert.deepEqual(must.addCost, {discard:1});
  const may = P.fxParse({name:"feast-drill-may", pitch:1, tt:"Attack Action", power:6, kw:[],
    tx:"As an additional cost to play this, you may discard a card."});
  assert.equal(may.addCost, undefined);
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
    {cost:2, addRust:false, needSteam:false});
  assert.deepEqual(P.weaponCost("Action - {r}{r}: Attack"),
    {cost:2, addRust:false, needSteam:false});
  assert.deepEqual(P.weaponCost("Action - 0: Attack"),
    {cost:0, addRust:false, needSteam:false});
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
  for(const k of ["Charge","Reload","Combo"])
    assert.equal(cc(k), null, k+" must keep surfacing as a coverage gap");
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

test("rulings — the four dedicated counters keep precedence over generic tokens", () => {
  assert.deepEqual(cc("Create a Runechant token.").ops, [["rune",1]]);
  assert.equal(cc("Create a Frostbite token.").status, "noop", "dummy pays no costs");
  assert.deepEqual(cc("Create a Bloodrot Pox token under their control.").ops, [["rot",1]]);
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

test("classifyClause — crush riders are honest noops vs a hand-less dummy", () => {
  const r = cc("Crush - When this deals 4 or more damage to a hero, they put a card from their hand on top of their deck.");
  assert.equal(r.status, "noop");
});

test("classifyClause — target-attack pump folds into self (the reaction pump)", () => {
  assert.deepEqual(cc("Target weapon attack gains +4{p}"), {status:"run", ops:[["self",4]]});
  assert.deepEqual(cc("Target sword or dagger attack gains +3{p} and piercing 1."),
    {status:"run", ops:[["self",3]]});
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

test("classifyClause — leaves-the-arena payload fires early, flagged approx", () => {
  const r = cc("When this leaves the arena, your next attack this turn gets +6{p}.");
  assert.equal(r.approx, true);
  assert.deepEqual(r.ops, [["buffNext",6]]);
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
  assert.deepEqual(r.ops, [["self",3]]);
  const r2 = cc("Reprise - If the defending hero has defended with a card from their hand this chain link, instead it gains +6{p}.");
  assert.deepEqual(r2.ops, [["self",6]]);
  assert.equal(cc("Reprise").status, "noop", "the bare keyword is a qualifier");
  assert.equal(cc("Inertia").status, "noop", "inertia still has no opponent turn to tax");
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
