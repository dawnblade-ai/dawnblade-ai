#!/usr/bin/env node
/* ============================================================
   tools/liveranked.js — ONE REAL RANKED GAME ON THE LIVE PROJECT, END TO END (SERVER S5.3). A ONE-OFF, run by a person on purpose.

     node tools/liveranked.js --go [--url <page>]

   NOT part of tools/livecheck.js (which never plays a ranked game on live), NOT run by `npm test`, and NOT to be run casually: it WRITES to the live project.
   WHAT IT LEAVES BEHIND, for good (there is no cleanup: a result cannot be erased, by design):
     * TWO TEST PLAYERS (two anonymous sign-ins, two players), named "Lc" + the clock in base 36 + "H" (the host) and + "G" (the guest) — one name each, taken
       for good (names are unique), each with ONE ranked game: the host 1216 (1 win), the guest 1184 (1 loss);
     * ONE RESULT ROW (how: concession, hero keys, both names) and ONE `ranked` table row (over, with its result; it ages out like any table);
     * both players are UNDER THE LADDER'S FLOOR (3 games), so neither is listed; the game DOES show in the ladder's recent results ("Latest games") until ten
       newer ones push it out.
   It changes no one else's rating and creates nothing else.

   WHAT IT DOES (every step prints a PASS/FAIL row; exit 1 on any FAIL, 2 when --go is missing):
     1. two fresh phones (393x852, their own contexts, so their own sign-ins) open the live page;
     2. each signs in (by the page itself) and takes its one-run name on the name sheet;
     3. the host switches the table to Ranked and opens one; the guest types the code and sits down; both lobbies say Ranked;
     4. both walk the lobby exactly as livecheck does (hero, lock in, rock-paper-scissors, who goes first, sideboard) to the board;
     5. the GUEST CONCEDES on the board (through the page's own session hook, the very action the Concede button fires — that button only exists in the defend step);
     6. through `me`: the winner reads 1216 with 1 win and 1 game, the loser 1184 with 1 loss and 1 game; both end screens show the rating change in words;
     7. the public ladder does NOT list either player (under the floor), each one's own line says "listed: false" and two games to go;
     8. the game is in the recent results: both names, the host the winner, "concession", a time within ten minutes;
     9. the page's own Ladder screen (host phone) shows the game under "Latest games" as "conceded", lists neither player, and the host's line says two more games.
   STATUS: WRITTEN AND PROVED OFFLINE ONLY (tools/serverpage.js drives `run` against the fake referee + fake ratings and ladder backends; two sabotages are seen),
   UNRUN ON LIVE: it needs 006, 007 and 008 run on the project and the v6.34 function deployed first.
   NEEDS: `playwright` (NODE_PATH; PW_CHROMIUM optional), as tools/livecheck.js, whose helpers it shares (one copy). Behind an egress proxy it re-runs itself with
   NODE_USE_ENV_PROXY=1 for Node's own fetches. Zero repo dependencies. */
"use strict";
const { spawnSync } = require("child_process");
if(require.main === module && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY){
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" } });
  process.exit(r.status == null ? 1 : r.status);
}
const LC = require("./livecheck.js");
const { wait } = LC;

const runName = suffix => "Lc" + Date.now().toString(36).slice(-8) + suffix;       /* "Lc" like livecheck's, one per run, one per phone */

/* run(env, row) -> void. env: {A, B (phones: {name, page, errors}), post(body) -> Promise<answer> (plain function requests), token(phone) -> Promise<string|null>}.
   `row(ok, name, detail)` is a makeRow() printer; the caller reads its failure count. Every wait is bounded; a thrown step is a FAIL row and the run stops. */
