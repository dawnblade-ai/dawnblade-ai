/* tools/hidden-spike.js — HIDDEN HANDS spike (HIDDEN-HANDS.md §5).
   Self-play (rule policy, both seats, through judge.reduce). At every step,
   for the ACTOR and for the OBSERVER, ask whether that seat could have
   computed the step from its own `view` (engine/view.js) plus reveals:

     POLICY  the actor's rule policy run on its view proposes the same action
     LEGAL   judge.legal accepts the action on the actor's view
     STEP    reduce(view + the reveals the action itself names) and view the
             result; equal to the view of the real result means NO further
             reveal was needed. A difference is a RESOLUTION REVEAL, and its
             paths say what the seat must be sent.
     FEED    a shared feed line names a card the seat may not see.

   Measuring instrument, not a drill.
       node tools/hidden-spike.js [games=30] [seed=hh]  [--ex] */
const S  = require("./selfplay.js");
const V  = require("../engine/view.js");
const Wr = require("../engine/wire.js");
const {J, SP, W} = S;

const N = +(process.argv[2] || 30), SEED = process.argv[3] || "hh", EX = process.argv.includes("--ex");
const SKIP = new Set([...["log", "feed", "inspect", "boostOn", "_unmapped", "img", "dbImg", "prs"], "still", "viewSeat"]);
const heroes = W.HEROES.filter(h => W.DECKS[h.k]).map(h => h.k);
const scalars = (v, out) => { if(Array.isArray(v)) v.forEach(x => scalars(x, out));
  else if(v && typeof v === "object") Object.values(v).forEach(x => scalars(x, out));
  else if(v != null) out.push(String(v)); return out; };
const canonPath = (p, v, s) => p.replace(/^\//, "").replace(/\/#length.*/, "").replace(/^sides\/(\d)\/([a-zA-Z]+).*/, (m, o, z) =>
  "sides/" + (+o === v ? "SELF" : "FOE") + "/" + z).replace(/^(prompt|promptQ|pending|pend|chain|stack)\b.*/, "$1")
  .replace(/^revealed.*/, "revealed").replace(/^lastRoll.*/, "lastRoll");
const T = {steps: 0, games: 0, polOk: 0, polBad: 0, polErr: 0, legalBad: 0,
  stepOk: [0, 0], stepRev: [0, 0], stepErr: [0, 0], actRev: {}, pat: {}, ex: {}, feedLeak: 0, feedEx: [], polEx: [], legalEx: []};
const bump = (o, k, ex) => { o[k] = (o[k] || 0) + 1; if(ex && (!T.ex[k] || T.ex[k].length < 3)) (T.ex[k] = T.ex[k] || []).push(ex); };
const nameOf = (g, uid) => { for(const sd of g.sides) for(const z of ["hand", "deck", "arsenal", "grave", "banish", "pitch", "soul", "gear", "intimidated"]){
  const arr = z === "arsenal" ? [sd.arsenal] : (sd[z] || []); for(const c of arr) if(c && String(c.uid) === uid) return c.name; } return "?"; };

