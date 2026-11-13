#!/usr/bin/env node
/* ============================================================
   tools/supabase-stub.js — LOCAL STAND-INS FOR THE TWO SUPABASE SERVICES THE FUNCTION CALLS (SERVER S3)

   Exactly the REST calls server/supabase/entry.template.ts makes, nothing more, over plain HTTP on 127.0.0.1:

     GET  /rest/v1/tables?id=eq.<id>&select=version,row     PostgREST: [] or [{version, row}]
     POST /rest/v1/rpc/table_put {p_id, p_row, p_expected}  server/supabase/001_tables.sql's table_put(): the new version, or 0
     POST /realtime/v1/api/broadcast {messages:[{topic,event,payload,private}]}   202, 422 on a payload over the limit
                                                           (the real endpoint's observed limit: 250,000 bytes)

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
  const subs = [];
  const handler = (req, res) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url, "http://stub");
      const reply = (code, obj) => { const t = obj === undefined ? "" : JSON.stringify(obj); res.writeHead(code, {"content-type": "application/json"}); res.end(t); };
      if(req.headers.apikey !== KEY){ stats.bad.push("no apikey " + url.pathname); return reply(401, {message: "No API key found in request"}); }
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
          if(p_expected === 0){ if(!e){ rows.set(p_id, {version: 1, json: JSON.stringify(p_row)}); v = 1; } }
          else if(e && e.version === p_expected){ e.version++; e.json = JSON.stringify(p_row); v = e.version; }
          stats.puts++; if(!v) stats.conflicts++; stats.largestPut = Math.max(stats.largestPut, Buffer.byteLength(body));
          return reply(200, v);
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
  return {server, rows, broadcasts, stats, key: KEY, subscribe: f => { subs.push(f); return () => { const i = subs.indexOf(f); if(i >= 0) subs.splice(i, 1); }; },
    row: id => rows.has(id) ? JSON.parse(rows.get(id).json) : null, version: id => rows.has(id) ? rows.get(id).version : 0,
    listen: port => new Promise(res => server.listen(port || 0, "127.0.0.1", () => res({port: server.address().port}))),
    close: () => new Promise(res => { server.closeAllConnections && server.closeAllConnections(); server.close(() => res()); })};
}
module.exports = {makeStub};
if(require.main === module) makeStub().listen(+process.env.PORT || 0).then(r => console.log("stub on 127.0.0.1:" + r.port));