async function run(env, row){
  const { A, B } = env;
  const t0 = Date.now();
  const nameA = runName("H"), nameB = runName("G");
  const click = (ph, re) => ph.page.getByRole("button", { name: re }).click({ timeout: 60000 });
  const body = ph => ph.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const step = async (what, f) => { try { return await f(); } catch(e){ row(false, what, String(e && e.message || e).split("\n")[0].slice(0, 200)); throw Object.assign(new Error("stopped at: " + what), { stopped: true }); } };
  try {
    /* 1-2: sign in and name */
    await step("each phone takes its one-run name", async () => {
      for(const [ph, nm] of [[A, nameA], [B, nameB]]){
        await click(ph, /^Find an opponent/); await ph.page.waitForSelector(".tblwrap");
        await click(ph, /^Join a server table/);
        await click(ph, /^Choose a name/); await ph.page.waitForSelector(".tblname", { timeout: 60000 });
        await ph.page.fill(".tblname", nm); await click(ph, /^Save name/);
        await ph.page.waitForFunction(n => document.body.innerText.indexOf(n) >= 0 && /Playing as/i.test(document.body.innerText), nm, { timeout: 90000 });
      }
      const [ta, tb] = [await env.token(A), await env.token(B)];
      row(!!ta && !!tb && ta !== tb, "both phones signed in as two different players and named (" + nameA + ", " + nameB + ")");
      if(!ta || !tb) throw new Error("no sign-in");
    });
    const tokA = await env.token(A), tokB = await env.token(B);
    const me0 = await env.post({ op: "me", identity: { token: tokA } });
    row(me0.ok === true && me0.name === nameA && me0.rating === 1200 && me0.games === 0, "the host reads as a fresh player: its name, 1200, no games", JSON.stringify({ name: me0.name, rating: me0.rating, games: me0.games }));
    if(me0.ok !== true || me0.rating !== 1200 || me0.games !== 0) throw Object.assign(new Error("not a fresh player"), { stopped: true });

    /* 3: a ranked table, the guest sits down */
    const code = await step("the host opens a ranked table", async () => {
      await A.page.locator('[data-testid="ranked-switch"]').click({ timeout: 60000 });
      const on = await A.page.locator('[data-testid="ranked-switch"]').getAttribute("aria-checked");
      await click(A, /^Open a ranked table/); await A.page.waitForSelector(".tblcode", { timeout: 90000 });
      const c = (await A.page.evaluate(() => document.querySelector(".tblcode").innerText)).trim();
      row(on === "true" && /^[A-Z0-9]{6}$/.test(c) && /ranked/i.test(await body(A)), "the host switched the table to Ranked and opened one", "table " + c);
      return c;
    });
    await step("the guest sits down at the ranked table", async () => {
      await click(B, /^Enter a table code/); await B.page.waitForSelector("input.tblin");
      await B.page.locator("input.tblin").pressSequentially(code);
      await click(B, /^Sit down/);
      const both = ph => ph.page.waitForFunction(() => /Choose your fighter/i.test(document.body.innerText), null, { timeout: 90000 });
      await Promise.all([both(A), both(B)]);
      const chips = await Promise.all([A, B].map(ph => ph.page.waitForSelector('[data-testid="ranked-chip"]', { timeout: 30000 }).then(() => true, () => false)));
      row(chips[0] && chips[1], "both lobbies say Ranked", "host " + chips[0] + ", guest " + chips[1]);
    });

    /* 4: the lobby, then the board */
    const tb = await LC.walkLobby(A, B, 150000);
    row(tb != null, "both phones walk the lobby to the board", tb != null ? tb + " ms" : "stuck; host " + JSON.stringify(A.done) + " guest " + JSON.stringify(B.done));
    if(tb == null) throw Object.assign(new Error("lobby"), { stopped: true });
    for(const ph of [A, B]) await ph.page.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.state() != null, null, { timeout: 90000 });

    /* 5: the guest concedes */
    const conceded = await step("the guest concedes on the board", async () => {
      for(let i = 0; i < 60; i++){
        const r = await B.page.evaluate(() => { const s = window.__dawnTable.session; if(s.status() !== "ready") return "waiting"; const why = s.submit({ t: "concede" }); return why ? "refused: " + why : "sent"; });
        if(r === "sent") return true;
        await wait(500);
      }
      return false;
    });
    row(conceded === true, "the guest's concession was accepted by the table");

    /* 6: both ratings, both end screens */
    const changed = async ph => { const ok = await ph.page.waitForFunction(() => { const e = document.querySelector('[data-testid="rank-change"]'); return !!e && /→/.test(e.innerText); }, null, { timeout: 90000 }).then(() => true, () => false);
      return ok ? (await ph.page.evaluate(() => document.querySelector('[data-testid="rank-change"]').innerText)).replace(/\s+/g, " ") : (await body(ph)).slice(0, 160); };
    const [txtA, txtB] = await Promise.all([changed(A), changed(B)]);
    row(/Your rating rose from 1200 → 1216 \(\+16\)/.test(txtA), "the winner's end screen shows the rating change in words", txtA.slice(0, 110));
    row(/Your rating moved from 1200 → 1184 \(.16\)/.test(txtB), "the loser's end screen shows the rating change in words", txtB.slice(0, 110));
    const [meA, meB] = [await env.post({ op: "me", identity: { token: tokA } }), await env.post({ op: "me", identity: { token: tokB } })];
    row(meA.ok && meA.rating === 1216 && meA.games === 1 && meA.wins === 1 && meA.losses === 0 && meA.draws === 0, "`me`: the winner reads 1216 with 1 win and 1 game", JSON.stringify({ rating: meA.rating, games: meA.games, wins: meA.wins, losses: meA.losses }));
    row(meB.ok && meB.rating === 1184 && meB.games === 1 && meB.wins === 0 && meB.losses === 1 && meB.draws === 0, "`me`: the loser reads 1184 with 1 loss and 1 game", JSON.stringify({ rating: meB.rating, games: meB.games, wins: meB.wins, losses: meB.losses }));

    /* 7-8: the ladder does not list them (under the floor); the game is in the recent results */
    const pub = await env.post({ op: "ladder" }), la = await env.post({ op: "ladder", identity: { token: tokA } }), lb = await env.post({ op: "ladder", identity: { token: tokB } });
    row(pub.ok === true && Array.isArray(pub.ladder) && !pub.ladder.some(x => x.name === nameA || x.name === nameB), "the ladder lists neither player (one game each, under the floor of three)", pub.ok ? pub.ladder.length + " listed" : JSON.stringify(pub).slice(0, 100));
    row(la.ok && la.you && la.you.listed === false && la.you.rank === null && la.you.games === 1 && la.you.toGo === 2 && la.you.rating === 1216 && lb.ok && lb.you && lb.you.listed === false && lb.you.games === 1 && lb.you.toGo === 2 && lb.you.rating === 1184,
      "each player's own line: not listed, one game, two to go, the new rating", JSON.stringify([la.you && la.you.toGo, lb.you && lb.you.toGo]));
    const g = (pub.recent || []).find(x => x.names.includes(nameA) && x.names.includes(nameB));
    row(!!g && g.how === "concession" && g.names[g.winner] === nameA && g.names.indexOf(nameB) === 1 - g.winner && Math.abs(g.at - Date.now()) < 10 * 60000 && g.heroes.every(h => typeof h === "string" && h),
      "the game is in the recent results: both names, the host the winner, 'concession', now", g ? JSON.stringify(g) : "not found among " + (pub.recent || []).length);
    const hay = JSON.stringify([pub, la, lb]);
    row(![tokA, tokB].some(t => hay.indexOf(t) >= 0) && !/"(id|player|subject|token|table|game)"/.test(hay), "no token, id or table code in any ladder answer");

    /* 9: the page's own Ladder screen */
    await step("the host opens the page's Ladder screen", async () => {
      await A.page.locator(".reveal h2").click({ timeout: 30000 }).catch(() => {});
      await A.page.waitForSelector(".shell", { timeout: 30000 });
      await click(A, /^Find an opponent/); await A.page.waitForSelector(".tblwrap");
      await click(A, /^Join a server table/);
      await click(A, /^See the ladder/);
      await A.page.waitForSelector('[data-testid="ladder-board"]', { timeout: 60000 });
      const recent = (await A.page.locator('[data-testid="ladder-game"]').allInnerTexts()).map(t => t.replace(/\s+/g, " "));
      const rows = (await A.page.locator('[data-testid="ladder-row"]').allInnerTexts()).join(" ");
      const you = (await A.page.locator('[data-testid="ladder-you"]').innerText().catch(() => "")).replace(/\s+/g, " ");
      const mine = recent.find(t => t.indexOf(nameA) >= 0 && t.indexOf(nameB) >= 0);
      row(!!mine && new RegExp("^" + nameA + " \\(.+\\) beat " + nameB + " \\(.+\\) conceded · (just now|\\d+ min ago)$").test(mine), "the Ladder screen shows the game under Latest games: the winner beat the loser, conceded, just now", mine || recent.join(" | ").slice(0, 120));
      row(rows.indexOf(nameA) < 0 && rows.indexOf(nameB) < 0, "the Ladder screen lists neither player");
      row(/Your rating is 1216 after 1 ranked game\. 2 more ranked games and you are on the ladder\./.test(you), "the Ladder screen's own line says two more games", you.slice(0, 120));
    });
  } catch(e){ if(!(e && e.stopped)) row(false, "the run", String(e && e.message || e).split("\n")[0]); }
  const errs = [...A.errors.map(x => "host " + x), ...B.errors.map(x => "guest " + x)];
  row(errs.length === 0, "no page error on either phone", errs.slice(0, 2).join(" | "));
  console.log("      one ranked game, " + Math.round((Date.now() - t0) / 1000) + " s");
}

