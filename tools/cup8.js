/* ============================================================
   tools/cup8.js — EIGHT SEATS, BEST OF ONE, TWO VOICES IN THE BOOTH

       node tools/cup8.js                  # the event
       node tools/cup8.js --name "Autumn"  # a different draw, reproducibly
       node tools/cup8.js --full           # every row, not only the called ones
       node tools/cup8.js --match 3        # one tie's log, in full

   `tools/tourney.js` runs a LADDER and answers which hero wins most.
   `tools/tournament.js` runs a SIXTEEN-seat bracket with an earned
   seeding and an escalating format, and answers a MATCHUP. This runs the
   shortest tie there is — **eight entrants, one game per round** — and it
   exists for a different reason: to be READ.

   ---- BEST OF ONE IS A VARIANCE TEST, AND THE REPORT SAYS SO ----------

   That is not a complaint about the format, it is this project's own
   measurement. Arakni beats Blaze 74-6 over 80 games (92%) and a 92%
   favourite still loses a best-of-THREE about once in 180; over a single
   game it loses about once in 12. And the CHAIR is worth about 2:1 in a
   close matchup (Dorinthea beats Arakni 24 times with it and 12 without,
   over 80 games), so in a Bo1 with no qualifier the draw is a real share
   of the result. `tools/tournament.js` escalates its formats precisely to
   buy that variance back out.

   SO NOTHING HERE IS EVIDENCE ABOUT A DECK. What a Bo1 bracket is good
   for is exactly what it is used for below: seven complete games, read
   line by line, with every judge awake — v3.49's argument for playing the
   game at all, pointed at legibility rather than at a win count.

   ---- THE TWO VOICES ARE READERS, NOT AUTHORS -------------------------

   This is the part that could go wrong quietly, so it is stated as a
   contract and drilled in `test/cup8.test.js`:

     TALLY  (play-by-play) reads ONE timeline row — the action, the feed
            lines it printed, and the life totals it left — and says what
            happened. Every number it speaks is off that row.
     LEDGER (colour) reads what Tally does not: the life SWING, the route
            counters that fired on that row, the CR step, the chain, and
            the printed reason a hero's own machinery just did something.

   NEITHER MAY INVENT. A commentator that narrates is `failstates.js`
   counting a keyword named in a comment (v4.27) wearing a headset — it
   would read as an observation and be a claim. So every called line
   carries the row index it came from, `--full` prints the raw rows beside
   the call, and the drill drives a synthetic timeline and fails if a
   voice says a number the row does not contain.

   AND THE BOOTH IS NOT A JUDGE. Commentary cannot change a result and
   cannot clear one: the four judges below are the same four
   `tools/tournament.js` hires, and a finding still puts an asterisk on
   the trophy.

   ---- THE FOUR JUDGES -------------------------------------------------

     HEAD JUDGE   `invariants.errors` on EVERY intermediate state
     FLOOR JUDGE  `judge.reduce`'s refusals — always a policy fault
                  (sparring.js's contract), never a player's
     SCOREKEEPER  `selfplay.FAULTS` over every feed line, plus stalls
     DECK CHECK   the WARN half of `invariants.check` (v4.39)

   ---- AND IT LOOKS FOR WHAT A WIN COUNT CANNOT SHOW -------------------

   Four observations per tie, each DERIVED from the timeline and each a
   shape this project has been bitten by:

     SILENT ACTIONS   a legal action that printed NOTHING. In a training
                      sim the feed IS the lesson (v3.60), so a play that
                      says nothing is a dead tap from the player's side.
                      Reported as the SET of action kinds rather than a
                      count, because `pass` and `paySel` are legitimately
                      silent and a raw number would drown the one that is
                      not (v4.17: a fault and a route mean opposite things).
     IDLE RUNS        consecutive rows with no feed, no life change, no
                      zone change — the livelock precursor behind v3.49's
                      stall count and v3.80's real draw.
     THE SWING        the largest single-row life change, and the row.
     TURN SHAPE       rows per turn. An outlier is a chain that ran long,
                      which is where the combat machinery is under load.
   ============================================================ */

