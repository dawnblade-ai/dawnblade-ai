/* ============================================================
   Dawnblade engine — invariants.js

   THE GUARD RAILS. A judge that audits the game state itself.

   Every bug that shipped this cycle was found by eye or in play, never
   by a red test: auras that crumbled and came back, defenders that were
   never cleared, a pitch selection that carried into the next payment.
   They share a shape — the state ended up in a condition the rules of
   Flesh and Blood do not permit — and none of them needed a card to
   detect. They needed somebody to LOOK at the board and say "that card
   is in two places at once".

   That is what this module does. `check(game)` is pure, reads no card
   text, runs in microseconds, and returns a list of violations. Wire it
   in after every state transition and a whole class of bug becomes
   impossible to ship quietly.

   Two rules from the Comprehensive Rules are enforced here directly:
     CR 7.3.2b — a card already defending on a chain link cannot be
                 declared as a defending card again.
     CR 4.4.3e — action points and resource points are lost by ALL
                 players in the end phase (checked as "never negative").

   The rest are structural: a card exists in exactly one zone, a
   per-side field is never written onto the game object, both seats
   declare the same shape. Structural does not mean unimportant — the
   crumbling-aura bug WAS "this card is in two zones", and it shipped.

   Severity:
     "error" — the state is illegal; a rule is being broken right now.
     "warn"  — legal but almost certainly a mistake.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./sides.js"), require("./priority.js"));
  else root.DawnInvariants = factory(root.DawnSides, root.DawnPriority);
})(typeof self!=="undefined" ? self : this, function(S, P){

/* Zones that hold an ARRAY of cards. `arsenal` is deliberately absent:
   it holds a single card or null, which is its own check below. */
const LIST_ZONES = ["deck","hand","pitch","grave","banish","soul","board","gear"];

/* A board entry wraps a card ({card, kind, spent, uid}); gear entries and
   the rest are cards directly. Pull the uid either way. */
function uidOf(entry){
  if(entry == null) return null;
  if(typeof entry !== "object") return null;
  if(entry.uid != null) return entry.uid;
  if(entry.card && entry.card.uid != null) return entry.card.uid;
  return null;
}
function nameOf(entry){
  if(entry == null) return "(null)";
  return (entry.name) || (entry.card && entry.card.name) || "(unnamed)";
}

/* Every (uid, zone, name) the state holds, for one side. */
function census(side, si){
  const out = [];
  for(const z of LIST_ZONES){
    const list = side[z];
    if(!Array.isArray(list)) continue;
    list.forEach((entry, i) => {
      const uid = uidOf(entry);
      if(uid != null) out.push({uid, zone: "sides[" + si + "]." + z, idx: i, name: nameOf(entry)});
    });
  }
  if(side.arsenal){
    const uid = uidOf(side.arsenal);
    if(uid != null) out.push({uid, zone: "sides[" + si + "].arsenal", idx: 0, name: nameOf(side.arsenal)});
  }
  return out;
}

