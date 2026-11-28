/* ============================================================
   ui/app.js — DawnUIApp: the screen router (README step 7). Title -> ways -> hero -> sit down -> TABLE -> result, and the
   menu, the pad and the thinking chip over the table.  boot.js calls `mount(el)` once the phone contract is set.

     F1 Title   PLAY goes straight to F4 with the last choices (Q12); the gear opens the menu (sound, speed)
     F2 Ways    F3 Heroes (the grid and the peek)   F4 Sit down (you below, them above, the coin)   F9 Waiting (?screen=f9&v=...)
     TABLE      DawnUITable.Live on a ui/session.js local session; over it: F8 menu (the hub's dots), F6 pad (the hub's pad button
                or a tap on the bout), F9 "thinking" chip, F7 result (the KO word, then the result pad)
     URL        ?hero=&foe=&seed=&first=&pace= opens the TABLE at once (drives, links); ?screen=f1|f2|f3|f4|f9 opens a screen
                (&v= for f9, &peek=<hero> for f3); nothing in the URL opens the title.
   A failed deal is said on screen, in words. `DawnUIApp.session()` is the live session (drives reach it there);
   `DawnUIApp.director()` is the ONE animation director the flow screens use (the speed setting reaches it).
   The table's hub dots and pad button (and a tap on the bout) reach this router through DawnUITable.Live's onMenu / onPad props.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUIApp = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

let current = null, director = null, audioOn = false;

function dir(){
  if(director) return director;
  const D = root.DawnUIDirector;
  if(!D) return null;
  director = D.create({root: root.document, speed: root.DawnUIFlow.store(root.DawnUIFlow.K_SPEED) || "standard"});
  return director;
}
function sound(){
  if(audioOn || !root.DawnUIAudio) return;
  audioOn = true;
  try { root.DawnUIAudio.init(); } catch(e){}
}

function Failed(p){
  const html = root.htmPreact.html;
  return html`<div class="stage fail" data-state="failed">
    <div class="failbox"><b>The table could not be dealt.</b><p>${p.why}</p><a class="classic" href="index.html">Classic board</a></div>
  </div>`;
}

/* ---- what the URL asks for ---- */
const newSeed = () => String(Math.floor(Math.random() * 1e9));
function fromQuery(search){
  const K = root.DawnUIFlow, q = new URLSearchParams(search || ""), cat = K.catalog;
  const last = K.readLast() || {}, has = k => !!cat.byKey(k);
  const hero = has(q.get("hero")) ? q.get("hero") : has(last.hero) ? last.hero : cat.list()[0].k;
  const foe = q.get("foe") === "dummy" ? "dummy" : has(q.get("foe")) && q.get("foe") !== hero ? q.get("foe") : has(last.foe) && last.foe !== hero ? last.foe : cat.draw(hero);
  const urlFirst = q.get("first") === "1" ? 1 : q.get("first") === "0" ? 0 : null;
  const base = {screen: "f1", hero, foe, kind: foe === "dummy" ? "dummy" : "ai", seed: newSeed(), choice: null, urlFirst, mode: "hero", game: 0, v: q.get("v") || "phone",
    peek: q.get("peek") || null, query: null, menu: false, rules: false, session: null, pre: null, net: null, netErr: null, typical: null, roomCode: null, pace: q.get("pace"), join: q.get("join") || null};
  const sc = q.get("screen");
  if(/^f[1-4]$|^f9$/.test(sc || "")) return {...base, screen: sc};
  if(base.join) return {...base, screen: "f9", kind: "phones"};
  if(q.has("hero") || q.has("foe") || q.has("seed") || sc === "table")
    return {...base, screen: "table", query: Object.fromEntries(q.entries()), game: 1};
  return base;
}

/* the Peer a drive may install first (two phones in one page, offline); the real one loads from the CDN */
const peerSeam = () => root.__dawnPeer ? {Peer: root.__dawnPeer} : {};
const MANUAL = {throw: true, seat: true};

