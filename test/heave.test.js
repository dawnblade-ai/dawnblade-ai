/* ============================================================
   HEAVE, AND THE QUALIFIED COST REDUCTION (v3.32)

   Thunder Quake's whole rules text is "**Heave 3**". The database prints
   no reminder text for the keyword; the CARD does, and the printed
   product is the oracle:

     Heave 3 (At the beginning of your end phase, if Thunder Quake is in
     your hand and you have an empty arsenal zone, you may pay {r}{r}{r}
     and put Thunder Quake FACE UP into your arsenal. If you do, create 3
     Seismic Surge tokens.)

   That is more precise than the ruling recorded 2026-07-25, which had
   heave REPLACING the arsenal action rather than performing one, and knew
   nothing of the empty-arsenal gate or the face-up put.

   SEISMIC SURGE IS BRAVO'S KEYSTONE — four of his cards create it and a
   fifth reads it — and it was `tier: none` on purpose: `selfDestruct …
   then X` refuses when X has no reader, precisely so a schedule could not
   be filed `full` with its payout missing. Its payout is the third
   qualified single-shot grant, beside `buffQ` and `gaNextQ`.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* ---- 1. THE KEYWORD ------------------------------------------------- */

test("heaveOf reads the printed keyword and its number", {skip}, () => {
  H.db();
  assert.deepEqual(P.heaveOf(H.card("Thunder Quake", 1)), {n: 3});
  assert.equal(P.heaveOf(H.card("Raging Onslaught", 1)), null, "a vanilla attack has none");
  /* THE NUMBER IS THE KEYWORD'S PARAMETER, not a literal 3. A second heave
     card at a different value must work without a code change. */
  assert.deepEqual(P.heaveOf({kw: ["Heave 2"], tx: "**Heave 2**"}), {n: 2});
  assert.deepEqual(P.heaveOf({kw: [], tx: "Heave 5"}), {n: 5}, "…from the text line too");
  assert.equal(P.heaveOf({kw: ["Heave"], tx: "Heave"}), null, "an unparameterised keyword is not read");
});

/* ---- 2. THE GATE ---------------------------------------------------- */

const withTQ = (o) => {
  const tq = {...H.card("Thunder Quake", 1), uid: "tq1"};
  return H.state(Object.assign({hand: [tq], res: 3, ap: 0}, o || {}), {}, {turn: 3, actor: 0});
};

test("heaveOffer needs the card in HAND, an EMPTY arsenal and the resources", {skip}, () => {
  H.db();
  const ok = E.heaveOffer(withTQ(), 0);
  assert.ok(ok, "the control must actually be offered, or every refusal below proves nothing");
  assert.equal(ok.n, 3);
  assert.equal(ok.uid, "tq1");

  assert.equal(E.heaveOffer(withTQ({res: 2}), 0), null, "2 resources is not 3");
  assert.equal(E.heaveOffer(withTQ({arsenal: {name: "Something", uid: "z"}}), 0), null,
    "the printed gate is an EMPTY arsenal zone");
  assert.equal(E.heaveOffer(withTQ({hand: []}), 0), null, "and it must be in hand");
});

test("the gate is arsEmpty, not arsFree — they only coincide at capacity 1", {skip}, () => {
  H.db();
  /* v2.34 drew this distinction for the arsenal PUT and it is the same
     one: "you have an empty arsenal zone" is zero cards, while "you may
     put a card into your arsenal" is a free slot. A second slot makes
     them different answers, and reading the wrong one stays invisible
     until then. */
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = src.indexOf("function heaveOffer");
  const body = src.slice(i, src.indexOf("function heave(", i));
  assert.match(body, /arsEmpty/, "the printed words are 'an empty arsenal zone'");
  assert.ok(!/arsFree/.test(body), "arsFree is the other question");
});

/* ---- 3. WHAT IT DOES ------------------------------------------------ */

