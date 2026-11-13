/* ============================================================
   THE POWER AN ATTACK WOULD HAVE IF PLAYED NOW (effpower)

   `judge.effPowerNow(g, seat, uid, from)` asks `effects.condMetNow` - the ONE body
   `execute`'s condition loop reads - about each conditional "+N{p}" a card prints on
   itself, without playing the card. A gate that is TRUE from public facts and the
   seat's own record counts; a gate that waits on the wall, the payment or a zone the
   card will have left counts for nothing (printed power, never a guess).

   Each drill asks for the NUMBER THAT MOVED and for the number that did NOT.
   Sabotages applied once each, by hand, and restored (see the commit message).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";
const SPP = () => require("../tools/selfplay.js");
const SP = require("../engine/sparring.js");
const J = H.J;

const side = (g, i, o) => ({...g, sides: g.sides.map((s, k) => k === i ? {...s, ...o} : s)});
/* a real deck card by name, from the first hero whose deck holds it, and the match around it */
function find(name){
  const {match, W} = SPP();
  for(const h of W.HEROES){
    const g = match(h.k, h.k === "kayo" ? "dash" : "kayo", "ep-" + name, 0);
    const c = g.sides[0].deck.find(x => x.name === name);
    if(c) return {g, c};
  }
  throw new Error("no deck holds " + name);
}
const withHist = (g, o) => side(g, 0, {hist: {...g.sides[0].hist, ...o}});

test("a gate that is true raises the number; the same hand with the gate shut does not", {skip}, () => {
  const {g, c: mb} = find("Mocking Blow");
  const shut = side(g, 0, {hand: [mb], arsenal: null, res: 3});
  const open = withHist(shut, {booed: 1});
  const a = J.effPowerNow(shut, 0, mb.uid, "hand"), b = J.effPowerNow(open, 0, mb.uid, "hand");
  assert.equal(a.power, +mb.power, "no boo yet: the printed power");
  assert.equal(a.bonus, 0);
  const printed = require("../engine/parser.js").fxParse(mb).conds.find(e => e.cond === "booed").op[1];
  assert.ok(printed > 0 && b.bonus === printed, "the crowd has booed: its +" + printed + " is live");
  assert.equal(b.power, +mb.power + printed);
  assert.deepEqual(b.gates, ["booed"]);
});

test("the number is the one the engine then declares (one body, not a second opinion)", {skip}, () => {
  const {g, c: mb} = find("Mocking Blow");
  const open = withHist(side(g, 0, {hand: [mb], arsenal: null, res: 3}), {booed: 1});
  const want = J.effPowerNow(open, 0, mb.uid, "hand").power;
  const out = J.reduce(open, {t: "play", uid: mb.uid, from: "hand", target: "hero"}, 0);
  assert.equal(out.error, null);
  const n = H.drain(out.state);
  const total = (n.pend && n.pend.total) != null ? n.pend.total
    : ((n.chain || []).slice(-1)[0] || {}).dmg;
  assert.equal(total, want, "declared total equals the reader's answer");
});

test("it writes nothing", {skip}, () => {
  const {g, c: mb} = find("Mocking Blow");
  const open = withHist(side(g, 0, {hand: [mb], arsenal: null, res: 3}), {booed: 1});
  const before = JSON.stringify(open);
  J.effPowerNow(open, 0, mb.uid, "hand");
  assert.equal(JSON.stringify(open), before);
});

test("a gate on a zone the card will have left is undecidable: printed power", {skip}, () => {
  /* Fault Line pumps "if you have a card in arsenal". Played FROM the arsenal the slot
     is empty by the time the gate is read, so the answer must not count it. From hand
     with another card in the arsenal the gate is open and counts. */
  const {g, c: fl} = find("Fault Line");
  const other = g.sides[0].deck.find(x => x !== fl && x.name !== "Fault Line");
  const base = side(g, 0, {res: 6});
  const inArs = side(base, 0, {hand: [], arsenal: fl});
  const fromArs = J.effPowerNow(inArs, 0, fl.uid, "arsenal");
  assert.equal(fromArs.bonus, 0, "the card itself would be leaving the arsenal");
  assert.equal(fromArs.power, fromArs.base);
  const fromHand = J.effPowerNow(side(base, 0, {hand: [fl], arsenal: other}), 0, fl.uid, "hand");
  assert.ok(fromHand.bonus > 0, "an arsenal card is there: the gate is open (" + JSON.stringify(fromHand) + ")");
  assert.deepEqual(fromHand.gates, ["hasArsenal"]);
});

test("a gate that waits on the payment is undecidable: printed power", {skip}, () => {
  /* Rough Up asks about the pitch zone, which the cost has not filled yet; even with a
     pitched card sitting there from an earlier play it is not asked. */
  const {g, c} = find("Rough Up");
  const pitched = {...g.sides[0].deck.find(x => x !== c && +x.power >= 6) || c, uid: "pz1"};
  const st = side(g, 0, {hand: [c], arsenal: null, res: 3, pitch: [pitched]});
  const e = J.effPowerNow(st, 0, c.uid, "hand");
  assert.equal(e.bonus, 0);
  assert.equal(e.power, e.base);
});

test("a card the seat does not hold there answers null", {skip}, () => {
  const {g, c: mb} = find("Mocking Blow");
  const st = side(g, 0, {hand: [], arsenal: null});
  assert.equal(J.effPowerNow(st, 0, mb.uid, "hand"), null);
});

test("the rule policy leads with the attack that is bigger NOW, and says why", {skip}, () => {
  const {g, c: mb} = find("Mocking Blow");
  const alt = g.sides[0].deck.find(x => x !== mb && +x.power === 2 && +x.cost === 0 && /Attack/.test(x.tt || ""));
  assert.ok(alt, "an equal-cost 2-power attack to compare against");
  const shut = side(g, 0, {hand: [mb, alt], arsenal: null, res: 3});
  const open = withHist(shut, {booed: 1});
  const a = SP.explain(shut, 0), b = SP.explain(open, 0);
  assert.equal(a.action.uid, alt.uid, "gate shut: the printed 2 beats the printed 1");
  assert.equal(a.key, "biggestAttack");
  assert.equal(b.action.uid, mb.uid, "gate open: 1+3 beats 2");
  assert.equal(b.key, "effPower");
});

test("gate off (SPXEFFPOW=none): the printed ranking, byte for byte", {skip}, () => {
  const {execFileSync} = require("node:child_process");
  const prog = `
    const {match, W} = require("./tools/selfplay.js"); const SP = require("./engine/sparring.js");
    const g0 = match("lyath", "kayo", "ep-Mocking Blow", 0);
    const mb = g0.sides[0].deck.find(x => x.name === "Mocking Blow");
    const alt = g0.sides[0].deck.find(x => x !== mb && +x.power === 2 && +x.cost === 0 && /Attack/.test(x.tt || ""));
    const g = {...g0, sides: g0.sides.map((s, k) => k ? s : {...s, hand: [mb, alt], arsenal: null, res: 3, hist: {...s.hist, booed: 1}})};
    const r = SP.explain(g, 0); console.log(JSON.stringify({uid: r.action.uid, key: r.key, alt: alt.uid, mb: mb.uid}));`;
  const out = JSON.parse(execFileSync(process.execPath, ["-e", prog],
    {cwd: require("node:path").join(__dirname, ".."), env: {...process.env, SPXEFFPOW: "none"}}).toString().trim());
  assert.equal(out.uid, out.alt, "off: the printed 2 leads even though Mocking Blow is 4 now");
  assert.equal(out.key, "biggestAttack");
});
