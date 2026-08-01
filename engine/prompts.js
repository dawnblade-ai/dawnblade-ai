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
    if(spec.type === "attack" && !isAttack(c)) return false;
    if(spec.type === "nonAttack" && isAttack(c)) return false;
    if(spec.tt != null && !new RegExp(spec.tt, "i").test(c.tt||"")) return false;
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
    const pool = promptZone(game, side, zone).filter(promptFilter(spec.filter));
    if(!pool.length) return null;
    const max = Math.min(spec.max != null ? spec.max : 1, pool.length);
    const min = Math.max(0, Math.min(spec.min != null ? spec.min : max, max));
    return {...base, zone, cards:pool, min, max,
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
    /* pay-or-decline. `avail` is what the asked side can actually spend;
       the caller supplies it because resources have not migrated onto
       sides[] yet (see CLAUDE.md, the counters pass). */
    const cost = spec.cost || 0;
    return {...base, cost, avail: spec.avail != null ? spec.avail : 0,
      ops: spec.ops || [], choice:null,
      title: spec.title || ("Pay " + cost + "?"),
      hint: spec.hint || "You may pay this. If you do, the rider resolves."};
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
  return prompt;
}
function promptChoose(prompt, choice){
  if(!prompt) return prompt;
  if(prompt.tag === "modal" || prompt.tag === "pay" || prompt.tag === "target")
    return {...prompt, choice};
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
    out.msgs.push(picked.map(c=>c.name).join(", ") +
      (prompt.to ? " → " + prompt.to : " revealed") + " from " + prompt.zone + ".");
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
    if(prompt.choice !== "pay"){ out.msgs.push(who + " declined to pay " + prompt.cost + "."); return out; }
    out.pay = prompt.cost;
    out.ops = prompt.ops || [];
    out.msgs.push(who + " paid " + prompt.cost + " — the rider resolves.");
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
        promptToggleSel, promptChoose, promptReady, moveCards, applyPrompt};
});
