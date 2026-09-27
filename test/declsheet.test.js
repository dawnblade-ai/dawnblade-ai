/* ============================================================
   A SHEET THE DECLARATION QUEUES IS ASKED AT THE DECLARATION (v4.80)

   CR 7.2 puts a "when this attacks" trigger on the stack above the attack,
   so it resolves in the attack step, before anyone declares a defender.
   The ops have fired there since v4.08; the SHEETS they queue did not
   open there. `effects.execute`'s attack branch stops at `_declared`
   (v2.73) and never reaches its own `openPrompt`, `judge.declareAttack`
   did not drain the queue, and the trainer ran its dummy's defend step
   straight after declaring. So every such sheet waited for the damage
   step and was answered after the damage it could change:

     Jack Be Quick           its printed +1{p} landed on a link that had
                             already dealt its damage
     Jittery Bones           its printed go again was lost
     Fire that Burns Within  its printed +2{p}, likewise
     Pick Up the Point       its dagger arrived too late to be jabbed on
                             this link, the whole reason v4.78 moved it
     a Runechant's soak      asked after the attack it resolves ahead of

   Measured over one ladder seed (210 games): 218 sheets now open in the
   attack step, 106 of them Beaten Trackers.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");

/* a table board: seat 0 to act, in its action phase */
function table(mine, theirs, seed){
  const g = H.state(Object.assign({name: "Briar", res: 9, ap: 1}, mine),
                    Object.assign({name: "Them", hp: 30, hand: [], deck: [{uid: "t1", name: "T"}]}, theirs),
                    {actor: 0, turnPlayer: 0, turn: 3, seed: seed || "decl"});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const card = (nm, p, uid) => Object.assign({}, H.card(nm, p), {uid});
/* play, then pass only while nobody is being asked anything */
function declare(g, uid){
  const r = J.reduce(g, {t: "play", uid, from: "hand"}, 0);
  assert.equal(r.error, null, "the play was refused: " + r.error);
  let n = r.state;
  for(let i = 0; i < 6 && !n.prompt && n.priority != null && n.step === "layer"; i++)
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  return n;
}
/* pass the link out, answering nothing */
function resolveLink(n){
  for(let i = 0; i < 16 && n.pend && n.step !== "resolution"; i++){
    if(n.priority == null) break;
    const r = J.reduce(n, {t: "pass"}, n.priority);
    if(r.error) break;
    n = r.state;
  }
  return n;
}
const answer = (n, seat, ...acts) => {
  for(const a of acts){ const r = J.reduce(n, a, seat); assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error); n = r.state; }
  return n;
};

/* ---- 1. THE PUMP AND THE GO AGAIN LAND ON THIS LINK ------------------- */

test("DRIVEN: Jack Be Quick asks in the ATTACK step, and its +1{p} and go again land", {skip}, () => {
  H.db();
  let n = declare(table({hand: [card("Jack Be Quick", 1, "jbq")], grave: [card("Nimblism", 1, "nim")]}), "jbq");
  assert.equal(n.prompt && n.prompt.src, "Jack Be Quick", "the optional cost was not asked");
  assert.equal(n.step, "attack", "…in the attack step — before anyone defends (CR 7.2)");
  assert.equal(n.sides[1].hp, 30, "…and before any damage");
  /* while it is live the game is frozen for BOTH seats */
  assert.ok(J.legal(n, {t: "pass"}, 1), "the defender acted while the attacker was being asked");
  n = answer(n, 0, {t: "promptSel", i: 0}, {t: "promptConfirm"});
  assert.equal(n.pend.total, 4, "the +1{p} is on the swing");
  n = resolveLink(n);
  assert.equal(n.sides[1].hp, 26, "…and it is dealt: 3 printed + 1");
  assert.equal(n.sides[0].ap, 1, "and the printed go again kept the action point (CR 5.3.5)");
  assert.equal(n._gaGrant, undefined, "and no grant is left on the state for the NEXT card (v3.93's leak)");
});

test("DRIVEN: declining it costs nothing and grants nothing — the control", {skip}, () => {
  H.db();
  let n = declare(table({hand: [card("Jack Be Quick", 1, "jbq")], grave: [card("Nimblism", 1, "nim")]}), "jbq");
  n = answer(n, 0, {t: "promptConfirm"});
  assert.deepEqual(n.sides[0].grave.map(c => c.uid).filter(u => u === "nim"), ["nim"], "the Nimblism stays");
  n = resolveLink(n);
  assert.equal(n.sides[1].hp, 27, "3 printed");
  assert.equal(n.sides[0].ap, 0, "and no go again");
});

test("DRIVEN: Jittery Bones' go again reaches the link that earned it", {skip}, () => {
  /* The destroyed top card carries watery grave (Barnacle), so the printed
     go again is granted. Before v4.80 the sheet was answered after
     `linkPayload` had spent the action point, and the grant was lost. */
  H.db();
  const run = top => {
    let n = declare(table({name: "Gravy", hand: [card("Jittery Bones", 1, "jb")], deck: [top, card("Brutal Assault", 1, "d2")]}), "jb");
    assert.equal(n.prompt && n.prompt.src, "Jittery Bones");
    assert.equal(n.step, "attack");
    n = answer(n, 0, {t: "promptChoose", choice: 1}, {t: "promptConfirm"});
    return resolveLink(n);
  };
  assert.equal(run(card("Barnacle", 1, "bar")).sides[0].ap, 1, "watery grave on top: go again");
  assert.equal(run(card("Brutal Assault", 3, "ba")).sides[0].ap, 0,
    "the control: no watery grave, no go again — so the point above is the card's, not a free one");
});

