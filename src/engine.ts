/**
 * Ändi Dog – Spiel-Engine
 * =========================
 * Reine Spiellogik ohne DOM: Regeln, Zuggenerierung und Computergegner.
 * Diese Datei kann man auch in Node.js laufen lassen (z. B. für Tests
 * oder um KI-Varianten gegeneinander antreten zu lassen).
 *
 * Grundbegriffe
 * -------------
 * - Spieler/Farben 0–3: 0 = Blau (du), 1 = Rot, 2 = Grün (Partner), 3 = Gelb.
 *   Teams: 0+2 und 1+3 (teamOf = Farbe % 2).
 * - Die Bahn hat 64 Felder (0–63). Der Start von Farbe c liegt auf Feld 16·c.
 *   „Vorwärts“ heisst: Feldnummer + 1 (Gegenuhrzeigersinn auf dem Brett).
 * - Eine Murmel ist im Zwinger ('K'), auf der Bahn ('T', track) oder im Ziel ('G', goal).
 *   Im Ziel ist pos 0 das Feld direkt nach dem Start, pos 3 das innerste.
 * - fresh = true heisst: Die Murmel kam gerade aus dem Zwinger auf ihren Start.
 *   Sie blockiert dann alle anderen und ist geschützt.
 *
 * Züge
 * ----
 * Ein Zug (Move) besteht aus einer Karte, dem gespielten Wert (beim Joker frei
 * gewählt) und einer Liste von Teilschritten (Seg). Normale Karten haben genau
 * einen Teilschritt, die Sieben kann mehrere haben (z. B. 2 + 5).
 */

// ---------------------------------------------------------------- Typen

export type Value = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'B' | 'D' | 'K';
export type Rank = Value | 'JO';
export type Suit = '♠' | '♥' | '♦' | '♣' | '★';
export interface Card { id: number; r: Rank; s: Suit }

export type Loc = 'K' | 'T' | 'G';
export interface Marble {
  id: number;      // 0–15, Farbe = id >> 2
  color: number;   // 0–3
  loc: Loc;
  pos: number;     // Bahnfeld 0–63 bzw. Zielfeld 0–3
  fresh: boolean;  // frisch auf dem eigenen Start → blockiert
}
export type Board = Marble[];

export interface End { loc: 'T' | 'G'; pos: number }
/** Murmel aus dem Zwinger auf den Start (Ass, König, Joker). */
export interface OutSeg { t: 'out'; m: number; to: string }
/** Bube: Murmel m tauscht den Platz mit Murmel o. */
export interface SwapSeg { t: 'sw'; m: number; o: number; to: string }
/** Fahren: n Felder (negativ = rückwärts). tp = alle betretenen Bahnfelder. */
export interface MoveSeg { t: 'mv'; m: number; n: number; tp: number[]; end: End; seven: boolean; to: string }
export type Seg = OutSeg | SwapSeg | MoveSeg;

export interface Move { card: Card; val: Value; segs: Seg[] }
export type Level = 'easy' | 'medium' | 'hard';

export interface Options {
  /** Kanadische 7er-Regel: Mit jeder 7 auch die Murmeln des Partners fahren. */
  canadian: boolean;
  /** Die achte Murmel darf nicht mit dem Joker ins Ziel. */
  jokerNo8: boolean;
}

// ---------------------------------------------------------------- Konstanten

export const ALLV: Value[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];
/** Schrittweiten der einfachen Vorwärtskarten (Ass hat zwei Möglichkeiten). */
const NUMS: Partial<Record<Value, number[]>> = {
  A: [1, 11], '2': [2], '3': [3], '4': [4], '5': [5], '6': [6], '8': [8], '9': [9], '10': [10], D: [12], K: [13],
};
/** Kartenzahl pro Runde, danach beginnt es wieder von vorn. */
export const SIZES = [6, 5, 4, 3, 2];
/** Aktive Spielvarianten (wird von der Oberfläche gesetzt). */
export const OPT: Options = { canadian: false, jokerNo8: false };

// ---------------------------------------------------------------- Hilfsfunktionen

export const startOf = (c: number) => 16 * c;
export const teamOf = (c: number) => c % 2;
export const cloneMs = (ms: Board): Board => ms.map(m => ({ ...m }));

