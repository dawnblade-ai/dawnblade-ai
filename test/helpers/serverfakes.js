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
  const rows = new Map(); let born = 0;
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
      rows.set(id, {version: cur + 1, json, n: e ? e.n : ++born});
      return {ok: true, version: cur + 1};
    },
    /* S4.4 — what 005_table_cap.sql's table_create_capped does, in one synchronous (so atomic) step: refuse a taken code, count the
       creator's OPEN tables (row.creator is theirs, row.over is not true; the drill's clock is the rows' own `updated`), refuse at
       the cap with their codes oldest first, else insert at version 1. `noCount` is the sabotage: it never refuses. */
    createCapped(id, row, creator, cap){
      if(rows.has(id)) return {ok: false, exists: true};
      const open = st.openOf(creator);
      if(!st.noCount && open.length >= cap) return {ok: false, capped: true, open: open.slice(0, 10)};
      return st.put(id, row, 0);
    },
    /* an inspector: the codes of the creator's open tables, oldest first */
    openOf: creator => [...rows.entries()].map(([id, e]) => ({id, row: JSON.parse(e.json), n: e.n})).filter(x => x.row.creator === creator && x.row.over !== true)
      .sort((a, b) => a.n - b.n).map(x => x.id),
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

/* THE SIGN-IN PROVIDER, FAKED (S4.1): what `deps.identify(token)` stands on. issue(player, name?) hands out a token the way a
   provider would (opaque, unguessable-looking, never the player id); identify(token) answers {player, name?} or null for a
   forged, expired or revoked one — the function never learns how. `calls` counts the lookups (a join with no token makes none). */
function memIdentity(){
  const live = new Map(); let n = 0;
  const st = {calls: 0, tokens: [], live,
    issue(player, name){ const t = "jwt." + (++n) + "." + Math.abs(hash(player + "|" + n)).toString(36) + "xyz"; live.set(t, {player, ...(name ? {name} : {})}); st.tokens.push(t); return t; },
    expire: t => live.delete(t),
    identify(token){ st.calls++; const w = live.get(token); if(!w) return null; const nm = st.names.has(w.player) ? st.names.get(w.player).name : w.name; return {player: w.player, ...(nm ? {name: nm} : {})}; },
    /* the name registry (S4.2): one holder per fold, like the unique index in 003_names.sql */
    names: new Map(), renames: 0,
    rename(player, name, fold){ st.renames++; for(const [p, n] of st.names) if(p !== player && n.fold === fold) return "taken"; st.names.set(player, {name, fold}); return "ok"; }};
  return st;
}
/* THE RECOVERY BACKEND, FAKED (S4.3): what `deps.mint` / `deps.redeem` stand on, behaving as 004_recovery.sql does — one live code
   per player; a redeem spends the code, moves THAT token's sign-in to the code's player and deletes the throwaway player (and its name)
   when it has no sign-in left; wrong, used, expired and retired are one 'refused'; eight refusals an hour from one sign-in are 'limited'
   (and a limited try does not look at the code). `clock` is the drill's own time; `keepOld`, `noBrake`, `leaveThrowaway`, `neverSpend` are the sabotages. */
