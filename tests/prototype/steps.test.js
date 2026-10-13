// หน้าเลือกออเดอร์แบบทีละขั้น (Tee 2026-10-13): เมนู → ขนาด (Greek) → ท็อปปิ้ง → น้ำผึ้ง (ไม่มีใน Banana Choco) → เพิ่มลงออเดอร์
// เดินหน้า/ย้อนแก้ทุกเมนูและขนาด · ปุ่มหลักตามขั้น · เลื่อนจอเฉพาะตอนขั้นใหม่เปิด · ตัวนับตรงกับราคาบนปุ่ม (P01–P23)
const {eq, done, open, wait} = require('../qa/qa-helper');

(async () => {
  const scrolls = [];   // นับการเลื่อนจออัตโนมัติ (jsdom ไม่เลื่อนจริง)
  let reduced = false;
  const p = open({before(w){
    w.Element.prototype.scrollIntoView = function(o){ scrolls.push([this.dataset.step, o && o.behavior]); };
    w.matchMedia = q => ({matches: /reduce/.test(q) && reduced, addEventListener(){}, removeEventListener(){}});
  }});
  await wait(30); p.signIn();
  const {$, $$, click, ev, menu, size, honey, tops, finish} = p;
  const btn = () => $('#btnAdd').textContent, price = () => Number((btn().match(/฿([\d,]+)/) || [])[1]);
  const view = () => ({open: $$('.sec.open').map(s => s.dataset.step), done: $$('.sec:not(.open)').map(s => s.dataset.step)});
  const sum = id => $(`.sec:not(.open)[data-step="${id}"] .st`).textContent.replace(/\s+/g, ' ').trim();
  const dots = () => $$('.fdots i').map(i => i.classList.contains('on') ? '●' : '○').join('');
  const tally = () => $('#tally .tally') ? [...$('#tally .tally').children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ') : '';
  const clearCart = () => { while($$('#cart .rm').length) click($$('#cart .rm')[0]); };

  // ---------- เริ่ม: แสดงแค่ขั้นเมนู ----------
  eq('start: only menu step, primary disabled "เลือกเมนูก่อน", no counter', [view(), btn(), $('#btnAdd').disabled, tally()], [{open:['menu'], done:[]}, 'เลือกเมนูก่อน', true, '']);

  // ---------- Greek ทุกขนาด: เดินหน้า ----------
  for(const [sz, base, label] of [['g1n', 69, 'ชิ้นละ 15'], ['g1', 89, 'ฟรี'], ['g2', 129, 'ฟรี']]){
    scrolls.length = 0;
    menu('greek');
    eq(`greek ${sz}: menu collapses to summary, size step opens, scrolled once`, [view(), sum('menu'), btn(), $('#btnAdd').disabled, scrolls.map(s => s[0])],
      [{open:['size'], done:['menu']}, 'เมนู Greek Yogurt', 'เลือกขนาดก่อน', true, ['size']]);
    size(sz);
    eq(`greek ${sz}: size collapses, toppings open, primary "ถัดไป: น้ำผึ้ง · ฿${base}", counter shown`, [view(), btn(), tally(), scrolls.map(s => s[0])],
      [{open:['tops'], done:['menu', 'size']}, `ถัดไป: น้ำผึ้ง · ฿${base}`, label, ['size', 'tops']]);
    if(sz === 'g1n') click('[data-pick="Banana"]');   // 69: 1 ชิ้น (84 < 89 ไม่ถามเปลี่ยน)
    else { click('[data-pick="Kiwi"]'); click('[data-pick="Mango"]'); click('[data-more="Mango"]'); click('[data-pick="Banana"]'); }   // 4 ชิ้น ฟรีครบ ไม่ถาม
    eq(`greek ${sz}: picking toppings never scrolls · price on button updates`, [scrolls.length, price() > base], [2, true]);
    click('#btnAdd');
    eq(`greek ${sz}: ถัดไป → toppings collapse to summary, honey opens, "เลือกน้ำผึ้งก่อน", counter hidden`, [view(), btn(), $('#btnAdd').disabled, tally(), scrolls.length, sum('tops').startsWith(sz === 'g1n' ? 'ท็อปปิ้ง กล้วย · +฿15' : 'ท็อปปิ้ง กีวี, มะม่วง ×2, กล้วย · +฿15')],
      [{open:['honey'], done:['menu', 'size', 'tops']}, 'เลือกน้ำผึ้งก่อน', true, '', 3, true]);
    const pr = ev('priceSel().unit');
    click('[data-honey="little"]');
    eq(`greek ${sz}: honey chosen → "เพิ่มลงออเดอร์ · ฿${pr}", honey stays open (last step), no scroll`, [btn(), view().open, scrolls.length], [`เพิ่มลงออเดอร์ · ฿${pr}`, ['honey'], 3]);
    click('#btnAdd');
    eq(`greek ${sz}: added at ฿${pr}, back to menu step`, [ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].honey'), view()], [pr, 'little', {open:['menu'], done:[]}]);
  }
  clearCart();

  // ---------- ตัวนับฟรี: วงกลม ●●○ ไม่มีตัวเลข · aria-label บอกจำนวน ----------
  menu('greek'); size('g1');
  const prog = [[dots(), $('.tally .tq').getAttribute('aria-label')]];
  ['Banana', 'Mango', 'Kiwi', 'Chia'].forEach(t => { click(`[data-pick="${t}"]`); prog.push([dots(), $('.tally .tq').getAttribute('aria-label')]); });
  eq('free dots fill one by one, stay full past 3 · aria-label "ใช้ท็อปปิ้งฟรีแล้ว N จาก 3" · no "n/3" text', [prog, /\d\/3/.test($('#tally').textContent), !!$('.tally .xtra')],
    [[['○○○', 'ใช้ท็อปปิ้งฟรีแล้ว 0 จาก 3'], ['●○○', 'ใช้ท็อปปิ้งฟรีแล้ว 1 จาก 3'], ['●●○', 'ใช้ท็อปปิ้งฟรีแล้ว 2 จาก 3'], ['●●●', 'ใช้ท็อปปิ้งฟรีแล้ว 3 จาก 3'], ['●●●', 'ใช้ท็อปปิ้งฟรีแล้ว 3 จาก 3']], false, true]);
  click('#btnAdd'); click('[data-open="size"]');
  eq('honey not chosen yet + size opened to edit: honey row is "pending" (grey), others done (green)', [$$('.sec.done').map(s => s.dataset.step), $$('.sec.pending').map(s => s.dataset.step), sum('honey')], [['menu', 'tops'], ['honey'], 'น้ำผึ้ง ยังไม่เลือก']);
  ev('backToMenu()');

  // ---------- Greek: ย้อนแก้ ----------
  menu('greek'); size('g1'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`)); click('#btnAdd'); click('[data-honey="normal"]');
  scrolls.length = 0;
  click('[data-open="size"]');
  eq('edit size: only size open, others collapsed, honey still chosen, primary unchanged', [view(), ev('sel.honey'), btn()], [{open:['size'], done:['menu', 'tops', 'honey']}, 'normal', 'เพิ่มลงออเดอร์ · ฿89']);
  click('[data-size="g2"]');
  eq('change size: collapses back to the step in progress (honey), toppings kept, price recalculated, no scroll', [view().open, ev('sel.picks'), btn(), sum('size'), scrolls.length],
    [['honey'], ['Banana', 'Mango', 'Kiwi'], 'เพิ่มลงออเดอร์ · ฿129', 'ขนาด 2 สกู๊ป · ท็อปปิ้งฟรี 3 อย่าง ฿129', 0]);
  click('[data-open="tops"]');
  eq('edit toppings: toppings open with counter, primary "ถัดไป", stays open while picking', [view().open, btn(), tally(), dots()], [['tops'], 'ถัดไป: น้ำผึ้ง · ฿129', 'ฟรี', '●●●']);
  click('[data-pick="Granola"]'); click('[data-pick="Chia"]');
  eq('edit toppings: still open after picks, counter updates (dots full + orange extra)', [view().open, tally(), dots()], [['tops'], 'ฟรี คิดเพิ่ม 2 ชิ้น +฿25', '●●●']);
  click('#btnAdd');
  eq('ถัดไป from edit: honey opens again (choice kept)', [view().open, ev('sel.honey'), btn(), scrolls.map(s => s[0])], [['honey'], 'normal', 'เพิ่มลงออเดอร์ · ฿154', ['honey']]);
  click('[data-open="menu"]');
  eq('edit menu: menu grid open', [view().open, !!$('[data-menu="acai"]')], [['menu'], true]);
  click('[data-menu="greek"]');
  eq('same menu again: collapses back, nothing cleared', [view().open, ev('sel.size'), ev('sel.picks.length'), ev('sel.honey')], [['honey'], 'g2', 5, 'normal']);
  click('[data-open="menu"]'); click('[data-menu="acai"]');
  eq('different menu: starts over at toppings', [view(), ev('sel.honey'), ev('sel.size'), ev('sel.picks')], [{open:['tops'], done:['menu']}, null, null, []]);

  // ข้ามการถามด้วยการแตะแถวน้ำผึ้ง → ถามตอนเพิ่มลงออเดอร์แทน
  menu('greek'); size('g1'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`)); click('#btnAdd'); click('[data-honey="normal"]');
  tops(); click('[data-pick="Kiwi"]'); click('[data-open="honey"]');
  eq('toppings edited then honey row tapped (no ถัดไป): primary is add', btn(), 'เพิ่มลงออเดอร์ · ฿89');
  click('#btnAdd');
  eq('…free-topping question still asked at add', [!!$('#fewOk'), ev('cart.length')], [true, 0]);
  click('#fewOk');
  eq('…answered: added with fewTops 2', [ev('cart.length'), ev('cart[0].fewTops')], [1, 2]);
  clearCart();

  // ถามตอน "ถัดไป": กลับไปเลือกเพิ่ม = อยู่ขั้นท็อปปิ้งต่อ
  menu('greek'); size('g1'); click('[data-pick="Banana"]'); click('#btnAdd');
  eq('few question asked at ถัดไป (still talking about toppings)', [!!$('#fewBack'), view().open], [true, ['tops']]);
  click('#fewBack'); eq('กลับไปเลือกเพิ่ม: stays on toppings', [view().open, ev('sel.at'), !!$('#modal.show')], [['tops'], 'tops', false]);
  click('#btnAdd'); click('#fewOk'); eq('ลูกค้าขอแค่ 1 อย่าง: goes to honey', view().open, ['honey']);
  click('[data-honey="none"]'); click('#btnAdd'); eq('…added, fewTops 1', ev('cart[0].fewTops'), 1); clearCart();
  menu('greek'); size('g1n'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]'); click('#btnAdd');
  eq('69 dearer than 89: asked at ถัดไป', !!$('#cheapSwitch'), true);
  click('#cheapKeep'); eq('คงไว้: goes to honey at 99', [view().open, ev('priceSel().unit')], [['honey'], 99]);
  backToMenuCheck();
  function backToMenuCheck(){ ev('backToMenu()'); }

  // ---------- Acai ----------
  scrolls.length = 0;
  menu('acai');
  eq('acai: menu → toppings (no size step), primary "ถัดไป: น้ำผึ้ง · ฿189", no counter until extra', [view(), btn(), tally(), scrolls.map(s => s[0])], [{open:['tops'], done:['menu']}, 'ถัดไป: น้ำผึ้ง · ฿189', '', ['tops']]);
  click('[data-addopen]'); click('[data-add="Mango"]');
  eq('acai add-on: counter "เปลี่ยน/เพิ่ม +฿15", no scroll', [tally(), btn(), scrolls.length], ['เปลี่ยน/เพิ่ม +฿15', 'ถัดไป: น้ำผึ้ง · ฿204', 1]);
  click('#btnAdd');
  eq('acai: honey step, note link in last step', [view(), btn(), !!$('[data-noteopen]'), sum('tops')], [{open:['honey'], done:['menu', 'tops']}, 'เลือกน้ำผึ้งก่อน', true, 'ท็อปปิ้ง เพิ่ม มะม่วง · +฿15']);
  click('[data-honey="side"]'); click('[data-noteopen]');
  const note = $('#note'); note.value = 'แพ้ถั่ว'; note.dispatchEvent(new p.w.Event('input', {bubbles:true}));
  click('#btnAdd');
  eq('acai: added with honey + note', [ev('cart[0].unit'), ev('cart[0].honey'), ev('cart[0].note')], [204, 'side', 'แพ้ถั่ว']); clearCart();

  // ---------- Banana Choco: ไม่มีน้ำผึ้ง ปุ่มที่ขั้นท็อปปิ้ง = เพิ่มลงออเดอร์ ----------
  menu('banana');
  eq('banana: toppings is the last step → "เพิ่มลงออเดอร์", note link here, no honey anywhere', [view(), btn(), !!$('[data-noteopen]'), !!$('[data-honey]'), $('#builder').textContent.includes('น้ำผึ้ง')],
    [{open:['tops'], done:['menu']}, 'เพิ่มลงออเดอร์ · ฿149', true, false, false]);
  click('.sep'); eq('banana sep: counter "แยก +฿5"', [tally(), btn()], ['แยก +฿5', 'เพิ่มลงออเดอร์ · ฿154']);
  click('#btnAdd'); eq('banana added directly from toppings', [ev('cart[0].unit'), 'honey' in ev('cart[0]')], [154, false]); clearCart();

  // ---------- เลื่อนจอ: smooth · prefers-reduced-motion → ไม่ smooth ----------
  scrolls.length = 0; menu('greek');
  reduced = true; size('g1'); reduced = false;
  eq('auto-scroll smooth normally, instant with prefers-reduced-motion', scrolls.map(s => s[1]), ['smooth', 'auto']);
  ev('backToMenu()');

  // ---------- ตัวนับ = ราคาบนปุ่ม (P01–P23) · ฐานราคา + extra + แยก = ปุ่ม ----------
  const C = [
    ['P01', {menu:'greek', size:'g1n'}, 69],
    ['P02a', {menu:'greek', size:'g1n', picks:['Banana']}, 84], ['P02b', {menu:'greek', size:'g1n', picks:['Granola']}, 84], ['P02c', {menu:'greek', size:'g1n', picks:['Strawberries']}, 84],
    ['P03', {menu:'greek', size:'g1n', picks:['Banana', 'Mango']}, 99],
    ['P04', {menu:'greek', size:'g1'}, 89],
    ['P05', {menu:'greek', size:'g1', picks:['Banana', 'Banana', 'Banana']}, 89],
    ['P06', {menu:'greek', size:'g1', picks:['Banana', 'Banana', 'Banana', 'Mango']}, 104],
    ['P07', {menu:'greek', size:'g1', picks:['Banana', 'Banana', 'Banana', 'Mango', 'Granola']}, 114],
    ['P08', {menu:'greek', size:'g1', picks:['Granola', 'Blueberries', 'Strawberries']}, 129],
    ['P09', {menu:'greek', size:'g1', picks:['Banana', 'Banana']}, 89],
    ['P10', {menu:'greek', size:'g2', picks:['Banana', 'Mango', 'Kiwi', 'Chia', 'Almonds', 'Caramel']}, 174],
    ['P13', {menu:'acai'}, 189],
    ['P14', {menu:'acai', comps:{0:'Kiwi'}}, 189],
    ['P15', {menu:'acai', comps:{0:'Strawberries'}}, 204],
    ['P16', {menu:'acai', comps:{1:'Mango'}}, 189],
    ['P17', {menu:'acai', comps:{4:'Granola'}}, 199],
    ['P18', {menu:'acai', comps:{3:null}}, 189],
    ['P19', {menu:'acai', adds:['Mango', 'Mango', 'Granola']}, 234],
    ['P20', {menu:'banana'}, 149],
    ['P21a', {menu:'banana', comps:{0:'Strawberries'}}, 164], ['P21b', {menu:'banana', comps:{2:'Granola'}}, 159], ['P21c', {menu:'banana', comps:{0:'Strawberries', 2:'Granola'}}, 174],
    ['P23a', {menu:'acai', sep:true}, 194], ['P23b', {menu:'greek', size:'g1n', picks:['Banana'], sep:true}, 89],
  ];
  const bad = [];
  for(const [code, c, want] of C){
    menu(c.menu); if(c.size) size(c.size);
    (c.picks || []).forEach(n => click(ev('sel.picks').includes(n) ? `[data-more="${n}"]` : `[data-pick="${n}"]`));
    Object.entries(c.comps || {}).forEach(([i, n]) => { if(n === null) click(`[data-skip="${i}"]`); else { click(`[data-swap="${i}"]`); click(`[data-choose="${n}"][data-slot="${i}"]`); } });
    if(c.adds){ click('[data-addopen]'); c.adds.forEach(n => click(ev('sel.adds').includes(n) ? `[data-amore="${n}"]` : `[data-add="${n}"]`)); }
    if(c.sep) click('.sep');
    const t = $('#tally .tally'), extra = Number(t.dataset.extra), sep = Number(t.dataset.sep);
    const base = c.size ? ev(`MENU.greek.sizes.find(s => s.id === '${c.size}').price`) : ev(`MENU['${c.menu}'].price`);
    const text = tally(), shown = [...text.matchAll(/\+฿(\d+)/g)].map(m => Number(m[1]));
    const ok = price() === want && base + extra + sep === price() && (extra ? shown.includes(extra) : true) && (sep ? text.includes(`แยก +฿${sep}`) : !text.includes('แยก'))
      && (c.menu !== 'greek' || text.includes(c.size === 'g1n' ? 'ชิ้นละ 15' : 'ฟรี'));
    if(!ok) bad.push({code, button:price(), want, base, extra, sep, text});
    ev('backToMenu()');
  }
  eq(`counter matches button price for ${C.length} cases (P01–P23): base + extra + แยก = button = checklist value`, bad, []);

  // ---------- ตัวนับ: กะพริบครั้งเดียวตอนเปลี่ยนจากไม่มีเป็นมี ----------
  menu('greek'); size('g1'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`));
  eq('no extra yet: no orange part', !!$('.tally .xtra'), false);
  click('[data-pick="Chia"]'); eq('extra appears: flashes', !!$('.tally .xtra.flash'), true);
  click('[data-pick="Almonds"]'); eq('extra grows: no second flash', [!!$('.tally .xtra'), !!$('.tally .xtra.flash')], [true, false]);
  click('[data-pick="Almonds"]'); click('[data-pick="Chia"]'); click('[data-pick="Chia"]');
  eq('back to none then some again: flashes again', !!$('.tally .xtra.flash'), true);
  ev('backToMenu()');

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
