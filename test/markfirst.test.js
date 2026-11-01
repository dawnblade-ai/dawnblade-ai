/* ============================================================
   A CARD THAT MARKS FROM THE HAND GOES BEFORE THE ATTACK THAT CASHES IT
   (QUEUE v5 H26). Reaper's Call prints "Instant - Discard this: Mark target
   opposing hero". The seat policy never activated a hand ability, so the
   card was only ever swung as a 1-3 power attack, and Arakni's mark engine
   ("your attacks with stealth that are attacking a marked hero get +1{p}
   and go again if they land") ran on whatever marks the daggers and Mark
   the Prey happened to leave. `judge.markFirst` names the card, and only
   when a stealth (or marked-gated) attack is there to spend the mark on.

   Every drill is a fire / don't-fire pair on the same hand: ONE fact moves
   between the two members, so a drill that coincides with something else
   cannot pass for either. Asserted on the action, its reason key, and the
   board (mark, graveyard, action point, the stealth bonus on the swing).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, H.card(n, p), {uid});
const plainAtk = uid => ({uid, name: "Probe " + uid, pitch: 1, power: 3, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
/* seat 0 is the Arakni-shaped seat: `builds[0]` carries the hero's stealth passive
   (`stealthMarkedBuff`), which is what makes a stealth attack at a marked hero worth more */
const table = (hand, o) => {
  o = o || {};
  const g = H.state({name: "Arakni", res: 0, ap: o.ap != null ? o.ap : 1, hand, deck: [plainAtk("d1")]},
    {hp: 20, hand: [], deck: [plainAtk("t1")], marked: !!o.marked},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{stealthMarkedBuff: o.buff != null ? o.buff : 1}, {}]});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
};
const isMark = (a, uid) => !!a && a.t === "activate" && a.from === "hand" && a.uid === uid;

test("H26: Reaper's Call is discarded to mark before a stealth attack that cashes it", {skip}, () => {
  const g = table([ent("Reaper's Call", 3, "rc"), ent("Mark of the Black Widow", 1, "bw")]);
  assert.equal(J.legal(g, {t: "activate", from: "hand", uid: "rc"}, 0), null, "control: the hand ability is legal");
  const x = SP.explain(g, 0);
  assert.ok(isMark(x.action, "rc"), "marks first: " + JSON.stringify(x.action));
  assert.equal(x.key, "markFirst", "under its own reason");
  assert.ok(SP.CALL_WHY.markFirst, "and the reason is worded");
  assert.deepEqual(x.action, SP.act(g, 0), "explain is act plus the reason");
  assert.match(x.line, /^Discard Reaper's Call/, "the line names the discard, not a swing");
  assert.deepEqual(J.markFirst(g, 0), {uid: "rc", takers: ["bw"]});
});

test("H26: the discard marks them, spends no action point, and the next play is the stealth swing", {skip}, () => {
  const g = table([ent("Reaper's Call", 3, "rc"), ent("Mark of the Black Widow", 1, "bw")]);
  const r = J.reduce(g, SP.act(g, 0), 0);
  assert.ok(r.state && !r.error, JSON.stringify(r).slice(0, 160));
  let n = H.drain(r.state);
  assert.equal(n.sides[1].marked, true, "they are marked");
  assert.equal(n.sides[0].ap, 1, "an instant costs no action point (CR 8.1.6)");
  assert.ok(n.sides[0].hand.every(c => c.uid !== "rc") && n.sides[0].grave.some(c => c.uid === "rc"),
    "Reaper's Call is in the graveyard");
  const a = SP.act(n, 0);
  assert.deepEqual([a.t, a.uid], ["play", "bw"], "now the stealth attack: " + JSON.stringify(a));
  const p = J.reduce(n, a, 0);
  assert.ok(p.state && !p.error, JSON.stringify(p).slice(0, 160));
  assert.ok(p.state.feed.some(l => /strikes from stealth at a marked hero/.test(l)),
    "the swing reads the mark: +1 and go again if it lands");
});

test("H26 pair: already marked, nothing to do first", {skip}, () => {
  const hand = [ent("Reaper's Call", 3, "rc"), ent("Mark of the Black Widow", 1, "bw")];
  assert.ok(isMark(SP.act(table(hand), 0), "rc"), "control: unmarked fires");
  const g = table(hand, {marked: true});
  assert.equal(J.markFirst(g, 0), null);
  assert.ok(!isMark(SP.act(g, 0), "rc"), "a second mark is a card for nothing: " + JSON.stringify(SP.act(g, 0)));
});

test("H26 pair: a mark with no attack to spend it on is held", {skip}, () => {
  const g = table([ent("Reaper's Call", 3, "rc"), ent("Mark of the Black Widow", 1, "bw")]);
  assert.ok(isMark(SP.act(g, 0), "rc"), "control: with the stealth attack it fires");
  const alone = table([ent("Reaper's Call", 3, "rc")]);
  assert.equal(J.markFirst(alone, 0), null, "Reaper's Call alone has nothing else to cash it");
  const dull = table([ent("Reaper's Call", 3, "rc"), plainAtk("pa")]);
  assert.equal(J.markFirst(dull, 0), null, "a plain attack neither prints stealth nor reads a mark");
  assert.ok(!isMark(SP.act(dull, 0), "rc"));
});

test("H26 pair: the stealth bonus is the hero's, so the same hand on another build holds", {skip}, () => {
  const hand = [ent("Reaper's Call", 3, "rc"), ent("Mark the Prey", 1, "mp")];
  assert.ok(isMark(SP.act(table(hand, {buff: 1}), 0), "rc"), "control: with the stealth passive it fires");
  const g = table(hand, {buff: 0});
  assert.equal(J.markFirst(g, 0), null, "Mark the Prey reads no mark of its own, and nothing pays for stealth");
  assert.ok(!isMark(SP.act(g, 0), "rc"));
});

test("H26 pair: no action point, no attack to lead into", {skip}, () => {
  const hand = [ent("Reaper's Call", 3, "rc"), ent("Mark of the Black Widow", 1, "bw")];
  assert.ok(isMark(SP.act(table(hand, {ap: 1}), 0), "rc"), "control: with the point it fires");
  const g = table(hand, {ap: 0});
  assert.equal(J.markFirst(g, 0), null);
  assert.ok(!isMark(SP.act(g, 0), "rc"));
});

test("H26: a hand ability that does not mark never triggers it", {skip}, () => {
  const g = table([ent("Agile Windup", 1, "aw"), ent("Mark of the Black Widow", 1, "bw")]);
  assert.equal(J.legal(g, {t: "activate", from: "hand", uid: "aw"}, 0), null, "control: Agile Windup's ability is legal");
  assert.equal(J.markFirst(g, 0), null, "Create an Agility token is not a mark");
  assert.ok(!isMark(SP.act(g, 0), "aw"));
});
