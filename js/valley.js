/* The Valley — the game's own Valley field, held still. Scroll and it comes
   apart in grains, starting at the rift in its sky, until only the dark the
   game's home sits in is left. Everything is a function of scroll progress, so
   scrolling back up puts the mask back together. Also: the logo in gold grains,
   motes over the grass, and Lets standing in it. */
(() => {
  const G = window.Grains;
  const section = document.getElementById('valley');
  if (!section || !G) return;

  const stage = section.querySelector('.valley-stage');
  const still = document.getElementById('valley-still');
  const canvas = document.getElementById('valley-canvas');
  const motesCanvas = document.getElementById('valley-motes');
  const hero = document.getElementById('hero');
  const lines = [...section.querySelectorAll('.line')];
  const creatureLayer = document.getElementById('valley-creatures');
  const reduce = G.reduceMotion;

  const FX = 0.5, FY = 0.62;            // object-position of the still
  const RIFT = [0.579, 0.21];           // the black hole in the Valley's clouds, as a fraction of the art
  const LIFE = 0.26;                    // progress a grain spends in flight
  const GOLD = [247, 226, 170];

  // Lets standing in the grass: feet position as a fraction of the art, height as a fraction of its height
  const LETS = [
    { id: 'LET01', x: 0.30, y: 0.925, h: 0.10, frames: 4, ms: 120 },
    { id: 'LET02', x: 0.43, y: 0.945, h: 0.105, frames: 4, ms: 120 },
    { id: 'LET12', x: 0.645, y: 0.93, h: 0.10, frames: 4, ms: 120, flip: true },
    { id: 'LET04', x: 0.78, y: 0.915, h: 0.095, frames: 4, ms: 120, flip: true },
  ];
  const letEls = LETS.map((c) => {
    const el = document.createElement('span');
    el.className = 'sprite' + (reduce ? '' : ' is-anim');
    el.style.backgroundImage = `url(/assets/creatures/${c.id}.webp)`;
    el.style.setProperty('--frames', c.frames);
    el.style.setProperty('--ms', c.ms + 'ms');
    if (c.flip) el.style.scale = '-1 1';
    creatureLayer.appendChild(el);
    return el;
  });

  let IW = 1920, IH = 1056;
  let vw = 0, vh = 0;
  function artRect() {
    const s = Math.max(vw / IW, vh / IH), dw = IW * s, dh = IH * s;
    return { s, dw, dh, dx: (vw - dw) * FX, dy: (vh - dh) * FY };
  }
  function placeLets() {
    const a = artRect();
    LETS.forEach((c, i) => {
      const el = letEls[i];
      el.style.setProperty('--size', Math.round(c.h * a.dh) + 'px');
      el.style.left = a.dx + c.x * a.dw + 'px';
      el.style.top = a.dy + c.y * a.dh + 'px';
    });
  }

  // ── grains ──
  const ctx = canvas.getContext('2d', { alpha: false });
  let img, W = 0, H = 0, data, out, base, space;
  let N = 0, gx, gy, gcol, gt, gvx, gvy, gseed;
  let built = false, lastDrawP = -1;

  const noise = (x, y, cell) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = G.h(x0 * 57 + y0, 9), b = G.h((x0 + 1) * 57 + y0, 9), c = G.h(x0 * 57 + y0 + 1, 9), d = G.h((x0 + 1) * 57 + y0 + 1, 9);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  function build() {
    if (!img || !vw) return;
    const bs = Math.max(1.5, Math.sqrt((vw * vh) / 620000)); // CSS px per grain
    W = Math.ceil(vw / bs); H = Math.ceil(vh / bs);
    canvas.width = W; canvas.height = H;
    data = ctx.createImageData(W, H);
    out = new Uint32Array(data.data.buffer);
    base = G.coverPixels(img, W, H, FX, FY);

    // where the art sits in the buffer, to find the rift
    const s = Math.max(W / IW, H / IH), dw = IW * s, dh = IH * s;
    const rx = (W - dw) * FX + RIFT[0] * dw, ry = (H - dh) * FY + RIFT[1] * dh;
    const maxD = Math.hypot(Math.max(rx, W - rx), Math.max(ry, H - ry));

    // the dark underneath: the game home's void, a few stars, a floor of teal grains
    space = new Uint32Array(W * H);
    for (let y = 0; y < H; y++) {
      const floor = Math.max(0, (y / H - 0.72) / 0.28);
      for (let x = 0; x < W; x++) {
        let r = 4, g = 7, b = 10;
        const n = G.h(x * 131 + y * 7919, 3);
        if (n > 0.9965) { const l = 120 + (n - 0.9965) / 0.0035 * 135; r = l * 0.85; g = l; b = l * 0.95; }
        else if (floor > 0 && n < floor * floor * 0.22) { const l = 0.35 + G.h(x, y) * 0.65; r = 60 * l; g = 170 * l; b = 160 * l; }
        space[y * W + x] = G.pack(r | 0, g | 0, b | 0);
      }
    }

    // each grain lets go when the unravelling from the rift reaches it
    N = W * H;
    const t = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dd = Math.hypot(x - rx, (y - ry) * 1.3) / maxD;
      const nn = noise(x, y, 22) * 0.65 + noise(x + 500, y, 6) * 0.35;
      t[y * W + x] = 0.04 + 0.62 * Math.min(1, 0.62 * dd + 0.38 * nn) + (G.h(x, y + 77) - 0.5) * 0.03;
    }
    const B = 4096, counts = new Uint32Array(B + 1);
    const bk = (v) => Math.min(B - 1, Math.max(0, (v * B) | 0));
    for (let i = 0; i < N; i++) counts[bk(t[i]) + 1]++;
    for (let k = 0; k < B; k++) counts[k + 1] += counts[k];
    const order = new Uint32Array(N);
    for (let i = 0; i < N; i++) order[counts[bk(t[i])]++] = i;

    gx = new Int16Array(N); gy = new Int16Array(N); gcol = new Uint32Array(N);
    gt = new Float32Array(N); gvx = new Float32Array(N); gvy = new Float32Array(N); gseed = new Float32Array(N);
    const travel = Math.max(W, H) * 0.32;
    for (let k = 0; k < N; k++) {
      const i = order[k], x = i % W, y = (i / W) | 0;
      const r1 = G.h(x + 11, y + 5), r2 = G.h(x + 23, y + 41);
      // outward from the rift, lifting, with a turn about it
      const ax = x - rx, ay = y - ry, len = Math.hypot(ax, ay) || 1;
      const out_ = 0.35 + r1 * 0.4, lift = 0.45 + r2 * 0.6, turn = 0.35;
      gx[k] = x; gy[k] = y; gcol[k] = base[i]; gt[k] = t[i]; gseed[k] = r1 * 6.283;
      gvx[k] = ((ax / len) * out_ + (-ay / len) * turn + (r2 - 0.5) * 0.4) * travel;
      gvy[k] = ((ay / len) * out_ * 0.6 + (ax / len) * turn - lift) * travel;
    }
    built = true;
    lastDrawP = -1;
  }

  function blend(idx, r, g, b, a) {
    const c = out[idx], cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
    out[idx] = G.pack(cr + (r - cr) * a | 0, cg + (g - cg) * a | 0, cb + (b - cb) * a | 0);
  }

  function draw(p) {
    out.set(base);
    let lo = 0, hi = N;
    while (lo < hi) { const m = (lo + hi) >> 1; if (gt[m] < p) lo = m + 1; else hi = m; }
    const k = lo;
    for (let i = 0; i < k; i++) { const idx = gy[i] * W + gx[i]; out[idx] = space[idx]; }
    for (let i = 0; i < k; i++) {
      const e = (p - gt[i]) / LIFE;
      if (e >= 1) continue;
      const ease = e * e * (1.4 - 0.4 * e);
      const x = gx[i] + gvx[i] * ease + (reduce ? 0 : Math.sin(gseed[i] + e * 9) * 1.4 * e);
      const y = gy[i] + gvy[i] * ease;
      const ix = x | 0, iy = y | 0;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      const c = gcol[i], w = Math.min(1, e * 1.7) * 0.7;
      const a = (1 - e) * (1 - e * 0.3);
      blend(iy * W + ix, (c & 255) * (1 - w) + GOLD[0] * w, ((c >>> 8) & 255) * (1 - w) + GOLD[1] * w, ((c >>> 16) & 255) * (1 - w) + GOLD[2] * w, a);
    }
    ctx.putImageData(data, 0, 0);
  }

  // ── overlay copy ──
  const smooth = (a, b, v) => G.ease((v - a) / (b - a));
  function overlay(p) {
    const hv = 1 - smooth(0, 0.07, p);
    hero.style.opacity = hv;
    hero.style.transform = `translateY(${-p * 240}px)`;
    hero.style.visibility = hv < 0.01 ? 'hidden' : 'visible';
    for (const el of lines) {
      const a = +el.dataset.in, b = +el.dataset.out;
      const v = smooth(a, a + 0.05, p) * (1 - smooth(b - 0.05, b, p));
      el.style.opacity = v;
      el.style.transform = `translate(-50%, calc(-50% + ${(1 - v) * (p < a + 0.05 ? 14 : -14)}px))`;
      el.style.filter = v < 0.99 ? `blur(${(1 - v) * 5}px)` : 'none';
    }
    const gone = 1 - smooth(0.66, 0.78, p);
    letEls.forEach((el, i) => {
      el.style.opacity = gone;
      el.style.translate = `0 ${-smooth(0.5, 0.8, p) * (30 + i * 10)}px`;
    });
    motesCanvas.style.opacity = 1 - smooth(0.02, 0.12, p);
  }

  function progress() {
    const r = section.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 0 ? G.clamp(-r.top / span, 0, 1) : 0;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const p = progress();
      overlay(p);
      const dissolving = p > 0.004;
      section.classList.toggle('is-dissolving', dissolving && built);
      if (dissolving && !built) build();
      if (dissolving && built && p !== lastDrawP) { draw(p); lastDrawP = p; }
    });
  }

  function layout() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    placeLets();
    if (built) { build(); onScroll(); }
  }

  // ── motes drifting over the grass (fireflies by night in the game) ──
  if (!reduce) {
    const motes = Array.from({ length: 46 }, (_, i) => ({ x: G.h(i, 1), y: 0.6 + G.h(i, 2) * 0.38, s: 0.4 + G.h(i, 3), p: G.h(i, 4) * 6.28 }));
    G.whileVisible(motesCanvas, (t) => {
      if (progress() > 0.15) return;
      const { ctx: m, w, h } = G.fit(motesCanvas);
      m.clearRect(0, 0, w, h);
      for (const q of motes) {
        const x = ((q.x + t * 0.004 * q.s) % 1) * w + Math.sin(t * 0.6 + q.p) * 12;
        const y = q.y * h - ((t * 6 * q.s + q.p * 40) % 70);
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.7 + q.p * 3));
        const gr = m.createRadialGradient(x, y, 0, x, y, 5);
        gr.addColorStop(0, `rgba(255,252,230,${a})`); gr.addColorStop(1, 'rgba(255,252,230,0)');
        m.fillStyle = gr; m.fillRect(x - 5, y - 5, 10, 10);
      }
    }, { fps: 40 });
  }

  // ── the logo in gold grains, gathering ──
  async function logoGrains() {
    const holder = document.querySelector('.hero-logo');
    const lc = document.getElementById('logo-grains');
    if (!holder || !lc || reduce) return;
    const src = await G.loadImage('/assets/brand/logo.png');
    const { w, h } = G.fit(lc);
    const step = Math.max(2.1, w / 300);
    const tmp = document.createElement('canvas');
    tmp.width = Math.ceil(w / step); tmp.height = Math.ceil(h / step);
    const tx = tmp.getContext('2d', { willReadFrequently: true });
    tx.drawImage(src, 0, 0, tmp.width, tmp.height);
    const px = tx.getImageData(0, 0, tmp.width, tmp.height).data;
    const pts = [];
    for (let y = 0; y < tmp.height; y++) for (let x = 0; x < tmp.width; x++) {
      const i = (y * tmp.width + x) * 4;
      if (px[i + 3] < 90) continue;
      const k = pts.length;
      const lift = 1 + (G.h(k, 5) - 0.3) * 0.35;
      pts.push({ x: (x + (G.h(k, 6) - 0.5) * 0.8) * step, y: (y + (G.h(k, 7) - 0.5) * 0.8) * step,
        s: step * (0.5 + G.h(k, 8) * 0.45),
        c: `rgb(${Math.min(255, px[i] * 1.1 * lift) | 0},${Math.min(255, px[i + 1] * 1.06 * lift) | 0},${Math.min(255, px[i + 2] * lift) | 0})`,
        ox: (G.h(k, 1) - 0.5) * w * 0.5, oy: (G.h(k, 2) - 0.5) * h * 2.2, d: G.h(k, 3) * 0.6, tw: G.h(k, 4) });
    }
    const t0 = performance.now() / 1000;
    holder.classList.add('is-grains');
    G.whileVisible(lc, (t) => {
      if (progress() > 0.1) return;
      const { ctx: c, w: cw, h: ch } = G.fit(lc);
      c.clearRect(0, 0, cw, ch);
      const age = t - t0;
      for (const q of pts) {
        const u = G.ease((age - q.d) / 1.2);
        const x = q.x + q.ox * (1 - u), y = q.y + q.oy * (1 - u);
        const tw = Math.sin(t * 2.2 + q.tw * 40);
        c.globalAlpha = u * (tw > 0.93 ? 1 : 0.88);
        c.fillStyle = tw > 0.93 ? '#fff6dc' : q.c;
        c.fillRect(x, y, q.s, q.s);
      }
      c.globalAlpha = 1;
    }, { fps: 40 });
  }

  // ── start ──
  G.loadImage(still.currentSrc || still.src).then((i) => {
    img = i; IW = i.naturalWidth; IH = i.naturalHeight;
    layout();
    new ResizeObserver(layout).observe(stage);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }).catch(() => {});
  vw = stage.clientWidth; vh = stage.clientHeight; placeLets(); overlay(progress());
  logoGrains().catch((err) => { console.error('logo grains', err); document.querySelector('.hero-logo')?.classList.remove('is-grains'); });
})();
