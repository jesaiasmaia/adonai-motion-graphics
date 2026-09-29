// Render do teste de replicação (test-opus/index.html) → MP4 1080p30 com som.
// uso: node render-test.mjs [smoke]
//   smoke = só 4 frames de verificação (test-opus/frames/)
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TDIR = path.join(ROOT, 'test-opus');
const SMOKE = process.argv[2] === 'smoke';
const FPS = 30, W = 1920, H = 1080, DUR = 26;

// motor de som compartilhado
await import(path.join(ROOT, 'sound-engine.js'));
const { ADN_SOUND } = globalThis;

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

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

async function shot(t, file) {
  await page.goto(`file://${TDIR}/index.html?t=${t}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true', { timeout: 10000 });
  await page.evaluate(t => window.__seek(t), t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

if (SMOKE) {
  rmSync(`${TDIR}/frames`, { recursive: true, force: true });
  mkdirSync(`${TDIR}/frames`, { recursive: true });
  for (const t of [2.5, 8.0, 15.5, 22.0]) await shot(t, `${TDIR}/frames/check_${String(t).replace('.', '_')}.jpg`);
  console.log('smoke ok');
} else {
  const dir = `${TDIR}/frames/f`;
  rmSync(`${TDIR}/frames`, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const N = Math.round(DUR * FPS);
  for (let i = 0; i < N; i++) {
    await shot(i / FPS, `${dir}/f_${String(i).padStart(5, '0')}.jpg`);
    if (i % 60 === 0) console.log(`${i}/${N}`);
  }
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${dir}/f_%05d.jpg`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', `${TDIR}/opus-test.silent.mp4`]);
  // som pela mesma engine das peças da marca
  const { L, R, sr } = ADN_SOUND.render('test-opus', 44100);
  writeFileSync(`${TDIR}/opus-test.wav`, wav16(L, R, sr));
  execFileSync('ffmpeg', ['-y', '-i', `${TDIR}/opus-test.silent.mp4`, '-i', `${TDIR}/opus-test.wav`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest',
    `${TDIR}/opus-test.mp4`]);
  rmSync(`${TDIR}/opus-test.silent.mp4`);
  rmSync(`${TDIR}/frames`, { recursive: true, force: true });
  console.log('OK test-opus/opus-test.mp4');
}
await browser.close();
