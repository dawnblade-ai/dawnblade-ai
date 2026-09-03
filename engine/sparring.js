/* ============================================================
   Dawnblade engine — sparring.js (Phase 1)

   A SEAT, AS A POLICY.  `act(game, seat) -> action | null`

   ---- WHY THIS EXISTS -------------------------------------------------

   The trainer's rules know there is a dummy. `foeSwing` fabricates the
   opponent's attack as `[3,4,5][(turn-1)%3]` and `dummyDefence` picks the
   blocks itself, so "the opponent" is not a seat somebody occupies — it
   is a branch inside the rules. That is why a second human has nowhere to
   sit, and it is why the same CR procedure is written twice (see
   judge.js's header): one body of code for when you swing, another for
   when it swings.

   Here the rules know nothing about who is driving. `judge.reduce` takes
   an action and a seat; this returns an action for a seat. Solo, hotseat
   and network are then the same game with different things calling
   `reduce` — a policy, a tap, or a packet — and none of them is a special
   case in the rules.

   ---- IT PROPOSES; THE JUDGE DISPOSES ---------------------------------

   Every action this returns has been offered to `judge.legal` first, so
   the policy can never push an illegal action into a shared log. That is
   not politeness, it is what lets the heuristics stay simple: the policy
   never has to restate a rule in order to avoid breaking it, and a rule
   that changes in judge.js changes here for free.

   It is also why this file reads NO CARD TEXT. It asks `legal` whether a
   play is possible and ranks what is left by printed NUMBERS — power,
   pitch, defence, cost. A drill fails if it ever imports the parser. The
   discipline is the one that kept `actions.js` free of card text: a
   sparring partner playing badly and a card being read wrong must never
   be confusable, and they would be the moment this started interpreting
   rules boxes.

   ---- IT IS DETERMINISTIC, AND THAT IS A NETWORK REQUIREMENT ----------

   No `Math.random`, and every ranking is a TOTAL order — ties break on
   uid so two peers running the same policy over the same state choose the
   same card. It also never touches `game.rng`: a policy that consumed the
   seeded stream would shift every later shuffle and deal, so a replay of
   the same seed would diverge the moment a human took over a seat the
   policy used to drive.

   ---- WHAT IT IS NOT --------------------------------------------------

   NOT an AI opponent. The project's standing decision (2026-07-25) is
   that the goal is two humans; the dummy stays as the solo trainer and as
   the regression harness that drives whole games through the reducer.
   This is deliberately a handful of legible heuristics — hit hardest,
   block what is worth blocking, pitch what you were least likely to play
   — and it should stay legible rather than become good.

   NOT a difficulty curve either. The `[3,4,5]` escalation it replaces was
   TUNED, and real cards from a real hand are not: a hero drawing well
   will hit harder than the old script and one drawing badly will hit
   softer. Retuning is a play session, not a drill.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./judge.js"), require("./priority.js"), require("./game.js"));
  else root.DawnSparring = factory(root.DawnJudge, root.DawnPriority, root.DawnGame);
})(typeof self!=="undefined" ? self : this, function(J, P, GM){

/* How the policy plays, all of it in one place so a caller can retune
   without editing a heuristic. These are POLICY, not rules — nothing here
   is a statement about Flesh and Blood. */
