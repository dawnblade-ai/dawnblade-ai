/* test/vanguard.test.js — A GRANT WHOSE MULTIPLIER COUNTS ITS OWN COST (v4.56)
 *
 * > "Boltyn Specialization
 * >  As an additional cost to play this, you may charge your soul ANY NUMBER
 * >  OF TIMES.
 * >  Your attacks this combat chain get +1{p} for each Light card charged
 * >  this way."
 * >   — V OF THE VANGUARD, the pool's ninth FOR-EACH record
 *
 * `tools/approx.js` carried this as `charged-this-way-count` and named TWO
 * missing halves. **One of them was wrong, in the half it was most confident
 * about** — it said the subject "lands nowhere near `perBoost`'s site" so
 * v4.48's anchor "is right to refuse it", naming a missing MECHANISM.
 *
 * MEASURED, the standing grant has had a reader since **v3.87** — whose own
 * comment block names THIS CARD as one of its two examples — and what refused
 * was the printed WORD ORDER: that anchor wanted the window at the END of the
 * clause and the database prints it right after the SUBJECT here. v3.36's rule
 * verbatim (the database prints both spellings at once), and v4.48's dead
 * `perBoost` one reader over: a comment naming a card the anchor cannot reach.
 *
 * THE COUNT HALF WAS REAL. `fx.chargeCost.multi` has read the printed "any
 * number of times" since charge was built with NOTHING consuming it, so the
 * pool's one multi record was offered a single charge — WEAKER than printed,
 * which the one-sided sweep is built not to look in.
 *
 * AND THE BUILD'S OWN FIRST DRAFT HAD v4.09's DEFECT. The charge trace is
 * per-resolution and an ATTACK's ops ride to RESOLUTION, so a defence reaction
 * in the window reassigned it and the grant announced "grants nothing".
 * Driven below — that is the drill this file exists for most.
 */
const test = require("node:test");
const assert = require("node:assert");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");

const gate = t => H.hasDb() ? t : { skip: true };

const ent = (maps, nm, p, uid) =>
  ({...C.resolveEntry(maps, {name: nm, p, code: null, q: 1}), uid});

/* ---- 1. THE PARSE: the window's other printed position ---------------- */

test("the standing grant reads the window in EITHER printed position", () => {
  const probe = tx => {
    P.fxReset();
    return (P.fxParse({name: "ZZvw" + tx.length + Math.random(), tx,
                       tt: "Generic Action", ty: ["Generic", "Action"],
                       pitch: 1, cost: 0}).ops || [])
      .find(o => o[0] === "atkBuff") || null;
  };
  /* NIGHT'S EMBRACE puts it at the END; V OF THE VANGUARD puts it right
     after the SUBJECT. v3.87's anchor knew one of the two. */
  assert.deepEqual(probe("Your attacks with stealth get +1{p} this turn."),
    ["atkBuff", 1, {kw: "stealth"}, "turn"], "the END form, unchanged");
  assert.deepEqual(probe("Your attacks this combat chain get +2{p}."),
    ["atkBuff", 2, null, "chain"], "and the MID form, which read nothing before v4.56");
  /* THE PROOF IT WAS THE POSITION AND NOTHING ELSE: one clause, one word
     moved, two answers. */
  assert.deepEqual(probe("Your attacks get +2{p} this combat chain."),
    ["atkBuff", 2, null, "chain"], "same clause, window at the end");

  /* NEVER BOTH — a clause naming its window twice is one nobody measured. */
  assert.equal(probe("Your attacks this turn get +2{p} this turn."), null,
    "two windows refuses rather than picking a side");

  /* AND THE PLURAL IS WHAT KEEPS `buffQ`'s SINGLE-SHOT FAMILY OUT. Accepting
     either position made the old optional `s` live: measured, 31 records
     across ten cards would have become standing grants — v3.87's own
     distinction inverted, in the direction that steals games. */
  assert.equal(probe("Your next arrow attack this turn gets +3{p}."), null,
    "the singular single-shot grant stays buffQ's");
  assert.equal(probe("Your next attack this turn gets +5{p}."), null,
    "and so does the unqualified one");
});

