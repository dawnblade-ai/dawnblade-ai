/* ============================================================
   AN ACTIVATED ABILITY'S TARGET IS DECLARED WHEN IT IS ACTIVATED (v5.72)

   `activation-choices-at-resolution` (stated since v4.71) is CLOSED here.
   The target of an ACTIVATED ability — and, for Beckoning Haunt, the X its
   target settles — used to be chosen when the ability RESOLVED, through the
   pick sheet its payload queues. Since v4.66 an Action-speed activation rests
   on the stack, so the other seat answered it without knowing what it was
   aimed at, and the controller chose after seeing that answer.

   WHAT THE CR IS HELD TO (read verbatim at rules.fabtcg.com, 2026-11-06).
   CR 5.2.2b: activating follows "steps [5.1.3]-[5.1.10]" of playing a card;
   CR 5.1.4a: "…the player must declare all legal targets for those
   effects.[1.8.5]"; CR 1.8.5: the target parameters "are declared as the
   layer … is put onto the stack." At resolution, CR 1.8.9: "An effect fails
   if (A) it is a targeted effect and all declared target(s) are no longer
   legal or have ceased to exist…", and CR 5.3.4b: "If an effect fails, any
   remaining effects continue to be generated." The drills below hold both.

   WHAT THIS FILE HOLDS THE BUILD TO:
     - the question opens at ACTIVATION, before anything is paid and before
       any window; the declaration rides the stack layer (`decl`, its label)
       so the other seat answers KNOWING the target
     - the resolution uses exactly the declared card
     - a target no longer legal at resolution FIZZLES, in the feed, with the
       price paid and not refunded
     - X is declared with the target and is the X paid and used
     - the policy declares through a judge reader: total, deterministic, legal
     - a refusal is a refusal (wrong card, no question, the other seat), and
       a cancel withdraws it before anything is paid
     - the census: which activated abilities print a target, at which speed
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;
const SP = require("../engine/sparring.js");

const skip = !H.hasDb() && "no cached card database";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});
const feed = n => (n.log || []).map(l => l.t || l).join("\n");

const GRAVE = () => [c("Pyroglyphic Protection", 1, "pp"),      /* cost 2 */
                     c("Waning Vengeance", 1, "wv"),             /* cost 1 */
                     c("Malefic Incantation", 1, "mi")];         /* cost 0 */
/* Seat 0 holds Beckoning Haunt in its action phase. `foe` is what the other
   seat holds: an Oasis Respite is an instant, so it OPENS the window. */
