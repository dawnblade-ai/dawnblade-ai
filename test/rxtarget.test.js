/* ============================================================
   DOES THIS ATTACK REACTION HAVE A LEGAL TARGET? — ONE READER (v4.88)

   A printed target is a LEGALITY, refused before the card leaves the
   hand or the ability's cost is paid (v3.11). Four sites asked it and
   each asked a different piece:

     attackRx            selfQ, then the MODES — after the card had moved
     judge.legal (card)  selfQ alone, without the link's `pumped`/`atk`
     judge (ability)     selfQ || gaQ, with both
     the trainer         selfQ alone; an ABILITY not at all

   So at BOTH boards Pummel (modal — its restrictions ride on `fx.modes`)
   played into an attack neither mode names left the hand, paid 2 and did
   nothing, and Run Through ("target SWORD attack gets go again", on
   `gaQ` alone) was legal against any attack and queued its "next sword
   attack" +3 off a target it never had.

   `effects.rxNoTargetWhy(game, card)` is the one reader. Its answers are
   DRIVEN here; that every door asks it is a source census, because the
   trainer's doors are closures inside `Battle`.

   AND THE FIXTURE THAT HID IT WAS A DRILL. `sparring.test.js` used Two
   Sides to the Blade as "a reaction with no target restriction" against
   a plain Generic attack — valid only while the modes went unread.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* a link whose attack is `atk`, and nothing else about the game */
const linkOf = (atk, extra) => ({pend: Object.assign({card: {...atk, uid: "a1"}, by: 0, total: atk.power || 0,
                                                       ga: false, ops: [], onHit: []}, extra || {}),
                                 stack: []});

test("a MODAL card has a target when any mode it can read matches — and none when no mode does", {skip}, () => {
  H.db();
  const pummel = H.card("Pummel", 1);
  /* mode 2: attack action card with cost 2 or more */
  assert.equal(E.rxNoTargetWhy(linkOf(H.card("Raging Onslaught", 1)), pummel), null);
  /* mode 1: a hammer weapon attack */
  assert.equal(E.rxNoTargetWhy(linkOf(H.card("Sledge of Anvilheim", 0)), pummel), null);
  /* NEITHER — cost 0, no weapon. `selfQ` is empty on a modal card, which
     is exactly why the old test answered "legal" here. */
  const blow = H.card("Wounding Blow", 3);
  assert.ok(blow.cost < 2, "the control must actually fail mode 2");
  assert.equal(P.fxParse(pummel).selfQ, undefined, "premise: the restriction is NOT on selfQ");
  assert.match(String(E.rxNoTargetWhy(linkOf(blow), pummel)), /^Pummel: no mode of it can target Wounding Blow$/);
});

