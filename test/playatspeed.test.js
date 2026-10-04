/* ======================================================================
   A CARD PLAYED AT INSTANT SPEED ON THE TRAINER — ONE BODY (v4.95)

   The trainer had four doors that play a card outside its own action
   phase (a reaction from hand, a reaction from the arsenal, Iyslander's
   arsenal instant, an instant on the opponent's turn) and each was its
   own copy of "play a card". Every one:

     * charged the PRINTED cost, so no tax, discount or Frostbite reached it;
     * refused unless that cost was already FLOATING, which RULING
       2026-08-01 forbids (no pitching to bank; a card is pitched on
       demand) and which CR 4.4.3e makes impossible on the opponent's turn;
     * resolved through `runOps`/`attackRx` directly, so nothing a play
       RECORDS was recorded;
     * and read a defence reaction's value BEFORE its text ran.

   The table did none of that wrong — `judge.commitPlay` pays on demand and
   resolves through `execute`. Found by reading every `judge.legal` refusal
   against the trainer's doors, the reverse of v4.91's census.

   `effects.playAtSpeed` is the one body, and these drills DRIVE it through
   judge's own context (`test/helpers/judged.js`), because the doors are
   React closures no drill can reach. What the doors still own — the window
   and the zone — is pinned by source scan at the end.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* Vanilla fuel: something to pitch, with no rules text, so a failure can
   never be the fuel being misread. */