const {play, W, DB, J, FAULTS, summaryLine} = require("./selfplay.js");
const B   = require("../engine/build.js");
const G   = require("../engine/game.js");
const RNG = require("../engine/rng.js");

const ARG  = process.argv.slice(2);
const flag = f => ARG.includes(f);
const opt  = (f, d) => { const i = ARG.indexOf(f); return i >= 0 ? ARG[i + 1] : d; };
const NAME = opt("--name", "Dawnblade Eight");
const FULL = flag("--full");
const ONLY = opt("--match", null);

const TTY = process.stdout.isTTY;
const C   = (c, s) => TTY ? `\x1b[${c}m${s}\x1b[0m` : s;
const B_  = s => C("1", s), DIM = s => C("2", s);
const RED = s => C("31", s), GRN = s => C("32", s), YEL = s => C("33", s);
const CYA = s => C("36", s), MAG = s => C("35", s);

/* ---- THE FIELD -------------------------------------------------------
   Sixteen entrants exist (fifteen heroes and the dummy, per
   tools/tournament.js's ruling). EIGHT of them turn up, and which eight
   is DRAWN from the event's own seeded stream rather than chosen — a
   hand-picked field is a claim about which heroes are interesting, and
   this instrument is not evidence for one. The draw replays from the
   event name, so a log can be reproduced exactly. */
const DUMMY = {key: null, name: "The Dummy", hp: 20, int: W.DUMMY_INT};
const ALL = W.HEROES.map(h => ({key: h.k, name: h.n, hero: h}))
                    .concat([{key: null, name: DUMMY.name}]);

function drawField(name){
  let rng = RNG.make(name + ":draw");
  const pool = ALL.slice(), out = [];
  while(out.length < 8){
    const r = RNG.int(rng, pool.length); rng = r.rng;
    out.push(pool.splice(r.v, 1)[0]);
  }
  return {field: out, rng};
}

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
  return J.newMatch({builds: [b0.b, b1.b], names: [e0.name, e1.name],
                     heroKeys: [e0.key, e1.key], rng, first: first || 0, tokSeq: ctr.n});
}

/* ---- THE BOOTH ------------------------------------------------------
   Both voices take ONE row and the row before it. Everything they say is
   read off those two objects; a fact neither carries is a fact neither
   voice gets to state. */

/* Which rows are worth calling. A derived predicate rather than a taste:
   a row that PRINTED something, MOVED a life total, FIRED a route, or was
   FLAGGED by a judge. Everything else is a pass or a selection. */
const called = (row, prev, flagged) =>
  row.lines.length > 0 || row.routes.length > 0 || flagged.has(row.i) ||
  (prev && (row.hp[0] !== prev.hp[0] || row.hp[1] !== prev.hp[1]));

/* TALLY — the action, its lines, and the life it left. */
function tally(row, prev, names){
  const bits = [];
  const dmg = prev ? [prev.hp[0] - row.hp[0], prev.hp[1] - row.hp[1]] : [0, 0];
  for(const line of row.lines) bits.push(line);
  if(dmg[0] > 0) bits.push(`${names[0]} down to ${row.hp[0]}.`);
  if(dmg[1] > 0) bits.push(`${names[1]} down to ${row.hp[1]}.`);
  if(dmg[0] < 0) bits.push(`${names[0]} up to ${row.hp[0]}.`);
  if(dmg[1] < 0) bits.push(`${names[1]} up to ${row.hp[1]}.`);
  if(!bits.length) bits.push(`${names[row.seat]} ${row.act}.`);
  return bits.join(" ");
}

/* LEDGER — the reasons, and only the ones the row carries.
   A route name is the engine's own event kind, so the gloss is a
   dictionary rather than a judgement about the card. */
