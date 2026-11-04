// Utskriftslayout: orientera, packa på byggplattor och skapa STL/ZIP.
import * as THREE from 'three';
import { stlBinar } from './stl.js';
import { skapaZip } from './zip.js';
import { KATEGORIER, NIVAER } from './catalog.js';
import { kalibreringsbit } from './mechanisms.js';

const MARGINAL = 5;   // till plattans kant
const MELLAN = 5;     // mellan delar

const filnamn = (s) => s.toLowerCase()
  .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// En dels skal i utskriftsläge: roterad och med botten på z = 0, centrerad i xy.
export function utskriftsSkal(del) {
  const geoms = del.skal.map(g => {
    const k = g.clone();
    if (del.printRot) k.applyMatrix4(del.printRot);
    return k;
  });
  const bb = new THREE.Box3();
  for (const g of geoms) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  for (const g of geoms) g.translate(-cx, -cy, -bb.min.z);
  return { geoms, w: bb.max.x - bb.min.x, d: bb.max.y - bb.min.y, h: bb.max.z - bb.min.z };
}

export function utskrivbaraDelar(modell) {
  return modell.delar.filter(d => d.kat === 'print' && !d.ingenModell);
}

// Hyllpackning (shelf) av rektanglar på en eller flera plattor.
export function packa(objekt, platta) {
  const bx = platta.x - 2 * MARGINAL, by = platta.y - 2 * MARGINAL;
  const forStora = [];
  const lista = [];
  for (const o of objekt) {
    let w = o.w, d = o.d, rot = false;
    if (d > w) { [w, d] = [d, w]; rot = true; }       // liggande
    if (w > bx && d <= bx && w <= by) { [w, d] = [d, w]; rot = !rot; }
    if (w > bx || d > by || o.h > platta.z) { forStora.push(o); continue; }
    lista.push({ ...o, w, d, rot });
  }
  lista.sort((a, b) => b.d - a.d || b.w - a.w);
  const plattor = [];
  for (const o of lista) {
    let placerad = false;
    for (const p of plattor) {
      for (const h of p.hyllor) {
        if (o.d <= h.d && h.x + o.w <= bx) {
          p.objekt.push({ ...o, x: h.x, y: h.y });
          h.x += o.w + MELLAN; placerad = true; break;
        }
      }
      if (placerad) break;
      if (p.yNasta + o.d <= by) {
        const h = { y: p.yNasta, d: o.d, x: o.w + MELLAN };
        p.hyllor.push(h);
        p.objekt.push({ ...o, x: 0, y: p.yNasta });
        p.yNasta += o.d + MELLAN; placerad = true; break;
      }
    }
    if (!placerad) {
      const p = { hyllor: [{ y: 0, d: o.d, x: o.w + MELLAN }], objekt: [{ ...o, x: 0, y: 0 }], yNasta: o.d + MELLAN };
      plattor.push(p);
    }
  }
  return {
    plattor: plattor.map(p => ({ objekt: p.objekt.map(({ geoms, ...r }) => ({ ...r, geoms })) })),
    forStora,
    marginal: MARGINAL,
  };
}

export function layout(modell, platta) {
  const objekt = [];
  for (const del of utskrivbaraDelar(modell)) {
    const u = utskriftsSkal(del);
    for (let i = 0; i < del.antal; i++) objekt.push({ id: del.id, nr: del.nr, namn: del.namn, kopia: i + 1, ...u });
  }
  return packa(objekt, platta);
}

// Varje objekt flyttas som en helhet (alla skal i en del tillsammans).
export function plattGeometrier(plattaLayout, marginal = MARGINAL) {
  const ut = [];
  for (const o of plattaLayout.objekt) {
    const kopior = o.geoms.map(g => { const k = g.clone(); if (o.rot) k.rotateZ(Math.PI / 2); return k; });
    const bb = new THREE.Box3();
    for (const k of kopior) { k.computeBoundingBox(); bb.union(k.boundingBox); }
    for (const k of kopior) k.translate(marginal + o.x - bb.min.x, marginal + o.y - bb.min.y, 0);
    ut.push({ id: o.id, nr: o.nr, geoms: kopior, box: { x0: marginal + o.x, y0: marginal + o.y, x1: marginal + o.x + o.w, y1: marginal + o.y + o.d } });
  }
  return ut;
}

