/* ============================================================
   Dawnblade engine — report.js (v2.51)

   JUDGE!! — THE BOARD, WRITTEN DOWN.

   Every fix in this project came from playing and noticing. The expensive
   part was never noticing; it was reconstructing the board afterwards
   from a screenshot. So the report captures the whole state and the note
   can be one line: "this looked wrong".

   ---- WHY IT IS A MODULE NOW ------------------------------------------

   It was a closure inside `Battle`, which meant two things. The table
   board could not produce one at all — the screen where a bug is hardest
   to reconstruct, because there are TWO boards and the interesting
   question is which one is wrong. And no drill could reach it, so the
   one artefact a bug report depends on was the one thing never tested.

   Phase 3 is the card-text pass: hundreds of small semantic changes,
   found by playing. This is the tool that pass runs on, so it is worth
   having exactly one of, drilled, shared by both boards.

   ---- IT READS WHATEVER IT IS GIVEN -----------------------------------

   The trainer speaks `mode`/`bphase`; judge.js speaks
   `phase`/`step`/`priority`. Rather than branch on which engine produced
   the state, both blocks are read and whichever is absent simply drops
   out of the JSON. A report from either board is the same shape, and the
   difference between them is visible rather than hidden.

   ---- THE REPLAY KEY IS THE POINT -------------------------------------

   `rng.seed` deals the same decks and rolls the same dice; `s` and `n`
   say exactly how far the stream had advanced. Together they turn "this
   looked wrong" into a reproducible game rather than a screenshot to
   squint at. Anything that drops them makes the report a story instead
   of evidence.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./parser.js"), require("./game.js"), require("./invariants.js"));
  else root.DawnReport = factory(root.DawnParser, root.DawnGame, root.DawnInvariants);
})(typeof self!=="undefined" ? self : this, function(PR, GM, IV){

const REPORT_V = 2;

const nm = c => c ? ((c.name || "?") + (c.uid != null ? "#" + c.uid : "")) : null;
const list = a => Array.isArray(a) ? a : [];

/* One seat, in the detail a rules bug actually needs: what is in every
   zone BY NAME AND UID, every counter, and the turn-stamps on the
   graveyard. `_gy` is what answers the whole "discarded a card with 6 or
   more {p} this turn" family, so it travels. */
function seat(sd){
  if(!sd) return null;
  return {
    name: sd.name, hero: sd.hero, heroKey: sd.heroKey,
    hp: sd.hp, maxHp: sd.maxHp, int: sd.int, baseInt: sd.baseInt,
    res: sd.res, ap: sd.ap, wasted: sd.wasted,
    counts: {deck: list(sd.deck).length, hand: list(sd.hand).length, grave: list(sd.grave).length,
      pitch: list(sd.pitch).length, banish: list(sd.banish).length, soul: list(sd.soul).length,
      board: list(sd.board).length, gear: list(sd.gear).length, arsenal: sd.arsenal ? 1 : 0},
    hand: list(sd.hand).map(nm),
    arsenal: nm(sd.arsenal),
    board: list(sd.board).map(b => ((b.card && b.card.name) || b.name || "?")
      + (b.kind ? " [" + b.kind + "]" : "") + (b.life != null ? " life " + b.life : "")
      + (b.spent ? " (spent)" : "") + (b.sd ? " [dies:" + b.sd + "]" : "")),
    gear: list(sd.gear).map(gr => gr.name + (gr.destroyed ? " (destroyed)" : "")
      + " d" + (GM.gearDef ? GM.gearDef(gr) : (gr.curDef != null ? gr.curDef : gr.def))),
    grave: list(sd.grave).map(c => c.name + (c._gy != null ? " _gy" + c._gy : "")),
    pitch: list(sd.pitch).map(c => c.name + " p" + (c.pitch || 0)),
    soul: list(sd.soul).map(c => c.name),
    banish: list(sd.banish).map(c => c.name),
    counters: sd.counters,
    blockH: list(sd.blockH).length, blockG: list(sd.blockG).length,
    chainBlocked: sd.chainBlocked,
    paySel: list(sd.paySel).length,
    intimidated: list(sd.intimidated).map(c => c.name),
    status: {amp: sd.amp, ward: sd.ward, awd: sd.awd,
      rune: PR.runeCount ? PR.runeCount(sd) : undefined,
      auras: PR.auraCount ? PR.auraCount(sd) : undefined,
      rot: sd.rot, fra: sd.fra, arcShield: sd.arcShield,
      /* DERIVED off the board since v2.74, the same way `rune` above is —
         a report that printed a stale counter beside a board that
         disagreed with it would send the reader hunting the wrong bug. */
      frost: PR.frostCount ? PR.frostCount(sd) : undefined,
      lifeLock: sd.lifeLock, marked: sd.marked, buffNext: sd.buffNext, buffQ: sd.buffQ,
      gaNext: sd.gaNext, weaponUsed: sd.weaponUsed},
    hist: sd.hist
  };
}

