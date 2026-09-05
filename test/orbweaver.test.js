/* ============================================================
   EQUIP A TOKEN — THE ORB-WEAVER FAMILY (v4.15)

     "Equip a Graphene Chelicera token."      — ORB-WEAVER SPINNERET x3
     "…: Equip a Graphene Chelicera token. …" — ARAKNI, ORB-WEAVER

   Measured across every pool record: FOUR print `Equip a <X> token`, all
   four name the same token, and that token is the pool's ONLY record
   typed both Token and Weapon. So `equipTok` is `token`'s twin one ZONE
   over — the GEAR zone, where `isWeapon` and `weaponCost` already route
   a swing, and not the board where every "auras you control" count would
   pick it up.

   IT MOVED FIVE RECORDS AND A HERO. Orb-Weaver Spinneret x3 went
   `part` -> `full`, Arakni's fifth Agent stopped refusing, and the
   Graphene Chelicera token became reachable at all for the first time —
   it is one of the sweep's "unread and barely named" entries. **Reading
   the PAYLOAD is what creates the route** (v3.47, fifth outing).
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = H.db() ? false : "no card database";

/* ---- THE READING ---------------------------------------------------- */

test("the equip reads, and the family is exactly what was measured", {skip}, () => {
  P.fxReset();
  assert.deepEqual(P.classifyClause("equip a graphene chelicera token"),
    {status: "run", ops: [["equipTok", "graphene chelicera"]]});

  /* MEASURED BEFORE BUILDING (v3.33), and pinned so the reader cannot
     quietly claim a family it was never shown. */
  const raw = require("../data/pool.json");
  const arr = Array.isArray(raw) ? raw : (raw.cards || Object.values(raw));
  const prints = arr.filter(c => /\bequip an? .* token\b/i.test(c.functional_text || ""));
  assert.deepEqual([...new Set(prints.map(c => c.name))].sort(),
    ["Arakni, Orb-Weaver", "Orb-Weaver Spinneret"],
    "the family moved — re-measure before widening the reader");

  /* AND THE DESTINATION IS A CLAIM ABOUT THE TOKEN, so the one token
     that is equipment is pinned too: a second one that is NOT would go
     to a zone nothing reads it from. */
  const tokWeapons = arr.filter(c => (c.types || []).some(t => /^token$/i.test(t))
                                  && (c.types || []).some(t => /^(weapon|equipment)$/i.test(t)));
  assert.deepEqual(tokWeapons.map(c => c.name), ["Graphene Chelicera"],
    "a second token is equipment — check it reaches the gear zone too");
  P.fxReset();
});

test("all three Spinneret printings read in full", {skip}, () => {
  P.fxReset();
  const raw = require("../data/pool.json");
  const arr = Array.isArray(raw) ? raw : (raw.cards || Object.values(raw));
  const amt = {1: 3, 2: 2, 3: 1};
  for(const c of arr.filter(x => x.name === "Orb-Weaver Spinneret")){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +c.pitch, tt: c.type_text, ty: c.types,
      tx: c.functional_text, kw: c.card_keywords || [], cost: c.cost,
      power: c.power, def: c.defense});
    assert.equal(fx.tier, "full", "p" + c.pitch + " is still short");
    assert.ok((fx.ops || []).some(o => o[0] === "equipTok"), "p" + c.pitch + ": no equip");
    /* THE PRINTED NUMBER IS THE CARD'S OWN — three printings, three
       values, so the pool proves it here and no synthetic is needed
       (v3.89's Shred, one card over). */
    const b = (fx.ops || []).find(o => o[0] === "buffNext");
    assert.equal(b && b[1], amt[+c.pitch], "p" + c.pitch + ": the stealth buff is hardcoded");
  }
  P.fxReset();
});

test("the FIFTH Agent stops refusing, and the sixth still does", {skip}, () => {
  H.db();
  /* HER COST WAS NEVER THE REASON — v4.09 built it. What refused was the
     PAYLOAD, and `parseHeroPower` declines a line whose payload nothing
     reads (v2.29). Trap-Door's deck search is the last one. */
  const by = {};
  for(const a of B.agentsOf(H.db(), "chaos")) by[a.n] = a;
  assert.ok(P.parseHeroPower(by["Arakni, Orb-Weaver"].tx),
    "Orb-Weaver refuses again — the fifth Agent is dark");
  assert.equal(P.parseHeroPower(by["Arakni, Trap-Door"].tx), null,
    "Trap-Door now parses — check WHY before moving this");
});

/* ---- THE ZONE, AND THE HAND ----------------------------------------- */

