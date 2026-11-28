/* ============================================================
   CRESCENDO — ui/circuit-play.js  ·  DawnUICircuitPlay: THE CIRCUIT's playing side — C5 (the result's plate), C6 (the Circuit), C7 (the road),
   C8 (today's challenge) — and the hooks into F1-F4, F7 and F8 (docs/crescendo/SCREENS-CIRCUIT.md §0 · mockups/circuit-5 … circuit-9).
   The store and the rules are ui/circuit.js (DawnCircuit); the shared parts, the store handle and the server read are ui/circuit-view.js.

   RECORDING. `finish(session, over, ctx, hooks)` is the ONE place a finished game enters the store: the table calls it once when it reports
   `over` (the moment the classic board calls `DawnLocal.recordResult`), with the game shape the doc specifies; it answers what C5 shows.
   A ranked game (a server table whose channel says it is ranked) is kept as a RECEIPT with the server's own {from, to}, taken from
   `rank().result.change[seat]`; until the server answers the plate says so, and if it never does nothing is recorded or invented.
   THE DAILY AND THE ROAD start real games through ui/session.js with the deal's seed, heroes and first player (Sharp, decks as printed).
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUICircuitPlay = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

var P = root.htmPreact || {};
var html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
var CC = function(){ return root.DawnCircuit; };
var V = function(){ return root.DawnUICircuitView; };
var PT = function(){ return V().parts; };

var TIERS = ["Armory", "Skirmish", "The Calling"];
/* tier names by position: the last distinct chapter is THE SUMMIT; earlier ones take the names by index, any extra reads "Chapter n" */
function tierName(road, ch){
  var i = -1; road.tiers.forEach(function(t, j){ if(t.ch === ch) i = j; });
  if(i < 0) return "Chapter " + ch;
  return i === road.tiers.length - 1 ? "The Summit" : TIERS[i] || "Chapter " + ch;
}
function roadOf(s){ return CC().road(s, root.HEROES || []); }
function today(){ return CC().dayOf(); }

