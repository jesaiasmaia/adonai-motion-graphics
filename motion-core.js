/* ============================================================
   ADONAI MOTION CORE — harness compartilhado das peças
   - injeta @font-face (Manrope + Geist Mono locais)
   - easings e helpers matemáticos
   - relógio: playback por rAF OU seek determinístico (?t=segundos)
     usado pelo exportador de vídeo (tools/export.mjs)
   A demo define: window.DUR (duração do loop) e window.render(t).
   ============================================================ */
(function () {
  if (!document.getElementById('adn-fonts')) {
    const s = document.createElement('style');
    s.id = 'adn-fonts';
    s.textContent = `
      @font-face{font-family:'Manrope';src:url('fonts/Manrope-var.woff2') format('woff2-variations');font-weight:100 900;font-display:block}
      @font-face{font-family:'Geist Mono';src:url('fonts/GeistMono-var.woff2') format('woff2-variations');font-weight:100 900;font-display:block}
    `;
    document.head.appendChild(s);
  }

  const TAU = Math.PI * 2;
  window.ADN = {
    TAU,
    // easings
    linear: t => t,
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    outQuint: t => 1 - Math.pow(1 - t, 5),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    // math
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    seg: (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a))),
    // PRNG determinístico (mulberry32) — mesmo resultado em playback e export
    rng: seed => {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    // pallete oficial (extraída de adonaitech.com.br)
    C: {
      navy: '#07182D', navy2: '#0D2848', teal: '#31DDD4', mint: '#78EEC7',
      green: '#00D294', gold: '#FCBB00', blue: '#2454E6', ink: '#EAF7F6',
      ivory: '#F7F8F4', badge: '#0A1526',
    },
    // LOGO OFICIAL (replicado do site): quadrado arredondado navy com
    // "A" sólido ivory de topo aplainado + crossbar turquesa com nó circular
    logoSVG: (size = 120, extra = '') => `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" ${extra}>
        <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="#0A1526" stroke="rgba(49,221,212,.3)"/>
        <path d="M15 46 30 15h7l12 31h-9l-6.5-18.5L25 46H15Z" fill="#F7F8F4"/>
        <path d="M28 38h16" stroke="#31DDD4" stroke-width="5" stroke-linecap="round"/>
        <circle cx="46" cy="38" r="4" fill="#31DDD4"/>
      </svg>`,
    // pontos DENTRO da forma do símbolo oficial (fill), espaço 0..64 —
    // desenha o logo em offscreen e amostra pixels (centro do A: 32,30.5)
    logoPoints(n) {
      const SZ = 256, sc = SZ / 64;
      const off = document.createElement('canvas');
      off.width = off.height = SZ;
      const o = off.getContext('2d');
      o.scale(sc, sc); // desenha em unidades 0..64 dentro do canvas 256
      o.fillStyle = '#fff';
      o.fill(new Path2D('M15 46 30 15h7l12 31h-9l-6.5-18.5L25 46H15Z'));
      o.strokeStyle = '#fff'; o.lineWidth = 5; o.lineCap = 'round';
      o.beginPath(); o.moveTo(28, 38); o.lineTo(44, 38); o.stroke();
      o.beginPath(); o.arc(46, 38, 4, 0, Math.PI * 2); o.fill();
      const data = o.getImageData(0, 0, SZ, SZ).data;
      const cand = [];
      for (let y = 0; y < SZ; y += 3)
        for (let x = 0; x < SZ; x += 3)
          if (data[(y * SZ + x) * 4 + 3] > 120) cand.push({ x: x / sc, y: y / sc });
      const r = window.ADN.rng(77);
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(cand[Math.floor(r() * cand.length)]);
      return pts;
    },
  };

  // palco fixo 1920×1080 escalado para caber na janela
  window.ADN.fitStage = function (stage) {
    const fit = () => {
      const s = Math.min(innerWidth / 1920, innerHeight / 1080);
      stage.style.transform = `scale(${s})`;
    };
    addEventListener('resize', fit); fit();
  };

  // HUD técnico (assinatura do pack) + relógio
  window.ADN.hud = function (stage, label) {
    const d = document.createElement('div');
    d.innerHTML = `
      <div style="position:absolute;top:34px;left:44px;font:500 17px 'Geist Mono';letter-spacing:.22em;color:#31DDD4;opacity:.4">ADONAI · MOTION LAB — ${label}</div>
      <div style="position:absolute;bottom:34px;right:44px;font:500 17px 'Geist Mono';letter-spacing:.22em;color:#31DDD4;opacity:.4" id="adn-tc">00:00:00</div>`;
    stage.appendChild(d);
    return t => {
      const f = Math.floor((t % 1) * 30);
      const s = Math.floor(t) % 60, m = Math.floor(t / 60);
      const p = n => String(n).padStart(2, '0');
      d.querySelector('#adn-tc').textContent = `${p(m)}:${p(s)}:${p(f)}`;
    };
  };

  // boot: playback ou seek estático p/ export
  // demo pode definir window.__waitFonts() -> promise extra (ex.: forçar
  // download de fonte usada só em canvas)
  const q = new URLSearchParams(location.search);
  const EXPORT = q.has('t');
  function boot() {
    document.fonts.ready
      .then(() => (window.__waitFonts ? window.__waitFonts() : null))
      .then(() => {
        if (EXPORT) {
          window.__seek = t => window.render(t);
          window.__seek(parseFloat(q.get('t')) || 0);
          window.__ready = true;
      } else {
        let start = performance.now();
        window.__resyncClock = () => { start = performance.now(); };
        const dur = window.DUR || 6;
        (function loop(now) {
          window.render(((now - start) / 1000) % dur);
          requestAnimationFrame(loop);
        })(start);
      }
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
