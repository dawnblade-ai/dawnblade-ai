/* ============================================================
   CRESCENDO — ui/flow.js  ·  DawnUIFlow: the screens around the table (README step 7)
   docs/crescendo/SCREENS-FLOW.md F1-F4 and F6-F9 · mockups/flow-1 ... flow-9 · markup and classes are the mockups' own, styled by
   ui/flow.css (the mockups' sheet, scoped under `.stage.fl`), so a box in the mockup is the same box here.

     Title (F1) · Ways (F2) · Heroes (F3, the grid and the peek) · SitDown (F4) · Menu (F8: menu, JUDGE!!, concede, game log)
     Result (F7: the KO frame, then the result pad) · Waiting (F9)         + `catalog` (the real HEROES, real art, the real decks)

   NOTHING INVENTED: hero names, art, life and decks come from window.HEROES / DECKS and the pinned pool through the engine's own
   loaders (DawnCards, DawnGame); a card's words are the pool's. Screens that need a feature this build does not have yet (the
   iron Dummy, two phones, the server table) are drawn and say so; they never pretend.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUIFlow = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

var P = root.htmPreact || {};
var html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
var PAD = function(){ return root.DawnUIPad; };
var CP = function(){ return root.DawnUICircuitPlay || null; };

var SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="fl-i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-next" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol><symbol id="fl-i-dots" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></symbol><symbol id="fl-i-pad" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol><symbol id="fl-i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="fl-i-sound" viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol><symbol id="fl-i-share" viewBox="0 0 24 24"><path d="M12 15V4M8 7.5L12 4l4 3.5M6 11v8h12v-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-book" viewBox="0 0 24 24"><path d="M4 5.5C7 4.5 9.5 4.8 12 6.5c2.5-1.7 5-2 8-1v13c-3-1-5.5-.7-8 1-2.5-1.7-5-2-8-1z M12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol><symbol id="fl-i-flag" viewBox="0 0 24 24"><path d="M6 21V4M6 5h11l-2.5 4 2.5 4H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-judge" viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/></symbol><symbol id="fl-i-board" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="2"/></symbol><symbol id="fl-i-log" viewBox="0 0 24 24"><path d="M5 6h14M5 11h14M5 16h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol><symbol id="fl-i-coach" viewBox="0 0 24 24"><path d="M12 3.5a6 6 0 00-3.4 10.9c.6.5.9 1.1.9 1.8V17h5v-.8c0-.7.3-1.3.9-1.8A6 6 0 0012 3.5zM9.8 20h4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-left" viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6M20 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-right" viewBox="0 0 24 24"><path d="M10 6l6 6-6 6M4 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-down" viewBox="0 0 24 24"><path d="M6 11l6 6 6-6M5 20h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-up" viewBox="0 0 24 24"><path d="M6 13l6-6 6 6M5 4h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z" fill="currentColor"/></symbol><symbol id="fl-i-power" viewBox="0 0 24 24"><path d="M5 19l9-9M14 10l5-5.5.5-.5-.5 4.5L14.8 13zM7.6 16.4l-2.2 2.2M4.5 14.8l4.7 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="fl-i-lock" viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="fl-i-deck" viewBox="0 0 24 24"><rect x="6" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 2h8a2 2 0 012 2v13" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/></symbol><symbol id="fl-i-hand" viewBox="0 0 24 24"><rect x="4" y="6" width="10" height="14" rx="1.8" transform="rotate(-12 9 13)" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="5" width="10" height="14" rx="1.8" transform="rotate(10 15 12)" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="fl-i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/></symbol><symbol id="fl-m-dummy" viewBox="0 0 48 48"><rect x="5" y="19" width="38" height="4.4" rx="2.2" fill="currentColor" opacity=".55"/><rect x="21.6" y="33" width="4.8" height="9" fill="currentColor" opacity=".8"/><rect x="12" y="41.5" width="24" height="3.6" rx="1.8" fill="currentColor"/><path d="M14.5 17.5h19l-2.2 16.5H16.7z" fill="currentColor"/><path d="M24 18v15.5" stroke="#0A0E10" stroke-opacity=".45" stroke-width="1.4"/><circle cx="24" cy="26" r="4.6" fill="none" stroke="#F2C66E" stroke-width="2"/><circle cx="24" cy="26" r="1.2" fill="#F2C66E"/><path d="M16.2 8.5a7.8 7.8 0 0115.6 0V15H16.2z" fill="currentColor"/><path d="M16.2 11.6h15.6" stroke="#0A0E10" stroke-width="2.2"/><path d="M24 2.5l2.6 4.2h-5.2z" fill="#F2C66E"/></symbol><symbol id="fl-m-ai" viewBox="0 0 48 48"><circle cx="24" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M9 42c1-9 7-14 15-14s14 5 15 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M36 6l1.6 3.6L41 11l-3.4 1.4L36 16l-1.6-3.6L31 11l3.4-1.4z" fill="#F2C66E"/><path d="M11 9l1 2.2L14 12l-2 .8L11 15l-1-2.2L8 12l2-.8z" fill="#F2C66E" opacity=".7"/></symbol><symbol id="fl-m-phones" viewBox="0 0 48 48"><rect x="4" y="12" width="17" height="30" rx="4" transform="rotate(-8 12 27)" fill="none" stroke="currentColor" stroke-width="3"/><rect x="27" y="6" width="17" height="30" rx="4" transform="rotate(8 36 21)" fill="none" stroke="currentColor" stroke-width="3"/><path d="M19 27c3-4 7-4 10 0" fill="none" stroke="#F2C66E" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="36" r="1.6" fill="currentColor"/><circle cx="36" cy="30" r="1.6" fill="currentColor"/></symbol><symbol id="fl-m-online" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 24h32M24 8c-7 5-7 27 0 32M24 8c7 5 7 27 0 32" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".75"/><path d="M36 5l3 5 5.4.9-4 3.8 1 5.4-5.4-2.7-5 2.8.9-5.6-4-3.8L33 9.6z" fill="#F2C66E" transform="scale(.62) translate(18 -2)"/></symbol></defs></svg>';

/* ---------------- storage: conveniences only, every access guarded ---------------- */
function store(k, v){
  try {
    if(v === undefined) return root.localStorage.getItem(k);
    root.localStorage.setItem(k, v); return v;
  } catch(e){ return v === undefined ? null : v; }
}
var K_SPEED = "dawnui.speed", K_COACH = "dawnui.coach";
function readLast(){
  try { var o = JSON.parse(store(root.DawnUISession ? root.DawnUISession.LAST_KEY : "dawnblade.crescendo.last") || "null"); return o && typeof o === "object" ? o : null; } catch(e){ return null; }
}

