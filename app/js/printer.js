/* ปริ้นเตอร์ความร้อน ESC/POS (Xprinter XP-Q807K 80 มม. ผ่าน USB)
   - ESCPOS / rasterize / rasterCmds / bytes : สร้าง byte ล้วน ไม่แตะ DOM (เทสต์ใน node ได้)
   - renderSlip : วาดตั๋วลง canvas · ภาษาไทยส่งเป็นภาพเสมอ ไม่พึ่งฟอนต์ในปริ้นเตอร์
   - UsbPrinter : เชื่อมและส่งข้อมูลผ่าน WebUSB (ต้องเปิดหน้าผ่าน https หรือ localhost) */
const PRINTER = {
  dots: 576,        // ความกว้างพิมพ์ 80 มม. ≈ 576 จุดที่ 203 dpi (บางรุ่นพิมพ์ได้ 512)
  chunk: 4096,      // ส่งข้อมูลทีละกี่ byte
  threshold: 160,   // ความสว่างต่ำกว่านี้ = จุดดำ (สูงขึ้น = เข้มขึ้น)
  band: 256,        // แบ่งภาพเป็นแถบละกี่แถว ต่อ 1 คำสั่ง GS v 0 (กันบัฟเฟอร์ปริ้นเตอร์เต็ม)
};

const ESCPOS = {
  init:    () => [0x1B, 0x40],                         // ESC @  รีเซ็ตปริ้นเตอร์
  feed:    n => [0x1B, 0x64, n],                       // ESC d n  เลื่อนกระดาษ n บรรทัด
  cut:     () => [0x1D, 0x56, 0x42, 0x00],             // GS V 66 0  เลื่อนถึงใบมีดแล้วตัด (เหลือติดนิดหน่อย)
  fullCut: () => [0x1D, 0x56, 0x41, 0x00],             // GS V 65 0  เลื่อนถึงใบมีดแล้วตัดขาด
  drawer:  (pin = 0) => [0x1B, 0x70, pin, 25, 250],    // ESC p m 25 250  เปิดลิ้นชัก (pin 0 = ขา 2, 1 = ขา 5)
  text:    s => [...String(s)].map(c => c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 0x3F).concat(0x0A), // ASCII เท่านั้น
};

/* รวม array / Uint8Array หลายก้อนเป็น Uint8Array เดียว */
function bytes(...parts){
  const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0;
  parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}

/* ภาพ RGBA (ImageData หรือ {width, height, data}) → บิตขาวดำ 1 บิต/จุด เรียงแถวละ widthBytes */
function rasterize(img, threshold = PRINTER.threshold){
  const wb = Math.ceil(img.width / 8), bits = new Uint8Array(wb * img.height), d = img.data;
  for(let y = 0; y < img.height; y++) for(let x = 0; x < img.width; x++){
    const i = (y * img.width + x) * 4;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if(d[i + 3] >= 128 && lum < threshold) bits[y * wb + (x >> 3)] |= 0x80 >> (x & 7);   // โปร่งใส = ขาว
  }
  return {widthBytes: wb, height: img.height, bits};
}

/* บิตภาพ → คำสั่ง GS v 0 แบ่งเป็นแถบ */
function rasterCmds(r, band = PRINTER.band){
  const parts = [];
  for(let y = 0; y < r.height; y += band){
    const h = Math.min(band, r.height - y);
    parts.push([0x1D, 0x76, 0x30, 0x00, r.widthBytes & 255, r.widthBytes >> 8, h & 255, h >> 8]);
    parts.push(r.bits.subarray(y * r.widthBytes, (y + h) * r.widthBytes));
  }
  return bytes(...parts);
}

/* ---------- วาดตั๋วลง canvas ----------
   blocks: {text, size, bold, align:'left'|'center'|'right', invert}  ข้อความ (ตัดบรรทัดอัตโนมัติ)
           {left, right, size, bold}                                   ซ้าย-ขวาในบรรทัดเดียว
           {rule:'dash'|'solid'} เส้นคั่น · {gap:n} เว้นที่ว่าง n จุด */
