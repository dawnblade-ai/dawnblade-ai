/* ============================================================
   "DEFENSE REACTIONS CAN'T BE PLAYED TO THIS CHAIN LINK" (v4.60)

   Nine pool records print the family across THREE cards, and until v4.60
   the two unconditional wordings were filed:

       NOOP("the dummy plays no defence reactions — nothing to deny yet")

   with NO reader on either board. The restriction did nothing.

   A REASON THAT STOPPED BEING TRUE (v3.69, v4.33, v4.43). v4.03 built the
   whole reaction step and gave `sparring.act` a caller for it — the ladder
   plays 824 defence reactions per 630 games — so the sentence was false at
   the TABLE from that version on. It stayed true of the trainer, whose
   opponent fabricates its swing, which is v3.16's shape: a noop describing
   a SIBLING board.

   THREE BLINDNESSES, NOT TWO. Coverage counts a `noop` as ACCOUNTED FOR —
   CLAUDE.md's own "first place to look". The one-sided fairness sweep looks
   for a card STRONGER than printed, and a dropped restriction on the
   OPPONENT is the other direction. And `test/noopvoice.test.js` grades a
   reason's VOICE — version numbers, filenames, identifiers — and cannot
   see one that is factually STALE. Worth recording as its own gap.

   AND THE NOTE THIS VERSION WAS PLANNED FROM SAID TWO CARDS. Measured, it
   is THREE: Release the Tension x3 grants the NARROWER "…from arsenal this
   chain link" as a quoted ability, and it is deliberately still refused —
   read by the unconditional anchor it would bar a defence reaction from the
   HAND as well, which is stronger than printed. v4.09 again: check your own
   fixture by asking the file, not by remembering what it says.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P  = require("../engine/parser.js");
const C  = require("../engine/cards.js");
const G  = require("../engine/game.js");
const BL = require("../engine/build.js");
const RNG = require("../engine/rng.js");
const J  = require("../engine/judge.js");
const SPAR = require("../engine/sparring.js");
const INV = require("../engine/invariants.js");
const H  = require("./helpers/judged.js");
const X  = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const DATA = X.loadData();
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
/* comments stripped, because this project's own prose names the shapes it
   forbids and a raw scan reports that sentence as the defect (v4.27, v4.32,
   v4.44, v4.59 — and the control below is routed THROUGH the stripper). */
const codeOf = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* The pinned pool, read directly: this census is about what the POOL prints
   and needs no live database (v4.17). */
const POOL = JSON.parse(read("data/pool.json"));

/* ============================================================
   THE PREMISE, MEASURED OFF THE POOL
   ============================================================ */

test("the family is THREE cards and nine records — pinned as a SET", () => {
  const hits = POOL
    .filter(r => /defense reaction/i.test(r.functional_text || "")
              && /can.?.?t be played/i.test(r.functional_text || ""))
    .map(r => r.name + "|" + r.pitch).sort();
  assert.deepEqual(hits, [
    "Release the Tension|1", "Release the Tension|2", "Release the Tension|3",
    "Widowmaker|1", "Widowmaker|2", "Widowmaker|3",
    "Wreck Havoc|1", "Wreck Havoc|2", "Wreck Havoc|3",
  ], "a fourth card printing this family is a deliberate edit — the third "
   + "(Release the Tension) prints the NARROWER 'from arsenal' form, read since "
   + "v4.69 with its zone, so a new record must be read before it is counted");
});

test("and it is LIVE in two precon lists, not latent", () => {
  /* v4.43's Hood and v4.49's Gun read zero on the ladder because
     `defaultPicks` never wore them. These are DECK cards, so there is no
     loadout between the pool and the table. */
  const owners = {};
  for(const [k, txt] of Object.entries(DATA.DECKS))
    for(const line of String(txt).split("\n")){
      const [q, name, p] = line.split("|");
      if(/^(Widowmaker|Wreck Havoc|Release the Tension)$/.test(name || ""))
        (owners[name + "|" + p] = owners[name + "|" + p] || []).push(k);
    }
  assert.deepEqual(owners, {
    "Release the Tension|1": ["azalea"],
    "Widowmaker|2": ["azalea"],
    "Wreck Havoc|1": ["dorinthea"],
  }, "who decks these is the whole reason the restriction is reachable");
});

