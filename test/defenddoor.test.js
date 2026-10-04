/* ======================================================================
   THE TRAINER'S DEFEND DOOR ASKS WHAT judge.legal ASKS (v4.96)

   The second half of the reverse census (v4.95 read the play doors). Read
   against `judge.legal`'s defend refusals, `toggleBlock` was missing three:

     * the DEFENDER CAP (dominate, Confidence, overpower) — `parser.defCapWhy`
       is the one body now, and judge asks it too;
     * CR 7.3.2b, a piece already spent on this chain — the player's side
       never recorded `chainBlocked` at all, while a comment in `finishBlock`
       said that field "refuses the re-declaration";
     * and its two refusals were SILENT returns, with `handAct` pre-screening
       so a dimmed card was a dead tap.

   The cap and the re-block are LATENT on this board — the dummy's swing is
   fabricated with no card and it has one action point — and both are drilled
   anyway, because a rule on one board is the recurring defect (v3.01). The
   body is DRIVEN; the door, a React closure, is pinned by source scan.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");

const atk = (name, kw, tx) => ({name, uid: "A", power: 6, def: 0, cost: 0, pitch: 1,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: tx || "", kw: kw || []});
const hcard = (uid, o) => Object.assign({name: "H" + uid, uid, def: 3, pitch: 1, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []}, o || {});
const piece = uid => ({name: "Helm" + uid, uid, def: 1, tt: "Generic Equipment - Head",
  ty: ["Generic", "Equipment", "Head"], tx: "", kw: []});

test("dominate: one card from hand, and equipment does not count (the recorded reading)", () => {
  P.fxReset();
  const pend = {card: atk("Dom Test", ["Dominate"], "**Dominate**")};
  assert.equal(P.defCapWhy(pend, [], hcard(1), false), null, "the first card is free to declare");
  const one = [{card: hcard(1), gear: false}];
  assert.match(P.defCapWhy(pend, one, hcard(2), false), /can't be defended by more than 1 card from hand/);
  assert.equal(P.defCapWhy(pend, one, piece(9), true), null, "a piece of equipment is not a card from hand");
  /* …and a piece ALREADY declared does not use up the one card from hand —
     the declared list carries which side of the wall each entry is on */
  assert.equal(P.defCapWhy(pend, [{card: piece(9), gear: true}], hcard(1), false), null,
    "a raised helm was counted as the dominate card");
  P.fxReset();
});

test("a granted cap rides on the link, and an attack with none caps nothing", () => {
  const pend = {card: atk("Plain Test"), defCap: {n: 2, count: "nonBlock"}};
  const two = [{card: hcard(1), gear: false}, {card: piece(9), gear: true}];
  assert.match(P.defCapWhy(pend, two, hcard(2), false), /more than 2 non-block cards/,
    "Confidence counts EQUIPMENT — a Block is the one thing it excludes");
  assert.equal(P.defCapWhy({card: atk("Free Test")}, two, hcard(2), false), null);
  assert.equal(P.defCapWhy(null, two, hcard(2), false), null, "no link, no cap — the trainer's dummy swing");
  /* a link with no card still names something */
  assert.match(P.defCapWhy({defCap: {n: 1, count: "hand"}}, [{card: hcard(1), gear: false}], hcard(2), false),
    /^that attack can't/);
});

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const body = (a, b) => HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a) + 10));

test("the trainer's defend door asks the cap for a hand card AND a piece, before it declares", () => {
  const tb = body("const toggleBlock = (kind,v) => setG", "const moveToReact = () => setG");
  assert.ok(tb.length > 400, "toggleBlock moved — re-anchor");
  assert.match(tb, /if\(on\)\{ const _cw = DawnParser\.defCapWhy\(s\.pend, declared\(\), c, false\); if\(_cw\) return L\(s, _cw \+ "\."\); \}/,
    "a hand card is declared past a cap");
  assert.match(tb, /const _cw = DawnParser\.defCapWhy\(s\.pend, declared\(\), gr, true\); if\(_cw\) return L\(s, _cw \+ "\."\);/,
    "a piece of equipment is declared past a cap");
  /* the re-block, judge's words */
  assert.match(tb, /if\(\(you\(s\)\.chainBlocked\|\|\[\]\)\.indexOf\(gr\.uid\) >= 0\) return L\(s, `\$\{gr\.name\} already blocked this chain\.`\);/,
    "CR 7.3.2b — a spent piece is declared again");
  /* and the two refusals SAY so */
  assert.match(tb, /if\(c\.def==null\) return L\(s, `\$\{c\.name\} prints no defence\.`\);/);
  assert.match(tb, /if\(cfx\.dr\) return L\(s, `\$\{c\.name\} is a defence reaction — play it in the reaction step\.`\);/);
  assert.doesNotMatch(tb, /c\.def==null\) return s;|cfx\.dr\) return s;/, "a silent refusal came back");
});

test("the wall RECORDS what it spent, and the turn clears it", () => {
  const fb = body("const finishBlock = (s) =>", "const takeIt = () => setG");
  assert.match(fb, /defSide\.chainBlocked = \[\.\.\.\(act\(s\)\.chainBlocked\|\|\[\]\),\s*\.\.\.act\(s\)\.blockG\.map\(i=>act\(s\)\.gear\[i\] && act\(s\)\.gear\[i\]\.uid\)/,
    "the player's spent gear is never recorded, so the refusal above can never fire");
  const nt = body("function newTurn(s){", "\n  function ");
  assert.match(nt, /youMut\(n\)\.chainBlocked = \[\];/, "a spent piece stays spent into the next turn");
});

test("every defend-step tap reaches the door, so a dimmed card is not a dead tap", () => {
  const ha = body("const handAct = (c,i) => {", "const peekVerb = c => {");
  assert.match(ha, /if\(g\.bphase==="react"\) playRx\(i\);\s*else toggleBlock\("h",c\.uid\);/);
});
