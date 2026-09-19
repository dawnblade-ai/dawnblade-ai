/* ============================================================
   "WHEN THIS DEFENDS" IS ONE BODY, AND THE TRAINER HAD TWO WALLS (v4.57)

   Four families fire on a card that has been DECLARED as a defender —
   clash, `optCost`, `millCost` and `payCost` — and `effects.afterDefenders`
   has carried all four since v4.53. That function is the ATTACKER's path.

   The trainer has a SECOND wall. When the PLAYER blocks, `takeIt` totals it,
   and that path called `resolveClash` plus a hand-rolled `payCost` scan and
   nothing else. So of the four families, the wall the player raises — which
   in the trainer is most of the game — reached TWO:

     Crash and Bash   optCost  x3   Bravo's Guardian Block   never offered
     Washed Up Wave   millCost x1   Gravy Bones' Arms        never offered

   v3.01's shape with the boards swapped, recorded as
   `trainer-blocks-wall-no-defends-body` since v4.53 and closed here.

   AND CLOSING IT CLOSED A SECOND DEFECT THE RECORD DID NOT NAME. The
   bespoke pause paid out of FLOATING resources only (`act(n).res >= cost`,
   no pitch) and CR 4.4.3e takes every floating resource from BOTH seats at
   every end phase — so on the opponent's turn, the only turn this wall is
   raised on, the player holds 0 and the Pay button was disabled. Brothers in
   Arms' printed +2{d}, BUILT AT v4.53 FOR THIS EXACT WALL, was unreachable
   unless the player happened to have overpaid for an instant in the same
   window. The shared sheet pitches on demand (RULING 2026-08-01), which is
   what the DUMMY's wall has always done with the identical card.

   WHAT IS DRIVEN AND WHAT IS SCANNED, SAID PLAINLY. The RULE lives in
   `effects.defendsTriggers` and is driven here for both seats and all four
   families. The trainer's WIRING — the pause, the resume, the retired
   `defpay` — is inside `Battle`, a React component no drill can reach, so
   those are source scans with comments stripped and the stripper's control
   routed THROUGH the scan (v4.27, v4.32). The reach of each is stated.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");
const SRC = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");

/* THE STRIPPER IS PROVED THROUGH THE SCAN, never beside it (v4.32). The
   control is built by CONCATENATION, because written as a literal it would
   appear in THIS file rather than in the one being scanned. */
test("the comment stripper works, proved through the scan", () => {
  const ctrl = "/* " + "defPayQueue" + " */";
  assert.equal(strip("x " + ctrl + " y").indexOf("defPayQueue"), -1);
  assert.match(strip("x defPayQueue y"), /defPayQueue/,
    "…and it does not eat CODE, or every scan below passes vacuously");
});

/* ---- THE PREMISE, DRIVEN OFF THE PINNED POOL -------------------------- */

const pool = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pool.json"), "utf8"));
  return (j.cards || j).map(r => {
    const m = C.mapDbCard(r);
    return {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, life: m.hp,
            tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
  });
})();

test("the pool's FOUR `defends` families, both directions", () => {
  const fam = {};
  for(const c of pool){
    P.fxReset();
    const fx = P.fxParse(c);
    for(const k of ["optCost", "millCost", "payCost"])
      if(fx[k] && fx[k].trigger === "defends")
        (fam[k] = fam[k] || new Set()).add(c.name);
    if(fx.clash) (fam.clash = fam.clash || new Set()).add(c.name);
  }
  P.fxReset();
  const names = k => [...(fam[k] || [])].sort();
  /* PINNED AS SETS, both directions (v4.17) — pinning the members alone
     cannot see a name LEAVING the list, and every one of these is a printed
     line of play that has to reach BOTH walls. */
  assert.deepEqual(names("optCost"),  ["Crash and Bash"]);
  assert.deepEqual(names("millCost"), ["Washed Up Wave"]);
  assert.deepEqual(names("payCost"),  ["Brothers in Arms"]);
  assert.deepEqual(names("clash"), ["Clash of Agility", "Clash of Might",
    "Clash of Vigor", "Stonewall Impasse", "Test of Might", "Test of Strength"]);
  /* AND THE TWO THAT PAY OUT A `defBuff` ARE WHY THE PAUSE EXISTS. Crash
     and Bash mints a token, which is not part of the wall; the other two
     move what a defender is WORTH, so a sheet answered after the total is
     struck is a +{d} the player paid for and did not get. */
  const payloadOf = nm => {
    P.fxReset();
    const c = pool.find(x => x.name === nm && (x.pitch === 1 || x.pitch === null || x.pitch === 0));
    const fx = P.fxParse(c);
    return (fx.millCost || fx.payCost || fx.optCost).ops;
  };
  assert.equal(E.defBuffOf(payloadOf("Washed Up Wave")), 2);
  assert.equal(E.defBuffOf(payloadOf("Brothers in Arms")), 2);
  assert.equal(E.defBuffOf(payloadOf("Crash and Bash")), 0,
    "a token mint moves no number at the wall — the one family that needs no pause");
  P.fxReset();
});

