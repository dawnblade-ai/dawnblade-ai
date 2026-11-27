/* ============================================================
   ui/table.js — DawnUITable: THE TABLE (docs/crescendo/SCREENS-TABLE.md; mockups/table-*.html are the references
   this is held to, box for box, by tools/ui-drive.js).

   Rendered ONLY from `DawnView.view(state, seat)` (what this seat may know: HIDDEN-HANDS.md) and what
   `DawnJudge.legal` says this seat may do now. A hidden card is a back whose COUNT is public and nothing more.
   `model()` is the pure half (view + legal -> plain data, testable in node); `Table` and `Live` are the Preact half.
   Band structure, top to bottom: bout (HUD) · world (their half, the stage, your half, the tray with the hand) · hub (HUD).

   PLAYABLE (step 3). A tap is an engine ACTION or it is refused BY NAME (the engine's own reason, on a chip over the card):
     T1 rest      hand card ready (a play is legal) / dim; weapon ready; one primary: END TURN / PASS / WAITING
     T2 select    tap a ready card: it lifts, the primary names the play ("Play X"); tap it again to put it down
     T3 pay       the engine opened a payment: tap hand cards to pitch (they fly to the pitch fan, the cost meter fills),
                  the primary plays when paid ("Pitch N more" while short), the cross cancels
     T4 attack    the attack sits on the chain; the AI seat answers through the session, one action per tick
     T6/T9 (placeholders in place) defend: tap a card to block it, the primary is "No block" / "Block with N";
                  the arsenal step: tap a card, "Set in arsenal" / "No arsenal"
     T10 inspect  hold a card 400 ms (or tap a mat card): the card large with its printed text from the pool
   Whatever the engine asks that this table cannot draw yet (a prompt sheet, a boost / split / X question) is a plain
   OPTIONS sheet of the legal answers (ui/sheet.js), so the game never dead-ends.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUITable = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const P = root.htmPreact || {};
const html = P.html, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
const K = root.DawnUICard || {};
const SH = root.DawnUIPanels || {};

/* ---------- the pure half ---------- */

const COLS = ["weapon", "head", "chest", "arms", "legs"];
const ZONE_COL = {"1h": "weapon", "2h": "weapon", off: "weapon", qvr: "weapon", head: "head", chest: "chest", arms: "arms", legs: "legs"};

/* SCREENS-TABLE 1 DEV-1: the lane is eight FIXED columns, the same for both seats: weapon, head, chest, arms, legs,
   graveyard, deck, arsenal. A second piece for a column stacks onto the legs column with a count (never a new column). */
function laneOf(side, game){
  const cols = {weapon: null, head: null, chest: null, arms: null, legs: null};
  let extra = 0;
  (side.gear || []).forEach(g => {
    const col = g.hidden ? COLS.find(k => !cols[k]) : ZONE_COL[game.slotOf(g).z] || "weapon";
    if(!col || cols[col]){ extra++; return; }
    cols[col] = g;
  });
  return {cols, extra};
}

const firstName = n => String(n || "").split(",")[0];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* the phase / step marker */
function pillOf(v){
  if(v.over) return "Game over";
  if(v.step && v.step !== "layer") return cap(v.step) + " step";
  return {start: "Start phase", action: "Action phase", end: "End phase"}[v.phase] || "";
}

/* the permanents a side holds (auras, tokens, allies, items): one little card per kind with a count */
function permsOf(sd){
  const by = new Map();
  (sd.board || []).forEach(b => { const c = b && (b.card || b); if(!c || !c.name) return; const k = c.name; by.has(k) ? by.get(k).n++ : by.set(k, {card: c, n: 1}); });
  return [...by.values()];
}

const lenClass = s => s.length > 30 ? " fit15" : s.length > 17 ? " fit17" : "";

const selI0 = (sel, selArs, hand) => { const u = selArs ? selArs.uid : sel && sel.from === "hand" ? sel.uid : null; return u == null ? -1 : hand.findIndex(x => x.card.uid === u); };

/* view + what is legal -> everything the table draws.
   ctx: {seat, holder, legal(a), game: {slotOf, gearDef}, paySum(sideView), hitOf(view), wallOf(sideView), defending, art[2], name(seat), ui: {sel, insp, ref, sl, menu}} */
