/* ============================================================
   FUSION IS A COST, AND IT WAS TAKEN WITHOUT BEING PAID (v4.27)

   > "[TALENT] Fusion" — as an additional cost to play this, YOU MAY
   > reveal a [TALENT] card from your hand.

   `fx.fusionCost` has parsed the keyword line since it was written, and
   `execute` settled `fused` by SCANNING THE HAND: the bonus was taken on
   every play that could take it, no card was ever named, and the
   opponent learned nothing. The block's own comment said why — "nothing
   moves zones, so there is no real downside to taking it" — which is
   true about the ZONES and false about the COST. **What a reveal charges
   is INFORMATION**, and in a two-player game with hidden hands that is
   the whole of what the card asks for.

   THE REWARD WITHOUT THE COST is v2.04 read from the other end, and a
   "you may" that cannot be refused is stronger than printed (v3.90). It
   is also sev-1 on `failstates.js`'s own scale — a printed CHOICE never
   offered — and the ruling recorded 2026-07-25 spells the choice out:
   show the qualifying cards, THEY CHOOSE ONE, the opponent is shown it.

   16 pool records across six cards, live in Iyslander's and Briar's
   lists. **AND THE COVERAGE NUMBER CANNOT MOVE**, which is the point:
   every one of them already read `tier: full`, because the clause WAS
   consumed. The one-sided fairness sweep is blind too — taking a cost
   you were never charged is not "granting more than it prints" in the
   shape that check models.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;
const SP = require("../engine/sparring.js");

const skip = !H.hasDb() && "no cached card database";
const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});

/* ---- 1. THE READER, ONCE, FOR BOTH BOARDS -------------------------- */

test("`fusionOffer` answers WHICH cards could pay, and refuses the rest", {skip}, () => {
  H.db();
  const ice  = mk("Cold Snap", 3, "h1");            /* Ice Action */
  const bolt = mk("Ice Bolt", 1, "h2");             /* Ice Wizard Action */
  const gen  = mk("Brutal Assault", 1, "h3");       /* Generic — no talent */
  const card = mk("Aether Icevein", 1, "c1");

  assert.deepEqual(P.fusionOffer(card, {hand: [ice, gen]}),
    {types: ["ice"], uids: ["h1"]});
  assert.deepEqual(P.fusionOffer(card, {hand: [ice, bolt, gen]}).uids, ["h1", "h2"],
    "every eligible card is offered — WHICH one is the player's decision");
  assert.equal(P.fusionOffer(card, {hand: [gen]}), null,
    "a hand that cannot pay is not asked (buildPrompt's rule for an empty spec)");
  assert.equal(P.fusionOffer(card, {hand: []}), null);
  assert.equal(P.fusionOffer(gen, {hand: [ice]}), null,
    "a card that prints no Fusion has no offer");
  /* THE CARD BEING PLAYED IS NOT IN THE HAND TO REVEAL, and the fixture
     for it MUST be synthetic. Measured: all six pool records that print
     Fusion are typed `Elemental`, and NOT ONE of them carries the talent
     it asks for — so no real card can pay for itself and dropping the
     exclusion is SILENT against every pool fixture (v3.73, and the first
     draft of this drill used Polar Cap and came back silent). It is
     excluded by UID rather than by identity, because a card that has been
     through a spread is a different object with the same identity
     (v3.00). */
  const selfIce = {name: "Self Fuse Probe", uid: "c2", pitch: 1, cost: 0, power: 4,
    tt: "Ice Wizard Action - Attack", ty: ["Ice", "Wizard", "Action", "Attack"],
    kw: [], gkw: [], tx: "Ice Fusion\n\nIf this was fused, it gets go again."};
  P.fxReset();
  assert.deepEqual(P.fxParse(selfIce).fusionCost, {types: ["ice"]}, "the fixture prints Fusion");
  assert.ok((selfIce.ty || []).some(x => x.toLowerCase() === "ice"), "…and carries the talent");
  assert.equal(P.fusionOffer(selfIce, {hand: [selfIce]}), null,
    "the card asking cannot pay for itself");
  /* AND THE UID IS THE CALLER'S ANSWER when it differs from the card's —
     `execute` holds an index into a hand the card has already left. */
  const twin = {...selfIce, uid: "c3"};
  assert.deepEqual(P.fusionOffer(selfIce, {hand: [twin]}, "c3"), null,
    "the uid the caller names is the one excluded");
  assert.deepEqual(P.fusionOffer(selfIce, {hand: [twin]}).uids, ["c3"],
    "…and a second copy is a different object and a legal reveal");
  P.fxReset();
});

