/* ============================================================
   MOUNTING ANGER & RISING RESENTMENT — A DYNAMIC BOUND (v3.92)

     "When this hits, you may banish an attack action card from your hand
      with cost less than the number of Draconic chain links you control.
      If you do, it gets +1{p} and you may play it this turn."
                                              — Mounting Anger

     "…If you do, it costs {r} less to play and you may play it this
      turn."                                  — Rising Resentment

   A RECORDED REFUSAL, COMING DUE. v2.29 refused these two by name and
   wrote down exactly why: no printed field expresses "the number of
   Draconic chain links you control", and a loose substring test that read
   "attack action card" and DROPPED the limit made any attack in hand a
   legal banish — sev-3 "illegal play allowed", the direction that steals
   games. Its own words: "a wrong guess would let a player pay the wrong
   thing, or pay nothing and collect."

   THE REFUSAL STOPPED BEING RIGHT AT v3.86, when `parser.dracLinks` was
   built for Fai's discount — somewhere else entirely, which is what
   v3.47 says a discharge usually looks like. A recorded refusal is a
   debt (v3.38); this is the fourth this fortnight to come due, and the
   third discharged by building the payload rather than loosening a
   reader.

   AND THE TRIGGER HAD BEEN MEASURED AS EMPTY. v3.53 asked the parser
   which records set `fx.optCost` and reported "hits: (none)" — true, and
   true only because the FILTER refused, so `fx.optCost` was never set on
   the two cards whose trigger it is. **A trigger with no card is not
   work; a trigger whose cards were refused one layer up is.** When a
   census reports a family empty, ask what would have to be true for it
   to be non-empty.

   FOUR THINGS THIS DRILL HOLDS, EACH A WAY TO GET IT WRONG:

     the BOUND is not in the parse   `fxParse` memoizes on `name|pitch`,
                                     so a number stored there freezes at
                                     whatever the chain was the first time
                                     the card was read (v3.20, v3.39)
     an UNRESOLVED bound refuses     at every other pick site, and in
                                     `promptFilter` — an unknown key that
                                     falls through admits EVERY card,
                                     which is the sev-3 above
     "IT" is the BANISHED card       not the attacker (v2.29's pin, v2.33's
                                     Bull's Eye Bracers, v3.47's Scuttle
                                     Toes). So the rider is a STAMP
     the LINK counts ITSELF          the attack that hit is a chain link by
                                     the time its own trigger resolves
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PR = require("../engine/prompts.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

const MA_TX = "When this hits, you may banish an attack action card from your hand "
            + "with cost less than the number of Draconic chain links you control. "
            + "If you do, it gets +1{p} and you may play it this turn.\n\n**Go again**";
const RR_TX = "When this hits, you may banish an attack action card from your hand "
            + "with cost less than the number of Draconic chain links you control. "
            + "If you do, it costs {r} less to play and you may play it this turn.\n\n**Go again**";

let _n = 0;
/* `fxParse` MEMOIZES ON `name|pitch` (the drill gotcha), so every
   synthetic fixture gets a name nothing else in the suite can collide
   with — including the two real records, which this file also reads. */
const syn = (tx, o) => Object.assign({
  name: "SYN-DRAC-" + (++_n), pitch: 1, cost: 1, power: 4,
  tt: "Draconic Ninja Action - Attack", ty: ["Draconic","Ninja","Action","Attack"],
  tx, kw: [], gkw: []
}, o || {});

/* ---- 1. THE READER, AND WHERE THE NUMBER IS NOT ---------------------- */

test("both cards are claimed now, on the `hits` trigger", {skip}, () => {
  for(const [nm, tx] of [["Mounting Anger", MA_TX], ["Rising Resentment", RR_TX]]){
    const fx = P.fxParse(syn(tx));
    assert.ok(fx.optCost, nm + ": the optional cost is read");
    assert.equal(fx.optCost.trigger, "hits");
    assert.equal(fx.optCost.kind, "banish");
    assert.equal(fx.optCost.zone, "hand", nm + ": the PRINTED zone, mid-phrase");
  }
});

