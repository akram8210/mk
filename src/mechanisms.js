// Mekanismer: bygger delar, kinematik, monteringssteg och beräkningar
// från en och samma design (en enda datamodell för alla vyer och exporter).
// Version 2: målstyrt läge, montering direkt på servoaxeln, 360°-servon,
// länkstång/pianotråd för servo på avstånd. Designer från version 1 (utan
// fältet v) byggs exakt som tidigare.
import * as THREE from 'three';
import { SERVOS, SERVO_ALIAS, UPPGIFTER, MEKANISMER, kgCmTillNm } from './catalog.js';
import {
  rect, stadium, hole, slot, rectHole, plateXY, plateXZ, plateYZ, box, cylZ, cylX,
  gearShape, gearParams, rackShape, axelHal, polyHal, cirkel,
} from './geom.js';

const G = 9.81;
const DEG = Math.PI / 180;
const R_YUPP_TILL_ZUPP = new THREE.Matrix4().makeRotationX(Math.PI / 2);
const R_VAND = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const R_LAGG_X = new THREE.Matrix4().makeRotationY(Math.PI / 2);
export const fmt = (v, d = 1) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });

const MAX_UTSKRIVEN_STANG = 80;   // längre utskrivna länkstänger knäcks

// ---------- Parametrar ----------
// niva: lägsta nivå som visar fältet (1 nybörjare, 2 van, 3 expert)
// lage: 'mal' = bara i målstyrt läge, 'fri' = bara när eleven provar själv
// beraknas: i vilket läge värdet räknas fram av programmet
// servoTyp: visas bara för 180°- eller 360°-servo
export const PARAMETRAR = {
  'servoarm': [
    { id: 'Lh', namn: 'Luckans/dörrens längd', enhet: 'mm', min: 40, max: 200, steg: 5, std: 80, niva: 1, info: 'Avståndet från gångjärnet till luckans ytterkant. Mät på ditt bygge.' },
    { id: 'Wh', namn: 'Luckans/dörrens bredd', enhet: 'mm', min: 40, max: 200, steg: 5, std: 80, niva: 1, info: 'Hur bred luckan är längs gångjärnet.' },
    { id: 'vinkel', namn: 'Öppningsvinkel', enhet: '°', min: 30, max: 160, steg: 5, std: 90, niva: 1, info: 'Hur många grader luckan ska öppnas. Servot vrider lika många grader.' },
    { id: 'b', namn: 'Armens fästavstånd', enhet: 'mm', min: 15, max: 60, steg: 1, std: 25, niva: 2, info: 'Hur långt ut på luckan armen fästs.' },
    { id: 'massa', namn: 'Luckans vikt', enhet: 'g', min: 5, max: 300, steg: 5, std: 30, niva: 1, info: 'Väg luckan om du kan. En lucka av 3 mm kartong på 8 × 8 cm väger ungefär 15–30 g.' },
  ],
  'hävarm': [
    { id: 'Lh', namn: 'Luckans/dörrens längd', enhet: 'mm', min: 40, max: 200, steg: 5, std: 80, niva: 1, info: 'Avståndet från gångjärnet till luckans ytterkant. Mät på ditt bygge.' },
    { id: 'Wh', namn: 'Luckans/dörrens bredd', enhet: 'mm', min: 40, max: 200, steg: 5, std: 80, niva: 1, info: 'Hur bred luckan är längs gångjärnet.' },
    { id: 'malVinkel', namn: 'Önskad öppning', enhet: '°', min: 20, max: 120, steg: 5, std: 70, niva: 1, lage: 'mal', info: 'Hur många grader luckan ska öppnas. Programmet räknar ut hur lång hävarmen ska vara.' },
    { id: 'L', namn: 'Avstånd servo–lucka (länkstång)', enhet: 'mm', min: 20, max: 250, steg: 5, std: 40, niva: 2, info: 'Länkstångens längd bestämmer hur långt bort servot kan sitta. Längre än 80 mm görs av pianotråd.' },
    { id: 'a', namn: 'Servoarmens längd', enhet: 'mm', min: 10, max: 30, steg: 1, std: 14, niva: 2, info: 'Kort servoarm ger mer kraft men mindre rörelse.' },
    { id: 'b', namn: 'Hävarmens längd på luckan', enhet: 'mm', min: 12, max: 60, steg: 1, std: 22, niva: 2, beraknas: 'mal', info: 'Avståndet från gångjärnet till länkstångens fäste. Kort hävarm ger stor öppning, lång hävarm ger mer kraft.' },
    { id: 'vinkel', namn: 'Servots vridning', enhet: '°', min: 30, max: 160, steg: 5, std: 120, niva: 2, info: 'Hur många grader servot vrider.' },
    { id: 'massa', namn: 'Luckans vikt', enhet: 'g', min: 5, max: 300, steg: 5, std: 30, niva: 1, info: 'Väg luckan om du kan.' },
  ],
  'kuggstång': [
    { id: 'malSlag', namn: 'Önskad slaglängd', enhet: 'mm', min: 10, max: 150, steg: 0.5, std: 50, niva: 1, lage: 'mal', info: 'Hur långt dörren eller korgen ska flyttas. Programmet väljer drevet.' },
    { id: 'm', namn: 'Modul (kuggstorlek)', enhet: 'mm', min: 1, max: 1.5, steg: 0.25, std: 1.5, niva: 2, info: 'Modulen bestämmer hur stora kuggarna är. Större kuggar är lättare att skriva ut.' },
    { id: 'z', namn: 'Antal kuggar på drevet', enhet: 'st', min: 12, max: 40, steg: 1, std: 20, niva: 2, beraknas: 'mal180', info: 'Fler kuggar ger ett större drev: längre rörelse men mindre kraft. Diametern blir modul × kuggar.' },
    { id: 'vinkel', namn: 'Servots vridning', enhet: '°', min: 30, max: 160, steg: 5, std: 150, niva: 2, servoTyp: 180, info: 'Hur många grader servot vrider. 150° ger lite reserv.' },
    { id: 'varv', namn: 'Antal varv', enhet: 'varv', min: 0.25, max: 10, steg: 0.05, std: 1, niva: 2, servoTyp: 360, beraknas: 'mal', info: 'Ett 360°-servo kan snurra flera varv. Ändlägesbrytare stoppar rörelsen.' },
    { id: 'Wd', namn: 'Dörrens/korgens bredd', enhet: 'mm', min: 30, max: 200, steg: 5, std: 40, niva: 1, info: 'Används för bilden och för att kontrollera att rörelsen räcker.' },
    { id: 'Hd', namn: 'Dörrens/korgens höjd', enhet: 'mm', min: 30, max: 200, steg: 5, std: 70, niva: 2, info: 'Används för bilden.' },
    { id: 'massa', namn: 'Vikt som ska flyttas', enhet: 'g', min: 5, max: 500, steg: 5, std: 40, niva: 1, info: 'Dörrens eller hisskorgens vikt.' },
  ],
};

export const GEMENSAMMA = [
  { id: 'spel', namn: 'Passningsspel', enhet: 'mm', min: 0.1, max: 0.6, steg: 0.05, std: 0.3, niva: 2, info: 'Mellanrummet som gör att delarna kan röra sig utan att kärva. Påverkar inte axelhålet.' },
];

export const AVANCERADE = [
  { id: 'axelHal', namn: 'Axelhålets diameter', enhet: 'mm', min: 4.6, max: 5.2, steg: 0.05, std: 4.9, niva: 3, info: 'Hålet som trycks på servoaxeln. Skriv ut kalibreringsbiten K01 och välj det hål som satt bäst.' },
];

export const VAL = {
  fasteTyp: { namn: 'Fäste på servot', niva: 2, alternativ: [['axel', 'Direkt på axeln'], ['horn', 'Via servohornet (skruvar)']] },
  halProfil: { namn: 'Hålprofil', niva: 3, alternativ: [['rund', 'Rund'], ['ribbor', 'Krossribbor']] },
};

