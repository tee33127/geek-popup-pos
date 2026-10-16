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

/* ---------- ฟอนต์ตั๋ว ----------
   ฟอนต์เดียวกับหน้าจอ (app/css/fonts.css) · canvas ไม่รอฟอนต์เอง ต้องเรียก slipFontsReady() ก่อนวาดทุกครั้ง
   ฟอนต์ไม่มาใน ~2 วินาที → พิมพ์ต่อด้วยฟอนต์สำรอง + เตือนใน console (ห้ามค้างจนพิมพ์ไม่ได้) */
const SLIP_FACE = 'IBM Plex Sans Thai Looped';
const SLIP_FONT = `"${SLIP_FACE}", "Noto Sans Thai Looped", "Sarabun", sans-serif`;
const SLIP_WEIGHTS = [400, 700];
let slipFontsOk = false;
function slipFontsReady(timeout = 2000){
  const fs = typeof document !== 'undefined' && document.fonts;
  if(!fs || !fs.load) return Promise.resolve(false);   // ไม่มี FontFace API (jsdom/node)
  if(slipFontsOk) return Promise.resolve(true);
  const specs = SLIP_WEIGHTS.map(w => `${w} 26px "${SLIP_FACE}"`);
  const load = Promise.all(specs.map(s => fs.load(s, 'กข฿0'))).catch(e => console.warn('slip font load', e));
  return Promise.race([load, new Promise(r => setTimeout(r, timeout))]).then(() => {
    slipFontsOk = specs.every(s => fs.check(s, 'กข฿0'));
    if(!slipFontsOk) console.warn('slip font: ฟอนต์ตั๋วยังไม่พร้อม พิมพ์ด้วยฟอนต์สำรอง');
    return slipFontsOk;
  });
}

/* ---------- ตัดบรรทัด ----------
   ตัดเป็นคำด้วย Intl.Segmenter (ไม่มี = ทีละตัวอักษร + สระ/วรรณยุกต์ที่ตามมา) แล้วรวมเครื่องหมายเข้ากับคำ
   ห้ามขึ้นบรรทัดด้วยช่องว่าง , . : ) × · (ติดคำหน้า) และ ( ฿ # × ติดคำหลัง · ส่ง array = รายการ คั่น ", " ตัดระหว่างรายการก่อน */
