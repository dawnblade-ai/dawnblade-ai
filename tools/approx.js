/* ============================================================
   THE APPROXIMATION LEDGER — every place this engine knowingly
   differs from the Comprehensive Rules, enumerated once, with
   its honest status and the board it lives on.

   ---- WHY THIS FILE EXISTS -------------------------------------------

   `tools/ledger.js` does this for KEYWORDS and it has caught twelve
   stale records — nine at v3.99, three more in this sweep — every one
   of them found by asking the engine rather than by reading the note.
   Nothing did it for the RULES MACHINE the cards run inside, and that
   machine has been accumulating stated approximations since v2.45's CR
   review without anyone ever sweeping them.

   CLAUDE.md's "Known approximations" section was that list, in prose.
   **A DOC CLAIM IS A TEST WITH NO ASSERTION** (v3.41), and the sweep
   that produced this file found SEVEN of its entries had stopped being
   true — six closed by later work with the record left standing, and
   one whose stated REASON had gone false while its conclusion held.

   ---- THE TWO PROBE DIRECTIONS ---------------------------------------

   Every entry carries a probe in `test/approx.test.js`, and the STATUS
   says which way the probe points:

     stated / open   the deviation IS still in place. The probe asserts
                     that it is — so the drill goes RED the day somebody
                     builds it, which forces the record to be deleted
                     rather than left to rot. v3.41's rule, as a test.

     closed          the record was found stale in this sweep and the
                     prose has been corrected. The probe asserts the
                     thing IS built, so a regression is red.

   `stated` and `open` differ only in whether there is an argument for
   the deviation. A `stated` one has a reason written down that survives
   re-reading; an `open` one is a gap nobody has justified, and is work.

   ---- WHAT A PROBE MUST DO -------------------------------------------

   DRIVE IT, DON'T GREP IT. A textual scan cannot tell a test from a
   NEUTERED one and a source slice rots where a rule moves (v3.22,
   v3.28, v3.94). Where a claim is genuinely ABOUT the source — "the
   trainer still gates its windows on `mode`" is a claim about
   index.html's babel blocks, which no drill can execute — the probe
   says so in the drill and pins the shape precisely enough that
   neutering it breaks the test.

   ---- FIELDS ---------------------------------------------------------

     status   stated | open | closed
     cr       the CR rule deviated from, or null where the CR is silent
     board    both | trainer | table — v3.01's shape is the recurring
              defect here, so which board a deviation lives on is part
              of the record rather than something to go and find out
     claim    the deviation, in one sentence
     why      the argument for it (stated), or what it is waiting on
              (open), or what closed it (closed)
     since    the version that recorded it
     swept    the version that last asked the engine about it
   ============================================================ */

