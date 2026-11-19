/**
 * Erzeugt das App-Icon für Android aus einer einzigen Beschreibung (Geometrie und Farben unten).
 *
 *   npm run icon:build            → schreibt alles nach android-icon/ und store/
 *   npm run icon:install          → kopiert android-icon/res nach android/app/src/main/res
 *
 * Ausgabe:
 *   android-icon/res/drawable/ic_aendi_{background,foreground,monochrome}.xml   Vektorebenen (adaptives Icon, API 26+)
 *   android-icon/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml                 fügt die Ebenen zusammen,
 *                                                                              inkl. Themen-Icon (Android 13+)
 *   android-icon/res/mipmap-*dpi/ic_launcher{,_round}.png                       Fallback für Android 6 bis 7
 *   store/play-store-icon-512.png                                               Play-Store-Eintrag (512 × 512)
 *   store/icon-vorschau.png                                                     Vorschau mit verschiedenen Masken
 *   assets/icon.svg                                                             Master als SVG
 *
 * Das Icon: ein achteckiges Brett aus Holz mit den vier Murmeln der Spieler
 * (Grün oben, Rot rechts, Blau unten = du, Gelb links) auf dunkelgrünem Grund.
 * Adaptive Icons zeigen immer nur den mittleren Kreis von 66 der 108 Einheiten sicher an,
 * das Achteck passt genau hinein.
 *
 * Braucht `sharp` (devDependency) nur für die PNG-Dateien.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const write = (p, data) => {
  const f = join(root, p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, data);
};
const f = n => +n.toFixed(2);

// ------------------------------------------------------------------ Gestaltung (alles in 108er-Einheiten)

const C = 54; // Mitte
const R = 32.6; // Umkreis des Achtecks (66er-Sicherheitszone: Radius 33)
const D = 19,
  MR = 8.6; // Abstand und Radius der Murmeln
const BG = ['#3C6B5B', '#162C26']; // Hintergrund: Mitte → Rand
const WOOD = ['#F2D8A2', '#D1A064'],
  RIM = '#8C5E30';
const MARBLES = [
  { c: [C, C - D], cols: ['#7FE0AD', '#1E9A5A', '#0D5531'] }, // Grün (Partner) oben
  { c: [C + D, C], cols: ['#FF8C84', '#D23B33', '#7E1A15'] }, // Rot rechts
  { c: [C, C + D], cols: ['#7FA6FF', '#2B5FD9', '#173A8F'] }, // Blau (du) unten
  { c: [C - D, C], cols: ['#FFE17A', '#E2A908', '#8A6200'] }, // Gelb links
];
// Glanzpunkt links oben: Verlauf mit versetztem Mittelpunkt (gleich in SVG und Android-XML)
const gradOf = ({ c: [x, y], cols }) => ({
  cx: f(x - 0.3 * MR),
  cy: f(y - 0.4 * MR),
  r: f(1.55 * MR),
  stops: [
    [0, '#FFFFFF', 0.92],
    [0.16, cols[0], 1],
    [0.52, cols[1], 1],
    [1, cols[2], 1],
  ],
});

const oct = Array.from({ length: 8 }, (_, k) => {
  const a = ((22.5 + 45 * k) * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
});
const octPath = 'M' + oct.map(p => p.map(f).join(',')).join('L') + 'Z';
const circlePath = (x, y, r) => `M${f(x - r)},${f(y)}a${r},${r} 0 1,1 ${f(2 * r)},0a${r},${r} 0 1,1 ${f(-2 * r)},0Z`;

// ------------------------------------------------------------------ Android-Vektoren

const hex8 = (hex, a = 1) =>
  '#' +
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase() +
  hex.slice(1).toUpperCase();
const gradXml = (type, attrs, stops, indent = '    ') =>
  `${indent}<aapt:attr name="android:fillColor">\n${indent}  <gradient android:type="${type}" ${attrs}>\n` +
  stops.map(([o, c, a]) => `${indent}    <item android:offset="${o}" android:color="${hex8(c, a ?? 1)}"/>`).join('\n') +
  `\n${indent}  </gradient>\n${indent}</aapt:attr>`;
const vectorOpen =
  '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:aapt="http://schemas.android.com/aapt"\n    android:width="108dp"\n    android:height="108dp"\n    android:viewportWidth="108"\n    android:viewportHeight="108">\n';

const backgroundXml =
  vectorOpen +
  `  <path android:pathData="M0,0h108v108h-108z">\n${gradXml(
    'radial',
    `android:centerX="${C}" android:centerY="${C}" android:gradientRadius="66"`,
    [
      [0, BG[0]],
      [1, BG[1]],
    ],
  )}\n  </path>\n</vector>\n`;

const foregroundXml =
  vectorOpen +
  `  <!-- Schatten des Bretts -->\n  <group android:translateY="1.8">\n    <path android:pathData="${octPath}" android:fillColor="${hex8('#000000', 0.28)}"/>\n  </group>\n` +
  `  <!-- Brett -->\n  <path android:pathData="${octPath}" android:strokeColor="${hex8(RIM)}" android:strokeWidth="1.6" android:strokeLineJoin="round">\n` +
  gradXml('linear', 'android:startX="30" android:startY="26" android:endX="80" android:endY="84"', [
    [0, WOOD[0]],
    [1, WOOD[1]],
  ]) +
  '\n  </path>\n' +
  `  <!-- Mittelkreis -->\n  <path android:pathData="${circlePath(C, C, 8.2)}" android:fillColor="${hex8('#7B5129', 0.28)}"/>\n` +
  `  <!-- Murmelschatten -->\n` +
  MARBLES.map(
    m =>
      `  <path android:pathData="${circlePath(m.c[0] + 0.7, m.c[1] + 1.7, MR + 0.1)}" android:fillColor="${hex8('#000000', 0.32)}"/>`,
  ).join('\n') +
  '\n' +
  `  <!-- Murmeln -->\n` +
  MARBLES.map(m => {
    const g = gradOf(m);
    return `  <path android:pathData="${circlePath(m.c[0], m.c[1], MR)}">\n${gradXml('radial', `android:centerX="${g.cx}" android:centerY="${g.cy}" android:gradientRadius="${g.r}"`, g.stops)}\n  </path>`;
  }).join('\n') +
  '\n</vector>\n';

// Einfarbige Ebene für Themen-Icons (Android 13+): nur Form, die Farbe bestimmt das System
const monochromeXml =
  vectorOpen +
  `  <path android:pathData="${octPath}" android:strokeColor="#FF000000" android:strokeWidth="3.4" android:strokeLineJoin="round"/>\n` +
  MARBLES.map(m => `  <path android:pathData="${circlePath(m.c[0], m.c[1], MR)}" android:fillColor="#FF000000"/>`).join(
    '\n',
  ) +
  '\n</vector>\n';

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_aendi_background"/>
    <foreground android:drawable="@drawable/ic_aendi_foreground"/>
    <monochrome android:drawable="@drawable/ic_aendi_monochrome"/>
</adaptive-icon>
`;

write('android-icon/res/drawable/ic_aendi_background.xml', backgroundXml);
write('android-icon/res/drawable/ic_aendi_foreground.xml', foregroundXml);
write('android-icon/res/drawable/ic_aendi_monochrome.xml', monochromeXml);
write('android-icon/res/mipmap-anydpi-v26/ic_launcher.xml', adaptiveXml);
write('android-icon/res/mipmap-anydpi-v26/ic_launcher_round.xml', adaptiveXml);

// ------------------------------------------------------------------ SVG (für PNGs und Vorschau)

const stopSvg = ([o, c, a]) =>
  `<stop offset="${o}" stop-color="${c}"${a != null && a < 1 ? ` stop-opacity="${a}"` : ''}/>`;
const defsSvg = `<defs>
<radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C}" r="66">${stopSvg([0, BG[0]])}${stopSvg([1, BG[1]])}</radialGradient>
<linearGradient id="wood" gradientUnits="userSpaceOnUse" x1="30" y1="26" x2="80" y2="84">${stopSvg([0, WOOD[0]])}${stopSvg([1, WOOD[1]])}</linearGradient>
${MARBLES.map((m, i) => {
  const g = gradOf(m);
  return `<radialGradient id="mg${i}" gradientUnits="userSpaceOnUse" cx="${g.cx}" cy="${g.cy}" r="${g.r}">${g.stops.map(stopSvg).join('')}</radialGradient>`;
}).join('\n')}
</defs>`;
const bgSvg = '<rect width="108" height="108" fill="url(#bg)"/>';
const fgSvg =
  `<path d="${octPath}" transform="translate(0 1.8)" fill="#000" fill-opacity=".28"/>` +
  `<path d="${octPath}" fill="url(#wood)" stroke="${RIM}" stroke-width="1.6" stroke-linejoin="round"/>` +
  `<circle cx="${C}" cy="${C}" r="8.2" fill="#7B5129" fill-opacity=".28"/>` +
  MARBLES.map(
    m => `<circle cx="${f(m.c[0] + 0.7)}" cy="${f(m.c[1] + 1.7)}" r="${MR + 0.1}" fill="#000" fill-opacity=".32"/>`,
  ).join('') +
  MARBLES.map((m, i) => `<circle cx="${m.c[0]}" cy="${m.c[1]}" r="${MR}" fill="url(#mg${i})"/>`).join('');
const monoSvg = col =>
  `<path d="${octPath}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linejoin="round"/>` +
  MARBLES.map(m => `<circle cx="${m.c[0]}" cy="${m.c[1]}" r="${MR}" fill="${col}"/>`).join('');
const art = bgSvg + fgSvg;

const svgDoc = (w, h, viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${defsSvg}${body}</svg>`;
const png = (svg, file) =>
  sharp(Buffer.from(svg))
    .png()
    .toBuffer()
    .then(b => write(file, b));

// Ältere Geräte (Android 6 bis 7) kennen nur ein fertiges Bild; ausgeschnitten auf die mittleren 84 Einheiten
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const VB = '12 12 84 84';
const jobs = [];
for (const [d, s] of Object.entries(LEGACY)) {
  jobs.push(
    png(
      svgDoc(
        s,
        s,
        VB,
        `<clipPath id="c"><rect x="12" y="12" width="84" height="84" rx="14.4"/></clipPath><g clip-path="url(#c)">${art}</g>`,
      ),
      `android-icon/res/mipmap-${d}/ic_launcher.png`,
    ),
  );
  jobs.push(
    png(
      svgDoc(
        s,
        s,
        VB,
        `<clipPath id="c"><circle cx="${C}" cy="${C}" r="42"/></clipPath><g clip-path="url(#c)">${art}</g>`,
      ),
      `android-icon/res/mipmap-${d}/ic_launcher_round.png`,
    ),
  );
}
// Play Store: 512 × 512, bildfüllend (Google schneidet selbst die Ecken ab)
jobs.push(png(svgDoc(512, 512, VB, art), 'store/play-store-icon-512.png'));
write('assets/icon.svg', svgDoc(1024, 1024, VB, art));

// ------------------------------------------------------------------ Vorschau mit verschiedenen Masken
const masks = {
  kreis: `<circle cx="54" cy="54" r="54"/>`,
  squircle: `<rect width="108" height="108" rx="38"/>`,
  quadrat: `<rect width="108" height="108" rx="22"/>`,
};
const clips = Object.entries(masks)
  .map(([k, v]) => `<clipPath id="m-${k}">${v}</clipPath>`)
  .join('');
const tile = (x, y, s, mask, inner) =>
  `<g transform="translate(${x} ${y}) scale(${s / 108})" clip-path="url(#m-${mask})">${inner}</g>`;
const themed = (bg, col) => `<rect width="108" height="108" fill="${bg}"/>${monoSvg(col)}`;
const LIGHT = ['#D5E6DC', '#1D4A39'],
  DARK = ['#2A3D35', '#BFE5D1'];
let pv = `<rect width="1200" height="392" fill="#E6ECE8"/><rect y="236" width="1200" height="156" fill="#F4F7F5"/>`;
[
  ['kreis', art],
  ['squircle', art],
  ['quadrat', art],
  ['kreis', themed(...LIGHT)],
  ['kreis', themed(...DARK)],
].forEach(([m, inner], i) => {
  pv += tile(12 + i * 240, 10, 216, m, inner);
});
// kleine Grössen: so sehen die Nutzer das Icon im Launcher (48 und 96 dp) und in der Liste
[96, 64, 48, 36].forEach((s, i) => {
  pv += tile(40 + i * 130, 262, s, 'kreis', art);
});
[96, 64, 48, 36].forEach((s, i) => {
  pv += tile(640 + i * 130, 262, s, 'squircle', art);
});
jobs.push(png(svgDoc(1200, 392, '0 0 1200 392', `<defs/>${clips}${pv}`), 'store/icon-vorschau.png'));

await Promise.all(jobs);
console.log('Icon erzeugt in', root);
