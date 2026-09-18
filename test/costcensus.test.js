/* ============================================================
   EVERY ATOM OF A PRINTED ACTIVATION COST IS ACCOUNTED FOR (v4.55)

   `tools/ledger.js` does this for KEYWORDS, `tools/approx.js` for the
   RULES MACHINE, `test/fxcensus.test.js` for the parse's own fields and
   `test/condcensus.test.js` for conditions. **Nothing asked it of a
   COST** — and a cost is the half of an activated ability where being
   wrong is free value rather than a missing feature (v2.04).

   IT FOUND ONE, AND IT WAS LIVE:

       "Instant - Destroy this AND A RUNECHANT YOU CONTROL: Prevent the
        next 1 arcane damage that would be dealt to you this turn."
                                    — RUNEBLEED ROBE, Viserai's Chest

   `parseHeroPower` answered BYTE-IDENTICALLY to a control printing only
   "Destroy this:" — same cost, same `sd`, same label. The second half of
   the printed cost was simply dropped, so the ability shattered the piece
   and left the Runechant on the board. In the one hero whose engine IS
   Runechants, each one kept is a point of arcane damage on the next swing
   that the card had already charged for. **Stronger than printed.**

   NO OTHER TOOL HERE COULD SEE IT. The activation line is filed `noop`
   (its reader is the powCard, which is correct), so the card reads
   `tier: full` and coverage counts the text accounted for; and the
   one-sided fairness sweep models a PAYLOAD read too generously, never a
   COST that was skipped (v4.27's fusion, one verb over).

   THE CENSUS IS DRIVEN, NOT A TABLE OF REGEXES AGAINST REGEXES. Each
   atom names the FLAG or the NAMED READER that accounts for it, and the
   assertion is that the engine's real parse carries it — v3.56's rule,
   because a pattern compared to a pattern is green against any engine.
   Verified by running it against the pre-fix parser: the Robe's
   `destroyBoard` atom is unclaimed and the drill goes RED.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const {loadData, poolPath} = require("./helpers/extract.js");
const fs = require("fs");

const skip = !H.hasDb() && "no cached card database";

/* The pinned pool, read directly — this census is about what the POOL
   prints and needs no live database (v4.17). */
const POOL = JSON.parse(fs.readFileSync(require("path")
  .join(__dirname, "..", "data", "pool.json"), "utf8"));

const clean = t => (t||"").replace(/\*\*?/g,"").replace(/__?/g,"").replace(/\s+/g," ").trim();
/* `parseHeroPower`'s own anchor, so the census reads exactly the strings
   that reader is handed — a scan aimed at a neighbouring shape passes by
   finding nothing (v3.81, v4.07). */
const RX = /(?:^|[^a-z])(?:once per turn )?(?:attack reaction|action|instant)\s*[-—]*\s*([^:]{0,40}?):/i;

/* ---- THE ATOM TABLE ------------------------------------------------- *
   Each row is a printed atom and the thing that ACCOUNTS for it. `flag`
   is read off the real parse; `reader` names a DIFFERENT function that
   answers instead (the tap is `tapsToActivate`'s, and carrying it on the
   powCard a second time would be two records of one fact — v3.86).
   `latent` means no pool record of that atom parses today, so nothing is
   claimed about it and a drill below pins that it stays refused.        */