/* ---- THE ONE BODY, DRIVEN AT BOTH SEATS ------------------------------- */

const cardOf = nm => {
  const c = pool.find(x => x.name === nm && (x.pitch === 1 || x.pitch === null || x.pitch === 0));
  assert.ok(c, "fixture card missing from the pool: " + nm);
  return {...c, uid: 700 + nm.length};
};

test("`defendsTriggers` queues every family, off the HAND wall", {skip}, () => {
  P.fxReset();
  const bia = cardOf("Brothers in Arms");
  const cab = cardOf("Crash and Bash");
  cab.uid = 801;
  /* the defender needs a crush card in hand or Crash and Bash's reveal
     builds no sheet at all — which is the skip path the next drill covers */
  const crush = pool.find(x => P.printedKw(x, "crush"));
  const g = H.state({}, {hand: [bia, cab, {...crush, uid: 802}], res: 3}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [bia, cab], []));
  assert.equal(r.queued, 2, "both sheets queued off one wall");
  const tags = r.game.promptQ.map(q => `${q.src}:${q.tag}`).sort();
  assert.deepEqual(tags, ["Brothers in Arms:pay", "Crash and Bash:pick"]);
  /* THE SHEETS ARE ADDRESSED TO THE SEAT THE CALLER NAMED, not derived. */
  for(const q of r.game.promptQ)
    assert.equal(q.side, 1, "every sheet goes to the declared defender's seat");
  /* AND THE `defBuff` RIDES AS `defUid` (v4.53), or the number reaches
     `runOps`, which only LOGS one. */
  const pay = r.game.promptQ.find(q => q.tag === "pay");
  assert.equal(pay.defUid, bia.uid);
  P.fxReset();
});

test("the SEAT is the caller's answer — the same wall, the other chair", {skip}, () => {
  /* THIS IS THE DRILL THE EXTRACTION EXISTS FOR. `afterDefenders` derived
     the defender as `1 - actorOf(n)`, which is right on the attacker's path
     and WRONG on the trainer's block path, where the player is the defender
     AND the actor. A body that derived it would be right on one wall and
     wrong on the other — `tapFoeHero`'s inversion (v3.48). */
  P.fxReset();
  const bia = cardOf("Brothers in Arms");
  const g = H.state({hand: [bia], res: 3}, {}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 0, [bia], []));
  assert.equal(r.queued, 1);
  assert.equal(r.game.promptQ[0].side, 0,
    "seat 0 defends and seat 0 is asked — the trainer's block wall");
  P.fxReset();
});

test("the GEAR wall is a second argument, and it is scanned too", {skip}, () => {
  /* Washed Up Wave is EQUIPMENT and Stonewall Impasse clashes from the gear
     zone — v3.90 found four pool records printing the trigger on gear that
     NEITHER board reached, and `wall` is pinned as the non-equipment cards
     because phantasm reads no other kind. */
  P.fxReset();
  const wuw = cardOf("Washed Up Wave");
  const g = H.state({}, {gear: [wuw], deck: [cardOf("Crash and Bash")], res: 3}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [], [wuw]));
  assert.equal(r.queued, 1, "the equipment defender's own family fired");
  assert.equal(r.game.promptQ[0].src, "Washed Up Wave");
  P.fxReset();
});