/* ---------------- the catalog: the real heroes, art and decks ---------------- */
var _db = null, _cache = {};
function db(){
  if(_db) return _db;
  var C = root.DawnCards;
  C.setCDN(root.CDN);
  _db = C.buildMaps((root.DAWN_POOL || []).filter(function(c){ return c && c.name; }).map(C.mapDbCard));
  return _db;
}
var catalog = {
  list: function(){ return root.HEROES || []; },
  byKey: function(k){ return catalog.list().filter(function(h){ return h.k === k; })[0] || null; },
  art: function(k){ var h = catalog.byKey(k); return h && root.DawnCards ? (root.DawnCards.setCDN(root.CDN), root.DawnCards.cdnImg(h.code)) : null; },
  /* the hero's own card and its deck as printed, grouped by card (resolved through the same loader the table uses) */
  info: function(k){
    if(_cache[k]) return _cache[k];
    var h = catalog.byKey(k), G = root.DawnGame, C = root.DawnCards, d = G.parseDeck(root.DECKS[k]);
    var card = C.resolveEntry(db(), d.hero, (h.code || "").slice(0, 3) || null);
    var seen = {}, groups = [];
    d.deck.forEach(function(e){
      var key = e.name + "|" + e.p;
      if(!seen[key]){ var c = C.resolveEntry(db(), e, null); seen[key] = {card: c, n: 0, name: e.name, pitch: c && c.pitch || e.p}; groups.push(seen[key]); }
      seen[key].n += e.q || 1;
    });
    groups.sort(function(a, b){ return (a.pitch || 9) - (b.pitch || 9) || (a.name < b.name ? -1 : 1); });
    var total = groups.reduce(function(n, g){ return n + g.n; }, 0);
    return (_cache[k] = {hero: h, card: card, groups: groups, total: total, life: card && card.life, type: String(card && card.tt || "").replace(/\s+Hero.*$/, "")});
  },
  /* an opponent "drawn by fate": any hero but yours */
  draw: function(not, rnd){
    var all = catalog.list().filter(function(h){ return h.k !== not; });
    return all[Math.floor((rnd == null ? Math.random() : rnd) * all.length)].k;
  }
};
var PITCH = {1: "red", 2: "yellow", 3: "blue"};
var firstName = function(n){ return String(n || "").split(/[ ,]/)[0]; };
var nameOf = function(k){ var h = catalog.byKey(k); return h ? h.n : k; };

/* ---------------- small parts ---------------- */
function Sprite(){ return html`<div class="fl-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" dangerouslySetInnerHTML=${{__html: SPRITE}}></div>`; }
function Ico(p){ return html`<svg class="ico" style=${p.style || ""}><use href=${"#fl-i-" + p.n}/></svg>`; }
function Back(p){ return html`<button class=${"ib" + (p.dk ? " dk" : "")} aria-label="Back" data-tap data-b="back" style=${p.style || ""} onClick=${p.onClick}><${Ico} n="back"/></button>`; }
var bg = function(url, extra){ return url ? "background-image:url(" + url + ")" + (extra ? ";" + extra : "") : ""; };
function Switch(p){ return html`<i class=${"sw" + (p.on ? " on" : "")}></i>`; }

/* ============================================================
   THE FLOW'S LOGIC, PURE (test/ui-flow.test.js drills it headless): which modes light, what the coin says, where a networked
   surface is in its life, what a rematch means here, and the hunt for an opponent. DawnUISession is the adapter; nothing here
   judges a rule.
   ============================================================ */
/* F2's four modes, in the mockup's order, each enabled EXACTLY when DawnUISession.modes() says this page can run it */
function modeRows(m){
  m = m || {};
  return [
    {id: "dummy", enabled: !!m.dummy, lead: true, title: "Train on the Dummy", text: "Learn your deck against an iron-armored dummy.", tag: "Start here · Coach's call on"},
    {id: "ai", enabled: !!m.local, title: "Play an AI hero", text: "A real precon, piloted by the computer.", tag: "Practice · Hero's call on"},
    {id: "phones", enabled: !!m.room, title: "Two phones, one table", text: "Share a four-letter code and play a friend.", tag: "Friendly"},
    {id: "online", enabled: !!m.server, title: "Find an opponent", text: "Sit at the server table and climb the ladder.", tag: "Friendly or ranked"}
  ];
}

/* THE ROLL (a local table: Flesh and Blood rolls a die and the winner chooses who goes first) or THE THROW (a networked table: rock, paper, scissors), as F4 says it. A descriptor {label, text, first, choices|null, ready, coin}:
     choices  what the person may press now ({id, label}); ready: SHUFFLE UP may be pressed; coin: draw the coin (not at the Dummy). */
