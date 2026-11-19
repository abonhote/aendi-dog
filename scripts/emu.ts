/**
 * Gemeinsamer Code für Store-Grafiken aus dem Android-Emulator (make-feature.ts, make-screenshots.ts):
 * adb, Zugriff auf die WebView der App (Chrome DevTools Protocol über `adb forward`) und KI-Partien für Beispieldaten.
 *
 * Voraussetzung: Ein Emulator (oder Gerät) läuft, die Debug-App ist installiert (WebView-Fehlersuche ist nur dort an)
 * und es gibt einen Spielstand (die App einmal öffnen genügt).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIZES,
  aiChoose,
  aiGive,
  applyAll,
  initMarbles,
  makeDeck,
  teamWon,
  type Board,
  type Card,
} from '../src/engine';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = 'ch.aendi.aendidog';
const PORT = 9333;
export const KEYS = {
  save: 'braendi-dog-v2',
  stats: 'aendi-dog-stats',
  view: 'aendi-dog-view',
  sound: 'aendi-dog-sound',
  theme: 'aendi-dog-theme',
};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const log = (s: string) => console.log('• ' + s);

// ------------------------------------------------------------------ adb

const ADB = (() => {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk');
  const p = join(sdk, 'platform-tools/adb');
  return existsSync(p) ? p : 'adb';
})();
export const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: 'utf8' }).trim();
export const screencap = (): Buffer => execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });

// ------------------------------------------------------------------ WebView der App (Chrome DevTools Protocol)

let ws: WebSocket | null = null,
  seq = 0;
const pending = new Map<number, (v: any) => void>();

export async function connect() {
  for (let i = 0; i < 30; i++) {
    const sock = adb('shell', 'cat', '/proc/net/unix').match(/webview_devtools_remote_\d+/)?.[0];
    if (sock) {
      adb('forward', `tcp:${PORT}`, `localabstract:${sock}`);
      try {
        const pages: any[] = await (
          await fetch(`http://localhost:${PORT}/json`, { signal: AbortSignal.timeout(3000) })
        ).json();
        const page = pages.find(p => p.type === 'page');
        if (page) {
          const w = new WebSocket(page.webSocketDebuggerUrl);
          await withTimeout(
            new Promise((ok, fail) => {
              w.onopen = ok;
              w.onerror = fail;
            }),
            3000,
            'WebSocket',
          );
          w.onmessage = e => {
            const m = JSON.parse(String(e.data));
            pending.get(m.id)?.(m);
            pending.delete(m.id);
          };
          w.onclose = () => {
            if (ws === w) ws = null;
          };
          ws = w;
          return;
        }
      } catch {
        /* WebView startet noch */
      }
    }
    await sleep(1000);
  }
  throw new Error('WebView der App nicht gefunden. Läuft die Debug-App im Emulator?');
}
export function disconnect() {
  ws?.close();
  ws = null;
  try {
    adb('forward', '--remove', `tcp:${PORT}`);
  } catch {
    /* schon weg */
  }
}

/** Bricht ab, statt ewig zu warten (etwa wenn die Seite während eines Befehls neu lädt und keine Antwort mehr kommt). */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, fail) => {
      t = setTimeout(() => fail(new Error(`Zeitüberschreitung: ${what}`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

export async function evaluate<T = any>(expression: string, timeoutMs = 20000): Promise<T> {
  if (!ws) throw new Error('Nicht verbunden.');
  const id = ++seq,
    w = ws;
  const res: any = await withTimeout(
    new Promise(ok => {
      pending.set(id, ok);
      w.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true },
        }),
      );
    }),
    timeoutMs,
    'Befehl in der WebView',
  ).finally(() => pending.delete(id));
  if (res.result?.exceptionDetails)
    throw new Error('Fehler in der WebView: ' + JSON.stringify(res.result.exceptionDetails.exception?.description));
  return res.result?.result?.value;
}
/** Wartet, bis die Seite geladen ist und sich gesetzt hat (Schriften, erste Animationen). */
export const settle = (ms = 1500) =>
  evaluate(
    `new Promise(r=>{const t=()=>document.readyState==='complete'?document.fonts.ready.then(()=>setTimeout(r,${ms})):setTimeout(t,100);t()})`,
  );

export const readStorage = () =>
  evaluate<Record<string, string>>(`Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))`);
/** Setzt localStorage komplett und lädt neu. Die App speichert beim Verlassen (pagehide) ihren Spielstand – das wird hier unterdrückt. */
export async function loadStorage(data: Record<string, string>) {
  await evaluate(`(()=>{const d=${JSON.stringify(data)};const set=Storage.prototype.setItem;
    window.addEventListener('pagehide',e=>e.stopImmediatePropagation(),true);
    document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);
    Storage.prototype.setItem=function(){};localStorage.clear();for(const k in d)set.call(localStorage,k,d[k]);
    setTimeout(()=>location.reload(),100);return 1})()`); // verzögert, damit die Antwort noch ankommt
  disconnect();
  await sleep(1500);
  await connect();
  await settle();
}

// ------------------------------------------------------------------ Emulator vorbereiten und aufräumen

const demo = (...extra: string[]) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', ...extra);
/**
 * Statusleiste im Demo-Modus: 10:00, voller Akku, volles WLAN, kein Mobilfunk, keine Benachrichtigungen.
 * Wird nach jedem Bildschirmwechsel neu gesetzt; sonst zeigte SystemUI danach WLAN-Symbole mehrfach oder mit „!“.
 */
function demoBar() {
  demo('-e', 'command', 'exit');
  demo('-e', 'command', 'enter');
  demo('-e', 'command', 'clock', '-e', 'hhmm', '1000');
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  demo('-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true');
  demo('-e', 'command', 'network', '-e', 'mobile', 'hide');
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false');
}

