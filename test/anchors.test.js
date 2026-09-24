/* ============================================================
   THE READERS THE POOL NEVER REACHES (v4.50)

   `tools/anchors.js` asks the question v4.48 answered twice by accident:
   **which parser readers has nothing a match can deal ever reached?**
   That version found `perEquipDef` and `perBoost` anchored on the
   RULING's paraphrase ("where X is the number of …") while the database
   prints "for each …" on every one of 797 records — two carefully
   reasoned fire sites that had never once run, with the cards they were
   written for reading a flat +1 through a loose matcher instead.

   IT IS A LEAD LIST, NOT A FINDING LIST (v3.17, v4.18), so what is pinned
   here is the SET rather than a verdict. A reader ARRIVING in it is a new
   anchor nobody can reach; a reader LEAVING it is a wording the pool has
   started to print. Both are deliberate edits, and pinning only one
   direction cannot see the other (v4.12, v4.17).

   PINNED BY TEXT, NEVER BY LINE NUMBER. A source slice rots where a rule
   moves (v3.22, v3.28, v3.94) and every edit to `parser.js` shifts every
   line below it — so the pin is each reader's own source line, which
   changes exactly when the reader does.

   AND THE SCAN IS PROVED ALIVE IN BOTH DIRECTIONS BEFORE ANY GAP IS
   BELIEVED. A coverage painting that marks everything covered reports
   ZERO dead readers, which reads as a clean result and is the dangerous
   failure (v3.81: a scan aimed wrong fails by finding nothing); one that
   marks everything uncovered reports all 158. Pinning the exact set
   fails under both, and the band assertions say so out loud.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const {execFileSync} = require("node:child_process");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");

const ROOT = path.join(__dirname, "..");
const skip = !fs.existsSync(require("./helpers/extract").cardDbPath())
  && "needs the pinned pool";

let _rep = null;
const report = () => _rep || (_rep = JSON.parse(execFileSync(process.execPath,
  [path.join(ROOT, "tools", "anchors.js"), "--json"],
  {encoding: "utf8", maxBuffer: 1 << 26})));

test("the coverage scan is alive in both directions", {skip}, () => {
  const r = report();
  assert.equal(r.records, 797, "the drive leg did not parse the pinned pool");
  assert.ok(r.powCards > 100, "only " + r.powCards + " powCards built — the builders are not reached");
  assert.ok(r.sites > 120, "only " + r.sites + " return sites found — the site scan is aimed wrong");
  /* A PAINTING THAT COVERS EVERYTHING REPORTS 0, and 0 reads as clean. */
  assert.ok(r.dead.length > 0, "zero dead readers — the coverage painting marks everything covered");
  /* A PAINTING THAT COVERS NOTHING REPORTS ALL OF THEM. */
  assert.ok(r.dead.length < r.sites / 3,
    r.dead.length + " of " + r.sites + " dead — the painting marks everything uncovered");
});

test("every parser reading the pool never reaches is pinned", {skip}, () => {
  const r = report();
  assert.deepEqual(r.dead.map(d => d.txt).sort(), [
    /* SIX NOOPs SHADOWED BY A WHOLE-CARD READER BUILT LATER. v3.94 moved
       the three clash payoffs out of inline regexes into `fx.clash` /
       `fx.clashReveal`; v4.04 gave the Inertia token `parser.isHandWipe`;
       `reprise` and `mark` are prefixes whose own readers strip them and
       recurse (v4.21). Each was the honest report on the day it was
       written and none can be reached now — they assert nothing false,
       which is why they are RECORDED rather than deleted. */
    "if(/^(?:mark|marked)$/.test(c)) return NOOP(\"qualifier only — marking is a state other cards read\");",
    /* `{t} your hero` AND `banish N cards from your soul` ARE printed —
       twice each — and only ever inside a COST, where a different reader
       correctly claims them: Turn to Mindfire's tap rides on `fx.tapCost`
       (v3.91), Goldkiss Rum's is a compound activation cost nothing
       builds, and Boltyn's soul banish is his ability's cost, which
       `heroAbilityLine` strips before `fxParse` ever sees it (v3.74).
       Latent readers with correct anchors — and asking THIS one is what
       put `weaponCost`'s cost read in front of somebody. */
    "if(/^(?:you may )?\\{t\\} your hero$/.test(c)) return R([[\"tapSelfHero\",1]]);",
    "if(/^inertia$/.test(c)) return NOOP(\"live — a hand wipe at the beginning of its controller's end phase (resolveInertia)\");",
    "if(/^reprise$/.test(c)) return NOOP(\"qualifier — the payload clause below carries the condition\");",
    "if(/inertia/.test(c)) return NOOP(\"live — see the Inertia token; the wipe resolves in its controller's end phase\");",
    /* THREE READINGS WHOSE OP KIND IS LIVE THROUGH A DIFFERENT ANCHOR.
       `defBuff`, `atkMinus` and `res` all have pool claimants; these
       particular wordings do not, because the pool spells the same effect
       another way — resources as PIPS rather than "gains 2 resources",
       and Look Tuff's -1{p} inside a printed toll (`payOrLose`). An op
       kind with an emitter says nothing about each anchor that emits it,
       which is why this half is coverage and the op census is not. */
    "if(m=c.match(/(?:target )?defending card (?:gains?|gets?) \\+(\\d+)\\s*(?:\\{d\\}|defense)/)) return R([[\"defBuff\",+m[1]]]);",
    "if(m=c.match(/^(?:this|it) gets -(\\d+)\\s*\\{p\\}$/)) return R([[\"atkMinus\",+m[1]]]);",
    "if(m=c.match(/^discards? (a|an|one|two|three|\\d+) random cards?$/)) return R([[\"discardRandom\",num(m[1])]]);",
    "if(m=c.match(/gains? (\\d+)\\s*(?:\\{r\\}|resource)/)) return R([[\"res\",+m[1]]]);",
    "return NOOP(\"clash payoff — the clash block creates this for whoever wins\");",
    "return NOOP(\"clash payoff — the defence step applies this when you win\");",
    "return NOOP(\"clash — resolved when this blocks, off the clash keyword\");",
    "return NOOP(\"reveal payoff — fires if this is the card revealed on a winning clash\");",
    "return R([[\"draw\",num(m[1])],[\"discardRandom\",num(m[2])]]);",
    "return R([[\"soulSpend\", num(m[1]), sub.ops]]);",
  ].sort());
});

