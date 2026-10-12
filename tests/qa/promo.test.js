// QA หมวด 2 โปรโมชัน (PR01–PR08, PR12) ระดับฟังก์ชัน · ค่าคาดหวังจาก business-rules.md §6.1
const {eq, done, rng, vmLoad} = require('./qa-helper');
const ev = vmLoad(['config.js', 'core.js', 'pricing.js', 'promo.js']);
const J = JSON.stringify;
const ACAI = ['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'], BANANA = ['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips'];
let k = 0;
/* แก้วในตะกร้า (รูปแบบเดียวกับ addSel) */
function cup(menu, o = {}){
  const st = {picks:[], comps: menu === 'acai' ? ACAI.slice() : menu === 'banana' ? BANANA.slice() : [], adds:[], sep:false, ...o};
  Object.entries(o.ch || {}).forEach(([i, n]) => { st.comps[i] = n; });
  const P = ev(`priceItem(MENU[${J(menu)}], ${J(st)})`);
  return {menu, name: ev(`MENU[${J(menu)}].name`), sizeName:P.sizeName, tops:P.tops, ...(menu !== 'banana' && {honey:'normal'}), note:'', unit:P.unit, qty:o.qty || 1, ...(P.sep && {sep:P.sep}), key:'k' + (++k)};
}
const promo = (id, items, want) => ev(`promoEval(PROMO[${J(id)}], ${J(items)}, ${J(want || null)})`);
const gross = items => items.reduce((a, i) => a + i.unit * i.qty, 0);
const net = (id, items, want) => { const r = promo(id, items, want); return gross(items) - (r.ok ? r.discount : 0); };

const A1 = cup('acai'), A2 = cup('acai'), B1 = cup('banana'), B2 = cup('banana'), G = cup('greek', {size:'g1', picks:['Banana', 'Mango', 'Kiwi']});
eq('PR01 1 แถม 1: Acai + Banana Choco ลด 149 จ่าย 189', [promo('b1g1', [A1, B1]).discount, net('b1g1', [A1, B1])], [149, 189]);
eq('PR02 1 แถม 1: Acai + Acai ลด 189 / Banana + Banana ลด 149', [promo('b1g1', [A1, A2]).discount, promo('b1g1', [B1, B2]).discount], [189, 149]);
eq('PR02 1 แถม 1: แก้วเดียวกัน ×2 (บรรทัดเดียว qty 2)', [promo('b1g1', [cup('acai', {qty:2})]).discount, promo('b1g1', [cup('banana', {qty:2})]).discount], [189, 149]);
eq('PR03 1 แถม 1: Acai ×2 + Banana ×2 ลด 149 ครั้งเดียว', promo('b1g1', [cup('acai', {qty:2}), cup('banana', {qty:2})]).discount, 149);
{
  const one = promo('b1g1', [A1]), gr = promo('b1g1', [G, cup('greek', {size:'g2'})]);
  eq('PR04 1 แถม 1: แก้วเดียว / มีแต่ Greek ใช้ไม่ได้ พร้อมเหตุผล', [one.ok, !!one.why, gr.ok, !!gr.why], [false, true, false, true]);
}
{
  const Aplus = cup('acai', {adds:['Mango'], sep:true}), items = [Aplus, cup('acai')];
  eq('PR05 1 แถม 1: แก้วฟรีมีเพิ่มท็อปปิ้ง + แยก ลดแค่ 189 (ค่าเพิ่ม 20 ยังคิด)', [promo('b1g1', items).discount, net('b1g1', items)], [189, 209]);
  const Bplus = cup('banana', {ch:{0:'Strawberries'}, adds:['Kiwi']});
  eq('PR05 1 แถม 1: Banana ที่เปลี่ยน Extra + เพิ่ม เป็นแก้วฟรี ลด 149 (จ่าย 189 + 30)', [promo('b1g1', [A1, Bplus]).discount, net('b1g1', [A1, Bplus])], [149, 219]);
}
{
  const r = promo('off30', [A1, B1]), r2 = promo('off30', [A1, B1], {key:B1.key});
  eq('PR06 ลด 30: เลือกแก้วแรกให้ · เปลี่ยนเป็นแก้วที่เลือกได้ · ลด 30', [r.discount, r.target.key, r.targets.length, r2.target.key, r2.discount], [30, A1.key, 2, B1.key, 30]);
  eq('PR06 ลด 30: Greek อย่างเดียวใช้ไม่ได้', promo('off30', [G]).ok, false);
}
eq('PR07 ฟรี 1 ท็อปปิ้ง: Greek ชิ้นที่ 4 / แก้ว 69 / Acai เพิ่มท็อปปิ้ง ลด 15', [
  promo('freetop', [cup('greek', {size:'g1', picks:['Banana', 'Mango', 'Kiwi', 'Chia']})]).discount,
  promo('freetop', [cup('greek', {size:'g1n', picks:['Banana']})]).discount,
  promo('freetop', [cup('acai', {adds:['Mango']})]).discount], [15, 15, 15]);
