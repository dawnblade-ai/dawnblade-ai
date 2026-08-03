// Dawnblade AI — rules engine core
// API mirrors Talishar's loop: getView() serializes state for the frontend,
// processInput() applies one player input and advances the state machine.
// (Talishar: GetNextTurn.php / ProcessInput.php — same contract, our own code.)

import { PHASES, log, drawUp, findZoneCard } from "./state.js";
import { runTrigger, TRIGGERS } from "./effects.js";

export const INPUTS = {
  PITCH: "PITCH",                 // { uid } pitch a hand card for resources
  PLAY: "PLAY",                   // { uid } play a card from hand or arsenal
  END_TURN: "END_TURN",
  SET_ARSENAL: "SET_ARSENAL",     // { uid | null } during END phase
  CANCEL: "CANCEL",               // abort a pending card (refund not modeled: only legal before pitching)
};

export function processInput(state, input) {
  if (state.phase === PHASES.GAME_OVER) return state;
  const p = state.player;

  switch (input.type) {
    case INPUTS.PITCH: {
      const idx = p.hand.findIndex((c) => c.uid === input.uid);
      if (idx === -1) return illegal(state, "Card not in hand.");
      const card = p.hand[idx];
      const def = state.cardDb[card.def];
      p.hand.splice(idx, 1);
      p.pitch.push(card);
      p.resources += def.pitch;
      log(state, `Pitch ${def.name} for ${def.pitch}.`);
      settlePending(state);
      return state;
    }

    case INPUTS.PLAY: {
      if (state.phase !== PHASES.ACTION) return illegal(state, "Not in action phase.");
      const found = findZoneCard(p, input.uid);
      if (!found) return illegal(state, "Card not in hand or arsenal.");
      const def = state.cardDb[found.card.def];
      const isAction = def.types.includes("action");
      if (isAction && p.actionPoints < 1) return illegal(state, "No action point.");

      // Move card out of its zone, park as pending until cost is paid.
      if (found.zone === "hand") p.hand = p.hand.filter((c) => c.uid !== input.uid);
      else p.arsenal = null;

      state.pending = { card: found.card, from: found.zone };
      if (isAction) p.actionPoints -= 1;
      log(state, `Announce ${def.name} (cost ${def.cost}).`);
      settlePending(state);
      return state;
    }

    case INPUTS.SET_ARSENAL: {
      if (state.phase !== PHASES.END) return illegal(state, "Arsenal is set during the end phase.");
      if (input.uid != null) {
        const idx = p.hand.findIndex((c) => c.uid === input.uid);
        if (idx === -1) return illegal(state, "Card not in hand.");
        if (p.arsenal) return illegal(state, "Arsenal is full.");
        p.arsenal = p.hand.splice(idx, 1)[0];
        log(state, `Arsenal set: ${state.cardDb[p.arsenal.def].name}.`);
      }
      finishEndPhase(state);
      return state;
    }

    case INPUTS.END_TURN: {
      if (state.phase !== PHASES.ACTION) return illegal(state, "Can only end turn from action phase.");
      beginEndPhase(state);
      return state;
    }

    default:
      return illegal(state, `Unknown input ${input.type}.`);
  }
}

/** If a pending card's cost is now payable from the resource pool, resolve it. */
function settlePending(state) {
  const pending = state.pending;
  if (!pending) return;
  const def = state.cardDb[pending.card.def];
  if (state.player.resources < def.cost) {
    state.phase = PHASES.PAY_COSTS;
    return; // wait for more PITCH inputs
  }
  state.player.resources -= def.cost;
  state.pending = null;
  state.phase = PHASES.ACTION;
  resolveCard(state, pending.card, def);
}

