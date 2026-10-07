/* ======================================================================
   THE WHOLE-TEXT SELF-PUMP FALLBACK IS RETIRED (v5.02)

   `fxParse` scanned the WHOLE text of a non-attack for "gets/gains
   +N{p}" and, when no op had read that number, queued it as a pump for
   the next attack. Five versions each found it reading a number another
   reader already owned (v2.30, v3.00, v3.72, v3.87), and each answer was
   to tell `pumpRead` about one more list.

   Censused before deleting it: 20 pinned records reached it, and not one
   was a pump the parser had failed to read. Read off a feed, three were
   live and STRONGER than printed:

     Concealed Object      played: a free, untargeted +1 queued for the
                           next attack, on top of its {t} ability
     Cutty Shark           deployed: the same free +1, off its ability line
     The Suspense is …     its first attack each turn got +2, prints +1

   A pump no reader has read stays a visible `skip` (v2.29).
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p: p, code: null, q: 1}), {uid});

function poolCards(){
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const seen = new Set(), out = [];
  for(const r of raw){
    if(!r || !r.name) continue;
    const m = C.mapDbCard(r);
    const c = C.resolveEntry(H.db(), {name: m.n, p: m.p == null ? 0 : m.p, code: null, q: 1});
    if(!c) continue;
    const k = c.name + "|" + c.pitch;
    if(seen.has(k)) continue;
    seen.add(k); out.push(c);
  }
  return out;
}

test("CENSUS: the only non-attacks carrying a self-pump are attack reactions and one Instant", {skip}, () => {
  P.fxReset();
  const names = new Set();
  for(const c of poolCards()){
    const fx = P.fxParse(c);
    if((fx.self || 0) > 0 && !P.isAttack(c)) names.add(c.name);
  }
  /* PINNED BOTH DIRECTIONS (v4.12, v4.17). The fallback coming back adds
     Concealed Object, Cutty Shark, The Suspense is Killing Me, Courage,
     Bait, Swiftstrike Bracers and Tearing Shuko here; a reader that stops
     reading a printed reaction pump removes one. Lightning Press is the
     Instant — its pump names a TARGET attack, which is v5.02's next
     finding rather than this one's. */
  assert.deepEqual([...names].sort(), [
    "Agile Engagement", "Lightning Press", "Nip at the Heels", "Out for Blood", "Overpower",
    "Puncture", "Scar Tissue", "Spike with Bloodrot", "Stains of the Redback", "Stroke of Foresight",
  ].sort());
});

test("the former claimants carry no pump of their own — the number belongs to the reader that owns it", {skip}, () => {
  P.fxReset();
  for(const [nm, p] of [["Concealed Object", 3], ["Cutty Shark, Quick Clip", 2], ["The Suspense is Killing Me", 3],
                        ["Courage", 0], ["Bait", 0], ["Swiftstrike Bracers", 0], ["Tearing Shuko", 0]]){
    const c = ent(nm, p, 900);
    assert.ok(c && c.tx, nm + " is not in the pool — re-anchor this drill");
    assert.equal(P.fxParse(c).self || 0, 0, nm + " reads a second copy of a +N{p} another reader owns");
  }
  /* POSITIVE CONTROL: the readers that own those numbers still read them */
  assert.equal(P.fxParse(ent("The Suspense is Killing Me", 3, 901)).firstAtk, 1, "the standing static still reads");
});

test("DRIVEN: playing Concealed Object or deploying Cutty Shark queues nothing", {skip}, () => {
  for(const [nm, p] of [["Concealed Object", 3], ["Cutty Shark, Quick Clip", 2]]){
    const c = ent(nm, p, 910);
    const g = H.state({hand: [c], res: 9, ap: 1, name: "You"}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
    const n = H.execute(g, c, "hand", 0);
    assert.equal(n.sides[0].buffNext || 0, 0, nm + " queued a pump its printed line never grants on play");
    assert.ok(n.sides[0].board.some(b => b && b.uid === 910), nm + " must still reach the arena");
  }
});

test("DRIVEN: The Suspense is Killing Me pumps the first attack by the +1 it prints, not +2", {skip}, () => {
  const sus = ent("The Suspense is Killing Me", 3, 920);
  const atk = ent("Wounding Blow", 1, 921);
  let g = H.state({hand: [sus, atk], res: 9, ap: 1, name: "You"}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  g = H.execute(g, sus, "hand", 0);
  assert.equal(g.sides[0].buffNext || 0, 0, "the play itself must queue nothing");
  g = H.execute(g, atk, "hand", 0);
  assert.ok(g.pend, "the attack opens a link");
  assert.equal(g.pend.total, (atk.power || 0) + 1, "first attack: printed power plus the one +1 the card prints");
});
