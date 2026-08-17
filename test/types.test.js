/* CARD TYPES, ACROSS THE WHOLE POOL.

   The pool prints 138 distinct type lines over 401 unique cards, and the
   rules that need no text box — where a card may be played from, in
   which window, what it costs and where it goes afterwards — all fall
   out of those lines. So these drills read every one of them.

   Two kinds of drill here, and the second is the important one:

     1. `types.js` parses what the pool actually prints.
     2. `types.js` AGREES with the predicates already in the engine, card
        for card, and every disagreement is pinned with a reason. The
        trainer asks type questions from five or six places; `rxAllowed`
        exists because five copies of one question had drifted apart. A
        cross-check that runs on every card is how a sixth copy stops
        being able to drift silently. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const TY = require("../engine/types");
const PR = require("../engine/parser");
const GM = require("../engine/game");
const C = require("../engine/cards");
const { loadData } = require("./helpers/extract");

const CACHE = require("./helpers/extract").cardDbPath();
const ready = fs.existsSync(CACHE);
const skip = !ready && "no cached DB — run: node tools/audit.js";

const W = loadData();
let _pool = null;
function pool(){
  if(_pool) return _pool;
  const db = C.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard));
  const seen = new Set(); const out = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(db, e, sa);
      if(!c.resolved) continue;
      const k = c.name + "|" + c.pitch;
      if(seen.has(k)) continue;
      seen.add(k); out.push(c);
    }
  }
  return (_pool = out);
}

/* THE POOL IS NOT ONLY THE FIFTEEN DECKS. Cards reach a hand three other
   ways — the dummy's pile, its iron, and the two records an effect mints
   at runtime (Crouching Tiger, Inner Chi) — and `pool()` above sees none
   of them, so every drill that reads it was quietly asking a smaller
   question than its name suggests. `Inner Chi` is why this exists: a
   `Mystic Resource - Chi` reported PLAYABLE with no window to play it in,
   and the drill that would have caught it never looked at the card. */
let _extra = null;
function offDeck(){
  if(_extra) return _extra;
  const db = C.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard));
  const out = [];
  const take = e => { const c = C.resolveEntry(db, e, null); if(c.resolved) out.push(c); };
  for(const nm of (W.DUMMY_GEAR || [])) take({name: nm, p: 0, code: null, q: 1});
  for(const [nm, p, q] of (W.DUMMY_DECK || [])) take({name: nm, p, code: null, q});
  for(const nm of ["Crouching Tiger", "Inner Chi"]) take({name: nm, p: 0, code: null});
  return (_extra = out);
}
const everything = () => [...pool(), ...offDeck()];

/* ---- the parse holds across the pool ----------------------------------- */

test("every card in the pool parses to at least one printed type", {skip}, () => {
  const bad = pool().filter(c => !TY.cardType(c).types.length)
                    .map(c => `${c.name} [${c.tt}]`);
  assert.deepEqual(bad, []);
});

test("every card prints a pitch value, so every card can be pitched", {skip}, () => {
  /* The one thing that is true of every card in hand whatever it is.
     A card with no pitch value could never be turned into a resource,
     which would make some hands unplayable. */
  const bad = pool().filter(c => c.pitch == null || !(c.pitch >= 0))
                    .map(c => `${c.name} [${c.tt}] pitch=${c.pitch}`);
  assert.deepEqual(bad, []);
});

test("no card is stranded: it is playable, or it says why not", {skip}, () => {
  /* Every card must have a defined relationship to being played. A card
     that is neither playable nor has a stated reason is one the UI can
     only dead-tap on. */
  const bad = pool().filter(c => !TY.isPlayable(c) && !TY.noPlayReason(c))
                    .map(c => `${c.name} [${c.tt}]`);
  assert.deepEqual(bad, []);
});

test("a playable card has at least one window it can be played in", {skip}, () => {
  /* EVERYTHING, not just the fifteen decks: the dummy's pile and the two
     runtime-minted records reach a hand too, and `Inner Chi` failed this
     exact assertion while sitting outside the denominator. */
  const bad = everything().filter(c => TY.isPlayable(c) && !TY.playWindows(c).length)
                          .map(c => `${c.name} [${c.tt}]`);
  assert.deepEqual(bad, []);
});

