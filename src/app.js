// Gränssnitt och 3D-vy för Mekanismdesignern (version 2).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SERVOS, PLATTOR, KATEGORIER, UPPGIFTER, MEKANISMER, NIVAER, SERVO_REDIGERBARA, tillampaServoMatt } from './catalog.js';
import { bygg, standardDesign, forslag, PARAMETRAR, GEMENSAMMA, AVANCERADE, VAL } from './mechanisms.js';
import { layout, delStl, samladStl, zipPaket, utskrivbaraDelar, stycklistaCsv, kalibreringStl, designmotivering } from './export.js';
import { stlBinar } from './stl.js';
import { skapaZip } from './zip.js';

const VERSION = '2.0.0';

// Nedladdning: i Claude-vyn går filer via plattformens "downloads"-funktion,
// annars via en vanlig nedladdningslänk (när filen öppnas lokalt).
let claudeDownloads = null;
const downloadsKlar = (async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') claudeDownloads = await window.claude.use('downloads');
  } catch { claudeDownloads = null; }
  return claudeDownloads;
})();

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...barn) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const b of barn.flat()) if (b != null && b !== false) e.append(b.nodeType ? b : document.createTextNode(String(b)));
  return e;
};
const fmt = (v, d = 1) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });

const STEG = [
  { id: 'uppgift', namn: 'Uppgift' },
  { id: 'mekanism', namn: 'Mekanism' },
  { id: 'matt', namn: 'Motor och mått' },
  { id: 'granska', namn: 'Granska' },
  { id: 'montera', namn: 'Montera' },
  { id: 'exportera', namn: 'Exportera' },
];

// ---------- Tillstånd ----------
const LAGRING = 'mekanismdesignern.v1';
let tillstand = {
  steg: 0, design: null, platta: '220', egenPlatta: { x: 200, y: 200, z: 200 },
  niva: null, profil: {}, servoMatt: {}, motivering: {},
};
try {
  const s = JSON.parse(localStorage.getItem(LAGRING) || 'null');
  if (s && typeof s === 'object') tillstand = { ...tillstand, ...s };
} catch { /* lagring saknas */ }
if (!PLATTOR.some(p => p.id === tillstand.platta) && tillstand.platta !== 'egen') tillstand.platta = '220';
tillampaServoMatt(tillstand.servoMatt);
const nivaFranHash = () => {
  const h = (location.hash || '').replace('#', '');
  return NIVAER.some(n => n.id === h) ? h : null;
};
if (nivaFranHash()) tillstand.niva = nivaFranHash();
window.addEventListener('hashchange', () => { if (nivaFranHash()) sattNiva(nivaFranHash()); });

const historik = [];
let modell = null;
const nivaNr = () => (NIVAER.find(n => n.id === tillstand.niva) || NIVAER[1]).nr;

function spara() {
  try { localStorage.setItem(LAGRING, JSON.stringify(tillstand)); } catch { /* ignoreras */ }
}

function andraDesign(ny, medHistorik = true) {
  if (medHistorik && tillstand.design) historik.push(JSON.stringify(tillstand.design));
  if (historik.length > 50) historik.shift();
  tillstand.design = ny;
  spara();
  byggOm();
}

function nyDesign(uppgift, mek, bas = {}) {
  const servo = bas.servo || 'A180';
  const d = standardDesign(uppgift, mek, { servo, axelHal: tillstand.profil[servo] });
  if (bas.spel) d.spel = bas.spel;
  if (nivaNr() === 1) d.lage = 'mal';
  return d;
}

function sattNiva(id) {
  tillstand.niva = id;
  if (tillstand.design && nivaNr() === 1 && tillstand.design.lage !== 'mal') tillstand.design = { ...tillstand.design, lage: 'mal' };
  spara();
  ritaNivaVal();
  if (tillstand.design) byggOm(); else ritaPanel();
}

// ---------- 3D ----------
const vy = $('#vy');
const litenSkarm = () => window.innerWidth < 600;
const pekskarm = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !pekskarm, alpha: true });
let lagKvalitet = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pekskarm ? 1.25 : 1.5));
vy.prepend(renderer.domElement);
const etikettRenderer = new CSS2DRenderer();
etikettRenderer.domElement.style.position = 'absolute';
etikettRenderer.domElement.style.top = '0';
etikettRenderer.domElement.style.pointerEvents = 'none';
vy.append(etikettRenderer.domElement);
const scen = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
kamera.position.set(180, 140, 260);
const kontroller = new OrbitControls(kamera, renderer.domElement);
kontroller.enableDamping = true;
kontroller.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
scen.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.6));
const sol = new THREE.DirectionalLight(0xffffff, 1.6);
sol.position.set(150, 300, 200);
scen.add(sol);
const sol2 = new THREE.DirectionalLight(0xffffff, 0.5);
sol2.position.set(-200, 80, -150);
scen.add(sol2);
let rot = new THREE.Group();
scen.add(rot);
let delGrupper = new Map();
let hjalplinjer = null;
let mattGrupp = null;
let markerad = null;

let vyLage = 'monterad';
let sprangFaktor = 1;
let monteringsSteg = 0;
let t = 0, riktning = 1, spelar = true;
let senaste = performance.now();

function material(kat) {
  const k = KATEGORIER[kat];
  const m = new THREE.MeshStandardMaterial({ color: k.farg, roughness: 0.6, metalness: kat === 'kit' ? 0.15 : 0 });
  if (kat === 'visning') { m.transparent = true; m.opacity = 0.28; m.depthWrite = false; }
  if (kat === 'self') { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; }
  return m;
}

function rensaScen() {
  rot.traverse((o) => {
    if (o.geometry && o.userData.egenGeometri) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    if (o.isCSS2DObject && o.element) o.element.remove();
  });
  scen.remove(rot);
  rot = new THREE.Group();
  scen.add(rot);
  delGrupper = new Map();
  hjalplinjer = null;
  mattGrupp = null;
}

