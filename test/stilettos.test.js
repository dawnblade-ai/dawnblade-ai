/* ============================================================
 * SILENT STILETTOS — A WATCHER ON TWO EVENTS, AND A DESTROY
 * NOTHING CARRIED (v4.52)
 *
 * > "Whenever an attacking ally you control dies or an attack action
 * >  card you control is destroyed by **phantasm**, you may pay
 * >  {r}{r}{r}. If you do, destroy this and gain 1 action point."
 * >                                — SILENT STILETTOS, Enigma's Legs
 *
 * BOTH CLAUSES READ `skip` SINCE THE CARD WAS DEALT, and the cheapest
 * diagnostic in this project says which half was the blocker (v3.79,
 * v4.43): hand the same printed line a TRIGGER that has a reader and it
 * parses in full — cost 3, the "you may", the payload, all of it. So the
 * TRIGGER was the whole blocker and the machinery was already here.
 *
 * AND BUILDING IT EXPOSED A SECOND DEFECT THAT WAS LATENT THE WHOLE
 * TIME. `classifyClause("destroy this and gain 1 action point")` answers
 * `[["ap",1]]` — the payload with the printed DESTROY silently dropped
 * (v4.37's Mark of the Huntsman, v4.25's Boom Grenade, one joiner over)
 * — so a trigger built without the split hands its controller an
 * UNBOUNDED, REPEATABLE free action point off a permanent that never
 * leaves. That is v3.72's rule: when you build a SOURCE, ask which
 * payload paths it has just made reachable.
 *
 * ONE PRINTED CLAUSE NAMES TWO EVENTS, so it is ONE trigger that TWO
 * sites answer to — `entersLeaves`'s shape (v3.20). They are not equally
 * reachable and that is MEASURED rather than assumed: the phantasm half
 * is LIVE (Enigma decks four of the pool's phantasm attack records and
 * wears this piece), the ally half needs an ATTACKING ally to die and
 * `allyDeath`'s one caller is handed the ally that was the attack
 * TARGET, so it is latent, gated on the caller's own answer (v3.69) and
 * drilled with a synthetic (v3.73).
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
const gate = t => H.hasDb() ? t : { skip: true };
const pool = require("../data/pool.json");
const rec = r => ({name: r.name, pitch: +(r.pitch || 0), tt: r.type_text, ty: r.types,
                   tx: r.functional_text, kw: r.card_keywords, cost: r.cost,
                   power: r.power, def: r.defense});

/* ---- 1. THE PARSE ---------------------------------------------------- */

test(gate("the card reads in full — trigger, cost, payload and the printed destroy"), () => {
  P.fxReset();
  const fx = P.fxParse(H.card("Silent Stilettos", 0));
  assert.equal(fx.tier, "full", "it read `part` from the day it was dealt");
  assert.deepEqual(fx.payCost,
    {cost: 3, taps: false, ops: [["ap", 1]], trigger: "allyDiesOrPhantasm", selfDestroy: true});
  P.fxReset();
});

test("THE TRIGGER WAS THE WHOLE BLOCKER — the diagnostic, run on the real line", () => {
  /* v3.79/v4.43's cheapest diagnostic: hand the SAME printed line a
     trigger that already had a reader. If it parses, nothing about the
     cost, the "you may" or the payload was ever missing. */
  const line = "Whenever an attacking ally you control dies or an attack action card you control " +
               "is destroyed by **phantasm**, you may pay {r}{r}{r}. If you do, destroy this and gain 1 action point.";
  const syn = (name, tx) => ({name, pitch: 0, tt: "Illusionist Equipment - Legs",
                              ty: ["Illusionist", "Equipment"], tx, kw: [], cost: null, power: null, def: 0});
  P.fxReset();
  const swapped = P.fxParse(syn("SS-DIAG-swapped",
    line.replace(/Whenever [^,]+,/, "When you play an aura,")));
  assert.ok(swapped.payCost, "the same line with a KNOWN trigger parses");
  assert.equal(swapped.payCost.cost, 3, "…cost and all");
  assert.deepEqual(swapped.payCost.ops, [["ap", 1]]);
  assert.equal(swapped.payCost.selfDestroy, true);
  P.fxReset();
});

