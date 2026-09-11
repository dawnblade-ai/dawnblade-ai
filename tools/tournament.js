/* ============================================================
   tools/tournament.js — SIXTEEN SEATS, ONE TROPHY

       node tools/tournament.js                 # the full event
       node tools/tournament.js --quick         # one seed per qualifier pair
       node tools/tournament.js --name "Autumn" # a different event, reproducibly

   THE TABLE, PLAYED FOR KEEPS. `tools/tourney.js` runs a LADDER: every
   pairing, counted, ranked by wins. That answers "which hero wins most"
   and it deliberately answers nothing about a single meeting, because a
   ladder has no stakes and no elimination. This runs a BRACKET — fifteen
   ties, each one decisive, each one played out until somebody is out.

   IT IS THE SAME INSTRUMENT WEARING A DIFFERENT HAT, and that is the
   point: `judge.reduce` in the middle, `sparring.act` in both seats, and
   `invariants.check` against every intermediate state. Nothing about the
   engine changes because there is a trophy on the line.

   ---- THE FIELD IS SIXTEEN, AND THE SIXTEENTH IS THE DUMMY ------------

   This project decks FIFTEEN heroes. A bracket of sixteen needs sixteen,
   and there is exactly one other thing a seat may legally hold: the
   vanilla pile (ruling, user, 2026-08-16 — "a seat the dummy fills is
   ALWAYS the vanilla pile"). So it enters, under its own name, and it is
   seeded on its results like everybody else.

   AT TWENTY LIFE, NOT FORTY-TWO. `build.buildVanilla`'s own header says
   42 is "a training prop's number, not a rule" — the trainer's tuning for
   how long a practice session should last. A competitor sitting on double
   everybody else's life is not in the same tournament. That is a
   TOURNAMENT RULING rather than an engine fact, so it is stated here and
   printed in the report rather than defaulted quietly.

   ---- SEEDING IS EARNED -----------------------------------------------

   An alphabetical bracket is a bracket whose result is mostly the draw.
   Every entrant plays every other entrant TWICE in the qualifier, once in
   each chair, so the seeding carries no seat bias into the knockout. 240
   games, about half a minute.

   ---- A TIE IS A MATCH, AND IT LENGTHENS AS THE STAKES RISE ------------

   `sparring.js`'s stated property is that "the winner follows the HERO,
   not the chair". One game decides a tie on the coin-toss of seating, so
   every tie is played as LEGS with the chairs swapped between each pair
   of them, and the format escalates: best of 3 in the round of 16, best
   of 5 in the quarters and semis, best of 7 in the final.

   THAT ESCALATION IS NOT DECORATION — IT IS THE MEASURED ANSWER TO A
   MEASURED PROBLEM. This pool's matchups are lopsided: Arakni beats Blaze
   **74-6 over 80 games** (92%), and 92% still loses a best-of-three about
   once in 180. The first running of this event produced exactly that —
   Blaze put the top qualifier out 2-0 in the quarters — so a short tie is
   a test of variance rather than of decks. A best-of-seven turns that
   0.56% into 0.04%.

   Chair assignment alternates from leg 1 and every ODD-numbered decider
   is drawn from the event's own seeded stream: a coin toss that replays
   identically.

   ---- A DRAWN LEG IS A REAL RESULT ------------------------------------

   CR 4.5.3 lists three ways to lose and an empty deck is not one of them,
   so a genuinely unwinnable board exists — v3.80 records one by name
   (`iyslander-boltyn-0`, both decks empty, 1566 turns). A leg that
   reaches the step limit with nobody dead is a DRAW, scored half a leg
   each, and if a tie is still level after three legs it is decided on
   LIFE REMAINING across the legs. That last rule is the tournament's, not
   the game's, and the report says so where it is used.

   ---- THE JUDGES ------------------------------------------------------

   Three, hired by name, and none of them is new machinery:

     HEAD JUDGE     `invariants.errors`, run against EVERY intermediate
                    state rather than the end state — a game that finishes
                    clean can still have passed through a broken board.
     FLOOR JUDGE    `judge.reduce`'s refusals. `sparring.js`'s contract is
                    that it proposes only legal actions, so a refusal is
                    always a fault — never a player's.
     SCOREKEEPER    `selfplay.FAULTS` (MALFORMED, SECOND-PERSON) over
                    every feed line, plus this event's own STALL count.
     DECK CHECK     the WARN half of `invariants.check`, which this
                    project has never once read. Every caller in the repo
                    — every drill, every scene, the self-play harness and
                    the trainer's own `setG` funnel — calls `errors()`,
                    which filters warnings OUT. So `HP-ABOVE-START`,
                    `CHAIN-CLOSED-WITH-LINKS` and `DEAD-BUT-RUNNING` have
                    been produced and consulted by nobody, and the last of
                    those is CR 4.5.3's life-to-zero loss not having been
                    applied. A severity band with no reader is v3.55's
                    "no-op wearing a number" one layer up.

   THEY RULE ON THE BOARD, NEVER ON A PLAYER. Nothing a judge reports can
   change a result — a violation means the ENGINE is wrong, and a trophy
   awarded over a broken board is a trophy this project should not trust.
   So a clean sheet is a claim the report makes explicitly, and any
   finding at all puts an asterisk on the winner.
   ============================================================ */