function byggScen() {
  rensaScen();
  rot.matrixAutoUpdate = false;
  rot.matrix.copy(modell.rot);
  const pose0 = modell.pose(0);
  for (const del of modell.delar) {
    if (del.ingenModell) continue;
    const grupp = new THREE.Group();
    grupp.matrixAutoUpdate = false;
    const mat = material(del.kat);
    const kant = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: del.kat === 'visning' ? 0.15 : 0.35 });
    const kanter = del.skal.map(g => { const e = new THREE.EdgesGeometry(g, 30); return e; });
    const bb = new THREE.Box3();
    for (const g of del.skal) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    const p0 = pose0.get(del.id);
    const antalInst = Array.isArray(p0) ? p0.length : 1;
    const instanser = [];
    for (let i = 0; i < antalInst; i++) {
      const inst = new THREE.Group();
      inst.matrixAutoUpdate = false;
      del.skal.forEach((g, k) => {
        const mesh = new THREE.Mesh(g, mat);
        mesh.userData.delId = del.id;
        if (i === 0) mesh.userData.egenGeometri = true;
        inst.add(mesh);
        const ls = new THREE.LineSegments(kanter[k], kant);
        ls.userData.kantlinje = true;
        if (i === 0) ls.userData.egenGeometri = true;
        ls.visible = !lagKvalitet;
        inst.add(ls);
      });
      if (i === 0 && del.kat !== 'visning') {
        const e = el('div', { class: 'etikett' }, del.nr);
        e.style.background = KATEGORIER[del.kat].css;
        const lab = new CSS2DObject(e);
        lab.position.copy(bb.getCenter(new THREE.Vector3()));
        lab.userData.etikett = true;
        inst.add(lab);
      }
      grupp.add(inst);
      instanser.push(inst);
    }
    grupp.userData = { del, material: mat, instanser };
    rot.add(grupp);
    delGrupper.set(del.id, grupp);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(modell.leder.length * 6), 3));
  hjalplinjer = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: 0x1f2328, dashSize: 2.5, gapSize: 2, transparent: true, opacity: 0.7 }));
  hjalplinjer.frustumCulled = false;
  hjalplinjer.userData.egenGeometri = true;
  rot.add(hjalplinjer);
  // Måttlinjer (t.ex. länkstångens längd och slaglängd)
  mattGrupp = new THREE.Group();
  for (const m of modell.mattlinjer || []) {
    const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b);
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const linje = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8a4d14 }));
    linje.userData.egenGeometri = true;
    mattGrupp.add(linje);
    const e = el('div', { class: 'mattetikett' }, m.text);
    const lab = new CSS2DObject(e);
    lab.position.copy(a.clone().add(b).multiplyScalar(0.5));
    lab.userData.etikett = true;
    mattGrupp.add(lab);
  }
  rot.add(mattGrupp);
  uppdateraEtiketter();
}

function passaVy(behallRiktning = false) {
  uppdateraPoser();
  rot.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  for (const g of delGrupper.values()) if (g.visible) bb.expandByObject(g);
  if (bb.isEmpty()) return;
  const c = bb.getCenter(new THREE.Vector3());
  const r = bb.getSize(new THREE.Vector3()).length() / 2;
  const avst = r / Math.sin(THREE.MathUtils.degToRad(kamera.fov / 2)) * (litenSkarm() ? 1.05 : 0.95);
  const dir = behallRiktning ? kamera.position.clone().sub(kontroller.target).normalize()
    : new THREE.Vector3(...(modell.kameraRiktning || [0.55, 0.45, 0.85])).applyMatrix4(new THREE.Matrix4().extractRotation(modell.rot)).normalize();
  kontroller.target.copy(c);
  kamera.position.copy(c.clone().add(dir.multiplyScalar(avst)));
  kamera.near = Math.max(0.5, avst / 50); kamera.far = avst * 20;
  kamera.updateProjectionMatrix();
}

const synligaISteg = () => {
  const ids = new Set();
  modell.steg.slice(0, monteringsSteg + 1).forEach(s => s.delar.forEach(id => ids.add(id)));
  return ids;
};

const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function uppdateraPoser() {
  if (!modell) return;
  const tidNu = vyLage === 'monterad' ? t : 0;
  const poser = modell.pose(tidNu);
  const synliga = vyLage === 'steg' ? synligaISteg() : null;
  const aktuella = vyLage === 'steg' ? new Set(modell.steg[monteringsSteg].delar) : null;
  const stegFas = vyLage === 'steg' ? Math.max(0, 1 - Math.min(1, ((performance.now() / 1000) % 3.2) / 1.6)) : 0;
  const I = new THREE.Matrix4();
  for (const [id, grupp] of delGrupper) {
    const del = grupp.userData.del;
    const P = poser.get(id);
    const lista = Array.isArray(P) ? P : [P || I];
    let f = 0;
    if (vyLage === 'sprangd') f = sprangFaktor;
    if (vyLage === 'steg' && aktuella.has(id)) f = easeInOut(stegFas);
    const s = del.sprang || [0, 0, 0];
    grupp.matrix.makeTranslation(s[0] * f, s[1] * f, s[2] * f);
    grupp.matrixWorldNeedsUpdate = true;
    grupp.userData.instanser.forEach((inst, i) => { inst.matrix.copy(lista[i] || lista[0]); inst.matrixWorldNeedsUpdate = true; });
    grupp.userData.forsta = grupp.matrix.clone().multiply(lista[0]);
    grupp.visible = synliga ? (synliga.has(id) || del.kat === 'visning') : true;
    const hl = (markerad === id) || (aktuella && aktuella.has(id) && del.kat !== 'visning');
    grupp.userData.material.emissive.setHex(hl ? 0x553311 : 0x000000);
  }
  if (hjalplinjer) {
    const arr = hjalplinjer.geometry.attributes.position.array;
    const visa = (vyLage === 'sprangd' && sprangFaktor > 0.04) || vyLage === 'steg';
    let i = 0;
    for (const led of modell.leder) {
      const ga = delGrupper.get(led.a), gb = delGrupper.get(led.b);
      const ok = ga && gb && ga.visible && gb.visible && visa;
      const pa = ok ? new THREE.Vector3(...led.pa).applyMatrix4(ga.userData.forsta) : new THREE.Vector3();
      const pb = ok ? new THREE.Vector3(...led.pb).applyMatrix4(gb.userData.forsta) : new THREE.Vector3();
      arr.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i); i += 6;
    }
    hjalplinjer.geometry.attributes.position.needsUpdate = true;
    hjalplinjer.computeLineDistances();
    hjalplinjer.visible = visa;
  }
  if (mattGrupp) mattGrupp.visible = vyLage === 'monterad' && $('#visaNr').checked;
}

function uppdateraEtiketter() {
  const visa = $('#visaNr').checked;
  rot.traverse((o) => { if (o.userData && o.userData.etikett) o.visible = visa; });
}

function storlek() {
  const r = vy.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  etikettRenderer.setSize(r.width, r.height);
  kamera.aspect = r.width / Math.max(1, r.height);
  kamera.updateProjectionMatrix();
}
new ResizeObserver(storlek).observe(vy);

// Adaptiv kvalitet: sänk detaljnivån om enheten inte hinner med.
let ramTider = [];
function kontrolleraKvalitet(ms) {
  if (lagKvalitet) return;
  ramTider.push(ms);
  if (ramTider.length < 90) return;
  const snitt = ramTider.reduce((a, b) => a + b, 0) / ramTider.length;
  ramTider = [];
  if (snitt > 38) {
    lagKvalitet = true;
    renderer.setPixelRatio(1);
    rot.traverse((o) => { if (o.userData && o.userData.kantlinje) o.visible = false; });
    storlek();
  }
}