test("the BOUND is a flag, never a number — the parse carries no count", {skip}, () => {
  /* THE WHOLE SAFETY PROPERTY. `fxParse` memoizes on `name|pitch`, so one
     parse serves every copy of the card in a match; a count stored here
     freezes at whatever the chain was the first time anything read it,
     and every later copy would offer the wrong cards. Same rule `notUid`
     follows for `notSelf` (v3.20) and `arcAmount` for Blaze's X (v3.39). */
  const f = P.fxParse(syn(MA_TX)).optCost.filter;
  assert.equal(f.costLtDrac, true, "the filter says WHICH count");
  assert.equal(f.costLe, undefined, "and never what it currently is");
  assert.equal(f.type, "attack", "the printed subject survives beside it");
  /* And the phrase is CONSUMED — v2.29's rule that the whole subject
     phrase must be read or the card is left unclaimed. A leftover would
     have refused the filter outright. */
  assert.equal(JSON.stringify(Object.keys(f).sort()),
               JSON.stringify(["costLtDrac", "type"]));
});

test("the two riders read as STAMPS, not ops — 'it' is the banished card",
     {skip}, () => {
  /* v2.29 pinned this and refused both cards partly for it: "in both, 'it'
     is the banished card, not the attacker, so the existing `self` op is
     the wrong op for either." Left to `classifyClause`, "it gets +1{p}"
     comes back as `[["self",1]]` — a pump on the card being RESOLVED,
     which is the attack that just hit. v2.33's Bull's Eye Bracers trap and
     v3.47's Scuttle Toes, a third time. */
  const ma = P.fxParse(syn(MA_TX)).optCost;
  assert.deepEqual(ma.ops, [], "no ops — nothing is applied to the source");
  assert.equal(ma.banStamp.pow, 1);
  assert.equal(ma.banStamp.costOff, undefined);
  assert.equal(ma.banStamp.playThisTurn, true);

  const rr = P.fxParse(syn(RR_TX)).optCost;
  assert.deepEqual(rr.ops, []);
  assert.equal(rr.banStamp.costOff, 1, "{r} is ONE resource");
  assert.equal(rr.banStamp.pow, undefined);
  assert.equal(rr.banStamp.playThisTurn, true);
});

test("the MAGNITUDE is read off the line, not hardcoded", {skip}, () => {
  /* Both pool cards print 1, so no pool fixture can tell a read number
     from a literal (v3.32, v3.74, v3.77 — the rule has been needed nine
     times). A synthetic printing something else is what sees it. */
  assert.equal(P.fxParse(syn(MA_TX.replace("+1{p}", "+3{p}"))).optCost.banStamp.pow, 3);
  assert.equal(P.fxParse(syn(RR_TX.replace("costs {r} less", "costs {r}{r} less"))).optCost.banStamp.costOff, 2);
  assert.equal(P.fxParse(syn(RR_TX.replace("costs {r} less", "costs 3 less"))).optCost.banStamp.costOff, 3);
});

test("gains / gets / has — every anchor accepts all three", {skip}, () => {
  /* CLAUDE.md has said since v2.12 that FaB prints all three, and v3.10
     records what a missing alternation costs: it does not DROP the rule,
     it RELOCATES it into a loose matcher below, which then returns the
     payload with the wrapper stripped. The pool prints "gets" here; a
     drill's own synthetic printing "gains" is what found the gap. */
  for(const v of ["gains", "gets", "has"]){
    const fx = P.fxParse(syn(MA_TX.replace("it gets", "it " + v)));
    assert.equal(fx.optCost && fx.optCost.banStamp.pow, 1, v + " reads");
  }
});

test("an unreadable rider still refuses the whole clause", {skip}, () => {
  /* v2.29's rule, and the reason `optCost` pairs its two halves in
     `fxParse` at all: half a cost is not a cheap approximation when the
     half that reads is the REWARD. */
  const fx = P.fxParse(syn(MA_TX.replace("it gets +1{p} and you may play it this turn",
                                         "it becomes a lion until end of turn")));
  assert.equal(fx.optCost, undefined);
});

/* ---- 2. AN UNRESOLVED BOUND REFUSES, EVERYWHERE ---------------------- */

test("every OTHER pick site still refuses the dynamic bound", {skip}, () => {
  /* THE PROPERTY THE ORIGINAL REFUSAL WAS PROTECTING. Only the `hits`
     queue site has a chain to resolve the count against; `pickSubject`
     serves every `pick` reader and must leave a subject carrying it
     unclaimed exactly as it did before v3.92. Refusing is weaker than
     printed and visible; admitting it is the sev-3. */
  assert.equal(P.pickSubject("an attack action card with cost less than the number of Draconic chain links you control"), null);
  /* the control: the same reader still answers for a bound it CAN express */
  assert.deepEqual(P.pickSubject("an attack action card with cost 2 or less"), {type: "attack", costLe: 2});
});

