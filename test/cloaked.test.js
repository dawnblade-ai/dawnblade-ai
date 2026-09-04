/* ============================================================
   CLOAKED, AND A COST THE GUARD NEVER SAW (v3.99)

   Uphold Tradition, verbatim from its printing (ENG005 — the database
   carries no reminder text, and reading the printed card is the FIRST
   thing to try here rather than the last: v3.32, v3.54, v3.66, v3.78,
   and now a fifth time):

     Cloaked (Equip this face-down.)
     Instant - {r}, turn this face-up: Put a +1{p} counter on an aura
       you control with ward.
     Ward 1

   TWO DEFECTS, ONE CARD, AND IT READ `tier: full` THROUGH BOTH.

   1. THE FLIP HALF OF THE COST WAS DROPPED. `parseHeroPower`'s catch-all
      refuses a cost containing discard/banish/remove/destroy/sacrifice/
      put/reveal/soul/life — and "turn this face-up" contains none of
      them. So the line fell through, the cost was read off the {r}
      alone, and the ability minted a +1{p} counter for one resource
      EVERY TURN, FOREVER, where the card grants it once. STRONGER than
      printed, which is the direction that steals games, and the
      direction the one-sided fairness sweep is built not to look in.

   2. THE KEYWORD WAS FILED UNDER STEALTH'S REASON —
      `/^(?:stealth|cloaked)$/ -> NOOP("qualifier only")`. Cloaked is not
      a qualifier; it is a property of the PIECE. That is v3.16's rule at
      the keyword level: a noop must describe the clause in front of it,
      never a sibling — and this one borrowed its neighbour's and
      reported the card fully scripted with the mechanic doing nothing.

   THE RULING AGREES WITH THE PRINTING (user, 2026-07-25): "EQUIPPED FACE
   DOWN ... INSTANT ABILITY - ALWAYS ACTIVE - COST 1 RESOURCE - POP UP -
   SHOW AURAS IN PLAY - SELECT 1 - ADD A +1 ATTACK POWER COUNTER". Its
   "ALWAYS ACTIVE" is this user's shorthand for the instant WINDOW — the
   same thing they spell out at length for Spellfire Cloak in the same
   batch — not a claim that the ability repeats.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

let _built = null;
/* THE REAL DEAL, not a hand-made gear entry — the whole claim is that
   `build.js` equips the piece face-down when a hero is dealt, and a
   fixture that stamps the flag itself has tested the fixture (v3.20). */
function enigma(){
  if(_built) return _built;
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "enigma");
  _built = B.buildSide(h, G.parseDeck(W.DECKS.enigma), H.db(), {},
                       RNG.make("cloak"), {n: 0}).b;
  return _built;
}

const UT = "**Cloaked**\n\n**Instant** - {r}, turn this face-up: Put a +1{p} counter on " +
           "an aura you control with **ward**.\n\n**Ward 1**";

test("the flip is READ as part of the cost", {skip}, () => {
  const pw = P.parseHeroPower(UT, true);
  assert.ok(pw, "the ability line is accepted");
  assert.equal(pw.flipUp, true, "\"turn this face-up\" is half the cost");
  assert.equal(pw.cost, 1, "…and the {r} is the other half — dropping either is a different price");
  assert.equal(pw.kind, "instant");
});

test("cloaked is read off the PRINTED keyword, never a mention", {skip}, () => {
  assert.equal(P.isCloaked({tx: UT, kw: ["Cloaked", "Ward 1"]}), true);
  /* v2.84's three questions. A card that merely MENTIONS the keyword must
     not be equipped face-down — that is a rule invented at the keyword
     level, which is the golden rule broken one layer up. No pool card
     tells `hasKw` and `printedKw` apart here, so the discriminator is a
     synthetic near-miss (v3.73's Crash and Bash, one keyword over). */
  assert.equal(P.isCloaked({tx: "Your cloaked attacks get +1{p}.", kw: []}), false,
    "a MENTION is not a printing");
  assert.equal(P.isCloaked({tx: "**Go again**", kw: ["Cloaked"]}), true,
    "…and the keyword list still answers when the text says nothing");
});

test("a cloaked piece is equipped face-down, and nothing else is", {skip}, () => {
  const gear = enigma().gear || [];
  assert.ok(gear.length, "Enigma equips something");
  const down = gear.filter(g => g._faceDown);
  const named = down.map(g => g.name).sort();
  assert.deepEqual(named, ["Uphold Tradition"],
    "exactly the pool's one Cloaked record — measured, and a second would be a " +
    "deliberate edit rather than a surprise");
  const ut = gear.find(g => g.name === "Uphold Tradition");
  assert.ok(ut.powCard, "and its ability is built");
  assert.equal(ut.powCard._flipUp, true, "carrying the flip flag");
  assert.equal(ut.powCard._flipGear, ut.uid,
    "…and the source uid, so no site has to reconstruct it from the powCard's own");
});

