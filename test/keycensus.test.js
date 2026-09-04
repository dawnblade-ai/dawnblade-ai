/* ============================================================
   TWO MORE CENSUSES, BOTH CLEAN — AND THAT IS THE POINT (v3.99)

   HANDOFF named three census targets after v3.98. The third —
   `runOps`' op vocabulary against what the parser emits — found a real
   hole and is fixed in `test/keywordgate.test.js`. These are the other
   two, and both came back with nothing outstanding.

   A CLEAN RESULT IS WORTH HAVING PROVED RATHER THAN ASSUMED, which is
   v3.97's own argument for `condcensus.test.js`. What makes it worth a
   file is that the sets are PINNED: "the scan found nothing" cannot pass
   for "everything is accounted for" (v3.21, v3.47, v2.47), and a NEW key
   or a dropped argument fails here rather than walking into a silent
   fallback.

   1. EVERY FILTER KEY THE PARSER EMITS IS TESTED BY `promptFilter`.
      An unknown key that simply falls through ADMITS EVERY CARD, which is
      the sev-3 v2.29's refusals exist to prevent — Mounting Anger's
      dropped cost bound made any attack in hand a legal banish.

   2. `windowsNow` IS ONE BODY *AND* BOTH CALLERS THREAD THE SAME
      ARGUMENTS. v3.36 made it one body after a widened window in
      `playableWhy` and not `playWindowFor` put Iyslander on `ap: -1`
      (`NEGATIVE-AP`, CR 4.4.3e). One body is necessary and NOT
      sufficient: a dropped `zone` or `half` in one caller reintroduces
      the divergence with the shared body perfectly intact, which is
      v3.24's lesson verbatim — there, removing an argument from a gear
      wall failed no drill because the guard matched the CALL.

   AND THE FIRST SCAN HERE REPORTED A TEN-KEY GAP THAT DID NOT EXIST.
   It looked for `f.<key>` where the parameter is named `spec`, so it
   found NOTHING tested and called every emitted key unanswered. v3.00
   and v3.81 both record a scan aimed at the wrong shape passing by
   finding nothing; this is the same defect with the sign flipped, and it
   is why the drill below asserts the tested set is NON-EMPTY and names
   members of it. Check your own fixture — again.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const JUDGE = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
const PROMPTS = fs.readFileSync(path.join(__dirname, "..", "engine", "prompts.js"), "utf8");

/* Brace-match a named function out of a source file, string- and
   comment-aware. A slice taken by line number rots the moment anything
   above it moves (v3.22, v3.28). */
function bodyOf(src, header){
  const i = src.indexOf(header);
  assert.ok(i > 0, header + " moved — re-anchor this drill");
  let d = 0, end = -1;
  for(let q = src.indexOf("{", i); q < src.length; q++){
    const ch = src[q];
    if(ch === '"' || ch === "'" || ch === "`"){
      const Q = ch; q++;
      while(q < src.length && src[q] !== Q){ if(src[q] === "\\") q++; q++; }
      continue;
    }
    if(ch === "/" && src[q + 1] === "/"){ while(q < src.length && src[q] !== "\n") q++; continue; }
    if(ch === "/" && src[q + 1] === "*"){ q = src.indexOf("*/", q) + 1; continue; }
    if(ch === "{") d++;
    else if(ch === "}"){ d--; if(d === 0){ end = q; break; } }
  }
  assert.ok(end > i, header + " does not close — re-anchor this drill");
  return src.slice(i, end);
}

/* ------------------------------------------------------------------
   1. FILTER KEYS
   ------------------------------------------------------------------ */

function emittedFilterKeys(){
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const keys = new Set();
  const walk = f => { if(f && typeof f === "object") Object.keys(f).forEach(k => keys.add(k)); };
  const ops = list => (list || []).forEach(o => {
    if(!Array.isArray(o)) return;
    const s = o[1];
    if(s && typeof s === "object"){
      if(s.filter) walk(s.filter);
      if(s.spec && s.spec.filter) walk(s.spec.filter);
    }
  });
  for(const c of arr){
    P.fxReset();
    let fx;
    try {
      fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
        ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
        cost: c.cost, power: c.power, def: c.defense});
    } catch(e){ continue; }
    if(fx.optCost)  walk(fx.optCost.filter);
    if(fx.payCost)  walk(fx.payCost.filter);
    if(fx.millCost) walk(fx.millCost.filter);
    ops(fx.ops); ops(fx.onHit);
    (fx.conds || []).forEach(x => x.op && ops([x.op]));
    (fx.modes || []).forEach(m => ops(m.ops));
  }
  return keys;
}

