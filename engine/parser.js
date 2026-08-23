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
/* Markdown emphasis, both spellings. Upstream prints keyword lines bold,
   and one record in the pool ("Washed Up Wave") carries a stray empty
   emphasis run — `**Blade Break** __` — which left the clause reading
   "blade break __" and stopped the keyword line being recognised at all. */
const clean = t => (t||"").replace(/\*\*?/g,"").replace(/__?/g,"").replace(/\s+/g," ").trim();
/* FaB counts occurrences in words ("the SECOND time this hits each turn"),
   so a clause that names WHICH occurrence it fires on needs these. Kept at
   module scope rather than rebuilt inside classifyClause, which recurses. */
const ORDINAL = {first:1, second:2, third:3, fourth:4, fifth:5};

/* ---- ONE IDIOM, TWO SPELLINGS (v3.00) --------------------------------

   The card database is somebody else's `develop` branch, and between
   v2.84 and v3.00 it ran an editorial pass over 138 of this pool's 405
   cards: contractions expanded, "it" resolved to "this", "or greater"
   levelled to "or more". 22 cards stopped being read. Nothing invented a
   new rule — the same effect is simply spelled differently.

   BOTH SPELLINGS MUST BE READ, AND NOT ONLY FOR TIDINESS. `DATA_VER`
   keys a localStorage cache, so a player who opened the game last week
   is still holding the OLD text while a player opening it today gets the
   new. The two populations coexist until every cache turns over, and a
   parser that reads only one of them breaks somebody's game either way.

   Every entry here is a SYNONYM of one printed idiom, never a change of
   meaning — that is the line, and it is why `has` is levelled only where
   it governs a pump ("this has +1{p}") and never on its own, where it is
   a real question ("if this has 3 or more rust counters"). Widening an
   anchor is the alternative and it is the right move when the two
   wordings are not synonyms; see Brand with Cinderclaw, which grew a
   TRIGGER, and is fixed at its anchor rather than here. */
