/* ============================================================
   GLISTEN — AN ALLOCATOR, AND THE LAST DECK CARD AT `none` (v4.44)

     "Distribute up to four +1{p} counters among any number of weapons
      you control. At the beginning of your end phase, remove all +1{p}
      counters from weapons you control."      — SBL, Boltyn's list, x2

   THE ONE RECORD IN `tools/approx.js`'s STANDING LIST WHOSE BLOCKER WAS
   NAMED CORRECTLY. Every other departure from `unbuilt-*` corrected its
   own stated reason by asking the engine (v3.69's rule, discharged at
   v4.38, v4.41 and v4.43); this one needed exactly what the note said —
   an ALLOCATOR. `prompts.js` had five variants and not one apportions:
   `pick` chooses a SET, and a set cannot say "two of these on that one".

   SO `alloc`'s SELECTION IS A MULTISET, which is the whole shape. Every
   other sheet's `sel` is a set of indices and `promptToggleSel` is its own
   inverse; here a second tap places a second counter, so the undo has to
   be its OWN operation (`promptTakeBack`) and — at the table, where the
   sheet lives in the sequenced state — its own ACTION.

   AND THE NUMBER IS READ OFF THE PRINTED WORD, WHICH THE POOL PROVES.
   Glisten prints four / three / two across its three pitches, so no
   synthetic is needed to tell a read number from a hardcoded one — the
   second time the pool has settled that on its own (v3.89's Shred).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const PR = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const EF = require("../engine/effects.js");
const C  = require("../engine/cards.js");
const W  = require("../engine/wire.js");
const H  = require("./helpers/judged.js");
const fs = require("fs");
const path = require("path");

const POOL = path.join(__dirname, "..", "data", "pool.json");
let _pool = null;
const pool = () => _pool || (_pool = JSON.parse(fs.readFileSync(POOL, "utf8"))
  .filter(c => c && c.name).map(C.mapDbCard)
  .map(m => ({name:m.n, pitch:m.p, cost:m.c, power:m.pw, def:m.d,
              tt:m.tt, ty:m.ty, tx:m.tx, kw:m.kw, gkw:m.gkw})));
const byName = nm => pool().filter(c => c.name === nm);

const ops = c => PR.fxParse(c).ops || [];
const opOf = (c, k) => (ops(c).find(o => o[0] === k) || [])[1];

/* A synthetic weapon, because a driven board needs two of them and the
   pool's own pairs are hero-specific (v3.73). `ty` carries Weapon, which
   is the authority for a TYPE (v2.39). */
const wpn = (n, name) => ({uid: 900 + n, name: name || ("Blade " + n),
  tt: "Warrior Weapon - Sword", ty: ["Warrior", "Weapon"], power: n,
  def: null, cost: null, tx: "Once per Turn Action - {r}: Attack"});
const HELM = {uid: 950, name: "Helm", tt: "Generic Equipment - Head",
  ty: ["Generic", "Equipment"], def: 2, cost: null, tx: ""};

/* ---- the parse -------------------------------------------------------- */

test("all three printings read, and the AMOUNT comes off the printed word", () => {
  const rows = byName("Glisten");
  assert.equal(rows.length, 3, "the pool no longer holds three Glistens");
  const got = {};
  for(const c of rows){
    assert.equal(PR.fxParse(c).tier, "full",
      "Glisten p" + c.pitch + " stopped resolving — it was the pool's LAST deck card "
      + "at `none` and `tools/approx.js`'s probe is turned round on that");
    got[c.pitch] = opOf(c, "ctrPut").n;
  }
  /* THE POOL PROVES THE READ (v3.89's Shred, second time). A hardcoded 4
     passes against the red face alone; these three disagree, so a drill
     over all of them cannot pass against a literal. */
  assert.deepEqual(got, {1: 4, 2: 3, 3: 2},
    "the distributed AMOUNT is not being read off the printed word");
});

