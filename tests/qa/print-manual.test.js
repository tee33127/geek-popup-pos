// QA หมวด 11 พิมพ์ (H01, X02 ตัดบรรทัดตั๋ว USB) · 12 หน้าจอ (UI03 UI05 UI08)
const {eq, done, open, wait, rng, T, ROOT} = require('./qa-helper');
const fs = require('fs'), path = require('path'), vm = require('vm');

(async () => {
  const p = open({now: T(2026, 10, 12, 12)}); await wait(30); p.signIn();
  const {ev, $, $$, click} = p;

  // ---------- H01 HTML กับ USB ต้องมีข้อความเดียวกัน (200 บิลสุ่ม seed 101) ----------
  ev(`window.__lines = html => { const d = document.createElement('div'); d.innerHTML = html; const out = [];
      d.firstElementChild.childNodes.forEach(n => { if(n.nodeName === 'HR') out.push('---'); else { const t = n.textContent.replace(/\\s+/g, ' ').trim(); if(t) out.push(t); } }); return out; };
    window.__blines = b => b.filter(x => !x.gap).map(x => x.rule ? '---' : ('left' in x ? x.left + x.right : x.text).replace(/\\s+/g, ' ').trim());`);
  const r = rng(101), tops = ev('CONFIG.items.map(i => i.name)'), cat = ev('Object.fromEntries(CONFIG.items.map(i => [i.name, i.cat]))');
  const ACAI = ['Banana', 'Strawberries', 'Blueberries', 'Granola', 'Flaxseeds'], BAN = ['Banana', 'Cacao peanut butter', 'Cashew', 'Chocolate Chips'];
  let bad = null;
  for(let n = 0; n < 200 && !bad; n++){
    const items = [];
    for(let j = 0, m = 1 + r.int(4); j < m; j++){
      const menu = r.pick(['greek', 'acai', 'banana']), st = {size:null, picks:[], comps:[], adds:[], sep:r() < 0.3};
      if(menu === 'greek'){ st.size = r.pick(['g1n', 'g1', 'g2']); st.picks = Array.from({length:r.int(7)}, () => r.pick(tops)); }
      else { st.comps = (menu === 'acai' ? ACAI : BAN).map(d => { const x = r(); return x < 0.15 ? null : x < 0.35 ? r.pick(tops.filter(t => cat[t] === cat[d])) : d; }); if(r() < 0.3) st.adds = Array.from({length:1 + r.int(3)}, () => r.pick(tops)); }
      items.push({menu, st, qty:1 + (r() < 0.2 ? 2 : 0), honey:r.pick(['none', 'little', 'normal', 'lots', 'side']), note:r() < 0.3 ? r.pick(['แพ้ถั่ว', 'ไม่เอาช้อน, ขอถุง', 'ใส่ "น้อย"']) : '', few: menu === 'greek' && r() < 0.2 ? r.int(3) : undefined});
    }
    const spec = {items, method:r.pick(['cash', 'promptpay', 'tcp']), dining:r.pick(['dinein', 'takeaway']), void:r() < 0.1, promo:r() < 0.3 ? r.pick(['b1g1', 'off30', 'freetop']) : null, staff:r() < 0.8 ? 'แพร' : ''};
    const res = ev(`(() => { const o = ${JSON.stringify(spec)};
      const items = o.items.map((c, k) => { const m = MENU[c.menu], P = priceItem(m, c.st);
        return {menu:m.id, name:m.name, sizeName:P.sizeName, tops:P.tops, ...(!m.noHoney && {honey:c.honey}), note:c.note, unit:P.unit, qty:c.qty, ...(P.sep && {sep:P.sep}), ...(c.few !== undefined && {fewTops:c.few}), key:'k' + k}; });
      const pr = o.promo ? promoEval(PROMO[o.promo], items, null) : null, gross = items.reduce((a, i) => a + i.unit * i.qty, 0), total = gross - (pr && pr.ok ? pr.discount : 0);
      const s = {id:1, no:${n + 1}, date:'2026-10-12', ts:new Date().toISOString(), dining:o.dining, items, total, method:o.method, received:total + 20, change:20, void:o.void, staff:o.staff,
        ...(pr && pr.ok && {promo:{id:o.promo, name:PROMO[o.promo].name, discount:pr.discount, detail:pr.detail}})};
      return {s, rh:__lines(receiptHtml(s)), rb:__blines(receiptBlocks(s)), kh:__lines(kitchenHtml(s)), kb:__blines(kitchenBlocks(s))}; })()`);
    if(JSON.stringify(res.rh) !== JSON.stringify(res.rb) || JSON.stringify(res.kh) !== JSON.stringify(res.kb)){
      const diff = (a, b) => a.map((x, i) => x !== b[i] ? {line:i, html:x, usb:b[i]} : null).filter(Boolean).slice(0, 3);
      bad = {seed:101, bill:n, receipt:diff(res.rh, res.rb), kitchen:diff(res.kh, res.kb)};
    }
  }
  eq('H01 200 บิลสุ่ม (seed 101): ใบเสร็จ/ตั๋วครัว HTML กับ USB ข้อความตรงกันทุกบรรทัด', bad, null);

  // ---------- UI03 ปุ่ม "เปลี่ยน" เด่นกว่า "ไม่รับ" ----------
  click('[data-menu="acai"]');
  const css = fs.readFileSync(path.join(ROOT, 'app/css/pos.css'), 'utf8');
  const rule = sel => (css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  eq('UI03 ปุ่ม "ไม่รับ" เป็นคลาส skip (รอง) · "เปลี่ยน" เป็นปุ่มปกติ', [$('[data-skip="0"]').className, $('[data-swap="0"]').className], ['skip', '']);
  console.log('INFO UI03 CSS .comp button:', rule('.comp button').trim().slice(0, 160));
  console.log('INFO UI03 CSS .comp button.skip:', rule('.comp button.skip').trim().slice(0, 160));

  // ---------- UI05 คู่มือตรงกับแอป ----------
  const man = fs.readFileSync(path.join(ROOT, 'manual/index.html'), 'utf8');
  const {JSDOM} = require('jsdom'); const md = new JSDOM(man).window.document;
  const names = [...new Set([...md.querySelectorAll('.k, .o')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const appText = [path.join(ROOT, 'app/index.html'), ...fs.readdirSync(path.join(ROOT, 'app/js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'app/js', f)),
    ...fs.readdirSync(path.join(ROOT, 'app/js/ui')).map(f => path.join(ROOT, 'app/js/ui', f))].map(f => fs.readFileSync(f, 'utf8')).join('\n');
  /* "…" ในคู่มือ = ตัวเลขที่แอปใส่ให้ (เช่น ลูกค้าขอแค่ … อย่าง → `ลูกค้าขอแค่ ${n} อย่าง`) */
  const found = n => n.includes('…') ? n.split('…').every(part => appText.includes(part.trim())) : appText.includes(n);
  const missing = names.filter(n => !found(n));
  console.log(`INFO UI05 ชื่อปุ่ม/ข้อความในคู่มือ ${names.length} รายการ`);
  eq('UI05 ทุกชื่อปุ่มในคู่มือ (.k .o) มีอยู่จริงในแอป', missing, []);

  // ---------- UI08 5,000 บิลในเครื่อง ----------
  const N = 5000;
  ev(`(() => { const base = ${T(2026, 6, 1, 10)}, list = [];
    for(let i = 0; i < ${N}; i++){ const t = base + i * 3600000 * 6; const P = priceItem(MENU.acai, {comps:MENU.acai.defaults.slice(), adds:[], sep:false});
      list.push({id:t, no:(i % 4) + 1, date:bizDate(new Date(t)), ts:new Date(t).toISOString(), dining:'dinein', items:[{menu:'acai', name:'Acai', sizeName:'', tops:P.tops, honey:'normal', note:'', unit:P.unit, qty:1}], total:P.unit, method:'cash', received:P.unit, change:0, void:false, staff:'แพร'}); }
    saveSales(list); })()`);
  const time = fn => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
  const tAll = time(() => { click('#btnSummary'); click('[data-range="all"]'); });
  const tBills = time(() => click('[data-tab="bills"]'));
  click('#closeX');
  p.add({menu:'banana'});
  const tPay = time(() => p.pay('tcp'));
  console.log(`INFO UI08 ${N} บิล: สรุป "ทั้งหมด" ${tAll.toFixed(0)} ms · แท็บบิล (ตาราง ${N} แถว) ${tBills.toFixed(0)} ms · บันทึกบิล 1 ใบ ${tPay.toFixed(0)} ms (jsdom ช้ากว่าเบราว์เซอร์จริง)`);
  eq('UI08 บันทึกบิลกับ 5,000 บิลในเครื่อง < 500 ms', tPay < 500, true);
  eq('UI08 เปิดสรุป "ทั้งหมด" 5,000 บิล < 2,000 ms', tAll < 2000, true);
  p.close();

  // ---------- X02 ตั๋ว USB ตัดบรรทัด: หมายเหตุยาว อีโมจิ ภาษาไทยมีวรรณยุกต์ ----------
  const ctx = vm.createContext({console, Intl});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/printer.js'), 'utf8'), ctx);
  const drawn = [];
  const c2d = {measureText: s => ({width: [...s].length * 13}), fillRect(){}, fillText: t => drawn.push(t), set font(v){}, set fillStyle(v){}, set textAlign(v){}, set textBaseline(v){}};
  const canvas = {getContext: () => c2d};
  ctx.__canvas = canvas;
  const note = 'หมายเหตุ: ' + 'ลูกค้าแพ้ถั่วลิสงขอไม่ใส่เนยถั่วและช็อกโกแลตชิพ '.repeat(10) + '😀👍🏽🇹🇭 ' + 'ฮ่าาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาา่' + ' 😀'.repeat(30) + ' ' + '👍🏽'.repeat(40);
  vm.runInContext(`renderSlip([{text:${JSON.stringify(note)}, bold:true}], 576, __canvas)`, ctx);
  const joined = drawn.join('');
  const COMB = /^[ัิ-ฺ็-๎]/, LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const badStart = drawn.filter(l => COMB.test(l)), broken = drawn.filter(l => LONE.test(l)), wide = drawn.filter(l => [...l].length * 13 > 576 - 16);
  console.log(`INFO X02 หมายเหตุ ${[...note].length} ตัว → ${drawn.length} บรรทัด`);
  eq('X02 ตัดบรรทัดไม่เกินความกว้าง และข้อความไม่หาย', [wide.length, joined.replace(/\s/g, '') === note.replace(/\s/g, '')], [0, true]);
  eq('X02 ไม่มีบรรทัดที่ขึ้นต้นด้วยสระบน/วรรณยุกต์ และไม่มีอีโมจิขาดครึ่ง', [badStart, broken.length], [[], 0]);
  done();
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
