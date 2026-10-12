// เข้าใช้งานด้วยรหัส + สิทธิ์ (Tee 2026-10-12)
// ตั้งเจ้าของครั้งแรก + รหัสกู้คืน · แป้นรหัส · ชื่อในบิล/ใบเสร็จ · พนักงาน: ยอดวันนี้เท่านั้น ยกเลิกบิลต้องใช้รหัสเจ้าของ
// ตั้งค่าแยกตามตำแหน่ง · จัดการพนักงาน · ออกจากระบบ · รีเฟรชไม่หลุด · ขึ้นรอบใหม่ต้องเข้าใหม่ · ลืมรหัสเจ้าของ
const {JSDOM} = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../../prototype/pos.html'), 'utf8');
let errors = [], store = {}, offsetH = 0;
/* เปิดหน้าใหม่โดยใช้ localStorage ชุดเดิม (จำลองรีเฟรช) · offsetH = เลื่อนเวลาไปข้างหน้า */
const open = () => new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){
    w.print = () => {}; w.addEventListener('error', e => errors.push(e.message));
    Object.entries(store).forEach(([k, v]) => w.localStorage.setItem(k, v));
    const WD = w.Date; w.Date = class extends WD { constructor(...a){ a.length ? super(...a) : super(WD.now() + offsetH * 3600e3); } static now(){ return WD.now() + offsetH * 3600e3; } };
  }}).window;
let w = open(), d = w.document;
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing ' + s); el.click(); };
const ev = c => w.eval(c), wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const keys = code => code.split('').forEach(c => click(`[data-kp="${c}"]`));
const enter = code => { keys(code); click('#lgGo'); };
const shown = () => $('#login').classList.contains('show');
const save = () => { store = {}; for(let i = 0; i < w.localStorage.length; i++){ const k = w.localStorage.key(i); store[k] = w.localStorage.getItem(k); } };
const reopen = async () => { save(); w.close(); w = open(); d = w.document; await wait(60); };
const settings = () => JSON.parse(w.localStorage.getItem('geek_popup_settings') || '{}');
const type = (sel, v) => { $(sel).value = v; };
const sell = async menu => { click(`[data-menu="${menu}"]`); if($('[data-honey]')) click('[data-honey="normal"]'); click('#btnAdd'); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="cash"]'); click('[data-q="500"]'); click('#payOk'); await wait(80); click('#nextOrder'); };

