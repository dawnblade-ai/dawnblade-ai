/* THE POOL COMES IN FAITHFULLY — the foundation everything else stands on.

   Every drill in this suite, every tool in `tools/`, and every rule in
   `engine/` reasons about a card AFTER it has been through two steps:

     mapDbCard    a raw database record -> the engine's card shape
     resolveEntry a deck entry + that shape -> the card actually played

   If either step drops or mistypes a printed value, nothing above it can
   possibly notice. The card is simply a different card, consistently, in
   every drill and in the live game — and it will agree with itself.

   ---- THE ONE MIRROR THE NO-MIRROR RULE COULD NOT DELETE ---------------

   v2.20 ended the "edit one side, mirror the other" discipline by making
   `engine/` the only copy of every shared function. `mapDbCard` is the
   exception, and not by choice: the live version lives inside `useCardDB`,
   a React hook, so it is not extractable as a function and cannot be
   loaded from `engine/`. CLAUDE.md says "change both, and bump DATA_VER" —
   which is a note to a human, and notes to humans are what the sync guard
   exists because we stopped trusting.

   The consequence of drift is worse than a normal bug. The Node tools
   would audit one pool and the phone would play another, and BOTH would
   be internally consistent, so every finding either one made would be
   about a game the other was not playing.

   ---- WHAT resolveEntry HAS ALREADY LOST TWICE -------------------------

   It silently narrowed the database record two separate times, and each
   cost a real rule:

     `life` — an ally reached the arena with no life, so it was not a
              living object (CR 1.4.5a) and could not be attacked at all
     `ty`   — the structured type array was dropped, so `tt`'s stray word
              made Den of the Spider playable on its controller's own turn

   Both are the same shape: the resolver quietly handed the rules less
   than the database had, and every tool downstream agreed with it. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const C = require("../engine/cards");
const B = require("../engine/build");
const GM = require("../engine/game");
const PR = require("../engine/parser");
const RNG = require("../engine/rng");
const { loadData, html } = require("./helpers/extract");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB — run: node tools/audit.js";
const W = loadData();

/* ---- THE MIRROR --------------------------------------------------------
   Compared as a FIELD MAP — key to expression — rather than as text. The
   two blocks sit in different surroundings (the loader filters records
   before it maps them) and carry different comments, so a whole-body
   textual comparison would be noise. What has to agree is what each field
   is read from, and that is exactly what this extracts. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* The object literal containing `anchor`, as {key: expression}. Comments
   are stripped FIRST — one of these blocks contains a `{` inside its
   prose, and a brace counter that cannot see that is the same hazard
   `html-balance.test.js` documents. */
function fieldMap(src, anchor){
  const clean = stripComments(src);
  const i = clean.indexOf(anchor);
  assert.ok(i > 0, "anchor not found: " + anchor);
  const open = clean.lastIndexOf("{", i);
  let depth = 0, end = open;
  for(; end < clean.length; end++){
    if(clean[end] === "{") depth++;
    else if(clean[end] === "}"){ depth--; if(depth === 0) break; }
  }
  const body = clean.slice(open + 1, end);

  /* split on top-level commas only: `(c.types||[]).slice()` has none, but
     a future `f(a, b)` would, and splitting inside it would silently
     compare two half-expressions and call them equal. */
  const parts = [];
  let depth2 = 0, cur = "";
  for(const ch of body){
    if("({[".includes(ch)) depth2++;
    else if(")}]".includes(ch)) depth2--;
    if(ch === "," && depth2 === 0){ parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);

  const map = {};
  for(const p of parts){
    const t = p.trim();
    if(!t) continue;
    const colon = t.indexOf(":");
    assert.ok(colon > 0, "unparsed field in " + anchor + ": " + t);
    map[t.slice(0, colon).trim()] = t.slice(colon + 1).replace(/\s+/g, "");
  }
  return map;
}

test("the loader in index.html maps every field exactly as cards.js does", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "engine", "cards.js"), "utf8");
  const page = html();
  const a = fieldMap(engine, "n:c.name");
  const b = fieldMap(page, "n:c.name");

  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(),
    "engine/cards.js and index.html's loader carry DIFFERENT FIELDS — the Node tools "
    + "and the phone are resolving different cards, and each will agree with itself");
  for(const k of Object.keys(a))
    assert.equal(b[k], a[k],
      `field "${k}" is read differently: cards.js has ${a[k]}, index.html has ${b[k]}`);

  /* Pinned, so ADDING a field is a deliberate edit here — which is where
     the reminder to bump DATA_VER belongs, because a warm cache written
     under the old schema will not carry it. `ty` is the standing example:
     a warm sage-v10 cache has it on no card at all. */
  /* +`hz` AT v3.34 (DATA_VER sage-v12): `played_horizontally`, which is the
     database saying a card is a SPLIT card. A warm sage-v11 cache has it on
     no card, and without it both split cards silently keep running BOTH
     halves for free with no choice offered. */
  assert.deepEqual(Object.keys(a).sort(),
    ["c", "d", "gkw", "hp", "hz", "int", "kw", "n", "p", "pr", "prs", "pw", "tt", "tx", "ty"],
    "the card shape changed — mirror it in BOTH files and bump DATA_VER");
});

