// เปิดร้าน (เงินทอนตั้งต้น) · ปิดร้าน (นับเงิน) · สำรองข้อมูล · นำข้อมูลกลับ (เครื่องเดิม / เครื่องใหม่)
const {JSDOM} = require('jsdom'); const fs = require('fs');
const F = require('../flow-helper');
const A = require('../auth-helper');
const html = fs.readFileSync(require('path').join(__dirname, '../../prototype/pos.html'), 'utf8');
let errors = [];
const open = seed => new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){
    w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); if(seed) A.seed(w);
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function(){ w.__dl = {name:this.download}; };
  }}).window;
let w = open(true), d = w.document;
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing ' + s); el.click(); };
/* รอเหตุการณ์จริง ไม่รอเวลา (Tee 2026-10-18 · เทสต์ต้องผลนิ่ง): โหลดยอดขายเสร็จ (storeReady) + promise ที่ค้างทำครบ (1 macrotask) */
const {flush} = require('../vclock');
const ev = c => w.eval(c), ready = async () => { await w.eval('storeReady'); await flush(); };
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const enter = code => { code.split('').forEach(c => click(`[data-kp="${c}"]`)); click('#lgGo'); };
const type = (sel, v) => { const i = $(sel); i.value = v; i.dispatchEvent(new w.Event('input')); };
const sell = async (menu, method) => { F.menu(w, menu); F.finish(w); click('#btnPay'); click('[data-dine="dinein"]'); click(`[data-method="${method}"]`); if(method === 'cash') click('[data-q="500"]'); click('#payOk'); await ready(); click('#nextOrder'); };
const today = () => ev('bizDate(new Date())');

