/* ============================================================
   WHOSE HIT WAS IT? (CR 1.4.5, v3.45)

   An ally is an attack-target, so "hits" and "hits a HERO" stopped being
   the same event the moment one could be attacked — and nothing asked.
   Driven at the table before this existed: Infecting Shot prints "When
   this hits a HERO, create a Bloodrot Pox token under their control", and
   it created one off a hit on Barnacle, an ALLY.

   The pool partitions cleanly, and both halves matter:

     19 records print "hits a hero"  -> must NOT fire on an ally hit
     13 records print a bare "hits"  -> MUST still fire on an ally hit
     15 crush riders print "damage to a hero" — all of them

   No tool here could see it. Coverage counts the clause consumed either
   way; the fairness sweep does not model attack-targets at all.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");
const J = H.J;
const G = require("../engine/game.js");
const TY = require("../engine/types.js");
const PRI = require("../engine/priority.js");
const B = require("../engine/build.js");
const RNG = require("../engine/rng.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const W = loadData();

/* ---- 1. THE PARSER READS THE SUBJECT --------------------------------- */

test("the on-hit trigger carries WHOSE hit it asks about", () => {
  const hero = P.classifyClause("when this hits a hero, they discard a card");
  const bare = P.classifyClause("when this hits, put it into your soul");
  assert.equal(hero.heroOnly, true, "\"a hero\" is a restriction, not decoration");
  assert.equal(bare.heroOnly, false, "and a bare \"hits\" must keep firing on any target");
  /* "hits them" is the same claim with the noun already resolved. */
  assert.equal(P.classifyClause("when this hits them, they discard a card").heroOnly, true);
});

test("fxParse files the two subjects in two lists", {skip}, () => {
  H.db();
  /* TWO LISTS, NOT A TAG ON THE OP: an op is a bare array, so a flag on it
     would sit where some other reader expects a parameter. */
  P.fxReset();
  const inf = P.fxParse(H.card("Infecting Shot", 1));
  assert.deepEqual(inf.onHit, [], "nothing in the any-hit list");
  assert.deepEqual(inf.onHitHero, [["token", "bloodrot pox", 1, "foe"]]);

  P.fxReset();
  const ill = P.fxParse(H.card("Illuminate", 1));
  assert.deepEqual(ill.onHitHero, [], "Illuminate prints a BARE \"when this hits\"");
  assert.deepEqual(ill.onHit, [["soulSelf"]], "so it ascends on ANY hit, ally included");
});

test("a GATED rider keeps its subject too", {skip}, () => {
  H.db();
  P.fxReset();
  assert.equal(P.fxParse(H.card("Hot on Their Heels", 1)).condOnHit[0].heroOnly, true);
  P.fxReset();
  assert.equal(P.fxParse(H.card("Bolt of Courage", 1)).condOnHit[0].heroOnly, false,
    "\"when this hits, draw a card\" — bare, so an ally hit still draws");
});

test("crush is hero-gated by its own printed anchor", {skip}, () => {
  H.db();
  /* Not assumed about the keyword: the reader's pattern REQUIRES the words
     "damage to a hero", so a card reaching `fx.crush` printed them. */
  P.fxReset();
  const cr = P.fxParse(H.card("Debilitate", 1)).crush;
  assert.equal(cr.heroOnly, true);
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "parser.js"), "utf8");
  assert.match(src, /crush\\s\*\[-—\]\\s\*when this deals \(\\d\+\) or more damage to a hero/,
    "the anchor is what proves it — widen it and heroOnly becomes an assumption");
});

test("a card whose ONLY payload is hero-gated is still playable", {skip}, () => {
  H.db();
  /* WHEN YOU SPLIT A LIST, GREP FOR EVERYONE READING THE WHOLE OF IT.
     `fx.playable` asked `onHit.length` alone, so six cards whose only
     effect is hero-gated flipped to `playable: false` — which is the
     trainer's "no scripted effect yet — pitch it, block with it" refusal.
     Caught by an AUDIT DIFF, not by a drill; this is that drill. */
  for(const [nm, p] of [["Strongest Survive", 1], ["Searing Shot", 1], ["Rush of Power", 1]]){
    P.fxReset();
    const f = P.fxParse(H.card(nm, p));
    assert.deepEqual(f.onHit, [], nm + ": its payload is hero-gated");
    assert.ok((f.onHitHero || []).length, nm + ": …and it is in the hero list");
    assert.equal(f.playable, true, nm + " became unplayable when the list split");
  }
});

/* ---- 2. DRIVEN, AT THE TABLE, BOTH WAYS ------------------------------ */

const heroBy = re => W.HEROES.find(h => re.test(h.n) || re.test(h.k));
function match(seed){
  const h0 = heroBy(/azalea/i), h1 = heroBy(/gravy/i);
  const ctr = {n: 0}; let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), H.db(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}

