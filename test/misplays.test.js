/* ============================================================
   THE CARRIED AI MISPLAYS (QA-A H-5, QA-B H-3/H-4/H-5; ship/ai-misplays)

   Four plays the seat policy made into nothing, each now asked of a judge
   reader (the policy reads no card text):

     Uphold Tradition  turned up and paid for with no ward aura to take its
                       +1{p} counter                    judge.landsNothing
     Frost Spike       a Frostbite into a hero with no exposed armour zone
                                                        judge.landsNothing
     Mage Master Boots destroyed for a non-attack go-again grant with no
                       non-attack action card to take it judge.landsNothing
     Bolt'n Boots      destroyed for go again on an arrow that already has it
                                                        judge.gaAbilityRedundant

   Each drill asks for the REFUSAL and for the MATCH: the same state with
   the one missing thing supplied, where the reader flips and the seat acts.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";
const SPP = () => require("../tools/selfplay.js");
const SP = require("../engine/sparring.js");
const J = H.J;

const side = (g, i, o) => ({...g, sides: g.sides.map((s, k) => k === i ? {...s, ...o} : s)});
const gearOf = (g, i, re) => g.sides[i].gear.find(x => re.test(x.name));

test("Uphold Tradition is not turned up with no ward aura to take its counter — and is, once there is one", {skip}, () => {
  const {match} = SPP();
  let g = side(match("enigma", "kayo", "mp-u", 0), 0, {hand: [], arsenal: null, res: 3});
  const up = gearOf(g, 0, /Uphold Tradition/);
  assert.equal(J.landsNothing(g, 0, up.uid, "gear"), true, "an empty board: the counter lands nowhere");
  const a = SP.act(g, 0);
  assert.ok(!(a && a.t === "activate" && a.uid === up.uid), "the seat does not pay for nothing: " + JSON.stringify(a));
  assert.equal(SP.explain(g, 0).key, "endTurnIdle", "and the call says why the turn ends with it unused");
  const isUp = x => x.t === "activate" && x.uid === up.uid;
  assert.ok(!SP.laCands(g, 0, null).some(isUp), "Sharp does not propose it either");

  const shield = {...H.card("Spectral Shield", 0), uid: "tokSS1"};
  g = side(g, 0, {board: [{card: shield, kind: "aura", spent: false, uid: "tokSS1"}]});
  assert.equal(J.landsNothing(g, 0, up.uid, "gear"), false, "a ward aura is there to take it");
  assert.ok(SP.laCands(g, 0, null).some(isUp), "so it is a candidate again");
});

test("Frost Spike is held against a hero with no exposed armour zone — and played into one", {skip}, () => {
  const {match} = SPP();
  let g = match("iyslander", "dash", "mp-f", 0);
  const fs = g.sides[0].deck.find(c => c.name === "Frost Spike");
  assert.ok(fs, "Iyslander decks Frost Spike");
  g = side(g, 0, {hand: [fs], arsenal: null, deck: g.sides[0].deck.filter(c => c !== fs), res: 3});
  assert.equal(J.landsNothing(g, 0, fs.uid, "hand"), true, "Dash wears all four armour pieces");
  const a = SP.act(g, 0);
  assert.ok(!(a && a.t === "play" && a.uid === fs.uid), "it is not played into nothing: " + JSON.stringify(a));

  g = side(g, 1, {gear: g.sides[1].gear.filter(x => !/Helm/.test(x.name))});
  assert.equal(J.landsNothing(g, 0, fs.uid, "hand"), false, "the head zone is exposed now");
  const b = SP.act(g, 0);
  assert.ok(b && b.t === "play" && b.uid === fs.uid, "so it is played: " + JSON.stringify(b));
});

test("Mage Master Boots' non-attack grant lands nothing with only an attack and an instant in hand — and lands with a non-attack action", {skip}, () => {
  const {match} = SPP();
  let g = match("gravy", "dash", "mp-g", 0);
  const boots = gearOf(g, 0, /Mage Master Boots/);
  const pick = re => g.sides[0].hand.concat(g.sides[0].deck).find(c => re.test(c.name));
  const barque = pick(/Battalion Barque/), throwC = pick(/Throw Caution/), portside = pick(/Portside Exchange/);
  g = side(g, 0, {hand: [barque, throwC], arsenal: null, grave: [], banish: [], res: 1});
  assert.equal(J.landsNothing(g, 0, boots.uid, "gear"), true,
    "an attack takes no non-attack grant, and an instant is not an action card");
  /* Loot the Arsenal is a non-attack action card, but its whole text is a grant for a
     Pirate ALLY attack: with none to take it, the seat holds it (grant-wait), so it is
     no taker for the boots either (gravy-kayo-1). */
  const loot = pick(/Loot the Arsenal/);
  assert.ok(loot, "Gravy decks Loot the Arsenal");
  g = side(g, 0, {hand: [barque, throwC, loot]});
  assert.ok(J.legal(g, {t: "play", uid: loot.uid, from: "hand"}, 0) == null, "Loot is legal to play");
  assert.equal(J.landsNothing(g, 0, boots.uid, "gear"), true, "but a grant the seat will hold is no taker");
  g = side(g, 0, {hand: [barque, throwC, portside]});
  assert.equal(J.landsNothing(g, 0, boots.uid, "gear"), false, "Portside Exchange is a non-attack action card");
});