test("the TRIGGER gate refuses a cost printed on another trigger", {skip}, () => {
  /* ASK FOR THE REFUSAL (v3.98), and the near-miss is a REAL POOL CARD,
     which is rarer and better than a synthetic (v4.18). Measured over the
     pinned pool, four records emit `millCost` and only ONE is on `defends`:

       Jittery Bones  x3   trigger: attacks   (Pirate Necromancer Action - Attack)
       Washed Up Wave x1   trigger: defends   (Pirate Necromancer Equipment - Arms)

     `effects.js`' own comment says they print the identical cost on the two
     triggers. Any non-block card may be DECLARED as a defender, so Jittery
     Bones really can appear in a wall — and without the gate its `attacks`
     cost is offered off a BLOCK, which is the shape v3.94 found when the
     trainer ran a clash off a card that merely mentions one.

     A DRILL THAT ONLY ASKS FOR MATCHES CANNOT SEE THIS. Sabotaging the gate
     open was SILENT against every other drill in this file, because no
     other fixture puts a wrong-trigger card in the wall. */
  P.fxReset();
  const jb = cardOf("Jittery Bones");
  const jfx = P.fxParse(jb);
  assert.ok(jfx.millCost, "the fixture must actually carry the family");
  assert.equal(jfx.millCost.trigger, "attacks",
    "…on the OTHER trigger — the whole point of the fixture");
  const g = H.state({}, {hand: [jb], deck: [cardOf("Crash and Bash")], res: 3}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [jb], []));
  assert.equal(r.queued, 0, "an `attacks` cost is not offered off a block");
  assert.deepEqual(r.game.promptQ, [], "and nothing is queued");
  /* THE POSITIVE CONTROL, in the same state: a gate that refuses everything
     passes the row above perfectly (v3.98). */
  const wuw = cardOf("Washed Up Wave");
  const r2 = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [], [wuw]));
  assert.equal(r2.queued, 1, "and the `defends` printing IS offered");
  P.fxReset();
});

test("the clash's position inside the body is LATENT, and the premise is pinned", {skip}, () => {
  /* THE COMMENT ABOVE `resolveClash` SAYS IT MUST RUN BEFORE THE PROMPTS,
     "because a sheet opened first would resolve against a board the clash
     has not yet changed". Measured, that reason is NOT load-bearing where
     it sits: this body only QUEUES specs, and `buildPrompt` runs inside the
     CALLER's `openPrompt` — so moving the clash past the queue loop changes
     no state at all. Sabotaging the order came back SILENT, and a guard
     that cannot express a bug is dead rules code that reads like a rule
     (v4.11).

     IT IS STILL RIGHT TO RUN FIRST, and the honest statement is that it is
     LATENT (v3.86's `_destroyBoard`, v4.24's token half). So the two
     premises it rests on are DRILLS, and the day either moves somebody
     decides rather than the order quietly starting to matter. */
  const code = strip(SRC("engine/effects.js"));
  const i = code.indexOf("const resolveClash = (s, defSeat, defenders) =>");
  assert.ok(i > 0, "resolveClash moved — re-anchor this drill");
  const rc = code.slice(i, code.indexOf("\n  const defendsTriggers", i));
  assert.ok(rc.length > 500 && rc.length < 9000, "the slice is the one body (v4.05)");
  assert.ok(!/promptQ|openPrompt|buildPrompt/.test(rc),
    "`resolveClash` queues and opens nothing, so the queue's ORDER cannot see it");
  const j = code.indexOf("const defendsTriggers = (s, defSeat, wall, gearWall) =>");
  const dt = code.slice(j, code.indexOf("\n  const afterDefenders", j));
  assert.ok(!/buildPrompt/.test(dt),
    "and this body builds no sheet — a spec is data, so nothing here reads the board "
    + "the clash just changed. Move `buildPrompt` in and the order becomes load-bearing.");
  /* AND IT IS DRIVEN: the clash really does fire from here, on the seat the
     caller named, whatever the queue does. */
  P.fxReset();
  const imp = cardOf("Stonewall Impasse");
  const g = H.state({deck: [cardOf("Crash and Bash")]},
                    {gear: [imp], deck: [cardOf("Brothers in Arms")]}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [], [imp]));
  const feed = (r.game.feed || []).map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");
  assert.match(feed, /clashes —/, "the clash fired from the shared body");
  P.fxReset();
});

test("nothing declared queues nothing, so the wall is not held for free", {skip}, () => {
  P.fxReset();
  const g = H.state({}, {}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 1, [], []));
  assert.equal(r.queued, 0);
  assert.deepEqual(r.game.promptQ, []);
  P.fxReset();
});

