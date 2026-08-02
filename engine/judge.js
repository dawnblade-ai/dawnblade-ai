/* ============================================================
   Dawnblade engine — judge.js (Phase 1)

   THE RULES, AS A PURE FUNCTION.  `reduce(state, action, seat) -> state`

   ---- WHY THIS EXISTS -------------------------------------------------

   The trainer holds the entire rules core as closures inside a 2,505-line
   React component, mutating through 25 `setG` calls. Nothing in it is
   reachable by a drill, which is not an accident of style — it is the
   shape of the code, and it is why every bug this project has had was
   found by eye or in play rather than by a red test.

   It is also why there is no second player. Not for want of network
   plumbing: `engine/net.js`, `wire.js` and `room.js` are built, drilled
   and wired, and two phones already play a real game of CR turn structure
   at each other over a public relay. What they play is `actions.js`'s
   blank decks, because `net.js` needs a `reduce(state, action)` to drive
   and there was none. This is that function.

   ---- ONE COMBAT PATH, NOT TWO ----------------------------------------

   The single biggest thing this replaces. The trainer resolves the same
   CR procedure through two unrelated bodies of code:

     you attack   tryPlay -> execute -> dummyDefence -> mode:"stack" -> resolveStack
     they attack  foeSwing -> mode:"block" -> toggleBlock -> finishBlock -> takeIt

   One of them fabricates the attack as `[3,4,5][(turn-1)%3]`; the other
   auto-picks the blocks. Neither can serve a second human, and a rule
   fixed in one silently stays broken in the other — which is exactly how
   clash came to fire on the wrong trigger for five versions.

   Here there is one path, and which seat is attacking is an argument:

     declare -> ATTACK -> DEFEND -> REACTION -> DAMAGE -> RESOLUTION -> CLOSE

   ---- IT RESTATES NO PRIORITY RULE ------------------------------------

   Every question about who may act right now is asked of
   `engine/priority.js`: `canAct`, `speedAllowed`, `canDeclareDefenders`,
   `passOutcome`, `advance`, `endTurn`. There is no `mode`, no `bphase`
   and no second opinion. If priority.js is right, this is right.

   That module is CR-grounded and counter-intuitive in the places the CR
   is: in the defend step the TURN-PLAYER holds priority (CR 7.3.3) while
   the DEFENDER declares defenders (CR 7.3.2), which is why "can I act"
   and "can I declare defenders" are two different questions here.

   ---- WHAT IS AND IS NOT MODELLED YET ---------------------------------

   Modelled: the CR turn structure (4.2-4.4), the combat chain (7.x),
   resource payment on demand, defenders from hand and equipment, printed
   power against printed defence, go again as a GAIN (CR 5.3.5), instants
   costing no action point (CR 8.1.6), the arsenal step, fatigue, and the
   ordered end phase (CR 4.4.3a-f).

   NOT YET: card EFFECTS. `runOps`/`execute` — the parser's 700 lines of
   card semantics — are still in the trainer and are ported in the next
   pass. Until then a card here moves zones, costs what it prints and
   hits for what it prints, and its rules text does nothing.

   THAT LIMIT IS DELIBERATE AND IT IS LOAD-BEARING. Getting the
   orchestration right is the part that does not exist; the card semantics
   already work and are covered by 594 drills. Building the skeleton first
   means a control-flow bug can never be confused for a card being read
   wrong — the same discipline that kept `actions.js` free of card text so
   a transport failure could not masquerade as a parser failure.

   DO NOT wire this into `Battle` as the rules source until the effects
   port lands, or every card in the game quietly stops working.

   ---- PURITY ----------------------------------------------------------

   `reduce` never mutates its input and never calls `Math.random`. Writes
   go through `sides.js`'s `withSide`, which clones the seat it touches —
   the seat-agnostic form of the trainer's `youMut`/`oppMut` rule, and the
   reason a returned state can never reach back and corrupt the one React
   already rendered.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./priority.js"), require("./sides.js"), require("./rng.js"),
                             require("./parser.js"), require("./game.js"));
  else root.DawnJudge = factory(root.DawnPriority, root.DawnSides, root.DawnRNG,
                                root.DawnParser, root.DawnGame);
})(typeof self!=="undefined" ? self : this, function(P, S, RNG, PR, GM){

const {effCost, costsAP, isAttack, isInstantT, rxAllowed, fxParse} = PR;
/* `isInstantT` reads the printed type line; `_instant` is how a powCard
   carries "Instant - …" off an equipment ability. `costsAP` already
   accounts for both, so ask the same question the same way here. */
const instantSpeed = c => isInstantT(c) || !!(c && c._instant);
const {gearDef, gearBlockApply} = GM;

/* Every action a seat can take. Serializable by construction: a uid, a
   zone name, an index — never a card object and never a closure. That is
   what lets the same action drive a local tap, a replay and a peer. */
