/* CRESCENDO mockup stage — the phone contract in miniature (FRAMEWORK.md §4.3, PHONE.md).
   Include in <head> of every mockup: <script src="stage.js"></script>, and give the page's root
   element class="stage". Sets ONE height (--vh, from visualViewport) and a band on <html>:
     data-band = compact (SE, < 600 design px tall at 390 wide) | regular | tall (>= 760).
   On a wide desktop window it frames the page as a 393x660 phone (iPhone Safari's visible area),
   so a mockup reads the same on a laptop as on the phone; ?w=375&h=548 picks another frame. */
(function () {
  var r = document.documentElement, q = new URLSearchParams(location.search), raf = 0;
  var framed = (window.innerWidth > 560 && !q.has('noframe')) || q.has('w');
  function set() {
    raf = 0;
    var vv = window.visualViewport;
    var w = framed ? +(q.get('w') || 393) : (vv ? vv.width : window.innerWidth);
    var h = framed ? +(q.get('h') || 660) : (vv ? vv.height : window.innerHeight);
    r.style.setProperty('--vh', h + 'px');
    r.style.setProperty('--vw', w + 'px');
    var hd = h * 390 / w;
    r.setAttribute('data-band', hd < 600 ? 'compact' : hd >= 760 ? 'tall' : 'regular');
    r.toggleAttribute('data-framed', framed);
  }
  set();
  if (!framed) {
    (window.visualViewport || window).addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(set); });
  }
  var css = document.createElement('style');
  css.textContent =
    'html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none;-webkit-text-size-adjust:100%;' +
    'touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '.stage{position:fixed;inset:0;height:var(--vh);overflow:hidden;box-sizing:border-box;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}' +
    'html[data-framed]{background:#0b0d10}' +
    'html[data-framed] .stage{inset:0;margin:auto;width:var(--vw);' +
    'border-radius:18px;box-shadow:0 0 0 10px #1a1d22,0 30px 80px rgba(0,0,0,.6)}';
  /* Inside .stage, layers are position:absolute (never fixed), so the framed phone and the real one agree. */
  document.head.appendChild(css);
})();
