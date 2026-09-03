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
  /* `it's` -> `it is`, and it was levelled LATE (v3.36) because the
     database prints BOTH FORMS TODAY: ten clauses say "if it's blue",
     two say "if it is Draconic". So the anchors had drifted to match
     whichever one they were written against — `/^it'?s blue$/` on one
     line and `/^it is draconic$/` three lines below it — and either
     would stop dead the moment upstream levelled the other way, which
     is v3.00's whole lesson wearing a contraction.
     `\bit's\b` cannot match the possessive `its`. */
  [/\bit's\b/g,            "it is"],
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

/* ---- A GRANTED ABILITY RIDING IN QUOTES ------------------------------
   FaB prints a granted ability in QUOTES, which is what makes it readable
   rather than guessable: the quoted text is a clause in its own right and
   goes back through `classifyClause`.

   IT RETURNS NULL ON A PAYLOAD IT CANNOT READ, deliberately (v3.10) — an
   unreadable rider refuses and the head still lands, which is weaker than
   printed and honest. `fxParse` asks it a SECOND time, to mark the clause
   unread when that happens, so the gap reaches the audit instead of the
   card reporting `full` with a printed ability doing nothing (v3.40).

   AT MODULE SCOPE so both callers share one matcher. It was nested inside
   `classifyClause`, and re-testing "is there a quoted ability here" in
   `fxParse` with a second regex would be two descriptions of one question
   — free to disagree about which clauses have one. */
/* THE QUOTED TEXT ITSELF, and ONE matcher for it. The closing quote is
   BACKREFERENCED to the opening one: a bare character class for either end
   lets a mid-word apostrophe close the quote, so "defense reactions can't
   be played…" captured `defense reactions can` — a capture that then fails
   to parse for a reason that is not the card's, and which the audit
   printed as its finding.

   ONE BODY BECAUSE TWO CALLERS ASK IT. `quotedOnHit` reads the payload and
   `fxParse` records the ones with no reader; writing the regex twice made
   them free to disagree about where a quote ends, and a sabotage of one
   left the other correct — which is how this was found. */
function quotedText(txt){
  const g = txt.match(/\band (["\u201c\u2018'])(.+?)\1/) || txt.match(/\band ["\u201c](.+?)["\u201d]/);
  if(g) return g[2] != null ? g[2] : g[1];
  /* A RIDER-ONLY GRANT HAS NO "and" (v3.45). "Your next Pirate ally attack
     this turn gets \"…\"" is the whole card, so the anchor every other
     shape leans on is simply absent — and this returned null, which meant
     the two Loot cards' riders could not be read OR reported, and the
     quoted-unread audit flag was blind to them.

     DOUBLE QUOTES ONLY on this fallback. v3.41 found that a bare character
     class lets a mid-word apostrophe close the quote, and dropping the
     "and" anchor removes the very thing that kept that rare. The
     backreferenced apostrophe branch above still serves the shapes that
     need it. Measured over the pool before widening: 22 extractions
     identical, 6 newly found, and ZERO changed. */
  const d = txt.match(/(["\u201c])(.+?)["\u201d]/);
  return d ? d[2] : null;
}

/* THE QUOTED RIDER, AND WHOSE HIT IT ASKS ABOUT — ONE BODY (v3.45).

   The granted ability is a clause in its own right, so `classifyClause`
   already answers both questions in one pass: what it does, and whether
   its trigger names a HERO. Avast Ye!, Yo Ho Ho!, Loot the Hold and Loot
   the Arsenal all print "When this hits a hero, …", so their riders must
   not fire off an ally hit either.

   Asking a second regex here would be the matcher written twice — the
   defect v3.41 found in `quotedText` itself, where sabotaging one copy
   left the other correct and the drill stayed green. */
function quotedRider(txt){
  const q = quotedText(txt);
  if(q == null) return null;
  /* THE WHOLE QUOTED PAYLOAD MUST BE CONSUMED, OR IT REFUSES (v3.45) —
     v2.29's rule for optional-cost filters, applied to a rider. The two
     Loot cards print a payload in two sentences, and `classifyClause`
     reads ONE of them: Loot the Hold gave the discard and dropped the
     Gold, and Loot the Arsenal gave the GOLD and dropped the destroy it
     is printed to pay for — the reward without the cost, which is the
     direction that steals games.

     "If you do, …" is the family this project deliberately does not read
     (see Known approximations), so a quoted payload carrying one is not
     fully readable and must claim nothing rather than claim half. */
  if(/\bif (?:you|they) do\b/i.test(q)) return null;
  const sub = classifyClause(q);
  if(!(sub && sub.status === "run" && sub.onHit && sub.ops.length)) return null;
  return {ops: sub.ops, heroOnly: !!sub.heroOnly};
}
/* the ops alone, for the callers that only ask "is there a reader" */
function quotedOnHit(txt){
  const r = quotedRider(txt);
  return r ? r.ops : null;
}

/* THE PICK SHAPES, NAMED ONCE. Each is matched twice — against the
   lowercased clause for the shape, and against the raw clause to recover
   the subject's printed capitalisation (see `cased` inside
   `classifyClause`). Two spellings of one pattern is exactly the drift
   this project keeps paying for — v3.41's `quotedText` was written twice
   and sabotaging one copy left the other correct — so the pattern is a
   constant and both reads share it. */
const RX_FOE_TOP  = /^put (.+) from their hand on top of their deck$/;
const RX_FOE_GY   = /^banish target (.+) from an opposing hero'?s graveyard$/;
const RX_GY_DECK  = /^put target (.+) from your graveyard on (?:the )?(top|bottom) of your deck$/;
const RX_GY_HAND  = /^(you may )?return (.+) from your graveyard to your hand$/;
const RX_RETRIEVE = /^(you may )?retrieve (.+) from your graveyard$/;

/* PUTTING COUNTERS ON A PERMANENT YOU CONTROL.

   THE KIND IS READ OFF THE PRINTED LINE and mapped to the storage key the
   engine ALREADY reads — never invented, and never widened to "whatever
   word came before 'counter'". A counter kind nothing reads is a counter
   that does nothing, filed `full`, which is the no-op blind spot at its
   purest; an unrecognised kind REFUSES and leaves the card unclaimed.

   Each of these four is genuinely consumed somewhere:
     steam  a weapon's `needSteam` activation, and Plasma Barrel Shot
     rust   `rustedThrough` — the piece shatters at its printed threshold
     aim    the `aim` condition, and Drill Shot's piercing
     pow    `powCtr` on a weapon swing, and the idle-counter wipe

   `+1{p}` IS THE PRINTED SPELLING OF `pow`. Mapping a printed form onto
   an existing field is reading; adding a fifth key here without a reader
   would be parsing ahead of wiring. */
const CTR_KINDS = {"steam":"steam", "rust":"rust", "aim":"aim", "+1{p}":"pow"};
const CTR_WORDS = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6};
const RX_CTR_PUT = /^put (a|an|one|two|three|four|five|six|\d+) ([a-z+{}0-9-]+) counters? on (.+)$/;

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
  /* THE SUBJECT KEEPS ITS PRINTED CAPITALISATION, and it has to.
     `classifyClause` works on the LOWERCASED clause, but `optFilter`'s
     NAMED-CARD branch is anchored on a proper noun — "a Phoenix Flame",
     "a Nimblism" — because that is the only thing that tells a name from
     a common noun. Handed the lowercased text it answers `null`, so a
     reader that passes `c` straight through refuses every card whose
     subject is a name, and looks for all the world like the shape simply
     was not matched.

     v3.33's lesson from the other end: `classifyClause` lowercases, and a
     minted token wore the lowercased name to the board. Here the same
     lowercasing silently REFUSES instead of mis-naming. So the shape is
     matched on `c` (levelled, so the idiom table still reaches it) and the
     SUBJECT is recovered from the raw clause with the same pattern; a raw
     match that fails falls back to the lowercased capture, which is
     correct for every subject that is not a name. */
  const CASED = clean(raw).replace(/\.$/, "").replace(/^-\s*/, "");
  const cased = (rx, gi, fallback) => {
    const mm = CASED.match(new RegExp(rx.source, rx.flags.replace("i","") + "i"));
    return (mm && mm[gi] != null) ? mm[gi] : fallback;
  };
  let m;
  /* Activated abilities first. "Instant - Destroy this: Gain {r}" is a cost
     you pay, not an effect that fires on its own — matching it against the
     generic effect rules below would hand out the resource for free. The
     cost/effect split belongs to weaponCost and parseHeroPower. */
  /* A REACTION WINDOW IS AN ACTIVATION PREFIX TOO (v3.59). The guard
     listed `action` and `instant`; the pool also prints
     "Attack Reaction - <cost>: <effect>" on five records, and without
     them here the generic matchers below ate the whole line INCLUDING
     ITS COST. Prey Spotters' "Attack Reaction - Destroy this: Mark
     target opposing hero" was claimed by the loose `mark` matcher and
     filed `tier: full` — while `parseHeroPower` refuses the line, so
     `build.js` gives the piece NO powCard and neither board can reach
     it. A card that reports finished and cannot be activated at all is
     the no-op blind spot, and this is the unanchored-match half of it
     (v3.00's Stir the Aetherwinds, on an activation line).

     ANCHORED ON THE DASH, exactly like the existing prefixes: Widowmaker
     and Wreck Havoc print "Defense reactions can't be played to this
     chain link", which is a RESTRICTION and not an activation, and it
     has no dash to match.

     These four cards now report `part`, which is the truth. Building the
     route is a real job — see HANDOFF.md — and reading the payload
     before it exists is the never-parse-ahead-of-wiring rule. */
  if(/^(?:once per turn )?(?:action|instant)\s*[-—]/.test(c)){
    if(weaponCost(raw)) return NOOP("weapon attack ability — cost read by the weapon reader");
    if(parseHeroPower(raw, true)) return NOOP("activated ability — read by the equipment reader");
    return null;
  }
  /* AND IT REFUSES OUTRIGHT, rather than deferring to the equipment
     reader like the two prefixes above. `parseHeroPower`'s PROBE form
     answers truthily for these lines, but `build.js` builds a powCard
     only from an `action`/`instant` line — so filing them `noop` as
     "read by the equipment reader" names a reader that does not run, and
     Stalker's Steps went straight from `part` to `full` while staying
     completely inert. That is the blind spot this guard exists to close,
     re-created one line further down.

     `null` is the truth: nothing reads these yet. Building the route is a
     real job across parser, build.js, judge and the trainer's offering
     path — see HANDOFF.md — and reading the payload first is the
     never-parse-ahead-of-wiring rule. */
  if(/^(?:once per turn )?(?:attack|defense) reaction\s*[-—]/.test(c)) return null;
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

  /* IT SITS WITH THE WHOLE-CLAUSE PATTERNS, and that placement is the
     rule rather than a convenience: the loose payload matchers further
     down recognise words like "they discard a card", and a GRANT's quoted
     payload is made of payload language by construction — so read late,
     the grant is stolen by its own rider. Loot the Hold was: the discard
     matcher at the top of the loose block took it and fired on play.

     The anchor is unambiguous — a quote IMMEDIATELY after gets/gains/has,
     which is what "rider-only" means. A headed grant ("gets +3{p} and
     \"…\"", "gets go again and \"…\"") has its head in the way and is
     left to its own reader further down. */
  /* "YOUR NEXT <x> ATTACK THIS TURN GETS \"<granted ability>\"" — the
     RIDER-ONLY member of the qualified single-shot grant family (v3.45).
     Loot the Hold and Loot the Arsenal print no head at all: no pump for
     `buffNext` to read and no go again for `gaNext`, so neither reader
     matched and the quoted payload fell through to the loose matchers and
     fired ON PLAY.

     It reuses `buffQ` whole, as a grant of ZERO power carrying a rider —
     the entry shape is already `{amt, q, rider}`, the taker already
     gathers riders from the entries that matched, and the expiry is
     already there. A fifth side field would be a second description of
     one thing.

     AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE, which is the point:
     both pool cards carry an "if you do" tail this project does not read,
     so they claim nothing — and, critically, nothing fires on play. The
     shape is still recognised, so the audit can see the clause was read
     and `quotedUnread` names the rider that was not. */
  if(m = c.match(/^(?:your|the) next([^.]*?)\b(non-attack|attack)\b([^.]*?)\s*(?:gets?|gains?|has)\s*["\u201c\u2018']/)){
    const q0 = attackQual(m[1], m[3]);
    if(!q0) return null;
    let full = Object.assign({}, q0);
    if(m[2] === "non-attack"){ delete full.aac; full.nonAtk = true; }
    else full.atk = true;
    const ro = quotedRider(c);
    if(!ro) return null;
    return R([["buffNext", 0, full, ro.heroOnly ? {onHitHero: ro.ops} : {onHit: ro.ops}]]);
  }

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
  /* COLD SNAP — BUILT, and this comment used to say it was not (v3.40).

     It was a `noop` until v3.02 for reasons that had already stopped being
     true in v2.71 ("the dummy pays no costs"; "freeze taxes a play the
     dummy never makes") — facts about a training prop rather than about
     the rules. **A `noop` COUNTS AS ACCOUNTED FOR**, so Cold Snap reported
     `tier: full` while doing nothing at all: the no-op blind spot, on
     Iyslander's signature card. That lesson is why this note survives.

     WHAT REPLACED IT is the recorded ruling, in full — "target hero may
     pay {r}; if they don't, freeze a card in their arsenal or an ally they
     control until the start of your next turn" — as `payOr` with `freeze`
     as its else-payload, a `_frozenBy` stamp honoured by
     `playableFromZone` and by the activation gate on both boards, and a
     thaw at the start of the freezing seat's next turn.

     THE COMMENT OUTLIVED THE GAP BY SEVERAL VERSIONS, which is its own
     lesson: a long confident note saying a card is deliberately unbuilt,
     sitting directly above the code that builds it, is worse than no note
     — it sends the next reader looking for work that is done. When you
     close a recorded gap, delete the record of it. */
  /* RULING (Saltwater Swell): "reveal the top card of your deck" and "if
     it's blue, pitch it" are two SEPARATE printed clauses, but reading them
     apart breaks on an ATTACK card — the generic conds loop that would
     check "it's blue" runs BEFORE the reveal happens at declaration (see
     the "Declaration-time ops" comment in execute()), so it would always
     see last card's stale reveal, or none. One atomic op — read here as a
     single unit, same rule that keeps other if/when patterns off the
     generic splitter — checks the SAME n.revealed the reveal op just set,
     in the same declOps pass. */
  if(m=c.match(/^if it is (red|yellow|blue), pitch it$/))
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
  /* ---- A CONDITIONAL WEAPON STATIC (v3.58) --------------------------
     "If <condition>, this card's attacks get <payload>." THREE pool cards
     print it and all three are weapons:

       Mandible Claw      if you've discarded a 6+ {p} card this turn
       Searing Emberblade if you control 2 or more Draconic chain links
       Star Fall          if you've played a Lightning card this turn

     Until v3.58 Mandible Claw's was a NOOP here whose reason named an
     inline `from==="weapon"` regex in `execute` — one card's rider,
     hand-written, with the other two unread. That is the golden rule
     broken twice over: a card special-cased by name, and a `noop` filed
     for a clause that has real behaviour.

     NOTHING NEW IS NEEDED TO RUN IT. `execute`'s condition loop already
     handles `ga` and `self` specially, and a weapon swing goes through
     `execute` with `attacking` true — so the payload reads as ordinary
     ops and the EXISTING gate machinery applies them at the swing, which
     is exactly when the card says. The conditions were already there too
     (`discard6`, `drac2`); only Star Fall's needed writing.

     `wpnOnly` RIDES ON THE CLAUSE, because "this card's ATTACKS" is not
     "this card". Without it the bonus would also fire when the same piece
     is activated for a non-attack ability — the wrong route, and the
     distinction v3.44 had to make for allies. */
  if(m=c.match(/^this'?s attacks? (?:gets?|gains?|has|have) (.+)$/)){
    const tail = m[1].trim();
    const ops = [];
    const pm = tail.match(/^\+(\d+)\s*\{p\}(?:\s+and\s+go again)?$/);
    if(pm){ ops.push(["self", +pm[1]]); if(/go again/.test(tail)) ops.push(["ga"]); }
    else if(/^go again$/.test(tail)) ops.push(["ga"]);
    /* an unreadable payload refuses rather than claiming the clause */
    if(!ops.length) return null;
    return R(ops, {wpnOnly:true});
  }
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
    /* WHOSE ATTACK? (v3.46) — the on-ATTACK twin of v3.45's `heroOnly`.
       "When this ATTACKS A HERO" is a trigger with a printed subject, and
       the wrapper was consumed and thrown away: Mocking Blow booed the
       crowd and Path of Same Ends dealt its arcane "to them" while
       attacking an ALLY, where there is no them.

       It is set BEFORE the cond dispatch below, so whichever branch
       returns carries it — every one of them `Object.assign`s onto this
       same object. 32 pool clauses print a BARE "when this attacks" and
       are untouched: a bare trigger fires on any attack, which is the
       distinction v2.12 named (a trigger is not a gate). */
    if(/\battacks?\s+a\s+hero\b/.test(cond)) rest.atkHero = true;
    /* ARSENAL FACE-UP. Azalea's arrows fire when put FACE UP into the
       arsenal, which is NOT the end-of-turn arsenal step (that sets face
       DOWN). Three printed phrasings, one trigger:
         "this is put face-up into your arsenal"
         "this is put into your arsenal face up"     (Ridge Rider Shot)
         "this is put or turned face up in arsenal"  (Spire Sniping) */
    if(/\b(?:put|turned)\b/.test(cond) && /\barsenal\b/.test(cond) && /face.?up/.test(cond))
      /* TURNING IS NOT PUTTING, and the printed word is what says so
         (v3.72). Spire Sniping alone says "put OR TURNED"; every other
         arsenal trigger in the pool says "put", and Bravo's ability is
         the pool's only card that TURNS one face up. Read off the clause
         rather than defaulted either way: defaulted true, four arrows
         gain a bonus their text never grants; defaulted false, Spire
         Sniping loses a printed line of play. */
      return Object.assign(rest,{arsUp:true, arsUpTurn:/\bturned\b/.test(cond)});
    /* FACE-UP FROM THE **DECK** (v3.79) — Back Alley Breakline:
       "When an activated ability or action card effect puts this face-up
        into a zone FROM YOUR DECK, gain 1 action point."

       A DIFFERENT TRIGGER FROM THE ONE ABOVE, not a variant of it. That
       one fires on any face-up put; this one fires ONLY when the card
       came off the deck, so reading it as `arsUp` would pay an action
       point every time the card is set face up out of the HAND — an
       action point is the most valuable thing in the game to hand out
       wrongly (v2.31's go again, one resource over).

       "INTO A ZONE" IS DELIBERATELY GENERIC AND THE ARSENAL IS THE ONLY
       ONE REACHABLE. Measured: Azalea's hero ability is the sole thing in
       the pool that puts a card face-up from a deck, so the honest
       reading is the event that exists — and a wider zone has no site to
       fire at. */
    if(/\bputs? this face.?up\b/.test(cond) && /\bfrom your deck\b/.test(cond))
      return Object.assign(rest, {deckUp: true});
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
    if(/\bleaves the arena\b/.test(cond)){
      /* A GATED LEAVE-TRIGGER REFUSES (v3.57), and it is worth saying why
         at length because the clause LOOKS readable and both halves parse.

         The op dispatcher in `fxParse` files an `onLeave` payload into
         `fx.onLeave` and has NO branch for a condition riding with it —
         so the gate is silently DROPPED and the payload fires
         unconditionally. That is the COND-BYPASSED shape `npm run
         fairness` exists to catch, and **the sweep does not catch it**:
         its model looks for a condition gating an effect the engine ALSO
         grants unconditionally, and here the condition simply vanishes,
         leaving no unconditional twin to compare against.

         Found by building the `pitchBlue1` condition, which made Waning
         Vengeance's gate readable for the first time. Measured: it is the
         ONLY pool card printing a gated leave-trigger, so nothing was
         shipped wrong — this is a latent hole being closed before a card
         could fall into it.

         AND `fx.onLeave` HAS EXACTLY ONE CALLER: `tickSuspense`, for an
         aura whose SUSPENSE counters run out. Waning Vengeance prints no
         suspense and its Ward is a side-level pool rather than counters
         on the aura, so nothing in this engine can make it leave the
         arena at all. Reading the clause would file the card `full` with
         a dropped gate on a trigger that cannot fire — two ways wrong at
         once. Refusing leaves it `part`, which is the truth.

         The UNGATED wording is untouched: Booze!, Lyath's boo and the
         enters-or-leaves pair all still read. */
      if(rest.cond) return null;
      return Object.assign(rest, /\benters?\b/.test(cond) ? {onLeave:true, onEnter:true} : {onLeave:true});
    }
    /* ---- AN ALLY DYING IS AN EVENT (v3.46) ----------------------------
       Exactly ONE pool record prints a death trigger — Oysten, Heart of
       Gold, "When this dies, create a Gold token" — and it sat unread
       because until v3.44 no ally could attack and until v3.45 nothing
       decided what an attack on one meant. It is in the Gravy Bones deck,
       so it is reachable now rather than hypothetical.

       Tagged rather than run, exactly like `onHit` and `onLeave`, so the
       site that files the corpse fires it. */
    if(/^this dies$/.test(cond)) return Object.assign(rest,{onDeath:true});
    if(/^this hits a marked hero$/.test(cond)) return Object.assign(rest,{cond:"marked", onHit:true, heroOnly:true});
    /* ---- WHOSE HIT? (v3.45) --------------------------------------------
       CR 1.4.5 makes an ALLY an attack-target, so "hits" and "hits a HERO"
       stopped being the same event the moment an ally could be attacked.
       The pool partitions cleanly: 19 records print "hits a hero" (or
       "hits them", the same claim with the noun resolved) and 13 print a
       bare "when this hits" — Illuminate goes to the soul on ANY hit,
       Mauvrion Skies forges its Runechants on any hit.

       Driven before this existed: Infecting Shot's "When this hits a
       HERO, create a Bloodrot Pox token under their control" fired off a
       hit on Barnacle, an ALLY. Stronger than printed, live at the table,
       and invisible to every tool here — coverage counts the clause
       consumed and the fairness sweep does not model attack-targets. */
    if(/\bhits?\b/.test(cond))
      return Object.assign(rest,{onHit:true, heroOnly: /\bhits?\s+(?:a\s+)?(?:marked\s+)?hero\b|\bhits?\s+them\b/.test(cond)});
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
    /* ---- "…THIS WAY" IS THIS CARD'S OWN RESOLUTION (v3.60) ------------
       Not the turn's history: the phrase means "by the effect I just
       resolved". Seventeen pool cards print it and eight already read —
       each hand-built with its own condition name (`discard6way`,
       `chargedPitch`, the reveal ops). This is the first one to go
       through a shared per-resolution TRACE instead.

       THE `way:` PREFIX IS LOAD-BEARING. `execute` evaluates `fx.conds`
       BEFORE it runs `fx.ops`, so a condition asking what its own ops did
       is otherwise answered against an empty trace — always false, on
       every card. The prefix is what lets the condition loop skip these
       and a LATE pass pick them up after the ops have run. */
    /* "IF DAMAGE IS DEALT THIS WAY" (v3.62) — Path of Same Ends, asking
       whether the arcane its OWN preceding clause just dealt actually
       landed. CR 7.5.5: prevented is not dealt, and the trace is recorded
       where the damage lands so that rule governs it without restating. */
    if(/^damage is dealt this way$/.test(cond)) return Object.assign(rest,{cond:"way:dealt"});
    if(m=cond.match(/^an? (yellow|blue|red) card is discarded this way$/))
      return Object.assign(rest,{cond:"way:discardPitch" + ({red:1, yellow:2, blue:3})[m[1]]});
    if(/6 or more \{p\}[^.]*discard/.test(cond)) return Object.assign(rest,{cond:"discard6"});
    /* THE OTHER PRINTED ORDER (v3.58). Every other card in the pool says
       "a card WITH 6 or more {p} IS DISCARDED"; Mandible Claw says
       "you've DISCARDED a card WITH 6 or more {p} this turn" — the same
       turn-history question with the two halves swapped, which the
       pattern above cannot see. Measured: it is the only card printing
       this order that reaches the condition reader (Run Roughshod prints
       it too and goes through `fx.playIf` instead).

       ANCHORED ON 6, not on `\d+`, because `discard6` names its threshold
       in the cond itself — a "4 or more" card mapped here would be
       answered against the wrong number, which is the silent direction. */
    if(/discarded a card with 6 or more \{p\} this turn/.test(cond))
      return Object.assign(rest,{cond:"discard6"});
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
    /* THE OTHER DIRECTION (Arcane Polarity x3, v3.40) — "if you have BEEN
       DEALT arcane damage this turn". A different question from the line
       above and it needed a different record: `hist.arc` is what the
       DEALER did, `hist.arcTaken` what the hero SUFFERED. Reading this as
       `arcDealt` would pay Blaze for burning the opponent rather than for
       being burned, which is the card backwards. */
    if(/you have been dealt arcane damage this turn/.test(cond)) return Object.assign(rest,{cond:"arcTakenTurn"});
    /* RULING (auras): non-attack actions that stay in play — so "played or
       created an aura this turn" is a countable fact about the board. */
    if(/you'?(?:ve| have) played or created an aura this turn/.test(cond)) return Object.assign(rest,{cond:"auraTurn"});
    if(/you'?(?:ve| have) created a card this turn/.test(cond)) return Object.assign(rest,{cond:"madeCard"});
    /* RULING: being booed is a per-turn state other cards test for */
    if(/you'?(?:ve| have) been booed this turn/.test(cond)) return Object.assign(rest,{cond:"booed"});
    /* "IF YOU'VE PITCHED A BLUE CARD THIS TURN" (v3.57) — the Illusionist
       package's own condition, and it maps EXACTLY onto the `pitchBlue<N>`
       evaluator that has existed since High Tide.

       THE EQUIVALENCE IS THE CR, NOT AN APPROXIMATION. CR 4.4.3c sends
       the pitch zone to the bottom of the deck in the end phase, so
       during a turn that zone holds exactly the cards pitched THIS turn —
       "pitched a blue card this turn" and "a blue card is in your pitch
       zone" are the same question asked twice. That is why this reuses
       the existing evaluator rather than adding a `hist` field: a second
       record of one fact is a second thing to keep in step.

       IT IS A DIFFERENT QUESTION FROM `blue` BELOW, which asks what you
       PLAYED. Pitched and played are two ways to spend a card and a card
       does only one of them — v3.40's rule that two directions of one
       event are two records, here as two fates of one card. */
    /* "IF YOU'VE PLAYED A <CLASS> CARD THIS TURN" (v3.58) — Star Fall.
       `hist.playTy` (v3.38) is the structured type words of every card
       played this turn, so the class is CAPTURED off the card rather than
       listed here — the same discipline `playedAnotherCls` follows.

       It is deliberately WIDER than `blue`/`red` beside it: those ask
       about a pitch VALUE and say "another", where this asks about a
       class and does not exclude the card being played. Read as one of
       those the card would be wrong in both directions. */
    if(m=cond.match(/^you'?(?:ve| have) played an? ([a-z]+) card this turn$/))
      return Object.assign(rest,{cond:"playedCls:"+m[1]});
    if(/you'?(?:ve| have) pitched a blue card this turn/.test(cond)) return Object.assign(rest,{cond:"pitchBlue1"});
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
    /* "IF IT IS DEFENDED BY AN ATTACK ACTION CARD" (v3.91) — Agile
       Engagement, an attack REACTION, so "it" is the attack it targets
       rather than the reaction itself.

       THE CONDITION ALREADY EXISTS ONE ROUTE OVER. Boltyn's clause 1 asks
       the identical question of the wall (v3.74) and both boards already
       compute it for `linkPumps`; what was missing here is that
       `attackRx` was given the wall as a COUNT and not as CARDS — which
       v3.89 fixed for Shred. This is v3.47's rule: when you build a
       mechanic, sweep the refusals that were waiting on it.

       IT IS ANSWERED IN `attackRx`, not by the generic loop, because that
       loop is given no wall at all — the same reason `reprise` and
       `charged` are `RX_CONDS` (v3.89). */
    if(/^it is defended by an attack action card$/.test(cond))
      return Object.assign(rest,{cond:"defAtkAction"});
    if(/^you'?(?:ve| have) dealt damage this turn$/.test(cond))
      return Object.assign(rest,{cond:"dealtDmg"});
    /* "{p} greater than its base" — the pump is known once the total is struck.

       TWO PRINTED WORDINGS OF ONE SHAPE (v3.71). The pool spells it both
       ways at once: three Guardian attacks say "this HAS {p} greater than
       its base" and Bolt'n' Shot says "this CARD'S {p} IS greater than its
       base". Anchored to the first alone, Bolt'n' Shot read `tier: none`
       and its whole card — go again plus a granted "when this hits,
       reload" — was inert, while the identical condition worked three
       cards over. v3.65's rule, and v3.36's: the database prints both
       spellings simultaneously, so an anchor that knows one is a card
       waiting to be found.

       AND THE ANCHOR IS WRITTEN AGAINST THE LEVELLED TEXT, NOT THE PRINTED
       TEXT. `SYNONYMS` already rewrites "this card's" to "this's" before
       `classifyClause` sees a word of it, so a pattern spelling the printed
       form matches NOTHING and looks exactly like a pattern that is simply
       wrong. That table is the one place to check when a widening you have
       verified in isolation does not fire — v3.53 is the same lesson from
       the other end, where the lowercasing silently ate a printed NAME. */
    if(/^this(?: has|'s) \{p\} (?:is )?greater than its base$/.test(cond))
      return Object.assign(rest,{cond:"pumped"});
    if(/^it is blue$/.test(cond)) return Object.assign(rest,{cond:"revBlue"});
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
  /* "THE ATTACK" IS A THIRD SUBJECT, and it names the LIVE LAYER rather
     than the resolving card (v3.93). Refraction Bolters is an equipment
     WATCHER — "when a weapon attack you control hits, you may destroy
     this. If you do, THE ATTACK gets go again" — so "this" would be the
     iron and is exactly the wrong subject (v2.33, v3.47, v3.92: fourth
     time).

     `runOps`'s `ga` case sets `_gaGrant`, which folds onto the live
     `pend` — so on every route that can reach this clause the two
     readings coincide in their effect and differ in what they NAME.
     Measured across all 797 records: six print the phrase, and the three
     `atkTrigger` tokens (Blade Dance, Embodiment of Lightning, Quicken)
     have their whole clause claimed by that whole-card reader before
     this loop runs, so nothing there moves. */
  if(/^the attack (?:gains?|gets?|has) go again(?: this turn)?$/.test(c)) return R([["ga"]]);
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
  /* MELD (v3.34). The printed reminder text is the whole rule:

       Meld (You may play 1 or both halves of this card. Each costs 0.)

     A `noop` because the keyword grants nothing on its own — what it does
     is make "both" a legal DECLARATION, and that is asked before the card
     resolves (`judge.doSplit`, the trainer's `splitpick`) rather than
     resolved as a clause.

     ONLY HONEST NOW THAT THE CHOICE EXISTS. Filed before it, this would
     have been the no-op blind spot at its purest: the keyword counted as
     accounted for while the engine quietly played BOTH halves of every
     split card for free. It did exactly that until this version. */
  if(/^meld$/.test(c)) return NOOP("declared when the card is played — one half, the other, or both");
  /* THE SEPARATOR BETWEEN TWO TEXTBOXES is not a clause. It is how the
     database writes the cut down the middle of a horizontal card. */
  if(/^\/\/$/.test(c)) return NOOP("the cut between a split card's two halves");
  /* "CHOOSE 1;" IS A HEADING, NOT A CLAUSE (v3.33). The audit splits text
     on newlines and a modal header looks like a sentence, so Pummel and
     Two Sides to the Blade reported `part` with BOTH of their modes read.
     Same shape as Briar's "Essence of Earth and Lightning" and
     Iyslander's "Essence of Ice" — a line that names the thing below it.

     THIS IS ONLY HONEST BECAUSE THE MODES ARE BUILT. `fx.modes` carries
     them, `attackRx` picks one, and a mode whose restriction cannot be
     read is still refused (v3.12) — so the header genuinely does nothing
     on its own. Filed before the modes existed it would have been the
     no-op blind spot: a line counted as accounted for with the card's
     whole choice unbuilt. */
  if(/^choose \d+;?$/.test(c)) return NOOP("modal heading — the modes are the clauses below it");
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
  /* "THE NEXT TIME AN ATTACK YOU CONTROL HITS A HERO THIS TURN, DEAL N
     ARCANE DAMAGE TO THEM" — Burn Up (v3.34).

     A DELAYED TRIGGER, NOT DAMAGE. The whole prefix was being swallowed
     and the clause read as immediate arcane damage, so Burn Up dealt its
     4 the instant it was played — no attack, no hit, no condition. It is
     the unanchored-match shape v3.00 names, on a card that reads `part`
     so no coverage tool ever looked at it.

     IT RIDES ON `buffQ`, WITH NO POWER. That entry already means "the
     next attack that matches, with this rider attached", already waits
     rather than being spent by a card it does not name, and already
     expires with the turn. An amount of 0 is a rider and nothing else —
     which is exactly what this clause is. */
  if(m=c.match(/^the next time an attack you control hits a hero this turn, deal (\d+) arcane damage to them$/))
    return R([["buffNext", 0, null, {onHit: [["arcane", +m[1]]]}]]);

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
  /* plain (non-arcane) damage from an effect — "deal 2 damage to any target"

     A DAMAGE CLAUSE CAN NAME A SUBJECT, AND DROPPING IT IS THREE BUGS AT
     ONCE. This match is unanchored, so Danger Digits' "target dagger you
     control THAT ISN'T ON THE ACTIVE CHAIN LINK deals 1 damage to the
     defending hero" reads as a bare [["dmg",1]] from the EQUIPMENT — the
     chosen dagger, the "the dagger has hit" fiction and the printed
     "Destroy the dagger" all silently gone, and the last of those is a
     DRAWBACK. Measured over the pool: exactly two records print the
     third-person "deals", and Bloodrot Pox's subject is "it", which IS the
     resolving card. Everything else is imperative. So a third-person
     subject that is not this/it refuses — v3.00's unanchored-match rule,
     and the reason it matters here is that nothing reached this clause
     until the reaction-ability route did. */
  if(m=c.match(/(deals?) (\d+) damage to (?:any target|target hero|them|the other hero|the defending hero)/)){
    const subj = c.slice(0, m.index).trim();
    if(m[1] === "deals" && !/\b(this|it)$/.test(subj)) return null;
    return R([["dmg",+m[2]]]);
  }
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
  /* THE SAME BUG AS THE COMMENT ABOVE, ONE WORDING OVER (v3.60). The
     compound rules above cover a RANDOM discard; the non-random form had
     none, so the unanchored plain-draw rule below claimed the clause and
     returned the draw ALONE — Portside Exchange's "Discard a card, then
     draw a card" drew for free, and so did Gravy Bones' hero ability.
     A dropped drawback is strictly stronger than printed.

     THE ORDER IS OBSERVABLE, so it is read rather than normalised: which
     card you may discard depends on whether you have drawn yet, and the
     two printings genuinely differ. Both must also sit BEFORE the plain
     draw, which is what the comment above already says and is the whole
     reason that rule keeps biting.

     `random` cannot leak in here: these patterns require the count word
     to be followed immediately by "card", and the random wording puts
     "random" between the two. */
  if(m=c.match(/^draws? (a|an|one|two|three|\d+) cards?,? (?:then |and (?:then )?)discards? (a|an|one|two|three|\d+) cards?$/))
    return R([["draw",num(m[1])],["selfDiscard",num(m[2])]]);
  if(m=c.match(/^discards? (a|an|one|two|three|\d+) cards?,? (?:then |and (?:then )?)draws? (a|an|one|two|three|\d+) cards?$/))
    return R([["selfDiscard",num(m[1])],["draw",num(m[2])]]);
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
    const rider = quotedRider(c);
    return rider ? R([head], {riderOnHit: rider.ops, riderHeroOnly: rider.heroOnly}) : R([head]);
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
    const ro = quotedRider(c);
    const rider = ro ? (ro.heroOnly ? {onHitHero: ro.ops} : {onHit: ro.ops}) : null;
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
    /* AND THE "ATTACK" ANCHOR IS A RESTRICTION TOO (v3.43), symmetric with
       the `non-attack` unpicking directly above. `gaNextQ` is the ONE
       grant in this family with a NON-attack taker (v3.31 added it for
       Mage Master Boots), so it is the one whose qualifier has to be able
       to say "an attack" — its three siblings are attack-only by where
       they are read, which is why Yo Ho Ho! prints the identical "Pirate
       ally attack" phrase into `buffQ` and is safe.

       Two of the six pool grants carried NOTHING that excluded a
       non-attack: Avast Ye! and Hit and Run. Avast Ye! was live — playing
       any of the six Pirate allies in its own deck ate the grant, since
       an ally card is an `Action - Ally` and matches "pirate ally" on the
       type line. Hit and Run escaped only because a powCard carries no
       type line for `{g:[["weapon"]]}` to match: an accident, not a rule.
       Both read `tier: full`. */
    else if(full) full = Object.assign({}, full, {atk: true});
    /* An unqualified grant stays the bare op it has always been — and the
       bare boolean is spent in the attack branch alone, so it needs no
       atom to say what it already cannot reach. */
    const o=[full ? ["gaNext", full] : ["gaNext"]];
    const rn = c.match(/create (a|an|one|two|three|\d+) runechants?/);
    if(rn) o.push(["runeHitNext", num(rn[1])]);
    /* A GRANTED ABILITY CAN RIDE WITH GO AGAIN TOO (v3.42) — Avast Ye!:
       "Your next Pirate ally attack this turn gets go again and \"When
       this hits a hero, create a Gold token.\"" The quoted half parsed
       fine — `quotedOnHit` is the one reader every other shape in this
       family already shares — and was simply never asked here, so the
       rider was dropped even though a reader exists for it. That is the
       one card v3.41's `fx.quotedUnread` flag cannot see: it asks "is
       there a reader", and there is.

       MUTUALLY EXCLUSIVE WITH THE RUNECHANT COUNT ABOVE. Mauvrion Skies'
       rider is already read, by name, into `runeHitNext` — asking
       `quotedOnHit` there too would mint the same runechants twice. Only
       a QUALIFIED grant carries a rider: `gaNext`'s bare boolean form has
       no side field to hold one, and no pool card needs it to. */
    if(!rn && full){
      const ro = quotedRider(c);
      if(ro) o[0] = ["gaNext", full, ro.heroOnly ? {onHitHero: ro.ops} : {onHit: ro.ops}];
    }
    return R(o);
  }
  /* "YOU MAY PLAY YOUR NEXT <x> THIS TURN AS THOUGH IT WERE AN INSTANT"
     — Stir the Aetherwinds, and the FOURTH qualified single-shot grant
     beside `buffQ` (power), `gaNextQ` (go again) and `costOff` (cost).

     It reuses `attackQual` and the `non-attack` unpicking verbatim from
     the go-again reader above, which is the third time this family has
     been extended without inventing vocabulary. The same trap applies:
     "action card" in the tail belongs to the SUBJECT, so on the
     non-attack reading it must not also set `aac` — a card cannot be
     both an attack action card and a non-attack one, and asking for both
     is a qualifier that matches nothing.

     UNQUALIFIED IS REFUSED, not defaulted to "any card". No pool card
     prints that wording, and a grant that frees EVERY card at instant
     speed is the strongest thing on this list to get wrong. */
  if(m = c.match(/^you may play (?:your|the) next([^.]*?)\b(non-attack|attack)\b([^.]*?)\s*as though (?:it|they) (?:were|was) an instant$/)){
    const q = attackQual(m[1], m[3]);
    if(!q) return null;
    let full = Object.assign({}, q);
    if(m[2] === "non-attack"){ delete full.aac; full.nonAtk = true; }
    return R([["instantNext", full]]);
  }
  /* "YOUR NEXT <x> THIS TURN CAN'T BE DEFENDED BY MORE THAN N <kind>
     CARDS" — Confidence, and the FIFTH qualified single-shot grant beside
     `buffQ` (power), `gaNextQ` (go again), `costOff` (cost) and
     `instantNextQ` (the window). Same `attackQual` tail reader, same
     "waits rather than being spent" rule; building it invented no
     vocabulary, which is the fourth time that has been true here.

     THE COUNTED SET IS READ OFF THE LINE, never assumed. Confidence
     prints "non-block cards" and Block is a TYPE (`types.js`: Test of
     Might, Test of Strength, On the Horizon, Crash and Bash), so a
     declared piece of EQUIPMENT is a non-block card and counts. That is
     the literal reading and it is stronger for the attacker than counting
     hand cards alone — which is exactly why it is read off the printed
     word rather than defaulted to dominate's set.

     DOMINATE IS NOT THIS OP. The database prints no reminder text for any
     keyword (which is why the ruling file exists), and this project's
     recorded reading of dominate is "the defender is limited to 1 card
     from hand". Two caps, two counted sets, one reader — `parser.defCap`
     is where they meet. */
  if(m = c.match(/^the next([^.]*?)\battack\b([^.]*?) can'?t be defended by more than (\d+) (non-block|non-equipment) cards?$/)){
    const q = attackQual(m[1], m[2]);
    if(q === false) return null;          /* an unreadable tail refuses the whole clause */
    return R([["defCapNext", +m[3], Object.assign({}, q || {}),
               m[4] === "non-block" ? "nonBlock" : "hand"]]);
  }
  if(m=c.match(/(?:^|this(?: attack)? |it )(?:gains?|gets?|has) \+(\d+)\s*(?:\{p\}|power)/)) return R([["self",+m[1]]]);
  if(m=c.match(/\bamp (\d+)/)) return R([["amp",+m[1]]]);
  if(m=c.match(/create (a|an|\d+|one|two|three) runechants?/)) return R([["rune",num(m[1])]]);
  /* RULING: opt X — look at the top X, then put them back on top or bottom
     in any order. The trainer reorders by advisor value and says so. */
  /* ---- TAPPING A HERO (v3.48) ---------------------------------------
     RULING (user, 2026-08-25): "Tapping a hero doesn't mean much on its
     own — when tapped it mainly means it cannot be tapped again to pay a
     cost. The tapping mechanism was added in later sets and older heroes
     are often unaffected by being tapped."

     So the op sets ONE state and nothing else. The narrowness is the
     ruling, not a shortcut: inventing a defence or speed penalty for a
     tapped hero would be the golden rule broken at the keyword level, and
     the ruling says in as many words that most heroes are unaffected.

     "THEM AND ALL ALLIES THEY CONTROL" is one printed sentence naming two
     targets, so it is one op with a flag rather than two clauses — and
     the ally half is what the card is FOR now that allies tap to attack
     (v3.44): a tapped ally cannot swing. */
  if(/^(?:you may )?\{t\} (?:target hero|them)$/.test(c)) return R([["tapFoeHero",1]]);
  if(/^(?:you may )?\{t\} them and all allies they control$/.test(c))
    return R([["tapFoeHero",1,{allies:true}]]);
  if(/^(?:you may )?\{t\} your hero$/.test(c)) return R([["tapSelfHero",1]]);
  /* ---- UNTAP, AND WHY IT ONLY MEANS SOMETHING NOW (v3.47) -----------
     "{u} target ally you control" — Scuttle Toes, Gravy Bones' Legs.
     `{u}` was flagged "not parsed" in the ledger for as long as the flag
     has existed, and REFUSING it was right the whole time: until v3.44
     allies did not tap, so untapping one bought nothing and reading it
     would have been a card doing nothing dressed as a card that works.
     Now `{t}` is what an ally spends to attack, so an untap buys a second
     attack — and it is the ally's ONLY way to swing twice in a turn.

     The scope is the printed one: an ally, controlled by YOU. Widening it
     to any permanent would hand a weapon a second swing, which is the
     Sledge/Scorpio distinction (v2.46) undone from the other end. */
  if(/^\{u\} target ally you control$/.test(c)) return R([["untapAlly",1]]);
  if(m=c.match(/^opt (\d+|x)\b/)) return R([["opt", m[1]==="x"?1:+m[1]]]);
  /* "LOOK AT THE TOP N CARDS OF YOUR DECK, THEN PUT THEM BACK IN ANY
     ORDER" — Spire Sniping, and it is NOT opt (v3.71).

     Opt lets you send cards to the BOTTOM; this only reorders the top. So
     reading it as `opt` is wrong in both directions at once — stronger,
     because a card could be buried, and it would also fire Blaze's
     "whenever you OPT" energy trigger off a card that does not opt.

     A CARD DOES NOT OPT BECAUSE IT LOOKS. The keyword is a keyword; the
     printed sentence is a different effect that happens to start the same
     way, which is why `lookOrder` is its own op rather than a flag on the
     other one.

     Anchored on "of YOUR deck" and on the put-back half: three other pool
     records print "look at the top card" — On the Horizon (a bare reveal)
     and Scout the Periphery x3 (TARGET HERO's deck) — and none of them
     reorders anything. */
  if(m=c.match(/^look at the top (\d+|a|one|two|three) cards? of your deck,? then put (?:them|it) back in any order$/))
    return R([["lookOrder", {a:1, one:1, two:2, three:3}[m[1]] || +m[1]]]);
  /* RULING (Ravenous Rabble): reveal the top card, then the attack shifts by
     that card's PITCH — red 1, yellow 2, blue 3. The reveal itself is
     information both players see; the maths is what the engine needs. */
  if(/^reveal the top card of your deck$/.test(c)) return R([["reveal",1]]);
  /* looking is private where revealing is public, but for the trainer both
     just put the top card in front of you. */
  if(/^look at the top card of (?:your|target hero'?s?) deck$/.test(c)) return R([["reveal",1]]);
  if(m=c.match(/this gets ([+-])x\s*\{p\}, where x is the pitch value of the card revealed/))
    return R([["revPitch", m[1]==="-" ? -1 : 1]]);
  /* THE SAME REVEAL, A DIFFERENT CONSUMER (v3.68). Three pool records
     print "X is the pitch value of the card revealed this way": the two
     Rabbles spend it on the attack's power (`revPitch`, above) and Throw
     Caution to the Wind spends it on a PREVENTION.

     NO X MACHINERY IS NEEDED, which is v3.39's rule about Blaze: X here
     is not a free variable the player chooses, it is settled by the card
     the reveal turns up. The reveal op runs first and leaves `n.revealed`
     on the state; this reads it. Two names because they feed two
     different pools — folding them into one op would make the consumer a
     parameter of a card's text, which is exactly what `revPitch` and
     `revColorPitch` already stay apart to avoid.

     NO RIDER HERE. `ward`'s third element carries Toe the Line's "if you
     prevent damage this way" (v3.67); measured, no pool card prints a
     rider on the revealed-X form, so claiming one would be parsing ahead
     of wiring. */
  if(/^the next time you would be dealt damage this turn, prevent x of that damage, where x is the pitch value of the card revealed/.test(c))
    return R([["revWard", 1]]);
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
  if(m=c.match(RX_FOE_TOP)){
    const filter = pickSubject(cased(RX_FOE_TOP, 1, m[1]));
    if(!filter) return null;
    return R([["foePick", {zone:"hand", to:"deckTop", filter,
      title:"Put one of their cards on top of their deck",
      hint:"It leaves their hand and becomes the next card they draw."}]]);
  }
  /* THE SAME CROSS-SEAT SHAPE, READING A ZONE BOTH PLAYERS CAN SEE (Pass
     Over): "banish target card from an opposing hero's graveyard". The
     CHOICE is the caster's — the card says "banish target", not "they
     banish" — and the card is in the other seat's zone, which is exactly
     what `foePick` is: candidates from over there, chosen here, moved
     there.

     IT IS THE SAME OP AS BRAIN FREEZE'S, deliberately. A `foePickBanish`
     beside a `foePickTop` would be two bodies for one shape, and the
     lesson this project keeps paying for is that the second one drifts
     (v3.41's matcher written twice, v3.50's guard without its sibling).
     The zone and the destination are DATA on the op.

     `pickSubject` rather than `optFilter`, because the printed subject is
     a bare "card" — genuinely unrestricted, and `optFilter` refuses that
     for the cost readers it serves. */
  if(m=c.match(RX_FOE_GY)){
    const filter = pickSubject(cased(RX_FOE_GY, 1, m[1]));
    if(!filter) return null;
    return R([["foePick", {zone:"grave", to:"banish", filter,
      title:"Banish a card from their graveyard",
      hint:"Their graveyard is public — this removes it from the game."}]]);
  }
  /* RETRIEVE (Memorial Ground): a MANDATORY target pick from the graveyard
     back onto the deck — reads the subject the same way optFilter already
     does for optional-cost riders, and refuses (returns null, leaving the
     card unclaimed) on anything it cannot read honestly, same discipline.
     min:1 makes the prompts.js `pick` mandatory rather than a decline-able
     optional cost. Written generically (zone/to are data, not hardcoded to
     this one card) so a future "put target X from your Y on top of your
     deck" reuses it rather than growing its own op. */
  /* THE DESTINATION IS THE PRINTED HALF THAT VARIES, so it is read rather
     than fixed: Memorial Ground says "on top", Preserve Tradition says "on
     the bottom". Written as one reader because they are one sentence with
     one word different — two readers here is the drift this file names on
     nearly every page. */
  if(m=c.match(RX_GY_DECK)){
    const filter = pickSubject(cased(RX_GY_DECK, 1, m[1]));
    if(!filter) return null;
    const top = m[2] === "top";
    return R([["pickPrompt", {zone:"grave", to: top ? "deckTop" : "deckBottom",
      filter, min:1, max:1,
      title:"Put a card from your graveyard on " + (top ? "top" : "the bottom") + " of your deck"}]]);
  }
  /* RETURNING FROM THE GRAVEYARD TO HAND — the same pick with a third
     destination, and the "you may" is what makes it OPTIONAL rather than a
     second shape. `min` carries that: 1 for a printed "return target …",
     0 for "you may return …", which is what gives prompts.js its "Choose
     none" button and stops a mandatory sheet appearing for a card that
     printed a choice.

     BECKONING HAUNT REFUSES HERE AND THAT IS CORRECT. It prints "return
     target aura WITH COST X from your graveyard to your hand" against an
     {x}{x}{r} cost; `optFilter` cannot consume "with cost x", so the whole
     subject fails to read and the clause stays unclaimed. Reading it as a
     bare "aura" would drop a printed restriction — the v3.31 shape, and
     the direction that steals games. X-costs are refused across this
     engine on purpose (Ice Eternal); this is that refusal arriving through
     the subject reader rather than as a special case. */
  if(m=c.match(RX_GY_HAND)){
    const filter = pickSubject(cased(RX_GY_HAND, 2, m[2]));
    if(!filter) return null;
    const may = !!m[1];
    return R([["pickPrompt", {zone:"grave", to:"hand", filter,
      min: may ? 0 : 1, max:1,
      title: may ? "Return a card from your graveyard to your hand?"
                 : "Return a card from your graveyard to your hand",
      hint: may ? "Optional — choose none to decline." : undefined}]]);
  }
  /* "THIS ENTERS THE ARENA WITH A +1{p} COUNTER" (v3.57) — the same
     counter vocabulary as `ctrPut`, aimed at the card itself as it
     lands. Waxing Specter prints it behind "if you've pitched a blue card
     this turn", so it arrives here as a GATED op and `execute`'s
     condition loop is what decides whether it runs — which is why it is
     an op rather than an `fx` field: a field would land unconditionally
     and the printed gate would be decoration.

     IT IS STASHED, NOT APPLIED, exactly as `selfDestruct` is. The card is
     not on the board when the op runs, so the op records the intent and
     the board-placement site stamps it — the pattern `_selfDestruct` and
     the suspense counters already follow. */
  /* A READER THAT CANNOT READ ITS OWN MATCH MUST NOT CONSUME THE CLAUSE.
     `CTR_KINDS` is tested in the GUARD, not in the body: written as a
     match-then-refuse this rule swallowed Malefic Incantation's "this
     enters the arena with 3 VERSE counters" — a kind it does not know —
     and returned null, which killed a clause an existing verse reader
     further down was already handling. The card went `full` -> `part`
     and `coverage.test.js`'s pinned baseline is what caught it.

     Falling through keeps BOTH properties: an unknown kind still refuses
     if nothing else claims the clause (classifyClause returns null at the
     end), and a reader that does know the shape still gets its turn. */
  if((m=c.match(/^this enters the arena with (a|an|one|two|three|four|five|six|\d+) ([a-z+{}0-9-]+) counters?$/))
     && CTR_KINDS[m[2]]){
    const kind = CTR_KINDS[m[2]];
    const cn = CTR_WORDS[m[1]] != null ? CTR_WORDS[m[1]] : parseInt(m[1], 10);
    if(cn > 0) return R([["ctrSelf", {kind, n:cn, label:m[2]}]]);
  }
  /* A TARGETED COUNTER PUT (v3.53) — "put a steam counter on a Hyper
     Driver you control", "put three +1{p} counters on target aura with
     ward you control".

     `counters` has been a per-side map keyed by uid for a long time and
     `aim` was the one worked example of putting one on a chosen object.
     This is the general form: a KIND, an AMOUNT and a TARGET read from a
     printed filter, with the choice offered when more than one permanent
     qualifies.

     BOTH NUMBERS COME OFF THE LINE. Astral Etchings prints three / two /
     one across its three pitches, so a hardcoded amount would be right
     for one printing and silently wrong for the other two — the same
     reason `rustDestroy` reads its threshold (v3.17) and Thunder Quake's
     heave reads both of its (v3.32).

     "YOU CONTROL" IS CONSUMED, and it is the one phrase that may be:
     the op is actor-relative and searches the ACTOR's own permanents, so
     the words restate what the target zone already says. v3.18 settled
     exactly this for `optFilter`'s destroy costs. Everything else in the
     subject still has to be read whole, so "target aura with ward" keeps
     its ward and an unreadable subject refuses the clause.

     WHAT THIS DELIBERATELY DOES NOT CLOSE: Crankshaft and Big Bertha
     print the same payload behind *"when this is banished from
     boosting"*, and no such trigger exists. The when-handler's trigger
     vocabulary is CLOSED, so those clauses still refuse as a whole and
     the two cards stay `part` — a payload that parses with no schedule to
     fire on is the one shape `failstates.js` cannot see (v3.07), and it
     is avoided here by the wrapper refusing rather than by anything this
     reader does. */
  /* THE KIND IS TESTED IN THE GUARD, for the reason spelled out at
     `ctrSelf` below: a match-then-refuse steals the clause from any
     reader further down that DOES know the shape. */
  /* SHARPEN — AND THE PRINTED CARD IS THE ORACLE FOR A KEYWORD, FOURTH
     TIME (v3.66). The database carries no reminder text for any keyword,
     and the ruling recorded 2026-07-25 said "ADD +1 ATTACK POWER COUNTER
     … AT END OF TURN, REMOVE ALL +1 ATTACK POWER COUNTERS". The MPW103
     printing of Edict of Steel prints it in parentheses and is more
     precise than the ruling in the way that matters:

       Sharpen target sword you control. (Put a +1{p} counter on it.
       REMOVE ALL +1{p} COUNTERS FROM IT at end of turn.)

     All of them, and only from IT — so a sword sharpened after Glisten
     has distributed counters loses those too. Clash of Agility, Thunder
     Quake, Pick Up the Point and now this: reading the printing is the
     FIRST thing to try, not the last.

     IT IS `ctrPut`, NOT NEW MACHINERY (v3.58's rule). The kind is `pow`,
     which is the printed spelling `+1{p}` already maps to; the candidate
     scan already covers the board AND the gear, which is where a sword
     lives; and the pick sheet already exists for two or more. What the
     keyword adds is the WIPE, which rides on the spec because it belongs
     to the sharpen rather than to the sword — the sword's own text says
     nothing about it, which is exactly why `idleCounterWipes` (whose
     predicate is the PIECE's printed line) cannot answer for it. */
  if(m = c.match(/^sharpen (.+)$/)){
    let subj = String(cased(/^sharpen (.+)$/, 1, m[1]) || "").trim()
                 .replace(/\s+you control\b/i, " ")
                 .replace(/^target\s+/i, "")
                 .replace(/\s+/g, " ").trim();
    const filter = pickSubject(subj);
    if(!filter) return null;
    return R([["ctrPut", {kind:"pow", n:1, filter, label:"+1{p}", wipeEnd:true}]]);
  }
  if((m=c.match(RX_CTR_PUT)) && CTR_KINDS[m[2]]){
    const kind = CTR_KINDS[m[2]];
    const n = CTR_WORDS[m[1]] != null ? CTR_WORDS[m[1]] : parseInt(m[1], 10);
    if(!(n > 0)) return null;
    /* the SUBJECT keeps its printed capitalisation — "a Hyper Driver" is
       a NAME, and `optFilter`'s name branch is anchored on a proper noun */
    let subj = String(cased(RX_CTR_PUT, 3, m[3]) || "").trim()
                 .replace(/\s+you control\b/i, " ")
                 .replace(/^target\s+/i, "")
                 .replace(/\s+/g, " ").trim();
    const filter = pickSubject(subj);
    if(!filter) return null;
    return R([["ctrPut", {kind, n, filter, label:m[2]}]]);
  }
  /* RETRIEVE — and THE PRINTED CARD IS THE ORACLE FOR A KEYWORD (v3.32),
     for the third time. The database carries no reminder text for any
     keyword and upstream's own `keyword.json` lists Retrieve with an
     EMPTY description, so this looked like a question that had to be
     booked. The SAR017 printing of Pick Up the Point answers it in
     parentheses:

       "When this attacks, you may retrieve a dagger from your graveyard.
        (Pay {r} to equip it.)"

     So retrieve is a graveyard pick whose price is {r} and whose
     destination is the GEAR zone — it comes back equipped, not to hand.
     That matches the recorded ruling (user, 2026-07-25) exactly, which
     said a player "will need to pitch if they do not have 1 resource to
     be consumed" and never named the destination.

     IT NEEDED THE GEAR ZONE TO REACH THE GRAVEYARD FIRST. Until v3.53 a
     destroyed piece was flagged in place and filed nowhere, so the pool's
     only daggers could never be in a graveyard and this reader would have
     been a card that does nothing. RULING (user, 2026-08-29) moved them;
     see `effects.sweepGear`. Mark of the Huntsman destroys ITSELF to
     mark, which is the loop these two cards are printed for.

     THE SUBJECT IS AN EQUIPMENT SUBTYPE, and it is read off the printed
     TYPE LINE rather than guessed — `optFilter` is tried first so a
     retrieve that ever named a subject it already knows keeps one reader,
     and only a single bare word falls through to the subtype branch. A
     word is either consumed whole or the clause refuses, same discipline
     as everywhere else: "a dagger with cost 1 or less" fails the
     single-word test and stays unclaimed rather than dropping the limit. */
  if(m=c.match(RX_RETRIEVE)){
    const raw2 = String(cased(RX_RETRIEVE, 2, m[2]) || "").trim();
    const may  = !!m[1];
    let filter = pickSubject(raw2);
    if(!filter){
      const sub = raw2.replace(/^(?:a|an|one)\s+/i, "");
      if(!/^[A-Za-z][A-Za-z-]*$/.test(sub)) return null;
      filter = {tt: "\\b" + sub.toLowerCase() + "\\b"};
    }
    return R([["pickPrompt", {zone:"grave", to:"gear", filter,
      min: may ? 0 : 1, max:1,
      /* THE PRICE IS THE KEYWORD'S, off the printed reminder text. */
      cost:1, equipStamp:true,
      title:"Retrieve from your graveyard?",
      hint:"Pay {r} to equip it."}]]);
  }
  /* ---- BANISH-FOR-COUNTERS, AND PLAY IT AT INSTANT SPEED (v3.39) ----
     Blaze's hero ability, whose cost is "Remove X energy counters":

       "Banish a Wizard non-attack action card from your hand with an
        effect that deals arcane damage equal to X. You may play it this
        turn as though it were an instant."

     X IS NOT A FREE VARIABLE. The player picks a card and X is that
     card's OWN arcane damage, so the amount is settled by the choice —
     which is why this needs no X-cost machinery and why the filter, not
     a number prompt, is where the coupling lives. The QUEUE SITE bounds
     it by the counters actually held (`arcLe`), the same way `notUid` is
     supplied there for `notSelf` (v3.20): a bound that depends on the
     game cannot come from a memoized parse.

     THE SUBJECT MUST BE CONSUMED WHOLE, as everywhere `optFilter` is
     used — an unreadable subject refuses the clause and leaves the card
     unclaimed rather than banishing something the text never named. */
  if(m=c.match(/^banish (.+?) from your hand with an effect that deals arcane damage equal to x$/)){
    const filter = staticFilter(optFilter(m[1]));
    if(!filter) return null;
    /* `arcGe:1` is the printed "WITH an effect that deals arcane damage":
       a card the engine cannot count arcane on is not a legal choice,
       because that number is the COST. */
    return R([["pickPrompt", {zone:"hand", to:"banish",
      filter: Object.assign({}, filter, {arcGe: 1}),
      min:0, max:1, ctrSpend:"energy", playThisTurn:true,
      title:"Banish a card — it costs its own arcane in energy"}]]);
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
  /* "WITH {p} GREATER THAN ITS BASE" IS NOT A FIELD — it is a fact about
     the OPEN LINK, so it joins `from` and `boosted` as an atom the caller
     answers. Four pool records print the phrase; the two TRAPS
     (Den of the Spider, Inertia Trap) ask it of the attack they defend and
     have their own `defPumped` condition, and these two ask it of the
     attack they are buffing: Bolt'n Boots and Boltyn. `pumped` is already
     the name of that question in `linkPumps`, so this reuses it rather
     than inventing a second word for one fact. */
  if(m = t.match(/^with \{p\} greater than (?:its|their) base/)){
    f.pumped = true; t = t.slice(m[0].length).trim(); }
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
  if(qual.pumped)  post.push("with {p} above its base");
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
  /* THE CALLER'S ANSWER, and an absent one is NO. Only the site holding the
     open link can compare a total against a base, and a reaction that
     buffed an unpumped attack would be stronger than printed. */
  if(qual.pumped && !opts.pumped) return false;
  /* IS THIS PLAY AN ATTACK AT ALL? (v3.43) The printed word "attack" is the
     ANCHOR the readers below match on, not a captured atom, so until now no
     qualifier could say it — and `qualLabel` was already claiming it out
     loud ("a pirate ally attack") while nothing tested it. One namer, one
     matcher, and they disagreed.

     IT IS THE CALLER'S ANSWER, never re-derived here. `isAttack` reads the
     type line and a WEAPON's line carries no "Attack" at all, so deriving
     it would refuse every weapon swing — Hit and Run's whole card.
     `execute` already decides this once (`isAttack(card) || from ===
     "weapon"`) to pick its branch, and hands the verdict down. A caller
     that does not say answers NO: weaker than printed and visible, the
     same direction `defendValue` takes with an absent condition. */
  if(qual.atk && !opts.atk) return false;
  return true;
}

/* The subjects a leading CLASS word may qualify. Kept beside `optFilter`
   as one list so the "try the whole phrase first" rule and the fallback
   cannot drift apart about what counts as a subject. */
const CLS_SUBJECTS = /^(?:non-attack action cards?|attack action cards?|action cards?)$/;
/* The printed weapon subtypes the pool names as a TARGET. Closed on
   purpose — see `optFilter`. */
const WPN_SUBTYPES = /^(?:swords?|daggers?)$/;

/* A FILTER WHOSE BOUND ONLY ONE QUEUE SITE CAN RESOLVE (v3.92).
   `costLtDrac` is supplied by the `hits` optional-cost site out of the
   live chain; every OTHER consumer of `optFilter` has no such site, so a
   subject carrying it must leave those cards unclaimed exactly as it did
   before v3.92. Refusing there is weaker than printed and visible;
   admitting it is the sev-3 "illegal play allowed" the original refusal
   was protecting against. */
const staticFilter = f => (f && f.costLtDrac) ? null : f;

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
  /* A DYNAMIC BOUND — "with cost less than the number of DRACONIC CHAIN
     LINKS you control" (v3.92). v2.29 REFUSED this outright and wrote
     down why: no printed field expresses it, and a loose substring test
     that read "attack action card" and dropped the limit made any attack
     in hand a legal banish — sev-3 "illegal play allowed", the direction
     that steals games.

     THE REFUSAL STOPPED BEING RIGHT AT v3.86, when `parser.dracLinks`
     was built for Fai's discount. A recorded refusal is a debt (v3.38),
     and what discharges it is usually somewhere else entirely (v3.47).

     THE BOUND IS NOT IN THE PARSE. `fxParse` memoizes on `name|pitch`, so
     one parse serves every copy in a match and a number stored here
     freezes at whatever the chain was the first time it was read — the
     same rule `notSelf` follows for its uid (v3.20) and `arcAmount` for
     Blaze's X (v3.39). `costLtDrac` says WHICH count, and the QUEUE SITE
     supplies it as `costLe`.

     A FILTER THAT NEVER RECEIVES ONE ADMITS NOTHING, for `notSelf`'s
     reason: offering a card the printed limit excludes is stronger than
     printed; offering none is weaker and visible. */
  const dm = rest.match(/\s*\bwith cost less than the number of draconic chain links you control\b/i);
  if(dm){ f.costLtDrac = true; rest = (rest.slice(0, dm.index) + " " + rest.slice(dm.index + dm[0].length)).trim(); }
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

  /* "WITH <KEYWORD>" IS A PRINTED FIELD, NOT FREE TEXT (v3.33). This
     phrase was REFUSED while nothing could answer it honestly — the pin
     read "a rules-text qualifier; promptFilter reads fields only" — and
     `printedKw` answers it precisely: does the card CARRY the keyword as
     printed rules text. `hasKw` is deliberately loose and would offer a
     card that merely NAMES crush in a sentence, which is why the loose
     one stays the wrong predicate. Same call v3.31 made for stealth.

     THE KEYWORD MUST BE ONE THE ENGINE KNOWS. An unrecognised word after
     "with" is still a dynamic or rules-text limit and still refuses —
     widening this to any word would re-open exactly the hole the pin was
     protecting. */
  /* `ward` JOINED THE LIST AT v3.53, and the blast radius was measured
     rather than reasoned about (v3.33): exactly THREE pool cards print
     "with ward" — Astral Etchings and Uphold Tradition, which are the two
     the counter reader exists for, and Cosmo, whose clause is a different
     shape entirely. A keyword the engine already carries, on a phrase
     almost nothing prints. */
  const km = rest.match(/\s*\bwith (crush|stealth|dominate|go again|piercing|intimidate|blade break|battleworn|temper|guardwell|phantasm|reprise|boost|ward)\b/i);
  if(km){ f.kw = km[1].toLowerCase(); rest = (rest.slice(0, km.index) + " " + rest.slice(km.index + km[0].length)).trim(); }

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
  let low = rest.toLowerCase();
  /* A LEADING CLASS WORD (v3.39) — "a WIZARD non-attack action card".
     Consumed here and added to `ty`, which now takes a LIST so the class
     and the type are asked TOGETHER: asking "action" alone offers a
     Runeblade action and asking "wizard" alone offers a Wizard attack.

     Only ever consumed when what REMAINS is a subject this reader
     already knows — the whole phrase must still be consumed, so an
     unreadable remainder refuses as it always did rather than being
     rescued by dropping the class. */
  /* THE WHOLE PHRASE IS TRIED FIRST, and the class prefix only if that
     fails. Ordered the other way "ATTACK ACTION CARD" splits as class
     "attack" plus "action card" — a subject the reader already knows,
     read as two things it is not. Three drills caught it, which is the
     whole-phrase discipline doing its job on a change to itself. */
  let cls = null;
  if(!CLS_SUBJECTS.test(low)){
    const cm2 = low.match(/^([a-z]+) (.+)$/);
    if(cm2 && CLS_SUBJECTS.test(cm2[2])){ cls = cm2[1]; low = cm2[2]; }
  }
  const withCls = (o) => { if(cls) o.ty = [cls].concat(o.ty ? [].concat(o.ty) : []); return o; };
  if(/^auras?$/.test(low))                { f.tt = "aura";     return f; }
  /* A PRINTED WEAPON SUBTYPE (v3.66) — "target SWORD you control". It is
     read off `tt`, where the database keeps the subtype ("Warrior Weapon
     - Sword (2H)"), and the vocabulary is CLOSED for the same reason
     `CTR_KINDS` and the keyword list are: an open "any word before
     `you control`" would claim every dynamic or rules-text subject this
     reader exists to refuse.

     MEASURED BEFORE ADDING IT (v3.33's rule): across the whole pool the
     printed subjects of this shape are "sword" (Edict of Steel), "dagger"
     (Danger Digits) and "ally" (Scuttle Toes, which has its own reader).
     So this claims exactly one live card and one that refuses earlier for
     its own reasons — no cost or pick anywhere else changes answer. */
  if(WPN_SUBTYPES.test(low))              { f.tt = low.replace(/s$/, ""); return f; }
  if(/^attack action cards?$/.test(low))  { f.type = "attack"; return withCls(f); }
  /* "A NON-ATTACK ACTION CARD" — the pair, off the STRUCTURED array. An
     attack action card carries Action AND Attack, so excluding Attack is
     what makes this non-attack; a Defense Reaction carries no Action at
     all and is correctly left out (v3.23's subject rule). */
  if(/^non-attack action cards?$/.test(low)){ f.ty = "action"; f.type = "nonAttack"; return withCls(f); }
  /* "AN ACTION CARD" — read off the STRUCTURED type array, never `tt`.
     The display string calls Den of the Spider and Lair of the Spider
     "Action Defense Reaction" and both are in this pool, so a `tt` read
     would offer a defence reaction as an action card. An attack action IS
     an action card, which is why this is a wider filter than the line
     above rather than a rival to it. */
  if(/^action cards?$/.test(low))         { f.ty = "action";   return withCls(f); }
  if(/^yellow cards?$/.test(low))         { f.pitch = 2;       return f; }
  if(/^blue cards?$/.test(low))           { f.pitch = 3;       return f; }
  if(/^red cards?$/.test(low))            { f.pitch = 1;       return f; }
  /* A BARE "CARD", but ONLY behind a printed KEYWORD. Crash and Bash
     reveals "a card with crush", and once the keyword is consumed the
     subject really is any card carrying it.

     NARROWED TO `kw` ON PURPOSE. "A card with cost 0" is equally
     readable in principle and NO POOL CARD PRINTS IT, so claiming it
     would be parsing ahead of wiring — the rule that exists because
     reading a clause raises a card's tier and makes the audit say it
     works. Widen this when a card asks for it. */
  if(/^cards?$/.test(low) && f.kw) return f;
  /* A NAMED card — "a Nimblism", "a Phoenix Flame". Only when what remains
     is a bare proper noun, so "a card" never becomes a name filter. */
  if(/^[A-Z][A-Za-z'\-]*(?: [A-Z][A-Za-z'\-]*)*$/.test(rest) && !/^cards?$/i.test(rest)){
    f.name = "^" + rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
    return f;
  }
  return null;
}

/* THE SUBJECT OF A ZONE PICK — `optFilter`'s question with exactly ONE
   printed phrase added, and the narrowness is the point.

   `optFilter` REFUSES a bare "card" unless a keyword follows it, and that
   refusal is correct where it lives: its callers read the subject of a
   COST ("banish an attack action card from your hand"), and a cost whose
   subject the reader cannot pin is a cost a player could pay wrongly.

   A ZONE PICK asks a different question. Pass Over prints "banish target
   CARD from an opposing hero's graveyard" — the subject genuinely is any
   card in that zone, so an empty filter is the FAITHFUL reading rather
   than a widened guess. Everything else defers to `optFilter`, so there is
   still one subject reader and the two cannot drift about what "an aura"
   or "an action card" means.

   THE WIDENING IS DELIBERATELY NOT IN `optFilter` ITSELF, and the blast
   radius was measured rather than reasoned about (v3.33's rule). A bare
   "card" subject appears **19 times across 11 pool cards**, and most of
   them are COSTS on hero abilities — Boltyn's and Blasmophet's charges,
   Nasreth's banish, Azalea's put. Widening `optFilter` would claim every
   one of them for readers nobody has wired, which is the "never parse
   ahead of wiring" rule: reading a clause raises a card's tier and makes
   the audit say it works. Only the pick sites ask this question, so only
   the pick sites get the answer. */
function pickSubject(phrase){
  const rest = String(phrase||"").trim().replace(/^(?:a|an|one)\s+/i, "");
  if(/^cards?$/i.test(rest)) return {};
  /* AND A DYNAMIC BOUND IS REFUSED HERE (v3.92). Every `pickPrompt` site
     goes through this reader and none of them has a queue site that can
     resolve `costLtDrac` against the live chain — so those cards stay
     unclaimed exactly as they were before v3.92, which is the property
     the original refusal was protecting. */
  return staticFilter(optFilter(phrase));
}

/* THE ARSENAL FACE-UP PUT (v2.34). Two shapes that must be read together,
   because the second one's subject is defined by the first: a card that puts
   an arrow face up into the arsenal, and a rider whose "it" is that ARROW.
   Kept as named constants so the clause router and the whole-card reader
   below cannot drift apart on what counts as the stamp. */
const ARS_PUT   = /put an? [a-z ]+?(?: card)? (?:from your hand )?face.?up into your arsenal/i;
/* The three printed sentences of Azalea's cycle. Anchored whole, because
   an unanchored "put a card from your arsenal" would claim Iyslander's
   "play blue non-attack action cards FROM YOUR ARSENAL" — the only other
   pool record that prints the phrase. */
/* THE FINAL CLAUSE KEEPS ITS PERIOD. v3.45 stopped the splitter eating the
   trailing `.` (treating end-of-string as a break lost it), so the LAST
   sentence of a card arrives with the dot still attached and every earlier
   one arrives without. Azalea's grant is not her last sentence — "Go again"
   is — so an anchor that forgot this matched HER and would have refused the
   same wording on a card that ends with it. Found by a synthetic fixture,
   which is the only thing that could tell the two apart. */
const CYC_BOTTOM = /^put a card from your arsenal on the bottom of your deck\.?$/i;
const CYC_PUT    = /^if you do, put the top card of your deck face.?up into your arsenal\.?$/i;
/* Bravo, Flattering Showman: "Turn a face-down card in your arsenal face-up." */
const ARS_TURN   = /^turn a face.?down card in your arsenal face.?up\.?$/i;

/* ---- WHAT THE ARSENAL CARD GAINS (v3.72) ----------------------------
   TWO HEROES PRINT THE SAME SENTENCE ABOUT DIFFERENT SUBJECTS:

     Azalea  "If it's an ARROW,   it gets dominate until end of turn."
     Bravo   "If it HAS CRUSH,    it gets +2{p} and dominate this turn."

   One is a TYPE test and the other a KEYWORD test; the payload is a
   power stamp, a keyword stamp, or both. So it is one matcher with a
   discriminator rather than two nearly-identical regexes — the second
   copy is where the drift starts (v3.41's `quotedText`, written twice,
   where sabotaging one copy left the other correct).

   "UNTIL END OF TURN" AND "THIS TURN" ARE THE SAME DURATION in the CR,
   and both spellings are in the pool; `_upTurn` carries either.

   IT IS MATCHED ON THE LEVELLED CLAUSE. A whole-card reader scans
   `fx.clauses` RAW, so `SYNONYMS` has not reached it — and `it's` is
   levelled to `it is` (v3.36), which the database already prints both
   ways. An anchor spelling only the contraction works today and dies the
   moment upstream levels the other way. */
const ARS_GRANT = /^if it (?:is an?|(has)) ([a-z]+), it (?:gets?|gains?) (.+?)(?:\s+(?:until end of turn|this turn))?\.?$/;
/* THE GRANT VOCABULARY IS CLOSED, for the reason v3.55 gives about
   counter kinds: a keyword nothing consumes is a no-op wearing a name,
   and filing the card `full` for it is the blind spot at its purest.
   `dominate` is the one keyword an arsenal stamp can be spent on —
   `parser.defCap` is its single reader. */
const ARS_GRANT_KW = /^dominate$/;
function arsGrant(rawClause){
  const m = levelIdiom(String(rawClause||"").toLowerCase()).match(ARS_GRANT);
  if(!m) return null;
  const g = {ifTt: m[1] ? null : m[2], ifKw: m[1] ? m[2] : null, pow: 0, kw: []};
  /* The payload is a list: "+2{p} and dominate", "dominate", "+2{p}". */
  for(const part of m[3].split(/\s+and\s+/)){
    const pm = part.trim().match(/^\+(\d+)\s*\{p\}$/);
    if(pm){ g.pow += +pm[1]; continue; }
    if(ARS_GRANT_KW.test(part.trim())){ g.kw.push(part.trim()); continue; }
    return null;      /* an unreadable half refuses the whole grant (v2.29) */
  }
  return (g.pow || g.kw.length) ? g : null;
}
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
  ["arsenalPut","arsenalUp","addCost","addPay","playIf","activateIf","defLimit",
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
    self:0, ops:[], onHit:[], onHitHero:[], onAtkHero:[], onDeath:[], conds:[], clauses:[], perm:null, dr:isDR(card), approx:false, defDebuff:null, millCost:null, tapCost:null};
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
  /* ---- THE SPLITTER DOES NOT CUT INSIDE A QUOTE (v3.45) --------------
     FaB prints a granted ability in QUOTES precisely to delimit it, and
     splitting on ". " cut straight through one — leaving clause 1 holding
     an UNTERMINATED quote, so `quotedText` found no closing mark and the
     payload fell to the loose matchers instead. Driven, that made Loot
     the Hold discard a card ON PLAY (no attack, no ally, no hit) and Loot
     the Arsenal mint its Gold token unconditionally, dropping the destroy
     it is printed to pay for. Both read `tier: part`, so no coverage tool
     was looking.

     Only a quoted span with a sentence break inside it is affected — the
     other 26 quoted riders in the pool are single sentences and split
     identically either way. */
  const splitSentences = seg => {
    const out = []; let buf = "", q = null;
    for(let i = 0; i < seg.length; i++){
      const ch = seg[i];
      if(q){ if(ch === q) q = null; }
      else if(ch === '"' || ch === "\u201c"){ q = ch === "\u201c" ? "\u201d" : ch; }
      /* A TRAILING period is not a sentence BREAK. The rule this replaces
         was `split(/\.\s+/)`, which needs real whitespace after the dot —
         treating end-of-string as a break silently ate the final "." and
         a drill pinning an override's exact clause text caught it. */
      else if(ch === "." && seg[i+1] !== undefined && /\s/.test(seg[i+1])){ out.push(buf); buf = ""; continue; }
      buf += ch;
    }
    if(buf.trim()) out.push(buf);
    return out;
  };
  let clauses = (card.tx||"").split(/\n+/).map(seg=>clean(seg)).filter(Boolean)
    .reduce((acc,seg)=>acc.concat(splitSentences(seg)),[]).map(s=>s.trim()).filter(Boolean);
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

  /* ---- A TURN-SCOPED DEFENCE GRANT (v3.78) — Lyath's clause 2 rider ---
     "Defending action cards you control get +1{d} this turn."

     THE TWIN ABOVE IS A BOARD STATIC AND THIS IS A GRANT, and the
     difference is the whole reason it is a separate op rather than a
     second `defGrant` subject. Briar's Embodiment sits in the arena and
     `defendValue` finds it by walking the board every time it is asked;
     Lyath's is fired by an ACTIVATED ability, applies to cards that are
     nowhere near the board when it fires, and expires with the turn. A
     board walk cannot see it and a grant cannot be re-derived.

     THE SUBJECT IS "ACTION CARDS" — both halves, which is `isActionCard`
     and NOT the complement of the twin's subject: a Defense Reaction
     carries no Action at all, so `!isNonAtkActionCard` would hand the
     buff to a whole type the line never names.

     IT IS NOT SPENT BY THE FIRST DEFENDER. "This turn" is a window, not
     a charge — every action card he declares this turn gets it, and a
     grant consumed by the first block is weaker than printed. */
  for(let ci = 0; ci < clauses.length; ci++){
    const lg = clauses[ci].match(
      /^defending action cards you control get \+(\d+)\{d\} this turn\.?$/i);
    if(!lg) continue;
    fx.ops.push(["defActBuff", +lg[1]]);
    handled.add(ci);
    break;
  }

  /* ---- A STANDING ATTACK GRANT, WITH A WINDOW (v3.87) ----------------
     "Your attacks with stealth get +1{p} this turn."        Night's Embrace
     "Your attacks this combat chain get +1{p} for each …"   V of the Vanguard

     IT IS NOT `buffQ`, AND GETTING THAT BACKWARDS IS WRONG IN BOTH
     DIRECTIONS. `buffQ` grants "your NEXT attack" and is SPENT by the
     card it lands on; this applies to EVERY matching attack inside its
     window and is never spent. A standing grant consumed by the first
     swing is weaker than printed; a single-shot grant left standing is
     stronger. Same distinction v3.30 draws between a debuff and a
     restriction, one grant over.

     THE WINDOW IS READ OFF THE PRINTED WORDS, never defaulted. The pool
     prints both — "this turn" expires at the controller's end phase,
     "this combat chain" at the close step — and defaulting either way
     changes how long a real card's bonus lasts.

     THE QUALIFIER IS `attackQual`'s, so this invents no vocabulary: the
     same tail reader the four single-shot grants use (v3.31, v3.37), and
     an unreadable tail REFUSES the whole clause rather than granting to
     everything. `qualMatches` is the one matcher.

     MEASURED BEFORE IT WAS BUILT: exactly two pool cards print the shape,
     and the audit read Night's Embrace `none` and V of the Vanguard
     `part`. Neither could be seen by the fairness sweep — both are WEAKER
     than printed, which is the direction it is built not to look in. */
  for(let ci = 0; ci < clauses.length; ci++){
    const ag = clauses[ci].match(
      /^your (.*?)attacks?( .+?)? gets? \+(\d+)\{p\} (this turn|this combat chain)\.?$/i);
    if(!ag) continue;
    /* TWO ARGUMENTS, BECAUSE THE PRINTED RESTRICTION CAN SIT ON EITHER
       SIDE OF THE WORD (v3.31): "your ARROW attacks" is a leading class
       group and "your attacks WITH STEALTH" is a tail. `attackQual` is
       the one reader of both, so nothing here re-derives either. */
    const q = attackQual(ag[1] || "", ag[2] || "");
    /* `false` means "a restriction I cannot read", which is a DIFFERENT
       answer from `null` ("nothing restricts this") — collapsing the two
       is how v3.31's bug shipped, and `qualMatches` answers TRUE for a
       falsy qualifier, so a `false` reaching it grants to everything. */
    if(q === false) continue;
    fx.ops.push(["atkBuff", +ag[3], q || null,
                 /this turn/i.test(ag[4]) ? "turn" : "chain"]);
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
    /* "IF THE ADDITIONAL COST IS PAID, THIS GETS +N{d}" — Staunch Response.
       The answer belongs to the PLAY, not to the card: by the time the
       wall asks, the payment is long settled. Same split as `fromArsenal`
       and, one layer up, the same split `heroHit` keeps. */
    if(!ds){
      m = cl.match(/^if the additional cost is paid, (?:this|it) gets \+(\d+)\{d\}\.?$/i);
      if(m) ds = {amt: +m[1], when: "addCostPaid"};
    }
    if(!ds) continue;
    fx.defSelf = ds;
    handled.add(ci);
    break;
  }

  /* ---- "AS THOUGH IT WERE AN INSTANT" — A SPEED GRANT (v3.36) --------
     14 pool records print one and NOT ONE OF THEM WAS READ, across three
     heroes — Iyslander, Blaze and Enigma. It is Iyslander's whole
     identity: both clauses of her hero ability are about acting on the
     opponent's turn, and this is the half that lets her.

     WHAT THE GRANT CHANGES IS THE WINDOW, AND THE ACTION POINT WITH IT.
     RULING (user, 2026-08-10), recorded in the trainer since v2.71: "as
     though they were an instant" is more than dropping the action point —
     an instant may be played ANY TIME the player has priority, where an
     action is confined to its own action phase. The action point is
     deliberately never charged (CR 8.1.6), and the reductio is that it
     could not be: a seat holds no action point during the opponent's turn
     (CR 4.4.3e takes it, CR 4.3.2 issues the next one at the start of
     their OWN action phase), so a grant that still charged one would be a
     grant that can never once be used.

     IT IS A CARD FACT, NOT AN OP — nothing resolves. So it is read here
     beside `defSelf` and answered at the PLAY site by `playsAsInstant`,
     which is pure and takes the game's half from its caller, exactly as
     `playableFromZone` does. `handled` counts the clause as consumed so
     the audit stops reporting it unread.

     AN UNREADABLE CONDITION IS LEFT UNREAD, not defaulted. `asInstantMet`
     answers FALSE for a `when` it does not know (v3.26's rule), so a
     condition added here and forgotten there confines the card to its
     printed window — weaker than printed and visible. The other direction
     opens an instant-speed window nobody built. */
  for(let ci = 0; ci < clauses.length; ci++){
    const cl = clauses[ci];
    /* The subject is THIS card. Iyslander's hero line grants over a ZONE
       ("blue non-attack action cards from your arsenal") and is a build
       passive rather than a clause; Stir the Aetherwinds grants to a
       FUTURE card and is a different shape again — see `instantNextQ`. */
    const m = cl.match(
      /^(?:if (.+?), )?you may play this as though it were an instant\.?$/i);
    if(!m) continue;
    const when = asInstantCond(m[1]);
    if(!when) continue;          /* unreadable gate — the clause stays unread */
    fx.asInstant = when;
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
  /* A FIXED WORDING IS NOT A FIXED SHAPE (v3.65). v3.22 built this reader
     for the one printed SUBJECT it found and never asked which others the
     pool prints. Three more tokens print the identical shape with a
     different subject and read `tier: none` — they do nothing at all:

       Blade Dance   "when you ACTIVATE A WEAPON ATTACK, destroy this and
                      the attack gets go again"          (no play half)
       Flurry        same trigger, "…and you may attack with the weapon
                      twice this turn"
       Eloquence     "when you play a NON-ATTACK action card, destroy this
                      and the card gets go again"

     So the trigger carries `on`, a list of ROUTES read off the printed
     subject, rather than v3.22's single `weaponToo` boolean. Same rule as
     v3.60's draw-and-discard matcher one level up: when you anchor a
     reader to a wording, ask which other printed wordings of that shape
     it still has to reach.

     AN ALLY ATTACK IS NEITHER (v3.44). `weaponToo || from !== "weapon"`
     answered TRUE for `from === "ally"`, so an ally's activated attack
     popped every one of these as though an attack action card had been
     played. Latent rather than live — measured across all fifteen decks,
     none holds both a minter and an attacking ally — but the route has
     existed since v3.44 and the routes are named now. */
  for(let ci = 0; ci < clauses.length; ci++){
    const cl = clauses[ci];
    const m = cl.match(
      /^when you (?:play an? (attack|non-attack) action card( or activate a weapon attack)?|activate a weapon attack), destroy (?:this|it) and (.+)$/i);
    if(!m) continue;
    const on = !m[1] ? ["weapon"]
             : m[1].toLowerCase() === "non-attack" ? ["nonAtk"]
             : (m[2] ? ["atk", "weapon"] : ["atk"]);
    const tail = m[3].trim().replace(/\.$/, "");
    let ops = null;
    /* "THE ATTACK" and "THE CARD" name the same thing on their own route —
       the object just played or activated — so they share an op. Read off
       the printed word all the same: a token whose trigger is a non-attack
       cannot say "the attack", and one whose trigger is an attack cannot
       say "the card". */
    const subj = on[0] === "nonAtk" ? "card" : "attack";
    if(new RegExp("^the " + subj + " (?:gains?|gets?|has) go again$", "i").test(tail)) ops = [["ga"]];
    else {
      const pm = tail.match(/^the attack (?:gains?|gets?|has) \+(\d+)\{p\}$/i);
      if(pm) ops = [["pump", +pm[1]]];
      else {
        const am = tail.match(/^deal (\d+) arcane damage to target opposing hero$/i);
        if(am) ops = [["arcane", +am[1]]];
        /* FLURRY'S PAYLOAD IS A MECHANIC THIS ENGINE ALREADY HAS.
           Dorinthea's hero ability is "you may attack an additional time
           with that weapon this turn", and `weaponRefresh` models it by
           lifting the weapon's Once-per-Turn allowance and nothing else.
           "Twice this turn" counts the activation that TRIGGERED this, so
           one extra swing is the whole of it. Before building machinery
           for a shape, check whether the machinery is the shape you
           already have (v3.58). */
        else if(/^you may attack with the weapon twice this turn$/i.test(tail)) ops = [["wpnAgain"]];
      }
    }
    if(!ops) continue;                    /* unreadable payload — do not claim it */
    fx.atkTrigger = {on, ops};
    /* MARK IT CONSUMED, because it is WIRED. Rule 2 forbids parsing ahead
       of wiring — reading a clause raises the card's tier and makes the
       audit claim it works — and the other side of that rule is that a
       clause which really is built must stop reporting as unread. All
       four of these tokens read `tier: none` while Runechant was the only
       one that did anything. */
    handled.add(ci);
    break;                                /* one such trigger per card in the pool */
  }

  /* ---- "WHEN THIS IS DESTROYED, …" (v3.58) --------------------------
     ONE READER REPLACING AN INLINE ONE. The phantasm pop site in
     `effects.js` has read this trigger since v3.01 — with its own regex
     over the card's raw text, which is the cached-card-fact shape v3.22
     names ("the pop asks each token's own printed line instead"). The
     clause therefore fired correctly and still reported UNREAD, so
     Phantasmal Haze sat at `part` with a mechanic that works: the same
     under-reporting Call in the Big Guns had at v3.53.

     Measured before replacing it: the inline regex matches exactly one
     pool card (Phantasmal Haze, three printings), so this reader is an
     exact swap rather than a widening.

     HELD OFF `fx.ops`, like every other schedule. Phantasmal Haze is an
     ATTACK card — left in `ops` the token would be minted every time the
     card was PLAYED, which is the v3.07 shape. The payload goes back
     through `classifyClause`, and an unreadable one refuses. */
  for(let ci = 0; ci < clauses.length; ci++){
    if(handled.has(ci)) continue;
    const dm = clauses[ci].match(/^when this is destroyed, (.+)$/i);
    if(!dm) continue;
    const sub = classifyClause(dm[1]);
    if(!sub || sub.status !== "run" || !sub.ops || !sub.ops.length) continue;
    /* a gated destroy payload would need the condition carried too, and
       no pool card prints one — refuse rather than dropping the gate,
       the call v3.57 made for the leave-trigger. */
    if(sub.cond) continue;
    fx.onDestroy = sub.ops;
    handled.add(ci);
    break;
  }

  /* ---- "WHEN THIS IS BANISHED FROM BOOSTING, …" (v3.56) -------------
     Boost banishes the top card of your deck to pay for the card you are
     playing — so this trigger fires from the DECK, on a card its
     controller never played. Three pool records print it (Crankshaft at
     two pitches, Big Bertha), all with the same payload, and that payload
     has read correctly since v3.55: what was missing was the SCHEDULE.

     IT IS HELD OFF `fx.ops`, WHICH IS THE WHOLE POINT. Crankshaft is an
     attack card; left in `ops` its steam counter would land every time
     the card was PLAYED, which is v3.07's suspense bug — a printed delay
     collected as a bonus. `fx.boostBanish` is read at the one site that
     banishes a card for boosting.

     THE PAYLOAD GOES BACK THROUGH `classifyClause`, so it shares every
     reader rather than growing its own vocabulary, and AN UNREADABLE
     PAYLOAD REFUSES — the clause stays unclaimed and the card stays
     `part`, rather than the trigger firing a guess (v2.29's rule, and
     `atkTrigger` above makes the same call one shape over). */
  for(let ci = 0; ci < clauses.length; ci++){
    if(handled.has(ci)) continue;
    const bm = clauses[ci].match(/^when this is banished from boosting, (.+)$/i);
    if(!bm) continue;
    const sub = classifyClause(bm[1]);
    if(!sub || sub.status !== "run" || !sub.ops || !sub.ops.length) continue;
    /* a CONDITIONAL payload would need the gate carried too, and no pool
       card prints one — refuse rather than dropping the condition. */
    if(sub.cond) continue;
    fx.boostBanish = sub.ops;
    handled.add(ci);
    break;
  }

  /* ---- CLASH, AS A READING RATHER THAN A REGEX IN ONE BOARD (v3.94)

     "When this defends, clash with the attacking hero. The winner creates
      a Might token."                            — six pool records
     "…If you win, this gets +1{d} until end of turn." — STONEWALL IMPASSE
     "When you win a clash revealing this, deal 1 damage to the other
      hero."                                     — UNEXPECTED BACKHAND

     ALL SEVEN READ `tier: full` AND THE MECHANIC EXISTED ON ONE BOARD.
     `index.html` had 31 mentions of clash, `judge.js` had ONE and it is a
     COMMENT — the very comment recording that clash once fired on the
     wrong trigger for five versions. Every clash clause was filed `noop`
     with a reason naming "the clash block", which is a reader in the
     trainer: the no-op blind spot at its purest, and v3.16's rule
     (a noop must describe the clause in front of it, never a sibling)
     one board over.

     A WHOLE-CARD READER, because the trigger and the payoff arrive as
     separate clauses — the splitter breaks on the period, which is the
     same reason `optCost` and `atkTrigger` are paired here.

     THE TOKEN NAME KEEPS ITS PRINTED CAPITALISATION (v3.53, v3.33): the
     clause loop works on lowercased text and `resolveEntry` answers the
     ENTRY's name, so a lowercased capture puts "might" on the board.
     Matched on the LEVELLED clause and captured from the RAW one, which
     is the split v3.53 had to make for `optFilter`'s named subject.

     THE WINDOW IS READ OFF THE PRINTED WORDS (v3.87). Stonewall Impasse
     says "until end of turn" and `defMod` is chain-scoped, so a bonus
     filed without its window is weaker than printed the moment a second
     chain opens the same turn. */
  for(let ci = 0; ci < clauses.length; ci++){
    if(handled.has(ci)) continue;
    if(!/^when this defends, clash with the attacking hero$/i.test(levelIdiom(clauses[ci]).trim().replace(/\.$/, ""))) continue;
    const cl = {token: null, defBuff: null};
    /* the payoff, if there is one, is the NEXT clause */
    const nx = clauses[ci + 1] == null ? "" : String(clauses[ci + 1]).trim().replace(/\.$/, "");
    const tm = nx.match(/^the winner creates? (?:a|an|\d+) ([A-Za-z' -]+?) tokens?$/i);
    const dm = nx.match(/^if you win, this gets \+(\d+)\s*\{d\}( until end of turn)?$/i);
    if(tm) cl.token = tm[1].trim();
    else if(dm) cl.defBuff = {amt: +dm[1], until: dm[2] ? "turn" : "chain"};
    /* AN UNREADABLE PAYOFF REFUSES THE WHOLE THING (v2.29). A clash with
       no reward is a reveal that decides nothing, filed `full`. */
    if(!cl.token && !cl.defBuff) continue;
    fx.clash = cl;
    handled.add(ci); handled.add(ci + 1);
    break;
  }

  /* THE REVEALED CARD'S OWN PAYOFF (v3.94). It fires when this card is the
     one turned up on a winning clash — an event that happens to a card in
     the DECK, so it can never be an op on resolution. Held off `fx.ops`
     for `boostBanish`'s reason one schedule over. */
  for(let ci = 0; ci < clauses.length; ci++){
    if(handled.has(ci)) continue;
    const rm = String(clauses[ci]).trim().replace(/\.$/, "")
      .match(/^when you win a clash revealing this, deal (\d+) damage to the other hero$/i);
    if(!rm) continue;
    fx.clashReveal = {dmg: +rm[1]};
    handled.add(ci);
    break;
  }

  /* ---- AN AURA THAT IS A WEAPON (v3.84) — Cosmo's whole static -------
     A WHOLE-CARD READER, because the two sentences are one mechanic and
     the second names the first ("your AURA ATTACKS"): read a clause at a
     time, the go-again rider is a bare grant with no attack to attach to.

     CREDITED ONLY IF THE GRANT ACTUALLY READS, which is v3.63's rule —
     `auraWeaponGrant` refuses a quoted ability `weaponCost` cannot parse,
     and crediting a clause whose reader declined is the no-op blind spot.
     The route is built on both boards (`parser.auraAttackOf`, judge's
     arena branch, `execute`'s `from: "aura"`), so this is a real credit
     rather than a `noop`. */
  { const g = auraWeaponGrant(card);
    if(g){
      fx.auraWeapon = g;
      for(let ci = 0; ci < clauses.length; ci++){
        if(handled.has(ci)) continue;
        const t = clauses[ci].toLowerCase();
        if(/auras you control with ward are weapons/.test(t)
           || (g.gaWithCounters && /your aura attacks with one or more/.test(t)))
          handled.add(ci);
      }
    } }

  for(let i = 0; i < clauses.length - 1; i++){
    const rider = clauses[i+1];
    if(!/^if you do\b/i.test(rider)) continue;
    const cm = clauses[i].match(
      /^(?:when(?:ever)? (this attacks|this defends|this hits|this enters or leaves the arena|you play an aura),\s*)?you may (banish|discard|destroy|reveal) (.+)$/i);
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
    /* A REVEAL IS AN INFORMATION COST (v3.33). The card is SHOWN and stays
       exactly where it was — nothing is spent, so the "cost" is that both
       players now know you hold it. That makes it the one member of this
       family with no destination, which is why `to` is omitted rather
       than defaulted: `prompts.js` already treats a pick with no `to` as
       a reveal that moves nothing. Its natural zone is the hand, because
       revealing from anywhere public is not a cost at all. */
    if(cm[2].toLowerCase() === "reveal") zone = zone || "hand";
    /* NOT end-anchored: "an attack action card from your hand with cost 2
       or less" puts the zone in the MIDDLE. Anchoring it missed that and
       silently fell back to the wrong zone — banishing from the graveyard
       a card the text says comes from hand. */
    const zm = subject.match(/\s*\bfrom your (graveyard|hand)\b/i);
    if(zm){ zone = zm[1].toLowerCase(); subject = (subject.slice(0, zm.index) + " " + subject.slice(zm.index + zm[0].length)).trim(); }
    const filter = optFilter(subject);
    if(!filter) continue;                       /* unreadable cost — do not claim the card */
    /* "IT" IS THE BANISHED CARD, NOT THE ATTACKER (v3.92). v2.29 pinned
       this and refused both cards for it: "in both, 'it' is the banished
       card, not the attacker, so the existing `self` op is the wrong op
       for either."

       Left to `classifyClause`, "it gets +1{p}" comes back as
       `[["self",1]]` — a pump on the CARD BEING RESOLVED, which is the
       attack that just hit. That is v2.33's Bull's Eye Bracers trap and
       v3.47's Scuttle Toes, a third time.

       SO THE RIDER IS A STAMP ON THE CARD THAT MOVED, not ops: the same
       shape `arsStamp` (v2.34) and `untapStamp` (v3.47) already take, and
       for the same reason — this module runs no effects, so returning it
       as ops hands it to `runOps`, which applies it to the SOURCE.

       "AND YOU MAY PLAY IT THIS TURN" IS `playThisTurn`, built for
       Blaze's banish (v3.39) and read by `playsAsInstant`. */
    const _rid = rider.replace(/^if you do,?\s*/i, "").trim().replace(/\.$/, "");
    /* FaB PRINTS gains / gets / has, AND EVERY ANCHOR MUST ACCEPT ALL
       THREE (v2.12, and v3.10 records what a missing alternation costs:
       it does not drop the rule, it RELOCATES it into a loose matcher
       below). The pool prints "gets" here; a drill's synthetic printing
       "gains" is what found the gap. */
    const _bp = _rid.match(/^it (?:gains?|gets?|has) \+(\d+)\{p\} and you may play it this turn$/i);
    const _bc = _rid.match(/^it costs ((?:\{r\})+|\d+) less to play and you may play it this turn$/i);
    if(_bp || _bc){
      const filter2 = filter;
      fx.optCost = {
        trigger: cm[1] ? cm[1].toLowerCase().replace(/^this /,"")
                              .replace(/^enters or leaves the arena$/,"entersLeaves")
                              .replace(/^you play an aura$/,"playAura") : "play",
        kind: cm[2].toLowerCase(),
        zone: zone || (cm[2].toLowerCase() === "discard" ? "hand" : "grave"),
        filter: filter2,
        ops: [],
        /* DATA THE ANSWER APPLIES TO THE CARD THAT MOVED. */
        banStamp: Object.assign({playThisTurn: true},
          _bp ? {pow: +_bp[1]}
              : {costOff: /^\d+$/.test(_bc[1]) ? +_bc[1] : (_bc[1].match(/\{r\}/g)||[]).length})
      };
      if(fx.optCost.zone === "graveyard") fx.optCost.zone = "grave";
      handled.add(i); handled.add(i+1);
      continue;
    }
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
    /* "YOU MAY {t} THIS AND PAY {r}" — Magmatic Carapace (v3.33). The tap
       is part of the cost, not decoration: a tapped permanent does not
       untap until its controller's untap step (CR 4.4.3d), which is what
       makes this once per turn without the card printing "Once per Turn".
       Reading only the {r} would make it repeatable and strictly stronger
       than printed — the same shape as Scorpio vs the Sledge (v2.42). */
    /* ---- THE THIRD COST VERB: DESTROY THIS (v3.93) -----------------
       "Whenever you discard a random card with 6 or more {p}, YOU MAY
        DESTROY THIS. If you do, gain 1 action point."   — BEATEN TRACKERS
       "When a weapon attack you control hits, YOU MAY DESTROY THIS. If
        you do, the attack gets go again."          — REFRACTION BOLTERS

       Exactly two pool records print it, and both are Legs equipment
       watching an event that happens somewhere else — so the piece is a
       WATCHER, never the resolving card (v3.33's Magmatic Carapace,
       v3.72's Crow's Nest).

       IT IS `payCost`'s SHAPE WITH A DIFFERENT PRICE, not new machinery
       (v3.58): a trigger, an optional cost, and a rider that resolves
       only if the cost was paid. What changes is the verb, so the cost is
       0 resources and `destroySelf` says what is actually spent.

       THE TRIGGER VOCABULARY IS CLOSED. An unknown one refuses the whole
       clause and leaves the card unclaimed — the alternative is a piece
       destroyed by an event nobody built, which is the never-parse-ahead-
       of-wiring rule at its most literal, since the cost here DESTROYS
       the player's equipment.

       AND THE THRESHOLD IS THE CARD'S OWN NUMBER. Beaten Trackers prints
       6 and is the pool's only card of the shape, so a hardcoded 6 is
       indistinguishable from a read one against every pool fixture — the
       inline reader this replaces did exactly that, matching `\d+` in its
       regex and then testing `pow6`, a literal. A synthetic printing 8 is
       what sees it (v3.32, tenth outing). */
    const dm = clauses[i].match(/^when(?:ever)? (.+?), you may destroy this$/i);
    if(dm){
      const trig = destroyTrigger(dm[1]);
      if(!trig) continue;                        /* unknown event — leave the card unclaimed */
      const rr2 = classifyClause(rider.replace(/^if you do,?\s*/i, ""));
      /* AN UNREADABLE PAYLOAD REFUSES (v2.29) — AND SO DOES A `noop` ONE.
         `classifyClause` answers `{status:"noop", ops:[["noop", …]]}` for
         a keyword it reads and deliberately does nothing about, so
         `ops.length` is 1 and the length test alone lets it through: the
         piece is DESTROYED for a reward nothing delivers. That is v2.04's
         free-ability rule read from the other end — a cost with no reward
         — and it matters most on this verb, where the price is a
         permanent rather than resources.

         Measured over the pool: NO record's optCost or payCost rider is
         nothing but noops, so this is a guard for a shape only a
         synthetic can reach, and the drill for it uses one. A fixture
         whose rider `classifyClause` answers NULL for never reaches the
         status test at all — third time that flaw has cost a drill. */
      if(!rr2 || rr2.status !== "run" || !rr2.ops || !rr2.ops.length) continue;
      fx.payCost = Object.assign({cost: 0, taps: false, destroySelf: true, ops: rr2.ops}, trig);
      handled.add(i); handled.add(i+1);
      break;
    }
    const cm = clauses[i].match(/^(?:when(?:ever)? (this attacks|this defends|this hits|you play an aura),\s*)?you may (\{t\} this and )?pay ((?:\{r\})+|\d+)$/i);
    if(!cm) continue;
    const rr = classifyClause(rider.replace(/^if you do,?\s*/i, ""));
    if(!rr || !rr.ops || !rr.ops.length) continue;   /* unreadable payload — do not claim the card */
    const cost = /^\d+$/.test(cm[3]) ? +cm[3] : (cm[3].match(/\{r\}/g)||[]).length;
    fx.payCost = {
      trigger: cm[1] ? cm[1].toLowerCase().replace(/^this /,"").replace(/^you play an aura$/,"playAura") : "play",
      cost,
      taps: !!cm[2],
      ops: rr.ops
    };
    handled.add(i); handled.add(i+1);
    break;                                       /* one pay-cost rider per card in the pool */
  }

  /* Does this card print a MODAL choice? Asked once, off the whole text,
     because a single mode line cannot tell you it is one of several. */
  const modal = /\bchoose \d/i.test(clean(card.tx||"").toLowerCase());
  /* Does this clause carry a quoted granted ability the reader dropped?
     Asked of the SAME matcher `quotedOnHit` uses — see the note below and
     at that function. Hoisted above the loop because BOTH exits need it:
     a clause consumed by a dedicated reader (`handled`) took an early
     return that pushed `run` without ever asking, which is how Avast Ye!
     kept reporting `full` after the other three were fixed. */
  /* ---- A HERO TAP AS AN OPTIONAL COST (v3.91) ----------------------
     "Deal 5 arcane damage to any target. If this deals damage, you may
      {t} your hero. If you do, create a Ponder token."
                                                   — TURN TO MINDFIRE

     THE POOL'S ONLY ONE, measured — so it is a NAMED shape rather than a
     widening of `optCost`, which is the never-parse-ahead-of-wiring rule.

     BOTH HALVES ALREADY EXISTED AND NEITHER WAS ASKED. `_dmgWay` has
     recorded "did this resolution deal damage" since v3.62 (and it is
     recorded INSIDE `arcaneHit`'s `left > 0` branch, so CR 7.5.5's
     "prevented is not dealt" governs it without being restated), and
     `heroTapped` has been the hero's own tap state since v3.48. v3.47's
     rule: when you build a mechanic, sweep the refusals that were waiting
     on it.

     A HERO TAP IS NOT A PERMANENT'S TAP. `weaponUsed[uid]` is a per-turn
     ALLOWANCE lifted at every turn boundary; `heroTapped` is a STATE only
     the controller's own untap step lifts (CR 4.4.3d). They coincide for
     a hero using its own ability and come apart the moment an opponent
     taps you — v3.48 states this, and using the wrong one here would make
     the cost payable again on the opponent's turn. */
  for(let ci = 0; ci < clauses.length - 1; ci++){
    if(handled.has(ci) || handled.has(ci+1)) continue;
    if(!/^if this deals damage, you may \{t\} your hero$/i.test(clauses[ci].trim().replace(/\.$/, ""))) continue;
    const tr = clauses[ci+1].match(/^if you do,?\s*(.+?)\.?$/i);
    if(!tr) continue;
    const rr3 = classifyClause(tr[1]);
    /* AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE (v2.29) — a cost
       with no reward is the free-ability bug v2.04 fixed, inverted. */
    if(!rr3 || rr3.status !== "run" || !rr3.ops || !rr3.ops.length) continue;
    fx.tapCost = {when: "dealt", ops: rr3.ops};
    handled.add(ci); handled.add(ci+1);
    break;
  }

  /* ---- A MODAL OPTIONAL COST, AND "THAT CARD" (v3.90) --------------
     "When this attacks, you may discard a card OR destroy the top card of
      your deck. If THAT CARD has watery grave, this gets go again."
                                                        — JITTERY BONES
     "When this defends, … If that card has watery grave, this gets +2{d}."
                                                     — WASHED UP WAVE

     MEASURED: exactly TWO pool records print this, with the SAME cost,
     two different triggers and two different payloads — so one reader
     closes both, and one of them was among the four cards reading
     nothing at all.

     IT IS A MODE, NOT A FILTER. `fx.optCost` describes ONE cost with a
     zone and a filter, and `optFilter` cannot express "either of these
     two different things"; the printed shape is a CHOICE, which is what
     `prompts.js`'s `modal` variant is for. Reading it as a plain discard
     would silently delete a printed line of play — milling is the branch
     you take when your hand holds nothing with the keyword.

     "THAT CARD" IS THE ONE THE COST CONSUMED, on either branch, so the
     condition cannot be answered until the cost has been paid — which is
     why it rides on the spec rather than becoming a `fx.conds` entry that
     `execute`'s loop would answer FALSE before the ops ran (v3.60).

     THE KEYWORD IS READ off the printed line, never stored: a second card
     naming a different one reads correctly, and the pool prints only
     `watery grave` today.

     BOTH TRIGGERS ARE ALREADY WIRED — `attacks` in `execute` and
     `defends` in `afterDefenders` — so this needed no new queue site
     (v3.52's rule: before building anything, check whether it exists). */
  for(let ci = 0; ci < clauses.length - 1; ci++){
    if(handled.has(ci) || handled.has(ci+1)) continue;
    const mc = clauses[ci].match(
      /^when(?:ever)? this (attacks|defends|hits), you may discard a card or destroy the top card of your deck$/i);
    if(!mc) continue;
    const mr = clauses[ci+1].match(/^if that card has ([a-z' ]+?), (.+?)\.?$/i);
    if(!mr) continue;
    const rr2 = classifyClause(mr[2]);
    /* AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE (v2.29). Half a
       cost is not a cheap approximation when the half that reads is the
       REWARD. */
    if(!rr2 || rr2.status !== "run" || !rr2.ops || !rr2.ops.length) continue;
    fx.millCost = {trigger: mc[1].toLowerCase(), kw: mr[1].trim().toLowerCase(), ops: rr2.ops};
    handled.add(ci); handled.add(ci+1);
    break;
  }

  /* ---- A DEFENDER SHRUNK FOR THE REST OF THE CHAIN (v3.89) ---------
     "Target card defending an Assassin attack gets -2{d} this combat
      chain."   — SHRED, and the pool's only defender debuff.

     THE AMOUNT IS READ, AND THE POOL ITSELF PROVES IT: Shred prints
     **-4 / -3 / -2** across its three pitches, so a hardcoded number is
     right for one printing and silently wrong for two. Every other time
     this rule has been needed the discriminator had to be synthetic
     (v3.32, v3.55, v3.74, v3.77, v3.81, v3.86, v3.88) — here the card
     does it on its own.

     THE GATE IS ABOUT THE ATTACK, not the defender: "defending an
     ASSASSIN attack" restricts which swing this may be played on, and
     `attackQual` is the one reader of that phrase — no new vocabulary,
     seventh member of the family.

     IT IS A WHOLE-CARD FIELD, NOT AN OP, for `optCost`'s reason: WHICH
     CARDS DEFEND is the caller's answer (v3.11, v3.24, v3.27) — the
     trainer holds them as `{k:"def"}` stack layers and judge on
     `blockH`/`blockG` — and `runOps` is handed neither. The queue site is
     `attackRx`, which is already the one body both boards call for a
     played attack reaction and is already given the wall. */
  for(let ci = 0; ci < clauses.length; ci++){
    /* TWO CAPTURES, BECAUSE THE PRINTED RESTRICTION CAN SIT ON EITHER
       SIDE OF THE WORD (v3.31) — "an ASSASSIN attack" is a leading class
       group and "an attack WITH STEALTH" is a tail. `attackQual` is the
       one reader of both, and without the tail the refusal below is DEAD
       CODE that reads like a rule (v3.67, v3.77). */
    const sh = clauses[ci].match(
      /^target card defending (?:an?\s+)?(.*?)attack\b(.*?) gets -(\d+)\{d\} this combat chain\.?$/i);
    if(!sh) continue;
    const q = attackQual(sh[1] || "", sh[2] || "");
    /* `false` is "a restriction I cannot read" and is NOT `null`
       ("nothing restricts this") — `qualMatches` answers TRUE for a falsy
       qualifier, so collapsing them lets the card be played on any swing
       in the game (v3.31). */
    if(q === false) continue;
    fx.defDebuff = {amt: +sh[3], q: q || null};
    handled.add(ci);
    break;
  }

  /* ---- EACH HERO PUTS THEIR TOP CARD IN THEIR ARSENAL (v3.88) ------
     Concoct Disorder, and it is the pool's only card of the shape:

       "When this attacks, EACH HERO puts the top card of THEIR deck
        face-down into THEIR arsenal. If 2 OR MORE cards are put into
        arsenals THIS WAY, this gets go again."

     A WHOLE-CARD READER, because the two sentences reach across the
     clause split: "this way" names the puts the FIRST sentence made, and
     the splitter breaks on the period. Same place and reason `optCost`
     pairs its halves and `arsCycle` reads Azalea's three.

     THE THRESHOLD IS THE CARD'S OWN NUMBER, never a literal — a second
     printing naming a different count reads correctly, and a hardcoded 2
     is right for this face and silently wrong for any other (v3.17,
     v3.32, v3.55).

     THE PUT IS FACE-DOWN, and that is READ rather than defaulted: the
     face of an arsenal put is the caller's answer (v3.69), and reading
     this as face UP would fire every arrow's put-face-up trigger for both
     seats — Azalea's whole deck, off an attack that never says so.

     IT IS ONE OP FOR BOTH SEATS, not two, because "2 or more cards are
     put THIS WAY" counts across them: two ops could not answer it without
     threading a total between them, which is state no op carries. */
  {
    const ci = clauses.findIndex(c =>
      /^when this attacks, each hero puts the top card of their deck face.?down into their arsenal$/i
        .test(levelIdiom(c.trim().replace(/\.$/, ""))));
    const wi = clauses.findIndex(c =>
      /^if (\d+) or more cards are put into arsenals this way, this gets go again\.?$/i
        .test(levelIdiom(c.trim())));
    if(ci >= 0 && wi >= 0 && !handled.has(ci) && !handled.has(wi)){
      const nm = levelIdiom(clauses[wi].trim())
        .match(/^if (\d+) or more cards are put into arsenals this way/i);
      fx.ops.push(["eachArsPut"]);
      fx.conds.push({cond: "way:arsPut" + (+nm[1]), op: ["ga"], instead: false, atkHero: false});
      handled.add(ci); handled.add(wi);
    }
  }

  clauses.forEach((raw,ci)=>{
    if(handled.has(ci)){ fx.clauses.push({t:raw, st:"run"}); return; }
    const r = classifyClause(raw);
    if(!r){ fx.clauses.push({t:raw,st:"skip"}); return; }
    /* A DROPPED QUOTED ABILITY MUST NOT REPORT AS READ (v3.40).

       `quotedOnHit` returns null on a payload it cannot read, and v3.10
       chose that deliberately — an unreadable rider REFUSES and the head
       still lands, which is the honest direction. What it did NOT do is
       tell the audit: the clause was consumed by its head, reported `run`,
       and the card came out `tier: full` with a printed ability doing
       nothing. Measured across the pool: FOUR records — Avast Ye!,
       Display Loyalty, Drop the Anchor and Goon Tactics — and v3.10's own
       note claims this case "leaves the gap visible in the audit", which
       is exactly what was not happening.

       This is v3.00's Stir the Aetherwinds remedy: an unanchored match
       hides an unbuilt clause, so the clause's TIER is made honest rather
       than the reader made to guess. Coverage cannot see it otherwise
       (the clause IS consumed) and neither can the fairness sweep (all
       four are WEAKER than printed, and it is one-sided).

       Asked of the SAME matcher `quotedOnHit` uses, so the two cannot
       disagree about what counts as a quoted ability. */
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
        if(r.cond) fx.condOnHit = [...(fx.condOnHit||[]), {cond:r.cond, op:rop, heroOnly: !!r.riderHeroOnly}];
        else       (r.riderHeroOnly ? fx.onHitHero : fx.onHit).push(rop);
    r.ops.forEach(op=>{
      /* An arsenal-face-up payload is not an on-play effect: it fires when
         the card ENTERS the arsenal, and is stamped onto the card to be
         collected when it is later played. Route it first, or "it gets go
         again this turn" would become the card's own printed go again. */
      if(r.arsUp){ fx.arsenalUp = [...(fx.arsenalUp||[]), op];
        if(r.arsUpTurn) fx.arsenalUpTurn = true;
        return; }
      /* ITS DECK-ONLY SIBLING (v3.79), held off `fx.ops` for the same
         reason: left there, the action point is paid when the card is
         PLAYED, which is the opposite of a trigger that fires while it
         is still in the deck. */
      if(r.deckUp){ fx.deckFaceUp = [...(fx.deckFaceUp||[]), op]; return; }
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
      /* CRUSH IS HERO-GATED BY ITS OWN ANCHOR (v3.45). The pattern that
         produces this op REQUIRES the printed words "damage to a hero",
         so every one of the pool's 15 crush riders is gated — that is
         read off the card, not assumed about the keyword. */
      if(op[0]==="crushRider"){ fx.crush = {n:op[1], ops:op[2], heroOnly:true}; return; }
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
      /* A GATED on-hit carries the subject too, so "if you charged AND
         this hits a HERO" is not silently widened to any hit (v3.45). */
      if(r.onHit && r.cond){ fx.condOnHit = [...(fx.condOnHit||[]),
        {cond:r.cond, op, heroOnly: !!r.heroOnly}]; return; }
      if(r.onLeave){ fx.onLeave = [...(fx.onLeave||[]), op];
        /* "enters OR leaves" — the entry half is an ordinary on-play op
           for a permanent, which is where every other "when this enters
           the arena" payload already lands. */
        if(r.onEnter) fx.ops.push(op);
        return; }
      /* TWO LISTS, NOT A TAG ON THE OP (v3.45). An op is a bare array —
         `["token","gold",1,"self"]` — so there is nowhere on it for a
         flag to live that some other reader will not mistake for a
         parameter. The split mirrors `condOnHit`, which is already a
         separate list for the same reason. */
      if(r.onHit){ (r.heroOnly ? fx.onHitHero : fx.onHit).push(op); return; }
      /* `wpnOnly` IS ADDED ONLY WHEN TRUE (v3.58). `instead` and `atkHero`
         are always present because every cond entry has had them since
         they were introduced; a fourth always-present key changes the
         SHAPE of every cond in the pool, and five drills that deepEqual
         `fx.conds` went red on cards that print no weapon static at all.
         Those drills are right to compare the whole object — so the flag
         appears only on the entries that carry it. */
      else if(r.cond) fx.conds.push(Object.assign(
        {cond:r.cond, op, instead:!!r.instead, atkHero:!!r.atkHero},
        r.wpnOnly ? {wpnOnly:true} : {}));
      /* AN UNGATED "when this attacks a HERO" PAYLOAD gets its own list
         (v3.46), for the reason `onHitHero` does: an op is a bare array
         and a flag on it sits where a reader expects a parameter. */
      else if(r.atkHero){ fx.onAtkHero.push(op); return; }
      else if(r.onDeath){ fx.onDeath.push(op); return; }
      else fx.ops.push(op);
    });
  });

  /* ---- "IT" IS THE CARD THE GRANT NAMES (v3.37) --------------------
     Stir the Aetherwinds prints TWO sentences about ONE card:

       "You may play your next WIZARD NON-ATTACK ACTION CARD this turn as
        though it were an instant. If IT has an arcane damage effect,
        instead it deals that much arcane damage plus 1."

     They arrive as separate clauses — the splitter breaks on the period —
     so they are paired HERE, where the whole card is visible, which is
     the same place and the same reason `optCost` pairs its two halves.

     UNPAIRED, THE AMP LEAKS. `amp` is a bare number on the side meaning
     "the next arcane, whatever it is", and driven that way Stir's +1
     landed on Sigil of Suffering — a Runeblade DEFENSE REACTION, which is
     neither Wizard nor a non-attack action card. RESTRICTION-DROPPED, and
     the fairness sweep could not see it because that check does not model
     `amp`. Same shape as v2.30's arrow buff landing on a sword, and the
     same fix: the qualifier rides WITH the payload.

     THE BARE OP STAYS RIGHT FOR ITS OWN CARD. Cindering Foresight prints
     "THE NEXT CARD you play this turn with an arcane damage effect" —
     genuinely unqualified — so it keeps the loose `amp` it has always
     had. Two cards, one op, two printed scopes; folding only where a
     grant is present is what keeps both faithful. */
  {
    const gi = fx.ops.findIndex(o => o[0] === "instantNext");
    if(gi >= 0){
      const ai = fx.ops.findIndex(o => o[0] === "amp");
      if(ai >= 0){
        fx.ops[gi] = ["instantNext", Object.assign({}, fx.ops[gi][1], {amp: fx.ops[ai][1]})];
        fx.ops.splice(ai, 1);
      }
    }
  }
  /* ---- "IF YOU PREVENT DAMAGE THIS WAY" (v3.67) ---------------------

     Toe the Line prints "The next time you would be dealt damage this
     turn, prevent 2 of that damage. IF YOU PREVENT DAMAGE THIS WAY,
     create a Flurry token."

     IT IS NOT A `way:` CONDITION, and the difference is the whole reason
     it needed building. v3.60's late pass answers "what did THIS
     resolution just do", and its traces are cleared with the resolution
     that set them — correctly, or the next card reads a discard it never
     made. The prevention here happens on a LATER resolution, possibly on
     the opponent's turn, so the rider has to WAIT with the ward. It rides
     on the op, is held beside the pool, and is fired by
     `effects.preventDamage` where the damage is actually turned aside —
     the same place and the same reason `hist.arc`'s credit lives inside
     `arcaneHit` (v3.28): a prevention that turns nothing aside must
     trigger nothing.

     PAIRED IN `fxParse`, where the whole card is visible, because the
     splitter breaks on the period — the same place and reason `optCost`,
     Stir the Aetherwinds and Sharpen pair their halves. Read alone the
     second clause refuses, because nothing else can say what "this way"
     refers to. */
  {
    const wi = fx.ops.findIndex(o => o[0] === "ward");
    if(wi >= 0){
      for(let k = 0; k < clauses.length; k++){
        if(handled.has(k)) continue;
        const pm = clauses[k].match(/^if you prevent damage this way, (.+)$/i);
        if(!pm) continue;
        const sub = classifyClause(pm[1]);
        if(!sub || sub.status !== "run" || !sub.ops || !sub.ops.length || sub.cond) continue;
        fx.ops[wi] = ["ward", fx.ops[wi][1], {ops: sub.ops}];
        const RIDER = /^if you prevent damage this way,/i;
        fx.clauses.forEach(cl => { if(cl.st === "skip" && RIDER.test(clean(cl.t))) cl.st = "run"; });
        handled.add(k);
        break;
      }
    }
  }
  /* ---- SHARPEN'S SECOND SENTENCE IS ABOUT THE SHARPENED SWORD (v3.66)

     "Sharpen target sword you control. IF IT HAS N OR MORE +1{p}
     COUNTERS, create a Flurry token."

     "It" is the sword the first clause targeted, not the card resolving —
     v2.33's Bull's Eye Bracers and v3.47's Scuttle Toes for the third
     time. So the rider is folded onto the `ctrPut` spec here, where the
     whole card is visible, which is the same place and reason `optCost`
     and Stir the Aetherwinds pair their halves. Read alone the clause
     refuses, because nothing else can say what "it" is.

     THE THRESHOLD IS THE CARD'S OWN NUMBER. Upstream prints "1 or more"
     on the red MPW103 face and "3 or more" elsewhere, so a hardcoded
     number is right for one printing and silently wrong for the others —
     `rustDestroy` (v3.17), Thunder Quake's heave (v3.32) and `ctrPut`'s
     own amount (v3.55) are the same rule.

     IT IS COUNTED AFTER THE COUNTER LANDS, which is what makes "1 or
     more" satisfiable by the sharpen itself. */
  {
    const ci = fx.ops.findIndex(o => o[0] === "ctrPut" && o[1] && o[1].wipeEnd);
    if(ci >= 0){
      for(let k = 0; k < clauses.length; k++){
        if(handled.has(k)) continue;
        const rm = clauses[k].match(
          /^if it has (\d+) or more \+1\{p\} counters?, (.+)$/i);
        if(!rm) continue;
        const sub = classifyClause(rm[2]);
        /* an unreadable payload refuses the rider and leaves the clause
           unread — the head still lands, and the gap stays visible */
        if(!sub || sub.status !== "run" || !sub.ops || !sub.ops.length || sub.cond) continue;
        fx.ops[ci] = ["ctrPut", Object.assign({}, fx.ops[ci][1],
          {then: {min: +rm[1], ops: sub.ops}})];
        /* THE CLAUSE LEDGER IS BUILT DURING THE WALK, and this pairing
           runs after it — `handled` is already spent by then. So the
           clause's own status is corrected here, the same fixup and the
           same guard `handAbility` uses: only ever a clause this reader
           actually folded, so a rider that refused stays `skip` and the
           card stays honestly unfinished. */
        const RIDER = /^if it has \d+ or more \+1\{p\} counters?,/i;
        fx.clauses.forEach(cl => { if(cl.st === "skip" && RIDER.test(clean(cl.t))) cl.st = "run"; });
        handled.add(k);
        break;
      }
    }
  }
  /* ---- "IT" IS THE ALLY, NOT THE SOURCE (v3.47) ---------------------
     Scuttle Toes prints "{u} target ally you control. Destroy IT at the
     beginning of the end phase." The splitter breaks on the period, so
     the second sentence arrives on its own and reads as `selfDestruct
     end` — which destroys the SOURCE. The source is Scuttle Toes, already
     destroyed to pay for the ability, so the printed drawback would land
     on nothing at all and the untapped ally would live for free.

     That is v2.33's Bull's Eye Bracers trap exactly — "it" naming the
     card that was acted on rather than the card doing the acting — and
     the fix is the same: hold the schedule back and let it ride on the
     op that knows which card "it" is. Paired HERE because this is the
     only place that can see both sentences, the same reason `optCost`
     and Stir the Aetherwinds' amp are paired here. */
  {
    const ui = fx.ops.findIndex(o => o[0] === "untapAlly");
    if(ui >= 0){
      const di = fx.ops.findIndex(o => o[0] === "selfDestruct" && o[1] === "end");
      if(di >= 0){
        fx.ops[ui] = ["untapAlly", fx.ops[ui][1], {sd: "end"}];
        fx.ops.splice(di, 1);
      }
    }
  }
  /* ---- A QUOTED ABILITY WITH NO READER (v3.40) ----------------------
     FaB prints a granted ability in quotes, and `quotedOnHit` returns null
     on a payload it cannot read — v3.10's deliberate refusal, so the head
     still lands and the card is weaker than printed rather than guessed
     at. What it did NOT do is tell anyone: the clause is consumed by its
     head, reports `run`, and the card comes out `tier: full` with a
     printed ability doing nothing. v3.10's own note claims this "leaves
     the gap visible in the audit"; measured across the pool it left four
     records claiming to work.

     RECORDED, NOT DOWNGRADED. Marking the clause unread was the first
     attempt and it lies in the other direction — Display Loyalty's go
     again really does work, and the card reported `none`. The tier stays
     accurate about the HEAD and `fx.quotedUnread` carries the riders, so
     `tools/audit.js` flags them by name. Both facts, neither hidden.

     IT ASKS "IS THERE A READER", not "did it land": a rider can ride
     somewhere other than `fx.onHit` — Mauvrion Skies' Runechants are the
     COUNT `runeHitNext` — so a landing-check demotes cards that work, and
     enumerating the carriers here would put card knowledge in a generic
     guard. Avast Ye! is the one this cannot see (its payload READS and is
     then dropped by the `gaNext` path); that is a missing feature, it is
     recorded in HANDOFF.md, and a tier check should not paper over it. */
  fx.clauses.forEach(cl => {
    if(cl.st !== "run") return;
    const low = levelIdiom(clean(cl.t).toLowerCase().replace(/\.$/,"").replace(/^-\s*/,""));
    const q = quotedText(low);
    if(q == null || quotedOnHit(low)) return;
    /* A QUOTED ABILITY THE AURA-WEAPON GRANT CONSUMED HAS A READER
       (v3.84). This flag asks exactly one question — "is there a reader
       for this quoted ability" — and `auraWeaponGrant` is one: it hands
       the quoted line to `weaponCost` and `parser.auraAttackOf` offers it
       on the board. Left unsuppressed, the flag and the clause credit
       three lines up would contradict each other about the same sentence,
       and the census in `test/quoted.test.js` would carry a card that
       works. `fx.auraWeapon` is set only when the grant actually parsed,
       so an unreadable one still reports. */
    if(fx.auraWeapon && /are weapons with base/.test(low)) return;
    fx.quotedUnread = [...(fx.quotedUnread || []), q];
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
  /* AN OPTIONAL RESOURCE ADDITIONAL COST (v3.34) — Staunch Response's
     "As an additional cost to play this, you MAY pay {r}{r}{r}{r}."

     IT IS A COST, NOT A TRIGGER, so it is settled at play time beside the
     resource cost and cannot be a queued prompt (those drain after the
     card has resolved — the wall Charge and Fusion still sit behind).
     Boost is the precedent: an optional additional cost asked BEFORE
     `execute` and answered onto the state.

     "YOU MAY" IS THE WHOLE DIFFERENCE. A mandatory additional cost would
     simply raise the price; this one is a choice, and the rider that
     reads it is `defSelf.when === "addCostPaid"`. */
  {
    const ap = clean(card.tx||"").toLowerCase()
      .match(/as an additional cost to (?:play|activate) this, you may pay ((?:\{r\})+|\d+)/);
    if(ap) fx.addPay = {cost: /^\d+$/.test(ap[1]) ? +ap[1] : (ap[1].match(/\{r\}/g)||[]).length};
  }
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
  /* ---- BRAVO'S TURN-UP (v3.72) --------------------------------------
     "Action - {r}{r}, {t}: Turn a face-down card in your arsenal face-up.
      If it has crush, it gets +2{p} and dominate this turn. Go again"

     HIS DECK READS 100% AND HIS HERO READ 0% — the sharpest illustration
     in the pool of why deck coverage was never the binding constraint.
     And it needed no new machinery: Azalea's v3.71 build already turns a
     card face up, fires its triggers and stamps a conditional bonus onto
     it. What is new is the EVENT and the keyword test.

     A WHOLE-CARD READER for the same reason `arsCycle` is one: "IT" names
     the card the first sentence turned, and the clause splitter breaks on
     the period. The grant shares `arsGrant` with Azalea's, so there is
     one reader of that printed sentence and not two.

     THE GRANT IS OPTIONAL AND THE TURN IS NOT. An unreadable grant leaves
     the turn-up working and the clause `skip`, so the audit still reports
     it — where a card whose whole payload is the grant would refuse. */
  {
    const ti = fx.clauses.findIndex(c => ARS_TURN.test(c.t.trim()));
    if(ti >= 0){
      let grant = null, gi = -1;
      fx.clauses.forEach((c, i) => {
        const g2 = arsGrant(c.t);
        if(g2 && !grant){ grant = g2; gi = i; }
      });
      fx.ops = [...fx.ops, ["arsTurn", grant]];
      [ti, gi].forEach(i => { if(i >= 0 && fx.clauses[i].st === "skip") fx.clauses[i].st = "run"; });
    }
  }
  /* ---- CROW'S NEST — HER SPECIALIZATION (v3.72) ---------------------
     "Whenever an arrow is put face-up into your arsenal FROM YOUR DECK,
      you may pay {r}. If you do, put an aim counter on it."

     THE TRIGGER HAD NO SOURCE UNTIL v3.71. Nothing in the pool put a card
     face-up into the arsenal from the DECK, so her specialization watched
     for an event that could not happen — and it is the pool's ONLY source
     of aim counters, which three of her arrows read. A whole family, dead
     behind one hero ability.

     A WHOLE-CARD READER, because the two halves arrive as separate clauses
     ("if you do" names the first one's payment) — the place `optCost` pairs
     its halves and `arsCycle` folds its grant.

     "IT" IS THE ARROW THAT WAS PUT, not the Quiver watching it. The
     payload goes back through `classifyClause` so it shares every reader,
     and the DESTINATION is decided here, where the whole card is visible —
     v3.66's rule about the sharpened sword, and v2.33's about the Bracers.
     Read off the piece alone, `["aim",1]` lands on whatever is on the
     chain, which is a different card on a different turn. */
  {
    const tm = fx.clauses.map(c => c.t.toLowerCase().match(
      /^whenever an? ([a-z]+) is put face.?up into your arsenal from your deck, you may pay ((?:\{r\})+)$/));
    const ti = tm.findIndex(Boolean);
    if(ti >= 0){
      const ri = fx.clauses.findIndex(c => /^if you do,/i.test(c.t));
      const rc = ri >= 0 ? classifyClause(fx.clauses[ri].t.toLowerCase().replace(/^if you do,\s*/, "")) : null;
      /* AN UNREADABLE PAYLOAD REFUSES THE WHOLE TRIGGER (v2.29). A cost
         with its reward missing is a card that charges for nothing. */
      if(rc && rc.status === "run" && rc.ops && rc.ops.length && !rc.cond){
        fx.arsUpDeck = {
          tt: tm[ti][1],
          pay: (tm[ti][2].match(/\{r\}/g) || []).length,
          ops: rc.ops.map(op => op[0] === "aim" ? ["aim", op[1], "arsenal"] : op)
        };
        [ti, ri].forEach(i => { if(i >= 0 && fx.clauses[i].st === "skip") fx.clauses[i].st = "run"; });
      }
    }
  }
  /* ---- AZALEA'S ARSENAL CYCLE (v3.71) ------------------------------
     THE HERO ABILITY IS THE DECK. Her whole package is the FACE-UP
     arsenal — Swift Shot, Dry Powder Shot and Entangling Shot each print
     "when this is put face-up into your arsenal", Bull's Eye Bracers and
     Death Dealer are enablers, and Crow's Nest watches for an arrow put
     face-up FROM YOUR DECK. Nothing in the pool put a card there from the
     deck, so her specialization had no source and her hero did nothing at
     all: `parseHeroPower` refused the line, so `build.js` built her no
     powCard. Read the hero ability before the cards (v2.55, Kayo).

     ONE READER FOR THREE SENTENCES, and it is a whole-card reader because
     two of them REACH ACROSS the split: "if you DO" names the first
     sentence's put and "IT" names the second's card. The clause splitter
     breaks on the period, so `classifyClause` sees one at a time and can
     answer neither — the same reason `optCost` pairs its halves here and
     Sharpen folds its wipe here (v3.66).

     IT REFUSES UNLESS BOTH HALVES READ. Sentence 1 alone is a card put on
     the bottom of the deck for nothing: a DRAWBACK with its payoff
     dropped, which is worse than an honest refusal (v2.29). */
  {
    const ci = fx.clauses.findIndex(c => CYC_BOTTOM.test(c.t));
    const pi = fx.clauses.findIndex(c => CYC_PUT.test(c.t));
    if(ci >= 0 && pi >= 0){
      /* "IF IT'S AN ARROW, IT GETS DOMINATE UNTIL END OF TURN." "It" is
         the card that was PUT, not the hero and not the card that left —
         v2.33's Bull's Eye Bracers trap and v3.47's Scuttle Toes, third
         outing. Both the subject and the keyword come off the printed
         line; neither is assumed. */
      let grant = null, gi = -1;
      fx.clauses.forEach((c, i) => {
        const g2 = arsGrant(c.t);
        if(g2 && !grant){ grant = g2; gi = i; }
      });
      /* An unreadable grant drops the GRANT and keeps the cycle, because
         the cycle is the mechanism and reads on its own — `arsGrant`
         refuses rather than guessing, and the clause stays `skip` so the
         audit still reports the gap. */
      fx.ops = [...fx.ops, ["arsCycle", grant]];
      [ci, pi, gi].forEach(i => { if(i >= 0 && fx.clauses[i].st === "skip") fx.clauses[i].st = "run"; });
    }
  }
  const apm = tl.match(/you may put an? ([a-z ]+?) (?:card )?from your hand face.?up into your arsenal/)
           || tl.match(/you may put an? ([a-z ]+?) (?:card )?face.?up into your arsenal/);
  if(apm){
    const subj = apm[1].trim();
    if(/^arrows?$/.test(subj)){
      fx.arsenalPut = {filter:{tt:"arrow"}};
      /* THE CLAUSE LEDGER, TOLD. This reader runs over the whole card
         AFTER the clause router has already filed "You may put an arrow
         from your hand face-up into your arsenal" as `skip`, so Call in
         the Big Guns sat at `part` with a mechanic that is genuinely
         built and now genuinely fires. Same correction the "If you do"
         rider below makes, and made for the same reason: the ledger
         should say what the engine does.

         ONLY EVER FLIPPED WHERE THE PUT WAS ACTUALLY CLAIMED — inside
         this branch, after `fx.arsenalPut` is set. A blanket flip would
         mark the clause read on a card whose subject this reader
         refused, which is the audit lying in the expensive direction.
         Equipment and weapons reach the same mechanic through their
         ability line, which the router already files `noop`, so this
         only ever matches the plain printed sentence. */
      const pc = fx.clauses.find(c => c.st === "skip" && ARS_PUT.test(c.t));
      if(pc) pc.st = "run";
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
    .some(o => o && (o[0]==="self" || o[0]==="buffNext") && o[1]===v)
    /* AN ARSENAL GRANT HAS ALREADY READ ITS "+N{p}" (v3.72). Bravo prints
       "if it has crush, IT gets +2{p} and dominate this turn", where "it"
       is the card in the ARSENAL — so the fallback below read the same
       +2 a second time and queued it as a pump for his next attack,
       whether or not the card had crush. v2.33's Bull's Eye Bracers trap,
       one hero over, and VALUE-DOUBLED on the fairness sweep's own terms.

       AND NO TOOL HERE WOULD HAVE SEEN IT: a hero powCard is not a pool
       card, so neither the audit nor the sweep ever looks at one. Driving
       the ability is what showed it.

       THE MAGNITUDE IS MATCHED, not the mere presence of a grant (v2.30),
       so a card printing two different pumps still gets its unread one. */
    || [...fx.ops].some(o => o && (o[0]==="arsTurn" || o[0]==="arsCycle")
                          && o[1] && o[1].pow === v)
    /* A STANDING ATTACK GRANT HAS ALREADY READ ITS "+N{p}" (v3.87).
       Night's Embrace prints "Your attacks with stealth get +1{p} this
       turn" and the fallback read the same +1 a SECOND time into
       `fx.self` — so the card granted its printed +1 to every stealth
       attack AND queued a bare, unqualified +1 for the next attack of any
       kind. Driven at the table: a 3-power stealth attack dealt 5.

       v2.30's VALUE-DOUBLED, fourth outing, and the third to arrive the
       same way — a new op reads a printed number and the whole-text
       fallback has not been told. THE MAGNITUDE IS MATCHED, so a card
       printing two different pumps still gets its unread one. */
    || [...fx.ops].some(o => o && o[0]==="atkBuff" && o[1] === v);
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
  /* AN ACTIVATED ATTACK REACTION IS READ BY `parseHeroPower`, NOT HERE
     (v3.63) — `classifyClause` refuses the line on purpose, so the generic
     matchers below cannot claim it INCLUDING ITS COST (v3.59). Now that
     the route exists on both boards, leaving the clause `skip` under-reports
     a card that works: v3.21's one-sided ledger, and "under-reporting is the
     safe direction only while somebody is looking".

     THE CREDIT IS CONDITIONAL ON THE READER ANSWERING, which is the whole
     difference between this and a `noop`. Danger Digits' payload refuses
     (its subject is a chosen dagger and it prints a drawback) and Boltyn's
     cost is a soul banish nothing builds — `parseHeroPower` returns null
     for both, so neither is credited and both stay honestly unfinished.
     Same shape and same guard as `handAbility` directly above. */
  {
    const rxAb = parseHeroPower(card.tx || "", true);
    if(rxAb && rxAb.kind === "attackRx"){
      const RA = /^(?:once per turn )?attack reaction\s*[-—]/i;
      fx.clauses.forEach(cl => { if(cl.st === "skip" && RA.test(cl.t)) cl.st = "run"; });
    }
  }
  const runs = fx.clauses.filter(x=>x.st!=="skip").length;
  fx.tier = fx.clauses.length===0 ? "full" : runs===fx.clauses.length ? "full" : runs>0 ? "part" : "none";
  /* `onHitHero` COUNTS TOO (v3.45). Splitting the on-hit list by its
     printed subject left this asking only half the question, and six
     cards whose ONLY payload is hero-gated — Strongest Survive x3, Drill
     Shot, Searing Shot, Rush of Power — flipped to `playable: false`.
     That is the trainer's "no scripted effect yet" refusal, and it was
     caught by the audit diff rather than by a drill. When you split a
     list, grep for everyone who was reading the whole of it. */
  fx.playable = fx.ops.length>0 || fx.onHit.length>0 || (fx.onHitHero||[]).length>0
             || (fx.onAtkHero||[]).length>0 || (fx.onDeath||[]).length>0
             || (fx.onLeave||[]).length>0
             || fx.conds.length>0 || !!fx.perm || fx.ga;
  FXMEMO.set(key,fx);
  return fx;
}
function parseHeroPower(tx, allowDestroy){
  const t = clean(tx);
  /* "REACTION" CONTAINS "ACTION", AND THIS MATCH WAS UNANCHORED (v3.63).
     `clean` collapses the newlines, so the reader cannot anchor on `^`
     and never did — which meant "Attack Reaction - Destroy this: …"
     matched on the `action` inside RE-ACTION and came back
     `kind: "action"`. Driven through `build.js`: Prey Spotters and
     Stalker's Steps were BUILT as action-speed abilities and offered in
     the action phase, where their printed window is the attack-reaction
     step. Sev-3 "illegal play allowed", and Stalker's Steps granted go
     again — an action point — off an ability with no attack to target.

     v2.44 named this trap and v3.30 hit it again in `nextTurnBars`; here
     it had been live since equipment abilities got a route. The guard
     v3.59 put in `classifyClause` kept the COVERAGE TIER honest and could
     never reach this, because this reader runs its own regex over the raw
     text — a refusal asserted in one function and not driven in the other.

     No lookbehind: this ships to a phone as authored, so the preceding
     character is CONSUMED instead. `[^a-z]` under /i excludes upper case
     too, which is the point — the `e` of "Reaction" must not qualify. */
  const m = t.match(/(?:^|[^a-z])(once per turn )?(attack reaction|action|instant)\s*[-—]*\s*([^:]{0,40}?):\s*([^.]+)/i);
  if(!m) return null;
  const costStr = (m[3]||"").trim();
  /* ONE NAME FOR THE WINDOW. "attack reaction" is the printed spelling and
     `attackRx` is what build.js stamps and judge.js gates on, so it is
     normalised HERE rather than at each of the three consumers — two
     spellings of one fact is the drift this project names on every page. */
  const kind = m[2].toLowerCase() === "attack reaction" ? "attackRx" : m[2].toLowerCase();
  const sd = allowDestroy && /\bdestroy\b/i.test(costStr);
  /* A COUNTER COST IS THE ONE "REMOVE" THIS READER ACCEPTS (v3.39), and
     it is narrow for the same reason the arsenal put is (v2.34): a broad
     relaxation would raise the tier of cards nothing wires, which is the
     "never parse ahead of wiring" rule that has already cost a real bug.

     Blaze prints "Remove X energy counters from Blaze:", and X is not a
     free variable — the player picks a card and X is that card's own
     arcane damage, so the amount is settled by the CHOICE rather than
     asked for up front. `ctr` names the counter; the cost in RESOURCES is
     zero, because counters are what it spends. */
  const ctrM = costStr.match(/^remove (x|\d+) ([a-z]+) counters? from /i);
  if(ctrM){
    const eff0 = classifyClause(m[4]);
    if(!eff0 || eff0.status !== "run") return null;
    const after0 = t.slice(m.index + m[0].length);
    return {cost: 0, ga: /^\.?\s*go again/i.test(after0), sd: false,
            kind,
            ctr: {kind: ctrM[2].toLowerCase(), x: /^x$/i.test(ctrM[1]) ? "x" : +ctrM[1]},
            eff: m[4].trim(),
            label: (m[1] ? "once/turn: " : "") + m[4].trim()};
  }
  /* A SOUL BANISH IS THE SECOND COST THIS READER ACCEPTS (v3.74), and it
     is narrow for the same reason the counter cost is: a broad relaxation
     raises the tier of cards nothing wires.

     BOLTYN'S ONE MECHANIC IS THE SOUL. "Attack Reaction - Banish a card
     from your soul: Target attack with {p} greater than its base gets go
     again" is Bolt'n Boots' shape with a different cost — the `pumped`
     atom and the whole attack-reaction route already exist (v3.63), and
     this refusal was the only thing between him and the ability.

     THE COST IS ZERO IN RESOURCES, because it is paid in soul cards. It
     rides on the powCard as `_soulCost` and is charged on activation —
     a LEGALITY, refused before the ability resolves (v3.11), because
     refusing afterwards costs the player an activation the rules never
     allowed. */
  /* "BANISH THIS AND …" IS THE SAME COST WITH THE SOURCE ADDED (v3.79).
     Radiant Touch prints "Instant - Banish THIS AND a card from your
     soul: Prevent the next 2 damage…" — one printed `banish` governing
     two objects, so it is this matcher with an optional middle rather
     than a second reader. Its payload (`ward 2`) has read since v3.67 and
     the soul cost since v3.74: the ONLY thing between the card and the
     table was that the anchor demanded the soul be the whole cost.

     THE SELF-BANISH IS THE DRAWBACK AND IT MUST LAND. A prevention pool
     you can raise every turn for one soul card is a different card; the
     piece leaving for good is the price. Dropping it is the free-ability
     bug v2.04 fixed, one cost over. */
  const soulM = costStr.match(/^banish (this and )?(a|an|one|two|three|\d+) cards? from your (?:hero'?s? )?soul$/i);
  if(soulM){
    const eff1 = classifyClause(m[4]);
    if(!eff1 || eff1.status !== "run" || eff1.cond || eff1.onHit) return null;
    const after1 = t.slice(m.index + m[0].length);
    const nSoul = {a:1, an:1, one:1, two:2, three:3}[soulM[2].toLowerCase()] || +soulM[2];
    const selfB = !!soulM[1];
    return {cost: 0, ga: /^\.?\s*go again/i.test(after1), sd: false, kind,
            soul: nSoul, selfBanish: selfB, eff: m[4].trim(),
            label: (m[1] ? "once/turn: " : "") + "banish "
                 + (selfB ? "this and " : "") + nSoul
                 + " from your soul: " + m[4].trim()};
  }
  /* A NAMED BOARD PERMANENT IS THE THIRD COST THIS READER ACCEPTS (v3.86),
     and it is named for the same reason the counter cost (v3.39) and the
     soul banish (v3.74) are: a broad relaxation raises the tier of cards
     nothing wires.

     GRAVY BONES' ABILITY IS THE POOL'S ONLY ONE. Measured across all 797
     records: 39 print an activation cost containing "destroy", and
     **38 of them destroy THIS** — the source, which is the `sd` flag
     below. His is the single record whose cost destroys a card SOMEWHERE
     ELSE, and the guard underneath refused the whole line for it, so his
     hero ability was inert while his deck read 100%.

     THE NAME KEEPS ITS PRINTED CAPITALISATION (v3.53). `costStr` comes off
     the raw cleaned text rather than the lowercased clause, because a
     proper noun is the only thing separating a token's NAME from a common
     noun — and matched lowercased, this claims "destroy a card you
     control" as a name.

     THE TAP NEEDS NOTHING HERE. `tapsToActivate` reads the hero's own
     printed line for the `{t}` in the cost half (v3.48), and Gravy's line
     is the shape it already answers for; carrying the tap a second time
     would be two records of one fact. */
  const destM = costStr.match(/^\{t\},? destroy (?:a|an|one) ([A-Z][A-Za-z'\u2019 -]*?) you control$/);
  if(destM){
    const eff2 = classifyClause(m[4]);
    if(!eff2 || eff2.status !== "run" || eff2.cond || eff2.onHit) return null;
    const after2 = t.slice(m.index + m[0].length);
    return {cost: 0, ga: /^\.?\s*go again/i.test(after2), sd: false, kind,
            destroyBoard: destM[1].trim(), eff: m[4].trim(),
            label: (m[1] ? "once/turn: " : "") + "destroy a " + destM[1].trim()
                 + ": " + m[4].trim()};
  }
  /* "THIS" IS THE SOURCE, AND ON A REACTION ROUTE THE SOURCE IS NOT THE
     ATTACK (v3.63). An activated attack reaction resolves onto the OPEN
     LINK, so a payload whose subject is the card itself has no reading
     this engine can give: Bait prints "Once per Turn Attack Reaction - 0:
     THIS gets +1{p} and go again" on a Ranger Token AURA, and pumping the
     link with it would be deciding what "this" refers to — the golden rule
     broken on an activation line. v2.33's Bull's Eye Bracers and v3.47's
     Scuttle Toes are the same sentence about "it".

     Measured: it refuses Bait alone. The three built cards print "Target
     …" / "Mark target …", and Bait is a token NOTHING IN THE POOL CAN
     CREATE — so this costs no card today and stops `fxParse` crediting a
     line whose meaning nobody has ruled on. */
  if(kind === "attackRx" && /^(?:this|it)\b/i.test((m[4]||"").trim())) return null;
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
  /* THE ARSENAL CYCLE IS THE SECOND (v3.71), and it is here for exactly
     the reason the put is: its reader is a WHOLE-CARD one in `fxParse`,
     because two of Azalea's three sentences reach across the clause split
     ("if you do", "it"). The powCard carries her whole printed line and
     `execute` re-reads it, so nothing is lost by this reader answering on
     the first sentence alone. A NAMED pattern, never a relaxation of the
     guard below — that is the never-parse-ahead-of-wiring rule. */
  const arsPut = ARS_PUT.test(m[4]) || CYC_BOTTOM.test(m[4].trim()) || ARS_TURN.test(m[4].trim());
  if(!arsPut && (!eff || eff.status!=="run" || eff.cond || eff.onHit)) return null;
  const after = t.slice(m.index + m[0].length);
  const ga = /^\.?\s*go again/i.test(after);
  return {cost, ga, sd:!!sd, kind, eff:m[4].trim(),
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
/* THE ONE COST READER, and it takes an optional third argument for the
   reductions that depend on GAME state rather than on the side (v3.86).

   Fai's ability prints "this ability costs {r} less to activate for each
   DRACONIC CHAIN LINK you control", and the combat chain is not on the
   side — so it is the CALLER'S ANSWER, exactly as the wall and the
   attack-target are. A caller that says nothing pays full price: weaker
   than printed and visible, which is the safe direction.

   IT IS NOT A FOURTH READER. v3.80's lesson was that three sites reading
   a cost three ways is how a seat ends up owing resources, so the dynamic
   half lands INSIDE `effCost` rather than being subtracted at each call
   site — every existing caller keeps the same answer, and the ones that
   can see the chain hand it in. */
function effCost(c,sd,o){
  o = o || {};
  /* AND WHAT A BANISH-RIDER STAMPED ON THE CARD ITSELF (v3.92) — Rising
     Resentment's "it costs {r} less to play". It rides on the CARD rather
     than on the side, because the printed line names one specific card;
     `costOff` is the side-level qualified grant and would apply to
     whatever matched next. */
  const stamp = (c && c._banCostOff) || 0;
  const dyn = ((c && c._dracDiscount) ? c._dracDiscount * (o.dracLinks || 0) : 0) + stamp;
  return Math.max(0,(c.cost||0)-runeRed(c)*runeCount(sd)-boardRed(c,sd)-costOffFor(c,sd)-dyn)
       + frostCount(sd) + nextTurnTax(sd);
}

/* HOW MANY DRACONIC CHAIN LINKS ARE ON THE CHAIN. One reader — it was
   inline in `effects.js`'s condition loop, where the `dracN` gate uses
   the same number, and Fai's discount is its second consumer. */
function dracLinks(chain){
  return (chain || []).filter(l => l && l.drac && l.kind === "atk").length;
}
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
/* ---- AN ALLY IS A PERMANENT THAT ATTACKS (v3.44) --------------------

   Every ally in the pool that can attack prints the SAME grammar a weapon
   does:

     Swabbie            Action - {r}{r}, {t}: Attack
     Limpit, Hop-a-long Action - {r}, {t}: Attack. Go again
     Cintari Sellsword  Once per Turn Action - {r}: Attack. Go again

   So `weaponCost` — which is really the one reader of "Action - <cost>:
   Attack" — already answers cost, `taps` and `oncePerTurn` correctly for
   all eleven, and did so for years while nothing asked it. The parser was
   never the gap; the ROUTE was, on both boards (v3.04's shape, a third
   time). This is the named question, not a second parse of the same line.

   `parser.isWeapon` deliberately stays false for an ally (its type line
   says no Weapon), which is why this needs its own name rather than
   widening that one — the same two-names-two-questions split
   `types.isWeaponType` vs `parser.isWeapon` has been pinned to since
   v2.44.

   THE GO AGAIN ON THE LINE BELONGS TO THE ABILITY. Limpit prints
   "Action - {r}, {t}: Attack. Go again" and the clause splitter breaks on
   the period, so "Go again" arrives as a clause of its own and sets
   `fx.ga` — the CARD's go again. For a weapon that is exactly right and
   is how Mark of the Huntsman's swing goes again, because a weapon is
   never played from hand. An ALLY is: driven before the fix, DEPLOYING
   Limpit kept its action point, which is a free ally out of Gravy Bones'
   own deck and stronger than printed. `printedKw` is the discriminator
   and already answered correctly (the keyword is mid-line, not its own
   paragraph); nothing was asking it. */
function allyAttack(c){
  if(!c) return null;
  const wc = weaponCost(c.tx || "");
  if(!wc) return null;
  if(!(c.power != null && c.power !== "" && +c.power > 0)) return null;
  return {cost: wc.cost, taps: wc.taps, oncePerTurn: wc.oncePerTurn, ga: attackLineGa(c)};
}

/* ---- AN AURA THAT IS A WEAPON (v3.84) -------------------------------
   Cosmo, Scroll of Ancestral Tapestry:

     "During your turn, auras you control with WARD are weapons with base
      {p} equal to their WARD and \"Once per Turn Action - {r}: Attack\".
      Your aura attacks with one or more +1{p} counters get go again."

   ENIGMA'S WHOLE ENGINE. The Spectral Shield token's entire printed text
   is "Ward 1" — it has no attack at all, and her hero's clause 1 prices
   "your first Spectral Shield ATTACK each turn". Cosmo is what makes that
   attack exist, so every one of those cards is waiting on this one.

   THE GRANT'S COST IS READ OFF THE QUOTED ABILITY, by `weaponCost`, the
   same reader that answers for a real weapon and for an ally. Three
   sources of activated attacks and one reader of the grammar — which is
   also the reason Cosmo was routed as a swing itself until v3.83:
   `weaponCost` matches the quoted line whether it belongs to the card or
   to something the card is talking about, so the ROUTE is decided by
   `isWeapon`, never by asking it. */
function auraWeaponGrant(c){
  if(!c) return null;
  const t = clean(c.tx || "").toLowerCase();
  const m = t.match(
    /auras you control with ward are weapons with base \{p\} equal to their ward and "([^"]+)"/);
  if(!m) return null;
  const wc = weaponCost(m[1]);
  if(!wc) return null;                       /* an unreadable grant refuses */
  /* THE SECOND SENTENCE IS THE SAME CARD'S and rides with the grant, so
     one reader answers for the whole static. Enigma's deck is full of
     +1{p} counter-putters — Astral Etchings, Uphold Tradition, Spectral
     Manifestations — which is what makes it a real line of play rather
     than a rider nobody can turn on. */
  const ga = /your aura attacks with one or more \+1\{p\} counters get go again/.test(t);
  return {cost: wc.cost, taps: wc.taps, oncePerTurn: wc.oncePerTurn,
          gaWithCounters: ga, ownTurnOnly: /^during your turn/.test(t)};
}

/* THE NUMBER AN AURA CARRIES, read off its printed keyword line.

   IT IS A PROPERTY, NOT THE PREVENTION POOL. `fx.ops` gives Spectral
   Shield `[["ward",1]]`, which is the op that fills a side's prevention
   pool when a card RESOLVES — and a token minted onto the board never
   takes that path, so the pool is untouched (verified). Cosmo's own text
   settles which reading is wanted here: "base {p} equal to their WARD"
   is a number the aura CARRIES, so this reads the printed line.

   WHETHER A BOARD AURA'S WARD ALSO FEEDS THE PREVENTION POOL IS AN OPEN
   RULING and is deliberately not decided here — see HANDOFF.md. Reading
   it as a standing prevention would be inventing a rule; reading it as a
   number is what the card that talks about it says it is. */
function wardValue(c){
  if(!c) return 0;
  const line = String(c.tx || "").split(/\n+/).map(l => clean(l).trim().toLowerCase())
    .find(l => /^ward\s+\d+$/.test(l));
  return line ? +line.split(/\s+/)[1] : 0;
}

/* CAN THIS BOARD AURA ATTACK RIGHT NOW, AND FOR HOW MUCH? (v3.84)

   The aura's half of Cosmo's static, and the one reader all three callers
   ask — `judge.legal`, `judge.doActivate` and `effects.execute` — so no
   two of them can disagree about the cost or the power the way v3.80's
   three cost readers did.

   THE GRANT COMES FROM A DIFFERENT CARD, which is what makes this unlike
   `allyAttack`: an ally prints its own attack, and an aura is handed one
   by whatever is equipped. So the SIDE is an argument.

   "DURING YOUR TURN" IS THE CALLER'S ANSWER and there is no default: a
   caller that does not say gets NOTHING, which is weaker than printed and
   visible — the direction v3.24 takes with `defendValue`'s conditions and
   v3.72 with the arsenal put's source zone. Defaulting the other way
   would let an aura swing on the opponent's turn, which the card's first
   three words forbid. */
function auraAttackOf(card, sd, o){
  o = o || {};
  if(!card || !sd) return null;
  const w = wardValue(card);
  if(!(w > 0)) return null;                  /* no ward, no weapon */
  if(o.yourTurn !== true) return null;       /* "during your turn" */
  /* A DESTROYED PIECE GRANTS NOTHING — `gearDef` already answers 0 for
     one and `sweepGear` files it at the end phase, so it is still in the
     array while the grant is being asked for. */
  const g = (sd.gear || [])
    .map(x => (x && !x.destroyed) ? auraWeaponGrant(x) : null)
    .find(Boolean);
  if(!g) return null;
  /* THE HERO'S FIRST-ATTACK DISCOUNT (v3.84) — Enigma's clause 1, and it
     is the CALLER'S ANSWER because it lives on a build, which this file
     cannot see. A caller that says nothing pays full price: weaker than
     printed and visible, the direction every optional answer here takes.

     "YOUR FIRST <NAME> ATTACK EACH TURN" IS A FACT ABOUT ONE NAMED CARD,
     so it is spent by a swing from a card of that name and by nothing
     else — a Waxing Specter attacking first must not spend the Spectral
     Shield's discount. `hist.auraAtkNames` is that record, and CR 4.4.4
     clears it at the turn boundary so "each turn" needs no other
     bookkeeping. */
  let cost = g.cost;
  const d = o.discount;
  if(d && d.amt && d.name
     && String(card.name || "").toLowerCase() === String(d.name).toLowerCase()
     && !((sd.hist || {}).auraAtkNames || [])
          .some(n => String(n).toLowerCase() === String(d.name).toLowerCase()))
    cost = Math.max(0, cost - d.amt);
  return {cost, taps: g.taps, oncePerTurn: g.oncePerTurn,
          power: w, gaWithCounters: !!g.gaWithCounters};
}

/* THE GO AGAIN ON *THIS* ABILITY, not on a sibling. Cutty Shark prints
   TWO activated abilities — "Action - {r}, {t}: Attack" and "Once per
   Turn Action - {r}: Your next ally attack this turn gets +1{p}. Go
   again" — and only the second carries the keyword. Granting it to the
   attack would be reading one ability's text onto another. */
function attackLineGa(c){
  if(!c || printedKw(c, "go again")) return false;
  return String(c.tx || "").split(/\n+/).some(l =>
    /^(?:once per turn\s+)?(?:action|instant)\s*[-\u2014][^\n]*:\s*attack\b[^\n]*\bgo again\b/i.test(l.trim()));
}

/* Is this card's go again the TAIL OF AN ACTIVATED-ABILITY LINE rather
   than its own printed keyword line? One reader, asked by `fxParse` (to
   flag it) and by `allyAttack` (to grant it to the attack it belongs to).

   15 pool cards answer yes and 13 of them are Equipment or Weapons, which
   are never played from hand — so for those the distinction is invisible
   and `fx.ga` must keep working exactly as it does, or Mark of the
   Huntsman's swing silently loses its go again. The two that are neither
   are Limpit and Cutty Shark: allies, played from hand. */
function abilityGa(c){
  if(!c) return false;
  if(printedKw(c, "go again")) return false;       /* a real keyword line is the card's */
  return String(c.tx || "").split(/\n+/).some(l =>
    /^(?:once per turn\s+)?(?:action|instant)\s*[-\u2014][^\n]*\bgo again\b/i.test(l.trim()));
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
  /* SPLIT THE RAW TEXT, THEN CLEAN EACH LINE (v3.48). This called
     `clean(tx).split(/\n+/)`, and `clean` COLLAPSES the very newlines the
     split depends on — the same trap `printedKw` and `kwGated` each carry
     a comment about. The whole card arrived as one line, so the `.find`
     only ever matched a card whose activated ability is its FIRST printed
     line, and answered FALSE for any other.

     Two live casualties: Lyath Goldmane, whose "Instant - {r}{r}, {t}:"
     sits under his halving static, and Concealed Object, whose tap sits
     under its own destroy clock. For those two the flag was filed as a
     per-turn ALLOWANCE instead of a TAP, so `perTurnCleared` lifted it at
     the turn boundary rather than at the controller's untap step. */
  const line = String(tx || "").split(/\n+/).map(l => clean(l))
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
/* ---- SPLIT CARDS (v3.34) ---------------------------------------------

   Two records in this pool are printed HORIZONTALLY and cut in half, and
   the reminder text on both says exactly what that means:

     Meld (You may play 1 or both halves of this card. Each costs 0.)

   IT IS ONE CARD, and that is the thing to hold on to. One pitch value,
   one defence value, one card in hand, one card in the graveyard. What is
   doubled is the TEXTBOX, not the card — so it cannot be dealt as two
   cards without breaking the 55-card count, the pitch value, the wall and
   the census all at once.

   You DECLARE, on playing it, which half you are playing — or, with meld,
   that you are playing both. The engine ran BOTH halves unconditionally
   and asked nothing, which made Burn Up // Shock deal FIVE arcane damage
   the moment it was played.

   THE BOUNDARY LIVES IN `tt`, AND ONLY THERE. `ty` flattens both faces
   into one list ("Runeblade","Action","Earth","Instant") — v2.39's note —
   so each half's types are read off its own segment of the display
   string. That is the documented case where `tt` knows more than `ty`. */
const isSplit = c => !!(c && (c.hz || /\/\//.test(String(c.tt || ""))));

/* The halves, left to right as the card is read when turned. Returns null
   for an ordinary card, so a caller must ask rather than assume. */
function splitHalves(c){
  if(!isSplit(c)) return null;
  const tts = String(c.tt || "").split("//").map(x => x.trim());
  const nms = String(c.name || "").split("//").map(x => x.trim());
  /* The text splits on a line that is exactly "//" — the database writes
     the separator as its own line between the two textboxes. */
  const lines = String(c.tx || "").split(/\n/);
  const at = lines.findIndex(l => l.trim() === "//");
  const txs = at < 0 ? [c.tx || "", ""]
    : [lines.slice(0, at).join("\n"), lines.slice(at + 1).join("\n")];
  if(tts.length < 2) return null;
  return tts.slice(0, 2).map((tt, i) => ({
    /* THE HALF IS A CARD FOR EVERY PURPOSE THE PARSER HAS. It carries the
       whole card's pitch, cost and defence, because those are printed once
       on the card and belong to it rather than to a half. */
    name: nms[i] || nms[0] || c.name, tt,
    ty: tt.split(/\s+/).filter(Boolean),
    tx: (txs[i] || "").trim(),
    /* A HALF'S KEYWORDS ARE WHAT ITS OWN TEXTBOX PRINTS, and the card's
       `card_keywords` list is NOT that: it is a keyword INDEX for the
       whole card (v2.31). Both of these print `["Meld","Go again"]` while
       Go again is on the TOP half only — copying the list to both halves
       hands the instant half a keyword it does not print, which is the
       most valuable keyword in the game to get wrong. Left empty, so
       `hasGA` and friends read the half's own text. */
    kw: [],
    pitch: c.pitch, cost: c.cost, def: c.def, power: c.power,
    uid: c.uid, _half: i, _of: c.name
  }));
}

/* WHICH HALF IS BEING PLAYED, as an fx (v3.34).

   `half` is 0, 1, or "both". For an ordinary card it is ignored and the
   card's own fx comes back, so every caller can ask unconditionally.

   MELD MERGES THE TEXTBOXES, NOT THE CARD. The CR is explicit that a
   melded split card is a SINGLE card, played as a SINGLE layer, with the
   properties of both sides — so the two op lists concatenate and the
   keywords are the union.

   RESOLUTION ORDER IS A STATED APPROXIMATION. The CR resolves a melded
   card one side then the other with priority between; this runs them in
   printed order as one layer. Both pool cards' halves are independent —
   two Runechants and 1 life, a delayed rider and 1 arcane — so no order
   is observable on either. Revisit if a split card ever prints halves
   that interact. */
function splitFx(card, half){
  if(!isSplit(card)) return fxParse(card);
  const hs = splitHalves(card);
  if(!hs) return fxParse(card);
  if(half === 0 || half === 1) return fxParse(hs[half]);
  const a = fxParse(hs[0]), b = fxParse(hs[1]);
  return Object.assign({}, a, b, {
    ops: [...(a.ops || []), ...(b.ops || [])],
    onHit: [...(a.onHit || []), ...(b.onHit || [])],
    conds: [...(a.conds || []), ...(b.conds || [])],
    ga: !!(a.ga || b.ga),
    self: (a.self || 0) + (b.self || 0),
    tier: (a.tier === "full" && b.tier === "full") ? "full" : "part"
  });
}

/* DOES THE CHOSEN HALF COST AN ACTION POINT? CR 8.1.1 / 8.1.6, and the
   ruling that makes melding expensive: if EITHER side of a melded card
   has the Action type the play costs an action point and needs an empty
   stack, even though the other side is an Instant. */
function splitCostsAP(card, half, window){
  if(!isSplit(card)) return costsAP(card, window);
  const hs = splitHalves(card);
  if(!hs) return costsAP(card, window);
  if(half === 0 || half === 1) return costsAP(hs[half], window);
  /* TWO DIFFERENT QUESTIONS, and they take different answers.

     "both" is MELD: the CR plays it as one layer on an empty stack for an
     action point if EITHER side is an Action, even though the other is an
     Instant. So: OR.

     NOTHING DECLARED YET is the affordability check asking whether the
     card can be played at all — and it can, if ANY half is free in this
     window. Answering it with meld's rule refuses a seat with no action
     point a card whose instant half costs none. So: AND. */
  if(half === "both") return costsAP(hs[0], window) || costsAP(hs[1], window);
  return costsAP(hs[0], window) && costsAP(hs[1], window);
}

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
/* THE UNION OF THE TWO ABOVE (v3.78) — Lyath's "defending ACTION cards
   you control get +1{d} this turn", where the printed subject is neither
   half but both. It is NOT `!isNonAtkActionCard`: a Defense Reaction
   carries no Action at all, so the complement of one twin sweeps in a
   whole type the card never names — the same trap "Reaction" contains
   "action" sets for a `tt` scan (v2.44). Ask the array for Action. */
const isActionCard = c => {
  const ty = (c && c.ty) || [];
  return ty.some(t => /^action$/i.test(String(t)));
};

/* ---- HOW MUCH ARCANE DAMAGE THIS CARD'S EFFECT DEALS (v3.39) --------
   Blaze's ability asks it twice — once as a FILTER ("with an effect that
   deals arcane damage equal to X") and once as the COST — so it lives in
   one place rather than being computed at each site.

   THE UNCONDITIONAL OPS ONLY. A gated arcane ("if you've dealt arcane
   damage this turn, deal 6 instead") is not an amount the engine can
   promise, and this number IS the price: Emeritus Scolding prints 4 with a
   conditional 6, and charging 6 for a card that deals 4 is the wrong
   direction. A card with no readable arcane answers 0 and is simply never
   offered — weaker than printed and visible. */
const arcAmount = c => !c ? 0 : (fxParse(c).ops || [])
  .filter(o => o && o[0] === "arcane" && typeof o[1] === "number")
  .reduce((a, o) => a + o[1], 0);

const zonePow = (c, b) => (c && c.power != null ? +c.power : 0)
  + ((b && b.atkPowOffChain && isAtkActionCard(c)) ? b.atkPowOffChain : 0);
/* THE EVENTS A `destroy this` COST MAY WATCH FOR (v3.93). A CLOSED
   vocabulary, and closed harder than most: the cost DESTROYS the
   player's own equipment, so a trigger nobody built would spend a piece
   on an event that never happens — or worse, on one that happens for a
   different reason. Two entries, one per pool record.

   THE THRESHOLD TRAVELS WITH THE TRIGGER rather than being known by the
   site that fires it (v3.88's `thisWayMet` rule): Beaten Trackers prints
   6 and is the only card of its shape, so a literal at the fire site is
   invisible to every pool fixture.

   "A RANDOM CARD" IS THE DISTINCTION THAT MATTERS. Kayo's hero clause
   fires on ANY discard; this one only on a random one, and reading the
   two as the same event hands out a free action point every time a cost
   is paid by choice. */
function destroyTrigger(phrase){
  const p = String(phrase||"").trim().toLowerCase();
  let m;
  if((m = p.match(/^you discard a random card with (\d+) or more \{p\}$/)))
    return {trigger: "discardRandom", trigN: +m[1]};
  if(/^an? weapon attack you control hits$/.test(p))
    return {trigger: "weaponHit"};
  return null;
}

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
  /* A KEYWORD LINE MAY CARRY A RIDER (v3.33), and 21 pool cards print one:
     the database writes a TRIGGERED keyword as "Crush - When this deals 4
     or more damage to a hero, …" — still its own line, still the layout
     rule this function is built on, and the old test demanded the line be
     the keyword and NOTHING else. So `printedKw(c,"crush")` was FALSE for
     every crush card in the pool, and the same for reprise, high tide,
     surge and heave.

     THE WIDENING IS THE DASH, NOT A SUBSTRING. The keyword must still
     START the line, so "when you boost a card" and "your attacks with
     stealth" — the references this function exists to exclude — are
     untouched. Measured across the pool and every keyword: 21 answers
     move, all of them cards that genuinely carry the keyword, and none
     for boost, go again, stealth or dominate.

     A PARAMETER IS PART OF THE KEYWORD. "Heave 3" is one line. */
  if(raw.split(/\n+/).some(l => new RegExp(
        "^\\**" + esc + "(?:\\s*\\d+)?\\**\\.?(?:\\s*[-\u2014]\\s|$)", "i").test(l.trim())))
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

/* ---- THE SPEED GRANT'S CONDITION, READ AND ANSWERED (v3.36) ---------
   Two halves, deliberately apart. `asInstantCond` reads the printed gate
   off the card and is a pure statement about TEXT; `asInstantMet` answers
   it against the game and is a pure statement about STATE, with the state
   supplied by the caller. Same split `defSelf` / `defSelfMet` keep, and
   for the same reason: neither board can answer these from the card.

   THE CONDITION VOCABULARY IS CLOSED, and each entry is one printed
   wording rather than a family. A gate this cannot read returns null, the
   clause stays unread, and the card keeps its printed window. */
function asInstantCond(gate){
  /* NO GATE AT ALL is a grant that always applies. No pool card prints
     one today; it is read because the sentence is grammatical without the
     if-clause and refusing it would be refusing the simplest form. */
  if(gate == null) return {when: "always"};
  /* LEVELLED HERE, because this loop scans RAW clauses (like `defSelf`
     beside it) rather than the lowercased text `classifyClause` works on
     — so without this the gates would have to spell every contraction
     twice, which is the drift SYNONYMS exists to delete. */
  const g = levelIdiom(String(gate).trim().toLowerCase());
  /* "if it is not your turn" — Cindering Foresight x3, and the same gate
     Iyslander's hero line prints. Levelled from "it's" by SYNONYMS. */
  if(/^it is not your turn$/.test(g)) return {when: "notYourTurn"};
  /* "if you control a Spectral Shield" — Astral Etchings x3. The NAME is
     captured off the card rather than listed here: a table of names is
     card text written into the engine, which is the golden rule's whole
     point. Answered against the caller's board. */
  let m = g.match(/^you control an? (.+)$/);
  if(m) return {when: "controls", name: m[1].trim()};
  /* "IF YOU HAVE PLAYED ANOTHER <class> NON-ATTACK ACTION CARD THIS TURN"
     — Snapback x3, REFUSED at v3.36 for want of a class-aware turn
     history. `hist.playTy` is that history (v3.38): the structured type
     words of every card played this turn, so the class and the type can
     be asked TOGETHER. Reading it as the bare `non` count would have
     granted the window off any non-attack at all — stronger than the
     card's own text, which is why it waited for the record rather than
     being approximated.

     THE CLASS IS CAPTURED off the card, never listed here. */
  m = g.match(/^you have played another ([a-z]+) non-attack action card this turn$/);
  if(m) return {when: "playedAnotherCls", cls: m[1]};
  return null;
}

function asInstantMet(g, o){
  if(!g) return false;
  o = o || {};
  switch(g.when){
    case "always":      return true;
    case "notYourTurn": return !!o.notYourTurn;
    /* A BOARD SCAN BY THE CARD'S OWN PRINTED NAME. The board is entries,
       not cards — `b.card.name` — which is the shape every other board
       reader here takes. */
    case "controls":
      return (o.board || []).some(b => b && b.card
        && String(b.card.name || "").toLowerCase() === g.name);
    /* THE CLASS AND THE TYPE ARE ASKED TOGETHER, off ONE recorded entry.
       A flat set of words would answer TRUE for a Wizard ATTACK plus an
       unrelated non-attack — two cards contributing half the condition
       each, which is not what the card asks. */
    case "playedAnotherCls":
      return ((o.hist || {}).playTy || []).some(ty =>
        ty.indexOf(g.cls) >= 0 && ty.indexOf("action") >= 0 && ty.indexOf("attack") < 0);
  }
  /* AN UNKNOWN `when` RETURNS FALSE (v3.26). A condition added to
     `asInstantCond` and forgotten here leaves the card in its printed
     window: weaker than printed and visible, where the other direction
     opens a window nobody built. */
  return false;
}

/* ---- MAY THIS CARD BE PLAYED AS AN INSTANT, RIGHT NOW? (v3.36) ------
   The ONE question, asked by both boards at the play site. It answers
   for TWO printed sources, because they are the same question and
   building only one leaves the same gap wearing the other's name:

     * the CARD's own line   — `fx.asInstant`, above
     * the HERO's standing grant over a zone — Iyslander's clause 1,
       which is a build passive (`arsenalInstant`) rather than a clause
       and so cannot be read off the card at all.

   Pure, and the game's half arrives in `o`: whose turn it is, the board,
   the zone the card sits in, and whether the acting hero grants the
   arsenal window. `playableFromZone` is the model. */
const playsAsInstant = (c, o) => {
  if(!c) return false;
  o = o || {};
  /* IYSLANDER: "If it's not your turn, you may play BLUE NON-ATTACK
     ACTION CARDS FROM YOUR ARSENAL as though they were instants."
     Every one of those four words is a gate, and `isNonAtkActionCard`
     reads the STRUCTURED ARRAY, so an Instant already in the arsenal is
     not an Action and is correctly left alone — it needs no grant. */
  /* A STAMP ON ONE CARD INSTANCE (v3.39) — Blaze banishes a card and it
     "may be played this turn as though it were an instant". A stamp
     rather than a grant because it names THAT COPY rather than a
     qualifier, and it rides on the card the way `_playTurn` does. The
     zone check is `playableFromZone`'s job; this answers only the SPEED. */
  if(c._asInstant) return true;
  if(o.arsenalInstant && o.zone === "arsenal" && o.notYourTurn
     && isNonAtkActionCard(c) && (c.pitch || 0) >= 3) return true;
  /* A GRANT THE SIDE IS ALREADY HOLDING (v3.37) — Stir the Aetherwinds.
     READ, NEVER SPENT: this is asked on every dim and every legality
     check, so consuming here would burn the grant on merely LOOKING at
     the hand. `takeInstantNext` in effects.js spends it, once, when the
     card is actually played. Same read/spend split `effCost` keeps for
     `costOff` (v3.32), and for the same reason. */
  if((o.grants || []).some(gq => qualMatches(gq, c, o))) return true;
  return asInstantMet(fxParse(c).asInstant, o);
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
/* WHICH WINDOW AN ACTIVATED ABILITY HAPPENS IN (v3.63).

   Three flavours, and the FLAG is the answer: `build.js` stamps `_instant`
   and `_attackRx` onto the powCard because its `tt` reads "Equipment
   Ability" / "Hero Ability" and carries no printed type at all.

   ONE BODY BECAUSE FOUR SITES ASK IT — judge's hero branch, judge's
   equipment branch, and both of the trainer's gear taps. Two of those were
   already hand-rolled ternaries kept in step by hand, which is how
   `rxAllowed` came to exist: five copies of "may this be played here" had
   drifted, and the drift showed up as a card that looked playable and did
   nothing when tapped. */
const abWindow = ab => ab && ab._attackRx ? "attack-reaction"
                     : ab && ab._instant  ? "instant" : "action";

/* HOW MANY CARDS MAY DEFEND THIS ATTACK (v3.64) — the ONE reader.

   Two printed sources cap the wall and they count DIFFERENT SETS, which
   is the whole reason this is a function rather than a number:

     dominate         1 card FROM HAND. The database prints no reminder
                      text for any keyword — which is why `tools/rulings.json`
                      exists — and this project's recorded reading (see
                      CLAUDE.md, "Key implemented rules") is the hand limit.
                      Changing it is a RULING, not an engineering call.
     `defCapNext`     Confidence's grant, and its counted set is read off
                      the printed word: "non-block cards". Block is a TYPE,
                      so a declared piece of EQUIPMENT is a non-block card
                      and counts against it.

   IT WAS ENFORCED ON ONE BOARD. `dummyDefence` capped the dummy's own
   pick at `dominating ? 1 : 2` — the 2 being a HEURISTIC, how many cards
   it chooses to spend — and `judge.legal`'s defend branch mentioned
   dominate nowhere at all, so at the table any number of cards could be
   declared against a dominate attack. v3.01's shape: a rule that exists
   on one board.

   THE GRANT IS THE CALLER'S ANSWER, like the wall and the incoming
   attack: only the site holding `pend` knows which one-shot restriction
   this attack took. Absent, the answer is the card's own dominate, and
   that is weaker than printed rather than stronger.

   Returns `{n, count}` or null. The TIGHTEST cap wins when both apply —
   two restrictions do not cancel. */
/* WHAT AN ACTIVATED ABILITY COSTS BEYOND RESOURCES (v3.74). Today that is
   one thing — a soul banish — and it exists as a named reader rather than
   two boards each reaching for `ab._soulCost`, because a cost read in one
   place and forgotten in the other is the v3.01 shape this project pays
   for on nearly every page. Both boards ask it before the ability resolves
   (v3.11): refusing afterwards costs the player an activation the rules
   never allowed. */
/* DOES THIS CARD CEASE TO EXIST INSTEAD OF REACHING A GRAVEYARD? (v3.82)

   ONE READER, because there were two and they disagreed. The trainer's
   `gy()` tested the KEYWORD LIST and judge's `toGrave` tested the printed
   REMINDER SENTENCE — and measured across all 797 records, **one card is
   ephemeral by keyword and NOT ONE prints the reminder text**. So judge's
   regex matched nothing, ever, and Crouching Tiger reached the graveyard
   at the table: a card the rules remove from the game handed back to the
   player, on the board that is supposed to be the CR-exact one.

   The database carries no reminder text for ANY keyword — this file says
   so in four other places — so that reader was doomed the day it was
   written. `printedKw` is the right question (v2.84's three): does the
   card CARRY it as printed rules text. Crouching Tiger's whole text is
   "**Ephemeral**\n\n**Go again**", two keyword lines and nothing else. */
const isEphemeral = c => printedKw(c, "ephemeral");
const abSoulCost = ab => (ab && ab._soulCost) || 0;
/* ITS SIBLING (v3.79) — does the ability ALSO banish its own source?
   One reader, for the same reason `abSoulCost` is one: a cost read in one
   place and re-derived in the other is two descriptions of one price. */
const abSelfBanish = ab => !!(ab && ab._selfBanish);
/* THE NAMED BOARD PERMANENT AN ABILITY'S COST DESTROYS (v3.86), or null.
   One reader, for the reason `abSoulCost` and `abSelfBanish` are one: a
   cost read in one place and charged in another is how an ability comes
   to be free on one board (v2.04, v3.01). */
const abDestroyBoard = ab => (ab && ab._destroyBoard) || null;
/* THE PERMANENT THAT COST NAMES, on one side's board — or null (v3.86).
   ONE reader, because "which card satisfies the cost" is asked in three
   places (both boards' legality and `execute`'s charge) and three
   spellings of a name match is how an ability comes to be legal on one
   board and free on another (v3.01).

   FIRST MATCH IN BOARD ORDER, deliberately. Two Gold tokens are
   indistinguishable — nothing in the pool tells one from the other — so
   there is no choice to offer, and a sheet with one forced option is a
   tap that teaches nothing (v3.55). Board order is a TOTAL order, which
   is what keeps two peers replaying one log on the same entry. */
function boardEntryNamed(sd, name){
  if(!sd || !name) return null;
  const want = String(name).toLowerCase();
  return ((sd.board || []).find(b => b && b.card
      && String(b.card.name || "").toLowerCase() === want)) || null;
}

function defCap(card, held, opts){
  const caps = [];
  /* A GRANTED dominate IS THE CALLER'S ANSWER. `hasKwNow` drops a keyword
     the text only grants under an if/unless (v2.31's rule, applied to
     `hasKw` at v2.84), and `_kwGrant` is how the clause hands it over when
     the gate DOES fire — a fact about this resolution that no reader of
     the card alone can see. A caller that does not say answers no: weaker
     than printed and visible. */
  const granted = ((opts && opts.kwGrant) || []).indexOf("dominate") >= 0;
  if(granted || (card && hasKwNow(card, "dominate"))) caps.push({n: 1, count: "hand"});
  if(held && held.n != null) caps.push({n: held.n, count: held.count || "hand"});
  if(!caps.length) return null;
  /* THE TIGHTEST CAP WINS — two restrictions do not cancel, and taking
     the looser one would let a card through that either alone forbids. */
  return caps.reduce((a, b) => b.n < a.n ? b : a);
}

/* Does a declared defender COUNT against a cap? `hand` is the recorded
   dominate reading — equipment is declared separately and freely.
   `nonBlock` is Confidence's printed word, and a Block card is the one
   thing it excludes; `types.js` is the authority on what a Block is, but
   parser.js loads before it, so the printed line is read here the same
   way `isAttack` reads it. */
const isBlockCard = c => /\bblock\b/i.test((c && c.tt) || "");
function defCounts(cap, card, fromGear){
  if(!cap) return false;
  if(cap.count === "hand") return !fromGear;
  return !isBlockCard(card);          /* nonBlock — equipment counts too */
}

const costsAP = (c, window) => {
  /* An ACTIVATED ATTACK REACTION is never played in the action window
     (v3.63), so it never carries CR 8.1.1's point — the same reading this
     function already gives a reaction CARD one line down, stated for the
     flag because a powCard has no printed type line to read it off. */
  if(c && c._attackRx) return false;
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

return {norm, isAttack, isArrow, isWeapon, hasGA, arcaneDmg, num, clean, optFilter, pickSubject, attackQual, qualMatches, abWindow, defCap, defCounts, isBlockCard,
        nextTurnTax, nextTurnDebuff, nextTurnHas, nextTurnBars, qualLabel, attackTail, isSplit, splitHalves, splitFx, splitCostsAP, isNonAtkActionCard, isActionCard, costOffFor, heaveOf,
        classifyClause, fxParse, fxReset, playableFromZone, playsAsInstant, asInstantCond, asInstantMet, arcAmount, parseHeroPower, parseHandAbility, runeRed, boardRed, effCost,
        dracLinks, weaponCost, allyAttack, auraWeaponGrant, wardValue, auraAttackOf, abilityGa, attackLineGa, perTurnCleared, tapsToActivate, instantAbilityReady, hasKw, isAR, isDR, isRx, isInstantT, costsAP, rxAllowed, rxPump,
        idleCounterWipes, rustedThrough,
        isAtkActionCard, zonePow, pow6, kwGated, hasKwNow, printedKw,
        isRunechant, runeCount, isAura, auraCount, isFrostbite, frostCount,
        isFrailty, frailtyCount,
        arcaneBarrier, spellvoid, arcaneSoaks,
        ARS_PUT, ARS_STAMP, arsCap, arsCount, arsFree, arsEmpty, abSoulCost, abSelfBanish, abDestroyBoard, boardEntryNamed, isEphemeral,
        CARD_OVERRIDES};
});