const ACTIONS = [
  "play",        /* {uid, from}  play a card from a zone                  */
  "activate",    /* {uid}        swing a weapon from the gear zone        */
  "paySel",      /* {uid}        toggle a card into the pitch selection   */
  "payConfirm",  /*              commit the payment and resolve the play  */
  "payCancel",   /*              abandon it; nothing has been spent yet   */
  "defend",      /* {uid}        toggle a defender (hand card or gear)    */
  "pass",        /*              pass priority — CR 4.2.2                 */
  "arsenal",     /* {uid|null}   end-phase step (b); null leaves it empty */
  "endTurn",
  "concede"
];

/* ---- reading and writing ---------------------------------------------
   `act`/`foe` are ACTOR-relative and are what rules code uses. There is
   deliberately no `you`/`opp` in this file: those mean seat 0, which is a
   question about whose screen this is, and no rule has ever wanted it. */
const actorOf = g => g.actor != null ? g.actor : g.turnPlayer;
const act = g => g.sides[actorOf(g)];
const foe = g => g.sides[P.other(actorOf(g))];
const at  = (g, i) => g.sides[i];
const put = (g, i, o) => S.withSide(g, i, o);

/* The hero BUILD of whoever is resolving (v2.41's `bAct`, moved here).
   A passive read off a captured seat-0 build fires for the wrong hero the
   moment seat 1 acts — that is the bug this shape exists to prevent. */
const bAct = g => (g.builds || [])[actorOf(g)] || {};
const bOf  = (g, i) => (g.builds || [])[i] || {};

const LOG_KEEP = 40;
const say = (g, msg) => msg == null ? g : ({...g,
  log:  [msg, ...(g.log || [])].slice(0, LOG_KEEP),
  feed: [...(g.feed || []), msg]});

const find = (zone, uid) => (zone || []).findIndex(c => c && c.uid === uid);

/* A uid that cannot collide with a dealt card. `tokSeq` counts from 1 and
   so does the loadout's card numbering, so a raw counter shares a uid with
   a real card — which the invariant judge caught in live play as
   CARD-IN-TWO-ZONES. Every minted uid is prefixed at the source. */
function mint(g, tag){
  const n = (g.tokSeq || 0) + 1;
  return {g: {...g, tokSeq: n}, uid: tag + n};
}

/* THE SINGLE PATH INTO A GRAVEYARD, and it stamps the turn.
   `_gy` is what answers the whole "discarded a card with 6 or more {p}
   this turn" family. A new path that forgets it makes those cards quietly
   wrong, so there is exactly one. Ephemeral cards cease to exist instead
   (Crouching Tiger's printed reminder text). */
const EPHEMERAL = /if it would be put into a graveyard from anywhere, instead it ceases to exist/i;
const toGrave = (g, i, cards) => put(g, i, s => ({...s,
  grave: [...cards.filter(c => !EPHEMERAL.test(c.tx || "")).map(c => ({...c, _gy: g.turn})),
          ...(s.grave || [])]}));

/* ---- the match --------------------------------------------------------
   Two heroes, two builds, one seeded stream. No seat is privileged and
   there is no branch for "the opponent": seat 0 and seat 1 are the same
   construction with different arguments, which is the whole contract. */
function newMatch(o){
  o = o || {};
  const builds = o.builds || [];
  const first = o.first != null ? o.first : 0;

  const sides = [0, 1].map(i => {
    const b = builds[i] || {};
    const int = b.int != null ? b.int : 4;
    return S.makeSide({
      id: i,
      name: (o.names && o.names[i]) || ("Seat " + i),
      hero: b.HZOOM ? b.HZOOM.name : null,
      heroKey: (o.heroKeys && o.heroKeys[i]) || null,
      hp: b.hp != null ? b.hp : 20, maxHp: b.hp != null ? b.hp : 20,
      int, baseInt: int,
      deck: (b.deck || []).slice(int),
      hand: (b.deck || []).slice(0, int),
      gear: b.gear || [],
      board: b.startItem ? [b.startItem] : []
    });
  });

  let g = S.makeGame({sides, firstPlayer: first, rng: o.rng, seed: o.seed});
  g = {...g, builds, tokSeq: o.tokSeq || 0, actor: first};
  g = say(g, at(g, first).name + " takes the first turn.");
  /* CR 4.3.2 — the action point is issued on ENTERING the action phase,
     and toPhase is the only place that ever happens. */
  return P.toPhase(g, "action");
}

/* ---- the interaction states -------------------------------------------
   The trainer carries eight `mode` strings that conflate two unrelated
   things: which CR phase/step the game is in, and which half-finished
   interaction the acting seat is inside. Those come apart here.

   `phase`/`step`/`priority` are the CR machine and belong to priority.js.
   `pending` is an interaction — a payment being assembled, a boost being
   offered — and it belongs to ONE seat. While it is set, that seat may
   only finish or abandon it, and the other seat may do nothing at all.
   The CR has no "pay step"; this is a UI affordance and is modelled as
   one, which is why it is not a phase. */