test("THE THREE PRINTED WORDINGS, driven through classifyClause", () => {
  const bar = s => P.classifyClause(s);
  /* the two unconditional forms READ, and carry the field rather than an op */
  for(const w of ["defense reactions can't be played to this chain link",
                  "defense reaction cards can't be played this chain link"]){
    const r = bar(w);
    assert.ok(r && r.status === "run", w + " no longer reads: " + JSON.stringify(r));
    assert.equal(r.noDrx, true, w + " must carry the field the boards read");
  }
  /* AND THE NARROWER ONE READS WITH ITS ZONE (v4.69) — refused until then,
     because read as `true` it bars a defence reaction from the HAND too,
     which is STRONGER than printed. So the load-bearing half is now that it
     is NOT `true`: the value is the zone, and `drxBarWhy` asks where the
     card is being played from. */
  const narrow = bar("defense reactions can't be played from arsenal this chain link");
  assert.ok(narrow && narrow.status === "run", "the 'from arsenal' wording no longer reads");
  assert.equal(narrow.noDrx, "arsenal",
    "the 'from arsenal' wording must carry its ZONE — `true` bars the HAND as well, "
    + "which Release the Tension never says");
});

test("an OP would have been wrong rather than merely different", () => {
  /* An attack card's `fx.ops` ride to RESOLUTION (v4.08) — hundreds of
     lines after the defend and reaction steps this restriction governs — so
     a restriction pushed as an op arrives once the window it closes has
     already shut. That is why it is a card FACT. */
  assert.ok(P.DECL_OPS && !P.DECL_OPS.has("noDrx"),
    "if `noDrx` were ever an op kind it would need to be in DECL_OPS, which is "
    + "a pinned allow-list — the field exists so the question does not arise");
});

test("both records of the family set fx.noDrx, and the clause reads `run`", {skip}, () => {
  H.db(); P.fxReset();
  for(const [nm, pitches] of [["Widowmaker", [1, 2, 3]], ["Wreck Havoc", [1, 2, 3]]])
    for(const p of pitches){
      const c = H.card(nm, p);
      const fx = P.fxParse(c);
      assert.equal(fx.noDrx, true, nm + "|" + p + " does not carry the restriction");
      assert.equal(fx.clauses[0].st, "run",
        nm + "|" + p + "'s first clause still reports " + fx.clauses[0].st
        + " — a clause that is READ must not report as a no-op");
    }
  /* AND THE THIRD CARD GRANTS IT RATHER THAN CARRYING IT (v4.69). The bar
     is a quoted ability handed to "your next arrow attack", so it rides on
     the pump — never on Release the Tension itself, which is a non-attack
     and opens no link. Its rider is READ now, so the v3.41 flag that named
     it as unread must have gone: a flag that outlives its gap is a report
     that lies in the other direction. */
  for(const p of [1, 2, 3]){
    const fx = P.fxParse(H.card("Release the Tension", p));
    assert.equal(!!fx.noDrx, false, "Release the Tension must NOT carry the bar itself");
    const op = fx.ops.find(o => o[0] === "buffNext");
    assert.ok(op, "the pump no longer reads");
    assert.deepEqual(op[3], {noDrx: "arsenal"}, "the bar does not ride on the grant");
    assert.ok(!(fx.quotedUnread || []).some(q => /from arsenal/.test(q)),
      "the rider is read, and is still reported as unread");
  }
});

