/**
 * Regeltests nach der Spielanleitung.
 * Ausführen: npm test   (oder npm run test:watch während der Entwicklung)
 *
 * Murmel-IDs: Blau 0–3, Rot 4–7, Grün 8–11, Gelb 12–15.
 * Startfelder: Blau 0, Rot 16, Grün 32, Gelb 48. Vorwärts = Feldnummer + 1.
 */
import { afterEach, describe, expect, test } from 'vitest';
import {
  OPT, aiChoose, aiGive, applyAll, initMarbles, legalMoves, makeDeck, teamWon,
  type Board, type Card, type Move, type Rank,
} from '../src/engine';

// ---------------------------------------------------------------- Hilfen

let nextId = 1000;
/** Karte(n) erzeugen: hand('A', '7') */
const hand = (...ranks: Rank[]): Card[] => ranks.map(r => ({ id: nextId++, r, s: r === 'JO' ? '★' : '♠' }));

/** Brett aufbauen. Kurzschreibweise: { 0: 'T10', 1: 'T0f' (frisch), 2: 'G3' } */
function board(spec: Record<number, string>): Board {
  const ms = initMarbles();
  for (const [id, s] of Object.entries(spec)) {
    const m = ms[+id];
    m.loc = s[0] as 'T' | 'G' | 'K';
    m.pos = parseInt(s.slice(1), 10) || 0;
    m.fresh = s.endsWith('f');
  }
  return ms;
}

/** Zug als Text, z. B. „0:T15“ oder „3:G0_0 8:T44“ (Murmel:Ziel je Teilschritt). */
const str = (mv: Move) => mv.segs.map(s => `${s.m}:${s.to}`).join(' ');
const moves = (ms: Board, p: number, h: Card[]) => legalMoves(ms, p, h, false);
const list = (ms: Board, p: number, h: Card[]) => moves(ms, p, h).map(str);
const find = (ms: Board, p: number, h: Card[], s: string) => moves(ms, p, h).find(mv => str(mv) === s);

afterEach(() => { OPT.canadian = false; OPT.jokerNo8 = false; });

// ---------------------------------------------------------------- Tests

describe('Auf den Start', () => {
  test('Ass, König und Joker bringen eine Murmel auf den Start', () => {
    for (const r of ['A', 'K', 'JO'] as Rank[]) {
      expect(moves(initMarbles(), 0, hand(r)).some(mv => mv.segs[0].t === 'out')).toBe(true);
    }
  });

  test('ohne Startkarte und ohne Murmel draussen gibt es keinen Zug', () => {
    expect(moves(initMarbles(), 0, hand('5', '7', 'D'))).toHaveLength(0);
  });

  test('nicht rauskommen, solange eine eigene frische Murmel auf dem Start steht', () => {
    const ms = board({ 0: 'T0f' });
    expect(moves(ms, 0, hand('A')).some(mv => mv.segs[0].t === 'out')).toBe(false);
  });

  test('Rauskommen schickt eine fremde Murmel vom Start heim', () => {
    const ms = board({ 4: 'T0' });
    const mv = moves(ms, 0, hand('K')).find(m => m.segs[0].t === 'out')!;
    const r = applyAll(ms, mv.segs);
    expect(r.killed).toEqual([4]);
    expect(r.ms[4].loc).toBe('K');
  });
});

describe('Blockade auf dem Start', () => {
  test('eine frisch herausgekommene Murmel kann nicht überholt werden', () => {
    const ms = board({ 8: 'T32f', 0: 'T30' });
    expect(list(ms, 0, hand('5'))).toHaveLength(0);
    const ass = list(ms, 0, hand('A'));
    expect(ass).toContain('0:T31');          // 1 vorwärts geht
    expect(ass).not.toContain('0:T41');      // 11 vorwärts nicht
  });

  test('… und nicht geschlagen werden (Landen verboten)', () => {
    const ms = board({ 8: 'T32f', 0: 'T30' });
    expect(list(ms, 0, hand('2'))).toHaveLength(0);
  });

  test('kommt eine Murmel ein weiteres Mal auf den Start, blockiert sie nicht', () => {
    const ms = board({ 8: 'T32', 0: 'T30' });
    expect(list(ms, 0, hand('5'))).toContain('0:T35');
    expect(list(ms, 0, hand('2'))).toContain('0:T32');
  });
});