const pendingOf = g => g.pending || null;
const blockedBy = (g, seat) => {
  const p = pendingOf(g);
  if(!p) return null;
  return p.seat === seat ? null : at(g, p.seat).name + " is mid-decision";
};

/* ---- legality ---------------------------------------------------------
   Null when legal, else the reason. Two properties earn it its own
   function: a guest calls it before sending so an illegal tap never
   leaves the phone, and the sequencer calls it again before committing so
   a stale or buggy guest cannot push a bad action into the shared log.
   One predicate, both ends.

   It never restates a priority rule. Everything about who may act comes
   from priority.js; this asks only the zone and cost questions that
   module deliberately owns nothing about. */
function legal(g, a, seat){
  if(!g || !a) return "no action";
  if(g.over) return "the game is over";
  if(seat !== 0 && seat !== 1) return "no such seat";
  if(ACTIONS.indexOf(a.t) < 0) return "unknown action: " + a.t;
  if(a.t === "concede") return null;

  const busy = blockedBy(g, seat);
  if(busy) return busy;
  const p = pendingOf(g);

  /* Inside a payment nothing else is legal, including for the seat that
     opened it. Letting a second play start mid-payment is how a pitch
     selection came to be inherited by the next payment (v2.19). */
  if(p && p.kind === "pay"){
    if(["paySel", "payConfirm", "payCancel"].indexOf(a.t) < 0)
      return "finish paying for " + p.card.name + " first";
    if(a.t === "paySel"){
      if(find(at(g, seat).hand, a.uid) < 0) return "card is not in hand";
      if(a.uid === p.card.uid) return "a card cannot pitch for itself";
      return null;
    }
    if(a.t === "payConfirm"){
      const have = at(g, seat).res + paySum(at(g, seat));
      return have >= p.need ? null : "still " + (p.need - have) + " short";
    }
    return null;
  }
  if(["paySel", "payConfirm", "payCancel"].indexOf(a.t) >= 0) return "nothing to pay for";

  /* CR 7.3.2 — declaring defenders is a free, simultaneous game-state
     action, NOT a priority action. It is the one thing a seat may do
     while the other holds priority, and therefore the one moment both
     seats can legally act at once. That is why net.js needs a sequencer. */
  if(a.t === "defend"){
    if(!P.canDeclareDefenders(g, seat)) return "not your defend step";
    const sd = at(g, seat);
    const gi = find(sd.gear, a.uid);
    if(gi >= 0){
      const piece = sd.gear[gi];
      if(gearDef(piece) <= 0) return piece.name + " has no defence left";
      /* CR 7.3.2b — a piece already spent on THIS chain cannot block
         again. It clears when the chain breaks, not when the turn ends. */
      if((sd.chainBlocked || []).indexOf(a.uid) >= 0) return piece.name + " already blocked this chain";
      return null;
    }
    const ci = find(sd.hand, a.uid);
    if(ci < 0) return "card is not in hand or gear";
    const c = sd.hand[ci];
    if(c.def == null) return c.name + " prints no defence";
    /* CR 8.1.3 — a defence reaction is played in the reaction step at
       instant speed; it is never DECLARED as a defending card. */
    if(PR.isDR(c)) return c.name + " is a defence reaction — play it in the reaction step";
    return null;
  }

  if(a.t === "arsenal"){
    if(g.phase !== "end" || g.arsenalFor !== seat) return "not your arsenal step";
    if(a.uid == null) return null;
    return find(at(g, seat).hand, a.uid) < 0 ? "card is not in hand" : null;
  }

  if(a.t === "endTurn"){
    if(seat !== g.turnPlayer) return "not your turn";
    if(g.phase !== "action") return "not in the action phase";
    if(g.chainOpen) return "the combat chain is still open";
    return null;
  }

  if(!P.hasPriority(g, seat)) return "you do not hold priority";
  if(a.t === "pass") return null;

  if(a.t === "play"){
    const sd = at(g, seat);
    const zone = a.from || "hand";
    const i = find(sd[zone], a.uid);
    if(zone === "arsenal"){
      if(!sd.arsenal || sd.arsenal.uid !== a.uid) return "nothing of yours in the arsenal";
    } else if(i < 0) return "card is not in your " + zone;
    const c = zone === "arsenal" ? sd.arsenal : sd[zone][i];
    const win = P.speedAllowed(g, seat);
    if(!win.length) return "no window is open for you";
    return playableWhy(g, seat, c, win);
  }

  if(a.t === "activate"){
    const sd = at(g, seat);
    const gi = find(sd.gear, a.uid);
    if(gi < 0) return "no such equipment";
    const piece = sd.gear[gi];
    if(piece.destroyed) return piece.name + " is destroyed";
    const wc = PR.weaponCost(piece.tx || "");
    if(!wc) return piece.name + " has no weapon attack to activate";
    /* ONCE PER TURN IS PRINTED, NOT UNIVERSAL — see parser.js weaponCost.
       Sledge of Anvilheim and Scorpio, Comet Tail do not print it and may
       swing again for anyone who can pay again. */
    if(wc.oncePerTurn && (sd.weaponUsed || {})[a.uid]) return piece.name + " has already swung this turn";
    const win = P.speedAllowed(g, seat);
    if(win.indexOf("action") < 0) return "no action-speed window — a weapon cannot swing here";
    if(!(sd.ap > 0)) return "no action point left";
    return null;
  }
  return "unhandled action: " + a.t;
}