test("'cards' and 'reactions' mean the same thing to this engine — MEASURED", () => {
  /* In the CR the bare plural also covers a defence-reaction ABILITY.
     Measured over the pool: ZERO records print one, and `classifyClause`
     guards `Action -`, `Instant -` and `Attack Reaction -` with no fourth
     prefix, so there is no such window for `abWindow` to answer. `isDR` —
     the printed TYPE — is the whole of what either wording can reach here.
     Carrying a cards/abilities distinction would be vocabulary with no
     claimant, which is dead rules code that reads like a rule (v4.11). */
  const abil = POOL.filter(r => /defense reaction\s*[-—]/i.test(r.functional_text || ""));
  assert.deepEqual(abil.map(r => r.name), [],
    "a defence-reaction ACTIVATED ABILITY has arrived: the cards/reactions "
    + "distinction stops being unmeasurable and somebody has to decide it");
  /* and the premise that there is no fourth activation prefix to answer */
  assert.equal(/attack reaction\|action\|instant/i.test(codeOf(read("engine/parser.js"))), true,
    "`parseHeroPower`'s prefix alternation moved — re-measure which windows exist");
});

/* ============================================================
   THE ONE READER, AND WHAT IT REFUSES
   ============================================================ */

test("drxBarWhy refuses every way it should", {skip}, () => {
  H.db(); P.fxReset();
  const wm = H.card("Widowmaker", 2);
  const dr = H.card("Put in Context", 3);
  const plain = H.card("Snatch", 1);
  /* IT ASKS THE LINK AND THE ZONE (v4.69), because a granted bar lives on
     `pend` rather than on the card, and the narrow one names a zone. */
  const link = card => ({card});

  assert.ok(P.drxBarWhy(link(wm), dr, "hand"), "the live case must bar");
  assert.ok(P.drxBarWhy(link(wm), dr, "arsenal"), "…from EVERY zone — Widowmaker names none");
  assert.match(P.drxBarWhy(link(wm), dr, "hand"), /Widowmaker/,
    "the refusal must NAME the card that closed the window — in a training sim "
    + "the feed is the lesson (v3.60, v4.24)");
  assert.match(P.drxBarWhy(link(wm), dr, "hand"), /Put in Context/, "and the card being refused");

  /* A CALLER THAT SAYS NOTHING BARS NOTHING — weaker than printed and
     visible, never the reverse (v3.24). */
  assert.equal(P.drxBarWhy(null, dr, "hand"), null, "no open link, no bar");
  assert.equal(P.drxBarWhy(undefined, dr, "hand"), null, "no open link, no bar");
  /* a plain attack on the link bars nothing */
  assert.equal(P.drxBarWhy(link(plain), dr, "hand"), null, "Snatch prints no such restriction");
  /* AND ONLY A DEFENCE REACTION IS BARRED. An INSTANT played in the defence
     window is not a defence reaction, and the printed line does not name
     it. Ask for the refusal, not only the match (v3.98). */
  assert.equal(P.drxBarWhy(link(wm), plain, "hand"), null, "an attack card is not a defence reaction");
  const inst = H.card("Energy Potion", 0);
  assert.ok(inst && !P.isDR(inst), "fixture: Energy Potion must not be a defence reaction");
  assert.equal(P.drxBarWhy(link(wm), inst, "hand"), null,
    "an instant is not a defence reaction — barring it reads a word the card never prints");
});

test("A GRANTED bar on the link: the ARSENAL is barred and the HAND is not (v4.69)", {skip}, () => {
  /* Release the Tension's shape, on the link its arrow opens. BOTH HALVES —
     a reader that ignores the zone passes the arsenal half perfectly, and
     the hand half is the one the refusal existed to protect (v4.60). */
  H.db(); P.fxReset();
  const dr = H.card("Put in Context", 3);
  const arrow = {name: "Some Arrow", tt: "Ranger Action - Arrow Attack", ty: ["Ranger", "Action", "Attack"],
                 power: 3, tx: "", kw: [], gkw: []};
  const pend = {card: arrow, noDrx: [{from: "arsenal", src: "Release the Tension"}]};
  const why = P.drxBarWhy(pend, dr, "arsenal");
  assert.ok(why, "the granted bar does not close the arsenal door");
  assert.match(why, /Release the Tension/, "the refusal must name the card that GRANTED the bar");
  assert.match(why, /Some Arrow/, "…and the attack it rides on");
  assert.equal(P.drxBarWhy(pend, dr, "hand"), null,
    "the granted bar closed the HAND door — stronger than printed, the direction that steals games");
  assert.equal(P.drxBarWhy(pend, dr), null, "a door that names no zone gets no narrow bar (v3.24)");
  assert.equal(P.drxBarWhy({card: arrow}, dr, "arsenal"), null, "control: the same arrow with no grant bars nothing");
});

