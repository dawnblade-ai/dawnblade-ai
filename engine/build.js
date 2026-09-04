/* ============================================================
   Dawnblade engine — build.js (Phase 1)

   HOW A SEAT BECOMES A HERO.

   Everything here used to live in index.html: `buildSide` at 1847, the
   equipment slot rules at 4527. Both are RULES — `buildSide` reads a
   hero's printed passives off its own text, resolves every printing, and
   deals the opening deck from the seeded stream; `defaultPicks` decides
   how many pieces of iron a hero may legally wear. Neither had a drill,
   because inside the trainer no drill could reach them.

   That cost a real bug in v2.41. The opponent was equipped by passing
   `{}` for its loadout, which handed Azalea all EIGHT printed pieces
   where the slot rules allow about five — and since `chainBlocked` only
   stops a piece re-blocking the SAME chain, every extra piece was another
   free block later in the turn. Every card was read correctly; the
   QUANTITY was illegal, which is a question neither `npm run audit` nor
   `npm run fairness` asks. Only opening the game and reading the dealt
   state found it.

   One set of slot rules, in one file, reachable by a drill, applied to
   both seats. That is the whole point of moving it.

   ---- SYMMETRY IS THE CONTRACT ----------------------------------------

   `buildSide` takes a hero and returns a build. It has no idea which seat
   it is filling and there is no seat argument. Seat 0 and seat 1 are the
   same call with different arguments, which is what makes a second human
   — or a second hero — cost nothing at all.

   PURITY: the only randomness is the `rng` handed in, and the shuffled
   stream is returned beside the build so the caller can thread it on
   (rng.js's rule: store it back, or the next draw repeats).
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./parser.js"), require("./cards.js"),
                             require("./game.js"), require("./rng.js"));
  else root.DawnBuild = factory(root.DawnParser, root.DawnCards, root.DawnGame, root.DawnRNG);
})(typeof self!=="undefined" ? self : this, function(PR, CD, GM, RNG){

const {clean, isWeapon, weaponCost, isAttack, fxParse, hasKw, parseHeroPower, isCloaked, ARS_PUT} = PR;
const {resolveEntry, resolveHero, cdnImg} = CD;
const {slotOf} = GM;

/* ---- the equipment slots (official zones) -----------------------------
   Four armour slots and two hands. A quiver is free but needs a bow in
   those hands to hang arrows on. */
const ARMOR_Z = ["head","chest","arms","legs"];
const HAND_Z  = ["1h","2h","off","qvr"];

/* `list` is [{i, c, s}] — an index, the resolved card, and its slot.
   `gearSlots` builds it so no caller has to remember the shape. */
const gearSlots = cards => (cards||[]).map((c,i)=>({i, c, s:slotOf(c)}));

/* Toggle piece `i` in `sel`, evicting whatever it displaces. This is the
   legality of a loadout expressed as a transition rather than a checker,
   which is what lets the loadout screen and the auto-equipper share it. */
function applyPick(list, sel, i){
  const item = idx => list.find(x=>x.i===idx);
  if(sel.includes(i)){
    let out = sel.filter(x=>x!==i);
    /* dropping the two-hander drops the quiver with it — a quiver with no
       bow to hang on is not a legal board */
    if(item(i).s.z==="2h") out = out.filter(x=>item(x).s.z!=="qvr");
    return out;
  }
  const s = item(i).s;
  let out = sel.slice();
  if(ARMOR_Z.includes(s.z) || s.z==="misc"){
    if(ARMOR_Z.includes(s.z)) out = out.filter(x=>item(x).s.z!==s.z);
    const armorN = out.filter(x=>ARMOR_Z.includes(item(x).s.z)||item(x).s.z==="misc").length;
    if(armorN>=4) return sel;
    return [...out,i];
  }
  if(s.z==="qvr"){
    out = out.filter(x=>item(x).s.z!=="qvr");
    if(!out.some(x=>item(x).s.z==="2h")) return sel;
    return [...out,i];
  }
  if(s.z==="2h"){
    out = out.filter(x=>!["1h","off"].includes(item(x).s.z));
    return [...out,i];
  }
  out = out.filter(x=>item(x).s.z!=="2h" && item(x).s.z!=="qvr");
  if(s.z==="off") out = out.filter(x=>item(x).s.z!=="off");
  let hands = out.filter(x=>["1h","off"].includes(item(x).s.z));
  hands.sort((a,b)=>(item(a).s.z==="off"?0:1)-(item(b).s.z==="off"?0:1));
  while(hands.reduce((a,x)=>a+item(x).s.h,0) + s.h > 2){ out = out.filter(x=>x!==hands[0]); hands = hands.slice(1); }
  return [...out,i];
}

/* A sensible legal loadout: the best armour in each slot, then the best
   weapon configuration the hands allow.

   ---- A BOW PRINTS NO POWER, AND THAT USED TO DISQUALIFY IT ------------

   This gated the two-hander on `twoH.c.power != null`. Azalea's Death
   Dealer is a `Ranger Weapon - Bow (2H)` with `power: null`, so she
   defaulted to NO WEAPON AND NO QUIVER — for the player's own loadout as
   much as the opponent's. The check was never doing any work: `slotOf`
   only returns `z:"2h"` for a printed `2H` type line, so anything in that
   list is already a two-handed weapon. It is gone.

   The sort is unchanged and still correct with bows in it: `power||0`
   ranks a printed sword above a powerless bow when a hero owns both, and
   picks the bow when it is the only two-hander on offer. */
function defaultPicks(list){
  let sel = [];
  ARMOR_Z.forEach(z=>{
    const best = list.filter(x=>x.s.z===z).sort((a,b)=>(b.c.def||0)-(a.c.def||0))[0];
    if(best) sel = applyPick(list, sel, best.i);
  });
  const twoH = list.filter(x=>x.s.z==="2h").sort((a,b)=>(b.c.power||0)-(a.c.power||0))[0];
  if(twoH){
    sel = applyPick(list, sel, twoH.i);
    const q = list.find(x=>x.s.z==="qvr"); if(q) sel = applyPick(list, sel, q.i);
  } else {
    list.filter(x=>x.s.z==="1h").sort((a,b)=>(b.c.power||0)-(a.c.power||0)).slice(0,2).forEach(x=>{ sel = applyPick(list, sel, x.i); });
    const off = list.filter(x=>x.s.z==="off").sort((a,b)=>(b.c.def||0)-(a.c.def||0))[0];
    if(off) sel = applyPick(list, sel, off.i);
  }
  return sel;
}