export function initMarbles(): Board {
  const a: Board = [];
  for (let i = 0; i < 16; i++) a.push({ id: i, color: i >> 2, loc: 'K', pos: 0, fresh: false });
  return a;
}
export function allHome(ms: Board, c: number): boolean {
  for (let i = 0; i < 4; i++) if (ms[c * 4 + i].loc !== 'G') return false;
  return true;
}
export const teamWon = (ms: Board, t: number) => allHome(ms, t) && allHome(ms, t + 2);
/** Mit welcher Farbe spielt Spieler p? Eigene, oder die des Partners, wenn alle eigenen im Ziel sind. */
export const ctrlColor = (ms: Board, p: number) => (allHome(ms, p) ? (p + 2) % 4 : p);
export function kennelCount(ms: Board, c: number): number {
  let n = 0;
  for (let i = 0; i < 4; i++) if (ms[c * 4 + i].loc === 'K') n++;
  return n;
}
/** Bahnfelder mit blockierenden (frischen) Murmeln, optional ohne eine bestimmte Murmel. */
export function freshSet(ms: Board, ex: Marble | null): Set<number> {
  const s = new Set<number>();
  for (const m of ms) if (m.loc === 'T' && m.fresh && m !== ex) s.add(m.pos);
  return s;
}
/** Belegung der vier Zielfelder einer Farbe. */
export function goalOcc(ms: Board, c: number): boolean[] {
  const g = [false, false, false, false];
  for (let i = 0; i < 4; i++) { const m = ms[c * 4 + i]; if (m.loc === 'G') g[m.pos] = true; }
  return g;
}
export function stateKey(ms: Board): string {
  return ms.map(m => m.loc + m.pos + (m.fresh ? 'f' : '')).join(',');
}

// ---------------------------------------------------------------- Wege berechnen

interface Path { tp: number[]; end: End }

/**
 * Alle Wege, auf denen Murmel m genau n Felder vorwärts fahren kann:
 * - auf der Bahn weiter (wenn keine Blockade im Weg ist)
 * - oder ins Ziel, wenn sie dabei über ihren eigenen Start kommt.
 * Ins Ziel darf nur, wer den Start „zum zweiten Mal berührt“: eine frische
 * Murmel, die gerade erst rausgekommen ist, darf also nicht direkt hinein.
 */
export function fwdPaths(ms: Board, m: Marble, n: number): Path[] {
  const res: Path[] = [];
  if (m.loc === 'G') {
    // Im Ziel weiterfahren: kein Überspringen
    const g = goalOcc(ms, m.color), t = m.pos + n;
    if (t > 3) return res;
    for (let i = m.pos + 1; i <= t; i++) if (g[i]) return res;
    res.push({ tp: [], end: { loc: 'G', pos: t } });
    return res;
  }
  if (m.loc !== 'T') return res;
  const fb = freshSet(ms, m);

  // a) Auf der Bahn bleiben
  const tp: number[] = [];
  let ok = true;
  for (let i = 1; i <= n; i++) {
    const q = (m.pos + i) % 64;
    if (fb.has(q)) { ok = false; break; }
    tp.push(q);
  }
  if (ok) res.push({ tp, end: { loc: 'T', pos: (m.pos + n) % 64 } });

  // b) Über den eigenen Start ins Ziel
  if (!m.fresh) {
    const d = (startOf(m.color) - m.pos + 64) % 64; // Schritte bis zum eigenen Start
    if (d < n && n - d <= 4) {
      const r = n - d, tp2: number[] = [];
      let ok2 = true;
      for (let i = 1; i <= d; i++) {
        const q = (m.pos + i) % 64;
        if (fb.has(q)) { ok2 = false; break; }
        tp2.push(q);
      }
      if (ok2) { const g = goalOcc(ms, m.color); for (let i = 0; i < r; i++) if (g[i]) { ok2 = false; break; } }
      if (ok2) res.push({ tp: tp2, end: { loc: 'G', pos: r - 1 } });
    }
  }
  return res;
}

/** Vier Felder rückwärts (nur auf der Bahn, nie ins Ziel). */
function backPath(ms: Board, m: Marble): Path | null {
  if (m.loc !== 'T') return null;
  const fb = freshSet(ms, m), tp: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const q = (m.pos - i + 64) % 64;
    if (fb.has(q)) return null;
    tp.push(q);
  }
  return { tp, end: { loc: 'T', pos: (m.pos - 4 + 64) % 64 } };
}

