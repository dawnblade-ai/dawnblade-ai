/* ============================================================
   THE TAP SWEEP — every screen a player meets, judged by tools/tapjudge.js at one phone size.

   `sweepScreens(page, row, size)` walks the real page (tools/page.js's open()) through the roster, the
   sheets (How to play, the hands sheet), the Judge and Trophies tabs, Find an opponent, the hero sheet, the
   coin and seat pick, the loadout and its three jump screens, a trainer game (the board, a peeked card,
   some plays, the JUDGE!! sheet, the chain screen), and a table game against an AI hero (the loadout, the
   board, the prompts that come up), and asks each screen: is every control's hit area 44 CSS px, is any
   centre tap stolen, is anything clipped or overlapped (tapjudge.js says what each word means). One
   `row(ok, name, detail)` per screen, named with the size. page.js calls it at 393x852 and 320x568.
   ============================================================ */
"use strict";
const { judgeScreen } = require("./tapjudge.js");

async function sweepScreens(page, row, { w, h }) {
  const tag = `tap floor ${w}x${h}`;
  const m = async (where) => {
    await page.waitForTimeout(350);
    const r = await judgeScreen(page);
    const bad = ["small", "stolen", "clipped", "overlap"].flatMap(k => r[k].map(f => k + ": " + f.m));
    row(r.n > 0 && !bad.length, `${tag}: ${where}`, `${r.n} controls` + (bad.length ? "  " + bad.slice(0, 4).join(" | ") + (bad.length > 4 ? ` (+${bad.length - 4} more)` : "") : ""));
    return r;
  };
  const has = sel => page.locator(sel).first().isVisible().catch(() => false);
  const click = async (loc, what) => { try { await loc.click({ timeout: 4000 }); return true; } catch (e) { row(false, `${tag}: ${what}`, "not clickable: " + String(e.message).split("\n")[0]); return false; } };
  const btn = re => page.getByRole("button", { name: re });
  const home = async () => {
    for (let k = 0; k < 3 && (await has(".board")); k++) { await page.locator(".screennav button", { hasText: "leave" }).click().catch(() => {}); await page.waitForTimeout(400); }
    await page.locator("nav.tabs .tab", { hasText: "Heroes" }).click().catch(() => {}); await page.waitForTimeout(250);
  };
  const toCoin = async () => {
    await home();
    if (!(await click(page.locator(".hgrid .hcard").nth(0), "pick a hero"))) return false;
    await page.waitForSelector(".sheet");
    return true;
  };
  const toLoadout = async () => {
    if (!(await click(btn(/^Battle$/), "battle"))) return false;
    await page.waitForSelector(".rps"); await page.waitForSelector(".rseatpick, .actbar", { timeout: 10000 });
    if (await has(".rseatpick")) await click(page.locator(".rseatpick .go"), "I go first");
    await page.waitForSelector(".actbar", { timeout: 8000 });
    return true;
  };

  await m("home roster");
  if (await click(page.locator(".howbtn"), "how to play")) { await page.waitForSelector(".howsheet"); await m("how to play sheet"); await click(page.locator(".howsheet .bigbtn"), "how to play: got it"); }
  for (const [t, l] of [["Judge", "judge tab"], ["Trophies", "trophies tab"]]) if (await click(page.locator("nav.tabs .tab", { hasText: t }), l)) await m(l);
  await click(page.locator("nav.tabs .tab", { hasText: "Heroes" }), "back to heroes");
  if (await click(btn(/^Find an opponent/), "find an opponent")) {
    await page.waitForSelector(".tblwrap"); await m("find an opponent");
    if (await click(page.locator('[data-testid="hands-open"]'), "hands sheet")) { await m("the hands sheet"); await click(btn(/^Got it/), "hands sheet: got it"); }
    await click(page.locator(".tblwrap button", { hasText: /back|leave|cancel/i }).first(), "leave the find screen");
  }
  if (await toCoin()) {
    await m("hero sheet");
    if (await toLoadout()) {
      await m("loadout");
      for (const n of ["Deck", "Foe", "Scout"]) {
        const b = page.locator(".lo .screennav button", { hasText: new RegExp(n, "i") });
        if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); await m("loadout " + n); }
      }
      if (await click(page.locator('.lo .actbar [data-start="trainer"]'), "fight the dummy")) {
        await page.waitForSelector(".board"); await m("trainer board");
        let peeked = false;
        for (let i = 0; i < 12; i++) {
          const c = page.locator(".board .hand .hc, .board .phand .hc").first();
          if (await c.count()) { await c.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(250); if (!peeked && await has(".peekwrap")) { peeked = true; await m("trainer: a peeked card"); } await c.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); }
          const e = page.locator(".board .actbar button", { hasText: /take it|end turn|pass|skip|done|defend|confirm|fight/i }).first();
          if (await e.count()) await e.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(300);
          if (await has(".psheet")) await m("trainer: a prompt");
          if (i === 5) await m("trainer: mid-game");
        }
        await page.locator(".screennav button", { hasText: "Chain" }).click().catch(() => {}); await page.waitForTimeout(300);
        await m("trainer: the chain screen");
        if (await click(page.locator(".judgebtn").first(), "JUDGE!!")) { await page.waitForTimeout(300); await m("the JUDGE!! sheet"); await page.locator(".bugsheet button", { hasText: "Close" }).click().catch(() => {}); }
      }
    }
    /* the table against an AI hero */
    await home();
    if (await toCoin() && await toLoadout()) {
      await page.locator(".aifoe button").nth(2).click(); await page.waitForTimeout(300); await m("loadout against an AI hero");
      if (await click(page.locator('.lo .actbar [data-start="table"]'), "fight at the table")) {
        await page.waitForSelector(".board", { timeout: 15000 }); await m("table board");
        let prompts = 0;
        for (let i = 0; i < 60 && prompts < 3; i++) {
          await page.evaluate(() => { const T = window.__dawnTable, g = T.session.state(); const pq = (g.promptQ || [])[0];
            const mine = (pq && (pq.side || 0) === 0) || (!pq && g.priority === 0) || g.sides[0].pending; let a;
            try { a = DawnSparring.act(g, 0); } catch (e) { return; } if (!a) return; if (!mine && DawnJudge.legal(g, a, 0) !== null) return; T.session.submit(a); });
          await page.waitForTimeout(150);
          if (await has(".psheet")) { prompts++; await m("table: a prompt"); }
          if (i === 30) await m("table: mid-game");
          if (await has(".reveal")) { await m("table: the end screen"); break; }
        }
      }
    }
  }
  await home();
}

module.exports = { sweepScreens };

/* node tools/tapsweep.js [393x852 320x568 ...]: the sweep alone (page.js runs it too, among its rows; deps and NODE_PATH as there) */
if (require.main === module) {
  const { open } = require("./page.js");
  (async () => {
    const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ["393x852", "320x568"]).map(x => x.split("x").map(Number));
    let bad = 0, n = 0;
    const row = (ok, name, detail) => { n++; if (!ok) bad++; console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  " + detail : "")); };
    for (const [w, h] of sizes) {
      const kit = await open({ w, h });
      try { await sweepScreens(kit.page, row, { w, h }); } catch (e) { row(false, `tap floor ${w}x${h}: the sweep ran to the end`, String(e && e.message || e).split("\n")[0]); }
      kit.errors.forEach(e => row(false, `tap floor ${w}x${h}: page error`, e));
      await kit.close();
    }
    console.log(`\n${bad ? "FAIL" : "PASS"}  ${n - bad}/${n} tap-floor screens clean`);
    process.exit(bad ? 1 : 0);
  })().catch(e => { console.log("FAIL  " + (e && e.stack || e)); process.exit(1); });
}
