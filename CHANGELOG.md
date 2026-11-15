# Änderungen

Versionen nach [Semantic Versioning](https://semver.org/lang/de/): `0.0.x` = Entwicklungsstand vor der ersten Veröffentlichung.

## 0.2.15

- **Einstellungen: „Zurücksetzen“** setzt jetzt alles auf die Standardwerte (Namen und Farben, Ansicht, Gegner, Tempo, Darstellung, Töne, Gewinnanimation, Doppeltipp). „Abbrechen“ macht es rückgängig. Die Statistik bleibt unberührt.
- **Menüpunkt „Über Ändi Dog“:** Version und ein E-Mail-Link (`CONTACT_MAIL` in `app.ts`). Wahlweise werden Spielverlauf und Spielbrett (als Text: Hände, Murmeln, letzte Karte) in den Mailtext geschrieben. Ein mailto-Link kann nichts anhängen und ist in der Länge begrenzt, darum wird gekürzt; „Angaben kopieren“ liefert alles.

## 0.2.14

- **Statistik „Fehlstarts“:** Unter der Kartenverteilung steht, wie oft ein Spieler seines Teams gleich nach dem Kartentausch keinen einzigen Zug hatte (ihr / Gegner, je Spieler und Runde). Zurücknehmen des Tauschs zieht die Zählung wieder ab. Frühere Runden sind nicht erfasst.

## 0.2.13

- **Spielerfarben:** Ringe, Namen und Zeichen auf dem Brett konnten in den Standardfarben bleiben, während die Murmeln deine gewählten Farben zeigten (Murmeln im „falschen“ Zwinger). Die Farben werden jetzt zusätzlich direkt am Dokument gesetzt (`seatVars()`), auch beim Wechsel zwischen hell und dunkel.

## 0.2.12

- **Statistik mit weniger Text:** Unter „Die achte Murmel“ stehen nur noch die drei Kacheln (Joker insgesamt, euer Team, Gegner). Die Zeilen mit der Jokerquote, den Jokerwerten und allen Karten sind entfernt, ebenso die Erklärtexte unter „Letzte Partien“, bei „Wie knapp war es?“, bei der Kartenverteilung und in den leeren Zuständen. Die gespeicherten Daten bleiben unverändert.

## 0.2.11

- **Falle auf dem Startfeld** (nur Stufe „Stark“, alle Computerspieler, bei Runden mit 5 oder 6 Karten): Steht eine eigene Murmel auf dem Startfeld eines Gegners, der nichts auf der Bahn hat, aber Murmeln im Zwinger, tauscht der Computer sie mit dem Buben gegen eine Murmel von dessen Partner. Kommt der Gegner heraus, schlägt er seine eigene Partnermurmel. Die KI rechnet mit der echten Wahrscheinlichkeit: ohne kanadische Sieben 60 bis 75 %, mit kanadischer Sieben etwa 30 %, weil der Gegner dann mit einer 7 oder einem Joker als 7 ausweichen kann (das tut die KI selbst auch). Gewicht `TUNE.trap` = 1,5.

## 0.2.10

- **Hand sortiert, Ass über dem König:** Nach dem Austeilen sortiert das Spiel deine Karten wie in der Schweiz: von links nach rechts aufsteigend 2 bis 10, Bube, Dame, König, Ass, ganz rechts der Joker (bei gleichem Wert ♠ ♥ ♣ ♦). Beim Austeilen liegen die Karten zuerst in der Reihenfolge des Eintreffens und gleiten danach an ihren Platz; vorher stand das Ass ganz links und die Hand sortierte sich bei jeder neuen Karte sofort neu. Dieselbe Reihenfolge gilt in der Jokerauswahl. Die Karte, die du beim Tausch bekommst, wird an ihrem Platz in der Reihe eingefügt.

## 0.2.9

- **„rückgängig“ wird nicht mehr angezeigt:** Die Zeile unter „Sieg“ in „Letzte Partien“ und der Satz in der Fussnote sind wieder weg. Das Spiel zählt weiterhin pro Partie mit, wie oft „Zurücknehmen“ benutzt wurde, und speichert es in der Statistik (`undo`), zeigt es aber nirgends an.

## 0.2.8

- **Statistik: „rückgängig“ mitgezählt:** Das Spiel zählt pro Partie mit, wie oft „Zurücknehmen“ benutzt wurde (Zug oder Kartentausch). Bei Siegen steht es in „Letzte Partien“ unter „Sieg“ („0 × rückgängig“, „3 × rückgängig“). Bei Niederlagen und Partien aus älteren Versionen steht nichts.

## 0.2.7

- **Gewinnanimation „Großes Finale“:** Gewinnt dein Team, gibt es ein Feuerwerk, dann Konfetti-Kanonen und am Ende einen Konfettiregen, in den Farben deines Teams (die vier Spielerfarben plus Weiss und Lila), ohne Ton. Sie läuft auf dem Spielbrett, das dabei leicht abgedunkelt wird (hell stärker, dunkel schwächer). Ein Tippen beendet sie. Bei einer Niederlage gibt es keine Animation. Neue Einstellung „Gewinnanimation“ (Ein/Aus); bei „Bewegung reduzieren“ im System bleibt sie aus.
- **Kein Textfenster mehr am Spielende:** Das Ergebnis steht in der Statuszeile („Gewonnen!“ oder „Verloren.“). Unten rechts erscheint der Knopf „Neues Spiel“; die Statistik erreichst du über das Menü. „Letzten Zug zurücknehmen“ heisst am Spielende kürzer „Zurücknehmen“.
- Neu im Ordner `tools`: `animationslabor.html` zum Ansehen und Abstimmen der Gewinnanimationen.

## 0.2.6

- **Wer beginnt:** Bisher begann immer du. Jetzt gibt der Spieler aus, der in der letzten beendeten Partie den letzten (gewinnenden) Zug gespielt hat, und der Nächste in der Reihenfolge beginnt. Gewinnst du mit dem letzten Zug, gibst du aus und Rot beginnt. Die allererste Partie beginnst weiterhin du.

## 0.2.5

- **Offline:** Die Schriften (Bricolage Grotesque, Atkinson Hyperlegible) liegen jetzt lokal in der App (`@fontsource/…`), die drei Google-Fonts-Zeilen in `index.html` sind weg. Die App fragt nirgends mehr im Netz nach.
- **Keine Internetberechtigung:** Neues Skript `scripts/android-offline.mjs` (`npm run android:offline`, in `npm run android` eingebunden) entfernt die `INTERNET`-Berechtigung, die Capacitor standardmässig einträgt. Anleitung und Prüfung im README („Offline, ohne Internetberechtigung“).
- Die Schriften sind jetzt die festen Schnitte ohne automatische optische Grösse, grosse Überschriften sehen minimal anders aus.

## 0.2.4

- **Taktik bei deutlichem Vorsprung** (nur Stufe „Stark“, alle Computerspieler): Bei mindestens 6 Murmeln im Ziel und mindestens 3 mehr als die Gegner (zum Beispiel 7 gegen 3) zählt der Weg der Gegner nur noch zu 35 %. Die KI schlägt dann nicht mehr um jeden Preis, sondern bringt die letzte Murmel schnell und sicher heim, zum Beispiel mit dem Joker als 4 zurück statt als 10 zum Schlagen. Im Kartentausch gibt es im Vorsprung keine Schlag-Karte mehr. In gleichen Startstellungen mit Vorsprung gewinnt das führende Team gleich oft und etwa 7 % schneller; in ganzen Partien ändert sich nichts messbar (49,2 % ±2,0).

## 0.2.3

- **Statistik „Die achte Murmel“:** Wie oft die letzte Murmel mit dem Joker ins Ziel kam (insgesamt, euer Team, Gegner), als welcher Wert der Joker zählte und womit sonst. Die Karte des entscheidenden Zuges wird ab dieser Version gespeichert, ältere Partien haben keine Angabe und zählen nicht mit.

## 0.2.2

- **Statistik:** Bei Partien ohne gespeicherten Start (ältere Partien und die, die beim Update schon liefen) steht in „Letzte Partien“ jetzt „bis“ und die Uhrzeit des Spielendes statt nur des Datums. Partien ab 0.2.1 zeigen die Startzeit.

## 0.2.1

- **Das Brett springt nicht mehr:** Die Statuszeile reserviert immer die Höhe des längsten möglichen Textes, und die beiden längsten Texte (Kartentausch, „Deine Murmeln sind im Ziel …“) sind kürzer. Auf schmalen Handys (bis 375 px Breite) werden die Handkarten so weit verkleinert, dass sechs in eine Reihe passen, sonst brach die Hand um und das Brett rutschte.
- **Neue Töne** (ausgewählt im Soundlabor): Mischen „Abheben, langsamer“, Austeilen „Rutschen“, Karte tauschen „Schieben“ mit Landetippen, Karte ablegen „Papier“, Murmel hinstellen „Tief klopfen“, Murmel ziehen „Weiches Tippen“, Murmel heimschicken „Fallen“. Austeilen, Tauschen und Ablegen von Karten tönen jetzt. Lautstärke und Geschwindigkeit je Tonart einstellbar im Code (`SNDG`, `SNDS`). Das Mischen dauert in „Normal“ etwa 3,8 s, das Spiel wartet darauf (nur mit Ton).
- **Statistik:** Dauer (aktive Spielzeit) und Startzeit jeder Partie. Neue Kacheln für Durchschnitt, kürzeste, längste und gesamte Spielzeit, das Spielende nennt die Spielzeit. Die Tabellen „Letzte Partien“ und „Wie knapp war es?“ sind kompakter und scrollen auf Handys nicht mehr seitlich.
- **Soundlabor** (`tools/soundlabor.html`): eigenständige Seite zum Anhören und Auswählen von Tönen mit Reglern für Lautstärke und Geschwindigkeit.
- Aufgeräumt: ältere, nie aufgerufene Tauschanimation entfernt.

## 0.2.0

- **Töne** (Einstellungen → Töne, standardmässig an): Mischen, Austeilen, Murmel hinstellen und Murmel ziehen, im Browser erzeugt. Beim Heimschicken klingt das Hinstellen dunkler, beim Buben-Tausch klicken beide Murmeln.
- **Kartenstapel beim Geber:** Der Stapel liegt immer beim Geber, links neben dessen Zieleinlauf, schräg (45°) und etwas kleiner als die abgelegten Karten. Er hat eine Kartenrückseite, und die Austeil-Animation startet dort, in beiden Ansichten.
- **Kartentausch bei fertigem Partner** (nur Stufe „Stark“, alle Computerspieler): Hat ein Partner alle Murmeln im Ziel und stecken die Murmeln des anderen noch im Zwinger, bekommt der zuerst Ziehende die Startkarte. Die 4 als Notlösung entfällt. In der nachgestellten Lage steigt die Gewinnchance von 81,8 auf 86,8 % (siehe `RULES.md`).

## 0.1.1

- **Einstellungen kompakt:** Eine Zeile je Spieler mit Name und Farbknopf (Farbfeld ohne Farbnamen), dazu Ansicht, Gegner und Tempo (aus dem Menü hierher verschoben), neu Darstellung (Automatisch, Hell, Dunkel) und Doppeltipp.
- **Namen folgen der Farbe:** Steht noch ein Standardname („Rot“, „Grün“ …) und die Farbe ändert sich, ändert sich der Name mit. Der Spielverlauf nennt Spieler beim Namen statt nach der Murmelfarbe.
- **Doppeltipp-Zeitfenster:** Beim Kartentausch sinkt die Karte zurück, wenn der zweite Tipp nicht innerhalb von 0,5 s (einstellbar) kommt.
- **Menü:** Einstellungen stehen oben, die Version unten.

## 0.1.0

- **Einstellungen** (☰ → Einstellungen): Namen und Farben für alle vier Plätze – du, Partner, Gegner links, Gegner rechts. Neun Farben zur Wahl; ist eine Farbe schon vergeben, tauschen die beiden Plätze. Namen erscheinen auf dem Brett, im Spielverlauf, beim Kartentausch, am Spielende und in der Statistik.
- **Karten werfen:** Karten lassen sich weiterhin antippen oder jetzt auch mit einer Wischbewegung aufs Brett werfen. Werfen zählt wie Antippen, beim Kartentausch wie zweimal Antippen. Die Animationen bleiben dieselben.
- **Statistik „Wie knapp war es?“:** Bei jeder Partie wird gezählt, wie viele Murmeln das unterlegene Team am Ende noch daheim, unterwegs und im Ziel hatte – als Durchschnitt (getrennt danach, ob ihr gewonnen oder verloren habt) und als Balken je Partie.

## 0.0.3

- **Behoben:** Bei der Sieben darf dieselbe Murmel jetzt mehrmals gefahren werden, und die Murmeln dürfen sich beliebig abwechseln (zum Beispiel A +1, B +2, A +4). Vorher durfte jede Murmel nur einmal vorkommen, die zweite musste alle übrigen Schritte auf einmal fahren. Das Spiel bietet nur Schritte an, nach denen sich die 7 noch vollständig fahren lässt. Für das Heimschicken zählt die Reihenfolge der Teilschritte.
- **Computergegner:** nutzen dieselbe Zugerzeugung (mehr mögliche Endstellungen); die Spielstärke bleibt gleich (50,5 % ±1,8 gegen die alte Fassung in 2898 Partien).

## 0.0.2

- **Entfernt:** „Grün lernt von dir“ – das Lernen von Spielzügen und Tausch samt Rückfragen, die Einstellung im Neues-Spiel-Dialog und die Auswertungen in der Statistik („Grün versteht dich“, „Wirkt das Lernen?“, „Grüns gelernter Stil“). Die fest vorgegebene Taktik der Computerspieler bleibt (`RULES.md`).
- **Statistik:** „Letzte Partien“ ohne Lern-Spalte. Bereits gespeicherte Partien bleiben lesbar. Alte Lerndaten (`aendi-dog-learn` im Browser-Speicher) werden nicht mehr gelesen.
- **Version:** unten im ☰-Menü und in `package.json`.

## 0.0.1 – erster versionierter Stand

Spiel für 4 Spieler in zwei Teams (du und Grün gegen Rot und Gelb), Brett nach dem Original-Achteck, flache Ansicht, 3D und Murmelsicht.

- **Regeln:** alle Kartenwerte, Blockade, Sieben aufteilen, Zieleinlauf, Bube nur mit erlaubtem Tausch. Varianten (kanadische 7, kein Joker für die achte Murmel) im Neues-Spiel-Dialog.
- **Ablauf:** Mischen wie am Tisch (neu erst, wenn der Stapel nicht reicht), Austeilen in Päckchen mit Animation, Stapel beim Geber, Kartentausch, Zurücknehmen von Zug und Tausch.
- **Computergegner:** drei Stufen. Taktik siehe `RULES.md`. „Grün lernt von dir“ (Spielstil und Tausch, mit Rückfrage).
- **Statistik:** Siegquote, Übereinstimmung mit Grün, Vergleich mit und ohne Lernen, letzte Partien, gelernter Stil, Kartenverteilung pro Team.
- **Android:** Capacitor-Projekt, adaptives Icon mit Themen-Icon, appId `ch.aendi.aendidog`.
