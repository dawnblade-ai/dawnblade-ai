/* ============================================================
   conditionals.test.js — THE SMALL CONDITIONALS (v6.43)

   The eighth reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).
   Six staged rows printed one clause the engine could not read, verbatim
   (data/staged.js):

     Olde Leather Boots      "If you've been attacked 2 or more times this
                              turn, this gets +2{d}."
     Galaxxi Black           "If you've played a card from your banished
                              zone this turn, this gets +2{p}."
     Bloodfrenzy Gloomblade  "If you've dealt damage to the defending hero
       (both printings)       this turn, this gets go again."
     Plundersong Gloomblade  "When this hits a hero, they banish a card in
                              their arsenal."
     Looking for a Scrap     "As an additional cost to play this, you may
                              banish a card with 1{p} from your graveyard. If
                              you do, this gets +1{p} and go again."

   Three new per-turn facts (`hist.attacked`, `hist.heroDmg`,
   `hist.banPlay`), each recorded where it becomes true, in effects.js.
   CR 1.4.5 (verbatim): "An attack-target is the target of an attack that is
   declared when the attack or attack-layer is put onto the stack." CR 7.2.3b
   (verbatim): "The controller of the attack-target and their hero become the
   'defending hero' until the active chain link resolves or the combat chain
   closes." CR 6.4.10a: prevented damage is not dealt (quoted verbatim at
   `effects.creditHeroDmg`). CR 7.3.1: "a hero being attacked".

   `dealtDmg` (Second Strike's "if you've dealt damage this turn") is NOT
   this fact and is unchanged: it reads `hist.atk || hist.arc`, recorded in
   tools/approx.js (`dealt-damage-reads-attacks`).

   Plus the handoff's Usurp open item (b): `effPowerNow` and the Coach count
   usurp's +2, with the cost site's weapon/ally exclusion.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const PM = require("../engine/prompts.js");
const A = require("../engine/advisor.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
/* a drill twin: unique name (fxParse memoizes on name|pitch), its own text */
const twin = (base, name, tx) => ({...base, name, tx, uid: undefined});
const hist = o => Object.assign(S.freshHist(), o);
const fry = uid => ({...H.card("Fry", 3), uid, _gy: 1});          /* a 1{p} card */
const assault = uid => ({...H.card("Brutal Assault", 3), uid});    /* a 4{p} attack */
const tokE = uid => ({uid, card: {...H.tok("Runechant"), uid}, kind: "aura"});

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const start = (a, b) => table(H.state(Object.assign({res: 9, ap: 1}, a), Object.assign({hp: 20, hand: []}, b),
  {actor: 0, turnPlayer: 0, turn: 3}));
function act(g, a, seat){
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " refused");
  return out.state;
}
const play = (g, uid, from) => act(g, {t: "play", uid, from: from || "hand"}, 0);
function toLink(g){ for(let i = 0; i < 12 && !g.pend; i++) g = H.move(g); assert.ok(g.pend, "no chain link opened"); return g; }
function resolve(g){ for(let i = 0; i < 40 && g.pend; i++){ const m = H.move(g); if(m === g) break; g = m; } return g; }
/* to the defend step, declare `block` for seat 1, then pass it out */
function defendWith(g, block){
  for(let i = 0; i < 8 && g.step !== "defend"; i++) g = act(g, {t: "pass"}, g.priority);
  assert.equal(g.step, "defend", "never reached the defend step");
  for(const u of block) g = act(g, {t: "defend", uid: u}, 1);
  return resolve(g);
}

/* ---- the readers ------------------------------------------------------- */