test("Bolt'n Boots' go again is redundant on a link that already goes again — and not on one that does not", {skip}, () => {
  const {match} = SPP();
  const g0 = match("azalea", "dash", "mp-b", 0);
  const boots = gearOf(g0, 0, /Bolt'n Boots/);
  const arrow = {...H.card("Bolt'n' Shot", 1), uid: "arr1"};
  const open = ga => ({...g0, pend: {card: arrow, by: 0, ga, total: 4, ops: [], lateConds: []}});
  assert.equal(J.gaAbilityRedundant(g0, 0, boots.uid), false, "no link, nothing to be redundant about");
  assert.equal(J.gaAbilityRedundant(open(true), 0, boots.uid), true, "the arrow already goes again");
  assert.equal(J.gaAbilityRedundant(open(false), 0, boots.uid), false, "it does not, so the go again is real");
  /* the late "pumped above base" go again counts once the link IS above base */
  const late = (total) => ({...g0, pend: {card: arrow, by: 0, ga: false, total, ops: [],
    lateConds: [{cond: "pumped", op: ["ga"]}]}});
  assert.equal(J.linkGoesAgain(late(9)), true, "pumped far above its base, its own go again is certain");
  assert.equal(J.linkGoesAgain(late(0)), false, "at or below base it is not");
  /* a piece whose payout is anything but that go again is never redundant */
  const blossom = gearOf(g0, 0, /Blossom of Spring/);
  assert.equal(J.gaAbilityRedundant(open(true), 0, blossom.uid), false);
});

test("the gate: SPXFIX names the seats the fixes are on for, and the call key for each is in CALL_WHY", () => {
  for(const k of ["endTurnIdle", "rxGaHeld"]) assert.ok(SP.CALL_WHY[k], k);
  assert.ok(!/\b(uid|pend|gaQ|fx)\b/.test(SP.CALL_WHY.endTurnIdle + SP.CALL_WHY.rxGaHeld), "no identifiers in player-facing text");
});

test("Refraction Bolters is destroyed for go again when the kept action point buys a swing — and kept when it buys nothing", {skip}, () => {
  const {match} = SPP();
  const g0 = match("dorinthea", "arakni", "mp-r", 0);
  const bolters = gearOf(g0, 0, /Refraction Bolters/), blade = gearOf(g0, 0, /Dawnblade/);
  const sheet = (o, pend) => ({...side(g0, 0, {res: 1, hand: [], arsenal: null, ...o}),
    pend: {card: blade, by: 0, ga: false, total: 3, ops: [], lateConds: [], ...pend},
    prompt: {tag: "pay", side: 0, src: "Refraction Bolters", cost: 0, ops: [["ga"]], destroyUid: bolters.uid, choice: null}});
  /* Dorinthea's hit has lifted the Dawnblade's once-per-turn limit: one more swing is there */
  const live = sheet({weaponUsed: {}}, {});
  assert.equal(J.payBuysGoAgain(live, 0), true);
  const e = SP.explain(live, 0);
  assert.deepEqual(e.action, {t: "promptChoose", choice: "pay"}, "the piece is spent for the second swing");
  assert.equal(e.key, "payGoAgain");
  /* the refusals: nothing to swing, a link that already goes again, a sheet that also asks resources */
  const spent = sheet({weaponUsed: {[blade.uid]: true}}, {});
  assert.equal(J.payBuysGoAgain(spent, 0), false, "the weapon is spent and no attack is held: the point buys nothing");
  assert.equal(SP.act(spent, 0).choice, "decline");
  assert.equal(J.payBuysGoAgain(sheet({weaponUsed: {}}, {ga: true}), 0), false, "it already goes again");
  const priced = sheet({weaponUsed: {}}, {});
  assert.equal(J.payBuysGoAgain({...priced, prompt: {...priced.prompt, cost: 2}}, 0), false, "a resource price is the price rule's to weigh");
});

test("a soak that needs a card pitched is priced as the card: 1 point is not worth one, 2 is, lethal always is", () => {
  const E = require("../engine/effects.js");
  const bar = n => ({uid: "b" + n, name: "Barrier " + n, kind: "barrier", amount: n, cost: n});
  const live = (amount, opts, avail) => ({amount, options: opts, avail});
  const sd = (res, hp) => ({res, hp, hand: [{uid: "h1", pitch: 3}]});
  /* the old price: resources only — a whole card pitched to stop 1 */
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 20)), [0], "the plain rule takes it");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 20), {cardPrice: true}), [],
    "priced as the card it pitches, 1 point is not worth it");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(1, 20), {cardPrice: true}), [0],
    "paid from what is already floating, nothing is pitched: taken");
  assert.deepEqual(E.soakPolicy(live(2, [bar(2)], 3), sd(0, 20), {cardPrice: true}), [0], "2 points for the card: taken");
  assert.deepEqual(E.soakPolicy(live(1, [bar(1)], 3), sd(0, 1), {cardPrice: true}), [0], "at lethal nothing held is worth more");
  const J = require("../engine/judge.js");
  const g = {sides: [sd(0, 20), sd(0, 20)], prompt: {tag: "soak", side: 0, ...live(1, [bar(1)], 3), sel: []}};
  assert.deepEqual(J.autoAnswer(g, {cardPrice: true}), {t: "promptConfirm"}, "the one answer body carries the ask");
  assert.deepEqual(J.autoAnswer(g), {t: "promptSel", i: 0});
});

