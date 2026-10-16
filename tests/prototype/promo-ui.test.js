// โปรโมชันบนหน้าจอ: ปุ่มในกล่องออเดอร์ เลือกโปร เลือกแก้ว ยกเลิกอัตโนมัติ ชำระเงิน บันทึกในบิล ใบเสร็จ รายงาน CSV
// + เพิ่มท็อปปิ้ง Acai / Banana Choco
const {JSDOM} = require('jsdom'); const fs = require('fs');
const F = require('../flow-helper');
const A = require('../auth-helper');
const html = fs.readFileSync(require('path').join(__dirname, '../../prototype/pos.html'), 'utf8');
let errors = [];
const dom = new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w); w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
A.signIn(w);
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing ' + s); el.click(); };
const ev = c => w.eval(c), wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const order = (menu, more) => { F.menu(w, menu); if(more) more(); F.finish(w); };
const total = () => $('#total').textContent;

(async () => {
  await wait(50);
  eq('no promo button with empty cart', $('#promoBox').innerHTML, '');
  // ---- ยังไม่เข้าเงื่อนไขโปรไหน: ปุ่มเทา กดไม่ได้ (Tee 2026-10-13) ----
  order('greek', () => { click('[data-size="g1"]'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`)); });
  eq('Greek 89 + 3 free toppings: no promo applies → grey, disabled, hint', [$('#promoOpen').disabled, $('#promoOpen').textContent.includes('ยังไม่มีโปรที่ใช้ได้'), w.getComputedStyle($("#promoOpen")).cursor], [true, true, 'not-allowed']);
  click('#promoOpen'); eq('disabled promo button opens nothing', $('#modal').classList.contains('show'), false);
  order('acai'); eq('add a qualifying cup: button back to normal by itself', [$('#promoOpen').disabled, $('#promoOpen').textContent.includes('1 บิลใช้ได้ 1 โปร')], [false, true]);
  click('[data-r="1"]'); eq('remove it again: grey again', $('#promoOpen').disabled, true);
  click('[data-r="0"]');
  // ---- เพิ่มท็อปปิ้ง Acai ----
  F.menu(w, 'acai'); F.honey(w, 'normal');   // ปุ่มบอกราคาเมื่อเลือกครบ
  eq('add-on section present, grid closed', [$('[data-addopen]').textContent, !!$('[data-add]')], ['+ เพิ่มท็อปปิ้ง', false]);
  click('[data-addopen]'); eq('grid opens with every topping at +15', [$$('[data-add]').length, $('[data-add="Granola"] small').textContent], [20, '+15']);
  click('#modal [data-add="Mango"]'); click('#modal [data-add="Mango"]'); click('#addsDone');
  eq('Mango ×2 = 219 · one-line summary "+ เพิ่มท็อปปิ้ง: มะม่วง ×2 · +฿30 แก้ไข"', [$('#btnAdd').textContent.includes('฿219'), $('.addsum').textContent.replace(/\s+/g, ' ').trim()], [true, '+ เพิ่มท็อปปิ้ง: มะม่วง ×2 · +฿30แก้ไข']);
  click('.addsum'); click('#modal [data-aless="Mango"]'); click('#addsDone'); eq('edit in window: minus back to 204', $('#btnAdd').textContent.includes('฿204'), true);
  F.finish(w);
  eq('cart line shows add-on', $('#cart .d').textContent.includes('เพิ่ม: มะม่วง · +15'), true);
  eq('kitchen ticket shows add-on', w.eval(`kitchenBlocks({no:1, dining:'dinein', ts:new Date().toISOString(), items:cart})`).some(b => b.tag === '+' && b.text === 'เพิ่ม มะม่วง'), true);
  // ---- ปุ่มโปร + เลือกโปร ----
  order('banana');
  eq('promo button shown', $('#promoOpen').textContent.includes('ใช้โปรโมชัน'), true);
  eq('promo button: secondary style, solid thin border, tag icon', [/dashed/.test(w.getComputedStyle($('#promoOpen')).borderTopStyle), !!$('#promoOpen svg'), $('#promoOpen').classList.contains('on')], [false, true, false]);
  click('#promoOpen');
  const opt = id => $(`[data-pid="${id}"]`);
  eq('options: b1g1 -149, off30 -30, freetop -15 (Mango add-on)', [opt('b1g1').textContent.includes('-฿149'), opt('off30').textContent.includes('-฿30'), opt('freetop').textContent.includes('-฿15')], [true, true, true]);
  eq('apply disabled until chosen', $('#promoOk').disabled, true);
  click(opt('b1g1')); eq('b1g1 chosen, no target list', [$('#promoOk').textContent, !!$('[data-ptarget]')], ['ใช้โปรนี้ · -฿149', false]);
  click('#promoOk');
  eq('box shows promo + total net', [$('#promoOpen').textContent.includes('1 แถม 1'), $('#promoOpen').textContent.includes('Banana Choco ฟรี 1 แก้ว'), total()], [true, true, '฿204']);
  // เปลี่ยนเป็นลด 30 แล้วเลือกแก้ว Banana
  click('#promoOpen'); eq('applied promo highlighted + no-promo button', [opt('b1g1').classList.contains('on'), !!$('#promoNone')], [true, true]);
  click(opt('off30')); eq('off30 lists 2 cups', $$('[data-ptarget]').length, 2);
  click($$('[data-ptarget]')[1]); click('#promoOk');
  eq('off30 on Banana', [$('#promoOpen').textContent.includes('Banana Choco 1 แก้ว'), total()], [true, '฿323']);
  click($$('#cart .rm')[1]);
  eq('target cup removed → moves to remaining Acai', [$('#promoOpen').textContent.includes('Acai 1 แก้ว'), total()], [true, '฿174']);
  // 1 แถม 1 แล้วเหลือแก้วเดียว → ยกเลิกโปรเอง
  order('banana'); click('#promoOpen'); click(opt('b1g1')); click('#promoOk');
  click($$('#cart .rm')[1]);
  eq('b1g1 cancelled when only 1 cup left', [$('#promoOpen').textContent.includes('ใช้โปรโมชัน'), $('#toast').textContent.includes('ยกเลิกโปร 1 แถม 1'), total()], [true, true, '฿204']);
  // ไม่ใช้โปร
  click('#promoOpen'); click(opt('freetop')); click('#promoOk'); eq('freetop -15', total(), '฿189');
  click('#promoOpen'); click('#promoNone'); eq('remove promo', [ev('promo'), total()], [null, '฿204']);
  // ---- ชำระเงินพร้อมโปร ----
  order('banana'); click('#promoOpen'); click(opt('b1g1')); click('#promoOk');
  click('#btnPay'); eq('pay modal shows net + promo note', [$('#modal h3').textContent, $('#modal').textContent.includes('หักโปร 1 แถม 1 -฿149')], ['ชำระเงิน · ฿204', true]);
  click('[data-dine="dinein"]'); click('[data-method="cash"]'); click('[data-q="500"]'); click('#payOk'); await wait(100);
  const s = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2')).slice(-1)[0];
  eq('sale stores promo + net total', [s.total, s.change, s.promo], [204, 296, {id:'b1g1', name:'1 แถม 1', discount:149, detail:'Banana Choco ฟรี 1 แก้ว'}]);
  eq('item prices stay full', s.items.map(i => i.unit * i.qty), [204, 149]);
  eq('promo cleared after sale', [ev('promo'), $('#promoBox').innerHTML], [null, '']);
  const rb = ev(`receiptBlocks(lastSale)`);
  eq('receipt: promo line before total', [rb.some(b => b.left === 'โปร: 1 แถม 1' && b.right === '-฿149'), rb.findIndex(b => b.left === 'โปร: 1 แถม 1') < rb.findIndex(b => b.left === 'รวม')], [true, true]);
  eq('receipt HTML shows promo', ev('receiptHtml(lastSale)').includes('โปร: 1 แถม 1'), true);
  // ---- ล้างออเดอร์ล้างโปร ----
  click('#nextOrder'); order('acai'); order('banana'); click('#promoOpen'); click(opt('off30')); click('#promoOk');
  click('#btnClear'); click('#cfYes'); eq('clear cart clears promo', ev('promo'), null);
  // ---- รายงาน ----
  click('#btnSummary');
  eq('KPI uses net total', $$('.stat b')[0].textContent, '฿204');
  eq('items tab shows discount row', $('#modal').textContent.includes('ส่วนลดโปรโมชัน'), true);
  click('[data-tab="opts"]'); eq('options tab: promo group', $$('#modal tr').some(tr => tr.textContent.includes('1 แถม 1') && tr.textContent.includes('฿149')), true);
  click('[data-tab="bills"]'); eq('bills tab tags promo', $('.promotag').textContent.includes('1 แถม 1 -฿149'), true);
  eq('CSV has promo columns', ev(`billsCsvRows(loadSales())`).map(r => r.slice(9, 11)), [['โปรโมชัน', 'ส่วนลด'], ['1 แถม 1 (Banana Choco ฟรี 1 แก้ว)', 149]]);
  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