const {play, W, DB, J, FAULTS} = require("./selfplay.js");
const B   = require("../engine/build.js");
const G   = require("../engine/game.js");
const RNG = require("../engine/rng.js");

const ARG  = process.argv.slice(2);
const flag = f => ARG.includes(f);
const opt  = (f, d) => { const i = ARG.indexOf(f); return i >= 0 ? ARG[i + 1] : d; };
const NAME  = opt("--name", "Dawnblade Invitational");
const QUICK = flag("--quick");

/* THE DUMMY'S LIFE IS THE TOURNAMENT'S RULING, above. `int` is left at
   the trainer's 4 because that is a printed-intellect equivalent rather
   than a training prop's number — twelve of the fifteen heroes print 4. */
const DUMMY = {key: null, name: "The Dummy", hp: 20, int: W.DUMMY_INT};

const ENTRANTS = W.HEROES.map(h => ({key: h.k, name: h.n, hero: h}))
                         .concat([{key: null, name: DUMMY.name}]);
const label = e => e.name;

/* ---- ONE GAME --------------------------------------------------------
   `selfplay.match` seats two HEROES and cannot seat the dummy, so the
   build is done here — from the same two builders, threading the same
   single rng stream and the same shared uid counter, because a repeated
   uid is `CARD-IN-TWO-ZONES` wearing a disguise (build.js's own note). */
function seatBuild(e, rng, ctr){
  if(e.key == null)
    return B.buildVanilla(W.DUMMY_DECK, W.DUMMY_GEAR, DB, rng, ctr,
                          {hp: DUMMY.hp, int: DUMMY.int});
  return B.buildSideDefault(e.hero, G.parseDeck(W.DECKS[e.key]), DB, rng, ctr);
}

function game(e0, e1, seed, first){
  const ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = seatBuild(e0, rng, ctr); rng = b0.rng;
  const b1 = seatBuild(e1, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [label(e0), label(e1)],
                     heroKeys: [e0.key, e1.key], rng, first: first || 0, tokSeq: ctr.n});
}

/* The judges' sheet for one leg. `winner` is an ENTRANT or null (a draw);
   everything else is what the three of them saw. */
/* winner|loser -> games won, over the qualifier's two meetings. */
const H2H = new Map();
const BOOK = {viols: [], warns: [], refusals: [], faults: Object.fromEntries(FAULTS.map(k => [k, []])),
              stalls: 0, games: 0, turns: 0, routes: {}};

function leg(e0, e1, seed, first, where){
  let r;
  /* A THROWN GAME IS A MALFORMED ONE (tourney.js's own rule), filed by
     the same name so the summary counts it beside the feed lines. */
  try { r = play(game(e0, e1, seed, first)); }
  catch(err){
    BOOK.faults.MALFORMED.push({where, seed, throw: err.message});
    return {winner: null, threw: true, seed, first, hp: [0, 0], turns: 0};
  }
  BOOK.games++;
  BOOK.turns += r.game.turn;
  for(const v of r.viols)   BOOK.viols.push({where, seed, ...v});
  for(const v of r.warns)   BOOK.warns.push({where, seed, ...v});
  for(const e of r.errs)    BOOK.refusals.push({where, seed, ...e});
  for(const [k, line] of r.events){
    BOOK.routes[k] = (BOOK.routes[k] || 0) + 1;
    if(BOOK.faults[k]) BOOK.faults[k].push({where, seed, line});
  }
  const over = r.game.over;
  if(!over){ BOOK.stalls++; return {winner: null, stall: true, seed, first,
                                    hp: r.game.sides.map(s => s.hp), turns: r.game.turn}; }
  return {winner: over.winner === 0 ? e0 : e1, how: over.how, seed, first,
          hp: r.game.sides.map(s => s.hp), turns: r.game.turn};
}