const ROUTE_GLOSS = {
  crush:       "crush — four or more to a hero, and the rider comes with it",
  tap:         "that permanent is tapped now; it does not untap until their own untap step",
  ally:        "an ally is in this, and an attack on one cannot be blocked (CR 7.3.2a)",
  death:       "the ally is gone, and its life resets at end of turn either way (CR 4.4.3a)",
  gold:        "a Gold on the board — that is the treasure economy turning over",
  reaction:    "a reaction on the stack; the pump lives on the layer until it resolves",
  layer:       "the layer resolves and the bonus lands on the open link (CR 4.2.2)",
  hitwatch:    "a watcher fired on somebody ELSE's hit — the card was never the attack",
  hitnext:     "a grant that waits for a HIT rather than for the next attack declared",
  powctr:      "a +1{p} counter on a permanent, and a swing is what spends it",
  ctrWipe:     "the delayed wipe — every counter off, evaluated when the trigger fires",
  fusion:      "Fusion paid: a card was NAMED out of hand, and the cost is the information",
  leave:       "it left the arena and PAID for leaving, by whichever exit took it",
  ward:        "a ward permanent destroyed itself to soak — the number is the card",
  destroycost: "a destroy-as-a-cost sheet answered; declining is a real choice",
  jab:         "a second weapon jabbed in without being the attack",
  hood:        "cards back into the deck and SHUFFLED, then drawn — a re-randomisation",
  allyatk:     "an ALLY is swinging — it stays in the arena, and the ability's cost is what paid"
};

/* AN EXPLANATION IS NEWS ONCE. `said` is per TIE, so a structural gloss and
   a route's meaning are spoken the first time they are true and then drop
   out; what recurs is Tally's line, which is the event. Without it the
   booth prints "declaring is free and simultaneous" beside all forty
   declarations in a game and the one gloss that mattered is unreadable —
   a report nobody finishes is a report with no reader (v4.17's shape, in
   prose). The SWING and the EMPTY HAND are deliberately exempt: both are
   facts about THIS row rather than a rule, and both change. */
function ledger(row, prev, names, chainAt, said){
  const say = [];
  const once = (k, text) => { if(said.has(k)) return; said.add(k); say.push(text); };
  for(const r of row.routes) if(ROUTE_GLOSS[r]) once("r:" + r, ROUTE_GLOSS[r]);
  const swing = prev ? Math.abs((prev.hp[0] - row.hp[0])) + Math.abs((prev.hp[1] - row.hp[1])) : 0;
  if(swing >= 6) say.push(`${swing} life in one action — better than a quarter of a hero`);
  if(row.step === "defend" && row.act === "defend")
    once("declare", "declaring is free and simultaneous, and the TURN player holds priority here (CR 7.3.3)");
  if(row.act === "payConfirm")
    once("pitch", "pitched on demand, never banked — the pool clears at end of turn (CR 4.4.3e)");
  /* THE BIGGEST SWING IN A GAME LANDS ON A `pass`, AND THAT IS CR-CORRECT.
     Damage lands on ENTERING the damage step (CR 7.5) and the step is
     entered by both seats passing over the reaction window — so the action
     that spends the life is a pass, not the attack. Worth saying once,
     because a reader who sees "6 life on one action — pass" and is not
     told will read it as a bug in the log. */
  if(row.act === "pass" && swing > 0)
    once("passdmg", "the life moved on a PASS — damage lands on ENTERING the damage step "
                  + "(CR 7.5), and passing over the reaction window is what enters it");
  if(chainAt > 1) once("chain", `chain link ${chainAt} — the chain stays open and the attacker may keep going`);
  if(row.hand[row.seat] === 0 && prev && prev.hand[row.seat] > 0)
    say.push(`${names[row.seat]} is empty-handed now — nothing left to block with`);
  return say;
}

/* ---- OBSERVATIONS ---------------------------------------------------
   Each is a shape this project has paid for; all four are read off the
   timeline rather than asserted, because this is an instrument. */