test("`drxBarred` and `drxBarWhy` are the only readers of the field", () => {
  /* ONE BODY BECAUSE THREE DOORS ASK IT (judge.legal, playRx, playRxA).
     A board that hand-rolled the phrase or read `fx.noDrx` itself is the
     mirror the no-mirror rule exists to stop. */
  for(const f of ["engine/judge.js", "index.html", "engine/effects.js",
                  "engine/sparring.js", "engine/prompts.js"]){
    let src = codeOf(read(f));
    /* effects.js CARRIES a granted bar (v4.69) — stamps its source on the
       buffQ entry, moves it onto the collecting attack's `pend`, and names
       it in the feed — and must never DECIDE on one. So what it may touch
       is a RIDER's field, and nothing it reads is the link's or the card's. */
    if(f === "engine/effects.js"){
      assert.ok(!/\b(?:fx|pend|link)\.noDrx\b/.test(src),
        "effects.js reads the bar off the card or the link — only drxBarWhy decides");
      src = src.replace(/\b(?:rider|r|op\[3\])\.noDrx\b/g, "");
    }
    assert.ok(!/\.noDrx\b/.test(src), f + " reads fx.noDrx directly — ask drxBarWhy");
    assert.ok(!/can.?.?t be played .{0,12}this.{0,2} chain link/i.test(src),
      f + " spells the printed phrase itself — the parser is the one reader");
  }
  /* and the control, routed THROUGH the stripper (v4.32): the scan must be
     able to SEE the phrase when it is code rather than prose. */
  assert.ok(/\.noDrx\b/.test(codeOf("if(r." + "noDrx) x = 1;")),
    "the scan cannot see the field at all — it proves nothing");
  assert.ok(!/\.noDrx\b/.test(codeOf("/* r." + "noDrx in prose */")),
    "the stripper does not strip — this file's own comments would fail the scan");
});

/* ============================================================
   DRIVEN AT A REAL TABLE — both halves
   ============================================================ */

let _db = null;
const db = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(X.cardDbPath(), "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const heroBy = re => DATA.HEROES.find(h => re.test(h.n));

function table(seed, a, b){
  const d = db(); J.setDb(d);
  const ctr = {n: 0}; let rng = RNG.make(seed);
  const h0 = heroBy(a), h1 = heroBy(b);
  const b0 = BL.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), d, rng, ctr); rng = b0.rng;
  const b1 = BL.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), d, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k],
                     rng, first: 0, tokSeq: ctr.n});
}
function settle(n, skipUid){
  let g = 0;
  while(J.pendingOf(n) && g++ < 40){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    if(p.kind === "charge"){ n = J.reduce(n, {t: "charge", uid: null}, p.seat).state; continue; }
    if(p.need - sd.res - J.paySum(sd) > 0){
      const pk = sd.hand.find(x => x.uid !== skipUid && (x.pitch || 0) > 0
                                && !(sd.paySel || []).includes(x.uid));
      if(!pk) break;
      n = J.reduce(n, {t: "paySel", uid: pk.uid}, p.seat).state;
    } else n = J.reduce(n, {t: "payConfirm"}, p.seat).state;
  }
  return n;
}
/* AZALEA v DORINTHEA, and the pairing is the measurement rather than a
   convenience: Azalea decks Widowmaker, Dorinthea decks Wreck Havoc AND
   Put in Context, so both halves of this drill are cards a ladder game can
   actually deal to these two seats.

   THE CARDS ARE SPLICED IN AT THE WINDOW, and that is a stated fixture
   decision (rxlayer.test.js's, verbatim): getting a specific attack and a
   specific defence reaction to survive two opening hands, a payment and a
   charge cost is a fight with the shuffle, and this drill is about what the
   TURN STRUCTURE does with the restriction. The chain is entirely real. */
