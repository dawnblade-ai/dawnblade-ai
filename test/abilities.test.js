/* ============================================================
   AN ACTIVATED ABILITY IS NOT A WEAPON SWING.

   `judge.legal` refused every non-weapon piece with "equipment, not a
   weapon", so **17 non-weapon equipment abilities across 12 heroes were
   dead at the table** — Spellfire Cloak, Knucklehead, Predatory Plating,
   Bull's Eye Bracers, Pouncing Paws, every one of them. Measured, not
   guessed: driving `activate` on Iyslander's cloak answered "Spellfire
   Cloak is equipment, not a weapon".

   It is the shape this cycle keeps finding — a route that exists on one
   board only, because `Battle` built it as UI. The trainer's own path is
   `tryPlay(gr.powCard, "hero", i)`; judge makes the same call with the
   same powCard, so `execute` marks the once-per-turn flag for both and
   there is no second description of what an ability does.

   AND THE GATE CAME WITH IT. `activateIfOk` lived inside `Battle` too, so
   no printed "Activate this only …" restriction was enforced here at all.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const TY = require("../engine/types.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;
const { loadData } = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const W = loadData();

/* A hero, wearing their default loadout, seated with priority. */
function seat(heroKey, o){
  o = o || {};
  const db = H.db();
  const hero = W.HEROES.find(h => h.k === heroKey);
  const b = B.buildSideDefault(hero, G.parseDeck(W.DECKS[heroKey]), db, RNG.make("abil"), {n: 0}).b;
  let g = H.state({name: hero.n, res: o.res == null ? 9 : o.res, ap: 3, gear: b.gear,
                   deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", deck: [{uid: "d2", name: "F2"}]},
                  {actor: 0, turnPlayer: o.turnPlayer == null ? 0 : o.turnPlayer,
                   seed: "abil", builds: [b, {}]});
  /* NO `gear` ON THE GAME. Written that way first, and `SIDE-FIELD-ON-GAME`
     caught it in the first drill — a per-side field on the game object is
     a write that silently does nothing, and the fixture is not exempt. */
  return {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
}
const pieceOf = (g, re) => g.sides[0].gear.find(x => re.test(x.name));

/* ---- THE ROUTE --------------------------------------------------------- */

test("a non-weapon equipment ability is activatable at the table", {skip}, () => {
  /* Blossom of Spring: "Instant - Destroy this: Gain {r}. Go again" — no
     printed restriction, so nothing but the route can refuse it. */
  const g = seat("viserai", {res: 0});
  const pc = pieceOf(g, /Blossom of Spring/);
  assert.ok(pc, "Viserai is not wearing the Blossom — re-pick the fixture");
  assert.ok(!TY.isWeaponType(pc), "the fixture must be a NON-weapon, or this proves nothing");

  assert.equal(J.legal(g, {t: "activate", uid: pc.uid}, 0), null,
    "it was refused: " + J.legal(g, {t: "activate", uid: pc.uid}, 0));
  const r = J.reduce(g, {t: "activate", uid: pc.uid}, 0);
  assert.equal(r.error, null);
  assert.equal(r.state.sides[0].res, 1, "the ability RESOLVED — {r} gained, from 0");
  assert.deepEqual(INV.errors(r.state), []);
});

test("armour with no ability is still refused, and by name", {skip}, () => {
  const g = seat("viserai");
  const plain = g.sides[0].gear.find(x => !TY.isWeaponType(x) && !x.pow);
  assert.ok(plain, "no plain armour in this loadout");
  assert.match(String(J.legal(g, {t: "activate", uid: plain.uid}, 0)),
    /prints no activated ability/);
});

test("the cost is really paid, and it cannot be activated twice", {skip}, () => {
  const g = seat("viserai", {res: 0});
  const pc = pieceOf(g, /Blossom of Spring/);
  const n = J.reduce(g, {t: "activate", uid: pc.uid}, 0).state;

  /* EVERY NON-WEAPON ABILITY IN THIS POOL EITHER DESTROYS ITS PIECE OR
     TAPS IT — measured across all 17. So the plain per-turn flag
     (`weaponUsed["gp"+uid]`, which `execute` marks for both boards) is
     genuinely unreachable here, and asserting it would be asserting a
     branch no pool card takes. What IS reachable is that the printed cost
     was paid and the ability is gone. */
  assert.equal(n.sides[0].gear.find(x => x.uid === pc.uid).destroyed, true,
    "'Destroy this' is the cost — collecting the {r} without paying it is the v2.04 bug");
  assert.ok(J.legal(n, {t: "activate", uid: pc.uid}, 0),
    "and it cannot be activated a second time");
});

/* ---- THE PRINTED RESTRICTION ------------------------------------------- */

test("Spellfire Cloak honours 'only during an opponent's turn' — both ways", {skip}, () => {
  const mine = seat("iyslander", {res: 0, turnPlayer: 0});
  const pc = pieceOf(mine, /Spellfire Cloak/);
  assert.ok(pc, "Iyslander is not wearing the cloak");
  assert.match(String(J.legal(mine, {t: "activate", uid: pc.uid}, 0)),
    /your turn, not your opponent's/, "on your own turn it is refused, and the reason is named");

  /* THE POSITIVE HALF. Without it this passes on an engine that refuses
     the ability always, which is the same card being wrong the other way. */
  const theirs = {...mine, turnPlayer: 1};
  assert.equal(J.legal(theirs, {t: "activate", uid: pc.uid}, 0), null,
    "on THEIR turn it is legal — that is the whole point of the cloak");
});

/* ---- READ THE WHOLE PHRASE OR REFUSE ----------------------------------- */

test("an activation condition the parser cannot read REFUSES, never waves through", {skip}, () => {
  /* Two pool cards print a restriction no pattern reads — Scorpio, Comet
     Tail ("only if you control a Lightning attack") and Stand Strong
     ("only if you control an aura of suspense"). With the gate left
     undefined the ability was activatable with NO restriction at all,
     which is the sev-3 direction. v2.04 settled the same question for
     costs: inert, never free. */
  P.fxReset();
  const stand = require("../engine/cards.js").resolveEntry(H.db(), {name: "Stand Strong", p: 0, code: null, q: 1});
  assert.ok(stand.resolved);
  const gate = P.fxParse(stand).activateIf;
  assert.equal(gate && gate.kind, "unreadable", "an unread restriction must be FILED, not dropped");
  assert.equal(E.activateIfOk({sides: [{}, {}], turnPlayer: 0, actor: 0}, gate), false,
    "and it must refuse — waving it through is the ability escaping its own printed limit");
  P.fxReset();
});

test("every printed activation restriction in the pool is read", {skip}, () => {
  const db = H.db(), C = require("../engine/cards.js");
  const seen = new Set(), missed = [];
  for(const k of Object.keys(W.DECKS)){
    const d = G.parseDeck(W.DECKS[k]);
    for(const e of [...d.deck, ...d.gear]){
      const c = C.resolveEntry(db, e);
      if(!/activate this[^.]*only/i.test(P.clean(c.tx || ""))) continue;
      if(seen.has(c.name)) continue;
      seen.add(c.name);
      P.fxReset();
      if(!P.fxParse(c).activateIf) missed.push(c.name);
    }
  }
  P.fxReset();
  assert.ok(seen.size >= 10, "only " + seen.size + " restrictions found — the scan shape moved");
  assert.deepEqual(missed, [],
    "a printed 'Activate this only …' whose condition is not read leaves the ability UNRESTRICTED, " +
    "which is strictly stronger than printed. Four of ten were missed before v3.04 — two because " +
    "the pattern demanded the word 'ability' the card does not print, two because no pattern " +
    "existed and the gate was simply left undefined.");
});
