// โปรโมชัน (promoEval) + เพิ่มท็อปปิ้ง Acai/Banana Choco: โหลด config + core + pricing + promo เข้า vm เปล่า
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = vm.createContext({});
for(const f of ['config.js', 'core.js', 'pricing.js', 'promo.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js', f), 'utf8'), ctx, {filename:f});
const ev = c => vm.runInContext(c, ctx);
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
let seq = 0;
/* รายการแบบเดียวกับในตะกร้า */
const item = (menu, st = {}, qty = 1) => {
  const m = ev(`MENU[${JSON.stringify(menu)}]`), full = {size:'g1', picks:[], comps:m.defaults ? [...m.defaults] : [], ...st};
  const P = ev(`priceItem(MENU[${JSON.stringify(menu)}], ${JSON.stringify(full)})`);
  return {menu, name:m.name, sizeName:P.sizeName, tops:P.tops, unit:P.unit, qty, key:'k' + (++seq), ...(P.sep && {sep:P.sep})};
};
const run = (id, items, want) => { ctx.items = items; ctx.want = want || null; return ev(`promoEval(PROMO[${JSON.stringify(id)}], items, want)`); };
const A = () => item('acai'), B = () => item('banana'), G = st => item('greek', st);

// เพิ่มท็อปปิ้ง Acai / Banana Choco ชิ้นละ 15 ทุกอย่าง
const add = item('acai', {adds:['Mango', 'Mango', 'Granola']});
eq('acai + Mango ×2 + Granola = 189 + 45', add.unit, 234);
eq('add-on entries', add.tops.filter(t => t.add), [{name:'Mango', n:2, extra:30, from:null, add:true, each:15}, {name:'Granola', n:1, extra:15, from:null, add:true, each:15}]);
eq('banana + Kiwi = 164', item('banana', {adds:['Kiwi']}).unit, 164);
eq('add-on label', ev(`topLabel(${JSON.stringify(add.tops.find(t => t.add))})`), 'เพิ่ม มะม่วง ×2 (+30)');
eq('print shows add-ons only for preset menus', ev(`printTops(${JSON.stringify(add)}).map(t => t.name)`), ['Mango', 'Granola']);

// 1 แถม 1: แก้วที่ราคาเมนูถูกที่สุดฟรี 1 แก้วต่อบิล
eq('A + B → Banana free 149', [run('b1g1', [A(), B()]).discount, run('b1g1', [A(), B()]).detail], [149, 'Banana Choco ฟรี 1 แก้ว']);
eq('B + B → 149', run('b1g1', [B(), B()]).discount, 149);
eq('A + A → 189', run('b1g1', [A(), A()]).discount, 189);
eq('one line qty 2 counts', run('b1g1', [item('acai', {}, 2)]).discount, 189);
eq('A ×2 + B → still 149 (cheapest)', run('b1g1', [item('acai', {}, 2), B()]).discount, 149);
eq('A ×2 + B ×2 → only one free cup per bill', run('b1g1', [item('acai', {}, 2), item('banana', {}, 2)]).discount, 149);
eq('free cup extras still charged (discount = menu price only)', run('b1g1', [A(), item('banana', {sep:true, adds:['Kiwi']})]).discount, 149);
eq('single cup → not ok', run('b1g1', [A()]), {ok:false, why:'ต้องมี Acai หรือ Banana Choco อย่างน้อย 2 แก้ว'});
eq('Greek does not count', run('b1g1', [A(), G({picks:['Banana','Mango','Kiwi']})]).ok, false);

// ลด 30 บาท 1 แก้ว · เลือกแก้วได้
const a1 = A(), b1 = B();
eq('off30 default first eligible', [run('off30', [G({picks:['Banana','Mango','Kiwi']}), a1, b1]).discount, run('off30', [a1, b1]).target.key], [30, a1.key]);
eq('off30 targets both cups', run('off30', [a1, b1]).targets.length, 2);
eq('off30 chosen target', run('off30', [a1, b1], {key:b1.key}).detail, 'Banana Choco 1 แก้ว');
eq('off30 missing target → first', run('off30', [a1], {key:'gone'}).target.key, a1.key);
eq('off30 Greek only → not ok', run('off30', [G({picks:['Banana','Mango','Kiwi']})]).ok, false);

// ฟรี 1 ท็อปปิ้ง: ชิ้นที่ต้องจ่าย ยกเว้น กราโนล่า บลูเบอร์รี่ สตรอว์เบอร์รี่
eq('Greek 4th free-group topping → 15', run('freetop', [G({picks:['Banana','Mango','Kiwi','Chia']})]).target, {key:'k' + seq, top:'Chia', label:'เมล็ดเจีย · Greek Yogurt · 1 สกู๊ป', discount:15});
eq('Greek within 3 free → not ok', run('freetop', [G({picks:['Banana','Mango','Kiwi']})]).ok, false);
eq('Greek extras excluded', run('freetop', [G({picks:['Banana','Mango','Kiwi','Granola','Blueberries','Strawberries']})]).ok, false);
eq('69 cup topping → 15', run('freetop', [G({size:'g1n', picks:['Banana']})]).discount, 15);
eq('69 cup Granola excluded', run('freetop', [G({size:'g1n', picks:['Granola']})]).ok, false);
eq('Acai add-on → 15, Granola add-on excluded', [run('freetop', [item('acai', {adds:['Mango']})]).discount, run('freetop', [item('acai', {adds:['Granola']})]).ok], [15, false]);
eq('Acai swap to Strawberries (+15) excluded', run('freetop', [item('acai', {comps:['Banana','Strawberries','Blueberries','Granola','Flaxseeds'].map((x, i) => i === 0 ? 'Strawberries' : x)})]).ok, false);
const two = [item('acai', {adds:['Mango']}), item('banana', {adds:['Kiwi']})];
eq('freetop choose target', run('freetop', two, {key:two[1].key, top:'Kiwi'}).detail, 'กีวี ฟรี 1 ชิ้น (Banana Choco)');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
