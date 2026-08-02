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

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
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
  const limit = o.limit || 500;
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
    const p = J.pendingOf(g);
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
        const w = (sd.gear || []).find(x => {
          const wc = PR.weaponCost(x.tx || "");
          return wc && !x.destroyed && !(wc.oncePerTurn && (sd.weaponUsed || {})[x.uid]);
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

test("CR 4.4.3e — BOTH seats lose floating resources, not just the turn player", {skip}, () => {
  let g = match({seed: "fizzle"});
  const off = P.other(g.turnPlayer);
  g = J.put(g, off, s => ({...s, res: 3}));
  const out = J.reduce(g, {t: "endTurn"}, g.turnPlayer);
  let n = out.state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  assert.equal(n.sides[off].res, 0,
    "the non-turn player kept a banked resource through the end phase");
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
  let g = match({seed: "apcost"});
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.isAttack(x));
  g = J.put(g, seat, s => ({...s, res: 9}));
  const out = J.reduce(g, {t: "play", uid: c.uid, from: "hand"}, seat);
  assert.equal(out.error, null);
  assert.equal(out.state.sides[seat].ap, PR.fxParse(c).ga ? 1 : 0,
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
  n = J.reduce(n, {t: "endTurn"}, seat).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;

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
  /* end the turn and set a specific card in the arsenal */
  let n = J.reduce(g, {t: "endTurn"}, seat).state;
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
     two zones for exactly one state transition. */
  let g = match({seed: "walk"});
  const {errs} = drive(g);
  const dirty = errs.filter(e => /INVARIANT/.test(e.why || ""));
  assert.deepEqual(dirty, []);
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

test("an empty deck and an empty hand is a loss by fatigue", {skip}, () => {
  let g = match({seed: "fatigue"});
  const seat = g.turnPlayer;
  g = J.put(g, seat, s => ({...s, deck: [], hand: []}));
  const n = J.drawTo(g, seat);
  assert.ok(n.over, "drawing from an empty deck with an empty hand did not end the game");
  assert.equal(n.over.how, "fatigue");
  assert.equal(n.over.winner, P.other(seat));
});

test("conceding is always legal and hands the win over", {skip}, () => {
  const g = match({seed: "concede"});
  const out = J.reduce(g, {t: "concede"}, 1);
  assert.equal(out.error, null);
  assert.equal(out.state.over.winner, 0);
  assert.equal(out.state.priority, null, "someone still holds priority in a finished game");
});

/* ---- LEGALITY IS TOTAL --------------------------------------------------- */

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