/* Is this card legal in this window, and can this seat afford it?
   Split out because the hand-dim logic needs the same answer — a card
   that looks playable and does nothing when tapped is the failure mode
   this codebase cares most about, and it is caused by a second copy of
   this test drifting from the first. There is one copy. */
function playableWhy(g, seat, c, win){
  win = win || P.speedAllowed(g, seat);
  const sd = at(g, seat);

  /* CR 8.1.1 / 8.1.6 — an ACTION costs an action point; an instant does
     not. The trainer refused any play at 0 action points, which made
     every instant in the pool cost a turn's action it does not print. */
  if(costsAP(c) && !(sd.ap > 0)) return "no action point left";

  const rx = win.filter(w => w === "attack-reaction" || w === "defense-reaction")[0];
  if(rx){
    /* CR 8.1.2a / 8.1.3a — a reaction belongs to the reaction step and to
       ONE SEAT within it. `speedAllowed` picks the window by attacker;
       `rxAllowed` asks whether this card belongs in that window. */
    if(!rxAllowed(c, rx)) return c.name + " cannot be played in the " + rx + " window";
  } else if(win.indexOf("action") < 0){
    /* An instants-only window. */
    if(!instantSpeed(c)) return c.name + " is not an instant — this window is instant speed only";
  } else {
    /* The open action window. A reaction is NOT legal here (CR 8.1.2a) —
       23 pool cards were playable on your own turn before this. */
    if(PR.isAR(c)) return c.name + " is an attack reaction — it belongs to the reaction step";
    if(PR.isDR(c)) return c.name + " is a defence reaction — it belongs to the reaction step";
  }

  /* Playing an attack requires an action-speed window: the layer step or
     the resolution step, which is how a chain grows a second link
     (CR 7.6.3a). */
  if(isAttack(c) && win.indexOf("action") < 0)
    return "no action-speed window — an attack cannot start here";

  return null;
}

/* What the selected pitch is worth. */
const paySum = sd => (sd.paySel || []).reduce((t, uid) => {
  const c = (sd.hand || []).find(x => x.uid === uid);
  return t + ((c && c.pitch) || 0);
}, 0);

/* ---- driving the machine ----------------------------------------------
   priority.js owns no zones by design, so every step's zone work happens
   here. `settle` runs after any priority change: it asks the machine
   whether the window has closed and, if so, advances one step and applies
   what that step implies.

   It loops because one pass can cascade, and it terminates because
   `advance` hands priority back to the turn-player, reopening a window. */
function settle(g){
  for(let guard = 0; guard < 24; guard++){
    if(g.over) return g;

    /* CR 7.7.1 — nobody holds priority in the close step, so NO PLAYER
       ACTION CAN DRIVE IT. A settle loop that waits for a pass here parks
       the game in a step neither seat can leave. priority.js lets this
       one step through without checking `windowClosed`; this is the
       caller honouring that. */
    if(g.step === "close"){
      const nx = P.advance(g);
      if(nx === g) return g;
      g = closeChain(nx);
      continue;
    }

    const out = P.passOutcome(g);

    /* CR 4.2.2 / 7.7.4 — everyone passed with a layer still on the stack.
       THE STEP DOES NOT END: the top layer resolves and the turn-player
       gets priority back. Treating this as "advance" skips a whole
       reaction window, so the defending player is never asked. */
    if(out === "resolve-layer"){
      g = resolveLayer(g);
      continue;
    }
    if(out !== "advance") return g;

    const before = g.step;
    const next = P.advance(g);
    if(next === g) return g;
    g = next;

    /* DAMAGE IS DEALT ON ENTERING THE STEP, NOT ON LEAVING IT.
       CR 7.5: the damage step begins, the attack deals its damage, and
       THEN players get priority — which is what makes a window exist in
       which "when this hits" has already happened. `actions.js` strikes
       on the way out, which is fine for a blank game with nothing hanging
       off a hit and wrong for a real one. */
    if(g.step === "damage" && before !== "damage") g = strike(g);
    if(g.step === "resolution" && before !== "resolution") g = resolveLink(g);
  }
  return g;
}

