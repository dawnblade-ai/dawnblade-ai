/* ============================================================
   Dawnblade engine — lobby.js (Phase 2)

   THE PRE-GAME NEGOTIATION.

   Between "two phones have a channel" and "two phones have a game" there
   are four agreements to reach, and until now there were none: the table
   screen connected and dropped straight into `actions.js`'s blank decks.

     1. do both clients resolve the same cards?   (DATA_VER)
     2. which hero is each seat piloting?
     3. who takes the first turn?                 (the throw, CR-adjacent)
     4. what did each seat sideboard?

   Then both peers build the SAME two decks from the SAME seed and hand
   them to `judge.newMatch`. What crosses the wire is the CHOICE, never
   the deck: a hero key, a gear index list and a cut map — a few dozen
   bytes — and each peer runs `build.js` over its own card database to
   arrive at an identical state. That is rng.js's own stated goal applied
   one level up, and it is what makes the opening hands agree without
   ever shipping a card.

   ---- WHY THIS IS NOT net.js ------------------------------------------

   `net.js` exists for one reason: CR 7.3.2 makes declaring defenders free
   and simultaneous, so in the defend step both seats can legally act at
   the same instant and SOMEBODY has to assign an order. That is what the
   sequencer, the journal and the sequence numbers are all for.

   Nothing in the lobby has that problem. Every message writes only its
   own seat's slot, and every slot is WRITE-ONCE. So the reducer is a
   monotone accumulator: the writes commute, replaying one changes
   nothing, and two peers applying the same set of messages in different
   orders land in the same state. There is no sequencer here and there
   does not need to be. `test/lobby.test.js` drills both properties over
   every permutation rather than trusting the argument.

   WRITE-ONCE IS THE LOAD-BEARING PART, and it is not fussiness. Make a
   hero pick overwritable and this diverges: seat 0 changes its mind at
   the same moment seat 1 confirms, so seat 0 applies the change locally
   while it is still choosing and seat 1 refuses it for arriving after the
   step closed. Two peers, two heroes, no error anywhere. A slot that can
   only be filled once cannot do that — the second write is refused on
   BOTH phones or neither. The UI holds the unconfirmed pick in local
   state and sends nothing until a seat commits.

   ---- THE STEP IS DERIVED, NEVER STORED -------------------------------

   `stepOf(state)` reads the slots. Storing a step would mean a
   transition, a transition has an order, and an order is the thing this
   module is built not to need.

   ---- IT DEALS NO CARDS AND READS NO CARD TEXT ------------------------

   Same discipline that keeps `actions.js` free of the parser and
   `sparring.js` free of `fxParse`: a negotiation bug and a card being
   read wrong must never be confusable. This module moves four small
   values between two phones and answers one question — are we ready. The
   caller builds the decks.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./rps.js"));
  else root.DawnLobby = factory(root.DawnRPS);
})(typeof self!=="undefined" ? self : this, function(RPS){

/* Bumped when the message set or the match spec changes. Two clients on
   different lobby versions must not negotiate: they would agree on a
   spec one of them cannot build. Same discipline as room.js's ROOM_V
   keying the table id and DATA_VER keying the card cache. */
const LOBBY_V = 1;

const MSG = {
  HELLO: "hello",   /* seat -> seat: this is the card data I hold   */
  HERO:  "hero",    /* seat -> seat: I am piloting this hero        */
  THROW: "throw",   /* seat -> seat: my throw for round N           */
  SEAT:  "seat",    /* winner -> loser: this is who goes first      */
  BOARD: "board"    /* seat -> seat: this is what I sideboarded     */
};

const STEPS = ["fault", "hero", "throw", "seat", "board", "ready"];

/* ---- the state --------------------------------------------------------
   Nine fields, and every one of them is either write-once per seat or
   derived from ones that are. `ties` and `round` only ever count up. */
function newLobby(o){
  o = o || {};
  return {
    v: LOBBY_V,
    code: o.code || null,          /* the table number — also the match seed */
    builds: [null, null],          /* each seat's DATA_VER                   */
    heroes: [null, null],          /* hero keys                              */
    round: 0,                      /* which throw round is live              */
    throws: [null, null],          /* this round's throws                    */
    rounds: [],                    /* every resolved round, for the log      */
    ties: 0,
    winner: null,                  /* who won the throw                      */
    first: null,                   /* who takes the first turn               */
    boards: [null, null],          /* {gearIdx, cuts}                        */
    fault: null                    /* set once; the lobby cannot continue    */
  };
}

