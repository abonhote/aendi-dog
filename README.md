# Ändi Dog

Ändi Dog als Web-App und Android-App (Capacitor). Step-by-step mit Claude und Claude Code erstellt, immer wieder von Menschen (von mir) getestet. Kein fire-and-forget-Agentic-Coding.

## Version

Aktuell **0.2.18**. Die Versionsnummer steht an zwei Stellen und muss bei jeder neuen Version an beiden erhöht werden:

- `package.json` → `"version"`
- `index.html` → `<p class="ver" id="appVer">Version …</p>` (unten im ☰-Menü sichtbar)

Für den Play Store liest `android/app/build.gradle` die Nummer aus `package.json`: `versionName` ist dieselbe Nummer, `versionCode` wird daraus berechnet (x·10000 + y·100 + z, also 0.2.17 → 217). Was sich geändert hat, steht in `CHANGELOG.md`. Die Taktik der Computerspieler ist in `RULES.md` beschrieben.

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

In Android Studio oben das Gerät wählen und auf ▶ (Run) klicken. Die APK für den Play Store entsteht über _Build → Generate Signed Bundle / APK_.

### Signiertes Bundle für den Play Store

Liegt `android/keystore.properties` vor, signiert Gradle den Release-Build selbst. Die Datei steht in `android/.gitignore` und kommt nie ins Repository, genauso wie `*.jks` und `*.keystore`:

```properties
storeFile=/Pfad/zu/upload-keystore.jks
storePassword=…
keyAlias=…
keyPassword=…
```

Dann baut dieser Befehl das signierte Bundle nach `android/app/build/outputs/bundle/release/app-release.aab`. Gradle 8.11 braucht dafür JDK 21; das Java von Android Studio kann neuer sein:

```bash
npm run build && npx cap sync android && cd android && JAVA_HOME=/Pfad/zu/jdk-21 ./gradlew bundleRelease
```

Ohne `keystore.properties` bleibt der Release-Build unsigniert, dann wie oben über Android Studio signieren.

## Offline, ohne Internetberechtigung

Das Spiel braucht kein Internet: Es gibt keine Netzwerkaufrufe, keine Werbung und keine Übertragung von Daten, alles bleibt auf dem Gerät (`localStorage`). Damit die App das auch nach aussen zeigt:

- **Schriften lokal:** Bricolage Grotesque und Atkinson Hyperlegible kommen aus den npm-Paketen `@fontsource/…` und werden mit der App gebaut (Importe in `src/main.ts`). Es gibt keinen Zugriff auf Google Fonts mehr. Die Schriften werden beim ersten `npm install` heruntergeladen (dafür braucht der PC Internet). Es sind die festen Schnitte 500 und 800 (Bricolage) und 400 und 700 (Atkinson). Die Google-Fassung mit automatischer optischer Grösse (`opsz`) gibt es so nicht, grosse Überschriften sehen minimal anders aus.
- **Berechtigung entfernt:** Capacitor trägt `INTERNET` beim Anlegen des Projekts standardmässig ein. `npm run android` führt nach `cap sync` das Skript `scripts/android-offline.mjs` aus. Es markiert die Zeile in `AndroidManifest.xml` mit `tools:node="remove"`, sodass sie auch beim Zusammenführen der Manifeste nicht zurückkommt. Einzeln: `npm run android:offline`. Mehrfaches Ausführen schadet nicht.
- **Prüfen** (einmal, nach dem ersten Bau): In Android Studio `AndroidManifest.xml` öffnen und unten den Reiter _Merged Manifest_ wählen. `android.permission.INTERNET` darf dort nicht mehr vorkommen. Dann die App auf einem Gerät starten und Spiel, Töne und Statistik kurz ausprobieren.
- **Wieder online** (zum Beispiel für einen späteren Mehrspielermodus): In `AndroidManifest.xml` die Zeile wieder zu `<uses-permission android:name="android.permission.INTERNET" />` machen und `npm run android:offline` aus dem Skript `android` in `package.json` nehmen.
- Findet `npm run build` eine Schriftdatei nicht, die Dateinamen im Paket ansehen: `ls node_modules/@fontsource/bricolage-grotesque/*.css` (und `atkinson-hyperlegible`), und die Importe in `src/main.ts` anpassen.

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

