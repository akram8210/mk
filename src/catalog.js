// Kataloger: servon, byggplattor, materialkategorier, uppgifter och nivåer.
// Servomåtten är ungefärliga startvärden. Mät skolans servon med skjutmått
// och för in måtten under Avancerat (expertnivå), så sparas de i webbläsaren.

const SG90_MATT = {
  kropp: { l: 22.5, b: 12.2 },
  axelTillKortande: 6.1,    // axelcentrum -> närmaste kortände
  underOron: 15.9,          // kroppens djup bakom öronens anliggningsyta
  overOron: 6.8,            // kroppens höjd framför öronen
  kupol: 1.0,               // växellådans upphöjda kupol runt axeln
  hAxel: 11.0,              // öronens anliggningsyta -> axelns topp
  axelD: 4.8,               // ytterdiameter på axelns räfflor (splines)
  oronLangd: 32.2,
  oronTjocklek: 2.5,
  halavstand: 27.8,
  hornYta: 12.0,            // öronens anliggningsyta -> hornets framsida
};
const MG90S_MATT = {
  ...SG90_MATT,
  kropp: { l: 22.8, b: 12.2 },
  underOron: 18.5, overOron: 7.5, hAxel: 11.8, halavstand: 28.0, oronLangd: 32.5, hornYta: 12.8,
};

export const SERVOS = {
  A180: { id: 'A180', namn: 'Servo A – 180° (SG90-typ)', lev: 'A', typ: 180, momentKgCm: 1.8, vinkelMax: 160, ...SG90_MATT },
  A360: { id: 'A360', namn: 'Servo A – 360° kontinuerligt', lev: 'A', typ: 360, momentKgCm: 1.5, varvPerMin: 55, ...SG90_MATT },
  B180: { id: 'B180', namn: 'Servo B – 180° (MG90S-typ)', lev: 'B', typ: 180, momentKgCm: 2.2, vinkelMax: 160, ...MG90S_MATT },
  B360: { id: 'B360', namn: 'Servo B – 360° kontinuerligt', lev: 'B', typ: 360, momentKgCm: 1.8, varvPerMin: 60, ...MG90S_MATT },
};
// Namn från version 1
export const SERVO_ALIAS = { SG90: 'A180', MG90S: 'B180' };

// Fält som läraren kan ändra efter mätning (sparas lokalt).
export const SERVO_REDIGERBARA = [
  { id: 'momentKgCm', namn: 'Vridmoment', enhet: 'kg·cm', min: 0.5, max: 10, steg: 0.1 },
  { id: 'hAxel', namn: 'Öronens yta → axelns topp', enhet: 'mm', min: 6, max: 18, steg: 0.1 },
  { id: 'overOron', namn: 'Öronens yta → kroppens topp', enhet: 'mm', min: 3, max: 14, steg: 0.1 },
  { id: 'halavstand', namn: 'Avstånd mellan öronens hål', enhet: 'mm', min: 20, max: 40, steg: 0.1 },
];

export function tillampaServoMatt(overrides) {
  for (const [id, f] of Object.entries(overrides || {})) {
    if (!SERVOS[id]) continue;
    for (const r of SERVO_REDIGERBARA) {
      const v = Number(f[r.id]);
      if (Number.isFinite(v) && v >= r.min && v <= r.max) SERVOS[id][r.id] = v;
    }
  }
}

export const kgCmTillNm = (kgcm) => kgcm * 9.81 / 100;

export const PLATTOR = [
  { id: '220', namn: 'Creality K1C (220 × 220 mm)', x: 220, y: 220, z: 250 },
  { id: '180', namn: '180 × 180 mm', x: 180, y: 180, z: 180 },
  { id: '256', namn: '256 × 256 mm', x: 256, y: 256, z: 256 },
];

