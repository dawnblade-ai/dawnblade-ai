/* ============================================================
   Dawnblade engine — prompts.js (Phase 2)

   THE THING 26 RULINGS ARE WAITING ON.

   A quarter of the recorded rulings describe the same shape: stop, show
   the player something, let them choose. Until now the trainer had one
   hardcoded flow (`opt`) welded to side 0, so every one of those rulings
   was blocked on the same missing machinery.

   This module is that machinery, as DATA rather than code. A ruling
   becomes a spec object — which side is asked, which zone is drawn from,
   what filters it, how many, where the picks go — and the trainer renders
   and resolves it without a new branch per card. That is the same
   discipline as the golden rule: the parser reads card text, the spec
   describes the choice, and nobody hardcodes a card by name.

   PROMPTS ARE ADDRESSED TO A SIDE. `spec.side` is 0 (you) or 1 (the
   opponent) — the indices engine/sides.js and the pregame throw use. In
   the trainer that is nearly always 0, but the shape is what multiplayer
   needs: Cold Snap's ruling has the OPPONENT choosing whether to pay, and
   intimidate shows the opponent's hand.

   PURITY: this module moves cards between zones and nothing else. It
   never runs a card effect — `applyPrompt` returns the ops it wants run
   and the trainer feeds them to `runOps`, which is where effects live.
   Same for costs: it reports `pay`, it does not reach into resources.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"), require("./game.js"));
  else root.DawnPrompts = factory(root.DawnParser, root.DawnGame);
})(typeof self!=="undefined" ? self : this, function(P, GM){

const {isAttack, printedKw, arcAmount} = P;

/* Zones a prompt may draw from. `arsenal` is a single card and `board`
   holds wrappers rather than cards, so both are normalised on read. */
const PROMPT_ZONES = ["hand","deck","grave","banish","soul","pitch","arsenal","board","gear"];

/* WHAT A PLAYER CALLS A ZONE (v4.59). The state keys are field names and
   one of them is not a word anybody says: this module's own default hint
   read "From your grave." on every pick that did not supply its own, and
   `abCostWhy`'s new refusal needed the same noun on both boards. In a
   training sim the feed is the lesson (v3.60, v4.24), and two spellings of
   one noun across two boards is the mirror the no-mirror rule exists to
   stop — so it is ONE reader here, where the zone vocabulary already lives.

   IT IS TOTAL OVER `PROMPT_ZONES` AND THE FALLBACK IS THE KEY. Exactly one
   key differs today, which is why this is not a table of nine rows nobody
   reads (v4.11, v4.50: unclaimed vocabulary is dead code that reads like a
   rule) — and a zone whose key is already the word needs no entry. */
const promptZoneWord = z => z === "grave" ? "graveyard" : String(z || "");

/* WHAT IS IN ONE ZONE OF ONE SIDE. Split out of `promptZone` (v4.59) so a
   caller holding only a SIDE can ask the same question: `judge.abCostWhy`
   takes `(sd, ab)` and has no game to index, and the alternative was a
   synthetic `{sides:[sd]}` at the call site or a second copy of the three
   zone shapes. `promptZone` is still the one reader — this is its body, the
   way `faceUpArsenal` was exposed rather than duplicated (v4.05). */
function promptSideZone(s, zone){
  if(!s) return [];
  if(zone === "arsenal") return s.arsenal ? [s.arsenal] : [];
  if(zone === "board") return (s.board||[]).map(b=>b && b.card).filter(Boolean);
  return s[zone] || [];
}
function promptZone(game, side, zone){
  return promptSideZone(game.sides[side], zone);
}

/* Selection filters read printed card FIELDS — type text, pitch, cost,
   power, name. They never interpret rules text; that is the parser's job.
   A filter spec is a plain object and every key present must match, so
   {pitch:3, type:"attack"} means "a blue attack". */
function promptFilter(spec){
  if(!spec) return () => true;
  return c => {
    if(!c) return false;
    /* "ANOTHER" — the printed exclusion `optFilter` reads off the card.
       It is STRUCTURAL rather than a field, so the uid cannot come from
       the parse (`fxParse` memoizes on name|pitch, and one parse serves
       every copy of the card); the QUEUE SITE supplies it as `notUid`.

       A `notSelf` filter that was never given a uid refuses EVERYTHING
       rather than falling through to offer the source itself. Offering it
       is stronger than printed, and Sigil of Silphidae is the case that
       makes this concrete: by the time its LEAVE trigger asks, the Sigil
       is an aura sitting in the very graveyard it banishes from, so a
       dropped exclusion lets it eat itself for a free arcane damage.
       Refusing is weaker than printed and visible; the other direction
       steals games. */
    if(spec.notSelf && spec.notUid == null) return false;
    /* AND A DYNAMIC COST BOUND THAT WAS NEVER RESOLVED (v3.92), for the
       identical reason. `costLtDrac` says "cost less than the number of
       Draconic chain links you control" and the QUEUE SITE turns it into
       a `costLe` against the chain as it stands — because `fxParse`
       memoizes and a number in the parse freezes. A filter that still
       carries the flag was never given the count, and an unknown key that
       simply falls through would admit EVERY card, which is exactly the
       sev-3 the refusal it replaced was protecting against. */
    if(spec.costLtDrac) return false;
    if(spec.notUid != null && c.uid === spec.notUid) return false;
    if(spec.type === "attack" && !isAttack(c)) return false;
    if(spec.type === "nonAttack" && isAttack(c)) return false;
    if(spec.tt != null && !new RegExp(spec.tt, "i").test(c.tt||"")) return false;
    /* THE STRUCTURED ARRAY IS THE AUTHORITY, and for a TYPE it is the only
       safe reader. `tt` is a display string and the database's two fields
       disagree on five records — it calls Den of the Spider and Lair of
       the Spider "Action Defense Reaction", and BOTH are in this pool. A
       `tt` regex asking "is this an action card" would offer either of
       them as a legal choice; `ty` says Defense Reaction and a reaction is
       not an action. (`\baction\b` also keeps "Reaction" from matching as
       a substring, which is the other half of the same trap.) */
    /* `ty` ACCEPTS A LIST, AND EVERY WORD MUST BE PRESENT (v3.39).
       "A Wizard non-attack ACTION CARD" is two type words at once, and a
       single-word `ty` can only ask one of them — asking "action" alone
       offers a Runeblade action, asking "wizard" alone offers a Wizard
       attack. A string still means one word, so every existing caller is
       untouched. */
    if(spec.ty != null){
      const want = Array.isArray(spec.ty) ? spec.ty : [spec.ty];
      const have = (c.ty||[]).map(t => String(t).toLowerCase());
      if(!want.every(w => have.indexOf(String(w).toLowerCase()) >= 0)) return false;
    }
    if(spec.pitch != null && (c.pitch||0) !== spec.pitch) return false;
    if(spec.costLe != null && (c.cost||0) > spec.costLe) return false;
    if(spec.costGe != null && (c.cost||0) < spec.costGe) return false;
    if(spec.powerGe != null && (c.power||0) < spec.powerGe) return false;
    if(spec.powerLe != null && (c.power||0) > spec.powerLe) return false;
    if(spec.defGe != null && (c.def||0) < spec.defGe) return false;
    /* ---- "AN EFFECT THAT DEALS ARCANE DAMAGE" (v3.39) ---------------
       A PARSED FACT, NOT A PRINTED FIELD, and that is a deliberate
       widening of this reader rather than an accident. Every other key
       here reads a printed value; Blaze's ability asks about what the
       card's TEXT DOES, and `fxParse` is the one thing that can answer
       it. It is honest because the question has an exact answer — the
       card's unconditional arcane op — rather than being a free-text
       match, which is what `optFilter` still refuses.

       AN UNPARSED OR CONDITIONAL ARCANE ANSWERS 0, so such a card is not
       offered. Weaker than printed and visible; offering a card whose
       arcane the engine cannot count would make X wrong, and X is the
       COST. */
    if(spec.arcGe != null || spec.arcLe != null){
      const amt = arcAmount(c);
      if(spec.arcGe != null && amt < spec.arcGe) return false;
      if(spec.arcLe != null && amt > spec.arcLe) return false;
    }
    /* A PRINTED KEYWORD LINE IS A PRINTED FIELD (v3.33). "A card WITH
       CRUSH" was refused as a rules-text qualifier while nothing could
       answer it honestly; `printedKw` can, and it asks the precise
       question — does the card CARRY the keyword as printed rules text,
       not does the word appear somewhere in a sentence. That distinction
       is the whole reason `hasKw` is the wrong predicate here: it is
       deliberately loose, and a card that merely REFERENCES crush would
       otherwise be a legal thing to reveal. Same call v3.31 made for
       stealth in a target qualifier. */
    if(spec.kw != null && !printedKw(c, spec.kw)) return false;
    if(spec.name != null && !new RegExp(spec.name, "i").test(c.name||"")) return false;
    return true;
  };
}