test("promptFilter refuses a filter that still carries the flag", {skip}, () => {
  /* AN UNKNOWN KEY THAT FALLS THROUGH ADMITS EVERY CARD — which is
     precisely the failure the refusal replaced. `notSelf` without its uid
     takes the same line, and for the same reason (v3.20). */
  /* `isAttack` reads a PRINTED POWER as well as the type line, so a
     fixture without one is refused by the type test and the control below
     passes by finding nothing — which looks exactly like the filter
     working. Check your own fixture. */
  const cards = [{uid: 1, name: "A", cost: 0, power: 3, ty: ["Action","Attack"], tt: "Generic Action - Attack"},
                 {uid: 2, name: "B", cost: 9, power: 3, ty: ["Action","Attack"], tt: "Generic Action - Attack"}];
  assert.deepEqual(cards.filter(PR.promptFilter({type: "attack", costLtDrac: true})), [],
                   "an unresolved bound admits NOTHING");
  assert.equal(cards.filter(PR.promptFilter({type: "attack", costLe: 0})).length, 1,
               "the control: a resolved bound still filters");
});

/* ---- 3. THE COUNT, AND THE LINK THAT COUNTS ITSELF ------------------- */

const dracLink = () => ({n: "x", kind: "atk", drac: true});
const plainLink = () => ({n: "y", kind: "atk", drac: false});

test("dracLinks counts Draconic ATTACK links and nothing else", {skip}, () => {
  assert.equal(P.dracLinks([]), 0);
  assert.equal(P.dracLinks([dracLink(), plainLink(), dracLink()]), 2);
  assert.equal(P.dracLinks([{n: "z", kind: "non", drac: true}]), 0,
               "a non-attack layer is not a chain LINK of this kind");
  assert.equal(P.dracLinks(null), 0, "a caller that says nothing answers 0");
});

/* ---- 4. DRIVEN — the whole thing, through the real entry point ------- */

/* A REAL SWING that connects, so `linkPayload` runs its own `hits` site.
   Driving `buildPrompt` by hand would measure the SHEET and prove nothing
   about whether anything opens one — v3.20's `condemn.test.js` lesson,
   which is the whole reason that site's absence went unnoticed for
   thirty versions. */
function swing(cardTx, hand, links){
  const atk = syn(cardTx, {name: "SYN-DRAC-SWING-" + (++_n), power: 4});
  const g = H.state({hand: hand.slice(), banish: [], res: 9},
                    {hp: 20}, {turn: 3});
  return H.fx(g, (f, n) => {
    n = {...n, chain: (links || []).slice(),
         pend: {card: atk, total: 4, ops: [], onHit: [], onHitHero: [],
                ga: false, by: 0, lateConds: []}};
    const r = f.linkPayload(n, {total: 4, pumps: 0, heroHit: true});
    return r.game || r;
  });
}

/* THE FIXTURE HAS TO STRADDLE THE BOUNDARY, OR IT CANNOT SEE AN
   OFF-BY-ONE. Written with a cost-0 and a cost-3 attack alone, the
   sabotage "the attack's own link does not count" was SILENT: at one link
   costLe 0 and costLe 1 both admit only the cost-0 card, and at four links
   both admit everything. `Edge Swing` costs exactly 1, which is the one
   cost the two readings disagree about at a chain of one — v3.62's rule,
   read from the fixture's end. */
