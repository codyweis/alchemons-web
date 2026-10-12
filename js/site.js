/* Alchemons — the biomes, and the page's small behaviours. */
(() => {
  const G = window.Grains;
  const reduce = G.reduceMotion;

  // ── Biomes: portals, and a window that changes in grains ──
  const BIOMES = [
    ['sky', 'Skyward Reach', 'Floating stone islands over the clouds, gold at sunset and silver under the moon.', '#e8eef7'],
    ['arcane', 'Arcane Expanse', 'A plain of still black glass that reflects everything above it.', '#b07cff'],
    ['volcano', 'Ashen Volcano', 'A smoking cone over black rock. Touch the lava and the crust breaks.', '#ff7a3a'],
    ['swamp', 'Sunken Swamp', 'A bog lake in green haze, with cypress trees and duckweed that parts when you touch it.', '#6fd0a0'],
    ['tidal', 'Tidal Shelf', 'Basalt columns at the edge of the sea. The tide follows the real clock.', '#7fb8ff'],
    ['valley', 'Verdant Valley', 'Where the game begins: a meadow under hills and haze, and a rift in the clouds.', '#7fd68c'],
  ];
  const portalsEl = document.getElementById('portals');
  const win = document.querySelector('.biome-window');
  const winImg = document.getElementById('biome-still');
  const winCanvas = document.getElementById('biome-canvas');
  if (portalsEl && win) {
    portalsEl.innerHTML = BIOMES.map(([k, name], i) => `<li><button type="button" data-k="${k}" aria-pressed="${i === 0}" aria-label="${name}"><canvas aria-hidden="true"></canvas>${name}</button></li>`).join('');
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
          v.addColorStop(0, 'rgba(4,4,5,0)'); v.addColorStop(1, 'rgba(4,4,5,0.95)');
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
    let currentK = BIOMES[0][0], wantK = currentK;

    async function showBiome(k) {
      if (k === wantK) return;
      wantK = k;
      const [, name, line] = BIOMES.find((b) => b[0] === k);
      buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k));
      const [from, to] = await Promise.all([img(currentK), img(k)]);
      if (k !== wantK) return; // a later click won the race
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
      out.fill(G.pack(4, 4, 5));
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

  // ── Trailer: the poster and a play button until it's started, then the browser's own controls ──
  const video = document.getElementById('trailer-video');
  const screen = document.getElementById('screen');
  const playBtn = document.getElementById('trailer-play');
  const chapterBtns = [...document.querySelectorAll('#chapters button')];
  if (video && screen) {
    const playFrom = (t) => {
      screen.classList.add('is-playing');
      video.controls = true;
      const go = () => { if (t != null) video.currentTime = t; video.play().catch(() => {}); };
      if (video.readyState >= 1) go(); else { video.preload = 'auto'; video.addEventListener('loadedmetadata', go, { once: true }); video.load(); }
    };
    playBtn?.addEventListener('click', () => playFrom(null));
    video.addEventListener('play', () => { screen.classList.add('is-playing'); video.controls = true; });
    chapterBtns.forEach((b) => b.addEventListener('click', () => {
      playFrom(+b.dataset.t);
      // on a phone the chapters sit under the video: bring it back into view
      const r = screen.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) screen.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
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
    document.querySelectorAll('.section-head, .fuse-stage, .let-grid, .genes, .biome-viewer, .screen, .trailer-copy, .card, .breeding, .waitlist-inner > *').forEach((el, i) => {
      el.classList.add('reveal');
      if (el.classList.contains('card')) el.style.transitionDelay = (i % 3) * 80 + 'ms';
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
        ctx.fillStyle = q.teal ? `rgba(127,214,200,${a})` : `rgba(240,226,184,${a})`;
        const s = q.big ? 2.2 : 1.2;
        ctx.fillRect(q.x * w, q.y * h, s, s);
      }
    }, { fps: 40 });
  }
})();