test("THE PRINTED DESTROY WOULD OTHERWISE BE DROPPED — the premise, driven", () => {
  /* THE DEFECT THIS SPLIT EXISTS FOR, asked of `classifyClause` itself.
     Read whole, the tail is the payload with the drawback gone — so the
     split is the only thing between this card and an unbounded free
     action point. A drill that only asserts the finished parse cannot
     see that the danger was real (v4.11). */
  assert.deepEqual(P.classifyClause("destroy this and gain 1 action point").ops, [["ap", 1]],
    "the loose matcher answers the payload with the destroy GONE");
  assert.equal(P.classifyClause("destroy this"), null,
    "…and the destroy alone has no reader at all, so nothing else would catch it");
});

test("the AMOUNT and the COST are read, not hardcoded (v3.32)", () => {
  /* The card prints 3 and 1 and is the pool's only record of its shape,
     so a literal is indistinguishable from a read number against every
     pool fixture. A synthetic printing different numbers is what sees it. */
  const syn = (name, cost, n) => ({name, pitch: 0, tt: "Illusionist Equipment - Legs",
    ty: ["Illusionist", "Equipment"], kw: [], cost: null, power: null, def: 0,
    tx: "Whenever an attacking ally you control dies or an attack action card you control is destroyed by " +
        "**phantasm**, you may pay " + "{r}".repeat(cost) + ". If you do, destroy this and gain " + n + " action points."});
  P.fxReset();
  const a = P.fxParse(syn("SS-NUM-a", 1, 2));
  assert.equal(a.payCost.cost, 1, "the cost is the pip count");
  assert.deepEqual(a.payCost.ops, [["ap", 2]], "and the payload is the card's own number");
  P.fxReset();
});

/* ---- 2. WHAT REFUSES ------------------------------------------------- */

test("an unreadable or `noop` payload refuses — a cost with no reward (v2.04, v3.93)", () => {
  const syn = (name, tail) => ({name, pitch: 0, tt: "Illusionist Equipment - Legs",
    ty: ["Illusionist", "Equipment"], kw: [], cost: null, power: null, def: 0,
    tx: "Whenever an attacking ally you control dies or an attack action card you control is destroyed by " +
        "**phantasm**, you may pay {r}{r}{r}. If you do, " + tail + "."});
  P.fxReset();
  assert.equal(P.fxParse(syn("SS-REF-a", "destroy this and blorf the widget")).payCost, undefined,
    "an unreadable payload leaves the card unclaimed");
  assert.equal(P.fxParse(syn("SS-REF-b", "destroy this and dominate")).payCost, undefined,
    "and a `noop` one does too — `ops.length` is 1, so a length test alone lets it through");
  assert.ok(P.fxParse(syn("SS-REF-c", "destroy this and draw a card")).payCost,
    "…so the refusals above are the payload, not the shape");
  P.fxReset();
});

test("the trigger vocabulary stays CLOSED — a near-miss wording is not this event", () => {
  /* The near-misses are synthetic because the pool prints ONE wording
     (v3.73). Each drops a printed restriction the card names, and a
     reader that answers for them fires on an event the card does not. */
  /* EACH NEAR-MISS DIFFERS FROM THE PRINTED PHRASE IN EXACTLY ONE WORD
     (v3.62). The first draft of this list dropped "attacking" AND the
     whole second half, so it was refused on the half that was not under
     test and the sabotage that loosens the word came back SILENT. */
  const printed = "an attacking ally you control dies or an attack action card you control is destroyed by phantasm";
  for(const p of [
    printed.replace("an attacking ally", "an ally"),           /* "attacking" dropped */
    printed.replace("ally you control", "ally"),               /* "you control" dropped */
    printed.replace(" by phantasm", ""),                       /* the keyword dropped */
    printed.replace("an attack action card you control", "a card you control")
  ]){
    assert.notEqual(p, printed, "the near-miss has to DIFFER: " + p);
    assert.equal(P.payTrigger(p), null, "not this event: " + p);
  }
  assert.deepEqual(
    P.payTrigger("an attacking ally you control dies or an attack action card you control is destroyed by phantasm"),
    {trigger: "allyDiesOrPhantasm"}, "…and the printed wording is");
});