/* A layer resolves off the top of the stack. Stage A has no card effects,
   so a layer is a reaction's printed contribution and resolving it is the
   pop plus the handoff; the effects port gives it a payload. */
function resolveLayer(g){
  const top = g.stack[g.stack.length - 1];
  let n = P.reset({...g, stack: g.stack.slice(0, -1)});
  return say(n, (top && top.name ? top.name : "A layer") + " resolves.");
}

/* ---- the damage step (CR 7.5) -----------------------------------------
   One body, whichever seat is swinging. The defending side is whoever
   priority.js says it is, its wall is whatever it declared, and the
   damage lands on it. There is no second copy of this for the other
   direction, which is the entire point. */
function strike(g){
  const link = g.pend;
  if(!link) return g;
  const atk = P.attackingPlayer(g), def = P.defendingPlayer(g);
  let n = g;
  const sd = at(n, def);

  /* CR 7.3.2 — every declared defender's printed defence sums, and the
     total reduces the attack once. Report each card's real contribution
     rather than a running remainder, which makes the last blocker look
     weaker than it is. */
  const parts = [];
  let wall = 0, handBlockers = 0;
  const spentGear = [], spentHand = [];

  for(const uid of (sd.blockG || [])){
    const gi = find(sd.gear, uid);
    if(gi < 0) continue;
    const piece = sd.gear[gi];
    wall += gearDef(piece);
    parts.push(piece.name + " " + gearDef(piece));
    spentGear.push(uid);
  }
  for(const uid of (sd.blockH || [])){
    const c = (sd.hand || []).find(x => x.uid === uid);
    if(!c) continue;
    wall += (c.def || 0);
    handBlockers++;
    parts.push(c.name + " " + (c.def || 0));
    spentHand.push(c);
  }

  /* Equipment WEARS rather than leaving; a card GOES to the graveyard. */
  n = put(n, def, s => ({...s,
    gear: (s.gear || []).map(x => spentGear.indexOf(x.uid) >= 0 ? gearBlockApply(x) : x),
    chainBlocked: [...(s.chainBlocked || []), ...spentGear],
    hand: (s.hand || []).filter(c => spentHand.indexOf(c) < 0),
    blockedHand: handBlockers}));
  if(spentHand.length) n = toGrave(n, def, spentHand);

  const total = Math.max(0, (link.total || 0) - wall);
  n = put(n, def, s => ({...s, hp: s.hp - total}));

  n = {...n, chain: [...(n.chain || []).slice(0, -1),
        {...(n.chain || [])[n.chain.length - 1], dmg: total}],
       pend: {...link, dealt: total, wall, handBlockers}};

  /* CR 7.5.5 — if prevention means no damage is dealt it is NOT a hit, so
     nothing that keys off a hit may fire. The log must not claim one. */
  if(total > 0){ n = {...n, hitSeq: (n.hitSeq || 0) + 1, lastDmg: total}; }

  n = say(n, link.name + " resolves for " + total
    + (wall ? ". Wall of " + wall + " — " + parts.join(", ") + " — stops " + Math.min(wall, link.total) + "." : "."));
  return winCheck(n, atk);
}

/* ---- the resolution step (CR 7.6) -------------------------------------
   Go again pays out here (CR 7.6.2), and CR 5.3.5 is precise about what
   it is: "the controlling player GAINS 1 action point." Not a refund and
   not a skipped cost — which is why the arithmetic is spelled out rather
   than folded into `ga ? keep : -1`. For an action that is spend-then-gain
   and reads the same; for an instant it is a genuine +1. */
function resolveLink(g){
  const link = g.pend;
  if(!link) return g;
  let n = g;
  if(link.ga){
    n = put(n, link.by, s => ({...s, ap: (s.ap || 0) + 1}));
    n = say(n, "Go again — action point kept.");
  }
  return n;
}

/* ---- the close step (CR 7.7) ------------------------------------------
   EVERY CARD MUST LAND IN A ZONE. `invariants.js` catches a card in TWO
   zones; a card in NONE falls out of the census and is invisible to it.
   So the chain's cards are filed, turn-stamped, and the declarations
   cleared for both seats. */
function closeChain(g){
  let n = g;
  const spent = n.chainCards || [];
  for(const {by, card} of spent) n = toGrave(n, by, [card]);
  for(let i = 0; i < 2; i++){
    n = put(n, i, s => ({...s, blockH: [], blockG: [], blockRx: [], chainBlocked: []}));
  }
  return {...n, pend: null, stack: [], chainCards: []};
}

