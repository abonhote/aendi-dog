/**
 * Macht die Android-App offline: entfernt die INTERNET-Berechtigung, die Capacitor beim Anlegen des Projekts
 * standardmässig einträgt. Das Spiel braucht kein Netz, und die Schriften liegen lokal in der App (@fontsource).
 *
 * Statt die Zeile nur zu löschen, wird sie mit tools:node="remove" markiert. So entfernt Android auch eine Berechtigung,
 * die eine Bibliothek beim Zusammenführen der Manifeste wieder hineinbringen würde.
 * Läuft ohne Fehler durch, wenn android/ noch nicht existiert, und kann beliebig oft ausgeführt werden.
 * Rückgängig machen: die Zeile mit android.permission.INTERNET in AndroidManifest.xml wieder zu
 *   <uses-permission android:name="android.permission.INTERNET" />
 * ändern und das Skript aus package.json („android“) nehmen.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = 'android/app/src/main/AndroidManifest.xml';
if (!existsSync(file)) {
  console.log('Datei android/…/AndroidManifest.xml fehlt – erst „npx cap add android“ ausführen. Offline-Anpassung übersprungen.');
  process.exit(0);
}

const TOOLS = 'xmlns:tools="http://schemas.android.com/tools"';
const MARKED = '<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />';
const PLAIN = /<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>/;

let xml = readFileSync(file, 'utf8');
if (xml.includes('android.permission.INTERNET" tools:node="remove"')) {
  console.log('INTERNET-Berechtigung ist schon entfernt.');
  process.exit(0);
}
if (!xml.includes(TOOLS)) xml = xml.replace(/<manifest\b/, `<manifest ${TOOLS}`);
xml = PLAIN.test(xml) ? xml.replace(PLAIN, MARKED) : xml.replace('</manifest>', `    ${MARKED}\n</manifest>`);
writeFileSync(file, xml);
console.log('INTERNET-Berechtigung aus AndroidManifest.xml entfernt. Die App läuft komplett offline.');