test("`defendsTriggers` does NOT drain — the caller decides", {skip}, () => {
  /* The attacker's path goes on to a reaction window where nothing is
     totalled; the block path must hold the wall open. So the drain is the
     caller's, and a body that drained would take that choice away. */
  P.fxReset();
  const bia = cardOf("Brothers in Arms");
  const g = H.state({hand: [bia], res: 3}, {}, {actor: 0});
  const r = H.fx(g, (f, n) => f.defendsTriggers(n, 0, [bia], []));
  assert.equal(r.game.prompt, undefined,
    "no live sheet: the spec is queued and nothing is opened");
  assert.equal(r.game.promptQ.length, 1);
  P.fxReset();
});

/* ---- THE ATTACKER'S PATH IS UNCHANGED -------------------------------- */

test("`afterDefenders` still runs the families, through the shared body", {skip}, () => {
  P.fxReset();
  const body = strip(SRC("engine/effects.js"));
  const i = body.indexOf("const afterDefenders = (s, wall, gearWall) => {");
  assert.ok(i > 0, "afterDefenders moved — re-anchor this drill");
  const j = body.indexOf("\n  /* ", i + 10);
  const slice = body.slice(i, j > i ? j : i + 4000);
  assert.match(slice, /defendsTriggers\(n, 1 - actorOf\(n\), wall, gearWall\)/,
    "the attacker's path derives the DEFENDER as 1 - actor, and hands it in");
  assert.match(slice, /if\(r\.queued\) n = openPrompt\(n\)/,
    "…and drains only what it queued");
  /* AND IT KEEPS PHANTASM, which is the half that genuinely needs the
     attacking CARD and is why the block path could not call this function
     (its `if(!card) return n;` would have returned immediately, doing
     nothing, and looked exactly like a fix — v3.50). */
  assert.match(slice, /hasKw\(card,\s*"phantasm"\)/);
  P.fxReset();
});

/* ---- THE TRAINER'S WIRING (SOURCE SCANS, REACH STATED) ---------------- */

const HTML = strip(SRC("index.html"));

/* THE REACH OF THESE SCANS: they prove the trainer's block path NAMES the
   shared body and no longer carries its own scan or its own pause. They
   cannot prove the control flow RUNS, because `takeIt`, `openPrompt` and
   `finishBlock` are closures inside a React component. What carries the
   rule is the driven half above; these carry the WIRING. A source scan
   cannot tell a live call from `if(false && …)` either (v4.00), so the
   conditional is pinned whole where one is involved. */

