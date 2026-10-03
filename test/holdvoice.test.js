/* "You holds 0" — A SEAT'S VERB AGREES WITH ITS NAME (v4.93).
   Nine of judge's payment and cost lines built `sd.name + " holds "` by
   hand. Seat 0 is literally named "You" on the trainer (v2.83), and
   `game.sv` has existed since v4.15 for exactly this, so the lines went
   through it. LATENT at the table today — every table seat is named after
   a hero — which is why the drill is a source census plus a driven check
   of the helper the census sends every site to, rather than a game. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const GM = require("../engine/game.js");

const SRC = fs.readFileSync(path.join(__dirname, "../engine/judge.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("judge builds no seat's \"holds\" by hand", () => {
  assert.equal((SRC.match(/\.name\s*\+\s*"\s*holds\b/g) || []).length, 0,
    "a name followed by a hand-written \"holds\" reads \"You holds\" for seat 0");
  /* the scan is alive: the shape it forbids is found in a planted control */
  const ctl = "x = sd" + ".name + \" holds \" + sd.res;";
  assert.equal((ctl.match(/\.name\s*\+\s*"\s*holds\b/g) || []).length, 1);
});

test("every cost line asks game.sv instead, and sv agrees with both names", () => {
  assert.ok((SRC.match(/GM\.sv\(sd, "hold"\)/g) || []).length >= 9,
    "the nine payment and cost lines name the seat through GM.sv");
  assert.equal(GM.sv({name: "You"}, "hold"), "You hold");
  assert.equal(GM.sv({name: "Kayo, Armed and Dangerous"}, "hold"), "Kayo, Armed and Dangerous holds");
});
