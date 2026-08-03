/* ============================================================
   Dawnblade engine — types.js (Phase 1)

   WHAT A CARD *IS*, READ OFF ITS PRINTED TYPE LINE.

   The pool prints 138 distinct type lines across 405 cards. They look
   irregular and are not: every one of them is

       [classes and talents] <TYPE>… [ - <SUBTYPE>… ]

   and the rules that matter — where a card may be played from, in which
   window, what it costs, and where it goes afterwards — fall out of the
   TYPE, not out of the card's text. That is the whole point of this
   module: it is the half of Flesh and Blood that needs no text box.

   ---- WHY IT IS ITS OWN FILE -------------------------------------------

   The trainer asks type questions with a scatter of ad-hoc regexes —
   `isAttack`, `isAR`, `isDR`, `isInstantT`, `slotOf`, `isWeapon` — each
   reading the same printed string a slightly different way. That is
   survivable while the questions are few and it is exactly how a card
   ends up legal in one place and illegal in another. `rxAllowed` exists
   because FIVE hand-rolled copies of "may this be played here" had
   drifted apart, and the drift showed up as a card that looked playable
   and did nothing when tapped.

   So the line is parsed ONCE, into a structure, and every question is
   asked of that.

   ---- THREE THINGS THE POOL PRINTS THAT A NAIVE READER GETS WRONG -------

   1. **A card can have TWO types.** `Assassin / Warrior Action Defense
      Reaction - Trap` (Den of the Spider, Lair of the Spider) is an
      Action *and* a Defense Reaction — playable in the action phase for
      an action point, or in the defence window for none. A reader that
      matches one type and stops refuses the card half the time.

   2. **`Block` is a type, and it has no play.** Four cards — Test of
      Might, Test of Strength, On the Horizon, Crash and Bash. They print
      no cost, print 4 defence, and every one of them reads "When this
      defends, …". They may be pitched or declared as defenders. Treating
      them as ordinary non-attack actions makes them free 0-cost plays
      that do nothing.

   3. **`Reaction` contains the substring `action`.** Any type scan that
      is not word-boundary-anchored and longest-first reads `Warrior
      Attack Reaction` as an Action.

   ---- AND ONE THAT LOOKS LIKE A RULE AND IS NOT ------------------------

   **A null cost does NOT mean unplayable.** Equipment, Weapons and
   Blocks print no cost, so it is tempting to make "no printed cost" the
   test for "cannot be played". Two real cards break it: `Ice Eternal`
   (Elemental Wizard Action) and `Night's Embrace` (Assassin Attack
   Reaction) both carry `cost: null` in the database because their cost
   is X or simply absent from the record. Refusing them would kill two
   playable cards to save writing down a type list.

   Playability is decided by TYPE. Always.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnTypes = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* The CR card types the pool prints. Ordered LONGEST-FIRST because the
   scan is greedy and "Reaction" contains "action": matching `\bAction\b`
   before `\bAttack Reaction\b` turns every reaction into an action. */
const CARD_TYPES = [
  "Attack Reaction", "Defense Reaction",
  "Action", "Instant", "Equipment", "Weapon", "Block",
  "Hero", "Token", "Resource", "Macro"
];

/* Subtypes that change what a card DOES rather than what it is. The
   three permanent ones are the reason this module exists at all: an
   Aura, an Item and an Ally do not go to a graveyard when they resolve,
   they go to the arena, and nothing in the trainer's type helpers can
   say so. */
const PERMANENT_SUBTYPES = ["Aura", "Item", "Ally", "Landmark"];
const SUBTYPES = ["Attack", "Arrow", "Trap", "Demi-Hero", "Figment"].concat(PERMANENT_SUBTYPES);

/* Equipment slots, as the type line spells them, mapped to the zone
   names game.js's `slotOf` already uses so the two cannot disagree. */
const SLOT_WORDS = {
  "head": "head", "chest": "chest", "arms": "arms", "legs": "legs",
  "off-hand": "off", "offhand": "off", "quiver": "qvr"
};

const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

