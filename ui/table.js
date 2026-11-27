/* ============================================================
   ui/table.js — DawnUITable: THE TABLE (docs/crescendo/SCREENS-TABLE.md; mockups/table-1-rest.html is the
   reference this is held to, box for box, by tools/ui-drive.js).

   Rendered ONLY from `DawnView.view(state, seat)` (what this seat may know: HIDDEN-HANDS.md) and `DawnJudge.legal`
   (what this seat may do now). A hidden card is a back whose COUNT is public and nothing more; this file never
   reads a zone the view withheld. `model()` is the pure half (view + legal -> plain data, testable in node);
   `Table` is the Preact half. The band structure, top to bottom: bout (HUD) · world (their half, the stage,
   your half, the tray with the hand) · hub (HUD).

   T1, the resting table, is what is drawn today. The chain, the glimpse, the announcer, the prompts and the taps
   that play cards come in the next steps (README "Next" 3-9); a tap here only shows its press state.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUITable = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const P = root.htmPreact || {};
const html = P.html, useState = P.useState, useEffect = P.useEffect;
const K = root.DawnUICard || {};

/* ---------- the pure half ---------- */

const COLS = ["weapon", "head", "chest", "arms", "legs"];
const ZONE_COL = {"1h": "weapon", "2h": "weapon", off: "weapon", qvr: "weapon", head: "head", chest: "chest", arms: "arms", legs: "legs"};

/* SCREENS-TABLE 1 DEV-1: the lane is eight FIXED columns, the same for both seats: weapon, head, chest, arms, legs,
   graveyard, deck, arsenal. A second piece for a column stacks onto the legs column with a count (never a new column). */
function laneOf(side, game){
  const cols = {weapon: null, head: null, chest: null, arms: null, legs: null};
  let extra = 0;
  (side.gear || []).forEach(g => {
    let col = g.hidden ? COLS.find(k => !cols[k]) : ZONE_COL[game.slotOf(g).z] || "weapon";
    if(!col || cols[col]){ extra++; return; }
    cols[col] = g;
  });
  return {cols, extra};
}

const firstName = n => String(n || "").split(",")[0];

/* the line the primary button says, and whether it can be pressed (one primary per screen) */
function primaryOf(v, ctx){
  if(v.over) return {label: "Game over", disabled: true};
  const mine = ctx.holder === ctx.seat;
  const foe = firstName(v.sides[1 - ctx.seat].name);
  if(mine){
    if(ctx.legal({t: "endTurn"}) == null) return {label: "End turn", disabled: false};
    if(ctx.legal({t: "pass"}) == null) return {label: "Pass", disabled: false};
    return {label: "Resolving…", disabled: true};
  }
  return {label: v.turnPlayer === ctx.seat ? "Waiting for " + foe : foe + "’s turn", disabled: true};
}

/* the phase / step marker, top of the stage */
function pillOf(v){
  if(v.over) return "Game over";
  if(v.step && v.step !== "layer") return v.step.charAt(0).toUpperCase() + v.step.slice(1) + " step";
  return {start: "Start phase", action: "Action phase", end: "End phase"}[v.phase] || "";
}