function testedFilterKeys(){
  const body = bodyOf(PROMPTS, "function promptFilter(spec){");
  const keys = new Set();
  for(const m of body.matchAll(/spec\.([a-zA-Z][a-zA-Z0-9]*)/g)) keys.add(m[1]);
  for(const m of body.matchAll(/"([a-zA-Z][a-zA-Z0-9]*)"\s*in\s*spec/g)) keys.add(m[1]);
  return keys;
}

/* EACH EMITTED KEY, WITH A CARD THAT MUST PASS AND ONE THAT MUST FAIL.
   A textual scan of `promptFilter` can only report that the key's NAME
   appears — so a test neutered to `if(false && spec.pitch != null)` still
   reads as "tested", and the sabotage for it came back SILENT. That is
   v3.62's rule: a sabotage that cannot express the bug proves nothing,
   and here the fault was the DRILL's. Driving the filter is what
   discriminates (v3.94, where four source-slice drills were rewritten to
   drive what they grepped). */
const DISCRIMINATORS = {
  type:       [{filter: {type: "attack"}},
               {name: "A", tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], power: 3},
               {name: "B", tt: "Generic Action", ty: ["Generic", "Action"]}],
  tt:         [{filter: {tt: "aura"}},
               {name: "A", tt: "Generic Token - Aura", ty: ["Generic", "Token", "Aura"]},
               {name: "B", tt: "Generic Action", ty: ["Generic", "Action"]}],
  ty:         [{filter: {ty: "wizard"}},
               {name: "A", tt: "Wizard Action", ty: ["Wizard", "Action"]},
               {name: "B", tt: "Generic Action", ty: ["Generic", "Action"]}],
  pitch:      [{filter: {pitch: 3}},
               {name: "A", pitch: 3, tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "B", pitch: 1, tt: "Generic Action", ty: ["Generic", "Action"]}],
  name:       [{filter: {name: "^Nimblism$"}},
               {name: "Nimblism", tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "Nimblism Adept", tt: "Generic Action", ty: ["Generic", "Action"]}],
  kw:         [{filter: {kw: "crush"}},
               {name: "A", tt: "Generic Action", ty: ["Generic", "Action"], kw: ["Crush"]},
               {name: "B", tt: "Generic Action", ty: ["Generic", "Action"], kw: []}],
  costLe:     [{filter: {costLe: 1}},
               {name: "A", cost: 1, tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "B", cost: 3, tt: "Generic Action", ty: ["Generic", "Action"]}],
  costGe:     [{filter: {costGe: 3}},
               {name: "A", cost: 3, tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "B", cost: 1, tt: "Generic Action", ty: ["Generic", "Action"]}],
  /* THE TWO THAT REFUSE EVERYTHING UNTIL THE QUEUE SITE RESOLVES THEM,
     and refusing is the whole point: an unresolved bound that fell
     through would ADMIT EVERY CARD (v3.20, v3.92). So the "passes" case
     is the RESOLVED form. */
  notSelf:    [{filter: {notSelf: true, notUid: "other"}},
               {name: "A", uid: "mine", tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "B", uid: "other", tt: "Generic Action", ty: ["Generic", "Action"]}],
  costLtDrac: [{filter: {costLe: 2}},          /* what the queue site turns it into */
               {name: "A", cost: 1, tt: "Generic Action", ty: ["Generic", "Action"]},
               {name: "B", cost: 5, tt: "Generic Action", ty: ["Generic", "Action"]}]
};

test("every filter key the pool emits is OBEYED by promptFilter", {skip}, () => {
  const PM = require("../engine/prompts.js");
  const emitted = emittedFilterKeys();
  const unnamed = [...emitted].filter(k => !DISCRIMINATORS[k]).sort();
  assert.deepEqual(unnamed, [],
    "a filter key with no discriminator here is a key nothing has been shown to " +
    "OBEY — and a key that simply falls through admits every card, which is the " +
    "sev-3 v2.29's refusals exist to prevent");

  for(const k of Object.keys(DISCRIMINATORS)){
    const [spec, yes, no] = DISCRIMINATORS[k];
    const f = PM.promptFilter(spec.filter);
    assert.equal(f(yes), true,  k + ": the matching card must pass");
    assert.equal(f(no), false, k + ": the near-miss must be REFUSED — a key that " +
      "is read and then not gated is indistinguishable from one nobody wrote");
  }
});

