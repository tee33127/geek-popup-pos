const {JSDOM} = require('jsdom'); const fs = require('fs');
const A = require('../auth-helper');
const html = fs.readFileSync(require('path').join(__dirname,'../../prototype/pos.html'),'utf8');
let printed = 0, errors = [], nativeCalls = 0;
const dom = new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w); w.print = () => printed++; w.confirm = () => { nativeCalls++; return false; }; w.prompt = () => { nativeCalls++; return null; }; w.addEventListener('error', e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
A.signIn(w);
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing '+s); el.click(); };
const ev = c => w.eval(c), wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`); };
/* เพิ่มลงออเดอร์: น้ำผึ้งไม่มีค่าเริ่มต้น จึงเลือก 'ราดปกติ' ให้ก่อนถ้ายังไม่เลือก (เทสต์เรื่องน้ำผึ้งเองอยู่ส่วน 0) */
const F = require('../flow-helper');
const menu = id => F.menu(w, id), size = id => F.size(w, id), honey = id => F.honey(w, id), off = () => F.off(w);
/* เพิ่มลงออเดอร์: น้ำผึ้ง 'ราดปกติ' (ถ้ายังไม่เลือก) → เพิ่ม · หยุดเมื่อมีหน้าต่างถาม (ตอบแล้วแก้วลงตะกร้าเลย) */
const add = () => F.finish(w);
/* ช่องสรุปแก้วในแถบล่าง */
const tq = () => $('.cupsum .tq').getAttribute('aria-label'), xtra = () => $('.cupsum .xtra');   // "ฟรี ●●○" อ่านจำนวนจาก aria-label
/* ราคาบนปุ่ม: ปุ่มบอกราคาเมื่อครบแล้ว จึงเลือกน้ำผึ้ง 'ราดปกติ' ให้ก่อนถ้ายังไม่เลือก (น้ำผึ้งไม่มีผลกับราคา) */
const chipCnt = el => ((el.closest('.topw').querySelector('small').textContent.match(/(\d+) ชิ้น/) || [])[1] || '');   // จำนวนอยู่บรรทัดล่างของปุ่ม "n ชิ้น"
const addPrice = () => { if($('[data-honey]') && !$('.hon.on')) click('[data-honey="normal"]'); return $('#btnAdd').textContent.match(/฿([\d,]+)/)[1].replace(',',''); };

(async () => {
  // ---- 0) น้ำผึ้งต้องเลือกเองทุกแก้ว + แยกท็อปปิ้ง +5 ต่อแก้ว (Tee 2026-10-12) ----
  menu('acai');
  eq('acai: toppings + honey open together, primary grey "เลือกน้ำผึ้งก่อน · ฿189"', [$$('.sec').map(s => s.dataset.step), $('#btnAdd').textContent, off(), $$('.hon.on').length], [['menu', 'tops', 'honey'], 'เลือกน้ำผึ้งก่อน · ฿189', true, 0]);
  click('#btnAdd'); eq('grey add does nothing', ev('cart.length'), 0);
  click('[data-honey="side"]'); eq('honey chosen: add enabled, side honey free', [off(), $('#btnAdd').textContent, addPrice()], [false, 'เพิ่มลงออเดอร์ · ฿189', '189']);
  eq('sep button shown, off', [!!$('.sep'), $('.sep').classList.contains('on'), $('.sep b').textContent], [true, false, '+฿5']);
  eq('sep is a switch row (no dashed frame), label + price', [$('.sep').getAttribute('role'), $('.sep').getAttribute('aria-checked'), !!$('.sep .sw:not(.on)'), $('.sep .nm').textContent, /dashed/.test(w.getComputedStyle($('.sep')).borderTopStyle)], ['switch', 'false', true, 'แยกท็อปปิ้ง · ใส่ถ้วยแยก +฿5', false]);
  eq('sep row tap target >= 44px (CSS min-height)', parseInt(w.getComputedStyle($('.sep')).minHeight) >= 44, true);
  click('.sep'); eq('sep on: +5', [$('.sep').classList.contains('on'), addPrice()], [true, '194']);
  eq('sep on: switch on + aria-checked', [$('.sep').getAttribute('aria-checked'), !!$('.sep .sw.on')], ['true', true]);
  add(); eq('item stores sep 5 + honey side', [ev('cart[0].unit'), ev('cart[0].sep'), ev('cart[0].honey')], [194, 5, 'side']);
  eq('builder reset: honey cleared, sep off', [ev('sel.honey'), ev('sel.sep')], [null, false]);
  menu('acai'); honey('side'); click('.sep'); add();
  eq('same cup twice merges, +5 per cup', [ev('cart.length'), ev('cart[0].qty'), ev('cartTotal()')], [1, 2, 388]);
  eq('cart shows sep line', $('#cart .d').textContent.includes('แยกท็อปปิ้ง (+5)'), true);
  menu('acai'); honey('side'); add();
  eq('without sep = separate line at 189', [ev('cart.length'), ev('cart[1].unit'), ev('"sep" in cart[1]')], [2, 189, false]);
  menu('banana'); eq('banana: no honey needed', off(), false);
  click('.sep'); eq('banana + sep = 154', addPrice(), '154'); click('#btnAdd');
  menu('greek'); size('g1n');
  eq('greek without toppings: no sep button', !!$('.sep'), false);
  click('[data-pick="Banana"]'); click('.sep'); eq('greek 69 + Banana + sep = 89', addPrice(), '89');
  click('[data-less="Banana"]'); eq('last topping removed: sep hidden, not charged', [!!$('.sep'), addPrice()], [false, '69']);
  click('[data-pick="Banana"]'); eq('topping back: sep still on', [$('.sep').classList.contains('on'), addPrice()], [true, '89']);
  menu('acai'); for(let k = 0; k < 5; k++) click(`[data-skip="${k}"]`);
  eq('acai with every topping removed: no sep button', !!$('.sep'), false);
  while($$('#cart .rm').length) click($$('#cart .rm')[0]);
  // ---- 1a) Greek ไม่เลือกขนาดไว้ก่อน (Tee 2026-10-13): ไม่แสดงท็อปปิ้ง ปุ่มเพิ่มกดไม่ได้ ----
  const cart0 = ev('cart.length');
  menu('greek');
  eq('greek: no size preselected → no toppings, add says เลือกขนาดก่อน', [ev('sel.size'), $$('.size.on').length, $$('[data-pick]').length, $$('.stitle').some(x => x.textContent.includes('ท็อปปิ้ง')), off(), $('#btnAdd').textContent, !!$('[data-size]')],
    [null, 0, 0, false, true, 'เลือกขนาดก่อน', true]);
  eq('honey step not shown before size', !!$('[data-honey]'), false);
  click('#btnAdd'); ev('addSel()'); eq('blocked add does nothing (button + direct call)', ev('cart.length'), cart0);
  eq('priceSel / priceItem with size null do not crash', [ev('priceSel().unit'), ev('priceSel().needSize'), ev('priceSel().tops.length'), ev('priceItem(MENU.greek, {size:null, picks:["Banana"], sep:true}).unit')], [0, true, 0, 0]);
  size('g1'); eq('size chosen: toppings + honey appear together, then 89', [$$('.sec').map(s => s.dataset.step), $('#btnAdd').textContent, addPrice()], [['menu', 'size', 'tops', 'honey'], 'เลือกน้ำผึ้งก่อน · ฿89', '89']);
  menu('acai'); menu('greek'); eq('switching menu back: size not remembered', ev('sel.size'), null);
  // ---- 1) ท็อปปิ้งซ้ำได้ ----
  menu('greek'); size('g1');
  click('[data-pick="Banana"]');
  eq('tap selects 1: count 1 shown on the chip + − inside the chip, no separate selected row', [ev('sel.picks'), chipCnt($('[data-pick="Banana"]')), $('[data-pick="Banana"] small').textContent, !!$('.topw.on [data-less="Banana"]'), !!$('.trow'), !!$('[data-more]')], [['Banana'], '1', '1 ชิ้น', true, false, false]);
  click('[data-pick="Banana"]'); eq('tap again = +1 (no longer removes)', ev('sel.picks'), ['Banana', 'Banana']);
  click('[data-less="Banana"]'); click('[data-less="Banana"]'); eq('− to 0 removes', [ev('sel.picks'), !!$('[data-less="Banana"]')], [[], false]);
  click('[data-pick="Banana"]'); click('[data-pick="Banana"]'); click('[data-pick="Banana"]');
  eq('Banana x3: count 3 shown as "3 ชิ้น" (free quota, nothing charged)', [chipCnt($('[data-pick="Banana"]')), $('[data-pick="Banana"] small').textContent], ['3', '3 ชิ้น']);
  eq('Banana x3 all free', addPrice(), '89');
  eq('free counter ●●● (3 of 3), no numbers shown, no over badge', [tq(), $('.cupsum .tq').textContent.trim(), $$('.fdots i.on').length, xtra()], ['ใช้ท็อปปิ้งฟรีแล้ว 3 จาก 3', 'ฟรี', 3, null]);
  eq('unselected free chip shows +15 at quota', $('[data-pick="Kiwi"] small').textContent, '+15');
  click('[data-pick="Banana"]'); eq('4th Banana +15', addPrice(), '104');
  eq('charge badge', xtra().textContent, 'คิดเพิ่ม +฿15');
  eq('over chip styled orange', $('[data-pick="Banana"]').closest('.topw').classList.contains('over'), true);
  click('[data-less="Banana"]'); eq('minus back to x3', addPrice(), '89');
  click('[data-pick="Kiwi"]'); click('[data-pick="Kiwi"]'); click('[data-less="Kiwi"]'); click('[data-less="Kiwi"]'); eq('− twice removes a ×2 item', ev('sel.picks'), ['Banana','Banana','Banana']);
  eq('no charge badge within quota', xtra(), null);
  click('[data-pick="Granola"]'); click('[data-pick="Granola"]'); eq('Granola x2 = +20', addPrice(), '109');
  eq('Extra group counted in charge badge', xtra().textContent, 'คิดเพิ่ม +฿20');
  click('[data-less="Granola"]'); click('[data-less="Granola"]');
  eq('minus to 0 deselects', [$('[data-less="Granola"]'), $('[data-pick="Granola"]').closest('.topw').classList.contains('on')], [null, false]);
  click('[data-pick="Mango"]'); click('[data-pick="Kiwi"]'); // Banana3 free + Mango(4th) + Kiwi(5th)
  eq('charge badge 2 over-quota', xtra().textContent, 'คิดเพิ่ม +฿30');
  click('[data-pick="Granola"]'); eq('charge badge mixes over-quota + Extra', [xtra().textContent, addPrice()], ['คิดเพิ่ม +฿40', '129']);
  click('[data-less="Granola"]');
  eq('mixed over limit', addPrice(), String(89 + 15 + 15));
  add();
  eq('cart line label groups duplicates', $('#cart .d').textContent.includes('กล้วย ×3'), true);
  eq('cart total', ev('cartTotal()'), 119);
  eq('remove button is red trash icon', [!!$('#cart .rm svg'), $('#cart .rm').getAttribute('aria-label'), $('#cart .rm').textContent.trim()], [true, 'ลบรายการ', '']);
  menu('greek'); size('g1n'); add();
  eq('2 lines before delete', $$('#cart .line').length, 2);
  click($$('#cart .rm')[1]); eq('trash removes that line only', [$$('#cart .line').length, ev('cartTotal()')], [1, 119]);
  // ---- 1b) ท็อปปิ้งฟรีไม่ครบ 3: ต้องยืนยันก่อนเพิ่ม ----
  const nCart = () => ev('cart.reduce((a, i) => a + i.qty, 0)');
  const baseLines = $$('#cart .line').length;
  let before = nCart();
  menu('greek'); size('g1'); click('[data-pick="Banana"]'); click('[data-pick="Granola"]'); add();
  eq('warn: counts only free group', [$('#modal h3').textContent, $('#fewOk').textContent, $('#modal p')], [' ท็อปปิ้งฟรีเลือกไป 1 จาก 3 อย่าง', 'ลูกค้าขอแค่ 1 อย่าง', null]);
  eq('back is primary button', $('#fewBack').className, 'pay');
  click('#fewBack'); eq('back keeps selection, nothing added', [nCart(), ev('sel.picks')], [before, ['Banana', 'Granola']]);
  add(); click('#fewOk'); add();
  eq('confirmed add stores fewTops', [nCart(), ev('cart[cart.length-1].fewTops')], [before + 1, 1]);
  menu('greek'); size('g1'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]'); click('[data-pick="Kiwi"]'); add();
  eq('3 free toppings: no warning', [!!$('#fewBack'), ev('cart[cart.length-1].fewTops')], [false, undefined]);
  menu('greek'); size('g1'); add();
  eq('0 toppings on 1 scoop: offer plain size instead', [!!$('#fewPlain'), !!$('#fewOk'), $('#fewPlain').textContent.includes('฿69')], [true, false, true]);
  click('#fewPlain'); add(); eq('cart back to start + 3', nCart(), before + 3); eq('switched to 69 plain', [ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].fewTops')], [69, undefined]);
  menu('greek'); size('g2'); add();
  eq('0 toppings on 2 scoops: no plain size → explicit confirm', $('#fewOk').textContent, 'ลูกค้าไม่เอาท็อปปิ้งฟรี');
  click('#fewBack');
  size('g1n'); add(); eq('69 size with no toppings never warns', [!!$('#fewBack'), !!$('#cheapSwitch'), ev('cart[cart.length-1].unit')], [false, false, 69]);
  // ---- 1c) ไซส์ 69: ท็อปปิ้งชิ้นละ 15 · แพงกว่า 89 → เสนอเปลี่ยน ----
  menu('greek'); size('g1n');
  eq('69 size shows topping grid with +15 tags', [$$('[data-pick]').length, $('[data-pick="Granola"] small').textContent, $('[data-pick="Banana"] small').textContent], [20, '+15', '+15']);
  click('[data-pick="Granola"]'); eq('69 + Granola = 84', addPrice(), '84');
  add(); eq('1 topping (84 < 89): added directly, no prompt', [!!$('#cheapSwitch'), !!$('#fewBack'), ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].sizeName')], [false, false, 84, '1 สกู๊ป · ท็อปปิ้งชิ้นละ 15']);
  menu('greek'); size('g1n'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]');
  eq('69 + 2 toppings = 99', addPrice(), '99');
  add(); eq('cheaper prompt: switch is primary, shows both prices', [$('#cheapSwitch').className, $('#cheapSwitch').textContent.includes('฿89'), $('#cheapKeep').textContent.includes('฿99')], ['pay', true, true]);
  let nb = nCart(); click('#cheapKeep'); add(); eq('keep: added at 99', [nCart(), ev('cart[cart.length-1].unit')], [nb + 1, 99]);
  menu('greek'); size('g1n'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]'); add();
  click('#cheapSwitch'); eq('switch with 2 free: asks about 3rd free topping', [ev('sel.size'), $('#fewOk').textContent], ['g1', 'ลูกค้าขอแค่ 2 อย่าง']);
  click('#fewOk'); add(); eq('switched: added at 89 with fewTops 2', [ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].fewTops'), ev('cart[cart.length-1].sizeName')], [89, 2, '1 สกู๊ป']);
  menu('greek'); size('g1n'); ['Banana','Mango','Chia'].forEach(t => click(`[data-pick="${t}"]`)); add(); click('#cheapSwitch'); add();
  eq('switch with 3 free: added directly at 89', [!!$('#fewOk'), ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].fewTops')], [false, 89, undefined]);
  menu('greek'); size('g1n'); click('[data-pick="Granola"]'); click('[data-pick="Blueberries"]'); add();
  eq('69 + 2 extras = 99 vs 89 cup = 114: no prompt', [!!$('#cheapSwitch'), ev('cart[cart.length-1].unit')], [false, 99]);
  while($$('#cart .line').length > baseLines) click($$('#cart .rm')[$$('#cart .rm').length - 1]);   // คืนตะกร้าเหมือนก่อนส่วนนี้
  // ---- 2) Acai: ไม่รับ ----
  menu('acai');
  eq('skip button present & subtle', $$('.comp .skip[data-skip]').length, 5);
  click('[data-skip="1"]');
  eq('Strawberries removed', ev('priceSel().tops[1]'), {name:'Strawberries', n:1, extra:0, from:null, removed:true});
  eq('removed row styled', $$('.comp')[1].className.includes('removed'), true);
  eq('price unchanged', addPrice(), '189');
  add();
  eq('cart shows ไม่รับ', $('#cart .line:nth-child(2) .d').textContent.includes('ไม่รับ: สตรอว์เบอร์รี่'), true);
  /* ตะกร้าจัดกลุ่มเหมือนใบเสร็จ (topGroups): กลุ่มละบรรทัด ไม่รับแยกบรรทัด สีส้ม (class no) · แตะ = ดูเต็ม */
  { const rows = [...$$('#cart .line:nth-child(2) .cg')].map(r => [r.className.trim(), r.textContent]);
    eq('cart groups: each group own row, ไม่รับ row marked, never shares a row', [rows.filter(r => r[1].includes('ไม่รับ:')).every(r => r[0] === 'cg no' && r[1].startsWith('ไม่รับ:')), rows.length >= 2], [true, true]);
    eq('cart groups match receipt grouping', rows.filter(r => /^(เปลี่ยน|ท็อปปิ้ง|เพิ่ม|ไม่รับ):/.test(r[1])).map(r => r[1]), ev(`topGroups(cart[1]).map(g => g[0] + ' ' + g[1].join(', '))`));
    click('#cart .line:nth-child(2) .d'); eq('tap detail → full view', $('#cart .line:nth-child(2)').classList.contains('full'), true);
    click('#cart .line:nth-child(2) .d'); eq('tap again → short view', $('#cart .line:nth-child(2)').classList.contains('full'), false); }
  // restore flow
  menu('acai'); click('[data-skip="0"]'); click('[data-reset="0"]');
  eq('ใส่กลับ restores', ev('sel.comps[0]'), 'Banana');
  // removed slot can still be swapped
  click('[data-skip="0"]'); click('[data-swap="0"]'); click('[data-choose="Kiwi"]');
  eq('swap from removed slot', ev('sel.comps[0]'), 'Kiwi');
  // Acai: กล้วย → สตรอว์เบอร์รี่ที่มีอยู่แล้ว = 2 ส่วน +15
  click('[data-reset="0"]'); click('[data-swap="0"]');
  eq('Acai banana slot offers existing berries +15', [$('[data-choose="Strawberries"] small').textContent, $('[data-choose="Blueberries"] small').textContent], ['+15', '+15']);
  click('[data-choose="Strawberries"]');
  eq('double strawberries 204', [addPrice(), ev('sel.comps.filter(c => c === "Strawberries").length')], ['204', 2]);
  menu('greek'); // switch away (discard)
  // ---- 3) Banana Choco: เปลี่ยนเป็นของ Extra ได้ คิดเงินเพิ่ม ----
  menu('banana');
  eq('banana choco: no honey option', [$$('[data-honey]').length, $('#builder').textContent.includes('น้ำผึ้ง')], [0, false]);
  click('[data-swap="0"]'); eq('banana fruit options incl. Extra', $$('[data-choose]').map(e => e.dataset.choose).sort(), ['Blueberries','Kiwi','Mango','Strawberries']);
  eq('Extra option shows +15, free option shows nothing', [$('[data-choose="Strawberries"] small').textContent, $('[data-choose="Kiwi"] small').textContent], ['+15', '']);
  click('[data-choose="Strawberries"]');
  eq('paid swap: price + label', [addPrice(), $$('.comp')[0].textContent.includes('แทน กล้วย · +15')], ['164', true]);
  click('[data-swap="0"]'); click('[data-choose="Kiwi"]'); eq('swap back to free → 149', addPrice(), '149');
  click('[data-reset="0"]');
  click('[data-skip="3"]'); // ไม่รับ Chocolate Chips
  click('[data-swap="2"]'); const cashewOpts = $$('[data-choose]').map(e => e.dataset.choose);
  eq('cashew slot offers Granola +10', [cashewOpts.includes('Granola'), $('[data-choose="Granola"] small').textContent], [true, '+10']);
  eq('cashew tier offers dried (incl. Chocolate Chips since removed)', cashewOpts.includes('Chocolate Chips') && cashewOpts.includes('Almonds'), true);
  click('[data-swap="2"]');
  add();
  eq('banana choco added 149', ev('cart[cart.length-1].unit'), 149);
  eq('banana choco item has no honey', ev('"honey" in cart[cart.length-1]'), false);
  menu('acai'); click('#btnAdd'); eq('acai still has honey option', $$('[data-honey]').length, 5); menu('greek');
  // ---- 4) ล้างออเดอร์ ----
  eq('clear enabled with items', $('#btnClear').disabled, false);
  click('#btnClear'); eq('confirm modal shown (no native dialog)', [$('#cfYes') !== null, nativeCalls], [true, 0]);
  click('#cfNo'); eq('cancel keeps cart', ev('cart.length'), 3);
  menu('acai'); click('#btnClear'); click('#cfYes');
  eq('clear empties cart + resets builder', [ev('cart.length'), ev('sel.menu'), $('#btnClear').disabled, $('#btnPay').disabled], [0, null, true, true]);
  // ---- 5) PIN modal + pay + void ----
  menu('greek'); size('g1'); click('[data-pick="Banana"]'); click('[data-pick="Banana"]'); add(); click('#fewOk'); add();
  menu('acai');   // เลือกแก้วถัดไปค้างไว้ก่อนจ่าย (Tee เจอบน iPad 2026-10-13)
  click('#btnPay');   // กันแก้วหาย (Tee 2026-10-15): ถามก่อน
  eq('pay with a cup still being picked: asks first, main = go back and add, 2nd = drop and pay', [$('#modal h3').textContent.trim(), $('#modal button.pay').id, $('#modal button.pay').textContent, $('#pendDrop').textContent],
    ['แก้วที่กำลังเลือกยังไม่ได้เพิ่มลงออเดอร์', 'pendBack', 'กลับไปเพิ่มก่อน', 'ทิ้งแก้วนี้ แล้วชำระเงิน']);
  click('#pendBack'); eq('go back: window closes, cup kept, nothing paid', [ev('MD'), ev('sel.menu'), ev('cart.length')], [null, 'acai', 1]);
  click('#btnPay'); click('#pendDrop');
  eq('drop the cup and pay: cup cleared, pay window open', [ev('sel.menu'), !!$('[data-dine]')], [null, true]);
  eq('pay: nothing preselected, methods locked', [$$('#modal .opt.on').length, $$('[data-method]').every(b => b.disabled), !!$('[data-q]'), $('#payOk').disabled, $('#payOk').textContent], [0, true, false, true, 'เลือกกินเลย / กลับบ้านก่อน']);
  eq('pay: no emoji', /\p{Extended_Pictographic}/u.test($('#modal').textContent), false);
  click('[data-method="cash"]'); eq('locked method tap ignored', ev('pay.method'), null);
  click('[data-dine="dinein"]');
  eq('pay: dining picked → methods unlocked, still none chosen', [$$('[data-method]').some(b => b.disabled), ev('pay.method'), $('#payOk').textContent], [false, null, 'เลือกวิธีชำระเงินก่อน']);
  click('[data-method="cash"]'); click('[data-q="1000"]'); click('#payOk'); await wait(300);
  const sale = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0];
  eq('sale stores grouped tops', sale.items[0].tops, [{name:'Banana', n:2, extra:0, from:null}]);
  // jsdom ไม่มี WebUSB: หลังชำระเงินห้ามเด้งหน้าพิมพ์ของระบบเอง (Tee 2026-10-17) · บอกว่าตั๋วยังไม่ออก · พนักงานกดพิมพ์เองได้
  eq('no direct printing in this browser: no browser print popped by itself, status says slips not out', [printed, $('#prStatus').textContent.includes('ตั๋วยังไม่ออก'), $('#prStatus').className.includes('warn')], [0, true, true]);
  eq('success screen: one main button (next order) + print receipt + reprint kitchen', [$$('#modal button.pay').length, $('#modal button.pay').id, $('#prReceipt').textContent.trim(), $('#prKitchen').textContent.trim()], [1, 'nextOrder', 'พิมพ์ใบเสร็จ', 'พิมพ์ตั๋วครัวซ้ำ']);
  click('#prKitchen'); await wait(150);
  let pa = $('#printArea').innerHTML;
  eq('staff taps kitchen: browser print, kitchen slip only', [printed, $$('#printArea .slip').length], [1, 1]);
  eq('kitchen shows Banana ×2 in bold', pa.includes('<span>กล้วย ×2</span>') && $$('#printArea .g.b').some(e => e.textContent.includes('กล้วย ×2')), true);
  eq('kitchen warns portion', pa.split('ลูกค้าเลือก 2 อย่าง · ตักปริมาณปกติ').length - 1, 1);
  click('#prReceipt'); await wait(150); pa = $('#printArea').innerHTML;
  eq('staff taps receipt: receipt only, shows Banana ×2, no portion warning', [printed, $$('#printArea .slip').length, pa.includes('กล้วย ×2'), pa.includes('ตักปริมาณปกติ')], [2, 1, true, false]);
  eq('sale keeps fewTops', sale.items[0].fewTops, 2);
  const R = ev('buildReport(bizDate(new Date()), bizDate(new Date()))');
  eq('report counts few-topping cups', [R.fewCups, R.topCups, Object.keys(R.groups['ท็อปปิ้งฟรีไม่ครบ 3 อย่าง'].rows)], [1, 1, ['เลือก 2 อย่าง']]);
  click('#nextOrder');
  eq('next order: back to menu step (nothing selected)', [ev('sel.menu'), $$('.base.on').length, $$('.sec').length, $('#btnAdd').textContent], [null, 0, 1, 'เลือกเมนูก่อน']);
  click('#btnSummary'); eq('summary opens (signed in, no PIN)', [$('#pinIn'), $('#modal').textContent.includes('สรุปยอดขาย')], [null, true]);
  click('[data-tab="bills"]'); click('[data-v]'); eq('void confirm modal', $('#modal').textContent.includes('ยกเลิกบิล #001?'), true);
  click('#cfYes'); eq('voided & back to summary', [JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0].void, $('#modal').textContent.includes('สรุปยอดขาย')], [true, true]);
  eq('no native dialogs used', nativeCalls, 0);
  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
