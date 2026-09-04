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
,

{
  name: "Rush of Power's quickstrike gate decides the pump",
  why: "v3.99 — \"Quickstrike - If this has go again, it gets +1{p}\" was " +
       "claimed WHOLE by the loose pump matcher, gate and all, so all three " +
       "printings pumped unconditionally. `tier: full`, and STRONGER than " +
       "printed: the fairness sweep's COND-BYPASSED needs an unconditional " +
       "TWIN to compare against, and a gate that simply disappears leaves " +
       "nothing to compare (v3.57).",
  run(c){
    const swing = (gaNext) => {
      const card = c.card("Rush of Power", 1, "rop");
      const g = c.acting(Object.assign(c.state({hand: [card], res: 9, ap: 1, gaNext: !!gaNext},
                                               {hp: 40}, {turn: 3}), {builds: [{}, {}]}));
      const out = c.exec(g, card, "hand", 0);
      const n = out.game || out;
      let total = null;
      c.J.withEffects(n, (fx, m) => { total = fx.linkPumps(m, {equipDefenders: 0, handBlockers: 0, defenders: []}).total; return m; });
      return total;
    };
    const printed = c.card("Rush of Power", 1).power;
    return {
      "its printed power": printed,
      "with no go again it swings for the printed number": swing(false),
      "with go again the printed +1 applies": swing(true),
      "and the two differ, which is the whole of the gate": swing(true) - swing(false)
    };
  },
  want: {
    "its printed power": 3,
    "with no go again it swings for the printed number": 3,
    "with go again the printed +1 applies": 4,
    "and the two differ, which is the whole of the gate": 1
  }
},

{
  name: "Second Strike's printed go again is an action point",
  why: "v3.99 — \"this gets +1{p} and go again\" was read as the pump ALONE, " +
       "so three printings lost a printed ACTION POINT (CR 5.3.5, and this " +
       "project's own \"most valuable keyword in the game to get wrong\"). " +
       "WEAKER than printed, so the one-sided sweep is blind, and `tier: " +
       "full`, so coverage is too.",
  run(c){
    const S = require("../../engine/sides.js");
    const play = (dealt) => {
      const card = c.card("Second Strike", 1, "ss");
      const hist = Object.assign({}, S.freshHist(), dealt ? {atk: 1} : {});
      const g = c.acting(Object.assign(c.state({hand: [card], res: 9, ap: 1, hist},
                                               {hp: 40}, {turn: 3}), {builds: [{}, {}]}));
      const out = c.exec(g, card, "hand", 0);
      const n = out.game || out;
      const done = c.J.withEffects(n, (fx, m) => {
        const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
        return r.game || r;
      });
      return {ga: !!(n.pend && n.pend.ga), ap: (done.game || done).sides[0].ap};
    };
    const cold = play(false), hot = play(true);
    return {
      "no damage dealt this turn — no go again": cold.ga,
      "…and the action point stays spent":       cold.ap,
      "damage dealt — the printed go again lands": hot.ga,
      "…and CR 5.3.5 hands the action point back": hot.ap
    };
  },
  want: {
    "no damage dealt this turn — no go again": false,
    "…and the action point stays spent": 0,
    "damage dealt — the printed go again lands": true,
    "…and CR 5.3.5 hands the action point back": 1
  }
},

{
  name: "Jack Be Quick's optional cost pays out both halves",
  why: "v3.99 — its rider reads \"this gets +1{p} and go again\", and the " +
       "rider's ops come back from `applyPrompt` and go straight to " +
       "`runOps`, which had NO `self` case. So the Nimblism was banished " +
       "and NOTHING was granted: v2.04's free-ability bug read from the " +
       "other end — pay, receive nothing.",
  run(c){
    const fx = c.P.fxParse(c.card("Jack Be Quick", 1));
    const card = c.card("Jack Be Quick", 1, "jbq");
    const g = c.acting(Object.assign(c.state({hand: [card], res: 9, ap: 1},
                                             {hp: 40}, {turn: 3}), {builds: [{}, {}]}));
    const out = c.exec(g, card, "hand", 0);
    const n = out.game || out;
    const before = n.pend.total;
    const paid = c.ops(n, [["self", 1]], "Jack Be Quick");
    const after = (paid.game || paid);
    return {
      "the rider carries the pump":     fx.optCost.ops.some(o => o[0] === "self"),
      "…and the go again beside it":    fx.optCost.ops.some(o => o[0] === "ga"),
      "the pump reaches the open link": after.pend.total - before,
      "and the cost is a graveyard banish, not a hand one": fx.optCost.zone
    };
  },
  want: {
    "the rider carries the pump": true,
    "…and the go again beside it": true,
    "the pump reaches the open link": 1,
    "and the cost is a graveyard banish, not a hand one": "grave"
  }
}

];