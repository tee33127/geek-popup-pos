/* QR PromptPay ใส่ยอด (มาตรฐาน EMVCo / Thai QR Payment) สร้างในเครื่อง ใช้ได้แม้ไม่มีเน็ต
   - PP.payload(id, amount) : ข้อความใน QR · ฟังก์ชันล้วน ไม่แตะ DOM (เทสต์เทียบกับ promptpay-qr)
   - qrMatrix / qrSvg       : วาด QR ด้วย js/vendor/qrcode.js (qrcode-generator, MIT) */
const PP = {
  clean: s => String(s || '').replace(/\D/g, ''),
  /* เบอร์มือถือ 10 หลัก · เลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก · e-Wallet 15 หลัก */
  type(id){ id = PP.clean(id); return id.length === 10 && id[0] === '0' ? 'phone' : id.length === 13 ? 'tax' : id.length === 15 ? 'ewallet' : null; },
  /* หลักสุดท้ายของเลข 13 หลักคือหลักตรวจสอบ (mod 11) จับเลขพิมพ์ผิดได้ */
  taxIdOk(id){
    if(!/^\d{13}$/.test(id)) return false;
    let sum = 0; for(let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
    return (11 - sum % 11) % 10 === Number(id[12]);
  },
  /* ข้อความบอกว่าเลขผิดตรงไหน ('' = ใช้ได้) */
  problem(id){
    id = PP.clean(id);
    if(!id) return 'ยังไม่ได้ใส่เลข';
    const t = PP.type(id);
    if(!t) return `เลขมี ${id.length} หลัก ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตร/ผู้เสียภาษี 13 หลัก`;
    if(t === 'tax' && !PP.taxIdOk(id)) return 'เลข 13 หลักไม่ถูกต้อง (หลักตรวจสอบไม่ตรง) ลองเช็กว่าพิมพ์ผิดหรือไม่';
    return '';
  },
  /* แสดงผลแบบแบ่งกลุ่ม อ่านง่าย */
  format(id){
    id = PP.clean(id); const t = PP.type(id);
    if(t === 'phone') return id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    if(t === 'tax') return id.replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, '$1-$2-$3-$4-$5');
    return id;
  },
  crc16(s){   // CRC-16/CCITT-FALSE (poly 0x1021, เริ่ม 0xFFFF)
    let c = 0xFFFF;
    for(let i = 0; i < s.length; i++){ c ^= s.charCodeAt(i) << 8; for(let k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1; c &= 0xFFFF; }
    return c.toString(16).toUpperCase().padStart(4, '0');
  },
  payload(id, amount){
    id = PP.clean(id); const t = PP.type(id);
    if(!t) throw new Error('เลข PromptPay ไม่ถูกต้อง');
    const f = (tag, v) => tag + String(v.length).padStart(2, '0') + v;
    const target = t === 'phone' ? '0066' + id.slice(1) : id;   // เบอร์: 0812345678 → 0066812345678
    const s = f('00', '01') + f('01', amount ? '12' : '11') +   // 12 = QR ใช้ครั้งเดียวมียอด · 11 = QR ถาวร
      f('29', f('00', 'A000000677010111') + f({phone:'01', tax:'02', ewallet:'03'}[t], target)) +
      f('58', 'TH') + f('53', '764') + (amount ? f('54', Number(amount).toFixed(2)) : '') + '6304';
    return s + PP.crc16(s);
  },
};

/* ข้อความ → ตาราง QR (true = จุดดำ) */
function qrMatrix(text){
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount();
  return Array.from({length:n}, (_, r) => Array.from({length:n}, (_, c) => q.isDark(r, c)));
}
/* ข้อความ → <svg> QR (มีขอบขาว 4 ช่องตามมาตรฐาน) */
function qrSvg(text, size = 240){
  const m = qrMatrix(text), n = m.length, Q = 4; let d = '';
  m.forEach((row, r) => row.forEach((on, c) => { if(on) d += `M${c + Q} ${r + Q}h1v1h-1z`; }));
  return `<svg class="qr" viewBox="0 0 ${n + Q * 2} ${n + Q * 2}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR PromptPay">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