/* `ctx` carries what the STATE does not know about itself: which build
   produced it, who is sitting where, and anything the caller wants to
   staple on (net.js's counters, for one). It never reaches into a React
   closure — everything is passed. */
function build(g, ctx){
  ctx = ctx || {};
  g = g || {};
  const sides = list(g.sides);
  let invNow = [], invErr = null;
  /* THE REPORT MUST SURVIVE A STATE THE JUDGE CANNOT READ. A bug report
     that throws while describing a broken board is worse than useless —
     that is exactly the board you most need described. */
  try { invNow = IV.check(g).map(v => v.severity + " " + v.code + ": " + v.msg); }
  catch(e){ invErr = String((e && e.message) || e); }

  return {
    _what: "Dawnblade bug report — open an issue or paste this to Claude.",
    _v: REPORT_V,
    note: ctx.note || "",
    at: new Date().toISOString(),
    source: ctx.source || "trainer",
    appVer: ctx.appVer, dataVer: ctx.dataVer,
    /* THE REPLAY KEY — see the header. */
    rng: g.rng ? {seed: g.rng.seed, s: g.rng.s, draws: g.rng.n} : null,
    hero: ctx.hero, heroName: ctx.heroName, seating: ctx.seating,
    mySeat: ctx.mySeat, table: ctx.table,

    turn: g.turn, turnPlayer: g.turnPlayer, actor: g.actor,
    /* BOTH STATE LANGUAGES, AND WHICH ONE IS LOAD-BEARING.

       Every game carries both: `sides.js`'s `makeGame` seeds `mode` and
       `bphase` into the state the judge uses too, and the trainer has
       carried a derived `phase`/`step`/`priority` since v2.27's shadow
       pass. So neither being present tells you which engine is actually
       driving — and a table report showing `bphase:"defend"` sends the
       reader straight into the trainer to look for a bug that is not
       there. Nothing is hidden; the authoritative vocabulary is NAMED. */
    machine: {lang: (ctx.source === "table" ? "phase" : "mode"),
              mode: g.mode, bphase: g.bphase, incoming: g.incoming,
              phase: g.phase, step: g.step, priority: g.priority,
              passed: g.passed, arsenalFor: g.arsenalFor},
    chainOpen: g.chainOpen,
    chain: list(g.chain).map(l => l.n || l.label || l.k || "link"),
    chainCards: list(g.chainCards).map(x => (x.by != null ? "s" + x.by + " " : "") + nm(x.card)),
    stack: list(g.stack).map(l => l.label || l.k),
    pending: g.pending ? {kind: g.pending.kind, seat: g.pending.seat,
      card: g.pending.card && g.pending.card.name, from: g.pending.from, need: g.pending.need} : null,
    pend: g.pend ? {card: g.pend.card && g.pend.card.name, total: g.pend.total,
      by: g.pend.by, target: g.pend.target} : null,
    prompt: g.prompt ? {tag: g.prompt.tag, side: g.prompt.side, src: g.prompt.src,
      cards: list(g.prompt.cards).map(c => c.name), sel: g.prompt.sel, choice: g.prompt.choice} : null,
    promptQ: list(g.promptQ).map(p => p.tag + ":" + (p.src || "")),
    lastRoll: g.lastRoll, lastDmg: g.lastDmg, flags: g.flags, over: g.over,

    sides: sides.map(seat),
    /* Kept for the trainer's own vocabulary, and because a reader
       scanning for "you" should find it. Same objects, named twice. */
    you: seat(sides[ctx.mySeat != null ? ctx.mySeat : 0]),
    opponent: seat(sides[ctx.mySeat != null ? 1 - ctx.mySeat : 1]),

    invariantsNow: invNow,
    invariantsError: invErr,
    invariantsSeen: ctx.invariantsSeen || [],
    net: ctx.net || null,
    feed: list(g.feed)
  };
}

const text = (g, ctx) => JSON.stringify(build(g, ctx), null, 2);

const filename = (g, ctx) => "dawnblade-bug-"
  + ((ctx && ctx.hero) || (g && g.sides && g.sides[0] && g.sides[0].heroKey) || "game")
  + "-t" + ((g && g.turn) || 0) + "-" + Date.now() + ".json";

return {REPORT_V, build, text, filename, seat};
});