## Store-Grafiken (Google Play)

`store/play-store-feature-1024x500.png` zeigt drei echte Screenshots als Fächer: flaches Brett, 3D-Ansicht, Statistik. Neu erzeugen:

```bash
npm run feature:build
```

Dafür muss ein Emulator mit der Debug-App laufen (Handy mit 1080 × 2400, z. B. „Medium Phone“). Das Skript `scripts/make-feature.ts` lässt die KI 30 Partien spielen (Statistik) und eine Stellung nach 4 Runden erzeugen (Brett). Es setzt beides in der App ein, nimmt die Screenshots auf und stellt danach die Daten der App, die Drehung und die Statusleiste wieder her. Die Rohbilder und eine Sicherung der App-Daten liegen in `store/feature-src/` (nicht im Git). Siege, Schläge und Endstände der Statistik stammen aus den KI-Partien, Datum und Spieldauer sind geschätzt.

**Screenshots** für Telefon, 7-Zoll- und 10-Zoll-Tablet (je fünf: Spiel flach, 3D, Murmelsicht, Statistik, Einstellungen) liegen in `store/screenshots/`. Neu erzeugen:

```bash
npm run screenshots:build              # alle drei Gerätetypen
npm run screenshots:build -- tablet-10 # nur einer (phone, tablet-7, tablet-10)
```

Das Skript `scripts/make-screenshots.ts` stellt den laufenden Emulator mit `wm size` und `wm density` nacheinander um: Telefon 1080 × 1920 (Hochformat), 7-Zoll-Tablet 1920 × 1080 und 10-Zoll-Tablet 2560 × 1440 (beide Querformat). Das sind die Formate, die Google Play für Empfehlungen verlangt (9:16 bzw. 16:9, mindestens 1080 px, PNG ohne Alphakanal). Spielstand und Statistik kommen wie bei der Vorstellungsgrafik aus KI-Partien. Danach setzt es Bildschirm, App-Daten, Drehung und Statusleiste zurück. Der gemeinsame Code beider Skripte (adb, Zugriff auf die WebView, KI-Partien) steht in `scripts/emu.ts`.

## Projektstruktur

```
src/
  engine.ts   Regeln, Zuggenerierung, Computergegner, Tauschregeln – typisiert, ohne DOM, auch in Node lauffähig
  app.ts      Oberfläche, Austeilen und Mischen, Spielablauf, Animationen, Zurücknehmen, Statistik, Menü
  view3d.ts   3D-Ansicht und Murmelsicht (WebGL, ohne Bibliotheken)
  main.ts     Einstiegspunkt
  style.css   Gestaltung (inkl. Dunkelmodus)
index.html    Grundgerüst (Kopfzeile mit Menü, Brett, Hand, Dialoge)
tests/        Regeltests (Vitest)
scripts/sim.ts  KI gegen KI ohne Oberfläche
scripts/make-feature.ts  Vorstellungsgrafik für Google Play aus Emulator-Screenshots
scripts/make-screenshots.ts  Store-Screenshots für Telefon, 7- und 10-Zoll-Tablet
scripts/emu.ts  gemeinsamer Code der Store-Skripte (adb, WebView, KI-Beispieldaten)
scripts/android-offline.mjs  entfernt die INTERNET-Berechtigung aus dem Android-Projekt
tools/soundlabor.html  Soundlabor: Töne anhören, auswählen, Lautstärke und Geschwindigkeit einstellen (eigenständige Seite)
tools/animationslabor.html  Animationslabor: Gewinnanimationen ansehen, auswählen, Menge und Dauer einstellen (eigenständige Seite)
```