const allaParametrar = (mek) => [...(PARAMETRAR[mek] || []), ...GEMENSAMMA, ...AVANCERADE];

export function standardDesign(uppgiftId, mekId, opt = {}) {
  const d = {
    v: 2, uppgift: uppgiftId, mekanism: mekId, servo: opt.servo || 'A180',
    lage: opt.lage || 'mal', fasteTyp: 'axel', halProfil: 'rund', lasSkruv: false, gissning: null,
  };
  for (const p of allaParametrar(mekId)) d[p.id] = p.std;
  if (opt.axelHal) d.axelHal = opt.axelHal;
  if (uppgiftId === 'hiss' && mekId === 'kuggstång') { d.Wd = 50; d.Hd = 50; d.massa = 30; d.malSlag = 40; }
  return d;
}

export function begransa(design) {
  const ut = { ...design };
  if (SERVO_ALIAS[ut.servo]) ut.servo = SERVO_ALIAS[ut.servo];
  if (!SERVOS[ut.servo]) ut.servo = 'A180';
  // Version 1: inget v-fält → servohorn, fritt läge
  if (!ut.v) { ut.v = 1; ut.fasteTyp = 'horn'; ut.lage = 'fri'; }
  if (!['axel', 'horn'].includes(ut.fasteTyp)) ut.fasteTyp = 'axel';
  if (!['mal', 'fri'].includes(ut.lage)) ut.lage = 'fri';
  if (!['rund', 'ribbor'].includes(ut.halProfil)) ut.halProfil = 'rund';
  ut.lasSkruv = !!ut.lasSkruv;
  for (const p of allaParametrar(design.mekanism)) {
    let v = Number(ut[p.id]);
    if (!Number.isFinite(v)) v = p.std;
    v = Math.min(p.max, Math.max(p.min, v));
    v = Math.round(v / p.steg) * p.steg;
    ut[p.id] = Number(v.toFixed(3));
  }
  const sv = SERVOS[ut.servo];
  if (sv.typ === 180 && ut.vinkel > sv.vinkelMax) ut.vinkel = sv.vinkelMax;
  return ut;
}

// ---------- Målstyrt läge: räkna baklänges ----------
export function kategori(mek, varde) {
  if (mek === 'kuggstång') return varde < 25 ? 'liten' : varde <= 40 ? 'mellan' : 'stor';
  return varde < 20 ? 'liten' : varde <= 35 ? 'mellan' : 'stor';
}

function losMal(d) {
  const mal = { rader: [], varningar: [], beraknade: [] };
  if (d.lage !== 'mal') return mal;
  const sv = SERVOS[d.servo];
  if (d.mekanism === 'kuggstång') {
    const S = d.malSlag;
    if (sv.typ === 180) {
      const th = d.vinkel;
      const dReq = 360 * S / (Math.PI * th);
      let z = Math.ceil(dReq / d.m - 1e-9);
      if (z < 12) z = 12;
      if (z > 40) { z = 40; mal.varningar.push(`Slaglängden ${fmt(S, 1)} mm kan inte nås med modul ${fmt(d.m, 2)} och ${th}°. Största möjliga är ${fmt(Math.PI * d.m * 40 * th / 360, 1)} mm. Välj ett 360°-servo eller en annan mekanism.`); }
      d.z = z;
      const dd = d.m * z;
      const sf = Math.PI * dd * th / 360;
      const thExakt = 360 * S / (Math.PI * dd);
      mal.beraknade.push('z');
      mal.gissVarde = dd; mal.gissKat = kategori('kuggstång', dd);
      mal.rader = [
        `Önskad slaglängd s = ${fmt(S, 1)} mm, servot vrider θ = ${th}°`,
        `Diameter som behövs: d = 360 · s / (π · θ) = 360 · ${fmt(S, 1)} / (π · ${th}) = ${fmt(dReq, 1)} mm`,
        `Antal kuggar: z = d / m = ${fmt(dReq, 1)} / ${fmt(d.m, 2)} = ${fmt(dReq / d.m, 2)} → avrundas uppåt till ${z}`,
        `Drevets diameter: d = m · z = ${fmt(d.m, 2)} · ${z} = ${fmt(dd, 1)} mm`,
        `Faktisk slaglängd: s = π · d · θ / 360 = ${fmt(sf, 1)} mm (${sf >= S ? '+' : ''}${fmt(sf - S, 1)} mm)`,
        `Servovinkel för exakt ${fmt(S, 1)} mm: θ = 360 · s / (π · d) = ${fmt(thExakt, 1)}°`,
      ];
      mal.thExakt = thExakt;
      mal.forslag = `Drev Ø ${fmt(dd, 1)} mm (modul ${fmt(d.m, 2)} × ${z} kuggar) → ${fmt(sf, 1)} mm`;
    } else {
      const dd = d.m * d.z;
      let varv = S / (Math.PI * dd);
      if (varv > 10) { varv = 10; mal.varningar.push('Över 10 varv – välj ett större drev.'); }
      if (varv < 0.25) { varv = 0.25; mal.varningar.push('Under ett kvarts varv – välj ett mindre drev.'); }
      d.varv = Number(varv.toFixed(3));
      mal.beraknade.push('varv');
      mal.gissVarde = varv;
      mal.rader = [
        `Önskad slaglängd s = ${fmt(S, 1)} mm, drevets diameter d = ${fmt(dd, 1)} mm`,
        `Ett varv flyttar dörren π · d = ${fmt(Math.PI * dd, 1)} mm`,
        `Antal varv: s / (π · d) = ${fmt(S, 1)} / ${fmt(Math.PI * dd, 1)} = ${fmt(d.varv, 2)} varv`,
        'Servot vet inte själv var det står. Ändlägesbrytarna säger till när dörren är framme.',
      ];
      mal.forslag = `${fmt(d.varv, 2)} varv med drev Ø ${fmt(dd, 1)} mm`;
    }
  } else if (d.mekanism === 'hävarm') {
    const mal0 = d.malVinkel;
    let bast = null;
    for (let b = 12; b <= 60; b += 1) {
      const k = svingKinematik({ ...d, b, direkt: false });
      if (!k.ok || k.minD < -0.05) continue;
      const fel = Math.abs(k.phiMax / DEG - mal0);
      if (!bast || fel < bast.fel - 1e-9) bast = { b, fel, phi: k.phiMax / DEG };
    }
    if (!bast) { mal.varningar.push('Ingen hävarm ger en fungerande rörelse. Ändra servoarm, länkstång eller servots vridning.'); return mal; }
    d.b = bast.b;
    mal.beraknade.push('b');
    if (bast.fel > 5) mal.varningar.push(`Närmaste möjliga öppning är ${fmt(bast.phi, 0)}°. Ändra servoarmens längd eller servots vridning för att komma närmare ${mal0}°.`);
    const start = d.a * Math.sin(d.vinkel * DEG / 2) / Math.sin(mal0 * DEG / 2);
    mal.gissVarde = bast.b; mal.gissKat = kategori('hävarm', bast.b);
    mal.rader = [
      `Önskad öppning φ = ${mal0}°, servoarm r = ${d.a} mm, servot vrider θ = ${d.vinkel}°`,
      `Startgissning: hävarm ≈ r · sin(θ/2) / sin(φ/2) = ${d.a} · ${fmt(Math.sin(d.vinkel * DEG / 2), 3)} / ${fmt(Math.sin(mal0 * DEG / 2), 3)} = ${fmt(start, 1)} mm`,
      `Programmet provar alla längder och väljer ${bast.b} mm, som ger ${fmt(bast.phi, 0)}° öppning`,
    ];
    mal.forslag = `Hävarm ${bast.b} mm → ${fmt(bast.phi, 0)}° öppning`;
  } else {
    mal.rader = [`Servot vrider lika många grader som luckan ska öppnas: ${d.vinkel}°`];
  }
  return mal;
}

