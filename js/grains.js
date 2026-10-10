/* Grains — what the site's effects are made of, ported from the game: the
   four first elements' tints and small helpers for canvases. The other
   elements stay out of the site; they're for players to find. */
window.Grains = (() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const h = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

  // each first element's tint, from the game
  const E = { Fire: { tint: '#FF7A1A' }, Water: { tint: '#2E8BD0' }, Earth: { tint: '#B07A44' }, Air: { tint: '#8FE0CC' } };
  for (const k in E) E[k].rgb = hex(E[k].tint);

  // Size a canvas's backing store to its CSS box; returns the CSS size.
  function fit(canvas, maxDpr = 2) {
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    const w = canvas.clientWidth, hgt = canvas.clientHeight;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(hgt * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hgt, dpr };
  }

  // Run cb(timeSeconds) every frame while el is on screen.
  function whileVisible(el, cb, { fps = 60 } = {}) {
    let on = false, raf = 0, last = 0;
    const step = (now) => {
      if (!on) return;
      raf = requestAnimationFrame(step);
      if (now - last < 1000 / fps - 2) return;
      last = now; cb(now / 1000);
    };
    new IntersectionObserver(([en]) => {
      on = en.isIntersecting;
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(step);
    }, { rootMargin: '100px' }).observe(el);
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  // Draw img into a W×H buffer as object-fit:cover with a focal point; return its pixels.
  function coverPixels(img, W, H, fx = 0.5, fy = 0.5) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    x.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
    return new Uint32Array(x.getImageData(0, 0, W, H).data.buffer);
  }

  const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;

  return { E, hex, mix, rgba, clamp, ease, h, fit, whileVisible, loadImage, coverPixels, pack, reduceMotion };
})();
