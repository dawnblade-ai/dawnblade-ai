/* ============================================================
   runechants.test.js — THE SPECIAL RUNECHANTS (v6.42)

   The sixth reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).
   Runechant of Lust and Runechant of Sloth ("Runeblade Instant - Aura")
   print, verbatim (data/staged.js):

     "This counts as a Runechant. When an attack usurps this, create a
      Runechant token. / ... it gets go again.
      When this is destroyed, create a Runechant token.
      At the beginning of your action phase or when you play an attack
      action card, destroy this."

   CR 1.8.8 (verbatim): "If an effect instructs a player to perform an
   action "as though" the game state or rules were modified, or if an
   effect states an object or action "counts as" another object or action,
   rules and effects consider the modified game state or rules for the
   applicable effect only."
   CR 8.3.49 (verbatim): "Usurp is a play-static ability that means 'As an
   additional cost to play this, destroy a Runechant if able. If you destroy
   a Runechant in this way, this gets +2 {p}.'" CR 8.3.49a: "If a player
   pays the additional cost to play a card with usurp, the player and the
   played card are considered to have usurped and Runechant that was
   destroyed is considered to have been usurped."

   Driven at the table (and the trainer's question cut out and run):
     * the readers: it counts as a Runechant; usurp's question is asked
       only between DIFFERENT cards that could pay;
     * usurping Lust: +2, Lust filed, the token pops, Lust pays TWO tokens
       (its usurp line and its destroy line) that do not pop on this attack;
     * usurping the token instead: no arcane, Lust destroys itself on the
       attack and pays one token;
     * Sloth usurped: the attack has go again;
     * an ordinary attack: Lust destroys itself, filed, one token, no arcane;
     * its start-of-turn schedule: destroyed, one token;
     * the AI answers through a reader, with its own reason key.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const E = require("../engine/effects.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const tokE = uid => ({uid, card: {...H.tok("Runechant"), uid}, kind: "aura"});
const lustE = uid => ({uid, card: staged("Runechant of Lust", uid), kind: "aura", sd: "turn"});
const slothE = uid => ({uid, card: staged("Runechant of Sloth", uid), kind: "aura", sd: "turn"});
const tokN = sd => (sd.board || []).filter(b => b.card.name === "Runechant").length;
const onBoard = (sd, uid) => (sd.board || []).some(b => b.uid === uid);
const inGrave = (sd, uid) => (sd.grave || []).some(c => c.uid === uid && c._gy != null);

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const start = (card, board) => table(H.state({res: 9, ap: 1, hand: [card], board}, {hp: 20, hand: []},
  {actor: 0, turnPlayer: 0, turn: 3}));
/* play, answer usurp's question with `pick` (or assert none is asked), and
   stop while the link is still open, before defence */
function declare(card, board, pick){
  let g = start(card, board);
  const out = J.reduce(g, {t: "play", uid: card.uid, from: "hand"}, 0);
  assert.equal(out.error, null);
  g = out.state;
  if(pick === undefined) assert.ok(!(g.pending && g.pending.kind === "usurp"), "a question with nothing to choose was asked");
  else {
    assert.equal(g.pending && g.pending.kind, "usurp", "usurp did not ask which Runechant");
    const r = J.reduce(g, {t: "usurp", uid: pick}, 0);
    assert.equal(r.error, null);
    g = r.state;
  }
  for(let i = 0; i < 10 && !g.pend; i++) g = H.move(g);
  assert.ok(g.pend, "no chain link opened");
  return g;
}

test("the readers: it counts as a Runechant, and every clause is read", {skip}, () => {
  H.db();
  for(const nm of ["Runechant of Lust", "Runechant of Sloth"]){
    const c = staged(nm), fx = P.fxParse(c);
    assert.equal(fx.tier, "full", nm + " has an unread clause: " + JSON.stringify(fx.clauses.filter(x => x.st === "skip")));
    assert.equal(fx.countsAs, "runechant");
    assert.equal(P.isRunechant({uid: "x", card: c}), true, nm + " does not count as a Runechant");
    assert.deepEqual(fx.atkTrigger, {on: ["atk"], ops: []}, nm + ": the attack-play destroy is not a payload-free trigger");
    assert.ok(fx.ops.some(o => o[0] === "selfDestruct" && o[1] === "turn"), nm + ": the start-of-turn destroy is not scheduled");
    assert.deepEqual(fx.onDestroy, [["rune", 1]]);
  }
  assert.deepEqual(P.fxParse(staged("Runechant of Lust")).onUsurp, [["rune", 1]]);
  assert.deepEqual(P.fxParse(staged("Runechant of Sloth")).onUsurp, [["ga"]]);
  /* the controls: an aura that is not a Runechant, and the token itself */
  assert.equal(P.isRunechant({uid: "q", card: H.tok("Quicken")}), false);
  assert.equal(P.isRunechant(tokE("t")), true);
  assert.equal(P.runeCount({board: [tokE("t1"), lustE("l1"), {uid: "q", card: H.tok("Quicken")}]}), 2,
    "a special Runechant is not counted");
});

