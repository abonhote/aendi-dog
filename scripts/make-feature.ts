/**
 * Erzeugt die Vorstellungsgrafik für Google Play (1024 × 500) aus echten Screenshots der App.
 *
 *   npm run feature:build
 *
 * Voraussetzung: Ein Android-Emulator (oder ein Gerät) läuft, die Debug-App (`ch.aendi.aendidog`) ist installiert.
 * Der Emulator sollte ein Handy mit 1080 × 2400 sein (z. B. „Medium Phone“), sonst passen die Proportionen nicht ganz.
 *
 * Ablauf:
 *  1. KI gegen KI: 30 Partien (Stufe Stark) für die Statistik und eine Stellung nach 4 Runden fürs Brett.
 *     Siege, Schläge, Runden und Endstand sind echt, Datum, Uhrzeit und Spieldauer geschätzt.
 *  2. Über die WebView-Fehlersuche (Chrome DevTools Protocol, per `adb forward`) werden Spielstand und Statistik
 *     eingesetzt und drei Screenshots aufgenommen: flaches Brett, Statistik, 3D-Ansicht.
 *     Statusleiste im Demo-Modus (10:00, voller Akku, keine Benachrichtigungen), Hochformat.
 *  3. Die ursprünglichen Daten der App (localStorage), die Drehung und die Statusleiste werden wiederhergestellt.
 *  4. Die drei Screenshots werden als Fächer zusammengesetzt → store/play-store-feature-1024x500.png
 *     (PNG ohne Alphakanal, wie Google Play es verlangt). Die Rohbilder landen in store/feature-src/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SIZES, aiChoose, aiGive, applyAll, initMarbles, makeDeck, teamWon, type Board, type Card } from '../src/engine';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store/play-store-feature-1024x500.png');
const SRC = join(ROOT, 'store/feature-src');
const PKG = 'ch.aendi.aendidog';
const PORT = 9333;
const SAVE_KEY = 'braendi-dog-v2', STATS_KEY = 'aendi-dog-stats', VIEW_KEY = 'aendi-dog-view', SND_KEY = 'aendi-dog-sound';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (s: string) => console.log('• ' + s);

// ------------------------------------------------------------------ adb

const ADB = (() => {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk');
  const p = join(sdk, 'platform-tools/adb');
  return existsSync(p) ? p : 'adb';
})();
const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: 'utf8' }).trim();
const screencap = (): Buffer => execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });

// ------------------------------------------------------------------ Chrome DevTools Protocol (WebView der App)

let ws!: WebSocket, seq = 0;
const pending = new Map<number, (v: any) => void>();

async function connect() {
  for (let i = 0; i < 20; i++) {
    const sock = adb('shell', 'cat', '/proc/net/unix').match(/webview_devtools_remote_\d+/)?.[0];
    if (sock) {
      adb('forward', `tcp:${PORT}`, `localabstract:${sock}`);
      try {
        const pages: any[] = await (await fetch(`http://localhost:${PORT}/json`)).json();
        const page = pages.find(p => p.type === 'page');
        if (page) {
          ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
          ws.onmessage = e => { const m = JSON.parse(String(e.data)); pending.get(m.id)?.(m); pending.delete(m.id); };
          return;
        }
      } catch { /* WebView startet noch */ }
    }
    await sleep(1000);
  }
  throw new Error('WebView der App nicht gefunden. Läuft die Debug-App im Emulator?');
}
async function evaluate<T = any>(expression: string): Promise<T> {
  const id = ++seq;
  const res: any = await new Promise(ok => { pending.set(id, ok); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } })); });
  if (res.result?.exceptionDetails) throw new Error('Fehler in der WebView: ' + JSON.stringify(res.result.exceptionDetails.exception?.description));
  return res.result?.result?.value;
}
/** Setzt localStorage komplett und lädt neu. Die App speichert beim Verlassen (pagehide) ihren Spielstand – das wird hier unterdrückt. */
async function loadStorage(data: Record<string, string>) {
  await evaluate(`(()=>{const d=${JSON.stringify(data)};const set=Storage.prototype.setItem;
    window.addEventListener('pagehide',e=>e.stopImmediatePropagation(),true);
    document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);
    Storage.prototype.setItem=function(){};localStorage.clear();for(const k in d)set.call(localStorage,k,d[k]);location.reload();return 1})()`);
  ws.close();
  await sleep(1500);
  await connect();
  await evaluate(`new Promise(r=>{const t=()=>document.readyState==='complete'?setTimeout(r,1500):setTimeout(t,100);t()})`);
}

// ------------------------------------------------------------------ KI-Partien

type Rec = { winner: number; rounds: number; us: number; them: number; folds: number; lose: Record<'K' | 'T' | 'G', number>; moves0: number; movesAll: number; fin: string; finBy: number };