function reactionWindow(atkName, atkPitch){
  let g = table("drxprobe1", /azalea/i, /dorinthea/i);
  while(g.arsenalFor != null) g = J.reduce(g, {t: "arsenal", uid: null}, g.arsenalFor).state;
  const seat = g.turnPlayer, foe = 1 - seat;
  const atk = {...H.card(atkName, atkPitch), uid: 9001};
  const dr  = {...H.card("Put in Context", 3), uid: 9002};
  assert.ok(P.isDR(dr), "fixture: Put in Context is not a defence reaction any more");
  let sides = g.sides.slice();
  sides[seat] = {...g.sides[seat], res: 9, hand: [atk, ...g.sides[seat].hand]};
  sides[foe]  = {...g.sides[foe],  res: 9, hand: [dr,  ...g.sides[foe].hand]};
  g = {...g, sides};
  let n = settle(J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, seat).state, atk.uid);
  let k = 0;
  while(n.step !== "reaction" && k++ < 30){
    if(n.priority == null) break;
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  }
  assert.equal(n.step, "reaction", "fixture: never reached the reaction step");
  /* CR 7.3.3 — every combat step hands priority to the TURN-PLAYER first,
     so the attacker passes before the DEFENDER may answer. Without this the
     refusal under test is never reached: `legal` says "you do not hold
     priority" for both halves and the drill passes against any engine. */
  if(n.priority === seat) n = J.reduce(n, {t: "pass"}, seat).state;
  assert.equal(n.priority, foe, "fixture: the defender never got the window");
  assert.equal(n.pend && n.pend.card && n.pend.card.name, atkName,
    "fixture: the wrong card is on the open link");
  return {n, seat, foe, atk, dr};
}

test("AT THE TABLE: Widowmaker bars the defence reaction, and NAMES itself", {skip}, () => {
  const w = reactionWindow("Widowmaker", 2);
  const why = J.legal(w.n, {t: "play", uid: w.dr.uid, from: "hand"}, w.foe);
  assert.ok(why, "the defence reaction is still legal — the restriction has no reader");
  assert.match(why, /Widowmaker/, "the refusal must name the card that closed the window");
  assert.equal(INV.errors(w.n).length, 0, "the fixture's board is broken");
});

test("AT THE TABLE: Wreck Havoc bars it too — the OTHER printed wording", {skip}, () => {
  const w = reactionWindow("Wreck Havoc", 1);
  const why = J.legal(w.n, {t: "play", uid: w.dr.uid, from: "hand"}, w.foe);
  assert.ok(why, "the second wording reads differently from the first");
  assert.match(why, /Wreck Havoc/);
});

test("AND THE CONTROL: a plain attack on the link leaves it LEGAL", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING. A bar that refuses every
     defence reaction passes the two tests above perfectly. */
  const w = reactionWindow("Snatch", 1);
  assert.equal(J.legal(w.n, {t: "play", uid: w.dr.uid, from: "hand"}, w.foe), null,
    "Snatch prints no restriction and must not bar anything");
});

test("the bar follows the OPEN LINK, so it expires with the link", {skip}, () => {
  /* "THIS CHAIN LINK" IS `pend`'s OWN LIFETIME, which is why nothing is
     banked and nothing is swept: judge replaces `pend` at every declaration
     and clears it at the close. Driven on a REAL reaction-step state by
     changing only the card on the link — a second real link needs an attack
     with go again, and what is being measured here is the lifetime rather
     than the chain. */
  const w = reactionWindow("Widowmaker", 2);
  const act = {t: "play", uid: w.dr.uid, from: "hand"};
  assert.ok(J.legal(w.n, act, w.foe), "fixture: the bar is not in force");
  const swapped = {...w.n, pend: {...w.n.pend, card: H.card("Snatch", 1)}};
  assert.equal(J.legal(swapped, act, w.foe), null,
    "the bar outlived the card that printed it — it is being banked somewhere");
  const closed = {...w.n, pend: null};
  assert.equal(P.drxBarWhy(closed.pend, w.dr, "hand"), null,
    "with no open link there is nothing to bar");
});

