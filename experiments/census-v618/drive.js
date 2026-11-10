/* Drive one census game to its first flag of a kind and show the decision and what followed.
     node drive.js <flag> <a> <b> <seed> <first> <hero> */
const R = "/home/user/dawnblade-ai";
const {match, SP, J} = require(R + "/tools/selfplay.js");
const P = require(R + "/engine/priority.js");
const [flag, a, b, seed, first, hero] = process.argv.slice(2);
const num = (c, f) => (c && +c[f]) || 0;
let n = match(a, b, seed, +first);
const hs = a === hero ? 0 : 1;
const nm = (sd, u) => { const c = (sd.hand || []).concat(sd.gear || [], sd.arsenal ? [sd.arsenal] : []).find(x => x && x.uid === u) || ((sd.board || []).find(x => x && x.uid === u) || {}).card; return c ? c.name + (c.def != null ? "/d" + c.def : "") + (c.cost != null ? "/c" + c.cost : "") : String(u); };
let hit = null, feed0 = 0;
for(let i = 0; i < 6000 && !n.over; i++){
  let moved = false;
  for(const s of [0, 1]){
    const a0 = SP.act(n, s, {search: s === hs});
    if(!a0) continue;
    const me = n.sides[hs];
    if(!hit && s === hs){
      let on = false;
      if(flag === "lethalUnblocked" && P.canDeclareDefenders(n, hs) && n.pend && (n.pend.total || 0) - SP.wallOf(me) >= me.hp && a0.t !== "defend")
        on = (me.hand || []).some(c => num(c, "def") > 0 && (me.blockH || []).indexOf(c.uid) < 0 && J.legal(n, {t: "defend", uid: c.uid}, hs) == null);
      if(flag === "resFizzle+ability" && a0.t === "endTurn" && (me.res || 0) > 0) on = SP.laCands(n, hs, null).some(x => x.t === "activate");
      if(flag === "resFizzle+play" && a0.t === "endTurn" && (me.res || 0) > 0) on = !SP.laCands(n, hs, null).some(x => x.t === "activate") && SP.laCands(n, hs, null).some(x => x.t === "play");
      if(flag === "endTurnWithAttack" && a0.t === "endTurn" && (me.ap || 0) > 0)
        on = SP.laCands(n, hs, null).some(x => x.t === "play" && num(me.hand.concat(me.arsenal ? [me.arsenal] : []).find(c => c && c.uid === x.uid), "power") > 0);
      if(on){
        hit = true; feed0 = (n.feed || []).length;
        const e = SP.explain(n, hs, {search: true});
        console.log("== " + flag + " at turn " + n.turn + ", hero " + hero + " (seat " + hs + ") hp " + me.hp + " res " + me.res + " ap " + me.ap);
        console.log("hand:", me.hand.map(c => c.name + "/d" + num(c, "def") + "/c" + num(c, "cost") + "/p" + num(c, "pitch") + "/pw" + num(c, "power")).join(", "));
        console.log("arsenal:", me.arsenal ? me.arsenal.name : "-", "· blockH:", (me.blockH || []).map(u => nm(me, u)), "· blockG:", (me.blockG || []).map(u => nm(me, u)));
        if(n.pend) console.log("incoming:", n.pend.card && n.pend.card.name, "total", n.pend.total, "by seat", n.pend.by, "wall", SP.wallOf(me));
        console.log("Sharp chose:", JSON.stringify(a0), "key", e.key, "why", e.why);
        console.log("Steady would:", JSON.stringify(SP.act(n, hs, {search: false})));
        console.log("alternatives:", SP.laCands(n, hs, null).map(x => x.t + ":" + nm(me, x.uid)).join(" | "));
        if(flag === "resFizzle+ability") for(const x of SP.laCands(n, hs, null).filter(x => x.t === "activate")){
          const out = J.reduce(n, x, hs); console.log("  try " + nm(me, x.uid) + ":", out.error || ("res " + me.res + " -> " + out.state.sides[hs].res + ", feed: " + (out.state.feed || []).slice((n.feed || []).length).join(" / ")));
        }
      }
    }
    const r = J.reduce(n, a0, s);
    if(r.error) continue;
    n = r.state; moved = true; break;
  }
  if(!moved) break;
  if(hit && hit !== "done" && (n.feed || []).length > feed0 + 12){ console.log("next lines:\n  " + n.feed.slice(feed0, feed0 + 12).join("\n  ")); hit = "done"; }
}
console.log("result:", JSON.stringify(n.over), "hero hp", n.sides[hs].hp, "turn", n.turn);
