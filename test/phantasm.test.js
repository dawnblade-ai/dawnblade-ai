/* test/phantasm.test.js — PHANTASM ASKED FOR THE SIX AND DROPPED THE
 * TWO PRINTED RESTRICTIONS BESIDE IT (v4.31)
 *
 * The database prints no reminder text for any keyword, and this project
 * has said so in six places while reading printed CARD FACES one at a
 * time to settle them. Two sources agree, independently:
 *
 *   "When this is defended by a NON-ILLUSIONIST ATTACK ACTION CARD with
 *    6 or more {p}, destroy this."           — SAT011, fetched and read
 *
 *   "When an attack with phantasm is defended by a 6{p}+ non-Illusionist
 *    attack action card, the attack is destroyed and the combat chain
 *    closes."     — the-fab-cube `csvs/english/keyword.csv`, develop
 *
 * The pop site asked `(c.power||0) >= 6` over the wall. Measured over the
 * pinned pool, that is 90 records with 6+ power, 74 of which really do
 * pop and SIXTEEN of which the keyword excludes by name.
 *
 * THE ILLUSIONIST HALF IS LIVE. Nine of the sixteen are Enigma's OWN
 * phantasm attacks at every pitch — Enigma Chimera, Phantasmal Haze,
 * Spectral Rider — so an Enigma who blocked with one destroyed the
 * opponent's phantasm attack, which the keyword forbids by name.
 *
 * THE ATTACK-ACTION-CARD HALF IS LATENT, measured rather than assumed:
 * nothing in the pool can reach a wall without being one, so it is
 * drilled with a synthetic (v3.73).
 *
 * AND NO TOOL HERE COULD SEE IT. Coverage reads all four phantasm cards
 * `full`, because the keyword line IS consumed — as a `noop` whose reason
 * described the ENGINE's approximation rather than the card (v3.16). And
 * a phantasm attack popped when it should not be is WEAKER than printed,
 * which is the direction the one-sided fairness sweep is built not to
 * look in.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
const gate = t => H.hasDb() ? t : { skip: true };

/* ---- the predicate reads all three printed facts -------------------- */

const mk = o => Object.assign({uid: "x", name: "Probe", def: 3, pitch: 1,
                               power: 6, tt: "Generic Action - Attack",
                               ty: ["Generic", "Action", "Attack"]}, o);

test("`phantasmPops` reads the POWER, and the pair either side of the threshold", () => {
  /* v3.92/v3.99's rule: a fixture at 0 and at 9 agrees under every wrong
     reading. Only 5 against 6 tests the printed number. */
  assert.equal(P.phantasmPops(mk({power: 5})), false, "five does not pop");
  assert.equal(P.phantasmPops(mk({power: 6})), true,  "six does");
  assert.equal(P.phantasmPops(mk({power: 7})), true,  "and more than six does");
  assert.equal(P.phantasmPops(mk({power: null})), false, "a card with no printed power does not");
});

test("`phantasmPops` reads ATTACK ACTION CARD — a 6-power non-attack does not pop", () => {
  /* LATENT and therefore synthetic. `wall` is the declared NON-EQUIPMENT
     cards, so the pool's four non-attack 6-power cards that could carry a
     defence are all equipment or tokens, and its two 6+-power Ally cards
     print no defence at all — `legal` refuses to declare one. */
  assert.equal(P.phantasmPops(mk({tt: "Generic Action", ty: ["Generic", "Action"]})), false,
    "a non-attack ACTION card with 6 power is not what the keyword names");
  assert.equal(P.phantasmPops(mk({tt: "Guardian Block", ty: ["Guardian", "Block"]})), false,
    "and neither is a Block card");
  assert.equal(P.phantasmPops(mk({tt: "Pirate Action - Ally", ty: ["Pirate", "Action", "Ally"]})), false,
    "nor an Ally, which prints power for its own swing");
  /* THE POSITIVE CONTROL, or a predicate that answered FALSE for
     everything would pass all three assertions above. */
  assert.equal(P.phantasmPops(mk({})), true, "an ordinary attack action card still pops");
});

test("`phantasmPops` reads NON-Illusionist, off the structured array", () => {
  assert.equal(P.phantasmPops(mk({tt: "Illusionist Action - Attack",
                                  ty: ["Illusionist", "Action", "Attack"]})), false,
    "an Illusionist attack action card is excluded by name");
  assert.equal(P.phantasmPops(mk({tt: "Light Illusionist Action - Attack",
                                  ty: ["Light", "Illusionist", "Action", "Attack"]})), false,
    "and so is one that carries Illusionist beside a talent");
  /* THE NEAR-MISS. A substring test over `tt` claims this too. */
  assert.equal(P.phantasmPops(mk({tt: "Illusion Action - Attack",
                                  ty: ["Illusion", "Action", "Attack"]})), true,
    "a class that merely CONTAINS the word is a different class");
  /* AND THE ARRAY IS THE AUTHORITY (v2.44), not the display string. */
  assert.equal(P.phantasmPops(mk({tt: "Generic Action - Attack",
                                  ty: ["Illusionist", "Action", "Attack"]})), false,
    "the structured array decides, even when `tt` disagrees");
});

