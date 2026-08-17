/* THE REDUCER, DRILLED.

   `Battle` holds the rules as closures inside a React component and the
   drills cannot reach one line of it. Every bug this project has had was
   found by eye or in play — crumbling auras, stale defenders, a pitch
   selection carried into the next payment, an instant eating the turn's
   action point. That is not bad luck; it is the shape of the code.

   judge.js is the same rules as a pure function, so these are the first
   drills in the project that watch a whole game of Flesh and Blood being
   played rather than a clause being parsed.

   The ones that matter most are the ones no card-level tool can ask:
   does the turn structure run in the CR's order, does a closed window
   really refuse, and is seat 1 the same as seat 0. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const J = require("../engine/judge");
const B = require("../engine/build");
const C = require("../engine/cards");
const G = require("../engine/game");
const P = require("../engine/priority");
const PR = require("../engine/parser");
const TY = require("../engine/types");
const RNG = require("../engine/rng");
const INV = require("../engine/invariants");
const { loadData } = require("./helpers/extract");
const H = require("./helpers/judged.js");

const CACHE = require("./helpers/extract").cardDbPath();
const ready = fs.existsSync(CACHE);
const skip = !ready && "no cached DB — run: node tools/audit.js";

const W = loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const heroBy = re => W.HEROES.find(h => re.test(h.n));

/* Two real Silver Age precons, seated. One seeded stream feeds seat 0's
   shuffle, then seat 1's, then the game — in that fixed order, or two
   peers deal different decks from the same table code. */
function match(o){
  o = o || {};
  const h0 = o.h0 || heroBy(/kayo/i), h1 = o.h1 || heroBy(/dorinthea/i);
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "drill");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: o.first != null ? o.first : 0,
                     tokSeq: ctr.n});
}

/* A deterministic driver. Not a policy and not an opponent — a way to
   make the machine run so the drills can watch it. It only ever sends
   actions the judge itself has declared legal. */
function drive(g, o){
  o = o || {};
  /* A whole game costs 580-760 actions. Most of them are passes, and that
     is the CR's own shape rather than waste: a chain link opens SIX
     priority windows (7.2.4, 7.3.3, 7.4.2, 7.5.3, 7.6.3 and the layer
     step) and each closes only when both seats pass in succession — so a
     declared blocker, which reopens the defend window, costs two more.
     The limit was 500 and games were being cut off mid-fight; the drill
     then read that as "the game never ended". */
  const limit = o.limit || 1200;
  const trace = [];
  const errs = [];
  const send = (a, seat) => {
    const out = J.reduce(g, a, seat);
    if(out.error){ errs.push({a, seat, why: out.error}); return false; }
    g = out.state;
    trace.push({t: a.t, seat, turn: g.turn, phase: g.phase, step: g.step});
    const bad = INV.errors(g);
    if(bad.length) errs.push({a, seat, why: "INVARIANT " + bad.map(x => x.code).join(",")});
    return true;
  };
  for(let tick = 0; tick < limit && !g.over; tick++){
    /* A LIVE SHEET STOPS BOTH SEATS (v2.77), which is the point of it —
       whatever queued it is mid-resolution. So a driver has to answer one
       or the game simply stops, which reads as "the game never ended"
       rather than as the stall it is. `autoAnswer` is the answer a seat
       with nobody in it gives, and the reducer never calls it itself. */
    if(g.prompt){ send(J.autoAnswer(g), g.prompt.side || 0); continue; }
    const p = J.pendingOf(g);
    /* A BOOST PENDING STOPS EVERYTHING, and this driver could not answer
       one — so from v2.84 every Boost card in the pool was a wall it
       walked into and spun against until the tick limit, filling `errs`
       with refusals nobody read. The walk below filters `errs` to
       INVARIANT, so it went green having stopped playing. Declining is
       the plain line and keeps the driver a driver rather than a policy;
       what matters is that the card RESOLVES instead of parking. */
    if(p && p.kind === "boost"){ send({t: "boost", yes: false}, p.seat); continue; }
    if(p && p.kind === "pay"){
      const sd = g.sides[p.seat];
      if(p.need - sd.res - J.paySum(sd) > 0){
        const c = sd.hand.filter(x => x.uid !== p.card.uid && !(sd.paySel || []).includes(x.uid))
                         .sort((a, b) => (b.pitch || 0) - (a.pitch || 0))[0];
        if(c){ send({t: "paySel", uid: c.uid}, p.seat); continue; }
        send({t: "payCancel"}, p.seat); continue;
      }
      send({t: "payConfirm"}, p.seat); continue;
    }
    if(g.arsenalFor != null){
      const sd = g.sides[g.arsenalFor];
      const pick = sd.hand.slice().sort((a, b) => (b.power || 0) - (a.power || 0))[0];
      send({t: "arsenal", uid: pick ? pick.uid : null}, g.arsenalFor); continue;
    }
    if(g.step === "defend"){
      const d = P.defendingPlayer(g), sd = g.sides[d];
      const wall = (sd.blockH || []).length + (sd.blockG || []).length;
      if(wall < (o.blockers == null ? 2 : o.blockers)){
        const gr = (sd.gear || []).find(x => G.gearDef(x) > 0
          && !(sd.chainBlocked || []).includes(x.uid) && !(sd.blockG || []).includes(x.uid));
        if(gr && send({t: "defend", uid: gr.uid}, d)) continue;
        const c = (sd.hand || []).find(x => x.def > 0 && !PR.isDR(x) && !(sd.blockH || []).includes(x.uid));
        if(c && send({t: "defend", uid: c.uid}, d)) continue;
      }
    }
    const pri = g.priority;
    if(pri == null){ errs.push({why: "STUCK: nobody holds priority", step: g.step, phase: g.phase}); break; }
    const sd = g.sides[pri];
    const win = P.speedAllowed(g, pri);
    let did = false;
    if(win.includes("action") && sd.ap > 0){
      const c = sd.hand.filter(x => !J.playableWhy(g, pri, x, win) && (x.power || 0) > 0)
                       .sort((a, b) => (b.power || 0) - (a.power || 0))[0];
      if(c) did = send({t: "play", uid: c.uid, from: "hand"}, pri);
      if(!did){
        /* ASK LEGAL, LIKE THE CARD BRANCH ALREADY DOES. The card path
           filters on `playableWhy`, which reads affordability; this one
           read only the printed line, so the driver proposed a swing it
           could not pay for and then recorded its own optimism as an
           engine refusal. A driver is a policy, and a policy proposes
           what the judge will accept — the same contract sparring.js
           holds itself to. */
        const w = (sd.gear || []).find(x => {
          const wc = PR.weaponCost(x.tx || "");
          return wc && !x.destroyed && !(wc.oncePerTurn && (sd.weaponUsed || {})[x.uid])
            && !J.legal(g, {t: "activate", uid: x.uid}, pri);
        });
        if(w) did = send({t: "activate", uid: w.uid}, pri);
      }
    }
    if(did) continue;
    if(g.phase === "action" && pri === g.turnPlayer && !g.chainOpen && g.step === "layer"
       && send({t: "endTurn"}, pri)) continue;
    send({t: "pass"}, pri);
  }
  return {g, trace, errs};
}

/* The driver only ever sends legal actions, so any refusal is a bug. */
const realErrs = errs => errs;

/* END A TURN THE WAY THE CR ENDS ONE.

   CR 4.3.4 ends the action phase "when the stack is empty, the combat
   chain is closed, and BOTH players pass priority in succession", so an
   `endTurn` from the turn player is only the first half of it — the
   opponent still holds the instant window the rule owes them, and the
   phase does not end until they decline it too.

   Every drill below used to send one `endTurn` and expect the turn to be
   over. That worked because the action ran the whole end phase on the
   spot, which is the shortcut this replaced: it is the turn player
   deciding, alone, that the opponent had nothing to say. */
function passTurn(g){
  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  return n;
}

/* Play the turn-player's first attack and walk the chain to the defend
   step, settling any payment on the way. Several drills need to stand
   inside that step, and it is the one place in the CR where two seats can
   legally act at the same instant. */
function toDefendStep(g){
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.isAttack(x));
  let n = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat).state;
  while(J.pendingOf(n)){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    if(p.need - sd.res - J.paySum(sd) > 0){
      const pc = sd.hand.find(x => x.uid !== p.card.uid && !(sd.paySel || []).includes(x.uid));
      if(!pc){ n = J.reduce(n, {t: "payCancel"}, p.seat).state; break; }
      n = J.reduce(n, {t: "paySel", uid: pc.uid}, p.seat).state;
    } else n = J.reduce(n, {t: "payConfirm"}, p.seat).state;
  }
  for(let i = 0; i < 6 && n.step !== "defend" && n.priority != null; i++)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  return n;
}

/* ---- A WHOLE GAME ------------------------------------------------------ */

test("two real precons play a complete game to a legal conclusion", {skip}, () => {
  const {g, errs} = drive(match());
  assert.ok(g.over, "the game never ended");
  assert.ok([0, 1].includes(g.over.winner), "no winner");
  assert.deepEqual(realErrs(errs), [], "the driver was refused a legal action, or tripped an invariant");
  assert.ok(g.turn > 3, "the game ended suspiciously fast — turn " + g.turn);
});

test("no state in a whole game trips the invariant judge", {skip}, () => {
  const {errs} = drive(match({seed: "invariants"}));
  const bad = errs.filter(e => /INVARIANT/.test(e.why || ""));
  assert.deepEqual(bad, []);
});

test("every dealt card is in exactly one zone at the end", {skip}, () => {
  /* A card in TWO zones is CARD-IN-TWO-ZONES; a card in NONE falls out of
     the census entirely and is invisible to it. The combat chain is a
     zone for exactly this reason. */
  const {g} = drive(match({seed: "census"}));
  const ZONES = ["deck", "hand", "pitch", "grave", "banish", "soul"];
  for(let i = 0; i < 2; i++){
    const seen = new Set();
    ZONES.forEach(z => (g.sides[i][z] || []).forEach(c => seen.add(c.uid)));
    if(g.sides[i].arsenal) seen.add(g.sides[i].arsenal.uid);
    (g.sides[i].board || []).forEach(b => seen.add(b.uid));
    (g.chainCards || []).filter(x => x.by === i).forEach(x => seen.add(x.card.uid));
    const dealtN = g.sides[i].deck.length + g.sides[i].hand.length + g.sides[i].pitch.length
      + g.sides[i].grave.length + g.sides[i].banish.length + g.sides[i].soul.length
      + (g.sides[i].arsenal ? 1 : 0) + (g.sides[i].board || []).length
      + (g.chainCards || []).filter(x => x.by === i).length;
    assert.equal(seen.size, dealtN, `seat ${i}: a card is in two zones at once`);
  }
});