test("usurp's question: asked only between DIFFERENT cards that could pay", {skip}, () => {
  H.db();
  const gb = staged("Demonbound Gloomblade");
  assert.equal(P.usurpOffer(gb, {board: [tokE("t1"), tokE("t2")]}), null, "plain tokens asked a question");
  assert.equal(P.usurpOffer(gb, {board: [lustE("l1")]}), null, "one candidate asked a question");
  assert.deepEqual(P.usurpOffer(gb, {board: [tokE("t1"), tokE("t2"), lustE("l1"), lustE("l2")]}), {uids: ["t1", "l1"]},
    "the offer is not one uid per different card");
  assert.equal(P.usurpOffer(H.card("Brutal Assault", 3), {board: [tokE("t1"), lustE("l1")]}), null,
    "a card without usurp asked");
  const sd = {board: [tokE("t1"), lustE("l1")]};
  assert.deepEqual(P.usurpTargets(sd).map(b => b.uid), ["t1", "l1"]);
  assert.equal(P.usurpTarget(sd, "l1").uid, "l1", "the named candidate does not pay");
  assert.equal(P.usurpTarget(sd, "nope").uid, "t1", "a uid off the board paid with nothing");
  assert.equal(P.usurpTarget({board: [{uid: "q", card: H.tok("Quicken")}]}), null);
});

test("usurping Lust: +2, Lust is filed, the token pops, and TWO new tokens wait for the next swing", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  const g = declare(card, [tokE("t1"), lustE("l1")], "l1");
  assert.equal(g.pend.total, card.power + 2, "usurping did not give +2");
  assert.equal(g.pend.usurped, true);
  assert.ok(!onBoard(g.sides[0], "l1") && inGrave(g.sides[0], "l1"), "Lust was not destroyed into the graveyard");
  assert.ok(!onBoard(g.sides[0], "t1"), "the token did not pop");
  assert.equal(g.sides[1].hp, 19, "the token that was not usurped did not deal its 1 arcane");
  assert.equal(tokN(g.sides[0]), 2, "Lust's usurp line and destroy line did not make one token each");
});

test("usurping the token instead: no arcane, and Lust destroys itself on the attack for one token", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  const g = declare(card, [tokE("t1"), lustE("l1")], "t1");
  assert.equal(g.pend.total, card.power + 2);
  assert.equal(g.sides[1].hp, 20, "the usurped token dealt arcane damage");
  assert.ok(!onBoard(g.sides[0], "l1") && inGrave(g.sides[0], "l1"), "Lust survived an attack action card being played");
  assert.equal(tokN(g.sides[0]), 1, "Lust's destroy line did not make exactly one token");
});

test("Sloth usurped: the attack gets go again; Lust alone is usurped without a question", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  const s = declare(card, [tokE("t1"), slothE("s1")], "s1");
  assert.equal(s.pend.ga, true, "Sloth's usurp line did not give the attack go again");
  assert.equal(tokN(s.sides[0]), 1, "Sloth's destroy line did not make one token");
  const t = declare(card, [tokE("t1"), slothE("s1")], "t1");
  assert.ok(!t.pend.ga, "go again without usurping Sloth");
  const l = declare(card, [lustE("l1")]);
  assert.equal(l.pend.total, card.power + 2, "a lone special Runechant did not pay usurp");
  assert.equal(tokN(l.sides[0]), 2);
});

test("an ordinary attack: Lust destroys itself, is filed, makes one token, deals nothing", {skip}, () => {
  const ba = {...H.card("Brutal Assault", 3), uid: "ba1"};
  const g = declare(ba, [lustE("l1")]);
  assert.equal(g.pend.total, ba.power, "a card without usurp gained power");
  assert.ok(!onBoard(g.sides[0], "l1") && inGrave(g.sides[0], "l1"));
  assert.equal(tokN(g.sides[0]), 1);
  assert.equal(g.sides[1].hp, 20, "a special Runechant dealt arcane damage like the token");
});

