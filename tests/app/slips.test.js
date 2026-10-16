// ตั๋ว (js/slips.js + renderSlip/wrapText ใน printer.js) ใน vm เปล่า ไม่มี DOM · canvas จำลองบันทึกสิ่งที่วาด
// B1 ไม่รับแยกกลุ่ม · B2 ตัดบรรทัด · B3 ราคาต่อชิ้น · B4 ท้ายใบ · B5 บรรทัดทดสอบสระ · B7 หมายเหตุอยู่ถูกแก้ว · B8 ไม่มีพื้นดำ · B10 คอลัมน์ตรง · รอฟอนต์
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };

const warns = [];
const ctx = vm.createContext({console:{log(){}, warn: (...a) => warns.push(a.join(' '))}, Intl, setTimeout});
['config.js', 'core.js', 'printer.js', 'slips.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8'), ctx, {filename:f}));
const ev = c => vm.runInContext(c, ctx);

/* canvas จำลอง: กว้างตัวละ 12 จุด (ตัวหนา 13) · บันทึก fillText / fillRect ตามสีขณะวาด */
function fakeCanvas(){
  const c = {width:0, height:0, texts:[], rects:[]};
  const g = {font:'', fillStyle:'', textAlign:'', textBaseline:'',
    measureText(s){ return {width:[...String(s)].length * (/^700/.test(g.font) ? 13 : 12)}; },
    fillText(t, x, y){ c.texts.push({t, x, y, font:g.font, align:g.textAlign}); },
    fillRect(x, y, w, h){ c.rects.push({x, y, w, h, color:g.fillStyle}); }};
  c.getContext = () => g;
  return c;
}
ctx.fakeCanvas = fakeCanvas;
const render = (blocksExpr, dots = 576) => ev(`(() => { const c = fakeCanvas(); renderSlip(${blocksExpr}, ${dots}, c); return c; })()`);

/* บิลตัวอย่าง: Acai ×2 เปลี่ยน + ไม่รับ 2 อย่าง + เพิ่ม · Greek มีหมายเหตุ · Banana ไม่มีหมายเหตุ · Greek มีหมายเหตุ */
const acaiTops = [{name:'Mango', n:1, extra:0, from:'Banana'}, {name:'Strawberries', n:1, extra:0, from:null, removed:true}, {name:'Blueberries', n:1, extra:0, from:null},
  {name:'Granola', n:1, extra:0, from:null, removed:true}, {name:'Flaxseeds', n:1, extra:0, from:null}, {name:'Chia', n:1, extra:15, from:null, add:true}];
