/* Misplay census: hero seat on Sharp, opponents on the rule policy, 84 games per hero
   (14 opponents x 2 seat orders x 3 seeds). Flags are read off the state before each
   hero action (and at link close / game end), never off feed prose.
     node census.js <hero[,hero...]>   -> one JSON line per hero */
const R = "/home/user/dawnblade-ai";
const {match, W, SP, J} = require(R + "/tools/selfplay.js");
const P = require(R + "/engine/priority.js");
const HEROES = W.HEROES.map(h => h.k);
const RULE = process.argv[3] === "rule";
const num = (c, f) => (c && +c[f]) || 0;
const wallNow = sd => SP.wallOf(sd) + (sd.blockRx || []).reduce((t, l) => t + ((l && l.def) || 0), 0);

function game(a, b, seed, first, hero){
  let n = match(a, b, seed, first);
  const hs = a === hero ? 0 : 1;
  const F = {};
  const ex = {};
  const flag = (k, note) => { F[k] = (F[k] || 0) + 1; if(!ex[k]) ex[k] = {seed, a, b, first, turn: n.turn, note}; };
  let lastLink = null, pendingLethal = null;
  for(let i = 0; i < 6000 && !n.over; i++){
    /* LINK CLOSE: the hero defended a link and the wall overshot by a whole card */
    const sd = n.sides[hs];
    if(n.pend && n.pend.by === 1 - hs) lastLink = {total: n.pend.total || 0, wall: wallNow(sd), hand: (sd.blockH || []).map(u => num(sd.hand.find(c => c && c.uid === u), "def")).filter(x => x > 0), rx: (sd.blockRx || []).map(l => (l && l.def) || 0)};
    else if(lastLink && !n.pend){
      const ex0 = lastLink.wall - lastLink.total;
      const minCard = Math.min(...lastLink.hand.concat(lastLink.rx), Infinity);
      if(lastLink.hand.length + lastLink.rx.length && ex0 >= minCard) flag("wallOvershoot", `wall ${lastLink.wall} vs ${lastLink.total}, cards ${lastLink.hand.concat(lastLink.rx)}`);
      lastLink = null;
    }
    let moved = false;
    for(const s of [0, 1]){
      const a0 = SP.act(n, s, {search: s === hs && !RULE});
      if(!a0) continue;
      if(s === hs){
        const me = n.sides[hs];
        /* a play or ability that lands nothing */
        if((a0.t === "play" || a0.t === "activate") && a0.uid != null && a0.uid !== "hpow"){
          const from = a0.from || ((me.gear || []).some(x => x && x.uid === a0.uid) ? "gear" : (me.board || []).some(x => x && x.uid === a0.uid) ? "board" : "hand");
          try { if(J.landsNothing(n, hs, a0.uid, from)) flag("idlePlay", (me.hand.concat(me.gear || []).find(c => c && c.uid === a0.uid) || {}).name); } catch(_){}
        }
        /* a defence reaction cast into a hit the wall already stops */
        if(a0.t === "play" && n.pend && n.pend.by === 1 - hs && wallNow(me) >= (n.pend.total || 0)) flag("rxIntoStopped", (me.hand.find(c => c && c.uid === a0.uid) || {}).name);
        /* the turn ends with resources floating (they fizzle) */
        if(a0.t === "endTurn" && (me.res || 0) > 0){
          const alt = SP.laCands(n, hs, null).filter(x => x.t !== "endTurn");
          const ab = alt.find(x => x.t === "activate"), pl = alt.find(x => x.t === "play");
          const nm = x => x.uid === "hpow" ? "hero ability" : (me.hand.concat(me.gear || [], me.arsenal ? [me.arsenal] : []).find(c => c && c.uid === x.uid) || (me.board || []).find(b => b && b.uid === x.uid) || {}).name || ((me.board || []).find(b => b && b.uid === x.uid) || {card: {}}).card.name;
          flag(ab ? "resFizzle+ability" : pl ? "resFizzle+play" : "resFizzle(nothing)", "res " + me.res + (ab ? " ability " + nm(ab) : pl ? " play " + nm(pl) : ""));
        }
        /* a lethal hit met with no block while a legal hand blocker is held */
        if(P.canDeclareDefenders(n, hs) && n.pend && (n.pend.total || 0) - SP.wallOf(me) >= me.hp && a0.t !== "defend"){
          const blk = (me.hand || []).filter(c => num(c, "def") > 0 && (me.blockH || []).indexOf(c.uid) < 0 && J.legal(n, {t: "defend", uid: c.uid}, hs) == null);
          if(blk.length) pendingLethal = n.turn;
          if(blk.length) flag("lethalUnblocked", `leak ${(n.pend.total || 0) - SP.wallOf(me)} hp ${me.hp} held ${blk.map(c => c.name + "/" + num(c, "def"))}`);
        }
        /* the turn ends with an action point and an affordable attack still legal */
        if(a0.t === "endTurn" && (me.ap || 0) > 0){
          const atk = SP.laCands(n, hs, null).find(x => x.t === "play" && num(me.hand.concat(me.arsenal ? [me.arsenal] : []).find(c => c && c.uid === x.uid), "power") > 0);
          if(atk){ const all = SP.laCands(n, hs, null).filter(x => x.t === "play").map(x => me.hand.concat(me.arsenal ? [me.arsenal] : []).find(c => c && c.uid === x.uid)).filter(c => num(c, "power") > 0);
            const dead = all.filter(c => num(c, "def") === 0);
            flag(dead.length ? "holdDeadAttack" : "endTurnWithAttack", all.map(c => c.name + "/pw" + num(c, "power") + "/d" + num(c, "def") + "/c" + num(c, "cost")).join(",")); }
        }
        /* the arsenal step skipped with cards in hand and an empty arsenal */
        if(a0.t === "arsenal" && a0.uid == null && !me.arsenal && (me.hand || []).length) flag("arsenalSkip", me.hand.length + " in hand");
      }
      const r = J.reduce(n, a0, s);
      if(r.error){ flag("refusal:" + (s === hs ? "hero" : "foe"), r.error); continue; }
      n = r.state; moved = true; break;
    }
    if(!moved) break;
  }
  const won = n.over && n.over.winner === hs, lost = n.over && n.over.winner === 1 - hs;
  if(lost && pendingLethal != null && n.turn === pendingLethal) flag("lethalUnblockedDied", "turn " + n.turn);
  /* lost on life holding cards that could have blocked */
  if(lost && n.over.how === "life"){
    const def = (n.sides[hs].hand || []).filter(c => num(c, "def") > 0);
    if(def.length) flag("diedHoldingBlockers", def.map(c => c.name + "/" + num(c, "def")).join(","));
  }
  return {won, lost, F, ex, turns: n.turn};
}

for(const hero of process.argv[2].split(",")){
  const out = {hero, games: 0, wins: 0, flags: {}, inLoss: {}, inWin: {}, gamesWith: {}, lossWith: {}, ex: {}};
  for(const o of HEROES.filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]) for(let s = 0; s < 3; s++){
    const r = game(a, b, `${a}-${b}-cen${s}`, s % 2, hero);
    out.games++; if(r.won) out.wins++;
    for(const [k, v] of Object.entries(r.F)){
      out.flags[k] = (out.flags[k] || 0) + v;
      out.gamesWith[k] = (out.gamesWith[k] || 0) + 1;
      if(r.lost) out.lossWith[k] = (out.lossWith[k] || 0) + 1;
      if(!out.ex[k]) out.ex[k] = r.ex[k];
    }
  }
  console.log(JSON.stringify(out));
}
