/* ============================================================
   SPLIT CARDS AND MELD (v3.34)

   The two horizontal cards in this pool print their rule in reminder
   text, and it is the whole rule:

     Meld (You may play 1 or both halves of this card. Each costs 0.)

   IT IS ONE CARD. One pitch value, one defence value, one card in hand,
   one card in the graveyard. What is doubled is the TEXTBOX. Dealing it
   as two cards would break the 55-card count, the pitch value, the wall
   and the census at once — the CR is explicit that a melded split card is
   a SINGLE card played as a SINGLE layer with the properties of both
   sides.

   WHAT THE ENGINE DID: it ran BOTH halves, unconditionally, asking
   nothing. Burn Up // Shock dealt FIVE arcane damage the moment it was
   played and kept its action point. Four of those five points are printed
   as a DELAYED trigger — "the next time an attack you control hits a hero
   this turn" — which was swallowed whole and read as immediate damage.

   The card read `tier: part`, so no coverage tool ever looked at it, and
   the fairness sweep's captures stop at the word "attack".
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");
const fs = require("fs");
const path = require("path");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const SPLITS = ["Arcane Seeds // Life", "Burn Up // Shock"];

/* ---- 1. WHAT A SPLIT CARD IS ---------------------------------------- */

test("the database names them, and it is exactly two", {skip}, () => {
  H.db();
  /* `played_horizontally` is the authority. `//` in the type line is how
     two typeboxes are RENDERED — a spelling, not a fact about the card. */
  const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const recs = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const hz = recs.filter(r => r.played_horizontally).map(r => r.name).sort();
  assert.deepEqual([...new Set(hz)], SPLITS);
  for(const nm of SPLITS) assert.equal(H.card(nm, 1).hz, true, nm + " must carry the flag");
  assert.equal(H.card("Raging Onslaught", 1).hz, false, "and an ordinary card must not");
});

test("it is ONE card — one pitch, one defence, one cost", {skip}, () => {
  H.db();
  for(const nm of SPLITS){
    const c = H.card(nm, 1);
    assert.equal(c.pitch, 1, nm + ": one pitch value");
    assert.equal(c.def, 3, nm + ": one defence value");
    assert.equal(c.cost, 0, nm + ": one base cost");
    const hs = P.splitHalves(c);
    assert.equal(hs.length, 2);
    /* THE HALVES INHERIT THEM. A half is not a card you can pitch or
       block with on its own; those values are printed once, on the card. */
    for(const h of hs){
      assert.equal(h.pitch, c.pitch);
      assert.equal(h.def, c.def);
    }
  }
  assert.equal(P.splitHalves(H.card("Raging Onslaught", 1)), null,
    "an ordinary card has no halves, and the caller must ask rather than assume");
});

test("the halves are told apart by `tt`, which is the only place the boundary survives", {skip}, () => {
  H.db();
  /* `ty` FLATTENS BOTH FACES into one list — v2.39's note — so a reader
     that trusted the structured array here would see one card that is
     somehow both an Action and an Instant with no way to say which half
     is which. This is the documented case where `tt` knows more. */
  const c = H.card("Arcane Seeds // Life", 1);
  assert.deepEqual(c.ty, ["Runeblade", "Action", "Earth", "Instant"], "flattened, as the DB writes it");
  const [a, b] = P.splitHalves(c);
  assert.equal(a.name, "Arcane Seeds"); assert.equal(a.tt, "Runeblade Action");
  assert.equal(b.name, "Life");         assert.equal(b.tt, "Earth Instant");
  assert.equal(P.isInstantT(a), false, "the left half is an Action");
  assert.equal(P.isInstantT(b), true,  "the right half is an Instant");
  /* AND EACH HALF'S `ty` IS ITS OWN SEGMENT. Copying the card's flattened
     array to both halves makes each of them somehow an Action AND an
     Instant, which is the very confusion the split exists to resolve. */
  assert.deepEqual(a.ty, ["Runeblade", "Action"]);
  assert.deepEqual(b.ty, ["Earth", "Instant"]);
});