test("every clause of the six rows reads, each into its own record", {skip}, () => {
  H.db();
  const rows = [["Olde Leather Boots", 0], ["Galaxxi Black", 0], ["Bloodfrenzy Gloomblade", 1],
                ["Bloodfrenzy Gloomblade", 3], ["Plundersong Gloomblade", 0], ["Looking for a Scrap", 0]];
  for(const [nm, p] of rows){
    const fx = P.fxParse(staged(nm, null, p));
    assert.equal(fx.tier, "full", nm + " has an unread clause: " + JSON.stringify(fx.clauses.filter(x => x.st === "skip")));
  }
  assert.deepEqual(P.fxParse(staged("Olde Leather Boots")).defSelf, {amt: 2, when: "attackedN", n: 2});
  assert.deepEqual(P.fxParse(staged("Galaxxi Black")).conds.map(e => [e.cond, e.op]), [["banPlayed", ["self", 2]]]);
  for(const p of [1, 3])
    assert.deepEqual(P.fxParse(staged("Bloodfrenzy Gloomblade", null, p)).conds.map(e => [e.cond, e.op]), [["dealtHero", ["ga"]]]);
  assert.deepEqual(P.fxParse(staged("Plundersong Gloomblade")).onHitHero, [["foeArsBanish", 1]]);
  const sc = P.fxParse(staged("Looking for a Scrap"));
  assert.deepEqual(sc.banCost, {zone: "grave", filter: {powerGe: 1, powerLe: 1}});
  assert.deepEqual(sc.conds.map(e => [e.cond, e.op]), [["banCostPaid", ["self", 1]], ["banCostPaid", ["ga"]]]);
  assert.equal(sc.optCost, undefined, "the cost is a queued prompt (optCost), which drains after the card resolves");
});

test("the refusals: a subject or a rider it cannot pin leaves the card unread", {skip}, () => {
  const base = staged("Looking for a Scrap");
  const tw = (n, tx) => P.fxParse(twin(base, "Scrap Drill " + n, tx));
  /* a bare card is unpinned; a bound with "or more" is not "with 1{p}" */
  for(const [n, tx] of [["A", "As an additional cost to play this, you may banish a card from your graveyard. If you do, this gets +1{p}."],
                        ["B", "As an additional cost to play this, you may banish a card with 1{p} or more from your graveyard. If you do, this gets +1{p}."],
                        ["C", "As an additional cost to play this, you may banish a card with 1{p} from your graveyard. If you do, this gets frobnicated."]]){
    const fx = tw(n, tx);
    assert.equal(fx.banCost, undefined, n + ": an unpinned cost was claimed");
    assert.notEqual(fx.tier, "full", n + ": the card reads full with its cost unread");
  }
  /* the control: the printed shape with a different printed number reads that number */
  assert.deepEqual(tw("D", "As an additional cost to play this, you may banish a card with 3{p} from your graveyard. If you do, this gets +1{p}.").banCost,
    {zone: "grave", filter: {powerGe: 3, powerLe: 3}});
  /* "dealt damage this turn" stays `dealtDmg`; the hero sentence is its own */
  const bf = staged("Bloodfrenzy Gloomblade");
  assert.deepEqual(P.fxParse(twin(bf, "Frenzy Drill A", "If you've dealt damage this turn, this gets go again.")).conds.map(e => e.cond), ["dealtDmg"]);
  /* an "attacked" line on another number reads that number; a different stat refuses */
  const ob = staged("Olde Leather Boots");
  assert.deepEqual(P.fxParse(twin(ob, "Boots Drill A", "If you've been attacked 3 or more times this turn, this gets +1{d}.")).defSelf,
    {amt: 1, when: "attackedN", n: 3});
  assert.equal(P.fxParse(twin(ob, "Boots Drill B", "If you've been attacked 2 or more times this turn, this gets +2{p}.")).defSelf, undefined);
});

/* ---- "if you've been attacked 2 or more times this turn" ---------------- */

