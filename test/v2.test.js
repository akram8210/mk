// Tester för version 2: målstyrt läge, axelfäste, 360°-servo, länkstång, kompatibilitet.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { bygg, standardDesign, begransa, svingKinematik, kalibreringsbit } from '../src/mechanisms.js';
import { SERVOS } from '../src/catalog.js';
import { kontrolleraSkal } from '../src/stl.js';
import { delStl, utskriftsSkal, utskrivbaraDelar, designmotivering, kalibreringStl, layout } from '../src/export.js';

const kugg = (extra = {}) => bygg({ ...standardDesign('skjut', 'kuggstång'), ...extra });

test('AK-11: 50 mm vid 160° och modul 1,5 ger z = 24, d = 36 mm, s = 50,3 mm, θ = 159,2°', () => {
  const r = kugg({ malSlag: 50, vinkel: 160, m: 1.5 });
  assert.equal(r.design.z, 24);
  assert.ok(Math.abs(r.berakning.slag - 50.27) < 0.01);
  assert.ok(Math.abs(r.mal.thExakt - 159.15) < 0.05);
  assert.match(r.delar.find(d => d.id === 'drev').matt, /Ø 36,0 mm/);
});

test('AK-12: 50 mm vid 150° ger z = 26 och s = 51,1 mm', () => {
  const r = kugg({ malSlag: 50, vinkel: 150, m: 1.5 });
  assert.equal(r.design.z, 26);
  assert.ok(Math.abs(r.berakning.slag - 51.05) < 0.01);
});

test('AK-13: mål utom räckhåll ger z = 40 och en varning', () => {
  const r = kugg({ malSlag: 120, vinkel: 160, m: 1.5 });
  assert.equal(r.design.z, 40);
  assert.ok(r.berakning.kontroller.some(k => k.niva === 'varning' && /kan inte nås/.test(k.text)));
});

test('FK-MAL-01: valt z är det minsta som ger s ≥ mål (eller gränsvärdet)', () => {
  for (const m of [1, 1.25, 1.5]) for (let th = 90; th <= 160; th += 10) for (let S = 10; S <= 150; S += 5) {
    const r = kugg({ malSlag: S, vinkel: th, m });
    const z = r.design.z;
    const s = (zz) => Math.PI * m * zz * th / 360;
    if (z > 12 && z < 40) {
      assert.ok(s(z) >= S - 1e-9, `m=${m} θ=${th} S=${S}: s(${z}) < S`);
      assert.ok(s(z - 1) < S, `m=${m} θ=${th} S=${S}: ${z - 1} hade räckt`);
    }
    if (z === 40) assert.ok(s(40) <= S + 1e-9 || s(39) < S);
    if (z === 12) assert.ok(s(12) >= S - 1e-9);
  }
});

test('FK-MAL-07: hävarmens mål ger en hävarm vars öppning ligger nära målet', () => {
  for (const mal of [40, 60, 80, 100]) {
    const r = bygg({ ...standardDesign('lucka', 'hävarm'), malVinkel: mal });
    if (r.berakning.kontroller.some(k => /Närmaste möjliga/.test(k.text))) continue;
    assert.ok(Math.abs(r.berakning.slag - mal) <= 5, `mål ${mal}: fick ${r.berakning.slag}`);
  }
});

function radier(geom) {
  const p = geom.attributes.position.array;
  const r = [];
  for (let i = 0; i < p.length; i += 3) { const rr = Math.hypot(p[i], p[i + 1]); if (rr < 3.2) r.push(rr); }
  return r;
}

test('FK-AXL-01/02: axelhålet följer inställt mått inom 0,01 mm och påverkas inte av passningsspelet', () => {
  for (const D of [4.6, 4.9, 5.2]) for (const spel of [0.1, 0.3, 0.6]) {
    const r = kugg({ axelHal: D, spel });
    const huvud = r.delar.find(d => d.id === 'drev').skal[1];
    const rr = radier(huvud);
    const max = Math.max(...rr), min = Math.min(...rr);
    assert.ok(Math.abs(max - D / 2) < 0.005, `D=${D} spel=${spel}: max ${max}`);
    assert.ok(Math.abs(min * Math.cos(Math.PI / 64) * 2 - D) < 0.02);
    assert.ok(D / 2 - max * Math.cos(Math.PI / 64) < 0.01, 'inskriven diameter');
  }
});

