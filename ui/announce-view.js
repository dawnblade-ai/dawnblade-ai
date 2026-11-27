/* ============================================================
   CRESCENDO — ui/announce-view.js  ·  DawnUIAnnounce: the announcement slab and the glimpse
   SCREENS-TABLE.md T5 (the opponent's play) and T8 (the hit) · MOTION.md §3, §4 · engine/announce.js

   Every play is said, bold, ONE AT A TIME; every card played or pitched is glimpsed large, once, then lands where it
   lives. `engine/announce.js` says WHAT (and never names what the viewer may not see); this file turns those lines
   into director beats and adds NO fact of its own.

     beatsFor(step, viewer, view)   PURE. {seat, action, prev, next} (local.js's onStep) -> an ordered list of
                                    DESCRIPTORS, the table's story of that one action (see the shapes below).
     createAnnouncer({director, viewer, layer, layout, ...})  -> {hear(step), play(descriptors), dispose()}
                                    descriptors -> DOM clones + director beats (this file never calls `animate`).
     Announcer(props)               the Preact component: renders the slab/scrim layer and wires a controller;
                                    `props.api.current` (or `props.onReady(ctl)`) is the controller.

   DESCRIPTOR SHAPES (all `seat`s are seat indices; names/cards are only ever what announce.js said):
     {kind:"play", own, line, slab, card, extras, attack, reaction, dest}        a card goes to the chain
     {kind:"pitch", own, seat, cards}                                            cards go to the pitch zone
     {kind:"block", own, seat, cards}                                            blockers move up
     {kind:"arsenal", own, seat, card}                                           a card set (card null = face down)
     {kind:"note", seat, slab}                                                   a slab with no card (NO BLOCK)
     {kind:"hit", side, dmg, from, to, attacker, source}                         damage dealt (side = the victim)
     {kind:"ko", side, winner, dmg, from, to}                                    the lethal hit / the game ends
     {kind:"lifegain", side, n, from, to}   {kind:"prevent", side}   {kind:"goagain", seat}
     {kind:"turn", seat}   {kind:"draw", seat, own, n, cards}   {kind:"again", seat, n}  (a power restated: no motion)
   `slab` = {label, line, seat}; `from`/`to` are life as a fraction of the hero's starting life (the bar's scaleX).
   ============================================================ */
