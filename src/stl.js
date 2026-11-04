// STL-export (binär) och kontroll av att kropparna är slutna.
import * as THREE from 'three';

export function trianglar(geoms) {
  const ut = [];
  for (const g0 of geoms) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) ut.push(p.slice(i, i + 9));
  }
  return ut;
}

export function stlBinar(geoms, namn = 'mekanismdesignern') {
  const tri = trianglar(geoms);
  const buf = new ArrayBuffer(84 + tri.length * 50);
  const dv = new DataView(buf);
  const head = new TextEncoder().encode(namn.slice(0, 79));
  new Uint8Array(buf, 0, 80).set(head);
  dv.setUint32(80, tri.length, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let o = 84;
  for (const t of tri) {
    a.set(t[0], t[1], t[2]); b.set(t[3], t[4], t[5]); c.set(t[6], t[7], t[8]);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const v of [n.x, n.y, n.z, ...t]) { dv.setFloat32(o, v, true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

export function lasStl(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(80, true);
  const tri = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    const t = [];
    for (let k = 0; k < 9; k++) t.push(dv.getFloat32(o + k * 4, true));
    tri.push(t);
  }
  return tri;
}

// Kontrollera att ett skal är slutet och rätt orienterat:
// varje riktad kant ska förekomma exakt en gång och dess omvända exakt en gång.
export function kontrolleraSkal(geom) {
  const tri = trianglar([geom]);
  const nyckel = (x, y, z) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
  const idx = new Map();
  const id = (x, y, z) => { const k = nyckel(x, y, z); if (!idx.has(k)) idx.set(k, idx.size); return idx.get(k); };
  const kanter = new Map();
  let degenererade = 0, volym = 0;
  for (const t of tri) {
    const v = [id(t[0], t[1], t[2]), id(t[3], t[4], t[5]), id(t[6], t[7], t[8])];
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) { degenererade++; continue; }
    for (let i = 0; i < 3; i++) {
      const k = v[i] + '>' + v[(i + 1) % 3];
      kanter.set(k, (kanter.get(k) || 0) + 1);
    }
    volym += (t[0] * (t[4] * t[8] - t[5] * t[7]) - t[1] * (t[3] * t[8] - t[5] * t[6]) + t[2] * (t[3] * t[7] - t[4] * t[6])) / 6;
  }
  let oppnaKanter = 0, dubbla = 0;
  for (const [k, n] of kanter) {
    const [i, j] = k.split('>');
    if (n > 1) dubbla++;
    if (!kanter.has(j + '>' + i)) oppnaKanter++;
  }
  return { slutet: oppnaKanter === 0 && dubbla === 0, oppnaKanter, dubbla, degenererade, volym, trianglar: tri.length };
}
