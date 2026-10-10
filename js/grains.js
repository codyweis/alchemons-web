/* Grains — what the site's effects are made of, ported from the game: the
   elements' tints, small helpers for canvases, and Darklet's ring. */
window.Grains = (() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const h = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

  // each element's tint, from the game
  const E = {
    Fire: { tint: '#FF7A1A' }, Water: { tint: '#2E8BD0' }, Earth: { tint: '#B07A44' }, Air: { tint: '#8FE0CC' },
    Steam: { tint: '#CDB9CC' }, Lava: { tint: '#FF4A12' }, Lightning: { tint: '#FFE45C' }, Mud: { tint: '#6E5038' },
    Ice: { tint: '#8FC4FF' }, Dust: { tint: '#E0CDA6' }, Crystal: { tint: '#8A68FF' }, Plant: { tint: '#5FC46B' },
    Poison: { tint: '#8E52D6' }, Spirit: { tint: '#E6DCFF' }, Dark: { tint: '#5A3A96' }, Light: { tint: '#FFE08A' },
    Blood: { tint: '#D01E2A' },
  };
  for (const k in E) E[k].rgb = hex(E[k].tint);

  /* Darklet's galaxy ring, from lib/widgets/fx/darklet_ring.dart: dust orbiting
     its head. The sheet is the ringless Darklet; paint the far side before the
     sprite and the near side after, into the frame's own box (x, y, size). */
  const DarkletRing = (() => {
    const FRAME = 724, HEAD_X = 361, HEAD_Y = [315, 319, 323, 319];
    const UNIT = 1 / 0.88, TILT = 0.47, SQUASH = 0.31, cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    const COLORS = ['#7474EC', '#8B91FF', '#9ACAFF', '#C7ECFF'].map(hex);
    let seed = 2309;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const grains = Array.from({ length: 260 }, () => {
      const lane = random();
      const radius = lane < 0.58 ? 179 + (random() + random() - 1) * 13
        : lane < 0.9 ? 200 + (random() + random() - 1) * 9
        : 220 + (random() - 0.5) * 11;
      return { radius, angle: random() * Math.PI * 2, phase: random() * Math.PI * 2, size: 0.35 + random() * 0.8, bright: random() > 0.9, color: Math.floor(random() * COLORS.length) };
    });
    const speed = (r) => 0.76 / Math.pow(r / 180, 1.5);

    function paint(ctx, x, y, size, index, t, { front, opacity = 1 }) {
      if (opacity <= 0) return;
      const s = size / FRAME, k = s * UNIT;
      const cx = x + HEAD_X * s, cy = y + HEAD_Y[clamp(index, 0, 3)] * s;
      const depth = (front ? 1 : 0.62) * opacity;
      const at = (r, a) => {
        const px = Math.cos(a) * r, py = Math.sin(a) * r * SQUASH;
        return [cx + (px * cosT - py * sinT) * k, cy + (px * sinT + py * cosT) * k];
      };
      const arc = (r, a, b) => {
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) { const [ox, oy] = at(r, a + (b - a) * i / 28); i ? ctx.lineTo(ox, oy) : ctx.moveTo(ox, oy); }
      };
      const line = (width, c, alpha) => { ctx.lineWidth = width * k; ctx.strokeStyle = rgba(c, clamp(alpha, 0, 1)); ctx.stroke(); };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const start = front ? 0 : Math.PI, end = front ? Math.PI : Math.PI * 2;
      for (const r of [176, 184, 200]) {
        for (const [w, c, a] of [[11, 0, 0.032], [5, 1, 0.055], [1.1, 2, 0.12]]) { arc(r, start, end); line(w, COLORS[c], a * depth); }
      }
      // stretched, turning clumps give the disc its swirl
      for (let band = 0; band < 4; band++) {
        const r = 174 + band * 11, sp = speed(r);
        for (let j = 0; j < 2; j++) {
          const angle = t * sp + band * 1.7 + j * Math.PI;
          if ((Math.sin(angle) > 0) !== front) continue;
          arc(r, angle - 0.55, angle); line(2.4, COLORS[1], 0.1 * depth);
          arc(r, angle - 0.55, angle); line(0.8, COLORS[3], 0.34 * depth);
        }
      }
      for (const g of grains) {
        const a = g.angle + t * speed(g.radius);
        if ((Math.sin(a) > 0) !== front) continue;
        const [ox, oy] = at(g.radius, a);
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + g.phase) ** 2, c = COLORS[g.color];
        ctx.fillStyle = rgba(c, clamp((g.bright ? 0.95 : 0.6) * tw * depth, 0, 1));
        ctx.beginPath(); ctx.arc(ox, oy, g.size * k, 0, 7); ctx.fill();
        if (g.bright) { ctx.fillStyle = rgba(c, 0.075 * tw * depth); ctx.beginPath(); ctx.arc(ox, oy, g.size * 3 * k, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    }
    return { paint };
  })();

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

  return { E, DarkletRing, hex, mix, rgba, clamp, ease, h, fit, whileVisible, loadImage, coverPixels, pack, reduceMotion };
})();
