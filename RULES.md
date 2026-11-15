# Taktik der Computerspieler

Keine Spielregeln, sondern vorgegebene Spielweise. Die Spielregeln selbst stehen im Regeln-Dialog (`index.html`, `<dialog id="rules">`) und in `src/engine.ts`.

**Wer sich daran hält:** Grün (dein Partner) immer, Rot und Gelb auf der Stufe „Stark“. Punkte mit dem Vermerk *alle Stufen* gelten für jeden Computerspieler.

Alle Funktionen liegen in `src/engine.ts`, sofern nicht anders angegeben.

## Kartentausch

1. **Siegkarte** *(alle Stufen)*: Wer eine Karte hält, mit der das Team sofort gewinnt, behält sie, wenn er in dieser Runde vor seinem Partner zieht. Zieht der Partner zuerst und gewinnt damit, bekommt er sie. Von zwei gleichen Siegkarten darf eine weg.
   → `winGive()`, aufgerufen in `aiGive()` mit `first` (wer zuerst zieht, `playsFirst()` in `app.ts`)
2. **Selbst festgefahren:** Wer sich so oder so nicht bewegen kann, gibt dem Partner seine beste Karte: die 7, mit kanadischer Regel stattdessen die 4. Die 7 bleibt dann in der Hand, weil man damit die Murmeln des Partners fahren kann.
   → `ruleGive()`, Regel 1
3. **Partner festgefahren:** Hat man selbst eine Murmel unterwegs und der Partner kommt nicht voran (alles im Zwinger oder blockiert), bekommt er König, Ass oder Joker, bei einer Blockade die 4. Je mehr Karten in der Runde ausgeteilt sind, desto eher gibt man auch teure Karten her (Grenze `20 × Kartenzahl`, gemessen am Tauschwert in `GIVE0`).
   → `ruleGive()`, Regel 2
4. **Karte zum Schlagen:** Kann der Partner mit einer Karte einen Gegner heimschicken, bekommt er sie. Bevorzugt werden Ziele kurz vor ihrem Ziel und Gegner, die direkt nach dem Partner dran sind. Beispiel: Der Partner steht frisch auf seinem Start, der nächste Gegner 4 vor seinem Ziel, also gibt man die Dame. Den Joker gibt man dafür nur her, wenn die Gegner nicht hinten liegen.
   → `killGive()`
5. Greift keine dieser Vorgaben, wird nach Kartenwert getauscht.
   → `giveVal()`, `GIVE0`

## Kartentausch, wenn ein Partner schon fertig ist

**Nur Stufe „Stark“, für alle Computerspieler.** Hat einer von beiden Partnern alle Murmeln im Ziel, fährt er nur noch mit den Murmeln des anderen, und nur der andere fährt eigene. Steckt diese Seite noch ganz im Zwinger, entscheidet die Reihenfolge, weil wer zuerst zieht eine Startkarte (Ass, König, Joker) braucht, sonst legt er seine ganze Hand ab:

- **Der Partner zieht zuerst:** Er bekommt meine billigste Startkarte, falls ich eine habe. Habe ich keine, bin ich nicht „festgefahren“ (ich fahre ja nach ihm mit seinen Murmeln). Dann gebe ich die Karte, die ich am wenigsten brauche, und nicht die 4 oder 7 der Regel „festgefahren“. Eine einzelne 4 hilft nicht: Die Murmel muss erst herauskommen und am Ende genau ins freie Zielfeld treffen.
- **Ich ziehe zuerst:** Ich behalte meine Startkarte, eine überzählige darf weg. Habe ich keine, ist meine Hand verloren, und ich gebe die Karte mit den meisten Feldern.
- Steht schon eine Murmel auf der Bahn, gelten die normalen Tauschregeln.

→ `endgameGive()`, aufgerufen in `aiGive()` mit `hard` und `first`; `ruleGive()` bekommt `skipStuck`.

Wirkung in einer nachgestellten Partie (du drei im Ziel, eine im Zwinger, Partner fertig, Gegner mitten im Rennen; je 900 Partien): Zieht der Partner vor dir, gewinnt die Mannschaft in 86,8 % statt 81,8 % (±2,5) der Partien; zieht er nach dir, 84,4 % statt 82,1 %.

## Spielzüge

6. **Partner nicht blockieren** *(alle Stufen)*: Mit einer frisch herausgekommenen Murmel auf dem eigenen Start hält man den Partner nicht auf, wenn er bis zu 6 Felder dahinter steht. Gegner aufzuhalten lohnt sich dagegen.
   → `feats()`, Merkmal `K`
7. **Keine Rückwärts-4 auf den Partner:** Nie mit der 4 vom eigenen Start zurückfahren, wenn das den Partner heimschickt. Ausnahme: Es gibt gar keinen anderen Zug.
   → `partnerBackPen()`
8. **Partnermurmeln nur mit triftigem Grund:** Mit den Murmeln des Partners (kanadische 7, Bube-Tausch mit dem Partner) fährt man nur, wenn es sich lohnt, zum Beispiel:
   - um einen Gegner zu schlagen,
   - um die Murmel in Sicherheit zu bringen,
   - um im Ziel des Partners nach innen aufzurücken,
   - um sie lückenlos ins tiefste freie Loch zu bringen. Ist sie in Gefahr, darf eine Lücke bleiben.

   Sind alle eigenen Murmeln im Ziel, fährt man nach den Regeln ohnehin mit denen des Partners. Dann gibt es keinen Abzug.
   → `partnerUsePen()`, `partnerGoalOk()`, `partnerGoalPen()`