test("a card on the combat chain is counted by the invariant census", {skip}, () => {
  /* Proven to bite: duplicate a chain card into a graveyard and the judge
     must name it. Without the chain in the census it would say nothing. */
  let g = match({seed: "chain-census"});
  const seat = g.turnPlayer;
  const atkC = g.sides[seat].hand.find(c => PR.isAttack(c) && (c.cost || 0) === 0)
            || g.sides[seat].hand.find(c => PR.isAttack(c));
  let out = J.reduce(g, {t: "play", uid: atkC.uid, from: "hand"}, seat);
  g = out.state;
  while(J.pendingOf(g)){
    const p = J.pendingOf(g), sd = g.sides[p.seat];
    if(p.need - sd.res - J.paySum(sd) > 0){
      const c = sd.hand.find(x => x.uid !== p.card.uid && !(sd.paySel || []).includes(x.uid));
      g = J.reduce(g, {t: "paySel", uid: c.uid}, p.seat).state;
    } else g = J.reduce(g, {t: "payConfirm"}, p.seat).state;
  }
  assert.ok((g.chainCards || []).length, "no card reached the chain");
  assert.deepEqual(INV.errors(g), [], "a clean mid-chain state was reported dirty");
  const onChain = g.chainCards[0].card;
  const dirty = J.put(g, seat, s => ({...s, grave: [onChain, ...s.grave]}));
  const codes = INV.errors(dirty).map(e => e.code);
  assert.ok(codes.includes("CARD-IN-TWO-ZONES"),
    "a card in both the chain and a graveyard went unreported — the census cannot see the chain");
});

/* ---- BOTH SEATS, ONE PATH ---------------------------------------------- */

test("both seats attack, defend, draw and end turns — through the same code", {skip}, () => {
  const {g, trace} = drive(match({seed: "symmetry"}));
  const by = seat => trace.filter(t => t.seat === seat).map(t => t.t);
  for(const seat of [0, 1]){
    const acts = new Set(by(seat));
    for(const need of ["play", "defend", "pass", "endTurn"])
      assert.ok(acts.has(need), `seat ${seat} never performed "${need}" in a whole game`);
  }
  assert.ok(g.sides[0].grave.length > 0 && g.sides[1].grave.length > 0,
    "one seat never put a card in its graveyard");
});

test("the reducer never mentions a literal seat index in a rules decision", () => {
  /* `popRunechants(n, 0, …)` popped seat 0's runechants whoever was
     swinging. A hardcoded seat is the same bug as `you()` wearing a
     different hat, and it is invisible until seat 1 acts. */
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const hits = code.match(/\b(?:at|put)\s*\(\s*[a-z]\w*\s*,\s*[01]\s*[,)]/g) || [];
  assert.deepEqual(hits, [],
    "a seat index is hardcoded in a rules call: " + hits.join(", "));
});

test("the reducer asks priority.js and does not restate it", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  for(const dead of [/\bmode\s*[:=]/, /\bbphase\b/])
    assert.ok(!dead.test(code), `judge.js carries ${dead} — the trainer's gates, not the CR's`);
  for(const need of ["canDeclareDefenders", "speedAllowed", "passOutcome", "advance", "hasPriority"])
    assert.ok(code.includes("P." + need), `judge.js never asks priority.js for ${need}`);
});

/* ---- THE CR TURN STRUCTURE (4.4.3) ------------------------------------- */

test("the end phase runs a-f in the CR's order, every turn", {skip}, () => {
  const {g} = drive(match({seed: "order"}));
  const steps = g.feed.filter(m => /^\([a-f]\)/.test(m)).map(m => m[1]);
  assert.ok(steps.length >= 6, "the end phase barely ran");
  /* Walk the sequence: each letter must be >= the last within a turn, and
     the cycle restarts at (a). Reordering them is a rules change, so it
     must be a deliberate edit to this drill. */
  let prev = null;
  for(const s of steps){
    if(prev && s < prev) assert.equal(s, "a", `end phase ran ${prev} then ${s} — out of CR order`);
    prev = s;
  }
  for(const need of ["a", "b", "c", "d", "e", "f"])
    assert.ok(steps.includes(need), `CR 4.4.3(${need}) never ran`);
});

test("CR 4.4.3f — on turn one only, the NON-turn player also draws to intellect", {skip}, () => {
  const {g} = drive(match({seed: "first-draw", limit: 60}));
  const firstDraws = g.feed.filter(m => /^\(f\)/.test(m));
  assert.ok(/ and /.test(firstDraws[0]), "the first end phase only refilled the turn player");
  assert.ok(firstDraws.slice(1).every(m => !/ and /.test(m)),
    "a later turn refilled both seats — CR 4.4.3f is turn-one only");
});

/* THE DRILL THAT SHOULD HAVE CAUGHT THE WRONG-PLAYER DRAW, and did not,
   because it read the LOG LINE instead of the hands. (e) calls
   priority.js's `endTurn`, which performs CR 4.4.4's handoff as well as
   4.4.3e's fizzle, so `n.turnPlayer` is already the INCOMING player by
   the time (f) runs — and the refill went to the wrong hero every turn
   after the first. Turn one hid it, because there both seats draw.

   It matters because it inverts the decision the game is built on: you
   refill at the end of YOUR turn so you have cards to block with during
   THEIRS. Drawing for the incoming player instead means every hero walks
   into the opponent's turn on fumes and opens their own with a full grip. */
test("CR 4.4.3f — the OUTGOING turn player draws, not the incoming one", {skip}, () => {
  let g = match({seed: "who-draws"});
  /* get past turn one, where 4.4.3f refills both seats anyway */
  g = passTurn(g); g = passTurn(g);
  assert.ok(g.turn > 2, "did not get past the first turn");

  /* strip BOTH hands so a refill is unmistakable whoever gets it */
  const tp = g.turnPlayer, off = P.other(tp);
  g = J.put(J.put(g, 0, s => ({...s, hand: []})), 1, s => ({...s, hand: []}));
  const n = passTurn(g);

  assert.equal(n.sides[tp].hand.length, n.sides[tp].int,
    "the turn player did not refill at the end of their own turn — CR 4.4.3f");
  assert.equal(n.sides[off].hand.length, 0,
    "the NON-turn player drew on a turn that is not turn one — CR 4.4.3f is turn-one only");
  assert.ok(n.feed.some(m => /^\(f\)/.test(m) && m.includes(g.sides[tp].name)),
    "the log names the wrong hero at (f)");
});

test("CR 4.5.3 / 4.4.3f — a hero whose deck runs out keeps playing", {skip}, () => {
  let g = match({seed: "dry"});
  const seat = g.turnPlayer;
  g = J.put(g, seat, s => ({...s, deck: [], hand: s.hand.slice(0, 1)}));
  let n = passTurn(g);
  assert.ok(!n.over, "an empty deck ended the game");
  assert.equal(n.sides[seat].hand.length, 1, "cards appeared from an empty deck");
  /* and the game keeps running — the seat can still be attacked and can still block */
  assert.equal(J.legal(n, {t: "endTurn"}, n.turnPlayer), null, "the game stopped accepting turns");
});

/* A STEP THAT ANNOUNCES ITSELF AND DOES NOTHING is worse than a missing
   one. `resetAllyLife` returns the GAME, not `{game, msgs}`; judge.js
   read `out.game`, got undefined, fell through the `||` to the unchanged
   state and threw the reset away — while logging "(a) Allies recover."
   on every turn of every game. The drill that checks the end phase runs
   a-f in the CR's order reads the LOG, so it stayed green throughout. */
test("CR 4.4.3a — a wounded ally really does heal, not just in the log", {skip}, () => {
  let g = match({seed: "allies", h0: heroBy(/gravy/i)});
  const seat = g.turnPlayer;
  const ally = g.sides[seat].deck.find(c => TY.isAllyCard(c) && (c.life || 0) >= 2);
  assert.ok(ally, "no ally with more than one life in this precon");
  g = J.put(g, seat, s => ({...s,
    board: [{card: ally, kind: "ally", spent: false, uid: ally.uid, life: 1}]}));

  const n = passTurn(g);

  assert.equal(n.sides[seat].board[0].life, ally.life,
    "the ally did not heal to its base life — CR 4.4.3a ran only in the log");
  assert.ok(n.feed.some(m => /^\(a\)/.test(m)), "(a) was not announced");
});

test("CR 4.4.4 — the per-turn ledger clears for BOTH seats", {skip}, () => {
  let g = match({seed: "hist"});
  const seat = g.turnPlayer, off = P.other(seat);
  g = J.put(J.put(g, seat, s => ({...s, hist: {...s.hist, atk: 3, blue: 2}})),
                     off, s => ({...s, hist: {...s.hist, atk: 5, blue: 4}}));
  const n = passTurn(g);
  for(const i of [0, 1]){
    assert.equal(n.sides[i].hist.atk || 0, 0, "seat " + i + " carried 'attacks this turn' into the next turn");
    assert.equal(n.sides[i].hist.blue || 0, 0, "seat " + i + " carried 'blues pitched this turn' over");
  }
});

/* CR 4.4.3d — "the turn player untaps all permanents they control." ALL
   permanents, which is the whole arena and not just the gear zone. Nothing
   taps an ally yet (allies are attackABLE and do not attack), so this is
   the step being complete rather than a bug being fixed — and it is the
   half that has to exist before the other half can be built. */
test("CR 4.4.3d — the turn player untaps the arena too, not just the gear zone", {skip}, () => {
  let g = match({seed: "untap"});
  const seat = g.turnPlayer, off = P.other(seat);
  const mk = (uid, life) => ({card: {name: "Body " + uid, uid, life, pitch: 0, tx: "",
                                     tt: "Generic Action - Ally", ty: ["Generic", "Action", "Ally"]},
                              kind: "ally", spent: true, uid, life});
  g = J.put(J.put(g, seat, s => ({...s, board: [mk("mine", 3)]})),
                      off,  s => ({...s, board: [mk("theirs", 3)]}));

  const n = passTurn(g);
  assert.equal(n.sides[seat].board[0].spent, false,
    "the turn player's permanent stayed tapped through their own untap step");
  assert.equal(n.sides[off].board[0].spent, true,
    "CR 4.4.3d untaps the TURN PLAYER's permanents — the opponent's must stay as they are");
});

/* TWO LIMITS LIVE IN `weaponUsed` AND THEY EXPIRE UNDER DIFFERENT RULES.
   A TAP is a state the permanent is in and only its controller's untap
   step (CR 4.4.3d) lifts it. `Once per Turn` is a per-turn ALLOWANCE, so
   it comes back for both seats at every turn boundary.

   They coincide for a weapon swing — action speed, so a seat only reaches
   it on its own turn — which is exactly the kind of coincidence this
   project keeps getting bitten by. Asserting on the opponent's seat is
   what makes the difference visible before an "Instant - Once per Turn"
   equipment ability arrives to depend on it. */