`app.ts` und `view3d.ts` sind 1:1 der Stand der spielbaren Vorschau und deshalb noch untypisiert (`// @ts-nocheck` in der ersten Zeile). Die Spiellogik in `engine.ts` ist vollständig typisiert und getestet. Ich habe sie mit 1500 Zufallsstellungen gegen die Vorschau verglichen: gleiche Züge, gleiche Bewertungen, gleiche Tauschkarten. Möchtest du einen Teil der Oberfläche typisieren, entferne dort `@ts-nocheck` und arbeite die Meldungen von `npm run check` Abschnitt für Abschnitt ab.

## So funktioniert der Code

**Spielzustand.** Die 16 Murmeln sind ein Array (`Board`). Jede Murmel hat `loc` (Zwinger `K`, Bahn `T`, Ziel `G`), `pos` und `fresh`. Die Bahn hat 64 Felder, der Start von Farbe _c_ liegt auf Feld `16·c`. Eine _frische_ Murmel kommt gerade aus dem Zwinger; sie blockiert alle anderen und ist geschützt.

**Züge.** `legalMoves()` berechnet für eine Hand alle erlaubten Züge. Ein Zug besteht aus Karte, gespieltem Wert und Teilschritten (`Seg`): `out` (aus dem Zwinger auf den Start), `sw` (Bube-Tausch) oder `mv` (fahren, mit allen betretenen Feldern in `tp`). Bei der Sieben gibt es mehrere `mv`-Schritte. Dieselbe Murmel darf dabei mehrmals vorkommen, und die Murmeln dürfen sich beliebig abwechseln. `gen7()` liefert der KI je erreichbarem Endzustand einen Zug. Die Oberfläche fragt Schritt für Schritt `sevenOptions()` ab; das bietet nur Schritte an, nach denen sich die 7 noch zu Ende fahren lässt.

**Austeilen und Mischen.** Der Stapel wird wie am Tisch weiterverwendet und nur dann mit allen 110 Karten neu gemischt, wenn er nicht mehr für die ganze Runde reicht (`startRound()` in `app.ts`). Der Geber sitzt rechts vor dem Startspieler. Der Stapel liegt immer beim Geber (`deckPos()`): am Brettrand links neben dessen Zieleinlauf, schräg im 45°-Winkel parallel zu den Zielfeldern und 14 % kleiner als die abgelegten Karten (`DECK_SCALE`). Die Lage ist für den Geber unten ausgemessen und für die anderen Plätze um 90° je Platz gedreht, das Brett ist vierfach symmetrisch. Mit allen vier Schichten hält der Stapel mindestens 3 Einheiten Abstand zu einer Murmel in jedem Loch. Ausgeteilt wird in Päckchen (6 = 3+3, 5 = 3+2, 4 = 3+1) mit Animation (`dealAnim()`). Die Karten liegen zuerst in der Reihenfolge des Austeilens in der Hand und gleiten danach an ihren Platz: Deine Hand ist wie in der Schweiz sortiert, von links nach rechts aufsteigend, das Ass höher als der König, der Joker ganz rechts, bei gleichem Wert ♠ ♥ ♣ ♦ (`RORDER`, `handCmp()`). Dieselbe Reihenfolge gilt in der Jokerauswahl. Nur die Anzeige ist sortiert, `S.hands[0]` bleibt unverändert, die Karten starten auf dem Stapel des Gebers.

**Schatten ohne CSS-Filter.** Das flache Brett verwendet bewusst keinen `filter: drop-shadow`: Auf manchen Linux-Grafiktreibern (Chromium/Brave) blieben bei Grössenwechseln Reste älterer Bilder stehen. Der Brettschatten ist deshalb eine statische SVG-Grafik (`.boardShadow` in `index.html`), und jede Murmel hat einen eigenen Schattenkreis (`.mshadow`, Farbverlauf `#msh`), der mit ihr mitläuft (`render()` und `animateSeg()` in `app.ts`). Wer neue Elemente hinter dem Brett ergänzt, sollte dieselbe Regel beachten.