test("an attack at the hero counts once for the defending seat; one at an ally does not (CR 1.4.5)", {skip}, () => {
  H.db();
  const g = start({hand: [assault("a1")]});
  const atHero = H.execute(g, assault("a1"), "hand", 0, {});
  assert.equal((atHero.game || atHero).sides[1].hist.attacked, 1, "an attack at the hero was not counted");
  assert.equal((atHero.game || atHero).sides[0].hist.attacked, 0, "the attacker was counted as attacked");
  const atAlly = H.execute(g, assault("a1"), "hand", 0, {target: {kind: "ally", side: 1, uid: "al"}});
  assert.equal((atAlly.game || atAlly).sides[1].hist.attacked, 0, "an attack at an ally counted as the hero attacked");
  assert.equal(S.freshHist().attacked, 0, "the turn boundary does not reset the count");
});

test("Olde Leather Boots: the count reaches 2 on the second attack, and the wall's value body pays +2{d}", {skip}, () => {
  /* two real attacks at the table: the defending seat's count is 1, then 2 */
  let g = start({hand: [assault("a1"), assault("a2")], ap: 2}, {gear: [staged("Olde Leather Boots", "ob1")]});
  g = resolve(toLink(play(g, "a1")));
  assert.equal(g.sides[1].hist.attacked, 1, "the first attack was not counted");
  g = toLink(play(g, "a2"));
  assert.equal(g.sides[1].hist.attacked, 2, "the second attack was not counted");
  /* the reader both boards' walls call, both directions */
  const ob = staged("Olde Leather Boots");
  assert.equal(E.defendValue(g.sides[1], ob, {base: 0}), 2, "the Boots did not get +2{d} on the second attack");
  assert.equal(E.defendValue({hist: hist({attacked: 1})}, ob, {base: 0}), 0, "+2{d} on the first attack");
  /* v6.45: a printed-0{d} piece may be declared now (RULING, user, 2026-11-16),
     so the +2 is reachable at the table; tools/approx.js
     `zero-defence-gear-refused` is closed and its probe drives it. */
});

/* ---- "if you've dealt damage to the defending hero this turn" ---------- */

test("damage credited where it lands on the hero: combat, arcane, direct — and never when prevented", {skip}, () => {
  H.db();
  /* combat, unblocked */
  let g = resolve(toLink(play(start({hand: [assault("a1")]}), "a1")));
  assert.equal(g.sides[1].hp, 16);
  assert.equal(g.sides[0].hist.heroDmg, 1, "combat damage to the hero was not credited");
  /* combat blocked to nothing */
  let b = start({hand: [assault("a1")]}, {hand: [{...H.card("Brutal Assault", 3), uid: "d1"}, {...H.card("Wounding Blow", 1), uid: "d2"}]});
  b = defendWith(toLink(play(b, "a1")), ["d1", "d2"]);
  assert.equal(b.sides[1].hp, 20, "fixture: the wall did not stop the attack");
  assert.equal(b.sides[0].hist.heroDmg, 0, "an attack blocked to nothing credited damage");
  assert.equal(b.sides[0].hist.atk, 1, "fixture: the attack was not counted as an attack (dealtDmg's record)");
  /* arcane and direct damage, then the same with a ward that prevents all of it */
  const s = start({});
  assert.equal(H.runOps(s, [["arcane", 1]], "drill").sides[0].hist.heroDmg, 1, "arcane on the hero was not credited");
  assert.equal(H.runOps(s, [["dmg", 2]], "drill").sides[0].hist.heroDmg, 1, "direct damage on the hero was not credited");
  const warded = start({}, {ward: 5});
  const w = H.runOps(warded, [["dmg", 2]], "drill");
  assert.equal(w.sides[1].hp, 20, "fixture: the ward did not prevent the damage");
  assert.equal(w.sides[0].hist.heroDmg, 0, "prevented damage was credited as dealt (CR 6.4.10a)");
});

