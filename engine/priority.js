/* ============================================================
   Dawnblade engine — priority.js (Phase 2, roadmap items 1 & 3)

   WHO MAY ACT, RIGHT NOW.

   The trainer has never needed this: only one side ever acts, so "your
   turn" and "your priority" are the same thing and both are implied by
   `mode`. In a two-player game they come apart on almost every link of
   every chain — the defending player holds priority during the reaction
   step of the attacking player's turn — so they are separate here.

   This module is deliberately narrow. It answers *who acts and in what
   window*; it never touches zones, never draws a card, never reads card
   text. Card effects stay with the parser, zone movement stays with the
   trainer (and later a judge module). Keeping that line clean is what
   makes the machine testable without a deck.

   Turn structure follows the Comprehensive Rules:
     Start Phase -> Action Phase -> End Phase, then the turn passes.
   A combat chain link runs:
     layer -> attack -> defend -> reaction -> damage -> resolution -> link
   and the chain stays OPEN after resolution, which is why `link` is its
   own step rather than a return to `layer`.

   NOTE on the clock: `turn` here counts *player-turns*, per the CR — it
   ticks on every handoff. `round` ticks when seating wraps back to the
   first player. The trainer's flat `turn` field is today a count of the
   player's own turns, so it maps to `round`, not to `turn`. Mind that
   when wiring the dummy's action phase (roadmap item 3), because the
   escalation table and the score both read it.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnPriority = factory();
})(typeof self!=="undefined" ? self : this, function(){

const PHASES = ["start","action","end"];
const STEPS  = ["layer","attack","defend","reaction","damage","resolution","link"];

const other = i => i === 0 ? 1 : 0;

/* ---- seating --------------------------------------------------------- */
/* The pregame throw decides this (see rps.js): the winner *chooses* a
   seat rather than being handed one, so `first` is an argument here.

   Priority starts NULL because a turn opens in the start phase, and
   CR 4.2.1 is explicit: "Players do not get priority during the Start
   Phase." It is granted on entering the action phase (CR 4.3.3). */
function seat(g, first){
  return {...g, firstPlayer:first, turnPlayer:first, priority:null,
    /* explicitly null, not absent: `attacker` is a field breakChain and
       endTurn both clear, and a seated game has no attacker. Leaving it
       undefined made fromTrainer return a state that PRI_FIELDS promised
       and did not deliver, so the trainer merged `undefined` over it. */
    attacker:null,
    passed:[false,false], turn:1, round:1, phase:"start", step:"layer"};
}

/* ---- priority -------------------------------------------------------- */
/* NULL is a real value here, not "unset": it means nobody holds priority,
   which is the correct state during the start and end phases. Layers
   still resolve there — CR 4.2.2 resolves them "as if all players are
   passing priority in succession" — but no player may act. */
const CLOSED_PHASES = ["start","end"];
const phaseGivesPriority = g => CLOSED_PHASES.indexOf(g.phase) < 0;

const holder      = g => (g.over || g.priority == null) ? null : g.priority;
const hasPriority = (g,i) => !g.over && g.priority != null && g.priority === i;
const allPassed   = g => !!(g.passed && g.passed[0] && g.passed[1]);

/* Hand priority to a specific player and clear the pass record — every
   time something resolves or is added to the chain, the count restarts.
   Refuses to grant it in a phase that has none (CR 4.2.1 / 4.4.1). */
function give(g, i){
  if(!phaseGivesPriority(g)) return {...g, priority:null, passed:[false,false]};
  return {...g, priority:i, passed:[false,false]};
}

/* The turn player receives priority again after anything resolves. */
function reset(g){ return give(g, g.turnPlayer); }

/* The holder declines to act. If the other player has not yet passed,
   priority slides to them; when both have passed the caller advances the
   step (`allPassed` reports it — this function never advances on its own,
   because what "advance" means depends on the step). */
function pass(g){
  if(g.over || g.priority == null) return g;   /* nobody to pass */
  const passed = (g.passed||[false,false]).slice();
  passed[g.priority] = true;
  const o = other(g.priority);
  return {...g, passed, priority: passed[o] ? g.priority : o};
}

/* ---- what may be played in this window -------------------------------
   Mirrors the gates the trainer already enforces by hand in `playRx` and
   the hand-render dim logic; naming them here is what lets both sides
   share one rule instead of the player having a special case. */
