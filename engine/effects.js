/* ============================================================
   Dawnblade engine — effects.js (Phase 3: the effects port)
   THE CARD SEMANTICS, extracted VERBATIM from index.html so that
   one copy of them exists and both boards can run it.

   Until this module, `runOps`/`execute`/`resolveStack` were
   closures inside `Battle`, which is why SOLO play resolved every
   card effect and TABLE play resolved none: judge.js had no way to
   reach them. That split was deliberate and load-bearing while it
   lasted (a control-flow bug and a card being read wrong must never
   be confusable) and it ends here, the way the v2.20 no-mirror rule
   ended the last one — by there being exactly ONE copy.

   THE BODIES ARE MOVED, NOT REWRITTEN. They were generated out of
   index.html by script and were byte-identical at the commit that
   moved them, because the live trainer is the regression harness for
   this port: it plays every card effect today, so any port that
   CHANGES its behaviour is wrong by definition. Fixes come AFTER,
   as their own commits with their own drills — never smuggled into
   a move, where no diff can distinguish them from the move itself.

   TWO SEAMS ARE KNOWN AND DELIBERATELY LEFT ALONE HERE:

   1. `execute` CALLS `dummyDefence` INLINE. That is the seam the
      roadmap names: in judge.js it must hand control back and let
      the defend step run instead of resolving the block itself. It
      is passed in as context so the trainer keeps working exactly
      as it did; making it a hand-back is the next pass.
   2. `execute` READ `built.runeDmg` at four sites — CLOSED in v2.77.
      Per v2.41 a passive read as `built.X` inside a RULES function
      is a bug: `built` is seat 0’s build, captured for the UI, so it
      fires for the wrong hero the moment seat 1 acts. All four now
      read `bAct(n).runeDmg`, which was already in context beside
      them, and `built` came OFF the context entirely (18 keys → 17).
      That is not tidiness: this module is about to be driven by
      judge.js, and a context key that means "seat 0's build" is a
      seat-0 rules read written into a brand-new caller.

   `makeEffects(ctx)` takes the trainer closures the bodies reach
   for. They are listed explicitly rather than passed as a bag so
   that adding a dependency is a deliberate edit — the same
   discipline the bridge and P_MAP keep one layer up, and
   test/effects.test.js fails if the trainer’s literal drifts.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"), require("./cards.js"), require("./rng.js"), require("./game.js"), require("./advisor.js"), require("./prompts.js"), require("./build.js"));
  else root.DawnEffects = factory(root.DawnParser, root.DawnCards, root.DawnRNG, root.DawnGame, root.DawnAdvisor, root.DawnPrompts, root.DawnBuild);
})(typeof self!=="undefined" ? self : this, function(P, C, R, G, A, PR, BD){

/* Engine-side dependencies, taken as factory arguments — the same
   treatment advisor.js, cards.js and prompts.js already get. */
const {arsEmpty, arsFree, classifyClause, clean, costsAP, effCost,
       fxParse, hasKw, printedKw, isAttack, isAR, norm, qualMatches, rxPump, runeCount,
       allyAttack, abilityGa,
       isFrostbite, frostCount, isFrailty, frailtyCount,
       pow6, zonePow, isAtkActionCard, defCap} = P;
const {resolveEntry} = C;

/* ---- THE CONDITIONS THAT CANNOT BE ANSWERED AT DECLARATION (v3.71) ----
   Three printed shapes whose answer is settled at the WALL rather than
   when the card is played:

     pumped      "if this has {p} greater than its base"
     defLt2      "…defended by fewer than 2 non-equipment cards"
     defLt2any   "…defended by fewer than 2 cards"

   ONE LIST, TWO READERS. `execute` skips them (so the feed does not
   report them unmet and then grant them anyway) and builds `pend.lateConds`
   from the same names, which `linkPumps` evaluates once the attack's power
   is settled. Written out twice they drift, and the drift is a condition
   that is skipped and then never run — a printed bonus that silently
   vanishes. */
const LATE_CONDS = ["pumped", "defLt2", "defLt2any", "hasGa"];
/* `chainLinkGe4` CARRIES ITS THRESHOLD IN ITS NAME (v3.88), so it cannot be
   a literal in the list — which is exactly why the list has ONE reader
   rather than two `indexOf` tests that would drift (v3.71, v3.89). */
const isLateCond = c => LATE_CONDS.indexOf(c) >= 0 || /^chainLinkGe\d+$/.test(c);
/* THE CONDITIONS ONLY `attackRx` CAN ANSWER (v3.89). Both need the WALL —
   `reprise` asks how many cards from hand met the attack, `charged` rides
   with it on the same route — and `execute`'s generic loop is given
   neither, so it falls through to the default `false` and prints
   "condition not met (reprise)" four lines before the reaction pumps the
   link by 3. That is the sev-2 category the player TRUSTS: the state is
   right and the feed contradicts itself (v3.60).

   ONE LIST, TWO READERS — the skip in `execute` and the dispatcher in
   `attackRx` — for `LATE_CONDS`' own reason: two copies drift into a
   condition that is skipped and then never run. */
const RX_CONDS = ["reprise", "charged", "defAtkAction"];
/* IS THIS SEAT'S NAME THE SECOND PERSON? (v3.90) Seat 0 is called "You",
   so a feed line that NAMES the seat has to agree with the name it used —
   "You discards" and "You puts the top card of THEIR deck" are both wrong
   in the same way. Named rather than inlined because the second-person
   ledger in `judge.test.js` scans template literals: a `/^you$/` inside
   the backticks reads as a second-person feed line to that scan. */
const isSecondPerson = nm => /^you$/i.test(String(nm || ""));
const {popRunechants, gearDef, gearBlockApply, hasExposedZone} = G;
const {advValue} = A;
/* prompts.js is a NEW factory argument in v2.74 and the load order already
   allowed it — prompts.js is script tag 1341, effects.js 1353. `arcaneHit`
   asks `buildPrompt` whether a soak is worth offering rather than
   re-deciding it here: buildPrompt already drops options the hero cannot
   afford and returns null when there is nothing to ask, and a second copy
   of that filter is the mirror the no-mirror rule exists to prevent. */
/* `applyPrompt` and `promptReady` joined `buildPrompt` in v2.77, when the
   prompt ANSWER moved here from the trainer: resolving a sheet is one
   shared body now, and both boards call it. */
const {buildPrompt, applyPrompt, promptReady, promptFilter} = PR;
const rngRoll = R.roll, rngInt = R.int;

/* THE CONTEXT. Every name here is a closure the moved bodies call and
   that this module cannot own: the logger, the actor helpers, the card
   database, the uid counters, the hero build and the trainer’s own
   scheduling hooks. `act`/`foe` are PASSED IN rather than redefined
   here on purpose — judge.js exports its own `act`/`foe` with a
   different meaning, and a second definition under the same name is the
   collision KNOWN_COLLISIONS polices. Passing them guarantees the moved
   bodies keep calling exactly the functions they called inside Battle. */
const CTX_KEYS = ["L","act","actMut","actorOf","bAct","bFoe","db","foe","foeMut",
                  "gy","gyDisc","had6ThisTurn","mkRune","openPrompt","tokSeq","typeAbbr","winCheck"];

function makeEffects(ctx){
  const missing = CTX_KEYS.filter(k => ctx[k] === undefined);
  if(missing.length) throw new Error("effects.js: missing context — " + missing.join(", "));
  const {L, act, actMut, actorOf, bAct, bFoe, db, foe, foeMut,
         gy, gyDisc, had6ThisTurn, mkRune, openPrompt, tokSeq, typeAbbr, winCheck} = ctx;

  /* WHAT A DISCARD TRIGGERS. Kayo prints: "The first time you discard a
     card with 6 or more {p} during EACH OF YOUR ACTION PHASES, create a
     Might token." Three things in that sentence do work and all three are
     modelled here rather than approximated:

       "the first time"   — a latch, on hist, which resets every turn
       "6 or more {p}"    — pow6, so his own clause 2 applies to it
       "during each of your ACTION PHASES" — RULING (user, 2026-08-08):
                            a discard in the end phase, or on the
                            opponent's turn, makes no Might. So it asks
                            the CR phase, not merely whose turn it is.

     Every discard path should call this. Today that is `discardRandom`;
     an additional-cost discard is the other one and is not wired yet,
     which is a gap rather than a decision. */

  /* ---- A CARD THAT REDIRECTS ITSELF MUST LEAVE EVERY ZONE HOLDING IT --

     Two callers file a spent attack at two different moments, and both
     are right for their own turn structure: the trainer files it to the
     graveyard AT DECLARATION, judge.js holds it on the combat chain
     until the CLOSE step. So when a card's own text sends it somewhere
     else — "put it into your soul", "put it on the bottom of its
     owner's deck" — the zone it has to be lifted OUT of depends on who
     is driving, and lifting it out of only one puts one card in two
     zones. That is `invariants.js`'s loudest error, and ours rather
     than a caught one.

     `soulSelf` learned this and `bottomSelf` did not, which is how Under
     Loop came to sit in a deck and on the combat chain at the same time
     — found by driving a whole Viserai/Dash game, not by reading. The
     rule lives here once now, so the next self-redirecting op inherits
     it instead of rediscovering it. Matching is by UID rather than by
     reference: a card that has been through a spread is a different
     object with the same identity, and the census works by uid. */
  const liftSelf = (n, pc) => {
    actMut(n).grave = act(n).grave.filter(x => x.uid !== pc.uid);
    n.chainCards = (n.chainCards || []).filter(e => e.card.uid !== pc.uid);
    return n;
  };

  /* ---- THE WATCHERS, IN ONE BODY (v3.93) -----------------------------
     A `payCost` piece is a WATCHER: it sits in the gear zone or the arena
     and pays for something that happens somewhere else. Every other trigger
     in `execute` asks the resolving card about itself; these ask what is
     WATCHING (v3.33's Magmatic Carapace, v3.72's Crow's Nest).

     BOTH ZONES, ALWAYS. Magmatic Carapace is a CHEST piece and both v3.93
     cards are LEGS, so a board-only scan finds nothing for any of them —
     and `sweepArena` had to re-derive its teardown flags over gear for the
     identical reason (v3.07).

     THREE SITES CALL IT and there is one description of the scan, because
     three copies of "who is watching" is where the drift starts — the
     no-mirror rule inside a single file (v3.20's `optCostSpec`).

     `ok` IS THE TRIGGER'S OWN EXTRA QUESTION, asked per watcher, because
     the threshold travels with the trigger rather than being known here
     (v3.88). A trigger that asks nothing more passes nothing. */
  function offerPayCost(s, trigger, ok, extra){
    let n = s;
    const watchers = [...(act(n).gear||[]), ...((act(n).board||[]).map(b => b && b.card))]
      .filter(Boolean)
      .map(w => ({w, px: fxParse(w).payCost}))
      .filter(({w, px}) => px && px.trigger === trigger
                        && !(px.taps && (act(n).weaponUsed||{})[w.uid])
                        /* A DESTROYED PIECE CANNOT PAY AGAIN. It is marked
                           rather than spliced until the end-phase sweep
                           (v3.54), so it is still sitting in the zone. */
                        && !w.destroyed
                        && (!ok || ok(px, w)));
    for(const {w, px} of watchers)
      n.promptQ = [...(n.promptQ||[]), Object.assign(payCostSpec(px, w, actorOf(n)), extra||{})];
    return n;
  }

  /* A GO-AGAIN GRANT THAT ARRIVES AFTER ITS LAYER HAS SETTLED (v3.93).

     `runOps`'s `ga` case records `_gaGrant` and two consumers fold it onto
     a live `pend` — `execute`'s own settle and `linkPayload`'s. Neither can
     see a grant that arrives LATER, and a prompt always does: `openPrompt`
     drains at the tail of the caller, after `linkPayload` has spent the
     action point on its last line.

     WITHOUT THIS THE FLAG SIMPLY SITS ON THE STATE and folds onto the NEXT
     attack — a free action point on a later swing, which is stronger than
     printed and is the direction that steals games.

     THE QUEUE SITE SAYS SO; THE BOARD IS NEVER INFERRED. The first draft
     asked `!s.pend`, which is the TRAINER's marker — `resolveStack` nulls
     `pend` before draining, and `judge.js` holds it until `closeChain`,
     two steps later. So the rule would have worked on one board and
     leaked on the other, which is v3.01's shape created deliberately
     rather than found. `spec.lateGa` is set by the one site that KNOWS it
     fires after the settle, because it is inside `linkPayload` itself.

     CR 5.3.5: "If the layer has go again, the controlling player GAINS 1
     action point." So the point IS the grant, and handing it over is the
     faithful settlement rather than an approximation of one — this file
     says the same thing at v2.39 about an instant, where the arithmetic is
     spelled out for exactly this reason.

     AND THE LINK IS MARKED, because the chain display reads a link's `ga`
     to draw its go-again glyph. A number that is right while the screen
     disagrees is the sev-2 category the player TRUSTS. */
  function settleLateGa(s){
    if(!s._gaGrant) return s;
    let n = {...s}; delete n._gaGrant;
    actMut(n).ap = act(n).ap + 1;
    if(n.chain && n.chain.length)
      n.chain = n.chain.map((l, i) => i === n.chain.length - 1 ? {...l, ga: true} : l);
    return L(n, "Go again, granted after the attack resolved — CR 5.3.5 hands the action point back.");
  }

  const afterDiscard = (s, taken, opts) => {
    let n = s;
    const b = bAct(n);
    const big = taken.some(c => pow6(c, b));
    const atRandom = !!(opts && opts.random);

    /* BEATEN TRACKERS: "Whenever you discard a RANDOM card with 6 or more
       {p}, you may destroy this. If you do, gain 1 action point."

       Note the word the hero ability does NOT have: this triggers only on a
       RANDOM discard, where clause 3 fires on any discard at all. Reading
       the two as the same event would hand out a free action point every
       time a cost was paid by choice.

       "You may" — RULING (user, 2026-08-08): prompt every time it triggers.
       It is a real decision, an action point against a block.

       IT WAS AN INLINE REGEX OVER RAW TEXT UNTIL v3.93, and that is v3.58's
       defect exactly: a card handled outside the parser is a card
       special-cased, the ledger cannot see it, and the tier reported
       `part` on a card that had worked for versions. **A tier that says
       `part` on a card that works is a lead** — second outing of that
       sentence.

       AND ITS THRESHOLD WAS A LITERAL. The regex matched `\d+` and then
       tested `pow6`, a hardcoded 6 — so a card printing 8 would have
       fired on a 6. Beaten Trackers is the pool's only record of the
       shape, so no pool fixture could tell the two apart (v3.32, tenth
       outing); it is `px.trigN` now, and the reader is the parser's.

       THE POWER IS THE CARD'S IN THE ZONE IT WAS IN — `zonePow` carries
       Kayo's "+1{p} while in any zone other than the combat chain", which
       is worth half his deck (v2.55). */
    if(atRandom)
      n = offerPayCost(n, "discardRandom",
        px => taken.some(c => zonePow(c, b) >= px.trigN));

    if(!b || !b.mightOnFirst6Discard) return n;
    /* "DURING EACH OF **YOUR** ACTION PHASES" — and `phase === "action"` on
       its own does NOT mean that. In Flesh and Blood the combat chain lives
       inside the TURN PLAYER's action phase, so while you are defending
       against their swing the phase is still "action" — it is just not
       yours. Caught in play: paying Rally the Coast Guard's discard cost to
       block on the opponent's turn minted a Might token.
       The turn has to be the actor's own. */
    if(n.turnPlayer != null && n.turnPlayer !== actorOf(n)) return n;
    if(n.phase !== "action") return n;
    if(act(n).hist && act(n).hist.might6) return n;
    if(!big) return n;
    actMut(n).hist = {...act(n).hist, might6:1};
    n = L(n, "The first card with 6 or more {p} you have discarded this action phase — Kayo makes Might.");
    return runOps(n, [["token","Might",1,"self"]], "Kayo");
  };

  /* ---- BRIAR'S TWO EMBODIMENTS (v3.21) --------------------------------

     "Essence of Earth and Lightning" is two clauses and both mint a
     token, which is what makes the Embodiments her engine rather than
     decoration.

     NEITHER SITE NAMES A TOKEN. The build carries the name read off the
     hero's own printed line (`build.js`), so these mint whatever she
     prints — the same reason Kayo's clause 2 carries its magnitude rather
     than a flag.

     BOTH LATCH PER TURN, and `hist` is per-turn, so the latch IS the
     counter. Kayo's neighbour above latches per ACTION PHASE because his
     text says so; do not copy one onto the other. */

  /* "The FIRST time an attack action card you control deals damage to an
     opposing hero each turn." Three gates, and each is a way to be wrong:

       - an attack ACTION CARD, so a weapon swing is not one (`from`);
       - DEALS DAMAGE — CR 7.5.5, if prevention means no damage is dealt
         it is not a hit, so a fully blocked attack must not mint;
       - to an opposing HERO, never an ally. WHERE THE DAMAGE LANDED IS
         THE CALLER'S ANSWER (`info.heroHit`), the same split `blkNote`
         and the wall already keep: judge routes by CR 1.4.5 attack-target
         and the trainer has no ally targeting wired, so a body that
         guessed here would be right on one board and wrong on the other. */
  const briarEarth = (s, heroHit) => {
    let n = {...s};
    const b = bAct(n);
    if(!b || !b.earthOnFirstHeroDmg) return n;
    if(!heroHit) return n;
    if(n.pend && n.pend.from === "weapon") return n;
    if(n.pend && !isAttack(n.pend.card)) return n;
    if(act(n).hist && act(n).hist.briarEarth) return n;
    actMut(n).hist = {...act(n).hist, briarEarth:1};
    n = L(n, `${act(n).name}: the first attack action card to land on a hero this turn — Briar draws up Earth.`);
    return runOps(n, [["token", b.earthOnFirstHeroDmg, 1, "self"]], act(n).hero ? act(n).hero.name : "Briar");
  };

  /* "The SECOND time you play a non-attack action card each turn." Exactly
     the second — not the second and every one after, which is what a
     `>= 2` test would mint. `hist.non` is incremented by `execute` on the
     way past, so this reads the count it has just become. */
  const briarLightning = (s) => {
    let n = {...s};
    const b = bAct(n);
    if(!b || !b.lightningOnSecondNonAtk) return n;
    if((act(n).hist||{}).non !== 2) return n;
    n = L(n, `${act(n).name}: the second non-attack action card this turn — Briar draws up Lightning.`);
    return runOps(n, [["token", b.lightningOnSecondNonAtk, 1, "self"]], act(n).hero ? act(n).hero.name : "Briar");
  };

  /* ---- ONE COPY OF THE ADDITIONAL-COST DISCARD (v2.65) ----------------
     "As an additional cost to play this, discard a random card." The body
     below existed TWICE, verbatim, in `execute`'s attack and non-attack
     branches — and a third caller was needed, which is what surfaced it:
     the solo mirror's `foePlay` charged the cost on NEITHER path, so seat
     1 played Savage Feast and simply never discarded. A printed drawback
     skipped is sev-3, and it is the one place the mirror was STRONGER
     than printed.

     It is a pure MOVE — the body is byte-faithful to what was inlined, so
     a diff can tell the extraction from a behaviour change. Everything it
     touches is actor-relative (`act`/`actMut`/`bAct`), so the borrowing
     caller pays it out of the borrowing seat's hand.

     What it deliberately does NOT carry is the conditional PAYOFF that
     follows it in the attack branch (`fx.conds` / discard6): that is
     `execute`'s to evaluate, and the mirror not firing it is the
     documented limit, not an oversight. Paying a cost and declining to
     collect the bonus is the safe direction — weaker than printed, never
     stronger. Returns the discarded cards so the caller can ask its own
     question of them. */
  const payAddCost = (n, card, fx) => {
    /* AT RANDOM WHEN THE CARD SAYS RANDOM. Savage Feast prints "discard a
       RANDOM card"; letting the engine pick the player's lowest-value
       card instead is strictly better than printed, which is the
       direction that steals games. Seeded, so a replay and a peer feed
       the cost the same card. */
    let pool;
    if(fx.addCost.random){
      pool = [];
      let _h = act(n).hand.map((c2,i2)=>({c2,i2}));
      for(let q=0; q<fx.addCost.discard && _h.length; q++){
        const r = rngInt(n.rng, _h.length); n.rng = r.rng;
        pool.push(_h[r.v]); _h = _h.filter((_,j)=>j!==r.v);
      }
    } else {
      pool = act(n).hand.map((c2,i2)=>({c2,i2,v:advValue(c2,n,{runeDmg:bAct(n).runeDmg})})).sort((a,b)=>a.v-b.v).slice(0,fx.addCost.discard);
    }
    const ids = new Set(pool.map(p=>p.i2));
    /* RULING (Reincarnate): a card discarded at random can redirect itself
       to the bottom of the deck instead of the graveyard. */
    const _bottom = pool.filter(p=>fxParse(p.c2).bottomOnDiscard).map(p=>p.c2);
    const _toGrave = pool.filter(p=>!fxParse(p.c2).bottomOnDiscard).map(p=>p.c2);
    /* gyDisc, not gy — this IS a discard, and it is the only way "you've
       discarded a card with 6 or more {p} this turn" can ever see it. */
    actMut(n).grave = [...gyDisc(n.turn, ..._toGrave), ...act(n).grave];
    if(_bottom.length){ actMut(n).deck = [...act(n).deck, ..._bottom];
      n = L(n, `${_bottom.map(c=>c.name).join(", ")} reincarnates — bottom of the deck instead of the graveyard.`); }
    actMut(n).hand = act(n).hand.filter((_,i2)=>!ids.has(i2));
    n._discWay = [...(n._discWay||[]), ...pool.map(p=>p.c2)];
    n = L(n, `Additional cost — discarded ${pool.map(p=>p.c2.name).join(", ")}${fx.addCost.random?" (at random)":" (lowest value)"}.`);
    n = afterDiscard(n, pool.map(p=>p.c2), {random: !!fx.addCost.random});
    return {game:n, discarded: pool.map(p=>p.c2)};
  };

  /* ============================================================
     ARCANE DAMAGE — THE ONE PLACE A HERO TAKES IT (v2.74)

     Before this there was no such place, and the cost was four dead
     mechanics rather than one. Driven against the pre-fix engine, five
     arcane damage through arcane ward 3 AND Pyroglyphic shield 3 dealt
     five: `awd` and `arcShield` were written by the parser, stored on the
     side, rendered as pips — and never once read. Arcane Barrier (21
     pieces of iron across ALL FIFTEEN heroes) and Spellvoid were `noop`
     for want of an event to hang off. Thirty pool cards deal arcane
     damage across six heroes and nothing could stop any of it.

     No coverage tool could see that, and neither could the fairness
     sweep: every affected card reads tier `full` — the text was read
     correctly and then never CHARGED — and the sweep is deliberately
     one-sided towards cards that are too strong, while this was every
     defence being too weak.

     THE ORDER IS FREE-THEN-DRAINING-THEN-PAID, and it is a judgement:
       1. `arcShield` — Pyroglyphic Protection, per SOURCE, does not
          drain. Spending it first costs nothing.
       2. `awd` — arcane ward, one draining pool.
       3. the printed keywords — they cost resources or a permanent, so
          they are offered LAST and only for what is still coming.
     Reversing 1 and 2 would burn a limited pool while a renewable
     prevention sat unused, which is strictly worse for the defender and
     nothing in the rules asks for.

     THE HIT IS DEFERRED WHEN THERE IS SOMETHING TO ASK. Prompts are
     queued and drained after the action resolves, so applying the damage
     here and asking afterwards would offer the prevention AFTER the
     damage it prevents. The remaining damage therefore rides out on the
     prompt's answer as `arcTaken`. That is also what puts the trigger
     above the damage on the stack, which is where the CR puts it. */
  /* "YOU HAVE DEALT ARCANE DAMAGE THIS TURN" — CREDITED WHERE IT LANDS.

     This used to be added at the CALL SITE, before `arcaneHit` ran, so a
     point of arcane that was entirely turned aside by an arcane shield, a
     ward or a barrier still counted as dealt. CR 7.5.5 says prevented
     damage is not dealt, and the user ruled the same for the card that
     asks (2026-08-22, Sigil of Suffering: its own arcane counts "as long
     as it's not prevented").

     ONE INSTANCE PER SOURCE, not one per point — that is what `runOps`
     has always counted and what three Runechants are: three threats a
     hero may answer three times.

     The DEALER is credited, never the hero being hit. On the deferred
     path that distinction is load-bearing: a soak prompt is answered by
     the THREATENED side, so at `arcTaken` time the actor is the victim. */
  /* AND THE OTHER DIRECTION (v3.40). "If you have BEEN DEALT arcane
     damage this turn" (Arcane Polarity x3) is the mirror question, and
     `hist.arc` cannot answer it: that field is the DEALER's record. Both
     are credited from this one body so the "prevented is not dealt" rule
     above governs them together — a hit turned entirely aside credits
     neither, which is the only reading consistent with CR 7.5.5.

     `victim` is optional because one caller genuinely does not know it:
     nothing else has ever needed the other side of this. */
  const creditArc = (n, dealer, victim) => {
    const sd = dealer === actorOf(n) ? actMut(n) : foeMut(n);
    sd.hist = {...sd.hist, arc: ((sd.hist || {}).arc || 0) + 1};
    if(victim != null){
      const vd = victim === actorOf(n) ? actMut(n) : foeMut(n);
      vd.hist = {...vd.hist, arcTaken: ((vd.hist || {}).arcTaken || 0) + 1};
    }
    return n;
  };

  /* PLAIN WARD, AND IT WAS INERT AT THE TABLE (v3.67).

     `ward` is added by a shared op (`runOps`) and was consumed in exactly
     one place: `index.html`'s `takeIt`. `judge.js` applies `hp - total`
     and reads `.ward` nowhere at all — so five pool cards that print a
     prevention did NOTHING there: Cloud Cover, Oasis Respite, Seeker's
     Mitts, Toe the Line and (through its ability) Radiant Touch. v3.01's
     shape for the fifth time this cycle, and the arcane twin has been
     shared since `arcaneHit` was written, which is what made it look
     wired.

     IT REDUCES WHAT IS **DEALT**, NOT ONLY WHAT LIFE LOSES. CR 7.5.5:
     if prevention means no damage is dealt, IT IS NO LONGER A HIT — so a
     caller that subtracts ward from life while passing the unprevented
     number to its on-hit clauses fires every rider off damage that never
     landed. The number this returns is the one the whole resolution must
     use, which is why it returns `dealt` rather than mutating life.

     THE RIDER FIRES WHERE THE PREVENTION HAPPENS, for the same reason
     `hist.arc`'s credit lives inside `arcaneHit` (v3.28): a prevention
     that turns nothing aside must trigger nothing, and putting the test
     at the call site is how that went wrong the first time.

     WHOSE PREVENTION IS IT? The pool is one number, so a side holding two
     wards cannot say which absorbed — and it does not have to: both are
     soaking from the same pool at the same moment, so a rider held while
     ANY of it drains really was prevented "this way". Stated as an
     approximation rather than derived. */
  const preventDamage = (n, seat, amount, srcName) => {
    let left = Math.max(0, amount | 0);
    const sd = n.sides[seat] || {};
    const pool = sd.ward || 0;
    /* THIS EARLY RETURN IS WHAT MAKES "A PREVENTION THAT PREVENTS NOTHING
       TRIGGERS NOTHING" TRUE — CR 7.5.5's shape, and the property the
       rider below depends on. An empty pool or a swing already blocked to
       nothing leaves the rider waiting, which is what the card's "the NEXT
       time" prints. A second `off > 0` guard around the rider read as
       belt-and-braces and was DEAD: past this line both numbers are
       positive, so `off` is always at least 1. Dead rules code is worse
       than dead code elsewhere — it is a second description of a rule
       nobody can reach and everybody can read. */
    if(!(pool > 0) || left <= 0) return {game: n, dealt: left, prevented: 0};
    const off = Math.min(pool, left);
    left -= off;
    const mut = () => seat === actorOf(n) ? actMut(n) : foeMut(n);
    mut().ward = pool - off;
    n = L(n, `${srcName || "The attack"}: ward soaks ${off}`
           + (pool - off > 0 ? ` (${pool - off} left).` : " and is spent."));
    /* WHAT THE PREVENTION TRIGGERS (v3.67) — Toe the Line's "if you
       prevent damage this way, create a Flurry token". The grant was made
       on an earlier resolution and fires here, which is why it cannot be
       a `way:` condition (those are cleared with the resolution that set
       them). Spent when it fires: the card prints "the NEXT time". */
    const rid = (n.sides[seat] || {}).wardRider || [];
    if(rid.length){
      mut().wardRider = [];
      const prev = actorOf(n);
      n = Object.assign({}, n, {actor: seat});
      for(const r of rid) n = runOps(n, r.ops || [], r.src || srcName || "prevention");
      n = Object.assign({}, n, {actor: prev});
    }
    return {game: n, dealt: left, prevented: off};
  };

  const arcaneHit = (n, seat, amount, srcName) => {
    const mut = () => seat === actorOf(n) ? actMut(n) : foeMut(n);
    const sd  = () => n.sides[seat];
    let left = Math.max(0, amount|0);
    if(left <= 0) return n;

    const shield = sd().arcShield || 0;
    if(shield > 0 && left > 0){
      const off = Math.min(shield, left); left -= off;
      n = L(n, `${srcName}: arcane shield turns ${off} of it aside (it stands against every source).`);
    }
    const pool = sd().awd || 0;
    if(pool > 0 && left > 0){
      const off = Math.min(pool, left); left -= off;
      mut().awd = pool - off;
      n = L(n, `${srcName}: arcane ward soaks ${off}${pool-off>0?` (${pool-off} left)`:" and is spent"}.`);
    }

    /* WHAT THE PRINTED IRON OFFERS. `avail` is what the threatened hero
       can actually reach — floating resources plus what their hand would
       pitch for, because pitching is on demand (RULING, 2026-08-01) and a
       hero being hit on someone else's turn has no other way to find an
       {r}. `buildPrompt` drops anything they cannot afford and returns
       null when there is nothing worth asking, so a hero with no iron
       never sees a sheet. */
    const soaks = P.arcaneSoaks(sd());
    if(left > 0 && soaks.length){
      /* NO `avail` ON THE SPEC — buildPrompt works it out from the live
         state when the sheet is actually raised. Three Runechants queue
         three of these off one attack and answering the first one pitches,
         so a figure frozen here is stale by the second sheet. It is only
         passed to the probe below, which asks "is there anything worth
         asking RIGHT NOW" before committing to defer the damage. */
      /* WHO DEALT IT rides on the spec, because the answer is given by the
         side being hit and `arcTaken` would otherwise credit the victim.
         A spec only carries fields `buildPrompt` knows about (the
         `arsStamp` lesson, v2.34), so it is passed through explicitly. */
      const spec = {tag:"soak", side:seat, src:srcName, amount:left, options:soaks, by:1-seat};
      if(buildPrompt(n, spec)){
        n.promptQ = [...(n.promptQ||[]), spec];
        return n;                    /* the damage rides out on the answer */
      }
    }
    if(left > 0){
      mut().hp -= left;
      n = creditArc(n, 1 - seat, seat);
      /* THE TRACE FOR "…DEALT THIS WAY" (v3.62), recorded where the damage
         actually LANDS — so CR 7.5.5's "prevented is not dealt" governs it
         for free, exactly as `creditArc` above relies on the same guard.
         A hit turned entirely aside records nothing. */
      n._dmgWay = (n._dmgWay || 0) + left;
      n = L(n, `${srcName}: ${left} arcane damage.`);
    } else {
      /* PREVENTED IS NOT DEALT (CR 7.5.5, and RULING user 2026-08-22:
         Sigil of Suffering's own arcane satisfies its own condition "as
         long as it's not prevented"). No credit — see `creditArc`. */
      n = L(n, `${srcName}: every point of it prevented.`);
    }
    return n;
  };

  const runOps = (s, ops, srcName) => {
    let n = {...s};
    ops.forEach(op=>{
      const [k,v] = op;
      if(k==="draw"){ const take=act(n).deck.slice(0,v); actMut(n).hand=[...act(n).hand,...take]; actMut(n).deck=act(n).deck.slice(v); if(take.length) n=L(n,`Drew ${take.length}.`); }
      /* AT RANDOM, AND SEEDED. Two peers and a replay must discard the SAME
         card, so this consumes the seeded stream and stores it back — the
         one rule rng.js states outright. `_discWay` records what this
         resolution discarded, which is what "discarded this way" reads;
         `gyDisc` stamps the graveyard copy so "discarded this TURN" can
         tell a discard from a card that was merely played. */
      else if(k==="discardRandom"){
        const taken=[];
        for(let i=0;i<Math.max(1,v);i++){
          const h=act(n).hand;
          if(!h.length) break;
          const r=rngInt(n.rng, h.length); n.rng=r.rng;
          taken.push(h[r.v]);
          actMut(n).hand = h.filter((_,ix)=>ix!==r.v);
        }
        if(!taken.length){ n=L(n,`${srcName}: your hand is empty — nothing to discard.`); return; }
        /* Reincarnate prints "When this is discarded at random, put it on
           the bottom of its owner's deck" — it IS discarded (so it still
           answers "discarded this way"), it just never lands in the
           graveyard. */
        const bottom=taken.filter(c=>fxParse(c).bottomOnDiscard);
        const toGrave=taken.filter(c=>!fxParse(c).bottomOnDiscard);
        if(toGrave.length) actMut(n).grave=[...gyDisc(n.turn,...toGrave),...act(n).grave];
        if(bottom.length){
          actMut(n).deck=[...act(n).deck,...bottom];
          n=L(n,`${bottom.map(c=>c.name).join(", ")} was discarded at random — it goes to the bottom of the deck instead.`);
        }
        n._discWay=[...(n._discWay||[]),...taken];
        n=L(n,`${srcName}: discarded ${taken.map(c=>c.name+" ("+zonePow(c,bAct(n))+"{p})").join(", ")} at random.`);
        n = afterDiscard(n, taken, {random:true});
      }
      /* "TARGET HERO … UNLESS THEY PAY {r}{r}{r}" (v2.75) — the printed
         escape hatch, offered to the hero who has to live with it.

         Queued, never inline: the card has to finish resolving before
         anybody is asked, the same rule every other prompt here follows.
         Addressed to `1-actorOf(n)` so it is the TARGET's call — that is
         what "target hero may pay" says, and it is why `prompts.js`
         addresses specs to a side at all (Cold Snap's ruling is the
         original example).

         `ops` is empty and `elseOps` carries the payload: paying is what
         AVOIDS the consequence. The payload is actor-relative to the asked
         side, because promptConfirm resolves a sheet at the actor of the
         side it was addressed to. */
      else if(k==="payOr"){
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pay", side:1-actorOf(n), src:srcName, cost:v,
          ops:[], elseOps: op[2] || [],
          title:`Pay ${v} or ${srcName.toLowerCase()} bites`,
          hint:`${srcName}: pay ${v}, or take what it prints. Pitching is on demand.`}];
      }
      /* The mirror of `foeDiscard`, for a payload resolving at the asked
         side's own actor. Same selection rule: the cards at the back of
         the hand, so a discard is not silently the player's best card. */
      else if(k==="selfDiscard"){
        const take = act(n).hand.slice(-Math.max(1,v));
        if(!take.length) n = L(n, `${srcName}: ${act(n).name}'s hand is already empty.`);
        else {
          actMut(n).hand = act(n).hand.slice(0, act(n).hand.length-take.length);
          actMut(n).grave = [...gyDisc(n.turn, ...take), ...act(n).grave];
          /* THE EXISTING TRACE, NOT A SECOND ONE. `_discWay` has recorded
             "what this resolution discarded" since `discard6way` was
             built, and it is cleared per resolution in `execute` for
             exactly the reason this needs. Written first as a private
             `_thisWay`, this was two records of one fact — the no-mirror
             rule broken inside one file, and the very "check whether it
             already exists" lesson this week keeps paying for.

             It also closes a gap the comment on `creditDiscard` names:
             "every discard path should call this. Today that is
             `discardRandom`" — `selfDiscard` was not wired, so a 6+ power
             card discarded by one could never satisfy `discard6way`. */
          n._discWay = [...(n._discWay||[]), ...take];
          /* AND WHAT THE COST CONSUMED (v3.90) — the same cards, a
             different question. "That card" names whichever branch of a
             modal cost was taken, and only one of the two branches is a
             discard. */
          n._costWay = [...(n._costWay||[]), ...take];
          /* THE VERB AGREES WITH THE NAME THE LINE JUST USED (v3.88's
             rule, and this line predates it): seat 0's name is literally
             "You", so an unconditional "discards" reads "You discards".

             THE TEST IS HOISTED OUT OF THE TEMPLATE on purpose — the
             second-person ledger in `judge.test.js` scans string and
             template literals, so a `/^you$/` inside the backticks counts
             as a second-person feed line. Reword rather than weaken the
             scan; same discipline as `html-balance.test.js`'s
             pre-neutralize list. */
          const _dv = isSecondPerson(act(n).name) ? "discard" : "discards";
          n = L(n, `${srcName}: ${act(n).name} ${_dv} ${take.map(c=>c.name).join(", ")} — ${act(n).hand.length} left in hand.`);
          /* AND THE SHARED DISCARD EVENT, which v3.61 left behind (v3.70).
             That version wired this op into `_discWay` and quoted the gap
             it was closing — "every discard path should call this" — while
             `afterDiscard`, the body that mints Kayo's Might, kept its
             three older call sites and not this one. HALF A GAP CLOSED
             READS EXACTLY LIKE A WHOLE ONE.

             `{random:false}` is the whole of the distinction the body
             already draws: Beaten Trackers prints "whenever you discard a
             RANDOM card" and is gated on it, while Kayo's clause 3 fires
             on any discard at all. Reading the two as one event would hand
             out a free action point every time a cost was paid by choice.

             LATENT, AND MEASURED BEFORE WIRING IT: exactly one pool card
             emits `selfDiscard` (Portside Exchange, in Gravy Bones' deck),
             so no hero holds both it and a 6-power discard payoff today.
             The route exists all the same, and the next card that prints a
             non-random discard would have gone quietly uncredited. */
          n = afterDiscard(n, take, {random: false});
        }
      }
      /* ---- THE CRUSH PAYLOADS (v3.16) ---------------------------------
         Each is the printed rider of ONE card, and until now all twelve
         crush cards ran Boulder Drop's. `foeHandToDeck` IS Boulder Drop's,
         moved out of the trigger so the generic path serves it too — one
         reader, no card named at the trigger site. */
      /* ARMED AGAINST THEIR NEXT TURN (v3.29). A crush rider that reaches
         forward has nowhere else to live: `hist` is the natural home for
         a per-turn fact and is CLEARED for the incoming seat at CR 4.4.4,
         which is the exact moment this has to survive.

         `ready:false` — it does nothing until `armNextTurn` turns it on at
         the start of that side's turn. Without that an effect created on
         their turn would fire immediately, which is a turn early. */
      else if(k==="foeNextTurn"){
        foeMut(n).nextTurn = [...(foe(n).nextTurn||[]), {kind:v, amt:op[2]||0, ready:false}];
        n = L(n, `${srcName}: ${foe(n).name} feels it next turn.`);
      }
      else if(k==="foeHandToDeck"){
        /* WHICH card is an approximation and always was: the printed text
           lets THEM choose, and this takes the last in hand. Carried over
           verbatim from the hardcoded trigger rather than quietly changed. */
        if(!foe(n).hand.length){ n = L(n, `${srcName}: ${foe(n).name}'s hand is empty.`); return; }
        const top = foe(n).hand[foe(n).hand.length-1];
        foeMut(n).hand = foe(n).hand.slice(0,-1);
        foeMut(n).deck = [top, ...foe(n).deck];
        n = L(n, `${srcName}: ${top.name} is forced from ${foe(n).name}'s hand back on top of their deck.`);
      }
      else if(k==="foeGearDef"){
        /* A -1{d} COUNTER SITS ON THE PIECE, so it travels between turns
           and every later block reads it. `curDef` is the live value the
           block path already uses; a piece at 0 stays in play. */
        const live = (foe(n).gear||[]).filter(g => g && !g.destroyed && (g.curDef != null ? g.curDef : g.def) > 0);
        if(!live.length){ n = L(n, `${srcName}: ${foe(n).name} has no equipment left to weaken.`); return; }
        const worst = live.slice().sort((a,b) => ((b.curDef!=null?b.curDef:b.def)||0) - ((a.curDef!=null?a.curDef:a.def)||0))[0];
        foeMut(n).gear = foe(n).gear.map(g => g && g.uid === worst.uid
          ? {...g, curDef: Math.max(0, ((g.curDef!=null?g.curDef:g.def)||0) + v)} : g);
        n = L(n, `${srcName}: ${worst.name} takes a ${v}{d} counter.`);
      }
      else if(k==="foeArsDestroy"){
        if(!foe(n).arsenal){ n = L(n, `${srcName}: ${foe(n).name}'s arsenal is empty.`); return; }
        const a = foe(n).arsenal;
        foeMut(n).arsenal = null;
        foeMut(n).grave = [...gy(n.turn, a), ...foe(n).grave];
        /* THE SAME TRACE (v3.95) — Loot the Arsenal prints "destroy a card
           in their arsenal. IF YOU DO, create a Gold token", and an empty
           arsenal destroys nothing. "You do" and "they do" name the same
           event from the two ends of it; the reader accepts both. */
        n._tookWay = [...(n._tookWay||[]), a];
        n = L(n, `${srcName}: ${a.name} is destroyed in ${foe(n).name}'s arsenal.`);
      }
      /* BANISHING FROM THE OPPONENT'S ARSENAL (v3.96) — the twin of
         `foeArsDestroy` two lines up, and the distinction is REAL: a
         DESTROYED card reaches the graveyard, where the two `retrieve`
         cards and every "from your graveyard" reader can still find it;
         a BANISHED one is out of the game. Filing a banish in the
         graveyard hands back a card the text removed from play, which is
         the same mistake `sweepGear` had to be told about (v3.79).

         IT FEEDS `_tookWay` (v3.95), for its reason: an empty arsenal
         takes nothing, and a rider gated on "if you do" must be able to
         tell. No pool card pairs this op with such a rider today; the
         trace is recorded where the fact becomes true regardless, because
         a trace bolted on later is a trace the next reader re-derives. */
      else if(k==="foeArsBanish"){
        if(!foe(n).arsenal){ n = L(n, `${srcName}: ${foe(n).name}'s arsenal is empty.`); return; }
        const a = foe(n).arsenal;
        foeMut(n).arsenal = null;
        foeMut(n).banish = [a, ...foe(n).banish];
        n._tookWay = [...(n._tookWay||[]), a];
        n = L(n, `${srcName}: ${a.name} is banished out of ${foe(n).name}'s arsenal — not the graveyard, so nothing fetches it back.`);
      }
      /* DESTROYING THE TOP OF THE OPPONENT'S DECK (v3.96) — the foe twin
         of `deckDestroy` (v3.90), and a different op rather than a flag on
         one: whose deck is milled is the whole of what Goon Tactics'
         rider says, and an op that took a side as a parameter would let a
         card's text choose. Same reason `revPitch` and `revColorPitch`
         stay apart. */
      else if(k==="foeDeckDestroy"){
        const take = foe(n).deck.slice(0, Math.max(1, v));
        if(!take.length){ n = L(n, `${srcName}: ${foe(n).name} has no deck left to destroy from.`); return; }
        foeMut(n).deck = foe(n).deck.slice(take.length);
        foeMut(n).grave = [...gy(n.turn, ...take), ...foe(n).grave];
        n._tookWay = [...(n._tookWay||[]), ...take];
        n = L(n, `${srcName}: ${take.map(c=>c.name).join(", ")} destroyed off the top of ${foe(n).name}'s deck.`);
      }
      else if(k==="foeArsBottom"){
        if(!foe(n).arsenal){ n = L(n, `${srcName}: ${foe(n).name}'s arsenal is empty.`); return; }
        const a = foe(n).arsenal;
        foeMut(n).arsenal = null;
        foeMut(n).deck = [...foe(n).deck, a];
        n = L(n, `${srcName}: ${a.name} goes to the bottom of ${foe(n).name}'s deck.`);
      }
      /* ---- AZALEA'S ARSENAL CYCLE (v3.71) ---------------------------
         "Put a card from your arsenal on the bottom of your deck. If you
         do, put the top card of your deck face-up into your arsenal. If
         it's an arrow, it gets dominate until end of turn."

         ONE OP FOR THREE SENTENCES, because two of them reach across the
         clause split: "if you DO" is conditional on the first actually
         happening, and "IT" is the card the second put. Three independent
         ops would need `runOps` to thread "did the last one fire" and
         "which card was it" between them, which is state no op carries.

         "IF YOU DO" IS LOAD-BEARING. With an empty arsenal nothing is put
         on the bottom, so nothing comes off the deck — the ability does
         NOTHING, and the player is told so rather than handed a free
         face-up card. Reading the second sentence unconditionally would
         make her hero strictly better than printed on the one board state
         where the cost cannot be paid. */
      else if(k==="arsCycle"){
        const grant = v || null;
        const out = act(n).arsenal;
        if(!out){ n = L(n, `${srcName}: the arsenal is empty — nothing to cycle.`); return; }
        actMut(n).arsenal = null;
        actMut(n).deck = [...act(n).deck, out];
        /* THE SEAT IS NAMED BY THE COLON, NOT BY A POSSESSIVE (v2.83's
           rule, and the reason heave's own note gives). `act(n).name` is
           literally "You" on the trainer, so "${act(n).name}'s deck"
           reads "You's deck" there and a hero name at the table — one
           string that is wrong on exactly one of the two boards. Three
           older sites in this file still say it; recorded in HANDOFF.md
           rather than swept in on a card change. */
        n = L(n, `${act(n).name}: ${srcName} — ${out.name} goes to the bottom of the deck.`);
        if(!act(n).deck.length){ n = L(n, `${srcName}: the deck is empty — nothing comes back.`); return; }
        const top = act(n).deck[0];
        actMut(n).deck = act(n).deck.slice(1);
        actMut(n).arsenal = top;
        /* THE SHARED BODY (v3.71) — an arrow's own "when this is put
           face-up into your arsenal" trigger fires here exactly as it does
           on a pick from hand, because there is one body and not two. */
        n = faceUpArsenal(n, [], srcName, "deck");
        n = applyArsGrant(n, grant, srcName);
      }
      /* ---- BRAVO'S TURN-UP (v3.72) ----------------------------------
         "Turn a face-down card in your arsenal face-up. If it has crush,
          it gets +2{p} and dominate this turn."

         THE SECOND CONSUMER OF THE FACE-UP MACHINERY, and it needed no
         new machinery at all: `faceUpArsenal` already turns whatever is
         there and fires its triggers, and `applyArsGrant` already stamps
         a conditional bonus onto it. What is new is the EVENT.

         TURNING IS NOT PUTTING, and the pool prints the difference: Spire
         Sniping alone says "put OR TURNED face up", every other arsenal
         trigger says "put". So the source zone is `"arsenal"` and
         `faceUpArsenal` skips a put-only trigger. Measured before it was
         carried: no deck holds both a turn-up and a put-only trigger
         (Bravo is Guardian, the arrows are Ranger), so it is LATENT — but
         it is a printed distinction, and a reader that ignores one is
         reading the card wrong whether or not anything notices today. */
      else if(k==="arsTurn"){
        const cur = act(n).arsenal;
        if(!cur){ n = L(n, `${srcName}: the arsenal is empty — nothing to turn.`); return; }
        if(cur._faceUp){ n = L(n, `${srcName}: ${cur.name} is already face up.`); return; }
        n = faceUpArsenal(n, [], srcName, "arsenal");
        n = applyArsGrant(n, v || null, srcName);
      }
      else if(k==="allArsBottom"){
        /* ALL arsenals — the caster's too. Fault Line prints "all cards in
           all arsenals", and reading it as the opponent's alone would make
           it strictly better than printed. */
        let moved = 0;
        for(const i of [0,1]){
          const sd = n.sides[i]; if(!sd || !sd.arsenal) continue;
          const a = sd.arsenal; moved++;
          n = {...n, sides: n.sides.map((x,ix) => ix!==i ? x : {...x, arsenal:null, deck:[...x.deck, a]})};
        }
        n = L(n, moved ? `${srcName}: ${moved} arsenal card${moved>1?"s go":" goes"} to the bottom of the deck.`
                       : `${srcName}: every arsenal is already empty.`);
      }
      else if(k==="destroyFoeToken"){
        const want = norm(String(v||""));
        const hit = (foe(n).board||[]).find(b => b && b.card && norm(b.card.name) === want);
        if(!hit){ n = L(n, `${srcName}: ${foe(n).name} controls no ${v}.`); return; }
        foeMut(n).board = foe(n).board.filter(b => b !== hit);
        foeMut(n).grave = [...gy(n.turn, hit.card), ...foe(n).grave];
        n = L(n, `${srcName}: ${hit.card.name} is destroyed.`);
      }
      else if(k==="foeDiscard"){
        const take = foe(n).hand.slice(-Math.max(1,v));
        if(!take.length) n = L(n, `${srcName}: ${foe(n).name}'s hand is already empty.`);
        else {
          foeMut(n).hand = foe(n).hand.slice(0, foe(n).hand.length-take.length);
          foeMut(n).grave = [...take, ...foe(n).grave];
          /* WHAT THIS RESOLUTION TOOK FROM THE OPPONENT (v3.95), beside
             `_discWay` ("what this resolution discarded", which is the
             ACTOR's own) and `_dmgWay`. Loot the Hold prints "they discard
             a card. IF THEY DO, create a Gold token" — an empty hand takes
             nothing, and the rider is the whole difference. Recorded where
             the fact becomes true (v3.62), so an empty zone records
             nothing without the guard being restated. */
          n._tookWay = [...(n._tookWay||[]), ...take];
          n = L(n, `${srcName}: ${foe(n).name} discards ${take.map(c=>c.name).join(", ")} — ${foe(n).hand.length} left in hand.`);
        }
      }
      /* THE DEFENDER'S ESCAPE HATCH (Strongest Survive). "…unless they
         reveal a card from their hand with {p} greater than the damage
         dealt this way."

         Three things this has to get right:
           - "the damage DEALT" is what actually landed, after blocks
             (`lastDmg`), not the attack's printed power. A 7-power swing
             stopped to 3 is beaten by a 4.
           - the revealed card is read with the DEFENDER'S OWN build, so in
             a Kayo mirror their clause 2 lifts their hand exactly as yours
             lifts yours. That is what `bFoe` is for.
           - RULING (user, 2026-08-08): the dummy reveals whenever it
             legally can, so the card plays at full printed strength
             against you rather than being quietly better than printed.
         Revealing is free and public — nothing leaves their hand. */
      else if(k==="foeDiscardUnlessReveal"){
        const dmg = n.lastDmg || 0;
        const esc = foe(n).hand.find(c => zonePow(c, bFoe(n)) > dmg);
        if(esc){
          n = L(n, `${srcName}: ${foe(n).name} reveals ${esc.name} (${zonePow(esc, bFoe(n))}{p}, more than the ${dmg} dealt) — no discard.`);
          return;
        }
        const take = foe(n).hand.slice(-Math.max(1,v));
        if(!take.length){ n = L(n, `${srcName}: ${foe(n).name}'s hand is already empty.`); return; }
        foeMut(n).hand = foe(n).hand.slice(0, foe(n).hand.length-take.length);
        foeMut(n).grave = [...gyDisc(n.turn, ...take), ...foe(n).grave];
        n = L(n, `${srcName}: nothing in ${foe(n).name}'s hand beats the ${dmg} dealt — discards ${take.map(c=>c.name).join(", ")}.`);
      }
      else if(k==="foeBanish"){
        const take = foe(n).hand.slice(-Math.max(1,v));
        if(!take.length) n = L(n, `${srcName}: ${foe(n).name}'s hand is already empty.`);
        else {
          foeMut(n).hand = foe(n).hand.slice(0, foe(n).hand.length-take.length);
          foeMut(n).banish = [...take, ...foe(n).banish];
          n = L(n, `${srcName}: ${foe(n).name} banishes ${take.map(c=>c.name).join(", ")} — ${foe(n).hand.length} left in hand.`);
        }
      }
      else if(k==="res"){ actMut(n).res+=v; n=L(n,`+${v} resource.`); }
      else if(k==="ap"){ actMut(n).ap+=v; n=L(n,`+${v} action point${v>1?"s":""} — the turn stretches.`); }
      else if(k==="life"){
        /* RULING (Reaping Blade): if you are the hero ahead, the gain fizzles */
        if(act(n).lifeLock && act(n).hp > foe(n).hp){ n = L(n, `${srcName}: you are ahead on life — the gain fizzles.`); return; }
        actMut(n).hp+=v; n=L(n,`+${v} life.`);
      }
      /* ARCANE DAMAGE GOES THROUGH THE ONE CHOKE POINT (v2.74). It used to
         be `foeMut(n).hp -= total` right here, which is why arcane ward,
         Pyroglyphic Protection's shield, Arcane Barrier and Spellvoid were
         ALL dead: there was nowhere for a prevention to stand. Driven
         before the fix, five arcane through arcane-ward 3 AND shield 3
         dealt five. `arcaneHit` is where every one of them now applies. */
      else if(k==="arcane"){ const total=v+act(n).amp; actMut(n).amp=0; n=arcaneHit(n, 1-actorOf(n), total, srcName); }
      /* The damage that SURVIVED a soak prompt, landing on the hero that
         was asked — the actor at prompt-confirm time is the threatened
         side (promptConfirm borrows `p.side`). That is the whole reason it
         is a separate op from `arcane`, which damages the foe. It is
         already past every prevention, so it never re-enters arcaneHit;
         doing so would offer a second Nullrune for the same hit. */
      else if(k==="arcTaken"){
        if(v>0){
          actMut(n).hp -= v;
          /* THE DEALER IS op[3], not the actor. The actor here is the side
             that was ASKED — it borrowed `p.side` at prompt-confirm — so
             crediting `act` would hand the arcane to the hero taking it. */
          /* THE VICTIM IS THE ACTOR HERE, and only here: this answer was
             given by the side being HIT, which borrowed `p.side` at
             prompt-confirm. That is the same inversion the dealer comment
             above describes, read from the other end. */
          if(op[3] != null) n = creditArc(n, op[3], actorOf(n));
          n = L(n, `${op[2]||srcName}: ${v} arcane damage lands on ${act(n).name}.`);
        }
        else n = L(n, `${op[2]||srcName}: all of it soaked — no damage.`);
      }
      else if(k==="buffNext"){
        /* A QUALIFIED buff ("your next ARROW attack") is not the same as a
           bare one. op[2] is the qualifier read off the printed type line;
           it rides in buffQ so only a matching attack collects it. Without
           this an arrow buff landed on a sword — 24 pool cards did that. */
        /* op[3] is a GRANTED ABILITY riding with the pump — Warrior's
           Valor's `and "When this hits, it gets go again."` It has to
           travel on the buffQ entry, because it belongs to the attack
           that eventually collects the pump, not to the card that
           handed it over. */
        /* op[4] is `once` (v4.12): the grant is spent by your NEXT attack
           whether or not the qualifier matched, because the printed line
           names that one card and the qualifier is a CONDITION on it
           rather than a restriction on which card the grant waits for.
           OPT-IN, so every existing entry keeps its shape (v3.58). */
        if(op[2] || op[3]){
          actMut(n).buffQ = [...(act(n).buffQ||[]),
            Object.assign({amt:v, q:op[2]||null, rider:op[3]||null}, op[4] ? {once:true} : {})];
          const who = op[2] ? P.qualLabel(op[2]).replace(/^an? /, "") : "attack";
          n=L(n,`Next ${who} +${v}${op[3]?", and it goes again if it hits":""}.`); }
        else { actMut(n).buffNext+=v; n=L(n,`Next attack +${v}.`); }
      }
      /* a keyword this resolution has GRANTED — read beside the printed
         ones, so a gated keyword works when its condition actually fires */
      else if(k==="gainKw"){ n._kwGrant=[...(n._kwGrant||[]), String(v).toLowerCase()];
        n=L(n,`${srcName} gains ${v}.`); }
      /* a named piece of the actor's iron pays with itself */
      else if(k==="destroyGear"){
        const g2 = (act(n).gear||[]).find(x=>x && x.uid===v);
        if(!g2){ n=L(n,`${srcName}: that piece is no longer on the board.`); return; }
        actMut(n).gear = act(n).gear.map(x => x.uid===v ? {...x, destroyed:true} : x);
        n=L(n,`${g2.name} is destroyed — the cost is paid.`);
      }
      /* A QUALIFIED "your next X gets go again" waits for an X (v3.31).
         `gaNext` is a bare boolean spent by whatever comes next, which is
         right for the unqualified wording and strictly stronger than
         printed for the four cards that name a target — go again keeps
         your action point, so it is the most valuable keyword in the game
         to hand to the wrong card. Same split `buffNext` / `buffQ` keep. */
      /* A ONE-SHOT COST REDUCTION, WAITING FOR THE CARD IT NAMES (v3.32).
         Seismic Surge's payout, and the third of the qualified single-shot
         grants — `buffQ` for power, `gaNextQ` for go again, this for cost.
         All three share one qualifier reader and all three WAIT rather
         than being spent by a card the printed line does not name. */
      else if(k==="costOff"){
        actMut(n).costOff = [...(act(n).costOff||[]), {amt:v, q:op[2]||null}];
        /* THE FEED IS READ BY BOTH SEATS, so it names one (v2.83). */
        n=L(n,`${act(n).name}: their next ${P.qualLabel(op[2]||null).replace(/^an? /,"")} costs ${v} less.`);
      }
      /* A ONE-SHOT SPEED GRANT, WAITING FOR THE CARD IT NAMES (v3.37).
         Stir the Aetherwinds, and the FOURTH of the qualified single-shot
         grants — `buffQ` power, `gaNextQ` go again, `costOff` cost, this
         the WINDOW. All four share one qualifier reader and all four WAIT
         rather than being spent by a card the printed line does not name.

         THE AMP RIDES WITH IT because the card's two sentences are about
         the same card — see the pairing in `fxParse`. Carried on the
         grant rather than added to `sd.amp` here, or it leaks onto the
         next arcane from any card at all, which is what it used to do. */
      else if(k==="instantNext"){
        const iq = op[1] || null;
        if(!iq) return;
        actMut(n).instantNextQ = [...(act(n).instantNextQ||[]), iq];
        /* THE FEED IS READ BY BOTH SEATS, so it names one (v2.83). */
        n=L(n,`${act(n).name}: their next ${P.qualLabel(iq.q).replace(/^an? /,"")} may be played at instant speed`
             + (iq.amp ? ` and deals +${iq.amp} arcane.` : "."));
      }
      else if(k==="gaNext"){
        const gq = op[1] || null;
        /* THE RIDER TRAVELS WITH THE QUALIFIER (v3.42), same split
           `buffNext`/`buffQ` keep for their own granted ability (op[3]
           there, since op[1] there is an amount). It waits with the
           grant and is applied only to the attack that actually collects
           the go again — see `takeGaNext` and its call site. */
        const rider = op[2] || null;
        if(gq){ actMut(n).gaNextQ = [...(act(n).gaNextQ||[]), {q: gq, rider}];
                n=L(n,`Your next ${P.qualLabel(gq).replace(/^an? /,"")} this turn will carry go again`
                     +`${rider?", and its hit carries a granted ability":""}.`); }
        else  { actMut(n).gaNext=true; n=L(n,"Your next attack this turn will carry go again."); }
      }
      /* THE FIFTH QUALIFIED SINGLE-SHOT GRANT (v3.64), and it restricts the
         OPPONENT rather than buffing you: Confidence's "your next attack
         action card this turn can't be defended by more than 2 non-block
         cards". It waits for the card the printed line names — a grant
         that does not match is not spent (v2.30) — and the COUNTED SET
         rides with it, because dominate's cap counts hand cards and this
         one counts non-block cards. Two caps, two sets, one reader in
         `parser.defCap`. */
      else if(k==="defCapNext"){
        const cq = op[2] || null, cnt = op[3] || "hand";
        actMut(n).defCapNext = [...(act(n).defCapNext||[]), {n: op[1], count: cnt, q: cq}];
        /* NAME THE SEAT (v2.83). `say`/`L` writes the SHARED feed, which
           both seats read, so "your next attack" is a lie to one of them
           the moment seat 1 plays a card. The `gaNext` line above is part
           of that ledger's 44-line debt; this one does not join it. */
        n = L(n, `${act(n).name}: the next ${P.qualLabel(cq).replace(/^an? /,"")} played this turn can't be defended by more than ${op[1]} ${cnt==="nonBlock"?"non-block":"hand"} card${op[1]===1?"":"s"}.`);
      }
      /* A COUNT, NOT A FLAG (v3.10). Mauvrion Skies prints 3 Runechants at
         red, 2 at yellow and 1 at blue; this was a boolean, so it could
         not have carried 3 even when it fired — and it only ever fired on
         the blue copy, because the parser tested for the bare string
         "create a runechant". Viserai's own card, and Runechants are his
         whole engine. */
      else if(k==="runeHitNext"){ const many=Math.max(1,v||1); actMut(n).runeHitNext=many;
        n=L(n,`Your next attack: if it hits, ${many>1?`${many} Runechants are`:"a Runechant is"} forged.`); }
      else if(k==="amp"){ actMut(n).amp+=v; n=L(n,`Amp ${v} — next arcane +${v}.`); }
      else if(k==="ward"){
        actMut(n).ward+=v;
        /* THE EXPIRING PORTION IS TRACKED SEPARATELY (v4.07). The pool is
           one number because prevention is spent as one number, but the
           two SOURCES have different windows: a printed "prevent the next
           N damage THIS TURN" is a one-shot the turn takes back, and an
           aura's `Ward N` keyword is a value the permanent carries.
           Sweeping the whole pool would decide the open aura-ward ruling
           by accident; sweeping only what was granted for the turn decides
           nothing. */
        if(op[2] && op[2].until === "turn") actMut(n).wardTurn += v;
        n=L(n,`Ward ${v}.`);
        /* THE RIDER WAITS WITH THE POOL (v3.67). Toe the Line prints
           "The next time you would be dealt damage this turn, prevent 2
           of that damage. IF YOU PREVENT DAMAGE THIS WAY, create a
           Flurry token." The two halves arrive as separate clauses and
           are paired in `fxParse`; the second cannot be a `way:`
           condition because the prevention happens on a LATER
           resolution, and those traces are cleared with the resolution
           that set them (v3.60). It is fired by `preventDamage`. */
        if(op[2] && op[2].ops && op[2].ops.length){
          actMut(n).wardRider = [...(act(n).wardRider||[]), {ops: op[2].ops, src: srcName}];
          n = L(n, `${srcName}: and something waits on that prevention.`);
        }
      }
      else if(k==="awd"){ actMut(n).awd+=v;
        if(op[2] && op[2].until === "turn") actMut(n).awdTurn += v;   /* same window, same reason */
        n=L(n,`Arcane ward ${v} — soaks spells, not fists.`); }
      else if(k==="soulSelf"){ n._soulSelf = true; }
      else if(k==="ga"){ n._gaGrant = true; n = L(n, "Go again granted."); }
      else if(k==="defBuff"){ n = L(n, `+${v} defense to the wall.`); }
      /* "-N POWER" ASKS WHETHER THERE IS A HOSTILE ATTACK IN FLIGHT, and
         that is not a phase question (v2.77). It read `mode==="block"`,
         which is the trainer's name for one particular shape of one
         particular board — so in judge.js, where the defending seat is an
         argument rather than a mode string, a defence reaction's whole
         payload would have gone quietly nowhere.

         The two callers hold the incoming attack in different places and
         both are named here rather than translated:

           judge.js   `pend`, whoever declared it — one combat path, so the
                      test is that the link belongs to the OTHER seat
           trainer    `incoming`, a scalar set by foeSwing/foePlay, because
                      seat 1's swing there never opens a `pend` at all

         The one corner where this differs from the old line: an incoming
         swing of exactly 0 (frailty ≥ the printed power) now logs "nothing
         hostile to shave" instead of "shaved to 0". No state differs —
         shaving 0 leaves 0 either way. */
      else if(k==="atkMinus"){
        const hostile = n.pend && n.pend.by != null && n.pend.by !== actorOf(n);
        if(hostile){
          n.pend = {...n.pend, total: Math.max(0, (n.pend.total||0) - v)};
          n = L(n, `Incoming shaved by ${v} → ${n.pend.total}.`);
        }
        else if((n.incoming||0) > 0){ n.incoming = Math.max(0, n.incoming - v); n = L(n, `Incoming shaved by ${v} → ${n.incoming}.`); }
        else n = L(n, `-${v} power — nothing hostile to shave.`);
      }
      /* ---- A PUMP THAT ARRIVES THROUGH `runOps` (v3.99) --------------
         `self` is normally read at DECLARATION — `execute` folds `fx.self`
         into the total before `pend` exists, and the condition loop has
         its own `_condSelf` case one layer up. Neither of those is
         `runOps`, so a `self` op that reaches HERE was dropped on the
         floor: silently, with the cost already paid.

         JACK BE QUICK is the pool's only record of the shape. Its
         optional cost banishes a Nimblism from the graveyard and the
         rider reads "this gets +1{p} and go again" — and the rider's ops
         come back from `applyPrompt` and go straight to `runOps`. So the
         card charged its cost and granted NOTHING, which is v2.04's
         free-ability bug read from the other end: pay, receive nothing.

         IT LANDS ON THE OPEN LINK, and `linkPumps` reads `pend.total`
         after the wall is declared, so the bonus is on the swing rather
         than on a number nobody spends (v3.71 — the late conditions added
         to the DEALT damage and never touched a hero).

         IT MUST BE MY OWN ATTACK. `atkMinus` is the hostile twin one
         field over and tests the same thing with the opposite sign; a
         pump landing on the opponent's swing would help them. A caller
         with no attack in flight gets a feed line and no bonus — weaker
         than printed and visible (v3.24). */
      else if(k==="self"){
        if(n.pend && n.pend.by != null && n.pend.by === actorOf(n)){
          n.pend = {...n.pend, total: (n.pend.total||0) + v};
          n = L(n, `${srcName}: +${v} power to the attack → ${n.pend.total}.`);
        }
        else n = L(n, `${srcName}: +${v} power, but no attack of yours is in flight.`);
      }
      else if(k==="soulSpend"){
        if((act(n).soul||[]).length >= v){ actMut(n).soul = act(n).soul.slice(v); n = L(n,`${v} soul spent.`); n = runOps(n, op[2]||[], srcName); }
        else n = L(n,`Needs ${v} soul — you have ${(act(n).soul||[]).length}.`);
      }
      else if(k==="rune"){ n = mkRune(n, v); n=L(n,`+${v} Runechant${v>1?"s":""} — ${runeCount(act(n))} on the board.`); }
      /* RULING: a token is a card. Resolve it through the same reader as
         everything else and stand it up on the correct player's board —
         never describe it, never hardcode what it does. */
      else if(k==="token"){
        let rec = resolveEntry(db, {name:v, p:0, code:null, q:1});
        if(!rec.resolved){ n = L(n, `${srcName}: no card named "${v}" in the database — token not created.`); return; }
        const side = op[3]==="foe" ? "foe" : "self";
        /* A PLACEMENT INTO AN EXPOSED ARMOUR ZONE CAN FIZZLE, and that is
           the point of it — Frost Spike is WEAKER than a plain create, not
           stronger, because a fully-armoured hero offers it nowhere to
           land. The gate rides in the op as data (`{zone:"exposed"}`) so
           no card is named here. */
        const where = op[4] || null;
        const recip = side==="foe" ? foe(n) : act(n);
        if(where && where.zone==="exposed" && !hasExposedZone(recip)){
          n = L(n, `${srcName}: ${recip.name} has no exposed armour zone — the ${rec.name} has nowhere to land, and fizzles.`);
          return;
        }
        /* A TOKEN CARRIES ITS OWN CLOCK (v3.07). Every permanent played
           from hand gets its `sd` stamp from `execute`, off the same
           `selfDestruct` op; a token skips that path entirely, so 15 of
           the pool's tokens printed a destroy schedule and none of them
           carried it. `sweepArena` works off the stamp, so an unstamped
           token is a permanent that never leaves — which for a token
           typed `Aura` also inflates every "auras you control" count on
           the board. Read from the token's own printed text, so nothing
           here names a token. */
        const _tsd = ((P.fxParse(rec).ops || []).find(o => o[0] === "selfDestruct") || [])[1] || null;
        /* THE PRINTED NAME, NOT THE CAPTURE (v3.33). The op carries a name
           read out of a lowercased clause, and `resolveEntry` returns the
           ENTRY's name by design — so every token minted from card text
           reached the board as "seismic surge". The database is the
           authority for what a card is called, exactly as it is for
           everything else on it. */
        if(rec.dbName) rec = {...rec, name: rec.dbName};
        for(let i=0;i<(op[2]||1);i++){
          const tok = {...rec, uid:"tok"+tokSeq()};
          if(side==="foe") foeMut(n).board = [...(foe(n).board||[]), {card:tok, kind:"token", spent:false, uid:tok.uid, sd:_tsd}];
          else actMut(n).board = [...act(n).board, {card:tok, kind:"token", spent:false, uid:tok.uid, sd:_tsd}];
        }
        actMut(n).hist = {...act(n).hist, made:(act(n).hist.made||0)+1};
        if(/aura/i.test(rec.tt||"")) actMut(n).hist = {...act(n).hist, aura:(act(n).hist.aura||0)+1};
        /* NAME THE SEAT (v2.83's rule, v3.46's occasion). The feed is read
           by BOTH seats, and this line became actively misleading the
           moment a token could be minted under a borrowed actor: Oysten's
           death trigger creates a Gold for the player who LOST the ally,
           and "your board" read as the attacker's. The trainer names seat
           0 "You", so it still reads "your board" there. */
        const _self = act(n).name || "";
        const who = side==="foe" ? foe(n).name+"'s"
                  : (/^you$/i.test(_self) ? "your" : _self+"'s");
        n = L(n, `${rec.name}${(op[2]||1)>1?` ×${op[2]}`:""} created on ${who} board — ${clean(rec.tx||"no text").split(". ")[0]}.`);
        /* THE "SITS IDLE" NOTE IS GONE (v2.74) and it had to go. It read
           "pays no costs and takes no action phase, so anything that taxes
           those sits idle" — true of the training prop it was written for,
           and false since v2.71 gave seat 1 a real turn with a real action
           point. Left in place it would have told the player their
           Frostbite did nothing on the very version that made it bite. */
      }
      else if(k==="opt"){
        /* RULING: look at the top X, then put them back on top or bottom in
           any order — the player's call, so it queues a prompt. Queued rather
           than opened inline: opt only touches the deck, so it is safe to ask
           after the action finishes resolving. */
        if(!act(n).deck.length){ n = L(n, `${srcName}: deck is empty — nothing to opt.`); return; }
        const looked = Math.min(v, act(n).deck.length);
        n.promptQ = [...(n.promptQ||[]), {tag:"opt", n:looked, src:srcName}];
        /* BLAZE, CLAUSE 1 (v3.39) — "Whenever you opt, put energy
           counters on Blaze equal to the number of cards LOOKED AT this
           way."

           THE COUNT IS `looked`, NOT THE PRINTED NUMBER. Opt 3 into a
           two-card deck looks at two and pays two. The `Math.min` was
           already here for the prompt; reading the printed `v` would pay
           above rate on exactly the turns a deck is running out, which is
           when the ability matters most.

           ONE SITE, BOTH BOARDS — this is the only place an opt is
           issued, so the trigger cannot exist on one board only (v3.01).
           It fires at the QUEUE rather than at the answer, a stated
           approximation: the sheet is guaranteed to show, because the
           empty-deck case returned above. */
        if(bAct(n).energyOnOpt){
          const cur = act(n).counters.hero || {};
          actMut(n).counters = {...act(n).counters,
            hero: {...cur, energy: (cur.energy || 0) + looked}};
          n = L(n, `${act(n).name} burns bright — ${looked} energy counter${looked>1?"s":""} (now ${(cur.energy||0)+looked}).`);
        }
      }
      /* LOOK AND REORDER — Spire Sniping (v3.71). The same sheet, and
         deliberately NOT the same op: nothing may be sent to the bottom,
         and Blaze's "whenever you OPT" trigger must not fire off a card
         that does not opt. `keepTop` is the one difference, and it is
         opt-in (v3.58) so an ordinary opt is untouched.

         WITH ONE CARD THERE IS NO ORDER TO CHOOSE, so `buildPrompt`
         returns null and the sheet skips itself rather than showing a
         forced tap that teaches nothing (v3.55). */
      else if(k==="lookOrder"){
        if(!act(n).deck.length){ n = L(n, `${srcName}: deck is empty — nothing to look at.`); return; }
        const looked = Math.min(v, act(n).deck.length);
        n.promptQ = [...(n.promptQ||[]), {tag:"opt", n:looked, keepTop:true, src:srcName}];
      }
      /* pickPrompt — a GENERIC mandatory-or-optional targeted pick, carrying
         its own zone/to/filter/min/max as data rather than a bespoke op per
         card (see optFilter/pickPrompt in parser.js). Queued, not opened
         inline, same rule as every other prompt: the action finishes
         resolving first. */
      /* ---- REACHING INTO THE OTHER SEAT'S HAND (Brain Freeze) --------
         "put an action card with cost 0 from their hand on top of their
         deck". The CHOICE is the caster's — the card says "put", not
         "they put" — but the cards are in the opponent's hand, and
         `prompts.js` reads ONE side. So the candidates are supplied and
         the move is done here, the pattern v3.03's freeze established.

         `buildPrompt` returns null with fewer than two candidates, so a
         single legal card is taken without a sheet and an empty hand
         asks nothing. */
      /* ONE BODY FOR EVERY CROSS-SEAT PICK. Brain Freeze reaches into their
         HAND and puts a card on their deck; Pass Over reaches into their
         GRAVEYARD and banishes. Same shape — candidates from over there,
         the choice made here, the move performed there — so the zone and
         the destination are DATA on the op rather than two near-identical
         bodies. A sibling written separately is the drift this engine has
         paid for repeatedly (v3.41, v3.50).

         THE ZONE IS READ OFF THE SIDE BY NAME, so a spec naming a zone
         that seat does not have finds nothing and says so, rather than
         throwing inside a reducer whose contract is that it never does. */
      else if(k==="foePick"){
        const spec = v || {};
        const zone = spec.zone || "hand";
        const filt = promptFilter(spec.filter);
        const cands = ((foe(n)[zone]) || []).filter(filt);
        if(!cands.length){ n = L(n, `${srcName}: nothing in ${foe(n).name}'s ${zone === "grave" ? "graveyard" : zone} matches.`); return; }
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:actorOf(n), src:srcName, cards:cands, min:1, max:1,
          moveFoe:{from:zone, to:spec.to || "deckTop"},
          title: spec.title || `Choose one of ${foe(n).name}'s cards`,
          hint: spec.hint || ""}];
      }
      else if(k==="pickPrompt"){
        const spec = {tag:"pick", side:actorOf(n), src:srcName, ...v};
        /* A BOUND THAT DEPENDS ON THE GAME IS SUPPLIED AT THE QUEUE SITE
           (v3.39), never baked into the parse — `fxParse` memoizes on
           `name|pitch`, so one parse serves every copy in the match and a
           number stored there would freeze at whatever the counters were
           the first time. Same rule `notUid` follows for `notSelf`.

           Blaze's ability spends the CHOSEN card's arcane in counters, so
           a card he cannot pay for is not a legal choice at all. With no
           counters the filter admits nothing and `buildPrompt` returns
           null, so the sheet politely skips itself. */
        if(v && v.ctrSpend){
          const held = ((act(n).counters.hero||{})[v.ctrSpend]) || 0;
          spec.filter = Object.assign({}, spec.filter, {arcLe: held});
          spec.ctrHeld = held;
        }
        n.promptQ = [...(n.promptQ||[]), spec];
      }
      /* RELOAD — CR: only legal while the arsenal is EMPTY, and no type
         filter (any card in hand). A real choice, so it queues a `pick`
         prompt like the other optional zone-moves rather than auto-picking
         — nothing about which card to reload is implied by the rest of the
         card's text the way Charge's colour preference was. */
      else if(k==="reload"){
        if(!arsEmpty(act(n))){ n = L(n, `${srcName}: your arsenal isn't empty — Reload needs it clear.`); return; }
        if(!act(n).hand.length){ n = L(n, `${srcName}: your hand is empty — nothing to reload.`); return; }
        n.promptQ = [...(n.promptQ||[]), {tag:"pick", side:actorOf(n), src:srcName,
          zone:"hand", to:"arsenal", min:0, max:1,
          title:"Reload — put a card face-down into your arsenal?",
          hint:"Optional — choose none to decline."}];
      }
      /* RULING: the card flips and BECOMES Inner Chi, returning to hand
         instead of the graveyard. Inner Chi is a real database card. */
      else if(k==="transcend"){
        const chi = resolveEntry(db, {name:"Inner Chi", p:0, code:null, q:1});
        if(!chi.resolved){ n = L(n, `${srcName}: Inner Chi not found in the database.`); return; }
        actMut(n).hand = [...act(n).hand, {...chi, uid:"chi"+tokSeq()}];
        n._transcended = true;
        actMut(n).hist = {...act(n).hist, trans:(act(n).hist.trans||0)+1};
        n = L(n, `${srcName} transcends — it flips to Inner Chi and returns to your hand.`);
      }
      /* RULING (Reaping Blade): the hero ahead on life can't gain any */
      else if(k==="lifeLock"){ actMut(n).lifeLock = true; n = L(n, "Life-gain locked while a hero is ahead on life."); }
      /* RULING (Pyroglyphic Protection): prevents arcane PER SOURCE, unlike
         ward/awd which is one draining pool. Runechants are separate sources. */
      else if(k==="arcShield"){ actMut(n).arcShield = (act(n).arcShield||0)+v; n = L(n, `Arcane shield ${act(n).arcShield} — that much off EVERY arcane source, not a pool.`); }
      else if(k==="selfDestruct"){ n._selfDestruct = v; }
      /* "…ENTERS THE ARENA WITH A +1{p} COUNTER" (v3.57). STASHED, NOT
         APPLIED: the card is not on the board yet when this runs, so the
         board-placement site stamps it — the same shape `_selfDestruct`
         has used since v3.07. Applying it here would key the counters map
         by a uid whose permanent never arrives if the play is refused
         further down. */
      else if(k==="ctrSelf"){ n._ctrSelf = v; }
      /* RULING (Under Loop): recycles on hit instead of hitting the graveyard;
         the combat chain stays open either way. */
      else if(k==="bottomSelf"){
        const pc = n.pend && n.pend.card;
        if(!pc){ n = L(n, `${srcName}: nothing on the chain to recycle.`); return; }
        n = liftSelf(n, pc);
        actMut(n).deck = [...act(n).deck, pc];
        n = L(n, `${pc.name} loops under — bottom of your deck instead of the graveyard.`);
      }
      /* ---- FREEZE (Cold Snap) --------------------------------------
         RULING 2026-07-25: "if they don't pay the player gets a pop up and
         they can choose the arsenal or an ally - whatever they choose
         cannot be played or activated until the start of your next turn."

         The candidates span TWO zones — the opponent's arsenal and their
         allies — so they are supplied to `prompts.js` rather than read
         from one, the way an attack-target's already are. The choice is
         the FREEZING player's, so the sheet is addressed to the actor,
         and `buildPrompt` returns null with fewer than two candidates, so
         a single legal choice skips the sheet instead of asking a
         question with one answer.

         WHAT FREEZE STOPS, honestly: a frozen arsenal card cannot be
         played — `parser.playableFromZone` refuses it on both boards. The
         "or activated" half has nothing to bite on yet, because allies do
         not attack (see judge.js's module header); the stamp is on the
         entry and will be read the moment they do. */
      else if(k==="freeze"){
        /* THE ACTOR HERE IS THE DECLINING HERO, not the caster. `payOr`'s
           `elseOps` are actor-relative to the side that was ASKED — that
           is the actor a prompt resolves at, and it is the whole reason
           the else-branch can say "they discard a card" without naming a
           seat. So the objects to freeze are `act`'s ("freeze a card in
           THEIR arsenal", where "their" is the target hero), and the
           CHOICE belongs to the other seat, who played Cold Snap.

           Written the other way round first, it read the caster's own
           board and reported "Iyslander has nothing to freeze". */
        const fs = actorOf(n);                   /* the target hero — theirs is frozen */
        const chooser = 1-fs;                    /* the Cold Snap player chooses */
        const sd = act(n);
        const cands = [];
        if(sd.arsenal) cands.push({...sd.arsenal, _frz:{kind:"arsenal", uid:sd.arsenal.uid}});
        (sd.board||[]).filter(b => b && b.kind==="ally" && b.card)
          .forEach(b => cands.push({...b.card, _frz:{kind:"ally", uid:b.uid}}));
        if(!cands.length){ n = L(n, `${srcName}: ${sd.name} has nothing to freeze — no arsenal, no allies.`); return; }
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:chooser, src:srcName, cards:cands, min:1, max:1,
          freezeSide: fs,
          title:`Freeze one of ${sd.name}'s objects`,
          hint:`It cannot be played or activated until the start of your next turn.`}];
      }
      /* the dummy has a real deck, so banishing off its top is a real cost */
      else if(k==="foeBanishTop"){
        const take = foe(n).deck.slice(0,v);
        if(!take.length){ n = L(n, `${srcName}: ${foe(n).name}'s deck is empty.`); return; }
        foeMut(n).deck = foe(n).deck.slice(take.length);
        n = L(n, `${srcName}: ${take.map(c=>c.name).join(", ")} banished off the top of ${foe(n).name}'s deck (${foe(n).deck.length} left).`);
      }
      else if(k==="firstAtkBuff"){
        /* a standing buff on the turn's FIRST attack only */
        if((act(n).hist.atk||0)===0){ actMut(n).buffNext += v; n = L(n, `First attack this turn will carry +${v}.`); }
        else n = L(n, `${srcName}: you've already attacked this turn — no first-attack bonus.`);
      }
      else if(k==="dmg"){ foeMut(n).hp -= v; n = L(n, `${srcName}: ${v} damage.`); }
      /* RULING (Pouncing Paws): mint a real card into the banished zone,
         playable this turn only. Resolved from the database like any card. */
      else if(k==="mkBanish"){
        const rec = resolveEntry(db, {name:v, p:0, code:null, q:1});
        if(!rec.resolved){ n = L(n, `${srcName}: no card named "${v}" in the database.`); return; }
        const made = {...rec, uid:"mk"+tokSeq(), _playTurn:n.turn};
        actMut(n).banish = [made, ...act(n).banish];
        actMut(n).hist = {...act(n).hist, made:(act(n).hist.made||0)+1};
        n = L(n, `${rec.name} springs into your banished zone — playable this turn (${clean(rec.tx||"").split("\n")[0]}).`);
      }
      else if(k==="namedBuff"){
        actMut(n).namedBuff = {name:norm(v), amount:op[2]||0};
        n = L(n, `Your next ${v} this turn gets +${op[2]||0} power.`);
      }
      /* "EACH OPPONENT DESTROYS AN AURA PERMANENT THEY CONTROL" (v3.18).
         Condemn to Slaughter's rider, and it is THEIR choice which aura
         goes — so this opens a prompt addressed to the other seat rather
         than picking for them. `applyAnswer` ends in `openPrompt`, so a
         prompt queued from inside a rider's ops opens the way any other
         does; without that this would need the caller's help.

         `min:1` because the destruction is MANDATORY once the cost is
         paid — there is no "you may" in the rider. `buildPrompt` returns
         null on an empty zone, so an opponent controlling no aura simply
         skips it, which is the card doing nothing rather than the seat
         declining. The feed says which, because "nothing happened" and
         "they chose not to" are different lessons. */
      /* ---- TAP A HERO (v3.48) ----------------------------------------
         RULING (user, 2026-08-25): a tapped hero "cannot be tapped again
         to pay a cost", and that is the WHOLE consequence — the ruling
         adds that most heroes are otherwise unaffected, so anything more
         would be inventing a rule the card does not print.

         Of the pool's fifteen heroes only three print a `{t}` cost on
         themselves — Bravo, Gravy Bones and Lyath — so for the other
         twelve this is deliberately a no-op that still reads correctly.
         The feed says so, because "nothing happened" and "nothing was
         supposed to happen" are different lessons. */
      else if(k==="tapFoeHero" || k==="tapSelfHero"){
        const side = k==="tapSelfHero" ? actorOf(n) : 1-actorOf(n);
        const mut = side===actorOf(n) ? actMut : foeMut;
        const who = n.sides[side];
        /* THE BUILD OF THE TAPPED SIDE, not the actor's. `tapFoeHero`
           taps the OTHER seat, so `bAct` here would ask whether the
           tapper's hero has a {t} ability — the wrong hero, and right by
           accident only in the `tapSelfHero` branch. */
        const wb = side===actorOf(n) ? bAct(n) : bFoe(n);
        if(who.heroTapped) n = L(n, `${srcName}: ${who.name} is already tapped.`);
        else {
          mut(n).heroTapped = true;
          n = L(n, `${srcName}: ${who.name} taps`
                 + (P.tapsToActivate((wb.heroRec||{}).tx || "")
                    ? ` — their {t} ability is locked until they untap.`
                    : ` — which for ${who.name} costs them nothing they were using.`));
        }
        /* THE ALLY HALF IS WHY THE CARD IS PLAYED. Allies tap to attack
           (v3.44), so tapping theirs stops a swing — where tapping the
           hero mostly does not. One printed sentence, one op. */
        if(op[2] && op[2].allies){
          const board = (n.sides[side].board||[]);
          const live = board.filter(b => b && G.isAlly(b) && !b.spent);
          if(live.length){
            mut(n).board = board.map(b => (b && G.isAlly(b)) ? {...b, spent:true} : b);
            n = L(n, `${srcName}: ${live.length} all${live.length===1?"y is":"ies are"} tapped — they cannot attack this turn.`);
          } else n = L(n, `${srcName}: ${who.name} controls no untapped ally.`);
        }
      }
      /* ---- UNTAP AN ALLY YOU CONTROL (v3.47) ------------------------
         `{t}` is what an ally spends to attack (v3.44), so an untap buys
         a SECOND attack and is the only way an ally swings twice.

         "IT" IS THE ALLY. op[2] carries the schedule the card's second
         sentence prints — "destroy IT at the beginning of the end phase"
         — because the source (Scuttle Toes) was already destroyed to pay
         the cost, so a `selfDestruct` there would land on nothing and the
         drawback would be free. The parser holds it back for exactly
         this, the same way `arsenalPut.stamp` does (v2.33).

         A DEAD TAP IS REFUSED BY NAME (v3.39). With no ally to untap the
         ability does nothing and says so, rather than opening an empty
         sheet after spending the cost. */
      else if(k==="untapAlly"){
        const mine = (act(n).board||[]).filter(b => b && b.card && G.isAlly(b));
        if(!mine.length){ n = L(n, `${act(n).name} controls no ally — nothing to untap.`); }
        else {
          /* CALLER-SUPPLIED CANDIDATES, NOT A ZONE + FILTER. `prompts.js`
             says a zone it was not really read from "is a feed line that
             lies" — with `zone:"board"` and no `to` the sheet reported
             "Swabbie revealed from board", and this is a TARGET choice,
             not a reveal. Cold Snap's freeze supplies candidates for the
             same reason.

             It is also more precise: `G.isAlly` reads the board ENTRY's
             kind, which is the authority, where a `{tt:"ally"}` filter
             re-asks the question of the printed type line. */
          n.promptQ = [...(n.promptQ||[]), {
            tag:"pick", side:actorOf(n), src:srcName,
            cards: mine.map(b => b.card), min:1, max:v||1,
            /* NO `to` — the ally stays in the arena. `untapStamp` is DATA
               the answer applies, the `arsStamp` lesson: a spec only
               carries fields `buildPrompt` knows about. */
            untapStamp: op[2] || {},
            title:`Choose an ally to untap`,
            hint:(op[2]||{}).sd === "end"
              ? `It can attack again, and is destroyed at the beginning of the end phase.`
              : `It can attack again this turn.`}];
        }
      }
      else if(k==="foeDestroyAura"){
        const fs = 1 - actorOf(n);
        const auras = (n.sides[fs].board||[]).filter(b => b && b.card && /aura/i.test(b.card.tt||""));
        if(!auras.length){
          n = L(n, `${foe(n).name} controls no aura — nothing to destroy.`);
        } else {
          n.promptQ = [...(n.promptQ||[]), {
            tag:"pick", side:fs, src:srcName,
            zone:"board", to:"grave", filter:{tt:"aura"}, min:1, max:v||1,
            title:"Destroy an aura you control",
            hint:"Not optional — " + act(n).name + " condemned it."
          }];
        }
      }
      /* the dummy holds a hand now, so showing it is real information */
      else if(k==="foeReveal"){
        n = L(n, foe(n).hand.length
          ? `${foe(n).name} shows a hand: ${foe(n).hand.map(c=>c.name).join(", ")}.`
          : `${foe(n).name}'s hand is empty — nothing to show.`);
      }
      /* LYATH'S CLAUSE 2 RIDER (v3.78). A TURN WINDOW, not a charge — it
         is not spent by the first defender, because "this turn" says
         every action card he declares gets it. It ACCUMULATES rather
         than being assigned: two sources in one turn stack, and an
         assignment would silently drop the second. */
      else if(k==="defActBuff"){
        actMut(n).defActionBuff = (act(n).defActionBuff||0) + v;
        n = L(n, `${act(n).name}: defending action cards get +${v}{d} for the rest of this turn.`);
      }
      /* A STANDING ATTACK GRANT, WITH A WINDOW (v3.87) — Night's Embrace.
         "Your attacks with stealth get +1{p} this turn."

         IT IS NOT `buffQ`. That grants "your NEXT attack" and is SPENT by
         the card it lands on; this applies to EVERY matching attack until
         its window closes and is never spent. A standing grant consumed
         by the first swing is weaker than printed; a single-shot grant
         left standing is stronger — v3.30's debuff/restriction split, one
         grant over.

         IT ACCUMULATES rather than being assigned, or a second source is
         silently dropped (v3.78's rule for the defensive twin).

         `until` IS THE PRINTED WINDOW, read off the card and carried, so
         `beginEndPhase` and the close step each drop only their own. */
      /* EACH HERO PUTS THEIR TOP CARD IN THEIR ARSENAL (v3.88) — Concoct
         Disorder, the pool's only cross-seat zone move.

         IT IS ONE OP FOR BOTH SEATS, not two. "2 or more cards are put
         into arsenals THIS WAY" counts across them, and two ops could not
         answer that without threading a total between them — state no op
         carries. `_arsWay` is the trace, beside `_discWay` and `_dmgWay`
         and cleared with them (v3.61: check for the trace before you
         build one; here there was none).

         IT IS SEAT-ABSOLUTE, NOT ACTOR-RELATIVE. "Each hero" names both
         players, so the loop runs over `sides` rather than through
         `act`/`foe` — the one op in this file that is deliberately not
         written from the actor's point of view, because the card is not.

         AN ARSENAL WITH NO ROOM PUTS NOTHING, and so does an empty deck.
         Both are the reason the count can be 0 or 1 rather than always 2,
         which is the whole of what the condition asks.

         FACE-DOWN, and read rather than defaulted (v3.69): reading this
         as face UP fires every arrow's put-face-up trigger for both
         seats, off an attack that never says so. */
      else if(k==="eachArsPut"){
        let put = 0;
        const sides = n.sides.slice();
        /* A LOG LINE IS READ BY BOTH SEATS, SO IT NAMES THE SEAT (v2.83)
           — and seat 0's name is literally "You", so the verb agrees with
           it the way every other second-person line in this file does. */
        const who = i => ((n.sides||[])[i]||{}).name || "seat " + i;
        const verb = (i, s2, p2) => /^you$/i.test(who(i)) ? s2 : p2;
        const poss = i => /^you$/i.test(who(i)) ? "your" : "their";
        for(let i = 0; i < 2; i++){
          const sd = sides[i] || {};
          if(P.arsFree(sd) <= 0){ n = L(n, `${who(i)}: the arsenal is full — nothing is put.`); continue; }
          if(!(sd.deck || []).length){ n = L(n, `${who(i)}: no deck left to put from.`); continue; }
          const top = sd.deck[0];
          sides[i] = Object.assign({}, sd, {deck: sd.deck.slice(1), arsenal: top});
          put++;
          n = L(n, `${who(i)} ${verb(i, "put", "puts")} the top card of ${poss(i)} deck face-down into ${poss(i)} arsenal.`);
        }
        n = Object.assign({}, n, {sides});
        n._arsWay = (n._arsWay || 0) + put;
      }
      /* DESTROY THE TOP CARD OF YOUR OWN DECK (v3.90) — the mill half of
         the two watery-grave cards' modal cost.

         IT REACHES THE GRAVEYARD, turn-stamped like every other path in
         (v3.54) — a destroyed card is not banished, and `_gy` answers the
         whole "…this turn" family, which for these two heroes is the
         point: Gravy Bones plays watery-grave cards OUT of the graveyard.

         `_costWay` RECORDS WHAT THE COST CONSUMED, which is what "if THAT
         CARD has watery grave" asks. It is a different fact from
         `_discWay` ("what this resolution discarded") — a milled card was
         never discarded — so it is a second record of a second thing
         rather than the duplication v3.61 warns about, and the discard
         branch feeds BOTH. */
      else if(k==="deckDestroy"){
        const take = act(n).deck.slice(0, v);
        if(!take.length){ n = L(n, `${act(n).name}: no deck left to destroy from.`); }
        else {
          actMut(n).deck = act(n).deck.slice(v);
          actMut(n).grave = [...gy(n.turn, ...take), ...act(n).grave];
          n._costWay = [...(n._costWay||[]), ...take];
          n = L(n, `${srcName}: ${take.map(c=>c.name).join(", ")} destroyed off the top of the deck.`);
        }
      }
      else if(k==="atkBuff"){
        actMut(n).atkBuff = [...(act(n).atkBuff||[]),
                             {amt: v, q: op[2] || null, until: op[3] || "turn"}];
        const who = op[2] ? P.qualLabel(op[2]).replace(/^an? /, "") : "attack";
        n = L(n, `${act(n).name}: every ${who} gets +${v}{p} `
               + (op[3] === "chain" ? "for the rest of this combat chain." : "this turn."));
      }
      else if(k==="costTax"){ n.costTax = (n.costTax||0)+v; n = L(n, `Cards cost ${n.costTax} more for the rest of this turn.`); }
      else if(k==="dracNext"){ actMut(n).dracNext = true; n = L(n, "Your next attack this chain counts as Draconic."); }
      else if(k==="unpreventable"){ n._unpreventable = true; n = L(n, `${srcName}: this damage can't be prevented.`); }
      else if(k==="enterCounters"){ n._enterCounters = v; }
      else if(k==="boo"){
        actMut(n).hist = {...act(n).hist, booed:(act(n).hist.booed||0)+1};
        n = L(n, "The crowd boos you — Reviled, and your Bravo cards know it.");
        /* LYATH: "Whenever the crowd boos you, create a Might token." Reuses
           the generic "token" op rather than duplicating the board-mint
           logic — a token is a card, resolved once, in one place. */
        if(bAct(n).lyathBoo) n = runOps(n, [["token","Might",1,"self"]], "Lyath");
      }
      else if(k==="mark"){
        foeMut(n).marked = true;
        n = L(n, `${foe(n).name} is marked — a qualifier your Assassin cards can read.`);
      }
      /* RULING (Ravenous Rabble): both players see the reveal, and the attack
         shifts by the revealed card's PITCH. The card stays on top. */
      else if(k==="reveal"){
        const top = act(n).deck[0];
        if(!top){ n = L(n, `${srcName}: deck is empty — nothing to reveal.`); return; }
        n.revealed = top;
        n = L(n, `${srcName} reveals ${top.name} (pitch ${top.pitch}) off the top — it stays there.`);
      }
      else if(k==="revPitch"){
        const p = n.revealed ? (n.revealed.pitch||0) : 0;
        if(!n.revealed){ n = L(n, `${srcName}: nothing was revealed, so there is no pitch to read.`); return; }
        n._condSelf = (n._condSelf||0) + v*p;
        n = L(n, `${n.revealed.name} is pitch ${p} — this attack ${v<0?"drops":"gains"} ${Math.abs(v*p)}.`);
      }
      /* THE REVEALED PITCH, SPENT ON A PREVENTION (v3.68). Throw Caution
         to the Wind prints the same "X is the pitch value of the card
         revealed this way" the two Rabbles do, and spends it on ward
         rather than on the attack's power. Same reader, different pool —
         and the reveal is what settles X, so nothing is asked for.

         A REVEAL THAT TURNED UP NOTHING GRANTS NOTHING: an empty deck
         leaves `n.revealed` unset, and a ward of 0 is the honest answer
         rather than a default. Same guard `revPitch` keeps one branch up. */
      else if(k==="revWard"){
        if(!n.revealed){ n = L(n, `${srcName}: nothing was revealed, so there is no pitch to prevent with.`); return; }
        const p = n.revealed.pitch || 0;
        if(p <= 0){ n = L(n, `${n.revealed.name} prints no pitch — nothing is prevented.`); return; }
        actMut(n).ward = act(n).ward + p;
        n = L(n, `${n.revealed.name} is pitch ${p} — the next ${p} damage this turn is prevented.`);
      }
      /* RULING (Saltwater Swell): reads the SAME n.revealed the reveal op
         just set (both ops run together in declOps), and if it matches,
         moves the actual top-of-deck card into the pitch zone — the reveal
         op itself only looks, it never moves the card. */
      else if(k==="revColorPitch"){
        if(!n.revealed){ n = L(n, `${srcName}: nothing was revealed, so there is nothing to pitch.`); return; }
        if(n.revealed.pitch !== v){
          n = L(n, `${n.revealed.name} isn't ${["","red","yellow","blue"][v]} — stays on top of the deck.`);
          return;
        }
        const top = act(n).deck[0];
        if(!top || top.uid !== n.revealed.uid){ n = L(n, `${srcName}: the deck has moved since the reveal — nothing to pitch.`); return; }
        actMut(n).deck = act(n).deck.slice(1);
        actMut(n).pitch = [...act(n).pitch, top];
        actMut(n).res = act(n).res + (top.pitch||0);
        n = L(n, `${top.name} was ${["","red","yellow","blue"][v]} — pitched (+${top.pitch||0} resource).`);
      }
      /* RULING (Knucklehead): a d6 both players see; base intellect becomes
         the roll, and intellect is the end-of-turn draw. */
      else if(k==="roll"){
        /* SEEDED: a die both players see must be the SAME die on both
           clients, and a replay must roll it again identically. */
        const _r = rngRoll(n.rng, v); n.rng = _r.rng; n.lastRoll = _r.v;
        n = L(n, `${srcName}: d${v} comes up ${n.lastRoll}.`);
      }
      else if(k==="intRoll"){
        if(!n.lastRoll){ n = L(n, `${srcName}: no die has been rolled — nothing to set.`); return; }
        actMut(n).intWas = act(n).intWas==null ? act(n).int : act(n).intWas;
        actMut(n).int = n.lastRoll;
        n = L(n, `Base intellect is ${act(n).int} until end of turn — that many cards at the draw step.`);
      }
      else if(k==="aim"){
        /* WHERE THE COUNTER GOES IS READ OFF THE OP (v3.72). "Put an aim
           counter on IT" names a different object depending on the card
           that printed it, and only a reader that can see the whole card
           knows which — so `fxParse` decides and this op obeys. Crow's Nest
           means the arrow it just watched go into the ARSENAL; absent a
           destination the counter goes on the attack on the chain, which
           is where the op has always put it. */
        const where = op[2] || "chain";
        const tgtCard = where === "arsenal" ? act(n).arsenal
                      : (n.pend && n.pend.card) || null;
        const tgt = tgtCard ? tgtCard.uid : null;
        if(tgt){ const cur=(act(n).counters[tgt]||{}); actMut(n).counters={...act(n).counters,[tgt]:{...cur,aim:(cur.aim||0)+v}}; }
        n = L(n, tgt ? `${tgtCard.name} takes an aim counter.`
                     : `Aim counter fizzles — nothing ${where === "arsenal" ? "in the arsenal" : "on the chain"} to hold it.`);
      }
      /* A TARGETED COUNTER PUT (v3.53) — the general form of `aim`.

         THE CANDIDATES ARE THE ACTOR'S PERMANENTS: board entries and
         equipped gear, which are the two places a counter can sit. Gear
         is where a steam counter goes (a Hyper Driver is equipment) and
         the board is where an aura is, so a scan of either alone finds
         nothing for half the family — the same lesson v3.33 records for
         Magmatic Carapace, where a board-only scan missed a Chest piece.

         A DESTROYED PIECE IS NOT THERE, so it is not a legal target.

         WITH ONE CANDIDATE IT JUST HAPPENS. A sheet offering a single
         forced choice is a tap that teaches nothing; with two or more the
         choice is real and is put to the player. Addressed to the ACTOR,
         because the permanents are theirs. */
      else if(k==="ctrPut"){
        const spec = v || {};

        const kind = spec.kind, amt = spec.n || 1;
        const label = spec.label || kind;
        const filt = promptFilter(spec.filter);
        const cands = [
          ...((act(n).board||[]).map(b => b && b.card).filter(Boolean)),
          ...((act(n).gear||[]).filter(g => g && !g.destroyed))
        ].filter(Boolean).filter(filt);
        const many = amt > 1;
        if(!cands.length){
          n = L(n, `${srcName}: ${act(n).name} controls nothing that can take ${many ? amt + " " + label + " counters" : "a " + label + " counter"}.`);
          return;
        }
        if(cands.length === 1){
          const t = cands[0], cur = act(n).counters[t.uid] || {};
          actMut(n).counters = Object.assign({}, act(n).counters,
            {[t.uid]: Object.assign({}, cur, {[kind]: (cur[kind] || 0) + amt})});
          n = L(n, `${t.name} takes ${many ? amt + " " + label + " counters" : "a " + label + " counter"} — now ${(cur[kind]||0) + amt}.`);
          n = ctrLanded(n, t, spec, srcName);
          return;
        }
        /* CALLER-SUPPLIED CANDIDATES AND NO `to` — nothing moves, the
           counters land where the permanent already stands. `ctrStamp` is
           DATA the answer applies, which is `untapStamp`'s shape (v3.47)
           and `arsStamp`'s rule (v2.34): a spec only carries fields
           `buildPrompt` knows about. */
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:actorOf(n), src:srcName,
          cards:cands, min:1, max:1,
          /* A SPEC ONLY CARRIES FIELDS ITS CONSUMER READS (v2.34's
             `arsStamp` rule). Left off here, Sharpen's wipe and its
             Flurry rider would fire on the single-candidate path and
             silently vanish the moment a second sword was equipped.

             AND THE TWO NEW FIELDS ARE OPT-IN (v3.58's rule). Always
             present, they change the SHAPE of every `ctrStamp` in the
             pool, and a drill that `deepEqual`s the whole stamp — which
             it is right to do — goes red on a card printing no sharpen at
             all. */
          ctrStamp:Object.assign({kind, n:amt, label},
                                 spec.wipeEnd ? {wipeEnd:true} : {},
                                 spec.then    ? {then:spec.then} : {}),
          title:`Where do the ${label} counters go?`,
          hint:`${many ? amt + " counters" : "One counter"} — choose which permanent takes ${many ? "them" : "it"}.`}];
      }
      /* `rot` AND `fra` ARE GONE (v3.09). Both were side counters standing
         in for a printed `Generic Token - Aura`, and each was read in
         exactly one place inside the trainer — so at the table neither did
         anything. They are real board tokens now, minted by the generic
         `token` op like Runechant and Frostbite before them, and the two
         parser lines that intercepted them were deleted rather than
         rewritten. See parser.js for the full note. */
      else if(k==="dmgSelf"){
        if(v>0){ actMut(n).hp -= v; n = L(n, `${srcName}: ${v} damage — ${act(n).name} to ${act(n).hp}{h}.`); n = winCheck(n); }
      }
      /* THE ACTING SEAT IS THE ONE BILLED, which is why this is not
         `payOr`. Bloodrot Pox prints "it deals 2 damage to YOU unless YOU
         pay" and fires in its controller's end phase, where `sweepArena`
         hands the payload back with that seat as the actor. `payOr` is
         Cold Snap's shape — "target hero may pay" — and asks
         `1-actorOf(n)`; mixing them up bills the wrong player behind a
         perfectly plausible-looking prompt.

         IT RESOLVES INLINE, AND IT PAYS ONLY FROM FLOATING RESOURCES.
         Two reasons, both already settled in this project rather than
         decided here:

         1. THERE IS NO WINDOW TO PAUSE IN. CR 4.4.1 gives nobody priority
            in the end phase. The trainer's auto-pitch carries the same
            ruling in as many words — "on your own turn `mode:"pay"` asks
            with a sheet; in an instant window there is no room to pause
            for one" — and a queued prompt here would simply never drain:
            `openPrompt` runs at the tail of `execute`, which the end phase
            does not call. That failure is SILENT, and it is what the first
            build of this did: the feed said "it pays out as it goes" and
            nothing happened.

         2. IT MUST NOT PITCH ON THE PLAYER'S BEHALF. Pitching three cards
            to avoid 2 damage is usually a losing trade, and a training sim
            that quietly makes it is teaching bad play. Floating resources
            are already spent-or-lost at CR 4.4.3e, so spending them here
            costs the player nothing they were keeping — which is the one
            payment that can be made without asking.

         So: float 3 and Bloodrot is shrugged off; float less and you take
         it. Declining is never silent — both branches say which happened. */
      else if(k==="selfPayOr"){
        if(act(n).res >= v){
          actMut(n).res = act(n).res - v;
          n = L(n, `${srcName}: ${v} paid — shrugged off by ${act(n).name}.`);
        } else {
          n = L(n, `${srcName}: only ${act(n).res} of ${v} floating — it lands on ${act(n).name}.`);
          n = runOps(n, op[2] || [], srcName);
        }
      }
      else if(k==="noop"){ n=L(n,`${srcName}: ${v}.`); }
    });
    return n;
  };
  /* `opts` IS THE CALLER'S HALF OF ONE QUESTION (v2.77): which WINDOW is
     this being played in. The trainer has no windows and passes nothing,
     so its answer is unchanged; judge.js decides the window at doPlay,
     carries it through the payment so it cannot move while the player
     pitches, and hands it here. It reaches exactly one line — the action
     point — and `costsAP` refuses to make anything more expensive with
     it. Nothing else in this body may read `opts`: the moment a card's
     EFFECT depends on the caller, there are two engines again. */
  const execute = (s,card,from,idx,opts) => {
    /* WAS THIS ATTACK AIMED AT A HERO? (CR 1.4.5, v3.46) — the caller's
       answer, like the wall and `heroHit`. It is a DIFFERENT question from
       `heroHit`: an attacks-trigger fires when the attack is DECLARED,
       whether or not it goes on to connect, so a swing blocked to nothing
       still attacked a hero. judge knows the target here; the trainer
       wires no ally targeting and can never field one against you, so
       absent means "the hero" — true for it, and the default keeps its
       behaviour identical. */
    const heroTarget = !(opts && opts.target && opts.target.kind === "ally");
    /* WHICH HALF OF A SPLIT CARD IS BEING PLAYED (v3.34). `_half` is the
       declared answer and rides on the state, the same seam `_doBoost`
       and `_addPaid` use — a declaration is settled BEFORE the card
       resolves, so it cannot be a queued prompt.

       DEFAULTING TO HALF 0 IS THE SAFE DIRECTION. A caller that declares
       nothing gets the left half alone, which is always a legal play;
       the alternative default, meld, would hand a player both textboxes
       they never asked for — which is exactly what this engine did until
       now, and it made Burn Up // Shock deal FIVE arcane on play. */
    const _half = P.isSplit(card) ? (s._half != null ? s._half : 0) : null;
    const fx = P.splitFx(card, _half);
    /* THE RUNECHANT TRIGGER FIRES ON *PLAY* (CR + the printed token):
       "When you play an attack action card or activate a weapon attack,
        destroy this and deal 1 arcane damage to target opposing hero."
       So the runechants that trigger are the ones in the arena at this
       instant — captured BEFORE anything this card does. A runechant the
       card itself conjures (Viserai's rite on a Runeblade attack, a verse
       counter unwinding, an on-hit forge) was not there when the attack
       was played and therefore survives to the next swing. Reading the
       board again at resolution is what made it pop on its own attack. */
    /* THE RUNECHANT COUNT USED TO BE CAPTURED HERE and v3.22 moved the
       pop to the general site below, leaving the capture behind — dead
       for seventy versions, with the two comments that explain the rule
       still naming it. DEAD RULES CODE IS WORSE THAN DEAD CODE ELSEWHERE
       (v3.67, v3.77): it reads as a rule somebody can reach, and this one
       was quoted in CLAUDE.md's own approximations section as the
       mechanism. Found at v4.02 by SABOTAGING it and watching nothing
       fail — the capture below is the live one. */
    /* THE SAME RULE, IN ITS GENERAL FORM (v3.22). Four pool tokens print
       "when you play an attack action card[ or activate a weapon attack],
       destroy this and X" and only Runechant was built — by NAME, through
       `isRunechantEntry`. Courage, Quicken and Briar's Embodiment of
       Lightning read `tier: none` and did nothing.

       THIS IS THE ONE CAPTURE (v4.02 — the runechant-specific one above
       it was dead). The auras that
       trigger are the ones in the arena at this instant, so one the card
       itself conjures was not there when the attack was played and
       survives to the next swing. Captured by ENTRY, and popped later by
       uid, because the board is about to change underneath this. */
    const atkTrigAt = (act(s).board || [])
      .map(b => ({b, trig: fxParse(b.card).atkTrigger}))
      .filter(x => x.trig);
    /* NO `mode` HERE (v2.73). This used to open with `mode:"act",
       pending:null` — closing the payment sheet and putting the trainer
       back in its action phase, neither of which is anything a CARD does.
       Both moved to `resolvePlay`, the trainer's wrapper, so this module
       states no phase at all and a second caller can bring its own. */
    let n = {...s};
    const exSide = actMut(n);
    /* THE ONE PLACE A COST IS CHARGED (v2.80), and on the ALLY route the
       cost is the ABILITY's, not the card's (v3.44). `build.js` folds a
       weapon's activation cost onto its gear entry's `.cost`, so `effCost`
       charges a swing without this file knowing what a weapon is. An
       ally's `.cost` is its PLAY cost — Swabbie 3 — already spent
       deploying it, while its attack prints {r}{r}. Charging `effCost`
       here as well took 5 for a 2-cost attack, driven, before this line
       existed. */
    /* AN AURA'S ATTACK COSTS WHAT THE GRANT SAYS (v3.84), and it is read
       from the same one place both boards ask — never re-derived, which
       is v3.80's three-cost-readers lesson taken as an instruction rather
       than a warning. Its `.cost` is the card's PLAY cost like an ally's
       and is equally already spent, so `effCost` is as wrong here as it
       is there. */
    const _auraAtk = from === "aura"
      ? P.auraAttackOf(card, act(s), {yourTurn: actorOf(s) === s.turnPlayer,
                                      discount: bAct(s).auraDiscount}) : null;
    const _allyCost = from === "ally" ? ((allyAttack(card) || {}).cost || 0)
                    : _auraAtk ? (_auraAtk.cost || 0) : null;
    /* THE CHAIN IS THE CALLER'S ANSWER (v3.86) — Fai's ability discounts
       itself per Draconic chain link, and the chain is game state. Handed
       in here so the ONE cost reader answers, rather than a fourth site
       subtracting after the fact (v3.80). */
    /* ONE READER FOR THE GAME'S HALF OF A COST (v3.96) — see
       `parser.costCtx`. It used to be built inline here and nowhere else,
       so a SECOND game-level input (Stains of the Redback's discount
       against a marked defending hero) would have had to be threaded by
       hand at four sites, which is v3.80's bug waiting to happen again. */
    const _costO = P.costCtx(s, actorOf(s));
    exSide.res = act(s).res - (_allyCost != null ? _allyCost : effCost(card, act(s), _costO));
    exSide.paySel = [];
    /* THE OPTIONAL ADDITIONAL COST IS CHARGED HERE, beside the resource
       cost, because that is what "as an additional cost to play this"
       means (v3.34). The ANSWER rides on the state as `_addPaid`, the
       same seam boost uses for `_doBoost` — a cost cannot be a queued
       prompt, which drains after the card has already resolved. */
    /* AND THE SAME READER, SEVEN LINES DOWN (v4.06). This asked `effCost`
       without the game's half while the line above already had `_costO` in
       hand — a cost read twice with different inputs, which is v3.80's bug
       verbatim and the exact shape `costCtx` was built to stop. Under a
       Frostbite or Hyper Inflation's tax the two disagreed, so the
       affordability test passed on a price the charge above did not use. */
    if(n._addPaid && fx.addPay && act(s).res >= effCost(card, act(s), _costO) + fx.addPay.cost){
      exSide.res = exSide.res - fx.addPay.cost;
      n = L(n, `${card.name}: the additional ${fx.addPay.cost} is paid.`);
    } else if(n._addPaid){
      /* AN UNAFFORDABLE ANSWER IS NOT PAID, and must not collect the
         rider — v2.04's rule, and the reason `_addPaid` is re-derived
         below rather than trusted. */
      n = {...n, _addPaid: false};
      n = L(n, `${card.name}: not enough floating for the additional cost — it goes unpaid.`);
    }
    /* THE ONE-SHOT COST TAX IS SPENT HERE, at the CHARGE, never at the
       affordability check — `effCost` is read twice and only this read
       actually takes the resources (v2.80). Cartilage Crush taxes "their
       FIRST action during their next turn", so marking it spent is what
       keeps it from taxing every card they play. */
    /* AND SO IS THE ONE-SHOT DISCOUNT (v3.32), for the same reason and at
       the same moment: `effCost` above has already applied it, and only
       this read takes resources. Spent at the affordability check instead
       it would discount a play the seat then never made. Exactly ONE
       entry is spent — the same one `costOffFor` matched. */
    { const off = (act(s).costOff || []);
      const i = off.findIndex(e => e && P.qualMatches(e.q, card));
      if(i >= 0){
        exSide.costOff = off.slice(0, i).concat(off.slice(i + 1));
        n = L(n, `${card.name} cost ${off[i].amt} less — that grant is spent.`);
      } }
    if(P.nextTurnTax(act(s)) > 0)
      exSide.nextTurn = (act(s).nextTurn || []).map((e, i, arr) =>
        (e && e.ready && !e.spent && e.kind === "firstActionTax"
         && arr.findIndex(x => x && x.ready && !x.spent && x.kind === "firstActionTax") === i)
          ? {...e, spent: true} : e);
    /* FROSTBITE, THE SECOND HALF OF ITS PRINTED LINE (v2.74):
         "Cards and abilities cost you an additional {r} to play or
          activate. At the beginning of your end phase OR WHEN YOU PLAY A
          CARD OR ACTIVATE AN ABILITY, destroy Frostbite."

       THE ORDER OF THESE TWO LINES IS THE WHOLE RULING. The cost is
       charged on the line above, reading `frostCount` through `effCost`,
       and only then are the tokens destroyed — so the play that destroys
       a Frostbite IS the play that is taxed by it (RULING, user
       2026-08-10). Destroy first and the tax never lands on anything;
       Frostbite would be a permanent that reads as a tax and is free.

       ALL of them go, not one. Each token carries its own copy of that
       trigger and they all fire on the same play (RULING, user
       2026-08-14), which is what makes Ice Eternal's X a burst rather
       than a lasting tax.

       `execute` is the single hook because it is what a card being PLAYED
       and an ability being ACTIVATED both run through — a weapon swing
       and an equipment ability arrive here as their `powCard`. A token
       that leaves the arena ceases to exist, so nothing is filed to a
       graveyard, exactly as `popRunechants` documents. */
    const froze = frostCount(act(n));
    if(froze){
      actMut(n).board = act(n).board.filter(b => !isFrostbite(b));
      n = L(n, `Frostbite bites — ${card.name} cost ${froze} more, and ${froze>1?`all ${froze} Frostbites shatter`:`the Frostbite shatters`}.`);
    }
    // move the card out of its zone
    if(from==="hand"){ actMut(n).hand = act(n).hand.filter((_,i)=>i!==idx); }
    if(from==="arsenal"){ actMut(n).arsenal = null; }
    if(from==="grave"){ actMut(n).grave = act(n).grave.filter((_,i)=>i!==idx); }
    if(from==="banish"){ actMut(n).banish = act(n).banish.filter((_,i)=>i!==idx); }
    if(from==="weapon"||from==="hero"){ actMut(n).weaponUsed = {...act(n).weaponUsed,[card.uid]:true}; }
    /* A HERO THAT PAYS {t} IS TAPPED, and that is a DIFFERENT record from
       the allowance above (v3.48, and v2.46's lesson one zone further in).
       `weaponUsed["hpow"]` says the ability was USED — a per-turn
       allowance that comes back at the turn boundary. `heroTapped` says
       the hero is TAPPED, which only its controller's untap step lifts
       (CR 4.4.3d). They coincide for a hero using its own ability and
       come apart the moment an OPPONENT taps you, which is exactly what
       Entangling Shot and Drop the Anchor do.

       READ THE HERO'S OWN PRINTED LINE, never the powCard's: `build.js`
       strips the cost prefix off the ability when it builds HPOW, so the
       `{t}` this asks about lives in the half that was removed. */
    if(from==="hero" && P.tapsToActivate(((bAct(n).heroRec)||{}).tx || ""))
      actMut(n).heroTapped = true;
    /* A SOUL BANISH IS PAID ON ACTIVATION (v3.74), beside the tap and the
       allowance — not after the effect, the way an equipment's destroy
       cost is. Boltyn prints "Attack Reaction - Banish a card from your
       soul: …", and the soul is a real zone with real cards in it.

       BOTH BOARDS REFUSE IT FIRST (`parser.abSoulCost`, a legality —
       v3.11), so reaching here short is a bug rather than a play; it is
       still guarded, because `execute` is fed by `reduce`, which is fed by
       JSON off a wire. */
    { const _sc = P.abSoulCost(card);
      if(_sc){
        /* AN UNPAYABLE COST IS INERT, NEVER FREE (v2.04). Both boards
           refuse it first, so reaching here short means a stale or crafted
           action off the wire — and running the effect anyway would hand
           it out for nothing. */
        if((act(n).soul||[]).length < _sc)
          return L(n, `${card.name} — ${act(n).name}: ${(act(n).soul||[]).length} in the soul, and it costs ${_sc}. Nothing happens.`);
        else {
          actMut(n).soul = act(n).soul.slice(_sc);
          n = L(n, `${act(n).name}: ${_sc} banished from the soul — the cost is paid.`);
        }
      } }
    /* A DISCARD IS PAID ON ACTIVATION TOO (v4.09), beside the soul banish
       and for its reasons. Arakni's Agents print "Attack Reaction -
       Discard an Assassin card: …", and the hand is a real zone with real
       cards in it.

       BOTH BOARDS REFUSE IT FIRST (`parser.abDiscardCost`, a legality —
       v3.11), so reaching here with nothing that matches is a stale or
       crafted action off the wire. AN UNPAYABLE COST IS INERT, NEVER FREE
       (v2.04), which is why it is still guarded.

       THE DISCARD IS TURN-STAMPED into the graveyard like every other
       (v2.23's `_gy`), or every "…put into a graveyard this turn" clause
       goes quietly wrong.

       AND IT IS DELIBERATELY NOT IN `_discWay`. That trace answers "what
       did this resolution DISCARD" for a `…this way` clause — and "this
       way" names the way the EFFECT describes, not the way its cost was
       paid. A cost is not the effect (v2.04 states the same boundary from
       the other side), so crediting it would let a 6-power card spent as
       a PRICE satisfy a clause about what the card DID. No Agent prints
       such a clause, so nothing turns on it today; the reading is what
       matters.

       (The first draft wrote the trace here and it was silently WIPED —
       `execute` clears `_discWay` per resolution some 300 lines below, so
       a credit taken at the charge never survived. Two facts, one bug:
       the ordering was wrong AND the credit should not have been there.)

       AND THE DRAFT BEFORE THAT CALLED A FUNCTION THAT DOES NOT EXIST —
       `creditDiscard`, a name taken from a COMMENT rather than from the
       file, which would have thrown from inside a reducer whose contract
       is that it never throws. Check the function exists before calling
       it, and check where the state you write is cleared. */
    { const _dc = P.abDiscardCost(card);
      if(_dc){
        const _hand = act(n).hand || [];
        const _i = _hand.findIndex(PR.promptFilter(_dc));
        if(_i < 0)
          return L(n, `${card.name} — ${act(n).name} holds no ${card._discardSubject||"card"} to discard. Nothing happens.`);
        const _paid = _hand[_i];
        const _sd = actMut(n);
        _sd.hand = _hand.slice(0, _i).concat(_hand.slice(_i + 1));
        _sd.grave = [Object.assign({}, _paid, {_gy: n.turn})].concat(_sd.grave || []);
        n = L(n, `${act(n).name} discards ${_paid.name} — the cost is paid.`);
      } }
    /* "BANISH THIS AND …" — THE SOURCE IS PART OF THE COST (v3.79).
       Radiant Touch prints "Instant - Banish this and a card from your
       soul", and the piece leaving for good IS the price: a prevention
       pool you can raise every turn for one soul card is a different
       card. Charged AFTER the soul, so an unpayable soul cost returns
       above and the piece is not spent for an ability that never ran.

       IT IS MARKED, NOT SPLICED, and that is v3.54's whole safety
       argument: the trainer's `blockG` holds INDICES into `gear`, so
       removing an entry while a wall is declared renumbers the defenders
       underneath it — and this is an INSTANT, playable during exactly
       that block. `sweepGear` files it at a point where no wall can be
       live, and BANISH is its second destination. */
    if(P.abSelfBanish(card)){
      const _bu = card._banishGear;
      actMut(n).gear = act(n).gear.map(x => x.uid === _bu
        ? Object.assign({}, x, {destroyed: true, _banished: true}) : x);
      n = L(n, `${card.name.replace(/ — ability$/, "")} is banished — the rest of the cost is paid.`);
    }
    /* ---- TURNING THE SOURCE FACE-UP IS A COST (v3.99) ---------------
       Uphold Tradition: "Cloaked (Equip this face-down.) / Instant - {r},
       turn this face-up: Put a +1{p} counter on an aura you control with
       ward."

       THE FLIP IS WHAT MAKES IT A ONE-SHOT. Until now the cost guard in
       `parseHeroPower` never saw the phrase — "turn this face-up" contains
       none of the words it refuses — so the resource half was charged, the
       flip was dropped, and the ability minted a +1{p} counter EVERY TURN
       for one resource. Stronger than printed, `tier: full`, and invisible
       to the one-sided fairness sweep.

       BOTH BOARDS REFUSE IT FIRST (`parser.abFlipUp`, a legality — v3.11),
       so reaching here already face-up means a stale or crafted action off
       the wire. It is still guarded, because an unpayable cost is INERT
       and never free (v2.04).

       THE PIECE IS MARKED, NOT MOVED. Nothing leaves a zone, so v3.54's
       index hazard does not arise — but the flag lives on the gear entry
       beside `curDef` and `destroyed`, which is what makes it ship over
       the wire for free: `wire.js` diffs a card structurally and reads no
       card text, so a card that grows a field travels automatically. */
    if(P.abFlipUp(card)){
      const _fu = card._flipGear;
      const _fg = act(n).gear.find(x => x.uid === _fu);
      if(!_fg || !_fg._faceDown)
        return L(n, `${card.name.replace(/ — ability$/, "")} is already face-up — nothing happens.`);
      actMut(n).gear = act(n).gear.map(x => x.uid === _fu
        ? Object.assign({}, x, {_faceDown: false}) : x);
      n = L(n, `${_fg.name} is turned face-up — the rest of the cost is paid.`);
    }
    /* A NAMED BOARD PERMANENT IS A COST (v3.86) — GRAVY BONES.

       "Instant - {t}, destroy a Gold you control: Draw a card, then
       discard a card." Measured across all 797 records, 39 print a
       destroy in an activation cost and **38 of them destroy THIS**; his
       is the only one that names a card somewhere else, which is why
       `parseHeroPower` refused the whole line and his hero ability was
       inert while his deck read 100%.

       PAID ON ACTIVATION, beside the tap and the soul — not after the
       effect, the way an equipment's own `destroy this` is. It is a COST:
       drawing and discarding first and then finding the Gold gone is a
       different card.

       BOTH BOARDS REFUSE IT FIRST (`parser.boardEntryNamed`, a legality —
       v3.11), so reaching here empty means a stale or crafted action off
       the wire. An unpayable cost is INERT, never free (v2.04).

       THE GRAVEYARD IS THE DESTINATION (the 2026-08-29 ruling: a destroyed
       permanent goes to the graveyard) and it goes through `gy` so it is
       TURN-STAMPED like every other path in — a new path that forgets the
       stamp makes the whole "…this turn" family quietly wrong (v3.54).
       Gold prints no pitch, so it is not blue and cannot satisfy his own
       second clause; that falls out of the card rather than being said. */
    { const _dn = P.abDestroyBoard(card);
      if(_dn){
        const _de = P.boardEntryNamed(act(n), _dn);
        if(!_de)
          return L(n, `${card.name} — ${act(n).name} controls no ${_dn}. Nothing happens.`);
        actMut(n).board = act(n).board.filter(x => x !== _de);
        actMut(n).grave = [...gy(n.turn, _de.card), ...act(n).grave];
        n = L(n, `${act(n).name}: ${_de.card.name} is destroyed — the cost is paid.`);
      } }
    /* ---- AN ALLY ATTACKS FROM THE ARENA (v3.44) ---------------------
       Nothing is spliced out of a zone: the ally is a permanent and it
       stays on the board, exactly as a weapon stays equipped —
       `fileAttack` already files nothing for an activation route, so it
       needs no change.

       THE ATTACK'S COST IS NOT THE CARD'S COST. `build.js` folds a
       weapon's activation cost onto the gear entry's `.cost`, which is
       why `effCost` charges a swing without this file knowing anything
       about weapons. An ALLY's `.cost` is its PLAY cost — Swabbie 3 —
       and that was spent deploying it; the attack costs {r}{r} on top.
       Reading `.cost` here would charge the deploy price a second time,
       so the ability's own printed cost is charged explicitly.

       TWO LIMITS, EXPIRING DIFFERENTLY — the Sledge/Scorpio rule (v2.46)
       applied to allies. `{t}` is a STATE the permanent is in and only
       its controller's untap step lifts it (CR 4.4.3d, already built for
       the arena); `Once per Turn` is a per-turn ALLOWANCE that comes back
       at the turn boundary. Six pool allies tap, four are once-per-turn
       without tapping, and the trainer's old `allySwing` set a blanket
       `spent` for all of them. */
    if(from==="ally"){
      const aa = allyAttack(card);
      if(aa){
        /* the COST is charged at the single site above, never here — see
           the note there. Two charge sites is how this first came out at
           9 -> 4 for a 2-cost attack on a 3-cost ally. */
        if(aa.taps) actMut(n).board = act(n).board.map(b =>
          b && b.uid === card.uid ? {...b, spent: true} : b);
        if(aa.oncePerTurn) actMut(n).weaponUsed =
          {...act(n).weaponUsed, ["ally" + card.uid]: true};
      }
    }
    /* THE AURA'S TWO LIMITS, beside the ally's and for the same reason —
       a tap is a STATE its controller's untap step lifts (CR 4.4.3d) and
       "Once per Turn" is an ALLOWANCE that comes back at the boundary
       (v2.46). The key is namespaced `aura` so it cannot collide with the
       ally's or a weapon's on the same uid. */
    if(from === "aura" && _auraAtk){
      if(_auraAtk.taps) actMut(n).board = act(n).board.map(b =>
        b && b.uid === card.uid ? {...b, spent: true} : b);
      if(_auraAtk.oncePerTurn) actMut(n).weaponUsed =
        {...act(n).weaponUsed, ["aura" + card.uid]: true};
      /* RECORDED AFTER THE COST IS CHARGED, or the swing spends its own
         discount — the same ordering `hist.non` keeps for "another"
         (v3.38). The charge site is 150 lines above, so this is safe
         where it stands; it is stated because moving either would be a
         silent one-resource change to Enigma's first attack every turn. */
      actMut(n).hist = {...act(n).hist,
        auraAtkNames: [...(act(n).hist.auraAtkNames || []), card.name]};
    }
    if(bAct(n).viseraiPassive && /runeblade/i.test(card.tt||"") && act(n).hist.non>0){ n = mkRune(n, 1); n=L(n,`Viserai's rite — a non-attack already down, so this Runeblade card conjures a Runechant (now ${runeCount(act(n))}).`); }
    const preHP = foe(n).hp;
    /* colour is pitch: red 1, yellow 2, blue 3 — several rulings key off
       "another blue/red card this turn" */
    if(card.pitch===3) actMut(n).hist = {...act(n).hist, blue:(act(n).hist.blue||0)+1};
    if(card.pitch===1) actMut(n).hist = {...act(n).hist, red:(act(n).hist.red||0)+1};
    const attacking = isAttack(card) || from==="weapon" || from==="ally" || from==="aura";
    /* THE GO AGAIN ON AN ACTIVATED-ABILITY LINE IS THE ABILITY'S (v3.44).
       Limpit prints "Action - {r}, {t}: Attack. Go again"; the clause
       splitter breaks on the period, so "Go again" arrives as a clause of
       its own and sets `fx.ga` — the CARD's. For a weapon that is exactly
       right and is how Mark of the Huntsman's swing goes again, because a
       weapon is never played. An ALLY is played, and driven before this
       fix DEPLOYING Limpit kept its action point: a free ally out of
       Gravy Bones' own deck.

       On the ALLY ATTACK route the answer is the attack ability's own
       line, never `fx.ga` — Cutty Shark prints go again on its OTHER
       ability ("Once per Turn Action - {r}: Your next ally attack ... Go
       again"), and handing that to the attack would be reading one
       ability's text onto another. */
    const _activation = from==="weapon" || from==="hero" || from==="board" || from==="ally" || from==="aura";
    const _allyAtk = from==="ally" ? allyAttack(card) : null;
    /* COSMO'S SECOND SENTENCE (v3.84): "your aura attacks with ONE OR
       MORE +1{p} counters get go again". The condition is a fact about
       the AURA at the moment it swings, not about the grant, so it is
       asked here rather than folded into `auraAttackOf` — and it is the
       counter COUNT, not the pumped total: an aura pumped by something
       else and carrying no counter gets nothing.

       IT IS THE ONLY GO AGAIN ON THIS ROUTE. The quoted granted ability
       is "Once per Turn Action - {r}: Attack" with no keyword of its own,
       and `fx.ga` read off a Spectral Shield answers about the TOKEN's
       printed line, which says only "Ward 1". */
    const _auraGa = !!(_auraAtk && _auraAtk.gaWithCounters
      && ((act(n).counters[card.uid] || {}).pow || 0) > 0);
    let ga = _auraAtk ? _auraGa
           : _allyAtk ? !!_allyAtk.ga
           : (!_activation && abilityGa(card)) ? false
           /* ---- AN ATTACK REACTION'S GO AGAIN IS THE TARGET'S (v3.74) --
              "Target arrow attack with {p} greater than its base GETS GO
              AGAIN" grants it to the ATTACK, and `fx.ga` reads it as the
              ability's own — so activating one handed its controller a
              free ACTION POINT on top of the grant. Three of the pool's
              four attack-reaction abilities print that shape (Bolt'n
              Boots, Stalker's Steps, Boltyn's hero) and NOT ONE of them
              prints a go again of its own; the first two have been live
              since v3.63 built this route.

              STRONGER THAN PRINTED — the direction that steals games —
              and invisible to every tool here, because a powCard is built
              by `build.js` out of a printed line and is not a pool card,
              so neither the audit nor the fairness sweep looks at one
              (v3.73, two versions running).

              THE ABILITY'S OWN go again ARRIVES AS A KEYWORD, put there
              by `build.js` from `parseHeroPower`'s trailing-"Go again"
              read — so reading `kw` here keeps a real one and drops the
              payload's. The ops are already held back for exactly the
              same reason one line down. */
           : card._attackRx ? (card.kw||[]).some(k=>/^go again$/i.test(String(k)))
           : fx.ga;
    if(card._arsGA && card._upTurn === n.turn) ga = true;
    /* ---- THE FIRST GRAVEYARD PLAY OF A KEYWORD EACH TURN (v4.01) -----
       COMPASS OF SUNKEN DEPTHS — "The first card with watery grave you
       play from your graveyard each turn gets go again."

       IT IS READ HERE, before the attack/non-attack split, because it is
       a fact about the PLAY rather than about the swing: Gravy Bones
       replays ALLIES out of his graveyard, and every one of them is a
       non-attack. Read inside the attacking branch — where `gaNext` is
       taken — it would fire for none of the cards it exists for.

       THE STATIC IS THE SIDE'S, and `parser.gyFirstGaKw` is its one
       reader, scanning gear AND arena: the watcher is not the card being
       played (v3.33, v3.55, v3.93), and Compass is an Off-Hand.

       "FIRST … EACH TURN" IS `hist`, which CR 4.4.4 clears at the turn
       boundary — so the window needs no other bookkeeping (v3.85). It is
       recorded WHEN THE GRANT IS TAKEN rather than at the play, or the
       second such card gets it too and "first" is decoration.

       `printedKw`, NEVER `hasKw` (v2.84's three questions). A card that
       merely MENTIONS the keyword has not got it, and granting an action
       point off a mention is the most valuable keyword in the game to get
       wrong. */
    if(from === "grave"){
      const _gk = P.gyFirstGaKw(act(n));
      if(_gk && P.printedKw(card, _gk)
         && !(act(n).hist.gyFirstKw || []).some(k => k === _gk)){
        ga = true;
        actMut(n).hist = {...act(n).hist,
          gyFirstKw: [...(act(n).hist.gyFirstKw || []), _gk]};
        n = L(n, `${card.name} is the first ${_gk} card out of the graveyard this turn — go again.`);
      }
    }
    /* SPEND A WAITING NEXT-INSTANT GRANT (v3.37) — Stir the Aetherwinds.
       IT IS TAKEN HERE, AHEAD OF THE CARD'S OWN OPS, because the payload
       it carries is an AMP and `arcane` reads `sd.amp` as it resolves
       (see the op above). Taken after, the grant would be spent on the
       very card its bonus was printed for and pay nothing. */
    { const _iq = takeInstantNext(n, card, {from});
      if(_iq && _iq.amp){ actMut(n).amp = act(n).amp + _iq.amp;
        n = L(n, `${card.name} is what that grant was waiting for — +${_iq.amp} arcane.`); }
      else if(_iq) n = L(n, `${card.name} is what that grant was waiting for.`); }
    /* CHARGE (Boltyn) — "As an additional cost to play this, you may charge
       your hero's soul." A real additional cost paid BEFORE the rest of the
       card resolves, so it has to happen here, ahead of the conds loop below
       that reads it ("if a yellow card is charged this way"). Real play is a
       genuine choice; the trainer has no prompt wired for a cost paid before
       the card's own total is struck (prompts drain only after resolution —
       see engine/prompts.js), so this follows the SAME honest approximation
       already in place for fx.addCost.discard: auto-pick from hand, cheapest
       card first. The pick prefers whatever pitch this card's OWN rider is
       asking for (read off fx.conds — never guessed or special-cased by
       name) so the "may" is worth taking when it would actually pay off. */
    let chargedPitch = null;
    if(fx.chargeCost && act(n).hand.length){
      const wantCond = fx.conds.concat(fx.condOnHit||[]).map(x=>x.cond).find(c2=>/^chargedPitch\d$/.test(c2));
      const wantPitch = wantCond ? +wantCond.match(/\d+/)[0] : null;
      let idx = wantPitch!=null ? act(n).hand.findIndex(c2=>c2.pitch===wantPitch) : -1;
      if(idx===-1){
        const ranked = act(n).hand.map((c2,i2)=>({i2,v:advValue(c2,n,{runeDmg:bAct(n).runeDmg})})).sort((a,b)=>a.v-b.v);
        idx = ranked[0].i2;
      }
      const picked = act(n).hand[idx];
      chargedPitch = picked.pitch;
      actMut(n).soul = [picked, ...act(n).soul];
      actMut(n).hand = act(n).hand.filter((_,i2)=>i2!==idx);
      actMut(n).hist = {...act(n).hist, charged:(act(n).hist.charged||0)+1};
      n = L(n, `${card.name}: charged ${picked.name} into your hero's soul (Charge).`);
    }
    /* FUSION — CR: "As an additional cost to play this, you may reveal a
       [type] card from your hand." Nothing moves zones (a reveal, not a
       cost paid away), so unlike Charge there is no real downside to
       taking it — always fused when hand has a qualifying card. Type is
       read off the printed type line (`tt`), same field attackQual reads
       elsewhere; never guessed. */
    let fused = false;
    if(fx.fusionCost){
      fused = act(n).hand.some(c2 => fx.fusionCost.types.some(ty => new RegExp("\\b"+ty+"\\b","i").test(c2.tt||"")));
      n = L(n, fused
        ? `${card.name}: revealed a ${fx.fusionCost.types.join("/")} card from hand — fused (Fusion).`
        : `${card.name}: no ${fx.fusionCost.types.join("/")} card in hand to reveal — not fused.`);
    }
    // conditional clauses evaluated against this turn's history (before this card)
    /* "INSTEAD" REPLACES. When a conditional payload says "instead" and its
       condition is MET, the unconditional base op of the same kind must NOT
       also fire. Emeritus Scolding printed "deal 2 ... instead deal 4" and
       dealt 6 on the opponent's turn — 50% over, and in a game of margins
       that decides races. Collected here, filtered out of fx.ops below. */
    const insteadKinds = new Set();
    /* "DRAW A CARD THEN DISCARD A RANDOM CARD. If a card with 6 or more {p}
       is discarded THIS WAY, ..." — the discard decides the rider, so it
       must happen BEFORE the conditions are read and before the attack's
       total is struck. Same reasoning as declOps' reveal (which changes the
       power it is about to strike with); this one is earlier still, because
       a CONDITION reads its result rather than an op.
       `_discWay` is cleared per resolution: leaving it to accumulate would
       silently turn "this way" back into "this turn", which is the bug this
       whole distinction exists to fix. The pre-run ops are filtered out of
       both the immediate and the deferred op lists so they cannot fire a
       second time on resolution. */
    n._discWay = [];
    /* AND WHAT IT TOOK FROM THE OPPONENT (v3.95), for `_discWay`'s reason:
       left to accumulate it is the NEXT card's condition reading a
       discard it never caused. */
    n._tookWay = [];
    n._kwGrant = [];        // cleared with _discWay, and for the same reason
    /* A KEYWORD THE ARSENAL STAMPED ON THIS CARD (v3.71). Azalea's hero
       ability grants dominate to an ARROW it turns face up, and the grant
       is printed "until end of turn" — so it waits on the card, beside
       `_arsPow` and `_arsGA`, and is spent when the card is played. It
       joins `_kwGrant` rather than being a fourth thing to read: that list
       is already the one answer to "what did this resolution grant", and
       `parser.defCap` is already its reader. `_upTurn` is what makes "this
       turn" mean this turn — an arrow held over to the next turn keeps the
       card and loses the keyword. */
    if(card._upTurn === n.turn && (card._arsKw||[]).length){
      n._kwGrant = [...n._kwGrant, ...card._arsKw.map(x => String(x).toLowerCase())];
      n = L(n, `${card.name} came out of the arsenal with ${card._arsKw.join(" and ")}.`);
    }
    n._dmgWay  = 0;         // and so is the damage trace, for the same reason again
    n._arsWay  = 0;         // …and the cross-seat arsenal count (v3.88)
    n._costWay = [];        // …and what an optional cost consumed (v3.90)
    /* IS THIS CARD GOING TO RESOLVE ONTO THE LINK? (v3.89) Two routes
       reach `attackRx` — an ACTIVATED ability (`_attackRx`, v3.63) and a
       PLAYED attack reaction — and both need the answer BEFORE the
       condition loop and the op run below, which is why it is a predicate
       rather than a result. */
    const _rxRoute = !!card._attackRx
      || (isAR(card) && !isAttack(card) && !!n.pend && n.pend.by === actorOf(n));
    const preRan = new Set();
    if(fx.ops.some(o=>o[0]==="discardRandom")){
      const pre = fx.ops.filter(o=>o[0]==="draw"||o[0]==="discardRandom");
      n = runOps(n, pre, card.name);
      pre.forEach(o=>preRan.add(o));
    }
    /* THE CROSS-SEAT ARSENAL PUT IS PRE-RUN TOO (v3.88), and for the
       reason v3.60 states: `execute` evaluates the conditions BEFORE it
       runs the ops, so a condition asking what my own ops just did is
       answered against an empty record. Concoct Disorder's second
       sentence — "if 2 or more cards are put into arsenals THIS WAY" —
       is exactly that shape.

       THE `way:` LATE PASS CANNOT SERVE IT, because on an ATTACK card
       `fx.ops` ride to RESOLUTION (`pend.ops`) while `runWayConds` fires
       at DECLARATION. v3.60 says so in as many words and left the attack
       case refusing; the pre-run is the other half of its own answer —
       "pre-run when the op can safely move; the late pass when it
       cannot" — and this op can, because a zone move between two decks
       and two arsenals depends on nothing the attack does.

       IT ALSO MATCHES THE PRINTED TRIGGER. "WHEN THIS ATTACKS" fires on
       declaration; riding to `pend.ops` would put it at resolution, which
       is the existing approximation for the other 14 attack cards that
       print a bare when-this-attacks. This one is moved because its own
       condition asks about it — the rest are measured and left alone. */
    if(fx.ops.some(o=>o[0]==="eachArsPut")){
      const pre = fx.ops.filter(o=>o[0]==="eachArsPut");
      n = runOps(n, pre, card.name);
      pre.forEach(o=>preRan.add(o));
    }
    fx.conds.forEach(({cond,op,instead,atkHero,wpnOnly})=>{
      /* "THIS CARD'S ATTACKS GET …" IS ABOUT THE SWING, NOT THE CARD
         (v3.58). Three pool weapons print a conditional static on their
         own attacks; the same piece can also be activated for a non-attack
         ability, and the bonus must not follow it there. `from` is the
         route, exactly as it is for an ally (v3.44). */
      if(wpnOnly && from !== "weapon") return;
      /* A "…THIS WAY" CONDITION CANNOT BE ANSWERED YET (v3.60). This loop
         runs BEFORE `fx.ops`, so the trace it asks about is empty — every
         such condition would read false, on every card, forever. They are
         skipped here and evaluated by the LATE pass below, after the
         card's own ops have actually run. */
      if(/^way:/.test(cond)) return;
      /* AND A REACTION CONDITION BELONGS TO `attackRx` (v3.89). It is the
         only route given the hand-blocker count, so this loop can only
         ever answer `reprise` FALSE — and then print that, four lines
         before the reaction pumps the link. The state is identical either
         way; what differs is that the player is told the condition failed
         and then handed the bonus, which is exactly v3.60's shape. */
      if(_rxRoute && RX_CONDS.indexOf(cond) >= 0) return;
      /* AND NEITHER CAN A LATE CONDITION (v3.71), for the same reason one
         step further out: `pumped` and the two defender counts are settled
         at the WALL, and this loop runs at declaration. They were falling
         through to the default `false` here, so the feed said "condition
         not met (pumped)" and then, four lines later, "pumped above base —
         +1 power". THE FEED CONTRADICTING ITSELF is the sev-2 category the
         player trusts (v3.60), and the state was right the whole time.

         Only on the attacking route: `pend.lateConds` is built from this
         same list on that branch alone, so a non-attack printing one has
         no late pass to reach and keeps its honest refusal here. */
      if(attacking && isLateCond(cond)) return;
      /* "WHEN THIS ATTACKS A HERO, IF …" is a trigger with a subject
         wrapped around a gate (v3.46). Mocking Blow booed the crowd off an
         attack on an ally, which is a hero's reaction to being hit by a
         card that never touched them. */
      if(atkHero && !heroTarget){
        n = L(n, `${card.name} is attacking an ally — its "attacks a hero" trigger does not fire.`);
        return;
      }
      if(cond==="defLt2") return; // resolved after blocks
      if(cond==="discard6"){
        /* RULING: check the graveyard for a 6+ power card added THIS turn */
        if(!had6ThisTurn(n)){ n = L(n, `${card.name}: nothing with 6+ power has hit your graveyard this turn.`); return; }
        if(op[0]==="ga") ga = true;
        else if(op[0]==="self" && attacking) n._condSelf = (n._condSelf||0)+op[1];
        else n = runOps(n,[op],card.name);
        n = L(n, `${card.name}: a 6+ power card is already in the graveyard — the bonus is live.`);
        return;
      }
      /* RULINGS 2026-07-25 — the engine already held every one of these
         facts, it just had no condition that asked for them: which zone the
         card came from, the life race, the marked state, and how many links
         of this turn's chain are Draconic (link 1 = the turn's first attack). */
      const dracN = /^drac(\d+)$/.test(cond) ? +cond.slice(4) : null;
      /* RULING: links come from attacks — "the first attack each turn is chain
         link 1" — so non-attack arcane (kind "arc") and the dummy's swing
         (kind "foe") must not be counted. */
      const dracLinks = P.dracLinks(n.chain);   /* one reader — v3.86 */
      const met = cond==="atk" ? act(n).hist.atk>0 : cond==="non" ? act(n).hist.non>0
        /* what THIS resolution discarded, not what the turn did */
        : cond==="discard6way" ? (n._discWay||[]).some(c=>pow6(c, bAct(n)))
        : cond==="pitch6" ? act(n).pitch.some(c=>pow6(c, bAct(n)))
        : cond==="arsenal" ? from==="arsenal"
        : cond==="lifeLt" ? act(n).hp < foe(n).hp
        : cond==="lifeGt" ? act(n).hp > foe(n).hp
        : cond==="marked" ? !!foe(n).marked
        /* "IF IT'S NOT YOUR TURN" IS A QUESTION ABOUT THE TURN, NOT ABOUT
           A COMBAT WINDOW (v2.73). Read as `mode==="block"` this meant
           "they are swinging at me" — which was the only shape the
           opponent's turn had until v2.71 gave them an action phase. The
           moment `mode:"foeturn"` existed this silently answered FALSE
           there, so an Emeritus Scolding played in the new window would
           have taken the ordinary branch. A second copy of a gate the
           trainer had already widened; the trainer's `activateIfOk` is the
           other one, and this is why they must not be two.

           `turnPlayer` rides on every state through `withPriority`
           (v2.27), and the actor is who is resolving — so this is the
           question the CR actually asks. The mode test stays as the
           fallback for a state built without the priority fields, which
           is every drill that hand-rolls one. */
        : cond==="foeTurn" ? foeTurnNow(s)
        : cond==="arcDealt" ? (act(n).hist.arc||0)>0
        /* THE HERO'S OWN SUFFERING, not the opponent's (v3.40). */
        : cond==="arcTakenTurn" ? (act(n).hist.arcTaken||0)>0
        : cond==="auraTurn" ? (act(n).hist.aura||0)>0
        : cond==="madeCard" ? (act(n).hist.made||0)>0
        : cond==="booed" ? (act(n).hist.booed||0)>0
        /* "IF YOU'VE PLAYED A <CLASS> CARD THIS TURN" (v3.58) — Star Fall.
           Answered off `hist.playTy`, the structured type words of every
           card played this turn (v3.38), so the CLASS comes off the card
           rather than from a list here. Lowercased on the way in, which is
           what `playTy` stores.

           IT IS A WIDER QUESTION THAN `blue`/`red` above: those count a
           pitch VALUE and say "another", where this asks about a class and
           does not exclude the card being played. */
        : /^playedCls:/.test(cond) ? ((act(n).hist.playTy||[])
            .some(ty => (ty||[]).indexOf(cond.replace(/^playedCls:/, "")) >= 0))
        : cond==="blue" ? (act(n).hist.blue||0)>0
        : cond==="red" ? (act(n).hist.red||0)>0
        : cond==="transcended" ? (act(n).hist.trans||0)>0
        /* conditions added after the deep dive — all read existing state */
        /* "IF THIS HAS AN AIM COUNTER" — THIS card, by uid (v3.72). It
           asked whether ANY counter bag on the side held an aim counter,
           which is a different question and a strictly more generous one:
           one aimed arrow would have pumped every other arrow in the deck.
           Unreachable until v3.72, because Crow's Nest is the pool's only
           source of aim counters and its trigger had no event to fire on —
           so building the SOURCE is what made the approximation live.
           v3.57's rule, read from the other end: when you build a source,
           ask which conditions it just made reachable. */
        : cond==="aim" ? ((act(n).counters[card.uid]||{}).aim||0) > 0
        : /^auras\d+$/.test(cond) ? (act(n).board||[]).filter(b=>b.kind==="aura").length >= +cond.slice(5)
        : cond==="hasArsenal" ? !!act(n).arsenal
        : cond==="seismic" ? (act(n).board||[]).some(b=>/seismic surge/i.test((b.card&&b.card.name)||""))
        : cond==="suspenseAura" ? (act(n).board||[]).some(b=>b.kind==="aura" && hasKw(b.card,"suspense"))
        : /^pitchCost\d+$/.test(cond) ? act(n).pitch.some(c=>(c.cost||0) >= +cond.slice(9))
        : cond==="allyDied" ? (act(n).grave||[]).some(c=>c._gy===n.turn && /\bally\b/i.test(c.tt||""))
        : cond==="weaponSwung" ? Object.keys(act(n).weaponUsed||{}).length>0
        : cond==="dealtDmg" ? (act(n).hist.atk||0)>0 || (act(n).hist.arc||0)>0
        : cond==="isDraconic" ? (/draconic/i.test(card.tt||"") || !!act(n).dracNext)
        : cond==="pitchOverBase" ? act(n).pitch.some(c=>(c.power||0) > (card.power||0))
        : cond==="lifeTie" ? act(n).hp === foe(n).hp
        /* CHARGE (Boltyn): "charged" is a turn-scoped boolean; "chargedPitchN"
           asks about the SPECIFIC card just charged as THIS card's own cost
           (chargedPitch is computed above, before this loop runs). */
        : cond==="charged" ? (act(n).hist.charged||0)>0
        : /^chargedPitch\d$/.test(cond) ? chargedPitch === +cond.match(/\d+/)[0]
        /* FUSION: `fused` is computed above, before this loop runs. */
        : cond==="fused" ? fused
        : /^atkNamed:/.test(cond) ? (act(n).hist.atkNames||[]).includes(cond.slice(9))
        : /^hit\d+$/.test(cond) ? (n.chain||[]).filter(l=>l.dmg>0).length >= +cond.slice(3)
        /* HIGH TIDE: blue is pitch value 3 throughout this engine. */
        : /^pitchBlue\d+$/.test(cond) ? act(n).pitch.filter(c=>c.pitch===3).length >= +cond.match(/\d+/)[0]
        /* SURGE: Amp is the only mechanic that can push a non-attack arcane
           effect above its own printed base, so "will this deal more than
           its base" reduces to "is an Amp bonus live right now" — checked
           before the arcane op below consumes it. */
        : /^surgeOver\d+$/.test(cond) ? act(n).amp>0
        /* THE FOUR TRAPS ASK ABOUT THE ATTACK COMING AT YOU (v3.08), which
           is a different object from the one every condition above reads.

           `hostileAtk` is the same test `atkMinus` already makes and for
           the same reason: a `pend` belongs to whoever DECLARED it, so the
           only way to know it is aimed at the resolving seat is that the
           seat is not its owner. Without that a trap would read the
           holder's OWN attack and mark the wrong hero.

           NOT `pumped`. That one asks whether MY attack beat its own base
           and is settled in `linkPumps` after the total is struck; these
           are checked the moment the trap resolves, which is when the CR
           checks a trigger condition. A pump landing later in the same
           reaction step does not reach back and turn the trigger on.

           IN THE TRAINER BOTH ARE FALSE, and that is the right answer
           rather than a gap: seat 1 there is always the vanilla pile
           (v2.81), its swing is the `[3,4,5]` scalar on `n.incoming` with
           no card behind it, and a fabricated number has neither go again
           nor a base to beat. At the table, against a person, both are
           live. */
        : cond==="defGA" || cond==="defPumped" ? (() => {
            const hostile = n.pend && n.pend.by != null && n.pend.by !== actorOf(n);
            if(!hostile) return false;
            return cond==="defGA" ? !!n.pend.ga
                                  : (n.pend.total||0) > ((n.pend.card && n.pend.card.power)||0);
          })()
        : dracN!=null ? dracLinks >= dracN : false;
      const why = {atk:"no other attack yet", non:"no other non-attack yet",
        pitch6:"no 6+ power card in your pitch zone", arsenal:"not played from arsenal",
        lifeLt:"you aren't behind on life", lifeGt:"you aren't ahead on life",
        marked:`${foe(n).name} isn't marked`, foeTurn:`it's your turn, not ${foe(n).name}'s`,
        arcDealt:"no arcane damage dealt yet this turn",
        auraTurn:"no aura played or created this turn",
        madeCard:"nothing created this turn", booed:"the crowd hasn't booed you this turn",
        blue:"no other blue card played this turn", red:"no other red card played this turn",
        transcended:"you haven't transcended this turn",
        aim:"no aim counter on it", hasArsenal:"your arsenal is empty",
        seismic:"no Seismic Surge token on your board",
        suspenseAura:"no aura of Suspense on your board",
        allyDied:"no ally has hit your graveyard this turn",
        weaponSwung:"you haven't attacked with a weapon this turn",
        dealtDmg:"you haven't dealt damage this turn",
        isDraconic:"this isn't Draconic",
        pitchOverBase:"nothing in your pitch zone beats its base power",
        lifeTie:"life totals aren't level",
        charged:"you didn't charge your hero's soul this turn",
        fused:"no qualifying card in hand to reveal for Fusion",
        /* NAMED, NOT SECOND-PERSON. These reach `L`, which writes the feed
           BOTH seats read — so the subject is the trap card the message
           already names, never "you". `test/judge.test.js`'s ledger caught
           the first draft of exactly this. */
        defGA:"the attack it defends has no go again",
        defPumped:"the attack it defends isn't pumped above its base"}[cond]
        || (/^auras(\d+)$/.test(cond) ? `fewer than ${cond.slice(5)} auras on your board` : null)
        || (/^pitchCost(\d+)$/.test(cond) ? `no card costing ${cond.slice(9)} or more in your pitch zone` : null)
        || (/^pitchBlue(\d+)$/.test(cond) ? `fewer than ${cond.match(/\d+/)[0]} blue cards in your pitch zone` : null)
        /* NAME THE CONDITION IN THE PLAYER'S WORDS, not the engine's. The
           feed is the lesson in a training sim, and "condition not met
           (playedCls:lightning)" teaches nobody anything. */
        || (/^playedCls:/.test(cond) ? `no ${cond.replace(/^playedCls:/, "")} card played this turn` : null)
        || (/^surgeOver(\d+)$/.test(cond) ? `didn't deal more than ${cond.match(/\d+/)[0]} damage` : null)
        || (/^chargedPitch(\d)$/.test(cond) ? `the card charged this way wasn't the right colour` : null)
        || (dracN!=null ? `only ${dracLinks} Draconic chain link${dracLinks===1?"":"s"}, needs ${dracN}` : cond);
      if(!met){ n = L(n, `${card.name}: condition not met (${why}).`); return; }
      if(instead){ insteadKinds.add(op[0]);
        n = L(n, `${card.name}: the condition holds — ${op[0]} ${op[1]} REPLACES the printed value.`); }
      if(op[0]==="ga") ga = true;
      else if(op[0]==="self" && attacking) n._condSelf = (n._condSelf||0)+op[1];
      else n = runOps(n,[op],card.name);
    });
    /* ---- THE LATE "…THIS WAY" PASS, ONE BODY, BOTH BRANCHES (v3.62) --
       `execute` evaluates `fx.conds` BEFORE it runs the card's ops, so a
       condition asking what its own resolution just did reads an empty
       trace — false on every card, forever. These are skipped by the main
       loop and answered here, once the facts exist.

       IT IS ONE BODY BECAUSE THERE ARE TWO BRANCHES. A non-attack's ops
       run at ~2230; an attack's on-attack trigger fires at ~2150 and its
       `pend` was built BEFORE that. Two copies of this loop is the
       drift this file names on nearly every page — so the difference
       between the branches is expressed as the `grantGa` callback and
       nothing else.

       GO AGAIN IS THE ONE OP THAT CANNOT JUST `runOps`. It is a GAIN of
       an action point (CR 5.3.5) that the surrounding code tracks in a
       local, and on the attack path it has already been copied into
       `pend` — so each caller says how to apply it. */
    const runWayConds = (nn, grantGa) => {
      for(const {cond, op} of fx.conds){
        if(!/^way:/.test(cond)) continue;
        if(!thisWayMet(cond, {disc: nn._discWay, dmg: nn._dmgWay, ars: nn._arsWay,
                              took: nn._tookWay, fused})){
          nn = L(nn, `${card.name}: nothing matching happened this way — the bonus skips.`);
          continue;
        }
        if(op[0] === "ga"){ grantGa(); nn = L(nn, `${card.name}: it happened this way — go again.`); }
        else nn = runOps(nn, [op], card.name);
      }
      return nn;
    };

    /* THE ARSENAL FACE-UP PUT, AS ONE BODY CALLED FROM BOTH BRANCHES.

       It used to live inside `if(attacking)` alone — and NOT ONE CARD IN
       THE POOL THAT PRINTS IT IS AN ATTACK. Measured: three distinct
       cards set `fx.arsenalPut`, and all three are non-attacks (Call in
       the Big Guns, a Ranger Action; Bull's Eye Bracers, Arms equipment;
       Death Dealer, a Bow). So the whole v2.33/v2.34 face-up mechanism —
       `_faceUp`/`_upTurn`, `arsenalUp`, the Bracers' `arsStamp` — was
       built, drilled, documented as live, and unreachable from `execute`.

       THIS IS v3.20's BUG, VERBATIM, ONE MECHANIC OVER. Its note says it
       in as many words: "the only queue site was inside `if(attacking)`
       while every card that needed it was a non-attack". A fix written
       for one mechanic is not a fix for the shape, and the shape is what
       recurs — v3.43's rule that a guard belongs to the SHAPE, not to the
       version that wrote it.

       KEPT AS TWO CALL SITES RATHER THAN MOVED, following the `optCost`
       precedent: an attack that printed an arsenal put would work, and
       there is still exactly one body deciding what the put does. The
       else-branch is why this cannot be two copies — it is the line that
       tells the player their arsenal was full, and a second copy of a
       message is a second copy of a rule. */
    const arsPutQueue = (nn) => {
      if(!fx.arsenalPut) return nn;
      if(fx.arsenalPut.needEmpty ? arsEmpty(act(nn)) : arsFree(act(nn)) > 0){
        nn.promptQ = [...(nn.promptQ||[]), {
          tag:"pick", side:actorOf(nn), src:card.name,
          zone:"hand", to:"arsenal", filter:fx.arsenalPut.filter, min:0, max:1,
          ops:fx.arsenalPut.ops, arsStamp:fx.arsenalPut.stamp, faceUp:true,
          title:"Put an arrow face up in your arsenal?",
          hint:"Optional — it goes FACE UP, so its arsenal trigger fires."}];
        return nn;
      }
      return L(nn, fx.arsenalPut.needEmpty
        ? `${card.name}: it needs an empty arsenal — the rest of the card still resolves.`
        : `${card.name}: your arsenal is occupied — the rest of the card still resolves.`);
    };
    if(attacking){
      /* Declaration-time ops. An attack's own ops normally wait for
         resolveStack, but a reveal that changes THIS attack's power has to
         happen before the total is struck — Ravenous Rabble reveals, then
         drops by the revealed card's pitch. Excluded from pend.ops below so
         they cannot fire twice. */
      actMut(n).hist = {...act(n).hist, atkNames:[...(act(n).hist.atkNames||[]), norm(card.name)]};
      /* a queued "next <named> card you play gains +N" */
      if(act(n).namedBuff && act(n).namedBuff.name === norm(card.name)){
        n._condSelf = (n._condSelf||0) + act(n).namedBuff.amount;
        n = L(n, `${card.name} was primed — +${act(n).namedBuff.amount} power.`);
        actMut(n).namedBuff = null;
      }
      const declOps = fx.ops.filter(o=>o[0]==="reveal"||o[0]==="revPitch"||o[0]==="revColorPitch");
      if(declOps.length) n = runOps(n, declOps, card.name);
      /* RULING (Overblast): +1 per boost already made on this combat chain */
      const pb = fx.ops.filter(o=>o[0]==="perBoost").reduce((a2,o)=>a2+o[1],0);
      if(pb){ const add = pb*(n.boostChain||0);
        n._condSelf = (n._condSelf||0)+add;
        n = L(n, `${card.name}: ${n.boostChain||0} boost${(n.boostChain||0)===1?"":"es"} on this chain — +${add} power.`); }
      /* qualified buffs only apply to an attack the printed restriction
         allows — qualMatches reads printed fields and printed keyword
         lines, never free rules text.

         TWO OF THE ATOMS ARE ABOUT THE PLAY, NOT THE CARD (v3.31), so
         they are handed in from here: Scout the Periphery restricts to an
         attack "you play FROM ARSENAL" and Re-Charge! to one "YOU BOOST",
         and neither is knowable from the card alone. A caller that does
         not say answers no and the buff waits — the same direction
         `defendValue` takes with an absent condition. */
      /* `atk: true` — THIS PLAY IS AN ATTACK, which is the branch we are
         in (`attacking`, above). A qualifier that names one asks the
         CALLER rather than re-deriving it from the card, because a
         weapon's type line carries no "Attack" (v3.43). */
      const qCtx = {from, atk: true, boosted: isBoostPlay(n, card)};
      const qBuff = (act(n).buffQ||[]).filter(b=>qualMatches(b.q, card, qCtx)).reduce((a2,b)=>a2+b.amt,0);

      /* A GRANT THAT DOES NOT MATCH IS NOT SPENT, IT WAITS (v2.30) —
         unless the printed line named YOUR NEXT ATTACK and the qualifier
         is a condition on it (`once`, v4.12). Flying High's red printing
         hands the go again to a red attack and the +1 to nobody; kept,
         it would wait for a blue attack the sentence never named. */
      const qKept = (act(n).buffQ||[]).filter(b=>!b.once && !qualMatches(b.q, card, qCtx));
      /* AND ANY ABILITY THOSE BUFFS GRANTED comes with them. Warrior's
         Valor's `and "When this hits, it gets go again."` belongs to the
         attack that collects the pump, so it is gathered here, from the
         entries that actually matched, and joins this attack's own on-hit
         ops below. A buff that did NOT match keeps its rider and waits. */
      const _qr = (act(n).buffQ||[]).filter(b=>b.rider && qualMatches(b.q, card, qCtx));
      const qRider = _qr.reduce((a2,b)=>a2.concat(b.rider.onHit||[]), []);
      /* AND WHOSE HIT IT ASKS ABOUT COMES WITH IT (v3.45). Yo Ho Ho!
         grants "When this hits a HERO, create a Gold token"; landing that
         on an ally hit is the same bug one grant further out. */
      const qRiderHero = _qr.reduce((a2,b)=>a2.concat(b.rider.onHitHero||[]), []);
      /* AND A GRANTED RIDER MAY CARRY A GATE (v3.95). Loot the Arsenal and
         Loot the Hold each grant a TWO-SENTENCE ability whose second half
         is conditional on the first having taken something — so the grant
         rides as `condOnHit` entries, the shape `fx.condOnHit` already
         uses, and is re-checked at the hit rather than at declaration. */
      const qRiderCond = _qr.reduce((a2,b)=>a2.concat(b.rider.condOnHit||[]), []);
      if(qRider.length) n = L(n, `${card.name} carries a granted ability into the chain.`);
      /* what a face-up arsenal trigger stamped on this card, and only for
         the turn it was stamped — "this turn" is printed on the arrow. */
      const arsPow = (card._arsPow && card._upTurn === n.turn) ? card._arsPow : 0;
      /* AND WHAT A BANISH-RIDER STAMPED ON IT (v3.92) — Mounting Anger's
         "it gets +1{p}", which belongs to the BANISHED card rather than
         to the attack that banished it (v2.29's pin).

         TWO GRANTS FROM ONE PRINTED SENTENCE EXPIRE BY ONE RECORD. The
         arsenal stamp above carries its own `_upTurn` because an arsenal
         card genuinely survives to later turns; this one does not need a
         twin, because the SAME sentence prints "and you may play it this
         turn" and `playableFromZone` refuses the card from banish on any
         other turn. Measured over all 797 records: four read the banish
         zone and not one returns a card from it to hand, so there is no
         route by which the pump could outlive `_playTurn`.

         A second turn record beside it would be v3.77's dead guard — and
         it could not be applied consistently anyway, because the cost
         half of the same rider is read by `effCost`, which is called from
         twenty sites and is handed no turn. One record, both halves. */
      const banPow = card._banPow || 0;
      /* "it gets -N{p} unless you pay {cost}" (Look Tuff). This is a
         declare-time decision, before the total below is struck — the same
         timing wall Charge and Fusion hit, so it gets the same honest
         approximation: auto-pay when it's affordable (a real prompt drains
         only after resolution, too late to change THIS attack's own
         total), else eat the penalty. */
      const payOrLose = fx.ops.find(o=>o[0]==="payOrLose");
      let payPenalty = 0;
      if(payOrLose){
        const [,penAmt,cost] = payOrLose;
        if(act(n).res >= cost){ actMut(n).res -= cost; n = L(n, `${card.name}: paid ${cost} — the ${penAmt}{p} penalty is avoided.`); }
        else { payPenalty = -penAmt; n = L(n, `${card.name}: can't pay ${cost} — takes -${penAmt}{p}.`); }
      }
      /* FRAILTY IS NARROW, AND THE SCOPE IS PRINTED ON THE TOKEN (v3.09):
         "Attack action cards you've played FROM ARSENAL and your WEAPON
         attacks get -1{p}." An attack action from hand is untouched.

         The `fra` counter this replaces shaved ANY incoming swing, which
         is a blanket debuff where the card prints two narrow cases —
         stronger than printed, and the direction that steals games. It is
         read off the board here, the same way `frostCount` is read inside
         `effCost`, because the token sits with the hero it weakens. */
      const frail = frailtyCount(act(n));
      const frailPen = (frail && (from==="weapon" || (from==="arsenal" && isAttack(card)))) ? -frail : 0;
      if(frailPen) n = L(n, `Frailty saps ${card.name} by ${-frailPen}{p} — ${from==="weapon"?"a weapon attack":"an attack action from arsenal"}.`);
      /* ---- ARAKNI'S CLAUSE 1 (v3.75) --------------------------------
         "Your attacks with STEALTH that are attacking a MARKED hero get
          +1{p} and \"When this hits, this gets go again.\""

         THREE GATES, ALL SETTLED AT DECLARATION — which is why this is
         not a late condition (v3.71): the mark is already on the opposing
         hero, stealth is a printed fact, and the attack-target is the
         caller's answer, taken at the top of `execute`.

           printedKw   the card CARRIES stealth as printed rules text.
                       Measured: 18 pool cards print it, 7 more only NAME
                       it (Night's Embrace, Stalker's Steps, Stains of
                       the Redback…) and NOTHING in the pool grants it, so
                       `hasKw` would hand the bonus to seven cards that do
                       not have the keyword — v2.84's three questions.
           foe.marked  the mark is on the hero being attacked
           heroTarget  CR 1.4.5 — an attack on an ALLY is not attacking a
                       hero at all, marked or otherwise (v3.46)

         THE RIDER IS AN ON-HIT `ga`, joined into `pend.onHit` beside the
         other granted riders. `runOps`' `ga` sets `_gaGrant` and
         `linkPayload` folds it onto the link, so BOTH boards carry it —
         and it fires only on a hit, which is what "when this hits" says. */
      const _sm = bAct(n).stealthMarkedBuff || 0;
      let smBuff = 0, smRider = [];
      if(_sm && printedKw(card, "stealth") && foe(n).marked && heroTarget){
        smBuff = _sm; smRider = [["ga"]];
        n = L(n, `${card.name} strikes from stealth at a marked hero — +${_sm} power, and go again if it lands.`);
      }
      const bonus = (fx.self||0)+(n._condSelf||0)+act(n).buffNext+qBuff+arsPow+banPow+payPenalty+frailPen+smBuff;
      /* +1{p} COUNTERS ARE PART OF THE WEAPON'S POWER, not a bonus on the
         swing. They sit on the piece and travel between turns, so a
         counter-bearing blade is simply a bigger weapon — which is what
         makes "base {p}" checks elsewhere read it too. Counters only ever
         land on a permanent, so this is asked of the weapon route alone. */
      /* AN AURA CARRIES ITS COUNTERS THE SAME WAY A WEAPON DOES (v3.84).
         `ctrPut`'s candidate scan has covered the BOARD as well as the
         gear since v3.55, and Enigma's deck is where those counters come
         from — Astral Etchings, Uphold Tradition and Spectral
         Manifestations all put +1{p} on an aura with ward. */
      const powCtr = (from==="weapon" || from==="aura")
        ? ((act(n).counters[card.uid]||{}).pow||0) : 0;
      /* AN AURA'S BASE {p} IS ITS WARD (v3.84). The card prints no power
         at all — Spectral Shield's whole text is "Ward 1" — so reading
         `card.power` gives 0 and every Spectral Shield swings for
         nothing, which is what a 0-power weapon looked like before v3.83
         routed it away. The number comes from the grant, which read it
         off the aura's own printed keyword line. */
      const base = card._powBoost ? (1 + (n.boostChain||0))
                 : _auraAtk ? _auraAtk.power + powCtr
                 : (card.power||0) + powCtr;
      let total = base + bonus;
      if(powCtr) n = L(n, `${card.name} carries +${powCtr}{p} in counters — it swings at ${base}.`);
      /* a qualified buff that did NOT match is not spent — it waits for an
         attack it actually applies to */
      actMut(n).buffNext = 0; actMut(n).buffQ = qKept; delete n._condSelf;
      /* CLEARED TO `false`, NOT DELETED, AND WRITTEN THROUGH `actMut`.
         Both of these broke two standing rules on one line each:

           `delete` removed a field `makeSide` DECLARES, so the two seats
           stopped declaring the same shape — `SIDES-ASYMMETRIC`, which is
           an error-severity invariant and the thing that says a second
           human cannot occupy a seat. It never fired because nothing at
           the table could reach these lines until judge.js learned to
           activate an ability (v3.04); the trainer's own rite path hid it
           because `withPriority`/`setG` rebuild the side anyway.

           And they wrote through `act()`, which READS. The side object is
           the very one React already rendered — `{...s}` is shallow — so
           the write reaches back into a previous state. That is the access
           rule CLAUDE.md spends a section on, in the file that should be
           the last place to break it. */
      if(act(n).gaNext){ ga = true; actMut(n).gaNext = false; n = L(n, "The rite empowers this swing — go again."); }
      /* AND ANY ABILITY THE GRANT CARRIED comes with it (v3.42) — Avast
         Ye!'s "…gets go again and \"When this hits a hero, create a Gold
         token.\"" `qRider` above gathers the same shape off `buffQ`; this
         is its `gaNextQ` twin, joined into the same `pend.onHit` below so
         neither list has to know the other exists. */
      let gaRider = [], gaRiderHero = [];
      { const _gq = takeGaNext(n, card, qCtx);
        if(_gq){ ga = true; n = L(n, `${card.name} is what that grant was waiting for — go again.`);
          if(_gq.rider){
            gaRider = _gq.rider.onHit || [];
            gaRiderHero = _gq.rider.onHitHero || [];
            if(gaRider.length || gaRiderHero.length)
              n = L(n, `${card.name} carries a granted ability into the chain.`); } } }
      /* THE DEFENDER CAP RIDES ON `pend` (v3.64), taken here for the same
         reason `takeGaNext` is: the grant names "your NEXT attack", and
         this is the play that either matches it or does not. It goes onto
         the link because the WALL is built from `pend` on both boards, and
         `parser.defCap` is the one reader that combines it with the card's
         own dominate. */
      /* THE CARD'S OWN DOMINATE IS FOLDED IN HERE, NOT LEFT TO THE WALL
         (v3.71). `parser.defCap` merges a held grant with the card's
         printed keyword, and BOTH walls call it — but judge.js calls it
         with no `kwGrant`, and `_kwGrant` is resolution-scoped, so a
         dominate the card was GRANTED rather than printed reached the
         trainer's wall and never the table's. Pulping is the pool's only
         such card ("if a card with 6 or more {p} is discarded this way,
         this gets dominate") and its restriction was silently dropped at
         the table for as long as the table has resolved card text.

         Folding it onto `pend` is idempotent for a card that PRINTS
         dominate — the wall re-reads the same card and takes the tightest
         of two identical caps — so this adds the granted case and changes
         nothing else. Declaration is the only moment both facts exist. */
      /* THE MESSAGE BELONGS TO THE TAKEN GRANT, NOT TO THE MERGED CAP.
         Folded together, an attack that simply PRINTS dominate announced
         itself as "what that restriction was waiting for" — a feed line
         about a grant that never existed, which is the sev-2 category the
         player trusts. Two names, two facts. */
      const _held = takeDefCap(n, card, qCtx);
      if(_held) n = L(n, `${card.name} is what that restriction was waiting for — no more than ${_held.n} ${_held.count==="nonBlock"?"non-block":"hand"} card${_held.n===1?"":"s"} may defend it.`);
      const _cap = defCap(card, _held, {kwGrant: n._kwGrant});
      const runeOnHit = act(n).runeHitNext || 0; if(runeOnHit) actMut(n).runeHitNext = 0;
      /* Verse counters unwind into runechants. The new runechants are minted
         AFTER the board is rebuilt, not during — mkRune appends to the board
         and doing it inside the walk would be clobbered by the rebuild. */
      { const nb=[]; let verseRunes=0; act(n).board.forEach(b=>{ const vtx=(b.card.tx||"").toLowerCase();
          if((b.verse||0)>0 && b.verseTurn!==n.turn && /remove a verse counter[^.]{0,40}create a runechant/.test(vtx)){
            verseRunes++; const e={...b, verse:b.verse-1, verseTurn:n.turn};
            n=L(n,`${b.card.name}: a verse counter unwinds into a Runechant (${e.verse} verse left).`);
            if(e.verse>0) nb.push(e); else n=L(n,`${b.card.name} spends its last verse and fades.`);
          } else nb.push(b); }); actMut(n).board=nb; if(verseRunes) n = mkRune(n, verseRunes); }
      if(fx.addCost && fx.addCost.discard && act(n).hand.length){
        const _pc = payAddCost(n, card, fx); n = _pc.game;
        const bigDiscard = _pc.discarded.some(c2=>pow6(c2, bAct(n)));
        fx.conds.filter(x=>x.cond==="discard6"||x.cond==="discard6way").forEach(({op})=>{
          if(bigDiscard){ if(op[0]==="ga") ga=true; else n=runOps(n,[op],card.name); n=L(n,`${card.name}: a 6+ power card was fed to the cost — bonus triggers.`); }
          else n=L(n,`${card.name}: nothing 6+ power discarded — bonus skips.`);
        });
      } else if(fx.conds.some(x=>x.cond==="discard6"||x.cond==="discard6way")){
        n=L(n,`${card.name}: no additional-cost discard to feed — bonus skips.`);
      }
      let declNote = "";
      if(isBoostPlay(n, card)){
        const top = act(n).deck[0];
        actMut(n).deck = act(n).deck.slice(1); actMut(n).banish = [...act(n).banish, top];
        n.boostChain = (n.boostChain||0)+1;
        const mech = /mechanologist/i.test(top.tt||"");
        if(mech) ga = true;
        declNote += ` Boost: ${top.name} banished${mech?" — Mechanologist, go again!":"."}`;
        /* "WHEN THIS IS BANISHED FROM BOOSTING, …" (v3.56) — a trigger that
           fires from the DECK, on a card its controller never played.
           Three pool records print it and their payload has read since
           v3.55; this is the schedule that was missing.

           IT IS THE BANISHED CARD'S TRIGGER, NOT THE PLAYED CARD'S, so it
           is parsed off `top`. Reading it off `card` would fire Big
           Bertha's counter every time Big Bertha was BOOSTED WITH, which
           is the opposite card.

           THE ACTOR IS ALREADY RIGHT: the card came off this seat's deck
           and "a Hyper Driver you control" is this seat's, so no seat is
           borrowed. Run AFTER the banish and the chain increment, because
           the trigger is printed about a boost that has happened. */
        const bb = (fxParse(top).boostBanish) || [];
        if(bb.length){
          n = runOps(n, bb, top.name);
          declNote += ` ${top.name}'s boost trigger fires.`;
        }
      }
      /* MANDIBLE CLAW'S RIDER IS THE PARSER'S NOW (v3.58). It used to be
         an inline regex here — one card special-cased by name, with the
         two other pool weapons printing the same shape unread, and a
         `noop` in `classifyClause` whose reason pointed at this line.
         `fx.conds` carries it with `wpnOnly`, so the existing gate
         machinery applies it at the swing. */
      if(from==="weapon" && card.addRust){ const cur=(act(n).counters[card.uid]||{}); actMut(n).counters={...act(n).counters,[card.uid]:{...cur,rust:(cur.rust||0)+1}}; declNote += ` Rust counter placed — now ${(cur.rust||0)+1}.`; }
      if(from==="weapon" && card.needSteam){ const cur=(act(n).counters[card.uid]||{}); actMut(n).counters={...act(n).counters,[card.uid]:{...cur,steam:Math.max(0,(cur.steam||0)-1)}}; declNote += ` Steam counter spent.`; }
      /* WHERE A DECLARED ATTACK LIVES IS THE CALLER'S (v2.77) — the same
         split `dummyDefence` went through in v2.73, and for the same
         reason. This used to file the card here, at DECLARATION, which is
         one board's answer to "what happens next" rather than anything
         the card does: the trainer has no combat chain to hold a card, so
         the graveyard was the only zone available to it.

         CR 7.x puts a declared attack ON THE COMBAT CHAIN until the chain
         link resolves. judge.js models that as a real zone (`chainCards`,
         censused by invariants.js) and files at the close step; the
         trainer files immediately and is unchanged to the character.
         `fileAttack` is the ONE copy of where it goes, so neither caller
         gets to invent a destination. */
      /* `from` rides on the pend because "when a WEAPON you control hits" is
         a question only the resolution can ask, and by then the zone the
         attack was declared from is the only thing that distinguishes a
         weapon swing from an attack action card. Inferring it from the card
         at resolution would mean re-deciding a question already answered. */
      /* THEIR FIRST ATTACK THIS TURN IS WEAKER (v3.29) — Debilitate's
         crush rider, armed on the previous turn. Applied before `pend` so
         the declared total and its label agree, and SPENT so it hits the
         first attack only: a debuff that lasted the whole turn would be
         stronger than the card prints. */
      {
        const _dbf = P.nextTurnDebuff(act(n), "firstAtkMinus");
        if(_dbf > 0){
          total = Math.max(0, total - _dbf);
          let _done = false;
          actMut(n).nextTurn = (act(n).nextTurn || []).map(e => {
            if(_done || !(e && e.ready && !e.spent && e.kind === "firstAtkMinus")) return e;
            _done = true; return {...e, spent: true};
          });
          declNote += ` The crush still tells — this attack is ${_dbf} weaker.`;
        }
      }

      /* ---- THE ATTACK-PLAY AURAS FIRE HERE (v3.22) -------------------
         Before `pend`, because two of the four payloads MODIFY THE ATTACK
         — Courage's +1{p} and go again — and after `pend` the total is
         already baked into the link and its label. Runechant's arcane
         body is MOVED here rather than rewritten; it kept its own
         per-source loop, its hist credit and its win check, and a port
         that changes behaviour is wrong by definition.

         THE WEAPON HALF IS PART OF THE PRINTED TRIGGER. Runechant,
         Courage and Quicken fire on a weapon swing; the Embodiment fires
         only on an attack action card, so it must not pop for one. */
      if(atkTrigAt.length){
        /* THE ROUTE THE TRIGGER NAMES (v3.65), read off the printed
           subject rather than v3.22's single boolean. `from === "ally"`
           matches NONE of them: an ally's activated attack is neither an
           attack action card nor a weapon attack, and the old test
           (`weaponToo || from !== "weapon"`) answered TRUE for it. */
        const route = from === "weapon" ? "weapon" : from === "ally" ? "ally" : "atk";
        const fire = atkTrigAt.filter(x => (x.trig.on || []).indexOf(route) >= 0);
        if(fire.length){
          const uids = new Set(fire.map(x => x.b.uid));
          /* A token that leaves the arena ceases to exist — it is not a
             real card and never enters a graveyard. */
          actMut(n).board = act(n).board.filter(b => !uids.has(b.uid));
          let arcCount = 0, arcDmg = 0, arcName = "";
          for(const x of fire){
            for(const op of x.trig.ops){
              if(op[0] === "ga"){ ga = true; declNote += ` ${x.b.card.name} pops — the attack goes again.`; }
              else if(op[0] === "pump"){ total += op[1]; declNote += ` ${x.b.card.name} pops for +${op[1]} power.`; }
              /* FLURRY — the same mechanic Dorinthea's hero ability is,
                 and it was already built (`weaponRefresh`): lift the
                 weapon's Once-per-Turn allowance and nothing else, so the
                 extra swing walks the ordinary path and pays its printed
                 cost and an action point like any other activation. A free
                 action point here would be strictly stronger than printed.

                 "THAT WEAPON" IS LITERAL — only the piece being activated,
                 which on this route is the card in hand. `card.uid` is the
                 gear entry's own uid, which is what `weaponUsed` is keyed
                 on for a swing. */
              else if(op[0] === "wpnAgain"){
                const wu = {...(act(n).weaponUsed || {})}; delete wu[card.uid];
                actMut(n).weaponUsed = wu;
                declNote += ` ${x.b.card.name} pops — ${card.name} may swing once more this turn.`;
              }
              else if(op[0] === "arcane"){ arcCount++; arcDmg += op[1]; arcName = x.b.card.name;
                /* EACH TOKEN IS ITS OWN SOURCE — said here since v2.23, and
                   until v2.74 they were pooled into one `hp -=` because
                   there was nowhere for a prevention to stand. Now there
                   is, and the distinction is worth real life: Pyroglyphic
                   Protection prevents per SOURCE and Arcane Barrier
                   triggers per threat, so three Runechants are three
                   1-point threats a hero may answer three times, not one
                   3-point threat they answer once. Pooling them pushes
                   more damage through than the cards print. */
                n = arcaneHit(n, 1-actorOf(n), op[1], x.b.card.name); }
            }
          }
          if(arcCount){
            /* CREDIT THE HISTORY HERE, as the old hardcoded block did: the
               pop is pure and leaves the bookkeeping to whoever fired it,
               the same way runOps's `arcane` op does. Miss this and "you
               have dealt arcane damage this turn" stays false after
               Viserai's PRIMARY arcane source has just resolved. Each
               token is its own source, so N popped is N instances. */
            /* the credit is `arcaneHit`'s now — it happens only where the
               damage actually lands, so a fully prevented pop counts for
               nothing. `arcCount` still drives the message and hitSeq. */
            n.hitSeq = n.hitSeq + 1; n.lastDmg = arcDmg;
            declNote += ` ${arcCount} ${arcName}${arcCount>1?"s":""} pop for ${arcDmg} arcane`
              + `${runeCount(act(n))?` (${runeCount(act(n))} still on the board)`:""}.`;
            n = winCheck(n);
            if(n.over) return n;
          }
        }
      }
      /* AND THEY CANNOT GAIN {p} AT ALL (v3.30) — Chokeslam. LAST of the
         declaration-time modifiers, because it is a CAP: applied before
         Courage's pop or Debilitate's debuff it would be capping a number
         that is not the one being declared. Applied here AND in
         `linkPumps`, so the label on the chain is the number that
         resolves rather than a pumped one the wall quietly reduces. */
      total = capNoPump(n, card, total);

      /* WHO DECLARED IT (v3.63). `pend.by` was written by `judge.declareAttack`
         and by nothing else, so on the TRAINER it was undefined — and every
         reader of it (`atkMinus`'s hostile test, `defGA`/`defPumped`, and
         `execute`'s own attack-reaction branch) guards on `by != null`, so
         the reaction branch below was simply unreachable on that board. The
         actor at declaration IS the declarer, and judge's own `by: seat`
         comes after the spread and still wins, so this changes nothing at
         the table and makes the trainer's answer exist.

         It changes no trainer behaviour today either, and that was measured
         rather than assumed: both `hostile` tests ask `by !== actorOf(n)`,
         which was FALSE with `by` absent and is FALSE now for your own
         swing — and the dummy's swing is the `[3,4,5]` scalar on
         `n.incoming` with no pend at all. */
      /* THE PLAY CONTEXT RIDES ON `pend` (v3.87). The STANDING attack
         grants are read in `linkPumps`, not here — Night's Embrace is an
         ATTACK REACTION, so the grant it creates does not exist yet when
         the attack is declared, and reading it at declaration alone would
         make the card unable to pump the very swing it was played on.
         `qualMatches` needs the play-site facts a card cannot answer for
         itself (v3.31: which zone it came from, whether it was boosted,
         and that this play IS an attack), so the answer travels with the
         link rather than being re-derived over there — v3.24's rule about
         an argument threaded through two call sites. */
      n.pend = {card, from, by: actorOf(n), defCap: _cap || null, total, ga, _qCtx: qCtx, ops:fx.ops.filter(o=>o[0]!=="reveal"&&o[0]!=="revPitch"&&o[0]!=="revColorPitch"&&o[0]!=="payOrLose"&&o[0]!=="perBoost"&&o[0]!=="perEquipDef"&&!preRan.has(o)), onHit:[...fx.onHit, ...qRider, ...gaRider, ...smRider], onHitHero:[...(fx.onHitHero||[]), ...qRiderHero, ...gaRiderHero], condOnHit:[...(fx.condOnHit||[]), ...qRiderCond], chargedPitch, fused, lateConds:fx.conds.filter(x=>isLateCond(x.cond)), lateOps:fx.ops.filter(o=>o[0]==="perEquipDef"), runeOnHit};
      n.stack = [{k:"atk", label:`${card.name} — attack ${total}`}];
      /* ---- "WHEN THIS ATTACKS A HERO, …" FIRES AT DECLARATION (v3.46) --
         An attacks-trigger goes on the stack ABOVE the attack that
         triggered it, so it resolves FIRST — before the defend step. That
         is the same reasoning, and the same site, as the Runechant pop
         directly below; Path of Same Ends' "deal 1 arcane damage to them"
         is exactly the shape that precedent was written for.

         Gated on the ATTACK-TARGET rather than on the hit: the trigger
         fires whether or not the swing connects, but "them" is the hero
         being attacked, and against an ally there is no them. */
      if((fx.onAtkHero||[]).length){
        if(heroTarget){
          n = runOps(n, fx.onAtkHero, card.name);
          n = winCheck(n);
          if(n.over) return n;
        } else n = L(n, `${card.name} is attacking an ally — its "attacks a hero" ability does not fire.`);
      }
      /* ---- AND A BARE "WHEN THIS ATTACKS" (CR 7.2, v4.08) -------------
         Same site, same reason, and NO target gate: a bare trigger fires
         on any attack-target, which is the distinction v2.12 named and
         v3.46 built the gated list for. The payload used to ride to
         RESOLUTION in `pend.ops`, so Vexing Malice's 2 arcane landed
         AFTER the swing's own damage and Spellblade Assault's Runechants
         reached the board after the wall had been declared against an
         empty one — both real, both invisible to every tool here, and
         both WEAKER than printed in the way that matters, since the
         defender never had to answer them.

         `parser.DECL_OPS` decides which kinds get here, and its header
         names the reason each of the others stays behind. */
      if((fx.onAtk||[]).length){
        n = runOps(n, fx.onAtk, card.name);
        n = winCheck(n);
        if(n.over) return n;
      }
      /* THE ATTACK BRANCH'S LATE PASS (v3.62). Path of Same Ends prints
         "when this attacks a hero, deal 1 arcane damage to them. If damage
         is dealt this way, this gets go again" — so the question can only
         be answered after `onAtkHero` above has actually run.

         `pend` WAS BUILT BEFORE THIS POINT, and it already carries a copy
         of `ga`. Setting the local alone would be a grant the resolution
         never sees, so the grant goes to BOTH — the local for anything
         downstream that still reads it, and `pend.ga`, which is what the
         chain link resolves on. */
      n = runWayConds(n, () => { ga = true; if(n.pend) n.pend = {...n.pend, ga: true}; });
      /* ---- RUNECHANTS POP HERE, AT DECLARATION ------------------------
         The token triggers "when you play an attack action card or activate
         a weapon attack", and a triggered ability goes onto the stack ABOVE
         the attack that triggered it — so it resolves FIRST, before the
         defend step. That is why this is here and not in resolveStack,
         where the arcane damage used to land after the attack's own damage.

         `atkTrigAt` is the firing set captured before this card did
         anything, so a runechant this attack conjured is not among them —
         it is popped BY UID, because the board is about to change
         underneath this. Each token destroys itself and deals its own
         damage, and there is no "you may" in the text — all of them,
         mandatorily. */
      /* THE HARDCODED RUNECHANT POP THAT USED TO SIT HERE IS GONE
         (v3.22). It matched the token BY NAME and fired after `pend`,
         which is why the three other tokens printing the identical
         trigger were never built and why a payload that modifies the
         attack had nowhere to land. Its body moved up to the general
         site above, unchanged in what it does. */
      /* intimidate resolves on the attack, before defenders are declared —
         it really does strip a card off the dummy now */
      /* RULING 2026-07-25: intimidate picks a card from the opponent's hand
         at RANDOM, banishes it face-down, and returns it to their hand at the
         beginning of the end phase. It is a tempo tax for one turn, not a
         permanent loss — my first pass banished it forever. */
      /* OPTIONAL COST on attack — "you may banish an aura from your
         graveyard. If you do, deal 1 arcane damage." (v2.28)

         QUEUED, never opened inline: the attack has to finish resolving
         first, and openPrompt drains the queue at the tail of execute.
         `min:0` is what makes it declinable, and prompts.js only returns
         the rider's ops when cards actually moved — decline and the
         payload does not fire, which is the v2.04 rule.

         The prompt is addressed to the ACTOR, so it asks whoever is
         swinging rather than always seat 0. buildPrompt returns null on
         an empty zone, so a cost you cannot pay politely skips itself. */
      /* "You may put an arrow from your hand face-up into your arsenal."
         RULING (user, 2026-07-28): the card's OTHER effects resolve either
         way — only the put is skipped when there is no free slot. Arsenal
         capacity is normally 1 and can be 2 with New Horizon, which is not
         in this pool; ARS_CAP is the seam rather than a hardcoded 1.
         `min:0` keeps it optional, and buildPrompt returns null on an empty
         hand so a put with nothing to put skips itself. */
      n = arsPutQueue(n);
      /* THE `play` TRIGGER JOINS `attacks` (v3.18). Condemn to Slaughter
         prints its optional cost with no trigger prefix at all, so it is
         offered when the card is played. `hits` and `defends` are still
         unwired; the parser names which in `fx.optCost.trigger`, so each
         remaining one is a queue site rather than new machinery. */
      /* THIS SITE IS INSIDE `if(attacking)`, which is the whole of v3.18's
         defect — see the non-attack site below. `entersLeaves` is
         deliberately NOT listed here: a card that enters the arena is a
         permanent, and a permanent never reaches this branch. */
      if(fx.optCost && (fx.optCost.trigger === "attacks" || fx.optCost.trigger === "play")){
        n.promptQ = [...(n.promptQ||[]), optCostSpec(fx.optCost, card, actorOf(n), false)];
      }
      /* THE MODAL OPTIONAL COST, ON THE ATTACK ROUTE (v3.90) — Jittery
         Bones. Its sibling Washed Up Wave prints the identical cost on
         the `defends` trigger and is queued in `afterDefenders`; one
         reader, two sites, exactly as `optCost` keeps. */
      if(fx.millCost && fx.millCost.trigger === "attacks"){
        n.promptQ = [...(n.promptQ||[]), millCostSpec(fx.millCost, card, actorOf(n))];
      }
      if(hasKw(card,"intimidate") && foe(n).hand.length){
        /* SEEDED: which card intimidate strips is hidden information in a
           real game, so it MUST come from the shared stream — two peers
           rolling it independently would diverge on the spot. */
        const _ip = rngInt(n.rng, foe(n).hand.length); n.rng = _ip.rng;
        const pick = _ip.v;
        const lost = foe(n).hand[pick];
        foeMut(n).hand = foe(n).hand.filter((_,i)=>i!==pick);
        foeMut(n).intimidated = [...(foe(n).intimidated||[]), lost];
        declNote += ` Intimidate — a card is pulled at random from ${foe(n).name}'s hand`
          + ` and banished face-down (${foe(n).hand.length} left); it comes back at the end phase.`;
      }
      /* NAME THE ATTACK YOU JUST DECLARED (v2.63). Reported from play: the
         feed showed the pitch that paid for a card and then the opponent's
         defence, with no line naming the attack itself — so the one thing
         the player actually DID was the one thing the sequence never
         mentioned. In a training sim the sequence is the lesson.
         The printed value is shown alongside whenever the total differs,
         because "6 → 8" is exactly what the player is trying to learn. */
      /* THE PRINTED VALUE OF AN AURA-AS-WEAPON IS ITS WARD (v3.84), not
         the 0 on its type line — Spectral Shield's whole text is "Ward
         1". Reading `card.power` here printed "(printed 0)" beside a
         perfectly correct 1, which is the feed teaching the player that
         something added a point that never did. */
      const _printed = _auraAtk ? _auraAtk.power : (card.power || 0);
      /* seat 0 is called "You", so the verb has to agree with it */
      const _s = /^you$/i.test(act(n).name || "") ? "" : "s";
      /* AND AN AURA IS ACTIVATED, NOT PLAYED. It is already on the board;
         "plays" is the verb for a card leaving a hand. */
      n = L(n, `${act(n).name} ${from==="weapon" ? "swing"+_s : from==="ally" ? "send"+_s
                                : from==="aura" ? "turn"+_s : "play"+_s} ${card.name}`
             + (from==="aura" ? " on them — a ward made a weapon," : " —")
             + ` ${total} power on the chain`
             + (total !== _printed ? ` (printed ${_printed})` : "")
             + (ga ? ", and it goes again" : "") + ".");
      /* THE DECLARATION ENDS HERE (v2.73).

         This used to call `dummyDefence` inline and then set `mode:"stack"`
         — so `execute` did two jobs at once: it applied the card's effect
         AND advanced the turn structure. That is the knot the whole Phase 1
         rebuild names, and it is why the table could never call this: the
         trainer's defend step is a dummy picking blocks, and `judge.js`
         drives combat through `phase`/`step`/`chainCards` instead.

         The attack is on the chain and awaiting defenders. WHOSE defenders,
         and how they are chosen, is the caller's business; `_declared`
         carries everything the caller needs to run its own defend step and
         to hand the state back for `afterDefenders`. */
      n._declared = {card, total, declNote};
      return n;
    } else {
      if(card._buildSteam){ const tgt=card._steamFor, cur=(act(n).counters[tgt]||{}); if((cur.steam||0)===0){ actMut(n).counters={...act(n).counters,[tgt]:{...cur,steam:1}}; n=L(n,`${card.name.replace(" — build steam","")}: steam counter built.`); } else n=L(n,"It already carries a steam counter."); }
      if(fx.addCost && fx.addCost.discard && act(n).hand.length){
        n = payAddCost(n, card, fx).game;
      }
      /* the same gap on the non-attack side: the effects were logged, the
         PLAY was not, so a card that resolved to nothing visible left no
         trace of having been played at all */
      n = L(n, `${act(n).name} ${/^you$/i.test(act(n).name||"") ? "play" : "plays"} ${card.name}${from==="weapon"||from==="hero"||from==="board" ? " — activated" : ""}.`);
      /* AN ACTIVATED ATTACK-REACTION ABILITY RESOLVES ONTO THE OPEN LINK,
         SO ITS OPS ARE NOT RUN HERE (v3.63). `attackRx` runs them itself,
         against the attack the ability names — running them here as well
         would be VALUE-DOUBLED on the fairness sweep's own terms, and
         running them here INSTEAD would fire Prey Spotters' mark with no
         target check and Stalker's Steps' go again onto the card's own
         (nonexistent) attack. One place, and it is the one that knows
         what the link is. */
      /* A PLAYED ATTACK REACTION IS THE SAME CASE (v3.89), and it is a
         PREDICATE rather than a result: this line runs BEFORE the branch
         that calls `attackRx`, so "did it route" has to be answerable
         here. Driven: Night's Embrace landed its standing grant TWICE the
         moment the routing below stopped asking for a pump.

         A REFUSAL INSIDE `attackRx` STILL DROPS THEM, which is what the
         TRAINER does — `playRx` returns on `rx.why` with the card already
         spent — and `judge.legal`'s `rxTargetWhy` refuses an illegal
         target before the card ever leaves the hand, so the only way to
         reach that refusal is a stale action off the wire. */
      n = runOps(n, _rxRoute ? [] : fx.ops.filter(o=>!insteadKinds.has(o[0]) && !preRan.has(o)), card.name);
      /* ---- "IF THIS DEALS DAMAGE, YOU MAY {t} YOUR HERO" (v3.91) -----
         Turn to Mindfire, and the offer can only be made once the card's
         own ops have run — `_dmgWay` is set inside `arcaneHit`'s
         `left > 0` branch, so a hit turned entirely aside by a barrier or
         a ward offers nothing at all (CR 7.5.5, without restating it).

         A TAPPED HERO CANNOT PAY IT AGAIN (v3.48's ruling is exactly that
         narrow), so an already-tapped hero is never offered the sheet —
         a choice with no legal answer is a tap that teaches nothing.

         `cost: 0` because the price is the TAP, not resources — the same
         reason a counter cost and a soul banish both read cost 0. */
      if(fx.tapCost && fx.tapCost.when === "dealt"
         && (n._dmgWay || 0) > 0 && !act(n).heroTapped){
        n.promptQ = [...(n.promptQ||[]), {
          tag: "pay", side: actorOf(n), src: card.name, cost: 0,
          tapHero: true, ops: fx.tapCost.ops,
          title: "Tap " + act(n).name + " to power " + card.name + "?",
          hint: "The cost is the tap itself — your hero stays tapped until your untap step."}];
      }
      /* ---- THE LATE CONDITION PASS (v3.60) ---------------------------
         "…this way" asks what THIS card's own resolution just did, so it
         can only be answered here — after `fx.ops` have run. The main
         condition loop above fires before them and skips these on
         purpose.

         `pend.lateConds` is the precedent on the ATTACK path (`defLt2`,
         `pumped`, settled in `linkPumps`); this is its non-attack twin,
         and it is deliberately the narrower of the two: an attack's ops
         ride to resolution, so a this-way condition on an attack card is
         a different problem and is left refusing rather than half-built.

         AN UNKNOWN `way:` CONDITION ANSWERS FALSE (v3.26's rule), which
         leaves the card at its printed value — weaker than printed and
         visible, where the other direction grants a bonus nobody built. */
      n = runWayConds(n, () => { ga = true; });
      if(n._gaGrant){ ga = true; delete n._gaGrant; }
      /* ELOQUENCE — THE POP SITE'S SIBLING (v3.65). The attack branch has
         had one since v3.22 and this branch had none, so a token whose
         trigger is "when you play a NON-ATTACK action card" could never
         fire. That is v3.53's shape exactly: a site inside `if(attacking)`
         and a card that never attacks.

         `atkTrigAt` is captured at the top of `execute` for both branches
         and for the same reason — the auras that trigger are the ones in
         the arena at this instant, so one this card itself conjures was
         not there when it was played.

         MEASURED: the only payload a `nonAtk` trigger can carry is go
         again. The parser matches the payload's SUBJECT against the
         trigger's, so "the card gets go again" is the one shape that
         parses on this route; a pump or an arcane names "the attack" and
         refuses. A drill pins that measurement, so a token printing
         something else fails it rather than quietly doing nothing here. */
      { const fire = atkTrigAt.filter(x => (x.trig.on || []).indexOf("nonAtk") >= 0);
        if(fire.length && !isAttack(card)){
          const uids = new Set(fire.map(x => x.b.uid));
          /* a token that leaves the arena ceases to exist */
          actMut(n).board = act(n).board.filter(b => !uids.has(b.uid));
          for(const x of fire) for(const op of x.trig.ops){
            if(op[0] === "ga"){ ga = true; n = L(n, `${x.b.card.name} pops — ${card.name} goes again.`); }
          }
        } }
      /* AN ATTACK REACTION PUMPS THE ATTACK IT IS PLAYED ON, NOT THE NEXT
         ONE (v3.11). Falling through to `buffNext` is how the table came to
         hand Dorinthea's whole reaction game to her FOLLOWING swing — and
         to say so in the feed, confidently, while the current attack
         resolved for its base. 14 pool cards across four heroes.

         The pend must be the ACTOR'S OWN (CR 8.1.2a: an attack reaction is
         played by the player who controls the attack), which is the same
         ownership test `atkMinus` and the Traps make. Without a live pend
         there is nothing to react to, so the printed `buffNext` reading
         stays as the honest fallback rather than the card doing nothing. */
      /* THE SAME RESOLUTION, REACHED BY ACTIVATION RATHER THAN BY PLAY
         (v3.63). Six pool records print "Attack Reaction - <cost>:" as an
         ACTIVATED ability, and until now `parseHeroPower`'s unanchored
         match read the `action` inside RE-ACTION and built them as
         action-speed abilities — offered in the action phase, resolving
         with no link to target. Three were live and wrong; the other three
         refuse for their own reasons (see the parser).

         The powCard's `tt` is "Equipment Ability", so `isAR` is FALSE for
         it and the branch above can never claim it — the flag is the
         window, exactly as `_instant` is. And there is no `fx.self` test:
         these grant `mark` and go again rather than a pump, and requiring
         a pump is what makes the branch above an attack-reaction CARD's. */
      if(card._attackRx){
        if(!(n.pend && n.pend.by === actorOf(n)))
          n = L(n, `${card.name}: no attack of yours to react to.`);
        else {
          const rx = attackRx(n, card, {handBlockers: (opts && opts.handBlockers) || 0,
            /* AND WHICH CARDS THEY ARE (v3.89) — Shred targets one of
               them. Threaded from the caller, not re-derived: a body both
               boards call cannot go looking for either seat's wall.

               BOTH ROUTES CARRY IT, and one of them is LATENT: no pool
               equipment or hero ability prints Shred's shape, so
               sabotaging this on the ACTIVATED route comes back silent.
               v3.63's rule about the powCard BUILDERS, said about the
               places that FEED what they built — a drill pins the
               symmetry rather than pretending the route is covered. */
            defenders: (opts && opts.defenders) || []});
          if(rx.why) n = L(n, rx.why);
          else { n = rx.game; if(rx.pump) n = L(n, `${card.name} on the stack (+${rx.pump}).`); }
        }
      }
      /* A PLAYED ATTACK REACTION GOES TO `attackRx`, PUMP OR NO PUMP
         (v3.89). This tested `fx.self` — "does it carry an unconditional
         pump" — and SEVEN of the pool's twenty attack reactions carry
         none, so at the table they fell through to the plain resolution
         while the TRAINER routed every one of them here. v3.01's shape,
         and v3.11's own bug still live for the cards it did not measure.

         DRIVEN, both boards, same state: Ironsong Response ("Reprise - …
         target weapon attack gets +3{p}") pumps the swing by 3 on the
         trainer and by NOTHING at the table, where `execute`'s generic
         condition loop has no case for `reprise` — it needs the
         hand-blocker count, which only this route is given — and prints
         "condition not met" before dropping the pump on the floor. The
         player pays a card and a printed +3 vanishes.

         WEAKER THAN PRINTED, so the one-sided fairness sweep is blind,
         and every affected card reads `tier: full` because the clause IS
         consumed. Only driving the same card at both boards sees it.

         THE TEST IS NOW WHAT THE RULE IS: a played attack reaction, in
         the reaction window of an attack this seat controls (CR 8.1.2a).
         `_attackRx` above is the ACTIVATED twin and is already routed on
         its window rather than on its payload (v3.63) — this is the same
         correction one route over. */
      else if(isAR(card) && !isAttack(card) && n.pend && n.pend.by === actorOf(n)){
        const rx = attackRx(n, card, {handBlockers: (opts && opts.handBlockers) || 0,
            /* AND WHICH CARDS THEY ARE (v3.89) — Shred targets one of
               them. Threaded from the caller, not re-derived: a body both
               boards call cannot go looking for either seat's wall.

               BOTH ROUTES CARRY IT, and one of them is LATENT: no pool
               equipment or hero ability prints Shred's shape, so
               sabotaging this on the ACTIVATED route comes back silent.
               v3.63's rule about the powCard BUILDERS, said about the
               places that FEED what they built — a drill pins the
               symmetry rather than pretending the route is covered. */
            defenders: (opts && opts.defenders) || []});
        if(rx.why) n = L(n, rx.why);
        else { n = rx.game; n = L(n, `${card.name} on the stack (+${rx.pump}).`); }
      }
      else if(fx.self && !isAttack(card)){ actMut(n).buffNext += fx.self; n = L(n, `${card.name}: +${fx.self} power queued for your next attack.`); }
      n.featured = {card:{name:card.name,img:card.img,dbImg:card.dbImg,pitch:card.pitch,cost:card.cost,power:card.power,def:card.def,tt:card.tt}, chip:(fx.perm?"ENTERS PLAY — ":"RESOLVED — ")+(typeAbbr(card)||"effect").toUpperCase()};
      if(from==="hero" && card.sd){ actMut(n).gear = act(n).gear.map(x=> ("gp"+x.uid)===card.uid ? {...x,destroyed:true} : x); n = L(n, "The piece shatters — cost paid."); }
      /* A BOARD PERMANENT PAYING ITS OWN DESTROY COST (v2.35). Energy Potion
         and Timesnap Potion both read "Destroy this: …" and both sat inert on
         the board with no way to activate them at all — the board's onClick
         only ever opened the zoom modal for anything that was not an ally.
         The card goes to the graveyard through gy() so it is turn-stamped
         like every other path in. */
      if(from==="board" && card.sd){
        const ent = act(n).board.find(x=>("bp"+x.uid)===card.uid);
        if(ent){
          actMut(n).board = act(n).board.filter(x=>x!==ent);
          actMut(n).grave = [...gy(n.turn, ent.card), ...act(n).grave];
          n = L(n, `${ent.card.name} is destroyed — cost paid.`);
        }
      }
      if(fx.onHit.length) n = L(n, `${card.name}: on-hit clauses need an attack — skipped.`);
      /* RULING: a transcended card returns to hand as Inner Chi instead of
         going to the graveyard — undo the grave push made above. */
      if(n._transcended){ delete n._transcended; actMut(n).grave = act(n).grave.filter(x=>x.uid!==card.uid); }
      if(fx.perm){ const _vm=(card.tx||"").toLowerCase().match(/with (\d+) verse counter/);
        /* RULING: several auras scrub themselves at the top of your next turn
           (Booze!, Goon Beatdown, Pyroglyphic Protection). Carry the schedule
           on the board entry so newTurn can sweep them. */
        const _sd = n._selfDestruct || null; delete n._selfDestruct;
        /* THE COUNTER IT ENTERS WITH (v3.57), read off the stash the same
           way the destroy schedule is. Gated cards reach here only when
           `execute`'s condition loop actually ran the op, so the printed
           "if you've pitched a blue card this turn" is honoured by the op
           never being queued rather than by a second check here. */
        const _cs = n._ctrSelf || null; delete n._ctrSelf;
        if(_cs){
          const cur = act(n).counters[card.uid] || {};
          actMut(n).counters = Object.assign({}, act(n).counters,
            {[card.uid]: Object.assign({}, cur, {[_cs.kind]: (cur[_cs.kind]||0) + (_cs.n||1)})});
          n = L(n, `${card.name} enters with ${(_cs.n||1) > 1 ? _cs.n + " " + _cs.label + " counters" : "a " + _cs.label + " counter"}.`);
        }
        /* SUSPENSE ALWAYS ENTERS WITH 2 COUNTERS. RULING 2026-07-25:
           "suspense always comes in with 2 counters - that number is in
           the rules text and is the same for every suspense card". The
           database carries no reminder text for the keyword, which is
           exactly why the ruling exists; `printedKw` and not `hasKw`,
           because two pool cards only ASK whether you control an aura of
           suspense (Full of Bravado, Stand Strong). */
        const _susp = printedKw(card, "suspense") ? 2 : 0;
        actMut(n).board=[...act(n).board,{card,kind:fx.perm,spent:false,uid:card.uid,verse:_vm?+_vm[1]:0,sd:_sd,susp:_susp}]; if(fx.perm==="aura") actMut(n).hist={...act(n).hist, aura:(act(n).hist.aura||0)+1}; n=L(n,`${card.name} enters play (${fx.perm})${_vm?` with ${_vm[1]} verse counters`:""}${_susp?` with ${_susp} suspense counters — it pays out when it leaves`:""}.`); }
      else if(from==="hand"||from==="arsenal") actMut(n).grave=[...gy(n.turn, card),...act(n).grave];
      else if(from==="grave"||from==="banish") actMut(n).banish=[card,...act(n).banish];
      actMut(n).hist = {...act(n).hist, non:act(n).hist.non+1};
      n = briarLightning(n);
      /* THE OPTIONAL COST ON A NON-ATTACK (v3.20), and the reason it is a
         FIX rather than only a new site.

         The only queue site was inside `if(attacking)`. Every `play`
         trigger card in the pool is a NON-ATTACK — all three printings of
         Condemn to Slaughter — so from v3.18 until here its printed "you
         may destroy an aura you control" was never once offered at either
         board. Coverage read the card `full`, and the fairness sweep is
         one-sided toward too-strong, so neither could see it; the drills
         could not either, because they built the spec BY HAND and passed
         it to `buildPrompt` instead of driving `execute`. A drill that
         asserts against its own fixture proves the fixture.

         `entersLeaves` is offered HERE and only when the card actually
         reached the arena: the trigger is "when this ENTERS the arena",
         not "when this is played", so an aura that never got there has
         not entered anything. The LEAVES half is `sweepArena`'s. */
      if(fx.optCost && (fx.optCost.trigger === "play"
          || (fx.optCost.trigger === "entersLeaves" && fx.perm)))
        n.promptQ = [...(n.promptQ||[]), optCostSpec(fx.optCost, card, actorOf(n), false)];
      /* THE ARSENAL PUT ON A NON-ATTACK — the site that was missing, and
         the only one any pool card can actually reach. See `arsPutQueue`
         above for the measurement; this is the sibling call, placed here
         beside v3.20's for the identical reason. */
      n = arsPutQueue(n);
      /* "WHENEVER YOU PLAY AN AURA, …" (v3.33) — Magmatic Carapace.

         THE WATCHER IS NOT THE CARD BEING PLAYED. Every other trigger in
         this block asks the resolving card about itself; this one asks the
         actor's BOARD AND GEAR whether anything is watching for an aura,
         and Magmatic Carapace is a Chest piece, so a scan of the board
         alone would find nothing. Same reason `sweepArena` had to re-derive
         its teardown flags over gear as well (v3.07).

         THE TAP IS PART OF THE COST. `payCost.taps` says so, and a tapped
         permanent does not untap until CR 4.4.3d — which is what makes
         this once per turn on a card that never prints "Once per Turn".
         A piece already spent this turn is not offered. */
      if(fx.perm === "aura")
        n = offerPayCost(n, "playAura");
    }
    /* IYSLANDER, CLAUSE 2 — "Whenever you play an ICE card during an
       opponent's turn, create a Frostbite token under their control."
       One body, three callers: here, and the trainer's two bespoke
       opponent-turn routes, which reach `runOps` directly and never pass
       through `execute` at all. See `foeTurnIce`. */
    n = foeTurnIce(n, card);
    /* THE CLASS-AWARE PLAY RECORD (v3.38). `hist.non` counts non-attacks
       and records no CLASS, so "if you have played another WIZARD
       non-attack action card this turn" could not be asked at all.

       RECORDED AFTER THE CARD RESOLVES, in the same breath as `hist.non`
       above and for the same reason: "ANOTHER" must not count the card
       asking the question. The speed grant is asked at LEGALITY time —
       before the card is played — so there is no self-counting subtlety
       there either way, and this keeps both readings honest.

       THE STRUCTURED ARRAY, lowercased (v2.44). `tt` calls Den of the
       Spider an "Action Defense Reaction"; the array does not. */
    {
      const _ty = (card.ty || []).map(t => String(t).toLowerCase());
      if(_ty.length) actMut(n).hist = {...act(n).hist,
        playTy: [...(act(n).hist.playTy || []), _ty]};
    }
    const delta = preHP - foe(n).hp;
    if(delta>0){ n.chain=[...n.chain,{n:card.name,img:card.img,dbImg:card.dbImg,dmg:delta,ga,drac:/draconic/i.test(card.tt||"")||!!act(n).dracNext,kind:(isAttack(card)||from==="weapon"||from==="ally")?"atk":"arc"}]; n.hitSeq=n.hitSeq+1; n.lastDmg=delta; }
    /* THE ACTION POINT IS AN *ACTION'S* COST (CR 8.1.1 / 8.1.6 / 5.3.5).
       This used to read `ga ? keep : -1`, which charges every non-attack
       that resolves here — and an instant has no such cost, so playing one
       silently ate the turn's action. Energy Potion's "Instant - Destroy
       this: Gain {r}{r}" cost you your action to gain two resources, and
       Achilles Accelerator's "Instant - Destroy this: Gain 1 action point"
       netted to exactly nothing.

       Three rules, spelled out rather than folded into a ternary:
         8.1.1 an action card/ability has the asset-cost of 1 action point;
         8.1.6 an instant has none — it needs only priority;
         5.3.5 go again GAINS 1 action point. That is a gain, not a refund,
               so for an action it is spend-then-gain (the familiar "kept")
               and for an instant it is a genuine +1.
       For every action card this is the identical arithmetic to before. */
    /* THE NON-ATTACK HALF of the same grant. Mage Master Boots prints
       "the next NON-ATTACK action card you play this turn gets go again";
       nothing here ever asked, and the old parser handed it to the next
       attack instead. */
    { const _gq = takeGaNext(n, card, {from});
      if(_gq){ ga = true; n = L(n, `${card.name} is what that grant was waiting for — go again.`);
        /* A RIDER TAKEN HERE HAS NOWHERE TO RIDE: a non-attack settles at
           the action point and never opens a `pend`, so there is no hit
           for an on-hit ability to hang off. Unreachable for today's pool
           — the only rider-carrying grant (Avast Ye!) names an attack, and
           `atk` now enforces that — but a refusal nobody is told about is
           a lie (v3.41), so it says so rather than dropping it quietly. */
        if(_gq.rider && _gq.rider.onHit)
          n = L(n, `${card.name} isn't an attack — the granted on-hit ability has no hit to fire on.`); } }
    const apCost = P.splitCostsAP(card, _half, opts && opts.window) ? 1 : 0;
    actMut(n).ap = act(n).ap - apCost + (ga ? 1 : 0);
    if(ga) n = L(n, apCost ? "Go again — action point kept." : "Go again on an instant — an action point gained (CR 5.3.5).");
    else if(!apCost) n = L(n, `${card.name} plays at instant speed — no action point spent.`);
    return openPrompt(winCheck(n));
  };

  /* PITCHING ON DEMAND, TO COVER A COST (moved here v2.77).

     RULING (user, 2026-08-01): you cannot pitch to bank resources. The
     pool is filled only when something costs more than you hold — and
     then you may pay or decline. This is the paying half, and it moved
     out of the trainer because the PROMPT ANSWER reaches for it: a soak
     or a toll charged to a hero on someone else's turn has no other way
     to find an {r}, and a second copy of "which card do I give up" is a
     second engine's worth of judgement about the same decision.

     It spends the CHEAPEST card first, by the advisor's valuation, with
     ties broken on uid so two equal cards cannot desync two peers. It
     returns null rather than a partial payment when the cost cannot be
     reached — the caller must be able to tell "paid" from "could not",
     because forgiving an unaffordable payment hands out the effect free. */
  const autoPitch = (s, cost, keepUid) => {
    let n = {...s};
    const spendable = () => act(n).hand.filter(h=>h.uid!==keepUid);
    while(act(n).res < cost && spendable().length){
      const pool = spendable();
      const p = pool.map(h=>({h,v:advValue(h,n,{runeDmg:bAct(n).runeDmg})})).sort((a,b)=>a.v-b.v || a.h.uid-b.h.uid)[0].h;
      actMut(n).res += (p.pitch||0);
      actMut(n).pitch = [...act(n).pitch, p];
      actMut(n).hand = act(n).hand.filter(h=>h.uid!==p.uid);
      n = L(n, `Pitched ${p.name} at instant speed (+${p.pitch||0}).`);
    }
    return act(n).res < cost ? null : n;
  };

  /* ANSWERING A PROMPT (moved here v2.77).

     A quarter of the recorded rulings are the same shape — stop, show a
     side something, let them choose — and `prompts.js` is the data for
     it. What was NOT shared was the answering: this body lived inside
     `Battle` as a `setG` reducer, so a table with two seats had no way
     to resolve a sheet at all. Several cards defer their whole payload
     into the answer (`arcaneHit` rides the damage out on a soak, a
     printed "unless they pay" hangs its consequence off a toll), so an
     unanswerable prompt is not a missing UI — it is arcane damage that
     never lands and a printed cost that is never charged.

     It is more than plumbing, which is why it is here rather than
     written twice: it borrows the ACTOR to the addressed side (v2.65 —
     a payout that landed on seat 0 whoever was asked gave the player a
     free action point every game), it pitches for an unaffordable
     payment rather than forgiving it, and it does the arsenal face-up
     stamping, which is a real card rule.

     Pure `s => s'`. The caller decides what the game does next. */
  /* ---- AN ACTIVATED ABILITY ON A CARD IN HAND (v3.05) ----------------

     "Instant - Discard this: Amp 1". Four pool cards across THREE heroes
     print one — Agile Windup (Kayo), Arcane Twining and Photon Splicing
     (Iyslander), Reaper's Call (Arakni) — so it is a rule with a list
     rather than a hero's card.

     The route was built in `Battle` (v2.63) and lived there, which is why
     none of the four could be activated at the table. This is the same
     body, shared, with two deliberate changes:

       * IT ASKS THE WHOLE GATE. The trainer's version tested only
         `activateIf.kind === "defending"`, the one case its own pool card
         needed. Any other printed restriction — including v3.04's
         `unreadable` — slipped through. `activateIfOk` is the reader.
       * THE DEFENCE BUFF IS RETURNED, NOT WRITTEN. `runOps` cannot raise
         one specific defender, so a +{d} has to reach the wall through
         the caller's own per-defender map: `defBonus` in the trainer,
         and judge.js keeps its wall somewhere else. Same split as
         `linkPumps`/`linkPayload`. */
  /* Pays the printed cost, runs what `runOps` can run, and hands back the
     defence buff for the caller to route. `{game, dbuff, why}` — `why` is
     set when nothing happened, so a caller can report a refusal rather
     than silently doing nothing. */
  const activateHandAbility = (s, c) => {
    const fx = fxParse(c), ha = fx.handAbility;
    if(!ha) return {game: s, dbuff: 0, why: c.name + " prints no ability to activate"};
    if(!handAbilityOK(s, c)) return {game: s, dbuff: 0, why: c.name + "'s ability can't be activated right now"};
    let n = {...s};
    if(ha.oncePerTurn) actMut(n).hist = {...act(n).hist, handAb: {...(act(n).hist.handAb || {}), [c.uid]: 1}};
    const dbuff = ha.ops.filter(o => o[0] === "defBuff").reduce((a, o) => a + o[1], 0);
    const rest  = ha.ops.filter(o => o[0] !== "defBuff");
    let paid = [];
    if(ha.cost === "self"){
      paid = [c];
      actMut(n).hand = act(n).hand.filter(x => x.uid !== c.uid);
      actMut(n).grave = [...gyDisc(n.turn, c), ...act(n).grave];
      n = L(n, `${c.name} is discarded to pay for its own ability.`);
    } else {
      /* "Discard a card" is the player's choice, and the standing
         approximation is to auto-pick the lowest advisor value rather than
         prompt (CLAUDE.md, known approximations). A card already declared
         as a defender is committed and is not available to spend. */
      const pool = act(n).hand
        .filter(h => h.uid !== c.uid && (act(n).blockH || []).indexOf(h.uid) < 0)
        .map(h => ({h, v: advValue(h, n, {runeDmg: bAct(n).runeDmg})}))
        .sort((a, b) => a.v - b.v);
      if(!pool.length) return {game: s, dbuff: 0, why: c.name + ": nothing spare in hand to discard"};
      const pick = pool[0].h;
      paid = [pick];
      actMut(n).hand = act(n).hand.filter(x => x.uid !== pick.uid);
      actMut(n).grave = [...gyDisc(n.turn, pick), ...act(n).grave];
      n = L(n, `${c.name}: discarded ${pick.name} to activate.`);
    }
    if(rest.length) n = runOps(n, rest, c.name);
    /* the cost was a DISCARD, so everything that watches a discard sees it —
       Kayo's clause 3 among them. Never `random`: this one is chosen. */
    n = afterDiscard(n, paid, {random: false});
    return {game: n, dbuff, why: null};
  };

  /* ---- TURNING THE ARSENAL CARD FACE UP (v2.33, one body at v3.71) ----
     THE EVENT IS ONE BODY, OR IT IS NOT AN EVENT (v3.17). This was written
     inline in `applyAnswer`, which was the only site that existed while the
     only way a card reached the arsenal face-up was a `pick` from hand.
     Azalea's hero ability puts one there FROM THE DECK, and a second copy
     of the trigger walk is how one board comes to fire Swift Shot's go
     again and the other does not.

     `_upTurn` is what makes "this turn" mean this turn: the stamps expire
     with the turn if the arrow is never played.

     `stamp` is the SOURCE's own rider — Bull's Eye Bracers prints "It gains
     +1{p} until end of turn", where "it" is the arrow that was just put
     (v2.34). It STACKS with the arrow's own trigger, and the parser holds
     it back from `fx.self` precisely so it lands on the arrow rather than
     on the equipment.

     KNOWN, AND MEASURED RATHER THAN FIXED BLIND: `heave` (v3.32) is a third
     site that sets `_faceUp` and fires no trigger. It is module-level and
     returns `{game,msgs,ops}` rather than threading `n`, and Thunder Quake
     is the pool's only heave card — a Guardian/Brute action with no
     arsenal trigger of its own, in no deck that holds an arrow. Latent,
     recorded in HANDOFF.md rather than half-moved. */
  /* ---- WHAT THE ARSENAL CARD GAINS (v3.72) -------------------------
     One body for two heroes' printed sentences:

       Azalea  "If it's an ARROW, it gets dominate until end of turn."
       Bravo   "If it HAS CRUSH, it gets +2{p} and dominate this turn."

     A STAMP, NOT A REWRITE of the card's keywords, so it expires with
     `_upTurn` if the card is never played (v2.33). `execute` hands the
     keyword to `parser.defCap` at declaration and reads `_arsPow` into
     the attack's total.

     `printedKw` IS THE KEYWORD PREDICATE, not `hasKw`. "If it has crush"
     asks whether the card CARRIES the keyword as printed rules text —
     `hasKw` answers true for a card that merely mentions it, and the
     database writes a triggered keyword with its rider attached, which is
     why `printedKw` learned the dash form at v3.33. */
  function applyArsGrant(n0, grant, srcName){
    let n = n0;
    const cur = act(n).arsenal;
    if(!grant || !cur) return n;
    const what = [grant.pow ? `+${grant.pow}{p}` : null, ...grant.kw]
      .filter(Boolean).join(" and ");
    const met = grant.ifKw ? printedKw(cur, grant.ifKw)
              : grant.ifTt ? new RegExp("\\b" + grant.ifTt + "\\b", "i").test(cur.tt || "")
              : true;
    if(!met){
      const subj = grant.ifKw ? `has no ${grant.ifKw}`
                              : `is no ${grant.ifTt}`;
      return L(n, `${cur.name} ${subj} — no ${what}.`);
    }
    const up = {...cur};
    if(grant.pow) up._arsPow = (up._arsPow||0) + grant.pow;
    if(grant.kw.length) up._arsKw = [...(up._arsKw||[]), ...grant.kw];
    actMut(n).arsenal = up;
    return L(n, `${cur.name} ${grant.ifKw ? "has " + grant.ifKw : "is " +
      (/^[aeiou]/i.test(grant.ifTt||"") ? "an" : "a") + " " + grant.ifTt} — it gains ${what} this turn.`);
  }

  /* A FUNCTION DECLARATION, so it is hoisted: `runOps` sits 2,300 lines
     above it in this closure and a `const` arrow would be in the temporal
     dead zone for any reader of the file (v3.12's `quotedOnHit`, same
     reasoning one module over). */
  /* `already` IS AN OPT-IN FOR A CARD THE CALLER HAS JUST TURNED UP
     ITSELF (v4.05). The early return below is an IDEMPOTENCE guard for
     the pick route — call it twice and the trigger must not fire twice —
     and `heave` is the one caller that legitimately arrives with the card
     already up, because it does what the card prints on its own. Opt-in
     (v3.58), so every existing caller is untouched and a missing flag
     fires nothing rather than firing twice. */
  function faceUpArsenal(n0, stamp, srcName, from, already){
    let n = n0;
    const put = act(n).arsenal;
    if(!put || (put._faceUp && !already)) return n;
    const pfx = fxParse(put);
    const up = {...put, _faceUp:true, _upTurn:n.turn};
    /* TURNING IS NOT PUTTING (v3.72). Spire Sniping alone prints "put OR
       TURNED face up"; every other arsenal trigger in the pool says
       "put". `from === "arsenal"` is the turn — Bravo's ability, which is
       the pool's only one — and a put-only trigger sits it out. */
    const turning = from === "arsenal";
    for(const op of (pfx.arsenalUp||[])){
      if(turning && !pfx.arsenalUpTurn){
        n = L(n, `${put.name} was TURNED face up, not put — its trigger reads "put".`);
        break;
      }
      if(op[0] === "self"){ up._arsPow = (up._arsPow||0) + op[1];
        n = L(n, `${put.name} goes face up — +${op[1]} power this turn.`); }
      else if(op[0] === "ga"){ up._arsGA = true;
        n = L(n, `${put.name} goes face up — it will go again this turn.`); }
      else n = runOps(n, [op], put.name);
    }
    for(const op of (stamp||[])){
      if(op[0] === "self"){ up._arsPow = (up._arsPow||0) + op[1];
        n = L(n, `${srcName}: ${put.name} also gains +${op[1]} power this turn.`); }
    }
    actMut(n).arsenal = up;
    if(!(pfx.arsenalUp||[]).length && !(stamp||[]).length)
      n = L(n, `${put.name} set face up in arsenal.`);
    /* FACE-UP FROM THE **DECK** (v3.79) — Back Alley Breakline's own
       trigger, and the second reader of the `from` this body carries. It
       fires only on the deck route, because the printed line says "from
       your deck": on a put out of the HAND it would hand over a free
       action point the card never grants.

       AFTER THE CARD IS FACE UP AND AFTER THE LINE THAT SAYS SO. Run
       above, the feed pays the action point before the player has been
       told the card arrived — and in a training sim the sequence IS the
       lesson (v3.60). Same ordering Tarantula's drain keeps one rule
       over.

       IT IS LATENT AND THAT IS MEASURED, NOT ASSUMED. Azalea's hero
       ability is the only thing in the pool that puts a card face-up
       from a deck, and Back Alley Breakline is in GRAVY BONES' list — so
       no deck holds both halves today. A printed distinction is still
       read correctly whether or not anything notices (v3.73, and v3.72's
       "a trigger with no event" from the other end). */
    if(from === "deck")
      for(const op of (pfx.deckFaceUp||[]))
        n = runOps(n, [op], put.name);
    /* ---- WHAT WAS WATCHING (v3.72) ---------------------------------
       Crow's Nest: "whenever an arrow is put face-up into your arsenal
       FROM YOUR DECK, you may pay {r}."

       THE WATCHER IS NOT THE CARD BEING PUT — it is a Quiver in the gear
       zone, so a scan of the board alone finds nothing. Both zones, the
       same lesson v3.33 records for Magmatic Carapace and v3.55 for the
       counter family.

       THE SOURCE ZONE IS THE CALLER'S ANSWER, and a caller that says
       nothing gets no trigger: `applyAnswer`'s route puts from HAND and
       `heave` from hand too, so a default of "deck" would fire this off
       every reload. Weaker than printed and visible is the safe
       direction (v3.24). */
    if(from === "deck"){
      const watchers = [...(act(n).gear||[]).filter(g2 => g2 && !g2.destroyed),
                        ...(act(n).board||[]).map(b => b && b.card).filter(Boolean)];
      for(const w of watchers){
        const wfx = fxParse(w);
        const t = wfx.arsUpDeck;
        if(!t) continue;
        if(t.tt && !new RegExp("\\b" + t.tt + "\\b", "i").test(up.tt || "")) continue;
        /* A COST WITH NOTHING TO PAY IT IS NOT OFFERED. `buildPrompt`
           drops an option the hero cannot afford and returns null when
           there is nothing left to ask, so the sheet skips itself. */
        n.promptQ = [...(n.promptQ||[]), {tag:"pay", side:actorOf(n), src:w.name,
          cost:t.pay, ops:t.ops,
          title:`${w.name} — pay ${t.pay} to aim ${up.name}?`}];
      }
    }
    return n;
  }

  const applyAnswer = (s, prompt) => {
    const p = prompt;
    if(!p || !promptReady(p)) return s;
    const r = applyPrompt({...s, prompt:null}, p);
    let n = r.game;
    n.prompt = null;
    r.msgs.forEach(m => { n = L(n, m); });
    /* A PROMPT IS ADDRESSED TO A SIDE, AND SO IS ITS PAYOUT (v2.65).
       `spec.side` has meant "whose call is this" since v2.17 — Cold Snap's
       ruling has the OPPONENT choosing whether to pay — but this function
       charged seat 0's side directly and ran the ops at the ambient actor, so every
       consequence landed on seat 0 whoever was asked.

       It went live the moment seat 1 played real cards: `afterDiscard`
       queues Beaten Trackers' modal with `side: actorOf(n)`, `foePlay`
       hands the actor back without draining the queue, and the sheet was
       then answered by the PLAYER — who paid nothing, because
       `destroyGear` looked for seat 1's uid in seat 0's gear and skipped
       (its `return` exits one op, not the option), and still collected the
       `["ap",1]`. A free action point every game, and the opponent kept
       the iron it was printed to destroy.

       Borrowing the actor for the whole body is what `foePlay` already
       does around `runOps`; it also makes the arsenal tail below, which is
       written on `act`/`actMut`, correct for seat 1 rather than only for
       seat 0. Handed back before `winCheck`/`openPrompt`. */
    const pSide = p.side || 0, pWasActor = n.actor || 0;
    n = {...n, actor: pSide};
    /* PAY IT, OR PITCH FOR IT. `Math.max(0, …)` alone silently FORGIVES an
       unaffordable payment, which was harmless while every `pay` spec was
       built with an `avail` of seat 0's floating resources — you could never select more than
       you held. A `soak` spec's `avail` counts the hand too, because
       pitching is on demand (RULING 2026-08-01) and a hero being hit on
       someone else's turn has no other way to find an {r}. Without the
       pitch here the clamp would hand them the prevention for free, which
       is a keyword strictly better than printed. */
    if(r.pay > 0){
      if(act(n).res < r.pay){ const paid = autoPitch(n, r.pay, null); if(paid) n = paid; }
      const ps = actMut(n); ps.res = Math.max(0, ps.res - r.pay);
    }
    /* THE TAP IS PAID BEFORE THE RIDER RUNS (v3.33), for the reason
       Frostbite's order is a whole ruling: the permanent that pays is
       tapped by the very activation it pays for. `weaponUsed` is the
       existing per-permanent spent flag and `perTurnCleared` already
       unpicks a TAP (lifted only at the controller's untap step, CR
       4.4.3d) from a per-turn allowance, so nothing new is stored. */
    if(r.tap != null){
      const ps = actMut(n);
      ps.weaponUsed = {...(ps.weaponUsed||{}), [r.tap]: true};
    }
    /* AND A HERO TAP IS THE OTHER RECORD (v3.91). `heroTapped` is a STATE
       only the controller's own untap step lifts (CR 4.4.3d); the line
       above writes a per-turn ALLOWANCE that comes back at every turn
       boundary. They coincide for a hero using its own ability and come
       apart the moment an opponent taps you — v3.48 states this, and
       using the wrong one makes the cost payable again on their turn. */
    if(r.tapHero) actMut(n).heroTapped = true;
    /* AND THE PIECE ITSELF, WHERE THAT IS THE PRICE (v3.93). It is MARKED
       rather than spliced, for `sweepGear`'s reason (v3.54): a wall
       declared as INDICES into `gear` renumbers underneath a removal, and
       Refraction Bolters' trigger fires in the DAMAGE step, with the wall
       still declared. The end-phase sweep files it to the graveyard. */
    if(r.destroy != null){
      const piece = (act(n).gear||[]).find(x => x && x.uid === r.destroy);
      if(piece){
        actMut(n).gear = act(n).gear.map(x => x.uid === r.destroy ? {...x, destroyed:true} : x);
        n = L(n, `${piece.name} is destroyed — the cost is paid.`);
      }
    }
    if(r.ops && r.ops.length) n = runOps(n, r.ops, p.src || "prompt");
    /* A GO-AGAIN GRANT THAT ARRIVES AFTER ITS LAYER (v3.93) — see
       `settleLateGa`. AFTER the ops, because `runOps` is what records the
       grant: written above them it reads a flag nothing has set yet, and
       the drill for it passes on a card that does nothing. Opt-in on the
       SPEC (v3.58), so every other prompt keeps the existing consumers. */
    if(p.lateGa) n = settleLateGa(n);
    /* ARSENAL, FACE UP (v2.33). A card put face UP into the arsenal is a
       different event from the end-of-turn arsenal step, which sets face
       DOWN — Azalea's arrows trigger on the face-up one only. The flag
       rides on the card itself, the way a minted card carries _playTurn,
       so no new side field is needed.

       The arrow's own payload is stamped ONTO the card rather than run
       now: "+2{p} this turn" and "go again this turn" have to survive
       until the arrow is actually played, which may be later the same
       turn. `opt` is a real effect and runs immediately. */
    /* THE FREEZE STAMP. `prompts.js` runs no effects, so it reports WHICH
       object was chosen and this applies it — the same split `arsStamp`
       keeps one paragraph below. The mark records WHOSE freeze it is, so
       the thaw needs no turn arithmetic: it lifts at the start of that
       seat's next turn, which is what the card prints, and the two boards
       count `turn` differently. */
    /* ---- BANISH-FOR-COUNTERS: PAY X, AND STAMP THE CARD (v3.39) -----
       Blaze. `prompts.js` runs no effects and touches no resources, so it
       reports WHICH card was chosen and this pays for it — the same split
       the freeze stamp below keeps.

       X IS THE CHOSEN CARD'S OWN ARCANE, which is why no number was ever
       asked for: the filter at the queue site already refused anything he
       could not afford, so the price is settled by the choice.

       TWO STAMPS, BOTH ALREADY HONOURED. `_playTurn` is Crouching Tiger's
       (playable from banish, this turn only) and `playableFromZone`
       reads it; `_asInstant` is the FIFTH printed source for
       `playsAsInstant`, and it is a stamp rather than a grant because it
       names ONE card instance rather than a qualifier. */
    if(p.tag === "pick" && p.ctrSpend && (r.picked||[]).length){
      const chosen = r.picked[0];
      const cost = P.arcAmount(chosen);
      const ps = actMut(n);
      const cur = ps.counters.hero || {};
      ps.counters = {...ps.counters,
        hero: {...cur, [p.ctrSpend]: Math.max(0, (cur[p.ctrSpend]||0) - cost)}};
      ps.banish = (act(n).banish||[]).map(c => c && c.uid === chosen.uid
        ? {...c, _playTurn: p.playThisTurn ? n.turn : c._playTurn, _asInstant: !!p.playThisTurn}
        : c);
      /* THE FEED IS READ BY BOTH SEATS, so it NAMES one (v2.83) — and it
         is phrased so the verb does not have to agree with the name. */
      n = L(n, `${act(n).name}: ${cost} ${p.ctrSpend} spent — ${chosen.name} is banished`
             + (p.playThisTurn ? ", and may be played this turn at instant speed." : "."));
    }
    /* ---- THE UNTAP LANDS ON THE ALLY THAT WAS CHOSEN (v3.47) --------
       `prompts.js` runs no effects, so it reports WHICH object was picked
       and this applies it — the same split the freeze stamp below and
       `arsStamp` above both keep.

       `spent` is the arena's tap: it is what an ally sets to attack
       (v3.44) and what CR 4.4.3d lifts in the end phase, so clearing it
       here is precisely "untap". The stamp is the card's OWN second
       sentence, riding on the op because "it" names the ally rather than
       the source (v2.33). */
    /* THE COUNTERS LAND ON THE PERMANENT THAT WAS CHOSEN (v3.53), and
       nothing moves — `ctrStamp` is data for the same reason `untapStamp`
       is. The counters map is keyed by uid, which is what lets a board
       entry and a piece of gear share one store. */
    if(p.tag === "pick" && p.ctrStamp && (r.picked||[]).length){
      const st = p.ctrStamp, got = r.picked[0];
      const cur = act(n).counters[got.uid] || {};
      actMut(n).counters = Object.assign({}, act(n).counters,
        {[got.uid]: Object.assign({}, cur, {[st.kind]: (cur[st.kind] || 0) + (st.n || 1)})});
      n = L(n, `${got.name} takes ${(st.n||1) > 1 ? st.n + " " + st.label + " counters" : "a " + st.label + " counter"} — now ${(cur[st.kind]||0) + (st.n||1)}.`);
      n = ctrLanded(n, got, st, p.src || "");
    }
    /* "IF THAT CARD HAS <KEYWORD>, …" (v3.90). The rider is conditional
       on the card the COST consumed, which is knowable only after the
       chosen mode's ops have run — so it is asked HERE rather than
       becoming a `fx.conds` entry that `execute`'s loop would answer
       FALSE before any op ran (v3.60).

       `printedKw`, NEVER `hasKw` (v2.84's three questions): a card that
       merely MENTIONS watery grave does not have it.

       A `defBuff` PAYLOAD IS THE PIECE'S OWN (v3.90). Washed Up Wave is
       equipment that is DEFENDING, and "this gets +2{d}" belongs to that
       piece for the rest of the chain — which is `defMod`, keyed by uid,
       the same field Shred moves the other way. Running it as a generic
       `defBuff` would hand the number to a defence REACTION being played,
       which is a different card entirely. */
    if(p.tag === "modal" && p.costRider && p.choice !== "decline"){
      const cr = p.costRider;
      const took = (n._costWay || []);
      const hit = took.some(c => P.printedKw(c, cr.kw));
      if(!took.length) n = L(n, `${p.src}: nothing was spent — the bonus does not apply.`);
      else if(!hit) n = L(n, `${p.src}: ${took.map(c=>c.name).join(", ")} has no ${cr.kw} — no bonus.`);
      else {
        n = L(n, `${p.src}: ${took.map(c=>c.name).join(", ")} has ${cr.kw} — the bonus is live.`);
        const dbuff = (cr.ops || []).filter(o => o[0] === "defBuff")
          .reduce((a, o) => a + o[1], 0);
        if(dbuff){
          const src = (act(n).gear || []).find(x => x.uid === cr.uid)
                   || ((act(n).board || []).map(b => b && b.card).find(c => c && c.uid === cr.uid));
          if(src) n = applyDefMod(n, actorOf(n), src, dbuff, p.src || "");
        }
        const rest = (cr.ops || []).filter(o => o[0] !== "defBuff");
        if(rest.length) n = runOps(n, rest, p.src || "");
        /* GO AGAIN GOES TO THE LINK AS WELL AS THE LOCAL (v3.62). `pend`
           was built at declaration and carries its own copy of `ga`; a
           grant that set only `_gaGrant` here is invisible to the
           resolution the chain link actually runs on — and this sheet is
           answered AFTER the attack is on the chain. */
        if(n._gaGrant && n.pend){ n.pend = {...n.pend, ga: true}; delete n._gaGrant; }
      }
    }
    /* SHRED'S DEBUFF, WHEN A SHEET WAS OPENED (v3.89). The other landing
       site is `attackRx`'s single-defender path; one body serves both, so
       the two cannot disagree about what the answer did. */
    /* ---- "IF IT'S <CLASS>, …" ON THE CARD THAT WAS PUT (v4.01) -------
       HALO OF ILLUMINATION. "It" is the card the player CHOSE, so the
       question is asked here, where that card is in hand — never as an
       `fx.conds` entry, which `execute` answers about the resolving card
       (v2.33, v3.47, v3.92).

       THE CLASS TEST IS `promptFilter`'s, so a class means the same thing
       in a rider as in a filter — and it reads the STRUCTURED ARRAY,
       which is the authority (v2.39: `tt` calls five records something
       their `ty` denies).

       IT FIRES ONLY WHEN A CARD ACTUALLY MOVED. An empty hand puts
       nothing, and a reward for a cost that was not paid is the
       free-ability bug v2.04 fixed. */
    if(p.tag === "pick" && p.classRider && (r.picked||[]).length){
      const got = r.picked[0];
      if(promptFilter({ty: p.classRider.cls})(got)){
        n = L(n, `${got.name} is ${p.classRider.cls} — the rider fires.`);
        n = runOps(n, p.classRider.ops, p.src || "");
      } else {
        n = L(n, `${got.name} is not ${p.classRider.cls} — no rider.`);
      }
    }
    if(p.tag === "pick" && p.defStamp && (r.picked||[]).length){
      const st = p.defStamp;
      n = applyDefMod(n, st.seat, r.picked[0], -st.amt, p.src || "");
    }
    /* THE BANISHED CARD'S OWN STAMP (v3.92). "It gets +1{p} and you may
       play it this turn" is about the card that MOVED, and the card is
       already in the banish zone by the time this runs — so the stamp is
       written onto the copy that is there. */
    if(p.tag === "pick" && p.banStamp && (r.picked||[]).length){
      const st = p.banStamp, got = r.picked[0];
      /* `_playTurn` IS THE WHOLE WINDOW — see the note beside `banPow` in
         `execute`. `_asInstant` is written FALSE on purpose: Blaze's
         banish (v3.39) prints a speed grant and these two do not, so the
         two lines must not be read onto each other. */
      actMut(n).banish = (act(n).banish||[]).map(c => c.uid === got.uid
        ? Object.assign({}, c,
            st.pow ? {_banPow: st.pow} : {},
            st.costOff ? {_banCostOff: st.costOff} : {},
            st.playThisTurn ? {_playTurn: n.turn, _asInstant: false} : {})
        : c);
      n = L(n, `${p.src}: ${got.name} is banished`
             + (st.pow ? ` with +${st.pow}{p}` : "")
             + (st.costOff ? ` costing ${st.costOff} less` : "")
             + (st.playThisTurn ? ", and may be played this turn." : "."));
    }
    if(p.tag === "pick" && p.untapStamp && (r.picked||[]).length){
      const chosen = r.picked[0];
      const st = p.untapStamp || {};
      let found = null;
      actMut(n).board = (act(n).board||[]).map(b => {
        if(!b || b.uid !== chosen.uid) return b;
        found = b;
        return Object.assign({}, b, {spent: false}, st.sd ? {sd: st.sd} : {});
      });
      if(found){
        n = L(n, `${p.src}: ${chosen.name} untaps and can attack again`
               + (st.sd ? " — it is destroyed at the beginning of the end phase." : "."));
      }
    }
    if(p.tag === "pick" && p.freezeSide != null && (r.picked||[]).length){
      /* The actor is borrowed to the ASKED side for this whole body, and
         the asked side is the freezing player — so the frozen side is
         simply `foe`, and the established Mut helper is the write path. */
      const chosen = r.picked[0], fz = chosen._frz || {}, by = p.side || 0;
      if(fz.kind === "arsenal" && foe(n).arsenal && foe(n).arsenal.uid === fz.uid)
        foeMut(n).arsenal = {...foe(n).arsenal, _frozenBy: by};
      else foeMut(n).board = (foe(n).board||[]).map(b =>
        b && b.uid === fz.uid ? {...b, _frozenBy: by, card: {...b.card, _frozenBy: by}} : b);
      n = L(n, `${chosen.name} is frozen — it cannot be played or activated until the start of ${act(n).name}'s next turn.`);
    }
    /* THE CROSS-SEAT MOVE. `prompts.js` moves cards within ONE side, so a
       pick whose candidates came from the other seat reports the choice
       and this performs it — the same split the freeze stamp above keeps.
       The actor is borrowed to the asked side for this whole body, so the
       hand being reached into is `foe`. */
    if(p.tag === "pick" && p.moveFoe && (r.picked||[]).length){
      const got  = r.picked[0];
      /* THE SPEC'S OWN FIELDS, READ. `moveFoe` has carried `{from, to}`
         since v3.03 and this body ignored both, moving hand -> deck top
         whatever it was told — correct for the one card that existed and
         silently a no-op for the next one. Pass Over banishes from their
         GRAVEYARD: against the hardcoded lookup the sheet opened, the
         right card was offered, the feed said it was banished, and
         nothing moved. That is v2.34's `arsStamp` exactly — A SPEC ONLY
         CARRIES FIELDS ITS CONSUMER READS — and the reason to fix it here
         rather than at the queue site is that the queue site was already
         telling the truth. */
      const from = p.moveFoe.from || "hand";
      const to   = p.moveFoe.to   || "deckTop";
      if(((foe(n)[from])||[]).some(x => x.uid === got.uid)){
        const fs = foeMut(n);
        fs[from] = (fs[from]||[]).filter(x => x.uid !== got.uid);
        if(to === "deckTop")         fs.deck = [got, ...(fs.deck||[])];
        else if(to === "deckBottom") fs.deck = [...(fs.deck||[]), got];
        else                         fs[to]  = [got, ...(fs[to]||[])];
        /* NAME THE SEAT (v2.83). This line goes to the shared feed, which
           both seats read, so "their deck" is only right from one chair. */
        const where = to === "deckTop"    ? `on top of ${foe(n).name}'s deck`
                    : to === "deckBottom" ? `on the bottom of ${foe(n).name}'s deck`
                    : to === "banish"     ? `out of the game`
                    : `into ${foe(n).name}'s ${to}`;
        n = L(n, `${act(n).name} takes ${got.name} from ${foe(n).name}'s ${from === "grave" ? "graveyard" : from} — ${where}.`);
      }
    }
    /* THE RE-EQUIP FIXUP (v3.53). A piece retrieved out of the graveyard is
       equipped FRESH: `destroyed` is what put it there, and `curDef` is
       battleworn wear from the life it already had. Both are cleared, or
       the player pays {r} to equip a shield that still blocks for zero.

       `weaponUsed` IS DELIBERATELY NOT CLEARED. It is a per-turn ALLOWANCE
       keyed by uid on the side (v2.46 unpicks it from a TAP for exactly
       this kind of reason), and this engine keeps the piece's uid across
       the trip. Clearing it would hand back a Once-per-Turn swing the seat
       had already spent this turn — stronger than printed. Leaving it is
       weaker than printed and visible, which is the direction v2.04
       settled for costs. */
    if(p.tag === "pick" && p.to === "gear" && p.equipStamp){
      const back = new Set((r.picked || []).map(c => c.uid));
      if(back.size){
        const ps = actMut(n);
        ps.gear = (ps.gear || []).map(gr => back.has(gr.uid)
          ? Object.assign({}, gr, {destroyed: false, curDef: null}) : gr);
        for(const c of (r.picked || []))
          n = L(n, `${c.name} is retrieved and equipped again.`);
      }
    }
    /* THE FACE IS THE CALLER'S ANSWER, NOT THE ZONE'S (v3.69). This branch
       treated EVERY `to:"arsenal"` pick as a FACE-UP put — right for the
       three cards v2.33/v2.34 built, which all print "face up", and wrong
       for RELOAD, whose printed reminder text says the opposite:

         Reload (If you have no cards in your arsenal, you may put a card
         from your hand FACE DOWN into your arsenal.)

       Face-up is a DIFFERENT EVENT (v2.33) — it is the one Azalea's arrows
       trigger on, and her deck holds Take Aim beside four of them. Driven,
       reloading Swift Shot handed her a free go again and reloading
       Entangling Shot tapped the opposing hero, off a card that grants
       neither. The prompt's own title said "face-down" while the code set
       `_faceUp: true`: the feed and the state disagreeing, which is the
       sev-2 category the player TRUSTS.

       OPT-IN (v3.58's rule), so a spec that says nothing gets the printed
       default — face DOWN, which is what an ordinary arsenal set is. */
    if(p.tag === "pick" && p.to === "arsenal" && !p.faceUp && (act(n).arsenal || {})._faceUp !== true){
      const put = act(n).arsenal;
      if(put) n = L(n, `${act(n).name}: ${put.name} goes into the arsenal face down.`);
    }
    if(p.tag === "pick" && p.to === "arsenal" && p.faceUp)
      n = faceUpArsenal(n, p.arsStamp || [], p.src, p.zone || "hand");
    n = {...n, actor: pWasActor};
    return openPrompt(winCheck(n));
  };

  /* WHERE A DECLARED ATTACK GOES WHEN IT IS DONE (v2.77).

     Split out of `execute` so that WHEN it happens belongs to the caller
     and WHERE is still answered once. A card played from hand or the
     arsenal is filed to the graveyard, turn-stamped like every other path
     in; one played from the graveyard or banish is banished, which is the
     printed rule for the cards that reach back into those zones. A weapon
     is neither — it stays equipped and is spent.

     `blueGY` rides here rather than at declaration because it counts
     blue cards IN THE GRAVEYARD, and until this runs the card is not in
     one. */
  const fileAttack = (s2, card, from) => {
    let n = {...s2};
    if(from==="hand"||from==="arsenal"){
      actMut(n).grave=[...gy(n.turn, card),...act(n).grave];
      if(card.pitch===3) actMut(n).hist = {...act(n).hist, blueGY:(act(n).hist.blueGY||0)+1};
    }
    if(from==="grave"||from==="banish") actMut(n).banish=[card,...act(n).banish];
    return n;
  };

  /* THE SECOND HALF OF A DECLARATION (v2.73).

     Some card text cannot resolve until the DEFENDERS EXIST — phantasm
     reads the cards declared against the attack — so it is not
     declaration-time text at all, and folding it into `execute` was what
     forced `execute` to run the defend step itself.

     The caller declares defenders however its own turn structure does
     (the trainer's `dummyDefence`, judge.js's DEFEND step) and hands the
     state back here. This resolves what the defenders enabled, and reports
     `_fizzled` when the attack did not survive to the reaction step. It
     never names a phase: what "the attack is gone" MEANS is the caller's,
     and that is the whole point of the split. */
  /* ---- CLASH, IN ONE BODY (v3.94) -----------------------------------
     "When this defends, clash with the attacking hero. The winner creates
      a Might token."

     THE WHOLE MECHANIC LIVED IN `index.html`: 31 mentions there, and ONE
     in `judge.js` which is a COMMENT — the comment recording that clash
     had once fired on the wrong trigger for five versions. Seven pool
     cards print it, every one reads `tier: full`, and at the table not
     one of them did anything. v3.01's shape at the scale of a whole
     mechanic, and the same family as phantasm (v3.00) and ephemeral
     (v3.82): a keyword carried on one board, which no coverage tool and
     no keyword ledger can express.

     THE THREE PAYOFFS WERE INLINE REGEXES over `.tx` — the token name,
     the defence bonus and the revealed card's damage — which is v3.58's
     "an inline reader is a card special-cased", one mechanic over. They
     are `fx.clash` / `fx.clashReveal` now.

     WHICH CARDS DEFEND IS THE CALLER'S ANSWER (v3.11, v3.24, v3.27), as
     it is for phantasm two lines below.

     `fx.clash`, NEVER `hasKw(c, "clash")`. Measured over the pool: the
     keyword predicate claims SEVEN cards and `printedKw` claims none,
     because the database prints no keyword line for it — and the seventh
     is **Unexpected Backhand**, an ordinary Brute attack whose text
     merely MENTIONS a clash. Any non-block card may be declared as a
     defender, so the trainer's keyword filter ran a clash off a card that
     prints no such trigger. v2.84's three questions, answered by reading
     the parsed field instead of any of them.

     THE ACTOR IS THE ATTACKER on this route (`afterDefenders` is called
     with the attacking seat), so the defender's seat is BORROWED and
     handed back — `allyDeath`'s rule (v3.46): a body that leaves the
     actor moved corrupts every rule after it in the same resolution. */
  const resolveClash = (s, defSeat, defenders) => {
    let n = s;
    const cards = (defenders || []).filter(Boolean).filter(c => fxParse(c).clash);
    if(!cards.length) return n;
    const keepActor = actorOf(n);
    n = {...n, actor: defSeat};
    for(const cc of cards){
      const cl = fxParse(cc).clash;
      /* zonePow, NOT printed power: the top of a DECK is a zone other
         than the combat chain, so Kayo's clause 2 reaches it — and each
         card is read with ITS OWN owner's build, which is what `bFoe` is
         for. Reading both with one build applies the revealer's passive
         to the opponent's card. */
      const myTop = act(n).deck[0], foeTop = foe(n).deck[0];
      const mine = myTop ? zonePow(myTop, bAct(n)) : 0;
      const theirs = foeTop ? zonePow(foeTop, bFoe(n)) : 0;
      const win = mine > theirs, tie = mine === theirs;
      n = L(n, `${cc.name} clashes — ${act(n).name} reveals `
        + `${myTop ? myTop.name + " (" + mine + ")" : "nothing (0)"} vs `
        + `${foe(n).name}'s ${foeTop ? foeTop.name + " (" + theirs + ")" : "empty deck (0)"} — `
        /* A TIE IS NO WINNER — CONFIRMED (user, 2026-08-19), so it is
           settled rather than assumed. */
        + (tie ? "a tie, no winner." : win ? `${act(n).name} wins.` : `${foe(n).name} wins.`));
      if(tie) continue;
      /* THE TOKEN GOES TO THE WINNER, whichever side that is — the card
         says "the winner", not "you". */
      if(cl.token) n = runOps(n, [["token", cl.token, 1, win ? "self" : "foe"]], cc.name);
      /* THE DEFENCE BONUS IS THE DEFENDER'S, and only on a win: "IF YOU
         win, THIS gets +1{d}" names the clashing piece. It rides as a
         `defMod` keyed by uid (v3.89), so both walls read it through
         `defendValue` and neither caller has to be told — and it carries
         the window the card prints. */
      if(cl.defBuff && win)
        n = applyDefMod(n, defSeat, cc, cl.defBuff.amt, cc.name + " braces from the clash",
                        cl.defBuff.until);
      /* AND THE REVEALED CARD MAY PAY OFF (Unexpected Backhand). It is
         the WINNER's revealed card, on either side — the trainer only
         ever looked at the defender's, so an attacker who won a clash
         revealing it dealt nothing. "The OTHER hero" is the loser. */
      const top = win ? myTop : foeTop;
      const rv = top && fxParse(top).clashReveal;
      if(rv){
        /* THE WINNER'S SEAT IS BORROWED so the existing `dmg` op can say
           it — one description of what dealing damage to the other hero
           means, rather than a second inline write beside the one in
           `runOps`. Handed straight back, like the defender's seat above. */
        const wSeat = win ? defSeat : 1 - defSeat;
        const keep2 = actorOf(n);
        n = runOps({...n, actor: wSeat}, [["dmg", rv.dmg]], top.name);
        n = {...n, actor: keep2};
        n = L(n, `${top.name} was the card revealed — it lashes out at `
                 + `${((n.sides || [])[1 - wSeat] || {}).name} for ${rv.dmg}.`);
      }
    }
    return {...n, actor: keepActor};
  };

  const afterDefenders = (s, wall, gearWall) => {
    let n = {...s};
    const d = n._declared;
    delete n._declared;
    /* WHO IS DEFENDING IS THE CALLER'S ANSWER, not this file's — the same
       split `linkPumps`/`linkPayload` already keep. The trainer holds its
       declarations as `{k:"def"}` entries on `stack`; judge.js holds them
       on the defending side's `blockH`. Reading either shape from here
       would be a second description of a wall, and reading only ONE of
       them is how phantasm came to work on one board and silently do
       nothing on the other. `wall` is the declared NON-EQUIPMENT cards;
       phantasm reads no other kind. */
    const card = d ? d.card : (n.pend && n.pend.card);
    if(!card) return n;
    /* RULING 2026-07-25 — phantasm: a single blocker with 6+ printed POWER
       destroys this attack outright ("popping" it). Because the card is
       destroyed its go again never resolves and the action point is not
       refunded, so the pend is torn down here rather than resolved. */
    if(hasKw(card,"phantasm")){
      const popper = (wall || [])
        /* PRINTED power, deliberately — not zonePow. This is phantasm
           reading the DEFENDING card, which is (a) the opponent's, and
           Kayo's clause 2 reads "attack action cards YOU OWN", and
           (b) already declared, so it is ON THE COMBAT CHAIN, the one
           zone the clause excludes. Both reasons say printed. */
        .find(c=>(c.power||0) >= 6);
      if(popper){
        n.pend = null; n.stack = [];
        actMut(n).ap = act(n).ap - 1;
        n = L(n, `${popper.name} has ${popper.power} power — ${card.name} is popped by phantasm and destroyed. No go again, no refund.`);
        /* A PHANTASM CARD MAY PAY OFF ON BEING POPPED, and the trigger is
           `fxParse`'s to read (v3.58). This used to be an inline regex
           over the card's raw text — a second reader for a printed
           clause, which is the cached-card-fact shape v3.22 deletes. It
           fired correctly and the clause still reported UNREAD, so
           Phantasmal Haze sat at `part` with a mechanic that works. */
        const dOps = fxParse(card).onDestroy || [];
        if(dOps.length) n = runOps(n, dOps, card.name);
        n._fizzled = true;
        return openPrompt(winCheck(n));
      }
    }
    /* "WHEN THIS DEFENDS, …" FIRES HERE, ON BOTH BOARDS (v3.33).

       This is the moment the wall is FINAL and both boards already reach
       it — which is the whole reason the trigger lives here rather than at
       the declaration toggle, where a defender can still be withdrawn.
       The wall is the CALLER's answer, exactly as phantasm's is.

       IT IS ADDRESSED TO THE DEFENDER, not the actor. Inside a link the
       actor is the ATTACKER (judge sets it from `link.by`, and the
       trainer's block path keeps seat 0 for the swing), so billing
       `actorOf(n)` here would offer the attacking hero a choice printed on
       their opponent's blocker — the self/foe pairing `selfPayOr` and
       `payOr` already keep apart. */
    {
      const defSeat = 1 - actorOf(n);
      /* CLASH IS A "WHEN THIS DEFENDS" TRIGGER TOO, and it fires here for
         the same reason the others do: this is the moment the wall is
         FINAL. Before the prompts, because a clash creates a token and
         moves a defender's value, and a sheet opened first would resolve
         against a board the clash has not yet changed.

         BOTH KINDS OF DEFENDER, hand and gear — Stonewall Impasse is
         EQUIPMENT, and it is one of the four records v3.90 found that
         neither board could reach. */
      n = resolveClash(n, defSeat, [...(wall || []), ...(gearWall || [])]);
      let queued = 0;
      /* THE DECLARED EQUIPMENT IS A SECOND ARGUMENT, NOT A WIDER `wall`
         (v3.90). The comment above pins `wall` as "the declared
         NON-EQUIPMENT cards; phantasm reads no other kind", and that is a
         CONTRACT — widening it to serve a new reader would change what
         phantasm looks at, silently, for the sake of a card phantasm has
         nothing to do with.

         FOUR POOL RECORDS PRINT "when this defends" ON GEAR — the two
         Unity pieces (answered at the wall by their own reader),
         Stonewall Impasse and Washed Up Wave — and until now NEITHER
         board reached any of them: judge's wall is built from the hand
         alone and the trainer's site filters gear out. A trigger with no
         caller looks exactly like a trigger that works (v3.50). */
      for(const dc of [...(wall || []), ...(gearWall || [])]){
        const dfx = fxParse(dc);
        /* A MODAL OPTIONAL COST (v3.90) — Washed Up Wave. Its sibling
           Jittery Bones prints the identical cost on the `attacks`
           trigger; one reader, two sites, exactly as `optCost` keeps. */
        if(dfx.millCost && dfx.millCost.trigger === "defends"){
          n.promptQ = [...(n.promptQ||[]), millCostSpec(dfx.millCost, dc, defSeat)];
          queued++;
        }
        const oc = dfx.optCost;
        if(!oc || oc.trigger !== "defends") continue;
        n.promptQ = [...(n.promptQ||[]), optCostSpec(oc, dc, defSeat, false)];
        queued++;
      }
      /* DRAIN ONLY IF THIS FIRED. A blanket `openPrompt` here opens
         whatever else happened to be waiting in the queue, mid-combat, and
         a live sheet stops the game for both seats — three drills stalled
         at the damage step on cards that print no defends trigger at all.
         A prompt is drained by whoever queued it. */
      if(queued) n = openPrompt(n);
    }
    return n;
  };

  /* ============================================================
     THE LINK RESOLVES, IN THREE PIECES (v2.77)

     `resolveStack` was one body, and two thirds of it was card semantics
     wrapped around one third that was the trainer's turn structure. That
     is exactly the knot that kept the table from ever resolving a card:
     judge.js holds its defenders on `blockG`/`blockH` and routes damage
     by CR 1.4.5 attack-target, so it could not call a body that reads the
     trainer's `stack` and always hits the hero.

     So the semantics come out as two shared pieces and each caller keeps
     its own middle:

       linkPumps    everything that changes the attack's TOTAL before the
                    wall — reaction pumps on the stack, and the late ops
                    that can only be known once defenders exist
       (the caller) the wall, and where the damage lands
       linkPayload  everything the link DOES once the damage is dealt —
                    its ops, its on-hit clauses, the weapon counters, the
                    hero's extra swing, crush, the soul, the chain entry
                    and the attack's action point

     `resolveStack` is now those three composed, with the trainer's own
     wall in the middle, and its behaviour is unchanged — the drills that
     cover Kayo, Dorinthea, arcane, frostbite and the pay-toll all drive
     it and all still pass. What is NOT allowed is for judge.js to grow a
     second copy of either piece; there is a drill for that.

     Historic note: this body was `() => setG(s=>{…})` in `Battle` and its
     React wrapper was peeled off in v2.62, leaving a pure s => s'.
     ============================================================ */

  /* ---- AN ATTACK REACTION RESOLVES ONTO THE OPEN LINK (v3.11) --------

     `linkPumps` has always read `{k:"rx"}` layers off the stack, and until
     now **only the trainer ever pushed one.** At the table an attack
     reaction was played legally, left the hand, cost its resources — and
     its pump went to `buffNext`, so it landed on the player's NEXT attack
     instead of the one it was printed to pump. The feed said so, in as
     many words: *"+3 power queued for your next attack."*

     That is sev-2, the category the player TRUSTS: nothing failed, nothing
     refused, and the number on screen was simply wrong. **14 pool cards
     across four heroes**, eight of them Dorinthea's — her whole reaction
     game.

     THE HAND-BLOCKER COUNT IS THE CALLER'S ANSWER, exactly as
     `equipDefenders` is for `linkPumps` below. Reprise asks "did they
     block with a card from hand this chain link", and the trainer files
     declared defenders as `{k:"def"}` layers on the stack while judge.js
     holds them on `blockH`. A body that reads one of those representations
     is a body the other board cannot call — which is how phantasm came to
     be inert at the table for three versions (v3.00).

     Returns `{game, pump, why}`. `why` is a refusal the CALLER logs, so a
     printed target restriction reads the same on both boards: "target
     sword attack" cannot be played onto a dagger at all, and that is a
     legality rather than a modifier. */
  /* WHAT HAPPENS WHERE A COUNTER LANDS (v3.66) — ONE BODY, because it has
     TWO call sites: `runOps`'s `ctrPut` when a single candidate needs no
     choice, and `applyAnswer` when a sheet was opened. Written twice they
     drift, and what they carry is Sharpen's whole second sentence.

       `wipeEnd`  the KEYWORD's reminder text — "remove all +1{p} counters
                  FROM IT at end of turn". Stamped on the piece rather
                  than derived, because the SWORD's own text says nothing
                  about it: `idleCounterWipes` asks the PIECE's printed
                  line and so structurally cannot answer for this.
       `then`     "if IT has N or more +1{p} counters, …" — "it" is the
                  sharpened sword, not the resolving card (v2.33, v3.47),
                  and it is counted AFTER the counter lands, which is what
                  makes the red printing's "1 or more" satisfiable at all. */
  const ctrLanded = (nn, t, st, srcName) => {
    let g2 = nn;
    if(st.wipeEnd){
      const mark = e => (e && e.uid === t.uid) ? Object.assign({}, e, {_powEnd: true}) : e;
      actMut(g2).gear  = (act(g2).gear  || []).map(mark);
      actMut(g2).board = (act(g2).board || []).map(mark);
      g2 = L(g2, `${t.name} keeps its +1{p} counters only until the end of the turn.`);
    }
    if(st.then){
      const have = ((act(g2).counters || {})[t.uid] || {}).pow || 0;
      if(have >= st.then.min) g2 = runOps(g2, st.then.ops, srcName || t.name);
      else g2 = L(g2, `${t.name} has ${have} +1{p} counter${have === 1 ? "" : "s"} — ${st.then.min} were needed.`);
    }
    return g2;
  };

  /* ONE BODY FOR THE SHIFT (v3.89), because it lands from two places —
     the direct path when there is a single defender, and `applyAnswer`
     when a sheet was opened. Written twice they drift, which is the rule
     `faceUpArsenal` and `ctrStamp` each carry a comment about. */
  /* `until` IS READ OFF THE PRINTED WORDS (v3.87, v3.94). Shred prints
     "this combat chain" and Stonewall Impasse's clash payoff prints
     "until end of turn" — a turn-scoped bonus filed as chain-scoped is
     weaker than printed the moment a second chain opens the same turn,
     and a chain-scoped one filed as turn-scoped is stronger. Defaulted to
     the chain, which is what every caller before v3.94 meant. */
  const applyDefMod = (s, seat, card, d, src, until) => {
    let n = {...s};
    const sides = n.sides.slice();
    const sd = sides[seat] || {};
    sides[seat] = Object.assign({}, sd,
      /* THE FIELD IS OPT-IN (v3.58's rule): `until` is written only for a
         window that is NOT the default, so an entry keeps the exact shape
         it had before v3.94 and the drills that `deepEqual` it stay
         meaningful. Absent means "this combat chain", which is what every
         caller before v3.94 meant. */
      {defMod: [...(sd.defMod || []), until && until !== "chain"
        ? {uid: card.uid, d, until} : {uid: card.uid, d}]});
    n = Object.assign({}, n, {sides});
    return L(n, `${src}: ${card.name} defends for ${Math.abs(d)} ${d < 0 ? "less" : "more"}`
              + (until === "turn" ? " until end of turn." : " for the rest of this combat chain."));
  };

  const attackRx = (s, c, o) => {
    o = o || {};
    const fx = fxParse(c);
    const pend = s.pend;
    if(!pend || !pend.card) return {game: s, pump: 0, why: c.name + " has no attack to react to."};
    /* A PRINTED TARGET RESTRICTION IS A LEGALITY, NOT A MODIFIER. */
    /* THE QUALIFIER ATOMS THAT ARE NOT PRINTED FIELDS (v3.63). `pumped`
       is a fact about the LINK, so it rides in as an opt the way `from`
       and `boosted` do — an absent one answers NO, which leaves the
       reaction with no legal target rather than a free grant. */
    const qo = {pumped: pendPumped(s), atk: true};
    if(fx.selfQ && !qualMatches(fx.selfQ, pend.card, qo)){
      const want = P.qualLabel(fx.selfQ);
      return {game: s, pump: 0,
              why: `${c.name} targets ${want} — ${pend.card.name} isn't one.`};
    }
    let n = {...s};
    /* A MODAL REACTION: THE BOARD PICKS THE MODE (v3.12). "Choose 1;" was
       being SUMMED — Pummel granted +8 where it prints +4 — and the fix
       is not a prompt: the printed target restrictions are disjoint, so at
       most one mode can ever be legal against what is actually swinging.

       ONLY A MODE WHOSE RESTRICTION WE CAN READ IS SELECTABLE. `attackQual`
       reads the words between "target" and "attack", which covers "target
       dagger attack" and not "target attack action card WITH STEALTH" — so
       the second mode of both pool cards parses no qualifier at all.
       Treating an unreadable restriction as "matches anything" would let
       Pummel pump a card it cannot legally target, which is the direction
       that steals games. Refusing leaves it visibly weaker than printed
       instead, the same call v2.04 made for unpayable costs. */
    let mode = null;
    if(fx.modes && fx.modes.length){
      mode = fx.modes.find(md => md.q && qualMatches(md.q, pend.card, qo)) || null;
      if(!mode) return {game: s, pump: 0,
        why: `${c.name}: no mode of it can target ${pend.card.name}.`};
      n = L(n, `${c.name}: ${mode.label}.`);
    }
    const eff = mode ? Object.assign({}, fx, {self: mode.self, ops: mode.ops}) : fx;
    /* WHICH PRINTED CONDITIONS ACTUALLY FIRED — the half that needs the
       board. The arithmetic is `parser.rxPump`, which knows that a gated
       bonus may REPLACE the printed one rather than stack with it. */
    const fired = [];
    (fx.conds || []).forEach(({cond, op}) => {
      /* ONE LIST, TWO READERS (v3.89) — `execute` skips exactly these and
         this is where they are answered. A condition in the list with no
         branch here is a gate that is skipped and then never run. */
      if(RX_CONDS.indexOf(cond) < 0) return;
      if(cond === "reprise"){
        const fromHand = o.handBlockers || 0;
        if(!fromHand){ n = L(n, `${c.name}: reprise needs a card from hand to have met the attack — none did.`); return; }
        fired.push(cond);
        if(op[0] !== "self") n = runOps(n, [op], c.name);
        n = L(n, `Reprise — ${fromHand} card${fromHand > 1 ? "s" : ""} from hand met the attack.`);
        return;
      }
      if(cond === "charged"){
        if(!(act(n).hist.charged > 0)){ n = L(n, `${c.name}: no charge to the soul this turn.`); return; }
        fired.push(cond);
        if(op[0] !== "self") n = runOps(n, [op], c.name);
        n = L(n, `${c.name}: charged this turn — the bonus is live.`);
      }
      /* "IF IT IS DEFENDED BY AN ATTACK ACTION CARD" (v3.91) — Agile
         Engagement. WHICH CARDS DEFEND is the caller's answer (v3.11,
         v3.24, v3.27) and this route was given a COUNT until v3.89 gave
         it the cards; the condition itself is Boltyn's, one route over
         (v3.74), so nothing new was invented.

         A CALLER THAT SAYS NOTHING ANSWERS NO — weaker than printed and
         visible, which is the safe direction. */
      if(cond === "defAtkAction"){
        const hit = (o.defenders || []).some(x => isAtkActionCard(x));
        if(!hit){ n = L(n, `${c.name}: no attack action card is defending — no bonus.`); return; }
        fired.push(cond);
        if(op[0] !== "self") n = runOps(n, [op], c.name);
        n = L(n, `${c.name}: an attack action card defends — the bonus is live.`);
      }
    });
    const {pump, replaced} = rxPump(eff, fired);
    if(replaced && eff.self) n = L(n, `${c.name}: that bonus REPLACES the printed +${eff.self} — it doesn't stack with it.`);
    /* THE GRANTED ABILITY BELONGS TO THE ATTACK, NOT TO THE REACTION. A
       reaction never hits anything itself, so "target dagger attack gets
       +3{p} and \"When this hits a hero, mark them\"" stamps its rider onto
       the OPEN LINK — where `linkPayload` fires the link's on-hit clauses
       once damage is dealt. Scar Tissue and Spike with Bloodrot print it
       plainly; Pummel and Two Sides print it inside a mode. */
    const rider = mode ? mode.riderOnHit : (fx.onHit && fx.onHit.length ? fx.onHit : null);
    /* AND THE RIDER MAY CARRY ITS OWN, NARROWER RESTRICTION (v4.11).
       Arakni's Agents print "Target Assassin attack gets +3{p}. If IT has
       stealth, it gets <ability>" — the head restricts the target and the
       second sentence restricts it further, so `fx.onHitQ` is `gaQ`'s
       twin one grant over and `qualMatches` is the same matcher.

       WITHOUT THE GATE THE ABILITY IS GRANTED TO EVERY LEGAL TARGET,
       which is a printed RESTRICTION dropped (v2.30's arrow buff on a
       sword) and the direction the fairness sweep exists to catch. */
    const riderOK = !fx.onHitQ || (n.pend && qualMatches(fx.onHitQ, n.pend.card, qo));
    if(rider && rider.length && n.pend && riderOK){
      n.pend = {...n.pend, onHit: [...(n.pend.onHit || []), ...rider]};
      n = L(n, `${c.name}: ${n.pend.card.name} carries its rider — it pays out if it connects.`);
    } else if(rider && rider.length && n.pend && !riderOK){
      n = L(n, `${c.name}: ${n.pend.card.name} is not ${P.qualLabel(fx.onHitQ)} — the rider does not attach.`);
    }
    /* THE HERO-GATED HALF TOO. `onHitHero` is a separate list because an
       ally is an attack-target and "hits a HERO" is not "hits" (v3.45),
       and the same restriction governs it. */
    const riderH = fx.onHitHero && fx.onHitHero.length ? fx.onHitHero : null;
    if(riderH && n.pend && riderOK){
      n.pend = {...n.pend, onHitHero: [...(n.pend.onHitHero || []), ...riderH]};
      n = L(n, `${c.name}: ${n.pend.card.name} carries its rider — it pays out if it hits a hero.`);
    }
    /* `fx.ga` on an attack reaction can only mean the TARGET's go again —
       no attack reaction in the pool prints the keyword for itself. */
    if(fx.ga && n.pend){
      if(qualMatches(fx.gaQ, n.pend.card, qo)){
        n.pend = {...n.pend, ga: true};
        n = L(n, `${c.name}: ${n.pend.card.name} goes again.`);
      } else {
        const want = P.qualLabel(fx.gaQ);
        n = L(n, `${c.name} grants go again to ${want} — ${n.pend.card.name} isn't one.`);
      }
    }
    n = runOps(n, (eff.ops || []).filter(op => op[0] !== "buffNext"), c.name);
    /* ---- A DEFENDER SHRUNK FOR THE REST OF THE CHAIN (v3.89) --------
       Shred: "Target card defending an ASSASSIN attack gets -2{d} this
       combat chain."

       WHICH CARDS DEFEND IS THE CALLER'S ANSWER (v3.11, v3.24, v3.27).
       The two boards hold their declared defenders differently, and a
       body that reads either representation is a body the other board
       cannot call — which is exactly how phantasm came to be inert at the
       table for three versions (v3.00). A caller that says nothing offers
       no target and the card refuses: weaker than printed and visible.

       (The field names are deliberately not written out here: the guard
       in `reactions.test.js` scans this body's RAW SOURCE, comments
       included, so prose naming them reads as a lookup. Reword the prose
       rather than weakening the scan — the same discipline
       `html-balance.test.js`'s pre-neutralize list follows.)

       THE GATE IS ABOUT THE ATTACK, not the defender — `pend.card` must
       be the kind of swing the line names, read through the one matcher.

       THE DEBUFF IS HELD ON THE DEFENDING SIDE, because that is where
       `defendValue` already looks for everything else about a card's
       worth (v3.78) and it is keyed by uid because the card is TARGETED.

       WITH ONE LEGAL TARGET IT JUST HAPPENS (v3.55): a sheet offering a
       single forced choice is a tap that teaches nothing. With two or
       more it opens a real `pick` — caller-supplied candidates, nothing
       moves (`to` omitted), and `defStamp` is DATA the answer applies,
       exactly as `untapStamp` is (v3.47) and for the same reason: this
       module runs no effects, so returning it as ops would hand it to
       `runOps`, which would apply it to the source. */
    if(fx.defDebuff){
      const wall = (o.defenders || []).filter(Boolean);
      const dSeat = 1 - actorOf(n);
      if(fx.defDebuff.q && !qualMatches(fx.defDebuff.q, pend.card, qo))
        n = L(n, `${c.name} shrinks a card defending ${P.qualLabel(fx.defDebuff.q)} — ${pend.card.name} isn't one.`);
      else if(!wall.length)
        n = L(n, `${c.name}: nothing is defending — there is no card to shrink.`);
      else if(wall.length === 1){
        n = applyDefMod(n, dSeat, wall[0], -fx.defDebuff.amt, c.name);
      } else {
        n.promptQ = [...(n.promptQ||[]), {tag: "pick", src: c.name, side: actorOf(n),
          cards: wall, min: 1, max: 1,
          defStamp: {amt: fx.defDebuff.amt, seat: dSeat},
          title: `Shrink a defender by ${fx.defDebuff.amt}`,
          hint: "It defends for that much less for the rest of this combat chain."}];
      }
    }
    n.stack = [...(n.stack || []), {k: "rx", label: `${c.name} — +${pump}`, pump}];
    return {game: n, pump, why: null};
  };

  /* PIECE ONE — the total, before anything is subtracted from it.
     `equipDefenders` is a COUNT the caller supplies, because how a seat
     holds its declared defenders is the caller's business: the trainer
     files them as layers on the stack, judge.js as uid lists on the side. */
  /* CHOKESLAM'S RESTRICTION (v3.30). "Attack action cards they control
     can't gain {p}" — a CAP at the card's printed power, never a
     subtraction: something that made the attack weaker must not be undone
     by a rule that only forbids GAINING. It reads the card being resolved
     rather than the actor's whole hand, because the restriction names
     attack action cards and a weapon swing is not one. */
  const capNoPump = (n, card, total) => {
    if(!card || !isAtkActionCard(card)) return total;
    /* A RESTRICTION IS A FLAG, NOT A SUM — `nextTurnDebuff` adds amounts
       and `noPump` carries none, so asking it here would be a condition
       that is always true. Ask whether one is live instead. */
    if(!P.nextTurnHas(act(n), "noPump")) return total;
    return Math.min(total, card.power || 0);
  };

  /* ---- AN ALLY THAT DIES DOES WHAT IT PRINTS (v3.46) ----------------
     Oysten, Heart of Gold: "When this dies, create a Gold token." One
     pool record prints a death trigger, it is in a real deck, and it only
     became reachable when allies started attacking (v3.44) and being
     attacked (v3.45).

     THE TRIGGER BELONGS TO THE ALLY'S CONTROLLER, NOT TO WHOEVER KILLED
     IT. Inside a combat link the actor is the ATTACKER, so running these
     ops as they stand would hand Oysten's Gold token to the player who
     just shot it down. The seat is borrowed for the payload and restored
     afterwards — the same inversion `arcTaken` documents on the deferred
     soak path (v3.28), where the answer is given by the side being hit.

     Pure, and it takes the side as an argument rather than reading a
     phase: `game.js` owns the zone move and reports the corpse, this owns
     what the card SAYS, and the caller knows whose ally it was. */
  const allyDeath = (s, card, side) => {
    const fx = fxParse(card);
    if(!card || !(fx.onDeath || []).length) return {game: s, fired: false};
    const prev = s.actor;
    let n = runOps({...s, actor: side}, fx.onDeath, card.name);
    return {game: {...n, actor: prev}, fired: true};
  };

  /* SPEND A QUALIFIED NEXT-GO-AGAIN, and only on a play that MATCHES.
     One taker, because two branches of `execute` reach it — an attack
     settles on the chain and a non-attack settles at the action point —
     and Mage Master Boots grants it to a NON-attack, so a taker in the
     attack branch alone would have built half the rule. A grant that does
     not match is NOT spent: it waits for the card it names (v2.30).

     ENTRIES ARE `{q, rider}` (v3.42), not a bare qualifier — the same
     shape `buffQ` uses for the same reason: a granted ability can ride
     with the go again (Avast Ye!) and has to travel with the ENTRY that
     matched, not the card that handed it over. The caller reads
     `.rider.onHit` off the return; a grant with no rider returns one with
     `rider: null`, same as it always did for the takers that only checked
     truthiness. */
  /* A BARE QUALIFIER IS THE RETIRED SHAPE, AND IT MATCHES NOTHING (v3.43).
     v3.42 changed these entries from a bare qualifier to `{q, rider}` and
     did not carry over the guard v3.31 wrote for the same move one shape
     earlier. On a stale entry `x.q` is `undefined`, and `qualMatches`
     answers TRUE for an absent qualifier by design ("unqualified buffs hit
     everything") — so a pre-v3.42 entry off a wire or a replay granted go
     again to ANY card, and spent itself doing it. That is the exact
     direction that steals games, on the most valuable keyword in the game
     to get wrong.

     It REFUSES rather than throwing, for `qualMatches`'s own reason:
     `reduce` is fed by JSON off a wire and one stale grant must cost a
     keyword, never a session. */
  /* SPEND A QUALIFIED DEFENDER-CAP GRANT (v3.64) — same shape and same
     rule as `takeGaNext` directly below: a grant whose qualifier does not
     match the attack being declared is NOT spent, it waits. Taken at
     DECLARATION, because that is when the wall is about to be built and
     `pend` is what both boards ask for the cap. */
  const takeDefCap = (n, card, ctx) => {
    const q = act(n).defCapNext || [];
    /* AN ENTRY WITH NO `q` MATCHES NOTHING (v3.98) — and this taker was
       missing that guard, which `takeGaNext` has had since v3.43 and
       whose note this function's own header cites as "same shape and same
       rule". It copied the shape and not the guard, which is v3.43's
       lesson verbatim: **a guard belongs to the SHAPE, not to the version
       that wrote it.**

       `qualMatches` answers TRUE for an ABSENT qualifier BY DESIGN, and
       that is right for the three grants that may legitimately be
       unqualified (`buffQ`, `atkBuff`, `costOff` — an unqualified "your
       next attack gets +3" really does hit everything). It is wrong for
       the three that are qualified BY CONSTRUCTION: every card that
       writes one names a card type, so an entry with no `q` is a stale
       one off a wire or a replay, and honouring it caps EVERY attack's
       wall rather than the one the line names. */
    const i = q.findIndex(x => x && x.q && qualMatches(x.q, card, ctx));
    if(i < 0) return null;
    actMut(n).defCapNext = q.slice(0, i).concat(q.slice(i + 1));
    return q[i];
  };

  const takeGaNext = (n, card, ctx) => {
    const q = act(n).gaNextQ || [];
    const i = q.findIndex(x => x && x.q && qualMatches(x.q, card, ctx));
    if(i < 0) return null;
    actMut(n).gaNextQ = q.slice(0, i).concat(q.slice(i + 1));
    return q[i];
  };

  /* SPEND A QUALIFIED NEXT-INSTANT GRANT, and only on a play that
     MATCHES (v3.37). `playsAsInstant` READS the same list to decide
     whether the window is open; this is the one place that consumes it,
     because the reader is asked on every dim and every legality check
     and a grant burned by looking at your hand is not a grant.

     SPENT WHATEVER WINDOW IT WAS PLAYED IN. The card names "your NEXT
     Wizard non-attack action card this turn" — that card was your next
     one whether or not you exercised the instant-speed permission, and
     the amp rider is printed about the same card. Holding the grant back
     for a later card would be strictly stronger than printed.

     A grant that does not match is NOT spent: it waits (v2.30). */
  const takeInstantNext = (n, card, ctx) => {
    const q = act(n).instantNextQ || [];
    /* THE ENTRY IS `{q, amp}` (v3.98) — the qualifier is what MATCHES and
       the amp is what the grant PAYS, kept apart the way `buffQ`'s
       `{amt, q, rider}` and `gaNextQ`'s `{q, rider}` always have been. A
       stale entry with no `q` matches NOTHING rather than everything,
       which is v3.43's rule: `qualMatches` answers TRUE for an ABSENT
       qualifier by design, so an entry that must always carry one needs
       its guard here, not in the matcher. */
    const i = q.findIndex(x => x && x.q && qualMatches(x.q, card, ctx));
    if(i < 0) return null;
    actMut(n).instantNextQ = q.slice(0, i).concat(q.slice(i + 1));
    return q[i];
  };

  /* IS THIS PLAY A BOOST? (v3.31) One reader, because two sites ask it and
     the answer decides a rule in both: the declaration pays the cost, and
     a "your next attack YOU BOOST this turn" buff only lands on a play
     that actually paid it. `printedKw` is the predicate — a card that
     merely MENTIONS boost is not offered it (v2.84). */
  const isBoostPlay = (n, card) =>
    !!(n._doBoost && printedKw(card, "boost") && act(n).deck.length);

  const linkPumps = (s, info) => {
    let n = {...s};
    /* ONE READER (v4.03) — the layers still waiting AND the ones judge has
       already resolved onto the link. Summing only the survivors dropped
       every attack-reaction pump at the table. */
    const pumps = rxPumpTotal(n);
    /* ---- THE STANDING ATTACK GRANTS (v3.87) --------------------------
       "Your attacks with stealth get +1{p} this turn." — a CONTINUOUS
       effect on the attack's power, not a bonus handed over at
       declaration, so it is read HERE and nowhere else.

       IT HAS TO BE HERE, and Night's Embrace is why: it is an ATTACK
       REACTION, so the grant does not exist yet when the attack is
       declared. Read only at declaration, the card cannot pump the swing
       it was played on — which is the whole of what it does.

       AND ONLY HERE, or the grant is counted twice for an attack declared
       while it was already standing: `VALUE-DOUBLED` on the fairness
       sweep's own terms.

       THE PLAY CONTEXT IS THE LINK'S (v3.31): `from`, `boosted` and "this
       is an attack" are facts about the PLAY that no reader of the card
       can recover, so they travel on `pend` from the declaration.

       IT IS NEVER SPENT — every matching attack inside the window gets it
       (v3.30's debuff/restriction split, one grant over), which is why
       nothing is written back to the side. */
    const _sq = Object.assign({atk: true}, n.pend._qCtx || {});
    const _sb = (act(n).atkBuff||[]).filter(b => qualMatches(b.q, n.pend.card, _sq));
    const stand = _sb.reduce((a, b) => a + b.amt, 0);
    if(stand) n = L(n, `${n.pend.card.name} carries +${stand}{p} from a standing grant.`);
    let total = capNoPump(n, n.pend.card, n.pend.total + pumps + stand);
    /* RULING (Fender Bender): +1 per separate equipment the opponent defended
       with — only knowable once defenders are declared, so it lands here. */
    for(const op of (n.pend.lateOps||[])){
      if(op[0]!=="perEquipDef") continue;
      const eq = (info && info.equipDefenders) || 0;
      total += op[1]*eq;
      n = L(n, `${n.pend.card.name}: ${eq} equipment defending — +${op[1]*eq} power.`);
    }
    /* ---- THE STRUCK POWER IS RECORDED HERE (v3.71) --------------------
       "If this has {p} greater than its base" is a question about the
       attack's POWER, and this is the moment that number is settled — CR
       7.5 has not happened yet, nothing has been blocked, and `capNoPump`
       has had its say. `linkPayload` receives the DAMAGE DEALT instead, so
       every reader over there was comparing a post-wall number against a
       printed base: Short Shrift, Wee Wrecking Ball and Walk in My Shoes
       were pumped to 6 over a base of 4, met a wall of 3, and were told
       they were "not pumped above base".

       WEAKER THAN PRINTED, so the one-sided fairness sweep is blind to it,
       and all three read `tier: full` — the clause was consumed and then
       asked the wrong number.

       A TRACE BELONGS WHERE THE FACT BECOMES TRUE (v3.62), and it goes on
       `pend` rather than into the info object for the reason v3.24 gives:
       an argument threaded through two call sites is an argument one of
       them will drop, silently and with a passing drill. */
    /* `_struck` IS THE POWER BEFORE THE CARD'S OWN LATE BONUS, stamped
       here rather than after the loop below: `condOnHit`'s `pumped` gate
       asks "was this attack pumped", and a +1 that only fires BECAUSE it
       was pumped must not be the evidence that it was. */
    n.pend = {...n.pend, _struck: total};
    /* ---- THE LATE CONDITIONS (moved here at v3.71) --------------------
       Three printed shapes, and every one of them is a question about the
       attack's POWER that could not be asked at declaration:

         pumped      "if this has {p} greater than its base"   — settled by
                     the line above, once reactions and caps have had their say
         defLt2any   "defended by fewer than 2 CARDS"          — equipment counted
         defLt2      "…fewer than 2 NON-EQUIPMENT cards"       — a different set,
                     and the pool prints both

       The two defender counts are the CALLER's answer, like the wall
       itself: how a seat holds its declarations is each board's business
       and not the card's. A caller that says nothing gets 0, which reads
       as "nothing defended" — the generous direction, so both callers are
       drilled for passing them. */
    const defCount = (info && info.defenders) || 0;
    const handBlk  = (info && info.handBlockers) || 0;
    /* ---- BOLTYN'S CLAUSE 1 (v3.74) ----------------------------------
       "If you've charged this turn, your attacks get +1{p} while defended
        by an attack action card."

       TWO GATES, ANSWERED IN TWO PLACES. "You've charged this turn" is his
       own turn history; "defended by an attack action card" is a fact
       about the WALL, so it belongs here with the other late conditions
       and NOT at declaration, where no defender exists yet.

       WHICH CARDS DEFEND IS THE CALLER'S ANSWER (v3.11, v3.24, v3.27) —
       the trainer holds defenders as `{k:"def"}` stack layers and judge on
       `blockH`/`blockG`, and a body that reads either is a body the other
       cannot call. A caller that says nothing answers NO: weaker than
       printed and visible, which is the safe direction.

       THE MAGNITUDE IS THE HERO'S, read off his printed line by
       `build.js`. `bAct` is the acting seat's build, never `built` — a
       passive read as seat 0's fires for the wrong hero the moment seat 1
       acts (v2.41). */
    const _bd = bAct(n).chargedDefBuff || 0;
    if(_bd && (act(n).hist.charged||0) > 0 && info && info.defAtkAction){
      total += _bd;
      n = L(n, `${act(n).name}: charged this turn, and an attack action card defends — ${n.pend.card.name} gets +${_bd} power.`);
    }
    (n.pend.lateConds||[]).forEach(({cond,op})=>{
      const pump = (why) => {
        if(op[0]==="ga"){ n.pend={...n.pend, ga:true}; n = L(n, `${n.pend.card.name}: ${why} — go again!`); }
        else if(op[0]==="self"){ total += op[1]; n = L(n, `${n.pend.card.name}: ${why} — +${op[1]} power.`); }
        else n = runOps(n,[op],n.pend.card.name);
      };
      if(cond==="defLt2any"){
        if(defCount >= 2){ n = L(n, `${n.pend.card.name}: two defenders met it — no bonus.`); return; }
        pump("fewer than 2 defenders"); return;
      }
      if(cond==="pumped"){
        const base = n.pend.card.power||0;
        /* THE STRUCK POWER, and it is the number this function just
           computed — never the damage dealt, which is what the old site
           compared against a printed base: an attack pumped from 4 to 6
           and met by a wall of 3 was told it was "not pumped above base". */
        if(total <= base){ n = L(n, `${n.pend.card.name}: not pumped above its base ${base} — no bonus.`); return; }
        pump("pumped above base"); return;
      }
      /* ---- QUICKSTRIKE: "IF THIS HAS GO AGAIN" (v3.99) ---------------
         A static gate on the ATTACK, which is what puts it beside
         `pumped` rather than in `execute`'s main condition loop: there
         the local `ga` is still being assembled — the waiting `gaNext`
         grant is not taken until ~300 lines later — so the question would
         be answered against a half-built answer. By the time `pend` is
         built, `pend.ga` is final, and it is the field the chain link
         actually resolves on. */
      if(cond==="hasGa"){
        if(!n.pend.ga){ n = L(n, `${n.pend.card.name}: no go again — no bonus.`); return; }
        pump("it goes again"); return;
      }
      /* ---- RUPTURE: "PLAYED AS CHAIN LINK N OR HIGHER" (v3.99) --------
         THE ATTACK'S OWN LINK IS NOT ON THE CHAIN YET. `linkPayload`
         pushes it (one site, shared by both boards) and `linkPumps` runs
         BEFORE that — so this attack is link `chain.length + 1`, and a
         fixture that cannot tell `>= N` from `>= N-1` has tested neither
         (v3.92). Lava Burst prints 4, so the discriminating states are
         exactly 3 prior links (this is link 4 — the bonus applies) and
         exactly 2 (this is link 3 — it does not).

         THE THRESHOLD IS READ, never known here: it travels in the
         condition's name, so a Rupture card printing a different number
         is read correctly rather than assumed to be 4. */
      { const cm = /^chainLinkGe(\d+)$/.exec(cond);
        if(cm){
          const need = +cm[1], link = (n.chain||[]).length + 1;
          if(link < need){ n = L(n, `${n.pend.card.name}: chain link ${link}, needs ${need} — no bonus.`); return; }
          pump(`chain link ${link}`); return;
        } }
      if(cond==="defLt2"){ // a real count now that both seats block from hand
        if(handBlk >= 2){ n = L(n, `${n.pend.card.name}: two cards from hand met it — the bonus is denied.`); return; }
        pump("defended by fewer than 2 non-equipment cards");
      }
    });
    return {game:n, total, pumps};
  };

  /* PIECE TWO — THE PAYLOAD. Everything the link DOES once the damage
     has landed, and not one line about where the damage went: the wall,
     the attack-target and how a seat holds its declared defenders are all
     the caller's, which is why they arrive as three numbers.

       total          what was actually dealt (CR 7.5.5 — a hit is damage
                      DEALT, so `total > 0` is what every on-hit clause,
                      the weapon counters and the hero's extra swing all
                      gate on)
       heroHit        whether that damage reached a HERO (CR 1.4.5)

     THE DEFENDER COUNTS MOVED TO `linkPumps` AT v3.71, with the late
     conditions that were the only thing reading them. They are questions
     about the attack's POWER, and power is settled before the wall — see
     the comment on the loop over there.

     It does not clear `pend` and does not say what phase follows. Both
     callers do that themselves, because that is the half this split
     exists to keep apart. */
  const linkPayload = (s, info) => {
    let n = {...s};
    let total = info.total;
    const pumps = info.pumps || 0;
    const blkNote = info.blkNote || "";
    let rd = 0, runeMsg = "";
    /* THE LATE CONDITIONS RAN HERE UNTIL v3.71, AND THEIR PUMPS WENT
       NOWHERE. This function is handed the damage DEALT and both callers
       have already subtracted it from life by the time it is called, so a
       `+N{p}` added to `total` here moved the crush threshold and the
       on-hit gate and never once touched a hero. Four unique pool cards
       print one — Short Shrift, Wee Wrecking Ball, Walk in My Shoes and
       Azalea's own Widowmaker (+3{p} "if defended by fewer than 2 cards")
       — twelve records, every one WEAKER than printed, which is the
       direction the one-sided fairness sweep cannot see, and all reading
       `tier: full` because the clause really was consumed.

       They live in `linkPumps` now, which is the piece whose whole job is
       "what is this attack's power before the wall". The arithmetic is
       unchanged for a bonus that was already reaching life through
       nothing — `(power + N) - wall` — and it is the ONLY placement under
       which `heroHit` can be right: a swing blocked to nothing that the
       bonus lifts back over the wall has now hit, and the old ordering
       had already decided it had not. */
    const pc = n.pend.card;
    /* ---- "YOUR NEXT ATTACK" IS ONE ATTACK (v4.06) --------------------
       Brand with Cinderclaw prints "your NEXT attack this combat chain is
       Draconic" and `dracNext` was a boolean nothing ever spent — so every
       attack after it counted as Draconic, which is v3.87's standing-vs-
       single-shot split read from the other end, and STRONGER than
       printed. It compounds: `parser.dracLinks` counts Draconic links, and
       that number is Fai's discount, the `dracN` gates and Mounting
       Anger's banish bound.

       SPENT WHERE IT IS READ, so the two cannot disagree — and spent even
       when the attack was already Draconic by type, because the printed
       line names that attack either way, exactly as `buffQ` is spent by
       the card its qualifier names. Brand pushes its own link BEFORE its
       ops run, so it never takes its own grant. */
    const _dracGrant = !!act(n).dracNext;
    n.chain = [...n.chain, {n:pc.name, img:pc.img, dbImg:pc.dbImg, dmg:total, ga:n.pend.ga, drac:/draconic/i.test(pc.tt||"")||_dracGrant, kind:"atk"}];
    if(_dracGrant){
      actMut(n).dracNext = false;
      n = L(n, `${pc.name} takes the Draconic grant \u2014 it is spent.`);
    }
    if(total+rd>0){ n.hitSeq = n.hitSeq+1; n.lastDmg = total+rd; }
    n = L(n, `${pc.name} resolves for ${total}${pumps?` (+${pumps} reactions)`:""}.${blkNote}${runeMsg}`);
    n = runOps(n, n.pend.ops, pc.name);
    /* ---- WHOSE HIT WAS IT? (CR 1.4.5, v3.45) ------------------------
       `heroHit` is the CALLER's answer, exactly as the wall is: judge
       routes an attack at an ally away from the hero entirely and knows
       the target kind, and the trainer wires no ally targeting at all, so
       a guess made here would be right on one board and wrong on the
       other. Absent, it falls back to "any damage is a hero hit", which
       is the trainer's truth today and preserves it exactly.

       19 pool records print "when this hits a HERO" and 13 print a bare
       "when this hits". Driven before this gate existed, Infecting Shot
       created its Bloodrot Pox off a hit on Barnacle — an ALLY. */
    const heroHit = info.heroHit != null ? info.heroHit : (total > 0);
    if(total>0) n = runOps(n, n.pend.onHit, pc.name);
    else if(n.pend.onHit.length) n = L(n, "Fully blocked — on-hit effects fizzle.");
    const _oh = n.pend.onHitHero || [];
    if(_oh.length){
      if(heroHit) n = runOps(n, _oh, pc.name);
      else if(total>0) n = L(n, `${pc.name} hit an ally — its "when this hits a hero" ability does not fire.`);
      else n = L(n, "Fully blocked — on-hit effects fizzle.");
    }
    /* ---- THE `hits` OPTIONAL COST (v3.92) ---------------------------
       Mounting Anger and Rising Resentment: "When this HITS, you may
       banish an attack action card from your hand with cost less than the
       number of Draconic chain links you control."

       v3.53 measured this trigger as having ZERO pool cards and recorded
       the site as unwired for that reason — which was true only because
       the FILTER refused (v2.29) and `fx.optCost` was therefore never
       set. Building `dracLinks` for Fai (v3.86) discharged the refusal,
       and these two are the trigger's first customers. A trigger with no
       card is not work; a trigger whose cards were refused elsewhere is.

       IT FIRES ON A HIT OF ANY KIND, not a hero hit: the printed line
       says "when this hits" with no subject, and 13 pool records print
       that bare form (v3.45). `total > 0` is the hit.

       THE DYNAMIC BOUND IS SUPPLIED HERE, never in the parse: `fxParse`
       memoizes on `name|pitch`, so a number stored there freezes at
       whatever the chain was the first time it was read (v3.20, v3.39).
       `costLtDrac` says WHICH count; this says what it is right now. */
    if(total > 0){
      const _oc = fxParse(pc).optCost;
      if(_oc && _oc.trigger === "hits"){
        const spec = optCostSpec(_oc, pc, actorOf(n), false);
        if(spec.filter && spec.filter.costLtDrac){
          const lim = P.dracLinks(n.chain);
          spec.filter = Object.assign({}, spec.filter, {costLe: lim - 1});
          delete spec.filter.costLtDrac;
        }
        n.promptQ = [...(n.promptQ||[]), spec];
      }
    }
    /* BOTH BOARDS GET THIS, because it lives in the shared body rather
       than in either caller's damage step. `heroHit` is the caller's
       answer — see `briarEarth`. */
    n = briarEarth(n, heroHit);
    /* CHARGE'S CONDITIONALLY GRANTED on-hit abilities (see fx.condOnHit in
       parser.js) — re-checked here, at the actual trigger point, rather than
       at declaration, because "if this hits" only fires on a connected
       attack. Reuses the SAME cond names/checks as the declare-time loop in
       execute() so the two can never silently disagree about what "charged"
       means. */
    if(total>0 && n.pend.condOnHit && n.pend.condOnHit.length){
      n.pend.condOnHit.forEach(({cond,op,heroOnly})=>{
        if(heroOnly && !heroHit){
          n = L(n, `${pc.name} hit an ally — its granted "hits a hero" bonus does not fire.`); return; }
        /* `pumped` JOINED THIS VOCABULARY AT v3.71 and it is the reason
           the vocabulary is worth stating out loud: Bolt'n' Shot grants
           "when this hits, RELOAD" behind exactly that gate, and an
           unknown cond answers FALSE (v3.26) — correctly, and silently.
           The number is the STRUCK power, the same one `linkPumps`
           records, never the damage that got past the wall. */
        /* A `way:` GATE IS `thisWayMet`'s (v3.95), never a fourth branch
           here: it is the ONE evaluator for "what did this resolution
           actually do", and two copies drift into a condition that is
           read in one place and answered in the other. The trace is the
           same object the pre-run loop passes, so the two cannot disagree
           about what a `way:` name means.

           IT IS READ AFTER `pend.onHit` HAS RUN — the granted ability's
           own first op is what sets the trace, and this loop sits below
           that call for exactly that reason (v3.60's sequencing). */
        const met = /^way:/.test(cond)
            ? thisWayMet(cond, {disc: n._discWay, dmg: n._dmgWay, ars: n._arsWay, took: n._tookWay})
          : cond==="charged" ? (act(n).hist.charged||0)>0
          : /^chargedPitch\d$/.test(cond) ? n.pend.chargedPitch === +cond.match(/\d+/)[0]
          : cond==="marked" ? !!foe(n).marked
          : cond==="pumped" ? (n.pend._struck != null ? n.pend._struck : (n.pend.total||0)) > (pc.power||0)
          /* THREE CONDITIONS REACHED HERE AND ANSWERED FALSE (v3.96).
             Measured by asking the PARSER which conds the pool actually
             puts into `condOnHit`: SEVEN, and this evaluator knew four.
             Goon Beatdown's boo, Goon Tactics' mill and Hot on Their
             Heels' mark were granted, carried onto the link, and then
             refused by a gate nobody had taught — all three reading
             `tier: full`, because the HEAD parses.

             `CONDONHIT_CONDS` is the census now, and a drill fails if the
             pool ever emits one this list does not name. That is v3.35's
             fix for `PENDING_KINDS` and v3.91's for the attack-reaction
             condition list, applied to
             the second, smaller copy of a condition vocabulary. */
          : /^auras\d+$/.test(cond) ? (act(n).board||[]).filter(b=>b.kind==="aura").length >= +cond.slice(5)
          : /^drac\d+$/.test(cond) ? P.dracLinks(n.chain) >= +cond.slice(4)
          /* FUSED IS A DECLARATION-TIME FACT — how the card was PLAYED,
             which no board state can answer at the hit. It rides on `pend`
             for `chargedPitch`'s reason, and a link built without it
             answers FALSE: weaker than printed and visible (v3.24). */
          : cond==="fused" ? !!n.pend.fused
          : false;
        if(met) n = runOps(n, [op], pc.name);
        /* AND THE REFUSAL NAMES THE RIGHT CONDITION. The `else` here read
           "needed a differently-coloured charge" for EVERY cond it does not
           know — so an unknown gate reported itself as a charge problem on
           a card with no charge in it, which is the feed lying about a rule
           (v2.83's category, one board over). */
        else n = L(n, `${pc.name}: the granted on-hit bonus needed ${cond==="charged"?"a charge this turn":cond==="marked"?"the target to be marked":cond==="pumped"?"its {p} above its base":cond==="way:took"?"the card it was printed to take — that zone was empty":/^auras(\d+)$/.test(cond)?`${cond.slice(5)} or more auras on your board`:/^drac(\d+)$/.test(cond)?`${cond.slice(4)} or more Draconic chain links`:cond==="fused"?"this to have been fused":/^chargedPitch\d$/.test(cond)?"a differently-coloured charge":"`"+cond+"`"} — condition not met.`);
      });
    }
    if(n.pend.runeOnHit && total>0){ const many = n.pend.runeOnHit; n = mkRune(n, many);
      n = L(n, `${pc.name} connects — ${many>1?`${many} Runechants are`:"a Runechant is"} forged (now ${runeCount(act(n))}), poised for your next swing.`); }
    /* ---- A WEAPON THAT HITS EARNS ITS COUNTERS -----------------------
       "The second time this hits each turn, put a +1{p} counter on it."

       The per-turn hit tally lives on `hist`, keyed by the piece's uid,
       for one reason: CR 4.4.4 already clears `hist` at the turn
       boundary, so "each turn" needs no reset site of its own. Put on
       `counters` beside the rust it would then never be cleared, and the
       blade would reach its second hit once and count every swing after
       that as a second one.

       The counters themselves DO live on `counters[uid].pow`, because
       they persist across turns by ruling — see the end-phase wipe in
       `endTurn`, which is the only thing that removes them. */
    if(total>0 && n.pend.from==="weapon"){
      const hits = ((act(n).hist.wpnHits||{})[pc.uid]||0) + 1;
      actMut(n).hist = {...act(n).hist, wpnHits:{...(act(n).hist.wpnHits||{}), [pc.uid]:hits}};
      const hc = fxParse(pc).hitCounter;
      if(hc && hits === hc.nth){
        const cur = act(n).counters[pc.uid]||{};
        const now = (cur.pow||0) + hc.amt;
        actMut(n).counters = {...act(n).counters, [pc.uid]:{...cur, pow:now}};
        n = L(n, `${pc.name} connects again — a +${hc.amt}{p} counter is forged onto it (now +${now}{p}, and it keeps them while it keeps hitting).`);
      }
    }
    /* ---- A WEAPON THAT HITS MAY SWING AGAIN (Dorinthea) --------------
       "Once per turn Effect - When a weapon you control hits, you may
       attack an additional time with that weapon this turn."

       CR 7.5.5 defines a hit as damage actually DEALT, so `total>0` is
       the whole test: an attack prevented or blocked down to nothing
       never hit, and refreshes nothing.

       The permission is exactly ONE thing — the weapon's own "Once per
       Turn" limit is lifted for one more activation. `weaponUsed[uid]`
       IS that limit in this trainer, so the ability is modelled by
       clearing that one key and nothing else: the extra swing then walks
       the ordinary tryPlay path and pays the printed {r} and an action
       point like any other activation (RULING, user 2026-08-09). Handing
       it a free action point here would make the hero strictly stronger
       than printed, which is the direction that steals games.

       "That weapon" is literal — only the piece that hit is untapped.

       The latch rides on `hist`, which CR 4.4.4 clears at the turn
       boundary, so "Once per turn" needs no separate bookkeeping. It is
       spent by TRIGGERING rather than by being used, so a second hit in
       the same turn does not refresh again — which is exactly why the
       Dawnblade is printed to reward its SECOND hit each turn and not
       its third. */
    /* ---- ARAKNI, TARANTULA (v3.77) ---------------------------------
       "Whenever a DAGGER you own hits a HERO, they lose 1{h}."

       An Agent's own static, and the first thing the transformation
       actually pays out: Mark of the Huntsman x2 is in her gear and is a
       real swinging Dagger, so the event exists on the board she plays
       with. Without a readable Agent static, becoming one was a net
       DOWNGRADE — she lost her stealth passive and gained an ability
       nothing reads.

       "LOSE {h}" IS READ AS DAMAGE HERE, which is the reading the parser
       already gives the printed phrase one rule over ("they lose N{h}" ->
       `dmg`). The CR distinguishes life loss from damage; nothing in this
       pool does yet, and inventing a second model for one Agent would be
       two descriptions of one rule. `runOps`' `dmg` subtracts from the
       DEFENDER and stands in front of no prevention, which is what a life
       loss wants anyway.

       THE PIECE MUST BE A DAGGER, read off its printed type line — she
       also swings nothing else, but a passive that fires on any weapon is
       a passive that is wrong the moment she equips one.

       AND THE PRINTED SUBJECT IS AN OBJECT, NOT A ROUTE. The first draft
       gated on `from === "weapon"` too, and that is a restriction the
       card does not print: "a dagger you own hits a hero" says nothing
       about HOW it hit. `pc` is the resolving card on every route, so the
       type test is well defined for all of them and is the only thing the
       line actually restricts. Measured before dropping it — the pool
       prints exactly two Dagger records and both are Weapons, so nothing
       moves today; a Dagger-typed ally or attack card would have been
       silently refused, which is v3.65's ally-attack route one card over.

       `total > 0` CAME OFF WITH IT, AND THAT ONE WAS DEAD. Both callers
       derive `heroHit` as a conjunction that already includes it (the
       trainer `total > 0`, judge `total > 0 && not an ally`), so the
       extra test could never fire on its own — a second description of
       CR 7.5.5 sitting beside the one that governs. Sabotage found it, as
       it found v3.67's identical `off > 0`: dead RULES code is worse than
       dead code elsewhere, because it reads as a rule somebody can reach. */
    if(heroHit && bAct(n).daggerDrain && /\bdagger\b/i.test((pc.tt)||"")){
      const _dd = bAct(n).daggerDrain;
      /* THE REASON FIRST, THEN THE OP'S OWN LINE. `dmg` reports "1 damage"
         and says nothing about why; announcing after it reads as a second,
         separate hit. In a training sim the sequence IS the lesson. */
      n = L(n, `${pc.name} bites — a dagger of ${act(n).name}'s, and ${act(n).name} is the Tarantula.`);
      n = runOps(n, [["dmg", _dd]], pc.name);
    }
    /* ---- REFRACTION BOLTERS (v3.93) ---------------------------------
       "When a weapon attack you control HITS, you may destroy this. If
        you do, the attack gets go again."

       THE WATCHER IS A LEGS PIECE, not the swinging weapon, so the scan
       is over gear AND the arena — one body with Magmatic Carapace's and
       Beaten Trackers' (`offerPayCost`).

       "A WEAPON ATTACK YOU CONTROL" IS THE ROUTE, not the card: `from`
       is what `execute` decided when it picked its branch, and the two
       sites either side of this one already ask the same question the
       same way.

       AND THE OFFER CANNOT BE ANSWERED BEFORE THE LAYER SETTLES. A
       prompt is drained by `openPrompt` at the tail of the caller, and
       both callers null `pend` first — so the grant arrives after the
       action point has been spent five lines below. See `settleLateGa`:
       CR 5.3.5 makes go again a GAIN of one action point, so the point
       IS the grant, and the link is marked so the chain display agrees
       with what happened. */
    if(total>0 && n.pend.from==="weapon")
      n = offerPayCost(n, "weaponHit", null, {lateGa: true});
    if(total>0 && n.pend.from==="weapon" && bAct(n).weaponRefresh && !act(n).hist.wpnAgain){
      actMut(n).hist = {...act(n).hist, wpnAgain:1};
      const wu = {...(act(n).weaponUsed||{})}; delete wu[pc.uid];
      actMut(n).weaponUsed = wu;
      n = L(n, `${pc.name} connects — your hero ability frees it for one more swing this turn.`);
    }
    /* CRUSH RUNS THE CARD'S OWN RIDER (v3.16). This site used to run
       Boulder Drop's payload — a card from hand onto their deck — for
       EVERY crush card in the pool, so Buckling Blow's -1{d} counter,
       Wee Wrecking Ball's arsenal destruction and nine others were not
       merely unbuilt but SUBSTITUTED. All twelve reported `tier: full`,
       because the parser filed the whole family behind one noop whose
       text described Boulder Drop and claimed the rest.

       The threshold is the card's own printed number, not a literal 4. */
    { const cr = fxParse(pc).crush;
      /* CRUSH PRINTS "damage to a HERO" on all 15 pool cards, and the
         reader's own anchor requires those words — so an ally hit never
         crushes, however large it is (v3.45). */
      if(cr && total >= cr.n && (!cr.heroOnly || heroHit)) n = runOps(n, cr.ops, pc.name + " — crush");
      else if(cr && total >= cr.n && cr.heroOnly && !heroHit)
        n = L(n, `${pc.name} crushed an ally — crush asks for damage to a hero.`);
      else if(hasKw(pc,"crush") && total >= 4 && !cr)
        n = L(n, `Crush lands, but ${pc.name}'s rider is not built — it needs a schedule for the opponent's next turn.`); }
    /* A CARD THAT ASCENDS MUST LEAVE WHATEVER HOLDS IT. It is in the
       graveyard for a caller that files at declaration and on the combat
       chain for one that files at the close step, and taking it out of
       only one of those puts a card in two zones — invariants.js's
       loudest error, and ours rather than a caught one. */
    if(n._soulSelf){ delete n._soulSelf;
      if(total>0){ n = liftSelf(n, pc);
        actMut(n).soul = [...act(n).soul, pc]; n = L(n, `${pc.name} ascends to the soul.`); }
    }
    n.featured = {card:{name:pc.name,img:pc.img,dbImg:pc.dbImg,pitch:0}, chip:`LINK ${n.chain.length} — ${total} DMG`};
    if(n._gaGrant){ n.pend = {...n.pend, ga:true}; delete n._gaGrant; }
    actMut(n).hist = {...act(n).hist, atk:act(n).hist.atk+1};
    actMut(n).ap = n.pend.ga ? act(n).ap : act(n).ap-1;
    if(n.pend.ga) n = L(n, "Go again — action point kept.");
    return {game:n, total};
  };

  const resolveStack = (s) => {
    /* THE ONLY THING THIS BODY NEEDS TO KNOW IS WHETHER THERE IS A LINK
       (v2.77). It used to ask `mode!=="stack"` as well — the trainer's
       name for "the attack is declared and awaiting resolution" — which
       is a statement about the trainer's board, not about the card. The
       trainer's own wrapper asks the same question one line above the
       call, so nothing changes for it; what changes is that a caller
       driving `phase`/`step` is no longer refused by a vocabulary it does
       not speak. */
    if(!s.pend) return s;
    let n = {...s};
    const defLs = n.stack.filter(l=>l.k==="def");
    /* THE DEFENDER COUNTS ARE READ BEFORE THE WALL IS SPENT, and handed to
       `linkPumps` (v3.71): the late conditions ask about the attack's
       POWER, which is settled before anything is subtracted. Counting them
       from the DECLARATIONS rather than from the loop below is also the
       more faithful reading — a card is declared as a defender whether or
       not the loop later finds it. */
    const _pre = linkPumps(n, {equipDefenders: defLs.filter(l=>l.gi!=null).length,
                               defenders: defLs.length,
                               handBlockers: defLs.filter(l=>l.gi==null).length,
                               /* WHICH CARDS defend is this board's answer
                                  (v3.74) — the trainer holds them as stack
                                  layers pointing into the defender's hand. */
                               defAtkAction: defLs.some(l => l.gi == null
                                 && isAtkActionCard((foe(n).hand||[]).find(x=>x.uid===l.uid)))});
    n = _pre.game;
    const pumps = _pre.pumps;
    let total = _pre.total;
    let blkNote = "";
    /* non-equipment defenders are what dominate, reprise and "defended by
       fewer than 2" all actually care about — count them for real */
    let handBlockers = 0;
    if(defLs.length){
      /* CR: every defender's printed defence sums, and the total reduces the
         attack once — so report each card's real defence, not a running
         remainder that makes the last blocker look weaker than it is. */
      const parts = [];
      let wall = 0;
      /* HOW MANY CARDS FROM HAND ARE DEFENDING, counted BEFORE the loop.
         "Unity — when this defends together with a card from hand" is a
         fact about the whole wall, and a piece read mid-loop would see
         only the defenders declared before it. */
      const handDefenders = defLs.filter(d => d.gi == null).length;
      for(const dl of defLs){
        if(dl.gi != null){
          const piece = foe(n).gear[dl.gi];
          /* the WEAR is gearDef's; the situational buff is the card's */
          const _gv = defendValue(foe(n), piece,
            {base: gearDef(piece), weaponAttack: n.pend && n.pend.from === "weapon",
             atkCard: n.pend && n.pend.card, handDefenders});
          wall += _gv;
          foeMut(n).gear = foe(n).gear.map((x,ix)=>ix===dl.gi?gearBlockApply(x):x);
          /* an equipment that has blocked is spent for the rest of this chain */
          foeMut(n).chainBlocked = [...(foe(n).chainBlocked||[]), piece.uid];
          parts.push(`${piece.name} ${_gv}`);
        } else {
          const c = foe(n).hand.find(x=>x.uid===dl.uid);
          if(!c) continue;
          /* the DEFENDING side is the foe of whoever is swinging */
          const _dv = defendValue(foe(n), c,
            {weaponAttack: n.pend && n.pend.from === "weapon", atkCard: n.pend && n.pend.card,
             handDefenders});
          wall += _dv;
          foeMut(n).hand = foe(n).hand.filter(x=>x.uid!==dl.uid);
          foeMut(n).grave = [c, ...foe(n).grave];
          handBlockers++;
          parts.push(`${c.name} ${_dv}`);
        }
      }
      const stopped = Math.min(wall, total);
      total = Math.max(0, total - wall);
      blkNote = ` Wall of ${wall} — ${parts.join(", ")} — stops ${stopped}.`;
    }
    foeMut(n).blockedHand = handBlockers;
    foeMut(n).hp -= total;
    /* Runechants no longer pop here. They trigger on PLAY and resolve above
       the attack on the stack, so they are dealt with at declaration in
       `execute`. `rd` stays 0 so the messages and hitSeq maths below read
       the same shape. */
    const _out = linkPayload(n, {total, pumps, blkNote,
                               /* the trainer has no ally targeting wired, so a
                                  resolved attack always landed on the hero */
                               heroHit: total > 0});
    n = _out.game;
    n.chainOpen = true;
    /* The link has resolved and the stack is empty. WHERE THAT LEAVES THE
       GAME is the caller's (CR 7.6.3 hands priority back to the
       turn-player); the trainer's wrapper says `mode:"act"`. */
    n.stack = []; n.pend = null;
    return openPrompt(winCheck(n));
  };

  /* ---- IYSLANDER, CLAUSE 2 (v3.36) ---------------------------------
     "Whenever you play an ICE card during an opponent's turn, create a
     Frostbite token under their control."

     IT WAS A CLOSURE INSIDE `Battle`, so the table had none of it: an
     Ice card played on the opponent's turn created nothing at all, which
     is half of Iyslander's hero ability missing on the board she is
     meant to be played on. `execute` calls it, and so do the trainer's
     two bespoke opponent-turn routes — those reach `runOps` directly and
     never pass through `execute`, so a body that lived only in `execute`
     would have taken the rule AWAY from the board that had it.

     THE TALENT IS READ OFF `ty`, THE STRUCTURED ARRAY (v2.44). The
     trainer asked `/ice/i.test(c.tt)`, which is clean across this pool
     only by accident — nothing stops a future type line carrying "ice"
     inside another word, and that is the "Reaction contains action" trap
     with a different substring. The array names the talent exactly.

     "DURING AN OPPONENT'S TURN" IS `turnPlayer`, which both boards
     genuinely maintain — the trainer derives it through `withPriority`
     and it reads 1 in `block` and `foeturn` alike, verified rather than
     assumed (v2.83: a field that is present, plausible and never updated
     reads as an answer). It is not a phase, so asking it does not make
     `effects.js` phase-aware.

     THE TOKEN IS RESOLVED FROM THE DATABASE, never described here — the
     golden rule at the hero-ability level. That is what makes it
     countable by "3 or more auras", destroyable by "destroy an aura",
     and taxing through `frostCount`. */
  function foeTurnIce(n, card){
    if(!card || !bAct(n).iceFrostbite) return n;
    if(n.turnPlayer == null || n.turnPlayer === actorOf(n)) return n;
    const ty = card.ty || [];
    if(!ty.some(t => /^ice$/i.test(String(t)))) return n;
    return runOps(n, [["token", "Frostbite", 1, "foe", null]],
                  `${act(n).name}'s winter`);
  }

  return {runOps, execute, afterDefenders, resolveClash, resolveStack, afterDiscard, payAddCost, fileAttack, allyDeath,
          linkPumps, linkPayload, attackRx, preventDamage, autoPitch, applyAnswer,
          activateHandAbility, foeTurnIce, takeInstantNext,
          /* EXPOSED FOR HEAVE (v4.05). `heave` is module-level — it returns
             `{game,msgs,ops}` rather than threading `n` — so it could not
             reach this closure, and v3.71 recorded it as "a THIRD site that
             sets `_faceUp` and fires no trigger", latent and left alone
             rather than half-moved.

             Exposing the ONE body is what closes it without growing a
             second copy of the trigger reading: both heave call sites hold
             an effects context, so they call this after the put exactly as
             `applyAnswer` does. */
          faceUpArsenal};
}

/* ---- FROSTBITE'S END-PHASE THAW (v2.74) ------------------------------
   The other half of the token's one printed sentence: "At the beginning
   of your end phase OR when you play a card or activate an ability,
   destroy Frostbite." The play half is inside `execute`; this is the half
   that clears a Frostbite the frozen player never spent anything into, so
   a tax that was never paid cannot follow them into the next turn.

   IT IS A PURE FUNCTION AND THAT IS THE POINT. The trainer's end phase is
   a closure inside `Battle`, so a drill cannot reach it and the only
   available check would be a source scan — and a scan is satisfied by a
   variable that survives deleting the gate it lives in, which is exactly
   how v2.68 shipped a drill that stayed green against `if(false)`. This
   version's first attempt at that drill did the same thing and the
   sabotage pass caught it. So the decision moves somewhere it can be
   DRIVEN, the way `parser.idleCounterWipes` and `parser.rxPump` were
   extracted before it.

   It returns `{game, thawed}` rather than the bare game, deliberately:
   `resetAllyLife` returns THE GAME, and the CR review found a call site
   reading `out.game` off it and silently falling back to the unchanged
   state — the ally reset then ran only in the log. A shape that cannot be
   half-read is worth the extra word.

   A token that leaves the arena ceases to exist, so nothing is filed to a
   graveyard — the same rule `popRunechants` documents. */
/* ---- INERTIA, WHICH WAS NEVER AN ACTION-PHASE TAX (v2.75) ------------
   The noop said "inertia — dummy has no action phase". The census says
   the reason was wrong about the MECHANIC, not just about the prop. The
   printed token, verbatim:

     Inertia — "Generic Token - Aura"
     "At the beginning of your end phase, destroy Inertia, then put all
      cards from your hand and arsenal on the bottom of your deck."

   It is not a tax on anything. It is a HAND WIPE at end of turn, and it
   is the harshest token in the pool — which is why it being inert was
   worth two real cards (Lace with Inertia, Inertia Trap) doing nothing.

   Structurally it is Frostbite's end-phase half with a bigger payload, so
   it lives beside `thawFrost` and is called from the same shared body.
   Same `{game, …}` shape, and for the same reason: `resetAllyLife`
   returns the bare game and a call site read `out.game` off it, so CR
   4.4.3a ran only in the log for several versions.

   The cards go to the BOTTOM of the deck, not the graveyard — so nothing
   is stamped `_gy` and "discarded this turn" riders must not see them. */
/* THE TOKEN IS FOUND BY ITS PRINTED TEXT, NOT BY ITS NAME (v4.03).

   This read `P.norm(b.card.name) === "inertia"` — a card special-cased by
   name, which is the golden rule broken at the top of CLAUDE.md, and
   exactly v3.22's Runechant defect one token over: built by name, while
   the parser filed its clause `skip` and the token reported `tier: none`.

   `parser.isHandWipe` reads the clause instead, so the token reports
   `full` and a second card printing the same wipe would work for free.
   Measured: Inertia is the pool's only such record today. */
const isInertia = b => !!(b && b.card && P.isHandWipe(b.card));
function resolveInertia(game, seat){
  const sides = (game.sides || []).slice();
  const sd = Object.assign({}, sides[seat]);
  const tokens = (sd.board || []).filter(isInertia).length;
  if(!tokens) return {game, tokens: 0, wiped: 0};
  const hand = sd.hand || [];
  const ars = sd.arsenal ? [sd.arsenal] : [];
  sd.board = (sd.board || []).filter(b => !isInertia(b));
  sd.deck = [...(sd.deck || []), ...hand, ...ars];
  sd.hand = [];
  sd.arsenal = null;
  sides[seat] = sd;
  return {game: Object.assign({}, game, {sides}), tokens, wiped: hand.length + ars.length};
}

/* ---- SUSPENSE TICKS AT THE BEGINNING OF THE TURN (v3.00) -------------

   RULING 2026-07-25: "just like the other 'counters' these are often
   represented by dice and 'tick' down at the beginning of the turn.
   unlike steam-powered it is destroyed immediately when it has none. The
   effect activates when the aura is destroyed" — and the follow-up,
   "suspense always comes in with 2 counters".

   So the keyword is a DELAY, and until v3.00 it was a bonus: the payload
   was queued on PLAY, so Act of Glory handed you +6{p} the moment the
   aura landed rather than two turns later. Five pool cards, all Guardian
   auras, all reporting `tier: full` — the keyword parsed to a `noop`,
   and a noop counts as accounted for.

   PURE, AND OUT HERE, for the same reason `thawFrost` and
   `resolveInertia` are: the trainer's turn boundary is a closure inside
   `Battle` and judge.js has its own, so a rule written into either one is
   a rule the other board does not have. That is how phantasm came to work
   on one board only. This returns the payload ops for the CALLER to run,
   rather than running them, because "your next attack this turn gets
   +N{p}" is an actor-relative effect and the two boards reach `runOps`
   differently.

   It returns `{game, fired, msgs, ops}`: `fired` names the auras that
   left, `ops` is what they pay out. */
/* TURN ON WHAT WAS ARMED AGAINST THIS SIDE'S TURN (v3.29).

   Called at the top of a seat's turn by BOTH boards, beside
   `tickSuspense`. It is a separate function rather than a branch inside
   that one because `tickSuspense` returns early when nothing is
   suspended — piggybacking there would arm nothing on most turns, which
   is the quiet half of "a schedule is written per board". */
function armNextTurn(game, seat){
  const sides = (game.sides || []).slice();
  const sd = Object.assign({}, sides[seat]);
  const list = sd.nextTurn || [];
  if(!list.some(e => e && !e.ready)) return {game, msgs: []};
  sd.nextTurn = list.map(e => (e && !e.ready) ? {...e, ready: true} : e);
  sides[seat] = sd;
  return {game: Object.assign({}, game, {sides}),
          msgs: [sd.name + " starts the turn under " + sd.nextTurn.filter(e=>e&&e.ready).length
                 + " lingering effect(s)."]};
}

function tickSuspense(game, seat){
  const sides = (game.sides || []).slice();
  const sd = Object.assign({}, sides[seat]);
  const board = sd.board || [];
  if(!board.some(b => (b.susp || 0) > 0)) return {game, fired: [], msgs: [], ops: []};

  const msgs = [], fired = [], ops = [], keep = [], grave = [];
  for(const b of board){
    if(!(b.susp > 0)){ keep.push(b); continue; }
    const left = b.susp - 1;
    if(left > 0){
      keep.push(Object.assign({}, b, {susp: left}));
      msgs.push(b.card.name + " ticks down — " + left + " suspense counter" + (left === 1 ? "" : "s") + " left.");
      continue;
    }
    /* DESTROYED IMMEDIATELY AT ZERO, and the payload fires because it
       left the arena — which is what the printed "when this leaves the
       arena" clause has been waiting for. */
    fired.push(b.card.name);
    grave.push(b.card);
    const pay = (P.fxParse(b.card).onLeave || []);
    ops.push(...pay);
    msgs.push(b.card.name + " runs out of suspense and leaves the arena" +
      (pay.length ? " — and it pays out." : "."));
  }
  if(!fired.length && !msgs.length) return {game, fired: [], msgs: [], ops: []};
  sd.board = keep;
  if(grave.length) sd.grave = [...grave.map(c => Object.assign({}, c, {_gy: game.turn})), ...(sd.grave || [])];
  sides[seat] = sd;
  return {game: Object.assign({}, game, {sides}), fired, msgs, ops};
}

/* ---- THE ARENA HAS A CLOCK, AND IT RUNS ON BOTH BOARDS (v3.07) ------

   Five pool cards print a self-destruct schedule and the parser has read
   all five for a long time. `runOps` stashes the answer as `_selfDestruct`
   and `execute` stamps it onto the board entry as `sd`, so the card is
   already carrying its own expiry the moment it enters the arena.

   Nothing was reading it correctly:

     sd:"turn"   swept in the TRAINER only, inline inside `newTurn`
     sd:"end"    swept on NEITHER board — three versions, no reader

   The "end" half is the worse of the two and it is above rate rather
   than below it. Concealed Object is an Item printing "Instant - {t}:
   Target attack gets +1{p}" and "At the beginning of your end phase,
   destroy this" — the tap is what makes it once, and the destroy is what
   makes it once EVER. Never destroyed, it untaps at CR 4.4.3d and hands
   its controller a free +1{p} every turn for the rest of the game.
   Pyroglyphic Protection is the same shape in the other zone: prevent
   1-3 arcane damage, forever, at the table.

   NO TOOL HERE COULD SEE IT and each one missed it for its own reason.
   Coverage reads both cards `full` — the clause IS read, faithfully, and
   the op IS consumed by `runOps`. The fairness sweep is five checks over
   a card's PARSE and this is a defect in the board's turn boundary.
   `failstates.js` has a "no schedule to fire on" category and files a
   card there by looking for UNREAD text, so a schedule that parses and
   then evaporates is exactly the case it cannot reach.

   The general shape, third time this cycle: A SCHEDULE IS WRITTEN PER
   BOARD. `effects.js` holds the semantics once and the two turn
   structures each write their own clock, so a rule kept in one of them is
   a rule the other does not have. Pure, exported, and it RETURNS the
   payload ops rather than running them — same contract as `tickSuspense`
   beside it, for the same reason: an `onLeave` payload is actor-relative
   and the two boards reach `runOps` differently.

   `when` is the schedule to run, never "everything expiring": "turn" at
   the top of the controller's turn, "end" at the beginning of their end
   phase. Passing the wrong one would sweep a card a whole phase early. */
/* WHAT A DEFENDER IS ACTUALLY WORTH (v3.23).

   Both walls read `c.def || 0` — the PRINTED number — so a card whose
   defence is modified while it defends was blocking for the wrong value
   on both boards. Briar's Embodiment of Earth prints "non-attack action
   cards you control get +1{d} while defending" and did nothing at all.

   ONE BODY, BOTH WALLS. The wall itself stays the caller's — the trainer
   holds defenders on `foe(n).hand`, judge on `sd.blockH`, and that split
   is deliberate — but what a single card is WORTH is card semantics and
   belongs here, or the two boards drift on the number.

   THE SUBJECT IS READ OFF THE STRUCTURED TYPE ARRAY. `ty` is the
   authority and `tt` is a display string the database contradicts on five
   records; "Reaction" also contains the substring "action", so a loose
   `tt` test hands a defence reaction a buff its text never granted. An
   attack action card carries BOTH Action and Attack, so excluding Attack
   is what makes this "non-attack action cards" rather than "action
   cards". A Defense Reaction carries no Action at all and is correctly
   left out — it is not an action card.

   Only the AURA's controller's board is consulted, because the printed
   phrase is "cards YOU control". */
/* BOTH PREDICATES ARE THE PARSER'S, AND THERE IS ONE BODY (v3.78).
   `isNonAtkActionCard` was written here, MOVED to parser.js at v3.31 when
   `qualMatches` also needed it — and a byte-identical copy stayed behind.
   Two bodies of one rule is the no-mirror rule broken inside the engine,
   and it is the shape that makes a sabotage silent: change one copy and
   the other keeps the drill green (v3.41's `quotedText`, exactly).

   Found while adding a THIRD sibling — `isActionCard`, the union of the
   two, for Lyath's "defending action cards". Adding a duplicate beside a
   duplicate is the moment to collapse them. */
const isNonAtkActionCard = P.isNonAtkActionCard;
const isActionCard = P.isActionCard;

/* IS THE SELF-BUFF'S PRINTED CONDITION MET RIGHT NOW?

   Three shapes so far, and each is answered from a different place —
   which is the whole reason this is a function and not a boolean:

     weaponAttack      a property of the INCOMING attack. The caller knows
                       it; nothing on the card or the side does.
     arcDealt          the defending side's own turn history.
     atkActionCostLe   the incoming attack CARD — its type and its cost.

   EVERY ONE DEFAULTS TO FALSE. A caller that does not supply what a
   condition needs gets the printed value, never the buffed one: a
   defender blocking for more than it prints because the caller was
   incomplete is the direction that steals games. */
function defSelfMet(self, defSide, opts){
  if(!self) return false;
  if(self.when === "weaponAttack") return opts.weaponAttack === true;
  if(self.when === "arcDealt")     return (((defSide || {}).hist || {}).arc || 0) > 0;
  if(self.when === "atkActionCostLe"){
    const a = opts.atkCard;
    if(!a) return false;
    /* the STRUCTURED array is the authority, and an attack action card
       carries both Action and Attack — a weapon swing carries neither */
    const ty = a.ty || [];
    const isAtkAction = ty.some(t => /^action$/i.test(String(t)))
                     && ty.some(t => /^attack$/i.test(String(t)));
    return isAtkAction && (a.cost || 0) <= self.cost;
  }
  /* a fact about the REST OF THE WALL — the two Unity pieces */
  if(self.when === "withHandDefender") return (opts.handDefenders || 0) > 0;
  /* the ZONE the card was played from — Springboard Somersault. By the
     time the wall asks, the card has left it, so the caller answers. */
  if(self.when === "fromArsenal")      return opts.fromArsenal === true;
  /* WAS THE OPTIONAL ADDITIONAL COST PAID? (v3.34) — Staunch Response.
     The answer belongs to the PLAY: the payment happened before the card
     resolved and nothing on the card records it, so the caller carries it
     the way it carries `fromArsenal`. */
  if(self.when === "addCostPaid")      return opts.addPaid === true;
  return false;                       /* an unread condition never fires */
}

function defendValue(defSide, card, opts){
  opts = opts || {};
  /* THE BASE IS THE CALLER'S WHEN IT KNOWS BETTER. A piece of equipment's
     current defence is `gearDef` — wear, Guardwell and destruction all
     live there — and re-deriving it here would be a second copy of the
     wear rules. A card from hand has no such state and uses its printed
     value. */
  let d = opts.base != null ? opts.base
        : ((card && card.def != null) ? card.def : 0);

  /* A STATIC ON THE BOARD, buffing OTHER cards — Briar's Embodiment. */
  for(const b of (defSide && defSide.board) || []){
    if(!b || !b.card) continue;
    const g = P.fxParse(b.card).defGrant;
    if(!g) continue;
    if(g.subject === "nonAttackAction" && !isNonAtkActionCard(card)) continue;
    d += g.amt;
  }

  /* A TURN-SCOPED GRANT HELD ON THE SIDE (v3.78) — Lyath's clause 2.
     The board walk above cannot see this one: it is fired by an ACTIVATED
     ability and applies to cards nowhere near the arena, so it lives on
     the defending side and is read here. `defSide` is already the
     CONTROLLER of the card being valued — "cards YOU control" — so no
     new argument is needed and no caller can forget to say. */
  if(isActionCard(card)) d += (defSide && defSide.defActionBuff) || 0;

  /* AND THE CARD'S OWN, gated on a property of the INCOMING attack (v3.24).
     "This gets +1{d} while defending a weapon attack" is answerable only
     where the attack is known, so the caller hands it in — the same split
     `heroHit` and the wall itself already keep. Absent, the buff does not
     apply: a defender must never block for more than it prints because a
     caller forgot to say what it was defending. */
  const self = card ? P.fxParse(card).defSelf : null;
  /* A DESTROYED PIECE IS NOT THERE, so its static does not apply. `gearDef`
     already answers 0 for one, and without this the buff would lift that
     back to 1 — a piece that has left the arena blocking for a point.
     Found by driving it, not by a drill. */
  if(self && !(card && card.destroyed) && defSelfMet(self, defSide, opts)) d += self.amt;

  /* A CHAIN-SCOPED SHIFT ON THIS PARTICULAR DEFENDER (v3.89, signed at
     v3.90). Two pool cards move one named defender's defence for the rest
     of the combat chain and they move it in OPPOSITE directions:

       Shred            "target card defending an Assassin attack gets
                         -2{d} this combat chain"
       Washed Up Wave   "if that card has watery grave, this gets +2{d}"

     SO THE ENTRY IS SIGNED AND THE FIELD IS NOT CALLED A DEBUFF. It was
     `defDebuff` for one version, and a field named for one direction that
     also carries the other is the same-name-different-meaning trap this
     project polices in `KNOWN_COLLISIONS`.

     KEYED BY UID, because both cards TARGET: a second defender of the
     same name is a different object and keeps its printed value.

     `defSide` is already the CONTROLLER of the card being valued, which
     is where the shift is held, so no caller can forget to say — the same
     reason Lyath's grant lives there (v3.78).

     IT ACCUMULATES rather than being assigned, or a second source on the
     same defender is silently dropped. The FLOOR below is what stops a
     negative: a defender blocking for less than nothing would ADD damage
     to the swing, which no printed text grants. */
  for(const e of (defSide && defSide.defMod) || [])
    if(e && card && e.uid === card.uid) d += e.d;

  return Math.max(0, d);
}

/* ONE DESCRIPTION OF THE OPTIONAL-COST OFFER (v3.20).

   The spec was written out at the `execute` queue site, and building the
   LEAVE half of "enters or leaves the arena" would have made a second
   copy, and fixing Condemn a third. Three hand-copied spec literals is
   the no-mirror rule broken inside one file — the shape this project
   deleted 51 times over at v2.20.

   THE UID IS THREADED HERE AND ONLY WHEN THE CARD ASKS FOR IT.
   `fxParse` memoizes on name|pitch, so the parse cannot carry a uid; and
   setting `notUid` unconditionally would quietly exclude the source from
   the cards whose text never prints "another". */
/* THE PAY-COST TWIN OF `optCostSpec` (v3.33). One description of the
   offer, so the two queue sites that raise it cannot drift — the same
   reason v3.20 collapsed three optCost literals into one builder.

   `avail` is deliberately LEFT OUT: `openPrompt` fills it from the asked
   seat's own resources, which is what keeps the sheet honest about who is
   paying. `pay` is what `applyPrompt` returns for the caller to charge —
   this module runs no effects and takes no resources. */
function payCostSpec(px, card, side){
  /* THE THIRD COST VERB (v3.93) — the price is the piece itself. It is
     still a `pay` sheet, because the shape of the question is identical
     (pay or decline, and the rider resolves only if you pay); what
     changes is what is spent, so the resource cost is 0 and `destroyUid`
     names the permanent. */
  if(px.destroySelf) return {
    tag:"pay", side, src:card.name,
    cost:0, ops:px.ops, taps:false, destroyUid:card.uid,
    title:"Destroy " + card.name + "?",
    hint:"Optional — decline and the rider does not resolve. Destroyed gear goes to the graveyard."
  };
  return {
    tag:"pay", side, src:card.name,
    cost:px.cost, ops:px.ops,
    taps:!!px.taps, tapUid:px.taps ? card.uid : undefined,
    title:"Pay " + px.cost + " to power " + card.name + "?",
    hint: px.taps
      /* SEAT-NEUTRAL ON PURPOSE. A hint CAN be second person (a prompt is
         addressed to one side) but it does not have to be, and the debt
         ledger is a budget rather than a licence. */
      ? "Optional — it taps, so it will not untap until CR 4.4.3d."
      : "Optional — decline and the rider does not resolve."
  };
}

/* THE MODAL OPTIONAL COST (v3.90) — one description of the offer, for
   `optCostSpec`'s reason (v3.20): the spec written out at each queue site
   is the no-mirror rule broken inside a single file, and there are two
   sites here.

   BOTH BRANCHES CONSUME EXACTLY ONE CARD and the rider asks about THAT
   card, so the keyword and the payload ride on the spec as DATA and
   `applyAnswer` asks — `prompts.js` runs no effects and decides no card
   semantics (v2.34, v3.47). */
function millCostSpec(mc, card, side){
  return {
    tag: "modal", side, src: card.name, optional: true,
    options: [
      {label: "Discard a card", ops: [["selfDiscard", 1]]},
      {label: "Destroy the top card of your deck", ops: [["deckDestroy", 1]]}
    ],
    costRider: {kw: mc.kw, ops: mc.ops, uid: card.uid, trigger: mc.trigger},
    title: card.name + " — pay to power it?",
    hint: "Optional. If the card you spend has " + mc.kw + ", the bonus applies."
  };
}

function optCostSpec(oc, card, side, leaving){
  const verb = oc.kind === "banish" ? "Banish" : oc.kind === "destroy" ? "Destroy"
             : oc.kind === "reveal" ? "Reveal" : "Discard";
  /* A REVEAL MOVES NOTHING (v3.33). The card is shown and stays where it
     was — the cost is the information, not the card. `prompts.js` already
     treats a pick with no `to` as a reveal that moves nothing, so the
     field is OMITTED rather than defaulted: sending it to the graveyard
     would spend a card the text never spends. */
  const spec = {
    tag:"pick", side, src:card.name,
    zone:oc.zone,
    filter:(oc.filter && oc.filter.notSelf) ? {...oc.filter, notUid:card.uid} : oc.filter,
    min:0, max:1, ops:oc.ops,
    title:verb + " to power " + card.name + (leaving ? " as it goes?" : "?"),
    hint: oc.kind === "reveal"
      ? "Optional — choose none to decline. The card is shown and stays in your hand."
      : "Optional — choose none to decline. The rider only resolves if you pay."
  };
  if(oc.kind !== "reveal") spec.to = (oc.kind === "banish" ? "banish" : "grave");
  /* "IT" IS THE CARD THAT MOVED (v3.92) — a STAMP the answer applies, not
     ops, for `arsStamp`'s reason (v2.34): this module runs no effects, so
     returning it as ops hands it to `runOps`, which applies it to the
     SOURCE. Opt-in, so every other optional cost keeps its shape. */
  if(oc.banStamp) spec.banStamp = oc.banStamp;
  return spec;
}

/* HEAVE — THE ARSENAL SET THAT PAYS (v3.32).

   Thunder Quake prints, in reminder text on the card and nowhere in the
   database:

     At the beginning of your end phase, if Thunder Quake is in your hand
     and you have an empty arsenal zone, you may pay {r}{r}{r} and put
     Thunder Quake FACE UP into your arsenal. If you do, create 3 Seismic
     Surge tokens.

   ONE BODY, BOTH BOARDS. The gate, the payment, the face-up put and the
   mint are card semantics; WHERE the player is asked is the turn
   structure's business, and both boards already pause at the arsenal step
   (judge's `arsenalFor`, the trainer's `mode:"arsenal"`).

   IT IS OFFERED AT THE ARSENAL STEP, NOT AT THE BEGINNING OF THE END
   PHASE, and that is a deliberate, stated approximation. CR 4.4.1 gives
   nobody priority in the end phase, so the only place a choice can be put
   to a player there is a pause the turn structure already owns — and this
   effect IS an arsenal set: it requires an empty arsenal and it fills the
   arsenal, so the step it lands in is the one it competes with. The one
   observable difference is a hand-sweep (Inertia) firing first, which
   already precedes the ORDINARY arsenal set on both boards, so heave is
   treated no differently from the thing it is. CR 4.1.8a hands the order
   of simultaneous triggers to the turn player and this engine does not
   model that choice; recorded rather than papered over.

   FACE UP IS A DIFFERENT EVENT from the normal face-down set (v2.33), and
   the stamps are the ones the arsenal machinery already reads. */
/* `uid` is optional and NAMES A CARD. Without it the first eligible card
   in hand is offered, which is the whole answer while Thunder Quake is the
   pool's only heave printing — but a hand holding two of them would then
   have the second permanently unreachable, and `heave` checks its uid
   against whatever this returned. A card the player cannot choose is the
   same defect as a dead button. */
function heaveOffer(game, seat, uid){
  const sd = ((game.sides || [])[seat]) || {};
  if(!P.arsEmpty(sd)) return null;
  for(const c of (sd.hand || [])){
    if(uid != null && c.uid !== uid) continue;
    const h = P.heaveOf(c);
    if(!h) continue;
    /* AFFORDABLE FROM FLOATING RESOURCES. Pitching for it is not offered:
       CR 4.4.3c sends the pitch zone to the bottom of the deck two steps
       later and CR 4.4.3e fizzles what is left, so a seat that pitched
       here would be paying with cards for a discount it cannot bank. The
       resources it CAN spend are ones it is about to lose anyway. */
    if((sd.res || 0) < h.n) continue;
    return {card: c, uid: c.uid, n: h.n};
  }
  return null;
}

/* Pays for it and performs the put. Returns `{game, msgs, ops}` — the ops
   mint the tokens, and the caller runs them, for the reason `sweepArena`
   and `beginEndPhase` already give: an op is actor-relative and the two
   boards reach `runOps` differently. */
function heave(game, seat, uid){
  const offer = heaveOffer(game, seat, uid);
  if(!offer) return {game, msgs: [], ops: []};
  const sides = game.sides.slice();
  const me = Object.assign({}, sides[seat]);
  me.res = (me.res || 0) - offer.n;
  me.hand = (me.hand || []).filter(c => c.uid !== offer.uid);
  /* THE SAME STAMPS THE FACE-UP ARSENAL MACHINERY ALREADY READS (v2.33).
     `_upTurn` is what makes "this turn" mean this turn.

     HEAVE DOES WHAT THE CARD PRINTS, ON ITS OWN (v4.05). A first attempt
     at firing the trigger split this in two — heave putting the card face
     DOWN and the call site turning it up — and that is the wrong contract
     for a module-level function two boards call: a two-call pairing is
     exactly the kind a caller forgets, and this project's whole ledger is
     made of rules that existed on one board. The card goes up here, and
     the TRIGGER is fired by the call site through the one reader, which
     takes `already` for precisely this case. */
  me.arsenal = Object.assign({}, offer.card, {_faceUp: true, _upTurn: game.turn});
  sides[seat] = me;
  const n = Object.assign({}, game, {sides});
  return {
    game: n,
    /* A COLON, NOT A VERB. The feed names the seat (v2.83) and the seat is
       called "You" on one board and "Bravo" on the other, so any inflected
       verb reads wrong for one of them. */
    msgs: [(me.name || ("seat " + seat)) + ": heave — " + offer.n
      + " paid, and " + offer.card.name + " is set FACE UP in the arsenal."],
    /* THE COUNT IS THE KEYWORD'S PARAMETER, not a literal 3. */
    ops: [["token", "Seismic Surge", offer.n, "self"]]
  };
}

function sweepArena(game, seat, when){
  const sides = (game.sides || []).slice();
  const sd = Object.assign({}, sides[seat]);
  const board = sd.board || [];
  const dying = board.filter(b => b.sd === when);
  if(!dying.length) return {game, fired: [], msgs: [], ops: []};

  const msgs = [], fired = [], ops = [];
  const kept = board.filter(b => b.sd !== when);
  for(const b of dying){
    fired.push(b.card.name);
    /* WHAT A DEPARTING CARD PAYS OUT, from two places, and the two are
       different printed sentences rather than two readings of one:

         onLeave           "when this leaves the arena, X" — a trigger
         ops AFTER the     "at the start of your turn, destroy this,
         selfDestruct       THEN X" — the schedule's own payout

       Taking the ops after the destroy rather than all of them is what
       keeps an on-play static out of the payout: Pyroglyphic Protection
       reads `[arcShield 3, selfDestruct turn]`, so its shield is not
       re-granted on the way out, while Might reads `[selfDestruct turn,
       buffNext 1]` and pays. Printed order does the work — no card is
       named here and no kind is stored on the entry.

       `tickSuspense` already pays `onLeave` when a counter runs out; a
       card leaving on its own printed clock has left the arena just as
       much, so it pays here too rather than only under the keyword that
       happened to be built first. */
    const f = P.fxParse(b.card);
    const di = (f.ops || []).findIndex(o => o[0] === "selfDestruct");
    const pay = [...(di >= 0 ? f.ops.slice(di + 1) : []), ...(f.onLeave || [])];
    /* THE LEAVES HALF of "when this enters or leaves the arena" (v3.20).
       It queues rather than resolves, because the cost is a CHOICE — and
       it goes out as a `pickPrompt` op rather than onto `promptQ`
       directly, because `sweepArena` is pure and returns its payload for
       the caller to run. That is the same contract `tickSuspense` keeps,
       and it is what lets both boards call this one body.

       THE EXCLUSION IS LOAD-BEARING RIGHT HERE. `sd.grave` below already
       holds the departing card by the time these ops run, so a Sigil of
       Silphidae asking for "another aura from your graveyard" is looking
       straight at itself. `notUid` is what stops it eating itself for a
       free point of arcane damage. */
    const oc = f.optCost;
    if(oc && oc.trigger === "entersLeaves")
      pay.push(["pickPrompt", optCostSpec(oc, b.card, seat, true)]);
    /* ---- A DESTROYED ALLY HAS DIED (v3.47) --------------------------
       "Destroy" and "dies" are the same event for a living object: the
       ally is put into the graveyard, so "when this dies" fires. Oysten
       is the pool's only death trigger and this became reachable the
       moment something could stamp an ally with a clock — Scuttle Toes
       untaps one and destroys it at the beginning of the end phase, which
       is exactly this sweep.

       GATED ON `isAlly`, not on the op's presence. "Dies" is printed
       about a LIVING object; an aura or an item on the same clock is
       destroyed but does not die, and reading the trigger off anything
       that happened to print one would be inventing a rule the CR does
       not have. The parser only sets `onDeath` where a card says so, so
       this is belt and braces — and the belt is the one the rules use.

       No seat is borrowed here: the sweep runs in the CONTROLLER's own
       end phase, so the actor is already the right one. */
    if(G.isAlly(b) && (f.onDeath || []).length) pay.push(...f.onDeath);
    ops.push(...pay);
    msgs.push(b.card.name + (when === "turn"
      ? " crumbles at the top of the turn."
      : " is destroyed at the beginning of the end phase.")
      + (pay.length ? " It pays out as it goes." : ""));
  }
  sd.board = kept;
  sd.grave = [...dying.map(b => Object.assign({}, b.card, {_gy: game.turn})), ...(sd.grave || [])];

  /* WHAT THE DEPARTING CARD WAS HOLDING UP GOES WITH IT. `arcShield` and
     `lifeLock` are side fields rather than properties of the card, so
     removing the card does not remove the effect. They are a CACHE of a
     board fact, so the honest move is to re-derive them from whatever is
     still in play rather than to decrement them.

     ASK THE CARD THROUGH `fxParse`, NEVER A SECOND REGEX. Both of the
     hand-rolled tests this inherited from the trainer were always FALSE,
     each for its own reason, and each was invisible because being wrong
     in that direction only ever tore an effect down early:

       arcShield   matched "prevent N arcane damage that source", a
                   wording upstream STOPPED PRINTING. `classifyClause`
                   levels both forms ("...or N of that damage") and this
                   copy was never told — v3.00's drift, in a predicate
                   instead of in a card.
       lifeLock    scanned the BOARD for Reaping Blade, which is a Sword
                   and lives in `gear`. So any aura crumbling at the top
                   of Viserai's turn silently unlocked life-gain while
                   his sword was still equipped.

     A predicate that answers a card question by re-reading the card text
     is the no-mirror rule broken one level down: there is one reader of a
     printed line, and this asks it. */
  const stillGrants = op => {
    const live = [...kept.map(b => b.card),
                  ...(sd.gear || []).filter(gp => gp && !gp.destroyed)];
    return live.some(c => {
      if(!c) return false;
      const f = P.fxParse(c);
      return [...(f.ops || []), ...((f.conds || []).flatMap(x => x.ops || []))]
        .some(o => o[0] === op);
    });
  };
  if(sd.arcShield && !stillGrants("arcShield")){ sd.arcShield = 0; msgs.push("The arcane shield goes with it."); }
  if(sd.lifeLock && !stillGrants("lifeLock")) sd.lifeLock = false;

  sides[seat] = sd;
  return {game: Object.assign({}, game, {sides}), fired, msgs, ops};
}

/* ---- FREEZE LIFTS AT THE START OF THE FREEZING PLAYER'S TURN --------

   "until the start of your next turn", where "your" is whoever played
   Cold Snap. The mark records that seat rather than a turn number, and
   this clears the marks belonging to `seat` wherever they landed — which
   is why no turn arithmetic is involved. That matters: judge.js counts
   `turn` in player-turns and the trainer counts only your own, so a
   stored deadline would mean two different things on the two boards.

   Pure and out here for the same reason `thawFrost` and `tickSuspense`
   are: a schedule written into one board's turn boundary is a schedule
   the other board does not have. */
/* IS IT THE OTHER SEAT'S TURN? One expression, two callers — the `foeTurn`
   condition and the `foeTurn` activation gate ask the identical question,
   and a second copy of it is how `activateIfOk` came to answer with the
   trainer's vocabulary in the first place.

   `turnPlayer`/`actor` is the CR machine's answer and rides on every state
   through `withPriority` (v2.27). The mode test is the fallback for a
   state built without the priority fields — every drill that hand-rolls
   one — and is the ONLY phase read left in this file. */
const foeTurnNow = s => (s && s.turnPlayer != null && s.actor != null)
  ? s.turnPlayer !== s.actor
  : (s && (s.mode === "block" || s.mode === "foeturn"));

/* IS THIS CARD'S HAND ABILITY LIVE RIGHT NOW? (v3.05)

   Module scope, not inside `makeEffects`, because it is a QUESTION and
   `judge.legal` has to be able to ask it — `legal` is pure and holds no
   effects context. Same reasoning that put `activateIfOk` out here.

   It reads the ACTING side off the state, so a caller asking about a
   particular seat passes `{...g, actor: seat}`. */
function handAbilityOK(s, c){
  if(!s || !c || s.over) return false;
  const fx = P.fxParse(c), ha = fx.handAbility;
  if(!ha) return false;
  const sd = (s.sides || [])[s.actor || 0] || {};
  if(ha.oncePerTurn && ((sd.hist || {}).handAb || {})[c.uid]) return false;
  /* THE WHOLE GATE, not one case of it. The trainer's original asked only
     `activateIf.kind === "defending"` — the one restriction its own pool
     card prints — so any other, including v3.04's `unreadable`, slipped
     straight through. */
  if(fx.activateIf && !activateIfOk(s, fx.activateIf, c)) return false;
  /* a cost you cannot pay is not an option — "discard a card" needs
     another card that is not itself committed to the block */
  if(ha.cost === "card" && !(sd.hand || []).some(x => x.uid !== c.uid && (sd.blockH || []).indexOf(x.uid) < 0))
    return false;
  return true;
}

/* ---- IS THIS PRINTED ACTIVATION GATE SATISFIED? (v3.04) --------------

   `fx.activateIf` is the "Activate this only …" line, and one reader for
   it has existed since v2.71 — inside `Battle`, where `judge.js` could
   not reach it. That is the shape this cycle keeps finding: phantasm's
   pop, the graveyard zone rule, the arena-departure schedule, and now
   every printed activation gate.

   TWO OF THE SIX CASES ASKED `s.mode`, WHICH IS THE TRAINER'S VOCABULARY
   AND A TRAP AT THE TABLE. judge.js seeds `mode` into its opening state
   and never writes it again, so a straight port would answer FALSE for
   `defending` and `foeTurn` in every step of every table game — the
   advisor was one line from shipping exactly that in v2.83. Both are
   asked of the CR machine here, with the mode test kept as the fallback
   for a state built without the priority fields (every drill that
   hand-rolls one).

   `defending` is asked of the CARD, not of the phase: "activate this only
   while THIS CARD is defending" (Rally the Coast Guard). Reading the
   phase alone would let any card in hand answer yes while the hero
   happened to be blocking with something else. */
function activateIfOk(game, gate, card){
  if(!gate) return true;
  const s = game, i = s.actor || 0, sd = (s.sides || [])[i] || {};
  const k = gate.kind;
  if(k === "atkNamed")   return ((sd.hist || {}).atkNames || []).includes(P.norm(gate.name || ""));
  if(k === "hits")       return (s.chain || []).filter(l => l.dmg > 0).length >= gate.n;
  if(k === "boosted")    return (s.boostChain || 0) > 0;
  /* WHAT YOU CONTROL — the arena and your equipment, PLUS the attack
     currently on the combat chain. RULING (user, 2026-08-08): that last
     part is what makes a chest piece paying you for a big swing reachable
     at all; board+gear alone left Kayo with nothing above 3. Only the LIVE
     attack counts, not resolved links — the chain history keeps a name and
     an image, not the card. */
  if(k === "controlPow") return [...(sd.board || []).map(b => b && b.card), ...(sd.gear || []),
                                 ...(s.pend && s.pend.card ? [s.pend.card] : [])]
                                .some(x => x && (x.power || 0) >= gate.n);
  /* ASKED OF THE CARD, NOT THE PHASE. "Activate this only while THIS CARD
     is defending" (Rally the Coast Guard) — so the question is whether it
     is in the declared wall, which both boards keep on the side. Reading
     the phase instead would let a card in hand answer yes while the hero
     happened to be blocking with something else, which is the ability
     escaping the one restriction it prints. */
  if(k === "defending"){
    if(!card) return false;
    const dec = [...(sd.blockH || []), ...(sd.blockG || [])];
    return dec.includes(card.uid) || dec.includes(String(card.uid));
  }
  if(k === "foeTurn") return foeTurnNow(s);
  /* AN UNREAD RESTRICTION REFUSES. `parser.js` files a printed "Activate
     this only …" whose condition it cannot read as `unreadable` rather
     than leaving the gate undefined, and the fallthrough below used to
     wave it through — which is the ability escaping the one limit it
     prints. v2.04 settled the same question for costs: inert, never free. */
  if(k === "unreadable") return false;
  return true;
}

function thawFreeze(game, seat){
  const sides = (game.sides || []).slice();
  const names = [];
  for(let i = 0; i < sides.length; i++){
    const sd = Object.assign({}, sides[i]);
    let touched = false;
    if(sd.arsenal && sd.arsenal._frozenBy === seat){
      const a = Object.assign({}, sd.arsenal); delete a._frozenBy;
      sd.arsenal = a; names.push(a.name); touched = true;
    }
    if((sd.board || []).some(b => b && b._frozenBy === seat)){
      sd.board = sd.board.map(b => {
        if(!b || b._frozenBy !== seat) return b;
        const e = Object.assign({}, b); delete e._frozenBy;
        if(e.card){ e.card = Object.assign({}, e.card); delete e.card._frozenBy; names.push(e.card.name); }
        return e;
      });
      touched = true;
    }
    if(touched) sides[i] = sd;
  }
  if(!names.length) return {game, thawed: []};
  return {game: Object.assign({}, game, {sides}), thawed: names};
}

/* ---- CR 4.4.2 — THE BEGINNING OF THE END PHASE, FOR ONE SEAT (v3.17) --
   ONE description of the event, called by both boards, seat-relative.

   It was not one description, and that cost three rules. `beginEndPhase`
   existed in the trainer and held Inertia and the arena sweep; three MORE
   beginning-of-end-phase events sat OUTSIDE it, inline in `endTurn`, each
   written against `you(n)` — so they ran for seat 0, on one board, and the
   table had none of them:

     rust destruction     Talishar prints its own death at 3 counters and
                          swung on past it forever
     the idle wipe        Dawnblade keeps the +{p} counters it prints to
                          lose on a turn it never connects
     intimidate's return  a card banished face-down came back at seat 0's
                          end phase or never — at the table, never, which
                          is a permanent theft and is v2.10's bug exactly

   All three fail STRONGER than printed, which is the direction that steals
   games, and all three read `tier: full`: two are consumed by ops and the
   third was a NOOP whose stated reason named the trainer's end phase.

   The ORDER is the one CR 4.1.8a hands to the turn-player and this engine
   does not model that choice — so it is fixed here, in one place, rather
   than agreed twice by two callers who cannot see each other. Inertia
   leads because it is itself an aura and the sweep would otherwise race it
   for the same board entry.

   Returns `{game, msgs, ops, fired}` — the same contract `sweepArena`
   already keeps, and for its reason: an op is actor-relative and the two
   boards reach `runOps` differently, so the caller runs them. */
/* ---- THE ROLLED INTELLECT SETTLES BACK (v3.49) -----------------------

   Knucklehead prints "Roll a 6 sided die. UNTIL END OF TURN, your base
   {i} is the number rolled", and `intRoll` stashes the printed value on
   `intWas`. **Nothing at the table ever read it back.** The trainer
   restored it inline and `judge.js` did not, so a table game kept the
   rolled value FOREVER — a 1 crippled the hero for the rest of the game
   and a 6 was a permanent +2 intellect, which is the direction that
   steals games.

   FOUND BY PLAYING, not by a drill, and nothing here could have seen it:
   coverage reads the clause consumed, the fairness sweep is one-sided and
   models no schedules, and `failstates.js` fills its "no schedule to fire
   on" category from UNREAD text while this text reads perfectly. It
   surfaced as 14 of 210 self-play games running past turn 1900 without
   ending, because a hero on intellect 1 draws one card a turn and can
   never assemble a play.

   IT IS NOT A `beginEndPhase` STEP, and that distinction is the whole of
   getting it right. The rolled value has to govern the (f) DRAW — that is
   what the card is FOR, and the feed says so ("that many cards at the
   draw step"). `beginEndPhase` runs BEFORE (a)-(f), so restoring there
   would hand the draw the printed value and make the card do nothing.
   Restored AFTER the draw, on the turn-player's own end phase, exactly
   where the trainer has always done it.

   `lastRoll` is cleared with it: a die left on the state is a later
   `intRoll` setting intellect from a roll nobody made this turn. */
function settleIntellect(game, seat){
  const sd = (game.sides || [])[seat] || {};
  const n = Object.assign({}, game, {lastRoll: null});
  if(sd.intWas == null) return {game: n, msgs: [], restored: null};
  const sides = n.sides.slice();
  sides[seat] = Object.assign({}, sd, {int: sd.intWas, intWas: null});
  return {game: Object.assign({}, n, {sides}), restored: sd.intWas,
          msgs: [(sd.name || ("seat " + seat)) + "'s intellect settles back to " + sd.intWas + "."]};
}

/* ---- DESTROYED GEAR GOES TO THE GRAVEYARD ------------------------------
   RULING (user, 2026-08-29): a destroyed piece of gear goes to the
   graveyard, as the CR says of any destroyed permanent.

   Until v3.53 it was flagged `destroyed:true` and left in the gear zone
   FOREVER — an approximation that was invisible because nothing in the
   pool read gear in a graveyard. `retrieve` is what made it visible: the
   printed reminder on Pick Up the Point's SAR017 face reads *"(Pay {r} to
   equip it.)"*, so the card pulls a dagger OUT OF THE GRAVEYARD, and
   Mark of the Huntsman destroys ITSELF to mark — which is the whole loop
   the two cards are printed for. Against the old model the graveyard was
   always empty of daggers and the ability could never do anything.

   IT IS A SWEEP, NOT AN INLINE MOVE, AND THAT IS THE WHOLE SAFETY
   ARGUMENT. The trainer's wall holds `blockG` as INDICES into `gear`
   (the table holds uids — the two boards genuinely differ here), so
   removing an entry while a wall is declared renumbers the defenders
   underneath it. `gearBlockApply` destroys a battleworn piece during
   exactly that resolution. Marking in place stays where it is, every
   existing wear and display read is untouched, and the FILING happens at
   one point where no wall can be live.

   WHEN it happens is a STATED APPROXIMATION: the CR files a destroyed
   permanent immediately, and this files it at the beginning of the
   controller's end phase. The observable difference is a piece destroyed
   and retrieved within the same turn, which needs both a destroy and a
   retrieve in one turn cycle. Recorded rather than hidden — and the
   alternative was an inline move that can renumber a live wall, which is
   a rules bug in a place no card text would explain.

   Pure, seat-relative, and returns `{game, msgs, moved}` — the same
   contract `sweepArena` keeps, so both boards get it through
   `beginEndPhase` without either restating it. */
/* WAS IT DONE **THIS WAY**? (v3.60)

   `defSelfMet`'s shape, one condition family over: the cond carries a
   QUESTION and this answers it against the per-resolution trace `execute`
   built while running the card's own ops.

   IT IS A NAMED FUNCTION SO ITS DEFAULT IS REACHABLE. The parser only
   emits conditions this evaluator knows, so no card fixture can drive the
   unknown branch — exactly the situation v3.26 records for `defSelfMet`
   and v3.36 for `asInstantMet`, where a drill has to ask the function
   directly or the sabotage passes silently.

   AN UNKNOWN CONDITION ANSWERS FALSE. A `way:` condition added to the
   parser and forgotten here leaves the card at its printed value —
   weaker than printed and visible. The other direction hands out a bonus
   nobody built. */
/* EVERY CONDITION THE POOL CAN PUT INTO `condOnHit` (v3.96).

   `fx.condOnHit` is a conditionally GRANTED on-hit ability (v3.10), and
   it is re-checked at the hit rather than at declaration — so it has its
   own evaluator, a SECOND and much smaller copy of the vocabulary
   `execute`'s condition loop answers. The parser emits into both, and
   nothing was comparing them: measured across the pool, SEVEN conditions
   reach `condOnHit` and the evaluator knew FOUR. Three cards were granted
   an ability that then refused itself, all reading `tier: full`.

   A DRILL ASSERTS THE POOL EMITS NOTHING OUTSIDE THIS LIST, which is what
   `PENDING_KINDS` (v3.35) and the attack-reaction condition list (v3.91)
   exist for: a census
   catches the next arrival, where a blacklist walks into the same
   fallback. Entries are PATTERNS, because three of the seven carry a
   printed threshold in their name. */
const CONDONHIT_CONDS = [
  /^way:/, /^charged$/, /^chargedPitch\d$/, /^marked$/, /^pumped$/,
  /^auras\d+$/, /^drac\d+$/, /^fused$/
];
const condOnHitKnown = cond => CONDONHIT_CONDS.some(rx => rx.test(String(cond || "")));

function thisWayMet(cond, trace){
  const t = trace || {};
  const pm = String(cond||"").match(/^way:discardPitch(\d+)$/);
  if(pm) return (t.disc||[]).some(c => c && (c.pitch||0) === +pm[1]);
  if(cond === "way:dealt") return (t.dmg||0) > 0;
  /* "IF 2 OR MORE CARDS ARE PUT INTO ARSENALS THIS WAY" (v3.88). The
     THRESHOLD is the card's own printed number, carried in the condition
     name — a literal 2 here is right for this printing and silently wrong
     for any other (v3.17, v3.32, v3.55). */
  const am = String(cond||"").match(/^way:arsPut(\d+)$/);
  if(am) return (t.ars||0) >= +am[1];
  /* "IF YOU DO" / "IF THEY DO" INSIDE A GRANTED ABILITY (v3.95) — did the
     ability's own first op actually take something from the opponent? An
     empty hand or an empty arsenal takes nothing, and the rider is the
     whole difference between the two Loot cards and half of each. */
  if(cond === "way:took") return (t.took||[]).length > 0;
  /* "IF THIS WAS FUSED AND DEALS DAMAGE TO A HERO" (v3.97) — Aether
     Icevein and Polar Cap. TWO facts, and only one of them is about what
     the resolution DID: `fused` is how the card was PLAYED.

     IT IS ONE COMPOUND NAME RATHER THAN TWO CONDS because `fx.conds`
     entries pair ONE condition with ONE op — there is nowhere for an AND
     to live — and a card whose second half was dropped would fire off any
     arcane at all, which is stronger than printed.

     "TO A HERO" IS SATISFIED BY CONSTRUCTION, and that is measured rather
     than assumed: both `arcane` call sites pass `1 - actorOf(n)`, the
     opposing SEAT, so arcane in this engine never reaches an ally. If a
     route to one is ever built, this gate needs the target back. */
  if(cond === "way:dealtFused") return (t.dmg||0) > 0 && !!t.fused;
  /* AN UNKNOWN `way:` ANSWERS FALSE — a condition added to the parser and
     forgotten here leaves the card weaker than printed and visible, which
     is the safe direction (v3.26's rule, and this function is NAMED so
     that default is reachable by a drill: the parser only emits
     conditions the evaluator knows, so no card fixture can drive it). */
  return false;
}

function sweepGear(game, seat){
  const sd = (game.sides || [])[seat] || {};
  const gone = (sd.gear || []).filter(g => g && g.destroyed);
  if(!gone.length) return {game, msgs: [], moved: []};
  const sides = game.sides.slice();
  const me = Object.assign({}, sd);
  me.gear = (sd.gear || []).filter(g => !(g && g.destroyed));
  /* TURN-STAMPED, like every other path into the graveyard. `_gy` is what
     answers the whole "…this turn" family, and a new path that forgets it
     makes those cards quietly wrong (CLAUDE.md says so in as many words).
     Stamped inline because this function is pure — the same thing
     `sweepArena` does, rather than reaching for the trainer's `gy()`. */
  /* TWO DESTINATIONS, READ OFF THE MARK (v3.79). A DESTROYED permanent
     goes to the graveyard (the 2026-08-29 ruling); a BANISHED one goes to
     the banish zone, and they are different zones with different readers
     — the two `retrieve` cards fetch gear out of a GRAVEYARD, so filing a
     banished piece there would hand it back a card the text removed from
     the game. One sweep, because the index hazard v3.54 names is the same
     for both, and one mark says which. */
  const banished = gone.filter(g => g._banished);
  const destroyed = gone.filter(g => !g._banished);
  me.grave = [...destroyed.map(g => Object.assign({}, g, {_gy: game.turn})), ...(sd.grave || [])];
  if(banished.length) me.banish = [...banished.map(g => Object.assign({}, g)), ...(sd.banish || [])];
  sides[seat] = me;
  const who = ((game.sides || [])[seat] || {}).name || ("seat " + seat);
  return {
    game: Object.assign({}, game, {sides}),
    msgs: gone.map(g => g._banished
      ? `${g.name} is banished — it is out of ${who}'s game for good.`
      : `${g.name} is destroyed — it goes to ${who}'s graveyard.`),
    moved: gone.map(g => g.uid)};
}

/* `db` IS THE CALLER'S ANSWER (v3.76), the way the wall and the
   attack-target already are. This function is module-level and pure, so
   it holds no card database of its own — judge.js registers one with
   `setDb` and the trainer holds the loaded one, and neither is reachable
   from here. A caller that says nothing finds no Agent to become: weaker
   than printed and visible, which is the safe direction (v3.24). */
/* THE CHAIN CLOSES — DROP THE GRANTS THAT PRINT THAT WINDOW (v3.87).

   "Your attacks THIS COMBAT CHAIN get +N{p}" expires when the chain does,
   not with the turn. `beginEndPhase` sweeps the "this turn" entries and
   deliberately leaves these, so this is where they go.

   IT IS A SHARED BODY BECAUSE A SCHEDULE IS WRITTEN PER BOARD (v3.01).
   The trainer closes a chain in `closeChain` and at the turn boundary;
   judge closes it in `closeChain`. Written into one of them, a chain
   grant lasts a whole turn on the other — stronger than printed, which
   is the direction that steals games.

   BOTH SEATS, for `beginEndPhase`'s reason: a grant is not the turn
   player's private property, and a chain belongs to nobody.

   Pure, and it returns the game — no message, because a window closing is
   not an event the player did anything to cause. */
function closeChainGrants(game){
  let n = game;
  for(let i = 0; i < 2; i++){
    const sd = (n.sides || [])[i] || {};
    const keep = (sd.atkBuff || []).filter(b => b.until !== "chain");
    /* SHRED'S DEBUFF IS "THIS COMBAT CHAIN" TOO (v3.89), so it expires
       here rather than growing a schedule of its own — and it is held on
       the DEFENDING side, which is the other seat from the one that
       played the card. Both seats are swept for that reason. */
    /* AND ONLY THE CHAIN-SCOPED ONES (v3.94). `defMod` used to be swept
       whole because Shred was its only writer and prints "this combat
       chain"; Stonewall Impasse's clash payoff prints "until end of turn"
       and is swept in `beginEndPhase` beside the other turn grants. */
    const keepD = (sd.defMod || []).filter(x => x.until === "turn");
    const dropDeb = keepD.length !== (sd.defMod || []).length;
    /* AND THE DRACONIC GRANT (v4.06). Brand with Cinderclaw prints "this
       COMBAT CHAIN", so this is its window — and it had no expiry at the
       table at all, while the trainer cleared it in `newTurn` for SEAT 0
       ONLY. Wrong board, wrong seat and wrong boundary at once: a grant
       that survives the chain it names is stronger than printed, and one
       that survives the GAME compounds through `dracLinks`. */
    const dropDrac = !!sd.dracNext;
    if(keep.length === (sd.atkBuff || []).length && !dropDeb && !dropDrac) continue;
    const sides = n.sides.slice();
    sides[i] = Object.assign({}, sd, {atkBuff: keep, defMod: keepD, dracNext: false});
    n = Object.assign({}, n, {sides});
  }
  return n;
}

function beginEndPhase(game, seat, db){
  let n = game;
  const msgs = [], ops = [], fired = [];
  const nameOf = i => ((n.sides||[])[i]||{}).name || "seat " + i;

  /* (1) INERTIA — destroy the token, then hand and arsenal to the bottom. */
  {
    const r = resolveInertia(n, seat);
    n = r.game;
    if(r.tokens)
      msgs.push("Inertia seizes " + nameOf(seat) + " — "
        + (r.tokens > 1 ? r.tokens + " tokens shatter" : "the token shatters") + ", and "
        + (r.wiped ? r.wiped + " card" + (r.wiped > 1 ? "s" : "") + " from hand and arsenal go to the bottom of the deck"
                   : "there was nothing left to sweep away") + ".");
  }

  /* (2) FROSTBITE THAWS. The play-half of the expiry is in `execute`;
     this clears a Frostbite the frozen seat never spent anything into, so
     the tax cannot follow them into the next turn.

     IT RUNS BEFORE THE SWEEP, AND THE ORDER IS THE POINT. Frostbite's
     printed line IS "at the beginning of your end phase, destroy this",
     so the token is minted with `sd:"end"` and step (5) would take it
     too. Two readers, one rule: the specific one goes first so the feed
     names the token and says what it cost, and the generic sweep is the
     backstop that finds nothing left. Reverse them and the state stays
     right while the lesson goes quiet — which is what the trainer did
     until v3.17, because its sweep ran here and its thaw ran in (c)-(f). */
  {
    const fb = thawFrost(n, seat);
    n = fb.game;
    if(fb.thawed)
      msgs.push("The " + (fb.thawed > 1 ? fb.thawed + " Frostbites" : "Frostbite")
        + " thaw" + (fb.thawed > 1 ? "" : "s") + " unspent at the end of " + nameOf(seat) + "'s turn.");
  }

  /* (3) RUST — off each piece's own printed threshold. */
  {
    const sd = (n.sides||[])[seat] || {};
    const out = P.rustedThrough(sd.gear, sd.counters);
    if(out.length){
      const sides = n.sides.slice(), me = Object.assign({}, sides[seat]);
      me.gear = (me.gear||[]).map(gr => out.indexOf(gr.uid) >= 0 ? Object.assign({}, gr, {destroyed:true}) : gr);
      sides[seat] = me; n = Object.assign({}, n, {sides});
      for(const uid of out){
        const gr = (me.gear||[]).find(x => x.uid === uid) || {};
        msgs.push(gr.name + " rusts through — "
          + ((sd.counters||{})[uid]||{}).rust + " rust counters, it shatters.");
      }
    }
  }

  /* (4) THE IDLE WIPE — "if this hasn't hit this turn, remove all +{p}
     counters from it". `hist.wpnHits` is THIS turn's tally and is still
     the current turn's here: the (c)-(f) block is what replaces `hist`,
     and it has not run yet. */
  {
    const sd = (n.sides||[])[seat] || {};
    const out = P.idleCounterWipes(sd.gear, sd.counters, (sd.hist||{}).wpnHits);
    if(out.length){
      const sides = n.sides.slice(), me = Object.assign({}, sides[seat]);
      const ctr = Object.assign({}, me.counters);
      for(const uid of out){
        const gr = (me.gear||[]).find(x => x.uid === uid) || {};
        const lost = (ctr[uid]||{}).pow || 0;
        ctr[uid] = Object.assign({}, ctr[uid], {pow:0});
        msgs.push(gr.name + " never landed a blow this turn — its +" + lost + "{p} in counters falls away.");
      }
      me.counters = ctr; sides[seat] = me; n = Object.assign({}, n, {sides});
    }
  }

  /* (4a) SHARPEN'S COUNTERS FALL AWAY (v3.66). The MPW103 printing of
     Edict of Steel prints it in the keyword's own reminder text —
     "Remove all +1{p} counters FROM IT at end of turn" — so ALL of them
     go, and only from the piece that was sharpened. A sword that already
     carried counters from Glisten loses those too.

     IT IS A STAMP, NOT A PREDICATE, and that is the whole reason it is a
     separate step from the idle wipe directly above. `idleCounterWipes`
     asks the PIECE's own printed line (`wipePowIfIdle`), and a sharpened
     sword's text says nothing about sharpen at all — the schedule belongs
     to the card that sharpened it. Deriving it from the piece would
     answer false forever.

     IT RUNS BESIDE THE IDLE WIPE AND BEFORE THE SWEEP, for the order this
     step already states: specific readers first, the generic filing last. */
  {
    const sd = (n.sides || [])[seat] || {};
    const marked = [...(sd.gear || []), ...(sd.board || [])]
      .filter(e => e && e._powEnd);
    if(marked.length){
      const sides = n.sides.slice(), me = Object.assign({}, sides[seat]);
      const ctr = Object.assign({}, me.counters);
      for(const e of marked){
        const lost = (ctr[e.uid] || {}).pow || 0;
        if(lost) ctr[e.uid] = Object.assign({}, ctr[e.uid], {pow: 0});
        msgs.push((e.name || (e.card && e.card.name) || "a sharpened weapon")
          + " was sharpened this turn — its +" + lost + "{p} in counters falls away.");
      }
      /* THE STAMP IS CLEARED WITH THE COUNTERS. Left on, the piece is
         wiped again every end phase for the rest of the game, which turns
         a one-turn buff into a permanent ban on ever holding a counter —
         the same rule `_discWay` and `lastRoll` follow. */
      const strip = e => (e && e._powEnd) ? Object.assign({}, e, {_powEnd: false}) : e;
      me.gear  = (me.gear  || []).map(strip);
      me.board = (me.board || []).map(strip);
      me.counters = ctr; sides[seat] = me; n = Object.assign({}, n, {sides});
    }
  }

  /* (4b) THE SHATTERED IRON IS FILED (v3.53). RULING (user, 2026-08-29):
     destroyed gear goes to the graveyard.

     IT RUNS AFTER (3) AND (4) AND THE ORDER IS LOAD-BEARING. Rust sets
     `destroyed` on a piece THIS turn, so filing before it would leave the
     newly-shattered piece in the gear zone for another whole turn; and
     the idle wipe reads `gear` by uid to find the counters it clears, so
     filing before that silently stops it finding a piece that rusted
     through in the same end phase. Specific readers first, the generic
     sweep last — the same rule step (2) states for Frostbite. */
  {
    const sg = sweepGear(n, seat);
    n = sg.game;
    for(const m of sg.msgs) msgs.push(m);
    if(sg.moved.length) fired.push("gear");
  }

  /* (5) INTIMIDATE RETURNS. An attack is declared by the turn-player, so
     the only pile that can be holding anything at this seat's end phase is
     the OTHER seat's — but both are swept, because a card stranded
     face-down in a zone nothing empties is a card the census keeps finding
     and the player never gets back. */
  for(const i of [1 - seat, seat]){
    const sd = (n.sides||[])[i] || {};
    const held = sd.intimidated || [];
    if(!held.length) continue;
    const sides = n.sides.slice(), me = Object.assign({}, sides[i]);
    me.hand = [...(me.hand||[]), ...held];
    me.intimidated = [];
    sides[i] = me; n = Object.assign({}, n, {sides});
    msgs.push(nameOf(i) + " takes back " + held.length + " intimidated card"
      + (held.length > 1 ? "s" : "") + " — the tax expires.");
  }

  /* (6) THE ARENA CLOCK — "at the beginning of your end phase, destroy
     this", and whatever rides after the destroy in printed order. */
  {
    const sw = sweepArena(n, seat, "end");
    n = sw.game;
    for(const m of sw.msgs) msgs.push(m);
    for(const o of sw.ops) ops.push(o);
    for(const f of sw.fired) fired.push(f);
  }

  /* (7) WHAT WAS ARMED AGAINST THIS TURN EXPIRES WITH IT (v3.29).
     "Their FIRST attack during their next turn" — if they never attacked,
     the effect is spent all the same. Only entries that were armed for
     THIS turn are dropped; one armed during this turn is aimed at the
     next one and must survive. */
  {
    const sd = (n.sides || [])[seat] || {};
    const live = (sd.nextTurn || []).filter(e => e && e.ready);
    if(live.length){
      const sides = n.sides.slice();
      sides[seat] = Object.assign({}, sd, {nextTurn: (sd.nextTurn||[]).filter(e => e && !e.ready)});
      n = Object.assign({}, n, {sides});
      msgs.push(nameOf(seat) + ": " + live.length + " lingering effect(s) expire with the turn.");
    }
  }

  /* (8) "THIS TURN" ENDS WITH THE TURN (v3.34). Five single-shot grants
     wait for a card that matches, and every one of them is printed "this
     turn":

       buffNext / buffQ   power   (v2.30)
       gaNext  / gaNextQ  go again (v3.31)
       costOff            cost    (v3.32)

     THE TRAINER CLEARED THE FIRST TWO AT CR 4.4.3e AND JUDGE CLEARED
     NOTHING AT ALL, so at the table a next-attack buff survived every
     later turn of the game — permanent where the card prints one turn,
     which is the direction that steals games. A schedule is written per
     board (v3.01) and this one was written on one board; it belongs in
     the shared event, where two callers cannot disagree.

     BOTH SEATS, not just the turn player. CR 4.4.3e loses points for all
     players, and a grant is the same kind of thing: a hero who banks one
     during your turn must not keep it into their own. */
  for(const i of [0, 1]){
    const sd = (n.sides || [])[i] || {};
    const held = (sd.buffNext || 0) + (sd.buffQ || []).length
               + ((sd.gaNext ? 1 : 0)) + (sd.gaNextQ || []).length + (sd.costOff || []).length
               + (sd.instantNextQ || []).length + (sd.defCapNext || []).length
               /* LYATH'S DEFENCE GRANT IS "THIS TURN" TOO (v3.78) — the
                  same window as its five neighbours, so it expires in
                  the same step rather than growing its own schedule. */
               + (sd.defActionBuff ? 1 : 0)
               /* AND SO ARE THE TURN-SCOPED STANDING ATTACK GRANTS (v3.87)
                  — but only those. An `until: "chain"` entry is dropped at
                  the CLOSE STEP instead, because that is the window its
                  card prints; sweeping both here makes a chain grant last
                  a whole turn, which is stronger than printed. */
               + (sd.atkBuff || []).filter(b => b.until !== "chain").length
               /* AND A TURN-SCOPED DEFENCE MODIFIER (v3.94) — Stonewall
                  Impasse's clash payoff prints "until end of turn", where
                  Shred's prints "this combat chain" and is dropped at the
                  close step. Same split, same reason. */
               + (sd.defMod || []).filter(b => b.until === "turn").length
               /* AND THE THREE v4.07 ADDITIONS. `held` gates the whole
                  step, so a grant swept above but not COUNTED here is a
                  grant that expires only when something else happens to
                  expire on the same turn — which is a sweep that works by
                  coincidence. */
               + (sd.amp ? 1 : 0) + (sd.runeHitNext ? 1 : 0)
               + (sd.wardTurn ? 1 : 0) + (sd.awdTurn ? 1 : 0);
    if(!held) continue;
    const sides = n.sides.slice();
    sides[i] = Object.assign({}, sd,
      {buffNext: 0, buffQ: [], gaNext: false, gaNextQ: [], costOff: [], instantNextQ: [], defCapNext: [], defActionBuff: 0,
       /* THREE MORE "THIS TURN" GRANTS THAT NEVER EXPIRED (v4.07).
          `amp` is Absorb in Aether's and Cindering Foresight's "the next
          card you play THIS TURN with an arcane damage effect";
          `runeHitNext` is Mauvrion Skies' "the next Runeblade attack
          action card you play THIS TURN". Both print the window, both are
          spent by the card they name, and neither was ever swept — so an
          unspent one followed its controller into every later turn.
          A grant that outlives its printed window is STRONGER than
          printed, which the one-sided fairness sweep cannot see. */
       amp: 0, runeHitNext: 0,
       /* AND ONLY THE WINDOWED PART OF THE PREVENTION POOLS. Sweeping
          `ward` whole would take an aura's printed `Ward N` with it and
          decide the open aura-ward ruling by accident. */
       ward: Math.max(0, (sd.ward || 0) - (sd.wardTurn || 0)), wardTurn: 0,
       awd:  Math.max(0, (sd.awd  || 0) - (sd.awdTurn  || 0)), awdTurn: 0,
       atkBuff: (sd.atkBuff || []).filter(b => b.until === "chain"),
       defMod: (sd.defMod || []).filter(b => b.until !== "turn")});
    n = Object.assign({}, n, {sides});
    msgs.push(nameOf(i) + ": " + held + " unspent \u201cthis turn\u201d grant"
      + (held > 1 ? "s expire" : " expires") + " with the turn.");
  }

  /* (8b) AND THE GAME'S OWN "THIS TURN" TAX (v4.06). Hyper Inflation's
     "cards cost {r} more to play this turn" names no seat, so it is not a
     side grant and step (8) above cannot reach it — it lives on the game,
     taxes both players, and had no expiry at all because it had no
     READER at all. Cleared in the TURN PLAYER's end phase, which is the
     turn it was played in: the card is an attack action, so it can only
     ever be set on its controller's own turn. */
  if(n.costTax){
    msgs.push("The inflation subsides \u2014 cards cost their printed price again.");
    n = Object.assign({}, n, {costTax: 0});
  }

  /* (9) THE BROOD — ARAKNI'S AGENTS OF CHAOS (v3.76) ------------------
     Two printed lines, one cycle, and both fire at the beginning of the
     SAME end phase:

       Arakni    "if an opponent is marked, you become a random Agent of
                  Chaos"
       an Agent  "return to the brood"

     SO YOU RETURN FIRST AND BECOME SECOND, which is what makes it a cycle
     rather than a one-way door: an Agent goes home, Arakni's own clause
     fires, and a NEW Agent takes the seat. Reversed, you would become an
     Agent and immediately return, and the mechanic would be invisible.
     CR 4.1.8a's trigger ordering is not modelled here (it is a stated
     approximation, like every other order in this function).

     WHAT CHANGES IS THE ABILITY AND NOTHING ELSE. Every Agent prints
     `health: "*"` and intellect 4, and Arakni prints intellect 4 — so
     life, intellect, deck and gear are untouched, and only the half of
     the build that comes off the printed line is replaced. That half is
     `build.heroAbilities`, called here and at deal time, so the two
     answers cannot drift.

     THE PICK COMES OUT OF THE SEEDED STREAM and the rng is stored back
     (v2.26): two peers replaying one log must become the same Agent, and
     a forgotten store-back repeats the last draw forever.

     `_brood` REMEMBERS WHO YOU WERE. It is on the BUILD rather than the
     side, because everything it restores is a build field — and a side
     field would need three more ledgers to carry one string. */
  {
    const b = ((n.builds || [])[seat]) || null;
    if(b && (b.returnToBrood || b.becomeAgent)){
      let cur = b, changed = false;
      if(cur.returnToBrood && cur._brood){
        const home = cur._brood;
        cur = Object.assign({}, cur, BD.heroAbilities(home, home.n), {_brood: null});
        /* A COLON, NOT AN INFLECTED VERB. `nameOf` is literally "You" on
           the trainer and a hero name at the table, so "You returns" reads
           wrong on exactly one of the two boards — heave's own note, and
           the four older sites in this file that still say it (HANDOFF). */
        msgs.push(nameOf(seat) + ": back to the brood — " + (home.n || "themself") + " again.");
        changed = true;
      }
      /* "IF AN OPPONENT IS MARKED" — the gate is on the OTHER seat, and a
         seat that is currently an Agent has no `becomeAgent` of its own,
         so this only ever fires from the brood. */
      /* READ THE CLASS BEFORE THE SWAP, because the swap OVERWRITES the
         very field that named the set: an Agent carries no `becomeAgent`
         of its own, so `cur.becomeAgent` is null the instant the ability
         half is replaced. The first draft read it for the feed line
         afterwards and threw. */
      const _cls = cur.becomeAgent;
      if(_cls && (((n.sides || [])[1 - seat] || {}).marked)){
        const pool = BD.agentsOf(db, _cls);
        if(pool.length){
          const r = R.int(n.rng, pool.length);
          n = Object.assign({}, n, {rng: r.rng});
          const pick = pool[r.v];
          cur = Object.assign({}, cur, BD.heroAbilities(pick, pick.n),
                              {_brood: cur._brood || cur.heroRec});
          msgs.push(nameOf(seat) + ": the web shifts — now " + pick.n
            + ", a random Agent of " + _cls.replace(/^./, c => c.toUpperCase()) + ".");
          changed = true;
          fired.push("agent");
        } else {
          msgs.push(nameOf(seat) + ": no Agent of " + _cls + " to become.");
        }
      }
      if(changed){
        const builds = (n.builds || []).slice();
        builds[seat] = cur;
        n = Object.assign({}, n, {builds});
      }
    }
  }

  return {game: n, msgs, ops, fired};
}

function thawFrost(game, seat){
  const sides = (game.sides || []).slice();
  const sd = Object.assign({}, sides[seat]);
  const board = (sd.board || []);
  const thawed = board.filter(P.isFrostbite).length;
  if(!thawed) return {game, thawed: 0};
  sd.board = board.filter(b => !P.isFrostbite(b));
  sides[seat] = sd;
  return {game: Object.assign({}, game, {sides}), thawed};
}

/* ---- WHAT A SEAT SPENDS TO STOP ARCANE DAMAGE (v2.74) ----------------
   Seat 1 has to be able to ANSWER a soak, not just be asked: `arcaneHit`
   defers the damage into the answer, so a sheet nobody confirms is an
   arcane hit that never lands.

   PURE, AND OUT HERE, FOR THE SAME REASON `thawFrost` IS. The trainer's
   answer path is a closure inside `Battle`, so the only check available
   there is a source scan — and a scan is satisfied by whatever survives
   deleting the gate, which is how this version's first end-phase drill
   went green against dead code. The policy is a decision, so it belongs
   somewhere a drill can drive it.

   IT IS DELIBERATELY PLAIN, and plain in a specific direction. Porting
   `dummyDefence` into sparring.js unchanged made both seats block 41 of
   41 attacks and finish on full life, because a heuristic written for a
   seat with nothing else to spend cards on spends everything on
   everything. So: never pay MORE resources than the damage is worth —
   Arcane Barrier 2 against 1 damage is printed as a bad deal and taking
   it every time would drain a hero who needs those resources on their own
   turn — except at LETHAL, where nothing they are holding is worth more
   than being alive.

   Spellvoid costs no resources, so it is always taken while damage is
   still coming through. That is not greed: the piece is battleworn iron
   in this pool and destroying it to stop 2 is what it prints.

   Returns INDICES into `live.options`, in the order they were taken, with
   no reliance on `game.rng` — the options are already a total order with
   ties broken on uid, so two peers and a replay decide identically. */
/* IS THE OPEN LINK ALREADY ABOVE ITS PRINTED POWER? (v3.63)

   `linkPumps` asks this at SETTLE time, off its own running total. A
   reaction asks it at REACTION time, when everything applied so far is
   still `{k:"rx"}` layers waiting on the stack — so the two moments need
   the same answer from ONE body, or `judge.legal` and `attackRx` disagree
   about whether Bolt'n Boots has a legal target: the ability is offered,
   the piece is destroyed to pay for it, and then it refuses itself.

   PURE, AND OUT HERE, FOR THE SAME REASON `thawFrost` IS — judge.js asks
   it from `legal`, which holds no effects context, so a copy built inside
   `makeEffects` would be reachable from exactly one of the two callers
   that must agree. */
/* WHAT HAVE REACTIONS CONTRIBUTED TO THE OPEN LINK? (v4.03)

   TWO RECORDS, BECAUSE THE TWO BOARDS RESOLVE A LAYER DIFFERENTLY, and
   reading only one of them was a live two-player bug for as long as the
   table has had a priority machine:

     waiting    `{k:"rx"}` layers still on the stack. The TRAINER never
                pops one — it has no layer-resolution step at all — so
                every reaction it has ever played is still here at the
                damage step, which is why the pump landed there.
     resolved   `pend.rxPump`. judge.js DOES pop them: CR 4.2.2 resolves
                the top layer when both seats pass, and `windowClosed`
                requires an EMPTY stack before the reaction step can end
                — so at the table EVERY rx layer is gone before the damage
                step, and summing the survivors summed nothing.

   MEASURED: 13 distinct pool attack reactions carry a pump across 33
   printings, and all three activated attack-reaction abilities route
   through the same `attackRx`. Driven, same card and same state:
   Courageous Steelhand prints +3, said "on the stack (+3)" in the feed,
   and the attack dealt its base 3 at the table and 3+3 in the trainer.

   THIS IS v3.01's SHAPE WITH THE CR-CORRECT BOARD LOSING. judge is right
   to pop the layer — that is what resolving one MEANS — and the defect is
   that the pump was stored in the layer rather than carried onto the link
   when it resolved. One body, so the two readers cannot disagree again. */
function rxPumpTotal(s){
  const waiting = (s && s.stack || []).filter(x => x.k === "rx")
                    .reduce((a, x) => a + (x.pump || 0), 0);
  const resolved = (s && s.pend && s.pend.rxPump) || 0;
  return waiting + resolved;
}

function pendPumped(s){
  const p = s && s.pend;
  if(!p || !p.card) return false;
  return ((p.total || 0) + rxPumpTotal(s)) > (p.card.power || 0);
}

function soakPolicy(live, sd){
  if(!live || !live.options) return [];
  const lethal = ((sd && sd.hp) || 0) - (live.amount || 0) <= 0;
  const sel = [];
  let spent = 0, soaked = 0;
  live.options.forEach((o, i) => {
    if(soaked >= (live.amount || 0)) return;                       /* already covered */
    if(o.kind === "spellvoid"){ sel.push(i); soaked += o.amount || 0; return; }
    if(!lethal && (o.cost || 0) > (live.amount || 0) - soaked) return;  /* a bad deal */
    if(spent + (o.cost || 0) > (live.avail || 0)) return;          /* cannot reach it */
    sel.push(i); spent += o.cost || 0; soaked += o.amount || 0;
  });
  return sel;
}

/* ---- WOULD THIS SEAT PAY TO AVOID WHAT THE CARD PRINTS? (v2.75) ------
   The other half of "target hero may pay". Pure and out here for the same
   reason `soakPolicy` is: the trainer's answer path is a closure inside
   `Battle`, so a source scan is the only check available there, and a scan
   is satisfied by whatever survives deleting the gate.

   It replaces the noop "the dummy pays no costs, so it always declines" —
   which was never a rule, only a fact about a prop that could not pay.

   THE RULE IT FOLLOWS is the same one `soakPolicy` follows and for the same
   reason: do not spend more than the thing is worth. A card is worth about
   a card, so it pays when the cost is within what it can reach AND it is
   not emptying itself to do it — with the usual override that at lethal
   nothing it holds is worth more than being alive. A seat that pays every
   toll every time is the shape that made both seats block 41 of 41
   attacks.

   Returns a boolean; the caller turns it into the prompt's `choice`. */
function payPolicy(live, sd){
  if(!live) return false;
  const cost = live.cost || 0;
  if(cost <= 0) return true;
  if(cost > (live.avail || 0)) return false;          /* cannot reach it */
  const res = (sd && sd.res) || 0;
  const hand = ((sd && sd.hand) || []).length;
  /* Free from the floating pool — always worth it, nothing is given up. */
  if(cost <= res) return true;
  /* Otherwise it costs CARDS, so weigh it against what it saves. Paying
     with the last card in hand to avoid discarding a card is a straight
     loss; paying out of a full grip is fine. */
  if(hand <= 1) return false;
  return true;
}

return {makeEffects, CTX_KEYS, CONDONHIT_CONDS, condOnHitKnown, defendValue, defSelfMet, armNextTurn, pendPumped, rxPumpTotal, thawFrost, thawFreeze, resolveInertia, tickSuspense, sweepArena, sweepGear, thisWayMet, heaveOffer, heave, beginEndPhase, closeChainGrants, settleIntellect,
        activateIfOk, handAbilityOK, soakPolicy, payPolicy};
});