// ---------- Gemensamma byggstenar ----------
function servoSkal(sv) {
  const a = sv.axelTillKortande, l = sv.kropp.l, b = sv.kropp.b;
  const xc = l / 2 - a;
  const ut = [
    box(-a, l - a, -b / 2, b / 2, -sv.underOron, sv.overOron),
    box(xc - sv.oronLangd / 2, xc + sv.oronLangd / 2, -b / 2, b / 2, 0, sv.oronTjocklek),
    cylZ(0, 0, b / 2, sv.overOron, sv.overOron + (sv.kupol ?? 1.5)),
    cylZ(0, 0, 2.4, sv.overOron + (sv.kupol ?? 1.5), sv.hAxel ?? (sv.hornYta - 1.5)),
  ];
  return ut;
}
function hornSkal(sv) { return [cylZ(0, 0, 3.6, sv.hornYta - 1.5, sv.hornYta)]; }

function servoOronHal(sv) {
  const xc = sv.kropp.l / 2 - sv.axelTillKortande;
  return [[xc - sv.halavstand / 2, 0], [xc + sv.halavstand / 2, 0]];
}

// Fästytans läge räknat från öronens anliggningsyta.
function montering(sv, d) {
  if (d.fasteTyp === 'axel') return { zMont: sv.overOron + (sv.kupol ?? 1) + 0.5, axel: true };
  return { zMont: sv.hornYta, axel: false };
}

const matrisFran = (x, y, z, rotZ = 0) =>
  new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(rotZ));

// Del som trycks på servoaxeln: tunt fasningslager, huvudlager och ev. lock.
// form(hålfunktion) ska returnera en ny Shape med övriga hål; hålfunktion lägger till axelhålet.
function axelLager(form, tjocklek, d, extraRing = 0) {
  const D = d.axelHal, prof = d.halProfil;
  const skal = [];
  skal.push(plateXY(form((s) => polyHal(s, D + 0.6, 0, 0, 64)), 0, 0.4));
  skal.push(plateXY(form((s) => axelHal(s, D, prof)), 0.4, tjocklek - 0.4));
  let topp = tjocklek;
  if (extraRing > 0) {
    skal.push(plateXY(axelHal(cirkel(5.5, 0, 0, 64), D, prof), topp, extraRing));
    topp += extraRing;
  }
  if (d.lasSkruv) {
    skal.push(plateXY(polyHal(cirkel(5.5, 0, 0, 64), 2.2), topp, 1.2));
    topp += 1.2;
  }
  return { skal, topp };
}

// Arm som sitter på servot (drivande) eller länkstång (båda ändar leder).
function armSkal(len, r, d, roll, andHalD) {
  const c = d.spel;
  if (roll === 'drivande' && d.fasteTyp === 'axel') {
    const R = Math.max(r, 5.5);
    const form = (hal) => { const s = stadium(0, len, R); hal(s); polyHal(s, andHalD + c, len, 0); return s; };
    return axelLager(form, 3, d, 1.5).skal;
  }
  const s = stadium(0, len, r);
  if (roll === 'drivande') {
    hole(s, 0, 0, 1.1 + c / 2);
    const hx = Math.min(8, len - 4.5);
    if (hx > 3.5) hole(s, hx, 0, 0.9 + c / 2);
  } else {
    hole(s, 0, 0, 1.2 + c / 2);
  }
  if (andHalD === 2.4) hole(s, len, 0, 1.2 + c / 2);
  else polyHal(s, andHalD + c, len, 0);
  return [plateXY(s, 0, 3)];
}

// ---------- Kinematik för svängande lucka ----------
export function svingKinematik(p) {
  const direkt = p.direkt ?? (p.mekanism === 'servoarm');
  const e = 10;
  const b = p.b;
  const Q0 = new THREE.Vector2(b, -e);
  const thetaMax = p.vinkel * DEG;
  let a = 0, L = 0, S, armLen, beta = 0, th0 = 0;
  if (direkt) {
    S = new THREE.Vector2(0, 0);
    armLen = Math.hypot(b, e);
    beta = Math.atan2(-e, b);
  } else {
    a = p.a; L = p.L;
    th0 = -thetaMax / 2;
    S = new THREE.Vector2(b - a * Math.cos(th0), -e - L - a * Math.sin(th0));
    armLen = a;
  }
  const rQ = Q0.length();
  const phiQ0 = Math.atan2(Q0.y, Q0.x);
  const norm = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  function losning(theta, phiForra) {
    if (direkt) return { phi: theta, ok: true };
    const P = new THREE.Vector2(S.x + a * Math.cos(th0 + theta), S.y + a * Math.sin(th0 + theta));
    const dd = P.length();
    if (dd > rQ + L || dd < Math.abs(rQ - L) || dd < 1e-6) return { phi: phiForra, ok: false };
    const aa = (rQ * rQ - L * L + dd * dd) / (2 * dd);
    const h = Math.sqrt(Math.max(0, rQ * rQ - aa * aa));
    const ux = P.x / dd, uy = P.y / dd;
    const mx = ux * aa, my = uy * aa;
    const p1 = Math.atan2(my + ux * h, mx - uy * h) - phiQ0;
    const p2 = Math.atan2(my - ux * h, mx + uy * h) - phiQ0;
    const v1 = norm(p1 - phiForra), v2 = norm(p2 - phiForra);
    return { phi: Math.abs(v1) <= Math.abs(v2) ? phiForra + v1 : phiForra + v2, ok: true };
  }
  const N = 160;
  const tabell = [];
  let phi = 0, ok = true, minD = Infinity, maxD = 0;
  for (let i = 0; i <= N; i++) {
    const th = thetaMax * i / N;
    const r = losning(th, phi);
    if (!r.ok) ok = false;
    phi = r.phi;
    tabell.push({ th, phi });
  }
  for (let i = 1; i <= N; i++) {
    const dd = (tabell[i].phi - tabell[i - 1].phi) / (tabell[i].th - tabell[i - 1].th);
    minD = Math.min(minD, dd);
    maxD = Math.max(maxD, Math.abs(dd));
  }
  return { direkt, e, Q0, S, a, L, armLen, beta, th0, thetaMax, tabell, ok, minD, maxD, phiMax: tabell[N].phi, N };
}

