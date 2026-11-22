#!/usr/bin/env node
/* ============================================================
   tools/chaos.js — THE TABLE, PLAYED BADLY ON PURPOSE (v6.66)

   Self-play (tools/selfplay.js) measures the rule policy, and the rule
   policy only ever makes the plays it was taught. v6.64 and v6.65 found
   two engine bugs a PERSON could reach and the policy never did (a
   Frostbite made while a play waited taxed it; a held play re-read its
   price): "the rule policy never did it; a person or Sharp could." This
   driver plays like a person who taps everything: at each decision, with
   probability EPS, the seat takes a uniformly random action out of every
   action `judge.legal` accepts (plays, activations, holds, passes, odd
   pitches, cancelled payments, declined costs, every prompt answer), and
   otherwise the rule policy's.

   WHAT IT REPORTS, AND WHAT EACH MEANS
     JUDGE-DISAGREE   `legal` said yes and `reduce` refused: the two halves
                      of the referee disagree — a peer sends what the
                      sequencer refuses. ALWAYS an engine bug.
     THREW            `legal` or `reduce` threw. ALWAYS a bug.
     VIOLATIONS       invariants.js errors on an intermediate state.
     NO-ZONE          a card left every zone (selfplay's census).
     policy refusals  the rule policy, asked in a state chaos made, proposed
                      something illegal — a POLICY bug, lower priority (the
                      policy may never meet that state with a person either,
                      but Sharp's lookahead does).
   Stalls are EXPECTED here (a random seat can cancel payments forever) and
   are reported but not counted as findings.

   Deterministic: the chaos RNG is its own (rng.js, seeded per game), never
   `game.rng`. A finding replays with the same arguments.

       node tools/chaos.js                  # every hero vs every hero, 1 seed, EPS 0.25
       node tools/chaos.js viserai '' 2     # Viserai against everyone, 2 seeds
       EPS=0.5 node tools/chaos.js kayo,gravy iyslander 3
   ============================================================ */
const {match, play, W, J, SP} = require("./selfplay.js");
const RNG = require("../engine/rng.js");
const WR = require("../engine/wire.js");
const V = require("../engine/view.js");

const EPS = process.env.EPS ? +process.env.EPS : 0.25;
const LIMIT = +(process.env.LIMIT || 3000);
/* every Nth chaos move also asks Sharp (the page's AI) for its move from the
   chaotic state; 0 turns it off. Sharp is the expensive half of a run. */
const SHARP = +(process.env.SHARP == null ? 25 : process.env.SHARP);

/* THE OTHER SURFACES A CHAOTIC STATE REACHES (v6.66, second pass). A table's
   two peers each hold a DECODED copy and replay the same action, so:
     WIRE-ROUNDTRIP  encode -> JSON -> decode throws on this state;
     WIRE-REPLAY     the action replayed on the decoded copy lands on a
                     different state (hash) than on the original — the
                     two phones diverge;
     VIEW-THREW      `view(g, seat)` (what each seat may see) throws;
     SHARP-REFUSAL   Sharp's search proposes an illegal action (a POLICY
                     finding, counted with the rule policy's refusals). */
function surfaces(g, a, seat, tally, sharp){
  let dec;
  try { dec = WR.decode(JSON.parse(JSON.stringify(WR.encode(g)))); }
  catch(e){ tally.find("WIRE-ROUNDTRIP", e.message, g); return; }
  try {
    const x = J.reduce(g, a, seat), y = J.reduce(dec, a, seat);
    if(!x.error && !y.error && WR.hash(x.state) !== WR.hash(y.state)){
      const d = WR.diffPaths(x.state, y.state, 3);
      tally.find("WIRE-REPLAY", a.t + " diverges at " + JSON.stringify(d), g);
    } else if(!!x.error !== !!y.error) tally.find("WIRE-REPLAY", a.t + " legal on one copy only: " + (x.error || y.error), g);
  } catch(e){ tally.find("THREW", "replay " + a.t + ": " + e.message, g); }
  for(const s of [0, 1]){
    try { V.view(g, s); } catch(e){ tally.find("VIEW-THREW", e.message, g); }
  }
  if(sharp){
    try {
      const b = SP.act(g, seat, {search: true});
      if(b){ const why = J.legal(g, b, seat); if(why !== null) tally.find("SHARP-REFUSAL", b.t + " — " + why, g); }
    } catch(e){ tally.find("THREW", "sharp: " + e.message, g); }
  }
}

/* Every action worth trying for this seat now, before `legal` filters. */
function candidates(g, seat){
  const sd = g.sides[seat] || {}, out = [...J.moves(g, seat)];
  const add = a => out.push(a);
  ["pass", "endTurn", "payConfirm", "payCancel", "promptConfirm", "promptDecline", "promptTakeBack"].forEach(t => add({t}));
  (sd.hand || []).forEach(c => c && (add({t: "paySel", uid: c.uid}), add({t: "arsenal", uid: c.uid})));
  add({t: "arsenal", uid: null});
  const p = J.pendingOf(g);
  if(p){
    const uids = [...(p.uids || []), null];
    for(const t of ["fuse", "charge", "discost", "soulcost", "boardcost", "usurp", "bancost", "abtarget"])
      uids.forEach(uid => add({t, uid}));
    [true, false].forEach(yes => (add({t: "boost", yes}), add({t: "addPay", yes})));
    [0, 1, 2].forEach(half => add({t: "split", half}));
    for(let x = 0; x <= 6; x++) add({t: "xval", x});
  }
  const pr = g.prompt;
  if(pr){
    const k = Math.max((pr.cards || []).length, (pr.options || []).length, 1);
    for(let i = 0; i < k; i++){
      add({t: "promptSel", i}); add({t: "promptChoose", choice: i});
      add({t: "promptMove", i, dir: -1}); add({t: "promptMove", i, dir: 1});
    }
    add({t: "promptChoose", choice: "pay"}); add({t: "promptChoose", choice: "decline"});
  }
  /* an attack may name a target (CR 1.4.5): try the hero and each ally */
  const foe = g.sides[1 - seat] || {};
  for(const a of out.slice()) if(a.t === "play" || a.t === "activate"){
    add({...a, target: "hero"});
    (foe.board || []).forEach(b => b && add({...a, target: b.uid}));
  }
  return out;
}

