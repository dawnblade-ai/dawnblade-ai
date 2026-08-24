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

test("an unreadable quoted ability is RECORDED, not silently dropped", {skip}, () => {
  /* Goon Tactics: the +3{p} head parses and the quoted ability has no
     reader at all. Before v3.40 this card reported `full`. */
  const g = fx("Goon Tactics", 3);
  assert.deepEqual(g.quotedUnread, ["when this hits a hero, destroy the top card of their deck."],
    "the unread ability must be recorded by name so the audit can flag it");
  assert.equal((g.onHit || []).length, 0, "and it genuinely does not fire — this is the gap, not a mislabel");
});

test("the TIER still tells the truth about the HEAD", {skip}, () => {
  /* Downgrading the clause was the first attempt and it lies the other
     way: Display Loyalty's go again really does work, and the card
     reported `none`. Both facts are kept — accurate tier, flagged rider. */
  const d = fx("Display Loyalty", 1);
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
  const r = fx("Release the Tension", 1);
  assert.deepEqual(r.quotedUnread,
    ["defense reactions can't be played from arsenal this chain link."],
    "the whole quoted text, apostrophe and all");
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
  for(const nm of ["Display Loyalty", "Drop the Anchor", "Goon Tactics", "Release the Tension"])
    assert.ok(new RegExp("\\*\\*" + nm + "\\*\\*[^\\n]*granted ability in quotes has NO reader").test(md),
      nm + " must be flagged in the generated AUDIT.md — run `npm run audit` if this is stale");
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
  /* SIX RECORDS, not four: this scans the whole PINNED POOL FILE, where
     Release the Tension exists at all three pitches, while AUDIT.md counts
     the 405 cards the decks actually reach and so shows p1 alone. Both
     numbers are right; a census has to say which one it is counting. */
  assert.deepEqual(found.sort(), [
    "Display Loyalty p1", "Drop the Anchor p1", "Goon Tactics p3",
    "Release the Tension p1", "Release the Tension p2", "Release the Tension p3"
  ], "six records print a quoted ability with no reader. A SEVENTH means upstream added one " +
     "or a reader regressed; a FIFTH means one was built — either way, a deliberate edit here.");
});