/* the hunt for an opponent at the server table (flow.js findOpponent over the session's networked door) */
let finder = null;
function stopFinder(){ if(finder){ try { finder.cancel(); } catch(e){} finder = null; } }
function startFinder(hero, hooks){
  const ST = root.DawnServerTable, S = root.DawnUISession;
  const transport = ST.defaultTransport(root.SERVER_TABLE), identity = ST.defaultIdentity(root.SERVER_TABLE, S.pageStore(root));
  finder = root.DawnUIFlow.findOpponent({
    seek: q => ST.seek({transport, identity}, q),
    open: table => S.openNetworked({how: "server-join", code: table, hero, manual: MANUAL}, root).start(),
    setTimer: (f, ms) => setTimeout(f, ms), clearTimer: h => clearTimeout(h)
  }, hooks);
}

/* ---- the table and what lies over it ---- */
function TableScreen(p){
  const P = root.htmPreact, html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
  const K = root.DawnUIFlow, Pad = root.DawnUIPad, A = root.DawnAnnounce;
  const made = useState(() => { try { return {s: p.session || root.DawnUISession.openLocal({query: p.query})}; } catch(e){ return {err: e}; } })[0];
  const s = made.s;
  const pad = useRef(null), log = useRef([]), conceded = useRef(false);
  const tick = useState(0), bump = () => tick[1](n => n + 1);
  const ov = useState({menu: false, pad: false}), over = ov[0], setOver = ov[1];
  const st = useState({over: null, think: false}), live = st[0], setLive = st[1];
  const dr = useState(false), dropped = dr[0], setDropped = dr[1];
  const ask = useState(null), asking = ask[0], setAsking = ask[1];
  const timer = useRef(null);
  if(s && !pad.current){ const g = s.state(); pad.current = Pad.empty([g.sides[0].hp, g.sides[1].hp]); }
  useEffect(() => {
    if(!s) return;
    current = s;
    const off1 = s.onStep(step => {
      pad.current = Pad.record(pad.current, step);
      try { A.say(step, s.seat).forEach(l => { if(l.k !== "life" && l.k !== "again") log.current.push({head: l.head, sub: l.sub || ""}); }); } catch(e){}
      bump();
    });
    const off2 = s.subscribe(state => {
      clearTimeout(timer.current);
      if(!state) return;
      if(state.over){ setLive({over: state.over, think: false}); return; }
      setLive(x => x.think || x.over ? {over: null, think: false} : x);
      /* a beat of silence while the other seat holds the move: the quiet chip (F9 ai) */
      timer.current = setTimeout(() => { if(!s.state().over && s.holder() === 1 - s.seat) setLive(x => ({...x, think: true})); }, 600);
    });
    /* a networked table: the other phone going quiet mid-game is F9 "quiet" (the table keeps the place) */
    const off3 = s.onPhase ? s.onPhase(ph => setDropped(K.netStage(s) === "drop")) : null;
    const poll = s.networked ? setInterval(() => setDropped(K.netStage(s) === "drop"), 500) : null;
    if(!s.networked) s.start();
    return () => { off1(); off2(); if(off3) off3(); if(poll) clearInterval(poll); clearTimeout(timer.current); s.dispose(); if(current === s) current = null; };
  }, []);
  if(!s) return html`<${Failed} why=${String(made.err && made.err.message || made.err)}/>`;

  const heroName = k => K.catalog.byKey(k) ? K.firstName(K.catalog.byKey(k).n) : null;
  const names = ["You", heroName(s.heroKeys[1]) || s.names[1] || "They"];
  const first = s.state().first != null ? s.state().first : s.pick ? s.pick.first : 0;
  const turn = s.state().turn | 0;
  const shut = () => setOver({menu: false, pad: false});
  const openMenu = () => { if(!live.over) setOver({menu: true, pad: false}); };
  const openPad = () => { if(!live.over) setOver({menu: false, pad: true}); };
  const concede = () => { conceded.current = true; shut(); s.submit({t: "concede"}); };
  const exit = to => { p.onExit(to); };
  /* REMATCH (F7): local — the session deals a fresh game and F4 seats it; server — both ask, the referee opens a table; a room has none */
  const kind = K.rematchKind(s);
  const rematch = () => {
    if(kind === "local"){ try { const next = s.rematch(); exit({screen: "f4", pre: next, kind: s.dummy ? "dummy" : "ai", hero: s.pick.hero, foe: s.pick.foe}); } catch(e){ exit({screen: "f2"}); } return; }
    if(kind === "none") return exit({screen: "f2"});
    setAsking(true);
    const go = () => s.again().then(next => exit({screen: "f4", net: next, kind: "online", hero: s.pick.hero}), () => setAsking(false));
    const r = s.rematch && s.rematch();
    if(r && r.table) return go();
    s.onRematch(x => { if(x && x.table) go(); });
    s.askRematch().then(x => { if(x && x.state === "ready") go(); }, () => setAsking(false));
  };
  return html`<div class="tablewrap" style="display:contents">
    <${root.DawnUITable.Live} session=${s} director=${dir()} onMenu=${openMenu} onPad=${openPad}/>
    <div class="stage fl ov" data-b="overlay">
      ${over.menu && !live.over ? html`<${K.Menu} session=${s} director=${dir()} log=${log.current} onClose=${shut} onConcede=${concede}/>` : null}
      ${over.pad && !live.over ? html`<${Pad.PadSheet} pad=${pad.current} names=${names} first=${first} turn=${turn} onClose=${shut}/>` : null}
      ${live.think && !live.over && !over.menu && !over.pad ? html`<${K.Thinking} name=${names[1]}/>` : null}
      ${dropped && !live.over ? html`<${K.Waiting} v="quiet" name=${names[1]} onLeave=${() => exit({screen: "f1"})}/>` : null}
      ${live.over ? html`<${K.Result} key="result" director=${dir()} pad=${pad.current} names=${names} first=${first} turn=${turn} winner=${live.over.winner} conceded=${conceded.current}
        rematchLabel=${kind === "none" ? "New table" : asking ? "Asking " + names[1] + "…" : "Rematch"} rematchBusy=${!!asking}
        onRematch=${rematch} onNew=${() => exit({screen: "f3", mode: "foe"})} onLeave=${() => exit({screen: "f1"})}/>` : null}
    </div></div>`;
}

