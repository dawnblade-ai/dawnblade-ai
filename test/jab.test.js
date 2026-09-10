/* ============================================================
   A TARGETED JAB FROM A SECOND WEAPON (v4.38)

   > "**Attack Reaction** - Destroy this: Target dagger you control that
   >  isn't on the active chain link deals 1 damage to the defending hero.
   >  If damage is dealt this way, the dagger has hit. Destroy the
   >  dagger."                                        — DANGER DIGITS ×1

   `tier: none`, `parseHeroPower` returned null, so `build.js` built NO
   powCard and neither board could offer it — v3.47's shape, fifth outing:
   **reading the payload is what creates the route.**

   v3.63 MADE THE HEAD REFUSE ON PURPOSE and wrote down why: the `dmg`
   matcher is unanchored, so read loose this is a bare `[["dmg",1]]` from
   the EQUIPMENT with the chosen dagger, the "has hit" fiction AND the
   printed "Destroy the dagger" drawback all silently gone. That refusal
   was the honest report while it lasted; a recorded refusal is a DEBT
   (v3.38) and this discharges it.

   THREE SENTENCES ABOUT ONE OBJECT, so the reader is a WHOLE-CARD one
   (v3.71's Azalea shape) and "the dagger" is the card the FIRST sentence
   targeted, never the Arms piece the cost has already destroyed (v2.33,
   v3.47).

   IT IS A DESIGNED LOOP ENTIRELY INSIDE ONE HERO. Both pool Daggers are
   Arakni's — Mark of the Huntsman (her gear) and Graphene Chelicera (the
   token `equipTok` mints, v4.15) — and "the dagger has hit" is what feeds
   Tarantula's drain (v3.77) and Mark's own on-hit offer (v4.37).

   FOUR THINGS THIS FILE HOLDS:

     the shape      the whole printed sentence or nothing (v2.29) — the
                    subject `optFilter` can pin, the fiction, the drawback
     the reader     `classifyClause` still REFUSES the head, so the fold
                    is the ONE reader of that line (v3.56)
     the targets    `jabTargets` is the one reader, gear AND arena, and
                    the exclusion is the CALLER's answer
     the order      damage, fiction, destroy — reversed, the fiction fires
                    on a card the drawback has already removed
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const PM = require("../engine/prompts.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const pool = require("../data/pool.json");
const rec = r => ({name: r.name, pitch: +(r.pitch || 0), tt: r.type_text, ty: r.types,
                   tx: r.functional_text || "", kw: r.card_keywords, cost: r.cost,
                   power: (r.power === "" || r.power == null ? null : +r.power),
                   def: (r.defense === "" || r.defense == null ? null : +r.defense)});

let synN = 0;
const syn = tx => ({name: "Jab Probe " + (++synN), pitch: 0, cost: null, power: null,
                    def: 0, tt: "Assassin Equipment - Arms", ty: ["Assassin", "Equipment", "Arms"],
                    kw: [], tx});
const HEAD = "**Attack Reaction** - Destroy this: Target dagger you control that "
           + "isn't on the active chain link deals 1 damage to the defending hero.";
const HIT  = " If damage is dealt this way, the dagger has hit.";
const KILL = " Destroy the dagger.";

/* ---- 1. THE READING ------------------------------------------------ */

test("all three sentences are folded into one entry", {skip}, () => {
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Danger Digits", 0));
  assert.deepEqual(fx.daggerJab, {sub: "dagger", amt: 1, filter: {tt: "dagger"}});
  assert.equal(fx.tier, "full", "none -> full: the whole card is read");
  assert.equal(fx.playable, true,
    "the powCard's own clauses all refuse at clause level, so without this "
    + "the trainer dims a built ability as 'no scripted effect yet'");
  P.fxReset();
});