/* ---- 3. THE SPEC, AND WHAT THE FEED SAYS ----------------------------- */

const spec = (over) => Object.assign({
  tag: "pay", side: 0, src: "Silent Stilettos", cost: 3, avail: 9,
  ops: [["ap", 1]], taps: false, destroyUid: 41, title: "t", hint: "h"}, over || {});

const answer = (sp, take) => {
  const g = {sides: [{res: 9}, {res: 9}]};
  const p = PM.buildPrompt(g, sp);
  return PM.applyPrompt(g, Object.assign({}, p, {choice: take ? "pay" : "decline"}));
};

test("THE FEED NAMES BOTH HALVES OF THE PRICE (v4.37's hole, one combination over)", () => {
  /* `payVerb`'s destroy branch answered before `prompt.cost` was ever
     read — right while the only records were v3.93's, where the destroy
     IS the whole price, and wrong the moment a card charges both. A line
     saying only "destroyed Silent Stilettos" omits three resources the
     player actually spent: the sev-2 category the player TRUSTS. */
  const ok = answer(spec(), true).msgs.join(" ");
  assert.match(ok, /paid 3/,  "the resources are named");
  assert.match(ok, /destroyed Silent Stilettos/, "and so is the permanent");

  const no = answer(spec(), false).msgs.join(" ");
  assert.match(no, /declined to pay 3/, "the decline names the resources");
  assert.match(no, /rather than destroy it/, "and what keeping it cost");
});

test("v3.93's OWN lines are byte-identical — a destroy that IS the price still reads that way", () => {
  /* BOTH HALVES (v3.98). A fix that renames every destroy line is a
     regression wearing a fix's clothes, and `tools/selfplay.js`'s
     `destroycost` counter matches these exact phrases. */
  const bt = spec({src: "Beaten Trackers", cost: 0, destroyUid: 7});
  assert.deepEqual(answer(bt, true).msgs,  ["You destroyed Beaten Trackers — the rider resolves."]);
  assert.deepEqual(answer(bt, false).msgs, ["You kept Beaten Trackers rather than destroy it."]);
});