const DEFAULTS = {
  /* raise iron only against a swing worth spending it on (the trainer's
     dummy used 4, and that number is the one the difficulty was built
     around) */
  ironAt: 4,
  /* how many cards from hand may meet one attack. The rules cap this too
     — dominate holds a defender to a single card — but the rules are
     `legal`'s business; this is only how greedy the policy is. */
  handBlockers: 2,
  /* DAMAGE THE SEAT WILL SIMPLY TAKE rather than spend a card on.

     Without this the policy blocks every attack to zero and the game
     stops being a game: driven at each other, both seats blocked 41 of 41
     attacks and one of them took no damage at all in 21 turns. That is
     not a tuning complaint, it is a degenerate harness — a regression run
     that never deals damage never exercises the damage step.

     The reason it happens is that the trainer's blocking heuristic was
     written against a seat with NO action phase, where a card in hand had
     no use except to block, so spending two on every swing cost nothing.
     Both seats have an action phase now: a card in hand is an attack or a
     pitch, and a hero who blocks with everything never threatens anyone.

     Iron is exempt — equipment wears rather than leaving, so raising it
     costs no card and it stays on the greedy rule above. */
  takeUpTo: 3,
  /* how many cards it will pitch for one play. A seat that empties its
     hand into one attack has nothing left to block with, which is a
     judgement about playing well rather than about what is allowed. */
  maxPitch: 2
};
const cfg = o => Object.assign({}, DEFAULTS, o || {});

/* Printed numbers only, and null-safe: a non-attack prints no power, a
   Block prints no cost, and `null` must not sort as anything clever. */
const num = (c, k) => (c && c[k] != null) ? c[k] : 0;
/* A TOTAL order. Every comparison ends on the uid so two peers running
   this policy over the same state pick the same card — a ranking that
   leaves ties unbroken is a desync waiting for two equal blockers. */
const byUid = (a, b) => String(a.uid) < String(b.uid) ? -1 : String(a.uid) > String(b.uid) ? 1 : 0;

const legal = (g, a, seat) => J.legal(g, a, seat) == null;

/* ---- the payment ------------------------------------------------------
   `judge.legal` has already refused any play this seat could not fund, so
   by the time a payment is open the hand can always cover it. The only
   question is WHICH cards, and the answer is the standard one: pitch the
   high-pitch cards, because in this pool those are the expensive attacks
   you were least likely to play this turn, and cover the cost in as few
   cards as possible. */
function pitchPick(sd, self, o){
  const sel = sd.paySel || [];
  return (sd.hand || [])
    .filter(c => c && c.uid !== (self && self.uid) && sel.indexOf(c.uid) < 0 && num(c, "pitch") > 0)
    .sort((a, b) => num(b, "pitch") - num(a, "pitch") || num(a, "power") - num(b, "power") || byUid(a, b))[0] || null;
}

function payAction(g, seat, p, o){
  const sd = g.sides[seat];
  /* BOOST'S ADDITIONAL COST (v2.84). Declined, and that is a rule rather
     than a shrug: `autoAnswer`'s standing policy is to decline what is
     optional, and here it is also the only HONEST answer available. The
     card boost banishes is the top of this seat's own deck, which is
     hidden from it — so there is nothing to weigh, and a policy that
     accepted would be guessing at a card it cannot see. Declining is also
     the conservative direction: it can never make the seat stronger than
     printed, which is the direction that steals games.

     THE WALL STANDS. This reads no card text — `judge` asked the
     question, and "no" is a complete answer to "you may". */
  if(p.kind === "boost") return {t: "boost", yes: false};
  /* ---- THE TWO KINDS THIS POLICY HAD NEVER MET (v3.80) --------------
     `judge.PENDING_KINDS` is a census of four and this function branched
     on ONE, falling through to `paySel` for the rest — which is v3.35's
     blacklist defect in a third consumer. It could not be reached until
     now for a precise reason: both kinds are opened by NON-ATTACK plays,
     and until this version the policy could not play one. Measured, it
     was 21 refusals in 210 games, every one of them Burn Up // Shock.

     A REFUSAL IS ALWAYS A BUG IN THIS FILE (the module's own contract),
     so the fix belongs here rather than in `legal`.

     SPLIT — declare the LEFT half, never `both`. That is `judge`'s own
     default and its stated reason: melding doubles the base cost and
     hands a player a textbox they never asked for, so defaulting to it
     is a judgement this file cannot make. `legal` refuses `both` outright
     on a card with no meld, and refuses a half whose window is wrong —
     so asking for half 0 is the one answer that is always available, the
     same argument the ally-target comment above makes for naming the
     hero.

     ADDPAY — declined, exactly as boost is, and for the identical reason:
     `autoAnswer`'s standing policy is to decline what is optional, "no"
     is a complete answer to "you may", and declining can never make the
     seat stronger than printed. */
  if(p.kind === "split")  return {t: "split", half: 0};
  if(p.kind === "addPay") return {t: "addPay", yes: false};
  if(p.need - sd.res - J.paySum(sd) <= 0) return {t: "payConfirm"};
  const c = pitchPick(sd, p.card, o);
  /* Unreachable after a play this policy proposed — `legal` guarantees
     the hand covers the cost. It is here for a payment the policy did not
     open: a human who taps a card and hands the seat over mid-decision
     must not leave the policy with nothing legal to do. */
  return c ? {t: "paySel", uid: c.uid} : {t: "payCancel"};
}