function loop(nu) {
  const ms = nu - senaste;
  const dt = Math.min(0.1, ms / 1000);
  senaste = nu;
  if (document.visibilityState === 'visible') kontrolleraKvalitet(ms);
  if (modell && spelar && vyLage === 'monterad') {
    const fart = Number($('#fart').value);
    t += riktning * dt * fart / 2.2;
    if (t >= 1) { t = 1; riktning = -1; }
    if (t <= 0) { t = 0; riktning = 1; }
    visaTid();
  }
  uppdateraPoser();
  kontroller.update();
  renderer.render(scen, kamera);
  etikettRenderer.render(scen, kamera);
  requestAnimationFrame(loop);
}

function visaTid() {
  $('#tid').value = Math.round(t * 1000);
  if (!modell) return;
  const d = modell.design;
  if (modell.servo.typ === 360 && d.mekanism === 'kuggstång') $('#vinkel').textContent = `${fmt(d.varv * t, 2)} varv`;
  else $('#vinkel').textContent = `Servo ${fmt(d.vinkel * t, 0)}°`;
}

const ray = new THREE.Raycaster();
let nedPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => { nedPos = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!nedPos || Math.hypot(e.clientX - nedPos[0], e.clientY - nedPos[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(p, kamera);
  const traff = ray.intersectObjects([...delGrupper.values()].filter(g => g.visible), true)
    .find(h => h.object.isMesh && h.object.userData.delId && delGrupper.get(h.object.userData.delId).userData.del.kat !== 'visning');
  markera(traff ? traff.object.userData.delId : null);
});

function markera(id) {
  markerad = id;
  document.querySelectorAll('#dellista tr').forEach(tr => tr.classList.toggle('markerad', tr.dataset.id === id));
  const rad = id && document.querySelector(`#dellista tr[data-id="${id}"]`);
  if (rad && !litenSkarm()) rad.scrollIntoView({ block: 'nearest' });
}

// ---------- Vyreglage ----------
document.querySelectorAll('[data-vy]').forEach(b => b.addEventListener('click', () => sattVy(b.dataset.vy)));
function sattVy(lage) {
  vyLage = lage;
  document.querySelectorAll('[data-vy]').forEach(b => b.classList.toggle('aktiv', b.dataset.vy === lage));
  $('#sprangReglage').classList.toggle('dold', lage !== 'sprangd');
  $('#stegNav').classList.toggle('dold', lage !== 'steg');
  $('#stegtext').classList.toggle('dold', lage !== 'steg');
  $('#animverktyg').classList.toggle('dold', lage !== 'monterad');
  visaStegtext();
}
$('#sprang').addEventListener('input', (e) => {
  sprangFaktor = Number(e.target.value) / 100;
  $('#sprangVarde').textContent = `${e.target.value} %`;
});
$('#visaNr').addEventListener('change', uppdateraEtiketter);
$('#aterstall').addEventListener('click', () => passaVy(false));
const pausa = () => { spelar = false; $('#spela').textContent = '▶'; };
$('#spela').addEventListener('click', () => { spelar = !spelar; $('#spela').textContent = spelar ? '⏸' : '▶'; });
$('#tid').addEventListener('input', (e) => { pausa(); t = Number(e.target.value) / 1000; visaTid(); });
$('#stegaFram').addEventListener('click', () => { pausa(); t = Math.min(1, t + 0.05); visaTid(); });
$('#stegaBak').addEventListener('click', () => { pausa(); t = Math.max(0, t - 0.05); visaTid(); });
$('#stegForra').addEventListener('click', () => valjMonteringssteg(monteringsSteg - 1));
$('#stegNasta').addEventListener('click', () => valjMonteringssteg(monteringsSteg + 1));

function valjMonteringssteg(i) {
  if (!modell) return;
  monteringsSteg = Math.max(0, Math.min(modell.steg.length - 1, i));
  if (vyLage !== 'steg') sattVy('steg');
  visaStegtext();
  if (STEG[tillstand.steg].id === 'montera') ritaPanel();
}

function visaStegtext() {
  if (!modell || vyLage !== 'steg') return;
  const s = modell.steg[monteringsSteg];
  $('#stegNr').textContent = `Steg ${monteringsSteg + 1} av ${modell.steg.length}`;
  $('#stegtext').replaceChildren(el('b', {}, `${monteringsSteg + 1}. ${s.titel}`), s.text, delChips(s.delar));
}

function delChips(ids) {
  const wrap = el('div', { class: 'chips' });
  for (const id of ids) {
    const d = modell.delar.find(x => x.id === id);
    if (!d || d.kat === 'visning') continue;
    const c = el('span', { class: 'chip' }, `${d.nr} ${d.namn}${d.antal > 1 ? ' × ' + d.antal : ''}`);
    c.style.background = KATEGORIER[d.kat].css;
    wrap.append(c);
  }
  return wrap;
}

function ritaLegend() {
  $('#legend').replaceChildren(...Object.entries(KATEGORIER).map(([, v]) => {
    const i = el('i'); i.style.background = v.css;
    return el('div', {}, i, `${v.ikon} ${v.namn}`);
  }));
}

function ritaDellista() {
  $('#dellista').replaceChildren(...modell.delar.map(d => {
    const nr = el('span', { class: 'nrbricka' }, d.nr); nr.style.background = KATEGORIER[d.kat].css;
    return el('tr', { 'data-id': d.id, onclick: () => markera(markerad === d.id ? null : d.id), title: d.info || '' },
      el('td', {}, nr), el('td', {}, d.namn), el('td', { class: 'katcell' }, `${KATEGORIER[d.kat].ikon} ${KATEGORIER[d.kat].namn}`),
      el('td', {}, String(d.antal)), el('td', { class: 'mattcell' }, d.matt || ''));
  }));
  $('#dellistaRubrik').textContent = `Dellista (${modell.delar.length} delar)`;
}

// ---------- Nivå ----------
function ritaNivaVal() {
  const s = $('#nivaVal');
  s.replaceChildren(...NIVAER.map(n => el('option', { value: n.id, selected: tillstand.niva === n.id }, n.namn)));
  if (!tillstand.niva) s.prepend(el('option', { value: '', selected: true, disabled: true }, 'Välj nivå'));
}
$('#nivaVal').addEventListener('change', (e) => sattNiva(e.target.value));

// ---------- Panelen ----------
function ritaStegrad() {
  $('#stegrad').replaceChildren(...STEG.map((s, i) => {
    const kanValja = i === 0 || (tillstand.design && tillstand.niva);
    return el('button', { class: 'stegknapp' + (i === tillstand.steg ? ' aktiv' : i < tillstand.steg ? ' klar' : ''), disabled: !kanValja,
      onclick: () => gaTillSteg(i), 'aria-current': i === tillstand.steg ? 'step' : null, title: s.namn },
    el('b', {}, String(i + 1)), el('span', { class: 'stegnamn' }, s.namn));
  }));
  $('#tillbaka').disabled = tillstand.steg === 0;
  $('#nasta').disabled = tillstand.steg === STEG.length - 1 || (tillstand.steg === 0 && (!tillstand.design || !tillstand.niva));
  $('#nasta').textContent = tillstand.steg === STEG.length - 2 ? 'Export →' : 'Nästa →';
  $('#angra').disabled = historik.length === 0;
}

function gaTillSteg(i) {
  tillstand.steg = Math.max(0, Math.min(STEG.length - 1, i));
  spara();
  const id = STEG[tillstand.steg].id;
  if (id === 'montera') { monteringsSteg = 0; sattVy('steg'); }
  else if (id === 'exportera') sattVy('sprangd');
  else if (vyLage !== 'monterad') sattVy('monterad');
  ritaStegrad();
  ritaPanel();
  if (litenSkarm()) $('#panelInnehall').scrollTop = 0;
}
$('#tillbaka').addEventListener('click', () => gaTillSteg(tillstand.steg - 1));
$('#nasta').addEventListener('click', () => gaTillSteg(tillstand.steg + 1));
$('#angra').addEventListener('click', angra);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input, textarea')) { e.preventDefault(); angra(); }
});
function angra() {
  if (!historik.length) return;
  tillstand.design = JSON.parse(historik.pop());
  spara();
  byggOm();
}

