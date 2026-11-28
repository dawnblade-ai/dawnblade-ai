/* ============================================================
   CRESCENDO — ui/circuit-view.js  ·  DawnUICircuitView: THE CIRCUIT's record screens C1-C4 and the parts every Circuit screen shares
   (docs/crescendo/SCREENS-CIRCUIT.md · mockups/circuit-1 … circuit-4 · ui/circuit.css is the mockups' own sheet, so a box in the
   mockup is the same box here). The rules and the store are ui/circuit.js (DawnCircuit); the SERVER's numbers are engine/servertable.js's
   `ladder` (the very call the classic page's SrvLadder makes) — nothing here computes a rating or a standing.

     C1 Your record · C2 Heroes and mastery · C3 Games · C4 The ladder         + the shared parts (sprite, header, seg, pips, move chip,
     game row, portrait), the store handle (`store`/`commit`), the server read (`ladderLoad`, with its cache) and the Circuit's words.
   The sibling file ui/circuit-play.js holds C5-C8 and the F-screen hooks; it reaches these parts as DawnUICircuitView.parts.

   HONESTY (the doc's contract): every number is a finished game's (the store) or the server's own row. No request on open at C1 (it shows the
   cache with its age; REFRESH asks once); C4 is an explicit destination and loads on open. Looking never signs anyone in: the identity is
   passed only when the phone already has one (`known()`), exactly as the classic page.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUICircuitView = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

var P = root.htmPreact || {};
var html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
var CC = function(){ return root.DawnCircuit; };
var KF = function(){ return root.DawnUIFlow; };

/* ---------------- the Circuit's own icons (the mockups' symbols; the flow's own sprite supplies back, next, check, pad, x, board, flag, book) ---------------- */
var SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="cx-i-up3" viewBox="0 0 24 24"><path d="M12 5l8 13H4z" fill="currentColor"/></symbol><symbol id="cx-i-dn3" viewBox="0 0 24 24"><path d="M12 19L4 6h16z" fill="currentColor"/></symbol><symbol id="cx-i-eq3" viewBox="0 0 24 24"><path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol><symbol id="cx-i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 012-2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="cx-i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="cx-i-road" viewBox="0 0 24 24"><path d="M9 3L5 21M15 3l4 18M12 5v3M12 11v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol><symbol id="cx-i-sun" viewBox="0 0 24 24"><circle cx="12" cy="14" r="5" fill="currentColor"/><path d="M12 3v3M4.5 7l2 2M19.5 7l-2 2M2 18h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="cx-i-cal" viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="cx-i-off" viewBox="0 0 24 24"><path d="M3 9a14 14 0 0118 0M6.5 12.5a9 9 0 0111 0M10 16a4 4 0 014 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol><symbol id="cx-i-ladder" viewBox="0 0 24 24"><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol><symbol id="cx-i-heroes" viewBox="0 0 24 24"><circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.700 2 7.500 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="cx-i-seal" viewBox="0 0 24 24"><path d="M12 2.5l2.4 1.7 3-.2.9 2.8 2.5 1.7-1 2.8 1 2.8-2.500 1.7-.9 2.800-3-.2L12 21.500l-2.400-1.700-3 .2-.9-2.800L3.200 15.500l1-2.800-1-2.800L5.700 8.200l.9-2.800 3 .2z" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linejoin="round"/><path d="M8.500 12.200l2.500 2.500 4.500-5" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-m-circuit" viewBox="0 0 48 48"><path d="M3 38h42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 38L20 24M34 38L28 24M24 38V30" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/><path d="M12 38c0-9 5-14 12-14s12 5 12 14" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="15" r="6.5" fill="#F2C66E"/><path d="M24 3v3.5M13 8l2.500 2.500M35 8l-2.500 2.500M7 17h3.500M37.500 17H41" stroke="#F2C66E" stroke-width="2.600" stroke-linecap="round"/></symbol></defs></svg>';
var OWN = {up3: 1, dn3: 1, eq3: 1, copy: 1, trash: 1, road: 1, sun: 1, cal: 1, off: 1, ladder: 1, heroes: 1, seal: 1};
function Sprite(){ return html`<div class="cx-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" dangerouslySetInnerHTML=${{__html: SPRITE}}></div>`; }
function Ic(n, px){ return html`<svg class="ico" style=${px ? "width:" + px + "px;height:" + px + "px" : ""}><use href=${"#" + (OWN[n] ? "cx-i-" : "fl-i-") + n}/></svg>`; }