test("heave pays, puts the card FACE UP, and mints its printed number", {skip}, () => {
  H.db();
  const r = E.heave(withTQ({res: 5}), 0, "tq1");
  const sd = r.game.sides[0];
  assert.equal(sd.res, 2, "5 - 3");
  assert.equal(sd.hand.length, 0, "it leaves the hand");
  assert.equal(sd.arsenal.name, "Thunder Quake");
  /* FACE UP IS A DIFFERENT EVENT from the ordinary face-down set (v2.33),
     and these are the stamps that machinery already reads. */
  assert.equal(sd.arsenal._faceUp, true);
  assert.equal(sd.arsenal._upTurn, 3, "'this turn' has to mean this turn");
  assert.deepEqual(r.ops, [["token", "Seismic Surge", 3, "self"]]);
});

test("the mint count is the KEYWORD'S number, not a literal 3", {skip}, () => {
  H.db();
  /* Thunder Quake is the pool's only heave card and prints 3, so every
     number in this path could be hardcoded and no pool fixture would
     notice. A synthetic Heave 2 is the only thing that can tell them
     apart — the same reason the crush threshold is drilled at 6. */
  const two = {...H.card("Thunder Quake", 1), uid: "tq2",
               name: "Heave Two Test", kw: ["Heave 2"], tx: "**Heave 2**"};
  const g = H.state({hand: [two], res: 5, ap: 0}, {}, {turn: 3, actor: 0});
  const off = E.heaveOffer(g, 0);
  assert.equal(off.n, 2, "the offer costs 2");
  const r = E.heave(g, 0, "tq2");
  assert.equal(r.game.sides[0].res, 3, "5 - 2, not 5 - 3");
  assert.deepEqual(r.ops, [["token", "Seismic Surge", 2, "self"]], "and it mints TWO");
});

test("heave refuses when the offer is not there, and changes nothing", {skip}, () => {
  H.db();
  const poor = withTQ({res: 2});
  const r = E.heave(poor, 0, "tq1");
  assert.equal(r.game, poor, "the same object — nothing was cloned or written");
  assert.deepEqual(r.ops, []);
  assert.deepEqual(r.msgs, []);
});

/* ---- 4. SEISMIC SURGE RESOLVES WHOLE -------------------------------- */

test("Seismic Surge reads its schedule AND its payout", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Seismic Surge", 0));
  assert.equal(fx.tier, "full", "it was `none` on purpose until its payout had a reader");
  assert.deepEqual(fx.ops, [["selfDestruct", "turn"],
    ["costOff", 1, {aac: true, g: [["guardian"]]}]],
    "the destroy, then the payout, in PRINTED order — that order is what keeps "
    + "an on-play static out of a departing card's payout (v3.07)");
  assert.equal(fx.perm, "aura", "it is an Aura, so it counts for 'auras you control'");
});

test("the discount's AMOUNT is read off the printed pips, not assumed", () => {
  /* Seismic Surge prints a single {r}, so the pool cannot tell a read
     amount from a hardcoded 1. These synthetics can. */
  const q = t => P.classifyClause(t).ops[0];
  assert.deepEqual(q("Your next attack this turn costs {r} less to play"), ["costOff", 1, null]);
  assert.deepEqual(q("Your next attack this turn costs {r}{r} less to play"), ["costOff", 2, null]);
  assert.deepEqual(q("Your next attack this turn costs 3 less to play"), ["costOff", 3, null]);
  /* AND AN UNREADABLE QUALIFIER STILL REFUSES THE WHOLE CLAUSE (v3.31). */
  assert.equal(P.classifyClause("Your next attack with a nonsense qualifier costs {r} less to play"), null);
});

test("driven: the token crumbles at the top of the turn and pays out", {skip}, () => {
  H.db();
  const tok = H.card("Seismic Surge", 0);
  const g = H.state({res: 9, ap: 1, board: [
    {card: {...tok, uid: "ss1"}, kind: "token", spent: false, uid: "ss1", sd: "turn"}
  ]}, {}, {turn: 4, actor: 0});
  const sw = E.sweepArena(g, 0, "turn");
  assert.deepEqual(sw.fired, ["Seismic Surge"]);
  const n = H.runOps(sw.game, sw.ops, "Seismic Surge");
  assert.equal(n.sides[0].board.length, 0, "the token is gone — it does not sit there forever");
  assert.deepEqual(n.sides[0].costOff, [{amt: 1, q: {aac: true, g: [["guardian"]]}}]);
});