const winCheck = (g, by) => {
  for(let i = 0; i < 2; i++){
    if(at(g, i).hp <= 0)
      return say({...g, over: {winner: P.other(i), how: "life"}, priority: null},
        at(g, i).name + " is down. " + at(g, P.other(i)).name + " takes it.");
  }
  return g;
};

/* ---- the reducer ------------------------------------------------------ */
function reduce(g, a, seat){
  const why = legal(g, a, seat);
  if(why) return {state: g, error: why};
  /* THE ACTOR IS WHOEVER IS ACTING. The trainer had to thread this by
     hand and a hardcoded seat index was a recurring bug (popRunechants
     popped seat 0's runechants whoever swung). Set once, here. */
  let n = {...g, actor: seat};

  switch(a.t){
    case "concede":
      n = {...n, over: {winner: P.other(seat), how: "concession"}, priority: null};
      n = say(n, at(n, seat).name + " concedes.");
      break;

    case "play":      n = doPlay(n, a, seat); break;
    case "activate":  n = doActivate(n, a, seat); break;
    case "paySel":    n = doPaySel(n, a, seat); break;
    case "payConfirm":n = doPayConfirm(n, seat); break;
    case "payCancel": n = doPayCancel(n, seat); break;
    case "defend":    n = doDefend(n, a, seat); break;
    case "arsenal":   n = doArsenal(n, a, seat); break;
    case "pass":      n = settle(P.pass(n)); break;
    case "endTurn":   n = doEndTurn(n, seat); break;
  }
  return {state: n, error: null};
}

/* ---- play ------------------------------------------------------------- */
function doPlay(g, a, seat){
  const zone = a.from || "hand";
  const sd = at(g, seat);
  const card = sd[zone][find(sd[zone], a.uid)];
  const cost = effCost(card, sd);

  /* PITCHING IS ON DEMAND, NEVER PROACTIVE (ruling, 2026-08-01): you
     cannot pitch to bank resources. The pool is filled only when a cost
     exceeds what you hold, and then you may pitch OR cancel. */
  if(cost > sd.res){
    return say({...g, pending: {kind: "pay", seat, card, from: zone, need: cost}},
      card.name + " costs " + cost + " and you hold " + sd.res + " — pitch, or cancel.");
  }
  return commitPlay(g, card, zone, seat);
}

/* A WEAPON SWING IS AN ATTACK THAT COMES FROM THE GEAR ZONE.
   Same payment, same chain link, same combat steps — the only differences
   are that the piece stays equipped rather than moving zones, and that it
   may be spent for the turn. Dorinthea's whole deck is built around this;
   without it half the pool cannot play its game at all. */
function doActivate(g, a, seat){
  const sd = at(g, seat);
  const piece = sd.gear[find(sd.gear, a.uid)];
  const wc = PR.weaponCost(piece.tx || "");
  const cost = wc.cost || 0;
  if(cost > sd.res){
    return say({...g, pending: {kind: "pay", seat, card: piece, from: "weapon", need: cost}},
      piece.name + " costs " + cost + " to swing and you hold " + sd.res + " — pitch, or cancel.");
  }
  return commitPlay(g, piece, "weapon", seat);
}

function doPaySel(g, a, seat){
  const sel = (at(g, seat).paySel || []);
  const next = sel.indexOf(a.uid) >= 0 ? sel.filter(u => u !== a.uid) : [...sel, a.uid];
  return put(g, seat, s => ({...s, paySel: next}));
}

function doPayCancel(g, seat){
  /* Nothing has been spent — the selection is abandoned, not refunded.
     Clearing paySel here is what stops the next payment inheriting it,
     which shipped in v2.18 because the field was written as a top-level
     game key and the side kept its old value. */
  let n = put(g, seat, s => ({...s, paySel: []}));
  return say({...n, pending: null}, "Payment cancelled.");
}

function doPayConfirm(g, seat){
  const p = g.pending;
  const sd = at(g, seat);
  const sel = sd.paySel || [];
  const pitched = sel.map(u => sd.hand.find(c => c.uid === u)).filter(Boolean);
  const gained = pitched.reduce((t, c) => t + (c.pitch || 0), 0);

  let n = put(g, seat, s => ({...s,
    hand: s.hand.filter(c => sel.indexOf(c.uid) < 0),
    pitch: [...(s.pitch || []), ...pitched],
    res: (s.res || 0) + gained,
    paySel: []}));
  n = say(n, "Pitched " + pitched.map(c => c.name).join(", ") + " for " + gained + ".");
  n = {...n, pending: null};
  return commitPlay(n, p.card, p.from, seat);
}

/* The card is paid for and leaves its zone. An attack opens a chain link;
   anything else resolves and is filed. */
