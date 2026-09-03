/* ============================================================
   CLASH — A WHOLE MECHANIC ON ONE BOARD (v3.94)

     "When this defends, clash with the attacking hero. The winner creates
      a Might token."                            — six pool records
     "…If you win, this gets +1{d} until end of turn." — STONEWALL IMPASSE
     "When you win a clash revealing this, deal 1 damage to the other
      hero."                                     — UNEXPECTED BACKHAND

   SEVEN POOL CARDS, ALL READING `tier: full`, AND AT THE TABLE NOT ONE OF
   THEM DID ANYTHING. `index.html` carried 31 mentions of clash;
   `judge.js` carried ONE and it is a COMMENT — the comment recording that
   clash had fired on the wrong trigger for five versions.

   That is v3.01's shape at the scale of a whole mechanic, and the same
   family as phantasm (v3.00) and ephemeral (v3.82): a keyword carried on
   one board, which no coverage tool and no keyword ledger can express.
   Every clash clause was filed `noop` with a reason naming "the clash
   block" — a reader that exists in the trainer. **The no-op blind spot at
   its purest**, and v3.16's rule (a noop must describe the clause in
   front of it, never a sibling) one board over.

   THREE PAYOFFS WERE INLINE REGEXES over `.tx` — the token name, the
   defence bonus, the revealed card's damage — which is v3.58's "an inline
   reader is a card special-cased", one mechanic over.

   AND THE KEYWORD PREDICATE WAS THE WRONG QUESTION. Measured over the
   pool: `hasKw(c, "clash")` claims SEVEN cards and `printedKw` claims
   NONE, because the database prints no keyword line for it. The seventh
   is **Unexpected Backhand**, an ordinary Brute attack whose text merely
   MENTIONS a clash — and any non-block card may be declared as a
   defender, so the trainer ran a clash off a card that prints no such
   trigger. v2.84's three questions, answered by reading the parsed field
   instead of any of them.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const CLASHERS = [["Clash of Agility", 1], ["Clash of Might", 1], ["Clash of Vigor", 3],
                  ["Stonewall Impasse", 0], ["Test of Might", 1], ["Test of Strength", 1]];

const top = (nm, power) => ({name: nm, uid: nm, pitch: 1, cost: 0, power,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

const unwrap = o => (o && o.game) || o;

/* ---- 1. THE READER --------------------------------------------------- */

test("all six defending clashers are read, each with its own payoff", {skip}, () => {
  const got = {};
  for(const [nm, p] of CLASHERS){
    const cl = P.fxParse(H.card(nm, p)).clash;
    assert.ok(cl, nm + " is read by the PARSER now, not by a regex in index.html");
    got[nm] = cl.token || ("+" + cl.defBuff.amt + "{d} " + cl.defBuff.until);
  }
  assert.deepEqual(got, {
    "Clash of Agility": "Agility", "Clash of Might": "Might", "Clash of Vigor": "Vigor",
    "Test of Might": "Might", "Test of Strength": "Gold",
    "Stonewall Impasse": "+1{d} turn"
  });
});

test("the token name keeps its PRINTED capitalisation", {skip}, () => {
  /* `classifyClause` works on the LOWERCASED clause and `resolveEntry`
     answers the ENTRY's name by design (v2.48) — so a lowercased capture
     rides onto the board and deals the player a card called "might".
     Twelve token names went wrong that way at v3.33; the shape is matched
     on the levelled clause and captured from the RAW one (v3.53). */
  for(const [nm, p] of CLASHERS){
    const t = P.fxParse(H.card(nm, p)).clash.token;
    if(t) assert.match(t, /^[A-Z]/, nm + " → " + t);
  }
});

test("the WINDOW is read off the printed words", {skip}, () => {
  /* Stonewall Impasse prints "until end of turn" and `defMod` is
     chain-scoped — a bonus filed without its window is weaker than
     printed the moment a second chain opens the same turn (v3.87). */
  assert.equal(P.fxParse(H.card("Stonewall Impasse", 0)).clash.defBuff.until, "turn");
  const syn = Object.assign({}, H.card("Stonewall Impasse", 0), {name: "SYN-chain-clash",
    tx: (H.card("Stonewall Impasse", 0).tx || "").replace(" until end of turn", "")});
  assert.equal(P.fxParse(syn).clash.defBuff.until, "chain",
    "and a payoff that names no window gets the default");
});