export const KATEGORIER = {
  print:   { namn: '3D-skrivs',          farg: 0xe8892b, css: '#e8892b', ikon: '🖨', kort: 'Skriv ut' },
  kit:     { namn: 'Från materiallådan', farg: 0x3b7dd8, css: '#3b7dd8', ikon: '📦', kort: 'Materiallåda' },
  self:    { namn: 'Bygger själv',       farg: 0x3f9b5a, css: '#3f9b5a', ikon: '✂', kort: 'Bygg själv' },
  visning: { namn: 'Visningsdel',        farg: 0x9aa0a6, css: '#9aa0a6', ikon: '👁', kort: 'Visas bara' },
};

export const NIVAER = [
  { id: 'nyborjare', nr: 1, namn: 'Nybörjare', forslag: 'förslag: åk 7', text: 'Du anger vad du vill uppnå. Programmet räknar och visar hur.' },
  { id: 'van', nr: 2, namn: 'Van', forslag: 'förslag: åk 8', text: 'Du kan välja mått själv och styra servot på avstånd.' },
  { id: 'expert', nr: 3, namn: 'Expert', forslag: 'förslag: åk 9', text: 'Alla val, avancerade inställningar och servomått.' },
];

export const UPPGIFTER = [
  { id: 'lucka', namn: 'Öppna en lucka', rorelse: 'sväng', ikon: '⤴',
    beskrivning: 'En lucka eller ett lock som svänger upp runt ett gångjärn.',
    mekanismer: ['hävarm', 'servoarm'], gravitation: 1, objekt: 'luckan' },
  { id: 'dorr', namn: 'Öppna en dörr', rorelse: 'sväng', ikon: '🚪',
    beskrivning: 'En dörr som svänger åt sidan runt lodräta gångjärn.',
    mekanismer: ['servoarm', 'hävarm'], gravitation: 0, objekt: 'dörren' },
  { id: 'skjut', namn: 'Skjuta en dörr eller ett fönster', rorelse: 'rak', ikon: '↔',
    beskrivning: 'En skjutdörr eller ett skjutfönster som glider rakt åt sidan.',
    mekanismer: ['kuggstång'], gravitation: 0, objekt: 'dörren' },
  { id: 'hiss', namn: 'Lyfta en modellhiss', rorelse: 'rak', ikon: '⬆',
    beskrivning: 'En hisskorg som åker rakt upp och ner.',
    mekanismer: ['kuggstång'], gravitation: 1, objekt: 'hisskorgen',
    kommande: 'Lintrumma och block/talja kommer i version 2.1.' },
  { id: 'tvadorrar', namn: 'Öppna två dörrar', rorelse: 'sväng', ikon: '⇆',
    beskrivning: 'Två dörrar som öppnas samtidigt av ett servo.',
    mekanismer: [], gravitation: 0, objekt: 'dörrarna', inaktiv: 'Kommer i version 2.1.' },
];

export const MEKANISMER = {
  'servoarm': {
    id: 'servoarm', namn: 'Servoarm (direkt)', omvandling: 'vridning → sväng', rorelse: 'sväng',
    svarighet: 'Enkel', maskiner: 'hjul och axel, hävstång',
    forklaring: 'Servot sitter i gångjärnets linje och vrider luckan direkt med en arm. Få delar, men servot måste orka hela tyngden.',
  },
  'hävarm': {
    id: 'hävarm', namn: 'Hävarm med länkstång', omvandling: 'vridning → sväng', rorelse: 'sväng',
    svarighet: 'Medel', maskiner: 'två hävstänger, länkage',
    forklaring: 'En kort servoarm trycker en länkstång som lyfter en hävarm på luckan. Servot kan sitta en bit bort. Kort servoarm och lång hävarm ger mer kraft men mindre rörelse.',
  },
  'kuggstång': {
    id: 'kuggstång', namn: 'Kuggstång med drev', omvandling: 'vridning → rak rörelse', rorelse: 'rak',
    svarighet: 'Medel', maskiner: 'hjul och axel, kugghjul',
    forklaring: 'Ett kugghjul (drev) på servot driver en rak kuggstång som glider i en styrskena. Större drev ger längre rörelse men mindre kraft.',
  },
};
