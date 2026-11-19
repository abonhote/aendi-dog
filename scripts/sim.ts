/**
 * KI gegen KI, ohne Oberfläche – zum Testen von Regeln und Bewertung.
 *   npm run sim                 → 20 Partien Stark gegen Mittel
 *   npm run sim -- hard easy 50 → Stufe Team Blau/Grün, Stufe Team Rot/Gelb, Anzahl
 */
import {
  SIZES,
  aiChoose,
  aiGive,
  applyAll,
  initMarbles,
  makeDeck,
  teamWon,
  type Card,
  type Level,
} from '../src/engine';

function play(levels: [Level, Level]): number {
  let ms = initMarbles(),
    deck: Card[] = [],
    cycle = 0,
    start = 0;
  for (let round = 0; round < 300; round++) {
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
        const mv = aiChoose(ms, t, hands[t], levels[t % 2]);
        if (!mv) hands[t] = [];
        else {
          ms = applyAll(ms, mv.segs).ms;
          hands[t] = hands[t].filter(c => c.id !== mv.card.id);
          if (teamWon(ms, t % 2)) return t % 2;
        }
      }
      t = (t + 1) % 4;
    }
  }
  return -1;
}

const [a = 'hard', b = 'medium', count = '20'] = process.argv.slice(2);
const wins = [0, 0];
const t0 = Date.now();
for (let i = 0; i < +count; i++) {
  const w = play([a as Level, b as Level]);
  if (w >= 0) wins[w]++;
}
console.log(
  `Blau/Grün (${a}) ${wins[0]} : ${wins[1]} Rot/Gelb (${b})  –  ${((Date.now() - t0) / +count).toFixed(0)} ms pro Partie`,
);