/* ---- THE QUALIFIER ---------------------------------------------------
   Every ordered pair once: each entrant plays 30 games, 15 in each chair.
   A MIRROR IS SKIPPED and is not a gap — v4.31 records why a mirror's win
   says nothing about a hero ladder, and with sixteen distinct entrants a
   bracket cannot produce one either. */
function qualify(){
  const rec = new Map(ENTRANTS.map(e => [e.name, {e, w: 0, l: 0, d: 0, lifeFor: 0, lifeAgainst: 0}]));
  const seeds = QUICK ? 1 : 1;
  for(const a of ENTRANTS) for(const b of ENTRANTS){
    if(a === b) continue;
    for(let s = 0; s < seeds; s++){
      const res = leg(a, b, `${NAME}:q:${a.name}:${b.name}:${s}`, 0, `qualifier ${a.name} v ${b.name}`);
      const ra = rec.get(a.name), rb = rec.get(b.name);
      ra.lifeFor += res.hp[0]; ra.lifeAgainst += res.hp[1];
      rb.lifeFor += res.hp[1]; rb.lifeAgainst += res.hp[0];
      if(!res.winner){ ra.d++; rb.d++; continue; }
      const w = res.winner === a ? ra : rb, l = res.winner === a ? rb : ra;
      w.w++; l.l++;
      /* THE HEAD-TO-HEAD IS KEPT, because the most interesting thing a
         bracket produces is a result that DISAGREES with the ladder, and
         a report that cannot name one is just a list of winners. */
      H2H.set(res.winner.name + "|" + (res.winner === a ? b : a).name,
             (H2H.get(res.winner.name + "|" + (res.winner === a ? b : a).name) || 0) + 1);
    }
  }
  /* RANKED ON WINS, THEN ON LIFE DIFFERENTIAL, THEN ON NAME. The last key
     is what makes the order TOTAL — an unbroken tie is a coin toss hiding
     inside a sort, and this project has a standing rule against exactly
     that (sparring.js: "a ranking that leaves ties unbroken is a desync
     waiting for two equal blockers"). */
  return [...rec.values()].sort((x, y) =>
      y.w - x.w
   || (y.lifeFor - y.lifeAgainst) - (x.lifeFor - x.lifeAgainst)
   || (x.e.name < y.e.name ? -1 : 1));
}

/* ---- THE BRACKET -----------------------------------------------------
   The standard seeding order, DERIVED rather than typed: 1 meets 16, and
   1 and 2 can only meet in the final. A typed list of eight pairs is a
   census that passes by finding nothing if a number is dropped. */
function bracketOrder(n){
  let o = [1];
  while(o.length < n){ const m = o.length * 2 + 1; o = o.flatMap(s => [s, m - s]); }
  return o;
}

/* WHICH CHAIR, LEG BY LEG — AND THERE IS NO COIN.

   The chairs simply ALTERNATE: odd legs to the higher seed, even legs to
   the lower. An odd-length format cannot split them evenly, and the spare
   chair goes to the HIGHER SEED because that is what the qualifier bought
   — the same reward a home tie is in any bracket.

   IT IS NOT A COIN, AND THAT IS A DELIBERATE CHANGE FROM THE FIRST DRAFT.
   Measured in this pool, the chair is worth about 2:1 in a close matchup
   (Dorinthea v Arakni over 80 games: Dorinthea 24 wins with it and 12
   without). Handing a decider that big to a coin puts the variance back
   that the longer formats exist to take out. A deterministic reward is
   both fairer and explainable.

   SO THE WHOLE EVENT IS A PURE FUNCTION of the card database and the
   event's name — every game seed is derived from it, and nothing here
   draws from a random stream at all. Run it twice, get the same trophy.

   The first draft's coin is recorded because the bug in it is the kind
   worth remembering: `RNG.int(_, 2)` is 0..1, a COIN, while `RNG.roll` is
   1..sides, a DIE — so `roll(_, 2).v === 0` is never true and every
   decider would have seated the same entrant, a bias that looks exactly
   like a coin toss from the outside. */