function mvSeg(m: Marble, path: Path, n: number, seven: boolean): MoveSeg {
  return {
    t: 'mv', m: m.id, n, tp: path.tp, end: path.end, seven,
    to: path.end.loc === 'T' ? 'T' + path.end.pos : 'G' + m.color + '_' + path.end.pos,
  };
}

// ---------------------------------------------------------------- Züge ausführen

/**
 * Führt einen Teilschritt aus (verändert ms!) und gibt die IDs der
 * heimgeschickten Murmeln zurück.
 * - Landen: die Murmel, die schon dort war, muss in den Zwinger.
 * - Sieben: jede überholte Murmel muss in den Zwinger (auch eigene).
 */
export function applySeg(ms: Board, seg: Seg): number[] {
  const killed: number[] = [];
  const m = ms[seg.m];
  if (seg.t === 'out') {
    const s = startOf(m.color);
    const o = ms.find(x => x.loc === 'T' && x.pos === s);
    if (o) { o.loc = 'K'; o.pos = 0; o.fresh = false; killed.push(o.id); }
    m.loc = 'T'; m.pos = s; m.fresh = true;
  } else if (seg.t === 'sw') {
    const o = ms[seg.o];
    const l = m.loc, p = m.pos;
    m.loc = o.loc; m.pos = o.pos; o.loc = l; o.pos = p;
    m.fresh = false; o.fresh = false;
  } else {
    const kp = seg.seven ? seg.tp : seg.end.loc === 'T' ? [seg.end.pos] : [];
    for (const q of kp) {
      const o = ms.find(x => x !== m && x.loc === 'T' && x.pos === q);
      if (o) { o.loc = 'K'; o.pos = 0; o.fresh = false; killed.push(o.id); }
    }
    m.loc = seg.end.loc; m.pos = seg.end.pos; m.fresh = false;
  }
  return killed;
}

/** Wendet alle Teilschritte auf eine Kopie an. */
export function applyAll(ms: Board, segs: Seg[]): { ms: Board; killed: number[] } {
  const nx = cloneMs(ms);
  let killed: number[] = [];
  for (const s of segs) killed = killed.concat(applySeg(nx, s));
  return { ms: nx, killed };
}

// ---------------------------------------------------------------- Zuggenerierung

/**
 * Alle Aufteilungen der Sieben. Rekursiv: eine Murmel wählen, 1..rest Schritte
 * fahren, mit dem Rest weitermachen. Die Reihenfolge zählt (wer zuerst fährt,
 * kann andere überholen). Mit dedupe=true werden Züge mit gleichem Endzustand
 * nur einmal geliefert (für die KI); die Oberfläche braucht alle Reihenfolgen.
 */
function gen7(ms: Board, p: number, dedupe: boolean): { segs: Seg[] }[] {
  const out: { segs: Seg[] }[] = [], seen = new Set<string>(), used = new Set<number>(), segs: Seg[] = [];
  const rec = (cur: Board, rem: number) => {
    if (rem === 0) {
      if (dedupe) { const k = stateKey(cur); if (seen.has(k)) return; seen.add(k); }
      out.push({ segs: segs.slice() });
      return;
    }
    // Normal: eigene Farbe (bzw. Partner, sobald die eigenen alle im Ziel sind –
    // so kann der Rest einer 7 schon für den Partner verwendet werden).
    const cols = OPT.canadian && !allHome(cur, p) ? [p, (p + 2) % 4] : [ctrlColor(cur, p)];
    for (const c of cols) for (let i = 0; i < 4; i++) {
      const m = cur[c * 4 + i];
      if (used.has(m.id) || m.loc === 'K') continue;
      for (let s = 1; s <= rem; s++) for (const path of fwdPaths(cur, m, s)) {
        const seg = mvSeg(m, path, s, true);
        const nx = cloneMs(cur);
        applySeg(nx, seg);
        used.add(m.id); segs.push(seg);
        rec(nx, rem - s);
        segs.pop(); used.delete(m.id);
      }
    }
  };
  rec(ms, 7);
  return out;
}

