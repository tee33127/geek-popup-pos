// QR PromptPay: payload ต้องตรงกับไลบรารี promptpay-qr (อ้างอิง) และ QR ที่วาดต้องสแกนกลับได้ข้อความเดิม (jsQR)
const vm = require('vm'), fs = require('fs'), path = require('path');
const generatePayload = require('promptpay-qr'), jsQR = require('jsqr');
const ctx = vm.createContext({});
['vendor/qrcode.js', 'promptpay.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js', f), 'utf8'), ctx, {filename:f}));
const ev = c => vm.runInContext(c, ctx);
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };

const TAX = '1234567890121', PHONE = '0812345678', EW = '004999000288505';   // เลขตัวอย่าง (หลักตรวจสอบถูก) ไม่ใช่เลขจริงของร้าน
for(const id of [TAX, PHONE, EW]) for(const amt of [1, 69, 189, 1234.5, 0]){
  ctx.id = id; ctx.amt = amt;
  eq(`payload ${id} ฿${amt} = promptpay-qr`, ev('PP.payload(id, amt)'), generatePayload(id, amt ? {amount:amt} : {}));
}
ctx.id = '1-2345-67890-12-1';
eq('payload ignores dashes', ev('PP.payload(id, 99)'), generatePayload(TAX, {amount:99}));
eq('type detect', ev(`[PP.type('${TAX}'), PP.type('${PHONE}'), PP.type('${EW}'), PP.type('123456789'), PP.type('1812345678')]`), ['tax', 'phone', 'ewallet', null, null]);
eq('tax checksum ok', ev(`PP.taxIdOk('${TAX}')`), true);
eq('tax checksum catches typo', ev(`[PP.taxIdOk('1234567890122'), PP.taxIdOk('1234567809121')]`), [false, false]);
eq('problem messages', ev(`[PP.problem('${TAX}'), PP.problem('${PHONE}'), PP.problem(''), PP.problem('12345').includes('5 หลัก'), PP.problem('1234567890122').includes('หลักตรวจสอบ')]`),
  ['', '', 'ยังไม่ได้ใส่เลข', true, true]);
eq('format', ev(`[PP.format('${TAX}'), PP.format('${PHONE}')]`), ['1-2345-67890-12-1', '081-234-5678']);
let threw = false; try{ ev("PP.payload('123', 10)"); }catch(e){ threw = true; } eq('bad id throws', threw, true);

// วาด QR เป็นภาพ แล้วให้ jsQR อ่านกลับ
for(const [id, amt] of [[TAX, 189], [PHONE, 1], [TAX, 1234.5]]){
  ctx.id = id; ctx.amt = amt;
  const text = ev('PP.payload(id, amt)'), m = ev('qrMatrix(PP.payload(id, amt))'), S = 6, Q = 4, n = m.length, W = (n + Q * 2) * S;
  const px = new Uint8ClampedArray(W * W * 4).fill(255);
  m.forEach((row, r) => row.forEach((on, c) => { if(on) for(let y = 0; y < S; y++) for(let x = 0; x < S; x++){ const i = (((r + Q) * S + y) * W + (c + Q) * S + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; } }));
  const got = jsQR(px, W, W);
  eq(`QR scans back ${id} ฿${amt}`, got && got.data, text);
}
const svg = ev(`qrSvg(PP.payload('${TAX}', 189), 230)`);
eq('svg', [svg.startsWith('<svg class="qr"'), svg.includes('width="230"'), (svg.match(/h1v1h-1z/g) || []).length > 200], [true, true, true]);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