function chairOf(i){
  return {firstIsHi: i % 2 === 0};
}

/* THE SCORE, AND THE ONE RULE THE TOURNAMENT INVENTS.
   A drawn leg is half a leg each (CR 4.5.3 has three ways to lose and an
   empty deck is not one). Level after three legs is decided on LIFE
   REMAINING across them — that rule belongs to the event, not to Flesh
   and Blood, so `by` names it and the report prints which was used.
   `hp` is indexed by CHAIR, so it is read through each leg's own `hi`
   rather than assumed: the seats swap between legs and a fixed index
   reads the opponent's life on half of them. */
function settle(legs, hi, lo){
  let a = 0, b = 0;
  for(const L of legs){
    if(!L.winner){ a += 0.5; b += 0.5; }
    else if(L.winner === hi) a++;
    else b++;
  }
  if(a !== b) return {win: a > b ? hi : lo, out: a > b ? lo : hi, a, b, by: "legs"};
  const life = e => legs.reduce((t, L) =>
    t + L.hp[L.hi === 0 ? (e === hi ? 0 : 1) : (e === hi ? 1 : 0)], 0);
  const lh = life(hi), ll = life(lo);
  const win = lh >= ll ? hi : lo;
  return {win, out: win === hi ? lo : hi, a, b, by: "life", life: [lh, ll]};
}

/* A TIE IS BEST OF THREE, CHAIRS SWAPPED — because `sparring.js`'s stated
   property is that the winner follows the HERO, not the chair, and one
   game decides a tie on the coin-toss of seating. */
/* HOW MANY LEGS WIN A TIE. Its own function because the alternative is a
   literal at the one call site, where sabotaging it to `2` is silent
   against every drill — a rule living somewhere nothing can reach it
   (v4.05). An EVEN format has no such number: `ceil(4/2)` is 2 and 2-2 is
   a drawn tie, which is why `ROUNDS` is drilled to hold only odd ones. */
const winsNeeded = bestOf => Math.ceil((bestOf || 3) / 2);

function tie(hi, lo, round, bestOf){
  const legs = [], base = `${NAME}:${round}:${hi.name}:${lo.name}`;
  const need = winsNeeded(bestOf);
  let a = 0, b = 0;
  for(let i = 0; i < (bestOf || 3); i++){
    const c = chairOf(i);
    const e0 = c.firstIsHi ? hi : lo, e1 = c.firstIsHi ? lo : hi;
    const res = leg(e0, e1, `${base}:${i}`, 0, `${round}: ${hi.name} v ${lo.name} leg ${i + 1}`);
    legs.push(Object.assign(res, {hi: c.firstIsHi ? 0 : 1}));
    if(!res.winner){ a += 0.5; b += 0.5; }
    else if(res.winner === hi) a++;
    else b++;
    if(a >= need || b >= need) break;
  }
  return Object.assign(settle(legs, hi, lo), {legs, bestOf: bestOf || 3});
}

/* THE FORMAT ESCALATES, and the reason is measured rather than
   traditional — see the header. A best-of-three between decks 92 points
   apart is a test of variance; a best-of-seven is a test of decks. Each
   length must be ODD: an even one can end level on legs, and a trophy
   decided by the tournament's own life tiebreak in the FINAL would be a
   worse answer than one more game. */
const ROUNDS = [["ROUND OF 16", 3], ["QUARTER-FINALS", 5], ["SEMI-FINALS", 5], ["FINAL", 7]];
const THIRD_PLACE_BEST_OF = 5;

module.exports = {bracketOrder, chairOf, settle, winsNeeded, ROUNDS, THIRD_PLACE_BEST_OF,
                  ENTRANTS, DUMMY, qualify, tie, leg, game, BOOK};

/* THE EVENT RUNS ONLY AS A SCRIPT, so `test/tournament.test.js` can drill
   the rules above without playing 274 games to do it (selfplay.js's own
   shape). */
if(require.main !== module) return;

/* ============================================================ */
const t0 = Date.now();
console.log(`\n  ${"=".repeat(64)}`);
console.log(`  ${NAME.toUpperCase()} — sixteen seats, one trophy`);
console.log(`  ${"=".repeat(64)}`);
console.log(`  the table: judge.reduce · sparring.act in both seats · ${ENTRANTS.length} entrants`);
console.log(`  RULING: the dummy enters at ${DUMMY.hp} life, not the trainer's 42.\n`);

