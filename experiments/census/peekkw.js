const {open} = require("/home/user/dawnblade-ai/tools/page.js");
(async () => {
  const {page, errors, close} = await open({w:393, h:852});
  const out = [];
  for(let hero = 0; hero < 17; hero++){
    await page.goto(page.url());
    await page.waitForSelector(".hcard");
    await page.locator(".hcard").nth(hero).click();
    await page.getByRole("button", {name: /^Battle$/}).click();
    await page.waitForSelector(".rseatpick, .actbar", {timeout: 8000});
    if(await page.locator(".rseatpick").count()) await page.locator(".rseatpick button").first().click();
    await page.waitForSelector(".actbar", {timeout: 8000});
    await page.locator('.lo .actbar [data-start="trainer"]').click();
    await page.waitForSelector(".board .phand .hc", {timeout: 8000});
    const n = await page.locator(".board .phand .hc").count();
    for(let i = 0; i < n; i++){
      const c = page.locator(".board .phand .hc").nth(i);
      if(!(await c.isVisible())) continue;
      await c.click({timeout: 3000}).catch(() => {});
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const w = document.querySelector(".peekwrap"); if(!w) return null;
        const k = w.querySelector(".pkkw"), b = w.querySelector(".peekbar").getBoundingClientRect();
        const nm = w.querySelector(".pknm").innerText;
        const rail = document.querySelector(".board .phand").getBoundingClientRect();
        const kb = k && k.getBoundingClientRect();
        const top = kb && document.elementFromPoint(kb.left + kb.width/2, kb.top + kb.height/2);
        return {nm, kw: k ? k.innerText : "", kb: kb && [Math.round(kb.left), Math.round(kb.top), Math.round(kb.right), Math.round(kb.bottom)],
          barBottom: Math.round(b.bottom), railTop: Math.round(rail.top), wTop: Math.round(w.getBoundingClientRect().top),
          inside: !kb || (kb.left >= 0 && kb.right <= 393 && kb.top >= 0), closes: !kb || !!(top && top.closest(".peekwrap") && !top.closest("button"))};
      });
      if(r) out.push(r);
      // close by tapping the keyword line itself if present, else the name
      await page.evaluate(() => { const w = document.querySelector(".peekwrap .pkkw") || document.querySelector(".peekwrap .pknm"); if(w) w.click(); });
      await page.waitForTimeout(200);
      const still = await page.locator(".peekwrap").count();
      if(r) r.closed = !still;
    }
  }
  for(const r of out) console.log(JSON.stringify(r));
  const bad = out.filter(r => !r.inside || !r.closes || !r.closed || r.barBottom > r.railTop || r.wTop < 0);
  console.log("peeks", out.length, "with keywords", out.filter(r => r.kw).length, "BAD", bad.length, "errors", errors.length);
  await close();
})();
