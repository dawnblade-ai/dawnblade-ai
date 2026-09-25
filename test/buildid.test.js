/* ============================================================
   "THE SAME BUILD" MEANS THE SAME RULES, NOT ONLY THE SAME CARDS (v4.69)

   Both table handshakes — the lobby's HELLO and net.js's — compare a
   `build` string, and both callers handed them `DATA_VER` alone. net.js's
   own refusal message said "check APP_VER / DATA_VER on both clients", so
   the claim and the comparison disagreed: two phones one release apart
   agreed on every card and were seated together.

   MEASURED, NOT ARGUED. Sixteen v4.68 self-play logs were replayed on the
   v4.67 reducer from the same opening state: 2 of 16 diverge, both at
   Fai's one-card pick, which v4.68 confirms on the spot and v4.67 opens as
   a sheet. Same DATA_VER, same WIRE_V, and the pair would have desynced
   with nothing either handshake could have said. Every release changes a
   rule, so the identity carries the release.

   WHAT THIS HOLDS:
     - `buildId` moves with EITHER half and is stable for both
     - the lobby faults on a release skew with the card data identical
     - net.js refuses the same pair at its own handshake
     - the trainer hands BOTH sites one value, built from both halves —
       a belt that checks something different from its braces is how the
       claim and the comparison came apart in the first place
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const L = require("../engine/lobby.js");
const N = require("../engine/net.js");
const A = require("../engine/actions.js");

test("buildId moves with EITHER half, and is stable for both", () => {
  const b = L.buildId("4.69", "sage-v13");
  assert.equal(L.buildId("4.69", "sage-v13"), b, "the same build spelled twice must agree");
  assert.notEqual(L.buildId("4.68", "sage-v13"), b, "a release skew with identical card data");
  assert.notEqual(L.buildId("4.69", "sage-v12"), b, "card data skew with an identical release");
  assert.match(b, /4\.69/);
  assert.match(b, /sage-v13/, "the fault names both halves, so a reader can see which one differs");
});

test("the lobby FAULTS on a release skew when the card data is identical", () => {
  let s = L.newLobby({code: "7"});
  s = L.reduce(s, L.hello(0, L.buildId("4.69", "sage-v13"))).state;
  s = L.reduce(s, L.hello(1, L.buildId("4.68", "sage-v13"))).state;
  assert.equal(L.stepOf(s), "fault", "one release apart and seated together");
  assert.match(s.fault, /4\.69/);
  assert.match(s.fault, /4\.68/);
  assert.match(s.fault, /[Rr]eload/, "the fault says what to DO, not only what went wrong");
  /* POSITIVE CONTROL — a lobby that faults on everything passes the half
     above perfectly (v3.45: both halves, or it proves nothing). */
  let t = L.newLobby({code: "7"});
  t = L.reduce(t, L.hello(0, L.buildId("4.69", "sage-v13"))).state;
  t = L.reduce(t, L.hello(1, L.buildId("4.69", "sage-v13"))).state;
  assert.equal(L.stepOf(t), "hero", "the same build must proceed to the hero step");
});

test("net.js refuses the same pair at its own handshake", () => {
  const drive = (hostBuild, guestBuild) => {
    const link = N.loopback();
    const mk = (end, seat, host, build) => {
      const s = N.createSession({seat, host, reduce: A.reduce, legal: A.legal, build,
        state: host ? A.newMatch({seed: "b"}) : null, send: m => end.send(m)});
      end.session = s; return s;
    };
    mk(link.a, 0, true, hostBuild);
    const guest = mk(link.b, 1, false, guestBuild);
    guest.join();
    return guest.status();
  };
  assert.equal(drive(L.buildId("4.69", "sage-v13"), L.buildId("4.68", "sage-v13")), "refused");
  assert.notEqual(drive(L.buildId("4.69", "sage-v13"), L.buildId("4.69", "sage-v13")), "refused",
    "the same build was refused — a handshake that refuses everything is not a check");
});

/* ---- THE TRAINER HANDS BOTH SITES ONE VALUE ----------------------------- */

const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HTML = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));

test("TABLE_BUILD is built from BOTH halves, once", () => {
  const defs = HTML.match(/const TABLE_BUILD\s*=\s*[^;]+;/g) || [];
  assert.equal(defs.length, 1, "TABLE_BUILD must be defined exactly once");
  assert.match(defs[0], /DawnLobby\.buildId\(\s*window\.APP_VER\s*,\s*window\.DATA_VER\s*\)/,
    "the identity is not the lobby's own spelling of the release AND the card data");
});

test("the lobby HELLO and the net session are both handed TABLE_BUILD", () => {
  const hellos = HTML.match(/DawnLobby\.hello\([^)]*\)/g) || [];
  assert.ok(hellos.length >= 1, "fixture: no lobby hello found");
  for(const h of hellos) assert.match(h, /TABLE_BUILD/, "a hello handed something else: " + h);
  const builds = HTML.match(/\bbuild:\s*[A-Za-z_.]+/g) || [];
  assert.ok(builds.length >= 1, "fixture: no session build found");
  for(const b of builds) assert.match(b, /TABLE_BUILD/,
    "a session build handed something else — the belt checks a different thing from the braces: " + b);
});

test("the scan is alive: a site handed DATA_VER alone is reported", () => {
  const planted = "say(DawnLobby.hello(mySeat, DATA_VER));";
  const hits = (planted.match(/DawnLobby\.hello\([^)]*\)/g) || []);
  assert.equal(hits.length, 1);
  assert.doesNotMatch(hits[0], /TABLE_BUILD/);
  const b = ("build:  " + "DATA_VER,").match(/\bbuild:\s*[A-Za-z_.]+/g);
  assert.ok(b && !/TABLE_BUILD/.test(b[0]));
});