/* ---- the wall (CR 7.3.2) ----------------------------------------------
   Declaring defenders is free and simultaneous, so it is not a priority
   action and the policy does it whenever `canDeclareDefenders` is true.
   One card per call: each declaration reopens the window (CR 7.3.4), and
   returning them one at a time is what keeps every step of the wall a
   real action in the log rather than a hidden batch. */
function wallOf(sd){
  return (sd.blockG || []).reduce((t, u) => {
      const piece = (sd.gear || []).find(x => x && x.uid === u);
      return t + (piece ? GM.gearDef(piece) : 0);
    }, 0)
    + (sd.blockH || []).reduce((t, u) => {
      const c = (sd.hand || []).find(x => x && x.uid === u);
      return t + num(c, "def");
    }, 0);
}

function nextBlocker(g, seat, o){
  const sd = g.sides[seat];
  const incoming = (g.pend && g.pend.total) || 0;
  const wall = wallOf(sd);
  /* Nothing left to stop. Blocking past the swing throws cards away, and
     stopping here is also what makes the policy terminate: every call
     either adds defence or returns null. */
  if(wall >= incoming) return null;

  /* IRON FIRST, and only against a swing worth it. Equipment wears out
     rather than leaving, so a piece spent on a small hit is not in hand
     later — it is simply gone off the bigger one. `legal` is what knows
     the piece has defence left and has not already blocked this chain
     (CR 7.3.2b); the policy only decides whether to bother. */
  if(incoming >= o.ironAt){
    const piece = (sd.gear || []).slice()
      .filter(x => x && (sd.blockG || []).indexOf(x.uid) < 0 && GM.gearDef(x) > 0)
      .sort((a, b) => GM.gearDef(b) - GM.gearDef(a) || byUid(a, b))
      .find(x => legal(g, {t: "defend", uid: x.uid}, seat));
    if(piece) return {t: "defend", uid: piece.uid};
  }

  /* THEN CARDS, AND ONLY IF THE HIT IS WORTH ONE.
     A card spent here is an attack not made and a resource not pitched,
     so the policy takes small hits and keeps the card — except when the
     hit would kill it, where nothing in hand is worth more than being
     alive and it blocks with everything it has. */
  const leak = incoming - wall;
  const lethal = leak >= sd.hp;
  if(!lethal && leak <= o.takeUpTo) return null;

  /* Best defence first, and among equals the one least worth playing
     later. A defence reaction is never declared as a defender
     (CR 8.1.3a) — `legal` refuses it, so the policy does not have to
     know that, and would be wrong here if it tried. */
  if(!lethal && (sd.blockH || []).length >= o.handBlockers) return null;
  const card = (sd.hand || []).slice()
    .filter(c => c && (sd.blockH || []).indexOf(c.uid) < 0 && num(c, "def") > 0)
    .sort((a, b) => num(b, "def") - num(a, "def") || num(a, "power") - num(b, "power") || byUid(a, b))
    .find(c => legal(g, {t: "defend", uid: c.uid}, seat));
  return card ? {t: "defend", uid: card.uid} : null;
}