9. **Deutlicher Vorsprung** *(nur Stufe „Stark“, alle Computerspieler)*: Hat das eigene Team mindestens 6 Murmeln im Ziel und mindestens 3 mehr als die Gegner (zum Beispiel 7 gegen 3), zählt der Weg der Gegner in der Bewertung nur noch zu 35 %. Ein Schlag bringt dann kaum mehr als der sichere Weg zum Sieg, und die KI fährt lieber so, dass die letzte Murmel schnell und sicher heimkommt. Das Beispiel: Die letzte Murmel steht frisch auf dem Start, ein Joker kann entweder als 10 einen fast heimgekehrten Gegner schlagen oder als 4 zurückfahren (5 Felder vor dem Ziel, dann genügt eine 5). Mit dem Vorsprung wählt die KI die 4. Im Kartentausch gibt es im Vorsprung keine „Schlag-Karte“ mehr (Tauschregel 3).
   → `isLead()`, `scoreF()` (Gewicht `L`), `TUNE.leadL` (0 = aus, Stand 0,65), `ruleGive(…, noKill)`

10. **Falle auf dem Startfeld** *(nur Stufe „Stark“, alle Computerspieler, nur bei Runden mit 5 oder 6 Karten)*: Steht eine eigene Murmel auf dem Startfeld eines Gegners X, der nichts auf der Bahn hat, aber Murmeln im Zwinger, und hat der Computer den Buben, tauscht er sie gegen eine Murmel von X' Partner (nicht gegen eine frische, die ist geschützt). Kommt X dann mit einer Startkarte heraus, schlägt er seine eigene Partnermurmel. Die KI rechnet den Zuschlag so: Gewicht (`TUNE.trap`, 1,5) × Wahrscheinlichkeit, dass die Falle wirkt (`pTrapWorks`) × Wert der Murmel auf dem Start von X (rund 57). X muss noch mindestens 4 Karten halten. Die Wahrscheinlichkeit beträgt ohne kanadische Sieben 60 / 68 / 75 % (X hält 4 / 5 / 6 Karten): Jede Startkarte (Ass, König, Joker) zwingt ihn herauszukommen. Mit kanadischer Sieben sind es nur etwa 30 %, denn X kann die Murmel seines Partners mit einer 7 oder einem Joker als 7 wegziehen, und genau das tut die KI auch (geprüft). Nur mit Ass oder König ohne 7 und Joker ist er gezwungen.
   → `trapBonus()`, `pTrapWorks()`, `aiChoose(…, ctx)` mit `ctx = {n, cnt}` (Karten der Runde, Kartenzahl je Spieler); die App merkt sich die Rundengrösse in `S.roundN`.

## Ausprobiert und verworfen

- **Karten sparen statt Gegner schlagen:** Eine Vorausschau, die weggeworfene Karten bestraft (zum Beispiel keine Joker für Schläge verheizen, wenn man danach aussetzen muss), gewann in Simulationen weniger oft: 47 bis 49 % gegen die bisherige KI, in je 2700 bis 5300 Partien. Deshalb ist sie nicht eingebaut.
- **Partner-Blockade bis 13 Felder und auch gegen eigene Murmeln:** 43 % statt 50 % in 800 Partien. Deshalb gilt nur noch der Partner und nur bis 6 Felder (Punkt 6).

- **Vorsprung ganz ohne Gegnerwerte (leadL = 1):** Das führende Team war zwar noch schneller, verlor aber etwas häufiger (94,4 % statt 95,4 % in 1707 Startstellungen mit gleichen Karten). Bei 0,8 waren es 94,8 %. Bei 0,65 gewinnt es gleich oft und ist rund 0,19 Runden schneller (±0,09; Mittel 2,47 gegen 2,31 Runden bis zum Sieg).

- **Falle ohne Zuschlag vs. mit Zuschlag (4200 Stellungen mit zufälligen Händen, Berti hat 5 Karten):** Ohne Falle tauscht Olaf in 63 % der Stellungen aus anderen Gründen, Berti schlägt seinen Partner in 21,5 % (kanadische Sieben) bzw. 43 % (ohne). Mit Gewicht 1: 80 / 91 % getauscht, 27,7 / 62 % Selbstschläge, Material +4,5 / +9,8. Mit 1,5: 86 / 97 %, 29,7 / 65,8 %, +4,3 / +9,0. Mit 2: 91 / 100 %, 31,6 / 67,9 %, +4,0 / +8,4. Das Gewicht 1 ist rechnerisch am besten; 1,5 kostet nur 0,2 Punkte Material und macht die Falle etwas häufiger. In ganzen Partien kommt sie selten vor (5 Fallen in 1463 Partien, also etwa einmal in 300), die Siegquote ändert sich nicht messbar (49,2 % ±2,6).

## Prüfen

- Regeltests: `npm test` (Abschnitte „Deine Spielregeln für die KI“, „Deine Tauschregeln“, „Siegkarte beim Tausch“, „Fertiger Partner“, „Deutlicher Vorsprung“)
- Spielstärke: `npm run sim -- hard medium 600`