(function(root, factory){
  var A = (typeof module === "object" && module.exports) ? require("../engine/announce.js") : root.DawnAnnounce;
  var V = (typeof module === "object" && module.exports) ? require("../engine/view.js") : root.DawnView;
  if(typeof module === "object" && module.exports) module.exports = factory(root, A, V);
  else root.DawnUIAnnounce = factory(root, A, V);
})(typeof self !== "undefined" ? self : this, function(root, A, V){

var upper = function(s){ return String(s == null ? "" : s).toUpperCase(); };
var REACTION_SUBS = {"attack reaction": 1, "defense reaction": 1, "instant": 1};
var CARD_W = 236, CARD_H = 330;     /* the flying clone is sized once, at glimpse size (MOTION 1.2) */

/* the name a slab speaks for a seat: the viewer's own seat is "YOU" */
function seatName(seat, viewer, view){
  if(seat === viewer) return "YOU";
  var n = view && view.names && view.names[seat];
  return upper(n || "THEY");
}
const clamp01 = function(x){ return x < 0 ? 0 : x > 1 ? 1 : x; };

/* ============================================================
   beatsFor — PURE
   ============================================================ */
function beatsFor(step, viewer, view){
  view = view || {};
  var lines = A.say(step, viewer), prev = step.prev, next = step.next, out = [];
  var nm = function(seat){ return seatName(seat, viewer, view); };
  var maxHp = function(i){ var s = next.sides[i] || {}; return (view.maxLife && view.maxLife[i]) || s.maxHp || s.hp || 20; };
  var lifeLines = lines.filter(function(l){ return l.k === "life"; });
  var used = new Set();
  var over = next.over && !(prev.over) ? next.over : null;
  var loser = over ? 1 - over.winner : null;

  lines.forEach(function(l){
    var own = l.seat === viewer;
    if(l.k === "attack" || l.k === "play" || l.k === "ability" || l.k === "hero"){
      if(l.again){ out.push({kind: "again", seat: l.seat, n: l.n, line: l}); return; }
      var reaction = !!REACTION_SUBS[l.sub];
      var swings = /^swinging/.test(l.sub || "") || l.sub === "swing";
      var verb = l.k === "hero" ? "USES" : l.k === "ability" ? "ACTIVATES" : "PLAYS";
      var small = l.k === "attack" && l.n != null ? (swings ? "SWINGS FOR " : "ATTACKS FOR ") + l.n + (l.ga ? " · GO AGAIN" : "")
        : l.sub ? upper(l.sub) : verb;
      var extras = (l.pitched || []).map(function(c){ return {card: c, name: c.name, pitch: c.pitch | 0}; });
      if(own && extras.length) out.push({kind: "pitch", own: true, seat: l.seat, cards: extras.map(function(e){ return e.card; }), line: l});
      out.push({kind: "play", own: own, seat: l.seat, line: l, card: l.card, extras: own ? [] : extras, attack: l.k === "attack",
                reaction: reaction, dest: "chain", back: !l.card,
                slab: {label: nm(l.seat) + " · " + small, line: verb + " " + upper(l.head), seat: l.seat}});
      if(l.k === "attack" && l.ga) out.push({kind: "goagain", seat: l.seat, line: l});
    }
    else if(l.k === "block"){
      var cards = l.cards || (l.card ? [l.card] : []);
      if(!own) out.push({kind: "note", seat: l.seat, line: l, cards: cards, extras: cards.slice(1).map(function(c){ return {card: c, name: c.name, pitch: 0}; }), card: cards[0] || null,
                         slab: {label: nm(l.seat) + " · BLOCKING" + (cards.length > 1 ? " · WITH " + cards.length : ""), line: cards.map(function(c){ return upper(c.name); }).join(" + "), seat: l.seat}});
      out.push({kind: "block", own: own, seat: l.seat, cards: cards, line: l});
    }
    else if(l.k === "noblock"){
      out.push({kind: "note", seat: l.seat, line: l, card: null, slab: {label: nm(l.seat), line: "NO BLOCK", seat: l.seat}});
    }
    else if(l.k === "arsenal"){
      if(!own) out.push({kind: "note", seat: l.seat, line: l, card: null, back: true, slab: {label: nm(l.seat) + " · ARSENAL", line: "A CARD, FACE DOWN", seat: l.seat}});
      out.push({kind: "arsenal", own: own, seat: l.seat, card: l.card, line: l});
    }
    else if(l.k === "pitch"){
      var cs = (l.pitched || []);
      if(!own) out.push({kind: "note", seat: l.seat, line: l, card: null, extras: cs.map(function(c){ return {card: c, name: c.name, pitch: c.pitch | 0}; }),
                         slab: {label: nm(l.seat) + " · PITCH", line: cs.map(function(c){ return upper(c.name); }).join(" + "), seat: l.seat}});
      out.push({kind: "pitch", own: own, seat: l.seat, cards: cs, line: l});
    }
    else if(l.k === "hit"){
      var victim = 1 - l.seat, mk = lifeLines.filter(function(x){ return x.seat === victim && x.n < 0 && !used.has(x); })[0];
      if(mk){ used.add(mk); var hp = mk.total; out.push(lethalOr(victim, -mk.n, (hp - mk.n) / maxHp(victim), hp / maxHp(victim), hp <= 0, l.sub)); }
    }
    else if(l.k === "blocked"){
      if(l.head === "PREVENTED") out.push({kind: "prevent", side: l.seat, line: l});
    }
    else if(l.k === "turn"){
      out.push({kind: "turn", seat: l.seat, line: l, slab: {label: "", line: l.seat === viewer ? "YOUR TURN" : nm(l.seat) + "'S TURN", seat: l.seat}});
    }
  });
  /* life changes not claimed by a hit line: a loss with no attacker (an effect), or a gain */
  lifeLines.forEach(function(m){
    if(used.has(m)) return;
    var hp = m.total, d = m.n, side = m.seat;
    if(d < 0) out.push(lethalOr(side, -d, (hp - d) / maxHp(side), hp / maxHp(side), hp <= 0, m.sub));
    else if(d > 0) out.push({kind: "lifegain", side: side, n: d, from: clamp01((hp - d) / maxHp(side)), to: clamp01(hp / maxHp(side)), line: m});
  });
  function lethalOr(side, dmg, from, to, dead, source){
    if(dead || (over && loser === side)) return {kind: "ko", side: side, winner: over ? over.winner : 1 - side, dmg: dmg, from: clamp01(from), to: 0, source: source || ""};
    return {kind: "hit", side: side, dmg: dmg, from: clamp01(from), to: clamp01(to), source: source || ""};
  }
  if(over && !out.some(function(b){ return b.kind === "ko"; })) out.push({kind: "ko", side: loser, winner: over.winner, dmg: 0, from: 0, to: 0, source: over.how || ""});

  /* cards dealt: the deck shrank and the hand grew by the same count (a draw; a retrieve does not shrink the deck).
     The viewer's own cards may be named — only if the viewer may know them; theirs are backs and a number. */
  [0, 1].forEach(function(i){
    var ps = prev.sides[i] || {}, ns = next.sides[i] || {};
    var dh = (ns.hand || []).length - (ps.hand || []).length, dd = (ps.deck || []).length - (ns.deck || []).length;
    if(dh > 0 && dd === dh){
      var hid = V.hiddenUids(next, viewer), names = [];
      if(i === viewer){
        var had = new Set((ps.hand || []).map(function(c){ return String(c && c.uid); }));
        (ns.hand || []).forEach(function(c){ if(c && !had.has(String(c.uid)) && !hid.has(String(c.uid))) names.push(c); });
      }
      out.push({kind: "draw", seat: i, own: i === viewer, n: dh, cards: names});
    }
  });
  /* the turn passes, then the cards are dealt for it: draw before turn would show a hand that is not yet yours */
  out.sort(function(a, b){ return rank(a) - rank(b); });
  return out;
}
/* a stable story order: what was played, what it did, then the board settling (draw, turn) */
function rank(b){ return {draw: 7, turn: 8, ko: 6}[b.kind] || 0; }

/* ============================================================
   the controller: descriptors -> DOM clones + director beats
   ============================================================ */
var poseOf = function(r, k){ return {x: r.x, y: r.y, s: (r.w / CARD_W) * (k || 1)}; };

/* a default table, in the layer's own pixel space, for a lab or a table that has not measured yet.
   The real table passes `layout.rect(place, arg)` from its cached slot rectangles (MOTION 1.4). */
function defaultLayout(size){
  var W = size.w, H = size.h, gw = W * .59, gh = gw * CARD_H / CARD_W;
  var rect = {
    glimpse: function(){ return {x: (W - gw) / 2, y: Math.max(8, (H - gh) / 2 - 10), w: gw, h: gh}; },
    hand: function(card, i){ return {x: 10 + (i || 0) * 70, y: H - 120, w: 64, h: 90}; },
    oppHand: function(){ return {x: W / 2 - 32, y: -100, w: 64, h: 90}; },
    deck: function(seat){ return {x: W - 74, y: seat === 0 ? H - 120 : 20, w: 64, h: 90}; },
    chain: function(){ return {x: W / 2 - 32, y: H * .42, w: 64, h: 90}; },
    pile: function(seat){ return {x: W - 80, y: seat === 0 ? H * .66 : H * .08, w: 64, h: 90}; },
    grave: function(seat){ return {x: 16, y: seat === 0 ? H * .66 : H * .08, w: 64, h: 90}; },
    arsenal: function(seat){ return {x: W - 150, y: seat === 0 ? H * .66 : H * .08, w: 64, h: 90}; },
    wall: function(seat, i){ return {x: W / 2 - 70 + (i || 0) * 76, y: seat === 0 ? H * .55 : H * .22, w: 64, h: 90}; },
    small: function(i){ return {x: W * .69, y: Math.max(8, (H - gh) / 2 - 10) + i * 16, w: 92, h: 128}; }
  };
  return {rect: function(place, a, b){ var f = rect[place]; return f ? f(a, b) : rect.glimpse(); }, el: function(){ return null; }};
}

function createAnnouncer(o){
  var director = o.director, viewer = o.viewer, layer = o.layer, view = o.view || {};
  var doc = o.document || (typeof document !== "undefined" ? document : null);
  var size = o.size || (layer && layer.clientWidth ? {w: layer.clientWidth, h: layer.clientHeight} : {w: 393, h: 402});
  var layout = o.layout || defaultLayout(size);
  var cards = [];                      /* clones this controller made and has not removed */
  var disposed = false;

  function q(name){ return layer && layer.querySelector ? layer.querySelector(".an-" + name) : null; }
  function elOf(name, seat){ var e = layout.el && layout.el(name, seat); return e || null; }
  function clone(card, o2){
    if(!doc) return null;
    var c = doc.createElement("div");
    c.className = "an-card" + (card ? "" : " an-hidden");
    if(card && card.img){ var im = doc.createElement("img"); im.alt = card.name || ""; im.src = card.img; im.decoding = "async"; c.appendChild(im); }
    else if(card){ var sp = doc.createElement("span"); sp.className = "an-nm"; sp.textContent = card.name || ""; c.appendChild(sp); }
    var back = doc.createElement("div"); back.className = "an-cardback"; back.style.opacity = (o2 && o2.faceDown) || !card ? "1" : "0"; c.appendChild(back);
    if(o2 && o2.pitch){ var ch = doc.createElement("span"); ch.className = "an-chip p" + o2.pitch; ch.textContent = "PITCH +" + o2.pitch; c.appendChild(ch); }
    c.style.opacity = "0";
    if(layer) layer.appendChild(c);
    cards.push(c);
    return {el: c, back: back};
  }
  function drop(c){ if(c && c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el); var i = cards.indexOf(c && c.el); if(i >= 0) cards.splice(i, 1); }
  function hide(card, on){ if(o.onHide && card && card.uid != null) o.onHide(card.uid, on); }
  function land(d){ if(o.onLand) o.onLand(d); }
  function setSlab(d){
    var s = d.slab, slab = q("slab"); if(!s || !slab) return;
    var sm = slab.querySelector("small"), b = slab.querySelector("b");
    if(sm) sm.textContent = s.label || ""; if(b) b.textContent = s.line || "";
    slab.classList.toggle("you", s.seat === viewer); slab.classList.toggle("opp", s.seat !== viewer);
  }
  function live(on){ var sc = q("scrim"); if(sc) sc.classList.toggle("live", !!on); }

  /* descriptor -> [director beat] */
  function toBeats(d){
    var R = layout.rect, seat = d.seat;
    switch(d.kind){
      case "play": {
        var gl = poseOf(R("glimpse")), dest = poseOf(R(d.dest || "chain", seat));
        if(d.own){
          var fromR = d.card ? R("hand", d.card) : R("deck", seat), c = clone(d.card);
          var b = {kind: d.reaction ? "reaction" : "play", attack: !!d.attack, reaction: !!d.reaction, els: {card: c && c.el, back: c && c.back},
            pose: {from: poseOf(fromR), glimpse: d.reaction ? poseOf(R("chain")) : gl, slot: dest}, reveal: false,
            begin: function(){ hide(d.card, true); if(c) c.el.style.opacity = "1"; },
            commit: function(){ drop(c); hide(d.card, false); land(d); }};
          return [b];
        }
        var cc = clone(d.card, {faceDown: !d.card}), xs = (d.extras || []).map(function(x, i){ return {c: clone(x.card, {pitch: x.pitch}), x: x, i: i}; });
        var els = {slab: q("slab"), card: cc && cc.el, back: d.card ? cc && cc.back : null, scrim: q("scrim")};
        xs.forEach(function(e){ els["x" + e.i] = e.c && e.c.el; });
        var an = {kind: "announce", reaction: !!d.reaction, side: "left", reveal: !!d.card, els: els,
          extras: xs.map(function(e){ var r = R("small", e.i); return {from: poseOf(R("oppHand")), glimpse: poseOf(r), to: poseOf(R("pile", seat))}; }),
          pose: {back: poseOf(R("oppHand", seat), 1), glimpse: gl, dest: dest},
          begin: function(){ setSlab(d); live(true); if(cc) cc.el.style.opacity = "1"; xs.forEach(function(e){ if(e.c) e.c.el.style.opacity = "1"; }); },
          commit: function(){ live(false); drop(cc); xs.forEach(function(e){ drop(e.c); }); land(d); }};
        return [an];
      }
      case "note": {
        var first = d.card ? clone(d.card) : null, xs2 = (d.extras || []).map(function(x, i){ return {c: clone(x.card, {pitch: x.pitch}), i: i}; });
        var els2 = {slab: q("slab"), card: first && first.el, back: first && first.back, scrim: q("scrim")};
        if(first) first.back.style.opacity = "0";
        xs2.forEach(function(e){ els2["x" + e.i] = e.c && e.c.el; });
        return [{kind: "announce", side: "left", reveal: !!d.card, els: els2, extras: xs2.map(function(e){ return {from: poseOf(R("oppHand")), glimpse: poseOf(R("small", e.i)), to: poseOf(R("wall", seat, e.i + 1))}; }),
          pose: {back: poseOf(R("oppHand", seat)), glimpse: poseOf(R("glimpse")), dest: poseOf(R("wall", seat, 0))},
          begin: function(){ setSlab(d); live(true); if(first) first.el.style.opacity = "1"; xs2.forEach(function(e){ if(e.c) e.c.el.style.opacity = "1"; }); },
          commit: function(){ live(false); drop(first); xs2.forEach(function(e){ drop(e.c); }); }}];
      }
      case "pitch": {
        var cs = (d.cards || []).map(function(c, i){ return {card: c, c: clone(c), i: i}; }), els3 = {};
        cs.forEach(function(e){ els3["p" + e.i] = e.c.el; els3["pip" + e.i] = elOf("pip", seat); });
        return [{kind: "pitch", els: els3, cards: cs.map(function(e){ return {from: poseOf(d.own ? R("hand", e.card, e.i) : R("oppHand", seat)), pile: poseOf(R("pile", seat))}; }),
          begin: function(){ cs.forEach(function(e){ hide(e.card, true); e.c.el.style.opacity = "1"; }); },
          commit: function(){ cs.forEach(function(e){ drop(e.c); hide(e.card, false); }); land(d); }}];
      }
      case "block": {
        var bs = (d.cards || []).map(function(c, i){ return {card: c, c: clone(c), i: i}; }), els4 = {total: elOf("total", seat)};
        bs.forEach(function(e){ els4["b" + e.i] = e.c.el; els4["n" + e.i] = elOf("defNum", e.i); });
        return [{kind: "block", els: els4, blockers: bs.map(function(e){ return {from: poseOf(d.own ? R("hand", e.card, e.i) : R("oppHand", seat)), to: poseOf(R("wall", seat, e.i))}; }),
          begin: function(){ bs.forEach(function(e){ hide(e.card, true); e.c.el.style.opacity = "1"; }); },
          commit: function(){ bs.forEach(function(e){ drop(e.c); hide(e.card, false); }); land(d); }}];
      }
      case "arsenal": {
        var ac = clone(d.card, {faceDown: true});
        return [{kind: "arsenal", els: {card: ac && ac.el}, pose: {from: poseOf(d.own && d.card ? R("hand", d.card) : R("oppHand", seat)), to: poseOf(R("arsenal", seat))},
          begin: function(){ hide(d.card, true); if(ac) ac.el.style.opacity = "1"; }, commit: function(){ drop(ac); hide(d.card, false); land(d); }}];
      }
      case "hit": case "ko": {
        var atk = d.attacker ? clone(d.attacker) : null, victim = d.side;
        var home = poseOf(R("chain"), .8), hit = poseOf(R("bout", victim), .9);
        var pop = elOf("pop", victim);
        var b2 = {kind: d.kind, side: victim, dmg: d.dmg, from: d.from, to: d.to, lunge: !!atk,
          els: {attacker: atk && atk.el, world: elOf("world"), flash: elOf("flash", victim), pop: pop, ghost: elOf("ghost", victim),
                loser: elOf("loser", victim), dim: q("dim"), sweep: q("sweep"), result: q("result")},
          pose: {home: home, hit: hit, away: hit, loser: d.kind === "ko" ? poseOf(R("loser", victim)) : undefined},
          contact: function(bb){ if(pop) pop.textContent = "-" + bb.dmg; if(o.onContact) o.onContact(d, bb); },
          begin: function(){ if(atk) atk.el.style.opacity = "1"; if(d.kind === "ko"){ var r = q("result"); if(r){ var w = r.querySelector("span"); if(w) w.textContent = (d.winner === viewer ? "YOU WIN" : upper((view.names && view.names[d.winner]) || "THEY") + " WINS"); } } },
          commit: function(){ drop(atk); land(d); }};
        return [b2];
      }
      case "lifegain":
        return [{kind: "lifegain", n: d.n, from: d.from, to: d.to, els: {fill: elOf("fill", d.side), ghost: elOf("ghost", d.side), pop: elOf("pop", d.side)},
          contact: function(bb){ var p = elOf("pop", d.side); if(p) p.textContent = "+" + bb.n; }, commit: function(){ land(d); }}];
      case "prevent":
        return [{kind: "prevent", els: {flash: elOf("flash", d.side), word: elOf("word", d.side)}, commit: function(){ land(d); }}];
      case "goagain":
        return [{kind: "goagain", els: {chip: elOf("chip", d.seat), ring: elOf("ring", d.seat), pip: elOf("apPip", d.seat)}, pose: {}, commit: function(){ land(d); }}];
      case "turn":
        return [{kind: "turn", side: d.seat === viewer ? "right" : "left", flip: d.seat === viewer ? [180, 360] : [0, 180], els: {medal: elOf("medal"), banner: q("banner"), glow: elOf("glow", d.seat)},
          begin: function(){ var b = q("banner"); if(b){ var t = b.querySelector("b"); if(t) t.textContent = d.slab.line; b.classList.toggle("you", d.seat === viewer); } }, commit: function(){ land(d); }}];
      case "draw": {
        var n = Math.max(0, d.n | 0), cl = [], i2;
        for(i2 = 0; i2 < n; i2++){ var nc = d.own && d.cards && d.cards[i2]; cl.push(clone(nc || null, {faceDown: true})); }
        var els5 = {}; cl.forEach(function(c, i) { els5["c" + i] = c.el; els5["f" + i] = c.back; });
        return [{kind: "draw", els: els5, step: o.drawStep || 90,
          cards: cl.map(function(c, i){ return {from: poseOf(R("deck", d.seat)), to: poseOf(R("hand", d.cards && d.cards[i], i)), flip: !!(d.own && d.cards && d.cards[i])}; }),
          begin: function(){ cl.forEach(function(c){ c.el.style.opacity = "1"; }); }, commit: function(){ cl.forEach(drop); land(d); }}];
      }
      default: return [];     /* "again": a power restated, no motion */
    }
  }

  function play(descs){
    if(disposed) return [];
    var made = [];
    (descs || []).forEach(function(d){
      var bs = toBeats(d);
      bs.forEach(function(b){ var r = director.enqueue(b); if(r) made.push(r); });
      if(!bs.length && o.onLand) o.onLand(d);
    });
    return made;
  }
  return {
    hear: function(step){ return play(beatsFor(step, viewer, view)); },
    play: play,
    setViewer: function(v){ viewer = v; },
    dispose: function(){ disposed = true; cards.slice().forEach(function(c){ if(c.parentNode) c.parentNode.removeChild(c); }); cards = []; }
  };
}

/* ============================================================
   the component (Preact + htm)
   ============================================================ */
var P = root.htmPreact || {};
var html = P.html, useEffect = P.useEffect, useRef = P.useRef;

function Announcer(props){
  var layer = useRef(null);
  useEffect(function(){
    var ctl = createAnnouncer({director: props.director, viewer: props.viewer, view: props.view, layer: layer.current, layout: props.layout,
      onHide: props.onHide, onLand: props.onLand, onContact: props.onContact, size: props.size});
    if(props.api) props.api.current = ctl;
    if(props.onReady) props.onReady(ctl);
    return function(){ ctl.dispose(); if(props.api && props.api.current === ctl) props.api.current = null; };
  }, [props.director, props.viewer]);
  /* tap = skip, press-and-hold (150 ms) = keep it up until release (MOTION 4.3); only the scrim takes taps, and only while a beat shows */
  var holdT = useRef(null), kept = useRef(false);
  var d = props.director;
  var down = function(){ kept.current = false; holdT.current = setTimeout(function(){ kept.current = true; d.hold(true); }, 150); };
  var up = function(){ clearTimeout(holdT.current); if(kept.current){ d.hold(false); kept.current = false; } else d.skip(); };
  var cancel = function(){ clearTimeout(holdT.current); if(kept.current){ d.hold(false); kept.current = false; } };
  return html`<div class="an-layer" data-b="announcer" ref=${layer}>
    <div class="an-scrim" onPointerDown=${down} onPointerUp=${up} onPointerCancel=${cancel}></div>
    <div class="an-slab" data-b="slab"><small></small><b></b></div>
    <div class="an-slab an-banner" data-b="banner"><b></b></div>
    <div class="an-dim"></div><div class="an-sweep"></div>
    <div class="an-result" data-b="result"><b>DAWNBREAK</b><span></span></div>
  </div>`;
}

return {beatsFor: beatsFor, createAnnouncer: createAnnouncer, Announcer: Announcer, defaultLayout: defaultLayout, poseOf: poseOf, seatName: seatName, CARD_W: CARD_W, CARD_H: CARD_H};
});
