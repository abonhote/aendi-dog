# Ändi Dog

Ändi Dog als Web-App und Android-App (Capacitor). Du spielst Blau mit Grün gegen Rot und Gelb.

## Voraussetzungen

- **Node.js 20 oder neuer** (https://nodejs.org)
- **Android Studio** (aktuelle Version). Darin ist das Android-SDK und ein passendes Java (JDK 21) enthalten.
- Optional ein Android-Handy mit aktiviertem USB-Debugging, sonst den Emulator in Android Studio.

## Erste Schritte

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Im Browser testen: http://localhost:5173
```

Änderungen am Code erscheinen im Browser sofort. So entwickelst du am schnellsten, Android brauchst du erst zum Schluss.

## Android-App bauen

Einmalig:

```bash
# Vorher in capacitor.config.ts die appId anpassen, z. B. ch.deinname.aendidog
npm run build
npx cap add android  # legt den Ordner android/ an (ein normales Android-Studio-Projekt)
```

Danach nach jeder Änderung:

```bash
npm run android      # baut, kopiert nach android/ und öffnet Android Studio
```

In Android Studio oben das Gerät wählen und auf ▶ (Run) klicken. Die APK für den Play Store entsteht über *Build → Generate Signed Bundle / APK*.

## Projektstruktur

```
src/
  engine.ts   Regeln, Zuggenerierung, Computergegner, Tauschregeln – typisiert, ohne DOM, auch in Node lauffähig
  app.ts      Oberfläche, Austeilen und Mischen, Spielablauf, Animationen, Zurücknehmen, „Grün lernt“, Statistik, Menü
  view3d.ts   3D-Ansicht und Murmelsicht (WebGL, ohne Bibliotheken)
  main.ts     Einstiegspunkt
  style.css   Gestaltung (inkl. Dunkelmodus)
index.html    Grundgerüst (Kopfzeile mit Menü, Brett, Hand, Dialoge)
tests/        Regeltests (Vitest)
scripts/sim.ts  KI gegen KI ohne Oberfläche
```

`app.ts` und `view3d.ts` sind 1:1 der Stand der spielbaren Vorschau und deshalb noch untypisiert (`// @ts-nocheck` in der ersten Zeile). Die Spiellogik in `engine.ts` ist vollständig typisiert und getestet. Ich habe sie mit 1500 Zufallsstellungen gegen die Vorschau verglichen: gleiche Züge, gleiche Bewertungen, gleiche Tauschkarten. Möchtest du einen Teil der Oberfläche typisieren, entferne dort `@ts-nocheck` und arbeite die Meldungen von `npm run check` Abschnitt für Abschnitt ab.

## So funktioniert der Code

**Spielzustand.** Die 16 Murmeln sind ein Array (`Board`). Jede Murmel hat `loc` (Zwinger `K`, Bahn `T`, Ziel `G`), `pos` und `fresh`. Die Bahn hat 64 Felder, der Start von Farbe *c* liegt auf Feld `16·c`. Eine *frische* Murmel kommt gerade aus dem Zwinger; sie blockiert alle anderen und ist geschützt.

**Züge.** `legalMoves()` berechnet für eine Hand alle erlaubten Züge. Ein Zug besteht aus Karte, gespieltem Wert und Teilschritten (`Seg`): `out` (aus dem Zwinger auf den Start), `sw` (Bube-Tausch) oder `mv` (fahren, mit allen betretenen Feldern in `tp`). Bei der Sieben gibt es mehrere `mv`-Schritte; `gen7()` probiert rekursiv alle Aufteilungen durch.

**Austeilen und Mischen.** Der Stapel wird wie am Tisch weiterverwendet und nur dann mit allen 110 Karten neu gemischt, wenn er nicht mehr für die ganze Runde reicht (`startRound()` in `app.ts`). Der Geber sitzt rechts vor dem Startspieler; der Stapel liegt in der Brettmitte auf seiner Seite. Ausgeteilt wird in Päckchen (6 = 3+3, 5 = 3+2, 4 = 3+1) mit Animation (`dealAnim()`).

**Schatten ohne CSS-Filter.** Das flache Brett verwendet bewusst keinen `filter: drop-shadow`: Auf manchen Linux-Grafiktreibern (Chromium/Brave) blieben bei Grössenwechseln Reste älterer Bilder stehen. Der Brettschatten ist deshalb eine statische SVG-Grafik (`.boardShadow` in `index.html`), und jede Murmel hat einen eigenen Schattenkreis (`.mshadow`, Farbverlauf `#msh`), der mit ihr mitläuft (`render()` und `animateSeg()` in `app.ts`). Wer neue Elemente hinter dem Brett ergänzt, sollte dieselbe Regel beachten.

**Regeln und Layout.** Die Varianten (kanadische 7, Joker-Verbot) werden nur beim Start eines neuen Spiels gewählt und gelten dann fürs ganze Spiel. Die Seite scrollt nie: Brett und Handkarten teilen sich die Bildschirmhöhe (`.layout`, `.boardArea` in `style.css`). Spielverlauf, Statistik und Regeln liegen als Dialoge im ☰-Menü.

**Bedienung.** Für deinen Zug sind alle legalen Züge vorberechnet (`S.legal`). Jeder Tipp filtert die Kandidaten weiter: Karte → Murmel → Zielfeld (bei der Sieben mehrmals). So kann die Oberfläche nie einen regelwidrigen Zug zulassen.

**Computergegner.** `feats()` beschreibt eine Stellung mit wenigen Merkmalen: Fortschritt, eigene Gefährdung, Angriffschancen, Murmeln im Ziel und draussen, Gegner im Zwinger, Blockaden. `evaluate()` gewichtet sie mit `W` (Standard `W0`). `aiChoose()` probiert alle Züge, zieht ab, was eine wertvolle Karte kostet, wendet deine festen Regeln an (`partnerBackPen`, `partnerGoalPen`) und schaut auf „Stark“ einen Zug voraus. Getauscht wird mit `aiGive()`: zuerst deine Tauschregeln (`ruleGive`, `killGive`), sonst nach Kartenwert.

**Grün lernt.** In `app.ts` (Abschnitt „Grün lernt von dir“) wird jeder deiner Züge und Tausche mit Grüns Wahl verglichen. Bei Abweichungen verschiebt ein passiv-aggressives Update die Gewichte gerade so weit, dass deine Wahl vorne liegt. Gespeichert wird in `localStorage` (`aendi-dog-learn`), die Statistik unter `aendi-dog-stats`.

**Regeltests.** In `tests/engine.test.ts` steht für jede Regel aus der Anleitung ein Test, dazu deine eigenen Spiel- und Tauschregeln.

```bash
npm test             # alle Tests einmal ausführen
npm run test:watch   # läuft mit und testet bei jeder Änderung neu
```

Stellungen baust du mit einer Kurzschreibweise auf: `board({ 0: 'T10', 1: 'T0f', 2: 'G3' })` heisst Murmel 0 auf Feld 10, Murmel 1 frisch auf Feld 0, Murmel 2 im Ziel ganz innen. Findest du beim Spielen einen Fehler, schreib zuerst einen Test, der ihn zeigt.

**Experimentieren mit der KI:**

```bash
npm run sim                    # 20 Partien Stark gegen Mittel
npm run sim -- hard hard 200   # Bewertung gegen sich selbst testen
```


## Ideen für später

- Zurück-Taste von Android abfangen (Plugin `@capacitor/app`), z. B. um den Regeln-Dialog zu schliessen
- Vibration beim Schlagen (`@capacitor/haptics`) und Töne
- Schriften lokal einbinden (`@fontsource/...`), damit die App auch offline gleich aussieht. Ohne Internet nutzt sie die Systemschrift.
- App-Icon und Splash-Screen (`@capacitor/assets`)
- Mehrspieler über das Netzwerk
