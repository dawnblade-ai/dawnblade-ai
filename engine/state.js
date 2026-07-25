// Dawnblade AI — game state
// Fan project. Flesh and Blood™ is a trademark of Legend Story Studios®.
// This engine implements game *mechanics* only; no card text or art is reproduced.

export const PHASES = {
  START: "START",
  ACTION: "ACTION",
  PAY_COSTS: "PAY_COSTS",   // pitching to pay for a pending card
  COMBAT: "COMBAT",         // attack on the chain, pre-damage
  END: "END",               // arsenal + draw up
  GAME_OVER: "GAME_OVER",
};

/** A card *instance* in a zone. `def` is the card definition id. */
let nextUid = 1;
export function inst(defId) {
  return { uid: nextUid++, def: defId, counters: {} };
}

export function createGame({ heroId, deck, cardDb, dummyLife = 20, intellect = 4, heroLife = 20, seed = 42 }) {
  const rng = mulberry32(seed);
  const library = deck.map(inst);
  shuffle(library, rng);

  const state = {
    phase: PHASES.START,
    turn: 0,
    rngState: { seed },
    cardDb, // defId -> definition
    log: [],

    player: {
      heroId,
      life: heroLife,
      intellect,
      actionPoints: 0,
      resources: 0,
      deck: library,
      hand: [],
      arsenal: null,
      pitch: [],       // pitched this turn, goes to bottom of deck at end
      graveyard: [],
      banished: [],
      weapons: [],     // persistent weapon instances (optional)
    },

    dummy: {
      name: "Training Dummy",
      life: dummyLife,
      // The dummy never acts, defends, or plays reactions.
    },

    chain: {
      links: [],       // resolved chain links this combat: { attackUid, hit, damage }
      active: null,    // { cardUid, base, buffs: [], keywords: Set }
      open: false,     // combat chain open (cleared when a non-attack resolves or turn ends)
    },

    pending: null,     // { cardUid, from: "hand"|"arsenal", costRemaining }
    winner: null,
    _rng: rng,
  };

  drawUp(state);
  state.phase = PHASES.ACTION;
  state.player.actionPoints = 1;
  state.turn = 1;
  log(state, `Turn 1 begins. ${heroId} vs Training Dummy (${dummyLife} life).`);
  return state;
}

export function drawUp(state) {
  const p = state.player;
  while (p.hand.length < p.intellect && p.deck.length > 0) {
    p.hand.push(p.deck.shift());
  }
}

export function log(state, msg) {
  state.log.push(`[T${state.turn}] ${msg}`);
}

export function findZoneCard(p, uid) {
  const inHand = p.hand.find((c) => c.uid === uid);
  if (inHand) return { card: inHand, zone: "hand" };
  if (p.arsenal && p.arsenal.uid === uid) return { card: p.arsenal, zone: "arsenal" };
  return null;
}

// ── deterministic RNG so AI training/replays are reproducible ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
