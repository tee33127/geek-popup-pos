// คิดราคาโดยไม่มีหน้าเว็บ: โหลด config + core + pricing เข้า vm เปล่า (ไม่มี window/document)
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = vm.createContext({});
for(const f of ['config.js', 'core.js', 'pricing.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js', f), 'utf8'), ctx, {filename:f});
const ev = c => vm.runInContext(c, ctx);
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const price = (menu, st) => ev(`priceItem(MENU[${JSON.stringify(menu)}], ${JSON.stringify(st)})`);
const greek = (size, picks) => price('greek', {size, picks, comps:[]});

eq('no DOM in context', ev('typeof document'), 'undefined');
eq('no menu → null', ev('priceItem(null, {})'), null);
eq('Greek 1 สกู๊ป ไม่มีท็อปปิ้ง', greek('g1n', ['Banana']).unit, 69);
eq('Greek g1n ignores picks', greek('g1n', ['Banana']).tops, []);
eq('Greek 1 สกู๊ป + 3 free', greek('g1', ['Banana', 'Banana', 'Banana']).unit, 89);
eq('Greek 4th free topping +15', greek('g1', ['Banana', 'Banana', 'Banana', 'Banana']).unit, 104);
eq('Greek extras do not use free quota', greek('g2', ['Granola', 'Mango', 'Kiwi', 'Chia']).unit, 129 + 10);
eq('Greek extras + over quota', greek('g2', ['Banana', 'Mango', 'Kiwi', 'Chia', 'Strawberries']).unit, 129 + 15 + 15);
eq('Greek grouped tops (ชิ้นที่ 4 ตามลำดับที่กด = Kiwi โดน +15)', greek('g1', ['Banana', 'Mango', 'Banana', 'Kiwi']).tops,
  [{name:'Banana', n:2, extra:0, from:null}, {name:'Mango', n:1, extra:0, from:null}, {name:'Kiwi', n:1, extra:15, from:null}]);
eq('Greek sizeName', [greek('g1n', []).sizeName, greek('g2', []).sizeName], ['1 สกู๊ป · ไม่มีท็อปปิ้ง', '2 สกู๊ป']);
const acai = price('acai', {comps:['Mango', null, 'Blueberries', 'Granola', 'Flaxseeds']});
eq('Acai fixed price', acai.unit, 189);
eq('Acai swap + removed', acai.tops.slice(0, 2), [{name:'Mango', n:1, extra:0, from:'Banana'}, {name:'Strawberries', n:1, extra:0, from:null, removed:true}]);
eq('Banana Choco fixed price', price('banana', {comps:['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips']}).unit, 149);
// เปลี่ยนท็อปปิ้ง Acai / Banana Choco: ของฟรี → Extra คิดตามราคา · Extra → อื่นๆ ฟรีและไม่ลดราคา
const bc = comps => price('banana', {comps});
eq('Banana Choco: กล้วย → สตรอว์เบอร์รี่ +15', [bc(['Strawberries', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips']).unit, bc(['Strawberries', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips']).tops[0]], [164, {name:'Strawberries', n:1, extra:15, from:'Banana'}]);
eq('Banana Choco: เม็ดมะม่วงฯ → กราโนล่า +10', bc(['Banana', 'Cacao peanut butter', 'Granola', 'Chocolate Chips']).unit, 159);
eq('Banana Choco: two paid swaps add up', bc(['Blueberries', 'Cacao peanut butter', 'Granola', 'Chocolate Chips']).unit, 174);
eq('Banana Choco: free → free swap stays 149', bc(['Mango', 'Caramel', 'Almonds', 'Chocolate Chips']).unit, 149);
const ac = comps => price('acai', {comps});
eq('Acai: กล้วย → Kiwi free', ac(['Kiwi', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds']).unit, 189);
eq('Acai: สตรอว์เบอร์รี่ → มะม่วง free, no discount', ac(['Banana', 'Mango', 'Blueberries', 'Granola', 'Flaxseeds']).unit, 189);
eq('Acai: Extra → Extra free (บลูเบอร์รี่ slot → สตรอว์เบอร์รี่ after strawberry slot changed)', ac(['Banana', 'Kiwi', 'Strawberries', 'Granola', 'Flaxseeds']).unit, 189);
eq('Acai: กราโนล่า → อัลมอนด์ free', ac(['Banana', 'Strawberries', 'Blueberries', 'Almonds', 'Flaxseeds']).unit, 189);
eq('Acai: เมล็ดแฟลกซ์ → Chia free', ac(['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Chia']).unit, 189);
eq('Acai: กล้วย → บลูเบอร์รี่ after blueberry slot changed = +15', ac(['Blueberries', 'Strawberries', 'Kiwi', 'Granola', 'Flaxseeds']).unit, 204);
eq('Acai: กล้วย → สตรอว์เบอร์รี่ (มีอยู่แล้ว) = 2 ส่วน +15', ac(['Strawberries', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds']).unit, 204);
eq('Acai: เมล็ดแฟลกซ์ → กราโนล่า (มีอยู่แล้ว) +10', ac(['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Granola']).unit, 199);
eq('Banana Choco: เม็ดมะม่วงฯ → ช็อกโกแลตชิพ (มีอยู่แล้ว) free', bc(['Banana', 'Cacao peanut butter', 'Chocolate Chips', 'Chocolate Chips']).unit, 149);
eq('removed Extra no discount', ac(['Banana', null, 'Blueberries', 'Granola', 'Flaxseeds']).unit, 189);
eq('menu price labels', ev('CONFIG.menus.map(menuPriceLabel)'), ['฿69–129', '฿189', '฿149']);
// ชื่อไทย: ทุกท็อปปิ้งและหมวดต้องมี ไม่ซ้ำกัน · รหัสที่ไม่รู้จัก (บิลเก่า) แสดงตามเดิม
eq('every topping has Thai name', ev('CONFIG.items.filter(i => !i.th).map(i => i.name)'), []);
eq('Thai names unique', ev('new Set(CONFIG.items.map(i => i.th)).size === CONFIG.items.length'), true);
eq('every category has Thai name', ev('CONFIG.cats.every(c => c.th)'), true);
eq('topName maps code → Thai', ev('topName("Banana")'), 'กล้วย');
eq('topName keeps unknown name', ev('topName("Old topping")'), 'Old topping');
eq('labels use Thai', ev('topLabel({name:"Mango", n:2, extra:15, from:null})'), 'มะม่วง ×2 (+15)');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