function ritaPanel() {
  const id = STEG[tillstand.steg].id;
  const f = { uppgift: panelUppgift, mekanism: panelMekanism, matt: panelMatt, granska: panelGranska, montera: panelMontera, exportera: panelExport }[id];
  $('#panelInnehall').replaceChildren(...f().filter(Boolean));
  ritaStegrad();
}

const kontrollRad = (k) => el('div', { class: 'kontroll ' + k.niva },
  el('span', { class: 'pr' }, { ok: '✓', varning: '!', fel: '✕', info: 'i' }[k.niva]), el('span', {}, k.text));

function panelUppgift() {
  const vald = tillstand.design && tillstand.design.uppgift;
  const nivaKort = el('div', { class: 'grupp' },
    el('h3', {}, tillstand.niva ? 'Din nivå' : '1. Välj din nivå'),
    el('div', { class: 'nivarad' }, ...NIVAER.map(n => el('button', {
      class: 'nivakort' + (tillstand.niva === n.id ? ' vald' : ''), onclick: () => sattNiva(n.id),
      'aria-pressed': tillstand.niva === n.id ? 'true' : 'false',
    }, el('b', {}, n.namn), el('span', { class: 'liten' }, n.forslag), el('span', {}, n.text)))),
    el('p', { class: 'liten' }, 'Fråga din lärare om du är osäker. Du kan byta nivå när som helst högst upp.'));
  return [
    el('h2', {}, 'Vad ska din mekanism göra?'),
    el('p', { class: 'ingress' }, 'Börja med uppgiften i ditt bygge. Sedan föreslår programmet mekanismer som passar.'),
    nivaKort,
    el('h3', { style: 'font-size:15px;margin:14px 0 8px' }, tillstand.niva ? 'Välj uppgift' : '2. Välj uppgift'),
    ...UPPGIFTER.map(u => el('button', {
      class: 'kort' + (vald === u.id ? ' vald' : ''), disabled: !!u.inaktiv || !tillstand.niva,
      onclick: () => {
        const servo = tillstand.design ? tillstand.design.servo : 'A180';
        const f = forslag(u.id, { servo });
        const mek = (tillstand.design && tillstand.design.uppgift === u.id) ? tillstand.design.mekanism : f[0].mekId;
        andraDesign(nyDesign(u.id, mek, { servo, spel: tillstand.design && tillstand.design.spel }));
        gaTillSteg(1);
      },
    }, el('div', { class: 'rubrik' }, el('span', { class: 'ikon', 'aria-hidden': 'true' }, u.ikon), u.namn),
    el('p', {}, u.beskrivning), u.inaktiv ? el('span', { class: 'bricka' }, u.inaktiv) : null)),
  ];
}

function jamforelseTabell(f) {
  return el('table', { class: 'jamfor' },
    el('thead', {}, el('tr', {}, el('th', {}, ''), ...f.map(x => el('th', {}, x.info.namn)))),
    el('tbody', {},
      el('tr', {}, el('td', {}, 'Rörelse'), ...f.map(x => el('td', {}, x.slagText))),
      el('tr', {}, el('td', {}, 'Säkerhetsmarginal'), ...f.map(x => el('td', { class: x.SF >= 2 ? 'gron' : x.SF >= 1.3 ? 'gul' : 'rod' }, `${fmt(x.SF, 1)}×`))),
      el('tr', {}, el('td', {}, 'Utskrivna delar'), ...f.map(x => el('td', {}, String(x.delar)))),
      el('tr', {}, el('td', {}, 'Svårighet'), ...f.map(x => el('td', {}, x.info.svarighet))),
      el('tr', {}, el('td', {}, 'Enkla maskiner'), ...f.map(x => el('td', {}, x.info.maskiner)))));
}

function panelMekanism() {
  const d = tillstand.design;
  const u = UPPGIFTER.find(x => x.id === d.uppgift);
  const f = forslag(d.uppgift, { servo: d.servo });
  return [
    el('h2', {}, `Mekanismer för: ${u.namn.toLowerCase()}`),
    el('p', { class: 'ingress' }, 'Klicka på ett förslag för att se det röra sig i 3D-vyn. Jämför och välj det som passar ditt bygge bäst.'),
    ...f.map(x => el('button', {
      class: 'kort' + (d.mekanism === x.mekId ? ' vald' : ''),
      onclick: () => {
        if (d.mekanism !== x.mekId) andraDesign(nyDesign(d.uppgift, x.mekId, { servo: d.servo, spel: d.spel }));
        sattVy('monterad'); spelar = true; $('#spela').textContent = '⏸';
        ritaPanel();
      },
    }, el('div', { class: 'rubrik' }, x.info.namn), x.rekommenderad ? el('span', { class: 'bricka bra' }, 'Bra start') : null,
    el('p', {}, x.info.forklaring),
    el('div', { class: 'fakta' }, el('span', {}, x.info.omvandling), el('span', {}, `Svårighet: ${x.info.svarighet}`),
      el('span', {}, `${x.delar} utskrivna delar`), el('span', {}, x.slagText)))),
    f.length > 1 ? el('div', { class: 'grupp' }, el('h3', {}, 'Jämför lösningarna'), jamforelseTabell(f)) : null,
    u.kommande ? el('p', { class: 'liten' }, u.kommande) : null,
    el('p', { class: 'liten' }, 'Fundera: Vilken lösning är lättast att bygga? Vilken ger mest kraft? Skriv ner varför du väljer som du gör.'),
  ];
}

