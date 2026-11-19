/**
 * Regeltests nach der Spielanleitung.
 * Ausführen: npm test   (oder npm run test:watch während der Entwicklung)
 *
 * Murmel-IDs: Blau 0–3, Rot 4–7, Grün 8–11, Gelb 12–15.
 * Startfelder: Blau 0, Rot 16, Grün 32, Gelb 48. Vorwärts = Feldnummer + 1.
 */
import { afterEach, describe, expect, test } from 'vitest';
import {
  OPT,
  TUNE,
  aiChoose,
  aiGive,
  applyAll,
  applySeg,
  cloneMs,
  endgameGive,
  feats,
  initMarbles,
  isLead,
  killGive,
  legalMoves,
  makeDeck,
  pTrapWorks,
  sevenOptions,
  teamWon,
  trapBonus,
  winGive,
  type Board,
  type Card,
  type Move,
  type Rank,
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
const moves = (ms: Board, p: number, h: Card[]) => legalMoves(ms, p, h, true); // alle Endzustände (bei der Sieben je Endzustand ein Zug)
const list = (ms: Board, p: number, h: Card[]) => moves(ms, p, h).map(str);
const find = (ms: Board, p: number, h: Card[], s: string) => moves(ms, p, h).find(mv => str(mv) === s);

afterEach(() => {
  OPT.canadian = false;
  OPT.jokerNo8 = false;
});

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
    expect(ass).toContain('0:T31'); // 1 vorwärts geht
    expect(ass).not.toContain('0:T41'); // 11 vorwärts nicht
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
    ms[11].loc = 'G';
    ms[11].pos = 3;
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
    const ms = board({
      0: 'G3',
      1: 'G2',
      2: 'T0f',
      3: 'T60',
      8: 'G0',
      9: 'G1',
      10: 'G2',
      11: 'G3',
      4: 'T20',
      12: 'T50',
    });
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

describe('Siegkarte beim Tausch', () => {
  // Grün hat alle Murmeln im Ziel und fährt mit Blau; Blaus letzte Murmel braucht genau eine 5.
  const endspiel = () =>
    board({ 8: 'G0', 9: 'G1', 10: 'G2', 11: 'G3', 0: 'G3', 1: 'G2', 2: 'G1', 3: 'T60', 4: 'T30', 12: 'T50' });

  test('zieht Grün vor dir, behält er die 5 und gewinnt selbst', () => {
    const ms = endspiel(),
      h = hand('5', '9');
    expect(aiGive(ms, 2, h, null, true, true).r).toBe('9');
    const mv = aiChoose(ms, 2, [h[0], ...hand('2')], 'hard')!;
    expect(teamWon(applyAll(ms, mv.segs).ms, 0)).toBe(true);
  });

  test('ziehst du vor Grün, bekommst du die 5', () => {
    expect(aiGive(endspiel(), 2, hand('5', '9'), null, true, false).r).toBe('5');
  });

  test('von zwei Fünfen darf eine weg, ohne Siegkarte greift nichts', () => {
    expect(winGive(endspiel(), 2, hand('5', '5'), true).keep.size).toBe(1);
    const w = winGive(board({ 0: 'T10', 8: 'T40' }), 2, hand('K', '2'), true);
    expect(w.give).toBe(null);
    expect(w.keep.size).toBe(0);
  });
});

describe('Partnermurmeln nur mit Grund (kanadische 7)', () => {
  const usesBlue = (ms: Board, mv: Move) => mv.segs.some(s => s.t === 'mv' && ms[s.m].color === 0);

  test('ohne Grund fährt Grün mit der eigenen Murmel', () => {
    OPT.canadian = true;
    const ms = board({ 8: 'T40', 1: 'T10', 12: 'T58' });
    expect(usesBlue(ms, aiChoose(ms, 2, hand('7'), 'hard')!)).toBe(false);
  });

  test('mit Grund (Gegner schlagen) fährt er mit deiner Murmel', () => {
    OPT.canadian = true;
    const ms = board({ 8: 'T40', 0: 'T10', 4: 'T14' });
    const mv = aiChoose(ms, 2, hand('7'), 'hard')!;
    expect(usesBlue(ms, mv)).toBe(true);
    expect(applyAll(ms, mv.segs).killed).toContain(4);
  });

  test('lückenlos ins Ziel ja, mit Lücke nur bei Gefahr', () => {
    OPT.canadian = true;
    expect(str(aiChoose(board({ 8: 'T40', 12: 'T20', 0: 'T61' }), 2, hand('7'), 'hard')!)).toBe('0:G0_3');
    expect(
      usesBlue(
        board({ 8: 'T40', 12: 'T20', 0: 'T58' }),
        aiChoose(board({ 8: 'T40', 12: 'T20', 0: 'T58' }), 2, hand('7'), 'hard')!,
      ),
    ).toBe(false);
    const gefahr = board({ 8: 'T40', 12: 'T20', 0: 'T58', 4: 'T55' });
    expect(str(aiChoose(gefahr, 2, hand('7'), 'hard')!)).toBe('0:G0_0');
  });

  test('im Ziel des Partners aufrücken', () => {
    OPT.canadian = true;
    const ms = board({ 8: 'T40', 1: 'T10', 12: 'T55', 0: 'G0' });
    expect(str(aiChoose(ms, 2, hand('7'), 'hard')!)).toContain('0:G0_3');
  });
});

describe('Blockade nur durch das eigene Team', () => {
  test('eine eigene Murmel hinter dem frischen Startstein eines Gegners zählt nicht als Partner-Blockade', () => {
    const ms = board({ 4: 'T16f', 0: 'T13' }); // Rot frisch auf seinem Start, Blau 3 dahinter
    expect(feats(ms, 0).K).toBe(0);
  });

  test('der eigene frische Startstein vor dem Partner schon', () => {
    const ms = board({ 8: 'T32f', 0: 'T29' }); // Grün frisch auf seinem Start, Blau 3 dahinter
    expect(feats(ms, 0).K).toBeLessThan(0);
  });
});

describe('Sieben: dieselbe Murmel mehrmals, Murmeln abwechselnd', () => {
  /** Einen Teilschritt der Sieben ausführen (muss angeboten werden). Gibt Stand und Heimgeschickte zurück. */
  const step = (ms: Board, rem: number, m: number, n: number) => {
    const seg = sevenOptions(ms, 0, rem).find(s => s.m === m && s.n === n);
    expect(seg !== undefined).toBe(true);
    const nx = cloneMs(ms);
    const killed = applySeg(nx, seg!);
    return { ms: nx, killed };
  };

  test('A +1, B +2, A +2, B +2 – abwechselnd mit zwei Murmeln', () => {
    let r = step(board({ 0: 'T0f', 1: 'T2' }), 7, 0, 1);
    r = step(r.ms, 6, 1, 2);
    r = step(r.ms, 4, 0, 2);
    r = step(r.ms, 2, 1, 2);
    expect([r.ms[0].pos, r.ms[1].pos]).toEqual([3, 6]);
    expect(sevenOptions(r.ms, 0, 0)).toHaveLength(0); // alle 7 Schritte sind gefahren
  });

  test('alle vier Murmeln abwechselnd: A, B, C, D, A, B, C je +1', () => {
    let ms = board({ 0: 'T0f', 1: 'T2', 2: 'T5', 3: 'T9' });
    [0, 1, 2, 3, 0, 1, 2].forEach((m, i) => {
      ms = step(ms, 7 - i, m, 1).ms;
    });
    expect([0, 1, 2, 3].map(i => ms[i].pos)).toEqual([2, 4, 7, 10]);
  });

  test('die Reihenfolge entscheidet über das Heimschicken: erst überholen, dann nicht mehr im Weg', () => {
    // A +1, B +1, dann A +5: A überholt B → B geht heim
    let r = step(board({ 0: 'T0f', 1: 'T2' }), 7, 0, 1);
    r = step(r.ms, 6, 1, 1);
    r = step(r.ms, 5, 0, 5);
    expect(r.killed).toEqual([1]);
    // B zuerst aus dem Weg (+3), dann A +4 vorbei: niemand geht heim
    let q = step(board({ 0: 'T0f', 1: 'T2' }), 7, 1, 3);
    q = step(q.ms, 4, 0, 4);
    expect(q.killed).toEqual([]);
    expect([q.ms[0].pos, q.ms[1].pos]).toEqual([4, 5]);
  });

  test('nach 6 Schritten ist nur noch ein Schritt möglich', () => {
    const r = step(board({ 0: 'T10', 1: 'T20' }), 7, 0, 6);
    const opts = sevenOptions(r.ms, 0, 1);
    expect(opts.every(s => s.n === 1)).toBe(true);
    expect(opts.map(s => s.m).sort()).toEqual([0, 1]);
  });

  test('es werden nur Schritte angeboten, nach denen die Sieben noch zu Ende gefahren werden kann', () => {
    // Murmel 1 steckt im Ziel fest (Ziel 3 ist besetzt): nur Murmel 0 kann fahren
    const ms = board({ 0: 'T10', 1: 'G2', 2: 'G3' });
    const first = sevenOptions(ms, 0, 7);
    expect(first.every(s => s.m === 0)).toBe(true);
    for (const seg of first) {
      const nx = cloneMs(ms);
      applySeg(nx, seg);
      if (seg.n < 7) expect(sevenOptions(nx, 0, 7 - seg.n).length > 0).toBe(true);
    }
  });

  test('mit kanadischer Regel auch abwechselnd mit der Murmel des Partners', () => {
    OPT.canadian = true;
    let ms = board({ 0: 'T10', 8: 'T40' });
    ms = step(ms, 7, 0, 2).ms;
    ms = step(ms, 5, 8, 2).ms;
    ms = step(ms, 3, 0, 2).ms;
    ms = step(ms, 1, 8, 1).ms;
    expect([ms[0].pos, ms[8].pos]).toEqual([14, 43]);
  });

  test('für die Oberfläche genügt ein Zug, die KI bekommt alle Endzustände', () => {
    const ms = board({ 0: 'T10', 1: 'T20' });
    expect(legalMoves(ms, 0, hand('7'), false)).toHaveLength(1);
    expect(legalMoves(ms, 0, hand('7'), true).length).toBeGreaterThan(1);
  });
});

describe('Fertiger Partner: Tausch (nur Stufe Stark)', () => {
  // Grün (Platz 2) hat alle Murmeln im Ziel und fährt nur noch mit deinen; deine letzte Murmel (3) steckt im Zwinger.
  const lage = () => board({ 8: 'G0', 9: 'G1', 10: 'G2', 11: 'G3', 0: 'G1', 1: 'G2', 2: 'G3' });
  const gib = (h: Card[], first: boolean, hard = true) => aiGive(lage(), 2, h, null, true, first, hard).r;

  test('du ziehst zuerst: Grün gibt dir seine Startkarte', () => {
    expect(gib(hand('K', '7', '2', 'D'), false)).toBe('K');
  });

  test('von zwei Startkarten bekommst du die billigere', () => {
    expect(gib(hand('A', 'K', '2', 'D'), false)).toBe('K');
  });

  test('Grün zieht zuerst: er behält seine Startkarte', () => {
    for (let i = 0; i < 20; i++) expect(gib(hand('K', '7', '2', 'D'), true)).not.toBe('K');
  });

  test('Grün zieht zuerst und hat zwei Startkarten: die überzählige geht an dich', () => {
    expect(gib(hand('A', 'K', '2', 'D'), true)).toBe('K');
  });

  test('ohne Startkarte und du zuerst: keine 4 als Notlösung, auch mit kanadischer Regel', () => {
    OPT.canadian = true;
    for (let i = 0; i < 20; i++) expect(gib(hand('4', '7', '2', 'D'), false)).toBe('2');
  });

  test('ohne Startkarte und Grün zuerst: seine Hand ist verloren, die Karte mit den meisten Feldern wird gerettet', () => {
    expect(gib(hand('4', '7', '2', 'D'), true)).toBe('D');
  });

  test('auf Stufe Mittel gilt die neue Regel nicht (alte „festgefahren“-Regel: 4 bei kanadischer Regel)', () => {
    OPT.canadian = true;
    expect(gib(hand('4', '7', '2', 'D'), false, false)).toBe('4');
  });

  test('Spiegelfall: du bist fertig, Grüns letzte Murmel steckt im Zwinger', () => {
    const ms = board({ 0: 'G0', 1: 'G1', 2: 'G2', 3: 'G3', 8: 'G1', 9: 'G2', 10: 'G3' });
    expect(aiGive(ms, 2, hand('K', '7', '2', 'D'), null, true, false, true).r).toBe('K'); // du ziehst zuerst und fährst Grüns Murmel
    expect(aiGive(ms, 2, hand('K', '7', '2', 'D'), null, true, true, true).r).not.toBe('K'); // Grün zieht zuerst
  });

  test('ist eine Murmel schon auf der Bahn, greift die Regel nicht', () => {
    const ms = board({ 8: 'G0', 9: 'G1', 10: 'G2', 11: 'G3', 0: 'G1', 1: 'G2', 2: 'G3', 3: 'T30' });
    expect(endgameGive(ms, 2, hand('K', '7', '2', 'D'), false)).toBe(null);
  });

  test('sind beide noch nicht fertig, greift die Regel nicht', () => {
    expect(endgameGive(board({ 0: 'G3', 8: 'G3' }), 2, hand('K', '2'), false)).toBe(null);
  });
});

describe('Deutlicher Vorsprung (nur Stufe Stark)', () => {
  // Deine Lage: Blau (du) alle vier im Ziel, Grün (Partner) drei im Ziel, seine letzte Murmel frisch auf dem Start (Feld 32).
  // Gegner: Rot eine, Gelb zwei im Ziel (zusammen 3), eine Gelbe Murmel steht 10 Felder vor Grüns Start (Feld 42).
  const lage = () =>
    board({
      0: 'G3',
      1: 'G2',
      2: 'G1',
      3: 'G0',
      8: 'G3',
      9: 'G2',
      10: 'G1',
      11: 'T32f',
      4: 'G3',
      12: 'G3',
      13: 'G2',
      14: 'T42',
    });
  const zug = (h: Card[], level: 'easy' | 'medium' | 'hard') => {
    const mv = aiChoose(lage(), 2, h, level)!;
    return `${mv.card.r}${mv.card.r === 'JO' ? '(' + mv.val + ')' : ''}`;
  };

  test('7 gegen 3 im Ziel ist ein deutlicher Vorsprung, 7 gegen 5 und 5 gegen 2 nicht', () => {
    expect(isLead(7, 3)).toBe(true);
    expect(isLead(6, 3)).toBe(true);
    expect(isLead(7, 5)).toBe(false);
    expect(isLead(5, 2)).toBe(false);
  });

  test('deine Lage: der Joker wird zur 4 rückwärts (5 vom Ziel), nicht zur 10, die einen Gegner schlägt', () => {
    expect(zug(hand('JO', '7', '9', 'D', '3'), 'hard')).toBe('JO(4)');
    expect(zug(hand('JO'), 'hard')).toBe('JO(4)');
  });

  test('auch mit einer echten 10 in der Hand: lieber der sichere Weg als der Schlag', () => {
    expect(zug(hand('JO', '10', '2'), 'hard')).toBe('JO(4)');
  });

  test('auf Mittel und Leicht bleibt es beim Schlag (Taktik gilt nur für Stark)', () => {
    expect(zug(hand('JO', '7', '9', 'D', '3'), 'medium')).toBe('JO(10)');
    expect(zug(hand('JO', '7', '9', 'D', '3'), 'easy')).toBe('JO(10)');
  });

  test('ohne Vorsprung wird weiter geschlagen (Gegner 5 im Ziel)', () => {
    const ms = board({
      0: 'G3',
      1: 'G2',
      2: 'G1',
      3: 'G0',
      8: 'G3',
      9: 'G2',
      10: 'G1',
      11: 'T32f',
      4: 'G3',
      5: 'G2',
      12: 'G3',
      13: 'G2',
      14: 'T42',
      15: 'G1',
    });
    const mv = aiChoose(ms, 2, hand('JO', '7', '9', 'D', '3'), 'hard')!;
    expect(mv.card.r + (mv.card.r === 'JO' ? '(' + mv.val + ')' : '')).toBe('JO(10)');
  });

  test('der Regler leadL = 0 schaltet die Taktik aus', () => {
    const alt = TUNE.leadL;
    try {
      TUNE.leadL = 0;
      expect(zug(hand('JO', '7', '9', 'D', '3'), 'hard')).toBe('JO(10)');
    } finally {
      TUNE.leadL = alt;
    }
  });

  test('Kartentausch: im Vorsprung gibt es keine Karte zum Schlagen mehr', () => {
    // Du (Blau) hast eine Murmel auf der Bahn, die einen Gegner mit der 4 rückwärts schlagen könnte; Partner Grün gibt.
    const ms = board({ 0: 'G3', 1: 'G2', 2: 'G1', 3: 'T20', 8: 'G3', 9: 'G2', 10: 'G1', 11: 'G0', 12: 'T16', 4: 'G3' });
    const h = hand('4', '2', '3');
    expect(killGive(ms, 2, h)).not.toBe(null); // ohne Vorsprungs-Regel würde die 4 gegeben
    expect(aiGive(ms, 2, h, null, true, true, true).r).not.toBe('4'); // im Vorsprung nicht mehr (Stark)
  });
});

describe('Falle auf dem Startfeld (nur Stufe Stark)', () => {
  // Deine Lage: Olaf (Platz 2, Partner) hat eine Murmel auf dem Startfeld von Berti (Platz 3, links, Start 48). Berti hat nichts auf
  // der Bahn: eine Murmel im Ziel, drei im Zwinger. Roland (Platz 1) hat eine Murmel auf der Bahn und eine frische auf seinem Start.
  const lage = (redPos = 17, blauAufBahn = false) => {
    const spec: Record<number, string> = { 0: 'G3', 8: 'T48', 12: 'G3', 4: 'T' + redPos, 5: 'T16f' };
    if (blauAufBahn) spec[13] = 'T20';
    return board(spec);
  };
  const tausch = (ms: Board, h: Card[]) =>
    legalMoves(ms, 2, h, true).find(m => m.segs[0].t === 'sw' && m.segs[0].m === 8)!;
  const ctx5 = { n: 5, cnt: [5, 5, 5, 5] };
  const zug = (ms: Board, h: Card[], level: 'easy' | 'medium' | 'hard', ctx: { n: number; cnt: number[] } | null) => {
    const mv = aiChoose(ms, 2, h, level, null, ctx)!;
    return mv.segs[0].t === 'sw' ? 'Tausch' : 'Zug';
  };

  test('bei 5 Karten tauscht Olaf seine bedrohte Murmel mit einer Murmel von Bertis Partner', () => {
    expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', ctx5)).toBe('Tausch');
    const mv = aiChoose(lage(), 2, hand('B', '3', '8', '5', '9'), 'hard', null, ctx5)!;
    expect(mv.segs[0]).toEqual({ t: 'sw', m: 8, o: 4, to: 'T17' }); // mit Rolands Murmel, nicht mit der geschützten frischen
  });

  test('auch bei 6 Karten', () => {
    expect(zug(lage(), hand('B', '3', '8', '5', '9', '2'), 'hard', { n: 6, cnt: [6, 6, 6, 6] })).toBe('Tausch');
  });

  test('ohne die Falle würde er in dieser Stellung nicht tauschen', () => {
    const alt = TUNE.trap;
    try {
      TUNE.trap = 0;
      expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', ctx5)).toBe('Zug');
    } finally {
      TUNE.trap = alt;
    }
  });

  test('nur bei Runden mit 5 oder 6 Karten', () => {
    expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', { n: 4, cnt: [4, 4, 4, 4] })).toBe('Zug');
    expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', null)).toBe('Zug');
  });

  test('nur wenn Berti noch mindestens 4 Karten hält', () => {
    expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', { n: 5, cnt: [5, 5, 5, 3] })).toBe('Zug');
  });

  test('nur wenn Berti nichts auf der Bahn hat (sonst hat er andere Züge)', () => {
    const h = hand('B', '3', '8', '5', '9');
    expect(trapBonus(lage(17, false), 2, tausch(lage(17, false), h), ctx5)).toBeGreaterThan(0);
    expect(trapBonus(lage(17, true), 2, tausch(lage(17, true), h), ctx5)).toBe(0);
  });

  test('nur auf Stufe Stark', () => {
    const alt = TUNE.trap;
    try {
      TUNE.trap = 100; // so gross, dass der Zufall von „Mittel“ nichts ändert
      expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'hard', ctx5)).toBe('Tausch');
      expect(zug(lage(), hand('B', '3', '8', '5', '9'), 'medium', ctx5)).toBe('Zug');
    } finally {
      TUNE.trap = alt;
    }
  });

  test('Wahrscheinlichkeit: mit kanadischer Sieben wirkt die Falle viel seltener (Berti kann mit 7 oder Joker als 7 ausweichen)', () => {
    OPT.canadian = false;
    expect(Math.round(pTrapWorks(5) * 100)).toBe(68);
    OPT.canadian = true;
    expect(Math.round(pTrapWorks(5) * 100)).toBe(30);
  });

  test('Abwehr: mit der kanadischen Sieben fährt Berti die Partnermurmel mit 7 oder Joker als 7 weg und schlägt sie nicht', () => {
    OPT.canadian = true;
    const nach = board({ 0: 'G3', 12: 'G3', 4: 'T48', 5: 'T16f', 8: 'T2' });
    const mitJoker = aiChoose(nach, 3, hand('JO', '3', '4', '9', '10'), 'hard', null, ctx5)!;
    expect(mitJoker.val).toBe('7');
    expect(applyAll(nach, mitJoker.segs).killed).toEqual([]);
    const nurAss = aiChoose(nach, 3, hand('A', '3', '4', '9', '10'), 'hard', null, ctx5)!;
    expect(nurAss.segs[0].t).toBe('out'); // ohne 7 und Joker ist er gezwungen
    expect(applyAll(nach, nurAss.segs).killed).toEqual([4]); // und schlägt seinen Partner
  });
});
