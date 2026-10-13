// หน้าเลือกออเดอร์ (Tee 2026-10-13 v3): ขั้นที่เปิดแล้วเปิดค้าง ไม่ยุบ · ครบแล้ววงกลมเป็นเครื่องหมายถูก
// Greek เมนู → ขนาด → (ท็อปปิ้ง + น้ำผึ้ง) · Acai เมนู → (ท็อปปิ้งตามสูตร + น้ำผึ้ง) · Banana Choco เมนู → ท็อปปิ้งตามสูตร
// ปุ่มหลักหน้าที่เดียว · ยังไม่ครบ = สีเทา กดแล้วพาไปขั้นที่ขาด + กรอบกะพริบ · ช่องสรุปแก้วตรงกับราคาบนปุ่ม (P01–P23)
const {eq, done, open, wait} = require('../qa/qa-helper');

(async () => {
  const scrolls = [];   // นับการเลื่อนจออัตโนมัติ (jsdom ไม่เลื่อนจริง)
  let reduced = false;
  const p = open({before(w){
    w.Element.prototype.scrollIntoView = function(o){ scrolls.push([this.dataset.step, o && o.behavior]); };
    w.matchMedia = q => ({matches: /reduce/.test(q) && reduced, addEventListener(){}, removeEventListener(){}});
  }});
  await wait(30); p.signIn();
  const {$, $$, click, ev, menu, size, off} = p;
  const btn = () => $('#btnAdd').textContent, price = () => Number((btn().match(/฿([\d,]+)/) || [])[1]);
  const steps = () => $$('#builder .sec').map(s => s.dataset.step);
  const doneSteps = () => $$('#builder .sec.done').map(s => s.dataset.step);
  const entered = () => $$('#builder .sec.enter').map(s => s.dataset.step);
  const summary = () => !$('#tally .cupsum').children.length ? $('#tally .cupsum').textContent.trim() : [...$('#tally .cupsum').children].filter(c => !c.classList.contains('dot')).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' · ');
  const dots = () => $$('.fdots i').map(i => i.classList.contains('on') ? '●' : '○').join('');
  const clearCart = () => { while($$('#cart .rm').length) click($$('#cart .rm')[0]); };

  // ---------- เริ่ม: มีแค่ขั้นเมนู · แถบล่างหน้าตาเดียวตั้งแต่เปิดหน้า ----------
  eq('start: only menu step, primary grey "เลือกเมนูก่อน", summary "ยังไม่ได้เลือกเมนู"', [steps(), btn(), off(), summary(), $('#btnAdd').disabled], [['menu'], 'เลือกเมนูก่อน', true, 'ยังไม่ได้เลือกเมนู', false]);
  scrolls.length = 0; click('#btnAdd');
  eq('grey button tapped: scrolls to the missing step + border flashes once, nothing added', [scrolls.map(s => s[0]), $('[data-step="menu"]').classList.contains('flash'), ev('cart.length')], [['menu'], true, 0]);
  eq('no collapsed rows or "เปลี่ยน" links anywhere', [!!$('[data-open]'), !!$('.chg'), $('#builder').textContent.includes('เปลี่ยน')], [false, false, false]);

  // ---------- Greek ทุกขนาด ----------
  for(const [sz, base, mid] of [['g1n', 69, 'ชิ้นละ 15'], ['g1', 89, 'ฟรี'], ['g2', 129, 'ฟรี']]){
    scrolls.length = 0; const nCart = ev('cart.length');
    menu('greek');
    eq(`greek ${sz}: size step slides in below menu (menu stays open with Greek highlighted, ✓), scrolled once`, [steps(), entered(), doneSteps(), $$('.base.on').length, !!$('[data-menu="acai"]'), scrolls.map(s => s[0]), btn(), summary()],
      [['menu', 'size'], ['size'], ['menu'], 1, true, ['size'], 'เลือกขนาดก่อน', 'Greek Yogurt']);
    click('#btnAdd');
    eq(`greek ${sz}: grey tap → scroll to size + flash`, [scrolls.map(s => s[0]), $('[data-step="size"]').classList.contains('flash'), ev('cart.length') - nCart], [['size', 'size'], true, 0]);
    size(sz);
    const name = 'Greek ' + ev(`MENU.greek.sizes.find(s => s.id === '${sz}').name`);
    eq(`greek ${sz}: toppings + honey slide in together (honey after toppings), scroll to toppings, grey "เลือกน้ำผึ้งก่อน · ฿${base}" (price once size chosen)`, [steps(), entered(), doneSteps(), scrolls.map(s => s[0]).slice(2), btn(), summary()],
      [['menu', 'size', 'tops', 'honey'], ['tops', 'honey'], ['menu', 'size'], ['tops'], `เลือกน้ำผึ้งก่อน · ฿${base}`, `${name} · ${mid}`]);
    const n0 = scrolls.length;
    const greyPrice = [];   // ราคาบนปุ่มเทา = priceSel() ทุกครั้งที่กดท็อปปิ้ง
    const pick = t => { click(ev('sel.picks').includes(t) ? `[data-more="${t}"]` : `[data-pick="${t}"]`); greyPrice.push(btn() === `เลือกน้ำผึ้งก่อน · ฿${ev('priceSel().unit')}`); };
    if(sz === 'g1n') pick('Banana');   // 69: 1 ชิ้น (84 < 89 ไม่ถามเปลี่ยน)
    else ['Kiwi', 'Mango', 'Mango', 'Banana'].forEach(pick);   // ฟรีครบ 3 + เกิน 1
    eq(`greek ${sz}: grey button price follows priceSel() on every topping tap`, greyPrice.every(Boolean) && greyPrice.length > 0, true);
    eq(`greek ${sz}: picking toppings never scrolls, no new step animation, toppings ✓`, [scrolls.length, entered(), doneSteps()], [n0, [], ['menu', 'size', 'tops']]);
    click('#btnAdd');
    eq(`greek ${sz}: grey tap → scroll to honey + flash`, [scrolls.slice(n0).map(s => s[0]), $('[data-step="honey"]').classList.contains('flash')], [['honey'], true]);
    click('[data-honey="little"]');
    const pr = ev('priceSel().unit');
    eq(`greek ${sz}: honey chosen → "เพิ่มลงออเดอร์ · ฿${pr}", all steps ✓, everything still open`, [btn(), off(), doneSteps(), $$('#builder .sb').length], [`เพิ่มลงออเดอร์ · ฿${pr}`, false, ['menu', 'size', 'tops', 'honey'], 4]);
    click('#btnAdd');
    eq(`greek ${sz}: added at ฿${pr}, back to menu`, [ev('cart[cart.length-1].unit'), ev('cart[cart.length-1].honey'), steps()], [pr, 'little', ['menu']]);
  }
  clearCart();

  // ---------- แก้ได้ด้วยการกดตัวเลือกตรงๆ ----------
  menu('greek'); size('g1'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`)); click('[data-honey="normal"]');
  scrolls.length = 0;
  size('g2');
  eq('change size: toppings + honey kept, price recalculated, no new step, no scroll', [ev('sel.picks'), ev('sel.honey'), btn(), entered(), scrolls.length], [['Banana', 'Mango', 'Kiwi'], 'normal', 'เพิ่มลงออเดอร์ · ฿129', [], 0]);
  click('[data-honey="lots"]'); eq('change honey directly', [ev('sel.honey'), $$('.hon.on').length], ['lots', 1]);
  menu('greek'); eq('same menu tapped again: nothing cleared', [ev('sel.size'), ev('sel.picks.length'), ev('sel.honey')], ['g2', 3, 'lots']);
  menu('acai');
  eq('different menu: steps after menu start over (slide in), size gone', [steps(), entered(), ev('sel.size'), ev('sel.picks'), ev('sel.honey'), scrolls.map(s => s[0])], [['menu', 'tops', 'honey'], ['tops', 'honey'], null, [], null, ['tops']]);
  ev('backToMenu()');

  // ---------- หน้าต่างถามกลับไปอยู่ตอนกดเพิ่มลงออเดอร์ ----------
  menu('greek'); size('g1'); click('[data-pick="Banana"]'); click('[data-honey="normal"]'); click('#btnAdd');
  eq('few free toppings: asked at เพิ่มลงออเดอร์', [!!$('#fewBack'), ev('cart.length')], [true, 0]);
  click('#fewBack'); eq('กลับไปเลือกเพิ่ม: nothing added, selection kept', [ev('cart.length'), ev('sel.picks'), steps()], [0, ['Banana'], ['menu', 'size', 'tops', 'honey']]);
  click('#btnAdd'); click('#fewOk'); eq('ลูกค้าขอแค่ 1 อย่าง: added with fewTops 1', [ev('cart.length'), ev('cart[0].fewTops')], [1, 1]); clearCart();
  menu('greek'); size('g1n'); click('[data-pick="Banana"]'); click('[data-pick="Mango"]'); click('[data-honey="normal"]'); click('#btnAdd');
  eq('69 dearer than 89: asked at เพิ่มลงออเดอร์', !!$('#cheapSwitch'), true);
  click('#cheapKeep'); eq('คงไว้: added at 99', ev('cart[0].unit'), 99); clearCart();

  // ---------- Acai ----------
  scrolls.length = 0;
  menu('acai');
  eq('acai: recipe toppings + honey together, toppings ✓ already (recipe), summary "Acai · ตามสูตร", grey button already priced', [steps(), doneSteps(), btn(), summary(), scrolls.map(s => s[0])], [['menu', 'tops', 'honey'], ['menu', 'tops'], 'เลือกน้ำผึ้งก่อน · ฿189', 'Acai · ตามสูตร', ['tops']]);
  click('[data-addopen]'); click('[data-add="Mango"]');
  eq('acai add-on: summary "Acai · เปลี่ยน/เพิ่ม +฿15", no scroll', [summary(), scrolls.length], ['Acai · เปลี่ยน/เพิ่ม +฿15', 1]);
  eq('note link only in the last step (honey)', [!!$('[data-step="honey"] [data-noteopen]'), !!$('[data-step="tops"] [data-noteopen]')], [true, false]);
  click('[data-honey="side"]'); click('[data-noteopen]');
  const note = $('#note'); note.value = 'แพ้ถั่ว'; note.dispatchEvent(new p.w.Event('input', {bubbles:true}));
  click('#btnAdd');
  eq('acai: added with honey + note', [ev('cart[0].unit'), ev('cart[0].honey'), ev('cart[0].note')], [204, 'side', 'แพ้ถั่ว']); clearCart();

  // ---------- Banana Choco: ไม่มีน้ำผึ้ง เพิ่มได้ทันที ----------
  menu('banana');
  eq('banana: menu → recipe toppings only, add ready, note link in toppings', [steps(), btn(), off(), summary(), !!$('[data-step="tops"] [data-noteopen]'), !!$('[data-honey]')],
    [['menu', 'tops'], 'เพิ่มลงออเดอร์ · ฿149', false, 'Banana Choco · ตามสูตร', true, false]);
  click('.sep'); eq('banana sep: summary ends with "แยก +฿5"', [summary(), btn()], ['Banana Choco · ตามสูตร · แยก +฿5', 'เพิ่มลงออเดอร์ · ฿154']);
  click('#btnAdd'); eq('banana added', [ev('cart[0].unit'), 'honey' in ev('cart[0]')], [154, false]); clearCart();

  // ---------- เลื่อนจอ: smooth · prefers-reduced-motion → ไม่ smooth ----------
  scrolls.length = 0; menu('greek');
  reduced = true; size('g1'); reduced = false;
  eq('auto-scroll smooth normally, instant with prefers-reduced-motion', scrolls.map(s => s[1]), ['smooth', 'auto']);
  ev('backToMenu()');

  // ---------- ช่องสรุป ----------
  menu('greek'); size('g1');
  const prog = [dots()];
  ['Banana', 'Mango', 'Kiwi', 'Chia'].forEach(t => { click(`[data-pick="${t}"]`); prog.push(dots()); });
  eq('free dots ●●○ fill one by one, stay full past 3 · aria-label · no "n/3" text', [prog, $('.cupsum .tq').getAttribute('aria-label'), /\d\/3/.test($('#tally').textContent), summary()],
    [['○○○', '●○○', '●●○', '●●●', '●●●'], 'ใช้ท็อปปิ้งฟรีแล้ว 3 จาก 3', false, 'Greek 1 สกู๊ป · ฟรี · คิดเพิ่ม +฿15']);
  size('g1n'); eq('Greek 69 summary: "ชิ้นละ 15 · N ชิ้น +฿X"', summary(), 'Greek 1 สกู๊ป · ชิ้นละ 15 · 4 ชิ้น +฿60');
  ev('backToMenu()');

  // ---------- ช่องสรุป = ราคาบนปุ่ม (P01–P23) · ฐานราคา + extra + แยก = ปุ่ม = ค่าในเช็กลิสต์ ----------
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
    const greyOk = !$('[data-honey]') || btn() === `เลือกน้ำผึ้งก่อน · ฿${ev('priceSel().unit')}`;   // ปุ่มเทา (ยังไม่เลือกน้ำผึ้ง) บอกราคาเดียวกับ priceSel()
    if($('[data-honey]')) click('[data-honey="normal"]');
    const t = $('#tally .cupsum'), extra = Number(t.dataset.extra), sep = Number(t.dataset.sep);
    const base = c.size ? ev(`MENU.greek.sizes.find(s => s.id === '${c.size}').price`) : ev(`MENU['${c.menu}'].price`);
    const text = summary(), shown = [...text.matchAll(/\+฿(\d+)/g)].map(m => Number(m[1]));
    const ok = greyOk && price() === want && base + extra + sep === price() && (extra ? shown.includes(extra) : !shown.filter(x => x !== sep).length) && (sep ? text.endsWith(`แยก +฿${sep}`) : !text.includes('แยก'))
      && (c.menu !== 'greek' || text.includes(c.size === 'g1n' ? 'ชิ้นละ 15' : 'ฟรี')) && (c.menu === 'greek' || extra || text.includes('ตามสูตร'));
    if(!ok) bad.push({code, button:price(), want, base, extra, sep, text});
    ev('backToMenu()');
  }
  eq(`summary matches button price for ${C.length} cases (P01–P23): base + extra + แยก = button = checklist value · grey button price = priceSel()`, bad, []);

  // ---------- "คิดเพิ่ม" กะพริบครั้งเดียวตอนเปลี่ยนจากไม่มีเป็นมี ----------
  menu('greek'); size('g1'); ['Banana', 'Mango', 'Kiwi'].forEach(t => click(`[data-pick="${t}"]`));
  eq('no extra yet: no orange part', !!$('.cupsum .xtra'), false);
  click('[data-pick="Chia"]'); eq('extra appears: flashes', !!$('.cupsum .xtra.flash'), true);
  click('[data-pick="Almonds"]'); eq('extra grows: no second flash', [!!$('.cupsum .xtra'), !!$('.cupsum .xtra.flash')], [true, false]);
  click('[data-pick="Almonds"]'); click('[data-pick="Chia"]'); click('[data-pick="Chia"]');
  eq('back to none then some again: flashes again', !!$('.cupsum .xtra.flash'), true);
  ev('backToMenu()');

  eq('no runtime errors', p.errors, []);
  p.close(); done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
