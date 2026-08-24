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
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"), require("./cards.js"), require("./rng.js"), require("./game.js"), require("./advisor.js"), require("./prompts.js"));
  else root.DawnEffects = factory(root.DawnParser, root.DawnCards, root.DawnRNG, root.DawnGame, root.DawnAdvisor, root.DawnPrompts);
})(typeof self!=="undefined" ? self : this, function(P, C, R, G, A, PR){

/* Engine-side dependencies, taken as factory arguments — the same
   treatment advisor.js, cards.js and prompts.js already get. */
const {arsEmpty, arsFree, classifyClause, clean, costsAP, effCost,
       fxParse, hasKw, printedKw, isAttack, isAR, norm, qualMatches, rxPump, runeCount,
       isFrostbite, frostCount, isFrailty, frailtyCount,
       pow6, zonePow, isAtkActionCard} = P;
const {resolveEntry} = C;
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
       It is a real decision, an action point against a block, and the piece
       is matched on its PRINTED TEXT rather than by name. */
    if(big && atRandom){
      const bt = (act(n).gear||[]).find(x => x && !x.destroyed &&
        /whenever you discard a random card with \d+ or more \{p\}, you may destroy this/i.test(clean(x.tx||"")));
      if(bt) n.promptQ = [...(n.promptQ||[]), {tag:"modal", side:actorOf(n), src:bt.name,
        title:`${bt.name} — destroy it for an action point?`,
        hint:"It triggers on every random discard of a 6 or more.",
        options:[{label:`Destroy ${bt.name} — gain 1 action point`, ops:[["destroyGear",bt.uid],["ap",1]]},
                 {label:"Keep the iron", ops:[]}]}];
    }

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
          n = L(n, `${srcName}: ${act(n).name} discards ${take.map(c=>c.name).join(", ")} — ${act(n).hand.length} left in hand.`);
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
        n = L(n, `${srcName}: ${a.name} is destroyed in ${foe(n).name}'s arsenal.`);
      }
      else if(k==="foeArsBottom"){
        if(!foe(n).arsenal){ n = L(n, `${srcName}: ${foe(n).name}'s arsenal is empty.`); return; }
        const a = foe(n).arsenal;
        foeMut(n).arsenal = null;
        foeMut(n).deck = [...foe(n).deck, a];
        n = L(n, `${srcName}: ${a.name} goes to the bottom of ${foe(n).name}'s deck.`);
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
        if(op[2] || op[3]){
          actMut(n).buffQ = [...(act(n).buffQ||[]), {amt:v, q:op[2]||null, rider:op[3]||null}];
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
        n=L(n,`${act(n).name}: their next ${P.qualLabel(iq).replace(/^an? /,"")} may be played at instant speed`
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
      /* A COUNT, NOT A FLAG (v3.10). Mauvrion Skies prints 3 Runechants at
         red, 2 at yellow and 1 at blue; this was a boolean, so it could
         not have carried 3 even when it fired — and it only ever fired on
         the blue copy, because the parser tested for the bare string
         "create a runechant". Viserai's own card, and Runechants are his
         whole engine. */
      else if(k==="runeHitNext"){ const many=Math.max(1,v||1); actMut(n).runeHitNext=many;
        n=L(n,`Your next attack: if it hits, ${many>1?`${many} Runechants are`:"a Runechant is"} forged.`); }
      else if(k==="amp"){ actMut(n).amp+=v; n=L(n,`Amp ${v} — next arcane +${v}.`); }
      else if(k==="ward"){ actMut(n).ward+=v; n=L(n,`Ward ${v}.`); }
      else if(k==="awd"){ actMut(n).awd+=v; n=L(n,`Arcane ward ${v} — soaks spells, not fists.`); }
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
        const who = side==="foe" ? foe(n).name+"'s" : "your";
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
      else if(k==="foePickTop"){
        const filt = promptFilter((v||{}).filter);
        const cands = (foe(n).hand||[]).filter(filt);
        if(!cands.length){ n = L(n, `${srcName}: nothing in ${foe(n).name}'s hand matches.`); return; }
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:actorOf(n), src:srcName, cards:cands, min:1, max:1,
          moveFoe:{from:"hand", to:"deckTop"},
          title:`Put one of ${foe(n).name}'s cards on top of their deck`,
          hint:`It leaves their hand and becomes the next card they draw.`}];
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
        const tgt = n.pend && n.pend.card ? n.pend.card.uid : null;
        if(tgt){ const cur=(act(n).counters[tgt]||{}); actMut(n).counters={...act(n).counters,[tgt]:{...cur,aim:(cur.aim||0)+v}}; }
        n = L(n, `Aim counter placed${tgt?"":" — no arrow on the chain to hold it"}.`);
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
    const runeAtPlay = runeCount(act(s));
    /* THE SAME RULE, IN ITS GENERAL FORM (v3.22). Four pool tokens print
       "when you play an attack action card[ or activate a weapon attack],
       destroy this and X" and only Runechant was built — by NAME, through
       `isRunechantEntry`. Courage, Quicken and Briar's Embodiment of
       Lightning read `tier: none` and did nothing.

       Captured HERE for the same reason `runeAtPlay` is: the auras that
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
    exSide.res = act(s).res - effCost(card, act(s)); exSide.paySel = [];
    /* THE OPTIONAL ADDITIONAL COST IS CHARGED HERE, beside the resource
       cost, because that is what "as an additional cost to play this"
       means (v3.34). The ANSWER rides on the state as `_addPaid`, the
       same seam boost uses for `_doBoost` — a cost cannot be a queued
       prompt, which drains after the card has already resolved. */
    if(n._addPaid && fx.addPay && act(s).res >= effCost(card, act(s)) + fx.addPay.cost){
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
    if(bAct(n).viseraiPassive && /runeblade/i.test(card.tt||"") && act(n).hist.non>0){ n = mkRune(n, 1); n=L(n,`Viserai's rite — a non-attack already down, so this Runeblade card conjures a Runechant (now ${runeCount(act(n))}).`); }
    const preHP = foe(n).hp;
    /* colour is pitch: red 1, yellow 2, blue 3 — several rulings key off
       "another blue/red card this turn" */
    if(card.pitch===3) actMut(n).hist = {...act(n).hist, blue:(act(n).hist.blue||0)+1};
    if(card.pitch===1) actMut(n).hist = {...act(n).hist, red:(act(n).hist.red||0)+1};
    const attacking = isAttack(card) || from==="weapon";
    let ga = fx.ga;
    if(card._arsGA && card._upTurn === n.turn) ga = true;
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
    n._kwGrant = [];        // cleared with _discWay, and for the same reason
    const preRan = new Set();
    if(fx.ops.some(o=>o[0]==="discardRandom")){
      const pre = fx.ops.filter(o=>o[0]==="draw"||o[0]==="discardRandom");
      n = runOps(n, pre, card.name);
      pre.forEach(o=>preRan.add(o));
    }
    fx.conds.forEach(({cond,op,instead})=>{
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
      const dracLinks = n.chain.filter(l=>l.drac && l.kind==="atk").length;
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
        : cond==="blue" ? (act(n).hist.blue||0)>0
        : cond==="red" ? (act(n).hist.red||0)>0
        : cond==="transcended" ? (act(n).hist.trans||0)>0
        /* conditions added after the deep dive — all read existing state */
        : cond==="aim" ? Object.values(act(n).counters||{}).some(x=>(x.aim||0)>0)
        : /^auras\d+$/.test(cond) ? (act(n).board||[]).filter(b=>b.kind==="aura").length >= +cond.slice(5)
        : cond==="hasArsenal" ? !!act(n).arsenal
        : cond==="seismic" ? (act(n).board||[]).some(b=>/seismic surge/i.test((b.card&&b.card.name)||""))
        : cond==="suspenseAura" ? (act(n).board||[]).some(b=>b.kind==="aura" && hasKw(b.card,"suspense"))
        : /^pitchCost\d+$/.test(cond) ? act(n).pitch.some(c=>(c.cost||0) >= +cond.slice(9))
        : cond==="allyDied" ? (act(n).grave||[]).some(c=>c._gy===n.turn && /\bally\b/i.test(c.tt||""))
        : cond==="weaponSwung" ? Object.keys(act(n).weaponUsed||{}).length>0
        : cond==="dealtDmg" ? (act(n).hist.atk||0)>0 || (act(n).hist.arc||0)>0
        : cond==="revBlue" ? (n.revealed ? n.revealed.pitch===3 : false)
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
        revBlue:"the revealed card isn't blue", isDraconic:"this isn't Draconic",
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
      const qKept = (act(n).buffQ||[]).filter(b=>!qualMatches(b.q, card, qCtx));
      /* AND ANY ABILITY THOSE BUFFS GRANTED comes with them. Warrior's
         Valor's `and "When this hits, it gets go again."` belongs to the
         attack that collects the pump, so it is gathered here, from the
         entries that actually matched, and joins this attack's own on-hit
         ops below. A buff that did NOT match keeps its rider and waits. */
      const qRider = (act(n).buffQ||[]).filter(b=>b.rider && qualMatches(b.q, card, qCtx))
        .reduce((a2,b)=>a2.concat(b.rider.onHit||[]), []);
      if(qRider.length) n = L(n, `${card.name} carries a granted ability into the chain.`);
      /* what a face-up arsenal trigger stamped on this card, and only for
         the turn it was stamped — "this turn" is printed on the arrow. */
      const arsPow = (card._arsPow && card._upTurn === n.turn) ? card._arsPow : 0;
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
      const bonus = (fx.self||0)+(n._condSelf||0)+act(n).buffNext+qBuff+arsPow+payPenalty+frailPen;
      /* +1{p} COUNTERS ARE PART OF THE WEAPON'S POWER, not a bonus on the
         swing. They sit on the piece and travel between turns, so a
         counter-bearing blade is simply a bigger weapon — which is what
         makes "base {p}" checks elsewhere read it too. Counters only ever
         land on a permanent, so this is asked of the weapon route alone. */
      const powCtr = from==="weapon" ? ((act(n).counters[card.uid]||{}).pow||0) : 0;
      const base = card._powBoost ? (1 + (n.boostChain||0)) : (card.power||0) + powCtr;
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
      let gaRider = [];
      { const _gq = takeGaNext(n, card, qCtx);
        if(_gq){ ga = true; n = L(n, `${card.name} is what that grant was waiting for — go again.`);
          if(_gq.rider && _gq.rider.onHit){ gaRider = _gq.rider.onHit;
            n = L(n, `${card.name} carries a granted ability into the chain.`); } } }
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
      }
      if(from==="weapon" && /discarded a card with 6 or more \{p\} this turn, this card'?s attacks? go again/i.test(card.tx||"")){
        if(had6ThisTurn(n)){ ga = true; declNote += " A 6+ power card is in the graveyard — the claw goes again."; }
        else declNote += " (No 6+ power card discarded yet — no go again.)";
      }
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
        const fire = atkTrigAt.filter(x => x.trig.weaponToo || from !== "weapon");
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

      n.pend = {card, from, total, ga, ops:fx.ops.filter(o=>o[0]!=="reveal"&&o[0]!=="revPitch"&&o[0]!=="revColorPitch"&&o[0]!=="payOrLose"&&o[0]!=="perBoost"&&o[0]!=="perEquipDef"&&!preRan.has(o)), onHit:[...fx.onHit, ...qRider, ...gaRider], condOnHit:fx.condOnHit||[], chargedPitch, lateConds:fx.conds.filter(x=>x.cond==="defLt2"||x.cond==="defLt2any"||x.cond==="pumped"), lateOps:fx.ops.filter(o=>o[0]==="perEquipDef"), runeOnHit};
      n.stack = [{k:"atk", label:`${card.name} — attack ${total}`}];
      /* ---- RUNECHANTS POP HERE, AT DECLARATION ------------------------
         The token triggers "when you play an attack action card or activate
         a weapon attack", and a triggered ability goes onto the stack ABOVE
         the attack that triggered it — so it resolves FIRST, before the
         defend step. That is why this is here and not in resolveStack,
         where the arcane damage used to land after the attack's own damage.

         `runeAtPlay` is the count captured before this card did anything,
         so a runechant this attack conjured is not among them. Each token
         destroys itself and deals its own damage, and there is no "you may"
         in the text — all of them, mandatorily. */
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
      if(fx.arsenalPut && (fx.arsenalPut.needEmpty ? arsEmpty(act(n)) : arsFree(act(n)) > 0)){
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:actorOf(n), src:card.name,
          zone:"hand", to:"arsenal", filter:fx.arsenalPut.filter, min:0, max:1,
          ops:fx.arsenalPut.ops, arsStamp:fx.arsenalPut.stamp,
          title:"Put an arrow face up in your arsenal?",
          hint:"Optional — it goes FACE UP, so its arsenal trigger fires."}];
      } else if(fx.arsenalPut){
        n = L(n, fx.arsenalPut.needEmpty
          ? `${card.name}: it needs an empty arsenal — the rest of the card still resolves.`
          : `${card.name}: your arsenal is occupied — the rest of the card still resolves.`);
      }
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
      const _printed = card.power || 0;
      /* seat 0 is called "You", so the verb has to agree with it */
      const _s = /^you$/i.test(act(n).name || "") ? "" : "s";
      n = L(n, `${act(n).name} ${from==="weapon" ? "swing"+_s : "play"+_s} ${card.name}`
             + ` — ${total} power on the chain`
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
      n = runOps(n, fx.ops.filter(o=>!insteadKinds.has(o[0]) && !preRan.has(o)), card.name);
      if(n._gaGrant){ ga = true; delete n._gaGrant; }
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
      if(fx.self && !isAttack(card) && isAR(card) && n.pend && n.pend.by === actorOf(n)){
        const rx = attackRx(n, card, {handBlockers: (opts && opts.handBlockers) || 0});
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
      if(fx.perm === "aura"){
        const watchers = [...(act(n).gear||[]), ...((act(n).board||[]).map(b => b && b.card))]
          .filter(Boolean)
          .map(w => ({w, px: fxParse(w).payCost}))
          .filter(({w, px}) => px && px.trigger === "playAura"
                            && !(px.taps && (act(n).weaponUsed||{})[w.uid])
                            && !w.destroyed);
        for(const {w, px} of watchers)
          n.promptQ = [...(n.promptQ||[]), payCostSpec(px, w, actorOf(n))];
      }
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
    if(delta>0){ n.chain=[...n.chain,{n:card.name,img:card.img,dbImg:card.dbImg,dmg:delta,ga,drac:/draconic/i.test(card.tt||"")||!!act(n).dracNext,kind:(isAttack(card)||from==="weapon")?"atk":"arc"}]; n.hitSeq=n.hitSeq+1; n.lastDmg=delta; }
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
    if(r.ops && r.ops.length) n = runOps(n, r.ops, p.src || "prompt");
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
      const got = r.picked[0];
      if((foe(n).hand||[]).some(x => x.uid === got.uid)){
        foeMut(n).hand = foe(n).hand.filter(x => x.uid !== got.uid);
        foeMut(n).deck = [got, ...(foe(n).deck||[])];
        n = L(n, `${got.name} is pushed out of ${foe(n).name}'s hand onto the top of their deck.`);
      }
    }
    if(p.tag === "pick" && p.to === "arsenal"){
      const put = act(n).arsenal;
      if(put && !put._faceUp){
        const pfx = fxParse(put);
        const up = {...put, _faceUp:true, _upTurn:n.turn};
        for(const op of (pfx.arsenalUp||[])){
          if(op[0] === "self"){ up._arsPow = (up._arsPow||0) + op[1];
            n = L(n, `${put.name} goes face up — +${op[1]} power this turn.`); }
          else if(op[0] === "ga"){ up._arsGA = true;
            n = L(n, `${put.name} goes face up — it will go again this turn.`); }
          else n = runOps(n, [op], put.name);
        }
        /* THE SOURCE'S OWN STAMP, on top of the arrow's trigger (v2.34).
           Bull's Eye Bracers prints "It gains +1{p} until end of turn", where
           "it" is the arrow that was just put. That is a SECOND stamp, and it
           stacks with the arrow's own: an arrow set with the Bracers gets
           both. "Until end of turn" and "this turn" are the same duration, so
           both ride on _upTurn and expire together if the arrow is not
           played. The parser holds this back from fx.self precisely so it
           lands on the arrow instead of on the equipment. */
        for(const op of (p.arsStamp||[])){
          if(op[0] === "self"){ up._arsPow = (up._arsPow||0) + op[1];
            n = L(n, `${p.src}: ${put.name} also gains +${op[1]} power this turn.`); }
        }
        actMut(n).arsenal = up;
        if(!(pfx.arsenalUp||[]).length && !(p.arsStamp||[]).length)
          n = L(n, `${put.name} set face up in arsenal.`);
      }
    }
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
  const afterDefenders = (s, wall) => {
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
        /* a phantasm card may pay off on being popped — read its own text */
        const pm = clean(card.tx||"").toLowerCase().match(/when (?:this|[a-z' ]+) is destroyed, (.+?)(?:\.|$)/);
        if(pm){ const eff = classifyClause(pm[1]); if(eff && eff.status==="run") n = runOps(n, eff.ops, card.name); }
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
      let queued = 0;
      for(const dc of (wall || [])){
        const oc = fxParse(dc).optCost;
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
  const attackRx = (s, c, o) => {
    o = o || {};
    const fx = fxParse(c);
    const pend = s.pend;
    if(!pend || !pend.card) return {game: s, pump: 0, why: c.name + " has no attack to react to."};
    /* A PRINTED TARGET RESTRICTION IS A LEGALITY, NOT A MODIFIER. */
    if(fx.selfQ && !qualMatches(fx.selfQ, pend.card)){
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
      mode = fx.modes.find(md => md.q && qualMatches(md.q, pend.card)) || null;
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
    if(rider && rider.length && n.pend){
      n.pend = {...n.pend, onHit: [...(n.pend.onHit || []), ...rider]};
      n = L(n, `${c.name}: ${n.pend.card.name} carries its rider — it pays out if it connects.`);
    }
    /* `fx.ga` on an attack reaction can only mean the TARGET's go again —
       no attack reaction in the pool prints the keyword for itself. */
    if(fx.ga && n.pend){
      if(qualMatches(fx.gaQ, n.pend.card)){
        n.pend = {...n.pend, ga: true};
        n = L(n, `${c.name}: ${n.pend.card.name} goes again.`);
      } else {
        const want = P.qualLabel(fx.gaQ);
        n = L(n, `${c.name} grants go again to ${want} — ${n.pend.card.name} isn't one.`);
      }
    }
    n = runOps(n, (eff.ops || []).filter(op => op[0] !== "buffNext"), c.name);
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
    const i = q.findIndex(x => qualMatches(x, card, ctx));
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
    const pumps = (n.stack||[]).filter(l=>l.k==="rx").reduce((a,l)=>a+l.pump,0);
    let total = capNoPump(n, n.pend.card, n.pend.total + pumps);
    /* RULING (Fender Bender): +1 per separate equipment the opponent defended
       with — only knowable once defenders are declared, so it lands here. */
    for(const op of (n.pend.lateOps||[])){
      if(op[0]!=="perEquipDef") continue;
      const eq = (info && info.equipDefenders) || 0;
      total += op[1]*eq;
      n = L(n, `${n.pend.card.name}: ${eq} equipment defending — +${op[1]*eq} power.`);
    }
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
       handBlockers   non-equipment defenders, which is what dominate,
                      reprise and "defended by fewer than 2" ask about
       defenders      every defender including equipment — a DIFFERENT
                      question, and the pool prints both

     It does not clear `pend` and does not say what phase follows. Both
     callers do that themselves, because that is the half this split
     exists to keep apart. */
  const linkPayload = (s, info) => {
    let n = {...s};
    let total = info.total;
    const pumps = info.pumps || 0;
    const handBlockers = info.handBlockers || 0;
    const defCount = info.defenders || 0;
    const blkNote = info.blkNote || "";
    let rd = 0, runeMsg = "";
    (n.pend.lateConds||[]).forEach(({cond,op})=>{
      /* "defended by fewer than 2 CARDS" counts every defender, equipment
         included — distinct from defLt2, which counts non-equipment only. */
      if(cond==="defLt2any"){
        if(defCount >= 2){ n = L(n, `${n.pend.card.name}: two defenders met it — no bonus.`); return; }
        if(op[0]==="ga"){ n.pend={...n.pend, ga:true}; n = L(n, `${n.pend.card.name}: fewer than 2 defenders — go again!`); }
        else if(op[0]==="self"){ total += op[1]; n = L(n, `${n.pend.card.name}: fewer than 2 defenders — +${op[1]} power.`); }
        else n = runOps(n,[op],n.pend.card.name);
        return;
      }
      /* "{p} greater than its base" — true once anything has pumped it */
      if(cond==="pumped"){
        const base = n.pend.card.power||0;
        if(total <= base){ n = L(n, `${n.pend.card.name}: not pumped above its base ${base} — no bonus.`); return; }
        if(op[0]==="ga"){ n.pend={...n.pend, ga:true}; n = L(n, `${n.pend.card.name}: pumped above base — go again!`); }
        else if(op[0]==="self"){ total += op[1]; n = L(n, `${n.pend.card.name}: pumped above base — +${op[1]} power.`); }
        else n = runOps(n,[op],n.pend.card.name);
        return;
      }
      if(cond==="defLt2"){ // a real count now that the dummy blocks from hand
        if(handBlockers >= 2){ n = L(n, `${n.pend.card.name}: two cards from hand met it — the bonus is denied.`); return; }
        if(op[0]==="ga"){ n.pend = {...n.pend, ga:true}; n = L(n, `${n.pend.card.name}: defended by fewer than 2 non-equipment cards — go again!`); }
        else n = runOps(n,[op],n.pend.card.name);
      }
    });
    const pc = n.pend.card;
    n.chain = [...n.chain, {n:pc.name, img:pc.img, dbImg:pc.dbImg, dmg:total, ga:n.pend.ga, drac:/draconic/i.test(pc.tt||"")||!!act(n).dracNext, kind:"atk"}];
    if(total+rd>0){ n.hitSeq = n.hitSeq+1; n.lastDmg = total+rd; }
    n = L(n, `${pc.name} resolves for ${total}${pumps?` (+${pumps} reactions)`:""}.${blkNote}${runeMsg}`);
    n = runOps(n, n.pend.ops, pc.name);
    if(total>0) n = runOps(n, n.pend.onHit, pc.name);
    else if(n.pend.onHit.length) n = L(n, "Fully blocked — on-hit effects fizzle.");
    /* BOTH BOARDS GET THIS, because it lives in the shared body rather
       than in either caller's damage step. `heroHit` is the caller's
       answer — see `briarEarth`. */
    n = briarEarth(n, info.heroHit != null ? info.heroHit : (total > 0));
    /* CHARGE'S CONDITIONALLY GRANTED on-hit abilities (see fx.condOnHit in
       parser.js) — re-checked here, at the actual trigger point, rather than
       at declaration, because "if this hits" only fires on a connected
       attack. Reuses the SAME cond names/checks as the declare-time loop in
       execute() so the two can never silently disagree about what "charged"
       means. */
    if(total>0 && n.pend.condOnHit && n.pend.condOnHit.length){
      n.pend.condOnHit.forEach(({cond,op})=>{
        const met = cond==="charged" ? (act(n).hist.charged||0)>0
          : /^chargedPitch\d$/.test(cond) ? n.pend.chargedPitch === +cond.match(/\d+/)[0]
          : cond==="marked" ? !!foe(n).marked
          : false;
        if(met) n = runOps(n, [op], pc.name);
        else n = L(n, `${pc.name}: the granted on-hit bonus needed ${cond==="charged"?"a charge this turn":cond==="marked"?"the target to be marked":"a differently-coloured charge"} — condition not met.`);
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
      if(cr && total >= cr.n) n = runOps(n, cr.ops, pc.name + " — crush");
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
    const _pre = linkPumps(n, {equipDefenders: defLs.filter(l=>l.gi!=null).length});
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
    const _out = linkPayload(n, {total, pumps, handBlockers,
                               defenders: defLs.length, blkNote,
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

  return {runOps, execute, afterDefenders, resolveStack, afterDiscard, payAddCost, fileAttack,
          linkPumps, linkPayload, attackRx, autoPitch, applyAnswer,
          activateHandAbility, foeTurnIce, takeInstantNext};
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
const isInertia = b => !!(b && b.card && P.norm(b.card.name) === "inertia");
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
const isNonAtkActionCard = c => {
  const ty = (c && c.ty) || [];
  return ty.some(t => /^action$/i.test(String(t)))
      && !ty.some(t => /^attack$/i.test(String(t)));
};

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

  return d;
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
     `_upTurn` is what makes "this turn" mean this turn. */
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
function beginEndPhase(game, seat){
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
               + (sd.instantNextQ || []).length;
    if(!held) continue;
    const sides = n.sides.slice();
    sides[i] = Object.assign({}, sd,
      {buffNext: 0, buffQ: [], gaNext: false, gaNextQ: [], costOff: [], instantNextQ: []});
    n = Object.assign({}, n, {sides});
    msgs.push(nameOf(i) + ": " + held + " unspent \u201cthis turn\u201d grant"
      + (held > 1 ? "s expire" : " expires") + " with the turn.");
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

return {makeEffects, CTX_KEYS, defendValue, defSelfMet, armNextTurn, thawFrost, thawFreeze, resolveInertia, tickSuspense, sweepArena, heaveOffer, heave, beginEndPhase,
        activateIfOk, handAbilityOK, soakPolicy, payPolicy};
});
