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
   2. `execute` READS `built.runeDmg` at four sites. Per v2.41 a
      passive read as `built.X` inside a RULES function is a bug —
      `built` is seat 0’s build, captured for the UI, so it fires
      for the wrong hero the moment seat 1 acts. It is moved as-is
      and `bAct` is already in context beside it; changing it is a
      behaviour change and belongs in its own commit.

   `makeEffects(ctx)` takes the trainer closures the bodies reach
   for. They are listed explicitly rather than passed as a bag so
   that adding a dependency is a deliberate edit — the same
   discipline the bridge and P_MAP keep one layer up, and
   test/effects.test.js fails if the trainer’s literal drifts.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"), require("./cards.js"), require("./rng.js"), require("./game.js"), require("./advisor.js"));
  else root.DawnEffects = factory(root.DawnParser, root.DawnCards, root.DawnRNG, root.DawnGame, root.DawnAdvisor);
})(typeof self!=="undefined" ? self : this, function(P, C, R, G, A){

/* Engine-side dependencies, taken as factory arguments — the same
   treatment advisor.js, cards.js and prompts.js already get. */
const {arsEmpty, arsFree, classifyClause, clean, costsAP, effCost,
       fxParse, hasKw, isAttack, norm, qualMatches, runeCount,
       pow6, zonePow, isAtkActionCard} = P;
const {resolveEntry} = C;
const {popRunechants, gearDef, gearBlockApply} = G;
const {advValue} = A;
const rngRoll = R.roll, rngInt = R.int;

/* THE CONTEXT. Every name here is a closure the moved bodies call and
   that this module cannot own: the logger, the actor helpers, the card
   database, the uid counters, the hero build and the trainer’s own
   scheduling hooks. `act`/`foe` are PASSED IN rather than redefined
   here on purpose — judge.js exports its own `act`/`foe` with a
   different meaning, and a second definition under the same name is the
   collision KNOWN_COLLISIONS polices. Passing them guarantees the moved
   bodies keep calling exactly the functions they called inside Battle. */
const CTX_KEYS = ["L","act","actMut","actorOf","bAct","bFoe","built","db","dummyDefence","foe","foeMut",
                  "gy","gyDisc","had6ThisTurn","mkRune","openPrompt","tokSeq","typeAbbr","winCheck"];

function makeEffects(ctx){
  const missing = CTX_KEYS.filter(k => ctx[k] === undefined);
  if(missing.length) throw new Error("effects.js: missing context — " + missing.join(", "));
  const {L, act, actMut, actorOf, bAct, bFoe, built, db, dummyDefence, foe, foeMut,
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
      else if(k==="arcane"){ const total=v+act(n).amp; actMut(n).amp=0; foeMut(n).hp-=total; actMut(n).hist={...act(n).hist, arc:(act(n).hist.arc||0)+1}; n=L(n,`${srcName}: ${total} arcane damage.`); }
      else if(k==="buffNext"){
        /* A QUALIFIED buff ("your next ARROW attack") is not the same as a
           bare one. op[2] is the qualifier read off the printed type line;
           it rides in buffQ so only a matching attack collects it. Without
           this an arrow buff landed on a sword — 24 pool cards did that. */
        if(op[2]){ actMut(n).buffQ = [...(act(n).buffQ||[]), {amt:v, q:op[2]}];
          n=L(n,`Next ${op[2].map(g=>g.join(" ")).join(" or ")} attack +${v}.`); }
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
      else if(k==="gaNext"){ actMut(n).gaNext=true; n=L(n,"Your next attack this turn will carry go again."); }
      else if(k==="runeHitNext"){ actMut(n).runeHitNext=true; n=L(n,"Your next attack: if it hits, a Runechant is forged."); }
      else if(k==="amp"){ actMut(n).amp+=v; n=L(n,`Amp ${v} — next arcane +${v}.`); }
      else if(k==="ward"){ actMut(n).ward+=v; n=L(n,`Ward ${v}.`); }
      else if(k==="awd"){ actMut(n).awd+=v; n=L(n,`Arcane ward ${v} — soaks spells, not fists.`); }
      else if(k==="soulSelf"){ n._soulSelf = true; }
      else if(k==="ga"){ n._gaGrant = true; n = L(n, "Go again granted."); }
      else if(k==="defBuff"){ n = L(n, `+${v} defense to the wall.`); }
      else if(k==="atkMinus"){
        if(n.mode==="block"){ n.incoming = Math.max(0, n.incoming - v); n = L(n, `Incoming shaved by ${v} → ${n.incoming}.`); }
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
        const rec = resolveEntry(db, {name:v, p:0, code:null, q:1});
        if(!rec.resolved){ n = L(n, `${srcName}: no card named "${v}" in the database — token not created.`); return; }
        const side = op[3]==="foe" ? "foe" : "self";
        for(let i=0;i<(op[2]||1);i++){
          const tok = {...rec, uid:"tok"+tokSeq()};
          if(side==="foe") foeMut(n).board = [...(foe(n).board||[]), {card:tok, kind:"token", spent:false, uid:tok.uid}];
          else actMut(n).board = [...act(n).board, {card:tok, kind:"token", spent:false, uid:tok.uid}];
        }
        actMut(n).hist = {...act(n).hist, made:(act(n).hist.made||0)+1};
        if(/aura/i.test(rec.tt||"")) actMut(n).hist = {...act(n).hist, aura:(act(n).hist.aura||0)+1};
        const who = side==="foe" ? foe(n).name+"'s" : "your";
        n = L(n, `${rec.name}${(op[2]||1)>1?` ×${op[2]}`:""} created on ${who} board — ${clean(rec.tx||"no text").split(". ")[0]}.`);
        if(side==="foe") n = L(n, `${foe(n).name} pays no costs and takes no action phase, so anything that taxes those sits idle.`);
      }
      else if(k==="opt"){
        /* RULING: look at the top X, then put them back on top or bottom in
           any order — the player's call, so it queues a prompt. Queued rather
           than opened inline: opt only touches the deck, so it is safe to ask
           after the action finishes resolving. */
        if(!act(n).deck.length){ n = L(n, `${srcName}: deck is empty — nothing to opt.`); return; }
        n.promptQ = [...(n.promptQ||[]), {tag:"opt", n:Math.min(v, act(n).deck.length), src:srcName}];
      }
      /* pickPrompt — a GENERIC mandatory-or-optional targeted pick, carrying
         its own zone/to/filter/min/max as data rather than a bespoke op per
         card (see optFilter/pickPrompt in parser.js). Queued, not opened
         inline, same rule as every other prompt: the action finishes
         resolving first. */
      else if(k==="pickPrompt"){
        n.promptQ = [...(n.promptQ||[]), {tag:"pick", side:actorOf(n), src:srcName, ...v}];
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
        actMut(n).grave = act(n).grave.filter(x=>x.uid!==pc.uid);
        actMut(n).deck = [...act(n).deck, pc];
        n = L(n, `${pc.name} loops under — bottom of your deck instead of the graveyard.`);
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
      else if(k==="rot"){ actMut(n).rot+=v; n=L(n,`Bloodrot on ${act(n).name} (ticks ${v}/turn).`); }
      else if(k==="fra"){ actMut(n).fra+=v; n=L(n,`Frailty — dummy's next swing −${v}.`); }
      else if(k==="noop"){ n=L(n,`${srcName}: ${v}.`); }
    });
    return n;
  };
  const execute = (s,card,from,idx) => {
    const fx = fxParse(card);
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
    let n = {...s, mode:"act", pending:null};
    const exSide = actMut(n);
    exSide.res = act(s).res - effCost(card, act(s)); exSide.paySel = [];
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
        const ranked = act(n).hand.map((c2,i2)=>({i2,v:advValue(c2,n,{runeDmg:built.runeDmg})})).sort((a,b)=>a.v-b.v);
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
        : cond==="foeTurn" ? s.mode==="block"
        : cond==="arcDealt" ? (act(n).hist.arc||0)>0
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
        : dracN!=null ? dracLinks >= dracN : false;
      const why = {atk:"no other attack yet", non:"no other non-attack yet",
        pitch6:"no 6+ power card in your pitch zone", arsenal:"not played from arsenal",
        lifeLt:"you aren't behind on life", lifeGt:"you aren't ahead on life",
        marked:"the dummy isn't marked", foeTurn:"it's your turn, not the dummy's",
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
        fused:"no qualifying card in hand to reveal for Fusion"}[cond]
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
      /* qualified buffs only apply to an attack whose printed type line
         matches — qualMatches reads fields, never rules text */
      const qBuff = (act(n).buffQ||[]).filter(b=>qualMatches(b.q, card)).reduce((a2,b)=>a2+b.amt,0);
      const qKept = (act(n).buffQ||[]).filter(b=>!qualMatches(b.q, card));
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
      const bonus = (fx.self||0)+(n._condSelf||0)+act(n).buffNext+qBuff+arsPow+payPenalty;
      const base = card._powBoost ? (1 + (n.boostChain||0)) : (card.power||0);
      let total = base + bonus;
      /* a qualified buff that did NOT match is not spent — it waits for an
         attack it actually applies to */
      actMut(n).buffNext = 0; actMut(n).buffQ = qKept; delete n._condSelf;
      if(act(n).gaNext){ ga = true; delete act(n).gaNext; n = L(n, "The rite empowers this swing — go again."); }
      const runeOnHit = !!act(n).runeHitNext; if(act(n).runeHitNext) delete act(n).runeHitNext;
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
          pool = act(n).hand.map((c2,i2)=>({c2,i2,v:advValue(c2,n,{runeDmg:built.runeDmg})})).sort((a,b)=>a.v-b.v).slice(0,fx.addCost.discard);
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
        const bigDiscard = pool.some(p=>pow6(p.c2, bAct(n)));
        fx.conds.filter(x=>x.cond==="discard6"||x.cond==="discard6way").forEach(({op})=>{
          if(bigDiscard){ if(op[0]==="ga") ga=true; else n=runOps(n,[op],card.name); n=L(n,`${card.name}: a 6+ power card was fed to the cost — bonus triggers.`); }
          else n=L(n,`${card.name}: nothing 6+ power discarded — bonus skips.`);
        });
      } else if(fx.conds.some(x=>x.cond==="discard6"||x.cond==="discard6way")){
        n=L(n,`${card.name}: no additional-cost discard to feed — bonus skips.`);
      }
      let declNote = "";
      if(n._doBoost && hasKw(card,"boost") && act(n).deck.length){
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
      if(from==="hand"||from==="arsenal") actMut(n).grave=[...gy(n.turn, card),...act(n).grave];
      if(from==="grave"||from==="banish") actMut(n).banish=[card,...act(n).banish];
      if(card.pitch===3 && (from==="hand"||from==="arsenal")) actMut(n).hist = {...act(n).hist, blueGY:(act(n).hist.blueGY||0)+1};
      n.pend = {card, total, ga, ops:fx.ops.filter(o=>o[0]!=="reveal"&&o[0]!=="revPitch"&&o[0]!=="revColorPitch"&&o[0]!=="payOrLose"&&o[0]!=="perBoost"&&o[0]!=="perEquipDef"&&!preRan.has(o)), onHit:fx.onHit, condOnHit:fx.condOnHit||[], chargedPitch, lateConds:fx.conds.filter(x=>x.cond==="defLt2"||x.cond==="defLt2any"||x.cond==="pumped"), lateOps:fx.ops.filter(o=>o[0]==="perEquipDef"), runeOnHit};
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
      if(runeAtPlay > 0){
        const rp = popRunechants(n, actorOf(n), runeAtPlay, built.runeDmg);
        n = rp.game;
        foeMut(n).hp -= rp.damage;
        /* CREDIT THE HISTORY HERE. `popRunechants` is pure and deliberately
           does not touch hist — it reports what popped and leaves the
           bookkeeping to whoever fired it, the same way runOps's `arcane` op
           does its own. Miss this and "you have dealt arcane damage this
           turn" (arcDealt / dealtDmg) stays false after Viserai's PRIMARY
           arcane source has just resolved, and the UI pip never lights.
           Each token is its own source, so N popped is N instances — that
           is what runOps counts too (one per op, not one per point). */
        actMut(n).hist = {...act(n).hist, arc:(act(n).hist.arc||0)+rp.popped};
        n.hitSeq = n.hitSeq + 1; n.lastDmg = rp.damage;
        declNote += ` ${rp.popped} Runechant${rp.popped>1?"s":""} pop for ${rp.damage} arcane`
          + `${runeCount(act(n))?` (${runeCount(act(n))} still on the board)`:""}.`;
        n = winCheck(n);
        if(n.over) return n;
      }
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
      if(fx.optCost && fx.optCost.trigger === "attacks"){
        const oc = fx.optCost;
        n.promptQ = [...(n.promptQ||[]), {
          tag:"pick", side:actorOf(n), src:card.name,
          zone:oc.zone, to:(oc.kind === "banish" ? "banish" : "grave"),
          filter:oc.filter, min:0, max:1, ops:oc.ops,
          title:(oc.kind === "banish" ? "Banish" : "Discard") + " to power " + card.name + "?",
          hint:"Optional — choose none to decline. The rider only resolves if you pay."
        }];
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
        declNote += ` Intimidate — a card is pulled at random from the dummy's hand`
          + ` and banished face-down (${foe(n).hand.length} left); it comes back at the end phase.`;
      }
      const dd = dummyDefence(n, total, card);
      n = dd.n;
      n = L(n, `${dd.note}${declNote} Priority to you — react or pass.`);
      /* RULING 2026-07-25 — phantasm: a single blocker with 6+ printed POWER
         destroys this attack outright ("popping" it). Because the card is
         destroyed its go again never resolves and the action point is not
         refunded, so the pend is torn down here rather than resolved. */
      if(hasKw(card,"phantasm")){
        const popper = n.stack.filter(l=>l.k==="def" && l.gi==null)
          .map(l=>foe(n).hand.find(c=>c.uid===l.uid)).filter(Boolean)
          /* PRINTED power, deliberately — not zonePow. This is phantasm
             reading the DEFENDING card, which is (a) the opponent's, and
             Kayo's clause 2 reads "attack action cards YOU OWN", and
             (b) already declared, so it is ON THE COMBAT CHAIN, the one
             zone the clause excludes. Both reasons say printed. */
          .find(c=>(c.power||0) >= 6);
        if(popper){
          n.pend = null; n.stack = []; n.mode = "act";
          actMut(n).ap = act(n).ap - 1;
          n = L(n, `${popper.name} has ${popper.power} power — ${card.name} is popped by phantasm and destroyed. No go again, no refund.`);
          /* a phantasm card may pay off on being popped — read its own text */
          const pm = clean(card.tx||"").toLowerCase().match(/when (?:this|[a-z' ]+) is destroyed, (.+?)(?:\.|$)/);
          if(pm){ const eff = classifyClause(pm[1]); if(eff && eff.status==="run") n = runOps(n, eff.ops, card.name); }
          return openPrompt(winCheck(n));
        }
      }
      n.mode = "stack";
      return n;
    } else {
      if(card._buildSteam){ const tgt=card._steamFor, cur=(act(n).counters[tgt]||{}); if((cur.steam||0)===0){ actMut(n).counters={...act(n).counters,[tgt]:{...cur,steam:1}}; n=L(n,`${card.name.replace(" — build steam","")}: steam counter built.`); } else n=L(n,"It already carries a steam counter."); }
      if(fx.addCost && fx.addCost.discard && act(n).hand.length){
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
          pool = act(n).hand.map((c2,i2)=>({c2,i2,v:advValue(c2,n,{runeDmg:built.runeDmg})})).sort((a,b)=>a.v-b.v).slice(0,fx.addCost.discard);
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
      }
      n = runOps(n, fx.ops.filter(o=>!insteadKinds.has(o[0]) && !preRan.has(o)), card.name);
      if(n._gaGrant){ ga = true; delete n._gaGrant; }
      if(fx.self && !isAttack(card)){ actMut(n).buffNext += fx.self; n = L(n, `${card.name}: +${fx.self} power queued for your next attack.`); }
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
        actMut(n).board=[...act(n).board,{card,kind:fx.perm,spent:false,uid:card.uid,verse:_vm?+_vm[1]:0,sd:_sd}]; if(fx.perm==="aura") actMut(n).hist={...act(n).hist, aura:(act(n).hist.aura||0)+1}; n=L(n,`${card.name} enters play (${fx.perm})${_vm?` with ${_vm[1]} verse counters`:""}.`); }
      else if(from==="hand"||from==="arsenal") actMut(n).grave=[...gy(n.turn, card),...act(n).grave];
      else if(from==="grave"||from==="banish") actMut(n).banish=[card,...act(n).banish];
      actMut(n).hist = {...act(n).hist, non:act(n).hist.non+1};
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
    const apCost = costsAP(card) ? 1 : 0;
    actMut(n).ap = act(n).ap - apCost + (ga ? 1 : 0);
    if(ga) n = L(n, apCost ? "Go again — action point kept." : "Go again on an instant — an action point gained (CR 5.3.5).");
    else if(!apCost) n = L(n, `${card.name} plays at instant speed — no action point spent.`);
    return openPrompt(winCheck(n));
  };

  /* THE LAST OF THE THREE (v2.62). runOps and execute were plain
     closures and moved verbatim; this one was `() => setG(s=>{…})`, so
     what moved is its BODY — which was already a pure s => s' — with the
     React wrapper left behind in the trainer as `() => setG(_EFX.resolveStack)`.
     The body itself is unchanged.

     With this, ONE COPY of the card semantics exists. What still keeps
     the table from running them is not location any more: `execute`
     drives the turn structure through the trainer's `mode`/`pend`/`stack`
     vocabulary, and judge.js drives it through `phase`/`step`. Separating
     "what the card does" from "what happens next" is the remaining work,
     and the inline dummyDefence call is the first knot in it. */
  const resolveStack = (s) => {
    if(s.mode!=="stack" || !s.pend) return s;
    let n = {...s};
    const pumps = n.stack.filter(l=>l.k==="rx").reduce((a,l)=>a+l.pump,0);
    const defLs = n.stack.filter(l=>l.k==="def");
    let total = n.pend.total + pumps;
    let blkNote = "";
    /* non-equipment defenders are what dominate, reprise and "defended by
       fewer than 2" all actually care about — count them for real */
    let handBlockers = 0;
    /* RULING (Fender Bender): +1 per separate equipment the opponent defended
       with — only knowable once defenders are declared, so it lands here. */
    for(const op of (n.pend.lateOps||[])){
      if(op[0]!=="perEquipDef") continue;
      const eq = defLs.filter(l=>l.gi!=null).length;
      total += op[1]*eq;
      n = L(n, `${n.pend.card.name}: ${eq} equipment defending — +${op[1]*eq} power.`);
    }
    if(defLs.length){
      /* CR: every defender's printed defence sums, and the total reduces the
         attack once — so report each card's real defence, not a running
         remainder that makes the last blocker look weaker than it is. */
      const parts = [];
      let wall = 0;
      for(const dl of defLs){
        if(dl.gi != null){
          const piece = foe(n).gear[dl.gi];
          wall += gearDef(piece);
          foeMut(n).gear = foe(n).gear.map((x,ix)=>ix===dl.gi?gearBlockApply(x):x);
          /* an equipment that has blocked is spent for the rest of this chain */
          foeMut(n).chainBlocked = [...(foe(n).chainBlocked||[]), piece.uid];
          parts.push(`${piece.name} ${gearDef(piece)}`);
        } else {
          const c = foe(n).hand.find(x=>x.uid===dl.uid);
          if(!c) continue;
          wall += (c.def||0);
          foeMut(n).hand = foe(n).hand.filter(x=>x.uid!==dl.uid);
          foeMut(n).grave = [c, ...foe(n).grave];
          handBlockers++;
          parts.push(`${c.name} ${c.def||0}`);
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
    let rd = 0, runeMsg = "";
    (n.pend.lateConds||[]).forEach(({cond,op})=>{
      /* "defended by fewer than 2 CARDS" counts every defender, equipment
         included — distinct from defLt2, which counts non-equipment only. */
      if(cond==="defLt2any"){
        if(defLs.length >= 2){ n = L(n, `${n.pend.card.name}: two defenders met it — no bonus.`); return; }
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
    if(n.pend.runeOnHit && total>0){ n = mkRune(n, 1); n = L(n, `${pc.name} connects — a Runechant is forged (now ${runeCount(act(n))}), poised for your next swing.`); }
    if(hasKw(pc,"crush") && total>=4){
      /* the threshold is met and the dummy has a hand now — the payloads
         that reach for an arsenal or its action phase are still inert */
      if(foe(n).hand.length){
        const top = foe(n).hand[foe(n).hand.length-1];
        foeMut(n).hand = foe(n).hand.slice(0,-1);
        foeMut(n).deck = [top, ...foe(n).deck];
        n = L(n, `Crush — ${top.name} is forced from the dummy's hand back on top of its deck.`);
      } else n = L(n, "Crush lands, but the dummy's hand is empty.");
    }
    if(n._soulSelf){ delete n._soulSelf;
      if(total>0){ actMut(n).grave = act(n).grave.filter(x=>x!==pc); actMut(n).soul = [...act(n).soul, pc]; n = L(n, `${pc.name} ascends to the soul.`); }
    }
    n.featured = {card:{name:pc.name,img:pc.img,dbImg:pc.dbImg,pitch:0}, chip:`LINK ${n.chain.length} — ${total} DMG`};
    if(n._gaGrant){ n.pend = {...n.pend, ga:true}; delete n._gaGrant; }
    actMut(n).hist = {...act(n).hist, atk:act(n).hist.atk+1};
    actMut(n).ap = n.pend.ga ? act(n).ap : act(n).ap-1;
    if(n.pend.ga) n = L(n, "Go again — action point kept.");
    n.chainOpen = true;
    n.stack = []; n.pend = null; n.mode = "act";
    return openPrompt(winCheck(n));
  };

  return {runOps, execute, resolveStack, afterDiscard};
}

return {makeEffects, CTX_KEYS};
});