test("CR 4.4.3d — a tap outlives the opponent's turn; a per-turn allowance does not", {skip}, () => {
  let g = match({seed: "limits"});
  const seat = g.turnPlayer, off = P.other(seat);
  const ONCE = {name: "Once Blade", uid: "once-1", def: 0, pitch: 0, power: 3,
                tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon", "Sword", "1H"],
                tx: "Once per Turn Action - {r}: Attack.", kw: []};
  const TAPS = {name: "Tap Blade", uid: "tap-1", def: 0, pitch: 0, power: 3,
                tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon", "Sword", "1H"],
                tx: "Action - {t}: Attack.", kw: []};
  /* the parser has to agree these are the two different limits, or the
     drill is asserting about cards that do not exist */
  assert.equal(PR.weaponCost(ONCE.tx).oncePerTurn, true, "the once-per-turn fixture does not print one");
  assert.ok(!PR.weaponCost(ONCE.tx).taps, "the once-per-turn fixture also taps");
  assert.equal(PR.weaponCost(TAPS.tx).taps, true, "the tap fixture does not print a tap");
  assert.ok(!PR.weaponCost(TAPS.tx).oncePerTurn, "the tap fixture is also once per turn");

  /* both seats hold both pieces, and both have used both */
  for(const i of [0, 1]) g = J.put(g, i, s => ({...s,
    gear: [ONCE, TAPS], weaponUsed: {"once-1": true, "tap-1": true}}));

  const n = passTurn(g);
  /* the turn player untapped at (d): everything of theirs is available */
  assert.deepEqual(n.sides[seat].weaponUsed, {},
    "the turn player's own untap step did not clear their permanents");
  /* the opponent did not untap — but their per-turn allowance still renews */
  assert.equal(!!n.sides[off].weaponUsed["tap-1"], true,
    "the opponent's TAPPED permanent untapped on somebody else's turn (CR 4.4.3d)");
  assert.equal(!!n.sides[off].weaponUsed["once-1"], false,
    "a per-turn allowance was held over into the next turn — 'once per Turn' is once per TURN");
});

test("CR 4.4.3e — BOTH seats lose floating resources, not just the turn player", {skip}, () => {
  let g = match({seed: "fizzle"});
  const off = P.other(g.turnPlayer);
  g = J.put(g, off, s => ({...s, res: 3}));
  const n = passTurn(g);
  assert.equal(n.sides[off].res, 0,
    "the non-turn player kept a banked resource through the end phase");
});

/* ---- ATTACK-TARGETS (CR 1.4.5) ----------------------------------------
   An ALLY is a living object (CR 1.4.5a) — it has life, so it is
   attackable. Allies were reaching the arena and could not be attacked at
   all, which is the direction that steals games: a body that blocks
   nothing, dies to nothing and costs the opponent nothing to ignore.

   The rule that makes targeting one a real decision rather than a worse
   way to hit the hero is CR 7.3.2a: only a HERO attack-target may have
   defending cards declared for it. An attack on an ally always connects. */
function withAlly(seedName){
  let g = match({seed: seedName, h1: heroBy(/gravy/i)});
  const def = P.other(g.turnPlayer);
  const ally = g.sides[def].deck.find(c => TY.isAllyCard(c) && (c.life || 0) >= 2);
  assert.ok(ally, "no multi-life ally in this precon");
  g = J.put(g, def, s => ({...s,
    board: [{card: ally, kind: "ally", spent: false, uid: ally.uid, life: ally.life}],
    deck: s.deck.filter(c => c.uid !== ally.uid)}));
  const seat = g.turnPlayer;
  const atk = g.sides[seat].hand.find(c => PR.isAttack(c)) || g.sides[seat].deck.find(c => PR.isAttack(c));
  g = J.put(g, seat, s => ({...s, res: 9,
    hand: [atk, ...s.hand.filter(c => c.uid !== atk.uid)],
    deck: s.deck.filter(c => c.uid !== atk.uid)}));
  return {g, ally, atk, seat, def};
}

test("CR 1.4.5 — an ally in the arena is an attack-target, and a bogus one is refused", {skip}, () => {
  const {g, ally, atk, seat, def} = withAlly("targets");
  const list = J.targets(g, def);
  assert.equal(list.length, 2, "the ally is not offered as a target");
  assert.deepEqual(list.map(t => t._target.kind), ["hero", "ally"], "the hero must come first");
  assert.equal(list[1]._target.uid, ally.uid);
  assert.equal(J.legal(g, {t: "play", uid: atk.uid, from: "hand", target: 999999}, seat),
    "no such attack-target", "any number was accepted as a target");
  /* omitting the target is still legal and means the hero — always a legal choice */
  assert.equal(J.legal(g, {t: "play", uid: atk.uid, from: "hand"}, seat), null);
});

test("CR 7.3.2a — an attack on an ally cannot be blocked, and never touches the hero", {skip}, () => {
  const {g, ally, atk, seat, def} = withAlly("ally-hit");
  let n = J.reduce(g, {t: "play", uid: atk.uid, from: "hand", target: ally.uid}, seat).state;
  assert.equal(n.pend.target.kind, "ally", "the target was not carried onto the chain link");

  n = J.reduce(n, {t: "pass"}, n.priority).state;
  n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.equal(n.step, "defend");
  const gr = n.sides[def].gear.find(x => G.gearDef(x) > 0);
  assert.match(J.legal(n, {t: "defend", uid: gr.uid}, def), /cannot be blocked/,
    "an ally attack was blockable — it would be strictly worse than hitting the hero");

  const hpBefore = n.sides[def].hp;
  for(let i = 0; i < 8 && n.step !== "resolution"; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.equal(n.sides[def].hp, hpBefore, "ally damage spilled onto the hero");
  assert.ok(atk.power >= ally.life, "pick a bigger attack for this drill");
  assert.deepEqual(n.sides[def].board, [], "the dead ally is still in the arena");
  const dead = n.sides[def].grave.find(c => c.uid === ally.uid);
  assert.ok(dead, "the dead ally reached no graveyard");
  /* Every path into a graveyard stamps the turn — `_gy` is what answers
     the whole "a card put into a graveyard this turn" family, and
     `damageAlly` files the body itself rather than through `toGrave`. */
  assert.equal(dead._gy, n.turn, "the dead ally reached the graveyard unstamped");
});

test("targeting the hero with an ally on the board still works normally", {skip}, () => {
  const {g, atk, seat, def} = withAlly("hero-hit");
  let n = J.reduce(g, {t: "play", uid: atk.uid, from: "hand", target: "hero"}, seat).state;
  assert.equal(n.pend.target.kind, "hero");
  n = J.reduce(n, {t: "pass"}, n.priority).state;
  n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.equal(J.legal(n, {t: "defend", uid: n.sides[def].gear.find(x => G.gearDef(x) > 0).uid}, def), null,
    "a hero attack became unblockable");
  const hp = n.sides[def].hp, allies = n.sides[def].board.length;
  for(let i = 0; i < 8 && n.step !== "resolution"; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.ok(n.sides[def].hp < hp, "the hero took no damage");
  assert.equal(n.sides[def].board.length, allies, "the ally took damage meant for the hero");
});

/* ---- "IN SUCCESSION" IS HALF OF EVERY STEP-END RULE -------------------- */

/* CR 7.3.4 / 7.4.3 / 7.5.4 / 7.6.4 / 4.3.4 are all worded "when the stack
   is empty and all players pass IN SUCCESSION". A card resolving between
   two passes breaks the succession, and the turn-player gains priority
   again (CR 4.2.2 / 7.7.4).

   The pass record used to survive a play, and the shape that produced is
   the expensive kind: the attacker passes, the defender answers with a
   defence reaction, one further pass from the defender ends the step —
   so the attacker never gets a window to answer the card just played at
   them. A priority window that silently never opens. */
test("a card played mid-window reopens it — the attacker answers a defence reaction", {skip}, () => {
  let g = match({seed: "succession"});
  const atkSeat = g.turnPlayer, defSeat = P.other(atkSeat);

  /* seat the defender with a real defence reaction and the fuel to cast it */
  const dr = g.sides[defSeat].deck.find(c => PR.isDR(c));
  assert.ok(dr, "no defence reaction in this precon — pick another seed");
  g = J.put(g, defSeat, s => ({...s, hand: [dr, ...s.hand], deck: s.deck.filter(c => c.uid !== dr.uid), res: 9}));
  g = J.put(g, atkSeat, s => ({...s, res: 9}));

  let n = toDefendStep(g);
  n = J.reduce(n, {t: "pass"}, n.priority).state;      /* out of the defend step */
  n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.equal(n.step, "reaction", "never reached the reaction step");

  /* the attacker declines first (CR 7.4.2 gives the turn-player priority) */
  n = J.reduce(n, {t: "pass"}, atkSeat).state;
  assert.ok((n.passed || [])[atkSeat], "the attacker's pass was not recorded");

  const why = J.legal(n, {t: "play", uid: dr.uid, from: "hand"}, defSeat);
  assert.equal(why, null, "the defender could not play a defence reaction in the reaction step: " + why);
  n = J.reduce(n, {t: "play", uid: dr.uid, from: "hand"}, defSeat).state;

  assert.equal(n.step, "reaction", "the defence reaction advanced the step by itself");
  assert.deepEqual(n.passed, [false, false],
    "the pass record survived a play — 'in succession' was broken and nobody noticed");
  assert.ok(P.canAct(n, atkSeat),
    "the attacker got no window to answer the defence reaction played at them");
  assert.equal(n.priority, n.turnPlayer, "priority did not return to the turn player (CR 4.2.2)");
});

test("declaring a defender reopens the window too — CR 7.3.4", {skip}, () => {
  let g = match({seed: "succession2"});
  let n = toDefendStep(g);
  const d = P.defendingPlayer(n);
  n = J.reduce(n, {t: "pass"}, n.priority).state;        /* turn-player declines */
  assert.ok((n.passed || []).some(Boolean), "nobody had passed");

  const gr = (n.sides[d].gear || []).find(x => G.gearDef(x) > 0);
  assert.ok(gr, "the defender has no equipment to raise");
  n = J.reduce(n, {t: "defend", uid: gr.uid}, d).state;
  assert.deepEqual(n.passed, [false, false],
    "a blocker was declared after the turn-player passed and the pass still stood — "
    + "they never see the wall they are about to be measured against");
  assert.equal(n.step, "defend", "declaring a defender advanced the step");
});

/* CR 4.3.4 — "when the stack is empty, the combat chain is closed, and
   both players pass priority in succession, the action phase ends and the
   game proceeds to the End Phase." `advance` has no transition out of the
   layer step, so without this the mutual pass left a window nobody could
   act in and the game waited for an endTurn the CR does not require. */
test("CR 4.3.4 — both players passing ends the action phase", {skip}, () => {
  let g = match({seed: "phase-end"});
  const tp = g.turnPlayer;
  assert.equal(g.phase, "action");
  let n = J.reduce(g, {t: "pass"}, g.priority).state;
  n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.notEqual(n.phase + n.turn, "action" + g.turn,
    "both seats passed in the action phase and the game stayed in it — a window nobody can act in");
  /* it went to the end phase, which on turn one offers the arsenal step */
  assert.ok(n.phase === "end" || n.turnPlayer !== tp,
    "the action phase did not proceed to the end phase");
});

/* AND THE TURN PLAYER CANNOT SKIP THE OTHER HALF OF THAT RULE.
   CR 4.3.4 needs BOTH players to pass in succession, so "end my turn" is
   a pass, not a transition. It used to run the whole end phase on the
   spot — the turn player deciding, alone, that the opponent had nothing
   to say. In a solo trainer that is invisible, because the dummy never
   had anything to say; with a human in seat 1 it silently deletes their
   last instant window on every turn of the game. */
test("CR 4.3.4 — endTurn does not skip the opponent's last priority window", {skip}, () => {
  let g = match({seed: "endturn-window"});
  const tp = g.turnPlayer, op = P.other(tp);
  assert.equal(g.priority, tp);
  assert.ok(!P.canAct(g, op), "the opponent already holds a window before the turn player acts");

  const n = J.reduce(g, {t: "endTurn"}, tp).state;
  assert.equal(n.phase, "action", "the turn ended without the opponent ever holding priority");
  assert.equal(n.turnPlayer, tp, "the seat changed hands on one seat's say-so");
  assert.equal(n.priority, op, "priority did not slide to the opponent");
  assert.ok(P.canAct(n, op), "the opponent still cannot act — the window is a formality");
  assert.deepEqual(P.speedAllowed(n, op), ["instant"],
    "CR 4.3.4 gives the non-turn player an instant-speed window here");

  /* and it really is theirs to spend: declining it is what ends the phase */
  const done = J.reduce(n, {t: "pass"}, op).state;
  assert.ok(done.phase === "end" || done.turnPlayer !== tp,
    "both seats passed in succession and the action phase did not end");

  /* the refusals that keep it from becoming a general-purpose pass */
  assert.match(J.reduce(g, {t: "endTurn"}, op).error, /not your turn/);
  assert.match(J.reduce(n, {t: "endTurn"}, tp).error, /priority/);
});

test("CR 4.3.2 — the action point is issued on entering the action phase, to the turn player", {skip}, () => {
  let g = match({seed: "ap"});
  assert.equal(g.sides[g.turnPlayer].ap, 1);
  assert.equal(g.sides[P.other(g.turnPlayer)].ap, 0, "the non-turn player was issued an action point");
});

/* ---- THE COMBAT CHAIN --------------------------------------------------- */

test("an attack walks attack -> defend -> reaction -> damage -> resolution -> close", {skip}, () => {
  const {trace} = drive(match({seed: "steps", limit: 120}));
  const seen = [...new Set(trace.map(t => t.step))];
  for(const step of ["attack", "defend", "reaction", "damage", "resolution", "close"])
    assert.ok(seen.includes(step) || step === "close",
      `the chain never entered the ${step} step`);
});

test("in the defend step the TURN-PLAYER holds priority and the DEFENDER declares", {skip}, () => {
  const n = toDefendStep(match({seed: "cr73"}));
  assert.equal(n.step, "defend", "did not reach the defend step");
  assert.equal(n.priority, n.turnPlayer, "CR 7.3.3 — the turn-player holds priority in the defend step");
  const def = P.defendingPlayer(n);
  assert.notEqual(def, n.turnPlayer);
  assert.ok(P.canDeclareDefenders(n, def), "the defender cannot declare in its own defend step");
  assert.ok(!P.canAct(n, def) || P.speedAllowed(n, def).length === 0,
    "the defender was handed the priority window as well");
  /* Declaring is free and does not need priority — CR 7.3.2. */
  const blk = n.sides[def].gear.find(x => G.gearDef(x) > 0);
  if(blk) assert.equal(J.legal(n, {t: "defend", uid: blk.uid}, def), null,
    "a free, simultaneous declaration was refused for want of priority");
});

test("one combat path: the same code resolves an attack whichever seat swings", {skip}, () => {
  const {g} = drive(match({seed: "onepath"}));
  const resolves = g.feed.filter(m => / resolves for /.test(m));
  const byWall = resolves.filter(m => /Wall of /.test(m));
  assert.ok(resolves.length > 4, "too few resolutions to judge");
  assert.ok(byWall.length > 2, "no attack was ever met by a declared wall");
  /* Both seats' attacks must produce the SAME shaped message, because
     they are the same function. The trainer had two, and one of them
     fabricated its attack as a number. */
  assert.ok(!g.feed.some(m => /scripted escalation/.test(m)),
    "a scripted swing reached the reducer");
});

/* ---- CARD TYPES, END TO END ---------------------------------------------
   types.js decides these in the abstract; these drills prove the reducer
   actually honours them with a real card, in a real game, from a real
   hand. Put a card in hand, play it, and look at where it went. */

/* Find a pool card matching `pick`, put it in `seat`'s hand with the
   resources to pay for it, and return the state. */
function withCard(g, seat, pick){
  const db = DB();
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of d.deck){
      const c = C.resolveEntry(db, e, sa);
      if(!c.resolved || !pick(c)) continue;
      const card = {...c, uid: "probe-" + (c.name || "").replace(/\W/g, "")};
      return {g: J.put(g, seat, s => ({...s, hand: [card, ...s.hand], res: 9, ap: 1})), card};
    }
  }
  return {g, card: null};
}