test("the `destroycost` route counter still matches all FOUR lines (v3.81)", () => {
  /* THE COUNTER SPELLS THE ENGINE'S OWN PHRASE, and a reworded line
     reports ZERO exactly as a missing route does. The two spellings are
     pinned against each other rather than reasoned about. */
  const tool = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  const m = tool.match(/if\((\/[^\n]*?\/)\.test\(line\)\)\s*\n?\s*events\.push\(\["destroycost"/);
  assert.ok(m, "the destroycost counter moved — re-anchor this drill");
  const rx = new RegExp(m[1].slice(1, -1));
  for(const take of [true, false]){
    const mine = answer(spec(), take).msgs[0] + (take ? "" : "");
    const theirs = answer(spec({src: "Beaten Trackers", cost: 0, destroyUid: 7}), take).msgs[0];
    /* applyPrompt's caller appends the suffix; reproduce it exactly. */
    const suffix = l => l.endsWith(".") ? l : l + ".";
    assert.ok(rx.test(suffix(mine)),   "counted: " + mine);
    assert.ok(rx.test(suffix(theirs)), "counted: " + theirs);
  }
});

test("the SHEET names the destroy too — half a price is not a price (v4.24)", () => {
  P.fxReset();
  const px = P.fxParse(H.card("Silent Stilettos", 0)).payCost || {cost: 3, ops: [["ap", 1]], selfDestroy: true};
  P.fxReset();
  const sp = E.payCostSpec ? null : null;   /* payCostSpec is module-private; assert through the source */
  const i = SRC.indexOf("const alsoDestroys = !!px.selfDestroy;");
  assert.ok(i > 0, "the spec's destroy branch moved — re-anchor this drill");
  const body = SRC.slice(i, i + 900);
  assert.match(body, /destroyUid: alsoDestroys \? card\.uid : undefined/,
    "it reuses the one description of `this permanent is spent on the accept branch`");
  assert.match(body, /paying also destroys/, "and the hint says so");
  assert.ok(px.selfDestroy, "the premise: the card sets the flag");
});

/* ---- 4. DRIVEN — THE LIVE HALF, AT THE TABLE ------------------------- */

/* `payCostSpec`-style unit calls prove a reader; only driving `reduce`
   proves the card (v3.20, v3.89, v4.03). Seat 0 wears the piece and
   swings a real phantasm attack out of Enigma's own list; seat 1 blocks
   with a 6-power non-Illusionist attack action card, which pops it. */
function popWith(stiletto, seed, atkName){
  const atk = {...C.resolveEntry(H.db(), {name: atkName || "Spears of Surreality", p: 1, code: null, q: 1}), uid: "ph"};
  assert.ok(P.hasKw(atk, "phantasm"), "the printed keyword is the spec");
  const big = {uid: "w1", name: "Six Power", def: 3, power: 6, pitch: 1,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk], gear: stiletto ? [stiletto] : []},
                  {name: "Them", hand: [big]},
                  {actor: 0, turnPlayer: 0, seed});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = J.reduce(g, {t: "play", uid: "ph", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  assert.equal(n.step, "defend", "the drill has to REACH the defend step or it proves nothing");
  const d = J.reduce(n, {t: "defend", uid: "w1"}, 1);
  assert.equal(d.error, null, "declaring the blocker was refused: " + d.error);
  n = d.state;
  for(let i = 0; i < 16 && n.phase === "action" && n.step !== "layer"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  return n;
}

const wearIt = () => Object.assign({}, H.card("Silent Stilettos", 0), {uid: 41});

test(gate("THE LIVE HALF — a phantasm pop offers the sheet to the attack's controller"), () => {
  const n = popWith(wearIt(), "ss-live");
  assert.equal(n.sides[0].grave.filter(c => c.uid === "ph").length, 1, "the attack really was popped");
  assert.ok(n.prompt, "and the watcher's sheet is open");
  assert.equal(n.prompt.tag, "pay");
  assert.equal(n.prompt.src, "Silent Stilettos");
  assert.equal(n.prompt.side, 0, "addressed to the seat that CONTROLS the destroyed card, not the popper");
  assert.equal(n.prompt.cost, 3);
  assert.equal(n.prompt.destroyUid, 41, "and the printed destroy rides on the answer");
  assert.deepEqual(INV.errors(n), [], "the board is clean");
});

test(gate("NO PIECE, NO SHEET — the control that proves the sheet is the watcher's"), () => {
  const n = popWith(null, "ss-none");
  assert.equal(n.sides[0].grave.filter(c => c.uid === "ph").length, 1, "the same pop happened");
  assert.ok(!n.prompt || n.prompt.src !== "Silent Stilettos", "and nothing was offered");
});

test(gate("PAYING spends 3, destroys the piece and gains the action point"), () => {
  /* THE ACCEPT PATH IS DRIVEN END TO END, because the policy declines by
     standing rule (v4.24) — so without this the payload would have no
     caller anywhere (v3.50, six outings). */
  let n = popWith(wearIt(), "ss-pay");
  assert.ok(n.prompt, "the sheet is open");
  const res0 = n.sides[0].res, ap0 = n.sides[0].ap;
  /* A `pay` SHEET IS TWO ACTIONS: choose, then confirm (`PROMPT_ACTIONS`). */
  const chose = J.reduce(n, {t: "promptChoose", choice: "pay"}, 0);
  assert.equal(chose.error, null, "choosing to pay was refused: " + chose.error);
  const out = J.reduce(chose.state, {t: "promptConfirm"}, 0);
  assert.equal(out.error, null, "paying was refused: " + out.error);
  n = out.state;
  assert.equal(n.sides[0].res, res0 - 3, "three resources left the pool");
  assert.equal(n.sides[0].ap, ap0 + 1, "and the printed action point arrived (CR 5.3.5 — a GAIN)");
  const piece = (n.sides[0].gear || []).find(c => c && c.uid === 41);
  assert.ok(piece && piece.destroyed, "the piece is destroyed — the printed drawback landed");
  assert.deepEqual(INV.errors(n), [], "the board is clean");
});

test(gate("DECLINING costs nothing and keeps the piece — the `you may` is real"), () => {
  let n = popWith(wearIt(), "ss-decline");
  assert.ok(n.prompt, "the sheet is open");
  const res0 = n.sides[0].res, ap0 = n.sides[0].ap;
  const chose = J.reduce(n, {t: "promptChoose", choice: "decline"}, 0);
  assert.equal(chose.error, null, "choosing to decline was refused: " + chose.error);
  const out = J.reduce(chose.state, {t: "promptConfirm"}, 0);
  assert.equal(out.error, null, "declining was refused: " + out.error);
  n = out.state;
  assert.equal(n.sides[0].res, res0, "no resources spent");
  assert.equal(n.sides[0].ap, ap0, "no action point gained");
  const piece = (n.sides[0].gear || []).find(c => c && c.uid === 41);
  assert.ok(piece && !piece.destroyed, "and the piece survives");
});

test(gate("the printed restriction is TESTED at the fire site, not assumed (v4.31)"), () => {
  /* Every pool record a pop can destroy is an `Illusionist Action -
     Attack`, so `isAtkActionCard` changes no answer today — which is
     exactly why the source is what carries the claim. v4.31 is the
     version that found this very block asking for a card's power and
     dropping both of the keyword's own printed restrictions. */
  const i = SRC.indexOf('if(hasKw(card,"phantasm")){');
  assert.ok(i > 0, "the pop site moved — re-anchor this drill");
  const body = SRC.slice(i, i + 3000);
  assert.match(body, /if\(isAtkActionCard\(card\)\) n = offerPayCost\(n, "allyDiesOrPhantasm"\)/,
    "the offer is gated on the printed type");
  /* THE PREMISE, MEASURED: nothing in the pool tells the two readings
     apart, so the day one does, this drill's claim is what moves. */
  const carriers = pool.filter(r => P.printedKw(rec(r), "phantasm"));
  assert.ok(carriers.length > 0, "the scan is alive: " + carriers.length + " records");
  assert.deepEqual(carriers.filter(r => !P.isAtkActionCard(rec(r))).map(r => r.name), [],
    "every record that prints phantasm is an attack action card");
});

/* ---- 5. DRIVEN — THE LATENT HALF ------------------------------------- */

test('"ATTACKING" IS THE CALLER\'S ANSWER, and the live caller says no (v3.69)', () => {
  /* THE LATENT HALF (v3.73). Nothing in the pool can kill an ATTACKING
     ally, so both halves are driven through `allyDeath` directly: the
     synthetic says the ally was attacking and gets the sheet, and the
     shape judge actually passes gets nothing. Written with only the
     positive half, a reader that offered on EVERY ally death would pass. */
  const ss = wearIt();
  const ally = {uid: 90, name: "Probe Ally", tt: "Generic Action - Ally",
                ty: ["Generic", "Action", "Ally"], power: 2, life: 2, tx: ""};
  const base = H.state({name: "You", res: 9, gear: [ss]}, {name: "Them"},
                       {actor: 1, turnPlayer: 1, seed: "ss-ally"});

  const attacking = H.fx(base, (fx, st) => fx.allyDeath(st, ally, 0, true).game);
  assert.equal((attacking.promptQ || []).length, 1, "an ATTACKING ally's death offers the sheet");
  assert.equal(attacking.promptQ[0].src, "Silent Stilettos");
  assert.equal(attacking.promptQ[0].side, 0, "addressed to the ally's CONTROLLER, not the killer");
  assert.equal(attacking.actor, 1, "and the borrowed seat is handed straight back (v3.46)");

  const defending = H.fx(base, (fx, st) => fx.allyDeath(st, ally, 0, false).game);
  assert.deepEqual(defending.promptQ || [], [],
    "an ally that died while being ATTACKED is a different event — nothing is offered");
});

test("judge's one caller passes the measured `false` explicitly", () => {
  const jsrc = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const calls = [...jsrc.matchAll(/allyDeath\([^)]*\)/g)].map(m => m[0]);
  assert.deepEqual(calls.length, 1, "one caller: " + calls.join(" | "));
  assert.match(calls[0], /link\.target\.side,\s*false\)/,
    "it is `link.target` — the ally the attack was aimed AT — so it answers false");
});

test("the watcher is asked BEFORE the corpse's own `onDeath` guard", () => {
  /* A watcher does not care what the dying ally prints, so a scan below
     that early return would only ever see allies carrying a death
     trigger of their own — which in the pool is exactly one card. */
  const i = SRC.indexOf("const allyDeath = (s, card, side, attacking) => {");
  assert.ok(i > 0, "allyDeath moved — re-anchor this drill");
  const body = SRC.slice(i, i + 700);
  const offer = body.indexOf("offerPayCost");
  const guard = body.indexOf("onDeath || []).length");
  assert.ok(offer > 0 && guard > 0, "both are in the body");
  assert.ok(offer < guard, "the offer comes first");
});

test("nothing in the pinned pool can kill an attacking ally — the latency, measured", () => {
  /* THE PREMISE THE `false` RESTS ON. Stated in the source as a
     measurement, so the day a card can, this drill is what moves. */
  const names = pool.filter(r => /attacking ally/i.test(String(r.functional_text || "")))
                    .map(r => r.name);
  assert.deepEqual([...new Set(names)], ["Silent Stilettos"],
    "the pool's only record printing the phrase is the watcher itself");
});

/* ---- 6. THE BLAST RADIUS, BOTH DIRECTIONS ---------------------------- */

test(gate("exactly ONE pool record moves, and every sibling is unchanged"), () => {
  H.db();
  P.fxReset();
  const tiers = {};
  const carriers = {};
  for(const r of pool){
    const fx = P.fxParse(rec(r));
    tiers[fx.tier] = (tiers[fx.tier] || 0) + 1;
    if(fx.payCost) (carriers[fx.payCost.trigger] = carriers[fx.payCost.trigger] || new Set()).add(r.name);
  }
  /* 747/38/12 before v4.52; Silent Stilettos is the record that moved
     there. RE-PINNED AT v4.54 after reading the diff: Enigma's hero record
     went `none` -> `part` when her ability's payload gained a reader, so
     `part` 37 -> 38 and `none` 12 -> 11 and the `full` count is untouched.
     A whole-pool pin inside a card's own drill is deliberate — it is this
     version's blast-radius measurement standing (v4.17) — and moving it is
     an edit somebody makes on purpose. RE-PINNED AGAIN AT v4.56, after
     reading the diff: V of the Vanguard went `part` -> `full` when the
     standing-grant anchor learned the window's other printed position, so
     `full` 748 -> 749 and `part` 38 -> 37 with `none` untouched. Exactly
     one record moves, which is the measurement that version rests on.
     RE-PINNED AGAIN AT v4.58, after reading the diff: Flamecall Awakening
     went `part` -> `full` when the pick reader learned the DECK as a source
     zone, so `full` 749 -> 750 and `part` 37 -> 36 with `none` untouched.
     One record again, and the audit's unique-card count moves with it
     (395 -> 396 full, 10 -> 9 part). RE-PINNED AGAIN AT v4.59, after
     reading the diff: Crown of Dichotomy went `part` -> `full` when the pick
     reader learned that one printed sentence can name TWO targets, so
     `full` 750 -> 751 and `part` 36 -> 35 with `none` untouched. One
     record, again. RE-PINNED AGAIN AT v4.62, after reading the diff: all
     THREE Wreck Havoc printings went `part` -> `full` when the cross-seat
     arsenal turn and the type-filtered destroy landed, so `full` 751 -> 754
     and `part` 35 -> 32 with `none` untouched. Three records this time,
     because that card is decked at three pitches — and the audit's
     UNIQUE-card count moves by one with it (397 -> 398 full, 8 -> 7 part).
     RE-PINNED AGAIN AT v4.63, after reading the diff: Plasma Barrel Shot
     went `part` -> `full` when its steam line got a reader and its
     hand-written powCard retired, so `full` 754 -> 755 and `part` 32 -> 31
     with `none` untouched. One record (398 -> 399 full, 7 -> 6 part).
     RE-PINNED AGAIN AT v4.64, after reading the diff: Roaring Beam went
     `part` -> `full` when its soul gate, its return to hand and its charge
     made as an effect each got a reader, so `full` 755 -> 756 and `part`
     31 -> 30. One record (399 -> 400 full, 6 -> 5 part). RE-PINNED
     AGAIN AT v4.65, after reading the diff: Topsy Turvy went `part` ->
     `full` when its deck-top replacement got a reader, and with it a
     powCard, so `full` 756 -> 757 and `part` 30 -> 29. One record
     (400 -> 401 full, 5 -> 4 part). */
  assert.deepEqual(tiers, {full: 757, none: 11, part: 29});
  assert.deepEqual([...carriers.allyDiesOrPhantasm], ["Silent Stilettos"]);
  /* PINNED BOTH SIDES (v4.17) — pinning the new trigger alone cannot see
     a record LEAVING one of the others, which is what merging two
     vocabularies could have done. */
  assert.deepEqual(Object.keys(carriers).sort(),
    ["allyDiesOrPhantasm", "defends", "discardRandom", "playAura", "selfHitHero", "weaponHit"]);
  /* AND THE `selfDestroy` FLAG IS OPT-IN (v3.58): exactly one record
     carries it, so every drill that `deepEqual`s a whole `payCost` keeps
     the shape it was written against. */
  const flagged = pool.filter(r => (P.fxParse(rec(r)).payCost || {}).selfDestroy).map(r => r.name);
  assert.deepEqual([...new Set(flagged)], ["Silent Stilettos"]);
  P.fxReset();
});

test(gate("THE ROUTE READS ZERO ON THE LADDER, AND THAT IS ABOUT THE LOADOUT"), () => {
  /* v4.43's Hope Merchant's Hood and v4.49's Plasma Barrel Shot, a third
     time. Enigma lists TWO Legs pieces and `defaultPicks` ranks by
     printed defence, so it takes the Boots and the Stilettos is never
     worn in a driven game — the route's 0 in `npm run play` is a number
     about the LOADOUT, not about the route (v4.24, v4.29, v4.41).

     A PLAYER PICKS IT ON THE LOADOUT SCREEN, which is the route the
     drills and the scene seat explicitly. And the premise is a DRILL, so
     a `defaultPicks` that starts ranking by card text has to re-measure
     this rather than silently changing what the number means. */
  const B = require("../engine/build.js");
  const G = require("../engine/game.js");
  const RNG = require("../engine/rng.js");
  const X = require("./helpers/extract.js");
  const W = X.loadData();
  const hero = W.HEROES.find(h => h.k === "enigma");
  const deck = G.parseDeck(W.DECKS.enigma);

  const legs = deck.gear
    .map(e => C.resolveEntry(H.db(), e))
    .filter(c => c && /- Legs\b/.test(String(c.tt || "")));
  assert.deepEqual(legs.map(c => c.name).sort(), ["Blade Beckoner Boots", "Silent Stilettos"],
    "she lists exactly two Legs pieces");
  const boots = legs.find(c => c.name === "Blade Beckoner Boots");
  const ss    = legs.find(c => c.name === "Silent Stilettos");
  assert.ok((boots.def || 0) > (ss.def || 0),
    "and the Boots print MORE defence — which is the whole of why they win");

  const built = B.buildSideDefault(hero, deck, H.db(), RNG.make("ss-loadout"), {n: 0});
  const worn = (built.b.gear || []).map(c => c.name);
  assert.ok(worn.indexOf("Blade Beckoner Boots") >= 0, "so `defaultPicks` wears the Boots");
  assert.equal(worn.indexOf("Silent Stilettos"), -1, "…and never the piece this version built");
});