export function delStl(del) {
  const u = utskriftsSkal(del);
  return {
    namn: `${del.nr}_${filnamn(del.namn)}_x${del.antal}.stl`,
    data: stlBinar(u.geoms, `${del.nr} ${del.namn}`),
  };
}

export function samladStl(modell, platta) {
  const lay = layout(modell, platta);
  const filer = lay.plattor.map((p, i) => ({
    namn: lay.plattor.length > 1 ? `samlad_platta_${i + 1}_av_${lay.plattor.length}.stl` : 'samlad_alla_delar.stl',
    data: stlBinar(plattGeometrier(p).flatMap(o => o.geoms), `Samlad platta ${i + 1}`),
  }));
  return { filer, layout: lay };
}

export function stycklistaCsv(modell) {
  const rader = ['Delnummer;Namn;Kategori;Antal;Mått'];
  for (const d of modell.delar) rader.push([d.nr, d.namn, KATEGORIER[d.kat].namn, d.antal, d.matt || ''].join(';'));
  return '﻿' + rader.join('\r\n');
}

export function lasmigText(modell, platta) {
  const d = modell.design;
  const rad = (s) => s + '\r\n';
  let t = rad('MEKANISMDESIGNERN – utskriftspaket') + rad('');
  t += rad(`Uppgift: ${modell.uppgift.namn}`);
  t += rad(`Mekanism: ${modell.mekanismInfo.namn}`);
  t += rad(`Servo: ${modell.servo ? modell.servo.namn : d.servo}`);
  t += rad(`Fäste: ${d.fasteTyp === 'axel' ? `direkt på servoaxeln, hål Ø ${d.axelHal} mm (${d.halProfil})${d.lasSkruv ? ', med låsskruv' : ''}` : 'via servohornet'}`);
  t += rad(`Passningsspel: ${d.spel} mm`);
  t += rad(`Byggplatta: ${platta.namn || platta.x + ' × ' + platta.y + ' mm'}`);
  t += rad(`Resultat: ${modell.berakning.slagText}, säkerhetsmarginal ${modell.berakning.SF.toFixed(1)}×`) + rad('');
  t += rad('Delar:');
  for (const del of modell.delar) t += rad(`  ${del.nr}  ${del.namn} × ${del.antal}  [${KATEGORIER[del.kat].namn}]  ${del.matt || ''}`);
  t += rad('') + rad('Monteringsordning:');
  modell.steg.forEach((s, i) => { t += rad(`  ${i + 1}. ${s.titel}: ${s.text}`); });
  t += rad('') + rad('Utskriftsråd: PLA, 0,2 mm lagerhöjd (0,12–0,16 mm för modul 1), 3 perimetrar, 20–30 % fyllnad, inget stödmaterial.');
  t += rad('Om delarna sitter för hårt: öka passningsspelet i programmet och skriv ut igen.');
  return t;
}

export function kalibreringStl(profil = 'rund') {
  const k = kalibreringsbit(profil);
  const u = utskriftsSkal(k);
  return { namn: 'K01_kalibreringsbit_axelhal.stl', data: stlBinar(u.geoms, 'K01 Kalibreringsbit'), del: k };
}

const rad = (s = '') => s + '\n';

