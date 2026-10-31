/* ============================================================
   A GAME THAT CANNOT MOVE ANY MORE ENDS AS A DRAW.

   RULING (user, 2026-10-31): "A match can certainly end in a draw - in the
   future we may need a sudden death mechanic, there is one in place for
   tournaments already."

   CR 4.5.3 has no deck-out loss, so a game with both decks empty and
   nothing left that either seat can pay for never ended: the self-play
   harness hit its step limit and reported a policy loop. `judge.reduce` now
   ends it, after every action, when BOTH decks are empty AND no seat's life
   or any zone's cards (`stillSig`) changed for `STALEMATE_TURNS` turns.

   ASKED IN BOTH DIRECTIONS, because a check that only ever sees the dead
   position passes for a rule that ends every game:
     - the dead position ends as a draw, on the turn the window fills and not
       one turn earlier;
     - the same stillness with a card left in a deck does not end;
     - a change after a long quiet spell starts the window again.
   The position is CONSTRUCTED from a real match, not a recorded seed: a seed
   is reproducible, not repeatable, and rots at the next engine change.
   Arakni at 1 life and Dash at 2, decks empty, weapons gone, each holding one
   card it has no way to pay for but itself (Arakni's goes off once, for a
   point of damage; the position that is left is the dead one).

   ASSERTED ON STATE (over, turn, still), never on prose, except where the line
   IS the observable: the draw's own feed line, which the result screen reads
   through `drawText`.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const S = require("../tools/selfplay.js");
const INV = require("../engine/invariants.js");
const J = S.J, SP = S.SP;

function deadStart(){
  const g = S.match("arakni", "dash", "dead-1", 0);
  const sides = g.sides.map((sd, i) => {
    const costly = sd.deck.concat(sd.hand).find(c => c.cost >= 1 && !/Reaction|Instant/.test(c.tt || ""));
    assert.ok(costly, "fixture: each seat needs a card it cannot pay for alone");
    return {...sd, deck: [], hand: [costly], pitch: [], arsenal: null, hp: i ? 2 : 1,
            gear: sd.gear.filter(c => !(c.ty || []).includes("Weapon"))};
  });
  return {...g, sides};
}

/* Drive with `act` (default: the real policy) and hand every state, in order,
   to `seen`. The game is the engine's: it stops when `over` is set. */
function drive(g, act, limit, seen){
  act = act || SP.act;
  let n = g;
  for(let i = 0; i < (limit || 800) && !n.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = act(n, s);
      if(!a) continue;
      const out = J.reduce(n, a, s);
      assert.equal(out.error, null, "the judge refused " + JSON.stringify(a));
      n = out.state; moved = true;
      if(seen) seen(n);
      break;
    }
    if(!moved) break;
  }
  return n;
}
/* Both seats only pass (and decline to arsenal) until `until(g)` says stop. */
const quietAct = until => (g, seat) => {
  const a = SP.act(g, seat);
  if(!a || a.t === "pass" || a.t === "endTurn") return a;
  if(until && until(g)) return a;
  return a.t === "arsenal" ? {t: "arsenal", uid: null} : {t: "pass"};
};

test("a dead position ends as a draw, on the turn the window fills and not one turn earlier", () => {
  const states = [];
  const end = drive(deadStart(), null, 800, s => states.push(s));
  assert.ok(end.over, "the engine ended it (it used to run to the harness's limit)");
  assert.equal(end.over.winner, null, "a draw has no winner");
  assert.equal(end.over.how, "stalemate");
  assert.deepEqual(end.sides.map(s => s.deck.length), [0, 0]);
  assert.ok(end.sides.every(s => s.hp > 0), "nobody was down: this is not a life result");
  assert.equal(end.turn - end.still.since, J.STALEMATE_TURNS, "it ended on the turn the window filled");
  /* NOT ONE TURN EARLIER: every state before the last was running, and one of
     them sat exactly one turn short of the line. */
  const before = states.slice(0, -1);
  assert.ok(before.every(s => !s.over), "an earlier state was already over");
  assert.ok(before.some(s => s.turn - s.still.since === J.STALEMATE_TURNS - 1), "fixture: the window passed through N-1");
  assert.ok(before.every(s => s.turn - s.still.since < J.STALEMATE_TURNS));
  /* the draw is a state the rest of the engine can hold */
  assert.deepEqual(INV.errors(end), [], "the drawn state is clean to the invariants");
  assert.equal(S.classify(end), "DRAW");
  assert.equal(J.legal(end, {t: "pass"}, 0) != null, true, "a finished game takes no more actions");
});

