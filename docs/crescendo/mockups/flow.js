/* CRESCENDO flow mockups — the tiny shared script (not part of the game; mockups only).
   1. sprite: the icon <symbol>s every flow page uses (original, 24 grid, 2px round strokes).
   2. variants: <div class="stage" data-variants="a|b|c" data-default="a"> + ?v=b shows only [data-vs~="b"] pieces.
      On a desktop window (framed) a small switcher floats under the phone; on a phone use the gallery links.
   3. navigation: [data-href="flow-4-sitdown.html"] makes any element a link (keeps ?w ?h ?noframe).
   4. Tbl(): the dimmed table backdrop the sheets sit over (a simple stand-in for the table designer's table). */
(function () {
  var ART = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/';
  window.FLOW = { ART: ART };

  /* ---------- 1. icon sprite ---------- */
  var sp = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-next" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-dots" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></symbol>' +
    '<symbol id="i-pad" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-sound" viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-share" viewBox="0 0 24 24"><path d="M12 15V4M8 7.5L12 4l4 3.5M6 11v8h12v-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5.5C7 4.5 9.5 4.8 12 6.5c2.5-1.7 5-2 8-1v13c-3-1-5.5-.7-8 1-2.5-1.7-5-2-8-1z M12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-flag" viewBox="0 0 24 24"><path d="M6 21V4M6 5h11l-2.5 4 2.5 4H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-judge" viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/></symbol>' +
    '<symbol id="i-board" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="2"/></symbol>' +
    '<symbol id="i-log" viewBox="0 0 24 24"><path d="M5 6h14M5 11h14M5 16h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-coach" viewBox="0 0 24 24"><path d="M12 3.5a6 6 0 00-3.4 10.9c.6.5.9 1.1.9 1.8V17h5v-.8c0-.7.3-1.3.9-1.8A6 6 0 0012 3.5zM9.8 20h4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-left" viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6M20 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-right" viewBox="0 0 24 24"><path d="M10 6l6 6-6 6M4 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-down" viewBox="0 0 24 24"><path d="M6 11l6 6 6-6M5 20h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-up" viewBox="0 0 24 24"><path d="M6 13l6-6 6 6M5 4h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z" fill="currentColor"/></symbol>' +
    '<symbol id="i-power" viewBox="0 0 24 24"><path d="M5 19l9-9M14 10l5-5.5.5-.5-.5 4.5L14.8 13zM7.6 16.4l-2.2 2.2M4.5 14.8l4.7 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>' +
    '<symbol id="i-deck" viewBox="0 0 24 24"><rect x="6" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 2h8a2 2 0 012 2v13" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/></symbol>' +
    '<symbol id="i-hand" viewBox="0 0 24 24"><rect x="4" y="6" width="10" height="14" rx="1.8" transform="rotate(-12 9 13)" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="5" width="10" height="14" rx="1.8" transform="rotate(10 15 12)" fill="none" stroke="currentColor" stroke-width="2"/></symbol>' +
    '<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/></symbol>' +
    /* the four modes: original pictograms, 48 grid, drawn in currentColor + brass accents */
    '<symbol id="m-dummy" viewBox="0 0 48 48"><rect x="5" y="19" width="38" height="4.4" rx="2.2" fill="currentColor" opacity=".55"/><rect x="21.6" y="33" width="4.8" height="9" fill="currentColor" opacity=".8"/><rect x="12" y="41.5" width="24" height="3.6" rx="1.8" fill="currentColor"/><path d="M14.5 17.5h19l-2.2 16.5H16.7z" fill="currentColor"/><path d="M24 18v15.5" stroke="#0A0E10" stroke-opacity=".45" stroke-width="1.4"/><circle cx="24" cy="26" r="4.6" fill="none" stroke="#F2C66E" stroke-width="2"/><circle cx="24" cy="26" r="1.2" fill="#F2C66E"/><path d="M16.2 8.5a7.8 7.8 0 0115.6 0V15H16.2z" fill="currentColor"/><path d="M16.2 11.6h15.6" stroke="#0A0E10" stroke-width="2.2"/><path d="M24 2.5l2.6 4.2h-5.2z" fill="#F2C66E"/></symbol>' +
    '<symbol id="m-ai" viewBox="0 0 48 48"><circle cx="24" cy="18" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M9 42c1-9 7-14 15-14s14 5 15 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M36 6l1.6 3.6L41 11l-3.4 1.4L36 16l-1.6-3.6L31 11l3.4-1.4z" fill="#F2C66E"/><path d="M11 9l1 2.2L14 12l-2 .8L11 15l-1-2.2L8 12l2-.8z" fill="#F2C66E" opacity=".7"/></symbol>' +
    '<symbol id="m-phones" viewBox="0 0 48 48"><rect x="4" y="12" width="17" height="30" rx="4" transform="rotate(-8 12 27)" fill="none" stroke="currentColor" stroke-width="3"/><rect x="27" y="6" width="17" height="30" rx="4" transform="rotate(8 36 21)" fill="none" stroke="currentColor" stroke-width="3"/><path d="M19 27c3-4 7-4 10 0" fill="none" stroke="#F2C66E" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="36" r="1.6" fill="currentColor"/><circle cx="36" cy="30" r="1.6" fill="currentColor"/></symbol>' +
    '<symbol id="m-online" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 24h32M24 8c-7 5-7 27 0 32M24 8c7 5 7 27 0 32" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".75"/><path d="M36 5l3 5 5.4.9-4 3.8 1 5.4-5.4-2.7-5 2.8.9-5.6-4-3.8L33 9.6z" fill="#F2C66E" transform="scale(.62) translate(18 -2)"/></symbol>' +
    '</defs></svg>';
  var holder = document.createElement('div'); holder.innerHTML = sp; document.body.insertBefore(holder.firstChild, document.body.firstChild);

  /* ---------- 2. variants ---------- */
  var q = new URLSearchParams(location.search);
  var stage = document.querySelector('.stage');
  var variants = (stage.getAttribute('data-variants') || '').split('|').filter(Boolean);
  var cur = q.get('v') || stage.getAttribute('data-default') || variants[0] || '';
  window.FLOW.v = cur;
  stage.setAttribute('data-v', cur);
  function applyV() {
    document.querySelectorAll('[data-vs]').forEach(function (el) {
      el.hidden = (' ' + el.getAttribute('data-vs') + ' ').indexOf(' ' + cur + ' ') < 0;
    });
  }
  applyV();
  var hs = document.createElement('style');
  hs.textContent = '[hidden]{display:none!important}.vnav{position:fixed;left:0;right:0;bottom:10px;display:none;justify-content:center;gap:8px;z-index:999;font:600 12px "Spline Sans Mono",monospace}' +
    'html[data-framed] .vnav{display:flex}.vnav a{color:#F5F0E4;background:#202B30;padding:7px 12px;border-radius:14px;text-decoration:none;border:1px solid #2C3940}.vnav a.on{background:#F5F0E4;color:#0A0E10}';
  document.head.appendChild(hs);
  if (variants.length > 1) {
    var nav = document.createElement('nav'); nav.className = 'vnav';
    variants.forEach(function (v) {
      var a = document.createElement('a'); var u = new URLSearchParams(location.search); u.set('v', v);
      a.href = '?' + u.toString(); a.textContent = v; if (v === cur) a.className = 'on'; nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  /* ---------- 3. navigation ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-href]') : null;
    if (!t) return;
    var u = new URLSearchParams(location.search), keep = new URLSearchParams();
    ['w', 'h', 'noframe'].forEach(function (k) { if (u.has(k)) keep.set(k, u.get(k)); });
    var href = t.getAttribute('data-href'), s = keep.toString();
    location.href = href + (s ? (href.indexOf('?') < 0 ? '?' : '&') + s : '');
  });
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* ---------- 4. the dimmed table backdrop ---------- */
  function por(code, pos) { return '<div class="por" style="background-image:url(' + ART + code + '.webp);' + (pos ? 'background-position:' + pos : '') + '"></div>'; }
  function bar(life, max) { var p = Math.max(0, Math.min(100, life / max * 100)); return '<div class="bar' + (life / max <= .25 ? ' low' : '') + '"><i class="fill" style="width:' + p + '%"></i></div>'; }
  function cd(code, cls, strip) { return '<div class="cd ' + (cls || '') + '"><img alt="" src="' + ART + code + '.webp">' + (strip ? '<span class="strip"></span>' : '') + '</div>'; }
  window.Tbl = function (o) {
    o = o || {};
    var you = o.you || 'SIY001', opp = o.opp || 'SVI001', yl = o.yl == null ? 15 : o.yl, ol = o.ol == null ? 16 : o.ol, ym = o.ym || 18, om = o.om || 20;
    var yn = o.yn || 'You', on = o.on || 'Viserai', turn = o.turn || 3, mine = o.mine !== false;
    var hand = o.hand || [['SIY016', 'red'], ['SIY018', 'yellow'], ['SIY023', 'blue'], ['SIY014', 'red'], ['SIY025', 'blue']];
    return '<div class="tbl"><div class="t-bout">' +
      '<div class="side you">' + por(you) + '<div class="col">' + bar(yl, ym) + '<div class="nm">' + yn + '</div></div><div class="life' + (yl / ym <= .25 ? ' low' : '') + '">' + yl + '</div></div>' +
      '<div class="medal' + (mine ? '' : ' o') + '"><em class="' + (mine ? 'l' : 'r') + '"></em><b>' + turn + '</b><span>TURN</span></div>' +
      '<div class="side opp">' + por(opp, '50% 14%') + '<div class="col">' + bar(ol, om) + '<div class="nm">' + on + '</div></div><div class="life' + (ol / om <= .25 ? ' low' : '') + '">' + ol + '</div></div></div>' +
      '<div class="t-half opp"><div class="t-z">' + cd(o.og1 || 'SVI002', 'mat') + cd(o.og2 || 'SVI006', 'mat') + '</div><i class="sp"></i>' +
      '<div class="t-backs"><i></i><i></i><i></i><i></i></div><div class="cd back mat"></div><div class="cd back mat"></div></div>' +
      '<div class="t-mid">' + (o.mid || '') + '</div>' +
      '<div class="t-half you"><div class="t-z">' + cd(o.g1 || 'SIY005', 'mat') + (o.g2 === 0 ? '' : cd(o.g2 || 'SIY002', 'mat')) + '</div><i class="sp"></i><div class="cd back mat"></div><div class="cd back mat"></div></div>' +
      '<div class="t-tray"><div class="t-hand">' + hand.map(function (c) { return cd(c[0], 'hand ' + c[1], true); }).join('') + '</div></div>' +
      '<div class="t-hub">' + (o.nohub ? '' : '<span class="ib"><svg class="ico"><use href="#i-dots"/></svg></span><span class="pb' + (o.btnDis ? ' dis' : '') + '">' + (o.btn || 'END TURN') + '</span><span class="ib"><svg class="ico"><use href="#i-pad"/></svg></span>') + '</div></div>';
  };
  document.querySelectorAll('[data-tbl]').forEach(function (el) {
    var o = {}; try { o = JSON.parse(el.getAttribute('data-tbl') || '{}'); } catch (e) {}
    el.innerHTML = window.Tbl(o);
  });
})();