/* view + what is legal -> everything the table draws. ctx: {seat, holder, legal(a), game: {slotOf, gearDef}, art[2], name(seat)} */
function model(v, ctx){
  const me = ctx.seat, you = v.sides[me], opp = v.sides[1 - me];
  const mine = ctx.holder === me;
  const bout = (sd, seatIdx) => {
    const frac = sd.maxHp > 0 ? Math.max(0, Math.min(1, sd.hp / sd.maxHp)) : 0;
    return {life: sd.hp, frac, low: frac <= 0.25, turn: v.turnPlayer === seatIdx, art: ctx.art[seatIdx], name: ctx.name(seatIdx)};
  };
  const half = (sd, isYou) => {
    const lane = laneOf(sd, ctx.game), top = sd.grave && sd.grave.length ? sd.grave[sd.grave.length - 1] : null;
    const ready = g => isYou && mine && g && !g.hidden && ctx.legal({t: "activate", uid: g.uid}) == null;
    return {
      ap: sd.ap || 0, res: sd.res || 0, handN: (sd.hand || []).length, deckN: (sd.deck || []).length,
      cols: COLS.map(k => { const g = lane.cols[k]; return g && {card: g, def: g.hidden || k === "weapon" ? null : ctx.game.gearDef(g),
        tap: !!g.used && k === "weapon", spent: !!g.destroyed, ready: k === "weapon" && ready(g)}; }),
      extra: lane.extra,
      gy: top && {card: top, n: sd.grave.length},
      arsenal: sd.arsenal ? {card: sd.arsenal, n: 1} : null
    };
  };
  return {
    seat: me, over: !!v.over,
    bout: [bout(you, me), bout(opp, 1 - me)],
    medal: {n: v.turn, mine: v.turnPlayer === me},
    pill: pillOf(v), primary: primaryOf(v, ctx),
    opp: half(opp, false), you: half(you, true),
    hand: (you.hand || []).map(c => ({card: c, state: !mine ? "idle"
      : ctx.legal({t: "play", uid: c.uid, from: "hand"}) == null ? "ready" : "dim"}))
  };
}

/* ---------- the Preact half ---------- */

const CELL = ["weapon", "head", "chest", "arms", "legs"];
const W_HAND = [80, 112], W_MAT = [44, 61];

function Bout(p){
  const [a, b] = p.m.bout, medal = p.m.medal;
  const side = (s, cls) => html`
    <div class=${"side " + cls} data-b=${"bout-" + cls}>
      <div class=${"por" + (s.turn ? " turn" : "")} style=${s.art ? "background-image:url(" + s.art + ")" + (cls === "opp" ? ";background-position:50% 14%" : "") : ""}></div>
      <div class="col"><div class=${"bar" + (s.low ? " low" : "")}><i class="ghost" style="transform:scaleX(0)"></i><i class="fill" style=${"transform:scaleX(" + s.frac.toFixed(3) + ")"}></i></div><div class="nm">${s.name}</div></div>
      <div class=${"life" + (s.low ? " low" : "")} data-b="life">${s.life}</div>
    </div>`;
  return html`<header class="bout" data-b="bout" data-tap role="button" aria-label="Open the pad">
    ${side(a, "you")}
    <div class=${"medal" + (medal.mine ? "" : " o")} data-b="medal"><em class=${medal.mine ? "l" : "r"}></em><b>${medal.n}</b><span>TURN</span></div>
    ${side(b, "opp")}
  </header>`;
}