/** Alle Züge von Spieler p mit einem bestimmten Kartenwert. */
export function movesForVal(ms: Board, p: number, val: Value, dedupe: boolean): { segs: Seg[] }[] {
  if (val === '7') return gen7(ms, p, dedupe);
  const c = ctrlColor(ms, p), out: { segs: Seg[] }[] = [];
  const own = [0, 1, 2, 3].map(i => ms[c * 4 + i]);

  // Ass / König: auf den Start (nicht, wenn dort schon eine eigene frische Murmel steht)
  if (val === 'A' || val === 'K') {
    const k = own.find(m => m.loc === 'K');
    if (k) {
      const s = startOf(c);
      const o = ms.find(x => x.loc === 'T' && x.pos === s);
      if (!(o && o.fresh)) out.push({ segs: [{ t: 'out', m: k.id, to: 'T' + s }] });
    }
  }
  // Bube: eigene Murmel auf der Bahn mit fremder tauschen; frische sind geschützt
  if (val === 'B') {
    for (const m of own) {
      if (m.loc !== 'T' || m.fresh) continue;
      for (const o of ms) {
        if (o.color === c || o.loc !== 'T' || o.fresh) continue;
        out.push({ segs: [{ t: 'sw', m: m.id, o: o.id, to: 'T' + o.pos }] });
      }
    }
  }
  const ns = NUMS[val];
  if (ns) for (const n of ns) for (const m of own) for (const path of fwdPaths(ms, m, n)) out.push({ segs: [mvSeg(m, path, n, false)] });
  if (val === '4') for (const m of own) { const bp = backPath(ms, m); if (bp) out.push({ segs: [mvSeg(m, bp, -4, false)] }); }
  return out;
}

/** Alle legalen Züge für eine ganze Hand. */
export function legalMoves(ms: Board, p: number, hand: Card[], dedupe: boolean): Move[] {
  const res: Move[] = [], doneRank = new Set<Rank>();
  for (const card of hand) {
    if (dedupe) { if (doneRank.has(card.r)) continue; doneRank.add(card.r); }
    const vals: Value[] = card.r === 'JO' ? ALLV : [card.r];
    for (const v of vals) for (const mv of movesForVal(ms, p, v, dedupe)) res.push({ card, val: v, segs: mv.segs });
  }
  let out = res;
  // Variante: Achte Murmel nicht mit dem Joker ins Ziel
  if (OPT.jokerNo8) {
    const t = teamOf(p);
    let g = 0;
    for (const m of ms) if (teamOf(m.color) === t && m.loc === 'G') g++;
    if (g >= 6) out = res.filter(mv => mv.card.r !== 'JO' || !teamWon(applyAll(ms, mv.segs).ms, t));
  }
  return out;
}

// ---------------------------------------------------------------- Computergegner

/**
 * Wert einer einzelnen Murmel aus Sicht ihrer Farbe.
 * Zwinger 0, Bahn 22 + Fortschritt, Ziel deutlich mehr (gesichert!).
 */
export function mval(m: Marble): number {
  if (m.loc === 'K') return 0;
  if (m.loc === 'G') return 112 + m.pos * 4;
  const pr = (m.pos - startOf(m.color) + 64) % 64;
  return 22 + pr * 1.1 + (m.fresh ? 3 : 0);
}

/**
 * Grobe Wahrscheinlichkeit, dass Murmel t vom Team attTeam geschlagen wird:
 * Gegner 1–13 Felder dahinter (bis 7 wegen der Sieben besonders gefährlich),
 * Gegner 4 Felder davor (rückwärts mit der 4), Stehen auf einem fremden Start,
 * plus ein kleines Grundrisiko (Bube, Joker, Unbekanntes).
 */
export function threat(ms: Board, t: Marble, attTeam: number, fb: Set<number>): number {
  let q = 1;
  for (const a of ms) {
    if (a.loc !== 'T' || teamOf(a.color) !== attTeam) continue;
    const d = (t.pos - a.pos + 64) % 64;
    if (d >= 1 && d <= 13) {
      let cl = true;
      for (let i = 1; i < d; i++) if (fb.has((a.pos + i) % 64)) { cl = false; break; }
      if (cl) q *= 1 - (d <= 7 ? 0.38 : 0.26);
    }
    const db = (a.pos - t.pos + 64) % 64;
    if (db === 4) {
      let cl = true;
      for (let i = 1; i < 4; i++) if (fb.has((a.pos - i + 64) % 64)) { cl = false; break; }
      if (cl) q *= 0.8;
    }
  }
  for (const oc of [attTeam, attTeam + 2]) if (t.pos === startOf(oc) && kennelCount(ms, oc) > 0) q *= 0.45;
  return 1 - q * 0.92;
}

