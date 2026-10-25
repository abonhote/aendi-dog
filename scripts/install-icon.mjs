/**
 * Kopiert das App-Icon (android-icon/res) in das Android-Projekt von Capacitor.
 * Überschreibt dabei ic_launcher.xml, ic_launcher_round.xml und die ic_launcher*.png des Standard-Icons.
 * Läuft ohne Fehler durch, wenn android/ noch nicht existiert (dann zuerst `npx cap add android`).
 */
import { cpSync, existsSync } from 'node:fs';

const from = 'android-icon/res';
const to = 'android/app/src/main/res';

if (!existsSync('android')) {
  console.log('Ordner android/ fehlt – erst „npx cap add android“ ausführen. Icon übersprungen.');
  process.exit(0);
}
cpSync(from, to, { recursive: true, force: true });
console.log(`Icon nach ${to} kopiert.`);