test("the POLICY inherits the rule and proposes no refusal", {skip}, () => {
  /* `sparring.act` filters every proposal through `judge.legal`, so a
     refusal is always a bug in the policy by its own contract — and
     v4.54's livelock is what a policy that proposes an illegal action
     every tick looks like. Driven with the defender's hand STRIPPED to the
     barred card, so the only reaction candidate IS the one that must not be
     proposed: asking a full hand proves nothing, because the policy would
     pick something else anyway. */
  const w = reactionWindow("Widowmaker", 2);
  let sides = w.n.sides.slice();
  sides[w.foe] = {...w.n.sides[w.foe], hand: [w.dr], arsenal: null};
  const g = {...w.n, sides};
  const prop = SPAR.act(g, w.foe);
  assert.notEqual(prop && prop.t === "play" && prop.uid, w.dr.uid,
    "the policy proposed the barred defence reaction");
  if(prop) assert.equal(J.legal(g, prop, w.foe), null,
    "the policy proposed a refusal: " + JSON.stringify(prop));
  /* AND THERE IS A WAY FORWARD — a window with no legal action and no pass
     is a hard stop for both seats. */
  assert.equal(J.legal(g, {t: "pass"}, w.foe), null, "the defender cannot even pass");

  /* the control: with a plain attack on the link the same hand IS playable,
     so the assertion above is about the bar rather than about the card */
  const plain = {...g, pend: {...g.pend, card: H.card("Snatch", 1)}};
  assert.equal(J.legal(plain, {t: "play", uid: w.dr.uid, from: "hand"}, w.foe), null,
    "control: the stripped hand must be playable when nothing bars it");
});

/* ============================================================
   THE TRAINER'S TWO DOORS — one body, and honestly LATENT
   ============================================================ */

/* THE TWO DOOR BODIES, SLICED ONCE. Two drills below ask about them, and
   two copies of one slice is the drift `test/slicecensus.test.js` exists to
   watch — so they are taken here rather than in each test. Both are anchored
   on the body's OWN declaration and bounded at the NEXT one, which is the
   safe form that census prefers (v4.57). */
const HTML = codeOf(read("index.html"));
const DOOR_HAND = HTML.slice(HTML.indexOf("const playRx = (i, addPaid) => setG"),
                             HTML.indexOf("const playRxA = () => setG"));
const DOOR_ARS  = HTML.slice(HTML.indexOf("const playRxA = () => setG"),
                             HTML.indexOf("const playFoeTurnRx"));