test("…and the two unresolved bounds refuse EVERYTHING", {skip}, () => {
  /* `notSelf` with no uid and `costLtDrac` still carrying its flag were
     never given what the queue site owes them. Falling through would
     offer the source itself (v3.20's Sigil eating itself) or every attack
     in hand (v3.92's Mounting Anger) — so both refuse, which is weaker
     than printed and VISIBLE. */
  const PM = require("../engine/prompts.js");
  const card = {name: "X", uid: "u1", cost: 0, tt: "Generic Action", ty: ["Generic", "Action"]};
  assert.equal(PM.promptFilter({notSelf: true})(card), false,
    "a notSelf filter with no uid refuses rather than offering the source");
  assert.equal(PM.promptFilter({costLtDrac: true})(card), false,
    "an unresolved Draconic bound refuses rather than admitting every card");
});

test("the emitted filter-key SET is pinned", {skip}, () => {
  assert.deepEqual([...emittedFilterKeys()].sort(),
    ["costGe", "costLe", "costLtDrac", "kw", "name", "notSelf", "pitch", "tt", "ty", "type"],
    "10 keys across the pool. An eleventh is fine — add it here AND give " +
    "promptFilter a test for it, which is the whole point of this file.");
});

/* ------------------------------------------------------------------
   2. THE WINDOW READERS
   ------------------------------------------------------------------ */

test("`windowsNow` is ONE body — v3.36's fix, still standing", {skip}, () => {
  assert.equal((JUDGE.match(/function windowsNow\(/g) || []).length, 1);
  assert.equal((JUDGE.match(/function playWindowFor\(/g) || []).length, 1);
  assert.equal((JUDGE.match(/function playableWhy\(/g) || []).length, 1);
});

test("…AND every ORIGINATING call names the half and the zone", {skip}, () => {
  /* ONE BODY IS NECESSARY AND NOT SUFFICIENT. A dropped `zone` or `half`
     in one caller reintroduces v3.36's divergence with the shared body
     intact — the play allowed in the instant window and then charged as
     an action, which is `NEGATIVE-AP` (CR 4.4.3e). v3.24: a guard that
     matches the CALL cannot see a dropped argument.

     THERE ARE TWO KINDS OF CALL AND ONLY ONE IS A DECISION.
     `playWindowFor` FORWARDS its own `half, zone` into `windowsNow`,
     which cannot diverge because it has nothing of its own to drop. The
     calls that decide are the ones made from a site holding `g` and a
     zone, and those must name `g._half, zone` — anything else is a
     caller answering the question differently from its twin. */
  const strip = m => m[1].replace(/\s+/g, " ").trim();
  const defs = /function (?:windowsNow|playWindowFor)\(([^)]*)\)/g;
  const defList = [...JUDGE.matchAll(defs)].map(strip);
  const defArgs = new Set(defList);
  assert.equal(defList.length, 2, "two readers");
  assert.equal(defArgs.size, 1,
    "…taking the SAME parameter list, or 'forwards unchanged' means nothing");

  const all = [...JUDGE.matchAll(/(?:windowsNow|playWindowFor)\(([^)]*)\)/g)].map(strip);
  const originating = all.filter(a => !defArgs.has(a));
  assert.equal(originating.length, 2,
    "exactly two sites DECIDE: `playableWhy` (is it legal) and `doPlay` " +
    "(which window, and therefore whether an action point is charged). " +
    "A third is fine — it must name the half and the zone too. Got: " +
    JSON.stringify(originating));
  for(const a of originating)
    assert.match(a, /g\._half, zone$/,
      "every deciding call must name the HALF and the ZONE: " + a);

  /* AND THE FORWARDING CALL MUST ACTUALLY FORWARD. Rewritten to pass a
     literal it would answer a different question from its own caller
     while looking like a pass-through. */
  assert.equal(all.filter(a => defArgs.has(a)).length, defList.length + 1,
    "the two definitions plus exactly one verbatim forward — `playWindowFor` " +
    "passing its own half and zone straight into `windowsNow`. Rewritten to " +
    "pass a literal it would answer a different question from its own caller " +
    "while still looking like a pass-through.");
});

test("…AND both derive `zone` identically", {skip}, () => {
  /* The two sites are ~950 lines apart and each computes its own. If they
     ever differ, the shared body is asked two different questions and the
     agreement it was built to guarantee is gone — invisibly. */
  const decls = (JUDGE.match(/const zone = [^;]+;/g) || []);
  assert.ok(decls.length >= 2, "both the legality and the play route derive a zone");
  assert.equal(new Set(decls).size, 1,
    "…and they must derive it the SAME way: " + [...new Set(decls)].join("  ||  "));
});

/* AND THE PROPERTY ITSELF, DRIVEN — because a source scan can only ever
   report that the text is there (v3.22, v3.28, v3.94). */
test("driven: a card legal in a window is charged for THAT window", {skip}, () => {
  const J = H.J;
  const inst = H.card("Frost Spike", 3);
  assert.ok(inst, "a real blue Instant out of Iyslander's list");
  const c = Object.assign({}, inst, {uid: "fs1"});
  let g = H.state({name: "Alice", hand: [c], res: 9, ap: 1},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", priority: 0,
                            builds: [{}, {}], passed: [], stack: []});
  const why = J.legal(g, {t: "play", uid: "fs1", from: "hand"}, 0);
  assert.equal(why, null, "an instant is legal in the action phase (CR 8.1.6)");
  const out = J.reduce(g, {t: "play", uid: "fs1", from: "hand"}, 0);
  assert.ok(!out.error, "…and it resolves: " + out.error);
  assert.ok(out.state.sides[0].ap >= 1,
    "CR 8.1.1 charges an ACTION, not an instant — a window widened in one " +
    "reader and not the other is exactly how this went to -1 at v3.36");
});

