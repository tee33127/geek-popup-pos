const {JSDOM} = require('jsdom'); const fs = require('fs');
let errors = [], navigated = [];
const dom = new JSDOM(fs.readFileSync(require('path').join(__dirname,'../../prototype/pos.html'),'utf8'), {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing '+s); el.click(); };
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const stat = () => $$('.stat b').map(e => e.textContent);
(async () => {
  // สร้าง 2 บิล
  for(const m of ['acai','banana']){ click(`[data-menu="${m}"]`); click('#btnAdd'); click('#btnPay'); click('[data-dine="dinein"]'); click('[data-method="promptpay"]'); click('#payOk'); await wait(150); click('#nextOrder'); }
  click('#btnSummary'); $('#pinIn').value = '1234'; click('#pinOk');
  eq('start KPI', stat().slice(0,2), ['฿338','2']);
  click('[data-tab="bills"]');
  // ยกเลิกบิล #001 (acai)
  const acaiId = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0].id;
  click(`[data-v="${acaiId}"]`); eq('void dialog', $('#modal').textContent.includes('นำกลับมาได้ภายหลัง'), true); click('#cfYes');
  eq('after void KPI', stat().slice(0,2), ['฿149','1']);
  eq('restore button shown', $(`[data-restore="${acaiId}"]`) !== null, true);
  // กดนำกลับแล้วเปลี่ยนใจ
  click(`[data-restore="${acaiId}"]`); eq('restore dialog', $('#modal').textContent.includes('นำบิล #001 กลับมา?'), true);
  click('#cfNo'); eq('cancel restore keeps void', JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0].void, true);
  eq('back on bills tab', $('.tab.on').dataset.tab, 'bills');
  // นำกลับจริง
  click(`[data-restore="${acaiId}"]`); click('#cfYes');
  const s0 = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0];
  eq('restored', [s0.void, s0.voidAt, s0.log.map(l => l.act)], [false, undefined, ['void','restore']]);
  eq('KPI back to full', stat().slice(0,2), ['฿338','2']);
  eq('history visible', $('#modal').textContent.includes('ยกเลิก') && $('#modal').textContent.includes('นำกลับ'), true);
  eq('void button available again', $(`[data-v="${acaiId}"]`) !== null, true);
  // ---- CSV: ต้องไม่เปลี่ยนหน้า ----
  let blobs = 0; w.URL.createObjectURL = () => { blobs++; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
  const href0 = w.location.href;
  click('#csvTab'); eq('csv modal opens (no immediate nav)', [$('#csvDl') !== null, blobs], [true, 0]);
  eq('csv text shown with history column', $('#csvText').value.split('\r\n')[0].includes('ประวัติ') && $('#csvText').value.includes('นำกลับ'), true);
  let clicked = null; const orig = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function(){ clicked = {download:this.download, target:this.target, inDom:d.body.contains(this)}; };
  click('#csvDl'); eq('download anchor safe', clicked && [clicked.download.endsWith('.csv'), clicked.target, clicked.inDom], [true, '_blank', true]);
  w.HTMLAnchorElement.prototype.click = orig;
  eq('page not navigated', w.location.href, href0);
  let copied = null; Object.defineProperty(w.navigator, 'clipboard', {value:{writeText: async t => { copied = t; }}, configurable:true});
  click('#csvCopy'); await wait(20); eq('copy works', copied && copied.startsWith('"วันที่รอบขาย"'), true);
  click('#csvBack'); eq('back returns to summary bills tab', [$('#modal').textContent.includes('สรุปยอดขาย'), $('.tab.on').dataset.tab], [true, 'bills']);
  click('#csvAll'); eq('backup-all also via modal', $('#csvDl') !== null, true); click('#csvBack');
  click('[data-tab="ingr"]'); click('#csvTab'); eq('ingredient csv', $('#csvText').value.startsWith('"หมวด","วัตถุดิบ","จำนวน"'), true); click('#csvBack');
  eq('POS still alive (cart UI present)', $('#btnAdd') !== null && $('#builder') !== null, true);
  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