function commitPlay(g, card, zone, seat){
  /* A WEAPON SWING IS AN ATTACK even though a weapon's printed type line
     is not an attack action — `isAttack` reads the type line and a Sword
     is a Sword. The trainer says the same thing as
     `isAttack(card) || from==="weapon"`. */
  const fromWeapon = zone === "weapon";
  const attacking = isAttack(card) || fromWeapon;
  const cost = fromWeapon ? (PR.weaponCost(card.tx || "") || {}).cost || 0
                          : effCost(card, at(g, seat));
  /* CR 8.1.1 / 8.1.6 — the action point is an ACTION's cost. An instant
     pays none, which is 24 pool cards and 26 "Instant - …" abilities that
     used to eat the turn's action. */
  const apCost = costsAP(card) ? 1 : 0;
  let n = put(g, seat, s => ({...s,
    /* the piece stays equipped; it is spent, not moved */
    ...(fromWeapon ? {weaponUsed: {...(s.weaponUsed || {}), [card.uid]: true}}
                   : {[zone]: zone === "arsenal" ? null : s[zone].filter(c => c.uid !== card.uid)}),
    res: (s.res || 0) - cost,
    ap: (s.ap || 0) - apCost,
    hist: {...s.hist,
      [attacking ? "atk" : "non"]: (s.hist[attacking ? "atk" : "non"] || 0) + 1,
      blue: (s.hist.blue || 0) + (card.pitch === 3 ? 1 : 0),
      red:  (s.hist.red  || 0) + (card.pitch === 1 ? 1 : 0)}}));

  if(attacking) return declareAttack(n, card, seat, fromWeapon);

  /* A non-attack resolves and is filed. Its EFFECTS are the next pass —
     see the header. Go again is still honoured, because it is a printed
     keyword rather than a parsed effect and getting it wrong changes the
     turn (CR 5.3.5: a GAIN, not a refund). */
  const ga = fxParse(card).ga;
  if(ga) n = put(n, seat, s => ({...s, ap: (s.ap || 0) + 1}));
  n = toGrave(n, seat, [card]);
  n = say(n, at(n, seat).name + " plays " + card.name + (ga ? " — go again." : "."));
  return n;
}

function declareAttack(g, card, seat, fromWeapon){
  const total = card.power || 0;
  let n = {...g,
    chain: [...(g.chain || []), {n: card.name, img: card.img, dbImg: card.dbImg,
                                 dmg: null, ga: fxParse(card).ga, kind: "atk"}],
    pend: {name: card.name, card, by: seat, total, ga: fxParse(card).ga},
    /* THE COMBAT CHAIN IS A ZONE, and `chainCards` is it.
       A card mid-chain is in no side zone at all, which `invariants.js`
       cannot see: it catches a card in TWO zones, and a card in NONE just
       falls out of the census. Holding them in a named game-level zone —
       rather than a private `_` field — is what lets the census count
       them. Equipment is NOT filed here: a weapon stays equipped and is
       spent, so it never leaves the gear zone. */
    chainCards: fromWeapon ? (g.chainCards || []) : [...(g.chainCards || []), {by: seat, card}],
    featured: {card, chip: "LINK " + ((g.chain || []).length + 1)}};
  n = P.declareAttack(n, seat);
  n = say(n, at(n, seat).name + (fromWeapon ? " swings " : " attacks with ") + card.name + " for " + total + ".");
  return settle(n);
}

/* ---- defenders (CR 7.3.2) ---------------------------------------------
   Free and simultaneous, and a toggle rather than a commit: a seat may
   change its mind until the step ends, which it does when both pass. */
function doDefend(g, a, seat){
  const sd = at(g, seat);
  const isGear = find(sd.gear, a.uid) >= 0;
  const key = isGear ? "blockG" : "blockH";
  const cur = sd[key] || [];
  const on = cur.indexOf(a.uid) < 0;
  const name = (isGear ? sd.gear.find(x => x.uid === a.uid) : sd.hand.find(x => x.uid === a.uid)).name;
  let n = put(g, seat, s => ({...s,
    [key]: on ? [...cur, a.uid] : cur.filter(u => u !== a.uid)}));
  return say(n, at(n, seat).name + (on ? " declares " : " withdraws ") + name + ".");
}

/* ---- the arsenal step (CR 4.4.3b) -------------------------------------
   An END-PHASE step, not an action. The trainer mapped it to the action
   phase with the player holding priority, which CR 4.4.1 forbids — and
   which PRIORITY-IN-CLOSED-PHASE could never catch, because a guard
   cannot fire against a derivation that disagrees with it. */
function doArsenal(g, a, seat){
  let n = g;
  if(a.uid != null){
    const c = at(n, seat).hand.find(x => x.uid === a.uid);
    n = put(n, seat, s => ({...s, hand: s.hand.filter(x => x.uid !== a.uid), arsenal: c}));
    n = say(n, "(b) " + c.name + " is set in the arsenal, face down.");
  } else {
    n = say(n, "(b) Arsenal left empty — nothing set.");
  }
  return endPhaseAfterArsenal({...n, arsenalFor: null}, seat);
}