test("no card is stranded, off-deck cards included", {skip}, () => {
  const bad = everything().filter(c => !TY.isPlayable(c) && !TY.noPlayReason(c))
                          .map(c => `${c.name} [${c.tt}]`);
  assert.deepEqual(bad, []);
});

/* A RESOURCE CARD HAS NO PLAY — it is pitched, and that is all. `Inner
   Chi` prints no cost, no rules text and a pitch of 3, and `playWindows`
   has no entry for its type. It reported playable anyway, so the refusal
   came two steps later as "cannot be played in the action phase", which
   reads like a timing problem rather than what it is. */
test("a Resource card is pitch-only", {skip}, () => {
  const res = everything().filter(c => TY.hasType(c, "Resource"));
  assert.deepEqual(res.map(c => c.name), ["Inner Chi"],
    "the pool's Resource cards changed — check this drill still says what it means");
  for(const c of res){
    assert.deepEqual(TY.playWindows(c), [], `${c.name} claims a play window`);
    assert.equal(TY.isPlayable(c), false, `${c.name} reads as playable with nowhere to play it`);
    assert.match(TY.noPlayReason(c), /can only be pitched/);
    assert.ok(c.pitch > 0, `${c.name} cannot even be pitched`);
  }
});

test("every card has exactly one destination, and it is a real zone", {skip}, () => {
  const ok = ["chain", "arena", "grave"];
  const bad = pool().filter(c => ok.indexOf(TY.destination(c)) < 0)
                    .map(c => `${c.name} -> ${TY.destination(c)}`);
  assert.deepEqual(bad, []);
});

/* ---- agreement with the engine's existing predicates -------------------- */

test("types.js agrees with parser.js on attack, reaction and instant — every card", {skip}, () => {
  const dis = [];
  for(const c of pool()){
    const t = TY.cardType(c);
    if(TY.isAttack(t)  !== PR.isAttack(c))   dis.push(`isAttack ${c.name} [${c.tt}]`);
    if(TY.isAR(t)      !== PR.isAR(c))       dis.push(`isAR ${c.name} [${c.tt}]`);
    if(TY.isDR(t)      !== PR.isDR(c))       dis.push(`isDR ${c.name} [${c.tt}]`);
    if(TY.isInstant(t) !== PR.isInstantT(c)) dis.push(`isInstant ${c.name} [${c.tt}]`);
  }
  assert.deepEqual(dis, []);
});

test("a class word is never filed as a type, slot, shape or hands", {skip}, () => {
  /* "Assassin / Warrior" says who may DECK the card and how other cards
     refer to it. It is not what the card IS — reading it as a type is
     what started this. Equally, an equipment slot or a weapon shape must
     never end up in `classes`: `Necromancer Equipment - Head` once
     produced classes ["Necromancer","Head"]. */
  const RESERVED = /^(head|chest|arms|legs|quiver|off-hand|1h|2h|sword|bow|hammer|dagger|staff|gun|claw|scroll)$/i;
  const bad = [];
  for(const c of pool()){
    const t = TY.cardType(c);
    for(const cl of t.classes){
      if(TY.CARD_TYPES.includes(cl)) bad.push(`${c.name}: type "${cl}" filed as a class`);
      if(TY.SUBTYPES.includes(cl))   bad.push(`${c.name}: subtype "${cl}" filed as a class`);
      if(RESERVED.test(cl))          bad.push(`${c.name}: slot/shape "${cl}" filed as a class`);
    }
    if(TY.isEquipment(t) || TY.isWeaponType(t))
      assert.ok(t.classes.length > 0, `${c.name} [${c.tt}] lost every class word`);
  }
  assert.deepEqual(bad, []);
});

test("types.js agrees with game.js on every equipment slot", {skip}, () => {
  const dis = [];
  for(const c of pool()){
    const t = TY.cardType(c);
    if(!TY.isEquipment(t) && !TY.isWeaponType(t)) continue;
    if(t.slot !== GM.slotOf(c).z) dis.push(`${c.name} [${c.tt}] types=${t.slot} slotOf=${GM.slotOf(c).z}`);
  }
  assert.deepEqual(dis, []);
});

