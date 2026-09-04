/* IYSLANDER — "Essence of Ice"

   "If it's not your turn, you may play blue non-attack action cards from
    your arsenal as though they were instants.
    Whenever you play an Ice card during an opponent's turn, create a
    Frostbite token under their control."

   BOTH SENTENCES ARE ABOUT ACTING ON THE OPPONENT'S TURN, which is what
   makes the speed grant her whole identity rather than a rider — and
   14 pool records print "as though it were an instant" and not one was
   read until v3.36. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const P = require("../../engine/parser.js");
const RNG = require("../../engine/rng.js");
const {loadData} = require("../../test/helpers/extract.js");

function built(c, k){
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  return B.buildSide(h, G.parseDeck(W.DECKS[k]), c.H.db(), {},
                     RNG.make("scene-" + k), {n: 0}).b;
}

module.exports = [

{
  name: "a blue non-attack in her ARSENAL plays at instant speed — and only there",
  why: "v3.36 — the grant is a WINDOW, and widening it in one place put " +
       "her on a NEGATIVE action point: `playableWhy` decides whether the " +
       "play is legal and `playWindowFor` decides which window it happens " +
       "in, so a play allowed in the instant window and then charged as " +
       "an action is CR 4.4.3e's \"points are lost, never owed\". The zone " +
       "is the CALLER's answer — her line frees the ARSENAL, and a caller " +
       "that says nothing gets \"hand\", which denies the grant.",
  run(c){
    const b = built(c, "iyslander");
    const blueNon = b.deck.find(x => x.pitch === 3 && !/attack/i.test(x.tt || "")
                                  && /action/i.test(x.tt || ""));
    const red = b.deck.find(x => x.pitch === 1);
    /* "IF IT'S NOT YOUR TURN" IS THE CLAUSE'S FIRST GATE and it is the
       whole point of the card — acting on the opponent's turn. The first
       draft of this scene omitted it and read the grant as dead. */
    const o = {arsenalInstant: b.arsenalInstant, notYourTurn: true};
    return {
      "her passive is built":               b.arsenalInstant,
      "a BLUE non-attack from the arsenal": P.playsAsInstant(blueNon, {...o, zone: "arsenal"}),
      "…the same card from HAND":           P.playsAsInstant(blueNon, {...o, zone: "hand"}),
      "…a RED card from the arsenal":       P.playsAsInstant(red, {...o, zone: "arsenal"}),
      "…and on HER OWN turn, nothing":      P.playsAsInstant(blueNon,
                                              {...o, zone: "arsenal", notYourTurn: false}),
      "a caller that names no zone gets nothing": P.playsAsInstant(blueNon, o)
    };
  },
  want: {
    "her passive is built": true,
    "a BLUE non-attack from the arsenal": true,
    "…the same card from HAND": false,
    "…a RED card from the arsenal": false,
    "…and on HER OWN turn, nothing": false,
    "a caller that names no zone gets nothing": false
  }
},

{
  name: "a Frostbite is an AURA under THEIR control, and it taxes them",
  why: "v2.74 — it was an integer `frost` on the side that NOTHING read, " +
       "written by one hardcoded line, so Frost Spike's \"create a " +
       "Frostbite token\" resolved to nothing at all. It is a board aura " +
       "now, the tax lives in `effCost`, and it shatters when it bites.",
  run(c){
    const b = built(c, "iyslander");
    const g = c.state({res: 9, ap: 1, hand: [], board: []},
                      {hp: 20, board: [], res: 3, hand: []},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.H.runOps(g, [["token", "Frostbite", 1, "foe"]], "Frost Spike");
    const foe = n.sides[1];
    const card = {name: "Any Card", cost: 2, pitch: 1, tt: "Generic Action",
                  ty: ["Generic", "Action"], kw: [], tx: "", uid: 1};
    return {
      "it lands on THEIR board":       (foe.board || []).length,
      "…counted off the board":        P.frostCount(foe),
      "there is no stored integer":    foe.frost === undefined,
      "a 2-cost card costs them":      P.effCost(card, foe),
      "…and costs ME nothing extra":   P.effCost(card, n.sides[0])
    };
  },
  want: {
    "it lands on THEIR board": 1,
    "…counted off the board": 1,
    "there is no stored integer": true,
    "a 2-cost card costs them": 3,
    "…and costs ME nothing extra": 2
  }
},

{
  name: "the two Ice Fusion riders fire, and only when both halves are true",
  why: "v3.97 — both cards print \"If this was FUSED and deals damage to a " +
       "hero, …\", both parsed the gate perfectly, and both were consulted " +
       "by NOTHING: `condOnHit` is read at exactly one site, inside " +
       "`linkPayload`, and a NON-ATTACK never opens a `pend`. The gate was " +
       "not unknown — the ROUTE was missing, which v3.96 recorded and this " +
       "version discharged. The machinery was already there: `_dmgWay` " +
       "(v3.62, recorded inside arcaneHit's left>0 branch so CR 7.5.5 " +
       "governs it) and the late `way:` pass (v3.60).",
  run(c){
    const P = require("../../engine/parser.js");
    const ice = uid => ({name: "Ice Junk" + uid, uid, pitch: 3, cost: 0,
      tt: "Elemental Ice Wizard Action", ty: ["Elemental","Ice","Wizard","Action"], tx: "", kw: []});
    const plain = uid => ({name: "Plain" + uid, uid, pitch: 3, cost: 0,
      tt: "Generic Action", ty: ["Generic","Action"], tx: "", kw: []});
    const play = (nm, extra) => {
      P.fxReset();
      const card = Object.assign(c.card(nm, 1), {uid: "c1"});
      const g = Object.assign(c.state(
        {name: "Alice", hand: [card, extra], res: 9, ap: 1, board: []},
        {name: "Bob", hp: 20, hand: [plain("j1")], board: []},
        {turn: 3, turnPlayer: 0}), {phase: "action", step: "layer"});
      g.builds = [{}, {}];
      const o = c.exec(g, card, "hand", 0, {});
      return o.game || o;
    };
    const pcOn = play("Polar Cap", ice("i1")), pcOff = play("Polar Cap", plain("p1"));
    const aiOn = play("Aether Icevein", ice("i1")), aiOff = play("Aether Icevein", plain("p1"));
    return {
      "fused, Polar Cap creates the token":  (pcOn.sides[1].board || []).map(b => b.card.name),
      "unfused, it creates nothing":         (pcOff.sides[1].board || []).map(b => b.card.name),
      "…and the arcane lands either way":    [pcOn.sides[1].hp, pcOff.sides[1].hp],
      "fused, Aether Icevein asks THEM to pay": !!aiOn.prompt,
      "…and it is addressed to their seat":  aiOn.prompt && aiOn.prompt.side,
      "unfused, nobody is asked":            !!aiOff.prompt
    };
  },
  want: {
    "fused, Polar Cap creates the token": ["Frostbite"],
    "unfused, it creates nothing": [],
    "…and the arcane lands either way": [16, 16],
    "fused, Aether Icevein asks THEM to pay": true,
    "…and it is addressed to their seat": 1,
    "unfused, nobody is asked": false
  }
}

];
