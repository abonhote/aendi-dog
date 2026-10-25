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
# appId ist in capacitor.config.ts gesetzt: ch.aendi.aendidog
npm run build
npx cap add android  # legt den Ordner android/ an (ein normales Android-Studio-Projekt)
```

Danach nach jeder Änderung:

```bash
npm run android      # baut, kopiert nach android/ und öffnet Android Studio
```

In Android Studio oben das Gerät wählen und auf ▶ (Run) klicken. Die APK für den Play Store entsteht über *Build → Generate Signed Bundle / APK*.

## App-Icon

Das Icon ist ein adaptives Icon für moderne Android-Geräte: ein achteckiges Holzbrett mit den vier Murmeln (Grün oben, Rot rechts, Blau unten = du, Gelb links) auf dunkelgrünem Grund. Die fertigen Dateien liegen im Projekt, du musst nichts erzeugen.

```bash
npx cap add android   # einmalig, falls android/ noch nicht existiert
npm run icon:install  # kopiert android-icon/res nach android/app/src/main/res
```

`npm run android` erledigt den zweiten Schritt automatisch mit.

Was drin ist:

- **Adaptives Icon (Android 8+):** Hintergrund und Vordergrund als getrennte Vektoren. Jeder Launcher schneidet die Form selbst zu (Kreis, Squircle, abgerundetes Quadrat …).
- **Themen-Icon (Android 13+):** eine einfarbige Ebene (`ic_aendi_monochrome.xml`). Das System färbt sie nach dem Hintergrundbild. In den Launcher-Einstellungen muss „Themen-Symbole“ eingeschaltet sein.
- **Fallback (Android 6 und 7):** fertige PNGs in allen fünf Dichten, als Kreis und als abgerundetes Quadrat.
- **Play Store:** `store/play-store-icon-512.png` (512 × 512) fürs Hochladen in der Play Console.
- **Vorschau:** `store/icon-vorschau.png` zeigt das Icon mit verschiedenen Masken und in kleinen Grössen.
- **Master:** `assets/icon.svg`.

Die Ebenen heissen `ic_aendi_*` und kollidieren deshalb nicht mit den Standard-Icons von Capacitor. Überschrieben werden nur `ic_launcher.xml`, `ic_launcher_round.xml` und die `ic_launcher*.png`.

**Icon ändern:** Farben und Geometrie stehen oben in `scripts/make-icon.mjs` (Abschnitt „Gestaltung“). Danach `npm run icon:build` (braucht `sharp`, kommt mit `npm install`) und `npm run icon:install`. Wichtig bei eigenen Änderungen: Adaptive Icons zeigen immer nur den mittleren Kreis von 66 der 108 Einheiten sicher an. Alles Wichtige gehört dort hinein.

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

**Regeln, Karten und Tempo.** Der Menüeintrag „Regeln & Varianten“ und der Regeln-Dialog sind im Moment ausgeblendet. Text und Code sind noch da: In `app.ts` die Konstante `SHOW_RULES` auf `true` setzen, dann erscheinen sie wieder. Die Varianten (kanadische 7, Joker-Verbot) werden im Neues-Spiel-Dialog gewählt und gelten fürs ganze Spiel. „Grün lernt von dir“ steckt im Neues-Spiel-Dialog (Einschalten, Anzeige des Gelernten, Zurücksetzen). Die Karten sind nur noch französisch; der Schweizer Kartensatz ist im Code (`cards`/`SUIT_CH` in `app.ts`) noch vorhanden, aber nicht wählbar. Die drei Tempostufen sind so verschoben, dass „Normal“ dem früheren „Zügig“ entspricht (Tabellen `delay()`, `stepMs()`, `dealAnim()`, `flyToPile()`, `doExchange()`); ein gespeichertes Tempo wird einmalig umgerechnet (`spdV2`).

**Layout.** Die Seite scrollt nie: Brett und Handkarten teilen sich die Bildschirmhöhe (`.layout`, `.boardArea` in `style.css`). Spielverlauf und Statistik liegen als Dialoge im ☰-Menü.

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