function observe(tl){
  const silent = new Map(), idle = [];
  let run = 0, runAt = 0, swing = {n: -1, row: null}, byTurn = new Map();
  for(let i = 0; i < tl.length; i++){
    const row = tl[i], prev = i ? tl[i - 1] : null;
    if(!row.lines.length) silent.set(row.act, (silent.get(row.act) || 0) + 1);
    const moved = !prev || row.lines.length || row.hp[0] !== prev.hp[0] || row.hp[1] !== prev.hp[1]
               || row.hand[0] !== prev.hand[0] || row.hand[1] !== prev.hand[1]
               || row.deck[0] !== prev.deck[0] || row.deck[1] !== prev.deck[1];
    if(moved){ if(run >= 8) idle.push({at: runAt, len: run}); run = 0; }
    else { if(!run) runAt = row.i; run++; }
    const d = prev ? Math.abs(prev.hp[0] - row.hp[0]) + Math.abs(prev.hp[1] - row.hp[1]) : 0;
    if(d > swing.n) swing = {n: d, row};
    byTurn.set(row.turn, (byTurn.get(row.turn) || 0) + 1);
  }
  if(run >= 8) idle.push({at: runAt, len: run});
  const turns = [...byTurn.entries()].sort((a, b) => b[1] - a[1]);
  return {silent, idle, swing, turns};
}

/* ---- ONE TIE --------------------------------------------------------
   Bo1, so the LEG is the tie and the chair is the whole of the draw's
   contribution. Drawn from the event's stream and stated, never hidden. */
const BOOK = {viols: [], warns: [], refusals: [],
              faults: Object.fromEntries(FAULTS.map(k => [k, []])),
              stalls: 0, games: 0, routes: {}, ties: []};

function tie(e0, e1, round, idx, first, seed){
  const g = game(e0, e1, seed, first);
  const opening = [0, 1].map(s => g.sides[s].hand.map(c => c.name));
  const where = `${round} m${idx}`;
  let r;
  try { r = play(g, 4000, {timeline: true}); }
  catch(err){
    BOOK.faults.MALFORMED.push({where, seed, throw: err.message});
    return {e0, e1, round, idx, first, seed, threw: err.message};
  }
  BOOK.games++;
  for(const v of r.viols) BOOK.viols.push({where, seed, ...v});
  for(const v of r.warns) BOOK.warns.push({where, seed, ...v});
  for(const e of r.errs)  BOOK.refusals.push({where, seed, ...e});
  for(const [k, line] of r.events){
    BOOK.routes[k] = (BOOK.routes[k] || 0) + 1;
    if(BOOK.faults[k]) BOOK.faults[k].push({where, seed, line});
  }
  if(!r.game.over) BOOK.stalls++;

  const over = r.game.over;
  const t = {e0, e1, round, idx, first, seed, opening,
             winner: over ? (over.winner === 0 ? e0 : e1) : null,
             how: over ? over.how : "no result — step limit reached",
             hp: r.game.sides.map(s => s.hp), turns: r.game.turn,
             steps: r.steps, tl: r.timeline, end: r.game,
             obs: observe(r.timeline),
             viols: r.viols, warns: r.warns, errs: r.errs};
  BOOK.ties.push(t);
  return t;
}

module.exports = {tally, ledger, called, observe, drawField, ROUTE_GLOSS};
if(require.main !== module) return;

/* ---- THE EVENT ------------------------------------------------------ */
const {field} = drawField(NAME);
let rng = RNG.make(NAME + ":chairs");
const chair = () => { const r = RNG.int(rng, 2); rng = r.rng; return r.v; };

const line = s => console.log(s);
line("");
line(B_(`  ${NAME.toUpperCase()} — EIGHT SEATS, BEST OF ONE`));
line(DIM(`  one game a round · 7 ties · the draw and every chair replay from the event name`));
line("");
line(B_("  THE DRAW"));
for(let i = 0; i < 8; i += 2)
  line(`    ${DIM("m" + (i / 2 + 1))}  ${field[i].name}  ${DIM("v")}  ${field[i + 1].name}`);
