/*
 * glitchCodeField.js: BYE invite-code display, "H · Grid Displacement" (dark, glow, chromatic split).
 * Framework-free. Draws into a canvas element; the real input element stays in the DOM (transparent overlay) for a11y,
 * paste and password managers. Drive it with field.set({...}) whenever form state changes.
 *
 *   const field = createGlitchCodeField(canvas, { font: '"JetBrains Mono", monospace' });
 *   field.set({ raw: 'WIZD20', phase: 'idle' });          // raw = up to 8 A-Z0-9 chars, no dash
 *   field.set({ phase: 'verify' });                        // while checking
 *   field.set({ phase: 'wrong' });  field.set({ phase: 'ok' });
 *   field.set({ phase: 'locked', secondsLeft: 42 });      // update secondsLeft every tick
 *   field.set({ peek: true|false });  field.set({ focused: true|false });
 *   field.destroy();
 *
 * Motion spec (from the user's reference):
 *  - every frame: luminance shimmer + 0.25 Hz micro-sway anchored at the glyph base
 *  - displacement steps every 2-4 frames @30fps (1/3/4-frame bursts at peak), no interpolation between steps
 *  - glyph cut into 12 horizontal strips split into 1-3 chunks; offsets mostly horizontal (A_x = 8*A_y),
 *    weighted to the top; at peak chunks drift up, thin scanlines kick out, some strips swap source rows
 *  - re-convergence: critically damped spring k=180, d=22 on intensity
 *  - typed char shows sharp ~220 ms then slices apart to hide; delete ejects upward and fades
 *  - locked: alarm red #ff2238, red vignette, crawling scanlines, random tears, constant light twitch, NO pulsing
 *  - #000 field, #e6e6e6 letters, bloom, cyan/red chromatic split; no dash drawn between groups
 */