test("played from hand it enters the arena on the start-of-turn schedule, and the schedule pays", {skip}, () => {
  H.db();
  const lust = staged("Runechant of Lust", "lh");
  let g = start(lust, []);
  const out = J.reduce(g, {t: "play", uid: "lh", from: "hand"}, 0);
  assert.equal(out.error, null);
  g = H.drain(out.state);
  const e = (g.sides[0].board || []).find(b => b.uid === "lh");
  assert.ok(e, "the instant aura did not enter the arena");
  assert.equal(e.sd, "turn", "it is not scheduled to be destroyed at the start of the turn");
  assert.equal(g.sides[0].ap, 1, "an instant cost an action point (CR 8.1.6)");
  /* the schedule, as judge's start of turn runs it (`sweepArena` then its ops as the controller) */
  const sw = E.sweepArena(g, 0, "turn");
  assert.deepEqual(sw.fired, ["Runechant of Lust"]);
  let n = H.runOps({...sw.game, actor: 0}, sw.ops, sw.src);
  assert.ok(!onBoard(n.sides[0], "lh") && inGrave(n.sides[0], "lh"), "the schedule did not destroy it into the graveyard");
  assert.equal(tokN(n.sides[0]), 1, "its destroy line did not pay on the schedule");
});

test("the AI answers through a reader: the Runechant worth most destroyed, with its own reason", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  const g = J.reduce(start(card, [tokE("t1"), lustE("l1")]), {t: "play", uid: "us1", from: "hand"}, 0).state;
  assert.equal(g.pending.kind, "usurp");
  assert.ok(J.usurpWorth(g, 0, "l1") > J.usurpWorth(g, 0, "t1"), "Lust is not worth more destroyed than a token");
  assert.deepEqual(SP.act(g, 0), {t: "usurp", uid: "l1"});
  const why = SP.explain(g, 0);
  assert.equal(why.key, "usurp");
  assert.ok(SP.CALL_WHY.usurp, "the reason key has no call text");
  /* refusals: no decline, no card off the offer, nobody else answers */
  assert.match(String(J.legal(g, {t: "usurp", uid: null}, 0)), /not a Runechant the cost can destroy/);
  assert.match(String(J.legal(g, {t: "usurp", uid: "zz"}, 0)), /not a Runechant the cost can destroy/);
  assert.ok(J.legal(g, {t: "usurp", uid: "l1"}, 1), "the other seat answered the question");
  assert.equal(J.legal(g, {t: "usurp", uid: "l1"}, 0), null);
  assert.match(String(J.legal(g, {t: "pass"}, 0)), /usurps first/);
  assert.match(String(J.legal(start(card, []), {t: "usurp", uid: "t1"}, 0)), /nothing is asking/);
  assert.ok(J.PENDING_KINDS.includes("usurp") && J.ACTIONS.includes("usurp"));
});