function Lane(p){
  const {h, who} = p, F = K.Face, B = K.Back;
  const slot = (k, inner, tap) => html`<div data-b=${who + "-slot-" + k} data-tap=${tap ? "" : undefined}>${inner}</div>`;
  const cell = (k, i) => {
    const c = h.cols[i];
    if(!c) return slot(k, null, false);
    const cls = "mat" + (c.tap ? " tap" : "") + (c.spent ? " spent" : "") + (c.ready ? " ready" : "");
    const badge = k === "legs" && h.extra ? html`<span class="badge xn">×${h.extra + 1}</span>` : null;
    return slot(k, c.card.hidden
      ? html`<${B} cls="mat" b=${who + "-" + k} label="Face-down equipment"/>`
      : html`<${F} card=${c.card} cls=${cls} place="mat" def=${c.def} b=${who + "-" + k} w=${W_MAT[0]} h=${W_MAT[1]}>${badge}<//>`, true);
  };
  return html`<div class="lane" data-b=${who + "-lane"}>
    ${CELL.map(cell)}
    ${h.gy
      ? html`<div data-b=${who + "-slot-gy"} data-tap><div class="pile s"><${F} card=${h.gy.card} cls="mat" place="mat" b=${who + "-gy"} w=${W_MAT[0]} h=${W_MAT[1]}><span class="count">${h.gy.n}</span><//></div></div>`
      : html`<div data-b=${who + "-slot-gy"}></div>`}
    <div data-b=${who + "-slot-deck"}>${h.deckN ? html`<div class="pile s"><${B} cls="mat" b=${who + "-deck"} label="Deck"><span class="count">${h.deckN}</span><//></div>` : null}</div>
    <div data-b=${who + "-slot-arsenal"} data-tap=${who === "you" && h.arsenal ? "" : undefined}>${h.arsenal
      ? html`<${B} cls="mat" b=${who + "-arsenal"} label=${who === "you" ? "Your arsenal" : "Their arsenal"}>${who === "you" ? html`<span class="count you">${h.arsenal.n}</span>` : null}<//>`
      : null}</div>
  </div>`;
}

/* AP gems then resource coins, only when non-zero (SCREENS-TABLE 1 DEV-1) */
function Marks(p){
  const h = p.h;
  if(!h.ap && !h.res) return null;
  return html`<div class="mk">
    ${h.ap ? html`<div class="ap" data-b=${p.b}>${Array.from({length: h.ap}, () => html`<svg class="ico"><use href="#i-ap"/></svg>`)}</div>` : null}
    ${h.res ? html`<div class="coins">${Array.from({length: h.res}, () => html`<div class="coin"></div>`)}</div>` : null}
  </div>`;
}

function Table(p){
  const m = p.m, F = K.Face, B = K.Back;
  const primary = m.primary;
  return html`<div class="stage" data-state="t1">
    <${Bout} m=${m}/>
    <main class="world" data-b="world">
      <section class="half opp" data-b="opp-half">
        <div class="mkrow"><${Marks} h=${m.opp} b="opp-ap"/><div class="hf" data-b="their-hand">${Array.from({length: m.opp.handN}, () => html`<${B} cls="hb"/>`)}</div></div>
        <${Lane} h=${m.opp} who="opp"/>
      </section>
      <section class="centre" data-b="stage"><div class="pill" data-b="pill">${m.pill}</div>
        <a class="classic" href="index.html" data-b="classic">Classic</a></section>
      <section class="half you" data-b="you-half">
        <${Lane} h=${m.you} who="you"/>
        <div class="mkrow"><${Marks} h=${m.you} b="ap"/></div>
      </section>
      <section class="tray" data-b="tray"><div class="handrow" data-b="handrow">
        ${m.hand.map((x, i) => html`<${F} key=${x.card.uid} card=${x.card} cls=${"hand " + x.state} place="hand" tap b=${"hand-" + i} w=${W_HAND[0]} h=${W_HAND[1]}/>`)}
      </div></section>
    </main>
    <footer class="hub" data-b="hub">
      <button class="btn sec sq" data-tap data-b="hub-left" aria-label="Menu"><svg class="ico"><use href="#i-menu"/></svg></button>
      <button class=${"btn primary" + (primary.disabled ? " dis" : "")} data-tap data-b="primary" disabled=${primary.disabled}>${primary.label}</button>
      <button class="btn sec sq" data-tap data-b="hub-right" aria-label="Pad"><svg class="ico"><use href="#i-pad"/></svg></button>
    </footer>
  </div>`;
}

/* the live table: the session's state in, one render per board push; the view is rebuilt from it each time */
function Live(p){
  const s = p.session, st = useState(s.state()), state = st[0], setState = st[1];
  useEffect(() => s.subscribe(setState), [s]);
  const game = root.DawnGame;
  const m = model(root.DawnView.view(state, s.seat), {
    seat: s.seat, holder: root.DawnJudge.waitingOn(state), legal: a => root.DawnJudge.legal(state, a, s.seat),
    game: {slotOf: game.slotOf, gearDef: game.gearDef}, art: [s.heroArt(0), s.heroArt(1)],
    name: i => i === s.seat ? "You" : firstName(s.names[i])
  });
  return html`<${Table} m=${m}/>`;
}

return {model, laneOf, primaryOf, pillOf, Table, Live, Bout, Lane};
});
