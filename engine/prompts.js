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
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"));
  else root.DawnPrompts = factory(root.DawnParser);
})(typeof self!=="undefined" ? self : this, function(P){

const {isAttack} = P;

/* Zones a prompt may draw from. `arsenal` is a single card and `board`
   holds wrappers rather than cards, so both are normalised on read. */
const PROMPT_ZONES = ["hand","deck","grave","banish","soul","pitch","arsenal","board","gear"];

function promptZone(game, side, zone){
  const s = game.sides[side];
  if(!s) return [];
  if(zone === "arsenal") return s.arsenal ? [s.arsenal] : [];
  if(zone === "board") return (s.board||[]).map(b=>b && b.card).filter(Boolean);
  return s[zone] || [];
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
    if(spec.ty != null && !(c.ty||[]).some(t => String(t).toLowerCase() === String(spec.ty).toLowerCase()))
      return false;
    if(spec.pitch != null && (c.pitch||0) !== spec.pitch) return false;
    if(spec.costLe != null && (c.cost||0) > spec.costLe) return false;
    if(spec.costGe != null && (c.cost||0) < spec.costGe) return false;
    if(spec.powerGe != null && (c.power||0) < spec.powerGe) return false;
    if(spec.powerLe != null && (c.power||0) > spec.powerLe) return false;
    if(spec.defGe != null && (c.def||0) < spec.defGe) return false;
    if(spec.name != null && !new RegExp(spec.name, "i").test(c.name||"")) return false;
    return true;
  };
}

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
    return {...base, cards:look, n,
      title: spec.title || ("Opt " + n),
      hint: spec.hint || ("Top " + (n===1 ? "card" : n + " cards") +
        " of your deck. Tap any you want on the bottom instead — the rest stay on top in this order.")};
  }
  if(spec.tag === "pick"){
    const zone = spec.zone || "hand";
    /* CANDIDATES MAY BE THE CALLER'S, the way `target`'s already are — a
       choice does not always live in one zone. Cold Snap's freeze picks
       from the opponent's ARSENAL and their ALLIES together, which is two
       zones, and teaching `promptZone` a synthetic third would put a rules
       decision inside a module that is meant to stay data-driven. */
    const pool = (spec.cards ? spec.cards.filter(Boolean) : promptZone(game, side, zone))
      .filter(promptFilter(spec.filter));
    if(!pool.length) return null;
    const max = Math.min(spec.max != null ? spec.max : 1, pool.length);
    const min = Math.max(0, Math.min(spec.min != null ? spec.min : max, max));
    return {...base, zone: spec.cards ? null : zone, cards:pool, min, max,
      to: spec.to || null, optional: min === 0,
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
      /* WHICH SEAT'S FREEZE THIS IS. Like `arsStamp` it is DATA, not ops:
         this module runs no effects, and the stamp belongs to the object
         that was chosen rather than to the source. `applyAnswer` reads it
         off `out.picked`. */
      freezeSide: spec.freezeSide != null ? spec.freezeSide : null,
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
      title: spec.title || (max === 1 ? "Choose a card" : "Choose up to " + max),
      hint: spec.hint || ("From your " + zone + (spec.to ? " → " + spec.to : "") + ".")};
  }
  if(spec.tag === "modal"){
    const options = (spec.options||[]).filter(Boolean);
    if(options.length < 2) return null;
    return {...base, options, choice:null,
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
function promptChoose(prompt, choice){
  if(!prompt) return prompt;
  if(prompt.tag === "modal" || prompt.tag === "pay" || prompt.tag === "target")
    return {...prompt, choice};
  return prompt;
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
function promptDecline(prompt){
  if(!prompt) return prompt;
  if(prompt.tag === "pay") return promptChoose(prompt, "decline");
  if(prompt.tag === "pick" && prompt.optional) return {...prompt, sel: []};
  return prompt;
}

/* Can this be confirmed as it stands? */
function promptReady(prompt){
  if(!prompt) return false;
  if(prompt.tag === "pick") return prompt.sel.length >= prompt.min;
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

/* Resolve a confirmed prompt.
   Returns {game, msgs, ops, pay} — the trainer logs `msgs`, feeds `ops`
   to runOps and charges `pay`. This module runs no effects and touches no
   resources, which is what keeps it drillable without a deck. */
function applyPrompt(game, prompt){
  const out = {game, msgs:[], ops:[], pay:0};
  if(!prompt) return out;
  const side = prompt.side;
  const who = side === 0 ? "You" : "The opponent";
  if(prompt.tag === "opt"){
    const keep = prompt.cards.filter((_,i)=>!prompt.down.includes(i));
    const bottom = prompt.cards.filter((_,i)=>prompt.down.includes(i));
    const sides = game.sides.slice();
    const s = {...sides[side]};
    s.deck = [...keep, ...(s.deck||[]).slice(prompt.cards.length), ...bottom];
    sides[side] = s;
    out.game = {...game, sides};
    out.msgs.push("Opt — " +
      (keep.length ? keep.map(c=>c.name).join(", ") + " left on top" : "nothing kept on top") +
      (bottom.length ? ", " + bottom.map(c=>c.name).join(", ") + " sent to the bottom" : "") + ".");
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
    /* PAID. The cards moved, so the rider resolves. */
    out.ops = prompt.ops || [];
    return out;
  }
  if(prompt.tag === "modal"){
    const opt = prompt.options[prompt.choice];
    out.msgs.push("Mode chosen: " + (opt && opt.label ? opt.label : String(opt)) + ".");
    out.ops = (opt && opt.ops) || [];
    return out;
  }
  if(prompt.tag === "pay"){
    if(prompt.choice !== "pay"){
      out.msgs.push(who + " declined to pay " + prompt.cost + ".");
      /* "…unless they pay" — declining is what makes the consequence
         happen. These are actor-relative to the ASKED side, because that
         is the actor a prompt resolves at. */
      out.ops = prompt.elseOps || [];
      return out;
    }
    out.pay = prompt.cost;
    out.ops = prompt.ops || [];
    out.msgs.push(who + " paid " + prompt.cost + " — the rider resolves.");
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
               ["arcTaken", through, prompt.src || ""]];
    out.msgs.push(chosen.length
      ? who + " soaks " + Math.min(prevented, prompt.amount || 0) + " of " + prompt.amount +
        " arcane with " + chosen.map(o => o.name + (o.kind === "spellvoid" ? " (destroyed)" : "")).join(", ") +
        (cost ? " for " + cost + "{r}" : "") + "."
      : who + " takes all " + prompt.amount + " arcane rather than spend.");
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

return {PROMPT_ZONES, promptZone, promptFilter, buildPrompt,
        promptToggleSel, promptChoose, promptDecline, promptReady, moveCards, applyPrompt};
});