function table(res, foe, grave){
  H.db();
  const haunt = c("Beckoning Haunt", 0, 41); B.equipPiece(haunt);
  return {...H.state({res, ap: 1, gear: [haunt], hand: [], grave: grave || GRAVE()},
                     {res: 9, hand: foe === false ? [] : [c("Oasis Respite", 1, "oas")]},
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const activate = g => J.reduce(g, {t: "activate", uid: 41, from: "gear"}, 0).state;
const declare = (g, uid) => { const r = J.reduce(g, {t: "abtarget", uid}, 0); assert.ok(!r.error, String(r.error)); return r.state; };
const layerOf = n => (n.stack || []).find(l => l && l.k === "play");
/* both seats pass on the top layer — it resolves */
const resolve = n => { let g = n; for(const s of [0, 1]) if(layerOf(g)) g = J.reduce(g, {t: "pass"}, g.priority).state; return H.drain(g); };

/* ---- 1. DECLARED BEFORE THE OTHER SEAT'S WINDOW ---------------------------- */

test("the target is asked for AT ACTIVATION — before the cost, before any layer, before any sheet", {skip}, () => {
  const n = activate(table(5));
  assert.equal(n.pending && n.pending.kind, "abtarget", "no target question opened at activation");
  assert.deepEqual([...n.pending.uids].sort(), ["mi", "pp", "wv"]);
  assert.equal(layerOf(n), undefined, "the ability reached the stack before its target was named");
  assert.ok(!n.prompt, "a sheet opened at activation — the pick belongs to the declaration now");
  assert.ok(!H.filed(n.sides[0], 41), "the piece was destroyed before the target was declared");
  assert.equal(n.sides[0].res, 5, "a cost was paid before the target was declared");
});

test("the declaration rides the stack layer — the other seat answers KNOWING the target", {skip}, () => {
  let n = declare(activate(table(5)), "wv");
  const L = layerOf(n);
  assert.ok(L, "the activation was not held for the other seat's window");
  assert.deepEqual(L.decl._actTarget, {uid: "wv", name: "Waning Vengeance"}, "the layer does not carry the declared target");
  assert.equal(L.decl._x, 1, "the layer does not carry the X the target settled");
  assert.match(L.label, /Waning Vengeance/, "the stack row does not say what the ability is aimed at");
  assert.ok(!n.prompt && !n.pending, "a question is still open — the choice was not fully declared");
  /* …and at the moment the OTHER seat holds priority the layer is still there with it */
  n = J.reduce(n, {t: "pass"}, 0).state;
  assert.equal(n.priority, 1, "fixture: the other seat holds priority");
  assert.equal(layerOf(n).decl._actTarget.uid, "wv", "the foe's window does not see the declared target");
  /* the state itself carries no stray declaration while the layer waits */
  assert.equal(n._actTarget, undefined);
  assert.equal(n._x, undefined);
});

test("the resolution uses EXACTLY the declared card — never a better one", {skip}, () => {
  /* three legal targets; the policy would take another one first (lowest uid
     of equal power is "mi"), so only a resolution that honours the
     declaration returns the card the player named */
  const n = resolve(declare(activate(table(5)), "pp"));
  assert.ok(n.sides[0].hand.some(x => x.uid === "pp"), "the declared aura did not return");
  assert.ok(!n.sides[0].hand.some(x => x.uid === "mi" || x.uid === "wv"), "an aura nobody declared returned too");
  assert.ok(n.sides[0].grave.some(x => x.uid === "mi") && n.sides[0].grave.some(x => x.uid === "wv"),
    "the other candidates left the graveyard");
  assert.ok(!n.prompt && !n.pending, "a sheet opened at resolution — the choice was already declared");
});

/* ---- 2. A TARGET THAT IS NO LONGER LEGAL FIZZLES --------------------------- */

test("a target gone by resolution FIZZLES — said in the feed, the price stays paid", {skip}, () => {
  let n = declare(activate(table(5)), "wv");
  assert.ok(layerOf(n), "fixture: the ability waits on the stack");
  /* an instant-speed answer takes it from the graveyard while the layer waits */
  n = J.put(n, 0, s => ({...s, grave: s.grave.filter(x => x.uid !== "wv")}));
  const r = resolve(n);
  assert.ok(!r.sides[0].hand.some(x => x.uid === "wv"), "a card that left the graveyard still came back");
  assert.ok(!r.sides[0].hand.length, "the ability returned something else instead");
  assert.match(feed(r), /Waning Vengeance is no longer a legal target — the ability fizzles/, "the fizzle is not said");
  assert.ok(H.filed(r.sides[0], 41), "the price (destroy this) was refunded on a fizzle");
  assert.equal(r.sides[0].res, 2, "the resources were refunded on a fizzle: 5 - 1 - 2 X");
  assert.ok(!r.prompt && !r.pending);
});

test("…and the fizzle is not a free pass for a CRAFTED declaration (a card that is not a target)", {skip}, () => {
  /* a state off a wire naming a card that was never in the pool */
  const g = {...table(9, false), _actTarget: {uid: "zz", name: "Nothing"}, _x: 0};
  const r = H.drain(J.reduce(g, {t: "activate", uid: 41, from: "gear"}, 0).state);
  assert.ok(!r.sides[0].hand.length, "an undeclared card was returned");
  assert.match(feed(r), /fizzles/);
});

/* ---- 3. X IS DECLARED WITH THE TARGET, AND IS THE X PAID AND USED ---------- */

test("X declared at activation IS the X paid and the X used", {skip}, () => {
  const n = declare(activate(table(9)), "pp");           /* cost 2 -> X = 2 */
  assert.equal(layerOf(n).decl._x, 2, "the declared X is not the target's cost");
  const r = resolve(n);
  assert.ok(r.sides[0].hand.some(x => x.uid === "pp"), "the aura at cost X did not return");
  assert.equal(r.sides[0].res, 9 - 1 - 2 * 2, "X = 2 is paid twice, past the fixed {r}");
  assert.equal(r._x, undefined, "the declared X outlived the activation");
  assert.equal(r._actTarget, undefined, "the declared target outlived the activation");
  /* the other target, the same seat: X = 1 pays 1 + 2 */
  const r1 = resolve(declare(activate(table(9)), "wv"));
  assert.equal(r1.sides[0].res, 9 - 1 - 2 * 1);
  const r0 = resolve(declare(activate(table(9)), "mi"));
  assert.equal(r0.sides[0].res, 9 - 1, "X = 0 costs nothing past the fixed {r}");
});

test("the price is read off the declaration: `effCost` takes X per pip, and a pick bound ignores it", {skip}, () => {
  H.db();
  const haunt = c("Beckoning Haunt", 0, 41); B.equipPiece(haunt);
  const ab = haunt.powCard, sd = H.state({res: 9}, {}, {turn: 3, actor: 0}).sides[0];
  assert.equal(P.effCost(ab, sd, {}), 1, "an undeclared X priced something");
  assert.equal(P.effCost(ab, sd, {x: 2}), 1 + 2 * 2, "X = 2 over two {x} pips is 4 past the {r}");
  /* the BOUND is asked before X exists and must not double-count a declared one */
  const free = P.abPickBound(sd, ab, {}).filter.costLe;
  assert.equal(P.abPickBound(sd, ab, {x: 2}).filter.costLe, free,
    "the pick bound changed with a declared X — the fixed part is what it subtracts");
  assert.equal(free, Math.floor((9 - 1) / 2));
});

/* ---- 4. THE POLICY DECLARES — THROUGH A JUDGE READER ----------------------- */

test("the AI declares through `judge.abTargetAnswer`: legal, deterministic, total", {skip}, () => {
  const n = activate(table(9));
  assert.equal(n.pending.kind, "abtarget");
  const a1 = SP.act(n, 0), a2 = SP.act(n, 0);
  assert.deepEqual(a1, a2, "the policy answered differently on the same state");
  assert.equal(a1.t, "abtarget");
  assert.equal(J.legal(n, a1, 0), null, "the policy's declaration was refused — a refusal is a policy bug");
  assert.equal(a1.uid, J.abTargetAnswer(n), "the policy did not ask the judge's reader");
  /* all three auras have no printed power: the lowest uid wins the tie */
  assert.equal(a1.uid, "mi");
  assert.equal(SP.explain(n, 0).why && SP.explain(n, 0).why.key || SP.explain(n, 0).key, "abtarget", "the call has no reason key");
  assert.ok(SP.CALL_WHY.abtarget && !/\b(uid|pending|_actTarget)\b/.test(SP.CALL_WHY.abtarget), "the reason reads like a coach");
  /* the only other seat has nothing to say about it */
  assert.equal(SP.act(n, 1), null, "the seat that was not asked answered the question");
});

test("a power on the candidate outranks the uid — the order the sheet used", {skip}, () => {
  const g = table(9, true, [{...c("Waning Vengeance", 1, "z9"), power: 3}, c("Malefic Incantation", 1, "a1")]);
  const n = activate(g);
  assert.equal(J.abTargetAnswer(n), "z9", "highest power first");
  const g2 = table(9, true, [c("Waning Vengeance", 1, "b2"), c("Malefic Incantation", 1, "a1")]);
  assert.equal(J.abTargetAnswer(activate(g2)), "a1", "equal power: the lowest uid, never the iteration order");
});

test("a whole activation DRIVEN BY THE POLICY ends with the declared aura in hand and no refusal", {skip}, () => {
  let n = activate(table(9));
  const seen = [];
  for(let i = 0; i < 12 && (n.pending || n.prompt || layerOf(n)); i++){
    const seat = n.pending ? n.pending.seat : n.prompt ? (n.prompt.side || 0) : n.priority;
    const a = SP.act(n, seat);
    assert.ok(a, "the policy had no answer at step " + i);
    assert.equal(J.legal(n, a, seat), null, "the policy proposed a refused action: " + JSON.stringify(a));
    seen.push(a.t);
    n = J.reduce(n, a, seat).state;
  }
  assert.ok(seen.includes("abtarget"), "the policy never declared: " + seen);
  assert.ok(n.sides[0].hand.some(x => x.uid === "mi"), "the declared aura did not return");
});

test("an INSTANT-speed activation that declares leaves nothing on the state (no layer to strip it)", {skip}, () => {
  /* the pool has none, so the fixture grants Haunt's piece instant speed: it
     resolves on the spot, never rides a layer, and only the door's own strip
     stands between its declaration and the NEXT activation */
  const g = table(9, false);
  g.sides[0].gear[0].powCard._instant = true;
  assert.equal(P.abWindow(g.sides[0].gear[0].powCard), "instant", "fixture: the ability is not instant");
  const n = H.drain(declare(activate(g), "pp"));
  assert.ok(n.sides[0].hand.some(x => x.uid === "pp"), "fixture: the ability did not resolve on the spot");
  assert.equal(layerOf(n), undefined, "fixture: an instant rode a layer");
  assert.equal(n._actTarget, undefined, "an instant activation left its declared target on the state");
  assert.equal(n._x, undefined, "an instant activation left its declared X on the state");
});

/* ---- 5. REFUSALS, AND THE WAY OUT ------------------------------------------ */

test("a wrong card, a missing question and the wrong seat are all REFUSED", {skip}, () => {
  const n = activate(table(3));                      /* pp costs 2: not payable */
  assert.match(String(J.legal(n, {t: "abtarget", uid: "pp"}, 0)), /not a legal target/);
  assert.match(String(J.legal(n, {t: "abtarget", uid: "nope"}, 0)), /not a legal target/);
  assert.match(String(J.legal(n, {t: "abtarget", uid: "wv"}, 1)), /./, "the other seat answered the question");
  assert.match(String(J.legal(n, {t: "pass"}, 0)), /declare the target of Beckoning Haunt first/,
    "the question can be walked past");
  assert.match(String(J.legal(table(5), {t: "abtarget", uid: "wv"}, 0)), /nothing is asking for a target/);
  /* the wire carries nothing a peer cannot read: the pending is plain data */
  assert.deepEqual(JSON.parse(JSON.stringify(n.pending)), n.pending);
});

test("Cancel withdraws the declaration while nothing is paid", {skip}, () => {
  const n = activate(table(5));
  assert.equal(J.legal(n, {t: "payCancel"}, 0), null, "the player cannot back out of a target question");
  const r = J.reduce(n, {t: "payCancel"}, 0).state;
  assert.ok(!r.pending, "the question is still open");
  assert.ok(!H.filed(r.sides[0], 41), "the piece was destroyed by a cancelled activation");
  assert.equal(r.sides[0].res, 5, "something was paid for a cancelled activation");
  assert.equal(r._actTarget, undefined);
  assert.equal(layerOf(r), undefined);
  /* and the same activation can be asked for again */
  assert.equal(activate(r).pending.kind, "abtarget");
});

/* ---- 6. THE CENSUS: WHICH ACTIVATIONS DECLARE A TARGET --------------------- */

test("the census — Beckoning Haunt is the pool's one Action-speed activation that prints a target", {skip}, () => {
  const S = require("../tools/selfplay.js");
  const found = new Map();                           /* name -> {window, declares} */
  const add = (pc) => {
    if(!pc || !/\btarget\b/i.test(pc.tx || "")) return;
    found.set(pc.name, {window: P.abWindow(pc), declares: !!P.abTargetSpec(pc)});
  };
  for(const h of S.W.HEROES){
    const g = S.match(h.k, "briar", 1, 0);
    add(g.builds[0].HPOW);
    for(const x of g.sides[0].gear || []) if(x && x.powCard) add(x.powCard);
    for(const x of [...(g.sides[0].deck || []), ...(g.sides[0].hand || [])]){
      const bp = x && B.boardPow({card: x, kind: "aura"});
      if(bp) add(bp);
    }
  }
  const got = Object.fromEntries([...found].sort().map(([k, v]) => [k, v.window + (v.declares ? " DECLARES" : "")]));
  /* SIX (Reaper's Call, a hand ability that marks the opposing hero, is a
     seventh by text and is not a powCard: `activateHandAbility`). Five
     resolve on the spot at either board (an instant or a reaction —
     `instant-speed-plays-resolve-on-play`, a window that does not exist), and
     their targets are not a pick: the attack in flight, the opposing hero, or
     Danger Digits' dagger (`jabTargets`). Only Haunt rests on the stack AND
     chooses among cards, so only Haunt declares through `abtarget`. */
  assert.deepEqual(got, {
    "Beckoning Haunt — ability": "action DECLARES",
    "Bolt'n Boots — ability": "attack-reaction",
    "Boltyn — hero power": "attack-reaction",
    "Concealed Object — ability": "instant",
    "Danger Digits — ability": "attack-reaction",
    "Prey Spotters — ability": "attack-reaction",
  }, "a new activation that prints a target: decide its speed and whether it declares, and pin it here");
});

test("a pick that prints NO target is a choice, made as the ability resolves", {skip}, () => {
  H.db();
  /* Halo, the Hood and Dichotomy print "put a card from your hand…" / "return…
     from your graveyard" with no target; Fai and Blaze likewise */
  const S = require("../tools/selfplay.js");
  for(const k of ["fai", "blaze"])
    assert.equal(P.abTargetSpec(S.match(k, "briar", 1, 0).builds[0].HPOW), null, k + "'s hero power declares a target it does not print");
  for(const nm of ["Halo of Illumination", "Hope Merchant's Hood", "Crown of Dichotomy"]){
    const g = c(nm, 0, 7); B.equipPiece(g);
    assert.ok(g.powCard, nm + " has no ability");
    assert.ok(P.abPickSpec(g.powCard), nm + " opens no pick — fixture");
    assert.equal(P.abTargetSpec(g.powCard), null, nm + " is read as declaring a target it does not print");
  }
  const haunt = c("Beckoning Haunt", 0, 41); B.equipPiece(haunt);
  assert.ok(P.abTargetSpec(haunt.powCard).tgt && P.abTargetSpec(haunt.powCard).xOf === "cost");
});

/* ---- 7. THE TRAINER DECLARES TOO (the page itself is driven in the harness) - */

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
const slice = (a, b) => strip(HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a))));