test("a half's KEYWORDS are its own textbox, not the card's index", {skip}, () => {
  H.db();
  /* `card_keywords` is ["Meld","Go again"] for the WHOLE card and Go
     again is printed on the top half only — v2.31's rule, which is why
     the halves carry no index at all and read their own text. Go again
     is the most valuable keyword in the game to hand to the wrong card. */
  for(const nm of SPLITS){
    const c = H.card(nm, 1);
    assert.ok((c.kw || []).some(k => /go again/i.test(k)), nm + ": the card's INDEX lists it");
    const [a, b] = P.splitHalves(c);
    P.fxReset(); assert.equal(P.fxParse(a).ga, true,  nm + ": the action half prints it");
    P.fxReset(); assert.equal(P.fxParse(b).ga, false, nm + ": the instant half does NOT");
  }
});

/* ---- 2. THE DELAYED TRIGGER ----------------------------------------- */

test("Burn Up is a DELAYED trigger, not damage", () => {
  /* The prefix was swallowed and the clause read as immediate arcane
     damage — the unanchored-match shape v3.00 names, on the card where it
     was worth four points a play. */
  assert.deepEqual(
    P.classifyClause("The next time an attack you control hits a hero this turn, deal 4 arcane damage to them"),
    {status: "run", ops: [["buffNext", 0, null, {onHit: [["arcane", 4]]}]]});
  /* AND THE NUMBER IS THE CARD'S. */
  assert.equal(P.classifyClause(
    "The next time an attack you control hits a hero this turn, deal 7 arcane damage to them")
    .ops[0][3].onHit[0][1], 7);
});