(async () => {
  await ready();
  // ---- เปิดร้าน: ถามเงินทอนตั้งต้นหลังเข้าระบบ ----
  enter('1111');
  eq('float asked after sign-in', [!!$('#floatIn'), $('#floatOk').disabled], [true, true]);
  click('#floatSkip'); eq('skip closes', $('#modal').classList.contains('show'), false);
  click('#btnUser'); click('#cfYes'); enter('1111');
  eq('asked again while not set', !!$('#floatIn'), true);
  click('[data-fq="500"]'); eq('quick amount fills', [$('#floatIn').value, $('#floatOk').disabled], ['500', false]);
  type('#floatIn', '1,0x00'); eq('digits only', $('#floatIn').value, '1000');
  click('#floatOk'); eq('float saved', ev(`dayFloat('${today()}')`), 1000);
  click('#btnUser'); click('#cfYes'); enter('1111'); eq('not asked once set', !!$('#floatIn'), false);

  // ---- ขาย: เงินสด 2 บิล (189 + 149) · PromptPay 1 บิล · ยกเลิกเงินสด 1 บิล (เจ้าของ) ----
  await sell('acai', 'cash'); await sell('banana', 'cash'); await sell('acai', 'promptpay'); await sell('banana', 'cash');
  ev("(() => { const all = loadSales(); const x = all[3]; x.void = true; x.log = [{act:'void', at:new Date().toISOString(), by:'เจ้าของ'}]; saveSales(all); })()");
  eq('cash sales exclude void + promptpay', ev(`cashSales('${today()}')`), {total:338, bills:2});

  // ---- ปิดร้าน (พนักงานทำได้) ----
  click('#btnSummary'); click('#closeDay');
  eq('close screen: float prefilled, expected = 1000 + 338', [$('#clFloat').value, $('#clExp').textContent, $('#clSave').disabled], ['1000', '฿1,338', true]);
  type('#clCount', '1300');
  eq('short shown in red', [$('#clDiff').textContent, $('#clDiff').classList.contains('bad'), $('#clSave').disabled], ['ขาด ฿38', true, false]);
  type('#clCount', '1400'); eq('over', [$('#clDiff').textContent, $('#clDiff').classList.contains('over')], ['เกิน ฿62', true]);
  type('#clCount', '1338'); eq('exact', [$('#clDiff').textContent, $('#clDiff').classList.contains('ok')], ['เงินตรง', true]);
  type('#clFloat', ''); eq('float required', [$('#clSave').disabled, $('#clDiff').textContent, $('#clExp').textContent], [true, 'ใส่เงินทอนตั้งต้นก่อน', '–']);
  type('#clFloat', '1000'); type('#clCount', '1300'); $('#clNote').value = 'ทอนผิด';
  click('#clSave');
  const c1 = ev('cashLog()').filter(c => c.type === 'close').pop();
  eq('close saved', [c1.float, c1.cashSales, c1.expected, c1.counted, c1.diff, c1.by, c1.note], [1000, 338, 1338, 1300, -38, 'แพร', 'ทอนผิด']);
  eq('done screen offers backup + logout', [$('.change').textContent, !!$('#bkNow'), !!$('#clLogout'), $('#modal').textContent.includes('ยังไม่เคยสำรองข้อมูล')], ['ขาด ฿38', true, true, true]);

  // ---- สำรองข้อมูล (พนักงานทำได้) ----
  click('#bkNow');
  eq('backup dialog, no huge textarea', [$('#modal').textContent.includes('สำรองข้อมูล'), !!$('#csvDl'), !!$('#csvText'), /\.json$/.test(ev('csvPending.filename'))], [true, true, false, true]);
  const file = ev('csvPending.text'), data = JSON.parse(file);
  eq('backup has everything', [data.app, data.sales.length, data.settings.users.length, data.cash.length, data.staffLog.length > 0, data.by], ['geek-popup-pos', 4, 2, 2, true, 'แพร']);
  click('#csvDl');
  eq('download marks last backup', [w.__dl && /geek-popup-backup-.*\.json/.test(w.__dl.name), !!ev('SETTINGS.lastBackup')], [true, true]);
  click('#csvBack');

  // ---- รายงาน: ตารางนับเงิน · นับใหม่ใช้ครั้งล่าสุด ----
  click('#btnSummary'); click('[data-tab="pay"]');
  eq('pay tab shows count', $$('#modal tr').some(tr => tr.textContent.includes('฿1,338') && tr.textContent.includes('-฿38') && tr.textContent.includes('ทอนผิด')), true);
  eq('summary shows last backup', $('#modal').textContent.includes('สำรองล่าสุด'), true);
  click('#closeDay'); eq('re-count warns previous', $('#modal').textContent.includes('นับไปแล้วเมื่อ'), true);
  type('#clCount', '1338'); click('#clSave'); click('#closeX');
  click('#btnSummary'); click('[data-tab="pay"]');
  eq('latest count used', [$$('#modal tr').some(tr => tr.textContent.includes('ตรง')), $$('#modal tr').some(tr => tr.textContent.includes('-฿38'))], [true, false]);
  click('#closeX');

  // ---- สิทธิ์: นำข้อมูลกลับ = เจ้าของ ----
  click('#btnSettings'); eq('staff: backup yes, restore no', [!!$('#bkSet'), !!$('#rsOpen')], [true, false]);
  ev('openRestore(false)'); eq('restore blocked for staff', !!$('#rsFile'), false);
  click('#closeX');

  // ---- นำกลับในเครื่องเดิม: ไม่ซ้ำ ไม่ลบ ใช้ฉบับที่ใหม่กว่า ----
  click('#btnUser'); click('#cfYes'); enter('1234'); if($('#floatSkip')) click('#floatSkip');
  click('#btnSettings'); click('#rsOpen');
  eq('restore dialog', [!!$('#rsFile'), $('#rsApply').disabled], [true, true]);
  ev("restoreText('not json')"); eq('bad file', $('#modal').textContent.includes('ไม่ใช่ไฟล์สำรองของแอป'), true);
  ev(`restoreText(${JSON.stringify(JSON.stringify({app:'other', sales:[]}))})`); eq('foreign file', $('#modal').textContent.includes('ไม่ใช่ไฟล์สำรองของแอป'), true);
  const old = JSON.parse(file); old.sales[3].void = false; delete old.sales[3].log;   // ไฟล์เก่า: บิล #4 ยังไม่ถูกยกเลิก
  old.sales.push({...old.sales[0], id:old.sales[0].id - 86400000, no:1, date:'2030-01-01'});   // บิลที่เครื่องไม่มี
  ev(`restoreText(${JSON.stringify(JSON.stringify(old))})`);
  eq('preview counts', [$('#rsApply').textContent, $('#modal').textContent.includes('บิลในไฟล์5')], ['นำข้อมูลกลับ · 1 บิลใหม่', true]);
  eq('settings checkbox off by default', $('#rsSettings').checked, false);
  click('#rsApply');
  const after = ev('loadSales()');
  eq('merged: +1 bill, void kept (longer log wins)', [after.length, after.find(s => s.id === data.sales[3].id).void], [5, true]);
  eq('owner still signed in, users unchanged', [ev('USER.name'), ev('users().length')], ['เจ้าของ', 2]);
  eq('cash log not duplicated (open + 2 counts)', ev('cashLog().length'), 3);

  // ---- เครื่องใหม่: นำข้อมูลกลับก่อนตั้งเจ้าของ แล้วเข้าด้วยรหัสเดิม ----
  const full = ev('JSON.stringify(backupData())');
  w.close(); w = open(false); d = w.document; await ready();
  eq('new device: setup screen with restore link', [!!$('#lgName'), !!$('#lgRestore')], [true, true]);
  click('#lgRestore'); eq('restore inside login screen', [!!$('#login #rsFile'), $('#login').classList.contains('show')], [true, true]);
  ev(`restoreText(${JSON.stringify(full)})`);
  eq('login restore uses staff from file', $('#login').textContent.includes('เข้าระบบด้วยรหัสเดิม'), true);
  click('#rsApply');
  eq('back to keypad, data restored', [!!$('[data-kp]'), ev('loadSales().length'), ev('users().map(u => u.name)'), ev('dayFloat(bizDate(new Date()))')], [true, 5, ['เจ้าของ', 'แพร'], 1000]);
  enter('1111'); eq('old staff code works on new device', [$('#login').classList.contains('show'), ev('USER.name')], [false, 'แพร']);

  eq('no runtime errors', errors, []);
  w.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