test("the trainer's block wall calls the ONE body, with its own seat", () => {
  const i = HTML.indexOf("const takeIt = () => setG");
  assert.ok(i > 0, "takeIt moved — re-anchor this drill");
  const j = HTML.indexOf("\n  const ", i + 10);
  assert.ok(j > i, "the next declaration moved — re-anchor this drill");
  const body = HTML.slice(i, j);
  assert.match(body, /_EFX\.defendsTriggers\(s, actorOf\(s\),/,
    "the block wall asks the shared body, and names ITS OWN seat as the defender");
  /* AND IT KEEPS NO SECOND SCAN. This is the gap itself: a hand-rolled
     `px.trigger === "defends"` here is one family's private copy, which is
     exactly why the other three never arrived. */
  assert.ok(!/trigger\s*===\s*"defends"/.test(body),
    "no hand-rolled defends scan survives on this path");
  assert.ok(!/_EFX\.resolveClash\(/.test(body),
    "and no second clash call — it is inside the shared body now");
  /* AND IT PASSES BOTH WALLS. Dropping the GEAR argument was a SILENT
     sabotage on the first pass, and it was a DRILL GAP rather than a weak
     sabotage: the driven drills above hand `defendsTriggers` its gear
     directly, so none of them can see a CALL SITE that stops supplying it.
     That is the half v4.53 measured — Washed Up Wave is an Arms piece and
     Stonewall Impasse clashes from the gear zone, so a hand-only call
     silently loses two of the four families on this wall.

     `blockG` IS INDICES INTO `gear` on this board (v4.53's third zone), so
     the mapping is part of the claim rather than decoration: passing the
     raw index list hands `fxParse` a number. */
  assert.match(body, /_EFX\.defendsTriggers\(s, actorOf\(s\), bcards,\s*\n?\s*act\(s\)\.blockG\.map\(i=>act\(s\)\.gear\[i\]\)\.filter\(Boolean\)\)/,
    "the DECLARED EQUIPMENT is the fourth argument, resolved from `blockG`'s "
    + "indices — a hand-only call loses Washed Up Wave and Stonewall Impasse");
});

test("the wall is held open until the sheet is answered", () => {
  const i = HTML.indexOf("const takeIt = () => setG");
  const j = HTML.indexOf("\n  const ", i + 10);
  const body = HTML.slice(i, j);
  /* PINNED WHOLE, opening paren included (v4.00, v4.55): `if(!dt.queued &&
     false)` keeps every identifier intact, so a scan for the bare names
     passes against a dead guard. */
  assert.match(body, /if\(!dt\.queued\) return finishBlock\(dt\.game\);/,
    "nothing queued -> total the wall now");
  assert.match(body, /return openPrompt\(\{\.\.\.dt\.game, _wallPending: true\}\);/,
    "something queued -> hold the wall and mark it, INSIDE the drain");
});

test("`openPrompt` resumes the held wall when the queue drains", () => {
  const i = HTML.indexOf("function openPrompt(s){");
  assert.ok(i > 0, "openPrompt moved — re-anchor this drill");
  const j = HTML.indexOf("\n  function ", i + 10);
  const body = HTML.slice(i, j > i ? j : i + 3000);
  assert.match(body, /if\(done\._wallPending\)\{/,
    "the resume is gated on the marker, so no other drain reaches it");
  assert.match(body, /delete o\._wallPending;\s*\n\s*return finishBlock\(o\);/,
    "and the marker is deleted BEFORE the call, so finishBlock cannot re-enter it");
});

test("while a sheet is live the wall is FINAL, on both block actions", () => {
  for(const [fn, decl] of [["takeIt", "const takeIt = () => setG(s=>{"],
                           ["toggleBlock", "const toggleBlock = (kind,v) => setG(s=>{"]]){
    const i = HTML.indexOf(decl);
    assert.ok(i > 0, fn + " moved — re-anchor this drill");
    const body = HTML.slice(i, i + 400);
    assert.match(body, /\|\|\s*s\.prompt\)\s*return s;/,
      fn + " refuses while a sheet raised off this wall is live");
  }
});

test("the bespoke `defpay` pause is GONE, in live code", () => {
  /* A whole mode, a queue, an action bar, a statusline and a peek chip —
     one family's private copy of the control flow above, which is why the
     other three never got it. Comments are stripped, so the note recording
     the retirement does not keep the drill green. */
  for(const name of ["defPayQueue", "confirmDefPay", '"defpay"'])
    assert.ok(!HTML.includes(name),
      name + " survives in live code — the pause is one body now");
  /* AND `applyDefMod` LOSES ITS ONE OUTSIDE CALLER WITH IT. It was exposed
     at v4.53 for `confirmDefPay` alone; the +{d} lands through
     `applyAnswer`'s `defUid` now, which is the same one body. An export
     nothing calls is a global that reads like a rule (v4.11, v4.47). */
  assert.ok(!/_EFX\.applyDefMod\(/.test(HTML),
    "the trainer writes no defMod of its own any more");
  assert.ok(!/\n\s*applyDefMod,/.test(strip(SRC("engine/effects.js"))),
    "…so it is not exposed either — a name leaving a surface is a deliberate edit (v4.12)");
});

test("the floating-only payment is gone, and that was the second defect", () => {
  /* `confirmDefPay` guarded `act(n).res >= cur.cost` with NO pitch path,
     and CR 4.4.3e takes every floating resource from BOTH seats at every
     end phase — so on the opponent's turn, the only turn this wall is
     raised on, the player holds 0 and the Pay button was disabled.

     THE PREMISE IS A DRILL, not a sentence: the fizzle really does take
     both seats, and the shared path really does pitch. */
  assert.match(HTML, /sides: n\.sides\.map\(\(x,i\)=> i!==si \? x : \{\.\.\.x, res:0, ap:0/,
    "CR 4.4.3e zeroes res for every seat — so the block wall starts at 0 floating");
  const EFX = strip(SRC("engine/effects.js"));
  assert.match(EFX, /if\(r\.pay > 0\)\{\s*\n\s*if\(act\(n\)\.res < r\.pay\)\{ const paid = autoPitch\(/,
    "and the shared answer pitches on demand (RULING 2026-08-01) — which is what " +
    "the DUMMY's wall has always done with the identical card");
});
