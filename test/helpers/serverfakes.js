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
  const st = {codes: rec, clock: 1700000000000, deleted: [], orphans: [], mints: 0, redeems: 0,
    footprint(player){
      if(o.rat){ const r = o.rat.rt.get(player); if(r && r.games > 0) return true; for(const x of o.rat.results.values()) if(x.players.indexOf(player) >= 0) return true; }
      if(o.store) for(const id of o.store.rows.keys()){ const row = o.store.row(id); if(row && row.ranked === true && row.over !== true && Array.isArray(row.owners) && row.owners.indexOf(player) >= 0) return true; }
      return false;
    },
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
        if(!o.leaveThrowaway && ![...idp.live.values()].some(x => x.player === cur)){
          /* S5.2 (007_forfeit.sql): a throwaway WITH a ranked footprint (a rated game, a result naming it, a seat at an unfinished ranked table) is kept orphaned but
             intact (its name freed, its codes gone, its rating and results untouched); with none it is deleted as in v6.30. Needs `o.rat` (withRatings) and `o.store`. */
          const fp = !o.deleteAlways && st.footprint(cur);
          idp.names.delete(cur); for(const [h, x] of rec) if(x.player === cur) rec.delete(h);
          if(fp) st.orphans.push(cur); else { st.deleted.push(cur); if(o.rat) o.rat.rt.delete(cur); }
        }
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
/* THE LADDER BACKEND, FAKED (S5.3): what `deps.ladder({player, floor, limit, recent})` stands on, behaving as 008_ladder.sql's ladder_get does, over the ratings
   backend (`rat`, withRatings) and the sign-in provider (`idp`, memIdentity). LISTED = a chosen name (the registry, else the sign-in's own default), at least `floor`
   games, and a live sign-in pointing at the player (an orphan has none). Order: rating desc, more games, name fold in byte order. The top `limit`; the last `recent`
   results newest first (ended desc, then game id desc); the caller's line when a player is given and exists. READ-ONLY: `reads` counts calls, and the sabotage
   `touch` makes a read write a rating row (a drill proves a read changes nothing). The other sabotages: `noFloor`, `noName`, `noOrphan`, `noCap` (the list ignores
   `limit`), `noGames` (no more-games tie-break), `byNameDesc`, `leakId` (a player id rides every row), `badRank` (the caller's rank is off by one), `unsorted`. */
function withLadder(rat, idp, o){
  o = o || {};
  const st = {reads: 0, last: null};
  const byte = (x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y));
  const nameOf = p => { const r = idp.names.get(p); if(r) return {name: r.name, fold: r.fold}; for(const w of idp.live.values()) if(w.player === p && w.name) return {name: w.name, fold: w.name.toLowerCase().replace(/ /g, "")}; return null; };
  st.ladder = ({player, floor, limit, recent}) => {
    st.reads++; st.last = {player, floor, limit, recent};
    if(o.touch && player) rat.rt.set(player, rat.rt.get(player) || {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0});
    const signed = new Set([...idp.live.values()].map(w => w.player));
    const listed = id => { const r = rat.rt.get(id), n = nameOf(id); return !!(r && (o.noFloor || r.games >= floor) && (o.noName || n) && (o.noOrphan || signed.has(id))); };
    const cmp = (x, y) => (o.unsorted ? x.r.rating - y.r.rating : y.r.rating - x.r.rating) || (o.noGames ? 0 : y.r.games - x.r.games) || (o.byNameDesc ? -1 : 1) * byte((x.n || {fold: ""}).fold, (y.n || {fold: ""}).fold);
    const all = [...rat.rt.keys()].filter(listed).map(id => ({id, r: rat.rt.get(id), n: nameOf(id)})).sort(cmp);
    const out = {ladder: all.slice(0, o.noCap ? all.length : limit).map((x, i) => ({rank: i + 1, name: x.n ? x.n.name : "Unnamed", rating: x.r.rating, games: x.r.games, wins: x.r.wins, losses: x.r.losses, draws: x.r.draws, ...(o.leakId ? {id: x.id} : {})})),
      recent: [...rat.results.values()].sort((x, y) => y.ended - x.ended || byte(y.game, x.game)).slice(0, recent).map(x => ({names: x.names.slice(), heroes: x.heroes.slice(), winner: x.winner, how: x.how, at: x.ended}))};
    if(player != null && (rat.rt.has(player) || nameOf(player) || signed.has(player))){
      const r = rat.rt.get(player) || {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0}, n = nameOf(player), ok = listed(player), at = all.findIndex(x => x.id === player);
      out.you = {name: n ? n.name : null, rating: r.rating, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws, listed: ok, rank: ok ? at + 1 + (o.badRank ? 1 : 0) : null, ...(o.leakId ? {id: player} : {})};
    }
    return JSON.parse(JSON.stringify(out));
  };
  st.deps = () => ({ladder: x => st.ladder(x)});
  return st;
}
/* THE MATCHMAKING QUEUE, FAKED (S6.1): what `deps.seek({player, ranked, table, ttl})` / `deps.seek({player, cancel:true, ttl})` stand on, behaving as
   009_seek.sql's seek_step / seek_cancel do (held to it by the SQL's own self-check and tools/sql-sab-009.js): one seek per player; a seek not seen for `ttl`
   seconds is forgotten (taken or not); a step first looks for ANOTHER player's untaken seek of the same kind, oldest first, and takes it (the caller's own seek,
   if any, leaves the queue and its table is `drop`); else it refreshes the caller's seek, or inserts it when a table is given; a taken seek answers `taken` to its
   owner. `clock` is the drill's own time (ms). `count(ttl)` is seek_count. Sabotages: `selfMatch`, `anyKind`, `retake` (a taken seek is matched again), `noAge`.
   010_rating_window.sql: a RANKED step only takes a seek whose rating (`o.rate(player)`, default 1200) is within 100 + 50 per whole 20 s of the LONGER of the two waits
   (`clock` - `at`); casual is unwindowed. from 180 s of the longer wait the window is open fully. Sabotages: `noWindow`, `noWiden`, `casualWindow`, `noCap`. */