const SLIP_FONT = '"Noto Sans Thai", "Sarabun", sans-serif';
function renderSlip(blocks, dots = PRINTER.dots, canvas){
  canvas = canvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d'), M = 8, W = dots - M * 2, ops = [];
  const font = b => `${b.bold ? 700 : 400} ${b.size || 26}px ${SLIP_FONT}`;
  const words = s => typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter('th', {granularity:'word'}).segment(s)].map(x => x.segment) : [...s];
  const wrap = (s, maxW) => {
    const out = []; let cur = '';
    words(s).forEach(w => {
      if(ctx.measureText(cur + w).width <= maxW || !cur) cur += w;
      else { out.push(cur.trimEnd()); cur = w.trimStart(); }
      while(ctx.measureText(cur).width > maxW && cur.length > 1){            // คำเดียวยาวเกินบรรทัด: ตัดทีละตัว
        let k = cur.length - 1; while(k > 1 && ctx.measureText(cur.slice(0, k)).width > maxW) k--;
        out.push(cur.slice(0, k)); cur = cur.slice(k);
      }
    });
    if(cur || !out.length) out.push(cur);
    return out;
  };
  let y = 0;
  blocks.forEach(b => {
    if(b.gap){ y += b.gap; return; }
    if(b.rule){ ops.push({rule:b.rule, y: y + 8}); y += 16; return; }
    const size = b.size || 26, lh = Math.round(size * 1.45);
    ctx.font = font(b);
    if('left' in b){
      const rw = ctx.measureText(b.right || '').width;
      wrap(b.left, W - rw - 12).forEach((t, i) => { ops.push({b, t, x:M, y, lh, align:'left'}); if(!i && b.right) ops.push({b, t:b.right, x:M + W, y, lh, align:'right'}); y += lh; });
      return;
    }
    wrap(b.text, W).forEach(t => { ops.push({b, t, y, lh, align:b.align || 'left', x: b.align === 'center' ? dots / 2 : b.align === 'right' ? M + W : M}); y += lh; });
  });
  canvas.width = dots; canvas.height = Math.max(1, Math.ceil(y + 8));
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ops.forEach(o => {
    if(o.rule){ ctx.fillStyle = '#000'; if(o.rule === 'solid') ctx.fillRect(M, o.y - 1, W, 3); else for(let x = M; x < M + W; x += 14) ctx.fillRect(x, o.y - 1, 8, 2); return; }
    const size = o.b.size || 26;
    if(o.b.invert){ ctx.fillStyle = '#000'; ctx.fillRect(0, o.y, dots, o.lh); }
    ctx.fillStyle = o.b.invert ? '#fff' : '#000'; ctx.font = font(o.b); ctx.textAlign = o.align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.t, o.x, o.y + Math.round(size * 1.1));
  });
  return canvas;
}
/* canvas → คำสั่งพิมพ์ภาพ */
const canvasCmds = (canvas, threshold) => rasterCmds(rasterize(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height), threshold));

/* ---------- WebUSB ---------- */
const hex4 = n => '0x' + n.toString(16).padStart(4, '0');
class UsbPrinter {
  constructor(){ this.dev = null; this.iface = null; this.ep = null; }
  static supported(){ return typeof navigator !== 'undefined' && !!navigator.usb; }
  /* หา endpoint แบบ bulk OUT (เลือก interface class 7 = Printer ก่อน) */
  static findOut(cfg){
    let best = null;
    cfg.interfaces.forEach(it => (it.alternates || [it.alternate]).forEach(alt => alt.endpoints.forEach(e => {
      if(e.direction !== 'out' || e.type !== 'bulk') return;
      const c = {iface: it.interfaceNumber, alt: alt.alternateSetting, ep: e.endpointNumber, cls: alt.interfaceClass, packet: e.packetSize};
      if(!best || (c.cls === 7 && best.cls !== 7)) best = c;
    })));
    return best;
  }
  static describe(d){
    const L = [`${d.manufacturerName || '?'} / ${d.productName || '?'} · vendor ${hex4(d.vendorId)} product ${hex4(d.productId)}${d.serialNumber ? ' · SN ' + d.serialNumber : ''}`];
    (d.configurations || []).forEach(c => c.interfaces.forEach(it => (it.alternates || []).forEach(a =>
      L.push(`  config ${c.configurationValue} · interface ${it.interfaceNumber}.${a.alternateSetting} class ${a.interfaceClass} · ` +
        (a.endpoints.map(e => `ep${e.endpointNumber} ${e.direction} ${e.type} ${e.packetSize}B`).join(', ') || 'ไม่มี endpoint')))));
    return L.join('\n');
  }
  get connected(){ return !!(this.dev && this.dev.opened && this.ep !== null); }
  async request(){ return this.open(await navigator.usb.requestDevice({filters: []})); }
  /* เครื่องที่เคยอนุญาตแล้ว เชื่อมได้โดยไม่ต้องเลือกใหม่ */
  async reconnect(){ const list = await navigator.usb.getDevices(); if(!list.length) return null; return this.open(list[0]); }
  async open(d){
    if(!d.opened) await d.open();
    if(!d.configuration) await d.selectConfiguration(1);
    const f = UsbPrinter.findOut(d.configuration);
    if(!f) throw new Error('ไม่พบช่องส่งข้อมูล (bulk OUT) ในอุปกรณ์นี้');
    await d.claimInterface(f.iface);
    if(f.alt) await d.selectAlternateInterface(f.iface, f.alt);
    this.dev = d; this.iface = f.iface; this.ep = f.ep; this.found = f;
    return d;
  }
  async send(data, chunk = PRINTER.chunk){
    if(!this.connected) throw new Error('ยังไม่ได้เชื่อมปริ้นเตอร์');
    for(let i = 0; i < data.length; i += chunk){
      const r = await this.dev.transferOut(this.ep, data.subarray(i, i + chunk));
      if(r.status !== 'ok') throw new Error(`ส่งข้อมูลไม่สำเร็จ (${r.status}) ที่ byte ${i}`);
    }
    return data.length;
  }
  async close(){ const d = this.dev; this.dev = null; this.ep = null; if(d && d.opened){ try{ await d.releaseInterface(this.iface); }catch(e){} await d.close(); } }
  forget(){ this.dev = null; this.ep = null; }
}