/* ---- TWO TARGETS IN ONE SENTENCE (v4.59) ----------------------------
   > "Put target Runeblade attack action card AND target Runeblade
   >  non-attack action card from your graveyard on top of your deck in
   >  any order." — CROWN OF DICHOTOMY, the pool's ONLY record naming two
   >  targets in one sentence (measured over 797)

   A LIST of filters, and what it asks is a PERFECT MATCHING: every filter
   covered by a DISTINCT card. That is the whole difference between reading
   this card and dropping a printed restriction — folded into ONE filter
   (the union, `max: 2`) the sheet happily accepts TWO attacks, which the
   printed line does not permit. v2.30's arrow buff landing on a sword and
   v3.31's swallowed tail, one prompt variant over, and the direction that
   steals games.

   "EVERY CARD MATCHES SOMETHING" IS THE WRONG TEST AND PASSES THE BUG.
   Two Runeblade attacks each match the attack filter, so a per-card scan
   answers TRUE while the non-attack filter goes uncovered. It is Kuhn's
   augmenting path rather than a pair of loops, so a third target needs no
   second body — and with an empty `filters` it answers TRUE, which is what
   keeps every existing single-`filter` caller on exactly the path it was
   on. */
/* ---- WOULD A PICK HAVE ANYTHING TO ASK? (v4.59) ---------------------
   `buildPrompt` has answered null for an empty candidate pool since this
   module was written, which is how a prompt politely skips itself instead
   of showing an empty sheet. That is right there and WRONG at the
   ACTIVATION: measured, FIVE pool activation lines have a pick as their
   payload, and for three of them the cost is paid and the sheet then skips
   — Fai's three resources and his once-per-turn on an empty graveyard, and
   the Halo and the Hood DESTROYING THEMSELVES on an empty hand. v2.04 made
   an unpayable cost INERT on purpose; v4.49 states the mirror, that a PAID
   cost which does nothing is the player losing value for a play the rules
   should have refused first (v3.11).

   SO THE PREDICATE IS SHARED RATHER THAN RESTATED. `abCostWhy` and the
   trainer both ask the same two questions `buildPrompt` asks, off the same
   pool, so the legality and the sheet cannot disagree about whether there
   is anything to choose — the rule `abDiscardCost` already follows with
   `promptFilter`. Blaze's own by-name refusal (v3.39) stays and is
   STRONGER: it also asks what the energy pool can afford, which is a
   dynamic bound no candidate scan can know.

   THE POOL TAKES A SIDE, not a game, because `abCostWhy` is handed
   `(sd, ab)` and has none — `promptSideZone`'s reason, one layer up. */
function promptPickPool(sd, spec){
  const filters = spec.filters && spec.filters.length ? spec.filters : null;
  const pass = filters ? (c => filters.some(f => promptFilter(f)(c)))
                       : promptFilter(spec.filter);
  return (spec.cards ? spec.cards.filter(Boolean)
                     : promptSideZone(sd, spec.zone || "hand")).filter(pass);
}
function promptPickAskable(pool, spec){
  if(!pool.length) return false;
  const filters = spec.filters && spec.filters.length ? spec.filters : null;
  return !filters || promptMatchSet(pool, filters);
}

/* THE ASSIGNMENT ITSELF, not merely whether one exists (v4.59). One body,
   because `judge.autoAnswer` has to ANSWER the sheet and not only judge an
   answer: its pick branch selected cards until `sel.length >= min`, which on a
   multi-target sheet can be two Runeblade ATTACKS — and then `promptConfirm`
   is refused by `judge.legal`, which is a REFUSAL, and a refusal is always a
   bug in the policy by `sparring.js`'s own contract. Proposed again every
   tick, that is v4.54's livelock exactly.

   LATENT TODAY AND MEASURED: `defaultPicks` never wears the Crown, so no
   driven game opens the sheet — which is why the ladder reports 0 refusals
   either way and why this had to be read rather than counted (v3.50).

   THE ORDER IS THE FILTERS' PRINTED ORDER, which is deterministic and is not
   a judgement about card text (v2.46: a ranking that leaves ties unbroken is
   a desync waiting to happen). */
function promptMatchAssign(cards, filters){
  if(!filters || !filters.length) return [];
  const list = (cards||[]).filter(Boolean);
  const ok = filters.map(f => {
    const t = promptFilter(f);
    const out = [];
    list.forEach((c, i) => { if(t(c)) out.push(i); });
    return out;
  });
  const owner = new Array(list.length).fill(-1);
  const assign = (fi, seen) => {
    for(const ci of ok[fi]){
      if(seen[ci]) continue;
      seen[ci] = true;
      if(owner[ci] < 0 || assign(owner[ci], seen)){ owner[ci] = fi; return true; }
    }
    return false;
  };
  for(let fi = 0; fi < filters.length; fi++)
    if(!assign(fi, new Array(list.length).fill(false))) return null;
  const pick = new Array(filters.length).fill(-1);
  owner.forEach((fi, ci) => { if(fi >= 0) pick[fi] = ci; });
  return pick;
}
/* A FUNCTION DECLARATION, not a const arrow: `promptPickAskable` sits ABOVE
   this in the file and calls it, and this file's own history has a note about
   a `const` arrow in the temporal dead zone (v3.12's `quotedOnHit`). Hoisted,
   the order in the file cannot matter. */
function promptMatchSet(cards, filters){ return !!promptMatchAssign(cards, filters); }

/* Turn a queued spec into a live prompt, or null when there is nothing to
   ask — an empty zone, a cost that cannot be met. Returning null is how a
   prompt politely skips itself instead of showing an empty sheet. */