test("the AMOUNT is read off the line, not hardcoded", {skip}, () => {
  const real = H.card("Stonewall Impasse", 0);
  const syn = Object.assign({}, real, {name: "SYN-clash-3",
    tx: (real.tx || "").replace("+1{d}", "+3{d}")});
  assert.equal(P.fxParse(syn).clash.defBuff.amt, 3);
});

test("UNEXPECTED BACKHAND gets NO `fx.clash` — it is not a defending clasher",
     {skip}, () => {
  /* THE PREDICATE THAT WAS WRONG. `hasKw` matches the raw text as well as
     the keyword list, so it claims this card — whose whole text is a
     REVEAL payoff. It is an ordinary Brute attack and any non-block card
     may be declared as a defender, so the trainer's filter ran a clash
     off a card that prints no such trigger. */
  const ub = H.card("Unexpected Backhand", 3);
  assert.equal(P.hasKw(ub, "clash"), true, "the loose predicate claims it…");
  assert.equal(P.printedKw(ub, "clash"), false, "…and the strict one claims nothing at all");
  assert.equal(P.fxParse(ub).clash, undefined, "so the parsed field is the discriminator");
  assert.deepEqual(P.fxParse(ub).clashReveal, {dmg: 1});
});

test("the whole-pool measurement that makes the predicate the wrong question",
     {skip}, () => {
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const loose = new Set(), strict = new Set(), parsed = new Set();
  for(const c of arr){
    const card = {name: c.name, tt: c.type_text || "", ty: c.types || [],
                  tx: c.functional_text || "", kw: c.card_keywords || []};
    if(P.hasKw(card, "clash")) loose.add(c.name);
    if(P.printedKw(card, "clash")) strict.add(c.name);
    if(P.fxParse(Object.assign({}, card, {pitch: +(c.pitch || 0)})).clash) parsed.add(c.name);
  }
  assert.equal(loose.size, 7, "hasKw claims seven — six clashers and Unexpected Backhand");
  assert.equal(strict.size, 0, "the database prints no keyword line for clash");
  assert.equal(parsed.size, 6, "and the parsed field claims exactly the six that print the trigger");
});

test("an unreadable payoff refuses the whole thing", {skip}, () => {
  /* A clash with no reward is a reveal that decides nothing, filed
     `full` — v2.29's rule, and the no-op blind spot this version is
     about. */
  const real = H.card("Clash of Might", 1);
  const syn = Object.assign({}, real, {name: "SYN-clash-unread",
    tx: (real.tx || "").replace("The winner creates a Might token", "The winner feels good about it")});
  assert.equal(P.fxParse(syn).clash, undefined);
});

/* ---- 2. THE SHARED BODY --------------------------------------------- */

function clash(o){
  o = o || {};
  const cc = Object.assign(H.card(o.card || "Clash of Might", o.card === "Stonewall Impasse" ? 0 : 1),
                           {uid: "cc1"});
  const g = H.state({name: "Alice", deck: [o.mine || top("mine", 6)]},
                    {name: "Bob", deck: [o.theirs || top("theirs", 3)]},
                    {turn: 3, actor: o.actor == null ? 0 : o.actor});
  g.builds = o.builds || [{}, {}];
  return {out: unwrap(H.fx(g, (fx, n) => fx.resolveClash(n, o.defSeat == null ? 0 : o.defSeat, [cc]))),
          cc};
}
const boards = g => [(g.sides[0].board || []).map(b => b.card.name),
                     (g.sides[1].board || []).map(b => b.card.name)];

test("driven: the token goes to the WINNER, on either side", {skip}, () => {
  /* The card says "THE WINNER creates", not "you" — so a clash the
     defender loses hands the token to the attacker. */
  assert.deepEqual(boards(clash({mine: top("m", 6), theirs: top("t", 3)}).out),
                   [["Might"], []]);
  assert.deepEqual(boards(clash({mine: top("m", 3), theirs: top("t", 6)}).out),
                   [[], ["Might"]]);
});

test("driven: a TIE is no winner", {skip}, () => {
  /* CONFIRMED (user, 2026-08-19), so it is settled rather than assumed. */
  const out = clash({mine: top("m", 4), theirs: top("t", 4)}).out;
  assert.deepEqual(boards(out), [[], []]);
  assert.match(out.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" "),
               /a tie, no winner/);
});