test("both trainer doors ask the question before the payment, and the answer re-enters the door", () => {
  const ask = HTML.slice(HTML.indexOf("const askAbTarget = (s, card, from, idx, redo)"), HTML.indexOf("const activateInstant ="));
  assert.ok(ask.length > 200, "askAbTarget moved — re-anchor this drill");
  assert.match(ask, /DawnParser\.abTargetSpec\(card\)/, "the trainer does not ask the parser which pick is a printed target");
  assert.match(ask, /DawnParser\.abPickBound\(sd, card, costCtx\(s, actorOf\(s\)\)\)/, "a pool the legality does not ask");
  assert.match(ask, /mode:"targetpick"/);
  const inst = slice("const activateInstant =", "const activateIfOk") || slice("const activateInstant =", "const handAbilityOK");
  assert.match(inst, /askAbTarget\(s, card, from, idx, "instant"\)/, "the instant door never asks");
  assert.ok(inst.indexOf("askAbTarget(") < inst.indexOf("const cost = effCost("), "the instant door asks AFTER the payment");
  const tp = slice("const tryPlay = (card,from,idx,half)", "const confirmPay = () => setG");
  assert.match(tp, /askAbTarget\(s, card, from, idx\)/, "the action door never asks");
  assert.ok(tp.indexOf("askAbTarget(") < tp.indexOf("const cost = payCost(s, card, from)"), "the action door asks AFTER the payment");
  const conf = slice("const confirmAbTarget = uid =>", "const cancelAbTarget = () =>");
  assert.match(conf, /_actTarget:\{uid:c\.uid, name:c\.name\}/, "the answer does not ride on the state");
  assert.match(conf, /pk\.x \? \{_x: c\.cost \|\| 0\}/, "X is not declared with the target");
  assert.match(conf, /tryPlay\(pk\.card, pk\.from, pk\.idx\)/);
  assert.match(conf, /activateInstant\(pk\.card, pk\.from, pk\.idx\)/);
  assert.match(strip(HTML), /delete n\._actTarget; return n; \}\);/, "a cancelled payment keeps the declaration");
  assert.match(strip(HTML), /if\(n\._actTarget !== undefined\)\{ n = \{\.\.\.n\}; delete n\._actTarget; \}/, "the resolved ability keeps its declaration");
});

test("the table renders the question: one button per target and a Cancel", () => {
  assert.match(strip(HTML), /const abtarget = kindIs\("abtarget"\);/);
  assert.match(strip(HTML), /fire\(\{t:"abtarget",uid:u\}\)/);
  assert.match(strip(HTML), /fire\(\{t:"payCancel"\}\)\}>Cancel<\/button>\s*<\/>\s*: xval/);
});

test("the shared parts are one copy: the parser marks the target, effects narrows the pick, prompts names the filter", () => {
  const eff = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8"));
  assert.match(eff, /onlyUid: dt \? dt\.uid : -1/);
  assert.match(eff, /costLe: n\._x \|\| 0, costGe: n\._x \|\| 0/, "the narrowed pick does not hold the declared X");
  assert.match(eff, /delete spec\.tgt; delete spec\.xOf;/, "a parse field travels into the spec");
  assert.doesNotMatch(eff, /xPay/, "the X-settling field is still read");
  const pr = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "prompts.js"), "utf8"));
  assert.match(pr, /spec\.onlyUid != null && c\.uid !== spec\.onlyUid/);
  assert.doesNotMatch(pr, /spec\.xPay/);
});
