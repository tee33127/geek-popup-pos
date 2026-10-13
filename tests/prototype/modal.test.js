// หน้าต่าง (modal) แบบเดียวกันทุกหน้าต่าง (Tee 2026-10-13 · iPad ปัดในตั้งค่าแล้วหน้าขายข้างหลังเลื่อนแทน)
// หัวติดบน (ชื่อ + X aria-label "ปิด") · ปุ่มหลักในแถบล่าง · ล็อกหน้าหลัง (body fixed + คืนตำแหน่ง) · แตะพื้นหลังปิดได้เฉพาะตั้งค่า/สรุปยอด
// การเลื่อนจริงบน WebKit/Chromium อยู่ใน e2e (UI15)
const {eq, done, open, wait} = require('../qa/qa-helper');

(async () => {
  const p = open({settings:{promptpay:'0812345678'}}); await wait(30); p.signIn('1234');
  const {$, $$, click, ev, w} = p;
  const head = () => [!!$('#modal .mhead #mdTitle'), !!$('#modal .mhead #closeX'), $('#modal #closeX') && $('#modal #closeX').getAttribute('aria-label'), $$('#modal #closeX').length];
  const foot = () => $('#modal .mfoot') ? [...$('#modal .mfoot').querySelectorAll('button')].map(b => b.id) : null;
  const shown = () => $('#modal').classList.contains('show');
  const locked = () => w.document.body.style.position === 'fixed';
  const backdrop = () => $('#modal').dispatchEvent(new w.MouseEvent('click', {bubbles:true}));   // target = พื้นหลัง (#modal)

  // ---------- ตั้งค่า: หัว + X · ไม่มีปุ่ม "ปิด" ท้ายหน้า · เวอร์ชันยังท้ายเนื้อหา · แตะพื้นหลังปิดได้ ----------
  click('#btnSettings');
  eq('settings: sticky head with title + X (aria-label ปิด), no big close button at the end', [...head(), $$('#modal .mbody button.pay').length, $('#modal .mbody').lastElementChild.className, locked()],
    [true, true, 'ปิด', 1, 0, 'appver', true]);
  backdrop(); eq('settings: tap outside closes, page unlocked (scroll position restore checked in e2e UI15)', [shown(), locked(), w.document.body.style.top], [false, false, '']);
  click('#btnSettings'); click('#closeX'); eq('settings: X closes', [shown(), locked()], [false, false]);

  // ---------- สรุปยอด ----------
  click('#btnSummary');
  eq('summary: head + X, no "ปิด" button in body, wide', [...head(), $$('#modal .mbody #closeX').length, $('#modal .box').classList.contains('wide')], [true, true, 'ปิด', 1, 0, true]);
  backdrop(); eq('summary: tap outside closes', shown(), false);

  // ---------- หน้าต่างอื่น: X อยู่ ปุ่มหลักในแถบล่าง · แตะพื้นหลังไม่ปิด ----------
  p.add({menu:'acai'});
  const cases = [
    ['pay', () => click('#btnPay'), ['payCancel', 'payOk']],
    ['promo', () => click('#promoOpen'), ['promoCancel', 'promoOk']],
    ['user form', () => ev('openUserForm(null)'), ['usrCancel', 'usrSave']],
    ['PromptPay', () => ev('openPromptPay()'), ['setBack', 'setSave']],
    ['close day', () => ev('openClose()'), ['clBack', 'clSave']],
    ['restore', () => ev('openRestore(false)'), ['rsCancel', 'rsApply']],
    ['export', () => { click('#btnSummary'); click('[data-tab="bills"]'); click('#csvTab'); }, ['csvBack']],
  ];
  const bad = [];
  for(const [name, openIt, btns] of cases){
    openIt();
    const got = [head(), foot(), locked()];
    if(JSON.stringify(got) !== JSON.stringify([[true, true, 'ปิด', 1], btns, true])) bad.push({name, got});
    backdrop(); if(!shown()) bad.push({name, closedByBackdrop:true});
    click('#closeX'); if(shown() || locked()) bad.push({name, xDidNotClose:true});
  }
  eq('pay / promo / user form / PromptPay / close day / restore / export: head + X, main buttons in sticky foot, tap outside does NOT close, X closes + unlocks', bad, []);

  // ---------- X ล้างข้อมูลค้างของหน้าต่างนั้น ----------
  click('#promoOpen'); click('[data-pid="off30"]'); click('#closeX'); eq('promo X clears draft (nothing applied)', [ev('promoDraft'), ev('promo')], [null, null]);
  ev('openClose()'); click('#closeX'); eq('close day X clears draft', ev('closeDraft'), null);
  ev('openRestore(false)'); click('#closeX'); eq('restore X clears state', ev('RS'), null);
  ev('openUserForm(null)'); click('#closeX'); eq('user form X clears state', ev('userForm'), null);

  // ---------- ยกเว้น: หน้าต่างยืนยัน และหน้าสำเร็จหลังชำระเงิน (ไม่มีหัว/X) ----------
  click('#btnClear'); eq('askConfirm: no head / X (own buttons)', [!!$('#modal .mhead'), !!$('#cfYes')], [false, true]); click('#cfNo');
  const s = p.pay('cash'); eq('paid', !!s, true);
  p.add({menu:'banana'}); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="cash"]'); click('[data-q]'); click('#payOk');
  eq('payment success screen: no head / X, "ออเดอร์ถัดไป" only', [!!$('#modal .mhead'), !!$('#nextOrder')], [false, true]);
  click('#nextOrder'); eq('closed after next order, unlocked', [shown(), locked()], [false, false]);

  // ---------- เปิดหน้าต่างเดิมซ้ำคงตำแหน่ง (กดสวิตช์ในตั้งค่า) · หน้าต่างใหม่เริ่มบนสุด ----------
  click('#btnSettings'); $('#modal .mbody').scrollTop = 300;   // jsdom ไม่มี layout: ตรวจว่ากำหนดค่าคืนให้
  const kept = (() => { let v = null; const d = Object.getOwnPropertyDescriptor(w.HTMLElement.prototype, 'scrollTop');
    Object.defineProperty(w.HTMLElement.prototype, 'scrollTop', {configurable:true, get(){ return this.__st || 0; }, set(x){ this.__st = x; }});
    $('#modal .mbody').scrollTop = 300; click('[data-stock="items"][data-key="Kiwi"]'); v = $('#modal .mbody').scrollTop;
    click('#ppOpen'); const fresh = $('#modal .mbody').scrollTop; click('#closeX'); click('#btnSettings'); click('[data-stock="items"][data-key="Kiwi"]'); click('#closeX');
    if(d) Object.defineProperty(w.HTMLElement.prototype, 'scrollTop', d); else delete w.HTMLElement.prototype.scrollTop;
    return [v, fresh]; })();
  eq('settings switch keeps scroll position · a different window starts at top', kept, [300, 0]);

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