const sale = {no:7, ts:'2026-10-15T05:00:00.000Z', dining:'dinein', method:'cash', total:770, received:1000, change:230, staff:'ทดสอบ', items:[
  {menu:'greek', name:'Greek Yogurt', sizeName:'2 สกู๊ป', tops:[{name:'Banana', n:3, extra:0}, {name:'Mango', n:1, extra:15}], honey:'normal', note:'แพ้ถั่ว', unit:144, qty:1},
  {menu:'acai', name:'Acai', sizeName:'', tops:acaiTops, honey:'none', note:'', unit:204, qty:2},
  {menu:'banana', name:'Banana Choco', sizeName:'', tops:[], unit:149, qty:1},
  {menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Kiwi', n:1, extra:0}], honey:'side', note:'ขอช้อน 2 อัน', unit:89, qty:1}]};
ctx.sale = sale;
const rLines = ev('slipLines(receiptBlocks(sale))'), kLines = ev('slipLines(kitchenBlocks(sale))');

// ---------- B1 "ไม่รับ" แยกกลุ่ม ----------
const acaiR = rLines.slice(rLines.findIndex(l => l.startsWith('Acai')), rLines.findIndex(l => l.startsWith('Banana Choco')));
eq('B1 Acai receipt: changed → added → not wanted, each own line, honey after', acaiR.slice(1), ['เปลี่ยน: มะม่วง แทน กล้วย', 'เพิ่ม: เมล็ดเจีย · +15', 'ไม่รับ: สตรอว์เบอร์รี่, กราโนล่า', 'น้ำผึ้ง: ไม่รับ']);
eq('B1 "ไม่รับ" never shares a line with another topping group', rLines.filter(l => /ไม่รับ/.test(l) && !/^(ไม่รับ:|น้ำผึ้ง: ไม่รับ$)/.test(l)), []);
eq('B1 Greek receipt: toppings group (all picks)', rLines.includes('ท็อปปิ้ง: กล้วย ×3, มะม่วง · +15'), true);

// ---------- B11 ค่าเพิ่มบอกจำนวนชิ้นที่คิดเงิน (Tee 2026-10-16) · ราคาจาก priceItem ยอดไม่เปลี่ยน ----------
{
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/pricing.js'), 'utf8'), ctx, {filename:'pricing.js'});
  const cup = (menu, st) => ev(`(() => { const P = priceItem(MENU[${JSON.stringify(menu)}], ${JSON.stringify({picks:[], comps:[], adds:[], sep:false, ...st})}); return {menu:${JSON.stringify(menu)}, tops:P.tops, unit:P.unit}; })()`);
  const grp = i => { ctx.__i = i; return ev('topGroups(__i)').map(([t, l]) => t + ' ' + l.join(', ')); };
  const g89 = cup('greek', {size:'g1', picks:['Banana', 'Mango', 'Kiwi', 'Banana']});
  eq('B11 Greek 89 กล้วย ×2 (ชิ้นที่ 4 เกินโควตา) → "กล้วย ×2 · เพิ่ม 1 ชิ้น +15" · ยอด 104', [grp(g89), g89.unit], [['ท็อปปิ้ง: กล้วย ×2 · เพิ่ม 1 ชิ้น +15, มะม่วง, กีวี'], 104]);
  const g89b = cup('greek', {size:'g1', picks:['Banana', 'Banana', 'Banana', 'Banana', 'Banana']});
  eq('B11 Greek 89 กล้วย ×5 → "เพิ่ม 2 ชิ้น +30" · ยอด 119', [grp(g89b), g89b.unit], [['ท็อปปิ้ง: กล้วย ×5 · เพิ่ม 2 ชิ้น +30'], 119]);
  const g69 = cup('greek', {size:'g1n', picks:['Banana', 'Banana', 'Granola']});
  eq('B11 Greek 69 ทุกชิ้นคิดเงิน → "กล้วย ×2 · +30" / "กราโนล่า · +15" · ยอด 114', [grp(g69), g69.unit], [['ท็อปปิ้ง: กล้วย ×2 · +30, กราโนล่า · +15'], 114]);
  const gx = cup('greek', {size:'g2', picks:['Granola', 'Granola', 'Banana', 'Banana']});
  eq('B11 Extra ×2 คิดทุกชิ้น → "กราโนล่า ×2 · +20" · ฟรีทั้งหมด → "กล้วย ×2" · ยอด 149', [grp(gx), gx.unit], [['ท็อปปิ้ง: กราโนล่า ×2 · +20, กล้วย ×2'], 149]);
  const ac = cup('acai', {comps:['Strawberries', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'], adds:['Mango', 'Mango']});
  eq('B11 Acai เพิ่ม ×2 → "มะม่วง ×2 · +30" · เปลี่ยนคงรูปเดิม "(+15)" · ยอด 234', [grp(ac), ac.unit], [['เปลี่ยน: สตรอว์เบอร์รี่ แทน กล้วย (+15)', 'เพิ่ม: มะม่วง ×2 · +30'], 234]);
  const old = {menu:'greek', tops:[{name:'Banana', n:2, extra:15}, {name:'Granola', n:2, extra:20}]};   // บิลเก่าที่ไม่มี each
  eq('B11 บิลเก่าไม่มี each: ยังบอกจำนวนชิ้นได้', grp(old), ['ท็อปปิ้ง: กล้วย ×2 · เพิ่ม 1 ชิ้น +15, กราโนล่า ×2 · +20']);
  ctx.__s = {...sale, items:[{...g89, name:'Greek Yogurt', sizeName:'1 สกู๊ป', honey:'normal', note:'', qty:1}], total:104};
  eq('B11 ใบเสร็จพิมพ์รูปแบบเดียวกัน และยอดรวมไม่เปลี่ยน', [ev('slipLines(receiptBlocks(__s))').filter(l => l.startsWith('ท็อปปิ้ง:') || l.startsWith('รวม'))], [['ท็อปปิ้ง: กล้วย ×2 · เพิ่ม 1 ชิ้น +15, มะม่วง, กีวี', 'รวม ฿104']]);
  ctx.__w = {...ctx.__s, items:[{...ctx.__s.items[0], tops:[{name:'Banana', n:3, extra:15, each:15}, {name:'Hazelnut spread', n:2, extra:30, each:15}, {name:'Original peanut butter', n:2, extra:30, each:15}]}]};
  const wr = render('receiptBlocks(__w)', 384).texts.map(t => t.t);
  eq('B11 ตัดบรรทัด (58 มม.): "· เพิ่ม 1 ชิ้น" ไม่ขึ้นต้นบรรทัดด้วย · หรือ +', wr.filter(t => /^[·+]/.test(t.trim())), []);
}
const groups = ev(`receiptBlocks(sale).filter(b => b.tag).map(b => b.tag)`);
eq('B1 every receipt topping line is labelled (tag ends with :)', groups.every(t => t.endsWith(':')), true);

// ---------- B2 ตัดบรรทัด ----------
ev('var __g = fakeCanvas().getContext(); __g.font = "400 25px x";');
const PUNCT = /^[\s,.:;!?%)\]}×·–-]/;
const list = ['สตรอว์เบอร์รี่', 'บลูเบอร์รี่', 'กราโนล่า', 'เมล็ดแฟลกซ์', 'เม็ดมะม่วงหิมพานต์', 'ช็อกโกแลตครัมเบิล'];
ctx.list = list;
let badList = [];
/* ความกว้างจริงของคอลัมน์ท็อปปิ้งบนใบเสร็จ ≈ 400 จุด · ทดสอบ 230–560 (ชื่อยาวสุด 18 ตัว = 216 จุด ใส่บรรทัดได้เสมอ) */
for(let w = 230; w <= 560; w += 10){
  const lines = ev(`wrapText(__g, list, ${w})`);
  if(lines.some(l => PUNCT.test(l))) badList.push({w, lines});
  if(!list.every(p => lines.some(l => l.includes(p)))) badList.push({w, split:lines});
  if(lines.join(' ').replace(/\s+/g, ' ') !== list.join(', ')) badList.push({w, lost:lines});
}
eq('B2 list wrap at every width 230–560: no line starts with "," or space, no topping name split, nothing lost', badList.slice(0, 2), []);
const legacy = 'Mango (แทน Banana), ไม่รับ Strawberries, Blueberries, Granola, Flaxseeds, กล้วย ×3, มะม่วง (+15)';
let badText = [];
for(let w = 180; w <= 560; w += 6){ const lines = ev(`wrapText(__g, ${JSON.stringify(legacy)}, ${w})`); lines.forEach(l => { if(PUNCT.test(l)) badText.push({w, l}); }); }
eq('B2 free text wrap: no line starts with , ) × or space at any width', badText.slice(0, 3), []);
const thai = 'สตรอว์เบอร์รี่บลูเบอร์รี่กราโนล่าเมล็ดแฟลกซ์มะม่วงไม่เอาถ้วยใหญ่';
const bounds = new Set([0, ...[...new Intl.Segmenter('th', {granularity:'word'}).segment(thai)].map(s => s.index + s.segment.length)]);
let badThai = [];
const segs = [...new Intl.Segmenter('th', {granularity:'word'}).segment(thai)];
for(let w = 60; w <= 400; w += 7){
  const lines = ev(`wrapText(__g, ${JSON.stringify(thai)}, ${w})`); let at = 0;
  lines.slice(0, -1).forEach(l => { at += l.length; if(bounds.has(at)) return;
    const word = segs.find(s => s.index < at && at < s.index + s.segment.length);   // ตัดกลางคำได้เฉพาะคำที่ยาวกว่าบรรทัด
    if(!word || [...word.segment].length * 12 <= w) badThai.push({w, at, l}); });
}
eq('B2 Thai text breaks only at Intl.Segmenter word boundaries (unless the word is wider than the line)', badThai.slice(0, 3), []);

// ---------- B3 ราคาต่อชิ้น ----------
const rows = ev(`receiptBlocks(sale).filter(b => 'left' in b && /Acai|Banana Choco/.test(b.left)).map(b => [b.left, b.mid || '', b.right])`);
eq('B3 qty > 1 shows unit × qty and line total · qty 1 has no unit column', rows, [['Acai ×2', '204 × 2', '408'], ['Banana Choco', '', '149']]);
const rc = render('receiptBlocks(sale)');
const acaiRow = rc.texts.filter(t => t.t === 'Acai ×2' || t.t === '204 × 2' || t.t === '408');
eq('B3 drawn on one line: name left, unit price right-aligned before total', [new Set(acaiRow.map(t => t.y)).size, acaiRow.map(t => t.align)], [1, ['left', 'right', 'right']]);

// ---------- B4 ท้ายใบ ----------
const lastY = c => Math.max(...c.texts.map(t => t.y));
const kc = render('kitchenBlocks(sale)');
eq('B4 ≥ 30 dots (≈ 4 mm) blank after last line before cut (receipt + kitchen)', [rc.height - lastY(rc) - 26 * 0.53 >= 30, kc.height - lastY(kc) - 28 * 0.53 >= 30], [true, true]);
eq('slips never wider than 576 dots', [rc.width, kc.width], [576, 576]);

// ---------- B5 บรรทัดทดสอบสระ ----------
const appSrc = fs.readdirSync(path.join(ROOT, 'app/js'), {recursive:true}).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8')).join('\n');
eq('B5 "ทดสอบสระ" only on printer-test page', [appSrc.includes('ทดสอบสระ'), rLines.concat(kLines).some(l => l.includes('ทดสอบสระ')), fs.readFileSync(path.join(ROOT, 'printer-test/index.html'), 'utf8').includes('ทดสอบสระ')], [false, false, true]);

// ---------- B7 หมายเหตุอยู่ถูกแก้ว ----------
const kb = ev('kitchenBlocks(sale)');
const cupAt = kb.map((b, i) => /^\d+ × /.test(b.text || '') ? i : -1).filter(i => i >= 0);
const noteCup = kb.map((b, i) => 'note' in b ? [b.note, cupAt.filter(c => c < i).length - 1] : null).filter(Boolean);
eq('B7 each note sits under its own cup (cup 1 + cup 4), none on cups 2-3', noteCup, [['แพ้ถั่ว', 0], ['ขอช้อน 2 อัน', 3]]);
eq('B7 note block is the last line of its cup (before next divider)', kb[cupAt[1] - 2] && 'note' in kb[cupAt[1] - 2] && kb[cupAt[1] - 1].rule, 'dash');
const noteText = kc.texts.find(t => t.t === 'แพ้ถั่ว'), itemText = kc.texts.find(t => t.t === 'กล้วย ×3');
eq('B7 note drawn bold and larger than item lines, with "หมายเหตุ" label', [/^700 34px/.test(noteText.font), /^700|^400/.test(itemText.font) && parseInt(itemText.font.split(' ')[1]) < 34, kc.texts.some(t => t.t === 'หมายเหตุ')], [true, true, true]);
const noteFrame = kc.rects.filter(r => r.color === '#000' && r.w >= 500 && r.h === 5);
eq('B7 note has thick (5 dot) frame: top + bottom per note', noteFrame.length, 4);

// ---------- B8 กินเลย / กลับบ้าน ----------
const big = c => c.rects.filter(r => r.color === '#000' && r.w > 12 && r.h > 12);
eq('B8 no solid black area anywhere (dine-in, take-away, receipt)', [big(kc).length, big(render(`kitchenBlocks({...sale, dining:'takeaway'})`)).length, big(rc).length], [0, 0, 0]);
const tk = ev(`kitchenBlocks({...sale, dining:'takeaway'})`)[1], dk = kb[1];
eq('B8 dine-in = single thick frame · take-away = double frame + lead text', [[dk.box, dk.text, dk.lead], [tk.box, tk.text, !!tk.lead]], [['single', 'กินเลย', ''], ['double', 'กลับบ้าน', true]]);
const frames = c => c.rects.filter(r => r.color === '#000' && r.w >= 540 && (r.h === 4 || r.h === 2)).length;   // กรอบป้าย (เส้นคั่นหนา 3 · กรอบหมายเหตุ 5)
eq('B8 take-away draws twice the frame lines of dine-in', [frames(kc), frames(render(`kitchenBlocks({...sale, dining:'takeaway'})`))], [2, 4]);

// ---------- B9 คงเดิม ----------
eq('B9 order number still big, changed/removed lines bold', [kb[0].size >= 100, kb.filter(b => b.tag && /เปลี่ยนจาก|ไม่รับ|เพิ่ม/.test(b.text)).every(b => b.bold)], [true, true]);

// ---------- B10 คอลัมน์ตรงกัน ----------
const tagged = kb.filter(b => b.tag);
eq('B10 every kitchen line uses the same indent + text column', [...new Set(tagged.map(b => b.indent + '/' + b.col))].length, 1);
const textX = kc.texts.filter(t => tagged.some(b => b.text === t.t)).map(t => [/^700/.test(t.font), t.x]);
eq('B10 bold and regular lines start at the same x', [...new Set(textX.map(x => x[1]))].length === 1 && textX.some(x => x[0]) && textX.some(x => !x[0]), true);
const honeyX = kc.texts.find(t => t.t.startsWith('น้ำผึ้ง')).x;
eq('B10 honey / notes-to-staff lines align with topping text', honeyX, textX[0][1]);

// ---------- HTML (window.print) = USB ----------
eq('HTML fallback has same lines as USB slip', ev(`slipHtml(kitchenBlocks(sale))`).includes('class="note"') && ev(`slipHtml(receiptBlocks(sale))`).includes('204 × 2'), true);

// ---------- รอฟอนต์ก่อนวาด ----------
(async () => {
  ev('var document = {fonts:{load: () => new Promise(() => {}), check: () => false}}');   // ฟอนต์ไม่มาเลย
  const t = Date.now(), ok = await ev('slipFontsReady(80)');
  eq('fonts never load → gives up after timeout, prints with fallback + warning', [ok, Date.now() - t >= 70, warns.some(w => w.includes('ฟอนต์ตั๋วยังไม่พร้อม'))], [false, true, true]);
  ev(`var __loaded = []; document = {fonts:{load: s => { __loaded.push(s); return Promise.resolve([]); }, check: () => true}}`);
  eq('fonts load → ready, asks every weight used on slips', [await ev('slipFontsReady(80)'), ev('__loaded')], [true, ['400 26px "IBM Plex Sans Thai Looped"', '700 26px "IBM Plex Sans Thai Looped"']]);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