test("the AMOUNT and the SUBJECT are both READ, not the ones it happens to print", () => {
  /* IT PRINTS 1 AND "dagger", and it is the pool's only record of the
     shape — so no real fixture can tell a read value from a hardcoded one
     (v3.32, thirteenth outing). Synthetics are the only thing that see it. */
  P.fxReset();
  assert.deepEqual(P.fxParse(syn(HEAD.replace("dagger", "sword")
      .replace("deals 1 damage", "deals 3 damage")
    + HIT.replace("dagger", "sword") + KILL.replace("dagger", "sword"))).daggerJab,
    {sub: "sword", amt: 3, filter: {tt: "sword"}});
  P.fxReset();
});

test("BOTH CONTRACTION SPELLINGS read, and the pool prints one of them", () => {
  /* v3.36 and v3.65: the database prints both wordings, sometimes at
     once, and an anchor that knows one is a card waiting to be found.
     `SYNONYMS` does not level this shape, so the alternation is local. */
  P.fxReset();
  const a = P.fxParse(syn(HEAD + HIT + KILL));
  const b = P.fxParse(syn(HEAD.replace("isn't", "is not") + HIT + KILL));
  assert.deepEqual(b.daggerJab, a.daggerJab);
  P.fxReset();
  const isnt = pool.filter(r => /is ?n'?t on the active chain link/i.test(r.functional_text || ""));
  const isnot = pool.filter(r => /is not on the active chain link/i.test(r.functional_text || ""));
  assert.deepEqual([...new Set(isnt.map(r => r.name))], ["Danger Digits"]);
  assert.deepEqual([...new Set(isnot.map(r => r.name))], [],
    "the long form is LATENT, which is why its drill is synthetic (v3.73)");
});

/* ---- 2. WHAT REFUSES ----------------------------------------------- */

test("THE WHOLE PRINTED SHAPE, OR NOTHING (v2.29)", () => {
  /* Claiming the head and dropping the destroy files an UNBOUNDED
     REPEATABLE jab — v4.25's rule one card over. Claiming the destroy
     without the fiction drops the only reason the card exists. */
  P.fxReset();
  assert.equal(P.fxParse(syn(HEAD + KILL)).daggerJab, undefined, "no fiction, no read");
  assert.equal(P.fxParse(syn(HEAD + HIT)).daggerJab, undefined, "no drawback, no read");
  assert.ok(P.fxParse(syn(HEAD + HIT + KILL)).daggerJab, "…and the whole shape reads");
  P.fxReset();
});

test("a subject `optFilter` cannot pin refuses, in BOTH readers", () => {
  /* v3.53: a subject the reader cannot name is a target a player could
     choose wrongly. AND THE TWO READERS MUST AGREE — `parseHeroPower`
     decides whether a powCard is built at all, so a sentence it accepts
     and the fold then refuses is an ability activated, paying its
     destroy, doing nothing (v2.04's free-ability shape). */
  P.fxReset();
  for(const sub of ["thingamajig", "card"]){
    const tx = HEAD.replace(/dagger/g, sub) + HIT.replace(/dagger/g, sub)
             + KILL.replace(/dagger/g, sub);
    assert.equal(P.fxParse(syn(tx)).daggerJab, undefined, sub + ": the fold refuses");
    assert.equal(P.parseHeroPower(tx, true), null, sub + ": …and so does the route");
  }
  P.fxReset();
});

test("THE RIDER'S SUBJECT MUST BE THE HEAD'S", () => {
  /* "Destroy the top card of your deck" is a different sentence entirely,
     and matching on the verb alone would claim it — which would destroy
     a card the head never named. */
  P.fxReset();
  assert.equal(P.fxParse(syn(HEAD + HIT + " Destroy the top card of your deck.")).daggerJab,
    undefined);
  assert.equal(P.fxParse(syn(HEAD + " If damage is dealt this way, the sword has hit." + KILL)).daggerJab,
    undefined, "…and the fiction has to name it too");
  P.fxReset();
});

test("`classifyClause` STILL refuses the head (v3.63's guard, intact)", () => {
  /* THE FOLD IS THE ONE READER OF THAT LINE. If the loose `dmg` matcher
     started answering for it too, the card would have two claimants and
     the fold would no longer be where the reading lives (v3.56). */
  assert.equal(P.classifyClause(
    "target dagger you control that isn't on the active chain link deals 1 damage to the defending hero"),
    null);
  /* AND THE TWO PRINTED SUBJECTS THAT *ARE* THE RESOLVING CARD STILL READ
     — measured over the pool, exactly two records print the third-person
     "deals" and Bloodrot Pox's subject is "it". */
  assert.deepEqual(P.classifyClause("deal 2 damage to any target").ops, [["dmg", 2]]);
  assert.deepEqual(P.classifyClause("destroy this, then it deals 2 damage to them").ops.slice(-1),
    [["dmg", 2]]);
});

test("exactly one pool record emits a jab", {skip}, () => {
  H.db();
  P.fxReset();
  const got = pool.filter(r => P.fxParse(rec(r)).daggerJab).map(r => r.name);
  assert.deepEqual([...new Set(got)], ["Danger Digits"]);
  P.fxReset();
});

/* ---- 3. `jabTargets` — the ONE reader ------------------------------ */

const dagger = uid => ({uid, name: "Probe Dagger " + uid, tt: "Assassin Weapon - Dagger (1H)",
                        ty: ["Assassin", "Weapon", "Dagger"], power: 1, cost: null,
                        pitch: 0, def: null, kw: [], tx: "Once per Turn Action - {r}: Attack"});
const sword = uid => Object.assign({}, dagger(uid),
  {name: "Probe Sword " + uid, tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon", "Sword"]});

test("BOTH ZONES, and the printed filter decides", () => {
  /* v3.55, v3.33: a dagger lives in the GEAR zone, but `optFilter`'s
     closed list also answers for "ally", which is a board ENTRY. A scan
     of either zone alone finds nothing for half the family. */
  const sd = {gear: [dagger(1), sword(2)],
              board: [{uid: 3, card: dagger(3)}, {uid: 4, card: sword(4)}]};
  const got = E.jabTargets(sd, {tt: "dagger"}, null);
  assert.deepEqual(got.map(x => x.uid), [1, 3]);
  assert.deepEqual(got.map(x => x.where), ["gear", "board"]);
  assert.deepEqual(E.jabTargets(sd, {tt: "sword"}, null).map(x => x.uid), [2, 4],
    "the control — the filter is what decides, not the zone");
});

test("a DESTROYED piece is not a target, and neither is the active chain link", () => {
  const sd = {gear: [dagger(1), Object.assign(dagger(2), {destroyed: true}), dagger(3)], board: []};
  assert.deepEqual(E.jabTargets(sd, {tt: "dagger"}, null).map(x => x.uid), [1, 3],
    "marked rather than spliced until the end-phase sweep (v3.54), so it is still in the zone");
  assert.deepEqual(E.jabTargets(sd, {tt: "dagger"}, 1).map(x => x.uid), [3],
    "the printed exclusion is the CALLER's answer");
  assert.deepEqual(E.jabTargets(sd, {tt: "dagger"}, null).map(x => x.uid), [1, 3],
    "…and a caller that says nothing excludes nothing");
});

test("an unreadable filter answers EMPTY rather than everything", () => {
  /* `optFilter` returns null for a subject it cannot pin, and a null
     filter reaching `promptFilter` would match every card in the zone
     (v3.31, v3.87: `false`/`null` are two answers and one `!q` collapses
     them). Offering an illegal target is stronger than printed. */
  assert.deepEqual(E.jabTargets({gear: [dagger(1)], board: []}, null, null), []);
  assert.deepEqual(E.jabTargets(null, {tt: "dagger"}, null), []);
});

/* ---- 4. DRIVEN ------------------------------------------------------ */

function board(o){
  o = o || {};
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("jab-drill"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const extra = o.gear || [];
  const gear = [dd, ...extra];
  const atk = {uid: 800, name: "Plain Swing", tt: "Generic Action - Attack",
               ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0,
               power: 4, def: 2, tx: "", kw: []};
  const g = H.state({gear, res: 9, ap: 1, hand: [atk], board: o.board || []},
                    {hp: 20, hand: [], ward: o.foeWard || 0},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  return {dd, gear, declared: n, bd};
}
const activate = st => H.execute(st.declared, st.dd.powCard, "hero", 0, {});
const pick = (n, i) => {
  const r = J.withEffects(n, (fx, m) => fx.applyAnswer(m, PM.promptToggleSel(n.prompt, i)));
  return r.game || r;
};

test("DRIVEN: the powCard exists and the Arms piece pays with itself", {skip}, () => {
  const st = board({gear: [dagger(50)]});
  assert.ok(st.dd.powCard, "reading the PAYLOAD is what creates the route (v3.47)");
  const n = activate(st);
  assert.equal((n.sides[0].gear.find(x => x.uid === st.dd.uid) || {}).destroyed, true,
    "the printed cost destroys the source");
});

test("DRIVEN: ONE candidate just happens — no sheet (v3.55)", {skip}, () => {
  /* A sheet offering a single forced choice is a tap that teaches
     nothing, and the same body serves both routes. */
  const n = activate(board({gear: [dagger(50)]}));
  assert.ok(!n.prompt, "nothing to ask");
  assert.equal(n.sides[1].hp, 19, "the jab lands anyway");
  assert.equal((n.sides[0].gear.find(x => x.uid === 50) || {}).destroyed, true,
    "…and the printed drawback lands with it");
});

test("DRIVEN: TWO candidates open a sheet, and only the CHOSEN one is destroyed", {skip}, () => {
  const st = board({gear: [dagger(50), dagger(51)]});
  const n = activate(st);
  assert.ok(n.prompt, "two legal targets is a real choice");
  assert.equal(n.prompt.tag, "pick");
  assert.deepEqual((n.prompt.cards || []).map(c => c.uid), [50, 51]);
  assert.equal(n.sides[1].hp, 20, "and nothing resolves until it is answered");
  const m = pick(n, 1);
  assert.equal(m.sides[1].hp, 19);
  assert.equal((m.sides[0].gear.find(x => x.uid === 51) || {}).destroyed, true, "the chosen one");
  assert.ok(!(m.sides[0].gear.find(x => x.uid === 50) || {}).destroyed, "…and only it");
});

test("DRIVEN: the SWINGING weapon is excluded — the printed restriction", {skip}, () => {
  /* THE EXCLUSION IS THE CALLER'S ANSWER, and this is the case that
     tests it: a weapon swing puts the dagger itself on the chain, so
     without the uid the card could name the very weapon that is
     attacking. Both halves — with the swing, and with a card attack. */
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("jab-swing"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const only = dagger(50);
  const g = H.state({gear: [dd, only], res: 9, ap: 1, hand: []}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
  const swung = H.execute(g, g.sides[0].gear[1], "weapon", 0, {});
  const n = H.execute(swung, dd.powCard, "hero", 0, {});
  assert.ok(!n.prompt, "no sheet");
  assert.equal((n.sides[0].gear.find(x => x.uid === 50) || {}).destroyed, undefined,
    "the only dagger is the one on the chain, so it is not a legal target");
  assert.match((n.feed || []).map(f => f.t || f).join(" | "), /no dagger off the active chain link/i);
});

test("DRIVEN: the FICTION fires, and it fires BEFORE the destroy", {skip}, () => {
  /* "The dagger has hit" exists to fire hit-triggers on a card that never
     attacked. Mark of the Huntsman's own on-hit offer (v4.37) is the
     observable, and it is also what pins the ORDER: `offerPayCost`
     refuses a destroyed piece, so a destroy that ran first would make the
     fiction unobservable while every other assertion still passed. */
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("jab-fiction"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const mark = Object.assign({}, bd.gear.find(g => /Mark of the Huntsman/.test(g.name)), {uid: 60});
  const atk = {uid: 800, name: "Plain Swing", tt: "Generic Action - Attack",
               ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0,
               power: 4, def: 2, tx: "", kw: []};
  const g = H.state({gear: [dd, mark], res: 9, ap: 1, hand: [atk]}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
  const n = H.execute(H.execute(g, atk, "hand", 0, {}), dd.powCard, "hero", 0, {});
  assert.ok(n.prompt, "Mark's own on-hit ability is offered");
  assert.equal(n.prompt.src, "Mark of the Huntsman");
  assert.equal(n.prompt.destroyUid, 60, "…and it is the dagger that jabbed");
  assert.equal((n.sides[0].gear.find(x => x.uid === 60) || {}).destroyed, true,
    "the drawback still lands — the offer is queued, the destroy is not");
});

test("DRIVEN: a fully prevented jab does NOT hit (CR 7.5.5)", {skip}, () => {
  /* `dmg` routes through `preventDamage` (v4.35), so the printed "IF
     damage is dealt this way" is answered by the life total rather than
     restated.

     THE FIXTURE HAS TO BE A DAGGER THAT PRINTS AN ON-HIT ABILITY, or
     both rows have no prompt and the drill passes against a fiction that
     never fires at all — a probe dagger with no text makes the two halves
     indistinguishable (v3.26). Mark of the Huntsman is the discriminator,
     through the offer v4.37 built. */
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("jab-ward"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const atk = {uid: 800, name: "Plain Swing", tt: "Generic Action - Attack",
               ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0,
               power: 4, def: 2, tx: "", kw: []};
  const run = ward => {
    const mark = Object.assign({}, bd.gear.find(g => /Mark of the Huntsman/.test(g.name)), {uid: 60});
    const g = H.state({gear: [dd, mark], res: 9, ap: 1, hand: [atk]},
                      {hp: 20, ward},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
    return H.execute(H.execute(g, atk, "hand", 0, {}), dd.powCard, "hero", 0, {});
  };
  const hit = run(0), warded = run(5);
  assert.equal(hit.sides[1].hp, 19, "the control: it lands");
  assert.ok(hit.prompt, "…so the fiction fires and Mark's own ability is offered");

  assert.equal(warded.sides[1].hp, 20, "the ward eats it");
  assert.ok(!warded.prompt, "so nothing hit, and nothing fires");
  assert.match((warded.feed || []).map(f => f.t || f).join(" | "), /did not hit/i);
  assert.equal((warded.sides[0].gear.find(x => x.uid === 60) || {}).destroyed, true,
    "…and the drawback lands regardless — the card does not condition it");
});

test("DRIVEN: a board permanent leaves the ARENA and reaches the graveyard", {skip}, () => {
  /* `jabTargets` covers both zones, and the destroy has to know which:
     a gear piece is MARKED for the end-phase sweep (v3.54) and a board
     permanent leaves now and pays out what it printed (v4.29). LATENT —
     both pool Daggers are Weapons — so the fixture is synthetic (v3.73). */
  const ally = {uid: 70, name: "Probe Ally Dagger", tt: "Assassin Ally - Dagger",
                ty: ["Assassin", "Ally", "Dagger"], power: 1, life: 2, cost: 1,
                pitch: 1, def: null, kw: [], tx: ""};
  const n = activate(board({board: [{uid: 70, kind: "ally", card: ally}]}));
  assert.equal(n.sides[1].hp, 19, "it still jabs");
  assert.deepEqual((n.sides[0].board || []).map(b => b.uid), [],
    "and it leaves the arena rather than being marked in place");
  assert.ok((n.sides[0].grave || []).some(c => c.uid === 70), "…into the graveyard");
});

test("DRIVEN: the answer names a uid, and the LIVE object is what moves", {skip}, () => {
  /* THE SHEET HANDS BACK ITS OWN COPY — spread, with `_jab` stamped on
     it so the answer knows which zone the choice came from. Filing that
     throwaway would put a private field in the graveyard and, worse,
     file a card as it looked when the sheet was BUILT rather than when
     it was answered (`openPrompt` drains a queue, so another prompt can
     resolve in between). The spec's own fields, READ (v3.53).

     AND THE FIXTURE HAS TO REACH `applyAnswer` AT ALL. With one candidate
     the jab resolves directly and this path never runs, so the sabotage
     comes back SILENT (v3.62) — it needs TWO board permanents, which is
     also the only shape where the filing is observable. */
  const ally = uid => ({uid, name: "Probe Ally Dagger " + uid, tt: "Assassin Ally - Dagger",
                        ty: ["Assassin", "Ally", "Dagger"], power: 1, life: 2, cost: 1,
                        pitch: 1, def: null, kw: [], tx: ""});
  const st = board({board: [{uid: 70, kind: "ally", card: ally(70)},
                            {uid: 71, kind: "ally", card: ally(71)}]});
  const n = activate(st);
  assert.ok(n.prompt, "two legal targets is a real choice");
  const m = pick(n, 0);
  const graved = (m.sides[0].grave || []).find(c => c.uid === 70);
  assert.ok(graved, "the chosen permanent reaches the graveyard");
  assert.ok(!("_jab" in graved),
    "…as the LIVE object, not the sheet's copy with its private field on it");
  assert.deepEqual((m.sides[0].board || []).map(b => b.uid), [71], "and only it leaves");
});

/* ---- 5. THE PRINTED TARGET IS A LEGALITY, ON BOTH BOARDS ----------- */

test("judge REFUSES it with no legal dagger, before the piece is destroyed", {skip}, () => {
  /* v3.11: refusing after the ability resolves costs the player the Arms
     piece for a play the rules never allowed. */
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("jab-legal"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const plain = H.card("Brutal Assault", 1);
  const mk = gear => Object.assign(
    H.state({hand: [], res: 9, ap: 1, gear}, {}, {turn: 3, actor: 0, builds: [bd, {}]}),
    {phase: "action", step: "reaction", priority: 0, passed: [], attacker: 0, stack: [],
     pend: {card: plain, by: 0, total: 4, ga: false, ops: [], onHit: []}});
  const why = J.legal(mk([dd]), {t: "activate", uid: dd.uid, from: "gear"}, 0);
  assert.ok(why && /dagger/.test(why),
    "no dagger, no legal target — got: " + String(why));
  /* THE POSITIVE CONTROL, or this passes against a branch that refuses
     the ability outright (v3.98: ask for BOTH answers). */
  assert.equal(J.legal(mk([dd, dagger(50)]), {t: "activate", uid: dd.uid, from: "gear"}, 0), null,
    "…and with one it is a legal play");
});

test("the TRAINER refuses it too — v3.01's shape is the recurring defect here", {skip}, () => {
  /* A SOURCE SCAN, because `tryPlay` is a closure inside `Battle` and no
     drill can reach it. What is pinned is that the trainer asks the SAME
     reader with the SAME exclusion — a second derivation is how the two
     boards come to disagree about what is a legal target. */
  const src = fs.readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(src, /DawnEffects\.jabTargets\(act\(s\), _jb\.filter, \(s\.pend && s\.pend\.card \|\| \{\}\)\.uid\)/,
    "the trainer must ask `jabTargets`, with the active chain link excluded");
  assert.match(src, /fx\.daggerJab/, "…off the parsed field, not a re-derivation");
});