function buildPrompt(game, spec){
  const side = spec.side != null ? spec.side : 0;
  const base = {tag:spec.tag, side, src:spec.src||"", cards:[], sel:[], down:[]};
  if(spec.tag === "opt"){
    const n = spec.n || 1;
    const look = promptZone(game, side, "deck").slice(0, n);
    if(!look.length) return null;
    /* A REORDER, NOT AN OPT (v3.71). Spire Sniping prints "look at the top
       2 cards of your deck, then put them back IN ANY ORDER" — nothing may
       go to the bottom, so the toggle means "this one goes second" instead.
       Opt-in (v3.58's rule), so an ordinary opt is untouched, and carried
       explicitly because A SPEC ONLY CARRIES FIELDS THIS FUNCTION KNOWS
       ABOUT (v2.34's `arsStamp`, the fifth field to prove it).

       WITH ONE CARD THERE IS NO ORDER TO CHOOSE. A sheet offering a single
       forced choice is a tap that teaches nothing (v3.55), and unlike opt
       there is no "or the bottom" alternative to make it a real decision. */
    if(spec.keepTop && look.length < 2) return null;
    return {...base, cards:look, n, keepTop: !!spec.keepTop,
      title: spec.title || (spec.keepTop ? ("Reorder the top " + n) : ("Opt " + n)),
      hint: spec.hint || (spec.keepTop
        ? ("Top " + n + " cards of your deck. Tap any you want to go UNDER the rest — "
           + "they all stay on top, in the order you leave them.")
        : ("Top " + (n===1 ? "card" : n + " cards") +
        " of your deck. Tap any you want on the bottom instead — the rest stay on top in this order."))};
  }
  if(spec.tag === "pick"){
    const zone = spec.zone || "hand";
    /* CANDIDATES MAY BE THE CALLER'S, the way `target`'s already are — a
       choice does not always live in one zone. Cold Snap's freeze picks
       from the opponent's ARSENAL and their ALLIES together, which is two
       zones, and teaching `promptZone` a synthetic third would put a rules
       decision inside a module that is meant to stay data-driven. */
    /* THE CANDIDATE POOL IS THE UNION WHEN THE CARD NAMES SEVERAL TARGETS
       (v4.59), because a card that is only ever legal for the second
       target must still be offered. What stops the player taking two of
       the first is `promptReady`'s perfect matching, not this filter.

       AND AN UNSATISFIABLE SHEET IS REFUSED RATHER THAN BUILT. `judge.legal`
       freezes the game for BOTH seats while a prompt is live, so a sheet
       whose Confirm can never light is a hard LIVELOCK — v4.44's finding,
       which is why the table got a sheet at all. Both boards refuse the
       ACTIVATION first, through this same predicate; this is the second line
       of the same defence and it is needed for v2.04's reason, that `reduce`
       is fed by JSON off a wire. */
    const filters = spec.filters && spec.filters.length ? spec.filters : null;
    const pool = promptPickPool(game.sides[side] || {}, spec);
    if(!promptPickAskable(pool, spec)) return null;
    /* "ANY NUMBER OF CARDS" IS RESOLVED HERE, AGAINST THE POOL THIS
       FUNCTION HAS ALREADY FILTERED (v4.43). Hope Merchant's Hood is the
       pool's first multi-card pick — every other `pickPrompt` in the
       parser is `max: 1` — and its bound is the CANDIDATE COUNT, not a
       number anybody can write down: `fxParse` memoizes on `name|pitch`,
       so a hand size in the parse freezes at whatever the first reader
       saw (v3.39, v3.92), and supplying it at the queue site would be a
       second place that has to re-derive the same filter. The clamp is
       already here; "all of them" is just the clamp with no other bound. */
    /* WITH `filters` THE COUNT IS THE LIST'S LENGTH AND NOTHING ELSE
       (v4.59). "Target X and target Y" names exactly two, so deriving both
       bounds from the list leaves no way for a spec's `min`/`max` to
       disagree with the matching rule that gates Confirm — two records of
       one fact (v3.61), and the record that would drift is the one nobody
       reads. */
    const max = filters ? filters.length
      : Math.min(spec.maxAll ? pool.length : (spec.max != null ? spec.max : 1), pool.length);
    const min = filters ? filters.length
      : Math.max(0, Math.min(spec.min != null ? spec.min : max, max));
    return {...base, zone: spec.cards ? null : zone, cards:pool, min, max,
      to: spec.to || null, optional: min === 0,
      /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34's
         `arsStamp` rule, and this is the NINTH field to prove it, now with
         `test/speccensus.test.js` standing behind it). Dropped here, the
         perfect matching has nothing to match against: `promptReady` falls
         back to `sel.length >= min`, Confirm lights on any two cards, and
         Crown of Dichotomy puts TWO Runeblade attacks back — the printed
         second target silently deleted. */
      filters,
      /* THE "IF YOU DO" RIDER. A pick with `min:0` is an OPTIONAL COST —
         "you may banish an aura from your graveyard. If you do, deal 1
         arcane damage" — and these ops are the "if you do" half. They are
         returned by applyPrompt ONLY when something was actually picked,
         which is the whole rule: decline and the rider must not fire.
         Paying nothing and getting the payload is the free-ability bug
         v2.04 fixed, and there is a drill named for it. */
      ops: spec.ops || [],
      /* THE ARSENAL STAMP is deliberately NOT `ops` (v2.34). Bull's Eye
         Bracers' "It gains +1{p} until end of turn" belongs to the card that
         was PUT, and this module runs no effects — returning it as ops would
         hand it to runOps, which would apply it to the source. It rides on
         the prompt as data so the trainer can stamp the card that moved. */
      arsStamp: spec.arsStamp || null,
      /* THE SAME LESSON, ONE CARD LATER (v3.47). `untapStamp` is DATA the
         answer applies to the board entry that was chosen — the ally is
         untapped where it stands, so there is no `to` and nothing moves.
         Dropped here it vanishes silently, exactly as `arsStamp` did. */
      untapStamp: spec.untapStamp || null,
      /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34,
         v3.53). `defStamp` is Shred's chain-scoped defender debuff — data
         the answer applies to the card that was CHOSEN, on the DEFENDING
         side, and nothing moves. Dropped here it vanishes silently and
         the sheet asks a question with no consequence. */
      defStamp: spec.defStamp || null,
      /* THE COUNTER STAMP (v3.53) — same rule, third time: a spec only
         carries fields THIS function knows about. Dropped here, a targeted
         counter put opens the right sheet, names the right permanent and
         places nothing. */
      ctrStamp: spec.ctrStamp || null,
      /* THE CLASS RIDER (v4.01) — same rule, FIFTH field to prove it.
         Halo of Illumination puts a card into the soul and draws "if it's
         Light"; dropped here, the sheet opens, the right card moves, and
         the printed reward never arrives. It is DATA, not ops: this
         module runs no effects, so `applyAnswer` asks the class and runs
         them (v2.17's whole contract). */
      classRider: spec.classRider || null,
      /* A SPEC ONLY CARRIES FIELDS THIS FUNCTION KNOWS ABOUT (v2.34's
         `arsStamp` rule, and this is the fourth field to prove it). Left
         off, every arsenal put arrives FACE DOWN — including the three
         cards that print "face up", whose whole mechanism is the trigger
         that fires when they do. */
      faceUp: !!spec.faceUp,
      /* THE COUNTER COST AND ITS STAMP (v3.39), and they are here for the
         reason `arsStamp` is: A PROMPT SPEC ONLY CARRIES FIELDS THIS
         FUNCTION KNOWS ABOUT (v2.34). Dropped, Blaze's ability banishes
         the card for FREE and the banished copy is never marked playable
         — which is exactly what happened the first time it was driven.
         Data, not ops: this module runs no effects and spends no
         resources, so `applyAnswer` pays and stamps. */
      ctrSpend: spec.ctrSpend || null,
      ctrHeld: spec.ctrHeld != null ? spec.ctrHeld : null,
      playThisTurn: !!spec.playThisTurn,
      /* THE BANISH RIDER'S STAMP (v3.92) — data the answer applies to the
         card that MOVED. A spec only carries fields `buildPrompt` knows
         about (v2.34, v3.33, v3.53), so a field threaded through and
         forgotten here vanishes and the rider does nothing. */
      banStamp: spec.banStamp || null,
      /* WHICH SEAT'S FREEZE THIS IS. Like `arsStamp` it is DATA, not ops:
         this module runs no effects, and the stamp belongs to the object
         that was chosen rather than to the source. `applyAnswer` reads it
         off `out.picked`. */
      freezeSide: spec.freezeSide != null ? spec.freezeSide : null,
      /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34,
         v3.53, v4.01) — SIXTH field to prove it. `jab` is Danger Digits'
         whole payload, applied by `applyAnswer` to the permanent that was
         CHOSEN: this module runs no effects, so returning it as `ops`
         would hand it to runOps, which would aim it at the source. */
      jab: spec.jab || null,
      /* A CROSS-SEAT MOVE, and it is DATA for the same reason `arsStamp`
         is: this module moves cards within ONE side, so a pick whose
         candidates came from the other seat reports the choice and the
         caller performs it. Added here explicitly because a spec only
         carries fields `buildPrompt` knows about — `arsStamp` had to be
         added the same way in v2.34, and until it was the Bracers' +1{p}
         was silently dropped. Driving Brain Freeze caught this one the
         same way: the sheet opened, the right card was offered, and
         nothing moved. */
      moveFoe: spec.moveFoe || null,
      /* A PICK THAT COSTS SOMETHING (v3.53). `retrieve` prints its price in
         reminder text — "(Pay {r} to equip it.)" — so the choice and the
         payment are one act. Carried as DATA, like every other field here:
         this module runs no effects and spends no resources, so it reports
         the cost as `out.pay` and `applyAnswer` charges it (pitching if the
         seat is short, which is the recorded ruling for retrieve).

         Declared explicitly because a spec only carries fields THIS
         function knows about — `arsStamp` had to be added the same way in
         v2.34, and until it was the Bracers' +1{p} was silently dropped. */
      cost: spec.cost || 0,
      /* THE RE-EQUIP FIXUP, and it belongs to the card that MOVED rather
         than to the source — the same reason `arsStamp` is data. A piece
         coming back out of the graveyard is equipped fresh: its `destroyed`
         flag and its battleworn `curDef` are cleared by `applyAnswer`. */
      equipStamp: !!spec.equipStamp,
      /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34, and
         this is the seventh field to prove it — now with a standing census
         behind it in `test/speccensus.test.js`). `shuffleDraw` is Hope
         Merchant's Hood's whole payload: the deck is shuffled and the
         controller draws AS MANY CARDS AS THEY CHOSE. Dropped here, the
         sheet opens, the right cards go back into the deck, and the
         printed redraw never happens — the player has thrown their hand
         away and destroyed the Hood for nothing.

         It is DATA rather than ops for this module's founding reason: the
         count is not known until the answer, and shuffling needs the
         seeded rng, which `applyAnswer` owns and this module must not
         touch (a shuffle here would consume the replay stream from a
         function whose contract is that it runs no effects). */
      shuffleDraw: !!spec.shuffleDraw,
      /* AND `shuffleAfter` IS ITS SIBLING, NOT A WIDENING OF IT (v4.58).
         Flamecall Awakening searches the DECK — a hidden, ORDERED zone — so
         the printed shuffle is what pays for having looked, and it differs
         from the Hood's on both axes that matter: it draws NOTHING (the
         found card is already on its way to hand) and it fires WHETHER OR
         NOT a card was taken, because the sheet showed the controller their
         matching cards in deck order either way. Folded into `shuffleDraw`
         a search would hand out a free card AND let a decline keep the
         order it had just learned — the eighth field to prove v2.34's rule,
         and dropped here the shuffle simply never happens while the feed
         says the card was found. */
      shuffleAfter: !!spec.shuffleAfter,
      /* "UP TO" IS A LIE FOR A MULTI-TARGET PICK, and this sheet's own
         Confirm is gated on the matching — so the default says what it is
         actually waiting for rather than a bound (v4.59). */
      title: spec.title || (filters ? ("Choose " + filters.length + " cards")
                                    : max === 1 ? "Choose a card" : "Choose up to " + max),
      hint: spec.hint || ("From your " + promptZoneWord(zone) + (spec.to ? " → " + spec.to : "") + ".")};
  }
  /* ============================================================
     ALLOC — THE SIXTH VARIANT, AND THE ONE THAT APPORTIONS (v4.44)

     > "Distribute up to four +1{p} counters among any number of weapons
     >  you control."                                          — GLISTEN

     Every other variant here answers a question about a SET or a single
     choice. `pick` chooses which cards, and a set cannot say "two of
     these on that one" — so this was the last pool card at `tier: none`
     and the one whose recorded blocker was named correctly.

     `sel` IS A MULTISET, which is what makes the whole sheet reuse the
     `pick` machinery: an index may appear more than once, `sel.length` is
     how many units are placed, and `max` is the pool. `promptReady` then
     needs no new case at all — "up to" means `min: 0`, so it is ready the
     moment it opens, and Confirm with nothing placed is a printed line of
     play rather than a cancel.

     REMOVAL IS AN UNDO, NOT A SECOND TAP. Tapping a card that already
     holds counters to take one back is modal and unguessable on a phone;
     `promptTakeBack` pops the LAST placement, which is why `sel` is an
     ORDERED array rather than a count per card.

     IT RETURNS NULL ONLY ON AN EMPTY POOL. The single-candidate case is
     deliberately NOT refused here — a forced distribution still has to
     LAND, and the caller (`effects.ctrPut`) places it directly with no
     sheet, which is where that fast path already lived (v3.55: a sheet
     offering one forced choice is a tap that teaches nothing). Refusing
     it here as well would lose the counters, and an unreachable guard is
     dead code that reads like a rule (v4.11). */
  if(spec.tag === "alloc"){
    const zone = spec.zone || null;
    const pool = (spec.cards ? spec.cards.filter(Boolean) : promptZone(game, side, zone || "board"))
      .filter(promptFilter(spec.filter));
    if(!pool.length) return null;
    const n = Math.max(1, spec.n != null ? spec.n : 1);
    return {...base, zone, cards: pool, min: 0, max: n,
      /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34, and
         this is the EIGHTH field to prove it). `ctrStamp` is what the
         answer applies to each card that took counters — the kind, and
         sharpen's own wipe/rider if a future card prints both. Dropped
         here, the sheet asks a real question and places nothing. */
      ctrStamp: spec.ctrStamp || null,
      title: spec.title || ("Distribute " + n + " counters"),
      hint: spec.hint || ("Tap a permanent to place one. Up to " + n
            + " — placing fewer is legal, and Take back undoes the last.")};
  }
  if(spec.tag === "modal"){
    const options = (spec.options||[]).filter(Boolean);
    /* A SINGLE MODE IS A REAL QUESTION WHEN IT CAN BE REFUSED (v4.62).
       The floor of two is right for a MANDATORY modal — a forced choice
       among one is a tap that teaches nothing (v3.55) — and exactly wrong
       for an OPTIONAL one, where the printed line is "you may X" and the
       alternative is not a second mode but declining. It is the same
       distinction an optional `pick` already makes: `min: 0` over a single
       candidate opens a sheet, because "Choose none" is the other answer.

       MEASURED BEFORE WIDENING (v3.33): `millCostSpec` is the engine's
       only builder that sets `optional` and it always supplies two modes,
       so no pool record moves — and a mandatory single-mode modal is still
       refused, which is the half that keeps the floor meaning something. */
    if(options.length < (spec.optional ? 1 : 2)) return null;
    /* A MODE CAN BE OPTIONAL (v3.90). "You may discard a card OR destroy
       the top card of your deck" is a CHOICE the player may also refuse,
       and a modal with no way out would make a "you may" mandatory —
       stronger than printed, and the free-ability rule v2.04 fixed read
       from the other end. `optional` is opt-in (v3.58), so every existing
       modal keeps its exact shape. */
    return {...base, options, choice:null,
      optional: !!spec.optional,
      /* DATA THE ANSWER APPLIES, never ops (v2.34, v3.47). The rider is
         conditional on the card the COST consumed, which prompts.js
         cannot know and must not decide — it names the keyword and the
         payload, and `applyAnswer` asks. */
      costRider: spec.costRider || null,
      title: spec.title || "Choose one",
      hint: spec.hint || "Pick one mode — the other is not used."};
  }
  if(spec.tag === "pay"){
    /* pay-or-decline.

       `avail` IS COMPUTED FOR THE ADDRESSED SIDE (v2.75), late, the same
       way `soak` does it. It used to be handed in by `openPrompt` as
       `you(s).res` — seat 0's floating resources, whoever the sheet was
       actually addressed to — which was a latent seat-hardcoding bug of
       exactly the kind v2.25 fixed in the rules helpers. It had never
       fired because no card queued a `pay` spec until Winter's Bite.

       It counts the hand too, because pitching is on demand (RULING
       2026-08-01) and a hero asked to pay on someone else's turn has no
       other way to find an {r}. */
    const cost = spec.cost || 0;
    const sd = (game.sides || [])[side] || {};
    const avail = spec.avail != null ? spec.avail
      : (sd.res || 0) + (sd.hand || []).reduce((a, c) => a + ((c && c.pitch) || 0), 0);
    return {...base, cost, avail,
      ops: spec.ops || [],
      /* THE OTHER HALF OF "UNLESS". A `pay` spec used to carry only the
         reward for paying; an "unless they pay" clause needs the
         consequence of NOT paying, or declining silently does nothing and
         the card is strictly weaker than printed in the other direction. */
      elseOps: spec.elseOps || [],
      /* AND THE TAP, WHERE THE COST PRINTS ONE (v3.33). A SPEC ONLY
         CARRIES FIELDS `buildPrompt` KNOWS ABOUT — the `arsStamp` lesson
         (v2.34) — so a field threaded through the spec and forgotten here
         is silently dropped. Without it Magmatic Carapace's {t} is free
         and the ability is repeatable every time an aura is played, which
         is strictly stronger than printed. */
      taps: !!spec.taps, tapUid: spec.tapUid,
      /* A HERO TAP IS A DIFFERENT RECORD FROM A PERMANENT'S (v3.91).
         `tapUid` goes into `weaponUsed`, a per-turn ALLOWANCE lifted at
         every turn boundary; a hero's tap is a STATE only the
         controller's own untap step lifts (CR 4.4.3d, v3.48). A spec only
         carries fields `buildPrompt` knows about (v2.34), so this is
         declared rather than threaded. */
      tapHero: !!spec.tapHero,
      /* AND THE THIRD COST VERB (v3.93) — "you may DESTROY THIS". A spec
         only carries fields `buildPrompt` knows about (v2.34, v3.33,
         v3.91), so this is declared here rather than threaded: dropped,
         the equipment is never spent and the rider is FREE, which is
         precisely the bug v2.04 fixed. */
      destroyUid: spec.destroyUid,
      /* AND THE FOURTH COST VERB (v4.24) — "remove a <kind> counter from
         it", which is what CRANK spends. A spec only carries fields
         `buildPrompt` knows about (v2.34, v3.33, v3.91, v3.93), so this
         is declared here rather than threaded: dropped, the action point
         is granted and the counter stays, which is the v2.04 free-ability
         bug and also leaves the item alive a turn longer than printed.
         It leaves as DATA like the tap and the destruction — this module
         runs no effects and touches no state. */
      spendCtr: spec.spendCtr || null,
      /* AND WHOSE +{d} THE PAYLOAD IS (v4.53). Not a cost — the PAYLOAD's
         subject. `runOps` cannot raise one named defender, so a `defBuff`
         in a sheet's ops has to reach `defendValue`'s per-defender map,
         and the only thing that can say WHICH defender is the queue site
         that saw the wall. A spec only carries fields `buildPrompt` knows
         about (v2.34, v3.33, v3.91, v3.93, v4.24), so this is declared
         here rather than threaded: dropped, Brothers in Arms' +2{d} is
         paid for and logged and no number moves — the shape v4.48 found
         on Big Blue Sky. It leaves as DATA like the tap, the destruction
         and the counter; this module runs no effects and touches no
         state. */
      defUid: spec.defUid,
      /* AND WHETHER THE LAYER THAT QUEUED THIS HAS ALREADY SETTLED ITS
         ACTION POINT (v3.93). A spec only carries fields `buildPrompt`
         knows about (v2.34), and the two boards clear `pend` at different
         moments — so the queue site says it rather than the consumer
         guessing from board state. */
      lateGa: !!spec.lateGa,
      choice:null,
      title: spec.title || ("Pay " + cost + "?"),
      hint: spec.hint || "You may pay this. If you do, the rider resolves."};
  }
  /* ---- SOAK — arcane damage, and what the threatened hero may spend to
     stop it (v2.74). The sixth variant, and the first one whose whole
     point is that it is addressed to the side that is NOT acting: the
     attacker plays Ice Bolt, the DEFENDER decides whether their Nullrune
     Hood is worth an {r}.

     `options` are supplied by the caller (parser.arcaneSoaks reads them
     off the printed keywords), so this module still names no card and
     reads no card text.

     IT IS MULTI-SELECT because every instance triggers (RULING, user
     2026-08-14). Two Nullrune pieces are two separate {r}-for-1 offers,
     and a hero may take either, both or neither — the same outcome space
     as the CR's separate triggers on the stack, on one screen instead of
     two sheets, which is a UI choice rather than a rules one.

     A SOAK THE HERO CANNOT AFFORD IS NOT OFFERED. Barriers cost
     resources; `avail` is what they can actually reach. Spellvoid costs
     the permanent and is therefore always affordable. Offering an
     unpayable option is the live-lock v2.45 found in `legal`: a choice
     whose only exit is cancel. */
  if(spec.tag === "soak"){
    const amount = spec.amount || 0;
    /* AVAIL IS COMPUTED HERE, AT BUILD TIME, NOT CARRIED FROM THE QUEUE.
       Three Runechants queue three soaks off one attack, and answering the
       first one PITCHES — so a figure worked out when the spec was queued
       is already wrong by the second sheet, and it is wrong in the
       dangerous direction: it would offer a barrier the hero can no longer
       reach, the payment would fail, and the prevention would fire unpaid.
       That is the v2.04 free-ability bug wearing a new hat. Found by
       playing, not by a drill.

       Floating resources plus what the hand would pitch for, because
       pitching is on demand (RULING 2026-08-01) and a hero being hit on
       someone else's turn has no other way to find an {r}. `openPrompt`
       does the same late binding for the `pay` variant. */
    const sd = (game.sides || [])[side] || {};
    const avail = spec.avail != null ? spec.avail
      : (sd.res || 0) + (sd.hand || []).reduce((a, c) => a + ((c && c.pitch) || 0), 0);
    if(amount <= 0) return null;
    const options = (spec.options || []).filter(o => o && (o.kind === "spellvoid" || (o.cost || 0) <= avail));
    if(!options.length) return null;
    return {...base, amount, avail, options, sel: [], src: spec.src || "",
      /* WHO DEALT IT. Carried explicitly, because a spec only keeps the
         fields this function knows about — and `arcTaken` credits the
         dealer, who is NOT the side answering this sheet. */
      by: spec.by != null ? spec.by : null,
      title: spec.title || (amount + " arcane incoming"),
      hint: spec.hint || "Tap what you want to spend. Barriers cost resources and stay; " +
        "spellvoid destroys the piece. Take none and the damage lands in full."};
  }
  if(spec.tag === "reveal"){
    const cards = spec.cards || promptZone(game, side, spec.zone || "deck").slice(0, spec.n || 1);
    return {...base, cards,
      title: spec.title || "Revealed",
      hint: spec.hint || "Both players see this."};
  }
  /* CR 1.4.5 — declaring the attack-target. The candidates are supplied by
     the caller (engine/game.js `attackTargets`), so this stays data-driven
     and never reads the board itself.

     With one legal target there is nothing to ask and this returns null,
     which is how the prompt politely skips itself — an attack into an empty
     arena still auto-targets the hero and never shows a sheet. The choice
     is MANDATORY, so unlike `pick` there is no decline. */
  if(spec.tag === "target"){
    const cards = (spec.cards || []).filter(Boolean);
    if(cards.length < 2) return null;
    return {...base, cards, choice:null,
      title: spec.title || "Declare your attack-target",
      hint: spec.hint || "An ally is a living object, so it is attackable (CR 1.4.5a). " +
        "An attack on an ally cannot be blocked (CR 7.3.2a) — it always connects."};
  }
  return null;
}

