/* ============================================================
   ADONAI AUDIO — player das demos (navegador)
   - botão 🔊 (política de autoplay exige gesto do usuário)
   - ao ativar: resync do relógio visual + loop do buffer
   - mesmo motor/som do WAV exportado (sound-engine.js)
   ============================================================ */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (q.has('t')) return; // modo export: sem áudio

  const piece = window.ADN_PIECE;
  if (!piece || !window.ADN_SOUND) return;
  const spec = window.ADN_SOUND.PIECES[piece];
  if (!spec) return;

  // chip de som
  const chip = document.createElement('button');
  chip.textContent = '🔊 ATIVAR SOM';
  Object.assign(chip.style, {
    position: 'fixed', left: '24px', bottom: '24px', zIndex: 99,
    font: '600 13px "Geist Mono", monospace', letterSpacing: '.18em',
    color: '#31DDD4', background: 'rgba(7,24,45,.85)', cursor: 'pointer',
    border: '1px solid rgba(49,221,212,.45)', borderRadius: '999px',
    padding: '10px 18px', backdropFilter: 'blur(6px)', transition: 'opacity .4s',
  });
  document.body.appendChild(chip);

  let ctx = null, src = null, gain = null, on = false, built = null;

  function buildBuffer(actx) {
    const { L, R, sr } = window.ADN_SOUND.render(piece);
    const buf = actx.createBuffer(2, L.length, sr);
    buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
    return buf;
  }

  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gain = ctx.createGain(); gain.connect(ctx.destination);
      built = buildBuffer(ctx);
    }
    ctx.resume();
    if (src) { try { src.stop(); } catch (e) {} }
    src = ctx.createBufferSource();
    src.buffer = built; src.loop = true;
    src.connect(gain);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    src.start();
    on = true;
    if (window.__resyncClock) window.__resyncClock(); // visual e áudio em fase
    chip.textContent = '🔊 SOM ATIVO — TECLA M SILENCIA';
    setTimeout(() => { chip.style.opacity = '0.35'; }, 2500);
  }
  function stop() {
    if (gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    on = false;
    chip.textContent = '🔇 SOM DESLIGADO';
    chip.style.opacity = '0.8';
  }

  chip.addEventListener('click', e => { e.stopPropagation(); on ? stop() : start(); });
  addEventListener('keydown', e => {
    if (e.key === 'm' || e.key === 'M') on ? stop() : start();
  });
})();