function chaosActor(seed, tally){
  let rng = RNG.make(seed);
  return (g, seat) => {
    const r = RNG.next(rng); rng = r.rng;
    if(r.v >= EPS){
      /* the rule policy, unless chaos left it a state it cannot answer: a
         refusal is tallied and the seat plays a random legal move instead,
         so one stuck seat does not end the game as a stall */
      const a = SP.act(g, seat);
      if(!a) return a;
      let why; try { why = J.legal(g, a, seat); } catch(e){ why = "threw: " + e.message; }
      if(why === null) return a;
      tally.find("policy-refusal", a.t + " — " + why, g);
    }
    const ok = [];
    for(const a of candidates(g, seat)){
      let why;
      try { why = J.legal(g, a, seat); }
      catch(e){ tally.find("THREW", "legal " + a.t + ": " + e.message, g); continue; }
      if(why === null) ok.push(a);
    }
    if(!ok.length){ const a = SP.act(g, seat); return a && J.legal(g, a, seat) === null ? a : null; }
    const pick = RNG.int(rng, ok.length); rng = pick.rng;
    const a = ok[pick.v];
    /* `legal` said yes: `reduce` must agree, and must not throw */
    try {
      const out = J.reduce(g, a, seat);
      if(out.error) tally.find("JUDGE-DISAGREE", a.t + " " + JSON.stringify(a) + " — " + out.error, g);
    } catch(e){ tally.find("THREW", "reduce " + a.t + ": " + e.message, g); return SP.act(g, seat); }
    tally.chaos++;
    surfaces(g, a, seat, tally, SHARP > 0 && tally.chaos % SHARP === 0);
    return a;
  };
}

function main(){
  const [heroArg, foeArg, seedArg] = process.argv.slice(2);
  const all = W.HEROES.map(h => h.k);
  const heroes = heroArg ? heroArg.split(",") : all;
  const foes = foeArg ? foeArg.split(",") : all;
  const seeds = +seedArg || 1;
  const finds = new Map(), stats = {games: 0, chaos: 0, stalls: 0, refusals: 0, viols: 0, nozone: 0};
  const tally = {
    chaos: 0,
    find(kind, msg, g){
      const key = kind + " " + msg.replace(/#?\b[a-z]*\d+\b/g, "#");
      if(!finds.has(key)) finds.set(key, {kind, msg, n: 0, at: tally.where + " t" + (g && g.turn)});
      finds.get(key).n++;
    }
  };
  for(let s = 0; s < seeds; s++) for(const a of heroes) for(const b of foes){
    if(a === b && heroArg && !foeArg) continue;
    const seed = `chaos-${a}-${b}-${s}`;
    tally.where = seed;
    const g = match(a, b, seed, s % 2);
    const r = play(g, LIMIT, {act: chaosActor(seed + "-x", tally)});
    stats.games++;
    if(r.verdict === "STALL") stats.stalls++;
    stats.refusals += r.errs.length;
    for(const e of r.errs) tally.find("policy-refusal", e.t + " — " + e.why, r.game);
    for(const v of r.viols){ stats.viols++; tally.find("VIOLATION", v.code + " " + (v.msg || "") + " after " + v.after, r.game); }
    for(const [k, m] of r.events) if(k === "NO-ZONE"){ stats.nozone++; tally.find("NO-ZONE", m, r.game); }
  }
  stats.chaos = tally.chaos;
  console.log(`CHAOS — ${stats.games} games, EPS ${EPS}, ${stats.chaos} random legal moves`);
  console.log(`  violations ${stats.viols} · no-zone ${stats.nozone} · policy refusals ${stats.refusals} · stalls ${stats.stalls} (expected)`);
  const POLICY = k => k === "policy-refusal" || k === "SHARP-REFUSAL";   /* the AI's, not the referee's */
  const rows = [...finds.values()].sort((x, y) => POLICY(x.kind) - POLICY(y.kind) || y.n - x.n);
  for(const f of rows) console.log(`  ${String(f.n).padStart(4)}  ${f.kind.padEnd(15)} ${f.msg.slice(0, 160)}   [first: ${f.at}]`);
  const engine = rows.filter(f => !POLICY(f.kind)).length, policy = rows.length - engine;
  console.log(`ENGINE FINDINGS: ${engine} · POLICY FINDINGS: ${policy}`);
  process.exitCode = engine || policy ? 1 : 0;
}

if(require.main === module) main();
module.exports = {candidates, chaosActor};