(async () => {
  await wait(60);
  // ---- ครั้งแรก: ตั้งเจ้าของ ----
  eq('first run shows setup', [shown(), !!$('#lgName'), !!$('[data-kp]'), $('#btnUser').style.display], [true, true, false, 'none']);
  type('#lgName', 'ตี๋'); type('#lgCode', '12'); type('#lgCode2', '12'); click('#lgSave');
  eq('code must be 4 digits', $('.lgmsg').textContent, 'รหัสต้องเป็นตัวเลข 4 หลัก');
  type('#lgName', 'ตี๋'); type('#lgCode', '4321'); type('#lgCode2', '4322'); click('#lgSave');
  eq('codes must match', $('.lgmsg').textContent, 'รหัสสองช่องไม่ตรงกัน');
  type('#lgName', ''); type('#lgCode', '4321'); type('#lgCode2', '4321'); click('#lgSave');
  eq('name required', $('.lgmsg').textContent, 'ใส่ชื่อก่อน');
  type('#lgName', 'ตี๋'); type('#lgCode', '4321'); type('#lgCode2', '4321'); click('#lgSave');
  const rc = $('.recov').textContent.replace(/\s/g, '');
  eq('recovery code shown once (8 digits)', /^\d{8}$/.test(rc), true);
  const st = settings();
  eq('owner saved with hash, no plain code', [st.users.length, st.users[0].role, st.users[0].name, JSON.stringify(st).includes('4321'), JSON.stringify(st).includes(rc), st.users[0].hash.length], [1, 'owner', 'ตี๋', false, false, 64]);
  click('#lgDone');
  eq('signed in as owner', [shown(), $('#btnUser').textContent.includes('ตี๋'), $('#btnUser').textContent.includes('เจ้าของ')], [false, true, true]);
  eq('no hardcoded PIN left', ev('typeof CONFIG.pin'), 'undefined');

  // ---- เจ้าของเพิ่มพนักงาน ----
  click('#btnSettings');
  eq('owner sees PromptPay, staff list, recovery', [!!$('#ppOpen'), !!$('#usrAdd'), !!$('#rcNew'), $$('[data-uedit]').length], [true, true, true, 1]);
  eq('cannot delete self', !!$('[data-udel]'), false);
  click('#usrAdd'); eq('new user defaults to staff', $('[data-urole].on').dataset.urole, 'staff');
  type('#usrName', 'แพร'); type('#usrCode', '4321'); type('#usrCode2', '4321'); click('#usrSave');
  eq('duplicate code rejected', $('#modal .ppmsg').textContent.includes('รหัสนี้มีคนใช้แล้ว'), true);
  type('#usrName', 'แพร'); type('#usrCode', '1111'); type('#usrCode2', '1111'); click('#usrSave');
  eq('staff added', [settings().users.map(u => [u.name, u.role]), !!$('[data-udel]')], [[['ตี๋', 'owner'], ['แพร', 'staff']], true]);
  click($$('[data-uedit]')[0]); click('[data-urole="staff"]'); type('#usrName', 'ตี๋'); click('#usrSave');
  eq('last owner cannot become staff', $('#modal .ppmsg').textContent.includes('ต้องมีเจ้าของอย่างน้อย 1 คน'), true);
  click('#usrCancel'); click('#closeX');

  // ---- เจ้าของขาย 1 บิล: ชื่อในบิล + ใบเสร็จ ----
  await sell('acai');
  const s1 = ev('loadSales()')[0];
  eq('sale stores staff', [s1.staff, !!s1.staffId], ['ตี๋', true]);
  eq('receipt prints staff name', [ev('receiptHtml(loadSales()[0])').includes('พนักงาน: ตี๋'), ev('receiptBlocks(loadSales()[0])').some(b => b.text === 'พนักงาน: ตี๋')], [true, true]);

  // ---- ออกจากระบบ ----
  click('#btnUser'); click('#cfYes');
  eq('logout shows keypad', [shown(), $$('[data-kp]').length, $('#btnUser').style.display], [true, 12, 'none']);
  keys('999'); eq('3 digits: button disabled', $('#lgGo').disabled, true); keys('9');
  eq('4 digits: no auto login, button enabled', [shown(), $('#lgGo').disabled, $('#lgGo').textContent], [true, false, 'เข้าสู่ระบบ']);
  click('#lgGo'); eq('wrong code', [shown(), $('.lgmsg').textContent, $$('.dots i.on').length], [true, 'รหัสไม่ถูกต้อง', 0]);
  keys('11'); click('[data-kp="back"]'); eq('backspace', $$('.dots i.on').length, 1); click('[data-kp="clear"]');
  enter('1111'); eq('staff signed in', [shown(), $('#btnUser').textContent.includes('แพร'), $('#btnUser').textContent.includes('เจ้าของ')], [false, true, false]);
  eq('login log records in/out', JSON.parse(w.localStorage.getItem('geek_popup_settings_staff_log')).map(l => [l.name, l.act]), [['ตี๋', 'in'], ['ตี๋', 'out'], ['แพร', 'in']]);

  // ---- สิทธิ์พนักงาน ----
  await sell('banana');
  eq('staff sale stores staff', ev('loadSales()')[1].staff, 'แพร');
  click('#btnSummary');
  click('[data-tab="bills"]'); eq('staff: today only, no date range, no full backup', [!!$('#repFrom'), !!$('[data-range]'), !!$('#csvAll'), $('#modal').textContent.includes('พนักงานดูได้เฉพาะรอบขายวันนี้'), !!$('#csvTab')], [false, false, false, true, true]);
  ev("REP.from = REP.to = '2020-01-01'; renderSummary()"); eq('staff cannot force another day', ev('REP.from') === ev('bizDate(new Date())'), true);
  click('[data-tab="bills"]');
  eq('bills tab shows who', $('#modal').textContent.includes('แพร') && $('#modal').textContent.includes('ตี๋'), true);
  click($$('[data-v]')[0]);
  eq('staff void asks owner code', [!!$('#pinIn'), $('#modal').textContent.includes('ต้องใช้รหัสเจ้าของ')], [true, true]);
  $('#pinIn').value = '1111'; click('#pinOk'); eq('staff code rejected', $('#modal').textContent.includes('รหัสนี้ไม่ใช่รหัสเจ้าของ'), true);
  $('#pinIn').value = '0000'; click('#pinOk'); eq('wrong code rejected', $('#modal').textContent.includes('รหัสไม่ถูกต้อง'), true);
  click('#pinNo'); eq('cancel returns to summary', $('#modal').textContent.includes('สรุปยอดขาย'), true);
  click('[data-tab="bills"]'); click($$('[data-v]')[0]); $('#pinIn').value = '4321'; click('#pinOk');
  eq('owner code → confirm', $('#modal').textContent.includes('ยกเลิกบิล #002?'), true);
  click('#cfYes');
  const v = ev('loadSales()').find(x => x.void);
  eq('void logged with owner name, bill keeps seller', [v.no, v.staff, v.log[0].by], [2, 'แพร', 'ตี๋']);
  click('[data-tab="bills"]'); eq('history shows who voided', $('#modal').textContent.includes('โดย ตี๋'), true);
  click('[data-tab="staff"]');
  eq('staff tab: per-person totals + login log', [$$('#modal tr').some(tr => tr.textContent.includes('ตี๋') && tr.textContent.includes('฿189')), $$('#modal tr').some(tr => /แพร.*เข้า/.test(tr.textContent))], [true, true]);
  eq('CSV has staff column', ev('billsCsvRows(loadSales())').map(r => r[11]), ['พนักงาน', 'ตี๋', 'แพร']);
  click('#closeX');
  click('#btnSettings');
  eq('staff settings: stock only', [!!$('[data-stock]'), !!$('#ppOpen'), !!$('#usrAdd'), !!$('#rcNew'), $('#modal').textContent.includes('เจ้าของเป็นคนตั้ง')], [true, false, false, false, true]);
  ev('openPromptPay(); openUserForm(null)'); eq('owner screens blocked for staff', [!!$('#ppIn'), !!$('#usrName')], [false, false]);
  click('#closeX');

  // ---- รีเฟรช: ยังเข้าอยู่ · ขึ้นรอบขายใหม่: ต้องเข้าใหม่ ----
  await reopen();
  eq('reload keeps session', [shown(), $('#btnUser').textContent.includes('แพร')], [false, true]);
  offsetH = 30; await reopen();
  eq('next business day asks again', [shown(), !!$('[data-kp]')], [true, true]);
  offsetH = 0;

  // ---- ลืมรหัสเจ้าของ: รหัสกู้คืน ----
  click('#lgForgot'); enter('00000000'); eq('wrong recovery', $('.lgmsg').textContent, 'รหัสกู้คืนไม่ถูกต้อง');
  enter(rc); eq('recovery → set new owner code', [!!$('#lgCode'), $('.lgsub').textContent.includes('ตี๋')], [true, true]);
  type('#lgCode', '1111'); type('#lgCode2', '1111'); click('#lgSave'); eq('new code must be unique', $('.lgmsg').textContent, 'รหัสนี้มีคนใช้แล้ว');
  type('#lgCode', '5678'); type('#lgCode2', '5678'); click('#lgSave');
  eq('owner signed in with new code', [shown(), $('#btnUser').textContent.includes('ตี๋')], [false, true]);
  click('#btnUser'); click('#cfYes'); enter('4321'); eq('old owner code no longer works', shown(), true);
  click('[data-kp="clear"]'); enter('5678'); eq('new owner code works', shown(), false);

  // ---- เจ้าของ: ดูย้อนหลังได้ ลบพนักงานได้ ----
  click('#btnSummary'); click('[data-tab="bills"]'); eq('owner sees date range + backup', [!!$('#repFrom'), !!$('#csvAll')], [true, true]); click('#closeX');
  click('#btnSettings'); click('[data-udel]'); click('#cfYes');
  eq('staff deleted, code dead', [settings().users.map(u => u.name), ev("userByCode('1111')")], [['ตี๋'], null]);
  click('#closeX');
  eq('old bills keep deleted staff name', ev('loadSales()')[1].staff, 'แพร');

  eq('no runtime errors', errors, []);
  w.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