line("");
line(DIM("  BEST OF ONE IS A TEST OF VARIANCE, NOT OF DECKS. A 92% favourite in this"));
line(DIM("  pool loses a single game about once in twelve, and the chair is worth about"));
line(DIM("  2:1 in a close matchup — so the draw is a real share of what follows."));
line(DIM("  `npm run cup` is the sixteen-seat event with an earned seeding and"));
line(DIM("  escalating formats, and that is the one to read for a matchup."));
line("");

function report(t){
  const n = [t.e0.name, t.e1.name];
  line("");
  line(B_("  " + "─".repeat(72)));
  line(B_(`  ${t.round.toUpperCase()} · MATCH ${t.idx} — ${n[0]} v ${n[1]}`));
  line(DIM(`  seed ${t.seed} · ${n[t.first]} elected first (drawn)`));
  line("");
  line(`  ${CYA("BOOTH")}  play-by-play ${B_("Tally")} — the action, its lines, the life it left`);
  line(`         colour       ${B_("Ledger")} — the reasons, off the engine's own records`);
  line("");
  line(`  ${MAG("SEAT SHEET")}  opening hands, as dealt`);
  for(const s of [0, 1])
    line(`    ${n[s]}${DIM(s === t.first ? " (first)" : "")}: ${t.opening[s].join(" · ")}`);
  line("");

  if(t.threw){ line(RED(`  THE GAME THREW: ${t.threw}`)); return; }

  const flagged = new Set([...t.viols, ...t.warns, ...t.errs]
                          .map(v => v.i).filter(i => i != null));
  let chainAt = 0, spoken = 0;
  const said = new Set();
  for(let i = 0; i < t.tl.length; i++){
    const row = t.tl[i], prev = i ? t.tl[i - 1] : null;
    if(/on the chain/.test(row.lines.join(" "))) chainAt++;
    if(/— End phase —|Chain closes/.test(row.lines.join(" "))) chainAt = 0;
    if(!called(row, prev, flagged) && !FULL) continue;
    spoken++;
    if(FULL) line(DIM(`    [${row.i}] t${row.turn} ${row.phase}/${row.step} `
                    + `${n[row.seat]}:${row.act} hp ${row.hp.join("-")}`));
    line(`    ${DIM("t" + row.turn)} ${CYA("Tally")}  ${tally(row, prev, n)}`);
    for(const c of ledger(row, prev, n, chainAt, said))
      line(`         ${YEL("Ledger")} ${c}`);
  }

  line("");
  /* LIFE IS PRINTED "a v b", NEVER JOINED ON A DASH. Overkill is ordinary —
     a hero can finish on -4 — and `[-4, 4].join("-")` renders "-4-4", which
     a reader parses as 4 against 4 with a stray sign. A display that can be
     read two ways is the sev-2 category (the player trusts the number). */
  const lifeOf = t => `${t.hp[0]} v ${t.hp[1]}`;
  line(`  ${B_("RESULT")}  ` + (t.winner
    ? `${GRN(t.winner.name)} — ${t.how} · life ${lifeOf(t)} · turn ${t.turns}`
    : RED(`NO RESULT — ${t.how} · life ${lifeOf(t)} · turn ${t.turns}`)));
  line(DIM(`         ${t.steps} actions, ${spoken} called`));
  line("");
  line(`  ${B_("THE JUDGES")}`);
  line(`    HEAD JUDGE   ${t.viols.length ? RED(t.viols.length + " violation(s)") : GRN("clean")}`
     + DIM(`  — invariants.errors on every intermediate state`));
  line(`    FLOOR JUDGE  ${t.errs.length ? RED(t.errs.length + " refusal(s)") : GRN("clean")}`
     + DIM("  — a refusal is a policy fault, never a player's"));
  line(`    DECK CHECK   ${t.warns.length ? YEL(t.warns.length + " warning(s)") : GRN("clean")}`
     + DIM("  — the WARN half nothing else reads"));
  for(const v of t.viols.slice(0, 5)) line(RED(`      ! ${v.code} ${v.msg} (t${v.turn} after ${v.after})`));
  for(const v of t.warns.slice(0, 5)) line(YEL(`      ~ ${v.code} ${v.msg} (t${v.turn} after ${v.after})`));
  for(const e of t.errs.slice(0, 5))  line(RED(`      ! refused ${e.t} seat ${e.seat}: ${e.why} (t${e.turn})`));

  const o = t.obs;
  line("");
  line(`  ${B_("UNDER LOAD")}`);
  line(`    SWING        ${o.swing.n} life on one action`
     + DIM(o.swing.row ? ` — [${o.swing.row.i}] t${o.swing.row.turn} ${o.swing.row.act}` : ""));
  line(`    TURN SHAPE   longest turn ${o.turns[0][1]} actions (t${o.turns[0][0]})`
     + DIM(` · ${o.turns.length} turns, ${(t.steps / o.turns.length).toFixed(1)} actions each`));
  line(`    SILENT       ` + ([...o.silent.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`).join(" · ") || "none"));
  line(`    IDLE RUNS    ` + (o.idle.length
        ? YEL(o.idle.map(r => `${r.len} rows from [${r.at}]`).join(" · "))
        : GRN("none ≥ 8")));
}

/* Quarters, semis, final — one game each. */
const rounds = [["quarter-final", 4], ["semi-final", 2], ["final", 1]];
let alive = field.slice(), all = [];
for(const [name, count] of rounds){
  const next = [];
  for(let i = 0; i < count; i++){
    const a = alive[i * 2], b = alive[i * 2 + 1];
    const first = chair();
    const t = tie(a, b, name, i + 1, first, `${NAME}|${name}|${i + 1}`);
    all.push(t);
    next.push(t.winner || a);   /* a drawn Bo1 advances the upper entrant, stated below */
  }
  alive = next;
}

for(const t of all) if(!ONLY || String(t.idx) === ONLY || t.round === "final") report(t);

/* ---- THE EVENT'S OWN SHEET ------------------------------------------ */
const faults = BOOK.faults;
line("");
line(B_("  " + "═".repeat(72)));
line(B_(`  ${NAME.toUpperCase()} — CHAMPION: ${alive[0] ? GRN(alive[0].name) : "none"}`));
const findings = BOOK.viols.length + BOOK.refusals.length
               + FAULTS.reduce((a, k) => a + faults[k].length, 0);
line(findings
  ? RED(`  * ASTERISKED — the judges found ${findings} thing(s); a trophy over a broken board is not one to trust`)
  : GRN("  clean sheet — no violation, no refusal, no malformed line in any of the seven"));
line("");
line("  " + summaryLine(BOOK.refusals, BOOK.viols, faults)
   + ` · STALLS ${BOOK.stalls} · WARN ${BOOK.warns.length}`);
line("");
line(B_("  THE SEVEN"));
for(const t of all)
  line(`    ${DIM(t.round.padEnd(13))} ${t.e0.name} v ${t.e1.name}`
     + `  →  ${t.winner ? GRN(t.winner.name) : RED("no result")}`
     + DIM(`  ${t.hp[0]} v ${t.hp[1]} · t${t.turns} · ${t.steps} actions`));
line("");
line(B_("  ROUTE COVERAGE") + DIM("  (a number here means a FEATURE FIRED)"));
const rk = Object.keys(BOOK.routes).filter(k => !FAULTS.includes(k)).sort();
line("    " + (rk.map(k => `${k} ${BOOK.routes[k]}`).join(" · ") || "none"));
const cold = Object.keys(ROUTE_GLOSS).filter(k => !BOOK.routes[k]).sort();
line(DIM("    never fired in these seven: " + (cold.join(" · ") || "none")));
line("");
line(DIM("  A DRAWN Bo1 ADVANCES THE UPPER ENTRANT. That is a tournament ruling and"));
line(DIM("  not a game rule — CR 4.5.3 has three ways to lose and an empty deck is"));
line(DIM("  not one, so a genuinely unwinnable board exists and a Bo1 cannot replay"));
line(DIM("  it. `npm run cup` decides its ties on life remaining across legs instead."));
line("");