test("an unreadable countable refuses the whole clause (v4.48, v2.29)", () => {
  const probe = tx => {
    P.fxReset();
    const fx = P.fxParse({name: "ZZvc" + Math.random(), tx, tt: "Generic Action",
                          ty: ["Generic", "Action"], pitch: 1, cost: 0});
    return {op: (fx.ops || []).find(o => o[0] === "atkBuff") || null,
            st: (fx.clauses || [])[0] && fx.clauses[0].st};
  };
  /* FALLING THROUGH IS THE BUG, not caution: read as a flat +N it is wrong
     in BOTH directions at once — a point the card does not grant at a count
     of 0, and less than printed at 2 or more. */
  const bad = probe("Your attacks this turn get +2{p} for each goat you control.");
  assert.equal(bad.op, null, "an unknown countable takes the clause with it");
  assert.equal(bad.st, "skip", "and the card reports it unread");
  /* THE POSITIVE CONTROL, or a reader that refuses everything passes the
     line above perfectly (v3.98). */
  const ok = probe("Your attacks this turn get +2{p} for each Light card charged this way.");
  assert.deepEqual(ok.op, ["atkBuff", 2, null, "turn", "perChargedLight"],
    "a countable the table names reads in full");
  assert.equal(ok.st, "run", "and the clause is marked read");
});

test(gate("V of the Vanguard reads in full, off the REAL record"), () => {
  const maps = H.db();
  P.fxReset();
  const c = C.resolveEntry(maps, {name: "V of the Vanguard", p: 2, code: null, q: 1});
  const fx = P.fxParse(c);
  assert.equal(fx.tier, "full", "the pool's ninth for-each record");
  assert.deepEqual((fx.ops || []).find(o => o[0] === "atkBuff"),
    ["atkBuff", 1, null, "chain", "perChargedLight"],
    "one printed pip, no qualifier, the printed window, and the countable");
  assert.deepEqual(fx.chargeCost, {multi: true}, "and its charge cost reads `multi`");
});

/* ---- 2. THE COUNTABLE, DRIVEN ---------------------------------------- */

test("the countable counts LIGHT cards off the structured array", () => {
  const mk = (nm, pitch, ty) => ({name: nm, pitch, ty});
  const L = mk("L", 2, ["Light", "Warrior", "Action"]);
  const G = mk("G", 1, ["Generic", "Action"]);
  assert.equal(E.powPer({_chgWay: [L, L, G]}, "perChargedLight"), 2,
    "two Light cards, and the Generic one does not count");
  assert.equal(E.powPer({_chgWay: [G, G]}, "perChargedLight"), 0,
    "no Light card is zero, not a flat 1 (v4.48)");
  assert.equal(E.powPer({_chgWay: []}, "perChargedLight"), 0, "nothing charged is zero");
  assert.equal(E.powPer({}, "perChargedLight"), 0,
    "and no record at all is zero rather than a throw — reduce is fed JSON off a wire");
  /* OFF `ty`, NEVER `tt` (v2.39, v2.44): the printed line carries stray words
     on five database records, and a substring scan claims a class that merely
     CONTAINS the word. */
  assert.equal(E.powPer({_chgWay: [{name: "x", pitch: 1, tt: "Light Warrior Action", ty: []}]},
    "perChargedLight"), 0, "the type TEXT is not the authority");
  assert.equal(E.powPer({_chgWay: [mk("x", 1, ["Lightning", "Wizard"])]},
    "perChargedLight"), 0, "and \"Lightning\" is not \"Light\" (v4.25's fallback trap)");
});

/* ---- 3. THE MULTI CHARGE, DRIVEN END TO END -------------------------- */

