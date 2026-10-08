/* Fusion Codex — the encyclopedia's element table, and its stage. Pick two
   elements: their orbs open, the grains stream together, turn, bloom pale and
   gather into what the formula makes, as the Codex plays it in the game.
   Formulas come from the game's own recipe table (assets/data/alchemy.json). */
(() => {
  const G = window.Grains;
  const root = document.getElementById('alchemy');
  const stageCanvas = document.getElementById('fusion-stage');
  const formula = document.getElementById('formula');
  const factionsEl = document.getElementById('factions');
  if (!root || !G) return;

  const FACTIONS = [
    ['Volcanic', '#ff5a4f', ['Fire', 'Lava', 'Lightning']],
    ['Oceanic', '#4aa6ff', ['Water', 'Ice', 'Steam']],
    ['Earthen', '#b9a08c', ['Earth', 'Mud', 'Dust', 'Crystal']],
    ['Verdant', '#5fd66b', ['Air', 'Plant', 'Poison']],
    ['Arcane', '#c46bff', ['Spirit', 'Light', 'Dark', 'Blood']],
  ];
  const ORDER = ['Fire', 'Water', 'Earth', 'Air', 'Steam', 'Lava', 'Lightning', 'Mud', 'Ice', 'Dust', 'Crystal', 'Plant', 'Poison', 'Spirit', 'Dark', 'Light', 'Blood'];
  const key = (a, b) => [a, b].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)).join('+');

  let pairs = {};
  const partners = (a) => ORDER.filter((b) => b !== a && pairs[key(a, b)]);

  // ── the table ──
  factionsEl.innerHTML = FACTIONS.map(([name, color, els]) => `
    <div class="faction" style="--fc:${color}">
      <p class="faction-head">${name}</p>
      <div class="cells">${els.map((e) => `<button class="cell" type="button" data-el="${e}" style="--c:${G.E[e].tint}" aria-pressed="false"><canvas aria-hidden="true"></canvas><span>${e}</span></button>`).join('')}</div>
    </div>`).join('');
  const cells = [...factionsEl.querySelectorAll('.cell')];
  const cellOrbs = new Map();

  G.whileVisible(factionsEl, (t) => {
    for (const cell of cells) {
      const cv = cell.querySelector('canvas');
      const { ctx, w, h } = G.fit(cv);
      const r = Math.min(w, h) * 0.27;
      let orb = cellOrbs.get(cell);
      if (!orb || Math.abs(orb.radius - r) > 0.5) { orb = new G.Orb(cell.dataset.el, r); cellOrbs.set(cell, orb); }
      ctx.clearRect(0, 0, w, h);
      orb.paint(ctx, w / 2, h * 0.52, G.reduceMotion ? 0 : t);
    }
  }, { fps: 30 });

  // ── the stage ──
  let pick = [];          // chosen elements
  let show = null;        // { kind: 'orb', el } | { kind: 'fuse', a, b, result, t0 }
  let resultOrb = null, srcA = null, srcB = null, P = null;
  let userActed = false;

  function setFormula(html, tint) {
    formula.innerHTML = html;
    root.querySelector('.codex-stage').style.setProperty('--tint', tint || '#e9c46a');
  }
  const op = (s) => `<span class="op">${s}</span>`;

  function refreshCells() {
    const ok = pick.length === 1 ? new Set(partners(pick[0])) : null;
    for (const c of cells) {
      const e = c.dataset.el;
      c.setAttribute('aria-pressed', pick.includes(e));
      c.classList.toggle('is-dim', !!ok && e !== pick[0] && !ok.has(e));
    }
  }

  function choose(e) {
    userActed = true;
    if (pick.length === 1 && pick[0] === e) { pick = []; show = null; setFormula('<span class="formula-hint">Pick an element</span>'); refreshCells(); return; }
    if (pick.length !== 1 || !pairs[key(pick[0], e)]) {
      pick = [e];
      show = { kind: 'orb', el: e };
      const n = partners(e).length;
      setFormula(`${e}${op('⊕')}<span class="formula-hint">${n ? 'pick another' : 'fuses with nothing yet'}</span>`, G.E[e].tint);
      refreshCells();
      return;
    }
    fuse(pick[0], e);
  }

  function fuse(a, b) {
    pick = [a, b];
    refreshCells();
    const odds = pairs[key(a, b)];
    const sorted = Object.entries(odds).sort((x, y) => y[1] - x[1]);
    const [result, pct] = sorted[0];
    show = { kind: 'fuse', a, b, result, t0: performance.now() / 1000 };
    resultOrb = null; P = null;
    setFormula(`${a}${op('⊕')}${b}${op('→')}<span style="color:${G.E[result].tint}">?</span>`, G.E[a].tint);
    show.done = () => {
      const rest = sorted.slice(1).map(([k, v]) => `${k} ${v}%`).join(' · ');
      setFormula(`${a}${op('⊕')}${b}${op('→')}<span style="color:${G.E[result].tint}">${result}</span><span class="pct" style="color:${G.E[result].tint}">${pct}%</span>${rest ? `<span class="odds">or ${rest}</span>` : ''}`, G.E[result].tint);
      pick = [];
      refreshCells();
    };
  }

  factionsEl.addEventListener('click', (ev) => {
    const c = ev.target.closest('.cell');
    if (c) choose(c.dataset.el);
  });

  // particles for a fusion: half from each maker, landing on the result orb's grains
  function setupFusion(w, h, t) {
    const R = Math.min(h * 0.22, 70);
    resultOrb = new G.Orb(show.result, R);
    srcA = new G.Orb(show.a, R * 0.8);
    srcB = new G.Orb(show.b, R * 0.8);
    const n = resultOrb.length;
    P = {
      n, R,
      from: new Uint8Array(n), si: new Uint16Array(n), delay: new Float32Array(n),
      ang: new Float32Array(n), rr: new Float32Array(n), d2: new Float32Array(n),
      tc: resultOrb.tones.map((c) => c),
      bloom: G.mix(G.mix(G.E[show.a].rgb, G.E[show.b].rgb, 0.5), [255, 255, 255], 0.72),
    };
    for (let i = 0; i < n; i++) {
      const fromA = i % 2 === 0;
      P.from[i] = fromA ? 0 : 1;
      P.si[i] = Math.floor(i / 2) % (fromA ? srcA.length : srcB.length);
      P.ang[i] = G.h(i, 21) * Math.PI * 2;
      P.rr[i] = Math.sqrt(G.h(i, 22));
      P.delay[i] = G.h(i, 23) * 0.35;
      P.d2[i] = G.h(i, 24) * 0.3;
    }
  }

  function drawStage(t) {
    const { ctx, w, h } = G.fit(stageCanvas);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.44;
    const tt = G.reduceMotion ? 0 : t;
    if (!show) return;
    if (show.kind === 'orb') {
      const o = show.orb && show.orb.element === show.el ? show.orb : (show.orb = new G.Orb(show.el, Math.min(h * 0.22, 70)));
      o.paint(ctx, cx, cy, tt);
      return;
    }
    if (!P) setupFusion(w, h, t);
    const T = G.reduceMotion ? 9 : t - show.t0;
    if (T >= 3.6) {
      resultOrb.paint(ctx, cx, cy, tt);
      if (show.done) { show.done(); show.done = null; }
      return;
    }
    const sep = Math.min(w * 0.3, P.R * 4.2);
    const ax = cx - sep, bx = cx + sep;
    // the makers in their glass, the glass going
    const glass = 1 - G.ease((T - 0.35) / 0.45);
    if (glass > 0) {
      srcA.paint(ctx, ax, cy, tt, { opacity: glass, grains: false });
      srcB.paint(ctx, bx, cy, tt, { opacity: glass, grains: false });
    }
    srcA.layout(tt); srcB.layout(tt); resultOrb.layout(tt);
    const resGlass = G.ease((T - 2.9) / 0.6);
    if (resGlass > 0) resultOrb.paint(ctx, cx, cy, tt, { opacity: resGlass, grains: false });
    const d = resultOrb.grainSize;
    const swirl = Math.max(0, T - 1.15) * 2.4;
    const bloomR = 1 + 0.65 * G.ease((T - 1.6) / 0.5) * (1 - G.ease((T - 2.25) / 0.6));
    for (let i = 0; i < P.n; i++) {
      const src = P.from[i] ? srcB : srcA, si = P.si[i];
      const sx = (P.from[i] ? bx : ax) + src.x[si], sy = cy + src.y[si];
      const scol = src.tones[src.tone[si]];
      // to the middle, round it, out pale, then into the result
      const u1 = G.ease((T - 0.55 - P.delay[i]) / 0.75);
      const a = P.ang[i] + swirl * (0.7 + 0.6 * P.rr[i]);
      const mr = P.R * 0.95 * P.rr[i] * bloomR;
      const mx = cx + Math.cos(a) * mr, my = cy + Math.sin(a) * mr * 0.9;
      let x = sx + (mx - sx) * u1, y = sy + (my - sy) * u1;
      const u3 = G.ease((T - 2.3 - P.d2[i]) / 0.75);
      const tx = cx + resultOrb.x[i], ty = cy + resultOrb.y[i];
      x += (tx - x) * u3; y += (ty - y) * u3;
      const toBloom = G.ease((T - 1.35) / 0.6) * (1 - u3);
      let col = G.mix(scol, P.bloom, toBloom);
      col = G.mix(col, P.tc[resultOrb.tone[i]], u3);
      const size = d * (1 + 0.5 * toBloom);
      ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  G.whileVisible(stageCanvas, drawStage, { fps: 60 });

  // first time it comes into view, play the one the Codex opens on
  fetch('/assets/data/alchemy.json').then((r) => r.json()).then((d) => {
    pairs = d.pairs;
    new IntersectionObserver(([en], io) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (userActed) return;
      pick = ['Fire'];
      refreshCells();
      setTimeout(() => { if (!userActed) fuse('Fire', 'Water'); }, 500);
    }, { threshold: 0.4 }).observe(stageCanvas);
  }).catch(() => setFormula('<span class="formula-hint">The codex could not be opened.</span>'));
})();