test("driven: an EMPTY DECK reveals nothing and counts as zero", {skip}, () => {
  const cc = Object.assign(H.card("Clash of Might", 1), {uid: "cc1"});
  const g = H.state({name: "Alice", deck: []}, {name: "Bob", deck: [top("t", 1)]},
                    {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.fx(g, (fx, n) => fx.resolveClash(n, 0, [cc])));
  assert.deepEqual(boards(out), [[], ["Might"]], "0 loses to 1");
});

test("driven: Stonewall Impasse's bonus is a defMod, with its printed window",
     {skip}, () => {
  /* IT IS NOT A LOCAL ANY MORE. The trainer summed a `clashDef` number
     and passed it to `finishBlock`; at the table there was nothing at
     all. As a `defMod` keyed by uid (v3.89) BOTH walls read it through
     `defendValue` and neither caller has to be told. */
  const won = clash({card: "Stonewall Impasse", mine: top("m", 6), theirs: top("t", 3)});
  assert.deepEqual(won.out.sides[0].defMod, [{uid: "cc1", d: 1, until: "turn"}]);
  const lost = clash({card: "Stonewall Impasse", mine: top("m", 3), theirs: top("t", 6)});
  assert.deepEqual(lost.out.sides[0].defMod, [],
    '"IF YOU win" — a lost clash braces nothing');
});

test("driven: and the wall actually counts it", {skip}, () => {
  /* A modifier nothing spends is the no-op blind spot wearing a number.
     `defendValue` is the one reader of what a defender is worth (v3.23),
     so this is the observable. */
  const won = clash({card: "Stonewall Impasse", mine: top("m", 6), theirs: top("t", 3)});
  const E = require("../engine/effects.js");
  const base = E.defendValue(won.out.sides[0], won.cc, {base: won.cc.def || 0});
  const printed = won.cc.def || 0;
  assert.equal(base, printed + 1, "printed " + printed + " defends for one more");
});

test("driven: the turn-scoped bonus survives the CHAIN and dies with the TURN",
     {skip}, () => {
  /* THE WHOLE POINT OF READING THE WINDOW. `closeChainGrants` sweeps
     Shred's "this combat chain" debuff; this one prints "until end of
     turn" and must outlive it, or a second chain the same turn silently
     loses a bonus the card grants. */
  const won = clash({card: "Stonewall Impasse", mine: top("m", 6), theirs: top("t", 3)}).out;
  const afterChain = H.fx(won, (fx, n) => n);   /* keep the shape */
  const closed = require("../engine/effects.js").closeChainGrants(won);
  assert.deepEqual(closed.sides[0].defMod, [{uid: "cc1", d: 1, until: "turn"}],
    "the chain closing does not touch it");
  const ended = require("../engine/effects.js").beginEndPhase(
    Object.assign({}, closed, {phase: "end"}), 0, H.db());
  assert.deepEqual((ended.game || ended).sides[0].defMod, [],
    "…and the end phase does");
  assert.ok(afterChain);
});

test("driven: a CHAIN-scoped defMod still dies at the close step", {skip}, () => {
  /* the control — Shred's window, unchanged by v3.94 */
  const g = H.state({name: "A"}, {name: "B"}, {turn: 3});
  const with_ = H.fx(g, (fx, n) =>
    fx.applyDefMod ? n : n);   /* applyDefMod is internal; use the op path below */
  assert.ok(with_);
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {defMod: [{uid: "x", d: -2}]});
  const closed = require("../engine/effects.js").closeChainGrants(Object.assign({}, g, {sides}));
  assert.deepEqual(closed.sides[0].defMod, [], "an entry with no window is chain-scoped");
});

test("driven: the revealed card pays off for WHOEVER won", {skip}, () => {
  /* The trainer only ever looked at the DEFENDER's revealed card, so an
     attacker who won a clash revealing Unexpected Backhand dealt nothing.
     "The OTHER hero" is the loser. */
  const ub = () => Object.assign(H.card("Unexpected Backhand", 3), {uid: "ub"});
  const def = clash({mine: ub(), theirs: top("t", 1)}).out;
  assert.equal(def.sides[1].hp, 20 - 1, "the defender won revealing it — the attacker takes 1");
  const atk = clash({mine: top("m", 1), theirs: ub()}).out;
  assert.equal(atk.sides[0].hp, 20 - 1, "and the other way round");
  const lost = clash({mine: ub(), theirs: top("t", 99)}).out;
  assert.equal(lost.sides[1].hp, 20, "revealed on a LOSS, it pays nothing");
});

