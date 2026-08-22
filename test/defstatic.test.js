/* ============================================================
   A DEFENDER IS WORTH ITS PRINTED NUMBER PLUS WHAT MODIFIES IT

   Both walls read `c.def || 0` — the printed value — so a card whose
   defence is changed while it defends blocked for the wrong number on
   BOTH boards. Briar's Embodiment of Earth prints

     "Non-attack action cards you control get +1{d} while defending."

   and did nothing at all.

   `effects.defendValue` is the one body. The WALL stays the caller's —
   the trainer holds defenders on the hand, judge on `blockH` — which is
   the split `linkPumps`/`linkPayload` already keep; what a single card
   is WORTH is card semantics and belongs in one place, or the two
   boards disagree about the number.

   THE SUBJECT IS READ OFF THE STRUCTURED TYPE ARRAY. "Reaction"
   contains the substring "action", and the database's display string
   contradicts its own array on five records.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB";

const rec = nm => JSON.parse(fs.readFileSync(CACHE, "utf8")).find(c => c.name === nm);
const earth = uid => { const r = rec("Embodiment of Earth"); return {
  card: {name: r.name, tt: r.type_text, ty: r.types,
         tx: (r.functional_text || "").replace(/\*\*/g, ""), uid}, kind: "aura", uid}; };

const nonAtk = {name: "Blue Blocker",   ty: ["Runeblade", "Action"],            tt: "Runeblade Action",            def: 3, uid: "b1"};
const atkCrd = {name: "Attack Blocker", ty: ["Generic", "Action", "Attack"],    tt: "Generic Action - Attack",     def: 3, uid: "b2"};
const defRx  = {name: "Trap Blocker",   ty: ["Runeblade", "Defense Reaction"],  tt: "Runeblade Defense Reaction",  def: 3, uid: "b3"};

/* ---- 1. the clause is read, and claims nothing else --------------- */

test("Embodiment of Earth's static is read off its printed line", {skip}, () => {
  P.fxReset();
  const r = rec("Embodiment of Earth");
  const fx = P.fxParse({name: r.name, pitch: 0, tt: r.type_text, ty: r.types, kw: [],
                        tx: (r.functional_text || "").replace(/\*\*/g, "")});
  assert.deepEqual(fx.defGrant, {amt: 1, subject: "nonAttackAction"});
});

test("it is the ONLY card in the pool that grants one, and the self-buffs are not claimed", {skip}, () => {
  /* The pool prints a whole family of DEFENSIVE buffs — Blade Beckoner's
     "this gets +1{d} while defending a weapon attack", Big Blue Sky,
     Sigil of Suffering, Springboard Somersault. Every one of those buffs
     ITSELF under its own condition, which is a different shape, and
     claiming them here would grant conditions nobody has built. This
     reader takes only the one that buffs OTHER cards. */
  const pool = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const claimed = [];
  for(const c of pool){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text,
      ty: c.types, kw: c.card_keywords || [],
      tx: (c.functional_text || "").replace(/\*\*/g, "")});
    if(fx.defGrant) claimed.push(c.name);
  }
  assert.deepEqual([...new Set(claimed)], ["Embodiment of Earth"]);
});

/* ---- 2. who it applies to, and who it must not ------------------- */

test("a non-attack action card gets the buff", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, nonAtk), 3, "printed, with no aura out");
  assert.equal(E.defendValue({board: [earth("e1")]}, nonAtk), 4);
});

test("an ATTACK action card does not — it carries Attack as well as Action", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1")]}, atkCrd), 3,
    "the printed word is 'non-attack'; buffing it blocks more than the card grants");
});

test("a DEFENCE REACTION does not — a reaction is not an action card", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1")]}, defRx), 3,
    "'Reaction' contains the substring 'action' — a loose tt test hands it a buff it never got");
});

test("two Embodiments stack", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: [earth("e1"), earth("e2")]}, nonAtk), 5);
});

test("only the DEFENDER's own board is consulted — the phrase is 'cards you control'", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, nonAtk), 3,
    "an aura on the other seat's board is not on this side's, and defendValue is handed one side");
});