/* ---------------- the daily's words ---------------- */
function resetIn(now){
  var d = new Date(now == null ? Date.now() : now), next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1), ms = next - d.getTime();
  var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h + " h " + m + " m";
}
function dateWord(day){ var p = day.split("-"); return +p[2] + " " + PT().MONTH[+p[1] - 1]; }
function dayName(day){ var p = day.split("-"); return PT().WEEKDAY[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }
/* the share text: plain, spoiler-free, no links, no ids */
function shareText(day, rec){
  var h = PT().hname, line = rec.r === "w" ? "Won in " + rec.turns + " turns · " + rec.life + " life left" : rec.r === "l" ? "Lost on turn " + rec.turns : "Drew on turn " + rec.turns;
  return "Dawnblade Daily · " + dateWord(day) + "\n" + h(rec.me) + " vs " + h(rec.foe) + "\n" + line;
}
function weekStrip(s, day){
  var p = day.split("-"), t0 = Date.UTC(+p[0], +p[1] - 1, +p[2]), out = [];
  for(var i = 6; i >= 0; i--){
    var d = new Date(t0 - i * 86400000).toISOString().slice(0, 10), rec = s.marks.days[d];
    out.push({day: d, r: rec ? rec.r : null, today: i === 0, name: dayName(d)});
  }
  return out;
}
function dailyStats(s, day){
  var st = CC().streak(s, day), ds = Object.keys(s.marks.days), won = ds.filter(function(d){ return s.marks.days[d].r === "w"; }).length;
  var run = st.cur > 0 ? PT().cap1(PT().numw(st.cur)) + (st.cur === 1 ? " day" : " days") + " running" : "No run today";
  return run + " · best " + st.best + " · " + won + " won of " + ds.length + " played";
}

/* ============================================================
   RECORDING A FINISHED GAME
   ============================================================ */
/* the game shape of the doc (§ The local store), from a finished session; null when there is nothing to record */
function gameOf(s, over, ctx, now){
  var L = root.DawnLocal, st = s.state(), seat = s.seat, o = L && L.outcomeOf ? L.outcomeOf(over, seat) : null;
  if(!o || !st) return null;
  var hk = s.heroKeys || [], me = hk[seat], foe = s.dummy ? "dummy" : hk[1 - seat];
  if(!me || !foe) return null;
  var net = !!s.networked, ranked = false;
  try { ranked = net && !!(s.channel && s.channel() && s.channel().rank && s.channel().rank().ranked); } catch(e){}
  var kind = net ? (ranked ? "ranked" : "friend") : s.dummy ? "dummy" : ctx && ctx.kind === "daily" ? "daily" : ctx && ctx.kind === "road" ? "road" : "ai";
  var at = now == null ? Date.now() : now, seed = !net && s.pick && s.pick.seed != null ? String(s.pick.seed) : null;
  var code = net ? String((s.code && s.code()) || "table") : null;
  var g = {id: net ? code + "." + me + "." + foe + "." + at.toString(36) : (seed || "x") + "." + me + "." + foe + "." + at.toString(36), at: at, kind: kind, me: me, foe: foe,
    level: net || s.dummy ? null : (s.pick && s.pick.search ? "sharp" : "steady"), result: o, how: over.how || (o === "d" ? "stalemate" : "life"),
    turns: st.turn | 0, life: [st.sides[seat].hp | 0, st.sides[1 - seat].hp | 0], first: st.firstPlayer === seat ? 1 : 0, seed: seed, rating: null, dv: root.DATA_VER || ""};
  if(kind === "daily"){ g.day = ctx.day || today(); g.official = false; }
  return g;
}
/* one finished game into the store, once: -> {game, events, store} (events [] when the id was already there), or null */
function recordGame(g){
  var Vw = V(), r = CC().record(Vw.store(), g, root.HEROES || []);
  if(!r) return null;
  Vw.commit(r.store);
  return {game: g, events: r.events, store: r.store};
}
/* the table's one call at `over`. Local / friendly games record now. A ranked game waits (up to `wait` ms) for the server's own move of the
   rating and is recorded as a receipt; `update(model)` is called as the plate's facts arrive. -> the first model. */
function finish(s, over, ctx, o){
  o = o || {};
  var g = gameOf(s, over, ctx, o.now), update = o.update || function(){};
  if(!g) return {kind: "none", events: [], store: V().store()};
  if(g.kind !== "ranked"){
    var rec = recordGame(g);
    return {kind: g.kind, game: rec ? rec.game : g, events: rec ? rec.events : [], store: rec ? rec.store : V().store(), ranked: null};
  }
  /* ranked: what the cache knew BEFORE this read (for "was #14 when you last looked") */
  var was = V().readCache(), model = {kind: "ranked", game: g, events: [], store: V().store(), ranked: {state: "wait", was: was && was.you && was.you.rank != null && Date.now() - was.at < 7 * 86400000 ? was.you.rank : null}};
  var seat = s.seat, t0 = Date.now(), wait = o.wait == null ? 12000 : o.wait, stop = false, timer = null;
  var rank = function(){ try { return s.channel().rank(); } catch(e){ return null; } };
  var poll = function(){
    if(stop) return;
    var rk = rank(), res = rk && rk.result, ch = res && res.change && res.change[seat];
    if(ch && isFinite(ch.from) && isFinite(ch.to)){
      g.rating = {from: ch.from, to: ch.to};
      var rec2 = recordGame(g);
      model = Object.assign({}, model, {store: rec2 ? rec2.store : V().store(), events: rec2 ? rec2.events : [], ranked: Object.assign({}, model.ranked, {state: "ok", from: ch.from, to: ch.to, stand: "loading"})});
      update(model);
      V().ladderLoad().then(function(r){
        if(stop) return;
        model = Object.assign({}, model, {ranked: Object.assign({}, model.ranked, {stand: "ok", you: r.you, floor: r.floor})}); update(model);
      }, function(){ if(!stop){ model = Object.assign({}, model, {ranked: Object.assign({}, model.ranked, {stand: "fail"})}); update(model); } });
      return;
    }
    if(Date.now() - t0 > wait){ model = Object.assign({}, model, {ranked: Object.assign({}, model.ranked, {state: "late"})}); update(model); return; }
    timer = setTimeout(poll, 300);
  };
  poll();
  model.cancel = function(){ stop = true; clearTimeout(timer); };
  return model;
}

/* ============================================================
   C5 THE PLATE — beats, the ranked plate, the buttons per variant
   ============================================================ */
/* the beats of a game (P9 order, at most two): [{ic, t, d}] — every sentence is a fact of the store after the game */
function beatsOf(events, g, s){
  var Pt = PT(), h = root.HEROES || [], road = roadOf(s), out = [];
  var heroOf = function(k){ return Pt.heroOf(k); };
  events.forEach(function(e){
    var m, t, d;
    if(e.t === "summit"){ out.push({k: e.t, ic: "sun", t: "You reached the summit", d: "All " + road.total + " foes beaten, one by one."}); }
    else if(e.t === "tier"){ out.push({k: e.t, ic: "road", t: tierName(road, e.ch) + " cleared", d: road.done + " of " + road.total + " on the Road"}); }
    else if(e.t === "rank"){
      m = CC().mastery(s, e.hero, h); t = Pt.hname(e.hero) + " is now " + Pt.cap1(m.name.toLowerCase());
      d = m.beat + " of " + m.n + " foes beaten with " + Pt.first(e.hero) + (m.next ? " · " + Math.max(0, (m.rank < 3 ? m.need.proven : m.next.need) - m.beat) + " more for " + (m.next.rank >= 5 ? "the Dawnblade" : Pt.cap1(m.next.name.toLowerCase())) : "");
      out.push({k: e.t, ic: "seal", t: t, d: d});
    }
    else if(e.t === "daily"){
      var st = CC().streak(s, g.day || today()), days = s.marks.days, fast = null;
      Object.keys(days).forEach(function(k){ if(days[k].r === "w" && (fast == null || days[k].turns < fast)) fast = days[k].turns; });
      if(e.r === "w"){
        var bits = []; if(st.cur >= 2) bits.push(Pt.cap1(Pt.numw(st.cur)) + " days running");
        bits.push(fast === e.turns ? "your fastest daily win so far" : "your fastest daily win so far is " + fast);
        out.push({k: e.t, ic: "cal", t: "Won in " + e.turns + " turns", d: bits.join(" · ").replace(/^./, function(c){ return c.toUpperCase(); })});
      } else out.push({k: e.t, ic: "cal", t: (e.r === "l" ? "Lost" : "Drew") + " on turn " + e.turns, d: "That is today’s result. Play it again for practice: same deal, nothing changes."});
    }
    else if(e.t === "rung"){
      var ch = heroOf(e.foe) ? heroOf(e.foe).ch : null, tr = road.tiers.filter(function(x){ return x.ch === ch; })[0];
      out.push({k: e.t, ic: "road", t: "Road: " + Pt.hname(e.foe) + " cleared", d: road.done + " of " + road.total + " on the Road" + (tr ? " · " + tierName(road, ch) + " " + tr.done + " of " + tr.total : "")});
    }
    else if(e.t === "best"){
      out.push({k: e.t, ic: "sun", t: e.which === "fastWin" ? "Fastest win: " + e.value + " turns" : "Closest win: " + e.value + (e.value === 1 ? " life left" : " life left"),
        d: e.was == null ? "A first for this phone" : "Was " + e.was + (e.which === "fastWin" ? " turns" : " life left")});
    }
    else if(e.t === "pair"){
      m = CC().mastery(s, e.hero, h);
      out.push({k: e.t, ic: "seal", t: Pt.hname(e.hero) + ": " + Pt.plural(e.beaten, "foe") + " beaten",
        d: e.beaten === 1 ? Pt.hname(g.foe) + ", for the first time" : m.next ? Math.max(0, (m.rank < 3 ? m.need.proven : m.next.need) - m.beat) + " more for " + (m.next.rank >= 5 ? "the Dawnblade" : Pt.cap1(m.next.name.toLowerCase())) : "Every foe beaten"});
    }
  });
  return out.slice(0, 2);
}
function Beats(p){
  var Pt = PT(), b = p.beats;
  return html`<div class=${"plate beats" + (b.length === 1 ? " one" : "")} data-b="plate"><div class="mono">${p.label}</div>${b.map(function(x){
    return html`<div class="beat"><span class="bi">${Pt.Ic(x.ic, 24)}</span><span class="sp"><div class="ttl3" style="font-size:19px">${x.t}</div><div class="t13" style="font-size:13px;line-height:16px">${x.d}</div></span></div>`; })}</div>`;
}
/* the ranked plate (a button to C4): "RATED GAME · THE SERVER'S NUMBERS", old numeral → new, the move chip, the standing line */
function RankedPlate(p){
  var Pt = PT(), r = p.ranked, Mv = Pt.Mv;
  if(r.state === "wait") return html`<div class="plate" style="pointer-events:none" data-b="plate-wait"><div class="mono">Rated game · the server’s numbers</div><div class="row" style="margin-top:8px;gap:10px;align-items:center"><span class="skel" style="width:96px;height:34px;border-radius:10px"></span><span class="mono br">Recording the result<span class="dots"><i></i><i></i><i></i></span></span></div><div class="stand"><span>Your new rating appears the moment the server has it.</span></div></div>`;
  if(r.state === "late") return html`<button class="plate" data-tap data-b="plate" onClick=${p.onLadder} aria-label="The ladder"><div class="mono">Rated game · the server’s numbers</div><div class="row" style="margin-top:8px"><span class="ttl3" style="font-size:19px">The server has the result</span></div><div class="stand"><span>Your rating shows on the ladder when it answers.</span><span class="sp"></span>${Pt.Ic("next", 18)}</div></button>`;
  var you = r.you, place = you && !you.listed && you.toGo > 0, d = r.to - r.from, stand;
  if(r.stand === "loading") stand = html`<span>Reading the ladder…</span>`;
  else if(r.stand === "fail" || !you) stand = html`<span>Your new standing shows on the ladder.</span>`;
  else if(place) stand = html`<span>Rated game <b>${you.games}</b> of ${r.floor}. ${you.toGo === 1 ? "One more" : Pt.cap1(Pt.numw(you.toGo)) + " more"} and you are on the ladder.</span>`;
  else if(you.listed) stand = html`<span><b>#${you.rank}</b> on the ladder${r.was != null ? (r.was !== you.rank ? " · was #" + r.was + " when you last looked" : " · as when you last looked") : ""}</span>`;
  else stand = html`<span>Choose a player name and you are on the ladder.</span>`;
  return html`<button class="plate" data-tap data-b="plate" onClick=${p.onLadder} aria-label="Your rating, then the ladder"><div class="mono">${place ? "Your first rated games" : "Rated game · the server’s numbers"}</div>
    <div class="row" style="margin-top:4px;gap:10px;align-items:center"><span class="old" aria-label=${"Was " + r.from}>${r.from}</span>${Pt.Ic("next", 22)}<span class="new" aria-label=${"Now " + r.to}>${r.to}</span><span class="sp"></span><span style="text-align:right"><${Mv} d=${d} big=${true}/></span></div>
    <div class="stand">${stand}${r.stand === "ok" && you && you.listed ? html`<span class="sp"></span>${Pt.Ic("next", 18)}` : null}</div></button>`;
}
/* what F7's pad shows under the paper and on its buttons, for a recorded game: {cls, plate, cap, acts:{a,b,c}} or null (nothing to add) */
function resultKit(m){
  if(!m || m.kind === "none") return null;
  var Pt = PT(), g = m.game, ev = m.events || [], h = m.hooks || {}, s = m.store, road = roadOf(s);
  var kit = {cls: "cx c5", plate: null, cap: null, acts: {}};
  var daily = ev.filter(function(e){ return e.t === "daily"; })[0], rung = ev.filter(function(e){ return e.t === "rung"; })[0];
  if(m.kind === "ranked"){ kit.plate = html`<${RankedPlate} ranked=${m.ranked} onLadder=${h.onLadder}/>`; return kit; }
  var beats = beatsOf(ev, g || {}, s);
  if(beats.length){
    kit.plate = html`<${Beats} beats=${beats} label=${daily ? "Today’s challenge · your official try" : "What this game did"}/>`;
  } else kit.cap = "Saved to your record on this phone.";
  if(daily && g){
    var rec = s.marks.days[g.day];
    kit.acts = {a: {label: "Share", onClick: function(){ h.onShare && h.onShare(shareText(g.day, rec)); }},
      c: daily.r === "w" ? {label: "Back to the Circuit", onClick: h.onCircuit} : {label: "Practice this deal", onClick: h.onPractice}};
  } else if(rung && road.next && h.onNext){
    kit.acts = {a: {label: "Rematch", onClick: h.onRematch}, b: {label: "Leave", onClick: h.onLeave, dng: true}, c: {label: "Next: " + Pt.hname(road.next), onClick: function(){ h.onNext(road.next); }}};
  }
  return kit;
}

/* ============================================================
   C6 The Circuit
   ============================================================ */
function C6(p){
  var nav = p.nav, Pt = PT(), html_ = html, Vw = V(), s = Vw.useStore(), net = Vw.net(), Ic = Pt.Ic;
  Pt.useNet();
  var day = today(), deal = CC().dailyDeal(day, root.HEROES || []), rec = s.marks.days[day], road = roadOf(s), st = CC().streak(s, day);
  var srv = Vw.serverNow(), you = srv && srv.you && srv.you.games > 0 ? srv.you : null, offline = net.state === "fail" && !!srv && !srv.live;
  var nextHero = road.next ? Pt.heroOf(road.next) : null, tierCh = nextHero ? nextHero.ch : (road.tiers.length ? road.tiers[road.tiers.length - 1].ch : null);
  var tier = road.tiers.filter(function(t){ return t.ch === tierCh; })[0];
  var last = Object.keys(s.marks.days).sort().filter(function(d){ return d < day; }).pop();
  var lastWord = !last ? "" : last === CC().prevDay(day) ? "Last played yesterday · " : "Last played " + Math.round((Date.parse(day) - Date.parse(last)) / 86400000) + " days ago · ";
  var path = srv ? Vw.ratingPath(you, srv.mine) : null;
  var pill = rec ? html_`<span class=${"pill " + (rec.r === "w" ? "w" : rec.r === "l" ? "l" : "d")}>${Ic(rec.r === "w" ? "check" : "x", 14)} ${rec.r === "w" ? "Won" : rec.r === "l" ? "Lost" : "Drew"} · turn ${rec.turns}</span>` : html_`<span class="pill br">Not played yet</span>`;
  var dots = [], i = 0;
  road.tiers.forEach(function(t, ti){
    if(ti) dots.push(html_`<u></u>`);
    t.rungs.forEach(function(k){ var r = road.rungs.filter(function(x){ return x.k === k; })[0]; dots.push(html_`<i class=${r.cleared ? "c" : k === road.next ? "n" : ""}></i>`); i++; });
  });
  var primary = !rec ? {label: "Play today’s challenge", go: function(){ nav.go("c8"); }} : road.next ? {label: "Fight " + Pt.hname(road.next) + " on the road", go: function(){ nav.go("c7"); }} : {label: "Play", go: nav.toWays};
  var standing;
  if(you) standing = html_`<div class="row" style="margin-top:8px;gap:${offline ? 10 : 12}px"><span class="nn m" style=${offline ? "color:var(--ink-1)" : ""}>${you.rating}</span><span class="sp">${offline ? html_`<div class="t13">As of ${Vw.agoLong(Date.now() - srv.at)} ago. The server is not answering.</div>` : html_`<div class="ttl3">${you.listed && you.rank != null ? "#" + you.rank + " on the ladder" : "Rated, not yet listed"}</div>`}</span>${!offline && path ? html_`<${Pt.Mv} d=${path.move}/>` : null}${Ic("next", 22)}</div>`;
  else standing = html_`<div class="row" style="margin-top:8px;gap:12px"><span class="nn m" style="color:var(--ink-2)">1200</span><span class="sp"><div class="t13">Everyone starts here. Open a ranked table to be rated.</div></span>${Ic("next", 22)}</div>`;
  return html_`<div class="scr cx c6" data-b="c6"><${Pt.Sprite}/><div class="frame">
    <${Pt.Hdr} sub="Road · daily · ladder" title="The circuit" onBack=${nav.toWays}/>
    <div class="vw"><div class="col6">
      <button class="card k1 cx-card lead btnlike" data-tap data-b="daily" onClick=${function(){ nav.go("c8"); }}>
        <div class="row"><h2 class="ct br">Today’s challenge</h2><span class="sp"></span>${pill}</div>
        <div class="row" style="margin-top:12px;gap:12px"><span class="vs"><${Pt.Pt} k=${deal.me} s=${52} cls="you" pos="50% 18%"/><${Pt.Pt} k=${deal.foe} s=${52} cls="opp" pos="50% 18%"/></span><span class="sp"><div class="ttl2">${Pt.hname(deal.me)} <span style="color:var(--ink-2)">vs</span> ${Pt.hname(deal.foe)}</div><div class="t13" style="margin-top:3px">Same deal for everyone.</div></span>${Ic("next", 22)}</div>
        <div class="mono i1 ft" style="position:absolute;left:14px;bottom:12px">${rec ? (st.cur >= 2 ? Pt.cap1(Pt.numw(st.cur)) + " days running · " : "") + "best " + st.best : lastWord + "new in " + resetIn()}</div></button>
      <button class="card k2 cx-card btnlike" data-tap data-b="road" onClick=${function(){ nav.go("c7"); }}>
        <div class="row"><h2 class="ct">The road</h2><span class="sp"></span><span class="mono i1">${tier ? tierName(road, tierCh) + " · " + tier.done + " of " + tier.total : ""}</span></div>
        <div style="margin-top:12px"><div class="dots17" role="img" aria-label=${road.done + " of " + road.total + " foes cleared on the road"}>${dots}</div></div>
        <div class="row" style="margin-top:12px;gap:12px">${nextHero ? html_`<${Pt.Pt} k=${road.next} s=${44} cls="br" pos="50% 18%"/><span class="sp"><div class="mono br">Next up</div><div class="ttl3">${Pt.hname(road.next)}</div></span>`
          : html_`<span class="sp"><div class="mono br">You reached the summit</div><div class="ttl3">Replay any rung</div></span>`}${Ic("next", 22)}</div></button>
      <button class="card k3 cx-card btnlike" data-tap data-b="standing" onClick=${function(){ nav.go("c4"); }}><div class="row"><h2 class="ct">Your standing</h2><span class="sp"></span><span class="mono i1">${you ? you.wins + " won · " + you.losses + " lost" : "Not rated yet"}</span></div>${standing}</button>
      <div class="tilerow"><button class="tilel" data-tap data-b="record" onClick=${function(){ nav.go("c1"); }}>${Ic("pad", 22)}<span class="ttl3" style="font-size:17px">Your record</span></button>
        <button class="tilel" data-tap data-b="heroes" onClick=${function(){ nav.go("c2"); }}>${Ic("heroes", 22)}<span class="ttl3" style="font-size:17px">Heroes</span></button></div></div>
    <div class="hub"><button class="btn" data-tap data-b="primary" onClick=${primary.go}>${primary.label}</button></div></div></div></div>`;
}

/* ============================================================
   C7 The road
   ============================================================ */
function C7(p){
  var nav = p.nav, Pt = PT(), Vw = V(), s = Vw.useStore(), road = roadOf(s), Ic = Pt.Ic, hs = root.HEROES || [];
  var st = useState(p.pick || road.next), sel = st[0], setSel = st[1], sc = useRef(null);
  useEffect(function(){
    var el = sc.current, r = el && el.querySelector(".rung.sel");
    if(el && r) el.scrollTop = Math.max(0, r.offsetTop - 140);
  }, []);
  var cleared = function(k){ return s.marks.road[k] || null; };
  var rung = function(k){
    var c = cleared(k), isSel = sel === k, next = k === road.next, h = Pt.heroOf(k);
    var sub = c ? "Cleared · with " + Pt.hname(c.me) + " · turn " + c.turns : next ? "Next up" : "Not yet";
    return html`<button class=${"rung" + (isSel ? " sel" : "") + (!c && !next ? " up" : "")} aria-pressed=${isSel ? "true" : "false"} aria-label=${Pt.hname(k) + ", " + (c ? "cleared" : next ? "next up" : "not yet cleared")} data-tap data-b=${"rung-" + k} onClick=${function(){ setSel(k); }}>
      <span class="nd"><${Pt.Pt} k=${k} s=${44} cls=${next && !c ? "br" : ""} pos="50% 18%">${c ? html`<span class="ck"><svg><use href="#fl-i-check"/></svg></span>` : null}<//></span>
      <span class="sp"><div class="ttl3">${Pt.hname(k)}</div><div class=${"mono " + (next && !c ? "br" : "")} style="margin-top:2px">${sub}</div></span>${isSel ? html`<span class="go">Fight</span>` : null}</button>`;
  };
  var frac = road.total ? road.done / road.total : 0, picked = sel;
  var newCount = Object.keys(s.marks.road).filter(function(k){ return !hs.some(function(h){ return h.k === k; }); }).length;
  return html`<div class="scr cx c7" data-b="c7"><${Pt.Sprite}/><div class="frame">
    <${Pt.Hdr} sub="Every foe, one at a time" title="The road" onBack=${function(){ nav.go("c6"); }}/>
    <div class="vw"><div class="bar2"><span class="mono i1">${road.done} of ${road.total} cleared</span><span class="tr"><i style=${"transform:scaleX(" + frac.toFixed(3) + ")"}></i></span></div>
      <div class="sc" ref=${sc} style="top:100px;bottom:76px">
        ${road.summit ? html`<div style="padding-top:6px"><div class="cx-card lead" style="margin:0 var(--gut) 4px"><div class="empty" style="padding:10px 6px 6px"><div class="sunm"><i></i><b></b></div><div class="ttl2">You reached the summit</div><p class="t13" style="max-width:300px">All ${road.total} foes beaten, one by one. The road is yours to walk again, and every hero has its own book to fill.</p></div></div></div>` : null}
        <div class="road">${road.tiers.map(function(t){
          return html`<div class="tier"><span class="ttl2">${tierName(road, t.ch).toUpperCase()}</span><span class="mono i1" style="margin-bottom:2px">${t.done} of ${t.total}</span><span class="sp"></span>${t.cleared ? html`<span class="stamp"><svg><use href="#fl-i-check"/></svg>Cleared</span>` : null}</div>${t.rungs.map(rung)}`; })}</div></div>
      <div class="hub"><button class=${"btn" + (picked ? "" : " dis")} disabled=${!picked} data-tap=${picked ? "" : undefined} data-b="fight" onClick=${picked ? function(){ nav.road(picked); } : null}>${picked ? "Fight " + Pt.hname(picked) : "Pick a rung"}</button></div></div></div></div>`;
}

/* ============================================================
   C8 Today's challenge
   ============================================================ */
function Faces(p){
  var Pt = PT(), a = Pt.art(p.deal.me), b = Pt.art(p.deal.foe);
  return html`<div class=${"faces" + (p.sh ? " sh" : "")}><div class="face me" style=${a ? "background-image:url(" + a + ")" : ""}><div class="who"><b>${Pt.hname(p.deal.me)}</b><span>You play</span></div></div>
    <div class="vsm">VS</div>
    <div class="face them" style=${b ? "background-image:url(" + b + ")" : ""}><div class="who"><b>${Pt.hname(p.deal.foe)}</b><span>Against</span></div></div></div>`;
}
function C8(p){
  var nav = p.nav, Pt = PT(), Vw = V(), s = Vw.useStore(), Ic = Pt.Ic, ui = useState(""), msg = ui[0], setMsg = ui[1];
  var day = today(), deal = CC().dailyDeal(day, root.HEROES || []), rec = s.marks.days[day];
  var week = weekStrip(s, day), stats = dailyStats(s, day), rules = {fn: Pt.hname(deal.foe)};
  var wk = html`<div class="week">${week.map(function(w){
    var c = w.r === "w" ? "w" : w.r === "l" ? "l" : w.r === "d" ? "d" : "n", word = w.r === "w" ? "won" : w.r === "l" ? "lost" : w.r === "d" ? "drew" : "not played";
    return html`<div class=${"wd " + c + (w.today ? " today" : "")} role="img" aria-label=${w.name + ": " + word + (w.today ? ", today" : "")}><span class="mono">${w.name.charAt(0)}</span><b>${w.r ? w.r.toUpperCase() : "–"}</b></div>`; })}</div>`;
  var sub = dateWord(day) + " · resets in " + resetIn();
  var copy = function(){
    var t = shareText(day, rec);
    try { root.navigator.clipboard.writeText(t).then(function(){ setMsg("Copied"); setTimeout(function(){ setMsg(""); }, 1600); }, function(){ setMsg("Could not copy here"); }); } catch(e){ setMsg("Could not copy here"); }
  };
  var line = function(ic, t){ return html`<div class="rl">${Ic(ic, 22)}<div class="t13" style="font-size:14px;line-height:19px;color:var(--ink-1)">${t}</div></div>`; };
  var body;
  if(!rec) body = html`<div class="stack"><${Faces} deal=${deal}/>
      <div>${line("cal", html`<b>Same deal for everyone today:</b> the same two decks, the same shuffle, the same coin.`)}${line("board", html`Decks as printed. The AI plays at its sharpest. <b>${deal.first === 0 ? "You go first" : rules.fn + " goes first"}</b> by the coin.`)}${line("flag", html`<b>One official try a day.</b> Your first finished game is today’s result. After that, play it again for practice.`)}</div>
      ${wk}<div class="mono i1" style="text-align:center">${stats}</div></div>
      <div class="hub"><button class="btn" data-tap data-b="play" onClick=${function(){ nav.daily(); }}>Play today’s deal</button></div>`;
  else {
    var won = rec.r === "w", head = won ? "Won in " + rec.turns + " turns" : rec.r === "l" ? "Lost on turn " + rec.turns : "Drew on turn " + rec.turns;
    var sub1 = won ? "You finished on " + rec.life + " life" : rec.r === "l" ? rules.fn + " finished the game ahead" : "A dead position";
    var days = s.marks.days, fast = null; Object.keys(days).forEach(function(k){ if(days[k].r === "w" && (fast == null || days[k].turns < fast)) fast = days[k].turns; });
    var foot = won ? (fast != null ? "Your fastest daily win so far is " + fast + " turns." : "") : "That is today’s result. A new deal arrives in " + resetIn() + ".";
    body = html`<div class="stack two"><${Faces} deal=${deal} sh=${true}/><div class="cx-card lead"><div class="row"><span class=${"rs " + rec.r}>${rec.r === "w" ? "WON" : rec.r === "l" ? "LOST" : "DREW"}</span><span style="margin-left:12px"><div class="ttl2">${head}</div><div class="mono i1" style="margin-top:3px">${sub1}</div></span></div>
        <div class="mono only-c" style="margin-top:8px">${Pt.hname(deal.me)} vs ${Pt.hname(deal.foe)}</div><p class="t13" style="margin-top:10px">${foot}</p></div>
      <div class="share" data-b="share">${shareText(day, rec)}</div>${wk}<div class="mono i1" style="text-align:center">${stats}</div></div>
      <div class="hub two"><button class="btn sec sp" style="min-width:0" data-tap data-b="practice" onClick=${function(){ nav.daily(true); }}>Practice this deal</button></div>
      <div class="hub"><button class="btn" data-tap data-b="copy" onClick=${copy}>${msg ? null : Ic("copy", 22)}${msg || "Copy my result"}</button></div>`;
  }
  return html`<div class="scr cx c8" data-b="c8"><${Pt.Sprite}/><div class="frame"><${Pt.Hdr} sub=${sub} title="Today’s challenge" onBack=${function(){ nav.go("c6"); }}/><div class="vw">${body}</div></div></div>`;
}

/* ============================================================
   HOOKS into F2, F3, F4, F8
   ============================================================ */
/* F2's fifth card: "The Circuit" (always lit: the solo half needs no server) */
var WAYS_CARD = {id: "circuit", title: "The Circuit", text: "Your road, today’s challenge, your record and the ladder.", tag: "Solo progress · no sign-in"};
/* F3: a hero's mastery pips (at SPARRED and above only: an untried hero shows none) */
function tilePips(k){
  try {
    var s = V().store(), m = CC().mastery(s, k, root.HEROES || []);
    if(m.rank < 1) return null;
    var out = [];
    for(var i = 0; i < 5; i++) out.push(html`<svg class=${"pip" + (i < m.rank ? " on" : "")} width="8" height="8" viewBox="0 0 24 24"><path d="M12 2L22 12 12 22 2 12z"/></svg>`);
    return html`<span class="mp" role="img" aria-label=${"Mastery " + m.rank + " of 5, " + m.name.toLowerCase()}>${out}</span>`;
  } catch(e){ return null; }
}
function peekPips(k){
  try {
    var s = V().store(), m = CC().mastery(s, k, root.HEROES || []);
    if(m.rank < 1) return null;
    var Pt = PT();
    return html`<span class="mp2" data-b="peek-rank"><${Pt.Pips} n=${m.rank} px=${14} gap=${3}/><span class="mono br">${m.name}</span></span>`;
  } catch(e){ return null; }
}
/* F4's label, per context: from the road (the rung), from the daily */
function sitLabel(ctx, foe){
  if(!ctx) return null;
  if(ctx.kind === "daily") return "Today’s challenge";
  if(ctx.kind === "road"){ var hs = root.HEROES || [], i = hs.map(function(h){ return h.k; }).indexOf(foe); return "The road · rung " + (i + 1) + " of " + hs.length; }
  return null;
}
/* the daily's seating: the seed's coin decides, no choice */
function dailySeating(first, foeName){
  return {label: "The coin", text: first === 0 ? "You go first" : foeName + " goes first", first: first, choices: null, ready: true, coin: true};
}

return {C5: null, C6: C6, C7: C7, C8: C8, finish: finish, gameOf: gameOf, recordGame: recordGame, beatsOf: beatsOf, resultKit: resultKit, RankedPlate: RankedPlate, Beats: Beats,
  shareText: shareText, weekStrip: weekStrip, dailyStats: dailyStats, resetIn: resetIn, dateWord: dateWord, tierName: tierName, roadOf: roadOf, today: today,
  WAYS_CARD: WAYS_CARD, tilePips: tilePips, peekPips: peekPips, sitLabel: sitLabel, dailySeating: dailySeating};
});