test("the talent comes off the STRUCTURED ARRAY, and the pool agrees today", {skip}, () => {
  H.db();
  /* v2.39's ruling: where `tt` and `ty` conflict, the array wins. The
     scan that measured this was WRONG FIRST — its `\b` was eaten by a
     shell escape and it reported 45 disagreements, every one of them a
     card whose `tt` plainly contains the word. Check your own fixture
     (twelfth time); the honest answer is ZERO. */
  const C = require("../engine/cards.js");
  const raw = require("../data/pool.json");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  let n = 0, disagree = 0;
  for(const r of raw){
    const c = C.resolveEntry(db, {name: r.name, p: (r.pitch === "" || r.pitch == null) ? 0 : +r.pitch,
                                  code: null, q: 1});
    if(!c) continue; n++;
    for(const ty of ["ice", "lightning"]){
      const byTT = new RegExp("\\b" + ty + "\\b", "i").test(c.tt || "");
      const byTY = (c.ty || []).some(x => String(x).toLowerCase() === ty);
      if(byTT !== byTY) disagree++;
    }
  }
  assert.ok(n > 700, "the scan is aimed wrong — it found " + n + " records");
  assert.equal(disagree, 0,
    "the two readers have diverged; `ty` is the authority (v2.39) and this " +
    "drill is the record that the change moved nothing when it was made");
  /* AND A DFC IS CORRECT RATHER THAN A HAZARD. `ty` flattens both faces,
     and the reveal shows the PHYSICAL card — a card printing Lightning on
     either face is a Lightning card. */
  const dfc = H.card("Burn Up // Shock", 1);
  assert.ok((dfc.ty || []).some(x => String(x).toLowerCase() === "lightning"),
    "the fixture stopped being a Lightning card");

  /* THE NEAR-MISS IS SYNTHETIC, because the agreement above is exactly
     what makes swapping the reader SILENT against every pool fixture
     (v3.73). These two cards are the discriminator: one whose printed
     LINE says Ice and whose array does not, and one the other way round.
     The array is the authority (v2.39), so only the second may pay. */
  const card = {name: "Talent Probe Card", uid: "c1", pitch: 1, cost: 0,
    tt: "Elemental Wizard Action", ty: ["Elemental", "Wizard", "Action"],
    kw: [], gkw: [], tx: "Ice Fusion"};
  P.fxReset();
  const sayIce = {name: "Says Ice", uid: "s1", pitch: 1, cost: 0,
    tt: "Ice Wizard Action", ty: ["Wizard", "Action"], kw: [], gkw: [], tx: ""};
  const isIce  = {name: "Is Ice", uid: "s2", pitch: 1, cost: 0,
    tt: "Wizard Action", ty: ["Ice", "Wizard", "Action"], kw: [], gkw: [], tx: ""};
  assert.deepEqual(P.fusionOffer(card, {hand: [sayIce, isIce]}).uids, ["s2"],
    "the talent is read off the STRUCTURED ARRAY — the printed line is the " +
    "field v2.39 ruled against, and a reader that asks it takes the wrong card");
  P.fxReset();
});

/* ---- 2. THE OFFER IS MADE, AND ANSWERED ---------------------------- */

function open(hand, opts){
  H.db();
  let g = H.state(Object.assign({name: "Iyslander", res: 9, ap: 3, hand,
                                 deck: [{uid: "d1", name: "F"}]}, opts || {}),
                  {name: "Them", hp: 20, deck: [{uid: "d2", name: "B"}]},
                  {actor: 0, turnPlayer: 0, seed: "fu", turn: 4});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const r = J.reduce(g, {t: "play", uid: "c1", from: "hand"}, 0);
  assert.ok(!r.error, String(r.error));
  return r.state;
}

test("DRIVEN: the offer is a real pending, carrying the talent and the uids", {skip}, () => {
  const n = open([mk("Polar Cap", 1, "c1"), mk("Cold Snap", 3, "h1"),
                  mk("Brutal Assault", 1, "h2")]);
  assert.equal(n.pending && n.pending.kind, "fuse",
    "the printed 'you may' opened no question — it is being taken for free");
  assert.deepEqual(n.pending.types, ["ice"]);
  assert.deepEqual(n.pending.uids, ["h1"], "and only the card that can pay");
  /* THE PENDING BELONGS TO ONE SEAT and locks the board until answered,
     which is what makes a COST settle before the card resolves (v3.34). */
  assert.match(String(J.legal(n, {t: "pass"}, 0)), /fusion reveal/);
});