const fuel = n => ({name: "Fuel" + n, uid: "F" + n, pitch: 3, power: null, def: 2, cost: 0,
                    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const SWING = {name: "Swing", uid: "SW", pitch: 0, power: 6, def: 0, cost: 0,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []};
const card = (nm, p, uid) => ({...H.card(nm, p), uid});

/* Seat 0 DEFENDS against seat 1's swing — the trainer's block window. */
const defending = (mine, theirs) => H.state(
  Object.assign({res: 0, ap: 0}, mine),
  Object.assign({res: 0}, theirs || {}),
  {actor: 0, turnPlayer: 1});
const withSwing = g => ({...g, pend: {card: SWING, by: 1, from: "hand", total: 6, base: 6}});
const play = (g, c, from, o) => H.fx(g, (f, n) => f.playAtSpeed(n, c, from, o));

/* ---- PITCHED ON DEMAND -------------------------------------------------- */

test("a defence reaction is pitched for on demand, never refused for not floating", {skip}, () => {
  H.db();
  /* Unmovable prints cost 3. The trainer held 0 and said "float resources
     before the window opens" — on the opponent's turn, where CR 4.4.3e has
     just emptied the pool. */
  const um = card("Unmovable", 1, "UM");
  const g = withSwing(defending({hand: [um, fuel(1), fuel(2)]}));
  const out = play(g, um, "hand", {window: "defense-reaction"});
  assert.equal(out.why, null);
  const sd = out.game.sides[0];
  assert.ok(!sd.hand.some(c => c.uid === "UM"), "the card left the hand");
  assert.ok(sd.grave.some(c => c.uid === "UM"), "and reached the graveyard");
  assert.equal(sd.pitch.length, 1, "exactly the shortfall was pitched — one blue for a cost of 3");
  assert.equal(sd.res, 0, "and the pool spent to nothing");
  assert.equal(out.dv, um.def, "it defends for its printed number");
  assert.equal(sd.blockRx.length, 1);
  assert.equal(sd.blockRx[0].def, um.def);
  assert.equal(sd.ap, 0, "a defence reaction costs no action point (CR 8.1.1)");
});

test("…and refused, with NOTHING moved, when the hand cannot raise it", {skip}, () => {
  H.db();
  const um = card("Unmovable", 1, "UM");
  const g = withSwing(defending({hand: [um]}));   /* nothing else to pitch */
  const out = play(g, um, "hand", {window: "defense-reaction"});
  assert.match(out.why, /costs 3/);
  assert.deepEqual(out.game.sides[0].hand.map(c => c.uid), ["UM"], "the card never left the hand");
  assert.deepEqual(out.game.sides[0].pitch, [], "and nothing was pitched for a play that could not happen");
  assert.equal(out.game.sides[0].res, 0);
});

test("the card being played is never pitched for itself", {skip}, () => {
  H.db();
  /* With only the card and one fuel the shortfall can be covered only by
     pitching the fuel; a pitcher that reached for the card itself would
     cover 3 with Unmovable's own pitch value. */
  const um = card("Unmovable", 1, "UM");
  const g = withSwing(defending({hand: [um, fuel(1)]}));
  const out = play(g, um, "hand", {window: "defense-reaction"});
  assert.equal(out.why, null);
  assert.deepEqual(out.game.sides[0].pitch.map(c => c.uid), ["F1"]);
});

/* ---- PRICED THROUGH effCost --------------------------------------------- */

test("a printed discount reaches the reaction — Reduce to Runechant", {skip}, () => {
  H.db();
  /* "This costs {r} less to play for each Runechant you control." Printed
     1, so the trainer demanded 1 floating from a Viserai holding a
     Runechant, for a card that costs him nothing. */
  const rr = card("Reduce to Runechant", 1, "RR");
  const rune = {card: {...H.tok("Runechant"), uid: "ru1"}, kind: "token", uid: "ru1", spent: false};
  const g = withSwing(defending({hand: [rr], board: [rune]}));
  const out = play(g, rr, "hand", {window: "defense-reaction"});
  assert.equal(out.why, null, "free with a Runechant out — nothing to pitch and nothing owed");
  assert.equal(out.game.sides[0].res, 0);
  assert.deepEqual(out.game.sides[0].pitch, []);
  /* the NEGATIVE half: without the token it costs its printed 1 and the
     empty hand cannot raise it */
  const bare = play(withSwing(defending({hand: [rr]})), rr, "hand", {window: "defense-reaction"});
  assert.match(bare.why, /costs 1/);
});

test("a Frostbite taxes the reaction and SHATTERS on it — the play it taxes is the play that destroys it", {skip}, () => {
  H.db();
  const fb = {card: {...H.tok("Frostbite"), uid: "fb1"}, kind: "token", uid: "fb1", spent: false};
  const sig = card("Sigil of Suffering", 1, "SG");          /* printed cost 0 */
  const g = withSwing(defending({hand: [sig, fuel(1)], board: [fb]}));
  const out = play(g, sig, "hand", {window: "defense-reaction"});
  assert.equal(out.why, null);
  const sd = out.game.sides[0];
  assert.equal(sd.pitch.length, 1, "the +1 tax was pitched for — the printed 0 was not the price");
  assert.equal(sd.res, 2, "3 pitched, 1 spent on the tax");
  assert.ok(!sd.board.some(b => b.uid === "fb1"), "and the Frostbite shattered on the play it taxed");
});

/* ---- RESOLVED THROUGH execute, AND READ AFTER -------------------------- */

test("Sigil of Suffering's own arcane meets its own +1{d} (RULING 2026-08-22)", {skip}, () => {
  H.db();
  /* "Deal 1 arcane damage to the attacking hero. If you've dealt arcane
     damage this turn, this gets +1{d}." The trainer asked `defendValue`
     BEFORE the ops ran, so the condition was always unmet and the card
     blocked for its printed number — while judge, reading after
     `execute`, gave the ruled value. */
  const sig = card("Sigil of Suffering", 1, "SG");
  const g = withSwing(defending({hand: [sig]}, {hp: 20}));
  const out = play(g, sig, "hand", {window: "defense-reaction"});
  assert.equal(out.why, null);
  assert.equal(out.game.sides[1].hp, 19, "the arcane landed on the attacking hero");
  assert.equal(out.dv, (sig.def || 0) + 1, "so the reaction defends for its printed number plus one");
  assert.equal(out.game.sides[0].blockRx[0].def, (sig.def || 0) + 1);
});

test("from the ARSENAL a reaction knows where it came from — Springboard Somersault", {skip}, () => {
  H.db();
  /* "If this was played from arsenal, it gets +2{d}." The zone is the
     door's answer, so the same card from hand is the control. */
  const ss = card("Springboard Somersault", 2, "SS");
  const fromArs = play(withSwing(defending({hand: [], arsenal: ss})), ss, "arsenal", {window: "defense-reaction"});
  const fromHand = play(withSwing(defending({hand: [ss]})), ss, "hand", {window: "defense-reaction"});
  assert.equal(fromArs.why, null);
  assert.equal(fromArs.game.sides[0].arsenal, null, "the arsenal emptied");
  assert.equal(fromArs.dv, (ss.def || 0) + 2, "+2{d} from the arsenal");
  assert.equal(fromHand.dv, ss.def || 0, "and its printed number from hand");
});

test("the play is RECORDED — the turn history sees a reaction", {skip}, () => {
  H.db();
  const sig = card("Sigil of Suffering", 1, "SG");
  const g = withSwing(defending({hand: [sig]}));
  const before = (g.sides[0].hist.playTy || []).length;
  const out = play(g, sig, "hand", {window: "defense-reaction"});
  assert.equal((out.game.sides[0].hist.playTy || []).length, before + 1,
    "`hist.playTy` saw nothing when the door resolved through `runOps`");
});

test("the optional additional cost is pitched for and its rider fires — Staunch Response", {skip}, () => {
  H.db();
  const st = card("Staunch Response", 1, "ST");
  const fx = P.fxParse(st);
  assert.ok(fx.addPay, "Staunch prints an additional cost");
  const hand = [st, fuel(1), fuel(2)];               /* 6 to pitch: 2 + 4 */
  const paid = play(withSwing(defending({hand})), st, "hand", {window: "defense-reaction", addPaid: true});
  const unpaid = play(withSwing(defending({hand})), st, "hand", {window: "defense-reaction", addPaid: false});
  assert.equal(paid.why, null);
  assert.equal(unpaid.why, null);
  assert.equal(paid.game.sides[0].pitch.length, 2, "both fuels pitched for 2 + 4");
  assert.equal(unpaid.game.sides[0].pitch.length, 1, "one fuel for the printed 2 alone");
  assert.ok(paid.dv > unpaid.dv, "the rider is the whole difference in what it defends for");
  assert.equal(paid.game._addPaid, undefined, "the answer does not survive the play");
});

test("an instant on the opponent's turn costs no action point", {skip}, () => {
  H.db();
  /* Window "instant": CR 8.1.6. A seat holds no action point on the
     opponent's turn (CR 4.4.3e), so a charge would be NEGATIVE-AP. */
  const inst = {name: "Zap Test", uid: "ZT", pitch: 1, cost: 1, def: null, power: null,
                tt: "Generic Instant", ty: ["Generic", "Instant"], tx: "Draw a card.", kw: []};
  const g = defending({hand: [inst, fuel(1)], deck: [fuel(9)]});
  P.fxReset();
  const out = play(g, inst, "hand", {window: "instant"});
  assert.equal(out.why, null);
  assert.equal(out.game.sides[0].ap, 0);
  assert.ok(out.game.sides[0].hand.some(c => c.uid === "F9"), "and it resolved — the card was drawn");
  P.fxReset();
});

/* ---- AN ATTACK REACTION IS REFUSED BEFORE ANYTHING MOVES --------------- */

test("an attack reaction with no legal target is refused with nothing spent", {skip}, () => {
  H.db();
  /* Puncture targets a sword or dagger attack; the swing is a vanilla
     action card. Asked only inside `execute`, the card was paid for and
     filed before `attackRx` refused. */
  const pu = card("Puncture", 1, "PU");
  const g = {...H.state({res: 0, hand: [pu, fuel(1)]}, {}, {actor: 0, turnPlayer: 0}),
             pend: {card: SWING, by: 0, from: "hand", total: 6, base: 6}};
  const out = play(g, pu, "hand", {window: "attack-reaction"});
  assert.ok(out.why, "refused");
  assert.deepEqual(out.game.sides[0].hand.map(c => c.uid), ["PU", "F1"], "the card never left the hand");
  assert.deepEqual(out.game.sides[0].pitch, [], "and nothing was pitched for it");
  /* and with no attack at all */
  const none = play({...g, pend: null}, pu, "hand", {window: "attack-reaction"});
  assert.match(none.why, /no attack to react to/);
});

test("an attack reaction pitched for on demand pumps the open link", {skip}, () => {
  H.db();
  const ae = card("Agile Engagement", 1, "AE");         /* Warrior attack, cost 1, +3 */
  const atk = {...SWING, tt: "Warrior Action - Attack", ty: ["Warrior", "Action", "Attack"]};
  const g = {...H.state({res: 0, hand: [ae, fuel(1)]}, {}, {actor: 0, turnPlayer: 0}),
             pend: {card: atk, by: 0, from: "hand", total: 6, base: 6}};
  const out = play(g, ae, "hand", {window: "attack-reaction", handBlockers: 0, defenders: []});
  assert.equal(out.why, null);
  assert.equal(out.game.sides[0].pitch.length, 1, "pitched for the 1");
  assert.ok(out.game.sides[0].grave.some(c => c.uid === "AE"));
  const E = require("../engine/effects");
  assert.equal(E.rxPumpTotal(out.game), 3, "the +3 is on the link");
});

/* ---- PREMISES ----------------------------------------------------------- */

test("PREMISE: no pool reaction emits a `defBuff` op, so neither board extracts one", {skip}, () => {
  /* The trainer's doors used to add `defBuffOf(fx.ops)` to a played
     reaction's value; judge never did. Both resolve through `execute` now,
     where `runOps` only LOGS a `defBuff`. That agreement is safe only while
     no reaction prints one — measured over the pinned pool. */
  H.db();
  const seen = new Set(), bad = [];
  for(const r of require("../data/pool.json")) for(const p of [1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name || !P.isRx(c)) continue;
    const k = c.name + "|" + c.pitch; if(seen.has(k)) continue; seen.add(k);
    if((P.fxParse(c).ops || []).some(o => o && o[0] === "defBuff")) bad.push(k);
  }
  assert.ok(seen.size > 40, "the scan saw the reactions (" + seen.size + ")");
  assert.deepEqual(bad, []);
});

/* ---- THE FOUR DOORS ASK THE ONE BODY ------------------------------------ */

test("every instant-speed door in the trainer goes through `playAtSpeed`", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const door = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a) + 10));
  const hand = door("const playRx = (i, addPaid) => setG", "const playRxA = () => setG");
  const ars  = door("const playRxA = () => setG", "const playArsenalInstant = () => setG");
  const ai   = door("const playArsenalInstant = () => setG", "const playFoeTurnRx = i => setG");
  const ft   = door("const playFoeTurnRx = i => setG", "const foePassWindow = ");
  assert.match(hand, /_EFX\.playAtSpeed\(s, c, "hand", \{window: rxWin,/);
  /* THE HAND DOOR'S OWN TWO QUESTIONS, both about what the hand could
     raise — the refusal and the additional-cost offer. Asked of the pool
     alone, a reaction the body would happily pitch for is refused before
     it is reached, and Staunch Response's choice is never offered on the
     opponent's turn, when nothing floats. */
  assert.match(hand, /const bank = act\(s\)\.res \+ DawnParser\.payCeiling\(act\(s\), c\);\s*if\(bank < cost\) return L\(s,/);
  assert.match(hand, /if\(addPaid === undefined && fx\.addPay && bank >= cost \+ fx\.addPay\.cost\)/);
  assert.match(ars,  /_EFX\.playAtSpeed\(s, c, "arsenal", \{window: "attack-reaction",/);
  assert.match(ars,  /_EFX\.playAtSpeed\(s, c, "arsenal", \{window: "defense-reaction",/);
  assert.match(ai,   /_EFX\.playAtSpeed\(s, c, "arsenal", \{window: "instant"\}\)/);
  assert.match(ft,   /_EFX\.playAtSpeed\(s, c, "hand", \{window: "instant"\}\)/);
  /* AND NONE OF THEM CHARGES OR RESOLVES ON ITS OWN ANY MORE — the four
     shapes that were each door's private copy */
  for(const [nm, body] of [["playRx", hand], ["playRxA", ars], ["playArsenalInstant", ai], ["playFoeTurnRx", ft]]){
    assert.ok(body.length > 300, nm + " anchors moved");
    assert.doesNotMatch(body, /c\.cost\|\|0/, nm + " prices the printed cost again");
    assert.doesNotMatch(body, /runOps\(/, nm + " resolves through runOps again — nothing is recorded");
    assert.doesNotMatch(body, /_EFX\.attackRx\(/, nm + " calls attackRx directly again");
    assert.doesNotMatch(body, /float resources|not enough floating/, nm + " asks for floating resources again (RULING 2026-08-01)");
  }
});