var SEAT_CHOICES = [{id: "first", label: "Go first"}, {id: "second", label: "Go second"}];
var THROW_CHOICES = [{id: "rock", label: "Rock"}, {id: "paper", label: "Paper"}, {id: "scissors", label: "Scissors"}];
function seatingLocal(call, foeName, dummy, chosen){
  if(dummy) return {label: "", text: "You go first", first: 0, choices: null, ready: true, coin: false};
  if(call.winner === 0 && call.needsChoice) return {label: "The roll", text: "You won the roll", first: null, choices: SEAT_CHOICES, ready: false, coin: true, die: true, won: true};
  var f = call.first;
  return {label: "The roll", text: f === 0 ? "You go first" : (foeName || "They") + " goes first", first: f, choices: null, ready: true, coin: true, die: true, won: call.winner === 0, chosen: chosen || null};
}
function seatingNet(s, foeName){
  var w = s.awaiting ? s.awaiting() : null, c = s.coin ? s.coin() : null, me = s.seat;
  if(w === "throw") return {label: "The throw", text: "Throw", first: null, choices: THROW_CHOICES, ready: false, coin: true};
  if(w === "seat") return {label: "The throw", text: "You won the throw", first: null, choices: SEAT_CHOICES, ready: false, coin: true, won: true};
  if(c && c.first != null) return {label: "The throw", text: c.first === me ? "You go first" : (foeName || "They") + " goes first", first: c.first === me ? 0 : 1, choices: null, ready: s.phase && s.phase() === "playing", coin: true};
  return {label: "The coin", text: "Throwing…", first: null, choices: null, ready: false, coin: true};
}
/* where a networked surface is: wait (the friend or the server has not arrived) | sit (both heroes known: the coin) | play | end | drop (the
   other phone went quiet mid-game) | fail (it never came up) */
function netStage(s, err){
  if(err) return "fail";
  if(!s) return "wait";
  var ph = s.phase(), st = s.state && s.state();
  /* a room's channel closing is reported by the channel's own status (the app sets `dropped` from openNetworked's onStatus); the referee session's phase does not move */
  if(s.dropped && st && !st.over) return "drop";
  if(ph === "fault" || ph === "closed") return st ? (st.over ? "end" : "drop") : "fail";
  if(ph === "connecting") return "wait";
  if(ph === "ended") return "end";
  if(ph === "playing") return "play";
  var lob = s.lobby && s.lobby();
  return lob && lob.heroes[0] != null && lob.heroes[1] != null ? "sit" : "wait";
}
/* what Rematch means: local (the session deals a fresh game) | server (both ask; the referee opens a table) | none (a two-phone room has no
   rematch protocol: the honest button is "New table") */
function rematchKind(s){ return !s ? "none" : !s.networked ? "local" : s.server ? "server" : "none"; }
/* FIND AN OPPONENT (F9 server): ask the queue, sit at the table it names, and while it waits ask again every beat; the server decides every
   match. deps: {seek(q), open(table) -> Promise<surface>, setTimer, clearTimer}; hooks: {onSurface(surface, info), onFail(err)}. */
function findOpponent(deps, hooks){
  var stopped = false, timer = null, table = null, surface = null;
  function loop(beat){
    timer = deps.setTimer(function(){
      timer = null;
      if(stopped) return;
      deps.seek({table: table}).then(function(r){ if(!stopped && (r.state === "waiting" || r.state === "taken")) loop(r.beat); }, function(e){ if(!stopped) hooks.onFail(e); });
    }, beat);
  }
  deps.seek({}).then(function(r){
    if(stopped) return null;
    table = r.table;
    return deps.open(r.table).then(function(sf){
      surface = sf;
      if(stopped){ try { sf.dispose(); } catch(e){} return; }
      hooks.onSurface(sf, {matched: r.state === "matched", typical: r.typical || null, table: r.table});
      if(r.state !== "matched") loop(r.beat);
    });
  }).then(null, function(e){ if(!stopped) hooks.onFail(e); });
  return {
    /* STOP LOOKING / PLAY THE AI: the seek is cancelled (its table closes) and the surface is let go */
    cancel: function(){
      stopped = true; if(timer != null) deps.clearTimer(timer);
      try { deps.seek({cancel: true}).then(null, function(){}); } catch(e){}
      if(surface){ try { surface.dispose(); } catch(e){} }
    },
    table: function(){ return table; }
  };
}

/* ============================================================
   F1 Title
   ============================================================ */
function Title(p){
  var last = readLast(), key = last && catalog.byKey(last.hero) ? last.hero : (catalog.list()[0] || {}).k, h = catalog.byKey(key);
  return html`<div class="scr f1" data-b="title">
    <div class="bg"><div class="sunglow"></div><div class="sun"></div>
      <svg class="rays" viewBox="-210 -210 420 420" aria-hidden="true"><g stroke="#F2C66E" stroke-width="1.2" stroke-linecap="round" opacity=".55"><path d="M0 -96V-196M0 96V196M-96 0H-196M96 0H196M68 -68L138 -138M-68 -68L-138 -138M68 68L138 138M-68 68L-138 138"/><path d="M37 -89L75 -181M-37 -89L-75 -181M89 -37L181 -75M-89 -37L-181 -75M89 37L181 75M-89 37L-181 75M37 89L75 181M-37 89L-75 181" opacity=".5"/></g><circle r="88" fill="none" stroke="#D8A23E" stroke-opacity=".35" stroke-width="1.2"/></svg></div>
    <div class="frame">
      <div class="top"><span class="lab">Fan-made · free forever</span><button class="ib" aria-label="Settings" data-tap data-b="gear" onClick=${p.onGear}><${Ico} n="gear"/></button></div>
      <div class="mark"><div class="wm w1">Dawn</div>
        <svg class="blade" viewBox="0 0 393 22" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bl" x1="0" x2="1"><stop offset="0" stop-color="#CFCABD"/><stop offset=".6" stop-color="#F5F0E4"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>
          <circle cx="12" cy="11" r="4.5" fill="#D8A23E"/><rect x="14" y="9" width="30" height="4" rx="1.5" fill="#8A6420"/><rect x="42" y="2.5" width="7" height="17" rx="2.5" fill="#F2C66E"/>
          <path d="M49 8H356L386 11L356 14H49Z" fill="url(#bl)"/><path d="M52 11H352" stroke="#0A0E10" stroke-opacity=".28" stroke-width=".9"/><path d="M49 8H356L386 11" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/>
          <path d="M386 4.5L387.6 9.4L392.5 11L387.6 12.6L386 17.5L384.4 12.6L379.5 11L384.4 9.4Z" fill="#F2C66E"/></svg>
        <div class="wm w2">Blade</div></div>
      <p class="tag">Spar the Silver Age precons. Your hero, your deck.</p>
      <div class="band">
        <button class="artband hero" aria-label="Change your hero" data-tap data-b="band" onClick=${p.onHero} style=${"top:0;bottom:0;background-size:132% auto;background-position:50% 23%;" + bg(catalog.art(key))}></button>
        <div class="shade"></div><div class="who"><span class="lab" style="color:var(--ink-1)">Your hero</span><b>${h ? firstName(h.n) : ""}</b></div>
        <span class="chip br" style="position:absolute;right:var(--gut);bottom:8px">Change ›</span>
      </div>
      <div class="cta"><button class="btn" data-tap data-b="play" onClick=${p.onPlay}>Play</button><small>Against an AI hero, drawn by fate</small></div>
      <div class="row3"><button class="link" data-tap data-b="ways" onClick=${p.onWays}>Ways to play</button>
        <button class="link" data-tap data-b="record" onClick=${p.onRecord}>Your record</button><button class="link" data-tap data-b="rules" onClick=${p.onRules}>Learn the rules</button></div>
      <div class="foot">Fan-made · non-profit · no ads, ever</div>
    </div></div>`;
}