/* ------------------------------------------------------------------
   3. WHICH PARSER READERS DOES EACH BOARD ASK? (v3.99)

   The census that just paid twice by hand. `abCostWhy` was hoisted
   because judge's GEAR branch asked none of the three activation-cost
   legalities its HERO branch asks; and this census then found TWO more
   one-board rules:

     `costCtx`         judge threads the GAME's half of a cost into all
                       nine of its `effCost` calls (v3.96) and the trainer
                       threaded it into NONE — so Fai's hero-ability
                       discount, whose whole point is that the ability
                       costs 0 with Draconic links on the chain, was
                       quoted at full price on the board a player uses.
                       Stains of the Redback's mark discount too.

     `tapsToActivate`  `judge.legal` has refused a tapped hero's {t}
                       ability since v3.48 and the trainer never asked,
                       while `effects.execute` — SHARED — taps the hero on
                       both. Latent today (the trainer's dummy is 12
                       vanilla attacks and cannot tap you) and a printed
                       rule on one board, which is v3.01's shape.

   IT IS A LEAD LIST, NOT A FINDING LIST (v3.17). Most asymmetries are
   legitimate: the trainer renders a UI and judge is a reducer, so
   `norm`, `clean` and `instantAbilityReady` belong to one and
   `defCounts` and `splitCostsAP` to the other. What the drill pins is
   the SETS, so a reader crossing the line is a deliberate edit.
   ------------------------------------------------------------------ */

const TRAINER = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const stripSrc = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* A READER DESTRUCTURED INTO A LOCAL IS STILL ASKED. judge writes
   `const perTurnCleared = PR.perTurnCleared;` and the trainer writes
   `weaponCost = DawnParser.weaponCost,` — a scan for the qualified call
   alone reports BOTH boards as not asking, which is a false POSITIVE and
   is exactly what the first draft of this census produced. */
function asksReader(src, n){
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if(new RegExp("(?:PR|P|PM|DawnParser)\\." + esc(n) + "\\s*\\(", "g").test(src)) return true;
  const aliased = new RegExp("\\b" + esc(n) + "\\s*=\\s*(?:PR|P|DawnParser)\\." + esc(n) + "\\b").test(src)
    || new RegExp("\\{[^{}]*\\b" + esc(n) + "\\b[^{}]*\\}\\s*=\\s*(?:PR|P|DawnParser)\\b").test(src);
  return aliased && new RegExp("\\b" + esc(n) + "\\s*\\(", "g").test(src);
}

test("the one-board reader sets are pinned", {skip}, () => {
  const J = stripSrc(JUDGE), T = stripSrc(TRAINER);
  const names = Object.keys(P).filter(k => typeof P[k] === "function");
  const onlyJ = [], onlyT = [];
  for(const n of names){
    const j = asksReader(J, n), t = asksReader(T, n);
    if(j && !t) onlyJ.push(n); else if(t && !j) onlyT.push(n);
  }
  /* PROVE THE SCAN IS ALIVE FIRST — a scan aimed at the wrong shape finds
     nothing on both sides and reports every reader as one-board. */
  const both = names.filter(n => asksReader(J, n) && asksReader(T, n));
  assert.ok(both.length >= 20, "the scan sees only " + both.length +
    " shared readers — it is aimed at the wrong shape, not at a broken engine");
  for(const n of ["fxParse", "effCost", "hasKw"])
    assert.ok(both.includes(n), n + " is demonstrably asked by both boards");

  assert.deepEqual(onlyJ.sort(),
    ["auraAttackOf", "defCounts", "isAtkActionCard", "isDR",
     "printedKw", "splitCostsAP", "weaponCost"].sort(),
    "a reader judge asks and the trainer does not. TWO LEFT this list at " +
    "v3.99: `tapsToActivate` (the trainer now refuses a tapped hero) and " +
    "`costCtx` (it now threads the game's half of every cost). Adding one is " +
    "fine when the two boards genuinely have different jobs; say which here.");

  assert.deepEqual(onlyT.sort(),
    ["clean", "costsAP", "frostCount", "hasKwNow", "instantAbilityReady", "isArrow",
     "isAttack", "isInstantT", "isNonAtkActionCard", "isRx", "norm", "parseHeroPower",
     "runeCount", "rxAllowed"].sort(),
    "a reader the trainer asks and judge does not — mostly UI (`norm`, `clean`, " +
    "`instantAbilityReady`) or reached through types.js/effects.js on the other side.");
});

