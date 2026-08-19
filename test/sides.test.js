/* The sides[] migration (roadmap item 1). Two things are guarded here:

   1. the bridge between the flat trainer state and the two-sided shape is
      LOSSLESS, so the migration can proceed a function at a time; and
   2. every top-level key of the trainer's real state literal is CLASSIFIED
      as player / opponent / shared. A new field added to Battle without a
      home fails this drill, which is the whole point — the split is only
      closable if nothing new escapes it. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { html } = require("./helpers/extract");
const S = require("../engine/sides.js");

/* Scan the top-level keys of an object literal out of the source. Naive on
   purpose but quote- and comment-aware; the state literal has no template
   strings or regexes in it, which is what makes that safe. */
function objectKeys(src, marker, inside){
  const at = src.indexOf(marker);
  if(at < 0) throw new Error("marker not found: " + marker);
  /* Three ways to name the literal's opening brace:
     - `inside`: the marker sits WITHIN the object, so scan backwards
     - marker ends in "{": the marker names the brace itself, which is how
       a nested literal is reached (the next "{" forward would be wrong)
     - otherwise: the next "{" after the marker */
  const from = inside ? src.lastIndexOf("{", at)
    : marker.trim().endsWith("{") ? src.indexOf("{", at + marker.length - 1)
    : src.indexOf("{", at);
  const keys = [];
  let depth = 0, expectKey = false, q = null, line = false, block = false;
  for(let i = from; i < src.length; i++){
    const c = src[i], n = src[i+1];
    if(line){ if(c === "\n") line = false; continue; }
    if(block){ if(c === "*" && n === "/"){ block = false; i++; } continue; }
    if(q){ if(c === "\\"){ i++; } else if(c === q){ q = null; } continue; }
    if(c === "/" && n === "/"){ line = true; i++; continue; }
    if(c === "/" && n === "*"){ block = true; i++; continue; }
    if(c === '"' || c === "'" || c === "`"){ q = c; continue; }
    if(c === "{" || c === "[" || c === "("){ depth++; if(depth === 1) expectKey = true; continue; }
    if(c === "}" || c === "]" || c === ")"){ depth--; if(depth === 0) break; continue; }
    if(c === "," && depth === 1){ expectKey = true; continue; }
    if(expectKey && /[A-Za-z_$]/.test(c)){
      let j = i; while(j < src.length && /[\w$]/.test(src[j])) j++;
      let k = j; while(k < src.length && /\s/.test(src[k])) k++;
      if(src[k] === ":") keys.push(src.slice(i, j));
      expectKey = false; i = j - 1;
    }
  }
  return keys;
}

const stateKeys = objectKeys(html(), "const initial = {");

test("the state literal is found and is the real one", () => {
  assert.ok(stateKeys.length > 20, `only found ${stateKeys.length} keys`);
  for(const k of ["sides","turn","mode","over"])
    assert.ok(stateKeys.includes(k), `expected ${k} among the scanned keys`);
  /* Everything a hero carries left the top level over v2.15–v2.18. If any of
     these reappear as top-level state, a per-side field has been un-migrated. */
  for(const k of ["deck","hand","grave","gear","board","myHP","dHP","dHand",
                  "res","ap","hist","counters","rune","ward","blockH","paySel"])
    assert.ok(!stateKeys.includes(k), `${k} should live on a side, not on the game`);
});

/* THE HEADLINE: both seats are built by the same factory. That single call
   is what makes the dummy a side rather than a stub, so assert the trainer
   really uses it for BOTH — not a hand-rolled literal for one of them. */