/* ---- THE AGENTS OF CHAOS (v3.76) ------------------------------------
   "You become a random Agent of CHAOS." The set is derived from two
   printed things and a list nobody wrote down:

     the CLASS   named by the sentence itself, and carried on the build
                 as `becomeAgent` rather than hardcoded here
     Demi-Hero   the printed TYPE, read off the STRUCTURED ARRAY, which
                 is this project's stated authority over `tt` (v2.44)

   THE DATABASE CANNOT NAME "AGENT OF CHAOS" — no type, no subtype and no
   `type_text` in 4,952 records contains the word "Agent" — so a hand-list
   would be inventing card text at the SET level. Measured over the whole
   live database: exactly six Demi-Heroes carry Chaos, and they are
   exactly the six Arakni's own `referenced_cards` names.

   SORTED BY NAME, because "random" must be reproducible: the caller picks
   an index out of the seeded stream, and an unstable order would make two
   peers replaying one log become different Agents (v2.26). */
function agentsOf(db, cls){
  if(!db || db.status !== "ready" || !cls) return [];
  const want = String(cls).toLowerCase();
  const out = [];
  for(const k of Object.keys(db.byName || {}))
    for(const c of (db.byName[k] || [])){
      const ty = (c.ty || []).map(t => String(t).toLowerCase());
      if(ty.indexOf("demi-hero") < 0) continue;
      if(ty.indexOf(want) < 0) continue;
      if(out.some(x => x.n === c.n)) continue;
      out.push(c);
    }
  return out.sort((a, b) => String(a.n).localeCompare(String(b.n)));
}

/* ---- THE HALF OF A BUILD THAT COMES OFF THE HERO'S PRINTED LINE ------
   Extracted at v3.76 because a hero can now CHANGE mid-game: Arakni
   prints "you become a random Agent of Chaos", and an Agent is a
   Demi-Hero with its own ability, its own passives and its own powCard.

   Everything else about the build — the deck, the gear, the life, the
   intellect — survives the change untouched, which is what the printed
   cards say: every Agent carries `health: "*"` and `intelligence: 4`, and
   Arakni prints intellect 4, so becoming one swaps the ABILITY and
   nothing else.

   ONE BODY, TWO CALLERS. `buildSide` calls it once at deal time and the
   transformation calls it again on the swap — a second copy of the
   passive readers is the no-mirror rule broken in the one place where the
   two answers would be about different heroes.

   `startItem` is deliberately NOT here: it mutates the deck, so it is a
   deal-time thing and an Agent cannot bring one. */