/* Selection, honouring max. `opt` keeps its own bottom/top toggle. */
function promptToggleSel(prompt, i){
  if(!prompt) return prompt;
  if(prompt.tag === "opt"){
    const down = prompt.down.includes(i) ? prompt.down.filter(x=>x!==i) : [...prompt.down, i];
    return {...prompt, down};
  }
  if(prompt.tag === "pick"){
    if(prompt.sel.includes(i)) return {...prompt, sel: prompt.sel.filter(x=>x!==i)};
    if(prompt.sel.length >= prompt.max) return prompt;
    return {...prompt, sel: [...prompt.sel, i]};
  }
  /* ALLOC — the same tap, and the difference is that an index may REPEAT
     (v4.44). `sel` is a multiset, so a second tap on the same card places
     a second counter rather than un-choosing the first; taking one back
     is `promptTakeBack`, because a tap that sometimes adds and sometimes
     removes is unguessable. The cap is the printed pool. */
  if(prompt.tag === "alloc"){
    if(prompt.sel.length >= prompt.max) return prompt;
    if(!prompt.cards[i]) return prompt;
    return {...prompt, sel: [...prompt.sel, i]};
  }
  /* SOAK has no `max`: every barrier and spellvoid the hero controls
     triggers, so any subset is legal. What it does have is a BUDGET —
     un-toggling must always work, and toggling on must refuse anything the
     hero cannot afford together with what is already selected. Without
     that check a hero could select three barriers on two resources and the
     trainer would clamp the payment to zero at `Math.max(0, res - pay)`,
     soaking three for free. */
  if(prompt.tag === "soak"){
    if(prompt.sel.includes(i)) return {...prompt, sel: prompt.sel.filter(x=>x!==i)};
    const o = prompt.options[i];
    if(!o) return prompt;
    const spent = prompt.sel.reduce((a, k) => a + ((prompt.options[k] || {}).cost || 0), 0);
    if(spent + (o.cost || 0) > prompt.avail) return prompt;
    return {...prompt, sel: [...prompt.sel, i]};
  }
  return prompt;
}
/* AN ANSWER THIS FUNCTION ACCEPTS IS AN ANSWER A WIRE CAN SEND (v4.61).

   It passed `choice` straight through for all three variants, unread and
   unchecked, and `judge.reduce`'s `promptChoose` case forwards `a.choice`
   with no validation of its own — so `reduce` is fed by JSON off a wire
   (v2.04) and three answers nothing printed were accepted:

     modal, choice "decline"   a MANDATORY modal declined — the printed
                               cost skipped and the rider not resolved,
                               while `promptDecline` has gated exactly
                               that on `optional` since v3.90
     modal, choice 99          `options[99]` is undefined, so the sheet
                               resolves saying "Mode chosen: undefined"
                               and runs NO ops — a paid-for play that
                               does nothing, v4.49's rule inverted
     target, choice 99         CR 1.4.5 makes the declaration MANDATORY,
                               so an out-of-range index is a swing at no
                               attack-target at all

   THE VOCABULARY IS WHAT IS CHECKED, NOT THE VALUE'S WORTH. A `pay`
   sheet's decline is always legal (it is the printed "unless they pay"
   branch), and whether the seat can afford "pay" is `applyAnswer`'s —
   it pitches on demand (RULING 2026-08-01), so refusing here would
   deny a payment the rules allow. What is refused is a word or an index
   the sheet could never have produced.

   IT REFUSES BY RETURNING THE PROMPT UNCHANGED, never by throwing:
   `judge.legal`'s contract is that it never throws and `reduce`'s that
   it never mutates on refusal (`fuzz.test.js`), and an unanswered sheet
   leaves Confirm dark — which is the state the player is already in. */
