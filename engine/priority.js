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
   seat rather than being handed one, so `first` is an argument here. */
function seat(g, first){
  return {...g, firstPlayer:first, turnPlayer:first, priority:first,
    passed:[false,false], turn:1, round:1, phase:"start", step:"layer"};
}

/* ---- priority -------------------------------------------------------- */
const holder      = g => g.over ? null : g.priority;
const hasPriority = (g,i) => !g.over && g.priority === i;
const allPassed   = g => !!(g.passed && g.passed[0] && g.passed[1]);

/* Hand priority to a specific player and clear the pass record — every
   time something resolves or is added to the chain, the count restarts. */
function give(g, i){ return {...g, priority:i, passed:[false,false]}; }

/* The turn player receives priority again after anything resolves. */
function reset(g){ return give(g, g.turnPlayer); }

/* The holder declines to act. If the other player has not yet passed,
   priority slides to them; when both have passed the caller advances the
   step (`allPassed` reports it — this function never advances on its own,
   because what "advance" means depends on the step). */
function pass(g){
  if(g.over) return g;
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
/* Defend step: the defender declares, so they are the one being waited on. */
function toDefend(g){ return {...give(g, defendingPlayer(g)), step:"defend"}; }
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

/* ---- phases and the turn handoff ------------------------------------- */
function toPhase(g, phase){
  return {...reset({...g, phase}), step: phase === "action" ? "layer" : g.step};
}

/* End of turn: the turn player's floating resources fizzle (counted, as
   the trainer already counts them), the seat passes, and the clock ticks.
   Drawing and arsenal are NOT here — they are zone work, and this module
   deliberately owns none. */
function endTurn(g){
  const i = g.turnPlayer, nxt = other(i);
  const sides = g.sides ? g.sides.slice() : null;
  if(sides){
    sides[i] = {...sides[i], wasted:(sides[i].wasted||0)+(sides[i].res||0), res:0, ap:0};
    sides[nxt] = {...sides[nxt], ap:1};
  }
  const wrapped = nxt === g.firstPlayer;
  return {...g, ...(sides?{sides}:{}),
    turnPlayer:nxt, priority:nxt, passed:[false,false],
    turn:(g.turn||1)+1, round:(g.round||1)+(wrapped?1:0),
    phase:"start", step:"layer", attacker:null, chainOpen:false, chain:[]};
}

return {
  PHASES, STEPS, other,
  seat, holder, hasPriority, allPassed, give, reset, pass,
  speedAllowed, canAct, canDeclareDefenders,
  attackingPlayer, defendingPlayer,
  declareAttack, toDefend, toReaction, toDamage, toResolution,
  closeLink, breakChain, advance, toPhase, endTurn
};
});
