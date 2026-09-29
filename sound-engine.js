/* ============================================================
   ADONAI SOUND ENGINE — síntese determinística compartilhada
   - mesmo motor roda no navegador (audio.js) e no Node
     (tools/render-audio.mjs → WAV → mux nos MP4)
   - cada peça é uma lista de "vozes" (eventos) alinhadas à
     timeline visual (window.DUR de cada demo)
   ============================================================ */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- banco de peças ----------
     k: kick | sub | drone | bell | zap | tick | whoosh | riser | crash | noisebed
     t início(s) · d duração(s) · f0/f1 freq(Hz) · g ganho · pan -1..1
     a attack(s) · dec decay exp(s) · tr tremolo(Hz) · lp cutoff · bp:[f0,f1] glide */
  const PIECES = {

    '01-genesis': { dur: 6, echo: { t: 0.24, mix: 0.22 }, ev: (() => {
      const ev = [
        { t: 0, d: 6, k: 'drone', f0: 55, g: 0.16, a: 0.8, lp: 500 },
        { t: 0, d: 6, k: 'drone', f0: 110, g: 0.07, a: 1.2, pan: 0.3 },
        { t: 0.45, d: 1.45, k: 'riser', f0: 220, f1: 1400, g: 0.16 },
        { t: 2.35, d: 0.6, k: 'whoosh', bp: [500, 2800], g: 0.42 },
        { t: 2.95, d: 1.0, k: 'kick', f0: 100, f1: 36, dec: 0.9, g: 0.6 },
      ];
      for (let i = 0; i < 6; i++) ev.push({ t: 1.15 + i * 0.22, d: 0.9, k: 'bell', f0: 1600 + i * 260, g: 0.05 + i * 0.008, dec: 0.5, pan: Math.cos(i * 2.1) * 0.7 });
      [220, 329.63, 554.37].forEach((f, i) => ev.push({ t: 3.02 + i * 0.07, d: 1.8, k: 'bell', f0: f, g: 0.16 - i * 0.02, dec: 1.3, pan: i % 2 ? 0.3 : -0.3 }));
      for (let i = 0; i < 30; i++) ev.push({ t: 3.78 + i * 0.0433, d: 0.05, k: 'tick', g: 0.05, pan: i % 2 ? 0.15 : -0.15 });
      ev.push({ t: 5.5, d: 0.5, k: 'whoosh', bp: [1200, 300], g: 0.18 });
      return ev;
    })() },

    '02-kinetic': { dur: 6, echo: { t: 0.2, mix: 0.18 }, ev: (() => {
      const ev = [{ t: 0, d: 6, k: 'drone', f0: 55, g: 0.1, a: 0.5, lp: 300 }];
      [0, 1.05, 2.0, 2.85, 3.7].forEach((t, i) => {
        ev.push({ t, d: 0.5, k: 'kick', f0: 130, f1: 42, dec: 0.32, g: 0.55, pan: i % 2 ? 0.12 : -0.12 });
        ev.push({ t, d: 0.06, k: 'tick', g: 0.2 });
      });
      ev.push({ t: 4.2, d: 0.35, k: 'riser', f0: 200, f1: 1800, g: 0.2 });
      for (let i = 0; i < 10; i++) ev.push({ t: 4.62 + i * 0.04 + (i * 7 % 3) * 0.008, d: 0.035, k: 'zap', f0: 700 + (i * 137) % 900, g: 0.16, pan: ((i % 3) - 1) * 0.6 });
      ev.push({ t: 4.98, d: 1.2, k: 'kick', f0: 75, f1: 28, dec: 1.1, g: 0.65 });
      ev.push({ t: 4.98, d: 1.0, k: 'crash', g: 0.1, dec: 0.7 });
      [440, 659.25].forEach((f, i) => ev.push({ t: 5.0 + i * 0.08, d: 1.4, k: 'bell', f0: f, g: 0.13, dec: 1.2, pan: i ? 0.35 : -0.35 }));
      ev.push({ t: 5.5, d: 0.45, k: 'whoosh', bp: [1500, 250], g: 0.2 });
      return ev;
    })() },

    '03-circuit': { dur: 6, echo: { t: 0.26, mix: 0.25 }, ev: (() => {
      const ev = [
        { t: 0.3, d: 3.2, k: 'drone', f0: 58, g: 0.12, a: 0.6, lp: 400 },
        { t: 0.3, d: 3.2, k: 'drone', f0: 116, g: 0.05, a: 0.8, pan: -0.2, lp: 600 },
        { t: 2.35, d: 1.2, k: 'bell', f0: 1320, g: 0.1, dec: 0.8 },
        { t: 3.18, d: 1.6, k: 'sub', f0: 130, f1: 30, g: 0.5 },
        { t: 3.2, d: 1.0, k: 'crash', g: 0.14, dec: 0.6 },
        { t: 3.55, d: 0.9, k: 'bell', f0: 880, g: 0.07, dec: 0.7, pan: -0.3 },
        { t: 3.77, d: 0.9, k: 'bell', f0: 880, g: 0.05, dec: 0.7, pan: 0.3 },
        { t: 3.4, d: 2.6, k: 'drone', f0: 110, g: 0.1, a: 0.3, pan: 0.15 },
        { t: 3.4, d: 2.6, k: 'drone', f0: 165, g: 0.06, a: 0.4, pan: -0.15 },
      ];
      for (let i = 0; i < 12; i++) {
        const t0 = 0.3 + i * 0.13;
        ev.push({ t: t0, d: 0.05, k: 'tick', g: 0.04, pan: ((i % 5) - 2) / 2 * 0.8 });
        ev.push({ t: t0 + 1.55, d: 0.05, k: 'zap', f0: 800 + i * 70, g: 0.09, pan: ((i % 5) - 2) / 2 * 0.8 });
      }
      [220, 277.18, 329.63, 440].forEach((f, i) => ev.push({ t: 3.24 + i * 0.05, d: 1.8, k: 'bell', f0: f, g: 0.13, dec: 1.4, pan: i % 2 ? 0.25 : -0.25 }));
      return ev;
    })() },

    /* loop perfeito: tremolos com período que divide 8s e caudas que envolvem */
    '04-aurora': { dur: 8, echo: { t: 0.5, mix: 0.22 }, ev: [
      { t: 0, d: 8, k: 'drone', f0: 55, g: 0.12, a: 1 },
      { t: 0, d: 8, k: 'drone', f0: 110, g: 0.1, a: 1.5, tr: 0.25, pan: -0.4 },
      { t: 0, d: 8, k: 'drone', f0: 164.81, g: 0.08, a: 2, tr: 0.5, pan: 0.4 },
      { t: 0, d: 8, k: 'drone', f0: 220, g: 0.06, a: 2.5, tr: 1 },
      { t: 0, d: 8, k: 'drone', f0: 493.88, g: 0.03, a: 3, tr: 0.5, pan: 0.2 },
      { t: 0, d: 8, k: 'noisebed', g: 0.025, lp: 600, tr: 0.25 },
      { t: 0, d: 2.2, k: 'bell', f0: 220, g: 0.09, dec: 1.6, pan: -0.5 },
      { t: 1, d: 2.2, k: 'bell', f0: 329.63, g: 0.09, dec: 1.6, pan: 0.5 },
      { t: 2, d: 2.2, k: 'bell', f0: 440, g: 0.09, dec: 1.6, pan: -0.5 },
      { t: 3, d: 2.2, k: 'bell', f0: 329.63, g: 0.09, dec: 1.6, pan: 0.5 },
      { t: 4, d: 2.2, k: 'bell', f0: 493.88, g: 0.09, dec: 1.6, pan: -0.5 },
      { t: 5, d: 2.2, k: 'bell', f0: 440, g: 0.09, dec: 1.6, pan: 0.5 },
      { t: 6, d: 2.2, k: 'bell', f0: 329.63, g: 0.09, dec: 1.6, pan: -0.5 },
      { t: 7, d: 2.2, k: 'bell', f0: 261.63, g: 0.09, dec: 1.6, pan: 0.5 },
    ] },

    '05-particles': { dur: 8, echo: { t: 0.4, mix: 0.2 }, ev: [
      { t: 0, d: 8, k: 'drone', f0: 55, g: 0.1, a: 0.6 },
      { t: 0, d: 8, k: 'noisebed', g: 0.02, lp: 800, tr: 0.5 },
      { t: 0.7, d: 1.0, k: 'whoosh', bp: [250, 2000], g: 0.3 },
      { t: 1.9, d: 1.0, k: 'bell', f0: 1760, g: 0.05, dec: 0.7, pan: -0.5 },
      { t: 2.35, d: 1.0, k: 'bell', f0: 2217, g: 0.05, dec: 0.7, pan: 0.2 },
      { t: 2.8, d: 1.0, k: 'bell', f0: 2637, g: 0.05, dec: 0.7, pan: 0.6 },
      { t: 3.05, d: 0.5, k: 'whoosh', bp: [2500, 300], g: 0.45 },
      { t: 3.1, d: 0.9, k: 'kick', f0: 110, f1: 30, dec: 0.8, g: 0.6 },
      { t: 3.1, d: 0.05, k: 'zap', f0: 1600, g: 0.2 },
      { t: 3.55, d: 0.9, k: 'whoosh', bp: [300, 2400], g: 0.3 },
      { t: 4.45, d: 1.8, k: 'bell', f0: 220, g: 0.12, dec: 1.5 },
      { t: 4.51, d: 1.8, k: 'bell', f0: 329.63, g: 0.1, dec: 1.5, pan: 0.3 },
      { t: 4.57, d: 1.8, k: 'bell', f0: 440, g: 0.08, dec: 1.5, pan: -0.3 },
      { t: 4.5, d: 2.2, k: 'drone', f0: 110, g: 0.08, a: 0.4, pan: -0.3 },
      { t: 4.5, d: 2.2, k: 'drone', f0: 330, g: 0.05, a: 0.5, pan: 0.3 },
      { t: 6.7, d: 1.0, k: 'whoosh', bp: [1800, 200], g: 0.28 },
    ] },

    '06-broadcast': { dur: 10, echo: { t: 0.24, mix: 0.18 }, ev: [
      { t: 0.3, d: 0.65, k: 'whoosh', bp: [300, 1600], g: 0.35 },
      { t: 0.95, d: 0.06, k: 'tick', g: 0.15 },
      { t: 1.35, d: 0.06, k: 'tick', g: 0.08, pan: 0.2 },
      { t: 2.8, d: 0.5, k: 'whoosh', bp: [1600, 300], g: 0.3 },
      { t: 3.5, d: 0.6, k: 'whoosh', bp: [250, 1200], g: 0.32 },
      { t: 4.12, d: 1.2, k: 'bell', f0: 987.77, g: 0.1, dec: 1.0 },
      { t: 3.6, d: 2.6, k: 'drone', f0: 880, g: 0.045, a: 0.5, tr: 3, lp: 2000 },
      { t: 6.25, d: 0.5, k: 'whoosh', bp: [1200, 250], g: 0.28 },
      { t: 6.6, d: 0.9, k: 'riser', f0: 120, f1: 900, g: 0.3 },
      { t: 7.5, d: 1.3, k: 'kick', f0: 140, f1: 28, dec: 1.2, g: 0.7 },
      { t: 7.5, d: 1.1, k: 'crash', g: 0.16, dec: 0.8 },
      { t: 7.52, d: 0.06, k: 'tick', g: 0.2 },
      { t: 7.55, d: 1.7, k: 'drone', f0: 55, g: 0.14, a: 0.05 },
      { t: 9.15, d: 0.6, k: 'whoosh', bp: [1400, 200], g: 0.32 },
    ] },

    /* teste de replicação (test-opus/index.html) — 26s */
    'test-opus': { dur: 26, echo: { t: 0.3, mix: 0.16 }, ev: (() => {
      const ev = [
        { t: 0, d: 26, k: 'drone', f0: 55, g: 0.08, a: 2 },
        { t: 0, d: 26, k: 'noisebed', g: 0.016, lp: 700, tr: 0.25 },
        { t: 1.2, d: 1.5, k: 'bell', f0: 880, g: 0.07, dec: 1.0, pan: -0.3 },
        { t: 2.7, d: 1.2, k: 'bell', f0: 1174.66, g: 0.05, dec: 0.9, pan: 0.2 },
        { t: 12.0, d: 0.6, k: 'whoosh', bp: [250, 1200], g: 0.26 },
        { t: 12.2, d: 0.8, k: 'whoosh', bp: [300, 1400], g: 0.2 },
        { t: 13.4, d: 0.8, k: 'whoosh', bp: [300, 1400], g: 0.2, pan: 0.3 },
        { t: 12.5, d: 1.2, k: 'bell', f0: 1320, g: 0.06, dec: 0.9 },
        { t: 23.2, d: 1.4, k: 'kick', f0: 70, f1: 28, dec: 1.2, g: 0.6 },
        { t: 23.2, d: 1.0, k: 'crash', g: 0.09, dec: 0.8 },
        { t: 24.8, d: 1.1, k: 'whoosh', bp: [1200, 180], g: 0.22 },
      ];
      for (let i = 0; i < 13; i++) ev.push({ t: 6.0 + i * 0.33, d: 0.05, k: 'tick', g: 0.05, pan: i % 2 ? 0.15 : -0.15 });
      for (let i = 0; i < 8; i++) ev.push({ t: 12.4 + i * 0.2, d: 0.05, k: 'tick', g: 0.04 });
      for (let i = 0; i < 12; i++) ev.push({ t: 14.4 + i * 0.2, d: 0.05, k: 'tick', g: 0.04 });
      for (let i = 0; i < 4; i++) {
        ev.push({ t: 20.0 + i * 0.14, d: 0.4, k: 'kick', f0: 120, f1: 45, dec: 0.3, g: 0.42, pan: i % 2 ? 0.2 : -0.2 });
        ev.push({ t: 20.0 + i * 0.14, d: 0.06, k: 'tick', g: 0.12 });
      }
      for (let i = 0; i < 7; i++) ev.push({ t: 21.2 + i * 0.24, d: 0.05, k: 'tick', g: 0.04 });
      return ev;
    })() },
  };

  /* ---------- render offline (compartilhado browser/node) ---------- */
  function render(id, sr = 44100) {
    const P = PIECES[id];
    const N = Math.round(P.dur * sr);
    const L = new Float32Array(N), R = new Float32Array(N);
    P.ev.forEach((v, idx) => voice(L, R, N, sr, v, rng(hash(id + ':' + idx))));
    if (P.echo) echoBuf(L, R, N, Math.round(P.echo.t * sr), P.echo.mix);
    master(L, R, N);
    return { L, R, sr, dur: P.dur };
  }

  function voice(L, R, N, sr, v, rnd) {
    const s0 = Math.round((v.t || 0) * sr);
    const len = Math.min(Math.round((v.d || 1) * sr), N);
    const g = v.g ?? 0.2, pan = v.pan || 0, k = v.k;
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    const a = v.a ?? (k === 'drone' || k === 'noisebed' || k === 'sub' ? 0.3 : 0.002);
    const dec = v.dec ?? 0.4;
    const atkN = Math.max(1, Math.round(a * sr));
    const aU = Math.max(0.02, a / (v.d || 1));
    const f0 = v.f0 ?? 440, f1 = v.f1 ?? v.f0 ?? 440;
    const bp = v.bp, bpExp = bp ? Math.log(bp[1] / bp[0]) : 0;
    // estado por voz
    const st = { lp1: 0, lp2: 0, hp: 0, ph: 0, mph: 0 };

    for (let i = 0; i < len; i++) {
      const t = i / sr, u = i / len;
      let y = 0;
      if (k === 'kick') {
        const f = f1 + (f0 - f1) * Math.exp(-t / 0.07);
        st.ph += TAU * f / sr;
        y = Math.sin(st.ph) * Math.exp(-t / dec) * Math.min(1, t / 0.002);
      } else if (k === 'sub') {
        const f = f0 + (f1 - f0) * Math.min(1, u / 0.8);
        st.ph += TAU * f / sr;
        y = Math.sin(st.ph) * env(u, aU);
      } else if (k === 'drone') {
        y = (Math.sin(TAU * f0 * t) + 0.5 * Math.sin(TAU * f0 * 1.5 * t)) * 0.5;
        if (v.tr) y *= 1 + 0.25 * Math.sin(TAU * v.tr * t);
        if (v.lp) y = lp(y, coef(v.lp, sr), st, 'lp1');
        y *= env(u, aU);
      } else if (k === 'bell') {
        st.mph += TAU * f0 * 2.01 / sr;
        y = Math.sin(TAU * f0 * t + 2.2 * Math.exp(-t / 0.09) * Math.sin(st.mph));
        y *= Math.exp(-t / dec) * Math.min(1, t / 0.004);
      } else if (k === 'zap') {
        y = Math.sign(Math.sin(TAU * f0 * (1 - 0.5 * u) * t)) * 0.6 * Math.exp(-t / 0.012);
      } else if (k === 'tick') {
        y = (rnd() * 2 - 1) * Math.exp(-t / 0.007) * 0.7
          + Math.sin(TAU * 3000 * t) * Math.exp(-t / 0.01) * 0.5;
      } else if (k === 'whoosh') {
        const c = bp[0] * Math.exp(bpExp * u), q = 1.2;
        y = rnd() * 2 - 1;
        y = lp(y, coef(Math.min(sr / 2.2, c * (1 + 1 / (2 * q))), sr), st, 'lp1');
        y = y - lp(y, coef(Math.max(20, c * (1 - 1 / (2 * q))), sr), st, 'lp2');
        y *= Math.pow(Math.sin(Math.PI * Math.min(1, u)), 1.3) * 2.4;
      } else if (k === 'riser') {
        const f = f0 * Math.pow(f1 / f0, u);
        st.ph += TAU * f / sr;
        y = 0.6 * Math.sin(st.ph) + 0.6 * (rnd() * 2 - 1);
        y = lp(y, coef(800 + 4000 * u, sr), st, 'lp1');
        y *= Math.pow(u, 1.8) * 1.4;
      } else if (k === 'crash') {
        y = rnd() * 2 - 1;
        y = y - lp(y, coef(5000, sr), st, 'hp');
        y *= Math.exp(-t / dec);
      } else if (k === 'noisebed') {
        y = lp(rnd() * 2 - 1, coef(v.lp || 600, sr), st, 'lp1');
        if (v.tr) y *= 1 + 0.3 * Math.sin(TAU * v.tr * t);
        y *= env(u, aU);
      }
      y *= g * (i < atkN ? i / atkN : 1);
      const j = (s0 + i) % N;
      L[j] += y * gl; R[j] += y * gr;
    }

    function env(u, aU2) { // attack + release suave nos últimos 25%
      return Math.min(1, u / aU2) * (u > 0.75 ? (1 - u) / 0.25 : 1);
    }
  }
  const coef = (fc, sr) => 1 - Math.exp(-TAU * fc / sr);
  function lp(x, a, st, tag) { st[tag] += a * (x - st[tag]); return st[tag]; }

  /* eco com feedback (wrap-around: transição de loop natural) */
  function echoBuf(L, R, N, D, mix) {
    for (let i = 0; i < N; i++) {
      const j = (i - D + N) % N;
      L[i] += mix * L[j];
      R[i] += mix * R[j];
    }
  }

  function master(L, R, N) {
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const s = peak > 0 ? 0.88 / peak : 1;
    for (let i = 0; i < N; i++) {
      L[i] = Math.tanh(L[i] * s * 1.1) / 1.1;
      R[i] = Math.tanh(R[i] * s * 1.1) / 1.1;
    }
  }

  root.ADN_SOUND = { PIECES, render };
})(typeof window !== 'undefined' ? window : globalThis);