function promptChoose(prompt, choice){
  if(!prompt) return prompt;
  if(prompt.tag === "modal"){
    if(choice === "decline") return prompt.optional ? {...prompt, choice} : prompt;
    return promptIndexOK(choice, prompt.options) ? {...prompt, choice: +choice} : prompt;
  }
  if(prompt.tag === "pay")
    return (choice === "pay" || choice === "decline") ? {...prompt, choice} : prompt;
  if(prompt.tag === "target")
    return promptIndexOK(choice, prompt.cards) ? {...prompt, choice: +choice} : prompt;
  return prompt;
}
/* ONE BODY FOR BOTH INDEXED ANSWERS, because a mode and an attack-target
   are the same question about the same shape — a position in a list the
   sheet rendered — and two copies is where one of them stops checking the
   upper bound. `+choice` is compared against the parse so a numeric STRING
   off a wire is accepted (JSON carries both) while `true`, `null` and
   `"1x"` are not. */
function promptIndexOK(choice, list){
  const i = +choice;
  return choice !== null && choice !== "" && typeof choice !== "boolean"
      && Number.isInteger(i) && i >= 0 && i < ((list || []).length);
}
/* DECLINING IS A CHOICE, NOT A CANCEL (moved here v2.77).

   A `pay` sheet's decline is the printed "unless they pay" branch and it
   has a consequence; an optional `pick` declines by choosing nothing, and
   `applyPrompt` returns the rider's ops ONLY when cards actually moved,
   which is the v2.04 free-ability rule. Neither is a way out of the sheet
   — both still confirm.

   It lived as three lines inside `Battle` and both boards need it now, so
   it lives beside the toggles it belongs with. A prompt that cannot be
   declined is returned unchanged rather than forced. */