/* ============================================================
   F2 Ways to play
   ============================================================ */
function Ways(p){
  var key = (readLast() || {}).foe, foe = catalog.byKey(key) || catalog.list()[2];
  var rows = modeRows(p.modes), on = {dummy: p.onDummy, ai: p.onAI, phones: p.onPhones, online: p.onServer, circuit: p.onCircuit};
  var icon = {dummy: "m-dummy", phones: "m-phones", online: "m-online", circuit: "m-circuit"};
  var cards = rows.slice(), cp = CP();
  if(cp && root.DawnCircuit) cards.splice(2, 0, Object.assign({enabled: true}, cp.WAYS_CARD));
  return html`<div class=${"scr f2" + (cards.length > rows.length ? " cx" : "")} data-b="ways"><div class="frame">
    <div class="hdr" style="height:76px"><${Back} onClick=${p.onBack}/><h1><span class="sub">Step 1 of 3</span>How do you want to play?</h1></div>
    <div class="modes">
      ${cards.map(function(r){
        var pic = r.id === "ai" ? html`<span class="pic art hero" style=${"background-size:300%;background-position:50% 17%;box-shadow:0 0 0 2px var(--opp);" + bg(foe && catalog.art(foe.k))}></span>`
          : html`<span class="pic"><svg><use href=${"#fl-" + icon[r.id]}/></svg></span>`;
        return html`<button class=${"mode" + (r.lead ? " lead" : "")} disabled=${!r.enabled} aria-disabled=${r.enabled ? "false" : "true"} style=${r.enabled ? "" : "opacity:.5"} data-tap=${r.enabled ? "" : undefined} data-b=${"mode-" + r.id} onClick=${r.enabled ? on[r.id] : null}>
          ${pic}<span style="flex:1;min-width:0"><h3>${r.title}</h3><p>${r.text}</p><span class="tg"><span class="lab" style=${r.lead && r.enabled ? "color:var(--brass)" : ""}>${r.enabled ? r.tag : "Not at this table yet"}</span></span></span>
          ${r.enabled ? html`<${Ico} n="next"/>` : null}</button>`;
      })}
    </div>
    <div class="foot"><button class="link" data-tap data-b="rules" onClick=${p.onRules}><${Ico} n="book" style="width:20px;height:20px;margin-right:8px"/>New here? Learn the rules in two minutes</button></div>
  </div></div>`;
}

/* ============================================================
   F3 Choose your hero (+ the peek)
   ============================================================ */