/* the live path: the real page, the real function, a real browser */
async function main(){
  if(!process.argv.includes("--go")){
    console.log("tools/liveranked.js plays ONE ranked game on the LIVE project and leaves two test players (one game each) and one result row behind for good.\nRead the header of this file, then run it again with --go.");
    process.exit(2);
  }
  const R = LC.makeRow(), row = R.row, url = (() => { const i = process.argv.indexOf("--url"); return i >= 0 ? process.argv[i + 1] : LC.PAGE_URL; })();
  console.log("liveranked " + url + "  (" + new Date().toISOString() + ")");
  let html = ""; try { html = await (await LC.fetchT(url + (url.includes("?") ? "&" : "?") + "liveranked=" + Date.now())).text(); } catch(e){ row(false, "the live page answers", String(e && e.message || e)); }
  const cfgSrc = (html.match(/window\.SERVER_TABLE\s*=\s*(\{[^}]*\});/) || [])[1];
  let cfg = null; try { cfg = cfgSrc && new Function("return " + cfgSrc)(); } catch(_){}
  if(!row(!!cfg && !!cfg.url && !!cfg.key, "the live page names its server project")) process.exit(1);
  const { browser, proxy } = await LC.launchBrowser();
  const q = cfg.on !== true ? "?server=1" : "";
  const phones = [];
  try {
    for(const nm of ["host", "guest"]) phones.push(await LC.openPhone(browser, nm, { proxy, query: q, url }));
    const env = { A: phones[0], B: phones[1], post: LC.functionPost(cfg), token: ph => LC.phoneToken(ph.page) };
    await run(env, row);
  } catch(e){ row(false, "the run", String(e && e.stack || e).split("\n").slice(0, 2).join(" | ")); }
  await browser.close().catch(() => {});
  console.log(R.st.failed ? "FAILED: " + R.st.failed + " check(s)" : "ALL PASS");
  setTimeout(() => process.exit(R.st.failed ? 1 : 0), 200);
}

module.exports = { run, runName };
if(require.main === module) main();
