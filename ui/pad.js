/* ============================================================
   CRESCENDO — ui/pad.js  ·  DawnUIPad: the scratch pad of life changes (F6) and the result sheet (F7)
   SCREENS-FLOW.md F6/F7 · mockups/flow-6-pad.html, flow-7-result.html · TRP 5.8

   There is NO LOG in ranked: what a real table allows is "Recording the life total, changes to the life total, and the
   source of the change" — a pad. This is that pad and nothing else: no cards, no phases, no feed.

     PURE (node drills it)
       empty(start)               a pad for two seats whose life starts at start = [hp0, hp1]
       record(pad, step)          the pad after one accepted action (engine/announce.js's `marks` says what changed)
       columns(pad, names)        what the paper shows: per seat, the old totals struck, the changes, the current total
     RENDER (Preact + htm)
       Paper({pad, names, first, turn, result, winner})   the paper, inside the stage
       PadSheet({...})                                    scrim + paper + close (F6)
   Every figure comes from the engine's own marks; this file adds none.
   ============================================================ */
(function(root, factory){
  var A = (typeof module === "object" && module.exports) ? require("../engine/announce.js") : root.DawnAnnounce;
  if(typeof module === "object" && module.exports) module.exports = factory(root, A);
  else root.DawnUIPad = factory(root, A);
})(typeof self !== "undefined" ? self : this, function(root, A){

var MINUS = "−", PLUS = "+";

/* a pad: the starting totals and, per seat, the changes in order */
function empty(start){ return {start: [start[0], start[1]], seats: [[], []], turn: 1}; }

/* one accepted action -> the pad after it. `step` = {seat, action, prev, next} (local.js onStep). Immutable. */
function record(pad, step){
  var ms = A.marks(step);
  var turn = step && step.next ? (step.next.turn | 0) : pad.turn;
  if(!ms.length) return turn === pad.turn ? pad : Object.assign({}, pad, {turn: turn});
  var seats = [pad.seats[0].slice(), pad.seats[1].slice()];
  ms.forEach(function(m){ seats[m.seat].push({turn: turn, delta: m.delta, total: m.total, source: m.source || ""}); });
  return {start: pad.start, seats: seats, turn: turn};
}

/* the signed number as a pad writes it: "−3" / "+2" */
function signed(n){ return n < 0 ? MINUS + Math.abs(n) : PLUS + n; }

/* what the paper shows for each seat: the opening total, then for every change the line that says it and the new total.
   Every total but the last is struck (`x`); the last is the current one (`cur`). */
function columns(pad, names){
  return [0, 1].map(function(i){
    var rows = [], t = pad.start[i];
    rows.push({k: "t", v: t});
    pad.seats[i].forEach(function(e){
      rows.push({k: "a", turn: e.turn, src: e.source, delta: e.delta, text: signed(e.delta)});
      rows.push({k: "t", v: e.total});
      t = e.total;
    });
    var last = rows.length - 1;
    rows.forEach(function(r, j){ if(r.k === "t") r.cls = j === last ? "cur" : "x"; });
    return {seat: i, name: names && names[i] || "", cur: t, rows: rows};
  });
}

/* a line's words: "T4 Shrill of Skullform −4" is rendered as three spans; this is the same thing as text (a drill's reading) */
function lineText(r){ return "T" + r.turn + (r.src ? " " + r.src : "") + " " + r.text; }

/* ---------------- render ---------------- */
var P = root.htmPreact || {};
var html = P.html, useRef = P.useRef, useEffect = P.useEffect;

function Ring(){
  return html`<svg class="ring" viewBox="0 0 70 62" style="left:-26px;top:-12px;width:74px;height:64px"><path d="M14 44C3 26 20 6 40 6c20 0 31 20 18 38-9 12-32 13-42-2" fill="none" stroke="#B3261E" stroke-width="3.2" stroke-linecap="round"/></svg>`;
}

/* the paper. `result` = the result sheet (winner's final total ringed, GG); `names` = [you, them] hero names. */
function Paper(p){
  var cols = columns(p.pad, p.names), ref = useRef(null);
  useEffect(function(){ var e = ref.current; if(e) e.scrollTop = e.scrollHeight; }, [p.pad]);
  var heading = (p.names[0] || "You") + " vs " + (p.names[1] || "Them");
  var sub = p.result ? (p.winner === 0 ? "You won" : (p.names[1] || "They") + " won") + " · turn " + p.turn
    : (p.first === 0 ? "You went first" : (p.names[1] || "They") + " went first") + " · turn " + p.turn;
  return html`<div class=${"paper" + (p.result ? " res" : "")} data-b="paper" style=${p.style || ""}>
    <i class="tape a"></i><i class="tape b"></i>
    <div class="ph"><h3>${heading}</h3><p>${sub}</p></div>
    ${p.onClose ? html`<button class="ib pen" aria-label="Close" data-tap data-b="pad-close" onClick=${p.onClose}><svg class="ico"><use href="#i-x"/></svg></button>` : null}
    <div class="cols" ref=${ref} data-b="cols">
      ${cols.map(function(c){
        return html`<div data-b=${"col-" + c.seat}><h4>${c.seat === 0 ? "You" : c.name}</h4>
          ${c.rows.map(function(r){
            return r.k === "a"
              ? html`<div class="r a"><em>T${r.turn}</em>${r.src}<b>${r.text}</b></div>`
              : html`<div class=${"r t " + r.cls} style=${p.result && r.cls === "cur" && p.winner === c.seat ? "margin-left:14px" : ""}>${r.v}${p.result && r.cls === "cur" && p.winner === c.seat ? html`<${Ring}/>` : null}</div>`;
          })}</div>`;
      })}
    </div>
    ${p.result ? html`<span class="gg" style="top:26px;right:14px">GG</span>` : html`<p class="pnote">Life totals and where they came from. Nothing else.</p>`}
  </div>`;
}

/* F6: the scrim starts at the bout's bottom edge (56), the bout stays lit; a tap on the scrim closes */
function PadSheet(p){
  return html`<div class="scr f6" data-b="pad"><div class="frame">
    <div class="scrim" data-b="scrim" onClick=${p.onClose}></div>
    <${Paper} pad=${p.pad} names=${p.names} first=${p.first} turn=${p.turn} onClose=${p.onClose} style="top:68px;bottom:14px"/>
  </div></div>`;
}

return {empty: empty, record: record, columns: columns, signed: signed, lineText: lineText, Paper: Paper, PadSheet: PadSheet};
});
