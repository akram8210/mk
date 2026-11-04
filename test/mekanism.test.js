// Enhetstester: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bygg, standardDesign, PARAMETRAR, GEMENSAMMA, forslag } from '../src/mechanisms.js';
import { UPPGIFTER } from '../src/catalog.js';
import { kontrolleraSkal, stlBinar, lasStl, trianglar } from '../src/stl.js';
import { layout, plattGeometrier, delStl, samladStl, zipPaket, utskrivbaraDelar, utskriftsSkal } from '../src/export.js';
import { crc32 } from '../src/zip.js';
import { gearParams } from '../src/geom.js';

const KOMBINATIONER = UPPGIFTER.flatMap(u => u.mekanismer.map(m => [u.id, m]));
const PLATTA = { x: 220, y: 220, z: 250 };

function varianter(uppg, mek) {
  const bas = standardDesign(uppg, mek);
  const ut = [bas];
  for (const p of [...PARAMETRAR[mek], ...GEMENSAMMA]) {
    ut.push({ ...bas, [p.id]: p.min });
    ut.push({ ...bas, [p.id]: p.max });
  }
  ut.push({ ...bas, servo: 'MG90S' });
  return ut;
}

test('FK-MEK-01: alla mekanismer i version 1 finns för minst en uppgift', () => {
  const alla = new Set(KOMBINATIONER.map(k => k[1]));
  for (const m of ['servoarm', 'hävarm', 'kuggstång']) assert.ok(alla.has(m), m);
});

test('FK-UPP-02: varje aktiv uppgift ger minst ett förslag, rangordnat med ett rekommenderat', () => {
  for (const u of UPPGIFTER.filter(x => !x.inaktiv)) {
    const f = forslag(u.id);
    assert.ok(f.length >= 1, u.id);
    assert.equal(f.filter(x => x.rekommenderad).length, 1);
  }
});

test('STL-validitet: varje skal i varje utskrivbar del är slutet med positiv volym (även vid gränsvärden)', () => {
  for (const [u, m] of KOMBINATIONER) {
    for (const d of varianter(u, m)) {
      const r = bygg(d);
      for (const del of r.delar.filter(x => !x.ingenModell)) {
        for (const g of del.skal) {
          const k = kontrolleraSkal(g);
          assert.ok(k.slutet, `${u}/${m} ${del.nr} ${del.namn}: öppna kanter ${k.oppnaKanter}, dubbla ${k.dubbla} (${JSON.stringify(d)})`);
          assert.ok(k.volym > 0, `${del.namn} har negativ volym`);
        }
      }
    }
  }
});

test('FK-MON-02: delnummer är unika och desamma i steg, dellista och filnamn', () => {
  for (const [u, m] of KOMBINATIONER) {
    const r = bygg(standardDesign(u, m));
    const nr = r.delar.map(d => d.nr);
    assert.equal(new Set(nr).size, nr.length);
    const ids = new Set(r.delar.map(d => d.id));
    for (const s of r.steg) for (const id of s.delar) assert.ok(ids.has(id), `steg refererar okänd del ${id}`);
    for (const del of utskrivbaraDelar(r)) assert.ok(delStl(del).namn.startsWith(del.nr + '_'));
  }
});

test('FK-MAT-01: alla delar har en av fyra kategorier, servo ligger i materiallådan', () => {
  for (const [u, m] of KOMBINATIONER) {
    const r = bygg(standardDesign(u, m));
    for (const d of r.delar) assert.ok(['print', 'kit', 'self', 'visning'].includes(d.kat));
    assert.equal(r.delar.find(d => d.id === 'servo').kat, 'kit');
  }
});

test('FK-MEK-03: kuggstångens slaglängd = π · d · θ / 360', () => {
  const d = { ...standardDesign('skjut', 'kuggstång'), lage: 'fri', m: 1.5, z: 20, vinkel: 160 };
  const r = bygg(d);
  const vantat = Math.PI * 30 * 160 / 360;
  assert.ok(Math.abs(r.berakning.slag - vantat) < 1e-6);
  // Kuggstången flyttas lika mycket i animationen
  const a = new THREE.Vector3().setFromMatrixPosition(r.pose(0).get('kuggstang'));
  const b = new THREE.Vector3().setFromMatrixPosition(r.pose(1).get('kuggstang'));
  assert.ok(Math.abs(b.x - a.x - vantat) < 1e-6);
});

test('Servoarm (direkt): luckan öppnas lika många grader som servot vrider', () => {
  const r = bygg({ ...standardDesign('lucka', 'servoarm'), vinkel: 90 });
  assert.ok(Math.abs(r.berakning.slag - 90) < 1e-6);
});

test('Hävarm: länkstångens längd hålls konstant genom hela rörelsen (kinematiken stämmer)', () => {
  const r = bygg(standardDesign('lucka', 'hävarm'));
  const d = r.design;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const M = r.pose(t);
    const P = new THREE.Vector3(d.a, 0, 3).applyMatrix4(M.get('arm'));
    const Q = new THREE.Vector3(d.b, -10, -3).applyMatrix4(M.get('luckfaste'));
    assert.ok(Math.abs(Math.hypot(Q.x - P.x, Q.y - P.y) - d.L) < 0.05, `t=${t}`);
  }
  assert.ok(r.berakning.slag > 20, 'luckan ska öppnas märkbart med standardmåtten');
});

test('FK-MEK-04: varning när servot är för svagt', () => {
  const r = bygg({ ...standardDesign('lucka', 'servoarm'), massa: 300, Lh: 200 });
  assert.ok(r.berakning.kontroller.some(k => k.niva === 'fel' && /för svagt/.test(k.text)));
});