test("the same stillness with a card left in a deck does not end", () => {
  /* Both seats only pass, from a real opening: hands stay at intellect and
     nothing moves while the decks still hold cards. */
  const end = drive(S.match("kayo", "gravy", "loop-1", 0), quietAct(), 600);
  assert.ok(!end.over, "nobody attacks: the game cannot end, and the engine did not end it");
  assert.ok(end.sides.every(s => s.deck.length > 0), "fixture: cards left in both decks");
  assert.ok(end.turn - end.still.since >= J.STALEMATE_TURNS, "fixture: genuinely quiet, so ONLY the decks keep it going (quiet " + (end.turn - end.still.since) + ")");
  assert.equal(S.classify(end), "STALL", "and the harness still calls it the loop it is");
  /* one deck empty, one not, is the same: both must be spent */
  const half = {...deadStart()};
  half.sides = half.sides.map((sd, i) => i ? {...sd, deck: sd.deck.length ? sd.deck : [sd.hand[0]]} : sd);
  const g1 = J.stalemateCheck({...half, still: {sig: J.stillSig(half), since: half.turn - 99}});
  assert.ok(!g1.over, "a card in one deck is a way out");
  const spent = J.stalemateCheck({...deadStart(), still: {sig: J.stillSig(deadStart()), since: deadStart().turn - 99}});
  assert.ok(spent.over && spent.over.winner === null, "control: with both decks spent the same long stillness is a draw");
});

test("a change after a long quiet spell starts the window again", () => {
  /* Passes until turn 15, then the real policy is released for ONE action (its
     card goes off: a change), then passes again. The draw comes a full window
     after THAT change, not after the start. */
  let released = false, changeTurn = null, lastSig = null;
  const act = (g, seat) => {
    const a = SP.act(g, seat);
    if(!a || a.t === "pass" || a.t === "endTurn") return a;
    if(g.turn >= 15 && !released && a.t !== "arsenal"){ released = true; return a; }
    return a.t === "arsenal" ? {t: "arsenal", uid: null} : {t: "pass"};
  };
  const end = drive(deadStart(), act, 1200, s => {
    const sig = J.stillSig(s);
    if(lastSig != null && sig !== lastSig) changeTurn = s.turn;
    lastSig = sig;
  });
  assert.ok(released && changeTurn >= 15, "fixture: something moved at turn " + changeTurn);
  assert.ok(end.over && end.over.winner === null);
  assert.equal(end.turn - changeTurn, J.STALEMATE_TURNS, "a full window after the last change");
  assert.ok(end.turn > J.STALEMATE_TURNS + 14, "and so later than a window from the start");
});

test("each thing a seat can change is movement, and an untap is not", () => {
  const g = deadStart();
  const sig = J.stillSig(g);
  const sd = (i, f) => ({...g, sides: g.sides.map((x, j) => j === i ? {...x, ...f(x)} : x)});
  assert.notEqual(J.stillSig(sd(0, x => ({hp: x.hp - 1}))), sig, "life");
  assert.notEqual(J.stillSig(sd(1, x => ({hand: []}))), sig, "hand");
  assert.notEqual(J.stillSig(sd(0, x => ({grave: x.hand}))), sig, "graveyard");
  assert.notEqual(J.stillSig(sd(1, x => ({arsenal: x.hand[0]}))), sig, "arsenal");
  assert.notEqual(J.stillSig(sd(0, x => ({banish: x.hand}))), sig, "banish");
  assert.notEqual(J.stillSig(sd(1, x => ({soul: x.hand}))), sig, "soul");
  assert.notEqual(J.stillSig(sd(0, x => ({board: x.hand}))), sig, "board");
  assert.equal(J.stillSig(sd(0, x => ({heroTapped: !x.heroTapped, res: 3}))), sig, "tapped flags and resources are not progress");
  assert.deepEqual(J.STILL_ZONES, INV.LIST_ZONES, "the zones the tracker watches are the census's own list");
});