const seat = (maps, extra) => {
  P.fxReset();
  const atk = ent(maps, "V of the Vanguard", 2, 1);
  const l1  = ent(maps, "Bolt of Courage", 1, 2);
  const l2  = ent(maps, "Take Flight", 1, 3);
  const gen = ent(maps, "Brutal Assault", 1, 4);
  let g = H.state({name: "Boltyn", res: 9, ap: 3, hand: [atk, l1, l2, gen]},
                  Object.assign({name: "Them", res: 9}, extra || {}),
                  {turn: 3, actor: 0, turnPlayer: 0, seed: "vov"});
  return {g: {...g, phase: "action", step: "layer", priority: 0, passed: []}, atk};
};

/* Declare V of the Vanguard and answer the charge offers with `picks`
   (a uid, or null to decline). Returns every offer it was shown. */
const declare = (g, picks) => {
  let out = J.reduce(g, {t: "play", uid: 1, from: "hand"}, 0);
  assert.ok(!out.error, "the play was refused: " + out.error);
  let s = out.state;
  const offers = [];
  let guard = 0;
  while(s.pending && s.pending.kind === "charge"){
    assert.ok(guard++ < 12, "the charge offer never terminated");
    offers.push({uids: [...s.pending.uids], picked: [...(s.pending.picked || [])],
                 multi: s.pending.multi});
    const nx = picks.shift();
    out = J.reduce(s, nx == null ? {t: "charge"} : {t: "charge", uid: nx}, 0);
    assert.ok(!out.error, "the charge answer was refused: " + out.error);
    s = out.state;
    assert.deepEqual(INV.errors(s), [], "the board stayed legal mid-charge");
  }
  return {s, offers};
};

test(gate("DRIVEN: the offer RE-OPENS, shrinks, and a decline ends it"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  /* charge both Light cards, then decline */
  const {s, offers} = declare(g, [2, 3, null]);
  assert.equal(offers.length, 3, "asked three times — twice taken, once declined");
  /* THE OFFER SHRINKS RATHER THAN THE HAND, because a charge is settled in
     `execute` long after the last answer: nothing has LEFT the hand while
     the offer is re-made, so a re-offer asking the hand alone would offer
     the same card again and one uid charged twice counts two. */
  assert.deepEqual(offers.map(o => o.uids), [[2, 3, 4], [3, 4], [4]],
    "each answered card is off the next offer");
  assert.deepEqual(offers.map(o => o.picked), [[], [2], [2, 3]],
    "and what is already chosen rides on the pending");
  assert.deepEqual(offers.map(o => o.multi), [true, true, true],
    "the printed `any number of times` is carried every round");
  /* THE STATE: two cards to the soul, hand short by them, counted twice. */
  assert.deepEqual(s.sides[0].soul.map(c => c.name).sort(),
    ["Bolt of Courage", "Take Flight"], "both charged cards reached the soul");
  assert.deepEqual(s.sides[0].hand.map(c => c.name), ["Brutal Assault"],
    "and left the hand");
  assert.equal(s.sides[0].hist.charged, 2, "hist.charged counts each one");
  assert.deepEqual(INV.errors(s), [], "the board is legal");
});

test(gate("DRIVEN: a decline on the FIRST offer charges nothing"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  const {s, offers} = declare(g, [null]);
  assert.equal(offers.length, 1, "asked once and not again — a decline ENDS the charging");
  assert.equal(s.sides[0].soul.length, 0, "nothing reached the soul");
  assert.equal(s.sides[0].hand.length, 3, "and the hand is intact");
  assert.ok(!s.sides[0].hist.charged, "hist.charged never fired");
  /* THE GRANT COUNTS ZERO AND SAYS SO. v4.48's whole finding is that the old
     readers granted a flat +1 at a count of 0 — a point the card does not
     print — so an entry here would be that bug wearing an entry. In a
     training sim the feed is the lesson (v3.60): a player who declined has
     to be told that is why the pump did not arrive. */
  assert.deepEqual(s.sides[0].atkBuff, [], "no grant is pushed at a count of zero");
});