function check(game){
  const V = [];
  const err  = (code, msg, where) => V.push({code, severity:"error", msg, where: where||""});
  const warn = (code, msg, where) => V.push({code, severity:"warn",  msg, where: where||""});

  if(!game || typeof game !== "object"){ err("NO-GAME", "game state is not an object"); return V; }

  /* ---- shape: two seats, same keys ---------------------------------- */
  if(!Array.isArray(game.sides)){ err("NO-SIDES", "game.sides is not an array"); return V; }
  if(game.sides.length !== 2) err("SIDE-COUNT", "expected exactly 2 sides, found " + game.sides.length);
  const sides = game.sides.filter(Boolean);
  if(sides.length !== game.sides.length){ err("NULL-SIDE", "a side is null/undefined"); return V; }

  if(sides.length === 2){
    const k0 = Object.keys(sides[0]).sort(), k1 = Object.keys(sides[1]).sort();
    const only = (a, b) => a.filter(x => b.indexOf(x) < 0);
    const l = only(k0, k1), r = only(k1, k0);
    if(l.length || r.length)
      err("SIDES-ASYMMETRIC",
          "the two seats do not declare the same fields — a second human cannot occupy a seat that is a different shape" +
          (l.length ? "; only on side 0: " + l.join(", ") : "") +
          (r.length ? "; only on side 1: " + r.join(", ") : ""));
    /* every field makeSide promises must actually be there */
    for(let i = 0; i < 2; i++){
      const missing = S.SIDE_FIELDS.filter(f => !(f in sides[i]));
      if(missing.length) err("SIDE-MISSING-FIELDS", "sides[" + i + "] is missing: " + missing.join(", "));
    }
  }

  /* ---- THE v2.18/v2.19 BUG CLASS -----------------------------------
     `{...s, ward, blockH:[]}` writes a per-side field onto the GAME
     object. The side keeps its old value and the write silently does
     nothing. Five shipped that way and were found by reading the code.
     SIDE_FIELDS and GAME_KEYS share no names, so any per-side field
     sitting at the top level is unambiguously this mistake. */
  for(const f of S.SIDE_FIELDS){
    if(Object.prototype.hasOwnProperty.call(game, f))
      err("SIDE-FIELD-ON-GAME",
          "`" + f + "` is a per-side field but is set on the game object — the write went to the wrong place " +
          "and the side kept its old value. Use youMut()/oppMut().", f);
  }

  /* ---- zone shapes -------------------------------------------------- */
  sides.forEach((sd, si) => {
    for(const z of LIST_ZONES){
      if(!Array.isArray(sd[z]))
        err("ZONE-NOT-ARRAY", "sides[" + si + "]." + z + " should be an array, got " + typeof sd[z], z);
    }
    if(sd.arsenal !== null && sd.arsenal !== undefined && typeof sd.arsenal !== "object")
      err("ARSENAL-SHAPE", "sides[" + si + "].arsenal holds a single card or null, got " + typeof sd.arsenal);
    if(Array.isArray(sd.arsenal))
      err("ARSENAL-SHAPE", "sides[" + si + "].arsenal is an array — it holds ONE card or null");
  });

  /* ---- a card exists in exactly one zone ----------------------------
     This is the crumbling-aura bug (v2.16): auras were filtered off the
     board into the graveyard, then the board was rebuilt from the
     PRE-filter copy, so they sat in both zones at once. Nothing caught
     it for a whole version. */
  const all = sides.flatMap((sd, si) => census(sd, si));
  /* THE COMBAT CHAIN IS A ZONE TOO. An attack that has been declared has
     left its owner's hand and has not reached a graveyard — it is held on
     the chain until the close step (CR 7.7). Without this it is in NO
     zone, and a card in no zone is invisible to a census that only knows
     how to catch a card in two. `chainCards` is judge.js's name for it;
     a state that does not carry one simply contributes nothing here. */
  (game.chainCards || []).forEach((entry, i) => {
    const card = entry && (entry.card || entry);
    const uid = uidOf(card);
    if(uid != null) all.push({uid, zone: "chain", idx: i, name: nameOf(card)});
  });
  const byUid = new Map();
  for(const rec of all){
    if(!byUid.has(rec.uid)) byUid.set(rec.uid, []);
    byUid.get(rec.uid).push(rec);
  }
  for(const [uid, recs] of byUid){
    if(recs.length < 2) continue;
    const zones = recs.map(r => r.zone);
    const uniq = [...new Set(zones)];
    if(uniq.length > 1)
      err("CARD-IN-TWO-ZONES",
          "\"" + recs[0].name + "\" (uid " + uid + ") is in " + uniq.length + " zones at once: " + uniq.join(" + "),
          String(uid));
    else
      err("CARD-DUP-IN-ZONE",
          "\"" + recs[0].name + "\" (uid " + uid + ") appears " + recs.length + " times in " + uniq[0],
          String(uid));
  }

  /* ---- numbers ------------------------------------------------------ */
  const NUMS = ["hp","maxHp","int","res","ap","wasted","amp","ward","awd","rune",
                "rot","fra","frost","arcShield","buffNext","blockedHand"];
  sides.forEach((sd, si) => {
    for(const f of NUMS){
      const v = sd[f];
      if(v === undefined || v === null) continue;
      if(typeof v !== "number" || Number.isNaN(v))
        err("NAN-FIELD", "sides[" + si + "]." + f + " is not a number (" + String(v) + ")", f);
    }
    /* CR 4.4.3e — resource and action points are lost, never owed. */
    if(sd.res < 0) err("NEGATIVE-RES", "sides[" + si + "].res is " + sd.res + " — a player cannot owe resources", "res");
    if(sd.ap  < 0) err("NEGATIVE-AP",  "sides[" + si + "].ap is " + sd.ap + " — a player cannot owe action points", "ap");
    if(sd.hp > sd.maxHp)
      warn("HP-ABOVE-START", "sides[" + si + "] is at " + sd.hp + " of a starting " + sd.maxHp +
           " — legal in FaB (there is no life cap), flagged only because most gains in this pool are capped", "hp");
  });

  /* ---- the clock and the machine ------------------------------------ */
  if(game.phase != null && P.PHASES.indexOf(game.phase) < 0)
    err("BAD-PHASE", "phase \"" + game.phase + "\" is not one of " + P.PHASES.join("/"), "phase");
  if(game.step != null && P.STEPS.indexOf(game.step) < 0)
    err("BAD-STEP", "step \"" + game.step + "\" is not one of " + P.STEPS.join("/"), "step");
  /* CR 4.2.1 / 4.4.1 — players do not get priority during the start or
     end phase, so nobody should be holding it there. */
  if((game.phase === "start" || game.phase === "end") && game.priority != null)
    err("PRIORITY-IN-CLOSED-PHASE",
        "someone holds priority during the " + game.phase + " phase — CR 4.2.1/4.4.1 say players do not get priority there",
        "priority");
  /* CR 7.7.1 — "Players do not get priority during the Close Step." The
     phase check above cannot see this: the close step happens inside the
     ACTION phase, which is wide open. */
  if(game.step === "close" && game.priority != null)
    err("PRIORITY-IN-CLOSE-STEP",
        "someone holds priority during the close step — CR 7.7.1 says players do not get priority there",
        "priority");
  if(game.priority != null && game.priority !== 0 && game.priority !== 1)
    err("BAD-PRIORITY", "priority is " + game.priority + " — must be seat 0 or 1", "priority");
  if(game.turnPlayer != null && game.turnPlayer !== 0 && game.turnPlayer !== 1)
    err("BAD-TURN-PLAYER", "turnPlayer is " + game.turnPlayer + " — must be seat 0 or 1", "turnPlayer");

  /* ---- the combat chain --------------------------------------------
     CR 7.3.2b: a card already defending on a chain link cannot be
     declared as a defending card again. The trainer tracks this for
     equipment (chainBlocked) because non-equipment defenders leave for
     the graveyard; this checks the whole chain regardless. */
  if(Array.isArray(game.chain)){
    const seen = new Map();
    game.chain.forEach((link, li) => {
      const defs = (link && (link.defs || link.defenders)) || [];
      (Array.isArray(defs) ? defs : []).forEach(d => {
        const uid = uidOf(d);
        if(uid == null) return;
        if(seen.has(uid))
          err("DEFENDER-REUSED-ON-CHAIN",
              "\"" + nameOf(d) + "\" is declared as a defending card on chain links " +
              seen.get(uid) + " and " + (li + 1) + " — CR 7.3.2b forbids re-declaring a card already defending",
              String(uid));
        else seen.set(uid, li + 1);
      });
    });
    if(!game.chainOpen && game.chain.length)
      warn("CHAIN-CLOSED-WITH-LINKS",
           "the chain is closed but still holds " + game.chain.length + " link(s) — links should clear when it closes (CR 7.7)",
           "chain");
  }

  /* ---- prompts ------------------------------------------------------ */
  if(game.prompt){
    const ps = game.prompt.side;
    if(ps !== 0 && ps !== 1)
      err("PROMPT-BAD-SIDE", "the open prompt is addressed to side " + ps + " — must be 0 or 1", "prompt.side");
  }
  if(game.promptQ && !Array.isArray(game.promptQ))
    err("PROMPTQ-SHAPE", "promptQ must be an array", "promptQ");

  /* ---- the game is over, or it is not ------------------------------- */
  sides.forEach((sd, si) => {
    if(sd.hp <= 0 && !game.over)
      warn("DEAD-BUT-RUNNING", "sides[" + si + "] is at " + sd.hp + " life but the game is not marked over", "hp");
  });

  return V;
}

/* Errors only — the set that means "a rule is being broken right now". */
const errors = game => check(game).filter(v => v.severity === "error");
const clean  = game => errors(game).length === 0;

function describe(violations){
  if(!violations.length) return "state is clean";
  return violations.map(v =>
    (v.severity === "error" ? "✗ " : "! ") + v.code + " — " + v.msg).join("\n");
}

/* For drills and for the trainer's dev guard: throw with a readable
   report rather than returning a list nobody looks at. */
function assertClean(game, label){
  const bad = errors(game);
  if(bad.length) throw new Error("invariant violation" + (label ? " after " + label : "") + ":\n" + describe(bad));
  return game;
}

return {LIST_ZONES, census, check, errors, clean, describe, assertClean};
});
