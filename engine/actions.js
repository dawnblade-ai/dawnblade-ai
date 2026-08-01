/* ============================================================
   Dawnblade engine — actions.js (Phase B groundwork)

   BLANK ACTIONS: a two-player game with no cards in it.

   ROADMAP-MULTIPLAYER.md Phase B step 6 extracts the trainer's reducer
   into `engine/judge.js` as a pure `reduce(state, action)`. That is a big
   piece of work on 1500 lines of closure, and the transport should not
   have to wait for it — nor should the transport be DEBUGGED through it.

   So this module is a reference reducer over the smallest action set that
   still exercises everything the network has to get right:

     pitch      a card leaves a zone and a resource appears
     pass       PRIORITY CHANGES HANDS — the thing this is all for
     attack     a chain link opens
     defend     the free, simultaneous declaration (CR 7.3.2)
     roll       the seeded RNG advances on both peers or the game is dead
     endTurn    the seat handoff, the draw, the clock

   ---- NOT ONE CARD IS READ --------------------------------------------

   Every card here is a BLANK: a name, a pitch value, a cost, a power, a
   defence, and `tx: ""`. No rules text, no keywords, nothing for the
   parser to look at, nothing from the 400-card pool. That is a hard
   constraint of this work and there is a drill that enforces it, because
   the whole point of a transport test is that a sync failure cannot be
   confused with a card being read wrong.

   ---- WHAT IT IS AND IS NOT -------------------------------------------

   IS:  a real driver of engine/priority.js. Every priority decision here
        comes from calling that module — `canAct`, `speedAllowed`,
        `passOutcome`, `advance`, `endTurn`. Nothing about who may act is
        restated. If priority.js is right, this is right; if this desyncs,
        the transport is at fault.

   IS NOT: the game's rules. Damage is `power - defence`, a pitch is a
        free action, and there is no cost payment at all. In the real
        trainer pitching is on demand only (CLAUDE.md: "you cannot pitch
        to bank resources" — tryPlay -> mode:"pay" -> confirmPay), a
        blocked attack consults equipment wear and arcane barrier, and an
        attack is `execute`'s business. NONE OF THAT IS MODELLED HERE and
        none of it should be added here. When judge.js lands it replaces
        this reducer wholesale; net.js takes `reduce` as a parameter for
        exactly that reason.

   PURITY: `reduce` never mutates its input, and every random draw goes
   through `state.rng` and stores the returned rng back (rng.js's rule).
   Those two properties together are what make two phones agree.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./priority.js"), require("./sides.js"), require("./rng.js"));
  else root.DawnActions = factory(root.DawnPriority, root.DawnSides, root.DawnRNG);
})(typeof self!=="undefined" ? self : this, function(P, S, RNG){

const ACTIONS = ["pitch","pass","attack","defend","roll","endTurn"];

/* ---- blank cards -----------------------------------------------------
   A card with nothing on it. `tx` is empty and `kw` is empty, which is
   what keeps the parser — and the 400-card pool — entirely out of this. */
function blankCard(n, o){
  o = o || {};
  return {
    uid: o.uid != null ? o.uid : n,
    name: (o.name || "Blank") + " " + n,
    pitch: o.pitch != null ? o.pitch : (n % 3) + 1,
    cost:  o.cost  != null ? o.cost  : n % 3,
    power: o.power != null ? o.power : 3 + (n % 3),
    def:   o.def   != null ? o.def   : 2 + (n % 2),
    tt: "Generic Attack Action",
    tx: "", kw: []
  };
}

/* `n` blanks with uids from `from`. Seats get disjoint uid ranges so that
   a card is never ambiguous across the whole game — the same reason
   game.js namespaces token uids ("rune"+seq) after one collided with a
   real card and tripped CARD-IN-TWO-ZONES in live play. */
const blankDeck = (n, from) => Array.from({length: n}, (_, i) => blankCard(from + i));

/* ---- a match ---------------------------------------------------------
   Seeded from `seed` — a room code, in networked play. Both peers call
   this with the same seed and the same options and MUST land on the same
   opening board; test/net.test.js pins exactly that. */
