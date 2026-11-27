/* ============================================================
   ui/worker/ai.js — the AI seat's thinking, off the main thread (a classic Web Worker; no modules, no build).
   Sharp (DawnSparring.act with search) is one long task: run in the page it stutters every animation beat. This worker
   loads the engine's own scripts (the SAME files play.html loads, in the same order, a subset: test/ui-ai-worker.test.js
   holds it), is handed a state, and answers DawnSparring.act(state, seat, {search}) — the engine's answer and nobody
   else's. NO NEW RULES, NO COPIES. ui/session.js owns the page side and the mandatory main-thread fallback
   (file:// refuses Workers in Chromium).

   Messages in:   {t:"init", cdn}                      build the card database the way the page does
                  {t:"act", id, state, seat, search}   think
   Messages out:  {t:"ready"} · {t:"act", id, action} · {t:"error", id?, error}
   ============================================================ */
/* the engine, in play.html's order (a subset; paths are relative to this file) */
var ENGINE = [
  "../../data/pool.js",
  "../../engine/rng.js", "../../engine/parser.js", "../../engine/game.js", "../../engine/types.js", "../../engine/rps.js",
  "../../engine/sides.js", "../../engine/priority.js", "../../engine/prompts.js", "../../engine/invariants.js", "../../engine/cards.js", "../../engine/advisor.js",
  "../../engine/build.js", "../../engine/effects.js", "../../engine/view.js", "../../engine/judge.js", "../../engine/sparring.js"
];
(function(root){
  var loaded = false;
  function load(cdn){
    if(loaded) return;
    importScripts.apply(root, ENGINE);
    if(cdn) root.DawnCards.setCDN(cdn);
    var db = root.DawnCards.buildMaps(root.DAWN_POOL.filter(function(c){ return c && c.name; }).map(root.DawnCards.mapDbCard));
    root.DawnJudge.setDb(db);
    loaded = true;
  }
  root.onmessage = function(ev){
    var m = ev.data || {};
    try {
      if(m.t === "init"){ load(m.cdn); root.postMessage({t: "ready"}); }
      else if(m.t === "act"){
        load();
        var a = root.DawnSparring.act(m.state, m.seat, {search: m.search !== false});
        root.postMessage({t: "act", id: m.id, action: a == null ? null : a});
      }
    } catch(e){
      root.postMessage({t: "error", id: m.id, error: String(e && e.message || e)});
    }
  };
})(self);