test("driven: the actor is BORROWED and handed back", {skip}, () => {
  /* Inside a link the actor is the ATTACKER, and clash belongs to the
     DEFENDER — a body that leaves the actor moved corrupts every rule
     after it in the same resolution (v3.46's `allyDeath`). */
  for(const [actor, defSeat] of [[0, 1], [1, 0], [0, 0]]){
    const out = clash({actor, defSeat, mine: top("m", 6), theirs: top("t", 3)}).out;
    assert.equal(out.actor, actor, "actor " + actor + ", defender " + defSeat);
  }
});

test("driven: each revealed card is read with its OWN owner's build", {skip}, () => {
  /* The top of a DECK is a zone other than the combat chain, so Kayo's
     clause 2 reaches it. One shared build applies the revealer's passive
     to the opponent's card. */
  const kayo = {atkPowOffChain: 1};
  const out = clash({mine: top("m", 5), theirs: top("t", 6), builds: [kayo, {}]}).out;
  assert.deepEqual(boards(out), [[], []], "5 (+1) vs 6 is a tie, not a loss");
  const flip = clash({mine: top("m", 5), theirs: top("t", 6), builds: [{}, kayo]}).out;
  assert.deepEqual(boards(flip), [[], ["Might"]], "and with the passive on the other side, they win");
});

test("driven: a GEAR clasher fires — Stonewall Impasse is EQUIPMENT", {skip}, () => {
  /* THE SABOTAGE THAT DROPS `gearWall` FROM THE SCAN CAME BACK SILENT
     until this existed: every other drill here declares a card from HAND.
     Stonewall Impasse is the pool's only clasher on equipment, and it is
     one of the four gear "when this defends" records v3.90 found that
     NEITHER board could reach. A scan written for one zone is exactly how
     three cards came to be dead in the other (v3.33, v3.55, v3.72). */
  const piece = Object.assign(H.card("Stonewall Impasse", 0), {uid: "gp1"});
  const g = H.state({name: "Alice", deck: [top("mine", 1)]},
                    {name: "Bob", gear: [piece], deck: [top("theirs", 9)]},
                    {turn: 3, actor: 0});
  g.builds = [{}, {}];
  /* the attacker is the actor; `afterDefenders` hands the DEFENDER's seat
     and both kinds of declared defender */
  const out = unwrap(H.fx(Object.assign({}, g, {_declared: {card: top("atk", 5)}}),
    (fx, n) => fx.afterDefenders(n, [], [piece])));
  assert.deepEqual(out.sides[1].defMod, [{uid: "gp1", d: 1, until: "turn"}],
    "the gear clasher won and braced");
  assert.match(out.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | "),
               /Stonewall Impasse clashes/);
});

test("driven: a card that only MENTIONS a clash runs none", {skip}, () => {
  /* THE PREDICATE SABOTAGE CAME BACK SILENT until this existed. Asserting
     what `hasKw` and `fx.clash` ANSWER cannot tell a reader that asks the
     right question from one that asks the wrong one — only declaring the
     card as a defender can. Unexpected Backhand is an ordinary Brute
     attack and any non-block card may block, so this is a real board
     state, not a synthetic one. */
  const ub = Object.assign(H.card("Unexpected Backhand", 3), {uid: "ub1"});
  const g = H.state({name: "Alice", deck: [top("mine", 9)]},
                    {name: "Bob", deck: [top("theirs", 1)]}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.fx(g, (fx, n) => fx.resolveClash(n, 0, [ub])));
  assert.deepEqual(boards(out), [[], []], "no token — it prints no clash trigger");
  assert.equal(out.sides[0].hp, 20, "and nobody was dealt anything");
  assert.equal(out.sides[1].hp, 20);
  assert.ok(!/clashes —/.test(out.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" ")),
    "and the feed does not claim a clash happened");
  /* the control: a REAL clasher in the same state does fire */
  const cm = Object.assign(H.card("Clash of Might", 1), {uid: "cm9"});
  const ok = unwrap(H.fx(g, (fx, n) => fx.resolveClash(n, 0, [cm])));
  assert.deepEqual(boards(ok), [["Might"], []], "so the refusal above is the READING");
});