test('Krossribbor: innerdiameter D − 0,3 och grundhål D + 0,3', () => {
  const r = kugg({ axelHal: 4.9, halProfil: 'ribbor' });
  const rr = radier(r.delar.find(d => d.id === 'drev').skal[1]);
  assert.ok(Math.abs(Math.min(...rr) * 2 - 4.6) < 0.01);
  assert.ok(Math.abs(Math.max(...rr) * 2 - 5.2) < 0.01);
});

test('AK-14: axelhålet avrundas till steg om 0,05 och begränsas till 4,6–5,2', () => {
  assert.equal(begransa({ ...standardDesign('skjut', 'kuggstång'), axelHal: 4.73 }).axelHal, 4.75);
  assert.equal(begransa({ ...standardDesign('skjut', 'kuggstång'), axelHal: 5.4 }).axelHal, 5.2);
  assert.equal(begransa({ ...standardDesign('skjut', 'kuggstång'), axelHal: 4.0 }).axelHal, 4.6);
});

test('AK-15: skrivarprofilens mått används för nya delar', () => {
  const r = bygg(standardDesign('skjut', 'kuggstång', { axelHal: 4.8 }));
  assert.match(r.delar.find(d => d.id === 'drev').matt, /axelhål Ø 4,80 mm/);
});

test('FK-AXL-03: delar för axeln skrivs ut med hålet lodrätt och ett nav på minst 4 mm', () => {
  for (const [u, m, id] of [['lucka', 'servoarm', 'arm'], ['lucka', 'hävarm', 'arm'], ['skjut', 'kuggstång', 'drev']]) {
    const r = bygg(standardDesign(u, m));
    const del = r.delar.find(d => d.id === id);
    assert.equal(del.printRot, null);
    assert.ok(utskriftsSkal(del).h >= 4.4, `${id} navhöjd`);
  }
});

test('Låsskruv lägger till ett lock och en skruv', () => {
  const utan = kugg(), med = kugg({ lasSkruv: true });
  assert.equal(med.delar.find(d => d.id === 'drev').skal.length, utan.delar.find(d => d.id === 'drev').skal.length + 1);
  assert.equal(med.delar.find(d => d.id === 'skruvM2').antal, utan.delar.find(d => d.id === 'skruvM2').antal + 1);
});

test('FK-AXL-06: delen på axeln sitter 0,5 mm ovanför servons kupol', () => {
  const r = kugg();
  const sv = SERVOS[r.design.servo];
  const servoMat = r.pose(0).get('servo'), drevMat = r.pose(0).get('drev');
  const kupolTopp = new THREE.Vector3(0, 0, sv.overOron + sv.kupol).applyMatrix4(servoMat).z;
  const drevBotten = new THREE.Vector3(0, 0, 0).applyMatrix4(drevMat).z;
  assert.ok(Math.abs(drevBotten - kupolTopp - 0.5) < 1e-6);
});

test('FK-FOR-01/02: länkstång längre än 80 mm blir pianotråd, kinematiken håller och marginalen räknas om', () => {
  const r = bygg({ ...standardDesign('lucka', 'hävarm'), L: 150 });
  const stang = r.delar.find(d => d.id === 'stang');
  assert.equal(stang.kat, 'kit');
  assert.ok(r.delar.some(d => d.id === 'bojmall' && d.kat === 'print'));
  assert.equal(r.berakning.eta, 0.95);
  const d = r.design;
  for (let i = 0; i <= 10; i++) {
    const M = r.pose(i / 10);
    const P = new THREE.Vector3(d.a, 0, 3).applyMatrix4(M.get('arm'));
    const Q = new THREE.Vector3(d.b, -10, -3).applyMatrix4(M.get('luckfaste'));
    assert.ok(Math.abs(Math.hypot(Q.x - P.x, Q.y - P.y) - 150) < 0.1);
  }
  const kort = bygg({ ...standardDesign('lucka', 'hävarm'), L: 60 });
  assert.equal(kort.delar.find(x => x.id === 'stang').kat, 'print');
});