function paramRad(p, varde, onAndra, opt = {}) {
  const info = el('div', { class: 'infotext dold' }, p.info);
  const etikett = el('label', {}, el('span', {}, p.namn, opt.beraknad ? el('span', { class: 'beraknadmarke' }, '= räknat') : null, opt.mal ? el('span', { class: 'malmarke' }, '🎯 mål') : null),
    el('button', { class: 'infoknapp', 'aria-label': 'Förklaring: ' + p.namn, onclick: () => info.classList.toggle('dold') }, 'i'));
  if (opt.beraknad) {
    return el('div', { class: 'param beraknad' }, etikett,
      el('div', { class: 'rad' }, el('output', {}, opt.dolt ? '?' : `${fmt(varde, p.steg < 1 ? (p.steg < 0.1 ? 2 : 1) : 0)} ${p.enhet}`)), info);
  }
  const range = el('input', { type: 'range', min: p.min, max: p.max, step: p.steg, value: varde, 'aria-label': p.namn });
  const num = el('input', { type: 'number', min: p.min, max: p.max, step: p.steg, value: varde, inputmode: 'decimal', 'aria-label': p.namn + ' (värde)' });
  range.addEventListener('input', () => { num.value = range.value; onAndra(Number(range.value), false); });
  range.addEventListener('change', () => onAndra(Number(range.value), true));
  num.addEventListener('change', () => {
    const v = Math.min(p.max, Math.max(p.min, Number(String(num.value).replace(',', '.'))));
    num.value = v; range.value = v; onAndra(v, true);
  });
  return el('div', { class: 'param' + (opt.mal ? ' mal' : '') }, etikett,
    el('div', { class: 'rad' }, range, num, el('span', { class: 'enhet' }, p.enhet)), info);
}

function behoverGissning() {
  const d = modell.design;
  if (d.lage !== 'mal' || nivaNr() > 2 || d.gissning) return false;
  return (d.mekanism === 'kuggstång' && modell.servo.typ === 180) || d.mekanism === 'hävarm';
}

