/* "IF A BLUE CARD HAS BEEN PUT INTO YOUR GRAVEYARD THIS TURN" — ANY ROUTE IN (v6.50).
   Gravy Bones' watery grave counted a blue card only when a blue ATTACK was filed
   after its link (`hist.blueGY`, bumped in `effects.fileAttack` alone). A blue
   non-attack resolving (Portside Exchange, Avast Ye!, Loot the Hold), a blue instant,
   a discard, a milled card and a blue block put a blue card into the graveyard and
   none counted: over 16 measured games Gravy was offered a graveyard play ONCE.
   `parser.playZoneWhy` now reads the graveyard too — any blue card stamped `_gy`
   this turn — and both boards pass their graveyard.

   Driven at the table: a real Gravy match is played to Gravy's own action phase,
   then the graveyard is set and `judge.legal` is asked. Sabotage checked: dropping
   `grave: sd.grave` from judge's call fails the first row; matching any pitch fails
   the yellow row; ignoring the turn stamp fails the last-turn row. */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const SPL = require("../tools/selfplay.js");
const J = SPL.J;

test("the parser: a blue card filed THIS turn turns watery grave on, whatever filed it", () => {
  const ally = SPL.match("gravy", "kayo", "bluegy-parser", 0).sides[0].deck.find(c => c.name === "Oysten, Heart of Gold");
  assert.ok(ally && P.printedKw(ally, "watery grave"), "a real watery-grave ally");
  const o = grave => ({wateryGrave: true, blueGY: 0, grave, turn: 5});
  assert.equal(P.playZoneWhy(ally, "grave", o([{name: "B", pitch: 3, _gy: 5}])), null);
  assert.ok(P.playZoneWhy(ally, "grave", o([{name: "B", pitch: 3, _gy: 4}])), "last turn's blue card does not count");
  assert.ok(P.playZoneWhy(ally, "grave", o([{name: "Y", pitch: 2, _gy: 5}])), "a yellow card does not count");
  assert.ok(P.playZoneWhy(ally, "grave", o([])), "nothing filed: no");
});

/* play a Gravy match until Gravy holds priority in its own action phase with nothing on the chain */
function gravyTurn(){
  let n = SPL.match("gravy", "kayo", "bluegy-drill", 0);
  for(let i = 0; i < 4000 && !n.over; i++){
    if(n.turn > 2 && n.actor === 0 && !(n.chain || []).length && !n.pend && !n.prompt && !(n.stack || []).length
       && !(n.promptQ || []).length && J.legal(n, {t: "endTurn"}, 0) === null) return n;
    let moved = false;
    for(const s of [0, 1]){
      const a = SPL.SP.act(n, s); if(!a) continue;
      const o = J.reduce(n, a, s); if(o.error) continue;
      n = o.state; moved = true;
    }
    if(!moved) break;
  }
  return null;
}

test("the table: a blue NON-attack in the graveyard this turn lets Gravy replay an ally", () => {
  const n = gravyTurn();
  assert.ok(n, "the drive reached Gravy's action phase");
  const pool = SPL.DB;
  const find = nm => { for(const sd of n.sides) for(const z of ["hand", "deck", "grave", "pitch", "banish"]) for(const c of (sd[z] || [])) if(c && c.name === nm) return c; return null; };
  const oyst = find("Oysten, Heart of Gold"), port = find("Portside Exchange"), tip = find("Golden Tipple");
  assert.ok(oyst && port, "Gravy's deck holds Oysten and Portside Exchange");
  const at = (grave) => {
    const sides = n.sides.slice();
    const sd = Object.assign({}, sides[0]);
    const strip = c => !grave.some(x => x.uid === c.uid);
    for(const z of ["hand", "deck", "pitch", "banish"]) sd[z] = (sd[z] || []).filter(strip);
    sd.grave = grave; sd.hist = Object.assign({}, sd.hist, {blueGY: 0}); sd.ap = Math.max(1, sd.ap || 0);
    sides[0] = sd; return Object.assign({}, n, {sides});
  };
  const ally = Object.assign({}, oyst, {_gy: n.turn - 1});
  const play = {t: "play", uid: ally.uid, from: "grave"};
  assert.ok(pool, "the drill database is loaded");
  assert.equal(J.legal(at([ally, Object.assign({}, port, {_gy: n.turn})]), play, 0), null,
    "Portside Exchange (blue, not an attack) filed this turn opens watery grave");
  assert.match(String(J.legal(at([ally, Object.assign({}, port, {_gy: n.turn - 1})]), play, 0)), /nothing lets it/,
    "filed LAST turn it does not — the refusal is the control");
  if(tip && Number(tip.pitch) !== 3)
    assert.match(String(J.legal(at([ally, Object.assign({}, tip, {_gy: n.turn})]), play, 0)), /nothing lets it/,
      "a non-blue card filed this turn does not");
});