/** Eine Partie KI gegen KI (Stark). Mit `stopAfter` nur so viele Runden, dann wird das Brett zurückgegeben. */
function play(stopAfter = Infinity): Rec | Board | null {
  let ms = initMarbles(), deck: Card[] = [], cycle = 0, start = Math.floor(Math.random() * 4);
  const s = { us: 0, them: 0, folds: 0 };
  let moves0 = 0, movesAll = 0;
  for (let round = 0; round < 300; round++) {
    if (round === stopAfter) return ms;
    if (cycle % 5 === 0) deck = makeDeck();
    const n = SIZES[cycle++ % 5];
    const hands: Card[][] = [[], [], [], []];
    for (let i = 0; i < n; i++) for (let p = 0; p < 4; p++) hands[p].push(deck.pop()!);
    const gives = hands.map((h, p) => aiGive(ms, p, h));
    for (let p = 0; p < 4; p++) hands[p] = hands[p].filter(c => c !== gives[p]);
    for (let p = 0; p < 4; p++) hands[(p + 2) % 4].push(gives[p]);
    let t = start;
    start = (start + 1) % 4;
    while (hands.some(h => h.length)) {
      if (hands[t].length) {
        const mv = aiChoose(ms, t, hands[t], 'hard');
        if (!mv) { if (t === 0) s.folds++; hands[t] = []; }
        else {
          const r = applyAll(ms, mv.segs);
          ms = r.ms;
          for (const id of r.killed) { const mt = t % 2; if ((id >> 2) % 2 === mt) continue; if (mt === 0) s.us++; else s.them++; }
          hands[t] = hands[t].filter(c => c.id !== mv.card.id);
          movesAll++; if (t === 0) moves0++;
          if (teamWon(ms, t % 2)) {
            const winner = t % 2, lose = { K: 0, T: 0, G: 0 };
            for (const m of ms) if (m.color % 2 !== winner) lose[m.loc]++;
            return { winner, rounds: cycle, ...s, lose, moves0, movesAll, fin: mv.card.r, finBy: t };
          }
        }
      }
      t = (t + 1) % 4;
    }
  }
  return null;
}

/** 30 Statistikeinträge im Format von recordGame() in app.ts; Partien an den Abenden der letzten drei Wochen. */
function makeStats() {
  const games: any[] = [];
  while (games.length < 30) {
    const g = play() as Rec | null;
    if (!g) continue;
    const dur = Math.round(g.moves0 * 7 + (g.movesAll - g.moves0) * 1.6);   // eigene Züge ~7 s, Computerzüge ~1,6 s
    games.push({ win: g.winner === 0, level: 'hard', rounds: g.rounds, us: g.us, them: g.them, folds: g.folds, lose: g.lose, dur, undo: 0, fin: g.fin, finBy: g.finBy });
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let prevEnd = 0;
  games.forEach((g, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 1 - Math.floor((games.length - 1 - i) * 0.7));
    if (i % 4 === 0) d.setHours(12, (i * 7) % 60); else d.setHours(18 + (i % 4), (i * 17) % 60);
    g.start = Math.max(+d, prevEnd + 600e3);
    g.t = prevEnd = g.start + g.dur * 1000;
  });
  return { games };
}

/** Eine lebendige Stellung nach 4 Runden: mindestens 5 Murmeln auf der Bahn und 3 im Ziel. */
function makeBoard(): Board {
  for (;;) {
    const ms = play(4) as Board;
    const n = (l: string) => ms.filter(m => m.loc === l).length;
    if (n('T') >= 5 && n('G') >= 3 && n('G') <= 6) return ms;
  }
}

// ------------------------------------------------------------------ Screenshots

const ASPECT = 1080 / 1830;   // Breite : Höhe jedes Bildschirms im Fächer

async function shotGame(name: string) {
  const r = await evaluate<{ top: number; dpr: number }>(`({top:document.querySelector('.boardBox').getBoundingClientRect().top,dpr:devicePixelRatio})`);
  const png = screencap();
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const top = Math.max(0, Math.round((r.top - 36) * r.dpr));
  const h = Math.min(height - top, Math.round(width / ASPECT));
  writeFileSync(join(SRC, name + '.png'), png);
  return sharp(png).extract({ left: 0, top, width, height: h }).png().toBuffer();
}
async function shotStats() {
  await evaluate(`document.getElementById('statsBtn').click();new Promise(r=>setTimeout(()=>{document.activeElement.blur();document.getElementById('stats').scrollTop=0;r(1)},600))`);
  await sleep(800);
  const r = await evaluate<{ x: number; y: number; w: number; dpr: number }>(`(()=>{const b=document.getElementById('stats').getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,dpr:devicePixelRatio}})()`);
  const png = screencap();
  const { height = 0 } = await sharp(png).metadata();
  writeFileSync(join(SRC, 'statistik.png'), png);
  const left = Math.round(r.x * r.dpr), top = Math.round(r.y * r.dpr), w = Math.round(r.w * r.dpr);
  await evaluate(`document.getElementById('stats').close();1`);
  return sharp(png).extract({ left, top, width: w, height: Math.min(height - top, Math.round(w / ASPECT)) }).png().toBuffer();
}

// ------------------------------------------------------------------ Zusammensetzen