test("`runOps`'s vocabulary and what the pool emits are pinned both ways", {skip}, () => {
  const r = report();
  /* 89 -> 91 AT v4.62: `mayOffer` (a costless "you may", offered as a
     one-mode optional modal) and `foeArsUp` (the cross-seat arsenal turn),
     both emitted by Wreck Havoc's clause and both with a `runOps` case.
     Moving this number is a deliberate edit in both places (v4.17).
     91 -> 92 AT v4.63: `ctrSrc`, a counter on the permanent the resolving
     ability belongs to, emitted by Plasma Barrel Shot's steam line — the
     line a hand-written powCard paraphrased for fourteen versions.
     92 -> 94 AT v4.64: `returnSelf` and `charge`, Roaring Beam's clause —
     a card filed into the hand instead of the graveyard, and a charge
     made as an EFFECT (a pick hand -> soul) rather than as a cost. */
  assert.equal(r.dispatched, 94, "runOps's op vocabulary moved");
  /* DISPATCHED WITH NO EMITTER — the `perBoost` shape. Three have a
     producer that is not the parser and are named for it; two have none
     anywhere and are latent readers whose printed wording the pool only
     ever spells inside a cost. */
  assert.deepEqual(r.noEmitter,
    ["arcTaken", "deckDestroy", "destroyGear", "soulSpend", "tapSelfHero"]);
  /* EMITTED WITH NO CASE IN `runOps` — each dispatched at a named site
     instead. v3.99 ran this half by hand, once; the three `per…` kinds
     joined it at v4.48 and had ZERO emitters until that version. */
  assert.deepEqual(
    r.noRunOps.filter(k => ["payOrLose", "pump", "wpnAgain",
                            "perBoost", "perChainHit", "perEquipDef"].includes(k)).sort(),
    ["payOrLose", "perBoost", "perChainHit", "perEquipDef", "pump", "wpnAgain"]);
});

/* ---- WHAT THE CENSUS FOUND: a digit that outranked the pips ---------- */

test("weaponCost reads the PIP COUNT, not a digit from elsewhere in the cost", () => {
  /* TEKLOVOSSEN IS THE POOL'S ONLY COMPOUND WEAPON-ATTACK COST, and the
     old read took the `2` out of "banish 2 cards" — a pip CHEAPER than
     printed, at a reader nine sites ask. */
  assert.equal(P.weaponCost("Action - {r}{r}{r}, banish 2 cards from your soul: Attack").cost, 3);
  /* THE EXPLICIT DIGIT FORM STILL WINS, and it must: it is the first rung. */
  assert.equal(P.weaponCost("Action - 2 resources: Attack").cost, 2);
  assert.equal(P.weaponCost("Action - 3 {r}: Attack").cost, 3);
  /* AND THERE IS NO THIRD RUNG. My own first comment claimed the bare
     digit had four claimants — the Demon Ally tokens printing "Action -
     0: Attack" — and that dropping it would read them as free. They ARE
     free, and a cost string with no pips already counts 0, so the rung
     could not change an answer on any of the 26 Action-Attack records and
     its sabotage came back SILENT (v4.11: a guard that cannot express a
     bug is dead code that reads like a rule). */
  assert.equal(P.weaponCost("Action - 0: Attack").cost, 0);
  assert.equal(P.weaponCost("Once per Turn Action - {r}: Attack").cost, 1);
  /* A COST WITH NEITHER is genuinely free of resources — Plasma Barrel
     Shot pays in a steam counter (v4.49). */
  const g = P.weaponCost("Once per Turn Action - Remove a steam counter from this: Attack");
  assert.equal(g.cost, 0);
  assert.equal(g.needSteam, true);
});