/* THE POLICY (SPXGRAVE): a card `legal` lets the seat play from its graveyard is a card
   it holds. Before v6.50 this exact position — an empty hand, Oysten (cost 0) playable
   from the graveyard, the action point unspent — was "Nothing you hold is worth playing".
   Sabotage checked: `gravePlays` returning [] fails it. */
test("the AI plays a free ally from the graveyard rather than pass", () => {
  const n = gravyTurn();
  const find = nm => { for(const z of ["hand", "deck", "grave", "pitch", "banish"]) for(const c of (n.sides[0][z] || [])) if(c && c.name === nm) return c; return null; };
  const oyst = find("Oysten, Heart of Gold"), port = find("Portside Exchange");
  const sides = n.sides.slice(), sd = Object.assign({}, sides[0]);
  const gone = [oyst.uid, port.uid];
  for(const z of ["hand", "deck", "pitch", "banish"]) sd[z] = (sd[z] || []).filter(c => gone.indexOf(c.uid) < 0);
  sd.hand = []; sd.arsenal = null; sd.ap = 1; sd.board = [];   /* no ally already in play to spend the point on */
  sd.grave = [Object.assign({}, oyst, {_gy: n.turn - 1}), Object.assign({}, port, {_gy: n.turn})];
  sides[0] = sd;
  const g = Object.assign({}, n, {sides});
  assert.equal(J.legal(g, {t: "play", uid: oyst.uid, from: "grave"}, 0), null, "the play is legal (the position is the one described)");
  /* play Gravy's turn out (a free instant like Compass may come first) */
  let m = g, played = false;
  for(let i = 0; i < 60 && !played && m.turn === n.turn && !m.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SPL.SP.act(m, s); if(!a) continue;
      if(s === 0 && a.t === "play" && a.uid === oyst.uid && a.from === "grave") played = true;
      const o = J.reduce(m, a, s); if(o.error) continue;
      m = o.state; moved = true;
    }
    if(!moved) break;
  }
  assert.ok(played, "Oysten is played from the graveyard before the turn ends");
});

/* THE COACH (trainer's Coach's call) looks in the graveyard too, through the same reader.
   Control: the same position without the hero's watery grave coaches no graveyard play.
   Sabotage checked: dropping the graveyard loop from `advise` fails the first row. */
test("the coach names a graveyard play when the rules allow one, and not otherwise", () => {
  const A = require("../engine/advisor.js");
  const deck = SPL.match("gravy", "kayo", "bluegy-coach", 0).sides[0].deck;
  const sw = deck.find(c => c.name === "Swabbie"), port = deck.find(c => c.name === "Portside Exchange");
  const side = {hp: 20, hand: [], arsenal: null, gear: [], board: [], deck: [], pitch: [], banish: [], soul: [], counters: {},
                weaponUsed: {}, res: 3, ap: 1, hist: {atk: 0, non: 0}, grave: [Object.assign({}, sw, {_gy: 4}), Object.assign({}, port, {_gy: 5})]};
  const g = {mode: "act", turn: 5, ap: 1, res: 3, hist: {atk: 0, non: 0}, weaponUsed: {}, incoming: 0,
             sides: [side, {hp: 20, hand: [], arsenal: null, gear: [], board: [], deck: [], pitch: [], grave: [], banish: [], soul: []}]};
  assert.match(A.advise(g, {window: "act", runeDmg: 1, wateryGrave: true}).line, /^Play Swabbie from your graveyard/);
  assert.doesNotMatch(A.advise(g, {window: "act", runeDmg: 1, wateryGrave: false}).line, /graveyard/);
});