function speedAllowed(g, i){
  if(g.over || g.priority !== i) return [];
  if(g.step === "reaction"){
    const atk = g.attacker != null ? g.attacker : g.turnPlayer;
    return i === atk ? ["attack-reaction","instant"] : ["defense-reaction","instant"];
  }
  if(g.step === "defend") return [];          /* declaration is free & simultaneous */
  if(g.phase === "action" && (g.step === "layer" || g.step === "link") && i === g.turnPlayer)
    return ["action","instant"];
  return ["instant"];
}
const canAct = (g,i) => speedAllowed(g,i).length > 0;
/* Defenders are declared free and simultaneously — no priority involved,
   so this is a separate question from `canAct`. */
const canDeclareDefenders = (g,i) =>
  !g.over && g.step === "defend" && i === defendingPlayer(g);

const attackingPlayer = g => g.attacker != null ? g.attacker : g.turnPlayer;
const defendingPlayer = g => other(attackingPlayer(g));

/* ---- the combat chain ------------------------------------------------ */
/* An attack is layered by the turn player. The defending player is the
   other side — stated once, here, so no call site has to assume "dummy". */
function declareAttack(g, attacker){
  const a = attacker != null ? attacker : g.turnPlayer;
  return {...give({...g, attacker:a, chainOpen:true}, a), step:"attack"};
}
/* Defend step. CR 7.3 is counter-intuitive and worth stating plainly: the
   defending player declares the defending cards, but the TURN-PLAYER gains
   priority in this step. Declaring is not playing (CR 7.3.2) — it is a
   game-state action performed at the start of the step, free and
   simultaneous — so it is not a priority action at all. That is exactly
   why `canDeclareDefenders` is a separate question from `canAct`.

   This module used to hand priority to the defender here, which reads
   naturally ("we're waiting on them to block") but is not the rule. */
function toDefend(g){ return {...give(g, g.turnPlayer), step:"defend"}; }
/* Reaction step: the attacking player receives priority first (CR). */
function toReaction(g){ return {...give(g, attackingPlayer(g)), step:"reaction"}; }
function toDamage(g){ return {...give(g, attackingPlayer(g)), step:"damage"}; }
function toResolution(g){ return {...give(g, attackingPlayer(g)), step:"resolution"}; }
/* The link closes but the chain stays open — the attacking player may
   keep going if something granted go again. */
function closeLink(g){
  return {...give(g, attackingPlayer(g)), step:"link"};
}
/* Chain breaks: back to an open action window for the turn player. */
function breakChain(g){
  const hist = g.chain && g.chain.length
    ? [{turn:g.turn, links:g.chain}, ...(g.chainHist||[])].slice(0,8)
    : (g.chainHist||[]);
  return {...reset({...g, chainOpen:false, chain:[], chainHist:hist,
    attacker:null, boostChain:0, featured:null}), step:"layer"};
}

/* Advance one step of a link. Returns the next state; when the reaction
   step has not yet seen both players pass it stays put, because that is
   the whole point of the reaction step. */
function advance(g){
  switch(g.step){
    case "attack":     return toDefend(g);
    case "defend":     return toReaction(g);
    case "reaction":   return allPassed(g) ? toDamage(g) : g;
    case "damage":     return toResolution(g);
    case "resolution": return closeLink(g);
    case "link":       return breakChain(g);
    default:           return g;
  }
}

/* ---- phases and the turn handoff -------------------------------------
   Entering the action phase grants the turn-player priority (CR 4.3.3).
   Entering the start or end phase grants nobody any (CR 4.2.1 / 4.4.1) —
   `give` enforces that, so this is just "reset, in the new phase". */
function toPhase(g, phase){
  let n = {...g, phase};
  /* CR 4.3.2 — "The turn-player has 1 action point" at the beginning of
     the action phase. This is the only place an action point is issued. */
  if(phase === "action" && n.sides){
    const sides = n.sides.slice();
    sides[n.turnPlayer] = {...sides[n.turnPlayer], ap:1};
    n = {...n, sides};
  }
  return {...reset(n), step: phase === "action" ? "layer" : g.step};
}

/* End of turn: floating resources fizzle, the seat passes, the clock ticks.
   Drawing and arsenal are NOT here — they are zone work, and this module
   deliberately owns none.

   CR 4.4.3e — "All players lose action/resource points." BOTH seats, not
   just the turn player. That distinction is invisible in the trainer today
   (the dummy never holds resources) and becomes a real bug the moment a
   human sits in seat 1: a Wizard who floats a resource off Spellfire Cloak
   during YOUR turn must lose it at the end of your turn like anyone else.
   Both sides' fizzle is counted into `wasted`, which is the sim's score.

   The incoming action point is NOT granted here. CR 4.3.2 gives the
   turn-player 1 action point at the beginning of the ACTION phase, which
   is where `toPhase` grants it — a turn opens in the start phase, and a
   player should not be holding an action point before their action phase. */