async function compose(game: Buffer, stats: Buffer, view3d: Buffer) {
  const W = 1024, H = 500, CH = 400, CW = Math.round(CH * ASPECT), R = 16, SC = 3;   // SC: Überabtastung für glatte Kanten beim Drehen
  const cards = [   // Mittelpunkt und Drehung; die letzte Karte liegt oben
    { img: game, x: 268, y: 262, rot: -7 },
    { img: stats, x: 756, y: 262, rot: 7 },
    { img: view3d, x: 512, y: 248, rot: 0 },
  ];
  const uri = async (b: Buffer) => 'data:image/png;base64,' + (await sharp(b).resize(CW * SC, CH * SC, { fit: 'cover', position: 'top', kernel: 'lanczos3' }).png().toBuffer()).toString('base64');
  const imgs = await Promise.all(cards.map(c => uri(c.img)));
  const oct = (cx: number, cy: number, r: number) => Array.from({ length: 8 }, (_, k) => { const a = (22.5 + 45 * k) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const svg = `<svg width="${W * SC}" height="${H * SC}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3C6B5B"/><stop offset="1" stop-color="#162C26"/></radialGradient>
  <filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="11"/></filter>
  <clipPath id="clip"><rect x="${-CW / 2}" y="${-CH / 2}" width="${CW}" height="${CH}" rx="${R}"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<polygon points="${oct(70, 250, 200)}" fill="none" stroke="#F2D8A2" stroke-opacity=".08" stroke-width="14"/>
<polygon points="${oct(954, 250, 200)}" fill="none" stroke="#F2D8A2" stroke-opacity=".08" stroke-width="14"/>
${cards.map((c, i) => `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})">
  <rect x="${-CW / 2}" y="${-CH / 2 + 10}" width="${CW}" height="${CH}" rx="${R}" fill="#000" fill-opacity=".5" filter="url(#b)"/>
  <image x="${-CW / 2}" y="${-CH / 2}" width="${CW}" height="${CH}" href="${imgs[i]}" clip-path="url(#clip)" preserveAspectRatio="none"/>
  <rect x="${-CW / 2 + .5}" y="${-CH / 2 + .5}" width="${CW - 1}" height="${CH - 1}" rx="${R}" fill="none" stroke="#fff" stroke-opacity=".18"/>
</g>`).join('\n')}
</svg>`;
  await sharp(Buffer.from(svg), { density: 72 }).resize(W, H, { kernel: 'lanczos3' }).flatten({ background: '#162C26' }).removeAlpha().png().toFile(OUT);
}

// ------------------------------------------------------------------ Ablauf

mkdirSync(SRC, { recursive: true });
log('KI-Partien für Statistik und Brett …');
const stats = makeStats(), board = makeBoard();

if (!adb('devices').split('\n').slice(1).some(l => /\tdevice$/.test(l))) throw new Error('Kein Emulator/Gerät gefunden (adb devices).');
const rot = { acc: adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation'), user: adb('shell', 'settings', 'get', 'system', 'user_rotation') };
adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
await connect();

const backup = await evaluate<Record<string, string>>(`Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))`);
writeFileSync(join(SRC, 'localStorage-backup.json'), JSON.stringify(backup, null, 1));
const save = backup[SAVE_KEY] ? JSON.parse(backup[SAVE_KEY]) : null;
if (!save) throw new Error('Kein Spielstand in der App. Bitte einmal ein Spiel starten und das Skript erneut ausführen.');
save.marbles = board;
save.winner = null;

const demo = (...extra: string[]) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', ...extra);
let game: Buffer, statsImg: Buffer, view3d: Buffer;
try {
  adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
  demo('-e', 'command', 'enter');
  demo('-e', 'command', 'clock', '-e', 'hhmm', '1000');
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false');
  const data = { ...backup, [SAVE_KEY]: JSON.stringify(save), [STATS_KEY]: JSON.stringify(stats), [SND_KEY]: '0' };

  log('Screenshot: flaches Brett');
  await loadStorage({ ...data, [VIEW_KEY]: '2d' });
  game = await shotGame('spiel-flach');
  log('Screenshot: Statistik');
  statsImg = await shotStats();
  log('Screenshot: 3D-Ansicht');
  await loadStorage({ ...data, [VIEW_KEY]: '3d' });
  await sleep(1500);
  view3d = await shotGame('spiel-3d');
} finally {
  log('Daten der App, Drehung und Statusleiste wiederherstellen');
  await loadStorage(backup).catch(e => console.error('Wiederherstellen fehlgeschlagen, Sicherung: store/feature-src/localStorage-backup.json', e));
  ws.close();
  demo('-e', 'command', 'exit');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', rot.user === 'null' ? '0' : rot.user);
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', rot.acc === 'null' ? '1' : rot.acc);
  adb('forward', '--remove', `tcp:${PORT}`);
}

log('Fächer zusammensetzen');
await compose(game!, statsImg!, view3d!);
console.log(`Fertig: ${OUT}`);
