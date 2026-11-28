/* ============================================================
   CRESCENDO — ui/sheets.js  ·  DawnUISheets: the prompt sheets
   docs/crescendo/SCREENS-FLOW.md F5 · mockups/flow-5-prompts.html · engine/prompts.js

   ONE sheet for every question the engine can ask a seat: the eight tags
   `buildPrompt` builds — opt pick modal pay soak reveal target alloc.

   TWO HALVES.
     model(prompt, view, ui)  PURE. The built prompt (what `state.prompt` holds, the object `buildPrompt` returned)
                              in, a descriptor out: title, hint, source, chip, body items, primary and secondary
                              buttons, a reason line. Every control carries `actions`: the engine actions
                              (`judge.PROMPT_ACTIONS`) it sends, in order. Node drills it (test/ui-prompts.test.js).
     Sheet({prompt, view, onAnswer, ...})  the Preact + htm render of a model (window.htmPreact). `onAnswer(action)`
                              is called once per engine action, in order; the table submits each through the session.

   WHAT IT NEVER DOES.
   - It never decides whether an answer is legal: `ready` is `prompts.promptReady`, a toggle's refusal is
     `promptToggleSel`'s (the control is merely drawn disabled when the module would refuse it). The engine is the judge.
   - It never invents a card name or text: names, art and numbers come from the prompt's own cards; the source
     thumbnail from `view.cardOf(name)` when the table can supply it.
   - It never shows a seat a question addressed to the other seat (a "waiting" model carries no cards), except a
     reveal, which both players see.
   ============================================================ */