test("the subject is a TYPE, and both ops carry the same one", () => {
  const c = byName("Glisten").find(x => x.pitch === 1);
  const put = opOf(c, "ctrPut"), end = opOf(c, "ctrEnd");
  /* `ty` IS THE AUTHORITY FOR A TYPE AND `tt` FOR A SUBTYPE (v2.39). The
     pool's two readings agree on every record today — measured below —
     and the structured array is right the day `type_text` carries a stray
     word, which it already does on five database records. */
  assert.deepEqual(put.filter, {ty: "weapon"});
  assert.deepEqual(end.filter, {ty: "weapon"});
  assert.equal(put.kind, "pow", "a `+1{p}` counter is the printed spelling of `pow` (v3.55)");
  assert.equal(end.kind, "pow");
  assert.equal(put.spread, true, "the distribution lost its spread flag — it would open a "
    + "`pick`, which concentrates every counter on ONE weapon and deletes a printed line");
});

test("the two weapon readings agree across the pool, so `ty` costs nothing today", () => {
  const byTy = pool().filter(PM.promptFilter({ty: "weapon"}));
  const byTt = pool().filter(PM.promptFilter({tt: "weapon"}));
  assert.ok(byTy.length > 10, "only " + byTy.length + " weapons — the filter is aimed wrong");
  assert.deepEqual(byTy.map(c => c.name + "|" + c.pitch).sort(),
                   byTt.map(c => c.name + "|" + c.pitch).sort(),
    "the TYPE and the TYPE-LINE readings of `weapon` have diverged in the pool. `ty` is "
    + "the authority (v2.39) — this drill exists so the day they part is a decision");
});

test("an UNRESTRICTED subject refuses, in all three counter readers", () => {
  /* A BARE "card" GIVES `pickSubject` AN EMPTY FILTER, and an empty filter
     over the board AND the gear claims EVERY permanent its controller
     holds. Measured: no pool record needs an unrestricted counter target,
     so refusing costs nothing and admitting it is v3.53's sev-3 —
     "an unknown key that falls through ADMITS EVERY CARD". */
  assert.equal(PR.classifyClause(
    "distribute up to four +1{p} counters among any number of cards you control"), null);
  assert.equal(PR.classifyClause(
    "at the beginning of your end phase, remove all +1{p} counters from cards you control"), null);
  /* FIX THE FAMILY, NOT THE TWO MEMBERS YOU FOUND (v4.21). The existing
     single-target reader shares the one `ctrSubject` body, so it refuses
     the same phrase — and still reads the printed subjects it always did,
     which is the half that says the guard did not widen into a break. */
  assert.equal(PR.classifyClause("put a +1{p} counter on a card you control"), null);
  const ok = PR.classifyClause("put a +1{p} counter on target sword you control");
  assert.ok(ok && ok.ops && ok.ops[0][0] === "ctrPut",
    "the pre-existing single-target reader stopped reading its own printed subject");
});

test("the counter KIND vocabulary stays closed", () => {
  /* A COUNTER KIND WITH NO READER IS A NO-OP WEARING A NUMBER (v3.55), so
     both new readers test `CTR_KINDS` in the GUARD rather than in the body
     — a kind nobody consumes must fall through to the other matchers
     rather than killing the clause (v3.57). */
  assert.equal(PR.classifyClause(
    "distribute up to four glimmer counters among any number of weapons you control"), null);
  assert.equal(PR.classifyClause(
    "at the beginning of your end phase, remove all glimmer counters from weapons you control"),
    null);
});