/* ---- 5. THE DISCOUNT IS QUALIFIED, AND IT IS ONE CARD PER GRANT ------ */

const withGrants = (k) => {
  let g = H.state({res: 9, ap: 1}, {}, {turn: 4, actor: 0});
  g.builds = [{}, {}];
  const ops = [];
  for(let i = 0; i < k; i++) ops.push(["costOff", 1, {aac: true, g: [["guardian"]]}]);
  return H.runOps(g, ops, "Seismic Surge");
};

test("the discount reads the printed qualifier — Guardian attack action cards only", {skip}, () => {
  H.db();
  const sd = withGrants(1).sides[0];
  const tq = H.card("Thunder Quake", 1);            /* Guardian Action - Attack, cost 6 */
  const ro = H.card("Raging Onslaught", 1);         /* Generic Action - Attack, cost 3 */
  assert.equal(tq.cost, 6, "fixture");
  assert.equal(P.effCost(tq, sd), 5, "Guardian: 6 - 1");
  assert.equal(P.effCost(ro, sd), ro.cost, "Generic: the printed cost, untouched");
});

test("'your NEXT' is one card per grant — two tokens are not {r}{r} off one", {skip}, () => {
  H.db();
  const sd = withGrants(2).sides[0];
  assert.equal(sd.costOff.length, 2, "two grants are waiting");
  assert.equal(P.effCost(H.card("Thunder Quake", 1), sd), 5,
    "6 - 1, not 6 - 2: the printed line says 'your next', so each grant is its own card");
});

test("effCost is PURE — reading it twice does not spend the grant", {skip}, () => {
  H.db();
  /* `effCost` is read twice and only one of those reads takes resources
     (v2.80): `execute` charges, and the caller asks whether the seat can
     AFFORD it. A reader that consumed here would discount the check and
     then charge full price, or the reverse. */
  const sd = withGrants(1).sides[0];
  const c = H.card("Thunder Quake", 1);
  assert.equal(P.effCost(c, sd), 5);
  assert.equal(P.effCost(c, sd), 5, "same answer");
  assert.equal(sd.costOff.length, 1, "and the grant is untouched");
});

test("driven: playing the card spends exactly one grant, at the CHARGE", {skip}, () => {
  H.db();
  const g = withGrants(2);
  const out = H.execute(g, {...H.card("Thunder Quake", 1), uid: "x1"}, "hand", 0, {});
  assert.equal(out.sides[0].res, 4, "9 - 5, the discounted cost");
  assert.equal(out.sides[0].costOff.length, 1, "one spent, one still waiting");
});

test("a grant the card does not match is NOT spent — it waits", {skip}, () => {
  H.db();
  const g = withGrants(1);
  const out = H.execute(g, {...H.card("Raging Onslaught", 1), uid: "x1"}, "hand", 0, {});
  assert.equal(out.sides[0].res, 9 - H.card("Raging Onslaught", 1).cost, "full price");
  assert.equal(out.sides[0].costOff.length, 1,
    "spending it on a card the printed line does not name both grants what the text "
    + "forbids and destroys what it promised (v2.30's rule for buffQ)");
});

test("the offer can NAME a card — a second heave in hand is reachable", {skip}, () => {
  H.db();
  /* Thunder Quake is the pool's only heave printing, so "the first
     eligible card in hand" is the whole answer today and would stay
     silently wrong forever. A card the player cannot choose is the same
     defect as a dead button. */
  const a = {...H.card("Thunder Quake", 1), uid: "t1"};
  const b = {...H.card("Thunder Quake", 1), uid: "t2",
             name: "Second Quake", kw: ["Heave 2"], tx: "**Heave 2**"};
  const g = H.state({hand: [a, b], res: 9, ap: 0}, {}, {turn: 3, actor: 0});
  assert.equal(E.heaveOffer(g, 0).uid, "t1", "unnamed: the first eligible");
  assert.equal(E.heaveOffer(g, 0, "t2").n, 2, "named: the second, at ITS number");
  const r = E.heave(g, 0, "t2");
  assert.equal(r.game.sides[0].arsenal.name, "Second Quake");
  assert.equal(r.game.sides[0].res, 7, "9 - 2");
  assert.equal(r.game.sides[0].hand.length, 1, "and the other stays in hand");
});