/* ------------------------------------------------------------------
   THE ONE-SHOT, DRIVEN ON BOTH BOARDS

   A cost refused on one board and free on the other is v3.01's shape and
   the single most repeated defect in this project. Both boards ask
   `parser.abFlipUp`, and both are driven here.
   ------------------------------------------------------------------ */

function fixture(faceDown){
  const ut = Object.assign({}, enigma().gear.find(g => g.name === "Uphold Tradition"),
                           {_faceDown: faceDown});
  const shield = {uid: "sh1", kind: "aura", spent: false,
    card: {name: "Spectral Shield", uid: "sh1", tt: "Illusionist Token - Aura",
           ty: ["Illusionist", "Token", "Aura"], tx: "**Ward 1**", kw: ["Ward 1"]}};
  let g = H.state({name: "Alice", res: 5, ap: 1, gear: [ut], board: [shield]},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  return {game: g, ab: ut.powCard, uid: ut.uid};
}

test("judge REFUSES the ability once the piece is face-up", {skip}, () => {
  const down = fixture(true), up = fixture(false);
  const dg = Object.assign({}, down.game, {phase: "action", step: "layer", priority: 0});
  const ug = Object.assign({}, up.game,   {phase: "action", step: "layer", priority: 0});
  const okDown = H.J.legal(dg, {t: "activate", uid: down.uid, from: "gear"}, 0);
  const okUp   = H.J.legal(ug, {t: "activate", uid: up.uid,   from: "gear"}, 0);
  /* THE POSITIVE CONTROL IS THE WHOLE DRILL. A refusal drill with no
     control passes just as well against an engine that refuses
     everything (v3.45: both halves, or it proves nothing). */
  /* `judge.legal` answers a REASON STRING when it refuses and a falsy
     value when it does not — so the control is "no reason", never `true`. */
  assert.equal(okDown, null, "face-down, the cost can be paid");
  assert.match(String(okUp), /already face-up/,
    "face-up, it cannot — which is the whole of what makes it a one-shot");
});

test("execute turns it face-up, and refuses a second use", {skip}, () => {
  const f = fixture(true);
  const one = unwrap(H.execute(f.game, f.ab, "gear", 0, {}));
  const after = (one.sides[0].gear.find(x => x.uid === f.uid) || {});
  assert.equal(!!after._faceDown, false, "the piece is face-up — the cost is paid");
  assert.match(said(one), /turned face-up/);
  /* AND THE COUNTER LANDED. A cost drill that never checks the payload
     cannot tell "the cost was charged" from "nothing happened at all". */
  const ctr = (one.sides[0].counters || {})["sh1"] || {};
  assert.equal(ctr.pow, 1, "…and the printed +1{p} counter is on the aura");

  /* AN UNPAYABLE COST IS INERT, NEVER FREE (v2.04). Both boards refuse
     first, so reaching here face-up is a stale or crafted action off the
     wire — `execute` is fed by `reduce`, which is fed by JSON. */
  const two = unwrap(H.execute(one, f.ab, "gear", 0, {}));
  const ctr2 = (two.sides[0].counters || {})["sh1"] || {};
  assert.equal(ctr2.pow, 1, "a second activation mints nothing — the ability is spent");
  assert.match(said(two), /already face-up/);
});

test("the trainer names the refusal, and `execute` is what enforces it", {skip}, () => {
  /* ONE READER, BOTH BOARDS. A cost read in one place and re-derived in
     the other is two descriptions of one price, which is how an ability
     comes to be free on one board — v3.01, and the reason `abSoulCost`,
     `abSelfBanish` and `abDestroyBoard` each have exactly one reader.

     THIS HALF IS A SOURCE SLICE AND IT IS THE WEAK HALF, SAID PLAINLY.
     `tryPlay` lives inside a `text/babel` block, so no drill can require
     it — and a slice can only ever report that the text is present.
     Sabotaged by neutering the call rather than deleting it, this drill
     stays green, which is exactly what v3.22 and v3.28 say about a source
     slice and what v3.94 rewrote four of them for.

     WHAT ACTUALLY PROTECTS THE STATE IS `execute`'s OWN GUARD, driven two
     drills up: with the trainer's refusal gone the ability is INERT
     rather than free (v2.04), because the charge site refuses a piece
     that is already face-up. The trainer's `tryPlay` check buys a NAMED
     refusal instead of a dead tap — real, and a smaller claim.

     SCOPED TO THE ACTIVATION REGION, not the whole file (v3.51: "UNTUNED"
     contains "TUNED", and a word-match that is not scoped to the region
     that must contain it proves nothing). */
  const fs = require("fs"), path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const i = html.indexOf("A SOUL BANISH IS A COST, SO IT IS A LEGALITY (v3.74)");
  assert.ok(i > 0, "the trainer's activation legality block moved — re-anchor this drill");
  const region = html.slice(Math.max(0, i - 2500), i + 2500);
  assert.match(region, /DawnParser\.abFlipUp\(/,
    "the trainer must ask the shared reader, beside the other two costs");
  const judge = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(judge, /PR\.abFlipUp\(/, "and so must judge");
});

test("cloaked's noop describes cloaked, not stealth", {skip}, () => {
  /* v3.16: a noop must describe the clause in front of it, never a
     sibling. Filed together, the reason claimed cloaked was "a qualifier
     other cards check an attack for" — which is stealth's reason, and is
     what let Uphold Tradition report fully scripted while the mechanic
     did nothing. */
  const st = P.classifyClause("stealth", {name: "S", tx: "**Stealth**", kw: ["Stealth"]});
  const cl = P.classifyClause("cloaked", {name: "C", tx: "**Cloaked**", kw: ["Cloaked"]});
  assert.equal(st.status, "noop");
  assert.equal(cl.status, "noop");
  assert.notEqual(st.ops[0][1], cl.ops[0][1],
    "two keywords, two reasons — sharing one is how a mis-filing hides");
  assert.match(cl.ops[0][1], /face-down/,
    "…and cloaked's names what actually reads it");
});

/* ------------------------------------------------------------------
   AND THE HOIST FOUND A LIVE ONE — v3.99

   Three of the four activation costs are paid out of somewhere the
   powCard cannot see, so each is a LEGALITY (v3.11). All three lived in
   judge's HERO branch alone; the GEAR branch asked none of them. The
   trainer routes both through one `tryPlay`, so it asked them for both —
   v3.01's shape, and the reason a shared body is not tidying.
   ------------------------------------------------------------------ */

test("judge refuses an EQUIPMENT soul cost, not just a hero's", {skip}, () => {
  /* RADIANT TOUCH — "Instant - Banish this and a card from your soul:
     Prevent the next 2 damage…". v3.79 stamped `_soulCost` on the
     equipment powCard builder and nothing went back for the REFUSAL, so
     `legal` said yes with an empty soul and `execute`'s own guard then
     did nothing. Inert rather than free (v2.04) — and the seat still
     spends its once-per-turn allowance on a play the rules forbid. */
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "boltyn");
  const b = B.buildSide(h, G.parseDeck(W.DECKS.boltyn), H.db(), {},
                        RNG.make("radiant"), {n: 0}).b;
  const rt = (b.gear || []).find(x => x.powCard && P.abSoulCost(x.powCard));
  if(!rt) return;                       /* the loadout did not take it this deal */

  const mk = soul => {
    const g = H.state({name: "Alice", res: 5, ap: 1, gear: [rt], soul},
                      {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
    return Object.assign({}, g, {phase: "action", step: "layer", priority: 0,
                                 builds: [{}, {}]});
  };
  const empty = H.J.legal(mk([]), {t: "activate", uid: rt.uid, from: "gear"}, 0);
  const held  = H.J.legal(mk([{name: "Soul", uid: "s1", pitch: 1}]),
                          {t: "activate", uid: rt.uid, from: "gear"}, 0);
  assert.match(String(empty), /from the soul/,
    "an empty soul cannot pay a soul cost, on the GEAR route as much as the hero's");
  assert.equal(held, null, "…and a stocked soul can — the control that says the " +
    "refusal is the cost talking, not a branch that refuses everything");
});

test("both activation branches ask the SAME cost body", {skip}, () => {
  /* A SOURCE SLICE ROTS WHERE A RULE MOVES (v3.22, v3.28) — so this asks
     the shape rather than the text: exactly one definition, and both
     branches call it. Two hand-rolled copies is how the gear branch came
     to have none. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.equal((src.match(/function abCostWhy\(/g) || []).length, 1,
    "one body");
  /* THE DEFINITION MATCHES THE CALL AND MUST BE EXCLUDED (v3.24, where
     the same slip made a call-site guard match its own definition and
     pass on a dropped argument). Count the CALLS. */
  assert.equal((src.match(/= abCostWhy\(sd, ab\)/g) || []).length, 2,
    "…called from BOTH the hero branch and the gear branch");
  assert.equal((src.match(/PR\.abSoulCost\(/g) || []).length, 1,
    "and the readers are asked in that body ONLY — a second site is the drift");
  assert.equal((src.match(/PR\.abDestroyBoard\(/g) || []).length, 1);
  assert.equal((src.match(/PR\.abFlipUp\(/g) || []).length, 1);
});