test("the pool census — one claimant each, pinned as a SET", () => {
  const spread = [], wipe = [];
  for(const c of pool()){
    for(const o of ops(c)){
      if(o[0] === "ctrPut" && o[1] && o[1].spread && !spread.includes(c.name)) spread.push(c.name);
      if(o[0] === "ctrEnd" && !wipe.includes(c.name)) wipe.push(c.name);
    }
  }
  assert.deepEqual(spread.sort(), ["Glisten"],
    "a second card distributes counters — check the allocator's policy still suits it, "
    + "because `autoAnswer` takes the MAXIMUM on the strength of a measurement about "
    + "`+1{p}` counters specifically");
  assert.deepEqual(wipe.sort(), ["Glisten"],
    "a second card arms a side-level end-phase counter wipe — the step accumulates, so "
    + "two are two printed sentences, but say so deliberately");
  /* THE SINGLE-TARGET FAMILY IS UNMOVED — the blast radius measured in
     BOTH directions (v3.33), because a widened subject reader that
     silently claimed these would read `full` either way. */
  const single = [];
  for(const c of pool())
    for(const o of ops(c))
      if(o[0] === "ctrPut" && o[1] && !o[1].spread && !single.includes(c.name)) single.push(c.name);
  /* MEASURED, NOT REMEMBERED (v4.09). The first draft of this pin named
     Uphold Tradition and it is NOT in the set: its put sits inside a
     cloaked INSTANT ability, so it is read off the powCard rather than the
     card's own `fx.ops`. The third member is Re-Charge!, whose counter is
     a STEAM one — which is what says this family is about the OP and not
     about `+1{p}`. */
  assert.deepEqual(single.sort(),
    ["Astral Etchings", "Edict of Steel", "Re-Charge!"],
    "the pre-existing single-target `ctrPut` set moved");
});

test("no pool card SPENDS a +1{p} counter — which is why the policy takes them all", () => {
  /* THE MEASUREMENT `autoAnswer`'s alloc case RESTS ON. v4.24's standing
     rule is to DECLINE a price the policy cannot weigh; an allocation has
     no price, so v4.23's reprieve governs instead and declining is
     strictly dominated. That is only true while nothing spends the
     counter, so the premise is a drill rather than a sentence. */
  const readers = [], spenders = [];
  for(const c of pool()){
    if(!/\+1\{p\} counter/i.test(String(c.tx || ""))) continue;
    if(!readers.includes(c.name)) readers.push(c.name);
    /* A COST spells a payment. A SCHEDULE spells a removal at a moment. */
    if(/(?:^|[^a-z])(?:spend|pay)[^.]*\+1\{p\} counter/i.test(c.tx)
       && !spenders.includes(c.name)) spenders.push(c.name);
  }
  assert.equal(readers.length, 9,
    "the set of cards reading a +1{p} counter moved — re-measure before trusting "
    + "the allocator's take-them-all policy");
  assert.deepEqual(spenders, [],
    "a pool card now SPENDS a +1{p} counter, so placing the maximum is no longer "
    + "free and `judge.autoAnswer`'s alloc case has to be re-argued");
});

/* ---- the sheet -------------------------------------------------------- */

const sheet = (n, cards) => {
  const g = H.state({gear: cards}, {});
  return PM.buildPrompt(g, {tag: "alloc", side: 0, src: "Glisten", cards,
    n, ctrStamp: {kind: "pow", label: "+1{p}"}});
};

test("the selection is a MULTISET — a second tap is a second counter", () => {
  const cards = [wpn(1), wpn(3)];
  let p = sheet(4, cards);
  assert.equal(p.tag, "alloc");
  assert.equal(p.min, 0, '"up to four" permits zero');
  assert.equal(p.max, 4);
  for(const i of [0, 0, 1]) p = PM.promptToggleSel(p, i);
  assert.deepEqual(p.sel, [0, 0, 1],
    "the second tap on one permanent removed the first — that is a `pick`'s toggle, and "
    + "it makes 'distribute' unable to put two counters anywhere");
  const out = PM.applyPrompt(H.state({gear: cards}, {}), p);
  assert.deepEqual(out.alloc.map(x => [x.card.name, x.put]), [["Blade 1", 2], ["Blade 3", 1]]);
});

test("the budget is the printed one and the sheet caps it", () => {
  let p = sheet(2, [wpn(1), wpn(3)]);
  for(const i of [0, 1, 0, 1]) p = PM.promptToggleSel(p, i);
  assert.equal(p.sel.length, 2, "the sheet placed more counters than the card grants");
  assert.deepEqual(p.sel, [0, 1]);
});