test('FK-SRV-02: 360°-servo räknar i varv och får ändlägesbrytare', () => {
  const r = kugg({ servo: 'A360', lage: 'fri', z: 20, varv: 2 });
  assert.ok(Math.abs(r.berakning.slag - Math.PI * 30 * 2) < 1e-6);
  assert.equal(r.delar.find(d => d.id === 'brytarhallare').antal, 2);
  assert.equal(r.delar.find(d => d.id === 'brytare').kat, 'kit');
  assert.equal(r.pose(0.5).get('brytare').length, 2);
  const mal = kugg({ servo: 'A360', malSlag: 120, z: 20 });
  assert.ok(Math.abs(mal.design.varv - 120 / (Math.PI * 30)) < 0.001);
});

test('FK-SRV-03: 360°-servo till lucka ger en röd kontroll', () => {
  const r = bygg({ ...standardDesign('lucka', 'servoarm'), servo: 'A360' });
  assert.ok(r.berakning.kontroller.some(k => k.niva === 'fel' && /360°/.test(k.text)));
});

test('Alla skal är slutna i version 2-varianter', () => {
  const komb = [['lucka', 'servoarm'], ['lucka', 'hävarm'], ['dorr', 'hävarm'], ['skjut', 'kuggstång'], ['hiss', 'kuggstång']];
  for (const [u, m] of komb) for (const servo of ['A180', 'B180', 'A360', 'B360']) for (const extra of [{}, { lasSkruv: true }, { halProfil: 'ribbor' }, { fasteTyp: 'horn' }, { L: 250 }, { axelHal: 5.2, z: 12, m: 1 }]) {
    const r = bygg({ ...standardDesign(u, m, { servo }), ...extra });
    for (const del of r.delar.filter(d => !d.ingenModell)) for (const g of del.skal) {
      const k = kontrolleraSkal(g);
      assert.ok(k.slutet && k.volym > 0, `${u}/${m}/${servo} ${JSON.stringify(extra)} ${del.namn}`);
    }
  }
});

test('Kalibreringsbit K01: sju hål 4,6–5,2 mm, slutna skal, 4 mm hög', () => {
  const k = kalibreringsbit();
  assert.deepEqual(k.hal, [4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2]);
  for (const g of k.skal) assert.ok(kontrolleraSkal(g).slutet);
  assert.ok(Math.abs(utskriftsSkal(k).h - 4) < 1e-6);
  const f = kalibreringStl();
  assert.match(f.namn, /^K01_/);
});

test('AK-17: designer från version 1 ger samma STL som i version 1', () => {
  const golden = JSON.parse(readFileSync(new URL('./golden-v1.json', import.meta.url)));
  for (const g of golden) {
    const r = bygg(JSON.parse(JSON.stringify(g.design)));
    assert.equal(r.design.fasteTyp, 'horn');
    const filer = {};
    for (const del of utskrivbaraDelar(r)) { const f = delStl(del); filer[f.namn] = createHash('sha256').update(f.data).digest('hex'); }
    assert.deepEqual(filer, g.filer);
  }
});

test('Designmotivering innehåller mål, gissning, val och beräkningar', () => {
  const r = kugg({ malSlag: 50, gissning: 'stor' });
  const t = designmotivering(r, { valde: 'kuggstång', niva: 'van' });
  assert.match(t, /ska flyttas 50 mm/);
  assert.match(t, /Jag gissade på ett \*\*stor\*\*/);
  assert.match(t, /Jag valde kuggstång/);
  assert.match(t, /Säkerhetsmarginal/);
});

test('FK-PLA-01: alla standarddesigner ryms på Creality K1C', () => {
  for (const [u, m] of [['lucka', 'servoarm'], ['lucka', 'hävarm'], ['skjut', 'kuggstång'], ['hiss', 'kuggstång']]) {
    const lay = layout(bygg(standardDesign(u, m)), { x: 220, y: 220, z: 250 });
    assert.equal(lay.forStora.length, 0);
    assert.equal(lay.plattor.length, 1);
  }
});

test('IFK: en ombyggnad tar under 1 s', () => {
  const t0 = performance.now();
  bygg({ ...standardDesign('lucka', 'hävarm'), malVinkel: 85, L: 200 });
  bygg({ ...standardDesign('skjut', 'kuggstång'), malSlag: 140, servo: 'A360' });
  assert.ok(performance.now() - t0 < 1000);
});