let gi = 0;
outer: for(let i = 0; i < heroes.length; i++) for(let j = 0; j < heroes.length; j++){
  if(i === j) continue;
  if(gi++ % Math.max(1, Math.floor(heroes.length * (heroes.length - 1) / N)) !== 0) continue;
  if(T.games >= N) break outer;
  let g = S.match(heroes[i], heroes[j], SEED + gi, gi % 2); T.games++;
  for(let k = 0; k < 3000 && !g.over; k++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(g, s, {search: false});
      if(!a) continue;
      const out = J.reduce(g, a, s);
      if(out.error) continue;
      const n = out.state; T.steps++; moved = true;
      /* POLICY + LEGAL, actor's own view */
      const vs = V.view(g, s);
      try { const b = SP.act(vs, s, {search: false});
        if(JSON.stringify(b) === JSON.stringify(a)) T.polOk++;
        else { T.polBad++; if(T.polEx.length < 8) T.polEx.push(`${g.sides[s].heroKey} t${g.turn}: real ${JSON.stringify(a)} view ${JSON.stringify(b)}`); } }
      catch(e){ T.polErr++; if(T.polEx.length < 8) T.polEx.push("THROW " + e.message.slice(0, 80)); }
      const why = J.legal(vs, a, s);
      if(why){ T.legalBad++; if(T.legalEx.length < 8) T.legalEx.push(`${a.t} ${nameOf(g, String(a.uid))}: ${why}`); }
      /* STEP, both seats */
      for(const v of [0, 1]){
        const hid = V.hiddenUids(g, v);
        let vg = V.view(g, v);
        if(process.env.HHRNG === "real") vg = {...vg, rng: g.rng};
        for(const x of new Set(scalars(a, []))) if(hid.has(x)){ const r = hid.get(x);
          vg = V.reveal(vg, r); bump(T.actRev, (v === s ? "actor " : "observer ") + a.t + " <- " + (r.owner === v ? "own " : "foe ") + r.zone); }
        let x;
        try { x = J.reduce(vg, a, s); } catch(e){ x = {error: "THROW " + e.message.slice(0, 60)}; }
        if(x.error){ T.stepErr[v]++; bump(T.pat, (v === s ? "ACTOR  " : "OBSRVR ") + "REFUSED ON VIEW: " + (/cannot raise it|short|cannot pay|afford/.test(x.error) ? "affordability (needs the hidden hand's pitch)" : x.error.replace(/\d+/g, "N").slice(0, 70)), `${g.sides[s].heroKey} ${a.t} ${nameOf(g, String(a.uid))}`); continue; }
        const d = Wr.diffPaths(V.view(x.state, v), V.view(n, v), 12, SKIP);
        if(!d.length){ T.stepOk[v]++; continue; }
        if(process.env.HHDBG && (process.env.HHDBG === "obs" ? v !== s : v === s) && !T._dbg && (!process.env.HHPAT || d.some(p => p.indexOf(process.env.HHPAT) >= 0))){ T._dbg = 1; const A = V.view(x.state, v), B = V.view(n, v);
          console.log("DBG", a, "actor", s, "obs", v, "turn", g.turn, "phase", g.phase, g.step, "tp", g.turnPlayer, d.slice(0, 2));
          console.log("  real hand of obs before/after:", g.sides[v].hand.map(c => c.uid + c.name).join(","), "||", n.sides[v].hand.map(c => c.uid + c.name).join(","));
          console.log("  feed:", (n.feed || []).slice((g.feed || []).length).map(l => JSON.stringify(l).slice(0, 120)).join(" / ")); const get = (o, p) => p.split("/").filter(Boolean).reduce((q, k) => q && q[k], o);
          d.slice(0, 3).forEach(p => console.log("  ", p, JSON.stringify(get(A, p)).slice(0, 120), "|", JSON.stringify(get(B, p)).slice(0, 120))); }
        T.stepRev[v]++;
        const pats = [...new Set(d.map(p => canonPath(p, v, s)))].sort().join(" + ");
        bump(T.pat, (v === s ? "ACTOR  " : "OBSRVR ") + pats, `${g.sides[s].heroKey} ${a.t} ${a.from || ""} ${nameOf(g, String(a.uid))} t${g.turn}`);
      }
      /* FEED: new shared lines that name a card hidden from a seat and seen nowhere public */
      const fresh = (n.feed || []).slice((g.feed || []).length).map(l => typeof l === "string" ? l : JSON.stringify(l));
      for(const v of [0, 1]){
        const vn = V.view(n, v), pub = new Set(scalars({...vn, feed: [], log: [], sides: vn.sides.map(sd => ({...sd, deck: []}))}, []));
        const secret = [...V.hiddenUids(n, v).values()].map(r => r.card.name).filter(nm => nm && !pub.has(nm));
        for(const line of fresh) for(const nm of new Set(secret)) if(line.indexOf(nm) >= 0){
          T.feedLeak++; if(T.feedEx.length < 6) T.feedEx.push(`seat ${v} reads: ${line.slice(0, 110)}`); }
      }
      g = n; break;
    }
    if(!moved) break;
  }
}
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + "%";
console.log(`games ${T.games}  steps ${T.steps}`);
console.log(`POLICY from own view: same ${T.polOk} (${pct(T.polOk, T.steps)}), different ${T.polBad}, threw ${T.polErr}`);
console.log(`LEGAL on own view: refused ${T.legalBad}`);
for(const v of [0, 1]) console.log(`STEP seat ${v}: from view ${T.stepOk[v]}, needs a resolution reveal ${T.stepRev[v]}, refused/threw ${T.stepErr[v]}`);
console.log(`FEED lines naming a card hidden from a reader: ${T.feedLeak}`);
console.log("\nACTION-CARRIED reveals (the action itself names a hidden card):");
Object.entries(T.actRev).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(String(n).padStart(7), k));
console.log("\nRESOLUTION reveals / refusals, by what differed:");
Object.entries(T.pat).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => { console.log(String(n).padStart(7), k); if(EX) (T.ex[k] || []).forEach(e => console.log("          e.g.", e)); });
if(EX){ console.log("\npolicy:", T.polEx.join("\n  ")); console.log("legal:", T.legalEx.join("\n  ")); console.log("feed:", T.feedEx.join("\n  ")); }