function heroAbilities(heroRec, displayName, code){
  heroRec = heroRec || {};
  /* THE HERO PASSIVES ARE PER-SIDE, and that is the point of this whole
     function. Read off THIS hero's printed text, so seat 1's Viserai
     conjures seat 1's runechants. */
  const _htx = clean(heroRec.tx||"").toLowerCase();
  const arsenalInstant = /play blue[^.]*non-attack[^.]*action cards from your arsenal as though/.test(_htx);
  const iceFrostbite = /ice card during an opponent.{0,4}turn.{0,4}create a frostbite/.test(_htx);
  const viseraiPassive = /whenever you play a runeblade card, if you.{0,15}played another.{0,8}non-attack.{0,8}action card this turn, create a runechant/.test(_htx);
  /* BLAZE, CLAUSE 1 (v3.39) — "Whenever you opt, put energy counters on
     Blaze equal to the number of cards looked at this way." A boolean:
     the COUNT is the number the opt itself looked at, which only the opt
     site knows. Clause 2 is his activated ability and is read by
     `parseHeroPower` off the same printed text. */
  const energyOnOpt = /whenever you opt, put energy counters on [a-z, ]+ equal to the number of cards looked at this way/.test(_htx);
  /* RULING 2026-07-25: "gravy bones' hero ability allows you to play watery
     grave cards" — and his printed text names the condition exactly:
     a blue card must have hit your graveyard this turn. */
  const wateryGrave = /if a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard/.test(_htx);
  /* LYATH: "Whenever the crowd boos you, create a Might token." */
  const lyathBoo = /whenever the crowd boos you, create a might token/.test(_htx);
  /* BRIAR — "Essence of Earth and Lightning", and both clauses mint a
     token, which is what makes the Embodiments her deck's engine rather
     than decoration.

     THE TOKEN'S NAME IS READ OFF THE TEXT, not stored as a boolean and
     named again at the mint site. Kayo's clause 2 set the precedent for
     reading a clause's own MAGNITUDE ("get +1{p}") rather than hardcoding
     it; a token's name is the same kind of fact, and writing "Embodiment
     of Earth" into `effects.js` would be inventing card text one level up.
     The mint site therefore names no token at all — it mints whatever the
     hero's printed line says.

     Both are per-TURN latches ("each turn"), unlike Kayo's, which is per
     ACTION PHASE and says so. Do not copy one onto the other.

     THE NAME IS CAPTURED WITH ITS PRINTED CAPITALISATION, off the raw
     text rather than the lowercased copy every other recogniser here
     reads. `resolveEntry` returns the ENTRY's name, not the database
     record's, so a lowercased capture rides all the way onto the board
     and the player is dealt a card called "embodiment of lightning".
     Driving it is what showed that; the whole suite was green. */
  const _htxRaw = clean(heroRec.tx || "");
  const _earth = _htxRaw.match(
    /the first time an attack action card you control deals damage to an opposing hero each turn, create an? ([A-Za-z][A-Za-z' -]*?) token/i);
  const earthOnFirstHeroDmg = _earth ? _earth[1].trim() : "";
  const _light = _htxRaw.match(
    /the second time you play a non-attack action card each turn, create an? ([A-Za-z][A-Za-z' -]*?) token/i);
  const lightningOnSecondNonAtk = _light ? _light[1].trim() : "";
  /* KAYO: "Attack action cards you own get +1{p} while they are in any zone
     other than the combat chain." Read the NUMBER off the text rather than
     hardcoding 1 — the clause names its own value, and inventing it here
     would be inventing card text. The combat-chain exclusion is what makes
     this a THRESHOLD rule and not a damage buff: see parser.zonePow, which
     is the only thing that consumes it. */
  const _offChain = _htx.match(/attack action cards you own get \+(\d+)\{p\} while they are in any zone other than the combat chain/);
  const atkPowOffChain = _offChain ? +_offChain[1] : 0;
  /* KAYO clause 3: "The first time you discard a card with 6 or more {p}
     during each of your action phases, create a Might token." A per-action-
     phase latch, not a per-turn one — RULING (user, 2026-08-08): a discard
     in the end phase or on the opponent's turn does NOT make Might. */
  const mightOnFirst6Discard = /the first time you discard a card with 6 or more \{p\} during each of your action phases, create a might token/.test(_htx);
  /* DORINTHEA: "Once per turn Effect - When a weapon you control hits, you
     may attack an additional time with that weapon this turn."

     This is her deck's engine the way Kayo's clause 2 was his: nearly every
     card in it either pumps a WEAPON attack or pays off a Reprise, and both
     want the blade swinging more than once.

     RULING (user, 2026-08-09): the ability waives the weapon's own "Once per
     Turn" limit and NOTHING ELSE. The additional activation is an ordinary
     action — it pays the weapon's printed {r} again and it spends an action
     point again. That is why the deck is dense with go again (Sharpen Steel,
     Warrior's Valor ×3, Hit and Run, Trot Along, Goblet of Bloodrun Wine):
     without one, the second swing has no action to spend.

     "That weapon" is literal — only the piece that hit is refreshed, so a
     hero holding two weapons does not get a free swing with the other. */
  /* TWO PRINTINGS, ONE ABILITY. Upstream rewrote this between v2.84 and
     v3.00 — "Once per turn Effect - When a weapon you control hits, …"
     became "The first time your weapon attack hits each turn, …" — moving
     the once-per-turn limit out of the prefix and into the sentence. The
     ENGINE already latched it on `hist.wpnAgain`, so the behaviour was
     right and only the reader was stale; a player on a warm localStorage
     cache is still holding the old wording, so both are read. */
  const weaponRefresh = /(?:when a weapon you control hits|the first time your weapon attack hits each turn), you may attack an additional time with that weapon this turn/.test(_htx);
  /* BOLTYN: "If you've charged this turn, your attacks get +1{p} while
     defended by an attack action card."

     HIS ONE MECHANIC IS THE SOUL, and this is the clause that pays for
     charging it. Two gates and they are answered in two different places:
     "you've charged this turn" is his own turn history, and "while
     defended by an attack action card" is a fact about the WALL, so it
     can only be settled once defenders are declared — `linkPumps`, beside
     the other late conditions (v3.71).

     THE NUMBER COMES OFF THE LINE, like Kayo's. A hardcoded 1 is right
     for this printing and silently wrong for the next one. */
  const _boltyn = _htx.match(
    /if you'?(?:ve| have) charged this turn, your attacks get \+(\d+)\{p\} while defended by an attack action card/);
  const chargedDefBuff = _boltyn ? +_boltyn[1] : 0;
  /* ARAKNI, WEB OF DECEIT: "Your attacks with stealth that are attacking
     a marked hero get +1{p} and \"When this hits, this gets go again.\""

     TWO GATES AND A RIDER, all settled at DECLARATION: whether the card
     PRINTS stealth, and whether the hero being attacked is marked. Neither
     is a wall-time question, so this is not a late condition — the mark is
     already on the opposing hero and stealth is a printed fact.

     `printedKw` IS THE PREDICATE, per the 2026-07-25 ruling and the atom
     `attackQual` already uses for "with stealth". Measured: 18 pool cards
     print it, 7 more only NAME it, and NOTHING in the pool grants it — so
     the loose reading would hand the bonus to seven cards that do not have
     the keyword at all.

     THE NUMBER COMES OFF THE LINE, like Kayo's and Boltyn's. */
  const _arakni = _htx.match(
    /your attacks with stealth that are attacking a marked hero get \+(\d+)\{p\}/);
  const stealthMarkedBuff = _arakni ? +_arakni[1] : 0;
  /* ---- ARAKNI CLAUSE 2 — THE AGENTS OF CHAOS (v3.76) ----------------
     "At the beginning of your end phase, if an opponent is marked, you
      become a random Agent of Chaos."
     …and every Agent prints "At the beginning of your end phase, return
     to the brood."

     THE CLASS COMES OFF THE PRINTED LINE. "Agent of CHAOS" names the
     class, and the six Agents are the pool's `Chaos … Demi-Hero`
     records — measured over the whole 4,952-record database: exactly
     six, and no other Demi-Hero carries Chaos.

     THE DATABASE CANNOT NAME "AGENT OF CHAOS" AS A TYPE. No `types`
     entry, no `subtypes` entry and no `type_text` anywhere contains the
     word "Agent". So the set is derived from the two things that ARE
     printed — the class the sentence names, and the Demi-Hero type —
     rather than from a list somebody wrote down, which is the same rule
     `pin-pool.js` follows for tokens.

     `becomeAgent` is the CLASS WORD, not a boolean, for the reason
     Briar's token name is a string (v3.21): storing `true` would move
     "Chaos" into `effects.js`, which is inventing card text one level
     up. */
  const _agent = _htx.match(
    /at the beginning of your end phase, if an opponent is marked, you become a random agent of ([a-z]+)/);
  /* THE EMPTY STRING, NOT NULL, for absent — `typeof null` is "object"
     and the ledger says this passive answers a string. Briar's two token
     names take the same shape for the same reason. */
  const becomeAgent = _agent ? _agent[1] : "";
  const returnToBrood = /at the beginning of your end phase, return to the brood/.test(_htx);
  /* ARAKNI, TARANTULA — one of the two Agents whose STATIC is readable:
     "Whenever a dagger you own hits a hero, they lose 1{h}."

     REACHABLE THE DAY IT IS BUILT. Mark of the Huntsman x2 is in Arakni's
     own gear and is a real swinging Dagger (power 1, "Once per Turn Action
     - {r}{r}: Attack"), and the Graphene Chelicera is a Token Weapon -
     Dagger — so the event exists on the board she plays with.

     WITHOUT IT, BECOMING AN AGENT IS A NET DOWNGRADE: she loses her own
     stealth passive and gains an ability nothing reads, which is faithful
     to what is built and is not what the cards do. */
  const _tara = _htx.match(
    /whenever a dagger you own hits a hero, they lose (\d+)\s*\{h\}/);
  const daggerDrain = _tara ? +_tara[1] : 0;
  /* LYATH GOLDMANE — THE BASE IS HALVED (v3.78) ---------------------
     "The base {p} and {d} of cards you control are halved, rounded up."

     THE ONLY UNFAIR ENTRY IN THE PROJECT since v3.21, and the only one
     that is a DRAWBACK: unbuilt, he plays strictly better than printed,
     which is the direction that steals games.

     THE PRINTING SETTLES THE ROUNDING and the database drops it. SLY001
     carries reminder text `functional_text` does not — *"(5 becomes 3.)"*
     — so it is `Math.ceil`, not floor and not round-half-even. Fourth
     time reading the card face has answered a question outright (Clash of
     Agility, Thunder Quake, Pick Up the Point). */
  const halveBase =
    /the base \{p\} and \{d\} of cards you control are halved/.test(_htx);
  /* ENIGMA'S CLAUSE 1 (v3.84) — "Your first Spectral Shield attack each
     turn costs {r} less to activate."

     REACHABLE ONLY NOW. Until Cosmo was built there was no such thing as
     a Spectral Shield attack, so this priced a play that could not
     happen — the whole reason her hero read 0 of 2.

     THE CARD NAME IS CAPTURED AS A STRING (v3.21's rule), because the
     printed line NAMES it: storing a boolean would move "Spectral Shield"
     into `parser.js`, which is inventing card text one level up. The
     AMOUNT is counted off the printed pips for the same reason. */
  const _fad = _htx.match(
    /your first (.+?) attack each turn costs ((?:\{r\})+) less to activate/);
  const auraDiscount = _fad
    ? {name: _fad[1].trim(), amt: (_fad[2].match(/\{r\}/g) || []).length}
    : null;
  const _dr = _htx.match(
    /this ability costs ((?:\{r\})+) less to activate for each draconic chain link you control/);
  const _dracRed = _dr ? (_dr[1].match(/\{r\}/g) || []).length : 0;
  const heroPow = heroRec.tx ? parseHeroPower(heroRec.tx) : null;
  /* THE HERO POWCARD CARRIES THE WHOLE ABILITY LINE (v3.39), which is the
     fix v2.34 made for EQUIPMENT and never made here: `parseHeroPower`
     stops at the first period, so a hero ability with a second sentence
     lost it.

     THE SOUL COST RIDES ON IT (v3.74), the way `sd` does for an equipment
     ability — `heroAbilityLine` strips the cost prefix, so a cost not
     carried here is a cost nothing can charge. OPT-IN (v3.58). */
  const _hEffFull = heroAbilityLine(heroRec, heroPow);
  const _nm = String(displayName || heroRec.n || "Hero").split(",")[0];
  /* THE CARD THE HERO ROW SHOWS. It is part of the ability half because a
     hero who has BECOME an Agent must show the Agent — its name, its type
     line and its printed text — or the mechanic is invisible and the
     zoomed card contradicts the ability the engine is running (v3.60's
     sev-2 category, where the feed and the state disagree).

     `code` is the DECK's printed code and an Agent has none, so the art
     falls back to the record's own first printing. */
  const HZOOM = {name: displayName || heroRec.n || "Hero", pitch:0, cost:null,
    power:null, def:null, tt:heroRec.tt||"Hero", kw:[], tx:heroRec.tx||"",
    img: code ? cdnImg(code) : null,
    dbImg: heroRec.pr ? heroRec.pr._first : null};
  const HPOW = heroPow ? Object.assign({name:_nm+" — hero power", pitch:0, cost:heroPow.cost, power:null, def:null,
    tt:"Hero Ability", kw:heroPow.ga?["Go again"]:[], tx:_hEffFull, _instant:heroPow.kind==="instant",
    _attackRx:heroPow.kind==="attackRx", img:null, dbImg:null, uid:"hpow"},
    heroPow.soul ? {_soulCost: heroPow.soul} : {},
    heroPow.selfBanish ? {_selfBanish: true} : {},
    /* GRAVY BONES — "{t}, destroy a Gold you control" (v3.86). The named
       permanent rides on the powCard the way the soul cost does, because
       `heroAbilityLine` strips the cost prefix: a cost not carried here is
       a cost nothing can charge, which is the free-ability bug v2.04
       fixed. OPT-IN (v3.58). */
    heroPow.destroyBoard ? {_destroyBoard: heroPow.destroyBoard} : {},
    heroPow.flipUp ? {_flipUp: true} : {},
    /* FAI — "this ability costs {r} less to activate for each DRACONIC
       CHAIN LINK you control" (v3.86). A DYNAMIC reduction: it depends on
       the chain, which is game state rather than a fact about the side,
       so `effCost` takes the count from the caller and this stamp says
       how much each link is worth. Read off the printed pips, never
       hardcoded (v3.21). */
    _dracRed ? {_dracDiscount: _dracRed} : {}) : null;
  return {heroRec, heroPow, HPOW, HZOOM,
    arsenalInstant, iceFrostbite, viseraiPassive, wateryGrave, lyathBoo, energyOnOpt,
    earthOnFirstHeroDmg, lightningOnSecondNonAtk,
    atkPowOffChain, mightOnFirst6Discard, weaponRefresh, chargedDefBuff, stealthMarkedBuff,
    becomeAgent, returnToBrood, daggerDrain, halveBase, auraDiscount};
}

/* ---- the build --------------------------------------------------------
   `h` is the hero entry (name, key, printed code), `d` is its parsed deck
   definition, `db` the card database, `opts` the loadout choices, `rng`
   the seeded stream and `ctr` the shared uid counter.

   `d` is a PARAMETER rather than a lookup because that is the difference
   between a pure function and one that reads the trainer's module scope.
   Two seats, two decks, one function. */
/* THE PRINTED ABILITY LINE, COST PREFIX STRIPPED — the powCard's `tx`.
   Exported (v3.71) because `tools/audit.js` has to ask the SAME question
   when it decides whether a hero clause is read: `parseHeroPower` answers
   about the FIRST sentence only, and everything after it is read by
   `fxParse` over this line. An audit that re-derived the line would be the
   no-mirror rule broken between a tool and the engine — and one that did
   not ask at all reports a built ability as unread, which is v3.21's
   one-sided ledger exactly. */
function heroAbilityLine(heroRec, heroPow){
  const line = ((heroRec && heroRec.tx) || "").split(/\n+/).map(l => clean(l))
    .find(l => /^(?:once per turn )?(?:action|instant)\s*[-—]/i.test(l)) || "";
  return line.replace(/^[^:]*:\s*/, "") || (heroPow ? heroPow.eff : "");
}

/* HALVE A CARD'S PRINTED BASE — Lyath Goldmane (v3.78) -----------------

   "The base {p} and {d} of cards you control are halved, rounded up.
    (5 becomes 3.)"

   IT IS SPENT AT THE DEAL, AND THAT IS THE WHOLE SAFETY ARGUMENT. The
   alternative was a `halve` flag threaded to every site that reads a base
   value — the attack declaration, `linkPumps`, `defendValue`, `gearDef`,
   the `pumped` condition, phantasm's 6-power popper, every prompt filter,
   and every total the player is shown. CLAUDE.md has said since v3.23
   that half-building a defensive value change is WORSE than the honest
   gap, because the number on screen then disagrees with the number that
   fought. Thirty threaded call sites is thirty chances to leave one out;
   the deal is one place and cannot be half-built.

   SO THE DISPLAY IS RIGHT FOR FREE, which is the point: a player looking
   at Lyath's hand sees the numbers his cards actually fight with.

   NON-DESTRUCTIVE. A new object, and the printed value is kept on
   `_printedPow`/`_printedDef` so a later display pass can show both. The
   stamp is OPT-IN (v3.58) — written only where the value actually MOVES,
   or every `deepEqual` on a card shape breaks for the fourteen heroes
   this does nothing to.

   `power` AND `def` ONLY. An ally prints power and LIFE, and life is not
   {d} — the card names two symbols and neither is health. (Measured: his
   list holds no allies, so this is latent, and a reader that halved life
   would be reading a third value the card never mentions.)

   THE COUNTERS ARE NOT PART OF THE BASE. `effects.js` folds a +1{p}
   counter into what it calls the swing's "base", and that is right there
   — a counter-bearing blade is a bigger weapon — but this line says
   BASE, which is the printed number before any modifier. So the printed
   value halves and the counter is added on top, unhalved. */
function halveCard(c, on){
  if(!on || !c) return c;
  const out = {...c};
  if(typeof c.power === "number" && c.power > 0){
    const h = Math.ceil(c.power / 2);
    if(h !== c.power){ out._printedPow = c.power; out.power = h; }
  }
  if(typeof c.def === "number" && c.def > 0){
    const h = Math.ceil(c.def / 2);
    if(h !== c.def){ out._printedDef = c.def; out.def = h; }
  }
  return out;
}

function buildSide(h, d, db, opts, rng, ctr){
  const o = opts || {};
  const heroRec = resolveHero(db, d.hero) || {};
  /* ONE BODY FOR THE ABILITY HALF (v3.76) — see `heroAbilities`. It is
     read here at deal time and again whenever the hero CHANGES. */
  const _ab = heroAbilities(heroRec, d.hero.name, d.hero.code);
  const heroPow = _ab.heroPow, HPOW = _ab.HPOW;
  const cuts = o.cuts||{};
  /* THIS HERO'S SILVER AGE SET, read off its own printed code (SAZ001 ->
     SAZ). Passed to every resolveEntry so a card wears the face it has in
     this deck's own precon rather than whatever printing the database
     happened to list first. See cards.js `pickPrinting`. */
  const saSet = (h.code||"").slice(0,3) || null;
  const _pd = RNG.shuffle(rng, d.deck.flatMap((e,ei)=>{
    const q = Math.max(0, e.q - (cuts[ei]||0));
    if(!q) return [];
    const c = halveCard(resolveEntry(db,e,saSet), _ab.halveBase);
    return Array.from({length:q},()=>({...c,uid:++ctr.n}));
  }));
  rng = _pd.rng;
  const deck = _pd.arr;
  /* THE GEAR IS HALVED AT THE SAME MOMENT, and it must be BEFORE the
     weapon-cost loop below and before any wear: `gearDef` reads `curDef`
     when one is set, so halving after a piece had been worn would halve
     the WORN value rather than the base. Halve first, wear from there. */
  const gearAll = d.gear.map((e,gi)=>Object.assign(
    halveCard(resolveEntry(db,e,saSet), _ab.halveBase), {gi,uid:++ctr.n,used:false}));
  const gear = o.gearIdx ? gearAll.filter(x=>o.gearIdx.includes(x.gi)) : gearAll;
  gear.forEach(gr=>{
    /* ---- CLOAKED: "EQUIP THIS FACE-DOWN" (v3.99) --------------------
       Read off the card's own PRINTED reminder line (ENG005) rather than
       guessed, and stamped at the DEAL, where a piece becomes equipped —
       the one moment the property is about. `printedKw` is the question
       (v2.84's three): a card that merely mentioned the keyword must not
       be equipped face-down, which would be a rule invented at the
       keyword level.

       WHAT FACE-DOWN MEANS HERE IS DELIBERATELY NARROW, and that is the
       ruling rather than a shortcut (v3.48). It gates the ONE thing the
       card's own text spends it on — "turn this face-up" — and nothing
       else. Whether a face-down piece keeps its printed defence and its
       Ward 1 is not stated on the card, the database prints no CR text
       for it, and half-building a value change is worse than the honest
       gap (v3.23). Recorded in HANDOFF.md as the open half. */
    if(isCloaked(gr)) gr._faceDown = true;
    if(isWeapon(gr) && gr.tx){ const wc=weaponCost(gr.tx);
      if(wc){ if(gr.cost==null) gr.cost=wc.cost; gr.addRust=wc.addRust; gr.needSteam=wc.needSteam; }
      if(/is equal to 1 plus the number of times you have boosted/i.test(gr.tx)) gr._powBoost=true;
      if(wc && wc.needSteam){ gr.pow=true; gr.powCard={name:gr.name+" — build steam",pitch:0,cost:2,power:null,def:null,tt:"Equipment Ability",kw:["Go again"],tx:"Action - {r}{r}: Put a steam counter on this. Go again.",_buildSteam:true,_steamFor:gr.uid,ga:true,img:gr.img,dbImg:gr.dbImg,_gearArt:true,uid:"gp"+gr.uid}; }
    }
    /* A WEAPON CAN CARRY A NON-ATTACK ACTIVATED ABILITY (v2.34). Death
       Dealer is a Bow whose printed ability puts an arrow face up into your
       arsenal — it is not a weapon attack, so `weaponCost` (which requires
       ": attack") never claimed it and the `!isWeapon` gate below skipped
       it, leaving the ability inert. The extra door is deliberately narrow:
       only an ability the arsenal reader actually recognises, so no other
       weapon quietly grows a second button nothing is wired to run. */
    const _armed = isWeapon(gr) && gr.tx && ARS_PUT.test(gr.tx);
    if((!isWeapon(gr) || _armed) && gr.tx){ const pw=parseHeroPower(gr.tx, true);
    if(pw){ gr.pow=pw;
    /* The ability's WHOLE printed line, not just its first sentence.
       Knucklehead reads "Action - Destroy this: Roll a 6-sided die. Until
       end of turn, your base {i} is the number rolled." — parseHeroPower
       stops at the period, which orphaned the rider so it never fired.
       Strip the cost prefix off the line and keep the rest. */
    const _abLine = (gr.tx||"").split(/\n+/).map(l=>clean(l))
      .find(l=>/^(?:once per turn )?(?:attack reaction|action|instant)\s*[-—]/i.test(l)) || "";
    const _effFull = _abLine.replace(/^[^:]*:\s*/, "") || pw.eff;
    /* `_attackRx` IS THE WINDOW, and it is the third flag of its kind
       beside `_instant` and `sd`. It is not a printed type — the powCard's
       `tt` is "Equipment Ability" — so judge.js and the trainer ask it
       separately rather than reading it off a type line that does not
       carry it, exactly as they do for `_instant`. */
    /* THE SOUL COST IS STAMPED HERE TOO (v3.79), and until now it was NOT.
       v3.74 taught `parseHeroPower` the soul banish for BOLTYN's hero and
       stamped `_soulCost` on the HERO powCard alone — so an EQUIPMENT
       ability printing the same cost was built with the cost silently
       dropped, which is the free-ability bug v2.04 fixed. Radiant Touch
       is the card: "Instant - Banish this and a card from your soul".

       v3.63 states the rule in as many words — when you add a flag to one
       powCard builder, grep for the others. There are three (hero, here,
       and `boardPow`), and this is the second time that sentence has been
       needed. */
    gr.powCard=Object.assign({name:gr.name+" — ability",pitch:0,cost:pw.cost,power:null,def:null,
      tt:"Equipment Ability",kw:pw.ga?["Go again"]:[],tx:_effFull,sd:pw.sd,_instant:pw.kind==="instant",_attackRx:pw.kind==="attackRx",img:gr.img,dbImg:gr.dbImg,_gearArt:true,uid:"gp"+gr.uid},
      pw.soul ? {_soulCost: pw.soul} : {},
      pw.selfBanish ? {_selfBanish: true, _banishGear: gr.uid} : {},
      /* v3.63's rule, THIRD outing: when you add a flag to one powCard
         builder, grep for the others. No pool EQUIPMENT prints this cost
         today — measured, all 38 non-hero destroy costs say "destroy
         this" — so this is latent; `execute` reads the flag off the
         powCard without caring which builder stamped it, so a card that
         printed the shape would work rather than be silently free. */
      pw.destroyBoard ? {_destroyBoard: pw.destroyBoard} : {},
      /* v3.63's rule, FOURTH outing: when you add a flag to one powCard
         builder, grep for the others. Uphold Tradition is the pool's only
         record — an EQUIPMENT — so the hero builder and `boardPow` are
         given it as a guard rather than a fix, exactly as `_attackRx` was
         (v3.63) and `_destroyBoard` (v3.86). */
      pw.flipUp ? {_flipUp: true, _flipGear: gr.uid} : {}); } } });
  const _atk = deck.filter(isAttack);
  const _ga = deck.filter(c=>fxParse(c).ga).length;
  const _arc = deck.filter(c=>fxParse(c).ops.concat(fxParse(c).onHit).some(o2=>o2[0]==="arcane")).length;
  const _blue = deck.filter(c=>c.pitch===3).length;
  const _perm = deck.filter(c=>fxParse(c).perm).length;
  const _avg = _atk.length ? _atk.reduce((a,c)=>a+(c.power||0),0)/_atk.length : 0;
  const read = "Claude's read: "+_atk.length+" attacks avg "+_avg.toFixed(1)+" power, "+_ga+" go-again, "+_blue+" blue fuel"
    +(_arc?", "+_arc+" arcane":"")+(_perm?", "+_perm+" permanents":"")+". "+(function(){
      const cnt = k => deck.filter(c=>hasKw(c,k)).length;
      const soulN = deck.filter(c=>/into your (?:hero'?s? )?soul/i.test(c.tx||"")).length;
      const m = [["boost",cnt("boost")],["clash",cnt("clash")],["soul",soulN],["rune",deck.filter(c=>/runechant/i.test(c.tx||"")).length],["arcane",_arc],["ally",deck.filter(c=>fxParse(c).perm==="ally").length]].sort((a,b)=>b[1]-a[1])[0];
      const T = {boost:"Line: boost everything — each banish digs the deck and chains go again.",
        clash:"Line: bank blues, clash with fat tops, cash wins into free tempo.",
        soul:"Line: land hits to charge the soul, then spend it to break through.",
        rune:"Line: stack runechants on non-attacks, pop them all on one clean swing.",
        arcane:"Line: amp first, spell second — arcane ignores the iron.",
        ally:"Line: crew up early — every ally is free damage each turn after."};
      return (m && m[1]>=4) ? T[m[0]] : "Line: chain go again into your heaviest hit; block with threes.";
    })()+(heroPow?" Hero power online — "+heroPow.label+".":"");
  const hasBoost = deck.some(c=>hasKw(c,"boost"));
  let startItem = null, startGrave = null;
  if(/start the game with a mechanologist item with cost 2 or less/.test(clean(heroRec.tx||"").toLowerCase())){
    const ii = deck.findIndex(c=>/\bitem\b/i.test(c.tt||"") && (c.cost||0)<=2);
    if(ii>=0){ startItem = {card:deck[ii], kind:"item", spent:false, uid:deck[ii].uid}; deck.splice(ii,1); }
  }
  /* FAI — "You may start the game with a Phoenix Flame in your graveyard."
     (v3.86)

     DASH'S SHAPE, ONE ZONE OVER, and the second pregame passive in the
     pool. His is an ITEM into the ARENA; this is a NAMED card into the
     GRAVEYARD, which is where his whole engine reads from — his ability
     returns a Phoenix Flame from there to hand, so without this he has to
     draw and spend one before the ability does anything at all.

     THE NAME IS READ OFF THE PRINTED LINE (v3.21's rule), not hardcoded:
     a second hero printing the same shape for a different card gets the
     right card, and this file names none.

     IT IS SPLICED OUT OF THE DECK. A card in the graveyard AND in the
     deck is `CARD-IN-TWO-ZONES`, which the invariant judge exists for —
     the same reason Dash's item is spliced. And it is TURN-STAMPED with
     0: `_gy` answers the whole "…put into a graveyard this turn" family,
     and a card that was there before turn 1 must not satisfy it. */
  const _sg = clean(heroRec.tx||"").toLowerCase()
    .match(/you may start the game with an? (.+?) in your graveyard/);
  if(_sg){
    const want = _sg[1].trim();
    const gi = deck.findIndex(c => String(c.name||"").toLowerCase() === want);
    if(gi >= 0){ startGrave = Object.assign({}, deck[gi], {_gy: 0}); deck.splice(gi, 1); }
  }
  return {b:Object.assign({deck,gear,hasBoost,read,startItem,startGrave,
    hp:heroRec.hp!=null?heroRec.hp:20, int:heroRec.int!=null?heroRec.int:4}, _ab), rng};
}

/* Equip a hero to a legal default loadout and build it. The two seats
   differ only in their arguments — there is deliberately no seat index
   here, and no branch for "the opponent". */
function buildSideDefault(h, d, db, rng, ctr){
  const saSet = (h.code||"").slice(0,3) || null;
  const slots = gearSlots(d.gear.map(e => resolveEntry(db, e, saSet)));
  return buildSide(h, d, db, {gearIdx: defaultPicks(slots)}, rng, ctr);
}

/* ---- BOTH SEATS, FROM A SPEC AND A SEED (Phase 2) ---------------------

   The lobby agrees on four small values — two hero keys, two loadouts, a
   seating call and the table code. This is what turns them into two real
   hero decks, and the property that matters is that it does so
   IDENTICALLY ON BOTH PHONES. Nothing about a card crosses the wire: each
   peer runs this over its own card database and arrives at the same
   state, which is rng.js's own stated goal ("both peers derive the same
   seed from the same room code without exchanging it") applied to the
   whole opening rather than to one shuffle.

   Three things make it deterministic, and each is a real way to break it:

   1. THE STREAM IS SEAT-SPECIFIC. One stream for both seats deals seat 1
      the continuation of seat 0's shuffle — reproducible, but it means a
      change to seat 0's cuts silently reshuffles seat 1's deck.
   2. THE UID COUNTER IS SHARED AND THREADED IN SEAT ORDER, so no card in
      the match repeats a uid. `invariants.js` reports a repeat as
      CARD-IN-TWO-ZONES, which is how the runechant collision was caught
      in live play — the same hazard, one layer up.
   3. THE SEATS ARE BUILT IN INDEX ORDER, always. `map` over [0,1] rather
      than over anything derived from who is hosting: a build order that
      depends on the local seat produces two different games from one
      spec, and it would only show up as a hash mismatch on turn one.

   It has no idea which seat this client occupies, and it must not: that
   is `buildSide`'s contract kept one level up. */
const buildSeed = (code, i) => String(code == null ? 0 : code) + ":build:" + i;

/* ---- THE PUNCHING BAG -------------------------------------------------
   A SEAT THE DUMMY FILLS IS ALWAYS VANILLA (ruling, user, 2026-08-16).
   Seat 1 is either a person, who picks their own hero, or the dummy —
   and the dummy is a pile of Generic attack actions with no rules text,
   there for seat 0 to practise against. There is no third thing, and in
   particular there is no hero the dummy "plays as": that choice existed,
   was never load-bearing, and every branch it created had to be carried
   by the trainer, the loadout, the pregame and the table.

   THE DECK LIST IS DATA AND IS PASSED IN, exactly as `buildSide` takes
   `d` rather than looking it up. It lives in index.html's data script
   beside the hero decks; hardcoding thirty card names in the engine
   would make the pool two things instead of one, and a drill could then
   only check the copy it was told about.

   `hp` and `int` are the caller's too. They are the trainer's tuning,
   not a rule — 42 life is a training prop's number, and the engine has
   no opinion about how long a practice session should last.

   EVERY PASSIVE IS WRITTEN OUT AS FALSE rather than defaulted, which is
   the discipline `DUMMY_BUILD` has held since v2.41: a passive added to
   `buildSide` and forgotten here reads `undefined` at the call site
   instead of quietly reading as false on a real hero's turn. The drill
   over `PASSIVES` holds this build to the same list. */
function buildVanilla(list, gearNames, db, rng, ctr, o){
  o = o || {};
  const gear = (gearNames || []).map(nm => Object.assign(
    resolveEntry(db, {name: nm, p: 0, code: null, q: 1}), {uid: ++ctr.n, used: false}));
  const flat = (list || []).reduce((acc, e) => {
    const [nm, p, q] = e;
    for(let i = 0; i < (q || 1); i++)
      acc.push(Object.assign(resolveEntry(db, {name: nm, p, code: null, q: 1}), {uid: ++ctr.n}));
    return acc;
  }, []).filter(c => c.resolved);
  const sh = RNG.shuffle(rng, flat);
  const b = {
    deck: sh.arr, gear, hasBoost: false, read: "", heroPow: null, HPOW: null,
    HZOOM: null, heroRec: {},
    hp: o.hp != null ? o.hp : 42,
    int: o.int != null ? o.int : 4,
    _dummy: true
  };
  /* EVERY PASSIVE IS WRITTEN OUT IN ITS DECLARED TYPE (v2.41's rule), so
     a passive added to `buildSide` and forgotten here reads `undefined`
     at the call site instead of silently reading as false on a real
     hero's turn. `object` joined the list at v3.84 and answers `null`,
     for the same reason `string` answers "" — the empty value of the
     type, never a boolean standing in for it. */
  for(const p of PASSIVES)
    b[p] = PASSIVE_TYPE[p] === "number" ? 0
         : PASSIVE_TYPE[p] === "string" ? ""
         : PASSIVE_TYPE[p] === "object" ? null : false;
  return {b, rng: sh.rng};
}

/* `spec` is the lobby's matchSpec; `o` supplies the data the engine has
   no opinion about — the hero entries, the parsed decks and the card
   database, all passed in for the same reason `buildSide` takes `d` as a
   parameter rather than looking it up.

   A seat whose hero key is `null` is the DUMMY, and is built vanilla off
   `o.vanilla` ({deck, gear, hp, int}). Its stream, its place in the uid
   threading and its build order are identical to a hero's — the seat is
   filled differently, it is not a different KIND of seat, which is what
   keeps `judge.reduce` unable to tell them apart. */
function buildMatch(spec, o){
  o = o || {};
  const ctr = {n: o.ctr0 || 0};
  const builds = [0, 1].map(i => {
    const key = spec.heroes[i];
    const rng = RNG.make(RNG.seedFrom(buildSeed(spec.seed, i)));
    if(key == null){
      const v = o.vanilla;
      if(!v) throw new Error("buildMatch: seat " + i + " is the dummy and no vanilla pile was given");
      return buildVanilla(v.deck, v.gear, o.db, rng, ctr, v).b;
    }
    const h = o.heroes[key], d = o.decks[key];
    if(!h) throw new Error("buildMatch: no hero entry for " + key);
    if(!d) throw new Error("buildMatch: no deck for " + key);
    return buildSide(h, d, o.db, spec.boards[i] || {}, rng, ctr).b;
  });
  return {builds, first: spec.first, seed: spec.seed,
          heroKeys: spec.heroes.slice(),
          names: spec.heroes.map(k => k == null
            ? ((o.vanilla && o.vanilla.name) || "The Dummy")
            : ((o.heroes[k] && o.heroes[k].n) || k)),
          tokSeq: 0, uidHigh: ctr.n};
}

/* The passives a build is expected to answer for. A rules site reads
   these through `bAct` — the build of whoever is RESOLVING — never off a
   captured seat-0 build, which is the bug v2.41 fixed. Listed here so a
   drill can assert every build answers all of them: a passive added to
   `buildSide` and forgotten elsewhere then fails loudly instead of
   reading as a silent `false` on a real hero's turn. */
const PASSIVES = ["arsenalInstant","iceFrostbite","viseraiPassive","wateryGrave","lyathBoo",
                  "atkPowOffChain","mightOnFirst6Discard","weaponRefresh",
                  "earthOnFirstHeroDmg","lightningOnSecondNonAtk","energyOnOpt",
                  "chargedDefBuff","stealthMarkedBuff","becomeAgent","returnToBrood",
                  "daggerDrain","halveBase","auraDiscount",
                  /* THE TWO PREGAME PLACEMENTS (v3.86). `startItem` has
                     been a build field since Dash and was never in this
                     list, so the census SKIPPED it — a HERO_STATICS row
                     naming a build fact nothing verified, which is v3.21's
                     one-sided ledger in the other direction. Adding Fai's
                     `startGrave` is what made that visible. */
                  "startItem","startGrave"];

/* NOT EVERY PASSIVE IS A YES/NO. Most are — a hero either has Watery Grave
   or does not — but Kayo's clause 2 names its own MAGNITUDE ("get +1{p}"),
   and storing that as `true` would mean hardcoding the 1 somewhere else,
   which is inventing card text one level up. So the ledger records the
   TYPE each passive answers in, and a drill holds every build to it: a
   hero that answers `undefined` still fails, which is the property the
   original boolean check was actually protecting. */
const PASSIVE_TYPE = {
  arsenalInstant: "boolean", iceFrostbite: "boolean", viseraiPassive: "boolean",
  wateryGrave: "boolean", lyathBoo: "boolean", mightOnFirst6Discard: "boolean",
  energyOnOpt: "boolean",
  weaponRefresh: "boolean", atkPowOffChain: "number",
  /* A NUMBER for Kayo's reason: Boltyn's clause names its own magnitude
     ("+1{p}"), and storing `true` would hardcode the 1 in `effects.js`. */
  chargedDefBuff: "number", stealthMarkedBuff: "number",
  /* A STRING for Briar's reason (v3.21): the printed line NAMES the class
     ("Agent of CHAOS"), so the passive carries that word and `effects.js`
     names nothing. `returnToBrood` is a plain flag — the Agent's line
     names no set at all, it just goes home. */
  becomeAgent: "string", returnToBrood: "boolean", daggerDrain: "number",
  halveBase: "boolean",
  /* AN OBJECT, because the printed line names BOTH a card and an amount
     — "your first SPECTRAL SHIELD attack costs {r} less". Two passives
     would be two readings of one sentence. */
  auraDiscount: "object",
  /* A STRING, and deliberately (v3.21). Briar's two clauses each NAME the
     token they create, so the passive carries that name and the mint site
     names nothing. A boolean here would move "Embodiment of Earth" into
     `effects.js`, which is inventing card text one level up — the same
     reason `atkPowOffChain` is a number rather than a flag. Widening the
     ledger's allowed types was a deliberate edit to `build.test.js`. */
  earthOnFirstHeroDmg: "string", lightningOnSecondNonAtk: "string",
  /* AN OBJECT each: the pregame placements are a CARD (or a board entry),
     which is the thing the printed line names. Dash's goes to the arena,
     Fai's to the graveyard. */
  startItem: "object", startGrave: "object"
};

return {ARMOR_Z, HAND_Z, gearSlots, applyPick, defaultPicks, buildSide, buildSideDefault,
  halveCard,
        buildSeed, buildMatch, buildVanilla, heroAbilityLine, heroAbilities,
        agentsOf, PASSIVES, PASSIVE_TYPE};
});
