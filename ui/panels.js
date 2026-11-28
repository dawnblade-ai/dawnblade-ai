/* ============================================================
   ui/panels.js — DawnUIPanels: the panels the table opens that are NOT engine prompts (those are ui/sheets.js), and the words on them.
     INSPECT (SCREENS-TABLE T10): a face-up card large, and below it its printed rules text exactly as the pinned
       pool prints it (never reworded), its type line and the numbers it has. Public cards only: a back never opens.
     OPTIONS: the pending questions that are not prompts (a boost / split / X / discard cost ...) and a seat with no
       drawable button: what is legal, as plain buttons, so the game never dead-ends. Every button is an action
       `DawnJudge.legal` already accepted; the last one hands the decision to the coach (the AI policy).
     MENU: the hub's "...": the classic board, sound, a new game.
   Engine PROMPTS (opt pick modal pay soak reveal target alloc) are ui/sheets.js, not here.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUIPanels = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const P = root.htmPreact || {};
const html = P.html;

/* {r} {p} {d} ... in printed text: drawn glyphs for resource, pitch and defence, the letter for the rest */
function Glyphs(p){
  const parts = String(p.s == null ? "" : p.s).split(/\{([a-z])\}/i);
  return parts.map((t, i) => i % 2 === 0 ? t
    : t === "r" ? html`<span class="gl-r" aria-label="resource"></span>`
    : t === "p" ? html`<span class="gl-p" aria-label="pitch"></span>`
    : t === "d" ? html`<svg class="gl-d" viewBox="0 0 24 24" aria-label="defense"><use href="#i-shield"/></svg>`
    : t.toUpperCase());
}
const plain = s => String(s == null ? "" : s).replace(/\{r\}/g, "resource").replace(/\{p\}/g, "pitch").replace(/\{d\}/g, "defense").replace(/\{([a-z])\}/gi, "$1");

/* the card as printed: paragraphs from the pool's own text, "Go again" with its glyph */
function Inspect(p){
  const c = p.card, tx = String(c.tx || "").split("\n").filter(Boolean);
  const pitch = +c.pitch > 0 ? {1: "red", 2: "yellow", 3: "blue"}[c.pitch] : "";
  const chip = (lab, n, cls) => n != null && n !== "" && !isNaN(+n) ? html`<span class=${"chip" + (cls ? " " + cls : "")}><small>${lab}</small>${n}</span>` : null;
  return html`<div class="inspect">
    <div class="veil" data-b="veil" data-tap onClick=${p.onClose}></div>
    <div class="insp-wrap">
      <div class="insp-card" data-b="inspect-card" data-tap onClick=${p.onClose}><div class="cd" style="border-radius:12px;box-shadow:var(--e4)">${c.img ? html`<img alt=${c.name} src=${c.img} decoding="async"/>` : html`<span class="cname">${c.name}</span>`}</div></div>
      <div class="sheet" data-b="sheet">
      <div class="grab"></div>
      <h2>${c.name}</h2>
      <div class="ty">${(c.ty || []).join(" · ")}</div>
      ${tx.length ? html`<div class="tx">${tx.map(l => /^go again$/i.test(l.trim())
        ? html`<p><svg class="gaico" viewBox="0 0 24 24"><use href="#i-go"/></svg>Go again</p>` : html`<p><${Glyphs} s=${l}/></p>`)}</div>` : null}
      <div class="rn">${chip("Cost", c.cost)}${chip("Pitch", +c.pitch > 0 ? c.pitch : null, pitch)}${chip("Power", c.power)}${chip("Defense", c.def)}</div>
      ${p.where ? html`<div class="src">${p.where}</div>` : null}
      </div>
    </div>
  </div>`;
}

/* ---------- OPTIONS: what is legal, as buttons ---------- */

/* every card this seat can name, by uid, for labels */
function named(v, me){
  const sd = v.sides[me], m = new Map();
  [sd.hand, sd.gear, sd.board && sd.board.map(b => b && (b.card || b)), sd.grave, sd.banish, sd.soul, sd.arsenal ? [sd.arsenal] : []]
    .forEach(z => (z || []).forEach(c => { if(c && c.uid != null && c.name) m.set(String(c.uid), c); }));
  (v.chainCards || []).forEach(e => { const c = e && (e.card || e); if(c && c.uid != null) m.set(String(c.uid), c); });
  return m;
}
function labelOf(a, nm){
  const c = a.uid != null ? nm.get(String(a.uid)) : null, n = c ? c.name : "";
  switch(a.t){
    case "play": return "Play " + n;
    case "activate": return (c && /weapon/i.test(c.tt || "") ? "Attack with " : "Use ") + (n || (c ? c.name : "your hero"));
    case "defend": return "Block with " + n;
    case "arsenal": return a.uid == null ? "No arsenal" : "Set " + n + " in arsenal";
    case "pass": return "Pass";
    case "endTurn": return "End turn";
    case "payCancel": return "Cancel the play";
    case "payConfirm": return "Confirm the payment";
    case "boost": case "addPay": return a.yes ? "Yes" : "No";
    case "xval": return a.yes === false ? "No" : "X = " + a.x;
    case "split": return a.half === "both" ? "Both halves" : "Half " + (+a.half + 1);
    default: return (a.t.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, s => s.toUpperCase())) + (n ? " · " + n : a.uid === null ? " · none" : "");
  }
}