/* ---- THE TRAINER'S QUESTION, cut out of index.html and run ------------ */
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("the trainer asks the same reader, and its answer rides to execute", {skip}, () => {
  H.db();
  const a = HTML.indexOf("const maybeUsurp = (s,card,from,idx) => {");
  const b = HTML.indexOf("const maybeCharge = (s,card,from,idx,picked) => {");
  assert.ok(a > 0 && b > a, "maybeUsurp .. maybeCharge moved — re-anchor this drill");
  const calls = [];
  let held = null;
  /* v6.43: usurp hands on to the optional graveyard banish cost
     (`maybeBanCost`), which then asks charge; the stub stands for the next
     cost either way */
  const T = new Function("act", "DawnParser", "maybeBanCost", "setG",
    HTML.slice(a, b) + "\nreturn {maybeUsurp, confirmUsurp};")(
    s => s.sides[0], P, (s, card, from, idx) => { calls.push(s); return {...s, charged: true}; },
    f => { held = f(held); });
  const card = staged("Demonbound Gloomblade", "us1");
  const g = start(card, [tokE("t1"), lustE("l1")]);
  const q = T.maybeUsurp(g, card, "hand", 0);
  assert.equal(q.mode, "usurppick", "the trainer asked nothing");
  assert.deepEqual(q.pending.uids, ["t1", "l1"]);
  held = q; T.confirmUsurp("l1");
  assert.equal(held._usurpUid, "l1", "the answer does not ride on the state");
  assert.equal(calls.length, 1, "the answer does not go on to the next cost");
  const plain = T.maybeUsurp(start(card, [tokE("t1"), tokE("t2")]), card, "hand", 0);
  assert.ok(plain.charged && plain.mode !== "usurppick", "plain tokens asked the trainer a question");
  /* the shared body reads the answer the trainer hands it */
  const out = H.execute({...g, _usurpUid: "l1"}, card, "hand", 0, {});
  const st = out.game || out;
  assert.ok(inGrave(st.sides[0], "l1"), "execute did not destroy the Runechant the trainer named");
  assert.equal(st._usurpUid, undefined, "the answer was left on the state for the next card");
  assert.match(HTML, /const usurp = kindIs\("usurp"\);/, "the table's demux has no branch for the question");
  assert.match(HTML, /fire\(\{t:"usurp",uid:u\}\)/, "the table's button answers with the wrong action");
  assert.match(HTML, /g\.mode==="usurppick" \? \(<>/, "the trainer's action bar has no buttons for the question");
});

/* ---- A COST THAT DESTROYS "A RUNECHANT YOU CONTROL" (Runebleed Robe) ---- */
test("Runebleed Robe may pay with a special Runechant, which is filed and pays its destroy line", {skip}, () => {
  const B = require("../engine/build.js"), G = require("../engine/game.js"), RNG = require("../engine/rng.js");
  const {loadData} = require("./helpers/extract.js");
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make("robe-lust");
  const h0 = W.HEROES.find(x => x.k === "viserai"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSide(h0, G.parseDeck(W.DECKS.viserai), H.db(), {chest: "Runebleed Robe"}, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  const g0 = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sides = g0.sides.slice();
  sides[0] = {...sides[0], board: [lustE("l1")], res: 0};
  const g = {...g0, sides};
  const robe = (sides[0].gear || []).find(x => /Runebleed/.test(x.name));
  assert.ok(robe, "the Robe is equipped");
  assert.equal(J.legal(g, {t: "activate", uid: robe.uid}, 0), null, "a special Runechant cannot pay the Robe's cost");
  let n = J.reduce(g, {t: "activate", uid: robe.uid}, 0).state;
  for(let i = 0; i < 6 && (n.stack || []).length; i++) n = H.move(n);
  assert.ok(!onBoard(n.sides[0], "l1") && inGrave(n.sides[0], "l1"), "Lust was not destroyed into the graveyard");
  assert.equal(tokN(n.sides[0]), 1, "Lust's destroy line did not pay");
});

/* ---- "WHEN THIS ATTACKS OR HITS" (v6.46) --------------------------------
   Murmuring Gloomblade, verbatim: "When this attacks or hits, create a Runechant
   token." Found when Viserai, Between Worlds was dealt: it was read as a hit trigger
   alone, so the attack made nothing. Two occasions, one payload (the "enters or
   leaves" precedent): one Runechant as it attacks (CR 7.2's declaration, `fx.onAtk`),
   another if it hits. Asserted on the board, both ways. */
test("Murmuring Gloomblade makes a Runechant as it attacks, and another only if it hits", {skip: !H.hasDb() && "no cached card database"}, () => {
  H.db();
  const mg = {...H.card("Murmuring Gloomblade", 1), uid: "mg"};
  assert.match(mg.tx || "", /When this attacks or hits, create a Runechant token/, "fixture: the printed line moved");
  const fx = P.fxParse(mg);
  assert.deepEqual(fx.onAtk, [["rune", 1]], "the attack half is not read");
  assert.deepEqual(fx.onHit, [["rune", 1]], "the hit half is not read");
  /* a bare hit trigger and a bare attack trigger are still one occasion each */
  const tw = (nm, tx) => P.fxParse({...mg, name: nm, tx});
  assert.deepEqual(tw("Drill Hit Only", "When this hits, create a Runechant token.").onAtk, []);
  assert.deepEqual(tw("Drill Atk Only", "When this attacks, create a Runechant token.").onHit, []);
  const swing = blockers => {
    let g = {...H.state({res: 9, ap: 1, hand: [mg]}, {hp: 20, hand: blockers}, {actor: 0, turnPlayer: 0, turn: 3}),
             phase: "action", step: "layer", priority: 0, passed: []};
    g = J.reduce(g, {t: "play", uid: "mg", from: "hand"}, 0).state;
    for(let i = 0; i < 10 && g.step !== "defend"; i++) g = J.reduce(g, {t: "pass"}, g.priority).state;
    assert.equal(g.step, "defend");
    const atAttack = P.runeCount(g.sides[0]);
    for(const c of blockers){ const o = J.reduce(g, {t: "defend", uid: c.uid}, 1); assert.equal(o.error, null); g = o.state; }
    for(let i = 0; i < 40 && g.pend; i++){ const m = H.move(g); if(m === g) break; g = m; }
    return {atAttack, after: P.runeCount(g.sides[0]), hp: g.sides[1].hp};
  };
  const open = swing([]);
  assert.equal(open.atAttack, 1, "no Runechant as it attacked");
  assert.equal(open.after, 2, "the hit did not make the second");
  assert.ok(open.hp < 20, "fixture: it did not hit");
  const shut = swing(["d0", "d1"].map(u => ({...H.card("Brutal Assault", 3), uid: u})));
  assert.equal(shut.hp, 20, "fixture: the wall did not stop it");
  assert.equal(shut.atAttack, 1);
  assert.equal(shut.after, 1, "a blocked swing made the on-hit Runechant");
});
