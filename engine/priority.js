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

   A combat chain link runs, per CR 7.0.1:
     layer -> attack -> defend -> reaction -> damage -> resolution
   and then, when the stack and queue are empty and all players pass,
     -> close
   where the chain actually closes and NOBODY holds priority (CR 7.7.1).

   THERE IS NO LINK STEP. This module used to carry one, standing in for
   "the chain stays open and the attacker may keep going". The CR removed
   the link step: the go again check moved into the Resolution Step
   (CR 7.6.2, "If the attack has go again, its controller gains 1 action
   point") and continuing combat is CR 7.6.3a/b — the turn-player playing
   another attack sends the Resolution Step back to the Layer Step. So the
   open-chain window is `resolution`, and `close` is the step that ends it.

   TWO RULES THAT READ BACKWARDS AND ARE LOAD-BEARING:

   1. EVERY combat step gives priority to the TURN-PLAYER, not to the
      attacking player (CR 7.1.x, 7.2.x, 7.3.3, 7.4.x, 7.5.x, 7.6.3).
      The attacker decides only WHICH KIND of reaction is legal, which is
      `speedAllowed`'s business, not who holds the window. Those two
      coincide today because one side ever attacks — the same shape as
      `act()` vs `you()` in ROADMAP-MULTIPLAYER.md Phase A step 1.

   2. A step ends only "when the stack is empty and all players pass in
      succession" (CR 7.3.4, 7.6.4). Passing on a POPULATED stack resolves
      the top layer and hands priority back to the turn-player (CR 4.2.2 /
      7.7.4); it does not advance the step. `passOutcome` names which of
      the two is happening, because a machine that cannot tell them apart
      will skip a whole reaction window whenever anything is on the stack.

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
/* CR 7.0.1 — "Layer, Attack, Defend, Reaction, Damage, and Resolution",
   plus the Close Step (CR 7.7) that ends the chain. `link` is GONE. */
const STEPS  = ["layer","attack","defend","reaction","damage","resolution","close"];

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
/* CR 7.7.1 — "Players do not get priority during the Close Step." Stated
   here rather than at each call site so no transition INTO the close step
   can grant priority by accident: `give` refuses, the way it already
   refuses in a closed phase. Transitions therefore set the step first and
   ask for priority second. */
const CLOSED_STEPS = ["close"];
const phaseGivesPriority = g =>
  CLOSED_PHASES.indexOf(g.phase) < 0 && CLOSED_STEPS.indexOf(g.step) < 0;

const holder      = g => (g.over || g.priority == null) ? null : g.priority;
const hasPriority = (g,i) => !g.over && g.priority != null && g.priority === i;
const allPassed   = g => !!(g.passed && g.passed[0] && g.passed[1]);

/* ---- the stack, and why passing means two different things -----------
   THE EDGE CASE THIS MACHINE COULD NOT SEE. Every "the step ends" rule in
   the CR is worded the same way and both halves are load-bearing:

     CR 7.3.4 — "when the stack is empty and all players pass in
                 succession, the Defend Step ends"
     CR 7.6.4 — "when the stack and queue are empty and all players pass
                 in succession, the Resolution Step ends"
     CR 4.3.4 — "when the stack is empty, the combat chain is closed, and
                 both players pass priority in succession, the action
                 phase ends"

   So "everyone passed" ALONE never ends anything. With a layer on the
   stack, all passing resolves the top layer and the turn-player gets
   priority again (CR 4.2.2 / 7.7.4) — the window reopens, it does not
   close. A machine that treats the two alike skips a reaction window
   every time anything is on the stack, which is the most expensive kind
   of priority bug: the defending player never gets asked.

   This module owns no zones, so it does not resolve the layer. It reports
   WHICH of the two is happening and lets the caller do the zone work. */
const stackEmpty = g => !(g.stack && g.stack.length);
/* The attack queue (CR 7.6.3b). The trainer has no queue, so absent reads
   as empty rather than being invented as state nothing writes. */
const queueEmpty = g => !(g.queue && g.queue.length);

/* The priority window is closed: everyone has passed AND there is nothing
   left on the stack to resolve. This is the exact conjunction above. */
const windowClosed = g => allPassed(g) && stackEmpty(g);

/* What passing has produced, right now. Three answers, and they are
   mutually exclusive:
     "hold"          — somebody still holds priority and may act
     "resolve-layer" — all passed with a populated stack: resolve the top
                       layer, then priority returns to the turn-player
     "advance"       — all passed on an empty stack: the step ends */
function passOutcome(g){
  if(g.over || g.priority == null) return "hold";
  if(!allPassed(g)) return "hold";
  return stackEmpty(g) ? "advance" : "resolve-layer";
}

/* CR 4.3.4 — the action phase ends when the stack is empty, the combat
   chain is closed, and both players pass priority in succession. */
const actionPhaseEnds = g =>
  g.phase === "action" && !g.chainOpen && windowClosed(g);

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
  /* A CLOSED WINDOW OPENS NOTHING. Once everyone has passed on an empty
     stack the step is over and the caller must advance it; `pass` leaves
     priority resting with the last passer so it does not bounce forever,
     and without this that player would still read as able to act. Keeps
     `canAct` from contradicting `windowClosed`. */
  if(windowClosed(g)) return [];
  if(g.step === "reaction"){
    /* The reaction SPLIT follows the attacker — that is which kind of card
       is legal, and it is a different question from who holds the window
       (which is always the turn-player, CR 7.4). */
    const atk = attackingPlayer(g);
    return i === atk ? ["attack-reaction","instant"] : ["defense-reaction","instant"];
  }
  /* CR 7.3.3 — "the turn-player gains priority" in the Defend Step, so
     instants ARE legal here. This used to return [] on the grounds that
     declaring defenders is free and simultaneous (CR 7.3.2): true about
     DECLARING, and not a statement that the step has no priority window.
     Reaction cards still are not legal — those belong to the reaction
     step — so the window is instants only. */
  if(g.step === "defend") return ["instant"];
  /* Action speed: the turn-player's own open window. CR 7.6.3a puts the
     resolution step here too — "the turn-player may play attacks", which
     is how a chain grows a second link. */
  if(g.phase === "action" && (g.step === "layer" || g.step === "resolution") && i === g.turnPlayer)
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
  /* CR 7.2 — the ATTACK step gives priority to the turn-player. Note the
     attacker is recorded but is NOT who receives it; see the header. */
  return {...give({...g, attacker:a, chainOpen:true, step:"attack"}, g.turnPlayer), step:"attack"};
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
/* CR 7.4 / 7.5 / 7.6.3 — every one of these gives priority to the
   TURN-PLAYER. They used to hand it to the attacking player, which reads
   naturally ("it's their attack") and is not the rule; it is the same
   mistake `toDefend` already had corrected above. Behaviour-identical
   while one side attacks, wrong the moment a card lets it diverge. */
function toReaction(g){ return {...give(g, g.turnPlayer), step:"reaction"}; }
function toDamage(g){ return {...give(g, g.turnPlayer), step:"damage"}; }
/* CR 7.6 — the chain link resolves here, go again pays out here
   (CR 7.6.2), and the turn-player holds the window in which combat may
   continue (CR 7.6.3a/b). This is the step the deleted `link` stood in for. */
function toResolution(g){ return {...give(g, g.turnPlayer), step:"resolution"}; }
/* CR 7.7 — the Close Step. "Players do not get priority during the Close
   Step" (CR 7.7.1), so the step is set BEFORE priority is requested and
   `give` refuses it. The chain has not closed yet: `breakChain` is
   CR 7.7.7, "the Close Step ends and the Action Phase continues". */
function toClose(g){
  return give({...g, step:"close"}, g.turnPlayer);
}
/* Chain breaks: back to an open action window for the turn player. */
function breakChain(g){
  const hist = g.chain && g.chain.length
    ? [{turn:g.turn, links:g.chain}, ...(g.chainHist||[])].slice(0,8)
    : (g.chainHist||[]);
  /* `step:"layer"` is set BEFORE reset, not after: coming out of the close
     step, `give` would refuse priority while the step still said "close"
     and the turn-player would silently get their action window back with
     nobody holding it. Same ordering discipline as toClose. */
  return reset({...g, chainOpen:false, chain:[], chainHist:hist,
    attacker:null, boostChain:0, featured:null, step:"layer"});
}

/* Advance one step of a chain link.

   EVERY step waits for its window to close, not just the reaction step.
   The CR wording is uniform — "when the stack is empty and all players
   pass in succession, the X Step ends and the Y Step begins" — and this
   used to honour it in exactly one place: `reaction`. Attack, defend,
   damage and resolution each GRANTED priority and were then advanced past
   in the same breath, so four of the six windows the CR opens could never
   actually be used. A defending player with an instant had nowhere to
   play it.

   Returns the state unchanged while the window is still open, so a caller
   can drive this in a loop until it stops moving. `passOutcome` is how a
   caller tells "still open" from "a layer needs resolving first". */
function advance(g){
  if(g.over) return g;
  /* Nothing advances while a layer is waiting to resolve (CR 4.2.2) or
     while somebody may still act. */
  if(g.step !== "close" && !windowClosed(g)) return g;
  switch(g.step){
    case "attack":     return toDefend(g);
    case "defend":     return toReaction(g);
    case "reaction":   return toDamage(g);
    case "damage":     return toResolution(g);
    /* CR 7.6.4 — "when the stack AND QUEUE are empty". A queued attack
       sends this back to the attack step (CR 7.6.3b) instead of closing. */
    case "resolution": return queueEmpty(g) ? toClose(g) : {...give({...g, step:"attack"}, g.turnPlayer), step:"attack"};
    /* CR 7.7.7 — the close step ends and the action phase continues. */
    case "close":      return breakChain(g);
    /* The layer step is left to `declareAttack`, which is the transition
       that actually names an attacker. */
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
     window. The only question is whether a chain is already running.

     An open chain is the RESOLUTION step (CR 7.6.3), not the deleted
     `link` step: the link has resolved, the turn-player holds priority,
     and playing another attack starts a new link (CR 7.6.3a). Mapping it
     to `close` would be wrong twice over — nobody holds priority there
     (CR 7.7.1), and the trainer's open-chain window is precisely where
     the player may still act. `speedAllowed` grants action speed in both
     `layer` and `resolution`, so the trainer's hand stays live either way. */
  return t.chainOpen ? {...p, step:"resolution"} : p;
}

/* The fields fromTrainer owns. The trainer merges exactly these back, so
   naming them once here keeps the two from drifting. */
const PRI_FIELDS = ["phase","step","priority","passed","turnPlayer","firstPlayer","attacker"];

/* `closeLink` is DELETED, not aliased. The CR has no link step, and an
   alias under the old name would keep the retired concept reachable —
   same reasoning that deleted DawnGame.shuffle in v2.26 and sides.js's
   you/foe in v2.24. Use `toClose`. */
return {
  PHASES, STEPS, CLOSED_PHASES, CLOSED_STEPS, other, PRI_FIELDS, fromTrainer,
  seat, holder, hasPriority, allPassed, give, reset, pass,
  stackEmpty, queueEmpty, windowClosed, passOutcome, actionPhaseEnds,
  speedAllowed, canAct, canDeclareDefenders,
  attackingPlayer, defendingPlayer,
  declareAttack, toDefend, toReaction, toDamage, toResolution,
  toClose, breakChain, advance, toPhase, endTurn
};
});