/* PINNED, WITH ITS REASON. `parser.isWeapon` is `/weapon/i.test(tt) &&
   power != null`, so four weapons that print no power do not answer to
   it: Death Dealer (Bow), Plasma Barrel Shot (Gun), Cosmo (Scroll) and
   Crucible of Aetherweave (Staff).

   That looks like the bow bug and it is NOT the same thing. In build.js
   the predicate decides whether a piece is routed as a swinging weapon
   or as an activated ability, and the four powerless ones need the
   ability route: Crucible's "Once per Turn Instant - {r}: …" is reached
   only because `isWeapon` says false. Making it type-accurate would take
   that ability away — a regression to fix one.

   So the two names mean two things and both are correct for their job:

     types.isWeaponType(c)   is this card's TYPE Weapon
     parser.isWeapon(c)      is this a weapon with a printed power

   Renaming parser's to say so belongs with the Phase 3 pass over
   equipment abilities. Until then this list is the ledger; a fifth entry
   appearing means something changed that nobody decided. */
test("the parser/types weapon split is exactly the four powerless weapons", {skip}, () => {
  const dis = pool().filter(c => TY.isWeaponType(c) !== PR.isWeapon(c)).map(c => c.name).sort();
  assert.deepEqual(dis, [
    "Cosmo, Scroll of Ancestral Tapestry",
    "Crucible of Aetherweave",
    "Death Dealer",
    "Plasma Barrel Shot"
  ]);
  for(const c of pool().filter(c => dis.indexOf(c.name) >= 0))
    assert.equal(c.power, null, `${c.name} is in the split list but prints power`);
});

/* ---- the three shapes a naive reader gets wrong -------------------------- */

/* A REACTION IS NOT AN ACTION, AND THE DISPLAY STRING SAYS OTHERWISE.

   The database carries two type fields and they disagree on 5 of its
   4,862 records:

     Den of the Spider  ty: ["Assassin","Warrior","Defense Reaction","Trap"]
                        tt: "Assassin / Warrior Action Defense Reaction - Trap"

   The structured array is right; `type_text` carries a stray "Action".
   Reading the string made a defence reaction playable in the action
   phase for an action point — sev-3 "illegal play allowed", and
   invisible to every card-level tool because the card's TEXT parsed
   perfectly. The class words say who may DECK a card, not what it is. */
test("a reaction is never an action — no card in the pool is both", {skip}, () => {
  const both = pool().filter(c => {
    const t = TY.cardType(c);
    return t.types.includes("Action") && (t.types.includes("Defense Reaction") || t.types.includes("Attack Reaction"));
  }).map(c => `${c.name} [${c.tt}]`);
  assert.deepEqual(both, []);
});

test("the two Spiders are Defense Reactions, and their classes are only classes", {skip}, () => {
  for(const nm of ["Den of the Spider", "Lair of the Spider"]){
    const c = pool().find(x => x.name === nm);
    assert.ok(c, `${nm} is not in the pool`);
    const t = TY.cardType(c);
    assert.deepEqual(t.types, ["Defense Reaction"], `${nm} parsed as ${JSON.stringify(t.types)}`);
    assert.deepEqual(t.subtypes, ["Trap"]);
    assert.deepEqual(TY.playWindows(c), ["defense-reaction"],
      `${nm} is playable outside the defence window`);
    assert.equal(TY.typeCostsAP(c, "defense-reaction"), false,
      `${nm} charged an action point for a defence reaction`);
    /* the class words are CLASSES — deck legality and how other cards
       refer to it — never types */
    assert.ok(t.classes.length >= 2, `${nm} lost its class words: ${JSON.stringify(t.classes)}`);
    assert.ok(t.classes.every(x => !TY.CARD_TYPES.includes(x)),
      `${nm} filed a card type as a class: ${JSON.stringify(t.classes)}`);
  }
});

test("the structured array beats the display string where they disagree", {skip}, () => {
  /* Proven at the source, not just at the parse: the two records really
     do carry conflicting fields, so the drill above is testing a real
     conflict rather than a hypothetical. */
  const den = pool().find(c => c.name === "Den of the Spider");
  assert.ok(/\bAction\b/i.test(den.tt), "the display string stopped carrying its stray 'Action'");
  assert.ok(!den.ty.some(x => /^Action$/i.test(x)), "the structured array grew an 'Action'");
  assert.ok(!TY.isAction(den), "types.js followed the display string over the array");
});