test("the trainer asks the SAME body at both of its doors", () => {
  const hand = DOOR_HAND, ars = DOOR_ARS;
  assert.ok(hand.length > 200 && ars.length > 200, "the door anchors moved — re-anchor");
  /* THE WHOLE CONDITIONAL, NOT THE BARE CALL — v4.00 verbatim, and v4.55
     recorded the identical thing one cost over: a source scan cannot tell a
     live guard from a NEUTERED one, so `if(drxBarA && false) return …` leaves
     the call intact and passes a scan that only looks for it. Both of this
     version's door sabotages proved it: the ARSENAL one came back SILENT, and
     the HAND one "bit" only on `slicecensus`'s width pin, which is a
     coincidental bite and no better. So what is pinned is the RETURN being
     reached from the bar, with nothing between the two. */
  for(const [nm, body, v, zone] of [["playRx", hand, "drxBar", "hand"], ["playRxA", ars, "drxBarA", "arsenal"]]){
    /* AND EACH DOOR NAMES ITS OWN ZONE (v4.69) — a door that names the wrong
       one hands Release the Tension's arsenal bar to the hand, or drops it. */
    assert.match(body, new RegExp("DawnParser\\.drxBarWhy\\(s\\.pend,\\s*c,\\s*\"" + zone + "\"\\)"),
      nm + " does not ask the shared reader with its own zone — a rule on one board is v3.01's defect");
    assert.match(body, new RegExp("const " + v + " = DawnParser\\.drxBarWhy\\([^;]*\\);\\s*"
                               + "if\\(" + v + "\\) return L\\(s, " + v + "\\);"),
      nm + " reads the bar and does not REFUSE on it — the call surviving is not "
      + "the same as the refusal surviving (v4.00, v4.55)");
  }
  /* the HAND door only bars in the DEFENCE window: in the attack window the
     open link is the player's OWN attack, and barring there would refuse a
     card off your own Widowmaker. */
  assert.match(hand, /if\(!inAtk\)\{/, "the hand door must bar only in the defence window");
});

test("and the trainer's half is LATENT — measured, not assumed", () => {
  /* Both doors are only reachable in `mode:"block"`, which `foeSwing`
     enters with the swing FABRICATED as the [3,4,5] escalation — no card,
     so nothing can print the restriction. The same measurement from the
     other end is that both doors already hand `defendValue` a null
     attacking card. The site exists anyway (v3.01) and is drilled with a
     synthetic below (v3.73). */
  const fi = HTML.indexOf("function foeVanilla(s){");
  assert.ok(fi > 0, "foeVanilla moved — re-anchor this premise");
  const foe = HTML.slice(fi, HTML.indexOf("\n  function ", fi + 10));
  assert.ok(foe.length > 500 && /\[3,4,5\]/.test(foe),
    "the anchors no longer bound the fabricated swing (v4.57)");
  assert.ok(!/\bpend\b/.test(foe),
    "foeVanilla now opens a pend: the trainer's half has stopped being latent, "
    + "and this drill should become a driven one");
  assert.match(DOOR_ARS, /atkCard\s*:\s*null/,
    "the arsenal door no longer says the swing has no card — re-measure the latency");
});

test("SYNTHETIC: a link that prints the bar refuses at both doors", {skip}, () => {
  /* The trainer's doors are React closures, so what is driven here is the
     shared BODY they call, with a synthetic `pend` standing in for the link
     the fabricated swing cannot make. Without this the doors' refusal is
     unreachable and a sabotage that deletes either is silent. */
  H.db(); P.fxReset();
  const wm = H.card("Widowmaker", 2);
  const dr = H.card("Put in Context", 3);
  const pend = {card: wm};
  assert.ok(P.drxBarWhy(pend, dr, "hand") && P.drxBarWhy(pend, dr, "arsenal"),
    "the body the trainer's doors call does not bar a synthetic Widowmaker link");
  assert.equal(P.drxBarWhy(null, dr, "hand"), null,
    "and with the fabricated swing (no card) it bars nothing — which is the "
    + "whole reason the trainer's half is latent");
});

/* ============================================================
   RELEASE THE TENSION, DRIVEN AT THE TABLE (v4.69)
   ============================================================ */

/* Azalea decks Release the Tension AND Widowmaker, Dorinthea decks Put in
   Context — so both seats hold cards a ladder game can deal them. The cards
   are spliced in at the window (the stated fixture decision above); the
   grant, the declaration, the stack and the reaction step are all real. */
function tensionWindow(atkName, atkPitch){
  let g = table("drxprobe2", /azalea/i, /dorinthea/i);
  while(g.arsenalFor != null) g = J.reduce(g, {t: "arsenal", uid: null}, g.arsenalFor).state;
  const seat = g.turnPlayer, foe = 1 - seat;
  const rtt = {...H.card("Release the Tension", 1), uid: 9101};
  const atk = {...H.card(atkName, atkPitch), uid: 9102};
  const drA = {...H.card("Put in Context", 3), uid: 9103};
  const drH = {...H.card("Put in Context", 3), uid: 9104};
  let sides = g.sides.slice();
  sides[seat] = {...g.sides[seat], res: 9, ap: 2, hand: [rtt, atk, ...g.sides[seat].hand]};
  sides[foe]  = {...g.sides[foe],  res: 9, hand: [drH, ...g.sides[foe].hand], arsenal: drA};
  g = {...g, sides};
  let n = H.drain(settle(J.reduce(g, {t: "play", uid: rtt.uid, from: "hand"}, seat).state, rtt.uid));
  assert.ok(n.sides[seat].grave.some(c => c.uid === rtt.uid), "fixture: Release the Tension never resolved");
  const granted = (n.sides[seat].buffQ || []).find(b => b.rider && b.rider.noDrx);
  let k = 0;
  n = H.drain(settle(J.reduce(n, {t: "play", uid: atk.uid, from: "hand"}, seat).state, atk.uid));
  while(n.step !== "reaction" && k++ < 30){
    if(n.priority == null) break;
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  }
  assert.equal(n.step, "reaction", "fixture: never reached the reaction step");
  if(n.priority === seat) n = J.reduce(n, {t: "pass"}, seat).state;
  assert.equal(n.priority, foe, "fixture: the defender never got the window");
  assert.equal(n.pend && n.pend.card && n.pend.card.name, atkName, "fixture: the wrong card is on the open link");
  return {n, seat, foe, granted, drA, drH};
}

test("RELEASE THE TENSION: the arrow's link bars the ARSENAL and not the HAND", {skip}, () => {
  const w = tensionWindow("Searing Shot", 1);
  assert.ok(w.granted, "the grant never reached buffQ with its bar");
  assert.equal(w.granted.src, "Release the Tension", "the entry does not name the card that granted the bar");
  const fromArs = J.legal(w.n, {t: "play", uid: w.drA.uid, from: "arsenal"}, w.foe);
  assert.ok(fromArs, "a defence reaction from ARSENAL is still legal — the granted bar has no reader");
  assert.match(fromArs, /Release the Tension/, "the refusal must name the card that granted the bar");
  assert.equal(J.legal(w.n, {t: "play", uid: w.drH.uid, from: "hand"}, w.foe), null,
    "the HAND was barred too — stronger than printed, which is what the refusal existed to stop");
  assert.ok(!(w.n.sides[w.seat].buffQ || []).some(b => b.rider && b.rider.noDrx),
    "the grant was not SPENT by the arrow that took it — it would bar the next link too");
  assert.deepEqual(INV.errors(w.n), [], "the fixture's board is broken");
});

test("…and an attack the grant does not name leaves the arsenal OPEN, and the grant waiting", {skip}, () => {
  /* BOTH HALVES (v3.45). A bar that lands on whatever attacks next passes
     the drill above perfectly — the printed line names the next ARROW. */
  const w = tensionWindow("Snatch", 1);
  assert.equal(J.legal(w.n, {t: "play", uid: w.drA.uid, from: "arsenal"}, w.foe), null,
    "a non-arrow attack collected the arrow's bar — v2.30's arrow buff on a sword");
  assert.ok((w.n.sides[w.seat].buffQ || []).some(b => b.rider && b.rider.noDrx),
    "the grant was spent by an attack it does not name — a qualified grant WAITS (v2.30)");
});

test("SYNTHETIC: a card that prints the NARROW bar on itself bars its own link by zone", {skip}, () => {
  /* LATENT, AND MEASURED: no pool card prints "…from arsenal this chain
     link" as its OWN line — Release the Tension grants it — so the card-level
     narrow bar has no claimant, and a sabotage that ignored its zone came
     back SILENT against every real fixture (v3.73: a synthetic is what sees
     a latent path). `fxParse` forwards whatever `classifyClause` says, so the
     day upstream prints one it must bar the arsenal and leave the hand. */
  H.db(); P.fxReset();
  const syn = {name: "Narrow Bar Synthetic", pitch: 1, cost: 0, power: 4, def: 3,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
               tx: "Defense reactions can't be played from arsenal this chain link.", kw: [], gkw: []};
  assert.equal(P.fxParse(syn).noDrx, "arsenal", "fixture: the narrow line no longer reads on a card");
  const dr = H.card("Put in Context", 3);
  assert.ok(P.drxBarWhy({card: syn}, dr, "arsenal"), "its own narrow bar does not close the arsenal");
  assert.equal(P.drxBarWhy({card: syn}, dr, "hand"), null,
    "its own narrow bar closed the HAND — the zone was ignored");
  P.fxReset();
});
