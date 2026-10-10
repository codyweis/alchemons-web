/* The Valley's dissolve, off the main thread. valley.js hands over the canvas
   and the still; this builds the grains once and draws whatever scroll
   progress it is sent last, so the page never waits on it. */
const h = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const GOLD = [247, 226, 170];
const MAX_GRAINS = 420000;

let canvas, ctx, bitmap, FX, FY, RIFT, LIFE, reduce;
let W = 0, H = 0, data, out, base, space, cur;
let N = 0, gx, gy, gcol, gt, gvx, gvy, gseed;
let shown = 0;                  // grains whose ground currently shows the dark (in cur)
let built = false, wantP = 0, drawnP = -1, scheduled = false;

const raf = self.requestAnimationFrame ? (cb) => self.requestAnimationFrame(cb) : (cb) => setTimeout(cb, 16);

onmessage = ({ data: m }) => {
  if (m.type === 'init') {
    ({ canvas, bitmap, FX, FY, RIFT, LIFE, reduce } = m);
    ctx = canvas.getContext('2d', { alpha: false });
    build(m.vw, m.vh);
  } else if (m.type === 'resize') {
    build(m.vw, m.vh);
  } else if (m.type === 'p') {
    wantP = m.p;
    schedule();
  }
};

const noise = (x, y, cell) => {
  const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = h(x0 * 57 + y0, 9), b = h((x0 + 1) * 57 + y0, 9), c = h(x0 * 57 + y0 + 1, 9), d = h((x0 + 1) * 57 + y0 + 1, 9);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

function build(vw, vh) {
  if (!vw || !vh) return;
  const IW = bitmap.width, IH = bitmap.height;
  const bs = Math.max(1.5, Math.sqrt((vw * vh) / MAX_GRAINS)); // CSS px per grain
  W = Math.ceil(vw / bs); H = Math.ceil(vh / bs);
  canvas.width = W; canvas.height = H;
  data = ctx.createImageData(W, H);
  out = new Uint32Array(data.data.buffer);

  // the still, as object-fit: cover at its focal point
  const tmp = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
  const s = Math.max(W / IW, H / IH), dw = IW * s, dh = IH * s;
  tmp.drawImage(bitmap, (W - dw) * FX, (H - dh) * FY, dw, dh);
  base = new Uint32Array(tmp.getImageData(0, 0, W, H).data.buffer);
  cur = base.slice();
  shown = 0;

  // where the rift sits in the buffer
  const rx = (W - dw) * FX + RIFT[0] * dw, ry = (H - dh) * FY + RIFT[1] * dh;
  const maxD = Math.hypot(Math.max(rx, W - rx), Math.max(ry, H - ry));

  // the dark underneath: the game home's void, a few stars, a floor of teal grains
  space = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    const floor = Math.max(0, (y / H - 0.72) / 0.28);
    for (let x = 0; x < W; x++) {
      let r = 4, g = 7, b = 10;
      const n = h(x * 131 + y * 7919, 3);
      if (n > 0.9965) { const l = 120 + (n - 0.9965) / 0.0035 * 135; r = l * 0.85; g = l; b = l * 0.95; }
      else if (floor > 0 && n < floor * floor * 0.22) { const l = 0.35 + h(x, y) * 0.65; r = 60 * l; g = 170 * l; b = 160 * l; }
      space[y * W + x] = pack(r | 0, g | 0, b | 0);
    }
  }

  // each grain lets go when the unravelling from the rift reaches it
  N = W * H;
  const t = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dd = Math.hypot(x - rx, (y - ry) * 1.3) / maxD;
    const nn = noise(x, y, 22) * 0.65 + noise(x + 500, y, 6) * 0.35;
    t[y * W + x] = 0.04 + 0.62 * Math.min(1, 0.62 * dd + 0.38 * nn) + (h(x, y + 77) - 0.5) * 0.03;
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
    const r1 = h(x + 11, y + 5), r2 = h(x + 23, y + 41);
    // outward from the rift, lifting, with a turn about it
    const ax = x - rx, ay = y - ry, len = Math.hypot(ax, ay) || 1;
    const out_ = 0.35 + r1 * 0.4, lift = 0.45 + r2 * 0.6, turn = 0.35;
    gx[k] = x; gy[k] = y; gcol[k] = base[i]; gt[k] = t[i]; gseed[k] = r1 * 6.283;
    gvx[k] = ((ax / len) * out_ + (-ay / len) * turn + (r2 - 0.5) * 0.4) * travel;
    gvy[k] = ((ay / len) * out_ * 0.6 + (ax / len) * turn - lift) * travel;
  }
  built = true;
  // draw now, in this task, so the canvas never shows anything but the valley
  draw(wantP); drawnP = wantP;
  postMessage({ type: 'ready' });
}

// first index whose release time is at or after v
function lowerBound(v) {
  let lo = 0, hi = N;
  while (lo < hi) { const m = (lo + hi) >> 1; if (gt[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

function blend(idx, r, g, b, a) {
  const c = out[idx], cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
  out[idx] = pack(cr + (r - cr) * a | 0, cg + (g - cg) * a | 0, cb + (b - cb) * a | 0);
}

function draw(p) {
  // the ground under every released grain shows the dark; kept between frames
  const k = lowerBound(p);
  if (k > shown) for (let i = shown; i < k; i++) { const idx = gy[i] * W + gx[i]; cur[idx] = space[idx]; }
  else for (let i = k; i < shown; i++) { const idx = gy[i] * W + gx[i]; cur[idx] = base[idx]; }
  shown = k;
  out.set(cur);
  // only the grains still in flight move; the ones before them have gone
  for (let i = lowerBound(p - LIFE); i < k; i++) {
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

function schedule() {
  if (scheduled || !built) return;
  scheduled = true;
  raf(() => {
    scheduled = false;
    if (wantP !== drawnP) { draw(wantP); drawnP = wantP; }
  });
}
