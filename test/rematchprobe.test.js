/* test/rematchprobe.test.js — THE LIVE REMATCH PROBE, RUN OFFLINE (v6.87).
   tools/rematchprobe.js plays two seats through a whole rematch (ask, leave = take it back, ask again, one new code, both sit down, every table closed).
   livecheck.js runs it on the deployed function; here it runs against server/referee.js over the fake wire, so the probe itself is held by the suite.
   Sabotage: a referee whose cancel does nothing, and a referee that opens no new table, must each fail a row. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const F = require("./helpers/serverfakes.js");
const {makeWorld} = require("./helpers/servertransport.js");
const P = require("../tools/rematchprobe.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "server", "referee.js"), "utf8");
function loadServer(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "self", src)(m, m.exports, p => require(path.join(ROOT, "server", p)), undefined);
  return m.exports;
}
async function run(server, salt){
  const world = makeWorld({seedKey: "rmprobe-" + salt, server}), idp = F.memIdentity();
  world.deps.identify = t => idp.identify(t); world.deps.rename = (p, n, f) => idp.rename(p, n, f);
  const toks = ["P-rmprobe-a", "P-rmprobe-b"].map(id => idp.issue(id));
  const rows = [];
  const row = (ok, what, detail) => { rows.push({ok, what, detail}); return ok; };
  const post = env => world.transport("closer").post(env);
  await Promise.race([P.rematchProbe(world, toks, row, {post, beat: 0}), new Promise((_, rej) => setTimeout(() => rej(new Error("the probe hung")), 40000))]).catch(e => row(false, "probe threw", e.message));
  return rows;
}
const failed = rows => rows.filter(r => !r.ok).map(r => r.what + " " + (r.detail || ""));
test("the rematch probe passes against the referee, in the rows it promises", async () => {
  const rows = await run(loadServer(), "ok");
  assert.deepEqual(failed(rows), []);
  assert.ok(rows.length >= 8, "the probe reported " + rows.length + " rows");
});
test("sabotage: a referee that ignores a cancel fails the take-back row", async () => {
  const rows = await run(loadServer([["    if(cur.at[seat] == null) return {ok: true, state: \"none\"};", "    return {ok: true, state: \"cancelled\"};"], ["    row.rematch = {at, table: null};\n    return then(save(id, row, got.version, deps, tell(at.map(x => x != null), null), []), a => a.ok ? {ok: true, state: \"cancelled\"} : a);", "    return {ok: true, state: \"cancelled\"};"]]), "sab1");
  assert.ok(failed(rows).some(f => /taken back/.test(f)), JSON.stringify(failed(rows)));
});
