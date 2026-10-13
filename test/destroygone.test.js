/* ============================================================
   A "DESTROY THIS" PRICE WHOSE PIECE IS GONE IS NOT A PRICE (v5.17)

   > "When this hits a hero, you may choose to destroy this and mark them."
   > — MARK OF THE HUNTSMAN · "…If damage is dealt this way, the dagger has
   > hit. Destroy the dagger." — DANGER DIGITS, Arakni's

   QUEUE item 4, CEO-verified and re-verified here. The jab makes the dagger
   HIT, its own offer is queued, and the jab's last printed sentence then
   destroys the dagger, so the offer was drained about a card already in the
   graveyard. Accepting destroyed nothing (`applyAnswer` found no piece and
   said nothing), the mark landed, and the feed claimed "destroyed Mark of
   the Huntsman — the rider resolves". An unpayable cost is inert, never
   free (v2.04).

   `prompts.promptDestroyGone` is the one reader. `buildPrompt` lapses the
   sheet, both drains print `promptLapseLine`, and `applyAnswer` refuses a
   crafted answer off the wire.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const spec = o => Object.assign({tag: "pay", side: 0, src: "Mark of the Huntsman", cost: 0,
  ops: [["mark", 1]], taps: false, destroyUid: 60, title: "t", hint: "h"}, o || {});
const piece = o => Object.assign({uid: 60, name: "Mark of the Huntsman"}, o || {});

test("CENSUS: every pool record whose pay sheet destroys its source is GEAR", {skip}, () => {
  /* `applyAnswer` destroys the piece out of the gear zone, so the reader
     asks the gear. Pinned both directions: a board permanent arriving with
     this price would lapse every time rather than be paid. */
  const DB = H.db(), rows = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    const px = r && P.fxParse(r).payCost;
    if(!px || !(px.destroySelf || px.selfDestroy)) continue;
    assert.ok((r.ty || []).some(t => t === "Equipment" || t === "Weapon"), r.name + " is not gear");
    rows.add(r.name);
  }
  assert.deepEqual([...rows].sort(),
    ["Beaten Trackers", "Mark of the Huntsman", "Refraction Bolters", "Silent Stilettos"]);
});

test("the READER: live in the payer's gear is payable; destroyed, absent or the other seat's is not", () => {
  const g = gear => ({sides: [{res: 9, gear}, {res: 9, gear: [piece()]}]});
  assert.equal(PM.promptDestroyGone(g([piece()]), spec()), false, "live in the gear");
  assert.equal(PM.promptDestroyGone(g([piece({destroyed: true})]), spec()), true, "marked destroyed");
  assert.equal(PM.promptDestroyGone(g([]), spec()), true, "gone (filed to the graveyard)");
  assert.equal(PM.promptDestroyGone(g([]), spec({side: 1})), false, "it is the PAYER's gear that is asked");
  assert.equal(PM.promptDestroyGone(g([]), spec({destroyUid: undefined})), false, "a price that destroys nothing");
  assert.equal(PM.promptDestroyGone(g([]), spec({tag: "pick"})), false, "and only a pay sheet");
});

test("buildPrompt lapses the sheet; the line says why; a live piece still asks", () => {
  const gone = {sides: [{res: 9, gear: []}, {res: 9}]};
  const live = {sides: [{res: 9, gear: [piece()]}, {res: 9}]};
  assert.equal(PM.buildPrompt(gone, spec()), null);
  assert.ok(PM.buildPrompt(live, spec()), "control: the piece is there, so it is a real choice");
  assert.equal(PM.promptLapseLine(gone, spec()),
    "Mark of the Huntsman is already gone — its price is to destroy it, so there is nothing to pay and the rider does not resolve.");
  assert.equal(PM.promptLapseLine(live, spec()), null);
});

test("AT THE TABLE: the drain lapses it, says so, and marks nobody", {skip}, () => {
  H.db();
  const base = H.state({gear: []}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const n = J.openPrompt({...base, promptQ: [spec()]});
  assert.ok(!n.prompt, "no sheet for a price that cannot be paid");
  assert.deepEqual(n.promptQ || [], [], "and the queue moved on");
  assert.ok(!n.sides[1].marked, "nobody is marked for free");
  assert.match(n.feed.map(f => f.t || f).join(" | "), /Mark of the Huntsman is already gone/);
  /* CONTROL: with the dagger still equipped the same spec is asked */
  const m = J.openPrompt({...H.state({gear: [piece()]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}),
                          promptQ: [spec()]});
  assert.ok(m.prompt && m.prompt.destroyUid === 60);
});

test("OFF THE WIRE: an accepted answer whose piece is gone resolves nothing", {skip}, () => {
  /* No board renders such a sheet — the game is frozen while one is live,
     so nothing can destroy the piece underneath it — but `reduce` is fed by
     JSON off a wire (v2.04). Built while the dagger was there, answered
     after it is gone. */
  H.db();
  const live = H.state({gear: [piece()]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const sheet = PM.promptChoose(PM.buildPrompt(live, spec()), "pay");
  const gone = {...live, prompt: sheet, sides: [{...live.sides[0], gear: []}, live.sides[1]]};
  const out = J.withEffects(gone, (fx, s) => fx.applyAnswer(s, sheet));
  const n = out.game || out;
  assert.ok(!n.sides[1].marked, "the rider did not resolve");
  /* CONTROL: answered while the piece is there, it pays and marks */
  const ok = J.withEffects({...live, prompt: sheet}, (fx, s) => fx.applyAnswer(s, sheet));
  assert.equal((ok.game || ok).sides[1].marked, true);
});

test("THE TRAINER's drain prints the same line, after the soak lapse", () => {
  /* `openPrompt` is a closure inside `Battle`; the driven rows above go
     through judge's twin, and this pins that the trainer asks the one body. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /if\(lapse\) return _EFX\.applyAnswer\(\{\.\.\.s, promptQ:rest\}, lapse\);\s*\/\*[^*]*\*\/\s*\{ const why = DawnPrompts\.promptLapseLine\(s, p\); if\(why\) s = L\(s, why\); \}/);
});