function withSeek(o){
  o = o || {};
  const q = new Map(); let born = 0;
  const rate = p => (o.rate ? o.rate(p) : null) ?? 1200;
  const st = {q, clock: 1700000000000, steps: 0, cancels: 0, log: [],
    /* 011_seek_wait.sql's seek_wait_stats: the median wait (rounded UP to 5 s) of the last 24 h's completed seeks of this kind; null under 5 of them */
    wait(ranked){
      const live = st.log.filter(e => e.ranked === (ranked === true) && e.at >= st.clock - 86400000).map(e => e.s).sort((a, b) => a - b), n = live.length;
      const med = n === 0 ? 0 : n % 2 ? live[(n - 1) / 2] : (live[n / 2 - 1] + live[n / 2]) / 2;
      return {n, typical: n >= 5 ? Math.ceil(med / 5) * 5 : null};
    },
    age(ttl){ if(o.noAge) return; for(const [p, e] of q) if(e.seen < st.clock - ttl * 1000) q.delete(p); },
    seek(x){
      if(x.cancel === true){
        st.cancels++; st.age(x.ttl);
        const m = q.get(x.player);
        if(!m) return {state: "none"};
        if(m.taken) return {state: "taken", table: m.table};
        q.delete(x.player); return {state: "cancelled", table: m.table};
      }
      st.steps++; st.age(x.ttl);
      let mine = q.get(x.player) || null, drop = null;
      const out = (state, table) => ({state, ...(table ? {table} : {}), ...(drop ? {drop} : {})});
      if(mine && mine.taken){ if(x.table && x.table !== mine.table) drop = x.table; return out("taken", mine.table); }
      if(mine && mine.ranked !== x.ranked){ q.delete(x.player); drop = mine.table; mine = null; }
      const waited = e => Math.max(0, (st.clock - e.at) / 1000), win = w => (!o.noCap && w >= 180) ? Infinity : 100 + (o.noWiden ? 0 : 50 * Math.floor(w / 20));
      const inside = (p, e) => o.noWindow || !(x.ranked || o.casualWindow) || Math.abs(rate(p) - rate(x.player)) <= win(Math.max(waited(e), mine ? waited(mine) : 0));
      const other = [...q.entries()].filter(([p, e]) => (o.selfMatch || p !== x.player) && (o.anyKind || e.ranked === x.ranked) && (o.retake || !e.taken) && inside(p, e))
        .sort((a, b) => a[1].born - b[1].born || (a[0] < b[0] ? -1 : 1))[0];
      if(other){
        other[1].taken = true; other[1].seen = st.clock;
        if(!o.noLog) st.log.push({ranked: other[1].ranked, s: Math.max(0, Math.round((st.clock - other[1].at) / 1000)), at: st.clock});   /* 011_seek_wait.sql's trigger */
        if(mine){ if(other[0] !== x.player) q.delete(x.player); drop = mine.table; }
        if(!drop && x.table) drop = x.table;
        return out("matched", other[1].table);
      }
      if(mine){ mine.seen = st.clock; if(x.table && x.table !== mine.table) drop = drop || x.table; return out("waiting", mine.table); }
      if(x.table){ q.set(x.player, {table: x.table, ranked: x.ranked, born: ++born, at: st.clock, seen: st.clock, taken: false}); return out("waiting", x.table); }
      return out("none");
    },
    count(ttl){ const live = [...q.values()].filter(e => !e.taken && e.seen >= st.clock - ttl * 1000); return {friendly: live.filter(e => !e.ranked).length, ranked: live.filter(e => e.ranked).length}; },
    deps: () => ({seek: x => st.seek(x), seekCount: ttl => st.count(ttl), ...(o.noWait ? {} : {seekWait: r => st.wait(r)})})};
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

module.exports = {memStore, memBus, memIdentity, withRecovery, withRatings, withLadder, withSeek, lagged, laggedBus, bytes, tick};