const SLIP_NO_START = /^[\s,.:;!?%)\]}×·–\-]/, SLIP_GLUE_NEXT = /[([{฿#×]$/;
const clusters = s => s.match(/[\s\S][ัิ-ฺ็-๎️‍\u{1F3FB}-\u{1F3FF}]*/gu) || [];
function slipTokens(s){
  const segs = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('th', {granularity:'word'}).segment(s)].map(x => x.segment) : clusters(s);
  const out = [];
  segs.forEach(g => { const p = out.length - 1; if(p >= 0 && (SLIP_NO_START.test(g) || SLIP_GLUE_NEXT.test(out[p]))) out[p] += g; else out.push(g); });
  return out;
}
function wrapText(ctx, text, maxW){
  const fits = s => ctx.measureText(s).width <= maxW;
  const toks = Array.isArray(text)
    ? text.flatMap((p, i) => { const t = p + (i < text.length - 1 ? ', ' : ''); return fits(t.trimEnd()) ? [t] : slipTokens(t); })
    : slipTokens(String(text));
  const out = []; let cur = '';
  toks.forEach(w => {
    if(!cur || fits((cur + w).trimEnd())) cur += w;
    else { out.push(cur.trimEnd()); cur = w.trimStart(); }
    if(!fits(cur.trimEnd())){                                     // คำเดียวยาวเกินบรรทัด: ตัดทีละตัวอักษร (ไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ)
      const cs = clusters(cur); let line = '';
      cs.forEach(c => { if(line && !fits(line + c)){ out.push(line); line = ''; } line += c; });
      cur = line.trimStart();
    }
  });
  if(cur.trim() || !out.length) out.push(cur.trimEnd());
  return out;
}

/* ---------- วาดตั๋วลง canvas ----------
   blocks: {text, size, bold, align:'left'|'center'|'right', indent}  ข้อความ (text เป็น array = รายการคั่น ", ")
           {tag, text, size, bold, tagBold, indent, col}  ป้ายหน้าบรรทัด ("ไม่รับ:" "-") ข้อความเริ่มที่คอลัมน์ col (ไม่ใส่ = ต่อท้ายป้าย
                                                         · 'auto' = ป้ายขนาดเดียวกันในใบใช้คอลัมน์เดียวกัน) บรรทัดต่อไปเยื้องตรงข้อความ
           {left, mid, right, size, bold}   ซ้าย · กลาง (ราคาต่อชิ้น ชิดขวาที่คอลัมน์เดียวกันทุกแถว) · ขวา
           {box:'single'|'double', text, lead, size, bold}  กรอบเส้นหนาพื้นขาว ข้อความกลาง (ไม่ใช้พื้นดำทึบ พิมพ์แล้วเป็นริ้ว)
           {note, label, size}              หมายเหตุลูกค้า: กรอบเส้นหนา ป้ายสามเหลี่ยมเตือน + ตัวหนาใหญ่
           {rule:'dash'|'solid'} เส้นคั่น · {gap:n} เว้นที่ว่าง n จุด
   วาดด้วย fillRect + fillText เท่านั้น · ท้ายใบเว้น tail จุด (36 ≈ 4.5 มม. ใต้บรรทัดสุดท้าย) ก่อนตัด */
const SLIP_LH = 1.5, SLIP_BASE = 1.12, SLIP_TAIL = 36;
function renderSlip(blocks, dots = PRINTER.dots, canvas, tail = SLIP_TAIL){
  canvas = canvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d'), M = 8, W = dots - M * 2, ops = [];
  const font = (bold, size) => `${bold ? 700 : 400} ${size}px ${SLIP_FONT}`;
  const measure = (s, bold, size) => { ctx.font = font(bold, size); return ctx.measureText(s).width; };
  const text = (t, x, y, size, bold, align = 'left') => ops.push({t, x, y, size, bold, align});
  const rect = (x, y, w, h) => ops.push({rect:[x, y, w, h]});
  const frame = (x, y, w, h, t) => { rect(x, y, w, t); rect(x, y + h - t, w, t); rect(x, y, t, h); rect(x + w - t, y, t, h); };
  /* คอลัมน์ข้อความของป้าย col:'auto' = ป้ายที่กว้างที่สุดในกลุ่ม (ขนาด + เยื้องเดียวกัน) + ช่องว่าง */
  const autoCol = {};
  blocks.forEach(b => { if(b.tag && b.col === 'auto'){ const k = (b.size || 26) + '/' + (b.indent || 0), size = b.size || 26;
    autoCol[k] = Math.max(autoCol[k] || 0, measure(b.tag, b.tagBold ?? b.bold, size) + Math.round(size * 0.5)); } });
  const PRICE_COL = measure('฿0,000', false, 26) + 18;   // คอลัมน์ขวาสุด (ยอดรวมของแถว) กว้างคงที่ ราคาต่อชิ้นจึงตรงกันทุกแถว
  let y = 0;
  blocks.forEach(b => {
    if(b.gap){ y += b.gap; return; }
    if(b.rule){ if(b.rule === 'solid') rect(M, y + 7, W, 3); else for(let x = M; x < M + W; x += 14) rect(x, y + 7, 8, 2); y += 16; return; }
    const size = b.size || 26, lh = Math.round(size * SLIP_LH), bold = !!b.bold;
    if('note' in b){                                           // หมายเหตุลูกค้า
      const pad = 12, t = 5, ls = 26, llh = Math.round(ls * SLIP_LH), th = 28, x0 = M + t + pad;
      ctx.font = font(true, size); const lines = wrapText(ctx, b.note, W - pad * 2 - t * 2);
      const h = t * 2 + pad * 2 + llh + 4 + lines.length * lh;
      frame(M, y, W, h, t);
      const ty = y + t + pad, cx = x0 + th * 0.6, iy = ty + Math.round((llh - th) / 2);
      for(let r = 0; r < th; r++){ const w = Math.max(2, Math.round((r + 1) * 1.15)); rect(Math.round(cx - w / 2), iy + r, w, 1); }   // สามเหลี่ยมเตือน (วาดเอง สัญลักษณ์เตือนไม่มีในฟอนต์ และบางเครื่องเป็นอีโมจิสี)
      ops.push({clear:[cx - 2, iy + 9, 4, 10]}, {clear:[cx - 2, iy + 22, 4, 4]});   // เครื่องหมาย ! สีขาว
      text(b.label || 'หมายเหตุ', x0 + th * 1.2 + 8, ty, ls, true);
      lines.forEach((l, i) => text(l, x0, ty + llh + 4 + i * lh, size, true));
      y += h + 6; return;
    }
    if('box' in b){                                            // กรอบ กินเลย / กลับบ้าน
      const dbl = b.box === 'double', t = 4, pad = dbl ? 14 : 10, ls = Math.round(size * 0.5), llh = b.lead ? Math.round(ls * SLIP_LH) : 0;
      ctx.font = font(bold, size); const lines = wrapText(ctx, b.text, W - pad * 2 - 8);
      const h = t * 2 + pad * 2 + llh + lines.length * lh - Math.round(size * 0.2);
      frame(M, y, W, h, t); if(dbl) frame(M + t + 4, y + t + 4, W - (t + 4) * 2, h - (t + 4) * 2, 2);
      if(b.lead) text(b.lead, dots / 2, y + t + pad - 4, ls, true, 'center');
      lines.forEach((l, i) => text(l, dots / 2, y + t + pad + llh + i * lh - Math.round(size * 0.12), size, bold, 'center'));
      y += h + 8; return;
    }
    if('left' in b){                                           // ซ้าย · กลาง · ขวา
      const rx = M + W, mx = rx - PRICE_COL, mw = b.mid ? measure(b.mid, bold, size) + 16 : 0;
      ctx.font = font(bold, size);
      const lw = (b.mid ? mx - mw : rx - Math.max(PRICE_COL, measure(b.right || '', bold, size) + 16)) - M;
      wrapText(ctx, b.left, lw).forEach((t, i) => {
        text(t, M, y, size, bold);
        if(!i && b.mid) text(b.mid, mx, y, size, bold, 'right');
        if(!i && b.right) text(b.right, rx, y, size, bold, 'right');
        y += lh;
      });
      return;
    }
    const x0 = M + (b.indent || 0);
    if('tag' in b){                                            // ป้าย + ข้อความเยื้องตรงคอลัมน์
      const tb = b.tagBold ?? bold, tw = measure(b.tag, tb, size) + measure(' ', false, size);
      const col = b.col === 'auto' ? autoCol[size + '/' + (b.indent || 0)] : Math.max(b.col || 0, tw);
      ctx.font = font(bold, size);
      wrapText(ctx, b.text, M + W - x0 - col).forEach((t, i) => { if(!i) text(b.tag, x0, y, size, tb); text(t, x0 + col, y, size, bold); y += lh; });
      return;
    }
    ctx.font = font(bold, size);
    const al = b.align || 'left', x = al === 'center' ? dots / 2 : al === 'right' ? M + W : x0;
    wrapText(ctx, b.text, M + W - x0).forEach(t => { text(t, x, y, size, bold, al); y += lh; });
  });
  canvas.width = dots; canvas.height = Math.max(1, Math.ceil(y + tail));
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'alphabetic';
  ops.forEach(o => {
    if(o.rect){ ctx.fillStyle = '#000'; ctx.fillRect(...o.rect); return; }
    if(o.clear){ ctx.fillStyle = '#fff'; ctx.fillRect(...o.clear); return; }
    ctx.fillStyle = '#000'; ctx.font = font(o.bold, o.size); ctx.textAlign = o.align;
    ctx.fillText(o.t, o.x, o.y + Math.round(o.size * SLIP_BASE));
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
    this.dev = d; this.iface = f.iface; this.ep = f.ep; this.found = f; this.session = (this.session || 0) + 1;
    return d;
  }
  async send(data, chunk = PRINTER.chunk){
    if(!this.connected) throw new Error('ยังไม่ได้เชื่อมปริ้นเตอร์');
    /* ปิด/เชื่อมใหม่ระหว่างส่ง (เช่นหมดเวลา) → หยุด ห้ามส่งส่วนที่เหลือของงานเก่าผ่านการเชื่อมใหม่
       เทียบรอบการเชื่อม (session) ไม่ใช่ตัวอุปกรณ์ เพราะเชื่อมใหม่ได้ USBDevice ตัวเดิม */
    const dev = this.dev, ep = this.ep, sid = this.session;
    for(let i = 0; i < data.length; i += chunk){
      if(this.session !== sid || !this.dev) throw new Error('การเชื่อมเปลี่ยนระหว่างส่ง งานนี้ถูกยกเลิก');
      const r = await dev.transferOut(ep, data.subarray(i, i + chunk));
      if(r.status !== 'ok') throw new Error(`ส่งข้อมูลไม่สำเร็จ (${r.status}) ที่ byte ${i}`);
    }
    return data.length;
  }
  async close(){ const d = this.dev; this.dev = null; this.ep = null; this.session = (this.session || 0) + 1; if(d && d.opened){ try{ await d.releaseInterface(this.iface); }catch(e){} await d.close(); } }
  forget(){ this.dev = null; this.ep = null; this.session = (this.session || 0) + 1; }
}
