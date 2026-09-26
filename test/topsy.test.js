/* ============================================================
   TOPSY TURVY — A REPLACEMENT OVER A ZONE MOVE (v4.65)

     Instant - Destroy this: Until end of turn, if one or more cards would
     be put on top of a deck, instead they're put on the bottom.
                                       — TOPSY TURVY, PEN276, Arakni's Head

   The pool's only replacement effect over a ZONE MOVE, and it names "a
   deck" — no seat — so it is GAME state (Hyper Inflation's `costTax` shape,
   v4.06), read by ONE reader, `parser.deckTopTo`, which every writer that
   puts a card on top of a deck asks. v3.17's rule: the event is one body,
   or it is not an event.

   OPT IS ONE OF THOSE WRITERS, AND THE PRINTING IS WHY. SAZ005's opt
   reminder reads "You may PUT THEM ON THE TOP and/or bottom in any order",
   so a card kept on top is a card PUT on top. Spire Sniping's "put them
   BACK in any order" is the same event.

   EVERY WRITER IS DRIVEN BOTH WAYS — the flip set and unset — because a
   writer that ignores the flag passes the unset half perfectly, and a
   writer that always sends cards to the bottom passes the set half.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H  = require("./helpers/judged.js");
const P  = require("../engine/parser.js");
const B  = require("../engine/build.js");
const J  = require("../engine/judge.js");
const E  = require("../engine/effects.js");
const PM = require("../engine/prompts.js");
const S  = require("../engine/sides.js");

const skip = !H.hasDb() && "no cached DB";
const ROOT = path.join(__dirname, "..");

const LINE = "Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom";
const card = (n, p, uid) => ({...H.card(n, p), uid});
const deck = pre => [1, 2, 3, 4].map(i => card("Raging Onslaught", 1, pre + i));
const top = sd => (sd.deck[0] || {}).uid;
const bot = sd => (sd.deck[sd.deck.length - 1] || {}).uid;
const board = (flip, you, foe) => {
  const g = {...H.state(Object.assign({res: 9, ap: 1, deck: deck("m")}, you || {}),
                        Object.assign({deck: deck("t")}, foe || {}),
                        {turn: 3, actor: 0, turnPlayer: 0}),
             phase: "action", step: "layer", priority: 0, stack: [], chain: [], passed: []};
  if(flip) g.deckFlip = "Topsy Turvy — ability";
  return g;
};
const answer = (g, pick) => {
  let n = J.openPrompt(g);
  /* ONE MANDATORY CANDIDATE IS CONFIRMED ON THE SPOT (v4.68), through the
     same `applyAnswer` a Confirm reaches — so the same writer answers, and
     every drill below still asserts WHERE the card went, which a fixture
     that moved nothing cannot satisfy in either direction. */
  if(!n.prompt) return n;
  for(const i of pick || []) n = J.reduce(n, {t: "promptSel", i}, n.prompt.side).state;
  return J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
};

/* ---- 1. THE READER --------------------------------------------------- */

test("the line reads as ONE op, both apostrophe spellings", () => {
  assert.deepEqual(P.classifyClause(LINE), {status: "run", ops: [["deckFlip", 1]]});
  assert.deepEqual(P.classifyClause(LINE.replace("they're", "they are")).ops, [["deckFlip", 1]]);
});

test("a NARROWER or different replacement refuses rather than reading as this one", () => {
  /* "a deck" is the card's; "your deck" would be one seat, "the bottom" is
     the destination — a reading that ignored either would be a different
     card wearing this one's op (v2.29: the whole printed shape, or nothing). */
  for(const t of [LINE.replace("a deck", "your deck"),
                  LINE.replace("on the bottom", "into the graveyard"),
                  LINE.replace("Until end of turn, ", "")])
    assert.equal(P.classifyClause(t), null, "must not read: " + t);
});

test("`deckTopTo` is the one answer: top by default, bottom under the flip", () => {
  assert.equal(P.deckTopTo({}), "deckTop");
  assert.equal(P.deckTopTo(null), "deckTop");
  assert.equal(P.deckTopTo({deckFlip: "x"}), "deckBottom");
  assert.ok(S.GAME_KEYS.indexOf("deckFlip") >= 0,
    "`deckFlip` is the GAME's — an unclassified top-level key is SIDE-FIELD-ON-GAME's shape");
});