function model(v, ctx){
  const me = ctx.seat, you = v.sides[me], opp = v.sides[1 - me], L = ctx.legal, ui = ctx.ui || {};
  const mine = ctx.holder === me && !v.over;
  const pend = v.pending && v.pending.seat === me ? v.pending : null;
  const pay = pend && pend.kind === "pay" ? pend : null;
  const prompt = v.prompt && (v.prompt.side || 0) === me ? v.prompt : null;
  const asked = !!prompt || !!(pend && !pay);
  const arsStep = mine && v.phase === "end" && v.arsenalFor === me && !asked && !pay;
  const defending = !!ctx.defending && !asked && !pay;
  const blockH = new Set(you.blockH || []), blockG = new Set(you.blockG || []);
  const paySel = new Set(you.paySel || []);
  const foe = firstName(opp.name);

  /* the selection is only real while it can still be acted on */
  const own = (z, uid) => (z || []).find(c => c && c.uid === uid);
  const sel = ui.sel && mine && !asked && !pay && !defending && !arsStep
    ? (ui.sel.from === "hand" ? own(you.hand, ui.sel.uid) : ui.sel.from === "arsenal" ? (you.arsenal && you.arsenal.uid === ui.sel.uid ? you.arsenal : null) : own(you.gear, ui.sel.uid))
      && ui.sel : null;
  const selArs = arsStep && ui.sel && ui.sel.from === "hand" && own(you.hand, ui.sel.uid) ? ui.sel : null;

  const bout = (sd, seatIdx) => {
    const frac = sd.maxHp > 0 ? Math.max(0, Math.min(1, sd.hp / sd.maxHp)) : 0;
    return {life: sd.hp, frac, low: frac <= 0.25, turn: v.turnPlayer === seatIdx, art: ctx.art[seatIdx], name: ctx.name(seatIdx)};
  };

  const half = (sd, isYou) => {
    const lane = laneOf(sd, ctx.game), top = sd.grave && sd.grave.length ? sd.grave[sd.grave.length - 1] : null;
    const gearState = g => {
      if(!isYou || !g || g.hidden) return {};
      if(defending) return blockG.has(g.uid) ? {blk: true} : L({t: "defend", uid: g.uid}) == null ? {ready: true, defend: true} : {};
      if(!mine || asked || pay || arsStep) return {};
      return L({t: "activate", uid: g.uid}) == null && /weapon/i.test(g.tt || "") ? {ready: true} : {};
    };
    const pitched = (sd.pitch || []).slice();
    if(isYou) (sd.hand || []).forEach(c => { if(paySel.has(c.uid)) pitched.push(c); });
    const have = isYou && pay ? (sd.res || 0) + ctx.paySum(sd) : (sd.res || 0);
    return {
      ap: sd.ap || 0, coins: have, handN: (sd.hand || []).length, deckN: (sd.deck || []).length,
      cols: COLS.map(k => { const g = lane.cols[k]; return g && {card: g, def: g.hidden || k === "weapon" ? null : ctx.game.gearDef(g),
        tap: !!g.used && k === "weapon", spent: !!g.destroyed, sel: !!sel && sel.from === "gear" && sel.uid === g.uid, ...gearState(g)}; }),
      extra: lane.extra,
      gy: top && {card: top, n: sd.grave.length},
      arsenal: sd.arsenal ? {card: sd.arsenal, n: 1, face: isYou, sel: !!sel && sel.from === "arsenal"} : null,
      fan: pitched.slice(-3).map(c => ({card: c, tap: isYou && paySel.has(c.uid)})), fanN: pitched.length,
      perms: permsOf(sd)
    };
  };

  const handState = c => {
    if(pay) return L({t: "paySel", uid: c.uid}) == null ? "ready" : "dim";
    if(asked || !mine && !defending) return "idle";
    if(arsStep) return selArs && selArs.uid === c.uid ? "sel" : L({t: "arsenal", uid: c.uid}) == null ? "ready" : "dim";
    if(defending) return blockH.has(c.uid) ? "blk" : L({t: "defend", uid: c.uid}) == null ? "ready" : "dim";
    if(sel && sel.from === "hand" && sel.uid === c.uid) return "sel";
    return L({t: "play", uid: c.uid, from: "hand"}) == null ? "ready" : "dim";
  };

  /* the stage: the card being paid for, or the link on the chain (with its wall, the stack rail and earlier links), or the top of the stack */
  const feat = v.featured && v.featured.card ? v.featured : null;
  const stackE = (v.stack || []).length ? (v.stack[v.stack.length - 1] || {}) : null, stackTop = stackE && stackE.card;
  let staged = null, chain = null, hit = null, wall = [], rail = null, links = [];
  const have = pay ? (you.res || 0) + ctx.paySum(you) : 0;
  if(pay){
    staged = {card: pay.card, need: pay.need};
    hit = {kind: "cost", need: pay.need, have};
  } else if(feat){
    const atkSeat = v.attacker != null ? v.attacker : v.turnPlayer, defSd = v.sides[1 - atkSeat];
    chain = {card: feat.card, mine: atkSeat === me};
    /* the engine's CURRENT figure for the link in flight (what the AI reads as incoming), never the printed power */
    const power = ctx.hitOf(v), wallN = defSd ? ctx.wallOf(defSd) : 0;
    if(power != null){
      const eq = defending || wallN > 0 || v.step === "reaction" || v.step === "damage";
      hit = {kind: "hit", n: Math.max(0, power - wallN), ...(eq ? {eq: {p: power, d: wallN}} : {})};
    }
    /* the declared blockers from a hand stand in the wall once the declaration is closed (gear never leaves its column) */
    if(v.step !== "defend" && defSd){ const bh = new Set(defSd.blockH || []); wall = (defSd.hand || []).filter(c => bh.has(c.uid) && !c.hidden); }
    if(stackTop && stackE.k !== "rx") rail = {card: stackTop, who: firstName(v.sides[stackE.seat != null ? stackE.seat : 1 - me].name), kind: cap(String(stackE.window || "instant"))};
    if(!rail) links = (v.chainCards || []).slice(0, -1).map(e => (e && e.card) || e).filter(c => c && c.name).slice(-4);
  } else if(stackTop){
    chain = {card: stackTop, mine: false};
  }
  const walled = new Set(wall.map(c => c.uid));
  const hand = (you.hand || []).filter(c => !(pay && (c.uid === pay.card.uid || paySel.has(c.uid))) && !walled.has(c.uid))
    .map(c => ({card: c, state: handState(c), def: blockH.has(c.uid) ? c.def : null}));

  /* the one primary */
  let primary;
  const nm = sel ? sel.name || (sel.from === "gear" ? own(you.gear, sel.uid) : sel.from === "arsenal" ? you.arsenal : own(you.hand, sel.uid)).name : "";
  if(v.over) primary = {label: "Game over", disabled: true};
  else if(ui.insp || ui.menu) primary = {label: "Close", close: true};
  else if(asked) primary = {label: "Your call", disabled: true};
  else if(pay){
    primary = L({t: "payConfirm"}) == null ? {label: "Play " + pay.card.name, act: {t: "payConfirm"}}
      : {label: "Pitch " + Math.max(1, pay.need - have) + " more", disabled: true};
  } else if(arsStep) primary = selArs ? {label: "Set in arsenal", act: {t: "arsenal", uid: selArs.uid}} : {label: "No arsenal", act: {t: "arsenal", uid: null}};
  else if(defending){
    const n = blockH.size + blockG.size;
    primary = L({t: "pass"}) == null ? {label: n ? "Block with " + n : "No block", act: {t: "pass"}} : {label: "Resolving…", disabled: true};
  } else if(mine){
    if(sel) primary = {label: (sel.from === "gear" ? "Attack with " : "Play ") + nm, play: sel};
    else if(L({t: "endTurn"}) == null) primary = {label: "End turn", act: {t: "endTurn"}};
    else if(L({t: "pass"}) == null) primary = {label: "Pass", act: {t: "pass"}};
    else primary = {label: "Resolving…", disabled: true, stuck: true};
  } else primary = {label: v.turnPlayer === me ? "Waiting for " + foe : foe + "’s turn", disabled: true};
  primary.cls = lenClass(primary.label);

  const stage = defending ? {ask: "Any blocks?"} : arsStep ? {ask: "Arsenal?"} : {pill: pay ? "Paying" : pillOf(v), hot: !!pay || v.step === "reaction"};

  return {
    seat: me, over: !!v.over, mine, pay: !!pay, defending, arsStep,
    bout: [bout(you, me), bout(opp, 1 - me)],
    medal: {n: v.turn, mine: v.turnPlayer === me},
    stage, primary, staged, chain, hit, wall, rail, links,
    arsSlot: arsStep && !you.arsenal, menu: !!ui.menu,
    opp: half(opp, false), you: half(you, true), hand,
    selUid: sel ? sel.uid : selArs ? selArs.uid : null,
    where: chain ? "On the chain · played by " + (chain.mine ? "you" : foe) : "",
    plateL: selI0(sel, selArs, hand) === 0 && !(ui.sl > 8),
    insp: ui.insp || null, ref: ui.ref || null, sl: ui.sl || 0
  };
}