eq('PR08 ฟรี 1 ท็อปปิ้ง: มีแต่กราโนล่า/บลูเบอร์รี่/สตรอว์ฯ ใช้ไม่ได้ (Greek 89 Extra, Greek 69 กราโนล่า, Acai เปลี่ยน→สตรอว์ฯ, Acai เพิ่มสตรอว์ฯ, Greek ฟรีไม่เกิน 3)', [
  promo('freetop', [cup('greek', {size:'g1', picks:['Granola', 'Blueberries', 'Strawberries']})]).ok,
  promo('freetop', [cup('greek', {size:'g1n', picks:['Granola']})]).ok,
  promo('freetop', [cup('acai', {ch:{0:'Strawberries'}})]).ok,
  promo('freetop', [cup('acai', {adds:['Strawberries', 'Granola']})]).ok,
  promo('freetop', [G]).ok], [false, false, false, false, false]);

// ---------- PR12: สุ่มตะกร้า + โปร + เป้าหมาย · ยอดไม่ต่ำกว่า 0 และส่วนลดตรงกับกติกา ----------
{
  const r = rng(12), allTops = ev('CONFIG.items.map(i => i.name)'), cat = ev('Object.fromEntries(CONFIG.items.map(i => [i.name, i.cat]))');
  const EXCL = ['Granola', 'Blueberries', 'Strawberries'];
  /* ส่วนลดอ้างอิงจาก §6.1 */
  const ref = (id, items, want) => {
    const el = items.filter(i => i.menu !== 'greek'), base = i => (i.menu === 'acai' ? 189 : 149);
    if(id === 'b1g1') return el.reduce((a, i) => a + i.qty, 0) >= 2 ? Math.min(...el.map(base)) : null;
    if(id === 'off30') return el.length ? 30 : null;
    const paid = items.some(i => i.tops.some(t => !t.removed && !EXCL.includes(t.name) && (t.add || (i.menu === 'greek' && t.extra > 0))));
    return paid ? 15 : null;
  };
  let bad = null;
  for(let n = 0; n < 2000 && !bad; n++){
    const items = [], m = 1 + r.int(4);
    for(let j = 0; j < m; j++){
      const menu = r.pick(['greek', 'acai', 'banana']), o = {qty: 1 + (r() < 0.2 ? 1 : 0), sep: r() < 0.3};
      if(menu === 'greek'){ o.size = r.pick(['g1n', 'g1', 'g2']); o.picks = Array.from({length:r.int(7)}, () => r.pick(allTops)); }
      else { o.ch = {}; (menu === 'acai' ? ACAI : BANANA).forEach((d, i) => { const x = r(); if(x < 0.15) o.ch[i] = null; else if(x < 0.35) o.ch[i] = r.pick(allTops.filter(t => cat[t] === cat[d])); });
        o.adds = r() < 0.4 ? Array.from({length:1 + r.int(3)}, () => r.pick(allTops)) : []; }
      items.push(cup(menu, o));
    }
    const id = r.pick(['b1g1', 'off30', 'freetop']), res = promo(id, items, r() < 0.5 ? {key:r.pick(items).key} : null);
    const total = gross(items) - (res.ok ? res.discount : 0), exp = ref(id, items);
    if(total < 0 || (res.ok ? res.discount : null) !== exp) bad = {seed:12, n, id, items:items.map(i => ({menu:i.menu, sizeName:i.sizeName, tops:i.tops, qty:i.qty})), got:res.ok ? res.discount : null, exp, total};
  }
  eq('PR12 สุ่ม 2,000 ตะกร้า (seed 12): ยอดไม่ติดลบ ส่วนลดตรงกติกา', bad, null);
}
done();
