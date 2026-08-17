/* ===================================================================
   PRINTINGS (v2.35) — which face does a card wear?

   Every card is printed in many sets. `pr._first` is whatever the card
   database happened to list first, which is arbitrary order rather than
   a choice — that is why an Azalea deck showed GEM, 1HP, PEN and DDD art
   side by side. This is a Silver Age trainer, so a card should wear its
   Silver Age face, and exactly one card in the pool is meant to be
   Marvel: the Dawnblade.
   =================================================================== */
const {test} = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../engine/cards.js");

const ROOT = path.join(__dirname, "..");
const CACHE = require("./helpers/extract").cardDbPath();
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* The pool drills need the card cache; skip cleanly without it, the way
   coverage.test.js does, so a fresh clone still runs green. */
const haveCache = fs.existsSync(CACHE);

const heroes = () => [...HTML.matchAll(/\{k:"(\w+)",n:"([^"]+)".*?code:"(\w{3})001"/g)]
  .map(m => ({k:m[1], name:m[2], set:m[3]}));

const deckLines = (key) => {
  const block = HTML.slice(HTML.indexOf("window.DECKS"));
  const m = block.match(new RegExp(key + ":`([\\s\\S]*?)`", ""));
  if(!m) return [];
  return m[1].split("\n").map(l => l.split("|")).filter(p => p.length >= 3)
    .map(p => ({name:p[1], p:parseInt(p[2],10)||0, code:p[3]||null, q:1}));
};

const loadDb = () => {
  const raw = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const arr = Array.isArray(raw) ? raw : (raw.data || Object.values(raw));
  return C.buildMaps(arr.map(C.mapDbCard));
};
const setOf = url => {
  const code = (String(url||"").match(/([A-Za-z0-9-]+)\.\w+$/) || [])[1] || "";
  return code.slice(0,3);
};

test("printings — an explicit code always wins, even one the database lacks", () => {
  /* THE DAWNBLADE. Its code names a Marvel printing the card database has no
     record of, so the answer is the constructed CDN path. Returning the set
     preference instead silently put it back on SDO002 — the author's choice
     overridden without a word, which is the whole reason this drill exists. */
  const card = {pr:{_first:"http://x/AAA001.webp"}, prs:{SDO:"http://x/SDO002.webp"}};
  assert.match(C.pickPrinting(card, "MPW156-MV", "SDO"), /MPW156-MV/);
  /* and a code the database DOES carry resolves to its real image */
  const c2 = {pr:{_first:"http://x/AAA001.webp", "SBA004":"http://x/SBA004.webp"}, prs:{}};
  assert.match(C.pickPrinting(c2, "SBA004", "SAZ"), /SBA004/);
});

test("printings — with no code, this hero's own Silver Age set is preferred", () => {
  const card = {pr:{_first:"http://x/GEM059.webp"},
                prs:{GEM:"http://x/GEM059.webp", SAZ:"http://x/SAZ012.webp", SDO:"http://x/SDO099.webp"}};
  assert.match(C.pickPrinting(card, null, "SAZ"), /SAZ012/,
    "the deck's own precon printing, not the database's arbitrary first");
});

test("printings — falls back to ANY Silver Age set before the arbitrary first", () => {
  /* Blade Beckoner Helm is not printed in SAZ, so an Azalea deck should still
     get a Silver Age face rather than dropping to whatever came first. */
  const card = {pr:{_first:"http://x/1HP237.webp"},
                prs:{"1HP":"http://x/1HP237.webp", SBA:"http://x/SBA004.webp"}};
  assert.match(C.pickPrinting(card, null, "SAZ"), /SBA004/);
});

test("printings — _first is the honest last resort, never skipped silently", () => {
  /* Enigma Chimera at pitch 2 has NO Silver Age printing (MON and PSM only).
     Inventing one would be inventing a card face that does not exist. */
  const card = {pr:{_first:"http://x/MON123.webp"}, prs:{MON:"http://x/MON123.webp"}};
  assert.match(C.pickPrinting(card, null, "SAZ"), /MON123/);
});

test("printings — the Dawnblade is the ONLY Marvel card in the whole pool", {skip: !haveCache}, () => {
  const db = loadDb();
  const offenders = [];
  for(const h of heroes()){
    for(const e of deckLines(h.k)){
      const r = C.resolveEntry(db, e, h.set);
      if(!r.img) continue;
      const s = setOf(r.img);
      if(s === "MPW" || s === "MPG" || /-MV$/.test(r.img.replace(/\.\w+$/,"")))
        offenders.push(h.k + " · " + e.name + " · " + r.img);
    }
  }
  assert.equal(offenders.length, 1, "expected exactly one Marvel card, got:\n" + offenders.join("\n"));
  assert.match(offenders[0], /Dawnblade/);
});

test("printings — every other pool card resolves to a Silver Age set", {skip: !haveCache}, () => {
  const db = loadDb();
  const notSA = [];
  for(const h of heroes()){
    for(const e of deckLines(h.k)){
      const r = C.resolveEntry(db, e, h.set);
      if(!r.img) continue;
      const s = setOf(r.img);
      if(C.SA_SETS.includes(s)) continue;
      if(/Dawnblade/.test(e.name)) continue;          /* deliberately Marvel */
      notSA.push(h.k + " · " + e.name + " · " + s);
    }
  }
  /* Enigma Chimera (pitch 2) is the single genuine exception — it has no
     Silver Age printing at all. If this count ever moves, read the diff:
     a NEW name here means a printing regressed, not that the floor changed. */
  assert.deepEqual([...new Set(notSA.map(x => x.split(" · ")[1]))], ["Enigma Chimera"],
    "unexpected non-Silver-Age printings:\n" + notSA.join("\n"));
});

test("printings — mapDbCard records one image per set", () => {
  const mapped = C.mapDbCard({
    name:"T", pitch:"1", printings:[
      {id:"GEM059", set_id:"GEM", image_url:"http://x/GEM059.webp"},
      {id:"GEM059", set_id:"GEM", image_url:"http://x/GEM059.webp"},   /* foiling dupe */
      {id:"SAZ012", set_id:"SAZ", image_url:"http://x/SAZ012.webp"}
    ]});
  assert.deepEqual(mapped.prs, {GEM:"http://x/GEM059.webp", SAZ:"http://x/SAZ012.webp"});
  assert.equal(mapped.pr._first, "http://x/GEM059.webp", "_first is unchanged");
});
