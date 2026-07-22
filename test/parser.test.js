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

/* ---------- runechant cost reduction ---------- */

test("runeRed / effCost — 'costs less per runechant' discounts, floored at 0", () => {
  const card = {cost:3, tx:"This costs {1} less for each Runechant you control."};
  assert.equal(P.runeRed(card), 1);
  assert.equal(P.effCost(card, {rune:2}), 1);
  assert.equal(P.effCost(card, {rune:9}), 0);
  assert.equal(P.effCost({cost:2, tx:"Go again."}, {rune:5}), 2);
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
