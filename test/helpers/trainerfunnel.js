/* THE TRAINER'S `setG`, AS AUTHORED, RUN AGAINST THE REAL ENGINE.

   `Battle` is a closure inside a babel block, so no drill can call it. Its
   `setG` is the trainer's `reduce` (every state it commits passes through it),
   so a drill that wants to know what the TRAINER does cuts that one function
   out of index.html and evaluates it with the real judge and invariants,
   replacing the one thing it needs from React (`setGRaw`) with a variable.
   A cut that does not find the funnel fails by name; a funnel that stops
   calling a shared body shows as that body no longer running.

   `withPriority` is the identity here: the shadow it derives is the priority
   machine's, which these drills do not ask. */
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const J = require("../../engine/judge.js");
const INV = require("../../engine/invariants.js");

const HTML = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");

/* from its header to the first `  });` at the component's indent */
function cutSetG(src){
  const head = "const setG = updater => setGRaw(s => {";
  const at = src.indexOf(head);
  assert.ok(at > 0, "the trainer's setG funnel moved - re-anchor this drill");
  const end = src.indexOf("\n  });", at);
  assert.ok(end > at, "the end of the trainer's setG moved");
  return src.slice(at, end + "\n  });".length);
}
function trainerFunnel(g0, src){
  const cell = {g: g0};
  const raw = f => { cell.g = f(cell.g); };
  const make = new Function("setGRaw", "withPriority", "DawnJudge", "DawnInvariants", "judgeRef", "setJudgeN",
    cutSetG(src || HTML) + "\nreturn setG;");
  const setG = make(raw, n => n, J, INV, {current: []}, () => {});
  return {setG, get g(){ return cell.g; }};
}
module.exports = {HTML, cutSetG, trainerFunnel};