test("`promptTakeBack` is the undo, and it is `alloc`-only", () => {
  let p = sheet(4, [wpn(1), wpn(3)]);
  for(const i of [0, 0, 1]) p = PM.promptToggleSel(p, i);
  assert.deepEqual(PM.promptTakeBack(p).sel, [0, 0], "the undo pops the LAST placement");
  /* IT MUST NOT REACH ANOTHER TAG. Every other sheet's toggle is its own
     inverse, so a take-back there would silently unpick a chosen card with
     no control ever having been offered for it. */
  const pick = PM.buildPrompt(H.state({hand: [wpn(1), wpn(3)]}, {}),
    {tag: "pick", side: 0, src: "x", zone: "hand", min: 1, max: 2});
  const sel = PM.promptToggleSel(pick, 0);
  assert.deepEqual(PM.promptTakeBack(sel).sel, sel.sel, "take-back reached a `pick`");
  assert.deepEqual(PM.promptTakeBack(null), null);
});

test("driven — the table's undo goes through `reduce`", () => {
  /* DRIVE THE REAL ENTRY POINT, OR PIN NOTHING (v3.20). Asking
     `promptTakeBack` directly proves the READER; a `promptTakeBack` case
     that returns the prompt untouched passes that perfectly while the
     button does nothing on the board where the sheet is sequenced state. */
  const gl = glisten(1);
  let n = H.J.reduce(seatWith([wpn(1), wpn(3)], [gl]),
    {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  for(const i of [0, 0, 1]) n = H.J.reduce(n, {t: "promptSel", i}, 0).state;
  assert.deepEqual(n.prompt.sel, [0, 0, 1]);
  n = H.J.reduce(n, {t: "promptTakeBack"}, 0).state;
  assert.deepEqual(n.prompt.sel, [0, 0], "the reducer's take-back changed nothing");
  n = H.J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.deepEqual(n.sides[0].counters, {901: {pow: 2}},
    "the undo did not reach the placement");
});

test("placing NOTHING is an answer, not a decline", () => {
  const cards = [wpn(1), wpn(3)];
  const p = sheet(4, cards);
  /* "UP TO FOUR" INCLUDES ZERO, so the sheet is answerable the moment it
     opens and confirming with nothing placed is a complete answer —
     v2.04's split read from the other end: a DECLINED optional cost runs
     no rider, and this is not a cost at all. */
  assert.equal(PM.promptReady(p), true, "a fresh allocation is not answerable");
  const out = PM.applyPrompt(H.state({gear: cards}, {}), p);
  assert.equal(out.alloc, undefined, "a zero allocation still reported placements");
  assert.deepEqual(out.ops || [], []);
  assert.deepEqual(out.pay || 0, 0);
  assert.ok(out.msgs.some(m => /placed no counters/.test(m)),
    "nothing in the feed said the player placed none — in a training sim the sequence "
    + "IS the lesson (v3.60)");
  /* AND DECLINING CLEARS RATHER THAN ENDING, because there is nothing to
     decline: the sheet has no cost and no minimum. */
  let q = PM.promptToggleSel(p, 0);
  assert.deepEqual(PM.promptDecline(q).sel, []);
});

test("`applyPrompt` reports the allocation as DATA and writes no counters", () => {
  const cards = [wpn(1), wpn(3)];
  let p = sheet(4, cards);
  for(const i of [1, 1, 1, 1]) p = PM.promptToggleSel(p, i);
  const g = H.state({gear: cards}, {});
  const out = PM.applyPrompt(g, p);
  /* prompts.js RUNS NO EFFECTS AND TOUCHES NO STATE — its founding
     property, and what keeps an unpaid optional cost from firing its
     payload (v2.04). `applyAnswer` is what writes the counters. */
  assert.deepEqual(out.alloc.map(x => [x.card.name, x.put]), [["Blade 3", 4]]);
  assert.deepEqual(out.game.sides[0].counters || {}, {},
    "prompts.js wrote a counter — it runs no effects by contract");
});

test("an empty candidate pool opens no sheet", () => {
  assert.equal(sheet(4, []), null);
  /* AND A NON-WEAPON IS NOT A CANDIDATE, so the pool the sheet filters is
     the same both-zones scan `ctrPut` builds (v3.55, v3.33). */
  const g = H.state({gear: [HELM]}, {});
  assert.equal(PM.buildPrompt(g, {tag: "alloc", side: 0, src: "Glisten",
    zone: "gear", n: 4, filter: {ty: "weapon"}}), null);
});

/* ---- driven, on judge ------------------------------------------------- */

const seatWith = (gear, hand) => {
  const g = H.state({gear, hand: hand || [], res: 3}, {});
  const n = {...g, phase: "action", step: "layer", priority: 0, turnPlayer: 0, actor: 0};
  n.sides[0].ap = 1;
  return n;
};
/* `resolveEntry` STAMPS NO UID (it is the loader's job, not the resolver's),
   so the fixture does — two copies with no uid are one card as far as
   `{t:"play", uid}` is concerned, and Boltyn decks TWO. */
let _gu = 700;
const glisten = pitch => Object.assign(
  C.resolveEntry(H.db(), {name: "Glisten", p: pitch, code: null, q: 1}), {uid: ++_gu});

test("driven — TWO weapons open the sheet and the split lands", () => {
  const cards = [wpn(1), wpn(3), HELM];
  const gl = glisten(1);
  let r = H.J.reduce(seatWith(cards, [gl]), {t: "play", uid: gl.uid, from: "hand"}, 0);
  assert.ok(!r.error, r.error);
  let n = r.state;
  assert.ok(n.prompt, "no sheet opened — the whole route has no caller (v3.50)");
  assert.equal(n.prompt.tag, "alloc");
  assert.deepEqual(n.prompt.cards.map(c => c.name), ["Blade 1", "Blade 3"],
    "the HELM was offered a +1{p} counter — the printed subject is weapons");
  const at = nm => n.prompt.cards.findIndex(c => c.name === nm);
  for(const nm of ["Blade 3", "Blade 3", "Blade 1", "Blade 1"])
    n = H.J.reduce(n, {t: "promptSel", i: at(nm)}, 0).state;
  n = H.J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.deepEqual(n.sides[0].counters, {901: {pow: 2}, 903: {pow: 2}},
    "the distribution did not reach the board — `applyAnswer` is what writes it");
  assert.equal(n.prompt, null);
});

test("driven — a SECOND Glisten stacks on the first, and arms a second wipe", () => {
  /* THE HALF THE OTHER DRIVEN FIXTURES COULD NOT EXPRESS (v3.62). Each
     answer groups its multiset into one entry per permanent, so
     `applyAnswer` writes each card once — and with no counter already on
     the weapon, ASSIGNING and ACCUMULATING are the same number. Boltyn
     decks TWO Glistens, so the second is the reachable case.

     AND IT NEEDS TWO WEAPONS, which is the trap the first draft walked
     into: with one the `ctrPut` FAST PATH runs and `applyAnswer` is never
     reached at all, so the sabotage stayed silent against a drill that
     looked like it was about accumulation. Ask which half of the guard
     your fixture reaches.

     THE RECORD ACCUMULATES TOO: two printed sentences are two triggers,
     which is why the field is a list. */
  const a = glisten(3), b = glisten(3);
  assert.notEqual(a.uid, b.uid, "two copies must be two cards");
  const place = (st, nm, times) => {
    let n = st;
    for(let k = 0; k < times; k++)
      n = H.J.reduce(n, {t: "promptSel", i: n.prompt.cards.findIndex(c => c.name === nm)}, 0).state;
    return H.J.reduce(n, {t: "promptConfirm"}, 0).state;
  };
  let n = H.J.reduce(seatWith([wpn(1), wpn(3)], [a, b]),
    {t: "play", uid: a.uid, from: "hand"}, 0).state;
  assert.ok(n.prompt, "two weapons must open the sheet, or this drill tests the fast path");
  n = place(n, "Blade 3", 2);
  assert.deepEqual(n.sides[0].counters, {903: {pow: 2}});
  n = {...n, phase: "action", step: "layer", priority: 0, turnPlayer: 0, actor: 0};
  n.sides = n.sides.slice();
  n.sides[0] = {...n.sides[0], ap: 1, res: 3};
  const r = H.J.reduce(n, {t: "play", uid: b.uid, from: "hand"}, 0);
  assert.ok(!r.error, r.error);
  n = place(r.state, "Blade 3", 2);
  assert.deepEqual(n.sides[0].counters, {903: {pow: 4}},
    "the second distribution REPLACED the first's counters instead of adding to them");
  assert.equal((n.sides[0].ctrEnd || []).length, 2,
    "two printed sentences armed one trigger");
  const out = EF.beginEndPhase(n, 0);
  assert.deepEqual(out.game.sides[0].counters, {903: {pow: 0}});
});

test("driven — ONE weapon places them all and opens no sheet", () => {
  /* A FORCED DISTRIBUTION IS NOT A DECISION (v3.55: "with one legal target
     it just happens"), and it is the case BOLTYN ACTUALLY FACES — he is
     the only hero who decks Glisten and `defaultPicks` equips him one
     weapon. So the spread sits BELOW the single-candidate fast path. */
  const gl = glisten(3);
  const r = H.J.reduce(seatWith([wpn(4), HELM], [gl]), {t: "play", uid: gl.uid, from: "hand"}, 0);
  assert.ok(!r.error, r.error);
  assert.equal(r.state.prompt, null, "a sheet with one legal target teaches nothing");
  assert.deepEqual(r.state.sides[0].counters, {904: {pow: 2}},
    "the p3 printing distributed something other than its printed two");
});

test("driven — the wipe fires at the CONTROLLER's own end phase, once", () => {
  const gl = glisten(1);
  let n = H.J.reduce(seatWith([wpn(4)], [gl]), {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  assert.equal((n.sides[0].ctrEnd || []).length, 1, "the second sentence armed nothing");
  /* THE OPPONENT'S END PHASE IS NOT YOURS. Armed on the side and swept by
     seat, so a body that swept both would take the counters a turn early
     — half of what the card grants. */
  const foe = EF.beginEndPhase(n, 1);
  assert.deepEqual(foe.game.sides[0].counters, {904: {pow: 4}},
    "the opponent's end phase wiped your counters");
  assert.equal((foe.game.sides[0].ctrEnd || []).length, 1, "and it consumed the record");
  const mine = EF.beginEndPhase(n, 0);
  assert.deepEqual(mine.game.sides[0].counters, {904: {pow: 0}});
  /* AND THE RECORD IS CONSUMED. Left standing it wipes every end phase for
     the rest of the game — a one-turn drawback turned permanent, which is
     the trap the sharpen stamp's own clear names one step up (v3.66). */
  assert.deepEqual(mine.game.sides[0].ctrEnd, []);
  const again = EF.beginEndPhase(mine.game, 0);
  assert.ok(!again.msgs.some(m => /falls away|are wiped/.test(m)),
    "the wipe fired a second time — the record was not consumed");
});

test("driven — the wipe takes counters Glisten never placed", () => {
  /* THE PRINTED SUBJECT IS A SET EVALUATED WHEN THE TRIGGER FIRES, which
     is the whole reason the record is on the SIDE rather than stamped onto
     the permanents the way sharpen's is (v3.66). A weapon equipped after
     Glisten resolved is inside "weapons you control"; a counter from
     another source is a +1{p} counter. */
  const gl = glisten(1);
  let n = H.J.reduce(seatWith([wpn(4)], [gl]), {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  const sides = n.sides.slice();
  sides[0] = {...sides[0], gear: [...sides[0].gear, wpn(2)],
              counters: {...sides[0].counters, 902: {pow: 5}}};
  n = {...n, sides};
  const out = EF.beginEndPhase(n, 0);
  assert.deepEqual(out.game.sides[0].counters, {902: {pow: 0}, 904: {pow: 0}},
    "a weapon equipped after Glisten resolved kept its counters — the subject is read "
    + "at the TRIGGER, not stamped on the cards the distribution touched");
});

test("driven — and it SPARES a permanent the printed subject does not name", () => {
  /* THE HALF THE FIRST FIXTURE COULD NOT EXPRESS (v3.62). Every board here
     held weapons and an empty helm, so a wipe that ignored `spec.filter`
     entirely came back SILENT — it cleared nothing extra because nothing
     extra had a counter. The fixture that bites puts one on the HELM, and
     `+1{p}` counters really do land on non-weapons in this pool: Astral
     Etchings and Uphold Tradition put them on AURAS with ward. A wipe that
     took those is stronger than printed against Enigma's whole engine. */
  const gl = glisten(1);
  let n = H.J.reduce(seatWith([wpn(4), HELM], [gl]),
    {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  const sides = n.sides.slice();
  sides[0] = {...sides[0], counters: {...sides[0].counters, [HELM.uid]: {pow: 3}}};
  n = {...n, sides};
  const out = EF.beginEndPhase(n, 0);
  assert.deepEqual(out.game.sides[0].counters[HELM.uid], {pow: 3},
    "the wipe took a counter off a permanent the printed subject never names");
  assert.deepEqual(out.game.sides[0].counters[904], {pow: 0});
  assert.ok(!out.msgs.some(m => /Helm loses/.test(m)),
    "and the feed announced a wipe that did not happen");
});

test("the policy takes the maximum, on the highest printed power", () => {
  /* v4.23's REPRIEVE READ ONE COUNTER OVER: nothing in the pool spends a
     +1{p} counter (drilled above), so placing fewer is strictly dominated
     and the fallthrough — `promptConfirm`, placing NONE — would have left
     the whole route with no caller (v3.50, five outings).

     WHERE THEY GO IS PRINTED NUMBERS AND A TOTAL ORDER (v2.46): a counter
     is spent by a SWING, so they concentrate on the weapon this policy
     attacks with first, ties broken on uid. */
  const gl = glisten(1);
  let n = H.J.reduce(seatWith([wpn(1), wpn(3), HELM], [gl]),
    {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  let guard = 0;
  while(n.prompt && guard++ < 20){
    const a = H.J.autoAnswer(n);
    assert.ok(a, "the policy had no answer for an `alloc` — the sheet is a livelock");
    n = H.J.reduce(n, a, n.prompt.side || 0).state;
  }
  assert.deepEqual(n.sides[0].counters, {903: {pow: 4}},
    "the policy did not place all four on the highest printed power");
  /* THE TIE-BREAK IS PINNED, because a ranking that leaves ties unbroken
     is a desync waiting for two equal permanents (v2.46). */
  const a = wpn(3, "Blade A"), b = {...wpn(3, "Blade B"), uid: 899};
  const g3 = glisten(3);
  let m = H.J.reduce(seatWith([a, b], [g3]), {t: "play", uid: g3.uid, from: "hand"}, 0).state;
  guard = 0;
  while(m.prompt && guard++ < 20) m = H.J.reduce(m, H.J.autoAnswer(m), m.prompt.side || 0).state;
  assert.deepEqual(m.sides[0].counters, {899: {pow: 2}}, "the uid tie-break moved");
});

test("`legal` gates the sheet — the wrong seat, and no sheet at all", () => {
  const gl = glisten(1);
  const n = H.J.reduce(seatWith([wpn(1), wpn(3)], [gl]),
    {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  assert.ok(n.prompt, "no sheet to gate");
  assert.equal(H.J.legal(n, {t: "promptTakeBack"}, 0), null);
  assert.ok(H.J.legal(n, {t: "promptTakeBack"}, 1),
    "the other seat could undo a placement on a sheet addressed to you");
  assert.ok(H.J.legal(n, {t: "pass"}, 0),
    "a live sheet must stop the game for both seats (judge's own rule)");
  const clear = {...n, prompt: null, promptQ: []};
  assert.ok(H.J.legal(clear, {t: "promptTakeBack"}, 0),
    "`promptTakeBack` was accepted with no sheet open — it is in PROMPT_ACTIONS, so "
    + "`legal` must refuse it the way it refuses the other four");
});

test("`ctrEnd` survives the wire", () => {
  /* A SIDE FIELD IS NOT REAL UNTIL THREE PLACES CARRY IT. A dropped field
     is a desync: the lists are read by NAME so the decode is fine, and
     what breaks is the FINGERPRINT — two honest peers hashing differently
     on the opening state (v4.26). */
  assert.ok(W.NON_CARD_SIDE_FIELDS.includes("ctrEnd"));
  const gl = glisten(1);
  const n = H.J.reduce(seatWith([wpn(4)], [gl]), {t: "play", uid: gl.uid, from: "hand"}, 0).state;
  const back = W.decode(W.encode(n));
  assert.deepEqual(back.sides[0].ctrEnd, n.sides[0].ctrEnd);
  assert.equal(W.hash(back), W.hash(n),
    "the round trip changed the fingerprint, which is the desync the bump exists to refuse");
});

/* ---- the sheet is ONE BODY, and the table has one at all -------------- */

test("the prompt sheet is shared, and BOTH boards render it", () => {
  /* THE TABLE HAD NO SHEET (v4.44). `judge.legal` freezes the game for
     both seats while a prompt is live and refuses everything but the five
     answering actions — so a card that asked its controller a question was
     a hard livelock on the board this project calls CR-exact, and the word
     "prompt" did not appear once in `TableBoard`. v3.01's shape at the
     scale of an interaction layer.

     A SOURCE SLICE ROTS WHERE A RULE MOVES (v3.22, v3.28) — so what is
     pinned here is the thing that cannot be satisfied by finding nothing:
     ONE `.psheet` in the file, and TWO renders of the component. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const count = re => (html.match(re) || []).length;
  assert.equal(count(/className="psheet"/g), 1,
    "a second copy of the sheet's markup appeared — that is the mirror that let the "
    + "peek dock's measurement exist on one board and not the other (v2.52)");
  assert.equal(count(/function PromptSheet\(/g), 1);
  assert.equal(count(/<PromptSheet /g), 2,
    "one of the two boards stopped rendering the sheet");
  /* A TEXTUAL SCAN CANNOT TELL A LIVE RENDER FROM A NEUTERED ONE (v4.00,
     verbatim: `if(false && …)` keeps the name intact). Wrapping either
     render in a literal-false gate came back SILENT against the count
     alone, so that one shape is refused by name — and the reach of the
     scan ends there, which is stated rather than papered over. The
     property that actually matters is carried by the DRIVEN census in the
     next drill: every action judge accepts, the table can send. */
  assert.equal(/(?:false|null|undefined)\s*&&\s*<PromptSheet /.test(html), false,
    "a PromptSheet render is behind a literal-false gate — the sheet is on the page "
    + "and dead, which is exactly how the table came to have none at all");
  /* AND EVERY ANSWERING ACTION IS REACHABLE FROM THE TABLE, which is the
     half a component count cannot see: the trainer answers with closures
     and the table has to SEND each one. */
  for(const a of ["promptSel", "promptChoose", "promptConfirm", "promptDecline",
                  "promptTakeBack"])
    assert.ok(new RegExp('t:"' + a + '"').test(html),
      "the table cannot send `" + a + "` — a sheet needing it is a livelock there");
});

test("every prompt action judge accepts is one the table can send", () => {
  /* THE CENSUS, not the list (v3.35's `PENDING_KINDS`, v4.17's partition).
     A sixth answering action added to judge and forgotten in the table is
     exactly the defect above, arriving again. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const missing = H.J.PROMPT_ACTIONS.filter(a => !new RegExp('t:"' + a + '"').test(html));
  assert.deepEqual(missing, [],
    "judge accepts prompt actions the table has no control for: " + missing.join(", "));
});