test("the printing loop is mirrored too — it decides which face a card wears", () => {
  /* `prs` is what puts a card on its Silver Age printing instead of
     whatever the database listed first. Drift here is not a rules bug, it
     is fifteen decks showing four different art treatments side by side,
     and only on the phone. */
  const engine = fs.readFileSync(path.join(__dirname, "..", "engine", "cards.js"), "utf8");
  const norm = s => stripComments(s).replace(/\s+/g, "");
  const grab = src => {
    const c = stripComments(src);
    const i = c.indexOf("(c.printings||[]).forEach");
    assert.ok(i > 0, "printing loop not found");
    let depth = 0, end = i;
    for(; end < c.length; end++){
      if(c[end] === "{") depth++;
      else if(c[end] === "}"){ depth--; if(depth === 0) break; }
    }
    return norm(c.slice(i, end + 1));
  };
  assert.equal(grab(html()), grab(engine),
    "the printing loop drifted — the phone and the tools would pick different art");
});

/* ---- THE NUMBERS ------------------------------------------------------- */

let _db = null, _pool = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

function pool(){
  if(_pool) return _pool;
  const db = DB(), seen = new Set(), out = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(db, e, sa);
      if(!c.resolved) continue;
      const k = c.name + "|" + c.pitch;
      if(seen.has(k)) continue;
      seen.add(k); out.push(c);
    }
  }
  return (_pool = out);
}

/* The record `resolveEntry` would have chosen: same name, same pitch. */
function recordFor(card){
  const db = DB();
  let cands = db.byName[PR.norm(card.name)];
  if(!cands && card.name.includes("//")) cands = db.byName[PR.norm(card.name.split("//")[0])];
  if(!cands) return null;
  return cands.find(c => c.p === card.pitch)
      || cands.slice().sort((a, b) => (a.p == null ? 9 : a.p) - (b.p == null ? 9 : b.p))[0];
}

/* ---- THE PINNED POOL IS THE WHOLE REASON THE SUITE NEEDS NO NETWORK ---
   CLAUDE.md states what `data/pool.json` is in one sentence — "the pinned
   pool, N records, every card the pool can reach" — and that sentence was
   the ONLY place the number lived. It read **764** while the file held
   **797**: a doc claim is a test with no assertion (v3.41), and this one
   describes the fixture every other drill in the suite stands on.

   SO THE CLAIM IS PINNED, NOT THE NUMBER ALONE. A count on its own says
   nothing about reach — a pool of 797 records missing one deck entry is
   the same number and a broken fixture. What is asserted is that every
   card a match can DEAL resolves out of the pinned file with no live
   database in the process at all.

   UNGATED, DELIBERATELY. Every other drill in this file skips without a
   cached database; this one must not, because "the suite needs no
   network" is exactly the property it states. */
test("the pinned pool carries every card a match can deal", () => {
  const raw = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  assert.equal(raw.length, 797,
    "the pinned pool moved — re-derive CLAUDE.md's sentence with it");

  const db = C.buildMaps(raw.map(C.mapDbCard));
  const missing = [], seen = new Set();
  let entries = 0;
  for(const h of W.HEROES){
    assert.ok(C.resolveHero(db, {name: h.n, code: h.code}), "no pooled record for " + h.n);
    const d = GM.parseDeck(W.DECKS[h.k]);
    for(const e of [...d.deck, ...d.gear]){
      entries++;
      seen.add(e.name + "|" + (e.p == null ? "" : e.p));
      if(!C.resolveEntry(db, e).resolved) missing.push(h.k + ": " + e.name);
    }
  }
  /* PROVED ALIVE BEFORE ANYTHING IS CONCLUDED FROM ITS SILENCE (v4.00) —
     a loop over zero entries satisfies "every one resolves" perfectly. */
  assert.ok(entries >= 480, `only ${entries} entries walked — the deck source moved`);
  assert.ok(seen.size >= 300, `only ${seen.size} distinct cards — the walk is not reaching`);
  assert.deepEqual(missing, [],
    "card(s) a deck lists that the pinned pool does not carry — the phone can deal "
    + "them and no drill here can see them:\n  " + missing.join("\n  "));
});