function newMatch(o){
  o = o || {};
  const size = o.deckSize || 24, hand = o.handSize || 4, intel = o.int || 4;
  const first = o.first != null ? o.first : 0;

  let rng = RNG.make(o.seed == null ? "dawnblade" : o.seed);
  const seats = [0, 1].map(i => {
    const out = RNG.shuffle(rng, blankDeck(size, 1 + i * 1000));
    rng = out.rng;
    return S.makeSide({
      id: i, name: i === 0 ? "Seat 0" : "Seat 1",
      hp: o.hp || 20, int: intel,
      deck: out.arr.slice(hand), hand: out.arr.slice(0, hand)
    });
  });

  let g = S.makeGame({sides: seats, firstPlayer: first, rng});
  /* CR 4.3.2 — the action point is issued on entering the action phase,
     and toPhase is the only place that happens. */
  return P.toPhase(g, "action");
}

/* ---- helpers ---------------------------------------------------------
   `sideAt` reads, `patch` writes. Same discipline as the trainer's
   you()/youMut() split (CLAUDE.md "the access rule"): a shallow spread
   leaves the side objects shared with the state React already rendered,
   so a write has to clone the seat it touches. sides.js's `withSide` is
   that clone, and going through it means no function here can reach back
   and corrupt a previous state. */
const sideAt = (g, i) => g.sides[i];
const patch  = (g, i, o) => S.withSide(g, i, o);
const find   = (zone, uid) => (zone || []).findIndex(c => c && c.uid === uid);
const say    = (g, msg) => ({...g, feed: [...(g.feed || []), msg]});

/* ---- legality --------------------------------------------------------
   Returns null when the action is legal, else a reason. Two properties
   make it worth having as its own function:

   1. The GUEST calls it before sending, so an illegal tap costs nothing
      and never leaves the phone. The HOST calls it again before
      sequencing, so a buggy or stale guest cannot push a bad action into
      the shared log. Same predicate both ends — one description.

   2. It never restates a priority rule. `canAct`, `speedAllowed` and
      `canDeclareDefenders` come from priority.js; this only asks the
      zone questions priority.js deliberately owns nothing about. */
function legal(g, a, seat){
  if(!g || !a) return "no action";
  if(g.over) return "the game is over";
  if(seat !== 0 && seat !== 1) return "no such seat";
  if(ACTIONS.indexOf(a.t) < 0) return "unknown action: " + a.t;
  const sd = sideAt(g, seat);

  /* CR 7.3.2 — declaring defenders is a free, simultaneous game-state
     action, NOT a priority action. It is the one thing in this action set
     a seat may do while the other side holds priority, and it is
     therefore the one place two seats can legally act at the same moment.
     That is why the session layer needs a sequencer; see net.js. */
  if(a.t === "defend"){
    if(!P.canDeclareDefenders(g, seat)) return "not the defend step for this seat";
    for(const uid of (a.uids || [])){
      if(find(sd.hand, uid) < 0) return "card " + uid + " is not in hand";
      /* CR 7.3.2b — a card already defending cannot be declared again.
         invariants.js watches for this as DEFENDER-REUSED-ON-CHAIN. */
      if((sd.blockH || []).indexOf(uid) >= 0) return "card " + uid + " is already defending";
    }
    return null;
  }

  if(!P.hasPriority(g, seat)) return "seat " + seat + " does not hold priority";

  if(a.t === "pass" || a.t === "roll") return null;

  if(a.t === "pitch"){
    if(find(sd.hand, a.uid) < 0) return "card " + a.uid + " is not in hand";
    return null;
  }

  if(a.t === "attack"){
    /* Action speed, which priority.js grants in the layer and resolution
       steps only (CR 7.6.3a is how a chain grows a second link). */
    if(P.speedAllowed(g, seat).indexOf("action") < 0) return "no action-speed window open";
    if(find(sd.hand, a.uid) < 0) return "card " + a.uid + " is not in hand";
    if(!(sd.ap > 0)) return "no action point";
    return null;
  }

  if(a.t === "endTurn"){
    if(seat !== g.turnPlayer) return "not this seat's turn";
    if(g.chainOpen) return "the combat chain is still open";
    return null;
  }
  return "unhandled action: " + a.t;
}

/* ---- step side effects -----------------------------------------------
   priority.js owns no zones by design, so the damage a chain link deals
   has to happen here. `settle` runs after every priority change: it asks
   the machine whether the window has closed and, if it has, advances one
   step and applies whatever zone work that step implies.

   It loops because a single pass can cascade (damage -> resolution), and
   it terminates because `advance` hands priority to the turn-player,
   which reopens the window. The bound is belt-and-braces on a machine
   that should stop on its own. */
