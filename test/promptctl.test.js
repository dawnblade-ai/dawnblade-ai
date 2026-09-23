/* ============================================================
   AN ANSWER THE MODULE ACCEPTS, AND NO CONTROL THAT SENDS IT (v4.61)

     "When this attacks, YOU MAY discard a card OR destroy the top card of
      your deck. If that card has watery grave, this gets go again."
                                               — JITTERY BONES x3
     "When this defends, YOU MAY … "           — WASHED UP WAVE x1

   v3.90 built `optional` on a modal for a reason it wrote down in as many
   words: "a modal with no way out would make a 'you may' MANDATORY —
   stronger than printed, and the free-ability rule v2.04 fixed read from
   the other end." Every layer honoured it. `buildPrompt` carries the
   field, `promptDecline` gates on it, `promptChoose` records the answer,
   `promptReady` lets a declined sheet confirm, `applyPrompt` runs nothing,
   `judge.PROMPT_ACTIONS` accepts the action and `test/mill.test.js` drives
   all of it.

   AND THE SHEET — the ONE body both boards render (v4.44) — OFFERED NO
   CONTROL. Its modal row renders the modes and nothing else, `promptReady`
   holds Confirm dark until a mode is chosen, and the only answer either
   board could send was to pay. FOUR pool records, TWO cards, ONE deck
   (Gravy Bones'), every one `tier: full`, so a printed choice was spent
   every single time it was offered.

   v3.50's sentence for the seventh time, with a BUTTON as the missing
   caller — and the reason no instrument here could see it is that
   `judge.autoAnswer` answers a modal with `choice: 0`, so the ladder never
   declines one and 630 games a version report nothing.

   WHAT THIS FILE PINS IS THE PAIRING, AND IT IS THE HALF NO EXISTING
   CENSUS ASKS FOR. `test/speccensus.test.js` asks whether `buildPrompt`
   NAMES every field a spec carries — `optional` is in that set and always
   was. `test/judge.test.js` asks whether the table can SEND every action
   `PROMPT_ACTIONS` accepts. Neither asks whether the SHEET has a control
   for every answer the module accepts, which is where this lived.

   THE DRIVEN HALF IS THE MODULE AND THE SCANNED HALF IS THE SHEET,
   because a React component inside a `text/babel` block cannot be loaded
   in Node — so the acceptance is DRIVEN (never a table of tags) and only
   the presence of a control is read out of the source. The scan's reach is
   STATED below rather than assumed (v4.44, v4.50, v4.57).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PM = require("../engine/prompts.js");
const P  = require("../engine/parser.js");
const C  = require("../engine/cards.js");
const J  = require("../engine/judge.js");
const H  = require("./helpers/judged.js");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
/* COMMENTS ARE STRIPPED BEFORE THE BRACE WALK, and this file's own prose is
   why: an apostrophe in a comment ("Gravy Bones' list") reads as a string
   opener to a quote-aware counter, which swallows every brace until the next
   one and ends the walk hundreds of characters early. That is
   `html-balance.test.js`'s pre-neutralize list at one remove, and the
   project's standing answer applies — strip the prose, never weaken the
   scan. Nothing this census anchors on is a comment, which is the condition
   that makes stripping safe here (v4.57 found the opposite case one drill
   over). The stripper's CONTROL is routed THROUGH the scan (v4.32): the
   phrase below is built by concatenation, because written as a literal it
   would appear in THIS file rather than in the one being read. */
const codeOf = s => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const HTML = codeOf(read("index.html"));