const hand = () => [
  {uid: 101, name: "Cheap Swing", cost: 0, pitch: 1, power: 3,
   tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
  {uid: 104, name: "Edge Swing", cost: 1, pitch: 1, power: 4,
   tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
  {uid: 102, name: "Dear Swing", cost: 3, pitch: 1, power: 7,
   tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
  {uid: 103, name: "Not An Attack", cost: 0, pitch: 1,
   tt: "Generic Action", ty: ["Generic","Action"], tx: "", kw: [], gkw: []}
];

const sheetOf = g => {
  const q = (g.promptQ || [])[0];
  if(!q) return null;
  const built = PR.buildPrompt(g, q);
  return built ? {spec: q, cards: (built.cards || []).map(c => c.name + "(" + c.cost + ")")} : null;
};

test("driven: the sheet opens on a HIT, and the bound is the live chain",
     {skip}, () => {
  /* THE LINK COUNTS ITSELF. `linkPayload` pushes the attack's own chain
     entry before this trigger resolves, so a Draconic attack that hits
     with an empty chain already controls ONE link — and "cost LESS THAN
     one" is cost 0. That is the printed reading, and it is also what
     makes the card do anything at all on the first swing of a turn. */
  const one = sheetOf(swing(MA_TX, hand(), []));
  assert.ok(one, "a sheet opens");
  assert.deepEqual(one.cards, ["Cheap Swing(0)"],
                   "one link — LESS THAN one is cost 0, so the cost-1 attack is out");

  const two = sheetOf(swing(MA_TX, hand(), [dracLink()]));
  assert.deepEqual(two.cards, ["Cheap Swing(0)", "Edge Swing(1)"],
                   "two links — the cost-1 attack comes in, and only then");

  const four = sheetOf(swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]));
  assert.deepEqual(four.cards, ["Cheap Swing(0)", "Edge Swing(1)", "Dear Swing(3)"],
                   "four links — the cost-3 attack becomes legal");
  assert.equal(four.cards.length, 3, "and the NON-attack never is");
});

test("driven: a fully blocked swing offers nothing", {skip}, () => {
  /* "WHEN THIS HITS" — v3.45's gate, and CR 7.5.5: damage prevented is
     not dealt, so a swing that lands nothing has not hit. */
  const g = H.state({hand: hand(), banish: [], res: 9}, {hp: 20}, {turn: 3});
  const out = H.fx(g, (f, n) => {
    n = {...n, chain: [], pend: {card: syn(MA_TX, {name: "SYN-DRAC-BLOCKED"}),
         total: 0, ops: [], onHit: [], onHitHero: [], ga: false, by: 0, lateConds: []}};
    const r = f.linkPayload(n, {total: 0, pumps: 0, heroHit: false});
    return r.game || r;
  });
  assert.equal((out.promptQ || []).length, 0);
});

test("driven: the bound is re-read per resolution, never cached", {skip}, () => {
  /* THE MEMO HAZARD MADE OBSERVABLE. Two swings of the SAME card at two
     different chain depths must offer two different sets — if the count
     had been stored in the parse, the second would repeat the first. */
  const a = sheetOf(swing(MA_TX, hand(), []));
  const b = sheetOf(swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]));
  assert.notDeepEqual(a.cards, b.cards);
});

/* ---- 5. DRIVEN — the stamp lands on the card that MOVED -------------- */

function answerWith(g, name){
  const spec = (g.promptQ || [])[0];
  assert.ok(spec, "a spec was queued");
  const built = PR.buildPrompt(g, spec);
  assert.ok(built, "and it built a sheet");
  const idx = built.cards.findIndex(c => c.name === name);
  assert.ok(idx >= 0, "the fixture's chosen card is actually offered");
  const n0 = {...g, promptQ: [], prompt: PR.promptToggleSel(built, idx)};
  return H.fx(n0, (f, n) => f.applyAnswer(n, n.prompt));
}

test("driven: Mounting Anger stamps the BANISHED card, not the attacker",
     {skip}, () => {
  const g = swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]);
  const src = g.pend && g.pend.card;
  const out = answerWith(g, "Dear Swing");
  const n = out.game || out;
  const ban = n.sides[0].banish;
  assert.equal(ban.length, 1, "the cost was actually paid");
  assert.equal(ban[0].name, "Dear Swing");
  assert.equal(ban[0]._banPow, 1, "the pump rides on the card that MOVED");
  assert.equal(ban[0]._playTurn, n.turn, "and it may be played this turn");
  assert.equal(n.sides[0].hand.some(c => c.uid === 102), false, "it left the hand");
  /* THE ATTACKER IS UNTOUCHED — the half v2.29 refused the card over. */
  assert.equal(src._banPow, undefined);
  assert.equal(src._arsPow, undefined);
});

test("driven: Rising Resentment's discount reaches effCost, and Mounting Anger's does not",
     {skip}, () => {
  const sd = H.state({res: 0}, {}, {}).sides[0];
  const rr = answerWith(swing(RR_TX, hand(), [dracLink(), dracLink(), dracLink()]), "Dear Swing");
  const rrCard = (rr.game || rr).sides[0].banish[0];
  assert.equal(P.effCost(rrCard, sd), 2, "a printed 3 costs 2");

  const ma = answerWith(swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]), "Dear Swing");
  const maCard = (ma.game || ma).sides[0].banish[0];
  assert.equal(P.effCost(maCard, sd), 3, "Mounting Anger touches the COST of nothing");
});

test("driven: the pump is spent by playing the banished card, and it is +1",
     {skip}, () => {
  /* AND THE OBSERVABLE IS THE ATTACK'S TOTAL, not the stamp read back —
     a stamp nothing spends is the no-op blind spot wearing a number. */
  const ma = answerWith(swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]), "Dear Swing");
  let n = ma.game || ma;
  const got = n.sides[0].banish[0];
  const out = H.execute({...n, pend: null, chain: [], promptQ: [], prompt: null},
                        got, "banish", 0, {});
  const g2 = out.game || out;
  assert.ok(g2.pend, "the banished card was playable");
  assert.equal(g2.pend.total, 8, "printed 7, +1 from the stamp");
});

