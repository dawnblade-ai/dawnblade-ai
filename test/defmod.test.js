/* ============================================================
   ONE PER-DEFENDER BONUS MAP (v4.53)

   A `defBuff` op cannot go through `runOps`: that case only LOGS, because
   `runOps` has no way to raise ONE named defender. So every caller that
   can receive one lifts it out first — and there were FOUR hand-rolled
   copies of that filter, one of which (`index.html`'s) wrote into a
   SECOND per-defender map, `defBonus`, that only the trainer kept.

   `applyDefMod` has been the one such map since v3.89 and `defendValue`
   has read it on BOTH boards for as long. So the second map was two
   records of one fact — and it cost exactly what a second record always
   costs: judge.js refused Rally the Coast Guard BY NAME, citing a map it
   already had, for four dozen versions.

   THREE THINGS ARE PINNED HERE:
     * `defBuffOf` is the ONE extractor and it SUMS;
     * `defenderByUid` is the ONE lookup and it spans the three zones a
       declared defender can be in (the old cost-rider scan read GEAR and
       BOARD only — right for Washed Up Wave, narrower than the family);
     * the trainer keeps no second map, driven rather than grepped.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const PR = require("../engine/prompts.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const SRC = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");

/* ---- THE EXTRACTOR ---------------------------------------------------- */

test("`defBuffOf` sums, and answers 0 rather than throwing", () => {
  assert.equal(E.defBuffOf([["defBuff", 2]]), 2);
  /* TWO ENTRIES ARE TWO PRINTED SENTENCES about the same defender, and
     dropping either is weaker than printed. No pool record prints two
     today — the premise is the drill below rather than a sentence. */
  assert.equal(E.defBuffOf([["defBuff", 2], ["ap", 1], ["defBuff", 3]]), 5);
  assert.equal(E.defBuffOf([["ap", 1]]), 0, "and nothing else is claimed");
  assert.equal(E.defBuffOf(null), 0, "a reducer's contract is that it never throws (v2.48)");
  assert.equal(E.defBuffOf([null, ["defBuff", 2]]), 2, "a hole in the list is not a crash");
});

test("no pool record prints two defBuff ops in one payload — the premise, measured", {skip}, () => {
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const twos = [];
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    for(const lst of [fx.ops, fx.payCost && fx.payCost.ops, fx.handAbility && fx.handAbility.ops])
      if((lst || []).filter(o => o && o[0] === "defBuff").length > 1)
        twos.push(c.name + "|" + (c.pitch || 0));
  }
  P.fxReset();
  assert.deepEqual(twos, [],
    "the sum is right the day one arrives; taking the first would be silently wrong then");
});