// ---------- Svängande lucka/dörr: servoarm eller hävarm ----------
function byggSving(design, uppg) {
  const sv = SERVOS[design.servo];
  const c = design.spel;
  const v2 = design.v >= 2;
  const k = svingKinematik(design);
  const { direkt, e, Q0, S, a, L, armLen, beta, th0, tabell, ok, minD, maxD, phiMax, N } = k;
  const Lh = design.Lh, Wh = design.Wh, b = design.b;
  const trad = v2 && !direkt && L > MAX_UTSKRIVEN_STANG;
  const ledD = trad ? 1.7 : 2.4;            // hål för pianotråd eller M2-skruv
  const zh = direkt ? -6 : -9;               // fästytan (armens undersida)
  const { zMont, axel } = montering(sv, design);
  const zs = zh - zMont;                     // öronens anliggningsyta = fästplattans framsida
  const ofTid = (t) => {
    const x = Math.min(1, Math.max(0, t)) * N;
    const i = Math.min(N - 1, Math.floor(x)), f = x - i;
    const A = tabell[i], B = tabell[i + 1];
    return { th: A.th + (B.th - A.th) * f, phi: A.phi + (B.phi - A.phi) * f };
  };

  const delar = [];
  const yF = S.y - sv.kropp.l + sv.axelTillKortande - 10;
  const a0 = sv.axelTillKortande, l = sv.kropp.l, bb = sv.kropp.b;
  const servoMat = matrisFran(S.x, S.y, zs, -Math.PI / 2);
  const oron = servoOronHal(sv).map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(servoMat));
  const yTopp = Math.max(...oron.map(p => p.y)) + 5;
  const flansX = v2 ? 10 : 10.5, flansD = v2 ? 3.2 + c : 3.4 + c;

  const W = 15;
  const fasteSkal = [];
  {
    const s = rect(S.x - W, yF + 3, S.x + W, yTopp);
    rectHole(s, S.x - bb / 2 - c - 0.3, S.y - (l - a0) - c - 0.3, S.x + bb / 2 + c + 0.3, S.y + a0 + c + 0.3);
    for (const p of oron) hole(s, p.x, p.y, 0.9 + c / 2);
    fasteSkal.push(plateXY(s, zs - 3, 3));
    const f = rect(S.x - W, zs - 23, S.x + W, zs);
    hole(f, S.x - flansX, zs - 14, flansD / 2);
    hole(f, S.x + flansX, zs - 14, flansD / 2);
    fasteSkal.push(plateXZ(f, yF, 3));
  }
  delar.push({ id: 'faste', namn: 'Servofäste', kat: 'print', antal: 1, skal: fasteSkal, printRot: R_YUPP_TILL_ZUPP,
    matt: `${2 * W} × ${fmt(yTopp - yF, 0)} mm${v2 ? ', fästhål 20 mm isär (10 mm-raster)' : ', fläns 23 mm'}`, sprang: [0, 0, -35],
    info: 'Håller servot. Flänsen skruvas fast i stommen' + (v2 ? ' – hålen passar ett 10 mm-raster så att servot kan flyttas.' : '.') });
  delar.push({ id: 'servo', namn: sv.namn, kat: 'kit', antal: 1, skal: [...servoSkal(sv), ...(axel ? [] : hornSkal(sv))], sprang: [0, 0, 22],
    matt: `${sv.kropp.l} × ${sv.kropp.b} mm`, info: 'Ställ servot i startläge (0°) innan armen sätts fast.' });
  delar.push({ id: 'arm', namn: direkt ? 'Servoarm' : 'Servoarm (vev)', kat: 'print', antal: 1,
    skal: armSkal(armLen, direkt ? 5 : 4.5, design, 'drivande', ledD),
    printRot: null, matt: `${fmt(armLen, 1)} mm mellan hålen${axel ? `, axelhål Ø ${fmt(design.axelHal, 2)} mm` : ''}`, sprang: [0, 0, 40],
    info: axel ? 'Trycks rakt på servoaxeln. Stöd servot med handen och tryck tills armen tar stopp.' : 'Skruvas fast på servohornet med hornets små skruvar.' });
  if (!direkt) {
    if (trad) {
      delar.push({ id: 'stang', namn: 'Pianotråd Ø 1,5 mm (länkstång)', kat: 'kit', antal: 1,
        skal: [cylX(0, L, 0, 1.5, 0.75)], matt: `${L} mm mellan böjarna, kapa ${L + 20} mm`, sprang: [0, 0, 58],
        info: 'Böj en Z-böj i varje ände med böjmallen. Tråden är stark nog för långa avstånd.' });
      const mall = rect(0, 0, 30, 12);
      polyHal(mall, 1.7 + c, 6, 6);
      polyHal(mall, 1.7 + c, 12, 6);
      delar.push({ id: 'bojmall', namn: 'Böjmall för Z-böj', kat: 'print', antal: 1, skal: [plateXY(mall, 0, 5)], printRot: null,
        matt: '30 × 12 × 5 mm', sprang: [0, 0, 0], visaInte: true,
        info: 'Stick in tråden i ena hålet, böj 90°, flytta till andra hålet och böj tillbaka. Det blir en Z-böj som låser tråden i armen.' });
    } else {
      delar.push({ id: 'stang', namn: 'Länkstång', kat: 'print', antal: 1, skal: armSkal(L, 4, design, 'stang', 2.4), printRot: null,
        matt: `${L} mm mellan hålen`, sprang: [0, 0, 58], info: 'Överför rörelsen från servoarmen till hävarmen på luckan.' });
    }
  }
  const fasteLucka = [];
  {
    const p = rect(b - 8, -3, b + 8, 16);
    hole(p, b, 5, 1.7 + c / 2);
    hole(p, b, 11, 1.7 + c / 2);
    fasteLucka.push(plateXZ(p, 3, 3));
    const fl = rect(b - 6, -e - 5, b + 6, 3);
    if (ledD === 2.4) hole(fl, b, -e, 1.2 + c / 2); else polyHal(fl, ledD + c, b, -e);
    fasteLucka.push(plateXY(fl, -3, 3));
  }
  delar.push({ id: 'luckfaste', namn: direkt ? 'Luckfäste' : 'Hävarm (luckfäste)', kat: 'print', antal: 1, skal: fasteLucka,
    printRot: R_VAND, matt: `fästhål ${b} mm från gångjärnet`, sprang: [0, 45, 0],
    info: 'Skruvas ovanpå luckan vid kanten. Fliken har hålet där armen eller länkstången kopplas.' });
  delar.push({ id: 'lucka', namn: uppg.id === 'dorr' ? 'Dörrblad' : 'Lucka', kat: 'self', antal: 1,
    skal: [box(0, Lh, 0, 3, 0, Wh)], matt: `${Lh} × ${Wh} × 3 mm`, sprang: [0, 25, 0],
    info: 'Bygg av kartong, plywood eller plast. Mått från programmet.' });
  delar.push({ id: 'gangjarn', namn: 'Gångjärn', kat: 'kit', antal: direkt ? 1 : 2,
    skal: direkt ? [cylZ(0, 0, 2.5, Wh - 18, Wh - 6)] : [cylZ(0, 0, 2.5, 6, 18), cylZ(0, 0, 2.5, Wh - 18, Wh - 6)],
    matt: 'litet gångjärn eller tejpgångjärn', sprang: [0, 0, 0],
    info: direkt ? 'Gångjärnet sitter på andra sidan. Servots axel fungerar som gångjärn på servosidan.' : 'Luckan hänger i gångjärnen.' });
  const zMin = zs - 26;
  const stomme = [
    box(Math.min(S.x - 25, -20), Lh + 15, yF - 3, yF, zMin, Wh + 10),
    box(2, Lh - 2, yF, -0.2, 2, 5), box(2, Lh - 2, yF, -0.2, Wh - 5, Wh - 2),
    box(2, 5, yF, -0.2, 5, Wh - 5), box(Lh - 5, Lh - 2, yF, -0.2, 5, Wh - 5),
  ];
  delar.push({ id: 'stomme', namn: 'Exempelstomme', kat: 'visning', antal: 1, skal: stomme,
    matt: `golv + låda ${Lh - 4} × ${Wh - 4} mm`, sprang: [0, -30, 0], info: 'Visar hur mekanismen kan sitta i ditt bygge. Byggs inte enligt programmet.' });
  const antalM2 = 2 + (direkt ? 1 : (trad ? 0 : 2)) + (axel && design.lasSkruv ? 1 : 0);
  delar.push({ id: 'skruvM2', namn: 'Skruv M2 (servoskruv)', kat: 'kit', antal: antalM2, ingenModell: true, matt: '6–10 mm',
    info: `2 st håller servot${direkt ? ', 1 st är axel mellan arm och luckfäste' : trad ? '' : ', 2 st är axlar i länkstångens leder'}${axel && design.lasSkruv ? ', 1 st låser armen på axeln' : ''}.` });
  if (!direkt && !trad) delar.push({ id: 'mutterM2', namn: 'Mutter M2 (låsmutter)', kat: 'kit', antal: 2, ingenModell: true, matt: 'M2', info: 'Dra inte hårt – lederna ska kunna röra sig.' });
  delar.push({ id: 'skruvM3', namn: 'Skruv M3 eller träskruv 3 mm', kat: 'kit', antal: 4, ingenModell: true, matt: '8–12 mm', info: '2 st fäster servofästet, 2 st fäster luckfästet.' });

  const stangZ = zh + 3;
  const pose = (t) => {
    const { th, phi } = ofTid(t);
    const M = new Map();
    const I = new THREE.Matrix4();
    M.set('faste', I); M.set('stomme', I); M.set('gangjarn', I);
    M.set('servo', servoMat);
    const luckMat = new THREE.Matrix4().makeRotationZ(phi);
    M.set('lucka', luckMat); M.set('luckfaste', luckMat);
    if (direkt) {
      M.set('arm', matrisFran(S.x, S.y, zh, beta + phi));
    } else {
      M.set('arm', matrisFran(S.x, S.y, zh, th0 + th));
      const P = new THREE.Vector2(S.x + a * Math.cos(th0 + th), S.y + a * Math.sin(th0 + th));
      const Q = Q0.clone().rotateAround(new THREE.Vector2(0, 0), phi);
      M.set('stang', matrisFran(P.x, P.y, stangZ, Math.atan2(Q.y - P.y, Q.x - P.x)));
      if (trad) M.set('bojmall', matrisFran(S.x + 25, yF, zs - 20, 0));
    }
    return M;
  };

  const oronLokalt = servoOronHal(sv);
  const leder = [
    ...oronLokalt.map((p, i) => ({ a: 'servo', pa: [p[0], p[1], 0], b: 'faste', pb: [oron[i].x, oron[i].y, zs] })),
    { a: 'servo', pa: [0, 0, zMont], b: 'arm', pb: [0, 0, 0] },
    { a: 'faste', pa: [S.x - flansX, yF, zs - 14], b: 'stomme', pb: [S.x - flansX, yF, zs - 14] },
    { a: 'faste', pa: [S.x + flansX, yF, zs - 14], b: 'stomme', pb: [S.x + flansX, yF, zs - 14] },
    { a: 'luckfaste', pa: [b, 3, 5], b: 'lucka', pb: [b, 3, 5] },
    { a: 'luckfaste', pa: [b, 3, 11], b: 'lucka', pb: [b, 3, 11] },
  ];
  if (direkt) leder.push({ a: 'arm', pa: [armLen, 0, 3], b: 'luckfaste', pb: [b, -e, -3] });
  else {
    leder.push({ a: 'arm', pa: [armLen, 0, 3], b: 'stang', pb: [0, 0, 0] });
    leder.push({ a: 'stang', pa: [L, 0, 3], b: 'luckfaste', pb: [b, -e, -3] });
  }

  const fastText = axel
    ? `Tryck ${direkt ? 'armen' : 'vevarmen'} rakt på servoaxeln tills den tar stopp. Stöd servot med handen och ta inte i för hårt.${design.lasSkruv ? ' Lås med servons lilla skruv i mitten.' : ''}`
    : 'Skruva fast med hornets skruvar.';
  const steg = [
    { titel: 'Skruva fast servofästet', delar: ['faste', 'skruvM3'],
      text: 'Placera servofästet så att hålet i fästplattan hamnar i linje med luckans gångjärn' + (direkt ? '' : ' enligt bilden') + '. Skruva fast flänsen i golvet med två skruvar.' },
    { titel: 'Sätt i servot', delar: ['servo', 'skruvM2'],
      text: 'Tryck in servot framifrån så att öronen ligger mot fästplattan och axeln pekar mot luckan. Skruva fast med två servoskruvar. Kör servot till 0° med micro:bit innan nästa steg.' },
    { titel: direkt ? 'Sätt fast servoarmen' : 'Sätt fast vevarmen', delar: ['arm'],
      text: direkt ? `Sätt armen så att den pekar snett nedåt mot luckans fästpunkt när luckan är stängd. ${fastText}`
        : `Sätt vevarmen så att den pekar ${fmt(design.vinkel / 2, 0)}° snett nedåt, bort från gångjärnet, när servot står på 0°. ${fastText}` },
  ];
  if (!direkt) steg.push(trad
    ? { titel: 'Böj och koppla pianotråden', delar: ['stang', 'bojmall'],
      text: `Kapa tråden till ${L + 20} mm. Gör en Z-böj i ena änden med böjmallen och trä in den i vevarmens ytterhål. Mät ${L} mm och gör nästa Z-böj.` }
    : { titel: 'Koppla länkstången', delar: ['stang', 'mutterM2'],
      text: 'Koppla länkstången till vevarmens ytterhål med en M2-skruv och låsmutter. Dra inte åt hårt – leden ska kunna vrida sig.' });
  steg.push({ titel: 'Montera luckan och luckfästet', delar: ['lucka', 'gangjarn', 'luckfaste'],
    text: `Fäst luckan med gångjärn${direkt ? ' på andra sidan' : ''}. Skruva fast luckfästet ovanpå luckan, ${b} mm från gångjärnet, så att fliken hänger ner vid luckans kant.` });
  steg.push({ titel: 'Koppla ihop och testa', delar: [],
    text: (direkt ? 'Skruva ihop armens ytterhål med flikens hål.' : trad ? 'Trä in trådens andra Z-böj i flikens hål.' : 'Skruva ihop länkstångens andra hål med flikens hål.') +
      ' Testa försiktigt med micro:bit: vrid servot långsamt från 0° och kontrollera att inget tar i.' });

  const eta = direkt ? 1 : trad ? 0.95 : 0.97;
  const Tservo = kgCmTillNm(sv.momentKgCm) * eta;
  const m = design.massa / 1000;
  const gfak = uppg.gravitation;
  let Tkrav = 0;
  for (let i = 0; i <= N; i++) {
    const p = tabell[i].phi;
    const dd = i === 0 ? (tabell[1].phi - tabell[0].phi) / (tabell[1].th - tabell[0].th)
      : (tabell[i].phi - tabell[i - 1].phi) / (tabell[i].th - tabell[i - 1].th);
    const Tlucka = m * G * (Lh / 2000) * Math.max(0, Math.cos(p)) * gfak + 0.005 + m * G * 0.002;
    Tkrav = Math.max(Tkrav, Tlucka * Math.abs(dd) * 1.3);
  }
  const SF = Tservo / Math.max(Tkrav, 1e-6);
  const rader = [
    { namn: 'Servots vridning', formel: 'θ', varde: `${design.vinkel}°` },
    { namn: 'Luckans öppning', formel: direkt ? 'φ = θ' : 'φ räknas ut från länkarnas längder', varde: `${fmt(phiMax / DEG, 0)}°` },
    { namn: 'Servots vridmoment', formel: `${sv.namn}: ${fmt(sv.momentKgCm, 1)} kg·cm${eta < 1 ? ` · verkningsgrad ${fmt(eta, 2)}` : ''}`, varde: `${fmt(Tservo, 3)} N·m` },
    { namn: 'Moment som behövs', formel: gfak ? 'm · g · (luckans längd / 2) · utväxling · 1,3' : 'friktion · 1,3 (dörren lyfts inte)', varde: `${fmt(Tkrav, 3)} N·m` },
    { namn: 'Säkerhetsmarginal', formel: 'tillgängligt / behövs', varde: `${fmt(SF, 1)}×` },
  ];
  if (!direkt) {
    rader.splice(2, 0, { namn: 'Utväxling (största)', formel: 'luckans vinkeländring / servots vinkeländring', varde: `${fmt(maxD, 2)}` });
    rader.splice(3, 0, { namn: 'Länkstång', formel: trad ? 'pianotråd, längre än 80 mm' : 'utskriven', varde: `${L} mm` });
  }

  const kontroller = [];
  if (sv.typ === 360) kontroller.push({ niva: 'fel', text: 'Ett 360°-servo vet inte vilken vinkel det står i och kan inte hålla luckan öppen i ett bestämt läge. Välj ett 180°-servo.' });
  if (!ok) kontroller.push({ niva: 'fel', text: 'Länkstången når inte hela vägen. Gör länkstången längre, servoarmen kortare eller minska servots vridning.' });
  if (!direkt && ok && minD < -0.05) kontroller.push({ niva: 'varning', text: 'Luckan går åt fel håll under en del av rörelsen. Minska servots vridning eller ändra armlängderna.' });
  if (!direkt && ok && maxD > 4) kontroller.push({ niva: 'varning', text: 'Mekanismen närmar sig ett låsläge (dödpunkt). Rörelsen kan bli ryckig – minska servots vridning.' });
  if (phiMax / DEG < 20 && ok) kontroller.push({ niva: 'varning', text: `Luckan öppnas bara ${fmt(phiMax / DEG, 0)}°. Gör hävarmen kortare eller servoarmen längre.` });
  if (phiMax / DEG > 170) kontroller.push({ niva: 'varning', text: 'Luckan öppnas mer än 170° och kan slå i stommen.' });
  if (trad) kontroller.push({ niva: 'info', text: `Länkstången är ${L} mm och görs av pianotråd Ø 1,5 mm. En utskriven stång längre än ${MAX_UTSKRIVEN_STANG} mm kan knäckas.` });
  kontroller.push(SF >= 2 ? { niva: 'ok', text: `Servot orkar (marginal ${fmt(SF, 1)}×).` }
    : SF >= 1.3 ? { niva: 'varning', text: `Servot orkar nätt och jämnt (marginal ${fmt(SF, 1)}×). ${direkt ? 'Prova hävarm med länkstång' : 'Gör servoarmen kortare eller hävarmen längre'}, eller välj servo B.` }
      : { niva: 'fel', text: `Servot är för svagt (marginal ${fmt(SF, 1)}×). ${direkt ? 'Välj hävarm med länkstång' : 'Gör servoarmen kortare och hävarmen längre'}, gör luckan lättare eller välj servo B.` });
  if (axel && !design.lasSkruv && SF < 2) kontroller.push({ niva: 'info', text: 'Marginalen är låg. Välj låsskruv (Avancerat) så att armen inte släpper från axeln.' });
  if (!direkt && armLen < 12.5 && !axel) kontroller.push({ niva: 'info', text: 'Servoarmen är kort: kontrollera att hålen passar ditt servohorn.' });

  const rot = new THREE.Matrix4();
  if (uppg.id === 'dorr') rot.makeRotationX(-Math.PI / 2);

  const mattlinjer = [];
  if (!direkt) {
    const P0 = new THREE.Vector2(S.x + a * Math.cos(th0), S.y + a * Math.sin(th0));
    mattlinjer.push({ a: [P0.x - 8, P0.y, stangZ + 1.5], b: [Q0.x - 8, Q0.y, stangZ + 1.5], text: `Länkstång ${L} mm` });
  }

  return {
    delar, pose, leder, steg, rot, mattlinjer,
    berakning: { rader, kontroller, SF, slag: phiMax / DEG, slagText: `${fmt(phiMax / DEG, 0)}° öppning`, eta },
    kameraRiktning: [0.55, 0.42, -0.75],
  };
}

