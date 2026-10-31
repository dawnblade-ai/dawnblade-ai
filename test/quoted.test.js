/* ============================================================
   A GRANTED ABILITY IN QUOTES — AND WHEN IT VANISHES (v3.40)

   FaB prints a granted ability in QUOTES, which is what makes it readable
   rather than guessable. `quotedOnHit` returns null on a payload it cannot
   read — v3.10's deliberate refusal, so the head still lands and the card
   is weaker than printed rather than guessed at.

   WHAT v3.10 DID NOT DO IS TELL ANYONE. The clause is consumed by its
   head, reports `run`, and the card comes out `tier: full` with a printed
   ability doing nothing — while that version's own note claims the case
   "leaves the gap visible in the audit". Measured across the pool it left
   FOUR records claiming to work, and no tool could see it: coverage
   counts the clause consumed, and the fairness sweep is one-sided toward
   too-strong while all four are WEAKER than printed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";

const fx = (nm, p) => { P.fxReset(); return P.fxParse(H.card(nm, p)); };

/* THE CONTROL IS SYNTHETIC SINCE v5.53, when Display Loyalty — the last pool
   record with an unread rider — got its reader (`parser.quotedAtkHero`). A
   granted BARE "when this attacks" is refused on purpose (it would need
   `DECL_OPS` asked too, and the pool prints none), so it is the honest
   refusal this file's census needs; its hero-gated twin reads. */
const SYN_BASE = {pitch: 1, cost: 0, power: 3, def: 2, tt: "Draconic Ninja Action - Attack",
                  ty: ["Draconic", "Ninja", "Action", "Attack"], kw: [], gkw: []};
const synRider = (name, quoted) => ({...SYN_BASE, name,
  tx: "If you control 2 or more Draconic chain links, this gets **go again** and \"" + quoted + "\""});
const SYN_BARE = synRider("SYN-QUOTED-BARE-ATTACKS", "When this attacks, create a Fealty token.");
const SYN_HERO = synRider("SYN-QUOTED-HERO-ATTACKS", "When this attacks a hero, create a Fealty token.");
const fxOf = c => { P.fxReset(); return P.fxParse(c); };

test("an unreadable quoted ability is RECORDED, not silently dropped", {skip}, () => {
  /* GOON TACTICS LEFT THIS LIST AT v3.96, which is exactly how a record
     leaves it: the flag asks "is there a reader" (v3.41), and its rider —
     "destroy the top card of their deck" — got one. Its head (+3{p} behind
     the same `auras3` gate) has always parsed, so the card reported `full`
     before v3.40 with a printed ability doing nothing.

     THE CONTROL IS SYNTHETIC (v5.53): a granted BARE "when this attacks"
     is a genuine refusal. Display Loyalty was the control until its
     hero-gated rider got a reader (`parser.quotedAtkHero`) and left the
     list the way a record should — as Release the Tension did at v4.69. */
  const g = fx("Goon Tactics", 3);
  assert.deepEqual(g.quotedUnread || [], [], "its rider reads now");
  assert.deepEqual((g.condOnHit || []).map(x => [x.cond, x.op]),
    [["auras3", ["foeDeckDestroy", 1]]],
    "and it rides behind the SAME gate its head does — a granted ability " +
    "whose grant is conditional is `condOnHit`, never a plain on-hit (v3.10)");

  const r = fxOf(SYN_BARE);
  assert.equal((r.quotedUnread || []).length, 1,
    "the control: a rider with genuinely no reader is still recorded by name");
  assert.equal((r.onHit || []).length + (r.onAtk || []).length, 0, "and genuinely does not fire");
  assert.deepEqual(r.conds.map(x => [x.cond, x.op]), [["drac2", ["ga"]]],
    "nor is it filed behind the gate");
  const d = fx("Display Loyalty", 1);
  assert.deepEqual(d.quotedUnread || [], [], "Display Loyalty's rider reads now (v5.53)");
  assert.deepEqual(d.conds.map(x => [x.cond, x.op, x.atkHero]),
    [["drac2", ["ga"], false], ["drac2", ["token", "fealty", 1, "self"], true]],
    "behind the SAME gate as its head, after it in printed order, and hero-gated");
  const rt = fx("Release the Tension", 1);
  assert.deepEqual(rt.quotedUnread || [], [], "Release the Tension's rider reads now (v4.69)");
});

test("the TIER still tells the truth about the HEAD", {skip}, () => {
  /* Downgrading the clause was the first attempt and it lies the other
     way: Display Loyalty's go again really does work, and the card
     reported `none`. Both facts are kept — accurate tier, flagged rider. */
  const d = fxOf(SYN_BARE);
  assert.ok((d.quotedUnread || []).length, "its quoted ability has no reader");
  assert.ok(d.clauses.some(cl => cl.st === "run"),
    "and the clause still reports as read, because its HEAD is read — marking it unread " +
    "claims the go again does not work either, which is false");
});