test("a GO-AGAIN-ONLY target is a target — Run Through names a sword", {skip}, () => {
  H.db();
  const rt = H.card("Run Through", 1);
  const fx = P.fxParse(rt);
  assert.ok(!fx.selfQ && fx.gaQ, "premise: its only restriction is gaQ");
  assert.equal(E.rxNoTargetWhy(linkOf(H.card("Dawnblade", 0)), rt), null, "a sword is a legal target");
  assert.match(String(E.rxNoTargetWhy(linkOf(H.card("Raging Onslaught", 1)), rt)),
    /^Run Through targets a sword attack — Raging Onslaught isn't one$/);
});

test("an UNRESTRICTED reaction always has one, and a restricted one with no link has none", {skip}, () => {
  H.db();
  const ne = H.card("Night's Embrace", 3);
  const fx = P.fxParse(ne);
  assert.ok(!fx.selfQ && !fx.gaQ && !(fx.modes || []).length, "premise: Night's Embrace names no target");
  assert.equal(E.rxNoTargetWhy(linkOf(H.card("Raging Onslaught", 1)), ne), null);
  assert.equal(E.rxNoTargetWhy({pend: null, stack: []}, ne), null);
  /* the restricted ones answer "this attack" rather than throwing */
  assert.match(String(E.rxNoTargetWhy({pend: null, stack: []}, H.card("Pummel", 1))), /this attack$/);
  assert.match(String(E.rxNoTargetWhy({pend: null, stack: []}, H.card("Run Through", 1))), /this attack isn't one$/);
});

test("`pumped` is answered off the LINK, the same way for every asker", {skip}, () => {
  H.db();
  /* SYNTHETIC (v3.73): no pool attack reaction CARD prints the pumped
     qualifier — Bolt'n Boots is an equipment ability. The atom is a fact
     about the link, and an asker that forgot it answered NO. */
  const rx = {name: "Synthetic Pumped Reaction", tt: "Generic Attack Reaction",
              ty: ["Generic", "Attack Reaction"], pitch: 1, cost: 0, kw: [],
              tx: "Target attack with {p} greater than its base gets +1{p}."};
  P.fxReset && P.fxReset();
  assert.ok(P.fxParse(rx).selfQ, "premise: the synthetic parses a qualifier");
  const atk = H.card("Raging Onslaught", 1);
  assert.match(String(E.rxNoTargetWhy(linkOf(atk), rx)), /isn't one$/, "at its base it is not pumped");
  assert.equal(E.rxNoTargetWhy(linkOf(atk, {total: atk.power + 2}), rx), null, "above its base it is");
  P.fxReset && P.fxReset();
});

/* ---- DRIVEN AT THE TABLE ---------------------------------------------- */

function reacting(handCards, atkName, pitch){
  const atk = {...H.card(atkName, pitch == null ? 1 : pitch), uid: "atk1"};
  const hand = handCards.map((c, i) => ({...c, uid: "h" + i}));
  let g = {...H.state({hand: [atk, ...hand], res: 9}, {}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [],
           firstPlayer: 0, round: 1, over: null};
  g = J.reduce(g, {t: "play", uid: "atk1", from: "hand"}, 0).state;
  for(let i = 0; i < 8 && g.step !== "reaction"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break;
    g = o.state;
  }
  return g;
}

test("the TABLE refuses Pummel with no legal mode BEFORE it leaves the hand", {skip}, () => {
  H.db();
  const g = reacting([H.card("Pummel", 1)], "Wounding Blow", 3);
  assert.equal(g.step, "reaction", "standing in the right window");
  const res0 = g.sides[0].res;
  const out = J.reduce(g, {t: "play", uid: "h0", from: "hand"}, 0);
  assert.match(String(out.error), /no mode of it can target Wounding Blow/,
    "it was LEGAL: the card left the hand, paid 2, and did nothing");
  /* `reduce` never mutates on refusal — the card is still there to play */
  assert.deepEqual(g.sides[0].hand.map(c => c.name), ["Pummel"]);
  assert.equal(g.sides[0].res, res0);
  /* the positive control, same window: a cost-3 attack action card */
  const ok = reacting([H.card("Pummel", 1)], "Raging Onslaught", 1);
  assert.equal(J.legal(ok, {t: "play", uid: "h0", from: "hand"}, 0), null);
});

test("the TABLE refuses Run Through off a non-sword attack", {skip}, () => {
  H.db();
  const g = reacting([H.card("Run Through", 1)], "Raging Onslaught", 1);
  assert.match(String(J.legal(g, {t: "play", uid: "h0", from: "hand"}, 0)),
    /Run Through targets a sword attack — Raging Onslaught isn't one/);
});

/* ---- EVERY ASKER ASKS THE ONE READER ------------------------------------ */

const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const JUDGE = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
const EFX = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");

test("no board hand-rolls the target question any more", () => {
  for(const [nm, src] of [["index.html", HTML], ["judge.js", JUDGE]]){
    const code = strip(src);
    assert.doesNotMatch(code, /qualMatches\(\s*(?:fx|PR\.fxParse\([a-z]+\))\.(?:selfQ|gaQ)/,
      nm + " asks a reaction's target qualifier itself — a second reader drifts (v4.88)");
  }
  /* inside effects.js only the reader and attackRx's MODE SELECTION may */
  const e = strip(EFX);
  const hits = (e.match(/qualMatches\(\s*(?:fx\.selfQ|md\.q|q)\b/g) || []).length;
  assert.ok(hits >= 1, "the reader moved — re-anchor this census");
});

test("judge asks it for a CARD and for an ABILITY", () => {
  const code = strip(JUDGE);
  assert.equal((code.match(/E\.rxNoTargetWhy\(g, (?:c|ab)\)/g) || []).length, 2,
    "the card route in `legal` and `rxTargetWhy`'s qualifier half");
});

test("the trainer asks it at all three doors, before anything moves", () => {
  const code = strip(HTML);
  /* the hand door, attack window */
  assert.match(code, /if\(inAtk\)\{ const _tw = DawnEffects\.rxNoTargetWhy\(s, c\); if\(_tw\) return L\(s, _tw \+ "\."\); \}/);
  /* the arsenal door's attack window (new at v4.88) */
  const a = code.indexOf("const playRxA = () => setG"), b = code.indexOf("\n  const ", a + 10);
  const rxa = code.slice(a, b);
  const stk = rxa.indexOf('if(s.mode === "stack" && act(s).arsenal){');
  assert.ok(stk > 0, "the attacker's arsenal door is gone — an arsenal attack reaction is dead again");
  const tw = rxa.indexOf("DawnEffects.rxNoTargetWhy(s, c)", stk);
  const mv = rxa.indexOf("ars.arsenal = null;", stk);
  assert.ok(tw > stk && mv > tw, "the target must be asked BEFORE the card leaves the arsenal");
  /* the whole statement, opening paren included — a bare call survives
     `false &&` (v4.00, v4.55) */
  assert.match(rxa.slice(stk), /\n\s*if\(!rxAllowed\(c, "attack-reaction"\)\) return L\(s, isRx\(c\)/,
    "and the window's card half is asked, refusing by name");
  /* the ability route in tryPlay */
  assert.match(code, /if\(card\._attackRx\)\{ const _tw = DawnEffects\.rxNoTargetWhy\(s, card\); if\(_tw\) return L\(s, _tw \+ "\."\); \}/,
    "an attack-reaction ABILITY pays its cost with no legal target");
});

test("a refusal `attackRx` answers is returned on the state BEFORE the card moved", () => {
  const code = strip(HTML);
  const a = code.indexOf("const playRx = (i, addPaid) => setG"), b = code.indexOf("const playRxA = () => setG");
  const rx = code.slice(a, b);
  assert.match(rx, /if\(rx\.why\) return L\(s, rx\.why\);/, "the hand door spent the card on a refusal");
  assert.doesNotMatch(rx, /if\(rx\.why\) return L\(n,/, "…returned on `n`, after the card left the hand");
  const c = code.indexOf("const playRxA = () => setG"), d = code.indexOf("\n  const ", c + 10);
  assert.match(code.slice(c, d), /if\(rx\.why\) return L\(s, rx\.why\);/, "and the arsenal door the same");
});

test("the arsenal tile routes the reaction window to that door", () => {
  const code = strip(HTML);
  assert.match(code, /g\.inspect\?setZoom\(you\(g\)\.arsenal\) : g\.mode==="stack" \? playRxA\(\) : tryPlay\(you\(g\)\.arsenal,"arsenal",0\)/,
    "in `stack` the arsenal tile falls through to tryPlay, which refuses a reaction");
});
