/* Fusion — pick two Lets and fuse them, as the game does: both come apart into
   their grains, the grains turn together and bloom pale, then gather into the
   Let the recipe makes. Recipes and odds are the game's own
   (assets/data/alchemy.json); the Lets are its sheets (assets/creatures/hd). */
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
  const WHITE = [255, 255, 255];

  let lets = [], byId = {}, byEl = {}, pairs = {};
  const partners = (el) => ORDER.filter((b) => b !== el && pairs[key(el, b)]);

  // ── each Let's sheet, and its first frame as grains ──
  const sheets = new Map();
  function sheet(c) {
    if (!sheets.has(c.id)) sheets.set(c.id, G.loadImage(`/assets/creatures/hd/${c.id}.webp`).then((img) => ({ img, pts: sample(img) })));
    return sheets.get(c.id);
  }
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
  let slotX = [0.2, 0.8];
  function geom(w, h) {
    const narrow = w < 520;
    const s = Math.min(h * 0.5, w * (narrow ? 0.36 : 0.28)), r = Math.min(h * 0.64, w * (narrow ? 0.46 : 0.34));
    return [{ x: w * slotX[0], y: h * 0.42, s }, { x: w * slotX[1], y: h * 0.42, s }, { x: w * 0.5, y: h * 0.41, s: r }];
  }

  // slots[0], slots[1]: { c, sh, t0 } — a Let and when it began to gather; made: the result once it has
  const slots = [null, null];
  let made = null, fusion = null, pending = null;
  const now = () => performance.now() / 1000;

  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0) return;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, G.rgba(rgb, a)); gr.addColorStop(1, G.rgba(rgb, 0));
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function sprite(ctx, c, sh, g, t, alpha) {
    if (alpha <= 0) return;
    const F = sh.img.naturalHeight, frame = reduce ? 0 : Math.floor(t * 1000 / c.ms) % c.frames;
    const ox = g.x - g.s / 2, oy = g.y - g.s / 2, rt = reduce ? 0 : t;
    if (c.id === 'LET15') G.DarkletRing.paint(ctx, ox, oy, g.s, frame, rt, { front: false, opacity: alpha });
    ctx.globalAlpha = alpha;
    ctx.drawImage(sh.img, frame * F, 0, F, F, ox, oy, g.s, g.s);
    ctx.globalAlpha = 1;
    if (c.id === 'LET15') G.DarkletRing.paint(ctx, ox, oy, g.s, frame, rt, { front: true, opacity: alpha });
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
    sprite(ctx, c, sh, g, t, settled);
  }

  // ── the fusion: every grain of both, streaming in, turning, blooming, and settling as the result ──
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
    const ta = G.E[slots[0].c.type].rgb, tb = G.E[slots[1].c.type].rgb;
    fusion = { t0: t, P, a: slots[0], b: slots[1], r: pending, bloom: G.mix(G.mix(ta, tb, 0.5), WHITE, 0.72), ta, tb };
    pending = null;
  }

  const DONE = 3.35;
  function drawFusion(ctx, g, t) {
    const f = fusion, P = f.P, T = reduce ? 9 : t - f.t0;
    const [gA, gB, gC] = g, A = f.a.sh.pts, B = f.b.sh.pts, R = f.r.sh.pts, tr = G.E[f.r.c.type].rgb;
    // the makers' light goes out as theirs comes up
    const out = 1 - G.ease(T / 0.6);
    glow(ctx, gA.x, gA.y + gA.s * 0.14, gA.s * 0.62, f.ta, 0.22 * out);
    glow(ctx, gB.x, gB.y + gB.s * 0.14, gB.s * 0.62, f.tb, 0.22 * out);
    const bloomA = G.ease((T - 1.0) / 0.6) * (1 - G.ease((T - 2.2) / 0.6));
    glow(ctx, gC.x, gC.y, gC.s * 0.7, f.bloom, 0.3 * bloomA);
    glow(ctx, gC.x, gC.y + gC.s * 0.14, gC.s * 0.62, tr, 0.24 * G.ease((T - 2.3) / 0.8));
    // the makers themselves, for the moment before they come apart
    const whole = 1 - G.ease(T / 0.22);
    sprite(ctx, f.a.c, f.a.sh, gA, t, whole);
    sprite(ctx, f.b.c, f.b.sh, gB, t, whole);
    if (T < DONE) {
      const swirl = Math.max(0, T - 0.85) * 2.4;
      const spread = 1 + 0.55 * G.ease((T - 1.25) / 0.5) * (1 - G.ease((T - 2.0) / 0.6));
      const orbit = gC.s * 0.3, fade = 1 - G.ease((T - 2.85) / 0.45), show = G.ease(T / 0.22);
      const toBloom0 = G.ease((T - 1.05) / 0.6);
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
        const tb = toBloom0 * (1 - u3), sc = k * 3, tc = j * 3;
        let r = p.c[sc] + (f.bloom[0] - p.c[sc]) * tb, gg = p.c[sc + 1] + (f.bloom[1] - p.c[sc + 1]) * tb, b = p.c[sc + 2] + (f.bloom[2] - p.c[sc + 2]) * tb;
        r += (R.c[tc] - r) * u3; gg += (R.c[tc + 1] - gg) * u3; b += (R.c[tc + 2] - b) * u3;
        // more grains went in than the result is made of: the extra ones go out as it settles
        const extra = i >= R.n ? 1 - u3 : 1;
        const size = (gsA + (gsC - gsA) * u3) * (1 + 0.5 * tb);
        ctx.globalAlpha = 0.95 * show * fade * extra;
        ctx.fillStyle = color(r | 0, gg | 0, b | 0);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }
    sprite(ctx, f.r.c, f.r.sh, gC, t, G.ease((T - 2.75) / 0.45));
    if (T >= DONE) { made = { c: f.r.c, sh: f.r.sh }; fusion = null; settle(); }
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
    slotX = w < 520 ? [0.17, 0.83] : [0.2, 0.8];
    const g = geom(w, h);
    placeLabels(g);
    if (pending?.sh && slots[0]?.sh && slots[1]?.sh && (reduce || t >= slots[1].t0 + 1.35)) startFusion(t);
    if (fusion) { drawFusion(ctx, g, t); return; }
    if (made) { glow(ctx, g[2].x, g[2].y + g[2].s * 0.14, g[2].s * 0.62, G.E[made.c.type].rgb, 0.24); sprite(ctx, made.c, made.sh, g[2], t, 1); return; }
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

  // what the grid can do now: who's picked, and who the first pick fuses with
  function refresh() {
    const first = !fusion && !made && slots[0] && !slots[1] ? slots[0].c : null;
    const ok = first ? new Set(partners(first.type)) : null;
    grid.querySelectorAll('button').forEach((b) => {
      const c = byId[b.dataset.id];
      b.setAttribute('aria-pressed', slots.some((s) => s?.c === c));
      b.classList.toggle('is-dim', !!ok && c !== first && !ok.has(c.type));
    });
  }

  function settle() {
    const { a, b } = { a: slots[0].c, b: slots[1].c };
    const odds = Object.entries(pairs[key(a.type, b.type)]).sort((x, y) => y[1] - x[1]);
    const rest = odds.slice(1).map(([el, v]) => `${byEl[el].name} ${v}%`).join(' · ');
    const r = made.c;
    setFormula(`${tinted(a)}${op('+')}${tinted(b)}${op('→')}${tinted(r)}<span class="pct" style="color:${G.E[r.type].tint}">${odds[0][1]}%</span>${rest ? `<span class="odds">or ${rest}</span>` : ''}`, G.E[r.type].tint);
    describe(r);
    label(0, null); label(1, null);
    slots[0] = slots[1] = null;
    refresh();
  }

  function place(i, c) {
    const slot = { c, sh: null, t0: now() };
    slots[i] = slot;
    label(i, c);
    sheet(c).then((sh) => { if (slots[i] === slot) { slot.sh = sh; slot.t0 = now(); } });
  }

  function choose(id) {
    const c = byId[id];
    if (!c) return;
    if (fusion || made || pending) { fusion = made = pending = null; slots[0] = slots[1] = null; label(1, null); }
    if (!slots[0] || (slots[0].c === c && !slots[1])) {
      if (slots[0]?.c === c) { slots[0] = null; label(0, null); setFormula('<span class="formula-hint">Pick a Let</span>'); describe(null); refresh(); return; }
      start(c);
    } else if (!pairs[key(slots[0].c.type, c.type)]) {
      start(c); // these two don't fuse: begin again from this one
    } else {
      place(1, c);
      const odds = Object.entries(pairs[key(slots[0].c.type, c.type)]).sort((x, y) => y[1] - x[1]);
      const r = byEl[odds[0][0]];
      pending = { c: r, sh: null };
      const p = pending;
      sheet(r).then((sh) => { p.sh = sh; });
      setFormula(`${tinted(slots[0].c)}${op('+')}${tinted(c)}${op('→')}<span class="formula-hint">?</span>`, G.E[slots[0].c.type].tint);
    }
    refresh();
  }
  function start(c) {
    slots[1] = null; label(1, null);
    place(0, c);
    const n = partners(c.type).length;
    setFormula(`${tinted(c)}${op('+')}<span class="formula-hint">${n ? 'pick another' : 'fuses with nothing; it can only be made'}</span>`, G.E[c.type].tint);
    describe(c);
  }

  // ── start ──
  let userActed = false;
  Promise.all([fetch('/assets/data/lets.json').then((r) => r.json()), fetch('/assets/data/alchemy.json').then((r) => r.json())]).then(([data, alchemy]) => {
    pairs = alchemy.pairs;
    lets = data.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    for (const c of lets) { byId[c.id] = c; byEl[c.type] = c; }
    grid.innerHTML = lets.map((c) => `<li><button type="button" data-id="${c.id}" data-el="${c.type}" style="--c:${G.E[c.type].tint}" aria-pressed="false" aria-label="${c.name}">
      <span class="sprite" style="background-image:url(/assets/creatures/${c.id}.webp);--frames:${c.frames};--ms:${c.ms}ms"></span></button></li>`).join('');
    grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { userActed = true; choose(b.dataset.id); } });
    grid.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b) sheet(byId[b.dataset.id]); });
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