test('AK-2: ökat passningsspel 0,3 → 0,5 mm gör spåret 0,4 mm bredare', () => {
  const bas = standardDesign('skjut', 'kuggstång');
  const bredd = (spel) => {
    const r = bygg({ ...bas, spel });
    const h = r.delar.find(d => d.id === 'hallare');
    // skal 1 = bakre vägg, skal 2 = främre vägg
    const [bak, fram] = [h.skal[1], h.skal[2]].map(g => { g.computeBoundingBox(); return g.boundingBox; });
    return fram.min.z - bak.max.z;
  };
  assert.ok(Math.abs(bredd(0.5) - bredd(0.3) - 0.4) < 1e-6);
});

test('Drev: profilförskjutning används under 17 kuggar och drevet ryms över skenan', () => {
  assert.equal(gearParams(1.5, 20).x, 0);
  assert.ok(gearParams(1.5, 12).x > 0);
});

test('AK-3: samlad STL innehåller rätt antal kroppar, inga köpta delar och inga överlapp', () => {
  for (const [u, m] of KOMBINATIONER) {
    const r = bygg(standardDesign(u, m));
    const lay = layout(r, PLATTA);
    const antalObjekt = lay.plattor.reduce((s, p) => s + p.objekt.length, 0);
    const vantat = utskrivbaraDelar(r).reduce((s, d) => s + d.antal, 0);
    assert.equal(antalObjekt, vantat);
    for (const p of lay.plattor) {
      assert.ok(p.objekt.every(o => r.delar.find(d => d.id === o.id).kat === 'print'));
      const boxar = plattGeometrier(p).map(o => {
        const bb = new THREE.Box3();
        for (const g of o.geoms) { g.computeBoundingBox(); bb.union(g.boundingBox); }
        return bb;
      });
      for (let i = 0; i < boxar.length; i++) {
        assert.ok(boxar[i].min.x >= 4.999 && boxar[i].min.y >= 4.999, 'marginal till kanten');
        assert.ok(boxar[i].max.x <= PLATTA.x - 4.999 && boxar[i].max.y <= PLATTA.y - 4.999, 'inom plattan');
        assert.ok(Math.abs(boxar[i].min.z) < 1e-6, 'ligger på plattan');
        for (let j = i + 1; j < boxar.length; j++) {
          const a = boxar[i].clone().expandByScalar(2.4999);
          assert.ok(!a.intersectsBox(boxar[j].clone().expandByScalar(2.4999)), `överlapp ${i}/${j}`);
        }
      }
    }
    // Triangelantal i samlad fil = summan av delarnas
    const s = samladStl(r, PLATTA);
    const tri = s.filer.reduce((acc, f) => acc + lasStl(f.data).length, 0);
    const vantatTri = utskrivbaraDelar(r).reduce((acc, d) => acc + d.antal * trianglar(utskriftsSkal(d).geoms).length, 0);
    assert.equal(tri, vantatTri);
  }
});

test('AK-4: för liten byggplatta ger flera plattor eller markerar för stor del', () => {
  const r = bygg({ ...standardDesign('skjut', 'kuggstång'), z: 30 });
  const liten = layout(r, { x: 120, y: 120, z: 120 });
  assert.ok(liten.forStora.length > 0 || liten.plattor.length > 1);
  const r2 = bygg(standardDesign('lucka', 'hävarm'));
  const l2 = layout(r2, { x: 60, y: 60, z: 60 });
  assert.ok(l2.plattor.length > 1, 'delarna ska fördelas på flera plattor');
});

test('Utskriftsorientering: alla utskrivbara delar ligger på z = 0', () => {
  for (const [u, m] of KOMBINATIONER) {
    const r = bygg(standardDesign(u, m));
    for (const d of utskrivbaraDelar(r)) {
      const s = utskriftsSkal(d);
      assert.ok(s.h > 0 && s.h < 80, `${d.namn} höjd ${s.h}`);
    }
  }
});

test('STL: binärfil har rätt storlek och kan läsas tillbaka', () => {
  const r = bygg(standardDesign('skjut', 'kuggstång'));
  const del = r.delar.find(d => d.id === 'drev');
  const f = delStl(del);
  const n = new DataView(f.data.buffer).getUint32(80, true);
  assert.equal(f.data.length, 84 + 50 * n);
  assert.equal(lasStl(f.data).length, n);
});

test('FK-STL-05: ZIP-paketet innehåller delar, samlad fil, stycklista och instruktion', () => {
  const r = bygg(standardDesign('lucka', 'hävarm'));
  const z = zipPaket(r, PLATTA);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const slut = z.length - 22;
  assert.equal(dv.getUint32(slut, true), 0x06054b50);
  const antal = dv.getUint16(slut + 10, true);
  assert.equal(antal, utskrivbaraDelar(r).length + 1 + 3 + (r.design.fasteTyp === 'axel' ? 1 : 0));
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('FK-ANV-02: ändrat mått slår igenom i både dellista och geometri', () => {
  const bas = standardDesign('lucka', 'hävarm');
  const a = bygg({ ...bas, L: 40 }), b = bygg({ ...bas, L: 60 });
  assert.match(a.delar.find(d => d.id === 'stang').matt, /40/);
  assert.match(b.delar.find(d => d.id === 'stang').matt, /60/);
  const langd = (r) => utskriftsSkal(r.delar.find(d => d.id === 'stang')).w;
  assert.ok(Math.abs(langd(b) - langd(a) - 20) < 1e-6);
});

test('Gränser: värden utanför intervallen begränsas', () => {
  const r = bygg({ ...standardDesign('skjut', 'kuggstång'), lage: 'fri', z: 99, spel: 5, vinkel: 999 });
  assert.equal(r.design.z, 40);
  assert.equal(r.design.spel, 0.6);
  assert.equal(r.design.vinkel, 160);
});
