const {JSDOM} = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'../../prototype/pos.html'),'utf8');
let printed = 0, errors = [], nativeCalls = 0;
const dom = new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ w.print = () => printed++; w.confirm = () => { nativeCalls++; return false; }; w.prompt = () => { nativeCalls++; return null; }; w.addEventListener('error', e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing '+s); el.click(); };
const ev = c => w.eval(c), wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`); };
const addPrice = () => $('#btnAdd').textContent.match(/฿([\d,]+)/)[1].replace(',','');

(async () => {
  // ---- 1) ท็อปปิ้งซ้ำได้ ----
  click('[data-menu="greek"]');
  click('[data-pick="Banana"]');
  eq('tap selects 1 + shows stepper', [ev('sel.picks'), $('[data-more="Banana"]').parentNode.querySelector('b').textContent], [['Banana'], '1']);
  click('[data-pick="Banana"]'); eq('tap again removes', [ev('sel.picks'), $('.trow')], [[], null]);
  click('[data-pick="Banana"]');
  click('[data-more="Banana"]'); click('[data-more="Banana"]');
  eq('Banana x3 shows count', $('[data-more="Banana"]').parentNode.querySelector('b').textContent, '3');
  eq('Banana x3 all free', addPrice(), '89');
  eq('chip shows ×3, same height as unselected', [$('[data-pick="Banana"] small').textContent, $('[data-pick="Banana"]').closest('.topw').querySelector('[data-more]')], ['×3', null]);
  eq('selected list in tap order', $$('.trow .nm').map(e => e.textContent), ['กล้วย']);
  eq('free counter 3/3, no over badge', [$('.cnt').textContent, $('.cnt.over')], ['ฟรี 3/3', null]);
  eq('unselected free chip shows +15 at quota', $('[data-pick="Kiwi"] small').textContent, '+15');
  click('[data-more="Banana"]'); eq('4th Banana +15', addPrice(), '104');
  eq('charge badge', $('.cnt.over').textContent, 'คิดเพิ่ม 1 ชิ้น +฿15');
  eq('over chip styled orange', $('[data-pick="Banana"]').closest('.topw').classList.contains('over'), true);
  click('[data-less="Banana"]'); eq('minus back to x3', addPrice(), '89');
  click('[data-pick="Kiwi"]'); click('[data-more="Kiwi"]'); click('[data-pick="Kiwi"]'); eq('tap removes all of a ×2 item', ev('sel.picks'), ['Banana','Banana','Banana']);
  eq('no charge badge within quota', $('.cnt.over'), null);
  click('[data-pick="Granola"]'); click('[data-more="Granola"]'); eq('Granola x2 = +20', addPrice(), '109');
  eq('Extra group counted in charge badge', $('.cnt.over').textContent, 'คิดเพิ่ม 2 ชิ้น +฿20');
  click('[data-less="Granola"]'); click('[data-less="Granola"]');
  eq('minus to 0 deselects', [$('[data-less="Granola"]'), $('[data-pick="Granola"]').closest('.topw').classList.contains('on')], [null, false]);
  click('[data-pick="Mango"]'); click('[data-pick="Kiwi"]'); // Banana3 free + Mango(4th) + Kiwi(5th)
  eq('charge badge 2 over-quota', $('.cnt.over').textContent, 'คิดเพิ่ม 2 ชิ้น +฿30');
  click('[data-pick="Granola"]'); eq('charge badge mixes over-quota + Extra', [$('.cnt.over').textContent, addPrice()], ['คิดเพิ่ม 3 ชิ้น +฿40', '129']);
  click('[data-pick="Granola"]');
  eq('mixed over limit', addPrice(), String(89 + 15 + 15));
  click('#btnAdd');
  eq('cart line label groups duplicates', $('#cart .d').textContent.includes('กล้วย ×3'), true);
  eq('cart total', ev('cartTotal()'), 119);
  eq('remove button is red trash icon', [!!$('#cart .rm svg'), $('#cart .rm').getAttribute('aria-label'), $('#cart .rm').textContent.trim()], [true, 'ลบรายการ', '']);
  click('[data-menu="greek"]'); click('[data-size="g1n"]'); click('#btnAdd');
  eq('2 lines before delete', $$('#cart .line').length, 2);
  click($$('#cart .rm')[1]); eq('trash removes that line only', [$$('#cart .line').length, ev('cartTotal()')], [1, 119]);
  // ---- 1b) ท็อปปิ้งฟรีไม่ครบ 3: ต้องยืนยันก่อนเพิ่ม ----
  const nCart = () => ev('cart.reduce((a, i) => a + i.qty, 0)');
  let before = nCart();
  click('[data-menu="greek"]'); click('[data-pick="Banana"]'); click('[data-pick="Granola"]'); click('#btnAdd');
  eq('warn: counts only free group', [$('#modal h3').textContent, $('#fewOk').textContent, $('#modal p')], [' ท็อปปิ้งฟรีเลือกไป 1 จาก 3 อย่าง', 'ลูกค้าขอแค่ 1 อย่าง', null]);
  eq('back is primary button', $('#fewBack').className, 'pay');
  click('#fewBack'); eq('back keeps selection, nothing added', [nCart(), ev('sel.picks')], [before, ['Banana', 'Granola']]);
  click('#btnAdd'); click('#fewOk');
  eq('confirmed add stores fewTops', [nCart(), ev('cart[cart.length-1].fewTops')], [before + 1, 1]);
  click('[data-menu="greek"]'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]'); click('[data-pick="Kiwi"]'); click('#btnAdd');
  eq('3 free toppings: no warning', [!!$('#fewBack'), ev('cart[cart.length-1].fewTops')], [false, undefined]);
  click('[data-menu="greek"]'); click('#btnAdd');
  eq('0 toppings on 1 scoop: offer plain size instead', [!!$('#fewPlain'), !!$('#fewOk'), $('#fewPlain').textContent.includes('฿69')], [true, false, true]);
  click('#fewPlain'); eq('cart back to start + 3', nCart(), before + 3); eq('switched to 69 plain', [ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].fewTops')], [69, undefined]);
  click('[data-menu="greek"]'); click('[data-size="g2"]'); click('#btnAdd');
  eq('0 toppings on 2 scoops: no plain size → explicit confirm', $('#fewOk').textContent, 'ลูกค้าไม่เอาท็อปปิ้งฟรี');
  click('#fewBack');
  click('[data-size="g1n"]'); click('#btnAdd'); eq('no-topping size never warns', !!$('#fewBack'), false);
  for(let k = 0; k < 3; k++) click($$('#cart .rm')[$$('#cart .rm').length - 1]);   // คืนตะกร้าเหมือนก่อนส่วนนี้
  // ---- 2) Acai: ไม่รับ ----
  click('[data-menu="acai"]');
  eq('skip button present & subtle', $$('.comp .skip[data-skip]').length, 5);
  click('[data-skip="1"]');
  eq('Strawberries removed', ev('priceSel().tops[1]'), {name:'Strawberries', n:1, extra:0, from:null, removed:true});
  eq('removed row styled', $$('.comp')[1].className.includes('removed'), true);
  eq('price unchanged', addPrice(), '189');
  click('#btnAdd');
  eq('cart shows ไม่รับ', $('#cart .line:nth-child(2) .d').textContent.includes('ไม่รับ สตรอว์เบอร์รี่'), true);
  // restore flow
  click('[data-menu="acai"]'); click('[data-skip="0"]'); click('[data-reset="0"]');
  eq('ใส่กลับ restores', ev('sel.comps[0]'), 'Banana');
  // removed slot can still be swapped
  click('[data-skip="0"]'); click('[data-swap="0"]'); click('[data-choose="Kiwi"]');
  eq('swap from removed slot', ev('sel.comps[0]'), 'Kiwi');
  // Acai: กล้วย → สตรอว์เบอร์รี่ที่มีอยู่แล้ว = 2 ส่วน +15
  click('[data-reset="0"]'); click('[data-swap="0"]');
  eq('Acai banana slot offers existing berries +15', [$('[data-choose="Strawberries"] small').textContent, $('[data-choose="Blueberries"] small').textContent], ['+15', '+15']);
  click('[data-choose="Strawberries"]');
  eq('double strawberries 204', [addPrice(), ev('sel.comps.filter(c => c === "Strawberries").length')], ['204', 2]);
  click('[data-menu="greek"]'); // switch away (discard)
  // ---- 3) Banana Choco: เปลี่ยนเป็นของ Extra ได้ คิดเงินเพิ่ม ----
  click('[data-menu="banana"]');
  click('[data-swap="0"]'); eq('banana fruit options incl. Extra', $$('[data-choose]').map(e => e.dataset.choose).sort(), ['Blueberries','Kiwi','Mango','Strawberries']);
  eq('Extra option shows +15, free option shows nothing', [$('[data-choose="Strawberries"] small').textContent, $('[data-choose="Kiwi"] small')], ['+15', null]);
  click('[data-choose="Strawberries"]');
  eq('paid swap: price + label', [addPrice(), $$('.comp')[0].textContent.includes('แทน กล้วย · +15')], ['164', true]);
  click('[data-swap="0"]'); click('[data-choose="Kiwi"]'); eq('swap back to free → 149', addPrice(), '149');
  click('[data-reset="0"]');
  click('[data-skip="3"]'); // ไม่รับ Chocolate Chips
  click('[data-swap="2"]'); const cashewOpts = $$('[data-choose]').map(e => e.dataset.choose);
  eq('cashew slot offers Granola +10', [cashewOpts.includes('Granola'), $('[data-choose="Granola"] small').textContent], [true, '+10']);
  eq('cashew tier offers dried (incl. Chocolate Chips since removed)', cashewOpts.includes('Chocolate Chips') && cashewOpts.includes('Almonds'), true);
  click('[data-swap="2"]');
  click('#btnAdd');
  eq('banana choco added 149', ev('cart[cart.length-1].unit'), 149);
  // ---- 4) ล้างออเดอร์ ----
  eq('clear enabled with items', $('#btnClear').disabled, false);
  click('#btnClear'); eq('confirm modal shown (no native dialog)', [$('#cfYes') !== null, nativeCalls], [true, 0]);
  click('#cfNo'); eq('cancel keeps cart', ev('cart.length'), 3);
  click('[data-menu="acai"]'); click('#btnClear'); click('#cfYes');
  eq('clear empties cart + resets builder', [ev('cart.length'), ev('sel.menu'), $('#btnClear').disabled, $('#btnPay').disabled], [0, null, true, true]);
  // ---- 5) PIN modal + pay + void ----
  click('[data-menu="greek"]'); click('[data-pick="Banana"]'); click('[data-more="Banana"]'); click('#btnAdd'); click('#fewOk');
  click('#btnPay');
  eq('pay: nothing preselected, methods locked', [$$('#modal .opt.on').length, $$('[data-method]').every(b => b.disabled), !!$('[data-q]'), $('#payOk').disabled, $('#payOk').textContent], [0, true, false, true, 'เลือกกินเลย / กลับบ้านก่อน']);
  eq('pay: no emoji', /\p{Extended_Pictographic}/u.test($('#modal').textContent), false);
  click('[data-method="cash"]'); eq('locked method tap ignored', ev('pay.method'), null);
  click('[data-dine="dinein"]');
  eq('pay: dining picked → methods unlocked, still none chosen', [$$('[data-method]').some(b => b.disabled), ev('pay.method'), $('#payOk').textContent], [false, null, 'เลือกวิธีชำระเงินก่อน']);
  click('[data-method="cash"]'); click('[data-q="1000"]'); click('#payOk'); await wait(300);
  const sale = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0];
  eq('sale stores grouped tops', sale.items[0].tops, [{name:'Banana', n:2, extra:0, from:null}]);
  const pa = $('#printArea').innerHTML; eq('kitchen shows Banana ×2', pa.includes('กล้วย <b>×2</b>'), true);
  eq('receipt shows Banana ×2', pa.includes('กล้วย ×2'), true);
  eq('kitchen warns portion, once (not on receipt)', pa.split('ลูกค้าเลือก 2 อย่าง · ตักปริมาณปกติ').length - 1, 1);
  eq('sale keeps fewTops', sale.items[0].fewTops, 2);
  const R = ev('buildReport(bizDate(new Date()), bizDate(new Date()))');
  eq('report counts few-topping cups', [R.fewCups, R.topCups, Object.keys(R.groups['ท็อปปิ้งฟรีไม่ครบ 3 อย่าง'].rows)], [1, 1, ['เลือก 2 อย่าง']]);
  eq('auto-printed both slips once', [printed, $$('#printArea .slip').length], [1, 2]);
  eq('success screen: no print choices, one next button', [!!$('#prRec'), !!$('#prKit'), $$('#modal button.pay').length, $('#modal button.pay').id], [false, false, 1, 'nextOrder']);
  click('#prBoth'); await wait(150); eq('reprint link prints both again', [printed, $$('#printArea .slip').length], [2, 2]);
  click('#nextOrder');
  click('#btnSummary'); eq('PIN modal', $('#pinIn') !== null, true);
  $('#pinIn').value = '0000'; click('#pinOk'); eq('wrong PIN message', $('#modal').textContent.includes('PIN ไม่ถูกต้อง'), true);
  $('#pinIn').value = '1234'; click('#pinOk'); eq('summary opens', $('#modal').textContent.includes('สรุปยอดขาย'), true);
  click('[data-tab="bills"]'); click('[data-v]'); eq('void confirm modal', $('#modal').textContent.includes('ยกเลิกบิล #001?'), true);
  click('#cfYes'); eq('voided & back to summary', [JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0].void, $('#modal').textContent.includes('สรุปยอดขาย')], [true, true]);
  eq('no native dialogs used', nativeCalls, 0);
  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
