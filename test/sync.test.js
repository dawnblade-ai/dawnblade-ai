/* Drift guard: until the trainer imports engine/ directly, the same
   functions live in both index.html and engine/. This test keeps every
   shared body textually identical (whitespace-insensitive). If it fails,
   one side was edited without the other — mirror the change. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ROOT, html, extractDef, squash } = require("./helpers/extract");

const SHARED = {
  "engine/parser.js": [
    "norm","isAttack","isArrow","isWeapon","hasGA","arcaneDmg","NWORD","num","clean",
    "classifyClause","fxParse","parseHeroPower","runeRed","effCost","weaponCost",
    "hasKw","isAR","isInstantT"
  ],
  "engine/game.js": ["shuffle","parseDeck","gearDef","gearBlockApply","slotOf"],
  "engine/cards.js": ["cdnImg","toNum","resolveEntry","resolveHero"],
  "engine/advisor.js": ["advPitchPotential","advCardOut","advValue","advBestPitch","advise"]
};

const htmlSrc = html();

for(const [file, names] of Object.entries(SHARED)){
  const engSrc = fs.readFileSync(path.join(ROOT, file), "utf8");
  for(const name of names){
    test(`${file}: ${name} matches index.html`, () => {
      assert.equal(squash(extractDef(engSrc, name)), squash(extractDef(htmlSrc, name)),
        `${name} has drifted between ${file} and index.html`);
    });
  }
}