**Regeln, Karten und Tempo.** Der Menüeintrag „Regeln & Varianten“ und der Regeln-Dialog sind im Moment ausgeblendet. Text und Code sind noch da: In `app.ts` die Konstante `SHOW_RULES` auf `true` setzen, dann erscheinen sie wieder. Die Varianten (kanadische 7, Joker-Verbot) werden im Neues-Spiel-Dialog gewählt und gelten fürs ganze Spiel. Die Karten sind nur noch französisch; der Schweizer Kartensatz ist im Code (`cards`/`SUIT_CH` in `app.ts`) noch vorhanden, aber nicht wählbar. Die drei Tempostufen sind so verschoben, dass „Normal“ dem früheren „Zügig“ entspricht (Tabellen `delay()`, `stepMs()`, `dealAnim()`, `flyToPile()`, `doExchange()`); ein gespeichertes Tempo wird einmalig umgerechnet (`spdV2`).

**Einstellungen.** Unter ☰ → Einstellungen steht alles Einstellbare in einem kompakten Dialog: je Platz (du unten, Partner oben, Gegner links und rechts) eine Zeile mit Name und Farbknopf, darunter Ansicht, Gegner (Stärke), Tempo, Darstellung (Automatisch, Hell, Dunkel), Töne (Ein, Aus) und Doppeltipp (0,3 bis 1,2 s oder ohne Limit). Der Farbknopf öffnet ein Feld mit neun Farben (`PALETTE`, `SEATS` in `app.ts`, gespeichert unter `aendi-dog-seats`); wählt man eine, die schon ein anderer Platz hat, tauschen die beiden. Ein Name, der nur ein Farbname ist (Standard „Rot“, „Grün“ …), folgt der Farbe (`autoName()`); eigene Namen bleiben. Die Spiellogik kennt nur Platz-Nummern; `applySeats()` setzt beim Start `NAMES`, `COLNAME`, `MCOL` und die CSS-Variablen `--c0` bis `--c3`. Ansicht, Gegner, Tempo, Darstellung, Töne und Doppeltipp wirken sofort und werden mit „Abbrechen“ zurückgestellt (`SNAP`, `revertSettings()`). Ändern sich Namen oder Farben, lädt die Seite nach dem Speichern neu, damit Brett und 3D-Ansicht neu aufgebaut werden; das laufende Spiel bleibt erhalten. Die Darstellung wird schon im Seitenkopf gesetzt, damit nichts im falschen Modus aufblitzt.

**Karten werfen.** Karten lassen sich antippen oder ziehen (`cardDragStart()`). Wirft man eine Karte Richtung Brettmitte – weit genug (70 px) oder schnell genug –, zählt das wie Antippen, beim Kartentausch wie zweimal Antippen. Die Richtung wird zur Brettmitte gemessen; auf breiten Bildschirmen, wo die Hand rechts neben dem Brett liegt, wirft man also nach links. Danach laufen dieselben Animationen wie beim Antippen. Beim Kartentausch muss der zweite Tipp innerhalb des eingestellten Zeitfensters (Standard 0,5 s) kommen, sonst sinkt die Karte zurück (`DBL_MS`, `GIVE_T`); der Knopf „Karte an … geben“ erscheint nur ohne Limit.