test("the card reports FULL and builds an INSTANT powCard that destroys itself", {skip}, () => {
  P.fxReset();
  assert.equal(P.fxParse(H.card("Topsy Turvy", 0)).tier, "full");
  const tt = card("Topsy Turvy", 0, 77); P.fxReset(); B.equipPiece(tt);
  assert.ok(tt.powCard, "the piece has its ability");
  assert.equal(tt.powCard._instant, true, "printed Instant");
  assert.equal(tt.powCard.sd, true, "and its cost destroys it");
});

/* ---- 2. DRIVEN: THE ACTIVATION, AND THE WINDOW ----------------------- */

test("activating it sets the flag, on EITHER turn, and the end phase ends it", {skip}, () => {
  const tt = card("Topsy Turvy", 0, 77); P.fxReset(); B.equipPiece(tt);
  const g = board(false, {gear: [tt]});
  const out = J.reduce(g, {t: "activate", uid: "gp77"}, 0);
  assert.ok(!out.error, "legal: " + out.error);
  assert.ok(out.state.deckFlip, "the replacement is live");
  assert.ok(out.state.sides[0].gear[0].destroyed, "the piece paid for it");
  /* "UNTIL END OF TURN" — swept at whichever turn's end phase comes next,
     whose seat does not matter. */
  for(const seat of [0, 1]){
    const r = E.beginEndPhase(out.state, seat, H.db());
    assert.equal(r.game.deckFlip, undefined, "gone at seat " + seat + "'s end phase");
  }
  /* THE CONTROL: an end phase with no flag leaves no key behind. */
  assert.equal("deckFlip" in E.beginEndPhase(g, 0, H.db()).game, false);
});

/* ---- 3. EVERY WRITER, BOTH WAYS -------------------------------------- */

test("a pick to the top of a deck (Memorial Ground's shape) goes to the BOTTOM", {skip}, () => {
  for(const flip of [false, true]){
    const g = board(flip, {grave: [card("Wounding Blow", 1, "gy1")]});
    g.promptQ = [{tag: "pick", side: 0, src: "SYN", zone: "grave", to: "deckTop", min: 1, max: 1}];
    const sd = answer(g, [0]).sides[0];
    assert.equal(flip ? bot(sd) : top(sd), "gy1", (flip ? "bottom" : "top") + " when flip=" + flip);
  }
});

test("Brain Freeze's cross-seat put goes to the BOTTOM of THEIR deck", {skip}, () => {
  for(const flip of [false, true]){
    const g = board(flip, {}, {hand: [card("Wounding Blow", 1, "h1")]});
    const n = H.runOps(g, [["foePick", {zone: "hand", to: "deckTop", filter: {}}]], "SYN-FREEZE");
    const sd = answer(n, [0]).sides[1];
    assert.equal(flip ? bot(sd) : top(sd), "h1", (flip ? "bottom" : "top") + " when flip=" + flip);
  }
});

test("Boulder Drop's crush rider goes to the BOTTOM of their deck", {skip}, () => {
  for(const flip of [false, true]){
    const g = board(flip, {}, {hand: [card("Wounding Blow", 1, "h1")]});
    const sd = H.runOps(g, [["foeHandToDeck", 1]], "SYN-BOULDER").sides[1];
    assert.equal(flip ? bot(sd) : top(sd), "h1", (flip ? "bottom" : "top") + " when flip=" + flip);
  }
});

test("OPT: a card KEPT on top is a card PUT on top — under the flip it goes to the bottom", {skip}, () => {
  for(const flip of [false, true]){
    const g = board(flip);
    const n = answer(H.runOps(g, [["opt", 2]], "SYN-OPT"), []);   /* keep both on top */
    const ids = n.sides[0].deck.map(c => c.uid);
    if(!flip) assert.deepEqual(ids.slice(0, 2), ["m1", "m2"], "kept on top");
    else {
      assert.deepEqual(ids.slice(-2), ["m1", "m2"], "both at the bottom");
      assert.equal(ids[0], "m3", "and the deck's third card is now its top");
    }
    assert.equal(ids.length, 4, "no card lost or duplicated");
  }
});