// ---------- Kuggstång med drev ----------
function byggKugg(design, uppg) {
  const sv = SERVOS[design.servo];
  const c = design.spel;
  const v2 = design.v >= 2;
  const kont = sv.typ === 360;
  const m = design.m, z = design.z;
  const F = 6, yb = 8, tw = 2.4;
  const gp = gearParams(m, z);
  const rp = gp.rp;
  const thetaMax = kont ? design.varv * 2 * Math.PI : design.vinkel * DEG;
  const slag = rp * thetaMax;
  const Lr = Math.ceil(slag + gp.d + 16);
  const Lrail = Math.ceil(Lr + slag);
  const rk = rackShape(m, Lr, yb);
  const yc = rk.yp + rp + 0.1;
  const zh = -F / 2;
  const { zMont, axel } = montering(sv, design);
  const zs = zh - zMont;
  const zFram = F / 2 + c + tw;
  const extra = kont ? 18 : 0;              // plats för ändlägesbrytare
  const delar = [];

  const xOnskat = -Lr / 2 - slag / 2;
  const kIdx = Math.min(rk.antalKuggar - 1, Math.max(0, Math.round((-xOnskat - rk.forstaKugge) / rk.delning)));
  const x0 = -(rk.forstaKugge + kIdx * rk.delning);
  const fas = -Math.PI / 2 - Math.PI / z;

  const a0 = sv.axelTillKortande, l = sv.kropp.l, bb = sv.kropp.b;
  const xc = l / 2 - a0;
  const oronY = [yc + xc - sv.halavstand / 2, yc + xc + sv.halavstand / 2];
  const hall = [];
  const zMitt = (zs - 3 + (-F / 2 - c - tw)) / 2;
  {
    const bas = rect(-Lrail / 2 - extra, zs - 3, Lrail / 2 + extra, zFram);
    slot(bas, -Lrail / 2 + 9, zMitt, 3, 1.7 + c / 2);
    slot(bas, Lrail / 2 - 9, zMitt, 3, 1.7 + c / 2);
    hall.push(plateXZ(bas, -3, 3));
    hall.push(box(-Lrail / 2, Lrail / 2, 0, yb - 1, -F / 2 - c - tw, -F / 2 - c));
    hall.push(box(-Lrail / 2, Lrail / 2, 0, 3, F / 2 + c, zFram));
    const p = rect(-15, 0, 15, oronY[1] + 5);
    rectHole(p, -bb / 2 - c - 0.3, yc - a0 - c - 0.3, bb / 2 + c + 0.3, yc + l - a0 + c + 0.3);
    for (const y of oronY) hole(p, 0, y, 0.9 + c / 2);
    hall.push(plateXY(p, zs - 3, 3));
  }
  delar.push({ id: 'hallare', namn: 'Kuggstångshållare med styrskena', kat: 'print', antal: 1, skal: hall, printRot: R_YUPP_TILL_ZUPP,
    matt: `${Lrail + 2 * extra} mm lång, spår ${fmt(F + 2 * c, 2)} mm`, sprang: [0, 0, 0],
    info: 'Styrskenan håller kuggstången på plats och i ingrepp. Servot sitter i den stående plattan. De avlånga hålen gör att du kan justera läget.' });
  const servoMat = matrisFran(0, yc, zs, Math.PI / 2);
  delar.push({ id: 'servo', namn: sv.namn, kat: 'kit', antal: 1, skal: [...servoSkal(sv), ...(axel ? [] : hornSkal(sv))], sprang: [0, 0, -45],
    matt: `${sv.kropp.l} × ${sv.kropp.b} mm`, info: kont ? 'Ett 360°-servo styrs med fart: 90 = stopp, över 90 = framåt, under 90 = bakåt.' : 'Ställ servot i startläge (0°) innan drevet sätts fast.' });
  let drevSkal;
  if (axel) {
    const form = (hal) => { const { shape } = gearShape(m, z); hal(shape); return shape; };
    drevSkal = axelLager(form, design.lasSkruv ? F - 1.2 : F, design, 0).skal;
  } else {
    const { shape: drevForm } = gearShape(m, z);
    hole(drevForm, 0, 0, 1.1 + c / 2);
    const hx = Math.min(8, gp.rf - 2.5);
    if (hx > 3.5) { hole(drevForm, hx, 0, 0.9 + c / 2); hole(drevForm, -hx, 0, 0.9 + c / 2); }
    drevSkal = [plateXY(drevForm, 0, F)];
  }
  delar.push({ id: 'drev', namn: 'Drev (kugghjul)', kat: 'print', antal: 1, skal: drevSkal, printRot: null,
    matt: `${z} kuggar, modul ${fmt(m, 2)}, Ø ${fmt(gp.d, 1)} mm${axel ? `, axelhål Ø ${fmt(design.axelHal, 2)} mm` : ''}`, sprang: [0, 0, 30],
    info: axel ? 'Trycks rakt på servoaxeln. Stöd servot med handen och tryck tills drevet tar stopp.' : 'Skruvas fast på servohornet. Kontrollera att hålen passar ditt horn.' });
  const kuggForm = rk.shape;
  hole(kuggForm, Lr * 0.25, yb * 0.6, 1.4);
  hole(kuggForm, Lr * 0.75, yb * 0.6, 1.4);
  delar.push({ id: 'kuggstang', namn: 'Kuggstång', kat: 'print', antal: 1, skal: [plateXY(kuggForm, -F / 2, F)], printRot: null,
    matt: `${Lr} mm, ${rk.antalKuggar} kuggar`, sprang: [0, 0, 55], info: 'Glider i styrskenan. Dörren skruvas fast i de två hålen.' });
  const objektNamn = uppg.id === 'hiss' ? 'Hisskorg (sida)' : 'Skjutdörr';
  delar.push({ id: 'dorr', namn: objektNamn, kat: 'self', antal: 1,
    skal: [box(Lr / 2 - design.Wd / 2, Lr / 2 + design.Wd / 2, yb * 0.6 - 4, yb * 0.6 - 4 + design.Hd, F / 2 + 0.3, F / 2 + 3.3)],
    matt: `${design.Wd} × ${design.Hd} × 3 mm`, sprang: [0, 0, 80], info: 'Bygg av kartong, plywood eller plast. Skruvas fast i kuggstångens hål.' });
  // Ändlägesbrytare för 360°-servo
  const brytarPos = [];
  if (kont) {
    const xV = x0 - 2, xH = x0 + slag + Lr + 2;
    const hs = rect(-9, 0, 9, 14);
    hole(hs, -4.75, 9, 1.0); hole(hs, 4.75, 9, 1.0);
    const hallGeo = plateYZ(hs, 0, 4);           // x 0..4 lokalt
    delar.push({ id: 'brytarhallare', namn: 'Hållare för ändlägesbrytare', kat: 'print', antal: 2, skal: [hallGeo], printRot: R_LAGG_X,
      matt: '4 × 18 × 14 mm, hål Ø 2 mm 9,5 mm isär', sprang: [0, 30, 0], info: 'En i varje ände. Mikrobrytaren skruvas på hållarens insida så att kuggstången trycker på den.' });
    delar.push({ id: 'brytare', namn: 'Mikrobrytare (ändlägesbrytare)', kat: 'kit', antal: 2, skal: [box(0, 6, 2, 12, -3, 3)],
      matt: 'liten mikrobrytare med arm', sprang: [0, 45, 0], info: 'Kopplas till micro:bit (t.ex. P1 och P2) och GND. Programmet stoppar servot när brytaren trycks.' });
    brytarPos.push(
      { h: matrisFran(xV - 6 - 4, 0, 0), b: matrisFran(xV - 6, 0, 0) },
      { h: matrisFran(xH + 6, 0, 0), b: matrisFran(xH, 0, 0) },
    );
  }
  const brada = [box(-Lrail / 2 - 20 - extra, Lrail / 2 + 20 + extra, -6, -3, zs - 15, zFram + 25)];
  delar.push({ id: 'stomme', namn: 'Exempelstomme', kat: 'visning', antal: 1, skal: brada,
    matt: 'bräda/platta i ditt bygge', sprang: [0, -30, 0], info: 'Visar var hållaren skruvas fast. Byggs inte enligt programmet.' });
  delar.push({ id: 'skruvM2', namn: 'Skruv M2 (servoskruv)', kat: 'kit', antal: 2 + (axel && design.lasSkruv ? 1 : 0) + (kont ? 4 : 0), ingenModell: true, matt: '6–10 mm',
    info: `2 st håller servot${axel && design.lasSkruv ? ', 1 st låser drevet' : ''}${kont ? ', 4 st håller brytarna' : ''}.` });
  delar.push({ id: 'skruvM3', namn: 'Skruv M3 eller träskruv 3 mm', kat: 'kit', antal: 4, ingenModell: true, matt: '8–12 mm', info: '2 st fäster hållaren, 2 st fäster dörren i kuggstången.' });

  const pose = (t) => {
    const th = Math.min(1, Math.max(0, t)) * thetaMax;
    const M = new Map();
    const I = new THREE.Matrix4();
    M.set('hallare', I); M.set('stomme', I);
    M.set('servo', servoMat);
    M.set('drev', matrisFran(0, yc, zh, fas + th));
    const km = matrisFran(x0 + rp * th, 0, 0);
    M.set('kuggstang', km); M.set('dorr', km);
    if (kont) { M.set('brytarhallare', brytarPos.map(p => p.h)); M.set('brytare', brytarPos.map(p => p.b)); }
    return M;
  };
  const xcS = sv.kropp.l / 2 - sv.axelTillKortande;
  const leder = [
    { a: 'servo', pa: [xcS - sv.halavstand / 2, 0, 0], b: 'hallare', pb: [0, oronY[0], zs] },
    { a: 'servo', pa: [xcS + sv.halavstand / 2, 0, 0], b: 'hallare', pb: [0, oronY[1], zs] },
    { a: 'servo', pa: [0, 0, zMont], b: 'drev', pb: [0, 0, 0] },
    { a: 'kuggstang', pa: [Lr * 0.25, yb * 0.6, F / 2], b: 'dorr', pb: [Lr * 0.25, yb * 0.6, F / 2 + 0.3] },
    { a: 'kuggstang', pa: [Lr * 0.75, yb * 0.6, F / 2], b: 'dorr', pb: [Lr * 0.75, yb * 0.6, F / 2 + 0.3] },
    { a: 'kuggstang', pa: [Lr / 2, 0, 0], b: 'hallare', pb: [x0 + Lr / 2, 0, 0] },
    { a: 'hallare', pa: [-Lrail / 2 + 9, -3, zMitt], b: 'stomme', pb: [-Lrail / 2 + 9, -3, zMitt] },
    { a: 'hallare', pa: [Lrail / 2 - 9, -3, zMitt], b: 'stomme', pb: [Lrail / 2 - 9, -3, zMitt] },
  ];
  const fastText = axel ? `Tryck drevet rakt på servoaxeln tills det tar stopp. Stöd servot med handen.${design.lasSkruv ? ' Lås med servons lilla skruv i mitten.' : ''}`
    : 'Sätt drevet på servohornet och skruva fast det med hornets skruvar.';
  const steg = [
    { titel: 'Skruva fast kuggstångshållaren', delar: ['hallare', 'skruvM3'],
      text: 'Lägg hållaren där dörren ska glida. Skruva fast den med två skruvar genom de avlånga hålen – dra inte åt helt ännu.' },
    { titel: 'Sätt i servot', delar: ['servo', 'skruvM2'],
      text: 'Tryck in servot bakifrån så att öronen ligger mot plattans framsida och axeln pekar mot skenan. Skruva fast med två servoskruvar.' + (kont ? '' : ' Kör servot till 0° med micro:bit.') },
    { titel: 'Sätt fast drevet', delar: ['drev'], text: fastText },
    { titel: 'Lägg i kuggstången', delar: ['kuggstang'],
      text: `Skjut in kuggstången i skenan från sidan så att kuggarna griper i drevet. ${kont ? 'Skjut den hela vägen åt vänster.' : `Vid 0° ska kuggstången sticka ut ungefär ${fmt(slag / 2 + 8, 0)} mm åt vänster.`} Den ska glida lätt – öka passningsspelet om den kärvar.` },
  ];
  if (kont) steg.push({ titel: 'Montera ändlägesbrytarna', delar: ['brytarhallare', 'brytare'],
    text: 'Skruva fast en brytarhållare i varje ände av skenan och skruva mikrobrytarna på hållarnas insida. Koppla brytarna till micro:bit, till exempel P1 och P2, och GND.' });
  steg.push({ titel: uppg.id === 'hiss' ? 'Fäst hisskorgen' : 'Fäst dörren', delar: ['dorr'],
    text: 'Skruva fast dörren eller korgen i kuggstångens två hål. Dra sedan åt hållarens skruvar.' });
  steg.push({ titel: 'Testa', delar: [],
    text: kont ? `Kör servot långsamt (t.ex. värdet 100) tills brytaren trycks och stoppa med 90. Dörren ska flyttas ${fmt(slag, 0)} mm (${fmt(design.varv, 2)} varv).`
      : `Kör servot långsamt från 0° till ${design.vinkel}°. Dörren ska flyttas ${fmt(slag, 0)} mm utan att kärva.` });

  const Tservo = kgCmTillNm(sv.momentKgCm);
  const massa = design.massa / 1000;
  const gfak = uppg.gravitation;
  const Fkrav = (massa * G * gfak + massa * G * 0.3 * (1 - gfak) + 0.3) * 1.3;
  const Tkrav = Fkrav * rp / 1000;
  const Fmax = Tservo / (rp / 1000);
  const SF = Tservo / Tkrav;
  const rader = [
    { namn: 'Drevets diameter', formel: `d = m · z = ${fmt(m, 2)} · ${z}`, varde: `${fmt(gp.d, 1)} mm` },
    kont ? { namn: 'Slaglängd', formel: `s = π · d · varv = π · ${fmt(gp.d, 1)} · ${fmt(design.varv, 2)}`, varde: `${fmt(slag, 1)} mm` }
      : { namn: 'Slaglängd', formel: `s = π · d · θ / 360 = π · ${fmt(gp.d, 1)} · ${design.vinkel} / 360`, varde: `${fmt(slag, 1)} mm` },
    { namn: 'Största dragkraft', formel: `F = T / r = ${fmt(Tservo, 3)} / ${fmt(rp / 1000, 4)}`, varde: `${fmt(Fmax, 1)} N` },
    { namn: 'Kraft som behövs', formel: gfak ? 'm · g · 1,3 (lyft)' : 'm · g · 0,3 · 1,3 (friktion)', varde: `${fmt(Fkrav, 1)} N` },
    { namn: 'Säkerhetsmarginal', formel: 'största kraft / kraft som behövs', varde: `${fmt(SF, 1)}×` },
  ];
  if (kont) {
    const v = Math.PI * gp.d * sv.varvPerMin / 60;
    rader.push({ namn: 'Tid för hela rörelsen', formel: `s / (π · d · ${sv.varvPerMin} varv/min / 60)`, varde: `ca ${fmt(slag / v, 1)} s` });
  }
  const kontroller = [];
  if (slag < design.Wd * 0.9 && uppg.id === 'skjut') kontroller.push({ niva: 'varning', text: `Dörren flyttas ${fmt(slag, 0)} mm men är ${design.Wd} mm bred. Öppningen blir bara delvis fri – öka slaglängden eller gör dörren smalare.` });
  if (m < 1.25) kontroller.push({ niva: 'info', text: 'Modul 1 ger små kuggar. Skriv ut med 0,4 mm munstycke och 0,12–0,16 mm lagerhöjd.' });
  if (kont) kontroller.push({ niva: 'info', text: '360°-servot vet inte var det står. Programmet på micro:bit måste stoppa servot när en ändlägesbrytare trycks (sluten styrning).' });
  if (axel && (gp.rf - design.axelHal / 2) < 3) kontroller.push({ niva: 'varning', text: 'Drevet har tunt gods runt axelhålet och kan spricka. Välj fler kuggar eller större modul.' });
  kontroller.push(SF >= 2 ? { niva: 'ok', text: `Servot orkar (marginal ${fmt(SF, 1)}×).` }
    : SF >= 1.3 ? { niva: 'varning', text: `Servot orkar nätt och jämnt (marginal ${fmt(SF, 1)}×). Välj färre kuggar eller servo B.` }
      : { niva: 'fel', text: `Servot är för svagt (marginal ${fmt(SF, 1)}×). Välj färre kuggar, lättare last eller servo B.` });
  if (axel && !design.lasSkruv && (SF < 2 || uppg.id === 'hiss')) kontroller.push({ niva: 'info', text: 'Välj låsskruv (Avancerat) så att drevet inte släpper från axeln.' });

  const rot = new THREE.Matrix4();
  if (uppg.id === 'hiss') rot.makeRotationZ(Math.PI / 2);
  const mattlinjer = [{ a: [x0, rk.yt + 8, 0], b: [x0 + slag, rk.yt + 8, 0], text: `Slaglängd ${fmt(slag, 1)} mm` }];
  return {
    delar, pose, leder, steg, rot, mattlinjer,
    berakning: { rader, kontroller, SF, slag, slagText: `${fmt(slag, 0)} mm slaglängd`, eta: 1 },
    kameraRiktning: [0.35, 0.45, 0.85],
  };
}

