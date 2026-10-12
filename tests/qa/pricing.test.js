// QA หมวด 0 (Z06) + 1 ราคา (P01–P27 ส่วนที่คิดเงิน) · ค่าคาดหวังคิดจาก docs/business-rules.md ไม่ได้คัดลอกจากโค้ด
const {eq, done, rng, vmLoad} = require('./qa-helper');
const ev = vmLoad(['config.js', 'core.js', 'pricing.js']);
const J = JSON.stringify;
const price = (menu, st) => ev(`priceItem(MENU[${J(menu)}], ${J({picks:[], comps:[], adds:[], sep:false, ...st})})`);
const greek = (size, picks, more = {}) => price('greek', {size, picks, ...more}).unit;
const ACAI = ['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'], BANANA = ['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips'];
const acai = (ch = {}, more = {}) => price('acai', {comps: ACAI.map((d, i) => i in ch ? ch[i] : d), ...more}).unit;
const banana = (ch = {}, more = {}) => price('banana', {comps: BANANA.map((d, i) => i in ch ? ch[i] : d), ...more}).unit;

// ---------- Z06: CONFIG ตรงกับ business-rules.md ----------
const C = ev('CONFIG');
const sizes = C.menus.find(m => m.id === 'greek').sizes;
eq('Z06 ราคาเมนู 69/89/129/189/149', [...sizes.map(s => s.price), C.menus.find(m => m.id === 'acai').price, C.menus.find(m => m.id === 'banana').price], [69, 89, 129, 189, 149]);
eq('Z06 ไซส์ 69 perTop 15 · ไซส์ 89/129 ไม่มี perTop', sizes.map(s => s.perTop || 0), [15, 0, 0]);
eq('Z06 ฟรี 3 · เกิน +15 · เพิ่ม 15 · แยก +5', [C.freeToppingCount, C.overToppingPrice, C.addTopPrice, C.separateToppingPrice], [3, 15, 15, 5]);
eq('Z06 Extra: กราโนล่า 10 บลูเบอร์รี่ 15 สตรอว์เบอร์รี่ 15 · ที่เหลือฟรี', C.items.filter(i => i.price > 0).map(i => [i.name, i.price]), [['Granola', 10], ['Blueberries', 15], ['Strawberries', 15]]);
const RULE_ITEMS = {dried:['Almonds', 'Cashew', 'Chia', 'Flaxseeds', 'Cherry Jelly', 'Cacao nibs', 'Chocolate Chips', 'Biscoff Crumble', 'Chocolate crumble', 'Marshmallow', 'Granola'],
  fruit:['Banana', 'Mango', 'Kiwi', 'Blueberries', 'Strawberries'], sauce:['Hazelnut spread', 'Original peanut butter', 'Cacao peanut butter', 'Caramel']};
eq('Z06 ท็อปปิ้งครบ 20 อย่าง หมวดถูก', Object.fromEntries(Object.keys(RULE_ITEMS).map(c => [c, C.items.filter(i => i.cat === c).map(i => i.name).sort()])), Object.fromEntries(Object.entries(RULE_ITEMS).map(([c, l]) => [c, l.slice().sort()])));
const TH = {Almonds:'อัลมอนด์', Cashew:'เม็ดมะม่วงหิมพานต์', Chia:'เมล็ดเจีย', Flaxseeds:'เมล็ดแฟลกซ์', 'Cherry Jelly':'เยลลี่เชอร์รี่', 'Cacao nibs':'คาเคานิบส์', 'Chocolate Chips':'ช็อกโกแลตชิพ',
  'Biscoff Crumble':'บิสคอฟครัมเบิล', 'Chocolate crumble':'ช็อกโกแลตครัมเบิล', Marshmallow:'มาร์ชเมลโลว์', Banana:'กล้วย', Mango:'มะม่วง', Kiwi:'กีวี', 'Hazelnut spread':'เฮเซลนัทสเปรด',
  'Original peanut butter':'เนยถั่วออริจินัล', 'Cacao peanut butter':'เนยถั่วคาเคา', Caramel:'คาราเมล', Granola:'กราโนล่า', Blueberries:'บลูเบอร์รี่', Strawberries:'สตรอว์เบอร์รี่'};
eq('Z06 ชื่อไทยตรงทุกตัว', Object.fromEntries(C.items.map(i => [i.name, i.th])), Object.fromEntries(C.items.map(i => [i.name, TH[i.name]])));
eq('Z06 Acai / Banana Choco มากับเมนู', [C.menus.find(m => m.id === 'acai').defaults, C.menus.find(m => m.id === 'banana').defaults], [ACAI, BANANA]);
eq('Z06 น้ำผึ้ง 5 แบบ ไม่มีค่าเริ่มต้น · Banana Choco noHoney · Acai/Greek มีน้ำผึ้ง', [C.honey.map(h => h.name), C.honeyDefault, C.menus.map(m => !!m.noHoney)],
  [['ไม่รับ', 'ราดนิดหน่อย', 'ราดปกติ', 'ราดเยอะ', 'แยก'], null, [false, false, true]]);