/* ---- 3. AT THE TABLE, THROUGH THE REAL REDUCER ----------------------- */

test("driven at the TABLE: a declared clash card resolves its clash", {skip}, () => {
  /* THE BOARD THAT HAD NOTHING. Sixteen drills that call `resolveClash`
     directly would all pass on an engine where no board ever calls it —
     v3.20's condemn lesson, and v3.89's. Drive the real entry point. */
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("clash-table");
  const h0 = W.HEROES.find(x => x.k === "dorinthea"), h1 = W.HEROES.find(x => x.k === "bravo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.dorinthea), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.bravo), H.db(), rng, ctr);
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng: b1.rng, first: 0, tokSeq: ctr.n});
  const cc = Object.assign(H.card("Clash of Might", 1), {uid: "CLASH1"});
  const atk = Object.assign(H.card("Wounded Bull", 1), {uid: "ATK1"});
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {hand: [atk], res: 9, ap: 1, deck: [top("mine", 2)]});
  sides[1] = Object.assign({}, sides[1], {hand: [cc], deck: [top("theirs", 8)]});
  g = Object.assign({}, g, {sides, phase: "action", step: "layer", priority: 0, passed: [], stack: []});

  const step = (a, seat) => { const r = J.reduce(g, a, seat); assert.ok(!r.error, JSON.stringify(a) + ": " + r.error); g = r.state; };
  step({t: "play", uid: "ATK1", from: "hand", target: "hero"}, 0);
  for(let i = 0; i < 6 && g.step !== "defend"; i++) step({t: "pass"}, g.priority == null ? 0 : g.priority);
  assert.equal(g.step, "defend");
  step({t: "defend", uid: "CLASH1"}, 1);
  for(let i = 0; i < 4 && g.step === "defend"; i++) step({t: "pass"}, g.priority == null ? 0 : g.priority);

  assert.equal(g.step, "reaction", "the wall is final and the trigger has fired");
  assert.deepEqual((g.sides[1].board || []).map(b => b.card.name), ["Might"],
    "seat 1 won the clash — and before v3.94 the table created nothing at all");
  assert.deepEqual((g.sides[0].board || []).map(b => b.card.name), []);
  const feed = g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");
  assert.match(feed, /clashes —/, "and it said so");
});

/* ---- 3b. THE TRAINER CALLS THE SHARED BODY --------------------------- */

test("the trainer's block path calls `resolveClash` and reads no card text",
     {skip}, () => {
  /* `takeIt` is a React closure and no drill can reach it, so this is a
     SOURCE guard — the same shape `staunch.test.js` uses for the trainer's
     wall. What it pins is the thing that was wrong: 30 lines of clash and
     three inline regexes over `.tx` lived here and nowhere else.

     BOTH DIRECTIONS OF COMBAT NEED IT. `afterDefenders` covers the one
     where the player attacks and the dummy blocks; `takeIt` is the other,
     which is most of the trainer. */
  const fs = require("fs"), path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
  const code = strip(html);
  assert.match(code, /_EFX\.resolveClash\(s, actorOf\(s\),/,
    "takeIt must hand the shared body its wall and the DEFENDER's seat");
  /* and the three inline readers are gone */
  assert.ok(!/the winner creates\?/.test(code), "the token regex is the parser's now");
  assert.ok(!/if you win, this gets/.test(code), "and the defence bonus");
  assert.ok(!/when you win a clash revealing this/.test(code), "and the reveal payoff");
  assert.ok(!/clashDef/.test(code),
    "the defence bonus is a `defMod` the wall already reads, not a local term");
});

/* ---- 4. NO CARD IS NAMED --------------------------------------------- */

test("no clash card is named anywhere in the engine or the trainer", {skip}, () => {
  const fs = require("fs"), path = require("path");
  const files = ["engine/effects.js", "engine/parser.js", "engine/judge.js", "index.html"];
  for(const f of files){
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for(const [nm] of CLASHERS.concat([["Unexpected Backhand"]])){
      /* the deck lists in index.html name every card, by design */
      const hits = (src.match(new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      /* the DECK LISTS in index.html name every card by design, and a
         card printed at two pitches appears on two lines */
      const allowed = f === "index.html" ? 3 : 0;
      assert.ok(hits <= allowed, nm + " appears " + hits + " times in " + f);
    }
  }
});