test("A REORDER puts them BACK — under the flip they go to the bottom too", {skip}, () => {
  for(const flip of [false, true]){
    const g = board(flip);
    const n = answer(H.runOps(g, [["lookOrder", 2]], "SYN-SPIRE"), []);
    const ids = n.sides[0].deck.map(c => c.uid);
    if(!flip) assert.deepEqual(ids.slice(0, 2), ["m1", "m2"]);
    else assert.deepEqual(ids.slice(-2), ["m1", "m2"]);
  }
});

test("a card put on the BOTTOM is untouched — the replacement names the top only", {skip}, () => {
  const g = board(true, {grave: [card("Wounding Blow", 1, "gy1")]});
  g.promptQ = [{tag: "pick", side: 0, src: "SYN", zone: "grave", to: "deckBottom", min: 1, max: 1}];
  assert.equal(bot(answer(g, [0]).sides[0]), "gy1");
});

/* ---- 4. THE CENSUS OF WRITERS ---------------------------------------- */

test("CENSUS: every site that front-inserts onto a deck asks `deckTopTo`", () => {
  /* A SIXTH WRITER ARRIVING WITHOUT THE QUESTION is the defect this file
     exists to stop — the replacement would hold for four writers and not
     the fifth. The scan finds an assignment to a `deck` whose new array
     does not START with a spread of a deck (a front-insert, whatever the
     spelling), and requires `deckTopTo` within the preceding lines.

     ITS REACH IS STATED: it sees a literal array on the right-hand side,
     including behind a conditional, across the engine and the trainer. A
     write built in a variable first and assigned later is not seen — none
     exists today, and the opt branch (which is exactly that shape) is
     pinned by name below so it cannot leave unnoticed. */
  const files = ["engine/effects.js", "engine/prompts.js", "engine/judge.js",
                 "engine/game.js", "engine/build.js", "index.html"];
  const sites = [];
  for(const f of files){
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const lines = src.split("\n");
    lines.forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, "");
      const m = code.match(/\bdeck\s*=\s*(?:[^;]*\?\s*)?\[\s*([^\],]*)/);
      if(!m) return;
      const first = m[1].trim();
      if(first === "" || /^\.\.\.\(?\s*[\w.()]*deck\b/.test(first)) return;    /* append / empty */
      const window = lines.slice(Math.max(0, i - 12), i + 1).join("\n");
      sites.push({f, line: i + 1, asks: /deckTopTo/.test(window), first});
    });
  }
  const bad = sites.filter(s => !s.asks);
  assert.deepEqual(bad, [], "a deck-top writer that does not ask `deckTopTo`");
  assert.ok(sites.length >= 3, "only " + sites.length + " writers found — the scan is aimed wrong");
  /* AND THE OPT BRANCH, BY NAME: it builds the deck behind a ternary over
     spreads, which is the shape the scan above is weakest on. */
  const pr = fs.readFileSync(path.join(ROOT, "engine/prompts.js"), "utf8");
  const at = pr.indexOf('if(prompt.tag === "opt"){\n    const keep');
  assert.ok(at > 0, "the opt application moved — re-anchor");
  assert.match(pr.slice(at, at + 2500), /const _flip = P\.deckTopTo\(game\) === "deckBottom";/,
    "opt's application must ask the one reader");
});

