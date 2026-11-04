// Geometrihjälp: 2D-former som extruderas till slutna kroppar (skal).
// Alla mått i millimeter. Varje del byggs av ett eller flera slutna skal.
import * as THREE from 'three';

const SEG = 28;

export function rect(x0, y0, x1, y1) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  return s;
}

// Avlång form längs x från x0 till x1 med rundade ändar (radie r), centrerad på y = cy.
export function stadium(x0, x1, r, cy = 0) {
  const s = new THREE.Shape();
  s.moveTo(x0, cy - r);
  s.lineTo(x1, cy - r);
  s.absarc(x1, cy, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(x0, cy + r);
  s.absarc(x0, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

export function hole(shape, cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  shape.holes.push(p);
  return shape;
}

// Avlångt hål (för justering) längs x.
export function slot(shape, cx, cy, len, r) {
  const p = new THREE.Path();
  const a = cx - len / 2, b = cx + len / 2;
  p.moveTo(a, cy - r);
  p.lineTo(b, cy - r);
  p.absarc(b, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(a, cy + r);
  p.absarc(a, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  shape.holes.push(p);
  return shape;
}

export function rectHole(shape, x0, y0, x1, y1) {
  const p = new THREE.Path();
  p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.closePath();
  shape.holes.push(p);
  return shape;
}

function extrude(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: SEG, steps: 1 });
  return g;
}

// Platta i XY-planet, från z0 till z0 + depth.
export function plateXY(shape, z0, depth) {
  const g = extrude(shape, depth);
  g.translate(0, 0, z0);
  return g;
}

// Liggande platta i XZ-planet. Formens (x, y) blir (x, z). Från y0 till y0 + t.
export function plateXZ(shape, y0, t) {
  const g = extrude(shape, t);
  g.rotateX(Math.PI / 2);          // (x, y, z) -> (x, -z, y)
  g.translate(0, y0 + t, 0);
  return g;
}

export function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function cylZ(cx, cy, r, z0, z1, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(cx, cy, (z0 + z1) / 2);
  return g;
}

// ---------- Kugghjul (evolventprofil) ----------
const inv = (a) => Math.tan(a) - a;

export function gearParams(m, z, alfaGrader = 20) {
  const alfa = alfaGrader * Math.PI / 180;
  const x = z < 17 ? Math.min(0.5, (17 - z) / 17) : 0;   // profilförskjutning mot underskärning
  const rp = m * z / 2;
  const rb = rp * Math.cos(alfa);
  const ra = rp + m * (1 + x);
  const rf = rp - m * (1.25 - x);
  return { m, z, alfa, x, rp, rb, ra, rf, d: 2 * rp };
}

export function gearShape(m, z) {
  const g = gearParams(m, z);
  const { alfa, x, rp, rb, ra, rf } = g;
  const s = m * (Math.PI / 2 + 2 * x * Math.tan(alfa));
  const psiP = s / (2 * rp);
  const psi = (r) => psiP + inv(alfa) - inv(Math.acos(Math.min(1, rb / r)));
  const r0 = Math.max(rb, rf + 1e-3);
  const tipHalf = Math.max(psi(ra), 0.02 / ra * m);
  const N = 8;
  const pts = [];
  const pol = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  const steg = (2 * Math.PI) / z;
  for (let i = 0; i < z; i++) {
    const c = i * steg;
    if (rf < r0) pts.push(pol(rf, c - psi(r0)));
    for (let k = 0; k <= N; k++) {
      const r = r0 + (ra - r0) * k / N;
      pts.push(pol(r, c - Math.max(psi(r), k === N ? tipHalf : 0)));
    }
    pts.push(pol(ra, c + tipHalf));
    for (let k = N - 1; k >= 0; k--) {
      const r = r0 + (ra - r0) * k / N;
      pts.push(pol(r, c + psi(r)));
    }
    if (rf < r0) pts.push(pol(rf, c + psi(r0)));
    // rotbåge till nästa kugge
    const a0 = c + psi(r0), a1 = c + steg - psi(r0);
    for (let k = 1; k < 4; k++) pts.push(pol(rf, a0 + (a1 - a0) * k / 4));
  }
  return { shape: new THREE.Shape(pts), params: g };
}

// ---------- Kuggstång ----------
// Kuggarna uppåt, delningslinje på y = yp. Kroppen från y = 0 till rotlinjen.
export function rackShape(m, langd, rotHojd, alfaGrader = 20) {
  const alfa = alfaGrader * Math.PI / 180;
  const p = Math.PI * m;
  const yr = rotHojd;
  const yp = yr + 1.25 * m;
  const yt = yp + m;
  const wt = p / 4 - m * Math.tan(alfa);
  const wr = p / 4 + 1.25 * m * Math.tan(alfa);
  const n = Math.max(1, Math.floor((langd - 2 * wr - 1) / p) + 1);
  const anvand = (n - 1) * p + 2 * wr;
  const start = (langd - anvand) / 2 + wr;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(langd, 0), new THREE.Vector2(langd, yr)];
  for (let k = n - 1; k >= 0; k--) {
    const cx = start + k * p;
    pts.push(new THREE.Vector2(cx + wr, yr));
    pts.push(new THREE.Vector2(cx + wt, yt));
    pts.push(new THREE.Vector2(cx - wt, yt));
    pts.push(new THREE.Vector2(cx - wr, yr));
  }
  pts.push(new THREE.Vector2(0, yr));
  return { shape: new THREE.Shape(pts), yp, yt, yr, antalKuggar: n, delning: p, forstaKugge: start };
}

// ---------- Axelhål för montering direkt på servoaxeln ----------
// Rund profil: 64 segment. Krossribbor: grundhål D + 0,3 med 8 ribbor ner till D − 0,3.
export function axelHalPunkter(D, profil = 'rund', cx = 0, cy = 0) {
  const pts = [];
  if (profil === 'ribbor') {
    const N = 192, R = (D + 0.3) / 2, ribba = 0.3;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const c = Math.cos(8 * a);
      const bump = Math.max(0, (c - 0.6) / 0.4);
      const r = R - ribba * Math.sqrt(bump);
      pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  } else {
    const N = 64, R = D / 2;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector2(cx + R * Math.cos(a), cy + R * Math.sin(a)));
    }
  }
  return pts;
}

export function axelHal(shape, D, profil = 'rund', cx = 0, cy = 0) {
  shape.holes.push(new THREE.Path(axelHalPunkter(D, profil, cx, cy)));
  return shape;
}

export function polyHal(shape, D, cx = 0, cy = 0, N = 48) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector2(cx + D / 2 * Math.cos(a), cy + D / 2 * Math.sin(a)));
  }
  shape.holes.push(new THREE.Path(pts));
  return shape;
}

export function cirkel(r, cx = 0, cy = 0, N = 48) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return new THREE.Shape(pts);
}

// Platta i YZ-planet. Formens (u, v) blir (z, y). Från x0 till x0 + t.
export function plateYZ(shape, x0, t) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 28, steps: 1 });
  g.rotateY(-Math.PI / 2);         // (x, y, z) -> (-z, y, x)
  g.translate(x0 + t, 0, 0);
  return g;
}

export function cylX(x0, x1, cy, cz, r, seg = 16) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, cy, cz);
  return g;
}