export interface Session {
  backup: Record<string, string>;
  save: any;
  restore: () => Promise<void>;
}

/**
 * Hochformat sperren, Statusleiste im Demo-Modus (10:00, voller Akku, keine Benachrichtigungen), App starten,
 * localStorage sichern (auch als Datei `backupFile`). `restore()` stellt alles wieder her.
 */
export async function begin(backupFile: string): Promise<Session> {
  if (
    !adb('devices')
      .split('\n')
      .slice(1)
      .some(l => /\tdevice$/.test(l))
  )
    throw new Error('Kein Emulator/Gerät gefunden (adb devices).');
  const rot = {
    acc: adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation'),
    user: adb('shell', 'settings', 'get', 'system', 'user_rotation'),
  };
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
  demoBar();
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await connect();
  const backup = await readStorage();
  writeFileSync(backupFile, JSON.stringify(backup, null, 1));
  const save = backup[KEYS.save] ? JSON.parse(backup[KEYS.save]) : null;
  if (!save)
    throw new Error('Kein Spielstand in der App. Bitte die App einmal öffnen und das Skript erneut ausführen.');
  const restore = async () => {
    log('Daten der App, Bildschirm, Drehung und Statusleiste wiederherstellen');
    try {
      adb('shell', 'wm', 'size', 'reset');
      adb('shell', 'wm', 'density', 'reset');
      await sleep(2500);
    } catch (e) {
      console.error(e);
    }
    try {
      await connect();
      await loadStorage(backup);
    } catch (e) {
      console.error(`Wiederherstellen fehlgeschlagen, Sicherung: ${backupFile}`, e);
    }
    disconnect();
    demo('-e', 'command', 'exit');
    adb('shell', 'settings', 'put', 'system', 'user_rotation', rot.user === 'null' ? '0' : rot.user);
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', rot.acc === 'null' ? '1' : rot.acc);
  };
  return { backup, save, restore };
}

/** Bildschirm des Emulators umstellen (Pixel und Dichte), danach neu verbinden und warten, bis die App neu gezeichnet ist. */
export async function setScreen(w: number, h: number, dpi: number) {
  adb('shell', 'wm', 'size', `${w}x${h}`);
  adb('shell', 'wm', 'density', String(dpi));
  disconnect();
  await sleep(3000);
  demoBar();
  await sleep(1000);
  await connect();
  await settle();
}

// ------------------------------------------------------------------ KI-Partien für Beispieldaten

type Rec = {
  winner: number;
  rounds: number;
  us: number;
  them: number;
  folds: number;
  lose: Record<'K' | 'T' | 'G', number>;
  moves0: number;
  movesAll: number;
  fin: string;
  finBy: number;
};

/** Eine Partie KI gegen KI (Stark). Mit `stopAfter` nur so viele Runden, dann wird das Brett zurückgegeben. */
function play(stopAfter = Infinity): Rec | Board | null {
  let ms = initMarbles(),
    deck: Card[] = [],
    cycle = 0,
    start = Math.floor(Math.random() * 4);
  const s = { us: 0, them: 0, folds: 0 };
  let moves0 = 0,
    movesAll = 0;
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
        if (!mv) {
          if (t === 0) s.folds++;
          hands[t] = [];
        } else {
          const r = applyAll(ms, mv.segs);
          ms = r.ms;
          for (const id of r.killed) {
            const mt = t % 2;
            if ((id >> 2) % 2 === mt) continue;
            if (mt === 0) s.us++;
            else s.them++;
          }
          hands[t] = hands[t].filter(c => c.id !== mv.card.id);
          movesAll++;
          if (t === 0) moves0++;
          if (teamWon(ms, t % 2)) {
            const winner = t % 2,
              lose = { K: 0, T: 0, G: 0 };
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

/**
 * Statistikeinträge im Format von recordGame() in app.ts. Siege, Schläge, Runden und Endstand stammen aus echten
 * KI-Partien; Datum, Uhrzeit (Mittag und Abende der letzten Wochen) und Spieldauer (aus der Zahl der Züge) sind geschätzt.
 */
export function makeStats(n = 30) {
  const games: any[] = [];
  while (games.length < n) {
    const g = play() as Rec | null;
    if (!g) continue;
    const dur = Math.round(g.moves0 * 7 + (g.movesAll - g.moves0) * 1.6); // eigene Züge ~7 s, Computerzüge ~1,6 s
    games.push({
      win: g.winner === 0,
      level: 'hard',
      rounds: g.rounds,
      us: g.us,
      them: g.them,
      folds: g.folds,
      lose: g.lose,
      dur,
      undo: 0,
      fin: g.fin,
      finBy: g.finBy,
    });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let prevEnd = 0;
  games.forEach((g, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 1 - Math.floor((games.length - 1 - i) * 0.7));
    if (i % 4 === 0) d.setHours(12, (i * 7) % 60);
    else d.setHours(18 + (i % 4), (i * 17) % 60);
    g.start = Math.max(+d, prevEnd + 600e3);
    g.t = prevEnd = g.start + g.dur * 1000;
  });
  return { games };
}

/** Eine lebendige Stellung nach 4 Runden: mindestens 5 Murmeln auf der Bahn und 3 bis 6 im Ziel. */
export function makeBoard(): Board {
  for (;;) {
    const ms = play(4) as Board;
    const n = (l: string) => ms.filter(m => m.loc === l).length;
    if (n('T') >= 5 && n('G') >= 3 && n('G') <= 6) return ms;
  }
}