(function(root, factory){
  var PM = (typeof module === "object" && module.exports) ? require("../engine/prompts.js") : root.DawnPrompts;
  if(typeof module === "object" && module.exports) module.exports = factory(root, PM);
  else root.DawnUISheets = factory(root, PM);
})(typeof self !== "undefined" ? self : this, function(root, PM){

var TAGS = ["opt", "pick", "modal", "pay", "soak", "reveal", "target", "alloc"];

/* ---- the engine actions a sheet can send (judge.PROMPT_ACTIONS) ---- */
var ACT = {
  sel:     function(i){ return {t: "promptSel", i: i}; },
  choose:  function(c){ return {t: "promptChoose", choice: c}; },
  confirm: function(){ return {t: "promptConfirm"}; },
  decline: function(){ return {t: "promptDecline"}; },
  back:    function(){ return {t: "promptTakeBack"}; },
  move:    function(i, d){ return {t: "promptMove", i: i, dir: d}; }
};

var plain = function(s){ return String(s == null ? "" : s).replace(/\s+[—-]\s+(ability|hero power)$/i, ""); };
var upper = function(s){ return String(s == null ? "" : s).toUpperCase(); };
var has = function(n){ return n != null && n !== "" && !isNaN(+n); };

function cardItem(c, i){
  return {i: i, name: c && c.name || "", card: c, img: c && (c.img || c.dbImg) || null, hidden: !!(c && c.hidden),
          pitch: c && has(c.pitch) && +c.pitch > 0 ? +c.pitch : 0, cost: c && c.cost, power: c && c.power, def: c && c.def};
}
function btn(label, actions, enabled, o){
  var b = {label: label, actions: actions || [], enabled: enabled !== false};
  if(o) for(var k in o) b[k] = o[k];
  return b;
}
function names(view){ return (view && view.names) || []; }

/* the actions a model can send, flattened (a drill's list of controls) */
function answersOf(m){
  var out = [];
  var add = function(b){ if(b && b.actions) b.actions.forEach(function(a){ out.push(a); }); };
  if(!m) return out;
  (m.items || []).forEach(add);
  (m.controls || []).forEach(add);
  add(m.primary); add(m.secondary);
  return out;
}

/* ============================================================
   model
   ============================================================ */
function model(p, view, ui){
  if(!p || TAGS.indexOf(p.tag) < 0) return null;
  view = view || {}; ui = ui || {};
  var seat = view.seat, mine = seat == null || seat === p.side;
  var m = {tag: p.tag, side: p.side, mine: mine, waiting: false,
    title: p.title || "", hint: p.hint || "", source: {name: plain(p.src), raw: p.src || ""},
    chip: p.tag === "reveal" ? "LOOK ONLY" : "YOUR CHOICE",
    items: [], controls: [], primary: null, secondary: null, reason: "", layout: "cards"};
  /* a question for the other seat: no cards, no facts, only that it is being asked */
  if(!mine && p.tag !== "reveal"){
    var who = names(view)[p.side] || "They";
    m.waiting = true; m.layout = "waiting"; m.chip = "THEIR CHOICE"; m.title = who + " is choosing"; m.hint = "";
    m.source = {name: "", raw: ""};
    return m;
  }
  var ready = PM.promptReady(p);
  var sel = p.sel || [];

  if(p.tag === "pick"){
    var max = p.max, min = p.min;
    m.items = (p.cards || []).map(function(c, i){
      var on = sel.indexOf(i) >= 0, full = sel.length >= max;
      var it = cardItem(c, i); it.selected = on;
      /* a one-card pick swaps: untick the old, tick the new, so a tap is never a refusal */
      var acts = on ? [ACT.sel(i)] : (full && max === 1 && sel.length === 1) ? [ACT.sel(sel[0]), ACT.sel(i)] : [ACT.sel(i)];
      it.enabled = on || !full || max === 1;
      it.actions = it.enabled ? acts : [];
      if(!it.enabled) it.why = "PICK UP TO " + max;
      return it;
    });
    m.reason = p.filters ? ("ONE OF EACH · " + sel.length + " OF " + max + " CHOSEN")
      : max === 1 ? (min === 0 ? "PICK 1 OR NONE" : "PICK 1")
      : "PICK " + (min === max ? max : "UP TO " + max) + " · " + sel.length + " CHOSEN";
    m.primary = btn(max > 1 && sel.length ? "CHOOSE " + sel.length : "CHOOSE", [ACT.confirm()], ready);
    if(p.optional) m.secondary = btn("NO THANKS", [ACT.decline(), ACT.confirm()], true);
  }
  else if(p.tag === "reveal"){
    m.items = (p.cards || []).map(function(c, i){ var it = cardItem(c, i); it.enabled = false; it.actions = []; return it; });
    m.reason = "EVERYONE AT THE TABLE SEES THIS";
    m.primary = btn("GOT IT", [ACT.confirm()], true);
  }
  else if(p.tag === "target"){
    m.layout = "cards";
    m.items = (p.cards || []).map(function(c, i){
      var it = cardItem(c, i); it.selected = p.choice === i; it.enabled = true; it.actions = [ACT.choose(i)];
      it.sub = c && c.life != null ? "LIFE " + c.life : (c && c.kind ? upper(c.kind) : "");
      return it;
    });
    var tc = p.choice != null ? p.cards[p.choice] : null;
    m.reason = tc ? "" : "CHOOSE WHAT YOU ATTACK";
    m.primary = btn(tc ? "TARGET " + upper(tc.name) : "CHOOSE A TARGET", [ACT.confirm()], ready);
  }
  else if(p.tag === "modal"){
    m.layout = "modes";
    var opts = p.options || [];
    m.items = opts.map(function(o, i){
      return {i: i, label: o.label || "", text: o.text || "", selected: p.choice === i, enabled: !o.disabled && !o.why,
              why: o.why ? upper(o.why) : (o.disabled ? "NOT AVAILABLE" : ""),
              actions: (!o.disabled && !o.why) ? [ACT.choose(i)] : []};
    });
    if(opts.length === 1 && p.optional){      /* "you may X": the button is X */
      m.primary = btn(upper(opts[0].label || "DO IT"), [ACT.choose(0), ACT.confirm()], true);
      m.items = [];
    } else {
      m.primary = btn("CHOOSE", [ACT.confirm()], ready);
      m.reason = ready ? "" : "CHOOSE A MODE";
    }
    if(p.optional) m.secondary = btn("NO THANKS", [ACT.decline(), ACT.confirm()], true);
  }
  else if(p.tag === "pay"){
    m.layout = "pay";
    var short = Math.max(0, (p.cost || 0) - (p.avail || 0));
    m.pay = {cost: p.cost || 0, avail: p.avail || 0, short: short, exactPitch: !!p.exactPitch};
    m.primary = btn(p.cost ? "PAY " + p.cost : "PAY", [ACT.choose("pay"), ACT.confirm()], short === 0);
    m.reason = short ? "NEEDS " + short + " MORE" : "YOU CAN REACH " + (p.avail || 0);
    m.secondary = btn("DON'T PAY", [ACT.choose("decline"), ACT.confirm()], true);
  }
  else if(p.tag === "soak"){
    m.layout = "soak";
    var spent = sel.reduce(function(a, k){ return a + ((p.options[k] || {}).cost || 0); }, 0);
    var prevented = sel.reduce(function(a, k){ return a + ((p.options[k] || {}).amount || 0); }, 0);
    m.items = (p.options || []).map(function(o, i){
      var on = sel.indexOf(i) >= 0, can = on || spent + (o.cost || 0) <= p.avail;
      return {i: i, name: o.name || "", kind: o.kind || "", cost: o.cost || 0, amount: o.amount || 0, selected: on, enabled: can,
              why: can ? "" : "NEEDS " + (spent + (o.cost || 0) - p.avail) + " MORE", actions: can ? [ACT.sel(i)] : []};
    });
    m.soak = {amount: p.amount, avail: p.avail, spent: spent, prevented: prevented};
    m.reason = p.amount + " INCOMING · " + (prevented ? "PREVENT " + Math.min(prevented, p.amount) : "TAKE IT ALL");
    m.primary = btn(sel.length ? "SPEND " + spent : "TAKE " + p.amount, [ACT.confirm()], true);
  }
  else if(p.tag === "alloc"){
    m.layout = "alloc";
    var last = sel.length ? sel[sel.length - 1] : -1, full2 = sel.length >= p.max;
    m.items = (p.cards || []).map(function(c, i){
      var it = cardItem(c, i);
      it.count = sel.filter(function(x){ return x === i; }).length; it.selected = it.count > 0;
      it.enabled = !full2; it.actions = full2 ? [] : [ACT.sel(i)];
      it.minus = btn("−", [ACT.back()], i === last);
      it.why = full2 ? "ALL PLACED" : "";
      return it;
    });
    m.controls = [btn("TAKE BACK", [ACT.back()], sel.length > 0, {role: "back"})];
    m.reason = sel.length + " OF " + p.max + " PLACED";
    m.primary = btn(sel.length ? "PLACE " + sel.length : "PLACE NONE", [ACT.confirm()], ready);
    m.secondary = btn("CLEAR", [ACT.decline()], sel.length > 0);
  }
  else if(p.tag === "opt"){
    m.layout = "order";
    var order = PM.optOrder(p), down = p.down || [];
    var kept = order.filter(function(x){ return down.indexOf(x) < 0; });
    var cur = ui.cur != null && p.cards[ui.cur] ? ui.cur : null;
    m.items = (p.cards || []).map(function(c, i){
      var it = cardItem(c, i), pos = kept.indexOf(i);
      it.lane = pos >= 0 ? "top" : "bottom"; it.num = pos >= 0 ? pos + 1 : 0;
      it.selected = cur === i; it.enabled = true; it.local = {cur: i}; it.actions = [];
      return it;
    });
    m.order = {kept: kept, down: down.slice(), cur: cur, keepTop: !!p.keepTop};
    var at = cur != null ? kept.indexOf(cur) : -1;
    m.controls = [
      btn("◀ SOONER", cur != null ? [ACT.move(cur, -1)] : [], at > 0, {role: "sooner"}),
      btn("LATER ▶", cur != null ? [ACT.move(cur, 1)] : [], at >= 0 && at < kept.length - 1, {role: "later"}),
      btn(cur != null && down.indexOf(cur) >= 0 ? "TOP" : (p.keepTop ? "UNDER" : "BOTTOM"), cur != null ? [ACT.sel(cur)] : [], cur != null, {role: "bottom"})
    ];
    m.reason = cur == null ? "TAP A CARD" : "";
    m.primary = btn("DONE", [ACT.confirm()], true);
  }
  m.answers = answersOf(m);
  return m;
}

/* ============================================================
   render (Preact + htm). Pure markup over a model; the only local state is the opt lane's tapped card.
   ============================================================ */
var P = root.htmPreact || {};
var html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;

function Glyphs(p){
  var parts = String(p.s == null ? "" : p.s).split(/\{([a-z])\}/i);
  return parts.map(function(t, i){
    return i % 2 === 0 ? t : t === "r" ? html`<span class="gl-r" aria-label="resource"></span>` : t === "p" ? html`<span class="gl-p" aria-label="pitch"></span>`
      : t === "d" ? html`<span class="gl-d" aria-label="defense"></span>` : t.toUpperCase();
  });
}

function Thumb(p){
  var c = p.card;
  if(c && c.img) return html`<img class=${"sh-img" + (p.cls ? " " + p.cls : "")} alt=${c.name} src=${c.img} decoding="async"/>`;
  return html`<span class=${"sh-img sh-noimg" + (p.cls ? " " + p.cls : "")}>${p.name || (c && c.name) || ""}</span>`;
}

function CardTile(p){
  var it = p.it, cls = "sh-tile" + (it.selected ? " on" : "") + (it.enabled ? "" : " off") + (it.hidden ? " back" : "") + (p.small ? " small" : "") + (it.pitch ? " p" + it.pitch : "");
  var tap = function(){ if(p.onTap) p.onTap(it); };
  return html`<button type="button" class=${cls} data-b=${"tile-" + it.i} aria-pressed=${it.selected ? "true" : "false"} aria-label=${it.name} aria-disabled=${it.enabled ? "false" : "true"} onClick=${tap}>
    ${it.hidden ? html`<span class="sh-back"></span>` : html`<${Thumb} card=${it.card} name=${it.name}/>`}
    ${it.num ? html`<span class="sh-num">${it.num}</span>` : null}
    <span class="sh-nm">${it.name}</span>
    ${it.sub ? html`<span class="sh-sub">${it.sub}</span>` : null}
    ${it.selected ? html`<span class="sh-tick" aria-hidden="true">✓</span>` : null}
  </button>`;
}

function Btn(p){
  var b = p.b; if(!b) return null;
  var go = function(){ if(!b.enabled || p.disabled) return; if(p.onGo) p.onGo(b); };
  return html`<button type="button" class=${"sh-btn " + (p.cls || "") + (b.enabled ? "" : " dis")} data-b=${p.name} aria-disabled=${b.enabled ? "false" : "true"} onClick=${go}>${b.label}</button>`;
}

function Body(p){
  var m = p.m, tap = p.tap;
  if(m.layout === "modes")
    return html`<div class="sh-modes">${m.items.map(function(it){
      return html`<button type="button" class=${"sh-mode" + (it.selected ? " on" : "") + (it.enabled ? "" : " off")} data-b=${"mode-" + it.i} aria-pressed=${it.selected ? "true" : "false"} aria-disabled=${it.enabled ? "false" : "true"} onClick=${function(){ tap(it); }}>
        <span class="sh-radio"></span><span class="sh-modetx"><b><${Glyphs} s=${it.label}/></b>${it.text ? html`<small><${Glyphs} s=${it.text}/></small>` : null}${it.why ? html`<em class="sh-why">${it.why}</em>` : null}</span></button>`;
    })}</div>`;
  if(m.layout === "pay")
    return html`<div class="sh-pay"><div class="sh-coins" aria-label=${"cost " + m.pay.cost}>${Array.from({length: Math.min(m.pay.cost, 8)}).map(function(_, i){
      return html`<span class=${"sh-coin" + (i < m.pay.avail ? " have" : "")}></span>`;
    })}</div><div class="sh-paytx">${m.pay.exactPitch ? "Pitch exactly this much." : "Pitched from your hand if you are short."}</div></div>`;
  if(m.layout === "soak")
    return html`<div class="sh-rows">${m.items.map(function(it){
      return html`<button type="button" class=${"sh-row" + (it.selected ? " on" : "") + (it.enabled ? "" : " off")} data-b=${"soak-" + it.i} aria-pressed=${it.selected ? "true" : "false"} aria-disabled=${it.enabled ? "false" : "true"} onClick=${function(){ tap(it); }}>
        <span class="sh-shield">${it.amount}</span><span class="sh-rowtx"><b>${it.name}</b><small>${it.kind === "spellvoid" ? "destroys the piece" : "costs " + it.cost + " · stays in play"}</small>${it.why ? html`<em class="sh-why">${it.why}</em>` : null}</span>
        <span class=${"sh-check" + (it.selected ? " on" : "")}></span></button>`;
    })}</div>`;
  if(m.layout === "alloc")
    return html`<div class="sh-rows">${m.items.map(function(it){
      return html`<div class=${"sh-row alloc" + (it.selected ? " on" : "")} data-b=${"alloc-" + it.i}>
        <${Btn} b=${it.minus} cls="sh-step" name=${"minus-" + it.i} onGo=${p.go}/>
        <span class="sh-cnt">${it.count}</span>
        <button type="button" class=${"sh-btn sh-step" + (it.enabled ? "" : " dis")} data-b=${"plus-" + it.i} aria-label=${"place on " + it.name} aria-disabled=${it.enabled ? "false" : "true"} onClick=${function(){ tap(it); }}>+</button>
        <span class="sh-rowtx"><b>${it.name}</b>${it.why ? html`<em class="sh-why">${it.why}</em>` : null}</span></div>`;
    })}</div>`;
  if(m.layout === "order"){
    var top = m.items.filter(function(i){ return i.lane === "top"; }).sort(function(a, b){ return a.num - b.num; });
    var bot = m.items.filter(function(i){ return i.lane === "bottom"; });
    return html`<div class="sh-order">
      <div class="sh-lane"><div class="sh-lanelbl">TOP OF YOUR DECK · DRAWN IN THIS ORDER</div><div class="sh-lanecards">${top.map(function(it){ return html`<${CardTile} it=${it} onTap=${tap}/>`; })}${top.length ? null : html`<span class="sh-empty">none</span>`}</div></div>
      <div class="sh-lane bot"><div class="sh-lanelbl">${m.order.keepTop ? "UNDER THE REST" : "BOTTOM OF YOUR DECK"}</div><div class="sh-lanecards">${bot.map(function(it){ return html`<${CardTile} it=${it} small=${true} onTap=${tap}/>`; })}${bot.length ? null : html`<span class="sh-empty">none</span>`}</div></div>
      <div class="sh-ctl">${m.controls.map(function(b){ return html`<${Btn} b=${b} cls="sec" name=${"ctl-" + b.role} onGo=${p.go}/>`; })}</div></div>`;
  }
  /* cards: pick, reveal, target */
  return html`<div class=${"sh-grid n" + Math.min(m.items.length, 6)}>${m.items.map(function(it){ return html`<${CardTile} it=${it} onTap=${tap}/>`; })}</div>`;
}

/* the sheet. props: prompt (the built prompt), view ({seat, names, cardOf}), onAnswer(action), director (optional: the
   sheet rises and drops through it), ui/setUi are internal. */
function Sheet(props){
  var p = props.prompt || props.spec, view = props.view || {};
  var st = useState({cur: null}), ui = st[0], setUi = st[1];
  var wrap = useRef(null), sheetEl = useRef(null), scrimEl = useRef(null);
  var m = model(p, view, ui);
  useEffect(function(){
    var d = props.director;
    if(d && sheetEl.current) d.enqueue({kind: "rise", els: {sheet: sheetEl.current, scrim: scrimEl.current}});
  }, []);
  if(!m) return null;
  var send = function(actions){ (actions || []).forEach(function(a){ if(props.onAnswer) props.onAnswer(a); }); };
  var go = function(b){ send(b.actions); };
  var tap = function(it){ if(it.local) setUi(function(u){ return Object.assign({}, u, it.local); }); else send(it.actions); };
  var srcCard = view.cardOf && m.source.name ? view.cardOf(m.source.name) : null;     /* no card found: the name alone is shown on a plain face, never a placeholder */
  var cn = m.layout === "waiting" ? "sh-sheet waiting" : "sh-sheet " + m.layout;
  return html`<div class="sh-wrap" data-b="prompt" ref=${wrap}>
    <div class="sh-scrim" ref=${scrimEl}></div>
    <div class=${cn} data-b="sheet" role="dialog" aria-label=${m.title} ref=${sheetEl}>
      <div class="sh-ask">
        ${srcCard || m.source.name ? html`<div class="sh-src" data-b="source"><${Thumb} card=${srcCard} name=${m.source.name}/></div>` : null}
        <div class="sh-asktx">
          ${m.source.name ? html`<div class="sh-by"><span>ASKED BY</span><b class=${"sh-chip" + (m.tag === "reveal" ? " look" : m.waiting ? " wait" : "")}>${m.chip}</b></div>` : html`<div class="sh-by"><b class="sh-chip wait">${m.chip}</b></div>`}
          <h2 class="sh-title">${m.title}</h2>
          ${m.hint ? html`<p class="sh-hint"><${Glyphs} s=${m.hint}/></p>` : null}
        </div>
      </div>
      ${m.waiting ? null : html`<div class="sh-body" data-b="body"><${Body} m=${m} tap=${tap} go=${go}/></div>`}
      ${m.waiting ? null : html`<div class="sh-foot" data-b="foot">
        ${m.reason ? html`<div class="sh-reason" data-b="reason">${m.reason}</div>` : null}
        <div class="sh-btns">
          ${m.secondary ? html`<${Btn} b=${m.secondary} cls="sec" name="secondary" onGo=${go}/>` : null}
          <${Btn} b=${m.primary} cls="primary" name="primary" onGo=${go}/>
        </div>
      </div>`}
    </div>
  </div>`;
}

return {model: model, answersOf: answersOf, Sheet: Sheet, TAGS: TAGS, ACT: ACT};
});
