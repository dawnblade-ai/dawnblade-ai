/* ============================================================
   Dawnblade engine — parser.js (Phase 1 extraction)
   THE JUDGE's reading eye: the pure card-text interpreter,
   extracted verbatim from index.html. Zero DOM; runs in Node
   and the browser (window.DawnParser).

   Golden rule: teach the parser, never special-case a card
   by name. Function bodies must stay textually identical to
   index.html — test/sync.test.js enforces the lockstep until
   the trainer imports this file directly.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnParser = factory();
})(typeof self!=="undefined" ? self : this, function(){

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const isAttack = c => /attack/i.test(c.tt) && /action/i.test(c.tt) && c.power!=null;
const isArrow  = c => /arrow/i.test(c.tt);
const isWeapon = c => /weapon/i.test(c.tt) && c.power!=null;
const hasGA = c => (c.kw||[]).some(k=>/go again/i.test(k)) || /\bgo again\b/i.test(c.tx||"");
const arcaneDmg = c => { const m=(c.tx||"").match(/deals? (\d+) arcane damage/i); return m?+m[1]:null; };

const NWORD = {a:1,an:1,one:1,two:2,three:3,four:4};
const num = w => NWORD[w] || parseInt(w,10) || 1;
const clean = t => (t||"").replace(/\*\*?/g,"").replace(/\s+/g," ").trim();

function classifyClause(raw){
  /* modal options print with a leading dash ("- Target dagger attack gets +3{p}") */
  const c = clean(raw).toLowerCase().replace(/\.$/,"").replace(/^-\s*/,"");
  if(!c) return null;
  const R = (ops,extra) => Object.assign({status:"run",ops},extra||{});
  const NOOP = why => ({status:"noop",ops:[["noop",why]]});
  let m;
  /* Activated abilities first. "Instant - Destroy this: Gain {r}" is a cost
     you pay, not an effect that fires on its own — matching it against the
     generic effect rules below would hand out the resource for free. The
     cost/effect split belongs to weaponCost and parseHeroPower. */
  if(/^(?:once per turn )?(?:action|instant)\s*[-—]/.test(c)){
    if(weaponCost(raw)) return NOOP("weapon attack ability — cost read by the weapon reader");
    if(parseHeroPower(raw, true)) return NOOP("activated ability — read by the equipment reader");
    return null;
  }
  /* ---- whole-clause patterns -----------------------------------------
     These all begin with If/When but must be read as ONE unit. The if/when
     handler below splits on the first comma and would either fail to read
     the payload or lose the condition entirely, so they come first. */
  if(/^when this is discarded at random, put it on the bottom of its owner'?s? deck$/.test(c))
    return NOOP("discard redirect — honoured by the discard path, not on resolution");
  if(/^when you win a clash revealing this, deal \d+ damage to the other hero$/.test(c))
    return NOOP("reveal payoff — fires if this is the card revealed on a winning clash");
  if(/^when it has none, destroy it$/.test(c))
    return NOOP("counter tick — destruction handled with the tick that empties it");
  if(/^if you win, this gets \+\d+\s*\{d\}(?: until end of turn)?$/.test(c))
    return NOOP("clash payoff — the defence step applies this when you win");
  /* RULING (Reaping Blade): a static lock — the hero ahead on life can't gain
     any. The life op checks it before healing. */
  if(/^if a hero has more \{h\} than any other hero, they can'?t gain \{h\}$/.test(c))
    return R([["lifeLock",1]]);
  /* RULING (Pyroglyphic Protection): prevents arcane PER SOURCE while it is in
     play — ten runechants popping are ten sources, so ten prevented. Distinct
     from ward/awd, which is a single pool that drains. */
  if(m=c.match(/^if your hero would be dealt arcane damage, prevent (\d+) arcane damage that source would deal$/))
    return R([["arcShield", +m[1]]]);
  /* Cost reductions are read by boardRed / runeRed inside effCost, before the
     pitch prompt — they are not effects that fire on resolution. Both must sit
     above the if/when handler, which would otherwise split them and fail. */
  if(/^if you control (?:a|an) [a-z' -]+, this costs \{r\} less to play$/.test(c))
    return NOOP("cost reduction — applied by the cost reader when you play it");
  if(/^this costs \{r\} less to play for each runechant(?: token)? you control$/.test(c))
    return NOOP("cost reduction — applied by the cost reader when you play it");
  /* The clash block reads "the winner creates a <X> token" off the card's own
     text at declaration and routes the token to whoever won. */
  if(/^the winner creates? (?:a|an|\d+) [a-z' -]+ tokens?$/.test(c))
    return NOOP("clash payoff — the clash block creates this for whoever wins");
  /* Mandible Claw's rider is read off the weapon when it swings. */
  if(/^if you have discarded a card with \d+ or more \{p\} this turn, this card'?s attacks? go again$/.test(c))
    return NOOP("weapon rider — read from the graveyard stamp when the weapon swings");
  if(m=c.match(/^(?:if|when|while) ([^,:]+)[,:] ?(.+)$/)){
    const cond=m[1], rest=classifyClause(m[2]);
    if(!rest) return null;
    /* A noop inner is already accounted for elsewhere (a keyword the engine
       carries, a cost the reader applies). It does nothing either way, so pass
       it through rather than throwing the whole clause away —
       "When this attacks, intimidate." was failing for exactly this reason. */
    if(rest.status!=="run") return rest;
    if(/\bhits?\b/.test(cond)) return Object.assign(rest,{onHit:true});
    if(/another attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"atk"});
    if(/another non-attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"non"});
    if(/6 or more \{p\}[^.]*pitch zone/.test(cond)) return Object.assign(rest,{cond:"pitch6"});
    if(/defended by fewer than 2 non-equipment/.test(cond)) return Object.assign(rest,{cond:"defLt2"});
    if(/6 or more \{p\}[^.]*discard/.test(cond)) return Object.assign(rest,{cond:"discard6"});
    if(/^you attack with /.test(cond)) return rest;
    /* Arena triggers: the trainer has no leaves/enters-the-arena schedule,
       so the payload fires when the card is played — early, but the value
       is real. Flagged approx so the honest ledger keeps counting it. */
    if(/^this (?:leaves|enters|enters or leaves) the arena/.test(cond)) return Object.assign(rest,{approx:true});
    /* "When this is played, …" is just on-resolution, which is when every
       effect already fires — pass the inner clause (and its own condition)
       straight through. Note "if you do, …" deliberately stays unread: it
       hangs off an optional cost, and running it free is the bug v2.04 fixed. */
    if(/^(?:this is played|you play this|this attacks(?: a hero)?)$/.test(cond)) return rest;
    /* "When this defends, …" — the block step is a real trigger point */
    if(/^this defends(?: an attack)?$/.test(cond)) return rest;
    /* "attacks or defends" — the defend half has no trigger point yet */
    if(/^this attacks or defends$/.test(cond)) return Object.assign(rest,{approx:true});
    /* RULING (Emeritus Scolding): a card played at instant speed during the
       opponent's turn gets the bigger effect — Iyslander's whole game. */
    if(/is played during an opponents? turn/.test(cond)) return Object.assign(rest,{cond:"foeTurn"});
    /* RULING (Sigil of Suffering): +{d} once you've already dealt arcane */
    if(/you have dealt arcane damage this turn/.test(cond)) return Object.assign(rest,{cond:"arcDealt"});
    /* RULING (auras): non-attack actions that stay in play — so "played or
       created an aura this turn" is a countable fact about the board. */
    if(/you'?(?:ve| have) played or created an aura this turn/.test(cond)) return Object.assign(rest,{cond:"auraTurn"});
    if(/you'?(?:ve| have) created a card this turn/.test(cond)) return Object.assign(rest,{cond:"madeCard"});
    /* RULING: being booed is a per-turn state other cards test for */
    if(/you'?(?:ve| have) been booed this turn/.test(cond)) return Object.assign(rest,{cond:"booed"});
    if(/you'?(?:ve| have) played another blue card this turn/.test(cond)) return Object.assign(rest,{cond:"blue"});
    if(/you'?(?:ve| have) played another red card this turn/.test(cond)) return Object.assign(rest,{cond:"red"});
    if(/you'?(?:ve| have) transcended this turn/.test(cond)) return Object.assign(rest,{cond:"transcended"});
    /* RULING: cards get a bonus "if played from arsenal" — the engine always
       knew which zone a card came from, it just had no condition for it. */
    if(/^(?:this was |it was |this is )?played from (?:your )?arsenal/.test(cond)
       || /^this was played from arsenal/.test(cond)) return Object.assign(rest,{cond:"arsenal"});
    /* RULING (Scar for a Scar): go again while you are behind on life */
    if(/you have less \{h\} than (?:an|the) opposing hero/.test(cond)) return Object.assign(rest,{cond:"lifeLt"});
    if(/you have more \{h\} than (?:them|an opposing hero)/.test(cond)) return Object.assign(rest,{cond:"lifeGt"});
    /* RULING: chain links are counted per turn, link 1 being the turn's first
       attack; Draconic is a talent printed alongside the other types. */
    if(m=cond.match(/you control (\d+) or more draconic chain links/)) return Object.assign(rest,{cond:"drac"+m[1]});
    if(/^this is attacking a marked hero/.test(cond) || /the defending hero is marked/.test(cond))
      return Object.assign(rest,{cond:"marked"});
    /* ---- conditions the engine can already answer -----------------------
       Each of these reads state the trainer has held all along: the aim
       counter on the chain link, the aura count on the board, the arsenal,
       the pitch zone, the turn's attack count, the graveyard stamp. */
    if(/^this has an aim counter$/.test(cond)) return Object.assign(rest,{cond:"aim"});
    if(m=cond.match(/^you control (\d+) or more auras$/)) return Object.assign(rest,{cond:"auras"+m[1]});
    if(/^you have a card in your arsenal$/.test(cond)) return Object.assign(rest,{cond:"hasArsenal"});
    if(/^you control a seismic surge token$/.test(cond)) return Object.assign(rest,{cond:"seismic"});
    if(m=cond.match(/^there is a card with cost (\d+) or greater in your pitch zone$/))
      return Object.assign(rest,{cond:"pitchCost"+m[1]});
    if(/^an ally has been put into your graveyard this turn$/.test(cond))
      return Object.assign(rest,{cond:"allyDied"});
    if(/^you have attacked with a weapon this turn$/.test(cond))
      return Object.assign(rest,{cond:"weaponSwung"});
    if(/^this is defended by fewer than 2 cards$/.test(cond))
      return Object.assign(rest,{cond:"defLt2any"});
    if(/^you'?(?:ve| have) dealt damage this turn$/.test(cond))
      return Object.assign(rest,{cond:"dealtDmg"});
    /* "{p} greater than its base" — the pump is known once the total is struck */
    if(/^this has \{p\} greater than its base$/.test(cond))
      return Object.assign(rest,{cond:"pumped"});
    if(/^it'?s blue$/.test(cond)) return Object.assign(rest,{cond:"revBlue"});
    /* "if it is Draconic" — a question about the card's own printed talent,
       which may also be granted for the chain by dracNext. */
    if(/^it is draconic$/.test(cond)) return Object.assign(rest,{cond:"isDraconic"});
    /* a pitch-zone card fatter than this card's own printed power */
    if(/^there is a card in your pitch zone with \{p\} greater than this'?s? base \{p\}$/.test(cond))
      return Object.assign(rest,{cond:"pitchOverBase"});
    /* ties count as "more" and "less" both ways (Line Crossers) */
    if(/^you have the same \{h\} as a hero$/.test(cond)) return Object.assign(rest,{cond:"lifeTie"});
    if(m=cond.match(/^you'?(?:ve| have) attacked with a ([a-z' -]+) this turn$/))
      return Object.assign(rest,{cond:"atkNamed:"+m[1].trim()});
    if(m=cond.match(/^you'?(?:ve| have) hit (\d+) or more times this combat chain$/))
      return Object.assign(rest,{cond:"hit"+m[1]});
    return null;
  }
  if(/^go again$/.test(c)) return R([["ga"]]);
  if(/(?:this|it) (?:gains?|gets?|has) go again$/.test(c)) return R([["ga"]]);
  /* Printed keyword lines. The database prints these on their own line.
     The engine honors them through card_keywords — equipment wear, the
     boost prompt, the crush threshold — or they are honestly inert
     against a hand-less dummy. Pending and unreviewed keywords are
     deliberately absent: they must keep surfacing as coverage gaps. */
  if(/^(?:boost|battleworn|temper|guardwell|blade break|crush)$/.test(c)) return NOOP("printed keyword — carried by the engine's keyword system");
  if(/^(?:arcane barrier|spellvoid)(?: \d+| x)?$/.test(c)) return NOOP("stops arcane damage — the dummy throws only fists");
  if(/^inertia$/.test(c)) return NOOP("taxes the opponent's action phase — the dummy has none");
  if(/^watery grave$/.test(c)) return NOOP("live — Gravy Bones' ability enables it once a blue card has hit your graveyard");
  /* Ephemeral, per its own printed reminder text: if it would be put into a
     graveyard from anywhere, instead it ceases to exist. Enforced in gy(). */
  if(/^ephemeral$/.test(c)) return NOOP("live — it ceases to exist instead of reaching a graveyard");
  /* Reprise is live from v2.09: the dummy blocks from hand, so "has defended
     with a card from their hand this chain link" is a real count of the
     non-equipment defenders currently declared. */
  if(/^reprise$/.test(c)) return NOOP("qualifier — the payload clause below carries the condition");
  if(m=c.match(/^reprise\s*[-—]\s*if the defending hero has defended with a card from their hand this chain link, (.+)$/)){
    const sub = classifyClause(m[1]);
    if(!sub || sub.status!=="run") return null;
    return Object.assign(sub,{cond:"reprise"});
  }
  if(/^legendary$/.test(c)) return NOOP("deckbuilding marker — one copy per deck");
  /* RULING 2026-07-25: stealth, mark and aim counters "do nothing on their
     own" — they are qualifiers other cards test for. So the bare keyword
     line is genuinely a no-op; what matters is the state it leaves behind,
     which the mark/aim effect clauses below actually set. */
  if(/^(?:stealth|cloaked)$/.test(c)) return NOOP("qualifier only — other cards check an attack for it");
  /* RULING 2026-07-25: phantasm is a drawback, not an ability — a single
     blocker with 6+ printed POWER destroys the attack outright ("popping"
     it), and because it is destroyed its go again never resolves. Enforced
     at the declare step, so the keyword line itself is a no-op. */
  if(/^phantasm$/.test(c)) return NOOP("drawback — a single 6+ power blocker pops this attack (checked when defenders are declared)");
  /* RULING: "the crowd boos you" leaves a per-turn state and nothing else;
     Reviled is a static talent. Other cards read the state. */
  if(/^the crowd boos (?:you|each reviled hero)$/.test(c)) return R([["boo",1]]);
  if(/^the crowd cheers each revered hero$/.test(c)) return NOOP("Revered is a static talent — nothing to resolve");
  if(/^(?:mark|marked)$/.test(c)) return NOOP("qualifier only — marking is a state other cards read");
  if(/^[a-z' ]+ specialization$/.test(c)) return NOOP("hero-locked card — deckbuilding marker");
  if(/^crush\s*[-—]\s*when this deals \d+ or more damage to a hero/.test(c)) return NOOP("crush rider — the payload reaches for a hand, arsenal or turn the dummy hasn't got");
  if(/^as an additional cost/.test(c)) return NOOP("additional cost — enforced when played");
  if(m=c.match(/(?:target )?defending card (?:gains?|gets?) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:^|this |it )(?:gains?|gets?|has) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:target )?attack(?:ing card)? (?:gets?|gains?) -(\d+)\s*(?:\{p\}|power)/)) return R([["atkMinus",+m[1]]]);
  /* "Target <weapon/sword/dagger/…> attack gains +N{p}" — the pump a
     reaction hands the attack it is targeting. playRx folds fx.self into
     the chain link, so self is the faithful op here. */
  if(m=c.match(/^target [^.]*\battack\b[^.]* (?:gets?|gains?|has) \+(\d+)\s*(?:\{p\}|power)/)) return R([["self",+m[1]]]);
  /* the go-again twin of the target-attack pump */
  if(/^target [^.]*\battack\b[^.]* (?:gets?|gains?) go again$/.test(c)) return R([["ga"]]);
  /* "they lose N{h}" is damage to the opposing hero */
  if(m=c.match(/^(?:they|the defending hero|target hero) loses? (\d+)\s*\{h\}$/)) return R([["dmg",+m[1]]]);
  /* "it gets -N{p}" while defending — the incoming swing is shaved */
  if(m=c.match(/^(?:this|it) gets -(\d+)\s*\{p\}$/)) return R([["atkMinus",+m[1]]]);
  /* the clash block reads this off the card and applies it to the block */
  /* spellvoid destroys itself to stop arcane; the dummy throws only fists */
  if(/^spellvoid x, where x is the number of chain links you control$/.test(c))
    return NOOP("stops arcane damage — the dummy throws only fists");
  /* rust destruction already runs in the end phase */
  if(/^at the beginning of your end phase, if this has \d+ or more rust counters on it, destroy it$/.test(c))
    return NOOP("rust — the end phase already destroys it at 3 counters");
  /* the dummy holds a hand now, so revealing it is a real thing to do */
  if(/^target opponent reveals their hand$/.test(c)) return R([["foeReveal",1]]);
  /* a self-imposed cost tax for the rest of the turn */
  if(m=c.match(/^cards cost \{r\} more to play this turn$/)) return R([["costTax",1]]);
  if(/^(dominate|intimidate)$/.test(c)) return NOOP("live since v2.05 — the dummy holds a hand to restrict and to lose cards from");
  if(/(?:they|the defending hero|target hero|defending hero|opponent|each opponent) discards?/.test(c)) return R([["foeDiscard",1]]);
  if(m=c.match(/^ward (\d+)/)) return R([["ward",+m[1]]]);
  if(m=c.match(/prevent (?:the next )?(\d+) (?:points? of |of )?(arcane )?(?:that )?damage/)) return m[2] ? R([["awd",+m[1]]]) : R([["ward",+m[1]]]);
  /* RULING (Crucible of Aetherweave, Absorb in Aether): "the next card you
     play this turn with an effect that deals arcane damage, instead deals
     that much arcane damage plus N" is the bonus-arcane pool — which the
     engine already has, as amp. Same mechanic, spelled out longhand. */
  if(m=c.match(/(?:next card you play this turn with an effect that deals arcane damage, instead deals|effect that deals arcane damage, instead that effect deals) that much arcane damage plus (\d+)/))
    return R([["amp",+m[1]]]);
  /* RULING: auras that scrub themselves at the top of your next turn */
  if(/^at the (?:beginning|start) of your (?:action phase|turn), destroy this$/.test(c))
    return R([["selfDestruct","turn"]]);
  if(/^at the beginning of your end phase, destroy this$/.test(c))
    return R([["selfDestruct","end"]]);
  if(m=c.match(/deals? (\d+) arcane damage/)) return R([["arcane",+m[1]]]);
  /* plain (non-arcane) damage from an effect — "deal 2 damage to any target" */
  if(m=c.match(/deals? (\d+) damage to (?:any target|target hero|them|the other hero|the defending hero)/))
    return R([["dmg",+m[1]]]);
  if(m=c.match(/draw (a|an|one|two|three|\d+) cards?/)) return R([["draw",num(m[1])]]);
  if(m=c.match(/gains? (\d+)\s*(?:\{r\}|resource)/)) return R([["res",+m[1]]]);
  /* Bare pip costs: "Gain {r}{r}" is two resources — count the symbols. */
  if(m=c.match(/gains? ((?:\{r\})+)/)) return R([["res",m[1].split("{r}").length-1]]);
  if(m=c.match(/gains? (\d+) action points?/)) return R([["ap",+m[1]]]);
  if(m=c.match(/gains? (\d+)\s*(?:\{h\}|life)/)) return R([["life",+m[1]]]);
  if(m=c.match(/(?:your|the) next(?:[^.+]{0,70})attack[^+]*\+(\d+)\s*(?:\{p\}|power)/)) return R([["buffNext",+m[1]]]);
  if(/(?:your|the) next[^.]*attack[^.]*go again/.test(c)){ const o=[["gaNext"]]; if(/create a runechant/.test(c)) o.push(["runeHitNext"]); return R(o); }
  if(m=c.match(/(?:^|this(?: attack)? |it )(?:gains?|gets?|has) \+(\d+)\s*(?:\{p\}|power)/)) return R([["self",+m[1]]]);
  if(m=c.match(/\bamp (\d+)/)) return R([["amp",+m[1]]]);
  if(m=c.match(/create (a|an|\d+|one|two|three) runechants?/)) return R([["rune",num(m[1])]]);
  /* RULING: opt X — look at the top X, then put them back on top or bottom
     in any order. The trainer reorders by advisor value and says so. */
  if(m=c.match(/^opt (\d+|x)\b/)) return R([["opt", m[1]==="x"?1:+m[1]]]);
  /* RULING (Ravenous Rabble): reveal the top card, then the attack shifts by
     that card's PITCH — red 1, yellow 2, blue 3. The reveal itself is
     information both players see; the maths is what the engine needs. */
  if(/^reveal the top card of your deck$/.test(c)) return R([["reveal",1]]);
  /* looking is private where revealing is public, but for the trainer both
     just put the top card in front of you. */
  if(/^look at the top card of (?:your|target hero'?s?) deck$/.test(c)) return R([["reveal",1]]);
  if(m=c.match(/this gets ([+-])x\s*\{p\}, where x is the pitch value of the card revealed/))
    return R([["revPitch", m[1]==="-" ? -1 : 1]]);
  /* RULING (Knucklehead): roll a d6, and your base intellect becomes the
     roll until end of turn — intellect is the end-of-turn draw, so this is
     a real swing. Two ops, because they are two printed sentences. */
  if(/^roll a (?:6|six)-sided die$/.test(c)) return R([["roll",6]]);
  if(/^until end of turn, your base \{i\} is the number rolled$/.test(c)) return R([["intRoll"]]);
  /* RULING (Put in Context): a printed limit on what this may be declared
     against — enforced when blockers are declared, not on resolution. */
  if(/^this can only defend an attack with \d+ or less base \{p\}$/.test(c))
    return NOOP("defender restriction — checked when you declare it as a blocker");
  if(/^play this only if /.test(c)) return NOOP("play restriction — checked before the card can be played");
  /* RULING (Out Pace): a restriction on what may be declared against it */
  if(/^this can'?t be defended by equipment$/.test(c))
    return NOOP("defence restriction — the opponent may not raise equipment against this");
  /* RULING (Fender Bender): +1 per separate equipment the opponent defended
     with. Only knowable after defenders are declared, so it resolves late. */
  if(/^this gets \+x\s*\{p\}, where x is the number of equipment defending it$/.test(c))
    return R([["perEquipDef",1]]);
  /* RULING (Overblast): Dash's per-chain boost count */
  if(/^this gains? \+x\s*\{p\}, where x is the number of times you have boosted this combat chain$/.test(c))
    return R([["perBoost",1]]);
  /* RULING (Under Loop): on hit it recycles instead of hitting the graveyard,
     and the combat chain stays open. Written as the bare payload so the
     if/when handler above applies the onHit wrapper itself. */
  if(/^put (?:it|this) on the bottom of its owner'?s? deck$/.test(c))
    return R([["bottomSelf",1]]);
  /* RULING 2026-07-25: transcend flips the card over — it BECOMES Inner Chi
     (printed on its back) and returns to hand instead of hitting the
     graveyard on resolution. Inner Chi is already a card in the database. */
  if(/^transcend$/.test(c)) return R([["transcend"]]);
  if(m=c.match(/\bmark (?:them|target (?:opposing )?hero)\b/)) return R([["mark",1]]);
  if(m=c.match(/put an aim counter on it/)) return R([["aim",1]]);
  /* the dummy has a real deck now, so banishing off the top is a real cost */
  if(/^banish the top card of their deck$/.test(c)) return R([["foeBanishTop",1]]);
  /* "Your first attack each turn gets +1{p}" — a standing buff while in play */
  if(/^your first attack each turn gets \+(\d+)\s*\{p\}$/.test(c))
    return R([["firstAtkBuff", +c.match(/\+(\d+)/)[1]]]);
  if(/^intimidate target hero$/.test(c)) return NOOP("live — the dummy loses a card at random when this attacks");
  /* RULING 2026-07-25 (Ninja / Crouching Tiger) — a card minted straight into
     the banished zone, playable that turn. Written generically off the name in
     the text, so it is not Crouching-Tiger-specific. */
  if(m=c.match(/^create a ([a-z][a-z' -]*?) in your banished zone$/))
    return R([["mkBanish", m[1].trim()]]);
  if(/^you may play it this turn$/.test(c))
    return NOOP("playable this turn — the flag is set when the card is created");
  if(m=c.match(/^the next ([a-z][a-z' -]*?) you play this turn gains \+(\d+)\s*\{p\}$/))
    return R([["namedBuff", m[1].trim(), +m[2]]]);
  /* activation gates on equipment abilities — the gate is its own printed
     sentence, so it must read as accounted-for while fx.activateIf enforces it */
  if(/^activate this(?: ability)? only (?:if|while|during)/.test(c))
    return NOOP("activation gate — checked before the ability can be used");
  /* Clash fires when the card DEFENDS (which is what every clash card says),
     resolved in the defence step off the clash keyword. */
  if(/^clash with the attacking hero$/.test(c))
    return NOOP("clash — resolved when this blocks, off the clash keyword");
  /* RULING (Draconic chain): a card can make your next attack count as Draconic */
  if(/^your next attack this combat chain is draconic in addition to its other card types$/.test(c))
    return R([["dracNext",1]]);
  /* "When it has none, destroy it" — the tail of a counter-tick sentence; the
     tick op that precedes it owns the destruction. */
  if(/^destroy it at the beginning of the end phase$/.test(c))
    return R([["selfDestruct","end"]]);
  if(/^damage that would be dealt by this can'?t be prevented$/.test(c))
    return R([["unpreventable",1]]);
  if(/^defense reactions can'?t be played to this(?:'s)? chain link$/.test(c))
    return NOOP("the dummy plays no defence reactions — nothing to deny yet");
  if(/^this enters the arena with (\d+) (?:verse|steam) counters?$/.test(c))
    return R([["enterCounters", +c.match(/(\d+)/)[1]]]);
  if(/^this enters the arena with a steam counter$/.test(c)) return R([["enterCounters",1]]);
  if(/create .*frostbite/.test(c)) return NOOP("frostbite — dummy pays no costs");
  if(/(create|give).*bloodrot/.test(c)) return R([["rot",1]],{approx:true});
  if(/(create|give).*frailty/.test(c)) return R([["fra",1]],{approx:true});
  /* RULING: a token is a card — put one copy on the correct player's board.
     "under their control" sends it to the opponent instead. This sits AFTER
     runechant/frostbite/bloodrot/frailty on purpose: those four already have
     dedicated counters and documented inertness, and a generic token would
     quietly take their place. */
  if(m=c.match(/create (?:a|an|(\d+)|one|two|three|x) ([a-z][a-z' ,-]*?) tokens?(?: in| under| on|,|\.|$)/)){
    const foe = /under (?:their|the attacking hero'?s?|target hero'?s?) control/.test(c);
    /* "Create an Agility and a Vigor token" is TWO tokens sharing one noun —
       split the list, or the name resolves to "agility and a vigor" and the
       card silently creates nothing. */
    const names = m[2].split(/\s*,\s*|\s+and\s+/)
      .map(x=>x.replace(/^(?:a|an|one|two|three)\s+/,"").trim()).filter(Boolean);
    if(!names.length) return null;
    return R(names.map(nm=>["token", nm, m[1]?+m[1]:1, foe?"foe":"self"]));
  }
  if(/inertia/.test(c)) return NOOP("inertia — dummy has no action phase");
  if(/put (?:it|this card) into your (?:hero'?s? )?soul/.test(c)) return R([["soulSelf"]]);
  if(m=c.match(/banish (a|an|one|two|three|\d+) cards? from your (?:hero'?s? )?soul[:,]? ?(.*)/)){
    const sub = m[2] ? classifyClause(m[2]) : null;
    if(!sub || sub.status!=="run") return null;
    return R([["soulSpend", num(m[1]), sub.ops]]);
  }
  return null;
}

const FXMEMO = new Map();
function fxParse(card){
  const key = norm(card.name)+"|"+(card.pitch||0);
  if(FXMEMO.has(key)) return FXMEMO.get(key);
  const tt = (card.tt||"").toLowerCase();
  const kw = (card.kw||[]).map(k=>String(k).toLowerCase());
  const fx = {ga:kw.some(k=>k==="go again"), self:0, ops:[], onHit:[], conds:[], clauses:[], perm:null, dr:/defense reaction/.test(tt), approx:false};
  if(/\bally\b/.test(tt)) fx.perm="ally";
  else if(/\bitem\b/.test(tt)) fx.perm="item";
  else if(/\baura\b/.test(tt)) fx.perm="aura";
  else if(/\btrap\b/.test(tt)) fx.perm="trap";
  /* Split on the printed line breaks FIRST: the database puts keyword
     lines in their own paragraph, and clean() collapses newlines, so
     splitting after it would glue "Stealth" onto the rules text. */
  let clauses = (card.tx||"").split(/\n+/).map(seg=>clean(seg)).filter(Boolean)
    .reduce((acc,seg)=>acc.concat(seg.split(/\.\s+/)),[]).map(s=>s.trim()).filter(Boolean);
  /* FaB text names the card instead of saying "this": "Sigil of Suffering
     gains +1{d}", "Bare Fangs gains +2{p}". Rewrite the card's own name to
     "this" so every self-reference rule below sees the form it expects.
     This is normalization, not a per-card special case — it is driven by
     card.name, so it works for cards the parser has never seen. */
  if(card.name){
    const esc = String(card.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const selfRe = new RegExp("\\b"+esc+"(?:'s)?\\b", "gi");
    clauses = clauses.map(s => s.replace(selfRe, mm => /'s$/i.test(mm) ? "this's" : "this"));
  }
  clauses.forEach(raw=>{
    const r = classifyClause(raw);
    if(!r){ fx.clauses.push({t:raw,st:"skip"}); return; }
    fx.clauses.push({t:raw, st:r.status});
    if(r.approx) fx.approx = true;
    r.ops.forEach(op=>{
      if(op[0]==="ga" && !r.cond && !r.onHit){ fx.ga=true; return; }
      if(op[0]==="self" && !r.cond && !r.onHit){ fx.self+=op[1]; return; }
      if(r.onHit) fx.onHit.push(op);
      else if(r.cond) fx.conds.push({cond:r.cond, op});
      else fx.ops.push(op);
    });
  });
  const tl = clean(card.tx||"").toLowerCase();
  const am = tl.match(/as an additional cost to play(?: this)?,? (you may )?discard (a|an|one|two|\d+) cards?/);
  if(am && !am[1]) fx.addCost = {discard: num(am[2])};
  /* the blocker limit itself, hoisted so the declare step can read it */
  const dl = tl.match(/can only defend an attack with (\d+) or less base \{p\}/);
  if(dl) fx.defLimit = +dl[1];
  /* RULING 2026-07-25 — "Play this only if …" is a gate on being played at
     all, not an effect. Hoist it so the play path can refuse and say why.
     Bear Hug reads the pitch zone; Run Roughshod reads the graveyard for a
     6+ power card stamped with this turn. */
  if(/play this only if you'?(?:ve| have) pitched a card with (\d+) or more \{p\} this turn/.test(tl))
    fx.playIf = {kind:"pitch6", why:"you haven't pitched a card with 6 or more power this turn"};
  else if(/play this only if you'?(?:ve| have) discarded a card with (\d+) or more \{p\} this turn/.test(tl))
    fx.playIf = {kind:"discard6", why:"nothing with 6 or more power has hit your graveyard this turn"};
  else if(/play this only if a yellow card has been put into your soul this turn/.test(tl))
    fx.playIf = {kind:"soulYellow", why:"no yellow card has gone into your soul this turn"};
  /* "When this is discarded at random, put it on the bottom of its owner's
     deck" — a discard redirect the auto-discard path has to honour. */
  if(/when this is discarded at random, put it on the bottom of its owner'?s? deck/.test(tl))
    fx.bottomOnDiscard = true;
  /* RULING (Out Pace): hoisted so the declare step can refuse equipment */
  if(/can'?t be defended by equipment/.test(tl)) fx.noEquipDefend = true;
  /* activation gates, hoisted the same way play gates are */
  let ag;
  if(ag = tl.match(/activate this(?: ability)? only if you'?(?:ve| have) attacked with a ([a-z' -]+) this turn/))
    fx.activateIf = {kind:"atkNamed", name:ag[1].trim(), why:`you haven't attacked with a ${ag[1].trim()} this turn`};
  else if(ag = tl.match(/activate this(?: ability)? only if you'?(?:ve| have) hit (\d+) or more times this combat chain/))
    fx.activateIf = {kind:"hits", n:+ag[1], why:`you haven't hit ${ag[1]} or more times on this chain`};
  else if(tl.match(/activate this(?: ability)? only if you have boosted this turn/))
    fx.activateIf = {kind:"boosted", why:"you haven't boosted this turn"};
  else if(ag = tl.match(/activate this(?: ability)? only if you control a card with (\d+) or more \{p\}/))
    fx.activateIf = {kind:"controlPow", n:+ag[1], why:`you control nothing with ${ag[1]} or more power`};
  else if(tl.match(/activate this(?: ability)? only while this card is defending/))
    fx.activateIf = {kind:"defending", why:"this card isn't defending"};
  else if(tl.match(/activate this ability only during an opponent'?s? turn/))
    fx.activateIf = {kind:"foeTurn", why:"it's your turn, not the dummy's"};
  else if(tl.match(/activate this only if you'?(?:ve| have) played a ([a-z' -]+) this turn/))
    fx.activateIf = {kind:"playedNamed", name:(tl.match(/played a ([a-z' -]+) this turn/)||[])[1], why:"you haven't played the required card this turn"};
  if(/play(?:ed)?(?:[^.]{0,30})? from (?:your |the )?graveyard/.test(tl)) fx.fromGY = true;
  if(/play(?:ed)?(?:[^.]{0,30})? from (?:your |the )?banish/.test(tl)) fx.fromBan = true;
  if(!fx.self && !isAttack(card)){
    const pm = tl.match(/(?:gains?|gets?)\s*\+(\d+)\s*\{p\}/);
    if(pm) fx.self = +pm[1];
    else if(/\+\s*1\s*\/\s*2\s*\/\s*3\s*\{p\}/.test(tl)) fx.self = card.pitch||0;
  }
  const runs = fx.clauses.filter(x=>x.st!=="skip").length;
  fx.tier = fx.clauses.length===0 ? "full" : runs===fx.clauses.length ? "full" : runs>0 ? "part" : "none";
  fx.playable = fx.ops.length>0 || fx.onHit.length>0 || fx.conds.length>0 || !!fx.perm || fx.ga;
  FXMEMO.set(key,fx);
  return fx;
}
function parseHeroPower(tx, allowDestroy){
  const t = clean(tx);
  const m = t.match(/(once per turn )?(action|instant)\s*[-—]*\s*([^:]{0,40}?):\s*([^.]+)/i);
  if(!m) return null;
  const costStr = (m[3]||"").trim();
  const sd = allowDestroy && /\bdestroy\b/i.test(costStr);
  if(!sd && /(discard|banish|remove|destroy|sacrifice|put |reveal|soul|life|\{h\})/i.test(costStr)) return null;
  if(sd && /(discard|banish|remove|sacrifice|put |reveal|soul|life|\{h\})/i.test(costStr)) return null;
  const dm = costStr.match(/(\d+)/);
  const rsym = (costStr.match(/\{r\}/gi)||[]).length;
  const cost = dm ? +dm[1] : rsym;
  const eff = classifyClause(m[4]);
  if(!eff || eff.status!=="run" || eff.cond || eff.onHit) return null;
  const after = t.slice(m.index + m[0].length);
  const ga = /^\.?\s*go again/i.test(after);
  return {cost, ga, sd:!!sd, kind:m[2].toLowerCase(), eff:m[4].trim(),
    label:(sd?"destroy: ":(m[1]?"once/turn: ":""))+m[4].trim()+(cost?" ["+cost+"r]":"")+(ga?" · go again":"")};
}
/* "costs {r} less to play for each Runechant you control" — the printed form
   is the resource PIP, not a digit, so the old digit-or-word pattern never
   matched and the discount silently never applied. */
function runeRed(c){ const m=clean(c.tx||"").toLowerCase().match(/costs? (?:\{r\}|\{?(\d+)\}?|a|an|one) less(?: to play)? for each runechant/); return m?(m[1]?+m[1]:1):0; }
/* RULING 2026-07-25 (Dash): "If you control a Hyper Driver, this costs {r}
   less to play" — a discount conditional on a permanent being on your board.
   Read by name off the card's own text, so it works for any such card, not
   just Hyper Driver. */
/* COST READERS TAKE A SIDE, NOT THE GAME (v2.18). Runechants and the board
   that discount a card belong to whoever is PLAYING it, so these are handed
   `sd` — one side — rather than the whole state. Call them with you(s) or
   opp(s). Passing the game would silently read side 0 for both players, and
   boardRed had already drifted that way once before the drills caught it. */
function boardRed(c,sd){
  const m = clean(c.tx||"").toLowerCase().match(/if you control (?:a|an) ([a-z' -]+), this costs \{r\} less to play/);
  if(!m || !sd || !sd.board) return 0;
  const want = norm(m[1]);
  return sd.board.some(b => norm(((b && b.card && b.card.name) || "")) === want) ? 1 : 0;
}
function effCost(c,sd){ return Math.max(0,(c.cost||0)-runeRed(c)*((sd&&sd.rune)||0)-boardRed(c,sd)); }
function weaponCost(tx){
  const t = clean(tx||"");
  const m = t.match(/(?:once per turn )?action\s*[-—]*\s*([^:]{0,90}?):\s*attack\b/i);
  if(!m) return null;
  const cs = (m[1]||"").trim();
  const dm = cs.match(/(\d+)\s*(?:resource|\{r\})/i) || cs.match(/(\d+)/);
  const rs = (cs.match(/\{r\}/gi)||[]).length;
  return {cost: dm ? +dm[1] : rs, addRust:/rust counter/i.test(cs), needSteam:/remove a steam counter/i.test(cs)};
}
const hasKw = (c,k) => (c.kw||[]).some(x=>String(x).toLowerCase().includes(k)) || new RegExp("\\b"+k+"\\b","i").test(c.tx||"");
const isAR = c => /attack reaction/i.test(c.tt||"");
const isInstantT = c => /\binstant\b/i.test(c.tt||"") && !/reaction/i.test(c.tt||"");

/* test hook — fxParse memoizes on name|pitch; drills must clear between fixtures */
const fxReset = () => FXMEMO.clear();

return {norm, isAttack, isArrow, isWeapon, hasGA, arcaneDmg, num, clean,
        classifyClause, fxParse, fxReset, parseHeroPower, runeRed, boardRed, effCost,
        weaponCost, hasKw, isAR, isInstantT};
});
