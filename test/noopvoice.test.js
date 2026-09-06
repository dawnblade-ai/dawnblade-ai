/* ============================================================
   A `noop`'s REASON IS PLAYER-FACING TEXT (v4.24)

   `runOps` prints it verbatim:

     else if(k==="noop"){ n=L(n,`${srcName}: ${v}.`); }

   So the string has TWO readers — the AUDIT, which wants to know the
   clause is accounted for and by what, and the PLAYER, who is being
   taught the game by the feed. Nothing was holding it to the second.

   FOUND BY DRIVING A NEW ONE. v4.24's first draft of the crank noop read
   *"live — v4.24; the offer is made as the permanent enters the arena
   (parser.crankCost)"*, and the very first driven game printed it into
   the feed under the card's name. Censused, TWO more were already there:

     "live since v2.05 — the dummy holds a hand to restrict and to lose
      cards from"                                   dominate · intimidate
     "live — build.js equips the piece face-down and the ability's flip
      cost spends it"                                        Uphold Tradition

   A version number, the name of a training prop retired at v2.71, and a
   module path. In a training sim the feed is the lesson, and a line that
   reads like a code comment is the sev-2 category the player TRUSTS.

   THE FIX IS THE FAMILY, NOT THE THREE (v4.21). This is the standing
   census: every `noop` reason that can reach a POOL CARD is held to
   reading as game text, so the next one fails a drill rather than
   shipping.

   IT IS A DERIVATION, NOT A PIN. The reasons are prose and change often;
   pinning the SET would make every reword a test edit. What is pinned is
   the fault COUNT at zero — and the scan is proved alive against a
   control string, because a scan aimed at the wrong shape passes by
   finding nothing (v3.00, v3.81, v4.07).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

/* WHAT MAKES A LINE READ AS A CODE COMMENT. Each half is a real fault
   this census found, kept as its own alternative so a failure names the
   shape rather than only the string. */
const DEV_VOICE = [
  [/\bv\d\.\d\d\b/,            "a version number"],
  [/\.js\b/,                   "a filename"],
  [/[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\(/, "a function call"],
  [/`/,                        "a backtick"],
  [/\bfxParse\b|\bclassifyClause\b|\brunOps\b|\bexecute\(/, "an engine identifier"]
];
const faults = s => DEV_VOICE.filter(([rx]) => rx.test(s)).map(([, why]) => why);

function poolNoopReasons(){
  const raw = require("../data/pool.json");
  const db = C.buildMaps(raw.filter(c => c && c.name).map(C.mapDbCard));
  const out = new Map();
  for(const r of raw){
    if(!r || !r.name) continue;
    const c = C.resolveEntry(db, {name: r.name, p: r.pitch === "" || r.pitch == null ? 0 : +r.pitch,
                                  code: null, q: 1});
    if(!c) continue;
    const fx = P.fxParse(c);
    const take = ops => { for(const o of ops || []) if(o[0] === "noop" && typeof o[1] === "string"){
      if(!out.has(o[1])) out.set(o[1], r.name); } };
    take(fx.ops);
    for(const cd of fx.conds || []) take([cd.op]);
    for(const md of fx.modes || []) take(md.ops);
  }
  return out;
}

test("the scan is ALIVE — a control string is flagged by every shape", () => {
  assert.deepEqual(faults("live — v4.24; see parser.crankCost() in engine/parser.js `here` via fxParse"),
    ["a version number", "a filename", "a function call", "a backtick", "an engine identifier"],
    "all five shapes fire, so a zero below means the reasons are clean " +
    "rather than that the scan stopped matching");
  assert.deepEqual(faults("a defence restriction — the wall reads it when this attacks"), [],
    "and ordinary game text is not flagged");
});

test("no `noop` reason that reaches a pool card reads as developer text", {skip}, () => {
  H.db();
  const reasons = poolNoopReasons();
  /* THE DENOMINATOR IS ASSERTED TOO. A census that stops finding reasons
     reports zero faults perfectly (v2.47, v4.00: write the other
     direction). 34 distinct reasons reached a card when this was written;
     the floor is deliberately loose because the number moves whenever a
     clause is built, and the FAULT count is what is pinned at zero. */
  assert.ok(reasons.size >= 25,
    "the census found " + reasons.size + " distinct reasons — too few to be " +
    "walking the pool at all");
  const bad = [];
  for(const [why, card] of reasons){
    const f = faults(why);
    if(f.length) bad.push(card + ": \"" + why + "\" — " + f.join(", "));
  }
  assert.deepEqual(bad, [],
    "a noop's reason is printed VERBATIM into the feed by `runOps`, so it is " +
    "the player's line as well as the auditor's. Say what happens at the table.");
});

test("the three that were rewritten still say what is handled, in game words", {skip}, () => {
  H.db();
  /* A REWRITE MUST NOT EMPTY THE CLAIM. A `noop` asserts that something
     reads the clause (v3.59) — so each of these still names the moment or
     the mechanism, just without naming a file. */
  const say = t => (P.classifyClause(t) || {ops: [[0, ""]]}).ops[0][1];
  assert.match(say("Crank"), /enters the arena/);
  assert.match(say("Dominate"), /defen[cs]e|wall/i);
  assert.match(say("Intimidate"), /hand/i);
  assert.match(say("Cloaked"), /face-down/);
  for(const t of ["Crank", "Dominate", "Intimidate", "Cloaked"])
    assert.deepEqual(faults(say(t)), [], t);
});