eq('Z06 โปร 3 แบบ', C.promos.map(p => [p.type, p.menus || null, p.amount || null, p.exclude || null]),
  [['b1g1', ['acai', 'banana'], null, null], ['off', ['acai', 'banana'], 30, null], ['freetop', null, null, ['Granola', 'Blueberries', 'Strawberries']]]);
eq('Z06 ชำระ 3 แบบ · กินเลย/กลับบ้าน · resetHour 23', [C.methods.map(m => m.name), C.dining.map(d => d.name), C.resetHour], [['เงินสด', 'PromptPay', 'ไทยช่วยไทย พลัส'], ['กินเลย', 'กลับบ้าน'], 23]);

// ---------- ราคาแก้ว ----------
eq('P01 Greek 69 ไม่ใส่ท็อปปิ้ง = 69', greek('g1n', []), 69);
eq('P02 Greek 69 + กล้วย / กราโนล่า / สตรอว์เบอร์รี่ = 84 ทุกแบบ', ['Banana', 'Granola', 'Strawberries'].map(n => greek('g1n', [n])), [84, 84, 84]);
eq('P03 Greek 69 + กล้วย + มะม่วง = 99 (89 ถ้าเปลี่ยนไซส์)', [greek('g1n', ['Banana', 'Mango']), greek('g1', ['Banana', 'Mango'])], [99, 89]);
eq('P05 Greek 89 + กล้วย ×3 = 89 · ฟรีใช้ 3', [greek('g1', ['Banana', 'Banana', 'Banana']), price('greek', {size:'g1', picks:['Banana', 'Banana', 'Banana']}).freeUsed], [89, 3]);
eq('P06 Greek 89 + กล้วย ×3 + มะม่วง = 104', greek('g1', ['Banana', 'Banana', 'Banana', 'Mango']), 104);
eq('P07 Greek 89 + กล้วย ×3 + มะม่วง + กราโนล่า = 114', greek('g1', ['Banana', 'Banana', 'Banana', 'Mango', 'Granola']), 114);
eq('P08 Greek 89 + กราโนล่า + บลูเบอร์รี่ + สตรอว์เบอร์รี่ = 129 · ฟรี 0/3', [greek('g1', ['Granola', 'Blueberries', 'Strawberries']), price('greek', {size:'g1', picks:['Granola', 'Blueberries', 'Strawberries']}).freeUsed], [129, 0]);
eq('P09 Greek 89 + กล้วย ×2 = 89', greek('g1', ['Banana', 'Banana']), 89);
eq('P10 Greek 129 + ของฟรี 6 ชิ้น = 174', greek('g2', ['Banana', 'Mango', 'Kiwi', 'Almonds', 'Chia', 'Caramel']), 174);

// P11: สลับลำดับการกด 20 แบบ ยอดเท่ากัน
{
  const r = rng(11), base = ['Banana', 'Banana', 'Mango', 'Granola', 'Kiwi', 'Strawberries', 'Almonds'];
  const totals = new Set();
  for(let k = 0; k < 20; k++){ const p = base.slice().sort(() => r() - 0.5); ['g1n', 'g1', 'g2'].forEach(s => totals.add(s + ':' + greek(s, p))); }
  // ของฟรี 5 ชิ้น (เกิน 2 = 30) + กราโนล่า 10 + สตรอว์ฯ 15 → 89+55 / 129+55 · ไซส์ 69: 7 ชิ้น × 15
  eq('P11 สลับลำดับ 20 แบบ × 3 ขนาด ยอดเท่ากัน', [...totals].sort(), ['g1:144', 'g1n:174', 'g2:184']);
}
eq('P13 Acai ไม่แก้อะไร = 189', acai(), 189);
eq('P14 Acai กล้วย → กีวี = 189', acai({0:'Kiwi'}), 189);
eq('P15 Acai กล้วย → สตรอว์เบอร์รี่ = 204', acai({0:'Strawberries'}), 204);
eq('P16 Acai สตรอว์เบอร์รี่ → มะม่วง = 189', acai({1:'Mango'}), 189);
eq('P17 Acai เมล็ดแฟลกซ์ → กราโนล่า = 199', acai({4:'Granola'}), 199);
eq('P18 Acai ไม่รับกราโนล่า = 189', acai({3:null}), 189);
eq('P19 Acai + เพิ่มมะม่วง ×2 + เพิ่มกราโนล่า = 234', acai({}, {adds:['Mango', 'Mango', 'Granola']}), 234);
eq('P20 Banana Choco ไม่แก้อะไร = 149', banana(), 149);
eq('P21 Banana Choco กล้วย→สตรอว์ฯ / เม็ดมะม่วงฯ→กราโนล่า / ทั้งสอง = 164/159/174', [banana({0:'Strawberries'}), banana({2:'Granola'}), banana({0:'Strawberries', 2:'Granola'})], [164, 159, 174]);
eq('P23 Acai + แยก = 194 (×2 แก้ว = 388) · Greek 69 + กล้วย + แยก = 89', [acai({}, {sep:true}), acai({}, {sep:true}) * 2, greek('g1n', ['Banana'], {sep:true})], [194, 388, 89]);
eq('P23 แก้วที่ไม่มีท็อปปิ้ง แยกไม่คิด 5 (Greek ว่าง / Acai ไม่รับทุกช่อง)', [greek('g1', [], {sep:true}), acai({0:null, 1:null, 2:null, 3:null, 4:null}, {sep:true})], [89, 189]);
eq('P24 น้ำผึ้งทุกแบบราคาเท่ากัน (ราคาไม่ขึ้นกับน้ำผึ้ง)', ['none', 'little', 'normal', 'lots', 'side'].map(h => price('acai', {comps:ACAI, honey:h}).unit), [189, 189, 189, 189, 189]);