/* ---------- the Preact half ---------- */

const CELL = ["weapon", "head", "chest", "arms", "legs"];
const W_HAND = [80, 112], W_MAT = [44, 61];
const HOLD_MS = 400;

/* TAP vs HOLD (PHONE rule 9, SCREENS-TABLE 2): a press paints at once (boot.js); the tap commits on pointer-up, a hold of
   400 ms opens the card instead, a drag past 8 px (a scroll) is neither */
function press(tap, hold){
  const of = e => e.currentTarget.__press;
  const end = e => { const s = of(e); if(s){ clearTimeout(s.t); s.live = false; } };
  return {
    onPointerDown: e => { const s = {x: e.clientX, y: e.clientY, live: true, held: false, t: null};
      if(hold) s.t = setTimeout(() => { if(s.live){ s.held = true; hold(); } }, HOLD_MS); e.currentTarget.__press = s; },
    onPointerMove: e => { const s = of(e); if(s && s.live && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)){ clearTimeout(s.t); s.live = false; } },
    onPointerUp: e => { const s = of(e); if(!s) return; clearTimeout(s.t); const go = s.live && !s.held; e.currentTarget.__press = null; if(go && tap) tap(); },
    onPointerCancel: end, onPointerLeave: end,
    onContextMenu: e => e.preventDefault()
  };
}