const ATOMS = [
  {rx: /^(\{r\})+$/i,                                   flag: "cost"},
  {rx: /^(\{c\})+$/i,                                   flag: "chi"},
  {rx: /^\d+$/,                                         flag: "cost"},
  {rx: /^\{t\}$/i,                                      reader: "tapsToActivate"},
  {rx: /^destroy this$/i,                               flag: "sd"},
  {rx: /^destroy (?:a|an|one) ([A-Za-z'’ -]+) you control$/i, flag: "destroyBoard"},
  {rx: /^discard (?:a|an|another) [a-z][a-z -]*$/i,     flag: "discardCost"},
  {rx: /^banish (?:this and )?(?:a|an|one|two|three|\d+) cards? from your (?:hero'?s? )?soul$/i,
                                                        flag: "soul"},
  {rx: /^remove (?:x|a|an|\d+) [a-z]+ counters? from [a-z]+$/i, flag: "ctr"},
  {rx: /^turn this face-?up$/i,                         flag: "flipUp"},
  /* LATENT — printed, and this reader refuses the whole line. Each is an
     honest gap rather than a half-read cost: weaker than printed and
     visible in the audit (v2.29). */
  {rx: /^\{t\} your hero$/i,                            latent: "a tap of the HERO, not the permanent"},
  {rx: /^discard this$/i,                               latent: "a card in HAND paying for its own ability"},
  {rx: /^(\{x\})+(\{r\})*$/i,                           latent: "an X cost (tools/approx.js: x-cost)"},
  {rx: /^put (?:a|an|\d+) [a-z]+ counters? on this$/i,  latent: "a counter PUT as a price"},
];
/* TWO ATOMS ARE DESCRIBED BY A GENERAL SIBLING AND STILL REFUSE, AND THAT
   IS NOT A LATENT ROW. Teklovossen's "banish 2 cards from your soul" is
   claimed by the soul row (whose count alternation already includes a
   digit) and the Gun's "remove a steam counter from this" by the counter
   row — both are atoms this reader CAN name, on records it refuses for a
   reason elsewhere in the line (v4.49, v4.50). A latent row for either
   would be a table entry nothing reaches, which is the dead-rules-code
   shape this file exists to catch (v4.11) — found in this drill's own
   first draft, by the pin below failing. */

/* ONE PRINTED COST, TWO OBJECTS, ONE SHARED VERB. "Destroy this and a
   Runechant you control" is not two costs — it is one, and the second
   object has no verb of its own, so the split restores it before asking.
   Without this the whole string reaches the table as a single atom and
   nothing describes it, which reads as a census fault rather than as the
   two things it is. */
const atomsOf = cost =>
  cost.replace(/^destroy this and /i, "destroy this, destroy ")
      .split(/,\s*/).map(a => a.trim()).filter(Boolean);

const rowOf = a => ATOMS.find(r => r.rx.test(a)) || null;

/* Every distinct printed cost, with the records that print it. */
function costs(){
  const out = new Map();
  for(const c of POOL){
    const m = clean(c.functional_text).match(RX);
    if(!m) continue;
    const cost = (m[1] || "").trim();
    if(!out.has(cost)) out.set(cost, []);
    out.get(cost).push(c);
  }
  return out;
}

/* ---- 1. THE SCAN IS ALIVE ------------------------------------------ */

test("the census reaches the pool's activation costs at all", () => {
  /* A SCAN AIMED AT THE WRONG SHAPE PASSES BY FINDING NOTHING (v3.81,
     v4.07), and every claim below is vacuous if this one is. */
  const cs = costs();
  const records = [...cs.values()].reduce((t, v) => t + v.length, 0);
  assert.ok(cs.size >= 25, "distinct printed activation costs: " + cs.size);
  assert.ok(records >= 95, "records printing one: " + records);
  assert.ok(cs.has("Destroy this"), "the commonest cost is found");
  assert.ok(cs.has("Destroy this and a Runechant you control"),
            "and so is the compound one this file exists for");
});

/* ---- 2. EVERY ATOM IS DESCRIBED ------------------------------------ */

test("every printed cost atom is named by the table", () => {
  const orphans = [];
  for(const [cost] of costs())
    for(const a of atomsOf(cost))
      if(!rowOf(a)) orphans.push(cost + "  ->  " + JSON.stringify(a));
  assert.deepEqual(orphans, [],
    "a printed cost atom nothing here describes — decide what reads it, "
    + "or record it latent:\n  " + orphans.join("\n  "));
});

/* ---- 3. AND THE ENGINE CARRIES IT — THE DRIVEN HALF ---------------- */

test("every atom of an ACCEPTED cost is carried by the real parse", {skip}, () => {
  /* THIS IS THE ONE THAT BITES. Asked of the table alone it is a pattern
     compared to a pattern; asked of `parseHeroPower`'s answer it fails
     the day a reader drops half a printed cost — which is exactly what
     the Robe did, byte-identically to a bare "destroy this". */
  const faults = [];
  for(const [cost, recs] of costs()){
    for(const c of recs){
      const hp = P.parseHeroPower(c.functional_text, true);
      if(!hp) continue;                      /* refused — section 4 */
      for(const a of atomsOf(cost)){
        const row = rowOf(a);
        if(!row || row.latent) continue;
        if(row.reader === "tapsToActivate"){
          if(!P.tapsToActivate(c.functional_text))
            faults.push(c.name + ": " + JSON.stringify(a) + " — tapsToActivate says no");
          continue;
        }
        const v = hp[row.flag];
        const set = row.flag === "cost" ? (v || 0) > 0 || /^0$/.test(a) : !!v;
        if(!set) faults.push(c.name + ": " + JSON.stringify(cost)
          + " — atom " + JSON.stringify(a) + " has no `" + row.flag + "` on the parse");
      }
    }
  }
  assert.deepEqual(faults, [],
    "an accepted activation cost with a printed atom the parse does not "
    + "carry is a cost paid for free:\n  " + faults.join("\n  "));
});

/* ---- 4. A LATENT ATOM STILL REFUSES -------------------------------- */

test("a cost carrying a latent atom is REFUSED, never read half-way", {skip}, () => {
  /* READ WHOLE OR REFUSE (v2.29). Each of these is printed and unread,
     and the honest state is that the whole line refuses — so the ability
     is never offered rather than offered at a discount. Pinned BOTH ways
     (v4.17): a latent atom that starts parsing is a deliberate edit. */
  const leaks = [];
  for(const [cost, recs] of costs()){
    const lat = atomsOf(cost).map(rowOf).filter(r => r && r.latent);
    if(!lat.length) continue;
    for(const c of recs)
      if(P.parseHeroPower(c.functional_text, true))
        leaks.push(c.name + ": " + JSON.stringify(cost) + " — " + lat[0].latent);
  }
  assert.deepEqual(leaks, [],
    "a cost with an unread atom is being accepted:\n  " + leaks.join("\n  "));
});

/* ---- 5. THE READERS ARE PINNED BOTH DIRECTIONS --------------------- */

test("every non-latent atom has a pool claimant, and the set is pinned", () => {
  /* A READER WITH NO CLAIMANT IS DEAD RULES CODE THAT READS LIKE A RULE
     (v4.11, v4.50, v4.52). Pinning only the claimed half cannot see a
     name LEAVING the list (v4.12, v4.29), so both go in. */
  const claimed = new Set(), latent = new Set();
  for(const [cost] of costs())
    for(const a of atomsOf(cost)){
      const r = rowOf(a);
      if(!r) continue;
      (r.latent ? latent : claimed).add(r.latent || r.flag || r.reader);
    }
  assert.deepEqual([...claimed].sort(),
    ["chi","cost","destroyBoard","discardCost","ctr","flipUp","sd","soul","tapsToActivate"].sort(),
    "the cost readers the pool reaches");
  assert.deepEqual([...latent].sort(), [
    "a card in HAND paying for its own ability",
    "a counter PUT as a price",
    "a tap of the HERO, not the permanent",
    "an X cost (tools/approx.js: x-cost)",
  ].sort(), "and the ones it prints and this reader refuses");
});

/* ============================================================
   6. RUNEBLEED ROBE, DRIVEN — the card the census found (v4.55)

   The whole build was the PARSER. `build.equipPiece` has stamped
   `_destroyBoard` since v3.86 (as a latent guard — its own comment says
   "no pool EQUIPMENT prints this cost today", which is the measurement
   this version moves), `judge.abCostWhy` and the trainer's `tryPlay` both
   refuse a cost that names a permanent the seat does not control, and
   `effects.execute` destroys it into the turn-stamped graveyard through
   `payLeave`. Before building machinery for a shape, check whether the
   machinery is the shape you already have (v3.58, v3.73).
   ============================================================ */

const ROBE_TX = "**Instant** - Destroy this and a Runechant you control: Prevent "
              + "the next 1 arcane damage that would be dealt to you this turn."
              + "\n\n**Arcane Barrier 1**";

test("the second object of the cost is READ, and the first still is", () => {
  const hp = P.parseHeroPower(ROBE_TX, true);
  assert.ok(hp, "the line parses");
  assert.equal(hp.sd, true, "destroy THIS — the piece still pays");
  assert.equal(hp.destroyBoard, "Runechant", "and so does the named permanent");
  assert.equal(hp.kind, "instant");
  assert.match(hp.label, /destroy this and a Runechant/,
    "the label says both halves — it is what the sheet shows the player");
});

test("Gravy Bones' cost is the CONTROL and does not move", () => {
  /* The pool's other named-permanent cost (v3.86). Its verb follows a pip
     so the printing lowercases it, and the widening that reads the Robe's
     capitalised one must leave his answer byte-identical. */
  const hp = P.parseHeroPower("**Instant** - {t}, destroy a Gold you control: "
    + "Draw a card, then discard a card.", true);
  assert.deepEqual(hp, {cost: 0, ga: false, sd: false, kind: "instant",
    destroyBoard: "Gold", eff: "Draw a card, then discard a card",
    label: "destroy a Gold: Draw a card, then discard a card"});
});

test("the VERB varies in case and the NAME must not — `/i` is not the fix", () => {
  /* THE CASE-SENSITIVITY THREE TOKENS LATER IS LOAD-BEARING (v3.53). A
     proper noun is the only thing separating a token's NAME from a common
     noun, so `[A-Z]` on the name is what refuses "a card you control" —
     and an `/i` flag that reads the verb's two printed cases would take
     that guard down with it. Both halves asserted, or the drill cannot
     tell a widening from a collapse. */
  assert.equal(P.parseHeroPower(ROBE_TX, true).destroyBoard, "Runechant",
    "the capitalised verb reads");
  assert.equal(P.parseHeroPower("**Instant** - {t}, destroy a Gold you control: "
    + "Draw a card.", true).destroyBoard, "Gold", "and so does the lowercase one");
  const common = P.parseHeroPower("**Instant** - Destroy this and a card you "
    + "control: Draw a card.", true);
  assert.equal(common, null,
    "a lowercase common noun is not a name — and the line REFUSES rather "
    + "than reading as a bare `destroy this` at a discount");
});

test("READ WHOLE OR REFUSE — an unnameable second object refuses", () => {
  /* v2.29. `sd` is a LOOSE test for the word "destroy" anywhere in the
     cost, which is exactly what let the Robe fall through to the generic
     reader and pay half its printed price. Half a cost paid is the
     free-ability bug v2.04 fixed, one object over.

     SYNTHETIC, because the pool prints one record of the shape and the
     new branch reads it (v3.73). */
  for(const tail of ["a card you control", "two Runechants you control",
                     "the top card of your deck", "a Gold"])
    assert.equal(P.parseHeroPower("**Instant** - Destroy this and " + tail
      + ": Draw a card.", true), null, "refused: destroy this and " + tail);
  /* THE POSITIVE CONTROL. A guard that refuses everything passes the four
     rows above perfectly (v3.98: ask for the refusal AND for the match). */
  assert.ok(P.parseHeroPower("**Instant** - Destroy this: Draw a card.", true),
    "a bare `destroy this` is untouched");
});

test("`allowDestroy` gates the new half — a hero destroying THIS is the hero",
     () => {
  /* v4.14's gate, its sibling owed (v3.43: a guard belongs to the SHAPE,
     not to the version that wrote it). The branch never had to ask while
     it always answered `sd: false`; the moment it can answer TRUE it
     inherits the question. LATENT — measured, no pool HERO prints the
     shape — so the fixture is synthetic, and the first draft without the
     gate handed a hero record a self-destroying cost where the OLD reader
     had refused outright. */
  assert.ok(P.parseHeroPower(ROBE_TX, true), "an equipment may destroy itself");
  assert.equal(P.parseHeroPower(ROBE_TX, false), null,
    "a hero may not — the builder passes false and this branch must honour it");
  /* AND THE HALF WITHOUT "this and" IS UNGATED, because it destroys
     something else: Gravy Bones is a HERO and his ability is built. */
  assert.ok(P.parseHeroPower("**Instant** - {t}, destroy a Gold you control: "
    + "Draw a card.", false), "a hero destroying a NAMED permanent is fine");
});

/* ---- the route, on a real board ------------------------------------- */

function robeTable(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "robe");
  const h0 = W.HEROES.find(x => x.k === "viserai"), h1 = W.HEROES.find(x => x.k === "kayo");
  /* THE LOADOUT IS SEATED EXPLICITLY, AND THAT IS THE RECORDED REASON THE
     ROUTE READS ZERO ON THE LADDER. `defaultPicks` ranks a chest slot by
     printed defence and takes Beckoning Haunt (2) over the Robe (0), so a
     driven game never wears it — v4.43's Hope Merchant's Hood, v4.49's
     Gun and v4.52's Silent Stilettos, fourth outing. A player picks it on
     the loadout screen, which is the route this fixture takes. */
  const b0 = B.buildSide(h0, G.parseDeck(W.DECKS.viserai), H.db(),
    {chest: "Runebleed Robe"}, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  const g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
    heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const board = [];
  for(let i = 0; i < (o.runes == null ? 1 : o.runes); i++)
    board.push({uid: "rune" + i, kind: "aura", spent: false,
      card: Object.assign({}, H.card("Runechant", 0), {uid: "rune" + i})});
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {board, res: 0});
  const gg = Object.assign({}, g, {sides});
  return {g: gg, robe: (sides[0].gear || []).find(x => /Runebleed/.test(x.name))};
}

test("`defaultPicks` does NOT wear it, which is why the ladder reads zero",
     {skip}, () => {
  /* THE PREMISE OF THE FIXTURE ABOVE, AS A DRILL (v4.43). A
     `defaultPicks` that starts ranking by card text has to re-measure
     this recorded reason rather than leave the sentence standing. */
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "viserai");
  const d = B.buildSideDefault(h, G.parseDeck(W.DECKS.viserai), H.db(),
    RNG.make("picks"), {n: 0}).b;
  assert.equal((d.gear || []).some(x => /Runebleed/.test(x.name)), false,
    "the default chest is not the Robe");
  /* AND IT IS REACHABLE FROM HIS LIST, which is what makes the fixture
     above a real line of play rather than an invented one. `buildSide`
     with an explicit pick equips it; a bare `{}` is not the control here
     — `defaultPicks` runs for that too. */
  const picked = B.buildSide(h, G.parseDeck(W.DECKS.viserai), H.db(),
    {chest: "Runebleed Robe"}, RNG.make("picks2"), {n: 0}).b;
  assert.equal((picked.gear || []).some(x => /Runebleed/.test(x.name)), true,
    "a player who picks it wears it");
  assert.equal(G.parseDeck(W.DECKS.viserai).gear
    .some(e => /Runebleed/.test(e.name)), true,
    "and his printed list is where they find it");
});

test("the powCard carries both halves of the cost", {skip}, () => {
  const t = robeTable({});
  assert.ok(t.robe, "the Robe is equipped");
  assert.ok(t.robe.powCard, "and it has an ability powCard at all");
  assert.equal(t.robe.powCard.sd, true);
  assert.equal(P.abDestroyBoard(t.robe.powCard), "Runechant",
    "`_destroyBoard` is stamped by `equipPiece` — latent since v3.86, live now");
});

test("with no Runechant the activation is REFUSED, not resolved", {skip}, () => {
  /* A COST IS A LEGALITY (v3.11). Refusing afterwards costs the player
     the piece for a play the rules never allowed. */
  const t = robeTable({runes: 0});
  const why = J.legal(t.g, {t: "activate", uid: t.robe.uid}, 0);
  assert.ok(why, "it must be refused");
  assert.match(String(why), /Runechant/, "and the refusal NAMES the cost: " + why);
  /* AND THE PIECE SURVIVES THE REFUSAL. */
  assert.equal((t.g.sides[0].gear || []).some(x => x.destroyed), false);
});

test("DRIVEN: the Runechant is destroyed, the piece shatters, the ward lands",
     {skip}, () => {
  const t = robeTable({runes: 1});
  assert.equal(J.legal(t.g, {t: "activate", uid: t.robe.uid}, 0), null, "legal");
  const n = J.reduce(t.g, {t: "activate", uid: t.robe.uid}, 0).state;
  /* ASSERT ON ZONES, LIFE AND COUNTERS — never on the feed (v2.45). */
  assert.equal(n.sides[0].board.length, 0, "the Runechant left the arena");
  assert.equal(n.sides[0].grave[0].name, "Runechant", "it reached the graveyard");
  assert.equal(n.sides[0].grave[0]._gy, n.turn,
    "TURN-STAMPED, or the whole \"…this turn\" family goes quietly wrong (v3.54)");
  assert.equal(n.sides[0].awd, 1, "the printed 1 arcane prevention landed");
  assert.equal(n.sides[0].awdTurn, 1,
    "and it carries its printed window, so the end phase expires it (v4.07)");
  assert.equal((n.sides[0].gear || []).some(x =>
    /Runebleed/.test(x.name) && x.destroyed), true, "the piece shattered too");
  assert.deepEqual(INV.errors(n), [], "the board is clean");
});

test("the cost is not free — a second activation has nothing left to pay with",
     {skip}, () => {
  /* THE WHOLE DEFECT, STATED AS A GAME FACT. Before this the Runechant
     survived the activation, so Viserai kept a point of arcane damage on
     his next swing that the card had already charged him for. */
  const t = robeTable({runes: 1});
  const n = J.reduce(t.g, {t: "activate", uid: t.robe.uid}, 0).state;
  assert.equal(P.runeCount(n.sides[0]), 0,
    "no Runechant survives the cost — it is spent, not merely named");
});

test("the trainer asks the same two readers, LIVE", () => {
  /* v3.01's shape: a rule that exists on one board only. `abCostWhy` is
     judge's one body and `index.html`'s `tryPlay` asks the same pair of
     parser readers, so the Robe cannot be free on the board a player uses.

     THE REACH OF THIS SCAN IS STATED (v4.44). `Battle` is React closures
     inside `index.html`, so no drill here can DRIVE its `tryPlay` from
     Node — what a scan can honestly carry is that the call is present AND
     NOT NEUTERED. **THE FIRST DRAFT PINNED THE BARE NAME AND ITS SABOTAGE
     CAME BACK SILENT**: `if(… && false)` keeps every identifier intact,
     which is v4.00's defect verbatim and v4.54's own lesson one cost over.
     So the WHOLE CONDITIONAL is pinned, opening paren included.

     COMMENTS STRIPPED, with the stripper's control routed THROUGH the scan
     (v4.27, v4.32) — this project's own prose names the readers it
     forbids reaching for, and a raw scan reports that sentence as the
     code. Built by concatenation, because written as a literal the control
     appears in THIS file rather than in the one being scanned. */
  const raw = fs.readFileSync(require("path")
    .join(__dirname, "..", "index.html"), "utf8");
  const src = raw.split("\n").filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join("\n");
  const CONTROL = "{ const _dn = DawnParser." + "abDestroyBoard(card);";
  assert.ok(src.indexOf(CONTROL) >= 0,
    "tryPlay reads the named-permanent cost off the ability it is offering");
  assert.ok(src.indexOf("if(_dn && !DawnParser." + "boardEntryNamed(act(s), _dn))") >= 0,
    "and refuses WHICH permanent, live — a bare name test passes against "
    + "a neutered guard, which is how this drill was weak on its first pass");
});