test(gate("DRIVEN: the offer runs dry rather than looping"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  /* charge ALL THREE — the fourth offer has no candidate, so it never opens
     and the answer still rides out (the run-dry exit, not the decline one). */
  const {s, offers} = declare(g, [2, 3, 4]);
  assert.equal(offers.length, 3, "three offers for three cards, then nothing left to ask");
  assert.equal(s.sides[0].hand.length, 0, "the hand emptied into the soul");
  assert.equal(s.sides[0].soul.length, 3, "and every answer was honoured");
  assert.equal(s.sides[0].hist.charged, 3);
});

/* ---- 4. THE GRANT, AT RESOLUTION ------------------------------------- */

/* Pass to the RESOLUTION step and STOP THERE — the chain is still open, which
   is exactly what "this combat chain" means. Driven one pass further the
   chain CLOSES and `closeChainGrants` correctly expires the grant, so a loop
   that runs to `!pend` reads an empty `atkBuff` and reports the feature
   missing: a fixture driven past the moment it measures (v4.41's Boltyn
   scene, v3.85's policy-consumed resource). Traced: the grant is live from
   the DAMAGE step onward and gone one pass after RESOLUTION.

   `seat1Uid` optionally plays seat 1's card in the reaction window first —
   which is the whole point of the gap drill below. */
const resolve = (s0, seat1Uid) => {
  let s = s0, guard = 0, played = false;
  while(s.pend && s.step !== "resolution" && guard++ < 60){
    if(seat1Uid != null && !played && s.step === "reaction"){
      const r = J.reduce(s, {t: "play", uid: seat1Uid, from: "hand"}, 1);
      if(!r.error){ s = r.state; played = true; continue; }
    }
    const who = s.priority;
    if(who == null) break;
    const r = J.reduce(s, {t: "pass"}, who);
    if(r.error) break;
    s = r.state;
  }
  assert.equal(s.step, "resolution",
    "the drive never reached the resolution step — re-anchor this helper");
  return {s, played};
};

const grantLine = s => (s.feed || [])
  .filter(l => /every attack gets|grants nothing/.test(l));

test(gate("DRIVEN: the multiplier is the COUNT, not a flat pip"), () => {
  const maps = H.db();
  /* TWO Light cards charged -> +2. The pair either side of a count of 1 is
     what tells a multiplier from a flat +N (v3.92, v4.48): at exactly 1 the
     two readings agree, so ONE row proves nothing. */
  for(const [picks, want] of [[[2, null], 1], [[2, 3, null], 2], [[4, null], 0]]){
    const {g} = seat(maps);
    const {s} = declare(g, picks.slice());
    const out = resolve(s).s;
    if(want === 0){
      assert.deepEqual(out.sides[0].atkBuff, [],
        "the NON-Light charge grants nothing — the class is read, not counted");
      assert.match(grantLine(out).join("\n"), /grants nothing/,
        "and the feed says why (v3.60)");
    } else {
      assert.deepEqual(out.sides[0].atkBuff.map(b => b.amt), [want],
        "one printed pip times " + want + " Light cards charged");
      assert.deepEqual(out.sides[0].atkBuff.map(b => b.until), ["chain"],
        "with the printed window");
      assert.match(grantLine(out).join("\n"), new RegExp("\\+" + want + "\\{p\\}"),
        "and the feed names the resolved number");
    }
    assert.deepEqual(INV.errors(out), [], "the board is legal");
  }
});

test(gate("DRIVEN: a card played in the REACTION WINDOW does not wipe the count"), () => {
  /* THE DEFECT THIS FILE EXISTS FOR MOST, and it was this version's own
     first draft (v4.09: check where the state you write is CLEARED).
     `_chgWay` is a per-resolution trace and an ATTACK's ops ride to
     RESOLUTION — so anything played in between reassigns it. Driven before
     the fix: the count went 2 -> 0 and the grant announced "grants nothing".
     The record rides on `pend` now, which is what `fused` and the charge
     colours already do for exactly this reason. */
  const maps = H.db();
  const dr = ent(maps, "Sigil of Suffering", 1, 20);
  assert.match(dr.tt || "", /Defense Reaction/,
    "the fixture must be playable in the reaction window");
  const {g} = seat(maps, {hand: [dr]});
  const {s} = declare(g, [2, 3, null]);
  const {s: out, played} = resolve(s, 20);
  assert.ok(played, "seat 1 really did play into the window — or this drill proves nothing");
  assert.deepEqual(out.sides[0].atkBuff.map(b => b.amt), [2],
    "the count survived the gap: two Light cards charged, +2 granted");
  assert.deepEqual(INV.errors(out), [], "the board is legal");
});