test("every printed value survives the trip from the database to the table", {skip}, () => {
  /* One row per field so a failure names WHICH value was lost, not just
     that a card differs. `life` and `ty` are in here because each was
     dropped once and nothing above noticed. */
  const FIELDS = [
    ["cost", r => r.c],  ["power", r => r.pw],
    ["def",  r => r.d],  ["life", r => r.hp], ["tt",  r => r.tt]
  ];
  /* PITCH IS THE ONE NORMALISED VALUE, and it is deliberate rather than
     lost: `resolveEntry` reads `card.p != null ? card.p : (e.p || 0)`, so a
     record with no printed pitch arrives as 0. No card in Flesh and Blood
     prints a pitch of 0, so 0 is a safe encoding of "cannot be pitched" —
     and it is checked as a rule below rather than excused here. */
  const bad = [], counted = {};
  for(const card of pool()){
    const rec = recordFor(card);
    if(!rec){ bad.push(card.name + ": no database record to compare against"); continue; }
    for(const [name, get] of FIELDS){
      const want = get(rec), got = card[name];
      if((want == null ? null : want) !== (got == null ? null : got))
        bad.push(`${card.name} (p${card.pitch}) ${name}: database ${JSON.stringify(want)}, table ${JSON.stringify(got)}`);
      else if(want != null) counted[name] = (counted[name] || 0) + 1;
    }
    for(const [name, get] of [["ty", r => r.ty], ["kw", r => r.kw], ["gkw", r => r.gkw]]){
      const want = (get(rec) || []).slice(), got = (card[name] || []).slice();
      if(JSON.stringify(want) !== JSON.stringify(got))
        bad.push(`${card.name} (p${card.pitch}) ${name}: database ${JSON.stringify(want)}, table ${JSON.stringify(got)}`);
      else if(want.length) counted[name] = (counted[name] || 0) + 1;
    }
    if((card.tx || "") !== (rec.tx || ""))
      bad.push(card.name + ": rules text differs from the record");
  }
  assert.deepEqual(bad.slice(0, 12), [], `${bad.length} field(s) lost in resolution`);
  /* A pass that compared nothing would also report no failures, so the
     drill states how much it actually looked at. */
  assert.ok(counted.power > 150 && counted.def > 300 && counted.ty === pool().length,
    "the comparison barely ran: " + JSON.stringify(counted));
});

/* THE NORMALISATION, STATED AS A RULE: a card resolves to pitch 0 if and
   only if it is Equipment or a Weapon. Excusing the 73 differences as
   "just equipment" would hide a real action card losing its pitch value
   in exactly the same way — a card that can no longer pay for anything,
   reported as a rounding detail. */
test("only Equipment and Weapons resolve to pitch 0, and every one of them does", {skip}, () => {
  const TY = require("../engine/types");
  const zero = [], nonzero = [];
  for(const card of pool()) (card.pitch > 0 ? nonzero : zero).push(card);

  for(const c of zero)
    assert.ok(TY.isEquipment(c) || TY.isWeaponType(c),
      c.name + " resolved to pitch 0 and is not equipment — it can no longer pay for anything");
  for(const c of nonzero)
    assert.ok(!TY.isEquipment(c) && !TY.isWeaponType(c),
      c.name + " is equipment and carries a pitch value");
  assert.equal(zero.length, 73, "the pool's equipment count moved");
  assert.equal(zero.length + nonzero.length, pool().length);
});

test("an ALLY reaches the table carrying its printed life", {skip}, () => {
  /* The exact field `resolveEntry` used to drop. An ally with no life is
     not a living object (CR 1.4.5a), so it cannot be attacked — a body
     that blocks nothing, dies to nothing, and costs nothing to ignore. */
  const allies = pool().filter(c => /\bally\b/i.test(c.tt));
  assert.ok(allies.length >= 6, "the pool lost its allies: " + allies.length);
  for(const a of allies)
    assert.ok(a.life > 0, a.name + " reached the table with no life — it cannot be attacked");
});

test("every hero is seated at its PRINTED life and intellect", {skip}, () => {
  /* Not one number but thirty, and three of them are the point: a hero
     seated at a default 20/4 would be wrong for Iyslander, Blaze and
     Lyath, and wrong from turn one of every game they play — while
     looking perfectly normal. */
  const db = DB(), rows = {};
  for(const h of W.HEROES){
    const rec = C.resolveHero(db, {name: h.n, code: h.code});
    assert.ok(rec, "no database record for " + h.n);
    const built = B.buildSideDefault(h, GM.parseDeck(W.DECKS[h.k]), db, RNG.make("seat"), {n: 0}).b;
    assert.equal(built.hp, rec.hp, h.n + " is seated at " + built.hp + " life, prints " + rec.hp);
    assert.equal(built.int, rec.int, h.n + " is seated at " + built.int + " intellect, prints " + rec.int);
    rows[h.n] = built.hp + "/" + built.int;
  }
  assert.equal(Object.keys(rows).length, 15);
  /* The three that are not 20/4. If a defaulting bug ever creeps in, it
     is these that catch it — the other twelve would look fine. */
  assert.equal(rows["Iyslander"], "18/4");
  assert.equal(rows["Blaze, Firemind"], "17/4");
  assert.equal(rows["Lyath Goldmane"], "20/5");
});