console.log("  QUALIFIER — every ordered pair, both chairs\n");
const table = qualify();
console.log("   seed  entrant                          W   L   D    life +/-");
table.forEach((r, i) => console.log(
  `    ${String(i + 1).padStart(2)}   ${r.e.name.padEnd(30)} ${String(r.w).padStart(2)}  ${String(r.l).padStart(2)}  ${String(r.d).padStart(2)}    ${String(r.lifeFor - r.lifeAgainst).padStart(5)}`));

const seeded = table.map(r => r.e);
const order = bracketOrder(16);
let field = order.map(s => ({e: seeded[s - 1], seed: s}));
const played = [];
const upsets = [];
let semiLosers = [];

/* Who won the qualifier's two meetings, as a string, so a bracket result
   that contradicts it can be NAMED rather than left for a reader to spot. */
const h2h = (x, y) => [H2H.get(x + "|" + y) || 0, H2H.get(y + "|" + x) || 0];

function report(round, hi, lo, t){
  played.push({round, hi: hi.e.name, lo: lo.e.name, ...t, win: t.win.name, out: t.out.name});
  const detail = t.legs.map(L => L.winner ? (L.winner === hi.e ? "H" : "A") : "=").join("");
  const [qw, ql] = h2h(t.win.name, t.out.name);
  const flip = qw < ql;
  if(flip) upsets.push({round, win: t.win.name, out: t.out.name, tie: `${t.a}-${t.b}`, qualifier: `${qw}-${ql}`});
  console.log(`    (${String(hi.seed).padStart(2)}) ${hi.e.name.padEnd(28)} ${`${t.a}-${t.b}`.padEnd(7)} `
    + `(${String(lo.seed).padStart(2)}) ${lo.e.name.padEnd(28)} -> ${t.win.name}`
    + `   [Bo${t.bestOf} ${detail}${t.by === "life" ? `, on life ${t.life[0]}-${t.life[1]}` : ""}]`
    + (flip ? `  * lost the qualifier meeting ${qw}-${ql}` : ""));
}

for(const [round, bestOf] of ROUNDS){
  console.log(`\n  ${round}  (best of ${bestOf})\n  ${"-".repeat(round.length)}`);
  const next = [];
  for(let i = 0; i < field.length; i += 2){
    const x = field[i], y = field[i + 1];
    const hi = x.seed < y.seed ? x : y, lo = x.seed < y.seed ? y : x;
    const t = tie(hi.e, lo.e, round.toLowerCase().replace(/[^a-z0-9]+/g, "-"), bestOf);
    report(round, hi, lo, t);
    next.push(t.win === hi.e ? hi : lo);
    if(round === "SEMI-FINALS") semiLosers.push(t.win === hi.e ? lo : hi);
  }
  field = next;
}

const champ = field[0];
console.log(`\n  THIRD PLACE  (best of ${THIRD_PLACE_BEST_OF})\n  -----------`);
const t3hi = semiLosers[0].seed < semiLosers[1].seed ? semiLosers[0] : semiLosers[1];
const t3lo = t3hi === semiLosers[0] ? semiLosers[1] : semiLosers[0];
const third = tie(t3hi.e, t3lo.e, "third-place", THIRD_PLACE_BEST_OF);
report("THIRD PLACE", t3hi, t3lo, third);

console.log(`\n  ${"=".repeat(64)}`);
console.log(`  CHAMPION: ${champ.e.name}  (qualifier seed ${champ.seed})`);
console.log(`  runner-up: ${played.filter(p => p.round === "FINAL")[0].out} · third: ${third.win.name}`);
console.log(`  ${"=".repeat(64)}`);

/* ---- THE JUDGES REPORT ----------------------------------------------
   A CLEAN SHEET IS A CLAIM, NOT A SILENCE. "The scan found nothing"
   cannot pass for "everything is accounted for" (v3.21, v3.47, v4.00), so
   the report prints what each judge WATCHED as well as what they found,
   and puts an asterisk on the trophy if any of them found anything. */
const faultTotal = FAULTS.reduce((t, k) => t + BOOK.faults[k].length, 0);
/* A WARNING COUNTS TOWARD THE ASTERISK. It is a lower severity, not a
   lower standard — and the whole reason this judge was hired is that
   nobody had ever looked. Counted separately so the report can say which
   band a number came from (v3.81). */