/* ---- THE SHARED SHEET, SLICED ---------------------------------------
   NO BRACE COUNTING, AND THAT IS THE SECOND THING THIS FILE LEARNED. A
   quote-aware walk was the obvious bound and it ended hundreds of
   characters early, twice: once on an apostrophe in a COMMENT ("Gravy
   Bones' list") and again, after the comments were stripped, on one in
   JSX TEXT ("opponent's call"), because to a counter tracking quotes both
   open a string that swallows every brace until the next apostrophe. That
   is `html-balance.test.js`'s pre-neutralize list arriving one drill over,
   and a bound that ends early reads exactly like a clean scan (v3.81,
   v4.07) — it only failed loudly here because the assertions ask for
   something PRESENT.

   SO THE BOUNDS ARE STRUCTURAL. The component ends at the first column-0
   closing brace, and each tag's region runs from its own guard to the next
   guard or to the shared action row. Both are v4.57's safer form: nothing
   can read past the next sibling, and the widths are pinned as data below
   because a bound too wide reads exactly like a drill that passes (v4.05). */
const SHEET_AT = HTML.indexOf("function PromptSheet({p, me,");
const SHEET = (() => {
  assert.ok(SHEET_AT > 0, "the shared sheet is still declared where the census looks");
  const rest = HTML.slice(SHEET_AT);
  const end = rest.search(/\n\}\n/);
  assert.ok(end > 0, "the component closes at column 0");
  return rest.slice(0, end);
})();