test("every trainer `effCost` call passes the game's half of the cost", {skip}, () => {
  /* v3.80's lesson, on the board that had it wrong: a cost read three ways
     at three sites is how a seat ends up owing resources. `costCtx` is the
     ONE reader of the game's half (v3.96) and judge already asks it at
     every site; the trainer asked it at NONE, so Fai's Draconic discount
     and Stains of the Redback's mark discount were both dropped there.

     THE DISPLAY SITES COUNT TOO. A number shown to the player that
     differs from the number charged is the sev-2 category the player
     TRUSTS. */
  const calls = [...stripSrc(TRAINER).matchAll(/[^.\w]effCost\(([^;]{0,160})/g)]
    .map(m => m[1].split("\n")[0]);
  assert.ok(calls.length >= 6, "the trainer reads effCost in several places");
  const bare = calls.filter(a => !/costCtx\(/.test(a));
  assert.deepEqual(bare, [],
    "every effCost call must name the cost context, or the two boards quote " +
    "different prices for the same card");
});

test("the {t} lives on the HERO's printed line, never on the powCard", {skip}, () => {
  /* THIS IS WHY THE ARGUMENT MATTERS, and it is driveable where the
     trainer's `tryPlay` is not. `build.js` strips the cost prefix off the
     ability when it builds HPOW, so the `{t}` the refusal asks about
     lives in the half that was REMOVED — `tapsToActivate(HPOW.tx)` is
     false for every hero in the pool. A refusal reading the powCard is
     therefore DEAD CODE that reads like a rule (v3.67, v3.77), and the
     sabotage for it is silent against any drill that only greps the
     function name. */
  const B = require("../engine/build.js");
  const G = require("../engine/game.js");
  const RNG = require("../engine/rng.js");
  const {loadData} = require("./helpers/extract.js");
  const W = loadData();
  const tapping = [];
  for(const hero of W.HEROES){
    const b = B.buildSide(hero, G.parseDeck(W.DECKS[hero.k]), H.db(), {},
                          RNG.make("tap-" + hero.k), {n: 0}).b;
    if(!b.HPOW) continue;
    const onHero = P.tapsToActivate((b.heroRec || {}).tx || "");
    const onPow  = P.tapsToActivate(b.HPOW.tx || "");
    assert.equal(onPow, false,
      hero.k + ": the powCard's text can NEVER answer this — the cost prefix is gone");
    if(onHero) tapping.push(hero.k);
  }
  /* v3.48 measured THREE of fifteen. The count is pinned so "nobody taps"
     cannot pass for "the reader works". */
  assert.deepEqual(tapping.sort(), ["bravo", "gravy", "lyath"],
    "three heroes print a {t} in their activation cost (v3.48). A fourth is a " +
    "deliberate edit — and if this ever goes empty the drill above is asserting " +
    "nothing at all.");
});

test("the trainer's tapped-hero refusal is a real guard, not a dead one", {skip}, () => {
  /* A SOURCE SLICE, AND THE WEAK HALF SAID PLAINLY. `tryPlay` lives in a
     `text/babel` block so no drill can require it; the judge-side twin IS
     driven (test/cloaked.test.js and judge's own drills). What a slice can
     do is pin the SHAPE precisely enough that neutering the guard breaks
     it — the condition itself, not merely the reader's name, because
     `if(false && …)` keeps every name intact (v3.62: a sabotage that
     cannot express the bug proves nothing, and here the fault was the
     drill's). */
  assert.match(TRAINER, /if\(from === "hero" && act\(s\)\.heroTapped\s*\n?\s*&& DawnParser\.tapsToActivate\(\(\(bAct\(s\)\.heroRec\)\|\|\{\}\)\.tx \|\| ""\)\)/,
    "the trainer must refuse a tapped hero, reading the HERO's printed line — " +
    "the powCard's is stripped of the cost prefix and answers false for everyone");
});
