// Exportador de vídeo das peças ADONAI Motion Lab
// uso:  node export.mjs smoke   → 3 frames de teste por peça (frames/smoke/)
//       node export.mjs full    → MP4 1080p30 + GIF 560px em exports/
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODE = process.argv[2] || 'full';

const DEMOS = [
  ['01-genesis-reveal', 6],
  ['02-kinetic-type', 6],
  ['03-circuit-pulse', 6],
  ['04-aurora-flow', 8],
  ['05-particle-morph', 8],
  ['06-broadcast-pack', 10],
];
const FPS = 30, W = 1920, H = 1080;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

async function shot(name, t, file) {
  await page.goto(`file://${ROOT}/${name}.html?t=${t}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true', { timeout: 10000 });
  await page.evaluate(t => window.__seek(t), t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

if (MODE === 'smoke') {
  rmSync(`${ROOT}/frames/smoke`, { recursive: true, force: true });
  mkdirSync(`${ROOT}/frames/smoke`, { recursive: true });
  for (const [name, dur] of DEMOS) {
    for (const [i, f] of [0.18, 0.55, 0.85].entries()) {
      await shot(name, dur * f, `${ROOT}/frames/smoke/${name}_f${i}.jpg`);
    }
    console.log('smoke ok:', name);
  }
} else {
  mkdirSync(`${ROOT}/exports`, { recursive: true });
  for (const [name, dur] of DEMOS) {
    const dir = `${ROOT}/frames/${name}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const N = Math.round(dur * FPS);
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await shot(name, i / FPS, `${dir}/f_${String(i).padStart(5, '0')}.jpg`);
      if (i % 30 === 0) console.log(`${name} ${i}/${N}`);
    }
    execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${dir}/f_%05d.jpg`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', `${ROOT}/exports/${name}.mp4`]);
    execFileSync('ffmpeg', ['-y', '-i', `${ROOT}/exports/${name}.mp4`,
      '-vf', 'fps=14,scale=560:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
      `${ROOT}/exports/${name}.gif`]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`OK ${name} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
await browser.close();
console.log('done:', MODE);