const APPROX = {

/* ---- A. THE RULES MACHINE — the two-player question ---------------- */

"layer-step-window": {
  status:"open", cr:"CR 7.1.2", board:"both", since:"v2.45", swept:"v4.02",
  claim:"An attack goes straight onto the combat chain. In the CR it sits on the "+
        "stack as a layer first, and both seats may respond before it becomes a "+
        "chain link.",
  why:"Needs the stack/queue, which priority.js already has hooks for "+
      "(`queueEmpty`, `passOutcome`'s `resolve-layer`). The WINDOW itself is not "+
      "lost — the ATTACK step immediately after opens an equivalent instant "+
      "window for both seats — so what is missing is the distinction between "+
      "'on the stack' and 'on the chain', which no card in this pool asks about."},

"simultaneous-trigger-order": {
  status:"open", cr:"CR 4.1.8a", board:"both", since:"v2.45", swept:"v4.02",
  claim:"Simultaneous triggers resolve in a fixed printed order. CR 4.1.8a hands "+
        "the order to the turn-player.",
  why:"`beginEndPhase` is six steps in a fixed order and the order is load-bearing "+
      "for reasons that are NOT the CR's (rust before the idle wipe before the "+
      "gear sweep — specific readers first). Letting a player reorder them would "+
      "need a prompt in a phase where CR 4.4.1 gives nobody priority."},

"gear-sweep-timing": {
  status:"stated", cr:"CR 4.4.3", board:"both", since:"v3.54", swept:"v4.02",
  claim:"A destroyed piece of gear is filed to the graveyard at the beginning of "+
        "its controller's end phase. The CR files a destroyed permanent immediately.",
  why:"It is a SWEEP rather than an inline move because the trainer's wall holds "+
      "`blockG` as INDICES into `gear`, so removing an entry while a wall is "+
      "declared renumbers the defenders underneath it — and `gearBlockApply` "+
      "destroys a battleworn piece during exactly that resolution. The observable "+
      "difference needs a destroy AND a retrieve inside one turn cycle."},

"heave-window": {
  status:"stated", cr:"CR 4.4.1", board:"both", since:"v3.32", swept:"v4.02",
  claim:"Heave is offered at the arsenal step rather than at the beginning of the "+
        "end phase, where the card prints it.",
  why:"CR 4.4.1 gives nobody priority in the end phase, so the only place a CHOICE "+
      "can be put to a player is a pause the turn structure already owns — and "+
      "this effect IS an arsenal set: it requires an empty arsenal and it fills "+
      "the arsenal. The one observable difference is Inertia's hand sweep firing "+
      "first, which already precedes the ordinary arsenal set on both boards."},

"start-phase-passthrough": {
  status:"stated", cr:"CR 4.2.1", board:"table", since:"v2.45", swept:"v4.02",
  claim:"No state ever RESTS in the start phase — `endTurn` leaves the incoming "+
        "seat there and the arsenal handoff moves them on in the same breath.",
  why:"CR 4.2.1 gives nobody priority in the start phase, so the only thing that "+
      "can happen in it is a start-of-turn trigger. This is correct rather than a "+
      "shortcut, and it becomes a real pause the day a card needs one."},

"trainer-fatigue-loss": {
  status:"open", cr:"CR 4.5.3", board:"trainer", since:"v2.45", swept:"v4.02",
  claim:"index.html ends the game when seat 0's deck is empty — 'fatigued'. CR "+
        "4.5.3 has THREE ways to lose and no more: life to zero or no hero, an "+
        "effect that says so, and concede.",
  why:"judge.js removed it at v2.45 and the trainer kept it, so this is v3.01's "+
      "one-board shape with the invented rule on the solo board. Left alone "+
      "deliberately because seat 1 reshuffles rather than decking out, which makes "+
      "changing it a decision about SOLO PLAY rather than a rules fix."},

"attack-ops-at-resolution": {
  status:"stated", cr:"CR 7.2", board:"both", since:"v3.88", swept:"v4.02",
  claim:"On an ATTACK card a bare \"when this attacks\" payload rides to "+
        "RESOLUTION with `pend.ops`. The printed trigger fires on DECLARATION.",
  why:"MEASURED BY DRIVING (v4.03 — the first version of this record counted op "+
      "KINDS and pinned eleven, which is the thing this project says not to do; "+
      "`execute`'s pre-run already runs draw/discardRandom at declaration, so "+
      "three were never late). Declared as real attacks: 17 cards carry a "+
      "payload, 9 still hold it in `pend.ops` at resolution, and 2 of those "+
      "carry only a noop — leaving SEVEN observably late. "+
      "AND EACH IS LEFT FOR ITS OWN REASON rather than as one blanket "+
      "approximation: `buffNext` (Fire Tenet, Teklo Trebuchet) CANNOT move — the "+
      "pre-run happens before `pend` is built, so a next-attack grant fired there "+
      "would be taken by THIS attack, a self-pump the card does not print. "+
      "`pickPrompt` (Pick Up the Point) opens a sheet mid-declaration, and "+
      "`openPrompt` drains at the tail of the caller. `arcane` (Vexing Malice), "+
      "`rune` (Spellblade Assault), `costTax` (Hyper Inflation) and `dracNext` "+
      "(Brand with Cinderclaw) touch nothing this attack resolves and are the "+
      "four that COULD move — each is a behavioural change to a real card and "+
      "wants its own version, not a blanket sweep. Concoct Disorder was moved at "+
      "v3.88 for exactly that kind of per-card reason. "+
      "AND ASKING WHAT READS THEM CAME FIRST (v4.06). Two of the four were not "+
      "waiting on a timing decision at all: `costTax` had NO READER — Hyper "+
      "Inflation was inert on both boards while its feed line said otherwise — "+
      "and `dracNext` was a single-shot grant nothing spent and, at the table, "+
      "nothing cleared. Both are built now, which also SHARPENS what is left "+
      "here: moving `dracNext` to declaration needs Brand to be excluded from "+
      "its own grant, because its link is pushed before its ops run today and "+
      "would not be if the op fired earlier."},

"trainer-priority-machine": {
  status:"stated", cr:"CR 4.2-4.4, 7.x", board:"trainer", since:"v2.27", swept:"v4.02",
  claim:"`Battle` gates its windows on `mode`/`bphase` rather than on "+
        "priority.js's phase/step/priority machine. The machine runs in SHADOW "+
        "there, deriving state through `fromTrainer` and driving nothing.",
  why:"The trainer is the solo board and the regression harness; the CR machine "+
      "drives the TABLE, which is where two players meet. Retiring `Battle`'s "+
      "rules is FINISH.md's phase A and sequences with tuning (v3.00), because it "+
      "retires the tuned [3,4,5] escalation with them."},

"trainer-attack-target": {
  status:"stated", cr:"CR 1.4.5", board:"trainer", since:"v3.46", swept:"v4.02",
  claim:"The trainer never asks the player to choose an attack-target. judge.js "+
        "declares, validates and resolves them.",
  why:"MEASURED BEFORE BEING LEFT (v3.46): the trainer's opponent is DUMMY_DECK — "+
      "twelve vanilla attacks with no allies — and its swing is the [3,4,5] "+
      "fabrication with no target choice. It can never field an ally to attack, so "+
      "a target picker there is dead code."},

/* ---- B. CARD SEMANTICS -------------------------------------------- */

"x-cost": {
  status:"open", cr:null, board:"both", since:"v2.32", swept:"v4.02",
  claim:"An X cost or an X quantity is REFUSED rather than read. Ice Eternal "+
        "prints cost XX and 'create X Frostbite tokens'.",
  why:"Creating ONE token for a card that charges for X is quietly weaker than "+
      "printed — which coverage reads as `full` and the one-sided fairness sweep "+
      "cannot see. Refusing leaves it a visible gap. Blaze's 'remove X energy "+
      "counters' is NOT this shape (v3.39): X is settled by the card the player "+
      "picks, so the coupling lives in the filter and no X machinery is needed."},

"spellvoid-x": {
  status:"stated", cr:null, board:"both", since:"v2.32", swept:"v4.02",
  claim:"Mask of the Swarming Claw's 'Spellvoid X, where X is the number of chain "+
        "links you control' is refused; the piece keeps its printed Arcane "+
        "Barrier 1.",
  why:"Same refusal as Ice Eternal's, plus the chain belongs to the ATTACKER "+
      "rather than to the hero being hit. NOTE — THE NOOP'S OWN REASON WAS STALE "+
      "and is corrected at v4.02: it read 'the dummy throws only fists', a "+
      "training prop retired at v2.71, while plain spellvoid and arcane barrier "+
      "have been paid at the point arcane damage is dealt (`arcaneSoaks`) for "+
      "versions."},

"crush-halving-rider": {
  status:"open", cr:null, board:"both", since:"v3.29", swept:"v4.02",
  claim:"Walk in My Shoes' crush rider halves the base {p} and {d} of the "+
        "opponent's cards for a turn, and has no reader.",
  why:"The other four next-turn crush riders landed at v3.29 (two debuffs) and "+
      "v3.30 (two restrictions). This one needs Lyath's halving (v3.78) aimed at "+
      "the OTHER seat for one turn — `halveCard` runs once at the DEAL, which is "+
      "the whole of its safety argument, so a turn-scoped halving is a different "+
      "mechanism rather than the same one pointed elsewhere."},

"surge-approximated": {
  status:"stated", cr:null, board:"both", since:"v3.70", swept:"v4.02",
  claim:"The Surge condition is evaluated as `amp > 0` rather than as the arcane "+
        "damage actually dealt.",
  why:"`partial` counts as built for an UPSIDE and never for a drawback (v3.00), "+
      "and surge is an upside. Both pool records read `full` and the difference is "+
      "observable only where an amp is held and the damage is then prevented."},

"auto-pitch-discard": {
  status:"stated", cr:null, board:"trainer", since:"v2.04", swept:"v4.02",
  claim:"Where a card forces a pitch or a discard with no printed choice, the "+
        "trainer auto-picks the lowest advisor-valued card rather than prompting.",
  why:"A prompt for every forced discard is a tap that teaches nothing (v3.55's "+
      "rule about a single forced choice), and the prompt machinery exists for "+
      "the cards that print a real CHOICE. The advisor value is the same ranking "+
      "the coach shows, so the pick is at least explicable."},

"unbuilt-three": {
  status:"open", cr:null, board:"both", since:"v3.79", swept:"v4.02",
  claim:"Three pool DECK cards read tier `none`: Glisten (distribute up to four +1{p} "+
        "counters among any number of weapons), Danger Digits (a 'has hit' fiction "+
        "for a dagger that never attacked), Hope Merchant's Hood (shuffle any "+
        "number of cards from hand into the deck, then draw that many).",
  why:"NONE of the three is waiting on its payload — every effect reads. What "+
      "refuses is a PROMPT shape (a distribution sheet), a FICTION (a hit by a "+
      "card that did not attack), and a ZONE MOVE (deck manipulation). "+
      "THE PROBE PINS THE HERO AND TOKEN SETS SEPARATELY, and that is what "+
      "found INERTIA at v4.03: a token reading `none` that WORKED, because "+
      "`effects.isInertia` matched it by NAME. Its wipe is read now and the "+
      "token set went 8 -> 7. The remaining seven are the honest kind."},

/* ---- C. RECORDS THIS SWEEP FOUND STALE ----------------------------- */

"heave-faceup-trigger": {
  status:"closed", cr:null, board:"both", since:"v3.71", swept:"v4.05",
  claim:"WAS: 'heave is a THIRD site that sets `_faceUp` and fires no trigger — "+
        "measured, latent, and recorded rather than half-moved.'",
  why:"CLOSED AT v4.05. It was blocked by SHAPE rather than by judgement: `heave` "+
      "is module-level in effects.js and `faceUpArsenal` lives inside "+
      "`makeEffects`, so the zone move could not reach the one reader. The reader "+
      "is EXPOSED on makeEffects' returned object now and both arsenal steps call "+
      "it — heave stays a zone move, and there is still exactly one face-up walk. "+
      "STILL LATENT: Thunder Quake is Guardian and no arrow deck holds it, so no "+
      "pool fixture drives this and only a synthetic can (v3.73)."},


"runechant-same-swing": {
  status:"closed", cr:null, board:"both", since:"v2.23", swept:"v4.02",
  claim:"WAS: 'a runechant created by PLAYING an attack pops on that same swing; "+
        "strictly it should survive to the next.'",
  why:"CLOSED AT v2.23 and the record stood for eighty versions. `execute` "+
      "captures `runeAtPlay` before the card does anything and pops only that "+
      "many, straight off the token's printed trigger — 'when you PLAY an attack "+
      "action card', so one created BY that card never triggered for it."},

"ally-swing-free": {
  status:"closed", cr:"CR 8.1.1", board:"both", since:"v3.44", swept:"v4.02",
  claim:"WAS: 'ally swings are simplified (no action point consumed).'",
  why:"CLOSED AT v3.44. `allySwing` — which took the ally's printed power straight "+
      "off the opposing hero's life for free — is gone; an ally attacks through "+
      "`from:\"ally\"` in `execute`, which charges the ability's own cost, the "+
      "action point at resolution, and opens a real defend step."},

"if-you-do-unread": {
  status:"closed", cr:null, board:"both", since:"v3.88", swept:"v4.02",
  claim:"WAS: '\"If you do, …\" is deliberately unread. It hangs off an optional "+
        "cost the engine cannot model; running it would re-introduce the free-"+
        "ability bug v2.04 fixed.'",
  why:"CLOSED ACROSS v3.88-v3.95. `thisWayMet` answers a `way:` condition after "+
      "the ops have run (v3.60's late pass), `_costWay` records which branch of a "+
      "modal cost was taken (v3.90), and `_tookWay` records a card taken from the "+
      "opponent (v3.95). BOTH SPELLINGS read — 'if you do' and 'if they do'. The "+
      "v2.04 property is intact: the rider fires only when the cost was paid."},

"arena-payload-on-play": {
  status:"closed", cr:null, board:"both", since:"v3.07", swept:"v4.02",
  claim:"WAS: '\"When this leaves/enters the arena, …\" fires its payload when the "+
        "card is PLAYED, so a Suspense aura\\'s +{p} lands early.'",
  why:"CLOSED AT v3.07 (`effects.sweepArena` — the payload rides AFTER the destroy "+
      "in printed order) and v3.20 (`entersLeaves` — one printed clause naming two "+
      "events, answered by two sites). Suspense ticks in `tickSuspense`, which "+
      "both turn structures call."},

"inertia-noop": {
  status:"closed", cr:null, board:"both", since:"v3.17", swept:"v4.02",
  claim:"WAS: 'Inertia is still a `noop` and its stated reason (\"the dummy has no "+
        "action phase\") is now false — it is the obvious next one to make real.'",
  why:"CLOSED. `effects.resolveInertia` is a hand wipe at the beginning of its "+
      "controller's end phase, exported, called from `beginEndPhase`, and reached "+
      "by BOTH boards. The clause is still filed `noop` and that is now CORRECT: "+
      "the noop's reason names the reader (v3.16), and the reader exists."},

"soul-unexercised": {
  status:"closed", cr:null, board:"both", since:"v2.18", swept:"v4.02",
  claim:"WAS: '`soul` is the one migrated zone never exercised in live play — its "+
        "write path is untested, not proven. Drive Gravy Bones by hand.'",
  why:"CLOSED. The soul is driven by drills across six files — Boltyn's soul-banish "+
      "ability cost (v3.74), Gravy Bones, Fai's charge, Halo of Illumination's pick "+
      "to the soul (v4.01), Radiant Touch's cost (v3.79) and Cloaked. It is charged "+
      "by `execute` and refused when empty on BOTH boards."},

"dummy-no-action-phase": {
  status:"closed", cr:"CR 4.3", board:"table", since:"v2.71", swept:"v4.02",
  claim:"WAS: 'the dummy still has no action phase, so effects that target an "+
        "opponent\\'s TURN (frostbite, inertia, crush\\'s next-turn debuffs) stay "+
        "inert until it takes a real turn.'",
  why:"CLOSED AT v2.71 for the TABLE: seat 1 has a start phase, an action point it "+
      "spends, a priority window and the shared end phase. `sparring.act` plays "+
      "real cards there. It remains true of the TRAINER, where the opponent is the "+
      "[3,4,5] escalation — which is `trainer-priority-machine`'s entry, not this "+
      "one, and is why this record needed splitting rather than deleting."},

/* ---- D. OPEN DESIGN QUESTIONS — recorded, not decided -------------- */

"aura-ward-prevention-pool": {
  status:"open", cr:null, board:"both", since:"v3.84", swept:"v4.02",
  claim:"A board aura's printed `Ward N` DOES feed its controller's prevention "+
        "pool today — once, at resolution, through the generic `ward` op — and "+
        "whether that is right is not decided.",
  why:"Cosmo's own text settles what the number MEANS for an aura weapon — 'base "+
      "{p} equal to their ward' — and says nothing about prevention. The database "+
      "prints no reminder text for ward, so deciding it is a RULING rather than an "+
      "engineering call, and half-building a value change is worse than the honest "+
      "gap (v3.23). "+
      "THE CLAIM WAS CORRECTED AT v4.07: it read 'not decided', which implied "+
      "nothing happened. Measured — Spectral Shield, Waxing Specter and Uphold "+
      "Tradition all parse to `[[\"ward\", N]]` and `execute` adds it — so the "+
      "question was answered by accident, in the affirmative, as a ONE-SHOT that "+
      "outlives the aura. v3.69's rule: when a record says a thing is undecided, "+
      "go and ask the engine. "+
      "AND v4.07's ward sweep DELIBERATELY DOES NOT TOUCH IT. Every printed "+
      "prevention says 'this turn' and expires; the aura keyword prints no window, "+
      "so `wardTurn` records only the windowed portion and the sweep takes exactly "+
      "that. Sweeping the pool whole would have decided this ruling by accident a "+
      "second time."},

"cloaked-face-down-values": {
  status:"open", cr:null, board:"both", since:"v3.99", swept:"v4.02",
  claim:"Whether a face-down (Cloaked) piece keeps its printed defence and its "+
        "Ward 1 is not decided.",
  why:"ENG005 prints 'Cloaked (Equip this face-down.)' and the flip cost, and "+
      "nothing else. What face-down MEANS for a value is not stated, so the build "+
      "is deliberately narrow: it gates the one thing the card's own text spends "+
      "it on."},

"cloaked-display": {
  status:"open", cr:null, board:"both", since:"v3.99", swept:"v4.02",
  claim:"The Cloaked ruling's display half — 'SHOW CARD BACK ON THE PLAYERS "+
        "BOARD' — is not built.",
  why:"Deferred with the rest of the UI pass, deliberately and on the record. It "+
      "is one shared component (`ArmorGrid`'s cell), so both boards get it in one "+
      "edit when that pass happens."},

"peers-hold-full-state": {
  status:"stated", cr:null, board:"table", since:"v2.49", swept:"v4.02",
  claim:"Both networked peers hold the full game state, including the opponent's "+
        "hand.",
  why:"ROADMAP-MULTIPLAYER.md's deliberate Phase B position. It is not fixable by "+
      "redaction, because a peer that cannot see the state cannot run the reducer; "+
      "hidden information needs Phase C's authoritative server. Do NOT present the "+
      "current layer as cheat-resistant."}

};