/* ---- the pool census, pinned as SETS -------------------------------- */

const POOL = () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard);
  const maps = C.buildMaps(raw);
  const out = [];
  const seen = new Set();
  for(const m of raw){
    const c = C.resolveEntry(maps, {name: m.n, p: m.p, code: null, q: 1});
    if(!c) continue;
    const k = c.name + "|" + c.pitch;
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
};

test("the pool's 6-power records partition into POPS and EXCLUDED, and both are pinned", () => {
  const six = POOL().filter(c => (c.power || 0) >= 6);
  assert.ok(six.length >= 60, "the scan is alive — it found " + six.length + " records with 6+ power");

  const excluded = six.filter(c => !P.phantasmPops(c)).map(c => c.name + "|" + c.pitch).sort();
  /* PINNED AS A SET, not as a count: two records swapping sides keeps
     every number intact (v3.98, v4.02). Nine are the LIVE half — Enigma's
     own phantasm attacks at every pitch — and seven are the latent half. */
  assert.deepEqual(excluded, [
    "Blasmophet, the Soul Harvester|0",
    "Enigma Chimera|1", "Enigma Chimera|2", "Enigma Chimera|3",
    "Nasreth, the Soul Harrower|0",
    "Phantasmal Haze|1", "Phantasmal Haze|2", "Phantasmal Haze|3",
    "Riggermortis|2",
    "Sledge of Anvilheim|0",
    "Spectral Rider|1", "Spectral Rider|2", "Spectral Rider|3",
    "Swabbie|2",
    "Teklovossen, the Mechropotent|0",
    "Ursur, the Soul Reaper|0"
  ], "the excluded set is a deliberate edit, not a drift");

  /* THE OTHER SIDE OF THE PARTITION, so a predicate that stopped popping
     anything cannot satisfy the pin above by making the set bigger. */
  assert.equal(six.length - excluded.length, 74,
    "and 74 records still pop, which is what makes this a partition");
});

test("the LATENT half is latent because nothing in the pool can reach a wall without it", () => {
  /* Measured, not assumed — the reason the synthetic above is the only
     way to drill the attack-action-card restriction. A card reaches
     `wall` only from the HAND, only with a printed defence, and only if
     it is not a defence reaction. */
  const stuck = POOL().filter(c => (c.power || 0) >= 6 && !P.phantasmPops(c))
    .filter(c => !((c.ty || []).some(t => /^illusionist$/i.test(String(t)))))
    .filter(c => c.def != null && !P.isDR(c));
  assert.deepEqual(stuck.map(c => c.name).sort(), ["Teklovossen, the Mechropotent"],
    "the only one with a printed defence is a Demi-Hero EQUIPMENT, which the gear branch takes");
  assert.ok((POOL().find(c => c.name === "Teklovossen, the Mechropotent").ty || [])
              .some(t => /^equipment$/i.test(String(t))),
    "and `wall` is the declared NON-EQUIPMENT cards, so it never arrives");
});

/* ---- the fire site asks the one reader ------------------------------ */

test("the pop site asks `phantasmPops` and nothing re-derives the six", () => {
  const i = SRC.indexOf('if(hasKw(card,"phantasm")){');
  assert.ok(i > 0, "the pop site is still there");
  const body = SRC.slice(i, i + 1400);
  assert.match(body, /\.find\(c => phantasmPops\(c\)\)/,
    "the wall is filtered by the one reader");
  assert.doesNotMatch(body, /power\s*\|\|\s*0\)\s*>=\s*6/,
    "and the inline threshold is gone — a keyword read at its fire site is where this went wrong");
});

test("the `noop` reason describes the CARD, not the engine (v3.16)", () => {
  const r = P.classifyClause("phantasm", {});
  assert.ok(r && r.ops && r.ops[0] && r.ops[0][0] === "noop", "the keyword line is still a noop");
  const why = String(r.ops[0][1]);
  assert.match(why, /non-illusionist/i, "the reason names the class the keyword excludes");
  assert.match(why, /attack action card/i, "and the type it requires");
  assert.doesNotMatch(why, /a single 6\+ power blocker/i,
    "the old reason described the pop site's approximation, which is what a noop must never do");
});

