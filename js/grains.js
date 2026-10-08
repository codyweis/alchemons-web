/* Grains — what the site's effects are made of, ported from the game.
   Orb is lib/widgets/fx/element_orb.dart: a turning ball of an element's
   grains in dark glass, lit from inside, with the same tints, ramps, spin and
   habits (fire sheds embers, lightning flickers, blood swells on a heartbeat). */
window.Grains = (() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const h = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
  const BLACK = hex('#07060B'), WHITE = [255, 255, 255];

  // tint, ramp (shadow, body, lit, glint) and habit, per element — from the game
  const E = {
    Fire:      { tint: '#FF7A1A', ramp: ['#5A1405', '#B8300A', '#EE7A12', '#FFD27A'], spin: 0.8, embers: 10 },
    Water:     { tint: '#2E8BD0', ramp: ['#0B2A4A', '#1D6FA3', '#4FB3E8', '#D6F3FF'], spin: 0.5, glint: 0.012 },
    Earth:     { tint: '#B07A44', ramp: ['#2E1C10', '#6E4626', '#A9794A', '#E3C9A0'], spin: 0.2, glint: 0 },
    Air:       { tint: '#8FE0CC', ramp: ['#3D5A66', '#86AEBB', '#C9E6EC', '#FFFFFF'], spin: 1.25, glint: 0.01 },
    Steam:     { tint: '#CDB9CC', ramp: ['#4A5560', '#8A97A6', '#C8D0DA', '#F6E9EE'], spin: 0.4, glint: 0 },
    Lava:      { tint: '#FF4A12', ramp: ['#240805', '#7A1A0B', '#F0570E', '#FFC56B'], spin: 0.25, embers: 6, glint: 0 },
    Lightning: { tint: '#FFE45C', ramp: ['#3A3210', '#B89A1E', '#F7DC4A', '#FFFBD8'], spin: 0.9, flicker: 0.022, glint: 0 },
    Mud:       { tint: '#6E5038', ramp: ['#241810', '#4F3828', '#85664E', '#C2A486'], spin: 0.22, glint: 0.003 },
    Ice:       { tint: '#8FC4FF', ramp: ['#1E3A56', '#6FA8D6', '#B9E2F7', '#F2FCFF'], spin: 0.3, glint: 0.03 },
    Dust:      { tint: '#E0CDA6', ramp: ['#5A4A36', '#9C8A6C', '#D2C2A2', '#F3EBDA'], spin: 0.6, glint: 0 },
    Crystal:   { tint: '#8A68FF', ramp: ['#3A2E6E', '#8673D6', '#C9B8FF', '#F5F0FF'], spin: 0.28, glint: 0.035 },
    Plant:     { tint: '#5FC46B', ramp: ['#173A1E', '#3F8A47', '#86CF7E', '#E2F7B5'], spin: 0.35, glint: 0.006 },
    Poison:    { tint: '#8E52D6', ramp: ['#241046', '#5B2FA8', '#3FC48A', '#C6F6D5'], spin: 0.45, glint: 0.004 },
    Spirit:    { tint: '#E6DCFF', ramp: ['#3A2E5C', '#8C7CC8', '#D6CCFF', '#FFFFFF'], spin: 0.6, glint: 0.015 },
    Dark:      { tint: '#5A3A96', ramp: ['#07050C', '#241B3A', '#55408A', '#A68BEB'], spin: -0.45, glint: 0.006 },
    Light:     { tint: '#FFE08A', ramp: ['#7A5E22', '#D4AA42', '#FFE89A', '#FFFFF4'], spin: 0.5, glint: 0.04 },
    Blood:     { tint: '#D01E2A', ramp: ['#3A0609', '#961420', '#DC2F3A', '#FFA3A3'], spin: 0.35, beat: 0.05, glint: 0 },
  };
  for (const k in E) {
    const e = E[k];
    e.rgb = hex(e.tint);
    e.rampRgb = e.ramp.map(hex);
    e.glint ??= 0.008; e.embers ??= 0; e.beat ??= 0; e.flicker ??= 0;
  }

  const FAR = 3, NEAR = 8, TIP = 0.38;

  class Orb {
    constructor(element, radius, grains) {
      this.element = element;
      this.e = E[element];
      this.radius = radius;
      const n = this.length = grains ?? Orb.defaultGrains(radius);
      this.lat = new Float32Array(n); this.lon = new Float32Array(n);
      this.rad = new Float32Array(n); this.ph = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        this.lat[i] = Math.asin(2 * h(i, 1) - 1);
        this.lon[i] = h(i, 2) * Math.PI * 2;
        this.rad[i] = 0.22 + 0.78 * Math.pow(h(i, 3), 0.55); // shell-weighted: a ball, not a disc
        this.ph[i] = h(i, 4);
      }
      this.x = new Float32Array(n); this.y = new Float32Array(n); this.tone = new Uint8Array(n);
      const rampAt = (t) => {
        const r = this.e.rampRgb, x = clamp(t, 0, 1) * (r.length - 1);
        const i = Math.min(r.length - 2, Math.floor(x));
        return mix(r[i], r[i + 1], x - i);
      };
      this.tones = [];
      for (let k = 0; k < FAR; k++) this.tones.push(mix(rampAt(0.15 + 0.2 * k), BLACK, 0.38));
      for (let k = 0; k < NEAR; k++) this.tones.push(rampAt(0.3 + 0.62 * k / (NEAR - 1)));
      this.toneCss = this.tones.map((c) => rgba(c));
      this.laidAt = NaN;
    }
    static defaultGrains(r) { return clamp(Math.round(300 * (r / 30) * (r / 30)), 140, 1400); }
    get grainSize() { return clamp(this.radius * 0.065, 1.2, 2.4); }
    swell(t) {
      const b = this.e.beat; if (!b) return 1;
      const beat = (t % 1.6) / 1.6;
      return 1 + b * (Math.exp(-beat * 18) + 0.6 * Math.exp(-Math.abs(beat - 0.2) * 22));
    }
    layout(t) {
      if (t === this.laidAt) return;
      this.laidAt = t;
      const ct = Math.cos(TIP), st = Math.sin(TIP);
      const spin = t * this.e.spin, r = this.radius * this.swell(t);
      for (let i = 0; i < this.length; i++) {
        const lat = this.lat[i], sl = Math.sin(lat);
        const lon = this.lon[i] + spin * (1 - 0.3 * sl * sl); // faster round the middle than the poles
        const cl = Math.cos(lat), pr = this.rad[i] * r;
        const px = pr * cl * Math.cos(lon), py = pr * sl, pz = pr * cl * Math.sin(lon);
        const y = py * ct + pz * st, z = pz * ct - py * st;
        let light = (-0.45 * px - 0.6 * y + 0.66 * z) / r * 0.5 + 0.5; // lit from upper left and front
        light = clamp(light * light * (3 - 2 * light), 0, 1);
        this.x[i] = px; this.y[i] = y;
        this.tone[i] = z < 0 ? Math.floor(light * (FAR - 0.01)) : FAR + Math.floor(light * (NEAR - 0.01));
      }
    }
    static flick(i, q) {
      let x = Math.imul(i, 0x27d4eb2d) ^ Math.imul(q, 0x165667b1);
      x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13;
      return (x & 0xffffff) / 0x1000000;
    }
    /* opacity: the glass and its light; grains:false leaves the grains to someone else; fade scales all */
    paint(ctx, cx, cy, t, { opacity = 1, grains = true, fade = 1 } = {}) {
      const f = clamp(fade, 0, 1), g = clamp(opacity * f, 0, 1);
      if (f <= 0) return;
      const e = this.e, c = e.rgb, r = this.radius * this.swell(t), d = this.grainSize;
      ctx.save(); ctx.translate(cx, cy);
      if (g > 0) { // its light on what is round it
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
        gr.addColorStop(0, rgba(c, 0.3 * g)); gr.addColorStop(0.45, rgba(c, 0.09 * g)); gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, 7); ctx.fill();
      }
      const buckets = Array.from({ length: FAR + NEAR }, () => []);
      const glints = [], embers = [];
      if (grains) {
        this.layout(t);
        const q = Math.floor(t * 12);
        for (let i = 0; i < this.length; i++) {
          const tone = this.tone[i];
          if (tone >= FAR) {
            const lit = (tone - FAR) / (NEAR - 1);
            if (e.flicker > 0 && Orb.flick(i, q) < e.flicker) { glints.push(i); continue; }
            if (e.glint > 0 && lit > 0.4 && (t * 0.3 + this.ph[i] * 7.7) % 1 < e.glint) { glints.push(i); continue; }
          }
          buckets[tone].push(i);
        }
        for (let k = 0; k < e.embers; k++) {
          const p = (t * (0.35 + 0.2 * h(k, 6)) + h(k, 5)) % 1;
          const a = -Math.PI / 2 + (h(k, 7) - 0.5) * 1.6, dd = r * (0.95 + 0.7 * p);
          embers.push(Math.cos(a) * dd, Math.sin(a) * dd - p * r * 0.3);
        }
      }
      const dots = (list, size, color, alpha) => {
        if (!list.length) return;
        ctx.globalAlpha = alpha * f; ctx.fillStyle = color;
        const hs = size / 2;
        for (const i of list) ctx.fillRect(this.x[i] - hs, this.y[i] - hs, size, size);
        ctx.globalAlpha = 1;
      };
      if (g > 0) { // the glass: dark and tinted, so the light inside glows
        const gr = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 0, -r * 0.2, -r * 0.25, r * 1.25);
        gr.addColorStop(0, rgba(mix(c, BLACK, 0.5), 0.55 * g));
        gr.addColorStop(0.6, rgba(mix(c, BLACK, 0.74), 0.75 * g));
        gr.addColorStop(1, rgba(mix(c, BLACK, 0.86), 0.9 * g));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      }
      for (let k = 0; k < FAR; k++) dots(buckets[k], d * 0.82, this.toneCss[k], 0.7);
      if (g > 0) { // the light inside it
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
        gr.addColorStop(0, rgba(mix(c, WHITE, 0.5), 0.55 * g)); gr.addColorStop(0.45, rgba(c, 0.24 * g)); gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill();
      }
      for (let k = 0; k < NEAR; k++) dots(buckets[FAR + k], d, this.toneCss[FAR + k], 0.92);
      if (g > 0) Orb.rimAndShine(ctx, r, g, c);
      dots(glints, d * 2.3, 'rgba(255,255,255,0.25)', 1);
      dots(glints, d * 1.25, '#FFFBEA', 1);
      if (embers.length) {
        ctx.globalAlpha = 0.85 * f; ctx.fillStyle = rgba(e.rampRgb[3]);
        const s = d * 1.05;
        for (let k = 0; k < embers.length; k += 2) ctx.fillRect(embers[k] - s / 2, embers[k + 1] - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // its edge catches the light, lower right more — a lens, not a disc — and a catchlight upper left
    static rimAndShine(ctx, r, g, tint) {
      const gr = ctx.createRadialGradient(r * 0.12, r * 0.14, 0, r * 0.12, r * 0.14, r * 1.02);
      gr.addColorStop(0, rgba(tint, 0)); gr.addColorStop(0.8, rgba(tint, 0));
      gr.addColorStop(0.95, rgba(mix(tint, WHITE, 0.35), 0.5 * g)); gr.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 1.04, 0, 7); ctx.fill();
      const sr = r * 0.42, sx = -r * 0.34, sy = -r * 0.4;
      const sh = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sh.addColorStop(0, `rgba(255,255,255,${0.7 * g})`); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    }
  }

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

  return { E, Orb, hex, mix, rgba, clamp, ease, h, fit, whileVisible, loadImage, coverPixels, pack, reduceMotion };
})();