test("driven: declining the cost fires no rider", {skip}, () => {
  /* THE v2.04 RULE, and there is a drill named after it one file over:
     an optional cost DECLINED must not collect the payload. `min:0` is
     what makes "Choose none" a legal answer at all. */
  const g = swing(MA_TX, hand(), [dracLink(), dracLink(), dracLink()]);
  const spec = g.promptQ[0];
  assert.equal(spec.min, 0, "it is optional — 'you MAY banish'");
  const built = PR.buildPrompt(g, spec);
  const out = H.fx({...g, promptQ: [], prompt: PR.promptDecline(built)},
                   (f, n) => f.applyAnswer(n, n.prompt));
  const n = out.game || out;
  assert.equal((n.sides[0].banish || []).length, 0, "nothing was banished");
  assert.equal(n.sides[0].hand.length, 4, "and nothing left the hand");
});

test("driven: an empty hand skips the sheet rather than showing an empty one",
     {skip}, () => {
  /* `buildPrompt` returns null when a spec has nothing to ask, and the
     prompt politely skips itself — a cost you cannot pay is not a tap
     that teaches anything. */
  const g = swing(MA_TX, [hand()[3]], [dracLink(), dracLink()]);
  assert.equal((g.promptQ || []).length, 1, "the spec is still queued");
  assert.equal(PR.buildPrompt(g, g.promptQ[0]), null, "and it builds nothing");
});

/* ---- 6. THE REAL RECORDS, IN THE DECK THAT HOLDS THEM ---------------- */

test("both real records parse — and both are FAI's", {skip}, () => {
  /* A SYNTHETIC FIXTURE PROVES A READER; ONLY THE REAL CARD PROVES THE
     CARD (v3.42). And the closing detail: `parser.dracLinks` was built at
     v3.86 for Fai's own hero discount, and Fai is the hero who decks both
     of these — the reader that discharged the refusal was already sitting
     in the same deck box. */
  const W = require("./helpers/extract.js").loadData();
  const list = require("../engine/game.js").parseDeck(W.DECKS.fai).deck;
  for(const nm of ["Mounting Anger", "Rising Resentment"]){
    const e = list.find(x => x.name === nm);
    assert.ok(e, nm + " is in Fai's list");
    const c = H.card(nm, e.p);
    const fx = P.fxParse(c);
    assert.ok(fx.optCost, nm + ": claimed");
    assert.equal(fx.optCost.trigger, "hits");
    assert.equal(fx.optCost.filter.costLtDrac, true);
    assert.equal(fx.optCost.filter.costLe, undefined);
    assert.equal(fx.optCost.banStamp.playThisTurn, true);
  }
  assert.equal(P.fxParse(H.card("Mounting Anger", 1)).optCost.banStamp.pow, 1);
  assert.equal(P.fxParse(H.card("Rising Resentment", 1)).optCost.banStamp.costOff, 1);
});

test("driven: the REAL Mounting Anger opens the sheet against a live chain",
     {skip}, () => {
  const real = H.card("Mounting Anger", 1);
  const g = H.state({hand: hand(), banish: [], res: 9}, {hp: 20}, {turn: 3});
  const out = H.fx(g, (f, n) => {
    n = {...n, chain: [dracLink(), dracLink(), dracLink()],
         pend: {card: real, total: 4, ops: [], onHit: [], onHitHero: [],
                ga: false, by: 0, lateConds: []}};
    const r = f.linkPayload(n, {total: 4, pumps: 0, heroHit: true});
    return r.game || r;
  });
  const sheet = sheetOf(out);
  assert.ok(sheet, "the real card opens a real sheet");
  assert.deepEqual(sheet.cards, ["Cheap Swing(0)", "Edge Swing(1)", "Dear Swing(3)"]);
  /* AND ITS OWN LINK IS ON THE CHAIN — the fourth, and it is Draconic. */
  assert.equal(P.dracLinks(out.chain), 4);
});

test("the printed Go again is untouched by any of this", {skip}, () => {
  /* Both cards print `**Go again**` on a line of its own, which is what
     `printedKw` exists to tell apart from a granted one (v2.84). A rider
     reader that swallowed the keyword line would cost the card an action
     point on every swing — the most valuable keyword in the game to get
     wrong. */
  for(const nm of ["Mounting Anger", "Rising Resentment"])
    assert.equal(P.printedKw(H.card(nm, 1), "go again"), true, nm);
});
