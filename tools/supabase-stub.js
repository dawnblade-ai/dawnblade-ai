#!/usr/bin/env node
/* ============================================================
   tools/supabase-stub.js — LOCAL STAND-INS FOR THE TWO SUPABASE SERVICES THE FUNCTION CALLS (SERVER S3)

   Exactly the REST calls server/supabase/entry.template.ts makes, nothing more, over plain HTTP on 127.0.0.1:

     GET  /rest/v1/tables?id=eq.<id>&select=version,row     PostgREST: [] or [{version, row}]
     POST /rest/v1/rpc/table_put {p_id, p_row, p_expected}  server/supabase/001_tables.sql's table_put(): the new version, or 0
     POST /realtime/v1/api/broadcast {messages:[{topic,event,payload,private}]}   202, 422 on a payload over the limit
                                                           (the real endpoint's observed limit: 250,000 bytes)

   S4.1 adds the two calls entry.template.ts's `identify` makes (a stand-in for GoTrue's and for 002_players.sql's function):
     GET  /auth/v1/user                                     apikey + Bearer <user token> -> {id, is_anonymous} or 401
     POST /rest/v1/rpc/identity_resolve {p_provider, p_subject, p_name}   -> [{player_id, display_name}] (same sign-in, same player)
   S4.3 adds recovery_mint / recovery_redeem (a stand-in for 004_recovery.sql: one live code per player, spend + move the identity + drop the
   throwaway player, 8 refusals an hour); `recovery` (hash -> {player, used, expires}) and `attempts` are readable.
   S4.4 adds table_create_capped {p_id, p_row, p_creator, p_cap} (a stand-in for 005_table_cap.sql: ONE jsonb answer, {version} | {version:0, exists} |
   {version:0, capped, open:[ids]}; open = the creator's rows not over, idle under 48 hours; a row also keeps an `at` time the rehearsal may age).
   S5.2 adds the forfeit ending to result_record and 007's footprint rule to recovery_redeem (a throwaway that played, or sits at an unfinished ranked table, is kept orphaned).
   S5.1 adds rating_get {p_player} -> [{rating, games, wins, losses, draws}] (the starting rating and no games for an unrated player) and result_record
   {p_game, p_table, p_p0, p_p1, p_n0, p_n1, p_h0, p_h1, p_winner, p_how, p_turns, p_build, p_started, p_ended} -> {recorded, ratings:[{from,to},{from,to}]}
   (a stand-in for 006_ratings.sql: once per game id, Elo with K 32 from 1200, both ratings in one step; `ratings`, `results` are readable). Its Elo is
   checked against the very table (test/fixtures/elo-vectors.json) the SQL is checked against in tools/sql-pglite.js.
   `issueUser(id, anon?)` hands out a token; `users`, `players`, `identities` are readable; stats.auths / stats.resolves count calls.

   It checks the headers the real services need (apikey; bearer unless the key is "sb_…"), keeps rows as JSON text like
   a jsonb column, and hands every broadcast to `onBroadcast(topic, payload)` so a driver can fan it out to subscribers.
   `serve(port?)` -> {url, port, close, rows, broadcasts, stats}. Not a Supabase emulator: it checks the calls this
   repo makes, which is the point of the rehearsal (tools/supabase-rehearse.js). */
"use strict";
const http = require("http");