/* A DOUBLE-FACED CARD'S TYPE LINE CARRIES BOTH FACES — "Runeblade Action
   // Earth Instant". You play the FRONT face; the back is reachable only
   by melding. Reading the whole line called `Arcane Seeds // Life` and
   `Burn Up // Shock` instants, which would have handed two real action
   cards a free action point (v2.39). Every type question is asked of the
   front face, here and in parser.js. */
const frontFace = line => clean(line).split("//")[0];

/* ---- the parse --------------------------------------------------------
   Returns a structure, never a boolean. Callers ask it questions.

   THE STRUCTURED ARRAY WINS. `card.ty` is the database's own `types`
   field — a clean list like ["Assassin","Warrior","Defense Reaction",
   "Trap"] — and `card.tt` is `type_text`, a string for humans to read.
   They disagree on 5 of 4,862 database records, and reading the string
   got a live rule wrong:

     Den of the Spider  tt: "Assassin / Warrior Action Defense Reaction - Trap"
                        ty: ["Assassin","Warrior","Defense Reaction","Trap"]

   A REACTION CANNOT BE AN ACTION. The stray word in the printed line
   made a defence reaction playable in the action phase for an action
   point — sev-3 "illegal play allowed", and invisible to every
   card-level tool because the card's TEXT was read perfectly. The class
   words ("Assassin / Warrior") say who may DECK the card, not what it is.

   Parsing `tt` is kept only as the fallback for a record with no `ty`:
   a warm cache from before DATA_VER sage-v11, or a hand-built fixture. */