function settle(g){
  for(let guard = 0; guard < 16; guard++){
    if(g.over) return g;

    /* CR 7.7.1 — "Players do not get priority during the Close Step." So
       NO PLAYER ACTION CAN DRIVE IT: the step runs to completion on its
       own, and a loop that waits for a pass here waits forever. priority.js
       says as much in `advance`, which is the one step it lets through
       without checking `windowClosed`; this is the caller honouring that.
       Getting it wrong parks the game in a step nobody can leave. */
    if(g.step === "close"){
      /* Capture before breakChain clears them — the cards on the chain
         have to be filed somewhere or they are in no zone at all, which
         is a census hole rather than a state the invariant judge can see. */
      const link = g.chain || [], by = P.attackingPlayer(g);
      const nx = P.advance(g);
      if(nx === g) return g;
      g = closeChain(nx, link, by);
      continue;
    }

    const out = P.passOutcome(g);

    /* CR 4.2.2 / 7.7.4 — everyone passed with a layer still on the stack.
       THE STEP DOES NOT END: the top layer resolves and the turn-player
       gets priority back. A machine that treats this as "advance" skips a
       whole reaction window, which priority.js's header calls the most
       expensive kind of priority bug. Blank layers carry no effect, so
       resolving one here is exactly the pop plus the handoff. */
    if(out === "resolve-layer"){
      const top = g.stack[g.stack.length - 1];
      g = P.reset({...g, stack: g.stack.slice(0, -1)});
      g = say(g, "A layer resolves" + (top && top.name ? " (" + top.name + ")" : "") + ".");
      continue;
    }
    if(out !== "advance") return g;

    const before = g.step;
    const next = P.advance(g);
    if(next === g) return g;
    g = next;

    /* The damage step has ended. Blank damage: the link's power against
       the total printed defence declared. No keywords, no equipment wear,
       no arcane — see the header for why none of that belongs here. */
    if(before === "damage") g = strike(g);
  }
  return g;
}

function strike(g){
  const link = (g.chain || [])[g.chain.length - 1];
  if(!link) return g;
  const def = P.defendingPlayer(g);
  const sd  = sideAt(g, def);
  const blocked = (sd.blockH || []).reduce((t, uid) => {
    const c = (sd.hand || []).find(x => x.uid === uid);
    return t + ((c && c.def) || 0);
  }, 0);
  const dealt = Math.max(0, (link.power || 0) - blocked);
  /* CR 7.5.5 — if no damage is dealt it is not a hit. Nothing here hangs
     off "hit" yet, but the log should not claim one. */
  let n = patch(g, def, s => ({...s, hp: s.hp - dealt}));
  n = say(n, link.name + " strikes for " + dealt + (blocked ? " (" + blocked + " blocked)" : "") + ".");
  return dealt <= 0 ? n : {...n, lastDmg: dealt, hitSeq: (n.hitSeq || 0) + 1,
    over: sideAt(n, def).hp <= 0 ? {winner: P.other(def)} : n.over};
}

/* The chain has closed. Everything that was committed to it is filed and
   the declarations are cleared.

   EVERY CARD MUST LAND IN A ZONE. A card that leaves the hand and is
   never filed is not a state the invariant judge can catch — it watches
   for a card in TWO zones (CARD-IN-TWO-ZONES), and a card in none simply
   disappears from the census. So the attack goes to its controller's
   graveyard and so do the defenders, both stamped with the turn.

   `_gy` is not decoration: CLAUDE.md calls it the characteristic that
   answers the whole "discarded a card with 6 or more {p} this turn"
   family, and a new path into the graveyard that forgets to stamp it
   makes those cards quietly wrong. A blank game has no such cards, but
   the discipline is the point — this is the shape judge.js inherits. */