test("the draw is said plainly, in words with no identifiers, and every reader handles it", () => {
  const end = drive(deadStart(), null, 800);
  const t = J.drawText(end.over, end.sides);
  assert.ok(t, "a draw has a text");
  assert.equal(t.status, "Draw — both decks are spent and neither hero can win.");
  /* the line IS the observable here: the feed carries exactly the status line */
  assert.ok(end.feed.includes(t.status), "the feed says it");
  for(const w of [t.status, t.title, t.names, t.note])
    assert.ok(!/[_{}<>]|\bwinner\b|\bstalemate\b|\bstill\b|\bnull\b|\bv\d/.test(w), "no identifier in player text: " + w);
  assert.equal(J.drawText({winner: 0, how: "life"}, end.sides), null, "a win has no draw text");
  assert.equal(J.drawText(null, end.sides), null);
  /* the readers: the ladder counts it as a draw, the wire carries it, the report keeps it */
  assert.equal(S.ladderLine(10, 0, ["a-b-1"], 150), "GAMES 10 · stalls 0 · draws 1 (a-b-1) · avg turns 15.0");
  const W = require("../engine/wire.js");
  assert.deepEqual(W.decode(W.encode(end)).over, {winner: null, how: "stalemate"});
  assert.deepEqual(W.decode(W.encode(end)).still, end.still, "the tracker rides the wire");
  /* and the trainer-shaped flat state the sides layer converts keeps the tracker */
  const SD = require("../engine/sides.js");
  assert.ok(SD.GAME_KEYS.includes("still"), "the tracker is a registered game key");
  assert.deepEqual(SD.toSides(SD.fromSides(end)).still, end.still, "and survives the flat round trip");
});

