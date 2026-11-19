/**
 * Erzeugt die Vorstellungsgrafik für Google Play (1024 × 500) aus echten Screenshots der App.
 *
 *   npm run feature:build
 *
 * Voraussetzung: Ein Android-Emulator läuft, die Debug-App ist installiert (siehe scripts/emu.ts).
 * Der Emulator sollte ein Handy mit 1080 × 2400 sein (z. B. „Medium Phone“), sonst passen die Proportionen nicht ganz.
 *
 * Ablauf:
 *  1. KI gegen KI: 30 Partien für die Statistik und eine Stellung nach 4 Runden fürs Brett (scripts/emu.ts).
 *  2. Spielstand und Statistik werden in der App eingesetzt, drei Screenshots aufgenommen:
 *     flaches Brett, Statistik, 3D-Ansicht.
 *  3. Die ursprünglichen Daten der App, die Drehung und die Statusleiste werden wiederhergestellt.
 *  4. Die drei Screenshots werden als Fächer zusammengesetzt → store/play-store-feature-1024x500.png
 *     (PNG ohne Alphakanal, wie Google Play es verlangt). Die Rohbilder landen in store/feature-src/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { KEYS, ROOT, begin, evaluate, loadStorage, log, makeBoard, makeStats, screencap, sleep } from './emu';

const OUT = join(ROOT, 'store/play-store-feature-1024x500.png');
const SRC = join(ROOT, 'store/feature-src');
const ASPECT = 1080 / 1830; // Breite : Höhe jedes Bildschirms im Fächer

// ------------------------------------------------------------------ Screenshots (Ausschnitte)

async function shotGame(name: string) {
  const r = await evaluate<{ top: number; dpr: number }>(
    `({top:document.querySelector('.boardBox').getBoundingClientRect().top,dpr:devicePixelRatio})`,
  );
  const png = screencap();
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const top = Math.max(0, Math.round((r.top - 36) * r.dpr));
  writeFileSync(join(SRC, name + '.png'), png);
  return sharp(png)
    .extract({ left: 0, top, width, height: Math.min(height - top, Math.round(width / ASPECT)) })
    .png()
    .toBuffer();
}
async function shotStats() {
  await evaluate(
    `document.getElementById('statsBtn').click();new Promise(r=>setTimeout(()=>{document.activeElement.blur();document.getElementById('stats').scrollTop=0;r(1)},600))`,
  );
  await sleep(800);
  const r = await evaluate<{ x: number; y: number; w: number; dpr: number }>(
    `(()=>{const b=document.getElementById('stats').getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,dpr:devicePixelRatio}})()`,
  );
  const png = screencap();
  const { height = 0 } = await sharp(png).metadata();
  writeFileSync(join(SRC, 'statistik.png'), png);
  const left = Math.round(r.x * r.dpr),
    top = Math.round(r.y * r.dpr),
    w = Math.round(r.w * r.dpr);
  await evaluate(`document.getElementById('stats').close();1`);
  return sharp(png)
    .extract({ left, top, width: w, height: Math.min(height - top, Math.round(w / ASPECT)) })
    .png()
    .toBuffer();
}

// ------------------------------------------------------------------ Zusammensetzen

async function compose(game: Buffer, stats: Buffer, view3d: Buffer) {
  const W = 1024,
    H = 500,
    CH = 400,
    CW = Math.round(CH * ASPECT),
    R = 16,
    SC = 3; // SC: Überabtastung für glatte Kanten beim Drehen
  const cards = [
    // Mittelpunkt und Drehung; die letzte Karte liegt oben
    { img: game, x: 268, y: 262, rot: -7 },
    { img: stats, x: 756, y: 262, rot: 7 },
    { img: view3d, x: 512, y: 248, rot: 0 },
  ];
  const uri = async (b: Buffer) =>
    'data:image/png;base64,' +
    (
      await sharp(b)
        .resize(CW * SC, CH * SC, { fit: 'cover', position: 'top', kernel: 'lanczos3' })
        .png()
        .toBuffer()
    ).toString('base64');
  const imgs = await Promise.all(cards.map(c => uri(c.img)));
  const oct = (cx: number, cy: number, r: number) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = ((22.5 + 45 * k) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const svg = `<svg width="${W * SC}" height="${H * SC}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3C6B5B"/><stop offset="1" stop-color="#162C26"/></radialGradient>
  <filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="11"/></filter>
  <clipPath id="clip"><rect x="${-CW / 2}" y="${-CH / 2}" width="${CW}" height="${CH}" rx="${R}"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<polygon points="${oct(70, 250, 200)}" fill="none" stroke="#F2D8A2" stroke-opacity=".08" stroke-width="14"/>
<polygon points="${oct(954, 250, 200)}" fill="none" stroke="#F2D8A2" stroke-opacity=".08" stroke-width="14"/>
${cards
  .map(
    (c, i) => `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})">
  <rect x="${-CW / 2}" y="${-CH / 2 + 10}" width="${CW}" height="${CH}" rx="${R}" fill="#000" fill-opacity=".5" filter="url(#b)"/>
  <image x="${-CW / 2}" y="${-CH / 2}" width="${CW}" height="${CH}" href="${imgs[i]}" clip-path="url(#clip)" preserveAspectRatio="none"/>
  <rect x="${-CW / 2 + 0.5}" y="${-CH / 2 + 0.5}" width="${CW - 1}" height="${CH - 1}" rx="${R}" fill="none" stroke="#fff" stroke-opacity=".18"/>
</g>`,
  )
  .join('\n')}
</svg>`;
  await sharp(Buffer.from(svg), { density: 72 })
    .resize(W, H, { kernel: 'lanczos3' })
    .flatten({ background: '#162C26' })
    .removeAlpha()
    .png()
    .toFile(OUT);
}

// ------------------------------------------------------------------ Ablauf

mkdirSync(SRC, { recursive: true });
log('KI-Partien für Statistik und Brett …');
const stats = makeStats(),
  board = makeBoard();

const ses = await begin(join(SRC, 'localStorage-backup.json'));
const data = {
  ...ses.backup,
  [KEYS.save]: JSON.stringify({ ...ses.save, marbles: board, winner: null }),
  [KEYS.stats]: JSON.stringify(stats),
  [KEYS.sound]: '0',
};
let game: Buffer, statsImg: Buffer, view3d: Buffer;
try {
  log('Screenshot: flaches Brett');
  await loadStorage({ ...data, [KEYS.view]: '2d' });
  game = await shotGame('spiel-flach');
  log('Screenshot: Statistik');
  statsImg = await shotStats();
  log('Screenshot: 3D-Ansicht');
  await loadStorage({ ...data, [KEYS.view]: '3d' });
  await sleep(1500);
  view3d = await shotGame('spiel-3d');
} finally {
  await ses.restore();
}

log('Fächer zusammensetzen');
await compose(game!, statsImg!, view3d!);
console.log(`Fertig: ${OUT}`);