test("Scout the Periphery's look goes where it adds information: their deck, unless their top is already known", {skip}, () => {
  H.db();
  const mk = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
  let n = H.state({name: "Fai", res: 9, ap: 9, hand: [mk("Scout the Periphery", 1, "spx1")],
                   deck: [{uid: "m1", name: "Mine One", pitch: 1}, {uid: "m2", name: "Mine Two", pitch: 2}]},
                  {name: "Them", deck: [{uid: "t1", name: "Theirs One", pitch: 3}, {uid: "t2", name: "Theirs Two", pitch: 1}]},
                  {actor: 0, turnPlayer: 0, seed: "z", turn: 3});
  n = J.reduce({...n, phase: "action", step: "layer", priority: 0, passed: []}, {t: "play", uid: "spx1", from: "hand"}, 0).state;
  assert.equal(n.prompt && n.prompt.tag, "modal");
  /* nothing known: their deck */
  let e = SP.explain(n, 0);
  assert.deepEqual(e.action, {t: "promptChoose", choice: 0});
  assert.equal(e.key, "lookFoe");
  /* their top is a known top already (a reveal both seats saw): your own deck is the news */
  const theirsKnown = side(n, 1, {deck: [{...n.sides[1].deck[0], _kt: true}, n.sides[1].deck[1]]});
  e = SP.explain(theirsKnown, 0);
  assert.deepEqual(e.action, {t: "promptChoose", choice: 1});
  assert.equal(e.key, "lookOwn");
  /* both known: back to theirs */
  const bothKnown = side(theirsKnown, 0, {deck: [{...n.sides[0].deck[0], _kt: true}, n.sides[0].deck[1]]});
  assert.deepEqual(J.lookChoice(bothKnown, 0), {i: 0, own: false});
  /* a standing look of this seat's own at their top counts as known too */
  const looked = {...n, revealed: {...n.sides[1].deck[0], _to: 0, _from: 1}};
  assert.deepEqual(J.lookChoice(looked, 0), {i: 1, own: true});
  /* any other modal: the reader says nothing and the policy answers as before */
  const other = {...n, prompt: {...n.prompt, options: [{label: "a", ops: [["draw", 1]]}, {label: "b", ops: [["res", 1]]}]}};
  assert.equal(J.lookChoice(other, 0), null);
  assert.equal(SP.explain(other, 0).key, "firstOption");
});

