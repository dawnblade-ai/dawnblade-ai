/* ============================================================
   Dawnblade engine — sides.js (Phase 2, roadmap item 1)

   THE SHAPE A SECOND HUMAN CAN OCCUPY.

   Today the trainer carries one flat state object where the player's
   zones are bare names (`hand`, `grave`, `myHP`) and the dummy's are
   `d`-prefixed stubs (`dHand`, `dGrave`, `dHP`). That split is the single
   biggest thing standing between this sim and real multiplayer: the
   player has 35 state fields, the dummy has 12, and every new per-side
   feature widens the gap.

   This module defines the shape both sides get — one `makeSide`, called
   twice — and a **lossless bridge** to the flat state so the migration
   can happen a function at a time instead of in one terrifying rewrite:

       game = toSides(flat)      // flat trainer state -> sides[]
       flat = fromSides(game)    // and back, byte-for-byte

   `test/sides.test.js` round-trips the real initial state through both
   directions and fails if any key is unclassified, so a new field cannot
   quietly escape the migration.

   Nothing here reads the DOM and nothing here invents a card effect.
   ============================================================ */
/* Takes engine/rng.js as a dependency the same way prompts/cards/advisor
   take parser.js — so rng.js must load BEFORE sides.js. test/sync.test.js
   pins that ordering. */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./rng.js"));
  else root.DawnSides = factory(root.DawnRNG);
})(typeof self!=="undefined" ? self : this, function(RNG){

/* ---- the per-side shape ---------------------------------------------
   Every field a player needs to BE a player. The dummy gets all of them
   too; the ones it does not use yet simply sit at their defaults, which
   is the point — adding its action phase later is filling in blanks,
   not inventing new plumbing. */
const SIDE_FIELDS = [
  /* identity */
  "id","name","hero","heroKey",
  /* life & intellect — intWas parks a temporarily-rolled intellect
     (Knucklehead's d6) so the printed value can be restored after the draw */
  "hp","maxHp","int","baseInt","intWas",
  /* zones */
  "deck","hand","arsenal","pitch","grave","banish","soul","board","gear",
  /* economy: floating resources, action points, fizzled resources */
  "res","ap","wasted",
  /* counters and statuses that live on a hero */
  "counters","weaponUsed","heroTapped","buffNext","buffQ","gaNext","gaNextQ","costOff","instantNextQ","defCapNext","runeHitNext",
  /* `frost` RETIRED in v2.74, `rot` and `fra` in v3.09 — each is an Aura
     on `board` and each count is derived (`parser.frostCount`,
     `frailtyCount`), exactly as `rune` above is derived by `runeCount`. A
     bare integer beside the board is a second source of truth for the same
     fact, and in all three cases almost nothing read it: `frost` was read
     by neither `effCost` nor effects.js, and `fra` was never once SET in a
     real game — its only source read `none` until v3.08. Do not
     reintroduce any of them. */
  "amp","ward","awd","rune",
  "arcShield","lifeLock","namedBuff","dracNext","marked","fatigue",
  /* per-turn history — reset every turn, read by "second attack this turn"
     style conditions */
  "hist",
  /* combat declaration, per side: what this side has declared as defenders,
     what it reacted with, how many hand cards met the last attack, and which
     equipment is spent for the current chain */
  "blockH","blockG","blockRx","blockedHand","chainBlocked",
  /* escrow: cards banished by intimidate, handed back at the end phase */
  "intimidated",
  /* transient selection while paying a cost */
  "paySel",
  /* EFFECTS ARMED FOR THIS SIDE'S NEXT TURN (v3.29). Crush riders reach
     forward — "their first attack during their next turn gets -2{p}" —
     and there was nowhere for that to live: `hist` is the natural home
     for a per-turn fact and is CLEARED for the incoming seat at CR 4.4.4,
     which is exactly the moment such an effect has to survive.

     Entries are `{kind, amt, ready}`. They arm at the start of this
     side's turn, are consumed by whatever reads them, and are dropped at
     the end of that turn whether they fired or not. */
  "nextTurn"
];

/* `playTy` — THE TYPE WORDS OF EVERY CARD PLAYED THIS TURN (v3.38), one
   entry per play, lowercased, straight off the STRUCTURED array. It exists
   because `non` counts non-attacks and records no CLASS, so "if you have
   played another WIZARD non-attack action card this turn" (Snapback x3)
   could not be asked at all — and reading it as the bare count would grant
   the window off ANY non-attack, which is stronger than the card's text.

   THE WHOLE ARRAY, not a set of flags: the question pairs a class with a
   type ("Wizard" AND "action" AND not "attack"), and a flat set of words
   loses that pairing the moment two different cards contribute halves. */
const freshHist = () => ({atk:0,non:0,arc:0,aura:0,made:0,booed:0,blue:0,red:0,trans:0,blueGY:0,atkNames:[],playTy:[],arcTaken:0});

function makeSide(o){
  o = o || {};
  const hp = o.hp!=null ? o.hp : 20;
  const int = o.int!=null ? o.int : 4;
  return {
    id: o.id!=null ? o.id : 0,
    name: o.name || (o.id===1 ? "Opponent" : "You"),
    hero: o.hero || null,
    heroKey: o.heroKey || null,
    hp, maxHp: o.maxHp!=null ? o.maxHp : hp,
    int, baseInt: o.baseInt!=null ? o.baseInt : int, intWas: null,
    deck: o.deck || [], hand: o.hand || [], arsenal: o.arsenal!=null ? o.arsenal : null,
    pitch: [], grave: [], banish: [], soul: [], board: o.board || [], gear: o.gear || [],
    res: 0, ap: 1, wasted: 0,
    counters: {}, weaponUsed: {}, heroTapped: false, buffNext: 0, buffQ: [], gaNext: false, gaNextQ: [], costOff: [], instantNextQ: [], defCapNext: [], runeHitNext: 0,
    amp: 0, ward: 0, awd: 0, rune: 0,
    arcShield: 0, lifeLock: false, namedBuff: null, dracNext: false,
    marked: false, fatigue: false,
    hist: freshHist(),
    nextTurn: [],
    blockH: [], blockG: [], blockRx: [], blockedHand: 0, chainBlocked: [],
    intimidated: [],
    paySel: []
  };
}

/* ---- the legacy bridge ----------------------------------------------
   The migration ledger, stated as data rather than prose. Left column is
   the flat trainer key that ships today; right column is the field it
   becomes on its side. Anything not in one of these three tables is
   unclassified, and the drills fail on it. */
/* MIGRATION COMPLETE (v2.18). Both tables are empty: every field a hero
   carries now lives on its own side. They stay as the ledger's shape — if a
   flat per-side field is ever reintroduced it belongs here, and the drills
   will hold it to that. */
const P_MAP = {};

/* What the opponent still carries as a flat d* stub. v2.14 moved its zones
   and life OFF this table and onto sides[1] (see NATIVE below), so six are
   left. This table shrinks to nothing as the migration completes. */
const O_MAP = {};

/* ---- what already lives on sides[] ----------------------------------
   The exact key set each seat carries natively in the trainer's live state
   literal. This is the other half of the ledger: O_MAP/P_MAP say "still
   flat", NATIVE says "already moved". A field must appear in exactly one
   of them, and `test/sides.test.js` checks NATIVE against the real literal
   so this cannot drift from what actually ships.

   As of v2.18 this is simply SIDE_FIELDS: both seats carry every field a
   hero has, natively. The dummy's resources, action point, arsenal, pitch,
   banish, soul and hist sit at their defaults because it pays no costs and
   takes no action phase yet — inert-but-present is the point, and it is what
   lets a second human occupy slot 1 without a single new field. */
const NATIVE = { 0: SIDE_FIELDS.slice(), 1: SIDE_FIELDS.slice() };

/* Genuinely shared: one board, one clock, one chain, one log. */
const GAME_KEYS = [
  "turn","mode","bphase","pending","incoming",
  "log","feed","flags","over","inspect",
  "prompt","promptQ","revealed","lastRoll","boostOn",
  "chain","chainHist","chainOpen","boostChain","stack","pend","featured",
  "hitSeq","lastDmg",
  /* the side whose effect is RESOLVING (ROADMAP-MULTIPLAYER.md Phase A step 1).
     Distinct from turnPlayer: a defence reaction resolves for the defender
     during the attacker's turn. Shared, not per-side — it names one of the two
     seats, it does not live on either. Default 0 on a single-actor device. */
  "actor",
  /* the SEEDED random source (engine/rng.js). Shared, and it must travel
     WITH the state: a game is its seed plus its action log, so an rng that
     lived outside the state would make the game unreplayable and two
     networked peers undiagnosable. `rng.seed` is the replay key and
     `rng.n` the draw counter / desync canary. */
  "rng",
  /* THE PRIORITY MACHINE (engine/priority.js), carried in shadow from
     v2.27: derived from the trainer's mode/bphase each time state changes,
     not yet driving it. Registered here because they are genuinely shared
     — a phase and a step belong to the game, not to a seat — and because
     until they existed the invariant judge's BAD-PHASE / BAD-STEP /
     BAD-PRIORITY / PRIORITY-IN-CLOSED-PHASE checks were all dormant: every
     one of them guards with `!= null`.

     NOTE the clock is deliberately NOT here. priority.js's `turn` counts
     player-turns and ticks on every handoff; the trainer's `turn` counts
     only the player's own turns and is read by the escalation table and
     the score. Wiring that belongs with seat 1's action phase. */
  "phase","step","priority","passed","turnPlayer","firstPlayer","attacker",
  /* set when the opponent won the seating: its opening swing lands before
     the first action phase, so the clock has not started ticking yet */
  "_opening"
];

/* Identity/bookkeeping rather than game state — not counted as coverage. */
const META = ["id","name","hero","heroKey","maxHp","baseInt"];

/* Two numbers, and they measure different things.

   COVERAGE — how much of a hero each seat actually carries, flat or native.
   This is the "is the opponent a real side yet" question, and it only moves
   when a field the opponent never had gets wired up.

   NATIVE vs FLAT — of what a seat does carry, how much has moved onto
   sides[] already. This is the "is the migration done yet" question, and it
   moves on every pass. `flatRemaining` is the one that should reach zero. */
function symmetryGap(){
  const skip = new Set(META);
  const owned = SIDE_FIELDS.filter(f=>!skip.has(f));
  const nat = i => new Set(NATIVE[i].filter(f=>!skip.has(f)));
  const has = (map, i) => { const s = nat(i); Object.values(map).forEach(f=>s.add(f)); return s; };
  const pHas = has(P_MAP, 0), oHas = has(O_MAP, 1);
  return {
    fields: owned.length,
    player: owned.filter(f=>pHas.has(f)),
    opponent: owned.filter(f=>oHas.has(f)),
    missingForPlayer: owned.filter(f=>!pHas.has(f)),
    missingForOpponent: owned.filter(f=>!oHas.has(f)),
    nativeForPlayer: [...nat(0)],
    nativeForOpponent: [...nat(1)],
    flatRemaining: Object.keys(P_MAP).length + Object.keys(O_MAP).length
  };
}

/* ---- the two-sided game --------------------------------------------- */
function makeGame(o){
  o = o || {};
  const sides = o.sides || [makeSide({id:0}), makeSide({id:1})];
  /* CR 4.3.2 — action points are issued to the TURN-PLAYER at the
     beginning of their action phase, and a game opens in the start phase.
     `makeSide` defaults ap:1 because the trainer's seat 0 is always the
     turn player; a genuine two-player game starts with neither seat
     holding one, and priority.js's toPhase("action") issues it. */
  const seated = sides.map(sd => sd && sd.ap ? {...sd, ap:0} : sd);
  return {
    sides: seated,
    /* seating, decided by the pregame throw (see rps.js). turnPlayer is
       whose turn it is; priority is who may act right now — in a real
       two-player game those come apart constantly, which is exactly why
       they are separate fields. */
    firstPlayer: o.firstPlayer!=null ? o.firstPlayer : 0,
    turnPlayer: o.firstPlayer!=null ? o.firstPlayer : 0,
    /* whose effect is resolving; defaults to the turn player and moves during
       reactions. See GAME_KEYS above and act()/foe() in the trainer. */
    actor: o.actor!=null ? o.actor : (o.firstPlayer!=null ? o.firstPlayer : 0),
    /* Seeded from o.seed when given (a room code, or a pinned seed in a
       drill), otherwise from the clock. Passing a seed is what makes a
       game replayable, so drills and networked play always pass one. */
    rng: o.rng || RNG.make(o.seed),
    /* NULL, not the first player: a game opens in the start phase, and
       CR 4.2.1 says players do not get priority during the start phase.
       priority.js grants it on entering the action phase (CR 4.3.3).
       engine/invariants.js fails the state if anyone holds it here. */
    priority: null,
    passed: [false,false],
    turn: 1, phase: "start", step: "layer",
    mode: "act", bphase: "defend", pending: null, incoming: 0,
    chain: [], chainHist: [], chainOpen: false, boostChain: 0,
    stack: [], pend: null, featured: null, hitSeq: 0, lastDmg: 0,
    log: [], feed: [], flags: {}, over: null, inspect: false,
    prompt: null, promptQ: [], revealed: null, lastRoll: null, boostOn: true
  };
}

const other = i => i === 0 ? 1 : 0;
/* `you = g => g.sides[0]` and `foe = g => g.sides[1]` used to live here.
   BOTH ARE DELETED (v2.24) and should not come back. They were exported,
   called by nobody, and encoded the exact conflation ROADMAP-MULTIPLAYER.md
   step 1 exists to undo: a seat index hardcoded into a rules-shaped name.
   The trainer's act()/foe() read s.actor and are the actor-relative
   replacements; `activeSide` below is the turn-player question, which is a
   genuinely different one. Deleting them also retired two pinned entries in
   test/sync.test.js's KNOWN_COLLISIONS — `you` was already colliding with the
   trainer, and `foe` would have collided with DIFFERENT semantics, which is
   the dangerous kind. */
const activeSide = g => g.sides[g.turnPlayer];

/* Replace one side immutably — the workhorse every migrated function
   will use in place of `{...s, dHand: …}`. */
function withSide(g, i, patch){
  const sides = g.sides.slice();
  sides[i] = typeof patch === "function" ? patch(sides[i]) : {...sides[i], ...patch};
  return {...g, sides};
}

/* ---- flat  ->  sides ------------------------------------------------- */
function toSides(flat){
  const p = makeSide({id:0}), o = makeSide({id:1});
  const game = makeGame({sides:[p,o]});
  const unmapped = [];
  const seats = [p, o];
  for(const k of Object.keys(flat)){
    /* already-native state comes across whole rather than field by field */
    if(k === "sides"){
      const src = Array.isArray(flat.sides) ? flat.sides : [];
      src.forEach((seat, i) => { if(seats[i]) Object.assign(seats[i], seat || {}); });
      continue;
    }
    if(P_MAP[k] !== undefined)      p[P_MAP[k]] = flat[k];
    else if(O_MAP[k] !== undefined) o[O_MAP[k]] = flat[k];
    else if(GAME_KEYS.indexOf(k) >= 0) game[k] = flat[k];
    else unmapped.push(k);
  }
  game.sides = [p, o];
  game._unmapped = unmapped;
  return game;
}

/* ---- sides  ->  flat ------------------------------------------------
   Writes back only the legacy-named fields, which is what the trainer
   reads. A side field with no legacy name (the opponent's arsenal, its
   resources, its hist …) has nowhere to go — that is the migration
   surface, and `symmetryGap()` names every one of them. */
function fromSides(game){
  const flat = {};
  const [p, o] = game.sides;
  for(const k of Object.keys(P_MAP)) flat[k] = p[P_MAP[k]];
  for(const k of Object.keys(O_MAP)) flat[k] = o[O_MAP[k]];
  for(const k of GAME_KEYS) if(k in game) flat[k] = game[k];
  /* the migrated half goes back as sides[], carrying exactly the keys the
     trainer's live literal declares — NATIVE is what makes that exact */
  flat.sides = [p, o].map((seat, i) => {
    const out = {};
    for(const f of NATIVE[i]) out[f] = seat[f];
    return out;
  });
  return flat;
}

return {
  SIDE_FIELDS, P_MAP, O_MAP, GAME_KEYS, NATIVE, META,
  makeSide, makeGame, freshHist, symmetryGap,
  toSides, fromSides, withSide, other, activeSide
};
});
