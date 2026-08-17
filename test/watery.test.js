/* ============================================================
   WATERY GRAVE — the drawback, and the hole it was hiding.

   Six Pirate Necromancer allies print the keyword, and Gravy Bones' hero
   ability reads "if a blue card has been put into your graveyard this
   turn, you may play cards with watery grave from your graveyard". Until
   v3.00 the UPSIDE was built and the drawback was not, so those six were
   an infinite loop — and `tools/failstates.js` was the only thing that
   could see it, because the keyword parses to a `noop` and a noop counts
   as accounted for. Every one of the six reported `tier: full`.

   RULING 2026-07-25, verbatim: "Because gravy can often play allies from
   the grave - they must be turned face down when they die so they can not
   be used infinitely. allow the player to check their own faced down
   cards but not their opponents."

   BUILDING IT FOUND A BIGGER ONE. The rule that decides whether a
   graveyard card may be played at all lived in `playables()` — the
   TRAINER's UI — so `judge.legal` never had it, and at the table every
   card in a graveyard was playable. That is sev-3 "illegal play allowed"
   over the whole pool rather than over a keyword.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (nm, p) => C.resolveEntry(H.db(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});

/* Gravy Bones' ability is on, and a blue card has hit the graveyard. */
const ON = () => ({wateryGrave: true, blueGY: 1, turn: 2});

/* ---- THE PREDICATE IS `printedKw`, NOT `hasKw` ------------------------ */

test("only a card that PRINTS watery grave may be replayed", {skip}, () => {
  H.db();
  /* All six carry it as a printed keyword line. */
  for(const nm of ["Barnacle", "Cutty Shark, Quick Clip", "Limpit, Hop-a-long",
                   "Oysten, Heart of Gold", "Riggermortis", "Swabbie"]){
    const c = card(nm, 2);
    assert.ok(c.resolved, nm + " must resolve");
    assert.ok(P.printedKw(c, "watery grave"), nm + " prints the keyword");
    assert.ok(P.playableFromZone(c, "grave", ON()), nm + " is replayable while the ability is on");
  }
  /* THREE POOL CARDS ONLY ASK ABOUT IT. "Cards WITH watery grave" is not
     "cards that mention watery grave" — under `hasKw` all three were
     replayable from the graveyard against their own printed text. */
  for(const [nm, p] of [["Jittery Bones", 3], ["Compass of Sunken Depths", 0], ["Washed Up Wave", 0]]){
    const c = card(nm, p);
    assert.ok(c.resolved, nm + " must resolve");
    assert.ok(P.hasKw(c, "watery grave"), nm + " does mention it — that is why the loose predicate was wrong");
    assert.ok(!P.printedKw(c, "watery grave"), nm + " does not PRINT it");
    assert.ok(!P.playableFromZone(c, "grave", ON()), nm + " must not be replayable");
  }
});

/* ---- THE DRAWBACK ----------------------------------------------------- */

test("an ally that dies is turned face-down, and a face-down card stays dead", {skip}, () => {
  const barn = {...card("Barnacle", 2), uid: "a1"};
  const g = {sides: [{board: [{uid: "a1", kind: "ally", card: barn, life: 3, base: 3}], grave: []}, {}]};

  assert.ok(P.playableFromZone(barn, "grave", ON()),
    "before it dies it is an ordinary watery-grave card — without this the drill proves nothing");

  const out = G.damageAlly(g, 0, "a1", 5);
  assert.equal(out.killed, "Barnacle");
  const inGrave = out.game.sides[0].grave[0];
  assert.equal(inGrave._fd, true, "face-down is the drawback");
  assert.equal(P.playableFromZone(inGrave, "grave", ON()), false,
    "and face-down is what stops the loop — this is the whole keyword");
});

test("the loop is closed: a dead ally cannot be replayed even with the ability on", {skip}, () => {
  H.db();
  const barn = {...card("Barnacle", 2), uid: "a1"};
  let g = H.state({name: "Gravy", res: 9, ap: 3,
                   board: [{uid: "a1", kind: "ally", card: barn, life: 3, base: 3}],
                   hist: {...require("../engine/sides.js").freshHist(), blueGY: 1}},
                  {name: "Them"},
                  {actor: 0, turnPlayer: 0, seed: "wg", builds: [{wateryGrave: true}, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  /* kill it the way the game kills it */
  const dead = G.damageAlly(g, 0, "a1", 9);
  g = dead.game;
  const c = g.sides[0].grave[0];
  assert.equal(c.name, "Barnacle");

  const why = J.legal(g, {t: "play", uid: c.uid, from: "grave"}, 0);
  assert.match(String(why), /cannot be played from your grave/,
    "the judge refuses it, and names the reason rather than dead-tapping");
});

/* ---- THE HOLE THE DRAWBACK FOUND -------------------------------------- */

test("a card with no route out of the graveyard is refused at the table", {skip}, () => {
  H.db();
  /* Brutal Assault is a vanilla dummy attack: no watery grave, no printed
     line about the graveyard, nothing. It was playable from the graveyard
     with `legal` returning null, because the zone rule lived in the
     trainer's UI and this reducer had none. */
  const plain = {...card("Brutal Assault", 1), uid: "g1"};
  assert.ok(!P.hasKw(plain, "watery grave"), "the control card must be genuinely plain");
  let g = H.state({name: "You", res: 9, ap: 3, grave: [plain]}, {name: "Them"},
                  {actor: 0, turnPlayer: 0, seed: "hole"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  assert.match(String(J.legal(g, {t: "play", uid: "g1", from: "grave"}, 0)),
    /cannot be played from your grave/);
  const r = J.reduce(g, {t: "play", uid: "g1", from: "grave"}, 0);
  assert.ok(r.error, "and the reducer refuses it too — legal and reduce must agree");
  assert.deepEqual(r.state.sides[0].grave.map(c => c.uid), ["g1"],
    "a refused play leaves the graveyard untouched");
});

test("the ordinary routes still work — the gate is not a wall", {skip}, () => {
  H.db();
  const c = card("Brutal Assault", 1);
  const o = ON();
  assert.equal(P.playableFromZone(c, "hand", o), true);
  assert.equal(P.playableFromZone(c, "arsenal", o), true);
  /* Crouching Tiger is minted into banish and stamped playable that turn. */
  assert.equal(P.playableFromZone({...c, _playTurn: 2}, "banish", o), true, "the mint stamp is honoured");
  assert.equal(P.playableFromZone({...c, _playTurn: 1}, "banish", o), false, "and it expires");
});
