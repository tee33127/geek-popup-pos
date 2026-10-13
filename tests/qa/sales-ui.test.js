// QA หน้าจอขาย + ชำระเงิน (P03–P26 ส่วนหน้าจอ, PR09–PR13, C01–C14) · jsdom เปิด prototype/pos.html
const {eq, done, open, wait, T} = require('./qa-helper');

(async () => {
  let p = open({now: T(2026, 10, 12, 12, 0)}); await wait(30); p.signIn();
  let {$, $$, click, ev, add, pay} = p;
  const addBtn = () => $('#btnAdd').textContent;
  const kitchen = s => ev(`(() => { const d = document.createElement('div'); d.innerHTML = kitchenHtml(${JSON.stringify(s)}); return d.textContent; })()`);
  const clearCart = () => { while($$('#cart .rm').length) click($$('#cart .rm')[0]); };

  // ---------- ราคา: หน้าต่างถาม ----------
  add({menu:'greek', size:'g1n', picks:['Banana', 'Mango']});
  eq('P03 69 + 2 ชิ้น = 99 → เสนอเปลี่ยนเป็น 89 (ปุ่มหลัก = เปลี่ยน)', [!!$('#cheapSwitch'), $('#cheapSwitch').className, $('#cheapKeep').className, $('#cheapSwitch').textContent.includes('89')], [true, 'pay', 'ghost wide', true]);
  click('#cheapSwitch');
  eq('P03 กดเปลี่ยน → ถามต่อว่าท็อปปิ้งฟรีไม่ครบ 3 (เลือก 2)', [!!$('#fewBack'), $('#modal h3').textContent.includes('2 จาก 3')], [true, true]);
  click('#fewOk'); eq('P03 ยืนยันแค่ 2 อย่าง → 89 fewTops 2', [ev('cart[0].unit'), ev('cart[0].sizeName'), ev('cart[0].fewTops')], [89, '1 สกู๊ป', 2]);
  clearCart();
  add({menu:'greek', size:'g1n', picks:['Banana', 'Mango'], answer:'cheapKeep'});
  eq('P03 กดคงไว้ → 99 ไซส์ 69', [ev('cart[0].unit'), ev('cart[0].sizeName')], [99, '1 สกู๊ป · ท็อปปิ้งชิ้นละ 15']); clearCart();

  add({menu:'greek', size:'g1'});
  eq('P04 89 ไม่เลือกท็อปปิ้ง → ถามและเสนอ 69 ไม่ใส่ท็อปปิ้ง', [!!$('#fewBack'), !!$('#fewPlain'), $('#fewPlain') && $('#fewPlain').textContent.includes('69')], [true, true, true]);
  click('#fewPlain'); eq('P04 เลือกเปลี่ยน → 69', [ev('cart[0].unit'), ev('cart[0].tops.length')], [69, 0]); clearCart();

  add({menu:'greek', size:'g1', picks:['Granola', 'Blueberries', 'Strawberries']});
  eq('P08 ฟรี 0/3 → ถาม "ลูกค้าไม่เอาท็อปปิ้งฟรี"', [!!$('#fewOk'), $('#fewOk') && $('#fewOk').textContent], [true, 'ลูกค้าไม่เอาท็อปปิ้งฟรี']);
  click('#fewOk'); eq('P08 ยอด 129 fewTops 0', [ev('cart[0].unit'), ev('cart[0].fewTops')], [129, 0]); clearCart();

  add({menu:'greek', size:'g1', picks:['Banana', 'Banana'], answer:'fewOk'});
  const s9 = pay('promptpay');
  eq('P09 89 + กล้วย ×2 ยืนยัน 2 อย่าง → บิล fewTops 2 · ตั๋วครัวพิมพ์ "ลูกค้าเลือก 2 อย่าง · ตักปริมาณปกติ"', [s9.total, s9.items[0].fewTops, kitchen(s9).includes('ลูกค้าเลือก 2 อย่าง · ตักปริมาณปกติ')], [89, 2, true]);

  // P05 ตัวนับ · P12 สลับขนาด
  click('[data-menu="greek"]'); click('[data-size="g1"]'); click('[data-pick="Banana"]'); click('[data-more="Banana"]'); click('[data-more="Banana"]');
  eq('P05 ตัวนับ ฟรี 3/3 ราคา 89', [$('.cnt').textContent, addBtn().includes('฿89')], ['ฟรี 3/3', true]);
  click('[data-pick="Granola"]');
  const sz = s => { click(`[data-size="${s}"]`); return [ev('sel.picks.length'), addBtn().match(/฿([\d,]+)/)[1]]; };
  eq('P12 สลับ 89 → 69 → 129 → 89 ท็อปปิ้งไม่หาย ราคาใหม่ถูก', [sz('g1n'), sz('g2'), sz('g1')], [[4, '129'], [4, '139'], [4, '99']]);
  click('[data-menu="acai"]');

  // P13 / P20 น้ำผึ้ง
  eq('P13 Acai ต้องเลือกน้ำผึ้งก่อน กดเพิ่มไม่ได้', [$('#btnAdd').disabled, addBtn().startsWith('เลือกน้ำผึ้งก่อน')], [true, true]);
  click('[data-menu="banana"]');
  eq('P20 Banana Choco ไม่มีขั้นน้ำผึ้ง กดเพิ่มได้', [!!$('[data-honey]'), $('#btnAdd').disabled], [false, false]);
  click('#btnAdd'); eq('P20 บิล Banana ไม่มีฟิลด์ honey', ev('"honey" in cart[0]'), false); clearCart();

  // P22 เปลี่ยนข้ามหมวดไม่มีให้เลือก
  click('[data-menu="acai"]'); click('[data-swap="0"]');
  const opts0 = $$('[data-choose][data-slot="0"]').map(b => b.dataset.choose);
  click('[data-swap="3"]'); const opts3 = $$('[data-choose][data-slot="3"]').map(b => b.dataset.choose);
  eq('P22 ช่องกล้วย (ผลไม้) เลือกได้เฉพาะผลไม้ · ช่องกราโนล่า (ของแห้ง) เฉพาะของแห้ง', [opts0.sort(), opts3.includes('Almonds'), opts3.includes('Banana'), opts3.includes('Caramel')],
    [['Blueberries', 'Kiwi', 'Mango', 'Strawberries'], true, false, false]);

  // P23 ปุ่มแยก
  for(let i = 0; i < 5; i++) click(`[data-skip="${i}"]`);
  eq('P23 Acai ไม่รับทุกช่อง: ไม่มีปุ่มแยก', !!$('.sep'), false);
  click('[data-addopen]'); click('[data-add="Mango"]');
  eq('P23 ไม่รับทุกช่องแต่เพิ่มมะม่วง: มีปุ่มแยก (มีท็อปปิ้งในแก้ว)', !!$('.sep'), true);
  click('[data-menu="greek"]'); click('[data-size="g1"]');
  eq('P23 Greek ไม่ใส่ท็อปปิ้ง: ไม่มีปุ่มแยก', !!$('.sep'), false);

  // P25 รวมบรรทัด · P26 + / − / ถังขยะ
  const cupA = {menu:'acai', honey:'normal'};
  add(cupA); add(cupA);
  eq('P25 แก้วเหมือนกัน 2 ครั้ง รวมเป็น ×2', [ev('cart.length'), ev('cart[0].qty')], [1, 2]);
  add({...cupA, note:'ไม่เอาช้อน'}); add({...cupA, honey:'lots'}); add({...cupA, sep:true});
  eq('P25 ต่างกันที่หมายเหตุ / น้ำผึ้ง / แยก = แยกบรรทัด', ev('cart.map(i => i.qty)'), [2, 1, 1, 1]);
  click('[data-p="1"]'); eq('P26 + เพิ่มจำนวน ยอดถูก', [ev('cart[1].qty'), $('#total').textContent], [2, '฿1,139']);
  click('[data-m="1"]'); click('[data-m="1"]');
  eq('P26 − จนเหลือ 0 บรรทัดหาย', [ev('cart.length'), $('#total').textContent], [3, '฿761']);
  click('[data-r="0"]'); eq('P26 ถังขยะลบทั้งบรรทัด', [ev('cart.length'), $('#total').textContent], [2, '฿383']);
  clearCart();

  // ---------- โปรในหน้าจอ ----------
  add({menu:'acai'}); add({menu:'banana'});
  click('#promoOpen'); click('[data-pid="b1g1"]'); click('#promoOk');
  eq('PR09 ใช้ 1 แถม 1 ยอด 189', [ev('promo.id'), $('#total').textContent], ['b1g1', '฿189']);
  click('#promoOpen'); click('[data-pid="off30"]'); click('[data-ptarget="1"]'); click('#promoOk');
  eq('PR09 เลือกโปรใหม่แทนที่ ไม่ซ้อน (ลด 30 จาก Banana)', [ev('promo.id'), $('#total').textContent, ev('promo.key === cart[1].key')], ['off30', '฿308', true]);
  click('[data-r="1"]');
  eq('PR10 แก้วเป้าหมายถูกลบ → ย้ายไป Acai', [ev('promo && promo.id'), ev('promo && promo.key === cart[0].key'), $('#total').textContent], ['off30', true, '฿159']);
  click('#promoOpen'); click('[data-pid="freetop"]');
  eq('PR10 ปุ่มโปรที่ไม่เข้าเงื่อนไขกดไม่ได้ (ฟรี 1 ท็อปปิ้ง ไม่มีชิ้นที่ต้องจ่าย)', $('[data-pid="freetop"]').disabled, true);
  click('#promoNone'); add({menu:'banana'});
  click('#promoOpen'); click('[data-pid="b1g1"]'); click('#promoOk');
  click('[data-r="1"]');
  eq('PR10 ตะกร้าไม่เข้าเงื่อนไข → ยกเลิกโปรเองพร้อมแจ้ง', [ev('promo'), $('#toast').textContent.includes('ยกเลิกโปร')], [null, true]);
  add({menu:'banana', adds:['Mango']});
  click('#promoOpen'); click('[data-pid="b1g1"]'); click('#promoOk');
  const s11 = pay('cash', 500);
  eq('PR11 บิลที่ใช้โปร: total = เต็ม − ส่วนลด · unit = ราคาเต็ม · promo ครบ', [s11.total, s11.items.map(i => i.unit), Object.keys(s11.promo).sort(), s11.promo.discount, s11.change],
    [189 + 164 - 149, [189, 164], ['detail', 'discount', 'id', 'name'], 149, 500 - 204]);

  // PR13 QR ใช้ยอดหลังหักโปร
  ev("saveSettings({...SETTINGS, promptpay:'0812345678'}); window.__amt = []; const __p = PP.payload; PP.payload = (id, a) => { window.__amt.push(a); return __p(id, a); };");
  add({menu:'acai'}); add({menu:'acai'}); click('#promoOpen'); click('[data-pid="off30"]'); click('#promoOk');
  click('#btnPay'); click('[data-dine="takeaway"]'); click('[data-method="promptpay"]');
  eq('PR13 QR PromptPay ใช้ยอดสุทธิ 348', [ev('window.__amt.pop()'), !!$('.ppqr svg')], [348, true]);
  click('#payCancel'); clearCart();

  // ---------- ชำระเงิน ----------
  ev('openPay()'); eq('C01 ตะกร้าว่าง: ปุ่มชำระกดไม่ได้ ไม่เปิดหน้าชำระ', [$('#btnPay').disabled, $('#btnPay2').disabled, $('#modal').classList.contains('show')], [true, true, false]);
  add({menu:'greek', size:'g1', picks:['Banana', 'Banana', 'Banana', 'Mango', 'Granola']});   // 114
  click('#btnPay');
  eq('C02 ยังไม่เลือกกินเลย/กลับบ้าน: ปุ่มวิธีจ่ายกดไม่ได้ ยืนยันไม่ได้', [$$('[data-method]').every(b => b.disabled), $('#payOk').disabled], [true, true]);
  click('[data-method="cash"]'); eq('C02 กดวิธีจ่ายตอนยังไม่เลือก ไม่มีผล', ev('pay.method'), null);
  click('[data-dine="dinein"]'); click('[data-method="cash"]');
  const recv = v => { const r = $('#recv'); r.value = v; r.oninput(); };
  recv('100'); eq('C03 ยอด 114 รับ 100 ยืนยันไม่ได้ "ยังขาด ฿14"', [$('#payOk').disabled, $('.change').textContent.trim()], [true, 'ยังขาด ฿14']);
  const quick = v => { click(`[data-q="${v}"]`); return $('.change').textContent.trim(); };
  eq('C04 ปุ่มลัด พอดี/20/50/100/500/1000', [quick(114), quick(20), quick(50), quick(100), quick(500), quick(1000)], ['เงินทอน ฿0', 'ยังขาด ฿94', 'ยังขาด ฿64', 'ยังขาด ฿14', 'เงินทอน ฿386', 'เงินทอน ฿886']);
  recv('1a2.0-0'); eq('C04 พิมพ์ตัวอักษร จุด ติดลบ: รับเฉพาะตัวเลข', [ev('pay.received'), $('#recv').value], [1200, '1200']);
  recv('-500'); eq('C04 ติดลบกลายเป็นบวก (ตัด - ทิ้ง)', ev('pay.received'), 500);
  click('[data-method="tcp"]'); eq('C05 ไทยช่วยไทย พลัส ยืนยันได้ ทอน 0', [$('#payOk').disabled, ev('pay.received')], [false, 0]);
  ev('delete SETTINGS.promptpay'); click('[data-method="promptpay"]');
  eq('C05 PromptPay ไม่มีเลข: เตือนแต่ยืนยันได้', [!!$('.ppwarn'), $('#payOk').disabled], [true, false]);
  click('[data-method="cash"]'); click('[data-q="500"]');

  // C06 กดยืนยันรัวๆ
  const before = ev('loadSales().length'), ok = $('#payOk');
  for(let i = 0; i < 5; i++) ok.click();
  for(let i = 0; i < 5; i++) ok.dispatchEvent(new p.w.MouseEvent('click', {bubbles:true}));
  eq('C06 กด #payOk 10 ครั้ง ได้บิลเดียว', ev('loadSales().length') - before, 1);
  click('#nextOrder');

  // C07 เรียก confirmPay() ตรงๆ
  const n7 = ev('loadSales().length');
  ev('confirmPay()');
  eq('C07 confirmPay() หลังขายเสร็จ (ตะกร้าว่าง) ไม่สร้างบิล', ev('loadSales().length') - n7, 0);
  if($('#nextOrder')) click('#nextOrder');
  add({menu:'acai'}); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="cash"]'); recv('100');
  const n7b = ev('loadSales().length'); ev('confirmPay()');
  eq('C07 confirmPay() เงินสดไม่พอ (189 รับ 100) ไม่สร้างบิล', ev('loadSales().length') - n7b, 0);
  if($('#nextOrder')) click('#nextOrder'); else click('#payCancel');

  // C08 กดชำระตอน IndexedDB ยังโหลดไม่เสร็จ
  add({menu:'acai'}); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="tcp"]');
  ev("STORE_MODE = 'loading'"); const n8 = ev('loadSales().length'); click('#payOk');
  const toastNow = $('#toast').style.display === 'block' ? $('#toast').textContent : '';
  eq('C08 ยังโหลดไม่เสร็จ: ไม่บันทึก', ev('loadSales().length') - n8, 0);
  eq('C08 ยังโหลดไม่เสร็จ: มีข้อความบอกให้รอ', /รอ|โหลด/.test(toastNow), true);
  ev("STORE_MODE = 'localstorage'"); click('#payOk'); click('#nextOrder');

  // C10 ยกเลิกแล้วเลขไม่ถูกใช้ซ้ำ · C12 แถบหัว · C13 ล้างหลังชำระ
  const nos = ev('loadSales().map(s => s.no)'), last = nos[nos.length - 1];
  ev("(() => { const a = loadSales(); const x = a[a.length - 1]; x.void = true; (x.log = []).push({act:'void', at:new Date().toISOString(), by:'เจ้าของ'}); saveSales(a); updateNext(); })()");
  const hdr = $('#nextNo').textContent;
  add({menu:'banana'}); click('#promoOpen'); click('#promoCancel');
  const s10 = pay('tcp');
  eq('C10 ยกเลิกบิลล่าสุดแล้วขายต่อ เลขไม่ซ้ำ', [s10.no, nos.includes(s10.no)], [last + 1, false]);
  eq('C12 "ออเดอร์ #NNN" บนแถบหัว ตรงกับเลขที่บิลได้จริง', hdr, `ออเดอร์ #${String(s10.no).padStart(3, '0')}`);
  eq('C13 หลังชำระ ตะกร้า โปร ตัวเลือก ล้างหมด · บิลเก็บ staff/staffId', [ev('cart.length'), ev('promo'), ev('sel.menu'), s10.staff, s10.staffId], [0, null, null, 'เจ้าของ', 'u1']);
  eq('P/C ไม่มี runtime error', p.errors, []);
  p.close();

  // ---------- C09 / C14 ข้าม 23:00 ----------
  p = open({now: T(2026, 10, 12, 22, 58)}); await wait(30); p.signIn(); ({$, click, ev, add, pay} = p);
  add({menu:'acai'}); const a1 = pay('tcp');
  add({menu:'acai'}); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="tcp"]');
  p.w.__now = T(2026, 10, 12, 23, 0, 30);
  click('#payOk');
  eq('C14 ข้าม 23:00 ระหว่างหน้าชำระ: กลับหน้าเข้าระบบ ตะกร้ายังอยู่ ไม่บันทึก', [$('#login').classList.contains('show'), ev('cart.length'), ev('loadSales().length')], [true, 1, 1]);
  p.enter('1111'); if($('#floatSkip')) click('#floatSkip');
  const a2 = pay('tcp');
  eq('C09/C14 บิลแรกรอบ 12 ต.ค. = 001 · หลัง 23:00 ได้วันรอบใหม่ 13 ต.ค. และเลข 001', [a1.date, a1.no, a2.date, a2.no, a2.staff], ['2026-10-12', 1, '2026-10-13', 1, 'แพร']);
  p.close();

  // ---------- C11 บิลที่ 1000 ในรอบเดียว ----------
  const many = Array.from({length:999}, (_, i) => ({id:T(2026, 10, 12, 10) + i, no:i + 1, date:'2026-10-12', ts:new Date(T(2026, 10, 12, 10) + i).toISOString(), dining:'dinein',
    items:[{menu:'banana', name:'Banana Choco', sizeName:'', tops:[], note:'', unit:149, qty:1}], total:149, method:'cash', received:149, change:0, void:false, staff:'แพร', staffId:'u2'}));
  p = open({now: T(2026, 10, 12, 18, 0), ls:{geek_popup_sales_v2: many}}); await wait(30); p.signIn();
  eq('C11 ขายไปแล้ว 999 บิลในรอบ: บิลถัดไปได้เลข', p.ev('nextNo()'), 1);   // ⚠️ คำถาม: วนกลับเป็น 001 ซ้ำกับบิลแรกของวัน
  p.close();
  done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