/* THE STEP IS A READ, NOT A FIELD. Everything above is monotone, so this
   only ever moves forwards, and it moves at the same moment on both
   phones because it is a function of the same slots. */
function stepOf(s){
  if(!s) return "fault";
  if(s.fault) return "fault";
  if(s.heroes[0] == null || s.heroes[1] == null) return "hero";
  if(s.winner == null) return "throw";
  if(s.first == null) return "seat";
  if(s.boards[0] == null || s.boards[1] == null) return "board";
  return "ready";
}

const isSeat = i => i === 0 || i === 1;

/* ---- the reducer ------------------------------------------------------
   `{state, error}` — the state is returned UNCHANGED on a refusal, which
   is the same contract judge.reduce keeps and for the same reason: a
   malformed message off a wire must cost the caller nothing.

   A refusal here is not always a bug. A duplicate delivery replays a
   write-once slot and is refused, and that is the mechanism working. The
   caller distinguishes them by `error.dup`. */
function reduce(s, m){
  const no = (why, dup) => ({state: s, error: dup ? {why, dup: true} : {why}});
  if(!s) return {state: s, error: {why: "no lobby state"}};
  if(!m || typeof m !== "object") return no("not a message");
  if(m.v != null && m.v !== s.v) return no("lobby version mismatch: " + m.v + " vs " + s.v);
  if(!isSeat(m.seat)) return no("no such seat: " + m.seat);
  if(s.fault && m.t !== MSG.HELLO) return no("the lobby has faulted: " + s.fault);

  switch(m.t){

    /* THE CARD-DATA CHECK, AND IT BELONGS HERE RATHER THAN AT net.js's
       HANDSHAKE. net.js compares builds too, but by then both peers have
       already built two decks from the same spec — and if the databases
       differ those decks differ, silently and consistently, which is the
       one failure a state hash cannot describe usefully. Refusing before
       a card is resolved is the difference between "your opponent is on
       older card data" and "/sides/1/deck/17/uid". */
    case MSG.HELLO: {
      if(s.builds[m.seat] != null) return no("seat " + m.seat + " has already said hello", true);
      const builds = s.builds.slice();
      builds[m.seat] = m.build == null ? null : String(m.build);
      let n = {...s, builds};
      if(builds[0] != null && builds[1] != null && builds[0] !== builds[1])
        n = {...n, fault: "card data differs — seat 0 holds " + builds[0] + ", seat 1 holds " + builds[1]};
      return {state: n, error: null};
    }

    case MSG.HERO: {
      if(stepOf(s) !== "hero") return no("heroes are settled", true);
      if(s.heroes[m.seat] != null) return no("seat " + m.seat + " has already chosen", true);
      if(!m.key) return no("no hero");
      const heroes = s.heroes.slice();
      heroes[m.seat] = String(m.key);
      return {state: {...s, heroes}, error: null};
    }

    /* ROUND-STAMPED, because a tie replays. The stamp is what makes a
       late throw from the previous round refusable instead of landing in
       the next one — and it is causally safe: a seat cannot know a round
       tied until it holds the other seat's throw for that round, so the
       two peers can never be more than one round apart. */
    case MSG.THROW: {
      if(stepOf(s) !== "throw") return no("the throw is settled", true);
      if(m.round !== s.round) return no("throw for round " + m.round + ", we are on " + s.round, true);
      if(s.throws[m.seat] != null) return no("seat " + m.seat + " has already thrown this round", true);
      /* `pick`, NOT `v`. Every message carries `v` as the LOBBY VERSION,
         and naming the throw the same thing shadowed it in the object
         literal — so the version guard read "paper" and refused every
         throw in the game. Same-name-different-meaning, caught by the
         drills rather than at the table this time. */
      if(RPS.RPS_THROWS.indexOf(m.pick) < 0) return no("not a throw: " + m.pick);
      const throws = s.throws.slice();
      throws[m.seat] = m.pick;
      if(throws[0] == null || throws[1] == null) return {state: {...s, throws}, error: null};

      /* Both are in. Resolve — symmetric, so both phones agree. */
      const v = RPS.rpsResolve(throws[0], throws[1]);
      const rounds = [...s.rounds, [throws[0], throws[1]]];
      if(v === 0) return {state: {...s, rounds, throws: [null, null],
                                  round: s.round + 1, ties: s.ties + 1}, error: null};
      return {state: {...s, rounds, throws, winner: v === 1 ? 0 : 1}, error: null};
    }

    /* THE WINNER CHOOSES; THEY ARE NOT HANDED THE FIRST TURN. rps.js's
       whole point — going first buys initiative and costs a card, and
       which side of that trade you want is the matchup's question. */
    case MSG.SEAT: {
      if(stepOf(s) !== "seat") return no("seating is settled", true);
      if(m.seat !== s.winner) return no("seat " + m.seat + " did not win the throw");
      const first = RPS.rpsSeat(s.winner, m.choice);
      if(first == null) return no("not a seating call: " + m.choice);
      return {state: {...s, first}, error: null};
    }

    /* The sideboard comes AFTER the throw on purpose: you sideboard
       knowing the matchup and knowing whether you are on the play. */
    case MSG.BOARD: {
      if(stepOf(s) !== "board") return no("the boards are settled", true);
      if(s.boards[m.seat] != null) return no("seat " + m.seat + " has already sideboarded", true);
      if(!Array.isArray(m.gearIdx)) return no("a board needs a gearIdx list");
      const boards = s.boards.slice();
      /* Normalised on the way in, so the two peers hold structurally
         identical specs and `matchSpec` is a read rather than a repair.
         The cut map is rebuilt key by key: an object off a wire can carry
         anything, and a stray key would build a different deck on one
         phone than the other. */
      const cuts = {};
      Object.keys(m.cuts || {}).forEach(k => {
        const q = Math.max(0, Math.floor(Number((m.cuts || {})[k]) || 0));
        if(q > 0 && /^\d+$/.test(String(k))) cuts[String(k)] = q;
      });
      boards[m.seat] = {gearIdx: m.gearIdx.map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b),
                        cuts};
      return {state: {...s, boards}, error: null};
    }
  }
  return no("unknown lobby message: " + m.t);
}