**Töne.** Alle Töne entstehen im Browser mit Web Audio, es gibt keine Tondateien (Abschnitt „Töne“ in `app.ts`). Sie stammen aus dem Soundlabor (`tools/soundlabor.html`, einfach im Browser öffnen), wo Varianten angehört, ausgewählt und in Lautstärke und Geschwindigkeit eingestellt werden: Mischen „Abheben, langsamer“ (`sndShuffle()`), Austeilen „Rutschen“ (`sndDeal()`), Karte tauschen „Schieben“ beim Losfliegen und ein Tippen beim Ankommen (`sndSlide()`, `sndPat()`), Karte ablegen „Papier“ (`sndLay()`), Murmel hinstellen „Tief klopfen“ (`sndSet()`), Murmel ziehen „Weiches Tippen“ (`sndStep()`, das letzte Feld kräftiger) und Murmel heimschicken „Fallen“ (`sndKill()`). Die Kartenflüge lösen ihre Töne selbst aus (`flyCard(…, snd)` mit `SNDF`). Pro Tonart gibt es eine Lautstärke (`SNDG`, am gerenderten Ton angeglichen) und eine Geschwindigkeit (`SNDS`: 2 = doppelt so schnell, alle Zeitabstände und Dauern werden durch den Wert geteilt, die Tonhöhe bleibt; `sx()`). Beim Mischen kommt das Spieltempo dazu (`shuffleSpeed()`): Normal etwa 3,8 s, Zügig etwa 1,7 s, höchstens etwa 5,5 s; das Spiel wartet nur mit Ton darauf. Browser erlauben Ton erst nach der ersten Berührung; kurz danach werden Töne trotzdem eingeplant (`audio()`), und das Platzhalter-Spiel hinter dem ersten Dialog bleibt stumm.

**Layout.** Die Seite scrollt nie: Brett und Handkarten teilen sich die Bildschirmhöhe (`.layout`, `.boardArea` in `style.css`). Spielverlauf und Statistik liegen als Dialoge im ☰-Menü. Damit das Brett nicht springt, wenn sich Texte oder Karten ändern, reserviert die Statuszeile immer die Höhe des längsten möglichen Textes (`statusSamples()`, `reserveStatus()`, Variable `--statusH`; neue lange Texte dort ergänzen), und die Handkarten werden auf schmalen Handys (bis 375 px Breite) so weit verkleinert, dass sechs in eine Reihe passen (`--cw` in `style.css`); sonst bricht die Hand um und wird höher.

**Spielende.** Ein Fenster zeigt das Ergebnis („Gewonnen!“ oder „Verloren.“, `#endDlg`, `openEnd()` in `app.ts`) mit den Knöpfen „Neues Spiel“ und „Statistik“; „Brett ansehen“ oder ein Tipp daneben schliesst es. Bei einer Niederlage erscheint es nach 0,7 s, bei einem Sieg mit Gewinnanimation erst, wenn diese endet oder weggetippt wird (`WINFX.start(done)`). Danach steht „Neues Spiel“ weiter in der Knopfzeile neben „Zurücknehmen“, gleich gross (`#newFloat`). Gewinnt dein Team, läuft die Gewinnanimation „Großes Finale“ (`WINFX` in `app.ts`): Feuerwerk, dann Konfetti-Kanonen, am Ende Konfettiregen, auf einer Canvas über dem ganzen Bildschirm (`#winFx`), ohne Ton. Das Brett bleibt dahinter sichtbar und wird währenddessen abgedunkelt (`#winScrim`, im hellen Modus stärker als im dunklen; nach etwa 9 s wird es wieder hell, das letzte Konfetti fällt noch aus). Die Farben sind die vier Spielerfarben, wie in den Einstellungen gewählt, dazu Weiss und Lila. Ein Tippen beendet die Animation, ebenso „Zurücknehmen“ und „Neues Spiel“. Sie wird nicht gespielt bei einer Niederlage, mit der Einstellung „Gewinnanimation: Aus“ (`aendi-dog-fx`) und wenn das System „Bewegung reduzieren“ meldet. Am Spielende heisst „Letzten Zug zurücknehmen“ kürzer „Zurücknehmen“, damit beide Knöpfe nebeneinander passen. Zum Ausprobieren und Abstimmen aller Varianten gibt es `tools/animationslabor.html`.

**Beginn einer Partie.** Wer in der zuletzt beendeten Partie den letzten (gewinnenden) Zug gespielt hat, gibt in der nächsten aus, und der Nächste in der Reihenfolge beginnt (nach dir kommt Rot). Der Spieler wird beim Spielende unter `aendi-dog-lastfin` gemerkt (`recordGame()`), gelesen wird er in `firstStart()` beim Anlegen der Partie. Gibt es noch keine beendete Partie oder ist der Wert ungültig, beginnst du. Ein abgebrochenes Spiel ändert nichts daran.