// ---------------------------------------------------------------- Bewertung als Merkmale

/**
 * Merkmale einer Stellung aus Sicht von Spieler p (bzw. seinem Team):
 * - M: Material/Fortschritt (Summe der Murmelwerte, eigene minus fremde, Sieg ±10000)
 * - R: eigene Gefährdung (Wert × Treffer-Wahrscheinlichkeit, Summe über eigene Murmeln)
 * - A: Angriffschancen (dasselbe für gegnerische Murmeln)
 * - G: eigene Murmeln im Ziel, O: eigene Murmeln draussen, H: Gegner im Zwinger
 * - K: Blockaden (fest gewichtet): Partner im Nahbereich aufhalten kostet, Gegner aufhalten lohnt sich.
 * Die Gewichte W bestimmen den Spielstil; Grün kann sie von dir lernen (siehe app.ts).
 */
export interface Feats { M: number; R: number; A: number; G: number; O: number; H: number; K: number }
export interface Weights { R: number; A: number; G: number; O: number; H: number; C: number }
export const W0: Weights = { R: -0.55, A: 0.15, G: 0, O: 0, H: 0, C: -1 };

export function feats(ms: Board, p: number): Feats {
  const tm = teamOf(p), f: Feats = { M: 0, R: 0, A: 0, G: 0, O: 0, H: 0, K: 0 }, fb = freshSet(ms, null);
  for (const m of ms) {
    const v = mval(m), mine = teamOf(m.color) === tm;
    f.M += mine ? v : -v;
    if (mine) { if (m.loc === 'G') f.G++; if (m.loc !== 'K') f.O++; } else if (m.loc === 'K') f.H++;
    if (m.loc === 'T' && !m.fresh) {
      const th = threat(ms, m, mine ? 1 - tm : tm, fb);
      if (mine) f.R += v * th; else f.A += v * th;
    }
  }
  // Blockaden: Eine frische Murmel auf dem Start hält alle auf, die bis zu 13 Felder dahinter stehen
  // und vorbei müssen. Den Partner im Nahbereich (≤ 6) aufzuhalten kostet, Gegner aufzuhalten lohnt sich.
  // (Simulation: eine breitere Fassung – auch eigene Murmeln, bis 13 Felder – kostete Siege.)
  for (const b of ms) {
    if (b.loc !== 'T' || !b.fresh) continue;
    for (const x of ms) {
      if (x === b || x.loc !== 'T') continue;
      const d = (b.pos - x.pos + 64) % 64;
      if (d < 1 || d > 13) continue;
      if (!x.fresh && (startOf(x.color) - x.pos + 64) % 64 < d) continue; // biegt vorher in sein Ziel ab
      if (teamOf(x.color) === tm) { if (d <= 6 && x.color !== b.color) f.K -= 45 - 1.5 * d; }
      else f.K += 12 - 0.6 * d;
    }
  }
  if (teamWon(ms, tm)) f.M += 10000;
  if (teamWon(ms, 1 - tm)) f.M -= 10000;
  return f;
}
export const scoreF = (f: Feats, W: Weights) => f.M + W.R * f.R + W.A * f.A + W.G * f.G + W.O * f.O + W.H * f.H + f.K;
/** Stellungsbewertung aus Sicht von Spieler p. Höher = besser. */
export function evaluate(ms: Board, p: number, W: Weights = W0): number { return scoreF(feats(ms, p), W); }

/**
 * Murmeln des Partners nur dann ins Ziel fahren, wenn sie in Gefahr sind oder damit ins tiefste
 * noch freie Ziel-Loch kommen. Sonst Strafpunkte: erlaubt, aber nur, wenn es nichts Besseres gibt.
 */