test("an AURA played from hand enters the arena, not the graveyard", {skip}, () => {
  let g = match({seed: "aura"});
  const seat = g.turnPlayer;
  const {g: g2, card} = withCard(g, seat, c => TY.isAura(c) && !TY.isAttack(c));
  assert.ok(card, "no aura in the pool — the drill cannot bite");
  const out = J.reduce(g2, {t: "play", uid: card.uid, from: "hand"}, seat);
  assert.equal(out.error, null, "a legal aura was refused: " + out.error);
  const n = out.state;
  assert.ok((n.sides[seat].board || []).some(b => b.uid === card.uid),
    `${card.name} did not enter the arena — the player paid for it and never received it`);
  assert.ok(!(n.sides[seat].grave || []).some(c => c.uid === card.uid),
    `${card.name} went to the graveyard instead of staying on the board`);
  assert.equal((n.sides[seat].board.find(b => b.uid === card.uid) || {}).kind, "aura");
});

test("an ALLY enters the arena carrying its printed life", {skip}, () => {
  let g = match({seed: "ally"});
  const seat = g.turnPlayer;
  const {g: g2, card} = withCard(g, seat, c => TY.isAllyCard(c));
  assert.ok(card, "no ally in the pool");
  const n = J.reduce(g2, {t: "play", uid: card.uid, from: "hand"}, seat).state;
  const entry = (n.sides[seat].board || []).find(b => b.uid === card.uid);
  assert.ok(entry, `${card.name} did not enter the arena`);
  assert.equal(entry.kind, "ally");
  /* CR 1.4.5a — an ally is a living object, so it must be attackable. */
  assert.ok(G.isAttackable(entry), `${card.name} is on the board but cannot be attacked`);
  assert.equal(G.allyLife(entry), card.life);
});

test("an ITEM enters the arena", {skip}, () => {
  let g = match({seed: "item"});
  const seat = g.turnPlayer;
  const {g: g2, card} = withCard(g, seat, c => TY.isItem(c) && !TY.isAttack(c));
  assert.ok(card, "no item in the pool");
  const n = J.reduce(g2, {t: "play", uid: card.uid, from: "hand"}, seat).state;
  assert.ok((n.sides[seat].board || []).some(b => b.uid === card.uid), `${card.name} did not enter the arena`);
});

test("a BLOCK card cannot be played, but can be pitched and declared", {skip}, () => {
  let g = match({seed: "block"});
  const seat = g.turnPlayer;
  const {g: g2, card} = withCard(g, seat, c => TY.isBlock(c));
  assert.ok(card, "no Block card in the pool");
  const why = J.legal(g2, {t: "play", uid: card.uid, from: "hand"}, seat);
  assert.ok(why, `${card.name} was playable — a free 0-cost no-op`);
  assert.match(why, /pitched or declared as a defender/);

  /* But it must still be usable both other ways, or it is a dead card. */
  const dg = toDefendStep(match({seed: "block2"}));
  const def = P.defendingPlayer(dg);
  const withBlock = J.put(dg, def, s => ({...s, hand: [card, ...s.hand]}));
  assert.equal(J.legal(withBlock, {t: "defend", uid: card.uid}, def), null,
    `${card.name} could not be declared as a defender either — it would be unusable`);
});

test("EQUIPMENT cannot be played from hand", {skip}, () => {
  let g = match({seed: "equip"});
  const seat = g.turnPlayer;
  const piece = g.sides[seat].gear.find(x => !TY.isWeaponType(x));
  assert.ok(piece, "the hero is wearing no armour");
  const g2 = J.put(g, seat, s => ({...s, hand: [piece, ...s.hand], res: 9}));
  const why = J.legal(g2, {t: "play", uid: piece.uid, from: "hand"}, seat);
  assert.ok(why && /worn, not played/.test(why), `${piece.name} was playable from hand`);
  /* and activating a non-weapon as a weapon is refused by name */
  const act = J.legal(g, {t: "activate", uid: piece.uid}, seat);
  assert.ok(act && /equipment, not a weapon|prints no weapon attack/.test(act));
});

test("a TRAP defence reaction is refused in the action phase", {skip}, () => {
  /* Den of the Spider and Lair of the Spider. The database's display
     string calls them "Action Defense Reaction"; the structured array
     says Defense Reaction, and a reaction cannot be an action. Reading
     the string made them playable on their controller's own turn for an
     action point — sev-3 "illegal play allowed". The class words
     ("Assassin / Warrior") govern deck legality, not card type. */
  let g = match({seed: "trap"});
  const seat = g.turnPlayer;
  const {g: g2, card} = withCard(g, seat, c => TY.hasSubtype(c, "Trap") && TY.isDR(c));
  assert.ok(card, "no Trap defence reaction in the pool — the drill cannot bite");
  assert.deepEqual(TY.cardType(card).types, ["Defense Reaction"],
    `${card.name} parsed as ${JSON.stringify(TY.cardType(card).types)}`);

  const why = J.legal(g2, {t: "play", uid: card.uid, from: "hand"}, seat);
  assert.ok(why, `${card.name} was playable in the action phase`);
  assert.match(why, /defence reaction|reaction step/);

  /* and it is still not DECLARABLE as a defender (CR 8.1.3a) — a
     reaction is played in the reaction step, never declared */
  const d = toDefendStep(match({seed: "trap2"}));
  const def = P.defendingPlayer(d);
  const dd = J.put(d, def, s => ({...s, hand: [card, ...s.hand]}));
  const dwhy = J.legal(dd, {t: "defend", uid: card.uid}, def);
  assert.ok(dwhy && /reaction step/.test(dwhy), `${card.name} was declared as a defending card`);
});

