// กล่องออเดอร์ยุบ/ขยาย · toast ใหม่ · ไฮไลต์บรรทัดที่เพิ่งเพิ่ม (Tee 2026-10-15 Redmi จริง)
// jsdom ไม่มี layout: ตรวจสถานะ (class บน body) และเนื้อหา · ตำแหน่ง/ขนาดจริงตรวจใน e2e UI21
const {eq, done, open, wait} = require('../qa/qa-helper');

(async () => {
  const p = open(); await wait(30); p.signIn('1234');
  const {$, $$, click, ev, menu, honey} = p;
  const body = () => ['picking', 'cartopen'].filter(c => $('body').classList.contains(c));

  eq('no greeting toast after sign-in', $('#toast').style.display === 'block' && $('#toast').textContent.includes('สวัสดี'), false);
  eq('normal: full order box, strip empty-state ready', [body(), $('#cartMini').textContent.includes('ยังไม่มีรายการ')], [[], true]);

  menu('acai');
  eq('pick a menu → order box collapses (picking)', body(), ['picking']);
  click('#cartMini'); eq('tap strip → overlay (cartopen), cup kept', [body(), ev('sel.menu')], [['picking', 'cartopen'], 'acai']);
  click('#cartBack'); eq('"กลับไปเลือกต่อ" → collapses back, cup kept', [body(), ev('sel.menu')], [['picking'], 'acai']);
  click('#cartMini'); click('#cartShade'); eq('tap outside closes too', body(), ['picking']);

  honey('normal'); click('#btnAdd');
  eq('add → back to normal (menu step + full order box)', [body(), ev('sel.menu')], [[], null]);
  eq('the added line is highlighted once', [$$('#cart .line.justadded').length, $('#cart .line').classList.contains('justadded')], [1, true]);
  eq('strip lines = "qty× name price" + total, no buttons', [$('#cartMini .cm-ln').textContent.replace(/\s+/g, ' ').trim(), $('#cartMini .cm-tot').textContent.replace(/\s+/g, ' ').trim(), $$('#cartMini button').length],
    ['1× Acai฿189', 'รวม฿189', 0]);
  ev('renderCart()'); eq('highlight only right after adding', $$('#cart .line.justadded').length, 0);

  // ---- toast ตอนมีหน้าต่าง: แสดงในตัวหน้าต่าง ไม่ลอยทับ ----
  click('#btnPay');
  ev(`toast('ทดสอบในหน้าต่าง', 'check')`);
  eq('modal open: no floating toast, message inside the window under the header', [$('#toast').style.display, !!$('#modal .box > .mtoast'), $('#modal .mtoast').textContent.trim(), $('#modal .mhead').nextElementSibling.className],
    ['none', true, 'ทดสอบในหน้าต่าง', 'mtoast']);
  click('[data-dine="dinein"]'); eq('window redraws: message still shown', $('#modal .mtoast') && $('#modal .mtoast').textContent.trim(), 'ทดสอบในหน้าต่าง');
  click('#modal .mtoast'); eq('tap removes it', !!$('#modal .mtoast'), false);
  click('#closeX');
  ev(`toast('ลอย')`); eq('no modal: floating toast', $('#toast').style.display, 'block');
  ev('openSettings()'); eq('a window opening hides the floating toast', $('#toast').style.display, 'none'); click('#closeX');

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