/* ---- the action phase -------------------------------------------------
   Hit as hard as this seat can afford to. `legal` has already applied
   every rule that could stop the play — the window, the action point, the
   type, whether the cost can be raised at all — so what is left is a
   ranking over printed power. */
function offence(g, seat, o){
  const sd = g.sides[seat];
  const from = [];
  (sd.hand || []).forEach(c => from.push({c, from: "hand"}));
  if(sd.arsenal) from.push({c: sd.arsenal, from: "arsenal"});

  /* ---- AN ALLY IS A THIRD SOURCE OF ATTACKS (v3.50) ------------------
     Allies have attacked since v3.44 and this policy had never heard of
     them: measured over 210 self-play games, ZERO ally attacks across 549
     opportunities, and v3.46's death and Gold triggers fired ZERO times.
     A feature with no caller looks exactly like a feature that works,
     until you count (PLAYNOTES.md, finding 2).

     THEY ARE RANKED IN THE SAME ORDER AS EVERYTHING ELSE, not appended
     after it. An ally's swing and a card from hand both cost the turn's
     one action point, so they are competing for the same thing and a
     blanket "allies last" would be a rule this file has no business
     inventing. Printed power decides, exactly as it does for a card.

     THE ENTRY IS NOT THE CARD. A board entry is `{card, kind, uid, ...}`,
     so the power lives on `.card` and the uid on the ENTRY — reading
     `num(b, "power")` returns 0 for every ally and silently ranks them
     last, which is the same bug wearing a different hat. `GM.isAlly`
     reads the entry's kind rather than a printed type line, so this stays
     inside the no-card-text contract.

     THE TARGET IS THE HERO, always. CR 1.4.5 makes the choice mandatory
     and `judge.targets` offers the alternatives; choosing between them is
     a judgement about playing well that this policy does not make, and
     naming the hero is the one answer that is always available. */
  const allies = (sd.board || [])
    .filter(b => b && GM.isAlly(b))
    .map(b => ({c: b.card, uid: b.uid, ally: true}));

  const pick = from
    .map(x => ({c: x.c, uid: x.c && x.c.uid, from: x.from}))
    .concat(allies)
    .filter(x => x.c && num(x.c, "power") > 0)
    .filter(x => x.ally || affordableWithin(sd, x.c, o))
    .sort((a, b) => num(b.c, "power") - num(a.c, "power")
                 || num(a.c, "cost") - num(b.c, "cost") || byUid(a, b))
    .find(x => legal(g, x.ally ? {t: "activate", uid: x.uid, target: "hero"}
                               : {t: "play", uid: x.uid, from: x.from}, seat));
  if(pick) return pick.ally ? {t: "activate", uid: pick.uid, target: "hero"}
                            : {t: "play", uid: pick.uid, from: pick.from};

  /* A weapon swing is an attack that comes from the gear zone. `legal`
     owns both of its limits — the printed `Once per Turn` and the tap —
     so the policy just asks. */
  const w = (sd.gear || []).slice().sort(byUid)
    .find(x => legal(g, {t: "activate", uid: x.uid}, seat));
  if(w) return {t: "activate", uid: w.uid};

  /* THE HERO'S OWN ABILITY, last, and for the same reason it was missing:
     nothing proposed one in 210 games. It goes after the attacks because
     it is the only source here that is not one — every printed hero
     ability in this pool draws, digs or buffs rather than dealing damage,
     so spending the action point on it ahead of a swing would be a
     judgement this file cannot make without reading the card. */
  if(legal(g, {t: "activate", from: "hero", uid: "hpow"}, seat))
    return {t: "activate", from: "hero", uid: "hpow"};

  /* ---- A NON-ATTACK IS STILL A PLAY (v3.80) --------------------------
     THE FILTER ABOVE IS `num(x.c, "power") > 0`, AND A NON-ATTACK PRINTS
     NO POWER. So until now this policy could not play one — at all, from
     any zone, in any state. Measured over the fifteen precons, the share
     of each deck it could never touch:

         Dorinthea 91%   Blaze 88%   Iyslander 85%   Enigma 62%
         Gravy 55%   Viserai/Arakni/Lyath 52%   Briar 48%   Azalea 45%

     That is not a tuning complaint. It is v3.50's finding one source
     over — "a feature with no caller looks exactly like a feature that
     works, until you count" — and it had three visible symptoms nobody
     had connected: Iyslander and Enigma won ZERO of 210 games and Blaze
     won 2; every one of the 7 stalls was between two of those three; and
     a stalled game is literally both seats passing forever with four
     legal plays in hand, because `legal` said yes and nothing proposed
     them.

     IT ALSO MEANS THE HARNESS WAS EXERCISING HALF THE ENGINE. Every
     arcane, every aura, every token mint and every pump in the pool rides
     on a non-attack, so none of them had ever been driven here.

     LAST, AND THE ORDER IS A PRINTED-NUMBERS ARGUMENT rather than a
     reading of what the card does. Everything above it either deals
     damage or spends no card: an attack wins the game, a weapon swing is
     free, and a hero ability leaves the hand alone. A non-attack spends a
     card AND the turn's action point, and a card in hand can always
     block — so it is what this seat does when there is nothing better,
     which is the same judgement the hero-ability comment above already
     makes.

     STILL NO CARD TEXT. `cost` and `pitch` are printed numbers and
     `legal` answers everything else, so the contract this file is drilled
     against is untouched: the cheapest first, ties broken on pitch and
     then on uid, because a ranking that leaves ties unbroken is a desync
     waiting for two equal cards. */
  const nonAtk = from
    .map(x => ({c: x.c, uid: x.c && x.c.uid, from: x.from}))
    .filter(x => x.c && num(x.c, "power") <= 0)
    .filter(x => affordableWithin(sd, x.c, o))
    .sort((a, b) => num(a.c, "cost") - num(b.c, "cost")
                 || num(a.c, "pitch") - num(b.c, "pitch") || byUid(a, b))
    .find(x => legal(g, {t: "play", uid: x.uid, from: x.from}, seat));
  if(nonAtk) return {t: "play", uid: nonAtk.uid, from: nonAtk.from};

  return null;
}