// ---------- Kalibreringsbit K01 ----------
export function kalibreringsbit(profil = 'rund') {
  const hal = [4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2];
  const skal = [];
  const form = (fas) => {
    const s = new THREE.Shape([
      new THREE.Vector2(3, 0), new THREE.Vector2(72, 0), new THREE.Vector2(72, 14),
      new THREE.Vector2(0, 14), new THREE.Vector2(0, 3),
    ]);
    hal.forEach((D, i) => { if (fas) polyHal(s, D + 0.6, 6 + i * 10, 7, 64); else axelHal(s, D, profil, 6 + i * 10, 7); });
    return s;
  };
  skal.push(plateXY(form(true), 0, 0.4));
  skal.push(plateXY(form(false), 0.4, 3.6));
  return { id: 'K01', nr: 'K01', namn: 'Kalibreringsbit för axelhål', kat: 'print', antal: 1, skal, printRot: null,
    matt: '72 × 14 × 4 mm, hål 4,6–5,2 mm', info: 'Hålen från det avfasade hörnet: 4,6 – 4,7 – 4,8 – 4,9 – 5,0 – 5,1 – 5,2 mm.', hal };
}

// ---------- Huvudfunktion ----------
export function bygg(designIn) {
  const design = begransa(designIn);
  const mal = losMal(design);
  const uppg = UPPGIFTER.find(u => u.id === design.uppgift) || UPPGIFTER[0];
  const res = design.mekanism === 'kuggstång' ? byggKugg(design, uppg) : byggSving(design, uppg);
  for (const v of mal.varningar) res.berakning.kontroller.unshift({ niva: 'varning', text: v });
  const visning = new Set(res.delar.filter(d => d.kat === 'visning').map(d => d.id));
  const ordning = [];
  for (const s of res.steg) for (const id of s.delar) if (!ordning.includes(id) && !visning.has(id)) ordning.push(id);
  for (const d of res.delar) if (!ordning.includes(d.id)) ordning.push(d.id);
  res.delar.sort((x, y) => ordning.indexOf(x.id) - ordning.indexOf(y.id));
  res.delar.forEach((d, i) => { d.nr = 'D' + String(i + 1).padStart(2, '0'); });
  // Visningsdelar i stegen visas men ritas in först i steg 1
  if (res.steg[0] && !res.steg[0].delar.includes('stomme')) res.steg[0].delar.unshift('stomme');
  res.design = design;
  res.mal = mal;
  res.uppgift = uppg;
  res.servo = SERVOS[design.servo];
  res.mekanismInfo = MEKANISMER[design.mekanism];
  return res;
}

export function forslag(uppgiftId, opt = {}) {
  const uppg = UPPGIFTER.find(u => u.id === uppgiftId);
  if (!uppg) return [];
  const lista = uppg.mekanismer.map((mekId) => {
    const r = bygg({ ...standardDesign(uppgiftId, mekId, opt) });
    const delar = r.delar.filter(d => d.kat === 'print').length;
    const fel = r.berakning.kontroller.some(k => k.niva === 'fel');
    const poang = (fel ? 0 : 1) * (0.5 * Math.min(r.berakning.SF, 4) / 4 + 0.3 * (1 / delar) + 0.2);
    return { mekId, info: MEKANISMER[mekId], SF: r.berakning.SF, delar, poang, slagText: r.berakning.slagText, fel };
  });
  lista.sort((a, b) => b.poang - a.poang);
  if (lista.length) lista[0].rekommenderad = true;
  return lista;
}
