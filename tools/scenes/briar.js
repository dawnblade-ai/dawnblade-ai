/* BRIAR — the Elemental Runeblade. Her Embodiments are her engine, and
   Cloud Cover is the pool's plainest prevention, which is why it is the
   card that proves ward reaches the table at all. */
module.exports = [

{
  name: "ward soaks damage AT THE TABLE",
  why: "v3.67 — `judge.js` applied `hp - total` and read `.ward` nowhere at " +
       "all, so Cloud Cover did nothing there while reading `tier: full`. " +
       "The arcane twin had been shared since `arcaneHit` was written, which " +
       "is what made the plain one look wired.",
  run(c){
    const atk = {uid: 90, name: "Probe Swing", tt: "Generic Action - Attack",
                 ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
                 power: 5, pitch: 1, cost: 0, def: 2};
    const swing = wardPool => {
      let g = c.acting(c.state({res: 9, ap: 1, hand: [atk]},
        {hp: 20, ward: wardPool, hand: [], gear: []},
        {actor: 0, turnPlayer: 0, turn: 3, seed: "ward"}));
      g = Object.assign({}, g, {builds: [{}, {}]});
      g = c.reduce(g, {t: "play", uid: 90, from: "hand"}, 0);
      return c.passTo(g, "resolution");
    };
    const bare = swing(0), warded = swing(3);
    return {
      "life lost with no ward": 20 - bare.sides[1].hp,
      "life lost through ward 3": 20 - warded.sides[1].hp,
      "damage recorded as DEALT": warded.pend ? warded.pend.dealt : null,
      "the pool is spent": warded.sides[1].ward
    };
  },
  want: {
    "life lost with no ward": 5,
    "life lost through ward 3": 2,
    "damage recorded as DEALT": 2,
    "the pool is spent": 0
  }
},

{
  name: "a fully prevented swing is NOT a hit",
  why: "CR 7.5.5 — if prevention means no damage is dealt, it is no longer a " +
       "hit. Subtracting ward from life alone would leave `pend.dealt`, every " +
       "on-hit clause, crush and the soul all firing off damage that never " +
       "landed, which is the half that makes this a rules bug rather than a " +
       "display one.",
  run(c){
    const atk = {uid: 91, name: "Probe Swing", tt: "Generic Action - Attack",
                 ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
                 power: 5, pitch: 1, cost: 0, def: 2};
    let g = c.acting(c.state({res: 9, ap: 1, hand: [atk]},
      {hp: 20, ward: 9, hand: [], gear: []},
      {actor: 0, turnPlayer: 0, turn: 3, seed: "ward2"}));
    g = Object.assign({}, g, {builds: [{}, {}]});
    g = c.reduce(g, {t: "play", uid: 91, from: "hand"}, 0);
    const out = c.passTo(g, "resolution");
    return {
      "life lost": 20 - out.sides[1].hp,
      "damage recorded as DEALT": out.pend ? out.pend.dealt : null
    };
  },
  want: {"life lost": 0, "damage recorded as DEALT": 0}
},

{
  name: "her Embodiment of Lightning pops on an attack action card only",
  why: "v3.22 built one reader for four tokens after Runechant had been " +
       "special-cased BY NAME and the other three read `tier: none`. The " +
       "weapon half is part of the printed trigger: three of the four say " +
       "\"or activate a weapon attack\" and the Embodiment does not, so " +
       "dropping the distinction makes her token stronger than printed.",
  run(c){
    const tok = c.card("Embodiment of Lightning", 0);
    const onBoard = () => ({card: Object.assign({}, tok, {uid: "t1"}), kind: "aura", uid: "t1"});
    const atk = {uid: 92, name: "Probe Swing", tt: "Generic Action - Attack",
                 ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
                 power: 4, pitch: 1, cost: 0, def: 2};
    const wpn = {uid: 93, name: "Probe Weapon", tt: "Warrior Weapon - Sword (2H)",
                 ty: ["Warrior", "Weapon"], tx: "", kw: [], power: 4, pitch: 0, cost: 0};
    const fire = (card, from) => {
      const g = Object.assign({}, c.state({hand: [], board: [onBoard()], res: 9, ap: 1},
        {hp: 20}, {turn: 3}), {builds: [{}, {}]});
      return c.exec(g, card, from, 0);
    };
    const byCard = fire(atk, "hand"), byWeapon = fire(wpn, "weapon");
    return {
      "an attack action card pops it": (byCard.sides[0].board || []).length,
      "…and that attack goes again":   !!(byCard.pend && byCard.pend.ga),
      "a weapon swing leaves it alone": (byWeapon.sides[0].board || []).length,
      "…and that swing does not":      !!(byWeapon.pend && byWeapon.pend.ga)
    };
  },
  want: {
    "an attack action card pops it": 0,
    "…and that attack goes again": true,
    "a weapon swing leaves it alone": 1,
    "…and that swing does not": false
  }
}

];
