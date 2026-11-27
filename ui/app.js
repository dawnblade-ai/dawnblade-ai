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
   The table's hub buttons are read through their data-b names (hub-left "Menu", hub-right, bout): when DawnUITable.Live takes
   onMenu / onPad props the interception below can go.
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
function fromQuery(search){
  const K = root.DawnUIFlow, q = new URLSearchParams(search || ""), cat = K.catalog;
  const last = K.readLast() || {}, has = k => !!cat.byKey(k);
  const hero = has(q.get("hero")) ? q.get("hero") : has(last.hero) ? last.hero : cat.list()[0].k;
  const foe = has(q.get("foe")) && q.get("foe") !== hero ? q.get("foe") : has(last.foe) && last.foe !== hero ? last.foe : cat.draw(hero);
  const first = q.get("first") === "1" ? 1 : q.get("first") === "0" ? 0 : (Math.random() < .5 ? 0 : 1);
  const base = {screen: "f1", hero, foe, first, mode: "hero", game: 0, v: q.get("v") || "phone", peek: q.get("peek") || null, query: null, menu: false};
  const sc = q.get("screen");
  if(/^f[1-4]$|^f9$/.test(sc || "")) return {...base, screen: sc};
  if(q.has("hero") || q.has("foe") || q.has("seed") || sc === "table")
    return {...base, screen: "table", query: Object.fromEntries(q.entries()), game: 1};
  return base;
}

/* ---- the table and what lies over it ---- */
function TableScreen(p){
  const P = root.htmPreact, html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
  const K = root.DawnUIFlow, Pad = root.DawnUIPad, A = root.DawnAnnounce;
  const made = useState(() => { try { return {s: root.DawnUISession.openLocal({query: p.query})}; } catch(e){ return {err: e}; } })[0];
  const s = made.s;
  const pad = useRef(null), log = useRef([]), conceded = useRef(false);
  const tick = useState(0), bump = () => tick[1](n => n + 1);
  const ov = useState({menu: false, pad: false}), over = ov[0], setOver = ov[1];
  const st = useState({over: null, think: false}), live = st[0], setLive = st[1];
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
      if(state.over){ setLive({over: state.over, think: false}); return; }
      setLive(x => x.think || x.over ? {over: null, think: false} : x);
      /* a beat of silence while the other seat holds the move: the quiet chip (F9 ai) */
      timer.current = setTimeout(() => { if(!s.state().over && s.holder() === 1 - s.seat) setLive(x => ({...x, think: true})); }, 600);
    });
    s.start();
    return () => { off1(); off2(); clearTimeout(timer.current); s.dispose(); if(current === s) current = null; };
  }, []);
  if(!s) return html`<${Failed} why=${String(made.err && made.err.message || made.err)}/>`;

  const names = [s.names[0] ? K.catalog.byKey(s.heroKeys[0]) && K.firstName(K.catalog.byKey(s.heroKeys[0]).n) || "You" : "You", K.firstName(K.catalog.byKey(s.heroKeys[1]) ? K.catalog.byKey(s.heroKeys[1]).n : s.names[1])];
  const first = s.pick ? s.pick.first : 0;
  const turn = s.state().turn | 0;
  const shut = () => setOver({menu: false, pad: false});
  /* the table's hub buttons and the bout, read by their names (capture phase: before the table's own handlers) */
  const grab = e => {
    const t = e.target && e.target.closest ? e.target.closest('[data-b="hub-left"],[data-b="hub-right"],[data-b="bout"]') : null;
    if(!t || live.over) return;
    const b = t.getAttribute("data-b");
    if(b === "hub-left" && t.getAttribute("aria-label") !== "Menu") return;
    e.stopPropagation(); e.preventDefault();
    setOver(b === "hub-left" ? {menu: true, pad: false} : {menu: false, pad: true});
  };
  const concede = () => { conceded.current = true; shut(); s.submit({t: "concede"}); };
  const exit = to => { p.onExit(to); };
  return html`<div class="tablewrap" style="display:contents" onClickCapture=${grab}>
    <${root.DawnUITable.Live} session=${s}/>
    <div class="stage fl ov" data-b="overlay">
      ${over.menu && !live.over ? html`<${K.Menu} session=${s} director=${dir()} log=${log.current} onClose=${shut} onConcede=${concede}/>` : null}
      ${over.pad && !live.over ? html`<${Pad.PadSheet} pad=${pad.current} names=${names} first=${first} turn=${turn} onClose=${shut}/>` : null}
      ${live.think && !live.over && !over.menu && !over.pad ? html`<${K.Thinking} name=${names[1]}/>` : null}
      ${live.over ? html`<${K.Result} key="result" director=${dir()} pad=${pad.current} names=${names} first=${first} turn=${turn} winner=${live.over.winner} conceded=${conceded.current}
        onRematch=${() => exit({screen: "f4", first: 1 - first})} onNew=${() => exit({screen: "f3", mode: "foe"})} onLeave=${() => exit({screen: "f1"})}/>` : null}
    </div></div>`;
}

function App(){
  const P = root.htmPreact, html = P.html, useState = P.useState;
  const K = root.DawnUIFlow, cat = K.catalog, D = dir();
  const st = useState(() => fromQuery(root.location && root.location.search)), s = st[0], setS = st[1];
  const nav = patch => setS(x => ({...x, ...patch}));
  const go = (screen, patch) => nav({screen, ...(patch || {})});
  const play = () => nav({screen: "table", query: {hero: s.hero, foe: s.foe, first: String(s.first)}, game: s.game + 1});
  const sit = (patch) => nav({screen: "f4", mode: "hero", ...(patch || {})});
  let body;
  switch(s.screen){
    case "table": body = html`<${TableScreen} key=${s.game} query=${s.query} onExit=${to => nav({...to, query: null, menu: false})}/>`; break;
    case "f2": body = html`<${K.Ways} onBack=${() => go("f1")} onAI=${() => go("f3", {mode: "hero"})}/>`; break;
    case "f3": body = html`<${K.Heroes} key=${s.mode + (s.peek || "")} mode=${s.mode} current=${s.mode === "foe" ? s.foe : s.hero} peek=${s.peek}
        onBack=${() => go(s.mode === "foe" ? "f4" : "f2")}
        onPick=${k => s.mode === "foe" ? sit({foe: k, peek: null}) : sit({hero: k, foe: s.foe === k ? cat.draw(k) : s.foe, peek: null})}/>`; break;
    case "f4": body = html`<${K.SitDown} key=${s.hero + s.foe + s.first} hero=${s.hero} foe=${s.foe} first=${s.first} director=${D}
        onBack=${() => go("f1")} onHero=${() => go("f3", {mode: "hero"})} onFoe=${() => go("f3", {mode: "foe"})} onShuffle=${play}/>`; break;
    case "f9": body = html`<${K.Waiting} v=${s.v} hero=${s.hero} onBack=${() => go("f2")} onLeave=${() => go("f1")} onPlayAI=${() => sit({foe: cat.draw(s.hero)})}/>`; break;
    default: body = html`<${K.Title} onPlay=${() => sit({foe: cat.draw(s.hero), first: Math.random() < .5 ? 0 : 1})} onHero=${() => go("f3", {mode: "hero"})} onWays=${() => go("f2")}
        onGear=${() => nav({menu: true})}/>`;
  }
  if(s.screen === "table") return body;
  return html`<div class="stage fl" data-screen=${s.screen}><${K.Sprite}/>${body}
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
