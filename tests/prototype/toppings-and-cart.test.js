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
const chipText = n => $(`[data-pick="${n}"]`).textContent;

(async () => {
  // ---- 1) ท็อปปิ้งซ้ำได้ ----
  click('[data-menu="greek"]');
  click('[data-pick="Banana"]'); click('[data-pick="Banana"]'); click('[data-pick="Banana"]');
  eq('Banana x3 shows count', chipText('Banana').includes('×3'), true);
  eq('Banana x3 all free', addPrice(), '89');
  eq('free counter 3/3', $('.cnt').textContent, 'ฟรี 3/3');
  click('[data-pick="Banana"]'); eq('4th Banana +15', addPrice(), '104');
  click('[data-less="Banana"]'); eq('minus back to x3', addPrice(), '89');
  click('[data-pick="Granola"]'); click('[data-pick="Granola"]'); eq('Granola x2 = +20', addPrice(), '109');
  click('[data-less="Granola"]'); click('[data-less="Granola"]'); eq('minus removes chip badge', $('[data-less="Granola"]'), null);
  click('[data-pick="Mango"]'); click('[data-pick="Kiwi"]'); // Banana3 free + Mango(4th) + Kiwi(5th)
  eq('mixed over limit', addPrice(), String(89 + 15 + 15));
  click('#btnAdd');
  eq('cart line label groups duplicates', $('#cart .d').textContent.includes('Banana ×3'), true);
  eq('cart total', ev('cartTotal()'), 119);
  // ---- 2) Acai: ไม่รับ ----
  click('[data-menu="acai"]');
  eq('skip button present & subtle', $$('.comp .skip[data-skip]').length, 5);
  click('[data-skip="1"]');
  eq('Strawberries removed', ev('priceSel().tops[1]'), {name:'Strawberries', n:1, extra:0, from:null, removed:true});
  eq('removed row styled', $$('.comp')[1].className.includes('removed'), true);
  eq('price unchanged', addPrice(), '189');
  click('#btnAdd');
  eq('cart shows ไม่รับ', $('#cart .line:nth-child(2) .d').textContent.includes('ไม่รับ Strawberries'), true);
  // restore flow
  click('[data-menu="acai"]'); click('[data-skip="0"]'); click('[data-reset="0"]');
  eq('ใส่กลับ restores', ev('sel.comps[0]'), 'Banana');
  // removed slot can still be swapped
  click('[data-skip="0"]'); click('[data-swap="0"]'); click('[data-choose="Kiwi"]');
  eq('swap from removed slot', ev('sel.comps[0]'), 'Kiwi');
  click('[data-menu="greek"]'); // switch away (discard)
  // ---- 3) Banana Choco: ห้ามสลับเป็น Strawberries/Blueberries ----
  click('[data-menu="banana"]');
  click('[data-swap="0"]'); eq('banana fruit tier options', $$('[data-choose]').map(e => e.dataset.choose).sort(), ['Kiwi','Mango']);
  click('[data-swap="0"]'); click('[data-skip="3"]'); // ไม่รับ Chocolate Chips
  click('[data-swap="2"]'); const cashewOpts = $$('[data-choose]').map(e => e.dataset.choose);
  eq('no Strawberries/Blueberries anywhere', cashewOpts.some(n => /Strawberr|Blueberr/.test(n)), false);
  eq('cashew tier offers dried (incl. Chocolate Chips since removed)', cashewOpts.includes('Chocolate Chips') && cashewOpts.includes('Almonds'), true);
  // Acai can still swap to Mango etc. but banana choco never offered extras of fruit
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
  click('[data-menu="greek"]'); click('[data-pick="Banana"]'); click('[data-pick="Banana"]'); click('#btnAdd');
  click('#btnPay'); click('[data-dine="dinein"]'); click('[data-q="1000"]'); click('#payOk'); await wait(300);
  const sale = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0];
  eq('sale stores grouped tops', sale.items[0].tops, [{name:'Banana', n:2, extra:0, from:null}]);
  const pa = $('#printArea').innerHTML; eq('kitchen shows Banana ×2', pa.includes('Banana <b>×2</b>'), true);
  eq('receipt shows Banana ×2', pa.includes('Banana ×2'), true); click('#nextOrder');
  click('#btnSummary'); eq('PIN modal', $('#pinIn') !== null, true);
  $('#pinIn').value = '0000'; click('#pinOk'); eq('wrong PIN message', $('#modal').textContent.includes('PIN ไม่ถูกต้อง'), true);
  $('#pinIn').value = '1234'; click('#pinOk'); eq('summary opens', $('#modal').textContent.includes('สรุปยอดขาย'), true);
  click('[data-tab="bills"]'); click('[data-v]'); eq('void confirm modal', $('#modal').textContent.includes('ยกเลิกบิล #001?'), true);
  click('#cfYes'); eq('voided & back to summary', [JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0].void, $('#modal').textContent.includes('สรุปยอดขาย')], [true, true]);
  eq('no native dialogs used', nativeCalls, 0);
  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