function Bout(p){
  const [a, b] = p.m.bout, medal = p.m.medal;
  const side = (s, cls) => html`
    <div class=${"side " + cls} data-b=${"bout-" + cls}>
      <div class=${"por" + (s.turn ? " turn" : "")} style=${s.art ? "background-image:url(" + s.art + ")" + (cls === "opp" ? ";background-position:50% 14%" : "") : ""}></div>
      <div class="col"><div class=${"bar" + (s.low ? " low" : "")}><i class="ghost" style=${"transform:scaleX(" + s.frac.toFixed(3) + ")"}></i><i class="fill" style=${"transform:scaleX(" + s.frac.toFixed(3) + ")"}></i><i class="flash" style="opacity:0"></i></div><div class="nm">${s.name}</div></div>
      <div class=${"life" + (s.low ? " low" : "")} data-b="life">${s.life}<div class="pop" data-b="pop" style="opacity:0"></div></div>
    </div>`;
  return html`<header class="bout" data-b="bout" data-tap role="button" aria-label="Open the pad" onClick=${p.onPad}>
    ${side(a, "you")}
    <div class=${"medal" + (medal.mine ? "" : " o")} data-b="medal"><em class=${medal.mine ? "l" : "r"}></em><b>${medal.n}</b><span>TURN</span></div>
    ${side(b, "opp")}
  </header>`;
}

function Lane(p){
  const {h, who, on} = p, F = K.Face, B = K.Back, you = who === "you";
  const slot = (k, inner, tap) => html`<div data-b=${who + "-slot-" + k} data-tap=${tap ? "" : undefined}>${inner}</div>`;
  const cell = (k, i) => {
    const c = h.cols[i];
    if(!c) return slot(k, null, false);
    const cls = "mat" + (c.tap ? " tap" : "") + (c.spent ? " spent" : "") + (c.ready ? " ready" : "") + (c.sel ? " sel" : "") + (c.blk ? " blk" : "");
    const badge = k === "legs" && h.extra ? html`<span class="badge xn">×${h.extra + 1}</span>` : null;
    const shield = c.blk && c.def != null ? html`<span class="badge sh"><svg><use href="#i-shield"/></svg>${c.def}</span>` : null;
    return slot(k, c.card.hidden
      ? html`<${B} cls="mat" b=${who + "-" + k} label="Face-down equipment"/>`
      : html`<${F} card=${c.card} cls=${cls} place="mat" def=${c.def} b=${who + "-" + k} w=${W_MAT[0]} h=${W_MAT[1]} on=${on.gear(who, c)}>${badge}${shield}<//>`, true);
  };
  return html`<div class="lane" data-b=${who + "-lane"}>
    ${CELL.map(cell)}
    ${h.gy
      ? html`<div data-b=${who + "-slot-gy"} data-tap><div class="pile s"><${F} card=${h.gy.card} cls="mat" place="mat" b=${who + "-gy"} w=${W_MAT[0]} h=${W_MAT[1]} on=${on.gy(who, h.gy.card)}><span class="count">${h.gy.n}</span><//></div></div>`
      : html`<div data-b=${who + "-slot-gy"}></div>`}
    <div data-b=${who + "-slot-deck"}>${h.deckN ? html`<div class="pile s"><${B} cls="mat" b=${who + "-deck"} label="Deck"><span class="count">${h.deckN}</span><//></div>` : null}
      ${h.fan.map((f, i) => html`<${F} key=${f.card.uid} card=${f.card} cls=${"mat pf" + (f.tap ? " tapfan" : "")} place="mat" b=${who + "-pitch-" + i} w=${W_MAT[0]} h=${W_MAT[1]}
        tap=${f.tap} on=${f.tap ? on.unpitch(f.card) : null} style=${"transform:translateY(" + ((you ? 1 : -1) * (16 + 8 * i)) + "px)"}/>`)}</div>
    <div data-b=${who + "-slot-arsenal"} data-tap=${you && (h.arsenal || p.slot) ? "" : undefined}>${p.slot && !h.arsenal ? html`<div class="cd mat slot-arsenal" style="background:rgba(216,162,62,.08);box-shadow:none" data-b="you-arsenal-slot" aria-label="Set arsenal" ...${on.slot}><svg class="ico"><use href="#i-plus"/></svg></div>` : null}${h.arsenal
      ? (h.arsenal.face && you
        ? html`<${B} cls=${"mat" + (h.arsenal.sel ? " sel" : "")} b=${who + "-arsenal"} label="Your arsenal" on=${on.arsenal(h.arsenal.card)}><span class="count you">${h.arsenal.n}</span><//>`
        : html`<${B} cls="mat" b=${who + "-arsenal"} label="Their arsenal"/>`)
      : null}</div>
  </div>`;
}

/* AP gems then resource coins, only when non-zero (SCREENS-TABLE 1 DEV-1); permanents sit at the right of the row */
function Marks(p){
  const h = p.h;
  return html`${h.ap || h.coins ? html`<div class="mk">
    ${h.ap ? html`<div class="ap" data-b=${p.b}>${Array.from({length: h.ap}, () => html`<svg class="ico"><use href="#i-ap"/></svg>`)}</div>` : null}
    ${h.coins ? html`<div class="coins" data-b=${p.cb}>${Array.from({length: h.coins}, () => html`<span class="coin">1</span>`)}</div>` : null}
  </div>` : null}
  ${h.perms.length ? html`<div class="perm" data-b=${p.pb}>${h.perms.map(x => html`<div class="permhit" data-tap data-b=${p.pb + "-" + x.card.name} aria-label=${x.card.name} ...${p.on.perm(x.card)}><${K.Face} card=${x.card} cls="hb" place="perm">${x.n > 1 ? html`<span class="xn2">×${x.n}</span>` : null}<//></div>`)}</div>` : null}`;
}