export function createGlitchCodeField(canvas, opts = {}) {
  const FONT = opts.font || '"JetBrains Mono", ui-monospace, monospace';
  const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME = 1000 / 30;
  const P = { idle: '#e6e6e6', verify: '#e6e6e6', wrong: '#ff6a58', ok: '#ffffff', locked: '#ff2238', bg: '#000000', faint: '230,230,230', accent: '243,182,63', glow: 0.75 };
  const bezier = (x1, y1, x2, y2) => { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 6; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-4) break; t -= d / (dX(t) || 1e-6); } return Y(t); }; };
  const easeSnap = bezier(0.16, 1, 0.3, 1);
  const hash = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
  const tc = document.createElement('canvas'), tr = document.createElement('canvas');
  if (!ctx || !lctx || !tc.getContext('2d') || !tr.getContext('2d')) throw new Error('Canvas unavailable');
  const S = { raw: '', phase: 'idle', secondsLeft: 0, peek: false, focused: false };
  const st = { prev: 'idle', W: 0, H: 0, dpr: 1, cache: new Map(), visible: true, raf: 0, last: 0, ghosts: [], timers: new Set(), destroyed: false };
  const slots = Array.from({ length: 8 }, () => ({ ch: '', I: 1, V: 0, target: 1, hold: 0, seed: (Math.random() * 997) | 0, step: 0, nextStep: 0, scr: false, scrAt: 0 }));
  const clearTimers = () => { st.timers.forEach(clearTimeout); st.timers.clear(); };
  const later = (ms, fn) => { if (st.destroyed) return; if (reduce || !ms) return fn(); const timer=setTimeout(() => { st.timers.delete(timer); if (!st.destroyed) { fn(); loop(); } }, ms); st.timers.add(timer); };

  const fit = () => { if (st.destroyed) return; const r = canvas.getBoundingClientRect(); st.dpr = Math.min(2, devicePixelRatio || 1); st.W = r.width; st.H = r.height;
    for (const c of [canvas, layer, tc, tr]) { c.width = Math.max(1, Math.round(r.width * st.dpr)); c.height = Math.max(1, Math.round(r.height * st.dpr)); } st.cache.clear(); loop(); };
  const ro = new ResizeObserver(fit); ro.observe(canvas);
  const io = new IntersectionObserver(e => { st.visible = e[0].isIntersecting; if (st.visible) loop(); }); io.observe(canvas);
  if (document.fonts) document.fonts.ready.then(() => { if (!st.destroyed) { st.cache.clear(); loop(); } });

  function layout() { const pad = Math.max(12, st.W * 0.05), gap = Math.max(8, st.W * 0.022);
    const sw = Math.min((st.W - 2 * pad - 7 * gap) / 8, st.H * 0.48), total = 8 * sw + 7 * gap; let x = (st.W - total) / 2; const cells = [];
    for (let i = 0; i < 8; i++) { cells.push({ x, w: sw }); x += sw + gap; }
    return { cells, sh: sw * 1.4, top: (st.H - sw * 1.4) / 2 + 4 }; }
  function glyph(ch, w, h, color) { const key = ch + '|' + w.toFixed(1) + '|' + color + '|' + st.dpr; if (st.cache.has(key)) return st.cache.get(key);
    const d = st.dpr, c = document.createElement('canvas'); c.width = Math.ceil(w * d); c.height = Math.ceil(h * d); const x = c.getContext('2d');
    x.fillStyle = color; x.font = '800 ' + Math.round(h * d * 0.9) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, c.width / 2, c.height * 0.54);
    if (st.cache.size > 300) st.cache.clear(); st.cache.set(key, c); return c; }
  function advance(sl, now) { if (now < sl.nextStep) return; sl.step++; const peak = sl.I > 0.6 || S.phase === 'verify' || S.phase === 'wrong';
    const frames = peak ? [1, 3, 4][(Math.random() * 3) | 0] : 2 + ((Math.random() * 3) | 0); sl.nextStep = now + frames * FRAME; }
  function drawSlot(g, sl, c, L, I, color, T, alpha, lift) {
    const img = glyph(sl.ch, c.w, L.sh, color), d = st.dpr, rows = 12, rh = L.sh / rows, step = reduce ? 0 : sl.step, seed = sl.seed, Ax = c.w * 1.35, Ay = Ax / 8;
    g.imageSmoothingEnabled = false;
    for (let r = 0; r < rows; r++) {
      const yF = r / (rows - 1), M = 0.45 + 0.55 * (1 - yF), sway = Math.sin(2 * Math.PI * 0.25 * T + seed) * 0.6 * (1 - yF), shimmer = 0.9 + 0.1 * Math.sin(T * 9 + r * 1.3 + seed);
      const cuts = I > 0.05 ? 1 + ((hash(r, seed, step) * 3) | 0) : 1; let x0 = 0;
      for (let k = 0; k < cuts; k++) {
        const x1 = k === cuts - 1 ? c.w : x0 + c.w * (0.25 + hash(r + k, seed + 11, step) * 0.5) * (1 - x0 / c.w);
        let dx = 0, dy = 0, sr = r, a = alpha * shimmer;
        if (I > 0.003) {
          dx = (hash(r * 7 + k, seed + 3, step) - 0.5) * 2 * Ax * M * I; dy = (hash(r, k + seed + 5, step) - 0.5) * 2 * Ay * M * I;
          if (I > 0.55 && hash(r, k + seed + 9, step) < 0.35) dy -= (0.5 + hash(k, r, seed) * 1.5) * rh * I * (1 + (step % 6) * 0.35);
          if (I > 0.4 && hash(r + k, seed + 13, step) < 0.3 * I) sr = (hash(r, k, step + seed) * rows) | 0;
          if (hash(r, k + seed + 17, step) < 0.12 * I) a = 0;
        }
        dy -= lift;
        const sx = x0 * d, sw = (x1 - x0) * d;
        if (sw > 0.5 && a > 0.01) { g.globalAlpha = a; g.drawImage(img, sx, sr * rh * d, sw, rh * d, Math.round(c.x + x0 + dx + sway), Math.round(L.top + r * rh + dy), x1 - x0, rh + 0.5); }
        x0 = x1;
      }
      if (I > 0.35 && hash(r, seed + 21, step) < 0.22 * I) { const lw = c.w * (0.6 + hash(r, seed, step) * 0.9), kx = (hash(r, seed + 23, step) - 0.5) * 2 * Ax * 1.4 * I; g.globalAlpha = alpha * 0.85;
        g.drawImage(img, 0, (r * rh + rh * 0.45) * d, c.w * d, Math.max(1, 2 * d), Math.round(c.x + kx), Math.round(L.top + r * rh + rh * 0.45), lw, 2); }
    }
    g.globalAlpha = 1;
  }
  function loop() { if (!st.destroyed && !st.raf && st.visible) st.raf = requestAnimationFrame(frame); }
  function frame(now) {
    st.raf = 0; if (st.destroyed || !st.visible) return; const dt = Math.min(50, now - (st.last || now)) / 1000; st.last = now; const T = reduce ? 0 : now / 1000, pnow = performance.now(), L = layout(), g = lctx, LK = S.phase === 'locked';
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.W, st.H);
    slots.forEach((sl, i) => { const c = L.cells[i], y1 = L.top + L.sh;
      if (!sl.ch) { g.fillStyle = 'rgba(' + P.faint + ',.18)'; g.fillRect(c.x + c.w * 0.15, y1 + 6, c.w * 0.7, 1);
        if (S.phase === 'idle' && S.focused && i === S.raw.length) { g.fillStyle = 'rgba(' + P.accent + ',' + (0.6 + 0.4 * Math.sin(T * 6)) + ')'; g.fillRect(c.x + c.w * 0.15, y1 + 4, c.w * 0.7, 3); } return; }
      if (sl.scr && pnow >= sl.scrAt) { sl.ch = POOL[(Math.random() * POOL.length) | 0]; sl.scrAt = pnow + 100; }
      if (sl.hold && pnow >= sl.hold) { sl.hold = 0; sl.target = S.peek ? 0 : 1; }
      if (sl.target > sl.I) { sl.I = Math.min(sl.target, sl.I + dt * 9); sl.V = 0; }
      else { const f = -180 * (sl.I - sl.target) - 22 * sl.V; sl.V += f * dt; sl.I += sl.V * dt; if (Math.abs(sl.I - sl.target) < 0.002 && Math.abs(sl.V) < 0.01) { sl.I = sl.target; sl.V = 0; } }
      if (reduce) sl.I = sl.target;
      advance(sl, pnow); drawSlot(g, sl, c, L, Math.max(0, sl.I), P[S.phase] || P.idle, T, 1, 0);
    });
    st.ghosts = st.ghosts.filter(gh => { const p = Math.max(0, (pnow - gh.start) / (reduce ? 1 : gh.red ? 700 : 450)); if (p >= 1) return false; const e = easeSnap(p); advance(gh, pnow);
      drawSlot(g, gh, L.cells[gh.i], L, Math.min(1.4, (gh.red ? 0.2 : 0.7) + e), gh.red ? P.locked : P.idle, T, 1 - e, e * L.sh * 0.35); return true; });
    const m = ctx, W = canvas.width, H = canvas.height; m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = P.bg; m.fillRect(0, 0, W, H);
    if (LK) { const v = m.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(120,0,12,.10)'); v.addColorStop(1, 'rgba(60,0,6,.55)'); m.fillStyle = v; m.fillRect(0, 0, W, H); }
    m.save(); m.globalCompositeOperation = 'lighter'; m.filter = 'blur(' + 10 * st.dpr + 'px)'; m.globalAlpha = P.glow; m.drawImage(layer, 0, 0);
    m.filter = 'blur(' + 3 * st.dpr + 'px)'; m.globalAlpha = 0.6; m.drawImage(layer, 0, 0); m.restore();
    if (!reduce) { let gI = st.ghosts.length ? 1 : 0; slots.forEach(sl => { if (sl.ch) gI = Math.max(gI, Math.min(1, sl.I)); });
      if (S.phase === 'verify' || S.phase === 'wrong') gI = 1; if (LK) gI = Math.max(gI, 0.45);
      const s3 = Math.floor(pnow / (FRAME * 3)), j = hash(s3, 7, 3), off = (0.7 + gI * (2 + j * 5)) * st.dpr, vy = hash(s3, 9, 1) < 0.15 * gI ? (hash(s3, 2, 2) - 0.5) * 4 * st.dpr : 0;
      for (const [cv, col] of [[tc, '#00f0ff'], [tr, '#ff2a4d']]) { const x = cv.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H); x.drawImage(layer, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, W, H); }
      m.save(); m.globalCompositeOperation = 'lighter'; m.globalAlpha = 0.55 + 0.3 * gI; m.drawImage(tc, -off, vy); m.drawImage(tr, off, -vy); m.restore(); }
    m.drawImage(layer, 0, 0);
    if (LK) { m.fillStyle = 'rgba(0,0,0,.38)'; const sp = 3 * st.dpr, o = Math.floor(T * 40) % sp; for (let y = o; y < H; y += sp) m.fillRect(0, y, W, Math.max(1, st.dpr));
      const b = Math.floor(pnow / 90); if (!reduce && hash(b, 5, 5) < 0.18) { const ty = hash(b, 6, 6) * H, th = (4 + hash(b, 8, 8) * 18) * st.dpr; m.drawImage(canvas, 0, ty, W, th, (hash(b, 9, 9) - 0.5) * 40 * st.dpr, ty, W, th); } }
    if (!reduce) loop();
  }
  function apply() {
    const ph = S.phase, prev = st.prev, now = performance.now(); st.prev = ph;
    slots.forEach((sl, i) => { const want = S.raw[i] || '';
      if (ph === 'locked') { const t = ('WAIT' + String(Math.max(0, S.secondsLeft | 0)).padStart(4, '0'))[i];
        if (prev !== 'locked') { sl.scr = false; sl.hold = 0; sl.ch = t; sl.I = 1.3; sl.target = 1; later(i * 70, () => { sl.target = 0.07; }); } else sl.ch = t; return; }
      if (ph === 'verify') { if (prev !== 'verify') { sl.hold = 0; sl.target = 1; if (want && !reduce) { sl.scr = true; sl.scrAt = now + i * 40; } } return; }
      sl.scr = false;
      if (ph === 'ok') { if (prev !== 'ok') { sl.ch = want; sl.I = 1; sl.V = 0; later(i * 90, () => { sl.target = 0; }); } return; }
      if (ph === 'wrong') { if (prev !== 'wrong') { sl.ch = want; sl.I = 1.2; sl.target = S.peek ? 0 : 1; } return; }
      if (want !== sl.ch) {
        if (sl.ch && (!want || prev === 'locked')) st.ghosts.push({ i, ch: sl.ch, start: now + (prev === 'locked' ? i * 60 : 0), seed: sl.seed, step: sl.step, nextStep: 0, I: 1, red: prev === 'locked' });
        sl.ch = want; if (want) { sl.I = 0; sl.V = 0; sl.target = 0; sl.hold = reduce ? 0 : now + 220; sl.target = reduce ? (S.peek ? 0 : 1) : 0; sl.seed = (Math.random() * 997) | 0; }
      } else if (!sl.hold) sl.target = S.peek ? 0 : 1;
    });
    loop();
  }
  fit();
  return {
    set(next) { if (st.destroyed) return; const changed = ['raw','phase','peek'].some(key => key in next && next[key] !== S[key]); if (changed) clearTimers(); const peekChanged = 'peek' in next && next.peek !== S.peek; Object.assign(S, next);
      S.raw = String(S.raw || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
      if (peekChanged && (S.phase === 'idle' || S.phase === 'wrong')) slots.forEach((sl, i) => { if (sl.ch) { sl.hold = 0; later(i * 35, () => { sl.target = S.peek ? 0 : 1; loop(); }); } });
      apply(); },
    destroy() { st.destroyed=true; cancelAnimationFrame(st.raf); ro.disconnect(); io.disconnect(); clearTimers(); st.cache.clear(); },
  };
}