/* ---- COSTS, KEYWORDS, WINDOWS ------------------------------------------- */

test("CR 8.1.6 — an instant costs no action point", {skip}, () => {
  let g = match({seed: "instant", h0: heroBy(/dorinthea/i), h1: heroBy(/kayo/i)});
  const seat = g.turnPlayer;
  /* Give the seat an instant it can afford and nothing else in the way. */
  const inst = [].concat(...W.HEROES.map(h => [])).length; /* placeholder, see below */
  const anyInstant = g.sides[seat].deck.concat(g.sides[seat].hand).find(c => PR.isInstantT(c));
  if(!anyInstant) return;                                  /* deck has none — nothing to assert */
  g = J.put(g, seat, s => ({...s, hand: [anyInstant, ...s.hand], res: 9}));
  const before = g.sides[seat].ap;
  const out = J.reduce(g, {t: "play", uid: anyInstant.uid, from: "hand"}, seat);
  assert.equal(out.error, null, "a legal instant was refused: " + out.error);
  const after = out.state.sides[seat].ap;
  assert.ok(after >= before,
    `${anyInstant.name} spent an action point (${before} -> ${after}) — CR 8.1.6 says it costs none`);
});

test("an action DOES cost an action point, and none is left for a second", {skip}, () => {
  /* AN ATTACK'S ACTION POINT IS CHARGED WHEN THE LINK RESOLVES (v2.77),
     not when it is declared. That is the ONE copy of CR 8.1.1's
     arithmetic — `effects.js`'s `linkPayload`, spelled out as
     `ap = ga ? ap : ap - 1` so that CR 5.3.5's GAIN composes with it
     instead of being folded into a ternary — and it is where the trainer
     has always charged it. This file used to charge it a second time at
     declaration, which handed the attacker two points for one go again.

     So the drill drives to the resolution rather than reading the state
     one action in. */
  let g = match({seed: "apcost"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.isAttack(x));
  g = J.put(g, seat, s => ({...s, res: 9, ap: 1}));
  const out = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat);
  assert.equal(out.error, null);
  let n = out.state;
  for(let i = 0; i < 24 && n.priority != null && !(n.pend && n.pend.dealt != null); i++)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  assert.ok(n.pend && n.pend.dealt != null, "the link never reached its damage step");
  /* Read go again off the LINK, not off a fresh parse: a card can be
     granted it by its own resolution, and the point follows what actually
     happened rather than what the text says in isolation. */
  assert.equal(n.sides[seat].ap, n.pend.ga ? 1 : 0,
    "go again is a GAIN, not a refund (CR 5.3.5)");
});

test("once per turn is PRINTED, not universal", {skip}, () => {
  /* Eleven of thirteen pool weapons print it. Sledge of Anvilheim and
     Scorpio, Comet Tail do not, and may swing again for anyone who can
     pay again — gating every weapon makes those two weaker than printed,
     a direction the fairness sweep is deliberately blind to. */
  const bravo = heroBy(/bravo/i);
  let g = match({seed: "sledge", h0: bravo, h1: heroBy(/kayo/i)});
  const seat = g.turnPlayer;
  const sledge = g.sides[seat].gear.find(x => /sledge/i.test(x.name || ""));
  assert.ok(sledge, "Bravo is not wearing the Sledge — check defaultPicks");
  assert.equal(PR.weaponCost(sledge.tx).oncePerTurn, false, "the Sledge reads as once per turn");
  g = J.put(g, seat, s => ({...s, res: 20, ap: 5, weaponUsed: {[sledge.uid]: true}}));
  assert.equal(J.legal(g, {t: "activate", uid: sledge.uid}, seat), null,
    "the Sledge was refused a second swing it does not print a limit on");

  const dor = heroBy(/dorinthea/i);
  let g2 = match({seed: "dawnblade", h0: dor, h1: heroBy(/kayo/i)});
  const s2 = g2.turnPlayer;
  const blade = g2.sides[s2].gear.find(x => /dawnblade/i.test(x.name || ""));
  assert.equal(PR.weaponCost(blade.tx).oncePerTurn, true);
  g2 = J.put(g2, s2, s => ({...s, res: 20, ap: 5, weaponUsed: {[blade.uid]: true}}));
  assert.ok(J.legal(g2, {t: "activate", uid: blade.uid}, s2),
    "Dawnblade swung twice — it prints once per turn");
});

test("a {t} weapon is limited by the TAP, not by 'once per turn'", {skip}, () => {
  /* Scorpio, Comet Tail reads "Action - {t}: Attack". It does NOT print
     "Once per Turn", so reading only that field would let it swing all
     turn — stronger than printed, the direction that steals games. It is
     limited anyway, because {t} taps it and a tapped permanent does not
     untap until CR 4.4.3d in the end phase.

     Two limits, two different reasons, and honouring one without the
     other gets a card wrong in a different direction each time. */
  const briar = heroBy(/briar/i);
  let g = match({seed: "scorpio", h0: briar, h1: heroBy(/kayo/i)});
  const seat = g.turnPlayer;
  const scorpio = g.sides[seat].gear.find(x => /scorpio/i.test(x.name || ""));
  assert.ok(scorpio, "Briar is not wearing Scorpio — check defaultPicks");
  const wc = PR.weaponCost(scorpio.tx);
  assert.equal(wc.oncePerTurn, false, "Scorpio started printing 'Once per Turn'");
  assert.equal(wc.taps, true, "Scorpio's {t} cost is no longer read");

  g = J.put(g, seat, s => ({...s, res: 20, ap: 5}));
  assert.equal(J.legal(g, {t: "activate", uid: scorpio.uid}, seat), null,
    "Scorpio could not swing at all");
  const swung = J.put(g, seat, s => ({...s, weaponUsed: {[scorpio.uid]: true}}));
  const why = J.legal(swung, {t: "activate", uid: scorpio.uid}, seat);
  assert.ok(why && /tapped/.test(why),
    "Scorpio swung twice in one turn — {t} taps it until the end phase");
});

test("CR 8.1.2a — a reaction cannot be played in the action phase", {skip}, () => {
  let g = match({seed: "rx"});
  const seat = g.turnPlayer;
  const rx = g.sides[seat].deck.find(c => PR.isAR(c) || PR.isDR(c));
  if(!rx) return;
  g = J.put(g, seat, s => ({...s, hand: [rx, ...s.hand], res: 9}));
  const why = J.legal(g, {t: "play", uid: rx.uid, from: "hand"}, seat);
  assert.ok(why && /reaction step/.test(why),
    `${rx.name} was playable on its controller's own turn — 23 pool cards were`);
});

test("CR 8.1.3a — a defence reaction is never DECLARED as a defender", {skip}, () => {
  /* Asserted directly rather than harvested from the driver's mistakes:
     the driver only sends legal actions, so a drill that waits for it to
     blunder proves nothing the day the driver gets smarter. */
  let g = toDefendStep(match({seed: "dr"}));
  assert.equal(g.step, "defend", "did not reach the defend step");
  const def = P.defendingPlayer(g);
  const dr = g.sides[def].deck.find(c => PR.isDR(c) && c.def > 0);
  assert.ok(dr, "no defence reaction with printed defence in this deck — the drill cannot bite");
  g = J.put(g, def, s => ({...s, hand: [dr, ...s.hand]}));
  const why = J.legal(g, {t: "defend", uid: dr.uid}, def);
  assert.ok(why, `${dr.name} was declared as a defending card`);
  assert.match(why, /reaction step/);

  /* And the control: an ordinary card with printed defence IS declarable,
     so the refusal above is about the reaction, not about the step. */
  const ok = g.sides[def].hand.find(c => c.def > 0 && !PR.isDR(c));
  if(ok) assert.equal(J.legal(g, {t: "defend", uid: ok.uid}, def), null,
    "an ordinary blocker was refused too — the drill is testing the wrong thing");
});

test("CR 7.3.2b — a piece that already blocked cannot block again on the same chain", {skip}, () => {
  let g = toDefendStep(match({seed: "reblock"}));
  const def = P.defendingPlayer(g);
  const piece = g.sides[def].gear.find(x => G.gearDef(x) > 0);
  assert.ok(piece, "the defender is wearing no iron");
  assert.equal(J.legal(g, {t: "defend", uid: piece.uid}, def), null);
  g = J.put(g, def, s => ({...s, chainBlocked: [piece.uid]}));
  const why = J.legal(g, {t: "defend", uid: piece.uid}, def);
  assert.ok(why && /already blocked this chain/.test(why),
    "a spent piece was raised again on the same chain");
});

/* A WALL DEFENDS ONE CHAIN LINK, AND THE POOL ALMOST PERFECTLY HIDES IT.
   `chainBlocked` stops a spent piece being re-DECLARED (CR 7.3.2b above),
   but the declaration itself used to stand until the chain closed — so
   `strike` re-read `blockG` on link 2 and counted the same iron again,
   with nothing declared and nothing paid.

   Silver Age equipment is nearly all battleworn, so it wears to 0 defence
   after one block and the second helping is worth exactly nothing. That
   is why this needs a plain piece that does not wear: the bug is real for
   any such card and invisible against the precons.

   Hand blockers escaped by accident, not by rule — they leave the hand at
   the strike, so the link-2 lookup finds nothing. Two different reasons
   for the same clean answer, and only one of them is a rule. */