function cardType(c){
  const obj  = typeof c === "object" && c ? c : null;
  const raw  = typeof c === "string" ? c : (obj && obj.tt) || "";
  const line = frontFace(raw);
  const dash = line.split(/\s+[-—]\s+/);
  const left = dash[0] || "";
  const right = dash.slice(1).join(" ");

  /* A DOUBLE-FACED CARD FLATTENS ITS FACES IN THE ARRAY, and that is the
     one place the display string knows more than the structured field:

       Arcane Seeds // Life   tt ["Runeblade Action" // "Earth Instant"]
                              ty ["Runeblade","Action","Earth","Instant"]

     Only the string keeps the "//" boundary. You play the FRONT face —
     the back is reachable only by melding — so reading the flat array
     would call two real action cards instants and hand each of them a
     free action point (the v2.39 bug, exactly). Eleven DFCs are in the
     database and two are in the pool. For those, parse the front face. */
  const dfc = raw.indexOf("//") >= 0;
  const arr = (!dfc && obj && Array.isArray(obj.ty) && obj.ty.length) ? obj.ty.map(String) : null;

  const has  = w => arr.some(a => a.toLowerCase() === w.toLowerCase());
  const hasS = w => new RegExp("\\b" + w.replace(/[-\s]/g, "[-\\s]") + "\\b", "i");

  /* TYPES and SUBTYPES. From the array when there is one; otherwise
     greedily and longest-first off the display string, which is what
     makes "Reaction" stop being read as "Action". */
  const types = [], subtypes = [];
  let scan = left;
  for(const t of CARD_TYPES){
    if(arr ? has(t) : hasS(t).test(scan)){ types.push(t); if(!arr) scan = scan.replace(hasS(t), " "); }
  }
  for(const s of SUBTYPES) if(arr ? has(s) : hasS(s).test(right)) subtypes.push(s);

  /* SLOT, SHAPE and HANDS. The array carries all three as plain entries
     ("Warrior","Weapon","Sword","2H"); the string carries them after the
     dash. Hands come from the 1H/2H marker either way — NOT from a shape
     list, which varies by set and would mis-slot the first new shape a
     future set prints. */
  let slot = null;
  if(arr){
    for(const k of Object.keys(SLOT_WORDS)) if(has(k)){ slot = SLOT_WORDS[k]; break; }
  } else {
    const key = clean(right).toLowerCase().replace(/\s*\(.*$/, "");
    if(SLOT_WORDS[key]) slot = SLOT_WORDS[key];
  }

  const hm = arr ? (arr.find(a => /^\dH$/i.test(a)) || "").match(/(\d)/)
                 : right.match(/\((\d)H\)/i);
  let hands = hm ? +hm[1] : 0;
  if(types.indexOf("Weapon") >= 0 && !hm) hands = 1;   /* an unmarked weapon is one-handed */
  if(slot === "off") hands = 1;
  if(slot === "qvr") hands = 0;
  if(types.indexOf("Weapon") >= 0 && !slot) slot = hands === 2 ? "2h" : "1h";

  /* CLASSES AND TALENTS — whatever is left once every word the rules use
     has been accounted for. "Assassin / Warrior" says who may DECK the
     card and how other cards refer to it; it says nothing about what the
     card IS, which is the mistake that started this. */
  const known = new Set(CARD_TYPES.concat(SUBTYPES, Object.keys(SLOT_WORDS)).map(x => x.toLowerCase()));
  const isMeta = w => known.has(String(w).toLowerCase()) || /^\dH$/i.test(w);

  /* The weapon SHAPE and the hero CLASS are both plain words in the array
     ("Warrior","Weapon","Sword","2H") and nothing in the array tells them
     apart. The display string does: the shape is printed after the dash,
     the classes before it. So the shape is read off the string in both
     paths and the matching array entry is then excluded from the classes.
     No shape LIST is involved, which is what stops the first new shape a
     future set prints from being filed as a hero class. */
  const shapeWord = types.indexOf("Weapon") >= 0
    ? (clean(right.replace(/\(.*$/, "")) || null)
    : null;
  const isShape = w => shapeWord != null && String(w).toLowerCase() === shapeWord.toLowerCase();

  const classGroups = clean(left).split("/").map(x => clean(x)).filter(Boolean)
    .map(x => x.split(" ").filter(w => w && !isMeta(w) && !isShape(w)));
  const classes = arr
    ? arr.filter(a => !isMeta(a) && !isShape(a))
    : [...new Set([].concat(...classGroups))];

  return {line, classes, classGroups, types, subtypes, slot, shape: shapeWord, hands};
}

/* ---- the questions ----------------------------------------------------
   Every one of these takes a card or a parsed type, so a caller never has
   to remember which. */
const T = x => (x && x.types) ? x : cardType(x);
const hasType    = (c, t) => T(c).types.indexOf(t) >= 0;
const hasSubtype = (c, s) => T(c).subtypes.indexOf(s) >= 0;

const isAction   = c => hasType(c, "Action");
const isInstant  = c => hasType(c, "Instant");
const isAR       = c => hasType(c, "Attack Reaction");
const isDR       = c => hasType(c, "Defense Reaction");
const isEquipment= c => hasType(c, "Equipment");
const isWeaponType = c => hasType(c, "Weapon");
const isBlock    = c => hasType(c, "Block");
const isAttack   = c => hasSubtype(c, "Attack");
const isPermanent= c => T(c).subtypes.some(s => PERMANENT_SUBTYPES.indexOf(s) >= 0);
const isAllyCard   = c => hasSubtype(c, "Ally");
const isAura     = c => hasSubtype(c, "Aura");
const isItem     = c => hasSubtype(c, "Item");

/* ---- what a card can DO ----------------------------------------------
   THE THREE THINGS THAT ARE TRUE OF EVERY CARD IN HAND, whatever it is:

     it can be PITCHED for its printed pitch value (CR: a card played as
       a resource) — every card in the pool prints one;
     it can be DECLARED AS A DEFENDER if it prints defence and is not a
       defence reaction (CR 7.3.2, CR 8.1.3a);
     it can be DISCARDED.

   Everything below is about the fourth thing — being PLAYED — which is
   the only one that depends on what the card is. */

/* Equipment is EQUIPPED, not played: it starts in the gear zone and
   never leaves it. A Weapon is equipped too, and ACTIVATED from there. A
   Block has no play at all — it may only be pitched or defended with.
   Everything else has a play. */
const NO_PLAY = ["Equipment", "Weapon", "Block", "Hero", "Token"];
const isPlayable = c => {
  const t = T(c);
  if(!t.types.length) return false;
  if(t.types.every(x => NO_PLAY.indexOf(x) >= 0)) return false;
  /* AND A TYPE WITH NO PLAY *WINDOW* HAS NO PLAY EITHER, whatever else
     it is. `Inner Chi` is a `Mystic Resource - Chi`: no printed cost, no
     rules text, a pitch value of 3, and no entry in `playWindows` — the
     only thing a player can do with it is pitch it. It reported playable
     here while `playWindows` returned [], so it was refused two steps
     later with "cannot be played in the action phase", which reads like
     a timing problem rather than what it is.

     Deciding this from the window table instead of lengthening NO_PLAY is
     what stops the two from disagreeing — a type added to one list and
     forgotten in the other is precisely the drift this module exists to
     end, and it is how `rxAllowed`'s five hand-rolled copies got out of
     step with each other. */
  return playWindows(t).length > 0;
};

/* Why a type has no play, in words a player can act on. Returning the
   reason rather than a bare false is what stops a dead tap: the UI can
   say "equipment is worn, not played" instead of silently doing nothing. */
function noPlayReason(c){
  const t = T(c);
  if(isPlayable(t)) return null;
  if(t.types.includes("Weapon")) return "a weapon is equipped and activated, not played";
  if(t.types.includes("Equipment")) return "equipment is worn, not played";
  if(t.types.includes("Block")) return "a block card can only be pitched or declared as a defender";
  if(!t.types.length) return "no printed card type";
  /* No play window at all — a Resource card is the pool's one example. */
  if(!playWindows(t).length) return "a " + t.types[0].toLowerCase() + " card can only be pitched";
  return t.types[0] + " cards are not played from hand";
}

/* WHICH WINDOWS THIS CARD MAY BE PLAYED IN, as priority.js names them.
   A card with TWO types gets BOTH windows, which is the whole reason
   this returns a list — Den of the Spider is an `Action Defense
   Reaction` and is legal in the action phase AND in the defence window. */
function playWindows(c){
  const t = T(c);
  const w = [];
  if(t.types.includes("Action")) w.push("action");
  if(t.types.includes("Instant")) w.push("instant");
  if(t.types.includes("Attack Reaction")) w.push("attack-reaction");
  if(t.types.includes("Defense Reaction")) w.push("defense-reaction");
  return w;
}

/* CR 8.1.1 / 8.1.6 — an ACTION card costs an action point to play; an
   instant and a reaction do not. A dual-typed card costs one only when
   it is being played AS an action, which is why the window is an
   argument rather than a property of the card. */
function typeCostsAP(c, window){
  const t = T(c);
  if(window && window !== "action") return false;
  if(t.types.includes("Action")) return true;
  /* an equipment ability carrying "Instant - …" is marked by the builder */
  return false;
}

/* WHERE IT GOES WHEN IT RESOLVES.

     an ATTACK goes onto the combat chain and is filed at the close step
     an AURA / ITEM / ALLY stays on the board as a permanent
     everything else goes to its controller's graveyard

   Getting this wrong is not subtle: a permanent that resolves to the
   graveyard is a card the player paid for and never receives. */
function destination(c){
  const t = T(c);
  if(isAttack(t)) return "chain";
  if(isPermanent(t)) return "arena";
  return "grave";
}

/* The board entry kind, for a permanent. game.js's ally helpers key off
   `kind === "ally"`, so the names have to agree. */
function permanentKind(c){
  const t = T(c);
  if(isAllyCard(t)) return "ally";
  if(isAura(t)) return "aura";
  if(isItem(t)) return "item";
  return "permanent";
}

return {CARD_TYPES, SUBTYPES, PERMANENT_SUBTYPES, SLOT_WORDS, NO_PLAY,
        cardType, frontFace, hasType, hasSubtype,
        isAction, isInstant, isAR, isDR, isEquipment, isWeaponType, isBlock,
        isAttack, isPermanent, isAllyCard, isAura, isItem,
        isPlayable, noPlayReason, playWindows, typeCostsAP, destination, permanentKind};
});
