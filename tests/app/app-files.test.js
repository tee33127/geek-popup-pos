// เปิด app/index.html แบบแยกไฟล์จริง (โหลด css/js/img จากดิสก์) แล้วขาย 1 บิล → ต้องไม่มี error
// เสิร์ฟไฟล์ใน app/ ที่ http://localhost/ (jsdom ไม่มี localStorage ถ้าเปิดเป็น file://)
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const A = require('../auth-helper');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [];
JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w); w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s);
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  w.addEventListener('load', () => {
    A.signIn(w);
    eq('all scripts loaded & UI rendered', [$('[data-menu="greek"]') !== null, $('#nextNo').textContent], [true, 'ออเดอร์ #001']);
    eq('menu photo uses file path', $('[data-menu="acai"] img').getAttribute('src'), 'img/acai.jpg');
    $('[data-menu="greek"]').click(); $('[data-size="g1"]').click(); $('[data-pick="Banana"]').click(); $('[data-pick="Granola"]').click();
    eq('price via pricing.js', $('#btnAdd').textContent.includes('฿99'), true);
    $('[data-honey="normal"]').click(); $('#btnAdd').click(); eq('few toppings asks first', $('#fewOk').textContent, 'ลูกค้าขอแค่ 1 อย่าง'); $('#fewOk').click();
    $('#btnPay').click(); $('[data-dine="takeaway"]').click(); $('[data-method="cash"]').click(); $('[data-q="100"]').click(); $('#payOk').click();
    setTimeout(() => {
      const s = JSON.parse(w.localStorage.getItem('geek_popup_sales_v2'))[0];
      eq('sale saved', [s.no, s.total, s.change, s.dining], [1, 99, 1, 'takeaway']);
      eq('print slips rendered', $('#printArea').querySelectorAll('.slip').length, 2);
      $('#nextOrder').click(); eq('next order number', $('#nextNo').textContent, 'ออเดอร์ #002');
      eq('no runtime errors', errors, []);
      console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
    }, 200);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