test("a card printing no defence is still 0, not NaN", {skip}, () => {
  P.fxReset();
  const noDef = {name: "Powerless", ty: ["Runeblade", "Action"], tt: "Runeblade Action", uid: "n1"};
  const v = E.defendValue({board: [earth("e1")]}, noDef);
  assert.equal(Number.isFinite(v), true);
  assert.equal(v, 1, "0 printed + the aura's 1");
});

/* ---- 3. ONE BODY, BOTH WALLS ------------------------------------- */

test("both walls ask defendValue rather than reading the printed number", {skip}, () => {
  /* This is the property that makes it one engine. A wall that drifts back
     to `c.def` is a board where the aura silently does nothing — which is
     exactly the state this version found. Comments are stripped: a grep is
     satisfied by a comment, in both directions. */
  const strip = f => fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const eff = strip("effects.js"), jud = strip("judge.js");

  /* BOTH PATHS, on both boards (widened at v3.24). Equipment and a card
     from hand are two loops in each wall, and a buff wired into one of
     them only is half a rule. Matched loosely on the call rather than on
     its exact arguments — this drill FAILED when the third argument was
     added, which is the anchor doing its job, but the property it protects
     is "the wall asks", not the argument list. */
  assert.match(eff, /defendValue\(foe\(n\), c\b/,     "the trainer's HAND wall must ask");
  assert.match(eff, /defendValue\(foe\(n\), piece\b/, "the trainer's GEAR wall must ask");
  assert.match(jud, /E\.defendValue\(sd, c\b/,        "judge's HAND wall must ask");
  assert.match(jud, /E\.defendValue\(sd, piece\b/,    "judge's GEAR wall must ask");

  /* EVERY CALL MUST SAY WHAT IT IS DEFENDING (v3.24). Matching the call
     alone is not enough: dropping the third argument leaves
     `E.defendValue(sd, piece)` matching perfectly while the Blade Beckoner
     buff silently stops applying on that board. Proven by sabotage — this
     assertion exists because removing judge's `weaponAttack` failed NO
     drill until it was added. */
  for(const [nm, src] of [["effects.js", eff], ["judge.js", jud]]){
    /* the DEFINITION is not a call — `function defendValue(defSide, card,
       opts)` matches the same text and has no arguments to check */
    const at = [...src.matchAll(/(?<!function )defendValue\(/g)].map(m => m.index);
    assert.ok(at.length >= 2, nm + ": expected a hand and a gear call, found " + at.length);
    for(const i of at){
      const call = src.slice(i, i + 220);
      assert.match(call, /weaponAttack/,
        nm + ": a defendValue call that never says what it is defending — the "
        + "situational buff cannot apply, and nothing else would notice");
      /* AND WHICH CARD (v3.26). Wax On reads the attacking card's type and
         cost, so a call that passes only `weaponAttack` silently stops it
         applying. Sabotage found this: dropping `atkCard` from judge's
         hand wall failed no drill until this line existed. */
      assert.match(call, /atkCard/,
        nm + ": a defendValue call that never says WHICH card it is defending");
    }
  }

  /* and neither may go back to summing the raw value into the wall */
  assert.doesNotMatch(eff, /wall \+= \(c\.def/,    "the trainer's wall must not read the printed number");
  assert.doesNotMatch(jud, /wall \+= \(c\.def/,    "judge's wall must not read the printed number");
  assert.doesNotMatch(eff, /wall \+= gearDef\(/,    "the trainer's gear wall must not read wear alone");
  assert.doesNotMatch(jud, /wall \+= gearDef\(/,    "judge's gear wall must not read wear alone");
});

/* ---- 4. A DEFENDER THAT BUFFS ITSELF AGAINST A KIND OF ATTACK (v3.24)

   "This gets +1{d} while defending a weapon attack." Four Blade Beckoner
   pieces, and the condition is a property of the INCOMING attack rather
   than of the card — so only the wall can answer it, and the caller hands
   it in. Absent, the buff must NOT apply: a defender blocking for more
   than it prints because a caller forgot to say what it was defending is
   the direction that steals games. ------------------------------------ */

const helm = o => { const r = rec("Blade Beckoner Helm"); return Object.assign({
  name: r.name, tt: r.type_text, ty: r.types, def: 1, uid: "h1",
  tx: (r.functional_text || "").replace(/\*\*/g, "")}, o || {}); };

test("the four Blade Beckoner pieces read the clause, and only they", {skip}, () => {
  const pool = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const claimed = new Set();
  for(const c of pool){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text,
      ty: c.types, kw: c.card_keywords || [],
      tx: (c.functional_text || "").replace(/\*\*/g, "")});
    if(fx.defSelf) claimed.add(c.name);
  }
  /* WIDENED AT v3.26, deliberately. Two more printed conditions are read
     now — Sigil of Suffering's "if you've dealt arcane damage this turn"
     and Wax On's "while this is defending an attack action card with cost
     0" — and both became reachable only because v3.25 made a PLAYED
     defence reaction reach the wall at all. Moving this list must stay a
     deliberate edit: it is what stops a loose anchor quietly claiming a
     condition nobody has built. */
  assert.deepEqual([...claimed].sort(), [
    "Blade Beckoner Boots", "Blade Beckoner Gauntlets",
    "Blade Beckoner Helm", "Blade Beckoner Plating",
    "Gauntlets of Unity", "Helm of Unity",
    "Sigil of Suffering", "Springboard Somersault", "Unmovable", "Wax On"]);
  /* UNMOVABLE WAS NOT ON THE LIST THIS CYCLE SET OUT TO BUILD. It prints
     the same clause as Springboard Somersault with its own number (+1
     against +2), so the reader found it for free — which is the whole
     point of fixing the RULE rather than the card, and the reason each
     amount is read off the clause instead of hardcoded. */
});

test("it applies against a WEAPON attack and not against an attack action card", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, helm(), {base: 1, weaponAttack: true}), 2);
  assert.equal(E.defendValue({board: []}, helm(), {base: 1, weaponAttack: false}), 1);
});

test("a caller that does not say what it is defending gets NO buff", {skip}, () => {
  /* weaker than printed, and visible — the other direction is a wall that
     silently stops more than the cards grant */
  P.fxReset();
  assert.equal(E.defendValue({board: []}, helm(), {base: 1}), 1);
});

test("the WEAR is the base — gearDef owns that, not this", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, helm(), {base: 1, weaponAttack: true}), 2,
    "a piece worn to 1 blocks for 2 against a weapon");
  assert.equal(E.defendValue({board: []}, helm(), {base: 0, weaponAttack: true}), 1,
    "and one worn to 0 still gains its printed +1");
});

test("a DESTROYED piece gains nothing — it is not in the arena", {skip}, () => {
  /* `gearDef` answers 0 for a destroyed piece; without this the buff lifts
     it back to 1 and a piece that has left the arena blocks for a point.
     Found by DRIVING it, not by a drill. */
  P.fxReset();
  assert.equal(E.defendValue({board: []}, helm({destroyed: true}),
    {base: 0, weaponAttack: true}), 0);
});

/* ---- 5. TWO MORE CONDITIONS (v3.26) — reachable only because v3.25
   made a PLAYED defence reaction reach the wall at all. --------------- */

const waxOn = () => { const r = rec("Wax On"); return {
  name: r.name, tt: r.type_text, ty: r.types, def: +r.defense || 0, uid: "w1",
  tx: (r.functional_text || "").replace(/\*\*/g, "")}; };
const sigil = () => { const r = rec("Sigil of Suffering"); return {
  name: r.name, tt: r.type_text, ty: r.types, def: 3, uid: "s1",
  tx: (r.functional_text || "").replace(/\*\*/g, "")}; };

const atkAction = cost => ({name: "Swing", ty: ["Generic", "Action", "Attack"],
  tt: "Generic Action - Attack", cost, power: 6});
const weaponSwing = () => ({name: "Blade", ty: ["Warrior", "Weapon"],
  tt: "Warrior Weapon", cost: 0, power: 4});

test("Sigil of Suffering reads its own side's turn history", {skip}, () => {
  P.fxReset();
  const noArc = {board: [], hist: {arc: 0}}, didArc = {board: [], hist: {arc: 1}};
  assert.equal(E.defendValue(noArc,  sigil(), {}), 3, "no arcane dealt — printed only");
  assert.equal(E.defendValue(didArc, sigil(), {}), 4, "arcane dealt this turn — +1{d}");
});

test("a side with no hist at all does not crash, and does not buff", {skip}, () => {
  P.fxReset();
  assert.equal(E.defendValue({board: []}, sigil(), {}), 3);
});

test("Wax On reads the INCOMING attack — its type and its cost", {skip}, () => {
  P.fxReset();
  const s = {board: []};
  assert.equal(E.defendValue(s, waxOn(), {atkCard: atkAction(0)}), waxOn().def + 2,
    "a cost-0 attack action card is exactly what it prints");
  assert.equal(E.defendValue(s, waxOn(), {atkCard: atkAction(2)}), waxOn().def,
    "a cost-2 attack action card is not");
  assert.equal(E.defendValue(s, waxOn(), {atkCard: weaponSwing()}), waxOn().def,
    "a WEAPON swing is not an attack action card, whatever it costs");
  /* THE FIXTURE THAT ACTUALLY BITES. A weapon carries neither Action nor
     Attack, so it is refused by either half of the test — dropping the
     Attack check alone still excludes it, and the drill passed on a
     sabotaged engine. A non-attack ACTION card at cost 0 carries Action
     and NOT Attack, which is the only shape that tells the two apart. */
  const nonAtkAction = {name: "Ritual", ty: ["Runeblade", "Action"],
                        tt: "Runeblade Action", cost: 0, power: null};
  assert.equal(E.defendValue(s, waxOn(), {atkCard: nonAtkAction}), waxOn().def,
    "a cost-0 NON-attack action card is not an attack action card");
  assert.equal(E.defendValue(s, waxOn(), {}), waxOn().def,
    "and a caller that supplies no attack gets the printed value");
});

test("the cost threshold is read off the card, not hardcoded", {skip}, () => {
  P.fxReset();
  const r = rec("Wax On");
  const fx = P.fxParse({name: r.name, pitch: 0, tt: r.type_text, ty: r.types, kw: [],
                        tx: (r.functional_text || "").replace(/\*\*/g, "")});
  assert.equal(fx.defSelf.cost, 0, "Wax On prints cost 0 — the clause names its own number");
  assert.equal(fx.defSelf.amt, 2);
});

test("an unread condition never fires", {skip}, () => {
  /* THE PREDICATE IS ASKED DIRECTLY, because the shape this guards cannot
     be built from a real card: the parser only ever emits the three `when`
     values the evaluator knows, so a card fixture reaches the default only
     if someone adds a fourth to the parser and forgets the evaluator —
     which is exactly the drift. The first draft of this drill handed it a
     card with no clause at all, so the `if(self && ...)` short-circuited
     and the sabotage changed nothing. Found by sabotage. */
  assert.equal(E.defSelfMet({amt: 9, when: "somethingNobodyBuilt"}, {hist: {arc: 5}},
    {weaponAttack: true, atkCard: {ty: ["Generic", "Action", "Attack"], cost: 0}}), false,
    "an unbuilt condition must leave the card at its printed value");
  /* and the three that ARE built still answer, so this is not passing by
     refusing everything */
  assert.equal(E.defSelfMet({amt: 1, when: "weaponAttack"}, {}, {weaponAttack: true}), true);
  assert.equal(E.defSelfMet({amt: 1, when: "arcDealt"}, {hist: {arc: 1}}, {}), true);
  assert.equal(E.defSelfMet({amt: 2, when: "atkActionCostLe", cost: 0}, {},
    {atkCard: {ty: ["Generic", "Action", "Attack"], cost: 0}}), true);
});

/* ---- 6. TWO WALL-TIME CONDITIONS (v3.27) --------------------------
   Both are true only DURING a block, which is why they carry no
   display problem: at rest there is no buffed number to show. That is
   the boundary v3.24 set, and it is what still keeps Basalt Boots and
   Mournful Casket out — their conditions are true sitting on the
   board, so building them at the wall alone would put a number on
   screen that disagrees with the number that blocked. ---------------- */

const unity = () => { const r = rec("Helm of Unity"); return {
  name: r.name, tt: r.type_text, ty: r.types, def: 1, uid: "u1",
  tx: (r.functional_text || "").replace(/\*\*/g, "")}; };
const springboard = () => { const r = rec("Springboard Somersault"); return {
  name: r.name, tt: r.type_text, ty: r.types, def: 2, uid: "sb1",
  tx: (r.functional_text || "").replace(/\*\*/g, "")}; };

test("Unity asks about the REST of the wall", {skip}, () => {
  P.fxReset();
  const s = {board: []};
  assert.equal(E.defendValue(s, unity(), {base: 1, handDefenders: 0}), 1,
    "alone, it is worth its printed defence");
  assert.equal(E.defendValue(s, unity(), {base: 1, handDefenders: 1}), 2,
    "defending together with a card from hand");
  assert.equal(E.defendValue(s, unity(), {base: 1}), 1,
    "a caller that does not count the wall gets the printed value");
});

test("Unity's buff does not scale with the number of hand defenders", {skip}, () => {
  /* "together with A card from hand" is a condition, not a count. */
  P.fxReset();
  assert.equal(E.defendValue({board: []}, unity(), {base: 1, handDefenders: 3}), 2);
});

test("Springboard Somersault reads the zone it was played from", {skip}, () => {
  P.fxReset();
  const s = {board: []};
  assert.equal(E.defendValue(s, springboard(), {fromArsenal: true}), 4, "2 printed + 2");
  assert.equal(E.defendValue(s, springboard(), {fromArsenal: false}), 2);
  assert.equal(E.defendValue(s, springboard(), {}), 2,
    "unstated is not from arsenal — weaker than printed, never stronger");
  /* the same clause on another card, with its OWN number */
  const r = rec("Unmovable");
  const unmov = {name: r.name, tt: r.type_text, ty: r.types, def: 7, uid: "un1",
                 tx: (r.functional_text || "").replace(/\*\*/g, "")};
  assert.equal(E.defendValue(s, unmov, {fromArsenal: true}), 8, "7 printed + its own 1");
});

test("both walls count the hand defenders BEFORE they start summing", {skip}, () => {
  /* judge loops gear first, so a running total would read zero for every
     piece; the trainer loops both together and would see only the
     defenders declared earlier. Unity asks about the whole wall. */
  const strip = f => fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for(const [nm, src] of [["effects.js", strip("effects.js")], ["judge.js", strip("judge.js")]]){
    const decl = src.indexOf("handDefenders =");
    const use  = src.indexOf("handDefenders}");
    assert.ok(decl >= 0, nm + ": the wall must count its hand defenders");
    assert.ok(use > decl, nm + ": counted after it is used — every piece would read zero");
  }
});

/* ---- 7. THE TRAINER'S WALL, DRIVEN (v3.27) --------------------------
   The judge side of Unity is driven in defreaction.test.js. This is the
   other board: `resolveStack` is the TRAINER's path and judge never
   calls it, so a drill on one says nothing about the other — which is
   the split CLAUDE.md records as "judge's wall had no drill" and the
   reason both are driven now.

   The DECLARATION is constructed, and that is legitimate: which cards
   are defending is the caller's answer on both boards. What is being
   measured is what the wall makes of them. ---------------------------- */
const H = require("./helpers/judged.js");
const G = require("../engine/game.js");

test("the trainer's wall counts its hand defenders too", {skip}, () => {
  P.fxReset();
  const CD = require("../engine/cards.js");
  const db = CD.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(CD.mapDbCard));
  const helm = Object.assign({},
    CD.resolveEntry(db, {name: "Helm of Unity", p: 0, code: null, q: 1}), {uid: "helm1"});
  const blk = {name: "Plain Blocker", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], tx: "", kw: [], def: 3, uid: "blk1"};
  const swing = {name: "Probe Swing", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: 6, uid: "atk1"};

  const run = withHand => {
    const g = H.state({}, {gear: [helm], hand: withHand ? [blk] : [], hp: 20}, {turn: 3});
    g.builds = [{}, {}];
    g.pend = {card: swing, from: "hand", total: 6, ga: false,
              ops: [], onHit: [], condOnHit: [], lateConds: [], lateOps: []};
    g.stack = [{k: "def", gi: 0}].concat(withHand ? [{k: "def", uid: "blk1"}] : []);
    return H.fx(g, (f, n) => f.resolveStack(n));
  };

  assert.equal(run(false).sides[1].hp, 15, "the helm alone: 20 - (6 - 1)");
  assert.equal(run(true).sides[1].hp, 19,
    "alongside a card from hand: wall is (1 + 1 Unity) + 3 = 5, so 1 gets through. "
    + "A wall that stopped counting gives 4 and lets 2 through.");
});
