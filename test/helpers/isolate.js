/* test/helpers/isolate.js — A SERVER-LIKE RUNTIME FOR THE REFEREE (HIDDEN HANDS H3).

   HIDDEN-HANDS.md §6 asks that the referee be proven server-side, behind
   net.wsAdapter, with the drills unchanged — and that no account or provider
   be needed to prove it. This builds the runtime a Cloudflare Worker or a
   Durable Object gives a script, inside node's `vm`, and nothing more:

     present   self/globalThis, console, crypto.getRandomValues, setTimeout /
               clearTimeout, performance, TextEncoder / TextDecoder, URL,
               structuredClone — the web-standard globals both Workers and
               Deno (Supabase Edge Functions) provide;
     ABSENT    window, document, require, module, process, Buffer, global —
               the DOM and every node API.

   Into it go, as plain scripts in the page's own load order, `data/pool.js`,
   index.html's data script (HEROES, DECKS) and every engine module the page
   loads — what a Worker bundle of this repo would be, with no build step:
   the UMD files attach to `self` exactly as they do in a browser. Then a
   Durable-Object-shaped `TableObject` (written below, in the isolate's own
   source) builds the card database the way the page does, opens a judged
   table (hub.js) and takes each WebSocket through `DawnNet.wsAdapter(sock)
   .accept(hub)`. Everything that crosses into or out of it is a JSON STRING
   on a socket, as on a real wire.

   Used by test/wsreferee.test.js and tools/serverrun.js. */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const {webcrypto} = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const INDEX = path.join(ROOT, "index.html");
const SERVER_SCRIPT = "server/referee.js";

/* the scripts the page loads, in order (engine/ and data/ only) */
function pageScripts(){
  const html = fs.readFileSync(INDEX, "utf8");
  return [...html.matchAll(/<script src="((?:engine|data)\/[a-z0-9]+\.js)"/g)].map(m => m[1]);
}
/* index.html's data script: window.CDN … HEROES, DECKS (extract.js's slice) */
function dataScript(){
  const src = fs.readFileSync(INDEX, "utf8");
  const start = src.indexOf("window.CDN");
  return src.slice(start, src.indexOf("</script>", start));
}

/* THE TABLE OBJECT — source evaluated INSIDE the isolate. Shaped like a
   Durable Object: one per table, holding the hub; `webSocket(server)` is
   what its fetch handler would call with the server end of a WebSocketPair. */
const TABLE_OBJECT = `
(function(){
  /* the card database, built as the page builds it (useCardDB): the pinned
     pool through cards.js, handed to the judge */
  const DB = DawnCards.buildMaps(DAWN_POOL.filter(c => c && c.name).map(DawnCards.mapDbCard));
  DawnJudge.setDb(DB);
  const W = self.__DATA;
  /* uids from 100000, as the drills deal (any scalar equal to a hidden uid is a leak) */
  function deal(spec){
    const h0 = W.HEROES.find(h => h.k === spec.heroes[0]), h1 = W.HEROES.find(h => h.k === spec.heroes[1]);
    const ctr = {n: 100000};
    let rng = DawnRNG.make(spec.seed);
    const b0 = DawnBuild.buildSideDefault(h0, DawnGame.parseDeck(W.DECKS[h0.k]), DB, rng, ctr); rng = b0.rng;
    const b1 = DawnBuild.buildSideDefault(h1, DawnGame.parseDeck(W.DECKS[h1.k]), DB, rng, ctr); rng = b1.rng;
    const state = DawnJudge.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: spec.first || 0, tokSeq: ctr.n});
    const cards = [].concat(...state.sides.map(sd => [...sd.deck, ...sd.hand, ...sd.gear, ...(sd.board || []).map(e => (e && e.card) || e), ...(sd.arsenal ? [sd.arsenal] : [])]));
    return {state, catalog: DawnWire.makeCatalog(cards)};
  }
  class TableObject {
    constructor(o){
      o = o || {};
      this.hub = DawnHub.createHub({code: o.code || "SRVR", build: o.build, deal, reduce: DawnJudge.reduce, legal: DawnJudge.legal,
        check: DawnInvariants.errors, rand: o.rand || null, resume: o.resume || null, onEvent: o.onEvent || null});
    }
    webSocket(server){ return DawnNet.wsAdapter(server).accept(this.hub); }
  }
  self.TableObject = TableObject;
  self.__deal = deal;    /* the server drills (server/referee.js) deal with the same database */
  self.__runtime = {window: typeof window, document: typeof document, require: typeof require, module: typeof module,
                    process: typeof process, Buffer: typeof Buffer, global: typeof global};
})();`;

/* Build the isolate. Returns {ctx, run(src), TableObject, runtime}. `o.extra`
   adds globals (the sabotage drill hands in a `window`). */
function makeIsolate(o){
  o = o || {};
  const sb = {console, crypto: {getRandomValues: a => webcrypto.getRandomValues(a)},
              setTimeout, clearTimeout, performance: {now: () => performance.now()},
              TextEncoder, TextDecoder, URL, structuredClone, ...(o.extra || {})};
  sb.self = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  const run = (src, file) => vm.runInContext(src, ctx, {filename: file || "isolate"});
  const w = {};
  new Function("window", dataScript())(w);
  sb.__DATA = JSON.parse(JSON.stringify({HEROES: w.HEROES, DECKS: w.DECKS}));
  for(const f of pageScripts()) run(fs.readFileSync(path.join(ROOT, f), "utf8"), f);
  run(TABLE_OBJECT, "table-object.js");
  /* the hosted referee (SERVER S1) is not a page script: a plain script after them */
  run(fs.readFileSync(path.join(ROOT, SERVER_SCRIPT), "utf8"), SERVER_SCRIPT);
  return {ctx, run, TableObject: sb.TableObject, runtime: sb.__runtime, scripts: pageScripts(),
          server: sb.DawnServer, deal: sb.__deal, serverScripts: [SERVER_SCRIPT]};
}

module.exports = {makeIsolate, pageScripts};
