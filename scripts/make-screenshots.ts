/**
 * Erzeugt die Screenshots für den Play-Store-Eintrag: Telefon, 7-Zoll- und 10-Zoll-Tablet, je fünf Bilder.
 *
 *   npm run screenshots:build              → alle drei Gerätetypen
 *   npm run screenshots:build -- phone     → nur einer (phone, tablet-7, tablet-10)
 *
 * Voraussetzung: Ein Android-Emulator läuft, die Debug-App ist installiert (siehe scripts/emu.ts).
 * Der Emulator wird mit `wm size` / `wm density` nacheinander auf die drei Bildschirme umgestellt
 * und danach zurückgesetzt. Ein Handy-Emulator genügt dafür.
 *
 * Vorgaben von Google Play: PNG ohne Alphakanal, 4 bis 8 Bilder je Gerätetyp, für Empfehlungen mindestens 1080 px
 * und 16:9 (Querformat) bzw. 9:16 (Hochformat). Darum:
 *   Telefon       1080 × 1920  Hochformat  (411 × 731 dp)
 *   7-Zoll-Tablet 1920 × 1080  Querformat  (960 × 540 dp)
 *   10-Zoll-Tablet 2560 × 1440 Querformat  (1280 × 720 dp)
 *
 * Bilder: 1 Spiel flach, 2 Spiel 3D, 3 Murmelsicht, 4 Statistik, 5 Einstellungen.
 * Spielstand und Statistik stammen aus KI-Partien (scripts/emu.ts), für alle Geräte dieselben.
 * Ausgabe: store/screenshots/<gerät>/0N-<name>.png
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { KEYS, ROOT, begin, evaluate, loadStorage, log, makeBoard, makeStats, screencap, setScreen, sleep } from './emu';

const DEVICES = {
  'phone':     { w: 1080, h: 1920, dpi: 420 },
  'tablet-7':  { w: 1920, h: 1080, dpi: 320 * 0.625 },
  'tablet-10': { w: 2560, h: 1440, dpi: 320 },
} as const;
type Device = keyof typeof DEVICES;

const OUT = join(ROOT, 'store/screenshots');
const wanted = (process.argv.slice(2).filter(a => a in DEVICES) as Device[]);
const devices: Device[] = wanted.length ? wanted : (Object.keys(DEVICES) as Device[]);

async function shot(dir: string, file: string) {
  await sleep(600);
  await sharp(screencap()).flatten({ background: '#ffffff' }).removeAlpha().png().toFile(join(dir, file));
  log('  ' + file);
}
const click = (id: string) => evaluate(`document.getElementById('${id}').click();new Promise(r=>setTimeout(()=>{document.activeElement&&document.activeElement.blur();r(1)},700))`);

log('KI-Partien für Statistik und Brett …');
const stats = makeStats(), board = makeBoard();
mkdirSync(OUT, { recursive: true });

const ses = await begin(join(OUT, 'localStorage-backup.json'));
const data = { ...ses.backup, [KEYS.save]: JSON.stringify({ ...ses.save, marbles: board, winner: null }), [KEYS.stats]: JSON.stringify(stats), [KEYS.sound]: '0', [KEYS.theme]: 'light' };
try {
  for (const name of devices) {
    const d = DEVICES[name], dir = join(OUT, name);
    mkdirSync(dir, { recursive: true });
    log(`${name}: ${d.w} × ${d.h}`);
    await setScreen(d.w, d.h, Math.round(d.dpi));

    await loadStorage({ ...data, [KEYS.view]: '2d' });
    await shot(dir, '01-spiel.png');

    await click('statsBtn');
    await evaluate(`document.getElementById('stats').scrollTop=0;1`);
    await shot(dir, '04-statistik.png');
    await evaluate(`document.getElementById('stats').close();1`);

    await click('setBtn');
    await shot(dir, '05-einstellungen.png');
    await click('setCancel');

    await loadStorage({ ...data, [KEYS.view]: '3d' });
    await sleep(1500);
    await shot(dir, '02-spiel-3d.png');

    await loadStorage({ ...data, [KEYS.view]: 'pov' });
    await sleep(2500);
    await shot(dir, '03-murmelsicht.png');
  }
} finally {
  await ses.restore();
}
console.log(`Fertig: ${OUT}`);