test("DRIVEN: a hand that cannot pay is never asked, and plays straight through", {skip}, () => {
  const n = open([mk("Polar Cap", 1, "c1"), mk("Brutal Assault", 1, "h2")]);
  assert.ok(!n.pending, "a question with one possible answer is a tap that teaches nothing");
  assert.ok((n.feed || []).some(l => /not fused/i.test(l)), "and the feed says why");
});

test("DRIVEN: revealing pays the cost — the card is NAMED, and the rider fires", {skip}, () => {
  let n = open([mk("Polar Cap", 1, "c1"), mk("Cold Snap", 3, "h1")]);
  const r = J.reduce(n, {t: "fuse", uid: "h1"}, 0);
  assert.ok(!r.error, String(r.error));
  n = r.state;
  /* THE FEED IS THE REVEAL. A log line is read by BOTH seats (v2.83), so
     naming the card is what the printed cost actually does — the whole
     price is the information, and a line that says "fused" without saying
     WHAT was shown charges nothing. */
  assert.ok((n.feed || []).some(l => /Cold Snap/.test(l) && /fused/i.test(l)),
    "the revealed card is not named in the shared feed: " + JSON.stringify((n.feed || []).slice(0, 4)));
  assert.deepEqual((n.sides[1].board || []).map(b => b.card.name), ["Frostbite"],
    "and the fused rider fired");
  assert.ok((n.sides[0].hand || []).some(c => c.uid === "h1"),
    "a reveal moves nothing — the card is still in hand");
});

test("DRIVEN: declining is a real line of play, and it was unreachable before", {skip}, () => {
  let n = open([mk("Polar Cap", 1, "c1"), mk("Cold Snap", 3, "h1")]);
  n = J.reduce(n, {t: "fuse", uid: null}, 0).state;
  assert.deepEqual((n.sides[1].board || []).map(b => b.card.name), [],
    "the rider fired on a cost that was refused");
  assert.equal(n.sides[1].hp, 20 - 4, "and the unconditional half is untouched");
  /* THE THIRD ROW THE OLD ENGINE COULD NOT EXPRESS: it could not tell
     "no Ice card in hand" from "did not reveal one", and only one of
     those is a decision the printed line offers. */
  assert.ok((n.feed || []).some(l => /declined/i.test(l)),
    "and the feed distinguishes a decline from an empty hand");
});

/* ---- 3. THE GUARDS ------------------------------------------------- */

test("a card that cannot pay is REFUSED, not silently treated as a decline", {skip}, () => {
  const n = open([mk("Polar Cap", 1, "c1"), mk("Cold Snap", 3, "h1"),
                  mk("Brutal Assault", 1, "h2")]);
  assert.match(String(J.legal(n, {t: "fuse", uid: "h2"}, 0)), /cannot be revealed/,
    "`legal` and `reduce` must agree about what a seat may send (fuzz.test.js)");
  assert.equal(J.legal(n, {t: "fuse", uid: "h1"}, 0), null);
  assert.equal(J.legal(n, {t: "fuse", uid: null}, 0), null, "declining is always legal");
});

test("`execute` RE-DERIVES the answer — a uid off a wire fuses nothing", {skip}, () => {
  H.db();
  /* `reduce` is fed by JSON off a wire (v2.48), so a stale or crafted
     `_fuseUid` must not pay a cost the hand cannot pay. The same guard
     `_addPaid` grew at v3.34, for the same reason. */
  const card = mk("Polar Cap", 1, "c1");
  const gen  = mk("Brutal Assault", 1, "h2");
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand: [card, gen], deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", hp: 20, deck: [{uid: "d2", name: "B"}]},
                  {actor: 0, turnPlayer: 0, seed: "fu2", turn: 4});
  g = {...g, phase: "action", step: "layer", _fuseUid: "h2"};
  const out = H.execute(g, card, "hand", 0, {});
  const st = out.game || out;
  assert.deepEqual((st.sides[1].board || []).map(b => b.card.name), [],
    "a Generic card carries no Ice talent, so naming it must fuse nothing");
  const st2 = (() => { const o = H.execute({...g, _fuseUid: "nosuchcard"}, card, "hand", 0, {}); return o.game || o; })();
  assert.deepEqual((st2.sides[1].board || []).map(b => b.card.name), [],
    "and a uid naming no card at all is a decline, never a throw");
});

test("the answer is SPENT — it does not ride into the next play", {skip}, () => {
  let n = open([mk("Polar Cap", 1, "c1"), mk("Cold Snap", 3, "h1")]);
  n = J.reduce(n, {t: "fuse", uid: "h1"}, 0).state;
  assert.equal(n._fuseUid, undefined,
    "a sticky answer fuses the NEXT card without asking — `_half`'s rule (v3.34), " +
    "and boost's own comment says the trainer only escaped it by luck");
});

