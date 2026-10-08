/* Alchemons — the Lets, the biomes, and the page's small behaviours. */
(() => {
  const G = window.Grains;
  const reduce = G.reduceMotion;

  // ── The Lets: each one gathers out of grains, as an ally does in the field ──
  const grid = document.getElementById('let-grid');
  const feature = document.getElementById('let-feature');
  const letCanvas = document.getElementById('let-canvas');
  let lets = [], current = null, gather = null;

  const strips = new Map();
  const strip = (id) => {
    if (!strips.has(id)) strips.set(id, G.loadImage(`/assets/creatures/${id}.webp`));
    return strips.get(id);
  };

  async function selectLet(id) {
    const c = lets.find((l) => l.id === id);
    if (!c) return;
    current = c;
    grid.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === id));
    const tint = G.E[c.type].tint;
    feature.style.setProperty('--c', tint);
    document.getElementById('let-meta').textContent = `${c.type} · ${c.rarity}`;
    document.getElementById('let-name').textContent = c.name;
    document.getElementById('let-desc').textContent = c.desc;
    const img = await strip(id);
    if (current !== c) return;
    // sample the first frame into grains
    const F = img.naturalHeight, step = 3;
    const tmp = document.createElement('canvas'); tmp.width = F; tmp.height = F;
    const tx = tmp.getContext('2d', { willReadFrequently: true });
    tx.drawImage(img, 0, 0, F, F, 0, 0, F, F);
    const px = tx.getImageData(0, 0, F, F).data, pts = [];
    for (let y = 0; y < F; y += step) for (let x = 0; x < F; x += step) {
      const i = (y * F + x) * 4;
      if (px[i + 3] < 120) continue;
      const k = pts.length;
      pts.push({ x: x / F, y: y / F, c: `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`, a: G.h(k, 1) * 6.283, r: 0.25 + G.h(k, 2) * 0.5, d: G.h(k, 3) * 0.45 });
    }
    gather = { img, pts, step: step / F, t0: performance.now() / 1000, frames: c.frames, ms: c.ms, tint: G.E[c.type].rgb };
  }

  G.whileVisible(letCanvas, (t) => {
    const { ctx, w, h } = G.fit(letCanvas);
    ctx.clearRect(0, 0, w, h);
    if (!gather) return;
    const g = gather, age = reduce ? 9 : t - g.t0;
    const size = Math.min(w, h) * 0.78, ox = (w - size) / 2, oy = (h - size) / 2 + h * 0.02;
    // its element's light where it stands
    const glow = ctx.createRadialGradient(w / 2, h * 0.56, 0, w / 2, h * 0.56, size * 0.55);
    glow.addColorStop(0, G.rgba(g.tint, 0.22)); glow.addColorStop(1, G.rgba(g.tint, 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    const settled = G.ease((age - 1.1) / 0.35);
    if (settled < 1) {
      const gs = g.step * size * 0.9;
      for (const q of g.pts) {
        const u = G.ease((age - q.d) / 0.8);
        const spin = (1 - u) * 2.2;
        const r = (1 - u) * size * q.r;
        const x = ox + q.x * size + Math.cos(q.a + spin) * r;
        const y = oy + q.y * size + Math.sin(q.a + spin) * r - (1 - u) * size * 0.15;
        ctx.globalAlpha = Math.min(1, u * 1.6) * (1 - settled);
        ctx.fillStyle = q.c;
        ctx.fillRect(x, y, gs, gs);
      }
      ctx.globalAlpha = 1;
    }
    if (settled > 0) {
      const F = g.img.naturalHeight, frame = Math.floor((age * 1000) / g.ms) % g.frames;
      ctx.globalAlpha = settled;
      ctx.drawImage(g.img, (reduce ? 0 : frame) * F, 0, F, F, ox, oy, size, size);
      ctx.globalAlpha = 1;
    }
  }, { fps: 60 });

  fetch('/assets/data/lets.json').then((r) => r.json()).then((data) => {
    const order = Object.keys(G.E);
    lets = data.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    grid.innerHTML = lets.map((c) => `<li><button type="button" data-id="${c.id}" data-el="${c.type}" style="--c:${G.E[c.type].tint}" aria-pressed="false" aria-label="${c.name}">
      <span class="sprite" style="background-image:url(/assets/creatures/${c.id}.webp);--frames:${c.frames};--ms:${c.ms}ms"></span></button></li>`).join('');
    grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) selectLet(b.dataset.id); });
    new IntersectionObserver(([en], io) => { if (en.isIntersecting) { io.disconnect(); selectLet('LET02'); } }, { rootMargin: '200px' }).observe(feature);
  }).catch(() => {});

  // ── Biomes: portals, and a window that changes in grains ──
  const BIOMES = [
    ['valley', 'The Valley', 'Ridge after ridge out of the haze, down to a meadow of grass made of grains.', '#7fd68c'],
    ['sky', 'Skyward Reach', 'Isles of pale stone over a sea of cloud, gold under a low sun and silver under the moon.', '#e8eef7'],
    ['arcane', 'The Arcane Expanse', 'A plain of still black glass that gives everything above it back, upside down.', '#b07cff'],
    ['volcano', 'The Ashen Volcano', 'A cone smoking over black rock and lava. A finger on the lava breaks the crust.', '#ff7a3a'],
    ['swamp', 'The Swamp', 'A still bog lake in green haze, cypress on fluted feet, duckweed that parts for a finger.', '#6fd0a0'],
    ['tidal', 'The Tidal Shelf', 'Basalt columns at the edge of the sea. The tide comes and goes on the real clock.', '#7fb8ff'],
  ];
  const portalsEl = document.getElementById('portals');
  const win = document.querySelector('.biome-window');
  const winImg = document.getElementById('biome-still');
  const winCanvas = document.getElementById('biome-canvas');
  if (portalsEl && win) {
    portalsEl.innerHTML = BIOMES.map(([k, name], i) => `<li><button type="button" data-k="${k}" aria-pressed="${i === 0}" aria-label="${name}"><canvas aria-hidden="true"></canvas>${name.replace(/^The /, '')}</button></li>`).join('');
    const portalImgs = new Map();
    BIOMES.forEach(([k]) => G.loadImage(`/assets/biomes/${k}-portal.webp`).then((im) => portalImgs.set(k, im)));
    const buttons = [...portalsEl.querySelectorAll('button')];

    // a portal: the scene in a soft round window, ringed by turning grains (as on the home screen)
    G.whileVisible(portalsEl, (t) => {
      buttons.forEach((b, bi) => {
        const cv = b.querySelector('canvas');
        const { ctx, w, h } = G.fit(cv);
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, r = w * 0.4;
        const im = portalImgs.get(b.dataset.k);
        const on = b.getAttribute('aria-pressed') === 'true';
        if (im) {
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
          ctx.globalAlpha = on ? 1 : 0.7;
          ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2);
          const v = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
          v.addColorStop(0, 'rgba(4,7,10,0)'); v.addColorStop(1, 'rgba(4,7,10,0.95)');
          ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
        }
        const ring = G.hex(BIOMES[bi][3]);
        const n = 120, spin = (reduce ? 0 : t) * (on ? 0.25 : 0.08);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + spin + G.h(i, bi) * 0.08;
          const rr = r * (1.04 + (G.h(i, bi + 9) - 0.5) * (on ? 0.12 : 0.06));
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((reduce ? 0 : t) * 2 + i * 1.7));
          ctx.globalAlpha = (on ? 0.95 : 0.5) * tw;
          ctx.fillStyle = G.rgba(ring);
          const s = on ? 1.8 : 1.4;
          ctx.fillRect(cx + Math.cos(a) * rr - s / 2, cy + Math.sin(a) * rr - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      });
    }, { fps: 30 });

    // the window: the old scene lifts away in grains as the new one settles in
    let shift = null;
    const cache = new Map();
    const img = (k) => { if (!cache.has(k)) cache.set(k, G.loadImage(`/assets/biomes/${k}.webp`)); return cache.get(k); };
    let currentK = 'valley';

    async function showBiome(k) {
      if (k === currentK) return;
      const [, name, line] = BIOMES.find((b) => b[0] === k);
      buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k));
      const [from, to] = await Promise.all([img(currentK), img(k)]);
      currentK = k;
      document.getElementById('biome-name').textContent = name;
      document.getElementById('biome-line').textContent = line;
      winImg.alt = name + ' biome';
      if (reduce) { winImg.src = to.src; return; }
      const w = win.clientWidth, h = win.clientHeight;
      const gs = Math.max(2.5, Math.sqrt((w * h) / 90000));
      const W = Math.ceil(w / gs), H = Math.ceil(h / gs);
      winCanvas.width = W; winCanvas.height = H;
      const ctx = winCanvas.getContext('2d', { alpha: false });
      const data = ctx.createImageData(W, H);
      shift = { ctx, data, out: new Uint32Array(data.data.buffer), a: G.coverPixels(from, W, H), b: G.coverPixels(to, W, H), W, H, t0: performance.now() / 1000, to };
      win.classList.add('is-shifting');
    }

    G.whileVisible(win, (t) => {
      if (!shift) return;
      const s = shift, T = t - s.t0, { W, H, out, a, b } = s;
      out.fill(G.pack(4, 7, 10));
      const blendPx = (idx, c, al) => {
        const o = out[idx];
        const r = (o & 255) + ((c & 255) - (o & 255)) * al, g = ((o >>> 8) & 255) + (((c >>> 8) & 255) - ((o >>> 8) & 255)) * al;
        const bb = ((o >>> 16) & 255) + (((c >>> 16) & 255) - ((o >>> 16) & 255)) * al;
        out[idx] = G.pack(r | 0, g | 0, bb | 0);
      };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, n = G.h(x * 3 + 1, y * 5 + 2);
        // the new scene settles from below, grain by grain
        const ub = G.ease((T - 0.25 - (1 - y / H) * 0.35 - n * 0.3) / 0.45);
        if (ub > 0) {
          const yy = (y + (1 - ub) * H * 0.18 * (0.4 + n)) | 0;
          if (yy < H) blendPx(yy * W + x, b[i], ub);
        }
        // the old one lifts off, top first
        const ua = G.ease((T - (y / H) * 0.3 - n * 0.25) / 0.5);
        if (ua < 1) {
          const xx = (x + (n - 0.5) * ua * W * 0.08) | 0, yy = (y - ua * H * 0.3 * (0.5 + n)) | 0;
          if (xx >= 0 && xx < W && yy >= 0) blendPx(yy * W + xx, a[i], 1 - ua);
        }
      }
      s.ctx.putImageData(s.data, 0, 0);
      if (T > 1.45) { winImg.src = s.to.src; win.classList.remove('is-shifting'); shift = null; }
    }, { fps: 60 });

    portalsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showBiome(b.dataset.k); });
  }

  // ── Nav: solid once past the valley ──
  const nav = document.getElementById('nav');
  const valley = document.getElementById('valley');
  const onScroll = () => nav.classList.toggle('is-solid', valley ? valley.getBoundingClientRect().bottom < 80 : scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Trailer chapters ──
  const video = document.getElementById('trailer-video');
  const chapterBtns = [...document.querySelectorAll('#chapters button')];
  if (video && chapterBtns.length) {
    chapterBtns.forEach((b) => b.addEventListener('click', () => {
      const t = +b.dataset.t;
      const go = () => { video.currentTime = t; video.play().catch(() => {}); };
      if (video.readyState >= 1) go(); else { video.preload = 'auto'; video.addEventListener('loadedmetadata', go, { once: true }); video.load(); }
    }));
    video.addEventListener('timeupdate', () => {
      let cur = 0;
      chapterBtns.forEach((b, i) => { if (video.currentTime >= +b.dataset.t - 0.2) cur = i; });
      chapterBtns.forEach((b, i) => b.classList.toggle('is-current', i === cur));
    });
  }

  // ── Reveal on scroll ──
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.section-head, .codex-stage, .faction, .let-viewer, .genes, .biome-viewer, .phone, .trailer-copy, .card, .contests, .waitlist-inner > *').forEach((el, i) => {
      el.classList.add('reveal');
      if (el.classList.contains('card') || el.classList.contains('faction')) el.style.transitionDelay = (i % 5) * 70 + 'ms';
      io.observe(el);
    });
  }

  // ── Waitlist: grains rising out of the dark ──
  const grains = document.getElementById('grains');
  if (grains) {
    const pts = Array.from({ length: 180 }, (_, i) => ({ x: G.h(i, 1), y: G.h(i, 2), s: 0.15 + G.h(i, 3) * 0.5, big: G.h(i, 4) > 0.85, p: G.h(i, 5) * 6.28, teal: G.h(i, 6) > 0.6 }));
    let last = 0;
    G.whileVisible(grains, (t) => {
      const { ctx, w, h } = G.fit(grains);
      ctx.clearRect(0, 0, w, h);
      const dt = last ? Math.min(0.05, t - last) : 0; last = t;
      for (const q of pts) {
        if (!reduce) { q.y -= (q.s * 18 * dt) / h * 10; if (q.y < -0.02) { q.y = 1.02; q.x = Math.random(); } }
        const a = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.1 + q.p))) * Math.min(1, q.y * 2);
        ctx.fillStyle = q.teal ? `rgba(127,214,200,${a})` : `rgba(247,226,170,${a})`;
        const s = q.big ? 2.2 : 1.2;
        ctx.fillRect(q.x * w, q.y * h, s, s);
      }
    }, { fps: 40 });
  }
})();