function App(){
  const P = root.htmPreact, html = P.html, useState = P.useState, useEffect = P.useEffect;
  const K = root.DawnUIFlow, cat = K.catalog, D = dir(), S = root.DawnUISession;
  const st = useState(() => fromQuery(root.location && root.location.search)), s = st[0], setS = st[1];
  const tk = useState(0), bump = () => tk[1](n => n + 1);
  const nav = patch => setS(x => ({...x, ...patch}));
  const go = (screen, patch) => nav({screen, ...(patch || {})});
  const modes = S.modes(root);
  const dropPre = () => { if(s.pre){ try { s.pre.dispose(); } catch(e){} } };
  const dropNet = () => { stopFinder(); if(s.net){ try { s.net.dispose(); } catch(e){} } };
  /* F4: a fresh seed, a fresh coin */
  const sit = patch => nav({screen: "f4", mode: "hero", seed: newSeed(), choice: null, pre: null, net: null, netErr: null, ...(patch || {})});
  const fail = why => nav({screen: "fail", why});

  /* a networked surface in play: re-render on its phases and awaits, and every beat while it waits (the lobby has no event for "the friend arrived") */
  useEffect(() => {
    if(!s.net) return;
    const offs = [s.net.onPhase(bump), s.net.onAwait(bump)];
    const t = setInterval(bump, 400);
    return () => { offs.forEach(f => f()); clearInterval(t); };
  }, [s.net]);
  useEffect(() => { if(s.screen === "f9" && s.join && !s.net && !s.netErr){ nav({join: null}); openRoom(s.hero, "room-guest", s.join); } }, []);
  const stage = s.net || s.netErr ? K.netStage(s.net, s.netErr) : null;
  useEffect(() => {
    if(s.screen === "f9" && stage === "sit") nav({screen: "f4", mode: "hero"});
    if(s.screen === "f9" && stage === "play") nav({screen: "f4", mode: "hero"});
  }, [stage, s.screen]);

  const openRoom = (hero, how, code0) => {
    try {
      const code = code0 || root.DawnRoom.makeCode();   /* the host claims a fresh four-letter table */
      const net = S.openNetworked({how, hero, code, manual: MANUAL, ...peerSeam(),
        onStatus: st => { if(st === "closed" || st === "error"){ net.dropped = true; bump(); } }}, root);
      net.start().then(() => bump(), e => nav({netErr: e || new Error("the table could not open")}));
      nav({screen: "f9", kind: "phones", v: "phone", net, netErr: null, hero, roomCode: code});
    } catch(e){ nav({screen: "f9", kind: "phones", v: "fail", netErr: e}); }
  };
  const openServer = hero => {
    nav({screen: "f9", kind: "online", v: "server", net: null, netErr: null, hero, typical: null});
    try { startFinder(hero, {onSurface: (net, info) => nav({net, typical: info.typical}), onFail: e => nav({netErr: e || new Error("the server could not be reached")})}); }
    catch(e){ nav({netErr: e}); }
  };
  /* a hero picked in F3: the next step depends on what was chosen at F2 */
  const picked = k => {
    if(s.mode === "foe") return sit({foe: k, kind: "ai", peek: null});
    if(s.kind === "phones") return openRoom(k, "room-host");
    if(s.kind === "online") return openServer(k);
    sit({hero: k, foe: s.kind === "dummy" ? "dummy" : s.foe === k || s.foe === "dummy" ? cat.draw(k) : s.foe, peek: null});
  };

  let body;
  switch(s.screen){
    case "table": body = html`<${TableScreen} key=${s.game} query=${s.query} session=${s.session}
      onExit=${to => nav({session: null, query: null, menu: false, net: null, ...to})}/>`; break;
    case "fail": body = html`<div class="scr"><div class="frame"><div class="failbox"><b>The table could not be dealt.</b><p>${s.why}</p><button class="btn" data-tap data-b="back" onClick=${() => go("f1")}>Back to the title</button></div></div></div>`; break;
    case "f2": body = html`<${K.Ways} modes=${modes} onBack=${() => go("f1")} onRules=${() => nav({rules: true})}
        onDummy=${() => go("f3", {mode: "hero", kind: "dummy"})} onAI=${() => go("f3", {mode: "hero", kind: "ai"})}
        onPhones=${() => go("f3", {mode: "hero", kind: "phones"})} onServer=${() => go("f3", {mode: "hero", kind: "online"})}/>`; break;
    case "f3": body = html`<${K.Heroes} key=${s.mode + (s.peek || "")} mode=${s.mode} current=${s.mode === "foe" ? s.foe : s.hero} peek=${s.peek}
        onBack=${() => go(s.mode === "foe" ? "f4" : "f2")} onPick=${picked}/>`; break;
    case "f4": {
      const dummy = s.foe === "dummy" && !s.net;
      let seating, shuffle, choose = () => {}, foeKey = s.foe;
      if(s.net){
        const lob = s.net.lobby && s.net.lobby(), fk = lob && lob.heroes && lob.heroes[1 - s.net.seat];
        foeKey = fk && cat.byKey(fk) ? fk : cat.list()[0].k;
        seating = K.seatingNet(s.net, K.firstName((cat.byKey(foeKey) || {}).n));
        choose = id => { const why = s.net.awaiting() === "throw" ? s.net.throwNow(id) : s.net.callSeating(id); if(!why) bump(); };
        shuffle = () => nav({screen: "table", session: s.net, game: s.game + 1});
      } else if(s.pre){
        seating = K.seatingLocal(s.pre.seating || {winner: 0, first: 0, needsChoice: false}, K.firstName((cat.byKey(s.foe) || {}).n), dummy);
        shuffle = () => nav({screen: "table", session: s.pre, pre: null, game: s.game + 1});
      } else {
        const call = s.urlFirst != null ? {winner: s.urlFirst === 0 ? 0 : 1, first: s.urlFirst, needsChoice: false} : S.coinCall(s.seed, root, s.choice);
        seating = K.seatingLocal(call, K.firstName((cat.byKey(s.foe) || {}).n), dummy, s.choice);
        choose = id => nav({choice: id});
        shuffle = () => {
          try {
            const sess = S.openLocal({query: {hero: s.hero, foe: s.foe, seed: s.seed, ...(s.pace != null ? {pace: s.pace} : {})}, first: dummy ? 0 : call.first}, root);
            nav({screen: "table", session: sess, game: s.game + 1});
          } catch(e){ fail(String(e && e.message || e)); }
        };
      }
      body = html`<${K.SitDown} key=${s.hero + foeKey + (s.seed || "") + (seating.text || "") + (seating.choices ? "c" : "")} hero=${s.hero} foe=${foeKey} seating=${seating} net=${!!s.net} director=${D}
        onBack=${() => { dropPre(); dropNet(); go("f1", {pre: null, net: null}); }} onHero=${() => go("f3", {mode: "hero"})} onFoe=${() => go("f3", {mode: "foe"})}
        onChoose=${choose} onShuffle=${shuffle}/>`;
      break;
    }
    case "f9": {
      const v = stage === "fail" ? "fail" : s.kind === "online" || s.v === "server" ? "server" : s.v === "quiet" || s.v === "fail" ? s.v : "phone";
      const code = s.roomCode ? String(s.roomCode).toUpperCase() : s.join ? String(s.join).toUpperCase() : "K7QM";
      body = html`<${K.Waiting} v=${v} hero=${s.hero} code=${code} typical=${s.typical}
        onBack=${() => { dropNet(); go("f2", {net: null, netErr: null}); }}
        onAgain=${() => { if(s.kind === "online"){ dropNet(); openServer(s.hero); } else if(s.kind === "phones"){ dropNet(); openRoom(s.hero, "room-host"); } else nav({v: "server", netErr: null}); }}
        onLeave=${() => { dropNet(); go("f1", {net: null}); }}
        onPlayAI=${() => { dropNet(); sit({foe: cat.draw(s.hero), kind: "ai", net: null}); }}/>`;
      break;
    }
    default: body = html`<${K.Title} onPlay=${() => sit({foe: cat.draw(s.hero), kind: "ai"})} onHero=${() => go("f3", {mode: "hero"})} onWays=${() => go("f2")} onRules=${() => nav({rules: true})}
        onGear=${() => nav({menu: true})}/>`;
  }
  if(s.screen === "table") return body;
  return html`<div class="stage fl" data-screen=${s.screen}><${K.Sprite}/>${body}
    ${s.rules ? html`<${K.Rules} onClose=${() => nav({rules: false})}/>` : null}
    ${s.menu ? html`<${K.Menu} variant="title" director=${D} onClose=${() => nav({menu: false})}/>` : null}</div>`;
}

function mount(el){
  const P = root.htmPreact, html = P.html;
  sound();
  try { P.render(html`<${App}/>`, el); }
  catch(e){ P.render(html`<${Failed} why=${String(e && e.message || e)}/>`, el); }
  return current;
}

return {mount, session: () => current, director: dir, fromQuery};
});