/* Seat 0 holds a hero-gated on-hit attack; seat 1 fields an ally. */
function board(seed){
  let g = match(seed);
  const seat = g.turnPlayer, def = PRI.other(seat);
  const ally = g.sides[def].deck.find(c => TY.isAllyCard(c) && (c.life || 0) >= 2);
  g = J.put(g, def, s => ({...s,
    board: [{card: ally, kind: "ally", spent: false, uid: ally.uid, life: ally.life}],
    deck: s.deck.filter(c => c.uid !== ally.uid)}));
  const atk = g.sides[seat].deck.find(c => {
    P.fxReset(); const fx = P.fxParse(c);
    return P.isAttack(c) && (fx.onHitHero || []).length && (c.power || 0) >= ally.life;
  });
  assert.ok(atk, "no hero-gated on-hit attack in this precon — re-pick the fixture");
  g = J.put(g, seat, s => ({...s, res: 9,
    hand: [atk, ...s.hand.filter(c => c.uid !== atk.uid)],
    deck: s.deck.filter(c => c.uid !== atk.uid)}));
  return {g, ally, atk, seat, def};
}
const toResolution = n => {
  for(let i = 0; i < 20 && n.step !== "resolution"; i++){
    const r = J.reduce(n, {t: "pass"}, n.priority);
    if(r.error) break;
    n = r.state;
  }
  return n;
};
/* The payload lands on the DEFENDER's board as a token. COUNTING the board
   is not enough — the ally leaves as the token arrives, so the length is
   unchanged and a naive check passes on a broken engine. That is exactly
   how the original probe missed this bug; the feed is what showed it. Ask
   for the token BY NAME. */

test("the SAME attack fires on a hero and not on an ally", {skip}, () => {
  /* ONE BOARD, TWO TARGETS. Written as two separate fixtures first, and
     the seeds picked different attack cards — so the halves were not
     comparable and the drill failed for a reason that was not the engine.
     A gate that refuses EVERYTHING passes the ally half perfectly; only
     the hero half can tell it from a gate that works. */
  const {g, ally, atk, seat, def} = board("herogate");
  P.fxReset();
  const payload = P.fxParse(atk).onHitHero[0];
  assert.equal(payload[0], "token", "re-pick the fixture: this drill reads a token payload");
  const tokName = payload[1];
  const has = sd => (sd.board || []).some(b => new RegExp(tokName, "i").test(b.card.name));

  /* --- at the ALLY --- */
  let a = J.reduce(g, {t: "play", uid: atk.uid, from: "hand", target: ally.uid}, seat).state;
  assert.equal(a.pend.target.kind, "ally", "the target must reach the chain link");
  a = toResolution(a);
  assert.equal(a.sides[def].hp, g.sides[def].hp,
    "CR 1.4.5 — ally damage must not spill onto the hero");
  assert.deepEqual(a.sides[def].board.filter(b => b.kind === "ally"), [], "the ally should have died");
  assert.ok(!has(a.sides[def]),
    atk.name + " fired its hero-gated payload off an ALLY hit");
  assert.ok((a.feed || []).some(m => /hit an ally/i.test(m)),
    "and the feed must say why, or the player learns the wrong rule");

  /* --- at the HERO, same board, same card --- */
  let h = J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, seat).state;   /* no target = the hero */
  h = toResolution(h);
  assert.ok(h.sides[def].hp < g.sides[def].hp, "the hero took the damage");
  assert.ok(has(h.sides[def]), "the hero-gated payload must STILL fire on a hero hit");
  assert.ok(h.sides[def].board.some(b => b.kind === "ally"), "and the ally is untouched");
});

test("crush does not fire on an ally, however large the hit", {skip}, () => {
  /* All 15 crush riders print "when this deals 4 or more damage to a
     HERO". Asserting `fx.crush.heroOnly` in the parser proved nothing:
     removing the gate at the FIRE site failed no drill until this one
     existed. Sabotage the code, not just the reader. */
  const h0 = heroBy(/bravo/i), h1 = heroBy(/gravy/i);
  const ctr = {n: 0}; let rng = RNG.make("crush-ally");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const seat = g.turnPlayer, def = PRI.other(seat);
  const ally = g.sides[def].deck.find(c => TY.isAllyCard(c) && (c.life || 0) >= 2);
  const atk = g.sides[seat].deck.find(c => {
    P.fxReset(); const f = P.fxParse(c);
    return f.crush && (c.power || 0) >= f.crush.n && (f.crush.ops[0] || [])[0] === "foeNextTurn";
  });
  assert.ok(ally && atk, "re-pick the fixture: no crush card or no ally");
  g = J.put(g, def, s => ({...s,
    board: [{card: ally, kind: "ally", spent: false, uid: ally.uid, life: ally.life}],
    deck: s.deck.filter(c => c.uid !== ally.uid)}));
  g = J.put(g, seat, s => ({...s, res: 9,
    hand: [atk, ...s.hand.filter(c => c.uid !== atk.uid)],
    deck: s.deck.filter(c => c.uid !== atk.uid)}));

  const armed = st => ((st.nextTurn || []).length > 0);
  let a = toResolution(J.reduce(g, {t: "play", uid: atk.uid, from: "hand", target: ally.uid}, seat).state);
  assert.ok(!armed(a.sides[def]),
    atk.name + " crushed an ALLY — crush asks for damage to a hero");
  assert.ok((a.feed || []).some(m => /crush/i.test(m) && /ally/i.test(m)),
    "and the feed must name the reason");

  /* the half that proves the gate is not simply off */
  let h = toResolution(J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, seat).state);
  assert.ok(armed(h.sides[def]), "crush must STILL fire on a hero hit");
});

