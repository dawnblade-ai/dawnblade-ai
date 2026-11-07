#!/usr/bin/env node
/* ============================================================
   tools/twophone.js — TWO REAL PAGES AT ONE TABLE (HIDDEN HANDS H2)

   tools/page.js drives one page; a two-phone table needs two, and a peer
   network the sandbox cannot reach. So PeerJS is STUBBED in each page
   (window.Peer, which engine/room.js uses when it exists) and every frame is
   relayed through node. Everything else is the real index.html and engine,
   loaded from file:// with page.js's offline routes.

   It walks the whole flow: open a table, join it, pick heroes, the SEALED
   throw (a tie, then a win), the seating, both loadouts, the seed exchange,
   then plays the game out — each page submitting for its own seat through
   its own session (the rule policy on the host's full game, and on the
   guest's VIEW) — and reports: the guest's view fingerprint against the
   referee's view of the host's game, whether the guest's phone holds the
   foe's hand, deck or seed, the host's saved game, the host-drop pause, and
   the post-game reveal. Page errors are listed at the end.

     PAGE_DEPS=<deps> NODE_PATH=<deps>/node_modules:$(npm root -g) node tools/twophone.js
   (deps: tools/page.js's header). A measuring drive, not a drill.
   ============================================================ */
const path = require("path"), {pathToFileURL} = require("url");
const P = require("./page.js");
const {chromium} = require("playwright");
const INDEX = path.join(__dirname, "..", "index.html");
const STUB = `(() => {
  const mk = () => ({open:false, h:{}, on(e,f){ (this.h[e]=this.h[e]||[]).push(f); }, emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); },
    send(m){ window.__relay(JSON.stringify(m)); }, close(){ this.open=false; window.__relayClose(); }});
  window.Peer = class { constructor(id){ this.h={}; window.__peer=this; if(id) window.__peerId=id; setTimeout(()=>this.emit("open", id||"guest"), 20); }
    on(e,f){ (this.h[e]=this.h[e]||[]).push(f); } emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); }
    connect(id){ const c = mk(); window.__conn = c; setTimeout(()=>window.__relayDial(), 20); return c; } destroy(){} };
  window.__accept = () => { const c = mk(); window.__conn = c; window.__peer.emit("connection", c); c.open = true; c.emit("open"); };
  window.__opened = () => { window.__conn.open = true; window.__conn.emit("open"); };
  window.__deliver = s => window.__conn && window.__conn.emit("data", JSON.parse(s));
  window.__closed = () => window.__conn && window.__conn.emit("close");
})();`;
(async () => {
  const answer = P.makeAnswer(P.depsDir());
  const browser = await chromium.launch();
  const errors = [];
  const pages = [];
  for(const who of ["host", "guest"]){
    const ctx = await browser.newContext({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
    await ctx.route(/^https?:/, route => { const req = route.request(), r = answer(req.url(), req.resourceType());
      route.fulfill({status: r.status || 200, contentType: r.contentType, body: r.body, headers: {"access-control-allow-origin": "*"}}); });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(who + " pageerror: " + String(e.stack || e).split("\n").slice(0, 3).join(" | ")));
    page.on("console", m => { if(m.type() === "error") errors.push(who + " console: " + m.text()); });
    await page.addInitScript(STUB);
    pages.push(page);
  }
  const [H, Gp] = pages;
  const other = p => p === H ? Gp : H;
  let frames = 0;
  for(const p of pages){
    await p.exposeFunction("__relay", s => { frames++; other(p).evaluate(x => window.__deliver(x), s).catch(e => errors.push("relay " + e.message)); });
    await p.exposeFunction("__relayDial", () => { H.evaluate(() => window.__accept()).then(() => Gp.evaluate(() => window.__opened())); });
    await p.exposeFunction("__relayClose", () => other(p).evaluate(() => window.__closed()));
  }
  for(const p of pages){
    await p.goto(pathToFileURL(INDEX).href);
    await p.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, {timeout: 30000});
  }
  const btn = (p, re) => p.locator("button", {hasText: re}).first();
  for(const p of pages){ await btn(p, /^Find an opponent/).click(); await p.waitForSelector(".tblwrap"); }
  await btn(H, /OPEN A TABLE/i).click();
  await H.waitForFunction(() => window.__peer, null, {timeout: 5000});
  await H.waitForTimeout(300);
  const code = await H.evaluate(() => String(window.__peerId).split("-").pop());
  console.log("table", code);
  await btn(Gp, /^Join a table/i).click();
  await Gp.locator("input.tblin").pressSequentially(code); console.log("typed", await Gp.locator("input.tblin").inputValue());
  await Gp.locator(".tblwrap button.bigbtn").first().click();
  for(const p of pages) await p.waitForSelector(".lobheroes", {timeout: 10000});
  /* heroes */
  await H.locator(".lobhero", {hasText: "Kayo"}).first().click(); await btn(H, /^Lock in/).click();
  await Gp.locator(".lobhero", {hasText: "Azalea"}).first().click(); await btn(Gp, /^Lock in/).click();
  /* throw: a tie first, then paper beats rock */
  const throwRound = async (a, b) => { await H.waitForSelector(".rthrows button"); await Gp.waitForSelector(".rthrows button");
    await H.locator(".rthrows button", {hasText: a}).click(); await Gp.locator(".rthrows button", {hasText: b}).click(); await H.waitForTimeout(400); };
  await throwRound("rock", "rock");
  await throwRound("paper", "rock");
  await H.waitForSelector(".rseatpick button", {timeout: 8000});
  console.log("host won the throw, seats");
  await H.locator(".rseatpick button").first().click();
  for(const p of pages){ await p.waitForSelector(".battlebtn", {timeout: 10000}); await p.locator(".battlebtn").first().click(); }
  for(const p of pages) await p.waitForSelector(".actbar", {timeout: 15000});
  await Gp.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  const info = async () => ({
    host: await H.evaluate(() => { const s = window.__dawnTable.session; return {status: s.status(), seq: s.seq(), referee: !!s.isReferee,
      guestWant: DawnWire.hash(DawnReferee.seatView(s.full(), 1))}; }),
    guest: await Gp.evaluate(() => { const s = window.__dawnTable.session, v = s.state(); return {status: s.status(), seq: s.seq(), hash: s.hash(),
      viewSeat: v.viewSeat, foeHandHidden: v.sides[0].hand.every(c => DawnView.isPh(c) || (v.sides[0].blockH || []).concat(v.sides[0].paySel || []).includes(c.uid) || (v.pending && v.pending.card && v.pending.card.uid === c.uid)), foeDeckHidden: v.sides[0].deck.filter(c=>!c._kb).every(c => DawnView.isPh(c)),
      rngHidden: !!v.rng.hidden, ownHand: v.sides[1].hand.map(c => c.name).length}; })});
  let x = await info(); console.log(JSON.stringify(x));
  /* play: each phone submits for its own seat through its own session */
  let acts = 0;
  const play = async limit => {
    for(let i = 0; i < limit; i++){
      const done = await H.evaluate(() => !!window.__dawnTable.session.full().over);
      if(done) return true;
      const hostMoved = await H.evaluate(() => { const s = window.__dawnTable.session, a = DawnSparring.act(s.full(), 0, {search: false}); if(!a) return false; return s.submit(a) || true; });
      if(hostMoved === true){ acts++; await H.waitForTimeout(5); continue; }
      if(hostMoved) { console.log("host refused", hostMoved); return false; }
      const g = await Gp.evaluate(() => { const s = window.__dawnTable.session, a = DawnSparring.act(s.state(), 1, {search: false}); if(!a) return false; return s.submit(a) || true; });
      if(g === true){ acts++; await Gp.waitForTimeout(15); continue; }
      if(g){ await Gp.waitForTimeout(50); continue; }
      await Gp.waitForTimeout(50);
    }
    return false;
  };
  await play(80);
  await Gp.waitForTimeout(400);
  x = await info(); console.log("after", acts, "actions:", JSON.stringify(x), "agree:", x.guest.hash === x.host.guestWant);
  console.log("host saved:", await H.evaluate(() => Object.keys(localStorage).filter(k => /dawnblade.table/.test(k)).map(k => k + " " + localStorage.getItem(k).length)));

  /* THE HOST'S PHONE RELOADS mid-game: its channel dies with the page */
  const seqAt = x.host.seq;
  await Gp.evaluate(() => window.__closed());
  await H.reload();
  await H.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, {timeout: 30000});
  await Gp.waitForTimeout(1600);
  console.log("guest while the host is gone:", await Gp.evaluate(() => window.__dawnTable.session.status()), "·",
    await Gp.evaluate(() => window.__dawnTable.session.submit({t: "pass"})), "· banner:",
    await Gp.evaluate(() => { const e = [...document.querySelectorAll(".tblerr")].find(d => /paused/.test(d.innerText)); return e ? e.innerText.slice(0, 60) : null; }));
  /* the host reopens the same table from what it saved */
  await btn(H, /^Find an opponent/).click(); await H.waitForSelector(".tblwrap");
  await btn(H, /^Resume table/).click();
  await H.waitForTimeout(300);
  /* the guest rejoins (the host's table opens when a guest sits down) */
  await btn(Gp, /^Rejoin$/).click();
  await H.waitForFunction(() => window.__dawnTable && window.__dawnTable.session && window.__dawnTable.session.full, null, {timeout: 15000});
  console.log("host resumed at seq", await H.evaluate(() => window.__dawnTable.session.seq()), "(saved at " + seqAt + ")");
  await Gp.waitForFunction(() => window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  x = await info(); console.log("after rejoin:", JSON.stringify(x.guest), "agree:", x.guest.hash === x.host.guestWant);
  const finished = await play(4000);
  await Gp.waitForTimeout(800);
  x = await info(); console.log("finished:", finished, "after", acts, "actions · agree:", x.guest.hash === x.host.guestWant);
  console.log("revealed:", await Gp.evaluate(() => { const r = window.__dawnTable.session.revealed(); return r ? r.log.length + " log entries, seedH " + !!r.seedH : null; }));
  /* VERIFY THIS GAME, tapped on the guest's phone */
  if(await Gp.locator("button", {hasText: /^Verify this game/}).count()){
    await btn(Gp, /^Verify this game/).click();
    await Gp.waitForFunction(() => /Verified:|Not verified:/.test(document.body.innerText), null, {timeout: 60000});
    console.log("verdict:", await Gp.evaluate(() => (document.body.innerText.match(/(Verified:|Not verified:)[^\n]*/) || [""])[0]));
  } else console.log("verdict: no verify button");
  console.log("host saved after the end:", await H.evaluate(() => Object.keys(localStorage).filter(k => /dawnblade.table/.test(k)).length));
  console.log("frames", frames, "ERRORS", errors.length); errors.slice(0, 10).forEach(e => console.log("  " + e));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });
