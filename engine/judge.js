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
   costing no action point (CR 8.1.6), the arsenal step, attack-targets
   (CR 1.4.5), and the ordered end phase (CR 4.4.3a-f).

   AND, SINCE v2.77: card EFFECTS. This file calls `engine/effects.js` —
   the ONE copy of the card semantics — and adds none of its own. See "THE
   CARD SEMANTICS" below for the seventeen things that module asks a
   caller for and where each of them comes from.

   The split that came before it was deliberate and load-bearing while it
   lasted: getting the orchestration right was the part that did not
   exist, the card semantics already worked, and building the skeleton
   first meant a control-flow bug could never be confused for a card being
   read wrong. That is the same discipline that keeps `actions.js` free of
   card text so a transport failure cannot masquerade as a parser failure,
   and it is why `sparring.js` still reads no card text at all.

   WHAT REPLACES IT AS THE GUARD RAIL: this file contributes no semantics.
   A drill fails if it grows a `fxParse`/`classifyClause` call of its own,
   because the moment there are two readings of a card there are two
   engines again.

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
                             require("./parser.js"), require("./game.js"), require("./types.js"),
                             require("./effects.js"), require("./cards.js"), require("./prompts.js"));
  else root.DawnJudge = factory(root.DawnPriority, root.DawnSides, root.DawnRNG,
                                root.DawnParser, root.DawnGame, root.DawnTypes,
                                root.DawnEffects, root.DawnCards, root.DawnPrompts);
})(typeof self!=="undefined" ? self : this, function(P, S, RNG, PR, GM, TY, E, C, PM){

const {effCost, fxParse} = PR;
const {gearDef, gearBlockApply} = GM;

/* EVERY TYPE QUESTION GOES TO types.js. The trainer asks them with a
   scatter of ad-hoc regexes that have drifted from each other before —
   `rxAllowed` exists because five hand-rolled copies of "may this be
   played here" disagreed, and the drift showed up as a card that looked
   playable and did nothing when tapped. One parse, one answer.

   `_instant` is not a printed type: it is how build.js marks a powCard
   carrying an equipment's "Instant - …" ability, so it is asked
   separately rather than smuggled into the type line.

   There is deliberately no `instantSpeed` helper beside these. One was
   defined here and never called, which is the shape that gets reached
   for later by somebody who wanted `playWindowFor` or `typeCostsAP` —
   the same reasoning that deleted `DawnGame.shuffle` in v2.26 rather
   than leaving a shorter name next to the right one. */
const isAttack = c => TY.isAttack(c);

/* Every action a seat can take. Serializable by construction: a uid, a
   zone name, an index — never a card object and never a closure. That is
   what lets the same action drive a local tap, a replay and a peer. */
const ACTIONS = [
  "play",        /* {uid, from}  play a card from a zone                  */
  "activate",    /* {uid}        swing a weapon from the gear zone        */
  "paySel",      /* {uid}        toggle a card into the pitch selection   */
  "payConfirm",  /*              commit the payment and resolve the play  */
  "payCancel",   /*              abandon it; nothing has been spent yet   */
  "boost",       /* {yes}        pay boost's additional cost, or decline  */
  "defend",      /* {uid}        toggle a defender (hand card or gear)    */
  "pass",        /*              pass priority — CR 4.2.2                 */
  "arsenal",     /* {uid|null}   end-phase step (b); null leaves it empty */
  "endTurn",     /*              a PASS carrying the turn-player's intent */
  "concede",
  /* A PROMPT IS ADDRESSED TO A SIDE, and until v2.77 nothing here could
     answer one. That is not a missing screen: several cards defer their
     whole payload into the answer — `arcaneHit` rides the damage out on
     a soak, a printed "unless they pay" hangs its consequence off a toll
     — so an unanswerable sheet is arcane damage that never lands and a
     printed cost that is never charged. */
  "promptSel",    /* {i}          toggle a card / an option on the sheet  */
  "promptChoose", /* {choice}     pick a printed mode, pay or decline     */
  "promptConfirm",/*              resolve it                             */
  "promptDecline" /*              the declining half of an OPTIONAL sheet */
];
const PROMPT_ACTIONS = ["promptSel", "promptChoose", "promptConfirm", "promptDecline"];

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

/* -1 for anything that is not an array, so a caller that reaches for a
   non-list zone gets a refusal rather than a TypeError. `arsenal` holds
   ONE card or null, not a list, and `legal` threw on `from:"arsenal"`
   until this was defensive — a legality check that throws is worse than
   one that says no, because the reducer's contract is that an illegal
   action leaves the state untouched and never crashes the caller. */
const find = (zone, uid) => Array.isArray(zone) ? zone.findIndex(c => c && c.uid === uid) : -1;

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

/* ============================================================
   THE CARD SEMANTICS (v2.77) — judge.js becomes a CALLER

   Until now this file modelled the turn structure, the combat chain and
   the costs, and resolved no card text at all. `effects.js` held all of
   it and only the trainer could reach it, which is why solo play resolved
   every effect and table play resolved none.

   THE SPLIT WAS DELIBERATE AND IT IS OVER. It was right while it lasted:
   a control-flow bug and a card being read wrong must never be
   confusable, and keeping the two engines apart is what made every fix
   this year attributable. What ended it is that the customer changed —
   it used to be the networked table, and it is now every hero of card
   text that would otherwise have to be written into whichever engine you
   happen to point them at.

   THIS FILE ADDS NO CARD SEMANTICS. Not one. It supplies the seventeen
   things `effects.js` asks a caller for, and every one of them is either
   a name this file already exported or a two-line adapter over one:

     act foe actorOf bAct        already here, and already actor-relative
     bFoe                        bOf(g, other)
     L                           say
     gy gyDisc                   the turn stamp, through the ONE ephemeral
                                 test this file already owns
     actMut foeMut               the trainer's mutable idiom, safe here
                                 because it clones `sides` and the side
                                 ITSELF — pinned in test/merge.test.js
     had6ThisTurn                one pure line over the stamped graveyard
     mkRune winCheck typeAbbr    adapters
     tokSeq                      a per-call counter, see below
     openPrompt db               the two genuinely new things

   THE UID COUNTER IS THE ONE THING THAT DOES NOT FIT A PURE REDUCER.
   `effects.js` asks for `tokSeq()` — a bare call that hands back the next
   number — because in the trainer it is a React ref. Here the counter
   lives ON the state as `g.tokSeq`, so the context is built FRESH for
   each reduce, closed over a cell seeded from the state, and the cell is
   written back when the call returns. Nothing outlives the call, so
   `reduce` stays pure and a replay of the same log mints the same uids.

   THE DATABASE IS NOT STATE. `db` is a lookup table, identical on both
   peers — the lobby faults on a card-data skew before a hero is even
   chosen — so it is registered once with `setDb` rather than carried on
   the game object, where it would be dead weight to every rule and 62KB
   on a wire that drops large messages without an error. With no db
   registered, token creation refuses in a log line rather than throwing,
   which is the same graceful answer effects.js already gives.
   ============================================================ */

let _db = null;
/* Registered once by whoever loaded the cards. Returns the db so a caller
   can assert it took. */
function setDb(db){ _db = db || null; return _db; }
/* AN UNREGISTERED DATABASE MUST REFUSE, NOT THROW. `resolveEntry` reads
   `db.byName` unguarded — correct, because the trainer always has a real
   one — so handing it a bare `{}` is a TypeError from inside a reducer
   whose contract (test/fuzz.test.js) is that it never throws and never
   mutates on refusal. An empty BUILT db answers "no such card" instead,
   which is the graceful answer effects.js already knows how to log. */
let _empty = null;
const getDb = () => _db || (_empty || (_empty = C.buildMaps([])));

/* THE TRAINER'S MUTABLE IDIOM, and it is safe here for a specific reason
   rather than by luck: it clones `n.sides` AND `n.sides[i]` before handing
   back something writable, so a caller that passes `{...g}` and takes the
   result never has anything it still holds written through. That is what
   `Battle` has always relied on via `setG`, and test/merge.test.js drives
   it — including the nested `hist` object — because the whole merge rests
   on it and it has to keep being true as effects.js grows. */
const mutAt = (n, i) => { n.sides = n.sides.slice(); n.sides[i] = {...n.sides[i]}; return n.sides[i]; };

/* The runechant token, read out of the database. NEVER invented: it is a
   printed card with printed text, and the whole reason runechants are
   board auras rather than an integer is that seven pool cards ask about
   auras generically. */
const RUNE_ENTRY = {name: "Runechant", p: 0, code: null, q: 1};
function runeCard(){
  const rec = C.resolveEntry(getDb(), RUNE_ENTRY);
  return (rec && rec.resolved) ? rec : null;
}

/* ---- prompts: queue, then drain ---------------------------------------
   Effects QUEUE a spec on `promptQ` and never open one inline, because
   the action has to finish resolving first. This drains the head into a
   live sheet. `buildPrompt` returns null when there is nothing to ask —
   an empty zone, fewer than two modes, a cost nobody can pay — so a
   prompt that has become pointless skips itself rather than showing an
   empty sheet and stalling a seat that cannot answer it.

   The sheet is addressed to a SIDE (`spec.side`), which at a table is the
   difference between "your call" and "waiting on them". */
function openPrompt(g){
  const q = g.promptQ || [];
  if(!q.length) return q === g.promptQ && !g.prompt ? g : {...g, prompt: null, promptQ: []};
  const [p, ...rest] = q;
  const live = PM.buildPrompt(g, p);
  if(!live) return openPrompt({...g, promptQ: rest});
  return {...g, promptQ: rest, prompt: live};
}

/* THE ANSWER A SEAT WITH NOBODY IN IT WOULD GIVE (v2.77).

   A live sheet stops the game for both seats, which is correct — whatever
   queued it is mid-resolution — and it means every seat must be able to
   answer. At a table both are people. In a local session, in a regression
   run and in `sparring.run`, one or both are not.

   IT IS NOT CALLED FROM `reduce`, ever. Answering on a player's behalf is
   the caller's decision, not the rules', and a policy quietly answering a
   modal nobody knew was there is the kind of thing that only surfaces in
   a game weeks later. The session asks for it; the reducer never does.

   The two answers that carry real money are DELEGATED to the pure
   policies in effects.js, because they are the same decision the trainer
   already makes for seat 1 and a second copy of "is this worth paying
   for" is a second opinion about the same card:

     soak   `soakPolicy` — do not spend more resources than the damage is
            worth, unless it is lethal, in which case nothing you hold is
            worth more than being alive
     pay    `payPolicy`  — the same brake, plus: never pitch your LAST
            card to avoid discarding a card

   The rest are structural and text-free: decline what is optional, take
   the minimum where a minimum is printed, and leave an `opt` in the order
   it came. A policy that always took the maximum would be inventing
   value it cannot read. */
function autoAnswer(g){
  const p = g && g.prompt;
  if(!p) return null;
  const sd = at(g, p.side || 0);
  if(p.tag === "soak"){
    const want = E.soakPolicy(p, sd);
    for(let i = 0; i < (p.options || []).length; i++)
      if(want.indexOf(i) >= 0 && (p.sel || []).indexOf(i) < 0) return {t: "promptSel", i};
    return {t: "promptConfirm"};
  }
  if(p.tag === "pay")
    return p.choice == null
      ? {t: "promptChoose", choice: E.payPolicy(p, sd) ? "pay" : "decline"}
      : {t: "promptConfirm"};
  if(p.tag === "modal")  return p.choice == null ? {t: "promptChoose", choice: 0} : {t: "promptConfirm"};
  /* CR 1.4.5 makes a target mandatory, so there is no declining it. */
  if(p.tag === "target") return p.choice == null ? {t: "promptChoose", choice: 0} : {t: "promptConfirm"};
  if(p.tag === "pick"){
    if((p.sel || []).length < (p.min || 0)){
      for(let i = 0; i < (p.cards || []).length; i++)
        if((p.sel || []).indexOf(i) < 0) return {t: "promptSel", i};
    }
    return {t: "promptConfirm"};
  }
  return {t: "promptConfirm"};
}

/* THE CONTEXT, BUILT FRESH PER CALL. `cell` is the uid counter; the
   caller writes it back. Nothing here reads a card's text: every entry is
   an accessor, a stamp or an adapter. */
function effectsFor(g){
  const cell = {n: g.tokSeq || 0};
  const stamp = (turn, cards, disc) => cards
    .filter(c => c && !EPHEMERAL.test(c.tx || ""))
    .map(c => disc ? {...c, _gy: turn, _disc: true} : {...c, _gy: turn});
  const ctx = {
    L: say,
    act, foe, actorOf, bAct,
    bFoe: g2 => bOf(g2, P.other(actorOf(g2))),
    actMut: n => mutAt(n, actorOf(n)),
    foeMut: n => mutAt(n, P.other(actorOf(n))),
    db: getDb(),
    gy:     (turn, ...cards) => stamp(turn, cards, false),
    gyDisc: (turn, ...cards) => stamp(turn, cards, true),
    /* "you've DISCARDED a card with 6 or more {p} this turn" — a discard,
       not a graveyard census. An attack reaches the graveyard AT
       DECLARATION, so without `_disc` any 6-power attack already played
       satisfies the condition, and one satisfies it for itself. */
    had6ThisTurn: g2 => (act(g2).grave || [])
      .some(c => c._gy === g2.turn && c._disc && PR.pow6(c, bAct(g2))),
    mkRune: (g2, count) => {
      if(!(count > 0)) return g2;
      const tok = runeCard();
      if(!tok) return say(g2, "Runechant: the token is not in the card database — none created.");
      let n = GM.addRunechants(g2, actorOf(g2), count, tok, () => ++cell.n);
      const h = mutAt(n, actorOf(n));
      /* "played or CREATED an aura this turn" reads both of these. */
      h.hist = {...h.hist, made: (h.hist.made || 0) + count, aura: (h.hist.aura || 0) + count};
      return n;
    },
    openPrompt,
    tokSeq: () => ++cell.n,
    typeAbbr: GM.typeAbbr,
    winCheck: g2 => winCheck(g2)
  };
  return {fx: E.makeEffects(ctx), cell};
}

/* Run a body of card semantics and put the uid counter back on the state.
   Every call into effects.js goes through here, so the counter cannot be
   dropped by one caller and kept by another. */
function withEffects(g, body){
  const {fx, cell} = effectsFor(g);
  const out = body(fx, {...g});
  if(out == null) return g;
  const back = s => s.tokSeq === cell.n ? s : {...s, tokSeq: cell.n};
  /* Some pieces report a number alongside the state (`linkPumps` returns
     the attack's total, `linkPayload` the total it actually dealt), so the
     shape is `{game, …}` rather than a bare state. Carry it through. */
  return out.game ? {...out, game: back(out.game)} : back(out);
}

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

  /* THE BUILD'S `deck` AND `gear` ARE CONSTRUCTION INPUTS, NOT STATE.
     They have just been dealt into `sides[i]`, so retaining them puts
     the same 43 cards in the game object TWICE — dead to every rule
     (nothing reads a build's deck; `bAct` exists for the passives) and
     ruinous on a wire: they were 62KB of a 67KB opening snapshot, which
     a WebRTC data channel drops without an error. The guest then sat in
     `handshaking` forever holding a board that looked perfectly correct,
     because it had built the same opening itself.

     What a build is kept FOR is the printed passives a rules site reads
     through `bAct` — Viserai's rite, Gravy Bones's watery grave — plus
     the hero records the effects port will want. Those are small. */
  const rulesBuild = b => { const {deck, gear, ...rest} = b || {}; return rest; };

  let g = S.makeGame({sides, firstPlayer: first, rng: o.rng, seed: o.seed});
  g = {...g, builds: builds.map(rulesBuild), tokSeq: o.tokSeq || 0, actor: first};
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

  /* A LIVE SHEET STOPS THE GAME UNTIL IT IS ANSWERED, and it stops it for
     BOTH seats. The asked seat may only answer; the other may do nothing,
     because whatever is waiting on the answer is mid-resolution. This is
     the same shape as `pending`, and for the same reason: letting play
     continue around it is how a deferred payload gets abandoned. */
  if(g.prompt){
    if(PROMPT_ACTIONS.indexOf(a.t) < 0)
      return at(g, g.prompt.side || 0).name + " is answering " + (g.prompt.src || "a prompt");
    if(seat !== (g.prompt.side || 0)) return "that sheet is not addressed to you";
    if(a.t === "promptConfirm" && !PM.promptReady(g.prompt))
      return "the sheet is not answered yet";
    return null;
  }
  if(PROMPT_ACTIONS.indexOf(a.t) >= 0) return "there is no sheet to answer";

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
  /* THE BOOST QUESTION STOPS THE GAME THE SAME WAY A PAYMENT DOES, and for
     the same reason: an additional cost is part of playing the card, so
     the card is mid-play until it is answered. There is no cancel — the
     play is already committed by this point, and "no" is a complete
     answer to "you may". */
  if(p && p.kind === "boost"){
    if(a.t !== "boost") return "answer boost for " + p.card.name + " first";
    return null;
  }
  if(a.t === "boost") return "nothing to boost";

  if(["paySel", "payConfirm", "payCancel"].indexOf(a.t) >= 0) return "nothing to pay for";

  /* CR 7.3.2 — declaring defenders is a free, simultaneous game-state
     action, NOT a priority action. It is the one thing a seat may do
     while the other holds priority, and therefore the one moment both
     seats can legally act at once. That is why net.js needs a sequencer. */
  if(a.t === "defend"){
    if(!P.canDeclareDefenders(g, seat)) return "not your defend step";
    /* CR 7.3.2a — only a HERO attack-target may have cards declared for
       it: "the hero being attacked may declare any number of
       non-defense-reaction cards … Otherwise, a player may only declare
       cards for an attack-target if a rule or effect specifies it."
       Nothing in this pool specifies it, so an attack on an ally cannot
       be blocked — which is the whole reason targeting one is a decision
       rather than a worse way to hit the hero. */
    if(!GM.targetCanBeDefended(g.pend && g.pend.target))
      return "an attack on an ally cannot be blocked (CR 7.3.2a)";
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

  /* THE TURN PLAYER CANNOT END THE TURN OVER THE OPPONENT'S HEAD.
     CR 4.3.4 ends the action phase "when the stack is empty, the combat
     chain is closed, and both players pass priority in succession" — the
     opponent's last window is part of the rule, not a courtesy.

     So `endTurn` is not a separate transition; it is a PASS that carries
     the turn-player's intent, and it needs priority like any other pass.
     It stays a distinct action because a UI button and a replay log both
     read better for it, and because it is refused in exactly the places
     "end my turn" is not what the player means — mid-chain, or when it is
     not their turn. */
  if(a.t === "endTurn"){
    if(seat !== g.turnPlayer) return "not your turn";
    if(g.phase !== "action") return "not in the action phase";
    if(g.chainOpen) return "the combat chain is still open";
    if(!P.hasPriority(g, seat)) return "you do not hold priority";
    return null;
  }

  if(!P.hasPriority(g, seat)) return "you do not hold priority";
  if(a.t === "pass") return null;

  if(a.t === "play"){
    const sd = at(g, seat);
    const zone = a.from || "hand";
    /* THE ARSENAL IS ONE CARD, NOT A LIST — check it before reaching for
       an index, or the list path runs against an object. */
    let c;
    if(zone === "arsenal"){
      if(!sd.arsenal || sd.arsenal.uid !== a.uid) return "nothing of yours in the arsenal";
      c = sd.arsenal;
    } else {
      if(!Array.isArray(sd[zone])) return "there is no " + zone + " to play from";
      const i = find(sd[zone], a.uid);
      if(i < 0) return "card is not in your " + zone;
      c = sd[zone][i];
    }
    /* WHICH ZONES A CARD MAY BE PLAYED FROM (v3.00). This asked only
       whether the card was THERE, so every card in a graveyard was
       playable at the table — driven, a vanilla Brutal Assault went from
       the graveyard onto the combat chain with `legal` returning null.
       The rule existed, in `playables()`, which is the trainer's UI and
       somewhere this reducer cannot reach; `parser.playableFromZone` is
       the one copy now. The game's half of the question — whose hero
       grants watery grave, and whether a blue card has hit the graveyard
       this turn — is supplied here, because the parser is pure. */
    if(!PR.playableFromZone(c, zone, {wateryGrave: !!bOf(g, seat).wateryGrave,
                                      blueGY: (sd.hist || {}).blueGY || 0, turn: g.turn}))
      return c.name + " cannot be played from your " + zone;
    const win = P.speedAllowed(g, seat);
    if(!win.length) return "no window is open for you";
    return playableWhy(g, seat, c, win) || targetWhy(g, seat, c, a.target);
  }

  if(a.t === "activate"){
    const sd = at(g, seat);
    /* ---- AN ACTIVATED ABILITY ON A CARD IN HAND (v3.05) --------------
       "Instant - Discard this: Amp 1" — four pool cards across three
       heroes print one, and the route was built in `Battle` (v2.63), so
       none of the four could be activated here. `handAbilityOK` is the
       shared question and `activateHandAbility` the shared body. */
    if(a.from === "hand"){
      const hi = find(sd.hand, a.uid);
      if(hi < 0) return "card is not in your hand";
      const c = sd.hand[hi];
      const ha = PR.fxParse(c).handAbility;
      if(!ha) return c.name + " prints no ability to activate";
      /* THE PRINTED RULE IS ASKED FIRST. Ordered the other way, a player
         who simply is not defending was told about a missing board
         feature instead of the restriction their card prints — a refusal
         that names the wrong thing teaches the wrong lesson. */
      if(!E.handAbilityOK({...g, actor: seat}, c)){
        const gate = PR.fxParse(c).activateIf;
        return c.name + (gate ? " can't be activated — " + gate.why
                              : "'s ability can't be activated right now");
      }
      /* AND THEN what this board cannot yet route. `runOps` cannot raise
         ONE defender, so a +{d} needs a per-defender bonus map: the
         trainer keeps one (`defBonus`) and this board does not. Rally the
         Coast Guard is the only pool card in that shape, and it is
         reachable only while it is itself defending. Refused by name
         rather than silently dropped. */
      if(ha.ops.some(o => o[0] === "defBuff"))
        return c.name + "'s +{d} needs a per-defender bonus this board does not keep yet";
      const want = ha.kind === "instant" ? "instant" : "action";
      if(P.speedAllowed(g, seat).indexOf(want) < 0)
        return "no " + want + "-speed window for " + c.name;
      /* CR 8.1.6 — an instant costs no action point. */
      if(want !== "instant" && !(sd.ap > 0)) return "no action point left";
      return null;
    }
    const gi = find(sd.gear, a.uid);
    if(gi < 0) return "no such equipment";
    const piece = sd.gear[gi];
    if(piece.destroyed) return piece.name + " is destroyed";
    /* ---- AN ACTIVATED ABILITY IS NOT A WEAPON SWING (v3.04) ----------
       This refused every non-weapon piece outright, so **17 non-weapon
       equipment abilities across 12 heroes were dead at the table** —
       Spellfire Cloak, Knucklehead, Bull's Eye Bracers, Pouncing Paws,
       every one of them. Measured, not guessed: `legal` answered
       "Spellfire Cloak is equipment, not a weapon".

       It is the shape this cycle keeps finding — a route that exists on
       one board only, because `Battle` built it as UI. The trainer's own
       path is `tryPlay(gr.powCard, "hero", i)`, so this is the same call
       with the same powCard, and `execute` marks the once-per-turn flag
       (`weaponUsed["gp"+uid]`) for both. */
    if(!TY.isWeaponType(piece)){
      if(!piece.pow || !piece.powCard) return piece.name + " prints no activated ability";
      const ab = piece.powCard;
      /* Matching the trainer, deliberately: an ability is available once
         per turn. Most of these are "Destroy this:" and spend themselves;
         the rest print `Once per Turn`. Widening it here would be a NEW
         rules claim on the board that is not the regression harness. */
      if((sd.weaponUsed || {})[ab.uid]) return piece.name + "'s ability is spent this turn";
      const gate = PR.fxParse(ab).activateIf;
      if(gate && !E.activateIfOk({...g, actor: seat}, gate, piece))
        return piece.name + " can't be activated — " + gate.why;
      const want = ab._instant ? "instant" : "action";
      if(P.speedAllowed(g, seat).indexOf(want) < 0)
        return "no " + want + "-speed window for " + piece.name;
      /* CR 8.1.1 / 8.1.6 — an ACTIVATED ability costs an action point; an
         instant does not. `costsAP` is the one reader of that rule. */
      if(!ab._instant && !(sd.ap > 0)) return "no action point left";
      if((ab.cost || 0) > sd.res + payCeiling(sd, null))
        return piece.name + " costs " + ab.cost + " to activate and you cannot raise it";
      return null;
    }
    const wc = PR.weaponCost(piece.tx || "");
    if(!wc) return piece.name + " prints no weapon attack";
    /* TWO SEPARATE LIMITS, and honouring only one gets a card wrong in a
       different direction each time (see parser.js weaponCost):

         `oncePerTurn`  printed on nine of the eleven swinging weapons
         `taps` ({t})   Scorpio, Comet Tail — a tapped permanent does not
                        untap until CR 4.4.3d in the end phase

       Sledge of Anvilheim has neither and is genuinely repeatable. */
    if((wc.oncePerTurn || wc.taps) && (sd.weaponUsed || {})[a.uid])
      return piece.name + (wc.taps ? " is tapped until your end phase" : " has already swung this turn");
    const win = P.speedAllowed(g, seat);
    if(win.indexOf("action") < 0) return "no action-speed window — a weapon cannot swing here";
    if(!(sd.ap > 0)) return "no action point left";
    /* Same rule as a card: an activation the seat cannot fund is not
       legal, and offering it opens a payment with no way out but cancel. */
    if((wc.cost || 0) > sd.res + payCeiling(sd, null))
      return piece.name + " costs " + wc.cost + " to swing and you cannot raise it";
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

  /* SOME CARDS HAVE NO PLAY AT ALL, and it is a property of their TYPE.
     Equipment is worn, a weapon is activated from the gear zone, and a
     Block card (Test of Might, Test of Strength, On the Horizon, Crash
     and Bash) may only be pitched or declared as a defender. All of them
     print no cost, so a cost-based test would let every one through as a
     free 0-cost play that does nothing. */
  const noPlay = TY.noPlayReason(c);
  if(noPlay && !c._instant) return c.name + ": " + noPlay;

  /* WHICH WINDOW IS THIS CARD BEING PLAYED IN?
     A card can print TWO types — `Assassin / Warrior Action Defense
     Reaction - Trap` is both — so this is an intersection, not a match.
     Den of the Spider is legal in the action phase AND in the defence
     window, and a reader that picks one type and stops refuses it half
     the time. */
  const mine = c._instant ? ["instant"] : TY.playWindows(c);
  const open = win.filter(w => mine.indexOf(w) >= 0);

  if(!open.length){
    /* Name the window in BOTH directions rather than dead-tapping: a
       refusal a player cannot read is indistinguishable from a bug. */
    const here = win.indexOf("action") >= 0 ? "the action phase"
               : win.indexOf("attack-reaction") >= 0 ? "the attack-reaction window"
               : win.indexOf("defense-reaction") >= 0 ? "the defence-reaction window"
               : "an instant-speed window";
    if(mine.length === 1 && mine[0] === "action")
      return c.name + " is an action — it cannot be played during " + here;
    if(mine.indexOf("attack-reaction") >= 0)
      return c.name + " is an attack reaction — it belongs to the reaction step, not " + here;
    if(mine.indexOf("defense-reaction") >= 0)
      return c.name + " is a defence reaction — it belongs to the reaction step, not " + here;
    return c.name + " cannot be played in " + here;
  }

  /* CR 8.1.1 / 8.1.6 — an ACTION card costs an action point to play; an
     instant and a reaction do not. For a dual-typed card the cost
     depends on WHICH window it is being played in, which is why the
     window is an argument: Den of the Spider costs an action point in
     the action phase and none as a defence reaction. If any open window
     is free, the play is affordable. */
  const free = open.some(w => !TY.typeCostsAP(c, w));
  if(!free && !(sd.ap > 0)) return "no action point left";

  /* A PRINTED TARGET RESTRICTION IS A LEGALITY, NOT A MODIFIER (v3.11).
     "Target sword or dagger attack gets +3{p}" cannot be PLAYED at all
     when the attack on the chain is neither — the card has no legal
     target. The trainer has refused it since v2.69; at the table the
     reaction was resolving, the refusal was a log line, and the card had
     already left the hand and paid. A player losing a card to a play the
     rules never allowed is the worst kind of dead tap.

     Only the attack window: `pend` is the attack being reacted to, and a
     DEFENCE reaction answers a swing that does not live there. */
  if(open.indexOf("attack-reaction") >= 0 && PR.isAR(c)){
    const q = PR.fxParse(c).selfQ;
    if(q && !PR.qualMatches(q, g.pend && g.pend.card)){
      const want = q.map(gr => gr.join(" ")).join(" or ");
      return c.name + " targets a " + want + " attack — "
           + ((g.pend && g.pend.card) ? g.pend.card.name : "this attack") + " isn't one";
    }
  }

  /* A PLAY YOU CANNOT PAY FOR IS NOT A LEGAL PLAY. Resources come from
     the pool plus whatever the rest of the hand can pitch, so `payCeiling`
     is the most this seat could possibly raise.

     Leaving it out is not harmless: `legal` said yes, `doPlay` opened a
     payment that could never be completed, and the only move left was to
     cancel back into the identical state — a live-lock for any driver
     that trusts `legal` (which is the contract), and a dead tap for a
     human, which is the failure mode this codebase cares most about. */
  const cost = effCost(c, sd);
  if(cost > sd.res + payCeiling(sd, c))
    return c.name + " costs " + cost + " and you cannot raise it";

  return null;
}

/* ---- attack-targets (CR 1.4.5) ----------------------------------------
   "If a player plays, activates, or triggers an attack … the player MUST
   declare an attackable object controlled by an opponent as the
   attack-target", and CR 1.4.5a makes an ally attackable because an ally
   is a living object — it has life.

   The target rides on the ACTION (`{t:"play", uid, target}`), not in a
   prompt, so the reducer stays pure and serializable: the same action
   drives a tap, a replay and a peer. `targets()` is the list a UI or a
   policy offers; omitting `target` falls back to the hero, which is
   always a legal choice. Making the CHOICE mandatory is the caller's
   half — offering it — and is noted in the module header.

   With no ally in the arena there is exactly one target and nothing to
   ask, which is why solo play against the dummy never sees this. */
const targets = (g, defIdx, heroCard) => GM.attackTargets(g, defIdx, heroCard);
const targetOf = (g, seat, spec) => {
  const def = P.other(seat);
  if(spec == null || spec === "hero") return {kind: "hero", side: def, uid: null};
  const list = GM.attackTargets(g, def);
  const hit = list.find(t => t._target.kind === "ally" && t._target.uid === spec);
  return hit ? hit._target : null;
};
function targetWhy(g, seat, c, spec){
  if(spec == null || !isAttack(c)) return null;
  return targetOf(g, seat, spec) ? null : "no such attack-target";
}

/* The most this seat could put into the pool right now: what is already
   floating plus every pitch value left in hand. A card never pitches for
   itself (`legal` refuses that too), and the arsenal is face down — only
   the hand pitches. */
const payCeiling = (sd, self) => (sd.hand || [])
  .reduce((t, c) => t + (self && c.uid === self.uid ? 0 : (c.pitch || 0)), 0);

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

    /* CR 4.3.4 — "when the stack is empty, the combat chain is closed,
       and both players pass priority in succession, the action phase ends
       and the game proceeds to the End Phase."

       Nothing else can move here. `advance` has no transition out of the
       layer step — that step is left to `declareAttack` — so without this
       a mutual pass left the game in a closed window that no seat could
       act in: `speedAllowed` correctly returned [] for both, the
       turn-player was refused with "you do not hold priority", and the
       only way out was an explicit endTurn the CR does not require. */
    if(P.actionPhaseEnds(g)) return doEndTurn(g, g.turnPlayer);

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
    /* CARD TEXT THAT NEEDS THE DEFENDERS TO EXIST (CR 7.3 -> 7.4).
       Phantasm reads the cards declared against the attack, so it is not
       declaration-time text at all — the trainer has run it at exactly
       this moment since v2.73 and this board never ran it at all, because
       `afterDefenders` was only ever called from `index.html`. Driven, a
       6-power blocker met Spears of Surreality and the attack resolved
       for 2 anyway while the feed explained the drawback. Sev-3, on the
       board the merge is making the default. */
    if(g.step === "reaction" && before === "defend") g = afterDefenders(g);
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
/* ---- the defend step has closed (CR 7.3.4 -> 7.4) ----------------------
   `effects.js` owns WHAT the text does; this owns WHO is defending and
   what "the attack is gone" means here. The wall is the defending seat's
   declared hand cards — phantasm reads no other kind, and equipment is
   held on `blockG` precisely because it is a different thing.

   A popped attack is DESTROYED, so it must leave the chain and land in a
   zone: `closeChain` is already the one place that files chain cards
   through `fileAttack`, so the link is closed here rather than given a
   second, quieter description of where a spent card goes. */
function afterDefenders(g){
  const link = g.pend;
  if(!link) return g;
  const def = P.defendingPlayer(g), sd = at(g, def);
  const wall = (sd.blockH || []).map(uid => (sd.hand || []).find(c => c.uid === uid)).filter(Boolean);
  const out = withEffects({...g, actor: P.attackingPlayer(g)},
    (fx, s) => fx.afterDefenders(s, wall));
  if(!out._fizzled) return out;
  const n = {...out}; delete n._fizzled;
  return closeChain(P.reset(n));
}

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

  /* THE ACTOR IS THE ATTACKER for everything the link does. Every
     `act`/`foe` inside the shared pieces reads it, and a link resolving
     under the wrong actor pops the wrong hero's runechants and credits
     the wrong hero's history. */
  n = {...n, actor: link.by != null ? link.by : atk};

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

  /* Equipment WEARS rather than leaving; a card GOES to the graveyard.

     AND THE DECLARATION IS SPENT WITH IT. A wall defends ONE chain link
     (CR 7.3.2 — defenders are declared in the defend step of the link
     they defend), so `blockH`/`blockG` are cleared here, at the moment
     the wall has done its job. `chainBlocked` is the one that outlives
     the link: CR 7.3.2b keeps a spent piece out of every LATER link of
     the same chain, and it clears when the chain breaks.

     Clearing only at the close step, as this used to, let a declaration
     stand for the rest of the chain: `strike` re-read `blockG` on link 2
     and added the same piece's defence again, with nothing declared and
     nothing paid. The pool hides it almost perfectly — Silver Age
     equipment is nearly all battleworn, so it wears to 0 defence after
     one block and the second helping is worth nothing. A piece that does
     NOT wear blocks every link of the chain for free.

     Hand blockers escaped by accident rather than by rule: they leave the
     hand here, so the lookup on link 2 finds nothing. Cards being gone is
     not the same as the declaration being over, and only one of those
     survives a card that defends from somewhere other than hand. */
  n = put(n, def, s => ({...s,
    gear: (s.gear || []).map(x => spentGear.indexOf(x.uid) >= 0 ? gearBlockApply(x) : x),
    chainBlocked: [...(s.chainBlocked || []), ...spentGear],
    hand: (s.hand || []).filter(c => spentHand.indexOf(c) < 0),
    blockH: [], blockG: [], blockRx: [],
    blockedHand: handBlockers}));
  if(spentHand.length) n = toGrave(n, def, spentHand);

  /* PIECE ONE OF THE SHARED RESOLUTION — every pump that lands before the
     wall is subtracted: reaction layers on the stack, and the printed ops
     that could only be known once defenders existed ("+1 for each
     equipment that defended"). It is asked for the equipment COUNT rather
     than reading the defenders itself, because how a seat holds its
     declarations is this file's business and not the card's. */
  const pre = withEffects(n, (fx, s) => fx.linkPumps(s, {equipDefenders: spentGear.length}));
  n = pre.game;

  const total = Math.max(0, (pre.total || 0) - wall);

  /* CR 1.4.5 — THE ATTACK-TARGET DECIDES WHERE THE DAMAGE LANDS. An
     attack on an ally never touches the hero: CR 7.3.2a lets no cards be
     declared for it, so it always connects, and it kills. That is what
     makes fielding an ally a real decision rather than a free body. */
  if(link.target && link.target.kind === "ally"){
    const out = GM.damageAlly(n, link.target.side, link.target.uid, total);
    n = out.game;
    (out.msgs || []).forEach(m => { n = say(n, m); });
    /* A NEW PATH INTO A GRAVEYARD MUST STAMP THE TURN. `damageAlly` files
       the dead ally itself rather than going through `toGrave`, so `_gy`
       arrives unset — and `_gy` is the single characteristic that answers
       the whole "…a card put into a graveyard this turn" family. An
       unstamped card does not go wrong loudly; it goes wrong quietly. */
    if(out.killed) n = put(n, link.target.side, s => ({...s,
      grave: (s.grave || []).map(c => c._gy == null ? {...c, _gy: n.turn} : c)}));
  } else {
    n = put(n, def, s => ({...s, hp: s.hp - total}));
  }

  n = {...n, pend: {...link, dealt: total, wall, handBlockers}};

  /* PIECE TWO — the payload. Everything the link DOES now that its damage
     has landed: its own ops, its on-hit clauses, the weapon's earned
     counters, the hero ability that frees a blade for one more swing,
     crush, the soul, the chain entry, and CR 5.3.5's action point.

     THE CHAIN ENTRY IS PUSHED IN THERE, NOT HERE. This used to push one
     at declaration and patch its damage in afterwards — one more thing
     that had to agree with the trainer's copy and had nothing keeping it
     honest. The link in flight is `pend` and `featured`, which is what
     both boards render; the chain is the record of what resolved.

     `blkNote` is passed rather than rebuilt: the wall is this file's, but
     what the log SAYS about it should read the same on both boards. */
  const blkNote = wall
    ? ` Wall of ${wall} — ${parts.join(", ")} — stops ${Math.min(wall, pre.total || 0)}.`
    : "";
  const paid = withEffects(n, (fx, s) => fx.linkPayload(s, {
    total, pumps: pre.pumps, handBlockers,
    defenders: spentGear.length + handBlockers, blkNote}));
  n = paid.game;

  /* CR 7.5.5 — if prevention means no damage is dealt it is NOT a hit, so
     nothing that keys off a hit may fire. The log must not claim one. */
  if(total > 0){ n = {...n, hitSeq: (n.hitSeq || 0) + 1, lastDmg: total}; }

  return openPrompt(winCheck(n, atk));
}

/* ---- the resolution step (CR 7.6) -------------------------------------
   Go again pays out at the RESOLUTION, and CR 5.3.5 is precise about what
   it is: "the controlling player GAINS 1 action point." Not a refund and
   not a skipped cost.

   THIS FILE NO LONGER PAYS IT (v2.77). `linkPayload` does, in the one
   copy of the arithmetic — `ap = ga ? ap : ap - 1`, which for an attack
   is spend-then-gain and reads as the familiar "kept". Paying it here as
   well handed the attacker TWO points for one go again, which is the
   direction that steals games and which no coverage tool can see. The
   step still exists because the CR has one and both seats get a priority
   window in it. */
function resolveLink(g){
  return g;
}

/* ---- the close step (CR 7.7) ------------------------------------------
   EVERY CARD MUST LAND IN A ZONE. `invariants.js` catches a card in TWO
   zones; a card in NONE falls out of the census and is invisible to it.
   So the chain's cards are filed, turn-stamped, and the declarations
   cleared for both seats. */
function closeChain(g){
  let n = g;
  const spent = n.chainCards || [];
  /* WHERE each one goes is `effects.fileAttack`'s answer, not this file's
     — a card played from the graveyard is BANISHED rather than filed, and
     a second opinion about that is a second engine. The actor is borrowed
     around the call because effects.js is actor-relative by construction;
     it is restored below, since closing a chain does not make anyone the
     acting player. */
  const keepActor = n.actor;
  for(const {by, card, from} of spent){
    n = withEffects({...n, actor: by}, (fx, s) => fx.fileAttack(s, card, from || "hand"));
  }
  if(spent.length) n = {...n, actor: keepActor};
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

    /* The sheet is data (prompts.js) and the answer is one shared body
       (effects.js's `applyAnswer`). This file supplies neither — it
       decides only WHO may answer and WHEN, which is the same division
       the rest of the merge keeps. */
    case "promptSel":    n = {...n, prompt: PM.promptToggleSel(n.prompt, a.i)}; break;
    case "promptChoose": n = {...n, prompt: PM.promptChoose(n.prompt, a.choice)}; break;
    case "promptDecline":n = {...n, prompt: PM.promptDecline(n.prompt)}; break;
    case "promptConfirm":
      n = withEffects(n, (fx, s2) => fx.applyAnswer(s2, s2.prompt));
      break;

    case "play":      n = doPlay(n, a, seat); break;
    case "activate":  n = doActivate(n, a, seat); break;
    case "paySel":    n = doPaySel(n, a, seat); break;
    case "payConfirm":n = doPayConfirm(n, seat); break;
    case "payCancel": n = doPayCancel(n, seat); break;
    case "boost":     n = doBoost(n, a, seat); break;
    case "defend":    n = doDefend(n, a, seat); break;
    case "arsenal":   n = doArsenal(n, a, seat); break;
    case "pass":      n = settle(P.pass(n)); break;
    /* Identical machinery to `pass`, deliberately. If the opponent has
       already passed this succession the phase ends here (CR 4.3.4, via
       `settle`); if they have not, priority slides to them and they get
       the instant window the CR owes them. The only difference is that
       the log says what the player meant. */
    case "endTurn":
      n = say(n, at(n, seat).name + " passes the turn.");
      n = settle(P.pass(n));
      break;
  }
  return {state: n, error: null};
}

/* ---- play ------------------------------------------------------------- */
function doPlay(g, a, seat){
  const zone = a.from || "hand";
  /* CR 1.4.5 — the attack-target, resolved now and carried through the
     payment, exactly like `window`: the board must not be allowed to
     change under a choice already made while the player pitches. */
  const target = targetOf(g, seat, a.target);
  const sd = at(g, seat);
  const card = zone === "arsenal" ? sd.arsenal : sd[zone][find(sd[zone], a.uid)];
  const cost = effCost(card, sd);
  /* WHICH WINDOW this card is being played in, decided now and carried
     through the payment. It matters for a dual-typed card: Den of the
     Spider costs an action point as an Action and none as a Defense
     Reaction, and the answer must not change while the player pitches. */
  const window = playWindowFor(g, seat, card);

  /* PITCHING IS ON DEMAND, NEVER PROACTIVE (ruling, 2026-08-01): you
     cannot pitch to bank resources. The pool is filled only when a cost
     exceeds what you hold, and then you may pitch OR cancel. */
  if(cost > sd.res){
    /* A LOG LINE IS READ BY BOTH SEATS, SO IT NAMES THE SEAT (v2.83). This
       said "you hold 0" for whichever side was paying, so the dummy's own
       payment appeared in the feed addressed to the player — read from a
       real table as though the game were demanding a pitch nobody had been
       asked for. A REFUSAL is different and stays second person: it is
       returned to the caller who attempted the action, and never enters
       the shared feed. */
    return say({...g, pending: {kind: "pay", seat, card, from: zone, need: cost, window, target}},
      card.name + " costs " + cost + " and " + sd.name + " holds " + sd.res + " — pitch, or cancel.");
  }
  /* THE RESOURCE COST IS SETTLED FIRST, THEN THE ADDITIONAL ONE. Both are
     costs and the CR pays them as a set, so the order they are ASKED in
     cannot change the outcome — declining a boost refunds nothing and
     costs nothing. It matches the trainer's order deliberately, so a
     player who learns one board is not surprised by the other. */
  return maybeBoost(g, card, zone, seat, window, target);
}

/* The window a card is actually being played in: the intersection of
   what priority.js has open and what the card's types allow. When a
   dual-typed card fits both, prefer the FREE one — a player who could
   have played it as a reaction should not be charged an action point for
   the engine's choice of label. */
function playWindowFor(g, seat, card){
  if(card && card._instant) return "instant";
  const open = P.speedAllowed(g, seat).filter(w => TY.playWindows(card).indexOf(w) >= 0);
  if(!open.length) return null;
  return open.find(w => !TY.typeCostsAP(card, w)) || open[0];
}

/* A WEAPON SWING IS AN ATTACK THAT COMES FROM THE GEAR ZONE.
   Same payment, same chain link, same combat steps — the only differences
   are that the piece stays equipped rather than moving zones, and that it
   may be spent for the turn. Dorinthea's whole deck is built around this;
   without it half the pool cannot play its game at all. */
function doActivate(g, a, seat){
  const sd = at(g, seat);
  if(a.from === "hand"){
    const c = sd.hand[find(sd.hand, a.uid)];
    const out = withEffects({...g, actor: seat}, (fx, s) => {
      const r = fx.activateHandAbility(s, c);
      return r.why ? say(s, r.why + ".") : r.game;
    });
    return settle(out);
  }
  const piece = sd.gear[find(sd.gear, a.uid)];
  /* THE ABILITY ROUTE (v3.04). `execute` finds the piece back off the
     powCard's uid ("gp"+uid) for a destroy-cost, so no index is needed —
     the "hero" zone is not a list and nothing splices it. */
  if(!TY.isWeaponType(piece)){
    const ab = piece.powCard, acost = ab.cost || 0;
    if(acost > sd.res)
      return say({...g, pending: {kind: "pay", seat, card: ab, from: "hero", need: acost, target: null}},
        ab.name + " costs " + acost + " and " + sd.name + " holds " + sd.res + " — pitch, or cancel.");
    return commitPlay(g, ab, "hero", seat, null, null);
  }
  const wc = PR.weaponCost(piece.tx || "");
  const cost = wc.cost || 0;
  const target = targetOf(g, seat, a.target);
  if(cost > sd.res){
    return say({...g, pending: {kind: "pay", seat, card: piece, from: "weapon", need: cost, target}},
      piece.name + " costs " + cost + " to swing and " + sd.name + " holds " + sd.res + " — pitch, or cancel.");
  }
  return commitPlay(g, piece, "weapon", seat, null, target);
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
  /* A weapon swing never boosts (boost is printed on attack ACTIONS), but
     this asks rather than assuming — `boostable` reads the keyword, and a
     predicate that reads the card cannot be wrong about a card. */
  return maybeBoost(n, p.card, p.from, seat, p.window, p.target);
}

/* THE CARD RESOLVES, AND ITS TEXT RESOLVES WITH IT (v2.77).

   This used to be the whole of "play a card" here: move it, charge it,
   file it, and its rules text did nothing. `effects.js`'s `execute` is
   the same body with the semantics attached, it is the ONE copy of them,
   and it has been the proven one since long before this file existed —
   solo play runs every card in the pool through it.

   So this delegates, and keeps only the three things `execute` cannot
   know because they are the caller's:

     the WINDOW      which speed this card is being played at, decided at
                     doPlay and carried through the payment so it cannot
                     move while the player pitches. It reaches exactly one
                     line inside execute (the action point) and can only
                     ever make it cheaper.
     the TARGET      CR 1.4.5. The trainer has no attack-targets at all.
     WHAT HAPPENS    execute declares the attack and STOPS (v2.73). Whether
     NEXT            that means a defend step or an action phase is this
                     file's, and that split is the door this merge walks
                     through.

   NOTE WHAT IS NO LONGER HERE. The zone move, the cost, the colour
   history, the action-point arithmetic, go again, arena placement and the
   graveyard filing were all restated here and are all gone — every one of
   them was a second answer to a question effects.js already answers, and
   a second answer is a second engine. The frostbite tax now lands on a
   weapon swing too, which this file's `weaponCost` read silently missed:
   `effCost` is the reader that knows about the tax, and it is the one
   execute uses. */
/* ---- BOOST (v2.84) ----------------------------------------------------
   Printed reminder text, off the card itself, because the database
   carries none for keywords and guessing one would break the golden rule
   at the keyword level:

     Boost (As an additional cost to play this, YOU MAY banish the top
     card of your deck. If it's a Mechanologist card, this gains go again.)

   Three things in that sentence do work, and all three are already true
   of `effects.js`, which is why nothing here resolves anything: it is an
   ADDITIONAL COST (so it is settled at play time, beside the resource
   cost), it is OPTIONAL ("you may"), and the go again rides on the
   banished card's TYPE rather than on the attack's.

   So the only thing missing at the table was the question. 19 pool cards
   print the keyword and every one of them is Dash's. */
const boostable = (card, sd) => !!card && PR.printedKw(card, "boost")
  && !!sd && (sd.deck || []).length > 0;

/* The answer rides to `execute` on the state, because that is the field
   effects.js reads (`n._doBoost`). IT IS STRIPPED AGAIN BELOW: the
   trainer sets it on every play path and so never noticed that nothing
   clears it, which is luck rather than design — a sticky `true` would
   boost the next attack that happened to print the keyword without ever
   asking. A reducer whose state carries a spent answer is one refactor
   away from that being live. */
function commitPlayBoosted(g, card, zone, seat, window, target, doBoost){
  const out = commitPlay({...g, _doBoost: !!doBoost}, card, zone, seat, window, target);
  if(out && out._doBoost !== undefined){ const n = {...out}; delete n._doBoost; return n; }
  return out;
}

/* Ask, or don't. Returns the pending when there is a real choice to make,
   and otherwise plays straight through — the same rule `buildPrompt`
   follows for an empty spec, and the reason an empty deck never shows a
   sheet that can only be answered one way. */
function maybeBoost(g, card, zone, seat, window, target){
  if(!boostable(card, at(g, seat)))
    return commitPlayBoosted(g, card, zone, seat, window, target, false);
  return say({...g, pending: {kind: "boost", seat, card, from: zone, window, target}},
    card.name + " has boost — " + at(g, seat).name
    + " may banish the top card of the deck as an additional cost.");
}

function doBoost(g, a, seat){
  const p = g.pending;
  const n = {...g, pending: null};
  return commitPlayBoosted(n, p.card, p.from, seat, p.window, p.target, !!a.yes);
}

function commitPlay(g, card, zone, seat, window, target){
  /* A WEAPON SWING IS AN ATTACK even though a weapon's printed type line
     says Weapon, not Attack. The trainer says the same thing as
     `isAttack(card) || from==="weapon"`. */
  const fromWeapon = zone === "weapon";
  const sd = at(g, seat);
  /* execute takes an INDEX, because that is how a zone is spliced. The
     arsenal holds one card and is emptied by name rather than by index. */
  const idx = zone === "arsenal" ? 0 : find(sd[zone] || [], card.uid);

  /* THE ACTOR IS SET BEFORE THE CARD RUNS, not after. Every `act`/`foe`
     inside effects.js reads it, and a hardcoded seat in a rules call is
     the bug class v2.25 named (popRunechants popped seat 0's runechants
     whoever was swinging). */
  let n = withEffects({...g, actor: seat},
    (fx, s) => fx.execute(s, card, zone, idx, {window}));

  if(n._declared){
    const d = n._declared; delete n._declared;
    return declareAttack(n, card, seat, zone, target, d);
  }

  /* SOMETHING HAPPENED, SO NOBODY HAS PASSED IN SUCCESSION ANY MORE.
     Every step-end rule in the CR is worded "when the stack is empty and
     all players pass IN SUCCESSION" (CR 7.3.4, 7.4.3, 7.5.4, 7.6.4,
     4.3.4), and a card resolving in between breaks that succession. The
     turn-player then gains priority, which is what CR 4.2.2 / 7.7.4
     describe for a resolved layer.

     Without it the pass record survived the play, and the shape that
     produced is not subtle: the attacker passes in the reaction step, the
     defender answers with a defence reaction, and one further pass from
     the defender ends the step — so the attacker never gets a window to
     respond to the card that was just played at them.

     `reset` is a no-op in a closed phase (`give` refuses priority there),
     so it cannot hand out a window the phase does not have.

     WHERE THE CARD WENT IS ALREADY DECIDED. `execute` placed a permanent
     in the arena off `fx.perm`, filed a spent card to the graveyard
     through the same turn-stamping `gy` every other path uses, and banished
     one played from the graveyard. Restating any of that here is a second
     answer to a question the card semantics already answered. */
  return P.reset(n);
}

function declareAttack(g, card, seat, fromZone, target, declared){
  const fromWeapon = fromZone === "weapon";
  const tgt = target || {kind: "hero", side: P.other(seat), uid: null};
  /* THE TOTAL COMES FROM THE CARD, NOT FROM ITS PRINTED POWER (v2.77).
     `execute` has already applied every pump the card and the board
     printed — the hero's own clause, a queued "+N to your next attack", a
     qualified buff that matched, a boost. Reading `card.power` here would
     throw all of that away and strike for the printed number, which is
     the same shape as a card being read correctly and then CHARGED
     wrongly: invisible to coverage, invisible to fairness, and it makes
     every buff in the game do nothing. */
  const link = g.pend || {};
  const total = declared ? declared.total : (card.power || 0);
  const ga = link.ga != null ? link.ga : fxParse(card).ga;
  let n = {...g,
    /* NO CHAIN ENTRY HERE (v2.77). `linkPayload` pushes it when the link
       RESOLVES, in the one copy both boards share — pushing a placeholder
       here and patching its damage in at the strike was a second copy of
       the entry's shape with nothing keeping the two honest. The attack in
       flight is `pend` plus `featured`, which is what the board renders. */
    /* MERGE, NEVER REPLACE. `execute` built this link: its ops, its
       on-hit clauses, its late conditions, which zone it was declared
       from. What this file adds is the three things the card cannot know
       — who swung it, what it is called in a log line, and CR 1.4.5's
       attack-target. Overwriting the object would silently delete the
       card's entire payload and leave a number. */
    pend: {...link, name: card.name, card, by: seat, total, ga, target: tgt},
    /* execute leaves an `{k:"atk"}` label layer behind for the trainer's
       stack pane. Here the attack is on the CHAIN, and a layer sitting on
       the stack would tell priority.js a reaction is waiting to resolve. */
    stack: [],
    /* THE COMBAT CHAIN IS A ZONE, and `chainCards` is it — for the cards
       that are genuinely in no other one.

       A card mid-chain is in no side zone at all, which `invariants.js`
       cannot see: it catches a card in TWO zones, and a card in NONE just
       falls out of the census. But `execute` files an attack played from
       hand or arsenal to the graveyard AT DECLARATION, which is the model
       the whole `_gy` family is built on — so filing it here as well
       would put one card in two zones, which is the census's loudest
       error and would be OUR bug rather than a caught one.

       Equipment is NOT filed here: a weapon stays equipped and is spent,
       so it never leaves the gear zone. `from` rides along because WHERE
       the card goes at the close step depends on where it came from, and
       `effects.fileAttack` is the one thing that knows. */
    chainCards: fromWeapon ? (g.chainCards || [])
                           : [...(g.chainCards || []), {by: seat, card, from: fromZone}],
    featured: {card, chip: "LINK " + ((g.chain || []).length + 1)}};
  n = P.declareAttack(n, seat);
  n = say(n, at(n, seat).name + (fromWeapon ? " swings " : " attacks with ") + card.name + " for " + total + ".");
  if(declared && declared.declNote && declared.declNote.trim()) n = say(n, declared.declNote.trim());
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
  n = say(n, at(n, seat).name + (on ? " declares " : " withdraws ") + name + ".");
  /* The wall just changed, so an earlier pass no longer stands (CR 7.3.4
     — "all players pass IN SUCCESSION"). In the CR the declaration
     happens at the start of the step and the priority window opens after
     it (CR 7.3.2 then 7.3.3); here it is a toggle the defender may work
     at, so the window is reopened each time the set of defenders moves.
     Otherwise a turn-player who passed early never sees the final block
     they are about to be measured against. */
  return P.reset(n);
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

  /* THE BEGINNING OF THE END PHASE, BEFORE (a) — v3.07. Three printed
     schedules say "at the beginning of your end phase" and the table ran
     none of them; the trainer has had `beginEndPhase` since v2.75 and it
     is one of the last places where one board knew a rule the other did
     not.

     It is genuinely earlier than (a)-(f) rather than a convenient slot:
     Inertia wipes the hand and arsenal, so it has to land before (b)
     invites this seat to arsenal a card that is about to be swept into
     the deck anyway. Same final state either way, which is exactly why
     putting it in the wrong place would never have been noticed.

     CR 4.1.8a orders simultaneous triggers by the turn-player and this
     reducer does not model that choice; the order here matches the
     trainer's so the two boards cannot disagree about a board Inertia
     also sits on. */
  {
    const ri = E.resolveInertia(n, seat);
    if(ri.tokens){
      n = say(ri.game, "Inertia seizes " + at(ri.game, seat).name + " — "
        + (ri.tokens > 1 ? ri.tokens + " tokens shatter" : "the token shatters") + ", and "
        + (ri.wiped ? ri.wiped + " card" + (ri.wiped > 1 ? "s" : "") + " from hand and arsenal go to the bottom of the deck"
                    : "there was nothing left to sweep away") + ".");
    }
    /* Frostbite's OTHER expiry — the play half is in `execute`; this
       clears a Frostbite the frozen seat never spent anything into, so
       the tax cannot follow them into the next turn. */
    const fb = E.thawFrost(n, seat);
    n = fb.game;
    if(fb.thawed)
      n = say(n, "The " + (fb.thawed > 1 ? fb.thawed + " Frostbites" : "Frostbite")
        + " thaw" + (fb.thawed > 1 ? "" : "s") + " unspent at the end of " + at(n, seat).name + "'s turn.");
    const sw = E.sweepArena(n, seat, "end");
    if(sw.msgs.length){
      n = sw.game;
      for(const m of sw.msgs) n = say(n, m);
      if(sw.ops.length)
        n = withEffects({...n, actor: seat}, (fx, s2) => fx.runOps(s2, sw.ops, sw.fired.join(", ")));
    }
  }

  /* (a) all allies' life resets to base.

     `resetAllyLife` returns THE GAME, not `{game, msgs}`. This read
     `out.game`, got undefined, fell back to the unchanged state through
     the `||` and threw the reset away — while still logging "(a) Allies
     recover." every turn. A wounded ally never healed and the drill that
     checks the end phase runs a-f in order could not tell, because it
     reads the LOG. A step that announces itself and does nothing is worse
     than one that is missing. */
  for(let i = 0; i < 2; i++) n = GM.resetAllyLife(n, i);
  n = say(n, "(a) Allies recover.");

  /* (b) the turn-player may arsenal. Ask, then continue in doArsenal. */
  const hand = at(n, seat).hand;
  if(!at(n, seat).arsenal && hand.length && PR.arsFree(at(n, seat)) > 0)
    return say({...n, arsenalFor: seat}, "(b) " + at(n, seat).name + " may set a card in the arsenal, or skip.");
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

  /* (d) the turn-player untaps ALL permanents THEY control. Folding this
     into the NEXT turn's setup is invisible with one acting seat and
     wrong with two: a permanent would stay tapped through the opponent's
     whole turn.

     "All permanents" is the whole arena, not just the gear zone. An ally
     that taps to swing is a permanent in the arena, and it untaps here
     like anything else; leaving `spent` set would retire it after one
     use. Nothing taps an ally yet — allies are attackABLE and do not
     attack (see the module header) — so this is the step being complete
     rather than a bug being fixed, and it is the half that has to exist
     before the other half can be built. */
  n = put(n, seat, s => ({...s,
    weaponUsed: {},
    board: (s.board || []).map(b => b.spent ? {...b, spent: false} : b)}));
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
     player back for blocking the opening swing.

     `seat`, NOT `n.turnPlayer`. (e) above calls priority.js's `endTurn`,
     which performs CR 4.4.4's handoff as well as 4.4.3e's fizzle, so by
     this line `n.turnPlayer` is already the INCOMING player. Reading it
     here refilled the wrong hero every turn after the first, and turn one
     hid it because both seats draw there anyway.

     It is not a cosmetic mix-up: you refill at the end of YOUR turn so
     that you have cards to block with during THEIRS. Drawing for the
     incoming player instead means every hero walks into the opponent's
     turn with whatever blocking they had left and then starts their own
     turn with a full grip — which inverts the block-or-hold decision the
     whole game is built on. */
  const first = g.turn === 1;
  const seats = first ? [seat, P.other(seat)] : [seat];
  for(const i of seats) n = drawTo(n, i);
  n = say(n, "(f) " + seats.map(i => at(n, i).name).join(" and ") + " draw" + (seats.length > 1 ? "" : "s") + " to intellect."
    + (first && seats.length > 1 ? " (CR 4.4.3f — first turn only.)" : ""));

  /* CR 4.4.4 — "effects that last until end of turn end". `hist` is the
     per-turn ledger ("attacks played", "blues pitched"), so BOTH seats'
     clear, not only the incoming one: a card asking "have you pitched a
     blue this turn" during the opponent's turn must not read yours.

     A PER-TURN ALLOWANCE ENDS WITH THE TURN, and it is a different rule
     from untapping. `Once per Turn` means once during each turn, so it
     comes back for BOTH seats at every turn boundary; a TAP is a state
     the permanent is in, and it only lifts when its controller untaps at
     (d) above. `weaponUsed` records both, which is why they are unpicked
     here rather than cleared together.

     They coincide for a weapon swing, because a swing is action speed and
     a seat only reaches its own action phase on its own turn — which is
     exactly the kind of coincidence this project has been bitten by
     before. It stops coinciding the moment an "Instant - Once per Turn"
     equipment ability is activated on the opponent's turn: cleared with
     the tap, that ability would be spent until the end of the user's NEXT
     turn, having been used once across two. */
  for(let i = 0; i < 2; i++) n = put(n, i, s => ({...s,
    hist: S.freshHist(), weaponUsed: perTurnCleared(s)}));

  /* THE START PHASE IS PASSED THROUGH, NOT SKIPPED. `P.endTurn` leaves
     the incoming seat in `phase:"start"` and this line moves them on in
     the same breath, so no state ever RESTS there — which is the correct
     behaviour rather than a shortcut. CR 4.2.1 gives nobody priority in
     the start phase, so the only thing that can happen in it is a
     start-of-turn triggered effect going on the stack, and this reducer
     models no card effects at all. It becomes a real pause the moment one
     of them exists, and that is Phase 3's problem, not a missing step.

     ONE OF THEM EXISTS NOW (v3.00): suspense ticks at the beginning of
     the turn and pays out when the last counter goes. It still does not
     need a pause — nothing may respond to it, because CR 4.2.1 gives
     nobody priority here — so it resolves in the same breath. The rule is
     `effects.tickSuspense`, the same pure function the trainer calls; a
     schedule written into one board's turn boundary is a schedule the
     other board does not have, which is how phantasm came to be inert
     here for three versions. */
  {
    const inc = n.turnPlayer;
    /* FREEZE LIFTS AT THE START OF THE FREEZING PLAYER'S TURN (Cold Snap),
       which is this moment for `inc`. Same shared-schedule rule as the
       suspense tick below it. */
    const fz = E.thawFreeze(n, inc);
    if(fz.thawed.length){ n = say(fz.game, fz.thawed.join(", ") + " thaws — free to be played again."); }
    const sp = E.tickSuspense(n, inc);
    if(sp.msgs.length){
      n = sp.game;
      for(const m of sp.msgs) n = say(n, m);
      /* the payload is the LEAVING controller's, so it resolves with that
         seat as the actor — `buffNext` is written to `act(n)`. */
      if(sp.ops.length)
        n = withEffects({...n, actor: inc}, (fx, s2) => fx.runOps(s2, sp.ops, sp.fired.join(", ")));
    }
    /* "AT THE BEGINNING OF YOUR ACTION PHASE, DESTROY THIS" (v3.07). The
       trainer swept these inline inside `newTurn`, so the table kept them
       forever: Pyroglyphic Protection prevented 1-3 arcane damage every
       turn for the rest of the game. Same shared-schedule rule as the two
       above, and the same actor reasoning for the payload. */
    const sw = E.sweepArena(n, inc, "turn");
    if(sw.msgs.length){
      n = sw.game;
      for(const m of sw.msgs) n = say(n, m);
      if(sw.ops.length)
        n = withEffects({...n, actor: inc}, (fx, s2) => fx.runOps(s2, sw.ops, sw.fired.join(", ")));
    }
  }

  n = P.toPhase(n, "action");                       /* CR 4.3.2 issues the AP */
  return say(n, "— " + at(n, n.turnPlayer).name + "'s turn " + n.turn + " —");
}

/* TWO LIMITS LIVE IN `weaponUsed` AND THEY EXPIRE DIFFERENTLY.
   Drop every entry whose limit is a per-turn ALLOWANCE, and keep every
   entry that records a TAPPED permanent — the tap lifts at CR 4.4.3d,
   for the controller only, and a permanent that is both tapped and
   once-per-turn is still tapped.

   Reading the limit off the piece's own printed text rather than storing
   a kind on the flag is what keeps this from drifting: `weaponCost` is
   already the one reader of that line, and it answers both questions. */
/* `perTurnCleared` moved to parser.js in v2.71 — the trainer needed the
   same answer and a second copy is the no-mirror rule broken in slow
   motion. It reads a printed line, which is parser.js's job. */
const perTurnCleared = PR.perTurnCleared;

/* Draw to intellect, taking whatever the deck still holds.

   THERE IS NO DECK-OUT LOSS IN FLESH AND BLOOD. CR 4.5.3 lists every way
   a player loses and there are exactly three: their hero's life is
   reduced to zero or they control no hero (4.5.3a), an effect says they
   lose (4.5.3b), or they concede (4.5.3c). An empty deck is not on that
   list, and a draw that cannot be filled simply draws what it can.

   This used to end the game by "fatigue" — an invented loss condition,
   and the direction that matters: it hands a win to someone who did not
   earn it while their opponent is still alive and still holding cards.
   A hero who runs their deck out keeps playing, keeps blocking with what
   is in hand, and loses only when their life reaches 0 like anyone. */
function drawTo(g, i){
  const sd = at(g, i);
  const need = Math.max(0, (sd.int || 0) - sd.hand.length);
  if(!need) return g;
  const drawn = sd.deck.slice(0, need);
  let n = put(g, i, s => ({...s, hand: [...s.hand, ...drawn], deck: s.deck.slice(drawn.length)}));
  if(drawn.length < need)
    n = say(n, at(n, i).name + " draws " + drawn.length + " of " + need
              + " — the deck is empty. (CR 4.5.3: that is not a loss.)");
  return n;
}

return {ACTIONS, newMatch, legal, reduce, settle, strike, closeChain,
        playableWhy, drawTo, winCheck, targets, targetOf,
        actorOf, act, foe, at, put, bAct, bOf, say, toGrave, mint, paySum, pendingOf,
        /* the card semantics seam (v2.77) */
        setDb, effectsFor, withEffects, openPrompt, autoAnswer};
});