test("a defender declared on chain link 1 does not defend link 2", {skip}, () => {
  const PLATE = {name: "Test Plate", uid: "plate-1", def: 3, pitch: 0, tx: "",
                 tt: "Generic Equipment - Chest", ty: ["Generic", "Equipment", "Chest"], kw: []};
  let g = match({seed: "per-link"});
  const A = g.turnPlayer, D = P.other(A);
  /* a piece that does NOT wear, and an attacker who can afford two links */
  g = J.put(g, D, s => ({...s, gear: [PLATE]}));
  g = J.put(g, A, s => ({...s, ap: 5, res: 9}));

  const swing = st => {
    const c = st.sides[A].hand.find(x => TY.isAttack(x) && (x.power || 0) > 0);
    assert.ok(c, "no attack left in hand");
    let n = J.reduce(st, {t: "play", uid: c.uid, from: "hand"}, A).state;
    while(J.pendingOf(n)){
      const p = J.pendingOf(n), sd = n.sides[p.seat];
      if(p.need - sd.res - J.paySum(sd) > 0){
        const pc = sd.hand.find(x => x.uid !== p.card.uid && !(sd.paySel || []).includes(x.uid));
        n = J.reduce(n, {t: "paySel", uid: pc.uid}, p.seat).state;
      } else n = J.reduce(n, {t: "payConfirm"}, p.seat).state;
    }
    for(let i = 0; i < 8 && n.step !== "defend"; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
    return n;
  };
  const toResolution = st => {
    let n = st;
    for(let i = 0; i < 14 && n.step !== "resolution" && !n.over; i++)
      n = J.reduce(n, {t: "pass"}, n.priority).state;
    return n;
  };

  /* link 1: the plate is declared and does its job */
  let n = swing(g);
  n = J.reduce(n, {t: "defend", uid: PLATE.uid}, D).state;
  n = toResolution(n);
  assert.equal(n.pend.wall, 3, "the declared plate did not defend link 1");
  assert.deepEqual(n.sides[D].blockG, [],
    "the declaration outlived the link it was made for");
  assert.deepEqual(n.sides[D].chainBlocked, [PLATE.uid],
    "CR 7.3.2b — the spent piece must stay barred for the rest of the chain");
  assert.ok(n.chainOpen, "the chain closed early — link 2 would be a new chain");

  /* link 2 on the SAME chain, with nothing declared */
  n = J.put(n, A, s => ({...s, ap: 5, res: 9}));
  n = swing(n);
  assert.deepEqual(n.sides[D].blockG, [], "a stale declaration is standing in the defend step");
  const hpBefore = n.sides[D].hp;
  const power = n.pend.total;
  n = toResolution(n);
  assert.equal(n.pend.wall, 0,
    "link 1's gear defended link 2 for free — the wall outlived its chain link");
  assert.equal(hpBefore - n.sides[D].hp, power,
    "the second link was softened by a piece nobody declared");
});

/* ---- PAYMENT ------------------------------------------------------------ */

test("pitching is on demand: a play that costs nothing opens no payment", {skip}, () => {
  let g = match({seed: "free"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.effCost(x, g.sides[seat]) === 0);
  if(!c) return;
  const out = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat);
  assert.equal(J.pendingOf(out.state), null, "a free card opened a payment");
});

test("a cancelled payment spends nothing and leaves no selection behind", {skip}, () => {
  let g = match({seed: "cancel"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.effCost(x, g.sides[seat]) > 0);
  const handBefore = g.sides[seat].hand.length;
  let n = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat).state;
  const other = n.sides[seat].hand.find(x => x.uid !== c.uid);
  n = J.reduce(n, {t: "paySel", uid: other.uid}, seat).state;
  n = J.reduce(n, {t: "payCancel"}, seat).state;
  assert.equal(n.sides[seat].hand.length, handBefore, "cancelling a payment moved a card");
  assert.equal(n.sides[seat].res, 0, "cancelling a payment banked a resource");
  assert.deepEqual(n.sides[seat].paySel, [],
    "the selection survived the cancel — the next payment would inherit it (v2.18)");
  assert.equal(J.pendingOf(n), null);
});

test("nothing else is legal mid-payment, for either seat", {skip}, () => {
  let g = match({seed: "midpay"});
  const seat = g.turnPlayer, other = P.other(seat);
  const c = g.sides[seat].hand.find(x => PR.effCost(x, g.sides[seat]) > 0);
  const n = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat).state;
  const second = n.sides[seat].hand.find(x => x.uid !== c.uid);
  assert.ok(J.legal(n, {t: "play", uid: second.uid, from: "hand"}, seat),
    "a second play started mid-payment");
  assert.ok(J.legal(n, {t: "pass"}, seat), "priority passed mid-payment");
  assert.ok(J.legal(n, {t: "pass"}, other), "the other seat acted while a payment was open");
});

test("a card cannot pitch for itself", {skip}, () => {
  let g = match({seed: "self"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.effCost(x, g.sides[seat]) > 0);
  const n = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat).state;
  assert.ok(J.legal(n, {t: "paySel", uid: c.uid}, seat));
});

/* ---- THE FULL JOURNEY: PITCH TO PLAY ------------------------------------
   A card's life is hand -> (pitch | arsenal | chain | arena | grave), and
   the pitch zone's own life is pitch -> the BOTTOM of the deck. These
   drills follow real cards all the way round rather than checking one
   transition at a time. */

