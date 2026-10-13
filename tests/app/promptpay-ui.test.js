// หน้าตั้งค่า PromptPay (ผ่าน PIN) + QR บนหน้าชำระเงิน · เปิด app/ แบบแยกไฟล์ใน jsdom
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const A = require('../auth-helper');
const generatePayload = require('promptpay-qr');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [];
JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w); w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const type = (sel, v) => { const i = $(sel); i.value = v; i.dispatchEvent(new w.Event('input')); };
  const toPay = () => { $('[data-menu="acai"]').click(); finish(w); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="promptpay"]').click(); };
  w.addEventListener('load', async () => {
    A.signIn(w);
    await wait(50);
    // ยังไม่ตั้งเลข → เตือน ไม่มี QR แต่ยังยืนยันได้
    toPay();
    eq('no id: warning, no QR', [!!$('.ppwarn'), !!$('#modal svg.qr')], [true, false]);
    eq('no id: can still confirm', $('#payOk').disabled, false);
    $('#payCancel').click();
    // ตั้งค่า (แถบหัว) → PIN → เลข PromptPay
    $('#btnSettings').click();
    eq('settings shows PromptPay not set', $('#modal').textContent.includes('ยังไม่ได้ตั้ง'), true);
    $('#ppOpen').click();
    eq('settings opened, empty', [!!$('#ppIn'), $('#ppIn').value], [true, '']);
    type('#ppIn', '12345'); eq('short number rejected', [$('#ppMsg').textContent.includes('5 หลัก'), $('#setSave').disabled, !!$('#ppPrev svg')], [true, true, false]);
    type('#ppIn', '1234567890122'); eq('bad checksum rejected', [$('#ppMsg').textContent.includes('หลักตรวจสอบ'), $('#setSave').disabled], [true, true]);
    type('#ppIn', '1-2345-67890-12-1'); eq('valid: test QR ฿1 shown', [$('#setSave').disabled, !!$('#ppPrev svg.qr'), $('#ppMsg').textContent.includes('1-2345-67890-12-1')], [false, true, true]);
    $('#setSave').click();
    eq('saved digits only, back to settings', [JSON.parse(w.localStorage.getItem('geek_popup_settings')).promptpay, $('#modal').textContent.includes('1-2345-67890-12-1'), $('#ppOpen').textContent], ['1234567890121', true, 'เปลี่ยน']);
    $('#ppOpen').click(); eq('reopen shows digits only (formatted number in message)', [$('#ppIn').value, $('#ppMsg').textContent.includes('1-2345-67890-12-1')], ['1234567890121', true]); $('#setBack').click(); $('#closeX').click();
    // หน้าชำระเงินแสดง QR ยอดบิล
    $('#btnClear').click(); if($('#cfYes')) $('#cfYes').click();
    toPay();
    eq('QR shown with amount', [!!$('#modal svg.qr'), $('.ppamt').textContent, !$('.ppwarn')], [true, '฿189', true]);
    eq('payload matches reference', w.eval("PP.payload(SETTINGS.promptpay, cartTotal())"), generatePayload('1234567890121', {amount:189}));
    $('#payOk').click(); await wait(100);
    eq('sale saved as promptpay', JSON.parse(w.localStorage.getItem('geek_popup_sales_v2')).slice(-1)[0].method, 'promptpay');
    // ลบเลข (บันทึกแบบว่าง)
    $('#nextOrder').click(); $('#btnSettings').click(); $('#ppOpen').click();
    type('#ppIn', ''); eq('empty warns removal', $('#ppMsg').textContent.includes('ลบเลขเดิม'), true); $('#setSave').click();
    eq('cleared', JSON.parse(w.localStorage.getItem('geek_popup_settings')).promptpay, undefined);
    eq('no runtime errors', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