test("exactly ONE site tests for the op kind", () => {
  /* Four copies of a filter is how one comes to be written `o[1]` instead
     of summed, or omitted entirely — and an unfiltered `defBuff` reaching
     `runOps` is a feed line saying the wall went up and a wall that did
     not (v4.48's Big Blue Sky). */
  const code = strip(SRC("engine/effects.js"));
  assert.equal((code.match(/o\[0\] === "defBuff"/g) || []).length, 1,
    "`defBuffOf` is it; a second test for the kind is a second copy of the filter");
  /* AND THE TRAINER ASKS IT RATHER THAN KEEPING ITS OWN. */
  const htm = strip(SRC("index.html"));
  assert.match(htm, /DawnEffects\.defBuffOf\(/, "the trainer's defpay cycle asks the shared body");
  /* THE COMPLEMENT IS NOT A COPY. `filter(o => o[0] !== "defBuff")` is a
     different operation — "run everything else" — and every extraction
     needs one. What must not exist twice is the SUM. */
  assert.ok(!/o\[0\]==="defBuff"\)\.reduce/.test(htm.replace(/\s+/g, "")),
    "and hand-rolls no second copy of the SUM — there were six across two files");
  assert.equal((htm.match(/DawnEffects\.defBuffOf\(/g) || []).length, 4,
    "four callers: the two played-reaction paths, the defpay cycle, and the sheet's own label — " +
    "a number on screen that differs from the number charged is the sev-2 category (v4.00)");
});

/* ---- THE LOOKUP ------------------------------------------------------- */

test("`defenderByUid` spans the three zones a declared defender can be in", () => {
  const sd = {hand: [{uid: 1, name: "Hand"}], gear: [{uid: 2, name: "Gear"}],
              board: [{card: {uid: 3, name: "Arena"}}]};
  assert.equal(E.defenderByUid(sd, 1).name, "Hand",
    "the HAND is the half the old cost-rider scan could not see at all — `blockH` is uids into it");
  assert.equal(E.defenderByUid(sd, 2).name, "Gear");
  assert.equal(E.defenderByUid(sd, 3).name, "Arena");
  assert.equal(E.defenderByUid(sd, 9), null, "and an unknown uid is null, never a throw");
  assert.equal(E.defenderByUid(null, 1), null);
  assert.equal(E.defenderByUid(sd, null), null, "an absent uid names nothing");
});

/* ---- THE SECOND MAP IS GONE ------------------------------------------- */

test("the trainer keeps no second per-defender map", () => {
  const htm = strip(SRC("index.html"));
  assert.ok(!/\bdefBonus\b/.test(htm),
    "`defBonus` was two records of what `applyDefMod` already held, and a second record " +
    "is dropped by whoever forgets to carry it — which is the v2.64 bug");
  assert.ok(!/r\.dbuff/.test(htm), "and nothing routes a returned buff: the shared body lands it");
  assert.match(htm, /const finishBlock = \(s\) => \{/,
    "so the wall is told nothing — `defendValue` counts the `defMod` itself");
  /* AND THE REFUSAL THAT RESTED ON IT IS GONE FROM JUDGE. */
  const jd = strip(SRC("engine/judge.js"));
  assert.ok(!/per-defender bonus this board does not keep/.test(jd),
    "the refusal cited a map this board already had (v3.89) — a recorded reason is only as " +
    "good as the day it was measured (v3.69)");
});

/* ---- THE FLOOR LANDS IN THE RIGHT PLACE -------------------------------
   The trainer added its bonus AFTER `defendValue` returned, so the order
   was `max(0, base + debuff) + bonus`; inside, it is `max(0, base +
   debuff + bonus)`. They agree unless a DEBUFF has already taken the
   defender below zero — and that board is reachable: Shred is Arakni's
   and Brothers in Arms is in Kayo's and Gravy Bones' lists. */

test("a debuff below zero is not un-floored by a later buff", () => {
  const card = {uid: 77, name: "Wall", def: 1};
  const sd = {hand: [card], gear: [], board: [],
              defMod: [{uid: 77, d: -3}, {uid: 77, d: 3}], hist: {}};
  assert.equal(E.defendValue(sd, card, {}), 1,
    "1 - 3 + 3 = 1, floored once at the end; the old order read max(0, -2) + 3 = 3");
});

/* ---- THE TABLE OFFERS BROTHERS IN ARMS (v4.53) ------------------------
   v4.52 recorded this as `paycost-defends-trainer-only`: the card is
   scanned off the declared wall by `index.html` ALONE, so at the table it
   blocked for its printed 3 with a printed line of play that did not
   exist there. It is not `offerPayCost`'s shape — that body scans the
   GEAR and the ARENA for a WATCHER and a declared defender is in neither.
   The scan belongs beside the two `defends` families `afterDefenders`
   already carried. */

function wallSheet(defender, gear){
  H.db(); P.fxReset();
  const atk = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 2102});
  const g0 = H.state({res: 9, ap: 1},
    {hp: 20, res: 5, hand: gear ? [] : [defender], gear: gear ? [defender] : [],
     blockH: gear ? [] : [defender.uid], blockG: gear ? [0] : [],
     deck: [{uid: 2110, name: "F"}]},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  return J.withEffects(g, (fx, s) =>
    ({game: fx.afterDefenders(s, gear ? [] : [defender], gear ? [defender] : [])})).game;
}

test("Brothers in Arms is offered at the TABLE, and paying raises the wall", {skip}, () => {
  const bia = Object.assign({}, H.card("Brothers in Arms", 1), {uid: 2101});
  let n = wallSheet(bia, false);
  assert.ok(n.prompt, "the sheet opens off the declared wall");
  assert.equal(n.prompt.side, 1, "addressed to the DEFENDER — inside a link the actor is the attacker");
  assert.equal(n.prompt.defUid, 2101, "and it names WHOSE +{d} the payload is");
  const printed = E.defendValue(n.sides[1], bia, {});
  const res = n.sides[1].res;
  n = J.reduce(n, {t: "promptChoose", choice: "pay"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  assert.equal(n.sides[1].res, res - 1, "the printed cost is charged");
  assert.equal(E.defendValue(n.sides[1], bia, {}) - printed, 2,
    "and the number reaches what the card is WORTH at the wall — `defendValue`, both boards");
  assert.deepEqual(n.sides[1].defMod, [{uid: 2101, d: 2}],
    "as a per-card entry, keyed by uid, chain-scoped like everything else the card prints");
});

test("declining changes nothing, and costs nothing", {skip}, () => {
  const bia = Object.assign({}, H.card("Brothers in Arms", 2), {uid: 2103});
  let n = wallSheet(bia, false);
  const printed = E.defendValue(n.sides[1], bia, {});
  const res = n.sides[1].res;
  n = J.reduce(n, {t: "promptDecline"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  assert.equal(n.sides[1].res, res, "a `you may` that cannot be refused is stronger than printed (v3.90)");
  assert.equal(E.defendValue(n.sides[1], bia, {}), printed, "and the wall is the printed number");
  assert.deepEqual(n.sides[1].defMod || [], []);
});

test("the payload does NOT also go through runOps", {skip}, () => {
  /* `runOps`' `defBuff` only LOGS, so the state is identical and the FEED
     is the observable (v3.60) — a line telling the player the number went
     to "the wall" when it went onto one card is the sev-2 category they
     trust, and it would also mean the number was counted nowhere. */
  const bia = Object.assign({}, H.card("Brothers in Arms", 3), {uid: 2104});
  let n = wallSheet(bia, false);
  n = J.reduce(n, {t: "promptChoose", choice: "pay"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  assert.doesNotMatch((n.feed || []).join(" | "), /defense to the wall/);
  assert.match((n.feed || []).join(" | "), /Brothers in Arms defends for 2 more/,
    "the feed names the card and the window, once");
});

/* ---- THE SPEC FIELD MUST BE DECLARED, NOT THREADED (v2.34) ------------ */

test("`defUid` survives buildPrompt and comes back out of applyPrompt", () => {
  const spec = {tag: "pay", side: 1, src: "X", cost: 1, avail: 3,
                ops: [["defBuff", 2]], defUid: 41};
  const g = {sides: [{hand: [], deck: [], grave: [], res: 3}, {hand: [], deck: [], grave: [], res: 3}]};
  const pr = PR.buildPrompt(g, spec);
  assert.equal(pr.defUid, 41,
    "a spec only carries fields `buildPrompt` knows about — dropped, the +{d} is paid for " +
    "and logged and no number moves (v4.48's Big Blue Sky)");
  const out = PR.applyPrompt(g, {...pr, choice: "pay"});
  assert.equal(out.defUid, 41, "and it leaves as DATA, like the tap and the destruction");
  const dec = PR.applyPrompt(g, {...pr, choice: "decline"});
  assert.equal(dec.defUid, undefined, "declining names no defender — there is no payload to route");
});

/* ---- THE CENSUS, BOTH DIRECTIONS (v4.17) ------------------------------ */

test("the pool's `defends` families are exactly these, and each has a site", {skip}, () => {
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const fam = {payCost: [], optCost: [], millCost: []};
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    for(const k of Object.keys(fam))
      if(fx[k] && fx[k].trigger === "defends") fam[k].push(c.name);
  }
  P.fxReset();
  const uniq = o => [...new Set(o)].sort();
  assert.deepEqual(uniq(fam.payCost),  ["Brothers in Arms"]);
  assert.deepEqual(uniq(fam.optCost),  ["Crash and Bash"]);
  assert.deepEqual(uniq(fam.millCost), ["Washed Up Wave"]);
  /* AND ALL THREE ARE SCANNED IN ONE LOOP. Pinning the readers alone
     cannot see a family leaving the list (v4.29), so the source half asks
     for all three inside the body that receives the wall. */
  const code = strip(SRC("engine/effects.js"));
  const i = code.indexOf("const afterDefenders = (s, wall, gearWall) =>");
  assert.ok(i > 0, "afterDefenders moved — re-anchor this drill");
  const body = code.slice(i, code.indexOf("const linkPumps", i));
  for(const k of ["payCost", "optCost", "millCost"])
    assert.ok(new RegExp('dfx\\.' + k).test(body), k + " is scanned off the declared wall");
});

/* ---- THE ROUTE COUNTER SPELLS THE ENGINE'S OWN PHRASE (v3.81) --------- */

test("`defmod` counts the family, and its phrase is the engine's", () => {
  /* A counter that spells the wrong word reports ZERO exactly as a missing
     feature does (v3.81), and v4.46 found one reporting a confident 335 of
     the OPPOSITE event. So the two spellings are pinned against each
     other, and the counter is named for the FAMILY rather than for the
     card that prompted it: `applyDefMod` is the one body, so this line
     carries Brothers in Arms' paid brace, Rally the Coast Guard's, Shred's
     debuff and the clash payoff alike. Calling it `brothers` would be a
     number about one card standing on a line four sources print (v4.44). */
  const sp = strip(SRC("tools/selfplay.js"));
  const m = sp.match(/if\((\/[^\n]*?\/)\.test\(line\)\) events\.push\(\["defmod", line\]\);/);
  assert.ok(m, "the counter is gone — or it stopped being one line");
  const rx = new RegExp(m[1].slice(1, -1));
  assert.ok(rx.test("Brothers in Arms defends for 2 more for the rest of this combat chain."),
    "it matches the engine's accept line");
  assert.ok(rx.test("Shred: Edge of Their Seats defends for 2 less for the rest of this combat chain."),
    "…and the debuff, which is the same body with the opposite sign");
  assert.ok(rx.test("Stonewall Impasse defends for 1 more until end of turn."),
    "…and the turn-scoped window (v3.94)");
  assert.ok(!rx.test("+2 defense to the wall."),
    "and NOT `runOps`' log-only line, which is the one that moves no number");
});