describe('Heimschicken', () => {
  test('Landen schickt eine fremde Murmel in den Zwinger', () => {
    const ms = board({ 0: 'T10', 4: 'T15' });
    expect(applyAll(ms, find(ms, 0, hand('5'), '0:T15')!.segs).killed).toEqual([4]);
  });

  test('… auch eine eigene', () => {
    const ms = board({ 0: 'T10', 1: 'T15' });
    expect(applyAll(ms, find(ms, 0, hand('5'), '0:T15')!.segs).killed).toEqual([1]);
  });

  test('normales Überholen schickt nicht heim', () => {
    const ms = board({ 0: 'T10', 4: 'T12' });
    expect(applyAll(ms, find(ms, 0, hand('5'), '0:T15')!.segs).killed).toEqual([]);
  });

  test('Murmeln im Ziel sind sicher', () => {
    const ms = board({ 0: 'G1', 4: 'T10' });
    expect(list(ms, 1, hand('B'))).toHaveLength(0); // Rot kann nicht mit Blau im Ziel tauschen
  });
});

describe('Sieben', () => {
  test('jede überholte Murmel muss heim, auch eigene', () => {
    const ms = board({ 0: 'T10', 1: 'T12', 4: 'T14' });
    const r = applyAll(ms, find(ms, 0, hand('7'), '0:T17')!.segs);
    expect(r.killed.sort()).toEqual([1, 4]);
  });

  test('lässt sich auf mehrere Murmeln aufteilen', () => {
    const ms = board({ 0: 'T10', 1: 'T40' });
    expect(list(ms, 0, hand('7'))).toContain('0:T13 1:T44');
  });

  test('alle 7 Schritte müssen gefahren werden', () => {
    const ms = board({ 0: 'G1', 1: 'G3' }); // nur noch 1 Schritt möglich
    expect(moves(ms, 0, hand('7'))).toHaveLength(0);
  });

  test('Rest der 7 mit dem Partner, sobald die letzte eigene Murmel im Ziel ist', () => {
    const ms = board({ 0: 'G1', 1: 'G2', 2: 'G3', 3: 'T62', 8: 'T40' });
    expect(list(ms, 0, hand('7'))).toContain('3:G0_0 8:T44');
  });
});

describe('Zieleinlauf', () => {
  test('eine frische Murmel darf nicht direkt ins Ziel', () => {
    const ms = board({ 0: 'T0f' });
    expect(list(ms, 0, hand('3'))).toEqual(['0:T3']);
  });

  test('über den eigenen Start ins Ziel', () => {
    const ms = board({ 0: 'T62' });
    expect(list(ms, 0, hand('3'))).toEqual(expect.arrayContaining(['0:T1', '0:G0_0']));
  });

  test('der schnellste Weg: Start, mit der 4 zurück, dann ins Ziel', () => {
    let ms = board({ 0: 'T0f' });
    ms = applyAll(ms, find(ms, 0, hand('4'), '0:T60')!.segs).ms;
    expect(list(ms, 0, hand('5'))).toContain('0:G0_0'); // 4 bis zum Start, 1 ins Ziel
    expect(list(ms, 0, hand('8'))).toContain('0:G0_3'); // bis ganz nach innen
  });

  test('im Ziel wird nicht übersprungen', () => {
    const ms = board({ 0: 'T63', 1: 'G1' });
    expect(list(ms, 0, hand('3')).some(s => s.includes('G'))).toBe(false);
    expect(list(ms, 0, hand('2'))).toContain('0:G0_0');
  });

  test('im Ziel wird nicht rückwärts gefahren', () => {
    const ms = board({ 0: 'G0' });
    expect(moves(ms, 0, hand('4'))).toHaveLength(0);
  });
});

