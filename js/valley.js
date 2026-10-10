/* The Valley — the game's own Valley field, alive (valley-scene.js draws it as
   the game does, by the visitor's clock). Scroll and it comes apart in grains,
   starting at the rift in its sky, until only the dark the game's home sits in
   is left. Everything is a function of scroll progress, so scrolling back up
   puts the mask back together. The grains are built and drawn in
   valley-worker.js, off the main thread. Also: the logo in gold grains, and
   Lets standing in the grass. */
(() => {
  const G = window.Grains;
  const section = document.getElementById('valley');
  if (!section || !G) return;

  const stage = section.querySelector('.valley-stage');
  const still = document.getElementById('valley-still');
  const canvas = document.getElementById('valley-canvas');
  const sceneCanvas = document.getElementById('valley-scene');
  const hero = document.getElementById('hero');
  const lines = [...section.querySelectorAll('.line')];
  const creatureLayer = document.getElementById('valley-creatures');
  const reduce = G.reduceMotion;

  const FX = 0.5, FY = 0.62;            // object-position of the still
  let RIFT = [0.579, 0.21];             // the black hole in the Valley's clouds, as a fraction of the art (the scene says where, once it's up)
  const LIFE = 0.26;                    // progress a grain spends in flight
  const GRASS = 0.93;                   // where their feet meet the meadow, as a fraction of the art's height

  // Lets standing in the grass, spread across whatever width is on screen and
  // clear of the middle, where the scroll cue sits.
  const LETS = [
    { id: 'LET01', x: 0.14, dy: -0.005, h: 0.10 },
    { id: 'LET02', x: 0.32, dy: 0.015, h: 0.105 },
    { id: 'LET12', x: 0.68, dy: 0.0, h: 0.10, flip: true },
    { id: 'LET04', x: 0.86, dy: -0.015, h: 0.095, flip: true },
  ];
  const letEls = LETS.map((c) => {
    const el = document.createElement('span');
    el.className = 'sprite' + (reduce ? '' : ' is-anim');
    el.style.backgroundImage = `url(/assets/creatures/${c.id}.webp)`;
    el.style.setProperty('--frames', 4);
    el.style.setProperty('--ms', '120ms');
    // flip after centring on the feet; the standalone `scale` property would mirror the centring too
    if (c.flip) el.style.transform = 'translate(-50%, -100%) scaleX(-1)';
    creatureLayer.appendChild(el);
    return el;
  });

  let IW = 1920, IH = 1056;
  let vw = 0, vh = 0;
  function placeLets() {
    const s = Math.max(vw / IW, vh / IH), dh = IH * s, dy = (vh - dh) * FY;
    const cap = vw * (vw < 600 ? 0.17 : 0.11);
    LETS.forEach((c, i) => {
      const el = letEls[i], x = c.x * vw;
      // feet in the scene's own grass where it's drawing, else where the still has it
      const ground = scene && sceneUp ? scene.groundY(x) + c.dy * vh * 0.5 + vh * 0.03 : dy + (GRASS + c.dy) * dh;
      el.style.setProperty('--size', Math.round(Math.min(c.h * dh, cap)) + 'px');
      el.style.left = x + 'px';
      el.style.top = Math.min(ground, vh - 12) + 'px';
    });
  }

  // ── the living scene ──
  const scene = window.ValleyScene && sceneCanvas ? window.ValleyScene.create(sceneCanvas, { reduceMotion: reduce }) : null;
  let sceneUp = false;

  // ── the dissolve: in a worker where the browser can, a plain fade where it can't ──
  let worker = null, ready = false, curP = 0;
  const offscreen = 'transferControlToOffscreen' in canvas && typeof Worker === 'function' && typeof createImageBitmap === 'function';
  let failed = !offscreen; // no grains to come apart in: the picture just fades

  // the worker takes its grains' colors from a picture: the scene as it is now, or the still
  async function startWorker(src) {
    const bitmap = await createImageBitmap(src);
    worker = new Worker('/js/valley-worker.js');
    worker.onmessage = ({ data }) => { if (data.type === 'ready') { ready = true; sync(); } };
    worker.onerror = () => { worker = null; ready = false; failed = true; sync(); };
    const off = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: off, bitmap, vw, vh, FX, FY, RIFT, LIFE, reduce, live: !!scene, p: curP }, [off, bitmap]);
    worker.postMessage({ type: 'p', p: curP });
  }
  function riftNow() {
    const r = scene.rift();
    RIFT = [r.x / vw, r.y / vh];
  }
  async function resnap() {
    if (!worker || !scene) return;
    riftNow();
    const bitmap = await createImageBitmap(sceneCanvas);
    worker.postMessage({ type: 'resize', vw, vh, bitmap, RIFT }, [bitmap]);
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
      el.style.filter = v > 0.99 || v < 0.01 ? 'none' : `blur(${(1 - v) * 5}px)`;
    }
    const gone = 1 - smooth(0.66, 0.78, p);
    letEls.forEach((el, i) => {
      el.style.opacity = gone;
      el.style.translate = `0 ${-smooth(0.5, 0.8, p) * (30 + i * 10)}px`;
    });
  }

  function progress() {
    const r = section.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 0 ? G.clamp(-r.top / span, 0, 1) : 0;
  }

  // the picture stays up until the worker has a frame of its own to show
  function sync() {
    const dissolving = curP > 0.004 && ready && !!worker;
    section.classList.toggle('is-dissolving', dissolving);
    const fade = failed ? 1 - smooth(0.08, 0.6, curP) : '';
    still.style.opacity = fade;
    if (sceneCanvas) sceneCanvas.style.opacity = fade;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const p = progress();
      if (p === curP && ready) return;
      curP = p;
      overlay(p);
      if (worker) worker.postMessage({ type: 'p', p });
      sync();
    });
  }

  let resizeTimer = 0;
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    if (scene) { scene.resize(); scene.frame(performance.now() / 1000); }
    placeLets();
    clearTimeout(resizeTimer);
    if (worker) resizeTimer = setTimeout(() => (scene ? resnap() : worker.postMessage({ type: 'resize', vw, vh })), 150);
  }

  // ── the scene, drawn while it's on screen and not yet all gone; a finger in the grass stirs it ──
  if (scene) {
    G.whileVisible(sceneCanvas, (t) => {
      if (curP > 0.75) return;
      scene.frame(t);
      if (sceneUp) return;
      sceneUp = true;
      section.classList.add('has-scene');
      riftNow();
      placeLets();
      if (offscreen) startWorker(sceneCanvas).catch((err) => { console.error('valley', err); worker = null; failed = true; sync(); });
    }, { fps: 60 });
    let px = null, py = null;
    stage.addEventListener('pointermove', (e) => {
      const r = sceneCanvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      scene.pointer(x, y, px == null ? 0 : x - px, py == null ? 0 : y - py);
      px = x; py = y;
    }, { passive: true });
    const leave = () => { scene.pointer(null); px = py = null; };
    stage.addEventListener('pointerleave', leave);
    stage.addEventListener('pointercancel', leave);
  }

  // ── the logo gathers out of gold grains, then the real logo takes over, with a few glints ──
  async function logoGrains() {
    const holder = document.querySelector('.hero-logo');
    const lc = document.getElementById('logo-grains');
    const logo = document.getElementById('logo-still');
    if (!holder || !lc || !logo || reduce) return;
    const src = await G.loadImage(logo.currentSrc || logo.src);
    if (!lc.clientWidth) await new Promise((res) => new ResizeObserver((_, ro) => { if (lc.clientWidth) { ro.disconnect(); res(); } }).observe(lc));
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
    const glints = pts.filter((_, k) => G.h(k, 11) < 0.07);
    const GATHERED = 1.85, HANDOFF = 0.7; // the slowest grain's delay plus its flight; then the real logo takes over
    let settled = null;
    const t0 = performance.now() / 1000;
    holder.classList.add('is-grains');
    G.whileVisible(lc, (t) => {
      if (curP > 0.1) return;
      const { ctx: c, w: cw, h: ch, dpr } = G.fit(lc);
      c.clearRect(0, 0, cw, ch);
      const age = t - t0;
      if (age < GATHERED) {
        for (const q of pts) {
          const u = G.ease((age - q.d) / 1.2);
          if (u <= 0) continue;
          c.globalAlpha = u * 0.88;
          c.fillStyle = q.c;
          c.fillRect(q.x + q.ox * (1 - u), q.y + q.oy * (1 - u), q.s, q.s);
        }
        c.globalAlpha = 1;
        return;
      }
      holder.classList.remove('is-grains');
      const fade = 1 - G.ease((age - GATHERED) / HANDOFF);
      if (fade > 0) {
        if (!settled) {
          settled = document.createElement('canvas');
          settled.width = Math.round(cw * dpr); settled.height = Math.round(ch * dpr);
          const sc = settled.getContext('2d');
          sc.scale(dpr, dpr); sc.globalAlpha = 0.88;
          for (const q of pts) { sc.fillStyle = q.c; sc.fillRect(q.x, q.y, q.s, q.s); }
        }
        c.globalAlpha = fade;
        c.drawImage(settled, 0, 0, cw, ch);
        c.globalAlpha = 1;
      } else settled = null;
      c.fillStyle = '#fff6dc';
      for (const q of glints) {
        const g = Math.sin(t * 2.2 + q.tw * 40);
        if (g > 0.75) { c.globalAlpha = (g - 0.75) * 4 * 0.9; c.fillRect(q.x, q.y, q.s, q.s); }
      }
      c.globalAlpha = 1;
    }, { fps: 30 });
  }

  // ── start ──
  vw = stage.clientWidth; vh = stage.clientHeight;
  placeLets();
  curP = progress();
  overlay(curP);
  sync();
  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(layout).observe(stage);
  if (scene) scene.resize();
  else G.loadImage(still.currentSrc || still.src).then((i) => {
    IW = i.naturalWidth; IH = i.naturalHeight;
    placeLets();
    if (offscreen) return startWorker(i);
  }).catch((err) => { console.error('valley', err); worker = null; failed = true; sync(); });
  logoGrains().catch((err) => { console.error('logo grains', err); document.querySelector('.hero-logo')?.classList.remove('is-grains'); });
})();