/* every region the sheet guards on a tag, in source order */
const GUARD = /\{p\.tag===\"([a-z]+)\"/g;
const PACT_AT = SHEET.indexOf('<div className="pact">');
const REGIONS = (() => {
  assert.ok(PACT_AT > 0, "the shared action row is still there");
  const marks = [];
  let m; GUARD.lastIndex = 0;
  while((m = GUARD.exec(SHEET))) marks.push({tag: m[1], at: m.index});
  const out = [];
  for(let i = 0; i < marks.length; i++){
    /* THE NEXT SIBLING GUARD, or the action row — whichever comes first. A
       region therefore cannot reach into its neighbour, which is what stops
       the `pay` sheet's own Decline being counted as the modal's. */
    const nxt = i + 1 < marks.length ? marks[i+1].at : SHEET.length;
    const stop = marks[i].at < PACT_AT ? Math.min(nxt, PACT_AT) : nxt;
    out.push({tag: marks[i].tag, body: SHEET.slice(marks[i].at, stop)});
  }
  return out;
})();
const PACT = SHEET.slice(PACT_AT);

/* the modal row is reached through its ENCLOSING guard rather than a guard
   of its own, so a control inside it belongs to that region */
function tagBlock(tag){
  return REGIONS.filter(r => r.tag === tag).map(r => r.body).join("\n");
}

/* every control that can send a DECLINE for this tag — EITHER verb, because
   the `pay` sheet reaches `promptChoose(p,"decline")` directly while `pick`,
   `alloc` and now `modal` go through `promptDecline`, and both end in the
   same place. A census that knew only one route would report the `pay`
   sheet as having no way out. */
function declineControls(tag){
  const hay = tagBlock(tag);
  return (hay.match(/onClick=\{go\(onDecline\)/g) || []).length
       + (hay.match(/onClick=\{go\(\(\)=>onPick\("decline"\)\)/g) || []).length;
}

/* ============================================================
   1. THE PREMISE — WHO PRINTS AN OPTIONAL MODAL
   ============================================================ */
const skip = !H.hasDb() && "no cached card database";

test("the pool's optional-modal family is FOUR records over TWO cards, all full",
     {skip}, () => {
  /* DRIVEN OFF THE REAL PARSE, never a text scan: `fx.millCost` is
     `millCostSpec`'s only feeder, and `millCostSpec` is the only builder in
     the engine that sets `optional: true`. So this is the whole set of pool
     records whose printed "you may" reached a sheet with no way out. */
  const recs = JSON.parse(read("data/pool.json"));
  const pool = recs.cards || recs;
  const hits = [];
  for(const r of pool){
    const m = C.mapDbCard(r);
    const card = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
                  tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    P.fxReset();
    const fx = P.fxParse(card);
    P.fxReset();
    if(fx.millCost) hits.push({k: m.n + "|" + m.p, tier: fx.tier});
  }
  assert.equal(hits.length, 4, "four records: " + hits.map(h => h.k).join(", "));
  assert.deepEqual([...new Set(hits.map(h => h.k.split("|")[0]))].sort(),
                   ["Jittery Bones", "Washed Up Wave"]);
  /* COVERAGE IS BLIND, AND THIS IS WHY. The clause IS consumed, so every
     one reads `full` and the audit counts the text accounted for; and a
     player who cannot decline is WEAKER than printed, which is the
     direction the one-sided fairness sweep is built not to look in. */
  assert.deepEqual([...new Set(hits.map(h => h.tier))], ["full"]);
  /* AND `millCostSpec` IS THE ONE BUILDER THAT SETS THE FIELD, so the
     count above is the whole family rather than one reader's share. */
  const EFX = read("engine/effects.js");
  assert.equal((EFX.match(/optional: true/g) || []).length, 1,
    "one spec builder sets `optional` — a second means this census is partial");
});

/* ============================================================
   2. WHICH ANSWERS THE MODULE ACCEPTS — DRIVEN
   ============================================================ */
const card = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 1, power: 3, def: 2, tt: "Generic Action", ty: ["Generic", "Action"], tx: ""});
/* THE DECK IS STOCKED, because `opt` reads it off the GAME rather than
   from the spec — handed an empty one `buildPrompt` returns null and the
   variant silently drops out of the census, which is exactly a census
   losing a row (v3.81, v4.07, v4.58). Found by asking for the variant to
   be PRESENT rather than only reading the ones that turned up. */
const g0 = {sides: [{hand: [], deck: [card("D1", 91), card("D2", 92)],
                     grave: [], board: [], gear: [], res: 3}, {}], turn: 1};

/* one real prompt per variant, built by `buildPrompt` so no fixture can
   claim a shape the module does not produce (v2.80) */
function variants(){
  const cards = [card("A", 1), card("B", 2)];
  return {
    opt:    PM.buildPrompt(g0, {tag: "opt", side: 0, src: "S", cards, n: 2}),
    pick:   PM.buildPrompt(g0, {tag: "pick", side: 0, src: "S", cards, min: 0, max: 1}),
    pickM:  PM.buildPrompt(g0, {tag: "pick", side: 0, src: "S", cards, min: 1, max: 1}),
    modal:  PM.buildPrompt(g0, {tag: "modal", side: 0, src: "S", optional: true,
              options: [{label: "A", ops: []}, {label: "B", ops: []}]}),
    modalM: PM.buildPrompt(g0, {tag: "modal", side: 0, src: "S",
              options: [{label: "A", ops: []}, {label: "B", ops: []}]}),
    pay:    PM.buildPrompt(g0, {tag: "pay", side: 0, src: "S", cost: 1, ops: []}),
    reveal: PM.buildPrompt(g0, {tag: "reveal", side: 0, src: "S", cards}),
    target: PM.buildPrompt(g0, {tag: "target", side: 0, src: "S", cards}),
    alloc:  PM.buildPrompt(g0, {tag: "alloc", side: 0, src: "S", cards, n: 2}),
    /* A SOAK CARRIES ITS BARRIERS as options; with none there is nothing to
       ask, so the fixture supplies one rather than letting the variant fall
       out of the count. */
    soak:   PM.buildPrompt(g0, {tag: "soak", side: 0, src: "S", amount: 2,
              options: [{uid: 7, name: "Iron", cost: 1, amount: 1}]})
  };
}

test("every variant this census names is one `buildPrompt` really builds", () => {
  const v = variants();
  for(const k of Object.keys(v)){
    assert.ok(v[k], k + " builds");
    assert.equal(v[k].tag, k.replace(/M$/, ""), k + " carries its own tag");
  }
  /* THE VARIANT LIST IS TOTAL OVER THE MODULE'S OWN VOCABULARY, so a ninth
     tag cannot be added without this census being told (v3.35's
     `PENDING_KINDS`, one module over). */
  const PJ = read("engine/prompts.js");
  const tags = [...new Set([...PJ.matchAll(/spec\.tag === "([a-z]+)"/g)].map(m => m[1]))].sort();
  assert.deepEqual(tags, ["alloc", "modal", "opt", "pay", "pick", "reveal", "soak", "target"],
    "the eight variants `buildPrompt` knows: " + tags.join(", "));
});

test("`promptDecline` changes exactly four shapes, and the sheet must match", () => {
  const v = variants();
  /* THE FIXTURE HAS TO BE ABLE TO EXPRESS THE ANSWER (v3.62). `promptDecline`
     for a `pick` and an `alloc` CLEARS the selection, so on a sheet with
     nothing selected it is textually a no-op and the first draft of this
     drill reported both as refusing a decline — a fixture that cannot tell
     acceptance from refusal. Each shape is offered a SELECTION first, and
     the ones that carry none are answered as they stand. */
  const seeded = {};
  for(const k of Object.keys(v)){
    assert.ok(v[k], k + " is present");
    seeded[k] = (v[k].tag === "pick" || v[k].tag === "alloc")
      ? PM.promptToggleSel(v[k], 0) : v[k];
  }
  assert.equal(seeded.pick.sel.length, 1, "the pick fixture really has a card chosen");
  assert.equal(seeded.alloc.sel.length, 1, "and the alloc fixture a counter placed");
  const changed = {};
  for(const k of Object.keys(seeded))
    changed[k] = JSON.stringify(PM.promptDecline(seeded[k])) !== JSON.stringify(seeded[k]);
  /* PINNED BOTH DIRECTIONS (v4.12, v4.17). Pinning the accepting shapes
     alone cannot see one LEAVING the set — and a shape that quietly stops
     accepting a decline is a printed "you may" made mandatory again. */
  assert.deepEqual(changed, {
    opt:    false,   /* a reorder has no decline — every order is an answer */
    pick:   true,    /* min 0: "Choose none" */
    pickM:  false,   /* min 1: the pick is mandatory */
    modal:  true,    /* optional: v3.90's, and v4.61's missing control */
    modalM: false,   /* a printed mode must be chosen */
    pay:    true,    /* the "unless they pay" branch */
    reveal: false,   /* information, with nothing to refuse */
    target: false,   /* CR 1.4.5 — declaring one is MANDATORY */
    alloc:  true,    /* "up to N" includes zero */
    soak:   false    /* multi-select; taking none is already a legal answer */
  });
});

test("a decline control exists for exactly the shapes that accept one", () => {
  /* THE PAIRING, which is the whole claim of this file. A tag the module
     lets you decline and the sheet does not is v4.61's defect; a tag the
     sheet offers and the module ignores is a DEAD CONTROL, which reads as
     a broken screen rather than as a rule (v2.83). */
  assert.equal(declineControls("modal"), 1, "the optional modal has its Decline (v4.61)");
  assert.equal(declineControls("pick"),  1, "`pick`'s Choose none");
  assert.equal(declineControls("pay"),   1, "the pay sheet's own Decline");
  assert.equal(declineControls("alloc"), 1, "`alloc`'s Clear");
  for(const t of ["opt", "reveal", "target", "soak"])
    assert.equal(declineControls(t), 0, t + " accepts no decline, so it must offer none");
});

test("the modal's control is gated on `optional` and goes through `promptDecline`", () => {
  const blk = tagBlock("modal");
  assert.ok(blk.length > 0 && blk.length < 2200,
    "the modal block is bounded: " + blk.length + " chars");
  /* THE WHOLE CONDITIONAL, opening brace included — a scan for the bare
     call passes `if(… && false)` perfectly (v4.00, v4.55). */
  assert.match(blk, /\{p\.optional &&\s*\n\s*<button className=\{"popt"\+\(p\.choice==="decline"\?" on":""\)\} onClick=\{go\(onDecline\)\}>/,
    "guarded on p.optional, wired to onDecline");
  /* NEVER `onPick("decline")`: `promptDecline` is the only route that
     carries the `optional` gate, so a mandatory modal stays mandatory even
     if this guard is ever widened. */
  assert.doesNotMatch(blk, /onPick\("decline"\)/,
    "the modal's decline does not bypass promptDecline's gate");
  /* AND IT IS THE SHEET BOTH BOARDS RENDER — one body, or this fix lands
     on one board (v4.44). */
  assert.equal((HTML.match(/function PromptSheet\(/g) || []).length, 1);
  assert.equal((HTML.match(/<PromptSheet\b/g) || []).length, 2,
    "the trainer and the table both render it");
  /* both pass onDecline, or the control is inert on one of them */
  assert.equal((HTML.match(/onDecline=\{/g) || []).length, 2);
});

test("`promptTakeBack` is the other optional control, and it has one too", () => {
  /* FIX THE FAMILY, NOT THE MEMBER YOU FOUND (v4.21). A decline is one of
     two optional answers the module carries; the undo is the other, and it
     exists for exactly one variant because an `alloc`'s selection is a
     MULTISET and `promptSel` is therefore not its own inverse (v4.44). */
  const v = variants();
  const changed = {};
  for(const k of Object.keys(v)){
    const seeded = (v[k].tag === "pick" || v[k].tag === "alloc")
      ? PM.promptToggleSel(v[k], 0) : v[k];
    changed[k] = JSON.stringify(PM.promptTakeBack(seeded)) !== JSON.stringify(seeded);
  }
  assert.deepEqual(changed, {opt: false, pick: false, pickM: false, modal: false,
    modalM: false, pay: false, reveal: false, target: false, alloc: true, soak: false});
  const hasTakeBack = t =>
    (tagBlock(t).match(/onClick=\{go\(onTakeBack\)/g) || []).length;
  assert.equal(hasTakeBack("alloc"), 1, "`alloc` has its Take back");
  for(const t of ["opt", "pick", "modal", "pay", "reveal", "target", "soak"])
    assert.equal(hasTakeBack(t), 0, t + " has nothing to undo, so it offers nothing");
  /* AND THE REACH OF THIS CENSUS IS STATED: it covers the two OPTIONAL
     answers — the decline and the undo — because those are the ones a sheet
     can silently fail to offer while every other layer works. `promptSel`
     and `promptConfirm` are the sheet's whole reason to exist and a missing
     control for either is a blank screen rather than a quiet defect. */
  assert.ok((PACT.match(/onClick=\{go\(onConfirm\)/g) || []).length >= 1,
    "Confirm is there, which is the control nothing could hide");
});

test("the comment stripper this census depends on really strips", () => {
  /* THE CONTROL GOES THROUGH THE SCAN, NOT BESIDE IT (v4.32). Written as a
     literal the fixture would be a comment in THIS file, so it is built by
     concatenation — and it carries the apostrophe that broke two earlier
     bounds, because a control without one cannot express the fault it
     exists for (v3.62). */
  const open = "/" + "*", close = "*" + "/";
  const junk = open + " Gravy Bones' list { and a stray brace " + close;
  assert.equal(codeOf("a" + junk + "b"), "a b", "a block comment is replaced by a space");
  assert.ok(codeOf("x" + junk).indexOf("Bones'") < 0, "its apostrophe is gone with it");
  assert.ok(codeOf("  /" + "/ a line comment with an apostrophe's brace {").indexOf("{") < 0,
    "and a line comment goes too");
  /* AND THE SCAN IS PROVED ALIVE, or "it found nothing" cannot be told from
     "there is nothing to find" (v3.81, v4.00). */
  assert.ok(SHEET.indexOf('className="pmodal"') > 0, "the scan can see the sheet it reads");
  assert.ok(codeOf(read("index.html")).length < read("index.html").length,
    "stripping index.html really removes something");
});

test("the sheet slice this census reads is bounded and carries no regex literal", () => {
  /* WIDTH IS THE ONLY THING A SCAN CAN CHECK WITHOUT KNOWING INTENT
     (v4.57), so it is pinned as data: a slice that grows has started
     reading its neighbours. */
  assert.ok(SHEET.length > 3600 && SHEET.length < 5600,
    "PromptSheet slice is " + SHEET.length + " chars");
  assert.ok(PACT.length > 300 && PACT.length < 1400,
    "the action row is " + PACT.length + " chars");
  /* AND EVERY TAG'S REGION IS BOUNDED BY ITS SIBLING. The widths are data
     so one growing — or one starting to read its neighbour's controls —
     is a deliberate edit (v4.57). */
  const widths = {};
  for(const t of ["opt", "pick", "modal", "pay", "reveal", "target", "alloc", "soak"])
    widths[t] = tagBlock(t).length;
  for(const t of Object.keys(widths))
    assert.ok(widths[t] < 1900, t + "'s region is " + widths[t] + " chars");
  /* THE BRACE WALK IS QUOTE-AWARE AND NOT REGEX-AWARE, and that is a
     stated limit rather than a hidden one — `html-balance.test.js` keeps
     the same ledger for the same reason. */
  /* THE SCAN'S REACH IS STATED (v4.44, v4.50, v4.57). It reads the PRESENCE
     of a control and its guard, and it cannot tell a live render from a
     dead one — `if(false && <button …>)` keeps the text intact (v4.00). So
     the acceptance half of every claim above is DRIVEN through the module,
     and the source is read only for the thing no Node process can load. */
  assert.ok(SHEET.indexOf("if(false") < 0 && SHEET.indexOf("&& false") < 0,
    "the one shape this scan is blind to is refused by name");
});

/* ============================================================
   3. `promptChoose` VALIDATES ITS ANSWER (v4.61)
   ============================================================ */
test("a MANDATORY modal cannot be declined, however the answer arrives", () => {
  /* LATENT AND MEASURED: no pool record builds a mandatory modal — the one
     builder sets `optional: true` — so this is synthetic on purpose
     (v3.73). `reduce` is fed by JSON off a wire (v2.04), and
     `judge.reduce`'s `promptChoose` case forwards `a.choice` unread, so
     `promptChoose` is where the word has to be refused. */
  const v = variants();
  assert.equal(PM.promptChoose(v.modalM, "decline").choice, null,
    "a printed mode must be chosen");
  assert.equal(PM.promptChoose(v.modal, "decline").choice, "decline",
    "and the optional one still declines — the positive control");
  /* WHICH LAYER CARRIES THE RULE IS PINNED, because two guards state it and
     only one can be observed. `promptDecline` has gated its own modal branch
     on `optional` since v3.90 and `promptChoose` now refuses the word — so
     sabotaging the UPPER gate is CORRECTLY SILENT, the lower one having
     already refused. v4.52's lesson with the layers swapped (there a drill
     asked the gate instead of the reader), and v4.44's `optional` from the
     other side: a redundancy that cannot be observed is recorded rather than
     deleted, because `promptDecline`'s contract is its own and making it
     depend on `promptChoose`'s validation for correctness is a coupling.
     The day the lower gate moves, this is the assertion that says where. */
  assert.equal(PM.promptDecline(v.modalM).choice, null,
    "promptDecline refuses it too — through promptChoose, which is the gate A4 proves");
  /* THROUGH THE REDUCER, which is the surface a wire reaches (v3.20). */
  const g = {...g0, prompt: v.modalM, actor: 0, turnPlayer: 0,
             phase: "action", step: "layer", priority: 0, sides: g0.sides};
  const out = J.reduce(g, {t: "promptChoose", choice: "decline"}, 0);
  const st = out.state || g;
  assert.equal(st.prompt.choice, null, "the reducer refuses it too");
  assert.equal(PM.promptReady(st.prompt), false, "so Confirm stays dark");
});

test("an out-of-range mode or target index is refused, not resolved", () => {
  const v = variants();
  /* A mode index past the end left `options[i]` undefined, so the sheet
     resolved saying "Mode chosen: undefined" and ran NO ops — a play paid
     for that does nothing, which is v4.49's rule inverted. */
  for(const bad of [2, 99, -1, "x", null, true, "", 1.5])
    assert.equal(PM.promptChoose(v.modal, bad).choice, null,
      "modal refuses " + JSON.stringify(bad));
  /* CR 1.4.5 makes declaring an attack-target MANDATORY, so an index past
     the candidates is a swing at no target at all. */
  for(const bad of [2, 99, -1, "x", null, true, "", 1.5])
    assert.equal(PM.promptChoose(v.target, bad).choice, null,
      "target refuses " + JSON.stringify(bad));
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.98) — a validator that
     refuses everything passes every row above perfectly. */
  assert.equal(PM.promptChoose(v.modal, 1).choice, 1);
  assert.equal(PM.promptChoose(v.modal, "1").choice, 1, "a numeric string off a wire is an index");
  assert.equal(PM.promptChoose(v.target, 0).choice, 0);
});

test("the pay sheet's vocabulary is the two words it prints", () => {
  const v = variants();
  assert.equal(PM.promptChoose(v.pay, "pay").choice, "pay");
  assert.equal(PM.promptChoose(v.pay, "decline").choice, "decline");
  for(const bad of [0, 1, "PAY", "yes", null, true])
    assert.equal(PM.promptChoose(v.pay, bad).choice, null,
      "pay refuses " + JSON.stringify(bad));
  /* AFFORDABILITY IS NOT CHECKED HERE, deliberately: `applyAnswer` pitches
     on demand (RULING 2026-08-01), so a seat holding nothing floating may
     still legally answer "pay" — refusing it here would deny a payment the
     rules allow. What is refused is a word the sheet could not produce. */
  const poor = PM.buildPrompt({sides: [{res: 0, hand: []}, {}], turn: 1},
                              {tag: "pay", side: 0, src: "S", cost: 3, ops: []});
  assert.equal(poor.avail, 0);
  assert.equal(PM.promptChoose(poor, "pay").choice, "pay");
});

test("refusing an answer never mutates the prompt it was given", () => {
  /* `reduce`'s contract is that it never mutates on refusal
     (`fuzz.test.js`), and this is the function the refusal happens in. */
  const v = variants();
  const before = JSON.stringify(v.modalM);
  PM.promptChoose(v.modalM, "decline");
  PM.promptChoose(v.modalM, 99);
  assert.equal(JSON.stringify(v.modalM), before);
});

/* ============================================================
   4. THE LIVE CARD, DRIVEN
   ============================================================ */
test("Jittery Bones' printed 'you may' can be refused, and then costs nothing",
     {skip}, () => {
  H.db(); P.fxReset();
  const jb = Object.assign({}, H.card("Jittery Bones", 3), {uid: 1001});
  const top = Object.assign({}, H.card("Barnacle", 0), {uid: 1010});
  const spare = Object.assign({}, H.card("Wounding Blow", 1), {uid: 1011});
  const g = H.state({hand: [jb, spare], res: 9, ap: 1, deck: [top]},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, jb, "hand", 0, {})}));
  let n = J.openPrompt(out.game || out) || (out.game || out);
  assert.ok(n.prompt && n.prompt.tag === "modal", "the sheet opens as a modal");
  assert.equal(n.prompt.optional, true, "and it is the optional one");
  const deckBefore = n.sides[0].deck.length, handBefore = n.sides[0].hand.length;
  n = J.reduce(n, {t: "promptDecline"}, n.prompt.side).state;
  assert.equal(n.prompt.choice, "decline");
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  /* ASSERT ON HANDS, DECKS AND ZONES — never on the feed (v2.45). */
  assert.equal(n.sides[0].deck.length, deckBefore, "the deck is not milled");
  assert.equal(n.sides[0].hand.length, handBefore, "and no card is discarded");
  assert.ok(!(n.pend && n.pend.ga), "so the watery-grave rider does not resolve");
});