const gearOf = (...names) => names.map((n, i) =>
  Object.assign({}, C.resolveEntry(H.db(), {name: n, p: 0, code: null, q: 1}), {uid: 800 + i}));

function play(gear){
  const spin = C.resolveEntry(H.db(), {name: "Orb-Weaver Spinneret", p: 1, code: null, q: 1});
  const g = Object.assign(
    H.state({hand: [Object.assign({}, spin, {uid: 701})], gear, res: 9, ap: 1},
            {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}),
    {phase: "action", step: "layer", priority: 0, passed: []});
  const out = H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  return out.game || out;
}
const tokenIn = s => (s.sides[0].gear || []).find(x => /Graphene/.test(x.name));

test("DRIVEN: it lands in the GEAR zone, not the board", {skip}, () => {
  H.db();
  const s = play(gearOf("Prey Spotters"));
  const tok = tokenIn(s);
  assert.ok(tok, "the token was not equipped at all");
  assert.equal((s.sides[0].board || []).length, 0,
    "the token went to the BOARD — every \"auras you control\" count now sees a weapon, " +
    "and no swing route reads it (v3.07)");
  /* IT WENT THROUGH `build.equipPiece`, THE ONE BODY. The printed record
     carries no cost; `weaponCost` folds the activation `{r}` onto the
     entry, and a token minted past that body would be charged the
     printed `null`. */
  assert.equal(tok.cost, 1,
    "the activation cost was not folded — the token skipped `equipPiece` and is FREE");
  assert.equal(P.isWeapon(tok), true, "…and it does not answer as a weapon");
  assert.match(String(tok.uid), /^tok/,
    "the uid is not namespaced — a raw counter collides with a real card (v2.23)");
});

test("DRIVEN: it swings at the table, for its printed power", {skip}, () => {
  H.db();
  /* DRIVE THE REAL ENTRY POINT (v3.20, v3.89). The equip is only worth
     anything if the swing route reaches it, and that route is
     `judge.legal` + `judge.reduce`, not a parse assertion. */
  const s1 = play(gearOf("Prey Spotters"));
  const tok = tokenIn(s1);
  const g1 = Object.assign({}, s1, {phase: "action", step: "layer", priority: 0, passed: [],
    sides: [Object.assign({}, s1.sides[0], {ap: 1, res: 9, hand: []}), s1.sides[1]]});
  assert.equal(J.legal(g1, {t: "activate", uid: tok.uid, from: "gear"}, 0), null,
    "the equipped token cannot be swung — the whole build buys nothing");
  const s2 = J.reduce(g1, {t: "activate", uid: tok.uid, from: "gear"}, 0).state;
  assert.ok(s2.pend, "no attack was declared");
  assert.equal(s2.pend.card.name, "Graphene Chelicera");
  /* printed 1, plus the +3 the SAME card granted "your next attack with
     stealth" — and Graphene Chelicera prints Stealth, so it collects it. */
  assert.equal(s2.pend.total, 4,
    "the swing's total moved — printed 1 plus the stealth buff the same play granted");
  assert.equal(s2.sides[0].res, 8, "the activation cost was not charged");
});

test("DRIVEN: no free hand REFUSES, and a destroyed piece frees one", {skip}, () => {
  H.db();
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). And the hand rule
     is not a wall: Arakni's default loadout fills both hands with Mark
     of the Huntsman, and that card destroys ITSELF to mark a hero —
     which is what frees the hand AND sets up this token's own printed
     "when this attacks a MARKED hero". The loop is designed (v3.54). */
  const full = play(gearOf("Mark of the Huntsman", "Mark of the Huntsman"));
  assert.ok(!tokenIn(full),
    "a third one-handed weapon was equipped — the hand limit is decoration, " +
    "and that is STRONGER than printed");
  assert.ok((full.feed || []).some(m => /no free hand/i.test(m)),
    "…and the player is not told why");

  const gear = gearOf("Mark of the Huntsman", "Mark of the Huntsman");
  gear[1].destroyed = true;
  assert.ok(tokenIn(play(gear)),
    "a DESTROYED dagger still holds a hand — `sweepGear` does not file it until the " +
    "end phase (v3.54), so counting it refuses the equip the card loop is built around");
});

