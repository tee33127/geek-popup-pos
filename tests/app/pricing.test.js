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
eq('menu price labels', ev('CONFIG.menus.map(menuPriceLabel)'), ['฿69–129', '฿189', '฿149']);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