**Statistik.** Jede beendete Partie wird auf dem Gerät gespeichert (`recordGame()`, Schlüssel `aendi-dog-stats`, höchstens 300 Partien): Ende, Start, Dauer, Ergebnis, Stufe, Runden, Schläge für und gegen euch, Aussetzer, die Murmeln des unterlegenen Teams am Spielende und die Karte, mit der die achte Murmel ins Ziel kam (`fin`, bei einem Joker auch der Wert, als der er zählte, `finVal`, und wer ihn spielte, `finBy`). Die Dauer ist die aktive Spielzeit (`PLAYMS`): Sie läuft nur bei sichtbarer Seite, ohne offenen Dialog und vor Spielende, wird im Spielstand gesichert (`S.pms`) und bleibt beim Zurücknehmen erhalten. Der Start (`S.t0`) steht ebenfalls im Spielstand. „Letzte Partien“ zeigt Start (Datum und Uhrzeit), Ergebnis, Stufe, Schläge und Dauer, darüber stehen Durchschnitt, kürzeste, längste und gesamte Spielzeit (`timeStats()`). Bei Partien ohne gespeicherten Start (älter als Version 0.2.1, oder eine Partie, die vor dem Update begonnen wurde) steht „bis“ und die Uhrzeit des Spielendes; ohne Dauer zählen sie in den Zeiten nicht mit. Die Kartenverteilung zählt auch „Fehlstarts“ (`countStuck()`, `STATS.deal.m`): ein Spieler hat gleich nach dem Kartentausch keinen einzigen Zug, gezählt je Spieler und Runde, aufs Team gerechnet; das Zurücknehmen des Tauschs zieht den Zähler wieder ab (`S.stuckAdd`). Der Abschnitt „Die achte Murmel“ (`finStats()`) zeigt, wie oft die letzte Murmel mit dem Joker ins Ziel kam (insgesamt, euer Team, Gegner); Partien ohne Angabe zählen nicht mit. Die Statistik kommt bewusst mit wenig Erklärtext aus: Kacheln, Tabellen und Diagramme. Außerdem zählt das Spiel mit, wie oft in einer Partie „Zurücknehmen“ benutzt wurde (`UNDOS`, im Spielstand als `S.und`, in der Statistik als `undo`; der Zähler liegt wie `PLAYMS` außerhalb von `S`, damit das Zurücknehmen ihn nicht zurücksetzt). Der Wert wird nur gespeichert und bewusst nirgends angezeigt; er steht in jeder Partie der Statistik (ältere Partien haben ihn nicht).

**Bedienung.** Für deinen Zug sind alle legalen Züge vorberechnet (`S.legal`). Jeder Tipp filtert die Kandidaten weiter: Karte → Murmel → Zielfeld (bei der Sieben mehrmals). So kann die Oberfläche nie einen regelwidrigen Zug zulassen.

**Computergegner.** `feats()` beschreibt eine Stellung mit wenigen Merkmalen: Fortschritt, eigene Gefährdung, Angriffschancen, Murmeln im Ziel und draussen, Gegner im Zwinger, Blockaden. `evaluate()` gewichtet sie mit `W` (Standard `W0`). `aiChoose()` probiert alle Züge, zieht ab, was eine wertvolle Karte kostet, wendet deine festen Regeln an (`partnerBackPen`, `partnerGoalPen`) und schaut auf „Stark“ einen Zug voraus. Getauscht wird mit `aiGive()`: zuerst die Siegkarte (`winGive`), auf „Stark“ die Regeln für einen schon fertigen Partner (`endgameGive`), dann deine Tauschregeln (`ruleGive`, `killGive`), sonst nach Kartenwert. Die Taktik steht in `RULES.md`.

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
- App-Icon und Splash-Screen (`@capacitor/assets`)
- Mehrspieler über das Netzwerk
