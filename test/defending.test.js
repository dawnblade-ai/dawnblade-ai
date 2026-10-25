/* ============================================================
   defending.test.js — WHILE IT DEFENDS, THE SEAT PLAYS ONLY WHAT
   HELPS THE LINK (v5.46, QUEUE v4 H8)

   `sparring.reaction` played the cheapest legal card in every reaction
   window, and on the opponent's turn that included any instant. Lyath
   spent his Guardian Instant Auras and Concealed Object while being
   attacked (194 plays and 105 pitches on the opponent's turn in 28
   games) and began his own turn with two cards or fewer in about 70 of
   219 turns.

   While the seat is defending (`pend.by` is the other seat) the branch
   proposes only a card `judge.defendsNow` admits: a defence reaction, or
   a card whose payload prevents damage. Everything else waits for the
   seat's own turn. The policy still reads no card text: judge answers.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const SP = require("../engine/sparring");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const real = (name, uid) => {
  const c = H.card(name, 1) || H.card(name, 2) || H.card(name, 3);
  return c && {...c, uid};
};
const plain = {uid: 800, name: "Plain Swing", tt: "Generic Action - Attack",
               ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0,
               power: 4, def: 2, tx: "", kw: []};

/* Seat 1 holds `hand`; `by` is who declared the open attack. With by 0,
   seat 1 is DEFENDING; with by 1 the link is seat 1's own. */
function win(hand, by){
  const g = H.state({hp: 20, res: 9, hand: []},
                    {hp: 20, res: 9, ap: 1, hand},
                    {turn: 3, actor: by, turnPlayer: by});
  return Object.assign(g, {phase: "action", step: "reaction", priority: 1, passed: [],
    attacker: by, stack: [], pend: {card: plain, by, total: 4, ga: false, ops: [], onHit: []}});
}

test("the reader's op set is pinned", () => {
  assert.deepEqual(J.DEFENDS_OPS, ["ward", "revWard", "arcShield", "awd"]);
});

test("defendsNow: a defence reaction and every prevention op answer true; a held aura or item does not", {skip}, () => {
  H.db();
  const yes = ["Drag Down", "Oasis Respite", "Toe the Line", "Throw Caution to the Wind", "Pyroglyphic Protection"];
  const no = ["Edge of Their Seats", "Concealed Object"];
  const hand = [...yes, ...no].map((n, i) => real(n, 600 + i));
  hand.forEach((c, i) => assert.ok(c, [...yes, ...no][i] + " must be in the pool"));
  const g = win(hand, 0);
  yes.forEach((n, i) => assert.equal(J.defendsNow(g, 1, 600 + i, "hand"), true, n));
  no.forEach((n, i) => assert.equal(J.defendsNow(g, 1, 600 + yes.length + i, "hand"), false, n));
  /* `awd` has no playable claimant in the pool (Runebleed Robe's is a gear
     ability), so its half is a synthetic that parses to it (v3.73). */
  const syn = {uid: 700, name: "Synth Arcane Guard", tt: "Generic Instant", ty: ["Generic", "Instant"],
               pitch: 1, cost: 0, kw: [], tx: "Prevent the next 1 arcane damage that would be dealt to you this turn."};
  assert.equal(J.defendsNow(win([syn], 0), 1, 700, "hand"), true, "awd");
  /* a card the seat does not hold answers false, never throws */
  assert.equal(J.defendsNow(g, 1, 99999, "hand"), false);
  assert.equal(J.defendsNow(g, 1, 600, "arsenal"), false, "it is in the hand, not the arsenal");
});

test("DEFENDING, Lyath holds Edge of Their Seats and plays Drag Down", {skip}, () => {
  H.db();
  const edge = real("Edge of Their Seats", 501), drag = real("Drag Down", 502);
  const g1 = win([edge], 0);
  assert.equal(J.legal(g1, {t: "play", uid: 501, from: "hand"}, 1), null, "the aura IS legal here");
  assert.deepEqual(SP.act(g1, 1), {t: "pass"}, "…and the seat keeps it for its own turn");
  assert.deepEqual(SP.act(win([edge, drag], 0), 1), {t: "play", uid: 502, from: "hand"});
  /* each prevention family a defender can PLAY is proposed (Pyroglyphic
     Protection's `arcShield` is an Action, so legal refuses it here; its
     half is the reader drill above) */
  for(const [n, u] of [["Oasis Respite", 511], ["Toe the Line", 512], ["Throw Caution to the Wind", 513]]){
    const a = SP.act(win([edge, real(n, u)], 0), 1);
    assert.equal((a || {}).uid, u, n);
  }
});

test("ON ITS OWN LINK the held aura is still proposed", {skip}, () => {
  H.db();
  const edge = real("Edge of Their Seats", 501);
  const g = win([edge], 1);
  assert.equal(J.legal(g, {t: "play", uid: 501, from: "hand"}, 1), null);
  assert.deepEqual(SP.act(g, 1), {t: "play", uid: 501, from: "hand"},
    "the filter is the defending seat's, never the attacker's");
});