/* WOULD THIS COST MORE OF THE HAND THAN IT IS WORTH?
   `legal` says a play is affordable if the pool plus the ENTIRE hand can
   raise the cost, which is the right rule and a bad plan: a seat that
   pitches four cards for one attack has nothing to block the answer with.

   The PRINTED cost is used rather than the effective one, because reading
   a cost reduction means reading the card's text. Reductions only ever
   reduce, so the estimate is high and the policy's mistake is to skip a
   card it could in fact afford — the safe direction, and one that shows
   up as a quiet turn rather than as a rules error. */
function affordableWithin(sd, card, o){
  const need = num(card, "cost") - (sd.res || 0);
  if(need <= 0) return true;
  const pool = (sd.hand || [])
    .filter(c => c && c.uid !== card.uid && num(c, "pitch") > 0)
    .map(c => num(c, "pitch"))
    .sort((a, b) => b - a);
  let got = 0;
  for(let i = 0; i < pool.length && i < o.maxPitch; i++){
    got += pool[i];
    if(got >= need) return true;
  }
  return false;
}

/* ---- the policy -------------------------------------------------------
   ONE legal action for this seat, or null when it has nothing to do right
   now — which is the normal answer for most of the game, because for most
   of the game it is the other seat's window. A caller drives both seats
   and lets each one answer for itself. */