/* ---------------- heroes and words ---------------- */
var heroes = function(){ return root.HEROES || []; };
var heroOf = function(k){ return heroes().filter(function(h){ return h.k === k; })[0] || null; };
var shortOf = function(h){ return h ? (h.short || String(h.n || "").split(",")[0]) : ""; };
var hname = function(k){ return k === "dummy" ? "The Dummy" : (heroOf(k) ? shortOf(heroOf(k)) : String(k || "").replace(/^./, function(c){ return c.toUpperCase(); })); };
var first = function(k){ var h = heroOf(k); return h ? String(h.n || "").split(/[ ,]/)[0] : hname(k); };
var art = function(k){ var K = KF(); return K && k !== "dummy" ? K.catalog.art(k) : null; };
var pad2 = function(n){ return (n < 10 ? "0" : "") + n; };
var plural = function(n, one, many){ return n + " " + (n === 1 ? one : many || one + "s"); };
var NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
var numw = function(n){ return n >= 0 && n <= 10 ? NUMW[n] : String(n); };
var cap1 = function(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
var WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "just now" / "N min ago" / "N h ago" up to 48 h / "N d ago" (the classic page's `ladAgo` rhythm); `ladAgo` is the classic's own words, for the ladder */
function ago(at, now){
  var m = Math.floor(Math.max(0, (now == null ? Date.now() : now) - at) / 60000);
  if(m < 1) return "just now";
  if(m < 60) return m + " min ago";
  var h = Math.floor(m / 60);
  return h < 48 ? h + " h ago" : Math.floor(h / 24) + " d ago";
}
function ladAgo(at, now){
  var m = Math.floor(Math.max(0, (now == null ? Date.now() : now) - at) / 60000);
  if(m < 1) return "just now";
  if(m < 60) return m + " min ago";
  var h = Math.floor(m / 60);
  return h < 48 ? h + (h === 1 ? " hour ago" : " hours ago") : Math.floor(h / 24) + " days ago";
}
function agoLong(ms){
  var h = Math.floor(ms / 3600000);
  return h < 1 ? Math.max(1, Math.floor(ms / 60000)) + " min" : h < 48 ? plural(h, "hour") : plural(Math.floor(h / 24), "day");
}
function clock(at){ var d = new Date(at); return d.getHours() + ":" + pad2(d.getMinutes()); }
function dayKey(at){ var d = new Date(at); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function dayHead(at, now){
  var t = dayKey(now == null ? Date.now() : now), y = dayKey((now == null ? Date.now() : now) - 86400000), k = dayKey(at), d = new Date(at);
  return k === t ? "Today" : k === y ? "Yesterday" : WEEKDAY[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTH[d.getMonth()];
}
var RES = {w: ["w", "WON"], l: ["l", "LOST"], d: ["d", "DREW"]};
var lineOf = function(t){ return t.w + "–" + t.l + (t.d > 0 ? "–" + t.d : ""); };
var HOWW = {stalemate: "Dead position", forfeit: "They left the table"};
function howWord(g){
  if(g.how === "concession") return g.result === "w" ? "They conceded" : "You conceded";
  if(g.how === "forfeit") return g.result === "w" ? "They left the table" : "The clock ran out";
  return g.how === "stalemate" ? HOWW.stalemate : "";
}
/* the sentence under a game row: `<kind> · turn N · [N left ·] <when>` */
function kindWord(g, long){
  var ai = g.level === "steady" ? "Steady AI" : "Sharp AI";
  if(g.kind === "dummy") return "Training";
  if(g.kind === "daily") return "Daily";
  if(g.kind === "road") return long ? "Road · " + ai : ai;
  if(g.kind === "friend") return "Friendly table";
  if(g.kind === "ranked") return "Ranked";
  return ai;
}
function rowSub(g, mode, now){
  var how = howWord(g), parts = [how && g.how !== "life" && g.result === "d" ? how : kindWord(g, mode === "list")];
  if(how && g.result !== "d") parts.push(how);
  parts.push("turn " + g.turns);
  if(mode === "list" && g.result === "w" && g.how === "life" && g.life[0] > 0) parts.push(g.life[0] + " left");
  parts.push(mode === "list" ? clock(g.at) : ago(g.at, now));
  return parts.join(" · ");
}

/* ---------------- the store handle: ONE copy of the Circuit's local store for the page, read through DawnCircuit, written once per commit ---------------- */
var _store = null, _subs = [], _saveFailed = false;
function store(){ if(!_store && CC()) _store = CC().load(); return _store || (CC() ? CC().empty() : null); }
function notify(){ _subs.slice().forEach(function(f){ try { f(); } catch(e){} }); }
function commit(s){ _store = s; var ok = CC().save(s); _saveFailed = !ok; notify(); return ok; }
function reload(){ _store = null; notify(); }
function useStore(){
  var st = useState(0), bump = function(){ st[1](function(n){ return n + 1; }); };
  useEffect(function(){ _subs.push(bump); return function(){ _subs = _subs.filter(function(f){ return f !== bump; }); }; }, []);
  return store();
}
function wipe(){
  try { root.localStorage.removeItem(CC().KEY); root.localStorage.removeItem(CC().CACHE_KEY); } catch(e){}
  _store = null; _net.r = null; _net.state = "idle"; notify();
}
function legacy(){ try { return CC().legacyRead(); } catch(e){ return {ai: {w: 0, l: 0, d: 0}, people: {w: 0, l: 0, d: 0}, best: {}, mine: {}}; } }

/* ---------------- the server's read (the cache, the call): `DawnServerTable.ladder`, as the classic page's SrvLadder ---------------- */
var _net = {state: "idle", r: null, at: 0, subs: []};
function readCache(){
  try { var o = JSON.parse(root.localStorage.getItem(CC().CACHE_KEY) || "null"); return o && o.v === 1 && typeof o.at === "number" ? o : null; } catch(e){ return null; }
}
function writeCache(r){
  try { root.localStorage.setItem(CC().CACHE_KEY, JSON.stringify({v: 1, at: Date.now(), you: r.you || null, mine: r.mine || null})); } catch(e){}
}
function serverRoute(){
  var ST = root.DawnServerTable, S = root.DawnUISession;
  if(!ST || !S || !root.SERVER_TABLE || !S.modes(root).server) return null;
  var transport = ST.defaultTransport(root.SERVER_TABLE), who = ST.defaultIdentity(root.SERVER_TABLE, S.pageStore(root));
  var signedIn = !!who && (typeof who.known !== "function" || who.known());
  return {ST: ST, o: Object.assign({transport: transport}, signedIn ? {identity: who} : {})};
}
function netTell(){ _net.subs.slice().forEach(function(f){ try { f(); } catch(e){} }); notify(); }
/* one read of the ladder: -> Promise of the ladder, or rejects. Looking never signs anyone in. */
function ladderLoad(){
  var rt = serverRoute();
  _net.state = "loading"; netTell();
  var p = rt ? rt.ST.ladder(rt.o) : Promise.reject(new Error("no server table"));
  return p.then(function(r){ _net.r = r; _net.state = "ok"; _net.at = Date.now(); writeCache(r); netTell(); return r; },
    function(e){ _net.state = "fail"; netTell(); throw e; });
}
function useNet(){
  var st = useState(0);
  useEffect(function(){ var f = function(){ st[1](function(n){ return n + 1; }); }; _net.subs.push(f); return function(){ _net.subs = _net.subs.filter(function(g){ return g !== f; }); }; }, []);
  return _net;
}
/* what the Circuit knows of the server right now: the live read, else the cache (with its age) */
function serverNow(){
  if(_net.r) return {you: _net.r.you, mine: _net.r.mine || null, at: _net.at, live: true};
  var c = readCache();
  return c ? {you: c.you, mine: c.mine, at: c.at, live: false} : null;
}

/* ---------------- shared parts ---------------- */
function Hdr(p){
  return html`<div class="hdr" style="height:60px"><button class="ib" aria-label="Back" data-tap data-b="back" onClick=${p.onBack}>${Ic("back")}</button><h1><span class="sub">${p.sub}</span>${p.title}</h1></div>`;
}
function Seg(p){
  return html`<div class=${"cx-seg" + (p.two ? " two" : "")} role="tablist" data-b="seg">${p.tabs.map(function(t, i){
    return html`<button role="tab" aria-selected=${i === p.active ? "true" : "false"} class=${i === p.active ? "on" : ""} data-tap data-b=${"tab-" + t.id} onClick=${function(){ if(i !== p.active) p.onGo(t.id); }}>${t.label}</button>`; })}</div>`;
}
var RECORD_TABS = [{id: "c1", label: "You"}, {id: "c2", label: "Heroes"}, {id: "c3", label: "Games"}];
function Pips(p){
  var out = [], n = p.n | 0, names = CC().RANKS;
  for(var i = 0; i < 5; i++) out.push(html`<svg class=${"pip" + (i < n ? " on" : "")} width=${p.px} height=${p.px} viewBox="0 0 24 24"><path d="M12 2L22 12 12 22 2 12z"/></svg>`);
  return html`<span class="pips" style=${"gap:" + (p.gap == null ? 2 : p.gap) + "px"} role="img" aria-label=${"Mastery " + n + " of 5, " + names[n].toLowerCase()}>${out}</span>`;
}
function Pt(p){
  var u = art(p.k);
  return html`<span class=${"pt" + (p.cls ? " " + p.cls : "")} style=${"--s:" + (p.s || 44) + "px;" + (u ? "background-image:url(" + u + ")" : "") + (p.pos ? ";background-position:" + p.pos : "")}>${p.children}</span>`;
}
function Mv(p){
  var d = p.d, k = d > 0 ? "up" : d < 0 ? "dn" : "lv";
  return html`<span class=${"mv " + k + (p.big ? " big" : "")} role="img" aria-label=${d > 0 ? "Rating up " + d : d < 0 ? "Rating down " + (-d) : "Rating unchanged"}>${Ic(d > 0 ? "up3" : d < 0 ? "dn3" : "eq3", p.big ? 20 : 14)}<b>${d > 0 ? "+" + d : d < 0 ? "−" + (-d) : "±0"}</b></span>`;
}
function Empty(p){ return html`<div class="cx-card"><div class="empty"><div class="sunm"><i></i><b></b></div><div class="ttl2">${p.title}</div><p class="t13" style=${"max-width:" + (p.w || 290) + "px"}>${p.text}</p></div></div>`; }
function Sheet(p){
  return html`<div class="scrimf full" data-b="scrim" onClick=${p.onClose}></div><div class="sheet cs" data-b=${p.b} style="padding:18px 16px 16px;border-radius:16px 16px 0 0">${p.children}</div>`;
}
/* one game, as C1 and C3 draw it (`mode` "recent": when = ago; "list": time of day and life left) */
function Gm(p){
  var g = p.g, r = RES[g.result], tag = g.kind === "daily" ? "Daily" : g.kind === "road" ? "Road" : null;
  var Tag = p.onClick ? "button" : "div";
  var mv = g.kind === "ranked" && g.rating ? html`<${Mv} d=${g.rating.to - g.rating.from}/>` : tag ? html`<span class="tag br">${tag}</span>` : null;
  return html`<${Tag} class="gm" data-tap=${p.onClick ? "" : undefined} data-b="game" onClick=${p.onClick}><span class=${"rs " + r[0]}>${r[1]}</span><span class="sp"><div class="tt">${hname(g.me)}<i>vs</i>${hname(g.foe)}</div><div class="ss">${rowSub(g, p.mode, p.now)}</div></span>${mv}<//>`;
}
function HeroOrder(){ return heroes().map(function(h){ return h.k; }); }

/* ============================================================
   C1 Your record
   ============================================================ */
/* the rating's path over the server's last games: points[i] is the rating after game i (oldest first), start before the first */
function ratingPath(you, mine){
  if(!you || !mine || !mine.length) return null;
  var rows = mine.slice(0, 10).reverse(), total = rows.reduce(function(a, x){ return a + x.change; }, 0), v = you.rating - total, pts = [v];
  rows.forEach(function(x){ v += x.change; pts.push(v); });
  return {pts: pts, from: pts[0], to: you.rating, move: total, n: rows.length};
}
function Spark(p){
  var pts = p.pts, lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), span = Math.max(1, hi - lo), n = pts.length - 1;
  var xy = pts.map(function(v, i){ return [n ? 6 + i * (341 / n) : 176, n ? 56 - (v - lo) * 48 / span : 32]; });
  var d = xy.map(function(a){ return a[0].toFixed(0) + "," + a[1].toFixed(0); }).join(" ");
  return html`<svg viewBox="0 0 353 64" width="100%" height="64" role="img" aria-label=${"Your rating went from " + p.from + " to " + p.to + " over your last " + n + " ranked games"}>
    <polyline points=${d} fill="none" stroke="var(--brass-hi)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map(function(a, i){ return html`<circle cx=${a[0].toFixed(0)} cy=${a[1].toFixed(0)} r=${i === xy.length - 1 ? 4.5 : 2.4} fill=${i === xy.length - 1 ? "var(--brass-hi)" : "var(--ink-2)"}/>`; })}</svg>`;
}
function rankedCard(p){
  var srv = p.srv, you = srv && srv.you, nav = p.nav, offline = p.offline, age = srv && !srv.live ? Date.now() - srv.at : 0;
  if(!you || you.games === 0){
    return html`<div class="cx-card"><div class="row"><h2 class="ct">Ranked</h2><span class="sp"></span><span class="mono i1">Not rated yet</span></div>
      <div class="row" style="margin-top:8px;align-items:flex-end"><span class="nn" style="color:var(--ink-2)">1200</span><span class="sp"></span><span class="mono" style="text-align:right">Where everyone starts</span></div>
      <p class="t13" style="margin-top:10px">Open a ranked table and pick a player name. Your rating, your place on the ladder and your last ten ranked games gather here. It is free, and always will be.</p>
      <div class="row" style="margin-top:10px;gap:10px"><button class="btn sec sm sp" style="min-width:0" data-tap data-b="find" onClick=${nav.findOpponent}>Find an opponent</button><button class="btn sec sm sp" style="min-width:0" data-tap data-b="see-ladder" onClick=${function(){ nav.go("c4"); }}>See the ladder</button></div></div>`;
  }
  var path = ratingPath(you, srv.mine), peak = p.peak;
  return html`<div class="cx-card" style=${offline ? "opacity:.92" : ""} onClick=${p.onRefresh} data-b="ranked-card">
    <div class="row"><h2 class="ct">Ranked${age ? html` <span style="color:var(--ink-2)">· as of ${agoLong(age)} ago</span>` : null}</h2><span class="sp"></span>${you.listed && you.rank != null && !offline ? html`<span class="mono i1">#${you.rank} on the ladder</span>` : null}</div>
    <div class="row" style="margin-top:8px;align-items:flex-end"><span class="nn" aria-label=${"Rating " + you.rating}>${you.rating}</span><span class="sp"></span>
      ${path ? html`<span style="text-align:right"><${Mv} d=${path.move} big=${true}/><div class="mono" style="margin-top:6px">over ${plural(path.n, "game")}</div></span>` : null}</div>
    ${path && !offline ? html`<div style="margin-top:8px"><${Spark} pts=${path.pts} from=${path.from} to=${path.to}/></div><div class="row" style="justify-content:space-between"><span class="mono">${path.from}</span><span class="mono">${path.to}</span></div>` : null}
    <div class="row" style="margin-top:8px"><span class="t13"><b>${you.wins}</b> won · <b>${you.losses}</b> lost${offline ? (you.listed && you.rank != null ? " · #" + you.rank + " on the ladder then" : "") : html` · peak <b>${peak}</b> on this phone`}</span>${offline ? null : html`<span class="sp"></span><button class="btn sec sm" style="min-width:0;padding:0 16px" data-tap data-b="ladder" onClick=${function(e){ e.stopPropagation(); nav.go("c4"); }}>Ladder</button>`}</div></div>`;
}
function bestTiles(s, srv, lg){
  var b = CC().bests(s, {rating: srv && srv.you ? srv.you.rating : null, best: lg.best}), st = CC().streak(s, CC().dayOf());
  var dummyHero = null, dv = null;
  Object.keys(lg.best || {}).forEach(function(k){ if(dv == null || lg.best[k] < dv){ dv = lg.best[k]; dummyHero = k; } });
  var run = Math.max(b.streak || 0, st.cur), no = "Not yet";
  return [
    {k: "Fastest win", v: b.fastWin ? b.fastWin.turns : null, u: "TURNS", p: b.fastWin ? hname(b.fastWin.me) + " vs " + hname(b.fastWin.foe) : no},
    {k: "Closest win", v: b.closeWin ? b.closeWin.life : null, u: "LIFE LEFT", p: b.closeWin ? hname(b.closeWin.me) + " vs " + hname(b.closeWin.foe) : no},
    {k: "Longest winning run", v: b.run > 0 ? b.run : null, u: "GAMES", p: b.run > 0 ? "In a row, at any table" : no},
    {k: "Peak rating", v: b.peak, u: "", p: b.peak != null ? "Seen on this phone" : no},
    {k: "Dummy, fastest clear", v: b.dummy, u: "TURNS", p: b.dummy != null ? (dummyHero ? hname(dummyHero) : "") : no},
    {k: "Daily, best run", v: run > 0 ? run : null, u: "DAYS", p: run > 0 ? (st.cur > 0 ? cap1(numw(st.cur)) + (st.cur === 1 ? " day" : " days") + " running now" : "Not running today") : no}
  ];
}
function C1(p){
  var nav = p.nav, s = useStore(), net = useNet(), ui = useState(p.sheet || null), sheet = ui[0], setSheet = ui[1], said = useState(""), msg = said[0], setMsg = said[1];
  var lg = legacy(), srv = serverNow(), offline = net.state === "fail" && !!srv && !srv.live;
  var tl = CC().tallies(s, lg, srv && srv.you ? {you: srv.you} : null);
  var total = tl.total.w + tl.total.l + tl.total.d, fresh = !s.games.length && !(lg.ai.w + lg.ai.l + lg.ai.d + lg.people.w + lg.people.l + lg.people.d) && !(srv && srv.you && srv.you.games > 0);
  var refresh = function(){ if(net.state !== "loading") ladderLoad().then(null, function(){}); };
  var recent = s.games.slice().sort(function(a, b){ return b.at - a.at; }).slice(0, 5), now = Date.now();
  var copy = function(){
    var t = "DAWNBLADE-RECORD 1 " + JSON.stringify(Object.assign({}, s, {flag: undefined}));
    try { root.navigator.clipboard.writeText(t).then(function(){ setMsg("Copied"); }, function(){ setMsg("Could not copy here"); }); } catch(e){ setMsg("Could not copy here"); }
  };
  var tiles = bestTiles(s, srv, lg);
  var body;
  if(fresh) body = html`<div class="sc" style="top:116px;bottom:76px"><div class="scin">
      <${Empty} title="Your record starts here" text="Every game you finish is kept on this phone: who you played, who won, and how it went. Nothing is counted that you did not play." w=${290}/>
      <div class="cx-card"><div class="row"><h2 class="ct">Ranked</h2><span class="sp"></span><span class="mono i1">Not rated yet</span></div><p class="t13" style="margin-top:8px">Everyone starts at 1200. Play at a ranked table to be rated.</p></div></div></div>
    <div class="hub"><button class="btn" data-tap data-b="play" onClick=${nav.toWays}>Play a game</button></div>`;
  else body = html`<div class="sc" style="top:116px;bottom:0"><div class="scin">
      ${s.flag === "unavailable" || _saveFailed || s.flag === "newer" || s.flag === "corrupt" ? html`<div class="note warn" role="status" data-b="nosave">${Ic("off", 22)}<div class="t13">${s.flag === "newer" ? "A newer version of the game owns this record, so this page will not change it." : s.flag === "corrupt" ? "The record kept on this phone could not be read, so it starts empty here." : "This phone is not letting the game save. Your record will not be kept after you close the page."}</div></div>` : null}
      ${offline ? html`<div class="note warn" role="status">${Ic("off", 22)}<div><div class="ttl3" style="font-size:16px;line-height:18px">Showing your ranked games as of ${agoLong(Date.now() - srv.at)} ago</div><div class="t13" style="margin-top:3px">The server is not answering right now. Everything else here is kept on this phone and is current.</div><button class="link2" style="margin-top:2px;padding:0" data-tap data-b="retry" onClick=${refresh}>Try again</button></div></div>` : null}
      ${rankedCard({srv: srv, nav: nav, offline: offline, peak: tiles[3].v != null ? tiles[3].v : 1200, onRefresh: refresh})}
      <div class="cx-card" style="padding:14px 0 4px"><div class="row" style="padding:0 14px 8px"><h2 class="ct">The record</h2><span class="sp"></span><span class="mono i1">${plural(total, "game")}</span></div>
        <div class="row" style="padding:0 14px 10px;gap:18px"><span><span class="nn m">${tl.total.w}</span><div class="mono">won</div></span><span><span class="nn m">${tl.total.l}</span><div class="mono">lost</div></span><span><span class="nn m">${tl.total.d}</span><div class="mono">drawn</div></span></div>
        <div class="rowl"><span class="k">Against the AI</span><span class="v">${lineOf(tl.ai)}</span></div>
        <div class="rowl"><span class="k">Against people</span><span class="v">${lineOf(tl.people)}</span></div>
        ${tl.ranked ? html`<div class="rowl"><span class="k">Ranked <span class="mono">from the server</span></span><span class="v">${lineOf(tl.ranked)}</span></div>` : null}
        <div class="rowl"><span class="k">The Dummy</span><span class="v">${lineOf(tl.dummy)}</span></div></div>
      <div><div class="row" style="padding:2px 4px 8px"><h2 class="ct">Personal bests</h2></div><div class="tiles">${tiles.map(function(t){
        return html`<div class="tile2"><span class="mono">${t.k}</span><b>${t.v != null ? t.v : "–"}${t.v != null && t.u ? html`<small>${t.u}</small>` : null}</b><p>${t.p}</p></div>`; })}</div></div>
      <div><div class="row" style="padding:2px 4px 0"><h2 class="ct">Recent games</h2><span class="sp"></span><button class="link2" data-tap data-b="all-games" onClick=${function(){ nav.go("c3"); }}>All games ${Ic("next", 18)}</button></div>
        <div class="lst">${recent.length ? recent.map(function(g){ return html`<${Gm} g=${g} mode="recent" now=${now}/>`; }) : html`<div class="gm"><span class="sp"><div class="ss">Nothing yet</div></span></div>`}</div></div>
      <div class="cx-card" style="padding:12px 14px"><div class="t13" style="margin-bottom:8px">Everything above is kept only on this phone. Ranked games are kept by the server.</div>
        <div class="row" style="gap:10px"><button class="btn sec sm sp" style="min-width:0" data-tap data-b="save" onClick=${function(){ setMsg(""); setSheet("manage"); }}>${Ic("copy", 20)}Save a copy</button><button class="btn sec sm dng sp" style="min-width:0" data-tap data-b="erase" onClick=${function(){ setSheet("erase"); }}>${Ic("trash", 20)}Erase</button></div></div></div></div>`;
  return html`<div class="scr cx c1" data-b="c1"><${Sprite}/><div class="frame">
    <${Hdr} sub="Kept on this phone" title="Your record" onBack=${nav.toTitle}/><${Seg} tabs=${RECORD_TABS} active=${0} onGo=${nav.go}/>
    <div class="vw">${body}
      ${sheet === "manage" ? html`<${Sheet} b="manage-sheet" onClose=${function(){ setSheet(null); }}><div class="ttl2">Save a copy</div>
        <p class="t13" style="margin-top:8px;color:var(--ink-1);font-size:15px;line-height:21px">Copies your whole record as plain text. Paste it into a note to keep it, or to move to another phone later. It holds heroes, results and dates, no names.</p>
        <button class="btn" style="width:100%;margin-top:16px" data-tap data-b="copy" onClick=${copy}>${msg || "Copy my record"}</button><button class="btn sec" style="width:100%;margin-top:10px" data-tap data-b="not-now" onClick=${function(){ setSheet(null); }}>Not now</button><//>` : null}
      ${sheet === "erase" ? html`<${Sheet} b="erase-sheet" onClose=${function(){ setSheet(null); }}><div class="ttl2">Erase your record?</div>
        <p class="t13" style="margin-top:8px;color:var(--ink-1);font-size:15px;line-height:21px">This clears every game, mastery mark, road clear and daily result kept on this phone. Ranked games and your rating are kept by the server and stay. This cannot be undone.</p>
        <button class="btn" style="width:100%;margin-top:16px" data-tap data-b="keep" onClick=${function(){ setSheet(null); }}>Keep my record</button>
        <button class="btn sec dng" style="width:100%;margin-top:10px" data-tap data-b="erase-all" onClick=${function(){ wipe(); setSheet(null); }}>Erase everything</button><//>` : null}
    </div></div></div>`;
}

/* ============================================================
   C2 Heroes and mastery
   ============================================================ */
/* a hero's own W-L-D over every game it played (the ranked receipts and the folded counts included) */
function heroLine(s, k){
  var t = {w: 0, l: 0, d: 0};
  s.games.forEach(function(g){ if(g.me === k) t[g.result]++; });
  Object.keys(s.folded || {}).forEach(function(kind){ var c = s.folded[kind][k]; if(c){ t.w += c.w; t.l += c.l; t.d += c.d; } });
  return t;
}
function heroRows(s){
  var hs = heroes();
  var rows = hs.map(function(h, i){ var m = CC().mastery(s, h.k, hs), ln = heroLine(s, h.k); return {h: h, i: i, m: m, ln: ln, n: ln.w + ln.l + ln.d}; });
  rows.sort(function(a, b){ return (b.n - a.n) || (a.i - b.i); });
  return rows;
}
function sheetSentence(m, k){
  var left = m.n - m.beat, nx = m.next;
  if(!nx) return html`<b>Every foe beaten</b> with ${first(k)} against the Sharp AI. This is the Dawnblade.`;
  var goal = m.rank < 3 ? m.need.proven : nx.need, more = Math.max(0, goal - m.beat), word = m.rank < 3 ? "Proven" : cap1(nx.name.toLowerCase());
  return html`<b>${m.beat} of ${m.n}</b> foes beaten with ${first(k)} against the Sharp AI. <b>${more} more</b> for ${word}.`;
}
function C2(p){
  var nav = p.nav, s = useStore(), ui = useState(p.sheet || null), sel = ui[0], setSel = ui[1], hs = heroes();
  var rows = heroRows(s), tried = rows.filter(function(r){ return r.n > 0; }).length, proven = rows.filter(function(r){ return r.m.rank >= 3; }).length;
  var row = function(r, plain){
    var h = r.h, none = r.n === 0;
    var inner = html`<${Pt} k=${h.k}/><span class="sp" style="text-align:left"><div class="ttl3">${shortOf(h)}</div>${plain ? null : html`<div class="mono" style="margin-top:2px">${h.cls}</div>`}
      <div class="row" style="gap:8px;margin-top:5px"><${Pips} n=${r.m.rank} px=${12} gap=${2}/><span class=${"mono " + (r.m.rank >= 1 ? "br" : "")}>${plain ? cap1(CC().RANKS[r.m.rank].toLowerCase()) : CC().RANKS[r.m.rank]}</span></div></span>`;
    if(plain) return html`<div class="hrow none">${inner}</div>`;
    return html`<button class=${"hrow" + (none ? " none" : "")} data-tap data-b=${"hero-" + h.k} onClick=${function(){ setSel(h.k); }}>${inner}
      <span style="text-align:right"><div class="ttl2" style="font-size:24px">${none ? "–" : lineOf(r.ln)}</div><div class="mono">${none ? "not played" : r.m.beat + " of " + r.m.n + " foes"}</div></span>${Ic("next", 20)}</button>`;
  };
  var empty = tried === 0;
  var sh = sel ? rows.filter(function(r){ return r.h.k === sel; })[0] : null;
  var sheet = null;
  if(sh){
    var m = sh.m, h = sh.h, beat = (s.marks.beat[h.k] || []), nextFoe = (hs.filter(function(x){ return beat.indexOf(x.k) < 0; })[0] || {}).k;
    var th = [["Sparred", "1 game"], ["Blooded", "1 win"], ["Proven", m.need.proven + " foes"], ["Master", m.need.master + " foes"], ["Dawnblade", m.need.dawnblade + " foes"]];
    sheet = html`<div class="scrimf full" data-b="scrim" onClick=${function(){ setSel(null); }}></div>
      <div class="sheet cs f3 pk" data-b="hero-sheet" style="top:92px;overflow:hidden">
        <div class="ban" style=${"height:150px;background-size:140% auto;background-position:50% 22%;" + (art(h.k) ? "background-image:url(" + art(h.k) + ")" : "")}><button class="ib dk" aria-label="Close" data-tap data-b="sheet-close" onClick=${function(){ setSel(null); }}>${Ic("x")}</button></div>
        <div class="bshade" style="height:150px;inset:0 0 auto 0;background:linear-gradient(to top,var(--mat-3) 0,rgba(32,43,48,.6) 24%,transparent 58%)"></div>
        <div class="bn" style="top:92px;bottom:auto"><b>${shortOf(h)}</b><span class="mono" style="color:var(--ink-1)">${h.cls} · Chapter ${h.ch}</span></div>
        <div class="sc" style="position:absolute;left:0;right:0;top:154px;bottom:86px"><div style="padding:6px 16px 16px">
          <div class="row" style="gap:10px"><${Pips} n=${m.rank} px=${26} gap=${4}/><span class="ttl2" style="font-size:26px;line-height:26px">${cap1(m.name.toLowerCase())}</span><span class="sp"></span><span class="ttl2" style="font-size:22px">${sh.n ? lineOf(sh.ln) : "–"}</span></div>
          <div class="thr">${th.map(function(t, i){ return html`<span class=${m.rank >= i + 1 ? "on" : ""}>${t[0]}<small>${t[1]}</small></span>`; })}</div>
          <p class="t13" style="margin-top:8px;font-size:14px;line-height:19px">${sheetSentence(m, h.k)}</p>
          <div class="mono" style="margin:14px 0 8px">Your book · a tick means beaten</div>
          <div class="fg">${hs.map(function(x){
            var done = beat.indexOf(x.k) >= 0;
            return html`<div class=${"f" + (done ? "" : " no")}><${Pt} k=${x.k}>${done ? html`<span class="ck"><svg><use href="#fl-i-check"/></svg></span>` : null}<//><span class="mono">${x.k === h.k ? "Mirror" : first(x.k)}</span></div>`; })}</div></div></div>
        <div class="sitbar"><button class="btn" style="width:100%;max-width:370px" data-tap data-b="sit" onClick=${function(){ nav.sitAs(h.k, nextFoe && nextFoe !== h.k ? nextFoe : null); }}>Sit down as ${first(h.k)}</button></div></div>`;
  }
  return html`<div class="scr cx c2 f3" data-b="c2"><${Sprite}/><div class="frame">
    <${Hdr} sub="Mastery, from your side" title="Heroes" onBack=${nav.toTitle}/><${Seg} tabs=${RECORD_TABS} active=${1} onGo=${nav.go}/>
    <div class="vw">
      ${empty ? html`<div class="sc" style="top:114px;bottom:0"><div class="scin"><${Empty} title="No hero has your mark yet" text="Sit down with any hero. Beat every other hero's deck with it, one by one, and it earns its marks, up to the Dawnblade." w=${300}/>
          <div class="lst">${rows.slice(0, 6).map(function(r){ return row(r, true); })}</div></div></div>`
        : html`<div class="sc" style="top:152px;bottom:0"><div class="lst flat">${rows.map(function(r){ return row(r, false); })}</div><div class="dayh" style="height:40px;align-items:center;justify-content:center">${hs.length} heroes · more join as they are built</div></div>
          <div style="position:absolute;left:var(--gut);right:var(--gut);top:114px;height:30px;display:flex;align-items:center" class="row"><span class="mono i1">Played with ${tried} of ${hs.length} · ${proven} proven or better</span></div>`}
      ${sheet}
    </div></div></div>`;
}

/* ============================================================
   C3 Games
   ============================================================ */
var FILTERS = [["all", "All"], ["ai", "AI"], ["people", "People"], ["ranked", "Ranked"], ["daily", "Daily"], ["road", "Road"], ["dummy", "Dummy"]];
function passes(f, g){
  if(f === "all") return true;
  if(f === "ai") return g.kind === "ai" || g.kind === "road" || g.kind === "daily";
  if(f === "people") return g.kind === "friend";
  return g.kind === f;
}
var NOUN = {ai: "AI games", people: "games against people", ranked: "ranked games", daily: "daily games", road: "road games", dummy: "Dummy games"};
/* the server's last ten as game-shaped rows, with the local receipts the server list already holds shown once (same two heroes, same result, within 120 s) */
function rankedRows(s, srv){
  var mine = srv && srv.mine ? srv.mine : [], R = {won: "w", lost: "l", drew: "d"};
  var rows = mine.map(function(x){ return {src: "srv", at: x.at, g: {id: "srv" + x.at, at: x.at, kind: "ranked", me: x.hero, foe: x.foeHero, result: R[x.result], how: x.how, turns: 0, life: [0, 0], first: 0, rating: {from: 0, to: x.change}, change: x.change}, name: x.foe}; });
  s.games.filter(function(g){ return g.kind === "ranked"; }).forEach(function(g){
    var dup = rows.some(function(r){ return r.g.me === g.me && r.g.foe === g.foe && r.g.result === g.result && Math.abs(r.at - g.at) <= 120000; });
    if(!dup) rows.push({src: "loc", at: g.at, g: g, change: g.rating ? g.rating.to - g.rating.from : 0});
  });
  return rows.sort(function(a, b){ return b.at - a.at; });
}
function C3(p){
  var nav = p.nav, s = useStore(), net = useNet(), ui = useState(p.filter || "all"), f = ui[0], setF = ui[1];
  var lim = useState(40), limit = lim[0], setLimit = lim[1], det = useState(p.detail || null), detail = det[0], setDetail = det[1];
  var now = Date.now(), srv = serverNow();
  var list = f === "ranked" ? null : s.games.filter(function(g){ return passes(f, g); }).sort(function(a, b){ return b.at - a.at; });
  var rr = f === "ranked" ? rankedRows(s, srv) : null;
  var more = function(e){ var el = e.currentTarget; if(list && limit < list.length && el.scrollHeight - el.scrollTop - el.clientHeight < 240) setLimit(limit + 40); };
  var shown = list ? list.slice(0, limit) : [], groups = [];
  shown.forEach(function(g){ var h = dayHead(g.at, now), last = groups[groups.length - 1]; if(last && last.h === h) last.g.push(g); else groups.push({h: h, g: [g]}); });
  var emptyText = f === "all" ? ["No games here yet", "Finished games land here the moment they end, one line each, from your side of the table."]
    : f === "ranked" ? ["No ranked games yet", "Open a ranked table and they gather here, with how your rating moved."] : ["No " + NOUN[f] + " yet", "Finished games land here the moment they end, one line each, from your side of the table."];
  var none = f === "ranked" ? !rr.length : !list.length;
  var body;
  if(none) body = html`<div class="sc" style="top:164px;bottom:76px"><div class="scin"><${Empty} title=${emptyText[0]} text=${emptyText[1]}/></div></div><div class="hub"><button class="btn" data-tap data-b="play" onClick=${nav.toWays}>Play a game</button></div>`;
  else if(f === "ranked") body = html`<div class="sc" style="top:164px;bottom:0"><div class="scin" style="padding-top:0"><div class="note" style="margin-top:2px">${Ic("heroes", 22)}<div class="t13">The server keeps your last <b>ten</b> ranked games. Older ones count in your rating but cannot be listed.</div></div>
      <div class="lst">${rr.map(function(r){
        var g = r.g, how = r.src === "srv" ? cap1(r.g.how === "life" ? "on life" : r.g.how === "stalemate" ? "a dead position" : r.g.how === "concession" ? (g.result === "w" ? "they conceded" : "you conceded") : g.result === "w" ? "they left the table" : "the clock ran out") : howWord(g) || "On life";
        var d = r.change;
        return html`<button class="gm" data-tap data-b="game" onClick=${function(){ setDetail(r.src === "loc" ? g.id : null); }}><span class=${"rs " + RES[g.result][0]}>${RES[g.result][1]}</span><span class="sp"><div class="tt">${hname(g.me)}<i>vs</i>${hname(g.foe)}</div><div class="ss">${how}${r.name ? " · " + r.name : ""} · ${ago(r.at, now)}</div></span><${Mv} d=${d}/></button>`; })}</div></div></div>`;
  else body = html`<div class="sc" onScroll=${more} style="top:164px;bottom:0">${groups.map(function(gr){ return html`<div class="dayh">${gr.h}</div><div class="lst flat">${gr.g.map(function(g){ return html`<${Gm} g=${g} mode="list" now=${now} onClick=${function(){ setDetail(g.id); }}/>`; })}</div>`; })}
      <div class="dayh" style="justify-content:center;height:56px;align-items:center">${list.length > limit ? "Older games load as you scroll" : ""}</div></div>`;
  var dg = detail ? s.games.filter(function(g){ return g.id === detail; })[0] : null, sheet = null;
  if(dg){
    var seeded = !!dg.seed && dg.kind !== "friend" && dg.kind !== "ranked", firstName = dg.first ? "You" : hname(dg.foe);
    var rows2 = [["How it ended", dg.result === "d" ? howWord(dg) || "A draw" : dg.result === "w" ? "You won" + (dg.how === "life" ? " on life" : ", " + howWord(dg).toLowerCase()) : (dg.how === "life" ? "You lost on life" : howWord(dg))], ["Turns", String(dg.turns)],
      ["Life at the end", "You " + dg.life[0] + " · " + hname(dg.foe) + " " + dg.life[1]], ["Who went first", (dg.first ? "You" : hname(dg.foe)) + (dg.seed ? ", by the coin" : "")],
      ["Opponent", dg.kind === "dummy" ? "The Dummy" : dg.kind === "friend" ? "A friend" : dg.level === "steady" ? "The Steady AI" : "The Sharp AI"]];
    sheet = html`<${Sheet} b="detail-sheet" onClose=${function(){ setDetail(null); }}><div style="padding:0">
      <div class="row"><span class=${"rs " + RES[dg.result][0]}>${RES[dg.result][1]}</span><span style="margin-left:12px"><div class="ttl2">${hname(dg.me)} <span style="color:var(--ink-2)">vs</span> ${hname(dg.foe)}</div><div class="mono" style="margin-top:3px">${kindWord(dg, true)} · ${clock(dg.at)}</div></div></span></div>
      <div style="margin-top:8px">${rows2.map(function(r){ return html`<div class="rowl" style="padding:0"><span class="dl sp"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></span></div>`; })}</div>
      ${seeded ? html`<button class="btn" style="width:100%;margin-top:14px" data-tap data-b="replay" onClick=${function(){ nav.replay(dg); }}>Play this deal again</button><p class="hint" style="text-align:center;margin-top:8px">Same decks, same shuffle, same coin. A practice game: it does not change your record.</p>` : null}
      <button class="btn sec" style="width:100%;margin-top:10px" data-tap data-b="close" onClick=${function(){ setDetail(null); }}>Close</button></div><//>`;
  }
  return html`<div class="scr cx c3" data-b="c3"><${Sprite}/><div class="frame">
    <${Hdr} sub="Every one, from your side" title="Games" onBack=${nav.toTitle}/><${Seg} tabs=${RECORD_TABS} active=${2} onGo=${nav.go}/>
    <div class="vw"><div class="fchips" role="tablist">${FILTERS.map(function(x){ return html`<button class=${"fc" + (f === x[0] ? " on" : "")} data-tap data-b=${"chip-" + x[0]} onClick=${function(){ setF(x[0]); setLimit(40); }}>${x[1]}</button>`; })}</div>
      ${body}${sheet}</div></div></div>`;
}

/* ============================================================
   C4 The ladder
   ============================================================ */
var LAD_END = {life: "Won on life", concession: "They conceded", forfeit: "They left the table", stalemate: "A dead position"};
function C4(p){
  var nav = p.nav, net = useNet(), ui = useState(p.tab || "standings"), tab = ui[0], setTab = ui[1], s = useStore();
  useEffect(function(){ ladderLoad().then(null, function(){}); }, []);
  var r = net.r, state = net.state === "ok" && r ? "ok" : net.state === "fail" ? "fail" : net.state === "loading" || net.state === "idle" ? "loading" : "ok";
  var tabs = [{id: "standings", label: "Standings"}, {id: "latest", label: "Latest games"}];
  var note = function(){ return r ? html`<div class="t13" style="position:absolute;left:var(--gut);right:var(--gut);top:112px">Ranked server tables only. The best <b>${r.cap}</b> by rating are listed; a player name and <b>${r.floor}</b> ranked games put you on it. Friendly tables never count.</div>` : html`<div class="t13" style="position:absolute;left:var(--gut);right:var(--gut);top:112px">Ranked server tables only. Friendly tables never count.</div>`; };
  var you = r && r.you, body;
  var place = function(){
    if(!r) return null;
    if(you && you.listed) return html`<div class="cx-card lead" style="margin:0"><div class="row"><h2 class="ct br">Your place</h2><span class="sp"></span><span class="mono i1">${you.wins} won · ${you.losses} lost</span></div>
      <div class="row" style="margin-top:6px;gap:14px"><span class="nn m" aria-label=${"Number " + you.rank}>#${you.rank}</span><span class="sp"></span><span class="nn m" aria-label=${"Rating " + you.rating}>${you.rating}</span></div></div>`;
    if(you && you.toGo > 0) return html`<div class="cx-card lead"><div class="row"><h2 class="ct br">Your place</h2><span class="sp"></span><span class="mono i1">Rated, not yet listed</span></div>
      <div class="row" style="margin-top:6px;gap:14px"><span class="ttl2" style="font-size:28px;line-height:30px">${you.toGo} more ${you.toGo === 1 ? "game" : "games"}</span><span class="sp"></span><span class="nn m" aria-label=${"Rating " + you.rating}>${you.rating}</span></div>
      <p class="t13" style="margin-top:6px">${you.games > 0 ? "Rated after " + plural(you.games, "ranked game") + ". " : ""}${you.toGo === 1 ? "One more" : cap1(numw(you.toGo)) + " more"} and you are on the ladder.</p></div>`;
    if(you) return html`<div class="cx-card"><div class="row"><h2 class="ct">Your place</h2><span class="sp"></span><span class="mono i1">Not listed yet</span></div><p class="t13" style="margin-top:8px">You have played ${plural(you.games, "ranked game")}. Choose a player name and you are on the ladder.</p></div>`;
    return html`<div class="cx-card"><div class="row"><h2 class="ct">Your place</h2><span class="sp"></span><span class="mono i1">Not rated yet</span></div>
      <p class="t13" style="margin-top:8px">Anyone can read the ladder. To be on it, open a ranked table, choose a player name and play ${r.floor} ranked games. You start at 1200.</p>
      <button class="btn sec sm" style="margin-top:10px;width:100%" data-tap data-b="find" onClick=${nav.findOpponent}>Find an opponent</button></div>`;
  };
  var nm = function(h){ return hname(h); };
  if(state === "loading") body = html`<div class="sc" style="top:180px;bottom:0"><div class="scin" style="padding-top:0"><div class="mono br" style="text-align:center;padding:10px 0 4px" data-b="loading">Reading the ladder<span class="dots"><i></i><i></i><i></i></span></div>
      <div class="lst">${[120, 143, 166, 189, 142, 165, 188].map(function(w, i){ return html`<div class="lr"><span class="rk" style="color:var(--rail)">${i + 1}</span><span class="sp"><div class="skel" style=${"width:" + w + "px"}></div><div class="skel" style="width:150px;height:10px;margin-top:8px;opacity:.6"></div></span><div class="skel" style="width:56px;height:22px"></div></div>`; })}</div></div></div>`;
  else if(state === "fail") body = html`<div class="sc" style="top:180px;bottom:76px"><div class="scin" style="padding-top:0"><div class="note warn" role="alert" data-b="fail">${Ic("off", 22)}<div><div class="ttl3" style="font-size:16px;line-height:18px">The ladder is not answering</div><div class="t13" style="margin-top:3px">Check your connection, then try again. Nothing is lost: your games and your rating are kept by the server.</div></div></div></div></div>
      <div class="hub"><button class="btn" data-tap data-b="retry" onClick=${function(){ ladderLoad().then(null, function(){}); }}>Try again</button></div>`;
  else if(tab === "standings" && r.ladder.length === 0) body = html`<div class="sc" style="top:180px;bottom:0"><div class="scin" style="padding-top:0"><${Empty} title="No one is on the ladder yet" text=${"Be the first: play " + r.floor + " ranked games and your name stands at the top."}/></div></div>
      <div class="hub"><button class="btn" data-tap data-b="find" onClick=${nav.findOpponent}>Find an opponent</button></div>`;
  else if(tab === "standings") body = html`<div class="sc" style="top:180px;bottom:0"><div class="scin" style="padding-top:0">${place()}
      <div class="lst">${r.ladder.map(function(x){
        var me = you && you.listed && you.rank === x.rank;
        return html`<div class=${"lr" + (x.rank <= 3 ? " top" : "") + (me ? " me" : "")} data-b="row"><span class="rk">${x.rank}</span><span class="sp"><div class="nm2">${x.name}${me ? html`<span class="you2">YOU</span>` : null}</div><div class="mono">${x.wins} won · ${x.losses} lost${x.draws > 0 ? " · " + x.draws + " drawn" : ""}</div></span><span class="rt">${x.rating}</span></div>`; })}</div>
      <div class="hint" style="text-align:center;padding:6px 0 0">Standings from the server · a fan-made ladder, for fun and glory</div></div></div>`;
  else body = html`<div class="sc" style="top:180px;bottom:0"><div class="scin" style="padding-top:0">${place()}
      <div class="lst">${r.recent.length ? r.recent.map(function(x){
        var a = (x.names[0] || "A player") + " (" + nm(x.heroes[0]) + ")", b = (x.names[1] || "A player") + " (" + nm(x.heroes[1]) + ")";
        return html`<div class="lg" data-b="latest">${x.winner === null ? html`${a} and ${b} drew` : x.winner === 0 ? html`<b>${a}</b> beat ${b}` : html`<b>${b}</b> beat ${a}`}<small>${LAD_END[x.how] || "Played"} · ${ladAgo(x.at)}</small></div>`; })
        : html`<div class="lg">No games yet.</div>`}</div></div></div>`;
  return html`<div class="scr cx c4" data-b="c4"><${Sprite}/><div class="frame">
    <${Hdr} sub="Ranked tables · for fun and glory" title="The ladder" onBack=${nav.back}/>
    <div class="vw"><${Seg} two=${true} tabs=${tabs} active=${tab === "standings" ? 0 : 1} onGo=${setTab}/>${note()}${body}</div></div></div>`;
}

return {C1: C1, C2: C2, C3: C3, C4: C4,
  store: store, commit: commit, reload: reload, wipe: wipe, legacy: legacy, useStore: useStore, readCache: readCache, ladderLoad: ladderLoad, serverNow: serverNow, serverRoute: serverRoute, net: function(){ return _net; },
  ago: ago, ladAgo: ladAgo, agoLong: agoLong, clock: clock, dayHead: dayHead, rowSub: rowSub, ratingPath: ratingPath, heroRows: heroRows, bestTiles: bestTiles, rankedRows: rankedRows, passes: passes,
  parts: {html: html, Sprite: Sprite, Ic: Ic, Hdr: Hdr, Seg: Seg, Pips: Pips, Pt: Pt, Mv: Mv, Empty: Empty, Sheet: Sheet, Gm: Gm, hname: hname, first: first, short: shortOf, heroOf: heroOf, art: art, plural: plural, numw: numw, cap1: cap1, lineOf: lineOf,
    WEEKDAY: WEEKDAY, MONTH: MONTH, RECORD_TABS: RECORD_TABS, useStore: useStore, useNet: useNet}};
});
