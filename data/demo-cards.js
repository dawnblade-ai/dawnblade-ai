// Dawnblade AI — DEMO card pool
// ⚠ These are original placeholder cards for engine testing only. They are NOT
// real Flesh and Blood cards. Real SAGE card data comes from the ingest
// pipeline (see data/ingest-fab-cube.js) so stats are never typed from memory.

export const DEMO_CARDS = {
  strike_r:  { name: "Demo Strike (red)",   pitch: 1, cost: 0, power: 4, defense: 3, types: ["attack", "action"], keywords: [] },
  strike_y:  { name: "Demo Strike (yellow)",pitch: 2, cost: 0, power: 3, defense: 3, types: ["attack", "action"], keywords: [] },
  strike_b:  { name: "Demo Strike (blue)",  pitch: 3, cost: 0, power: 2, defense: 3, types: ["attack", "action"], keywords: [] },
  swift_r:   { name: "Demo Swift Jab",      pitch: 1, cost: 0, power: 2, defense: 2, types: ["attack", "action"], keywords: ["go_again"] },
  heavy_r:   { name: "Demo Heavy Blow",     pitch: 1, cost: 2, power: 7, defense: 3, types: ["attack", "action"], keywords: [] },
  surge_r:   { name: "Demo Surging Cut",    pitch: 1, cost: 1, power: 4, defense: 3, types: ["attack", "action"], keywords: [],
               abilities: [{ trigger: "onHit", effect: "draw", params: { amount: 1 } }] },
  bolt_b:    { name: "Demo Arc Bolt",       pitch: 3, cost: 2, power: 0, defense: 2, types: ["action"], keywords: ["go_again"],
               abilities: [{ trigger: "onPlay", effect: "dealArcane", params: { amount: 3 } }] },
  mend_y:    { name: "Demo Field Mend",     pitch: 2, cost: 1, power: 0, defense: 3, types: ["action"], keywords: [],
               abilities: [{ trigger: "onPlay", effect: "gainLife", params: { amount: 2 } }] },
};

/** 30-card demo deck list (defIds with duplicates). */
export const DEMO_DECK = [
  ...Array(5).fill("strike_r"),
  ...Array(4).fill("strike_y"),
  ...Array(4).fill("strike_b"),
  ...Array(5).fill("swift_r"),
  ...Array(4).fill("heavy_r"),
  ...Array(4).fill("surge_r"),
  ...Array(2).fill("bolt_b"),
  ...Array(2).fill("mend_y"),
];
