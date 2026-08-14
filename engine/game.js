/* ============================================================
   Dawnblade engine — game.js (Phase 1 extraction)
   Pure game-state helpers extracted verbatim from index.html:
   deck parsing, equipment block wear, gear slotting, shuffle.

   Phase 2 grows this into the two-player state machine
   (turns, chain, stack, priority). The trainer's runOps /
   execute / resolveStack still live inside index.html's
   Battle component — they come here when the dummy gets a hand.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnGame = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* The unseeded `shuffle` lived here until v2.26. DELETED, not kept:
   every game-affecting shuffle now goes through DawnRNG.shuffle(rng, arr),
   and an unseeded one sitting beside it under a SHORTER name is a trap —
   someone reaches for it and silently breaks replay and lockstep with no
   test able to notice. Same reasoning that deleted sides.js's you/foe in
   v2.24: prefer removing a misusable helper over documenting it. */

function parseDeck(raw){
  const gear=[], deck=[]; let hero=null;
  raw.trim().split("\n").forEach(line=>{
    const [a,name,p,code] = line.split("|");
    const e = {name:name.trim(), p:parseInt(p,10)||0, code:(code||"").trim()||null};
    if(a==="H") hero=e; else if(a==="G") gear.push(e); else { e.q=parseInt(a,10)||1; deck.push(e); }
  });
  return {hero,gear,deck};
}

const gearDef = gr => gr.destroyed ? 0 : (gr.curDef!=null ? gr.curDef : (gr.def||0));
function gearBlockApply(gr){
  const kws = (gr.kw||[]).map(k=>String(k).toLowerCase());
  const d = gearDef(gr); const n = {...gr};
  if(kws.some(k=>k.includes("blade break"))) n.destroyed = true;
  else if(kws.some(k=>k.includes("guardwell"))){ n.curDef = 0; }
  else if(kws.some(k=>k.includes("temper"))){ n.curDef = Math.max(0,d-1); if(n.curDef===0) n.destroyed = true; }
  else if(kws.some(k=>k.includes("battleworn"))){ n.curDef = Math.max(0,d-1); }
  return n;
}

function slotOf(c){
  const t = ((c&&c.tt)||"").toLowerCase();
  if(/off[\s-]?hand/.test(t)) return {z:"off",h:1,lab:"off"};
  if(/\bquiver\b/.test(t)) return {z:"qvr",h:0,lab:"quiver"};
  if(/\b2h\b/.test(t)) return {z:"2h",h:2,lab:"2h"};
  if(/\b1h\b/.test(t)) return {z:"1h",h:1,lab:"1h"};
  if(/\bhead\b/.test(t)) return {z:"head",h:0,lab:"head"};
  if(/\bchest\b/.test(t)) return {z:"chest",h:0,lab:"chest"};
  if(/\barms\b/.test(t)) return {z:"arms",h:0,lab:"arms"};
  if(/\blegs\b/.test(t)) return {z:"legs",h:0,lab:"legs"};
  if(/weapon/.test(t) || (c&&c.power!=null)) return {z:"1h",h:1,lab:"1h?"};
  return {z:"misc",h:0,lab:"gear"};
}

/* ---- THE FOUR ARMOUR ZONES, AND WHICH OF THEM ARE EXPOSED (v2.74) ----
   "Create a Frostbite token in an exposed head, chest, arms, or legs
   zone" (Frost Spike). An EXPOSED zone is an armour zone with nothing
   live in it — never equipped, or equipped with a piece that has since
   been destroyed. RULING (user, 2026-08-14): with no exposed zone the
   card simply fizzles, and that placement is what makes Frost Spike
   WEAKER than an ordinary create rather than stronger.

   `ARMOR_SLOTS` lives here rather than in index.html because the rule
   and the picture must agree about what the four zones are: it was a
   hand-copied const beside `ArmorGrid`, and a second copy of a list the
   rules now read is the mirror the v2.20 no-mirror rule exists to
   delete. The trainer reaches this one through the bridge.

   A DESTROYED PIECE STILL OCCUPIES ITS SLOT IN `sd.gear` — equipment
   wears rather than leaving — so the `destroyed` flag has to be read
   here or a hero who has lost every piece would still report a full set
   of armour and Frost Spike would fizzle against an undefended hero,
   which is the exact opposite of the card. */