/* ---- 4. BOTH BOARDS, AND THE POLICY -------------------------------- */

test("both boards ask the same reader, in the same order", () => {
  /* v3.01's shape is the recurring defect: a rule that exists on one
     board only. The READER is shared by construction (`parser.fusionOffer`
     is one body); what a source pin can add is that each board actually
     ASKS it, and that the two costs are asked in the same order so a
     player who learns one board is not surprised by the other. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const jsrc = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(html, /DawnParser\.fusionOffer\(/, "the trainer does not ask the reader");
  assert.match(jsrc, /PR\.fusionOffer\(/, "the table does not ask the reader");
  /* AND FUSION IS ASKED AHEAD OF BOOST ON BOTH. */
  assert.match(jsrc, /function maybeFuse[\s\S]{0,1400}?maybeAddPay\(/,
    "judge's fusion branch no longer falls through to the other costs");
  assert.match(html, /const maybeFuse[\s\S]{0,900}?maybeBoost\(s,card,from,idx\)/,
    "the trainer's fusion branch no longer falls through to boost");
});

test("the policy answers the kind, deterministically, and takes it", {skip}, () => {
  const n = open([mk("Polar Cap", 1, "c1"), mk("Ice Bolt", 1, "h2"),
                  mk("Cold Snap", 3, "h1")]);
  assert.equal(n.pending.kind, "fuse");
  const a = SP.act(n, 0);
  assert.equal(a && a.t, "fuse", "a kind with no branch is answered with a paySel, which `legal` refuses");
  assert.equal(J.legal(n, a, 0), null, "a refusal is always a bug in sparring.js");
  /* A TOTAL ORDER (the module's own contract): two peers running this
     over the same state must pick the same card, or the seeded stream
     diverges the moment a human takes over the seat. */
  assert.equal(a.uid, [...n.pending.uids].sort()[0]);
  assert.equal(SP.act(n, 0).uid, a.uid, "and it is stable");
  /* TAKEN, not declined — and the reasoning differs from boost's. The
     price here is information, and both peers hold full state by
     construction, so it is provably zero FOR THIS POLICY rather than
     unweighable. Declining would leave every fusion rider in the pool
     driven NEVER in self-play (v3.50, v3.84). */
  assert.notEqual(a.uid, null);
});

/* ---- 5. THE CENSUS ------------------------------------------------- */

test("the pool's fusion records are pinned, and every one already read `full`", {skip}, () => {
  H.db();
  const C = require("../engine/cards.js");
  const raw = require("../data/pool.json");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const names = new Set(); let n = 0;
  for(const r of raw){
    const c = C.resolveEntry(db, {name: r.name, p: (r.pitch === "" || r.pitch == null) ? 0 : +r.pitch,
                                  code: null, q: 1});
    if(!c) continue;
    const fx = P.fxParse(c);
    if(!fx.fusionCost) continue;
    n++; names.add(c.name);
  }
  assert.equal(n, 16, "the pool's fusion footprint moved");
  assert.deepEqual([...names].sort(), ["Aether Icevein", "Arcanic Shockwave", "Brain Freeze",
    "Entwine Lightning", "Ice Eternal", "Polar Cap"]);
  P.fxReset();
});

test("the counter's phrase and the engine's phrase are pinned together", () => {
  /* v3.81: a counter that spells the wrong word reports ZERO exactly as a
     missing feature does. Both spellings live here, so a reword of either
     breaks a drill instead of silently zeroing the route count. Measured
     at v4.27: 44 firings in 210 games, all Iyslander (Briar's two
     Lightning cards are in her list too and did not come up on these
     seeds) — which is v3.84's question answered rather than assumed. */
  const eff = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const sp  = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.ok(eff.includes("is fused (Fusion)."),
    "the engine stopped printing the phrase the counter watches for");
  assert.ok(/\/is fused \\\(Fusion\\\)\/\.test\(line\)\)\s*events\.push\(\["fusion"/.test(sp),
    "the counter stopped watching for the phrase the engine prints");
  /* AND THE SEAT IS NAMED, not second-personed. A log line is read by
     BOTH seats (v2.83) and this one is addressed to the opponent as much
     as to the player, so it goes through `sv` — seat 0 is literally
     called "You" (v2.83, v3.90, v4.15), and a hand-built possessive or a
     bare third-person verb reads "You reveals". */
  assert.ok(/sv\(act\(n\), "reveal"\)/.test(eff),
    "the reveal line stopped asking the helper that inflects a seat's name");
});