test("a DOUBLE-FACED card is read by its FRONT face", {skip}, () => {
  /* The one place the display string knows more than the array: a DFC
     flattens both faces into `ty` — ["Runeblade","Action","Earth",
     "Instant"] — and only `type_text` keeps the "//" boundary. You play
     the front face; the back is reachable only by melding. Reading the
     flat array calls two real action cards instants and hands each a
     free action point, which is the v2.39 bug exactly. */
  const dfcs = pool().filter(c => String(c.tt || "").includes("//"));
  assert.ok(dfcs.length > 0, "no DFC in the pool — the drill cannot bite");
  for(const c of dfcs){
    assert.ok(c.ty.some(x => /^Instant$/i.test(x)),
      `${c.name}'s array should still carry the back face's Instant`);
    assert.equal(TY.isInstant(c), false,
      `${c.name} was read as an instant — that is the back face`);
    assert.equal(TY.isAction(c), true, `${c.name}'s front face is an Action`);
    assert.equal(TY.typeCostsAP(c, "action"), true,
      `${c.name} would get a free action point — v2.39's bug, back again`);
  }
});

test("Block cards have no play — only pitch and defend", {skip}, () => {
  const blocks = pool().filter(c => TY.isBlock(c));
  assert.deepEqual(blocks.map(c => c.name).sort(),
    ["Crash and Bash", "On the Horizon", "Test of Might", "Test of Strength"]);
  for(const c of blocks){
    assert.equal(TY.isPlayable(c), false, `${c.name} is playable — it would be a free 0-cost no-op`);
    assert.match(TY.noPlayReason(c), /pitched or declared as a defender/);
    assert.ok(c.def > 0, `${c.name} prints no defence, so it could not even be declared`);
    assert.ok(c.pitch > 0, `${c.name} prints no pitch, so it could not even be pitched`);
  }
});

test("equipment and weapons are not played from hand", {skip}, () => {
  for(const c of pool()){
    if(!TY.isEquipment(c) && !TY.isWeaponType(c)) continue;
    assert.equal(TY.isPlayable(c), false, `${c.name} [${c.tt}] reads as playable`);
    assert.match(TY.noPlayReason(c), /worn|equipped and activated/);
  }
});

test("'Reaction' is not read as 'Action'", {skip}, () => {
  for(const c of pool()){
    const t = TY.cardType(c);
    if(!TY.isAR(t) && !TY.isDR(t)) continue;
    /* the two Traps really are both; everything else must not be */
    if(t.types.includes("Action"))
      assert.ok(/Action (Attack|Defense) Reaction/.test(t.line),
        `${c.name} [${c.tt}] was read as an Action because "Reaction" contains "action"`);
  }
});

/* ---- permanents ---------------------------------------------------------- */

test("auras, items and allies resolve to the ARENA, not the graveyard", {skip}, () => {
  const perms = pool().filter(c => TY.isPermanent(c));
  assert.ok(perms.length > 10, `only ${perms.length} permanents found`);
  for(const c of perms){
    assert.equal(TY.destination(c), "arena", `${c.name} [${c.tt}] resolves to the graveyard`);
    assert.ok(["ally", "aura", "item", "permanent"].includes(TY.permanentKind(c)));
  }
  const kinds = {};
  perms.forEach(c => { const k = TY.permanentKind(c); kinds[k] = (kinds[k] || 0) + 1; });
  for(const k of ["ally", "aura", "item"])
    assert.ok(kinds[k] > 0, `no ${k} in the pool — the arena routing is untested for it`);
});

test("an ALLY carries printed life, or it cannot be attacked (CR 1.4.5a)", {skip}, () => {
  const allies = pool().filter(c => TY.isAllyCard(c));
  assert.ok(allies.length > 0);
  const lifeless = allies.filter(c => c.life == null).map(c => c.name);
  assert.deepEqual(lifeless, [],
    "an ally with no life is not a living object and cannot be an attack-target");
});

test("an attack resolves to the CHAIN, and nothing else does", {skip}, () => {
  for(const c of pool()){
    const d = TY.destination(c);
    assert.equal(d === "chain", TY.isAttack(c), `${c.name} [${c.tt}] destination ${d}`);
  }
});

/* ---- the numbers --------------------------------------------------------- */