function closeChain(g, link, by){
  let n = g;
  if((link || []).length && by != null){
    n = patch(n, by, s => ({...s, grave: [...link.map(c => ({...c, _gy: g.turn})), ...(s.grave || [])]}));
  }
  for(let i = 0; i < 2; i++){
    const used = sideAt(n, i).blockH || [];
    if(!used.length) continue;
    n = patch(n, i, s => ({
      ...s,
      hand:  (s.hand || []).filter(c => used.indexOf(c.uid) < 0),
      grave: [...(s.hand || []).filter(c => used.indexOf(c.uid) >= 0).map(c => ({...c, _gy: g.turn})),
              ...(s.grave || [])],
      /* CR 7.3.2b — chainBlocked tracks equipment spent for THIS chain,
         so it clears with the chain, not with the turn. */
      blockH: [], blockG: [], blockRx: [], chainBlocked: []
    }));
  }
  return n;
}

/* ---- the reducer -----------------------------------------------------
   `reduce(state, action, seat) -> {state, error}`. Never throws on an
   illegal action and never mutates `state`; an error leaves the state
   untouched so the caller can nack and carry on. */
function reduce(g, a, seat){
  const why = legal(g, a, seat);
  if(why) return {state: g, error: why};
  const sd = sideAt(g, seat);
  let n = g;

  switch(a.t){
    case "pitch": {
      const i = find(sd.hand, a.uid);
      const card = sd.hand[i];
      n = patch(n, seat, s => ({...s,
        hand:  s.hand.filter((_, j) => j !== i),
        pitch: [...s.pitch, card],
        res:   (s.res || 0) + (card.pitch || 0)}));
      n = say(n, "Seat " + seat + " pitches " + card.name + " for " + (card.pitch || 0) + ".");
      break;
    }

    case "attack": {
      const i = find(sd.hand, a.uid);
      const card = sd.hand[i];
      n = patch(n, seat, s => ({...s,
        hand: s.hand.filter((_, j) => j !== i),
        ap: (s.ap || 0) - 1,
        hist: {...s.hist, atk: (s.hist.atk || 0) + 1, atkNames: [...(s.hist.atkNames || []), card.name]}}));
      /* The attack goes on the COMBAT CHAIN, not the stack. The stack is
         for layers; conflating them would make `stackEmpty` false for the
         whole link and no step would ever advance. */
      n = {...n, chain: [...(n.chain || []), card], featured: card};
      n = P.declareAttack(n, seat);
      n = say(n, "Seat " + seat + " attacks with " + card.name + " (" + card.power + " power).");
      n = settle(n);
      break;
    }

    case "defend":
      n = patch(n, seat, s => ({...s, blockH: [...(s.blockH || []), ...(a.uids || [])]}));
      n = say(n, "Seat " + seat + " declares " + (a.uids || []).length + " defender(s).");
      break;

    case "pass":
      n = P.pass(n);
      n = settle(n);
      break;

    case "roll": {
      /* The rng canary. Nothing in the blank game needs a die; this exists
         so a drill can prove both peers advanced the SAME seeded stream by
         the same number of draws. rng.js: store the returned rng back, or
         the next draw repeats the last one. */
      const out = RNG.roll(n.rng, a.sides || 6);
      n = {...n, rng: out.rng, lastRoll: out.v};
      n = say(n, "Seat " + seat + " rolls a " + out.v + ".");
      break;
    }

    case "endTurn": {
      /* CR 4.4.3 is an ORDERED procedure and CLAUDE.md is emphatic that
         the order is load-bearing. The blank game has no allies, no
         arsenal step and no permanents to untap, so what is left is
         (c) pitch zones to the bottom of the deck, (e) ALL players lose
         points, and (f) the turn-player draws to intellect. (e) is
         priority.js's endTurn, which does both seats. */
      for(let i = 0; i < 2; i++){                                   /* CR 4.4.3c */
        n = patch(n, i, s => ({...s, deck: [...s.deck, ...s.pitch], pitch: []}));
      }
      n = P.endTurn(n);                                             /* CR 4.4.3e + the handoff */
      const nxt = n.turnPlayer;
      n = patch(n, nxt, s => {                                      /* CR 4.4.3f */
        const need = Math.max(0, (s.int || 0) - s.hand.length);
        return {...s, hand: [...s.hand, ...s.deck.slice(0, need)], deck: s.deck.slice(need),
                hist: S.freshHist()};
      });
      n = P.toPhase(n, "action");                                   /* CR 4.3.2 issues the AP */
      n = say(n, "Turn passes to seat " + nxt + " (turn " + n.turn + ").");
      break;
    }
  }
  return {state: n, error: null};
}

return {ACTIONS, blankCard, blankDeck, newMatch, legal, reduce, settle, strike, closeChain};
});