function endTurn(g){
  const i = g.turnPlayer, nxt = other(i);
  const sides = g.sides ? g.sides.slice() : null;
  if(sides){
    for(let s = 0; s < sides.length; s++){
      sides[s] = {...sides[s],
        wasted:(sides[s].wasted||0)+(sides[s].res||0), res:0, ap:0};
    }
  }
  const wrapped = nxt === g.firstPlayer;
  return {...g, ...(sides?{sides}:{}),
    turnPlayer:nxt, priority:null, passed:[false,false],
    turn:(g.turn||1)+1, round:(g.round||1)+(wrapped?1:0),
    phase:"start", step:"layer", attacker:null, chainOpen:false, chain:[]};
}

/* ---- the trainer bridge (v2.27) --------------------------------------
   THE MACHINE, DERIVED FROM THE TRAINER'S GATES.

   The trainer gates its windows with `mode`/`bphase` and has done since
   long before this module existed. Flipping it to the phase/step machine
   in one move would change control flow across the whole reducer, so it
   lands in two: first the machine's state is DERIVED here and carried in
   shadow, then the consumers move over.

   This function is the mapping, and it lives here rather than in the
   trainer for two reasons: it is pure and drillable, and it is a
   statement about priority, so it belongs beside the rules it encodes.

   It builds the state by CALLING the transitions above rather than
   restating them, so there is exactly one description of who holds
   priority in which step.

   `t` is the trainer state ({mode, bphase, chainOpen, over}) and
   `foeFirst` is the pregame seating. NO `sides` is read or written: this
   derives, and `toPhase` would issue an action point if it saw one. */
function fromTrainer(t, foeFirst){
  t = t || {};
  let p = seat({}, foeFirst ? 1 : 0);
  if(t.over) return {...p, phase:"end", step:"layer", priority:null,
                     passed:[false,false], attacker:null};

  if(t.mode === "block"){
    /* The dummy is swinging, so it is the dummy's turn and the dummy is
       the attacker. CR 7.3: in the DEFEND step the TURN-PLAYER holds
       priority. Declaring defenders is free and simultaneous (CR 7.3.2)
       and is not a priority action at all — which is exactly why the
       trainer can let you pick blockers while the dummy holds it, and
       why canDeclareDefenders is a separate question from canAct. */
    p = toPhase({...p, turnPlayer:1}, "action");
    p = toDefend(declareAttack(p, 1));
    /* CR: the attacking player receives priority first in the reaction
       step. The dummy has no reactions, so it passes and priority slides
       to you — which is the window the trainer actually presents. */
    return t.bphase === "react" ? pass(toReaction(p)) : p;
  }

  p = toPhase({...p, turnPlayer:0}, "action");
  if(t.mode === "stack"){
    /* You attacked, the dummy has declared its defenders, and this is
       your reaction window. You are the attacker, so priority is yours
       first without anybody passing. */
    return toReaction(toDefend(declareAttack(p, 0)));
  }
  /* THE ARSENAL SET IS AN END-PHASE STEP, NOT AN ACTION (CR 4.4.3b), and
     CR 4.4.1 says players do not get priority during the end phase. It used
     to be lumped in with `act`/`pay`/`boostpick` as an open action-phase
     window, which reported a player holding priority in a closed phase —
     precisely what the PRIORITY-IN-CLOSED-PHASE invariant exists to catch,
     and it could never fire while the mapping said otherwise. */
  if(t.mode === "arsenal") return {...p, phase:"end", step:"layer", priority:null};
  /* Everything else — act, pay, boostpick — is the action phase with an open
     window. The only question is whether a chain is already running, which
     is `link` rather than `layer`. */
  return t.chainOpen ? {...p, step:"link"} : p;
}

/* The fields fromTrainer owns. The trainer merges exactly these back, so
   naming them once here keeps the two from drifting. */
const PRI_FIELDS = ["phase","step","priority","passed","turnPlayer","firstPlayer","attacker"];

return {
  PHASES, STEPS, other, PRI_FIELDS, fromTrainer,
  seat, holder, hasPriority, allPassed, give, reset, pass,
  speedAllowed, canAct, canDeclareDefenders,
  attackingPlayer, defendingPlayer,
  declareAttack, toDefend, toReaction, toDamage, toResolution,
  closeLink, breakChain, advance, toPhase, endTurn
};
});
