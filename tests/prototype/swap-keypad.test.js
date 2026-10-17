// หน้าต่างเปลี่ยน / เพิ่มท็อปปิ้ง (Acai, Banana Choco) และแป้นตัวเลขเงินของแอป (Tee 2026-10-14 Redmi จริง)
// ราคาและกติกาเดิมทุกอย่าง · เทสต์ราคาอยู่ใน pricing / toppings-and-cart · ที่นี่ตรวจหน้าตาและการทำงานของหน้าต่าง/แป้น
const {eq, done, open, wait} = require('../qa/qa-helper');

(async () => {
  const p = open(); await wait(30); p.signIn('1234');
  const {$, $$, click, ev, menu, honey} = p;
  const shown = () => $('#modal').classList.contains('show');
  const chipCnt = el => ((el.closest('.topw').querySelector('small').textContent.match(/(\d+) ชิ้น/) || [])[1] || '');   // จำนวนอยู่บรรทัดล่างของปุ่ม "n ชิ้น"
  const comps = () => $$('#builder .comp').map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 12));

  // ---------- เปลี่ยน = หน้าต่างเล็ก ตารางด้านหลังไม่ขยับ ----------
  menu('acai'); const before = $('#builder').innerHTML;
  click('[data-swap="0"]');
  eq('change opens a small window "เปลี่ยน กล้วย เป็น…" with X, grid behind unchanged', [shown(), $('#mdTitle').textContent, !!$('#closeX'), $('#builder').innerHTML === before, !!$('#builder .swapgrid')],
    [true, 'เปลี่ยน กล้วย เป็น…', true, true, false]);
  eq('options use the same topping buttons as Greek (price tag, sold-out tag)', [$$('#modal .tops .topw .top[data-choose]').length > 0, $('#modal [data-choose="Strawberries"] small').textContent, $('#modal [data-choose="Kiwi"] small').textContent], [true, '+15', '']);
  click('#modal [data-choose="Strawberries"]');
  eq('choose → window closes by itself, that slot updated, price per rule (204)', [shown(), ev('sel.comps[0]'), ev('priceSel().unit')], [false, 'Strawberries', 204]);
  click('[data-swap="0"]'); eq('title shows the current item', $('#mdTitle').textContent, 'เปลี่ยน สตรอว์เบอร์รี่ เป็น…');
  click('#closeX'); eq('X closes without changing', [shown(), ev('sel.comps[0]')], [false, 'Strawberries']);

  // ---------- เพิ่มท็อปปิ้ง = หน้าต่าง เพิ่มได้หลายชิ้น มีปุ่ม "เสร็จ" ----------
  click('[data-addopen]');
  eq('add window: title, 20 buttons, done button, grid behind unchanged', [shown(), $('#mdTitle').textContent.startsWith('เพิ่มท็อปปิ้ง'), $$('#modal [data-add]').length, !!$('#addsDone')], [true, true, 20, true]);
  click('#modal [data-add="Mango"]'); click('#modal [data-add="Mango"]'); click('#modal [data-add="Granola"]');
  eq('tap = +1 each, window stays open, count badge + − on chosen', [shown(), ev('sel.adds'), chipCnt($('#modal [data-add="Mango"]')), !!$('#modal [data-aless="Mango"]')], [true, ['Mango', 'Mango', 'Granola'], '2', true]);
  click('#modal [data-aless="Mango"]'); eq('− in window removes one', ev('sel.adds'), ['Mango', 'Granola']);
  click('#addsDone'); eq('done closes, builder shows the add-ons, price 15 each (204 + 30)', [shown(), $('#builder .addsum').textContent.includes('มะม่วง, กราโนล่า · +฿30'), ev('priceSel().unit')], [false, true, 234]);
  ev('backToMenu()');

  // ---------- แป้นตัวเลขเงินของแอป: ไม่เปิดแป้นระบบ ----------
  p.add({menu:'banana'});
  click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="cash"]');
  const r = $('#recv');
  eq('cash: received field is read-only with inputmode none (no system keyboard) + keypad 4×3 (no separate clear key · Tee 2026-10-18) + quick buttons kept', [r.readOnly, r.getAttribute('inputmode'), $$('#modal .mpad [data-mk]').length, $$('#modal [data-q]').length, !!$('#modal .mfx')],
    [true, 'none', 12, 6, false]);
  const key = k => click(`#modal [data-mk="${k}"]`);
  key('2'); key('00'); eq('keys 2 + 00 → 200, change shown', [$('#recv').value, ev('pay.received'), $('#modal .change').textContent.trim()], ['200', 200, 'เงินทอน ฿51']);
  key('back'); eq('⌫ → 20, short', [$('#recv').value, $('#modal .change').textContent.includes('ยังขาด')], ['20', true]);
  key('clear'); key('00'); key('0'); eq('ล้าง, then 00 / 0 alone = 0 (shown empty, no leading zeros)', [$('#recv').value, ev('pay.received')], ['', 0]);
  key('1'); key('5'); key('4'); eq('typed 154 = exact, confirm enabled', [$('#recv').value, $('#payOk').disabled], ['154', false]);
  ['9', '9', '9', '9', '9', '9', '9', '9'].forEach(key); eq('max 7 digits', $('#recv').value.length, 7);
  click('[data-q="500"]'); eq('quick button still works', $('#recv').value, '500');
  click('#payOk'); click('#nextOrder');

  // ---------- ปิดร้าน: 2 ช่อง แตะเลือกช่อง แล้วใช้แป้นเดียวกัน ----------
  ev(`localStorage.removeItem(SETTINGS_KEY + '_cash')`); ev('openClose()');
  eq('close day: both money fields read-only, float field active first (not set yet), note uses system keyboard', [$('#clFloat').readOnly, $('#clCount').readOnly, $('#clFloat').classList.contains('cur'), $('#clNote').readOnly], [true, true, true, false]);
  click('#modal [data-mk="1"]'); click('#modal [data-mk="00"]'); click('#modal [data-mk="0"]');
  click('#clCount'); eq('tap the other field to select it', [$('#clCount').classList.contains('cur'), $('#clFloat').classList.contains('cur')], [true, false]);
  click('#modal [data-mk="1"]'); click('#modal [data-mk="1"]'); click('#modal [data-mk="4"]'); click('#modal [data-mk="9"]');
  eq('float 1000 + counted 1149 → expected 1149 (1000 + 149 cash), money correct, save enabled', [$('#clFloat').value, $('#clCount').value, $('#clExp').textContent, $('#clDiff').textContent, $('#clSave').disabled], ['1000', '1149', '฿1,149', 'เงินตรง', false]);
  click('#closeX');

  // ---------- เงินทอนตั้งต้น ----------
  ev('askFloat()');
  eq('opening float: read-only field + keypad', [$('#floatIn').readOnly, !!$('#modal .mpad')], [true, true]);
  click('#modal [data-mk="5"]'); click('#modal [data-mk="00"]'); eq('500 → save enabled', [$('#floatIn').value, $('#floatOk').disabled], ['500', false]);
  ev('closeModal()');

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