/* the answers a pending question could take, probed through legal (the engine says which are real) */
function candidates(kind, v, me){
  const nm = named(v, me), uids = [...nm.keys()].map(k => isNaN(+k) ? k : +k);
  switch(kind){
    case "boost": case "addPay": return [{t: kind, yes: true}, {t: kind, yes: false}];
    case "xval": return [{t: "xval", yes: false}, ...Array.from({length: 12}, (_, x) => ({t: "xval", x}))];
    case "split": return [0, 1, "both"].map(h => ({t: "split", half: h}));
    default: { const t = {discost: "discost", soulcost: "soulcost", boardcost: "boardcost", abtarget: "abtarget", usurp: "usurp",
                          bancost: "bancost", fuse: "fuse", charge: "charge"}[kind];
      return t ? [...uids.map(uid => ({t, uid})), {t, uid: null}, {t, yes: false}] : []; }
  }
}

/* the descriptor: {title, hint, items: [{label, sub, on, act}]} or null when nothing is asked of this seat that the table cannot draw.
   ctx: {seat, legal(a), moves[], holder} */
function sheetOf(v, ctx){
  const me = ctx.seat, nm = named(v, me), L = ctx.legal;
  const item = (act, label, extra) => { const why = act.suggest ? null : L(act); return {label: label || labelOf(act, nm), act, why, on: false, ...(extra || {})}; };
  const coach = {label: "Let the coach choose", act: {suggest: true}, why: null, coach: true};
  const pend = v.pending && v.pending.seat === me ? v.pending : null;
  if(pend && pend.kind !== "pay"){
    const items = candidates(pend.kind, v, me).map(a => item(a)).filter(x => !x.why);
    return {title: "Your call", src: pend.card && pend.card.name, hint: "", items: items.concat([coach])};
  }
  return null;
}

/* a holder with no button the table can draw: every move there is, plainly, so nobody is stuck */
function stuckSheet(v, ctx){
  const nm = named(v, ctx.seat), items = [];
  [...ctx.moves, {t: "pass"}, {t: "endTurn"}, {t: "payCancel"}].forEach(a => { if(ctx.legal(a) == null) items.push({label: labelOf(a, nm), act: a, why: null}); });
  items.push({label: "Let the coach choose", act: {suggest: true}, why: null, coach: true});
  return {title: "Your move", src: "", hint: "", items};
}

function Options(p){
  const s = p.sheet;
  return html`<div class="options" data-b="options">
    <div class="veil" data-b="veil"></div>
    <div class="sheet opts" data-b="sheet" style="bottom:calc(var(--h-hub) + 10px)">
      <div class="grab"></div>
      <h2>${s.title}</h2>
      ${s.src ? html`<div class="ty">${s.src}</div>` : null}
      ${s.hint ? html`<div class="tx"><p>${s.hint}</p></div>` : null}
      <div class="optl">${s.items.map(it => html`<button class=${"opt" + (it.on ? " on" : "") + (it.coach ? " coach" : "") + (it.primary ? " go" : "")} data-tap
        disabled=${!!it.why} title=${it.why || ""} onClick=${() => p.onAct(it.act)}>${it.label}${it.why ? html`<small>${it.why}</small>` : null}</button>`)}</div>
    </div>
  </div>`;
}

/* the menu (the hub's ...): the way back to the classic board, sound, a new game. A minimal sheet for now. */
function Menu(p){
  const A = root.DawnUIAudio, muted = A && A.muted ? A.muted() : null;
  return html`<div class="options menu" data-b="menu">
    <div class="veil" data-b="veil" data-tap onClick=${p.onClose}></div>
    <div class="sheet opts" data-b="sheet" style="bottom:calc(var(--h-hub) + 10px)">
      <div class="grab"></div>
      <h2>Menu</h2>
      <div class="optl">
        <a class="opt" data-tap href="index.html">Classic board</a>
        ${A && A.toggleMute ? html`<button class="opt" data-tap onClick=${() => { A.toggleMute(); p.onClose(); }}>Sound: ${muted ? "off — turn on" : "on — turn off"}</button>` : null}
        <button class="opt" data-tap onClick=${p.onNew}>New game</button>
      </div>
    </div>
  </div>`;
}

return {Inspect, Options, Menu, Glyphs, sheetOf, stuckSheet, labelOf, candidates, named, plain};
});