const PARTNER_GOAL_PEN = 70;
export function partnerGoalPen(ms: Board, p: number, segs: Seg[]): number {
  let cur: Board | null = null, pen = 0;
  for (const seg of segs) {
    const src = cur || ms, m = src[seg.m];
    if (seg.t === 'mv' && seg.end.loc === 'G' && m.loc === 'T' && m.color !== p) {
      const g = goalOcc(src, m.color);
      let deep = 3;
      for (let i = 0; i < 4; i++) if (g[i]) { deep = i - 1; break; }
      if (seg.end.pos < deep && threat(src, m, 1 - teamOf(p), freshSet(src, m)) < 0.3) pen += PARTNER_GOAL_PEN;
    }
    if (segs.length > 1) { if (!cur) cur = cloneMs(ms); applySeg(cur, seg); }
  }
  return pen;
}

/**
 * Feste Regel (von dir) für Grün und für Gegner auf „Stark“: Nie mit der 4 vom eigenen Start zurück,
 * wenn das den Partner heimschickt. Nur bei Zugzwang bleibt der Zug möglich (hohe Strafe statt Verbot).
 */
export function partnerBackPen(ms: Board, p: number, segs: Seg[], lvl: Level): number {
  if (p !== 2 && lvl !== 'hard') return 0;
  for (const seg of segs) {
    if (seg.t !== 'mv' || seg.n !== -4) continue;
    const m = ms[seg.m];
    if (m.loc !== 'T' || m.pos !== startOf(m.color)) continue;
    const o = ms.find(x => x !== m && x.loc === 'T' && x.pos === seg.end.pos);
    if (o && teamOf(o.color) === teamOf(p) && o.color !== m.color) return 1000;
  }
  return 0;
}

/** „Kosten“, eine wertvolle Karte jetzt zu verbrauchen statt sie aufzuheben. */
export function keepCost(card: Card, val: Value, ms: Board, p: number): number {
  if (card.r === 'JO') return 16;
  const kc = kennelCount(ms, ctrlColor(ms, p));
  switch (val) {
    case '7': return 5;
    case 'A': case 'K': return kc > 0 ? 7 : 1;
    case '4': return 3;
    case 'B': return 1;
    default: return 0;
  }
}

/**
 * Wählt den Zug des Computers.
 * - Leicht: Bewertung + viel Zufall
 * - Mittel: Bewertung + wenig Zufall
 * - Stark: Bewertung + Blick auf die nächste eigene Karte (2-Zug-Planung)
 * W: Gewichte (Standard W0; für Grün ggf. die von dir gelernten).
 */
export function aiChoose(ms: Board, p: number, hand: Card[], level: Level, W: Weights | null = null): Move | null {
  const w = W || W0;
  const moves = legalMoves(ms, p, hand, true);
  if (!moves.length) return null;
  const sc = moves.map(mv => {
    const r = applyAll(ms, mv.segs);
    const e = evaluate(r.ms, p, w);
    return { mv, ms: r.ms, e, s: e + w.C * keepCost(mv.card, mv.val, ms, p) - partnerGoalPen(ms, p, mv.segs) - partnerBackPen(ms, p, mv.segs, level) };
  });
  if (level === 'easy') for (const x of sc) x.s += Math.random() * 45;
  else if (level === 'medium') for (const x of sc) x.s += Math.random() * 5;
  else if (hand.length > 1) {
    sc.sort((a, b) => b.s - a.s);
    for (const x of sc.slice(0, 10)) {
      const rest = hand.filter(c => c.id !== x.mv.card.id);
      const m2 = legalMoves(x.ms, p, rest, true);
      let best: number;
      if (!m2.length) best = x.e - 12;
      else {
        best = -1e9;
        for (const y of m2) {
          const v = evaluate(applyAll(x.ms, y.segs).ms, p, w) + w.C * keepCost(y.card, y.val, x.ms, p)
            - partnerGoalPen(x.ms, p, y.segs) - partnerBackPen(x.ms, p, y.segs, level);
          if (v > best) best = v;
        }
      }
      x.s += 0.3 * (best - x.e);
    }
    for (const x of sc.slice(10)) x.s -= 1000;
  }
  let bestX = sc[0];
  for (const x of sc) if (x.s > bestX.s) bestX = x;
  return bestX.mv;
}

// ---------------------------------------------------------------- Kartentausch

