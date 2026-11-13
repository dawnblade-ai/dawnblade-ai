/* test/helpers/serverfakes.js — THE HOSTED REFEREE'S TWO PROVIDERS, FAKED (SERVER S1).

   server/referee.js touches the outside world through exactly two deps, and
   neither needs an account to be drilled:

     memStore()   a versioned row store (a Postgres table the service role
                  alone may touch): get(id) -> {version, row}|null,
                  put(id, row, expectedVersion) -> {ok, version}. A put
                  against any version but the stored one is refused, exactly
                  as an `update ... where version = $expected` would. Every
                  row is kept as the JSON TEXT it was written as (what a
                  jsonb column hands back), and every size is recorded.
     memBus()     private broadcast channels: subscribe(topic, fn) and
                  broadcast(topic, payload). It RECORDS every payload ever
                  sent (`log`), JSON-roundtripped, so a drill can scan them.

   `lagged(store)` / `laggedBus(bus)` return the same deps with every call
   answering through promises and a few turns of the event loop, so the
   asynchronous body of `handle` (and a real race between two requests) is
   exercised rather than assumed. */
const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const bytes = s => enc ? enc.encode(s).length : Buffer.byteLength(s);
const clone = v => JSON.parse(JSON.stringify(v));

function memStore(){
  const rows = new Map();
  const st = {rows, gets: 0, puts: 0, conflicts: 0, sizes: [],
    get(id){
      st.gets++;
      const e = rows.get(id);
      return e ? {version: e.version, row: JSON.parse(e.json)} : null;
    },
    put(id, row, expectedVersion){
      const e = rows.get(id), cur = e ? e.version : 0;
      if(expectedVersion !== cur){ st.conflicts++; return {ok: false, version: cur}; }
      const json = JSON.stringify(row);
      st.puts++; st.sizes.push(bytes(json));
      rows.set(id, {version: cur + 1, json});
      return {ok: true, version: cur + 1};
    },
    json: id => rows.has(id) ? rows.get(id).json : null,
    row: id => rows.has(id) ? JSON.parse(rows.get(id).json) : null,
    version: id => rows.has(id) ? rows.get(id).version : 0,
    largest: () => st.sizes.reduce((a, b) => Math.max(a, b), 0)};
  return st;
}

function memBus(){
  const subs = new Map(), log = [];
  return {log,
    subscribe(topic, fn){
      if(!subs.has(topic)) subs.set(topic, new Set());
      subs.get(topic).add(fn);
      return () => subs.get(topic).delete(fn);
    },
    broadcast(topic, payload){
      const p = clone(payload);
      log.push({topic, payload: p});
      for(const fn of [...(subs.get(topic) || [])]) fn(clone(p));
    },
    /* every payload sent to `topic`, in order */
    sent: topic => log.filter(e => e.topic === topic).map(e => e.payload)};
}

const tick = n => { let p = Promise.resolve(); for(let i = 0; i < (n || 1); i++) p = p.then(() => null); return p; };
function lagged(store, ticks){
  const t = ticks || 3;
  return {get: id => tick(t).then(() => store.get(id)), put: (id, row, v) => tick(t).then(() => store.put(id, row, v)), inner: store};
}
function laggedBus(bus, ticks){
  const t = ticks || 2;
  return {broadcast: (topic, payload) => tick(t).then(() => bus.broadcast(topic, payload)), inner: bus};
}

module.exports = {memStore, memBus, lagged, laggedBus, bytes, tick};
