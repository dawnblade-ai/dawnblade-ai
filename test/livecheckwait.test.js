/* test/livecheckwait.test.js — THE LIVE CHECK'S CLEAN-UP QUERY CANNOT WIDEN (011_seek_wait.sql).
   tools/livecheck.js plays a real two-seat seek on the live project; that match (~0 s) lands in seek_wait_log and would drag the "players usually
   find a match in about N seconds" line toward 5 s every release, so livecheck deletes its own row afterwards. The log holds no player to match on,
   so the ONLY thing keeping that delete from eating real players' waits is its shape: FRIENDLY only, 2 s or less, since the probe began, ONE
   statement, rows it deleted counted back. Each pin has a sabotage that fails it. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "tools", "livecheck.js"), "utf8");
const T0 = "2026-11-24T20:00:00.000Z";
function load(edits){
  let src = SRC;
  for(const [a, b] of edits || []){ assert.equal(src.split(a).length - 1, 1, "sabotage anchor is not unique: " + a); src = src.replace(a, () => b); }
  const m = {exports: {}};
  new Function("module", "exports", "require", "process", src.replace(/^#!.*\n/, ""))(m, m.exports, p => /^\./.test(p) ? require(path.join(__dirname, "..", "tools", p)) : require(p), Object.assign(Object.create(process), {argv: ["node", "x"]}));
  return m.exports;
}
const norm = q => q.replace(/\s+/g, " ").trim();
function failures(L){
  const bad = [];
  let q; try { q = norm(L.probeWaitQuery(T0)); } catch(e){ return ["the builder threw: " + e.message]; }
  if(!/^delete from public\.seek_wait_log where /.test(q)) bad.push("not a delete from the wait log: " + q);
  if(!/\branked = false\b/.test(q)) bad.push("does not pin friendly (ranked = false)");
  if(!/\bwaited_s <= 2\b/.test(q)) bad.push("does not pin waited_s <= 2");
  if(!new RegExp("\\bat >= '" + T0.replace(/\./g, "\\.") + "'::timestamptz").test(q)) bad.push("does not pin 'since the probe began'");
  if(/\bor\b/i.test(q)) bad.push("an OR can widen it");
  if(q.indexOf(";") >= 0) bad.push("more than one statement");
  if(!/returning waited_s$/.test(q)) bad.push("does not count what it deleted");
  if((q.match(/\band\b/gi) || []).length !== 2) bad.push("the predicate is not exactly three conditions: " + q);
  return bad;
}
test("the clean-up query is friendly-only, 2 s or less, since the probe began", () => {
  assert.deepEqual(failures(load()), []);
});
test("sabotage: every way of widening it fails a pin", () => {
  const A = "where ranked = false and waited_s <= 2 and at >= '";
  for(const [what, edit] of [
    ["drops the kind", [A, "where waited_s <= 2 and at >= '"]],
    ["takes ranked", [A, "where ranked = true and waited_s <= 2 and at >= '"]],
    ["lets 30 s through", [A, "where ranked = false and waited_s <= 30 and at >= '"]],
    ["drops the wait bound", [A, "where ranked = false and at >= '"]],
    ["drops 'since the probe began'", ["and waited_s <= 2 and at >= '\" + t0 + \"'::timestamptz", "and waited_s <= 2 and true"]],
    ["OR-widens", ["waited_s <= 2 and at", "waited_s <= 2 or at"]],
    ["stops counting", [" returning waited_s\"", "\""]],
  ]) assert.ok(failures(load([edit])).length > 0, "sabotage (" + what + ") must fail a pin");
  assert.throws(() => load().probeWaitQuery("x'; drop table y; --"), /ISO timestamp/, "a non-timestamp must not reach the statement");
});
