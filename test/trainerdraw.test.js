/* ============================================================
   THE TRAINER ENDS A DEAD POSITION AS A DRAW, THROUGH THE TABLE'S OWN BODY.

   RULING (user, 2026-10-31): "A match can certainly end in a draw - in the
   future we may need a sudden death mechanic, there is one in place for
   tournaments already." The table has ended a dead position as a draw since
   v5.62 (`judge.stalemateCheck`, test/stalemate.test.js). The trainer did
   not (the stated approximation `trainer-no-stalemate-draw`); it does now,
   and it has NO copy of the rule: `Battle`'s `setG` - the trainer's
   `reduce` - runs every committed state through `judge.stalemateCheck`.

   `Battle` is a closure inside a babel block, so no drill can call it. What
   this file runs is the REAL `setG` source, cut out of index.html and
   evaluated against the real engine (test/helpers/trainerfunnel.js, which the
   approximation probe uses too), with the one thing it needs from React
   (`setGRaw`) replaced by a variable. A cut that did not find the funnel, or
   a funnel that no longer calls the shared body, fails by name. The page
   itself is driven by the offline harness (tools/page.js; the result screen).

   ASKED IN BOTH DIRECTIONS, because a check that only ever sees the dead
   position passes for a rule that ends every game:
     - the dead position ends as a draw on the turn the window fills, and
       not one turn earlier, the same turn the table's body ends it;
     - the same stillness with a card in EITHER deck does not end;
     - a change after a long quiet spell starts the window again;
     - a position that only cycles ends too (the token-serial loop);
     - the trainer's own `{win}` results are not draws.
   The positions are CONSTRUCTED (a seed is reproducible, not repeatable) and
   ASSERTED ON STATE (over, turn, still), never on prose, except the draw's own
   feed line, which IS the observable and is read through `drawText`.

   REACHABILITY, MEASURED ON THE SOURCE (said here so the record can be
   checked): the vanilla dummy recycles its graveyard into its deck when it
   draws short (`endPhaseCF` (f), gated on `_dummy`), and its scripted swing
   moves the player's life or cards every turn it is not wholly blocked. So a
   trainer position with both decks spent and a quiet window is a net under the
   game, not a path through it; the draws below start from a constructed state.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../tools/selfplay.js");
const J = S.J;
const {HTML, cutSetG, trainerFunnel} = require("./helpers/trainerfunnel.js");

/* The trainer's own state shape: `sides` and the flat game keys, `over: null`,
   no table `priority`/`phase`/`step`. Dead: Arakni (1 life) and Dash (2),
   decks empty, weapons gone, one card each that it cannot pay for. */
function deadTrainer(){
  const g = S.match("arakni", "dash", "trdraw-1", 0);
  const sides = g.sides.map((sd, i) => {
    const costly = sd.deck.concat(sd.hand).find(c => c.cost >= 1 && !/Reaction|Instant/.test(c.tt || ""));
    assert.ok(costly, "fixture: each seat needs a card it cannot pay for alone");
    return {...sd, deck: [], hand: [costly], pitch: [], arsenal: null, hp: i ? 2 : 1,
            gear: sd.gear.filter(c => !(c.ty || []).includes("Weapon"))};
  });
  return {sides, turn: 30, mode: "act", bphase: "defend", over: null, log: [], feed: [], inspect: false};
}
const edit = (g, i, f) => ({...g, sides: g.sides.map((x, j) => j === i ? {...x, ...f(x)} : x)});
const tick = s => ({...s, turn: s.turn + 1});

test("the trainer's funnel is the table's body: a dead position is a draw on the turn the window fills, never earlier", () => {
  const T = trainerFunnel(deadTrainer());
  const table = {g: J.stalemateCheck(deadTrainer())};
  T.setG(s => s);                       /* the first look: the window starts here */
  const since = T.g.still.since, seen = [];
  for(let i = 0; i < 40 && !T.g.over; i++){
    T.setG(tick); table.g = J.stalemateCheck(tick(table.g));
    seen.push(T.g);
  }
  const end = T.g;
  assert.deepEqual(end.over, {winner: null, how: "stalemate"}, "the trainer ended the dead position as a draw");
  assert.equal(end.turn - since, J.STALEMATE_TURNS, "on the turn the window filled");
  assert.ok(seen.some(s => s.turn - since === J.STALEMATE_TURNS - 1 && !s.over), "fixture: the window passed through N-1 not over");
  assert.ok(seen.slice(0, -1).every(s => !s.over && s.turn - since < J.STALEMATE_TURNS), "and nothing ended a turn earlier");
  /* the SAME body: the table's own call over the same states says the same thing on the same turn */
  assert.deepEqual(table.g.over, end.over, "the table's body agrees");
  assert.equal(table.g.turn, end.turn, "on the same turn");
  assert.deepEqual(table.g.still, end.still, "with the same tracker");
  /* plain words, from the one text; the feed carries the status line */
  const t = J.drawText(end.over, end.sides);
  assert.ok(t && t.status && end.feed.includes(t.status), "the feed says it, in drawText's words");
  assert.equal(t.title, "A DRAW");
  /* the result is final: a later state through the funnel keeps it */
  T.setG(tick);
  assert.deepEqual(T.g.over, {winner: null, how: "stalemate"}, "a finished game is left alone");
});