function act(g, seat, o){
  o = cfg(o);
  if(!g || g.over || (seat !== 0 && seat !== 1)) return null;

  /* A SEAT THAT IS ASKED, ANSWERS (v2.77). A prompt sheet stops the game
     for BOTH seats until it is resolved, so a policy occupying a seat has
     to be able to answer one or the game stalls the first time a card
     defers its payload into an answer.

     THE WALL STANDS: this reads no card text. It hands the question to
     `judge.autoAnswer`, which delegates the two answers that cost real
     money to the pure printed-number policies in effects.js — the SAME
     ones the trainer already uses for seat 1, so a policy here cannot
     disagree with a policy there about whether a soak is worth paying
     for. Everything else it does is structural: decline what is
     optional, take the minimum where one is printed.

     Asked before `pending` for the same reason `pending` is asked before
     priority: it is the narrowest thing that blocks everything else. */
  if(g.prompt) return (g.prompt.side || 0) === seat ? J.autoAnswer(g) : null;

  /* A half-finished interaction belongs to ONE seat and blocks the other
     entirely, so it is asked about before anything else. */
  const p = J.pendingOf(g);
  if(p) return p.seat === seat ? payAction(g, seat, p, o) : null;

  /* CR 4.4.3b — the arsenal step. A choice, and the end phase waits on
     it, so nothing else can move until it is answered. The best attack
     goes face down: it is the card this seat most wants to lead with, and
     it is the one card that survives the hand being spent. */
  if(g.arsenalFor === seat){
    const best = (g.sides[seat].hand || []).slice()
      .sort((a, b) => num(b, "power") - num(a, "power") || byUid(a, b))[0];
    return {t: "arsenal", uid: best ? best.uid : null};
  }

  /* CR 7.3.2 — declaring defenders is free and simultaneous, and is the
     one thing a seat may do while the OTHER holds priority. It is asked
     before the priority question for exactly that reason. */
  if(P.canDeclareDefenders(g, seat)){
    const d = nextBlocker(g, seat, o);
    if(d) return d;
  }

  if(!P.hasPriority(g, seat)) return null;

  if(P.speedAllowed(g, seat).indexOf("action") >= 0){
    const a = offence(g, seat, o);
    if(a) return a;
  }

  /* Nothing worth doing. Ending the turn is a PASS carrying intent
     (CR 4.3.4 — the phase ends only when both seats pass in succession),
     so this is not a shortcut past the opponent; it is the same pass with
     a better log line, and `legal` refuses it anywhere it would be a lie. */
  if(legal(g, {t: "endTurn"}, seat)) return {t: "endTurn"};
  return {t: "pass"};
}

/* ---- driving -----------------------------------------------------------
   Step the game until nobody has anything to do. `seats` is which chairs
   the policy is sitting in: `[1]` is the solo trainer, `[0,1]` is the
   regression harness that plays whole games through the reducer.

   It stops on `over`, on a seat with nothing to say, and on the step
   limit — never on a refusal, which it records instead. A refused action
   is always a bug in this file (the policy asked `legal` first), so
   swallowing one silently would hide the one failure this module can
   have. */
function run(g, o){
  o = o || {};
  const seats = o.seats || [0, 1];
  const limit = o.limit || 4000;
  const conf = cfg(o.policy);
  let n = g, steps = 0;
  const errs = [], trace = [];
  for(let i = 0; i < limit && !n.over; i++){
    let moved = false;
    for(const s of seats){
      const a = act(n, s, conf);
      if(!a) continue;
      const out = J.reduce(n, a, s);
      if(out.error){ errs.push({action: a, seat: s, why: out.error}); continue; }
      n = out.state; steps++; moved = true;
      if(o.trace) trace.push({t: a.t, seat: s, turn: n.turn, phase: n.phase, step: n.step});
      break;      /* re-ask from the top: one action can change everything */
    }
    if(!moved) break;
  }
  return {game: n, steps, errs, trace};
}

return {DEFAULTS, act, run, pitchPick, nextBlocker, offence, wallOf, affordableWithin};
});