/* ---- 2. A SHEET ADDRESSED TO THE DEFENDER ----------------------------- */

test("DRIVEN: a Runechant's soak is the defender's call, and comes before their defend step", {skip}, () => {
  H.db();
  const rune = i => ({card: card("Runechant", 0, "r" + i), kind: "aura", spent: false, uid: "r" + i});
  const hood = card("Nullrune Hood", 0, "g1");
  let n = declare(table({hand: [card("Brutal Assault", 3, "a1")], board: [rune(1)]},
                        {gear: [hood], res: 3, hp: 20}), "a1");
  assert.equal(n.prompt && n.prompt.tag, "soak", "the soak was not asked");
  assert.equal(n.prompt.side, 1, "…of the DEFENDER");
  assert.equal(n.step, "attack", "…before their defend step");
  assert.ok(J.legal(n, {t: "pass"}, 0), "the attacker acted while the defender was being asked");
  n = answer(n, 1, {t: "promptConfirm"});
  assert.equal(n.prompt, null, "answered, nothing is waiting");
  assert.equal(n.sides[1].hp, 19, "the runechant's 1 arcane lands before the attack's damage");
  assert.equal(n.step, "attack", "and the attack step goes on from where it was");
});

/* ---- 3. THE TRAINER, WHICH NO DRILL CAN DRIVE ------------------------- */

const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "");
/* a closure, bounded at the next same-indent declaration (v4.57's safer form) */
function body(anchor){
  const a = HTML.indexOf(anchor);
  assert.ok(a > 0, anchor + " moved — re-anchor this drill");
  const rest = HTML.slice(a + 1);
  return strip(rest.slice(0, rest.search(/\n  (?:const|function) \w+/)));
}

test("the trainer asks the declaration's sheets BEFORE its dummy defends", {skip: false}, () => {
  const rp = body("  function resolvePlay(s, card, from, idx){");
  const pause = rp.indexOf("if((n.promptQ || []).length) return openPrompt({...n, _declPending: true});");
  assert.ok(pause > 0, "resolvePlay no longer pauses for the queue");
  assert.ok(rp.indexOf("_EFX.fileAttack(n, card, from)") < pause, "the attack is filed first, as it always was");
  assert.equal(rp.indexOf("dummyDefence("), -1, "the dummy's defend step is not inside resolvePlay any more");
  const ad = body("  function afterDeclare(n){");
  assert.ok(ad.indexOf("n.pend.total") > 0, "the dummy measures the LIVE total — a +{p} answered above is on it");
  assert.ok(ad.indexOf("dummyDefence(") > 0 && ad.indexOf("_EFX.afterDefenders(") > ad.indexOf("dummyDefence("));
  const op = body("  function openPrompt(s){");
  const at = op.indexOf("if(done._declPending){"), del = op.indexOf("delete o._declPending;", at),
        res = op.indexOf("return afterDeclare(o);", at);
  assert.ok(at > 0 && del > at && res > del && res - at < 140,
    "openPrompt resumes the declaration once the queue empties — and deletes the marker FIRST, "
    + "or a sheet queued by the defend step re-enters it");
});

test("the trainer freezes while a sheet is live, as `judge.legal` does", {skip: false}, () => {
  /* A declaration's sheet opens with the attack half-declared, so a card
     played or a turn ended underneath it would run the dummy's defend step
     against a state nothing expected. Four entry points, one rule. */
  for(const [anchor, guard] of [
    ["  const tryPlay = (card,from,idx,half) => setG(s=>{", "if(s.prompt) return s;"],
    ["  const activateInstant = (card, from, idx) => setG(s=>{", "if(s.over || s.prompt) return s;"],
    ["  const endTurn = () => setG(s=>{", "if(s.over||s.mode!==\"act\"||s.prompt) return s;"],
    ["  const closeChain = () => setG(s=>{", "if(s.mode!==\"act\" || !s.chainOpen || s.prompt) return s;"]]){
    const b = body(anchor);
    assert.ok(b.indexOf(guard) >= 0 && b.indexOf(guard) < 80, anchor.trim() + " does not open by refusing a live sheet");
  }
});

/* ---- 4. THE TABLE'S DRAIN, AS WRITTEN --------------------------------- */

test("judge.declareAttack opens the queue on the settled state", {skip: false}, () => {
  const src = strip(fs.readFileSync(path.join(ROOT, "engine", "judge.js"), "utf8"));
  const a = src.indexOf("function declareAttack(");
  const b = src.indexOf("\nfunction ", a + 10);
  const da = src.slice(a, b);
  assert.ok(/return openPrompt\(settle\(n\)\);\s*\}\s*$/.test(da),
    "declareAttack must end by opening the queue on the settled state");
});