test("printed numbers are numbers or null — never NaN, never a string", {skip}, () => {
  const bad = [];
  for(const c of pool()){
    for(const f of ["pitch", "cost", "power", "def"]){
      const v = c[f];
      if(v == null) continue;
      if(typeof v !== "number" || Number.isNaN(v)) bad.push(`${c.name}.${f} = ${JSON.stringify(v)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("null is not zero: a card with no printed cost is not a free card", {skip}, () => {
  /* Equipment, weapons and blocks print no cost because they are never
     played. Ice Eternal and Night's Embrace print none because the
     database has no value — X, or simply absent. Those two ARE playable,
     which is why playability can never be decided from the cost. */
  const noCost = pool().filter(c => c.cost == null);
  const playable = noCost.filter(c => TY.isPlayable(c)).map(c => c.name).sort();
  assert.deepEqual(playable, ["Ice Eternal", "Night's Embrace"],
    "the set of playable cards with no printed cost changed — check for an X cost");
  for(const c of noCost.filter(c => !TY.isPlayable(c)))
    assert.ok(TY.isEquipment(c) || TY.isWeaponType(c) || TY.isBlock(c),
      `${c.name} [${c.tt}] has no cost and no reason not to be played`);
});

test("power is only printed on things that can attack", {skip}, () => {
  /* Attacks, weapons — and ALLIES. An ally prints power because an ally
     swings: Swabbie is a 7-power body that hits every turn it survives.
     It prints life for the same reason in reverse (CR 1.4.5a), which is
     what makes it an attack-target. A drill that forgets allies attack
     reports six correct cards as broken. */
  const odd = pool().filter(c => c.power != null
      && !TY.isAttack(c) && !TY.isWeaponType(c) && !TY.isAllyCard(c))
    .map(c => `${c.name} [${c.tt}] power=${c.power}`);
  assert.deepEqual(odd, []);
});

test("every ally prints BOTH power and life — it attacks and can be attacked", {skip}, () => {
  const allies = pool().filter(c => TY.isAllyCard(c));
  assert.ok(allies.length > 0);
  const bad = allies.filter(c => c.power == null || c.life == null)
                    .map(c => `${c.name} power=${c.power} life=${c.life}`);
  assert.deepEqual(bad, []);
});

test("a defence reaction still prints defence, and is still never declared", {skip}, () => {
  const drs = pool().filter(c => TY.isDR(c));
  assert.ok(drs.length > 10);
  /* They print defence — which is exactly the trap. A declaration test
     that only asks "does it print defence" lets every one of them in. */
  assert.ok(drs.filter(c => c.def > 0).length > 10,
    "defence reactions stopped printing defence — the declaration trap is gone");
});

/* ---- the taxonomy, as a snapshot ----------------------------------------- */

test("the pool's type census is what we think it is", {skip}, () => {
  /* A snapshot, so that a card-data refresh that changes the shape of the
     pool is a deliberate edit rather than a silent drift. */
  const n = t => pool().filter(t).length;
  const census = {
    cards:      pool().length,
    action:     n(TY.isAction),
    instant:    n(TY.isInstant),
    attackRx:   n(TY.isAR),
    defenseRx:  n(TY.isDR),
    equipment:  n(TY.isEquipment),
    weapon:     n(TY.isWeaponType),
    block:      n(TY.isBlock),
    attack:     n(TY.isAttack),
    permanent:  n(TY.isPermanent)
  };
  assert.deepEqual(census, {
    cards: 401, action: 267, instant: 22, attackRx: 20, defenseRx: 15,
    equipment: 58, weapon: 15, block: 4, attack: 175, permanent: 23
  }, "the pool's type census moved — check DATA_VER and the deck lists");
});

test("the census accounts for every card exactly once", {skip}, () => {
  /* The snapshot above is only worth having if the numbers are a
     PARTITION rather than ten unrelated counts. Every card carries
     exactly one card type, except the two Traps that genuinely carry
     two, so the type counts must sum to the pool plus the dual-typed.

     `attack` and `permanent` are deliberately NOT in the sum: they are
     subtypes, and an attack is a subset of the actions — 175 of the 269.
     A drill that added them would double-count and prove nothing. */
  const n = t => pool().filter(t).length;
  const byType = n(TY.isAction) + n(TY.isInstant) + n(TY.isAR) + n(TY.isDR)
               + n(TY.isEquipment) + n(TY.isWeaponType) + n(TY.isBlock);
  const dual = pool().filter(c => TY.cardType(c).types.length > 1).length;
  assert.equal(byType - dual, pool().length,
    "a card is either typed twice by accident or not typed at all");
  assert.ok(pool().every(c => !TY.isAttack(c) || TY.isAction(c)),
    "an attack that is not an action — the subtype/type relationship broke");
});