// Designmotivering som Markdown – bilaga till den tekniska rapporten.
export function designmotivering(modell, info = {}) {
  const d = modell.design;
  let t = rad(`# Designmotivering – ${modell.uppgift.namn}`) + rad();
  if (info.namn) t += rad(`**Namn:** ${info.namn}`);
  t += rad(`**Datum:** ${new Date().toLocaleDateString('sv-SE')}`);
  const niva = NIVAER.find(n => n.id === info.niva);
  if (niva) t += rad(`**Nivå:** ${niva.namn}`);
  t += rad() + rad('## Mål och krav');
  if (d.lage === 'mal') {
    if (d.mekanism === 'kuggstång') t += rad(`- Dörren ska flyttas ${d.malSlag} mm.`);
    else if (d.mekanism === 'hävarm') t += rad(`- Luckan ska öppnas ${d.malVinkel}°.`);
    else t += rad(`- Luckan ska öppnas ${d.vinkel}°.`);
  }
  t += rad(`- Vikten som ska flyttas är ${d.massa} g.`);
  if (info.krav) t += rad(`- ${info.krav}`);
  if (d.gissning && modell.mal && modell.mal.gissKat) {
    t += rad() + rad('## Min gissning');
    t += rad(`Jag gissade på ett **${d.gissning}** ${d.mekanism === 'kuggstång' ? 'drev' : 'hävarm'}. Programmets svar blev **${modell.mal.gissKat}** (${modell.mal.forslag}).`);
  }
  if (info.jamforelse && info.jamforelse.length) {
    t += rad() + rad('## Lösningar jag jämförde') + rad('| Mekanism | Rörelse | Marginal | Utskrivna delar |') + rad('| --- | --- | --- | --- |');
    for (const f of info.jamforelse) t += rad(`| ${f.info.namn} | ${f.slagText} | ${f.SF.toFixed(1)}× | ${f.delar} |`);
  }
  t += rad() + rad('## Mitt val');
  t += rad(`- Mekanism: ${modell.mekanismInfo.namn} (${modell.mekanismInfo.maskiner})`);
  t += rad(`- Servo: ${modell.servo.namn}`);
  t += rad(`- Fäste på servot: ${d.fasteTyp === 'axel' ? `direkt på axeln, hål Ø ${d.axelHal} mm` : 'via servohornet'}`);
  t += rad(`- Resultat: ${modell.berakning.slagText}, säkerhetsmarginal ${modell.berakning.SF.toFixed(1)}×`);
  if (modell.mal && modell.mal.rader.length) {
    t += rad() + rad('## Uträkning');
    for (const r of modell.mal.rader) t += rad(`- ${r}`);
  }
  t += rad() + rad('## Beräkningar');
  for (const r of modell.berakning.rader) t += rad(`- ${r.namn}: ${r.varde} (${r.formel})`);
  t += rad() + rad('## Motivering');
  t += rad(`Jag valde ${info.valde || '…'} eftersom ${info.eftersom || '…'}`);
  t += rad() + rad(`Nackdelen är ${info.nackdel || '…'}`);
  t += rad() + rad('## Test och förbättring');
  t += rad(info.test || '(Fyll i efter att du har testat.)');
  t += rad() + rad('## Delar');
  for (const del of modell.delar) t += rad(`- ${del.nr} ${del.namn} × ${del.antal} (${KATEGORIER[del.kat].namn})`);
  return t;
}

export function zipPaket(modell, platta, extra = {}) {
  const filer = [];
  for (const del of utskrivbaraDelar(modell)) {
    const f = delStl(del);
    filer.push({ namn: 'delar/' + f.namn, data: f.data });
  }
  const s = samladStl(modell, platta);
  for (const f of s.filer) filer.push({ namn: f.namn, data: f.data });
  filer.push({ namn: 'stycklista.csv', data: stycklistaCsv(modell) });
  filer.push({ namn: 'LASMIG.txt', data: lasmigText(modell, platta) });
  filer.push({ namn: 'design.json', data: JSON.stringify(modell.design, null, 2) });
  if (modell.design.fasteTyp === 'axel') { const k = kalibreringStl(modell.design.halProfil); filer.push({ namn: 'kalibrering/' + k.namn, data: k.data }); }
  if (extra.motivering) filer.push({ namn: 'designmotivering.md', data: extra.motivering });
  return skapaZip(filer);
}