test("no pool record prints its attack cost as a NON-ZERO bare digit", {skip}, () => {
  /* THE PREMISE THE DELETED RUNG RESTED ON, as a drill rather than as a
     sentence. Four records render their cost as a bare `0` — the
     database's spelling for "no pips to print" — and the pip count
     answers 0 for them anyway. A record printing `Action - 3: Attack`
     would be read as FREE, which is the cheaper-than-printed direction,
     so it fails here and somebody decides.

     THE CONTROL GOES THROUGH THE SCAN, NOT BESIDE IT (v4.32). A clean
     result here is indistinguishable from a scan aimed wrong (v3.81), and
     no pool record can express the counterexample — so the same body is
     run over the pool plus a SYNTHETIC record that does print one, and
     must find exactly that one (v3.73). */
  const clean = t => String(t || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const scan = recs => {
    const bad = [], zero = [];
    for(const rc of recs){
      const m = clean(rc.tx).match(/action\s*[-—]*\s*([^:]{0,90}?):\s*attack\b/i);
      if(!m) continue;
      const cs = m[1].trim();
      if(/(\d+)\s*(?:resource|\{r\})/i.test(cs) || /\{r\}/i.test(cs)) continue;
      if(/[1-9]/.test(cs)) bad.push(rc.name);
      else if(/0/.test(cs)) zero.push(rc.name);
    }
    return {bad: bad.sort(), zero: zero.sort()};
  };
  const DB = H.db();
  const recs = Object.keys(DB.byNP)
    .map(k => H.card(DB.byNP[k].n, DB.byNP[k].p == null ? 0 : DB.byNP[k].p))
    .filter(Boolean);
  const r = scan(recs);
  assert.deepEqual(r.bad, [], "a bare non-zero attack cost would read as free: " + r.bad.join(" | "));
  /* BOTH HALVES: the scan must find the four it is meant to, or it proves
     nothing by finding no counterexample (v3.98). */
  assert.deepEqual(r.zero, ["Blasmophet, the Soul Harvester", "Nasreth, the Soul Harrower",
                            "Raydn, Duskbane", "Ursur, the Soul Reaper"]);
  for(const nm of r.zero){
    let rc = null;
    for(const p of [null, 0, 1, 2, 3]){ rc = H.card(nm, p); if(rc) break; }
    assert.equal(P.weaponCost(rc.tx).cost, 0, nm + "'s printed cost is 0");
  }
  /* AND THE SYNTHETIC PROVES THE `bad` HALF CAN FIRE AT ALL. */
  const synth = {name: "Threepip Blade", tt: "Generic Weapon - Sword (1H)", power: 3,
                 tx: "Once per Turn Action - 3: Attack"};
  assert.deepEqual(scan([...recs, synth]).bad, ["Threepip Blade"],
    "the scan cannot see a non-zero bare digit — it is aimed wrong");
  assert.equal(P.weaponCost(synth.tx).cost, 0,
    "and it reads as FREE, which is why the premise is worth a drill");
});

test("exactly one pool record's weapon cost moved, and it is Teklovossen", {skip}, () => {
  /* THE BLAST RADIUS, PINNED. Every other Action-Attack line in the pool
     reads the same number under both readings; pinning the whole set is
     what makes a widening of this reader a deliberate edit. */
  const DB = H.db();
  const rows = [];
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    const wc = P.weaponCost(rc.tx);
    if(wc) rows.push(rc.name + "=" + wc.cost);
  }
  assert.ok(rows.includes("Teklovossen, the Mechropotent=3"),
    "Teklovossen reads " + rows.find(r => /^Teklo/.test(r)));
  assert.equal(new Set(rows).size, 26, "the Action-Attack population moved: " + new Set(rows).size);
});

test("the two per-count anchors the pool never printed are gone", () => {
  /* v4.48 named them dead and left them standing; v4.11's rule is that
     dead rules code reads like a rule. The RULINGS they carried are
     honoured by the `for each` reader the cards actually print, so both
     live readings are asserted here beside the deletion. */
  const src = fs.readFileSync(path.join(ROOT, "engine", "parser.js"), "utf8");
  assert.equal(/where x is the number of equipment defending/i.test(src), false,
    "the dead perEquipDef anchor is back");
  assert.equal(/where x is the number of times you have boosted/i.test(src), false,
    "the dead perBoost anchor is back");
  assert.deepEqual(P.classifyClause("this gets +1{p} for each equipment defending it").ops,
    [["perEquipDef", 1]]);
  assert.deepEqual(P.classifyClause("this gets +1{p} for each time you have boosted this combat chain").ops,
    [["perBoost", 1]]);
});