/* ---- the handoff ------------------------------------------------------
   What both peers feed to build.js and judge.newMatch. Null until every
   slot is filled, so a caller cannot half-start a match.

   THIS IS THE WHOLE CONTRACT WITH THE CARD LAYER, and it is deliberately
   small: two hero keys, two loadouts, one seat index and one seed. Both
   peers derive everything else. */
function matchSpec(s){
  if(stepOf(s) !== "ready") return null;
  return {heroes: s.heroes.slice(), boards: s.boards.map(b => ({gearIdx: b.gearIdx.slice(), cuts: {...b.cuts}})),
          first: s.first, seed: s.code, build: s.builds[0]};
}

/* Messages, built here so the two phones cannot spell them differently.
   Each carries `v` so a version skew is refused rather than misread.

   `sideboard`, NOT `board`. Everywhere else in this project `board` is
   the ARENA — the zone auras, items and allies sit in — and an export
   called `board` beside `sd.board` is the same-name-different-meaning
   trap test/sync.test.js pins. It caught this one on the first run,
   exactly as it caught `mySeat` and `tapTwice`'s `act`. The message type
   string stays "board" because that is what it is on the wire. */
const hello = (seat, build) => ({t: MSG.HELLO, v: LOBBY_V, seat, build});
const hero  = (seat, key)   => ({t: MSG.HERO,  v: LOBBY_V, seat, key});
const throwIt = (seat, round, pick) => ({t: MSG.THROW, v: LOBBY_V, seat, round, pick});
const seating = (seat, choice)   => ({t: MSG.SEAT,  v: LOBBY_V, seat, choice});
const sideboard = (seat, gearIdx, cuts) => ({t: MSG.BOARD, v: LOBBY_V, seat, gearIdx, cuts});

/* Has this seat already committed at the current step? The UI asks so it
   can show "waiting on them" rather than offering a button whose message
   its own reducer would refuse. */
function waitingOn(s){
  switch(stepOf(s)){
    case "hero":  return [s.heroes[0] == null ? 0 : null, s.heroes[1] == null ? 1 : null].filter(x => x != null);
    case "throw": return [s.throws[0] == null ? 0 : null, s.throws[1] == null ? 1 : null].filter(x => x != null);
    case "seat":  return s.winner == null ? [] : [s.winner];
    case "board": return [s.boards[0] == null ? 0 : null, s.boards[1] == null ? 1 : null].filter(x => x != null);
    default: return [];
  }
}

return {LOBBY_V, MSG, STEPS, newLobby, stepOf, reduce, matchSpec,
        waitingOn, hello, hero, throwIt, seating, sideboard};
});
