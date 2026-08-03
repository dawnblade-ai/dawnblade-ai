// Dawnblade AI — engine smoke test: greedy bot plays vs the training dummy.
import { createGame } from "../engine/state.js";
import { processInput, getView, INPUTS } from "../engine/engine.js";
import { DEMO_CARDS, DEMO_DECK } from "../data/demo-cards.js";

let state = createGame({ heroId: "fai", deck: DEMO_DECK, cardDb: DEMO_CARDS, dummyLife: 20 });

// Trivial greedy policy: play the highest-power affordable attack, pitching
// lowest-power cards to pay; otherwise end turn. This is the seed of the
// "dummy-mode coach" AI — replace with something smarter later.
let safety = 500;
while (getView(state).winner == null && safety-- > 0) {
  const v = getView(state);

  if (v.phase === "ACTION") {
    const playable = v.hand
      .filter((c) => c.power > 0 || (c.keywords || []).length || c.cost === 0)
      .sort((a, b) => b.power - a.power);
    const pick = playable[0] || (v.arsenal ? v.arsenal : null);
    if (pick && v.hero.actionPoints > 0) {
      state = processInput(state, { type: INPUTS.PLAY, uid: pick.uid });
      continue;
    }
    state = processInput(state, { type: INPUTS.END_TURN });
    continue;
  }

  if (v.phase === "PAY_COSTS") {
    const cheapest = [...v.hand].sort((a, b) => a.power - b.power)[0];
    if (!cheapest) { state = processInput(state, { type: INPUTS.END_TURN }); continue; }
    state = processInput(state, { type: INPUTS.PITCH, uid: cheapest.uid });
    continue;
  }

  if (v.phase === "END") {
    const keep = [...v.hand].sort((a, b) => b.power - a.power)[0];
    state = processInput(state, { type: INPUTS.SET_ARSENAL, uid: keep ? keep.uid : null });
    continue;
  }

  break;
}

const final = getView(state);
console.log(state.log.join("\n"));
console.log("\n=== RESULT ===");
console.log(`Winner: ${final.winner} | Turns: ${final.turn} | Dummy life: ${final.dummy.life}`);
