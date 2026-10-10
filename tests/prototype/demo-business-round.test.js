// รันด้วยเวลาจำลอง: argv[2] = "YYYY,M,D,H,MI" , argv[3] = 'block' เพื่อจำลองเบราว์เซอร์ที่บล็อก localStorage
const [Y,Mo,Dd,H,Mi] = process.argv[2].split(',').map(Number); const block = process.argv[3] === 'block';
const RD = Date; const FIX = new RD(Y, Mo-1, Dd, H, Mi).getTime();
const {JSDOM} = require('jsdom'); const fs = require('fs');
let errors = [];
const dom = new JSDOM(fs.readFileSync(require('path').join(__dirname,'../../prototype/pos-demo.html'),'utf8'), {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){
    w.print = () => {}; w.addEventListener('error', e => errors.push(e.message));
    const WD = w.Date; w.Date = class extends WD { constructor(...a){ a.length ? super(...a) : super(FIX); } static now(){ return FIX; } };
    if(block) Object.defineProperty(w, 'localStorage', {get(){ throw new Error('SecurityError'); }});
  }});
const w = dom.window, d = w.document, $ = s => d.querySelector(s);
const kpi = () => [...d.querySelectorAll('.stat b')].map(e => e.textContent).join(' | ');
$('#btnSummary').click(); $('#pinIn').value = '1234'; $('#pinOk').click();
console.log(`[${process.argv[2]}${block ? ' blocked' : ''}]`, d.querySelector('.note2 b').textContent);
if($('#modal').textContent.includes('รอบปัจจุบันยังไม่มีบิล')) console.log('   (fallback note shown)');
console.log('   KPI:', kpi(), '· item rows:', d.querySelectorAll('#modal table tr').length);
for(const t of ['pay','opts','ingr','bills']){ $(`[data-tab="${t}"]`).click(); process.stdout.write(`   ${t}:${d.querySelectorAll('#modal table tr').length}`); } console.log();
$('[data-range="7d"]').click(); console.log('   7 วัน KPI:', kpi());
if(block) console.log('   banner:', !!d.body.firstElementChild.textContent.includes('ไม่ให้บันทึกข้อมูลถาวร'));
// ขายใหม่ 1 บิลแล้วเปิดสรุปอีกครั้ง → ต้องเห็นบิลนี้
$('#closeX').click(); $('[data-menu="acai"]').click(); $('#btnAdd').click(); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="promptpay"]').click(); $('#payOk').click();
setTimeout(() => {
  $('#nextOrder').click(); $('#btnSummary').click(); $('#pinIn').value = '1234'; $('#pinOk').click();
  console.log('   after new sale:', d.querySelector('.note2 b').textContent, '·', kpi());
  console.log('   errors:', errors.length ? errors : 'none');
}, 200);
