/* Fusion — pick two of the first four Lets and fuse them, as the game does: both
   come apart into their grains, the grains turn together and bloom pale, then
   gather into what the recipe makes. What that is stays a secret here: it
   arrives as a shape in ink. */
(() => {
  const G = window.Grains;
  const stage = document.getElementById('fuse-stage');
  if (!stage || !G) return;

  const canvas = document.getElementById('fuse-canvas');
  const grid = document.getElementById('let-grid');
  const formula = document.getElementById('formula');
  const descEl = document.getElementById('fuse-desc');
  const labels = [document.getElementById('fuse-a'), document.getElementById('fuse-b')];
  const reduce = G.reduceMotion;
  const ORDER = Object.keys(G.E);
  const key = (a, b) => [a, b].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)).join('+');
  const WHITE = [255, 255, 255], INK = [9, 10, 14];

  let lets = [], byId = {}, results = {};

  // ── sheets, and their first frame as grains ──
  const sheets = new Map();
  function sheet(url) {
    if (!sheets.has(url)) sheets.set(url, G.loadImage(url).then((img) => ({ img, pts: sample(img) })));
    return sheets.get(url);
  }
  const letSheet = (c) => sheet(`/assets/creatures/hd/${c.id}.webp`);
  const shadowSheet = (r) => sheet(`/assets/creatures/shadow/${r.shadow}.webp`);
  function sample(img) {
    const F = img.naturalHeight, step = Math.max(2, Math.round(F / 72));
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = F;
    const tx = tmp.getContext('2d', { willReadFrequently: true });
    tx.drawImage(img, 0, 0, F, F, 0, 0, F, F);
    const px = tx.getImageData(0, 0, F, F).data, xs = [], ys = [], cs = [];
    for (let y = 0; y < F; y += step) for (let x = 0; x < F; x += step) {
      const i = (y * F + x) * 4;
      if (px[i + 3] < 120) continue;
      xs.push(x / F); ys.push(y / F); cs.push(px[i], px[i + 1], px[i + 2]);
    }
    return { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), c: Uint8Array.from(cs), step: step / F };
  }

  // colors for grains, made once each rather than every frame
  const css = new Array(32768);
  const color = (r, g, b) => {
    const k = ((r & 255) >> 3) << 10 | ((g & 255) >> 3) << 5 | ((b & 255) >> 3);
    return css[k] ??= `rgb(${(k >> 10) << 3 | 4},${((k >> 5) & 31) << 3 | 4},${(k & 31) << 3 | 4})`;
  };

  // ── where things stand on the stage: the two being fused, and what they make ──
  function geom(w, h) {
    const narrow = w < 520, sx = narrow ? [0.17, 0.83] : [0.2, 0.8];
    const s = Math.min(h * 0.5, w * (narrow ? 0.36 : 0.28)), r = Math.min(h * 0.64, w * (narrow ? 0.46 : 0.34));
    return [{ x: w * sx[0], y: h * 0.42, s }, { x: w * sx[1], y: h * 0.42, s }, { x: w * 0.5, y: h * 0.41, s: r }];
  }

  // slots[0], slots[1]: { c, sh, t0 }; made: the secret once it has formed
  const slots = [null, null];
  let made = null, fusion = null, pending = null, lastPair = null;
  const now = () => performance.now() / 1000;

  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0) return;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, G.rgba(rgb, a)); gr.addColorStop(1, G.rgba(rgb, 0));
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function sprite(ctx, img, frames, ms, g, t, alpha) {
    if (alpha <= 0) return;
    const F = img.naturalHeight, frame = reduce ? 0 : Math.floor(t * 1000 / ms) % frames;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, frame * F, 0, F, F, g.x - g.s / 2, g.y - g.s / 2, g.s, g.s);
    ctx.globalAlpha = 1;
  }

  // the secret: its shape in ink against the pale light it was made in, a few grains still catching it
  function secret(ctx, m, g, t, alpha) {
    if (alpha <= 0) return;
    glow(ctx, g.x, g.y + g.s * 0.05, g.s * 0.72, m.bloom, 0.42 * alpha);
    sprite(ctx, m.sh.img, 4, 120, g, t, alpha);
    const p = m.sh.pts, gs = Math.max(1.2, p.step * g.s * 0.7);
    ctx.fillStyle = G.rgba(G.mix(m.bloom, WHITE, 0.5));
    for (let k = 0; k < p.n; k += 9) {
      const tw = Math.sin((reduce ? 0 : t) * 1.9 + G.h(k, 5) * 40);
      if (tw < 0.55) continue;
      ctx.globalAlpha = (tw - 0.55) * 2 * alpha;
      ctx.fillRect(g.x - g.s / 2 + p.x[k] * g.s, g.y - g.s / 2 + p.y[k] * g.s, gs, gs);
    }
    ctx.globalAlpha = 1;
  }

  // a Let gathering out of its grains where it stands, then itself
  function gathered(ctx, slot, g, t) {
    const { c, sh } = slot, p = sh.pts;
    const age = reduce ? 9 : t - slot.t0;
    glow(ctx, g.x, g.y + g.s * 0.14, g.s * 0.62, G.E[c.type].rgb, 0.22 * Math.min(1, age * 2));
    const settled = G.ease((age - 1.0) / 0.35);
    if (settled < 1) {
      const S = g.s, ox = g.x - S / 2, oy = g.y - S / 2, gs = p.step * S * 0.9;
      for (let k = 0; k < p.n; k++) {
        const u = G.ease((age - G.h(k, 3) * 0.45) / 0.8);
        if (u <= 0) continue;
        const a = G.h(k, 1) * 6.283 + (1 - u) * 2.2, r = (1 - u) * S * (0.25 + G.h(k, 2) * 0.5);
        ctx.globalAlpha = Math.min(1, u * 1.6) * (1 - settled);
        ctx.fillStyle = color(p.c[k * 3], p.c[k * 3 + 1], p.c[k * 3 + 2]);
        ctx.fillRect(ox + p.x[k] * S + Math.cos(a) * r, oy + p.y[k] * S + Math.sin(a) * r - (1 - u) * S * 0.15, gs, gs);
      }
      ctx.globalAlpha = 1;
    }
    sprite(ctx, sh.img, c.frames, c.ms, g, t, settled);
  }

  // ── the fusion: every grain of both, streaming in, turning, blooming, and settling as the secret ──
  function startFusion(t) {
    const [A, B] = [slots[0].sh.pts, slots[1].sh.pts], R = pending.sh.pts;
    const N = A.n + B.n;
    const perm = Uint32Array.from({ length: R.n }, (_, i) => i);
    for (let i = R.n - 1; i > 0; i--) { const j = (G.h(i, 41) * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const P = { N, nA: A.n, tj: new Uint32Array(N), ang: new Float32Array(N), rr: new Float32Array(N), d1: new Float32Array(N), d2: new Float32Array(N) };
    for (let i = 0; i < N; i++) {
      P.tj[i] = perm[i % R.n];
      P.ang[i] = G.h(i, 21) * Math.PI * 2;
      P.rr[i] = Math.sqrt(G.h(i, 22));
      P.d1[i] = G.h(i, 23) * 0.35;
      P.d2[i] = G.h(i, 24) * 0.3;
    }
    const ta = G.E[slots[0].c.type].rgb, tb = G.E[slots[1].c.type].rgb, bloom = G.mix(G.mix(ta, tb, 0.5), WHITE, 0.72);
    // grains settle a little lit, so the shape reads as it forms
    fusion = { t0: t, P, a: slots[0], b: slots[1], r: pending, bloom, ta, tb, settleTo: G.mix(INK, bloom, 0.28) };
    pending = null;
  }

  const DONE = 3.35;
  function drawFusion(ctx, g, t) {
    const f = fusion, P = f.P, T = reduce ? 9 : t - f.t0;
    const [gA, gB, gC] = g, A = f.a.sh.pts, B = f.b.sh.pts, R = f.r.sh.pts;
    const out = 1 - G.ease(T / 0.6);
    glow(ctx, gA.x, gA.y + gA.s * 0.14, gA.s * 0.62, f.ta, 0.22 * out);
    glow(ctx, gB.x, gB.y + gB.s * 0.14, gB.s * 0.62, f.tb, 0.22 * out);
    glow(ctx, gC.x, gC.y, gC.s * 0.7, f.bloom, 0.3 * G.ease((T - 1.0) / 0.6) * (1 - G.ease((T - 2.6) / 0.6)));
    // the makers themselves, for the moment before they come apart
    const whole = 1 - G.ease(T / 0.22);
    sprite(ctx, f.a.sh.img, f.a.c.frames, f.a.c.ms, gA, t, whole);
    sprite(ctx, f.b.sh.img, f.b.c.frames, f.b.c.ms, gB, t, whole);
    if (T < DONE) {
      const swirl = Math.max(0, T - 0.85) * 2.4;
      const spread = 1 + 0.55 * G.ease((T - 1.25) / 0.5) * (1 - G.ease((T - 2.0) / 0.6));
      const orbit = gC.s * 0.3, fade = 1 - G.ease((T - 2.85) / 0.45), show = G.ease(T / 0.22);
      const toBloom0 = G.ease((T - 1.05) / 0.6), st = f.settleTo;
      const gsA = A.step * gA.s * 0.9, gsC = R.step * gC.s * 0.9;
      for (let i = 0; i < P.N; i++) {
        const fromA = i < P.nA, p = fromA ? A : B, k = fromA ? i : i - P.nA, gs = fromA ? gA : gB;
        const sx = gs.x - gs.s / 2 + p.x[k] * gs.s, sy = gs.y - gs.s / 2 + p.y[k] * gs.s;
        // in to the middle, on a curve, and round it
        const u1 = G.ease((T - 0.15 - P.d1[i]) / 0.8);
        const a = P.ang[i] + swirl * (0.7 + 0.6 * P.rr[i]), mr = orbit * P.rr[i] * spread;
        let x = sx + (gC.x + Math.cos(a) * mr - sx) * u1;
        let y = sy + (gC.y + Math.sin(a) * mr * 0.9 - sy) * u1 - Math.sin(u1 * Math.PI) * gs.s * 0.18;
        // then out to where it belongs in what they made
        const u3 = G.ease((T - 2.0 - P.d2[i]) / 0.75), j = P.tj[i];
        x += (gC.x - gC.s / 2 + R.x[j] * gC.s - x) * u3;
        y += (gC.y - gC.s / 2 + R.y[j] * gC.s - y) * u3;
        const tb = toBloom0 * (1 - u3), sc = k * 3;
        let r = p.c[sc] + (f.bloom[0] - p.c[sc]) * tb, gg = p.c[sc + 1] + (f.bloom[1] - p.c[sc + 1]) * tb, b = p.c[sc + 2] + (f.bloom[2] - p.c[sc + 2]) * tb;
        r += (st[0] - r) * u3; gg += (st[1] - gg) * u3; b += (st[2] - b) * u3;
        // more grains went in than the shape is made of: the extra ones go out as it settles
        const extra = i >= R.n ? 1 - u3 : 1;
        const size = (gsA + (gsC - gsA) * u3) * (1 + 0.5 * tb);
        ctx.globalAlpha = 0.95 * show * fade * extra;
        ctx.fillStyle = color(r | 0, gg | 0, b | 0);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }
    secret(ctx, { sh: f.r.sh, bloom: f.bloom }, gC, t, G.ease((T - 2.75) / 0.45));
    if (T >= DONE) { made = { sh: f.r.sh, bloom: f.bloom }; fusion = null; settle(); }
  }

  function placeholder(ctx, g, t, rgb) {
    const n = 64, r = g.s * 0.3, spin = reduce ? 0 : t * 0.12;
    ctx.fillStyle = G.rgba(rgb);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + spin, rr = r * (1 + (G.h(i, 7) - 0.5) * 0.08);
      ctx.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin((reduce ? 0 : t) * 1.8 + i * 1.7));
      ctx.fillRect(g.x + Math.cos(a) * rr - 0.7, g.y + Math.sin(a) * rr - 0.7, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }

  const DIM = [233, 196, 106];
  function draw() {
    const t = now(); // the same clock the picks are stamped with
    const { ctx, w, h } = G.fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const g = geom(w, h);
    placeLabels(g);
    if (pending?.sh && slots[0]?.sh && slots[1]?.sh && (reduce || t >= slots[1].t0 + 1.35)) startFusion(t);
    if (fusion) { drawFusion(ctx, g, t); return; }
    if (made) { secret(ctx, made, g[2], t, 1); return; }
    for (let i = 0; i < 2; i++) {
      if (slots[i]?.sh) gathered(ctx, slots[i], g[i], t);
      else placeholder(ctx, g[i], t, i === 1 && slots[0] ? G.E[slots[0].c.type].rgb : DIM);
    }
  }

  // ── words ──
  const op = (s) => `<span class="op">${s}</span>`;
  const tinted = (c) => `<span style="color:${G.E[c.type].tint}">${c.name}</span>`;
  function setFormula(html, tint) {
    formula.innerHTML = html;
    stage.style.setProperty('--tint', tint || '#e9c46a');
  }
  function describe(c) {
    descEl.innerHTML = c ? `<strong>${c.name}</strong><span>${c.type} · ${c.rarity}</span>${c.desc}` : '';
  }
  function placeLabels(g) {
    labels.forEach((el, i) => {
      el.style.left = g[i].x + 'px';
      el.style.top = g[i].y + g[i].s * 0.46 + 'px';
    });
  }
  function label(i, c) {
    labels[i].innerHTML = c ? `<span>${c.type}</span>${c.name}` : '';
    labels[i].classList.toggle('is-on', !!c);
  }
  function refresh() {
    grid.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', slots.some((s) => s?.c === byId[b.dataset.id])));
  }

  function settle() {
    const [a, b] = lastPair, r = results[key(a.type, b.type)];
    const rest = r.rest.map(([n, v]) => `${n} ${v}%`).join(' · ');
    setFormula(`${tinted(a)}${op('+')}${tinted(b)}${op('→')}<span class="secret">???</span><span class="pct">${r.odds}%</span><span class="odds">or ${rest}</span>`);
    descEl.innerHTML = '<strong>???</strong>Something new. What it is, you find out when you fuse them yourself.';
    label(0, null); label(1, null);
    slots[0] = slots[1] = null;
    refresh();
  }

  function place(i, c) {
    const slot = { c, sh: null, t0: now() };
    slots[i] = slot;
    label(i, c);
    letSheet(c).then((sh) => { if (slots[i] === slot) { slot.sh = sh; slot.t0 = now(); } });
  }

  function choose(id) {
    const c = byId[id];
    if (!c) return;
    if (fusion || made || pending) { fusion = made = pending = null; slots[0] = slots[1] = null; lastPair = null; label(1, null); }
    if (slots[0]?.c === c && !slots[1]) { // the same one again: put it back
      slots[0] = null; label(0, null);
      setFormula('<span class="formula-hint">Pick a Let</span>'); describe(null); refresh();
      return;
    }
    if (!slots[0]) {
      place(0, c);
      setFormula(`${tinted(c)}${op('+')}<span class="formula-hint">pick another</span>`, G.E[c.type].tint);
      describe(c);
    } else fuse(slots[0].c, c);
    refresh();
  }
  function fuse(a, b) {
    if (!slots[0]) place(0, a);
    place(1, b);
    const p = pending = { sh: null };
    shadowSheet(results[key(a.type, b.type)]).then((sh) => { p.sh = sh; });
    lastPair = [a, b];
    setFormula(`${tinted(a)}${op('+')}${tinted(b)}${op('→')}<span class="formula-hint">?</span>`, G.E[a.type].tint);
    describe(b);
  }
  // ── start ──
  let userActed = false;
  fetch('/assets/data/fusion.json').then((r) => r.json()).then((data) => {
    results = data.results;
    lets = data.lets;
    for (const c of lets) byId[c.id] = c;
    grid.innerHTML = lets.map((c) => `<li><button type="button" data-id="${c.id}" data-el="${c.type}" style="--c:${G.E[c.type].tint}" aria-pressed="false" aria-label="${c.name}">
      <span class="sprite" style="background-image:url(/assets/creatures/${c.id}.webp?v=2);--frames:${c.frames};--ms:${c.ms}ms"></span></button></li>`).join('');
    grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { userActed = true; choose(b.dataset.id); } });
    for (const c of lets) letSheet(c);
    G.whileVisible(canvas, draw, { fps: 60 });
    // the first time it's seen, fuse the pair the game starts you with
    new IntersectionObserver(([en], io) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (userActed) return;
      choose('LET01');
      setTimeout(() => { if (!userActed) choose('LET02'); }, reduce ? 0 : 1300);
    }, { threshold: 0.4 }).observe(stage);
  }).catch(() => setFormula('<span class="formula-hint">The recipes could not be loaded.</span>'));
})();