let dragStart = null;
function panelMatt() {
  const d = tillstand.design;
  const md = modell.design;
  const nn = nivaNr();
  const typ = modell.servo.typ;
  const uppdatera = (id) => (v, slut) => {
    if (!dragStart) dragStart = JSON.stringify(tillstand.design);
    const ny = { ...tillstand.design, [id]: v };
    if (id === 'axelHal') ny.axelHalEgen = true;
    if (slut) { historik.push(dragStart); dragStart = null; andraDesign(ny, false); }
    else { tillstand.design = ny; byggOmSnabbt(); }
  };
  const gissa = behoverGissning();
  const beraknade = new Set(modell.mal.beraknade);
  const synlig = (p) => p.niva <= nn && (!p.lage || p.lage === md.lage) && (!p.servoTyp || p.servoTyp === typ);
  const parametrar = PARAMETRAR[md.mekanism].filter(synlig).map(p => {
    const ber = beraknade.has(p.id);
    if (ber) return paramRad(p, md[p.id], null, { beraknad: true, dolt: gissa });
    return paramRad(p, md[p.id], uppdatera(p.id), { mal: p.lage === 'mal' });
  });
  // Nybörjare: visa beräknade värden även om de annars är dolda
  if (nn === 1) for (const id of beraknade) {
    const p = PARAMETRAR[md.mekanism].find(x => x.id === id);
    if (p && !synlig(p)) parametrar.push(paramRad(p, md[id], null, { beraknad: true, dolt: gissa }));
  }
  const lageVal = nn >= 2 ? el('div', { class: 'lagevaxel', role: 'group', 'aria-label': 'Arbetssätt' },
    el('button', { class: md.lage === 'mal' ? 'aktiv' : '', onclick: () => andraDesign({ ...d, lage: 'mal' }) }, '🎯 Jag vet vad jag vill uppnå'),
    el('button', { class: md.lage === 'fri' ? 'aktiv' : '', onclick: () => andraDesign({ ...d, lage: 'fri' }) }, '🔧 Jag vill prova själv')) : null;
  const gissDel = gissa ? el('div', { class: 'gissa' },
    el('b', {}, md.mekanism === 'kuggstång' ? 'Gissa först: hur stort drev behövs?' : 'Gissa först: hur lång hävarm behövs?'),
    el('p', { class: 'liten' }, 'Tänk efter innan programmet visar svaret.'),
    el('div', { class: 'gissknappar' }, ...[['liten', md.mekanism === 'kuggstång' ? 'Litet' : 'Kort'], ['mellan', 'Mellan'], ['stor', md.mekanism === 'kuggstång' ? 'Stort' : 'Lång']]
      .map(([k, txt]) => el('button', { class: 'knapp', onclick: () => andraDesign({ ...d, gissning: k }) }, txt)))) : null;
  const svar = (md.lage === 'mal' && modell.mal.rader.length && !gissa) ? el('div', { class: 'malsvar' },
    modell.mal.forslag ? el('div', { class: 'forslagsruta' }, el('b', {}, 'Programmets förslag: '), modell.mal.forslag,
      modell.mal.thExakt ? el('div', { class: 'liten' }, `Ställ servot på ${fmt(modell.mal.thExakt, 1)}° i micro:bit för exakt ${fmt(md.malSlag, 1)} mm.`) : null) : null,
    md.gissning && modell.mal.gissKat ? el('div', { class: 'kontroll ' + (md.gissning === modell.mal.gissKat ? 'ok' : 'info') },
      el('span', { class: 'pr' }, md.gissning === modell.mal.gissKat ? '✓' : 'i'),
      el('span', {}, `Du gissade ${ordGiss(md.gissning, md.mekanism)}. Svaret blev ${ordGiss(modell.mal.gissKat, md.mekanism)}. ${md.gissning === modell.mal.gissKat ? 'Bra resonerat!' : 'Titta på uträkningen och fundera på varför.'}`)) : null,
    el('details', { open: nn === 1 }, el('summary', {}, 'Visa uträkningen steg för steg'),
      el('ol', { class: 'utrakning' }, ...modell.mal.rader.map(r => el('li', {}, r))))) : null;

  const servoVal = el('div', { class: 'param' }, el('label', { for: 'servoVal' }, 'Servomotor'),
    el('select', { id: 'servoVal', onchange: (e) => {
      const s = e.target.value;
      const ny = { ...d, servo: s };
      if (!d.axelHalEgen && tillstand.profil[s]) ny.axelHal = tillstand.profil[s];
      andraDesign(ny);
    } }, ...Object.values(SERVOS).map(s => el('option', { value: s.id, selected: s.id === md.servo }, `${s.namn} – ${fmt(s.momentKgCm, 1)} kg·cm`))),
    typ === 360 ? el('p', { class: 'liten' }, 'Ett 360°-servo snurrar runt och styrs med fart. Det behöver ändlägesbrytare som säger till när rörelsen är klar.') : null);

  const fasteVal = nn >= VAL.fasteTyp.niva ? el('div', { class: 'param' }, el('label', { for: 'fasteVal' }, VAL.fasteTyp.namn),
    el('select', { id: 'fasteVal', onchange: (e) => andraDesign({ ...d, fasteTyp: e.target.value }) },
      ...VAL.fasteTyp.alternativ.map(([v, txt]) => el('option', { value: v, selected: md.fasteTyp === v }, txt))),
    md.fasteTyp === 'axel' ? el('p', { class: 'liten' }, `Hålet är anpassat för att tryckas fast på servoaxeln${nn >= 3 ? ` (Ø ${fmt(md.axelHal, 2)} mm)` : ''}. Ingen skruv behövs.`) : null)
    : el('p', { class: 'liten' }, 'Armen eller drevet trycks fast direkt på servoaxeln. Ingen skruv behövs.');

  const avancerat = nn >= 3 ? el('details', { class: 'avancerat' }, el('summary', {}, 'Avancerat'),
    ...(md.fasteTyp === 'axel' ? [
      ...AVANCERADE.map(p => paramRad(p, md[p.id], uppdatera(p.id))),
      el('div', { class: 'param' }, el('label', { for: 'profilVal' }, VAL.halProfil.namn),
        el('select', { id: 'profilVal', onchange: (e) => andraDesign({ ...d, halProfil: e.target.value }) },
          ...VAL.halProfil.alternativ.map(([v, txt]) => el('option', { value: v, selected: md.halProfil === v }, txt)))),
      el('label', { class: 'kryss' }, el('input', { type: 'checkbox', checked: md.lasSkruv, onchange: (e) => andraDesign({ ...d, lasSkruv: e.target.checked }) }),
        ' Låsskruv i mitten (servons egen skruv)'),
      el('div', { class: 'param' }, el('label', { for: 'k01Val' }, 'Skrivarprofil: hålet som passade i K01'),
        el('select', { id: 'k01Val', onchange: (e) => {
          const v = Number(e.target.value);
          tillstand.profil[md.servo] = v; spara();
          andraDesign({ ...d, axelHal: v, axelHalEgen: false });
        } }, el('option', { value: '' }, 'Inte provat än'), ...[4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2].map(v =>
          el('option', { value: v, selected: tillstand.profil[md.servo] === v }, `${fmt(v, 1)} mm`))),
        el('p', { class: 'liten' }, `Sparas för ${SERVOS[md.servo].namn} på den här enheten och används för nya delar.`)),
    ] : [el('p', { class: 'liten' }, 'Axelhålet visas när fästet är "Direkt på axeln".')]),
    el('h3', { style: 'font-size:14px;margin:12px 0 4px' }, `Servomått för ${SERVOS[md.servo].namn}`),
    el('p', { class: 'liten' }, 'Mät med skjutmått. Måtten sparas på den här enheten.'),
    ...SERVO_REDIGERBARA.map(r => paramRad({ ...r, std: SERVOS[md.servo][r.id], info: 'Uppmätt mått på ditt servo.' }, SERVOS[md.servo][r.id], (v, slut) => {
      if (!slut) return;
      tillstand.servoMatt[md.servo] = { ...(tillstand.servoMatt[md.servo] || {}), [r.id]: v };
      tillampaServoMatt(tillstand.servoMatt); spara(); byggOm();
    })),
  ) : null;

  const kontr = el('div', { id: 'mattKontroller' });
  ritaKontroller(kontr);
  return [
    el('h2', {}, 'Motor och mått'),
    el('p', { class: 'ingress' }, `${MEKANISMER[md.mekanism].namn}. ${md.lage === 'mal' ? 'Ange vad du vill uppnå – programmet räknar ut resten.' : 'Ändra måtten – 3D-vyn, dellistan och filerna följer med.'}`),
    lageVal,
    servoVal,
    ...parametrar.filter((x, i) => true),
    gissDel,
    svar,
    ...(nn >= 2 ? GEMENSAMMA.map(p => paramRad(p, md[p.id], uppdatera(p.id))) : []),
    fasteVal,
    avancerat,
    el('h3', { style: 'font-size:15px;margin:16px 0 6px' }, 'Kontroller'),
    kontr,
  ];
}

const ordGiss = (k, mek) => mek === 'kuggstång' ? { liten: 'ett litet drev', mellan: 'ett mellanstort drev', stor: 'ett stort drev' }[k]
  : { liten: 'en kort hävarm', mellan: 'en mellanlång hävarm', stor: 'en lång hävarm' }[k];

function ritaKontroller(behallare) {
  behallare.replaceChildren(...modell.berakning.kontroller.map(kontrollRad));
}

function textFalt(id, etikett, platshallare) {
  const f = el('textarea', { id: 'mot_' + id, rows: 2, placeholder: platshallare }, tillstand.motivering[id] || '');
  f.addEventListener('input', () => { tillstand.motivering[id] = f.value; spara(); });
  return el('div', { class: 'param' }, el('label', { for: 'mot_' + id }, etikett), f);
}

function panelGranska() {
  const md = modell.design;
  return [
    el('h2', {}, 'Granska din lösning'),
    el('p', { class: 'ingress' }, 'Så här räknar programmet. Kontrollera att rörelsen och kraften räcker innan du skriver ut.'),
    el('table', { class: 'berakning' }, el('tbody', {}, ...modell.berakning.rader.map(r =>
      el('tr', {}, el('td', {}, r.namn, el('span', { class: 'formel' }, r.formel)), el('td', { class: 'v' }, r.varde))))),
    md.lage === 'mal' && modell.mal.rader.length && !behoverGissning() ? el('details', {}, el('summary', {}, 'Uträkning från ditt mål'),
      el('ol', { class: 'utrakning' }, ...modell.mal.rader.map(r => el('li', {}, r)))) : null,
    el('h3', { style: 'font-size:15px;margin:16px 0 6px' }, 'Kontroller'),
    ...modell.berakning.kontroller.map(kontrollRad),
    el('h3', { style: 'font-size:15px;margin:18px 0 6px' }, 'Min designmotivering'),
    el('p', { class: 'liten' }, 'Skriv kort. Texten kommer med när du exporterar designmotiveringen.'),
    textFalt('valde', 'Jag valde …', `${modell.mekanismInfo.namn.toLowerCase()}`),
    textFalt('eftersom', 'eftersom …', 'den ger … och …'),
    textFalt('nackdel', 'Nackdelen är …', 'den kräver …'),
    el('p', { class: 'liten' }, 'Beräkningarna är uppskattningar med säkerhetsfaktor 1,3. Servon varierar – testa alltid försiktigt.'),
  ];
}