/* the stage: the card being paid for, or the link on the chain with its wall, the stack rail, earlier links; what it costs / hits for */
function Stage(p){
  const m = p.m, F = K.Face;
  return html`<section class="centre" data-b="stage">
    <div class="atk anchor" data-anchor="chain" aria-hidden="true"><div class="cd chain" style="transform:none"></div></div>
    <div class="wall anchor" data-anchor="wall" aria-hidden="true"><div class="cd block" style="transform:none"></div></div>
    ${m.stage.ask ? html`<div class="ask" data-b="ask">${m.stage.ask}</div>` : html`<div class=${"pill" + (m.stage.hot ? " hot" : "")} data-b="pill">${m.stage.pill}</div>`}
    ${m.links.length ? html`<div class="links" data-b="links">${m.links.map((c, i) => html`<${F} key=${c.uid || i} card=${c} cls="link" place="none" b=${"link-" + i} style=${i ? "margin-left:-22px" : undefined} on=${p.on.inspect(c, "An earlier link on the chain")}/>`)}</div>` : null}
    ${m.rail ? html`<div class="stackrail" data-b="stack"><span class="lab">Stack</span><${F} card=${m.rail.card} cls="block" place="none" tap b="stack-card" on=${p.on.inspect(m.rail.card, "On the stack · played by " + m.rail.who)}/><div class="who">${m.rail.who}<br/>${m.rail.kind}</div></div>` : null}
    ${m.staged ? html`<div class="atk" data-b="staged"><${F} card=${m.staged.card} cls="chain staged" place="chain" tap b="staged-card" on=${p.on.inspect(m.staged.card, "Being played")}><span class="costring">${m.staged.need}</span><//></div>` : null}
    ${m.chain ? html`<div class=${"atk" + (m.chain.mine ? " mine" : "")} data-b="attack"><${F} card=${m.chain.card} cls="chain" place="chain" tap b="attack-card" on=${p.on.inspect(m.chain.card, m.where)}/></div>` : null}
    ${m.wall.length ? html`<div class="wall" data-b="wall">${m.wall.map((c, i) => html`<${F} key=${c.uid} card=${c} cls="block blk" place="block" tap b=${i ? "blocker-" + i : "blocker"} on=${p.on.inspect(c, "Blocking")}>${c.def != null ? html`<span class="badge sh"><svg><use href="#i-shield"/></svg>${c.def}</span>` : null}<//>`)}</div>` : null}
    ${m.hit && m.hit.kind === "cost" ? html`<div class="hit" data-b="hit"><div class="lab">Cost</div>
      <div class="cost-coins">${Array.from({length: m.hit.need}, (_, i) => i < m.hit.have ? html`<span class="coin">1</span>` : html`<span class="coin off"></span>`)}</div>
      <div class=${"paid" + (m.hit.have < m.hit.need ? " short" : "")}>Paid ${Math.min(m.hit.have, m.hit.need)}/${m.hit.need}</div></div>` : null}
    ${m.hit && m.hit.kind === "hit" ? html`<div class="hit" data-b="hit"><div class="lab">Hit for</div><div class=${"n" + (m.hit.n === 0 ? " zero" : "")}>${m.hit.n}</div>
      ${m.hit.eq ? html`<div class="eq" data-b="eq"><span class="p">${m.hit.eq.p}</span>−<span class="d">${m.hit.eq.d}</span></div>` : null}</div>` : null}
  </section>`;
}

function Table(p){
  const m = p.m, F = K.Face, B = K.Back, on = p.on, primary = m.primary, pay = m.pay;
  const handX = i => "calc(var(--gut) + " + i + " * (var(--cw-hand) + var(--gap-card)) + var(--cw-hand) / 2 - " + m.sl + "px)";
  const at = m.ref && m.ref.at && m.ref.at.k === "hand" ? m.ref.at.i : null;
  const selI = m.selUid != null ? m.hand.findIndex(x => x.card.uid === m.selUid) : -1;
  const left = i => "calc(var(--gut) + " + i + " * (var(--cw-hand) + var(--gap-card)) - " + m.sl + "px)";
  const plate = (i, inner, l) => html`<div class=${"peek" + (l ? " l" : "")} data-b="peek" style=${"left:" + (l ? left(i) : "min(calc(100% - 66px), max(66px, " + handX(i) + "))") + ";bottom:calc(var(--h-hub) + var(--ch-hand) + 26px)"}>${inner}</div>`;
  return html`<div class="stage" data-state=${m.insp ? "t10" : m.pay ? "t3" : "t1"}>
    <${Bout} m=${m} onPad=${on.pad}/>
    <main class="world" data-b="world">
      <section class="half opp" data-b="opp-half">
        <div class="mkrow"><${Marks} h=${m.opp} b="opp-ap" cb="opp-coins" pb="opp-perm" on=${on}/><div class="hf" data-b="their-hand">${Array.from({length: m.opp.handN}, () => html`<${B} cls="hb"/>`)}</div></div>
        <${Lane} h=${m.opp} who="opp" on=${on}/>
      </section>
      <${Stage} m=${m} on=${on}/>
      <section class="half you" data-b="you-half">
        <${Lane} h=${m.you} who="you" on=${on} slot=${m.arsSlot}/>
        <div class="mkrow"><${Marks} h=${m.you} b="ap" cb="coins" pb="you-perm" on=${on}/></div>
      </section>
      <section class="tray" data-b="tray"><div class="handrow" data-b="handrow" onScroll=${on.scroll}>
        ${m.hand.map((x, i) => html`<${F} key=${x.card.uid} card=${x.card} cls=${"hand " + x.state + (at === i ? " refused" : "")} place="hand" tap b=${"hand-" + i} w=${W_HAND[0]} h=${W_HAND[1]} on=${on.hand(x.card, i)}>
          ${x.state === "blk" && x.card.def != null ? html`<span class="badge sh"><svg><use href="#i-shield"/></svg>${x.card.def}</span>` : null}<//>`)}
      </div></section>
    </main>
    ${selI >= 0 && !m.ref ? plate(selI, html`<span class=${"name" + (m.plateL ? " l" : "")}>${m.hand[selI].card.name}</span>`, m.plateL) : null}
    ${m.ref ? (at != null ? plate(at, html`<span class="reason">${m.ref.text}</span>`)
      : html`<div class="peek" data-b="peek" style="left:50%;bottom:calc(var(--h-hub) + 12px)"><span class="reason">${m.ref.text}</span></div>`) : null}
    ${m.insp ? html`<${SH.Inspect} card=${m.insp.card} where=${m.insp.where} onClose=${on.close}/>` : null}
    ${m.menu ? html`<${SH.Menu} onClose=${on.close} onNew=${on.newGame}/>` : null}
    ${on.anc && root.DawnUIAnnounce ? html`<${root.DawnUIAnnounce.Announcer} ...${on.anc}/>` : null}
    ${on.prompt && root.DawnUISheets ? html`<${root.DawnUISheets.Sheet} key=${on.prompt.key} prompt=${on.prompt.p} view=${on.prompt.view} onAnswer=${on.answer} director=${on.anc && on.anc.director}/>` : null}
    ${m.sheet ? html`<${SH.Options} sheet=${m.sheet} onAct=${on.act}/>` : null}
    <footer class="hub" data-b="hub">
      ${m.insp || m.menu ? html`<span style="width:44px;flex:none"></span>` : html`<button class="btn sec sq" data-tap data-b="hub-left" aria-label=${pay ? "Cancel the play" : "Menu"} onClick=${pay ? on.cancel : on.menu}><svg class="ico"><use href=${pay ? "#i-x" : "#i-menu"}/></svg></button>`}
      <button class=${"btn primary" + primary.cls + (primary.disabled ? " dis" : "")} data-tap data-b="primary" disabled=${primary.disabled} onClick=${on.primary}>${primary.label}</button>
      ${m.insp || m.menu ? html`<span style="width:44px;flex:none"></span>` : html`<button class="btn sec sq" data-tap data-b="hub-right" aria-label="Pad" onClick=${on.pad}><svg class="ico"><use href="#i-pad"/></svg></button>`}
    </footer>
  </div>`;
}

/* the live table: the session's state in, one render per board push; the view is rebuilt from it each time */
function Live(p){
  const s = p.session, J = root.DawnJudge, me = s.seat;
  const st = useState(s.state()), state = st[0], setState = st[1];
  const us = useState({sel: null, insp: null, ref: null, sl: 0}), ui = us[0], setUi = us[1];
  useEffect(() => s.subscribe(setState), [s]);
  /* THE DIRECTOR AND THE ANNOUNCER (ui/director.js, ui/announce-view.js). State is true at t=0; beats only dress it: the
     life number and bar stay at the pre-hit value until the hit's contact frame (`holds`), a real hand node is hidden
     while its card flies and shown when it lands. Nothing here gates an input. */
  const bump = (st2 => () => st2[1](n => n + 1))(useState(0));
  const ref = useRef(null);
  if(!ref.current){
    const r = ref.current = {holds: [[], []], rects: new Map(), api: {current: null}, buffer: [], hear: null, dir: null, layout: null, sub: null};
    /* ONE director for the whole app when the router has made one (its speed setting then reaches the table's beats) */
    r.dir = p.director || (root.DawnUIApp && root.DawnUIApp.director && root.DawnUIApp.director()) || null;
    if(!r.dir && root.DawnUIDirector){ r.dir = root.DawnUIDirector.create({root: root.document}); r.own = true; }
    if(root.DawnUIAudio && root.DawnUIAudio.init) root.DawnUIAudio.init();
    if(root.DawnUILayout) r.layout = root.DawnUILayout.create(() => root.document.querySelector(".stage"), me, r.rects);
    const names = s.names.map(firstName);
    r.hear = step => {
      const AV = root.DawnUIAnnounce; if(!AV || !r.api.current) return;
      const ds = AV.beatsFor(step, me, {names});
      ds.forEach(d => { if(d.kind === "hit" || d.kind === "ko" || d.kind === "lifegain") r.holds[d.side].push({from: d.from, d}); });
      ds.forEach(d => { if(r.layout) r.layout.extras = (d.extras || []).length; r.api.current.play([d]); });
      if(r.layout) r.layout.extras = 0;
    };
    /* subscribed at once, so a step heard before the announcer has mounted waits instead of being lost */
    r.sub = s.onStep(step => { if(r.api.current) r.hear(step); else r.buffer.push(step); });
  }
  const RT = ref.current;
  useEffect(() => { const b = RT.buffer.splice(0); b.forEach(RT.hear); return () => { if(RT.sub) RT.sub(); RT.sub = null; if(RT.own && RT.dir && RT.dir.dispose) RT.dir.dispose(); }; }, [s]);
  useEffect(() => { /* where the hand cards are, remembered for a flight from a card that has already left the row */
    const st0 = root.document.querySelector(".stage"); if(st0 && root.DawnUILayout) root.DawnUILayout.remember(st0, RT.rects);
  });
  useEffect(() => { if(!ui.ref) return; const t = setTimeout(() => setUi(u => u.ref === ui.ref ? {...u, ref: null} : u), 2400); return () => clearTimeout(t); }, [ui.ref]);
  const game = root.DawnGame;
  const L = a => J.legal(state, a, me);
  const ctx = {
    seat: me, holder: J.waitingOn(state), legal: L, ui,
    defending: root.DawnPriority.canDeclareDefenders(state, me),
    game: {slotOf: game.slotOf, gearDef: game.gearDef}, paySum: J.paySum, art: [s.heroArt(0), s.heroArt(1)],
    /* HIT FOR is the engine's figure for the link in flight: what the AI itself reads as incoming (`pend.total`, which
       holds the printed power AS THE PLAY CHANGED IT) plus the reaction pumps (`effects.rxPumpTotal`, the one reader).
       The wall is the AI's own reader, `sparring.wallOf` (declared defenders), plus the defence reactions the engine
       has recorded on `blockRx` (sparring's `wallNow`, which is not exported; an export would replace this line). */
    hitOf: vw => vw.pend && vw.pend.total != null ? vw.pend.total + root.DawnEffects.rxPumpTotal(vw) : null,
    wallOf: sd => root.DawnSparring.wallOf(sd) + (sd.blockRx || []).reduce((t, l) => t + ((l && l.def) || 0), 0),
    name: i => i === me ? "You" : firstName(s.names[i])
  };
  const v = root.DawnView.view(state, me);
  const m = model(v, ctx);
  [0, 1].forEach(si => { const h = RT.holds[si][0]; if(h){ const b = m.bout[si === me ? 0 : 1], max = v.sides[si].maxHp; b.frac = Math.max(0, Math.min(1, h.from)); b.life = Math.round(b.frac * max); b.low = b.frac <= 0.25; } });
  /* what this seat was asked that the table cannot draw yet, or a holder with no drawable button: plain options */
  const asked = SH.sheetOf(v, {seat: me, legal: L});
  m.sheet = asked || (m.primary.stuck ? SH.stuckSheet(v, {seat: me, legal: L, moves: J.moves(state, me)}) : null);
  if(m.sheet) m.primary = {...m.primary, disabled: true};

  const refuse = (text, at) => setUi(u => ({...u, ref: {text, at: at || {k: "stage"}}, sel: null}));
  const submit = (a, at) => { if(RT.dir && RT.dir.skip) RT.dir.skip(); const why = a.suggest ? (() => { const x = s.suggest(); return x ? s.submit(x) : "nothing to suggest"; })() : s.submit(a);
    if(why) refuse(why, at); else setUi(u => ({...u, sel: null, ref: null})); return !why; };
  const open = (card, where) => setUi(u => ({...u, insp: {card, where}, sel: null, ref: null}));
  const mat = (who, card) => who === "you" ? "Your equipment" : "Their equipment";
  /* an attack that can go at more than one target needs the target said (CR 1.4.5): the hero unless the engine offers others */
  const withTarget = (a, card) => {
    const T = J.targets(state, 1 - me, null);
    return T.length > 1 && root.DawnParser.isAttack(card) ? {...a, target: J.targetSpec(T[0])} : a;
  };

  const on = {
    scroll: e => { const x = e.currentTarget.scrollLeft; setUi(u => Math.abs(u.sl - x) < 1 ? u : {...u, sl: x}); },
    hand: (card, i) => press(() => {
      if(m.pay) return submit({t: "paySel", uid: card.uid}, {k: "hand", i});
      if(m.arsStep){ const a = {t: "arsenal", uid: card.uid}; const why = L(a);
        return why ? refuse(why, {k: "hand", i}) : setUi(u => ({...u, sel: u.sel && u.sel.uid === card.uid ? null : {uid: card.uid, from: "hand"}, ref: null})); }
      if(m.defending) return submit({t: "defend", uid: card.uid}, {k: "hand", i});
      if(m.selUid === card.uid) return setUi(u => ({...u, sel: null, ref: null}));
      const a = withTarget({t: "play", uid: card.uid, from: "hand"}, card), why = L(a);
      if(why) return refuse(why, {k: "hand", i});
      setUi(u => ({...u, sel: {uid: card.uid, from: "hand"}, ref: null}));
    }, () => open(card, m.defending ? "In your hand" : "In your hand")),
    gear: (who, c) => press(() => {
      if(who === "you" && c.ready && !c.defend) return m.selUid === c.card.uid ? setUi(u => ({...u, sel: null})) : setUi(u => ({...u, sel: {uid: c.card.uid, from: "gear"}, ref: null}));
      if(who === "you" && (c.ready || c.blk) && m.defending) return submit({t: "defend", uid: c.card.uid});
      open(c.card, mat(who));
    }, () => open(c.card, mat(who))),
    gy: (who, card) => press(() => open(card, who === "you" ? "Top of your graveyard" : "Top of their graveyard"), null),
    arsenal: card => press(() => {
      const a = {t: "play", uid: card.uid, from: "arsenal"}, why = L(withTarget(a, card));
      if(why) return refuse(why);
      setUi(u => ({...u, sel: {uid: card.uid, from: "arsenal"}, ref: null}));
    }, () => open(card, "Your arsenal, face down to them")),
    unpitch: card => press(() => submit({t: "paySel", uid: card.uid}), null),
    inspect: (card, where) => press(() => open(card, where), null),
    perm: card => press(() => open(card, "A permanent on the board"), () => open(card, "A permanent on the board")),
    close: () => setUi(u => ({...u, insp: null, menu: false})),
    cancel: () => submit({t: "payCancel"}),
    menu: () => p.onMenu ? p.onMenu() : setUi(u => ({...u, menu: !u.menu, sel: null, ref: null})),
    pad: () => { if(p.onPad) p.onPad(); },
    slot: press(() => { const sl = ui.sel; if(sl && sl.from === "hand") submit({t: "arsenal", uid: sl.uid}); else refuse("Tap the card you want face down first"); }, null),
    newGame: () => { try { root.location.href = root.location.pathname; } catch(e){} },
    act: a => submit(a),
    primary: () => {
      const pr = m.primary;
      if(pr.close) return setUi(u => ({...u, insp: null, menu: false}));
      if(pr.disabled) return;
      if(pr.act) return submit(pr.act);
      if(pr.play){
        const sel = pr.play, c = sel.from === "gear" ? v.sides[me].gear.find(x => x.uid === sel.uid) : sel.from === "arsenal" ? v.sides[me].arsenal : v.sides[me].hand.find(x => x.uid === sel.uid);
        const base = sel.from === "gear" ? {t: "activate", uid: sel.uid} : {t: "play", uid: sel.uid, from: sel.from};
        return submit(withTarget(base, c), sel.from === "hand" ? {k: "hand", i: m.hand.findIndex(x => x.card.uid === sel.uid)} : null);
      }
    }
  };
  const release = d => { const q = RT.holds[d.side]; const i = q.findIndex(h => h.d === d); if(i >= 0){ q.splice(i, 1); bump(); } };
  const dom = root.document;
  on.anc = RT.dir && root.DawnUIAnnounce && RT.layout ? {
    director: RT.dir, viewer: me, view: {names: s.names.map(firstName)}, layout: RT.layout, api: RT.api, size: {w: 393, h: 660},
    onHide: (uid, hide) => { const st0 = dom.querySelector(".stage"), e = st0 && st0.querySelector('[data-uid="' + uid + '"]'); if(e) e.style.visibility = hide ? "hidden" : ""; },
    onContact: d => { if(d.kind === "hit" || d.kind === "ko") release(d); },
    onLand: d => { if(d.kind === "lifegain" || d.kind === "hit" || d.kind === "ko") release(d); }
  } : null;
  /* every engine prompt is a real sheet (ui/sheets.js); it sends each engine action through the session, in order */
  const pr = v.prompt && ((v.prompt.side || 0) === me || v.prompt.tag === "reveal") ? v.prompt : null;
  const cardNamed = name => { const nm = SH.named(v, me); for(const c of nm.values()) if(c.name === name) return c; return null; };
  on.prompt = pr ? {p: pr, key: [pr.src, pr.tag, pr.title].join("|"), view: {seat: me, names: s.names.map(firstName), cardOf: cardNamed}} : null;
  on.answer = a => submit(a);
  return html`<${Table} m=${m} on=${on}/>`;
}

return {model, laneOf, pillOf, permsOf, press, Table, Live, Bout, Lane};
});