function withRecovery(idp, o){
  o = o || {};
  const rec = new Map(), attempts = new Map();
  const st = {codes: rec, clock: 1700000000000, deleted: [], mints: 0, redeems: 0,
    mint(player, hash, days){
      st.mints++;
      if(!o.keepOld) for(const [h, e] of rec) if(e.player === player && !e.used) rec.delete(h);
      rec.set(hash, {player, used: false, expires: st.clock + days * 86400000});
      return "ok";
    },
    redeem(token, hash){
      st.redeems++;
      const w = idp.live.get(token); if(!w) return null;
      const tries = (attempts.get(token) || []).filter(t => t > st.clock - 3600000);
      if(!o.noBrake && tries.length >= 8) return {status: "limited"};
      const e = rec.get(hash);
      if(!e || e.used || e.expires <= st.clock){ tries.push(st.clock); attempts.set(token, tries); return {status: "refused"}; }
      if(!o.neverSpend) e.used = true;
      const cur = w.player;
      if(e.player !== cur){
        w.player = e.player;
        if(!o.leaveThrowaway && ![...idp.live.values()].some(x => x.player === cur)){ st.deleted.push(cur); idp.names.delete(cur); for(const [h, x] of rec) if(x.player === cur) rec.delete(h); }
      }
      attempts.delete(token);
      const nm = idp.names.get(e.player);
      return {status: "ok", ...(nm ? {name: nm.name} : {})};
    }};
  return st;
}
/* THE RATINGS BACKEND, FAKED (S5.1): what `deps.rating` / `deps.record` stand on, behaving as 006_ratings.sql does — a player nobody has rated reads as
   1200 with no games; a result is stored ONCE per game id (a second call answers the stored one, recorded:false, and moves nothing); both ratings move
   in the same step by Elo, K 32, a draw half a point, each rounded to an integer. Its arithmetic is checked against test/fixtures/elo-vectors.json (the
   very table tools/sql-pglite.js feeds to the SQL), so it cannot drift from the real thing. The sabotages: `noIdempotent` records every call, `k` is another K, `failing`
   makes `record` throw (the database is down). */
function withRatings(o){
  o = o || {};
  const rt = new Map(), results = new Map();
  const get = p => { if(!rt.has(p)) rt.set(p, {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0}); return rt.get(p); };
  const elo = (ra, rb, score) => { const K = o.k || 32, e = 1 / (1 + Math.pow(10, (rb - ra) / 400)); return [Math.round(ra + K * (score - e)), Math.round(rb + K * ((1 - score) - (1 - e)))]; };
  const st = {rt, results, records: 0, duplicates: 0, lookups: 0, failing: false, elo,
    rating(player){ st.lookups++; const r = rt.has(player) ? rt.get(player) : {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0}; return {...r}; },
    record(x){
      st.records++;
      if(st.failing) throw new Error("the ratings database is down");
      if(!x || typeof x.game !== "string" || x.players[0] === x.players[1] || !["life", "concession", "stalemate", "forfeit"].includes(x.how) || ((x.how === "stalemate") !== (x.winner === null))) throw new Error("result_record refused this result");
      const ex = results.get(x.game);
      if(ex && !o.noIdempotent){ st.duplicates++; return {recorded: false, ratings: [{from: ex.b0, to: ex.a0}, {from: ex.b1, to: ex.a1}]}; }
      const r0 = get(x.players[0]), r1 = get(x.players[1]), ra = r0.rating, rb = r1.rating;
      const [na, nb] = elo(ra, rb, x.winner === null ? 0.5 : x.winner === 0 ? 1 : 0);
      r0.rating = na; r1.rating = nb;
      for(const [r, w] of [[r0, x.winner === 0], [r1, x.winner === 1]]){ r.games++; if(x.winner === null) r.draws++; else if(w) r.wins++; else r.losses++; }
      results.set(x.game, {b0: ra, a0: na, b1: rb, a1: nb, ...JSON.parse(JSON.stringify(x))});
      return {recorded: true, ratings: [{from: ra, to: na}, {from: rb, to: nb}]};
    },
    /* seed a player's rating (a drill's starting point) */
    set(player, rating){ const r = get(player); r.rating = rating; return st; },
    deps: () => ({rating: p => st.rating(p), record: x => st.record(x)})};
  return st;
}
function hash(s){ let h = 7; for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

const tick = n => { let p = Promise.resolve(); for(let i = 0; i < (n || 1); i++) p = p.then(() => null); return p; };
function lagged(store, ticks){
  const t = ticks || 3;
  return {get: id => tick(t).then(() => store.get(id)), put: (id, row, v) => tick(t).then(() => store.put(id, row, v)),
    ...(typeof store.createCapped === "function" ? {createCapped: (id, row, creator, cap) => tick(t).then(() => store.createCapped(id, row, creator, cap)), openOf: store.openOf} : {}), inner: store};
}
function laggedBus(bus, ticks){
  const t = ticks || 2;
  return {broadcast: (topic, payload) => tick(t).then(() => bus.broadcast(topic, payload)), inner: bus};
}

module.exports = {memStore, memBus, memIdentity, withRecovery, withRatings, lagged, laggedBus, bytes, tick};