/**
 * Tauschwerte: B = wie gern man eine Karte behält (niedrig = eher abgeben).
 * S1: Zuschlag für Ass/König, wenn der Partner keine Murmel draussen hat (negativ = eher abgeben),
 * S2: … ausser man braucht die Startkarte selbst dringend.
 */
export interface GiveParams { B: Record<Rank, number>; S1: number; S2: number }
export const GIVE0: GiveParams = { B: { JO: 100, '7': 30, A: 20, K: 18, '4': 14, B: 9, D: 7, '10': 6, '9': 5, '8': 5, '6': 4, '5': 4, '3': 3, '2': 3 }, S1: -18, S2: 40 };
export interface GiveCtx { partnerOut: boolean; myOut: boolean; pk: number; mk: number; starts: number }
export function giveCtx(ms: Board, p: number, hand: Card[]): GiveCtx {
  const pc = ctrlColor(ms, (p + 2) % 4), mc = ctrlColor(ms, p);
  return {
    partnerOut: [0, 1, 2, 3].some(i => ms[pc * 4 + i].loc === 'T'), myOut: [0, 1, 2, 3].some(i => ms[mc * 4 + i].loc === 'T'),
    pk: kennelCount(ms, pc), mk: kennelCount(ms, mc), starts: hand.filter(c => c.r === 'A' || c.r === 'K' || c.r === 'JO').length,
  };
}
export function giveFeat(c: Card, x: GiveCtx) {
  const f1 = (c.r === 'A' || c.r === 'K') && !x.partnerOut && x.pk > 0 ? 1 : 0;
  return { r: c.r, f1, f2: f1 && !x.myOut && x.mk > 0 && x.starts <= 1 ? 1 : 0 };
}
export function giveVal(c: Card, x: GiveCtx, G: GiveParams): number {
  const f = giveFeat(c, x);
  return G.B[c.r] + G.S1 * f.f1 + G.S2 * f.f2;
}

/**
 * Feste Tauschregeln (von dir). Liefert die Karte nach Regel 1, 2 oder 3, sonst null.
 * 1) Kann ich mich so oder so nicht bewegen, bekommt der Partner meine beste Karte: die 7 (ohne kanadische
 *    Regel) bzw. die 4. Mit kanadischer Regel behalte ich die 7, weil ich damit seine Murmeln fahren kann.
 * 2) Ich bin unterwegs, der Partner kommt nicht voran (alles im Zwinger oder blockiert): Er bekommt K, A
 *    oder Joker, bzw. eine 4, wenn er blockiert ist. Je mehr Karten diese Runde, desto eher auch teure Karten.
 * 3) Kann der Partner damit einen Gegner heimschicken, bekommt er die passende Karte (killGive).
 */
export function ruleGive(ms: Board, p: number, hand: Card[]): Card | null {
  const partner = (p + 2) % 4, mc = ctrlColor(ms, p), pc = ctrlColor(ms, partner);
  const has = (r: Rank) => hand.find(c => c.r === r);
  const mine = hand.filter(c => !(OPT.canadian && c.r === '7'));
  if (!legalMoves(ms, p, mine, true).length) {
    for (const r of (OPT.canadian ? [] : ['7' as Rank]).concat(['4', 'JO', 'A', 'K', 'D', 'B', '10', '9', '8', '6', '5', '3', '2'] as Rank[])) {
      const c = has(r);
      if (c) return c;
    }
  }
  const meMoving = [0, 1, 2, 3].some(i => ms[mc * 4 + i].loc === 'T');
  if (meMoving && !allHome(ms, pc)) {
    const pm = [0, 1, 2, 3].map(i => ms[pc * 4 + i]), onT = pm.filter(m => m.loc === 'T'), inK = pm.some(m => m.loc === 'K');
    const blocked = (m: Marble) => ms.some(b => {
      if (b === m || b.loc !== 'T' || !b.fresh) return false;
      const d = (b.pos - m.pos + 64) % 64;
      return d >= 1 && d <= 5 && (m.fresh || (startOf(m.color) - m.pos + 64) % 64 >= d);
    });
    if ((onT.length || inK) && onT.every(blocked)) {
      const T = 20 * hand.length, want: Rank[] = [...(inK ? ['K', 'A', 'JO'] as Rank[] : []), ...(onT.length ? ['4' as Rank] : [])];
      for (const r of want) { const c = has(r); if (c && GIVE0.B[r] <= T) return c; }
    }
  }
  return killGive(ms, p, hand);
}