test("the trainer builds both seats with makeSide", () => {
  const lit = html().slice(html().indexOf("const initial = {"));
  const sidesDecl = lit.slice(lit.indexOf("sides:["), lit.indexOf("prompt:null"));
  const calls = (sidesDecl.match(/makeSide\(/g) || []).length;
  assert.equal(calls, 2, "both seats should come from makeSide");
  assert.match(sidesDecl, /id:0/);
  assert.match(sidesDecl, /id:1/);
});

test("every field of Battle's state is classified player / opponent / shared", () => {
  const orphans = stateKeys.filter(k => k !== "sides" &&
    S.P_MAP[k] === undefined && S.O_MAP[k] === undefined && S.GAME_KEYS.indexOf(k) < 0);
  assert.deepEqual(orphans, [],
    "unclassified state fields — give each a home in engine/sides.js P_MAP / O_MAP / GAME_KEYS");
});

/* ---- the migrated half ----------------------------------------------
   NATIVE claims what lives on sides[]. Now that the migration is complete
   it is simply SIDE_FIELDS, and makeSide is what produces them — so pin
   NATIVE to the factory's real output rather than to a source literal. */
test("NATIVE matches what makeSide actually builds, for both seats", () => {
  for(const i of [0,1])
    assert.deepEqual(S.NATIVE[i].slice().sort(),
                     Object.keys(S.makeSide({id:i})).sort());
});

test("both seats carry an identical field set", () => {
  assert.deepEqual(S.NATIVE[0].slice().sort(), S.NATIVE[1].slice().sort());
});

test("NATIVE only ever claims real side fields", () => {
  for(const i of [0,1]) for(const f of S.NATIVE[i])
    assert.ok(S.SIDE_FIELDS.indexOf(f) >= 0, `NATIVE[${i}] claims unknown field ${f}`);
});

test("a field is either migrated or flat, never both", () => {
  const nat0 = new Set(S.NATIVE[0]), nat1 = new Set(S.NATIVE[1]);
  for(const f of Object.values(S.P_MAP))
    assert.ok(!nat0.has(f), `${f} is claimed as both native and flat for the player`);
  for(const f of Object.values(S.O_MAP))
    assert.ok(!nat1.has(f), `${f} is claimed as both native and flat for the opponent`);
});

/* The point of the whole exercise: no flat zone or life field may survive
   in the trainer, on either side. This is what catches a missed call site —
   the bracket checker cannot, and neither can the parser drills. */
test("no flat d* opponent reference survives in index.html", () => {
  /* `chainBlocked` is deliberately NOT in this list even though it was a flat
     legacy field: it is also a real SIDE field name, so `oSide.chainBlocked`
     is correct code. The holder whitelist below is what distinguishes the two
     — a game-state holder reading it would be the bug, and that is covered by
     the per-side guard that follows. */
  const dead = "(dHP|dDeck|dHand|dGrave|dGear|dBoard|dFrost|dMarked|dFatigue"
            + "|dBlockedHand|dIntimidated)";
  /* a real property read needs an identifier receiver before the dot, which
     also rules out the spread in `...dDeck`; `built.dDeck` and `built.dGear`
     are the deck BUILDER's own locals and stay */
  const access = new RegExp("(?:^|[^.\\w$])([A-Za-z_$][\\w$]*)\\s*\\.\\s*" + dead + "\\b");
  const asKey  = new RegExp("(?:^|[{,\\s])" + dead + "\\s*:");
  const offenders = [];
  html().split("\n").forEach((line, i) => {
    const a = line.match(access);
    if((a && a[1] !== "built") || asKey.test(line))
      offenders.push(`${i+1}: ${line.trim().slice(0,90)}`);
  });
  assert.deepEqual(offenders, [], "these still read the opponent's flat state");
});

/* The player's half. Holders are WHITELISTED rather than blacklisted,
   because `card.pitch` / `c.pitch` is a card's pitch VALUE and the PARSED
   `d.deck` / `d.gear` are deck definitions — neither is state, and a
   blacklist would rewrite both. */
test("no flat per-side reference survives in Battle", () => {
  const src = html();
  /* Scoped to the Battle component. The mirrored engine/prompts.js code
     higher up in the file legitimately writes `s.deck` where `s` is a SIDE
     object rather than game state; the sync guard covers that half. */
  const from = src.indexOf("function Battle(");
  assert.ok(from > 0, "Battle component not found");
  const lineOffset = src.slice(0, from).split("\n").length;
  const dead = "(deck|hand|arsenal|pitch|grave|banish|soul|gear|board|myHP|myInt|_intWas"
            + "|res|ap|wasted|buffNext|buffQ|gaNext|runeHitNext|amp|ward|awd|rune|rot|fra"
            + "|hist|counters|weaponUsed|lifeLock|arcShield|namedBuff|dracNext"
            + "|blockH|blockG|blockRx|paySel|chainBlocked|blockedHand"
            + "|frost|marked|fatigue|intimidated)";
  const holders = ["s","n","g","clashState","st","fresh"];
  const access = new RegExp("(?:^|[^.\\w$])([A-Za-z_$][\\w$]*)\\s*\\.\\s*" + dead + "\\b");
  const offenders = [];
  src.slice(from).split("\n").forEach((line, i) => {
    const a = line.match(access);
    if(a && holders.indexOf(a[1]) >= 0)
      offenders.push(`${i+lineOffset}: [${a[1]}.${a[2]}] ${line.trim().slice(0,80)}`);
  });
  assert.deepEqual(offenders, [], "these still read the player's flat state");
});

test("no field is claimed by two owners at once", () => {
  for(const k of Object.keys(S.P_MAP)){
    assert.equal(S.O_MAP[k], undefined, `${k} is claimed by both sides`);
    assert.ok(S.GAME_KEYS.indexOf(k) < 0, `${k} is both per-side and shared`);
  }
  for(const k of Object.keys(S.O_MAP))
    assert.ok(S.GAME_KEYS.indexOf(k) < 0, `${k} is both per-side and shared`);
});

test("every mapped field actually exists on a side", () => {
  const side = S.makeSide({});
  for(const [flat, field] of Object.entries(S.P_MAP))
    assert.ok(field in side, `P_MAP ${flat} -> ${field} is not a side field`);
  for(const [flat, field] of Object.entries(S.O_MAP))
    assert.ok(field in side, `O_MAP ${flat} -> ${field} is not a side field`);
});

test("makeSide builds every declared field, for either seat", () => {
  for(const id of [0,1]){
    const s = S.makeSide({id});
    for(const f of S.SIDE_FIELDS) assert.ok(f in s, `side ${id} is missing ${f}`);
    assert.equal(s.id, id);
  }
});

test("the two sides are structurally identical — that is the whole point", () => {
  assert.deepEqual(Object.keys(S.makeSide({id:0})).sort(),
                   Object.keys(S.makeSide({id:1})).sort());
});

/* A flat state carrying a distinct sentinel in every legacy field. */
function sentinelFlat(){
  const flat = {};
  let n = 0;
  for(const k of Object.keys(S.P_MAP)) flat[k] = "P:" + k + ":" + (n++);
  for(const k of Object.keys(S.O_MAP)) flat[k] = "O:" + k + ":" + (n++);
  for(const k of S.GAME_KEYS)          flat[k] = "G:" + k + ":" + (n++);
  /* the already-migrated half rides along as sides[] */
  flat.sides = [0,1].map(i => {
    const seat = {};
    for(const f of S.NATIVE[i]) seat[f] = "N" + i + ":" + f + ":" + (n++);
    return seat;
  });
  return flat;
}

test("bridge: flat -> sides -> flat is lossless", () => {
  const flat = sentinelFlat();
  const back = S.fromSides(S.toSides(flat));
  assert.deepEqual(back, flat);
});

test("bridge: nothing lands in the wrong seat", () => {
  const flat = sentinelFlat();
  const g = S.toSides(flat);
  for(const [k, f] of Object.entries(S.P_MAP)) assert.equal(g.sides[0][f], flat[k], k);
  for(const [k, f] of Object.entries(S.O_MAP)) assert.equal(g.sides[1][f], flat[k], k);
  for(const k of S.GAME_KEYS)                  assert.equal(g[k], flat[k], k);
});

test("bridge: an unclassified key is reported, never silently dropped", () => {
  const g = S.toSides({...sentinelFlat(), somethingBrandNew: 1});
  assert.deepEqual(g._unmapped, ["somethingBrandNew"]);
});

test("bridge: the real state literal leaves nothing unmapped", () => {
  const flat = {};
  for(const k of stateKeys) flat[k] = k;
  flat.sides = [{}, {}];
  assert.deepEqual(S.toSides(flat)._unmapped, []);
});

test("withSide patches one seat and leaves the other alone", () => {
  const g = S.makeGame({});
  const n = S.withSide(g, 1, {hp: 42});
  assert.equal(n.sides[1].hp, 42);
  assert.equal(n.sides[0].hp, 20);
  assert.equal(g.sides[1].hp, 20, "the original state was mutated");
  assert.notEqual(n.sides, g.sides, "sides array should be a fresh copy");
});

test("withSide accepts a function patch", () => {
  const n = S.withSide(S.makeGame({}), 0, s => ({...s, hp: s.hp - 3}));
  assert.equal(n.sides[0].hp, 17);
});

/* A per-side field set as a TOP-LEVEL KEY on a state spread is the other
   half of the migration bug, and the read-guards above cannot see it:
   `{...s, ward, blockH:[]}` writes to the game object, so the side keeps
   its stale value and the write silently does nothing. That shipped in
   v2.18 for ward/hist/blockH/blockG/blockRx and paySel — five real bugs —
   because the guards only checked `X.field` reads. This scan is brace-aware
   so it sees keys past a nested literal like `pending:{card,from,idx}`. */
test("no per-side field is written as a top-level key on a state spread", () => {
  const src = html();
  const from = src.indexOf("function Battle(");
  const body = src.slice(from);
  const lineOffset = src.slice(0, from).split("\n").length;
  const skip = new Set(S.META);
  const fields = new Set(S.SIDE_FIELDS.filter(f => !skip.has(f)));
  const hits = [];
  const spread = /\{\s*\.\.\.\s*(?:s|n|g|clashState|st|fresh)\b/g;
  let m;
  while((m = spread.exec(body))){
    let i = body.lastIndexOf("{", m.index + 2), d = 0, q = null, expect = false;
    for(; i < body.length; i++){
      const c = body[i];
      if(q){ if(c === "\\"){ i++; } else if(c === q){ q = null; } continue; }
      if(c === '"' || c === "'" || c === "`"){ q = c; continue; }
      if(c === "{" || c === "[" || c === "("){ d++; if(d === 1) expect = true; continue; }
      if(c === "}" || c === "]" || c === ")"){ d--; if(d === 0) break; continue; }
      if(c === "," && d === 1){ expect = true; continue; }
      if(expect && /[A-Za-z_$]/.test(c)){
        let j = i; while(j < body.length && /[\w$]/.test(body[j])) j++;
        let k = j; while(k < body.length && /\s/.test(body[k])) k++;
        const word = body.slice(i, j);
        if(body[k] === ":" && fields.has(word))
          hits.push(`${body.slice(0,i).split("\n").length + lineOffset - 1}: ${word}`);
        expect = false; i = j - 1;
      }
    }
  }
  assert.deepEqual([...new Set(hits)], [],
    "these write a side field onto the game object — use youMut()/oppMut()");
});

/* THE PROGRESS METER. Pinned deliberately: moving these numbers should be
   a visible, intentional edit to this drill, not a quiet drift.

   Two different questions, and they move at different times.

   COVERAGE — is the opponent a real side yet? Player 35 / opponent 16 of
   41. v2.15 did not move this and was not supposed to: migrating a field
   changes where it lives, not whether the opponent has it. v2.16 DID move
   it, 12 -> 16, by giving the dummy the four zones it never had — arsenal,
   pitch, banish, soul. Note the asymmetry runs both ways: the PLAYER is
   missing the six statuses only the dummy has ever carried. */
test("symmetry gap: coverage — how much of a hero each seat carries", () => {
  const gap = S.symmetryGap();
  /* 42 -> 41 in v2.74 and 41 -> 39 in v3.09, and all three departures are
     the same fact: `frost`, `rot` and `fra` were integers standing beside
     a token that is really an Aura on `board`, so each was a second source
     of truth for something the board already knew. The counts are derived
     now (`frostCount`, `frailtyCount`) or the token simply resolves
     (Bloodrot Pox). Nothing read `frost`; `fra` was never once SET.

     A field LEAVING is as deliberate an edit as one arriving — that is
     what this line is for, and the direction of travel is the point: the
     right number of bespoke per-token counters is zero. */
  assert.equal(gap.fields, 39);   /* +buffQ v2.30, -frost v2.74, -rot -fra v3.09 */
  assert.equal(gap.player.length, 39);
  assert.equal(gap.opponent.length, 39);
  assert.deepEqual(gap.missingForPlayer, []);
  assert.equal(gap.missingForOpponent.length, 0);
});

/* MIGRATION — how much has moved onto sides[] already. Both seats now carry
   the same ten zone/life fields natively; `flatRemaining` is the number that
   must reach zero, and it is counters and statuses from here on. */
test("symmetry gap: migration — what has moved onto sides[]", () => {
  const gap = S.symmetryGap();
  assert.equal(gap.nativeForPlayer.length, 39);   /* -frost v2.74, -rot -fra v3.09 */
  assert.equal(gap.nativeForOpponent.length, 39);
  assert.equal(gap.flatRemaining, 0, "the migration is complete — nothing left flat");
});

test("symmetry gap: between them the two seats account for every field", () => {
  const gap = S.symmetryGap();
  const union = new Set([...gap.player, ...gap.opponent]);
  assert.equal(union.size, gap.fields);
});