const ARMOR_SLOTS = ["head","chest","arms","legs"];
const gearLive = p => !!p && !p.destroyed;
const exposedZones = sd =>
  ARMOR_SLOTS.filter(z => !((sd && sd.gear) || []).some(p => gearLive(p) && slotOf(p).z === z));
const hasExposedZone = sd => exposedZones(sd).length > 0;

/* ============================================================
   ATTACK TARGETS (CR 1.4.5)

   "An attack-target is the target of an attack that is declared when the
   attack or attack-layer is put onto the stack. If a player plays,
   activates, or triggers an attack or attack-layer, the player MUST
   declare an attackable object controlled by an opponent as the
   attack-target."   — CR 1.4.5

   "An object is attackable if it is a living object, or if it is made
   attackable by an effect."   — CR 1.4.5a

   A hero is a living object. So is an ally, because an ally has a LIFE
   property — which is why `resolveEntry` had to start carrying it. With
   an ally in the arena there are two or more legal targets and the choice
   is the attacking player's, made at declaration, and it is mandatory.

   The consequence that matters most is in the DEFEND step:

   "If the attack-target is a hero, their controller may declare any
   number of non-defense-reaction cards ... Otherwise, a player may only
   declare cards for an attack-target if a rule or effect specifies it."
                                                          — CR 7.3.2a

   **An attack on an ally cannot be blocked.** No equipment, no cards from
   hand. That is what makes attacking an ally a real decision rather than
   a worse version of hitting the hero: it always connects, and it kills.

   Allies heal every turn — CR 4.4.3a resets ally life to base in the end
   phase — so ally damage is a per-turn race, not permanent attrition.
   ============================================================ */

/* A board entry is {card, kind, spent, uid}. An ally is a living object
   only if it actually has a life value; without one it is not attackable
   and the target prompt must not offer it. */
const isAlly = b => !!(b && b.kind === "ally" && b.card);
const allyBaseLife = b => (b && b.card && b.card.life != null) ? b.card.life : null;
const allyLife = b => {
  if(!b) return null;
  if(b.life != null) return b.life;          /* current, once damaged */
  return allyBaseLife(b);
};
const isAttackable = b => isAlly(b) && allyLife(b) != null && allyLife(b) > 0;

/* Every legal attack-target the given side controls, hero first.
   `heroCard` is display-only (the prompt sheet renders a card frame), so
   this stays a pure query and never reaches for trainer internals. */
function attackTargets(game, defIdx, heroCard){
  const sd = game && game.sides && game.sides[defIdx];
  if(!sd) return [];
  const hero = Object.assign({}, heroCard || {name: sd.name || "Hero", tt: "Hero", tx: ""}, {
    _target: {kind: "hero", side: defIdx, uid: null},
    _life: sd.hp
  });
  const allies = (sd.board || []).filter(isAttackable).map(b =>
    Object.assign({}, b.card, {
      _target: {kind: "ally", side: defIdx, uid: b.uid},
      _life: allyLife(b)
    }));
  return [hero, ...allies];
}

/* CR 7.3.2a — only a hero target may be defended with cards. */
const targetCanBeDefended = t => !t || t.kind === "hero";

/* Apply damage to one attack-target. Returns {game, msgs, killed}.
   Hero damage is the caller's business (it interacts with ward, arcane
   barrier and the score); this owns the ALLY case, which is the one the
   trainer had no path for at all. */
function damageAlly(game, side, uid, amount){
  const msgs = [];
  const sides = game.sides.slice();
  const sd = Object.assign({}, sides[side]);
  let killed = null;
  sd.board = (sd.board || []).map(b => {
    if(b.uid !== uid) return b;
    const before = allyLife(b);
    const after = before - amount;
    if(after <= 0){ killed = b; return Object.assign({}, b, {life: 0, _dead: true}); }
    return Object.assign({}, b, {life: after});
  });
  if(killed){
    msgs.push(killed.card.name + " takes " + amount + " and goes down.");
    sd.board = sd.board.filter(b => !b._dead);
    sd.grave = [Object.assign({}, killed.card), ...(sd.grave || [])];
  } else {
    const now = (sd.board.find(b => b.uid === uid) || {});
    msgs.push("Ally takes " + amount + (now.life != null ? " — " + now.life + " life left." : "."));
  }
  sides[side] = sd;
  return {game: Object.assign({}, game, {sides}), msgs, killed: killed ? killed.card.name : null};
}