test("`handsUsed` is ONE body, and the loadout rule asks it", {skip}, () => {
  H.db();
  /* TWO COPIES OF WHAT A HAND COSTS is how the loadout rule and the
     runtime equip come to disagree. `build.defaultPicks` calls the same
     body, so a change to one is a change to both. */
  const dagger = C.resolveEntry(H.db(), {name: "Mark of the Huntsman", p: 0, code: null, q: 1});
  const helm = C.resolveEntry(H.db(), {name: "Prey Spotters", p: 0, code: null, q: 1});
  assert.equal(G.HANDS, 2, "the hand cap moved — that is a rules change");
  assert.equal(G.handsUsed([helm]), 0, "a Head piece is holding a hand");
  assert.equal(G.handsUsed([dagger, dagger]), 2);
  assert.equal(G.handsFree([dagger, dagger]), 0);
  assert.equal(G.handsUsed([dagger, Object.assign({}, dagger, {destroyed: true})]), 1,
    "a destroyed piece still counts");
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "engine", "build.js"), "utf8");
  assert.match(src, /handsUsed\(hands\.map/,
    "the loadout rule stopped asking `handsUsed` — two spellings of what a hand costs");
});

test("a token that is not equipment REFUSES the gear zone", {skip}, () => {
  H.db();
  /* THE DESTINATION IS READ OFF THE TOKEN, NOT DEFAULTED (v3.55). No
     pool card prints an equip of a non-equipment token, so the near-miss
     is synthetic (v3.73) — and without it the reader would file a
     Runechant into the gear zone, where nothing reads it. */
  const g = Object.assign(H.state({gear: [], res: 9, ap: 1}, {hp: 20},
                                  {actor: 0, turnPlayer: 0, turn: 3}),
                          {phase: "action", step: "layer", priority: 0, passed: []});
  const out = H.runOps(g, [["equipTok", "runechant"]], "probe");
  const s = out.game || out;
  assert.equal((s.sides[0].gear || []).length, 0,
    "a Runechant was EQUIPPED — the destination is defaulted rather than read");
  assert.ok((s.feed || []).some(m => /not equipment/i.test(m)), "and it says why");
});

/* ---- THE FEED THE DRIVE SURFACED ------------------------------------ */

test("a feed line's verb agrees with the seat it names", {skip}, () => {
  H.db();
  /* FOUND BY DRIVING, NOT BY A PARSE (v4.15). Seat 0 is literally named
     "You" (v2.83), so a bare third-person verb reads "You controls no
     ally". `isSecondPerson` was written at v3.90 and the sixteen lines
     that name a seat never asked it; `prompts.js` had the same fault in
     its own vocabulary, and that one the harness reaches — 86 lines in
     210 self-play games.

     ONE BODY, IN game.js, for `typeAbbr`'s stated reason: presentation
     more than one engine module reaches for. And the BASE form is the
     argument — third person is derivable from it and not the reverse. */
  assert.equal(G.sv({name: "You"}, "control"), "You control");
  assert.equal(G.sv({name: "Kayo"}, "control"), "Kayo controls");
  assert.equal(G.sv({name: "Kayo"}, "banish"), "Kayo banishes",
    "the sibilant rule is missing — \"Kayo banishs\"");
  assert.equal(G.sv({name: "Kayo"}, "have"), "Kayo has",
    "the one irregular the feed uses is stemmed rather than named");
  assert.equal(G.svName("You", "soak"), "You soak");

  /* AND NO SITE IS BARE. A scan, because the fault is a SHAPE across
     sixteen lines rather than one card — and the driven counter in
     `tools/selfplay.js` covers the half a scan cannot see. */
  const fs = require("fs"), path = require("path");
  const SEAT = /\$\{(?:act\(n\)|foe\(n\)|act\(s\)|foe\(s\)|sd|_sd|recip|side)\.name\}\s+([a-z]+)\b/g;
  const bare = [];
  for(const f of ["effects.js", "judge.js"]){
    const src = fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8");
    let m; SEAT.lastIndex = 0;
    while((m = SEAT.exec(src))){
      const v = m[1];
      if(!/s$/.test(v) || /^(is|has|was|as|its|this|s)$/.test(v)) continue;
      bare.push(f + ": " + m[0]);
    }
  }
  assert.deepEqual(bare, [],
    "a feed line names a seat and then uses a third-person verb — ask `game.sv`");
});

test("the self-play harness counts the fault, and spells the engine's phrase", {skip}, () => {
  /* A COUNTER THAT SPELLS THE WRONG WORD REPORTS ZERO (v3.81). The scan
     above cannot see a line built by concatenation rather than a
     template, which is exactly how `prompts.js`'s "You soaks" hid — so
     the driven counter is the other half, and its phrase is pinned. */
  const fs = require("fs"), path = require("path");
  const sp = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.match(sp, /SECOND-PERSON/,
    "the driven counter is gone — the half a source scan cannot see is unwatched");
  assert.match(sp, /\\bYou \[a-z\]\+s\\b/,
    "the counter's phrase moved — it now reports zero exactly as a clean engine does");
});
