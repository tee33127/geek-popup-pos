// ตั้งค่า (ปุ่มบนแถบหัว): สวิตช์ มี/หมด ของเมนูและท็อปปิ้ง · หน้าขายกดของหมดไม่ได้ · เก็บค่าไว้ตอนเปิดแอปใหม่
const {JSDOM} = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../../prototype/pos.html'), 'utf8');
let errors = [];
const open = stored => new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){ w.print = () => {}; w.addEventListener('error', e => errors.push(e.message)); if(stored) w.localStorage.setItem('geek_popup_settings', JSON.stringify(stored)); }}).window;
let w = open(), d = w.document;
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const click = s => { const el = typeof s === 'string' ? $(s) : s; if(!el) throw new Error('missing ' + s); el.click(); };
const ev = c => w.eval(c), wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
const openSet = () => { click('#btnSettings'); $('#pinIn').value = '1234'; click('#pinOk'); };
const sw = (kind, key) => $(`[data-stock="${kind}"][data-key="${key}"]`);
const row = (kind, key) => sw(kind, key).closest('.srow');
const stored = () => JSON.parse(w.localStorage.getItem('geek_popup_settings') || '{}').out;

(async () => {
  await wait(50);
  eq('settings button in header, not in summary', [$('#btnSettings').textContent.trim(), (() => { click('#btnSummary'); $('#pinIn').value = '1234'; click('#pinOk'); const x = !!$('#setOpen') || !!$('#menuOpen'); click('#closeX'); return x; })()], ['ตั้งค่า', false]);
  click('#btnSettings'); eq('needs PIN', !!$('#pinIn'), true); $('#pinIn').value = '0000'; click('#pinOk'); eq('wrong PIN stays out', !!$('[data-stock]'), false); click('#pinNo');
  openSet();
  eq('switches for 3 menus + 20 toppings, all on', [$$('[data-stock="menus"]').length, $$('[data-stock="items"]').length, $$('.sw.on').length], [3, 20, 23]);
  eq('no price inputs anywhere', $$('#modal input').length, 0);

  // ---- ท็อปปิ้งหมด ----
  click(sw('items', 'Mango'));
  eq('row turns grey + label หมด + switch off', [row('items', 'Mango').classList.contains('out'), row('items', 'Mango').querySelector('.st').textContent, sw('items', 'Mango').getAttribute('aria-checked')], [true, 'หมด', 'false']);
  eq('saved immediately', stored(), {items:['Mango']});
  click(sw('items', 'Strawberries')); click(sw('menus', 'banana'));
  click('#closeX');
  click('[data-menu="greek"]');
  const mango = $$('.topw.out').find(x => x.textContent.includes('มะม่วง'));
  eq('greek: sold-out tile grey + disabled', [!!mango, mango && mango.querySelector('button').disabled, mango && mango.textContent.includes('หมด'), !!$('[data-pick="Mango"]')], [true, true, true, false]);
  eq('banana choco menu grey + disabled', [$('.base.out') && $('.base.out').textContent.includes('Banana Choco'), !!$('[data-menu="banana"]')], [true, false]);
  click('[data-menu="acai"]');
  eq('acai: sold-out default flagged', $$('.comp.out').map(c => c.textContent.includes('สตรอว์เบอร์รี่')), [true]);
  click('[data-swap="1"]'); eq('swap grid: sold-out option disabled', [!!$('[data-choose="Mango"]'), $$('.swapgrid .top.out').length], [false, 1]);
  click('[data-addopen]'); eq('add grid: Mango disabled', !!$('[data-add="Mango"]'), false);
  click('[data-skip="1"]'); eq('removing the sold-out default clears flag', $$('.comp.out').length, 0);

  // ---- เปิดกลับ ----
  openSet(); click(sw('items', 'Mango'));
  eq('back on: row normal', [row('items', 'Mango').classList.contains('out'), stored().items], [false, ['Strawberries']]);
  click('#closeX'); ev('resetSel(); renderBuilder()'); click('[data-menu="greek"]');
  eq('greek: Mango selectable again', !!$('[data-pick="Mango"]'), true);

  // ---- PromptPay อยู่ในหน้าเดียวกัน ----
  openSet(); eq('PromptPay row present', [!!$('#ppOpen'), $('#modal').textContent.includes('ยังไม่ได้ตั้ง')], [true, true]);
  click('#ppOpen'); click('#setBack'); eq('back returns to settings', !!$('[data-stock]'), true);

  // ---- เปิดแอปใหม่: ใช้ค่าที่เก็บไว้ ----
  w.close(); w = open({promptpay:'0812345678', out:{items:['Kiwi'], menus:['acai']}}); d = w.document;
  await wait(50);
  eq('stored sold-out applied at start', [ev('ITEM.Kiwi.out'), ev('MENU.acai.out'), !!$('[data-menu="acai"]'), ev('SETTINGS.promptpay')], [true, true, false, '0812345678']);

  eq('no runtime errors', errors, []);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