/* CR 4.4.3a — "Allies' life totals reset to base" in the end phase. */
function resetAllyLife(game, side){
  const sides = game.sides.slice();
  const sd = Object.assign({}, sides[side]);
  sd.board = (sd.board || []).map(b => isAlly(b) && b.life != null
    ? Object.assign({}, b, {life: allyBaseLife(b)}) : b);
  sides[side] = sd;
  return Object.assign({}, game, {sides});
}

/* ============================================================
   RUNECHANTS (the printed token, verbatim)

     Runechant — "Runeblade Token - Aura"
     "When you play an attack action card or activate a weapon attack,
      destroy this and deal 1 arcane damage to target opposing hero."

   Three things that text settles, and which the old integer counter got
   wrong or could not express at all:

   1. It is an AURA in the arena. It must be countable ("3 or more auras")
      and destroyable ("destroy an aura you control"). See parser.js
      `runeCount` / `auraCount` for why that is not cosmetic.

   2. Each runechant is its OWN source: each destroys itself and deals 1.
      They all trigger, and the trigger is not optional — there is no
      "you may". So they pop all at once and mandatorily.

   3. The trigger is "when you PLAY an attack action card". A runechant
      that did not exist at the moment the attack was played never
      triggered for it — so one created BY that attack (Viserai's rite
      firing on a Runeblade attack, or an on-hit forge) survives to the
      next swing. `popRunechants` therefore takes the count captured at
      play time rather than reading the board again at resolution.

   Being a triggered ability, the arcane damage resolves BEFORE the attack
   it triggered off: the trigger goes onto the stack above the attack.
   That is why the trainer pops at declaration, not at resolution.
   ============================================================ */
const isRunechantEntry = b => !!(b && b.card && String(b.card.name||"").toLowerCase() === "runechant");

/* Mint `n` runechant auras onto a side's board. `template` is the real
   token record from the card database (never invented — the golden rule),
   and `mkUid` issues the uids the loadout never handed out. */
function addRunechants(game, side, n, template, mkUid){
  if(!(n > 0) || !template) return game;
  const sides = game.sides.slice();
  const sd = Object.assign({}, sides[side]);
  const made = [];
  for(let i = 0; i < n; i++){
    /* NAMESPACE THE UID HERE, not at the call site. A sequence counter and
       the loadout's card numbering both start at 1, so a raw number collides
       with a real card: the first runechant minted took uid 1 and shared it
       with a deck card, and the invariant judge caught it in live play as
       CARD-IN-TWO-ZONES. Prefixing in the engine means no caller can repeat
       that — tokens get their own uid space by construction. */
    const seq = mkUid ? mkUid() : (i + "-" + Math.random().toString(36).slice(2));
    const uid = String(seq).indexOf("rune") === 0 ? String(seq) : "rune" + seq;
    made.push({card: Object.assign({}, template, {uid}), kind: "aura", spent: false, uid});
  }
  sd.board = [...(sd.board || []), ...made];
  sides[side] = sd;
  return Object.assign({}, game, {sides});
}

/* Destroy up to `limit` runechants and report the arcane damage they deal.
   `limit` is the count captured when the attack was PLAYED (see note 3):
   pass it and a runechant forged by this very attack correctly survives. */
function popRunechants(game, side, limit, dmgEach){
  const sd = game.sides[side];
  const board = (sd && sd.board) || [];
  const cap = limit == null ? board.filter(isRunechantEntry).length : Math.max(0, limit);
  if(!cap) return {game, popped: 0, damage: 0, cards: []};
  const sides = game.sides.slice();
  const s2 = Object.assign({}, sd);
  const popped = [];
  s2.board = board.filter(b => {
    if(popped.length < cap && isRunechantEntry(b)){ popped.push(b.card); return false; }
    return true;
  });
  /* A token that leaves the arena ceases to exist — it is not a real card
     and never enters a graveyard, so nothing is stamped or filed here. */
  sides[side] = s2;
  return {game: Object.assign({}, game, {sides}),
          popped: popped.length,
          damage: popped.length * (dmgEach == null ? 1 : dmgEach),
          cards: popped};
}

return {parseDeck, gearDef, gearBlockApply, slotOf,
        ARMOR_SLOTS, exposedZones, hasExposedZone,
        isAlly, allyBaseLife, allyLife, isAttackable,
        attackTargets, targetCanBeDefended, damageAlly, resetAllyLife,
        isRunechantEntry, addRunechants, popRunechants};
});