/* ---- the end phase, in the CR's ORDER (CR 4.4.3) ----------------------
   An ORDERED procedure, and the order is load-bearing. The trainer ran
   `e -> c -> b -> f` with (a) and (d) missing entirely; (d) and (e) are
   invisible while one seat acts and are real two-player bugs the moment a
   second seat has a turn between yours — a permanent would stay tapped
   through the opponent's turn, and a hero who banks a resource during
   your turn would keep it.

   Split at (b) because the arsenal set is a CHOICE: the turn-player is
   asked, and the rest of the procedure runs when they answer. */
function doEndTurn(g, seat){
  let n = say({...g}, "— End phase —");
  n = P.toPhase(n, "end");

  /* (a) all allies' life resets to base. */
  for(let i = 0; i < 2; i++){
    const out = GM.resetAllyLife(n, i);
    n = out.game || n;
    (out.msgs || []).forEach(m => { n = say(n, m); });
  }
  n = say(n, "(a) Allies recover.");

  /* (b) the turn-player may arsenal. Ask, then continue in doArsenal. */
  const hand = at(n, seat).hand;
  if(!at(n, seat).arsenal && hand.length && PR.arsFree(at(n, seat)) > 0)
    return say({...n, arsenalFor: seat}, "(b) Set a card in your arsenal, or skip.");
  return endPhaseAfterArsenal(say(n, "(b) No arsenal set."), seat);
}

function endPhaseAfterArsenal(g, seat){
  let n = g;

  /* (c) ALL players put their pitch zones on the bottom of their decks. */
  for(let i = 0; i < 2; i++){
    const pz = at(n, i).pitch || [];
    if(pz.length) n = put(n, i, s => ({...s, deck: [...s.deck, ...pz], pitch: []}));
  }
  n = say(n, "(c) Pitch zones go to the bottom of their decks.");

  /* (d) the turn-player untaps all permanents. Folding this into the NEXT
     turn's setup is invisible with one acting seat and wrong with two: a
     permanent would stay tapped through the opponent's whole turn. */
  n = put(n, seat, s => ({...s, weaponUsed: {}}));
  n = say(n, "(d) " + at(n, seat).name + " untaps.");

  /* (e) ALL players lose action and resource points (CR 4.4.3e). Only the
     turn-player's fizzled before — a Wizard who banks a resource off
     Spellfire Cloak during your turn must lose it at the end of it.
     priority.js's endTurn does both seats and passes the seat. */
  const wasted = at(n, seat).res;
  n = P.endTurn(n);
  if(wasted) n = say(n, "(e) " + wasted + " floating resource(s) fizzle.");
  else n = say(n, "(e) Points clear.");

  /* (f) the turn-player draws to intellect — and on the FIRST turn of the
     game, so does everyone else (CR 4.4.3f). That is what pays the second
     player back for blocking the opening swing. */
  const first = g.turn === 1;
  const seats = first ? [n.turnPlayer, P.other(n.turnPlayer)] : [n.turnPlayer];
  for(const i of seats){
    n = drawTo(n, i);
    if(n.over) return n;
  }
  n = say(n, "(f) " + seats.map(i => at(n, i).name).join(" and ") + " draw" + (seats.length > 1 ? "" : "s") + " to intellect."
    + (first && seats.length > 1 ? " (CR 4.4.3f — first turn only.)" : ""));

  n = put(n, n.turnPlayer, s => ({...s, hist: S.freshHist()}));
  n = P.toPhase(n, "action");                       /* CR 4.3.2 issues the AP */
  return say(n, "— " + at(n, n.turnPlayer).name + "'s turn " + n.turn + " —");
}

/* Draw to intellect, and lose to fatigue rather than drawing from nothing.
   An empty deck with an empty hand is a lost game; an empty deck with
   cards still in hand is merely a short hand. */
function drawTo(g, i){
  const sd = at(g, i);
  const need = Math.max(0, (sd.int || 0) - sd.hand.length);
  if(!need) return g;
  const drawn = sd.deck.slice(0, need);
  let n = put(g, i, s => ({...s, hand: [...s.hand, ...drawn], deck: s.deck.slice(drawn.length)}));
  if(drawn.length < need && at(n, i).hand.length === 0){
    n = {...n, over: {winner: P.other(i), how: "fatigue"}, priority: null};
    n = say(n, at(n, i).name + " has nothing left to draw — fatigued. "
              + at(n, P.other(i)).name + " wins by attrition.");
  }
  return n;
}

return {ACTIONS, newMatch, legal, reduce, settle, strike, closeChain,
        playableWhy, drawTo, winCheck,
        actorOf, act, foe, at, put, bAct, bOf, say, toGrave, mint, paySum, pendingOf};
});