test("Bloodfrenzy Gloomblade: go again after damage to the hero, not after an attack that dealt none", {skip}, () => {
  for(const p of [1, 3]){
    const bf = staged("Bloodfrenzy Gloomblade", "bf1", p);
    const yes = toLink(play(start({hand: [bf], hist: hist({heroDmg: 1})}), "bf1"));
    assert.equal(yes.pend.ga, true, "pitch " + p + ": no go again after damage to the hero");
    /* `dealtDmg`'s record would say yes here; the hero sentence must not */
    const no = toLink(play(start({hand: [bf], hist: hist({atk: 1, arc: 0})}), "bf1"));
    assert.equal(no.pend.ga, false, "pitch " + p + ": go again from an attack that dealt no damage");
  }
  /* driven end to end: one attack lands, then the Gloomblade goes again */
  const bf = staged("Bloodfrenzy Gloomblade", "bf1", 1);
  let g = start({hand: [assault("a1"), bf], ap: 2});
  g = resolve(toLink(play(g, "a1")));
  g = toLink(play(g, "bf1"));
  assert.equal(g.pend.ga, true, "the Gloomblade did not go again after a real hit");
});

/* ---- "if you've played a card from your banished zone this turn" ------- */

test("Galaxxi Black: +2{p} once a card was played from the banished zone this turn", {skip}, () => {
  H.db();
  const bf = staged("Bloodfrenzy Gloomblade", "bf9", 3);
  /* the fact: a card played from banish is counted, one from hand is not */
  const fromBan = toLink(play(start({banish: [bf], hand: []}), "bf9", "banish"));
  assert.equal(fromBan.sides[0].hist.banPlay, 1, "a play from the banished zone was not recorded");
  const fromHand = toLink(play(start({hand: [bf]}), "bf9"));
  assert.equal(fromHand.sides[0].hist.banPlay, 0, "a play from hand was recorded as from banish");
  /* the weapon: base 1, +2 once the fact holds */
  const gx = staged("Galaxxi Black", "gx1");
  const hot = H.execute(start({hist: hist({banPlay: 1})}), gx, "weapon", 0, {});
  assert.equal((hot.game || hot).pend.total, 3, "Galaxxi Black did not get +2{p}");
  const cold = H.execute(start({}), gx, "weapon", 0, {});
  assert.equal((cold.game || cold).pend.total, 1, "Galaxxi Black got +2{p} with nothing played from banish");
});

/* ---- "when this hits a hero, they banish a card in their arsenal" ------ */

test("Plundersong Gloomblade: the hit banishes the card in their arsenal; a blocked swing does not", {skip}, () => {
  const pg = () => staged("Plundersong Gloomblade", "pg1");
  const ars = () => ({...H.card("Fry", 3), uid: "ar1"});
  let hit = resolve(toLink(play(start({hand: [pg()]}, {arsenal: ars()}), "pg1")));
  assert.equal(hit.sides[1].arsenal, null, "the arsenal card stayed");
  assert.ok((hit.sides[1].banish || []).some(c => c.uid === "ar1"), "the arsenal card was not banished");
  let miss = start({hand: [pg()]}, {arsenal: ars(), hand: [{...H.card("Brutal Assault", 3), uid: "d1"}]});
  miss = defendWith(toLink(play(miss, "pg1")), ["d1"]);
  assert.equal(miss.sides[1].hp, 20, "fixture: the swing was not blocked to nothing");
  assert.equal(miss.sides[1].arsenal && miss.sides[1].arsenal.uid, "ar1", "a swing that did not hit banished the arsenal");
});

/* ---- the optional graveyard banish cost --------------------------------- */