test("the table board reads the draw through drawText, not through a winner (source pin, said as such)", () => {
  /* index.html's babel blocks cannot run in node, so this is a claim about the
     SOURCE and is pinned precisely enough that neutering it fails: every place
     the table board used to index `g.sides[over.winner]` is behind `drawText`. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/const drawText = DawnJudge\.drawText\(over, g\.sides\)/.test(html), "the board asks the engine for the draw text");
  const at = html.indexOf("const drawText = DawnJudge.drawText");
  const board = html.slice(at, html.indexOf("note && <div className=\"tblerr\">", at));
  const uses = board.match(/g\.sides\[(1-)?over\.winner\]/g) || [];
  assert.ok(uses.length >= 3, "fixture: the winner is still indexed for a decided game (" + uses.length + ")");
  for(const m of board.matchAll(/g\.sides\[(?:1-)?over\.winner\]/g)){
    const pre = board.slice(Math.max(0, m.index - 220), m.index);
    assert.ok(/\bdrawText\s*\?/.test(pre), "a winner-indexed read not behind a `drawText ?` branch: " + pre.slice(-90));
  }
});

/* ============================================================
   A POSITION THAT CYCLES IS DEAD TOO (v5.67).

   `lyath-boltyn-24` ran to the harness's step limit with both decks empty,
   Lyath on 1 life against 5: every turn Lyath paid two cards for a Might token
   (the cards went to the empty deck's bottom and straight back) and Boltyn
   swung a weapon for nothing. The position repeated exactly, but a FRESH token
   serial appeared each turn, so `stillSig` changed every turn and the first
   test never fired. `still.loop` looks once a turn at `loopSig` (tokens by
   NAME, zones as sets, counters, life) and ends the game when no new position
   has appeared for `STALEMATE_TURNS` turns with both decks empty.

   THE POSITIONS ARE CONSTRUCTED AND CYCLED BY HAND, through `stalemateCheck`
   (the one function `reduce` calls after every action), because the real
   game's cycle is the AI policy's and rots with it; the real game is replayed
   in the release's validation. Each drill asks the other direction too: a
   cycle with a life change in it, with a card in a deck, with a growing board
   or a growing counter must NOT end, and the same cycle without that must.
   ASSERTED ON STATE (over, turn, still), never on prose.
   ============================================================ */
const mintTok = (name, n) => { const c = {name, uid: "tok" + n, ty: ["Generic", "Token", "Aura"], tt: "Generic Token - Aura", pitch: 0}; return {card: c, uid: c.uid}; };
const edit = (g, i, f) => ({...g, sides: g.sides.map((x, j) => j === i ? {...x, ...f(x)} : x)});

/* Runs the cycle through `stalemateCheck`, one call per change, and hands every
   state to `seen`. Each turn: the turn flips (the first look of the turn is the
   boundary), seat 0 pitches its cards (a change), they come back in another
   order, and the token is reminted under a new serial. `each(g, t)` may alter
   the position on turn t. */
function cycle(start, turns, each, seen){
  let n = {...start, turn: 1, still: undefined}, serial = 100;
  n = edit(n, 0, sd => ({board: [mintTok("Might", serial++)]}));
  n = J.stalemateCheck(n);
  for(let t = 0; t < turns && !n.over; t++){
    n = J.stalemateCheck({...n, turn: n.turn + 1});
    if(each) n = J.stalemateCheck(each(n, t));
    if(n.over) break;
    n = J.stalemateCheck(edit(n, 0, sd => ({hand: [], pitch: sd.pitch.concat(sd.hand)})));
    n = J.stalemateCheck(edit(n, 0, sd => ({pitch: [], hand: sd.pitch.slice().reverse(), board: [mintTok("Might", serial++)]})));
    if(seen) seen(n);
  }
  return n;
}
/* two cards in seat 0's hand, so the order they come back in can differ */
const cycleStart = () => { const g = deadStart(); return edit(g, 0, sd => ({hand: sd.hand.concat(sd.hand.map(c => ({...c, uid: "x" + c.uid, name: c.name + " II"})))})); };

test("a position that cycles with both decks empty ends as a draw, a full window after its last new position", () => {
  const seen = [];
  const end = cycle(cycleStart(), 200, null, s => seen.push(s));
  assert.ok(end.over && end.over.winner === null && end.over.how === "stalemate", "the cycle ended as a draw (it used to run on)");
  assert.deepEqual(end.sides.map(s => s.deck.length), [0, 0]);
  assert.equal(end.turn - end.still.loop.since, J.STALEMATE_TURNS, "on the turn the window filled");
  /* FIXTURE: this is the shape the first test cannot see - it moved every turn, so only the loop tracker is idle */
  assert.ok(seen.every(s => s.turn - s.still.since <= 1), "fixture: the exact tracker never sat idle for even two turns");
  assert.ok(seen.some(s => s.turn - s.still.loop.since === J.STALEMATE_TURNS - 1), "fixture: the window passed through N-1");
  assert.ok(seen.every(s => !s.over && s.turn - s.still.loop.since < J.STALEMATE_TURNS), "and nothing ended earlier");
  assert.ok(end.turn <= 30, "a cycle that has stopped finding anything new ends in about a window, not hundreds of turns (" + end.turn + ")");
});

test("the census reads a token by its name and a zone as a set; everything else still moves it", () => {
  const g0 = edit(cycleStart(), 0, sd => ({board: [mintTok("Might", 1)]}));
  const sig = J.loopSig(g0);
  const swap = f => J.loopSig(edit(g0, 0, f));
  assert.equal(swap(() => ({board: [mintTok("Might", 2)]})), sig, "a new serial of the same token is the same position");
  assert.notEqual(J.stillSig(edit(g0, 0, () => ({board: [mintTok("Might", 2)]}))), J.stillSig(g0), "fixture: the exact census DOES see the serial");
  assert.equal(swap(sd => ({hand: sd.hand.slice().reverse()})), sig, "the same cards in another order are the same position");
  assert.notEqual(swap(() => ({board: [mintTok("Runechant", 1)]})), sig, "a different token");
  assert.notEqual(swap(sd => ({board: sd.board.concat([mintTok("Might", 3)])})), sig, "one more of the same token");
  assert.notEqual(swap(sd => ({hp: sd.hp - 1})), sig, "life");
  assert.notEqual(swap(sd => ({hand: sd.hand.slice(1)})), sig, "a card gone from the hand");
  assert.notEqual(swap(sd => ({hand: [], pitch: sd.hand})), sig, "a card in another zone");
  assert.notEqual(swap(() => ({counters: {tok1: {pow: 1}}})), sig, "a counter on a token");
  assert.equal(swap(() => ({counters: {tok1: {pow: 0}}})), sig, "a counter at zero is none");
  assert.equal(swap(sd => ({heroTapped: !sd.heroTapped, res: 3})), sig, "tapped flags and resources are not progress");
});

test("a life change inside the window starts it again", () => {
  const base = cycle(cycleStart(), 200);
  const hit = cycle(cycleStart(), 200, (g, t) => t === 12 ? edit(g, 1, sd => ({hp: sd.hp + 1})) : g);
  assert.ok(hit.over && hit.over.winner === null, "it is still a draw, later");
  assert.ok(hit.turn > base.turn, "the change moved the draw back: " + base.turn + " -> " + hit.turn);
  assert.ok(hit.turn - 13 >= J.STALEMATE_TURNS, "a full window after the change (turn 13 on), not after the start");
  assert.equal(hit.turn - hit.still.loop.since, J.STALEMATE_TURNS);
  /* and one point of life, taken a few turns before the draw, saves the game for another window */
  const late = cycle(cycleStart(), 200, (g, t) => t === base.turn - 4 ? edit(g, 0, sd => ({hp: sd.hp + 1})) : g);
  assert.ok(late.turn >= base.turn + J.STALEMATE_TURNS - 4, "a late change restarted the window (" + late.turn + " vs " + base.turn + ")");
});

test("a cycle with a card still in a deck does not end, and counts only the turns the decks are empty", () => {
  const withDeck = g => edit(g, 1, sd => ({deck: [sd.hand[0]]}));
  const held = cycle(withDeck(cycleStart()), 120, null);
  assert.ok(!held.over, "a card in a deck is a way out (turn " + held.turn + ")");
  assert.equal(held.still.loop.since, held.turn, "and the window never opened");
  /* the deck empties at turn 15: the window opens THEN, not at the start */
  let emptied = null;
  const end = cycle(withDeck(cycleStart()), 200, (g, t) => { if(t === 15){ emptied = g.turn; return edit(g, 1, sd => ({deck: []})); } return g; });
  assert.ok(end.over && end.over.winner === null);
  assert.ok(end.turn - emptied >= J.STALEMATE_TURNS, "a full window after the deck emptied (" + (end.turn - emptied) + ")");
  assert.ok(cycle(cycleStart(), 200).over, "control: the same cycle with empty decks ends");
});

test("a seat that keeps building, or keeps counting, is not idle; the same cycle that stops is", () => {
  const grow = stopAt => cycle(cycleStart(), 100, (g, t) => t < stopAt ? edit(g, 1, sd => ({board: sd.board.concat([mintTok("Runechant", 500 + t)])})) : g);
  const going = grow(1000);
  assert.ok(!going.over, "one more Runechant every turn is progress toward something (turn " + going.turn + ")");
  const stopped = grow(30);
  assert.ok(stopped.over && stopped.over.winner === null, "control: the same board, once it stops growing, is dead");
  assert.ok(stopped.turn - 30 >= J.STALEMATE_TURNS, "a full window after the last Runechant");
  /* a counter that climbs each turn on a card in play */
  const piece = cycleStart().sides[0].gear[0];
  assert.ok(piece && piece.uid != null, "fixture: a real card in play to hold counters");
  const count = stopAt => cycle(cycleStart(), 100, (g, t) => t < stopAt ? edit(g, 0, () => ({counters: {[piece.uid]: {pow: t + 1}}})) : g);
  assert.ok(!count(1000).over, "a counter that keeps climbing is progress");
  const settled = count(25);
  assert.ok(settled.over && settled.turn - 25 >= J.STALEMATE_TURNS, "control: once it stops climbing the position is dead");
});

test("the loop tracker is a game key that rides the wire, and the first test is unchanged beside it", () => {
  const end = cycle(cycleStart(), 5);
  assert.ok(end.still.loop && Array.isArray(end.still.loop.ring) && end.still.loop.ring.length <= J.LOOP_RING);
  const W = require("../engine/wire.js");
  assert.deepEqual(W.decode(W.encode(end)).still, end.still, "the tracker, loop and all, rides the wire");
  /* an old tracker ({sig, since}, no loop) still reads, and still draws by the first test */
  const old = J.stalemateCheck({...deadStart(), still: {sig: J.stillSig(deadStart()), since: deadStart().turn - 99}});
  assert.ok(old.over && old.over.how === "stalemate", "the first test is unchanged");
  assert.ok(old.still.loop, "and a game that arrives without a loop tracker grows one");
  /* the first look of a game with no tracker at all opens no window */
  const fresh = J.stalemateCheck(deadStart());
  assert.ok(!fresh.over && fresh.still.loop.since === fresh.turn);
});

test("a cycle of up to LOOP_RING positions is dead, and a longer one is a stated limit, not a draw", () => {
  const pool = Array.from({length: J.LOOP_RING + 2}, (_, i) => ({uid: "b" + i, name: "Banished " + i, pitch: 1, cost: 0, tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: []}));
  /* the position at each turn's start walks through k different banish zones, then comes round again */
  const walk = k => cycle(cycleStart(), 160, (g, t) => edit(g, 0, () => ({banish: pool.slice(0, t % k)})));
  for(const k of [2, 3, J.LOOP_RING]){
    const end = walk(k);
    assert.ok(end.over && end.over.winner === null, "a cycle of " + k + " positions is dead (turn " + end.turn + ")");
  }
  const long = walk(J.LOOP_RING + 1);
  assert.ok(!long.over, "STATED LIMIT: a cycle longer than the ring is not drawn (tools/approx.js, `trainer-no-stalemate-draw`) - turn " + long.turn);
  assert.equal(J.LOOP_RING, 8, "the ring is the measured choice: change it with the numbers in the header of the cycle block in judge.js");
});