describe('Bube', () => {
  test('tauscht eine eigene Murmel mit einer des Gegners', () => {
    const ms = board({ 0: 'T10', 4: 'T20' });
    const r = applyAll(ms, find(ms, 0, hand('B'), '0:T20')!.segs).ms;
    expect([r[0].pos, r[4].pos]).toEqual([20, 10]);
  });

  test('… oder des Partners', () => {
    const ms = board({ 0: 'T10', 8: 'T40' });
    expect(list(ms, 0, hand('B'))).toContain('0:T40');
  });

  test('frische Murmeln auf dem Start dürfen nicht getauscht werden', () => {
    expect(moves(board({ 0: 'T10', 4: 'T16f' }), 0, hand('B'))).toHaveLength(0);
    expect(moves(board({ 0: 'T0f', 4: 'T20' }), 0, hand('B'))).toHaveLength(0);
  });

  test('ohne erlaubten Tausch ist der Bube nicht spielbar', () => {
    const ms = board({ 0: 'T10', 1: 'T20' }); // nur eigene Murmeln unterwegs
    expect(moves(ms, 0, hand('B'))).toHaveLength(0);
    expect(moves(ms, 0, hand('B', '5')).every(mv => mv.card.r === '5')).toBe(true);
  });
});

describe('Team', () => {
  test('sind alle eigenen Murmeln im Ziel, spielt man mit denen des Partners', () => {
    const ms = board({ 0: 'G0', 1: 'G1', 2: 'G2', 3: 'G3', 8: 'T40' });
    expect(list(ms, 0, hand('5'))).toEqual(['8:T45']);
  });

  test('gewonnen erst, wenn alle acht Murmeln im Ziel sind', () => {
    const ms = board({ 0: 'G0', 1: 'G1', 2: 'G2', 3: 'G3', 8: 'G0', 9: 'G1', 10: 'G2' });
    expect(teamWon(ms, 0)).toBe(false);
    ms[11].loc = 'G'; ms[11].pos = 3;
    expect(teamWon(ms, 0)).toBe(true);
  });
});

describe('Varianten', () => {
  test('kanadische 7er-Regel: mit der 7 auch Murmeln des Partners fahren', () => {
    const ms = board({ 8: 'T40' }); // Blau komplett im Zwinger
    expect(moves(ms, 0, hand('7'))).toHaveLength(0);
    OPT.canadian = true;
    expect(list(ms, 0, hand('7'))).toEqual(['8:T47']);
    expect(moves(ms, 0, hand('5'))).toHaveLength(0); // andere Karten weiterhin nicht
  });

  test('achte Murmel nicht mit dem Joker ins Ziel', () => {
    const ms = board({ 0: 'G0', 1: 'G1', 2: 'G2', 3: 'G3', 8: 'G1', 9: 'G2', 10: 'G3', 11: 'T30' });
    const wins = (h: Card[]) => moves(ms, 0, h).some(mv => teamWon(applyAll(ms, mv.segs).ms, 0));
    expect(wins(hand('JO'))).toBe(true);
    OPT.jokerNo8 = true;
    expect(wins(hand('JO'))).toBe(false);
    expect(wins(hand('3'))).toBe(true); // mit einer normalen 3 schon
  });
});

describe('Karten', () => {
  test('zwei Sets à 55 Karten: 110 Karten, 6 Joker, je 8 pro Wert', () => {
    const d = makeDeck();
    expect(d).toHaveLength(110);
    expect(d.filter(c => c.r === 'JO')).toHaveLength(6);
    expect(d.filter(c => c.r === '7')).toHaveLength(8);
    expect(new Set(d.map(c => c.id)).size).toBe(110);
  });
});