test("Looking for a Scrap: asked before it resolves; paid is +1{p} and go again, declined is printed", {skip}, () => {
  H.db();
  const scrap = () => staged("Looking for a Scrap", "sc1");
  const grave = () => [fry("g1"), fry("g3"), {...H.card("Brutal Assault", 3), uid: "g2", _gy: 1}];
  let g = play(start({hand: [scrap()], grave: grave()}), "sc1");
  assert.equal(g.pending && g.pending.kind, "bancost", "the cost was not asked before the card resolves");
  assert.deepEqual(g.pending.uids, ["g1"], "the offer is not one uid per different card with 1{p}");
  const paid = toLink(act(g, {t: "bancost", uid: "g1"}, 0));
  assert.equal(paid.pend.total, 5, "paid: no +1{p}");
  assert.equal(paid.pend.ga, true, "paid: no go again");
  assert.deepEqual(paid.sides[0].banish.map(c => c.uid), ["g1"], "paid: the card was not banished");
  assert.deepEqual(paid.sides[0].grave.map(c => c.uid), ["g3", "g2"]);
  assert.equal(paid._banCostUid, undefined, "the answer was left on the state for the next card");
  const no = toLink(act(g, {t: "bancost", uid: null}, 0));
  assert.equal(no.pend.total, 4, "declined: power moved");
  assert.equal(no.pend.ga, false, "declined: go again anyway");
  assert.deepEqual(no.sides[0].banish, [], "declined: a card was banished");
  /* nothing that can pay: no question, the printed card */
  const none = toLink(play(start({hand: [scrap()], grave: [{...H.card("Brutal Assault", 3), uid: "g2", _gy: 1}]}), "sc1"));
  assert.equal(none.pend.total, 4);
  assert.equal(none.pend.ga, false);
  /* execute re-derives: a uid that is not a 1{p} card in the graveyard pays nothing */
  const bad = H.execute({...start({grave: grave()}), _banCostUid: "g2"}, scrap(), "hand", 0, {});
  assert.equal((bad.game || bad).pend.total, 4, "a card the subject excludes paid the cost");
  assert.deepEqual(PM.banCostChoice(scrap(), {grave: grave()}), ["g1"]);
  assert.equal(PM.banCostChoice(scrap(), {grave: []}), null);
  assert.equal(PM.banCostChoice(assault("x"), {grave: grave()}), null, "a card with no such cost asked");
});