function makeStub(o){
  o = o || {};
  const rows = new Map(), broadcasts = [], stats = {gets: 0, puts: 0, conflicts: 0, casts: 0, bad: [], largestPut: 0};
  const KEY = o.key || "stub-service-key";
  const subs = [], users = new Map(), players = new Map(), identities = new Map(), recovery = new Map(), attempts = new Map(), ratings = new Map(), results = new Map();
  stats.auths = 0; stats.resolves = 0; let seq = 0, born = 0, authDown = false;
  const handler = (req, res) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url, "http://stub");
      const reply = (code, obj) => { const t = obj === undefined ? "" : JSON.stringify(obj); res.writeHead(code, {"content-type": "application/json"}); res.end(t); };
      if(req.headers.apikey !== KEY){ stats.bad.push("no apikey " + url.pathname); return reply(401, {message: "No API key found in request"}); }
      if(req.method === "GET" && url.pathname === "/auth/v1/user"){
        stats.auths++;
        if(authDown) return reply(503, {msg: "auth is down"});
        const u = users.get(String(req.headers.authorization || "").replace(/^Bearer /, ""));
        return u ? reply(200, {id: u.id, is_anonymous: !!u.anon, aud: "authenticated", role: "authenticated"}) : reply(401, {code: 401, error_code: "bad_jwt", msg: "invalid JWT"});
      }
      if(!KEY.startsWith("sb_") && req.headers.authorization !== "Bearer " + KEY){ stats.bad.push("no bearer " + url.pathname); return reply(401, {message: "bad bearer"}); }
      try {
        if(req.method === "GET" && url.pathname === "/rest/v1/tables"){
          stats.gets++;
          const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
          if(url.searchParams.get("select") !== "version,row"){ stats.bad.push("select " + url.search); return reply(400, {message: "unexpected select"}); }
          const e = rows.get(id);
          return reply(200, e ? [{version: e.version, row: JSON.parse(e.json)}] : []);
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/table_put"){
          const {p_id, p_row, p_expected} = JSON.parse(body);
          if(typeof p_id !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(p_id) || typeof p_row !== "object" || !Number.isInteger(p_expected)){ stats.bad.push("table_put args"); return reply(400, {message: "bad args"}); }
          const e = rows.get(p_id);
          let v = 0;
          if(p_expected === 0){ if(!e){ rows.set(p_id, {version: 1, json: JSON.stringify(p_row), at: Date.now(), n: ++born}); v = 1; } }
          else if(e && e.version === p_expected){ e.version++; e.json = JSON.stringify(p_row); e.at = Date.now(); v = e.version; }
          stats.puts++; if(!v) stats.conflicts++; stats.largestPut = Math.max(stats.largestPut, Buffer.byteLength(body));
          return reply(200, v);
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/table_create_capped"){   /* 005_table_cap.sql: the count and the insert are one step (this process is single-threaded) */
          stats.capped = (stats.capped || 0) + 1;
          const {p_id, p_row, p_creator, p_cap} = JSON.parse(body);
          if(typeof p_id !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(p_id) || !p_row || typeof p_row !== "object" || typeof p_creator !== "string" || !p_creator || !Number.isInteger(p_cap) || p_cap < 1 || p_row.creator !== p_creator){ stats.bad.push("table_create_capped args"); return reply(400, {message: "bad args"}); }
          for(const [k, e] of rows) if(e.at < Date.now() - 48 * 3600000) rows.delete(k);
          if(rows.has(p_id)) return reply(200, {version: 0, exists: true});
          const open = [...rows.entries()].map(([id, e]) => ({id, n: e.n || 0, r: JSON.parse(e.json)})).filter(x => x.r.creator === p_creator && x.r.over !== true).sort((a, b) => a.n - b.n).map(x => x.id);
          if(open.length >= p_cap) return reply(200, {version: 0, capped: true, open: open.slice(0, 10)});
          rows.set(p_id, {version: 1, json: JSON.stringify(p_row), at: Date.now(), n: ++born});
          return reply(200, {version: 1});
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/rating_get"){        /* 006_ratings.sql: one row; 1200 and no games when unrated */
          stats.ratingGets = (stats.ratingGets || 0) + 1;
          const {p_player} = JSON.parse(body);
          if(typeof p_player !== "string" || !p_player){ stats.bad.push("rating_get args"); return reply(400, {message: "bad args"}); }
          const r = ratings.get(p_player) || {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0};
          return reply(200, [{rating: r.rating, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws}]);
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/result_record"){     /* 006_ratings.sql: once per game id; Elo, K 32, both ratings together */
          stats.records = (stats.records || 0) + 1;
          const a = JSON.parse(body);
          const okArgs = typeof a.p_game === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(a.p_game) && typeof a.p_table === "string" && typeof a.p_p0 === "string" && typeof a.p_p1 === "string"
            && a.p_p0 && a.p_p1 && a.p_p0 !== a.p_p1 && ["life", "concession", "stalemate", "forfeit"].includes(a.p_how) && (a.p_winner === null || a.p_winner === 0 || a.p_winner === 1)
            && ((a.p_how === "stalemate") === (a.p_winner === null)) && typeof a.p_h0 === "string" && typeof a.p_h1 === "string" && Number.isInteger(a.p_turns) && a.p_turns >= 0;
          if(!okArgs){ stats.bad.push("result_record args"); return reply(400, {message: "bad args"}); }
          const ex = results.get(a.p_game);
          if(ex) return reply(200, {recorded: false, ratings: [{from: ex.b0, to: ex.a0}, {from: ex.b1, to: ex.a1}]});
          if(!players.has(a.p_p0) || !players.has(a.p_p1)){ stats.bad.push("result_record unknown player"); return reply(400, {message: "a player is unknown"}); }
          const get = id => { if(!ratings.has(id)) ratings.set(id, {rating: 1200, games: 0, wins: 0, losses: 0, draws: 0}); return ratings.get(id); };
          const r0 = get(a.p_p0), r1 = get(a.p_p1), K = 32, ra = r0.rating, rb = r1.rating;
          const sa = a.p_winner === null ? 0.5 : a.p_winner === 0 ? 1 : 0, ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
          r0.rating = Math.round(ra + K * (sa - ea)); r1.rating = Math.round(rb + K * ((1 - sa) - (1 - ea)));
          for(const [r, w] of [[r0, a.p_winner === 0], [r1, a.p_winner === 1]]){ r.games++; if(a.p_winner === null) r.draws++; else if(w) r.wins++; else r.losses++; }
          results.set(a.p_game, {b0: ra, a0: r0.rating, b1: rb, a1: r1.rating, ...a});
          return reply(200, {recorded: true, ratings: [{from: ra, to: r0.rating}, {from: rb, to: r1.rating}]});
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/identity_resolve"){
          stats.resolves++;
          const {p_provider, p_subject, p_name} = JSON.parse(body);
          if(typeof p_provider !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(p_provider) || typeof p_subject !== "string" || !p_subject || p_subject.length > 256){ stats.bad.push("identity_resolve args"); return reply(400, {message: "bad args"}); }
          const k = p_provider + "\u0000" + p_subject;
          if(!identities.has(k)){ const id = "pl-" + (++seq) + "-" + Math.random().toString(36).slice(2, 8); players.set(id, {id, display_name: p_name || null}); identities.set(k, id); }
          const p = players.get(identities.get(k));
          return reply(200, [{player_id: p.id, display_name: p.display_name}]);
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/player_rename"){     /* 003_names.sql: one holder per fold */
          stats.renames = (stats.renames || 0) + 1;
          const {p_player, p_name, p_fold} = JSON.parse(body);
          if(typeof p_player !== "string" || typeof p_name !== "string" || typeof p_fold !== "string" || !p_fold){ stats.bad.push("player_rename args"); return reply(400, {message: "bad args"}); }
          if(!players.has(p_player)) return reply(200, "unknown");
          for(const p of players.values()) if(p.id !== p_player && p.name_fold === p_fold) return reply(200, "taken");
          Object.assign(players.get(p_player), {display_name: p_name, name_fold: p_fold});
          return reply(200, "ok");
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/recovery_mint"){      /* 004_recovery.sql: one live code per player */
          stats.mints = (stats.mints || 0) + 1;
          const {p_player, p_hash, p_days} = JSON.parse(body);
          if(typeof p_hash !== "string" || !/^[0-9a-f]{64}$/.test(p_hash) || !Number.isInteger(p_days) || p_days < 1 || p_days > 3650 || typeof p_player !== "string"){ stats.bad.push("recovery_mint args"); return reply(400, {message: "bad args"}); }
          if(!players.has(p_player)) return reply(200, "unknown");
          for(const [h, e] of recovery) if(e.player === p_player && !e.used) recovery.delete(h);
          recovery.set(p_hash, {player: p_player, used: false, expires: Date.now() + p_days * 86400000, days: p_days});
          return reply(200, "ok");
        }
        if(req.method === "POST" && url.pathname === "/rest/v1/rpc/recovery_redeem"){   /* 004_recovery.sql: spend, move the identity, drop the throwaway, brake */
          stats.redeems = (stats.redeems || 0) + 1;
          const {p_provider, p_subject, p_hash} = JSON.parse(body);
          if(typeof p_provider !== "string" || typeof p_subject !== "string" || !p_subject || typeof p_hash !== "string"){ stats.bad.push("recovery_redeem args"); return reply(400, {message: "bad args"}); }
          const out = (status, name) => reply(200, [{status, display_name: name || null}]);
          if(!/^[0-9a-f]{64}$/.test(p_hash)) return out("refused");
          const k = p_provider + "\u0000" + p_subject, cur = identities.get(k);
          if(!cur) return out("unknown");
          const tries = (attempts.get(k) || []).filter(t => t > Date.now() - 3600000);
          if(tries.length >= 8) return out("limited");
          const e = recovery.get(p_hash);
          if(!e || e.used || e.expires <= Date.now()){ tries.push(Date.now()); attempts.set(k, tries); return out("refused"); }
          e.used = true;
          if(e.player !== cur){
            identities.set(k, e.player);
            if(![...identities.values()].includes(cur)){
              /* 007_forfeit.sql: a throwaway with a ranked footprint (a rated game, a result naming it, a seat at an unfinished ranked table) is KEPT, orphaned but
                 intact, its name freed and its codes gone; with none it is deleted as in v6.30 */
              const fp = (ratings.get(cur) || {games: 0}).games > 0 || [...results.values()].some(x => x.p_p0 === cur || x.p_p1 === cur)
                || [...rows.values()].some(e => { const r = JSON.parse(e.json); return r.ranked === true && r.over !== true && Array.isArray(r.owners) && r.owners.includes(cur); });
              for(const [h, x] of recovery) if(x.player === cur) recovery.delete(h);
              if(fp){ const pl = players.get(cur); if(pl){ pl.display_name = null; pl.name_fold = null; } } else players.delete(cur);
            }
          }
          attempts.delete(k);
          return out("ok", (players.get(e.player) || {}).display_name);
        }
        if(req.method === "POST" && url.pathname === "/realtime/v1/api/broadcast"){
          const {messages} = JSON.parse(body);
          if(!Array.isArray(messages) || !messages.length) return reply(422, {errors: {messages: ["can't be blank"]}});
          for(const m of messages){
            if(!m.topic || !m.event || m.payload === undefined) return reply(422, {errors: {messages: [{event: ["can't be blank"]}]}});
            if(Buffer.byteLength(JSON.stringify(m.payload)) > 250000) return reply(422, {errors: {messages: [{payload: ["Payload size exceeds tenant limit"]}]}});
          }
          for(const m of messages){ stats.casts++; broadcasts.push({topic: m.topic, event: m.event, private: m.private, payload: m.payload}); for(const f of subs.slice()) f(m.topic, m.event, m.payload); }
          res.writeHead(202); return res.end();
        }
        stats.bad.push(req.method + " " + url.pathname); reply(404, {message: "not found"});
      } catch(e){ stats.bad.push("exception " + e.message); reply(500, {message: String(e.message)}); }
    });
  };
  const server = http.createServer(handler);
  return {server, rows, broadcasts, stats, key: KEY, users, players, identities, recovery, attempts, ratings, results, authDown: down => { authDown = down !== false; },
    issueUser: (id, anon) => { const t = "stub.jwt." + (++seq) + "." + Math.random().toString(36).slice(2); users.set(t, {id, anon: anon !== false}); return t; }, subscribe: f => { subs.push(f); return () => { const i = subs.indexOf(f); if(i >= 0) subs.splice(i, 1); }; },
    row: id => rows.has(id) ? JSON.parse(rows.get(id).json) : null, version: id => rows.has(id) ? rows.get(id).version : 0,
    listen: port => new Promise(res => server.listen(port || 0, "127.0.0.1", () => res({port: server.address().port}))),
    close: () => new Promise(res => { server.closeAllConnections && server.closeAllConnections(); server.close(() => res()); })};
}
module.exports = {makeStub};
if(require.main === module) makeStub().listen(+process.env.PORT || 0).then(r => console.log("stub on 127.0.0.1:" + r.port));