/* ---- 6. BOTH BOARDS OFFER IT, OUT OF THE ONE BODY -------------------- */

test("driven: judge offers heave at the arsenal step and resolves it", {skip}, () => {
  H.db();
  let g = withTQ({res: 3});
  g = {...g, phase: "end", arsenalFor: 0, turnPlayer: 0, priority: null,
       passed: [], firstPlayer: 0, round: 1, over: null};
  assert.equal(J.legal(g, {t: "arsenal", heave: true}, 0), null, "legal at the arsenal step");

  const sd = J.reduce(g, {t: "arsenal", heave: true}, 0).state.sides[0];
  assert.equal(sd.res, 0, "3 paid");
  assert.equal(sd.arsenal.name, "Thunder Quake");
  assert.equal(sd.arsenal._faceUp, true);
  assert.equal(sd.board.filter(b => b.card.name === "Seismic Surge").length, 3,
    "three tokens, and each carries its own printed clock");
  assert.ok(sd.board.every(b => b.card.name !== "Seismic Surge" || b.sd === "turn"),
    "a token minted without its clock sits on the board forever (v3.07)");
});

test("judge refuses heave where the printed gate is not met", {skip}, () => {
  H.db();
  const stand = o => ({...withTQ(o), phase: "end", arsenalFor: 0, turnPlayer: 0,
                       priority: null, passed: [], firstPlayer: 0, round: 1, over: null});
  assert.match(String(J.legal(stand({res: 2}), {t: "arsenal", heave: true}, 0)),
    /nothing in hand can be heaved/, "refused BY NAME rather than dead-tapping");
  assert.match(String(J.legal(stand({hand: []}), {t: "arsenal", heave: true}, 0)),
    /nothing in hand can be heaved/);
  /* AND NOT OUTSIDE THE STEP AT ALL. */
  const acting = {...withTQ(), phase: "action", step: "layer", priority: 0, arsenalFor: null};
  assert.match(String(J.legal(acting, {t: "arsenal", heave: true}, 0)), /not your arsenal step/);

  /* THE ACTION NAMES A CARD, AND JUDGE MUST PASS THE NAME THROUGH. A
     reducer that drops `a.uid` answers about whichever card the offer
     happened to find first, so it would call an ineligible card legal and
     then heave a different one — an action whose effect is not the action
     the player took. Dropping it failed nothing until this drill. */
  const two = {...H.card("Thunder Quake", 1), uid: "t2",
               name: "Second Quake", kw: ["Heave 9"], tx: "**Heave 9**"};
  const pair = {...withTQ({res: 3}), phase: "end", arsenalFor: 0, turnPlayer: 0,
                priority: null, passed: [], firstPlayer: 0, round: 1, over: null};
  pair.sides = pair.sides.slice();
  pair.sides[0] = {...pair.sides[0], hand: [...pair.sides[0].hand, two]};
  assert.equal(J.legal(pair, {t: "arsenal", heave: true, uid: "tq1"}, 0), null,
    "the affordable one is legal");
  assert.match(String(J.legal(pair, {t: "arsenal", heave: true, uid: "t2"}, 0)),
    /that card cannot be heaved/, "and the one costing 9 with 3 in the pool is not");
});