/* UNDO THE LAST PLACEMENT (v4.44). Only `alloc` has anything to undo —
   every other variant is a set or a single choice, and its own control
   already reverses it. `sel` is ordered for exactly this. */
function promptTakeBack(prompt){
  if(!prompt || prompt.tag !== "alloc" || !prompt.sel.length) return prompt;
  return {...prompt, sel: prompt.sel.slice(0, -1)};
}
function promptDecline(prompt){
  if(!prompt) return prompt;
  if(prompt.tag === "pay") return promptChoose(prompt, "decline");
  if(prompt.tag === "modal" && prompt.optional) return promptChoose(prompt, "decline");
  if(prompt.tag === "pick" && prompt.optional) return {...prompt, sel: []};
  /* "UP TO" INCLUDES ZERO, so clearing is a legal answer rather than a
     cancel — and the rider (if a future card prints one) does NOT fire,
     which is v2.04's rule the `pick` line above already states. */
  if(prompt.tag === "alloc") return {...prompt, sel: []};
  return prompt;
}

/* Can this be confirmed as it stands? */
function promptReady(prompt){
  if(!prompt) return false;
  /* A PERFECT MATCHING, WHERE THE CARD NAMED SEVERAL TARGETS (v4.59). The
     count alone is not the rule: two Runeblade attacks are two cards and
     cover ONE of Crown of Dichotomy's two printed targets, so `sel.length`
     lights Confirm on a selection the printed line forbids. Equal counts
     make `promptMatchSet` a perfect matching on both sides.

     AND THE DISABLED CONFIRM IS WHY THE HINT SAYS "one of each". A dead
     control reads as a broken screen rather than as a rule (v2.83), so the
     sheet has to say what it is waiting for. */
  if(prompt.tag === "pick"){
    if(prompt.filters)
      return prompt.sel.length === prompt.filters.length
          && promptMatchSet(prompt.sel.map(i=>prompt.cards[i]), prompt.filters);
    return prompt.sel.length >= prompt.min;
  }
  if(prompt.tag === "modal") return prompt.choice != null;
  if(prompt.tag === "pay") return prompt.choice != null;
  /* CR 1.4.5 makes declaring a target mandatory — no confirm until chosen. */
  if(prompt.tag === "target") return prompt.choice != null;
  return true;
}

/* Move cards between two zones of one side, immutably. Board and arsenal
   are shaped differently from the list zones, so both ends normalise. */
function moveCards(game, side, from, to, cards){
  const sides = game.sides.slice();
  const s = {...sides[side]};
  const ids = new Set(cards.map(c=>c.uid));
  if(from === "arsenal") s.arsenal = null;
  else if(from === "board") s.board = (s.board||[]).filter(b=>!(b && b.card && ids.has(b.card.uid)));
  else s[from] = (s[from]||[]).filter(c=>!ids.has(c.uid));
  if(to){
    if(to === "arsenal") s.arsenal = cards[0] || s.arsenal;
    else if(to === "board") s.board = [...(s.board||[]), ...cards.map(c=>({card:c, kind:"item", spent:false, uid:c.uid}))];
    else if(to === "deckBottom") s.deck = [...(s.deck||[]), ...cards];
    else if(to === "deckTop") s.deck = [...cards, ...(s.deck||[])];
    else s[to] = [...cards, ...(s[to]||[])];
  }
  sides[side] = s;
  return {...game, sides};
}