test(gate("DRIVEN: the grant expires with the printed window, not the turn"), () => {
  const maps = H.db();
  const {g} = seat(maps);
  const {s} = declare(g, [2, 3, null]);
  const out = resolve(s).s;
  assert.equal(out.sides[0].atkBuff.length, 1, "granted, with the chain still open");
  /* "THIS COMBAT CHAIN" expires at the CLOSE step through the shared
     `closeChainGrants`, never in the end phase — sweeping both in the end
     phase makes a chain grant last a whole turn (v3.87). DRIVEN through the
     real close rather than by calling that body, because the question is
     whether the turn structure reaches it. */
  let s2 = out, guard = 0;
  while(s2.pend && guard++ < 10){
    const who = s2.priority;
    if(who == null) break;
    const r = J.reduce(s2, {t: "pass"}, who);
    if(r.error) break;
    s2 = r.state;
  }
  assert.ok(!s2.pend && !s2.chainOpen, "the chain closed");
  assert.deepEqual(s2.sides[0].atkBuff, [],
    "and the close took it, because the card prints `this combat chain`");
});

/* ---- 5. THE RE-DERIVATION, AND A UID OFF A WIRE ---------------------- */

test(gate("`execute` re-derives every answered uid against the hand"), () => {
  const maps = H.db();
  const {g, atk} = seat(maps);
  const base = J.reduce(g, {t: "play", uid: 1, from: "hand"}, 0).state;
  const drive = uids => J.withEffects({...base, pending: null, _chargeUids: uids, actor: 0},
    (fx, s) => fx.execute(s, atk, "hand", 0, {}));
  /* A uid nothing holds charges nothing, and the SOURCE's own uid can never
     pay its own cost — `execute` removed it three hundred lines up. */
  assert.equal(drive(["nope"]).sides[0].soul.length, 0, "a forged uid charges nothing");
  assert.equal(drive([1]).sides[0].soul.length, 0, "and neither does the card being played");
  /* THE SAME UID TWICE MOVES ONE CARD. "Any number of times" makes the
     answer a list, so a duplicate off a wire is a shape the list can now
     express — and the `find` is what makes it harmless: the first pass
     removes the card and the second finds nothing. Without that the soul
     holds one card and `hist.charged` reads two. */
  const dbl = drive([2, 2]);
  assert.equal(dbl.sides[0].soul.length, 1, "one card, however many times it is named");
  assert.equal(dbl.sides[0].hist.charged, 1, "and it is counted once");
  assert.deepEqual(INV.errors(dbl), [], "the board is legal");
});

test(gate("the pending is a `charge` kind the table can answer"), () => {
  /* v3.35's census: a kind demuxed and never rendered is a screen with no
     exit. The kind is unchanged by v4.56 — what moved is the FIELDS on it —
     so this pins that the repeated offer did not invent a sixth kind. */
  const maps = H.db();
  const {g} = seat(maps);
  const s = J.reduce(g, {t: "play", uid: 1, from: "hand"}, 0).state;
  assert.equal(s.pending.kind, "charge");
  assert.ok(J.PENDING_KINDS.indexOf("charge") >= 0, "and it is in the census");
  /* WHILE IT IS OPEN THE GAME IS FROZEN for both seats bar the answer. */
  assert.match(String(J.legal(s, {t: "pass"}, 0) || ""), /answer the charge/,
    "the offer must be answered first");
  assert.equal(J.legal(s, {t: "charge", uid: 2}, 0), null, "and the answer is legal");
  assert.equal(J.legal(s, {t: "charge", uid: null}, 0), null,
    "as is the decline, always");
});