test("a rider carried somewhere OTHER than fx.onHit is not flagged", {skip}, () => {
  /* Mauvrion Skies' Runechants ride as the COUNT `runeHitNext` (v3.10).
     A check that asked "did it land in fx.onHit" demoted this card, which
     is why the recorder asks the narrower question: IS THERE A READER. */
  for(const pitch of [1, 2, 3]){
    const m = fx("Mauvrion Skies", pitch);
    assert.equal((m.quotedUnread || []).length, 0,
      "pitch " + pitch + ": its rider is read — flagging it would report a working card as broken");
    assert.ok((m.ops || []).some(o => o[0] === "runeHitNext"),
      "and it rides as the printed COUNT, which is the reason a landing-check gets this wrong");
  }
});

test("the closing quote is matched to the OPENING one", {skip}, () => {
  /* A bare character class for either end lets a mid-word apostrophe close
     the quote: "defense reactions can't be played…" captured `defense
     reactions can`, which then fails to parse for a reason that is not the
     card's — and the audit printed that truncation as the finding. */
  /* THE FIXTURE MOVED AT v4.69: Release the Tension's rider READS now, and
     that is the stronger proof — the reader is anchored at both ends
     ("…can't be played from arsenal this chain link$"), so a capture that
     stopped at the apostrophe ("defense reactions can") could not read. */
  const r = fx("Release the Tension", 1);
  const op = (r.ops || []).find(o => o[0] === "buffNext");
  assert.deepEqual(op && op[3], {noDrx: "arsenal"},
    "the whole quoted text, apostrophe and all — a truncated capture reads nothing");
});

test("the audit FLAGS every recorded one, by name", {skip}, () => {
  /* The record is only worth having if something reports it — the exact
     failure v3.10 had, one layer up. */
  /* THE GENERATOR FIRST. AUDIT.md is a build artifact, so a drill that
     reads it alone stays green until someone regenerates — it would not
     catch the flag being deleted from `tools/audit.js` at all, which is
     the regression that matters. */
  const gen = fs.readFileSync(path.join(__dirname, "..", "tools", "audit.js"), "utf8");
  assert.match(gen, /quotedUnread/,
    "tools/audit.js must read `fx.quotedUnread` — the record is only worth having if " +
    "something reports it, which is v3.10's failure one layer up");
  assert.match(gen, /granted ability in quotes has NO reader/,
    "and it must flag it by name");

  const md = fs.readFileSync(path.join(__dirname, "..", "AUDIT.md"), "utf8");
  /* NO POOL RECORD IS FLAGGED SINCE v5.53. Goon Tactics left at v3.96,
     Release the Tension at v4.69 and Display Loyalty, the last, when its
     attacks-a-hero rider got a reader. The generator checks above are what
     keep the flag alive, and the census below drives it on a synthetic. */
  for(const nm of ["Goon Tactics", "Release the Tension", "Display Loyalty"])
    assert.ok(!new RegExp("\\*\\*" + nm + "\\*\\*[^\\n]*granted ability in quotes has NO reader").test(md),
      nm + "'s rider reads now (v3.96, v4.69, v5.53), so the flag must be gone — run `npm run audit` if this is stale");
});

test("the pool-wide count is PINNED, so a new one cannot arrive unnoticed", {skip}, () => {
  /* A census that quietly stopped finding anything would pass by finding
     nothing — the failure mode this whole file exists because of. */
  const C = require("../engine/cards.js");
  const arr = require("../data/pool.json");
  const found = [];
  for(const rec of arr){
    const m = C.mapDbCard(rec); if(!m || !m.tx) continue;
    const c = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d,
               tt: m.tt, ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    P.fxReset();
    if((P.fxParse(c).quotedUnread || []).length) found.push(m.n + " p" + m.p);
  }
  /* FIVE RECORDS, not three: this scans the whole PINNED POOL FILE, where
     Release the Tension exists at all three pitches, while AUDIT.md counts
     the 405 cards the decks actually reach and so shows p1 alone. Both
     numbers are right; a census has to say which one it is counting.

     SIX UNTIL v3.48. Drop the Anchor left, deliberately: its rider is
     `"When this hits a hero, {t} them and all allies they control"`, and
     the RULING (user, 2026-08-25) on what tapping a hero means gave that
     payload a reader. The flag asks "is there a reader" (v3.41), so
     building one is exactly how a record leaves this list. */
  /* FOUR -> ONE AT v4.69: Release the Tension's three records left when its
     static restriction got a reader (`quotedStatic`).
     ONE -> NONE AT v5.53: Display Loyalty's "When this attacks a hero,
     create a Fealty token" got `quotedAtkHero`. */
  assert.deepEqual(found.sort(), [],
    "a record prints a quoted ability with no reader. The pool's last left at v5.53, so " +
    "this means upstream added one or a reader regressed — either way, a deliberate edit here.");
  /* AN EMPTY CENSUS IS WHAT A DEAD ONE RETURNS (v4.00), so the walk and the
     flag are proved alive in the same test: the pool was walked, and the
     same path flags the synthetic bare-attacks rider. */
  assert.ok(arr.length > 700, "the pinned pool was walked");
  assert.equal((fxOf(SYN_BARE).quotedUnread || []).length, 1,
    "and the flag still fires on a rider with genuinely no reader");
  assert.deepEqual(fxOf(SYN_HERO).quotedUnread || [], [],
    "while its hero-gated twin reads — the near-miss that tells the two apart");
});