test("driven: Burn Up deals NOTHING on play, and 4 when an attack hits", {skip}, () => {
  H.db();
  P.fxReset();
  const bu = {...H.card("Burn Up // Shock", 1), uid: "b1"};
  let g = H.state({hand: [bu], res: 9, ap: 2}, {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const played = H.execute({...g, _half: 0}, bu, "hand", 0, {});
  assert.equal(played.sides[1].hp, 20, "NOTHING on play — this was 5 damage before v3.34");
  assert.equal(played.sides[0].buffQ.length, 1, "a rider waits instead");
  assert.deepEqual(played.sides[0].buffQ[0].rider, {onHit: [["arcane", 4]]});

  let mid = {...played, pend: null, stack: [], _half: null};
  mid.sides = played.sides.slice();
  mid.sides[0] = {...mid.sides[0], ap: 1};
  const atk = {...H.card("Raging Onslaught", 1), uid: "a1"};
  const swung = H.execute(mid, atk, "hand", 0, {});
  assert.deepEqual(swung.pend.onHit, [["arcane", 4]], "it rides onto the attack");
  assert.equal(swung.sides[0].buffQ.length, 0, "and is spent");
});

/* ---- 3. THE DECLARATION --------------------------------------------- */

const halfPlay = (nm, half) => {
  P.fxReset();
  const c = {...H.card(nm, 1), uid: "s1"};
  let g = H.state({hand: [c], res: 9, ap: 1, hp: 18}, {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  return H.execute(half === undefined ? g : {...g, _half: half}, c, "hand", 0, {});
};

test("each half resolves ONLY its own textbox", {skip}, () => {
  H.db();
  const left = halfPlay("Arcane Seeds // Life", 0);
  assert.equal(left.sides[0].board.filter(b => /runechant/i.test(b.card.name)).length, 2, "two Runechants");
  assert.equal(left.sides[0].hp, 18, "and NO life gained — that is the other half");

  const right = halfPlay("Arcane Seeds // Life", 1);
  assert.equal(right.sides[0].board.length, 0, "no Runechants");
  assert.equal(right.sides[0].hp, 19, "1 life, and only that");
});

test("meld runs both, and it is still ONE play", {skip}, () => {
  H.db();
  const both = halfPlay("Arcane Seeds // Life", "both");
  assert.equal(both.sides[0].board.filter(b => /runechant/i.test(b.card.name)).length, 2);
  assert.equal(both.sides[0].hp, 19, "both textboxes resolved");
  assert.equal(both.sides[0].hand.length, 0, "one card left the hand");
  assert.equal(both.sides[0].grave.length, 1, "and ONE card reached the graveyard");
});

test("declaring nothing plays the LEFT half — never both", {skip}, () => {
  H.db();
  /* The safe default. Defaulting to meld would hand a player a textbox
     they never asked for, which is precisely what this engine did. */
  const d = halfPlay("Arcane Seeds // Life", undefined);
  assert.equal(d.sides[0].hp, 18, "the right half must NOT resolve unasked");
  assert.equal(d.sides[0].board.filter(b => /runechant/i.test(b.card.name)).length, 2);
});

test("the action point belongs to the DECLARED half", {skip}, () => {
  H.db();
  /* CR 8.1.1 / 8.1.6: an action costs a point, an instant does not. The
     flattened `ty` array says the card is both, so asking the whole card
     charges the instant half a point it does not owe. */
  const c = H.card("Arcane Seeds // Life", 1);
  assert.equal(P.splitCostsAP(c, 0, "action"), true,  "the Action half costs one");
  assert.equal(P.splitCostsAP(c, 1, "action"), false, "the Instant half does not");
  /* MELD COSTS ONE IF EITHER SIDE IS AN ACTION, even though the other is
     an Instant — and it needs an empty stack for the same reason. */
  assert.equal(P.splitCostsAP(c, "both", "action"), true);
  /* and every ordinary card falls through to `costsAP` unchanged */
  const ro = H.card("Raging Onslaught", 1);
  assert.equal(P.splitCostsAP(ro, 0, "action"), P.costsAP(ro, "action"));
});

test("driven: the instant half spends no action point", {skip}, () => {
  H.db();
  /* The predicate above is the rule; this is `execute` actually asking
     it. Asking the WHOLE card instead reads `frontFace`, which is the
     Action half — so the instant half was charged a point it does not
     owe, whichever half the player declared. */
  const left  = halfPlay("Arcane Seeds // Life", 0);
  const right = halfPlay("Arcane Seeds // Life", 1);
  /* the Action half: 1 - 1 + 1 (it prints Go again) = 1 */
  assert.equal(left.sides[0].ap, 1, "spent and gained back — CR 5.3.5");
  /* the Instant half: no point spent, and it prints no Go again, so no
     point gained either. Starting from 1, it stays 1 — which is the same
     NUMBER by two different routes, so the drill also checks the log. */
  assert.equal(right.sides[0].ap, 1);
  const feed = (right.feed || []).map(x => typeof x === "string" ? x : (x && x.t) || "").join(" ");
  assert.match(feed, /instant speed — no action point spent/i,
    "and it says so: the two routes to 1 are told apart in the feed, not by the number");
});

/* ---- 4. DRIVEN AT THE TABLE ----------------------------------------- */

const standing = () => {
  P.fxReset();
  const c = {...H.card("Burn Up // Shock", 1), uid: "s1"};
  let g = H.state({hand: [c], res: 9, ap: 1}, {hp: 20}, {turn: 3, actor: 0});
  return {...g, phase: "action", step: "layer", priority: 0, passed: [],
          firstPlayer: 0, round: 1, over: null, turnPlayer: 0};
};

test("driven: judge ASKS before the card resolves", {skip}, () => {
  H.db();
  const g = standing();
  const out = J.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0).state;
  assert.ok(out.pending, "it must ask — the choice is the card's whole mechanic");
  assert.equal(out.pending.kind, "split");
  assert.deepEqual(out.pending.halves, ["Burn Up", "Shock"]);
  assert.equal(out.sides[0].hand.length, 1, "and the card has not moved yet");
  assert.equal(out.sides[1].hp, 20, "nor has anything resolved");
});

test("driven: each declaration resolves its own half at the table", {skip}, () => {
  H.db();
  const asked = J.reduce(standing(), {t: "play", uid: "s1", from: "hand"}, 0).state;

  const shock = J.reduce(asked, {t: "split", half: 1}, 0).state;
  assert.equal(shock.sides[1].hp, 19, "Shock's 1 arcane, and only that");
  assert.equal((shock.sides[0].buffQ || []).length, 0, "no delayed rider");

  const burn = J.reduce(asked, {t: "split", half: 0}, 0).state;
  assert.equal(burn.sides[1].hp, 20, "Burn Up deals nothing on play");
  assert.equal((burn.sides[0].buffQ || []).length, 1, "it arms the rider instead");

  const meld = J.reduce(asked, {t: "split", half: "both"}, 0).state;
  assert.equal(meld.sides[1].hp, 19, "meld does both");
  assert.equal((meld.sides[0].buffQ || []).length, 1);
});

test("the pending blocks everything else, and refuses a half that is not there", {skip}, () => {
  H.db();
  const asked = J.reduce(standing(), {t: "play", uid: "s1", from: "hand"}, 0).state;
  assert.match(String(J.legal(asked, {t: "pass"}, 0)), /declare which half/,
    "refused BY NAME rather than dead-tapping");
  assert.match(String(J.legal(asked, {t: "split", half: 2}, 0)), /not a half/);
  assert.equal(J.legal(asked, {t: "split", half: "both"}, 0), null, "meld is printed on this card");

  /* MELD IS A KEYWORD, NOT A PROPERTY OF BEING SPLIT. Every split card in
     this pool prints it, so nothing here can tell the two apart — only a
     synthetic can. A split card without meld may be played as one half or
     the other and NEVER as both. */
  const noMeld = {...H.card("Burn Up // Shock", 1), uid: "s2",
                  name: "Left // Right", kw: [], tx: "Do nothing.\n//\nDo nothing."};
  const g2 = {...asked, pending: {...asked.pending, card: noMeld, halves: ["Left", "Right"]}};
  assert.match(String(J.legal(g2, {t: "split", half: "both"}, 0)), /no meld/,
    "refused BY NAME");
  assert.equal(J.legal(g2, {t: "split", half: 0}, 0), null, "…while one half is still fine");
});

test("the declaration does not stick to the next card", {skip}, () => {
  H.db();
  const asked = J.reduce(standing(), {t: "play", uid: "s1", from: "hand"}, 0).state;
  const done = J.reduce(asked, {t: "split", half: 1}, 0).state;
  assert.equal(done._half, undefined,
    "a reducer whose state carries a spent answer plays the next split card as whatever "
    + "the last one chose, without asking");
});

/* ---- 5. BOTH BOARDS ASK --------------------------------------------- */

test("both boards ask, and neither restates what a half is", () => {
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/\/?[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  for(const [nm, src] of [["judge.js", jud], ["index.html", htm]]){
    assert.match(src, /isSplit\(/, nm + " must ask whether the card is one");
    assert.match(src, /splitHalves\(/, nm + " must read the halves from the one reader");
    assert.match(src, /_half/, nm + " must thread the answer to the play");
    /* SCAN THE SPLIT SITES, NOT THE WHOLE FILE. `index.html` carries the
       LOADER, which must map `played_horizontally` — a whole-file scan
       reports the mapping as a violation. Third time this shape has come
       up today: a guard aimed at the wrong SCOPE accuses the innocent as
       readily as one aimed at the wrong file passes by finding nothing. */
    const sites = [];
    for(let i = src.indexOf("isSplit("); i >= 0; i = src.indexOf("isSplit(", i + 1))
      sites.push(src.slice(Math.max(0, i - 500), i + 700));
    assert.ok(sites.length, nm + " must have a split site at all");
    for(const sl of sites)
      assert.ok(!/played_horizontally/.test(sl),
        nm + " must not re-derive what a split card is — `isSplit` is the one reader");
  }
});

test("the MELD keyword is a noop only because the choice exists", {skip}, () => {
  H.db();
  assert.equal(P.classifyClause("Meld").status, "noop");
  assert.equal(P.classifyClause("//").status, "noop");
  /* AND THE CHOICE MUST BE REAL. Filed before it existed, this would be
     the no-op blind spot at its purest — a keyword counted as accounted
     for while the engine played both halves of every split card for free.
     So the drill asserts the machinery, not the filing. */
  for(const nm of SPLITS){
    const c = H.card(nm, 1);
    assert.ok(P.hasKw(c, "meld"), nm + " prints it");
    assert.equal((P.splitHalves(c) || []).length, 2, nm + " must have two readable halves");
    for(const h of [0, 1]){
      P.fxReset();
      assert.equal(P.splitFx(c, h).tier, "full", nm + " half " + h + " must resolve in full");
    }
  }
});

/* ---- 7. THE WINDOW BELONGS TO THE DECLARED HALF (v3.35) -------------- */

test("the card is OFFERED in either window — the union of its halves", {skip}, () => {
  H.db();
  const TY = require("../engine/types.js");
  const c = H.card("Burn Up // Shock", 1);
  /* `types.playWindows` reads the FRONT face of a `//` card, which v2.39
     made it do so the whole card would stop reading as an Instant and
     collecting a free action point. Correct for a card played as one
     lump — and it also meant the INSTANT half could never be played at
     instant speed at all, which is a printed line of play. */
  assert.deepEqual(TY.playWindows(c), ["action"], "the front face alone, as v2.39 left it");
  const [a, b] = P.splitHalves(c);
  assert.deepEqual(TY.playWindows(a), ["action"]);
  assert.deepEqual(TY.playWindows(b), ["instant"]);
});

const inWindow = (step, prio, turnPlayer) => {
  P.fxReset();
  const c = {...H.card("Burn Up // Shock", 1), uid: "s1"};
  let g = H.state({res: 9, ap: 0}, {res: 9}, {turn: 3, actor: turnPlayer});
  g.sides = g.sides.slice();
  g.sides[0] = {...g.sides[0], hand: [c]};
  return {...g, phase: "action", step, priority: prio, passed: [], firstPlayer: 0,
          round: 1, over: null, turnPlayer, attacker: turnPlayer,
          pend: {card: {...H.card("Raging Onslaught", 1), uid: "a1"},
                 by: turnPlayer, total: 7, ga: false, ops: [], onHit: []}, stack: []};
};

test("driven: the INSTANT half is playable at instant speed, for no action point", {skip}, () => {
  H.db();
  /* Their turn, the reaction step, and seat 0 holds no action point at
     all. Before v3.35 the card was refused outright — "is an action" —
     so Shock could never be answered with. */
  const g = inWindow("reaction", 0, 1);
  assert.equal(J.legal(g, {t: "play", uid: "s1", from: "hand"}, 0), null,
    "the card must be OFFERED here, on the strength of its instant half");
  const asked = J.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0).state;
  assert.equal(asked.pending.kind, "split");

  const shock = J.reduce(asked, {t: "split", half: 1}, 0);
  assert.ok(!shock.error, shock.error);
  assert.equal(shock.state.sides[1].hp, 19, "Shock's 1 arcane lands");
  assert.equal(shock.state.sides[0].ap, 0, "and CR 8.1.6 — an instant costs no action point");
});

test("driven: the ACTION half is refused in that same window, by name", {skip}, () => {
  H.db();
  const asked = J.reduce(inWindow("reaction", 0, 1), {t: "play", uid: "s1", from: "hand"}, 0).state;
  /* The OFFER is the union; the DECLARATION is one of them. An Action
     half cannot ride in on its Instant sibling's window. */
  assert.match(String(J.legal(asked, {t: "split", half: 0}, 0)), /Burn Up is an action/);
  assert.match(String(J.legal(asked, {t: "split", half: "both"}, 0)), /melding/,
    "and melding is an ACTION play whenever either side is one");
});

test("with NO action point, the card is still offered for its instant half", {skip}, () => {
  H.db();
  /* The affordability check runs BEFORE the declaration, so it asks
     whether ANY half could be played — not what melding would cost. Asking
     the front face (an Action) refuses a seat with no action point a card
     whose Instant half costs none, which is the printed play. */
  P.fxReset();
  const c = {...H.card("Burn Up // Shock", 1), uid: "s1"};
  let g = H.state({hand: [c], res: 9, ap: 0}, {hp: 20}, {turn: 3, actor: 0});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [],
       firstPlayer: 0, round: 1, over: null, turnPlayer: 0};
  assert.equal(J.legal(g, {t: "play", uid: "s1", from: "hand"}, 0), null,
    "offered with zero action points — Shock costs none");
  const asked = J.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0).state;
  const shock = J.reduce(asked, {t: "split", half: 1}, 0);
  assert.ok(!shock.error, shock.error);
  assert.equal(shock.state.sides[0].ap, 0, "and it stays at zero");
  /* AND MELD IS THE OTHER ANSWER: an action play, so it needs the point. */
  assert.equal(P.splitCostsAP(H.card("Burn Up // Shock", 1), "both", "action"), true);
  assert.equal(P.splitCostsAP(H.card("Burn Up // Shock", 1), undefined, "action"), false,
    "…while the undeclared card is affordable, because one half is free");

  /* THE CALL SITE IS PINNED BY READING IT, and the reason is worth
     writing down: `typeCostsAP` and `splitCostsAP` give the SAME answer
     in every state reachable today, because `speedAllowed` opens the
     instant window alongside the action one in the action phase, and the
     `some` finds the free one either way. That coincidence is not a rule
     — it is one change to `priority.js` away from being false — so the
     site asks the reader that is CORRECT rather than the one that
     currently agrees. Same call v3.26 made for `defSelfMet`'s unreachable
     default: where no fixture can tell two readings apart, assert the
     reader by name. */
  const jud = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(jud, /const free = open\.some\(w => !PR\.splitCostsAP\(c, g\._half, w\)\);/,
    "the affordability check must ask the split reader");
});

test("v2.39's free action point cannot come back through a declared half", {skip}, () => {
  H.db();
  /* The whole reason `playWindows` reads the front face: a card typed
     both Action and Instant picks the FREE window and the action half
     rides along for nothing. The declaration closes it — Burn Up
     declared alone has only the action window to be played in. */
  const c = H.card("Burn Up // Shock", 1);
  const J2 = require("../engine/judge.js");
  let g = H.state({hand: [{...c, uid: "s1"}], res: 9, ap: 1}, {hp: 20}, {turn: 3, actor: 0});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [],
       firstPlayer: 0, round: 1, over: null, turnPlayer: 0};
  const asked = J2.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0).state;
  for(const [half, want] of [[0, 1], [1, 1], ["both", 1]]){
    const r = J2.reduce(asked, {t: "split", half}, 0);
    assert.ok(!r.error, "half " + half + ": " + r.error);
    assert.equal(r.state.sides[0].ap, want,
      "half " + half + ": ap must be " + want + " — 2 would be v2.39's free point");
    assert.equal(r.state.sides[0].grave.length, 1, "and ONE card reaches the graveyard");
  }
});

/* ---- 8. THE PENDING IS DEMUXED BY WHITELIST ------------------------- */

test("every pending kind judge can open has a branch at the table", () => {
  /* REPORTED FROM A REAL TABLE, turn 1. The board read `kind !== "boost"`
     and treated everything else as a PAYMENT, so the split declaration
     opened a pitch sheet reading "covered ✓" for a card costing 0 — and
     Pitch & play then sent `payConfirm`, which `legal` refuses. A screen
     whose only exit was Cancel.

     A BLACKLIST IS THE BUG. The next kind added walks into the same
     fallback, so the census is the guard rather than the memory. */
  const kinds = J.PENDING_KINDS;
  assert.deepEqual([...kinds].sort(), ["addPay", "boost", "pay", "split"]);
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  const i = htm.indexOf("const kindIs = k =>");
  assert.ok(i > 0, "the table's pending demux moved — re-anchor this drill");
  const demux = htm.slice(i, i + 400);
  for(const k of kinds)
    assert.ok(demux.indexOf('kindIs("' + k + '")') > 0,
      'the table must demux "' + k + '" explicitly — a kind with no branch is a screen with no exit');
  /* AND IT MUST NOT BE A BLACKLIST. */
  assert.ok(!/kind\s*!==/.test(demux),
    "whitelist, never blacklist — that is what made a split declaration open a pitch sheet");
  /* AND EVERY KIND NEEDS A BRANCH IN THE ACTION BAR. Demuxing it into a
     variable nothing renders is the same dead end wearing a tidier name. */
  /* ANCHOR FORWARD FROM THE DEMUX, not from the first `actbar` in the
     file — that one is the TRAINER's, and slicing it looks exactly like
     the table missing a branch. Fourth time today a guard has pointed at
     the wrong scope; the fix is always to anchor on something unique to
     the thing under test. */
  const bar = htm.slice(i);
  const branches = bar.slice(0, bar.indexOf("End turn"));
  for(const k of kinds){
    const v = k === "pay" ? "pay" : k;
    assert.ok(new RegExp("[:?]\\s*" + v + "\\s*\\?").test(branches),
      "the action bar must have a branch for " + k + " — a kind demuxed and never rendered "
      + "is the same screen with no exit");
  }
});

test("every pending kind judge can open is one it also names in ACTIONS", () => {
  /* A kind with no answering action is a pending nothing can clear. */
  for(const k of J.PENDING_KINDS)
    if(k !== "pay") assert.ok(J.ACTIONS.indexOf(k) >= 0, k + " must be an action too");
  for(const t of ["paySel", "payConfirm", "payCancel"])
    assert.ok(J.ACTIONS.indexOf(t) >= 0, "and a payment is answered by " + t);
});

/* ---- 9. THE FACE IS TURNED TO BE READ ------------------------------- */

test("a split card is rendered rotated, and only a split card", () => {
  /* The database ships the art PORTRAIT with its content sideways, so it
     is turned to be read. -90deg (counter-clockwise) is upright; +90deg
     comes out upside down, which was checked by rendering both rather
     than reasoned about. */
  const htm = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(htm, /const hz = DawnParser\.isSplit\(card\);/,
    "CardFrame must ask the ONE reader — nothing here may test for `//`");
  assert.match(htm, /\.cfw\.hz>img[^}]*rotate\(-90deg\)/,
    "counter-clockwise: +90deg renders the card upside down");
  /* THE ASPECT AND THE TWO CALCS MUST AGREE, or the face is cropped: the
     image box is the frame's own dimensions swapped. */
  const m = htm.match(/\.cfw\.hz\{--hzr:([\d.]+);aspect-ratio:var\(--hzr\)/);
  assert.ok(m, "the rotated frame must set --hzr and use it as the aspect");
  assert.ok(Math.abs(+m[1] - 763 / 546) < 0.005,
    "--hzr is the card's real aspect the other way up (546x763)");
  assert.match(htm, /width:calc\(100% \/ var\(--hzr\)\);height:calc\(100% \* var\(--hzr\)\)/,
    "and both derive from it, or the two drift and the art crops");
});