// ---------- P27: property test เทียบกับฟังก์ชันอ้างอิงที่เขียนใหม่จาก business-rules.md ----------
const RULES = {
  base:{g1n:69, g1:89, g2:129, acai:189, banana:149},
  extra:{Granola:10, Blueberries:15, Strawberries:15},           // §2 กลุ่ม Extra
  defaults:{acai:ACAI, banana:BANANA},
  cat:Object.fromEntries(Object.entries(RULE_ITEMS).flatMap(([c, l]) => l.map(n => [n, c]))),
};
/* ราคาตาม business-rules.md §1–5.1 */
function refPrice(o){
  const isExtra = n => n in RULES.extra;
  if(o.menu === 'greek'){
    let p = RULES.base[o.size];
    if(o.size === 'g1n') p += 15 * o.picks.length;                     // §3.5 ทุกชิ้น 15
    else {
      const free = o.picks.filter(n => !isExtra(n)).length;            // §3.2–3.3 ฟรี 3 ชิ้นแรก ชิ้นที่ 4+ = 15
      p += Math.max(0, free - 3) * 15 + o.picks.filter(isExtra).reduce((a, n) => a + RULES.extra[n], 0);   // §3.4 Extra ตามราคา
    }
    if(o.sep && o.picks.length) p += 5;                                // §5.1
    return p;
  }
  let p = RULES.base[o.menu];
  RULES.defaults[o.menu].forEach((d, i) => {
    const n = o.comps[i];
    if(n === null || n === d) return;                                  // ไม่รับ / ไม่เปลี่ยน: ไม่ลดไม่เพิ่ม
    if(!isExtra(d) && isExtra(n)) p += RULES.extra[n];                 // §4 ของฟรี → Extra คิดตามราคา Extra
  });
  p += 15 * o.adds.length;                                             // §4 เพิ่มท็อปปิ้ง ชิ้นละ 15
  const has = o.comps.some(n => n !== null) || o.adds.length;
  if(o.sep && has) p += 5;
  return p;
}
{
  const r = rng(27), all = Object.keys(RULES.cat);
  let bad = null, n = 0;
  for(; n < 1000; n++){
    const menu = r.pick(['greek', 'greek', 'acai', 'banana']);
    const o = {menu, sep: r() < 0.3, picks:[], comps:[], adds:[]};
    if(menu === 'greek'){ o.size = r.pick(['g1n', 'g1', 'g2']); const k = r.int(8); for(let i = 0; i < k; i++) o.picks.push(r.pick(all)); }
    else {
      o.comps = RULES.defaults[menu].map(d => { const x = r(); if(x < 0.55) return d; if(x < 0.7) return null; return r.pick(all.filter(n => RULES.cat[n] === RULES.cat[d])); });
      const k = r() < 0.4 ? r.int(4) : 0; for(let i = 0; i < k; i++) o.adds.push(r.pick(all));
    }
    const got = price(menu, o).unit, exp = refPrice(o);
    if(got !== exp){ bad = {seed:27, i:n, order:o, got, exp}; break; }
  }
  eq('P27 property 1,000 แก้ว (seed 27) ตรงกับฟังก์ชันอ้างอิง', bad, null);
}
done();