function panelMontera() {
  return [
    el('h2', {}, 'Montera steg för steg'),
    el('p', { class: 'ingress' }, 'Följ stegen. Delarna i varje steg glider på plats i 3D-vyn. Samma delnummer finns i dellistan och i filnamnen.'),
    el('ol', { class: 'monteringssteg' }, ...modell.steg.map((s, i) => el('li', {
      class: i === monteringsSteg ? 'aktiv' : '', onclick: () => valjMonteringssteg(i), tabindex: 0,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valjMonteringssteg(i); } },
    }, el('span', { class: 'nr' }, `${i + 1}.`), el('b', {}, s.titel), el('p', {}, s.text), delChips(s.delar)))),
    el('div', { class: 'grupp' }, el('button', { class: 'knapp', onclick: () => sattVy('sprangd') }, 'Visa sprängvy'), ' ',
      el('button', { class: 'knapp', onclick: () => { sattVy('monterad'); spelar = true; } }, 'Visa rörelsen')),
  ];
}

function valdPlatta() {
  if (tillstand.platta === 'egen') return { id: 'egen', namn: 'Egen', ...tillstand.egenPlatta };
  return PLATTOR.find(p => p.id === tillstand.platta) || PLATTOR[0];
}

function meddela(text, niva = 'info') {
  let m = document.getElementById('meddelande');
  if (!m) { m = el('div', { id: 'meddelande', role: 'status' }); document.body.append(m); }
  m.className = 'kontroll ' + niva; m.textContent = text;
  clearTimeout(meddela.t); meddela.t = setTimeout(() => m.remove(), 5000);
}

