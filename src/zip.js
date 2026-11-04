// Enkel ZIP-skrivare (okomprimerad, "store") – inga externa beroenden.
const TABELL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABELL[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function skapaZip(filer) {
  const enc = new TextEncoder();
  const delar = [];
  const central = [];
  let offset = 0;
  for (const f of filer) {
    const namn = enc.encode(f.namn);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, namn.length, true); lh.setUint16(28, 0, true);
    delar.push(new Uint8Array(lh.buffer), namn, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, namn.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), namn);
    offset += 30 + namn.length + data.length;
  }
  const cdStorlek = central.reduce((s, a) => s + a.length, 0);
  const slut = new DataView(new ArrayBuffer(22));
  slut.setUint32(0, 0x06054b50, true);
  slut.setUint16(8, filer.length, true); slut.setUint16(10, filer.length, true);
  slut.setUint32(12, cdStorlek, true); slut.setUint32(16, offset, true);
  const alla = [...delar, ...central, new Uint8Array(slut.buffer)];
  const ut = new Uint8Array(alla.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of alla) { ut.set(a, o); o += a.length; }
  return ut;
}