test("the census scan is proved alive against a control", () => {
  /* built by concatenation, so this file does not contain the literal it
     plants (v4.32) */
  const planted = "    fs." + "deck = [got, ...fs.deck];";
  const m = planted.match(/\bdeck\s*=\s*(?:[^;]*\?\s*)?\[\s*([^\],]*)/);
  assert.ok(m && !/^\.\.\./.test(m[1].trim()), "the scan cannot see a front-insert");
  const app = "    s." + "deck = [...(s.deck||[]), ...cards];";
  const m2 = app.match(/\bdeck\s*=\s*(?:[^;]*\?\s*)?\[\s*([^\],]*)/);
  assert.ok(/^\.\.\.\(?\s*[\w.()]*deck\b/.test(m2[1].trim()), "and must not flag an append");
});

/* ---- 5. THE WIRE AND THE REPORT -------------------------------------- */

test("the flag survives the wire, which is what the bump is ABOUT", {skip}, () => {
  /* `WIRE_V` went 13 -> 14 because the game gained a top-level key the zone
     digest cannot see (wire.js's header). THE OTHER HALF: the key really
     rides, and a round trip does not move the fingerprint — a bump for a
     field the wire drops is a version number with nothing behind it
     (dichotomy.test.js's rule). */
  const W = require("../engine/wire.js");
  assert.ok(W.WIRE_V >= 14, "the bump for `deckFlip` was undone");
  const g = board(true);
  const back = W.decode(W.encode(g));
  assert.equal(back.deckFlip, g.deckFlip, "`deckFlip` did not survive the round trip");
  assert.equal(W.hash(back), W.hash(g), "the fingerprint moved across a round trip");
  /* AND IT IS PART OF THE RULES STATE: two peers that disagree about the
     flag must NOT hash alike, or the desync it causes is invisible. */
  assert.notEqual(W.hash(board(true)), W.hash(board(false)));
});

test("the bug report names a live replacement, and says nothing when there is none", () => {
  const R = require("../engine/report.js");
  const on = R.build({...S.makeGame(), deckFlip: "Topsy Turvy — ability"}, {});
  assert.deepEqual(on.turnMods, {costTax: 0, deckFlip: "Topsy Turvy — ability"});
  assert.deepEqual(R.build(S.makeGame(), {}).turnMods, {costTax: 0, deckFlip: null});
});

test("the FEED says where the cards went, and never claims a top order under the flip", {skip}, () => {
  /* THE ONE DRILL HERE THAT READS PROSE, AND WHY (v3.60): with the flip set
     the game state is identical whatever the feed says, so the only thing a
     wrong line changes is what the player is TOLD — the sev-2 category they
     trust. Two lines could lie: the shared "→ <zone>" line, and v4.59's
     "On top of the deck: A first, then B" for a multi-card pick. */
  for(const flip of [false, true]){
    const g = board(flip, {grave: [card("Wounding Blow", 1, "gy1"), card("Brutal Assault", 1, "gy2")]});
    const r = PM.applyPrompt(g, {...PM.buildPrompt(g,
      {tag: "pick", side: 0, src: "SYN-ORDER", zone: "grave", to: "deckTop", min: 2, max: 2}), sel: [0, 1]});
    const sd = r.game.sides[0];
    assert.deepEqual(flip ? sd.deck.slice(-2).map(c => c.uid) : sd.deck.slice(0, 2).map(c => c.uid),
      ["gy1", "gy2"], "fixture: the cards landed where the replacement says (flip=" + flip + ")");
    const feed = r.msgs.join(" | ");
    assert.equal(/On top of the deck:/.test(feed), !flip, "the top-order line (flip=" + flip + "): " + feed);
    assert.equal(/→ deckTop\b/.test(feed), !flip, "the shared line names the TOP (flip=" + flip + "): " + feed);
    if(flip) assert.match(feed, /→ deckBottom\b/, "and names the bottom when that is where they went");
  }
});

test("THE LADDER CANNOT SEE IT, AND THAT IS THE LOADOUT — pinned as a premise", {skip}, () => {
  /* `defaultPicks` ranks a slot by PRINTED DEFENCE and reads no card text,
     so Arakni's head goes to Prey Spotters (1) over Topsy Turvy (0) and no
     driven game ever wears the piece: v4.43's Hood, v4.49's Gun, v4.52's
     Stilettos and v4.55's Robe, fifth outing. The ladder is byte-identical
     for that reason, and the route is DRIVEN above instead. If this ever
     changes, the ladder starts measuring the card and somebody re-reads
     what it says. */
  const C = require("../engine/cards.js");
  const G = require("../engine/game.js");
  const {loadData, cardDbPath} = require("./helpers/extract.js");
  const db = C.buildMaps(JSON.parse(fs.readFileSync(cardDbPath(), "utf8")).filter(c => c && c.name).map(C.mapDbCard));
  const W = loadData();
  const list = B.gearSlots(G.parseDeck(W.DECKS.arakni).gear.map(e => C.resolveEntry(db, e, "SAR")));
  const worn = B.defaultPicks(list).map(i => list.find(x => x.i === i).c.name);
  assert.ok(list.some(x => x.c.name === "Topsy Turvy"), "fixture: Arakni decks the piece");
  assert.ok(worn.includes("Prey Spotters"), "the head slot goes to the higher printed defence");
  assert.ok(!worn.includes("Topsy Turvy"), "so a driven game never wears it");
});