function resolveCard(state, card, def) {
  const ctx = { cardUid: card.uid };

  if (def.types.includes("attack")) {
    // ── attack vs training dummy: no defense step, no reaction step ──
    state.chain.open = true;
    state.chain.active = { card, buffs: [], def };
    runTrigger(state, def, TRIGGERS.WHILE_ATTACKING, ctx);

    const power =
      def.power +
      state.chain.active.buffs.reduce((a, b) => a + b, 0) +
      (card.counters.power || 0);

    state.dummy.life -= power;
    log(state, `${def.name} hits the dummy for ${power} (dummy at ${state.dummy.life}).`);
    state.chain.links.push({ card: def.name, damage: power, hit: power > 0 });

    if (power > 0) runTrigger(state, def, TRIGGERS.ON_HIT, ctx);
    runTrigger(state, def, TRIGGERS.ON_PLAY, ctx);

    if ((def.keywords || []).includes("go_again")) state.player.actionPoints += 1;
    state.chain.active = null;
    state.player.graveyard.push(card);
  } else {
    // non-attack action or instant: resolving one closes the combat chain
    if (state.chain.open) { state.chain.open = false; state.chain.links = []; }
    runTrigger(state, def, TRIGGERS.ON_PLAY, ctx);
    if ((def.keywords || []).includes("go_again")) state.player.actionPoints += 1;
    state.player.graveyard.push(card);
  }

  checkWin(state);
}

function beginEndPhase(state) {
  state.phase = PHASES.END;
  state.chain.open = false;
  state.chain.links = [];
  log(state, `End phase. Choose a card to arsenal (or none).`);
  if (state.player.hand.length === 0 || state.player.arsenal) finishEndPhase(state);
}

function finishEndPhase(state) {
  const p = state.player;
  // pitched cards go to the bottom of the deck in pitch order
  while (p.pitch.length) p.deck.push(p.pitch.shift());
  p.resources = 0;
  drawUp(state);
  state.turn += 1;
  p.actionPoints = 1;
  state.phase = PHASES.ACTION;
  log(state, `Turn ${state.turn} begins.`);
}

function checkWin(state) {
  if (state.dummy.life <= 0) {
    state.phase = PHASES.GAME_OVER;
    state.winner = "player";
    log(state, `Training dummy destroyed. Victory!`);
  }
}

function illegal(state, why) {
  log(state, `✗ Illegal move: ${why}`);
  return state;
}

/** Serialized view + legal moves — what the frontend polls each tick. */
export function getView(state) {
  const p = state.player;
  const describe = (c) => {
    const d = state.cardDb[c.def];
    return { uid: c.uid, name: d.name, pitch: d.pitch, cost: d.cost, power: d.power, defense: d.defense, keywords: d.keywords || [], counters: c.counters };
  };
  const legal = [];
  if (state.phase === PHASES.ACTION) {
    for (const c of p.hand) legal.push({ type: INPUTS.PLAY, uid: c.uid });
    if (p.arsenal) legal.push({ type: INPUTS.PLAY, uid: p.arsenal.uid });
    legal.push({ type: INPUTS.END_TURN });
  }
  if (state.phase === PHASES.PAY_COSTS || state.phase === PHASES.ACTION) {
    for (const c of p.hand) legal.push({ type: INPUTS.PITCH, uid: c.uid });
  }
  if (state.phase === PHASES.END) {
    for (const c of p.hand) legal.push({ type: INPUTS.SET_ARSENAL, uid: c.uid });
    legal.push({ type: INPUTS.SET_ARSENAL, uid: null });
  }
  return {
    phase: state.phase,
    turn: state.turn,
    winner: state.winner,
    hero: { id: p.heroId, life: p.life, resources: p.resources, actionPoints: p.actionPoints, deckCount: p.deck.length },
    dummy: { life: state.dummy.life },
    hand: p.hand.map(describe),
    arsenal: p.arsenal ? describe(p.arsenal) : null,
    pending: state.pending ? describe(state.pending.card) : null,
    legalMoves: legal,
    log: state.log.slice(-12),
  };
}