/**
 * Regel 3: Dem Partner eine Karte geben, mit der er einen Gegner heimschickt. Bevorzugt werden
 * wertvolle Ziele (kurz vor dem Ziel) und Gegner, die direkt nach dem Partner dran sind – deren Murmel
 * steht sicher noch da. Beispiel: Partner frisch auf dem Start, nächster Gegner 4 vor seinem Ziel
 * = 12 Felder weiter → Dame. Den Joker nur, wenn die Gegner nicht hinten liegen und das Ziel nah ist.
 */
export function killGive(ms: Board, p: number, hand: Card[]): Card | null {
  const tm = teamOf(p), pc = ctrlColor(ms, (p + 2) % 4), mc = ctrlColor(ms, p);
  const fb = new Set(ms.filter(m => m.loc === 'T' && m.fresh).map(m => m.pos));
  const goals = (t: number) => ms.filter(m => teamOf(m.color) === t && m.loc === 'G').length;
  const oppAhead = goals(1 - tm) >= goals(tm);
  const needStart = ![0, 1, 2, 3].some(i => ms[mc * 4 + i].loc === 'T') && kennelCount(ms, mc) > 0;
  const starts = hand.filter(c => c.r === 'A' || c.r === 'K' || c.r === 'JO').length;
  const clear = (from: number, d: number, dir: number) => { for (let k = 1; k <= d; k++) if (fb.has((from + dir * k + 64) % 64)) return false; return true; };
  const NAME: Record<number, Rank> = { 1: 'A', 11: 'A', 12: 'D', 13: 'K' };
  let best: Card | null = null, bv = 0;
  for (let i = 0; i < 4; i++) {
    const a = ms[pc * 4 + i];
    if (a.loc !== 'T') continue;
    for (const t of ms) {
      if (t.loc !== 'T' || t.fresh || teamOf(t.color) === tm) continue;
      const prog = (t.pos - startOf(t.color) + 64) % 64, fwd = (t.pos - a.pos + 64) % 64, back = (a.pos - t.pos + 64) % 64;
      const ranks: Rank[] = [];
      if (fwd >= 1 && fwd <= 13 && clear(a.pos, fwd, 1)) { ranks.push(NAME[fwd] ?? (String(fwd) as Rank)); if (fwd < 7) ranks.push('7'); }
      if (back === 4 && clear(a.pos, 4, -1)) ranks.push('4');
      if (ranks.length && prog >= 52 && oppAhead) ranks.push('JO');
      let val = 22 + prog;
      if (t.color === (pc + 1) % 4) val += 20; else val *= 0.6; // nächster Spieler nach dem Partner: Treffer so gut wie sicher
      for (const r of ranks) {
        const c = hand.find(x => x.r === r);
        if (!c) continue;
        if ((r === 'A' || r === 'K') && needStart && starts <= 1) continue; // eigene einzige Startkarte behalten
        const v = val - GIVE0.B[r] * 0.3;
        if (v > bv) { bv = v; best = c; }
      }
    }
  }
  return best;
}

/** Welche Karte gibt der Computer seinem Partner? useRules: deine festen Tauschregeln anwenden. */
export function aiGive(ms: Board, p: number, hand: Card[], G: GiveParams | null = null, useRules = false): Card {
  if (useRules) { const c = ruleGive(ms, p, hand); if (c) return c; }
  const g = G || GIVE0, x = giveCtx(ms, p, hand);
  let best = hand[0], bv = 1e9;
  for (const c of hand) { const v = giveVal(c, x, g) + Math.random(); if (v < bv) { bv = v; best = c; } }
  return best;
}

/** Zwei Sets à 55 Karten (52 + 3 Joker), gemischt. */
export function makeDeck(): Card[] {
  const d: Card[] = [];
  let id = 0;
  const suits: Suit[] = ['♠', '♥', '♦', '♣'];
  for (let k = 0; k < 2; k++) {
    for (const s of suits) for (const r of ALLV) d.push({ id: id++, r, s });
    for (let j = 0; j < 3; j++) d.push({ id: id++, r: 'JO', s: '★' });
  }
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
