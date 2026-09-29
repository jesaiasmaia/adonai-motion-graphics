// Renderiza o áudio de cada peça (sound-engine.js) → WAV 16-bit estéreo
// e muxa nos MP4 existentes (vídeo sem recompressão).
// uso: node render-audio.mjs
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// carrega o motor compartilhado (define globalThis.ADN_SOUND)
await import(path.join(ROOT, 'sound-engine.js'));
const { ADN_SOUND } = globalThis;
if (!ADN_SOUND) throw new Error('sound-engine.js não carregou');

const SR = 44100;
// id da peça no sound-engine → nome do arquivo de vídeo
const FILENAMES = {
  '01-genesis': '01-genesis-reveal',
  '02-kinetic': '02-kinetic-type',
  '03-circuit': '03-circuit-pulse',
  '04-aurora': '04-aurora-flow',
  '05-particles': '05-particle-morph',
  '06-broadcast': '06-broadcast-pack',
};

const OUT = path.join(ROOT, 'exports', 'audio');
mkdirSync(OUT, { recursive: true });

function wav16(L, R, sr) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}

const stats = [];
for (const id of Object.keys(ADN_SOUND.PIECES)) {
  if (id === 'test-opus') continue; // peça de teste tem render próprio (render-test.mjs)
  const { L, R, sr, dur } = ADN_SOUND.render(id, SR);
  let peak = 0, rms = 0;
  for (let i = 0; i < L.length; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    rms += L[i] * L[i] + R[i] * R[i];
  }
  rms = Math.sqrt(rms / (2 * L.length));
  const wav = path.join(OUT, `${id}.wav`);
  writeFileSync(wav, wav16(L, R, sr));
  const base = FILENAMES[id];
  if (!base) throw new Error(`sem FILENAMES para ${id}`);
  const mp4 = path.join(ROOT, 'exports', `${base}.mp4`);
  const tmp = mp4 + '.tmp.mp4';
  execFileSync('ffmpeg', ['-y', '-i', mp4, '-i', wav,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', tmp]);
  execFileSync('mv', [tmp, mp4]);
  stats.push(`${base}  ${dur}s  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS  rms ${(20 * Math.log10(rms)).toFixed(1)} dBFS`);
  console.log('OK', base);
}
console.log('\n' + stats.join('\n'));