/* THE STATUSES A PROBE MUST POINT AT. `test/approx.test.js` reads this,
   so a new status with no probe direction is a drill failure rather
   than a silent fallback (v3.96's rule about censusing a dispatcher). */
const STATUSES = ["stated", "open", "closed"];

function report(){
  const by = s => Object.entries(APPROX).filter(([,v]) => v.status === s);
  const lines = [];
  lines.push("");
  lines.push("APPROXIMATION LEDGER — " + Object.keys(APPROX).length + " records");
  lines.push("");
  for(const s of STATUSES){
    const rows = by(s);
    lines.push("  " + s.padEnd(8) + String(rows.length).padStart(3) + "   " + ({
      stated:"a deliberate deviation, argued and still in place",
      open  :"a gap nobody has justified — this is work",
      closed:"the record was stale; the prose is corrected"
    })[s]);
  }
  lines.push("");
  for(const s of STATUSES){
    const rows = by(s);
    if(!rows.length) continue;
    lines.push("── " + s.toUpperCase() + " " + "─".repeat(Math.max(0, 56 - s.length)));
    for(const [k, v] of rows)
      lines.push("  " + k.padEnd(28) + (v.cr || "—").padEnd(12) + v.board);
    lines.push("");
  }
  return lines.join("\n");
}

if(require.main === module) console.log(report());

module.exports = {APPROX, STATUSES, report};
