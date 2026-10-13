// QA หมวด 4 สิทธิ์ (U01 U04–U06) · 8 เงินสด/สำรอง (K02–K07) · 9 ข้อมูลไม่หาย (D02 D04 D08) · 10 ข้อความที่แสดง (X01 X03) · UI04
const {eq, done, open, wait, T} = require('./qa-helper');
const {IDBFactory} = require('fake-indexeddb');
const KEY = 'geek_popup_sales_v2', SKEY = 'geek_popup_settings';
const dump = p => Object.fromEntries(Object.keys(p.w.localStorage).map(k => [k, p.w.localStorage.getItem(k)]));
const XSS = '<img src=x onerror="window.__xss=1"><b>x</b>';
const injected = p => p.d.querySelectorAll('img[src="x"], #modal b.inj, #printArea img[src="x"]').length;

(async () => {
  const NOW = T(2026, 10, 12, 14, 0);
  let p = open({now: NOW}); await wait(30); p.signIn();
  let {$, $$, click, ev, add, pay, type} = p;

  // ---------- U01 ตารางสิทธิ์ ----------
  const perms = code => {
    p.signIn(code); const o = {};
    o.can = ev("['void', 'pastReports', 'promptpay', 'users'].map(can)");
    click('#btnSettings'); o.settings = ['[data-stock]', '#ppOpen', '#usrAdd', '#rcNew', '#bkSet', '#rsOpen'].map(s => !!$(s)); click('#closeX');
    add({menu:'acai'}); add({menu:'banana'}); click('#promoOpen'); o.promo = !!$('[data-pid="b1g1"]') && !$('[data-pid="b1g1"]').disabled; click('#promoCancel');
    const s = pay('tcp'); o.sale = !!s && s.staff;
    click('#btnSummary'); o.summary = ['[data-range]', '#repFrom', '#csvTab', '#closeDay'].map(x => !!$(x));
    click('[data-tab="bills"]'); o.csvAll = !!$('#csvAll'); o.reprint = !!$(`[data-prr="${s.id}"]`);
    click(`[data-v="${s.id}"]`); o.voidAsk = $('#pinIn') ? 'ขอรหัสเจ้าของ' : $('#cfYes') ? 'ยืนยัน' : '-';
    click($('#pinNo') ? '#pinNo' : '#cfNo'); click('#closeX');
    o.openPP = (ev('openPromptPay()'), !!$('#ppIn')); ev('closeModal()');
    o.openUser = (ev('openUserForm(null)'), !!$('#usrName')); ev('closeModal()');
    o.openRestore = (ev('openRestore(false)'), !!$('#rsFile')); ev('closeModal()');
    return o;
  };
  const staff = perms('1111'), owner = perms('1234');
  eq('U01 พนักงาน: ขาย โปร พิมพ์ซ้ำ ของหมด สรุปวันนี้+CSV ปิดร้าน สำรอง ✅ · ยอดวันอื่น สำรองทั้งหมด(CSV) ยกเลิก PromptPay พนักงาน กู้คืน นำกลับ ❌', staff,
    {can:[false, false, false, false], settings:[true, false, false, false, true, false], promo:true, sale:'แพร', summary:[false, false, true, true], csvAll:false, reprint:true, voidAsk:'ขอรหัสเจ้าของ', openPP:false, openUser:false, openRestore:false});
  eq('U01 เจ้าของ: ทำได้ทุกอย่าง', owner,
    {can:[true, true, true, true], settings:[true, true, true, true, true, true], promo:true, sale:'เจ้าของ', summary:[true, true, true, true], csvAll:true, reprint:true, voidAsk:'ยืนยัน', openPP:true, openUser:true, openRestore:true});

  // ---------- U04 ----------
  const u4 = ev(`[saveUser({name:'ต่าย', role:'staff'}, '1111'), deleteUser(USER.id), saveUser({id:'u1', name:'เจ้าของ', role:'staff'}, ''), (() => { const keep = USER; USER = null; const r = deleteUser('u1'); USER = keep; return r; })()]`);
  eq('U04 รหัสซ้ำ / ลบตัวเอง / ลดเจ้าของคนสุดท้าย / ลบเจ้าของคนสุดท้าย: ทำไม่ได้ทั้งหมด', u4, ['รหัสนี้มีคนใช้แล้ว', 'ลบตัวเองไม่ได้', 'ต้องมีเจ้าของอย่างน้อย 1 คน', 'ต้องมีเจ้าของอย่างน้อย 1 คน']);

  // ---------- K02 / K03 / V03 เงินสด ----------
  const day = '2026-10-12';
  ev(`addCash({type:'open', float:500})`);
  const cs0 = ev(`cashSales('${day}')`);
  add({menu:'acai'}); add({menu:'acai'}); click('#promoOpen'); click('[data-pid="b1g1"]'); click('#promoOk');
  const sk3 = pay('cash', 1000);
  const cs1 = ev(`cashSales('${day}')`);
  eq('K03 ขายเงินสดที่มีโปร: เงินสดขายใช้ยอดสุทธิ 189 (ไม่ใช่รับมา 1000 หรือ 378)', cs1.total - cs0.total, 189);
  add({menu:'banana'}); const sv = pay('cash', 200); add({menu:'banana'}); pay('promptpay');
  ev(`(() => { const a = loadSales(); const x = a.find(s => s.id === ${sv.id}); x.void = true; (x.log = []).push({act:'void', at:new Date().toISOString(), by:'เจ้าของ'}); saveSales(a); })()`);
  const cc = ev(`cashCount('${day}', dayFloat('${day}'), 0)`);
  eq('K02/V03 ควรมี = ตั้งต้น 500 + เงินสดขาย (ไม่นับ void และ PromptPay/ไทยช่วยไทย)', [cc.expected, ev(`cashSales('${day}').total`)], [500 + cs1.total, cs1.total]);
  eq('K02 ตรง / ขาด / เกิน', ev("[diffText(0), diffText(-38), diffText(62)]"), ['เงินตรง', 'ขาด ฿38', 'เกิน ฿62']);

  // ---------- U05 รหัสไม่ถูกเก็บเป็นตัวเลขเปล่า ----------
  const bkText = ev('JSON.stringify(backupData())'), csvAll = ev('csvText(billsCsvRows(loadSales()))');
  const userKeys = [...new Set(ev('SETTINGS.users').flatMap(u => Object.keys(u)))].sort();
  const plain = s => /"(1234|1111)"|:(1234|1111)[,}]/.test(s);
  eq('U05 ผู้ใช้เก็บแค่ id name role salt hash · ไม่มี "1234"/"1111" ใน localStorage ไฟล์สำรอง CSV', [userKeys, plain(JSON.stringify(dump(p))), plain(bkText), csvAll.includes('1234') || csvAll.includes('1111')],
    [['hash', 'id', 'name', 'role', 'salt'], false, false, false]);

  // ---------- UI04 การกระทำที่ย้อนไม่ได้มีหน้าต่างยืนยัน ----------
  const asks = [];
  add({menu:'acai'}); click('#btnClear'); asks.push(!!$('#cfYes') && ev('cart.length') === 1); click('#cfNo');
  click('#btnUser'); asks.push(!!$('#cfYes') && !$('#login').classList.contains('show')); click('#cfNo');
  click('#btnSummary'); click('[data-tab="bills"]'); click($$('[data-v]')[0]); asks.push(!!$('#cfYes')); click('#cfNo'); click('#closeX');
  ev(`saveUser({name:'ต่าย', role:'staff'}, '2222')`); click('#btnSettings'); click($$('[data-udel]')[0]); asks.push(!!$('#cfYes') && ev('users().length') === 3); click('#cfNo');
  click('#rcNew'); asks.push(!!$('#cfYes') && !$('.recov')); click('#cfNo'); click('#closeX');
  eq('UI04 ล้างออเดอร์ / ออกจากระบบ / ยกเลิกบิล / ลบพนักงาน / สร้างรหัสกู้คืนใหม่: มีหน้าต่างยืนยันก่อน', asks, [true, true, true, true, true]);
  click('#btnClear'); click('#cfYes');

  // ---------- D08 นาฬิกาเครื่องผิด ----------
  p.w.__now = T(2026, 10, 11, 14, 0);   // ย้อน 1 วัน
  const loginShown = (click('#btnSummary'), $('#login').classList.contains('show'));
  p.enter('1234'); if($('#floatSkip')) click('#floatSkip');
  add({menu:'banana'}); const back = pay('tcp');
  p.w.__now = T(2026, 10, 13, 14, 0);   // ล่วงหน้า 1 วัน
  p.signIn(); add({menu:'banana'}); const fwd = pay('tcp');
  eq('D08 ตั้งเวลาย้อน/ล่วงหน้า 1 วัน: ไม่พัง · ต้องเข้าระบบใหม่ · บิลเข้ารอบตามนาฬิกาเครื่อง', [loginShown, back.date, back.no, fwd.date, fwd.no, p.errors], [true, '2026-10-11', 1, '2026-10-13', 1, []]);
  p.w.__now = NOW + 3600000; p.signIn();

  // ---------- X01 ข้อความ HTML ในทุกช่อง ----------
  add({menu:'acai', note:XSS}); const sx = pay('cash', 500);
  ev(`(() => { const r = saveUser({name:'"><b class=inj>', role:'staff'}, '3333'); if(r) throw new Error(r); })()`);
  ev(`addCash({type:'close', date:'${day}', float:500, cashSales:0, cashBills:0, expected:500, counted:500, diff:0, note:${JSON.stringify(XSS)}})`);
  ev(`(() => { const a = loadSales(); a.find(s => s.id === ${sx.id}).staff = ${JSON.stringify(XSS)}; saveSales(a); })()`);
  click('#btnSummary'); const seen = [];
  for(const t of ['items', 'pay', 'opts', 'ingr', 'bills', 'staff']){ click(`[data-tab="${t}"]`); seen.push(injected(p)); }
  click('[data-tab="bills"]'); click(`[data-prr="${sx.id}"]`); click(`[data-prk="${sx.id}"]`); seen.push(injected(p));
  click('#closeX'); click('#btnSettings'); seen.push(injected(p)); click('#closeX');
  const blk = ev(`JSON.stringify(receiptBlocks(loadSales().find(s => s.id === ${sx.id})).concat(kitchenBlocks(loadSales().find(s => s.id === ${sx.id}))))`);
  eq('X01 หมายเหตุ/ชื่อพนักงาน/หมายเหตุปิดร้านที่เป็น HTML: ไม่ถูกตีความในหน้าสรุปทุกแท็บ ใบเสร็จ ตั๋วครัว ตั้งค่า', [seen, ev('window.__xss || 0')], [[0, 0, 0, 0, 0, 0, 0, 0], 0]);
  eq('X01 ตั๋ว USB เก็บเป็นข้อความธรรมดา', blk.includes('<img src=x'), true);
  add({menu:'acai', note:XSS}); eq('X01 ตะกร้าแสดงหมายเหตุเป็นข้อความ', [injected(p), $('#cart').textContent.includes('<img src=x')], [0, true]);
  click('#btnClear'); click('#cfYes');
  p.close();

  // X01 ชื่อเจ้าของตอนตั้งครั้งแรก
  p = open({now: NOW, seed:false}); await wait(30); ({$, click, ev, type} = p);
  $('#lgName').value = '<b class=inj>บอส</b>'; $('#lgCode').value = '9876'; $('#lgCode2').value = '9876'; click('#lgSave'); click('#lgDone');
  eq('X01 ชื่อเจ้าของตอนตั้งครั้งแรกที่เป็น HTML: แสดงเป็นข้อความ', [injected(p), $('#btnUser').textContent.includes('<b class=inj>')], [0, true]);

  // ---------- U06 รหัสกู้คืน ----------
  const rc1 = ev('newRecovery()'); const rc2 = ev('newRecovery()');
  eq('U06 สร้างรหัสกู้คืนใหม่ อันเก่าใช้ไม่ได้ · อันใหม่ใช้ได้ · เก็บแค่ hash', [ev(`recoveryOk('${rc1}')`), ev(`recoveryOk('${rc2}')`), ev('Object.keys(recoveryHash()).sort()')], [false, true, ['hash', 'salt']]);
  click('#btnUser'); click('#cfYes'); click('#lgForgot');
  '00000000'.split('').forEach(c => click(`[data-kp="${c}"]`)); click('#lgGo');
  const wrong = $('.lgmsg').textContent;
  rc2.split('').forEach(c => click(`[data-kp="${c}"]`)); click('#lgGo');
  $('#lgCode').value = '5555'; $('#lgCode2').value = '5555'; click('#lgSave');
  eq('U06 รหัสกู้คืนผิดใช้ไม่ได้ · ถูก → ตั้งรหัสใหม่ เข้าระบบได้ · รหัสเก่าใช้ไม่ได้', [wrong, ev('USER && USER.role'), ev("!!userByCode('5555')"), ev("!!userByCode('9876')")], ['รหัสกู้คืนไม่ถูกต้อง', 'owner', true, false]);
  p.close();

  // ---------- K04 / K05 / K06 / K07 สำรองและนำกลับ ----------
  p = open({now: NOW, settings:{promptpay:'0812345678', out:{menus:['banana'], items:['Kiwi']}}}); await wait(30); p.signIn(); ({$, click, ev, add, pay} = p);
  ev('newRecovery()'); ev(`addCash({type:'open', float:700})`);
  add({menu:'acai'}); pay('cash', 200); add({menu:'acai'}); pay('tcp');
  const file = ev('JSON.stringify(backupData())'), src = JSON.parse(file);
  p.close();
  p = open({now: NOW + 600000, seed:false}); await wait(30); ({$, click, ev} = p);
  click('#lgRestore'); ev(`restoreText(${JSON.stringify(file)})`); click('#rsApply');
  p.enter('1111');
  eq('K04 สำรอง → นำกลับบนเครื่องเปล่า: บิล ผู้ใช้ รหัสกู้คืน PromptPay ของหมด เงินสด log ครบ · เข้าด้วยรหัสเดิมได้',
    [ev('loadSales().length'), ev('users().length'), ev('!!recoveryHash()'), ev('SETTINGS.promptpay'), ev('SETTINGS.out'), ev("dayFloat('2026-10-12')"), ev('staffLog().length') >= src.staffLog.length, ev('USER && USER.name')],
    [2, 2, true, '0812345678', {menus:['banana'], items:['Kiwi']}, 700, true, 'แพร']);
  eq('K04 ของหมดจากไฟล์ใช้ทันที (Banana Choco กดไม่ได้)', !!$('[data-menu="banana"]'), false);
  p.signIn('1234');
  const cnt = () => [ev('loadSales().length'), ev('cashLog().length'), ev('staffLog().length')];
  const c0 = cnt();
  ev(`applyBackup(JSON.parse(${JSON.stringify(file)}), false)`); ev(`applyBackup(JSON.parse(${JSON.stringify(file)}), false)`);
  eq('K05 นำกลับไฟล์เดิมซ้ำ 2 ครั้ง: ไม่มีบิล / log เงินสด / log เข้าออกซ้ำ', cnt(), c0);
  const before = JSON.stringify(dump(p));
  const reject = t => { const r = ev(`parseBackup(${JSON.stringify(t)})`); return r.ok ? 'ผ่าน' : r.why; };
  const noFields = {...src, sales:[{id:1, date:'2026-10-01', items:[{menu:'acai'}]}]};
  eq('K06 ไฟล์เสีย / ไม่ใช่ไฟล์ของแอป / ver ใหม่กว่า: ปฏิเสธพร้อมเหตุผล', [reject(file.slice(0, 200)), reject(JSON.stringify({app:'x', sales:[]})), reject(JSON.stringify({...src, ver:2}))],
    ['ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป (อ่านไม่ได้)', 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป', 'ไฟล์มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน']);
  eq('K06 ปฏิเสธแล้วไม่เปลี่ยนอะไรในเครื่อง', JSON.stringify(dump(p)), before);
  eq('K06 บิลขาดฟิลด์ (ไม่มี dining method total tops): ปฏิเสธ', reject(JSON.stringify(noFields)) !== 'ผ่าน', true);
  if(reject(JSON.stringify(noFields)) === 'ผ่าน'){
    const p2 = open({now: NOW}); await wait(30); p2.signIn();
    p2.ev(`applyBackup(${JSON.stringify(noFields)}, false)`);
    let crash = ''; try{ p2.ev("REP.from = '2026-10-01'; REP.to = '2026-10-01'; REP.tab = 'items'; renderSummary()"); }catch(e){ crash = e.message; }
    eq('K06 หลังรับบิลขาดฟิลด์: หน้าสรุปยอดยังเปิดได้', crash, '');
    p2.close();
  }
  // K07 อีกเครื่องขายวันเดียวกัน
  const other = src.sales.map((s, i) => ({...s, id:s.id + 7777, no:i + 1, staff:'เครื่อง B'}));
  ev(`applyBackup(${JSON.stringify({...src, sales:other})}, false)`);
  const nos = ev("loadSales().filter(s => s.date === '2026-10-12').map(s => s.no)");
  console.log('INFO K07 เลขออเดอร์รอบ 12 ต.ค. หลังรวม 2 เครื่อง:', JSON.stringify(nos), '· เลขถัดไป', ev('nextNo()'));
  eq('K07 รวมบิลจากอีกเครื่องวันเดียวกัน: บิลไม่หาย (4 บิล)', nos.length, 4);
  p.close();

  // ---------- X03 ไฟล์สำรองที่ถูกแก้ให้มี HTML ----------
  const evil = JSON.parse(file);
  evil.sales[0].no = '<img src=x>'; evil.sales[0].items[0].name = '<img src=x>';
  evil.staffLog.push({at:new Date(NOW).toISOString(), date:'2026-10-12', id:'z', name:'z', role:'<img src=x>', act:'in'});
  evil.settings.users = evil.settings.users.concat([{id:'q"><img src=x>', name:'<img src=x>', role:'staff', salt:'s', hash:'h'}]);
  p = open({now: NOW, seed:false}); await wait(30); ({$, click, ev} = p);
  click('#lgRestore'); ev(`restoreText(${JSON.stringify(JSON.stringify(evil))})`); click('#rsApply'); p.enter('1234');
  const xs = {};
  click('#btnSummary'); click('[data-tab="items"]'); xs.items = injected(p);
  click('[data-tab="bills"]'); xs.bills = injected(p);
  click('[data-tab="staff"]'); xs.staff = injected(p);
  click('[data-tab="bills"]'); click(`[data-prk="${evil.sales[0].id}"]`); xs.print = p.d.querySelectorAll('#printArea img[src="x"]').length; click('#closeX');
  click('#btnSettings'); xs.settings = injected(p); click('#closeX');
  eq('X03 ไฟล์สำรองที่มี HTML ในเลขบิล/ชื่อรายการ/ตำแหน่งใน log/รหัสผู้ใช้: แสดงเป็นข้อความทุกหน้าจอ', xs, {items:0, bills:0, staff:0, print:0, settings:0});
  p.close();

  // ---------- D02 ข้อมูลเสียใน localStorage (Tee 2026-10-12) ----------
  const broken = '{"oops":';
  const salesLs = JSON.stringify([{id:T(2026, 10, 12, 9), no:1, date:'2026-10-12', ts:new Date(T(2026, 10, 12, 9)).toISOString(), dining:'dinein',
    items:[{menu:'banana', name:'Banana Choco', sizeName:'', tops:[], note:'', unit:149, qty:1}], total:149, method:'cash', received:149, change:0, void:false, staff:'แพร', staffId:'u2'}]);
  const corruptKeys = (q, k) => Object.keys(q.w.localStorage).filter(x => x.startsWith(k + '_corrupt_'));
  const A = require('../auth-helper');
  const RC = '13572468', rcSalt = 'rs1', rcHash = require('crypto').createHash('sha256').update(rcSalt + ':' + RC).digest('hex');
  {
    // ยอดขายพัง + IndexedDB
    const q = open({now: NOW, ls:{[KEY]:broken}, before: w => { w.indexedDB = new IDBFactory(); }}); await wait(60); q.signIn(); q.add({menu:'banana'}); q.pay('cash', 200);
    eq('D02 ยอดขาย (JSON พัง) + IndexedDB: เปิดได้ ขายได้ ไม่เขียนทับของเดิม', [!!q.$('#builder'), q.errors.length, q.w.localStorage.getItem(KEY) === broken], [true, 0, true]);
    q.close();
  }
  {
    // settings พัง · มีรหัสกู้คืน
    const q = open({now: NOW, seed:false, ls:{[SKEY]:broken, [KEY]:salesLs, [SKEY + '_recovery']:{salt:rcSalt, hash:rcHash}}}); await wait(40);
    const ck = corruptKeys(q, SKEY);
    eq('D02 settings พัง: เก็บข้อความเดิมไว้ที่ <key>_corrupt_<เวลา>', [ck.length, ck.length && q.w.localStorage.getItem(ck[0])], [1, broken]);
    eq('D02 settings พัง: ขึ้นหน้า "ข้อมูลตั้งค่าเสีย" ไม่ใช่ "ตั้งค่าครั้งแรก"', [q.$('#login').classList.contains('show'), !!q.$('#lgName'), q.$('#login').textContent.includes('ข้อมูลตั้งค่าเสีย'), !!q.$('#lgRestore'), q.$('#lgRebuild').disabled, q.$('#login').textContent.includes('ติดต่อผู้ดูแล (Tee)')],
      [true, false, true, true, false, true]);
    q.ev('showLogin()'); eq('D02 settings พัง: เรียก showLogin ซ้ำก็ยังเป็นหน้าข้อมูลเสีย', !!q.$('#lgName'), false);
    q.click('#lgRebuild'); '00000000'.split('').forEach(c => q.click(`[data-kp="${c}"]`)); q.click('#lgGo');
    eq('D02 เริ่มตั้งค่าใหม่: รหัสกู้คืนผิดใช้ไม่ได้', [q.$('.lgmsg').textContent, !!q.$('#lgName')], ['รหัสกู้คืนไม่ถูกต้อง', false]);
    RC.split('').forEach(c => q.click(`[data-kp="${c}"]`)); q.click('#lgGo');
    eq('D02 เริ่มตั้งค่าใหม่: รหัสกู้คืนถูก → หน้าสร้างเจ้าของ', !!q.$('#lgName'), true);
    q.$('#lgName').value = 'เจ้าของใหม่'; q.$('#lgCode').value = '4321'; q.$('#lgCode2').value = '4321'; q.click('#lgSave'); q.click('#lgDone');
    eq('D02 ตั้งเจ้าของใหม่แล้วเข้าใช้งานได้ · ข้อมูลเสียยังเก็บอยู่ · ยอดขายไม่ถูกแตะ', [q.ev('USER && USER.name'), q.ev('SETTINGS_BROKEN'), q.w.localStorage.getItem(ck[0]), q.w.localStorage.getItem(KEY) === salesLs, q.ev('loadSales().length')],
      ['เจ้าของใหม่', false, broken, true, 1]);
    q.close();
  }
  {
    // settings พัง · ไม่มีรหัสกู้คืน
    const q = open({now: NOW, seed:false, ls:{[SKEY]:'[1,2'}}); await wait(40);
    q.ev("LG = {mode:'setup', msg:''}; renderLogin()"); q.$('#lgName').value = 'x'; q.$('#lgCode').value = '1111'; q.$('#lgCode2').value = '1111'; q.click('#lgSave');
    eq('D02 ไม่มีรหัสกู้คืน: ปุ่มเริ่มตั้งค่าใหม่กดไม่ได้ บอกให้ติดต่อผู้ดูแล · บังคับเข้าหน้าตั้งค่าครั้งแรกเองก็สร้างเจ้าของไม่ได้', [q.ev('owners().length'), q.$('#login').textContent.includes('ข้อมูลตั้งค่าเสีย'), !!q.$('#lgRebuild') && q.$('#lgRebuild').disabled, q.$('#login').textContent.includes('เครื่องนี้ไม่มีรหัสกู้คืน')],
      [0, true, true, true]);
    q.close();
  }
  {
    // settings พัง · นำกลับจากไฟล์สำรอง
    const good = JSON.parse(file);
    const noOwner = {...good, settings:{...good.settings, users:good.settings.users.filter(u => u.role !== 'owner')}};
    const q = open({now: NOW, seed:false, ls:{[SKEY]:broken, [KEY]:salesLs}}); await wait(40);
    q.click('#lgRestore'); q.ev(`restoreText(${JSON.stringify(JSON.stringify(noOwner))})`);
    eq('D02 นำกลับไฟล์ที่ไม่มีเจ้าของ: ไม่ยอม (กันสร้างเจ้าของใหม่)', [q.$('#rsApply').disabled, q.$('#login').textContent.includes('ไม่มีรายชื่อเจ้าของ')], [true, true]);
    q.ev('restoreApply()'); eq('D02 เรียก restoreApply ตรงก็ไม่ยอม', q.ev('SETTINGS_BROKEN'), true);
    q.ev(`restoreText(${JSON.stringify(file)})`); q.click('#rsApply'); q.enter('1234');
    eq('D02 นำกลับไฟล์ที่มีเจ้าของ → เข้าด้วยรหัสเดิม · ยอดขายเดิม + ในไฟล์ · ข้อมูลเสียยังเก็บอยู่', [q.ev('USER && USER.name'), q.ev('SETTINGS_BROKEN'), q.ev('loadSales().length'), corruptKeys(q, SKEY).length],
      ['เจ้าของ', false, 1 + good.sales.length, 1]);
    q.close();
  }
  for(const [k, label, banner] of [[SKEY + '_cash', 'เงินสด', 'cashBanner'], [SKEY + '_staff_log', 'เข้า/ออก', 'staffLogBanner']]){
    const q = open({now: NOW, ls:{[k]:broken, [KEY]:salesLs}}); await wait(40);
    q.signIn('1111'); q.ev("addCash({type:'open', float:300})"); q.add({menu:'banana'}); q.pay('cash', 200);
    const ck = corruptKeys(q, k), cur = JSON.parse(q.w.localStorage.getItem(k));
    eq(`D02 ${label} พัง: เก็บของเดิมแยก · เริ่มรายการใหม่ · แถบแดงเตือน · ยอดขายไม่ถูกแตะ`,
      [ck.length, ck.length && q.w.localStorage.getItem(ck[0]), Array.isArray(cur) && cur.length > 0, !!q.d.getElementById(banner), q.ev('loadSales().length'), q.errors],
      [1, broken, true, true, 2, []]);
    q.close();
    const q2 = open({now: NOW + 1000, ls:{[k]:broken, [k + '_corrupt_1']:broken}}); await wait(40); q2.signIn(); q2.ev('cashLog(); staffLog()');
    eq(`D02 ${label} พังซ้ำแบบเดิม: ไม่เก็บสำเนาซ้ำ`, corruptKeys(q2, k).length, 1); q2.close();
  }
  {
    // คัดลอกของเสียไม่ได้ (พื้นที่เต็ม) → ห้ามทับของเดิม
    const q = open({now: NOW, ls:{[SKEY + '_cash']:broken}, before: w => { const set = w.Storage.prototype.setItem; w.Storage.prototype.setItem = function(k, v){ if(/_corrupt_/.test(k)) throw new Error('QuotaExceededError'); return set.call(this, k, v); }; }}); await wait(40);
    q.signIn(); const ok = q.ev("addCash({type:'open', float:300})");
    eq('D02 คัดลอกของเสียไม่ได้: ไม่เขียนทับข้อมูลเงินสดเดิม', [ok, q.w.localStorage.getItem(SKEY + '_cash')], [false, broken]);
    q.close();
  }
  {
    // migration รหัสกู้คืนจาก settings เวอร์ชันเก่า
    const q = open({now: NOW, settings:{recovery:{salt:rcSalt, hash:rcHash}}}); await wait(40);
    eq('D02 migration: รหัสกู้คืนย้ายไป key แยก ใช้ได้เหมือนเดิม · ไม่อยู่ใน settings แล้ว · ไฟล์สำรองยังมี recovery', [q.ev(`recoveryOk('${RC}')`), JSON.parse(q.w.localStorage.getItem(SKEY + '_recovery')).hash === rcHash, 'recovery' in JSON.parse(q.w.localStorage.getItem(SKEY)), q.ev('backupData().settings.recovery.hash') === rcHash],
      [true, true, false, true]);
    q.close();
  }

  // ---------- D04 IndexedDB เขียนไม่สำเร็จ ----------
  {
    const idb = new IDBFactory();
    const q = open({now: NOW, before: w => { w.indexedDB = idb; }}); await wait(60); q.signIn();
    eq('D04 โหมด IndexedDB', q.ev('STORE_MODE'), 'indexeddb');
    q.ev("(() => { const t = DB.transaction.bind(DB); DB.transaction = (...a) => { const tx = t(...a); const st = tx.objectStore('sales'); st.put = () => { throw new Error('write fail'); }; tx.objectStore = () => st; return tx; }; })()");
    q.add({menu:'acai'}); const s = q.pay('tcp'); await wait(40);
    const inLs = JSON.parse(q.w.localStorage.getItem(KEY)).some(x => x.id === s.id);
    const r = {fails: q.ev('DB_FAILS'), inLs, banner: !!q.d.getElementById('dbBanner')};
    const ls = dump(q); q.close();
    const q2 = open({now: NOW + 5000, seed:false, ls, before: w => { w.indexedDB = idb; }}); await wait(80);
    r.afterReload = q2.ev(`loadSales().some(x => x.id === ${s.id})`);
    const db = await new Promise(ok => { const o = idb.open(KEY); o.onsuccess = () => ok(o.result); });
    r.backInDb = await new Promise(ok => { const g = db.transaction('sales').objectStore('sales').get(s.id); g.onsuccess = () => ok(!!g.result); });
    db.close(); q2.close();
    eq('D04 IndexedDB เขียนไม่ได้: บิลยังอยู่ใน localStorage · เปิดใหม่แล้วกลับเข้า IndexedDB', [r.fails > 0, r.inLs, r.afterReload, r.backInDb], [true, true, true, true]);
    console.log('INFO D04 แถบเตือนตอน IndexedDB ล้มแต่ localStorage ยังเขียนได้:', r.banner ? 'มี' : 'ไม่มี (แสดงเมื่อเขียนไม่ได้ทั้งคู่เท่านั้น)');
  }
  done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