function Heroes(p){
  var st = useState(p.peek || null), peek = st[0], setPeek = st[1];
  var rd = useState(null), card = rd[0], setCard = rd[1];
  var heroes = catalog.list(), cur = p.current;
  var info = peek ? catalog.info(peek) : null;
  var title = p.mode === "foe" ? "Choose your opponent" : "Choose your hero";
  return html`<div class="scr f3" data-b="heroes"><div class="frame">
    <div class="hdr"><${Back} onClick=${p.onBack}/><h1><span class="sub">${p.mode === "foe" ? "Step 3 of 3" : "Step 2 of 3"}</span>${title}</h1>${p.fixedFoe && catalog.byKey(p.fixedFoe) ? html`<span class="chip br" data-b="foe-chip" style="position:absolute;left:253px;top:20px;width:130px;height:28px;justify-content:center">Foe \u00b7 ${firstName(catalog.byKey(p.fixedFoe).n)}</span>` : null}</div>
    <div class=${"grid sc"} style=${peek ? "pointer-events:none" : ""} data-b="grid">
      ${heroes.map(function(h){
        var label = h.k === "viserai_bw" || /Between Worlds/.test(h.n) ? "Viserai BW" : firstName(h.n);
        return html`<button class=${"tile hero" + (h.k === cur ? " last" : "")} aria-label=${h.n} data-tap data-b=${"tile-" + h.k} style=${bg(catalog.art(h.k))} onClick=${function(){ setPeek(h.k); }}>
          <span class="tn">${label}</span>${CP() ? CP().tilePips(h.k) : null}${h.k === cur ? html`<span class="lastdot">Last</span>` : null}</button>`;
      })}<i class="pad"></i>
    </div>
    ${peek ? html`<div class="scrim full" data-b="scrim" onClick=${function(){ setPeek(null); }}></div>
      <div class="sheet pk" data-b="peek">
        <div class="ban hero" style=${bg(catalog.art(peek))}><i class="bshade"></i>
          <button class="ib dk" aria-label="Close" data-tap data-b="peek-close" onClick=${function(){ setPeek(null); }}><${Ico} n="x"/></button>
          <div class="bn"><span class="lab" style="color:var(--ink-1)">${info.type} · Chapter ${info.hero.ch}</span><b>${firstName(info.hero.n)}</b>${CP() ? CP().peekPips(peek) : null}</div></div>
        <p class="bl">${info.hero.blurb || ""}</p>
        <div class="stats">${info.life != null ? html`<span class="chip"><${Ico} n="heart" style="width:14px;height:14px;color:var(--damage)"/>Life ${info.life}</span>` : null}
          <span class="chip"><${Ico} n="deck" style="width:14px;height:14px"/>${info.total} cards</span></div>
        <div class="dk-l"><span class="lab">The deck, as printed</span><span class="lab">Tap a card to read it</span></div>
        <div class="dstrip sc" style="overflow-x:auto;overflow-y:hidden;touch-action:pan-x">
          ${info.groups.map(function(g){
            return html`<button class=${"dc cd t56 " + (PITCH[g.pitch] || "")} data-tap aria-label=${g.name} onClick=${function(){ setCard(g.card); }}>${g.card && g.card.img ? html`<img alt=${g.name} src=${g.card.img}/>` : html`<span style="font:var(--t-label);padding:3px">${g.name}</span>`}<span class="strip"></span><span class="x">×${g.n}</span></button>`;
          })}
        </div>
        <div class="sitbar"><button class="btn" data-tap data-b="sit" onClick=${function(){ p.onPick(peek); }}>${(p.mode === "foe" ? "Face " : "Sit down as ") + firstName(info.hero.n)}</button></div>
      </div>` : null}
    ${card ? html`<div class="scrim full" style="z-index:90" data-b="reader" onClick=${function(){ setCard(null); }}></div>
      <div class="reader" data-b="reader-card" style="position:absolute;left:50%;top:84px;transform:translateX(-50%);width:250px;z-index:91" onClick=${function(){ setCard(null); }}>
        ${card.img ? html`<img alt=${card.name} src=${card.img} style="width:250px;border-radius:12px;box-shadow:var(--e4)"/>` : null}
        <p style="margin-top:10px;font:var(--t-body);color:var(--ink-0);background:rgba(10,14,16,.86);border-radius:12px;padding:10px 12px">${String(card.tx || "").split("\n").filter(Boolean).map(function(t){ return html`<span style="display:block">${t}</span>`; })}</p>
      </div>` : null}
  </div></div>`;
}

/* ============================================================
   F4 Sit down: you below, them above, the coin on the seam
   ============================================================ */
function SitDown(p){
  var dummy = p.foe === "dummy", me = catalog.info(p.hero), them = dummy ? null : catalog.info(p.foe), sg = p.seating || {label: "The coin", text: "You go first", first: 0, choices: null, ready: true, coin: true};
  var coin = useRef(null), win = useRef(null);
  useEffect(function(){
    var d = p.director; if(!d || !sg.coin || sg.first == null) return;
    d.enqueue({kind: "start", els: {coin: coin.current, win: win.current}, pose: {coin: {x: 0, y: 0, s: 1}}});
  }, [p.hero, p.foe, sg.first, sg.coin]);
  var role = function(i){ return String(i.type) + " · life " + (i.life == null ? "" : i.life); };
  var foeName = dummy ? "The Dummy" : firstName(them.hero.n);
  var cx = p.ctx || null, fixFoe = !!(cx && (cx.kind === "daily" || cx.kind === "road")), fixHero = !!(cx && cx.kind === "daily"), label = cx && CP() ? CP().sitLabel(cx, p.foe) : null;
  var coinArt = sg.first === 0 ? catalog.art(p.hero) : (!dummy && sg.first === 1 ? catalog.art(p.foe) : null);
  return html`<div class="scr f4" data-b="sitdown">
    <div class="bg">${dummy ? html`<div class="half o dummy"><svg viewBox="0 0 24 24"><use href="#fl-m-dummy"/></svg></div>` : html`<div class="half o hero" style=${bg(catalog.art(p.foe))}></div>`}<div class="half y hero" style=${bg(catalog.art(p.hero))}></div><div class="tint o"></div><div class="tint y"></div>
      <svg class="seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="54" x2="100" y2="46" stroke="#F2C66E" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg></div>
    <div class="frame">
      ${fixFoe ? null : html`<button class="hit" aria-label="Change your opponent" data-tap data-b="hit-opp" style="top:52px;height:calc(46% - 52px)" onClick=${p.onFoe}></button>`}
      ${fixHero ? null : html`<button class="hit" aria-label="Change your hero" data-tap data-b="hit-you" style="top:54%;height:calc(46% - 76px)" onClick=${p.onHero}></button>`}
      ${label ? html`<span class="lab" data-b="sit-label" style="position:absolute;left:64px;right:var(--gut);top:20px;z-index:6;color:var(--brass-hi)">${label}</span>` : null}
      <button class="ib dk" aria-label="Back" data-tap data-b="back" style="position:absolute;left:var(--gut);top:8px;z-index:6" onClick=${p.onBack}><${Ico} n="back"/></button>
      <div class="nameo" style="pointer-events:none"><span class="lab">${dummy ? "Them · iron-armored" : "Them · " + (p.net ? "your opponent" : "drawn by fate")}</span><b>${foeName}</b><i class="bar3"></i><span class="lab">${dummy ? "Training dummy" : role(them)}</span></div>
      ${p.net || fixFoe ? null : html`<span class="swap" style="right:var(--gut);top:calc(46% - 56px)">Tap to swap ›</span>`}
      ${sg.coin ? (sg.die
        ? html`<div class="coin die" ref=${coin} data-b="coin" aria-label="The roll"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="9" fill="#F5F0E4" stroke="#0A0E10" stroke-opacity=".5" stroke-width="2"/><g fill="#0A0E10"><circle cx="15" cy="15" r="3.4"/><circle cx="33" cy="15" r="3.4"/><circle cx="24" cy="24" r="3.4"/><circle cx="15" cy="33" r="3.4"/><circle cx="33" cy="33" r="3.4"/></g></svg></div>`
        : html`<div class="coin" ref=${coin} data-b="coin"><div class="face hero" style=${bg(coinArt)}>${coinArt ? "" : "?"}</div></div>`) : null}
      <div class="slab" ref=${win} data-b="slab"><span class="lab">${sg.label || "Ready"}</span><b>${sg.text}</b></div>
      ${sg.choices ? html`<div class="seatpick" data-b="seatpick">${sg.choices.map(function(c){ return html`<button class="btn sec" data-tap data-b=${"pick-" + c.id} onClick=${function(){ p.onChoose(c.id); }}>${c.label}</button>`; })}</div>` : null}
      <div class="namey" style="pointer-events:none"><span class="lab">You</span><b>${firstName(me.hero.n)}</b><i class="bar3"></i><span class="lab">${role(me)}</span></div>
      ${fixHero ? null : html`<span class="swap" style="right:var(--gut);bottom:84px">Tap to change ›</span>`}
      <div class="hub">${cx && cx.kind === "daily" ? null : html`<button class="btn sec" data-tap aria-label="Read your deck" data-b="gear" onClick=${p.onDeck}><${Ico} n="deck"/>Deck</button>`}
        <button class=${"btn" + (sg.ready ? "" : " dis")} disabled=${!sg.ready} data-tap=${sg.ready ? "" : undefined} data-b="shuffle" onClick=${sg.ready ? p.onShuffle : null}>Shuffle up</button></div>
    </div></div>`;
}