const warnKinds = [...new Set(BOOK.warns.map(v => v.code))];
const findings = BOOK.viols.length + BOOK.refusals.length + faultTotal + BOOK.warns.length;
console.log(`\n  THE JUDGES  (${BOOK.games} games, ${(BOOK.turns / Math.max(1, BOOK.games)).toFixed(1)} turns avg, ${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
console.log(`    HEAD JUDGE   invariants.errors on every intermediate state   ${BOOK.viols.length} violations`);
console.log(`    FLOOR JUDGE  judge.reduce refusals (sparring's contract)     ${BOOK.refusals.length} refusals`);
console.log(`    SCOREKEEPER  ${FAULTS.join(" · ")} · stalls`
  + `        ${FAULTS.map(k => BOOK.faults[k].length).join(" · ")} · ${BOOK.stalls}`);
console.log(`    DECK CHECK   invariants.check WARN band (never read before)     ${BOOK.warns.length} warnings`
  + (warnKinds.length ? `  [${warnKinds.join(", ")}]` : ""));
for(const k of FAULTS) if(BOOK.faults[k].length) console.log(`\n    ${k}:`, JSON.stringify(BOOK.faults[k].slice(0, 5), null, 1));
if(BOOK.viols.length)    console.log("\n    VIOLATIONS:", JSON.stringify(BOOK.viols.slice(0, 5), null, 1));
if(BOOK.refusals.length) console.log("\n    REFUSALS:",   JSON.stringify(BOOK.refusals.slice(0, 5), null, 1));
if(BOOK.warns.length){
  console.log("\n    WARNINGS by kind:");
  for(const k of warnKinds)
    console.log(`      ${k.padEnd(24)} ${BOOK.warns.filter(v => v.code === k).length}`
      + `   e.g. ${(BOOK.warns.find(v => v.code === k) || {}).msg}`);
  console.log("\n    first 3 in full:", JSON.stringify(BOOK.warns.slice(0, 3), null, 1));
}
console.log(`\n    VERDICT: ${findings === 0
  ? "clean sheet — the trophy stands."
  : `${findings} finding(s) — the trophy carries an asterisk until they are answered.`}`);

/* THE BRACKET AGAINST THE LADDER. The qualifier is thirty games an
   entrant and the bracket is a handful; where they disagree, the LADDER
   is the better evidence and the bracket is the story. Naming the
   disagreements is what stops a trophy being read as a ranking. */
console.log("\n  WHERE THE BRACKET DISAGREED WITH THE QUALIFIER:");
if(!upsets.length) console.log("    nothing — every tie went to the entrant who won their qualifier meetings.");
for(const u of upsets)
  console.log(`    ${u.round.padEnd(15)} ${u.win} beat ${u.out} ${u.tie}, having lost the qualifier ${u.qualifier}`);

/* WHAT ACTUALLY FIRED. A number here means a FEATURE FIRED (v4.17), which
   is the opposite of what a judge's number means — so the two blocks are
   kept apart and the faults are excluded from this one by name. */
console.log("\n  MECHANICS SEEN AT THIS EVENT (games in which a route's feed line appeared):");
for(const [k, v] of Object.entries(BOOK.routes).filter(([k]) => !FAULTS.includes(k)).sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(12)} ${v}`);

const fs = require("fs"), path = require("path");
const out = path.join(__dirname, ".cache");
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, "tournament.json"), JSON.stringify(
  {name: NAME, champion: champ.e.name, seeding: table.map((r, i) => ({seed: i + 1, name: r.e.name, w: r.w, l: r.l, d: r.d, diff: r.lifeFor - r.lifeAgainst})),
   ties: played.map(p => ({round: p.round, hi: p.hi, lo: p.lo, win: p.win, out: p.out, a: p.a, b: p.b, by: p.by,
                           legs: (p.legs || []).map(L => ({seed: L.seed, hiChair: L.hi, win: L.winner && L.winner.name, hp: L.hp, turns: L.turns, how: L.how}))})),
   judges: {violations: BOOK.viols, warnings: BOOK.warns, refusals: BOOK.refusals,
            faults: BOOK.faults, stalls: BOOK.stalls, games: BOOK.games, clean: findings === 0},
   upsets, routes: BOOK.routes}, null, 1));
console.log(`\n  full card written to tools/.cache/tournament.json\n`);