describe('Computergegner', () => {
  test('wählt immer einen legalen Zug', () => {
    for (let i = 0; i < 50; i++) {
      const ms = board({ 0: 'T5', 4: 'T20', 8: 'T40', 12: 'T52', 1: 'T0f' });
      const h = makeDeck().slice(0, 4);
      const mv = aiChoose(ms, 0, h, 'hard');
      const legal = legalMoves(ms, 0, h, false).map(str);
      if (mv) expect(legal).toContain(str(mv));
      else expect(legal).toHaveLength(0);
    }
  });

  test('bringt eine Murmel ins Ziel, statt sie ungeschützt stehen zu lassen', () => {
    // Fall aus dem Spiel: Grün hat alle im Ziel und spielt mit Blau.
    // Blau: zwei im Ziel, eine frisch auf dem Start, eine 4 vor dem Start.
    const ms = board({ 0: 'G3', 1: 'G2', 2: 'T0f', 3: 'T60', 8: 'G0', 9: 'G1', 10: 'G2', 11: 'G3', 4: 'T20', 12: 'T50' });
    const mv = aiChoose(ms, 2, hand('7', '9', '5'), 'hard')!;
    expect(applyAll(ms, mv.segs).ms[3].loc).toBe('G');
  });
});

describe('Deine Spielregeln für die KI', () => {
  test('Grün fährt nie mit der 4 vom Start zurück auf deine Murmel', () => {
    const ms = board({ 8: 'T32f', 0: 'T28', 4: 'T10' });
    expect(str(aiChoose(ms, 2, hand('4', '5'), 'hard')!)).toBe('8:T37');
    expect(str(aiChoose(ms, 2, hand('4'), 'hard')!)).toBe('8:T36'); // lieber vorwärts
  });

  test('Grün blockiert dich nicht, kommt aber gegen Gegner raus', () => {
    // Blau: 3 im Ziel, letzte Murmel 3 vor Grüns Start. Grün: eine draussen, eine im Zwinger.
    const mitDir = board({ 0: 'G3', 1: 'G2', 2: 'G1', 3: 'T29', 8: 'G3', 9: 'G2', 10: 'T45', 12: 'T5' });
    expect(aiChoose(mitDir, 2, hand('A', '5'), 'hard')!.segs[0].t).not.toBe('out');
    const mitRot = board({ 0: 'G3', 1: 'G2', 2: 'G1', 4: 'T29', 8: 'G3', 9: 'G2', 10: 'T45', 12: 'T5' });
    expect(aiChoose(mitRot, 2, hand('A', '5'), 'hard')!.segs[0].t).toBe('out');
  });
});

describe('Deine Tauschregeln', () => {
  const gibt = (ms: Board, h: Card[]) => aiGive(ms, 2, h, null, true).r;

  test('1) wer nicht ziehen kann, gibt die 7 – mit kanadischer Regel die 4', () => {
    const ms = board({ 0: 'T10' }); // Grün komplett im Zwinger, keine Startkarte
    expect(gibt(ms, hand('4', '7', '9', '2', '5', '6'))).toBe('7');
    OPT.canadian = true;
    expect(gibt(ms, hand('4', '7', '9', '2', '5', '6'))).toBe('4');
  });

  test('2) dem festgefahrenen Partner eine Startkarte geben – den Joker nur bei vielen Karten', () => {
    const ms = board({ 8: 'T40' }); // Blau komplett im Zwinger
    expect(gibt(ms, hand('K', 'A', 'JO', '9', '5', '2'))).toBe('K');
    expect(gibt(ms, hand('JO', '9', '5', '2', '3', '8'))).toBe('JO');
    expect(gibt(ms, hand('JO', '9', '5', '2'))).not.toBe('JO');
  });

  test('2) dem blockierten Partner die 4 geben', () => {
    const ms = board({ 8: 'T40', 12: 'T48f', 0: 'T45', 1: 'G3', 2: 'G2', 3: 'G1' });
    expect(gibt(ms, hand('4', '9', 'K', '2', '5'))).toBe('4');
  });

  test('3) Dame, wenn der Partner auf dem Start steht und der nächste Gegner 4 vor seinem Ziel', () => {
    const ms = board({ 0: 'T0f', 4: 'T12', 8: 'T40' });
    expect(gibt(ms, hand('D', '9', '5', '2', '3', '8'))).toBe('D');
  });
});