/* ---- TRAINER QA CENSUS: the defence reaction that stops the whole leak ---- */

test("defending, the cheapest reaction that stops the whole leak by itself goes first — and cheapest-first stands when the cheapest covers", {skip}, () => {
  const {match} = SPP();
  /* replayed to the first reaction window where Enigma defends and the cheapest legal
     defender leaves a leak a dearer one would close alone (enigma-kayo-0, census probe) */
  let n = match("enigma", "kayo", "enigma-kayo-0", 0), at = null;
  for(let i = 0; i < 6000 && !n.over && !at; i++){
    let moved = false;
    for(const seat of [0, 1]){
      const e = SP.explain(n, seat);
      if(seat === 0 && e.key === "rxFit"){ at = {n, e}; break; }
      if(!e.action) continue;
      const r = J.reduce(n, e.action, seat); if(r.error) continue;
      n = r.state; moved = true;
    }
    if(!moved) break;
  }
  assert.ok(at, "the fixture game reaches a fit");
  const sd = at.n.sides[0], hand = sd.hand.concat(sd.arsenal ? [sd.arsenal] : []);
  const wall = SP.wallOf(sd) + (sd.blockRx || []).reduce((t, l) => t + ((l && l.def) || 0), 0);
  const leak = at.n.pend.total - wall;
  const chosen = hand.find(c => c.uid === at.e.action.uid);
  assert.ok(chosen && (chosen.def || 0) >= leak, "the chosen card stops the whole leak by itself");
  const legal = hand.filter(c => J.legal(at.n, {t: "play", uid: c.uid, from: sd.arsenal && c.uid === sd.arsenal.uid ? "arsenal" : "hand"}, 0) == null
    && J.defendsNow(at.n, 0, c.uid, sd.arsenal && c.uid === sd.arsenal.uid ? "arsenal" : "hand"));
  const cheapest = legal.slice().sort((a, b) => (a.cost || 0) - (b.cost || 0) || (String(a.uid) < String(b.uid) ? -1 : 1))[0];
  assert.ok(cheapest && cheapest.uid !== chosen.uid && (cheapest.def || 0) < leak,
    "the cheapest legal defender would have left a leak — the case the fit is for");
  /* the refusal: shrink the attack until the cheapest card covers it — the fit does not fire */
  const small = {...at.n, pend: {...at.n.pend, total: wall + (cheapest.def || 0)}};
  assert.notEqual(SP.explain(small, 0).key, "rxFit");
});

/* ---- H-DAGGER: a weapon a pending grant pumps competes on its pumped power ---- */

test("a pending '+4 to your next dagger attack' makes the dagger swing outrank a bigger hand attack — and without it, the hand attack goes", {skip}, () => {
  const {match} = SPP();
  /* replayed (rule policy) to the first decision where Arakni holds a pending grant a weapon swing would take */
  let n = match("arakni", "kayo", "arakni-kayo-0", 0), at = null;
  for(let i = 0; i < 6000 && !n.over && !at; i++){
    let moved = false;
    for(const seat of [0, 1]){
      if(seat === 0 && n.turnPlayer === 0 && !n.prompt && !n.pend && J.grantedSwings(n, 0).length){
        const e = SP.explain(n, 0);
        if(e.key === "grantSwing"){ at = {n, e}; break; }
      }
      const a = SP.act(n, seat); if(!a) continue;
      const r = J.reduce(n, a, seat); if(r.error) continue;
      n = r.state; moved = true;
    }
    if(!moved) break;
  }
  assert.ok(at, "the fixture game reaches a pumped swing");
  const sw = J.grantedSwings(at.n, 0).find(x => x.uid === at.e.action.uid);
  assert.ok(sw && sw.bonus > 0, "the swing is one the pending grant pumps");
  assert.equal(at.e.action.t, "activate");
  /* the refusal: the same state without the pending grant ranks by printed power again */
  const bare = {...at.n, sides: at.n.sides.map((s, i) => i === 0 ? {...s, buffQ: [], buffNext: 0} : s)};
  assert.deepEqual(J.grantedSwings(bare, 0), []);
  assert.notEqual(SP.explain(bare, 0).key, "grantSwing");
});

/* ---- H-DAGGER residue: a grant held when no swing it pumps can be paid for ---- */