/* ============================================================
   F8 Menu (+ JUDGE!!, concede, the game log). `variant:"title"` shows only Sound and Speed.
   ============================================================ */
function Menu(p){
  var st = useState("menu"), view = st[0], setView = st[1];
  var aud = root.DawnUIAudio, snd = useState(aud ? !aud.muted() : true), sound = snd[0], setSound = snd[1];
  var sp = useState(store(K_SPEED) || "standard"), speed = sp[0], setSpeed = sp[1];
  var co = useState(store(K_COACH) !== "0"), coach = co[0], setCoach = co[1];
  var note = useState(""), text = note[0], setText = note[1];
  var said = useState(""), msg = said[0], setMsg = said[1];
  var table = p.variant !== "title";
  var toggleSound = function(){ var on = !sound; if(aud){ aud.setMuted(!on); if(on){ aud.unlock(); aud.cue("tap"); } } setSound(on); };
  var pickSpeed = function(v){ store(K_SPEED, v); setSpeed(v); if(p.director) p.director.speed(v); };
  var toggleCoach = function(){ var on = !coach; store(K_COACH, on ? "1" : "0"); setCoach(on); };
  var send = function(){
    var s = p.session, R = root.DawnReport;
    if(!s || !R){ setMsg("The judge could not be reached."); return; }
    var body = R.text(s.state(), {note: text, source: "crescendo", mySeat: s.seat, appVer: root.APP_VER, dataVer: root.DATA_VER, hero: s.heroKeys && s.heroKeys[0]});
    try {
      var blob = new Blob([body], {type: "application/json"}), a = root.document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = R.filename(s.state(), {hero: s.heroKeys && s.heroKeys[0]}); a.click();
      setMsg("Saved. Send the file to the judge.");
    } catch(e){ setMsg("Could not save the report here."); }
  };
  var head = function(t, extra){ return html`<div class="mh"><h2>${t}</h2>${extra || null}</div>`; };
  var close = html`<button class="ib dk" aria-label="Close" data-tap data-b="menu-close" onClick=${p.onClose}><${Ico} n="x"/></button>`;
  return html`<div class="scr f8" data-b="menu"><div class="frame">
    <div class="scrim" onClick=${view === "menu" ? p.onClose : null}></div>
    ${view === "menu" ? html`<div class="sheet mn" data-b="menu-sheet">
      <div class="mh"><h2>Menu</h2><span class="chip">${p.daily ? "Today\u2019s challenge" : table ? "Practice table" : "Settings"}</span>${close}</div>
      <div class="mb">
        <button class="mrow" data-tap data-b="row-sound" onClick=${toggleSound}><${Ico} n="sound"/><span class="t">Sound</span><${Switch} on=${sound}/></button>
        <div class="mrow sp"><div class="lh"><${Ico} n="gear"/><span class="t">Speed<small>Both players, the same speed</small></span></div>
          <div class="seg">${["standard", "quick", "instant"].map(function(v){ return html`<button class=${speed === v ? "on" : ""} data-tap data-b=${"speed-" + v} onClick=${function(){ pickSpeed(v); }}>${v[0].toUpperCase() + v.slice(1)}</button>`; })}</div></div>
        ${table ? html`
          <button class="mrow" data-tap data-b="row-log" onClick=${function(){ setView("log"); }}><${Ico} n="log"/><span class="t">Game log<small>Practice tables only</small></span><${Ico} n="next" /></button>
          ${p.daily ? null : html`<button class="mrow" data-tap data-b="row-coach" onClick=${toggleCoach}><${Ico} n="coach"/><span class="t">Coach's call<small>Says the play it would make, and why</small></span><${Switch} on=${coach}/></button>`}
          <a class="mrow" data-tap data-b="row-classic" href="index.html" style="text-decoration:none;color:inherit"><${Ico} n="board"/><span class="t">Classic board<small>The older layout, from the next game</small></span><${Ico} n="next"/></a>
          <button class="mrow jd" data-tap data-b="row-report" onClick=${function(){ setView("report"); }}><${Ico} n="judge"/><span class="t">JUDGE!! Report a problem</span><${Ico} n="next"/></button>
          <button class="mrow dg" data-tap data-b="row-concede" onClick=${function(){ setView("concede"); }}><${Ico} n="flag"/><span class="t">Concede and leave</span></button>` : null}
      </div></div>` : null}
    ${view === "report" ? html`<div class="sheet mn" data-b="report-sheet">
      <div class="mh"><h2>Report a problem</h2><span class="chip br">JUDGE!!</span><button class="ib dk" aria-label="Back" data-tap data-b="menu-back" onClick=${function(){ setView("menu"); }}><${Ico} n="back"/></button></div>
      <div class="rp"><p>Tell the judge what looked wrong. We save the whole board with your note.</p>
        <textarea class="ta" data-b="note" style="font-size:16px;width:100%;color:inherit" placeholder="What looked wrong?" value=${text} onInput=${function(e){ setText(e.target.value); }}></textarea>
        <div class="meta"><span class="lab">${msg || "The board is attached"}</span></div></div>
      <div class="foot" style="display:flex;gap:10px;padding:14px 10px 14px"><button class="btn sec" data-tap data-b="report-cancel" onClick=${function(){ setView("menu"); }}>Cancel</button><button class="btn" style="flex:1" data-tap data-b="report-send" onClick=${send}>Send to the judge</button></div></div>` : null}
    ${view === "concede" ? html`<div class="sheet mn" data-b="concede-sheet">
      <div class="mh"><h2>Concede this game?</h2></div>
      <div class="cf"><p>${p.daily ? html`Your opponent wins. <b>This counts as today\u2019s official try.</b>` : "Your opponent wins and you leave the table. At a ranked table this counts as a loss."}</p></div>
      <div class="foot" style="display:flex;flex-direction:column;gap:12px;padding:18px 10px 14px"><button class="btn" data-tap data-b="keep" onClick=${function(){ setView("menu"); }}>Keep playing</button>
        <button class="btn sec dng" style="width:100%" data-tap data-b="concede" onClick=${p.onConcede}>Concede</button></div></div>` : null}
    ${view === "log" ? html`<div class="sheet mn" data-b="log-sheet">
      <div class="mh"><h2>Game log</h2><button class="ib dk" aria-label="Back" data-tap data-b="menu-back" onClick=${function(){ setView("menu"); }}><${Ico} n="back"/></button></div>
      <div class="rp" style="max-height:340px;overflow-y:auto;touch-action:pan-y">${(p.log || []).slice().reverse().map(function(l){ return html`<p style="margin:0 0 6px;font:var(--t-small)"><b>${l.head}</b> ${l.sub}</p>`; })}${(p.log || []).length ? null : html`<p>Nothing has happened yet.</p>`}</div></div>` : null}
  </div></div>`;
}

/* ============================================================
   F7 The result: the KO frame (the word DAWN / BREAK, split by the blade), then the result pad
   ============================================================ */
function Result(p){
  var st = useState(p.conceded ? "frame" : "ko"), phase = st[0], setPhase = st[1];
  var ready = useState(false), tapReady = ready[0], setReady = ready[1];
  var veil = useRef(null), word = useRef(null), blade = useRef(null), dim = useRef(null);
  var me = p.winner === 0, loser = p.winner === 0 ? 1 : 0;
  useEffect(function(){
    var d = p.director, t = null;
    if(phase === "ko" && d){
      /* the game is over and its state is true: whatever the table's announcements still have queued lands now (no motion),
         so the KO is never told behind a long queue (an unpaced AI finishes a game in one tick) */
      var cancelled = false;
      d.tapThrough();
      d.idle().then(function(){ if(!cancelled) d.enqueue({kind: "ko", side: loser, dmg: 0, from: 0, to: 0, els: {dim: dim.current, sweep: blade.current, result: word.current}}); });
      t = setTimeout(function(){ setReady(true); }, 400 + 260 + 1020 + 600);
      return function(){ cancelled = true; clearTimeout(t); };
    } else t = setTimeout(function(){ setReady(true); }, 600);
    return function(){ clearTimeout(t); };
  }, [phase]);
  var wname = me ? "You win" : firstName(p.names[p.winner]) + " wins";
  if(phase === "pad"){
    var ex = p.extra || null, ac = (ex && ex.acts) || {}, A = ac.a || {label: "New opponent", onClick: p.onNew}, B = ac.b || {label: "Leave", onClick: p.onLeave, dng: true};
    var C = ac.c || {label: p.rematchLabel || "Rematch", onClick: p.onRematch, busy: p.rematchBusy};
    return html`<div class=${"scr f7" + (ex ? " " + ex.cls : "")} data-b="result-pad"><div class="frame">
      <${PAD().Paper} pad=${p.pad} names=${p.names} first=${p.first} turn=${p.turn} result=${true} winner=${p.winner} style=${ex ? "" : "top:66px;height:470px"}/>
      ${ex && ex.plate}${ex && ex.cap ? html`<div class="cap" data-b="cap">${ex.cap}</div>` : null}
      <div class="acts2"><div class="row"><button class="btn sec" data-tap data-b="new" onClick=${A.onClick}>${A.label}</button><button class=${"btn sec" + (B.dng ? " dng" : "")} data-tap data-b="leave" onClick=${B.onClick}>${B.label}</button></div>
        <button class=${"btn" + (C.busy ? " dis" : "")} disabled=${!!C.busy} data-tap=${C.busy ? undefined : ""} data-b="rematch" onClick=${C.onClick}>${C.label}</button></div></div></div>`;
  }
  return html`<div class="scr f7" data-b="result-ko"><div class="frame">
    <div class="hubcover" aria-hidden="true"></div>
    ${phase === "ko" ? html`<div class="veil" ref=${dim} style="background:#000;opacity:0"></div>` : html`<div class="veil" ref=${veil}></div>`}
    <div class="word" ref=${word} data-b="word" style=${phase === "ko" && p.director ? "opacity:0" : ""}><b>Dawn</b><b>break</b><span>${wname}</span><i class=${me ? "" : "o"}></i></div>
    <div class="blade" ref=${blade} data-b="blade" style=${phase === "ko" ? "opacity:0" : ""}></div>
    ${tapReady ? html`<span class="tapon">Tap to continue</span><button class="tapfull" aria-label="Continue" data-tap data-b="continue" onClick=${function(){ setPhase("pad"); }}></button>` : null}
  </div></div>`;
}

/* ============================================================
   Learn the rules: the keywords you will meet, as the Comprehensive Rules write them (data/crkw.js, pinned verbatim by
   tools/pin-crkw.js). Nothing of ours but the heading: each row is the CR number, the keyword and its defining sentence.
   ============================================================ */
function Rules(p){
  var rows = (root.DAWN_CRKW && root.DAWN_CRKW.rows) || [];
  return html`<div class="scr f8" data-b="rules"><div class="frame"><div class="scrim" onClick=${p.onClose}></div>
    <div class="sheet mn" data-b="rules-sheet">
      <div class="mh"><h2>The rules</h2><span class="chip br">Keywords</span><button class="ib dk" aria-label="Close" data-tap data-b="rules-close" onClick=${p.onClose}><${Ico} n="x"/></button></div>
      <div class="mb rl-list" data-b="rules-list">
        <p class="rl-intro">The keywords you will meet, as the Comprehensive Rules write them.</p>
        ${rows.map(function(r){ return html`<div class="rl"><b>${r.n}</b><i>CR ${r.r}</i><p>${r.t}</p></div>`; })}
        ${rows.length ? null : html`<p class="rl-intro">The rules are not loaded.</p>`}
      </div></div></div></div>`;
}

/* ============================================================
   F9 Waiting. `ai` = the quiet chip on the table; the rest are full screens (two phones and the server are not at this
   table yet: they are drawn so the flow is complete and are reached by ?screen=f9&v=... only).
   ============================================================ */
function Dots(){ return html`<span class="dots"><i></i><i></i><i></i></span>`; }
function Thinking(p){ return html`<div class="scr f9 think-wrap" style="pointer-events:none" data-b="thinking"><div class="think" data-b="think">${p.name} is thinking<${Dots}/></div></div>`; }
function Seat(p){ return html`<div class="seat"><div class=${"c " + (p.hero ? "me hero" : "em")} style=${p.hero ? bg(catalog.art(p.hero)) : ""}>${p.hero ? "" : "?"}</div><span class="lab">${p.label}${p.dots ? html`<${Dots}/>` : null}</span></div>`; }
function Waiting(p){
  var v = p.v || "phone", me = p.hero || (catalog.list()[0] || {}).k;
  var code = p.code || "K7QM";
  var sun = function(dim){ return html`<div class=${"sunrise" + (dim ? " dim" : "")}><div class="halo"></div><div class="disc"></div><div class="horizon"><i></i></div></div>`; };
  var back = html`<button class="ib dk" aria-label="Back" data-tap data-b="back" style="position:absolute;left:var(--gut);top:8px;z-index:3" onClick=${p.onBack}><${Ico} n="back"/></button>`;
  var seats = function(l){ return html`<div class="seats" style="margin-top:12px"><${Seat} hero=${me} label=${"You · " + firstName(nameOf(me))}/><div class="thread"></div><${Seat} label=${l} dots=${true}/></div>`; };
  var body = null;
  if(v === "phone") body = html`<div class="wr" data-b="waiting-phone">${back}<div class="stack">${sun()}<div class="h"><h1>Waiting for your friend</h1><p>Tell them this code, or send it from your phone.</p></div>
      <div class="codes">${code.split("").map(function(c){ return html`<b>${c}</b>`; })}</div>${seats("Waiting")}</div>
      <div class="btns"><button class="btn" data-tap data-b="share" onClick=${function(){ var t = "Join my Dawnblade table: " + code; try { if(root.navigator.share) root.navigator.share({text: t}); else root.navigator.clipboard.writeText(t); } catch(e){} }}><${Ico} n="share" style="width:22px;height:22px"/>Share the code</button></div></div>`;
  else if(v === "server") body = html`<div class="wr" style="--btnh:138px" data-b="waiting-server">${back}<div class="stack">${sun()}<div class="h"><h1>Finding you a table</h1><p>${p.typical ? "The usual wait is about " + p.typical + " seconds." : "Looking for another player."}</p></div>${seats("Looking")}</div>
      <div class="btns"><button class="btn" data-tap data-b="play-ai" onClick=${p.onPlayAI}>Play the AI while you wait</button><button class="btn sec" data-tap data-b="stop" onClick=${p.onBack}>Stop looking</button></div></div>`;
  else if(v === "fail") body = html`<div class="wr" style="--btnh:138px" data-b="waiting-fail">${back}<div class="stack">${sun(true)}<div class="h"><h1>We could not reach the server</h1><p>Check your connection. Nothing is lost, and the AI is always at the table.</p></div></div>
      <div class="btns"><button class="btn" data-tap data-b="again" onClick=${p.onAgain}>Try again</button><button class="btn sec" data-tap data-b="play-ai" onClick=${p.onPlayAI}>Play the AI instead</button></div></div>`;
  else if(v === "quiet") body = html`<div class="frame" data-b="waiting-quiet"><div class="scrim"></div><div class="panel"><h2>Waiting for ${p.name || "your friend"}'s phone</h2><p>Their connection dropped. The table keeps your place and carries on the moment they are back.</p>
      <p style="margin-top:12px"><span class="lab" style="color:var(--brass-hi)">Waiting</span><${Dots}/></p><button class="btn sec" data-tap data-b="leave" onClick=${p.onLeave}>Leave the table</button></div></div>`;
  return html`<div class="scr f9" data-b="waiting">${v === "quiet" ? body : html`<div class="bg" style="position:absolute;inset:0;background:var(--mat-bg)"></div><div class="frame">${body}</div>`}</div>`;
}

return {Sprite: Sprite, Title: Title, Ways: Ways, Heroes: Heroes, SitDown: SitDown, Menu: Menu, Result: Result, Rules: Rules, Waiting: Waiting, Thinking: Thinking, modeRows: modeRows, seatingLocal: seatingLocal, seatingNet: seatingNet, netStage: netStage, rematchKind: rematchKind, findOpponent: findOpponent,
        catalog: catalog, store: store, readLast: readLast, firstName: firstName, K_SPEED: K_SPEED, K_COACH: K_COACH};
});