/* ---- 3. THE SPLITTER DOES NOT CUT INSIDE A QUOTE ---------------------- */

test("a quoted granted ability survives a sentence break inside it", {skip}, () => {
  H.db();
  /* FaB prints a granted ability in quotes precisely to delimit it.
     Splitting on ". " cut through one, leaving clause 1 holding an
     UNTERMINATED quote — so `quotedText` found no closing mark and the
     payload fell to the loose matchers and fired on play. */
  P.fxReset();
  const f = P.fxParse(H.card("Loot the Hold", 3));
  assert.equal(f.clauses.length, 2, "the quoted ability is ONE clause, plus the printed Go again");
  assert.match(f.clauses[0].t, /Gold token\.\"$/, "the whole quote, closing mark included");
});

test("a trailing period is not a sentence break", () => {
  /* The rule this replaced was `split(/\.\s+/)`, which needs real
     whitespace after the dot. Treating end-of-string as a break ate the
     final "." — caught by a drill pinning an override's exact text. */
  P.fxReset();
  const f = P.fxParse({name: "trailing dot drill", pitch: 1, tt: "Action", power: null,
    kw: [], tx: "Deal 1 damage to target hero."});
  assert.equal(f.clauses.length, 1);
  assert.match(f.clauses[0].t, /\.$/, "the trailing period must survive the split");
});

/* ---- 4. THE RIDER-ONLY GRANT ----------------------------------------- */

test("a rider-only grant claims nothing when its payload cannot be read", {skip}, () => {
  H.db();
  /* Loot the Hold and Loot the Arsenal print "Your next Pirate ally attack
     this turn gets \"…\"" — no pump for `buffNext`, no go again for
     `gaNext`. Both quoted payloads carry an "if you do" tail, the family
     this project deliberately does not read, so the grant refuses rather
     than claiming half of it: Loot the Arsenal's half was the GOLD TOKEN
     with the destroy it pays for dropped — the reward without the cost. */
  for(const nm of ["Loot the Hold", "Loot the Arsenal"]){
    P.fxReset();
    const f = P.fxParse(H.card(nm, 3));
    assert.deepEqual(f.ops, [], nm + " must claim nothing rather than half its rider");
  }
});

test("driven: neither Loot card fires its payload ON PLAY", {skip}, () => {
  H.db();
  const foeHand = [{name: "A", uid: "fa", tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: [], pitch: 1},
                   {name: "B", uid: "fb", tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: [], pitch: 1}];
  P.fxReset();
  const hold = H.card("Loot the Hold", 3);
  const a = H.execute(H.state({hand: [hold], res: 9, ap: 1}, {hand: foeHand}, {turn: 3, actor: 0}),
                      hold, "hand", 0, {});
  assert.equal(a.sides[1].hand.length, 2, "it made the opponent discard with no attack and no hit");

  P.fxReset();
  const ars = H.card("Loot the Arsenal", 3);
  const b = H.execute(H.state({hand: [ars], res: 9, ap: 1}, {}, {turn: 3, actor: 0}), ars, "hand", 0, {});
  assert.equal(b.sides[0].board.filter(x => /gold/i.test(x.card.name)).length, 0,
    "it minted its Gold token on play — the reward with the printed cost dropped");
});

test("a HEADED grant is untouched by the rider-only reader", {skip}, () => {
  H.db();
  /* The anchor is a quote IMMEDIATELY after gets/gains — that is what
     "rider-only" means. A head gets in the way and the clause is left to
     its own reader further down. */
  P.fxReset();
  assert.deepEqual(P.fxParse(H.card("Warrior's Valor", 1)).ops,
    [["buffNext", 3, {g: [["weapon"]]}, {onHit: [["ga"]]}]]);
  P.fxReset();
  assert.deepEqual(P.fxParse(H.card("Avast Ye!", 3)).ops,
    [["gaNext", {g: [["pirate", "ally"]], atk: true},
      {onHitHero: [["token", "gold", 1, "self"]]}]]);
});