test("both boards ask the ONE body, and neither restates the rule", () => {
  /* A schedule, a route and a gate are all written per board (v3.01,
     v3.04), so the thing to check is not that both have code — it is that
     both delegate. Comments stripped: a grep is satisfied by a comment. */
  const fs = require("fs"), path = require("path");
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  for(const [nm, src] of [["judge.js", jud], ["index.html", htm]]){
    assert.match(src, /heaveOffer\(/, nm + " must ask whether the offer stands");
    assert.match(src, /\.heave\(/, nm + " must perform it through the shared body");
    /* SCAN THE HEAVE SLICES, NOT THE WHOLE FILE. `index.html` bridges
       `arsEmpty` for the ordinary arsenal machinery, which is legitimate
       — a whole-file scan flagged it and would have been "fixed" by
       weakening the check to nothing. A guard aimed at the wrong SCOPE
       accuses the innocent as readily as one aimed at the wrong file
       passes by finding nothing. */
    const slices = [];
    for(let i = src.indexOf("heave"); i >= 0; i = src.indexOf("heave", i + 1))
      slices.push(src.slice(Math.max(0, i - 400), i + 400));
    assert.ok(slices.length >= 2, nm + " must actually mention heave more than once");
    /* AND THE TRAINER MUST OFFER IT ON SCREEN. Deleting only the button
       leaves `doHeave` in the file, so the two delegation greps above are
       both satisfied by code no tap can reach — a dead affordance reads
       as a broken screen, not as a rule. */
    if(nm === "index.html")
      assert.match(src, /onClick=\{doHeave\}/,
        "the arsenal statusline must render a heave button");
    for(const sl of slices){
      assert.ok(!/arsEmpty|heaveOf\(/.test(sl),
        nm + " must not re-derive the gate near a heave site — one reader, in effects.js");
      assert.ok(!/Seismic Surge/.test(sl),
        nm + " must not name the token — the mint is the shared body's op");
      assert.ok(!/\bres\b\s*-=|res:\s*[^,}]*-\s*\d/.test(sl),
        nm + " must not charge for it either");
    }
  }
});

/* ============================================================
   HEAVE IS THE THIRD FACE-UP SITE, AND IT FIRED NOTHING (v4.05)

   v3.71 made `faceUpArsenal` one body after finding two copies of the
   walk, and measured a THIRD site that sets `_faceUp` and fires no
   trigger: `heave`. It was recorded rather than half-moved, because
   `heave` is module-level — it returns `{game,msgs,ops}` instead of
   threading `n` — so it cannot reach the closure that holds the reader.

   THE FIX IS THE ONE BODY WITH TWO MORE CALLERS. `makeEffects` exposes
   `faceUpArsenal`, and both boards call it from their own arsenal step
   exactly as `applyAnswer` does for a pick. A second copy of the trigger
   reading is the thing v3.71 refused to create.

   IT IS LATENT AND THAT IS MEASURED: Thunder Quake is the pool's only
   heave card and it is a Guardian/Brute action, so no deck holds it
   beside an arrow. **A printed distinction is read whether or not
   anything reaches it today** (v3.73), and the drills below are
   synthetic for exactly that reason.
   ============================================================ */

test("a card heaved face up FIRES its face-up trigger", {skip}, () => {
  H.db();
  /* A synthetic card that prints heave AND an arsenal-up trigger. No pool
     card does both — that is the latency — so the fixture has to. */
  const both = {
    uid: "hv1", name: "Heave Probe Arrow", pitch: 1, cost: 0, power: 3,
    tt: "Ranger Attack Action - Arrow", ty: ["Ranger", "Attack", "Action"],
    kw: [], gkw: [],
    /* THE PRINTED WORDING IS "face-up", HYPHENATED, and every arrow in
       the pool spells it that way. The first draft wrote "face up" and
       the trigger simply did not parse — which reads exactly like the
       call site not firing. v3.79 records the identical slip in a
       MEASUREMENT; check your own fixture. */
    tx: "Heave 3\nWhen this is put face-up into your arsenal, it gets +2{p} this turn."
  };
  const g = H.state({hand: [both], res: 3, ap: 0}, {}, {turn: 3, actor: 0});
  const offer = E.heaveOffer(g, 0);
  assert.ok(offer, "fixture: the synthetic card is not heaveable");

  const h = E.heave(g, 0, offer.uid);
  const up = h.game.sides[0].arsenal;
  assert.ok(up && up._faceUp, "heave did not set the card face up at all");

  /* The put alone stamps nothing — the TRIGGER is what does, and it is
     the call site that fires it. */
  const after = J.withEffects({...h.game, actor: 0},
    (fx, s) => fx.faceUpArsenal(s, [], "Heave", "hand", true));
  assert.equal(after.sides[0].arsenal._arsPow, 2,
    "the face-up trigger did not fire for a card put there by HEAVE — the third " +
    "site is silent again, which is what v3.71 recorded and v4.05 closed");
});

test("both boards call it — neither heave site is the silent one", {skip}, () => {
  /* A CLAIM ABOUT TWO CALL SITES, and one of them lives in a babel block
     no drill can execute. judge's half is DRIVEN below; the trainer's is
     pinned as source, precisely enough that deleting the call breaks this
     line. v3.01's shape is the recurring defect here, so asserting only
     the board a drill can reach is exactly how it comes back. */
  const fs = require("fs"), path = require("path");
  const ROOT = path.join(__dirname, "..");
  const jd = fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  const jHeave = jd.slice(jd.indexOf("E.heave(n, seat, a.uid)"));
  assert.match(jHeave.slice(0, 1400), /fx\.faceUpArsenal\(s2, \[\], "Heave", "hand", true\)/,
    "judge's arsenal step no longer fires the face-up trigger after a heave");

  const tHeave = html.slice(html.indexOf("DawnEffects.heave(s, 0, off.uid)"));
  assert.match(tHeave.slice(0, 1200), /faceUpArsenal\(\{\.\.\.n, actor:0\}, \[\], "Heave", "hand", true\)/,
    "the trainer's arsenal step no longer fires it");

  /* AND THE ZONE IS "hand", NEVER "deck". Heave takes the card from hand;
     a default of "deck" would fire Back Alley Breakline's from-the-deck
     trigger off every heave (v3.72's rule, v3.79's card). */
  assert.ok(!/faceUpArsenal\([^)]*"Heave",\s*"deck"\)/.test(jd + html),
    "a heave now claims to put from the DECK — that pays an action point off " +
    "Back Alley Breakline for a card that came out of the hand");
});

test("the reader is ONE body — every arsenal-up read is inside it", {skip}, () => {
  const fs = require("fs"), path = require("path");
  const ef = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");

  /* THE FIRST DRAFT COUNTED `function faceUpArsenal(` AND WAS DEAD CODE
     READING LIKE A RULE (v3.67, v3.77). Two functions of that exact name
     in one scope is a JS redeclaration, so the count can only ever be 1 —
     the sabotage came back SILENT because it could not express the bug.
     What a second copy actually looks like is a second reader of the
     trigger, under any name, so that is what is pinned: every
     `arsenalUp` read in the file must fall inside this one body. */
  const start = ef.indexOf("function faceUpArsenal(");
  assert.ok(start > 0, "faceUpArsenal is gone — the one reader has been renamed or removed");
  /* BOUND IT AT THE NEXT SAME-INDENT DECLARATION OF ANY KIND. The first
     draft looked only for `\n  function `, and the next one of those is
     hundreds of lines away — so the body swallowed `applyAnswer` and a
     second reader planted THERE came back silent. A bound that is too
     wide reads exactly like a drill that passes. */
  const endM = /\n  (?:function|const|let|var) /.exec(ef.slice(start + 10));
  assert.ok(endM, "could not bound the body; the anchor moved");
  const end = start + 10 + endM.index;

  const reads = [];
  const rx = /\barsenalUp\b/g;
  let m; while((m = rx.exec(ef))) reads.push(m.index);
  assert.ok(reads.length >= 2, "the scan found no arsenal-up read at all — it is aimed wrong");

  const outside = reads.filter(i => (i < start || i > end) && !inComment(ef, i));
  assert.deepEqual(outside, [],
    "an arsenal-up read exists outside `faceUpArsenal` — that is the two-copy " +
    "defect v3.71 fixed, and the reason heave was left alone rather than half-moved");
});

/* Comments name the field constantly in this file, and a scan that cannot
   tell prose from code reports them as readers — the false positive
   `sync.test.js` documents. Strip them by position rather than by
   rewriting the source. */
function inComment(src, at){
  const before = src.slice(0, at);
  const line = before.slice(before.lastIndexOf("\n") + 1);
  if(/(^|[^:])\/\//.test(line)) return true;
  const ob = before.lastIndexOf("/*"), cb = before.lastIndexOf("*/");
  return ob > cb;
}