/* ---- WHAT THE PRICE IS CALLED, IN ONE PLACE (v4.37) ------------------
   A `pay` sheet carries FOUR cost verbs — resources, the permanent's tap,
   the HERO's tap, the destroy and the counter — and `effects.payPolicy`
   has enumerated all of them since v4.24 (`otherPrice`). The FEED named
   two.

   v4.24 IS THE VERSION THAT NAMED THE RULE and stopped at one member of
   the family: it gave the COUNTER a decline line because "a cost that is
   not resources must not say declined to pay 0", and left the destroy
   and the hero-tap saying exactly that — a number that is not the price,
   which is the sev-2 category the player TRUSTS. Live on three pool
   records (Beaten Trackers, Refraction Bolters, Turn to Mindfire) since
   v3.93 and v3.91 respectively. v4.21's rule: when you fix two members of
   a family, census the family.

   AND THE ACCEPT LINE HAD THE SAME HOLE, which only asking both halves
   finds (v3.98): tapping your hero for Turn to Mindfire read "You paid 0
   — the rider resolves." So one body answers for both, and a fifth verb
   cannot be named on one side and not the other.

   NO POSSESSIVE IS BUILT BY HAND (v4.22). `who` is "You" or "The
   opponent" and a hand-rolled "'s" on the first reads "You's hero", so
   the hero-tap lines name the CARD being powered instead — which is what
   the sheet's own title is about, and needs no inflection at all. */
function payVerb(prompt, took){
  if(prompt.destroyUid != null){
    /* A DESTROY CAN RIDE WITH A RESOURCE COST (v4.52). This branch
       answered before `prompt.cost` was ever read — right while the only
       records were v3.93's, where the destroy IS the whole price and the
       cost is 0, and WRONG the moment a card charges both. Silent
       Stilettos prints "you may pay {r}{r}{r}. If you do, destroy this
       and gain 1 action point", so a line saying only "destroyed Silent
       Stilettos" omits three resources the player actually spent — which
       is the sev-2 category the player TRUSTS, and the same hole v4.37
       found in this very function one verb over.

       THE EXISTING PHRASES ARE EXTENDED, NEVER REPLACED (v3.81).
       `tools/selfplay.js`'s `destroycost` counter matches " destroyed X
       — the rider resolves." and "… rather than destroy it.", and a
       reworded line would report ZERO exactly as a missing route does.
       Both spellings still end the same way, and the drill pins the
       counter's regex against what this function emits. */
    const paid = prompt.cost > 0;
    return took ? (paid ? " paid " + prompt.cost + " and" : "") + " destroyed " + prompt.src
                : (paid ? " declined to pay " + prompt.cost + " and kept " + prompt.src + " rather than destroy it"
    /* THE DECLINE LINE NAMES THE PRICE, not just the card. In a training
       sim the feed is the lesson, and "kept X" alone does not say what
       keeping it cost — it also gives the self-play harness a phrase to
       count that cannot collide with the counter verb below (v3.81). */
                        : " kept " + prompt.src + " rather than destroy it");
  }
  if(prompt.spendCtr)
    return took ? " took a " + prompt.spendCtr.kind + " counter off " + prompt.src
                : " kept the " + prompt.spendCtr.kind + " counter on " + prompt.src;
  if(prompt.tapHero)
    return took ? " tapped to power " + prompt.src
                : " declined to tap for " + prompt.src;
  return took ? " paid " + prompt.cost + (prompt.taps ? " and tapped " + prompt.src : "")
              : " declined to pay " + prompt.cost;
}

/* Resolve a confirmed prompt.
   Returns {game, msgs, ops, pay} — the trainer logs `msgs`, feeds `ops`
   to runOps and charges `pay`. This module runs no effects and touches no
   resources, which is what keeps it drillable without a deck. */
