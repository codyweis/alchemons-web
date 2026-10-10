/* The Valley, live — the game's Valley field drawn in code, as the game draws
   it (lib/games/wilderness/field/valley_field.dart on grain_field.dart and
   field_art.dart, the rift from lib/widgets/fx/rift_vortex.dart).

   Ridge after ridge steps out of the haze, each a little darker and nearer,
   down to a meadow of grass made of grains. The light follows the visitor's
   clock: the sun rises on the left and sets on the right, lighting the edges
   of everything when it is low behind them; at night the moon (in its real
   phase) and the stars take over, and the motes over the grass become
   fireflies. A finger (or a mouse) through the meadow parts the grass and it
   springs back. High in the sky, the rift.

   The game bakes its still sheets as maps and grades them for the hour; here
   they are baked straight in the hour's color, and baked again when the hour
   has moved on. The grass, motes, glints, clouds and the rift are live.
   Everything is laid out in the game's own px, as on a phone held sideways
   (REF tall), and the same random numbers lay it out, so it is the same place. */
(() => {
  const TAU = Math.PI * 2, { sin, cos, exp, sqrt, pow, min, max, floor, ceil, round, abs } = Math;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mod = (a, n) => ((a % n) + n) % n;              // Dart's %: never negative
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const hex = (s) => [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
  const css = (c, a = 1) => `rgba(${round(clamp(c[0], 0, 1) * 255)},${round(clamp(c[1], 0, 1) * 255)},${round(clamp(c[2], 0, 1) * 255)},${clamp(a, 0, 1).toFixed(4)})`;
  const WHITE = [1, 1, 1], BLACK = [0, 0, 0];

  // The game's px: its screen is REF tall on a phone held sideways, and its
  // unit (_u) is a 475th of that. Grains, trees and clouds are sized in units.
  const REF = 402, U = REF / 475;

  // ── field_art.dart ─────────────────────────────────────────────────────────

  const hash = (i, seed) => {
    let h = (Math.imul(i, 374761393) + Math.imul(seed, 668265263)) & 0x7fffffff;
    h = Math.imul(h ^ (h >> 13), 1274126177) & 0x7fffffff;
    h ^= h >> 16;
    return (h & 0xffffff) / 0x1000000;
  };
  // Smooth value noise in [-1, 1] that repeats exactly every period.
  const loopNoise = (x, wave, seed, period) => {
    const n = max(1, round(period / wave)), u = x / period * n, i = floor(u), f = u - i, s = f * f * (3 - 2 * f);
    const a = hash(mod(i, n), seed), b = hash(mod(i + 1, n), seed);
    return (a + (b - a) * s) * 2 - 1;
  };
  // Dart's Random(seed), number for number, so every tree stands where it does in the game.
  class Rand {
    constructor(seed) {
      const M = (1n << 64n) - 1n;
      let n = BigInt.asUintN(64, BigInt(seed));
      n = (~n + (n << 21n)) & M; n ^= n >> 24n; n = (n * 265n) & M; n ^= n >> 14n; n = (n * 21n) & M; n ^= n >> 28n; n = (n + (n << 31n)) & M;
      if (n === 0n) n = 0x5a17n;
      this.lo = Number(n & 0xffffffffn); this.hi = Number(n >> 32n);
      for (let i = 0; i < 4; i++) this.step();
    }
    step() { // multiply with carry, A = 0xffffda61, in 16-bit halves so nothing overflows a double
      const ll = this.lo & 0xffff, lh = this.lo >>> 16;
      const p1 = 0xffff * ll + 0xda61 * lh, low = 0xda61 * ll + (p1 % 65536) * 65536 + this.hi;
      this.lo = low % 4294967296;
      this.hi = 0xffff * lh + floor(p1 / 65536) + floor(low / 4294967296);
    }
    next() { this.step(); const a = this.lo & 0x3ffffff; this.step(); return (a * 134217728 + (this.lo & 0x7ffffff)) / 9007199254740992; }
    range(a, b) { return a + (b - a) * this.next(); }
  }

  // Grains in buckets, each bucket drawn as one path of dots.
  class Batch {
    constructor(n) { this.p = Array.from({ length: n }, () => new Float32Array(256)); this.n = new Int32Array(n); }
    clear() { this.n.fill(0); }
    add(b, x, y) {
      let p = this.p[b];
      const i = this.n[b] * 2;
      if (i + 2 > p.length) { const q = new Float32Array(p.length * 2); q.set(p); this.p[b] = p = q; }
      p[i] = x; p[i + 1] = y; this.n[b]++;
    }
    draw(c, b, d, color) {
      const n = this.n[b] * 2;
      if (!n) return;
      const p = this.p[b], r = d / 2;
      c.fillStyle = color; c.beginPath();
      for (let i = 0; i < n; i += 2) { c.moveTo(p[i] + r, p[i + 1]); c.arc(p[i], p[i + 1], r, 0, TAU); }
      c.fill();
    }
  }

  // ── The Valley's day ───────────────────────────────────────────────────────

  const STOPS = [0, 0.16, 0.30, 0.40, 0.47, 0.52, 0.565, 0.6, 1];
  const key = (o) => ({ ...o, sky: o.sky.split(' ').map(hex), grass: o.grass.split(' ').map(hex),
    ambient: hex(o.ambient), rim: hex(o.rim), cloudTop: hex(o.cloudTop), cloudBottom: hex(o.cloudBottom), cloudGlint: hex(o.cloudGlint), mote: hex(o.mote) });
  const NIGHT = key({ sky: '03060F 060B1A 0B1328 111B36 172341 1B2948 1F2E4E 223252 223252', ambient: '21263D', rim: '9FB4E0', rimStrength: 0.2, floor: 0.35, glow: 0, stars: 1,
    cloudTop: '0C1222', cloudBottom: '1C2640', cloudGlint: '7E92BE', grass: '05080A 080D11 0C1318 111A21 18242E 22334A 34496A 5E7AA4', mote: 'D2F57E', firefly: 1 });
  const PREDAWN = key({ sky: '04081A 08102A 0F1A3A 18254A 232F55 2E385E 3A4166 44496C 44496C', ambient: '292D46', rim: 'A8B6E0', rimStrength: 0.18, floor: 0.3, glow: 0.1, stars: 0.85,
    cloudTop: '121A2E', cloudBottom: '2A3050', cloudGlint: '8A94C0', grass: '06090B 0A0F13 0F161B 151E25 1D2832 2A384C 3E4E6C 6A7CA0', mote: 'D2F57E', firefly: 0.9 });
  const DAWN = key({ sky: '0A1430 142246 22345C 3A4670 5E5878 8E6A7E C08884 DCA08A DCA08A', ambient: '4C4A61', rim: 'F2A6A0', rimStrength: 0.5, floor: 0.1, glow: 0.55, stars: 0.25,
    cloudTop: '3A3F62', cloudBottom: 'D89A98', cloudGlint: 'FFC8C0', grass: '0C1214 121A1C 1A2524 25322C 384234 5A5A44 8C7A66 C6A090', mote: 'FFD6C8', firefly: 0.4 });
  const SUNRISE = key({ sky: '1C3462 2A4A7C 44659A 7486AE B49CA6 E8B48E FFCF96 FFDDA6 FFDDA6', ambient: '8C807A', rim: 'FFD08E', rimStrength: 0.95, floor: 0.1, glow: 1, stars: 0,
    cloudTop: '6E7898', cloudBottom: 'FFC898', cloudGlint: 'FFE6B0', grass: '121A12 1A2618 26341F 384728 556032 84803F BFA25C F2D490', mote: 'FFE6AC', firefly: 0 });
  const MORNING = key({ sky: '2D5C9A 3C6EAA 5686BA 7EA2CA A4BED6 C6D3DE DADFE0 E4E4DE E4E4DE', ambient: 'DBDBD6', rim: 'FFF0D0', rimStrength: 0.32, floor: 0.5, glow: 0.5, stars: 0,
    cloudTop: 'F4F4F2', cloudBottom: 'B8C2D0', cloudGlint: 'C0A070', grass: '1A2814 263A1A 344E22 46642A 5C7C34 7A9640 9EB054 C6CC7C', mote: 'FFF6DC', firefly: 0 });
  const DAY = key({ sky: '22528F 3268A6 4C80B8 72A0CA 9ABBD8 BAD0E2 CEDDE8 D8E4EC D8E4EC', ambient: 'FFFFFF', rim: 'FFFFFF', rimStrength: 0.2, floor: 0.8, glow: 0.35, stars: 0,
    cloudTop: 'FBFCFE', cloudBottom: 'BCC8D6', cloudGlint: 'B89A62', grass: '1C2C14 28401A 365622 486E2A 5E8634 7CA040 A2BA56 CCD686', mote: 'FFF8E4', firefly: 0 });
  const AFTERNOON = key({ sky: '23497F 335C94 4E76A8 7894B8 A8AEBE D2BCA8 EACCA2 F2D6AA F2D6AA', ambient: 'D9C7A8', rim: 'FFD69A', rimStrength: 0.55, floor: 0.3, glow: 0.7, stars: 0,
    cloudTop: 'E8E2E0', cloudBottom: 'D6A88C', cloudGlint: 'FFE0B0', grass: '182412 223419 304820 455E28 627034 8E8C44 C0AA60 EED494', mote: 'FFEAB8', firefly: 0 });
  const GOLDEN = key({ sky: '0E1D40 172C55 273F6C 4A5680 8E7E92 D49C7C F2B672 FFD898 FFD898', ambient: '66574D', rim: 'FFD48E', rimStrength: 1, floor: 0.06, glow: 1, stars: 0,
    cloudTop: '2C3354', cloudBottom: 'E8A67C', cloudGlint: 'FFDDA0', grass: '0E1510 151F17 1F2B1E 2F3B25 4D552F 80763F BE9F5C F0D08A', mote: 'FFE1A0', firefly: 0 });
  const SUNSET = key({ sky: '0A1534 12214A 22305E 3E3E6A 7A5470 C46E62 EC9058 FFB068 FFB068', ambient: '42333A', rim: 'FFA868', rimStrength: 0.95, floor: 0.06, glow: 1, stars: 0.05,
    cloudTop: '22284A', cloudBottom: 'F08A66', cloudGlint: 'FFC08A', grass: '0B100E 121813 1A2219 262E20 3E3E28 6A5A36 A87A48 E09C62', mote: 'FFC890', firefly: 0.1 });
  const DUSK = key({ sky: '050A1C 09112A 121C3C 1E2649 2E3052 463A58 5E465C 6A4E5E 6A4E5E', ambient: '262436', rim: 'E89A9A', rimStrength: 0.24, floor: 0.2, glow: 0.4, stars: 0.55,
    cloudTop: '121628', cloudBottom: '3E3550', cloudGlint: 'A88090', grass: '06090B 0A0F12 0F161A 151E24 1E2830 2C3646 44465E 706078', mote: 'DCF08A', firefly: 0.7 });
  // The night window lines up with the encounter tables' (20:00–05:00).
  const KEYS = [[0, NIGHT], [4.4, NIGHT], [5.0, PREDAWN], [5.6, DAWN], [6.4, SUNRISE], [7.8, MORNING], [10, DAY], [15.5, DAY],
    [17.6, AFTERNOON], [18.7, GOLDEN], [19.4, SUNSET], [20.1, DUSK], [21, NIGHT], [24, NIGHT]];

  function lightAt(hour) {
    const h = mod(hour, 24);
    for (let i = 1; i < KEYS.length; i++) {
      const [h1, b] = KEYS[i];
      if (h > h1) continue;
      const [h0, a] = KEYS[i - 1], u = clamp((h - h0) / (h1 - h0), 0, 1), t = u * u * (3 - 2 * u);
      const o = {};
      for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : Array.isArray(a[k][0]) ? a[k].map((c, j) => mix(c, b[k][j], t)) : mix(a[k], b[k], t);
      return o;
    }
    return NIGHT;
  }
  const skyAt = (l, f) => {
    for (let i = 1; i < STOPS.length; i++) if (f <= STOPS[i]) return mix(l.sky[i - 1], l.sky[i], (f - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]));
    return l.sky[STOPS.length - 1];
  };
  // The moon's age through its cycle, 0 new → 0.5 full → 1 new.
  const lunarPhase = (d) => mod((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588853, 1);

  // ── The Valley's layers ────────────────────────────────────────────────────

  // Parallax factors and loops, as the scene has them (a world 1400 round).
  const LAYERS = { far: { pf: 0.1, k: 1.0 }, hills: { pf: 0.35, k: 0.9 }, meadow: { pf: 1.0, k: 0.85 }, fore: { pf: 1.6, k: 0.85 } };
  for (const n in LAYERS) LAYERS[n].P = 1400 * (1 + LAYERS[n].pf);
  const PF = LAYERS.far.P, PH = LAYERS.hills.P, PM = LAYERS.meadow.P;

  // Daylight colors of the land; the hour's ambient light multiplies them.
  const ALBEDO = { ranges: hex('5E6E8E'), hillFar: hex('48606C'), hill: hex('3E5E46'), ground: hex('50703A'), tree: hex('2A432E') };
  const SPARK_ALPHA = [0.35, 0.55, 0.8, 1.0];
  const TREES = [[96, 1.0, 1], [1180, 0.82, 2], [1960, 0.92, 3]];   // the meadow's great trees: x, scale, seed

  // The rift's colors, from the Valley's faction (earthen).
  const RIFT = (() => {
    const base = hex('FF8F00'), cream = hex('FFF4E6');
    return { tones: [mix(base, BLACK, 0.62), mix(base, BLACK, 0.34), base, mix(base, cream, 0.3), mix(base, cream, 0.58), mix(base, WHITE, 0.85)],
      glow: mix(base, cream, 0.25), tint: mix(base, hex('050507'), 0.86) };
  })();

  function create(canvas, opts = {}) {
    const reduce = !!opts.reduceMotion;
    const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Layout, in the game's px: the band height h the field's fractions are of,
    // extra sky oy above it on a tall screen, and k CSS px to each game px.
    let W = 0, H = 0, dpr = 1, k = 1, vw = 0, h = REF, oy = 0, mg = 0, ready = false;
    const V = { far: 0, hills: 0, meadow: 0, fore: 0 };
    let riftX = 0, riftY = 0;
    let L = DAY, hour = 12, bakedHour = -99, phase = 0.5, hourAt = -1e9;
    let sunX = 0.5, sunUp = 0, moonX = 0.5, moonUp = -1;
    const S = {};                                      // baked sheets
    const glints = { far: [], hills: [], meadow: [] }; // packed per bake
    let G = {};                                        // the hour's grades
    let cols = {};                                     // the hour's live colors
    let t = 0, lastT = null, par = 0, parTo = 0;
    const scene = { focus: { fx: 0.5, fy: 0.5 } };

    // ── grades: what the game's color matrices make of a sheet's maps ──
    function grades(l) {
      const hazeHigh = skyAt(l, 0.44), hazeLow = skyAt(l, 0.585);
      const sil = (a) => [a[0] * l.ambient[0], a[1] * l.ambient[1], a[2] * l.ambient[2]];
      const fleck = (s, q) => s.map((v, i) => v * 0.9 + l.rim[i] * l.rimStrength * q);
      const diff = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const g = {};
      for (const n of ['ranges', 'hillFar']) { const s = sil(ALBEDO[n]); g[n] = [s, diff(hazeHigh, s), fleck(s, 0.3), diff(hazeLow, hazeHigh)]; }
      for (const n of ['hill', 'ground', 'tree']) { const s = sil(ALBEDO[n]); g[n] = [s, diff(hazeLow, s), fleck(s, 0.4), s.map((v) => v * -0.72)]; }
      g.cloud = [l.cloudTop, diff(l.cloudBottom, l.cloudTop), l.cloudGlint.map((v) => v * 0.85), [0, 0, 0]];
      return g;
    }
    let grade = G.ranges;
    const map = (r, g, b, a = 1) => {
      r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);
      const [o, R, Gc, B] = grade;
      return css([o[0] + r * R[0] + g * Gc[0] + b * B[0], o[1] + r * R[1] + g * Gc[1] + b * B[1], o[2] + r * R[2] + g * Gc[2] + b * B[2]], a);
    };
    const white = (a) => `rgba(255,255,255,${a})`;

    // ── the hour: the light, and where the sun and moon are ──
    function setHour(hr) {
      hour = mod(hr, 24);
      L = lightAt(hour);
      const f = (hour - 6) / 13.5;
      sunX = 0.18 + 0.64 * clamp(f, -0.1, 1.1);
      sunUp = f < 0 || f > 1 ? -min(abs(f), abs(f - 1)) * 3 : sin(f * Math.PI);
      const fm = mod(hour - 20, 24) / 9.5;
      moonX = 0.16 + 0.68 * clamp(fm, 0, 1);
      moonUp = fm <= 1 ? sin(fm * Math.PI) * 0.82 : -1;
      phase = lunarPhase(opts.date instanceof Date ? opts.date : new Date());
      G = grades(L);
    }
    const clockHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };

    // The light falling at CSS x on screen: by day the sun, even just below the horizon; by night the moon.
    function rimAlpha(xs, lk) {
      if (L.rimStrength <= 0.01) return 0;
      const src = sunUp < -0.3 && moonUp > -0.2 ? moonX : sunX, d = (xs - src * W) / (W * 0.5);
      return clamp(L.rimStrength * (L.floor + (1 - L.floor) * exp(-d * d)) * lk, 0, 1);
    }

    // ── ridges, in the layer's own px (the game's _range, _hillFar, _hill, _groundLine) ──
    const nf = (x, w, s) => loopNoise(x, w, s, PF), nh = (x, w, s) => loopNoise(x, w, s, PH), nm = (x, w, s) => loopNoise(x, w, s, PM);
    const ridged = (x, w, s) => 1 - abs(nf(x, w, s));
    const range = (i, x) => i === 0 ? h * (0.535 - 0.11 * pow(ridged(x, 240, 11), 1.6) - 0.025 * nf(x, 70, 12) - 0.006 * nf(x, 21, 13))
      : i === 1 ? h * (0.588 - 0.06 * pow(ridged(x, 175, 14), 1.4) - 0.014 * nf(x, 55, 15) - 0.004 * nf(x, 17, 16))
      : h * (0.632 - 0.035 * (nf(x, 200, 17) * 0.5 + 0.5) - 0.01 * nf(x, 60, 18));
    const hillFar = (x) => h * (0.672 - 0.04 * (nh(x, 210, 31) * 0.5 + 0.5) - 0.01 * nh(x, 60, 32));
    const hill = (x) => h * (0.716 - 0.045 * (nh(x, 230, 33) * 0.5 + 0.5) - 0.014 * nh(x, 70, 34) - 0.004 * nh(x, 19, 35));
    const groundLine = (x) => h * (0.818 + 0.016 * nm(x, 260, 41) + 0.006 * nm(x, 75, 42));

    // ── baking: a sheet is the window of a layer on screen (plus a margin for
    // the parallax), drawn at device resolution. Things are laid out round
    // the whole loop, as in the game, and drawn where they show. ──
    let WA = 0, WB = 0, SH = [0], sink = null;
    function bounds(a, b, P) {
      WA = a; WB = b; SH = [];
      for (let q = floor((a - 600) / P); q <= floor((b + 600) / P); q++) SH.push(q * P);
    }
    const place = (x, reach, fn) => { for (const s of SH) { const X = x + s; if (X + reach >= WA && X - reach <= WB) fn(X); } };
    const glint = (x, y) => { if (sink && x >= WA - 8 && x <= WB + 8) sink.push(x, y); };

    function sheet(a, b, y0, y1, res) {
      let s = k * dpr * res;
      s = min(s, sqrt(16e6 / ((b - a) * (y1 - y0))), 16000 / (b - a));
      const cv = document.createElement('canvas');
      cv.width = max(1, ceil((b - a) * s)); cv.height = max(1, ceil((y1 - y0) * s));
      const c = cv.getContext('2d');
      c.setTransform(s, 0, 0, s, -a * s, -y0 * s);
      return { cv, c, a, b, y0, y1, s };
    }
    // A light sheet: [paint] in white, tinted column by column with the light that falls there.
    let tmp = null;
    function lit(sh, layer, paint) {
      if (L.rimStrength <= 0.01) return;
      if (!tmp || tmp.cv.width !== sh.cv.width || tmp.cv.height !== sh.cv.height) {
        tmp = { cv: document.createElement('canvas') };
        tmp.cv.width = sh.cv.width; tmp.cv.height = sh.cv.height; tmp.c = tmp.cv.getContext('2d');
      }
      const c = tmp.c;
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, tmp.cv.width, tmp.cv.height);
      c.setTransform(sh.s, 0, 0, sh.s, -sh.a * sh.s, -sh.y0 * sh.s);
      paint(c);
      const g = c.createLinearGradient(sh.a, 0, sh.b, 0), lk = LAYERS[layer].k;
      for (let i = 0; i <= 40; i++) {
        const x = sh.a + (sh.b - sh.a) * i / 40;
        g.addColorStop(i / 40, css(L.rim, rimAlpha((x - V[layer]) * k, lk)));
      }
      c.globalCompositeOperation = 'source-in'; c.fillStyle = g; c.fillRect(sh.a, sh.y0, sh.b - sh.a, sh.y1 - sh.y0);
      sh.c.save(); sh.c.setTransform(1, 0, 0, 1, 0, 0); sh.c.drawImage(tmp.cv, 0, 0); sh.c.restore();
    }

    // ── shared drawing (grain_field.dart) ──
    function ridgePath(c, x0, x1, ridge, step) {
      c.moveTo(x0, ridge(x0));
      for (let x = x0; x <= x1; x += step) c.lineTo(x, ridge(x));
      c.lineTo(x1, ridge(x1));
    }
    function fillRidge(c, ridge, fill, bottom, step) {
      c.beginPath(); ridgePath(c, WA - 4, WB + 4, ridge, step);
      c.lineTo(WB + 4, bottom); c.lineTo(WA - 4, bottom); c.closePath();
      c.fillStyle = fill; c.fill();
    }
    const vgrad = (c, y0, y1, stops) => { const g = c.createLinearGradient(0, y0, 0, y1); for (const [s, col] of stops) g.addColorStop(s, col); return g; };
    // Light through a ridge's top edge: bands of white hanging from it.
    function rimBands(c, ridge, bands) {
      const step = 3 * U;
      for (const [depth, a] of bands) {
        c.beginPath(); ridgePath(c, WA - 4, WB + 4, ridge, step);
        for (let x = WB + 4; x >= WA - 4; x -= step) c.lineTo(x, ridge(x) + depth * U);
        c.closePath(); c.fillStyle = white(a); c.fill();
      }
    }
    function rimSparkle(sparks, w, ridge, seed) {
      const step = 2.4 * U;
      let i = 0;
      for (let x = 0; x < w; x += step, i++) {
        const roll = hash(i, seed * 13);
        if (roll > 0.3) continue;
        place(x, 2, (X) => sparks.add(clamp(floor(roll * 10), 0, 3), X, ridge(X) + 0.6 * U));
      }
    }
    const drawSparks = (c, sparks, size) => { for (let i = 0; i < 4; i++) sparks.draw(c, i, size * U, white(SPARK_ALPHA[i])); };
    function mistBand(c, top, bottom, a) {
      c.fillStyle = vgrad(c, top, bottom, [[0, map(1, 0, 1, 0)], [0.62, map(1, 0, 1, a)], [1, map(1, 0, 1, 0)]]);
      c.fillRect(WA - 4, top, WB - WA + 8, bottom - top);
    }

    // A cloud: a soft body shaded from its top to its underside, with grains
    // glittering along the underside where a low sun catches it.
    function cloud(c, grains, cx, cy, width, height, low, seed, sheetW) {
      if (cx + width < 0 || cx - width > sheetW) return;
      const r = new Rand(seed), n0 = 4 + floor(r.next() * 4), lobes = [];
      for (let i = 0; i < n0; i++) {
        const q = (i + 0.5) / n0, rx = width / n0 * r.range(0.9, 1.4), ry = height * (0.4 + 0.6 * sin(q * Math.PI)) * r.range(0.8, 1.1);
        lobes.push([cx + (q - 0.5) * width * 0.85, cy - ry * 0.45, rx, ry]);
      }
      let top = cy, base = cy;
      for (const [, oy_, , ry] of lobes) { top = min(top, oy_ - ry); base = max(base, oy_ + ry); }
      // Soft edges without a blur: the body three times, each a little larger and fainter.
      for (const [grow, a] of [[1.1, 0.2], [1.04, 0.4], [1.0, 0.8]]) {
        c.beginPath();
        for (const [ox, oy_, rx, ry] of lobes) { c.moveTo(ox + rx * grow, oy_); c.ellipse(ox, oy_, rx * grow, ry * grow, 0, 0, TAU); }
        c.fillStyle = vgrad(c, top, base, [[0, map(0, 0, 0, a)], [0.5, map(0.25, 0, 0, a)], [1, map(0.6 + 0.4 * low, 0, 0, a)]]);
        c.fill();
      }
      const sp = 1.7 * U, n = round(width * height * 1.3 / (sp * sp));
      for (let i = 0; i < n; i++) {
        const x = cx + (r.next() - 0.5) * width * 1.2, y = top + r.next() * (base - top);
        let d = 9;
        for (const [ox, oy_, rx, ry] of lobes) { const dx = (x - ox) / rx, dy = (y - oy_) / ry; d = min(d, dx * dx + dy * dy); }
        if (d > 1.05) continue;
        const v = clamp((y - top) / (base - top), 0, 1);
        if (r.next() > v * v * v) continue;
        const tone = round(pow(v, 1.4) * (0.5 + 0.5 * low) * 4 + r.next() * 0.9 - 1.4);
        if (tone < 0) continue;
        grains.add(min(tone, 3), x, y);
        if (tone >= 1 && x >= 0 && x < sheetW && r.next() < 0.09) sink.push(x, y);
      }
    }

    // Distant grass on a slope: tufts of three grains, their tips catching the light near the crest.
    function tufts(c, w, ridge, count, seed) {
      const b = new Batch(4), r = new Rand(seed * 4211), depth = 22 * U;
      for (let i = 0; i < count; i++) {
        const x = r.next() * w, d = -Math.log(1 - r.next() * 0.99) * depth, y = ridge(x) + 3 * U + d;
        const near = exp(-d / (depth * 0.5)), lean = r.range(-0.4, 0.6) * U;
        for (let j = 0; j < 3; j++) {
          const tip = j === 2 ? near * 3.4 : near * (1.2 + j), tone = clamp(round(tip + r.next() * 0.6 - 0.3), 0, 3);
          place(x, 4, (X) => b.add(tone, X + lean * j, y - j * 1.3 * U));
        }
      }
      for (let q = 0; q < 4; q++) b.draw(c, q, 1.3 * U, map(0.08, 0.1 + q * 0.22, 0.05));
    }

    // A spruce: ragged tiers drooping from a sharp tip. With sparks, the grains of light at its tip and tier ends.
    function conifer(c, sparks, body, x, base, ht, seed) {
      const r = new Rand(seed), w = ht * r.range(0.32, 0.44), tiers = 6 + floor(r.next() * 5), top = base - ht;
      const left = [], right = [];
      for (let q = 1; q <= tiers; q++) {
        const f = q / tiers, y = top + ht * 0.9 * f, reach = w * 0.5 * (0.12 + 0.88 * pow(f, 0.85)), droop = ht * 0.025;
        left.push([x - reach * r.range(0.85, 1.12), y + droop], [x - reach * r.range(0.3, 0.5), y - ht * 0.02]);
        right.push([x + reach * r.range(0.85, 1.12), y + droop], [x + reach * r.range(0.3, 0.5), y - ht * 0.02]);
      }
      const tip = r.range(-0.4, 0.4) * U;
      if (!sparks) {
        c.beginPath(); c.moveTo(x + tip, top);
        for (const p of left) c.lineTo(p[0], p[1]);
        c.lineTo(x - w * 0.05, base + 4 * U); c.lineTo(x + w * 0.05, base + 4 * U);
        for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
        c.closePath(); c.fillStyle = body; c.fill();
        return;
      }
      [left, right].forEach((side, si) => {
        for (let i = 0; i < side.length; i += 2) {
          const f = i / side.length;
          if (hash(i * 2 + si, seed) > 0.75 - f * 0.5) continue;
          const roll = hash(i * 2 + si + 97, seed);
          sparks.add(clamp(round((1 - f) * 3 + roll * 0.8 - 0.6), 0, 3), side[i][0], side[i][1] - 0.8 * U);
        }
      });
      sparks.add(3, x + tip, top + 0.6 * U);
      if (hash(seed, 211) < 0.6) glint(x + tip, top + 0.6 * U);
      for (let i = 0; i < right.length; i += 4) {
        if (hash(i, seed + 7) < 0.3) glint(right[i][0], right[i][1]);
        if (hash(i, seed + 9) < 0.3) glint(left[i][0], left[i][1]);
      }
    }

    // A broad crown as many small leaf masses round a solid core, so its
    // outline is lumpy like foliage. Without sparks, the crown (leaf tops a
    // little lit, leaves in varied shade); with, grains of light along its top edge.
    function leafCrown(c, sparks, env, leaf, seed, haze, shade) {
      const r = new Rand(seed), lx = [], ly = [], lr = [], lv = [];
      for (const [ox, oy_, rx, ry] of env) {
        const n = round(Math.PI * rx * ry / (leaf * leaf * U * U * 1.5));
        for (let i = 0; i < n; i++) {
          const a = r.next() * TAU, d = 0.6 + 0.4 * pow(r.next(), 0.6);
          lx.push(ox + cos(a) * rx * d); ly.push(oy_ + sin(a) * ry * d); lr.push(leaf * U * r.range(0.6, 1.3)); lv.push(r.next());
        }
      }
      if (!sparks) {
        c.beginPath();
        for (const [ox, oy_, rx, ry] of env) { c.moveTo(ox + rx * 0.75, oy_); c.ellipse(ox, oy_, rx * 0.75, ry * 0.75, 0, 0, TAU); }
        c.fillStyle = map(haze, 0, shade + 0.1); c.fill();
        for (let band = 0; band < 3; band++) {
          c.beginPath();
          for (let i = 0; i < lx.length; i++) if (floor(lv[i] * 3) === band) { c.moveTo(lx[i] + lr[i], ly[i]); c.arc(lx[i], ly[i], lr[i], 0, TAU); }
          c.fillStyle = map(haze, 0, shade - 0.12 + band * 0.12); c.fill();
          c.beginPath();
          for (let i = 0; i < lx.length; i++) if (floor(lv[i] * 3) === band) { const rr = lr[i] * 0.55, yy = ly[i] - lr[i] * 0.35; c.moveTo(lx[i] + rr, yy); c.arc(lx[i], yy, rr, 0, TAU); }
          c.fillStyle = map(haze, 0.22, shade - 0.2 + band * 0.1); c.fill();
        }
        return;
      }
      // Which leaf edges are the crown's outline: a grid of leaves for the inside test.
      const cell = leaf * U * 2.6, grid = new Map(), key = (gx, gy) => gx * 100003 + gy;
      for (let i = 0; i < lx.length; i++) {
        const q = key(floor(lx[i] / cell), floor(ly[i] / cell));
        let l = grid.get(q); if (!l) grid.set(q, (l = [])); l.push(i);
      }
      const covered = (px, py, self) => {
        for (const [ox, oy_, rx, ry] of env) { const dx = (px - ox) / (rx * 0.75), dy = (py - oy_) / (ry * 0.75); if (dx * dx + dy * dy < 0.94) return true; }
        const gx = floor(px / cell), gy = floor(py / cell);
        for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const l = grid.get(key(ix, iy)); if (!l) continue;
          for (const j of l) if (j !== self && Math.hypot(px - lx[j], py - ly[j]) < lr[j] - 0.4 * U) return true;
        }
        return false;
      };
      for (let i = 0; i < lx.length; i++) {
        const rad = lr[i], steps = ceil(rad * Math.PI / (1.6 * U));
        for (let j = 0; j <= steps; j++) {
          const th = -Math.PI + Math.PI * j / steps, l = -sin(th);
          if (l < 0.35 || r.next() > l * 0.8) continue;
          const px = lx[i] + rad * cos(th), py = ly[i] + rad * sin(th);
          if (covered(px, py, i)) continue;
          const tone = clamp(round(l * 3.4 + r.next() * 0.8 - 0.6), 0, 3);
          sparks.add(tone, px, py + 0.5 * U);
          if (tone >= 2 && r.next() < 0.16) glint(px, py + 0.5 * U);
        }
      }
    }

    // ── far: grain clouds (drifting) and three far ranges ──
    function paintClouds(c, w) {
      const r = new Rand(101), grains = new Batch(4), banks = max(3, round(w / (300 * U)));
      for (let b = 0; b < banks; b++) {
        const cx = (b + r.range(0.15, 0.85)) * w / banks, cy = h * r.range(0.13, 0.40), low = clamp((cy / h - 0.13) / 0.27, 0, 1);
        const width = r.range(110, 240) * U * (0.8 + 0.7 * low), height = width * r.range(0.11, 0.18) * (1 - 0.4 * low);
        for (const dx of [-w, 0, w]) cloud(c, grains, cx + dx, cy, width, height, low, 1000 + b, w);
      }
      for (let i = 0; i < 4; i++) grains.draw(c, i, 1.25 * U, map(1, 0.4 + i * 0.2, 0, 0.9));
    }
    const RANGE_HAZE = [[0.66, 0.95], [0.5, 0.9], [0.36, 0.84]];
    function paintRanges(c) {
      for (let i = 0; i < 3; i++) {
        const crest = h * (0.42 + i * 0.07), [rc, rf] = RANGE_HAZE[i], lowC = clamp((crest / h - 0.40) / 0.2, 0, 1);
        fillRidge(c, (x) => range(i, x), vgrad(c, crest, h * (0.6 + i * 0.05), [[0, map(rc, 0, rc * lowC)], [1, map(rf, 0, rf)]]), h * 0.8, 3 * U);
        mistBand(c, h * (0.53 + i * 0.045), h * (0.61 + i * 0.045), 0.32);
      }
    }

    // ── hills: a forested hill line, and the near hill with its trees ──
    function paintHillFar(c, w) {
      const r = new Rand(303), forest = map(0.42, 0, 0.42 * 0.55);
      let x = r.range(0, 40) * U, i = 0;
      while (x < w) {
        const ht = r.range(9, 22) * U * (0.7 + 0.6 * (nh(x, 90, 37) * 0.5 + 0.5)), seed = 3300 + i++;
        place(x, ht, (at) => conifer(c, null, forest, at, hillFar(at) + 2 * U, ht, seed));
        x += r.range(4, 13) * U * (nh(x, 140, 38) > 0.2 ? 6 : 1);
      }
      fillRidge(c, hillFar, vgrad(c, h * 0.62, h * 0.74, [[0, map(0.4, 0, 0.4 * 0.55)], [1, map(0.8, 0, 0.8)]]), h * 0.86, 3 * U);
      mistBand(c, h * 0.655, h * 0.745, 0.34);
    }
    function hillTree(c, sparks, body, tx, spruce, size, seed) {
      const base = hill(tx) + 4 * U;
      if (spruce) return conifer(c, sparks, body, tx, base, size, seed);
      const rad = size, trunk = rad * new Rand(seed).range(0.8, 1.2);
      if (c) { c.fillStyle = body; c.fillRect(tx - rad * 0.08, base - trunk - rad * 0.3, rad * 0.16, trunk + rad * 0.3 + 4 * U); }
      leafCrown(c, sparks, [[tx, base - trunk - rad * 0.55, rad * 1.1, rad * 0.8], [tx + rad * 0.3, base - trunk - rad * 0.9, rad * 0.7, rad * 0.55]], 2.8, seed, 0.04, 0.35);
    }
    function paintHill(c, w, sparks) {
      const r = new Rand(304), body = sparks ? null : map(0.04, 0, 0.35);
      let x = r.range(20, 60) * U, i = 0;
      while (x < w) {
        const cluster = 1 + floor(r.next() * 4);
        for (let q = 0; q < cluster; q++) {
          const at = x + q * r.range(10, 20) * U, spruce = r.next() < 0.7;
          const size = spruce ? r.range(26, 64) * U : r.range(16, 26) * U, seed = 3400 + i++;
          place(at, size * 1.6, (tx) => hillTree(c, sparks, body, tx, spruce, size, seed));
        }
        x += r.range(80, 220) * U;
      }
      if (sparks) return;
      fillRidge(c, hill, vgrad(c, h * 0.66, h * 0.84, [[0, map(0.04, 0, 0)], [1, map(0.2, 0, 0.12)]]), h * 0.88, 2.5 * U);
      tufts(c, w, hill, round(w * 1.4), 3);
    }

    // ── meadow: the ground, bushes along its edge, the great trees ──
    function paintGround(c, w, sparks) {
      if (!sparks) {
        // Warm air over the grass, lighting the foot of the hills.
        c.fillStyle = vgrad(c, h * 0.69, h * 0.835, [[0, map(1, 0, 0, 0)], [1, map(1, 0, 0, 0.3)]]);
        c.fillRect(WA, h * 0.69, WB - WA, h * 0.15);
        fillRidge(c, groundLine, vgrad(c, h * 0.8, h, [[0, map(0, 0.12, 0)], [0.28, map(0, 0, 0.35)], [1, map(0, 0, 0.8)]]), h, 2.5 * U);
        const flecks = new Batch(3), r = new Rand(4 * 7919), depth = 34 * U;
        for (let i = 0, n = round(w * 1.8); i < n; i++) {
          const x = r.next() * w, d = -Math.log(1 - r.next() * 0.995) * depth, tone = clamp(floor(exp(-d / depth) * 3 - r.next() * 0.8), 0, 2);
          place(x, 3, (X) => flecks.add(tone, X, groundLine(X) + 2.5 * U + d));
        }
        for (let q = 0; q < 3; q++) flecks.draw(c, q, 1.3 * U, map(0, 0.15 + q * 0.15, 0.3 - q * 0.1, 0.75));
      }
      // Low bushes along the meadow's edge.
      const r = new Rand(404);
      let x = r.range(150, 300) * U, i = 0;
      while (x < w) {
        const rad = r.range(11, 19) * U, seed = 4400 + i++;
        place(x, rad * 2.4, (bx) => {
          const g = groundLine(bx);
          leafCrown(c, sparks, [[bx, g - rad * 0.25, rad * 1.5, rad * 0.65], [bx + rad * 0.5, g - rad * 0.55, rad * 0.8, rad * 0.5]], 2.6, seed, 0, 0.4);
        });
        x += r.range(200, 480) * U;
      }
    }
    function greatTree(c, sparks, x, s, seed) {
      const r = new Rand(500 + seed), ground = groundLine(x) + 6 * s, lean = 16 * s, topY = ground - 165 * s;
      const body = c && map(0, 0, 0.3);
      if (c) {
        // Trunk: tapered, a little lean, flaring into roots.
        c.fillStyle = body; c.beginPath();
        c.moveTo(x - 14 * s, ground); c.quadraticCurveTo(x - 8 * s, ground - 90 * s, x + lean - 5 * s, topY);
        c.lineTo(x + lean + 5 * s, topY); c.quadraticCurveTo(x + 11 * s, ground - 80 * s, x + 16 * s, ground); c.closePath(); c.fill();
        for (const dir of [-1, 1]) {
          c.beginPath(); c.moveTo(x + dir * 8 * s, ground - 18 * s);
          c.quadraticCurveTo(x + dir * 17 * s, ground - 3 * s, x + dir * 34 * s, ground + 3 * s);
          c.lineTo(x + dir * 5 * s, ground + 3 * s); c.closePath(); c.fill();
        }
      }
      // Limbs reaching up and out, each ending in a mass of leaves.
      const env = [];
      for (const a of [-2.55, -2.1, -1.6, -1.15, -0.7, -0.35]) {
        const fx = x + lean * 0.75, fy = ground - r.range(115, 160) * s, len = r.range(60, 105) * s;
        const tx = fx + cos(a) * len, ty = fy + sin(a) * 0.8 * len, nx = -sin(a), ny = cos(a);
        const mx = (fx + tx) / 2, my = (fy + ty) / 2 - 10 * s;
        if (c) {
          c.beginPath(); c.moveTo(fx + nx * 5.5 * s, fy + ny * 5.5 * s); c.quadraticCurveTo(mx, my, tx, ty);
          c.quadraticCurveTo(mx, my + 4 * s, fx - nx * 5.5 * s, fy - ny * 5.5 * s); c.closePath(); c.fill();
        }
        env.push([tx, ty, r.range(38, 54) * s, r.range(24, 34) * s]);
      }
      env.push([x + lean, topY - 46 * s, 62 * s, 40 * s], [x + lean - 30 * s, topY - 20 * s, 46 * s, 28 * s]);
      leafCrown(c, sparks, env, 4.0 * s / U, seed * 977, 0, 0.3);
      // Light caught along both edges of the trunk.
      if (sparks) for (let i = 0; i < 60; i++) {
        const f = i / 60;
        if (hash(i, seed) < 0.5) continue;
        const side = hash(i + 3, seed) < 0.5 ? -1 : 1, half = (14 - 9 * f) * s;
        sparks.add(hash(i + 9, seed) < 0.6 ? 0 : 1, x + lean * f * f + side * (half - 1.4 * s), ground - f * 150 * s);
      }
    }

    // ── grass: blades sorted by x, so a frame only walks the ones it can see ──
    function blades(list) {
      list.sort((a, b) => a[0] - b[0]);
      const n = list.length, f = () => new Float32Array(n);
      const b = { n, x: f(), base: f(), height: f(), lean: f(), phase: f(), depth: f(), patch: f(), row: new Uint8Array(n), bend: f(), vel: f(), lo: 0, hi: -1, clock: -1, maxBend: 0 };
      list.forEach((it, i) => { b.x[i] = it[0]; b.base[i] = it[1]; b.height[i] = it[2]; b.lean[i] = it[3]; b.phase[i] = it[4]; b.depth[i] = it[5]; b.row[i] = it[6]; });
      b.firstAt = (left) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.x[m] < left) lo = m + 1; else hi = m; } return lo; };
      return b;
    }
    function meadowGrass(w) {
      const list = [], r = new Rand(606);
      // The fringe: the meadow's far edge, standing against the light.
      for (let x = 0; x < w; x += 2.1 * U) {
        const tall = 0.7 + 0.6 * (nm(x, 46, 61) * 0.5 + 0.5), jitter = r.range(-0.6, 0.6) * 2.1 * U;
        list.push([mod(x + jitter, w), groundLine(x) + 1.5 * U, r.range(7, 16) * tall * U, r.range(-0.12, 0.28), r.range(0, TAU), 0, 0]);
      }
      // Below it, blades all the way down the meadow, thinning and darkening as they come nearer.
      const feet = 44 * U;
      for (let i = 0, n = round(w / (1.1 * U)); i < n; i++) {
        const x = r.next() * w, g = groundLine(x), depth = pow(r.next(), 1.35), below = 5 * U + depth * (h - g - 7 * U);
        const tall = 0.7 + 0.6 * (nm(x + 120, 40, 62) * 0.5 + 0.5), front = below > feet;
        const ht = (front ? r.range(6, 12) : r.range(8, 16) * (1 + depth * 0.5)) * tall * U;
        list.push([x, g + below, ht, r.range(-0.12, 0.28), r.range(0, TAU), depth, front ? 4 : depth < 0.12 ? 1 : depth < 0.3 ? 2 : 3]);
      }
      const b = blades(list);
      for (let i = 0; i < b.n; i++) if (b.row[i] === 0) b.patch[i] = 0.65 + 0.5 * (nm(b.x[i], 58, 71) * 0.5 + 0.5);
      return b;
    }
    function foreGrass(w) {
      const list = [], r = new Rand(707);
      let cx = r.range(120, 320) * U;
      while (cx < w) {
        const n = 9 + floor(r.next() * 9), reach = r.range(34, 70) * U;
        for (let i = 0; i < n; i++) {
          const off = r.range(-18, 18) * U;
          list.push([mod(cx + off, w), h + 4 * U, reach * r.range(0.5, 1.0), off / (18 * U) * 0.34 + r.range(-0.08, 0.08), r.range(0, TAU), 1, 0]);
        }
        cx += r.range(260, 640) * U;
      }
      return blades(list);
    }
    function makeMotes(w) {
      const r = new Rand(808), n = round(w / (9 * U)), m = { n, w, x0: new Float32Array(n), y0: new Float32Array(n), speed: new Float32Array(n), phase: new Float32Array(n), top: h * 0.36, bottom: h * 0.86 };
      for (let i = 0; i < n; i++) { m.x0[i] = r.next() * w; m.y0[i] = h * r.range(0.36, 0.86); m.speed[i] = r.range(3, 10) * U; m.phase[i] = r.range(0, TAU); }
      return m;
    }
    const packGlints = (arr) => {
      const n = arr.length / 2, g = { n, x: new Float32Array(n), y: new Float32Array(n), phase: new Float32Array(n), speed: new Float32Array(n) };
      for (let i = 0; i < n; i++) { g.x[i] = arr[i * 2]; g.y[i] = arr[i * 2 + 1]; g.phase[i] = hash(i, 1301) * TAU; g.speed[i] = 0.5 + hash(i, 1303) * 1.3; }
      return g;
    };

    // ── the rift: a tipped disk of grains falling into a black core ──
    const RR = 72, CORE = 0.27, INNER = CORE + 0.06, NG = 460, NRING = 110, NMOTE = 26;
    const rift = { rho: new Float64Array(NG), theta: new Float64Array(NG), ph: new Float64Array(NG), rng: new Rand(7), time: 0 };
    const respawn = (i, initial) => {
      const u = rift.rng.next();
      rift.rho[i] = initial ? INNER + (1 - INNER) * pow(u, 0.85) : 0.86 + 0.14 * u;
      rift.theta[i] = rift.rng.next() * TAU; rift.ph[i] = rift.rng.next();
    };
    for (let i = 0; i < NG; i++) respawn(i, true);
    function stepRift(dt) {
      rift.time += dt;
      for (let i = 0; i < NG; i++) {
        const r = rift.rho[i];
        rift.theta[i] += dt * 0.5 / (r * sqrt(r));            // Kepler: the inner disk turns far faster than the rim
        rift.rho[i] = r - dt * (0.012 + 0.03 / r);
        if (rift.rho[i] < INNER * 0.92) respawn(i, false);
      }
    }
    const riftBatch = new Batch(16);
    let riftPaint = null;
    function riftPaints(c) {
      const coreR = RR * CORE, rg = (r, stops) => { const g = c.createRadialGradient(0, 0, 0, 0, 0, r); for (const [s, col] of stops) g.addColorStop(s, col); return g; };
      const T = RIFT.tones;
      return {
        tear: rg(RR * 2.1, [[0, css(RIFT.tint, 0.85)], [0.45, css(RIFT.tint, 0.4)], [1, css(RIFT.tint, 0)]]),
        lane: rg(RR * 1.05, [[0.18, css(T[3], 0)], [0.32, css(T[3], 0.2)], [0.62, css(T[2], 0.09)], [1, css(T[1], 0)]]),
        hot: rg(coreR * 3.4, [[0, css(RIFT.glow, 0.42)], [0.42, css(RIFT.glow, 0.1)], [1, css(RIFT.glow, 0)]]),
        core: rg(coreR * 1.06, [[0, 'rgba(1,1,2,1)'], [0.86, 'rgba(1,1,2,1)'], [1, 'rgba(1,1,2,0)']]),
        far: T.map((x) => css(mix(x, BLACK, 0.4))), near: T.map((x) => css(x)),
        mote: css(T[3], 0.4), ring: css(T[4], 0.55), ringHot: css(T[5], 0.85),
      };
    }
    function drawRift(c) {
      const b = riftBatch, T = rift.time, coreR = RR * CORE, p = riftPaint ??= riftPaints(c);
      b.clear();
      // dust drawn in from the dark
      for (let i = 0; i < NMOTE; i++) {
        const seed = (i * 0.6180339) % 1, q = (T * (0.05 + 0.05 * seed) + seed * 7.1) % 1;
        if (q < 0.06) continue;
        const a = seed * TAU + q * 1.6, d = RR * (2.6 - 1.7 * q * q);
        b.add(14, cos(a) * d, sin(a) * d * 0.62);
      }
      // the disk, tipped and turned; the side turning towards you burns a shade brighter
      const ct = cos(-0.22), st = sin(-0.22);
      for (let i = 0; i < NG; i++) {
        const rho = rift.rho[i], th = rift.theta[i], sn = sin(th), cs = cos(th);
        const x0 = cs * rho * RR, y0 = sn * rho * RR * 0.3, x = x0 * ct - y0 * st, y = x0 * st + y0 * ct;
        const heat = clamp(1 - (rho - INNER) / (1 - INNER), 0, 1), near = sn > 0;
        if (near && (T * 0.3 + rift.ph[i] * 9.1) % 1 < 0.006 && heat > 0.4) { b.add(15, x, y); continue; }
        b.add((near ? 6 : 0) + floor(clamp(pow(heat, 1.3) * 5.99 + (cs < -0.35 ? 0.8 : 0), 0, 5.99)), x, y);
      }
      // the light bent round the core, brightest above and below it
      for (let i = 0; i < NRING; i++) {
        const seed = (i * 0.7548776) % 1, a = seed * TAU + T * (1.6 + seed), d = coreR * (1.02 + 0.1 * ((i * 0.5698) % 1)), sa = sin(a);
        b.add(abs(sa) > 0.72 ? 13 : 12, cos(a) * d, sa * d);
      }
      const d = max(1.25, RR * 0.011);
      const disc = (r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); };
      disc(RR * 2.1, p.tear);
      b.draw(c, 14, d * 0.9, p.mote);
      c.save(); c.rotate(-0.22); c.scale(1, 0.3); disc(RR * 1.05, p.lane); c.restore();
      disc(coreR * 3.4, p.hot);
      for (let q = 0; q < 6; q++) b.draw(c, q, d * 0.9, p.far[q]);
      disc(coreR * 1.06, p.core);
      b.draw(c, 12, d * 0.7, p.ring);
      b.draw(c, 13, d * 0.8, p.ringHot);
      for (let q = 0; q < 6; q++) b.draw(c, 6 + q, d, p.near[q]);
      b.draw(c, 15, d * 2.4, 'rgba(255,255,255,0.2)');
      b.draw(c, 15, d * 1.3, '#fff');
    }

    // ── layout for this screen: which window of each layer shows ──
    let meadowB = null, foreB = null, motes = null, stars = null;
    function compose() {
      k = min(H / REF, W / 280);                      // at least 280 game px across, or a phone shows one blade of grass
      h = min(H / k, REF * 1.3);                      // on a tall screen, more sky above the field rather than taller hills
      oy = H / k - h;
      vw = W / k; mg = 14 / k;
      // The camera: where it stands round the loop decides each layer's window.
      // A great tree to one side, the rift up in the open sky.
      const portrait = W < H * 0.9;
      const cam = opts.cam ?? (portrait ? 572 : 26);
      for (const n in LAYERS) V[n] = mod(cam * (1 + LAYERS[n].pf), LAYERS[n].P);
      riftX = (portrait ? 0.66 : 0.579) * W;
      riftY = portrait ? max(64 + RR * 0.5 * k, (oy + 0.15 * h) * k) : (oy + 0.21 * h) * k;
    }

    function bake() {
      setHour(hour);
      // far: the clouds, all the way round (they drift), then the ranges in the window
      grade = G.cloud; sink = [];
      bounds(0, PF, PF);
      S.clouds = sheet(0, PF, 0, h * 0.48, 0.8);
      paintClouds(S.clouds.c, PF);
      glints.far = packGlints(sink);
      grade = G.ranges;
      bounds(V.far - mg, V.far + vw + mg, PF);
      S.ranges = sheet(WA, WB, h * 0.38, h * 0.78, 0.8);
      paintRanges(S.ranges.c);
      lit(S.ranges, 'far', (c) => { for (let i = 0; i < 3; i++) rimBands(c, (x) => range(i, x), [[1.3, 0.55 + 0.1 * i], [3.6, 0.3], [9.0, 0.13]]); });
      // hills
      bounds(V.hills - mg, V.hills + vw + mg, PH); sink = [];
      S.hills = sheet(WA, WB, h * 0.48, h * 0.88, 1);
      grade = G.hillFar; paintHillFar(S.hills.c, PH);
      lit(S.hills, 'hills', (c) => rimBands(c, hillFar, [[3.6, 0.32], [9.0, 0.14]]));
      grade = G.hill; paintHill(S.hills.c, PH, null);
      lit(S.hills, 'hills', (c) => {
        rimBands(c, hill, [[3.6, 0.36], [9.0, 0.15]]);
        const sparks = new Batch(4); paintHill(null, PH, sparks); rimSparkle(sparks, PH, hill, 3); drawSparks(c, sparks, 1.35);
      });
      if (L.rimStrength <= 0.01) { const sparks = new Batch(4); paintHill(null, PH, sparks); } // glints all the same
      glints.hills = packGlints(sink);
      // meadow: the ground, its light, the great trees in the window
      bounds(V.meadow - mg, V.meadow + vw + mg, PM); sink = [];
      const trees = [];
      for (const [x, s, seed] of TREES) place(x, 200 * s * U, (X) => trees.push([X, s * U, seed]));
      const top = trees.length ? min(h * 0.66, ...trees.map(([x, s]) => groundLine(x) - 270 * s)) : h * 0.66;
      S.meadow = sheet(WA, WB, max(-oy, top), h, 1);
      grade = G.ground; paintGround(S.meadow.c, PM, null);
      lit(S.meadow, 'meadow', (c) => { const sp = new Batch(4); paintGround(null, PM, sp); drawSparks(c, sp, 1.4); });
      for (const [x, s, seed] of trees) {
        grade = G.tree; greatTree(S.meadow.c, null, x, s, seed);
        const sp = new Batch(4); greatTree(null, sp, x, s, seed);
        lit(S.meadow, 'meadow', (c) => drawSparks(c, sp, 1.5));
      }
      if (L.rimStrength <= 0.01) { const sp = new Batch(4); paintGround(null, PM, sp); }
      glints.meadow = packGlints(sink);
      sink = null; tmp = null;

      // the sky's gradient and lights, and the live colors for the hour
      const l = L, c = ctx, sky = c.createLinearGradient(0, 0, 0, h);
      STOPS.forEach((s, i) => sky.addColorStop(s, css(l.sky[i])));
      const skyY = (up) => h * (0.56 - up * 0.49);
      const glows = [];
      const glow = (x, y, r, col, a0, a1) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, css(col, a0)); g.addColorStop(0.38, css(col, a1)); g.addColorStop(1, css(col, 0));
        glows.push([x, y, r, g]);
      };
      const sun = [vw * sunX, skyY(sunUp)];
      if (l.glow > 0.01) { glow(...sun, vw * 0.95, l.rim, 0.3 * l.glow, 0.1 * l.glow); glow(...sun, vw * 0.3, l.rim, 0.5 * l.glow, 0.16 * l.glow); }
      let disc = null, moon = null;
      if (sunUp > -0.08) {
        const dc = mix(hex('FFFBEF'), hex('FFE6B4'), clamp(1 - sunUp * 2.5, 0, 1));
        glow(...sun, 46 * U, dc, 0.95, 0.35);
        disc = [...sun, 17 * U, css(dc)];
      }
      if (moonUp > -0.08 && l.stars > 0.05) {
        const mx = vw * moonX, my = skyY(moonUp), vis = clamp(l.stars, 0, 1), litF = (1 - cos(phase * TAU)) / 2, r = 13 * U;
        glow(mx, my, 120 * U, hex('B4C6F0'), 0.32 * vis * litF, 0.1 * vis * litF);
        // the lit part of the moon in tonight's phase: lit on the right while waxing
        const side = phase < 0.5 ? 1 : -1, kk = cos(phase * TAU), path = new Path2D();
        for (let i = 0; i <= 32; i++) { const y = -1 + 2 * i / 32, q = sqrt(max(0, 1 - y * y)); path[i ? 'lineTo' : 'moveTo'](mx + side * q * r, my + y * r); }
        for (let i = 32; i >= 0; i--) { const y = -1 + 2 * i / 32, q = sqrt(max(0, 1 - y * y)); path.lineTo(mx + side * kk * q * r, my + y * r); }
        path.closePath();
        moon = { x: mx, y: my, r, dark: css(hex('1A2236'), 0.55 * vis), path, face: css(hex('EAF0FC'), vis) };
      }
      const warm = mix(l.rim, WHITE, 0.45), cool = hex('CFE2FF');
      const ff = l.firefly;
      cols = {
        sky, glows, disc, moon,
        stars: [1, 2, 3].map((lv) => css(hex('E8ECFF'), 0.2 * lv)),
        grass: l.grass.map((g) => css(g)),
        glintHalo: [warm, warm, cool, cool].map((col, b) => css(col, 0.2 * (b % 2 ? 1 : 0.5))),
        glintCore: [warm, warm, cool, cool].map((col, b) => css(mix(col, WHITE, 0.6), 0.85 * (b % 2 ? 1 : 0.5))),
        moteHalo: [0, 1, 2, 3].map((lv) => css(l.mote, (0.06 + ff * 0.05) * lv)),
        moteCore: [0, 1, 2, 3].map((lv) => css(l.mote, (0.26 + ff * 0.06) * lv)),
      };
      bakedHour = hour;
    }

    // ── live drawing ──
    const grass = new Batch(24), dots = new Batch(4);
    const fronts = new Float64Array(3);
    let gustOut = 0;
    function windFronts(tt, wrap) { for (let q = 0; q < 3; q++) fronts[q] = mod(tt * 210 * U + q * wrap / 3, wrap); }
    // Wind at x: a slow sway everywhere, plus gusts that sweep across the layer, bending the grass and lighting its tips.
    function wind(x, tt, wrap) {
      const sway = 0.12 * sin(1.05 * tt + x * 0.011) + 0.05 * sin(2.3 * tt + x * 0.037 + 1.3);
      let gust = 0;
      for (let q = 0; q < 3; q++) {
        let d = x - fronts[q];
        d -= wrap * round(d / wrap);
        const z = d / (d > 0 ? 55 * U : 190 * U), e = exp(-z * z);
        if (e > gust) gust = e;
      }
      gustOut = gust;
      return sway + 0.42 * gust;
    }
    const shifts = (left, right, P) => { const out = []; for (let q = floor(left / P); q <= floor(right / P); q++) out.push(q * P); return out; };

    function paintBlades(c, b, P, left, right, r0, r1, fore) {
      grass.clear();
      const margin = 40 * U, step = (fore ? 1.9 : 1.25) * U, stirScale = b.maxBend > 0 ? 1 / b.maxBend : 0;
      for (const shift of shifts(left - margin, right + margin, P)) {
        for (let i = b.firstAt(left - margin - shift); i < b.n; i++) {
          const x = b.x[i] + shift;
          if (x > right + margin) break;
          const row = b.row[i];
          if (row < r0 || row > r1) continue;
          const wd = wind(b.x[i], t, P), gust = gustOut, ht = b.height[i];
          const sway = b.lean[i] + wd * (fore ? 0.7 : 1) + 0.05 * sin(3.1 * t + b.phase[i]);
          // Each blade is an arc of its own length: the wind and the fingers curve it, never stretch it.
          const turn = clamp(2 * sway + b.bend[i], -2.2, 2.2), stirred = min(1, abs(b.bend[i]) * stirScale + abs(b.vel[i]) * 0.05);
          const n = max(2, round(ht / step)), size = fore ? 2 : row === 0 ? 0 : row < 3 ? 1 : 2;
          // The fringe stands against the light, in patches; the nearer a blade, the deeper in the meadow's shade.
          let lb, reach;
          if (fore) { lb = -0.6; reach = 2.4; } else if (row === 0) { lb = 1.0; reach = 5.2 * b.patch[i]; } else { lb = 0.9 - b.depth[i] * 1.2; reach = 3.6 - b.depth[i] * 1.4; }
          const lift = gust * 2.4 + stirred * 4.5, seg = ht / n, dT = turn / n, cd = cos(dT), sd = sin(dT);
          let cc = cos(dT * 0.5), ss = sin(dT * 0.5), px = x, py = b.base[i];
          for (let j = 1; j <= n; j++) {
            const f = j / n;
            px += seg * ss; py -= seg * cc;
            let tone = round(lb + f * f * reach + lift * f);
            tone = tone < 0 ? 0 : tone > 7 ? 7 : tone;
            grass.add(tone * 3 + size, px, py);
            const nc = cc * cd - ss * sd; ss = ss * cd + cc * sd; cc = nc;
          }
        }
      }
      const d0 = 1.6 * U, d1 = 1.9 * U, d2 = fore ? 2.7 * U : 2.2 * U;
      for (let tone = 0; tone < 8; tone++) {
        grass.draw(c, tone * 3, d0, cols.grass[tone]); grass.draw(c, tone * 3 + 1, d1, cols.grass[tone]); grass.draw(c, tone * 3 + 2, d2, cols.grass[tone]);
      }
    }

    // Brief twinkles on clouds and trees: warm in the sun, silver under the moon, a few faintly blue.
    function paintGlints(c, g, left, right, P, size, shift = 0, wrap = 0) {
      if (!g || !g.n) return;
      dots.clear();
      for (let i = 0; i < g.n; i++) {
        const s = sin(t * g.speed[i] + g.phase[i]);
        if (s < 0.55) continue;
        let x = g.x[i] + shift;
        if (wrap > 0 && x >= wrap) x -= wrap;
        x += P * ceil((left - 8 - x) / P);                     // the repeat of it in the window
        if (x > right + 8) continue;
        dots.add((i % 5 === 0 ? 2 : 0) + (s > 0.86 ? 1 : 0), x, g.y[i]);
      }
      for (let b = 0; b < 4; b++) { dots.draw(c, b, 7 * size * U, cols.glintHalo[b]); dots.draw(c, b, 2.2 * size * U, cols.glintCore[b]); }
    }

    // Motes rising slowly off the meadow; at night, fireflies, slower, blinking.
    function paintMotes(c, left, right) {
      const m = motes, ff = L.firefly, span = m.bottom - m.top, shown = round(m.n * (0.55 + 0.45 * ff));
      dots.clear();
      windFronts(t, m.w);
      for (let i = 0; i < shown; i++) {
        const rise = mod(m.bottom - m.y0[i] + t * m.speed[i] * (1 - ff * 0.7), span);
        const y = m.bottom - rise + ff * 9 * U * sin(t * 0.9 + i);
        let x = mod(m.x0[i] + t * 5 * U + 12 * U * sin(t * 0.4 + m.phase[i]), m.w);
        x += m.w * ceil((left - 10 - x) / m.w);
        if (x > right + 10) continue;
        const life = rise / span, fade = min(1, life * 6) * min(1, (1 - life) * 3);
        const ph = m.phase[i], tw = 0.55 + 0.45 * sin(t * (1.3 + ph * 0.2) + ph * 3);
        const blink = pow(0.5 + 0.5 * sin(t * (1.1 + ph * 0.3) + ph * 5), 6);
        const level = floor(fade * (tw + (blink - tw) * ff) * 3.99);
        if (level <= 0) continue;
        wind(x, t, m.w);
        dots.add(level, x + gustOut * 6 * U, y);
      }
      const halo = (6.5 + ff * 4) * U;
      for (let lv = 1; lv < 4; lv++) { dots.draw(c, lv, halo, cols.moteHalo[lv]); dots.draw(c, lv, 1.8 * U, cols.moteCore[lv]); }
    }

    // ── fingers in the grass (_stirBlades): each blade a damped spring, held
    // bent away while a finger is there, swinging back when it has gone. A
    // tap sends a ripple out through the grass round it. ──
    const HOLD = 0.14, RIPPLE_SPEED = 170, RIPPLE_LIFE = 0.75, RIPPLE_KICK = 140;
    const stirs = { meadow: [], fore: [] };
    function loopDelta(x, from, P) { const d = x - from; return d - P * round(d / P); }
    function stirBlades(b, layer, P, reach, maxBend) {
      const list = stirs[layer];
      while (list.length && t - list[0].time > 1.5) list.shift();
      const now = t, dt = b.clock < 0 ? 0 : clamp(now - b.clock, 0, 1 / 30);
      b.clock = now; b.maxBend = maxBend;
      const live = list.filter((p) => now - p.time < HOLD && now >= p.time);
      const ripples = list.filter((p) => p.speed < 0.5 && now - p.time < RIPPLE_LIFE && now >= p.time);
      const wave = RIPPLE_SPEED * U, band = 16 * U;
      const take = (p, r) => {
        const local = mod(p.x, P);
        for (const cx of [local, local - P, local + P]) {
          if (cx + r < 0 || cx - r > P) continue;
          const a = b.firstAt(cx - r), z = b.firstAt(cx + r) - 1;
          if (z < a) continue;
          if (b.hi < b.lo) { b.lo = a; b.hi = z; } else { b.lo = min(b.lo, a); b.hi = max(b.hi, z); }
        }
      };
      for (const p of live) take(p, reach);
      for (const p of ripples) take(p, wave * (now - p.time) + band * 2);
      if (b.hi < b.lo || dt <= 0) return;
      const K = 170, DAMP = 7, PULL = 700, steps = clamp(ceil(dt * 60), 1, 2), hs = dt / steps;
      let lo = b.n, hi = -1;
      for (let i = b.lo; i <= b.hi; i++) {
        let pull = 0, target = 0, push = 0;
        const y = b.base[i] - b.height[i] * 0.5;
        for (const p of live) {
          const dx = loopDelta(b.x[i], p.x, P);
          if (abs(dx) > reach) continue;
          const dy = y - p.y;
          if (abs(dy) > reach * 1.4) continue;
          const w = exp(-(dx * dx + dy * dy * 0.5) / (reach * reach * 0.42)) * (1 - (now - p.time) / HOLD);
          if (w <= pull) continue;
          pull = w;
          const along = p.dir * min(1, p.speed / (8 * U)) * 0.75;
          target = clamp(Math.sign(dx) * 0.75 + along, -1, 1) * maxBend;
        }
        for (const p of ripples) {
          const dx = loopDelta(b.x[i], p.x, P), age = now - p.time, off = (abs(dx) - wave * age) / band;
          if (abs(off) > 2.5 || abs(dx) < 2 * U) continue;
          const dy = (y - p.y) / (reach * 1.6);
          push += Math.sign(dx) * RIPPLE_KICK * exp(-off * off - dy * dy - age * 3.2);
        }
        let bend = b.bend[i], vel = b.vel[i];
        for (let s = 0; s < steps; s++) {
          const a = -K * bend - (DAMP + pull * 30) * vel + pull * PULL * (target - bend) + push;
          vel += a * hs; bend += vel * hs;
        }
        if (abs(bend) < 1e-3 && abs(vel) < 1e-2 && pull === 0) { bend = 0; vel = 0; } else { if (i < lo) lo = i; hi = i; }
        b.bend[i] = bend; b.vel[i] = vel;
      }
      b.lo = lo; b.hi = hi;
    }

    // ── the frame ──
    function draw() {
      const c = ctx, s = k * dpr, P = par;
      // layers shift with the pointer against the meadow, the far ones most
      const shiftOf = (n) => (n === 'sky' ? 1 : 1 - LAYERS[n].pf) * P;
      const at = (n, sx) => c.setTransform(s, 0, 0, s, (-V[n] * k + sx) * dpr, oy * s);
      const blit = (sh, n, sx) => {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(sh.cv, round(((sh.a - V[n]) * k + sx) * dpr), round((oy + sh.y0) * s), round(sh.cv.width * s / sh.s), round(sh.cv.height * s / sh.s));
      };
      const lf = (n, sx) => [V[n] - sx / k, V[n] + (W - sx) / k];

      // sky: screen-fixed, like anything at infinity
      c.setTransform(s, 0, 0, s, shiftOf('sky') * dpr, oy * s);
      c.fillStyle = cols.sky; c.fillRect(-mg * 2, -oy - 1, vw + mg * 4, h + oy + 2);
      if (L.stars > 0.02) {
        dots.clear();
        const sy = (oy + h * 0.5) / 0.5;
        for (let i = 0; i < stars.length; i++) {
          const [sx, dy] = stars[i];
          const tw = 0.5 + 0.5 * sin(t * (0.7 + (i % 5) * 0.23) + i * 1.7), lv = floor((1 - dy / 0.5) * L.stars * (0.4 + 0.6 * tw) * 3.99);
          if (lv > 0) dots.add(min(lv, 3), sx * vw, dy * sy - oy);
        }
        for (let lv = 1; lv < 4; lv++) dots.draw(c, lv, 1.4 + lv * 0.25, cols.stars[lv - 1]);
      }
      for (const [x, y, r, g] of cols.glows) { c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      if (cols.disc) { const [x, y, r, col] = cols.disc; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      if (cols.moon) { const m = cols.moon; c.fillStyle = m.dark; c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill(); c.fillStyle = m.face; c.fill(m.path); }

      // far: clouds drifting round their loop, the ranges, glints on the clouds
      const sf = shiftOf('far'), drift = mod(t * 3 * U, PF), [fl, fr] = lf('far', sf);
      for (let q = floor((fl - drift) / PF); q <= floor((fr - drift) / PF); q++) {
        const sh = S.clouds, x = drift + q * PF;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(sh.cv, round(((x - V.far) * k + sf) * dpr), round(oy * s), round(sh.cv.width * s / sh.s), round(sh.cv.height * s / sh.s));
      }
      blit(S.ranges, 'far', sf);
      at('far', sf); paintGlints(c, glints.far, fl, fr, PF, 1, drift, PF);

      // hills
      const shh = shiftOf('hills'), [hl, hr] = lf('hills', shh);
      blit(S.hills, 'hills', shh);
      at('hills', shh); paintGlints(c, glints.hills, hl, hr, PH, 1);

      // the rift, with the far sky
      c.setTransform(s, 0, 0, s, (riftX + sf) * dpr, riftY * dpr);
      drawRift(c);

      // meadow: the ground and its trees, glints, motes, the grass
      blit(S.meadow, 'meadow', 0);
      at('meadow', 0);
      const [ml, mr] = lf('meadow', 0);
      paintGlints(c, glints.meadow, ml, mr, PM, 1.25);
      paintMotes(c, ml, mr);
      windFronts(t, PM);
      paintBlades(c, meadowB, PM, ml, mr, 0, 3, false);
      paintBlades(c, meadowB, PM, ml, mr, 4, 4, false);

      // tall foreground grass, nearest of all
      const so = shiftOf('fore'), [ol, or] = lf('fore', so);
      at('fore', so);
      windFronts(t, LAYERS.fore.P);
      paintBlades(c, foreB, LAYERS.fore.P, ol, or, 0, 0, true);
    }

    // ── the API ──
    scene.resize = () => {
      const w = canvas.clientWidth, hh = canvas.clientHeight, d = min(devicePixelRatio || 1, 2);
      if (!w || !hh) return;
      if (ready && w === W && hh === H && d === dpr) return;
      W = w; H = hh; dpr = d;
      canvas.width = round(W * dpr); canvas.height = round(H * dpr);
      if (!ready) setHour(opts.hour ?? clockHour());
      compose();
      meadowB = meadowGrass(PM); foreB = foreGrass(LAYERS.fore.P); motes = makeMotes(PM);
      const r = new Rand(7);
      stars = Array.from({ length: 140 }, () => [r.next(), pow(r.next(), 1.15) * 0.5]);
      riftPaint = null;
      bake();
      ready = true;
    };
    scene.frame = (time) => {
      if (!ready) { scene.resize(); if (!ready) return; }
      if (reduce) time = 40;
      const dt = lastT == null ? 0 : clamp(time - lastT, 0, 0.1);
      t = time; lastT = time;
      // the hour moves on: bake its light again every ten minutes or so
      const wall = performance.now() / 1000;
      if (opts.hour == null && abs(wall - hourAt) > 20) {
        hourAt = wall;
        const hr = clockHour(), gap = abs(mod(hr - bakedHour + 12, 24) - 12);
        if (gap > 1 / 6) { hour = hr; bake(); }
      }
      if (!reduce) {
        par += (parTo - par) * (1 - exp(-dt * 3));
        stepRift(dt);
        stirBlades(meadowB, 'meadow', PM, 44 * U, 1.15);
        stirBlades(foreB, 'fore', LAYERS.fore.P, 52 * U, 0.9);
      }
      draw();
    };
    scene.pointer = (x, y, dx = 0, dy = 0) => {
      if (x == null) { stirs.meadow.length = stirs.fore.length = 0; parTo = 0; return; }
      if (reduce || !ready) return;
      if (hover) parTo = clamp(x / W - 0.5, -0.5, 0.5) * 2 * 9;
      // a finger at rest is a tap; anything moving is a drag through the grass
      const tap = dx === 0 && dy === 0, speed = Math.hypot(dx, dy) / k, time = lastT ?? 0;
      for (const n of ['meadow', 'fore']) {
        const sx = n === 'fore' ? (1 - LAYERS.fore.pf) * par : 0;
        stirs[n].push({ x: V[n] + (x - sx) / k, y: y / k - oy, dir: tap || speed <= 0.01 ? 0 : Math.sign(dx), speed: tap ? 0 : max(speed, 0.5), time });
        if (stirs[n].length > 240) stirs[n].shift();
      }
    };
    // Where the meadow's grass line is at CSS x: its far edge, where the fringe stands.
    scene.groundY = (x) => (ready ? (groundLine(V.meadow + x / k) + oy) * k : H * 0.82);
    scene.rift = () => ({ x: riftX, y: riftY, r: RR * CORE * k });
    return scene;
  }

  window.ValleyScene = { create };
})();