test("the question's refusals, and the AI answers through a reader with its own reason keys", {skip}, () => {
  const scrap = staged("Looking for a Scrap", "sc1");
  const g = play(start({hand: [scrap], grave: [fry("g1")]}), "sc1");
  assert.match(String(J.legal(g, {t: "bancost", uid: "zz"}, 0)), /can't pay the additional cost/);
  assert.equal(J.legal(g, {t: "bancost", uid: null}, 0), null, "declining was refused");
  assert.ok(J.legal(g, {t: "bancost", uid: "g1"}, 1), "the other seat answered the question");
  assert.match(String(J.legal(g, {t: "pass"}, 0)), /additional cost/);
  assert.match(String(J.legal(start({}), {t: "bancost", uid: null}, 0)), /nothing is asking/);
  assert.ok(J.PENDING_KINDS.includes("bancost") && J.ACTIONS.includes("bancost"));
  assert.deepEqual(SP.act(g, 0), {t: "bancost", uid: "g1"});
  assert.equal(SP.explain(g, 0).key, "bancost");
  /* every candidate bills its owner from the banished zone and cannot be played from there: decline */
  const debt = {...twinCard("Debt Drill", "Blood Debt"), uid: "g7", _gy: 1};
  const d = play(start({hand: [scrap], grave: [debt]}), "sc1");
  assert.deepEqual(d.pending.uids, ["g7"]);
  assert.equal(J.banCostWorth(d, 0, "g7"), -1);
  assert.deepEqual(SP.act(d, 0), {t: "bancost", uid: null});
  assert.equal(SP.explain(d, 0).key, "bancostNo");
  assert.ok(SP.CALL_WHY.bancost && SP.CALL_WHY.bancostNo, "a reason key has no call text");
});
/* a 1{p} card printing blood debt and nothing else (a drill twin) */
function twinCard(name, tx){ return {...H.card("Fry", 3), name, tx, kw: ["Blood Debt"]}; }

/* ---- THE TRAINER'S QUESTION, cut out of index.html and run ------------ */
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("the trainer asks the same reader, a decline is an answer, and the table has the buttons", {skip}, () => {
  H.db();
  const a = HTML.indexOf("const maybeBanCost = (s,card,from,idx) => {");
  const b = HTML.indexOf("const maybeUsurp = (s,card,from,idx) => {");
  assert.ok(a > 0 && b > a, "maybeBanCost .. maybeUsurp moved — re-anchor this drill");
  const calls = [];
  let held = null;
  const T = new Function("act", "DawnParser", "DawnPrompts", "maybeCharge", "setG",
    HTML.slice(a, b) + "\nreturn {maybeBanCost, confirmBanCost};")(
    s => s.sides[0], P, PM, (s) => { calls.push(s); return {...s, charged: true}; },
    f => { held = f(held); });
  const scrap = staged("Looking for a Scrap", "sc1");
  const g = start({hand: [scrap], grave: [fry("g1")]});
  const q = T.maybeBanCost(g, scrap, "hand", 0);
  assert.equal(q.mode, "bancostpick", "the trainer asked nothing");
  assert.deepEqual(q.pending.uids, ["g1"]);
  held = q; T.confirmBanCost(null);
  assert.equal(held._banCostUid, null, "the decline does not ride on the state");
  held = q; T.confirmBanCost("g1");
  assert.equal(held._banCostUid, "g1", "the answer does not ride on the state");
  assert.equal(calls.length, 2, "an answer does not go on to the next cost");
  const plain = T.maybeBanCost(start({hand: [scrap]}), scrap, "hand", 0);
  assert.ok(plain.charged && plain.mode !== "bancostpick", "an empty graveyard asked the trainer a question");
  const wpn = T.maybeBanCost(g, scrap, "weapon", 0);
  assert.ok(wpn.charged, "a swing was asked a play cost");
  assert.match(HTML, /const bancost = kindIs\("bancost"\);/, "the table's demux has no branch for the question");
  assert.match(HTML, /fire\(\{t:"bancost",uid:u\}\)/, "the table's button answers with the wrong action");
  assert.match(HTML, /fire\(\{t:"bancost",uid:null\}\)/, "the table has no Decline");
  assert.match(HTML, /g\.mode==="bancostpick" \? \(<>/, "the trainer's action bar has no buttons for the question");
  /* the trainer's own routes into the shared facts */
  assert.match(HTML, /n = _EFX\.noteAttacked\(n, 0\);/, "the dummy's swing does not count as an attack");
  assert.match(HTML, /n = _EFX\.creditHeroDmg\(n, 1 - actorOf\(n\), through\);/, "the dummy's damage is not credited");
});

/* ---- USURP'S +2 IN THE READERS (Usurp open item b) --------------------- */

test("effPowerNow and the Coach count usurp's +2 only when a Runechant can pay, never on a swing", {skip}, () => {
  H.db();
  const gb = staged("Demonbound Gloomblade", "us1");
  const withRune = start({hand: [gb], board: [tokE("t1")]});
  const bare = start({hand: [gb]});
  const e1 = J.effPowerNow(withRune, 0, "us1", "hand");
  assert.equal(e1.power, gb.power + 2, "effPowerNow does not count usurp");
  assert.ok(e1.gates.includes("usurp"));
  assert.equal(J.effPowerNow(bare, 0, "us1", "hand").power, gb.power, "usurp counted with no Runechant");
  const viaFx = H.fx(withRune, (f, n) => f.effPowerNow(n, 0, gb, "weapon"));
  assert.equal(viaFx.power, gb.power, "a weapon swing counted usurp's +2");
  /* the Coach: +2 for the swing, less the Runechant that is spent and so does not pop */
  const cold = A.advCardOut(gb, bare, {runeDmg: 1});
  const hot = A.advCardOut(gb, withRune, {runeDmg: 1});
  assert.equal(hot - cold, 2, "the Coach did not count usurp's +2 net of the spent Runechant (+1 rune, +2, -1)");
});