function applyPrompt(game, prompt){
  const out = {game, msgs:[], ops:[], pay:0};
  if(!prompt) return out;
  const side = prompt.side;
  /* THE SEAT IS NAMED, NEVER ASSUMED (v4.46). This read
     `side === 0 ? "You" : "The opponent"`, and every one of the six lines
     below goes into `out.msgs`, which `effects.js` pushes STRAIGHT INTO THE
     FEED (`r.msgs.forEach(m => { n = L(n, m); })`). v2.83's rule is exactly
     this split — `say(...)` reaches a feed BOTH seats read, so it names the
     seat; only a `return "reason"` speaks in the second person — and these
     are the first kind.

     MEASURED: 55 feed lines over 15 driven games opened with a hardcoded
     seat name while both seats were named after heroes, so half of them
     called the reader's opponent "You" and the other half called a named
     hero "The opponent". It is v4.15's own defect (86 "You soaks" lines in
     210 games) one variable over: that version built `svName` and fixed the
     VERB here, so the agreement was already correct — against a name that
     was wrong.

     THE FALLBACK IS THE TRAINER'S, AND IT COSTS NOTHING THERE. `index.html`
     names seat 0 literally "You" and seat 1 "The Dummy", so seat 0's lines
     are byte-identical and seat 1's stop saying "The opponent" about a seat
     that has a name — which is the same direction v3.46 moved and the rule
     v4.22 restates. `svName` reads the name, so the verb still agrees:
     "You soak", "Kayo soaks", "The Dummy soaks".

     NOT A POSSESSIVE (v4.22). Every site below uses `who` bare; the one
     apostrophe in this family is on a CARD's name, which is never "You". */
  const who = (game.sides && game.sides[side] && game.sides[side].name)
              || (side === 0 ? "You" : "The opponent");
  if(prompt.tag === "opt"){
    const keep = prompt.cards.filter((_,i)=>!prompt.down.includes(i));
    const bottom = prompt.cards.filter((_,i)=>prompt.down.includes(i));
    const sides = game.sides.slice();
    const s = {...sides[side]};
    /* THE ONE LINE THAT SEPARATES A REORDER FROM AN OPT (v3.71): the
       toggled cards go UNDER the kept ones and stay in the top N, rather
       than to the bottom of the deck. */
    s.deck = prompt.keepTop
      ? [...keep, ...bottom, ...(s.deck||[]).slice(prompt.cards.length)]
      : [...keep, ...(s.deck||[]).slice(prompt.cards.length), ...bottom];
    sides[side] = s;
    out.msgs.push(prompt.keepTop
      ? ((prompt.src ? prompt.src + " — " : "") + "the top " + prompt.cards.length
         + " go back as " + [...keep, ...bottom].map(c=>c.name).join(", ") + ".")
      : ("Opt — " +
      (keep.length ? keep.map(c=>c.name).join(", ") + " left on top" : "nothing kept on top") +
      (bottom.length ? ", " + bottom.map(c=>c.name).join(", ") + " sent to the bottom" : "") + "."));
    out.game = {...game, sides};
    return out;
  }
  if(prompt.tag === "pick"){
    const picked = prompt.sel.map(i=>prompt.cards[i]).filter(Boolean);
    /* DECLINED. The cost was not paid, so the "if you do" rider does NOT
       fire — out.ops stays empty. This is the same rule the `pay` variant
       enforces, and the reason an optional cost can be modelled at all
       without re-opening the v2.04 free-ability bug. */
    if(!picked.length){ out.msgs.push(who + " chose nothing."); return out; }
    if(prompt.to) out.game = moveCards(game, side, prompt.zone, prompt.to, picked);
    /* THE CHOICE, STRUCTURALLY. It used to be reported in `msgs` alone, so
       a caller that needed to know WHICH card was chosen had to parse
       prose — and asserting on log prose is the thing this project has
       been bitten by most. */
    out.picked = picked;
    /* CALLER-SUPPLIED CANDIDATES HAVE NO ZONE, and saying one anyway is a
       feed line that lies: Cold Snap's freeze picks across the opponent's
       arsenal and their allies, and the default zone label read "revealed
       from hand". */
    out.msgs.push(picked.map(c=>c.name).join(", ") +
      (prompt.to ? " → " + prompt.to
                 : prompt.zone ? " revealed" : " chosen") +
      (prompt.zone ? " from " + prompt.zone : "") + ".");
    /* AND WHERE THE ORDER IS THE DECISION, SAY WHAT IT WAS (v4.59). Crown
       of Dichotomy prints "in any order", `promptToggleSel` pushes onto
       `sel` in TAP ORDER and `moveCards`' deckTop branch front-inserts the
       list — so the first card tapped is the first card drawn, and the
       player has just made a choice the shared line above does not report.
       In a training sim the feed is the lesson (v3.60).

       MEASURED: every other `pickPrompt` that puts cards on top of a deck
       is `max: 1`, so this reaches nothing else in the pool today. */
    if(prompt.to === "deckTop" && picked.length > 1)
      out.msgs.push("On top of the deck: " + picked[0].name + " first, then "
        + picked.slice(1).map(c=>c.name).join(", ") + ".");
    /* PAID. The cards moved, so the rider resolves. */
    out.ops = prompt.ops || [];
    /* AND THE PRICE IS ONLY CHARGED WHEN SOMETHING WAS ACTUALLY TAKEN.
       The decline path above returns early, so this is unreachable on a
       "choose none" — which is the v2.04 rule the `pay` variant already
       enforces, applied to a pick that carries its own cost. */
    if(prompt.cost) out.pay = prompt.cost;
    return out;
  }
  /* ALLOC — THE ALLOCATION LEAVES AS DATA (v4.44), for this module's
     founding reason: it runs no effects and touches no state, so it
     reports WHICH permanent took HOW MANY and `applyAnswer` writes the
     counters. That is `ctrStamp`'s existing split (v3.53) rather than a
     new one.

     THE COUNTS COME OUT OF THE MULTISET, so the sheet's own tally and the
     placement cannot disagree about a number — one record of one fact.

     THE RECORD'S FIELD IS `put`, NEVER `n`. `spec.n` is the BUDGET the
     printed line grants and this is what LANDED on one permanent; naming
     them alike is the same-name-different-meaning trap `KNOWN_COLLISIONS`
     polices, one object over.

     AND PLACING NOTHING IS AN ANSWER, NOT A DECLINE. "Up to four" permits
     zero, so the early return says so in the feed and returns no ops; the
     `pick` branch above makes the same distinction for a cost that was
     not paid (v2.04). */
  if(prompt.tag === "alloc"){
    const counts = new Map();
    for(const i of prompt.sel) counts.set(i, (counts.get(i) || 0) + 1);
    const placed = [...counts.entries()]
      .map(([i, k]) => ({card: prompt.cards[i], put: k}))
      .filter(x => x.card);
    if(!placed.length){
      out.msgs.push(who + " placed no counters.");
      return out;
    }
    out.alloc = placed;
    out.msgs.push(placed.map(x => x.card.name + " +" + x.put).join(", ")
      + " — " + prompt.sel.length + " of " + prompt.max + " placed.");
    return out;
  }
  if(prompt.tag === "modal"){
    /* DECLINING IS A CHOICE, NOT A CANCEL (v3.90, and v2.77's rule for
       `pay`). An optional modal that was declined runs NOTHING — neither
       the cost nor the rider — which is what "you may" says. */
    if(prompt.choice === "decline"){
      out.msgs.push(who + " declined.");
      return out;
    }
    const opt = prompt.options[prompt.choice];
    out.msgs.push("Mode chosen: " + (opt && opt.label ? opt.label : String(opt)) + ".");
    out.ops = (opt && opt.ops) || [];
    return out;
  }
  if(prompt.tag === "pay"){
    if(prompt.choice !== "pay"){
      /* A COST THAT IS NOT RESOURCES MUST NOT SAY "declined to pay 0"
         (v4.24), and there are FOUR such verbs rather than the two this
         line used to know — see `payVerb`, which is now the one place
         either answer is named. */
      out.msgs.push(who + payVerb(prompt, false) + ".");
      /* "…unless they pay" — declining is what makes the consequence
         happen. These are actor-relative to the ASKED side, because that
         is the actor a prompt resolves at. */
      out.ops = prompt.elseOps || [];
      return out;
    }
    out.pay = prompt.cost;
    out.ops = prompt.ops || [];
    /* The TAP leaves as data, like the payment: this module runs no
       effects and touches no state. The caller marks the permanent spent. */
    if(prompt.taps && prompt.tapUid != null) out.tap = prompt.tapUid;
    if(prompt.tapHero) out.tapHero = true;
    /* THE DESTRUCTION LEAVES AS DATA, like the payment and the tap: this
       module runs no effects and touches no state, so it reports WHICH
       permanent was spent and the caller destroys it (v3.93). */
    if(prompt.destroyUid != null) out.destroy = prompt.destroyUid;
    if(prompt.spendCtr) out.spendCtr = prompt.spendCtr;
    /* AND THE DEFENDER THE +{d} BELONGS TO (v4.53), for the same reason
       and in the same shape: the caller routes it. */
    if(prompt.defUid != null) out.defUid = prompt.defUid;
    /* PAST TENSE, SO THE VERB NEED NOT AGREE WITH THE NAME. `who` is
       "You" or "The opponent" and those take different verb forms — the
       existing "paid" dodges it the same way, and v2.83 is the version
       that had to learn a cross-seat line names one seat. */
    out.msgs.push(who + payVerb(prompt, true) + " — the rider resolves.");
    return out;
  }
  /* SOAK. This module runs no effects and touches no resources, so the
     whole outcome leaves as data: `pay` is charged by the trainer, the
     spellvoid destructions and the surviving damage leave as `ops` and are
     fed to runOps at the ASKED side's actor (promptConfirm borrows it).

     THE DAMAGE RIDES OUT ON `ops`, AND THAT IS THE DESIGN, not a
     shortcut. Prompts are queued and drained after the action resolves, so
     an arcane hit applied at its own site would land BEFORE the hero was
     ever asked — the prevention would arrive after the damage it was meant
     to prevent. Deferring the hit into the answer is what puts the trigger
     above the damage on the stack, which is where the CR puts it.

     `arcTaken` lands on the ACTOR because the actor here is the threatened
     side. That is the whole reason it is a separate op from `arcane`,
     which damages the foe. */
  if(prompt.tag === "soak"){
    const chosen = (prompt.sel || []).map(i => prompt.options[i]).filter(Boolean);
    const prevented = chosen.reduce((a, o) => a + (o.amount || 0), 0);
    const cost = chosen.reduce((a, o) => a + (o.cost || 0), 0);
    /* Prevention is capped by the damage; the PAYMENT is not (RULING:
       Arcane Barrier 2 costs 2 to prevent 1). Charging only what was used
       would make the keyword strictly better than printed. */
    const through = Math.max(0, (prompt.amount || 0) - prevented);
    out.pay = cost;
    out.ops = [...chosen.filter(o => o.kind === "spellvoid").map(o => ["destroyGear", o.uid]),
               ["arcTaken", through, prompt.src || "", prompt.by]];
    /* THE VERB AGREES WITH THE SEAT (v4.15). `who` is "You" for seat 0,
       so a bare "soaks" reads "You soaks 1 of 2 arcane" — and this is the
       ONE second-person line the self-play harness reaches, 86 times in
       210 games. `game.svName` is the one body; this module holds a NAME
       rather than a side, which is what that entry point is for. */
    out.msgs.push(chosen.length
      ? GM.svName(who, "soak") + " " + Math.min(prevented, prompt.amount || 0) + " of " + prompt.amount +
        " arcane with " + chosen.map(o => o.name + (o.kind === "spellvoid" ? " (destroyed)" : "")).join(", ") +
        (cost ? " for " + cost + "{r}" : "") + "."
      : GM.svName(who, "take") + " all " + prompt.amount + " arcane rather than spend.");
    return out;
  }
  /* CR 1.4.5 — the declared attack-target. This module moves nothing and
     deals no damage: it reports the choice on `out.target` and the trainer
     routes the attack. Same discipline as `pay` returning `pay` rather than
     spending, which is what keeps the whole module drillable. */
  if(prompt.tag === "target"){
    const t = prompt.cards[prompt.choice];
    if(!t) return out;
    out.target = t._target || {kind:"hero", side: side, uid:null};
    out.msgs.push(out.target.kind === "ally"
      ? "Attack declared at " + t.name + " — an ally cannot be defended (CR 7.3.2a)."
      : "Attack declared at " + (t.name || "the hero") + ".");
    return out;
  }
  if(prompt.tag === "reveal"){
    if(prompt.cards.length) out.msgs.push("Revealed: " + prompt.cards.map(c=>c.name).join(", ") + ".");
    return out;
  }
  return out;
}

return {PROMPT_ZONES, promptZoneWord, promptZone, promptSideZone, promptFilter,
        promptMatchSet, promptMatchAssign,
        promptPickPool, promptPickAskable, buildPrompt,
        promptToggleSel, promptChoose, promptDecline, promptTakeBack, promptReady, moveCards, applyPrompt};
});