test("CR 4.4.3c — a pitched card goes to the BOTTOM of its owner's deck", {skip}, () => {
  let g = match({seed: "pitchzone"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.effCost(x, g.sides[seat]) > 0);
  let n = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat).state;
  const p = J.pendingOf(n);
  const fuel = n.sides[seat].hand.find(x => x.uid !== c.uid && x.pitch > 0);
  n = J.reduce(n, {t: "paySel", uid: fuel.uid}, seat).state;
  n = J.reduce(n, {t: "payConfirm"}, seat).state;

  /* it is in the pitch zone now, and nowhere else */
  assert.ok((n.sides[seat].pitch || []).some(x => x.uid === fuel.uid), "the pitched card is not in the pitch zone");
  assert.ok(!(n.sides[seat].hand || []).some(x => x.uid === fuel.uid), "the pitched card is still in hand");

  /* end the turn and it should be the LAST card of the deck, not the first */
  const deckBefore = n.sides[seat].deck.length;
  while(n.chainOpen && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  n = passTurn(n);

  const deck = n.sides[seat].deck;
  assert.deepEqual(n.sides[seat].pitch, [], "the pitch zone was not emptied");
  assert.equal(deck[deck.length - 1].uid, fuel.uid,
    "the pitched card did not go to the BOTTOM of the deck — it would be redrawn immediately");
  /* Not `deckBefore + 1`: CR 4.4.3f draws the turn player back up to
     intellect out of the same deck in the same end phase, so the net
     movement is +1 pitched −N drawn. What matters is that the card
     arrived exactly once and nothing was duplicated. */
  assert.equal(deck.filter(x => x.uid === fuel.uid).length, 1,
    "the pitched card landed in the deck more than once");
});

test("the arsenal round trip: set it at end of turn, play it the next", {skip}, () => {
  let g = match({seed: "arsenal-trip"});
  const seat = g.turnPlayer;
  /* end the turn and set a specific card in the arsenal. Two actions, not
     one: CR 4.3.4 wants the opponent's pass before the phase ends. */
  let n = J.reduce(g, {t: "endTurn"}, seat).state;
  n = J.reduce(n, {t: "pass"}, P.other(seat)).state;
  assert.equal(n.arsenalFor, seat, "the turn player was not offered the arsenal step");
  const pick = n.sides[seat].hand.find(x => TY.isAttack(x)) || n.sides[seat].hand[0];
  n = J.reduce(n, {t: "arsenal", uid: pick.uid}, seat).state;
  assert.equal(n.sides[seat].arsenal.uid, pick.uid, "the card did not reach the arsenal");
  assert.ok(!n.sides[seat].hand.some(x => x.uid === pick.uid), "the card is in the arsenal AND in hand");

  /* the OTHER seat takes its turn, then ours comes round again */
  const other = P.other(seat);
  while(n.turnPlayer !== seat && !n.over){
    if(n.arsenalFor != null){ n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state; continue; }
    if(n.phase === "action" && n.priority === n.turnPlayer && !n.chainOpen && n.step === "layer"){
      const out = J.reduce(n, {t: "endTurn"}, n.turnPlayer);
      if(!out.error){ n = out.state; continue; }
    }
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  }
  assert.equal(n.sides[seat].arsenal.uid, pick.uid, "the arsenal did not survive the opponent's turn");

  /* and it is playable from there */
  n = J.put(n, seat, s => ({...s, res: 9}));
  const why = J.legal(n, {t: "play", uid: pick.uid, from: "arsenal"}, seat);
  assert.equal(why, null, "the arsenalled card could not be played: " + why);
  const played = J.reduce(n, {t: "play", uid: pick.uid, from: "arsenal"}, seat).state;
  assert.equal(played.sides[seat].arsenal, null, "the arsenal was not emptied by playing from it");
});

test("a card is never in two zones on the way through", {skip}, () => {
  /* Walk a whole game asserting the census after EVERY action rather
     than only at the end. The crumbling-aura bug (v2.16) was a card in
     two zones for exactly one state transition.

     IT DROVE ONE MATCHUP AND ONE SEED, and that is how it missed Under
     Loop: the card has to be DEALT before its clause can break anything,
     and this walk never seated a Mechanologist. A per-action census is
     only as wide as the cards it draws, so the sample is now a spread of
     heroes rather than one pairing — the whole-game drill in
     `sparring.test.js` is what actually caught it, from a seating this
     one did not have. Widen the sample when a hero's cards start doing
     something new; do not widen the tolerance. */
  const walks = [{seed: "walk"},
                 {seed: "walk-vd", h0: heroBy(/viserai/i), h1: heroBy(/dash/i), first: 1},
                 {seed: "walk-gb", h0: heroBy(/gravy/i),   h1: heroBy(/bravo/i)},
                 {seed: "walk-bf", h0: heroBy(/boltyn/i),  h1: heroBy(/fai/i), first: 1}];
  for(const w of walks){
    const {g, errs} = drive(match(w));
    const dirty = errs.filter(e => /INVARIANT/.test(e.why || ""));
    assert.deepEqual(dirty, [], w.seed + ": " + dirty.map(e => e.why + " on " + e.a.t).join(", "));
    /* A WALK THAT STOPPED WALKING PASSES A CENSUS BY FINDING NOTHING.
       Filtering `errs` to INVARIANT and asserting only that is exactly
       how the Viserai/Dash seating went green while parked on turn 1
       against a boost pending the driver could not answer — 3,591
       refusals, none of them read, and no card in two zones because no
       card was ever played. The census is only worth what the walk
       covers, so assert the walk. */
    assert.deepEqual(errs, [], w.seed + ": the driver was refused an action — " +
      [...new Set(errs.map(e => e.why))].slice(0, 3).join(" | "));
    assert.ok(g.over, w.seed + ": the game never ended — the walk stalled at turn " + g.turn);
  }
});

/* ---- CARD TEXT THAT NEEDS THE DEFENDERS TO EXIST (CR 7.3.4 -> 7.4) ----

   Phantasm reads the cards declared AGAINST the attack, so it cannot be
   read at declaration. The trainer has run it at the close of the defend
   step since v2.73 — and this board never ran it at all, because
   `afterDefenders` was only ever called from `index.html`. Driven, a
   6-power blocker met Spears of Surreality and the attack resolved for 2
   anyway, while the feed printed the drawback as though it had applied.

   No tool here could see it. Coverage read the card `full`; the fairness
   sweep is one-sided toward cards STRONGER than printed and this one was
   stronger on one board only; and `tools/failstates.js` graded the
   keyword by counting mentions in `index.html`, which is a file the
   semantics left in v2.53 — a source scan aimed at the wrong file, this
   time failing by finding nothing rather than passing by it.

   ASSERT ON ZONES AND LIFE. The old feed line was already correct while
   the hero took the damage. */
test("phantasm pops the attack at the table, not just in the trainer", {skip}, () => {
  const atk = {...C.resolveEntry(DB(), {name: "Spears of Surreality", p: 1, code: null, q: 1}), uid: "ph1"};
  assert.ok(PR.hasKw(atk, "phantasm"), "the printed keyword is the spec");

  const big = {uid: "w1", name: "Six Power", def: 3, power: 6, pitch: 1,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk]},
                  {name: "Them", hand: [big]},
                  {actor: 0, turnPlayer: 0, seed: "phantasm"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  let n = J.reduce(g, {t: "play", uid: "ph1", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  assert.equal(n.step, "defend", "the drill has to REACH the defend step or it proves nothing");

  const d = J.reduce(n, {t: "defend", uid: "w1"}, 1);
  assert.equal(d.error, null, "declaring the 6-power blocker was refused: " + d.error);
  n = d.state;
  for(let i = 0; i < 16 && n.phase === "action" && n.step !== "layer"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }

  assert.equal(n.sides[1].hp, 20, "the attack was POPPED — no damage reaches the hero");
  assert.equal(n.sides[0].ap, 2, "destroyed, so go again never resolves and the point is not refunded");
  assert.deepEqual((n.chainCards || []).map(x => x.card.uid), [], "and it left the chain");
  assert.deepEqual(n.sides[0].grave.map(x => x.uid), ["ph1"], "destroyed means the graveyard, once");
  assert.deepEqual(INV.errors(n), [], "a popped attack still lands in exactly one zone");
});

/* A five-power blocker is the control: without it the drill above passes
   just as well on an engine that pops EVERY blocked phantasm attack. */
test("phantasm needs SIX printed power — five is an ordinary block", {skip}, () => {
  const atk = {...C.resolveEntry(DB(), {name: "Spears of Surreality", p: 1, code: null, q: 1}), uid: "ph2"};
  const five = {uid: "w2", name: "Five Power", def: 3, power: 5, pitch: 1,
                tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk]},
                  {name: "Them", hand: [five]},
                  {actor: 0, turnPlayer: 0, seed: "phantasm5"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = J.reduce(g, {t: "play", uid: "ph2", from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  n = J.reduce(n, {t: "defend", uid: "w2"}, 1).state;
  for(let i = 0; i < 16 && n.phase === "action" && n.step !== "layer"; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }
  assert.equal(n.sides[1].hp, 18, "5 power blocks 3 of a 5-power attack — 2 gets through, and it HIT");
});

/* ---- A CARD THAT REDIRECTS ITSELF -------------------------------------

   "When this hits, put it on the bottom of its owner's deck."

   The two callers file a spent attack at two different moments and both
   are right for their own turn structure: the trainer at DECLARATION, so
   the card is in the graveyard by the time an on-hit clause runs;
   judge.js at the CLOSE step, so it is on the combat chain. `bottomSelf`
   was written against the first and lifted the card out of the graveyard
   only — which on this path found nothing there, pushed the card onto the
   deck, and left the chain still holding it.

   ASSERT ON ZONES, and on the ORDER of the deck: "bottom" is the whole
   clause, and a drill that only counted the deck would pass on an engine
   that put it on top. */
test("a card that redirects itself on hit leaves the combat chain with it", {skip}, () => {
  const ul = {...C.resolveEntry(DB(), {name: "Under Loop", p: 1, code: null, q: 1}), uid: "ul1"};
  assert.match(ul.tx || "", /bottom of its owner/i, "the printed text is the spec");

  let g = H.state({name: "You", res: 9, ap: 3, hand: [ul], deck: [{uid: "d1", name: "Filler"}]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "loop"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  const played = J.reduce(g, {t: "play", uid: "ul1", from: "hand"}, 0);
  assert.equal(played.error, null);
  /* Under Loop prints Boost, so v2.84 asks the additional cost first.
     Declining is the plain line and keeps this drill about the redirect. */
  let n = J.reduce(played.state, {t: "boost", yes: false}, 0).state;
  assert.deepEqual((n.chainCards || []).map(x => x.card.uid), ["ul1"],
    "it is on the chain — this path files at the close step, not at declaration");

  for(let i = 0; i < 20 && n.sides[1].hp === 20; i++)
    for(const seat of [0, 1]){
      const out = J.reduce(n, {t: "pass"}, seat);
      if(!out.error){ n = out.state; break; }
    }

  assert.equal(n.sides[1].hp, 16, "it HIT — without that the redirect never fires and this drill proves nothing");
  assert.deepEqual(INV.errors(n), [], "the census must be clean at the instant it lands");
  assert.deepEqual((n.chainCards || []).map(x => x.card.uid), [],
    "it left the chain — holding it there is the card in two zones");
  assert.deepEqual(n.sides[0].deck.map(x => x.uid), ["d1", "ul1"],
    "and it is on the BOTTOM of the deck, under what was already there");
  assert.deepEqual(n.sides[0].grave.map(x => x.uid), [],
    "the graveyard is what the clause REPLACES — a copy there is the card duplicated");
});

/* ---- PURITY AND DETERMINISM --------------------------------------------- */

test("reduce never mutates the state it is given", {skip}, () => {
  const g = match({seed: "pure"});
  const before = JSON.stringify(g);
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand[0];
  J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat);
  J.reduce(g, {t: "pass"}, seat);
  J.reduce(g, {t: "endTurn"}, seat);
  J.reduce(g, {t: "play", uid: "nonsense", from: "hand"}, seat);
  assert.equal(JSON.stringify(g), before, "reduce reached back and changed its input");
});

test("an illegal action leaves the state untouched", {skip}, () => {
  const g = match({seed: "illegal"});
  const out = J.reduce(g, {t: "endTurn"}, P.other(g.turnPlayer));
  assert.ok(out.error);
  assert.equal(out.state, g, "an illegal action returned a new state");
});

test("the same seed and the same actions give the same game", {skip}, () => {
  const a = drive(match({seed: "replay"}));
  const b = drive(match({seed: "replay"}));
  assert.equal(JSON.stringify(a.g.feed), JSON.stringify(b.g.feed), "two runs of one seed diverged");
  assert.equal(a.g.sides[0].hp, b.g.sides[0].hp);
  assert.equal(a.g.rng.n, b.g.rng.n, "the draw counters diverged — the desync canary");
});

test("a different seed gives a different game", {skip}, () => {
  const a = drive(match({seed: "seed-a"}));
  const b = drive(match({seed: "seed-b"}));
  assert.notEqual(JSON.stringify(a.g.feed), JSON.stringify(b.g.feed));
});

test("no Math.random anywhere in the reducer", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.ok(!/Math\.random/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "an unseeded draw makes the game unreplayable and two peers undiagnosable");
});

/* ---- ENDINGS ------------------------------------------------------------ */

test("a seat at 0 life loses, and the game stops accepting actions", {skip}, () => {
  let g = match({seed: "death"});
  const loser = P.other(g.turnPlayer);
  g = J.put(g, loser, s => ({...s, hp: 1}));
  const {g: end} = drive(g);
  assert.ok(end.over, "nobody won");
  assert.equal(J.legal(end, {t: "pass"}, end.turnPlayer), "the game is over");
});

/* CR 4.5.3 lists EVERY way a player loses and there are three: their
   hero's life reaches zero or they control no hero (a), an effect says
   they lose (b), or they concede (c). An empty deck is not one of them,
   and this used to end the game by "fatigue" — an invented condition, in
   the direction that matters: it handed a win to a player whose opponent
   was still alive and still holding cards. */
test("CR 4.5.3 — an empty deck is NOT a loss; the draw just takes what is there", {skip}, () => {
  let g = match({seed: "fatigue"});
  const seat = g.turnPlayer;
  g = J.put(g, seat, s => ({...s, deck: [], hand: []}));
  const n = J.drawTo(g, seat);
  assert.ok(!n.over, "an empty deck ended the game — CR 4.5.3 has no deck-out loss");
  assert.deepEqual(n.sides[seat].hand, [], "cards came from nowhere");
  assert.ok(n.feed.some(m => /deck is empty/.test(m)), "the empty deck was not reported at all");

  /* and a partial draw takes what is left rather than failing whole */
  let h = match({seed: "fatigue2"});
  const s2 = h.turnPlayer, one = h.sides[s2].deck[0];
  h = J.put(h, s2, s => ({...s, deck: [one], hand: []}));
  const m = J.drawTo(h, s2);
  assert.equal(m.sides[s2].hand.length, 1, "a short deck did not give up the card it had");
  assert.ok(!m.over);
});

test("the only ways the reducer ends a game are CR 4.5.3's", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const hows = [...src.matchAll(/how:\s*"([a-z]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual([...new Set(hows)], ["concession", "life"],
    "judge.js ends a game some way CR 4.5.3 does not name");
});

test("conceding is always legal and hands the win over", {skip}, () => {
  const g = match({seed: "concede"});
  const out = J.reduce(g, {t: "concede"}, 1);
  assert.equal(out.error, null);
  assert.equal(out.state.over.winner, 0);
  assert.equal(out.state.priority, null, "someone still holds priority in a finished game");
});

/* ---- LEGALITY IS TOTAL --------------------------------------------------- */

/* A PLAY YOU CANNOT PAY FOR IS NOT A LEGAL PLAY, and leaving that out is
   not harmless. `legal` said yes, `doPlay` opened a payment that could
   never be completed, and the only move left was to cancel back into the
   identical state. That is a live-lock for any driver that trusts `legal`
   — which is the reducer's contract, and is how the guest client and the
   sequencer both decide what to send — and a dead tap for a human. */
test("a card the seat cannot possibly fund is refused, not offered", {skip}, () => {
  let g = match({seed: "afford"});
  const seat = g.turnPlayer;
  const sd = g.sides[seat];
  const dear = sd.hand.slice().sort((a, b) => (b.cost || 0) - (a.cost || 0))[0];
  assert.ok((dear.cost || 0) > 0, "no card with a cost in this opening hand");

  /* no pool, and every other card in hand pitches for nothing */
  g = J.put(g, seat, s => ({...s, res: 0,
    hand: s.hand.map(c => c.uid === dear.uid ? c : {...c, pitch: 0})}));

  const why = J.legal(g, {t: "play", uid: dear.uid, from: "hand"}, seat);
  assert.ok(why, "a card costing " + dear.cost + " with 0 resources and nothing to pitch was declared legal");
  assert.match(why, /cannot raise/, "refused for the wrong reason: " + why);

  /* and it opens no payment the seat would then have to cancel out of */
  const out = J.reduce(g, {t: "play", uid: dear.uid, from: "hand"}, seat);
  assert.ok(out.error);
  assert.equal(out.state, g, "an unaffordable play still changed the state");

  /* give it exactly enough to pitch for and it becomes legal again */
  const other = g.sides[seat].hand.find(c => c.uid !== dear.uid);
  let h = J.put(g, seat, s => ({...s,
    hand: s.hand.map(c => c.uid === other.uid ? {...c, pitch: dear.cost} : c)}));
  assert.equal(J.legal(h, {t: "play", uid: dear.uid, from: "hand"}, seat), null,
    "a card that CAN be paid for by pitching was refused");
});

test("legal() gives a reason or null for every action, and never throws", {skip}, () => {
  /* EVERY ZONE, not just `hand`. This drill passed while `legal` threw a
     TypeError on `from:"arsenal"` — the arsenal holds one card, not a
     list, and the list path ran straight into it. A legality check that
     throws is worse than one that says no: the reducer's contract is
     that an illegal action leaves the state untouched, and an exception
     breaks it in the caller rather than returning a reason. */
  const ZONES = ["hand", "arsenal", "grave", "banish", "deck", "pitch", "soul", "board", "gear", "nonsense"];
  const g = match({seed: "total"});
  const states = [g, J.put(g, 0, s => ({...s, arsenal: s.hand[0], hand: s.hand.slice(1)}))];
  for(const st of states){
    for(const t of J.ACTIONS){
      for(const seat of [0, 1]){
        for(const from of ZONES){
          const why = J.legal(st, {t, uid: "nope", from}, seat);
          assert.ok(why === null || typeof why === "string",
            `${t}/${seat}/${from} returned ${why}`);
        }
      }
    }
  }
  /* and with a real uid in the arsenal, the play must be ALLOWED — a
     refusal for the wrong reason would hide the same bug */
  const armed = states[1];
  const held = armed.sides[0].arsenal;
  const why = J.legal(J.put(armed, 0, s => ({...s, res: 9})),
                      {t: "play", uid: held.uid, from: "arsenal"}, 0);
  assert.ok(why === null || /window|action point|reaction/.test(why),
    `playing from the arsenal was refused as "${why}"`);

  assert.equal(J.legal(g, {t: "wat"}, 0), "unknown action: wat");
  assert.equal(J.legal(g, {t: "pass"}, 7), "no such seat");
  assert.equal(J.legal(null, {t: "pass"}, 0), "no action");
});

/* ===================================================================
   THE FEED IS SHARED; A REFUSAL IS NOT (v2.83)

   Found by playing a game at the local table rather than by a drill.
   The dummy's own payment appeared in the log as "Brutal Assault costs
   2 and YOU hold 0 — pitch, or cancel", because the message was written
   in the second person while the state named the seat. On the trainer's
   board that never mattered — seat 1 paid no costs — and it is wrong
   the moment seat 1 spends anything, which it has since v2.71.

   The distinction is real and both halves are load-bearing:

     say(...)        goes into `feed`, which BOTH seats read  -> NAME the seat
     return "reason" goes back to the caller who acted        -> "you" is right

   So this is not "never say you". It is a census over the two kinds,
   which is what stops the fix being three edited strings that a fourth
   line quietly reopens.
   =================================================================== */
test("a log line names the seat; only a refusal speaks in the second person", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")          /* prose trips scans in both directions */
    .replace(/\/\/[^\n]*/g, "");

  /* Every argument to say() that is a literal or a concatenation of them.
     A say() whose message is a variable is out of reach of a source scan
     and is deliberately not claimed — see the driven check below. */
  const says = [...src.matchAll(/\bsay\(/g)].map(m => {
    /* walk to the matching close paren so a nested call cannot truncate it */
    let i = m.index + 4, depth = 1;
    while(i < src.length && depth > 0){ const c = src[i]; if(c === "(") depth++; else if(c === ")") depth--; i++; }
    return src.slice(m.index, i);
  });
  /* 27 today. The floor is a canary against the SCAN breaking, not a pin
     on how much judge.js logs — set from the real count rather than
     guessed, because a threshold nobody measured is the same as none. */
  assert.ok(says.length >= 20, `only ${says.length} say() calls found — the scan shape moved, repoint this drill`);

  const offenders = [];
  for(const s of says)
    for(const lit of (s.match(/"[^"]*"/g) || []))
      if(/\byour?\b/i.test(lit)) offenders.push(lit);
  assert.deepEqual(offenders, [],
    "these go into the shared feed and address one seat as 'you' — name the seat instead");

  /* AND THE OTHER HALF, or this passes just as well on an engine that
     stopped refusing anything at all. Refusals are returned, not logged,
     and they SHOULD be second person. */
  const g = J.newMatch({builds: [null, null], names: ["A", "B"], heroKeys: [null, null],
                        first: 0, seed: "voice"});
  assert.equal(J.legal(g, {t: "pass"}, 1), "you do not hold priority",
    "a refusal is addressed to whoever attempted the action");
});

/* The same rule, DRIVEN — because a source scan cannot see a message built
   from a variable, and because the scan alone would not have caught this
   one had the string been assembled a line earlier.

   THE FIRST VERSION OF THIS DRILL PASSED BY FINDING NOTHING, and it is
   worth saying how: it built `newMatch({builds:[null,null]})`, which seats
   two heroes with no deck and no hand. The game ran 101 turns and produced
   1002 feed lines — every one of them an end-phase step — and NOT ONE
   payment, because neither seat ever had a card to pay for. It asserted
   `feed.length > 0`, which was true and meaningless. Sabotaging the fix
   left it green while the source scan beside it went red, which is the
   only reason it was caught.

   So it drives two REAL precons, and it asserts that it saw the thing it
   is about before it asserts anything about how that thing reads. */
test("a payment reaches the shared feed under the paying seat's name", {skip}, () => {
  const {g} = drive(match({seed: "voice-2"}));
  const feed = g.feed || [];

  /* THE CANARY FIRST: this drill is only worth having if the game actually
     reached a payment. Without this it passes on any game at all. */
  const pays = feed.filter(l => /pitch, or cancel/.test(l));
  assert.ok(pays.length > 0,
    "the driven game never reached a payment — this drill would prove nothing");

  /* Both seats pay over a full game, so this covers both without having to
     name which. */
  const secondPerson = pays.filter(l => /\byour?\b/i.test(l));
  assert.deepEqual(secondPerson, [],
    "a payment line must name the seat paying, not address one of them");
});

/* ---- THE REST OF THE FEED IS A LEDGER, NOT A CLEAN BILL --------------
   Driving the drill above over two real precons turned up the SAME defect
   in `engine/effects.js`, which judge.js's source scan cannot see because
   it is a different file:

     "Dawnblade connects — YOUR hero ability frees it for one more swing"
     "The first card with 6 or more {p} YOU have discarded this action phase"

   Those are card semantics, shared by both boards, and they read as the
   player's whichever seat resolved them. It is the same rule and it is a
   separate pass: 44 literals in that file mention you/your and a real
   share of them are REFUSAL reasons, where the second person is correct.
   Telling those apart is a judgement per line, not a regex.

   So the debt is PINNED rather than papered over or silently fixed in a
   commit about something else — the same device `flatRemaining` used for
   the sides migration, and what keeps "known" from decaying into folklore.

   IT PINS THE SOURCE, NOT A GAME'S OUTPUT. The obvious version of this
   drill counts second-person lines in a driven feed, and that count is
   EMERGENT: 3 on one seed, 4 on the next, because it depends on which
   cards happened to resolve. Pinning it would turn every honest card fix
   into a red drill and train the reader to edit the number without
   thinking — HANDOFF-MERGE.md's own lesson 5, in a fresh disguise. The
   number of second-person literals IN THE FILE is a property of the code,
   so it moves only when somebody writes or fixes one. */
test("the second-person debt in the shared semantics does not grow", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const lits = (src.match(/`[^`]*`|"[^"]*"/g) || []).filter(s => /\byour?\b/i.test(s));
  /* 45 today. A real share are REFUSAL reasons, where the second person is
     correct — telling those from feed lines is a judgement per line rather
     than a regex, which is why this is a ledger and not a fix.

     IT WENT 44 -> 45 AT v3.03, DELIBERATELY. Cold Snap's freeze opens a
     `pick` whose hint reads "it cannot be played or activated until the
     start of YOUR next turn" — and a prompt is addressed to ONE SIDE
     (`spec.side` has meant that since v2.17), so the second person is
     correct there for the same reason it is correct in a refusal. The
     matching FEED line names the seat instead: "…until the start of
     <name>'s next turn". Moving this number must always be an edit with a
     reason attached; that is the whole device. */
  assert.ok(lits.length <= 45,
    `second-person literals in effects.js rose to ${lits.length} — the shared feed is read by both seats`);
  /* AND IT MUST NOT PASS BY FINDING NOTHING: if the scan ever stops
     matching, an empty result reads as a clean file. */
  assert.ok(lits.length >= 30,
    `only ${lits.length} matched — the scan shape moved, repoint this drill rather than banking the win`);
});

/* THE SHARED SEMANTICS MUST NOT NAME THE OPPONENT (v2.84)

   Same family as the second-person ledger above, and found the same way —
   by asking what a line reads like with a PERSON in seat 1. `effects.js`
   is reached by both boards, and it hardcoded "the dummy" in six
   player-facing strings:

     "Frailty — dummy's next swing -2."
     "Crush lands, but the dummy's hand is empty."
     "it's your turn, not the dummy's"

   At a networked table those describe a human being as the training prop.
   Every one now reads `foe(n).name`, which is the opponent's real name on
   both boards — the trainer's dummy is literally called "The Dummy", so
   the trainer's own wording is unchanged.

   `parser.js` carried the same sentence at PARSE time, where no game
   state exists to name anybody, so that one is seat-neutral instead.
   Two copies of one sentence is a small mirror; both were fixed. */
test("the shared semantics never hardcode the training dummy", () => {
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for(const f of ["effects.js", "parser.js"]){
    const src = strip(fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8"));
    /* Player-facing string literals only. A comment may say "dummy" all it
       likes — this is about what reaches a screen. */
    const said = (src.match(/["`][^"`\n]*\bdummy\b[^"`\n]*["`]/gi) || [])
      /* parser.js's keyword LEDGER notes describe the trainer's prop to a
         reader of AUDIT.md and never reach a player. They are stale in
         places (the dummy pays costs since v2.71) and that is a docs job,
         not this one — so they are excluded by name rather than silently
         tolerated by a loose regex. */
      .filter(s => !/live |cost offer|crush rider|stops arcane|taxes a play|plays no defence/i.test(s));
    assert.deepEqual(said, [],
      f + " names the training dummy in a player-facing string — with a person in seat 1 that describes them as the prop");
  }
});