test("Up Sticks and Run waits when the dagger's {r}{r} is out of reach — and is played when it can be paid", {skip}, () => {
  const {match} = SPP();
  let g = match("arakni", "kayo", "mp-us", 0);
  const all = g.sides[0].hand.concat(g.sides[0].deck);
  const us = all.find(c => /Up Sticks and Run/.test(c.name));
  const red = all.find(c => c !== us && (+c.pitch || 0) === 1 && !(+c.power > 0) && !/Up Sticks/.test(c.name));
  const dagger = g.sides[0].gear.find(x => (x.ty || []).includes("Dagger"));
  assert.ok(us && red && dagger, "fixture cards");
  /* Up Sticks alone in hand: pitched for 1 it pays for nothing, played it leaves 0 for the {r}{r} */
  g = side(g, 0, {hand: [us], arsenal: null, res: 0, grave: [], gear: g.sides[0].gear.filter(x => x.power != null)});
  /* the retrieve is the only other text: with nothing to retrieve it is not a second payload */
  assert.equal(J.grantTakers(g, 0, us.uid, "hand"), null, "read as printed, the card is not a pure grant");
  assert.ok(Array.isArray(J.grantTakers(g, 0, us.uid, "hand", {idlePick: true})), "with the idle pick set aside, it is");
  const e = SP.explain(g, 0);
  assert.ok(!(e.action && e.action.t === "play" && e.action.uid === us.uid), "held: nothing left can pay the dagger's {r}{r}: " + JSON.stringify(e.action));
  assert.equal(e.key, "grantHold");
  /* a dagger IS in the graveyard and a red card could pay the retrieve's {r}: the pick is
     still idle, because this seat's own answer declines every priced pick (H12) */
  const graveDagger = {...dagger, uid: "gd1"};
  const priced = side(g, 0, {hand: [us, red], grave: [graveDagger]});
  assert.ok(Array.isArray(J.grantTakers(priced, 0, us.uid, "hand", {idlePick: true})),
    "a priced optional pick is set aside as well");
  /* the match: resources to pay the swing beside it — played */
  /* (a hand attack beside it, the shape the grant-first branch reads; with only a weapon to
     follow, the swing goes first whatever this reader says — a separate, older ordering) */
  const atk = all.find(c => c !== us && (+c.power || 0) > 0 && !(+c.cost > 0));
  const rich = side(g, 0, {res: 3, hand: [us, atk]});
  const a = SP.act(rich, 0);
  assert.ok(a && a.t === "play" && a.uid === us.uid, "with the swing payable it is played: " + JSON.stringify(a));
});

/* ---- a grant goes before the only attack left, a weapon swing it pumps (v6.16 open item) ---- */

test("with only a weapon to follow, the grant that pumps it goes first — and the swing goes alone when both cannot be paid", {skip}, () => {
  const {match} = SPP();
  /* Kayo vs Dorinthea, seed 0: her turn-2 hand is Warrior's Valor and three attack reactions */
  let n = match("kayo", "dorinthea", "kayo-dorinthea-0", 0), at = null;
  for(let i = 0; i < 6000 && !n.over && !at; i++){
    let moved = false;
    for(const seat of [0, 1]){
      const e = SP.explain(n, seat);
      if(seat === 1 && e.key === "grantBeforeSwing"){ at = {n, e}; break; }
      if(!e.action) continue;
      const r = J.reduce(n, e.action, seat); if(r.error) continue;
      n = r.state; moved = true;
    }
    if(!moved) break;
  }
  assert.ok(at, "the fixture game reaches the decision");
  const sd = at.n.sides[1];
  const grant = sd.hand.find(c => c.uid === at.e.action.uid);
  assert.equal(at.e.action.t, "play");
  assert.ok(grant && !(+grant.power > 0), "a non-attack card is played first");
  assert.ok(!sd.hand.some(c => +c.power > 0 && J.legal(at.n, {t: "play", uid: c.uid, from: "hand", target: "hero"}, 1) == null),
    "no hand attack is playable: only the weapon follows");
  const t = J.grantTakers(at.n, 1, grant.uid, "hand", {idlePick: true});
  assert.ok(t && t.some(k => k.from === "weapon"), "and the weapon swing is what the grant pumps");
  /* the refusal: nothing left to pitch, so the grant and the swing cannot both be paid */
  const poor = {...at.n, sides: at.n.sides.map((s, i) => i === 1 ? {...s, hand: [grant], res: 0} : s)};
  const e2 = SP.explain(poor, 1);
  assert.notEqual(e2.key, "grantBeforeSwing");
});
