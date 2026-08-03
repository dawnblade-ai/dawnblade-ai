// Dawnblade AI — effect primitives
// Cards never contain code. A card definition *associates* triggers with these
// primitives, so the whole SAGE pool compiles down to a small effect vocabulary.

import { log, drawUp } from "./state.js";

export const TRIGGERS = {
  ON_PLAY: "onPlay",         // when the card's effect resolves
  ON_HIT: "onHit",           // when this attack hits (deals damage)
  WHILE_ATTACKING: "whileAttacking", // static modifier while on the chain
  END_OF_TURN: "endOfTurn",
};

/** Each primitive: (state, ctx, params) => void.  ctx = { cardUid } */
export const EFFECTS = {
  draw(state, _ctx, { amount = 1 }) {
    for (let i = 0; i < amount && state.player.deck.length; i++) {
      state.player.hand.push(state.player.deck.shift());
    }
    log(state, `Draw ${amount}.`);
  },

  gainResources(state, _ctx, { amount = 1 }) {
    state.player.resources += amount;
    log(state, `Gain ${amount} resource(s).`);
  },

  gainActionPoint(state, _ctx, { amount = 1 }) {
    state.player.actionPoints += amount;
    log(state, `Gain ${amount} action point(s).`);
  },

  buffActivePower(state, _ctx, { amount = 0 }) {
    if (state.chain.active) {
      state.chain.active.buffs.push(amount);
      log(state, `Active attack gets +${amount} power.`);
    }
  },

  dealArcane(state, _ctx, { amount = 0 }) {
    state.dummy.life -= amount;
    log(state, `Arcane damage: dummy takes ${amount} (dummy at ${state.dummy.life}).`);
  },

  dealDamage(state, _ctx, { amount = 0 }) {
    state.dummy.life -= amount;
    log(state, `Effect damage: dummy takes ${amount} (dummy at ${state.dummy.life}).`);
  },

  gainLife(state, _ctx, { amount = 0 }) {
    state.player.life += amount;
    log(state, `Hero gains ${amount} life (now ${state.player.life}).`);
  },

  addCounterToSelf(state, ctx, { counter = "power", amount = 1 }) {
    const card = allInstances(state).find((c) => c.uid === ctx.cardUid);
    if (card) {
      card.counters[counter] = (card.counters[counter] || 0) + amount;
      log(state, `Card gains ${amount} ${counter} counter(s).`);
    }
  },

  opt(state, _ctx, { amount = 1 }) {
    // Simplified opt: look at top N, keep order (real opt lets you reorder/bottom).
    // TODO(v2): expose an interactive choice through processInput.
    log(state, `Opt ${amount} (simplified: peek, no reorder).`);
  },
};

/** Keyword registry. Vs a training dummy some keywords are inert — we keep the
 *  association so decks report correctly and the multiplayer engine can light
 *  them up later without touching card data. */
export const KEYWORDS = {
  go_again: { vsDummy: "active", note: "Grants an action point when the attack resolves." },
  dominate: { vsDummy: "inert", note: "Defense restriction — dummy never defends." },
  intimidate: { vsDummy: "inert", note: "Banishes a defender card — dummy has no hand." },
  overpower: { vsDummy: "inert", note: "Defense restriction." },
  piercing: { vsDummy: "inert", note: "Interacts with defending equipment." },
  combo: { vsDummy: "active", note: "Checks the prior chain link's card name/type." },
  ward: { vsDummy: "active", note: "Prevents damage to the hero." },
};

export function runTrigger(state, cardDef, trigger, ctx) {
  for (const ab of cardDef.abilities || []) {
    if (ab.trigger !== trigger) continue;
    const fn = EFFECTS[ab.effect];
    if (!fn) {
      log(state, `⚠ Unknown effect "${ab.effect}" on ${cardDef.name} — skipped.`);
      continue;
    }
    fn(state, ctx, ab.params || {});
  }
}

function allInstances(state) {
  const p = state.player;
  return [
    ...p.hand, ...p.deck, ...p.pitch, ...p.graveyard, ...p.banished,
    ...(p.arsenal ? [p.arsenal] : []),
    ...(state.chain.active ? [state.chain.active.card] : []),
  ];
}