/* ---- A TOKEN A CARD CAN CREATE IS A TOKEN THE POOL CARRIES (v3.21) -----

   Briar's hero ability prints "create an Embodiment of Earth token", and
   the pinned pool did not contain that card. It was not a decision: the
   pinner found its tokens by scanning card text for a capitalised name
   followed by "token", and every word had to be capitalised — so "of"
   ended the name and the scan captured **"Earth"**, which no card is
   called. It added that, matched nothing, and reported nothing.

   THE LOADER AND THE PINNER DISAGREED ABOUT WHAT A TOKEN IS. `index.html`
   keeps any record whose type says Token, so the phone could mint both
   Embodiments while every Node tool and every drill was blind to them —
   the fixture and production reasoning about different pools, each
   internally consistent. That is the hazard the `mapDbCard` field-map
   guard above exists for, one layer down.

   This is the offline half of the check and it is the half that bites:
   every token name the pool's own text can create must RESOLVE in the
   pool. It fails on the old scanner (with "earth" and "lightning"
   dangling) and it fails if the pinner stops keeping tokens by type. */
test("every token the pool's cards can create resolves in the pool", {skip}, () => {
  const {tokenNames} = require("../tools/pin-pool.js");
  const recs = JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name);
  const db = C.buildMaps(recs.map(C.mapDbCard));
  const names = [...tokenNames(recs.map(c => ({functional_text: c.functional_text || ""})))];

  /* THE COUNT IS ASSERTED SO IT CANNOT PASS BY FINDING NOTHING. A scan
     that stops matching returns an empty set, and an empty set satisfies
     "every one of them resolves" perfectly. */
  assert.ok(names.length >= 19,
    `only ${names.length} token names scanned — the scan shape moved, repoint this rather than banking the win`);

  const dangling = names.filter(n =>
    !C.resolveEntry(db, {name: n, p: 0, code: null, q: 1}).resolved);
  assert.deepEqual(dangling, [],
    "token(s) a pool card creates that the pool does not carry — the phone can mint "
    + "them and no drill here can see them:\n  " + dangling.join("\n  "));

  /* and the two that were missing are named, so a silent regression to a
     name-shaped scan is caught by name rather than by a count */
  for(const nm of ["Embodiment of Earth", "Embodiment of Lightning"])
    assert.ok(C.resolveEntry(db, {name: nm, p: 0, code: null, q: 1}).resolved,
      nm + " must be in the pool — Briar's hero ability creates it");
});

test("the pinner keeps tokens by TYPE, the way the loader does", {skip}, () => {
  /* One rule for "what is a token", not two. The loader's rule is the
     record's TYPE; the pinner's used to be a scan over names, which is
     what let a name's spelling decide whether a card existed. */
  const src = fs.readFileSync(path.join(__dirname, "..", "tools", "pin-pool.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.match(src, /token\/i\.test\(c\.type_text/,
    "pin-pool must keep a token on its printed TYPE, not only on a scanned name");

  /* Driven against the LIVE database, not against `cardDbPath()` — which
     returns the PINNED POOL whenever it exists, so comparing to it would
     compare the pool with itself and pass by construction. That is the
     wrong-SCOPE version of the same trap this whole test is about, and it
     was written that way first. Skips when there is no live wire, the way
     `drift.test.js` does. */
  const E = require("./helpers/extract");
  if(!E.hasLiveDb()) return;
  const live = JSON.parse(fs.readFileSync(E.liveDbPath(), "utf8")).filter(c => c && c.name);
  const isTok = c => /token/i.test(c.type_text || "") || /token/i.test((c.types || []).join(" "));
  const pool = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "data", "pool.json"), "utf8"));
  const have = new Set(pool.filter(isTok).map(c => c.name));
  const liveToks = live.filter(isTok).map(c => c.name);
  assert.ok(liveToks.length >= 40, "the live token scan found almost nothing — repoint it");
  const missing = liveToks.filter(n => !have.has(n));
  assert.deepEqual(missing, [], "token(s) in the database that the pinned pool dropped");
});