test("a card left in EITHER deck keeps the game open, however long it sits", () => {
  for(const seat of [0, 1]){
    const g0 = deadTrainer();
    const card = {...g0.sides[seat].hand[0], uid: "spare-" + seat, name: "Spare " + seat};
    const T = trainerFunnel(edit(g0, seat, () => ({deck: [card]})));
    T.setG(s => s);
    for(let i = 0; i < 60; i++) T.setG(tick);
    assert.equal(T.g.over, null, "seat " + seat + ": a deck with a card in it is a way out (idle " + (T.g.turn - T.g.still.since) + ")");
    assert.ok(T.g.turn - T.g.still.since >= J.STALEMATE_TURNS, "fixture: genuinely quiet, so ONLY the deck keeps it going");
    /* and taking the card away is what lets it end, a window later at most */
    T.setG(s => edit(s, seat, () => ({deck: []})));
    for(let i = 0; i < J.STALEMATE_TURNS + 2 && !T.g.over; i++) T.setG(tick);
    assert.deepEqual(T.g.over, {winner: null, how: "stalemate"}, "seat " + seat + ": the same position without the card is dead");
  }
});

test("a change after a long quiet spell starts the window again", () => {
  const T = trainerFunnel(deadTrainer());
  T.setG(s => s);
  for(let i = 0; i < J.STALEMATE_TURNS - 5; i++) T.setG(tick);
  assert.equal(T.g.over, null, "fixture: still open fifteen turns in");
  T.setG(s => edit(s, 0, sd => ({hp: sd.hp + 1})));          /* a point of life: the position moved */
  const changed = T.g.turn;
  for(let i = 0; i < 40 && !T.g.over; i++) T.setG(tick);
  assert.deepEqual(T.g.over, {winner: null, how: "stalemate"});
  assert.equal(T.g.turn - changed, J.STALEMATE_TURNS, "a full window after the last change, not after the start");
});

const mintTok = (name, n) => { const c = {name, uid: "tok" + n, ty: ["Generic", "Token", "Aura"], tt: "Generic Token - Aura", pitch: 0}; return {card: c, uid: c.uid}; };

test("a position that only cycles (a token re-minted under a new serial) ends too, through the same funnel", () => {
  let g0 = deadTrainer();
  g0 = edit(g0, 0, sd => ({hand: sd.hand.concat(sd.hand.map(c => ({...c, uid: "x" + c.uid, name: c.name + " II"}))),
                           board: [mintTok("Might", 100)]}));
  const T = trainerFunnel(g0);
  let serial = 101;
  const seen = [];
  T.setG(s => s);
  for(let t = 0; t < 100 && !T.g.over; t++){
    T.setG(tick);
    if(T.g.over) break;
    T.setG(s => edit(s, 0, sd => ({hand: [], pitch: sd.pitch.concat(sd.hand)})));
    T.setG(s => edit(s, 0, sd => ({pitch: [], hand: sd.pitch.slice().reverse(), board: [mintTok("Might", serial++)]})));
    seen.push(T.g);
  }
  assert.deepEqual(T.g.over, {winner: null, how: "stalemate"}, "the cycle ended as a draw");
  assert.ok(seen.every(s => s.turn - s.still.since <= 1), "fixture: the exact tracker never sat idle - only the loop tracker is");
  assert.equal(T.g.turn - T.g.still.loop.since, J.STALEMATE_TURNS, "on the turn the loop window filled");
  assert.ok(T.g.turn - g0.turn <= 30, "about a window, not hundreds of turns (" + (T.g.turn - g0.turn) + ")");
});

test("the trainer's own results are not draws: a {win} is never read as one", () => {
  const sides = deadTrainer().sides;
  assert.equal(J.drawText({win: true, score: 7}, sides), null, "a kill");
  assert.equal(J.drawText({win: false}, sides), null, "a loss");
  assert.equal(J.drawText(null, sides), null);
  assert.equal(J.drawText({winner: 1, how: "life"}, sides), null);
  assert.ok(J.drawText({winner: null, how: "stalemate"}, sides), "and a draw is one");
  /* a game the trainer already decided is left exactly as it was */
  const won = {...deadTrainer(), over: {win: true, score: 7}};
  const T = trainerFunnel(won);
  for(let i = 0; i < 40; i++) T.setG(tick);
  assert.deepEqual(T.g.over, {win: true, score: 7}, "a won trainer game is not turned into a draw");
});

test("the trainer keeps no second copy of the rule, and its result screen reads the shared words (source pin, said as such)", () => {
  /* index.html's babel blocks cannot run in node, so this is a claim about the SOURCE, pinned
     so that neutering it fails: one call into the shared body, no census of its own. */
  const html = HTML.replace(/\/\*[\s\S]*?\*\//g, "");
  const funnel = cutSetG(html);
  assert.ok(/DawnJudge\.stalemateCheck\(/.test(funnel), "setG runs every state through the table's check");
  assert.ok(/withPriority\(DawnJudge\.stalemateCheck\(/.test(funnel), "before the priority shadow is derived from it");
  for(const name of ["stillSig", "loopSig", "decksSpent", "STALEMATE_TURNS", "LOOP_RING", "STILL_ZONES", "DRAW_LINE"])
    assert.ok(!new RegExp("\\b" + name + "\\b").test(html), "index.html re-declares or re-reads `" + name + "`: the rule has one copy");
  assert.ok(/DawnJudge\.drawText\(g\.over, g\.sides\)/.test(html), "the trainer's result screen asks the engine for the draw text");
  assert.ok(/<DrawPanel\b/.test(html), "and shows it");
});
