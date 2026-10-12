const {JSDOM} = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'../../prototype/pos.html'),'utf8');
let errors = [];
const dom = new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing '+s); el.click(); };
const ev = c => w.eval(c);
let fails = 0; const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`); };
const today = ev('bizDate(new Date())'), yday = ev(`addDays('${ev('bizDate(new Date())')}', -1)`);
const T = (h, m) => { const x = new Date(); x.setHours(h, m, 0, 0); return x.toISOString(); };
const mk = (id, no, date, dining, method, items, total, extra={}) => ({id, no, date, ts:T(12, no), dining, method, items, total, received:total, change:0, void:false, ...extra});
const greek = {menu:'greek', name:'Greek Yogurt', sizeName:'2 สกู๊ป', tops:[{name:'Banana',n:3,extra:0,from:null},{name:'Mango',n:1,extra:15,from:null},{name:'Granola',n:1,extra:10,from:null}], honey:'normal', note:'', unit:154, qty:1};
const acai = {menu:'acai', name:'Acai', sizeName:'', tops:[{name:'Mango',n:1,extra:0,from:'Banana'},{name:'Strawberries',n:1,extra:0,from:null,removed:true},{name:'Blueberries',n:1,extra:0,from:null},{name:'Granola',n:1,extra:0,from:null},{name:'Flaxseeds',n:1,extra:0,from:null}], honey:'none', note:'', unit:189, qty:2};
const bch = {menu:'banana', name:'Banana Choco', sizeName:'', tops:['Banana','Cacao peanut butter','Cashew','Chocolate Chips'].map(n => ({name:n,n:1,extra:0,from:null})), note:'', unit:149, qty:1};   // Banana Choco ไม่มี honey
const bchOld = {...bch, honey:'little'};   // บิลเก่าก่อน 2026-10-12 ที่ยังมี honey
const sales = [
  mk(1, 1, today, 'dinein', 'cash', [greek], 154),
  mk(2, 2, today, 'takeaway', 'promptpay', [acai], 378),
  mk(3, 3, today, 'dinein', 'tcp', [bch], 149),
  mk(4, 4, today, 'dinein', 'cash', [greek], 154, {void:true}),            // ยกเลิก: ต้องไม่นับ
  mk(5, 1, yday, 'dinein', 'cash', [{...bch, qty:2}], 298),                // เมื่อวาน
];
ev(`saveSales(${JSON.stringify(sales)})`);
const open = () => { click('#btnSummary'); $('#pinIn').value = '1234'; click('#pinOk'); };
const rowsOf = () => $$('#modal table tr').map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g,' ').trim()));
const stat = () => $$('.stat b').map(e => e.textContent);

open();
eq('KPI today (void excluded)', stat(), ['฿681','3','4','฿227']);
eq('void note', $('#modal').textContent.includes('ไม่นับบิลที่ยกเลิก 1 บิล'), true);

// 1) สินค้า
let r = rowsOf().map(x => x.slice(0,3));
eq('items by menu', r.slice(1,5), [['Greek Yogurt','1','฿154'],['Acai','2','฿378'],['Banana Choco','1','฿149'],['รวม','4','฿681']]);
eq('items by size row', r.some(x => x[0] === 'Greek Yogurt · 2 สกู๊ป'), true);

// 2) ชำระเงิน
click('[data-tab="pay"]'); r = rowsOf().map(x => x.slice(0,4));
eq('payment methods', r.slice(1), [['เงินสด','1','฿154','฿154'],['PromptPay','1','฿378','฿378'],['ไทยช่วยไทย พลัส','1','฿149','฿149'],['รวม','3','฿681','฿227']]);
eq('cash drawer note', $('#modal').textContent.includes('฿154'), true);

// 3) ตัวเลือก
click('[data-tab="opts"]'); const txt = $('#modal').textContent; r = rowsOf().map(x => x.slice(0,3));
const has = (a, b, c) => r.some(x => x[0] === a && x[1] === b && (c === undefined || x[2] === c));
eq('size option', has('2 สกู๊ป','1','฿154'), true);
eq('honey normal', has('ราดปกติ','1','฿154'), true);
eq('honey none', has('ไม่รับ','2','฿378'), true);
eq('Banana Choco not in honey group', has('ราดนิดหน่อย','1','฿149'), false);
eq('honey rows only Greek + Acai', r.filter(x => ['ราดปกติ','ไม่รับ','ราดนิดหน่อย','ราดเยอะ','แยก'].includes(x[0])).reduce((a, x) => a + Number(x[1]), 0), 3);
eq('dining dinein', has('กินเลย','2','฿303'), true);
eq('dining takeaway', has('กลับบ้าน','1','฿378'), true);
eq('extra Granola', has('กราโนล่า','1','฿10'), true);
eq('over-quota Mango', has('มะม่วง (เกิน 3 ชิ้น)','1','฿15'), true);
eq('adjust removed', has('Acai: ไม่รับ สตรอว์เบอร์รี่','2','–'), true);
eq('adjust swapped', has('Acai: เปลี่ยน กล้วย → มะม่วง','2','–'), true);
eq('group separation note', txt.includes('ไม่ควรนำยอดขายระหว่างกลุ่มมารวมกัน'), true);

// 4) วัตถุดิบ
click('[data-tab="ingr"]'); r = rowsOf().map(x => x.slice(0,2));
const ing = n => (r.find(x => x[0] === n) || [])[1];
eq('Greek scoops', ing('Greek Yogurt (สกู๊ป)'), '2');
eq('Acai base', ing('Acai base (ถ้วย)'), '2'); eq('Banana Choco base', ing('Banana Choco base (ถ้วย)'), '1');
eq('Banana (3 + 1)', ing('กล้วย'), '4'); eq('Mango (1 + 2 swapped)', ing('มะม่วง'), '3');
eq('Granola (1 + 2)', ing('กราโนล่า'), '3'); eq('Blueberries', ing('บลูเบอร์รี่'), '2'); eq('Flaxseeds', ing('เมล็ดแฟลกซ์'), '2');
eq('removed Strawberries not counted', ing('สตรอว์เบอร์รี่'), undefined);
eq('Cashew / Choc chips / Cacao PB', [ing('เม็ดมะม่วงหิมพานต์'), ing('ช็อกโกแลตชิพ'), ing('เนยถั่วคาเคา')], ['1','1','1']);
eq('honey servings (none excluded)', [ing('น้ำผึ้ง · ราดปกติ'), ing('น้ำผึ้ง · ราดนิดหน่อย'), ing('น้ำผึ้ง · ไม่รับ')], ['1',undefined,undefined]);
const bchSale = {no:9, dining:'dinein', ts:new Date().toISOString(), method:'cash', total:149, received:149, change:0, items:[bch]};
eq('kitchen ticket (print + USB): Banana no honey line', [ev(`kitchenHtml(${JSON.stringify(bchSale)})`).includes('น้ำผึ้ง'), ev(`kitchenBlocks(${JSON.stringify(bchSale)})`).some(b => String(b.text).includes('น้ำผึ้ง'))], [false, false]);
const acaiSale = {...bchSale, total:378, items:[acai]};
const kTxt = sale => ev(`kitchenBlocks(${JSON.stringify(sale)})`).map(b => b.text || '').join('\n');
const rTxt = sale => ev(`receiptBlocks(${JSON.stringify(sale)})`).map(b => b.text || '').join('\n');
eq('print Acai: only changed slots (kitchen USB)', [kTxt(acaiSale).includes('มะม่วง (เปลี่ยนจาก กล้วย)'), kTxt(acaiSale).includes('ไม่รับ สตรอว์เบอร์รี่'), kTxt(acaiSale).includes('บลูเบอร์รี่'), kTxt(acaiSale).includes('กราโนล่า')], [true, true, false, false]);
eq('print Acai: only changed slots (kitchen HTML)', [ev(`kitchenHtml(${JSON.stringify(acaiSale)})`).includes('เปลี่ยนจาก'), ev(`kitchenHtml(${JSON.stringify(acaiSale)})`).includes('บลูเบอร์รี่')], [true, false]);
eq('print Acai: receipt only changed slots', [rTxt(acaiSale).includes('มะม่วง (แทน กล้วย), ไม่รับ สตรอว์เบอร์รี่'), rTxt(acaiSale).includes('เมล็ดแฟลกซ์')], [true, false]);
eq('print Banana unchanged: no ingredient lines', [kTxt(bchSale).includes('กล้วย'), rTxt(bchSale).includes('กล้วย'), ev(`receiptHtml(${JSON.stringify(bchSale)})`).includes('เนยถั่วคาเคา')], [false, false, false]);
eq('print Greek: all toppings', kTxt({...bchSale, items:[greek]}).includes('กล้วย ×3'), true);
eq('screen/CSV lines still full', ev(`itemLines(${JSON.stringify(acai)})`)[0].includes('บลูเบอร์รี่'), true);
eq('item lines: new Banana no honey, old Banana bill keeps honey', [ev(`itemLines(${JSON.stringify(bch)})`).some(l => l.startsWith('น้ำผึ้ง')), ev(`itemLines(${JSON.stringify(bchOld)})`).includes('น้ำผึ้ง: ราดนิดหน่อย')], [false, true]);

// ช่วงวันที่
click('[data-range="yday"]'); eq('yesterday KPI', stat(), ['฿298','1','2','฿298']);
click('[data-tab="ingr"]'); r = rowsOf().map(x => x.slice(0,2)); eq('yesterday Banana Choco base x2', (r.find(x => x[0] === 'Banana Choco base (ถ้วย)')||[])[1], '2');
click('[data-range="all"]'); eq('all KPI', stat(), ['฿979','4','6','฿245']);
click('[data-range="7d"]'); eq('7d KPI', stat(), ['฿979','4','6','฿245']);
$('#repFrom').value = today; $('#repFrom').dispatchEvent(new w.Event('change')); $('#repTo').value = today; $('#repTo').dispatchEvent(new w.Event('change'));
eq('manual date range', stat(), ['฿681','3','4','฿227']);
// แท็บบิล + CSV
click('[data-tab="bills"]'); eq('bills tab lists 4 incl void', $$('#modal table tr').length, 5);
eq('csv buttons', [$('#csvTab') !== null, $('#csvAll') !== null], [true, true]);
let saved = null; w.URL.createObjectURL = b => { saved = b; return 'blob:x'; }; 
click('[data-tab="ingr"]'); click('#csvTab'); click('#csvBack'); eq('ingredient csv rows', ev('repCsv.rows.length > 5 && repCsv.rows[0].join()'), 'หมวด,วัตถุดิบ,จำนวน');
// empty range
$('#repFrom').value = '2001-01-01'; $('#repFrom').dispatchEvent(new w.Event('change')); $('#repTo').value = '2001-01-02'; $('#repTo').dispatchEvent(new w.Event('change'));
eq('empty range shows message', [$('#modal').textContent.includes('ยังไม่มีข้อมูลในช่วงนี้'), stat()], [true, ['฿0','0','0','–']]);
// แยกท็อปปิ้ง: รายงานกลุ่ม "แยกท็อปปิ้ง" นับแก้ว + เงินค่าแยก · ตั๋วครัว/ใบเสร็จมีบรรทัดแยก (ใช้วันห่างไกลไม่ให้กระทบตัวเลขข้างบน)
const sepAcai = {...acai, unit:194, sep:5, qty:2};
ev(`saveSales(loadSales().concat([${JSON.stringify(mk(90, 1, '2030-01-01', 'dinein', 'cash', [sepAcai, bch], 537))}]))`);
eq('report: separate-topping group', ev(`JSON.stringify(buildReport('2030-01-01', '2030-01-01').groups['แยกท็อปปิ้ง'])`), JSON.stringify({unit:'แก้ว', rows:{'Acai':{qty:2, rev:10}}}));
const sepSale = {...bchSale, items:[sepAcai]};
eq('kitchen ticket shows separate line (HTML + USB)', [ev(`kitchenHtml(${JSON.stringify(sepSale)})`).includes('แยกท็อปปิ้ง ใส่ถ้วยแยก'), kTxt(sepSale).includes('แยกท็อปปิ้ง ใส่ถ้วยแยก')], [true, true]);
eq('receipt shows separate charge', rTxt(sepSale).includes('แยกท็อปปิ้ง (+5)'), true);
eq('no separate line when not chosen', kTxt(bchSale).includes('แยกท็อปปิ้ง'), false);
eq('no runtime errors', errors, []);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