/* ---- driven, at the table -------------------------------------------
   `attackRx`-style unit calls prove a reader; only driving `reduce`
   proves the card (v3.20, v3.89, v4.03). */

function swingInto(atkName, blocker, seed){
  const atk = {...C.resolveEntry(H.db(), {name: atkName, p: 1, code: null, q: 1}), uid: "ph"};
  assert.ok(P.hasKw(atk, "phantasm"), "the printed keyword is the spec");
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk]},
                  {name: "Them", hand: [blocker]},
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
  const d = J.reduce(n, {t: "defend", uid: blocker.uid}, 1);
  assert.equal(d.error, null, "declaring " + blocker.name + " was refused: " + d.error);
  n = d.state;
  for(let i = 0; i < 16 && n.phase === "action" && n.step !== "layer"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  return n;
}

test(gate("an ILLUSIONIST attack action card does not pop a phantasm attack"), () => {
  /* THE LIVE HALF, and the blocker is a real pool card out of the very
     deck that plays the attack: Enigma decks all three of these. */
  const chim = {...C.resolveEntry(H.db(), {name: "Enigma Chimera", p: 3, code: null, q: 1}), uid: "w1"};
  assert.equal(chim.power, 6, "Enigma Chimera at blue prints exactly the threshold");
  assert.ok((chim.ty || []).some(t => /^illusionist$/i.test(String(t))), "and it is an Illusionist card");

  const n = swingInto("Spears of Surreality", chim, "ph-illu");
  assert.ok(n.sides[1].hp < 20, "the attack was NOT popped — it resolved and the block absorbed part of it");
  assert.deepEqual(INV.errors(n), [], "and the board is clean");
});

test(gate("a NON-Illusionist attack action card with the same power still pops it"), () => {
  /* THE POSITIVE CONTROL, in the same state with the same numbers. A
     predicate that refused everything passes the drill above perfectly. */
  const big = {uid: "w1", name: "Six Power", def: 3, power: 6, pitch: 1,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  const n = swingInto("Spears of Surreality", big, "ph-generic");
  assert.equal(n.sides[1].hp, 20, "popped — no damage reaches the hero");
  assert.deepEqual(n.sides[0].grave.map(x => x.uid), ["ph"], "and the attack is destroyed, once");
});

test(gate("a 6-power NON-ATTACK card declared as a defender does not pop it"), () => {
  /* THE LATENT HALF, synthetic because no pool card can express it. */
  const blk = {uid: "w1", name: "Heavy Guard", def: 3, power: 6, pitch: 1,
               tt: "Generic Action", ty: ["Generic", "Action"]};
  const n = swingInto("Spears of Surreality", blk, "ph-nonatk");
  assert.ok(n.sides[1].hp < 20, "the attack was NOT popped — it resolved");
});

/* ---- which predicate answers for the ATTACKING card ------------------ */

test("hasKw and printedKw disagree on exactly two pool records, and neither can attack", () => {
  /* v3.94's lesson one side over: the keyword predicate is a question
     about the RESOLVING card here, and `hasKw` is deliberately loose —
     it claims any card whose text merely MENTIONS the word.

     Measured: two records disagree, and both are unreachable as an
     attacking card. Ash GRANTS phantasm to a permanent and Silent
     Stilettos WATCHES for it; neither can be `pend.card`, because a Token
     under a permanent and a Legs equipment never swing. So the loose
     predicate is safe HERE BY MEASUREMENT rather than by rule, and this
     pin fails the day a third record disagrees or one of these two gains
     a route. Narrowing it to `printedKw` would drop a legitimately
     GRANTED phantasm, which is `defCap`'s shape (v3.71) and needs the
     grant wired first — parsing ahead of wiring, otherwise. */
  const rows = POOL().filter(c => P.hasKw(c, "phantasm") || P.printedKw(c, "phantasm"));
  assert.equal(rows.filter(c => P.hasKw(c, "phantasm")).length, 14, "hasKw claims 14");
  assert.equal(rows.filter(c => P.printedKw(c, "phantasm")).length, 12, "printedKw claims 12");
  assert.deepEqual(rows.filter(c => P.hasKw(c, "phantasm") !== P.printedKw(c, "phantasm"))
                       .map(c => c.name).sort(),
    ["Ash", "Silent Stilettos"], "and the two that disagree are named");
  for(const c of rows) if(P.hasKw(c, "phantasm") && !P.printedKw(c, "phantasm"))
    assert.equal(P.isAttack(c), false, c.name + " cannot be the resolving attack");
});