const SYNONYMS = [
  /* contractions — upstream expanded them, the anchors read the long form */
  [/\byou've\b/g,          "you have"],
  [/\bthey've\b/g,         "they have"],
  [/\byou'd\b/g,           "you would"],
  /* self-reference. `fxParse` already rewrites a card's own NAME to
     "this"/"this's" before we get here, so these two land on that form. */
  [/\bthis card's\b/g,     "this's"],
  [/\bthis card\b/g,       "this"],
  /* comparatives and hyphenation */
  [/\bor greater\b/g,      "or more"],
  [/\bface-up\b/g,         "face up"],
  [/\b(\d+)-sided die\b/g, "$1 sided die"],
  /* "gains"/"has" governing a pump or a keyword grant — CLAUDE.md has
     said since v2.12 that FaB prints all three of gains/gets/has, and most
     anchors already spell the alternation out. These level the ones that
     do not, and they are anchored to what FOLLOWS so a bare "has" is
     untouched. */
  [/\b(?:gains|has)(?=\s*\+\d+\s*\{[pdhi]\})/g, "gets"],
  [/\b(?:gains|has) go again\b/g,               "gets go again"]
];
const levelIdiom = c => SYNONYMS.reduce((s, [re, to]) => s.replace(re, to), c);

function classifyClause(raw){
  /* modal options print with a leading dash ("- Target dagger attack gets +3{p}") */
  const c = levelIdiom(clean(raw).toLowerCase().replace(/\.$/,"").replace(/^-\s*/,""));
  if(!c) return null;
  const R = (ops,extra) => Object.assign({status:"run",ops},extra||{});
  const NOOP = why => ({status:"noop",ops:[["noop",why]]});
  /* A NAMED-KEYWORD GATE IS STILL A GATE, and "instead" still REPLACES
     inside one. The generic if/when/while handler below marks a conditional
     payload containing "instead" so `execute` suppresses the unconditional
     base op of the same kind — that is v2.32's Emeritus Scolding fix. The
     keyword-gated handlers (Reprise, High Tide, Surge) are the same shape
     wearing a keyword's name and each hand-rolled its own two lines, so not
     one of them read it. Overpower prints "Target weapon attack gains
     +4{p}. Reprise - ... INSTEAD it gains +6{p}" and the replacement parsed
     as an ADDITION: +10 where the card prints +6.
     One helper, so a fourth keyword gate cannot reintroduce the gap. */
  const GATED = (payload, cond) => {
    const sub = classifyClause(payload);
    if(!sub || sub.status!=="run") return null;
    if(/\binstead\b/i.test(payload)) sub.instead = true;
    return Object.assign(sub, {cond});
  };
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
  /* THE SAME BONUS-ARCANE POOL, PRINTED AS TWO SENTENCES (Stir the
     Aetherwinds). Upstream split "…as though it were an instant AND if it
     has an effect that deals arcane damage, instead…" into two, which is
     how anyone noticed that the single-sentence form was matched by an
     UNANCHORED rule further down and quietly swallowed the instant-speed
     grant with it. This reads the bonus half, which is the half the engine
     models; the grant itself is genuinely unbuilt and is left UNREAD
     rather than nooped — a noop counts as accounted for, and the card
     would go back to claiming it works.

     It belongs up here with the other whole-clause patterns: the if/when
     handler below splits on the first comma and would take the condition
     off, leaving a payload that means nothing on its own. */
  if(m=c.match(/^if it has an arcane damage effect, instead it deals that much arcane damage plus (\d+)$/))
    return R([["amp",+m[1]]]);
  if(/^when this is discarded at random, put it on the bottom of (?:its owner'?s?|your) deck$/.test(c))
    return NOOP("discard redirect — honoured by the discard path, not on resolution");
  if(/^when you win a clash revealing this, deal \d+ damage to the other hero$/.test(c))
    return NOOP("reveal payoff — fires if this is the card revealed on a winning clash");
  if(/^when (?:it|this) has none, destroy it$/.test(c))
    return NOOP("counter tick — destruction handled with the tick that empties it");
  /* VERSE COUNTERS (Malefic Incantation): this exact rider is the OTHER
     half of the verse-counter unwind read directly off the board in
     execute() — see the matching NOOP for its "remove a verse counter"
     clause further down. Read as a whole-clause match, before the generic
     if/when splitter, because "if you do" alone is shared by every
     optional-cost rider in the pool; matching just the cond string would
     silently claim clauses this exact wording was never written for. */
  if(/^if you do, create a runechant token$/.test(c))
    return NOOP("live — same verse-counter unwind; the runechant is minted when the counter empties");
  /* COLD SNAP / FREEZE IS UNREAD ON PURPOSE (v3.02), and it used to be a
     `noop` for reasons that stopped being true in v2.71.

     The old notes said "the dummy pays no costs, so target hero may pay
     always resolves to declining" and "Freeze taxes a play/activation the
     dummy's scripted swing never makes". Seat 1 has paid costs and taken a
     real action phase since v2.71, so both were facts about a training
     prop that no longer exists — and a `noop` COUNTS AS ACCOUNTED FOR, so
     Cold Snap reported `tier: full` while doing nothing at all. That is
     the no-op blind spot on Iyslander's signature card, and it is exactly
     what v2.74 removed for Frostbite ("a fact about the old training prop
     and not about the rules"). This is the last card that carried it.

     UNREAD, NOT APPROXIMATED. The ruling is recorded and precise —

       "this gives the opponent a pop up that allows them to pay 1
        resource to avoid the negative effect of the card. if they don't
        pay the player gets a pop up and they can choose the arsenal or an
        ally - whatever they choose cannot be played or activated until
        the start of your next turn."

     — and every piece of it is a real question. `payOr` already asks the
     opponent to pay (Winter's Bite uses it), but emitting it here with an
     unbuilt else-payload would ASK A QUESTION WITH NO CONSEQUENCE, which
     makes paying strictly a waste and is worse than not asking. So both
     clauses fall through and the card reports `part`, which is the truth.

     WHAT IT NEEDS, and none of it is machinery that has to be invented:
       1. `payOr` with the freeze as its `elseOps` — the offer exists
       2. a `pick` that REPORTS the chosen object structurally (today it
          reports only in `msgs`) over a candidate list spanning the
          opponent's arsenal AND their allies — two zones, so the
          candidates are the caller's, the way `target` already works
       3. a `_frozen` stamp honoured by `playableFromZone` and by the
          activation gate, on BOTH boards
       4. a thaw at "the start of your next turn" — beside
          `effects.tickSuspense`, which is that schedule */
  /* RULING (Saltwater Swell): "reveal the top card of your deck" and "if
     it's blue, pitch it" are two SEPARATE printed clauses, but reading them
     apart breaks on an ATTACK card — the generic conds loop that would
     check "it's blue" runs BEFORE the reveal happens at declaration (see
     the "Declaration-time ops" comment in execute()), so it would always
     see last card's stale reveal, or none. One atomic op — read here as a
     single unit, same rule that keeps other if/when patterns off the
     generic splitter — checks the SAME n.revealed the reveal op just set,
     in the same declOps pass. */
  if(m=c.match(/^if it'?s (red|yellow|blue), pitch it$/))
    return R([["revColorPitch", {red:1,yellow:2,blue:3}[m[1]]]]);
  if(/^if you win, this gets \+\d+\s*\{d\}(?: until end of turn)?$/.test(c))
    return NOOP("clash payoff — the defence step applies this when you win");
  /* RULING (Reaping Blade): a static lock — the hero ahead on life can't gain
     any. The life op checks it before healing. */
  if(/^if a hero has more \{h\} than (?:any|each) other hero, they can'?t gain \{h\}$/.test(c))
    return R([["lifeLock",1]]);
  /* RULING (Pyroglyphic Protection): prevents arcane PER SOURCE while it is in
     play — ten runechants popping are ten sources, so ten prevented. Distinct
     from ward/awd, which is a single pool that drains. */
  if(m=c.match(/^if (?:your hero|you) would be dealt arcane damage, prevent (\d+) (?:arcane damage that source would deal|of that damage)$/))
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
  if(/^if you have discarded a card with \d+ or more \{p\} this turn, this'?s attacks? (?:get )?go again$/.test(c))
    return NOOP("weapon rider — read from the graveyard stamp when the weapon swings");
  /* ---- THE "+1{p} COUNTER" FAMILY ------------------------------------
     Eight pool cards move +1{p} counters around, and the Dawnblade is the
     one that EARNS them:

       "The second time this hits each turn, put a +1{p} counter on it."
       "At the beginning of your end phase, if this hasn't hit this turn,
        remove all +1{p} counters from it."

     RULING (user, 2026-08-09): the counters PERSIST and accumulate across
     turns. The removal clause only makes sense under that reading — it is
     there precisely to punish a turn where the blade never connected. So
     the blade grows while you keep hitting with it and resets to printed
     the first turn you do not.

     Both clauses are SCHEDULES, not on-play effects, so fxParse hoists
     them out of `fx.ops`: left there, `runOps` would hand over the counter
     the moment the weapon was activated, before it had hit anything.

     The ordinal is read off the text rather than assumed to be "second" —
     the clause names its own number, and picking it here would be
     inventing card text. Two swings is also exactly what Dorinthea's
     ability allows in a turn, which is why the blade rewards its second
     hit and not its third; that is the card's design, not a coincidence
     to hardcode. */
  if(m=c.match(/^the (first|second|third|fourth|fifth) time this hits each turn, put an? \+(\d+)\s*\{p\} counter on it$/))
    return R([["hitCounter", ORDINAL[m[1]], +m[2]]]);
  if(/^at the beginning of your end phase, if this hasn'?t hit this turn, remove all \+\d+\s*\{p\} counters from it$/.test(c))
    return R([["wipePowIfIdle"]]);
  if(m=c.match(/^(?:if|when|while) ([^,:]+)[,:] ?(.+)$/)){
    const cond=m[1], rest=classifyClause(m[2]);
    if(!rest) return null;
    /* A noop inner is already accounted for elsewhere (a keyword the engine
       carries, a cost the reader applies). It does nothing either way, so pass
       it through rather than throwing the whole clause away —
       "When this attacks, intimidate." was failing for exactly this reason. */
    if(rest.status!=="run") return rest;
    /* "INSTEAD" REPLACES, it does not add. Emeritus Scolding reads "Deal 2
       arcane damage. If played during an opponent's turn, INSTEAD deal 4" —
       parsed as an addition that is 2 + 4 = 6 when the card prints 4. Flag
       it here; execute suppresses the base op when the condition fires. */
    if(/\binstead\b/i.test(m[2])) rest.instead = true;
    /* ARSENAL FACE-UP. Azalea's arrows fire when put FACE UP into the
       arsenal, which is NOT the end-of-turn arsenal step (that sets face
       DOWN). Three printed phrasings, one trigger:
         "this is put face-up into your arsenal"
         "this is put into your arsenal face up"     (Ridge Rider Shot)
         "this is put or turned face up in arsenal"  (Spire Sniping) */
    if(/\b(?:put|turned)\b/.test(cond) && /\barsenal\b/.test(cond) && /face.?up/.test(cond))
      return Object.assign(rest,{arsUp:true});
    /* "this hits A MARKED HERO" is a COMPOUND gate — on-hit AND the target
       being marked — and it must be caught before the generic /hits?/
       catch-all just below, or the marked half is silently lost and the
       payload (Mark of the Black Widow's forced banish) would fire on
       every hit regardless of marking. Same family of bug as the fusion
       compound gate: checking one half first drops the other. */
    /* "WHEN THIS LEAVES THE ARENA, …" IS A DEPARTURE TRIGGER, and until
       v3.00 the trainer had no arena-departure schedule, so the payload
       was queued on PLAY — Act of Glory handed you its +6{p} the moment
       the aura landed instead of when it left. That is the whole drawback
       of Suspense inverted into a bonus: you are meant to WAIT.

       Tagged rather than run, exactly like `onHit`, so the site that
       destroys the permanent fires it. */
    /* "ENTERS **OR** LEAVES" IS TWO OCCASIONS, NOT ONE (v3.07). The test
       above is for "leaves", and it matched the compound wording first —
       so the whole payload was filed as a departure and the ENTRY was
       thrown away. Two pool cards print it, and on Booze! that was the
       card's only effect: with nothing consuming `onLeave` either, the
       crowd booed ZERO times for a card whose printed job is to boo
       twice. For Lyath that is a Might token per boo, which is his whole
       engine.

       Flagged on both, and `fxParse` pushes the op into `fx.ops` and
       `fx.onLeave` alike — one printed trigger, two occasions it fires
       on, not one value read by two rules (which is v2.30's bug and the
       opposite mistake). */
    if(/\bleaves the arena\b/.test(cond))
      return Object.assign(rest, /\benters?\b/.test(cond) ? {onLeave:true, onEnter:true} : {onLeave:true});
    if(/^this hits a marked hero$/.test(cond)) return Object.assign(rest,{cond:"marked", onHit:true});
    if(/\bhits?\b/.test(cond)) return Object.assign(rest,{onHit:true});
    if(/another attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"atk"});
    if(/another non-attack action card this turn/.test(cond)) return Object.assign(rest,{cond:"non"});
    if(/6 or more \{p\}[^.]*pitch zone/.test(cond)) return Object.assign(rest,{cond:"pitch6"});
    if(/defended by fewer than 2 non-equipment/.test(cond)) return Object.assign(rest,{cond:"defLt2"});
    /* "DISCARDED THIS WAY" IS NOT "DISCARDED THIS TURN". Bare Fangs reads
       "draw a card then discard a random card. If a card with 6 or more
       {p} is discarded THIS WAY, ..." — it asks about the discard the card
       itself just made, not about the turn. Collapsing both to one
       condition let any earlier discard satisfy it, and because an attack
       reaches the graveyard at DECLARATION it could even be satisfied by
       the attacking card itself. Savage Feast says "as that cost", which
       is the same scoping in different words. */
    /* Savage Feast says it a third way — "was discarded AS AN ADDITIONAL
       COST TO PLAY IT" — which is the same scoping as "this way": the
       discard this card itself just made, not the turn's history. */
    if(/6 or more \{p\}[^.]*discard/.test(cond) && /this way|that cost|as an additional cost/.test(cond))
      return Object.assign(rest,{cond:"discard6way"});
    if(/6 or more \{p\}[^.]*discard/.test(cond)) return Object.assign(rest,{cond:"discard6"});
    if(/^you attack with /.test(cond)) return rest;
    /* Arena triggers: the trainer has no leaves/enters-the-arena schedule,
       so the payload fires when the card is played — early, but the value
       is real. Flagged approx so the honest ledger keeps counting it. */
    if(/^this (?:leaves|enters|enters or leaves) the arena/.test(cond)) return Object.assign(rest,{approx:true});
    /* "When this is played, …" is just on-resolution, which is when every
       effect already fires — pass the inner clause (and its own condition)
       straight through.

       "If you do, …" used to be listed here as deliberately unread. As of
       v2.28 it IS read, but not by this function: an optional cost and its
       rider are two separate clauses, so they are paired in fxParse where
       the whole card is visible, and gated behind a `pick` prompt whose
       rider only fires when the cost was actually paid. Running it free
       is still the v2.04 bug; the difference is the prompt now exists. */
    if(/^(?:this is played|you play this|this attacks(?: a hero)?)$/.test(cond)) return rest;
    /* "When this defends, …" — the block step is a real trigger point */
    if(/^this defends(?: an attack)?$/.test(cond)) return rest;
    /* THE FOUR TRAPS (v3.08) — "when this defends AN ATTACK WITH …".

       Arakni's Den of the Spider, Lair of the Spider, Frailty Trap and
       Inertia Trap are a 2x2: two conditions over two payloads, and all
       four read `none` — the whole card, unparsed, because the qualifier
       on the attack fell past the anchored rule above.

       THE SUBJECT IS THE INCOMING ATTACK, NOT THIS CARD, and that is why
       neither reuses `pumped`. `pumped` asks whether MY attack was pumped
       above its own base and is resolved in `linkPumps` once the total is
       struck; these ask about the attack I am DEFENDING against, from the
       other seat, at the moment the trap resolves. Same words, opposite
       side of the chain — exactly the same-name-different-meaning trap
       `KNOWN_COLLISIONS` polices one layer up. */
    if(/^this defends an attack with go again$/.test(cond))
      return Object.assign(rest,{cond:"defGA"});
    if(/^this defends an attack with \{p\} greater than its base$/.test(cond))
      return Object.assign(rest,{cond:"defPumped"});
    /* "attacks or defends" — the defend half has no trigger point yet */
    if(/^this attacks or defends$/.test(cond)) return Object.assign(rest,{approx:true});
    /* RULING (Emeritus Scolding): a card played at instant speed during the
       opponent's turn gets the bigger effect — Iyslander's whole game. */
    if(/(?:is|was) played during an opponent'?s? turn/.test(cond)) return Object.assign(rest,{cond:"foeTurn"});
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
    /* "an aura of suspense" — the board qualifier the bare Suspense keyword
       tags (see the NOOP above); reads the board the same way "seismic"
       reads it for its own named token. */
    if(/^you control an aura of suspense$/.test(cond)) return Object.assign(rest,{cond:"suspenseAura"});
    /* `or greater` is levelled to `or more` by SYNONYMS — one canonical
       comparative, so an anchor spells it once. */
    if(m=cond.match(/^there is a card with cost (\d+) or more in your pitch zone$/))
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
    /* CHARGE (Boltyn) — "As an additional cost to play this, you may
       charge your hero's soul." is a real additional cost (hoisted into
       fx.chargeCost below), and these are the riders that ask about it:
       a turn-scoped boolean ("if you've charged this turn") and a
       card-property check on the SPECIFIC card charged as this card's own
       cost ("if a yellow card is/was charged this way"). Blue is pitch 3,
       yellow is pitch 2, red is pitch 1 throughout this engine. */
    if(/you'?(?:ve| have) charged this turn/.test(cond)) return Object.assign(rest,{cond:"charged"});
    if(m=cond.match(/^an? (red|yellow|blue) card (?:is|was) charged this way$/))
      return Object.assign(rest,{cond:"chargedPitch"+({red:1,yellow:2,blue:3}[m[1]])});
    /* FUSION — CR: paying the additional cost (revealing a matching card
       from hand) makes the played card "fused". Some cards gate their
       rider on fusion ALONE ("if it was fused, …"); others gate on fusion
       AND the attack actually connecting ("…was fused and deals damage to
       a hero, …") — a compound condition read as one unit, same as the
       Aether-Icevein shape, so it must be caught before the generic
       comma-split below would otherwise misparse the "and". Both route
       through condOnHit when combined with a hit. */
    if(/^(?:this|it) was fused and deals damage to a hero$/.test(cond))
      return Object.assign(rest,{cond:"fused", onHit:true});
    if(/^(?:this|it) was fused$/.test(cond)) return Object.assign(rest,{cond:"fused"});
    return null;
  }
  /* "This/it gains '<ability text>'" — grants an entirely new ability
     rather than modifying the card's own stats (Bolt of Courage: "gains
     'If this hits, draw a card.'"; Engulfing Light: "gains 'If this hits,
     put it into your hero's soul.'"). Read the quoted text with the SAME
     reader rather than inventing a second vocabulary for granted text —
     an on-hit grant recurses back through the onHit branch above via the
     inner clause's own "when this hits" wrapper. */
  /* GAINS **AND GETS AND HAS** (v3.10). CLAUDE.md has said since v2.12
     that FaB prints all three and every anchor must accept all three;
     this one spelled only `gains`, and the cards print `gets`.

     A missing alternation here does not merely drop the grant — it
     RELOCATES IT. The quoted text fell past this anchor into the loose
     payload matchers below, which found "draw a card" inside it and
     returned that op with NO `onHit`. So Bolt of Courage drew a card on
     PLAY rather than on hit, Hot on Their Heels marked on play, and
     Display Loyalty made a Fealty token on play. A trigger stripped of
     its trigger is strictly stronger than printed, and all three cards
     reported tier `full` throughout.

     Same shape as Stir the Aetherwinds at v3.00: an unanchored match
     consuming a sentence and modelling half of it. */
  if(m=c.match(/^(?:this|it) (?:gains?|gets|has) ["“'](.+)["”']$/)){
    const inner = classifyClause(m[1]);
    return (inner && inner.status==="run") ? inner : null;
  }
  if(/^go again$/.test(c)) return R([["ga"]]);
  /* RELOAD — CR: "you may put a card from your hand face-down into your
     arsenal, only if your arsenal is empty." No type filter (unlike the
     arrow-only, face-UP arsenalPut shape above) — verified against the CR
     text rather than the type-restricted wording the arsenalPut cards
     print. */
  if(/^reload$/.test(c)) return R([["reload"]]);
  /* ANCHORED at both ends. Unanchored, this matched the TAIL of a gated
     sentence that the if/when handler never saw because it does not START
     with if/when — "Surge - If this deals more than 2 damage, it gets go
     again" and "High Tide - If there are 2 or more blue cards in your pitch
     zone, this gets go again" both granted go again outright. */
  if(/^(?:this|it) (?:gains?|gets?|has) go again(?: this turn)?$/.test(c)) return R([["ga"]]);
  /* Printed keyword lines. The database prints these on their own line.
     The engine honors them through card_keywords — equipment wear, the
     boost prompt, the crush threshold — or they are honestly inert
     against a hand-less dummy. Pending and unreviewed keywords are
     deliberately absent: they must keep surfacing as coverage gaps. */
  if(/^(?:boost|battleworn|temper|guardwell|blade break|crush)$/.test(c)) return NOOP("printed keyword — carried by the engine's keyword system");
  /* HEAVE N (v3.32). This line is a `noop` for the same reason as the ones
     above and for NO OTHER: the keyword is carried, by `heaveOf` /
     `heaveOffer` / `heave`, and both boards offer it at the arsenal step.

     FILING IT HERE BEFORE IT WAS BUILT WOULD HAVE BEEN THE NO-OP BLIND
     SPOT EXACTLY — a keyword with real rules meaning filed as accounted
     for, which every coverage tool then counts as read. `tools/ledger.js`
     is what keeps this honest: heave is `live` there, so `failstates.js`
     grades it against the claim rather than against a grep of the source. */
  if(/^heave \d+$/.test(c)) return NOOP("printed keyword — the arsenal-step offer, carried by heaveOffer/heave");
  /* ARCANE BARRIER / SPELLVOID are LIVE as of v2.74 — read off
     `card_keywords` by `arcaneBarrier`/`spellvoid` and offered by
     `arcaneSoaks` at the one place a hero takes arcane damage. The old
     reason on this line, "the dummy throws only fists", was a fact about
     the training prop; seat 1 plays Ice Bolt now. They stay `noop` HERE
     because the printed keyword line carries no payload of its own — the
     rule hangs off the damage event, not off the clause — which is the
     same bookkeeping "watery grave" above uses to credit a hero ability
     for a different card's keyword. */
  if(/^(?:arcane barrier|spellvoid)(?: \d+| x)?$/.test(c)) return NOOP("live — paid at the moment arcane damage is dealt (arcaneSoaks)");
  /* INERTIA IS LIVE (v2.75), and the reason this line used to give was
     wrong about the MECHANIC, not just about the prop. It never taxed an
     action phase: the printed token is "At the beginning of your end
     phase, destroy Inertia, then put all cards from your hand and arsenal
     on the bottom of your deck" — a hand wipe, resolved by
     `DawnEffects.resolveInertia` at the beginning of its controller's end
     phase. `noop` here because the printed keyword line carries no payload
     of its own, the same bookkeeping "arcane barrier" above uses. */
  if(/^inertia$/.test(c)) return NOOP("live — a hand wipe at the beginning of its controller's end phase (resolveInertia)");
  if(/^watery grave$/.test(c)) return NOOP("live — Gravy Bones' ability enables it once a blue card has hit your graveyard");
  /* VERSE COUNTERS (Malefic Incantation): the unwind-into-a-Runechant is
     read directly off the board in execute() at declaration (it scans
     every board permanent's own text for this exact shape on every attack
     played), not through this per-clause reader — so this clause is
     genuinely handled, just not by this function. Marking it noop here is
     what lets the coverage audit see that, the same way "watery grave"
     above credits Gravy Bones' ability for a different card's keyword.
     Its "if you do, create a Runechant token" rider is caught separately,
     up in the whole-clause patterns — it has to be, since a bare "if you
     do" cond string is shared by every optional-cost rider in the pool and
     would over-match if read as a generic condition here. */
  if(/^once per turn, when you play an attack action card, remove a verse counter from this$/.test(c))
    return NOOP("live — the verse-counter unwind is read directly off the board at declaration (execute()'s verse scan)");
  /* Ephemeral, per its own printed reminder text: if it would be put into a
     graveyard from anywhere, instead it ceases to exist. Enforced in gy(). */
  if(/^ephemeral$/.test(c)) return NOOP("live — it ceases to exist instead of reaching a graveyard");
  /* Reprise is live from v2.09: the dummy blocks from hand, so "has defended
     with a card from their hand this chain link" is a real count of the
     non-equipment defenders currently declared. */
  if(/^reprise$/.test(c)) return NOOP("qualifier — the payload clause below carries the condition");
  if(m=c.match(/^reprise\s*[-—]\s*if the defending hero has defended with a card from their hand this chain link, (.+)$/))
    return GATED(m[1], "reprise");
  /* HIGH TIDE — named-keyword-gated, same shape as Reprise above:
     "High Tide - If there are 2 or more blue cards in your pitch zone,
     this gets go again." (Swiftwater Sloop). Blue is pitch value 3
     throughout this engine (see the "colour is pitch" comment in
     execute()); the printed threshold rides in the cond name so a future
     High Tide card with a different number is read correctly rather than
     assumed to be 2. */
  if(m=c.match(/^high tide\s*[-—]\s*if there are (\d+) or more blue cards in your pitch zone,\s*(.+)$/i))
    return GATED(m[2], "pitchBlue"+m[1]);
  /* SURGE — "Surge - If this deals more than N damage, it gets go again"
     (Aether Quickening). N is always this card's OWN printed arcane base
     — the clause is comparing the card to itself — and Amp (parser's own
     "amp" op) is the only mechanic in this pool that can push a non-attack
     arcane effect above its printed value, so "will this deal more than
     its base" reduces exactly to "is there a live Amp bonus queued right
     now". Evaluated before the arcane op runs and consumes it. */
  if(m=c.match(/^surge\s*[-—]\s*if this deals more than (\d+) damage,\s*(.+)$/i))
    return GATED(m[2], "surgeOver"+m[1]);
  if(/^legendary$/.test(c)) return NOOP("deckbuilding marker — one copy per deck");
  /* COLD SNAP's cost-offer half is UNREAD with the freeze it gates — see
     the long note above. Reading the offer alone would ask the opponent
     to pay for nothing. */
  /* FUSION — the bare "X Fusion" line is the additional cost itself
     (hoisted into fx.fusionCost above, same layout rule as a standalone
     "Go again" line); the riders that ask "if this was fused" are read
     below via cond "fused". */
  if(/^[a-z]+(?:(?:, ?| and\/or | and )[a-z]+)* fusion$/.test(c)) return NOOP("additional cost — enforced when played (Fusion)");
  /* RULING 2026-07-25: stealth, mark and aim counters "do nothing on their
     own" — they are qualifiers other cards test for. So the bare keyword
     line is genuinely a no-op; what matters is the state it leaves behind,
     which the mark/aim effect clauses below actually set. */
  if(/^(?:stealth|cloaked)$/.test(c)) return NOOP("qualifier only — other cards check an attack for it");
  /* SUSPENSE — same shape as stealth/mark: a bare qualifier tag on certain
     Guardian auras ("Aura of Suspense") that another card (Full of
     Bravado) checks for generically via cond "suspenseAura" below. Does
     nothing on its own. */
  if(/^suspense$/.test(c)) return NOOP("qualifier only — tags this as an aura of Suspense for cards that check the board");
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
  /* THE NOTE WAS STALE, NOT THE CARD (v3.06). It read "the payload reaches
     for a hand, arsenal or turn the dummy hasn't got" — a fact about a
     training prop that stopped existing in v2.71, and it reaches AUDIT.md.
     Crush IS built: `linkPayload` forces a card from the defending hero's
     hand onto their deck when a crush attack deals 4 or more. What is
     approximate is WHICH card — the last in hand rather than their choice
     — and that is worth saying instead. */
  /* THE CRUSH NOOP DESCRIBED ONE CARD AND CLAIMED TWELVE (v3.16).

     This was anchored to the crush PREFIX only — "Crush - When this deals
     N or more damage to a hero" — and returned a noop whose text asserts
     a specific payload: *"the keyword system forces a card from their hand
     onto their deck."* That is true of Boulder Drop and of nothing else.

     Eleven other pool cards across two heroes print a completely different
     rider behind the same prefix — a -1{d} counter on equipment, a tax on
     their next action, an arsenal card to the bottom, a discard, a halving
     of their attack actions — and every one of them reported `tier: full`
     while doing nothing at all, because a `noop` counts as ACCOUNTED FOR.

     That is the blind spot CLAUDE.md names in as many words: "where a
     ruling says a keyword does nothing on its own, `noop` is right; where
     it describes real behaviour, `noop` is a mis-filing." This one
     described real behaviour — someone else's.

     Anchored to the payload it actually names. Every other crush rider now
     falls through to be read on its own terms, or to be refused honestly. */
  if(m=c.match(/^crush\s*[-—]\s*when this deals (\d+) or more damage to a hero, (.+?)\.?$/)){
    /* THE PAYLOAD IS THE CARD'S OWN, read with the ordinary reader. An
       unreadable one REFUSES the whole clause rather than claiming it —
       the five "during their next turn" riders need a schedule that does
       not exist, and a noop would hide them again. */
    const sub = classifyClause(m[2]);
    if(!sub || sub.status !== "run" || !sub.ops.length) return null;
    return R([["crushRider", +m[1], sub.ops]]);
  }
  /* ---- the crush payloads, each read on its own terms (v3.16) --------
     None of these existed: one noop stood in for all twelve. */
  /* ---- CRUSH RIDERS THAT REACH INTO THEIR NEXT TURN (v3.29) ---------
     Five pool names print one, and all five refused until now because no
     schedule existed to fire on — the honest refusal v3.16 recorded.
     `nextTurn` on the side is that schedule, and these two are the ones
     whose payload maps onto a reader that already exists:

       Debilitate       a power debuff, like `atkMinus` but deferred
       Cartilage Crush  a cost tax, like frostbite's but one-shot

     BOTH ARE "FIRST X", not "every X". A blanket debuff for the whole
     turn is strictly stronger than printed.

     THE OTHER THREE STILL REFUSE, and each for its own reason rather
     than a shared shrug: Chokeslam and Crush the Weak are RESTRICTIONS
     ("can't gain {p}", "can't play") that belong in `legal` and in every
     pump path, and Walk in My Shoes halves base {p} and {d} across a
     whole turn. Claiming them here would file a card `full` that does
     nothing, which is the tier lie this project keeps finding. */
  if(m=c.match(/^their first attack during their next turn gets -(\d+)\{p\}$/))
    return R([["foeNextTurn", "firstAtkMinus", +m[1]]]);
  if(/^their first action during their next turn costs an additional \{r\} to play or activate$/.test(c))
    return R([["foeNextTurn", "firstActionTax", 1]]);
  /* CHOKESLAM — a RESTRICTION rather than a debuff, and it lasts the whole
     phase rather than one attack: "attack action cards they control CAN'T
     GAIN {p} during their next action phase". So the entry is never spent;
     it expires with the turn like the rest.

     It caps rather than subtracts: something that made the attack WEAKER
     (frailty, Debilitate) must not be undone by a rule that only forbids
     gaining. */
  if(/^attack action cards they control can'?t gain \{p\} during their next action phase$/.test(c))
    return R([["foeNextTurn", "noPump", 0]]);
  /* CRUSH THE WEAK — a play RESTRICTION, and the threshold is printed.
     "3 or less base {p}" is read off the clause rather than hardcoded:
     the card names its own number, and a literal here is inventing card
     text one level up. Like Chokeslam it lasts the whole phase. */
  if(m=c.match(/^they can'?t play attack action cards with (\d+) or less base \{p\} during their next action phase$/))
    return R([["foeNextTurn", "noSmallAtk", +m[1]]]);

  if(/^they put a card from their hand on top of their deck$/.test(c))
    return R([["foeHandToDeck", 1]]);
  if(m=c.match(/^put a -(\d+)\{d\} counter on (?:target |an )?equipment they control$/))
    return R([["foeGearDef", -(+m[1])]]);
  if(/^destroy a card in their arsenal$/.test(c))
    return R([["foeArsDestroy", 1]]);
  if(/^put a card from their arsenal on the bottom of (?:its owner'?s|their) deck$/.test(c))
    return R([["foeArsBottom", 1]]);
  if(/^put all cards in all arsenals on the bottom of (?:their owner'?s|its owner'?s) decks?$/.test(c))
    return R([["allArsBottom", 1]]);
  if(m=c.match(/^destroy an? ([a-z' -]+?) token they control$/))
    return R([["destroyFoeToken", m[1].trim()]]);
  if(/^as an additional cost/.test(c)) return NOOP("additional cost — enforced when played");
  if(m=c.match(/(?:target )?defending card (?:gains?|gets?) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:^|this |it )(?:gains?|gets?|has) \+(\d+)\s*(?:\{d\}|defense)/)) return R([["defBuff",+m[1]]]);
  if(m=c.match(/(?:target )?attack(?:ing card)? (?:gets?|gains?) -(\d+)\s*(?:\{p\}|power)/)) return R([["atkMinus",+m[1]]]);
  /* "Target <weapon/sword/dagger/…> attack gains +N{p}" — the pump a
     reaction hands the attack it is targeting. playRx folds fx.self into
     the chain link, so self is the faithful op here.

     THE QUALIFIER USED TO BE SWALLOWED BY `[^.]*` — v2.30's arrow-buff-
     on-a-sword bug, in the one op that never got that fix. `buffNext`
     has carried its restriction in `op[2]` since v2.30; `self` had
     nowhere to put one, so ELEVEN pool cards granted their pump to any
     attack at all: Puncture (+3 and piercing to a "sword or dagger")
     landed on a bow, Pummel's +8 for a "club or hammer weapon" landed
     on anything, and Agile Engagement's "Warrior" restricted nothing.
     Sev-2 "an effect reaches illegal targets".

     The capture is LAZY so it takes the words between "target" and
     "attack" and no more. `attackQual` is the same reader buffNext uses,
     so "sword or dagger" is an OR of two groups and "Pirate ally" is one
     group of two words. */
  if(m=c.match(/^target ([^.]*?)\battack\b([^.]*?) (?:gets?|gains?|has) \+(\d+)\s*(?:\{p\}|power)/)){
    /* AND ITS GRANTED ABILITY RIDES ALONG (v3.12) — the same `quotedOnHit`
       the next-attack pump and the self-grant already share. Scar Tissue
       and Spike with Bloodrot print "…and \"When this hits a hero, mark
       them.\"", and the rider belongs to the ATTACK being pumped, not to
       the reaction: a reaction never hits anything itself. `attackRx`
       stamps it onto the open link. */
    /* THE TAIL IS PART OF THE TARGET (v3.31) — `[^.]*` used to eat it, so
       "with cost 1 or less" restricted nothing. An unreadable tail refuses
       the whole clause rather than pumping an illegal target. */
    const q1 = attackQual(m[1], m[2]);
    if(q1 === false) return null;
    const rider = quotedOnHit(c);
    return rider ? R([["self", +m[3], q1]], {riderOnHit: rider})
                 : R([["self", +m[3], q1]]);
  }
  /* the go-again twin of the target-attack pump, restriction and all */
  if(m=c.match(/^target ([^.]*?)\battack\b([^.]*?) (?:gets?|gains?) go again$/)){
    const q2 = attackQual(m[1], m[2]);
    if(q2 === false) return null;
    return R([["ga", 1, q2]]);
  }
  /* "they lose N{h}" is damage to the opposing hero */
  if(m=c.match(/^(?:they|the defending hero|target hero) loses? (\d+)\s*\{h\}$/)) return R([["dmg",+m[1]]]);
  /* BLOODROT POX PRINTS AN ESCAPE HATCH (v3.09) — "…then it deals 2 damage
     to you unless you pay {r}{r}{r}". The `rot` counter this replaced
     offered no payment and never expired, so it was a permanent
     unavoidable tick where the card is a ONE-SHOT the controller can buy
     out of. Both halves of that were stronger than printed.

     `selfPayOr` rather than `payOr`: the payer is the token's CONTROLLER,
     which is the acting seat when `sweepArena` fires this at their end
     phase — `payOr` is Cold Snap's shape and hardcodes the opponent. Same
     self/foe pairing `selfDiscard` and `foeDiscard` already keep. */
  if(m=c.match(/^it deals (\d+) damage to you unless you pay ((?:\{r\})+|\d+)$/))
    return R([["selfPayOr", rCost(m[2]), [["dmgSelf", +m[1]]]]]);
  /* FRAILTY'S SCOPE IS PRINTED AND IT IS NARROW (v3.09): attack action
     cards played FROM ARSENAL, and WEAPON attacks. An attack action from
     hand is untouched. The `fra` counter this replaced shaved any incoming
     swing at all.

     Filed as a reader-noop for the same reason the cost reductions are:
     the rule is real and it is applied by a NAMED reader (`frailtyCount`,
     inside `execute`'s bonus), not on resolution. */
  if(/^attack action cards you'?(?:ve| have) played from arsenal and your weapon attacks get -1\{p\}$/.test(c))
    return NOOP("frailty's debuff — read off the board by frailtyCount when an attack is declared");
  /* "it gets -N{p}" while defending — the incoming swing is shaved */
  if(m=c.match(/^(?:this|it) gets -(\d+)\s*\{p\}$/)) return R([["atkMinus",+m[1]]]);
  /* "it gets -N{p} unless you pay {cost}" (Look Tuff) — this REDUCES ITS
     OWN power, unlike the atkMinus pattern above which shaves an INCOMING
     attack while blocking. A genuine decision at declaration, before the
     total is struck — read into a single op so execute() can resolve it
     at the same point Charge/Fusion's declare-time reads already live. */
  if(m=c.match(/^(?:this|it) gets -(\d+)\s*\{p\} unless you pay ((?:\{r\})+|\d+)$/)){
    const cost = /^\d+$/.test(m[2]) ? +m[2] : (m[2].match(/\{r\}/g)||[]).length;
    return R([["payOrLose", +m[1], cost]]);
  }
  /* the clash block reads this off the card and applies it to the block */
  /* spellvoid destroys itself to stop arcane; the dummy throws only fists */
  if(/^spellvoid x, where x is the number of chain links you control$/.test(c))
    return NOOP("stops arcane damage — the dummy throws only fists");
  /* RUST IS A CLOCK, AND IT IS THE CARD'S OWN NUMBER (v3.17).
     This was a NOOP reading "the end phase already destroys it at 3
     counters" — a reason that named a payload living in ONE board's end
     phase (index.html's, seat 0's), which is exactly the shape v3.16 found
     under crush. At the table Talishar accrued counters forever and never
     shattered: a weapon that prints its own death swinging on past it.
     `effects.beginEndPhase` fires it now, for either seat, off THIS
     number rather than a literal 3. */
  if(m=c.match(/^at the beginning of your end phase, if this has (\d+) or more rust counters(?: on it)?, destroy it$/))
    return R([["rustDestroy", +m[1]]]);
  /* CONDEMN TO SLAUGHTER'S RIDER (v3.18). "Each opponent destroys an aura
     permanent they control" — THEIR aura, and THEIR choice which one, so
     this is an op that opens a prompt addressed to the other seat rather
     than a destruction performed here. In a two-player game "each
     opponent" is exactly one seat; the count rides in the op so a wider
     table is a change to the op's caller and not to this reader.
     "permanent" is not a second restriction: an aura in the arena IS a
     permanent, and the word is the card distinguishing it from an aura
     sitting in a graveyard. */
  if(m=c.match(/^each opponent destroys an aura(?: permanent)? they control$/))
    return R([["foeDestroyAura",1]]);
  /* the dummy holds a hand now, so revealing it is a real thing to do */
  if(/^target opponent reveals their hand$/.test(c)) return R([["foeReveal",1]]);
  /* a self-imposed cost tax for the rest of the turn */
  if(m=c.match(/^cards cost \{r\} more to play this turn$/)) return R([["costTax",1]]);
  if(/^(dominate|intimidate)$/.test(c)) return NOOP("live since v2.05 — the dummy holds a hand to restrict and to lose cards from");
  /* "…UNLESS THEY REVEAL A CARD FROM THEIR HAND WITH {p} GREATER THAN THE
     DAMAGE DEALT" — the defender's escape hatch, and it did not exist.
     `classifyClause` returned BYTE-IDENTICAL output with and without this
     half of the sentence, so Strongest Survive (three printings, six copies
     in Kayo's deck) discarded unconditionally: stronger than printed, which
     is the direction that steals games. Ordered ABOVE the bare foeDiscard
     so the qualified sentence is claimed by the qualified rule — the same
     hazard as the unanchored draw that swallowed the discard in v2.55. */
  if(/(?:they|the defending hero|target hero|defending hero|opponent) discards? a card unless (?:they|he|she) reveals? a card from (?:their|his|her) hand with \{p\} greater than the damage dealt/.test(c))
    return R([["foeDiscardUnlessReveal",1]]);
  /* "…UNLESS THEY PAY {r}{r}{r}" — the same shape as the reveal hatch
     above, and it was missing for the same reason. `classifyClause` gave
     BYTE-IDENTICAL output with and without this half of the sentence, so
     Winter's Bite made a hero holding NINE resources discard without ever
     being offered the chance to pay: stronger than printed, the direction
     that steals games, reported tier `full`, and invisible to
     `npm run fairness` because the sweep asks whether a card grants its
     controller more than it prints, not whether it dropped the OPPONENT'S
     printed escape.

     Ordered ABOVE the bare foeDiscard so the qualified sentence is claimed
     by the qualified rule — miss that and the loose rule eats it first.

     The payload is written from the ASKED hero's point of view
     (`selfDiscard`, not `foeDiscard`) because `openPrompt` resolves a
     prompt at the actor of the side it is addressed TO. Writing it
     actor-relative to the caster would discard from the caster's own hand,
     which is the seat-hardcoding bug v2.25 fixed wearing a prompt. */
  if(m=c.match(/(?:they|the defending hero|target hero|defending hero|opponent) discards? a card unless (?:they|he|she) pays? ((?:\{r\})+|\d+)/))
    return R([["payOr", rCost(m[1]), [["selfDiscard",1]]]]);
  if(/(?:they|the defending hero|target hero|defending hero|opponent|each opponent) discards?/.test(c)) return R([["foeDiscard",1]]);
  /* mandatory hand-banish — same shape as foeDiscard, banish zone instead */
  if(/(?:they|the defending hero|target hero|defending hero|opponent|each opponent) banish(?:es)? a card from (?:their|his|her) hand/.test(c))
    return R([["foeBanish",1]]);
  if(m=c.match(/^ward (\d+)/)) return R([["ward",+m[1]]]);
  if(m=c.match(/prevent (?:the next )?(\d+) (?:points? of |of )?(arcane )?(?:that )?damage/)) return m[2] ? R([["awd",+m[1]]]) : R([["ward",+m[1]]]);
  /* RULING (Crucible of Aetherweave, Absorb in Aether): "the next card you
     play this turn with an effect that deals arcane damage, instead deals
     that much arcane damage plus N" is the bonus-arcane pool — which the
     engine already has, as amp. Same mechanic, spelled out longhand. */
  if(m=c.match(/(?:next card you play this turn with an (?:effect that deals arcane damage|arcane damage effect), instead deals|(?:effect that deals arcane damage|arcane damage effect), instead (?:that effect|it) deals) that much arcane damage plus (\d+)/))
    return R([["amp",+m[1]]]);
  /* "YOUR NEXT <x> COSTS {r} LESS TO PLAY" (v3.32) — the third qualified
     single-shot grant, beside `buffNext`/`buffQ` and `gaNext`/`gaNextQ`.

     Seismic Surge is the pool's only printing and it is Bravo's keystone:
     four of his cards create the token and a fifth reads it. The clause
     was deliberately UNREAD until now — `selfDestruct … then X` refuses
     when X has no reader, precisely so the schedule could not be filed
     `full` with its payout missing.

     THE SUBJECT GOES THROUGH `attackQual` LIKE ANY OTHER. "your next
     GUARDIAN attack ACTION CARD this turn" is a head, a subject and a
     tail, and v3.31 taught one reader all three — so this rule invents no
     qualifier vocabulary of its own. */
  if(m=c.match(/^(?:your|the) next([^.]*?)\battack\b([^.]*?) costs? ((?:\{r\})+|\d+) less to play$/)){
    const q = attackQual(m[1], m[2]);
    if(q === false) return null;
    const amt = /^\d+$/.test(m[3]) ? +m[3] : (m[3].match(/\{r\}/g)||[]).length;
    return R([["costOff", amt, q]]);
  }

  /* RULING: auras that scrub themselves at the top of your next turn */
  if(/^at the (?:beginning|start) of your (?:action phase|turn), destroy this$/.test(c))
    return R([["selfDestruct","turn"]]);
  if(/^at the beginning of your end phase, destroy this$/.test(c))
    return R([["selfDestruct","end"]]);
  /* "…DESTROY THIS, **THEN** X" — THE SCHEDULE AND ITS PAYOUT (v3.07).

     The two rules above are anchored to the whole clause, so the far more
     common wording — the one every counter-style token prints — fell past
     them into the generic temporal-prefix handler, which stripped "At the
     start of your turn, destroy this, then" and kept only X. Might parsed
     to `[["buffNext",1]]` and Vigor to `[["res",1]]`: the payload with no
     schedule, and the card reporting `full`.

     That is v3.00's Stir the Aetherwinds shape exactly — a loose match
     consuming a sentence and modelling half of it — and it is why the
     trainer grew a SECOND sweep that re-reads the raw printed line to find
     these, while the table had no start-of-turn trigger at all.

     The payload rides AFTER the destroy, in printed order, which is what
     lets one sweep pay a departing card without re-running its on-play
     statics: Pyroglyphic Protection's `arcShield` sits before its
     `selfDestruct` and is therefore not part of the payout.

     IT REFUSES WHEN THE PAYLOAD IS UNREADABLE rather than claiming the
     card for the half it can read — Seismic Surge's cost reduction is not
     read, so Seismic Surge stays unread, exactly as it is today. Emitting
     the destroy alone would report the clause consumed and hide the
     unbuilt half, which is the trap this whole rule exists to undo. */
  if(m=c.match(/^at the (?:beginning|start) of your (action phase|turn|end phase), destroy (?:this|it)(?:, then |,? and )(.+)$/)){
    const rest = classifyClause(m[2]);
    if(!rest || !rest.ops || !rest.ops.length) return null;
    if(rest.ops.some(o=>o[0]==="noop")) return null;
    return R([["selfDestruct", m[1]==="end phase" ? "end" : "turn"], ...rest.ops]);
  }
  /* A KEYWORD GRANTED BY A CLAUSE, e.g. Pulping's "this gets dominate".
     Without this the gated half of `kwGated` has nothing to grant when its
     condition DOES fire, and refusing the unconditional grant would simply
     turn the card off instead of correcting it. "go again" is deliberately
     absent: it has its own `ga` path and two readers of one value is the
     v2.30 double-count. */
  if(m=c.match(/^(?:this|it) (?:gets|gains|has) (dominate|intimidate|overpower|crush|phantasm)$/))
    return R([["gainKw",m[1]]]);
  if(m=c.match(/deals? (\d+) arcane damage/)) return R([["arcane",+m[1]]]);
  /* plain (non-arcane) damage from an effect — "deal 2 damage to any target" */
  if(m=c.match(/deals? (\d+) damage to (?:any target|target hero|them|the other hero|the defending hero)/))
    return R([["dmg",+m[1]]]);
  /* "DRAW A CARD THEN DISCARD A RANDOM CARD" IS TWO OPS, AND ONLY THE
     FIRST WAS READ. The match below is unanchored, so it consumed the
     clause, returned [["draw",1]] and filed it `run` — tier `full`, with
     the cost silently deleted. Five Kayo rows drew for free and never
     paid, and the "if a 6+ card is discarded this way" riders hanging off
     that discard then read an unrelated graveyard instead. Ordered BEFORE
     the plain draw so the compound form is claimed by the compound rule. */
  if(m=c.match(/draws? (a|an|one|two|three|\d+) cards?,? (?:then |and (?:then )?)discards? (a|an|one|two|three|\d+) (?:cards? at )?random(?: cards?)?/))
    return R([["draw",num(m[1])],["discardRandom",num(m[2])]]);
  if(m=c.match(/draws? (a|an|one|two|three|\d+) cards?,? (?:then |and (?:then )?)discards? (a|an|one|two|three|\d+) random cards?/))
    return R([["draw",num(m[1])],["discardRandom",num(m[2])]]);
  if(m=c.match(/^discards? (a|an|one|two|three|\d+) random cards?$/)) return R([["discardRandom",num(m[1])]]);
  if(m=c.match(/draw (a|an|one|two|three|\d+) cards?/)) return R([["draw",num(m[1])]]);
  if(m=c.match(/gains? (\d+)\s*(?:\{r\}|resource)/)) return R([["res",+m[1]]]);
  /* Bare pip costs: "Gain {r}{r}" is two resources — count the symbols. */
  if(m=c.match(/gains? ((?:\{r\})+)/)) return R([["res",m[1].split("{r}").length-1]]);
  if(m=c.match(/gains? (\d+) action points?/)) return R([["ap",+m[1]]]);
  if(m=c.match(/gains? (\d+)\s*(?:\{h\}|life)/)) return R([["life",+m[1]]]);
  /* "Your next ARROW attack this turn gets +3{p}" — the qualifier is not
     decoration. This pattern used to swallow it ([^.+]{0,70}) and emit a
     bare buffNext, so 24 pool cards granted their pump to ANY next attack:
     an arrow buff landed on a sword, a Runeblade buff on a Generic. That is
     the same class as the Mounting Anger filter bug — a printed restriction
     silently dropped, making the card strictly better than printed.
     `attackQual` reads the qualifier off the type line, and null means
     genuinely unqualified. */
  /* A GRANTED ABILITY RIDES ALONGSIDE — ONE READER FOR ALL OF IT (v3.10).

     FaB prints a granted ability in QUOTES, which is what makes it
     readable rather than guessable: the quoted text is a clause in its own
     right, so it goes back through `classifyClause` instead of being
     pattern-matched here. The next-attack rule below has done this since
     v2.30; three other printed shapes did not, and each dropped the rider
     in a different way. This is the one reader they now share. */
  /* A FUNCTION DECLARATION, NOT A `const` — it is called from rules ABOVE
     its own position in this file (the targeted pump at "target … attack
     gets +N{p}"), and a `const` arrow is in the temporal dead zone there.
     Hoisting is the point rather than an accident. */
  function quotedOnHit(txt){
    const g = txt.match(/\band ["\u201c'](.+?)["\u201d']/);
    if(!g) return null;
    const sub = classifyClause(g[1]);
    return (sub && sub.status === "run" && sub.onHit && sub.ops.length) ? sub.ops : null;
  }
  /* "this gets <keyword-or-pump> and \"<granted ability>\"" — the SELF
     grant, four pool cards across two heroes, and the worst-behaved of the
     shapes because the head was lost too:

       Hot on Their Heels / Display Loyalty (Fai)
         "…this gets go again and \"When this hits a hero, mark them.\""
       Goon Beatdown / Goon Tactics (Lyath)
         "…this gets +3{p} and \"When this hits a hero, the crowd boos you.\""

     Unanchored, the Fai pair fell through to the loose `mark them` matcher
     — so GO AGAIN was thrown away and the mark fired on PLAY instead of on
     hit. A trigger stripped of its trigger is stronger than printed, and
     losing the keyword is weaker; the card was wrong in both directions at
     once and reported tier `full`.

     `riderOnHit` is routed by `fxParse`, which is the only place that can
     see whether the clause also carries a condition — a gated rider is
     `condOnHit`, an ungated one is `onHit`. */
  if(m=c.match(/^(?:this|it) (?:gains?|gets|has) (go again|\+\d+\s*\{p\}) and ["\u201c'].+["\u201d']$/)){
    const head = /go again/.test(m[1]) ? ["ga"] : ["self", +m[1].match(/\d+/)[0]];
    const rider = quotedOnHit(c);
    return rider ? R([head], {riderOnHit: rider}) : R([head]);
  }
  if(m=c.match(/(?:your|the) next([^.+]{0,70}?)attack([^+]*)\+(\d+)\s*(?:\{p\}|power)/)){
    /* THE TAIL RESTRICTS TOO (v3.31). Nimblism's "action card with cost 1
       or less", Scout the Periphery's "you play from arsenal" and
       Re-Charge!'s "you boost" all sat inside the old `[^+]*`. */
    const q = attackQual(m[1], m[2]);
    if(q === false) return null;
    /* A GRANTED ABILITY RIDES ALONG WITH THE PUMP, and it was silently
       dropped. Warrior's Valor prints

         Your next weapon attack this turn gets +3{p}
         and "When this hits, it gets go again."

       and the match above stops at the pump, so the whole quoted ability
       — the half that makes the card a Dorinthea staple — was thrown
       away. Six physical cards across her three pitches. Weaker than
       printed, so `npm run fairness` is one-sided against seeing it, and
       the audit counted the clause as consumed either way.

       FaB prints a granted ability in QUOTES, which is what makes this
       readable rather than guessable: the quoted text is a clause in its
       own right, so it goes back through `classifyClause` instead of
       being pattern-matched here. "When this hits, it gets go again"
       already reads as an on-hit `ga`. If the quoted half cannot be read
       the rider is simply absent — the pump still lands, and the audit
       still reports the clause honestly. */
    const ro = quotedOnHit(c);
    const rider = ro ? {onHit: ro} : null;
    const op = ["buffNext", +m[3]];
    if(q || rider) op[2] = q || null;
    if(rider) op[3] = rider;
    return R([op]);
  }
  /* "…gets go again and \"When this hits, create N Runechant tokens.\"" —
     Mauvrion Skies, at all three pitches, and the count is PRINTED: 3 at
     red, 2 at yellow, 1 at blue. The old test was the bare string "create
     a runechant", which matches only the blue copy — so red and yellow
     forged NOTHING and blue forged one by accident. `runeHitNext` was a
     boolean, so it could not have carried 3 even if it had matched.
     Viserai's own card, and runechants are his engine. */
  /* "YOUR NEXT <x> ATTACK … GETS GO AGAIN" — and the subject and the tail
     were BOTH unread until v3.31.

     "NON-ATTACK" CONTAINS "ATTACK". The old test was a bare substring, so
     Mage Master Boots' "the next NON-ATTACK action card you play this turn
     gets go again" handed the grant to the next ATTACK instead. That is the
     Reaction-contains-action trap (v2.44) on the single most valuable
     keyword in the game to get wrong — go again keeps your action point.

     AND THE RESTRICTION WAS DROPPED. Trot Along prints "with 3 or less base
     {p}" and Mauvrion Skies "Runeblade attack ACTION CARD you play"; both
     granted go again to any attack at all, reading `tier: full`. */
  if(m = c.match(/(?:your|the) next([^.]*?)\b(non-attack|attack)\b([^.]*?)\s*(?:gets?|gains?|has)\s*go again/)){
    const q = attackQual(m[1], m[3]);
    if(q === false) return null;
    /* "action card" in the tail belongs to the SUBJECT phrase, so on the
       non-attack reading it must not also set `aac` — a card cannot be an
       attack action card and a non-attack one, and asking for both is a
       qualifier that matches nothing. */
    let full = q;
    if(m[2] === "non-attack"){
      full = Object.assign({}, q || {}); delete full.aac; full.nonAtk = true;
    }
    /* An unqualified grant stays the bare op it has always been. */
    const o=[full ? ["gaNext", full] : ["gaNext"]];
    const rn = c.match(/create (a|an|one|two|three|\d+) runechants?/);
    if(rn) o.push(["runeHitNext", num(rn[1])]);
    return R(o);
  }
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
  /* the hyphen is levelled out by SYNONYMS — upstream prints it both ways */
  if(/^roll a (?:6|six) sided die$/.test(c)) return R([["roll",6]]);
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
  if(/^put (?:it|this) on the bottom of (?:its owner'?s?|your) deck$/.test(c))
    return R([["bottomSelf",1]]);
  /* RULING 2026-07-25: transcend flips the card over — it BECOMES Inner Chi
     (printed on its back) and returns to hand instead of hitting the
     graveyard on resolution. Inner Chi is already a card in the database. */
  if(/^transcend$/.test(c)) return R([["transcend"]]);
  /* "THE ATTACKING HERO" IS THE OPPOSING HERO, from the defender's seat —
     the only seat that can read this line, since every card printing it is
     a Defense Reaction. `mark` already writes to `foe(n)`, so the existing
     op is the right one and this is a wording the reader did not have. */
  if(m=c.match(/\bmark (?:them|the attacking hero|target (?:opposing )?hero)\b/)) return R([["mark",1]]);
  if(m=c.match(/put an aim counter on it/)) return R([["aim",1]]);
  /* the dummy has a real deck now, so banishing off the top is a real cost */
  if(/^banish the top card of their deck$/.test(c)) return R([["foeBanishTop",1]]);
  /* THE SAME MOVE, AIMED AT THE OTHER SEAT (Brain Freeze): "put an action
     card with cost 0 from THEIR hand on top of THEIR deck". The reader is
     `optFilter` again — the subject phrase has to be consumed whole or the
     card stays unclaimed — and the destination is fixed by the text.

     It is a separate op from `pickPrompt` because `prompts.js` reads ONE
     side: the sheet is addressed to the seat that played the card, and the
     cards are in the other seat's hand. Supplying the candidates and doing
     the move in the caller is the pattern v3.03's freeze already
     established, and it is what keeps the prompt module data-driven. */
  if(m=c.match(/^put (.+) from their hand on top of their deck$/)){
    const filter = optFilter(m[1]);
    if(!filter) return null;
    return R([["foePickTop", {filter}]]);
  }
  /* RETRIEVE (Memorial Ground): a MANDATORY target pick from the graveyard
     back onto the deck — reads the subject the same way optFilter already
     does for optional-cost riders, and refuses (returns null, leaving the
     card unclaimed) on anything it cannot read honestly, same discipline.
     min:1 makes the prompts.js `pick` mandatory rather than a decline-able
     optional cost. Written generically (zone/to are data, not hardcoded to
     this one card) so a future "put target X from your Y on top of your
     deck" reuses it rather than growing its own op. */
  if(m=c.match(/^put target (.+) from your graveyard on top of your deck$/)){
    const filter = optFilter(m[1]);
    if(!filter) return null;
    return R([["pickPrompt", {zone:"grave", to:"deckTop", filter, min:1, max:1,
      title:"Put a card from your graveyard on top of your deck"}]]);
  }
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
  if(m=c.match(/^the next ([a-z][a-z' -]*?) you play this turn gets \+(\d+)\s*\{p\}$/))
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
  /* upstream dropped ", in addition to its other card types" and moved the
     trigger to the front; the if/when handler above unwraps "when this
     attacks," and hands the payload here either way. */
  if(/^your next attack this combat chain is draconic(?: in addition to its other card types)?$/.test(c))
    return R([["dracNext",1]]);
  /* "When it has none, destroy it" — the tail of a counter-tick sentence; the
     tick op that precedes it owns the destruction. */
  if(/^destroy it at the beginning of the end phase$/.test(c))
    return R([["selfDestruct","end"]]);
  if(/^damage that would be dealt by this can'?t be prevented$/.test(c))
    return R([["unpreventable",1]]);
  if(/^defense reaction(?: card)?s can'?t be played (?:to )?this(?:'s)? chain link$/.test(c))
    return NOOP("the dummy plays no defence reactions — nothing to deny yet");
  if(/^this enters the arena with (\d+) (?:verse|steam) counters?$/.test(c))
    return R([["enterCounters", +c.match(/(\d+)/)[1]]]);
  if(/^this enters the arena with a steam counter$/.test(c)) return R([["enterCounters",1]]);
  /* FROSTBITE HAS NO NOOP ANY MORE (v2.74). It used to be intercepted here
     with "frostbite — dummy pays no costs", which was a fact about the old
     training prop and not about the rules — and a `noop` counts as
     ACCOUNTED FOR, so Frost Spike reported tier `full` while creating
     nothing at all. The dummy pays costs as of v2.71. It now falls through
     to the generic token rule below like any other token, and the tax it
     applies is read off the board by `frostCount` inside `effCost`. */
  /* BLOODROT AND FRAILTY HAVE NO INTERCEPT ANY MORE (v3.09), and deleting
     the two lines that were here is most of what building them took.

     They were routed to dedicated side counters — `rot` and `fra` — with
     the note that "a generic token would quietly take their place". That
     was true and it was the wrong way round: both print `Generic Token -
     Aura`, both say "under their control", and the generic rule below
     already puts a token on the correct player's board. The counters were
     the thing taking the TOKEN's place, and each was read in exactly one
     spot inside the trainer, so at the table both did nothing at all.

     Same move Runechant made at v2.23 and Frostbite at v2.74, and it buys
     the same three things: they expire on their own printed schedule
     (`sweepArena`, both boards), they are countable by the seven pool
     cards that ask about auras generically, and there is no bespoke state
     to keep in step. `fra` was never once set in a real game — its only
     source, Frailty Trap, read `none` until v3.08.

     RULING (user, 2026-08-19): build both to PRINT. The counters were also
     stronger than printed in both directions — see `frailtyCount` for the
     debuff's real scope, and `selfPayOr` for the escape hatch Bloodrot
     prints and the tick never offered. */
  /* RULING: a token is a card — put one copy on the correct player's board.
     "under their control" sends it to the opponent instead.
     (Runechant is handled above; Frostbite falls through here.) */
  if(m=c.match(/create (a|an|\d+|one|two|three|x) ([a-z][a-z' ,-]*?) tokens?(?: in| under| on|,|\.|$)/)){
    /* AN "X" QUANTITY IS REFUSED, NOT READ AS ONE. Ice Eternal prints
       "Create X Frostbite tokens" for a printed cost of "XX", and nothing
       in this engine models an X cost — so there is no value of X to read.
       Taking the old `m[1]?+m[1]:1` default would have created exactly ONE
       Frostbite for a card that charges the player for X of them: quietly
       WEAKER than printed, the direction `npm run fairness` is deliberately
       one-sided against and coverage reads as `full` because the clause was
       consumed. Refusing leaves it a visible gap until X-costs exist. It is
       the only X card in the pool, so this costs nothing else. */
    if(m[1]==="x") return null;
    const QTY = {a:1, an:1, one:1, two:2, three:3};
    const qty = QTY[m[1]]!=null ? QTY[m[1]] : +m[1];
    /* WHOSE BOARD. Two printed shapes say "the opponent's", and they are
       read separately because they are different sentences:

       1. a CONTROL phrase — "under their control" (Polar Cap), "under
          target hero's control" (Ice Eternal);
       2. a PLACEMENT into an exposed armour zone — "in an exposed head,
          chest, arms, or legs zone" (Frost Spike).

       (2) is a placement onto a HERO'S armour, and RULING (user,
       2026-08-14): a Frostbite is handed to the opponent to slow them
       down. Every other card in the database that prints this phrase says
       so outright — Jarl Vetreiði "in an opponent's exposed …", Summit
       "in their exposed …" — so the bare wording is the odd one out
       rather than a different rule.

       The zone list must be read WHOLE or the clause is refused: an
       ungated token is strictly stronger than a printed one that can
       fizzle, and this placement is the one thing that makes Frost Spike
       WEAKER than an ordinary create. `zone:"exposed"` rides in the op and
       effects.js fizzles it when the target has no exposed armour zone. */
    const exposed = /\bexposed\b/.test(c);
    const ez = c.match(/\bin (?:an?|their|the|target(?: hero'?s?)?|an opponent'?s?) (?:opponent'?s? )?exposed ((?:head|chest|arms|legs)(?:,?\s*(?:or\s+)?(?:head|chest|arms|legs))*) zones?\b/);
    if(exposed && !ez) return null;
    const foe = !!ez || /under (?:their|the attacking hero'?s?|target hero'?s?) control/.test(c);
    /* "Create an Agility and a Vigor token" is TWO tokens sharing one noun —
       split the list, or the name resolves to "agility and a vigor" and the
       card silently creates nothing. */
    const names = m[2].split(/\s*,\s*|\s+and\s+/)
      .map(x=>x.replace(/^(?:a|an|one|two|three)\s+/,"").trim()).filter(Boolean);
    if(!names.length) return null;
    /* The placement is APPENDED only when the card prints one, so the op
       every ordinary token emits keeps the exact four-element shape it has
       always had. A fifth slot carrying `null` on 30-odd cards would churn
       the drills that pin this vocabulary and the wire format, for no card
       that can ever read it. */
    return R(names.map(nm=> ez ? ["token", nm, qty, foe?"foe":"self", {zone:"exposed"}]
                               : ["token", nm, qty, foe?"foe":"self"]));
  }
  if(/inertia/.test(c)) return NOOP("live — see the Inertia token; the wipe resolves in its controller's end phase");
  if(/put (?:it|this card) into your (?:hero'?s? )?soul/.test(c)) return R([["soulSelf"]]);
  if(m=c.match(/banish (a|an|one|two|three|\d+) cards? from your (?:hero'?s? )?soul[:,]? ?(.*)/)){
    const sub = m[2] ? classifyClause(m[2]) : null;
    if(!sub || sub.status!=="run") return null;
    return R([["soulSpend", num(m[1]), sub.ops]]);
  }
  return null;
}

const FXMEMO = new Map();
/* Read the SUBJECT of an optional cost ("an aura", "a yellow card",
   "a Nimblism", "an attack action card with cost 2 or less") into a
   prompts.js filter. Returns null when the phrase cannot be read
   honestly — the caller then leaves the card unclaimed rather than
   guessing, which is the golden rule applied to a cost.

   Reads printed FIELDS only (type line, pitch, cost, name), never rules
   text, exactly as promptFilter does. */
/* Read the qualifier out of "your next <QUALIFIER> attack this turn gets
   +N{p}" into a matcher over the printed TYPE LINE.

   Two shapes, and they mean different things:
     "Brute or Warrior"  -> OR   : either type line matches
     "Pirate ally"       -> AND  : the type line needs BOTH words
   so the result is an OR-list of AND-groups: [["brute"],["warrior"]] vs
   [["pirate","ally"]].

   Returns null when there is no qualifier at all ("your next attack"),
   which is the honest unqualified case and must stay unqualified. */
/* WHAT COMES AFTER THE WORD "ATTACK" IS ALSO A RESTRICTION (v3.31).

   Every reader of this family captured the words BEFORE "attack" and let
   `[^.]*` swallow everything after it, so

     target attack action card WITH COST 1 OR LESS gets +3{p}

   parsed as an unqualified pump and Lightning Press buffed a cost-3
   attack. Thirteen pool cards printed a restriction in the tail and every
   one of them applied to any attack at all — all reading `tier: full`,
   because the clause WAS consumed. v3.00's rule, in the oldest matcher
   here: an unanchored match hides an unbuilt clause.

   THE TAIL IS AN ALL-OR-NOTHING READ. Each atom is stripped in turn and
   whatever is left over means the restriction is not understood — so this
   returns `null` and the CALLER REFUSES THE WHOLE CLAUSE. Treating an
   unreadable restriction as "matches anything" is the direction that
   steals games; refusing is weaker than printed and visible, the same
   call v2.04 made for unpayable costs and v3.12 for an unreadable mode.

   A WINDOW IS NOT A RESTRICTION. "this turn" and "this combat chain" say
   how long a buff waits, never which attack it may land on, so they are
   consumed and dropped rather than refused. */
function attackTail(raw){
  let t = String(raw||"").toLowerCase().replace(/[\u2019]/g, "'")
            .replace(/\s+/g, " ").trim();
  const f = {};
  /* PUNCTUATION IS NOT A RESTRICTION, and upstream moves it: this pool
     prints "…you play this turn gains +3{p}" while the same card has been
     printed with a comma before the verb. A stray comma left in the tail
     would read as unreadable and refuse a card that is perfectly clear —
     v3.00's drift, one layer down. */
  const drop = () => { t = t.replace(/^[,;]\s*/, "").replace(/[,;]\s*$/, "").trim(); };
  drop();
  /* a trailing verb belongs to the sentence, not to the target */
  t = t.replace(/\b(?:gets?|gains?|has)$/, "").trim(); drop();
  t = t.replace(/\bthis (?:turn|combat chain)$/, "").trim(); drop();
  let m;
  /* "attack ACTION CARD" — a weapon attack is not one, which is the whole
     point of the words. `isAtkActionCard` is the one predicate for it. */
  if(/^action cards?\b/.test(t)){ f.aac = true; t = t.replace(/^action cards?\b/, "").trim(); }
  /* RULING 2026-07-25: stealth "does nothing on its own — other cards
     check to see if an attack HAS stealth as a qualifier". This is that
     check, and it asks `printedKw`: seven pool cards CARRY stealth on its
     own line and seven only mention it in a sentence. */
  if(m = t.match(/^with stealth\b/)){ f.kw = "stealth"; t = t.slice(m[0].length).trim(); }
  if(m = t.match(/^with cost (\d+) or (less|more)\b/)){
    f[m[2] === "less" ? "costLe" : "costGe"] = +m[1]; t = t.slice(m[0].length).trim(); }
  if(m = t.match(/^with (\d+) or (less|more) base \{p\}/)){
    f[m[2] === "less" ? "powLe" : "powGe"] = +m[1]; t = t.slice(m[0].length).trim(); }
  /* THESE TWO ARE ABOUT THE PLAY, NOT THE CARD, so `qualMatches` takes
     them from the caller — the same split `defendValue` keeps. A caller
     that does not say answers no, and the buff simply does not apply. */
  if(m = t.match(/^you play from arsenal\b/)){ f.from = "arsenal"; t = t.slice(m[0].length).trim(); }
  else if(m = t.match(/^you play\b/)){ t = t.slice(m[0].length).trim(); }
  if(m = t.match(/^you boost\b/)){ f.boosted = true; t = t.slice(m[0].length).trim(); }
  drop();
  t = t.replace(/\bthis (?:turn|combat chain)$/, "").trim(); drop();
  return t ? null : f;
}

/* THE QUALIFIER IS ONE OBJECT, NEVER TWO SHAPES (v3.31). It used to be a
   bare array of word-groups; the tail atoms above have nowhere to live in
   an array, and an array that sometimes carries extra properties is the
   same-name-different-meaning trap `KNOWN_COLLISIONS` polices. `g` holds
   the word groups, everything else is a printed field.

   Returns `false` — not `null` — when the tail cannot be read, because
   the two answers are opposites: `null` means "nothing restricts this"
   and `false` means "something does and we cannot say what". */
function attackQual(phrase, tail){
  const t = attackTail(tail);
  if(t === null) return false;
  const p = String(phrase||"").toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\b(a|an|the|your|this|turn|other|another)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  const groups = p ? p.split(/\s+or\s+/).map(g => g.split(/\s+/).filter(Boolean)).filter(g => g.length) : [];
  const q = Object.assign({}, t);
  if(groups.length) q.g = groups;
  return Object.keys(q).length ? q : null;
}

/* HOW TO SAY A QUALIFIER OUT LOUD. Five sites formatted it by hand as
   `q.map(g => g.join(" ")).join(" or ")`, which knew the qualifier was an
   array of word groups — a second reader of the shape, and it threw the
   moment the shape gained a field. One namer, beside the one matcher. */
function qualLabel(qual){
  if(!qual) return "an attack";
  const pre = qual.g ? qual.g.map(g => g.join(" ")).join(" or ") + " " : "";
  const post = [];
  if(qual.kw) post.push("with " + qual.kw);
  if(qual.costLe != null) post.push("with cost " + qual.costLe + " or less");
  if(qual.costGe != null) post.push("with cost " + qual.costGe + " or more");
  if(qual.powLe  != null) post.push("with " + qual.powLe + " or less base {p}");
  if(qual.powGe  != null) post.push("with " + qual.powGe + " or more base {p}");
  if(qual.from)    post.push("played from your " + qual.from);
  if(qual.boosted) post.push("you boost");
  const noun = pre + (qual.nonAtk ? "non-attack action card"
                    : qual.aac ? "attack action card" : "attack")
             + (post.length ? " " + post.join(" ") : "");
  return (/^[aeiou]/.test(noun) ? "an " : "a ") + noun;
}

/* Does a card satisfy such a qualifier? Reads printed FIELDS and printed
   KEYWORD LINES — never free rules text — so it stays inside the golden
   rule. `opts` carries what only the play site knows. */
function qualMatches(qual, card, opts){
  if(!qual) return true;                          /* unqualified buffs hit everything */
  /* A BARE ARRAY IS THE OLD SHAPE, AND IT MATCHES NOTHING (v3.31). Every
     field test below passes vacuously on an array, so a stale caller
     would silently get "matches everything" — the exact direction that
     steals games. Refusing is weaker than printed and visible. It does
     not THROW, because `reduce` is fed by JSON off a wire and one bad
     qualifier must cost a buff, never a session. */
  if(Array.isArray(qual)) return false;
  opts = opts || {};
  const c = card || {};
  if(qual.g){
    const tt = String(c.tt || "").toLowerCase();
    if(!qual.g.some(group => group.every(word => tt.indexOf(word) >= 0))) return false;
  }
  if(qual.aac && !isAtkActionCard(c)) return false;
  if(qual.nonAtk && !isNonAtkActionCard(c)) return false;
  if(qual.kw && !printedKw(c, qual.kw)) return false;
  /* A CARD THAT PRINTS NO COST CANNOT SATISFY A PRINTED COST COMPARISON.
     Equipment, Weapons and Blocks carry `cost: null`, and reading that as
     0 would hand every "cost 1 or less" buff to a weapon swing. */
  if(qual.costLe != null && !(c.cost != null && +c.cost <= qual.costLe)) return false;
  if(qual.costGe != null && !(c.cost != null && +c.cost >= qual.costGe)) return false;
  if(qual.powLe != null && !(c.power != null && +c.power <= qual.powLe)) return false;
  if(qual.powGe != null && !(c.power != null && +c.power >= qual.powGe)) return false;
  if(qual.from && opts.from !== qual.from) return false;
  if(qual.boosted && !opts.boosted) return false;
  return true;
}

function optFilter(phrase){
  let rest = String(phrase||"").trim();
  if(!rest) return null;
  /* "ANOTHER aura" EXCLUDES THE CARD ITSELF. That is a STRUCTURAL fact
     rather than a printed field, which is why this refused outright until
     v3.20: a prompts.js filter reads fields and cannot say "not this
     one", and flattening it to "an aura" offers an illegal choice.

     It rides as `notSelf` now — and the uid is deliberately NOT baked in
     here. `fxParse` MEMOIZES ON `name|pitch`, so one parse is shared by
     every copy of the card in the match; a uid stored in it would name
     whichever copy happened to be parsed first and exclude the wrong
     object forever after. The QUEUE SITE supplies the uid as `notUid`,
     and a `notSelf` filter that never receives one refuses every
     candidate rather than offering the source — weaker than printed, and
     therefore the honest direction (v2.04 settled the same question for
     costs).

     The exclusion is load-bearing exactly on Sigil of Silphidae's LEAVE
     trigger: by the time it asks, the Sigil is an aura sitting in the
     very graveyard it is banishing from, so without `another` it eats
     itself. */
  const notSelf = /^another\s+/i.test(rest);
  if(notSelf) rest = rest.replace(/^another\s+/i, "");
  rest = rest.replace(/^(?:a|an|one)\s+/i, "");

  const f = {};
  if(notSelf) f.notSelf = true;
  /* Consume the qualifiers we can actually express, removing each from the
     phrase as we go. */
  const cm = rest.match(/\s*\bwith cost (\d+) or less\b/i);
  if(cm){ f.costLe = +cm[1]; rest = (rest.slice(0, cm.index) + " " + rest.slice(cm.index + cm[0].length)).trim(); }
  /* AN EXACT COST is a different printed qualifier from "or less", and
     Brain Freeze prints one: "an action card with cost 0". Read as
     `costLe` alone it would also offer a cost-1 card if one ever printed
     below it; both bounds are set so the phrase is consumed exactly. */
  else {
    const ce = rest.match(/\s*\bwith cost (\d+)\b/i);
    if(ce){ f.costLe = +ce[1]; f.costGe = +ce[1];
      rest = (rest.slice(0, ce.index) + " " + rest.slice(ce.index + ce[0].length)).trim(); }
  }

  /* THE WHOLE PHRASE MUST BE CONSUMED. What is left has to match one of
     these EXACTLY — not as a substring.

     This is the difference between reading a card and guessing at it.
     Mounting Anger says "an attack action card from your hand with cost
     LESS THAN THE NUMBER OF DRACONIC CHAIN LINKS YOU CONTROL": a loose
     substring test saw "attack action card", returned {type:"attack"} and
     silently dropped the restriction — which would let a player banish any
     attack card at all and make the card strictly better than printed.
     A dynamic limit like that is genuinely unreadable here, so the honest
     answer is null and the card stays unclaimed. */
  const low = rest.toLowerCase();
  if(/^auras?$/.test(low))                { f.tt = "aura";     return f; }
  if(/^attack action cards?$/.test(low))  { f.type = "attack"; return f; }
  /* "AN ACTION CARD" — read off the STRUCTURED type array, never `tt`.
     The display string calls Den of the Spider and Lair of the Spider
     "Action Defense Reaction" and both are in this pool, so a `tt` read
     would offer a defence reaction as an action card. An attack action IS
     an action card, which is why this is a wider filter than the line
     above rather than a rival to it. */
  if(/^action cards?$/.test(low))         { f.ty = "action";   return f; }
  if(/^yellow cards?$/.test(low))         { f.pitch = 2;       return f; }
  if(/^blue cards?$/.test(low))           { f.pitch = 3;       return f; }
  if(/^red cards?$/.test(low))            { f.pitch = 1;       return f; }
  /* A NAMED card — "a Nimblism", "a Phoenix Flame". Only when what remains
     is a bare proper noun, so "a card" never becomes a name filter. */
  if(/^[A-Z][A-Za-z'\-]*(?: [A-Z][A-Za-z'\-]*)*$/.test(rest) && !/^cards?$/i.test(rest)){
    f.name = "^" + rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
    return f;
  }
  return null;
}

/* THE ARSENAL FACE-UP PUT (v2.34). Two shapes that must be read together,
   because the second one's subject is defined by the first: a card that puts
   an arrow face up into the arsenal, and a rider whose "it" is that ARROW.
   Kept as named constants so the clause router and the whole-card reader
   below cannot drift apart on what counts as the stamp. */
const ARS_PUT   = /put an? [a-z ]+?(?: card)? (?:from your hand )?face.?up into your arsenal/i;
const ARS_STAMP = /^\s*it (?:gains?|gets?)\s*\+\d+\s*\{p\}\s*until end of turn/i;
/* ---- CARD OVERRIDES — the guarded escape hatch (v2.39) ----------------
   The golden rule stays the default: teach the parser to read text, never
   special-case a card by name. But some printed abilities genuinely are
   not expressible as a generic clause rule — multi-branch state-dependent
   gates, or cross-references to concepts the clause reader has no
   vocabulary for. For those, and ONLY those, a named entry may hand-write
   the logic here — on two conditions that keep it from becoming the
   silent-drift trap the golden rule exists to prevent:

     1. every entry PINS the exact printed text it was written against
        (`text`, whitespace/markdown-normalized the same way `clean` does);
     2. `applyOverride` re-checks that text against the LIVE card every
        single time it runs, and REFUSES ITSELF — leaving whatever the
        generic reader already produced untouched — the instant the
        database text no longer matches. A card whose wording changes
        underneath a stale override must never keep running the old logic;
        it falls back to `part`/`none` and waits to be re-taught, same as
        any other unclaimed card.

   Keyed by name|pitch, same as FXMEMO. `read(card, fx)` sees the fx object
   the generic reader already built for this card — most overridden cards
   still have some generically-readable parts — and returns a patch to
   merge in, or null/falsy to decline (e.g. a sub-case the override does
   not actually cover). `clausesRun` lets the patch mark specific printed
   clauses (or `true` for all of them) as satisfied, so the coverage tiers
   in AUDIT.md/tools/stack.js stay honest about what is actually running. */
const CARD_OVERRIDES = {
  /* populated as genuinely non-generalizable cards are found — see
     CARD_PROGRESS.md for the running list of what has been routed here
     and why the generic reader could not take it. */
};
function applyOverride(card, fx){
  const key = norm(card.name)+"|"+(card.pitch||0);
  const ov = CARD_OVERRIDES[key];
  if(!ov) return;
  const live = clean(card.tx||"");
  const expect = clean(ov.text||"");
  if(live !== expect){
    fx.overrideRefused = key;
    return;
  }
  const patch = ov.read(card, fx);
  if(!patch) return;
  if(patch.ops && patch.ops.length) fx.ops.push(...patch.ops);
  if(patch.onHit && patch.onHit.length) fx.onHit.push(...patch.onHit);
  if(patch.conds && patch.conds.length) fx.conds.push(...patch.conds);
  if(patch.self) fx.self += patch.self;
  if(patch.ga) fx.ga = true;
  if(patch.perm) fx.perm = patch.perm;
  ["arsenalPut","arsenalUp","addCost","playIf","activateIf","defLimit",
   "noEquipDefend","fromGY","fromBan","optCost","bottomOnDiscard"].forEach(k=>{
    if(patch[k]!==undefined) fx[k]=patch[k];
  });
  if(patch.clausesRun === true) fx.clauses.forEach(c=>{ c.st="run"; });
  else if(Array.isArray(patch.clausesRun)){
    patch.clausesRun.forEach(sub=>{
      fx.clauses.forEach(c=>{ if(c.t.includes(sub)) c.st="run"; });
    });
  }
  fx.overrideApplied = key;
}

function fxParse(card){
  const key = norm(card.name)+"|"+(card.pitch||0);
  if(FXMEMO.has(key)) return FXMEMO.get(key);
  const tt = (card.tt||"").toLowerCase();
  const kw = (card.kw||[]).map(k=>String(k).toLowerCase());
  /* PRINTED go again, not merely MENTIONED go again.

     The database's `card_keywords` is a keyword INDEX: it lists every
     keyword that appears anywhere on the card, including ones the text
     only grants conditionally. Seeding fx.ga straight from it gave 28
     pool cards unconditional go again when their text says otherwise —
     Buckwild ("IF there is a card with 6 or more {p} in your pitch zone,
     this gets go again") went again on an empty pitch zone, and Runerager
     Swarm logged "condition not met" and then went again anyway.

     Go again is the tempo engine of this game, so that is not a small
     mis-read. This is the same family as the Kayo bug — kw and gkw are
     already kept apart; the remaining trap is INSIDE card_keywords.

     The discriminator is the printed layout: the database puts real
     keyword lines in their own paragraph, so a PRINTED go again stands
     alone on a line while a granted one sits inside a sentence. If the
     text never mentions it at all, trust the keyword list. */
  const gaStandalone = (card.tx||"").split(/\n+/).some(l => /^\**go again\**\.?$/i.test(clean(l)));
  const gaMentioned  = /\bgo again\b/i.test(card.tx||"");
  /* FUSION — CR: "[SUPERTYPES] Fusion" means "As an additional cost to play
     this, you may reveal a [SUPERTYPES] card from your hand." No card
     changes zones — it's shown, not spent — so "fused" just means the
     reveal happened. Printed as its own paragraph, same layout rule as a
     standalone "Go again" line. */
  const fusionLine = (card.tx||"").split(/\n+/).map(l=>clean(l))
    .find(l => /^[a-z]+(?:(?:, ?| and\/or | and )[a-z]+)* fusion$/i.test(l));
  const fusionTypes = fusionLine
    ? fusionLine.replace(/\s*fusion$/i,"").split(/,\s*| and\/or | and /i).map(s=>s.trim().toLowerCase()).filter(Boolean)
    : null;
  const fx = {ga: gaStandalone || (!gaMentioned && kw.some(k=>k==="go again")),
    /* `dr` is isDR's answer, not a second copy of the regex: the type
       question is asked in one place so a DFC's front face is read the
       same way here as everywhere else. */
    self:0, ops:[], onHit:[], conds:[], clauses:[], perm:null, dr:isDR(card), approx:false};
  if(fusionTypes) fx.fusionCost = {types:fusionTypes};
  if(/\bally\b/.test(tt)) fx.perm="ally";
  else if(/\bitem\b/.test(tt)) fx.perm="item";
  else if(/\baura\b/.test(tt)) fx.perm="aura";
  /* A TRAP IS A SUBTYPE OF DEFENSE REACTION, NOT A PERMANENT (v3.08).

     `perm` used to be set off a `\btrap\b` match on the printed line, so
     all four of the pool's Traps — Den of the Spider, Lair of the Spider,
     Frailty Trap, Inertia Trap — resolved INTO THE ARENA and stayed there
     for the rest of the game. `types.destination` says `grave` for every
     one of them and has been right the whole time; this is the settled
     ruling (v2.39: where `tt` and `ty` conflict, the structured array
     wins) reaching one layer further down than anyone had looked.

     Nobody noticed because all four read `tier: none` — the card did
     nothing, so no one asked where it went. Building their triggers is
     what made the zone visible.

     CLEARED FOR ANY DEFENCE REACTION rather than by deleting the trap
     branch: the defect is not that "trap" was the wrong word, it is that
     a reaction is not a permanent whatever its subtype says. A future DR
     printing "Aura" would walk into the identical bug. */
  if(fx.dr) fx.perm = null;
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
    /* A subtitled name ("Raydn, Duskbane") is often shortened to its first
       part in the card's OWN text ("Raydn gains +3{p}"), which the full-name
       regex above never sees. Still driven entirely by card.name — not a
       per-card exception — so it works for any future subtitled card. */
    const shortName = String(card.name).split(",")[0].trim();
    if(shortName && shortName !== card.name){
      const escS = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const shortRe = new RegExp("\\b"+escS+"(?:'s)?\\b", "gi");
      clauses = clauses.map(s => s.replace(shortRe, mm => /'s$/i.test(mm) ? "this's" : "this"));
    }
  }
  /* ---- OPTIONAL COST + "If you do, …"  (v2.28) ------------------------
     "When this attacks, you may banish an aura from your graveyard.
      If you do, deal 1 arcane damage to target hero."

     Twenty-four pool cards are shaped like this and NOT ONE was fully
     read: "If you do" was left deliberately unread because it hangs off
     an optional cost, and running the payload for free is the bug v2.04
     fixed. The prompt machinery to ask the question properly now exists
     (engine/prompts.js `pick`, whose rider fires only when cards actually
     moved), so the text can finally be read instead of skipped.

     The two halves arrive as SEPARATE clauses — the splitter breaks on
     the period — so they are paired here, where the whole card is
     visible, rather than in classifyClause which sees one at a time.

     The rider is classified by classifyClause itself, so "deal 1 arcane
     damage" / "draw a card" / "this gets +2{p}" all keep using the one
     reader. Nothing about a card is special-cased by name. */
  const handled = new Set();
  /* ---- COLD SNAP: "may pay, and if they don't, FREEZE" (v3.03) --------

     Two printed sentences, so they arrive as two clauses and are paired
     here where the whole card is visible — the same reason `optCost` and
     `payCost` are paired here rather than in `classifyClause`, which sees
     one at a time.

     RULING 2026-07-25: "this gives the opponent a pop up that allows them
     to pay 1 resource to avoid the negative effect of the card. if they
     don't pay the player gets a pop up and they can choose the arsenal or
     an ally - whatever they choose cannot be played or activated until
     the start of your next turn."

     `payOr` is the offer and already exists (Winter's Bite uses it); the
     freeze is its `elseOps`, which is exactly the shape that rule was
     built for — declining is what makes the consequence happen. Until
     v3.03 both halves were `noop`, so the card reported `tier: full`
     while doing nothing; see the long note at the freeze clause above. */
  for(let i = 0; i < clauses.length - 1; i++){
    /* THE TRAILING PERIOD SURVIVES on the last clause of a paragraph — the
       splitter breaks on ". " and nothing follows the final sentence — so
       these anchors tolerate it. `classifyClause` strips it for its own
       matching; this loop reads the raw clause text. */
    const offer = clauses[i].match(/^target hero may pay ((?:\{r\})+|\d+)\.?$/i);
    if(!offer) continue;
    if(!/^if they don'?t, freeze .+ until the start of your next turn\.?$/i.test(clauses[i+1])) continue;
    fx.ops.push(["payOr", rCost(offer[1]), [["freeze", 1]]]);
    /* `handled` is how a paired reading marks its clauses read — the loop
       below reports them `run` and does not re-classify them. Written as a
       direct edit of `fx.clauses` this found nothing, because that array
       is not built until the loop below runs. */
    handled.add(i); handled.add(i+1);
    break;                                       /* one pay-or-freeze per card in the pool */
  }

  /* ---- A BOARD STATIC THAT BUFFS OTHER CARDS' DEFENCE (v3.23) --------
     "Non-attack action cards you control get +1{d} while defending."

     Briar's Embodiment of Earth, and the only card in the pool that buffs
     ANOTHER card's defence rather than its own. The self-buff family —
     Blade Beckoner's "this gets +1{d} while defending a weapon attack",
     Big Blue Sky, Sigil of Suffering — is a different shape and is
     deliberately NOT read here; each gates on its own condition and
     claiming them together would grant conditions nobody has built.

     THE SUBJECT MUST BE ONE WE CAN EXPRESS, or this refuses. A defence
     buff handed to the wrong cards is a wall that stops more than it
     should, which is the direction that steals games. */
  for(let ci = 0; ci < clauses.length; ci++){
    const dg = clauses[ci].match(
      /^(non-attack action cards) you control get \+(\d+)\{d\} while defending\.?$/i);
    if(!dg) continue;
    fx.defGrant = {amt: +dg[2], subject: "nonAttackAction"};
    handled.add(ci);
    break;
  }

  /* ---- A DEFENDER THAT BUFFS ITSELF AGAINST A KIND OF ATTACK (v3.24)
     "This gets +1{d} while defending a weapon attack." — the four Blade
     Beckoner pieces, and the condition is a property of the INCOMING
     attack rather than of the card, so it can only be answered at the
     wall. `defendValue` takes it from the caller.

     ONLY THIS CONDITION IS READ. The pool prints a whole self-buff family
     on other gates — "for each blue card you've pitched this turn", "if
     you've dealt arcane damage this turn", "if you control a Seismic
     Surge token" — and each needs its own reader. Claiming them together
     would grant conditions nobody has built, which is how a card ends up
     blocking for more than it prints. */
  for(let ci = 0; ci < clauses.length; ci++){
    const cl = clauses[ci];
    let ds = null;
    /* "while defending a WEAPON attack" — Blade Beckoner x4 (v3.24) */
    let m = cl.match(/^this gets \+(\d+)\{d\} while defending a weapon attack\.?$/i);
    if(m) ds = {amt: +m[1], when: "weaponAttack"};
    /* "if you've DEALT ARCANE DAMAGE this turn" — Sigil of Suffering x3.
       The same event `arcDealt` already answers for the attack side of the
       card; here it gates the defence. */
    if(!ds){
      m = cl.match(/^if you.?ve dealt arcane damage this turn, this gets \+(\d+)\{d\}\.?$/i);
      if(m) ds = {amt: +m[1], when: "arcDealt"};
    }
    /* "while this is defending an ATTACK ACTION CARD WITH COST N" — Wax On
       x3. A property of the incoming attack, like the weapon test, so the
       caller supplies the card. The COST IS READ OFF THE CLAUSE rather
       than hardcoded to 0: the card names its own number. */
    if(!ds){
      m = cl.match(/^while this is defending an attack action card with cost (\d+), this gets \+(\d+)\{d\}\.?$/i);
      if(m) ds = {amt: +m[2], when: "atkActionCostLe", cost: +m[1]};
    }
    /* "UNITY - when this defends TOGETHER WITH a card from hand" — the two
       Unity pieces. Wall-time, like the weapon test: it is a fact about
       the rest of the wall, not about the piece. The keyword prefix is
       part of the printed line and is consumed with it. */
    if(!ds){
      m = cl.match(/^unity\s*[-—]\s*when this defends together with a card from hand, this gets \+(\d+)\{d\}(?: until end of turn)?\.?$/i);
      if(m) ds = {amt: +m[1], when: "withHandDefender"};
    }
    /* "IF THIS WAS PLAYED FROM ARSENAL" — Springboard Somersault. The zone
       it came from is the caller's answer, the same as everything else
       here: by the time the wall asks, the card is no longer in it. */
    if(!ds){
      m = cl.match(/^if this was played from arsenal, it gets \+(\d+)\{d\}\.?$/i);
      if(m) ds = {amt: +m[1], when: "fromArsenal"};
    }
    if(!ds) continue;
    fx.defSelf = ds;
    handled.add(ci);
    break;
  }

  /* ---- THE ATTACK-PLAY AURA TRIGGER (v3.22) --------------------------
     "When you play an attack action card[ or activate a weapon attack],
      destroy this and X."

     FOUR POOL TOKENS PRINT THIS and only one of them was built. Runechant
     worked, by name, through `isRunechantEntry` and a hardcoded pop; the
     other three — Courage, Quicken and Briar's Embodiment of Lightning —
     read `tier: none` and did nothing at all. That is the shape rule 4 of
     the method names: fix the RULE, not the card. One reader, one site,
     four tokens, and nothing named.

     THE WEAPON HALF IS PART OF THE TRIGGER, not decoration. Runechant,
     Courage and Quicken all fire on a weapon swing; the Embodiment fires
     ONLY on an attack action card. Dropping that distinction would make
     Briar's token strictly stronger than printed.

     AN UNREADABLE PAYLOAD REFUSES. Malefic Incantation prints the same
     trigger with "remove a verse counter from this" instead of a destroy,
     so it never reaches here — and anything whose payload has no reader
     leaves the card unclaimed rather than firing a guess. */
  for(let ci = 0; ci < clauses.length; ci++){
    const cl = clauses[ci];
    const m = cl.match(
      /^when you play an attack action card( or activate a weapon attack)?, destroy (?:this|it) and (.+)$/i);
    if(!m) continue;
    const tail = m[2].trim().replace(/\.$/, "");
    let ops = null;
    if(/^the attack (?:gains?|gets?|has) go again$/i.test(tail)) ops = [["ga"]];
    else {
      const pm = tail.match(/^the attack (?:gains?|gets?|has) \+(\d+)\{p\}$/i);
      if(pm) ops = [["pump", +pm[1]]];
      else {
        const am = tail.match(/^deal (\d+) arcane damage to target opposing hero$/i);
        if(am) ops = [["arcane", +am[1]]];
      }
    }
    if(!ops) continue;                    /* unreadable payload — do not claim it */
    fx.atkTrigger = {weaponToo: !!m[1], ops};
    /* MARK IT CONSUMED, because it is WIRED. Rule 2 forbids parsing ahead
       of wiring — reading a clause raises the card's tier and makes the
       audit claim it works — and the other side of that rule is that a
       clause which really is built must stop reporting as unread. All
       four of these tokens read `tier: none` while Runechant was the only
       one that did anything. */
    handled.add(ci);
    break;                                /* one such trigger per card in the pool */
  }

  for(let i = 0; i < clauses.length - 1; i++){
    const rider = clauses[i+1];
    if(!/^if you do\b/i.test(rider)) continue;
    const cm = clauses[i].match(
      /^(?:when(?:ever)? (this attacks|this defends|this hits|this enters or leaves the arena|you play an aura),\s*)?you may (banish|discard|destroy) (.+)$/i);
    if(!cm) continue;
    let subject = cm[3].trim();
    let zone = null;
    /* A DESTROY IS PAID OUT OF THE ARENA, AND "YOU CONTROL" IS THE ZONE
       SAYING ITSELF (v3.18). Condemn to Slaughter reads "you may destroy
       an aura you control" — you cannot destroy a card in a graveyard or
       a hand, so the zone is the board, and a board reached through
       `spec.side` is already the asked seat's own.
       This is NOT the subject-consumption rule being relaxed. That rule
       exists because a dropped qualifier makes a cost cheaper than
       printed — Mounting Anger's dynamic limit, "another aura"'s
       exclusion. "You control" is the one phrase a seat-addressed board
       zone genuinely restates, so consuming it adds nothing and drops
       nothing. Anything else in the phrase still has to be read. */
    if(cm[2].toLowerCase() === "destroy"){
      zone = "board";
      subject = subject.replace(/\s+you control$/i, "").trim();
    }
    /* NOT end-anchored: "an attack action card from your hand with cost 2
       or less" puts the zone in the MIDDLE. Anchoring it missed that and
       silently fell back to the wrong zone — banishing from the graveyard
       a card the text says comes from hand. */
    const zm = subject.match(/\s*\bfrom your (graveyard|hand)\b/i);
    if(zm){ zone = zm[1].toLowerCase(); subject = (subject.slice(0, zm.index) + " " + subject.slice(zm.index + zm[0].length)).trim(); }
    const filter = optFilter(subject);
    if(!filter) continue;                       /* unreadable cost — do not claim the card */
    const rr = classifyClause(rider.replace(/^if you do,?\s*/i, ""));
    if(!rr || !rr.ops || !rr.ops.length) continue;   /* unreadable payload — same */
    fx.optCost = {
      /* ONE PRINTED PHRASE NAMING TWO EVENTS. "When this enters or leaves
         the arena" is a single clause and two schedules, so it maps to one
         trigger name that BOTH queue sites answer to — `execute` when the
         aura reaches the arena, `sweepArena` when its own printed clock
         takes it away again. */
      trigger: cm[1] ? cm[1].toLowerCase().replace(/^this /,"")
                            .replace(/^enters or leaves the arena$/,"entersLeaves")
                            .replace(/^you play an aura$/,"playAura") : "play",
      kind: cm[2].toLowerCase(),
      /* the printed zone if it says one; otherwise the natural home of the
         cost — you discard from hand, you banish from the graveyard */
      zone: zone || (cm[2].toLowerCase() === "discard" ? "hand" : "grave"),
      /* where the paid card LANDS. A banish goes to the banished zone; a
         discard and a destroy both reach the graveyard. */
      filter,
      ops: rr.ops
    };
    if(fx.optCost.zone === "graveyard") fx.optCost.zone = "grave";
    handled.add(i); handled.add(i+1);
    break;                                       /* one optional cost per card in the pool */
  }
  /* PAY-COST RIDER (Brothers in Arms): "When this defends, you may pay
     {r}. If you do, it gets +2{d}." Same two-clause pairing as optCost
     just above — paired here where the whole card is visible, never in
     classifyClause, which sees one clause at a time — but the verb is PAY,
     a resource cost, not a card leaving a zone, so it needs its own field
     rather than overloading optCost's zone/filter shape. Generalized on
     `trigger` the same way optCost is, even though "defends" is the only
     one wired today — see execute()/takeIt() for where each trigger is
     actually consumed. */
  for(let i = 0; i < clauses.length - 1; i++){
    if(handled.has(i) || handled.has(i+1)) continue;
    const rider = clauses[i+1];
    if(!/^if you do\b/i.test(rider)) continue;
    const cm = clauses[i].match(/^(?:when(?:ever)? (this attacks|this defends|this hits|you play an aura),\s*)?you may pay ((?:\{r\})+|\d+)$/i);
    if(!cm) continue;
    const rr = classifyClause(rider.replace(/^if you do,?\s*/i, ""));
    if(!rr || !rr.ops || !rr.ops.length) continue;   /* unreadable payload — do not claim the card */
    const cost = /^\d+$/.test(cm[2]) ? +cm[2] : (cm[2].match(/\{r\}/g)||[]).length;
    fx.payCost = {
      trigger: cm[1] ? cm[1].toLowerCase().replace(/^this /,"").replace(/^you play an aura$/,"playAura") : "play",
      cost,
      ops: rr.ops
    };
    handled.add(i); handled.add(i+1);
    break;                                       /* one pay-cost rider per card in the pool */
  }

  /* Does this card print a MODAL choice? Asked once, off the whole text,
     because a single mode line cannot tell you it is one of several. */
  const modal = /\bchoose \d/i.test(clean(card.tx||"").toLowerCase());
  clauses.forEach((raw,ci)=>{
    if(handled.has(ci)){ fx.clauses.push({t:raw, st:"run"}); return; }
    const r = classifyClause(raw);
    if(!r){ fx.clauses.push({t:raw,st:"skip"}); return; }
    fx.clauses.push({t:raw, st:r.status});
    if(r.approx) fx.approx = true;
    /* A GRANTED ABILITY RIDING ALONGSIDE THE CLAUSE'S OWN HEAD (v3.10).
       "this gets go again and \"When this hits a hero, mark them.\"" is two
       effects in one clause: an immediate keyword or pump, and an ability
       granted to the same card. The head goes through the op loop below;
       the rider lands here, because this is the only place that can see
       whether the clause ALSO carried a condition.

       A GATED RIDER IS `condOnHit`, NOT `onHit` — the same distinction the
       loop below already draws for Bolt of Courage. Filing Fai's pair as a
       plain `onHit` would mark the hero on every hit whether or not the
       Draconic chain links were ever there, which is the KEYWORD-UNGATED
       shape `npm run fairness` exists to catch. */
    /* "CHOOSE 1;" IS A CHOICE, AND IT WAS BEING SUMMED (v3.12).

       Pummel and Two Sides to the Blade each print two modes with the SAME
       pump, and the clause loop added both: Pummel gave **+8** where it
       prints +4, Two Sides +6 where it prints +3. Driven on a real board,
       Sledge of Anvilheim went from 6 to **14** instead of 10.

       `npm run fairness` could not see it. Its VALUE-DOUBLED check looks
       for one printed value applied by two PATHS; here the value is
       printed TWICE — once per mode — and both are consumed. A third
       check (`MODAL-SUMMED`) now covers that shape.

       THE BOARD PICKS THE MODE, and no prompt is needed for either card:
       the printed target restrictions are disjoint (a WEAPON attack and an
       ATTACK ACTION CARD cannot be the same object), so exactly one mode
       can ever be legal against what is actually swinging. `attackRx`
       chooses it and refuses when neither matches — which is the same
       "no legal target" refusal a single-mode reaction already gives. */
    if(modal && /^-\s/.test(raw)){
      const pump = (r.ops || []).find(op => op[0] === "self");
      fx.modes = [...(fx.modes || []), {
        label: raw.replace(/^-\s*/, "").replace(/\.$/, ""),
        self: pump ? pump[1] : 0,
        q: pump ? (pump[2] || null) : null,
        riderOnHit: r.riderOnHit || null,
        ops: (r.ops || []).filter(op => op[0] !== "self")
      }];
      return;
    }
    if(r.riderOnHit)
      for(const rop of r.riderOnHit)
        if(r.cond) fx.condOnHit = [...(fx.condOnHit||[]), {cond:r.cond, op:rop}];
        else       fx.onHit.push(rop);
    r.ops.forEach(op=>{
      /* An arsenal-face-up payload is not an on-play effect: it fires when
         the card ENTERS the arsenal, and is stamped onto the card to be
         collected when it is later played. Route it first, or "it gets go
         again this turn" would become the card's own printed go again. */
      if(r.arsUp){ fx.arsenalUp = [...(fx.arsenalUp||[]), op]; return; }
      /* A SCHEDULE, NOT AN ON-PLAY EFFECT. Both of these fire long after
         the activation that reads them — one when the weapon HITS for the
         Nth time this turn, the other at the beginning of an end phase.
         Left in `fx.ops` they would run at declaration, handing over the
         counter before the swing had connected with anything. */
      if(op[0]==="hitCounter"){ fx.hitCounter = {nth:op[1], amt:op[2]}; return; }
      /* A CRUSH RIDER IS A GATED TRIGGER, not an on-play op. Left in
         `fx.ops` it would fire at declaration for every crush card — which
         is how Short Shrift briefly discarded on play while this was being
         built. `linkPayload` reads `fx.crush` once the damage is struck. */
      if(op[0]==="crushRider"){ fx.crush = {n:op[1], ops:op[2]}; return; }
      if(op[0]==="wipePowIfIdle"){ fx.wipePowIfIdle = true; return; }
      /* A SCHEDULE, NOT AN OP. Left in `fx.ops` it would shatter the piece
         the moment it was equipped; `beginEndPhase` reads `fx.rustDestroy`
         at the seat's end phase, which is what the card prints. */
      if(op[0]==="rustDestroy"){ fx.rustDestroy = op[1]; return; }
      if(op[0]==="ga" && !r.cond && !r.onHit){ fx.ga=true; if(op[2]) fx.gaQ = op[2]; return; }
      /* "It gains +1{p} until end of turn" on a card that also puts an arrow
         face up into the arsenal — "it" is the ARROW, not this equipment.
         Folding it into fx.self gave Bull's Eye Bracers the power its arrow
         is printed to get. Held back here and re-read below as
         `arsenalPut.stamp`, which puts it on the card that was actually put. */
      if(op[0]==="self" && ARS_STAMP.test(raw) && ARS_PUT.test(clean(card.tx||""))) return;
      /* THE RESTRICTION RIDES WITH THE CARD, not with the op, because a
         reaction has exactly one target and its qualifier decides whether
         the card may be played at all. Collected from a conditional self
         too — Ironsong Response's whole "target WEAPON attack" clause sits
         inside its reprise gate, and the restriction is printed either
         way. */
      if(op[0]==="self" && op[2] && !fx.selfQ) fx.selfQ = op[2];
      if(op[0]==="self" && !r.cond && !r.onHit){ fx.self+=op[1]; return; }
      /* A CONDITIONALLY GRANTED on-hit ability (Bolt of Courage: "if you've
         charged this turn, gains 'If this hits, draw a card.'") is NOT the
         same thing as a plain on-hit clause. Checking r.onHit first and
         running the op unconditionally — as this dispatcher used to — would
         grant the ability on every hit regardless of the gate, which is
         exactly the VALUE-DOUBLED/KEYWORD-UNGATED shape `npm run fairness`
         exists to catch: a printed condition decorating an op the engine
         also runs for free. condOnHit keeps the gate attached so the trigger
         site (resolveStack) can re-check it before the op fires. */
      if(r.onHit && r.cond){ fx.condOnHit = [...(fx.condOnHit||[]), {cond:r.cond, op}]; return; }
      if(r.onLeave){ fx.onLeave = [...(fx.onLeave||[]), op];
        /* "enters OR leaves" — the entry half is an ordinary on-play op
           for a permanent, which is where every other "when this enters
           the arena" payload already lands. */
        if(r.onEnter) fx.ops.push(op);
        return; }
      if(r.onHit) fx.onHit.push(op);
      else if(r.cond) fx.conds.push({cond:r.cond, op, instead:!!r.instead});
      else fx.ops.push(op);
    });
  });
  applyOverride(card, fx);
  const tl = clean(card.tx||"").toLowerCase();
  /* TWO THINGS MADE THIS MISS SAVAGE FEAST, and both are in one line of
     printed text: "As an additional cost to play SAVAGE FEAST discard a
     RANDOM card."
       1. `(?: this)?` — the card NAMES ITSELF rather than saying "this".
          `chargeCost` on the line below already allows that alternative
          and says why; addCost never got it.
       2. `discard (a|…) cards?` cannot span the word "random".
     Net effect: `fx.addCost` was never set on any Kayo card, so the cost
     was not paid and the rider that asks about it ("if a card with 6 or
     more {p} was discarded as that cost") read an unrelated event. Cost
     skipped, payload collected — the exact shape v2.04 fixed elsewhere.

     `random` is captured, not merely tolerated: a random discard and a
     chosen one are different costs. The engine's auto-discard picks your
     LOWEST-VALUE card, which is strictly better than the card prints. */
  const am = tl.match(/as an additional cost to play(?: this| [a-z',\-! ]{2,30}?)?,? (you may )?discard (a|an|one|two|\d+) (random )?cards?/);
  if(am && !am[1]) fx.addCost = {discard: num(am[2]), random: !!am[3]};
  /* CHARGE — hoisted off the raw text (not the name-rewritten clauses)
     because it may name the card instead of saying "this"; the pattern
     therefore skips either rather than requiring one. */
  const chgm = tl.match(/as an additional cost to play(?: this| [a-z' ]+)?,? you may charge your hero'?s? soul( any number of times)?/);
  if(chgm) fx.chargeCost = {multi: !!chgm[1]};
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
  if(/when this is discarded at random, put it on the bottom of (?:its owner'?s?|your) deck/.test(tl))
    fx.bottomOnDiscard = true;
  /* RULING (Out Pace): hoisted so the declare step can refuse equipment */
  if(/can'?t be defended by equipment/.test(tl)) fx.noEquipDefend = true;
  /* ---- ACTIVATION GATES, hoisted the same way play gates are ---------

     "ACTIVATE THIS" AND "ACTIVATE THIS ABILITY" ARE THE SAME LINE, and
     mixing the two spellings cost four cards. Six patterns wrote the word
     as optional and two did not, so Spellfire Cloak ("Activate this only
     during an opponent's turn") and Achilles Accelerator ("…only if
     you've boosted this turn") had their restriction silently dropped —
     free to activate on any turn, which is strictly stronger than
     printed. `ACT_ONLY` is the one prefix now.

     CONTRACTIONS TOO. `SYNONYMS` levels "you've" to "you have", but it
     runs inside `classifyClause` and these read `tl` directly, so the
     v3.00 rewording reached here untouched. They accept both. */
  let ag;
  const ACT_ONLY = "activate this(?: ability)? only ";
  const A = re => new RegExp(ACT_ONLY + re);
  const YOUVE = "you'?(?:ve| have) ";
  if(ag = tl.match(A("if " + YOUVE + "attacked with a ([a-z' -]+) this turn")))
    fx.activateIf = {kind:"atkNamed", name:ag[1].trim(), why:`you haven't attacked with a ${ag[1].trim()} this turn`};
  else if(ag = tl.match(A("if " + YOUVE + "hit (\\d+) or more times this combat chain")))
    fx.activateIf = {kind:"hits", n:+ag[1], why:`you haven't hit ${ag[1]} or more times on this chain`};
  else if(tl.match(A("if " + YOUVE + "boosted this turn")))
    fx.activateIf = {kind:"boosted", why:"you haven't boosted this turn"};
  else if(ag = tl.match(A("if you control a card with (\\d+) or more \\{p\\}")))
    fx.activateIf = {kind:"controlPow", n:+ag[1], why:`you control nothing with ${ag[1]} or more power`};
  else if(tl.match(A("while this card is defending")))
    fx.activateIf = {kind:"defending", why:"this card isn't defending"};
  else if(tl.match(A("during an opponent'?s? turn")))
    fx.activateIf = {kind:"foeTurn", why:"it's your turn, not your opponent's"};
  else if(ag = tl.match(A("if " + YOUVE + "played a ([a-z' -]+) this turn")))
    fx.activateIf = {kind:"playedNamed", name:ag[1].trim(), why:"you haven't played the required card this turn"};
  /* AN UNREAD RESTRICTION MUST REFUSE, NOT WAVE THROUGH. Two pool cards
     print a condition no pattern above reads — Scorpio, Comet Tail ("only
     if you control a Lightning attack") and Stand Strong ("only if you
     control an aura of suspense"). With `activateIf` left undefined the
     ability was activatable with NO restriction at all, which is the
     sev-3 direction: a card strictly stronger than printed.

     v2.04 settled this shape for costs — an unpayable cost is INERT
     rather than free — and it is the same call. Inert is honest and
     `tools/failstates.js` reports it as "ability inert"; free is a card
     above rate that every coverage tool calls `full`. */
  else if(new RegExp(ACT_ONLY).test(tl))
    fx.activateIf = {kind:"unreadable", why:"its printed activation condition isn't modelled yet"};
  /* THE CARD MUST GRANT ITSELF THE ROUTE, and the subject of that grant is
     "this". Written without it, these matched any card that merely TALKS
     about graveyard plays: Compass of Sunken Depths ("the first card with
     watery grave you play from your graveyard each turn gets go again")
     was the only pool card either flag fired on, and it is Equipment,
     which is never played from anywhere. Under `playableFromZone` that
     false positive is a card replayable out of the graveyard against its
     printed text, so the loose read stopped being harmless the moment
     anything consumed the flag.

     No pool card sets either flag now, and that is the honest answer
     rather than a gap: Gravy Bones grants the graveyard route through his
     HERO ABILITY, and Crouching Tiger's banish route is a `_playTurn`
     stamp at mint time. The flags stay because the shape is real in FaB
     and a future set will print it. */
  if(/\b(?:play|played)\b[^.]{0,20}\bthis\b[^.]{0,30}?\bfrom (?:your |the |its owner'?s )?graveyard/.test(tl)
     || /\bthis\b[^.]{0,30}?\b(?:may|can) be played from (?:your |the )?graveyard/.test(tl)) fx.fromGY = true;
  if(/\b(?:play|played)\b[^.]{0,20}\bthis\b[^.]{0,30}?\bfrom (?:your |the |its owner'?s )?banish/.test(tl)
     || /\bthis\b[^.]{0,30}?\b(?:may|can) be played from (?:your |the )?banish/.test(tl)) fx.fromBan = true;
  /* the enabler half: "you may put an arrow from your hand face-up into
     your arsenal". Read the SUBJECT so a card that says "an arrow" cannot
     put a non-arrow; anything else is left unclaimed.

     THIS MUST BE READ BEFORE THE SELF-PUMP FALLBACK BELOW. Bull's Eye
     Bracers' rider is "It gains +1{p} until end of turn", where "it" is the
     ARROW that was just put — not the equipment. The fallback scans the whole
     text for "gains +N{p}" and was setting fx.self = 1, so the bracers
     themselves gained the power the arrow is printed to get. That is exactly
     the VALUE-DOUBLED/wrong-subject shape `npm run fairness` exists to catch. */
  const apm = tl.match(/you may put an? ([a-z ]+?) (?:card )?from your hand face.?up into your arsenal/)
           || tl.match(/you may put an? ([a-z ]+?) (?:card )?face.?up into your arsenal/);
  if(apm){
    const subj = apm[1].trim();
    if(/^arrows?$/.test(subj)){
      fx.arsenalPut = {filter:{tt:"arrow"}};
      /* TWO DIFFERENT GATES, and they are not the same question. Call in the
         Big Guns just puts, so it needs a FREE SLOT. Bull's Eye Bracers and
         Death Dealer both print "if you have no cards in your arsenal", which
         means ZERO — with a second slot (New Horizon, not in this pool) they
         would need BOTH empty. Ruling, user 2026-07-28. */
      if(/if you have no cards in your arsenal/.test(tl)) fx.arsenalPut.needEmpty = true;
      /* Bull's Eye Bracers: "It gains +1{p} until end of turn." "It" is the
         put card, so this is a second STAMP on the arrow on top of the
         arrow's own arsenal trigger, not an effect on the source. "Until end
         of turn" and "this turn" are the same duration in the CR. */
      const stm = tl.match(/\bit (?:gains?|gets?)\s*\+(\d+)\s*\{p\}\s*until end of turn/);
      if(stm) fx.arsenalPut.stamp = [["self", +stm[1]]];
      /* Death Dealer: "If you do, draw a card." The rider hangs off the put
         ACTUALLY HAPPENING — prompts.js only returns `ops` when cards moved,
         which is the v2.04 rule that keeps a declined optional from paying. */
      const rdm = tl.match(/into your arsenal\.\s*if you do,\s*([^.]+)\./);
      if(rdm){
        const rc = classifyClause(rdm[1]);
        if(rc && rc.status === "run" && rc.ops && rc.ops.length && !rc.cond){
          fx.arsenalPut.ops = rc.ops;
          /* The clause ledger runs BEFORE this reader, so "If you do, draw a
             card" was filed as skip and held Death Dealer at `part`. It is
             genuinely wired — it rides on the prompt as the put's rider — so
             the ledger is corrected here rather than left understating it.
             Only ever flipped when the ops were actually claimed above. */
          const ic = fx.clauses.find(c => c.st === "skip" && /if you do/i.test(c.t));
          if(ic) ic.st = "run";
        }
      }
    }
  }
  /* Fallback self-pump: a non-attack whose "+N{p}" never became an op still
     queues that pump for your next attack.

     IT MUST NOT FIRE WHEN AN OP ALREADY READ THAT SAME "+N{p}".
     This scans the WHOLE text, so "Your next arrow attack this turn GAINS
     +3{p}" matched here as well as in the buffNext rule, and `execute` added
     both — Lace with Frailty granted +6 from a card that prints +3. Every
     "your next X attack gains +N{p}" card was doubled the same way; the
     phrasing "gets" vs "gains" is why some escaped and some did not.

     AND AN OP THAT READ IT CAN BE SITTING IN ANY OF FOUR PLACES, not just
     `fx.ops`. The original guard named one, so a pump the parser had already
     routed to `fx.conds` was read a second time here and granted with no
     condition at all — which is worse than the doubling, because it also
     deletes the gate. Ironsong Response is one printed clause, "Reprise -
     if the defending hero has defended from hand, target weapon attack
     gains +3{p}": the reprise handler read it into `fx.conds`, this
     fallback then read the same words again into `fx.self`, and playRx adds
     the two. It granted +3 with the reprise UNMET (printed: nothing) and +6
     with it met (printed: +3). Seven cards across four heroes were doubled
     this way, every one of them reporting tier `full`.

     The magnitude is matched rather than the mere presence of an op, so a
     card that genuinely prints two different pumps still gets its unread
     one. `fx.self` is 0 here by the guard above, so `fx.ops` can carry no
     `self` op (line ~921 routes those into `fx.self`) — it is scanned
     anyway rather than reasoned about. */
  /* EVERY LIST AN OP CAN LAND IN, or this fires a SECOND copy of a pump
     the card already read. That is v2.30's VALUE-DOUBLED bug, and adding
     `onLeave` in v3.00 reintroduced it for one version's worth of edit:
     Act of Glory's +6{p} moved out of `fx.ops` into the departure
     trigger, this fallback stopped seeing it, and the aura paid +6 on the
     way in as well as on the way out. When a new trigger list is added,
     it belongs here too. */
  const pumpRead = v => [...fx.ops, ...(fx.onHit||[]), ...(fx.onLeave||[]),
                         ...(fx.conds||[]).map(x=>x.op),
                         ...(fx.condOnHit||[]).map(x=>x.op)]
    .some(o => o && (o[0]==="self" || o[0]==="buffNext") && o[1]===v);
  if(!fx.self && !isAttack(card)
     && ![...fx.ops, ...(fx.onLeave||[])].some(o=>o[0]==="buffNext")
     && !(fx.arsenalPut && fx.arsenalPut.stamp)){
    const pm = tl.match(/(?:gains?|gets?)\s*\+(\d+)\s*\{p\}/);
    const v = pm ? +pm[1]
            : /\+\s*1\s*\/\s*2\s*\/\s*3\s*\{p\}/.test(tl) ? (card.pitch||0)
            : null;
    if(v != null && !pumpRead(v)) fx.self = v;
  }
  /* An activated ability on a card in HAND. It deliberately did NOT touch
     `tier` from v2.63 to v3.05 — "the audit keeps reporting Agile Windup
     as unread UNTIL ITS CLAUSE IS PROPERLY CONSUMED", which is the
     never-parse-ahead-of-wiring rule holding the line while only the
     parser could read it.

     IT IS CONSUMED NOW, on both boards: `effects.handAbilityOK` and
     `effects.activateHandAbility` are the shared route, and judge.js
     activates one with `{t:"activate", uid, from:"hand"}`. So the clause
     is marked read, which is what that comment was waiting for.

     THE CLAUSE, NOT THE CARD. Only the ability's own line is credited —
     a card whose OTHER text is still unread stays `part`, and Rally the
     Coast Guard's printed restriction is a separate clause that is read
     on its own account (`fx.activateIf`). */
  fx.handAbility = parseHandAbility(card);
  if(fx.handAbility){
    const HA = /^(?:once per turn )?instant\s*[-—]/i;
    fx.clauses.forEach(cl => { if(cl.st === "skip" && HA.test(cl.t)) cl.st = "run"; });
  }
  const runs = fx.clauses.filter(x=>x.st!=="skip").length;
  fx.tier = fx.clauses.length===0 ? "full" : runs===fx.clauses.length ? "full" : runs>0 ? "part" : "none";
  fx.playable = fx.ops.length>0 || fx.onHit.length>0 || (fx.onLeave||[]).length>0
             || fx.conds.length>0 || !!fx.perm || fx.ga;
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
  /* THE ARSENAL PUT IS THE ONE CONDITIONAL SHAPE THIS READER ACCEPTS (v2.34).
     Bull's Eye Bracers and Death Dealer both print "If you have no cards in
     your arsenal, you may put an arrow card ... into your arsenal", so
     classifyClause hands back a conditional (or nothing) and the guard below
     dropped the whole ability — both were silently INERT.

     It is safe to let exactly this through because the powCard carries the
     ability's whole printed line and `execute` re-reads it with fxParse, which
     DOES read the gate (`arsenalPut.needEmpty`) and the riders. The guard is
     deliberately not loosened any further: a broad relaxation would raise the
     tier of cards nothing wires, which is the "never parse ahead of wiring"
     rule that has cost a real bug before. */
  const arsPut = ARS_PUT.test(m[4]);
  if(!arsPut && (!eff || eff.status!=="run" || eff.cond || eff.onHit)) return null;
  const after = t.slice(m.index + m[0].length);
  const ga = /^\.?\s*go again/i.test(after);
  return {cost, ga, sd:!!sd, kind:m[2].toLowerCase(), eff:m[4].trim(),
    label:(sd?"destroy: ":(m[1]?"once/turn: ":""))+m[4].trim()+(cost?" ["+cost+"r]":"")+(ga?" · go again":"")};
}
/* ---- A CARD IN YOUR HAND WITH AN ACTIVATED ABILITY -------------------
   `parseHeroPower` deliberately REFUSES a discard/banish/sacrifice cost —
   see its comment: letting one through would raise the tier of cards
   nothing wires, which is the "never parse ahead of wiring" rule that has
   already cost a real bug. So this is a separate reader rather than a
   relaxation of that one, and it exists because the trainer now wires it.

   Two pool cards need it, and NEITHER had any route at all: only gear
   (build.js) and arena permanents (`boardPow`) ever got a powCard, so
   "Instant - Discard this: …" on a card in hand was unreachable even
   though the effect itself parses perfectly.

     Agile Windup          "Instant - Discard this: Create an Agility token."
     Rally the Coast Guard "Once per Turn Instant - Discard a card: This
                            gets +3{d}." (+ a separate "Activate this only
                            while this card is defending", already read as
                            fx.activateIf)

   The cost is the DISTINCTION that matters: "discard THIS" spends the card
   itself, "discard A CARD" spends another one and is therefore a choice.
   They are different costs and the caller must be able to tell them apart. */
function parseHandAbility(c){
  const t = clean((c && c.tx) || "");
  const m = t.match(/(once per turn )?instant\s*[-—]*\s*discard (this|a card)\s*:\s*([^.]+)/i);
  if(!m) return null;
  const eff = classifyClause(m[3]);
  /* Same guard as parseHeroPower: an ability whose payload the parser
     cannot read in full would arm a tap that then does nothing. */
  if(!eff || eff.status !== "run" || eff.cond || eff.onHit) return null;
  return {oncePerTurn: !!m[1], cost: /this/i.test(m[2]) ? "self" : "card",
          kind: "instant", eff: m[3].trim(), ops: eff.ops};
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
/* ---- RUNECHANTS ARE AURAS, NOT A COUNTER ----------------------------
   The printed token reads:

     Runechant — "Runeblade Token - Aura"
     "When you play an attack action card or activate a weapon attack,
      destroy this and deal 1 arcane damage to target opposing hero."

   It is an AURA permanent in the arena, and that is load-bearing rather
   than flavour: at least seven pool cards ask about auras generically —
   "if you control 3 or more auras" (Goon Beatdown, Goon Tactics), "you
   may destroy an aura you control" (Condemn to Slaughter), "whenever you
   play an aura" (Magmatic Carapace), "if you've played or created an aura
   this turn" (Runerager Swarm, Shrill of Skullform, Hit the High Notes).

   While a runechant was a bare integer on the side, NONE of those could
   see it: it could not be counted and it could not be destroyed. So the
   board is the single source of truth and the count is derived from it.
   That it also renders real card art instead of the text "Runechant ×2"
   is a consequence, not the goal.

   These live in the parser because it is the module everything else takes
   as its dependency, and because `boardRed` already reads `sd.board`. */
const isRunechant = b => !!(b && b.card && norm(b.card.name) === "runechant");
const runeCount = sd => (sd && sd.board) ? sd.board.filter(isRunechant).length : 0;
/* Any aura this side controls — what "3 or more auras" has to count. */
const isAura = b => !!(b && (b.kind === "aura" || (b.card && /\baura\b/i.test(b.card.tt || ""))));
const auraCount = sd => (sd && sd.board) ? sd.board.filter(isAura).length : 0;

/* ---- FROSTBITE IS AN AURA TOO (v2.74) -------------------------------
   Exactly the same move as the runechant above, and for exactly the same
   reason. The printed token, verbatim:

     Frostbite — "Elemental Token - Aura"
     "Cards and abilities cost you an additional {r} to play or activate.
      At the beginning of your end phase or when you play a card or
      activate an ability, destroy Frostbite."

   Until v2.74 `frost` was a bare integer on the side that NOTHING read:
   `effCost` did not see it, effects.js never mentioned it, and the only
   writer in the project was one hardcoded line in `foeTurnIce`. Frost
   Spike's "create a Frostbite token" resolved to nothing at all. The
   number on the hero row was decoration with no rule behind it.

   Counting off the board is what makes it a real permanent: it can be
   counted by "3 or more auras", it can be destroyed by "destroy an aura",
   and it renders its own art instead of a "❄2" chip — the same three
   consequences the runechant move bought, none of them the goal.

   The count is the TAX, because each token is its own source and each
   prints the same additional {r} (RULING, user 2026-08-14: three
   Frostbites make one play cost +3, and all three are then destroyed by
   that one play). */
/* A printed resource cost, however it is written: "{r}{r}{r}" or a bare
   number. Counting the symbols is the reliable read — the pool prints the
   same cost both ways on different cards, and Winter's Bite prints {r} on
   one printing and {r}{r}{r} on another, so a hardcoded 3 would be wrong
   on the copy the player actually drew. */
const rCost = s => /^\d+$/.test(String(s||"")) ? +s : (String(s||"").match(/\{r\}/g)||[]).length;

const isFrostbite = b => !!(b && b.card && norm(b.card.name) === "frostbite");
const frostCount = sd => (sd && sd.board) ? sd.board.filter(isFrostbite).length : 0;

/* FRAILTY IS A BOARD FACT TOO (v3.09), read the same way frostbite's tax
   is: the token sits on the board of the hero it weakens, so the count is
   derived rather than stored. It replaced a `fra` side counter that only
   the trainer read — and that counter applied a blanket -1 to ANY incoming
   swing, where the token prints a much narrower scope. See `execute`. */
const isFrailty = b => !!(b && b.card && norm(b.card.name) === "frailty");
const frailtyCount = sd => (sd && sd.board) ? sd.board.filter(isFrailty).length : 0;

/* ---- ARCANE BARRIER AND SPELLVOID (v2.74) ---------------------------
   Two keywords, 21 pieces of equipment across ALL FIFTEEN heroes, and
   both were filed `noop` with the reason "stops arcane damage — the dummy
   throws only fists". Another fact about the training prop rather than
   about the rules, and one that expired when seat 1 got real cards.

   THE DATABASE SHIPS NO REMINDER TEXT FOR EITHER, so neither could be
   read off the card. Both come from the user (RULING, 2026-08-14):

     Arcane Barrier N — when a hero is THREATENED with arcane damage, it
       triggers. Its controller is prompted to pay N; if they do, N is
       subtracted from the damage. The payment is the FULL N even when
       that exceeds the damage — Arcane Barrier 2 costs 2 to prevent 1.
       The equipment survives. EVERY instance triggers.

     Spellvoid N — same trigger, but the cost is the PERMANENT: destroy it
       and subtract N. No resources.

   They are read off `card_keywords` because that is where the database
   puts them and where the number lives. The v2.31 lesson does not apply:
   that was about `card_keywords` being a keyword INDEX which can list a
   keyword the text only grants CONDITIONALLY, so seeding an unconditional
   grant from it was wrong. Neither of these is ever conditional on these
   pieces — the one card that gates it (Arcanite Skullcap, "if you have
   less {h} than your opponent") is outside this pool, and it prints the
   grant in its text rather than relying on the index.

   AN "X" AMOUNT IS REFUSED, exactly as Ice Eternal's is. Mask of the
   Swarming Claw prints "Spellvoid X, where X is the number of chain links
   you control" — a dynamic value, and the chain in question belongs to
   whoever is attacking rather than to the frozen hero, so guessing it
   would be inventing a rule. It keeps its printed Arcane Barrier 1 and
   loses only the X, which stays a visible gap. */
const kwAmount = (c, kw) => {
  const list = (c && c.kw) || [];
  for(const raw of list){
    const m = String(raw).trim().match(new RegExp("^" + kw + "\\s*(\\d+|x)?$", "i"));
    if(!m) continue;
    if(!m[1] || String(m[1]).toLowerCase() === "x") return null;  /* dynamic — refused */
    return +m[1];
  }
  return 0;
};
const arcaneBarrier = c => kwAmount(c, "arcane barrier");
const spellvoid     = c => kwAmount(c, "spellvoid");

/* Every piece of iron this side is wearing that could soak an arcane hit,
   with what it would cost. A DESTROYED piece protects nothing — equipment
   wears rather than leaving, so the flag has to be read here the same way
   `exposedZones` reads it. Returned as data so the prompt layer can offer
   them without knowing a single card name. */
function arcaneSoaks(sd){
  const out = [];
  for(const p of ((sd && sd.gear) || [])){
    if(!p || p.destroyed) continue;
    const ab = arcaneBarrier(p);
    if(ab) out.push({uid: p.uid, name: p.name, kind: "barrier", amount: ab, cost: ab});
    const sv = spellvoid(p);
    if(sv) out.push({uid: p.uid, name: p.name, kind: "spellvoid", amount: sv, cost: 0});
  }
  /* A TOTAL ORDER, ties broken on uid. An unordered list is a desync
     waiting for two equal pieces — the same rule sparring.js is held to. */
  return out.sort((a, b) => b.amount - a.amount || String(a.uid).localeCompare(String(b.uid)));
}

/* ---- ARSENAL CAPACITY (v2.34) ---------------------------------------
   Two printed wordings that are NOT the same question, per the user's
   ruling of 2026-07-28:

     "you may put an arrow ... into your arsenal"        -> needs a FREE SLOT
     "IF YOU HAVE NO CARDS IN YOUR ARSENAL, you may ..." -> needs ZERO cards

   With the normal capacity of 1 those coincide, which is exactly why
   hardcoding 1 would hide the difference until New Horizon (a second slot,
   not in this pool) made Death Dealer and Bull's Eye Bracers wrong. The
   storage stays a single card or null — `arsCap` is read off the side with a
   default, so the seam exists without adding a field the migration ledger
   would have to carry. */
const arsCap   = sd => (sd && sd.arsCap) || 1;
const arsCount = sd => (sd && sd.arsenal) ? 1 : 0;
const arsFree  = sd => arsCap(sd) - arsCount(sd);
const arsEmpty = sd => arsCount(sd) === 0;

/* FROSTBITE TAXES "CARDS AND ABILITIES ... TO PLAY OR ACTIVATE", and this
   one function is where both halves of that sentence already meet: the
   trainer charges a weapon swing and an equipment ability through
   `effCost` on their `powCard` exactly as it charges a card from hand, so
   the tax reaches all fourteen call sites without one of them opting in.
   That is the whole reason it goes here and not at the play sites.

   THE ORDER MATTERS AND IT IS NOT ARITHMETIC PEDANTRY. A reduction cannot
   push a cost below zero and bank the difference, so the floor is applied
   to the reduced cost FIRST and the tax is added on top. Folding it into
   one `Math.max(0, cost - red + frost)` would let a spare {r} of reduction
   silently eat a Frostbite — the tax would vanish on precisely the cheap
   cards Iyslander is trying to tax. */
/* WHAT A LINGERING EFFECT ADDS TO A COST (v3.29). Cartilage Crush taxes
   "their FIRST action during their next turn", so this reports the tax
   while one is live and unspent; the site that charges it marks it spent.
   Only `ready` entries count — an effect armed during this turn is aimed
   at the next one. */
function nextTurnTax(sd){
  return ((sd && sd.nextTurn) || [])
    .filter(e => e && e.ready && !e.spent && e.kind === "firstActionTax")
    .reduce((a, e) => a + (e.amt || 0), 0);
}
/* IS A RESTRICTION LIVE? (v3.30) A restriction carries no AMOUNT, so
   asking `nextTurnDebuff` for one gives 0 and every `>= 0` test around it
   is true forever — a gate a reviewer reads as a gate and that gates
   nothing. Restrictions are asked by kind, never summed. */
function nextTurnHas(sd, kind){
  return ((sd && sd.nextTurn) || [])
    .some(e => e && e.ready && !e.spent && e.kind === kind);
}
/* CAN THIS SIDE PLAY THIS CARD RIGHT NOW? (v3.30)

   Crush the Weak forbids "attack action cards with N or less base {p}"
   for a whole action phase. It is a LEGALITY, not a modifier: refusing
   after the card has left the hand costs the player a card for a play the
   rules never allowed — the same reasoning that put the attack-reaction
   target restriction in `judge.legal` at v3.11.

   TWO THINGS THE PRINTED WORDS DECIDE, and each is a way to be wrong:

     ATTACK ACTION CARD    `isAtkActionCard`, never `isAttack` — the
                           latter tests `tt` and "Reaction" CONTAINS
                           "action", so an attack REACTION would be
                           barred by a card that never names one.
     BASE {p}              the printed number. A buff must not lift a
                           card over the line, and a debuff must not
                           push one under it. */
function nextTurnBars(sd, card){
  if(!card || !isAtkActionCard(card)) return null;
  for(const e of ((sd && sd.nextTurn) || [])){
    if(!e || !e.ready || e.spent || e.kind !== "noSmallAtk") continue;
    if((card.power || 0) <= (e.amt || 0))
      return "the crush still holds — attack action cards with "
           + e.amt + " or less base power can't be played this phase";
  }
  return null;
}
function nextTurnDebuff(sd, kind){
  return ((sd && sd.nextTurn) || [])
    .filter(e => e && e.ready && !e.spent && e.kind === kind)
    .reduce((a, e) => a + (e.amt || 0), 0);
}
/* WHAT A ONE-SHOT COST REDUCTION IS WORTH TO THIS CARD (v3.32).

   PURE, and it consumes nothing — `effCost` is read TWICE and only one of
   those reads takes resources (v2.80), so a reader that spent here would
   discount the affordability check and then charge full price, or the
   reverse. The CHARGE SITE spends it, exactly as the next-turn tax is
   spent (v3.29).

   Only the FIRST matching entry applies. Two Seismic Surges resolving on
   the same turn are two separate grants against two separate cards, not
   {r}{r} off one — the printed line says "your NEXT". */
/* HEAVE N — read off the printed KEYWORD, semantics off the printed
   REMINDER TEXT (v3.32).

   `functional_text` carries the bare words "**Heave 3**" and the database
   prints no reminder text for it. The CARD does:

     Heave 3 (At the beginning of your end phase, if Thunder Quake is in
     your hand and you have an empty arsenal zone, you may pay {r}{r}{r}
     and put Thunder Quake FACE UP into your arsenal. If you do, create 3
     Seismic Surge tokens.)

   Read off the printing, the way Clash of Agility's comparison was
   settled — the printed product is the oracle, and it is more precise
   than the ruling recorded in 2026-07-25, which had heave replacing the
   arsenal action rather than performing one.

   BOTH NUMBERS ARE N. The keyword's parameter is the cost and the token
   count on the one card that prints it; storing one and hardcoding the
   other would be inventing card text the moment a second heave exists.

   THE EMPTY-ARSENAL GATE IS `arsEmpty`, NOT `arsFree` (v2.34). They
   coincide at the normal capacity of 1, which is exactly why reading the
   wrong one stays invisible until a second slot exists. */
function heaveOf(c){
  const kws = [...((c && c.kw) || []), ...String((c && c.tx) || "").split("\n")];
  for(const k of kws){
    const m = clean(String(k)).match(/^heave (\d+)$/i);
    if(m) return {n: +m[1]};
  }
  return null;
}

function costOffFor(c, sd){
  const e = ((sd && sd.costOff) || []).find(x => x && qualMatches(x.q, c));
  return e ? (e.amt || 0) : 0;
}
function effCost(c,sd){ return Math.max(0,(c.cost||0)-runeRed(c)*runeCount(sd)-boardRed(c,sd)-costOffFor(c,sd)) + frostCount(sd) + nextTurnTax(sd); }
function weaponCost(tx){
  const t = clean(tx||"");
  const m = t.match(/((?:once per turn )?)action\s*[-—]*\s*([^:]{0,90}?):\s*attack\b/i);
  if(!m) return null;
  const cs = (m[2]||"").trim();
  const dm = cs.match(/(\d+)\s*(?:resource|\{r\})/i) || cs.match(/(\d+)/);
  const rs = (cs.match(/\{r\}/gi)||[]).length;
  /* "ONCE PER TURN" IS PRINTED, NOT UNIVERSAL — and it is not the only
     thing that limits a weapon to one swing.

     Of the pool's eleven swinging weapons, nine print "Once per Turn".
     TWO DO NOT, and they are not the same case as each other:

       Sledge of Anvilheim   "Action - {r}{r}{r}{r}: Attack"
         genuinely repeatable. Pay four again, swing again.

       Scorpio, Comet Tail   "Action - {t}: Attack. ..."
         limited to one swing per turn ANYWAY, because {t} taps it and a
         tapped permanent does not untap until CR 4.4.3d in the end
         phase. Same outcome, completely different reason.

     A blanket "already swung" flag makes Sledge strictly WEAKER than
     printed — a direction `npm run fairness` is deliberately one-sided
     against and cannot report, and one coverage reads as `full` because
     the text was read correctly and then CHARGED wrongly. Reading only
     `oncePerTurn` and ignoring `{t}` would make Scorpio stronger than
     printed, which is the direction that steals games. Both are read,
     and the caller must honour both. */
  return {cost: dm ? +dm[1] : rs, addRust:/rust counter/i.test(cs),
          needSteam:/remove a steam counter/i.test(cs),
          taps: /\{t\}/i.test(cs),
          oncePerTurn: !!m[1]};
}
/* TWO LIMITS LIVE IN `weaponUsed` AND THEY EXPIRE DIFFERENTLY (CR 4.4.3d).
   Drop every entry whose limit is a per-turn ALLOWANCE — it comes back at
   every turn boundary, for both seats — and keep every entry that records
   a TAPPED permanent, because only its controller's untap step lifts that,
   and a permanent that is both tapped and once-per-turn is still tapped.

   Reading the limit off the piece's OWN printed line rather than storing a
   kind on the flag is what keeps it from drifting: `weaponCost` is already
   the one reader of that line and it answers both questions.

   They coincide for a weapon swing — action speed, so a seat only reaches
   it on its own turn — and stop coinciding at the first `Instant - Once
   per Turn` equipment ability, which is Crucible of Aetherweave, which is
   in Iyslander's gear. This lived in judge.js until v2.71; the trainer
   needed the same answer and a second copy of it is the no-mirror rule
   being broken in slow motion, so it moved here, beside `weaponCost`. */
/* Does the printed ACTIVATION cost tap the permanent? `weaponCost` answers
   this for a weapon's attack line and only for that — it requires ":
   attack" — so an equipment ABILITY ("Once per Turn Instant - {t}: …")
   reads as null there and would be treated as a plain allowance. Two
   shapes, one question, asked of the cost segment before the colon. */
function tapsToActivate(tx){
  const line = clean(tx || "").split(/\n+/)
    .find(l => /^(?:once per turn )?(?:action|instant)\s*[-—]/i.test(l)) || "";
  const cost = (line.split(":")[0] || "");
  return /\{t\}/i.test(cost);
}
/* IS THIS PIECE'S ACTIVATED ABILITY AVAILABLE AT INSTANT SPEED, RIGHT NOW?
   Printed facts only: the speed off its own ability line, the piece still
   in play, and the once-per-turn / tap flag not yet set.

   It deliberately does NOT ask the WINDOW — priority.js owns that (CR
   8.1.6) — and does NOT ask the printed `activateIf` gate, because that
   reads board state the parser has no business knowing. Both are asked
   beside it by the caller.

   EXTRACTED SO IT CAN BE DRIVEN. As a `const instAb = …` inside the render
   it could only ever be pinned by grepping the source, and a grep for the
   call it guards stays green when the gate is replaced by `if(false)` —
   which is precisely how a drill went green against a disabled route
   during this change. Pin the gate, not the identifier; better still,
   make the gate a function a drill can call. */
function instantAbilityReady(gr, sd){
  if(!gr || !gr.pow || gr.destroyed) return false;
  if(!gr.powCard || !gr.powCard._instant) return false;
  const used = (sd && sd.weaponUsed) || {};
  return !used["gp" + gr.uid];
}
function perTurnCleared(sd){
  const used = (sd && sd.weaponUsed) || {};
  const out = {};
  for(const uid of Object.keys(used)){
    if(!used[uid]) continue;
    /* AN ABILITY'S FLAG IS NAMESPACED ("gp"+uid, "bp"+uid) so it cannot
       collide with the piece's own swing — so the lookup has to strip it,
       or every ability entry misses the gear list, reads as an allowance
       and silently untaps a tapped permanent on the wrong seat's turn. */
    const bare = String(uid).replace(/^(?:gp|bp)/, "");
    /* COMPARED AS STRINGS, deliberately. A gear uid is a NUMBER and the
       namespaced flag is a string, so stripping "gp9" yields "9" and a
       strict === against 9 never matches — the piece is not found, the
       entry falls through as an allowance, and a tapped ability untaps at
       the wrong boundary. The prefix only exists to keep an ability's flag
       from colliding with its piece's own swing, so identity here is the
       printed uid regardless of how it was spelled. */
    const piece = ((sd && sd.gear) || [])
      .find(x => x && (String(x.uid) === String(uid) || String(x.uid) === bare));
    if(!piece) continue;                    /* unknown: treat as an allowance */
    const wc = weaponCost(piece.tx || "");
    if((wc && wc.taps) || tapsToActivate(piece.tx || ""))
      out[uid] = true;                      /* still tapped — only (d) lifts it */
  }
  return out;
}
const hasKw = (c,k) => (c.kw||[]).some(x=>String(x).toLowerCase().includes(k)) || new RegExp("\\b"+k+"\\b","i").test(c.tx||"");
/* A DOUBLE-FACED CARD'S TYPE LINE CARRIES BOTH FACES — "Runeblade Action //
   Earth Instant". The card you PLAY is the front face; the back is reachable
   only by melding, so every type question is asked of the front. Reading the
   whole line called Arcane Seeds // Life and Burn Up // Shock instants, which
   is exactly how an action card would slip past its action point below. */
const frontFace = c => String((c && c.tt) || "").split("//")[0];
const isAR = c => /attack reaction/i.test(frontFace(c));
const isDR = c => /defense reaction/i.test(frontFace(c));
const isRx = c => isAR(c) || isDR(c);
const isInstantT = c => /\binstant\b/i.test(frontFace(c)) && !/reaction/i.test(frontFace(c));

/* ---- WHAT COUNTS AS "A CARD WITH 6 OR MORE {p}" ---------------------
   ONE QUESTION, ASKED IN ONE PLACE. It was spelled `(c.power||0)>=6` in
   five separate spots across index.html and effects.js — the pitch-zone
   check, the graveyard check, the play-gate, the discard pool and an
   inline find. That is the same shape as the five hand-rolled copies of
   "may this be played here" that `rxAllowed` replaced in v2.40, and it
   drifts the same way.

   It is not a constant, because a hero can change it. KAYO prints:

     "Attack action cards you own get +1{p} while they are in any zone
      other than the combat chain."

   The combat chain is where an attack STRIKES, so this is deliberately
   NOT a damage buff — it is a THRESHOLD rule. A printed-5 attack action
   is a 6 in hand, in the pitch zone, in the graveyard, in the arsenal
   and in the deck, and reverts to 5 the moment it is declared. Kayo's
   deck is 22 cards that print 6+ and 23 attack actions that print
   exactly 5 — all of them the pitch-2 and pitch-3 cards you actually
   pitch — so without this rule the deck's own engine never fires.
   RULING (user, 2026-08-08): every 6+ check sees the buffed value; the
   strike sees the printed one.

   `zonePow` is therefore the value a THRESHOLD reads. Nothing in the
   damage path may call it, and no caller passes a build for a card on
   the chain. */
const isAtkActionCard = c => {
  if(!c) return false;
  /* THE STRUCTURED ARRAY IS THE AUTHORITY (v2.44) — type_text carries
     errors on 5 of the database's records. The one thing the display
     string knows better is a DOUBLE-FACED card, whose `ty` flattens
     both faces, so fall back to the FRONT of `tt` when there is no
     array to read. */
  if(Array.isArray(c.ty) && c.ty.length && !/\/\//.test(c.tt || ""))
    return c.ty.indexOf("Action") >= 0 && c.ty.indexOf("Attack") >= 0;
  const ff = frontFace(c);
  return /attack/i.test(ff) && /action/i.test(ff) && !/reaction/i.test(ff);
};
/* ITS TWIN, and the two are NOT complements: a Defense Reaction carries
   no Action at all and is neither. Lived in effects.js until v3.31, where
   `qualMatches` also needed it — so it moved rather than being copied. */
const isNonAtkActionCard = c => {
  const ty = (c && c.ty) || [];
  return ty.some(t => /^action$/i.test(String(t)))
      && !ty.some(t => /^attack$/i.test(String(t)));
};
const zonePow = (c, b) => (c && c.power != null ? +c.power : 0)
  + ((b && b.atkPowOffChain && isAtkActionCard(c)) ? b.atkPowOffChain : 0);
const pow6 = (c, b) => zonePow(c, b) >= 6;

/* ---- A KEYWORD THE CARD ONLY GRANTS CONDITIONALLY -------------------
   v2.31 established that `card_keywords` is an INDEX — it lists every
   keyword APPEARING on the card, including ones the text grants only
   under a condition — and applied the fix to `fx.ga`. It was never
   applied to `hasKw`, which is what the trainer asks for every OTHER
   keyword, and `hasKw` matches the raw text as well as the list. So:

     Pulping — "If a card with 6 or more {p} is discarded this way,
                this gets dominate."

   was held to one blocker on EVERY swing, its printed gate pure
   decoration. Same shape, same card family, four versions later.

   THE DISCRIMINATOR IS THE GATE WORD, AND A TRIGGER IS NOT A GATE.
   "When this attacks, intimidate" (Smash Instinct) fires every time the
   card attacks — treating that as conditional would make the card do
   nothing. "If X, this gets dominate" may not fire at all. So `if` and
   `unless` gate; a bare `when`/`whenever` does not, unless the when-
   clause itself carries a nested `if` (Spectral Rider: "When you play
   this, IF you control a Spectral Shield, this gains overpower").

   Across the whole pool exactly three keywords are non-standalone and
   gated this way: Pulping's dominate, Spectral Rider's overpower, and
   Smash Instinct's intimidate — which this correctly does NOT flag. */
const kwGated = (c, k) => {
  if(!c || !k) return false;
  const raw = String(c.tx || "");
  const tx = clean(raw);
  if(!tx) return false;
  const kw = String(k).toLowerCase();
  const rx = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
  if(!rx.test(tx)) return false;
  /* A KEYWORD PRINTED ON A LINE OF ITS OWN IS UNCONDITIONAL, whatever else
     the card says — v2.31's layout rule, and the database really does put
     real keyword lines in their own paragraph.
     READ THE RAW TEXT HERE, NOT THE CLEANED ONE: `clean` collapses the
     newlines this rule depends on. Getting that wrong reported Loot the
     Arsenal and Loot the Hold as too strong — both print "Go again" on its
     own final line, and both happen to carry an "If you do, …" inside a
     QUOTED ability granted to another card, which the sentence scan below
     then read as the gate. */
  if(raw.split(/\n+/).some(l => new RegExp("^\\**" + kw + "\\**\\.?$", "i").test(l.trim()))) return false;
  /* otherwise: is EVERY sentence mentioning it gated? */
  const sentences = tx.split(/(?<=\.)\s+|\n+/).filter(s => rx.test(s));
  if(!sentences.length) return false;
  return sentences.every(s => {
    const before = s.slice(0, s.search(rx)).toLowerCase();
    if(/\b(if|unless)\b/.test(before)) return true;          // a real condition
    return false;                                             // a bare when/whenever trigger, or plain text
  });
};
/* what the card actually HAS right now, before any conditional grant */
const hasKwNow = (c, k) => hasKw(c, k) && !kwGated(c, k);

/* ---- DOES THE CARD *PRINT* THIS KEYWORD? (v2.84) ---------------------
   The third predicate, and the three answer genuinely different
   questions. Reaching for the wrong one is how a keyword gets granted
   off raw text, which is v2.31's bug:

     hasKw      the keyword appears ANYWHERE — list or text. Deliberately
                loose, and load-bearing: 58 pool cards grant go again
                inside a sentence and really do gain it.
     hasKwNow   ...and no `if`/`unless` gates every mention of it.
     printedKw  the card CARRIES the keyword as printed rules text —
                nothing about whether it currently applies.

   The discriminator is v2.31's layout rule: the database puts a real
   keyword line in its own paragraph, so a printed keyword stands alone
   on a line while a reference sits inside a sentence. If the text never
   mentions it at all, trust `card_keywords`.

   WHY THIS EXISTS: an ADDITIONAL COST cannot be conditionally granted.
   Boost is printed on the card or it is not — so "when you boost a card"
   (Hyper Driver) and "the next attack you boost this turn" (Re-Charge!)
   are references to the mechanic, and `hasKw` answers TRUE for both.
   Offering their controller boost's cost would be strictly stronger than
   printed, the direction that steals games. Neither prints the keyword;
   both are Mechanologist non-attacks; and the trainer only escaped by
   ALSO testing `isAttack`, which is an accident rather than the rule —
   a non-attack that genuinely printed Boost would be wrong there. */
const printedKw = (c, k) => {
  if(!c || !k) return false;
  const raw = String(c.tx || ""), kw = String(k).toLowerCase();
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* READ THE RAW TEXT, NOT THE CLEANED ONE — `clean` collapses the very
     newlines this rule depends on. Same trap kwGated documents above. */
  if(raw.split(/\n+/).some(l => new RegExp("^\\**" + esc + "\\**\\.?$", "i").test(l.trim())))
    return true;
  if(!new RegExp("\\b" + esc + "\\b", "i").test(raw))
    return (c.kw || []).some(x => String(x).toLowerCase().includes(kw));
  return false;
};

/* ---- WHICH ZONE A CARD MAY BE PLAYED FROM (v3.00) -------------------

   A card is played from the HAND. The graveyard and the banished zone are
   exceptions that something has to GRANT — Gravy Bones' watery grave,
   Crouching Tiger's own printed line, a card that says "you may play this
   from your graveyard".

   THAT RULE LIVED IN THE TRAINER'S UI. `playables()` decided it while
   building the tap list, so `judge.legal` never had it, and at the table
   **every card in your graveyard was playable** — driven: a vanilla
   Brutal Assault with no watery grave anywhere near it went from the
   graveyard straight onto the combat chain, `legal` returning null. That
   is sev-3 "illegal play allowed" over the whole pool rather than over a
   keyword, and it is the same shape as phantasm: a rule that exists on
   one board only, because the board that has it keeps it somewhere the
   other one cannot reach.

   It is asked of PRINTED fields and `fxParse`, so it stays pure and both
   callers share it. What the caller supplies is the part that belongs to
   the game rather than the card: whose hero grants watery grave, whether
   a blue card has hit the graveyard this turn, and which turn it is.

   `printedKw`, NOT `hasKw`. The hero reads "you may play cards WITH
   watery grave from your graveyard" — a card that merely mentions the
   keyword does not have it. Three pool cards do exactly that (Jittery
   Bones, Compass of Sunken Depths, Washed Up Wave, all of which ASK
   about watery grave), and under `hasKw` all three were replayable from
   the graveyard against their own printed text. */
const playableFromZone = (c, zone, o) => {
  o = o || {};
  if(!c) return false;
  /* FROZEN (Cold Snap). "Whatever they choose cannot be played or
     activated until the start of your next turn" — so the gate is here,
     where both boards already ask whether a card may be played from where
     it sits. `_frozenBy` records WHICH seat's freeze it is; the thaw
     (`effects.thawFreeze`) reads the same mark, so no turn arithmetic is
     stored and the two boards' different `turn` clocks cannot disagree. */
  if(c._frozenBy != null) return false;
  /* the ordinary routes, and the two the trainer models as zones */
  if(zone === "hand" || zone === "arsenal" || zone === "weapon" || zone === "hero") return true;
  if(zone === "grave"){
    if(fxParse(c).fromGY) return true;
    /* FACE DOWN IS THE DRAWBACK, and it is why watery grave is a keyword
       rather than a bonus: an ally that dies is turned face-down
       "specifically so it cannot be replayed infinitely" (RULING
       2026-07-25). Without this the six allies are a loop. */
    if(c._fd) return false;
    return !!(o.wateryGrave && (o.blueGY || 0) > 0 && printedKw(c, "watery grave"));
  }
  if(zone === "banish"){
    if(fxParse(c).fromBan) return true;
    return c._playTurn != null && c._playTurn === o.turn;
  }
  return false;
};

/* ---- WHICH CARD FITS WHICH WINDOW (CR 8.1.2a / 8.1.3a / 8.1.6) ------
   CR 8.1.2a — an attack reaction "can only be played/activated by a
   player who controls the attack during the Reaction Step of combat."
   CR 8.1.3a — a defense reaction "can only be played/activated by a
   player who controls a hero as an attack-target during the Reaction
   Step of combat."
   CR 8.1.6 — an instant is legal in any window where you hold priority.

   So the reaction step is TWO windows, not one: the attacking player may
   play attack reactions, the defending player defense reactions, and
   neither may play the other's. `win` is a window name straight out of
   priority.js's `speedAllowed`, which already splits them by attacker —
   this answers the card half of the same question.

   The `fx.ops.length` test on an instant is a TRAINER concern, not a
   rules one: an instant the parser reads nothing from would arm the tap
   and then do nothing, which is a dead tap rather than a refusal. It is
   the one thing here that is not a citation. */
function rxAllowed(c, win){
  if(!c) return false;
  const inst = isInstantT(c) && fxParse(c).ops.length > 0;
  if(win === "attack-reaction")  return isAR(c) || inst;
  if(win === "defense-reaction") return isDR(c) || inst;
  return inst;
}

/* ---- WHAT COSTS AN ACTION POINT (CR 8.1.1 / 8.1.6) ------------------
   CR 8.1.1 — "An action card/activated ability has the additional
   asset-cost of one action point to play/activate."
   CR 8.1.6 — "A card/activated ability with the type instant can be
   played/activated any time the player has priority." No such cost.

   One question, asked in ONE place: the trainer's play gate and its
   resolution arithmetic must not answer it separately, or they drift.
   `_instant` is the flag parseHeroPower stamps on the powCard of an
   "Instant - …" activated ability, so a piece of equipment answers this
   the same way a card does — which matters, because "Instant - Destroy
   this: Gain 1 action point" (Achilles Accelerator) nets to nothing at
   all if activating it silently spends one. */
/* THE WINDOW IS AN OPTIONAL SECOND ARGUMENT (v2.77), and it can only ever
   make the answer CHEAPER. CR 8.1.1 charges the point to an ACTION; a card
   played in a reaction window is not being played as one, which is why a
   dual-typed card like Den of the Spider costs a point as an Action and
   none as a Defense Reaction. The trainer has no windows and passes
   nothing, so its answer is unchanged to the character; judge.js decides
   the window at `doPlay` and carries it through the payment, so the answer
   cannot change while the player pitches.

   `types.js`'s `typeCostsAP` asks the same question off the structured
   type array and is the authority on what a card IS. It is deliberately
   not called from here: parser.js is loaded before types.js, and the two
   agree on every case that can actually reach this line — the disagreement
   is only for a reaction card in the ACTION window, which `playWindowFor`
   never returns. */
const costsAP = (c, window) => {
  if(c && c._instant) return false;
  if(window && window !== "action") return false;
  return !isInstantT(c);
};

/* ---- THE REACTION PUMP (v2.66) --------------------------------------
   How much an attack reaction adds to the attack it targets. THREE
   printed things fold into one number and each has been wrong:

     fx.self    the reaction's own unconditional "+N{p}"
     fx.conds   a GATED pump — and "instead" REPLACES the base (v2.32)
     buffNext   a "your next attack" pump on the same card

   It lived as one hand-rolled line inside `playRx`, a React closure no
   drill could reach, and it read `(fx.self||0) + condPump + …` — a plain
   sum. Overpower prints "Target weapon attack gains +4{p}. Reprise - …
   INSTEAD it gains +6{p}" and that line granted **+10**, the same shape
   as v2.32's Emeritus Scolding bug in the one place the fairness sweep
   does not look.

   Pure on purpose: deciding WHICH conditions fired needs the board and
   stays with the caller, which passes in the names of the ones that did.
   That is what makes the arithmetic drillable rather than pinned by
   grepping the trainer's source. */
function rxPump(fx, fired){
  const on = new Set(fired||[]);
  let cond = 0, replaced = false;
  (fx.conds||[]).forEach(c => {
    if(!on.has(c.cond) || c.op[0] !== "self") return;
    cond += c.op[1];
    /* only a pump may replace the pump — an `instead` cond running some
       other kind of op has no business deleting the printed base */
    if(c.instead) replaced = true;
  });
  const base = replaced ? 0 : (fx.self||0);
  const buff = (fx.ops||[]).filter(o => o[0]==="buffNext").reduce((a,o)=>a+o[1], 0);
  return {pump: base + cond + buff, base, cond, buff, replaced};
}

/* ---- THE IDLE-COUNTER WIPE (v2.68) ----------------------------------
   Which permanents lose their +1{p} counters at the beginning of an end
   phase: the ones whose OWN printed text carries the schedule, that
   actually hold counters, and that did NOT hit this turn.

     "At the beginning of your end phase, if this hasn't hit this turn,
      remove all +1{p} counters from it."

   RULING (user, 2026-08-09): the counters PERSIST across turns, so this
   is the only thing that removes them — which is what makes a turn where
   the blade never connects genuinely cost something.

   It is a function rather than four lines inside `endTurn` because a
   decision buried in a React closure can only be pinned by grepping the
   trainer's source, and a grep is satisfied by a COMMENT. Written that
   way first, this drill passed with the gate replaced by `if(false)` —
   the words it was looking for were sitting in the comment above it. A
   false pass is worse than no drill at all.

   `hits` is the per-turn tally keyed by uid; the caller supplies it
   because "this turn" is the caller's clock. */
function idleCounterWipes(gear, counters, hits){
  return (gear||[])
    .filter(gr => gr && ((counters||{})[gr.uid]||{}).pow > 0
                     && fxParse(gr).wipePowIfIdle
                     && !(((hits||{})[gr.uid]||0) > 0))
    .map(gr => gr.uid);
}

/* WHICH PIECES HAVE RUSTED THROUGH (v3.17) — the same shape, and here for
   the same reason: the threshold is the CARD'S printed number, so a piece
   that prints 4 must not shatter at 3 because a board's inline filter said
   so. Talishar is the pool's only ruster today; the next one is data. */
function rustedThrough(gear, counters){
  return (gear||[])
    .filter(gr => {
      if(!gr || gr.destroyed) return false;
      const n = fxParse(gr).rustDestroy;
      return n != null && (((counters||{})[gr.uid]||{}).rust || 0) >= n;
    })
    .map(gr => gr.uid);
}

/* test hook — fxParse memoizes on name|pitch; drills must clear between fixtures */
const fxReset = () => FXMEMO.clear();

return {norm, isAttack, isArrow, isWeapon, hasGA, arcaneDmg, num, clean, optFilter, attackQual, qualMatches,
        nextTurnTax, nextTurnDebuff, nextTurnHas, nextTurnBars, qualLabel, attackTail, isNonAtkActionCard, costOffFor, heaveOf,
        classifyClause, fxParse, fxReset, playableFromZone, parseHeroPower, parseHandAbility, runeRed, boardRed, effCost,
        weaponCost, perTurnCleared, tapsToActivate, instantAbilityReady, hasKw, isAR, isDR, isRx, isInstantT, costsAP, rxAllowed, rxPump,
        idleCounterWipes, rustedThrough,
        isAtkActionCard, zonePow, pow6, kwGated, hasKwNow, printedKw,
        isRunechant, runeCount, isAura, auraCount, isFrostbite, frostCount,
        isFrailty, frailtyCount,
        arcaneBarrier, spellvoid, arcaneSoaks,
        ARS_PUT, ARS_STAMP, arsCap, arsCount, arsFree, arsEmpty,
        CARD_OVERRIDES};
});