// filer: [{namn, data}] – flera filer eller filtyper som plattformen inte tar emot packas i en ZIP.
async function laddaFiler(filer, zipNamn) {
  const dl = window.claude ? await downloadsKlar : null;
  if (dl) {
    const tillaten = /\.(zip|csv|txt|json|md)$/i;
    let namn, data;
    if (filer.length === 1 && tillaten.test(filer[0].namn)) ({ namn, data } = filer[0]);
    else { namn = zipNamn || filer[0].namn.replace(/\.[^.]+$/, '.zip'); data = skapaZip(filer); }
    try { await dl.save({ filename: namn, data }); meddela(`Sparad: ${namn}`, 'ok'); }
    catch (e) {
      if (e && e.code === 'declined') return;
      meddela('Filen kunde inte sparas här. Öppna programmet som fil i webbläsaren och försök igen.', 'fel');
    }
    return;
  }
  // Delningsfunktion på iPad och mobil när den finns
  if (pekskarm && navigator.canShare && filer.length === 1) {
    try {
      const fil = new File([filer[0].data], filer[0].namn, { type: 'application/octet-stream' });
      if (navigator.canShare({ files: [fil] })) { await navigator.share({ files: [fil], title: filer[0].namn }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  filer.forEach((f, i) => setTimeout(() => ladda(f.namn, f.data), i * 400));
}

function ladda(namn, data) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: namn });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function ritaPlatta(canvas, platta, p, marginal) {
  const max = litenSkarm() ? 130 : 150;
  const skala = Math.min(max / platta.x, max / platta.y);
  canvas.width = Math.round(platta.x * skala) + 2; canvas.height = Math.round(platta.y * skala) + 2;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#bbb'; ctx.setLineDash([3, 3]);
  ctx.strokeRect(marginal * skala + 1, marginal * skala + 1, (platta.x - 2 * marginal) * skala, (platta.y - 2 * marginal) * skala);
  ctx.setLineDash([]);
  for (const o of p.objekt) {
    const x = (marginal + o.x) * skala + 1, y = (marginal + o.y) * skala + 1;
    ctx.fillStyle = '#e8892b'; ctx.fillRect(x, y, o.w * skala, o.d * skala);
    ctx.strokeStyle = '#8a4d14'; ctx.strokeRect(x, y, o.w * skala, o.d * skala);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
    if (o.w * skala > 22 && o.d * skala > 12) ctx.fillText(o.nr, x + 3, y + 12);
  }
}

const filnamnBas = () => `mekanism_${modell.design.uppgift}_${modell.design.mekanism.replace(/ä/g, 'a').replace(/å/g, 'a')}`;
const motiveringText = () => designmotivering(modell, { ...tillstand.motivering, niva: tillstand.niva, jamforelse: forslag(modell.design.uppgift, { servo: modell.design.servo }) });

function panelExport() {
  const platta = valdPlatta();
  const lay = layout(modell, platta);
  const status = lay.forStora.length
    ? { niva: 'fel', text: `${[...new Set(lay.forStora.map(o => o.nr))].join(', ')} är för stor för plattan. Välj större platta eller kortare mått.` }
    : lay.plattor.length > 1
      ? { niva: 'varning', text: `Delarna ryms inte på en platta – du behöver ${lay.plattor.length} utskrifter.` }
      : { niva: 'ok', text: 'Alla utskrivbara delar ryms på en platta.' };
  const egen = el('div', { class: tillstand.platta === 'egen' ? 'egenplatta' : 'dold' },
    ...['x', 'y', 'z'].map(k => el('input', { type: 'number', min: 60, max: 500, value: tillstand.egenPlatta[k], inputmode: 'numeric', 'aria-label': `Byggplatta ${k} (mm)`,
      onchange: (e) => { tillstand.egenPlatta[k] = Math.max(60, Math.min(500, Number(e.target.value) || 200)); spara(); ritaPanel(); } })),
    el('span', { class: 'liten' }, 'x · y · höjd mm'));
  const figurer = lay.plattor.map((p, i) => {
    const c = el('canvas', { role: 'img', 'aria-label': `Platta ${i + 1}: ${p.objekt.map(o => o.nr).join(', ')}` });
    ritaPlatta(c, platta, p, lay.marginal);
    return el('figure', {}, c, el('figcaption', {}, `Platta ${i + 1}`));
  });
  const utskr = utskrivbaraDelar(modell);
  const grupper = Object.entries(KATEGORIER).map(([k, v]) => {
    const dl = modell.delar.filter(d => d.kat === k);
    if (!dl.length) return null;
    return el('div', { class: 'grupp' }, el('h3', {}, `${v.ikon} ${v.namn}`),
      el('div', { class: 'liten' }, dl.map(d => `${d.nr} ${d.namn}${d.antal > 1 ? ' × ' + d.antal : ''}`).join(' · ')));
  });
  const filVal = el('input', { type: 'file', accept: '.json,application/json', class: 'dold', id: 'oppnaFil' });
  filVal.addEventListener('change', async () => {
    const f = filVal.files && filVal.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const d = data.design || data;
      if (!d.uppgift || !d.mekanism) throw new Error('saknar uppgift');
      andraDesign(d);
      meddela('Designen är öppnad.', 'ok');
    } catch { meddela('Filen kunde inte läsas. Välj en designfil (.json) från Mekanismdesignern.', 'fel'); }
  });
  return [
    el('h2', {}, 'Exportera'),
    el('p', { class: 'ingress' }, 'Hämta filer för 3D-skrivaren. Bara delarna som ska skrivas ut kommer med – inte servo, skruvar eller visningsdelar.'),
    el('div', { class: 'param' }, el('label', { for: 'plattVal' }, 'Byggplatta'),
      el('select', { id: 'plattVal', onchange: (e) => { tillstand.platta = e.target.value; spara(); ritaPanel(); } },
        ...PLATTOR.map(p => el('option', { value: p.id, selected: tillstand.platta === p.id }, p.namn)),
        el('option', { value: 'egen', selected: tillstand.platta === 'egen' }, 'Egen storlek …')), egen),
    kontrollRad(status),
    el('div', { class: 'platta-wrap' }, ...figurer),
    el('div', { class: 'nedladdning' },
      el('button', { class: 'knapp primar', disabled: !lay.plattor.length, onclick: () => laddaFiler(samladStl(modell, platta).filer, 'samlad_stl.zip') },
        lay.plattor.length > 1 ? `⬇ Samlad STL (${lay.plattor.length} plattor)` : '⬇ Samlad STL – alla delar'),
      el('button', { class: 'knapp', onclick: () => laddaFiler([{ namn: `${filnamnBas()}.zip`, data: zipPaket(modell, platta, { motivering: motiveringText() }) }]) },
        '⬇ ZIP-paket (STL, stycklista, instruktion, motivering)'),
      modell.design.fasteTyp === 'axel' ? el('button', { class: 'knapp', onclick: () => laddaFiler([kalibreringStl(modell.design.halProfil)]) },
        '⬇ K01 Kalibreringsbit för axelhål') : null,
      el('div', { class: 'liten', style: 'margin-top:6px' }, 'Enskilda delar:'),
      ...utskr.map(d => el('button', { class: 'knapp', onclick: () => laddaFiler([delStl(d)]) },
        `⬇ ${d.nr} ${d.namn}${d.antal > 1 ? ' × ' + d.antal : ''}`)),
      el('div', { class: 'liten', style: 'margin-top:6px' }, 'Dokumentation och designfil:'),
      el('button', { class: 'knapp', onclick: () => laddaFiler([{ namn: 'designmotivering.md', data: motiveringText() }]) }, '⬇ Designmotivering (bilaga till rapporten)'),
      el('button', { class: 'knapp', onclick: () => laddaFiler([{ namn: 'stycklista.csv', data: stycklistaCsv(modell) }]) }, '⬇ Stycklista (CSV)'),
      el('button', { class: 'knapp', onclick: () => laddaFiler([{ namn: `${filnamnBas()}.json`, data: JSON.stringify({ program: 'Mekanismdesignern', version: VERSION, design: modell.design }, null, 2) }]) },
        '⬇ Spara designfil (för att byta enhet)'),
      el('button', { class: 'knapp', onclick: () => filVal.click() }, '📂 Öppna designfil'), filVal,
    ),
    modell.design.fasteTyp === 'axel' ? el('p', { class: 'liten' }, 'Skriv ut K01 en gång per skrivare och servotyp. Prova hålen på servoaxeln och be läraren föra in det hål som satt bäst.') : null,
    window.claude ? el('p', { class: 'liten' }, 'I Claude-vyn sparas STL-filer inuti en ZIP-fil. Packa upp den innan du öppnar filerna i slicern.') : null,
    pekskarm ? el('p', { class: 'liten' }, 'På surfplatta och mobil: skicka STL-filerna till en dator med slicern (t.ex. Creality Print) eller direkt till skrivaren.') : null,
    el('h3', { style: 'font-size:15px;margin:16px 0 4px' }, 'Material'),
    ...grupper,
    el('p', { class: 'liten' }, 'Utskriftsråd för Creality K1C med PLA: 0,2 mm lager (0,12–0,16 mm för modul 1), 3 perimetrar (4 runt axelhål), 20–30 % fyllnad, inget stöd. Sitter delarna för hårt – öka passningsspelet och skriv ut igen.'),
  ];
}

// ---------- Ombyggnad ----------
let snabbTimer = null;
function byggOmSnabbt() {
  clearTimeout(snabbTimer);
  snabbTimer = setTimeout(() => {
    modell = bygg(tillstand.design);
    byggScen(); ritaDellista();
    const k = $('#mattKontroller'); if (k) ritaKontroller(k);
    visaTid();
  }, 40);
}

function byggOm() {
  if (!tillstand.design) { ritaPanel(); return; }
  const forra = modell ? modell.design.mekanism + modell.design.uppgift : null;
  modell = bygg(tillstand.design);
  monteringsSteg = Math.min(monteringsSteg, modell.steg.length - 1);
  byggScen();
  ritaDellista();
  if (forra !== modell.design.mekanism + modell.design.uppgift) passaVy(false);
  visaStegtext();
  visaTid();
  ritaPanel();
}

ritaLegend();
ritaNivaVal();
storlek();
if (litenSkarm()) { $('#dellistaDetaljer').open = false; $('#visaNr').checked = false; }
if (tillstand.design) {
  try { byggOm(); } catch (e) { console.error(e); tillstand.design = null; tillstand.steg = 0; ritaPanel(); }
} else {
  tillstand.steg = 0;
  modell = bygg(standardDesign('lucka', 'hävarm'));
  byggScen(); ritaDellista(); passaVy(false);
  ritaPanel();
}
if (STEG[tillstand.steg].id === 'montera') sattVy('steg');
requestAnimationFrame(loop);

window.__mekanism = { get modell() { return modell; }, tillstand, stlBinar, version: VERSION };
